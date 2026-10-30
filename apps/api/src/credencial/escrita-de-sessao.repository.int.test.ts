import { runInContext, SessaoRepository, type VerifiedToken } from '@educa/nucleo'
import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { estadoDaSessao } from '../../test/api-com-sessao.js'
import { BancadaDeSessoes } from '../../test/sessao-de-teste.js'
import { EscritaDeSessaoRepository } from './escrita-de-sessao.repository.js'

describe('EscritaDeSessaoRepository: toda escrita na sessão fica na escola do contexto', () => {
  const bancada = new BancadaDeSessoes()

  afterAll(async () => {
    await bancada.fechar()
  })

  it('isolamento: no contexto de B, o id de uma sessão de A não é rotacionado, encerrado, nem tem o uso movido; no de A, é', async () => {
    const deA = await bancada.escolaComSessao()
    const escolaB = await bancada.escola()
    await bancada.pool.query("update sessao set ultimo_uso_em = now() - interval '20 minutes' where escola_id = $1 and id = $2", [deA.escolaId, deA.sessaoId])
    const antes = await estadoDaSessao(bancada, deA)
    const repositorio = new EscritaDeSessaoRepository(bancada.banco)

    const emB = await runInContext({ requisicaoId: randomUUID(), escolaId: escolaB }, async () => ({
      rotacionou: await repositorio.rotacionar(deA.sessaoId, randomUUID(), true),
      usou: await repositorio.registrarUso(deA.sessaoId),
      familia: await repositorio.encerrarFamilia(antes.familia, 'reuso_de_refresh'),
      encerrou: await repositorio.encerrar(deA.sessaoId, 'saida'),
    }))

    expect(emB).toEqual({ rotacionou: undefined, usou: false, familia: 0, encerrou: false })
    expect(await estadoDaSessao(bancada, deA)).toEqual(antes)

    const emA = await runInContext({ requisicaoId: randomUUID(), escolaId: deA.escolaId }, async () => ({
      usou: await repositorio.registrarUso(deA.sessaoId),
      encerrou: await repositorio.encerrar(deA.sessaoId, 'saida'),
      deNovo: await repositorio.encerrar(deA.sessaoId, 'saida'),
    }))
    expect(emA).toEqual({ usou: true, encerrou: true, deNovo: false })
  })

  it('sem escola no contexto, falha fechada antes de tocar o banco', async () => {
    const repositorio = new EscritaDeSessaoRepository(bancada.banco)
    await runInContext({ requisicaoId: randomUUID() }, async () => {
      await expect(repositorio.registrarUso(randomUUID())).rejects.toThrow('consulta com escopo sem escola no contexto')
    })
  })

  it('marcação do token renovado: só a sessão do token na escola do token, só com iat depois da rotação, e uma vez', async () => {
    const deA = await bancada.escolaComSessao()
    const escolaB = await bancada.escola()
    await bancada.pool.query("update sessao set rotacionado_em = now() - interval '10 seconds', atual_apresentado = false where escola_id = $1 and id = $2", [deA.escolaId, deA.sessaoId])
    const { rotacionado_em: rotacionadoEm } = await estadoDaSessao(bancada, deA)
    if (rotacionadoEm === null) throw new Error('rotação de teste não gravada')
    const segundos = Math.floor(rotacionadoEm.getTime() / 1000)
    const token = (escolaId: string, emitidoEm: number) => ({ escolaId, usuarioId: deA.usuarioId, sessaoId: deA.sessaoId, emitidoEm }) as VerifiedToken
    const repositorio = new SessaoRepository(bancada.banco)

    // O mesmo `sid` com a escola de B, e o token de antes da rotação, não marcam nada.
    expect(await repositorio.marcarAtualApresentado(token(escolaB, segundos + 1))).toBe(false)
    expect(await repositorio.marcarAtualApresentado(token(deA.escolaId, segundos - 1))).toBe(false)
    expect((await estadoDaSessao(bancada, deA)).atual_apresentado).toBe(false)

    const emParalelo = await Promise.all([repositorio.marcarAtualApresentado(token(deA.escolaId, segundos + 1)), repositorio.marcarAtualApresentado(token(deA.escolaId, segundos + 1))])
    expect(emParalelo.filter(Boolean)).toHaveLength(1)
    expect((await estadoDaSessao(bancada, deA)).atual_apresentado).toBe(true)
  })
})
