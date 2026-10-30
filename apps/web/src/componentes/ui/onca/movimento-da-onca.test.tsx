// @vitest-environment jsdom
import { act, cleanup, render, renderHook } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CenaDaOnca } from './CenaDaOnca'
import { Onca, POSES, type Pose } from './Onca'
import { esquecerQueAcenou, useAcenarNaPrimeiraVez } from './movimento-da-onca'

/**
 * O movimento da onça de corpo inteiro (`Onca.css`, do mockup; `docs/interface.md` 9.7; D59; D80, item 3): entrar,
 * acenar na primeira vez e saltar na comemoração, cada um uma vez, nada em laço. O `jsdom` não calcula `animation-name`: o que
 * o navegador resolve com e sem "reduzir movimento" está em `e2e/introducao-pecas.spec.ts`; aqui estão as classes que o
 * desenho põe, os temporizadores que o React agenda, e o CSS lido como texto.
 */
const CSS = readFileSync(join(import.meta.dirname, 'Onca.css'), 'utf8')

function reduzirMovimento(reduz: boolean) {
  vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: reduz && consulta.includes('prefers-reduced-motion: reduce'), media: consulta, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
}

beforeEach(() => {
  vi.useFakeTimers()
  esquecerQueAcenou()
  reduzirMovimento(false)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const desenhar = (pose: Pose, animada?: boolean) => render(<Onca pose={pose} agente="tutor" tamanho={120} {...(animada === undefined ? {} : { animada })} />).container

describe('Onca: o movimento liga com `animada` e nada se mexe sem ele', () => {
  it('animada, que é o padrão: o corpo entra, e a comemorando salta em vez de entrar', () => {
    for (const pose of POSES) {
      const onca = desenhar(pose)
      expect(onca.querySelector('svg')?.getAttribute('class'), pose).toContain('onca-animada')
      const movimento = onca.querySelector('[data-parte="corpo"] > g')?.getAttribute('class')
      expect(movimento, pose).toBe(pose === 'comemorando' ? 'onca-comemora' : 'onca-entra')
      cleanup()
    }
  })

  it('`animada={false}` deixa a onça parada: nenhuma classe de movimento e nenhum temporizador', () => {
    for (const pose of POSES) {
      const onca = desenhar(pose, false)
      expect(onca.querySelector('svg')?.getAttribute('class'), pose).not.toContain('onca-animada')
      expect(onca.querySelectorAll('.onca-entra, .onca-comemora, .onca-acena'), pose).toHaveLength(0)
      expect(vi.getTimerCount(), pose).toBe(0)
      cleanup()
    }
  })

  it('os três pontos do `pensando` ficam parados: existem só nessa pose e não levam classe nenhuma', () => {
    for (const pose of POSES) {
      const onca = desenhar(pose)
      const pontos = onca.querySelectorAll('[data-parte="balao"] g > circle')
      expect(pontos, pose).toHaveLength(pose === 'pensando' ? 3 : 0)
      expect(onca.querySelectorAll('[data-parte="balao"] [class]'), `${pose}: nada no balão leva classe de movimento`).toHaveLength(0)
      cleanup()
    }
  })
})

describe('Onca: o acenar, e nenhum outro temporizador', () => {
  it('nenhuma pose agenda temporizador: a onça não pisca, e o acenar é do CSS', () => {
    for (const pose of POSES) {
      desenhar(pose)
      expect(vi.getTimerCount(), `${pose}: nada agendado ao desenhar`).toBe(0)
      act(() => vi.advanceTimersByTime(30000))
      expect(vi.getTimerCount(), pose).toBe(0)
      cleanup()
    }
  })

  it('só a primeira onça acenando da sessão acena, e só uma vez', () => {
    const primeira = desenhar('acenando')
    expect(primeira.querySelectorAll('[data-parte="pata-d"] > .onca-acena')).toHaveLength(1)
    cleanup()
    expect(desenhar('acenando').querySelectorAll('.onca-acena')).toHaveLength(0)
    cleanup()
    esquecerQueAcenou()
    expect(desenhar('apontando').querySelectorAll('.onca-acena'), 'só a pose acenando acena').toHaveLength(0)
  })

  it('uma pose que não acena não gasta o aceno da sessão: depois da apontando e da parada, a acenando ainda acena', () => {
    desenhar('apontando')
    cleanup()
    desenhar('acenando', false)
    cleanup()
    expect(desenhar('acenando').querySelectorAll('[data-parte="pata-d"] > .onca-acena')).toHaveLength(1)
  })

  it('o gancho só liga o aceno para quem pede: `acenando` falso não acena nem gasta o aceno da sessão', () => {
    expect(renderHook(() => useAcenarNaPrimeiraVez(false, 'agente')).result.current).toBe(false)
    expect(renderHook(() => useAcenarNaPrimeiraVez(true, 'agente')).result.current, '`acenando` falso não gastou o aceno').toBe(true)
    expect(renderHook(() => useAcenarNaPrimeiraVez(true, 'agente')).result.current, 'o aceno da sessão já foi gasto').toBe(false)
  })

  it('o aceno da marca e o do agente são memórias separadas: gastar um não gasta o outro, em qualquer ordem', () => {
    expect(renderHook(() => useAcenarNaPrimeiraVez(true, 'marca')).result.current, 'a marca acena').toBe(true)
    expect(renderHook(() => useAcenarNaPrimeiraVez(true, 'marca')).result.current, 'o aceno da marca foi gasto').toBe(false)
    expect(renderHook(() => useAcenarNaPrimeiraVez(true, 'agente')).result.current, 'o do agente continua inteiro').toBe(true)
    expect(renderHook(() => useAcenarNaPrimeiraVez(true, 'agente')).result.current, 'o do agente foi gasto').toBe(false)
    esquecerQueAcenou()
    expect(renderHook(() => useAcenarNaPrimeiraVez(true, 'agente')).result.current, 'agente primeiro').toBe(true)
    expect(renderHook(() => useAcenarNaPrimeiraVez(true, 'marca')).result.current, 'a marca ainda acena').toBe(true)
    // As duas estão gastas; esquecer zera as duas.
    esquecerQueAcenou()
    expect(renderHook(() => useAcenarNaPrimeiraVez(true, 'marca')).result.current, 'esquecer zera a marca').toBe(true)
    expect(renderHook(() => useAcenarNaPrimeiraVez(true, 'agente')).result.current, 'esquecer zera o agente').toBe(true)
  })

  it('o aceno acaba com a pose: da acenando para a apontando, a pata não fica girando', () => {
    const { container, rerender } = render(<Onca pose="acenando" agente="tutor" tamanho={120} />)
    expect(container.querySelectorAll('.onca-acena')).toHaveLength(1)
    rerender(<Onca pose="apontando" agente="tutor" tamanho={120} />)
    expect(container.querySelectorAll('.onca-acena')).toHaveLength(0)
  })

  it('a marca de já acenou não vai para o navegador, e o sessionStorage e o localStorage ficam vazios depois de acenar', () => {
    const onca = desenhar('acenando')
    expect(onca.querySelectorAll('.onca-acena')).toHaveLength(1)
    expect(JSON.stringify(Object.entries(sessionStorage)), 'sessionStorage').toBe('[]')
    expect(JSON.stringify(Object.entries(localStorage)), 'localStorage').toBe('[]')
  })
})

describe('Onca: com "reduzir movimento" nada liga (D59)', () => {
  it('a onça não acena, e o aceno não é gasto: sem "reduzir movimento" a próxima ainda acena', () => {
    reduzirMovimento(true)
    for (const pose of POSES) {
      const onca = desenhar(pose)
      expect(vi.getTimerCount(), pose).toBe(0)
      expect(onca.querySelectorAll('.onca-acena'), pose).toHaveLength(0)
      cleanup()
    }
    reduzirMovimento(false)
    expect(desenhar('acenando').querySelectorAll('.onca-acena'), 'o aceno não foi gasto com "reduzir movimento"').toHaveLength(1)
  })

  it('o CSS desliga todo movimento sob a regra do navegador', () => {
    const inicio = CSS.indexOf('@media (prefers-reduced-motion: reduce)')
    expect(inicio).toBeGreaterThan(-1)
    expect(CSS.slice(inicio)).toMatch(/\.onca \*, \.onca \{ animation: none !important; \}/)
  })
})

describe('Onca.css', () => {
  it('só muda `transform` e `opacity`, e nada fica em laço', () => {
    const quadros = [...CSS.matchAll(/@keyframes [\w-]+ \{([\s\S]*?)\n\}/g)].map(([, corpo = '']) => corpo)
    expect(quadros, 'entrar, acenar e comemorar: o piscar e os pontos foram vetados').toHaveLength(3)
    for (const corpo of quadros) {
      for (const [, propriedade = ''] of corpo.matchAll(/([a-z-]+):/g)) expect(['transform', 'opacity']).toContain(propriedade)
    }
    const semComentario = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
    const infinitos = [...semComentario.matchAll(/([^{}]+)\{[^{}]*infinite[^{}]*\}/g)].map(([, seletor = '']) => seletor.trim())
    expect(infinitos).toEqual([])
    expect(semComentario).not.toMatch(/infinite|onca-pisca|onca-ponto/)
  })
})

describe('o cenário da onça da marca (D80 revista às 21:45): só a onça se mexe', () => {
  it('o `Onca.css` continua com as três animações e nenhuma regra com `transition`: o cenário não tem CSS próprio (o SVG dele, sem animação, quem mede é o e2e com `getAnimations`)', () => {
    const semComentario = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
    const regras = [...semComentario.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].filter(([, , corpo = '']) => /\banimation\s*:/.test(corpo)).map(([, seletor = '']) => seletor.trim())
    // Entrar, acenar e comemorar (e a regra do "reduzir movimento", que desliga as três): nenhuma regra nova para o cenário.
    expect(regras).toEqual(['.onca-animada .onca-entra', '.onca .onca-acena', '.onca .onca-comemora', '.onca *, .onca'])
    expect(semComentario).not.toMatch(/\btransition\b/)
    // Cada animação roda uma vez: a duração e a contagem de voltas que o CSS escreve não têm `infinite` nem número de voltas maior que 1.
    for (const [, declaracao = ''] of semComentario.matchAll(/\banimation\s*:([^;]+);/g)) expect(declaracao).not.toMatch(/infinite|\b[2-9]\b(?!\d*m?s)/)
  })

  it('animada, a figura do cenário tem só dois movimentos, o de entrar e o de acenar, e os dois são da onça', () => {
    const { container } = render(<CenaDaOnca />)
    expect(container.querySelectorAll('.onca-entra')).toHaveLength(1)
    expect(container.querySelectorAll('.onca-acena')).toHaveLength(1)
    expect(container.querySelectorAll('[data-cena-da-onca] > svg .onca-entra, [data-cena-da-onca] > svg .onca-acena, [data-cena-da-onca] > svg [class*="animate"]')).toHaveLength(0)
    // Com "reduzir movimento" o gancho não liga o aceno, e o cenário, que nunca se mexeu, fica como estava.
    cleanup()
    esquecerQueAcenou()
    reduzirMovimento(true)
    const parado = render(<CenaDaOnca />)
    expect(parado.container.querySelectorAll('.onca-acena')).toHaveLength(0)
    expect(parado.container.querySelectorAll('[data-cena-da-onca] > svg > *').length).toBeGreaterThan(10)
  })
})
