import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { brotliCompressSync } from 'node:zlib'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { tokenColor, TEMAS } from '../../../__fixtures__/class-colors'
import { stripComments } from '../../../__fixtures__/importers'
import { COLOR_FAMILIES } from '../CountBadge'
import { Icon } from '../Icon'
import { PLACE_DRAWINGS, PLACE_NAMES, type PlaceName } from './places'

/**
 * Os ícones ilustrados dos lugares (`docs/interface.md` 9.4; Tech Spec da X1, seções 7c e 9; os quatro da coordenação, na X2): o que cada desenho
 * pode ter, a cor que ele lê, e o peso. Que o `fill` do papel seja `#EFEFEF` no claro e `#37464F` no escuro é do e2e da
 * galeria (`e2e/components-brand-icons.spec.ts`), que lê o estilo calculado; aqui está o que o arquivo e o HTML dizem.
 */

const FONTE = readFileSync(join(import.meta.dirname, 'places.tsx'), 'utf8')

/** As formas de um desenho, como saem no HTML, na ordem em que foram escritas. */
const FORMA = /<(?:rect|circle|path|ellipse|polygon|polyline|line)\b[^>]*>/g

function formasDe(nome: PlaceName): string[] {
  const Desenho = PLACE_DRAWINGS[nome]
  return renderToStaticMarkup(<Desenho />).match(FORMA) ?? []
}

/** A classe de cada forma, na ordem. */
function classesDe(nome: PlaceName): string[] {
  return formasDe(nome).map((forma) => /class="([^"]+)"/.exec(forma)?.[1] ?? '')
}

/** O nome do token de cada classe `fill-*`: `fill-icone-papel` é `icone-papel`. */
const tokenDa = (classe: string) => classe.replace(/^fill-/, '')

const NEUTROS = ['icone-papel', 'icone-linha']

describe('os ícones dos lugares', () => {
  it('são os quatro da X1, os quatro da coordenação (X2) e o de Criados (X3), e cada nome tem um desenho', () => {
    expect([...PLACE_NAMES]).toEqual(['inicio', 'turmas', 'tarefas', 'ferramentas', 'painel', 'ia', 'escola', 'registros', 'criados'])
    expect(Object.keys(PLACE_DRAWINGS).sort()).toEqual([...PLACE_NAMES].sort())
    for (const nome of PLACE_NAMES) expect(formasDe(nome).length, nome).toBeGreaterThan(0)
  })

  it('nenhuma cor é escrita: sem hex, função de cor, `style` nem atributo de pintura, só classe', () => {
    expect(FONTE).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(FONTE).not.toMatch(/\b(?:rgba?|hsla?|oklch|color-mix)\(/i)
    expect(FONTE).not.toMatch(/style\s*=/)
    // A cor é de classe: nada de `fill="…"` nem `stroke="…"` nas formas.
    for (const nome of PLACE_NAMES) {
      for (const forma of formasDe(nome)) expect(forma, `${nome}: ${forma}`).not.toMatch(/\b(?:fill|stroke|stop-color|color)=/)
    }
  })

  it('toda forma pinta com `fill-<família>`, `fill-icone-papel` ou `fill-icone-linha`, e o nome é token nos dois temas', () => {
    const permitidos = new Set([...COLOR_FAMILIES, ...NEUTROS])
    for (const nome of PLACE_NAMES) {
      for (const classe of classesDe(nome)) {
        expect(classe, `${nome}: a forma não tem uma classe só`).toMatch(/^fill-[a-z-]+$/)
        const token = tokenDa(classe)
        expect(permitidos.has(token as never), `${nome}: ${classe} não é família nem neutro do ícone`).toBe(true)
        for (const tema of TEMAS) expect(tokenColor(tema, token), `${nome}: ${token} no tema ${tema}`).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
  })

  it('o papel e a linha mudam com o tema: valores diferentes no claro e no escuro, e a linha não é o papel', () => {
    expect(tokenColor('claro', 'icone-papel')).toBe('#efefef')
    expect(tokenColor('escuro', 'icone-papel')).toBe('#37464f')
    expect(tokenColor('claro', 'icone-linha')).toBe('#d7d7d7')
    expect(tokenColor('escuro', 'icone-linha')).toBe('#52656d')
  })

  it('cada um tem de 3 a 10 formas, e de duas a três cores (a exceção é a das ferramentas, com quatro)', () => {
    for (const nome of PLACE_NAMES) {
      const formas = formasDe(nome).length
      expect(formas, `${nome}: formas`).toBeGreaterThanOrEqual(3)
      expect(formas, `${nome}: formas`).toBeLessThanOrEqual(10)
      const cores = new Set(classesDe(nome))
      expect(cores.size, `${nome}: cores`).toBeGreaterThanOrEqual(nome === 'ferramentas' ? 4 : 2)
      expect(cores.size, `${nome}: cores`).toBeLessThanOrEqual(nome === 'ferramentas' ? 4 : 3)
    }
  })

  it('cada forma tem a cor que a 9.4 dá a ela, na ordem do desenho: a família no que é do lugar, o papel e a linha no resto', () => {
    expect(classesDe('inicio')).toEqual(['fill-laranja', 'fill-icone-papel', 'fill-laranja', 'fill-laranja', 'fill-icone-linha', 'fill-icone-linha'])
    expect(classesDe('turmas')).toEqual(['fill-icone-linha', 'fill-icone-linha', 'fill-icone-linha', 'fill-icone-linha', 'fill-turquesa', 'fill-turquesa'])
    expect(classesDe('tarefas')).toEqual(['fill-azul', 'fill-icone-papel', 'fill-icone-linha', 'fill-azul', 'fill-azul'])
    expect(classesDe('ferramentas')).toEqual(['fill-laranja', 'fill-azul', 'fill-verde', 'fill-roxo'])
    // X2: o painel e a IA em anil, a escola em azul e os registros em amarelo, com a família de cada lugar (9.4).
    expect(classesDe('painel')).toEqual(['fill-anil', 'fill-icone-papel', 'fill-anil', 'fill-anil', 'fill-anil'])
    expect(classesDe('ia')).toEqual(['fill-anil', 'fill-icone-papel', 'fill-icone-papel', 'fill-icone-papel'])
    expect(classesDe('escola')).toEqual(['fill-icone-linha', 'fill-azul', 'fill-azul', 'fill-icone-papel', 'fill-icone-papel', 'fill-icone-papel'])
    expect(classesDe('registros')).toEqual(['fill-amarelo', 'fill-icone-papel', 'fill-icone-linha', 'fill-icone-linha', 'fill-icone-linha'])
    // X3 (5.0): Criados em amarelo, a pasta de trás, a folha de trás na linha, a da frente no papel com a linha escrita, e a frente da pasta.
    expect(classesDe('criados')).toEqual(['fill-amarelo', 'fill-icone-linha', 'fill-icone-papel', 'fill-icone-linha', 'fill-amarelo'])
  })

  it('as ferramentas são os quatro quadradinhos, laranja, azul, verde e roxo, nessa ordem de leitura', () => {
    const formas = formasDe('ferramentas')
    expect(formas).toHaveLength(4)
    expect(classesDe('ferramentas')).toEqual(['fill-laranja', 'fill-azul', 'fill-verde', 'fill-roxo'])
    // A ordem de leitura é a do desenho: em cima à esquerda e à direita, embaixo à esquerda e à direita.
    const posicoes = formas.map((forma) => [Number(/\bx="([\d.]+)"/.exec(forma)?.[1]), Number(/\by="([\d.]+)"/.exec(forma)?.[1])])
    expect(posicoes[0]?.[1]).toBe(posicoes[1]?.[1])
    expect(posicoes[2]?.[1]).toBe(posicoes[3]?.[1])
    expect(posicoes[0]?.[0]).toBe(posicoes[2]?.[0])
    expect(posicoes[1]?.[0]).toBe(posicoes[3]?.[0])
    expect(posicoes[0]?.[1]).toBeLessThan(posicoes[2]?.[1] ?? 0)
    expect(posicoes[0]?.[0]).toBeLessThan(posicoes[1]?.[0] ?? 0)
  })

  it('são chapados e parados: sem contorno, degradê, sombra, texto nem animação', () => {
    for (const nome of PLACE_NAMES) {
      const html = renderToStaticMarkup(<Icon nome={nome} tamanho={48} />)
      expect(html, nome).not.toMatch(/stroke|gradient|filter|<text|<title|<desc|<image|<animate|<set\b|<style|<defs|opacity/i)
    }
    // E o fonte, sem os comentários: o que o desenho diz de si não conta, o que ele escreve sim.
    expect(stripComments(FONTE)).not.toMatch(/stroke|gradient|<animate|<text|<title|<desc|opacity/i)
  })

  it('cada um é um desenho diferente dos outros três', () => {
    const html = PLACE_NAMES.map((nome) => renderToStaticMarkup(<Icon nome={nome} tamanho={48} />))
    expect(new Set(html).size).toBe(PLACE_NAMES.length)
    const formas = PLACE_NAMES.map((nome) => formasDe(nome).join(''))
    expect(new Set(formas).size).toBe(PLACE_NAMES.length)
  })

  it('o peso: o HTML dos oito, em brotli, cabe nos 3 kB que a entrada reserva (de 4 kB; a Tech Spec, seção 7c)', () => {
    const html = PLACE_NAMES.map((nome) => renderToStaticMarkup(<Icon nome={nome} tamanho={48} />)).join('')
    const bytes = brotliCompressSync(Buffer.from(html)).length
    expect(bytes).toBeGreaterThan(200)
    expect(bytes).toBeLessThanOrEqual(3_000)
  })

  it('o peso dos quatro da coordenação: até 1 kB em brotli, que é o que a Tech Spec da X2 (seção 7c) dá para eles ficarem ilustrados', () => {
    const html = (['painel', 'ia', 'escola', 'registros'] as const).map((nome) => renderToStaticMarkup(<Icon nome={nome} tamanho={48} />)).join('')
    expect(brotliCompressSync(Buffer.from(html)).length).toBeLessThanOrEqual(1_000)
  })
})
