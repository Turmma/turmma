import { createLogger, type Clock, type Database, type DatabasePool, type LoggerBase } from '@educa/core'
import { Module, type DynamicModule } from '@nestjs/common'
import type { Redis } from 'ioredis'
import { DB, DB_POOL } from '../database.module.js'
import { FuncaoSuspensionCheck } from '../ia/funcao-suspension-check.js'
import { REDIS_LOGIN_CLIENT } from '../credencial/index.js'
import { AtividadeAplicadaController } from './atividade-aplicada/atividade-aplicada.controller.js'
import { AtividadeAplicadaService } from './atividade-aplicada/atividade-aplicada.service.js'
import { CorrecaoService } from './correcao/correcao.service.js'
import { DesempenhoController } from './desempenho/desempenho.controller.js'
import { DesempenhoService } from './desempenho/desempenho.service.js'
import { LoteReadMarker } from './correcao/lote-read-marker.js'
import { LoteController } from './correcao/lote.controller.js'
import { MinhaAtividadeController } from './minha-atividade/minha-atividade.controller.js'
import { MinhaAtividadeService } from './minha-atividade/minha-atividade.service.js'
import { PulsoRepository } from './pulso/pulso.repository.js'
import { PulsoService, type Tique } from './pulso/pulso.service.js'
import { RotasDeProvaGuard } from './pulso/rotas-de-prova.guard.js'

/** O que o `AppModule` passa ao módulo: o logger do processo e, só no teste, o relógio e o tique do pulso (nunca vêm do ambiente). */
export interface AtividadeModuleOpcoes {
  readonly logger?: LoggerBase
  /** O relógio da recusa das rotas de prova: o do pulso da instância, não o do banco. */
  readonly relogioDoPulso?: Clock
  /** O tique do pulso, que o teste dispara à mão. */
  readonly tiqueDoPulso?: Tique
}

/**
 * A atividade aplicada e a correção de objetiva (MVP, A3; D33, D46, D56): a professora aplica e encerra, o aluno
 * responde, a correção nasce pendente, a professora abre os destaques e aprova o lote com o registro da validação, e só
 * então o aluno alcança o diagnóstico. Não existe `Nota` nesta fatia.
 *
 * A conferência da função suspensa vem do `IaModule`, e o cliente do Redis de fila, do `SessaoModule`, os dois globais.
 *
 * **O pulso da API** (avaliacao-e-correcao, 2.0) mora aqui: o `PulsoService` pulsa só na instância HTTP, que o `main.ts` liga antes do `listen`
 * (`ouvirDepoisDoPrimeiroPulso`), e a `RotasDeProvaGuard` recusa com 503 as rotas de prova da instância que não pulsa.
 */
@Module({
  controllers: [AtividadeAplicadaController, MinhaAtividadeController, LoteController, DesempenhoController],
  providers: [
    { provide: LoteReadMarker, useFactory: (cliente: Redis) => new LoteReadMarker(cliente), inject: [REDIS_LOGIN_CLIENT] },
    { provide: AtividadeAplicadaService, useFactory: (banco: Database, conferencia: FuncaoSuspensionCheck) => new AtividadeAplicadaService(banco, conferencia), inject: [DB, FuncaoSuspensionCheck] },
    { provide: CorrecaoService, useFactory: (banco: Database, leitura: LoteReadMarker) => new CorrecaoService(banco, leitura), inject: [DB, LoteReadMarker] },
    { provide: MinhaAtividadeService, useFactory: (banco: Database) => new MinhaAtividadeService(banco), inject: [DB] },
    { provide: DesempenhoService, useFactory: (banco: Database) => new DesempenhoService(banco), inject: [DB] },
    RotasDeProvaGuard,
  ],
})
export class AtividadeModule {
  static forRoot(opcoes: AtividadeModuleOpcoes = {}): DynamicModule {
    return {
      module: AtividadeModule,
      providers: [
        { provide: PulsoRepository, useFactory: (pool: DatabasePool) => new PulsoRepository(pool), inject: [DB_POOL] },
        {
          provide: PulsoService,
          useFactory: (repositorio: PulsoRepository) =>
            new PulsoService({
              repositorio,
              logger: opcoes.logger ?? createLogger({ servico: 'api' }),
              ...(opcoes.relogioDoPulso === undefined ? {} : { relogio: opcoes.relogioDoPulso }),
              ...(opcoes.tiqueDoPulso === undefined ? {} : { tique: opcoes.tiqueDoPulso }),
            }),
          inject: [PulsoRepository],
        },
      ],
    }
  }
}
