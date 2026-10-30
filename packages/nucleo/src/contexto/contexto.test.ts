import { setTimeout as esperar } from 'node:timers/promises'
import { describe, expect, it } from 'vitest'
import { ErrorCode } from '@educa/shared'
import { requireAnoEmCurso } from './ano-em-curso.js'
import { currentContext, setContextOperador, setContextSessao, runInContext, requireContextOperador, resolveRequestId } from './contexto.js'
import { requireEscolaId } from './escola-do-contexto.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

describe('resolverRequisicaoId', () => {
  it('aceita o UUID enviado pelo cliente, normalizado em minúsculas', () => {
    expect(resolveRequestId('0F8B2C1E-5D7A-4E3B-9C6D-1A2B3C4D5E6F')).toBe('0f8b2c1e-5d7a-4e3b-9c6d-1a2b3c4d5e6f')
  })

  it.each([
    ['texto livre', 'Enzo Martins'],
    ['UUID com sobra', '0f8b2c1e-5d7a-4e3b-9c6d-1a2b3c4d5e6f", "escolaId": "outra'],
    ['quebra de linha', '0f8b2c1e-5d7a-4e3b-9c6d-1a2b3c4d5e6f\n{"level":"info"}'],
    ['vazio', ''],
  ])('troca %s por um UUID novo', (_caso, cabecalho) => {
    const id = resolveRequestId(cabecalho)
    expect(id).toMatch(UUID)
    expect(id).not.toBe(cabecalho)
  })

  it('gera um id quando o cabeçalho falta ou vem repetido', () => {
    expect(resolveRequestId(undefined)).toMatch(UUID)
    expect(resolveRequestId(['0f8b2c1e-5d7a-4e3b-9c6d-1a2b3c4d5e6f', '1f8b2c1e-5d7a-4e3b-9c6d-1a2b3c4d5e6f'])).toMatch(UUID)
    expect(resolveRequestId(undefined)).not.toBe(resolveRequestId(undefined))
  })
})

describe('executarNoContexto', () => {
  it('mantém o contexto de cada execução separado através de await intercalados', async () => {
    const vistos = await Promise.all(
      Array.from({ length: 50 }, (_, indice) =>
        runInContext({ requisicaoId: `r-${indice}`, escolaId: indice % 2 === 0 ? 'A' : 'B' }, async () => {
          await esperar((indice * 7) % 11)
          const antes = currentContext()
          await esperar((indice * 3) % 5)
          return { indice, antes, depois: currentContext() }
        }),
      ),
    )
    for (const { indice, antes, depois } of vistos) {
      const esperado = { requisicaoId: `r-${indice}`, escolaId: indice % 2 === 0 ? 'A' : 'B' }
      expect(antes).toEqual(esperado)
      expect(depois).toEqual(esperado)
    }
    expect(currentContext()).toBeUndefined()
  })
})

describe('definirSessaoNoContexto e exigirAnoEmCurso', () => {
  const sessaoA = { escolaId: 'escola-a', usuarioId: 'usuario-a', papel: 'professor' as const, sessaoId: 'sessao-a', anoLetivoId: 'ano-a' }

  it('grava escola, usuário, papel, sessão e ano letivo, e o ano em curso é o da sessão', () => {
    runInContext({ requisicaoId: 'r-1' }, () => {
      setContextSessao(sessaoA)
      expect(currentContext()).toEqual({ requisicaoId: 'r-1', ...sessaoA })
      expect(requireAnoEmCurso()).toBe('ano-a')
    })
  })

  it('só grava uma vez, nem por cima de uma identidade já gravada', () => {
    runInContext({ requisicaoId: 'r-2' }, () => {
      setContextSessao(sessaoA)
      expect(() => setContextSessao({ ...sessaoA, escolaId: 'escola-b', sessaoId: 'sessao-b' })).toThrow()
      expect(currentContext()).toMatchObject(sessaoA)
    })
  })

  it('falha fora de uma requisição', () => {
    expect(() => setContextSessao(sessaoA)).toThrow()
  })

  it('escola sem ano em curso: exigirAnoEmCurso falha fechado com NAO_ENCONTRADO 404, e nunca devolve um ano qualquer', () => {
    runInContext({ requisicaoId: 'r-4' }, () => {
      setContextSessao({ ...sessaoA, anoLetivoId: null })
      expect(() => requireAnoEmCurso()).toThrow(expect.objectContaining({ codigo: ErrorCode.NAO_ENCONTRADO, status: 404 }))
    })
  })

  it('sem sessão no contexto (rota anônima, rotina), exigirAnoEmCurso também falha fechado', () => {
    runInContext({ requisicaoId: 'r-5' }, () => {
      expect(() => requireAnoEmCurso()).toThrow(expect.objectContaining({ codigo: ErrorCode.NAO_ENCONTRADO }))
    })
    expect(() => requireAnoEmCurso()).toThrow(expect.objectContaining({ codigo: ErrorCode.NAO_ENCONTRADO }))
  })
})

describe('definirOperadorNoContexto', () => {
  const sessaoDeEscola = { escolaId: 'escola-a', usuarioId: 'usuario-a', papel: 'professor', sessaoId: 'sessao-a', anoLetivoId: 'ano-a' } as const

  it('grava só o operador: sem escola, usuário, papel, sessão nem ano, e o escopo de escola falha fechado', () => {
    runInContext({ requisicaoId: 'r' }, () => {
      setContextOperador('operador-a')
      expect(currentContext()).toStrictEqual({ requisicaoId: 'r', operadorId: 'operador-a' })
      expect(requireContextOperador()).toBe('operador-a')
      expect(() => requireEscolaId()).toThrow('consulta com escopo sem escola no contexto')
    })
  })

  it('só grava uma vez, e nunca junto de uma sessão de escola, em nenhuma ordem', () => {
    runInContext({ requisicaoId: 'r' }, () => {
      setContextOperador('operador-a')
      expect(() => setContextOperador('operador-b')).toThrow()
      expect(() => setContextSessao(sessaoDeEscola)).toThrow()
      expect(currentContext()).toStrictEqual({ requisicaoId: 'r', operadorId: 'operador-a' })
    })
    runInContext({ requisicaoId: 'r' }, () => {
      setContextSessao(sessaoDeEscola)
      expect(() => setContextOperador('operador-a')).toThrow()
      expect(currentContext()?.operadorId).toBeUndefined()
    })
  })

  it('sem operador no contexto (rota de escola, rota anônima), exigirOperadorDoContexto falha fechado', () => {
    expect(() => requireContextOperador()).toThrow()
    runInContext({ requisicaoId: 'r' }, () => {
      setContextSessao(sessaoDeEscola)
      expect(() => requireContextOperador()).toThrow('rota da operação sem operador no contexto')
    })
  })
})
