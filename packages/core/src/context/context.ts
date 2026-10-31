import { InvariantException, type PapelDeUsuario } from '@educa/shared'
import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * O que identifica a requisição em toda linha de log e em todo erro. Só ids: nada aqui pode
 * ser nome, matrícula ou qualquer outro dado de pessoa (regra 20, item 9).
 *
 * `escolaId`, `usuarioId`, `papel`, `sessaoId` e `anoLetivoId` vêm da sessão gravada, lida com o token
 * verificado: na API pela `SessaoGuard` (identidade/sessao.guard.ts), no realtime pelo handshake, com a
 * mesma consulta. Nunca do corpo, da query ou de cabeçalho enviado pelo cliente (regra 10).
 */
export interface RequestContext {
  readonly requisicaoId: string
  readonly escolaId?: string
  readonly usuarioId?: string
  /** O papel do usuário na escola da sessão. */
  readonly papel?: PapelDeUsuario
  readonly sessaoId?: string
  /** O ano letivo `em_curso` da escola, lido junto com a sessão; `null` quando a escola não tem ano em curso. */
  readonly anoLetivoId?: string | null
  /**
   * Rotina nossa, sem escola: job `sistema.*` no worker ou no agendador. Nunca nasce de requisição
   * HTTP (o middleware não o preenche), então um contexto sem escola de uma rota anônima não
   * alcança nem os jobs de sistema.
   */
  readonly rotinaDoSistema?: true
  /**
   * O operador Turmma da sessão de operador que a `GuardaDeOperador` conferiu (Tech Spec da A0, seção 5). É a única
   * identidade da área da operação: nunca vem junto de escola, usuário, papel, sessão de escola nem ano letivo, e por
   * isso todo repository de escola chamado numa rota de operador falha com erro (`requireEscolaId`).
   */
  readonly operadorId?: string
}

type ContextoGravavel = { -readonly [Campo in keyof RequestContext]: RequestContext[Campo] }

export const REQUEST_ID_HEADER = 'x-requisicao-id'

const armazenamento = new AsyncLocalStorage<RequestContext>()

// Qualquer versão de UUID, na forma canônica. Nada além de hexadecimal e hífen chega ao log.
const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Aceita o id do cliente só se for UUID, para uma requisição poder ser seguida desde a web.
 * Qualquer outra coisa é trocada por um id novo: texto livre do cliente não entra no log.
 */
export function resolveRequestId(cabecalho: string | string[] | undefined): string {
  if (typeof cabecalho === 'string' && FORMATO_UUID.test(cabecalho)) {
    return cabecalho.toLowerCase()
  }
  return randomUUID()
}

/** Executa `funcao` com o contexto disponível em todo código assíncrono que ela disparar. */
export function runInContext<T>(contexto: RequestContext, funcao: () => T): T {
  return armazenamento.run(contexto, funcao)
}

/** O contexto da requisição em andamento, ou `undefined` fora de uma (boot, rotina interna). */
export function currentContext(): RequestContext | undefined {
  return armazenamento.getStore()
}

/**
 * Middleware HTTP que abre o contexto antes de qualquer outro código da requisição. Precisa
 * ser o primeiro registrado, para o log e o filtro de erro sempre encontrarem o `requisicaoId`.
 */
export function contextMiddleware(requisicao: IncomingMessage, _resposta: ServerResponse, proximo: () => void): void {
  const contexto: RequestContext = {
    requisicaoId: resolveRequestId(requisicao.headers[REQUEST_ID_HEADER]),
  }
  runInContext(contexto, proximo)
}

function contextoAindaSemIdentidade(): ContextoGravavel {
  const contexto = armazenamento.getStore() as ContextoGravavel | undefined
  if (contexto === undefined) throw new InvariantException('contexto da requisição ausente')
  if (contexto.escolaId !== undefined || contexto.usuarioId !== undefined || contexto.sessaoId !== undefined || contexto.operadorId !== undefined) {
    throw new InvariantException('identidade do contexto já definida')
  }
  return contexto
}

/** A sessão válida que a `SessaoGuard` leu do banco. */
export interface RequestSessao {
  readonly escolaId: string
  readonly usuarioId: string
  readonly papel: PapelDeUsuario
  readonly sessaoId: string
  readonly anoLetivoId: string | null
}

/**
 * Grava a sessão lida do banco no contexto da requisição em andamento: escola, usuário, papel, sessão e ano letivo
 * em curso. É o único jeito de escrevê-los depois que o contexto existe, e só vale uma vez: nenhum código que rode
 * depois da guarda consegue trocar o escopo. Sem contexto, ou com identidade já gravada, falha fechada.
 */
export function setContextSessao(sessao: RequestSessao): void {
  const contexto = contextoAindaSemIdentidade()
  contexto.escolaId = sessao.escolaId
  contexto.usuarioId = sessao.usuarioId
  contexto.papel = sessao.papel
  contexto.sessaoId = sessao.sessaoId
  contexto.anoLetivoId = sessao.anoLetivoId
}


/**
 * Grava no contexto o operador da sessão de operador que a `GuardaDeOperador` conferiu, e só ele: sem escola, usuário,
 * papel, sessão nem ano letivo. Vale uma vez, como a sessão de escola, e nunca depois dela: sem contexto, ou com
 * qualquer identidade já gravada, falha fechada.
 */
export function setContextOperador(operadorId: string): void {
  const contexto = contextoAindaSemIdentidade()
  contexto.operadorId = operadorId
}

/**
 * O operador da requisição em andamento, gravado pela `GuardaDeOperador`. Sem ele, falha fechada: é erro de programação
 * (rota da operação sem a guarda), e nunca vira consulta sem operador.
 */
export function requireContextOperador(): string {
  const operadorId = currentContext()?.operadorId
  if (operadorId === undefined) throw new InvariantException('rota da operação sem operador no contexto')
  return operadorId
}
