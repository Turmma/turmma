import { AxeBuilder } from '@axe-core/playwright'
import type { Page } from '@playwright/test'

/** As regras do axe que a esteira aplica. `wcag22aa` traz o `target-size` (alvo de toque de 24 px). */
export const TAGS_WCAG = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] as const

export const IMPACTOS_QUE_REPROVAM = ['serious', 'critical'] as const

/** Alvo de toque mínimo de ação principal, além dos 24 px que o axe cobra (regra 50, item 2a). */
export const ALVO_DE_TOQUE_PRINCIPAL_PX = 44

export interface ViolacaoGrave {
  regra: string
  impacto: string
  alvos: string[]
}

/**
 * Faz as barras presas por `position: sticky` (a de topo da casca no celular e a barra presa de ação) deixarem de contar
 * como obstáculo para o `target-size` do axe, e devolve o que desfaz. O axe tira do alvo a área que um elemento
 * sobreposto cobre e ignora o que tem `pointer-events: none`; a barra de topo cobre o pedaço de um controle que passa por
 * baixo dela, e com um vizinho ao lado o mesmo botão passava ou reprovava conforme o ponto onde a rolagem parou (o que a
 * 13.0 mudou ao reservar o pé da página). Que o último controle termina acima da barra de baixo é provado por medida, em
 * `casca-no-celular.spec.ts`, e não pela rolagem em que a auditoria calhou de pegar a página. O desfazer devolve o valor e
 * a prioridade que o elemento tinha em linha, ou tira a propriedade quando não tinha nenhum.
 */
async function tirarAsBarrasPresasDoCaminho(page: Page): Promise<() => Promise<void>> {
  await page.evaluate(() => {
    const presas: Array<{ elemento: HTMLElement; valor: string; prioridade: string }> = []
    for (const elemento of document.body.querySelectorAll<HTMLElement>('*')) {
      if (getComputedStyle(elemento).position !== 'sticky') continue
      presas.push({ elemento, valor: elemento.style.getPropertyValue('pointer-events'), prioridade: elemento.style.getPropertyPriority('pointer-events') })
      elemento.style.setProperty('pointer-events', 'none', 'important')
    }
    Object.assign(window, { barrasPresasDaAuditoria: presas })
  })
  return () =>
    page.evaluate(() => {
      const presas = (window as unknown as { barrasPresasDaAuditoria?: Array<{ elemento: HTMLElement; valor: string; prioridade: string }> }).barrasPresasDaAuditoria ?? []
      for (const { elemento, valor, prioridade } of presas) {
        if (valor === '') elemento.style.removeProperty('pointer-events')
        else elemento.style.setProperty('pointer-events', valor, prioridade)
      }
      Reflect.deleteProperty(window, 'barrasPresasDaAuditoria')
    })
}

/**
 * Violações `serious` e `critical` do axe na página como está agora, sem que uma barra presa por `sticky` cubra um alvo no
 * meio da rolagem. Lista vazia é a única que passa.
 */
export async function violacoesGraves(page: Page): Promise<ViolacaoGrave[]> {
  const desfazer = await tirarAsBarrasPresasDoCaminho(page)
  let resultado
  try {
    resultado = await new AxeBuilder({ page }).withTags([...TAGS_WCAG]).analyze()
  } finally {
    await desfazer()
  }
  return resultado.violations
    .filter((violacao) => (IMPACTOS_QUE_REPROVAM as readonly string[]).includes(violacao.impact ?? ''))
    .map((violacao) => ({
      regra: violacao.id,
      impacto: violacao.impact ?? '',
      alvos: violacao.nodes.map((no) => no.target.join(' ')),
    }))
}

/**
 * Quantos px o documento passa da largura da janela. Zero é sem rolagem horizontal. Compara com a
 * largura do viewport de layout, que o `width=device-width` fixa na largura do aparelho.
 */
export function larguraExcedente(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}

/**
 * A cor de um token da D80 (`--color-<nome>`) como o navegador a devolve no estilo calculado, lida da própria página por
 * uma sonda: vale nos dois temas, sem repetir o hex no teste.
 */
export function corDoToken(page: Page, token: string): Promise<string> {
  return page.evaluate((nome) => {
    const sonda = document.createElement('span')
    sonda.style.color = `var(--color-${nome})`
    document.body.append(sonda)
    const cor = getComputedStyle(sonda).color
    sonda.remove()
    return cor
  }, token)
}

/**
 * Quantos px o conteúdo do diálogo aberto passa da largura dele. O `dialog` modal fica na camada de cima, fixo, e o que
 * transborda dele não aumenta o documento: vira rolagem horizontal dentro do próprio diálogo, que a `larguraExcedente`
 * não enxerga. Zero é sem rolagem; sem diálogo aberto, falha alto.
 */
export function larguraExcedenteDoDialogo(page: Page): Promise<number> {
  // O de cima é o último: o diálogo que abre por cima do painel vem depois dele na página.
  return page
    .locator('dialog[open]')
    .last()
    .evaluate((dialogo) => dialogo.scrollWidth - dialogo.clientWidth)
}

/**
 * O foco do elemento aparece, e é o anel da D80: contorno **sólido** de 3 px na cor do token `foco` (RF7). A sombra deixou
 * de valer: o degrau do botão é sombra permanente, e uma asserção que aceitasse sombra passaria sempre. O afastamento não
 * entra, porque varia por peça (2 px; 0 no campo; por dentro na linha de tabela e no item de menu).
 *
 * A cor do token é lida da própria página, por uma sonda com `color: var(--color-foco)`: vale nos dois temas, sem
 * repetir o hex aqui.
 */
export function focoVisivel(page: Page, seletorAtivo = ':focus-visible'): Promise<boolean> {
  return page.evaluate((seletor) => {
    const elemento = document.activeElement
    if (!elemento || !elemento.matches(seletor)) return false
    const sonda = document.createElement('span')
    sonda.style.color = 'var(--color-foco)'
    document.body.append(sonda)
    const foco = getComputedStyle(sonda).color
    sonda.remove()
    const estilo = getComputedStyle(elemento)
    return estilo.outlineStyle === 'solid' && estilo.outlineWidth === '3px' && estilo.outlineColor === foco
  }, seletorAtivo)
}

/**
 * O código numérico de erro (`503`, `409`, `429`) como texto cru na tela, para `not.toContainText` (regra 50, item 12:
 * erro diz o que fazer, não o código).
 *
 * Não é a substring: o nome sintético da escola e da pessoa vem de oito caracteres hexadecimais minúsculos
 * (`marca.slice(0, 8)`), e `fa5030ac` ou `a2503562` trazem "503" sem erro nenhum na tela (esteira de 12/10/2026, duas
 * vezes). Em oito caracteres, um código de três tem sempre um vizinho hexadecimal; o do erro de verdade vem entre espaço,
 * pontuação ou o texto do botão vizinho, que o `textContent` cola sem espaço ("Erro 503Tentar de novo").
 *
 * **O que a guarda deixa de ver:** o código cru colado a uma letra minúscula de `a` a `f` ou a um dígito ("503de novo",
 * "5031"), porque para a expressão ele é indistinguível de um pedaço de nome sintético. Os botões e avisos de hoje
 * começam em maiúscula, então o risco é baixo; um botão que comece em minúscula de `a` a `f` e venha logo depois do erro
 * pede outra guarda, e não o afrouxamento desta.
 */
export function codigoCru(codigo: string): RegExp {
  return new RegExp(`(?<![0-9a-f])${codigo}(?![0-9a-f])`)
}
