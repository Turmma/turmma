import 'reflect-metadata'
import { createLogger, type Meter } from '@educa/core'
import type { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { createHash, randomBytes } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { AppModule, type OpcoesDeMontagem } from '../src/app.module.js'
import { configurarAplicacao } from '../src/configurar-app.js'
import { configuracaoDeTeste, MONTAGEM_DE_TESTE, type SobreposicaoDeTeste } from './configuracao-de-teste.js'
import type { BancadaDeSessoes, SessaoDeTeste } from './sessao-de-teste.js'

/** A API de verdade, montada pelo mesmo `AppModule` e `configurarAplicacao` do boot, numa porta livre. */
export interface ApiDeTeste {
  readonly app: INestApplication
  readonly url: string
}

/**
 * Sobe a API com a montagem de teste (`MONTAGEM_DE_TESTE`, que fixa o prazo maior do cliente Redis do login qualquer
 * que seja a configuração). Com `montagem` vazia, o prazo passa a sair da configuração, como no contêiner, e o do
 * compose de teste é o de 2 s. **Quem quer o corte de 100 ms pede o prazo na configuração**, com
 * `{ login: { prazoDoRedisMs: TIMEOUT_COMANDO_REDIS_API_MS } }`, e não a montagem vazia
 * (`ataque-de-senha.int.test.ts`, "falha (15.5)"). Com `linhasDeLog`, o logger escreve tudo, até `trace`, nessa
 * lista, para o teste procurar nela o que nunca pode ir a log; sem ela, o log fica mudo.
 */
export async function subirApi(medidor: Meter, sobreposicao: SobreposicaoDeTeste = {}, linhasDeLog?: string[], montagem: OpcoesDeMontagem = MONTAGEM_DE_TESTE): Promise<ApiDeTeste> {
  const logger =
    linhasDeLog === undefined
      ? createLogger({ servico: 'api-teste', nivel: 'silent' })
      : createLogger({ servico: 'api-teste', nivel: 'trace', destino: { write: (linha: string) => linhasDeLog.push(linha) } })
  const app = await NestFactory.create(AppModule.com(configuracaoDeTeste(sobreposicao), { ...montagem, medidor, logger }), { logger: false })
  configurarAplicacao(app, logger, medidor)
  await app.listen(0, '127.0.0.1')
  return { app, url: `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}` }
}

export interface RespostaHttp {
  readonly status: number
  readonly corpo: Record<string, unknown> & { erro?: { codigo?: string } }
  readonly setCookie: string[]
}

async function lerResposta(resposta: Response): Promise<RespostaHttp> {
  const texto = await resposta.text()
  return { status: resposta.status, corpo: texto === '' ? {} : (JSON.parse(texto) as RespostaHttp['corpo']), setCookie: resposta.headers.getSetCookie() }
}

/**
 * Uma chamada autenticada com o token, como a web faz; sem token (`undefined`), a da rota anônima. `cabecalhos` soma os
 * que o teste quer mandar, como o `X-Forwarded-For` do IP que o log nunca pode ter (A4 da A1).
 */
export async function chamar(url: string, metodo: string, caminho: string, token: string | undefined, corpo?: unknown, cabecalhos: Record<string, string> = {}): Promise<RespostaHttp> {
  const resposta = await fetch(`${url}${caminho}`, {
    method: metodo,
    headers: {
      ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }),
      ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...cabecalhos,
    },
    ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
  })
  return lerResposta(resposta)
}

/** `POST /v1/sessao/renovar` com o cabeçalho `Cookie` que o navegador mandaria. */
export async function renovar(url: string, cookie: string | undefined): Promise<RespostaHttp> {
  const resposta = await fetch(`${url}/v1/sessao/renovar`, { method: 'POST', headers: cookie === undefined ? {} : { Cookie: cookie } })
  return lerResposta(resposta)
}

/** O `Cookie` que o navegador mandaria depois deste `Set-Cookie` de `educa_sessao`. */
export function cookieDaResposta(resposta: RespostaHttp): string {
  const linha = resposta.setCookie.find((valor) => valor.startsWith('educa_sessao='))
  if (linha === undefined) throw new Error('a resposta não trouxe educa_sessao')
  return linha.split(';')[0] ?? ''
}

/** O SHA-256 do refresh, como `sessao.refresh_hash` o guarda. */
export function hashDoCookie(cookie: string): string {
  return createHash('sha256')
    .update(cookie.slice('educa_sessao='.length))
    .digest('hex')
}

/**
 * Dá à sessão de teste um cookie de renovação que o teste conhece, como o login faria: a sessão sintética nasce com
 * um refresh que ninguém guarda.
 */
export async function cookieDeRenovacao(bancada: BancadaDeSessoes, sessao: SessaoDeTeste): Promise<string> {
  const cookie = `educa_sessao=${randomBytes(32).toString('base64url')}`
  await bancada.pool.query('update sessao set refresh_hash = $1 where escola_id = $2 and id = $3', [hashDoCookie(cookie), sessao.escolaId, sessao.sessaoId])
  return cookie
}

export interface EstadoDaSessaoNoBanco {
  readonly refresh_hash: string
  readonly refresh_hash_anterior: string | null
  readonly atual_apresentado: boolean
  readonly rotacionado_em: Date | null
  readonly ultimo_uso_em: Date
  readonly expira_em: Date
  readonly encerrada_em: Date | null
  readonly motivo: string | null
  readonly familia: string
}

export async function estadoDaSessao(bancada: BancadaDeSessoes, sessao: Pick<SessaoDeTeste, 'escolaId' | 'sessaoId'>): Promise<EstadoDaSessaoNoBanco> {
  const { rows } = await bancada.pool.query<EstadoDaSessaoNoBanco>(
    'select refresh_hash, refresh_hash_anterior, atual_apresentado, rotacionado_em, ultimo_uso_em, expira_em, encerrada_em, motivo, familia from sessao where escola_id = $1 and id = $2',
    [sessao.escolaId, sessao.sessaoId],
  )
  const [linha] = rows
  if (linha === undefined) throw new Error('sessão de teste não encontrada')
  return linha
}

/** Quantos registros de acesso do evento o usuário tem na escola. */
export async function registrosDeAcesso(bancada: BancadaDeSessoes, sessao: Pick<SessaoDeTeste, 'escolaId' | 'usuarioId'>, evento: string): Promise<number> {
  const { rows } = await bancada.pool.query<{ total: string }>('select count(*) as total from registro_acesso where escola_id = $1 and usuario_id = $2 and evento = $3', [
    sessao.escolaId,
    sessao.usuarioId,
    evento,
  ])
  return Number(rows[0]?.total)
}

/** O que a web lê de uma resposta de login para decidir se tenta de novo: o status e o `Retry-After`. */
export interface RespostaComEspera {
  readonly status: number
  readonly retryAfter: string | null
}

/** Quanto a web repete o login no 503 antes de mostrar erro (Tech Spec da identidade, seção 5, "Fila"). */
export const PRAZO_DA_WEB_NO_503_MS = 30_000

/**
 * Faz o pedido como a web faz no login: no 503 do semáforo do hash, espera o `Retry-After` e tenta de novo, por até
 * 30 s. Devolve a última resposta e os 503 do caminho, para o teste conferir que eles só atrasaram.
 */
export async function comoAWebNo503<R extends RespostaComEspera>(pedir: () => Promise<R>): Promise<{ resposta: R; recusas: R[] }> {
  const prazo = performance.now() + PRAZO_DA_WEB_NO_503_MS
  const recusas: R[] = []
  for (;;) {
    const resposta = await pedir()
    if (resposta.status !== 503 || performance.now() > prazo) return { resposta, recusas }
    recusas.push(resposta)
    await new Promise((resolver) => setTimeout(resolver, Number(resposta.retryAfter) * 1_000))
  }
}
