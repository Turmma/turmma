import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * O que o teste de componente usa para dizer **a cor de uma classe, por tema**. O `jsdom` não carrega o CSS do Tailwind:
 * ele sabe que o campo tem `border-borda-campo`, mas não sabe qual é a cor disso em cada tema. Aqui o nome da classe vira
 * o token, e o token vira o valor que `index.css` declara para o tema, que é a mesma fonte do teste de contraste
 * (`contraste.test.ts`). Trocar `border-borda-campo` por `border-borda` deixa o 3:1 vermelho nos dois temas, sem precisar
 * de navegador.
 *
 * O que isto **não** vê: a cor que o navegador calcula depois da cascata (a sombra do degrau, a variante que ganha de
 * outra, o afastamento do anel de foco). Isso é do e2e da galeria (`e2e/pecas-*.spec.ts`), que mede o estilo calculado.
 */

export type Tema = 'claro' | 'escuro'
export const TEMAS: readonly Tema[] = ['claro', 'escuro']

function miolo(texto: string, inicio: number): string {
  const abertura = texto.indexOf('{', inicio)
  let profundidade = 0
  for (let posicao = abertura; posicao < texto.length; posicao++) {
    if (texto[posicao] === '{') profundidade++
    else if (texto[posicao] === '}' && --profundidade === 0) return texto.slice(abertura + 1, posicao)
  }
  throw new Error('bloco de CSS sem fechamento')
}

function paleta(bloco: string): Map<string, string> {
  return new Map([...bloco.matchAll(/--color-([a-z]+(?:-[a-z0-9]+)*)\s*:\s*(#[0-9a-fA-F]{6})\b/g)].map(([, nome = '', cor = '']) => [nome, cor.toLowerCase()]))
}

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.css'), 'utf8')

const CORES: Record<Tema, Map<string, string>> = {
  claro: paleta(miolo(css, css.indexOf('@theme static'))),
  escuro: paleta(miolo(css, css.search(/:root\[data-tema='escuro'\]\s*\{/))),
}

/** O valor de um token no tema. Token que o tema não declara é erro do teste, e não um par que passa calado. */
export function corDoToken(tema: Tema, token: string): string {
  const cor = CORES[tema].get(token)
  if (cor === undefined) throw new Error(`o token ${token} não existe em index.css no tema ${tema}`)
  return cor
}

function luminancia(cor: string): number {
  const canais = [1, 3, 5].map((posicao) => {
    const canal = Number.parseInt(cor.slice(posicao, posicao + 2), 16) / 255
    return canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * (canais[0] ?? 0) + 0.7152 * (canais[1] ?? 0) + 0.0722 * (canais[2] ?? 0)
}

/** A razão de contraste da WCAG 2.1 entre duas cores de seis dígitos, de 1 a 21. */
export function contraste(uma: string, outra: string): number {
  const [clara = 0, escura = 0] = [luminancia(uma), luminancia(outra)].sort((a, b) => b - a)
  return (clara + 0.05) / (escura + 0.05)
}

/** As classes do elemento, em conjunto. */
export function classesDo(elemento: Element): Set<string> {
  return new Set((elemento.getAttribute('class') ?? '').split(/\s+/).filter((classe) => classe !== ''))
}

/**
 * O token que a classe de cor do elemento nomeia: `border-borda-campo` é `borda-campo` para a propriedade `border`. O
 * `prefixo` é a variante com os dois pontos (`disabled:`, `aria-invalid:`), e vazio para o estado normal. Só vale nome que
 * é token: `border-2` e `text-base` não são cor, e `bg-campo` é.
 */
export function tokenDe(elemento: Element, propriedade: 'bg' | 'border' | 'text', prefixo = ''): string | undefined {
  const comeco = `${prefixo}${propriedade}-`
  for (const classe of classesDo(elemento)) {
    if (!classe.startsWith(comeco)) continue
    const nome = classe.slice(comeco.length)
    if (CORES.claro.has(nome)) return nome
  }
  return undefined
}

/** O mesmo que `tokenDe`, para quem não aceita `undefined`: peça que não diz a cor falha com o nome do elemento. */
export function tokenOuFalha(elemento: Element, propriedade: 'bg' | 'border' | 'text', prefixo = ''): string {
  const token = tokenDe(elemento, propriedade, prefixo)
  if (token === undefined) throw new Error(`o elemento <${elemento.tagName.toLowerCase()}> não tem classe ${prefixo}${propriedade}-<token>: ${[...classesDo(elemento)].join(' ')}`)
  return token
}
