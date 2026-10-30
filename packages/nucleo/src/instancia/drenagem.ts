import type { ReadinessResponse } from '@educa/shared'
import { Logger, type BeforeApplicationShutdown, type OnApplicationShutdown } from '@nestjs/common'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import type { Socket } from 'node:net'
import { z } from 'zod'
import { validateEnvironment } from '../config/validar-config.js'

export interface GracefulShutdownConfig {
  /**
   * Quanto a instância segue atendendo depois de pôr `/prontidao` em 503, antes de fechar o
   * servidor. Precisa passar do intervalo da sonda da borda (2 s no Caddy), senão a borda ainda
   * manda requisição nova para um servidor que já fechou.
   */
  readonly esperaDaBordaMs: number
  /** Prazo total do SIGTERM até a saída. Estourou, a instância sai mesmo com requisição em andamento. */
  readonly prazoMs: number
}

const inteiroPositivo = z.coerce.number().int().positive()

const drainEnvSchema = z
  .object({
    DRENAGEM_ESPERA_BORDA_MS: inteiroPositivo,
    DRENAGEM_PRAZO_MS: inteiroPositivo,
  })
  .superRefine((valores, contexto) => {
    if (valores.DRENAGEM_ESPERA_BORDA_MS >= valores.DRENAGEM_PRAZO_MS) {
      contexto.addIssue({
        code: 'custom',
        path: ['DRENAGEM_ESPERA_BORDA_MS'],
        message: 'DRENAGEM_ESPERA_BORDA_MS precisa ser menor que DRENAGEM_PRAZO_MS: sem sobra, nenhuma requisição termina',
      })
    }
  })

export function loadGracefulShutdownConfig(ambiente: Record<string, string | undefined>): GracefulShutdownConfig {
  const valores = validateEnvironment(drainEnvSchema, ambiente)
  return { esperaDaBordaMs: valores.DRENAGEM_ESPERA_BORDA_MS, prazoMs: valores.DRENAGEM_PRAZO_MS }
}

/** Resposta de `/prontidao`, sem consultar dependência: é só o estado da própria instância. */
export interface ReadinessResult {
  readonly status: 200 | 503
  readonly corpo: ReadinessResponse
}

/**
 * Tempo que a conexão ociosa com a borda fica aberta. Maior que o `keepalive` do transporte do
 * Caddy (30 s em `infra/Caddyfile`): quem fecha a conexão ociosa é sempre a borda. Se fosse o
 * Node, uma requisição enviada pela borda no mesmo instante encontraria o socket fechado, e um
 * POST viraria 502 sem a instância ter caído.
 */
export const OCIOSIDADE_HTTP_MS = 65_000

/** Durante o fechamento, de quanto em quanto tempo a conexão que acabou de ficar ociosa é fechada. */
const INTERVALO_FECHAR_OCIOSAS_MS = 200

/**
 * Troca de instância sem derrubar requisição. No SIGTERM (`enableShutdownHooks`), o Nest chama
 * `beforeApplicationShutdown` antes de fechar o servidor HTTP e o socket.io:
 *
 * 1. `/prontidao` passa a 503, e a borda tira a instância do balanceamento na sonda seguinte;
 * 2. a instância segue atendendo por `esperaDaBordaMs`, porque requisição nova ainda pode chegar
 *    até a borda perceber;
 * 3. o Nest fecha o servidor, que espera as requisições em andamento terminarem, e depois chama
 *    `onApplicationShutdown` (onde o pool do banco fecha);
 * 4. se tudo isso passar de `prazoMs`, a instância sai assim mesmo, com código 1.
 *
 * Recurso que uma requisição em andamento usa fecha em `onApplicationShutdown`, nunca em
 * `onModuleDestroy`: o Nest chama `onModuleDestroy` antes deste gancho, com tráfego ainda chegando.
 *
 * Registre no módulo raiz: o Nest chama `onApplicationShutdown` do módulo raiz por último, e é
 * ali que o prazo é desarmado, depois de todo recurso fechado.
 *
 * Não guarda nada que outra instância precise: o estado é só "esta instância está saindo".
 */
export class GracefulShutdown implements BeforeApplicationShutdown, OnApplicationShutdown {
  readonly #logger = new Logger('instancia')
  #drenando = false
  #prazo: NodeJS.Timeout | undefined
  #servidor: Server | undefined
  #fechaOciosas: NodeJS.Timeout | undefined
  /** Toda conexão aberta, para achar a que nunca mandou um byte (ver `fecharOciosas`). */
  readonly #conexoes = new Set<Socket>()
  #semBytesNaPassadaAnterior = new Set<Socket>()

  constructor(
    private readonly config: GracefulShutdownConfig,
    private readonly encerrarProcesso: (codigo: number) => void = (codigo) => process.exit(codigo),
  ) {}

  /**
   * Prepara o servidor HTTP da instância para ficar atrás da borda e para fechar dentro do prazo:
   * - ociosidade maior que a da borda (`OCIOSIDADE_HTTP_MS`);
   * - drenando, toda resposta sai com `Connection: close`;
   * - fechando, a conexão que termina a resposta é fechada em seguida. O `server.close()` do Node
   *   só fecha a conexão que já está ociosa na hora; a que ainda respondia (sonda da borda,
   *   long-polling do socket.io) ficaria aberta pela ociosidade inteira e seguraria a saída.
   */
  prepararServidor(servidor: Server): void {
    servidor.on('connection', (conexao: Socket) => {
      this.#conexoes.add(conexao)
      conexao.once('close', () => this.#conexoes.delete(conexao))
    })
    servidor.keepAliveTimeout = OCIOSIDADE_HTTP_MS
    // O Node exige `headersTimeout` acima do `keepAliveTimeout`.
    servidor.headersTimeout = OCIOSIDADE_HTTP_MS + 1_000
    // Antes do Express (e antes da cópia de ouvintes que o engine.io faz ao se ligar ao servidor):
    // registrado depois, o cabeçalho de uma resposta que o Express envia na hora (404 de GET sem
    // corpo) já teria saído, e `setHeader` lançaria erro fora de requisição, derrubando o processo.
    servidor.prependListener('request', (_pedido: IncomingMessage, resposta: ServerResponse) => {
      if (this.#drenando && !resposta.headersSent) resposta.setHeader('Connection', 'close')
    })
    this.#servidor = servidor
  }

  get drenando(): boolean {
    return this.#drenando
  }

  prontidao(): ReadinessResult {
    return this.#drenando ? { status: 503, corpo: { pronta: false } } : { status: 200, corpo: { pronta: true } }
  }

  async beforeApplicationShutdown(): Promise<void> {
    if (this.#drenando) return
    this.#drenando = true
    this.#logger.log('instancia.drenagem_iniciada')
    this.#prazo = setTimeout(() => {
      this.#logger.warn('instancia.drenagem_prazo_estourado')
      this.encerrarProcesso(1)
    }, this.config.prazoMs)
    // O prazo não segura o processo vivo: saindo antes, ninguém espera por ele.
    this.#prazo.unref()
    await new Promise((resolver) => setTimeout(resolver, this.config.esperaDaBordaMs))
    const servidor = this.#servidor
    if (servidor !== undefined) {
      this.#fechaOciosas = setInterval(() => this.fecharOciosas(servidor), INTERVALO_FECHAR_OCIOSAS_MS)
      this.#fechaOciosas.unref()
    }
  }

  /**
   * Fecha o que não tem requisição em andamento. O `closeIdleConnections()` do Node não conta como
   * ociosa a conexão que nunca recebeu um byte: ele a trata como requisição começando, e quem a
   * fecharia é o `headersTimeout`, cuja verificação o próprio `server.close()` desliga. A borda
   * deixa conexões assim no pool (o Go disca uma conexão nova, e o pedido acaba indo por outra que
   * vagou), e cada uma segurava a saída até a sonda seguinte usá-la, a cada 2 s: com algumas delas,
   * a drenagem passava do prazo e a instância saía com código 1.
   *
   * Só fecha a que segue sem nenhum byte em duas passagens seguidas: a primeira requisição de uma
   * conexão recém-aberta pode estar a caminho, e depois da espera da borda ela já teria chegado.
   */
  private fecharOciosas(servidor: Server): void {
    servidor.closeIdleConnections()
    const semBytes = new Set<Socket>()
    for (const conexao of this.#conexoes) {
      if (conexao.bytesRead !== 0) continue
      if (this.#semBytesNaPassadaAnterior.has(conexao)) conexao.destroy()
      else semBytes.add(conexao)
    }
    this.#semBytesNaPassadaAnterior = semBytes
  }

  onApplicationShutdown(): void {
    clearTimeout(this.#prazo)
    clearInterval(this.#fechaOciosas)
    this.#prazo = undefined
    this.#fechaOciosas = undefined
  }
}
