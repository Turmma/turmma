// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { TEXT_SIZE_STORAGE_KEY, escolherLetra, iniciarLetra, lerLetra, noCaminhoDoAluno, resolverLetra, useApplyTextSize } from './text-size'

/**
 * O tamanho da letra do aluno (telas do aluno e primeiro acesso, 8.0; RF11; Tech Spec, seção 5): a conta que lê o valor, o
 * script do `index.html` que a repete antes do primeiro quadro, o que `text-size.ts` guarda e aplica, e o hook que prende o
 * `data-letra` ao endereço da área do aluno. O armazenamento é o do `jsdom`; o que recusa é um `Storage` que lança.
 * A medida (20 px no `<html>`), o primeiro quadro de verdade e o aluno seguinte são do e2e (`e2e/tamanho-da-letra.spec.ts`).
 */
const html = () => document.documentElement
const guardado = () => Object.entries(window.localStorage)

beforeEach(() => {
  window.localStorage.clear()
  html().removeAttribute('data-letra')
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  // A escolha que o armazenamento recusou fica na memória do módulo, até uma gravação que funcione.
  escolherLetra('padrao')
  window.localStorage.clear()
})

describe('resolverLetra', () => {
  it.each([
    ['grande', 'grande'],
    ['maior', 'maior'],
    [null, 'padrao'],
    [undefined, 'padrao'],
    ['padrao', 'padrao'],
    ['xyz', 'padrao'],
    ['', 'padrao'],
    ['MAIOR', 'padrao'],
    [' grande', 'padrao'],
  ] as const)('o valor %j vira %s: o que está no navegador nunca é confiado', (valor, esperado) => {
    expect(resolverLetra(valor)).toBe(esperado)
  })
})

describe('noCaminhoDoAluno', () => {
  it.each([
    ['/aluno', true],
    ['/aluno/inicio', true],
    ['/aluno/tarefas/abc', true],
    ['/alunos', false],
    ['/alunoX', false],
    ['/professor/aluno', false],
    ['/coordenacao', false],
    ['/', false],
    ['/entrar', false],
  ] as const)('%s: %s', (caminho, esperado) => {
    expect(noCaminhoDoAluno(caminho)).toBe(esperado)
  })
})

describe('o <script> do index.html', () => {
  /** O primeiro `<script>` sem atributo do arquivo: o do tema, que também escreve a letra. */
  function scriptEmLinha(): string {
    const arquivo = readFileSync(join(import.meta.dirname, '..', 'index.html'), 'utf8')
    const achados = [...arquivo.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    expect(achados, 'o index.html tem exatamente um script em linha').toHaveLength(1)
    return achados[0]?.[1] ?? ''
  }

  interface Ambiente {
    /** O que `localStorage.getItem('educa.letra')` devolve; `'lança'` faz a leitura lançar. */
    readonly letra: string | null | 'lança'
    /** O `location.pathname`; `sem` apaga o `location`. */
    readonly caminho: string | 'sem'
  }

  /** Roda o script do arquivo contra um `window` e um `document` falsos e devolve o que ele escreveu em `data-letra`. */
  function rodarOScript({ letra, caminho }: Ambiente): string | undefined {
    const escritos: Record<string, string> = {}
    const janela: Record<string, unknown> = {
      localStorage: {
        getItem: (chave: string) => {
          if (chave === 'educa.letra' && letra === 'lança') throw new Error('armazenamento recusado')
          return chave === 'educa.letra' ? letra : null
        },
      },
      matchMedia: () => ({ matches: false }),
    }
    if (caminho !== 'sem') janela['location'] = { pathname: caminho }
    const documento = { documentElement: { setAttribute: (nome: string, valor: string) => (escritos[nome] = valor) } }
    expect(() => new Function('window', 'document', scriptEmLinha())(janela, documento)).not.toThrow()
    return escritos['data-letra']
  }

  const VALORES = ['grande', 'maior', null, 'padrao', 'xyz', '', 'MAIOR', '<img src=x onerror=alert(1)>'] as const
  const CAMINHOS = ['/aluno', '/aluno/inicio', '/alunos', '/professor/nova-conversa', '/coordenacao', '/', '/entrar'] as const

  it.each(VALORES.flatMap((letra) => CAMINHOS.map((caminho) => [letra, caminho] as const)))(
    'letra %j em %s: escreve o que resolverLetra devolve, e só em /aluno',
    (letra, caminho) => {
      const resolvida = resolverLetra(letra)
      const esperado = noCaminhoDoAluno(caminho) && resolvida !== 'padrao' ? resolvida : undefined
      expect(rodarOScript({ letra, caminho })).toBe(esperado)
    },
  )

  it('armazenamento que lança ou página sem location: o script nunca lança e não escreve a letra', () => {
    expect(rodarOScript({ letra: 'lança', caminho: '/aluno' })).toBeUndefined()
    expect(rodarOScript({ letra: 'maior', caminho: 'sem' })).toBeUndefined()
  })

  it('só escreve grande ou maior, e nunca o texto que leu', () => {
    for (const letra of ['<img src=x onerror=alert(1)>', 'roxo', '"maior"']) {
      expect(['grande', 'maior', undefined], letra).toContain(rodarOScript({ letra, caminho: '/aluno' }))
    }
  })
})

describe('guardar a escolha', () => {
  it('sem escolha a letra é Padrão e o localStorage continua vazio', () => {
    expect(lerLetra()).toBe('padrao')
    expect(guardado()).toEqual([])
  })

  it('Grande e Maior gravam só o valor, na chave da letra; Padrão apaga a chave e o armazenamento volta a nada', () => {
    escolherLetra('grande')
    expect(guardado()).toEqual([[TEXT_SIZE_STORAGE_KEY, 'grande']])
    expect(lerLetra()).toBe('grande')

    escolherLetra('maior')
    expect(guardado()).toEqual([[TEXT_SIZE_STORAGE_KEY, 'maior']])
    expect(lerLetra()).toBe('maior')

    escolherLetra('padrao')
    expect(guardado()).toEqual([])
    expect(lerLetra()).toBe('padrao')
  })

  it('valor inválido na chave vale Padrão', () => {
    window.localStorage.setItem(TEXT_SIZE_STORAGE_KEY, 'xyz')
    expect(lerLetra()).toBe('padrao')
  })

  it('a gravação que volta a funcionar vale mais que a escolha que a memória guardava', () => {
    const recusa = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('armazenamento recusado')
    })
    escolherLetra('grande')
    expect(lerLetra()).toBe('grande')
    recusa.mockRestore()

    escolherLetra('maior')
    expect(lerLetra()).toBe('maior')
    // A memória foi esvaziada: apagar a chave volta a Padrão, e não à escolha de antes.
    window.localStorage.removeItem(TEXT_SIZE_STORAGE_KEY)
    expect(lerLetra()).toBe('padrao')
  })

  it('armazenamento que recusa leitura e gravação: Padrão na leitura, a escolha vale na sessão e nada lança', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('armazenamento recusado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('armazenamento recusado')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('armazenamento recusado')
    })
    expect(lerLetra()).toBe('padrao')
    expect(() => escolherLetra('maior')).not.toThrow()
    expect(lerLetra()).toBe('maior')
    expect(() => escolherLetra('padrao')).not.toThrow()
    expect(lerLetra()).toBe('padrao')
  })
})

describe('as outras abas', () => {
  /** A escolha desta aba que o armazenamento recusou (só a gravação lança): ela vale na memória, até outra aba falar. */
  function recusarAGravacao(): void {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('armazenamento recusado')
    })
  }

  it('o que outra aba gravou vale mais que a escolha que esta guardou na memória; a chave limpa e o armazenamento inteiro limpo também', () => {
    const desligar = iniciarLetra()
    try {
      recusarAGravacao()
      escolherLetra('grande')
      expect(lerLetra()).toBe('grande')
      vi.restoreAllMocks()

      window.localStorage.setItem(TEXT_SIZE_STORAGE_KEY, 'maior')
      window.dispatchEvent(new StorageEvent('storage', { key: TEXT_SIZE_STORAGE_KEY, newValue: 'maior' }))
      expect(lerLetra()).toBe('maior')

      recusarAGravacao()
      escolherLetra('grande')
      vi.restoreAllMocks()
      window.localStorage.removeItem(TEXT_SIZE_STORAGE_KEY)
      window.dispatchEvent(new StorageEvent('storage', { key: null }))
      expect(lerLetra()).toBe('padrao')
    } finally {
      desligar()
    }
  })

  it('chave de outro assunto não conta: a escolha da memória fica', () => {
    const desligar = iniciarLetra()
    try {
      recusarAGravacao()
      escolherLetra('grande')
      window.dispatchEvent(new StorageEvent('storage', { key: 'educa.aparencia', newValue: 'escuro' }))
      expect(lerLetra()).toBe('grande')
    } finally {
      desligar()
    }
  })

  it('desligado, o evento não chega: a escolha da memória fica', () => {
    iniciarLetra()()
    recusarAGravacao()
    escolherLetra('grande')
    window.dispatchEvent(new StorageEvent('storage', { key: TEXT_SIZE_STORAGE_KEY, newValue: null }))
    expect(lerLetra()).toBe('grande')
  })
})

describe('useTamanhoDaLetra: o data-letra segue o endereço', () => {
  function Prova() {
    useApplyTextSize()
    return null
  }

  function montar(caminho: string) {
    const localizacao = memoryLocation({ path: caminho })
    const tela = render(createElement(Router, { hook: localizacao.hook, children: createElement(Prova) }))
    return { ...localizacao, ...tela }
  }

  it('em /aluno com Maior guardado o atributo vale; ao sair do /aluno ele some, e ao voltar ele volta', () => {
    window.localStorage.setItem(TEXT_SIZE_STORAGE_KEY, 'maior')
    const { navigate } = montar('/aluno/inicio')
    expect(html().getAttribute('data-letra')).toBe('maior')

    act(() => navigate('/professor/nova-conversa'))
    expect(html().hasAttribute('data-letra')).toBe(false)

    act(() => navigate('/aluno/eu'))
    expect(html().getAttribute('data-letra')).toBe('maior')
  })

  it('fora do /aluno a chave não muda nada, e o atributo que o script do primeiro quadro deixou sai (a entrada, depois de /aluno sem sessão)', () => {
    window.localStorage.setItem(TEXT_SIZE_STORAGE_KEY, 'grande')
    html().setAttribute('data-letra', 'grande')
    montar('/entrar')
    expect(html().hasAttribute('data-letra')).toBe(false)
  })

  it('escolher no meio da sessão muda o atributo na hora; Padrão tira o atributo; desmontar também o tira', () => {
    const { unmount } = montar('/aluno/eu')
    expect(html().hasAttribute('data-letra')).toBe(false)

    act(() => escolherLetra('grande'))
    expect(html().getAttribute('data-letra')).toBe('grande')
    act(() => escolherLetra('maior'))
    expect(html().getAttribute('data-letra')).toBe('maior')
    act(() => escolherLetra('padrao'))
    expect(html().hasAttribute('data-letra')).toBe(false)

    act(() => escolherLetra('maior'))
    unmount()
    expect(html().hasAttribute('data-letra')).toBe(false)
  })

  it('o que outra aba grava chega à tela montada pelo aviso do evento storage, sem esta aba escolher nada', () => {
    const desligar = iniciarLetra()
    try {
      montar('/aluno/eu')
      expect(html().hasAttribute('data-letra')).toBe(false)

      window.localStorage.setItem(TEXT_SIZE_STORAGE_KEY, 'maior')
      act(() => {
        window.dispatchEvent(new StorageEvent('storage', { key: TEXT_SIZE_STORAGE_KEY, newValue: 'maior' }))
      })
      expect(html().getAttribute('data-letra')).toBe('maior')

      window.localStorage.removeItem(TEXT_SIZE_STORAGE_KEY)
      act(() => {
        window.dispatchEvent(new StorageEvent('storage', { key: TEXT_SIZE_STORAGE_KEY, newValue: null }))
      })
      expect(html().hasAttribute('data-letra')).toBe(false)
    } finally {
      desligar()
    }
  })

  it('montar e navegar não escrevem nada no armazenamento: só a escolha grava', () => {
    const gravar = vi.spyOn(Storage.prototype, 'setItem')
    const apagar = vi.spyOn(Storage.prototype, 'removeItem')
    const { navigate } = montar('/aluno/inicio')
    act(() => navigate('/aluno/eu'))
    act(() => navigate('/professor'))
    expect(gravar).not.toHaveBeenCalled()
    expect(apagar).not.toHaveBeenCalled()
    expect(guardado()).toEqual([])
  })
})
