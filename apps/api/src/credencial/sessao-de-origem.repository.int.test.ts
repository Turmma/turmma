import { runInContext } from '@educa/core'
import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { SessaoFixtures } from '../../test/sessao.fixture.js'
import { SessaoDeOrigemRepository } from './sessao-de-origem.repository.js'

describe('SessaoDeOrigemRepository: a sessão de onde a troca parte, só na escola do contexto', () => {
  const bancada = new SessaoFixtures()

  afterAll(async () => {
    await bancada.fechar()
  })

  const naEscola = <T>(escolaId: string, funcao: () => Promise<T>) => runInContext({ requisicaoId: randomUUID(), escolaId }, funcao)

  async function estado(sessaoId: string): Promise<{ encerrada_em: Date | null; motivo: string | null }> {
    const { rows } = await bancada.pool.query<{ encerrada_em: Date | null; motivo: string | null }>('select encerrada_em, motivo from sessao where id = $1', [sessaoId])
    const linha = rows[0]
    if (linha === undefined) throw new Error('sessão não achada')
    return linha
  }

  async function contaDe(usuarioId: string): Promise<string> {
    const { rows } = await bancada.pool.query<{ conta_id: string }>('select conta_id from usuario where id = $1', [usuarioId])
    return rows[0]?.conta_id ?? ''
  }

  it('isolamento: a sessão de A é lida no contexto de A e não é achada no contexto de B', async () => {
    const professorEmA = await bancada.escolaComSessao('professor')
    const escolaB = await bancada.escola()
    const repositorio = new SessaoDeOrigemRepository(bancada.banco)

    expect(await naEscola(professorEmA.escolaId, () => repositorio.metodoEConta(professorEmA.sessaoId))).toEqual({ metodo: 'email', contaId: await contaDe(professorEmA.usuarioId) })
    expect(await naEscola(escolaB, () => repositorio.metodoEConta(professorEmA.sessaoId))).toBeUndefined()
    await expect(runInContext({ requisicaoId: randomUUID() }, () => repositorio.metodoEConta(professorEmA.sessaoId))).rejects.toThrow('sem escola no contexto')
  })

  it('isolamento: encerrar a sessão de A no contexto de B não muda nada; no contexto de A encerra uma vez, com troca_de_escola', async () => {
    const professorEmA = await bancada.escolaComSessao('professor')
    const escolaB = await bancada.escola()
    const contaId = await contaDe(professorEmA.usuarioId)
    const repositorio = new SessaoDeOrigemRepository(bancada.banco)

    expect(await naEscola(escolaB, () => repositorio.encerrarParaTroca(professorEmA.sessaoId, contaId))).toBeUndefined()
    expect(await estado(professorEmA.sessaoId)).toEqual({ encerrada_em: null, motivo: null })

    expect(await naEscola(professorEmA.escolaId, () => repositorio.encerrarParaTroca(professorEmA.sessaoId, contaId))).toBe(professorEmA.usuarioId)
    expect(await estado(professorEmA.sessaoId)).toMatchObject({ motivo: 'troca_de_escola' })
    expect(await naEscola(professorEmA.escolaId, () => repositorio.encerrarParaTroca(professorEmA.sessaoId, contaId))).toBeUndefined()
  })

  it('borda: não encerra a sessão de outra conta nem a que não é de e-mail', async () => {
    const [umProfessor, outroProfessor] = await bancada.sessoes(await bancada.escola(), { papel: 'professor', quantidade: 2 })
    if (umProfessor === undefined || outroProfessor === undefined) throw new Error('sessões não criadas')
    const repositorio = new SessaoDeOrigemRepository(bancada.banco)

    const contaDoUm = await contaDe(umProfessor.usuarioId)
    const contaDoOutro = await contaDe(outroProfessor.usuarioId)

    expect(await naEscola(umProfessor.escolaId, () => repositorio.encerrarParaTroca(umProfessor.sessaoId, contaDoOutro))).toBeUndefined()
    await bancada.pool.query("update sessao set metodo = 'externo' where id = $1", [umProfessor.sessaoId])
    expect(await naEscola(umProfessor.escolaId, () => repositorio.encerrarParaTroca(umProfessor.sessaoId, contaDoUm))).toBeUndefined()
    expect(await estado(umProfessor.sessaoId)).toEqual({ encerrada_em: null, motivo: null })
  })
})
