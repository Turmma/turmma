import { REALTIME_PATH, InvariantException } from '@educa/shared'
import type { INestApplicationContext } from '@nestjs/common'
import { IoAdapter } from '@nestjs/platform-socket.io'
import { createAdapter } from '@socket.io/redis-streams-adapter'
import { Redis } from 'ioredis'
import type { Server as ServidorHttp } from 'node:http'
import { Server, type ServerOptions } from 'socket.io'
import { erroDeConexaoNaoAutenticada } from './handshake-auth.js'

/** Nome do stream e prefixo dos canais do adaptador no Redis de fila. */
export const PREFIXO_REDIS_REALTIME = 'realtime'

/**
 * Cliente do Redis de fila para o adaptador. O adaptador duplica este cliente para ler o stream
 * com `XREAD BLOCK` e para assinar os canais, então:
 *
 * - sem `commandTimeout`: um timeout curto cortaria o `XREAD` bloqueante no meio;
 * - com fila offline (o padrão do ioredis): com o Redis fora, o laço de leitura do adaptador espera
 *   a reconexão, em vez de girar em falso consumindo CPU;
 * - `lazyConnect`: o boot espera a conexão, e o adaptador também espera a das cópias.
 */
export function criarClienteRedisDoRealtime(url: string, aoErrar: (erro: Error) => void): Redis {
  const cliente = new Redis(url, { lazyConnect: true, connectionName: PREFIXO_REDIS_REALTIME })
  // Sem ouvinte, o ioredis escreve o erro no console, fora do log JSON.
  cliente.on('error', aoErrar)
  return cliente
}

/**
 * Adaptador socket.io sobre Redis Streams. A emissão de uma instância chega aos clientes de todas
 * as outras; nenhuma sala fica só na memória de uma instância (regra 80, item 5). O stream tem
 * teto de tamanho, porque o Redis de fila não expulsa chave.
 */
export function criarAdaptadorRedis(cliente: Redis, tamanhoMaximoDoStream: number): ReturnType<typeof createAdapter> {
  return createAdapter(cliente, {
    streamName: PREFIXO_REDIS_REALTIME,
    channelPrefix: PREFIXO_REDIS_REALTIME,
    maxLen: tamanhoMaximoDoStream,
  })
}

/**
 * Opções do servidor socket.io de toda instância:
 * - sem servir o cliente JS e sem CORS: a web chega pela mesma origem, pela borda;
 * - pacote de até 64 KB: o cliente do F0 não manda nada além da conexão;
 * - 10 s para o cliente entrar no namespace depois do handshake do engine.io, para conexão que
 *   nunca se autentica não ficar ocupando a instância.
 */
export const OPCOES_DO_SERVIDOR_REALTIME = {
  path: REALTIME_PATH,
  serveClient: false,
  maxHttpBufferSize: 64 * 1024,
  connectTimeout: 10_000,
} as const satisfies Partial<ServerOptions>

/** Monta o servidor socket.io com o adaptador Redis, e fecha o namespace padrão `/`. */
export function prepararServidorRealtime(servidor: Server, cliente: Redis, tamanhoMaximoDoStream: number): Server {
  servidor.adapter(criarAdaptadorRedis(cliente, tamanhoMaximoDoStream))
  // O namespace `/` existe em todo servidor socket.io e não tem autenticação. Ninguém entra nele.
  servidor.of('/').use((_socket, proximo) => proximo(erroDeConexaoNaoAutenticada()))
  return servidor
}

/** Adaptador Nest: todo gateway da aplicação usa o mesmo servidor, já com Redis e opções fixas. */
export class AdaptadorSocketIoComRedis extends IoAdapter {
  #servidor: Server | undefined

  constructor(
    app: INestApplicationContext,
    private readonly cliente: Redis,
    private readonly tamanhoMaximoDoStream: number,
  ) {
    super(app)
  }

  /**
   * As opções vêm só de `OPCOES_DO_SERVIDOR_REALTIME`: nenhum gateway escolhe CORS, caminho ou
   * tamanho de pacote por conta própria. O servidor fica no mesmo HTTP da aplicação, que tem a
   * `/prontidao` e passa pela drenagem.
   */
  override createIOServer(porta: number): Server {
    if (porta !== 0) throw new InvariantException('gateway do realtime não abre porta própria: use a porta HTTP da aplicação')
    const servidorHttp: ServidorHttp = this.httpServer
    this.#servidor = prepararServidorRealtime(new Server(servidorHttp, OPCOES_DO_SERVIDOR_REALTIME), this.cliente, this.tamanhoMaximoDoStream)
    return this.#servidor
  }

  /** Conexões do engine.io abertas nesta instância, autenticadas ou ainda no handshake (métrica `realtime.conexoes`). */
  conexoesAbertas(): number {
    return this.#servidor?.engine.clientsCount ?? 0
  }
}
