import { CotaPorHora, JobOutbox, JobOutboxRepository, SecretCipher, throttledWarn, VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL, type Clock, type Database } from '@educa/core'
import { CONVITES_POR_HORA_POR_ESCOLA } from '@educa/shared'
import { Logger, Module, type DynamicModule } from '@nestjs/common'
import type { Redis } from 'ioredis'
import { REDIS_LOGIN_CLIENT } from '../credencial/index.js'
import { DB } from '../database.module.js'
import { ProfessoresController } from './professores.controller.js'
import { ProfessoresService } from './professores.service.js'

export interface ProfessoresModuleOptions {
  /** A chave AES-256 do token e do endereço na fila de envio (`EMAIL_TOKEN_KEY`): a mesma do worker, que decifra. */
  readonly chaveDoToken: Uint8Array
  /** Quantas instâncias da API dividem a cota quando o Redis de fila está fora (`LIMITE_INSTANCIAS_API`). */
  readonly instancias: number
  /** O relógio da validade do convite e da janela da cota. Só o teste passa; nunca vem do ambiente. */
  readonly relogio?: Clock | undefined
}

/**
 * Os professores da escola que a coordenação cadastra e convida (A1, tarefa 3.0), e o "Enviar convites" por e-mail
 * (acesso-e-convites, tarefa 3.0): a cota de 300/h por escola fica no Redis de fila (o cliente é o do login, do `SessaoModule`), a cifra usa a chave do
 * e-mail, e o envio vai para a fila pelo `JobOutbox`, na transação do pedido.
 */
@Module({})
export class ProfessoresModule {
  private static readonly logger = new Logger('convites')

  static forRoot({ chaveDoToken, instancias, relogio }: ProfessoresModuleOptions): DynamicModule {
    return {
      module: ProfessoresModule,
      controllers: [ProfessoresController],
      providers: [
        { provide: JobOutboxRepository, useFactory: (banco: Database) => new JobOutboxRepository(banco), inject: [DB] },
        {
          provide: CotaPorHora,
          useFactory: (cliente: Redis) => {
            // Uma linha a cada 30 s no máximo: com o Redis fora, cada "Enviar" cai no seguro.
            const avisar = throttledWarn(() => ProfessoresModule.logger.warn('convites.cota_no_seguro_em_memoria'))
            return new CotaPorHora(cliente, { porHora: CONVITES_POR_HORA_POR_ESCOLA, instancias, relogio, aoUsarOSeguro: avisar })
          },
          inject: [REDIS_LOGIN_CLIENT],
        },
        {
          provide: ProfessoresService,
          useFactory: (banco: Database, cota: CotaPorHora, repositorio: JobOutboxRepository) =>
            new ProfessoresService(banco, { cota, cifra: new SecretCipher(VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL, new Map([[VERSAO_DA_CHAVE_DO_TOKEN_DE_EMAIL, chaveDoToken]])), fila: new JobOutbox(repositorio) }, relogio),
          inject: [DB, CotaPorHora, JobOutboxRepository],
        },
      ],
    }
  }
}
