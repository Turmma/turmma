// @vitest-environment jsdom
import { AGENTES } from '@educa/shared'
import { cleanup, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { stripSvgIds } from '../../../__fixtures__/svg-ids'
import { webSourceFiles, codeWithoutCommentsOrText } from '../../../__fixtures__/danger-solid'
import { Onca, POSES, type Pose, type TamanhoDaOnca } from './Onca'

/**
 * A onça de corpo inteiro (tarefa 5.0 da X4; RF19; `docs/interface.md` 9.7; D58, D59; regra 70, itens 4a e 4b): quatro poses,
 * cada uma com o rosto do mockup, sempre com a função e o selo "IA". Aqui o desenho é conferido parado (`animada={false}`); o
 * movimento está em `movimento-da-onca.test.tsx`. O que o navegador pinta é do
 * e2e (`introducao-components.spec.ts`); aqui está o que o `jsdom` sabe: o SVG como ele é, e o que ele não tem.
 */
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const TAMANHOS: readonly TamanhoDaOnca[] = [88, 120, 160]
const RAIZ_DA_WEB = join(import.meta.dirname, '..', '..', '..')
const RAIZ_DO_REPOSITORIO = join(RAIZ_DA_WEB, '..', '..', '..')

/** As nove cores da 9.7, lidas do documento: o desenho obedece a ele, e não a uma cópia que o teste faria. */
function coresDaOnca(): Set<string> {
  const documento = readFileSync(join(RAIZ_DO_REPOSITORIO, 'docs', 'interface.md'), 'utf8')
  const inicio = documento.indexOf('### 9.7 A onça e o avatar dos agentes')
  const fim = documento.indexOf('**O avatar** (`AgentAvatar`)', inicio)
  expect(inicio, 'a 9.7 do documento mudou de lugar').toBeGreaterThan(-1)
  return new Set([...documento.slice(inicio, fim).matchAll(/#[0-9A-Fa-f]{6}\b/g)].map(([cor]) => cor.toUpperCase()))
}

function desenhar(pose: Pose, agente: (typeof AGENTES)[number] = 'tutor', tamanho: TamanhoDaOnca = 120) {
  return render(<Onca pose={pose} agente={agente} tamanho={tamanho} animada={false} />)
}

describe('Onca: as poses', () => {
  it('são quatro: acenando, apontando, comemorando e pensando. Não existem "acolhendo" nem "dormindo"', () => {
    expect([...POSES]).toEqual(['acenando', 'apontando', 'comemorando', 'pensando'])
    for (const pose of POSES) {
      const { container, unmount } = desenhar(pose)
      expect(container.querySelector('[data-onca]')?.getAttribute('data-pose')).toBe(pose)
      unmount()
    }
    // Só o compilador as recusa: a função não roda, porque a pose não tem braços a desenhar.
    void (() =>
      // @ts-expect-error a expressão de preocupação não entra no produto (D80, item 3)
      render(<Onca pose="acolhendo" agente="tutor" tamanho={120} />))
    void (() =>
      // @ts-expect-error o vazio com a onça dormindo ainda não tem lugar no produto
      render(<Onca pose="dormindo" agente="tutor" tamanho={120} />))
  })

  it('as quatro poses dão quatro desenhos diferentes', () => {
    const desenhos = new Set<string>()
    for (const pose of POSES) {
      const { container, unmount } = desenhar(pose)
      desenhos.add(stripSvgIds(container.querySelector('svg')?.innerHTML ?? ''))
      unmount()
    }
    expect(desenhos.size).toBe(POSES.length)
  })

  // O rosto de cada pose é o do mockup (os valores estão congelados em `fidelidade-ao-mockup.test.tsx`). Só a cabeça do avatar é
  // sempre neutra. [pose, trecho que só o rosto dela tem, trecho que o rosto dela não pode ter, x e y da pupila esquerda
  // (vazio: olhos fechados em arco, sem pupila), se leva a pálpebra baixa].
  const BOCA_W = 'M110 147 Q115 152 120 146 Q125 152 130 147'
  const ROSTO_DA_POSE: readonly (readonly [Pose, string, string, string, boolean])[] = [
    ['acenando', 'M109 146 Q121 150 133 145 Q133 158 122 160 Q110 160 109 146 Z', BOCA_W, '82,99', false],
    ['apontando', 'M111 147 Q122 155 133 145', BOCA_W, '85,97', false],
    ['comemorando', 'M76 116 Q90 96 104 116', BOCA_W, '', false],
    ['pensando', 'M121 150 Q127 152 131 147', 'M111 147 Q122 155 133 145', '84,86', true],
  ]

  /** O rosto confere com o que o mockup dá à pose? Boca, olhar e pálpebra, lidos do HTML do rosto. */
  function rostoConfere(pose: Pose, rosto: string): boolean {
    const linha = ROSTO_DA_POSE.find(([nome]) => nome === pose)
    if (linha === undefined) throw new Error(`pose sem linha: ${pose}`)
    const [, proprio, alheio, pupila, palpebra] = linha
    const no = document.createElement('div')
    no.innerHTML = rosto
    const medidas = no.querySelector('rect[data-parte="pupila"]')?.outerHTML.match(/x="(\d+)" y="(\d+)"/)?.slice(1, 3).join(',') ?? ''
    return rosto.includes(proprio) && !rosto.includes(alheio) && medidas === pupila && (no.querySelector('g[clip-path$="-abre)"]') !== null) === palpebra
  }
  const rostoDa = (pose: Pose): string => {
    const { container, unmount } = desenhar(pose)
    const rosto = container.querySelectorAll('[data-rosto]')
    expect(rosto, pose).toHaveLength(1)
    const html = rosto[0]?.innerHTML ?? ''
    unmount()
    return html
  }

  it('o rosto de cada pose é o do mockup para ela: boca, olhar e pálpebra, e nenhum rosto vem de quem usa', () => {
    for (const [pose] of ROSTO_DA_POSE) expect(rostoConfere(pose, rostoDa(pose)), pose).toBe(true)
  })

  it('a conferência do rosto é de verdade: o rosto de outra pose, ou um rosto adulterado, não passa', () => {
    for (const [pose] of ROSTO_DA_POSE) {
      for (const [outra] of ROSTO_DA_POSE) {
        if (outra !== pose) expect(rostoConfere(pose, rostoDa(outra)), `${pose} com o rosto de ${outra}`).toBe(false)
      }
    }
    const apontando = rostoDa('apontando')
    expect(rostoConfere('apontando', apontando.replace('M111 147 Q122 155 133 145', BOCA_W)), 'boca trocada').toBe(false)
    expect(rostoConfere('apontando', apontando.replace('x="85" y="97"', 'x="82" y="99"')), 'olhar trocado').toBe(false)
  })

  it('no `pensando` só o olho direito leva a pálpebra baixa: o esquerdo fica aberto', () => {
    const { container } = desenhar('pensando')
    expect(container.querySelectorAll('g[clip-path$="-abre)"]')).toHaveLength(1)
    expect(container.querySelectorAll('g[clip-path$="-abre)"] > [data-parte="olho-d"]')).toHaveLength(1)
    expect(container.querySelectorAll('g[clip-path$="-abre)"] [data-parte="olho-e"]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-parte="olho-e"]')).toHaveLength(1)
  })

  it('toda referência do desenho, de `url` e de `href`, aponta para um `id` que existe nele, em cada pose', () => {
    for (const pose of POSES) {
      const { container, unmount } = desenhar(pose)
      const ids = new Set([...container.querySelectorAll('[id]')].map((no) => no.id))
      const html = container.innerHTML
      const alvos = [...html.matchAll(/url\(#([^)]+)\)|href="#([^"]+)"/g)].map(([, a, b]) => a ?? b ?? '')
      expect(alvos.length, pose).toBeGreaterThan(5)
      expect(alvos.filter((alvo) => !ids.has(alvo)), pose).toEqual([])
      unmount()
    }
  })
})

describe('Onca: sempre assinada, nunca pessoa', () => {
  it('traz o nome da função e o selo "IA" no mesmo bloco, para cada agente e cada pose', () => {
    for (const agente of AGENTES) {
      for (const pose of POSES) {
        const { container, unmount } = desenhar(pose, agente)
        const bloco = container.querySelector('[data-onca]') as HTMLElement
        const legenda = bloco.querySelector('figcaption') as HTMLElement
        expect(legenda.textContent, `${agente} ${pose}`).toMatch(/^(Assistente de ensino|Tutor|Analista de desempenho escolar)/)
        expect(legenda.querySelectorAll('[data-selo-ia]'), `${agente} ${pose}`).toHaveLength(1)
        expect(legenda.textContent, `${agente} ${pose}`).toContain('gerado por inteligência artificial')
        unmount()
      }
    }
  })

  it('o nome acessível é a função: nunca "onça", nunca nome de gente, e nenhum texto de sentimento', () => {
    for (const pose of POSES) {
      const { container, unmount } = desenhar(pose, 'assistente_de_ensino')
      // O nome que o leitor de tela ouve é o texto da legenda: a função e o selo. O desenho não tem nome próprio.
      expect(container.querySelector('figure')?.hasAttribute('aria-label'), pose).toBe(false)
      expect(container.querySelector('figcaption')?.textContent, pose).toMatch(/^Assistente de ensino/)
      expect(container.textContent, pose).not.toMatch(/on[çc]a/i)
      expect(container.textContent, pose).not.toMatch(/feliz|triste|orgulhos|saudade|sentiu|amig|ador|animad|preocupad|bravo|medo/i)
      expect(container.querySelectorAll('title, desc, text, tspan'), pose).toHaveLength(0)
      expect(container.querySelector('svg')?.hasAttribute('aria-label'), pose).toBe(false)
      expect(container.querySelector('svg')?.getAttribute('aria-hidden'), pose).toBe('true')
      unmount()
    }
  })

  // A prova deste caso é o `typecheck`: cada `@ts-expect-error` falha a compilação se a linha de baixo deixar de errar. Em
  // execução o caso só confere que as peças renderizam; não há `expect` aqui, de propósito.
  it('só aceita pose, agente e um dos três tamanhos', () => {
    // @ts-expect-error sem agente não há quem assine
    render(<Onca pose="acenando" tamanho={120} />)
    // @ts-expect-error nenhum humor nem expressão que mude com quem usa: o rosto é o da pose
    render(<Onca pose="acenando" agente="tutor" tamanho={120} humor="feliz" />)
    // @ts-expect-error a boca também é da pose
    render(<Onca pose="acenando" agente="tutor" tamanho={120} boca="sorriso" />)
    // @ts-expect-error o tamanho é um dos três do desenho
    render(<Onca pose="acenando" agente="tutor" tamanho={100} />)
  })
})

describe('Onca: o desenho', () => {
  it('é um SVG só por onça, quadrado como o do mockup, e o tamanho é só o tamanho', () => {
    const formas = new Set<string>()
    for (const tamanho of TAMANHOS) {
      const { container, unmount } = desenhar('apontando', 'tutor', tamanho)
      const svg = container.querySelector('svg') as SVGElement
      expect(container.querySelectorAll('svg')).toHaveLength(1)
      expect(svg.getAttribute('width')).toBe(String(tamanho))
      expect(svg.getAttribute('height')).toBe(String(tamanho))
      expect(svg.getAttribute('viewBox')).toBe('0 0 240 240')
      formas.add(stripSvgIds(svg.innerHTML))
      unmount()
    }
    expect(formas.size).toBe(1)
  })

  it('dois renders da mesma pose dão o mesmo HTML, e a onça está parada: sem animação, estilo, imagem nem temporizador', () => {
    vi.useFakeTimers()
    for (const pose of POSES) {
      const primeiro = desenhar(pose)
      const html = primeiro.container.innerHTML
      expect(vi.getTimerCount(), pose).toBe(0)
      expect(primeiro.container.querySelectorAll('animate, animateTransform, animateMotion, set, style, script, foreignObject, image, img'), pose).toHaveLength(0)
      for (const elemento of primeiro.container.querySelectorAll('*')) {
        expect(elemento.hasAttribute('style'), elemento.outerHTML).toBe(false)
        expect(elemento.getAttribute('class') ?? '', elemento.outerHTML).not.toMatch(/animate|transition|duration|delay|pulse|spin|bounce|ping/)
      }
      primeiro.unmount()
      const segundo = desenhar(pose)
      expect(stripSvgIds(segundo.container.innerHTML), pose).toBe(stripSvgIds(html))
      segundo.unmount()
    }
  })

  it('usa só as cores da 9.7, sem degradê, e os únicos traços são o rabo, a boca fechada e os olhos em alegria: nenhuma forma tem contorno', () => {
    const permitidas = coresDaOnca()
    expect(permitidas.size, 'a 9.7 declara nove cores fixas').toBe(9)
    for (const pose of POSES) {
      const { container, unmount } = desenhar(pose)
      for (const elemento of container.querySelectorAll('[fill], [stroke]')) {
        for (const atributo of ['fill', 'stroke'] as const) {
          const valor = elemento.getAttribute(atributo)
          if (valor !== null && valor !== 'none') expect(permitidas.has(valor.toUpperCase()), `${pose} ${valor}`).toBe(true)
        }
      }
      // A língua é da boca aberta, e só: acenando e comemorando.
      expect(container.innerHTML.toUpperCase().includes('#FF9FB0'), `${pose}: a língua é da boca aberta`).toBe(pose === 'acenando' || pose === 'comemorando')
      // A pinta e os recortes são `defs`, `use` e `clipPath`; degradê, filtro, máscara e padrão, nenhum.
      expect(container.querySelectorAll('linearGradient, radialGradient, filter, mask, pattern'), pose).toHaveLength(0)
      // Traço só no rabo (o corpo do rabo e os anéis), na boca fechada e nos olhos fechados em alegria: todos são linhas sem preenchimento.
      const comTraco = [...container.querySelectorAll('[stroke]')]
      // Em acenando as duas linhas ao lado da pata têm o traço no grupo (`g`), e não em cada uma.
      const esperadas = { acenando: ['path', 'path', 'g'], comemorando: ['path', 'path', 'path', 'path'], apontando: ['path', 'path', 'path'], pensando: ['path', 'path', 'path'] }[pose]
      expect(comTraco.map((elemento) => elemento.tagName.toLowerCase()), pose).toEqual(esperadas)
      for (const linha of comTraco) expect(linha.getAttribute('fill'), pose).toBe('none')
      // A sombra do chão é do cenário (o token `onca-chao`), e não uma das cores da onça.
      expect(container.querySelector('[data-parte="sombra"] rect')?.getAttribute('class'), pose).toBe('fill-onca-chao')
      unmount()
    }
  })

  it('o corpo é o mesmo nas três poses: o que muda são os braços, o rabo, os pés e a inclinação', () => {
    const comuns = new Set<string>()
    for (const pose of POSES) {
      const { container, unmount } = desenhar(pose)
      // O que não muda: a forma do corpo e da cabeça, as rosetas e a barriga.
      const parte = (seletor: string) => stripSvgIds(container.querySelector(seletor)?.outerHTML ?? '')
      comuns.add([parte('[data-parte="corpo"] > g > path'), parte('[data-parte="barriga"]'), stripSvgIds(container.querySelectorAll('g[clip-path] use')[0]?.parentElement?.innerHTML ?? '')].join('|'))
      // O que muda é desenhado em grupos próprios, para o corpo não ser redesenhado.
      for (const nome of ['pata-e', 'pata-d', 'rabo', 'pe-e', 'pe-d', 'orelha-e', 'orelha-d']) expect(container.querySelectorAll(`[data-parte="${nome}"]`), `${pose} ${nome}`).toHaveLength(1)
      unmount()
    }
    expect(comuns.size).toBe(1)
  })
})

describe('a pasta da onça com o corpo inteiro', () => {
  const daPasta = webSourceFiles(RAIZ_DA_WEB).filter((nome) => nome.startsWith('components/ui/onca/'))

  it('a `Onca` está na pasta e não tem temporizador, efeito nem estado: o que se mexe está em `movimento-da-onca.ts`', () => {
    expect(daPasta).toContain('components/ui/onca/Onca.tsx')
    const codigo = codeWithoutCommentsOrText(readFileSync(join(RAIZ_DA_WEB, 'components/ui/onca/Onca.tsx'), 'utf8'))
    expect(codigo).not.toMatch(/\b(?:setTimeout|setInterval|requestAnimationFrame|useEffect|useLayoutEffect|useState|useReducer|useRef)\b/)
  })
})

describe('Onca: as linhas do aceno', () => {
  it('só a acenando leva as duas linhas ao lado da pata, e elas são traço parado', () => {
    for (const pose of POSES) {
      const { container, unmount } = desenhar(pose)
      const linhas = container.querySelectorAll('[data-parte="movimento"] path')
      expect(linhas, pose).toHaveLength(pose === 'acenando' ? 2 : 0)
      for (const linha of linhas) expect(linha.getAttribute('class'), pose).toBeNull()
      unmount()
    }
  })
})
