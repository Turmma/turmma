import { createLogger, globalMeter, JobOutbox, JobOutboxRepository, type Database, type LoggerBase, type Meter, type SuspensaoDeFuncao } from '@educa/core'
import { Global, Module, type DynamicModule } from '@nestjs/common'
import { DB } from '../database.module.js'
import { ExecucaoScheduler } from './execucao.scheduler.js'
import { FuncaoSuspensionCheck } from './funcao-suspension-check.js'
import { ExecucoesController } from './execucoes.controller.js'
import { ExecucoesService } from './execucoes.service.js'
import { MetricasDaExecucao } from './metricas-da-execucao.js'
import { OrcamentoRepository } from './orcamento.repository.js'
import { RegistroDeComandos } from './registro-de-comandos.js'
import { SuspensaoRepository } from './suspensao.repository.js'

/** A porta da camada de IA (regra 30, item 1): `@Inject(LLM_PROVIDER) ia: LLMProvider`. **Só o `main-worker` a provê** (`IaDoWorkerModule`): a API não tem modelo. */
export const LLM_PROVIDER = Symbol('LLM_PROVIDER')
/** "A função está suspensa nesta escola agora?" (D60). */
export const SUSPENSAO_DE_FUNCAO = Symbol('SUSPENSAO_DE_FUNCAO')
/** O freio do dia e o pacote do mês do Tutor (D38), para o `POST` do Tutor recusar antes de gravar. */
export const ORCAMENTO_DE_IA = Symbol('ORCAMENTO_DE_IA')

/**
 * A camada de IA **na API** (X6, 5.0): o `agendar` grava a execução e o job `ia.executar` no outbox, e **nenhuma requisição espera o
 * modelo**: o provedor (`LLM_PROVIDER`) e o `ExecucaoProcessor` vivem no `main-worker` (`IaDoWorkerModule`). É global: o módulo de
 * domínio só injeta.
 *
 * - `ExecucaoScheduler`: disparar uma tarefa (o caminho normal de todo `POST` que usa IA).
 * - `RegistroDeComandos`: o comando de cada tarefa de IA, que o `ComandosDeIaModule` registra na subida.
 * - `FuncaoSuspensionCheck`: conferir a suspensão onde a função roda sem modelo.
 * - `SUSPENSAO_DE_FUNCAO`, `ORCAMENTO_DE_IA`: as portas, para o caso que o agendador não cobre.
 */
@Global()
@Module({})
export class IaModule {
  /** `medidor` e `logger` são do `AppModule` (o `main.ts` os passa); sem eles, o medidor global e um logger JSON próprio: o `GET` da execução conta o corte da espera (RF5). */
  static forRoot(opcoes: { readonly medidor?: Meter; readonly logger?: LoggerBase } = {}): DynamicModule {
    return {
      module: IaModule,
      controllers: [ExecucoesController],
      providers: [
        { provide: SUSPENSAO_DE_FUNCAO, useFactory: (banco: Database) => new SuspensaoRepository(banco), inject: [DB] },
        { provide: ORCAMENTO_DE_IA, useFactory: (banco: Database) => new OrcamentoRepository(banco), inject: [DB] },
        { provide: RegistroDeComandos, useFactory: () => new RegistroDeComandos() },
        {
          provide: ExecucaoScheduler,
          useFactory: (banco: Database, suspensao: SuspensaoDeFuncao, comandos: RegistroDeComandos) => new ExecucaoScheduler(banco, suspensao, comandos, new JobOutbox(new JobOutboxRepository(banco))),
          inject: [DB, SUSPENSAO_DE_FUNCAO, RegistroDeComandos],
        },
        { provide: FuncaoSuspensionCheck, useFactory: (suspensao: SuspensaoDeFuncao) => new FuncaoSuspensionCheck(suspensao), inject: [SUSPENSAO_DE_FUNCAO] },
        {
          provide: ExecucoesService,
          useFactory: (banco: Database, comandos: RegistroDeComandos) =>
            new ExecucoesService(banco, comandos, new MetricasDaExecucao(opcoes.medidor ?? globalMeter()), opcoes.logger ?? createLogger({ servico: 'api' })),
          inject: [DB, RegistroDeComandos],
        },
      ],
      exports: [SUSPENSAO_DE_FUNCAO, ORCAMENTO_DE_IA, ExecucaoScheduler, FuncaoSuspensionCheck, RegistroDeComandos],
    }
  }
}

