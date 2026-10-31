import {
  createLogger,
  createLLMGateway,
  InProcessAgenteExecutor,
  type Database,
  type LLMConfig,
  type AgenteExecutor,
  type LLMProvider,
  type LoggerBase,
  type OrcamentoDeIa,
  type SuspensaoDeFuncao,
} from '@educa/core'
import { Global, Inject, Module, type DynamicModule, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common'
import { DB } from '../database.module.js'
import { ExecucaoScheduler } from './execucao.scheduler.js'
import { FuncaoSuspensionCheck } from './funcao-suspension-check.js'
import { ConsumoRepository } from './consumo.repository.js'
import { ExecucaoRepository } from './execucao.repository.js'
import { ExecucoesController } from './execucoes.controller.js'
import { ExecucoesService } from './execucoes.service.js'
import { OrcamentoRepository } from './orcamento.repository.js'
import { SuspensaoRepository } from './suspensao.repository.js'

/** A porta da camada de IA (regra 30, item 1): `@Inject(LLM_PROVIDER) ia: LLMProvider`. */
export const LLM_PROVIDER = Symbol('LLM_PROVIDER')
/** O executor das execuções em segundo plano. Quem dispara tarefa usa o `ExecucaoScheduler`, que já o chama. */
export const EXECUTOR_DE_AGENTE = Symbol('EXECUTOR_DE_AGENTE')
/** "A função está suspensa nesta escola agora?" (D60). */
export const SUSPENSAO_DE_FUNCAO = Symbol('SUSPENSAO_DE_FUNCAO')
/** O freio do dia e o pacote do mês do Tutor (D38), para o `POST` do Tutor recusar antes de gravar. */
export const ORCAMENTO_DE_IA = Symbol('ORCAMENTO_DE_IA')

export interface IaModuleOptions {
  /** A configuração de IA que o `loadConfig` da API leu e validou (`IA_ADAPTADOR`, `LLM_*`, `IA_EXECUC*`). */
  readonly config: LLMConfig
  readonly logger?: LoggerBase
}

/**
 * A camada de IA na API: monta o provedor pela configuração (adaptador falso por padrão, OpenAI-compatível por
 * `IA_ADAPTADOR`), com as quatro portas em Postgres, e o executor das execuções em segundo plano. É global: o módulo
 * de domínio só injeta.
 *
 * - `ExecucaoScheduler`: disparar uma tarefa (o caminho normal de todo `POST` que usa IA).
 * - `FuncaoSuspensionCheck`: conferir a suspensão onde a função roda sem modelo.
 * - `LLM_PROVIDER`, `EXECUTOR_DE_AGENTE`, `SUSPENSAO_DE_FUNCAO`, `ORCAMENTO_DE_IA`: as portas, para o caso que o
 *   agendador não cobre.
 *
 * Na subida, a varredura encerra as execuções que um processo caído deixou `pendente` ou `rodando`, e se repete a cada
 * prazo de execução. A configuração chega lida e validada pelo `loadConfig` da API, com as outras: o módulo não lê
 * o ambiente do processo.
 */
@Global()
@Module({})
export class IaModule implements OnApplicationBootstrap, OnApplicationShutdown {
  static forRoot(opcoes: IaModuleOptions): DynamicModule {
    const { config } = opcoes
    const logger = opcoes.logger ?? createLogger({ servico: 'api' })
    return {
      module: IaModule,
      controllers: [ExecucoesController],
      providers: [
        { provide: SUSPENSAO_DE_FUNCAO, useFactory: (banco: Database) => new SuspensaoRepository(banco), inject: [DB] },
        { provide: ORCAMENTO_DE_IA, useFactory: (banco: Database) => new OrcamentoRepository(banco), inject: [DB] },
        {
          provide: LLM_PROVIDER,
          useFactory: (banco: Database, orcamento: OrcamentoDeIa, suspensao: SuspensaoDeFuncao) =>
            createLLMGateway(config, { registro: new ConsumoRepository(banco), orcamento, suspensao, logger }),
          inject: [DB, ORCAMENTO_DE_IA, SUSPENSAO_DE_FUNCAO],
        },
        {
          provide: EXECUTOR_DE_AGENTE,
          useFactory: (banco: Database) => new InProcessAgenteExecutor({ repositorio: new ExecucaoRepository(banco), config: config.executor, logger }),
          inject: [DB],
        },
        {
          provide: ExecucaoScheduler,
          useFactory: (banco: Database, ia: LLMProvider, executor: AgenteExecutor, suspensao: SuspensaoDeFuncao) => new ExecucaoScheduler(banco, ia, executor, suspensao),
          inject: [DB, LLM_PROVIDER, EXECUTOR_DE_AGENTE, SUSPENSAO_DE_FUNCAO],
        },
        { provide: FuncaoSuspensionCheck, useFactory: (suspensao: SuspensaoDeFuncao) => new FuncaoSuspensionCheck(suspensao), inject: [SUSPENSAO_DE_FUNCAO] },
        { provide: ExecucoesService, useFactory: (banco: Database) => new ExecucoesService(banco), inject: [DB] },
      ],
      exports: [LLM_PROVIDER, EXECUTOR_DE_AGENTE, SUSPENSAO_DE_FUNCAO, ORCAMENTO_DE_IA, ExecucaoScheduler, FuncaoSuspensionCheck],
    }
  }

  constructor(@Inject(EXECUTOR_DE_AGENTE) private readonly executor: InProcessAgenteExecutor) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.executor.iniciar()
  }

  onApplicationShutdown(): void {
    this.executor.encerrar()
  }
}
