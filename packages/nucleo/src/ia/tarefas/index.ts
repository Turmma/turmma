import type { TarefaDeIa } from '@educa/shared'
import { adaptarAtividade } from './adaptar-atividade.js'
import { gerarAtividadeObjetiva } from './gerar-atividade-objetiva.js'
import { gerarPlanoDeAula } from './gerar-plano-de-aula.js'
import { proporFerramenta } from './propor-ferramenta.js'
import { relatorioDaCorrecao } from './relatorio-da-correcao.js'
import { resumoDoAnalista } from './resumo-do-analista.js'
import { turnoDoTutor } from './turno-do-tutor.js'

/**
 * O catálogo das tarefas de IA da fatia. Os nomes são os do contrato (`TAREFAS_DE_IA`, em `@educa/shared`), que é
 * a fonte: o `satisfies` não compila se sobrar ou faltar tarefa aqui, e o teste confere que cada definição leva o
 * próprio nome e a função que o contrato dá a ela (`FUNCAO_DA_TAREFA_DE_IA`). Tarefa nova entra nos dois lugares,
 * com prompt, schemas, conferência e versão determinística.
 */
export const TASK_CATALOG = {
  propor_ferramenta: proporFerramenta,
  gerar_atividade_objetiva: gerarAtividadeObjetiva,
  gerar_plano_de_aula: gerarPlanoDeAula,
  adaptar_atividade: adaptarAtividade,
  turno_do_tutor: turnoDoTutor,
  relatorio_da_correcao: relatorioDaCorrecao,
  resumo_do_analista: resumoDoAnalista,
} as const satisfies Record<TarefaDeIa, { readonly nome: TarefaDeIa }>
