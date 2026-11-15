import { InvariantException, type TarefaDeIa } from '@educa/shared'
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
