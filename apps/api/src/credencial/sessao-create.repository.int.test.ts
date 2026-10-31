import { runInContext } from '@educa/core'
import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { BancadaDeSessoes } from '../../test/sessao.fixture.js'
import { SessaoCreateRepository } from './sessao-create.repository.js'

describe('CriacaoDeSessaoRepository: usuário e sessão são gravados na escola do contexto', () => {
  const bancada = new BancadaDeSessoes()

  afterAll(async () => {
    await bancada.fechar()
  })

  const contagem = async (tabela: 'usuario' | 'sessao', escolaId: string): Promise<number> => {
    const { rows } = await bancada.pool.query<{ total: string }>(`select count(*) as total from ${tabela} where escola_id = $1`, [escolaId])
    return Number(rows[0]?.total ?? 0)
  }

  const naEscola = <T>(escolaId: string, funcao: (repositorio: SessaoCreateRepository) => Promise<T>) =>
    runInContext({ requisicaoId: randomUUID(), escolaId }, () => bancada.banco.transaction((tx) => funcao(new SessaoCreateRepository(tx))))

  it('isolamento: no contexto de A grava o usuário e a sessão com o escola_id de A, mesmo com a escola de B no argumento, e B não ganha linha', async () => {
    const escolaA = await bancada.escola()
    const escolaB = await bancada.escola()
    // Um objeto que já nasce com a escola de B: a propriedade extra não é do contrato, e o repository a ignora.
    const comEscolaDeFora = { contaId: null, papel: 'aluno', nome: 'Pessoa sintética', escolaId: escolaB } as const

    const usuarios = await naEscola(escolaA, (repositorio) => repositorio.criarUsuarios([comEscolaDeFora]))
    const usuarioId = usuarios[0]?.id
    if (usuarioId === undefined) throw new Error('usuário de teste não criado')
    const sessoes = await naEscola(escolaA, (repositorio) =>
      repositorio.criarSessoes([{ usuarioId, contaId: null, metodo: 'matricula', refreshHash: randomUUID(), duracaoHoras: 1 }]),
    )

    expect(sessoes).toHaveLength(1)
    expect(await contagem('usuario', escolaA)).toBe(1)
    expect(await contagem('sessao', escolaA)).toBe(1)
    expect(await contagem('usuario', escolaB)).toBe(0)
    expect(await contagem('sessao', escolaB)).toBe(0)
  })

  it('sem escola no contexto, as duas gravações falham fechadas e nada é gravado; lista vazia não grava nem exige escola', async () => {
    const escolaId = await bancada.escola()
    const semEscola = <T>(funcao: (repositorio: SessaoCreateRepository) => Promise<T>) =>
      runInContext({ requisicaoId: randomUUID() }, () => bancada.banco.transaction((tx) => funcao(new SessaoCreateRepository(tx))))

    await expect(semEscola((repositorio) => repositorio.criarUsuarios([{ contaId: null, papel: 'aluno', nome: 'Pessoa sintética' }]))).rejects.toThrow('consulta com escopo sem escola no contexto')
    await expect(
      semEscola((repositorio) => repositorio.criarSessoes([{ usuarioId: randomUUID(), contaId: null, metodo: 'matricula', refreshHash: randomUUID(), duracaoHoras: 1 }])),
    ).rejects.toThrow('consulta com escopo sem escola no contexto')
    expect(await semEscola((repositorio) => repositorio.criarUsuarios([]))).toEqual([])
    expect(await semEscola((repositorio) => repositorio.criarSessoes([]))).toEqual([])
    expect(await contagem('usuario', escolaId)).toBe(0)
  })
})
