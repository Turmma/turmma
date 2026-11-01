import {
  analistaNominalResponseSchema,
  consumoResponseSchema,
  execucaoAceitaResponseSchema,
  funcaoDaGovernancaResponseSchema,
  funcoesDaGovernancaResponseSchema,
  resumoDaGovernancaResponseSchema,
  resumoDoAnalistaResponseSchema,
  type ChaveDeFuncao,
  type EstadoDeEntrega,
  type FinalidadeDaLeituraNominal,
  type FuncaoDaGovernanca,
  type MotivoDeSuspensao,
  type AnalistaNominalResponse,
  type ExecucaoAceitaResponse,
  type FuncoesDaGovernancaResponse,
} from '@educa/shared'
import { infiniteQueryOptions, queryOptions, type QueryClient } from '@tanstack/react-query'
import type { CicloDeExecucao } from '../../../../api/ciclo-de-execucao'
import { createTabStore } from '../../../../api/tab-store'
import { authedGet, authedRequest } from '../../../../api/sessao'

/**
 * A governança de IA e o Analista de desempenho escolar, pela coordenação (MVP, A5). A escola e o ano letivo vêm do
 * token, nunca da tela (regra 10, item 3). Nenhuma consulta daqui leva professor, turma ou pessoa: a API recusa esses
 * campos, e a tela não tem onde escolhê-los (D45, D64).
 */

/** O começo de toda chave destas telas: a troca de escola e a pessoa seguinte esvaziam tudo junto (`main.tsx`). */
export const GOVERNANCA_QUERY_KEY = ['governanca'] as const
export const ANALISTA_QUERY_KEY = ['analista'] as const

const CAMINHO_DA_GOVERNANCA = '/v1/governanca'
const CAMINHO_DO_ANALISTA = '/v1/analista'

/** `resumo`, `resumo?pagina=…`, `resumo?estado=…` ou `resumo?estado=…&pagina=…`: só valor de lista fechada e o cursor da API, nunca professor nem turma. */
const lerPaginaDoResumo = (pagina: string | undefined, signal: AbortSignal, estado?: EstadoDeEntrega) => {
  const consulta = new URLSearchParams()
  if (estado !== undefined) consulta.set('estado', estado)
  if (pagina !== undefined) consulta.set('pagina', pagina)
  const resto = consulta.toString()
  return authedGet(resto === '' ? `${CAMINHO_DA_GOVERNANCA}/resumo` : `${CAMINHO_DA_GOVERNANCA}/resumo?${resto}`, resumoDaGovernancaResponseSchema, signal)
}

/** "O que a IA gerou e quem aprovou", da mais nova para a mais antiga, uma página por vez (`proxima`). Os números vêm em toda página. */
export const resumoDaGovernancaQueryOptions = infiniteQueryOptions({
  queryKey: [...GOVERNANCA_QUERY_KEY, 'resumo'],
  queryFn: ({ pageParam, signal }) => lerPaginaDoResumo(pageParam, signal),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (ultima) => ultima.proxima,
})

function resumoDoEstadoQueryOptions(estado: EstadoDeEntrega) {
  return infiniteQueryOptions({
    queryKey: [...GOVERNANCA_QUERY_KEY, 'resumo', estado],
    queryFn: ({ pageParam, signal }) => lerPaginaDoResumo(pageParam, signal, estado),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (ultima) => ultima.proxima,
  })
}

const CONSULTAS_POR_ESTADO = {
  pendente: resumoDoEstadoQueryOptions('pendente'),
  aprovada: resumoDoEstadoQueryOptions('aprovada'),
  rejeitada: resumoDoEstadoQueryOptions('rejeitada'),
} as const satisfies Record<EstadoDeEntrega, unknown>

/**
 * A lista de uma tela filtrada por estado (X2, 10.0): **o estado entra na chave**, e por isso a resposta de um filtro nunca cai na
 * lista de outro, nem a que chega atrasada. A API filtra a lista e **não os números**; mesmo assim a tela não os lê daqui: os
 * quatro números são sempre os da consulta sem filtro (`resumoDaGovernancaQueryOptions`), e esta só entrega as linhas.
 */
export const resumoPorEstadoQueryOptions = (estado: EstadoDeEntrega) => CONSULTAS_POR_ESTADO[estado]

/**
 * Só a primeira página do resumo, na **mesma chave** da consulta infinita (Tech Spec, seção 7c, "Carga na manhã de segunda"):
 * para quem só quer os quatro números, que vêm em toda página. Um observador de consulta infinita releria todas as páginas que
 * a Governança já paginou (uma requisição por página); este lê uma, e guarda o dado no formato da infinita, que a Governança
 * continua lendo (`pages` e `pageParams`).
 */
export const primeiraPaginaDoResumoQueryOptions = queryOptions({
  queryKey: resumoDaGovernancaQueryOptions.queryKey,
  queryFn: async ({ signal }) => ({ pages: [await lerPaginaDoResumo(undefined, signal)], pageParams: [undefined] }),
})

/** O consumo do mês corrente, somado por função. */
export const consumoQueryOptions = queryOptions({
  queryKey: [...GOVERNANCA_QUERY_KEY, 'consumo'],
  queryFn: ({ signal }) => authedGet(`${CAMINHO_DA_GOVERNANCA}/consumo`, consumoResponseSchema, signal),
})

/** Os três agentes e as funções, com a autonomia em português comum e a suspensão vigente na escola. */
export const funcoesDaGovernancaQueryOptions = queryOptions({
  queryKey: [...GOVERNANCA_QUERY_KEY, 'funcoes'],
  queryFn: ({ signal }) => authedGet(`${CAMINHO_DA_GOVERNANCA}/funcoes`, funcoesDaGovernancaResponseSchema, signal),
})

const caminhoDaFuncao = (chave: ChaveDeFuncao, acao: 'suspender' | 'retomar'): string => `${CAMINHO_DA_GOVERNANCA}/funcoes/${encodeURIComponent(chave)}/${acao}`

/** `POST …/suspender`: a função passa a recusar execução nova na escola. O motivo é opcional e de lista fechada. */
export function suspenderFuncao(chave: ChaveDeFuncao, motivo: MotivoDeSuspensao | undefined): Promise<FuncaoDaGovernanca> {
  return authedRequest(caminhoDaFuncao(chave, 'suspender'), funcaoDaGovernancaResponseSchema, { metodo: 'POST', corpo: motivo === undefined ? {} : { motivo } })
}

/** `POST …/retomar`: fecha a suspensão vigente. Sem suspensão vigente, a API responde como inexistente. */
export function retomarFuncao(chave: ChaveDeFuncao): Promise<FuncaoDaGovernanca> {
  return authedRequest(caminhoDaFuncao(chave, 'retomar'), funcaoDaGovernancaResponseSchema, { metodo: 'POST', corpo: {} })
}

/** A função como a API a devolveu entra no lugar da antiga, em qualquer lista já lida. Sem lista lida, nada muda. */
export function trocarFuncao(lista: FuncoesDaGovernancaResponse | undefined, nova: FuncaoDaGovernanca): FuncoesDaGovernancaResponse | undefined {
  if (lista === undefined) return undefined
  return { agentes: lista.agentes.map((agente) => ({ ...agente, funcoes: agente.funcoes.map((funcao) => (funcao.chave === nova.chave ? nova : funcao)) })) }
}

/**
 * A tela depois de suspender ou retomar: a função muda na hora na lista lida, e a lista é marcada como velha. O time que
 * o professor lê (`GET /v1/time`) é de outra sessão, com o cache dela: ele o relê quando abre a tela.
 */
export function aplicarFuncao(cliente: QueryClient, nova: FuncaoDaGovernanca): void {
  cliente.setQueryData<FuncoesDaGovernancaResponse>(funcoesDaGovernancaQueryOptions.queryKey, (lista) => trocarFuncao(lista, nova))
  void cliente.invalidateQueries({ queryKey: funcoesDaGovernancaQueryOptions.queryKey })
}

/** O resumo mais recente do Analista na escola, ou `null` se nenhum foi gerado. */
export const resumoDoAnalistaQueryOptions = queryOptions({
  queryKey: [...ANALISTA_QUERY_KEY, 'resumo'],
  queryFn: ({ signal }) => authedGet(`${CAMINHO_DO_ANALISTA}/resumo`, resumoDoAnalistaResponseSchema, signal),
})

/** `POST /v1/analista/gerar`: 202 com a execução, que a tela acompanha pelo ciclo de `execucoes.ts`. */
export function gerarResumoDoAnalista(chaveEnvio: string): Promise<ExecucaoAceitaResponse> {
  return authedRequest(`${CAMINHO_DO_ANALISTA}/gerar`, execucaoAceitaResponseSchema, { metodo: 'POST', corpo: { chaveEnvio } })
}

/** Onde o pedido de "Gerar resumo" mora enquanto está no ar: sair da tela e voltar não o perde nem o manda de novo. */
export const lugarDoResumoDoAnalista = createTabStore<CicloDeExecucao<null>>()

/**
 * `GET /v1/analista/nominal`: o detalhe de uma turma, que nomeia os professores dela. **Cada chamada grava auditoria**,
 * com a finalidade, e por isso não é consulta com cache: é uma leitura pedida uma vez, de dentro do diálogo que avisa.
 */
export function lerDadoNominal(turmaId: string, finalidade: FinalidadeDaLeituraNominal): Promise<AnalistaNominalResponse> {
  return authedRequest(`${CAMINHO_DO_ANALISTA}/nominal?turmaId=${encodeURIComponent(turmaId)}&finalidade=${encodeURIComponent(finalidade)}`, analistaNominalResponseSchema)
}
