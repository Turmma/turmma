import { globalMeter, type Database, type LoggerBase, type Meter } from '@educa/core'
import { Module, type DynamicModule } from '@nestjs/common'
import type { Redis } from 'ioredis'
import { DB } from '../database.module.js'
import { AcessoDaSala } from '../sessao/index.js'
import { REDIS_LOGIN_CLIENT, LoginLockout, WindowCounter, PasswordHasher, HashBulkhead } from '../credencial/index.js'
import { AcessoDaTurmaController } from './acesso-da-turma/acesso-da-turma.controller.js'
import { AcessoDaTurmaService } from './acesso-da-turma/acesso-da-turma.service.js'
import { sortearCodigoDaTurma, type SorteioDoCodigo } from './codigo-da-sala.js'
import type { SalaConfig } from './sala-config.js'
import { DecisaoService } from './decisao/decisao.service.js'
import { avisarSeguroDaSala, JANELA_DOS_LIMITES_DA_SALA_MS, SalaRateLimits } from './sala-rate-limits.js'
import { MinhaTurmaController } from './minha-turma/minha-turma.controller.js'
import { MinhaTurmaService } from './minha-turma/minha-turma.service.js'
import { PedidosController } from './decisao/pedidos.controller.js'
import { ReivindicacaoService } from './reivindicacao/reivindicacao.service.js'
import { SalasController } from './salas/salas.controller.js'
import { SalasService } from './salas/salas.service.js'

export interface SalaModuleOptions {
  readonly config: SalaConfig
  /**
   * A chave de HMAC dos contadores (`LOGIN_CHAVE_CONTADOR`): os limites da sala (7.0) usam a mesma do login, e não a do
   * código da turma, para quem tem uma não ter a outra.
   */
  readonly chaveContador: Uint8Array
  /** Quantas instâncias da API dividem os tetos da sala quando o Redis de fila está fora (`LIMITE_INSTANCIAS_API`). */
  readonly instancias: number
  /** O logger JSON do processo, para a linha `sala.limite_atingido` com o tipo e a escola. */
  readonly logger: LoggerBase
  /** O medidor da telemetria; sem ele, o global. */
  readonly medidor?: Meter
  /** Só o teste da colisão do código (C6) troca o sorteio; o `main.ts` monta com o de verdade. */
  readonly sortearCodigo?: SorteioDoCodigo
}

/**
 * A entrada do aluno pela turma (A1): o acesso da turma que o professor gera e revoga (4.0) e a página pública da sala,
 * que o aluno abre pelo link ou pelo código (5.0) e onde reivindica o nome (6.0), com os limites dela (7.0); os pedidos
 * que o professor e a coordenação decidem, e a turma que o aluno aprovado vê (8.0). O `AcessoDaSala`, o `HashBulkhead`,
 * o `PasswordHasher`, o `LoginLockout` do login (que a aprovação zera) e o cliente do Redis de fila do login vêm do
 * `SessaoModule`, global: o semáforo é um só por instância, dividido com o login, e os contadores da sala moram no Redis
 * que não expulsa chave.
 */
@Module({})
export class SalaModule {
  static forRoot({ config, chaveContador, instancias, logger, medidor, sortearCodigo = sortearCodigoDaTurma }: SalaModuleOptions): DynamicModule {
    return {
      module: SalaModule,
      controllers: [AcessoDaTurmaController, SalasController, PedidosController, MinhaTurmaController],
      providers: [
        { provide: AcessoDaTurmaService, useFactory: (banco: Database) => new AcessoDaTurmaService(banco, config.chaveCodigo, sortearCodigo), inject: [DB] },
        {
          provide: SalaRateLimits,
          useFactory: (cliente: Redis) =>
            new SalaRateLimits({
              janela: new WindowCounter(cliente, chaveContador, { janelaMs: JANELA_DOS_LIMITES_DA_SALA_MS, avisarSeguro: avisarSeguroDaSala }),
              instancias,
              medidor: medidor ?? globalMeter(),
              logger,
            }),
          inject: [REDIS_LOGIN_CLIENT],
        },
        {
          provide: SalasService,
          useFactory: (banco: Database, acessoDaSala: AcessoDaSala, limites: SalaRateLimits) => new SalasService(banco, acessoDaSala, config.chaveCodigo, limites),
          inject: [DB, AcessoDaSala, SalaRateLimits],
        },
        {
          provide: ReivindicacaoService,
          useFactory: (banco: Database, acessoDaSala: AcessoDaSala, semaforo: HashBulkhead, hash: PasswordHasher, limites: SalaRateLimits) =>
            new ReivindicacaoService({ banco, acessoDaSala, semaforo, hash, chaveCodigo: config.chaveCodigo, limites, medidor: medidor ?? globalMeter() }),
          inject: [DB, AcessoDaSala, HashBulkhead, PasswordHasher, SalaRateLimits],
        },
        { provide: DecisaoService, useFactory: (banco: Database, contador: LoginLockout) => new DecisaoService(banco, contador), inject: [DB, LoginLockout] },
        { provide: MinhaTurmaService, useFactory: (banco: Database) => new MinhaTurmaService(banco), inject: [DB] },
      ],
    }
  }
}
