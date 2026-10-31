import { runInContext } from '@educa/core'
import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { BancadaDeSessoes } from '../../../test/sessao.fixture.js'
import { RedefinicaoDeMfaRepository } from './redefinicao-de-mfa.repository.js'

describe('RedefinicaoDeMfaRepository: o alvo é procurado só na escola do contexto', () => {
  const bancada = new BancadaDeSessoes()

  afterAll(async () => {
    await bancada.fechar()
  })

  /** Um coordenador de A com conta, ativo ou desativado. */
  async function coordenadorComConta(escolaId: string, desativado = false): Promise<{ usuarioId: string; contaId: string }> {
    const { rows: contas } = await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [`mfa-${randomUUID()}@escola.invalid`])
    const contaId = contas[0]?.id ?? ''
    const { rows: usuarios } = await bancada.pool.query<{ id: string }>(
      "insert into usuario (escola_id, conta_id, papel, nome, desativado_em) values ($1, $2, 'coordenador', 'Pessoa sintética', case when $3::boolean then now() else null end) returning id",
      [escolaId, contaId, desativado],
    )
    return { usuarioId: usuarios[0]?.id ?? '', contaId }
  }

  const naEscola = <T>(escolaId: string, funcao: (repositorio: RedefinicaoDeMfaRepository) => Promise<T>) =>
    runInContext({ requisicaoId: randomUUID(), escolaId }, () => bancada.banco.transaction((tx) => funcao(new RedefinicaoDeMfaRepository(tx))))

  it('isolamento: em B o usuário de A não é achado, e em A devolve a conta; desativado e inexistente não são achados', async () => {
    const escolaA = await bancada.escola()
    const escolaB = await bancada.escola()
    const alvo = await coordenadorComConta(escolaA)
    const desativado = await coordenadorComConta(escolaA, true)

    expect(await naEscola(escolaB, (repositorio) => repositorio.contaDoUsuarioAtivo(alvo.usuarioId))).toBeUndefined()
    expect(await naEscola(escolaA, (repositorio) => repositorio.contaDoUsuarioAtivo(alvo.usuarioId))).toBe(alvo.contaId)
    expect(await naEscola(escolaA, (repositorio) => repositorio.contaDoUsuarioAtivo(desativado.usuarioId))).toBeUndefined()
    expect(await naEscola(escolaA, (repositorio) => repositorio.contaDoUsuarioAtivo(randomUUID()))).toBeUndefined()
  })

  it('sem escola no contexto, falha fechada antes de tocar o banco', async () => {
    await expect(
      runInContext({ requisicaoId: randomUUID() }, () => bancada.banco.transaction((tx) => new RedefinicaoDeMfaRepository(tx).contaDoUsuarioAtivo(randomUUID()))),
    ).rejects.toThrow('consulta com escopo sem escola no contexto')
  })
})
