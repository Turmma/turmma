import { type Clock, type Database } from '@educa/core'
import { Module, type DynamicModule } from '@nestjs/common'
import { DB } from '../database.module.js'
import { AulasController } from './aulas.controller.js'
import { AulasService } from './aulas.service.js'
import { SemanaController } from './semana.controller.js'
import { SemanaService } from './semana.service.js'

/** O que o módulo recebe de fora: só o teste passa o relógio. */
export interface SemanaModuleOptions {
  readonly relogio?: Clock
}

/** A Semana do professor (F2b): a leitura (2.0) e a gravação do texto da aula (4.0); os itens do dia entram na 3.0. */
@Module({})
export class SemanaModule {
  static forRoot(opcoes: SemanaModuleOptions = {}): DynamicModule {
    return {
      module: SemanaModule,
      controllers: [SemanaController, AulasController],
      providers: [
        {
          provide: SemanaService,
          useFactory: (banco: Database) => new SemanaService(banco, opcoes.relogio),
          inject: [DB],
        },
        {
          provide: AulasService,
          useFactory: (banco: Database) => new AulasService(banco, opcoes.relogio),
          inject: [DB],
        },
      ],
    }
  }
}
