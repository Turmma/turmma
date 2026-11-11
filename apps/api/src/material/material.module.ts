import { JobOutbox, JobOutboxRepository, type Database, type FileStorage, type LoggerBase } from '@educa/core'
import { S3FileStorage } from '@educa/core/s3-file-storage'
import { Global, Module, type BeforeApplicationShutdown, type DynamicModule } from '@nestjs/common'
import { DB } from '../database.module.js'
import type { FileStorageApiConfig } from '../privacidade/file-storage-config.js'
import { TrechoSearch } from './trecho-search.js'
import { MaterialController } from './material.controller.js'
import { MaterialService } from './material.service.js'
import { MaterialUploadGuard } from './material-upload.js'

/** Fecha o cliente do armazém na descida do processo, antes de o pool do banco fechar. */
class CicloDoArmazemDoMaterial implements BeforeApplicationShutdown {
  constructor(private readonly encerrar: () => void) {}

  beforeApplicationShutdown(): void {
    this.encerrar()
  }
}

/** O que o módulo recebe de fora: o logger, a configuração do storage e, só no teste, o armazém que a substitui. */
export interface MaterialModuleOptions {
  /** O logger JSON do processo, o mesmo do `configureApp`: as linhas levam o id do material e medidas. */
  readonly logger: LoggerBase
  readonly armazem: FileStorageApiConfig
  /** O armazém falso do teste. Sem ele, o S3 da configuração. Nunca vem do ambiente. */
  readonly armazemDeTeste?: FileStorage
}

/**
 * O material da escola (MVP, A2; D5, D22, D75): as cinco rotas de `/v1/materiais` e a busca de trechos. A API guarda o PDF
 * no storage privado e pede o job `material.extrair-pdf`; quem extrai é o `apps/worker`, na fila `pdf`. É global para o
 * Assistente e o Tutor injetarem `TrechoSearch` sem importar o módulo.
 */
@Global()
@Module({})
export class MaterialModule {
  static forRoot(opcoes: MaterialModuleOptions): DynamicModule {
    const { armazem, encerrar } =
      opcoes.armazemDeTeste === undefined ? S3FileStorage.criar(opcoes.armazem) : { armazem: opcoes.armazemDeTeste, encerrar: (): void => undefined }
    return {
      module: MaterialModule,
      controllers: [MaterialController],
      providers: [
        {
          provide: MaterialService,
          useFactory: (banco: Database) => new MaterialService({ banco, armazem, enfileirador: new JobOutbox(new JobOutboxRepository(banco)), logger: opcoes.logger }),
          inject: [DB],
        },
        { provide: TrechoSearch, useFactory: (banco: Database) => new TrechoSearch(banco), inject: [DB] },
        { provide: CicloDoArmazemDoMaterial, useFactory: () => new CicloDoArmazemDoMaterial(encerrar) },
        MaterialUploadGuard,
      ],
      exports: [TrechoSearch],
    }
  }
}
