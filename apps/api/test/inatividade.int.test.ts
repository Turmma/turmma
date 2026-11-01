import { METRICS } from '@educa/core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { chamar, cookieDaResposta, cookieDeRenovacao, estadoDaSessao, registrosDeAcesso, renovar, subirApi, type TestApi } from './test-api.js'
import { SessaoFixtures, type TestSessao } from './sessao.fixture.js'

/** Prazo da consulta na API da falha: a atividade presa atrás de uma trava desiste nele. */
const PRAZO_DA_CONSULTA_MS = 1_500

describe('atividade e inatividade: a sessão vence sem uso, renovar não é uso, e a atividade perdida não desloga', () => {
  const bancada = new SessaoFixtures()
  const medidor = new MedidorDeTeste()
  let api: TestApi

  beforeAll(async () => {
    api = await subirApi(medidor.medidor)
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  /** Leva o último uso para `segundos` atrás (a hora que conta é a do banco, a mesma da guarda). */
  async function ultimoUsoHa(sessao: TestSessao, segundos: number): Promise<void> {
    await bancada.pool.query('update sessao set ultimo_uso_em = now() - make_interval(secs => $3) where escola_id = $1 and id = $2', [sessao.escolaId, sessao.sessaoId, segundos])
  }

  it('borda: aluno com 34 min sem atividade segue válido e com 35 min e 1 s dá 401 (inatividade 30 + 5); renovar no meio não muda o resultado', async () => {
    const aluno = await bancada.escolaComSessao()
    const cookie = await cookieDeRenovacao(bancada, aluno)
    await ultimoUsoHa(aluno, 34 * 60)

    expect((await chamar(api.url, 'GET', '/v1/eu', aluno.token)).status).toBe(200)
    const antes = await estadoDaSessao(bancada, aluno)
    const renovada = await renovar(api.url, cookie)
    expect(renovada.status).toBe(200)
    // Nem a requisição nem a renovação contam como uso.
    expect((await estadoDaSessao(bancada, aluno)).ultimo_uso_em).toEqual(antes.ultimo_uso_em)

    await ultimoUsoHa(aluno, 35 * 60 + 1)
    expect((await chamar(api.url, 'GET', '/v1/eu', String(renovada.corpo['token']))).status).toBe(401)
    expect((await chamar(api.url, 'GET', '/v1/eu', aluno.token)).status).toBe(401)
    expect((await renovar(api.url, cookieDaResposta(renovada))).status).toBe(401)
  })

  it('borda: a equipe tem os 120 + 5 min do padrão também na renovação: professor com 124 min renova, com 125 min e 1 s não', async () => {
    const professor = await bancada.escolaComSessao('professor')
    const cookie = await cookieDeRenovacao(bancada, professor)
    await ultimoUsoHa(professor, 124 * 60)
    const renovada = await renovar(api.url, cookie)
    expect(renovada.status).toBe(200)

    await ultimoUsoHa(professor, 125 * 60 + 1)
    expect((await renovar(api.url, cookieDaResposta(renovada))).status).toBe(401)
    expect((await chamar(api.url, 'GET', '/v1/eu', String(renovada.corpo['token']))).status).toBe(401)
  })

  it('borda: Chromebook do carrinho — a sessão venceu por inatividade às 8h50, o cookie dela não renova às 9h, e o aluno seguinte precisa entrar', async () => {
    const escola = await bancada.escola()
    const [daTurmaDas8, daTurmaDas9] = await bancada.sessoes(escola, { quantidade: 2 })
    if (daTurmaDas8 === undefined || daTurmaDas9 === undefined) throw new Error('sessões de teste não criadas')
    const cookieNoNavegador = await cookieDeRenovacao(bancada, daTurmaDas8)
    // Último uso às 8h15: com 30 + 5 min, a sessão venceu às 8h50; são 9h.
    await ultimoUsoHa(daTurmaDas8, 45 * 60)
    const renovacoesAntes = await registrosDeAcesso(bancada, daTurmaDas8, 'renovacao')

    const renovacao = await renovar(api.url, cookieNoNavegador)

    expect(renovacao.status).toBe(401)
    expect(renovacao.corpo).not.toHaveProperty('token')
    expect(renovacao.setCookie).toEqual([expect.stringMatching(/^educa_sessao=; .*Max-Age=0$/)])
    expect(await registrosDeAcesso(bancada, daTurmaDas8, 'renovacao')).toBe(renovacoesAntes)
    expect((await chamar(api.url, 'GET', '/v1/eu', daTurmaDas8.token)).status).toBe(401)
    // A conta anterior não chega a ninguém; o aluno das 9h entra com a própria sessão.
    expect((await chamar(api.url, 'GET', '/v1/eu', daTurmaDas9.token)).corpo['usuarioId']).toBe(daTurmaDas9.usuarioId)
  })

  it('borda: sessão com atividade contínua expira nas 12 h absolutas: nem a guarda, nem a atividade, nem a renovação a estendem', async () => {
    const professor = await bancada.escolaComSessao('professor')
    const cookie = await cookieDeRenovacao(bancada, professor)
    const { expira_em: noLogin } = await estadoDaSessao(bancada, professor)
    const renovada = await renovar(api.url, cookie)
    expect(renovada.status).toBe(200)
    expect((await chamar(api.url, 'POST', '/v1/sessao/atividade', String(renovada.corpo['token']))).status).toBe(204)
    await expect.poll(async () => (await estadoDaSessao(bancada, professor)).ultimo_uso_em.getTime(), { timeout: 5_000 }).toBeGreaterThan(Date.now() - 60_000)
    // Atividade e renovação não mexeram no teto de 12 h contado do login.
    expect((await estadoDaSessao(bancada, professor)).expira_em).toEqual(noLogin)

    // Doze horas depois de entrar, usando o tempo todo.
    await bancada.pool.query("update sessao set expira_em = now() - interval '1 second', ultimo_uso_em = now() where escola_id = $1 and id = $2", [professor.escolaId, professor.sessaoId])

    expect((await chamar(api.url, 'GET', '/v1/eu', String(renovada.corpo['token']))).status).toBe(401)
    expect((await chamar(api.url, 'POST', '/v1/sessao/atividade', String(renovada.corpo['token']))).status).toBe(401)
    expect((await renovar(api.url, cookieDaResposta(renovada))).status).toBe(401)
  })

  it('caminho feliz: POST /v1/sessao/atividade responde 204 e move o último uso; requisição comum e renovação não movem', async () => {
    const aluno = await bancada.escolaComSessao()
    const cookie = await cookieDeRenovacao(bancada, aluno)
    await ultimoUsoHa(aluno, 20 * 60)
    const vinteMinutosAtras = (await estadoDaSessao(bancada, aluno)).ultimo_uso_em

    expect((await chamar(api.url, 'GET', '/v1/eu', aluno.token)).status).toBe(200)
    expect((await renovar(api.url, cookie)).status).toBe(200)
    expect((await estadoDaSessao(bancada, aluno)).ultimo_uso_em).toEqual(vinteMinutosAtras)

    const atividade = await chamar(api.url, 'POST', '/v1/sessao/atividade', aluno.token)

    expect(atividade.status).toBe(204)
    expect(atividade.corpo).toEqual({})
    await expect.poll(async () => (await estadoDaSessao(bancada, aluno)).ultimo_uso_em.getTime(), { timeout: 5_000 }).toBeGreaterThan(Date.now() - 60_000)
  })

  it('isolamento: a atividade move só a sessão da requisição; a outra sessão do mesmo usuário e a de outra escola ficam', async () => {
    const escolaA = await bancada.escola()
    const [minha, outra] = await bancada.sessoes(escolaA, { quantidade: 2 })
    const deB = await bancada.escolaComSessao()
    if (minha === undefined || outra === undefined) throw new Error('sessões de teste não criadas')
    for (const sessao of [minha, outra, deB]) await ultimoUsoHa(sessao, 20 * 60)
    const [antesDaOutra, antesDeB] = [await estadoDaSessao(bancada, outra), await estadoDaSessao(bancada, deB)]

    expect((await chamar(api.url, 'POST', '/v1/sessao/atividade', minha.token)).status).toBe(204)

    await expect.poll(async () => (await estadoDaSessao(bancada, minha)).ultimo_uso_em.getTime(), { timeout: 5_000 }).toBeGreaterThan(Date.now() - 60_000)
    expect((await estadoDaSessao(bancada, outra)).ultimo_uso_em).toEqual(antesDaOutra.ultimo_uso_em)
    expect((await estadoDaSessao(bancada, deB)).ultimo_uso_em).toEqual(antesDeB.ultimo_uso_em)
  })

  describe('falha: com o Postgres lento na gravação', () => {
    const medidorDaFalha = new MedidorDeTeste()
    let lenta: TestApi

    beforeAll(async () => {
      lenta = await subirApi(medidorDaFalha.medidor, { banco: { timeoutConsultaMs: PRAZO_DA_CONSULTA_MS } })
    })

    afterAll(async () => {
      await lenta.app.close()
      await medidorDaFalha.encerrar()
    })

    async function falhas(): Promise<number> {
      const [ponto] = await medidorDaFalha.pontos(METRICS.atividadeFalha)
      return typeof ponto?.valor === 'number' ? ponto.valor : 0
    }

    it('atividade responde 204 sem esperar a gravação, conta sessao.atividade_falha, e a sessão não cai por isso dentro da tolerância', async () => {
      const aluno = await bancada.escolaComSessao()
      await ultimoUsoHa(aluno, 32 * 60)
      const antes = await estadoDaSessao(bancada, aluno)
      expect(await falhas()).toBe(0)
      // Outra transação segura a linha da sessão: a gravação da atividade fica esperando até o prazo da consulta.
      const trava = await bancada.pool.connect()
      try {
        await trava.query('begin')
        await trava.query('select id from sessao where escola_id = $1 and id = $2 for update', [aluno.escolaId, aluno.sessaoId])

        const atividade = await chamar(lenta.url, 'POST', '/v1/sessao/atividade', aluno.token)

        // A resposta saiu antes de a gravação desistir: nada de 5xx, e a falha ainda nem aconteceu.
        expect(atividade.status).toBe(204)
        expect(await falhas()).toBe(0)
        await expect.poll(falhas, { timeout: PRAZO_DA_CONSULTA_MS + 5_000 }).toBe(1)
      } finally {
        await trava.query('rollback')
        trava.release()
      }
      // A atividade se perdeu: o último uso ficou nos 32 min, e com 30 + 5 a sessão continua valendo.
      expect((await estadoDaSessao(bancada, aluno)).ultimo_uso_em).toEqual(antes.ultimo_uso_em)
      expect((await chamar(lenta.url, 'GET', '/v1/eu', aluno.token)).status).toBe(200)
    })
  })
})
