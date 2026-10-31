import type { Environment } from '@educa/core'
import { systemStatusResponseSchema, type SystemStatusResponse } from '@educa/shared'
import { Inject, Injectable } from '@nestjs/common'
import { HealthService } from './health.service.js'

export const SYSTEM_VERSION = Symbol('SYSTEM_VERSION')
export const SYSTEM_ENVIRONMENT = Symbol('SYSTEM_ENVIRONMENT')
export const STATUS_CLOCK = Symbol('STATUS_CLOCK')

/**
 * Por quanto tempo uma verificação do banco vale para a próxima requisição. A rota é anônima: sem
 * isso, cada recarga da casca de uma escola inteira abriria uma consulta, e com o Postgres travado
 * cada uma seguraria uma conexão do pool até o timeout.
 */
export const VALIDADE_DA_VERIFICACAO_MS = 5_000

interface Verificacao {
  bancoDisponivel: boolean
  verificadoEm: Date
}

@Injectable()
export class StatusService {
  private ultima: Verificacao | undefined
  private emAndamento: Promise<Verificacao> | undefined

  constructor(
    private readonly saude: HealthService,
    @Inject(SYSTEM_VERSION) private readonly versao: string,
    @Inject(SYSTEM_ENVIRONMENT) private readonly ambiente: Environment,
    @Inject(STATUS_CLOCK) private readonly agora: () => Date,
  ) {}

  /** Versão, ambiente e situação de cada componente. A API está disponível por estar respondendo. */
  async obter(): Promise<SystemStatusResponse> {
    const { bancoDisponivel, verificadoEm } = await this.verificar()
    const quando = verificadoEm.toISOString()
    return systemStatusResponseSchema.parse({
      versao: this.versao,
      ambiente: this.ambiente,
      componentes: [
        { nome: 'api', situacao: 'disponivel', verificadoEm: this.agora().toISOString() },
        { nome: 'banco', situacao: bancoDisponivel ? 'disponivel' : 'indisponivel', verificadoEm: quando },
      ],
    })
  }

  /** Uma consulta por vez e no máximo uma a cada validade: as requisições do meio reaproveitam o resultado. */
  private verificar(): Promise<Verificacao> {
    const ultima = this.ultima
    if (ultima && this.agora().getTime() - ultima.verificadoEm.getTime() < VALIDADE_DA_VERIFICACAO_MS) {
      return Promise.resolve(ultima)
    }
    this.emAndamento ??= this.saude
      .verificar()
      .then(({ ok }) => {
        this.ultima = { bancoDisponivel: ok, verificadoEm: this.agora() }
        return this.ultima
      })
      .finally(() => {
        this.emAndamento = undefined
      })
    return this.emAndamento
  }
}
