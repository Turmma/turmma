// @vitest-environment jsdom
import { TAMANHO_MAXIMO_CODIGO_DIGITADO, TAMANHO_MAXIMO_TOKEN_DE_CONVITE } from '@educa/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apagarCaminhoDaSala, CAMINHO_DA_SALA_STORAGE_KEY, guardarCaminhoDaSala, lerCaminhoDaSala, VALIDADE_DO_CAMINHO_DA_SALA_MS } from './caminho-da-sala'

/**
 * O caminho da sala que atravessa a ida ao provedor da conta da escola (acesso-e-convites, 16.0; `cenarios.md`, "Conta da escola do aluno"): numa chave só do `sessionStorage`, com o
 * slug e a hora, lido sem apagar, vencido em 15 min, de um slug só, com a forma exata. O que vai e volta pelo navegador de verdade está em `e2e/conta-da-escola-na-sala.spec.ts`.
 */
const SLUG = 'colegio-a'
const TOKEN = 'token-do-link-da-sala'
const CODIGO = 'ABCD2345'
const AGORA = 1_800_000_000_000

afterEach(() => {
  window.sessionStorage.clear()
  window.localStorage.clear()
  vi.restoreAllMocks()
})

/** Grava à mão o que `guardarCaminhoDaSala` gravaria, para o caso mudar um campo só. */
function gravar(campos: Record<string, unknown>): void {
  window.sessionStorage.setItem(CAMINHO_DA_SALA_STORAGE_KEY, JSON.stringify({ slug: SLUG, tipo: 'link', valor: TOKEN, em: AGORA, ...campos }))
}

describe('guardar e ler o caminho da sala', () => {
  it('o link volta como token, e o código como código', () => {
    expect(guardarCaminhoDaSala(SLUG, { tipo: 'link', token: TOKEN }, AGORA)).toBe(true)
    expect(lerCaminhoDaSala(SLUG, AGORA)).toEqual({ tipo: 'link', token: TOKEN })
    expect(guardarCaminhoDaSala(SLUG, { tipo: 'codigo', codigo: CODIGO }, AGORA)).toBe(true)
    expect(lerCaminhoDaSala(SLUG, AGORA)).toEqual({ tipo: 'codigo', codigo: CODIGO })
  })

  it('numa chave só do sessionStorage, com o slug, o tipo, o valor e a hora, e nada mais; o localStorage fica vazio', () => {
    guardarCaminhoDaSala(SLUG, { tipo: 'link', token: TOKEN }, AGORA)

    expect(window.sessionStorage.length).toBe(1)
    expect(JSON.parse(window.sessionStorage.getItem(CAMINHO_DA_SALA_STORAGE_KEY) ?? 'null')).toEqual({ slug: SLUG, tipo: 'link', valor: TOKEN, em: AGORA })
    expect(window.localStorage.length).toBe(0)
  })

  it('ler não apaga: a primeira renderização lê duas vezes (StrictMode) e o efeito é que apaga', () => {
    guardarCaminhoDaSala(SLUG, { tipo: 'link', token: TOKEN }, AGORA)

    expect(lerCaminhoDaSala(SLUG, AGORA)).toBeDefined()
    expect(lerCaminhoDaSala(SLUG, AGORA)).toBeDefined()
    expect(window.sessionStorage.getItem(CAMINHO_DA_SALA_STORAGE_KEY)).not.toBeNull()
    apagarCaminhoDaSala()
    expect(window.sessionStorage.getItem(CAMINHO_DA_SALA_STORAGE_KEY)).toBeNull()
    expect(lerCaminhoDaSala(SLUG, AGORA)).toBeUndefined()
  })

  it('o caminho de outra sala não vale para esta', () => {
    guardarCaminhoDaSala('colegio-b', { tipo: 'link', token: TOKEN }, AGORA)

    expect(lerCaminhoDaSala(SLUG, AGORA)).toBeUndefined()
  })

  it('vale por 15 minutos: no último milissegundo ainda, um depois não; e a hora no futuro não vale', () => {
    guardarCaminhoDaSala(SLUG, { tipo: 'link', token: TOKEN }, AGORA)

    expect(lerCaminhoDaSala(SLUG, AGORA + VALIDADE_DO_CAMINHO_DA_SALA_MS)).toBeDefined()
    expect(lerCaminhoDaSala(SLUG, AGORA + VALIDADE_DO_CAMINHO_DA_SALA_MS + 1)).toBeUndefined()
    expect(lerCaminhoDaSala(SLUG, AGORA - 1)).toBeUndefined()
    expect(VALIDADE_DO_CAMINHO_DA_SALA_MS).toBe(15 * 60_000)
  })

  it('o valor tem o tamanho do contrato: o token e o código no teto valem, um a mais não, e vazio não', () => {
    gravar({ tipo: 'link', valor: 't'.repeat(TAMANHO_MAXIMO_TOKEN_DE_CONVITE) })
    expect(lerCaminhoDaSala(SLUG, AGORA)).toBeDefined()
    gravar({ tipo: 'link', valor: 't'.repeat(TAMANHO_MAXIMO_TOKEN_DE_CONVITE + 1) })
    expect(lerCaminhoDaSala(SLUG, AGORA)).toBeUndefined()
    gravar({ tipo: 'link', valor: '' })
    expect(lerCaminhoDaSala(SLUG, AGORA)).toBeUndefined()

    gravar({ tipo: 'codigo', valor: 'C'.repeat(TAMANHO_MAXIMO_CODIGO_DIGITADO) })
    expect(lerCaminhoDaSala(SLUG, AGORA)).toBeDefined()
    gravar({ tipo: 'codigo', valor: 'C'.repeat(TAMANHO_MAXIMO_CODIGO_DIGITADO + 1) })
    expect(lerCaminhoDaSala(SLUG, AGORA)).toBeUndefined()
    gravar({ tipo: 'codigo', valor: '' })
    expect(lerCaminhoDaSala(SLUG, AGORA)).toBeUndefined()
  })

  it.each([
    ['campo a mais', { bilhete: 'x' }],
    ['tipo desconhecido', { tipo: 'bilhete' }],
    ['valor que não é texto', { valor: 12 }],
    ['valor que não é texto, mas tem tamanho de token', { valor: ['abc'] }],
    ['hora que não é número', { em: '1800000000000' }],
    ['sem slug', { slug: undefined }],
  ])('a forma que não é exata não vale: %s', (_caso, campos) => {
    gravar(campos)

    expect(lerCaminhoDaSala(SLUG, AGORA)).toBeUndefined()
  })

  it.each([
    ['nada guardado', undefined],
    ['texto que não é JSON', '{token'],
    ['JSON que não é objeto', '"so-um-texto"'],
    ['null', 'null'],
  ])('o que o armazenamento tem e não é o caminho vira "sem caminho": %s', (_caso, texto) => {
    if (texto !== undefined) window.sessionStorage.setItem(CAMINHO_DA_SALA_STORAGE_KEY, texto)

    expect(lerCaminhoDaSala(SLUG, AGORA)).toBeUndefined()
  })
})

describe('sem sessionStorage (modo privado, bloqueio)', () => {
  it('guardar devolve false, ler devolve nada e apagar não lança', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('cheio', 'QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError')
    })

    expect(guardarCaminhoDaSala(SLUG, { tipo: 'link', token: TOKEN }, AGORA)).toBe(false)
    expect(lerCaminhoDaSala(SLUG, AGORA)).toBeUndefined()
    expect(() => apagarCaminhoDaSala()).not.toThrow()
  })
})
