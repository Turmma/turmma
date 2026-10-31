import { createLogger, type LoggerBase, type Meter } from '@educa/core'
import { SYSTEM_REALTIME_NAMESPACE, realtimeClientOptions } from '@educa/shared'
import type { INestApplication } from '@nestjs/common'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { Server } from 'socket.io'
import { io, type Socket as SocketCliente } from 'socket.io-client'
import { lerAmbienteDeTeste, valorObrigatorio } from '../../../tools/ci/compose.ts'
import { urlDoBancoDeTeste } from '../../../tools/testes/integracao.setup.ts'
import { criarClienteRedisDoRealtime, prepararServidorRealtime } from '../src/redis-adapter.js'
import { lerConfiguracao, type ConfiguracaoRealtime } from '../src/config.js'
import { criarAplicacaoRealtime } from '../src/configure-app.js'

export const ambienteDeTeste = lerAmbienteDeTeste()

export function urlRedisDeFila(): string {
  return `redis://127.0.0.1:${valorObrigatorio(ambienteDeTeste, 'REDIS_FILA_PORTA_HOST')}`
}

/**
 * Configuração pelo mesmo `lerConfiguracao` do boot, com o Redis de fila e o Postgres do compose de teste.
 * O handshake lê a sessão gravada nesse Postgres, com a mesma consulta da API.
 */
export function configuracaoDeTeste(ambiente: Record<string, string> = {}): ConfiguracaoRealtime {
  return lerConfiguracao({
    ...ambienteDeTeste,
    REALTIME_PORTA: '3000',
    REDIS_FILA_URL: urlRedisDeFila(),
    BANCO_URL: urlDoBancoDeTeste(),
    // A do compose. No teste nada é exportado: a métrica é lida pelo medidor em memória, quando há.
    TELEMETRIA_OTLP_URL: 'http://observabilidade:4318',
    DRENAGEM_ESPERA_BORDA_MS: '10',
    ...ambiente,
  })
}

export interface InstanciaDeTeste {
  app: INestApplication
  url: string
}

export async function subirInstancia(logger: LoggerBase, ambiente: Record<string, string> = {}, medidor?: Meter): Promise<InstanciaDeTeste> {
  const app = await criarAplicacaoRealtime(configuracaoDeTeste(ambiente), logger, ...(medidor === undefined ? [] : [medidor]))
  await app.listen(0, '127.0.0.1')
  const { port } = app.getHttpServer().address() as AddressInfo
  return { app, url: `http://127.0.0.1:${port}` }
}

/** Log em memória, para o teste ler o que a instância escreveria no stdout. */
export function loggerEmMemoria(): { logger: LoggerBase; linhas: string[] } {
  const linhas: string[] = []
  return { linhas, logger: createLogger({ servico: 'realtime-teste', destino: { write: (linha: string) => linhas.push(linha) } }) }
}

export interface OpcoesDeConexao {
  /** Troca o `auth` do pacote de conexão (casos de recusa). */
  auth?: Record<string, unknown>
  query?: Record<string, string>
  namespace?: string
  transports?: Array<'polling' | 'websocket'>
  cabecalhos?: Record<string, string>
}

/** Cliente com as opções de reconexão de `@educa/shared`, sem conectar ainda. */
export function criarCliente(url: string, token: string | (() => string), opcoes: OpcoesDeConexao = {}): SocketCliente {
  const padrao = realtimeClientOptions(typeof token === 'string' ? () => token : token)
  return io(`${url}${opcoes.namespace ?? SYSTEM_REALTIME_NAMESPACE}`, {
    ...padrao,
    ...(opcoes.auth === undefined ? {} : { auth: opcoes.auth }),
    ...(opcoes.query === undefined ? {} : { query: opcoes.query }),
    ...(opcoes.transports === undefined ? {} : { transports: opcoes.transports }),
    ...(opcoes.cabecalhos === undefined ? {} : { extraHeaders: opcoes.cabecalhos }),
    forceNew: true,
    autoConnect: false,
  })
}

export function conectar(cliente: SocketCliente, prazoMs = 5_000): Promise<void> {
  return new Promise((resolver, rejeitar) => {
    const prazo = setTimeout(() => rejeitar(new Error('cliente não conectou no prazo')), prazoMs)
    cliente.once('connect', () => {
      clearTimeout(prazo)
      resolver()
    })
    cliente.once('connect_error', (erro) => {
      clearTimeout(prazo)
      rejeitar(erro)
    })
    cliente.connect()
  })
}

export interface Recusa {
  message: string
  data?: unknown
}

export function recusaDaConexao(cliente: SocketCliente, prazoMs = 5_000): Promise<Recusa> {
  return new Promise((resolver, rejeitar) => {
    const prazo = setTimeout(() => rejeitar(new Error('conexão nem aceita nem recusada no prazo')), prazoMs)
    cliente.once('connect', () => {
      clearTimeout(prazo)
      rejeitar(new Error('a conexão deveria ter sido recusada'))
    })
    cliente.once('connect_error', (erro: Error & { data?: unknown }) => {
      clearTimeout(prazo)
      resolver({ message: erro.message, data: erro.data })
    })
    cliente.connect()
  })
}

/**
 * Um nó socket.io fora das instâncias, ligado ao mesmo Redis de fila pelo adaptador de produção.
 * Faz o papel de quem emite (a API, no F10): o que ele emite só chega a um cliente se a instância
 * desse cliente estiver lendo o stream.
 */
export async function criarEmissor(tamanhoMaximoDoStream = 10_000): Promise<{ servidor: Server; fechar: () => Promise<void> }> {
  const cliente = criarClienteRedisDoRealtime(urlRedisDeFila(), () => undefined)
  await cliente.connect()
  // Servidor HTTP que nunca escuta: só para o `close()` do socket.io ter o que fechar.
  const servidor = prepararServidorRealtime(new Server(createServer()), cliente, tamanhoMaximoDoStream)
  // Um namespace precisa existir no nó para ele publicar no stream.
  servidor.of(SYSTEM_REALTIME_NAMESPACE)
  return {
    servidor,
    fechar: async () => {
      await servidor.close()
      await cliente.quit()
    },
  }
}

/** Coleta tudo o que chegar no evento, para provar tanto o que chegou quanto o que não chegou. */
export function coletar(cliente: SocketCliente, evento: string): unknown[] {
  const recebidos: unknown[] = []
  cliente.on(evento, (dados: unknown) => recebidos.push(dados))
  return recebidos
}
