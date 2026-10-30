import 'reflect-metadata'
import { ALVOS_DO_EXPURGO_DE_ACESSO, executarNoContexto, ExpurgoDeAcessoRepository, instrucaoDoLoteDeAcesso, LOTE_DO_EXPURGO, type AlvoDoExpurgoDeAcesso } from '@educa/nucleo'
import { JobFailureCode, TIPO_EXPURGAR_ACESSO } from '@educa/shared'
import { Queue } from 'bullmq'
import { PgDialect } from 'drizzle-orm/pg-core'
import { randomBytes, randomUUID } from 'node:crypto'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { lerAmbienteDeTeste, valorObrigatorio } from '../../../tools/ci/compose.ts'
import { compose, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import { AGENDAMENTOS, FILA_DOS_AGENDAMENTOS } from '../src/agendamentos.js'
import type { ConfiguracaoStorage } from '../src/config.js'
import { montarWorker, type WorkerMontado } from '../src/montagem.js'
import { criarExpurgoDeAcesso, type TotaisDoExpurgoDeAcesso } from '../src/processadores/expurgar-acesso.js'
import { BancadaDeFila, configuracaoDoBanco, janelaPadraoDoAmbiente, LogEmMemoria, urlRedisDeFila, vagasPadraoDoAmbiente } from './fila-de-teste.js'
import { execucaoDoJob } from './execucao-do-job.js'

// `registro_acesso`, `sessao` e `convite` do Postgres do compose de teste, com linhas de duas escolas (e a falha de
// login sem escola) dos dois lados de cada prazo, e `acesso_operacao`, `sessao_operador` e `convite_operador` da
// operação Turmma (A0, tarefa 9.0, C38), de um operador ativo e de desativados, também dos dois lados. Só o relógio é injetado: 4h30 de amanhã em São Paulo, fora do horário
// letivo (o job não urgente passa pela janela) e de 4h30 a 29h depois do `now()` do banco. As linhas "1 hora além do
// prazo" só saem se o corte vier do relógio injetado, e não do banco.

const ambiente = lerAmbienteDeTeste()
const STORAGE: ConfiguracaoStorage = {
  url: `http://127.0.0.1:${valorObrigatorio(ambiente, 'STORAGE_PORTA_HOST')}`,
  regiao: valorObrigatorio(ambiente, 'STORAGE_REGIAO'),
  bucket: valorObrigatorio(ambiente, 'STORAGE_BUCKET'),
  chaveAcesso: valorObrigatorio(ambiente, 'STORAGE_CHAVE_ACESSO'),
  chaveSecreta: valorObrigatorio(ambiente, 'STORAGE_CHAVE_SECRETA'),
}

const AMANHA_EM_SAO_PAULO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(Date.now() + 24 * 60 * 60 * 1000))
const AGORA = new Date(`${AMANHA_EM_SAO_PAULO}T04:30:00-03:00`)
const relogio = { agora: () => AGORA }

interface NoDoPlano {
  'Index Name'?: string
  'Node Type'?: string
  Plans?: NoDoPlano[]
}

function nosDoPlano(no: NoDoPlano | undefined): NoDoPlano[] {
  return no === undefined ? [] : [no, ...(no.Plans ?? []).flatMap(nosDoPlano)]
}

/** Cada passo da rotina: as três tabelas por prazo, e a limpeza das contas. */
type Passo = AlvoDoExpurgoDeAcesso | 'conta'

/** As três tabelas da operação que o expurgo apaga (A0, tarefa 9.0). */
const ALVOS_DA_OPERACAO = ['acesso_operacao', 'sessao_operador', 'convite_operador'] as const

/** O que cada caso semeia: os ids que precisam sair e os que precisam ficar, por tabela, e o que nunca sai. */
interface Semeado {
  sai: Record<AlvoDoExpurgoDeAcesso, string[]>
  fica: Record<AlvoDoExpurgoDeAcesso, string[]>
  /** Os operadores semeados, o ativo e os desativados: nunca passam pelo expurgo. */
  operadores: string[]
  /** A auditoria da operação, de qualquer idade: nunca passa pelo expurgo. */
  auditorias: string[]
}

/** Os operadores deste arquivo têm este prefixo no apelido, para a limpeza achar o que um portão interrompido deixou. */
const PREFIXO_DO_OPERADOR = 'expurgo-'

/** Apaga os operadores deste arquivo (pelo prefixo) e tudo que aponta para eles. */
async function limparOperadores(pool: BancadaDeFila['pool']): Promise<void> {
  const ids = (await pool.query<{ id: string }>('select id from operador where apelido like $1', [`${PREFIXO_DO_OPERADOR}%`])).rows.map(({ id }) => id)
  if (ids.length === 0) return
  await pool.query('delete from auditoria_operacao where operador_alvo_id = any($1::uuid[])', [ids])
  await pool.query('delete from acesso_operacao where operador_id = any($1::uuid[])', [ids])
  await pool.query('delete from sessao_operador where operador_id = any($1::uuid[])', [ids])
  await pool.query('delete from convite_operador where operador_id = any($1::uuid[])', [ids])
  await pool.query('delete from codigo_recuperacao_operador where operador_id = any($1::uuid[])', [ids])
  await pool.query('delete from operador where id = any($1::uuid[])', [ids])
}

beforeAll(async () => {
  // Worker do compose de pé poderia rodar um expurgo agendado no meio da contagem.
  compose('stop', ...PROCESSOS_DA_FILA)
  // Um operador ativo que um portão interrompido tivesse deixado faria todo `ops:*` de outro arquivo exigir um
  // `OPERADOR` que ele não conhece.
  const bancada = new BancadaDeFila()
  try {
    await limparOperadores(bancada.pool)
  } finally {
    await bancada.fechar()
  }
})

describe('sistema.expurgar-acesso', () => {
  let bancada: BancadaDeFila
  const log = new LogEmMemoria('worker-teste')
  const montados: WorkerMontado[] = []
  let semeado: Semeado

  async function inserir(texto: string, valores: unknown[]): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>(texto, valores)
    const id = rows[0]?.id
    if (id === undefined) throw new Error('linha de teste não criada')
    return id
  }

  const usuario = (escolaId: string) => inserir("insert into usuario (escola_id, papel, nome) values ($1, 'aluno', 'Aluno sintético do expurgo') returning id", [escolaId])

  const registro = (escolaId: string | null, usuarioId: string | null, evento: string, ha: string) =>
    inserir(`insert into registro_acesso (escola_id, usuario_id, evento, ip, em) values ($1, $2, $3, '203.0.113.7', $4::timestamptz - $5::interval) returning id`, [
      escolaId,
      usuarioId,
      evento,
      AGORA.toISOString(),
      ha,
    ])

  /** `encerradaHa` nulo é a sessão nunca encerrada; `expiraEm` é o intervalo antes do `AGORA` (negativo é futuro). */
  const sessao = (escolaId: string, usuarioId: string, encerradaHa: string | null, expiraHa: string) =>
    inserir(
      `insert into sessao (escola_id, usuario_id, metodo, familia, refresh_hash, ultimo_uso_em, expira_em, encerrada_em, motivo)
       values ($1, $2, 'matricula', uuidv7(), $3, $4::timestamptz - $6::interval - interval '12 hours', $4::timestamptz - $6::interval,
               case when $5::interval is null then null else $4::timestamptz - $5::interval end,
               case when $5::interval is null then null else 'saida' end)
       returning id`,
      [escolaId, usuarioId, randomBytes(32).toString('hex'), AGORA.toISOString(), encerradaHa, expiraHa],
    )

  const convite = (escolaId: string, usuarioId: string, datas: { usadoHa?: string; revogadoHa?: string; expiraHa: string }, tipo: 'coordenador' | 'professor' = 'coordenador') =>
    inserir(
      `insert into convite (escola_id, token_hash, tipo, usuario_id, expira_em, usado_em, revogado_em)
       values ($1, $2, $8, $3, $4::timestamptz - $5::interval,
               case when $6::interval is null then null else $4::timestamptz - $6::interval end,
               case when $7::interval is null then null else $4::timestamptz - $7::interval end)
       returning id`,
      [escolaId, randomBytes(32).toString('hex'), usuarioId, AGORA.toISOString(), datas.expiraHa, datas.usadoHa ?? null, datas.revogadoHa ?? null, tipo],
    )

  /** O ano e a série sintéticos de cada escola, criados na primeira turma dela. */
  const estruturas = new Map<string, { anoId: string; serieId: string }>()

  /** Uma turma nova na escola, pelo banco: a FK composta do acesso da turma pede turma do ano da escola. */
  async function turmaNova(escolaId: string): Promise<{ anoId: string; turmaId: string }> {
    let estrutura = estruturas.get(escolaId)
    if (estrutura === undefined) {
      const anoId = await inserir("insert into ano_letivo (escola_id, ano, inicio, fim) values ($1, 2026, '2026-02-01', '2026-12-15') returning id", [escolaId])
      const serieId = await inserir("insert into serie (escola_id, etapa, ano) values ($1, 'em', 2) returning id", [escolaId])
      estrutura = { anoId, serieId }
      estruturas.set(escolaId, estrutura)
    }
    const turmaId = await inserir('insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, $4) returning id', [
      escolaId,
      estrutura.anoId,
      estrutura.serieId,
      `Turma ${randomBytes(4).toString('hex')}`,
    ])
    return { anoId: estrutura.anoId, turmaId }
  }

  /**
   * O acesso da turma (A1, tarefa 10.0), numa turma só dele: um não revogado por turma (`acesso_turma_um_por_turma`).
   * Como o `convite`: `expiraHa` negativo é futuro, e `revogadoHa` nulo é o nunca revogado.
   */
  const acessoTurma = async (escolaId: string, datas: { revogadoHa?: string; expiraHa: string }) => {
    const { anoId, turmaId } = await turmaNova(escolaId)
    return inserir(
      `insert into acesso_turma (escola_id, ano_letivo_id, turma_id, token_hash, codigo_hmac, validade_dias, expira_em, revogado_em)
       values ($1, $2, $3, $4, $5, 7, $6::timestamptz - $7::interval,
               case when $8::interval is null then null else $6::timestamptz - $8::interval end)
       returning id`,
      [escolaId, anoId, turmaId, randomBytes(32).toString('hex'), randomBytes(32).toString('base64url'), AGORA.toISOString(), datas.expiraHa, datas.revogadoHa ?? null],
    )
  }

  /**
   * Um operador sintético, criado há 10 anos: ativo (com nome e e-mail em `.invalid`) ou desativado há 5 anos, já sem
   * dado pessoal, como o `desativar` o deixa.
   */
  const operador = (ativo: boolean) => {
    const apelido = `${PREFIXO_DO_OPERADOR}${randomBytes(6).toString('hex')}`
    return ativo
      ? inserir(`insert into operador (apelido, nome, email, criado_em) values ($1, 'Pessoa Sintética da Operação', $2, $3::timestamptz - interval '10 years') returning id`, [
          apelido,
          `${apelido}@turmma.invalid`,
          AGORA.toISOString(),
        ])
      : inserir(`insert into operador (apelido, criado_em, desativado_em) values ($1, $2::timestamptz - interval '10 years', $2::timestamptz - interval '5 years') returning id`, [
          apelido,
          AGORA.toISOString(),
        ])
  }

  const acessoOperacao = (operadorId: string | null, evento: string, ha: string) =>
    inserir(`insert into acesso_operacao (operador_id, evento, ip, em) values ($1, $2, '198.51.100.9', $3::timestamptz - $4::interval) returning id`, [
      operadorId,
      evento,
      AGORA.toISOString(),
      ha,
    ])

  /** Como a `sessao`: `encerradaHa` nulo é a sessão nunca encerrada; `expiraHa` negativo é futuro. */
  const sessaoOperador = (operadorId: string, encerradaHa: string | null, expiraHa: string) =>
    inserir(
      `insert into sessao_operador (operador_id, refresh_hash, criada_em, ultimo_uso_em, expira_em, encerrada_em, motivo)
       values ($1, $2, $3::timestamptz - $5::interval - interval '8 hours', $3::timestamptz - $5::interval - interval '8 hours', $3::timestamptz - $5::interval,
               case when $4::interval is null then null else $3::timestamptz - $4::interval end,
               case when $4::interval is null then null else 'saida' end)
       returning id`,
      [operadorId, randomBytes(32).toString('hex'), AGORA.toISOString(), encerradaHa, expiraHa],
    )

  /** Como o `convite`. Um pendente por operador (único parcial): o pendente vai para um operador desativado novo. */
  const conviteOperador = async (datas: { usadoHa?: string; revogadoHa?: string; expiraHa: string }, operadorId?: string) =>
    inserir(
      `insert into convite_operador (operador_id, token_hash, expira_em, usado_em, revogado_em)
       values ($1, $2, $3::timestamptz - $4::interval,
               case when $5::interval is null then null else $3::timestamptz - $5::interval end,
               case when $6::interval is null then null else $3::timestamptz - $6::interval end)
       returning id`,
      [operadorId ?? (await novoDesativado()), randomBytes(32).toString('hex'), AGORA.toISOString(), datas.expiraHa, datas.usadoHa ?? null, datas.revogadoHa ?? null],
    )

  const auditoriaOperacao = (operadorId: string, acao: string, ha: string) =>
    inserir(`insert into auditoria_operacao (autor, acao, operador_alvo_id, em) values ('bootstrap', $1, $2, $3::timestamptz - $4::interval) returning id`, [
      acao,
      operadorId,
      AGORA.toISOString(),
      ha,
    ])

  /**
   * Um incidente registrado `ha` antes do `AGORA` (conhecido uma hora antes de registrado, como o check do banco pede), com uma
   * seção para cada escola dada: o prazo de 5 anos conta do `registrado_em`, e as seções saem em cascata.
   */
  const incidente = async (ha: string, escolas: readonly string[]) => {
    const id = await inserir(
      `insert into incidente (conhecido_em, registrado_por, registrado_em)
       values ($1::timestamptz - $2::interval - interval '1 hour', 'equipe-de-teste', $1::timestamptz - $2::interval) returning id`,
      [AGORA.toISOString(), ha],
    )
    for (const escolaId of escolas) {
      await bancada.pool.query(
        `insert into incidente_escola (incidente_id, escola_id, circunstancias, categorias, titulares_estimados, risco, contencao, correcao)
         values ($1, $2, 'Circunstância sintética', array['cadastro'], 3, 'baixo', 'Contenção sintética', 'Correção sintética')`,
        [id, escolaId],
      )
    }
    return id
  }

  /** As seções (de qualquer escola) dos incidentes dados que ainda existem. */
  const secoesDos = async (ids: readonly string[]): Promise<number> =>
    (await bancada.pool.query<{ n: number }>('select count(*)::int as n from incidente_escola where incidente_id = any($1::uuid[])', [ids])).rows[0]?.n ?? -1

  let operadoresDoCaso: string[] = []
  const novoDesativado = async () => {
    const id = await operador(false)
    operadoresDoCaso.push(id)
    return id
  }

  /** O lado da operação: cada prazo dos dois lados, de um operador ativo e de desativados, e a auditoria de toda idade. */
  async function semearOperacao(resultado: Semeado): Promise<void> {
    operadoresDoCaso = []
    const ativo = await operador(true)
    const desativado = await novoDesativado()
    operadoresDoCaso.push(ativo)
    const { sai, fica } = resultado
    for (const operadorId of [ativo, desativado]) {
      // Acesso à operação: 6 meses, como o registro de acesso.
      fica.acesso_operacao.push(await acessoOperacao(operadorId, 'entrada', '6 months -1 day'), await acessoOperacao(operadorId, 'saida', '1 day'))
      sai.acesso_operacao.push(await acessoOperacao(operadorId, 'entrada', '6 months 1 day'), await acessoOperacao(operadorId, 'saida', '6 months 1 hour'))
      // Sessão de operador: 30 dias depois de encerrada ou, sem encerramento, de expirada.
      fica.sessao_operador.push(
        await sessaoOperador(operadorId, '29 days', '29 days'),
        await sessaoOperador(operadorId, null, '29 days'),
        await sessaoOperador(operadorId, '29 days', '45 days'),
      )
      sai.sessao_operador.push(
        await sessaoOperador(operadorId, '31 days', '31 days'),
        await sessaoOperador(operadorId, null, '31 days'),
        await sessaoOperador(operadorId, '30 days 1 hour', '30 days'),
      )
      // Convite de operador usado ou revogado, deste operador: 30 dias depois do que veio primeiro.
      fica.convite_operador.push(await conviteOperador({ usadoHa: '29 days', expiraHa: '27 days' }, operadorId), await conviteOperador({ revogadoHa: '29 days', expiraHa: '28 days' }, operadorId))
      sai.convite_operador.push(await conviteOperador({ usadoHa: '31 days', expiraHa: '29 days' }, operadorId), await conviteOperador({ revogadoHa: '31 days', expiraHa: '29 days' }, operadorId))
      // A auditoria: muito além de todo prazo do expurgo, além dos 6 meses do acesso, e recente.
      resultado.auditorias.push(
        await auditoriaOperacao(operadorId, 'operador.criado', '10 years'),
        await auditoriaOperacao(operadorId, 'convite_operador.gerado', '7 months'),
        await auditoriaOperacao(operadorId, 'convite_operador.revogado', '31 days'),
      )
    }
    // Viva: nunca encerrada, expira daqui a 10 horas (só o ativo tem sessão aberta).
    fica.sessao_operador.push(await sessaoOperador(ativo, null, '-10 hours'))
    // Pendentes, um por operador: vencido há 29 dias, ainda válido, e vencido há 31 dias.
    fica.convite_operador.push(await conviteOperador({ expiraHa: '29 days' }), await conviteOperador({ expiraHa: '-2 days' }))
    sai.convite_operador.push(await conviteOperador({ expiraHa: '31 days' }))
    // A falha de entrada sem operador reconhecido: sai pelo mesmo prazo.
    fica.acesso_operacao.push(await acessoOperacao(null, 'entrada_falha', '6 months -1 day'))
    sai.acesso_operacao.push(await acessoOperacao(null, 'entrada_falha', '6 months 1 day'), await acessoOperacao(null, 'entrada_falha', '7 months'))
    resultado.operadores.push(...operadoresDoCaso)
  }

  /** Duas escolas, cada uma com as linhas dos dois lados de cada prazo, a falha de login sem escola, e a operação. */
  async function semear(): Promise<Semeado> {
    const vazio = () => Object.fromEntries(ALVOS_DO_EXPURGO_DE_ACESSO.map((alvo) => [alvo, [] as string[]])) as Record<AlvoDoExpurgoDeAcesso, string[]>
    const resultado: Semeado = { sai: vazio(), fica: vazio(), operadores: [], auditorias: [] }
    const escolas = [await bancada.escola(), await bancada.escola()]
    for (const escolaId of escolas) {
      const aluno = await usuario(escolaId)
      const { sai, fica } = resultado
      // Registro de acesso: 6 meses do Marco Civil, contados do relógio injetado.
      fica.registro_acesso.push(await registro(escolaId, aluno, 'login', '6 months -1 day'), await registro(escolaId, aluno, 'saida', '1 day'))
      sai.registro_acesso.push(
        await registro(escolaId, aluno, 'login', '6 months 1 day'),
        await registro(escolaId, null, 'login_falho', '7 months'),
        await registro(escolaId, aluno, 'renovacao', '6 months 1 hour'),
      )
      // Sessão: 30 dias depois de encerrada ou, sem encerramento, de expirada.
      fica.sessao.push(
        await sessao(escolaId, aluno, '29 days', '29 days'),
        await sessao(escolaId, aluno, null, '29 days'),
        // Viva: nunca encerrada, expira daqui a 10 horas.
        await sessao(escolaId, aluno, null, '-10 hours'),
        // Encerrada há 29 dias, com a expiração de 12 h lá atrás: vale o encerramento, pelo `coalesce`.
        await sessao(escolaId, aluno, '29 days', '45 days'),
      )
      sai.sessao.push(
        await sessao(escolaId, aluno, '31 days', '31 days'),
        // Só expirada, sem `encerrada_em`.
        await sessao(escolaId, aluno, null, '31 days'),
        await sessao(escolaId, aluno, '30 days 1 hour', '30 days'),
      )
      // Convite: 30 dias depois de usado, revogado ou expirado, o que veio primeiro. O que não foi usado nem revogado
      // tem um usuário só dele: um convite em aberto por usuário na escola (`convite_pendente_unico`, A0b).
      fica.convite.push(
        await convite(escolaId, aluno, { usadoHa: '29 days', expiraHa: '27 days' }),
        await convite(escolaId, aluno, { revogadoHa: '29 days', expiraHa: '28 days' }),
        await convite(escolaId, await usuario(escolaId), { expiraHa: '29 days' }),
        // Ainda válido: expira daqui a 2 dias.
        await convite(escolaId, await usuario(escolaId), { expiraHa: '-2 days' }),
      )
      sai.convite.push(
        await convite(escolaId, aluno, { usadoHa: '31 days', expiraHa: '29 days' }),
        await convite(escolaId, aluno, { revogadoHa: '31 days', expiraHa: '29 days' }),
        await convite(escolaId, await usuario(escolaId), { expiraHa: '31 days' }),
      )
      // O convite de professor (A1): o mesmo prazo, pelo mesmo alvo.
      fica.convite.push(
        await convite(escolaId, aluno, { usadoHa: '29 days', expiraHa: '27 days' }, 'professor'),
        await convite(escolaId, await usuario(escolaId), { expiraHa: '29 days' }, 'professor'),
      )
      sai.convite.push(
        await convite(escolaId, aluno, { revogadoHa: '31 days', expiraHa: '29 days' }, 'professor'),
        await convite(escolaId, await usuario(escolaId), { expiraHa: '31 days' }, 'professor'),
      )
      // Acesso da turma (A1, tarefa 10.0, V5): 30 dias depois de vencer ou ser revogado, o que veio primeiro.
      fica.acesso_turma.push(
        await acessoTurma(escolaId, { revogadoHa: '29 days', expiraHa: '-5 days' }),
        await acessoTurma(escolaId, { expiraHa: '29 days' }),
        // Vigente: nem revogado nem vencido.
        await acessoTurma(escolaId, { expiraHa: '-3 days' }),
      )
      sai.acesso_turma.push(
        await acessoTurma(escolaId, { revogadoHa: '31 days', expiraHa: '-5 days' }),
        await acessoTurma(escolaId, { expiraHa: '31 days' }),
        // Revogado há 10 dias, mas vencido há 31 ("Gerar novo" também revoga o vencido): vale o que veio primeiro.
        await acessoTurma(escolaId, { revogadoHa: '10 days', expiraHa: '31 days' }),
      )
    }
    // A falha por e-mail, antes de haver escola: sem escola onde aplicar retenção própria, sai pelo mesmo prazo.
    resultado.sai.registro_acesso.push(await registro(null, null, 'login_falho', '6 months 1 day'))
    resultado.fica.registro_acesso.push(await registro(null, null, 'login_falho', '6 months -1 day'))
    await semearOperacao(resultado)
    // O incidente de segurança (F3, 9.0): 5 anos do registro, com uma seção em cada uma das duas escolas.
    resultado.fica.incidente.push(await incidente('5 years -1 day', escolas), await incidente('5 years -1 hour', escolas), await incidente('1 day', escolas))
    resultado.sai.incidente.push(await incidente('5 years 1 day', escolas), await incidente('5 years 1 hour', escolas), await incidente('50 years', escolas))
    return resultado
  }

  async function restantes(alvo: AlvoDoExpurgoDeAcesso, ids: readonly string[]): Promise<string[]> {
    const { rows } = await bancada.pool.query<{ id: string }>(`select id from ${alvo} where id = any($1::uuid[]) order by id`, [ids])
    return rows.map(({ id }) => id)
  }

  /** Confere, por tabela, que todo "sai" saiu e todo "fica" ficou. */
  async function conferir(): Promise<void> {
    for (const alvo of ALVOS_DO_EXPURGO_DE_ACESSO) {
      expect(await restantes(alvo, semeado.sai[alvo]), `${alvo}: vencidos`).toEqual([])
      expect(await restantes(alvo, semeado.fica[alvo]), `${alvo}: no prazo`).toEqual([...semeado.fica[alvo]].sort())
    }
    // A seção de cada escola sai com o incidente dela, e fica com o que está no prazo: duas escolas por incidente.
    expect(await secoesDos(semeado.sai.incidente), 'incidente_escola: das vencidas').toBe(0)
    expect(await secoesDos(semeado.fica.incidente), 'incidente_escola: das no prazo').toBe(semeado.fica.incidente.length * 2)
  }

  /** Só o lado da operação do `conferir`. */
  async function conferirOperacao(): Promise<void> {
    for (const alvo of ALVOS_DA_OPERACAO) {
      expect(await restantes(alvo, semeado.sai[alvo]), `${alvo}: vencidos`).toEqual([])
      expect(await restantes(alvo, semeado.fica[alvo]), `${alvo}: no prazo`).toEqual([...semeado.fica[alvo]].sort())
    }
  }

  /** O operador e a auditoria semeados, linha inteira: o expurgo não pode apagar nem mudar nada neles. */
  async function retrato(): Promise<{ operadores: unknown[]; auditorias: unknown[] }> {
    const operadores = await bancada.pool.query('select * from operador where id = any($1::uuid[]) order by id', [semeado.operadores])
    const auditorias = await bancada.pool.query('select * from auditoria_operacao where id = any($1::uuid[]) order by id', [semeado.auditorias])
    return { operadores: operadores.rows, auditorias: auditorias.rows }
  }

  /** Roda como o worker roda um job `sistema.*`: no contexto da rotina do sistema. */
  const expurgar = (lotes: Array<[Passo, number]> = [], lote?: number) => {
    const repositorio = new ExpurgoDeAcessoRepository(bancada.banco)
    const processador = criarExpurgoDeAcesso({
      repositorio: {
        apagarLoteVencido: async (alvo, agora, limite) => {
          const apagadas = await repositorio.apagarLoteVencido(alvo, agora, limite)
          lotes.push([alvo, apagadas])
          return apagadas
        },
        limparLoteDeContasSemUso: async (agora, limite) => {
          const limpas = await repositorio.limparLoteDeContasSemUso(agora, limite)
          lotes.push(['conta', limpas])
          return limpas
        },
      },
      relogio,
      logger: log.logger,
      ...(lote === undefined ? {} : { lote }),
    })
    const jobId = randomUUID()
    return executarNoContexto({ requisicaoId: randomUUID(), rotinaDoSistema: true }, () => processador({}, execucaoDoJob(jobId)))
  }

  beforeEach(async () => {
    bancada = new BancadaDeFila()
    await bancada.limparRegistro()
    log.linhas.length = 0
    semeado = await semear()
  }, 60_000)

  afterEach(async () => {
    await Promise.all(montados.splice(0).map((montado) => montado.encerrar()))
    const todos = (alvo: AlvoDoExpurgoDeAcesso) => [...semeado.sai[alvo], ...semeado.fica[alvo]]
    // As tabelas do expurgo, pelo nome do alvo; a falha de entrada sem operador só sai por aqui.
    for (const alvo of ALVOS_DO_EXPURGO_DE_ACESSO) await bancada.pool.query(`delete from ${alvo} where id = any($1::uuid[])`, [todos(alvo)])
    await limparOperadores(bancada.pool)
    await bancada.limparRegistro()
    await bancada.fechar()
  }, 60_000)

  it('borda: nos limites de cada prazo, contados do relógio injetado, o vencido de todas as escolas (e sem escola) sai, e o que está no prazo fica', async () => {
    await expurgar()
    await conferir()
    // Só as contagens vão ao log, nunca linha: nem id, nem IP.
    const eventos = log.doEvento('acesso.expurgado')
    expect(eventos).toHaveLength(1)
    const [linha] = eventos
    for (const chave of ['registrosDeAcessoTotal', 'sessoesTotal', 'convitesTotal', 'acessosDaTurmaTotal', 'acessosDaOperacaoTotal', 'sessoesDeOperadorTotal', 'convitesDeOperadorTotal', 'incidentesTotal']) {
      expect(linha?.[chave], chave).toEqual(expect.any(Number))
    }
    const texto = log.linhas.join('\n')
    for (const id of [...Object.values(semeado.sai).flat(), ...semeado.operadores]) expect(texto.includes(id)).toBe(false)
    for (const ip of ['203.0.113.7', '198.51.100.9']) expect(texto.includes(ip)).toBe(false)
    expect(texto.includes(PREFIXO_DO_OPERADOR)).toBe(false)
  })

  it('log: cada contagem da linha acesso.expurgado é a da sua tabela, nunca a de outra', async () => {
    // Uma contagem diferente por tabela, menor que o lote: a troca de duas chaves no log fica visível.
    const porAlvo = Object.fromEntries(ALVOS_DO_EXPURGO_DE_ACESSO.map((alvo, posicao) => [alvo, posicao + 11])) as Record<AlvoDoExpurgoDeAcesso, number>
    const processador = criarExpurgoDeAcesso({
      repositorio: { apagarLoteVencido: async (alvo) => porAlvo[alvo], limparLoteDeContasSemUso: async () => 7 },
      relogio,
      logger: log.logger,
    })
    const jobId = randomUUID()
    await executarNoContexto({ requisicaoId: randomUUID(), rotinaDoSistema: true }, () => processador({}, execucaoDoJob(jobId)))
    expect(log.doEvento('acesso.expurgado')[0]).toMatchObject({
      registrosDeAcessoTotal: porAlvo.registro_acesso,
      sessoesTotal: porAlvo.sessao,
      convitesTotal: porAlvo.convite,
      acessosDaTurmaTotal: porAlvo.acesso_turma,
      acessosDaOperacaoTotal: porAlvo.acesso_operacao,
      sessoesDeOperadorTotal: porAlvo.sessao_operador,
      convitesDeOperadorTotal: porAlvo.convite_operador,
      incidentesTotal: porAlvo.incidente,
      contasLimpasTotal: 7,
    })
  })

  it('alvo sem total (A0b, tarefa 9.0): o objeto dos totais do processador é conferido alvo a alvo pelo compilador', () => {
    // @ts-expect-error falta o total de `incidente` (F3, 9.0): sem a afirmação `as Record`, o compilador recusa o objeto.
    const semUmAlvo: TotaisDoExpurgoDeAcesso = { registro_acesso: 0, sessao: 0, convite: 0, acesso_turma: 0, acesso_operacao: 0, sessao_operador: 0, convite_operador: 0 }
    expect(Object.keys(semUmAlvo)).toHaveLength(ALVOS_DO_EXPURGO_DE_ACESSO.length - 1)
  })

  it('lote ordenado (A0b, tarefa 9.0): com o lote menor que o total, o de `convite_operador` leva primeiro o mais antigo, mesmo semeado fora da ordem do prazo', async () => {
    // Muito além de qualquer linha semeada ou deixada por outro caso, e inseridos fora da ordem do prazo: o mais antigo
    // por último, depois dos vencidos do `semear`, que vêm antes na tabela.
    const duzentos = await conviteOperador({ expiraHa: '200 years' })
    const cem = await conviteOperador({ expiraHa: '100 years' })
    const trezentos = await conviteOperador({ revogadoHa: '300 years', expiraHa: '299 years' })
    semeado.sai.convite_operador.push(duzentos, cem, trezentos)
    const repositorio = new ExpurgoDeAcessoRepository(bancada.banco)
    const existem = async () => (await bancada.pool.query<{ id: string }>('select id from convite_operador where id = any($1::uuid[])', [[duzentos, cem, trezentos]])).rows.map(({ id }) => id).sort()

    expect(await repositorio.apagarLoteVencido('convite_operador', AGORA, 1)).toBe(1)
    expect(await existem()).toEqual([duzentos, cem].sort())
    expect(await repositorio.apagarLoteVencido('convite_operador', AGORA, 1)).toBe(1)
    expect(await existem()).toEqual([cem])
    expect(await repositorio.apagarLoteVencido('convite_operador', AGORA, 1)).toBe(1)
    expect(await existem()).toEqual([])
  })

  it('lote ordenado (F3, tarefa 9.0): com o lote menor que o total, o de `incidente` leva primeiro o mais antigo, mesmo semeado fora da ordem do prazo, e a seção sai com ele', async () => {
    const escolas = [await bancada.escola()]
    // Muito além de qualquer linha semeada ou deixada por outro caso, e inseridos fora da ordem do prazo: o mais antigo por último.
    const duzentos = await incidente('200 years', escolas)
    const cem = await incidente('100 years', escolas)
    const trezentos = await incidente('300 years', escolas)
    semeado.sai.incidente.push(duzentos, cem, trezentos)
    const repositorio = new ExpurgoDeAcessoRepository(bancada.banco)
    const existem = async () => (await restantes('incidente', [duzentos, cem, trezentos])).sort()

    expect(await repositorio.apagarLoteVencido('incidente', AGORA, 1)).toBe(1)
    expect(await existem()).toEqual([duzentos, cem].sort())
    expect(await secoesDos([trezentos])).toBe(0)
    expect(await secoesDos([duzentos, cem])).toBe(2)
    expect(await repositorio.apagarLoteVencido('incidente', AGORA, 1)).toBe(1)
    expect(await existem()).toEqual([cem])
    expect(await repositorio.apagarLoteVencido('incidente', AGORA, 1)).toBe(1)
    expect(await existem()).toEqual([])
    expect(await secoesDos([duzentos, cem, trezentos])).toBe(0)
  })

  it('skip locked (F3, tarefa 9.0): o incidente vencido que outra transação segura não faz o lote esperar, e o lote leva o seguinte', async () => {
    const escolas = [await bancada.escola()]
    const maisAntigo = await incidente('400 years', escolas)
    const seguinte = await incidente('399 years', escolas)
    semeado.sai.incidente.push(maisAntigo, seguinte)
    const segurador = await bancada.pool.connect()
    try {
      await segurador.query('begin')
      await segurador.query('select id from incidente where id = $1 for update', [maisAntigo])
      // Com o lote de 1, o mais antigo seria o escolhido: preso, ele é pulado, e o lote apaga o seguinte sem esperar o segurador.
      expect(await new ExpurgoDeAcessoRepository(bancada.banco).apagarLoteVencido('incidente', AGORA, 1)).toBe(1)
      expect(await restantes('incidente', [maisAntigo, seguinte])).toEqual([maisAntigo])
    } finally {
      await segurador.query('rollback')
      segurador.release()
    }
    expect(await new ExpurgoDeAcessoRepository(bancada.banco).apagarLoteVencido('incidente', AGORA, 1)).toBe(1)
    expect(await restantes('incidente', [maisAntigo, seguinte])).toEqual([])
  })

  it('concorrência (F3, tarefa 9.0): dois expurgos em paralelo apagam cada incidente vencido uma vez só, e a soma das duas contagens é o que havia vencido', async () => {
    const vencidos = async () =>
      (await bancada.pool.query<{ n: number }>(`select count(*)::int as n from incidente where registrado_em < $1::timestamptz - interval '5 years'`, [AGORA.toISOString()])).rows[0]?.n ?? -1
    const antes = await vencidos()
    expect(antes).toBeGreaterThanOrEqual(semeado.sai.incidente.length)
    const repositorio = new ExpurgoDeAcessoRepository(bancada.banco)
    // Lote de 1: as duas execuções disputam linha a linha.
    const execucao = async () => {
      let total = 0
      for (;;) {
        const doLote = await repositorio.apagarLoteVencido('incidente', AGORA, 1)
        total += doLote
        if (doLote < 1) return total
      }
    }
    const [uma, outra] = await Promise.all([execucao(), execucao()])
    expect(uma + outra).toBe(antes)
    expect(await vencidos()).toBe(0)
    expect(await restantes('incidente', semeado.sai.incidente)).toEqual([])
    expect(await restantes('incidente', semeado.fica.incidente)).toEqual([...semeado.fica.incidente].sort())
    expect(await secoesDos(semeado.sai.incidente)).toBe(0)
    expect(await secoesDos(semeado.fica.incidente)).toBe(semeado.fica.incidente.length * 2)
  })

  it('lote ordenado (A1, tarefa 10.0): com o lote menor que o total, o de `convite` e o de `acesso_turma` levam primeiro o mais antigo, mesmo semeado fora da ordem do prazo', async () => {
    const escolaId = await bancada.escola()
    const repositorio = new ExpurgoDeAcessoRepository(bancada.banco)
    // Muito além de qualquer linha semeada ou deixada por outro caso, e inseridos fora da ordem do prazo: o mais antigo
    // por último, depois dos vencidos do `semear`, que vêm antes na tabela.
    const semeados: Record<'convite' | 'acesso_turma', (ha: { revogadoHa?: string; expiraHa: string }) => Promise<string>> = {
      convite: async (datas) => convite(escolaId, await usuario(escolaId), datas, 'professor'),
      acesso_turma: (datas) => acessoTurma(escolaId, datas),
    }
    for (const alvo of ['convite', 'acesso_turma'] as const) {
      const duzentos = await semeados[alvo]({ expiraHa: '200 years' })
      const cem = await semeados[alvo]({ expiraHa: '100 years' })
      const trezentos = await semeados[alvo]({ revogadoHa: '300 years', expiraHa: '299 years' })
      semeado.sai[alvo].push(duzentos, cem, trezentos)
      const existem = async () => (await restantes(alvo, [duzentos, cem, trezentos])).sort()

      expect(await repositorio.apagarLoteVencido(alvo, AGORA, 1), alvo).toBe(1)
      expect(await existem(), alvo).toEqual([duzentos, cem].sort())
      expect(await repositorio.apagarLoteVencido(alvo, AGORA, 1), alvo).toBe(1)
      expect(await existem(), alvo).toEqual([cem])
      expect(await repositorio.apagarLoteVencido(alvo, AGORA, 1), alvo).toBe(1)
      expect(await existem(), alvo).toEqual([])
    }
  })

  it('V5 (A1, tarefa 10.0): dois expurgos em paralelo apagam cada acesso da turma vencido uma vez só, e a soma das duas contagens é o que havia vencido', async () => {
    const vencidos = async () =>
      (
        await bancada.pool.query<{ n: number }>(`select count(*)::int as n from acesso_turma where least(revogado_em, expira_em) < $1::timestamptz - interval '30 days'`, [AGORA.toISOString()])
      ).rows[0]?.n ?? -1
    const antes = await vencidos()
    expect(antes).toBeGreaterThanOrEqual(semeado.sai.acesso_turma.length)
    const repositorio = new ExpurgoDeAcessoRepository(bancada.banco)
    // Lote de 1: as duas execuções disputam linha a linha.
    const execucao = async () => {
      let total = 0
      for (;;) {
        const doLote = await repositorio.apagarLoteVencido('acesso_turma', AGORA, 1)
        total += doLote
        if (doLote < 1) return total
      }
    }
    const [uma, outra] = await Promise.all([execucao(), execucao()])
    expect(uma + outra).toBe(antes)
    expect(await vencidos()).toBe(0)
    expect(await restantes('acesso_turma', semeado.sai.acesso_turma)).toEqual([])
    expect(await restantes('acesso_turma', semeado.fica.acesso_turma)).toEqual([...semeado.fica.acesso_turma].sort())
  })

  it('idempotência (D49): rodar de novo depois do fim não apaga nada além do prazo', async () => {
    await expurgar()
    const segunda: Array<[Passo, number]> = []
    await expurgar(segunda)
    expect(segunda).toEqual([
      ['registro_acesso', 0],
      ['sessao', 0],
      ['convite', 0],
      ['acesso_turma', 0],
      ['acesso_operacao', 0],
      ['sessao_operador', 0],
      ['convite_operador', 0],
      ['incidente', 0],
      ['conta', 0],
    ])
    await conferir()
  })

  it('concorrência: duas execuções ao mesmo tempo (a reentrega de D49) terminam sem erro e com o mesmo resultado de uma', async () => {
    const primeira: Array<[Passo, number]> = []
    const segunda: Array<[Passo, number]> = []
    await Promise.all([expurgar(primeira), expurgar(segunda)])
    await conferir()
    // Juntas, as duas apagaram pelo menos os vencidos semeados (o banco de teste pode ter outros), e nenhuma falhou.
    for (const alvo of ['registro_acesso', 'sessao', 'convite', 'acesso_turma', 'incidente'] as const) {
      const soma = [...primeira, ...segunda].filter(([deQual]) => deQual === alvo).reduce((total, [, apagadas]) => total + apagadas, 0)
      expect(soma, alvo).toBeGreaterThanOrEqual(semeado.sai[alvo].length)
    }
  })

  it('concorrência (C38): dois expurgos em paralelo apagam cada linha vencida da operação uma vez só, e a soma das duas contagens é o que havia vencido', async () => {
    /** Quantas linhas da tabela estão vencidas no `AGORA`, pelo prazo da `docs/lgpd.md`, escrito aqui à parte da instrução. */
    const PRAZO: Record<(typeof ALVOS_DA_OPERACAO)[number], string> = {
      acesso_operacao: "em < $1::timestamptz - interval '6 months'",
      sessao_operador: "coalesce(encerrada_em, expira_em) < $1::timestamptz - interval '30 days'",
      convite_operador: "least(usado_em, revogado_em, expira_em) < $1::timestamptz - interval '30 days'",
    }
    const vencidas = async (alvo: (typeof ALVOS_DA_OPERACAO)[number]) =>
      (await bancada.pool.query<{ n: number }>(`select count(*)::int as n from ${alvo} where ${PRAZO[alvo]}`, [AGORA.toISOString()])).rows[0]?.n ?? -1
    const antes = Object.fromEntries(await Promise.all(ALVOS_DA_OPERACAO.map(async (alvo) => [alvo, await vencidas(alvo)] as const)))
    for (const alvo of ALVOS_DA_OPERACAO) expect(antes[alvo], alvo).toBeGreaterThanOrEqual(semeado.sai[alvo].length)

    const repositorio = new ExpurgoDeAcessoRepository(bancada.banco)
    for (const alvo of ALVOS_DA_OPERACAO) {
      // Lote de 1: as duas execuções disputam linha a linha. Prova que cada linha sai uma vez só e que a soma bate; que
      // uma não espera a outra (o `skip locked`) não é o que este teste mede.
      const execucao = async () => {
        let total = 0
        for (;;) {
          const doLote = await repositorio.apagarLoteVencido(alvo, AGORA, 1)
          total += doLote
          if (doLote < 1) return total
        }
      }
      const [uma, outra] = await Promise.all([execucao(), execucao()])
      expect(uma + outra, alvo).toBe(antes[alvo])
      expect(await vencidas(alvo), alvo).toBe(0)
    }
    await conferirOperacao()
  })

  it('o que nunca sai (C38): a auditoria da operação, de qualquer idade, e o operador, ativo ou desativado, mesmo sem mais nada que aponte para ele', async () => {
    const antes = await retrato()
    await expurgar()
    await expurgar()
    await conferir()
    expect(await retrato()).toEqual(antes)
    expect(antes.auditorias).toHaveLength(semeado.auditorias.length)
    expect(antes.operadores).toHaveLength(semeado.operadores.length)
    // Os desativados que só tinham o convite pendente vencido ficaram sem sessão, convite nem acesso: e continuam.
    const { rows } = await bancada.pool.query<{ n: number }>(
      `select count(*)::int as n from operador o where o.id = any($1::uuid[]) and o.desativado_em is not null
         and not exists (select 1 from convite_operador c where c.operador_id = o.id)
         and not exists (select 1 from sessao_operador s where s.operador_id = o.id)`,
      [semeado.operadores],
    )
    expect(rows[0]?.n).toBeGreaterThanOrEqual(1)
  })

  it('lotes: cada instrução apaga no máximo um lote, e a rotina segue tabela por tabela até sobrar lote incompleto', async () => {
    const repositorio = new ExpurgoDeAcessoRepository(bancada.banco)
    expect(await repositorio.apagarLoteVencido('sessao', AGORA, 2)).toBe(2)
    expect(await restantes('sessao', semeado.sai.sessao)).toHaveLength(semeado.sai.sessao.length - 2)
    const lotes: Array<[Passo, number]> = []
    await expurgar(lotes, 2)
    // Toda instrução cheia é seguida de outra, e a última de cada tabela vem incompleta.
    for (const alvo of [...ALVOS_DO_EXPURGO_DE_ACESSO, 'conta'] as const) {
      const daTabela = lotes.filter(([deQual]) => deQual === alvo).map(([, apagadas]) => apagadas)
      expect(daTabela.slice(0, -1).every((apagadas) => apagadas === 2), alvo).toBe(true)
      expect(daTabela.at(-1), alvo).toBeLessThan(2)
    }
    expect(lotes.map(([alvo]) => alvo).filter((alvo, posicao, todos) => todos.indexOf(alvo) === posicao)).toEqual([
      'registro_acesso',
      'sessao',
      'convite',
      'acesso_turma',
      'acesso_operacao',
      'sessao_operador',
      'convite_operador',
      'incidente',
      'conta',
    ])
    await conferir()
  })

  it('borda: a conta que um convite segurava na desativação é limpa quando o convite vence ou é revogado; a com convite válido ou usuário ativo em outra escola fica', async () => {
    const [escolaA, escolaB] = [await bancada.escola(), await bancada.escola()]
    /** Uma conta da equipe com senha, segundo fator, um código de recuperação, o professor desativado em A e a sessão dele ainda aberta. */
    const conta = async () => {
      const contaId = await inserir(
        "insert into conta (email, senha_hash, mfa_segredo_cifrado, mfa_chave_versao, mfa_ativado_em) values ($1, 'hash-sintetico', '\\x00'::bytea, 1, now()) returning id",
        [`equipe-${randomUUID()}@escola.invalid`],
      )
      await bancada.pool.query('insert into codigo_recuperacao (conta_id, hmac) values ($1, $2)', [contaId, randomBytes(32).toString('base64url').slice(0, 43)])
      const professorEmA = await inserir("insert into usuario (escola_id, conta_id, papel, nome, desativado_em) values ($1, $2, 'professor', 'Pessoa sintética', now()) returning id", [escolaA, contaId])
      const sessaoId = await inserir(
        "insert into sessao (escola_id, conta_id, usuario_id, metodo, familia, refresh_hash, expira_em) values ($1, $2, $3, 'email', uuidv7(), $4, now() + interval '12 hours') returning id",
        [escolaA, contaId, professorEmA, randomBytes(32).toString('hex')],
      )
      return { contaId, sessaoId }
    }
    /** O coordenador convidado em B, inativo, com o convite: `expiraHa` é o intervalo antes do `AGORA` (negativo é futuro). */
    const convidada = async (contaId: string, expiraHa: string, revogado = false) => {
      const coordenadorEmB = await inserir("insert into usuario (escola_id, conta_id, papel, nome, desativado_em) values ($1, $2, 'coordenador', 'Pessoa sintética', now()) returning id", [escolaB, contaId])
      await convite(escolaB, coordenadorEmB, revogado ? { revogadoHa: '1 hour', expiraHa } : { expiraHa })
    }
    // Vence uma hora antes do relógio injetado, e depois do `now()` do banco: só sai com o corte do relógio.
    const vencida = await conta()
    await convidada(vencida.contaId, '1 hour')
    const revogada = await conta()
    await convidada(revogada.contaId, '-2 days', true)
    const semNada = await conta()
    const aindaValida = await conta()
    await convidada(aindaValida.contaId, '-2 days')
    const ativaEmB = await conta()
    await inserir("insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, 'professor', 'Pessoa sintética') returning id", [escolaB, ativaEmB.contaId])

    await expurgar()

    const situacao = async ({ contaId, sessaoId }: { contaId: string; sessaoId: string }) => {
      const { rows } = await bancada.pool.query<Record<string, unknown>>(
        `select c.email is not null as email, c.senha_hash is not null as senha, c.mfa_segredo_cifrado is not null as segredo, c.mfa_ativado_em is not null as mfa,
                (select count(*)::int from codigo_recuperacao r where r.conta_id = c.id) as codigos,
                (select s.motivo from sessao s where s.id = $2) as motivo
         from conta c where c.id = $1`,
        [contaId, sessaoId],
      )
      return rows[0]
    }
    const limpa = { email: false, senha: false, segredo: false, mfa: false, codigos: 0, motivo: 'conta_limpa' }
    const intacta = { email: true, senha: true, segredo: true, mfa: true, codigos: 1, motivo: null }
    for (const [nome, quem] of Object.entries({ vencida, revogada, semNada })) expect(await situacao(quem), nome).toEqual(limpa)
    for (const [nome, quem] of Object.entries({ aindaValida, ativaEmB })) expect(await situacao(quem), nome).toEqual(intacta)
    expect(log.doEvento('acesso.expurgado')[0]?.['contasLimpasTotal']).toEqual(expect.any(Number))
  })

  it('concorrência: o convite que faz commit entre a trava do lote e a limpeza segura a conta; a outra conta travada no mesmo lote é limpa', async () => {
    const escolaId = await bancada.escola()
    /** Conta com e-mail e senha e um coordenador inativo em B, com um convite que já venceu: candidata à limpeza. */
    const candidata = async () => {
      const contaId = await inserir("insert into conta (email, senha_hash) values ($1, 'hash-sintetico') returning id", [`equipe-${randomUUID()}@escola.invalid`])
      const usuarioId = await inserir("insert into usuario (escola_id, conta_id, papel, nome, desativado_em) values ($1, $2, 'coordenador', 'Pessoa sintética', now()) returning id", [escolaId, contaId])
      await convite(escolaId, usuarioId, { expiraHa: '1 day' })
      return { contaId, usuarioId }
    }
    const reconvidada = await candidata()
    const esquecida = await candidata()
    const emailDe = async (contaId: string) => (await bancada.pool.query<{ email: boolean }>('select email is not null as email from conta where id = $1', [contaId])).rows[0]?.email

    // A janela entre a trava e a reconferência: o reconvite (novo convite para o mesmo usuário inativo, que não muda a
    // conta) faz commit noutra conexão com as duas contas já travadas pelo lote. Como o refazer do painel, ele revoga o
    // vencido antes: um convite em aberto por usuário (`convite_pendente_unico`, A0b).
    const limpas = await new ExpurgoDeAcessoRepository(bancada.banco).limparLoteDeContasSemUso(AGORA, LOTE_DO_EXPURGO, async () => {
      await bancada.pool.query('update convite set revogado_em = now() where escola_id = $1 and usuario_id = $2 and revogado_em is null', [escolaId, reconvidada.usuarioId])
      await convite(escolaId, reconvidada.usuarioId, { expiraHa: '-3 days' })
    })

    expect(await emailDe(reconvidada.contaId)).toBe(true)
    expect(await emailDe(esquecida.contaId)).toBe(false)
    expect(limpas).toBeGreaterThanOrEqual(1)
  })

  it('permissão: só a rotina do sistema expurga; um job de escola com esse tipo falha sem apagar nada', async () => {
    const escolaId = await bancada.escola()
    const processador = criarExpurgoDeAcesso({ repositorio: new ExpurgoDeAcessoRepository(bancada.banco), relogio, logger: log.logger })
    const jobId = randomUUID()
    await expect(executarNoContexto({ requisicaoId: randomUUID(), escolaId }, () => processador({}, execucaoDoJob(jobId)))).rejects.toMatchObject({
      name: 'FalhaDeJob',
      codigo: JobFailureCode.DADOS_INVALIDOS,
      definitiva: true,
    })
    for (const alvo of ALVOS_DO_EXPURGO_DE_ACESSO) expect(await restantes(alvo, semeado.sai[alvo]), alvo).toHaveLength(semeado.sai[alvo].length)
  })

  it('o lote do registro de acesso e o da sessão, da escola e da operação, descem pelos índices de prazo, sem varrer a tabela', async () => {
    const cliente = await bancada.pool.connect()
    try {
      await cliente.query('begin')
      await cliente.query('analyze registro_acesso')
      await cliente.query('analyze sessao')
      await cliente.query('analyze acesso_operacao')
      await cliente.query('analyze sessao_operador')
      // Com a varredura sequencial proibida, o plano só usa o índice se a expressão dele casar com a da instrução.
      await cliente.query('set local enable_seqscan = off')
      for (const [alvo, indice] of [
        ['registro_acesso', 'registro_acesso_em_idx'],
        ['sessao', 'sessao_fim_idx'],
        ['acesso_operacao', 'acesso_operacao_em_idx'],
        ['sessao_operador', 'sessao_operador_fim_idx'],
      ] as const) {
        const { sql: texto, params } = new PgDialect({ casing: 'snake_case' }).sqlToQuery(instrucaoDoLoteDeAcesso(alvo, AGORA, LOTE_DO_EXPURGO))
        const { rows } = await cliente.query<{ 'QUERY PLAN': Array<{ Plan: NoDoPlano }> }>(`explain (format json) ${texto}`, params)
        const nos = nosDoPlano(rows[0]?.['QUERY PLAN'][0]?.Plan)
        expect(nos.map((no) => no['Index Name']).filter(Boolean), alvo).toContain(indice)
        expect(nos.map((no) => no['Node Type']), alvo).not.toContain('Seq Scan')
      }
    } finally {
      await cliente.query('rollback')
      cliente.release()
    }
  })

  it('trilha completa: o agendamento das 4h30 grava o job, o despachante o solta fora do horário letivo, e o worker de lote expurga', async () => {
    expect(AGENDAMENTOS).toContainEqual({ tipo: TIPO_EXPURGAR_ACESSO, padrao: '30 4 * * *' })
    const worker = montarWorker(
      { banco: configuracaoDoBanco(), redisFilaUrl: urlRedisDeFila(), pools: { lote: 2 }, vagasPadrao: vagasPadraoDoAmbiente(), threadsMaximo: 1, storage: STORAGE, janelaPadrao: janelaPadraoDoAmbiente() },
      log.logger,
      { prefixo: bancada.prefixo, relogio, agendamentos: AGENDAMENTOS },
    )
    montados.push(worker)
    bancada.despachante(log, { relogio }).iniciar()
    const fila = new Queue(FILA_DOS_AGENDAMENTOS, { connection: bancada.redis, prefix: bancada.prefixo })
    try {
      await fila.add(TIPO_EXPURGAR_ACESSO, {})
      await expect
        .poll(async () => (await bancada.pool.query<{ estado: string }>('select estado from job_registro where tipo = $1', [TIPO_EXPURGAR_ACESSO])).rows.map(({ estado }) => estado), {
          timeout: 20_000,
          interval: 100,
        })
        .toEqual(['concluido'])
      await conferir()
    } finally {
      await fila.obliterate({ force: true })
      await fila.close()
    }
  })
})
