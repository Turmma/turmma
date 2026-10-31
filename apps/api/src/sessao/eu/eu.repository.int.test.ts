import { runInContext } from '@educa/core'
import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { SessaoFixtures } from '../../../test/sessao.fixture.js'
import { MeRepository } from './eu.repository.js'
import { RegistroDeAcessoRepository } from '../../credencial/registro-de-acesso.repository.js'

describe('repositories do login com escopo: a escola vem do contexto', () => {
  const bancada = new SessaoFixtures()

  afterAll(async () => {
    await bancada.fechar()
  })

  it('isolamento: o /v1/eu lê o usuário só na escola do contexto; o usuário de A no contexto de B não é achado', async () => {
    const professorEmA = await bancada.escolaComSessao('professor')
    const escolaB = await bancada.escola()
    const repositorio = new MeRepository(bancada.banco)
    const naPropria = await runInContext({ requisicaoId: randomUUID(), escolaId: professorEmA.escolaId, usuarioId: professorEmA.usuarioId }, () => repositorio.doContexto())
    expect(naPropria).toMatchObject({ usuarioId: professorEmA.usuarioId, papel: 'professor', escola: { id: professorEmA.escolaId } })
    const naOutra = await runInContext({ requisicaoId: randomUUID(), escolaId: escolaB, usuarioId: professorEmA.usuarioId }, () => repositorio.doContexto())
    expect(naOutra).toBeUndefined()
  })

  it('isolamento: a marca da introdução grava só a linha do contexto; com o contexto de B, o usuário de A não é lido nem alterado', async () => {
    const professorEmA = await bancada.escolaComSessao('professor')
    const escolaB = await bancada.escola()
    const colegaEmA = await bancada.sessao(professorEmA.escolaId, 'professor')
    const repositorio = new MeRepository(bancada.banco)
    const dataDe = async (usuarioId: string) => (await bancada.pool.query<{ d: Date | null }>('select introducao_vista_em as d from usuario where id = $1', [usuarioId])).rows[0]?.d ?? null

    const deOutraEscola = await runInContext({ requisicaoId: randomUUID(), escolaId: escolaB, usuarioId: professorEmA.usuarioId }, () => repositorio.marcarIntroducaoVista())
    expect(deOutraEscola).toBeUndefined()
    expect(await dataDe(professorEmA.usuarioId)).toBeNull()

    const naPropria = await runInContext({ requisicaoId: randomUUID(), escolaId: professorEmA.escolaId, usuarioId: professorEmA.usuarioId }, () => repositorio.marcarIntroducaoVista())
    expect(naPropria).toBeInstanceOf(Date)
    expect((await dataDe(professorEmA.usuarioId))?.getTime()).toBe(naPropria?.getTime())
    expect(await dataDe(colegaEmA.usuarioId)).toBeNull()
    const lida = await runInContext({ requisicaoId: randomUUID(), escolaId: professorEmA.escolaId, usuarioId: professorEmA.usuarioId }, () => repositorio.doContexto())
    expect(lida?.introducaoVistaEm?.getTime()).toBe(naPropria?.getTime())
  })

  it('isolamento: o registro de acesso do login grava na escola do contexto, e sem escola no contexto não grava', async () => {
    const professor = await bancada.escolaComSessao('professor')
    await runInContext({ requisicaoId: randomUUID(), escolaId: professor.escolaId }, () =>
      bancada.banco.transaction((tx) => new RegistroDeAcessoRepository(tx).gravar('login', professor.usuarioId, '10.1.2.3')),
    )
    const { rows } = await bancada.pool.query<{ escola_id: string; evento: string; ip: string }>('select escola_id, evento, host(ip) as ip from registro_acesso where usuario_id = $1', [professor.usuarioId])
    expect(rows).toEqual([{ escola_id: professor.escolaId, evento: 'login', ip: '10.1.2.3' }])
    await expect(
      runInContext({ requisicaoId: randomUUID() }, () => bancada.banco.transaction((tx) => new RegistroDeAcessoRepository(tx).gravar('login', professor.usuarioId, '10.1.2.3'))),
    ).rejects.toThrow('consulta com escopo sem escola no contexto')
  })
})
