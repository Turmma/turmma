import { METRICS } from '@educa/nucleo'
import { ErrorCode, JANELA_DE_RENOVACAO_SIMULTANEA_MS } from '@educa/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { chamar, cookieDaResposta, cookieDeRenovacao, estadoDaSessao, hashDoCookie, registrosDeAcesso, renovar, subirApi, type ApiDeTeste, type RespostaHttp } from './api-com-sessao.js'
import { BancadaDeSessoes, type SessaoDeTeste } from './sessao-de-teste.js'

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms))

describe('POST /v1/sessao/renovar: a sessão dura enquanto a pessoa usa, e o cookie roubado encerra a família', () => {
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

  async function renovacoes(resultado: string): Promise<number> {
    const pontos = await medidor.pontos(METRICS.renovacaoDeSessao)
    const ponto = pontos.find((candidato) => candidato.atributos['resultado'] === resultado)
    return typeof ponto?.valor === 'number' ? ponto.valor : 0
  }

  /** Usa o token numa requisição qualquer e espera a guarda marcar `atual_apresentado`, que não segura a resposta. */
  async function apresentar(sessao: SessaoDeTeste, resposta: RespostaHttp): Promise<void> {
    expect((await chamar(api.url, 'GET', '/v1/eu', String(resposta.corpo['token']))).status).toBe(200)
    await expect.poll(async () => (await estadoDaSessao(bancada, sessao)).atual_apresentado, { timeout: 5_000 }).toBe(true)
  }

  /** Leva a última rotação para `segundos` atrás, como se o tempo tivesse passado (a hora que conta é a do banco). */
  async function rotacaoHa(sessao: SessaoDeTeste, segundos: number): Promise<void> {
    await bancada.pool.query(`update sessao set rotacionado_em = now() - make_interval(secs => $3) where escola_id = $1 and id = $2`, [sessao.escolaId, sessao.sessaoId, segundos])
  }

  function esperarRecusada(resposta: RespostaHttp): void {
    expect(resposta.status).toBe(401)
    expect(resposta.corpo.erro?.codigo).toBe(ErrorCode.NAO_AUTENTICADO)
    // O cookie que não vale mais sai do navegador.
    expect(resposta.setCookie).toEqual([expect.stringMatching(/^educa_sessao=; Path=\/v1\/sessao; HttpOnly; SameSite=Strict; Max-Age=0$/)])
  }

  it('caminho feliz: devolve token e cookie novos, guarda o anterior, não mexe no último uso nem nas 12 h, e grava a renovação', async () => {
    const aluno = await bancada.escolaComSessao()
    const cookie = await cookieDeRenovacao(bancada, aluno)
    const antes = await estadoDaSessao(bancada, aluno)
    const [okAntes, registrosAntes] = [await renovacoes('ok'), await registrosDeAcesso(bancada, aluno, 'renovacao')]

    const resposta = await renovar(api.url, cookie)

    expect(resposta.status).toBe(200)
    expect(resposta.corpo).toEqual({ token: expect.stringMatching(/^ey/), expiraEm: expect.any(String) })
    expect(resposta.setCookie).toHaveLength(1)
    expect(resposta.setCookie[0]).toMatch(/^educa_sessao=[\w-]{43}; Path=\/v1\/sessao; HttpOnly; SameSite=Strict$/)
    const depois = await estadoDaSessao(bancada, aluno)
    expect(depois.refresh_hash).toBe(hashDoCookie(cookieDaResposta(resposta)))
    expect(depois.refresh_hash_anterior).toBe(hashDoCookie(cookie))
    expect(depois.atual_apresentado).toBe(false)
    expect(depois.rotacionado_em).not.toBeNull()
    // Renovar não é uso, e não estica a sessão.
    expect(depois.ultimo_uso_em).toEqual(antes.ultimo_uso_em)
    expect(depois.expira_em).toEqual(antes.expira_em)
    expect(await registrosDeAcesso(bancada, aluno, 'renovacao')).toBe(registrosAntes + 1)
    expect(await renovacoes('ok')).toBe(okAntes + 1)
    // O token novo é da mesma sessão, e entra.
    expect((await chamar(api.url, 'GET', '/v1/eu', String(resposta.corpo['token']))).corpo['usuarioId']).toBe(aluno.usuarioId)
  })

  it('o token de antes da rotação não marca a sessão como apresentada; o token da rotação marca', async () => {
    const aluno = await bancada.escolaComSessao()
    const resposta = await renovar(api.url, await cookieDeRenovacao(bancada, aluno))
    expect(resposta.status).toBe(200)

    // O token antigo continua valendo até vencer, mas não é o da rotação.
    expect((await chamar(api.url, 'GET', '/v1/eu', aluno.token)).status).toBe(200)
    await esperar(300)
    expect((await estadoDaSessao(bancada, aluno)).atual_apresentado).toBe(false)

    await apresentar(aluno, resposta)
  })

  it('duas abas: o cookie antigo, com o novo já usado e dentro de 30 s, dá 409 JA_RENOVADO sem encerrar, e o cookie novo segue renovando', async () => {
    const aluno = await bancada.escolaComSessao()
    const cookie = await cookieDeRenovacao(bancada, aluno)
    const primeira = await renovar(api.url, cookie)
    await apresentar(aluno, primeira)
    await rotacaoHa(aluno, 29)
    const jaRenovadoAntes = await renovacoes('ja_renovado')

    const segunda = await renovar(api.url, cookie)

    expect(segunda.status).toBe(409)
    expect(segunda.corpo.erro?.codigo).toBe(ErrorCode.JA_RENOVADO)
    expect(segunda.setCookie).toEqual([])
    expect(await renovacoes('ja_renovado')).toBe(jaRenovadoAntes + 1)
    const estado = await estadoDaSessao(bancada, aluno)
    expect(estado.encerrada_em).toBeNull()
    expect(estado.refresh_hash).toBe(hashDoCookie(cookieDaResposta(primeira)))
    expect((await chamar(api.url, 'GET', '/v1/eu', String(primeira.corpo['token']))).status).toBe(200)
    expect((await renovar(api.url, cookieDaResposta(primeira))).status).toBe(200)
  })

  it('concorrência: renovações em paralelo com o mesmo cookie dão uma 200 e as outras 409, e a família continua viva', async () => {
    const aluno = await bancada.escolaComSessao()
    const cookie = await cookieDeRenovacao(bancada, aluno)

    const respostas = await Promise.all([renovar(api.url, cookie), renovar(api.url, cookie), renovar(api.url, cookie)])

    expect(respostas.map((resposta) => resposta.status).sort()).toEqual([200, 409, 409])
    for (const recusada of respostas.filter((resposta) => resposta.status === 409)) {
      expect(recusada.corpo.erro?.codigo).toBe(ErrorCode.JA_RENOVADO)
      expect(recusada.setCookie).toEqual([])
    }
    const vencedora = respostas.find((resposta) => resposta.status === 200)
    if (vencedora === undefined) throw new Error('nenhuma renovação passou')
    const estado = await estadoDaSessao(bancada, aluno)
    expect(estado.encerrada_em).toBeNull()
    // Uma rotação só: o anterior é o cookie das três, e o atual é o da que passou.
    expect(estado.refresh_hash_anterior).toBe(hashDoCookie(cookie))
    expect(estado.refresh_hash).toBe(hashDoCookie(cookieDaResposta(vencedora)))
    expect((await renovar(api.url, cookieDaResposta(vencedora))).status).toBe(200)
  })

  it('borda: resposta perdida, com o anterior reapresentado e o atual nunca usado, rotaciona de novo sem encerrar', async () => {
    const aluno = await bancada.escolaComSessao()
    const cookie = await cookieDeRenovacao(bancada, aluno)
    // A queda de rede no Chromebook: o servidor rotacionou, e a resposta (token e cookie novos) nunca chegou.
    const perdida = await renovar(api.url, cookie)
    expect(perdida.status).toBe(200)
    // O cliente notou a falha e tenta de novo com o cookie que ainda tem, depois da janela de renovação simultânea.
    await rotacaoHa(aluno, JANELA_DE_RENOVACAO_SIMULTANEA_MS / 1_000 + 1)
    const perdidasAntes = await renovacoes('resposta_perdida')

    const deNovo = await renovar(api.url, cookie)

    expect(deNovo.status).toBe(200)
    expect(await renovacoes('resposta_perdida')).toBe(perdidasAntes + 1)
    const estado = await estadoDaSessao(bancada, aluno)
    expect(estado.encerrada_em).toBeNull()
    // O anterior continua o que o navegador tem, e o atual é o da segunda resposta.
    expect(estado.refresh_hash_anterior).toBe(hashDoCookie(cookie))
    expect(estado.refresh_hash).toBe(hashDoCookie(cookieDaResposta(deNovo)))
    expect((await chamar(api.url, 'GET', '/v1/eu', String(deNovo.corpo['token']))).status).toBe(200)
    // O cookie da resposta perdida não vale, e não derruba a família: ninguém o recebeu.
    esperarRecusada(await renovar(api.url, cookieDaResposta(perdida)))
    expect((await estadoDaSessao(bancada, aluno)).encerrada_em).toBeNull()
    expect((await renovar(api.url, cookieDaResposta(deNovo))).status).toBe(200)
  })

  it('borda: o anterior reapresentado 31 s depois, com o atual já usado, encerra a família toda, grava a auditoria e conta o reuso; a família de outra escola fica', async () => {
    const escolaA = await bancada.escola()
    const [aluno, outraDaFamilia] = await bancada.sessoes(escolaA, { quantidade: 2 })
    const deOutraEscola = await bancada.escolaComSessao()
    if (aluno === undefined || outraDaFamilia === undefined) throw new Error('sessões de teste não criadas')
    const { familia } = await estadoDaSessao(bancada, aluno)
    // A mesma família em duas sessões da escola A, e o mesmo id de família forçado numa sessão da escola B.
    await bancada.pool.query('update sessao set familia = $1 where (escola_id = $2 and id = $3) or (escola_id = $4 and id = $5)', [familia, escolaA, outraDaFamilia.sessaoId, deOutraEscola.escolaId, deOutraEscola.sessaoId])
    const cookie = await cookieDeRenovacao(bancada, aluno)
    const legitima = await renovar(api.url, cookie)
    await apresentar(aluno, legitima)
    await rotacaoHa(aluno, 31)
    const reusosAntes = await renovacoes('reuso')

    esperarRecusada(await renovar(api.url, cookie))

    expect(await renovacoes('reuso')).toBe(reusosAntes + 1)
    for (const sessao of [aluno, outraDaFamilia]) {
      expect(await estadoDaSessao(bancada, sessao)).toMatchObject({ encerrada_em: expect.any(Date), motivo: 'reuso_de_refresh' })
    }
    expect((await estadoDaSessao(bancada, deOutraEscola)).encerrada_em).toBeNull()
    const { rows: auditoria } = await bancada.pool.query<{ escola_id: string; autor_usuario_id: string; entidade: string; entidade_id: string; antes: unknown; depois: unknown }>(
      "select escola_id, autor_usuario_id, entidade, entidade_id, antes, depois from auditoria where escola_id = $1 and acao = 'sessao.reuso_de_refresh'",
      [escolaA],
    )
    expect(auditoria).toEqual([{ escola_id: escolaA, autor_usuario_id: aluno.usuarioId, entidade: 'sessao', entidade_id: aluno.sessaoId, antes: null, depois: { familia, sessoesEncerradas: 2 } }])
    // Nada do que a família tinha vale mais: o token legítimo, o cookie legítimo, a outra sessão.
    expect((await chamar(api.url, 'GET', '/v1/eu', String(legitima.corpo['token']))).status).toBe(401)
    esperarRecusada(await renovar(api.url, cookieDaResposta(legitima)))
    expect((await chamar(api.url, 'GET', '/v1/eu', await outraDaFamilia.tokenNovo())).status).toBe(401)
    expect((await chamar(api.url, 'GET', '/v1/eu', await deOutraEscola.tokenNovo())).status).toBe(200)
  })

  it('concorrência: o cookie roubado reapresentado duas vezes ao mesmo tempo conta um reuso só, com uma auditoria', async () => {
    const aluno = await bancada.escolaComSessao()
    const cookie = await cookieDeRenovacao(bancada, aluno)
    await apresentar(aluno, await renovar(api.url, cookie))
    await rotacaoHa(aluno, 31)
    const reusosAntes = await renovacoes('reuso')

    const respostas = await Promise.all([renovar(api.url, cookie), renovar(api.url, cookie)])

    for (const resposta of respostas) esperarRecusada(resposta)
    expect(await renovacoes('reuso')).toBe(reusosAntes + 1)
    const { rows } = await bancada.pool.query<{ total: string }>("select count(*) as total from auditoria where escola_id = $1 and acao = 'sessao.reuso_de_refresh'", [aluno.escolaId])
    expect(Number(rows[0]?.total)).toBe(1)
  })

  it('borda: cookie ausente, fora do formato ou desconhecido dá o mesmo 401 e apaga o cookie', async () => {
    const recusadasAntes = await renovacoes('recusada')
    for (const cookie of [undefined, 'educa_sessao=curto', 'outro_cookie=x', `educa_sessao=${'a'.repeat(43)}`]) esperarRecusada(await renovar(api.url, cookie))
    expect(await renovacoes('recusada')).toBe(recusadasAntes + 4)
  })
})
