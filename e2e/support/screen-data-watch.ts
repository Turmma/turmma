import type { Page } from '@playwright/test'

/**
 * Vigia a página desde o primeiro quadro (chamar antes do `goto`) e grava o `Date.now()` em que as duas linhas da seção
 * passam a dizer "Disponível". Não prova o dado: quem prova é `esperarEstadoComDado`, em `casca.spec.ts`. Serve para saber **quando** ele
 * apareceu, porque o Playwright confere a asserção em degraus (100, 250, 500 e 1000 ms) e o relógio lido no instante em que
 * ele a percebe conta o degrau, e não o produto: com o dado já na tela, o caso passava de 5 s na esteira (5018 e 5117 ms).
 */
export async function vigiarODado(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __dadoApareceuEm?: number }
    // Só a seção "Componentes" (a mesma de `esperarEstadoComDado`): outro item da página que dissesse "API" e "Disponível" não conta.
    const secaoComponentes = () =>
      Array.from(document.querySelectorAll('section[aria-labelledby]')).find((secao) => document.getElementById(secao.getAttribute('aria-labelledby') ?? '')?.textContent === 'Componentes')
    const disponivel = (nome: string) =>
      Array.from(secaoComponentes()?.querySelectorAll('li') ?? []).some((item) => (item.textContent ?? '').includes(nome) && (item.textContent ?? '').includes('Disponível'))
    new MutationObserver(() => {
      if (w.__dadoApareceuEm === undefined && disponivel('API') && disponivel('Banco de dados')) w.__dadoApareceuEm = Date.now()
    }).observe(document, { subtree: true, childList: true, characterData: true })
  })
}

/** O que `vigiarODado` gravou na página, ou `undefined` se o dado ainda não apareceu (ou se a vigia veio depois do `goto`). */
export function instanteGravado(page: Page): Promise<number | undefined> {
  return page.evaluate(() => (window as unknown as { __dadoApareceuEm?: number }).__dadoApareceuEm)
}
