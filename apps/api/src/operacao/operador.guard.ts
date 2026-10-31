import {
  throttledWarn,
  setContextOperador,
  DomainException,
  extractBearerToken,
  DEFAULT_RETRY_AFTER_SECONDS,
  verifyOperadorToken,
  type Database,
  type AuthConfig,
  type VerifiedOperadorToken,
} from '@educa/core'
import { ErrorCode } from '@educa/shared'
import { Inject, Injectable, Logger, type CanActivate, type ExecutionContext, type Provider } from '@nestjs/common'
import type { IncomingMessage } from 'node:http'
import { DB } from '../database.module.js'
import { OperadorRepository } from './operador/operador.repository.js'
import { sessaoDeOperadorVale, type SessaoDeOperadorForGuard } from './sessao/sessao-timeouts.js'

/** A configuração de identidade (a chave do HS256) que a `OperadorGuard` usa para verificar o token de operador. */
export const OPERACAO_IDENTITY = Symbol('OPERACAO_IDENTITY')
/** A leitura e a marcação da sessão de operador que a guarda faz: o `OperadorRepository`; o teste conta as chamadas. */
export const OPERADOR_SESSIONS = Symbol('OPERADOR_SESSIONS')

export type OperadorSessionReader = Pick<OperadorRepository, 'lerSessaoParaGuarda' | 'marcarUsoDaSessao'>

/**
 * Os provedores que a `OperadorGuard` pede. O `OperacaoModule` os registra; um módulo de teste com rota
 * `@OperacaoRoute` registra os mesmos, e a guarda que roda nele é a de produção.
 */
export function operadorGuardProviders(identidade: AuthConfig): Provider[] {
  return [
    { provide: OPERACAO_IDENTITY, useValue: identidade },
    { provide: OPERADOR_SESSIONS, useFactory: (banco: Database) => new OperadorRepository(banco), inject: [DB] },
  ]
}

const naoEncontrado = () => new DomainException(ErrorCode.NAO_ENCONTRADO)

/**
 * A guarda de toda rota `@OperacaoRoute()` (Tech Spec da A0, seção 5, "Conferência da sessão"). Roda depois das quatro
 * guardas globais, que tratam a rota como sem sessão de escola; o limite `rl:op` já contou a requisição.
 *
 * - Credencial que não é de operador — nenhuma, sessão de escola, desafio de login, token forjado ou de outro `typ` —
 *   responde **404 `NAO_ENCONTRADO`**, pelo mesmo filtro de uma rota inexistente, sem tocar o banco (C46).
 * - Sessão que terminou (30 min sem uso, 8 h, saída, operador desativado, ou que não existe mais): **401
 *   `SESSAO_ENCERRADA`**, conferido antes do prazo do token, para a web não renovar o que não renova.
 * - Sessão viva com o acesso de 10 min vencido: **401 `ACESSO_VENCIDO`**, e a web renova.
 * - Postgres com erro ou fora do prazo: **503 `INDISPONIVEL_TENTE_DE_NOVO`**, nunca 401 nem 404: a queda do banco não
 *   desloga o operador.
 *
 * Com a sessão viva, grava o uso (no máximo uma vez por minuto, pela condição do `update`) e põe no contexto **só o
 * `operadorId`**: nenhum repository de escola acha escola ali, e o que for chamado por engano falha com erro (C49).
 */
@Injectable()
export class OperadorGuard implements CanActivate {
  readonly #logger = new Logger('operacao')
  // Com o Postgres fora, toda requisição falharia aqui: uma linha a cada 30 s basta, e o 503 de cada uma já vai para o
  // log pelo filtro de erro.
  readonly #avisarIndisponivel = throttledWarn(() => this.#logger.warn('operacao.sessao_indisponivel'))

  constructor(
    @Inject(OPERACAO_IDENTITY) private readonly identidade: AuthConfig,
    @Inject(OPERADOR_SESSIONS) private readonly sessoes: OperadorSessionReader,
  ) {}

  async canActivate(execucao: ExecutionContext): Promise<boolean> {
    if (execucao.getType() !== 'http') throw naoEncontrado()
    const requisicao = execucao.switchToHttp().getRequest<IncomingMessage>()
    const token = await this.#tokenDeOperador(requisicao)

    let linha: SessaoDeOperadorForGuard | undefined
    try {
      linha = await this.sessoes.lerSessaoParaGuarda(token.sessaoId, token.operadorId)
      if (sessaoDeOperadorVale(linha) && !token.vencido) await this.sessoes.marcarUsoDaSessao(token.sessaoId, token.operadorId)
    } catch {
      // Nada do erro vai ao log: nem a consulta nem a mensagem (regra 20, item 9).
      this.#avisarIndisponivel()
      throw new DomainException(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, undefined, DEFAULT_RETRY_AFTER_SECONDS)
    }
    if (!sessaoDeOperadorVale(linha)) throw new DomainException(ErrorCode.SESSAO_ENCERRADA)
    if (token.vencido) throw new DomainException(ErrorCode.ACESSO_VENCIDO)
    setContextOperador(token.operadorId)
    return true
  }

  /** O token de operador do `Authorization`, verificado. Qualquer recusa vira o 404 de uma rota inexistente. */
  async #tokenDeOperador(requisicao: IncomingMessage): Promise<VerifiedOperadorToken> {
    try {
      return await verifyOperadorToken(extractBearerToken(requisicao.headers.authorization), this.identidade)
    } catch (erro) {
      if (erro instanceof DomainException) throw naoEncontrado()
      throw erro
    }
  }
}
