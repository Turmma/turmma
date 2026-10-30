import type { Database, LoggerBase } from '@educa/nucleo'
import { Global, Module, type BeforeApplicationShutdown, type DynamicModule, type OnApplicationBootstrap } from '@nestjs/common'
import { BANCO } from '../banco.module.js'
import { BuscaDeTrechos } from './busca-de-trechos.js'
import { ExtratorDePdf } from './extracao-de-pdf.js'
import { FilaDeExtracao } from './fila-de-extracao.js'
import { MaterialController } from './material.controller.js'
import { INTERVALO_DA_VARREDURA_MS, MaterialService } from './material.service.js'
import { GuardaDoEnvio } from './recebimento.js'

/**
 * O que o módulo faz na subida e na descida do processo, para nenhum material ficar `processando` sem ninguém lendo:
 *
 * - **na subida**, e depois a cada minuto, a varredura dá por falho o que ficou para trás de um processo que caiu (o
 *   PDF não é guardado, então não há o que retomar; a coordenação envia de novo);
 * - **na descida** (deploy, SIGTERM), antes de o pool do banco fechar, a fila aborta o que está lendo e cada material
 *   grava a própria falha na hora, sem esperar a varredura.
 */
export class CicloDaExtracao implements OnApplicationBootstrap, BeforeApplicationShutdown {
  #varredura: NodeJS.Timeout | undefined

  constructor(
    private readonly materiais: MaterialService,
    private readonly fila: FilaDeExtracao,
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
 * a busca de trechos. É global para o Assistente e o Tutor injetarem `BuscaDeTrechos` sem importar o módulo.
 */
@Global()
@Module({})
export class MaterialModule {
  /** @param logger o logger JSON do processo, o mesmo do `configurarAplicacao`: as linhas levam o id do material e medidas. */
  static com(logger: LoggerBase): DynamicModule {
    return {
      module: MaterialModule,
      controllers: [MaterialController],
      providers: [
        { provide: ExtratorDePdf, useValue: new ExtratorDePdf() },
        { provide: FilaDeExtracao, useValue: new FilaDeExtracao() },
        {
          provide: MaterialService,
          useFactory: (banco: Database, extrator: ExtratorDePdf, fila: FilaDeExtracao) => new MaterialService({ banco, extrator, fila, logger }),
          inject: [BANCO, ExtratorDePdf, FilaDeExtracao],
        },
        { provide: BuscaDeTrechos, useFactory: (banco: Database) => new BuscaDeTrechos(banco), inject: [BANCO] },
        { provide: CicloDaExtracao, useFactory: (materiais: MaterialService, fila: FilaDeExtracao) => new CicloDaExtracao(materiais, fila), inject: [MaterialService, FilaDeExtracao] },
        GuardaDoEnvio,
      ],
      exports: [BuscaDeTrechos],
    }
  }
}
