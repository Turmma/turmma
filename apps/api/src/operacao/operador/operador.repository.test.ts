import { DomainException, type DatabaseTransaction } from '@educa/core'
import { ErrorCode } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { OperadorRepository } from './operador.repository.js'

/**
 * Um banco que devolve, a cada `returning` ou `for`, a próxima lista da fila: o suficiente para levar o repository ao
 * ramo em que o banco não devolveu a linha que devia, que no Postgres de verdade não se alcança.
 */
function bancoQueDevolve(...respostas: unknown[][]): DatabaseTransaction {
  const fila = [...respostas]
  const proxima = async () => fila.shift() ?? []
  const cadeia: Record<string, unknown> = {}
  for (const passo of ['insert', 'values', 'update', 'set', 'where', 'select', 'from', 'delete']) cadeia[passo] = () => cadeia
  cadeia['returning'] = proxima
  cadeia['for'] = proxima
  return cadeia as unknown as DatabaseTransaction
}

const ERRO_TIPADO = new DomainException(ErrorCode.ERRO_INTERNO)

describe('OperadorRepository: o que o banco não devolveu sai como erro tipado, com código (regra 00, item 9)', () => {
  it('criar sem a linha do insert', async () => {
    const erro = await new OperadorRepository(bancoQueDevolve([])).criar({ apelido: 'ana', nome: 'Ana Sintética', email: 'ana@turmma.invalid' }).catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(DomainException)
    expect(erro).toEqual(ERRO_TIPADO)
  })

  it('criarConvite sem a linha do insert', async () => {
    const erro = await new OperadorRepository(bancoQueDevolve([])).criarConvite({ operadorId: 'o', tokenHash: 'h', expiraEm: new Date() }).catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(DomainException)
    expect(erro).toEqual(ERRO_TIPADO)
  })

  it('aceitarConvite com a linha travada, o convite usado e o operador não gravado', async () => {
    // for update → o operador ativo; returning do convite → usado; returning do operador → nada.
    const banco = bancoQueDevolve([{ apelido: 'o' }], [{ id: 'c' }], [])
    const erro = await new OperadorRepository(banco).aceitarConvite({ conviteId: 'c', operadorId: 'o', senhaHash: 'h' }).catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(DomainException)
    expect(erro).toEqual(ERRO_TIPADO)
  })

  it('abrirSessao sem a linha do insert', async () => {
    const erro = await new OperadorRepository(bancoQueDevolve([])).abrirSessao('o', 'h').catch((e: unknown) => e)
    expect(erro).toBeInstanceOf(DomainException)
    expect(erro).toEqual(ERRO_TIPADO)
  })
})
