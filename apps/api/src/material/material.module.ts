import type { Database, LoggerBase } from '@educa/core'
import { Global, Module, type BeforeApplicationShutdown, type DynamicModule, type OnApplicationBootstrap } from '@nestjs/common'
import { DB } from '../database.module.js'
import { TrechoSearch } from './trecho-search.js'
import { PdfExtractor } from './pdf-extraction.js'
import { ExtractionQueue } from './extraction-queue.js'
import { MaterialController } from './material.controller.js'
import { INTERVALO_DA_VARREDURA_MS, MaterialService } from './material.service.js'
import { MaterialUploadGuard } from './material-upload.js'

/**
 * O que o módulo faz na subida e na descida do processo, para nenhum material ficar `processando` sem ninguém lendo:
 *
 * - **na subida**, e depois a cada minuto, a varredura dá por falho o que ficou para trás de um processo que caiu (o
 *   PDF não é guardado, então não há o que retomar; a coordenação envia de novo);
 * - **na descida** (deploy, SIGTERM), antes de o pool do banco fechar, a fila aborta o que está lendo e cada material
 *   grava a própria falha na hora, sem esperar a varredura.
 */
export class ExtractionLifecycle implements OnApplicationBootstrap, BeforeApplicationShutdown {
  #varredura: NodeJS.Timeout | undefined

  constructor(
    private readonly materiais: MaterialService,
    private readonly fila: ExtractionQueue,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.materiais.varrerParados()
    this.#varredura = setInterval(() => void this.materiais.varrerParados(), INTERVALO_DA_VARREDURA_MS)
    this.#varredura.unref()
  }

  async beforeApplicationShutdown(): Promise<void> {
    clearInterval(this.#varredura)
    this.#varredura = undefined
    await this.fila.encerrar()
  }
}

/**
 * O material da escola (MVP, A2; D5, D22, D75): as cinco rotas de `/v1/materiais`, a extração do PDF em segundo plano e
 * a busca de trechos. É global para o Assistente e o Tutor injetarem `TrechoSearch` sem importar o módulo.
 */
@Global()
@Module({})
export class MaterialModule {
  /** @param logger o logger JSON do processo, o mesmo do `configureApp`: as linhas levam o id do material e medidas. */
  static forRoot(logger: LoggerBase): DynamicModule {
    return {
      module: MaterialModule,
      controllers: [MaterialController],
      providers: [
        { provide: PdfExtractor, useValue: new PdfExtractor() },
        { provide: ExtractionQueue, useValue: new ExtractionQueue() },
        {
          provide: MaterialService,
          useFactory: (banco: Database, extrator: PdfExtractor, fila: ExtractionQueue) => new MaterialService({ banco, extrator, fila, logger }),
          inject: [DB, PdfExtractor, ExtractionQueue],
        },
        { provide: TrechoSearch, useFactory: (banco: Database) => new TrechoSearch(banco), inject: [DB] },
        { provide: ExtractionLifecycle, useFactory: (materiais: MaterialService, fila: ExtractionQueue) => new ExtractionLifecycle(materiais, fila), inject: [MaterialService, ExtractionQueue] },
        MaterialUploadGuard,
      ],
      exports: [TrechoSearch],
    }
  }
}
