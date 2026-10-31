import { JobOutbox, JobOutboxRepository, type FileStorage, type Database, type Clock } from '@educa/core'
import { S3FileStorage } from '@educa/core/s3-file-storage'
import { Module, type BeforeApplicationShutdown, type DynamicModule } from '@nestjs/common'
import { BANCO } from '../banco.module.js'
import type { ConfiguracaoDoArmazemDaApi } from './configuracao-do-armazem.js'
import { MeusDadosController } from './meus-dados.controller.js'
import { PrivacidadeController } from './privacidade.controller.js'
import { PrivacidadeService } from './privacidade.service.js'

/** Fecha o cliente do armazém na descida do processo, antes de o pool do banco fechar. */
class CicloDoArmazem implements BeforeApplicationShutdown {
  constructor(private readonly encerrar: () => void) {}

  beforeApplicationShutdown(): void {
    this.encerrar()
  }
}

/** O que o módulo recebe de fora: a configuração do storage e, só no teste, o armazém e o relógio que a substituem. */
export interface OpcoesDaPrivacidade {
  readonly armazem: ConfiguracaoDoArmazemDaApi
  /** O armazém falso do teste. Sem ele, o S3 da configuração. Nunca vem do ambiente. */
  readonly armazemDeTeste?: FileStorage
  readonly relogio?: Clock
}

/**
 * A privacidade da escola (F3; Tech Spec do F3, seção 4): a retenção, os suboperadores, os incidentes e os pedidos do titular
 * que a coordenação lê e conduz, e "Meus dados", do aluno e do professor. O arquivo do titular (13.0) é gravado pelo worker no
 * storage privado; a API só confere que o objeto existe e assina a URL de 5 minutos.
 */
@Module({})
export class PrivacidadeModule {
  static com(opcoes: OpcoesDaPrivacidade): DynamicModule {
    const { armazem, encerrar } =
      opcoes.armazemDeTeste === undefined ? S3FileStorage.criar(opcoes.armazem) : { armazem: opcoes.armazemDeTeste, encerrar: (): void => undefined }
    return {
      module: PrivacidadeModule,
      controllers: [PrivacidadeController, MeusDadosController],
      providers: [
        { provide: JobOutboxRepository, useFactory: (banco: Database) => new JobOutboxRepository(banco), inject: [BANCO] },
        {
          provide: PrivacidadeService,
          useFactory: (banco: Database, repositorio: JobOutboxRepository) =>
            new PrivacidadeService(banco, { enfileirador: new JobOutbox(repositorio), armazem, ...(opcoes.relogio === undefined ? {} : { relogio: opcoes.relogio }) }),
          inject: [BANCO, JobOutboxRepository],
        },
        { provide: CicloDoArmazem, useFactory: () => new CicloDoArmazem(encerrar) },
      ],
    }
  }
}
