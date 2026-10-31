// @vitest-environment jsdom
import { AGENTES } from '@educa/shared'
import { cleanup, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CabecaOnca } from './CabecaOnca'
import { Onca, POSES, type Pose } from './Onca'

/**
 * A onça do produto é a do mockup de outubro (pasta `duo/onca` do protótipo, commit `a95568d`; D80, item 3). O protótipo **não é
 * importado nem lido**: o desenho foi copiado para esta pasta, e este teste guarda os valores do original (impressões dos
 * caminhos longos e as medidas, congeladas aqui) e confere que a cópia não se afastou do traço (correção
 * `2026-10-28-onca-do-mockup`). Os testes irmãos provam a regra (parada, neutra, nove cores); só este prova que o desenho é o
 * do mockup, e é por isso que a onça errada passava em todos eles.
 *
 * O que o mockup tem a mais e não está aqui (`acolhendo`, `dormindo`, a cabeça feliz do avatar) ficou de fora de propósito
 * (`Onca.test.tsx`, `CabecaOnca.test.tsx`).
 */
afterEach(cleanup)

const impressao = (texto: string): string => createHash('sha256').update(texto).digest('hex')

/** Impressão (sha256) dos caminhos longos do mockup: o texto inteiro não cabe aqui, e a cópia tem de dar a mesma impressão. */
const IMPRESSAO = {
  CORPO_D: '280cd31ae3b1acddea9c86d98a82aad7c8edde7e1f37b58df551449531d5c95d',
  CABECA_D: '706ec1fd562739f4dd30c79dcdf635a8030e1d7bc8df84dce6b8d8b3d9cc39c9',
  PINTA_PATH: '2b9d97ef953732c05dbeb16788bc071864b9093273619e24040fd954e4431ae8',
} as const

/**
 * O css de movimento do mockup que o produto **mantém**, sem comentário e com o espaço colapsado. O piscar e o laço dos três
 * pontos do `pensando` estão no mockup e foram vetados pelo `conformidade-reviewer` (D59): não estão aqui, e o css do produto
 * não os tem.
 */
const MOVIMENTO_QUE_FICA = [
  '.onca-animada .onca-entra { animation: onca-entrar 240ms ease-out both; } @keyframes onca-entrar { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }',
  '.onca .onca-acena { transform-origin: 50% 13px; animation: onca-acenar 800ms ease-in-out 240ms both; } @keyframes onca-acenar { 0%, 50%, 100% { transform: rotate(0deg); } 25%, 75% { transform: rotate(25deg); } }',
  '.onca .onca-comemora { transform-origin: 50% 100%; animation: onca-comemorar 500ms ease-out both; } @keyframes onca-comemorar { 0% { transform: scale(1, 1); } 16% { transform: translateY(0) scale(1.02, .94); } 60% { transform: translateY(-12px) scale(.99, 1.03); } 84% { transform: translateY(0) scale(1.02, .97); } 100% { transform: none; } }',
  '@media (prefers-reduced-motion: reduce) { .onca *, .onca { animation: none !important; } }',
]

/** As cores do objeto `ONCA` do mockup, por nome. */
const CORES_DO_MOCKUP: Record<string, string> = {
  pelagem: '#E8732E',
  sombra: '#D75F18',
  realce: '#ED935D',
  creme: '#FDEBDD',
  roseta: '#7A3412',
  pupila: '#16233E',
  olho: '#FFFFFF',
  nariz: '#E5838C',
  lingua: '#FF9FB0',
}

const ROSETAS = [
  'translate(120 62) rotate(0) scale(0.022)',
  'translate(46 136) rotate(30) scale(0.024)',
  'translate(196 128) rotate(-40) scale(0.022)',
  'translate(50 194) rotate(80) scale(0.02)',
  'translate(192 188) rotate(140) scale(0.02)',
]
const BOCA_W = 'M110 147 Q115 152 120 146 Q125 152 130 147'
const BOCA_LADO = 'M121 150 Q127 152 131 147'
const BOCA_SORRISO = 'M111 147 Q122 155 133 145'
const BOCA_ABERTA = 'M109 146 Q121 150 133 145 Q133 158 122 160 Q110 160 109 146 Z'
const BOCA_MUITO_ABERTA = 'M104 145 Q120 151 137 145 Q137 168 121 169 Q104 168 104 145 Z'
const NARIZ = 'M111 130 H129 Q134 130 131 134 L123 141 Q120 144 117 141 L109 134 Q106 130 111 130 Z'
const ARCOS_FELIZ = ['M76 116 Q90 96 104 116', 'M136 116 Q150 96 164 116']

function desenhoDaCabeca() {
  return render(<CabecaOnca tamanho={48} />).container
}
function desenhoDoCorpo(pose: Pose = 'acenando') {
  return render(<Onca pose={pose} agente={AGENTES[0]} tamanho={120} />).container
}

/** Os elementos `dentro` cujo `d` tem a impressão dada: o caminho da pinta passa de 2048 caracteres, o limite de um seletor. */
function comImpressao(raiz: ParentNode, esperada: string, dentro = 'path'): Element[] {
  return [...raiz.querySelectorAll(dentro)].filter((no) => impressao(no.getAttribute('d') ?? '') === esperada)
}

function circulo(raiz: ParentNode, cx: number, cy: number, r: number): Element | null {
  return raiz.querySelector(`circle[cx="${String(cx)}"][cy="${String(cy)}"][r="${String(r)}"]`)
}

describe('a onça é a do mockup: os caminhos', () => {
  it('o corpo, a cabeça e a pinta da marca são os mesmos caminhos', () => {
    const cabeca = desenhoDaCabeca()
    expect(comImpressao(cabeca, IMPRESSAO.CABECA_D), 'a cabeça é o topo do corpo (CABECA_D)').not.toHaveLength(0)
    expect(comImpressao(cabeca, IMPRESSAO.PINTA_PATH, 'defs path'), 'a pinta da marca é declarada uma vez').toHaveLength(1)
    const corpo = desenhoDoCorpo()
    expect(comImpressao(corpo, IMPRESSAO.CORPO_D), 'o corpo e a cabeça numa forma só (CORPO_D)').not.toHaveLength(0)
    expect(comImpressao(corpo, IMPRESSAO.PINTA_PATH, 'defs path'), 'a pinta é declarada uma vez por onça').toHaveLength(1)
  })

  it('as rosetas são as cinco do mockup, com o mesmo giro e a mesma escala, e a cabeça traz a da testa', () => {
    const esperadas = ROSETAS
    const doCorpo = [...desenhoDoCorpo().querySelectorAll('use')].map((no) => no.getAttribute('transform'))
    for (const roseta of esperadas) expect(doCorpo, roseta).toContain(roseta)
    expect([...desenhoDaCabeca().querySelectorAll('use')].map((no) => no.getAttribute('transform'))).toEqual([esperadas[0]])
  })

  it('os ombros das patas são os do mockup', () => {
    const ombros = [
      [75, 173],
      [165, 173],
    ]
    const corpo = desenhoDoCorpo('comemorando')
    for (const [x = 0, y = 0] of ombros) {
      // A pata nasce no ombro: um retângulo de 26 de largura, com o centro em x, e o topo 13 unidades abaixo do ombro.
      expect(corpo.querySelector(`rect[x="${String(x - 13)}"][y="${String(y - 13)}"][width="26"]`), `ombro ${String(x)}`).not.toBeNull()
    }
  })
})

describe('a onça é a do mockup: o corpo de cada pose', () => {
  it('apontando estica o braço de 54 para 64 e mostra o lado de trás do corpo em 3/4', () => {
    const apontando = desenhoDoCorpo('apontando')
    expect(apontando.querySelector('rect[x="152"][y="160"][width="26"][height="64"]'), 'o braço esticado').not.toBeNull()
    expect(apontando.querySelector('g[clip-path] > rect[x="30"][y="40"][width="22"][height="180"]'), 'o lado de trás').not.toBeNull()
    const acenando = desenhoDoCorpo('acenando')
    expect(acenando.querySelector('rect[x="152"][y="160"][height="54"]'), 'o braço de acenando é o curto').not.toBeNull()
    expect(acenando.querySelector('g[clip-path] > rect[x="30"][y="40"]'), 'só apontando mostra o lado de trás').toBeNull()
  })

  it('a mão é o punho, círculo da cor da pata com a almofada creme, quando o braço sai da silhueta, e creme quando cai no corpo', () => {
    const comemorando = desenhoDoCorpo('comemorando')
    for (const x of [75, 165]) {
      expect(circulo(comemorando, x, 202, 16), `punho em ${String(x)}`).not.toBeNull()
      expect(circulo(comemorando, x, 204, 7), `almofada em ${String(x)}`).not.toBeNull()
    }
    // Pensando leva a mão direita ao queixo: creme, sem punho.
    const pensando = desenhoDoCorpo('pensando')
    expect(circulo(pensando, 165, 202, 14), 'mão creme').not.toBeNull()
    expect(circulo(pensando, 165, 202, 16), 'sem punho').toBeNull()
  })
})

/**
 * O que cada pose gira e desloca, **congelado** a partir do `POSES` do mockup (texto literal): o `transform` da figura, da sombra
 * do chão, do rosto, das duas orelhas, das duas patas e dos dois pés, e o `d` do rabo. `null` é "sem transformação". O texto
 * escrito aqui é o do original, não o do `Onca.tsx`: a pata que muda de lugar na pose acenando deixa este teste vermelho.
 */
interface TransformacoesDaPose {
  readonly figura: string | null
  readonly sombra: string | null
  readonly rosto: string | null
  readonly orelhaE: string | null
  readonly orelhaD: string | null
  readonly pataE: string | null
  readonly pataD: string | null
  readonly peE: string | null
  readonly peD: string | null
  readonly rabo: string
}

const SEM_TRANSFORMACAO = { figura: null, sombra: null, rosto: null, orelhaE: null, orelhaD: null, pataE: null, pataD: null, peE: null, peD: null } as const

const TRANSFORMACOES_DO_MOCKUP: Readonly<Record<Pose, TransformacoesDaPose>> = {
  acenando: {
    ...SEM_TRANSFORMACAO,
    figura: 'rotate(-4 120 220)',
    pataD: 'translate(30 -16) rotate(-150 165 173)',
    peE: 'rotate(-15 98 213)',
    rabo: 'M196 196 C230 190 234 140 214 124 C202 114 190 126 198 136',
  },
  comemorando: {
    ...SEM_TRANSFORMACAO,
    figura: 'translate(0 -10) scale(1 1.06)',
    sombra: 'translate(120 228) scale(.8 1) translate(-120 -228)',
    pataE: 'translate(-30 -16) rotate(150 75 173)',
    pataD: 'translate(30 -16) rotate(-150 165 173)',
    peE: 'translate(-4 4) rotate(-12 78 213)',
    peD: 'translate(4 4) rotate(12 162 213)',
    rabo: 'M196 198 C232 196 204 160 226 138',
  },
  apontando: {
    ...SEM_TRANSFORMACAO,
    rosto: 'translate(9 0)',
    orelhaE: 'translate(12 8)',
    orelhaD: 'translate(4 0)',
    pataD: 'translate(14 -6) rotate(-90 165 173)',
    rabo: 'M196 196 C224 196 226 170 216 152',
  },
  pensando: {
    ...SEM_TRANSFORMACAO,
    rosto: 'rotate(8 120 120)',
    orelhaE: 'rotate(8 120 120) translate(0 -2)',
    orelhaD: 'rotate(8 120 120) translate(0 4)',
    pataD: 'rotate(116 165 173)',
    rabo: 'M196 196 C226 192 230 160 214 140',
  },
}

/** O que o desenho de uma pose gira e desloca, lido do HTML: as mesmas dez coisas de `TRANSFORMACOES_DO_MOCKUP`. */
function transformacoesDesenhadas(raiz: ParentNode): TransformacoesDaPose {
  const transformacao = (seletor: string): string | null => {
    const no = raiz.querySelector(seletor)
    expect(no, `${seletor} não está desenhado`).not.toBeNull()
    return no?.getAttribute('transform') ?? null
  }
  // As orelhas giram num grupo sem nome em volta de `orelha-e` e `orelha-d`.
  const grupoDaOrelha = (lado: 'e' | 'd'): string | null => {
    const orelha = raiz.querySelector(`[data-parte="orelha-${lado}"]`)
    expect(orelha, `orelha ${lado} não está desenhada`).not.toBeNull()
    return orelha?.parentElement?.getAttribute('transform') ?? null
  }
  const rabo = raiz.querySelector('[data-parte="rabo"] path')?.getAttribute('d')
  expect(rabo, 'o rabo não está desenhado').toBeTruthy()
  return {
    figura: transformacao('[data-parte="corpo"]'),
    sombra: transformacao('[data-parte="sombra"]'),
    rosto: transformacao('[data-parte="rosto"]'),
    orelhaE: grupoDaOrelha('e'),
    orelhaD: grupoDaOrelha('d'),
    pataE: transformacao('[data-parte="pata-e"]'),
    pataD: transformacao('[data-parte="pata-d"]'),
    peE: transformacao('[data-parte="pe-e"]'),
    peD: transformacao('[data-parte="pe-d"]'),
    rabo: rabo ?? '',
  }
}

describe('a onça é a do mockup: o giro e o deslocamento de cada pose', () => {
  it.each(Object.keys(TRANSFORMACOES_DO_MOCKUP) as Pose[])('%s gira a figura, as orelhas, o rosto, as patas, os pés, a sombra e o rabo como o mockup', (pose) => {
    expect(transformacoesDesenhadas(desenhoDoCorpo(pose))).toEqual(TRANSFORMACOES_DO_MOCKUP[pose])
  })

  it.each(Object.keys(TRANSFORMACOES_DO_MOCKUP) as Pose[])('%s põe a ponta escura do rabo nos dois últimos números do caminho dele, como o mockup', (pose) => {
    // No mockup a ponta sai do próprio `d` (`Cauda`); no produto o `fim` é escrito à parte, e este caso o prende ao caminho congelado.
    const [x, y] = TRANSFORMACOES_DO_MOCKUP[pose].rabo.trim().split(/[\s,CML]+/).filter(Boolean).slice(-2).map(Number)
    const pontas = desenhoDoCorpo(pose).querySelectorAll('[data-parte="rabo"] circle[r="8"]')
    expect(pontas, `${pose}: uma ponta só`).toHaveLength(1)
    expect({ cx: Number(pontas[0]?.getAttribute('cx')), cy: Number(pontas[0]?.getAttribute('cy')) }).toEqual({ cx: x, cy: y })
  })

  it('as quatro poses estão congeladas, e nenhuma pose nova passa sem o mockup dizer como ela gira', () => {
    expect(Object.keys(TRANSFORMACOES_DO_MOCKUP).sort()).toEqual([...POSES].sort())
  })
})

describe('a onça é a do mockup: as linhas do aceno', () => {
  it('as duas linhas ao lado da pata que acena são as do mockup: traço de 5 na cor da sombra, parado', () => {
    const linhas = [...desenhoDoCorpo('acenando').querySelectorAll('[data-parte="movimento"] path')]
    expect(linhas.map((no) => no.getAttribute('d'))).toEqual(['M212 88 Q222 96 223 108', 'M220 72 Q236 86 235 106'])
    const grupo = linhas[0]?.parentElement
    expect(grupo?.getAttribute('stroke')?.toUpperCase()).toBe(CORES_DO_MOCKUP.sombra)
    expect(grupo?.getAttribute('stroke-width')).toBe('5')
    expect(grupo?.getAttribute('fill')).toBe('none')
  })
})

describe('a onça é a do mockup: o rosto', () => {
  it('a máscara são dois círculos de r 38, e as orelhas têm o miolo de r 11', () => {
    for (const raiz of [desenhoDaCabeca(), desenhoDoCorpo()]) {
      expect(circulo(raiz, 91, 110, 38)).not.toBeNull()
      expect(circulo(raiz, 149, 110, 38)).not.toBeNull()
      for (const cx of [68, 172]) {
        expect(circulo(raiz, cx, 58, 22)).not.toBeNull()
        expect(circulo(raiz, cx, 58, 11)).not.toBeNull()
      }
    }
  })

  it('o focinho, o nariz e a boca em "w" têm as medidas do mockup, e a cabeça do avatar é sempre a neutra', () => {
    for (const raiz of [desenhoDaCabeca(), desenhoDoCorpo('pensando')]) {
      expect(raiz.querySelector('rect[x="98"][y="128"][width="44"][height="30"][rx="15"]'), 'focinho').not.toBeNull()
      expect(raiz.querySelector(`path[d="${NARIZ}"]`), 'nariz').not.toBeNull()
    }
    expect(desenhoDaCabeca().querySelector(`path[d="${BOCA_W}"]`), 'a cabeça tem a boca em "w"').not.toBeNull()
  })

  it('a boca e o olhar de cada pose são os que o mockup dá a ela, e só a cabeça do avatar não os troca', () => {
    // O mockup diz, pose por pose, qual olhar e qual boca: acenando (frente, aberta), apontando (lado, sorriso),
    // comemorando (feliz, muito aberta), pensando (pensando, lado).
    const bocaDe = (pose: Pose) => [...desenhoDoCorpo(pose).querySelectorAll('[data-parte="boca"] path')].map((no) => no.getAttribute('d'))
    expect(bocaDe('acenando')).toContain(BOCA_ABERTA)
    expect(bocaDe('comemorando')).toContain(BOCA_MUITO_ABERTA)
    expect(bocaDe('apontando')).toEqual([BOCA_SORRISO])
    expect(bocaDe('pensando')).toEqual([BOCA_LADO])
    const alegres = [...desenhoDoCorpo('comemorando').querySelectorAll('[data-parte="olhos"] path')].map((no) => no.getAttribute('d'))
    expect(alegres).toEqual(ARCOS_FELIZ)
    // A língua: o círculo rosa da boca aberta, nas medidas do mockup.
    expect(circulo(desenhoDoCorpo('acenando'), 124, 164, 9)).not.toBeNull()
    expect(circulo(desenhoDoCorpo('comemorando'), 121, 172, 13)).not.toBeNull()
  })

  it('o movimento que fica é o do mockup: entrar, acenar, comemorar e a regra de reduzir movimento, sem o piscar nem os pontos', () => {
    const normalizado = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim()
    const doProduto = normalizado(readFileSync(join(import.meta.dirname, 'Onca.css'), 'utf8'))
    for (const trecho of MOVIMENTO_QUE_FICA) expect(doProduto).toContain(trecho)
    expect(doProduto).not.toMatch(/onca-pisc|onca-ponto|onca-olho|infinite/)
  })

  it('os olhos de frente: o branco, a pupila e o brilho têm as medidas do mockup (o esquerdo é 2 px menor)', () => {
    const olhos = [
      { x: 71, y: 86, w: 38, h: 48 },
      { x: 130, y: 85, w: 40, h: 50 },
    ]
    const pupilas = [
      [82, 99, 24, 32],
      [134, 99, 25, 33],
    ]
    for (const raiz of [desenhoDaCabeca(), desenhoDoCorpo('acenando')]) {
      olhos.forEach(({ x, y, w, h }, i) => {
        expect(raiz.querySelector(`g > rect[x="${String(x)}"][y="${String(y)}"][width="${String(w)}"][height="${String(h)}"][rx="${String(w / 2)}"]`), `branco ${String(i)}`).not.toBeNull()
        const [px = 0, py = 0, pw = 0, ph = 0] = pupilas[i] ?? []
        expect(raiz.querySelector(`rect[data-parte="pupila"][x="${String(px)}"][y="${String(py)}"][width="${String(pw)}"][height="${String(ph)}"]`), `pupila ${String(i)}`).not.toBeNull()
        // O brilho: um círculo de r 5 a 28% da largura e 24% da altura da pupila.
        expect(circulo(raiz, px + pw * 0.28, py + ph * 0.24, 5), `brilho ${String(i)}`).not.toBeNull()
      })
    }
  })
})

describe('a onça é a do mockup: as cores', () => {
  it('as cores desenhadas são as do mockup, com o mesmo nome e o mesmo hex, e a língua não é desenhada', () => {
    const cores = CORES_DO_MOCKUP
    const nasPartes = (raiz: ParentNode, seletor: string, cor: string) => [...raiz.querySelectorAll(seletor)].every((no) => no.getAttribute('fill')?.toUpperCase() === cor)
    const cabeca = desenhoDaCabeca()
    expect(comImpressao(cabeca, IMPRESSAO.CABECA_D).find((no) => no.hasAttribute('fill'))?.getAttribute('fill')?.toUpperCase()).toBe(cores.pelagem)
    expect(nasPartes(cabeca, 'circle[r="11"]', cores.realce ?? '')).toBe(true)
    expect(nasPartes(cabeca, 'rect[data-parte="pupila"]', cores.pupila ?? '')).toBe(true)
    expect(cabeca.querySelector('path[stroke]')?.getAttribute('stroke')?.toUpperCase()).toBe(cores.pupila)
    const usadas = new Set([...cabeca.querySelectorAll('[fill]')].map((no) => no.getAttribute('fill')?.toUpperCase()))
    for (const cor of usadas) if (cor !== 'NONE') expect(Object.values(cores), `${String(cor)} não é cor do mockup`).toContain(cor)
    expect(usadas.has(cores.lingua), 'a língua é da boca aberta, que não existe aqui').toBe(false)
  })

  it('a sombra do chão é do cenário: lê o token `onca-chao`, e não uma cor da onça', () => {
    const corpo = desenhoDoCorpo()
    expect(corpo.querySelector('[data-parte="sombra"] rect')?.getAttribute('class')).toBe('fill-onca-chao')
    expect(corpo.querySelector('[data-parte="sombra"] rect')?.hasAttribute('fill')).toBe(false)
  })
})
