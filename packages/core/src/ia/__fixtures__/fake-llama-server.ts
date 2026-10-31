import { once } from 'node:events'
import { createServer, type IncomingHttpHeaders } from 'node:http'
import type { AddressInfo } from 'node:net'

export interface ReceivedRequest {
  readonly caminho: string
  readonly cabecalhos: IncomingHttpHeaders
  readonly corpo: {
    model?: string
    messages?: { role: string; content: string }[]
    stream?: boolean
    max_tokens?: number
    response_format?: { type?: string }
    chat_template_kwargs?: { enable_thinking?: boolean }
  }
}

export interface ScriptedResponse {
  readonly status?: number
  /** Corpo em JSON. Sem ele, vai `textoCru`. */
  readonly corpo?: unknown
  readonly textoCru?: string
  readonly cabecalhos?: Record<string, string>
  /** Quanto o servidor demora antes de responder. */
  readonly atrasoMs?: number
}

export interface FakeLlamaServer {
  /** A raiz que vai em `LLM_BASE_URL`, com o `/v1`. */
  readonly url: string
  readonly pedidos: ReceivedRequest[]
  fechar(): Promise<void>
}

/** A resposta de `chat/completions` como o `llama-server` devolve. */
export function chatResponse(conteudo: string | null, extras: { raciocinio?: string; uso?: { prompt_tokens: number; completion_tokens: number }; modelo?: string } = {}): unknown {
  return {
    id: 'chatcmpl-sintetico',
    object: 'chat.completion',
    model: extras.modelo ?? 'qwen-sintetico',
    choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: conteudo, ...(extras.raciocinio === undefined ? {} : { reasoning_content: extras.raciocinio }) } }],
    ...(extras.uso === undefined ? {} : { usage: { ...extras.uso, total_tokens: extras.uso.prompt_tokens + extras.uso.completion_tokens } }),
  }
}

/**
 * Um `llama-server` de mentira, em `node:http`, numa porta livre de 127.0.0.1. O roteiro decide a resposta de cada
 * pedido, pela ordem de chegada. Nenhum teste fala com o servidor de verdade nem com provedor pago (regra 30, item 3).
 */
export async function startFakeLlamaServer(roteiro: (pedido: ReceivedRequest, numero: number) => ScriptedResponse): Promise<FakeLlamaServer> {
  const pedidos: ReceivedRequest[] = []
  const esperas = new Set<NodeJS.Timeout>()
  const servidor = createServer((requisicao, resposta) => {
    const partes: Buffer[] = []
    requisicao.on('data', (parte: Buffer) => partes.push(parte))
    requisicao.on('end', () => {
      const pedido: ReceivedRequest = {
        caminho: requisicao.url ?? '',
        cabecalhos: requisicao.headers,
        corpo: JSON.parse(Buffer.concat(partes).toString('utf8')) as ReceivedRequest['corpo'],
      }
      pedidos.push(pedido)
      const roteirizada = roteiro(pedido, pedidos.length)
      const responder = (): void => {
        resposta.writeHead(roteirizada.status ?? 200, { 'content-type': 'application/json', ...roteirizada.cabecalhos })
        resposta.end(roteirizada.corpo === undefined ? (roteirizada.textoCru ?? '') : JSON.stringify(roteirizada.corpo))
      }
      if (roteirizada.atrasoMs === undefined) return responder()
      const espera = setTimeout(() => {
        esperas.delete(espera)
        responder()
      }, roteirizada.atrasoMs)
      esperas.add(espera)
    })
  })
  servidor.listen(0, '127.0.0.1')
  await once(servidor, 'listening')
  const { port } = servidor.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}/v1`,
    pedidos,
    async fechar() {
      for (const espera of esperas) clearTimeout(espera)
      servidor.closeAllConnections()
      servidor.close()
      await once(servidor, 'close')
    },
  }
}
