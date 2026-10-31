import type { Database } from '@educa/core'
import { Module } from '@nestjs/common'
import { BANCO } from '../banco.module.js'
import { AnoLetivoController } from './ano-letivo/ano-letivo.controller.js'
import { AnoLetivoService } from './ano-letivo/ano-letivo.service.js'
import { DisciplinaController } from './disciplina/disciplina.controller.js'
import { DisciplinaService } from './disciplina/disciplina.service.js'
import { EscolaSessaoController } from './escola-sessao/escola-sessao.controller.js'
import { EscolaSessaoService } from './escola-sessao/escola-sessao.service.js'
import { ListaController } from './lista/lista.controller.js'
import { ListaService } from './lista/lista.service.js'
import { ProvedoresDaEscolaController } from './provedores-da-escola/provedores-da-escola.controller.js'
import { ProvedoresDaEscolaService } from './provedores-da-escola/provedores-da-escola.service.js'
import { SerieController } from './serie/serie.controller.js'
import { SerieService } from './serie/serie.service.js'
import { TurmaController } from './turma/turma.controller.js'
import { TurmaService } from './turma/turma.service.js'
import { MeusVinculosController, VinculoController } from './vinculo/vinculo.controller.js'
import { VinculoService } from './vinculo/vinculo.service.js'

/**
 * A estrutura da escola que a coordenação configura pela API: a inatividade da sessão (5.0), os domínios e tenants do
 * login pela conta da escola (13.0), e o ano letivo, as
 * séries, as disciplinas e as turmas (8.0), e o vínculo, com a turma e os alunos que ele abre (9.0); na A1, a lista de nomes
 * da turma (2.0).
 */
@Module({
  controllers: [EscolaSessaoController, ProvedoresDaEscolaController, AnoLetivoController, SerieController, DisciplinaController, TurmaController, ListaController, VinculoController, MeusVinculosController],
  providers: [
    { provide: EscolaSessaoService, useFactory: (banco: Database) => new EscolaSessaoService(banco), inject: [BANCO] },
    { provide: ProvedoresDaEscolaService, useFactory: (banco: Database) => new ProvedoresDaEscolaService(banco), inject: [BANCO] },
    { provide: AnoLetivoService, useFactory: (banco: Database) => new AnoLetivoService(banco), inject: [BANCO] },
    { provide: SerieService, useFactory: (banco: Database) => new SerieService(banco), inject: [BANCO] },
    { provide: DisciplinaService, useFactory: (banco: Database) => new DisciplinaService(banco), inject: [BANCO] },
    { provide: TurmaService, useFactory: (banco: Database) => new TurmaService(banco), inject: [BANCO] },
    { provide: ListaService, useFactory: (banco: Database) => new ListaService(banco), inject: [BANCO] },
    { provide: VinculoService, useFactory: (banco: Database) => new VinculoService(banco), inject: [BANCO] },
  ],
})
export class EstruturaModule {}
