import { timeResponseSchema, type Agente, type AgenteDoTime, type ChaveDeFuncao, type FuncaoDoTime, type TimeResponse } from '@educa/shared'
import { queryOptions } from '@tanstack/react-query'
import { CHAVE_DO_TIME } from '../../../../api/chaves-do-professor'
import { buscarComSessao } from '../../../../api/sessao'

/**
 * `GET /v1/time`: os três agentes, as funções de cada um, o que cada função faz sozinha e o que espera aprovação, em
 * português comum, e se a coordenação suspendeu a função na escola (D9, D32, D60). É a mesma resposta para o professor e
 * para a coordenação: a tela não escreve a autonomia de outro jeito (regra 70, item 5).
 */
export const consultaTime = queryOptions({
  queryKey: CHAVE_DO_TIME,
  queryFn: ({ signal }) => buscarComSessao('/v1/time', timeResponseSchema, signal),
})

/** Um agente do time, com as funções dele. */
export function agenteDoTime(time: TimeResponse | undefined, agente: Agente): AgenteDoTime | undefined {
  return time?.agentes.find((item) => item.agente === agente)
}

/** Uma função do time, pela chave. */
export function funcaoDoTime(time: TimeResponse | undefined, chave: ChaveDeFuncao): FuncaoDoTime | undefined {
  return time?.agentes.flatMap((agente) => agente.funcoes).find((funcao) => funcao.chave === chave)
}

/**
 * A escola suspendeu a função? Sem a resposta do time (carregando, ou a leitura falhou), a tela não afirma que suspendeu:
 * quem recusa de verdade é o servidor, com `FUNCAO_SUSPENSA`, e a tela mostra o mesmo aviso quando ele recusa.
 */
export function funcaoSuspensa(time: TimeResponse | undefined, chave: ChaveDeFuncao): boolean {
  return funcaoDoTime(time, chave)?.suspensa === true
}
