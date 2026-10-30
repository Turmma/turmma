// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { semIdsDoDesenho } from '../../../__fixtures__/ids-do-desenho'
import { codigoSemComentarioNemTexto } from '../../../__fixtures__/perigo-cheio'
import { esquecerQueAcenou } from './movimento-da-onca'
import { Onca } from './Onca'
import { OncaDaMarca } from './OncaDaMarca'

/**
 * A onça da marca (`docs/interface.md` 9.7; D80 revista em 30/10/2026): o mesmo animal da `Onca`, na pose `acenando`, **sem a
 * legenda**. Ela não é a saída de nenhum agente, e por isso não tem nome de função, selo "IA" nem nome acessível (regra 70,
 * item 4a). Aqui está o que o `jsdom` sabe: o desenho e o que ele não tem. A posição na tela é do e2e (`casca-publica.spec.ts`).
 */
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  esquecerQueAcenou()
})

const CSS = readFileSync(join(import.meta.dirname, 'Onca.css'), 'utf8')

describe('OncaDaMarca: sem assinatura, porque não é um agente', () => {
  it('a figura não tem legenda, assinatura, selo "IA" nem nome acessível, e é escondida da leitura de tela', () => {
    const { container } = render(<OncaDaMarca tamanho={160} animada={false} />)
    const figura = container.querySelector('figure') as HTMLElement
    expect(container.querySelectorAll('figure')).toHaveLength(1)
    expect(figura.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelectorAll('figcaption, [data-onca-assinatura], [data-selo-ia]')).toHaveLength(0)
    expect(container.textContent).toBe('')
    expect(container.querySelectorAll('title, desc, text, tspan')).toHaveLength(0)
    for (const no of [figura, container.querySelector('svg') as SVGElement]) {
      expect(no.hasAttribute('aria-label'), no.tagName).toBe(false)
      expect(no.hasAttribute('aria-labelledby'), no.tagName).toBe(false)
    }
    expect(container.innerHTML).not.toMatch(/gerado por inteligência artificial|Tutor|Assistente|Analista/)
  })

  it('a pose é `acenando`, e só ela', () => {
    const { container } = render(<OncaDaMarca tamanho={88} animada={false} />)
    expect(container.querySelector('[data-onca-da-marca]')?.getAttribute('data-pose')).toBe('acenando')
    // `data-onca` é da onça assinada, a que um agente produziu: a da marca não o leva, para nenhuma conta de "onça de agente" a contar.
    expect(container.querySelectorAll('[data-onca]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-parte="movimento"] path')).toHaveLength(2)
    // @ts-expect-error a onça da marca não escolhe a pose: ela acena
    render(<OncaDaMarca tamanho={88} pose="pensando" />)
    // @ts-expect-error nem aceita um agente: ela não assina
    render(<OncaDaMarca tamanho={88} agente="tutor" />)
    // @ts-expect-error o tamanho é um dos dois da entrada
    render(<OncaDaMarca tamanho={120} />)
  })

  it('o desenho é o da `Onca` acenando, traço por traço: não há um segundo desenho para a marca', () => {
    const marca = render(<OncaDaMarca tamanho={160} animada={false} />)
    const dela = semIdsDoDesenho(marca.container.querySelector('svg')?.innerHTML ?? '')
    marca.unmount()
    const agente = render(<Onca pose="acenando" agente="tutor" tamanho={160} animada={false} />)
    expect(semIdsDoDesenho(agente.container.querySelector('svg')?.innerHTML ?? '')).toBe(dela)
    expect(dela.length).toBeGreaterThan(1000)
  })

  it('a `Onca` continua exigindo o agente e continua assinada', () => {
    const { container } = render(<Onca pose="acenando" agente="tutor" tamanho={160} animada={false} />)
    expect(container.querySelectorAll('figcaption[data-onca-assinatura] [data-selo-ia]')).toHaveLength(1)
    expect(container.querySelector('figure')?.hasAttribute('aria-hidden')).toBe(false)
  })

  it('o tamanho é só o tamanho: 160 no painel, 88 acima do formulário', () => {
    for (const tamanho of [160, 88] as const) {
      const { container, unmount } = render(<OncaDaMarca tamanho={tamanho} animada={false} />)
      const svg = container.querySelector('svg') as SVGElement
      expect(svg.getAttribute('width')).toBe(String(tamanho))
      expect(svg.getAttribute('height')).toBe(String(tamanho))
      unmount()
    }
  })
})

describe('OncaDaMarca: o movimento é o que já existe, uma vez', () => {
  it('animada, entra e acena; parada, nenhum dos dois', () => {
    const animada = render(<OncaDaMarca tamanho={160} animada />)
    expect(animada.container.querySelector('svg')?.getAttribute('class')).toContain('onca-animada')
    expect(animada.container.querySelectorAll('.onca-entra')).toHaveLength(1)
    expect(animada.container.querySelectorAll('.onca-acena')).toHaveLength(1)
    animada.unmount()
    const parada = render(<OncaDaMarca tamanho={88} animada={false} />)
    expect(parada.container.querySelector('svg')?.getAttribute('class')).not.toContain('onca-animada')
    expect(parada.container.querySelectorAll('.onca-entra, .onca-acena')).toHaveLength(0)
  })

  it('nenhuma animação da onça tem `infinite`, e a peça não tem temporizador, estilo nem `animate`', () => {
    vi.useFakeTimers()
    expect(CSS).not.toMatch(/infinite/)
    const { container } = render(<OncaDaMarca tamanho={160} animada />)
    expect(vi.getTimerCount()).toBe(0)
    expect(container.querySelectorAll('animate, animateTransform, animateMotion, set, style, script, foreignObject, image, img')).toHaveLength(0)
    for (const elemento of container.querySelectorAll('*')) {
      expect(elemento.hasAttribute('style'), elemento.outerHTML).toBe(false)
      expect(elemento.getAttribute('class') ?? '', elemento.outerHTML).not.toMatch(/infinite|pulse|spin|bounce|ping/)
    }
    const codigo = codigoSemComentarioNemTexto(readFileSync(join(import.meta.dirname, 'OncaDaMarca.tsx'), 'utf8'))
    expect(codigo).not.toMatch(/\b(?:setTimeout|setInterval|requestAnimationFrame|useEffect|useLayoutEffect|useState|useReducer|useRef)\b/)
  })

  it('acena uma vez por sessão da página: a segunda onça da marca fica parada', () => {
    const primeira = render(<OncaDaMarca tamanho={160} animada />)
    expect(primeira.container.querySelectorAll('.onca-acena')).toHaveLength(1)
    primeira.unmount()
    // A marca de "já acenou" é gravada num efeito da primeira; a seguinte não acena.
    const segunda = render(<OncaDaMarca tamanho={160} animada />)
    expect(segunda.container.querySelectorAll('.onca-acena')).toHaveLength(0)
  })

  it('o aceno da marca não gasta o da onça do agente, nem o contrário: a introdução ainda acena depois da entrada', () => {
    const marca = render(<OncaDaMarca tamanho={160} animada />)
    expect(marca.container.querySelectorAll('.onca-acena')).toHaveLength(1)
    // A entrada leva à introdução do papel sem recarregar a página: a onça dela acena, mesmo com a da marca já gasta.
    const introducao = render(<Onca pose="acenando" agente="assistente_de_ensino" tamanho={120} />)
    expect(introducao.container.querySelectorAll('.onca-acena')).toHaveLength(1)
    introducao.unmount()
    marca.unmount()
    // E a ordem contrária: a onça do agente já acenou, e a da marca ainda acena.
    expect(render(<OncaDaMarca tamanho={160} animada />).container.querySelectorAll('.onca-acena'), 'a marca gasta já foi para o agente').toHaveLength(0)
    cleanup()
    esquecerQueAcenou()
    render(<Onca pose="acenando" agente="tutor" tamanho={120} />)
    cleanup()
    expect(render(<OncaDaMarca tamanho={160} animada />).container.querySelectorAll('.onca-acena'), 'o agente gastou o dele, não o da marca').toHaveLength(1)
  })
})
