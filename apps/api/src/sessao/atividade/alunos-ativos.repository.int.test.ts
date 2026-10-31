import { runInContext } from '@educa/core'
import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { BancadaDeSessoes } from '../../../test/sessao-de-teste.js'
import { AlunosAtivosRepository } from './alunos-ativos.repository.js'

/** Hash sintético: a contagem não confere senha. */
const HASH_SINTETICO = '$argon2id$v=19$m=19456,t=2,p=1$c2ludGV0aWNv$c2ludGV0aWNvc2ludGV0aWNv'

describe('AlunosAtivosRepository: o tamanho da escola que dá o limiar do rebaixamento (15.1) é só da escola do contexto', () => {
  const bancada = new BancadaDeSessoes()

  afterAll(async () => {
    await bancada.fechar()
  })

  const naEscola = <T>(escolaId: string, funcao: () => Promise<T>) => runInContext({ requisicaoId: randomUUID(), escolaId }, funcao)
  const alunos = (escolaId: string, quantidade: number) =>
    bancada.alunosComMatricula(
      escolaId,
      Array.from({ length: quantidade }, () => ({ matricula: `RA${randomUUID().slice(0, 12)}`, senhaHash: HASH_SINTETICO })),
    )

  it('isolamento: a escola A, com 3 alunos, conta 3, mesmo com a B do lado com 40; e sem escola no contexto, a consulta nem sai', async () => {
    const escolaA = await bancada.escola()
    const escolaB = await bancada.escola()
    await alunos(escolaA, 3)
    await alunos(escolaB, 40)
    const repositorio = new AlunosAtivosRepository(bancada.banco)
    expect(await naEscola(escolaA, () => repositorio.contar())).toBe(3)
    expect(await naEscola(escolaB, () => repositorio.contar())).toBe(40)
    await expect(runInContext({ requisicaoId: randomUUID() }, () => repositorio.contar())).rejects.toThrow('consulta com escopo sem escola no contexto')
  })

  it('borda: aluno desativado (transferido) e equipe não contam', async () => {
    const escola = await bancada.escola()
    const [transferido] = await alunos(escola, 5)
    await bancada.pool.query('update usuario set desativado_em = now() where escola_id = $1 and id = $2', [escola, transferido])
    await bancada.sessao(escola, 'professor')
    await bancada.sessao(escola, 'coordenador')
    expect(await naEscola(escola, () => new AlunosAtivosRepository(bancada.banco).contar())).toBe(4)
  })
})
