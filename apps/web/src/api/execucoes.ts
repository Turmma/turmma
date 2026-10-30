import { execucaoResponseSchema, type ExecucaoAceitaResponse } from '@educa/shared'
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { CHAVE_DAS_EXECUCOES } from './chaves-do-professor'
import {
  aceitarEnvio,
  chavesParaInvalidar,
  comecarEnvio,
  desistirDaConsulta,
  emCurso,
  intervaloDaConsulta,
  LIMIAR_DA_DEMORA_MS,
  recusarEnvio,
  registrarExecucao,
  tentarDeNovo,
  type CicloDeExecucao,
} from './ciclo-de-execucao'
import { useLugarNaAba, type LugarNaAba } from './memoria-da-aba'
import { buscarComSessao } from './sessao'

/**
 * A execução que a pessoa pediu (`GET /v1/execucoes/:id`), consultada no intervalo do contrato até terminar. Quem para a
 * consulta é `intervaloDaConsulta`; **sair da tela também para**, porque o intervalo é do observador da consulta, e sem
 * tela não há observador. Com a aba escondida o TanStack Query também não consulta.
 *
 * Não fica no cache depois de a tela sair (`gcTime: 0`): o que a execução produziu é lido pela consulta dele.
 */
export function consultaExecucao(id: string) {
  return queryOptions({
    queryKey: [...CHAVE_DAS_EXECUCOES, id],
    queryFn: ({ signal }) => buscarComSessao(`/v1/execucoes/${encodeURIComponent(id)}`, execucaoResponseSchema, signal),
    refetchInterval: (consulta) => intervaloDaConsulta(consulta.state.data, consulta.state.status === 'error'),
    staleTime: 0,
    gcTime: 0,
  })
}

export interface CicloNaTela<Pedido> {
  /** Onde o pedido está, ou `undefined` sem pedido nenhum. */
  readonly ciclo: CicloDeExecucao<Pedido> | undefined
  /** O pedido está no ar há mais tempo que o de costume: a tela avisa, sem contar o tempo (`AvisoFila`). */
  readonly demorando: boolean
  /** Manda um pedido novo. Devolve `false`, sem mandar nada, com outro pedido ainda no ar. */
  readonly iniciar: (pedido: Pedido) => boolean
  /** Repete o pedido que falhou. */
  readonly repetir: () => void
  /** Esquece o pedido: o formulário volta a aparecer, a conversa segue. Com o pedido no ar não faz nada. */
  readonly limpar: () => void
}

/**
 * **O ciclo que todas as telas de IA usam, num lugar só**: mandar o `POST` com a `chaveEnvio`, receber o 202, consultar
 * a execução até `concluida` ou `falhou`, e invalidar o que ela mudou. A regra é de `ciclo-de-execucao.ts`; aqui ela só
 * é ligada à rede e à tela.
 *
 * O estado mora num lugar da memória da aba (`memoria-da-aba.ts`), e não na tela: o pedido que sai da Home continua
 * sendo acompanhado quando a Conversa abre, e o `POST` que volta depois de a tela sair ainda acha onde escrever.
 * **A mudança de estado é síncrona**: `iniciar` grava `enviando` antes de devolver, e o segundo toque encontra o pedido
 * no ar sem depender de nenhum `isPending` que só chega no render seguinte.
 */
export function useCicloDeExecucao<Pedido>(lugar: LugarNaAba<CicloDeExecucao<Pedido>>, enviar: (pedido: Pedido, chaveEnvio: string) => Promise<ExecucaoAceitaResponse>): CicloNaTela<Pedido> {
  const cliente = useQueryClient()
  const ciclo = useLugarNaAba(lugar)
  const execucaoId = ciclo?.etapa === 'esperando' ? ciclo.execucaoId : undefined
  const execucao = useQuery({ ...consultaExecucao(execucaoId ?? ''), enabled: execucaoId !== undefined })
  const { data: lida, isError: consultaFalhou, error: erroDaConsulta } = execucao

  useEffect(() => {
    if (lida === undefined) return
    const antes = lugar.ler()
    const depois = registrarExecucao(antes, lida)
    if (depois === antes) return
    lugar.guardar(depois)
    if (depois?.etapa === 'concluida') for (const queryKey of chavesParaInvalidar(depois.resultado)) void cliente.invalidateQueries({ queryKey })
  }, [lida, lugar, cliente])

  useEffect(() => {
    if (consultaFalhou) lugar.guardar(desistirDaConsulta(lugar.ler(), erroDaConsulta))
  }, [consultaFalhou, erroDaConsulta, lugar])

  const mandar = useCallback(
    (novo: CicloDeExecucao<Pedido> | undefined): boolean => {
      if (novo === undefined) return false
      lugar.guardar(novo)
      const { chaveEnvio } = novo
      enviar(novo.pedido, chaveEnvio).then(
        (aceita) => lugar.guardar(aceitarEnvio(lugar.ler(), chaveEnvio, aceita.execucaoId)),
        (erro: unknown) => lugar.guardar(recusarEnvio(lugar.ler(), chaveEnvio, erro)),
      )
      return true
    },
    [lugar, enviar],
  )

  const iniciar = useCallback((pedido: Pedido) => mandar(comecarEnvio(lugar.ler(), pedido, () => crypto.randomUUID(), Date.now())), [lugar, mandar])
  const repetir = useCallback(() => void mandar(tentarDeNovo(lugar.ler(), () => crypto.randomUUID(), Date.now())), [lugar, mandar])
  const limpar = useCallback(() => {
    if (!emCurso(lugar.ler())) lugar.guardar(undefined)
  }, [lugar])

  // A demora é dita uma vez, quando o limiar passa: nenhum relógio corre na tela (D59).
  const noAr = emCurso(ciclo) ? ciclo : undefined
  const chaveNoAr = noAr?.chaveEnvio
  const desde = noAr?.desde
  const [demorouNa, definirDemorouNa] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (chaveNoAr === undefined || desde === undefined) return
    const relogio = setTimeout(() => definirDemorouNa(chaveNoAr), Math.max(0, desde + LIMIAR_DA_DEMORA_MS - Date.now()))
    return () => clearTimeout(relogio)
  }, [chaveNoAr, desde])

  return { ciclo, demorando: chaveNoAr !== undefined && demorouNa === chaveNoAr, iniciar, repetir, limpar }
}
