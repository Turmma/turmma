import type { APIRequestContext, Page } from '@playwright/test'
import { Client } from 'pg'
import { CABECALHOS_DA_PLANILHA } from '../../packages/shared/src/importacao/modelos.ts'
import type { TipoDePlanilha } from '../../packages/shared/src/importacao/contratos.ts'
import { urlDoBancoDeTeste } from '../../tools/ci/compose.ts'
import { loadUnthrottled, expect } from './profiles.ts'
import { configurarSegundoFatorPelaApi } from './mfa.ts'
import { codigoDoAutenticador, type EquipeDeTeste } from './seed.ts'

/**
 * Os ajudantes do e2e da escola que entra por planilha (F2, 16.0; RF18): o texto de cada planilha no formato do modelo, a entrada pela
 * API **com o token à mão** (para o seed gravar planilha como a coordenação grava, pela rota de verdade, e não pelo banco) e a espera do
 * job. O seed de cada caso usa a rota real: quando o caso prova a tela de uma etapa, as etapas de antes já entraram pelo mesmo caminho que a
 * tela usa. Tudo sintético, com o domínio reservado `.invalid`.
 */

/** O cabeçalho de um modelo, com o separador `;` que o modelo baixado traz. */
export const cabecalhoDe = (tipo: TipoDePlanilha): string => CABECALHOS_DA_PLANILHA[tipo].join(';')

/** Uma planilha no modelo: o cabeçalho e as linhas, terminada por quebra de linha. */
export const planilhaDe = (tipo: TipoDePlanilha, ...linhas: string[]): string => [cabecalhoDe(tipo), ...linhas].join('\r\n') + '\r\n'

/** Uma aula da grade, na ordem das colunas do modelo. */
export function linhaDaGrade(aula: { readonly turma: string; readonly disciplina: string; readonly professor: string; readonly email: string; readonly dia: string; readonly inicio: string; readonly fim: string; readonly sala?: string }): string {
  return [aula.turma, aula.disciplina, aula.professor, aula.email, aula.dia, aula.inicio, aula.fim, aula.sala ?? ''].join(';')
}

/** O e-mail inventado de um professor da planilha: único por chamada, no domínio que não recebe mensagem. */
export const emailDoProfessor = (primeiroNome: string, marca: string): string => `${primeiroNome.toLowerCase()}-${marca}@educa.invalid`

/** O token e o desafio de uma entrada pela API: o que o seed precisa para escrever como a pessoa escreve. */
export interface SessaoPelaApi {
  readonly token: string
  readonly segredo: string | undefined
}

/**
 * A coordenação passa pelo segundo fator pela API, configurado agora, e devolve o token de acesso e o segredo. `pedidos` é o contexto de
 * requisição em que o cookie de renovação fica: o da página (a tela restaura a sessão a partir dele) ou o do próprio seed.
 */
async function sessaoDaCoordenacao(request: APIRequestContext, pedidos: APIRequestContext, coordenadora: EquipeDeTeste): Promise<SessaoPelaApi> {
  const { segredo } = await configurarSegundoFatorPelaApi(request, coordenadora)
  const entrada = await pedidos.post('/v1/sessao/email', { data: { email: coordenadora.email, senha: coordenadora.senha } })
  const { etapa, desafio } = (await entrada.json()) as { etapa?: string; desafio?: string }
  if (etapa !== 'mfa' || desafio === undefined) throw new Error(`a entrada pela API não pediu o segundo fator: ${String(entrada.status())} ${String(etapa)}`)
  // A ativação gastou o passo de agora: o código que o servidor aceita é o do passo seguinte.
  const segundo = await pedidos.post('/v1/sessao/mfa', { headers: { Authorization: `Bearer ${desafio}` }, data: { codigo: codigoDoAutenticador(segredo, 30) } })
  const corpo = (await segundo.json()) as { etapa?: string; token?: string }
  if (corpo.etapa !== 'pronta' || corpo.token === undefined) throw new Error(`o segundo fator pela API não abriu a sessão: ${String(segundo.status())} ${String(corpo.etapa)}`)
  return { token: corpo.token, segredo }
}

/** O token da coordenação, só para o seed: a sessão fica no contexto de requisição do teste, sem página. */
export function tokenDaCoordenacao(request: APIRequestContext, coordenadora: EquipeDeTeste): Promise<SessaoPelaApi> {
  return sessaoDaCoordenacao(request, request, coordenadora)
}

/**
 * A coordenação entra pela API no contexto da página (o cookie de renovação fica nele, e a aplicação restaura a sessão a partir dele) **e
 * devolve o token de acesso**: é com ele que o seed grava planilha. Abre o endereço sem a rede do perfil na primeira carga (a receita de
 * `abrirPelaApiSemMedirAPrimeiraCarga`, `mfa.ts`), e `aguardar` espera a tela.
 */
export async function entrarComoCoordenacaoComToken(page: Page, request: APIRequestContext, coordenadora: EquipeDeTeste, endereco: string, aguardar?: () => Promise<void>): Promise<SessaoPelaApi> {
  const sessao = await sessaoDaCoordenacao(request, page.context().request, coordenadora)
  await loadUnthrottled(page, async () => {
    await page.goto(endereco)
    await aguardar?.()
  })
  return sessao
}

/** A pessoa sem segundo fator (professor, aluno) entra pela API no contexto da página e devolve o token; a página só abre o endereço depois, se `endereco` vier. */
export async function entrarComTokenPelaApi(page: Page, pessoa: Pick<EquipeDeTeste, 'email' | 'senha'>, endereco?: string, aguardar?: () => Promise<void>): Promise<string> {
  const pedidos = page.context().request
  const entrada = await pedidos.post('/v1/sessao/email', { data: { email: pessoa.email, senha: pessoa.senha } })
  const corpo = (await entrada.json()) as { etapa?: string; token?: string }
  if (corpo.etapa !== 'pronta' || corpo.token === undefined) throw new Error(`a entrada pela API não abriu sessão: ${String(entrada.status())} ${String(corpo.etapa)}`)
  if (endereco !== undefined) {
    await loadUnthrottled(page, async () => {
      await page.goto(endereco)
      await aguardar?.()
    })
  }
  return corpo.token
}

const porToken = (token: string) => ({ Authorization: `Bearer ${token}` })

/** O prazo da espera do job: o job de uma planilha do e2e leva segundos, e 20 s é só o teto da espera. */
const PRAZO_DO_JOB_MS = 20_000

/**
 * Grava a planilha pela rota de verdade (`POST /v1/importacoes/:tipo`, 202) e espera o job terminar, como a tela faz: lê o estado até
 * sair de `na_fila`. Devolve o resumo (só contagens). Falha se a importação não termina `concluida`, para o seed nunca seguir com o
 * mundo pela metade.
 */
export async function gravarPelaApi(request: APIRequestContext, token: string, tipo: TipoDePlanilha, texto: string, marcas?: { readonly transferir?: string[]; readonly desligar?: string[]; readonly encerrar?: string[] }): Promise<Record<string, number>> {
  const resposta = await request.post(`/v1/importacoes/${tipo}`, { headers: porToken(token), data: { texto, ...(marcas === undefined ? {} : { marcas }) } })
  expect(resposta.status(), `o gravar de ${tipo} pela API`).toBe(202)
  const { id } = (await resposta.json()) as { id: string }
  const limite = Date.now() + PRAZO_DO_JOB_MS
  while (Date.now() < limite) {
    const lida = await request.get(`/v1/importacoes/${id}`, { headers: porToken(token) })
    const { estado, resumo } = (await lida.json()) as { estado: string; resumo: Record<string, number> | null }
    if (estado === 'concluida') return resumo ?? {}
    if (estado !== 'na_fila') throw new Error(`a importação de ${tipo} terminou ${estado}`)
    await new Promise((resolver) => setTimeout(resolver, 150))
  }
  throw new Error(`a importação de ${tipo} não terminou em ${String(PRAZO_DO_JOB_MS)} ms`)
}

/** O link de convite de um professor que a planilha cadastrou, pelo `convite/refazer` (o mesmo que o "Copiar link" da tela chama). */
export async function linkDoConviteDoProfessor(request: APIRequestContext, token: string, usuarioId: string): Promise<string> {
  const resposta = await request.post(`/v1/professores/${usuarioId}/convite/refazer`, { headers: porToken(token), data: {} })
  expect(resposta.ok(), 'o refazer do convite pela API').toBe(true)
  const { token: tokenDoConvite } = (await resposta.json()) as { token: string }
  return `/convite#${tokenDoConvite}`
}

async function comBanco<T>(tarefa: (banco: Client) => Promise<T>): Promise<T> {
  const banco = new Client({ connectionString: urlDoBancoDeTeste() })
  await banco.connect()
  try {
    return await tarefa(banco)
  } finally {
    await banco.end()
  }
}

/** O usuário (professor) que a planilha cadastrou na escola, achado pelo e-mail da conta. */
export async function usuarioDoProfessorPorEmail(escolaId: string, email: string): Promise<string> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ id: string }>('select u.id from usuario u join conta c on c.id = u.conta_id where u.escola_id = $1 and c.email = $2', [escolaId, email])
    const id = rows[0]?.id
    if (id === undefined) throw new Error('o professor da planilha não está na escola')
    return id
  })
}

/** Os vínculos de professor da escola, por estado: o que a grade deixou e o que o professor confirmou. */
export async function vinculosDeProfessorPorEstado(escolaId: string): Promise<Record<string, number>> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ estado: string; n: string }>("select estado, count(*) as n from vinculo where escola_id = $1 and papel = 'professor' group by estado", [escolaId])
    return Object.fromEntries(rows.map((linha) => [linha.estado, Number(linha.n)]))
  })
}

/** Os alunos da escola por estado da lista: `livre`, `reivindicado` e `aprovado`. */
export async function listaDaEscolaPorEstado(escolaId: string): Promise<Record<string, number>> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ estado: string; n: string }>('select estado, count(*) as n from lista_nome where escola_id = $1 group by estado', [escolaId])
    return Object.fromEntries(rows.map((linha) => [linha.estado, Number(linha.n)]))
  })
}

/** O id da turma pelo nome, na escola (a planilha de alunos a cria pela chave do nome). */
export async function turmaPorNome(escolaId: string, nome: string): Promise<string> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ id: string }>('select id from turma where escola_id = $1 and nome = $2', [escolaId, nome])
    const id = rows[0]?.id
    if (id === undefined) throw new Error(`a turma ${nome} não está na escola`)
    return id
  })
}

/** Quantas aulas a grade gravada deixou na turma. */
export async function aulasDaTurmaNoBanco(escolaId: string, turmaId: string): Promise<number> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ n: string }>('select count(*) as n from alocacao a join vinculo v on v.id = a.vinculo_id where v.escola_id = $1 and v.turma_id = $2', [escolaId, turmaId])
    return Number(rows[0]?.n ?? 0)
  })
}

/** Os vínculos (professor) da turma, em qualquer estado: o que a grade deixou para o professor confirmar. */
export async function vinculosDaTurmaNoBanco(escolaId: string, turmaId: string): Promise<string[]> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ id: string }>("select id from vinculo where escola_id = $1 and turma_id = $2 and papel = 'professor'", [escolaId, turmaId])
    return rows.map((linha) => linha.id)
  })
}
