import {
  avaliarSessao,
  throttledWarn,
  setContextSessao,
  DomainException,
  runInContext,
  summarizeError,
  verifyToken,
  type AuthConfig,
  type Identity,
  type SessaoReader,
  type SessaoRow,
  type LoggerBase,
} from '@educa/core'
import { ErrorCode, MENSAGENS_DE_ERRO } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import type { Socket } from 'socket.io'
import { z } from 'zod'

/** O que o servidor guarda no socket. Só a identidade verificada, só ids (regra 20). */
export interface DadosDoSocket {
  identidade?: Identity
}

export type SocketRealtime = Socket<Record<string, never>, Record<string, never>, Record<string, never>, DadosDoSocket>

export interface ErroDeConexao extends Error {
  data: { codigo: ErrorCode; mensagem: string }
}

type CodigoDeRecusaDeConexao = typeof ErrorCode.NAO_AUTENTICADO | typeof ErrorCode.INDISPONIVEL_TENTE_DE_NOVO

function erroDeConexao(codigo: CodigoDeRecusaDeConexao): ErroDeConexao {
  const erro = new Error(codigo) as ErroDeConexao
  erro.data = { codigo, mensagem: MENSAGENS_DE_ERRO[codigo] }
  return erro
}

/**
 * Recusa de conexão como o cliente socket.io a recebe (`connect_error`): código tipado e a
 * mensagem do catálogo, sem dizer se o token faltou, venceu, tinha assinatura errada ou não tinha
 * sessão gravada.
 */
export function erroDeConexaoNaoAutenticada(): ErroDeConexao {
  return erroDeConexao(ErrorCode.NAO_AUTENTICADO)
}

/**
 * Recusa por indisponibilidade do Postgres. É outro código de propósito: a queda do banco não pode
 * virar "não autenticado", que na web deslogaria a escola inteira no meio da aula. O cliente
 * reconecta com o recuo espalhado de `REALTIME_RECONNECTION` e volta com o mesmo token.
 */
export function erroDeConexaoIndisponivel(): ErroDeConexao {
  return erroDeConexao(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
}

// Três partes base64url, com teto de tamanho: nada além disso é lido do pacote de conexão.
const esquemaAutenticacao = z.object({
  token: z
    .string()
    .max(4_096)
    .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/),
})

/**
 * Middleware do namespace: verifica o JWT do pacote de conexão (`auth.token`) com a mesma
 * verificação da API, lê a sessão gravada com a mesma consulta da `SessaoGuard` e só então grava
 * a identidade no contexto e no socket. O token só é lido do `auth`: query da URL e cabeçalho não
 * autenticam, porque URL vai parar em log e histórico.
 *
 * A leitura é a do `SessaoRepository`, escopada por `(esc, sid)` do token verificado, e não move
 * `ultimo_uso_em`: conectar ao realtime não é atividade da pessoa (Tech Spec, seção 5, "Atividade").
 * Sessão encerrada, expirada, de usuário desativado ou vencida por inatividade recusa o handshake
 * seguinte, como na API.
 *
 * Nada que o cliente manda além do token entra na identidade. A sala da escola sai daqui.
 */
export function autenticacaoDoHandshake(config: AuthConfig, leitura: SessaoReader, logger: LoggerBase) {
  // Com o Postgres fora, a escola inteira reconecta ao mesmo tempo e todo handshake falharia aqui: uma linha a
  // cada 30 s diz o mesmo que mil (regra 80). O erro que vale, o resumo, sai nessa linha.
  let ultimoErro: unknown
  const avisarIndisponivel = throttledWarn(() => {
    logger.warn({ evento: 'realtime.sessao_indisponivel', erro: summarizeError(ultimoErro) })
    ultimoErro = undefined
  })
  return (socket: SocketRealtime, proximo: (erro?: Error) => void): void => {
    void runInContext({ requisicaoId: randomUUID() }, async () => {
      const autenticacao = esquemaAutenticacao.safeParse(socket.handshake.auth)
      try {
        if (!autenticacao.success) throw new DomainException(ErrorCode.NAO_AUTENTICADO)
        const token = await verifyToken(autenticacao.data.token, config)
        let linha: SessaoRow | undefined
        try {
          linha = await leitura.lerParaGuarda(token)
        } catch (erro) {
          // Erro do Postgres: `INDISPONIVEL_TENTE_DE_NOVO`, nunca `NAO_AUTENTICADO`. O resumo do erro
          // fica no log sem a consulta nem a mensagem crua (regra 20, item 9).
          ultimoErro = erro
          avisarIndisponivel()
          socket.handshake.auth = {}
          proximo(erroDeConexaoIndisponivel())
          return
        }
        const sessao = avaliarSessao(token, linha)
        if (sessao === undefined) throw new DomainException(ErrorCode.NAO_AUTENTICADO)
        setContextSessao(sessao)
        // Só escola e usuário no socket: a sala sai da escola da sessão, nunca de nada que o cliente mande.
        const identidade: Identity = { escolaId: sessao.escolaId, usuarioId: sessao.usuarioId }
        socket.data.identidade = identidade
        // Verificado, o token não fica na conexão: o handshake é copiado para outras instâncias pelo
        // Redis (fetchSockets), e a query é texto livre do cliente.
        socket.handshake.auth = {}
        socket.handshake.query = {}
      } catch (erro) {
        if (erro instanceof DomainException) {
          logger.info({ evento: 'realtime.conexao_recusada', codigo: erro.codigo })
        } else {
          logger.error({ evento: 'realtime.conexao_falhou', erro })
        }
        socket.handshake.auth = {}
        proximo(erroDeConexaoNaoAutenticada())
        return
      }
      logger.info({ evento: 'realtime.conexao_aceita' })
      proximo()
    })
  }
}
