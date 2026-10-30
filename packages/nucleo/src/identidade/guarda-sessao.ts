import { ErrorCode } from '@educa/shared'
import { Logger, type CanActivate, type ExecutionContext } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import type { Histogram, Meter } from '@opentelemetry/api'
import { setContextSessao } from '../contexto/contexto.js'
import { DomainException, DEFAULT_RETRY_AFTER_SECONDS } from '../erro/erro-de-dominio.js'
import { throttledWarn } from '../log/aviso-espacado.js'
import { LIMITES_DO_HISTOGRAMA_HTTP_S, METRICS } from '../telemetria/metricas.js'
import { avaliarSessao, tokenDaUltimaRenovacao } from './avaliar-sessao.js'
import { isRouteWithoutSessao } from './rota-sem-sessao.js'
import type { SessaoRow } from './sessao.repository.js'
import { requestToken } from './token-da-requisicao.js'
import type { VerifiedToken } from './verificar-token.js'

/** A leitura que a guarda faz, e a marcação do token renovado. É o `SessaoRepository`; o teste conta as chamadas. */
export interface SessaoReader {
  lerParaGuarda(token: VerifiedToken): Promise<SessaoRow | undefined>
  marcarAtualApresentado(token: VerifiedToken): Promise<boolean>
}

/**
 * Terceira guarda global da API, depois da autenticação e do limite (Tech Spec, seção 1): o token já foi verificado
 * e a requisição já foi contada no limite do usuário e da escola, então JWT inválido e rajada acima do limite nunca
 * chegam ao Postgres (regra 80, item 1).
 *
 * Lê a sessão do token numa consulta, sem cache, e só com ela válida grava no contexto a escola, o usuário, o papel,
 * a sessão e o ano letivo em curso. Encerrar a sessão ou desativar o usuário corta o acesso na requisição seguinte
 * (RF5).
 *
 * Com o Postgres com erro ou fora do prazo, responde 503 `INDISPONIVEL_TENTE_DE_NOVO` com `Retry-After`, nunca 401:
 * a queda do banco não desloga a escola inteira, e a web tenta de novo com o token e o formulário que já tem.
 *
 * Mede a leitura em `sessao.leitura.duracao` (regra 80, item 10), com ou sem erro. Quando a requisição traz o token
 * que a última renovação emitiu, marca a sessão como apresentada sem segurar a resposta (Tech Spec, seção 5,
 * "Renovar"): a marcação que falhar é refeita pela requisição seguinte com o mesmo token.
 */
export class SessaoGuard implements CanActivate {
  readonly #logger = new Logger('sessao')
  #avisoLiberado = false
  // Com o Postgres fora, toda requisição falharia aqui: uma linha a cada 30 s diz o mesmo, e o 503 de cada uma já
  // vai para o log pelo filtro de erro.
  readonly #liberarAviso = throttledWarn(() => {
    this.#avisoLiberado = true
  })

  readonly #duracaoDaLeitura: Histogram | undefined
  // A marcação que falha não derruba nada: uma linha a cada 30 s, sem o erro inteiro.
  readonly #avisarMarcacao = throttledWarn(() => this.#logger.warn('sessao.marcacao_indisponivel'))

  constructor(
    private readonly reflector: Reflector,
    private readonly leitura: SessaoReader,
    medidor?: Meter,
  ) {
    this.#duracaoDaLeitura = medidor?.createHistogram(METRICS.leituraDeSessao, {
      unit: 's',
      description: 'Duração da leitura de sessão da guarda, por requisição autenticada',
      advice: { explicitBucketBoundaries: LIMITES_DO_HISTOGRAMA_HTTP_S },
    })
  }

  async canActivate(execucao: ExecutionContext): Promise<boolean> {
    if (isRouteWithoutSessao(this.reflector, execucao)) return true
    if (execucao.getType() !== 'http') throw new DomainException(ErrorCode.NAO_AUTENTICADO)

    // Sem token verificado nesta requisição (guarda fora de ordem), falha fechada.
    const token = requestToken(execucao.switchToHttp().getRequest<object>())
    if (token === undefined) throw new DomainException(ErrorCode.NAO_AUTENTICADO)

    let linha: SessaoRow | undefined
    const inicio = performance.now()
    try {
      linha = await this.leitura.lerParaGuarda(token)
    } catch (erro) {
      // O logger do Nest leva só o resumo do erro, sem a mensagem nem a consulta (regra 20, item 9).
      this.#liberarAviso()
      if (this.#avisoLiberado) {
        this.#avisoLiberado = false
        if (erro instanceof Error) this.#logger.warn(erro)
        else this.#logger.warn('sessao.leitura_indisponivel')
      }
      throw new DomainException(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, undefined, DEFAULT_RETRY_AFTER_SECONDS)
    } finally {
      this.#duracaoDaLeitura?.record((performance.now() - inicio) / 1_000)
    }
    const sessao = avaliarSessao(token, linha)
    if (sessao === undefined || linha === undefined) throw new DomainException(ErrorCode.NAO_AUTENTICADO)
    setContextSessao(sessao)
    if (tokenDaUltimaRenovacao(token, linha)) {
      this.leitura.marcarAtualApresentado(token).catch(() => {
        this.#avisarMarcacao()
      })
    }
    return true
  }
}
