import { ErrorCode, MENSAGENS_DE_ERRO, type ErrorResponse } from '@educa/shared'
import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { ServerResponse } from 'node:http'
import { contextoAtual } from '../contexto/contexto.js'
import type { LoggerBase } from '../log/logger.js'
import { ErroDeDominio, TENTE_DE_NOVO_PADRAO_SEGUNDOS } from './erro-de-dominio.js'
import { mapearErroPostgres } from './mapear-erro-postgres.js'
import { resumirErro } from './resumir-erro.js'

/** Exceção HTTP do próprio Nest (rota inexistente, corpo JSON inválido) vira código tipado. */
function codigoDoStatusHttp(status: number): ErrorCode {
  if (status === 401) return ErrorCode.NAO_AUTENTICADO
  // "Sem permissão" responde igual a "não encontrado": um 403 confirmaria que o objeto existe
  // (regra 10, item 6, e regra 20, item 6).
  if (status === 403 || status === 404) return ErrorCode.NAO_ENCONTRADO
  if (status === 409) return ErrorCode.CONFLITO
  if (status === 408 || status === 504) return ErrorCode.TEMPO_ESGOTADO
  if (status === 429) return ErrorCode.LIMITE_EXCEDIDO
  if (status === 503) return ErrorCode.INDISPONIVEL_TENTE_DE_NOVO
  if (status >= 400 && status < 500) return ErrorCode.ENTRADA_INVALIDA
  return ErrorCode.ERRO_INTERNO
}

/**
 * `Retry-After` de toda resposta que pede para esperar: 429 com o tempo do limite, 503 com o que
 * quem lançou informou ou o padrão. Sem ele, o cliente repete na hora e piora a manhã de segunda.
 */
function segundosDoRetryAfter(erro: ErroDeDominio): number | undefined {
  if (erro.status !== 429 && erro.status !== 503) return undefined
  return erro.tenteDeNovoEmSegundos ?? TENTE_DE_NOVO_PADRAO_SEGUNDOS
}

function traduzir(excecao: unknown): ErroDeDominio {
  if (excecao instanceof ErroDeDominio) return excecao
  const doPostgres = mapearErroPostgres(excecao)
  if (doPostgres !== undefined) return doPostgres
  if (excecao instanceof HttpException) {
    const status = excecao.getStatus()
    const codigo = codigoDoStatusHttp(status)
    return new ErroDeDominio(codigo, codigo === ErrorCode.ERRO_INTERNO ? 500 : status)
  }
  return new ErroDeDominio(ErrorCode.ERRO_INTERNO)
}

/**
 * Última barreira entre uma exceção e o cliente. A resposta é sempre o envelope tipado, com a
 * mensagem do catálogo: o texto da exceção, a pilha, a consulta e o `detail` do Postgres não
 * saem da API (regra 20, item 11). O log leva o resumo do erro, também sem mensagem.
 */
@Catch()
export class FiltroGlobalDeErro implements ExceptionFilter {
  constructor(private readonly logger: LoggerBase) {}

  catch(excecao: unknown, host: ArgumentsHost): void {
    const erro = traduzir(excecao)
    const requisicaoId = contextoAtual()?.requisicaoId ?? randomUUID()
    if (erro.status >= 500) {
      this.logger.error({ evento: 'http.erro', status: erro.status, codigo: erro.codigo, erro: resumirErro(excecao) })
    } else {
      // Erro do cliente não precisa de pilha, e numa manhã de 404 ela só engorda o log.
      const { pilha: _pilha, ...erroSemPilha } = resumirErro(excecao)
      this.logger.warn({ evento: 'http.erro', status: erro.status, codigo: erro.codigo, erro: erroSemPilha })
    }

    if (host.getType() !== 'http') return
    const resposta = host.switchToHttp().getResponse<ServerResponse>()
    if (resposta.headersSent) {
      resposta.destroy()
      return
    }
    const corpo: ErrorResponse = {
      erro: { codigo: erro.codigo, mensagem: MENSAGENS_DE_ERRO[erro.codigo], requisicaoId },
    }
    resposta.statusCode = erro.status
    resposta.setHeader('Content-Type', 'application/json; charset=utf-8')
    resposta.setHeader('Cache-Control', 'no-store')
    const retryAfter = segundosDoRetryAfter(erro)
    if (retryAfter !== undefined) resposta.setHeader('Retry-After', String(retryAfter))
    resposta.end(JSON.stringify(corpo))
  }
}
