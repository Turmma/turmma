import { executarNoContexto } from '@educa/nucleo'
import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { BancadaDeSessoes } from '../../test/sessao-de-teste.js'
import { EuRepository } from './eu.repository.js'
import { RegistroDeAcessoRepository } from './registro-de-acesso.repository.js'

describe('repositories do login com escopo: a escola vem do contexto', () => {
  const bancada = new BancadaDeSessoes()

  afterAll(async () => {
    await bancada.fechar()
  })

  it('isolamento: o /v1/eu lê o usuário só na escola do contexto; o usuário de A no contexto de B não é achado', async () => {
    const professorEmA = await bancada.escolaComSessao('professor')
    const escolaB = await bancada.escola()
    const repositorio = new EuRepository(bancada.banco)
    const naPropria = await executarNoContexto({ requisicaoId: randomUUID(), escolaId: professorEmA.escolaId, usuarioId: professorEmA.usuarioId }, () => repositorio.doContexto())
    expect(naPropria).toMatchObject({ usuarioId: professorEmA.usuarioId, papel: 'professor', escola: { id: professorEmA.escolaId } })
    const naOutra = await executarNoContexto({ requisicaoId: randomUUID(), escolaId: escolaB, usuarioId: professorEmA.usuarioId }, () => repositorio.doContexto())
    expect(naOutra).toBeUndefined()
  })

  it('isolamento: marcar a introdução grava só a linha do contexto; o usuário de A no contexto de B não é alterado nem achado', async () => {
    const professorEmA = await bancada.escolaComSessao('professor')
    const colegaDeA = await bancada.sessao(professorEmA.escolaId, 'professor')
    const escolaB = await bancada.escola()
    const repositorio = new EuRepository(bancada.banco)
    const vistaDe = async (usuarioId: string) => (await bancada.pool.query<{ v: Date | null }>('select introducao_vista_em as v from usuario where id = $1', [usuarioId])).rows[0]?.v ?? null

    const naOutra = await executarNoContexto({ requisicaoId: randomUUID(), escolaId: escolaB, usuarioId: professorEmA.usuarioId }, () => repositorio.marcarIntroducaoVista())
    expect(naOutra).toBeUndefined()
    expect(await vistaDe(professorEmA.usuarioId)).toBeNull()

    const naPropria = await executarNoContexto({ requisicaoId: randomUUID(), escolaId: professorEmA.escolaId, usuarioId: professorEmA.usuarioId }, () => repositorio.marcarIntroducaoVista())
    expect(naPropria).toBeInstanceOf(Date)
    expect((await vistaDe(professorEmA.usuarioId))?.getTime()).toBe(naPropria?.getTime())
    expect(await vistaDe(colegaDeA.usuarioId)).toBeNull()
  })

  it('isolamento: o registro de acesso do login grava na escola do contexto, e sem escola no contexto não grava', async () => {
    const professor = await bancada.escolaComSessao('professor')
    await executarNoContexto({ requisicaoId: randomUUID(), escolaId: professor.escolaId }, () =>
      bancada.banco.transaction((tx) => new RegistroDeAcessoRepository(tx).gravar('login', professor.usuarioId, '10.1.2.3')),
    )
    const { rows } = await bancada.pool.query<{ escola_id: string; evento: string; ip: string }>('select escola_id, evento, host(ip) as ip from registro_acesso where usuario_id = $1', [professor.usuarioId])
    expect(rows).toEqual([{ escola_id: professor.escolaId, evento: 'login', ip: '10.1.2.3' }])
    await expect(
      executarNoContexto({ requisicaoId: randomUUID() }, () => bancada.banco.transaction((tx) => new RegistroDeAcessoRepository(tx).gravar('login', professor.usuarioId, '10.1.2.3'))),
    ).rejects.toThrow('registro de acesso sem escola no contexto')
  })
})
