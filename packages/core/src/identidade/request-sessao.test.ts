import { ErrorCode } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { currentContext, runInContext, setContextSessao, type RequestContext } from '../context/context.js'
import { DomainException } from '../error/domain.exception.js'
import { requestSessao, requestSessaoDeRequisicao } from './auth.guard.js'

// A pessoa que roda é a mesma na requisição e no worker (a execução de IA, X6 5.0); só a requisição tem a sessão.
const completo = (): RequestContext => ({ requisicaoId: randomUUID(), escolaId: randomUUID(), usuarioId: randomUUID(), papel: 'professor', anoLetivoId: randomUUID(), sessaoId: randomUUID() })
const semSessao = (): RequestContext => {
  const { sessaoId: _sessaoId, ...resto } = completo()
  return resto
}
const naoAutenticado = (corpo: () => unknown) => {
  try {
    corpo()
  } catch (erro) {
    expect(erro).toBeInstanceOf(DomainException)
    expect((erro as DomainException).codigo).toBe(ErrorCode.NAO_AUTENTICADO)
    return
  }
  throw new Error('devia lançar NAO_AUTENTICADO')
}

describe('a pessoa e a sessão do contexto', () => {
  it('`requestSessao` devolve escola, pessoa, papel e ano; a sessão vai junto só quando o contexto a tem', () => {
    const contexto = completo()
    expect(runInContext(contexto, () => requestSessao())).toEqual({ escolaId: contexto.escolaId, usuarioId: contexto.usuarioId, papel: 'professor', anoLetivoId: contexto.anoLetivoId, sessaoId: contexto.sessaoId })
    const doWorker = semSessao()
    const lida = runInContext(doWorker, () => requestSessao())
    expect(lida).toEqual({ escolaId: doWorker.escolaId, usuarioId: doWorker.usuarioId, papel: 'professor', anoLetivoId: doWorker.anoLetivoId })
    expect(lida).not.toHaveProperty('sessaoId')
  })

  it('sem escola, pessoa, papel ou ano no contexto, ou fora de um contexto, é NAO_AUTENTICADO', () => {
    naoAutenticado(() => requestSessao())
    for (const faltando of ['escolaId', 'usuarioId', 'papel', 'anoLetivoId'] as const) {
      const { [faltando]: _tirado, ...resto } = completo()
      naoAutenticado(() => runInContext(resto, () => requestSessao()))
    }
  })

  it('`requestSessaoDeRequisicao` exige o `sessaoId`: no worker, onde não há sessão, é NAO_AUTENTICADO', () => {
    const contexto = completo()
    expect(runInContext(contexto, () => requestSessaoDeRequisicao()).sessaoId).toBe(contexto.sessaoId)
    naoAutenticado(() => runInContext(semSessao(), () => requestSessaoDeRequisicao()))
  })

  it('`setContextSessao` grava a sessão no contexto, e sem `sessaoId` não escreve um', () => {
    const doWorker: RequestContext = { requisicaoId: randomUUID() }
    runInContext(doWorker, () => {
      setContextSessao({ escolaId: 'e', usuarioId: 'u', papel: 'aluno', anoLetivoId: null })
      expect(currentContext()).toMatchObject({ escolaId: 'e', usuarioId: 'u', papel: 'aluno' })
      expect(currentContext()).not.toHaveProperty('sessaoId')
    })
    const daRequisicao: RequestContext = { requisicaoId: randomUUID() }
    runInContext(daRequisicao, () => {
      setContextSessao({ escolaId: 'e', usuarioId: 'u', papel: 'aluno', sessaoId: 's', anoLetivoId: null })
      expect(currentContext()?.sessaoId).toBe('s')
    })
  })
})
