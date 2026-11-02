// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CenaDaOnca } from './CenaDaOnca'
import { esquecerQueAcenou } from './movimento-da-onca'

/**
 * O cenário da onça da marca (`docs/interface.md` 9.7, "O cenário da onça da marca"; D80 revista em 30/10/2026, às 21:45): um canto
 * de sala de aula, parado e sem texto, com a onça da marca por cima. Aqui está o que o `jsdom` sabe: o que o desenho tem e o que ele
 * não pode ter. Onde ele cai no painel, o tamanho medido, o contraste da lousa e a foto nos dois temas são do e2e
 * (`casca-publica.spec.ts`).
 */
afterEach(() => {
  cleanup()
  esquecerQueAcenou()
})

const DOCUMENTO = readFileSync(join(import.meta.dirname, '..', '..', '..', '..', '..', '..', 'docs', 'interface.md'), 'utf8')
const CODIGO = readFileSync(join(import.meta.dirname, 'CenaDaOnca.tsx'), 'utf8')

/** Os tokens de cor que a 9.7 permite ao cenário: a tabela "Objeto | Token", lida do documento, e não copiada para cá. */
function coresDaTabela(): string[] {
  const secao = DOCUMENTO.slice(DOCUMENTO.indexOf('**O cenário da onça da marca'), DOCUMENTO.indexOf('### 9.8'))
  const linhas = secao.split('\n').filter((linha) => /^\s*\|/.test(linha) && !/^\s*\|\s*(?:Objeto|-)/.test(linha))
  return [...new Set(linhas.flatMap((linha) => [...linha.matchAll(/`([a-z-]+)`/g)].map(([, token = '']) => token)))]
}

const desenhar = () => {
  const { container } = render(<CenaDaOnca />)
  const figura = container.querySelector('figure[data-cena-da-onca]') as HTMLElement
  const cenario = figura.querySelector(':scope > svg') as SVGElement
  return { container, figura, cenario }
}

describe('CenaDaOnca: sem nome, sem texto, sem movimento próprio', () => {
  it('a figura é escondida da leitura de tela, tem 432 × 300 e cabe no painel', () => {
    const { figura, cenario } = desenhar()
    expect(figura.getAttribute('aria-hidden')).toBe('true')
    const classes = (figura.getAttribute('class') ?? '').split(/\s+/)
    for (const classe of ['w-108', 'h-75', 'max-w-full']) expect(classes, classe).toContain(classe)
    expect(cenario.getAttribute('width')).toBe('432')
    expect(cenario.getAttribute('height')).toBe('300')
    expect(cenario.getAttribute('viewBox')).toBe('0 0 432 300')
    expect(figura.querySelectorAll('figcaption, [data-onca-assinatura], [data-selo-ia]')).toHaveLength(0)
    expect(figura.textContent).toBe('')
  })

  it('o SVG do cenário não tem texto, nome, papel, animação, filtro, degradê nem recorte', () => {
    const { cenario } = desenhar()
    const proibidos = 'text, tspan, title, desc, animate, animateTransform, animateMotion, set, role, filter, linearGradient, radialGradient, clipPath, mask, use, image, style, script, foreignObject'
    expect(cenario.querySelectorAll(proibidos)).toHaveLength(0)
    for (const no of [cenario, ...cenario.querySelectorAll('*')]) {
      for (const atributo of ['role', 'aria-label', 'aria-labelledby', 'id', 'filter', 'clip-path']) expect(no.hasAttribute(atributo), `${no.tagName} ${atributo}`).toBe(false)
    }
  })

  it('nenhum elemento da figura tem `style`, e o cenário não tem classe de animação nem de transição', () => {
    const { figura, cenario } = desenhar()
    for (const no of figura.querySelectorAll('*')) expect(no.hasAttribute('style'), no.outerHTML.slice(0, 80)).toBe(false)
    for (const no of [cenario, ...cenario.querySelectorAll('*')]) {
      expect(no.getAttribute('class') ?? '', no.outerHTML.slice(0, 80)).not.toMatch(/animate|animation|transition|duration|onca-(?:entra|acena|comemora|animada)/)
    }
    expect(CODIGO.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/\b(?:setTimeout|setInterval|requestAnimationFrame|useEffect|useLayoutEffect|useState|useReducer|useRef|onMouse|onFocus|onChange|onPointer)\w*/)
  })

  it('a cor é só classe de preenchimento e de traço de token da tabela da 9.7: nenhum hex, nenhum token que inverte entre os temas', () => {
    const { cenario } = desenhar()
    const permitidos = coresDaTabela()
    // Sem a tabela lida, o caso passaria vazio.
    expect(permitidos).toEqual(expect.arrayContaining(['verde-degrau', 'white', 'laranja-degrau', 'roxo-degrau', 'turquesa-degrau', 'rosa-degrau', 'lima-degrau', 'amarelo-degrau', 'onca-chao']))
    const usados = new Set<string>()
    for (const no of [cenario, ...cenario.querySelectorAll('*')]) {
      for (const classe of (no.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)) {
        if (/^(?:fill|stroke)-/.test(classe)) usados.add(classe.replace(/^(?:fill|stroke)-/, ''))
        // Nada de opacidade, valor solto nem utilitário de cor que não seja o par `fill-`/`stroke-`.
        expect(classe, `a classe ${classe} não é de cor da tabela`).not.toMatch(/\/|\[|^(?:bg|text|border|opacity|shadow)-/)
      }
      for (const atributo of ['fill', 'stroke']) {
        const valor = no.getAttribute(atributo)
        if (valor !== null) expect(valor, `${no.tagName} ${atributo}`).toBe('none')
      }
    }
    expect([...usados].filter((token) => !permitidos.includes(token))).toEqual([])
    for (const token of usados) expect(token, 'invertem entre os temas').not.toMatch(/grafite|noite|-texto$|-claro$|sobre-cor/)
    expect(usados.size).toBeGreaterThanOrEqual(8)
  })

  it('os livros são três e só usam roxo, turquesa e rosa: nunca o trio dos agentes nem cor de estado', () => {
    const { cenario } = desenhar()
    const livros = [...cenario.querySelectorAll('[data-livro]')]
    expect(livros.map((livro) => livro.getAttribute('class'))).toEqual(['fill-rosa-degrau', 'fill-turquesa-degrau', 'fill-roxo-degrau'])
    for (const livro of livros) {
      expect(livro.getAttribute('class') ?? '').not.toMatch(/laranja|azul|anil|verde|vermelho|amarelo/)
      expect(livro.getAttribute('height'), 'cada livro tem 22 px').toBe('22')
    }
    // A pilha sobe de 22 em 22, e o topo do livro de cima fica em y 222, onde cai a sombra da onça.
    expect(livros.map((livro) => Number(livro.getAttribute('y')))).toEqual([266, 244, 222])
  })

  it('a lousa só tem triângulo, círculo e linha ondulada em giz: nenhum glifo, e todas as marcas ficam dentro do quadro de x 0–168', () => {
    const { cenario } = desenhar()
    const giz = cenario.querySelector('[data-giz]') as SVGElement
    expect(giz.getAttribute('class')).toBe('stroke-white')
    expect([...giz.children].map((marca) => marca.tagName.toLowerCase())).toEqual(['path', 'circle', 'path'])
    const [triangulo, circulo, onda] = [...giz.children] as [SVGElement, SVGElement, SVGElement]
    // O triângulo é fechado e tem três pontos; a onda é só curvas relativas, sem fechar.
    expect(triangulo.getAttribute('d')).toMatch(/^M\d+ \d+L\d+ \d+L\d+ \d+Z$/)
    expect(onda.getAttribute('d')).toMatch(/^M\d+ \d+q[-\d ]+(?:t[-\d ]+)+$/)
    expect(onda.getAttribute('d')).not.toMatch(/Z/i)
    const [cx, r] = [Number(circulo.getAttribute('cx')), Number(circulo.getAttribute('r'))]
    expect(cx + r + 2, 'o círculo cabe no quadro da lousa').toBeLessThanOrEqual(168)
    for (const x of (triangulo.getAttribute('d') ?? '').matchAll(/[ML](\d+) /g)) expect(Number(x[1])).toBeLessThanOrEqual(168)
    // A onda é relativa: o fim dela é o ponto de partida mais o deslocamento em x de cada curva (o 3º número do `q`, o 1º de cada `t`).
    const caminho = onda.getAttribute('d') ?? ''
    const inicio = Number(/^M(\d+) /.exec(caminho)?.[1])
    const deslocamentos = [...caminho.matchAll(/([qt])([-\d. ]+)/g)].map(([, comando, numeros = '']) => Number(numeros.trim().split(/\s+|(?=-)/).filter(Boolean)[comando === 'q' ? 2 : 0]))
    expect(deslocamentos, 'uma curva `q` e as `t` que a seguem').toHaveLength(4)
    expect(inicio + deslocamentos.reduce((soma, passo) => soma + passo, 0) + 2, 'o fim da onda, com a espessura do giz, cabe no quadro da lousa').toBeLessThanOrEqual(168)
    // A moldura da lousa é o `[data-lousa]`, de x 0 a 168: o giz fica dentro dela.
    const moldura = cenario.querySelector('[data-lousa]') as SVGElement
    expect([Number(moldura.getAttribute('x')), Number(moldura.getAttribute('width'))]).toEqual([0, 168])
    // A pinta da marca duplicaria o `id` da roseta da onça: não entra, nem nenhuma estrela.
    expect(cenario.innerHTML).not.toMatch(/<use|<polygon|<polyline/)
  })

  it('pesa pouco: até 40 nós e 3 kB', () => {
    const { cenario } = desenhar()
    const nos = 1 + cenario.querySelectorAll('*').length
    expect(nos, 'nós do SVG do cenário').toBeLessThanOrEqual(40)
    expect(nos).toBeGreaterThan(15)
    expect(cenario.outerHTML.length, 'bytes do SVG do cenário').toBeLessThanOrEqual(3000)
  })
})

describe('CenaDaOnca: a onça vem por cima, é a da marca e acena', () => {
  it('a onça tem 240 px, na pose `acenando`, sem `data-onca`, legenda nem selo, e está depois do cenário', () => {
    const { figura, cenario } = desenhar()
    const oncas = figura.querySelectorAll('[data-onca-da-marca]')
    expect(oncas).toHaveLength(1)
    const onca = oncas[0] as HTMLElement
    expect(onca.getAttribute('data-pose')).toBe('acenando')
    expect(onca.getAttribute('aria-hidden')).toBe('true')
    expect(onca.querySelector('svg')?.getAttribute('width')).toBe('240')
    expect(onca.querySelector('svg')?.getAttribute('height')).toBe('240')
    expect(figura.querySelectorAll('[data-onca], figcaption, [data-selo-ia], [data-onca-assinatura]')).toHaveLength(0)
    // Por cima: vem depois do SVG do cenário, e a pata que acena é a única coisa com movimento da figura.
    expect(cenario.compareDocumentPosition(onca) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(figura.querySelectorAll('.onca-entra')).toHaveLength(1)
    expect(figura.querySelectorAll('.onca-acena')).toHaveLength(1)
    expect([...figura.querySelectorAll('.onca-entra, .onca-acena, .onca-animada')].every((no) => onca.contains(no))).toBe(true)
  })

  it('o quadro da onça é o de x 184–424 e y 0–240, de frente para quem chega', () => {
    const { figura } = desenhar()
    const caixa = figura.querySelector('[data-onca-da-marca]')?.parentElement as HTMLElement
    const classes = (caixa.getAttribute('class') ?? '').split(/\s+/)
    expect(classes).toEqual(expect.arrayContaining(['absolute', 'top-0']))
    // O `left-N` do Tailwind é N × 4 px: lê-se a classe do componente, e a conta sai dela e da largura do desenho da onça.
    const esquerda = Number(/^left-(\d+)$/.exec(classes.find((classe) => /^left-\d+$/.test(classe)) ?? '')?.[1]) * 4
    const largura = Number(figura.querySelector('[data-onca-da-marca] svg')?.getAttribute('width'))
    expect(esquerda, 'a onça começa em x 184').toBe(184)
    expect(esquerda + largura, 'e termina em x 424, dentro dos 432 da figura').toBe(424)
    expect(esquerda + largura).toBeLessThanOrEqual(Number(figura.querySelector(':scope > svg')?.getAttribute('width')))
  })
})
