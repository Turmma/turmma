import type { Environment } from '@educa/core'
import { systemStatusResponseSchema, type SystemStatusResponse } from '@educa/shared'
import { Inject, Injectable } from '@nestjs/common'
import { SaudeService } from './saude.service.js'

export const VERSAO_DO_SISTEMA = Symbol('VERSAO_DO_SISTEMA')
export const AMBIENTE_DO_SISTEMA = Symbol('AMBIENTE_DO_SISTEMA')
export const RELOGIO_DO_ESTADO = Symbol('RELOGIO_DO_ESTADO')

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
export class EstadoService {
  private ultima: Verificacao | undefined
  private emAndamento: Promise<Verificacao> | undefined

  constructor(
    private readonly saude: SaudeService,
    @Inject(VERSAO_DO_SISTEMA) private readonly versao: string,
    @Inject(AMBIENTE_DO_SISTEMA) private readonly ambiente: Environment,
    @Inject(RELOGIO_DO_ESTADO) private readonly agora: () => Date,
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
