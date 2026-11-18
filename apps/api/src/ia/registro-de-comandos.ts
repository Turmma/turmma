import { InvariantException, TAREFAS_DE_IA, type TarefaDeIa } from '@educa/shared'
import { comoExecutavel, type ComandoExecutavel, type ExecucaoCommand } from './execucao-command.js'

/**
 * Os comandos das tarefas de IA, por nome de tarefa. Cada módulo dono registra o seu na subida (`artefato/`, `assistente/`,
 * `governanca/`), e o agendador acha pelo nome da `execucao_agente.tarefa`: é isso que deixa a execução rodar sem a closure
 * do pedido (a 5.0 a roda no worker, que só sabe o id da execução).
 */
export class RegistroDeComandos {
  private readonly comandos = new Map<TarefaDeIa, ComandoExecutavel>()

  /** Duas vezes a mesma tarefa é erro de montagem dos módulos, e não troca silenciosa de quem executa. */
  registrar<Entrada, Saida, Lido>(comando: ExecucaoCommand<Entrada, Saida, Lido>): void {
    const executavel = comoExecutavel(comando)
    if (this.comandos.has(executavel.tarefa)) throw new InvariantException('a tarefa já tem comando registrado')
    this.comandos.set(executavel.tarefa, executavel)
  }

  /** O comando da tarefa. Sem registro, é defeito de montagem: o `POST` não chega a gravar a execução. */
  de(tarefa: TarefaDeIa): ComandoExecutavel {
    const comando = this.comandos.get(tarefa)
    if (comando === undefined) throw new InvariantException('a tarefa não tem comando registrado')
    return comando
  }

  tarefas(): TarefaDeIa[] {
    return [...this.comandos.keys()]
  }
}

/** Registra o comando e o devolve: o módulo dono o monta e o registra no mesmo `useFactory`. */
export function comRegistro<Comando extends ExecucaoCommand<unknown, unknown, unknown>>(registro: RegistroDeComandos, comando: Comando): Comando {
  registro.registrar(comando)
  return comando
}

/**
 * A tarefa do catálogo que **ninguém chama**: o `relatorio_da_correcao` não roda por `execucao_agente` (a correção da objetiva é
 * regra, e o relatório que o professor vê é montado sem modelo), e por isso não tem comando. Tarefa que ganha chamador sai desta
 * lista e ganha comando no mesmo commit.
 *
 * O `classificar_secoes` já não está aqui: a 4.0 da classificacao-bncc registrou o comando dele (`ClassificarSecoesCommand`, da rotina: job da fila `lote`, sem pessoa nem requisição).
 */
export const TAREFAS_SEM_CHAMADOR: readonly TarefaDeIa[] = ['relatorio_da_correcao']

/**
 * As tarefas do catálogo que o registro dado não cobre, fora as que ninguém chama. A lista de tarefas vazia, ou o registro vazio,
 * **não** são "nada a cobrar": são o alvo que sumiu, e a conferência falha em vez de passar em branco.
 */
export function tarefasSemComando(registradas: readonly TarefaDeIa[], catalogo: readonly TarefaDeIa[] = TAREFAS_DE_IA): TarefaDeIa[] {
  if (catalogo.length === 0) throw new InvariantException('o catálogo de tarefas de IA está vazio')
  if (registradas.length === 0) throw new InvariantException('nenhum comando registrado')
  // O comando de uma tarefa que o catálogo não tem é erro de montagem, não comando a mais.
  if (registradas.some((tarefa) => !catalogo.includes(tarefa))) throw new InvariantException('comando registrado para tarefa fora do catálogo')
  return catalogo.filter((tarefa) => !registradas.includes(tarefa) && !TAREFAS_SEM_CHAMADOR.includes(tarefa))
}
