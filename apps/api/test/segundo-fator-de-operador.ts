import { criarLogger, type Meter, type PoolBanco } from '@educa/nucleo'
import { ErrorCode, configurarSegundoFatorDeOperadorResponseSchema, MENSAGENS_DE_ERRO, type ConfigurarSegundoFatorDeOperadorResponse } from '@educa/shared'
import type { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { randomBytes } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { Secret, TOTP } from 'otpauth'
import { expect } from 'vitest'
import { AppModule } from '../src/app.module.js'
import type { ConfiguracaoApi } from '../src/config.js'
import { configurarAplicacao } from '../src/configurar-app.js'
import { EmissorDeDesafioDeOperador, type EtapaDoDesafioDeOperador } from '../src/operacao/desafio-de-operador.js'
import { CifraDoSegredo, gerarCodigosDeRecuperacao, gerarSegredo, hmacDaRecuperacao, PERIODO_TOTP_SEGUNDOS } from '../src/credencial/index.js'
import { configuracaoDeTeste, MONTAGEM_DE_TESTE } from './configuracao-de-teste.js'

/**
 * Apoio dos testes do segundo fator do operador (tarefa 7.0): requisição, comparação com a resposta de desafio
 * inválido, barreira, código TOTP de um passo, desafio emitido com a chave de produção e o estado da linha do operador.
 * Nada de pessoa: os operadores vêm da `BancadaDeOperadores`.
 */

export interface Resposta {
  readonly status: number
  readonly corpo: unknown
  readonly cacheControl: string | null
  readonly retryAfter: string | null
  readonly setCookie: string[]
}

export type Cabecalhos = Record<string, string>

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export const CONFIGURAR = '/v1/operacao/sessao/mfa/configurar'
export const ENTRAR = '/v1/operacao/sessao/mfa'

export async function pedir(url: string, verbo: string, caminho: string, corpo?: unknown, cabecalhos: Cabecalhos = {}): Promise<Resposta> {
  const resposta = await fetch(`${url}${caminho}`, {
    method: verbo,
    headers: { ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }), ...cabecalhos },
    ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
  })
  const texto = await resposta.text()
  return {
    status: resposta.status,
    corpo: texto === '' ? undefined : (JSON.parse(texto) as unknown),
    cacheControl: resposta.headers.get('cache-control'),
    retryAfter: resposta.headers.get('retry-after'),
    setCookie: resposta.headers.getSetCookie(),
  }
}

/** O corpo sem o `requisicaoId`, que muda a cada requisição: o resto tem de ser igual, byte a byte. */
export function semRequisicaoId(corpo: unknown): unknown {
  if (typeof corpo !== 'object' || corpo === null || !('erro' in corpo)) return corpo
  const { requisicaoId: _id, ...erro } = (corpo as { erro: Record<string, unknown> }).erro
  return { erro }
}

/** Status e corpo (sem o `requisicaoId`), para comparar respostas que precisam ser iguais. */
export const forma = (resposta: Resposta) => ({ status: resposta.status, corpo: semRequisicaoId(resposta.corpo) })

export function esperarErro(resposta: Resposta, status: number, codigo: ErrorCode): void {
  expect(resposta.status).toBe(status)
  expect(resposta.corpo).toEqual({ erro: { codigo, mensagem: MENSAGENS_DE_ERRO[codigo], requisicaoId: expect.stringMatching(UUID) } })
}

/** Um IP sorteado entre 16 milhões: os baldes `rl:ip` ficam no Redis entre um teste e outro. */
export const ipSorteado = () => `10.${[...randomBytes(3)].join('.')}`
export const doIp = (ip = ipSorteado()): Cabecalhos => ({ 'X-Forwarded-For': ip })

export async function subir(
  config: ConfiguracaoApi = configuracaoDeTeste({ ambiente: { LIMITE_PROXIES_CONFIAVEIS: '127.0.0.1' } }),
  linhasDeLog?: string[],
  medidor?: Meter,
): Promise<{ app: INestApplication; url: string }> {
  const app = await NestFactory.create(AppModule.com(config, { ...MONTAGEM_DE_TESTE, ...(medidor === undefined ? {} : { medidor }) }), { logger: false })
  const logger =
    linhasDeLog === undefined
      ? criarLogger({ servico: 'api-teste', nivel: 'silent' })
      : criarLogger({ servico: 'api-teste', nivel: 'trace', destino: { write: (linha: string) => linhasDeLog.push(linha) } })
  configurarAplicacao(app, logger, medidor)
  await app.listen(0, '127.0.0.1')
  return { app, url: `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}` }
}

/** Uma barreira: segura quem chama até `soltar`, e avisa quando `quantos` chegaram. */
export function barreira(quantos = 1): { chegaram: Promise<void>; esperar: () => Promise<void>; soltar: () => void } {
  let chegados = 0
  let avisar: () => void = () => undefined
  let liberar: () => void = () => undefined
  const chegaram = new Promise<void>((resolver) => (avisar = resolver))
  const solta = new Promise<void>((resolver) => (liberar = resolver))
  return {
    chegaram,
    esperar: async () => {
      chegados += 1
      if (chegados >= quantos) avisar()
      await solta
    },
    soltar: () => liberar(),
  }
}

const PERIODO_MS = PERIODO_TOTP_SEGUNDOS * 1_000
export const passoAtual = () => Math.floor(Date.now() / PERIODO_MS)

/** O código de seis dígitos do segredo no passo pedido: o que o app autenticador mostraria. */
export function codigoDoPasso(base32: string, passo: number): string {
  return TOTP.generate({ secret: Secret.fromBase32(base32), algorithm: 'SHA1', digits: 6, period: PERIODO_TOTP_SEGUNDOS, timestamp: passo * PERIODO_MS })
}

const configuracao = configuracaoDeTeste()
const emissorDeDesafio = new EmissorDeDesafioDeOperador(configuracao.identidade.chaveAssinatura)
const cifra = new CifraDoSegredo(configuracao.login.mfa.versaoCifra, configuracao.login.mfa.chavesCifra)

/** Um desafio de operador emitido com a chave de produção: o que o aceite, a entrada ou o configurar devolveriam. */
export function desafio(operadorId: string, etapa: EtapaDoDesafioDeOperador, versao?: number): Promise<string> {
  return emissorDeDesafio.emitir({ operadorId, etapa, ...(versao === undefined ? {} : { versao }) })
}

/** Um desafio assinado com outra chave: a referência da resposta de "desafio inválido". */
export function desafioInvalido(operadorId: string, etapa: EtapaDoDesafioDeOperador): Promise<string> {
  return new EmissorDeDesafioDeOperador(new TextEncoder().encode('outra_chave_sintetica_com_32_caracteres')).emitir({ operadorId, etapa })
}

export const hmacDoCodigo = (codigo: string) => hmacDaRecuperacao(configuracao.login.mfa.chaveRecuperacao, codigo)

/** O segredo gravado, decifrado com o `operador.id` como AAD, em base32: para comparar com o que cada aba recebeu. */
export function base32DoGravado(operadorId: string, cifrado: Buffer, versao: number): string {
  return new Secret({ buffer: cifra.decifrar({ cifrado, versao }, operadorId).slice().buffer }).base32
}

/** O segundo fator ativo gravado direto no banco, com a cifra de produção: o estado depois do primeiro código. Sem sessão. */
export async function ativarNoBanco(pool: PoolBanco, operadorId: string): Promise<{ base32: string; codigos: string[] }> {
  const novo = gerarSegredo()
  const { cifrado, versao } = cifra.cifrar(novo.bytes, operadorId)
  await pool.query('update operador set mfa_segredo_cifrado = $1, mfa_chave_versao = $2, mfa_versao = mfa_versao + 1, mfa_ativado_em = now(), mfa_ultimo_passo = null where id = $3', [cifrado, versao, operadorId])
  const codigos = gerarCodigosDeRecuperacao()
  for (const codigo of codigos) await pool.query('insert into codigo_recuperacao_operador (operador_id, hmac) values ($1, $2)', [operadorId, hmacDoCodigo(codigo)])
  return { base32: novo.base32, codigos }
}

export interface EstadoDoOperador {
  readonly nome: string | null
  readonly email: string | null
  readonly senhaHash: string | null
  readonly segredoCifrado: Buffer | null
  readonly chaveVersao: number | null
  readonly mfaVersao: number
  readonly ativadoEm: Date | null
  readonly ultimoPasso: string | null
  readonly desativadoEm: Date | null
  readonly hmacs: string[]
  readonly sessoes: number
  readonly sessoesAbertas: number
}

export async function estadoDoOperador(pool: PoolBanco, operadorId: string): Promise<EstadoDoOperador> {
  const { rows } = await pool.query<EstadoDoOperador>(
    `select o.nome, o.email, o.senha_hash as "senhaHash", o.mfa_segredo_cifrado as "segredoCifrado", o.mfa_chave_versao as "chaveVersao",
            o.mfa_versao as "mfaVersao", o.mfa_ativado_em as "ativadoEm", o.mfa_ultimo_passo as "ultimoPasso", o.desativado_em as "desativadoEm",
            coalesce((select array_agg(c.hmac) from codigo_recuperacao_operador c where c.operador_id = o.id), '{}') as hmacs,
            (select count(*)::int from sessao_operador s where s.operador_id = o.id) as sessoes,
            (select count(*)::int from sessao_operador s where s.operador_id = o.id and s.encerrada_em is null) as "sessoesAbertas"
       from operador o where o.id = $1`,
    [operadorId],
  )
  const linha = rows[0]
  if (linha === undefined) throw new Error('operador não encontrado')
  // Ordenados em JavaScript, como o teste ordena os que calcula: a colação do banco ordenaria diferente.
  return { ...linha, hmacs: [...linha.hmacs].sort() }
}

/** O estado do C6: a linha só com id, apelido e datas, sem código de recuperação. */
export function esperarSoIdApelidoEDatas(estado: EstadoDoOperador): void {
  expect({
    nome: estado.nome,
    email: estado.email,
    senhaHash: estado.senhaHash,
    segredoCifrado: estado.segredoCifrado,
    chaveVersao: estado.chaveVersao,
    ativadoEm: estado.ativadoEm,
    ultimoPasso: estado.ultimoPasso,
    hmacs: estado.hmacs,
  }).toEqual({ nome: null, email: null, senhaHash: null, segredoCifrado: null, chaveVersao: null, ativadoEm: null, ultimoPasso: null, hmacs: [] })
  expect(estado.desativadoEm).toBeInstanceOf(Date)
}

/** `POST /mfa/configurar` com o desafio, e a resposta já conferida pelo contrato quando é 200. */
export async function configurar(url: string, desafioDaEtapa: string, cabecalhos: Cabecalhos = doIp()): Promise<{ resposta: Resposta; corpo: ConfigurarSegundoFatorDeOperadorResponse | undefined }> {
  const resposta = await pedir(url, 'POST', CONFIGURAR, { desafio: desafioDaEtapa }, cabecalhos)
  return { resposta, corpo: resposta.status === 200 ? configurarSegundoFatorDeOperadorResponseSchema.parse(resposta.corpo) : undefined }
}

/** `POST /sessao/mfa` com o desafio e o código do app ou o de recuperação. */
export function entrar(url: string, corpo: { desafio: string; codigo: string } | { desafio: string; recuperacao: string }, cabecalhos: Cabecalhos = doIp()): Promise<Resposta> {
  return pedir(url, 'POST', ENTRAR, corpo, cabecalhos)
}

/** O valor do `Set-Cookie` pedido, ou `undefined`. */
export function valorDoCookie(setCookie: readonly string[], nome: string): string | undefined {
  const linha = setCookie.find((cabecalho) => cabecalho.startsWith(`${nome}=`))
  return linha?.split(';')[0]?.slice(nome.length + 1)
}

/**
 * Espera até algum backend deste banco estar parado num lock que não ganhou, com a consulta que casa o padrão (`like`):
 * é a prova de que a transação está na fila da trava, e não só atrasada.
 */
export async function esperarNaFila(pool: PoolBanco, padraoDaConsulta: string): Promise<void> {
  await expect
    .poll(
      async () => {
        const { rows } = await pool.query<{ total: number }>(
          `select count(*)::int as total from pg_locks l join pg_stat_activity a on a.pid = l.pid
            where not l.granted and a.datname = current_database() and a.query like $1`,
          [padraoDaConsulta],
        )
        return rows[0]?.total
      },
      { timeout: 10_000, interval: 25 },
    )
    .toBeGreaterThan(0)
}
