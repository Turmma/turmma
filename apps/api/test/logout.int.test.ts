import { ErrorCode } from '@educa/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { chamar, cookieDeRenovacao, estadoDaSessao, registrosDeAcesso, renovar, subirApi, type ApiDeTeste } from './test-api.js'
import { BancadaDeSessoes } from './sessao.fixture.js'

describe('DELETE /v1/sessao: sair encerra na hora', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  let api: ApiDeTeste

  beforeAll(async () => {
    api = await subirApi(medidor.medidor)
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  it('caminho feliz: a requisição seguinte com o mesmo JWT dá 401, o cookie não renova, e a saída fica no registro de acesso', async () => {
    const aluno = await bancada.escolaComSessao()
    const cookie = await cookieDeRenovacao(bancada, aluno)
    const saidasAntes = await registrosDeAcesso(bancada, aluno, 'saida')

    const saida = await chamar(api.url, 'DELETE', '/v1/sessao', aluno.token)

    expect(saida.status).toBe(204)
    // Só o cookie de renovação é apagado: o `educa_dispositivo` dá prioridade no login, nunca acesso, e fica.
    expect(saida.setCookie).toEqual([expect.stringMatching(/^educa_sessao=; Path=\/v1\/sessao; HttpOnly; SameSite=Strict; Max-Age=0$/)])
    expect(await estadoDaSessao(bancada, aluno)).toMatchObject({ encerrada_em: expect.any(Date), motivo: 'saida' })
    expect(await registrosDeAcesso(bancada, aluno, 'saida')).toBe(saidasAntes + 1)
    const seguinte = await chamar(api.url, 'GET', '/v1/eu', aluno.token)
    expect(seguinte.status).toBe(401)
    expect(seguinte.corpo.erro?.codigo).toBe(ErrorCode.NAO_AUTENTICADO)
    expect((await renovar(api.url, cookie)).status).toBe(401)
    // Sair de novo com o mesmo token já não passa da guarda, e não grava outra saída.
    expect((await chamar(api.url, 'DELETE', '/v1/sessao', aluno.token)).status).toBe(401)
    expect(await registrosDeAcesso(bancada, aluno, 'saida')).toBe(saidasAntes + 1)
  })

  it('isolamento: encerra só a sessão do token; a outra sessão da mesma escola e a de outra escola seguem entrando', async () => {
    const escolaA = await bancada.escola()
    const [minha, colega] = await bancada.sessoes(escolaA, { papel: 'professor', quantidade: 2 })
    const deB = await bancada.escolaComSessao('professor')
    if (minha === undefined || colega === undefined) throw new Error('sessões de teste não criadas')

    expect((await chamar(api.url, 'DELETE', '/v1/sessao', minha.token)).status).toBe(204)

    expect((await chamar(api.url, 'GET', '/v1/eu', minha.token)).status).toBe(401)
    expect((await chamar(api.url, 'GET', '/v1/eu', colega.token)).status).toBe(200)
    expect((await chamar(api.url, 'GET', '/v1/eu', deB.token)).status).toBe(200)
    expect((await estadoDaSessao(bancada, colega)).encerrada_em).toBeNull()
    expect((await estadoDaSessao(bancada, deB)).encerrada_em).toBeNull()
  })

  it('concorrência: dois cliques em Sair ao mesmo tempo encerram uma vez e gravam uma saída', async () => {
    const aluno = await bancada.escolaComSessao()
    const respostas = await Promise.all([chamar(api.url, 'DELETE', '/v1/sessao', aluno.token), chamar(api.url, 'DELETE', '/v1/sessao', aluno.token)])
    for (const resposta of respostas) expect([204, 401]).toContain(resposta.status)
    expect(respostas.some((resposta) => resposta.status === 204)).toBe(true)
    expect(await registrosDeAcesso(bancada, aluno, 'saida')).toBe(1)
  })

  it('sem token, sair é recusado como qualquer rota autenticada', async () => {
    const resposta = await fetch(`${api.url}/v1/sessao`, { method: 'DELETE' })
    expect(resposta.status).toBe(401)
  })
})
