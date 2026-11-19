import { ErrorCode } from '@educa/shared'
import { createElement, useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { ApiError } from '../api/client'
import { ESPERA_MINIMA_NO_503_MS } from '../api/sessao'

/**
 * A espera única do 503 que não é do usuário (54.0; RF13): com o Redis de fila fora, o segundo fator e a escolha de escola
 * respondem `INDISPONIVEL_TENTE_DE_NOVO` com `Retry-After`, e nenhuma tentativa foi gasta. A tela espera esse tempo **uma
 * vez**, com o botão desabilitado e o aviso em `role="status"`, e repete o mesmo pedido; o segundo 503, ou um `Retry-After`
 * acima do limite, vai ao `ErrorState`, sem nova espera. Quem repete mais que isso martela a rota às 7h30 (regra 80, item 1).
 *
 * Não é o `comFilaDoSemaforo` da entrada por senha: aquele repete por até 30 s porque o 503 do semáforo é fila. Aqui a causa é
 * uma queda, e a pessoa precisa saber logo que ela existe.
 */

/** O maior `Retry-After` que a tela espera sozinha: acima disso, é o `ErrorState` na hora. */
export const LIMITE_DA_ESPERA_DO_INDISPONIVEL_S = 10

/** O que a região de status diz enquanto espera; a contagem vem depois, escondida do leitor de tela. */
export const AVISO_DA_ESPERA_DO_INDISPONIVEL = 'Tentando de novo em instantes'

/** O erro é o 503 que pede uma espera curta, com o `Retry-After` dentro do limite? Devolve os segundos (no mínimo o piso da entrada), ou `undefined`. */
export function esperaDoIndisponivel(erro: unknown): number | undefined {
  if (!isIndisponivel(erro)) return undefined
  // O cliente só entrega o `Retry-After` que é número finito e não negativo (`esperaDaResposta`): sobra o limite.
  const segundos = erro.esperaSegundos
  if (segundos === undefined || segundos > LIMITE_DA_ESPERA_DO_INDISPONIVEL_S) return undefined
  return Math.max(segundos, ESPERA_MINIMA_NO_503_MS / 1_000)
}

/** O erro é o 503 de queda (com ou sem `Retry-After`): a tela o mostra no `ErrorState`, e não na mensagem do campo. */
export function isIndisponivel(erro: unknown): erro is ApiError {
  return erro instanceof ApiError && erro.codigo === ErrorCode.INDISPONIVEL_TENTE_DE_NOVO
}

/**
 * A região de status da tela que espera: **visível** enquanto espera, com "Tentando de novo em instantes" e a contagem em
 * `aria-hidden` (o leitor de tela ouve só o aviso), e escondida (`sr-only`) fora da espera, onde diz o `repouso` ("Entrando…")
 * para o leitor de tela. A região existe antes do texto, para a mudança ser anunciada. Está aqui, e não em cada tela, porque as
 * três a escrevem igual.
 */
export function AvisoDaEspera({ restante, repouso, classe }: { readonly restante: number | undefined; readonly repouso: string; readonly classe: string }): ReactElement {
  return createElement(
    'p',
    { role: 'status', className: restante === undefined ? 'sr-only' : classe },
    restante === undefined ? repouso : AVISO_DA_ESPERA_DO_INDISPONIVEL,
    restante !== undefined && createElement('span', { 'aria-hidden': 'true' }, ` (${String(restante)} s)`),
  )
}

/** A tentativa foi descartada: a tela mudou (outra pessoa, outra entrada, a página saiu) enquanto ela estava no ar. */
export const DESCARTADA = Symbol('descartada')

type Resultado<T> = { readonly valor: T } | { readonly erro: unknown }

/** O pedido feito, com o erro como valor: quem o espera confere se ainda é o de agora antes de deixá-lo subir. */
async function attempt<T>(acao: () => Promise<T>): Promise<Resultado<T>> {
  try {
    return { valor: await acao() }
  } catch (erro) {
    return { erro }
  }
}

const waitMs = (ms: number): Promise<void> => new Promise((resolver) => setTimeout(resolver, ms))

export interface EsperaDoIndisponivel {
  /** Os segundos que faltam para a nova tentativa, enquanto ela espera; `undefined` fora da espera. */
  readonly restante: number | undefined
  /**
   * Roda `acao`; se ela dá o 503 que pede espera, espera o `Retry-After` e roda **uma** vez mais. Qualquer outro erro, e o segundo
   * 503, sobem como estão. Cada chamada começa do zero (a mesma entrada de novo não herda a espera), e devolve `DESCARTADA` se,
   * ao voltar de qualquer pedido, ela já não é a de agora: outra chamada começou, a tela saiu, ou `aindaVale` deixou de valer
   * (a pessoa da aba é outra). A repetição nunca sai nesse caso: ela levaria o desafio de quem entrou depois.
   */
  readonly run: <T>(acao: () => Promise<T>, aindaVale?: () => boolean) => Promise<T | typeof DESCARTADA>
}

/**
 * O estado e o relógio da espera única de uma tela. `esperar` só existe para o teste mover o tempo.
 */
export function useEsperaDoIndisponivel(esperar: (ms: number) => Promise<void> = waitMs): EsperaDoIndisponivel {
  const geracao = useRef(0)
  const contagem = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const [restante, definirRestante] = useState<number | undefined>(undefined)

  const pararContagem = useCallback((): void => {
    clearInterval(contagem.current)
    contagem.current = undefined
    definirRestante(undefined)
  }, [])

  // A tela que sai invalida o que estava no ar: a resposta que chegar depois não repete nada nem muda a tela seguinte.
  useEffect(
    () => () => {
      geracao.current += 1
      clearInterval(contagem.current)
    },
    [],
  )

  const executar = useCallback(
    async <T>(acao: () => Promise<T>, aindaVale: () => boolean = () => true): Promise<T | typeof DESCARTADA> => {
      geracao.current += 1
      const minha = geracao.current
      const valendo = (): boolean => geracao.current === minha
      // A contagem de uma tentativa anterior não é desta. A tela desliga o botão enquanto uma chamada está no ar: nunca há duas.
      pararContagem()
      const primeira = await attempt(acao)
      if (!valendo()) return DESCARTADA
      if ('valor' in primeira) return primeira.valor
      const segundos = esperaDoIndisponivel(primeira.erro)
      if (segundos === undefined) throw primeira.erro

      definirRestante(segundos)
      let faltam = segundos
      contagem.current = setInterval(() => {
        faltam = Math.max(faltam - 1, 1)
        definirRestante(faltam)
      }, 1_000)
      try {
        await esperar(segundos * 1_000)
      } finally {
        // A contagem de agora é de quem está de pé: a de uma chamada que outra já trocou foi parada por ela, e parar aqui
        // pararia a da nova.
        if (valendo()) pararContagem()
      }
      // Quem repete é quem pediu: a tela saiu, ou o desafio da aba já é de outra pessoa, e a repetição levaria o dele.
      if (!valendo() || !aindaVale()) return DESCARTADA
      // O erro da repetição vale o mesmo que o sucesso: depois de a tela sair, ele não sobe para quem chamou (o `CONTA_SEGURADA`
      // tardio apagaria o desafio de quem entrou depois).
      const segunda = await attempt(acao)
      if (!valendo()) return DESCARTADA
      if ('valor' in segunda) return segunda.valor
      throw segunda.erro
    },
    [esperar, pararContagem],
  )

  return { restante, run: executar }
}
