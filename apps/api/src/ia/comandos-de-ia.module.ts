import type { Database, Meter, SuspensaoDeFuncao } from '@educa/core'
import { Global, Module, type DynamicModule } from '@nestjs/common'
import { ProporFerramentaCommand } from '../assistente/proposta.command.js'
import { AdaptarAtividadeCommand } from '../artefato/adaptacao.command.js'
import { GerarAtividadeObjetivaCommand, GerarPlanoDeAulaCommand } from '../artefato/ferramentas.command.js'
import { DB } from '../database.module.js'
import { ResumoDoAnalistaCommand } from '../governanca/analista.command.js'
import { ClassificarSecoesCommand } from '../material/classificar-secoes.command.js'
import { TrechoSearch } from '../material/trecho-search.js'
import { AlcanceDoAluno, TurnoDoTutorCommand } from '../tutor/turno.command.js'
import { SUSPENSAO_DE_FUNCAO } from './ia.module.js'
import { buildComandos, type ComandosDeIa } from './montar-comandos.js'
import { RegistroDeComandos } from './registro-de-comandos.js'

/** Os sete comandos juntos, para os providers individuais não montarem cada um o seu. */
const COMANDOS_DE_IA = Symbol('COMANDOS_DE_IA')

/**
 * Os comandos das sete tarefas de IA, registrados no `RegistroDeComandos` na subida (X6, 5.0). É um módulo só, importado pela API
 * (onde o `agendar` acha a tarefa, a função e a fila de cada pedido) e pelo `main-worker` (onde o `ExecucaoProcessor` os executa),
 * sem controller: o worker sobe sem rota nem porta, e a montagem dos comandos não se repete nos dois pontos de entrada.
 *
 * O que ele pede de fora é global nos dois: o banco, a `TrechoSearch` (o `MaterialModule` na API, o `WorkerModule` no worker), a
 * suspensão por função e o registro (`IaModule`). Quem o importa lê no registro; o comando de uma tarefa registra uma vez só.
 */
@Global()
@Module({})
export class ComandosDeIaModule {
  /** `medidor` é só do teste, que lê a contagem das recusas por falta de material da série; sem ele vale o medidor global do processo. */
  static forRoot(opcoes: { readonly medidor?: Meter } = {}): DynamicModule {
    return {
      module: ComandosDeIaModule,
      providers: [
        // O que o `POST` do Tutor e o comando conferem do aluno é uma peça só (e é ela que conta a recusa por falta de material da série).
        { provide: AlcanceDoAluno, useFactory: (banco: Database, trechos: TrechoSearch) => new AlcanceDoAluno(banco, trechos, undefined, opcoes.medidor), inject: [DB, TrechoSearch] },
        {
          provide: COMANDOS_DE_IA,
          useFactory: (banco: Database, trechos: TrechoSearch, suspensao: SuspensaoDeFuncao, alcance: AlcanceDoAluno, registro: RegistroDeComandos) => buildComandos(registro, banco, trechos, suspensao, alcance, opcoes.medidor),
          inject: [DB, TrechoSearch, SUSPENSAO_DE_FUNCAO, AlcanceDoAluno, RegistroDeComandos],
        },
        { provide: TurnoDoTutorCommand, useFactory: (comandos: ComandosDeIa) => comandos.turnoDoTutor, inject: [COMANDOS_DE_IA] },
        { provide: ProporFerramentaCommand, useFactory: (comandos: ComandosDeIa) => comandos.proporFerramenta, inject: [COMANDOS_DE_IA] },
        { provide: GerarAtividadeObjetivaCommand, useFactory: (comandos: ComandosDeIa) => comandos.atividadeObjetiva, inject: [COMANDOS_DE_IA] },
        { provide: GerarPlanoDeAulaCommand, useFactory: (comandos: ComandosDeIa) => comandos.planoDeAula, inject: [COMANDOS_DE_IA] },
        { provide: AdaptarAtividadeCommand, useFactory: (comandos: ComandosDeIa) => comandos.adaptacao, inject: [COMANDOS_DE_IA] },
        { provide: ResumoDoAnalistaCommand, useFactory: (comandos: ComandosDeIa) => comandos.resumoDoAnalista, inject: [COMANDOS_DE_IA] },
        { provide: ClassificarSecoesCommand, useFactory: (comandos: ComandosDeIa) => comandos.classificarSecoes, inject: [COMANDOS_DE_IA] },
      ],
      exports: [AlcanceDoAluno, TurnoDoTutorCommand, ProporFerramentaCommand, GerarAtividadeObjetivaCommand, GerarPlanoDeAulaCommand, AdaptarAtividadeCommand, ResumoDoAnalistaCommand, ClassificarSecoesCommand],
    }
  }
}
