// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { semIdsDoDesenho } from '../../../__fixtures__/svg-ids'
import { arquivosDeCodigoDaWeb, codigoSemComentarioNemTexto } from '../../../__fixtures__/danger-solid'
import { CabecaOnca, type TamanhoDaCabeca } from './CabecaOnca'

/**
 * A cabeça da onça (RF10 da X1; `docs/interface.md` 9.7; D58, D59; regra 70, itens 4a e 4b): um desenho só, parado, sem
 * nome. O que o navegador pinta — o círculo, o anel, o fundo — é do `AvatarAgente`; aqui está o que o `jsdom` sabe: o
 * SVG como ele é, e o que ele não tem.
 */
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const TAMANHOS: readonly TamanhoDaCabeca[] = [24, 32, 40, 48]
const RAIZ_DA_WEB = join(import.meta.dirname, '..', '..', '..')
const RAIZ_DO_REPOSITORIO = join(RAIZ_DA_WEB, '..', '..', '..')

/** As nove cores da 9.7, lidas do documento: o desenho obedece a ele, e não a uma cópia que o teste faria. */
function coresDaOnca(): Set<string> {
  const documento = readFileSync(join(RAIZ_DO_REPOSITORIO, 'docs', 'interface.md'), 'utf8')
  const inicio = documento.indexOf('### 9.7 A onça e o avatar dos agentes')
  const fim = documento.indexOf('**O avatar** (`AvatarAgente`)', inicio)
  expect(inicio, 'a 9.7 do documento mudou de lugar').toBeGreaterThan(-1)
  expect(fim, 'a 9.7 do documento mudou de lugar').toBeGreaterThan(inicio)
  return new Set([...documento.slice(inicio, fim).matchAll(/#[0-9A-Fa-f]{6}\b/g)].map(([cor]) => cor.toUpperCase()))
}

function desenhar(tamanho: TamanhoDaCabeca) {
  return render(<CabecaOnca tamanho={tamanho} />)
}

describe('CabecaOnca', () => {
  it('é um SVG só, escondido da leitura de tela, sem título, sem descrição, sem nome e sem texto', () => {
    for (const tamanho of TAMANHOS) {
      const { container, unmount } = desenhar(tamanho)
      const svg = container.querySelector('svg')
      expect(container.querySelectorAll('svg'), String(tamanho)).toHaveLength(1)
      expect(svg?.getAttribute('aria-hidden'), String(tamanho)).toBe('true')
      expect(svg?.getAttribute('focusable'), String(tamanho)).toBe('false')
      // "Onça" não é o nome de agente nenhum: o desenho não diz nada, e quem assina é a função ao lado.
      expect(container.querySelectorAll('title, desc, text, tspan'), String(tamanho)).toHaveLength(0)
      for (const atributo of ['aria-label', 'aria-labelledby', 'aria-describedby', 'role', 'title', 'alt']) expect(svg?.hasAttribute(atributo), `${tamanho} ${atributo}`).toBe(false)
      expect(container.textContent, String(tamanho)).toBe('')
      unmount()
    }
  })

  it('o tamanho é só o tamanho: a mesma cabeça nos quatro, e só a roseta da testa sai abaixo de 40 px', () => {
    const formas = new Map<TamanhoDaCabeca, string>()
    for (const tamanho of TAMANHOS) {
      const { container, unmount } = desenhar(tamanho)
      const svg = container.querySelector('svg') as SVGElement
      expect(svg.getAttribute('width')).toBe(String(tamanho))
      expect(svg.getAttribute('height')).toBe(String(tamanho))
      // O recorte do mockup: as orelhas inteiras, e a máscara a 9 unidades das bordas.
      expect(svg.getAttribute('viewBox')).toBe('44 32 152 152')
      formas.set(tamanho, semIdsDoDesenho(svg.innerHTML))
      unmount()
    }
    expect(formas.get(24)).toBe(formas.get(32))
    expect(formas.get(40)).toBe(formas.get(48))
    expect(formas.get(40)).not.toBe(formas.get(24))
    // A única diferença é a roseta da testa: a pinta da marca, girada, a partir de 40 px.
    const rosetas = (tamanho: TamanhoDaCabeca) => {
      const { container, unmount } = desenhar(tamanho)
      const quantas = container.querySelectorAll('use').length
      unmount()
      return quantas
    }
    expect(TAMANHOS.map(rosetas)).toEqual([0, 0, 1, 1])
  })

  it('toda referência do desenho (`url(#…)` e `href="#…"`) aponta para um `id` que existe nele', () => {
    for (const tamanho of TAMANHOS) {
      const { container, unmount } = desenhar(tamanho)
      const ids = new Set([...container.querySelectorAll('[id]')].map((no) => no.id))
      const alvos = [...container.innerHTML.matchAll(/url\(#([^)]+)\)|href="#([^"]+)"/g)].map(([, a, b]) => a ?? b ?? '')
      expect(alvos.length, String(tamanho)).toBeGreaterThanOrEqual(2)
      expect(alvos.filter((alvo) => !ids.has(alvo)), String(tamanho)).toEqual([])
      unmount()
    }
  })

  it('dois renders do mesmo tamanho dão o mesmo HTML: nada muda com o tempo, com a ordem nem com quem usa', () => {
    for (const tamanho of TAMANHOS) {
      const primeiro = desenhar(tamanho)
      const html = semIdsDoDesenho(primeiro.container.innerHTML)
      primeiro.unmount()
      const segundo = desenhar(tamanho)
      expect(semIdsDoDesenho(segundo.container.innerHTML), String(tamanho)).toBe(html)
      segundo.unmount()
    }
  })

  it('está parada: nenhum `animate`, nenhum `style`, nenhuma classe de animação ou de transição, e nenhum temporizador', () => {
    vi.useFakeTimers()
    const { container } = desenhar(48)
    expect(vi.getTimerCount()).toBe(0)
    expect(container.querySelectorAll('animate, animateTransform, animateMotion, set, style, script, foreignObject, image')).toHaveLength(0)
    for (const elemento of container.querySelectorAll('*')) {
      expect(elemento.hasAttribute('style'), elemento.outerHTML).toBe(false)
      expect(elemento.getAttribute('class') ?? '', elemento.outerHTML).not.toMatch(/animate|transition|duration|delay|pulse|spin|bounce|ping/)
      for (const { name } of elemento.attributes) expect(name, elemento.outerHTML).not.toMatch(/^(?:on|begin|dur$|repeatCount|attributeName)/)
    }
  })

  it('são as cores da 9.7, sem degradê, e a única linha é o "w" da boca: sem contorno', () => {
    const permitidas = coresDaOnca()
    expect(permitidas.size, 'a 9.7 declara nove cores fixas').toBe(9)
    const { container } = desenhar(48)
    const usadas = new Set<string>()
    for (const elemento of container.querySelectorAll('[fill], [stroke]')) {
      for (const atributo of ['fill', 'stroke'] as const) {
        const valor = elemento.getAttribute(atributo)
        if (valor !== null && valor !== 'none') usadas.add(valor.toUpperCase())
      }
    }
    expect([...usadas].filter((cor) => !permitidas.has(cor))).toEqual([])
    // As sete que a cabeça desenha: a sombra é das patas e do rabo, e a língua é da boca aberta, que não existe aqui.
    expect(usadas.size).toBe(7)
    expect(usadas.has('#D75F18')).toBe(false)
    expect(usadas.has('#FF9FB0')).toBe(false)
    // A pinta e os recortes são `defs` e `use`: a roseta e o olho. Degradê, filtro, máscara e padrão, nenhum; e o único `url(#…)` é o do recorte.
    expect(container.querySelectorAll('linearGradient, radialGradient, filter, mask, pattern')).toHaveLength(0)
    expect([...container.innerHTML.matchAll(/url\(([^)]*)\)/g)].every(([, alvo = '']) => alvo.startsWith('#'))).toBe(true)
    for (const elemento of container.querySelectorAll('[style], [filter], [mask]')) expect(elemento.outerHTML).toBe('')
    // Contorno em forma nenhuma: a única que tem `stroke` é a boca, que é uma linha e não tem preenchimento.
    const comTraco = [...container.querySelectorAll('[stroke]')]
    expect(comTraco.map((elemento) => elemento.tagName.toLowerCase())).toEqual(['path'])
    expect(comTraco[0]?.getAttribute('fill')).toBe('none')
  })

  it('cada cor está na parte dela: o realce no miolo da orelha e na máscara, o creme no focinho, o branco no olho, e o resto', () => {
    const { container } = desenhar(48)
    // [seletor da parte, quantas são, a cor dela na 9.7]. Trocar o realce pela pelagem, ou o creme pelo nariz, deixa vermelho.
    const partes: readonly (readonly [string, number, string])[] = [
      ['circle[r="22"]', 2, '#E8732E'], // as orelhas, de pelagem
      ['circle[r="11"]', 2, '#ED935D'], // o miolo da orelha, de realce
      ['circle[r="38"]', 2, '#ED935D'], // a máscara clara
      ['rect[x="98"][width="44"]', 1, '#FDEBDD'], // o focinho, em creme
      ['g > rect[width="38"], g > rect[width="40"]', 2, '#FFFFFF'], // o branco do olho
      ['rect[data-parte="pupila"]', 2, '#16233E'], // a pupila
      ['circle[r="5"]', 2, '#FFFFFF'], // o brilho
    ]
    for (const [seletor, quantas, cor] of partes) {
      const achadas = [...container.querySelectorAll(seletor)]
      expect(achadas, seletor).toHaveLength(quantas)
      for (const parte of achadas) expect(parte.getAttribute('fill')?.toUpperCase(), seletor).toBe(cor)
    }
    // O topo do corpo é de pelagem; o nariz, de `nariz`; a roseta (a pinta girada) é de `roseta`; a boca é o traço, na cor da pupila.
    const topo = [...container.querySelectorAll('path[fill]')].map((no) => no.getAttribute('fill')?.toUpperCase())
    expect(topo.filter((cor) => cor === '#E8732E')).toHaveLength(1)
    expect(topo.filter((cor) => cor === '#E5838C')).toHaveLength(1)
    expect(container.querySelector('use')?.parentElement?.getAttribute('fill')?.toUpperCase()).toBe('#7A3412')
    expect(container.querySelector('path[stroke]')?.getAttribute('stroke')?.toUpperCase()).toBe('#16233E')
  })

  it('só tem a prop `tamanho`, e `tamanho` só aceita os quatro valores do avatar', () => {
    // @ts-expect-error a cabeça é um desenho só: nenhuma pose
    render(<CabecaOnca tamanho={24} pose="acenando" />)
    // @ts-expect-error nenhum "pensando", e nenhum temporizador por trás dele
    render(<CabecaOnca tamanho={24} pensando />)
    // @ts-expect-error nenhum humor nem expressão que mude com quem usa
    render(<CabecaOnca tamanho={24} humor="feliz" />)
    // @ts-expect-error o tamanho é um dos quatro do avatar
    render(<CabecaOnca tamanho={20} />)
    // @ts-expect-error sem `tamanho` não há desenho: quem decide o tamanho é o avatar
    render(<CabecaOnca />)
  })
})

describe('a pasta da onça', () => {
  const daPasta = arquivosDeCodigoDaWeb(RAIZ_DA_WEB).filter((nome) => nome.startsWith('components/ui/onca/'))

  // O `useId` fica de fora de propósito: ele só dá um `id` único a cada desenho (a pinta, o recorte), e não guarda estado. Quem
  // pode ter temporizador, efeito e estado é um arquivo só, `movimento-da-onca.ts`, que o acenar da onça de corpo
  // inteiro usa (`movimento-da-onca.test.tsx`): a cabeça do avatar e todo o resto da pasta ficam parados.
  it('não tem temporizador, efeito nem estado fora de `movimento-da-onca.ts`: `setTimeout`, `setInterval`, `useEffect` e `useState` não aparecem', () => {
    // Sem esta âncora o caso passaria vazio no dia em que a pasta mudasse de nome.
    expect(daPasta).toContain('components/ui/onca/CabecaOnca.tsx')
    expect(daPasta).toContain('components/ui/onca/movimento-da-onca.ts')
    for (const nome of daPasta.filter((arquivo) => arquivo !== 'components/ui/onca/movimento-da-onca.ts')) {
      const codigo = codigoSemComentarioNemTexto(readFileSync(join(RAIZ_DA_WEB, nome), 'utf8'))
      expect(codigo, nome).not.toMatch(/\b(?:setTimeout|setInterval|requestAnimationFrame|useEffect|useLayoutEffect|useState|useReducer|useRef)\b/)
    }
  })

  it('não escreve animação nem transição: nem classe, nem `style`, nem `<animate>`', () => {
    for (const nome of daPasta) {
      const fonte = readFileSync(join(RAIZ_DA_WEB, nome), 'utf8')
      expect(fonte, nome).not.toMatch(/<animate|<set\b|\bstyle=|\banimate-|\btransition|\banimation\b/)
    }
  })
})
