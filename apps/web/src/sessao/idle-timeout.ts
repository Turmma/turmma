import { useEffect, useRef } from 'react'
import { encerrarPorInatividade, registrarAtividade } from '../api/sessao'

/**
 * O intervalo mínimo entre dois avisos de atividade (Tech Spec, seção 5, "Atividade"). São 400 pessoas por escola com
 * a aba aberta a manhã inteira: avisar a cada clique somaria dezenas de escritas por segundo em `ultimo_uso_em` sem
 * mudar nada do que a inatividade decide.
 */
export const INTERVALO_MINIMO_DA_ATIVIDADE_MS = 5 * 60_000

/** Quantos milissegundos há em um minuto de `inatividadeMin`. */
const MS_POR_MINUTO = 60_000

/**
 * O canal por onde as abas do mesmo navegador dizem umas às outras que houve gente mexendo. Duas abas dividem a
 * mesma sessão: sem isso, a aba esquecida aberta numa turma venceria pelo relógio dela e encerraria no servidor a
 * sessão que a professora está usando na outra aba, no meio da aula.
 */
const CANAL_DE_ATIVIDADE = 'educa-atividade'

/**
 * De quanto em quanto tempo uma aba conta às outras que houve interação. A outra aba só precisa saber que havia
 * alguém aqui dentro da janela de inatividade, que é de dezenas de minutos: um aviso por minuto basta, e não custa
 * nada no Chromebook (ao contrário de um aviso por `pointermove`).
 */
const INTERVALO_DA_DIFUSAO_MS = 60_000

/**
 * O relógio de inatividade da aba (RF13, Tech Spec, seção 9).
 *
 * - **Só ponteiro e teclado contam.** A aba esquecida no Chromebook do carrinho, com ninguém na frente, não renova
 *   nada: é justamente ela que precisa vencer antes de o aluno seguinte sentar.
 * - **O relógio não faz polling, e leitura nenhuma conta como atividade.** O aviso de atividade só sai quando houve
 *   interação e já passaram 5 min do último; o resto é um `setTimeout` que não fala com a API. A lista de pedidos do
 *   professor relê sozinha (A1, 16.0), e essa leitura não move o relógio daqui nem o `ultimo_uso_em` do servidor.
 * - **O relógio mede a interação de verdade**, e não o último aviso enviado: o aviso pode estar até 5 min atrasado, e
 *   é por isso que o servidor tem 5 min de tolerância. Aqui, vencer pelo `inatividadeMin` da escola nunca desloga
 *   ninguém antes da hora — a conta sai da última tecla, não da última requisição.
 * - **Vencer encerra a sessão na API** e deixa o login por cima da tela, sem perder o que estava escrito.
 *
 * - **A interação de qualquer aba conta para todas.** A sessão é uma só, e o `DELETE` que a inatividade dispara
 *   derrubaria a aba em uso a partir de uma aba esquecida. As abas se avisam por `BroadcastChannel`, que não carrega
 *   nada além do aviso de que houve alguém.
 *
 * `ativa` desliga o relógio enquanto não há sessão aberta (a própria tela vencida, por exemplo); `inatividadeMin`
 * vem do `/v1/eu` e é configurável por escola e por papel, então o relógio só começa quando ele chega.
 */
export function useInatividade({ inatividadeMin, ativa }: { inatividadeMin: number | undefined; ativa: boolean }): void {
  const ultimaInteracao = useRef<number | undefined>(undefined)
  const ultimoAviso = useRef<number | undefined>(undefined)
  const ultimaDifusao = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!ativa || inatividadeMin === undefined) return
    const limiteMs = inatividadeMin * MS_POR_MINUTO
    // O relógio começa no momento em que a sessão passa a valer, e recomeça sempre que ela volta a valer: entrar é a
    // interação mais recente que existe, e o login acabou de mover o `ultimo_uso_em` no servidor. Sem recomeçar, a
    // professora que entra de novo no login por cima seria deslogada no mesmo instante, pela última tecla de antes
    // de a sessão vencer. E é por isso também que o primeiro aviso de atividade só faz sentido 5 min depois: sem
    // isso, a escola inteira mandaria um aviso no primeiro clique depois das 7h30.
    const agora = Date.now()
    ultimaInteracao.current = agora
    ultimoAviso.current = agora
    ultimaDifusao.current = agora
    let relogio: ReturnType<typeof setTimeout> | undefined
    // Sem `BroadcastChannel` (navegador antigo, ou teste fora do navegador), cada aba conta sozinha, como antes.
    const canal = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel(CANAL_DE_ATIVIDADE)

    function agendar(): void {
      const restante = (ultimaInteracao.current ?? Date.now()) + limiteMs - Date.now()
      if (restante <= 0) {
        void encerrarPorInatividade()
        return
      }
      relogio = setTimeout(agendar, restante)
    }

    function aoInteragir(): void {
      const momento = Date.now()
      ultimaInteracao.current = momento
      // As outras abas desta pessoa precisam saber que há gente aqui, senão a esquecida encerra a sessão de todas.
      if (momento - (ultimaDifusao.current ?? momento) >= INTERVALO_DA_DIFUSAO_MS) {
        ultimaDifusao.current = momento
        canal?.postMessage('interacao')
      }
      if (momento - (ultimoAviso.current ?? momento) < INTERVALO_MINIMO_DA_ATIVIDADE_MS) return
      ultimoAviso.current = momento
      // A falha não vira erro na tela: o servidor tem a tolerância para uma atividade perdida, e a pessoa está no
      // meio de outra coisa. Quem trata o 401 é a própria chamada com sessão.
      void registrarAtividade().catch(() => undefined)
    }

    // `passive`: o `pointermove` dispara muitas vezes por segundo, e o Chromebook fraco não pode pagar por nada além
    // de uma comparação de números a cada evento.
    // Interação que veio de outra aba: adia o vencimento aqui, e só isso. Quem avisou a API foi ela, e repetir o
    // aviso duplicaria a escrita de `ultimo_uso_em` por aba aberta.
    function aoOuvirOutraAba(): void {
      ultimaInteracao.current = Date.now()
    }

    const eventos = ['pointerdown', 'pointermove', 'keydown'] as const
    for (const evento of eventos) window.addEventListener(evento, aoInteragir, { passive: true })
    canal?.addEventListener('message', aoOuvirOutraAba)
    agendar()

    return () => {
      for (const evento of eventos) window.removeEventListener(evento, aoInteragir)
      canal?.removeEventListener('message', aoOuvirOutraAba)
      canal?.close()
      if (relogio !== undefined) clearTimeout(relogio)
    }
  }, [ativa, inatividadeMin])
}
