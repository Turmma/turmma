import { DomainException } from '@educa/core'
import { ErrorCode } from '@educa/shared'
import type { IncomingMessage } from 'node:http'
import { describe, expect, it } from 'vitest'
import { LIMITE_DO_CORPO_FORA_DA_PLANILHA_BYTES, limitarCorpoForaDaPlanilha } from './configure-app.js'

/**
 * O teto de corpo das rotas que não são da planilha (F2, tarefa 5.0; regra 80, item 3): o middleware lê só o caminho e o
 * `Content-Length`. O caso pela API inteira, com a planilha de 300 KB lida e o corpo grande de outra rota recusado, está em
 * `apps/api/test/importacao.int.test.ts`.
 */

const requisicao = (url: string | undefined, contentLength?: number, contentType = 'application/json'): IncomingMessage =>
  ({ url, headers: contentLength === undefined ? { 'content-type': contentType } : { 'content-type': contentType, 'content-length': String(contentLength) } }) as unknown as IncomingMessage

/** Roda o middleware e devolve se ele seguiu (`true`) ou lançou `ENTRADA_INVALIDA` (`false`). */
function seguiu(url: string | undefined, contentLength?: number, contentType?: string): boolean {
  let seguiu = false
  try {
    limitarCorpoForaDaPlanilha(requisicao(url, contentLength, contentType), undefined, () => {
      seguiu = true
    })
  } catch (erro) {
    expect(erro).toBeInstanceOf(DomainException)
    expect((erro as DomainException).codigo).toBe(ErrorCode.ENTRADA_INVALIDA)
  }
  return seguiu
}

const GRANDE = 300 * 1024

describe('limitarCorpoForaDaPlanilha (F2, tarefa 5.0)', () => {
  it('as rotas da planilha seguem com o corpo grande: o prefixo exato, o que vem depois de `/` e o que vem depois de `?`', () => {
    for (const url of ['/v1/importacoes', '/v1/importacoes/calendario/previa', '/v1/importacoes/calendario', '/v1/importacoes?x=1']) expect(seguiu(url, GRANDE), url).toBe(true)
  })

  it('qualquer outra rota recusa o corpo declarado acima de 100 KB, mesmo as que só começam com o prefixo', () => {
    for (const url of ['/v1/series', '/v1/importacoesx', '/v1/importacoes-antigas/previa', '/V1/IMPORTACOES/calendario', '/']) expect(seguiu(url, LIMITE_DO_CORPO_FORA_DA_PLANILHA_BYTES + 1), url).toBe(false)
  })

  it('100 KB exatos seguem, e sem `Content-Length` (corpo em pedaços) o middleware não recusa: quem segura é o leitor de 1 MB', () => {
    expect(seguiu('/v1/series', LIMITE_DO_CORPO_FORA_DA_PLANILHA_BYTES)).toBe(true)
    expect(seguiu('/v1/series')).toBe(true)
  })

  it('o corpo que não é JSON segue com o tamanho que for: o multipart do material (até 20 MB) não é recusado por este teto', () => {
    const VINTE_MB = 20 * 1024 * 1024
    expect(seguiu('/v1/materiais', VINTE_MB, 'multipart/form-data; boundary=----educa')).toBe(true)
    expect(seguiu('/v1/materiais', VINTE_MB, 'application/pdf')).toBe(true)
    // O JSON com parâmetro e com outra caixa continua sendo JSON.
    expect(seguiu('/v1/series', GRANDE, 'Application/JSON; charset=utf-8')).toBe(false)
  })

  it('requisição sem caminho é tratada como outra rota', () => {
    expect(seguiu(undefined, GRANDE)).toBe(false)
    expect(seguiu(undefined, 10)).toBe(true)
  })
})
