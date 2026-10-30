import 'reflect-metadata'
import { criarLogger } from '@educa/nucleo'
import { esquemaRespostaAvisos, esquemaRespostaEstado } from '@educa/shared'
import type { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppModule } from '../src/app.module.js'
import { configurarAplicacao } from '../src/configurar-app.js'
import { configuracaoDeTeste } from './configuracao-de-teste.js'

const AVISO = { id: 'manutencao-sabado', texto: 'Manutenção programada no sábado, das 8h às 10h.', publicadoEm: '2026-09-13' }

async function subirApi(ambiente: Record<string, string>): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.com(configuracaoDeTeste({ ambiente })), { logger: false })
  configurarAplicacao(app, criarLogger({ servico: 'api-teste', nivel: 'silent' }))
  await app.init()
  return app
}

describe('GET /v1/sistema/estado e /v1/sistema/avisos', () => {
  let app: INestApplication
  let semAvisos: INestApplication

  beforeAll(async () => {
    app = await subirApi({ VERSAO: '3d4099c', AVISOS_SISTEMA: JSON.stringify([AVISO]) })
    // O `.env.example` como vem: sem aviso nenhum.
    semAvisos = await subirApi({})
  })

  afterAll(async () => {
    await app.close()
    await semAvisos.close()
  })

  it('estado responde sem token, com a versão e o ambiente da configuração e o banco verificado de verdade', async () => {
    const resposta = await request(app.getHttpServer()).get('/v1/sistema/estado')

    expect(resposta.status).toBe(200)
    expect(resposta.headers['cache-control']).toBe('no-store')
    // O parse estrito prova que nada além do contrato sai na resposta.
    expect(esquemaRespostaEstado.parse(resposta.body)).toEqual(resposta.body)
    expect(resposta.body).toMatchObject({
      versao: '3d4099c',
      ambiente: 'local',
      componentes: [
        { nome: 'api', situacao: 'disponivel' },
        { nome: 'banco', situacao: 'disponivel' },
      ],
    })
  })

  it('avisos responde sem token com os avisos da configuração, e com a lista vazia quando não há nenhum', async () => {
    const comAviso = await request(app.getHttpServer()).get('/v1/sistema/avisos')
    expect(comAviso.status).toBe(200)
    expect(comAviso.headers['cache-control']).toBe('no-store')
    expect(esquemaRespostaAvisos.parse(comAviso.body)).toEqual({ itens: [AVISO] })
    expect(comAviso.body).toEqual({ itens: [AVISO] })

    const vazio = await request(semAvisos.getHttpServer()).get('/v1/sistema/avisos')
    expect(vazio.status).toBe(200)
    expect(vazio.body).toEqual({ itens: [] })
  })

  it('token inválido não atrapalha nem muda a resposta: a rota é anônima de verdade', async () => {
    const anonimo = await request(app.getHttpServer()).get('/v1/sistema/avisos')
    const comLixo = await request(app.getHttpServer()).get('/v1/sistema/avisos').set('Authorization', 'Bearer nao.e.token')
    expect(comLixo.status).toBe(200)
    expect(comLixo.body).toEqual(anonimo.body)
  })
})
