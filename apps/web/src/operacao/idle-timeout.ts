import { useCallback, useEffect, useRef, useState } from 'react'
import { registrarUsoDaOperacao } from './api/eu'
import { aoUsarSessaoDeOperador, encerrarSessaoDeOperadorPorInatividade, ultimoUsoDaSessaoDeOperador } from './api/sessao'

/** A sessão do operador termina depois de 30 min sem uso (PRD da A0, RF5), sem configuração nem tolerância. */
export const INATIVIDADE_DA_OPERACAO_MS = 30 * 60_000

/**
 * A API grava o `ultimoUsoEm` da sessão no máximo uma vez por minuto (tarefa 4.0): o uso que ela guarda pode ser até um
 * minuto mais velho que a última requisição que esta aba viu aceita. A conta daqui desconta esse minuto, para o aviso
 * nunca chegar depois de a sessão já ter terminado no servidor.
 */
export const FOLGA_DA_GRAVACAO_DO_USO_MS = 60_000

/** O aviso aparece 2 min antes do fim (Tech Spec da A0, seção 9): o ponto de parada é visível antes de cair (D59). */
export const ANTECEDENCIA_DO_AVISO_MS = 2 * 60_000

/**
 * O intervalo mínimo entre dois avisos de uso ao servidor. Menos que isso não muda nada no banco, que grava uma vez por
 * minuto; e a operação é a nossa equipe, poucas pessoas, fora do caminho quente das escolas.
 */
export const INTERVALO_MINIMO_DO_USO_MS = 60_000

/** Os dois momentos do relógio, a partir do último uso aceito pela API. */
export function prazosDaInatividade(ultimoUso: number): { readonly aviso: number; readonly fim: number } {
  const fim = ultimoUso + INATIVIDADE_DA_OPERACAO_MS - FOLGA_DA_GRAVACAO_DO_USO_MS
  return { aviso: fim - ANTECEDENCIA_DO_AVISO_MS, fim }
}

/**
 * O relógio de inatividade da sessão do operador, no desenho do `sessao/idle-timeout.ts` da escola:
 *
 * - **Só ponteiro e teclado contam.** A aba esquecida não se mantém viva sozinha. O `pointermove` sem deslocamento é o
 *   que o Chrome dispara quando a tela muda debaixo do cursor parado (o próprio aviso aparecendo, por exemplo); ele não
 *   é gente, e não conta.
 * - **Nenhuma tela faz polling.** Com interação, e passado um minuto do último uso, sai um `GET /v1/operacao/eu`, que é o
 *   que move o `ultimoUsoEm` no servidor. O resto é um `setTimeout` que não fala com a API.
 * - **O relógio conta do último uso aceito pela API**, e não da última tecla: é o uso do servidor que encerra a sessão.
 *   Toda requisição aceita desta aba, e das outras abas da operação (pelo canal próprio), empurra o relógio.
 * - **2 min antes do fim, o aviso**, com "Continuar na sessão" e "Sair". No fim, a sessão é encerrada na API e a aba
 *   vai à entrada com a mensagem de sessão encerrada.
 */
export function useInatividadeDaOperacao(ativa: boolean): { readonly avisoVisivel: boolean; readonly continuar: () => void } {
  const [avisoVisivel, definirAvisoVisivel] = useState(false)
  const usoEmAndamento = useRef<Promise<unknown> | undefined>(undefined)

  const continuar = useCallback((): void => {
    // Um aviso por vez: o clique no botão também é um `pointerdown`, e os dois não mandam duas requisições.
    usoEmAndamento.current ??= registrarUsoDaOperacao()
      .catch(() => undefined)
      .finally(() => {
        usoEmAndamento.current = undefined
      })
  }, [])

  useEffect(() => {
    if (!ativa) return
    // Até a primeira requisição aceita (a aba que reabriu pelo cookie, que renovar não conta como uso), o relógio conta
    // de agora: a própria casca pede o `/eu` ao montar, e ele traz o uso de verdade.
    const inicio = Date.now()
    let relogio: ReturnType<typeof setTimeout> | undefined

    function agendar(): void {
      if (relogio !== undefined) clearTimeout(relogio)
      const { aviso, fim } = prazosDaInatividade(ultimoUsoDaSessaoDeOperador() ?? inicio)
      const agora = Date.now()
      if (agora >= fim) {
        void encerrarSessaoDeOperadorPorInatividade()
        return
      }
      definirAvisoVisivel(agora >= aviso)
      relogio = setTimeout(agendar, (agora >= aviso ? fim : aviso) - agora)
    }

    function aoInteragir(evento: Event): void {
      if (evento instanceof PointerEvent && evento.type === 'pointermove' && evento.movementX === 0 && evento.movementY === 0) return
      if (Date.now() - (ultimoUsoDaSessaoDeOperador() ?? inicio) < INTERVALO_MINIMO_DO_USO_MS) return
      continuar()
    }

    const eventos = ['pointerdown', 'pointermove', 'keydown'] as const
    // `passive`: o `pointermove` dispara muitas vezes por segundo, e aqui só se compara dois números.
    for (const evento of eventos) window.addEventListener(evento, aoInteragir, { passive: true })
    const pararDeOuvir = aoUsarSessaoDeOperador(agendar)
    agendar()

    return () => {
      for (const evento of eventos) window.removeEventListener(evento, aoInteragir)
      pararDeOuvir()
      if (relogio !== undefined) clearTimeout(relogio)
      definirAvisoVisivel(false)
    }
  }, [ativa, continuar])

  return { avisoVisivel, continuar }
}
