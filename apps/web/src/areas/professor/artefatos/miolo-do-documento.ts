import { useLayoutEffect, useRef, type RefObject } from 'react'

/**
 * O miolo do documento aberto (telas do professor, 6.0; RF22; `mockup.md` 10.2: "a página não rola, rola a mesa"): do `md` para
 * cima o cabeçalho (o voltar, o título, a assinatura com as ações, as linhas da versão adaptada) e as abas ficam parados, e só o
 * painel da aba rola por dentro, com o `Gabarito` e a folha. Abaixo de 768 px a página rola inteira, como qualquer outra.
 *
 * É também o miolo de **"O que o Assistente fez"** (a conversa, sob a faixa e as abas) e o do **formulário de uma ferramenta** (o
 * formulário e "Como vai sair"), pela mesma conta (correção `2026-10-19-formulario-e-assistente-rolam-a-pagina`, RF22): quem o usa
 * mede o topo com `useTopoDoPainel` (o painel de abas) ou `useTopoDoMiolo` (o próprio miolo).
 *
 * A altura do painel é a da janela menos **onde ele começa** (`--topo-do-painel`, que `useTopoDoPainel` mede) menos a margem de baixo
 * do `main` (32 px) e uma folga de 8 px. Medir, em vez de somar o cabeçalho em `rem` como faz a `O_MIOLO_QUE_ROLA` da coordenação
 * (`areas/coordenacao/comum/miolo-que-rola.ts`), é o que serve a este: o cabeçalho do documento muda de altura com o que a versão adaptada
 * diz (a adaptação, a situação, o "Ver e decidir", o motivo de quem rejeitou) e com o título que quebra. Enquanto a variável não
 * existe (o primeiro quadro, o teste de componente) vale o `24,5rem` de uma atividade sem versão a 1366 × 768. Quem prova a conta é
 * `paginaNaoRola`, em `e2e/support/coordenacao.ts`: a string não prova nada. `md:relative` prende o que for posicionado dentro
 * do painel, para não aumentar a página por fora dele.
 */
export const O_MIOLO_DO_DOCUMENTO = 'md:relative md:max-h-[calc(100dvh-var(--topo-do-painel,24.5rem)-2.5rem)] md:overflow-y-auto'

/**
 * Mede onde o painel da aba começa e grava `--topo-do-painel` no elemento da `ref`, que é o que envolve as abas. Mede de novo quando
 * a janela muda e quando a tela por cima muda de altura (um título que quebra, a leitura das entregas que traz a situação da versão,
 * o formulário de renomear). `aberto` é falso enquanto a tela ainda não montou o elemento (carregando, erro).
 */
export function useTopoDoPainel(aberto: boolean) {
  const raiz = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const no = raiz.current
    if (!aberto || no === null) return
    const medir = (): void => {
      const painel = no.querySelector('[role="tabpanel"]')
      if (painel === null) return
      no.style.setProperty('--topo-do-painel', `${String(Math.round(painel.getBoundingClientRect().top + window.scrollY))}px`)
    }
    medir()
    const vigia = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(medir)
    vigia?.observe(no.closest('[data-tela]') ?? document.body)
    window.addEventListener('resize', medir)
    return () => {
      vigia?.disconnect()
      window.removeEventListener('resize', medir)
      no.style.removeProperty('--topo-do-painel')
    }
  }, [aberto])
  return raiz
}

/**
 * O mesmo que `useTopoDoPainel`, para o miolo **sem abas**: a `ref` vai no próprio elemento que rola (o formulário de uma
 * ferramenta), e a variável é gravada nele mesmo. A altura máxima dele não muda onde ele começa, e por isso medir o topo de quem
 * está sendo limitado não gira em círculo.
 */
export function useTopoDoMiolo<T extends HTMLElement>(): RefObject<T | null> {
  const miolo = useRef<T>(null)
  useLayoutEffect(() => {
    const no = miolo.current
    if (no === null) return
    const medir = (): void => {
      no.style.setProperty('--topo-do-painel', `${String(Math.round(no.getBoundingClientRect().top + window.scrollY))}px`)
    }
    medir()
    const vigia = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(medir)
    vigia?.observe(no.closest('[data-tela]') ?? document.body)
    window.addEventListener('resize', medir)
    return () => {
      vigia?.disconnect()
      window.removeEventListener('resize', medir)
      no.style.removeProperty('--topo-do-painel')
    }
  }, [])
  return miolo
}
