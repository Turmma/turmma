import 'reflect-metadata'
import { createLogger, Public } from '@educa/core'
import { Controller, Get, Module, type INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { AddressInfo } from 'node:net'
import { setTimeout as esperar } from 'node:timers/promises'
import { afterAll, afterEach, beforeAll, describe, expect, it, onTestFinished } from 'vitest'
import { aguardarSaudavel, compose } from '../../../tools/testes/compose.ts'
import { AppModule } from '../src/app.module.js'
import { configurarAplicacao } from '../src/configurar-app.js'
import { configuracaoDeTeste } from './configuracao-de-teste.js'
import { BancadaDeSessoes } from './sessao-de-teste.js'

const DURACAO_DA_REQUISICAO_LENTA_MS = 2_500
const ESPERA_DA_BORDA_MS = 1_500

/** Uma requisição que ainda está em andamento quando o SIGTERM chega. */
@Public()
@Controller('teste-lento')
class ControladorLento {
  @Get()
  async lento(): Promise<{ concluida: true }> {
    await esperar(DURACAO_DA_REQUISICAO_LENTA_MS)
    return { concluida: true }
  }
}

async function subirApi(ambiente: Record<string, string> = {}): Promise<{ app: INestApplication; url: string }> {
  @Module({ imports: [AppModule.com(configuracaoDeTeste({ ambiente, banco: { timeoutConexaoMs: 500, timeoutConsultaMs: 500 } }))], controllers: [ControladorLento] })
  class ModuloDeTeste {}

  const app = await NestFactory.create(ModuloDeTeste, { logger: false })
  configurarAplicacao(app, createLogger({ servico: 'api-teste', nivel: 'silent' }))
  await app.listen(0, '127.0.0.1')
  const { port } = app.getHttpServer().address() as AddressInfo
  return { app, url: `http://127.0.0.1:${port}` }
}

describe('GET /prontidao', () => {
  let app: INestApplication
  let url: string

  beforeAll(async () => {
    ;({ app, url } = await subirApi())
  })

  afterEach(async () => {
    compose('unpause', 'postgres')
    await aguardarSaudavel('postgres')
  })

  afterAll(async () => {
    await app.close()
  })

  it('responde 200 { pronta: true } sem token e sem cache: é a sonda da borda', async () => {
    const resposta = await fetch(`${url}/prontidao`)
    expect(resposta.status).toBe(200)
    expect(await resposta.json()).toEqual({ pronta: true })
    expect(resposta.headers.get('cache-control')).toBe('no-store')
  })

  it('não consulta dependência: com o Postgres travado, a prontidão segue 200 na hora enquanto a saúde cai', async () => {
    compose('pause', 'postgres')
    const inicio = performance.now()
    const prontidao = await fetch(`${url}/prontidao`)
    const duracaoMs = performance.now() - inicio
    const saude = await fetch(`${url}/saude`)

    expect(prontidao.status).toBe(200)
    expect(duracaoMs).toBeLessThan(250)
    expect(saude.status).toBe(503)
  })
})

describe('drenagem no desligamento', () => {
  it('põe /prontidao em 503, segue atendendo durante a espera da borda, termina a requisição em andamento e só então fecha', async () => {
    const { app, url } = await subirApi({ DRENAGEM_ESPERA_BORDA_MS: String(ESPERA_DA_BORDA_MS), DRENAGEM_PRAZO_MS: '8000' })
    const sessoes = new BancadaDeSessoes()
    onTestFinished(() => sessoes.fechar())
    const { token } = await sessoes.escolaComSessao()

    const excecoesSemTratamento: unknown[] = []
    const aoExcecao = (erro: unknown) => excecoesSemTratamento.push(erro)
    process.on('uncaughtException', aoExcecao)
    onTestFinished(() => {
      process.off('uncaughtException', aoExcecao)
    })

    const emAndamento = fetch(`${url}/teste-lento`)
    await esperar(100)
    let fechou = false
    const fechamento = app.close().then(() => {
      fechou = true
    })
    await esperar(100)

    // A borda ainda pode mandar requisição até a próxima sonda: a instância atende normalmente.
    const prontidao = await fetch(`${url}/prontidao`)
    const autenticada = await fetch(`${url}/v1/sistema/contexto`, { headers: { Authorization: `Bearer ${token}` } })
    // Drenando, a resposta fecha a conexão: a borda não guarda conexão com quem está saindo.
    expect(autenticada.headers.get('connection')).toBe('close')
    expect(prontidao.status).toBe(503)
    expect(await prontidao.json()).toEqual({ pronta: false })
    expect(autenticada.status).toBe(200)
    expect(fechou).toBe(false)

    // 404 de GET e HEAD sem corpo: o Express responde na hora, antes de qualquer ouvinte tardio.
    // A drenagem não pode tentar mexer num cabeçalho já enviado (derrubaria o processo no deploy).
    for (const metodo of ['GET', 'HEAD']) {
      const inexistente = await fetch(`${url}/rota-que-nao-existe`, { method: metodo })
      expect(inexistente.status, metodo).toBe(404)
      expect(inexistente.headers.get('connection'), metodo).toBe('close')
      if (metodo === 'GET') expect(((await inexistente.json()) as { erro: { codigo: string } }).erro.codigo).toBe('NAO_ENCONTRADO')
    }
    expect(excecoesSemTratamento).toEqual([])

    const lenta = await emAndamento
    expect(lenta.status).toBe(200)
    expect(await lenta.json()).toEqual({ concluida: true })
    const terminouEm = performance.now()

    // A conexão da requisição lenta começou antes da drenagem e ficaria ociosa por 65 s
    // (OCIOSIDADE_HTTP_MS), segurando o fechamento além do prazo. Ela é fechada logo depois da resposta.
    await fechamento
    expect(performance.now() - terminouEm).toBeLessThan(1_000)
    expect(excecoesSemTratamento).toEqual([])
    await expect(fetch(`${url}/prontidao`)).rejects.toThrow()
  })
})
