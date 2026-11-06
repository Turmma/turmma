import { type Clock, type Database } from '@educa/core'
import { Module, type DynamicModule } from '@nestjs/common'
import { DB } from '../database.module.js'
import { SemanaController } from './semana.controller.js'
import { SemanaService } from './semana.service.js'

/** O que o módulo recebe de fora: só o teste passa o relógio. */
export interface SemanaModuleOptions {
  readonly relogio?: Clock
}

/** A Semana do professor (F2b): a leitura (2.0); os itens (3.0) e a gravação do texto (4.0) entram nos módulos das próximas tarefas. */
@Module({})
export class SemanaModule {
  static forRoot(opcoes: SemanaModuleOptions = {}): DynamicModule {
    return {
      module: SemanaModule,
      controllers: [SemanaController],
      providers: [
        {
          provide: SemanaService,
          useFactory: (banco: Database) => new SemanaService(banco, opcoes.relogio),
          inject: [DB],
        },
      ],
    }
  }
}
