// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ModuloDoTema from './theme'

/**
 * A aparência da pessoa (RF3, RF4 e RF24 da X1; Tech Spec, seção 5): a conta que escolhe o tema, o script do `index.html`
 * que a repete antes do primeiro quadro, e o que `theme.ts` guarda, aplica e acompanha. O `jsdom` não tem `matchMedia`:
 * cada caso instala o que precisa.
 *
 * O módulo guarda a escolha que o armazenamento recusou: cada caso o carrega de novo, para um não herdar do outro.
 */
let tema: typeof ModuloDoTema

const html = () => document.documentElement

/** Um `matchMedia` falso: `escuro` é o que o aparelho diz agora, e `mudarOSistema` é o aparelho trocando de tema. */
function instalarSistema(escuro: boolean) {
  const ouvintes = new Set<() => void>()
  const estado = { escuro }
  const consulta = {
    get matches() {
      return estado.escuro
    },
    addEventListener: (_tipo: string, ouvinte: () => void) => ouvintes.add(ouvinte),
    removeEventListener: (_tipo: string, ouvinte: () => void) => ouvintes.delete(ouvinte),
  }
  vi.stubGlobal('matchMedia', vi.fn(() => consulta))
  return {
    ouvintes,
    mudarOSistema(novo: boolean) {
      estado.escuro = novo
      for (const ouvinte of ouvintes) ouvinte()
    },
  }
}

beforeEach(async () => {
  vi.resetModules()
  window.localStorage.clear()
  html().removeAttribute('data-tema')
  tema = await import('./theme')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  window.localStorage.clear()
})

/** A tabela de casos que `resolverTema` e o script do `index.html` respondem igual. */
const ESCOLHAS: readonly (string | null)[] = ['claro', 'escuro', null, 'roxo', 'sistema', '', 'ESCURO']

describe('resolverTema', () => {
  it.each([
    ['claro', false, 'claro'],
    ['claro', true, 'claro'],
    ['escuro', false, 'escuro'],
    ['escuro', true, 'escuro'],
    [null, false, 'claro'],
    [null, true, 'escuro'],
  ] as const)('escolha %s com o sistema escuro=%s: %s (a escolha vence o sistema; sem escolha, vale o sistema)', (escolha, sistemaEscuro, esperado) => {
    expect(tema.resolverTema(escolha, sistemaEscuro)).toBe(esperado)
  })

  it('valor que não é claro nem escuro vale o sistema: o que está no navegador nunca é confiado', () => {
    for (const lixo of ['roxo', 'sistema', '', 'ESCURO', ' claro', 'undefined']) {
      expect(tema.resolverTema(lixo, false), lixo).toBe('claro')
      expect(tema.resolverTema(lixo, true), lixo).toBe('escuro')
    }
    expect(tema.resolverTema(undefined, true)).toBe('escuro')
  })
})

describe('o <script> do index.html', () => {
  /** O primeiro `<script>` sem atributo do arquivo: o do tema. O `type="module"` da entrada não casa. */
  function scriptDoTema(): string {
    const arquivo = readFileSync(join(import.meta.dirname, '..', 'index.html'), 'utf8')
    const achados = [...arquivo.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    expect(achados, 'o index.html tem exatamente um script em linha, o do tema').toHaveLength(1)
    return achados[0]?.[1] ?? ''
  }

  interface Ambiente {
    /** O que `localStorage.getItem` devolve; `'lança'` faz a leitura lançar. */
    readonly guardado: string | null | 'lança'
    /** O `matchMedia`: `sem` o apaga, `lança` faz a chamada lançar, e um booleano é `matches`. */
    readonly sistema: boolean | 'sem' | 'lança'
  }

  /** Roda o script do arquivo contra um `window` e um `document` falsos e devolve o que ele escreveu em `data-tema`. */
  function rodarOScript({ guardado, sistema }: Ambiente): string | undefined {
    const escritos: Record<string, string> = {}
    const janela: Record<string, unknown> = {
      localStorage: {
        getItem: (chave: string) => {
          // O mesmo script lê também a letra do aluno (`text-size.test.ts` a confere): aqui ela nunca foi escolhida.
          expect(['educa.aparencia', 'educa.letra']).toContain(chave)
          if (guardado === 'lança') throw new Error('armazenamento recusado')
          return chave === 'educa.letra' ? null : guardado
        },
      },
    }
    if (sistema !== 'sem') {
      janela['matchMedia'] = (consulta: string) => {
        expect(consulta).toBe('(prefers-color-scheme: dark)')
        if (sistema === 'lança') throw new Error('matchMedia recusado')
        return { matches: sistema }
      }
    }
    const documento = { documentElement: { setAttribute: (nome: string, valor: string) => (escritos[nome] = valor) } }
    expect(() => new Function('window', 'document', scriptDoTema())(janela, documento)).not.toThrow()
    return escritos['data-tema']
  }

  const SISTEMAS = [false, true] as const

  it.each(ESCOLHAS.flatMap((guardado) => SISTEMAS.map((sistema) => [guardado, sistema] as const)))(
    'escolha %j com o sistema escuro=%s: o data-tema é o que resolverTema devolve',
    (guardado, sistema) => {
      expect(rodarOScript({ guardado, sistema })).toBe(tema.resolverTema(guardado, sistema))
    },
  )

  it('leitura que lança cai no sistema, e matchMedia que falta ou lança cai no claro: o script nunca lança', () => {
    // Sem escolha legível, vale o aparelho.
    expect(rodarOScript({ guardado: 'lança', sistema: true })).toBe('escuro')
    expect(rodarOScript({ guardado: 'lança', sistema: false })).toBe('claro')
    // Sem `matchMedia`, o claro; com a escolha, a escolha.
    expect(rodarOScript({ guardado: null, sistema: 'sem' })).toBe('claro')
    expect(rodarOScript({ guardado: null, sistema: 'lança' })).toBe('claro')
    expect(rodarOScript({ guardado: 'escuro', sistema: 'sem' })).toBe('escuro')
    expect(rodarOScript({ guardado: 'lança', sistema: 'lança' })).toBe('claro')
  })

  it('só escreve claro ou escuro, e nunca o texto que leu', () => {
    for (const guardado of ['<img src=x onerror=alert(1)>', 'roxo', '"escuro"']) {
      expect(['claro', 'escuro'], guardado).toContain(rodarOScript({ guardado, sistema: false }))
    }
  })

  it('o arquivo declara o color-scheme do documento, que cobre o intervalo sem CSS', () => {
    const arquivo = readFileSync(join(import.meta.dirname, '..', 'index.html'), 'utf8')
    expect(arquivo).toMatch(/<meta name="color-scheme" content="light dark" \/>/)
  })

  it('o Playwright fixa o aparelho no claro: o oráculo em rgb() dos specs não depende da máquina que roda', () => {
    const configuracao = readFileSync(join(import.meta.dirname, '..', '..', '..', 'playwright.config.ts'), 'utf8')
    expect(configuracao).toMatch(/\bcolorScheme:\s*'light'/)
  })

  it('o CSS declara o color-scheme dos dois temas: o Claro escolhido sobre um aparelho escuro não deixa o documento escuro', () => {
    const css = readFileSync(join(import.meta.dirname, 'index.css'), 'utf8')
    expect(css).toMatch(/:root\[data-tema='claro'\]\s*\{\s*color-scheme:\s*light;\s*\}/)
    expect(css).toMatch(/:root\[data-tema='escuro'\]\s*\{\s*color-scheme:\s*dark;/)
  })
})

describe('guardar, aplicar e acompanhar a aparência', () => {
  it('sem escolha, a aparência é Sistema e o localStorage continua vazio, também depois de aplicar o tema', () => {
    instalarSistema(false)
    expect(tema.lerAparencia()).toBe('sistema')
    expect(tema.aplicarTema()).toBe('claro')
    expect(html().getAttribute('data-tema')).toBe('claro')
    expect(window.localStorage.length).toBe(0)
  })

  it('Claro e Escuro gravam só o valor, na chave da aparência; Sistema apaga a chave e o armazenamento volta a nada', () => {
    instalarSistema(true)
    tema.escolherAparencia('claro')
    expect(Object.entries(window.localStorage)).toEqual([['educa.aparencia', 'claro']])
    expect(html().getAttribute('data-tema')).toBe('claro')

    tema.escolherAparencia('escuro')
    expect(Object.entries(window.localStorage)).toEqual([['educa.aparencia', 'escuro']])
    expect(html().getAttribute('data-tema')).toBe('escuro')

    // O sistema está escuro, e o claro foi escolhido: a escolha venceu. Agora, de volta a Sistema.
    tema.escolherAparencia('claro')
    expect(html().getAttribute('data-tema')).toBe('claro')
    tema.escolherAparencia('sistema')
    expect(Object.entries(window.localStorage)).toEqual([])
    expect(tema.lerAparencia()).toBe('sistema')
    expect(html().getAttribute('data-tema')).toBe('escuro')
  })

  it('o que está na chave e não é claro nem escuro é Sistema, e o tema escrito é o do aparelho', () => {
    instalarSistema(true)
    window.localStorage.setItem('educa.aparencia', 'roxo')
    expect(tema.lerAparencia()).toBe('sistema')
    expect(tema.aplicarTema()).toBe('escuro')
  })

  it('armazenamento que lança ao ler e ao gravar: a aparência é Sistema, nada quebra, e a escolha vale até a aba fechar', () => {
    instalarSistema(false)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('armazenamento recusado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('armazenamento recusado')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('armazenamento recusado')
    })
    expect(tema.lerAparencia()).toBe('sistema')
    expect(() => tema.aplicarTema()).not.toThrow()
    expect(html().getAttribute('data-tema')).toBe('claro')

    expect(() => tema.escolherAparencia('escuro')).not.toThrow()
    expect(tema.lerAparencia()).toBe('escuro')
    expect(html().getAttribute('data-tema')).toBe('escuro')

    // Voltar a Sistema também vale na aba, ainda que a chave não possa ser apagada.
    expect(() => tema.escolherAparencia('sistema')).not.toThrow()
    expect(tema.lerAparencia()).toBe('sistema')
    expect(html().getAttribute('data-tema')).toBe('claro')
  })

  it('o armazenamento que volta a funcionar volta a ser a fonte da escolha: a gravação recusada não fica mais forte que a que valeu', () => {
    instalarSistema(false)
    const recusa = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('armazenamento recusado')
    })
    tema.escolherAparencia('escuro')
    expect(tema.lerAparencia()).toBe('escuro')
    expect(window.localStorage.length).toBe(0)
    recusa.mockRestore()

    tema.escolherAparencia('claro')
    expect(tema.lerAparencia()).toBe('claro')
    expect(html().getAttribute('data-tema')).toBe('claro')
    expect(Object.fromEntries(Object.entries(window.localStorage))).toEqual({ 'educa.aparencia': 'claro' })
  })

  it('sem matchMedia, o claro; com a escolha, a escolha', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(tema.aplicarTema()).toBe('claro')
    tema.escolherAparencia('escuro')
    expect(html().getAttribute('data-tema')).toBe('escuro')
  })

  it('iniciarTema: em Sistema, a página aberta acompanha o aparelho; com uma escolha, não', () => {
    const aparelho = instalarSistema(false)
    const desligar = tema.iniciarTema()
    expect(html().getAttribute('data-tema')).toBe('claro')

    aparelho.mudarOSistema(true)
    expect(html().getAttribute('data-tema')).toBe('escuro')
    aparelho.mudarOSistema(false)
    expect(html().getAttribute('data-tema')).toBe('claro')

    tema.escolherAparencia('claro')
    aparelho.mudarOSistema(true)
    expect(html().getAttribute('data-tema')).toBe('claro')

    desligar()
    expect(aparelho.ouvintes.size).toBe(0)
  })

  it('iniciarTema: a escolha feita em outra aba chega pelo evento storage, e só a da chave da aparência conta', () => {
    instalarSistema(false)
    const desligar = tema.iniciarTema()
    window.localStorage.setItem('educa.aparencia', 'escuro')
    window.dispatchEvent(new StorageEvent('storage', { key: 'educa.aparencia', newValue: 'escuro' }))
    expect(tema.lerAparencia()).toBe('escuro')
    expect(html().getAttribute('data-tema')).toBe('escuro')

    // Outra chave não é conosco: o tema fica como está, mesmo que o armazenamento tenha mudado por baixo.
    window.localStorage.removeItem('educa.aparencia')
    window.dispatchEvent(new StorageEvent('storage', { key: 'educa.lateral-recolhida', newValue: 'sim' }))
    expect(html().getAttribute('data-tema')).toBe('escuro')

    // A outra aba voltou a Sistema: a chave sumiu.
    window.dispatchEvent(new StorageEvent('storage', { key: 'educa.aparencia', newValue: null }))
    expect(html().getAttribute('data-tema')).toBe('claro')

    // E o armazenamento inteiro limpo (`key` nulo) também vale.
    window.localStorage.setItem('educa.aparencia', 'escuro')
    window.dispatchEvent(new StorageEvent('storage', { key: 'educa.aparencia', newValue: 'escuro' }))
    window.localStorage.clear()
    window.dispatchEvent(new StorageEvent('storage', { key: null }))
    expect(html().getAttribute('data-tema')).toBe('claro')

    desligar()
    window.localStorage.setItem('educa.aparencia', 'escuro')
    window.dispatchEvent(new StorageEvent('storage', { key: 'educa.aparencia', newValue: 'escuro' }))
    expect(html().getAttribute('data-tema')).toBe('claro')
  })

  it('a escolha de outra aba vale mais do que a que esta aba guardou na memória por falta de armazenamento', () => {
    instalarSistema(false)
    const desligar = tema.iniciarTema()
    const recusa = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('armazenamento recusado')
    })
    tema.escolherAparencia('escuro')
    expect(tema.lerAparencia()).toBe('escuro')
    recusa.mockRestore()

    window.localStorage.setItem('educa.aparencia', 'claro')
    window.dispatchEvent(new StorageEvent('storage', { key: 'educa.aparencia', newValue: 'claro' }))
    expect(tema.lerAparencia()).toBe('claro')
    expect(html().getAttribute('data-tema')).toBe('claro')
    desligar()
  })
})
