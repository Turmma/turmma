import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FERRAMENTAS } from '@educa/shared'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { corDoToken, TEMAS } from '../../../__fixtures__/class-colors'
import { semComentarios } from '../../../__fixtures__/importers'
import { COLOR_FAMILIES } from '../../../components/ui/CountBadge'
import { DESENHO_DA_FERRAMENTA, IconeDeFerramenta } from './icones-de-ferramenta'

/**
 * Os ícones ilustrados das ferramentas (telas do professor, 3.3; `docs/interface.md` 9.4): um desenho para cada ferramenta
 * que existe, só com cor de token, parados e só para os olhos. Que o papel e a linha mudem com o tema é do teste dos ícones
 * dos lugares, que lê os mesmos tokens; aqui está o que o arquivo e o HTML dizem.
 */

const FONTE = readFileSync(join(import.meta.dirname, 'icones-de-ferramenta.tsx'), 'utf8')
const FORMA = /<(?:rect|circle|path|ellipse|polygon|polyline|line)\b[^>]*>/g
const NEUTROS = ['icone-papel', 'icone-linha']

const formasDe = (ferramenta: (typeof FERRAMENTAS)[number]) => renderToStaticMarkup(<IconeDeFerramenta ferramenta={ferramenta} tamanho={48} />).match(FORMA) ?? []
const classesDe = (ferramenta: (typeof FERRAMENTAS)[number]) => formasDe(ferramenta).map((forma) => /class="([^"]+)"/.exec(forma)?.[1] ?? '')

describe('os ícones das ferramentas', () => {
  it('há um desenho para cada ferramenta do contrato, e nenhum a mais', () => {
    expect(Object.keys(DESENHO_DA_FERRAMENTA).sort()).toEqual([...FERRAMENTAS].sort())
    for (const ferramenta of FERRAMENTAS) expect(formasDe(ferramenta).length, ferramenta).toBeGreaterThanOrEqual(3)
  })

  it('só a classe de token pinta: sem hex, função de cor, `style` nem atributo de pintura, e cada token existe nos dois temas', () => {
    expect(FONTE).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(FONTE).not.toMatch(/\b(?:rgba?|hsla?|oklch|color-mix)\(/i)
    expect(FONTE).not.toMatch(/style\s*=/)
    const permitidos = new Set([...COLOR_FAMILIES, ...NEUTROS])
    for (const ferramenta of FERRAMENTAS) {
      for (const forma of formasDe(ferramenta)) expect(forma, `${ferramenta}: ${forma}`).not.toMatch(/\b(?:fill|stroke|stop-color|color)=/)
      for (const classe of classesDe(ferramenta)) {
        expect(classe, `${ferramenta}: a forma não tem uma classe só`).toMatch(/^fill-[a-z-]+$/)
        const token = classe.replace(/^fill-/, '')
        expect(permitidos.has(token as never), `${ferramenta}: ${classe} não é família nem neutro do ícone`).toBe(true)
        for (const tema of TEMAS) expect(corDoToken(tema, token), `${ferramenta}: ${token} no tema ${tema}`).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
  })

  it('cada um pinta com uma família só, mais o papel e a linha, e as três famílias são diferentes', () => {
    const familias = FERRAMENTAS.map((ferramenta) => {
      const usadas = new Set(classesDe(ferramenta).map((classe) => classe.replace(/^fill-/, '')).filter((token) => !NEUTROS.includes(token)))
      expect(usadas.size, `${ferramenta}: famílias`).toBe(1)
      return [...usadas][0]
    })
    expect(new Set(familias).size).toBe(FERRAMENTAS.length)
  })

  it('são chapados e parados: sem contorno, degradê, sombra, texto nem animação', () => {
    for (const ferramenta of FERRAMENTAS) {
      const html = renderToStaticMarkup(<IconeDeFerramenta ferramenta={ferramenta} tamanho={48} />)
      expect(html, ferramenta).not.toMatch(/stroke|gradient|filter|<text|<title|<desc|<image|<animate|<set\b|<style|<defs|opacity/i)
    }
    expect(semComentarios(FONTE)).not.toMatch(/stroke|gradient|<animate|<text|<title|<desc|opacity/i)
  })

  it('são decoração: `aria-hidden`, fora da ordem de foco e sem nome, com o tamanho pedido; o desenho é diferente em cada ferramenta', () => {
    const html = FERRAMENTAS.map((ferramenta) => renderToStaticMarkup(<IconeDeFerramenta ferramenta={ferramenta} tamanho={24} />))
    for (const marca of html) {
      expect(marca).toContain('aria-hidden="true"')
      expect(marca).toContain('focusable="false"')
      expect(marca).toContain('width="24"')
      expect(marca).not.toMatch(/role=|aria-label=/)
    }
    expect(new Set(html).size).toBe(FERRAMENTAS.length)
    expect(new Set(FERRAMENTAS.map((ferramenta) => formasDe(ferramenta).join(''))).size).toBe(FERRAMENTAS.length)
  })
})
