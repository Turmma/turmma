import type { Locator, Page } from '@playwright/test'
import { expect } from './profiles.ts'

/**
 * O que os specs que olham o avatar da onça dividem (RF10 da X1; `docs/interface.md` 9.7): **todo `[data-agente]` tem, no
 * `[data-assinatura]` mais próximo, exatamente ele, o nome da função em texto visível e um `[data-selo-ia]`**. A
 * `AgentSignature` e o cabeçalho do balão da `AIMessage` levam o atributo; o avatar sem eles é o que o teste reprova.
 *
 * O nome que acompanha o avatar é o do agente dele: o `[data-agente="tutor"]` tem ao lado "Tutor" ou "Tutor · <função>",
 * e nunca o nome de outro.
 */
const NOME_POR_AGENTE: Readonly<Record<string, RegExp>> = {
  assistente_de_ensino: /^Assistente( de ensino| · .+)$/,
  tutor: /^Tutor( · .+)?$/,
  analista_de_desempenho_escolar: /^Analista( de desempenho escolar| · .+)$/,
}

/** O que uma conferência em lote achou: quantos itens eram (avatares ou selos) e, um por linha, o que cada um descumpre. */
export interface RelatorioDaConferencia {
  total: number
  falhas: string[]
}

/**
 * A conferência de cada avatar de `raiz` (a página ou um pedaço dela), **numa ida só ao navegador**. Com a CPU ×4 e o
 * runner da esteira, uma ida por asserção (nove por avatar, em mais de quarenta avatares) passava dos 30 s do caso
 * (esteira 38896156999). Devolve o relatório em vez de lançar, para o teste do próprio verificador (que alimenta uma
 * página montada com cada defeito) ver cada falha; quem confere a tela usa `conferirAssinaturas`.
 *
 * "Visível" é o do Playwright: caixa com largura e altura e sem `visibility: hidden`.
 *
 * **Não espera nada aparecer**: lê a tela uma vez, como está. Quem chama já esperou a galeria abrir (`openGallery`).
 */
export function avaliarAssinaturas(raiz: Locator | Page): Promise<RelatorioDaConferencia> {
  const nomes = Object.entries(NOME_POR_AGENTE).map(([agente, nome]) => [agente, nome.source] as const)
  return raiz.locator('[data-agente]').evaluateAll((avatares, nomesPorAgente) => {
    const visivel = (no: Element): boolean => {
      const caixa = no.getBoundingClientRect()
      return caixa.width > 0 && caixa.height > 0 && getComputedStyle(no).visibility !== 'hidden'
    }
    const falhas: string[] = []
    avatares.forEach((avatar, indice) => {
      const agente = avatar.getAttribute('data-agente') ?? ''
      const nome = nomesPorAgente.find(([chave]) => chave === agente)?.[1]
      if (nome === undefined) {
        falhas.push(`o agente "${agente}" não é um dos três`)
        return
      }
      // `closest` a partir do pai é o ancestral mais próximo: o bloco de uma assinatura dentro de outra não vale como o da de fora.
      const bloco = avatar.parentElement?.closest('[data-assinatura]') ?? null
      if (bloco === null) {
        falhas.push(`${agente} #${String(indice)}: o avatar está fora de uma assinatura`)
        return
      }
      if (bloco.querySelectorAll('[data-agente]').length !== 1) falhas.push(`${agente}: a assinatura tem mais de um avatar`)
      const selos = bloco.querySelectorAll('[data-selo-ia]')
      if (selos.length !== 1) falhas.push(`${agente}: sem o selo "IA", ou com dois`)
      else if (!visivel(selos[0] as Element)) falhas.push(`${agente}: o selo está escondido`)
      // O nome, em texto que se vê, ao lado do avatar: um parágrafo ou um título, e o texto é o nome do mesmo agente.
      const textos = bloco.querySelectorAll('p, h2, h3')
      if (textos.length !== 1) falhas.push(`${agente}: a assinatura não diz o nome da função`)
      else if (!visivel(textos[0] as Element)) falhas.push(`${agente}: o nome da função está escondido`)
      else if (!new RegExp(nome).test((textos[0]?.textContent ?? '').trim())) falhas.push(`${agente}: o nome é de outro agente`)
    })
    return { total: avatares.length, falhas }
  }, nomes)
}

/**
 * O selo "IA" de cada `[data-selo-ia]` de `raiz`, numa ida só ao navegador: a sigla escondida do leitor de tela, uma só; o
 * que ela quer dizer por extenso, em texto; e nenhum `title`, que só existe no hover (`docs/interface.md` 10.2).
 * Não espera o selo aparecer: lê a tela uma vez, e quem chama já esperou a galeria abrir.
 */
export function avaliarSelos(raiz: Locator | Page): Promise<RelatorioDaConferencia> {
  return raiz.locator('[data-selo-ia]').evaluateAll((selos) => {
    const limpo = (texto: string | null): string => (texto ?? '').replace(/\s+/g, ' ').trim()
    const falhas: string[] = []
    selos.forEach((selo, indice) => {
      const siglas = [...selo.querySelectorAll('[aria-hidden="true"]')].map((sigla) => limpo(sigla.textContent))
      if (siglas.length !== 1 || siglas[0] !== 'IA') falhas.push(`selo #${String(indice)}: a sigla "IA" é uma só e fica escondida do leitor de tela`)
      if (limpo(selo.textContent) !== 'IAgerado por inteligência artificial') falhas.push(`selo #${String(indice)}: o que a sigla quer dizer está por extenso, em texto`)
      if (selo.hasAttribute('title')) falhas.push(`selo #${String(indice)}: o que a sigla quer dizer não fica num title`)
    })
    return { total: selos.length, falhas }
  })
}

/**
 * O desenho de cada `[data-agente]` de `raiz`, numa ida só: um quadrado à vista, um círculo, com uma cabeça (um `svg`) e
 * nenhuma imagem dentro (D58). A cor do anel é de cada agente e fica com quem chama.
 * Não espera o avatar aparecer: lê a tela uma vez, e quem chama já esperou a galeria abrir.
 */
export function avaliarAvatares(raiz: Locator | Page): Promise<RelatorioDaConferencia> {
  return raiz.locator('[data-agente]').evaluateAll((avatares) => {
    const falhas: string[] = []
    avatares.forEach((avatar, indice) => {
      const caixa = avatar.getBoundingClientRect()
      const quem = `avatar #${String(indice)}`
      if (!(caixa.width > 0 && caixa.width === caixa.height)) falhas.push(`${quem}: não é um quadrado à vista (${String(caixa.width)} × ${String(caixa.height)})`)
      if (!(Number.parseFloat(getComputedStyle(avatar).borderTopLeftRadius) >= caixa.width / 2)) falhas.push(`${quem}: não é um círculo`)
      if (avatar.querySelectorAll('svg').length !== 1) falhas.push(`${quem}: tem de ter uma cabeça (um svg)`)
      if (avatar.querySelectorAll('img, image, picture').length !== 0) falhas.push(`${quem}: tem imagem dentro (D58)`)
    })
    return { total: avatares.length, falhas }
  })
}

/**
 * Confere cada avatar de `raiz` (a página ou um pedaço dela) e devolve quantos eram. Sem avatar nenhum falha: o caso que
 * passa vazio não prova nada.
 */
export async function conferirAssinaturas(raiz: Locator | Page): Promise<number> {
  const { total, falhas } = await avaliarAssinaturas(raiz)
  expect(total, 'nenhum avatar na tela: o caso passaria vazio').toBeGreaterThan(0)
  expect(falhas, 'todo avatar assina: o nome da função e um selo "IA" no mesmo bloco').toEqual([])
  return total
}

/**
 * Nada que se acesse na página se chama "onça": nem o nome de um agente, nem de uma imagem, nem de uma região. A onça é
 * desenho, e quem assina é a função (D58; regra 70, item 4a).
 */
export async function conferirQueAOncaNaoTemNome(page: Page): Promise<void> {
  const arvore = await page.locator('body').ariaSnapshot()
  expect(arvore, 'algum nome acessível da tela cita a onça').not.toMatch(/onça/i)
  await expect(page.locator('[aria-label*="onça" i], [title*="onça" i], [alt*="onça" i]')).toHaveCount(0)
  await expect(page.getByRole('img', { name: /onça/i })).toHaveCount(0)
}

/** Nenhum nó do avatar nem do que está ao lado dele anima ou faz transição: a onça fica parada (D59). */
export async function conferirQueOAvatarFicaParado(raiz: Locator | Page): Promise<number> {
  const nos = await raiz.locator('[data-agente], [data-agente] *').evaluateAll((elementos) =>
    elementos.map((elemento) => {
      const estilo = getComputedStyle(elemento)
      return { animacao: estilo.animationName, transicao: estilo.transitionDuration, nome: `${elemento.tagName.toLowerCase()}` }
    }),
  )
  expect(nos.length, 'nenhum nó de avatar: o caso passaria vazio').toBeGreaterThan(0)
  expect(nos.filter(({ animacao }) => animacao !== 'none')).toEqual([])
  expect(nos.filter(({ transicao }) => transicao.split(',').some((duracao) => duracao.trim() !== '0s'))).toEqual([])
  return nos.length
}

/**
 * Todo avatar de `raiz` é um quadrado de `tamanho` px: o cartão de agente da coordenação e o cabeçalho do Analista são de
 * 48 px (`docs/interface.md` 9.7). Devolve quantos conferiu; sem avatar nenhum o caso passaria vazio.
 */
export async function conferirTamanhoDoAvatar(raiz: Locator | Page, tamanho: number): Promise<number> {
  const avatares = raiz.locator('[data-agente]')
  const total = await avatares.count()
  expect(total, 'nenhum avatar na tela: o caso passaria vazio').toBeGreaterThan(0)
  for (let indice = 0; indice < total; indice++) {
    const caixa = await avatares.nth(indice).boundingBox()
    expect(caixa, `avatar #${String(indice)}`).not.toBeNull()
    expect({ largura: caixa?.width, altura: caixa?.height }, `avatar #${String(indice)}: ${String(tamanho)} px`).toEqual({ largura: tamanho, altura: tamanho })
  }
  return total
}
