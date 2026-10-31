import { randomBytes, randomUUID, createHash } from 'node:crypto'
import { Client } from 'pg'
import type { EstadoDaCoordenacao } from '../../packages/shared/src/operacao/painel.ts'
import { TAMANHO_MAXIMO_NOME_DIGITADO } from '../../packages/shared/src/operacao/painel.ts'
import { TAMANHO_MAXIMO_SLUG } from '../../packages/shared/src/estrutura/rede-e-escola.ts'
import { urlDoBancoDeTeste } from '../../tools/ci/compose.ts'

/**
 * As escolas que o painel da operação lista no e2e (A0b, cenários W6 e W7), semeadas direto no banco, como o `ops:escola`
 * e o convite do F1 as deixariam. Tudo sintético: nomes inventados, e-mails no domínio reservado `.invalid` (regra 20,
 * item 17).
 *
 * O banco do compose de teste guarda as escolas das outras suítes, e a lista do painel é de todas. Por isso as escolas
 * que o teste precisa ver na primeira página ganham uso no dia de referência, maior que o de qualquer outra: na ordem
 * `uso` elas vêm primeiro. O valor sobe com o relógio, e o que sobrar de uma execução interrompida fica atrás do de
 * agora, salvo o painel `topo`, que fica na frente por `MARGEM_DO_TOPO_MS` e depois desse tempo passa a ficar atrás
 * também. No fim, o teste as apaga (`removerPainel`).
 *
 * Quem afirma a posição das suas escolas na ordem por uso conta com poucas escolas na frente (a página tem 25). A conta
 * do pior caso, com os 6 trabalhadores da máquina e `fullyParallel`, está em `UsoDoPainel`.
 */

async function comBanco<T>(tarefa: (banco: Client) => Promise<T>): Promise<T> {
  const banco = new Client({ connectionString: urlDoBancoDeTeste() })
  await banco.connect()
  try {
    return await tarefa(banco)
  } finally {
    await banco.end()
  }
}

async function id(banco: Client, instrucao: string, parametros: unknown[]): Promise<string> {
  const { rows } = await banco.query<{ id: string }>(instrucao, parametros)
  const criado = rows[0]?.id
  if (criado === undefined) throw new Error(`o seed do painel não criou a linha: ${instrucao}`)
  return criado
}

/**
 * Quanto o relógio do painel `topo` anda à frente: mais que o teste mais longo dura (o prazo do `test.slow()` é de 90 s),
 * e por isso um painel `topo` vivo está na frente de qualquer painel comum semeado depois dele. Passado esse tempo, a sobra
 * de uma execução interrompida volta a ficar atrás do painel de agora.
 */
const MARGEM_DO_TOPO_MS = 180_000

/**
 * O uso que o painel dá às escolas, e quem usa cada um. O que decide é quantas escolas com uso podem estar vivas ao mesmo
 * tempo e na frente de quem procura as suas na primeira página (25), nos dois specs que semeiam painel (`operacao-uso` e
 * `operacao-escolas`), que a máquina mistura (6 trabalhadores) e a esteira também (2):
 *
 * - `comum`: as 8 primeiras escolas, com o uso de agora. O W6 e o W10 de Escolas, que afirmam as 7 do `porEstado` na
 *   primeira página e nenhuma na segunda. Vivos ao mesmo tempo: o dele e o do outro projeto (o Chromebook e o celular).
 * - `topo`: só as 2 primeiras, com o uso de agora mais a margem. O W6 do Uso, que afirma essas 2. Vivos ao mesmo tempo:
 *   o dele e o do outro projeto, 2 + 2 escolas.
 * - `nenhum`: nenhuma linha de uso. Os casos que só precisam da lista cheia (o RF23 e o 14.4 dos dois specs).
 *
 * Pior caso do W6 do Uso: a outra `topo`, 2 escolas na frente; a dele é a posição 3 no máximo.
 * Pior caso do W6 e W10 de Escolas: as 4 de `topo` e as 8 do outro `comum` na frente, e a mais baixa do `porEstado` é a
 * 8ª do painel (posição 7): posição 19 no máximo, de 25, com folga de 5 escolas para a sobra de uma execução interrompida
 * (a `topo` dura `MARGEM_DO_TOPO_MS`, e as comuns ficam atrás do painel de agora).
 * Quem passar a semear painel `comum` ou `topo` em outro caso refaz esta conta.
 */
export type UsoDoPainel = 'comum' | 'topo' | 'nenhum'

export interface EscolaSemeada {
  readonly id: string
  readonly nome: string
  readonly slug: string
}

export interface PainelSemeado {
  readonly redeId: string
  readonly redeNome: string
  /** As 30 escolas, na ordem em que foram criadas. */
  readonly escolas: readonly EscolaSemeada[]
  /** A de nome e rede com 200 caracteres e endereço com 63: a que estica a linha e o cartão a 360 px. */
  readonly longa: EscolaSemeada
  /** Uma escola em cada estado da coordenação, todas na primeira página da ordem `uso`. */
  readonly porEstado: Readonly<Record<EstadoDaCoordenacao, EscolaSemeada>>
  readonly contas: readonly string[]
}

/** Um texto de exatamente `tamanho` caracteres, começando pelo que interessa ler. */
function esticar(inicio: string, tamanho: number): string {
  const enchimento = ' de Ensino Fundamental e Médio da Rede Sintética de Exemplo'
  let texto = inicio
  while (texto.length < tamanho) texto += enchimento
  return texto.slice(0, tamanho).trimEnd().padEnd(tamanho, 'a')
}

const ESTADOS_SEMEADOS: readonly EstadoDaCoordenacao[] = ['sem_convite', 'pendente', 'vencido', 'revogado', 'aceito', 'sem_coordenacao', 'ativa']

/**
 * A coordenação de uma escola em cada estado (Tech Spec da A0b, seção 5), pelos mesmos campos que a
 * `estadoDaCoordenacao` lê: o coordenador ativo, ou o último convite de coordenação e o usuário dele.
 */
async function coordenacaoNoEstado(banco: Client, escolaId: string, estado: EstadoDaCoordenacao, marca: string): Promise<string | undefined> {
  if (estado === 'sem_convite') return undefined
  const contaId = await id(banco, 'insert into conta (email) values ($1) returning id', [`painel-${estado}-${marca}@educa.invalid`])
  const nome = `Coordenadora sintética ${marca.slice(0, 8)}`
  if (estado === 'ativa') {
    await banco.query("insert into usuario (escola_id, conta_id, papel, nome, introducao_vista_em) values ($1, $2, 'coordenador', $3, now())", [escolaId, contaId, nome])
    return contaId
  }
  // O convidado nasce inativo; no aceite ele entraria. `aceito`: desativado antes do uso do convite (falta a primeira
  // entrada); `sem_coordenacao`: desativado depois.
  const desativado = estado === 'aceito' ? "now() - interval '1 hour'" : 'now()'
  const usuarioId = await id(banco, `insert into usuario (escola_id, conta_id, papel, nome, desativado_em, introducao_vista_em) values ($1, $2, 'coordenador', $3, ${desativado}, now()) returning id`, [
    escolaId,
    contaId,
    nome,
  ])
  const expira = estado === 'vencido' ? "now() - interval '1 minute'" : "now() + interval '72 hours'"
  const usado = estado === 'aceito' ? 'now()' : estado === 'sem_coordenacao' ? "now() - interval '1 hour'" : 'null'
  const revogado = estado === 'revogado' ? 'now()' : 'null'
  await banco.query(
    `insert into convite (escola_id, token_hash, tipo, usuario_id, expira_em, usado_em, revogado_em) values ($1, $2, 'coordenador', $3, ${expira}, ${usado}, ${revogado})`,
    [escolaId, createHash('sha256').update(randomBytes(32).toString('base64url')).digest('hex'), usuarioId],
  )
  return contaId
}

/**
 * 30 escolas numa rede de nome longo: a primeira com nome de 200 caracteres e endereço de 63, as sete seguintes uma em
 * cada estado da coordenação, e o resto sem nada. As primeiras levam uso no último dia fechado, em ordem decrescente: 8, 2
 * ou nenhuma, conforme o `UsoDoPainel`.
 *
 * O uso fica acima do de qualquer escola do banco semeada até agora, e o relógio o faz subir: o painel `comum` que chega
 * depois passa na frente do anterior na ordem por uso. O `topo` fica acima também dos que chegarem nos 3 minutos seguintes.
 * Quantas escolas, e de quem, ver `UsoDoPainel`.
 */
export async function semearPainel(uso: UsoDoPainel = 'comum'): Promise<PainelSemeado> {
  const marca = randomUUID().replaceAll('-', '')
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ dia: string }>("select ((now() at time zone 'America/Sao_Paulo')::date - 1)::text as dia")
    const dia = rows[0]?.dia
    if (dia === undefined) throw new Error('o seed do painel não leu o dia de referência')
    // Maior que o uso de qualquer outra escola do banco, e crescente com o relógio (cabe com folga em 2^53). O `topo` tem os
    // mesmos 15 dígitos: o número mais largo cabe na linha e no cartão a 360 px como o das outras.
    const usoDaVez = (Date.now() + (uso === 'topo' ? MARGEM_DO_TOPO_MS : 0)) * 100
    const comUso = uso === 'comum' ? 8 : uso === 'topo' ? 2 : 0

    // Na frente das outras redes do banco, para o seletor do Nova escola (que corta em 200) mostrá-la.
    const redeNome = esticar(nomeDeRedeQueVemPrimeiro('Rede sintética do painel'), TAMANHO_MAXIMO_NOME_DIGITADO)
    const redeId = await id(banco, "insert into rede (nome, tipo) values ($1, 'prefeitura') returning id", [redeNome])
    const escolas: EscolaSemeada[] = []
    const contas: string[] = []
    const porEstado: Partial<Record<EstadoDaCoordenacao, EscolaSemeada>> = {}
    for (let posicao = 0; posicao < 30; posicao++) {
      const longa = posicao === 0
      const nome = longa ? esticar(`Colégio sintético do painel ${marca.slice(0, 8)}`, TAMANHO_MAXIMO_NOME_DIGITADO) : `Escola sintética do painel ${marca.slice(0, 8)} ${String(posicao).padStart(2, '0')}`
      const prefixo = `painel-${marca}-${String(posicao).padStart(2, '0')}`
      // O endereço longo não tem hífen: sem ponto de quebra, só o `wrap-anywhere` da linha e do cartão o segura a 360 px.
      const slug = longa ? `p${marca}`.padEnd(TAMANHO_MAXIMO_SLUG, 'x') : prefixo
      const escolaId = await id(banco, 'insert into escola (rede_id, nome, slug) values ($1, $2, $3) returning id', [redeId, nome, slug])
      const escola = { id: escolaId, nome, slug }
      escolas.push(escola)
      const estado = ESTADOS_SEMEADOS[posicao - 1]
      if (estado !== undefined) {
        porEstado[estado] = escola
        const contaId = await coordenacaoNoEstado(banco, escolaId, estado, `${marca}-${String(posicao)}`)
        if (contaId !== undefined) contas.push(contaId)
      }
      if (posicao < comUso) {
        await banco.query('insert into uso_infra_diario (escola_id, dia, requisicoes, jobs, bytes_storage) values ($1, $2, $3, 0, 0)', [escolaId, dia, usoDaVez - posicao])
      }
    }
    const longa = escolas[0]
    if (longa === undefined || ESTADOS_SEMEADOS.some((estado) => porEstado[estado] === undefined)) throw new Error('o seed do painel ficou incompleto')
    return { redeId, redeNome, escolas, longa, porEstado: porEstado as Record<EstadoDaCoordenacao, EscolaSemeada>, contas }
  })
}

/**
 * Troca as tarefas em segundo plano e os bytes da linha de uso que o `semearPainel` deu à escola no dia de referência (a
 * única linha dela no mês): a tela Uso mostra os dois no formato de cada um (A0b, tarefa 8.0).
 */
export async function definirUsoDaEscolaSemeada(escolaId: string, uso: { readonly jobs: number; readonly bytesStorage: number }): Promise<void> {
  await comBanco(async (banco) => {
    const { rowCount } = await banco.query('update uso_infra_diario set jobs = $2, bytes_storage = $3 where escola_id = $1', [escolaId, uso.jobs, uso.bytesStorage])
    if (rowCount !== 1) throw new Error('a escola semeada não tem a linha de uso do dia de referência')
  })
}

/** Apaga o que `semearPainel` criou: uso, convites, usuários, contas, escolas e a rede. */
export async function removerPainel(painel: PainelSemeado): Promise<void> {
  const escolas = painel.escolas.map((escola) => escola.id)
  await comBanco(async (banco) => {
    await banco.query('delete from uso_infra_diario where escola_id = any($1::uuid[])', [escolas])
    await banco.query('delete from convite where escola_id = any($1::uuid[])', [escolas])
    await banco.query('delete from usuario where escola_id = any($1::uuid[])', [escolas])
    await banco.query('delete from conta where id = any($1::uuid[])', [painel.contas])
    await banco.query('delete from escola where id = any($1::uuid[])', [escolas])
    await banco.query('delete from rede where id = $1', [painel.redeId])
  })
}

/**
 * Um nome de rede que vem antes de todas as outras do banco de teste na lista por nome, que o `GET /v1/operacao/redes`
 * corta em 200: o número do começo diminui com o relógio, e a rede de agora passa na frente das que as execuções
 * anteriores deixaram (o banco local guarda milhares). É o que deixa o seletor do Nova escola mostrar a rede do teste.
 */
export function nomeDeRedeQueVemPrimeiro(resto: string): string {
  return `${String(9_999_999_999_999 - Date.now()).padStart(13, '0')} ${resto} ${randomUUID().slice(0, 8)}`
}

/** Uma rede sem escola, para o teste que cria a escola pela tela, com o nome que abre o seletor. */
export async function criarRedeDoPainel(): Promise<{ readonly id: string; readonly nome: string }> {
  const nome = nomeDeRedeQueVemPrimeiro('Rede sintética da tela')
  return comBanco(async (banco) => ({ id: await id(banco, "insert into rede (nome, tipo) values ($1, 'grupo') returning id", [nome]), nome }))
}

/** As escolas com aquele endereço, com a rede: é por aqui que o teste confere quantas a tela criou, e com que id. */
export async function escolasComOEndereco(slug: string): Promise<{ id: string; redeId: string; nome: string }[]> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ id: string; rede_id: string; nome: string }>('select id, rede_id, nome from escola where slug = $1', [slug])
    return rows.map((linha) => ({ id: linha.id, redeId: linha.rede_id, nome: linha.nome }))
  })
}

/** As redes com aquele nome: a criada pela tela, que o teste confere pelo nome único. */
export async function redesComONome(nome: string): Promise<{ id: string; tipo: string }[]> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ id: string; tipo: string }>('select id, tipo from rede where nome = $1', [nome])
    return rows
  })
}

/** Um nome que vem antes dos outros na lista por nome (`nomeDeRedeQueVemPrimeiro`): a escola do teste na primeira página. */
export const nomeQueVemPrimeiro = nomeDeRedeQueVemPrimeiro

/** A escola que o teste do convite usa: id, nome e, no estado `pendente`, o último convite de coordenação. */
export interface EscolaDoConvite extends EscolaSemeada {
  readonly redeId: string
  readonly conviteId: string | undefined
}

/**
 * Uma escola numa rede própria, com o nome que abre a lista por nome, e a coordenação `sem_convite` ou `pendente` (A0b,
 * tarefa 7.0). Sintética como as do `semearPainel`. O teste do convite não a apaga: o convite que ele gera pela tela deixa
 * auditoria nela, como nas escolas que a tela cria (a limpeza do banco de teste é correção à parte). A `sem_convite` que
 * ninguém tocou se apaga com `removerEscolaSemConvite`.
 */
export async function semearEscolaDoConvite(estado: 'sem_convite' | 'pendente'): Promise<EscolaDoConvite> {
  const marca = randomUUID().replaceAll('-', '')
  return comBanco(async (banco) => {
    const redeId = await id(banco, "insert into rede (nome, tipo) values ($1, 'grupo') returning id", [nomeQueVemPrimeiro('Rede sintética do convite')])
    const nome = nomeQueVemPrimeiro('Escola sintética do convite')
    const slug = `convite-${marca}`
    const escolaId = await id(banco, 'insert into escola (rede_id, nome, slug) values ($1, $2, $3) returning id', [redeId, nome, slug])
    await coordenacaoNoEstado(banco, escolaId, estado, marca)
    return { id: escolaId, nome, slug, redeId, conviteId: await ultimoConvite(banco, escolaId) }
  })
}

/** Apaga a escola `sem_convite` que o teste só precisava ter no banco, e a rede dela: sem conta, usuário nem convite. */
export async function removerEscolaSemConvite(escola: EscolaDoConvite): Promise<void> {
  await comBanco(async (banco) => {
    await banco.query('delete from escola where id = $1', [escola.id])
    await banco.query('delete from rede where id = $1', [escola.redeId])
  })
}

async function ultimoConvite(banco: Client, escolaId: string): Promise<string | undefined> {
  const { rows } = await banco.query<{ id: string }>("select id from convite where escola_id = $1 and tipo = 'coordenador' order by expira_em desc, id desc limit 1", [escolaId])
  return rows[0]?.id
}

/** O último convite de coordenação da escola, como a lista o traz: o que o refazer e o revogar recebem. */
export async function ultimoConviteDaEscola(escolaId: string): Promise<string | undefined> {
  return comBanco((banco) => ultimoConvite(banco, escolaId))
}

/** Quantos convites de coordenação da escola estão em aberto (nem usados nem revogados). */
export async function convitesEmAberto(escolaId: string): Promise<number> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ total: string }>(
      "select count(*)::text as total from convite where escola_id = $1 and tipo = 'coordenador' and usado_em is null and revogado_em is null",
      [escolaId],
    )
    return Number(rows[0]?.total ?? '0')
  })
}

/** A escola que a tela criou, pelo endereço: o id, para o teste conferir os convites dela no banco. */
export async function idDaEscolaComOEndereco(slug: string): Promise<string> {
  const [escola] = await escolasComOEndereco(slug)
  if (escola === undefined) throw new Error('a escola do teste não está no banco')
  return escola.id
}
