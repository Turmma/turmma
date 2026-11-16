import type { Database, SuspensaoDeFuncao } from '@educa/core'
import { AdaptarAtividadeCommand } from '../artefato/adaptacao.command.js'
import { GerarAtividadeObjetivaCommand, GerarPlanoDeAulaCommand } from '../artefato/ferramentas.command.js'
import { ProporFerramentaCommand } from '../assistente/proposta.command.js'
import { ResumoDoAnalistaCommand } from '../governanca/analista.command.js'
import type { TrechoSearch } from '../material/trecho-search.js'
import { TurnoDoTutorCommand, type AlcanceDoAluno } from '../tutor/turno.command.js'
import { comRegistro, type RegistroDeComandos } from './registro-de-comandos.js'

/** Os seis comandos das tarefas de IA, já registrados. */
export interface ComandosDeIa {
  readonly turnoDoTutor: TurnoDoTutorCommand
  readonly proporFerramenta: ProporFerramentaCommand
  readonly atividadeObjetiva: GerarAtividadeObjetivaCommand
  readonly planoDeAula: GerarPlanoDeAulaCommand
  readonly adaptacao: AdaptarAtividadeCommand
  readonly resumoDoAnalista: ResumoDoAnalistaCommand
}

/**
 * Monta os seis comandos e os registra, na ordem do catálogo. É o único lugar que os junta: o `ComandosDeIaModule` (API e `main-worker`) e a
 * bancada de teste (`fila-de-ia.fixture.ts`) chamam esta função, e nenhum outro módulo cria comando de tarefa de IA (X6, 5.0).
 */
export function montarComandos(registro: RegistroDeComandos, banco: Database, trechos: TrechoSearch, suspensao: SuspensaoDeFuncao, alcance: AlcanceDoAluno): ComandosDeIa {
  return {
    turnoDoTutor: comRegistro(registro, new TurnoDoTutorCommand(banco, alcance, trechos, suspensao)),
    proporFerramenta: comRegistro(registro, new ProporFerramentaCommand(banco, trechos)),
    atividadeObjetiva: comRegistro(registro, new GerarAtividadeObjetivaCommand(banco, trechos)),
    planoDeAula: comRegistro(registro, new GerarPlanoDeAulaCommand(banco, trechos)),
    adaptacao: comRegistro(registro, new AdaptarAtividadeCommand(banco)),
    resumoDoAnalista: comRegistro(registro, new ResumoDoAnalistaCommand(banco)),
  }
}
