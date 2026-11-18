import { InvariantException, type ChaveDeFuncao, type ExecucaoInput, type ResultadoGravado, type TarefaDeIa } from '@educa/shared'
import { requireEscolaId, type CodigoDeFalhaDaExecucao, type DatabaseTransaction, type LLMProvider, type Perfil, type TaskDefinition } from '@educa/core'

/**
 * A fila em que a tarefa roda, no `main-worker` (5.0): o Tutor na `interativa`, as ferramentas na `ferramenta`, o Analista na `normal`, e a classificação do material no `lote`
 * (classificacao-bncc, 4.0: não urgente, fora do horário letivo, sem pessoa nem ano).
 */
export type FilaDeIa = 'interativa' | 'ferramenta' | 'normal' | 'lote'

/**
 * A `execucao_agente` como o comando a relê **do banco, pelo id**, no escopo da escola do contexto: o que o `POST`
 * gravou, e não o que a closure do pedido lembrava. É o que o `preparar` recebe.
 */
export interface ExecucaoLida {
  readonly id: string
  readonly tarefa: TarefaDeIa
  readonly chaveEnvio: string
  /** A `entrada` gravada com a execução, já validada de novo: só os parâmetros que não estão em outra linha. */
  readonly entrada: ExecucaoInput
}

/** O que o `preparar` entrega: a entrada da tarefa, o que foi lido para montá-la (volta ao `concluir`) e, no Tutor, o aluno e a turma do freio. */
export interface Preparado<Entrada, Lido> {
  readonly entrada: Entrada
  readonly lido: Lido
  /**
   * Não há o que mandar ao modelo (a classificação sem seção viva, ou sem candidata): a execução conclui **sem chamar o provedor e sem linha em `consumo_ia`**, pelo `concluirSemModelo`. A `entrada` vale só
   * para preencher o tipo e não é lida.
   */
  readonly semModelo?: true
  readonly alunoId?: string
  readonly turmaId?: string
}

/**
 * O comando de uma tarefa de IA: tudo o que a execução precisa do domínio, sem closure. O `preparar` relê a execução e o
 * que a entrada pede, **no escopo, repetindo o alcance do `POST`**: quem saiu da turma, o material que saiu de uso e a
 * pessoa eliminada entre o `202` e agora respondem `NAO_ENCONTRADO`, sem modelo e sem consumo. O `concluir` grava o que a
 * execução produz, na transação que a conclui, com o `lido` tipado que o `preparar` devolveu (X6, `techspec.md` §5).
 */
export interface ExecucaoCommand<Entrada, Saida, Lido> {
  readonly tarefa: TaskDefinition<Entrada, Saida>
  readonly fila: FilaDeIa
  /**
   * A execução nasce da rotina, **sem pessoa nem ano** (`solicitada_por` nulo): a classificação do material. Só o comando que declara isto roda com `quemPediu` ausente; em qualquer outro, a execução sem pessoa
   * ativa (desativada, eliminada, de ano virado) continua `NAO_ENCONTRADO`, sem modelo e sem consumo.
   */
  readonly daRotina?: true
  preparar(execucao: ExecucaoLida): Promise<Preparado<Entrada, Lido>>
  /**
   * O que se grava **antes** de abrir a transação da conclusão, na sua própria e já concluída (a D36 do Tutor): devolve o resultado, e a conclusão só o
   * registra; `undefined` segue para o `concluir`. Separado do `concluir` para a execução nunca ocupar duas conexões do pool ao mesmo tempo: com o job
   * no worker, o pool é do tamanho da concorrência, e duas conexões por job o deixariam esperando por si mesmo.
   */
  antesDeConcluir?(saida: Saida, lido: Lido): Promise<ResultadoGravado | undefined>
  concluir(saida: Saida, lido: Lido, tx: DatabaseTransaction, execucaoId: string): Promise<ResultadoGravado>
  /** O que se grava quando o `preparar` devolveu `semModelo`: a conclusão sem efeito, na mesma transação em que a execução conclui. */
  concluirSemModelo?(lido: Lido, tx: DatabaseTransaction, execucaoId: string): Promise<ResultadoGravado>
  /**
   * Roda **na transação em que a execução passa a `falhou`**, só quando ela passou (o `update` condicional devolveu a linha): é onde a classificação soma uma falha em `falhas_seguidas` das seções da execução, e por
   * isso a entrega duplicada do mesmo job, que acha a execução já encerrada, não soma de novo.
   */
  aoFalharDefinitivo?(codigo: CodigoDeFalhaDaExecucao, tx: DatabaseTransaction, execucaoId: string): Promise<void>
}

/** O tipo da entrada e o da saída de uma tarefa, para o comando não os repetir. */
export type EntradaDaTarefa<T> = T extends TaskDefinition<infer Entrada, unknown> ? Entrada : never
export type SaidaDaTarefa<T> = T extends TaskDefinition<unknown, infer Saida> ? Saida : never

/** Quem grava dentro de uma transação e conclui a execução na mesma: ou ficam as duas coisas, ou nenhuma. */
export type GravadorDaConclusao = (gravar: (tx: DatabaseTransaction, execucaoId: string) => Promise<ResultadoGravado>) => Promise<ResultadoGravado>

/**
 * O comando sem os tipos de entrada, saída e `lido`: é o que o registro guarda e o que o agendador roda. Os tipos ficam
 * dentro de `comoExecutavel`, que é o único lugar que os junta.
 */
export interface ComandoExecutavel {
  readonly tarefa: TarefaDeIa
  readonly funcao: ChaveDeFuncao
  readonly fila: FilaDeIa
  /** `true` no comando da rotina: a execução não tem pessoa nem ano, e o processador a lê por `ExecucaoRepository.paraExecutarDaRotina`. */
  readonly daRotina: boolean
  /** O gancho da transação da passagem a `falhou` (o do comando), quando ele declara um. */
  readonly aoFalharDefinitivo?: (codigo: CodigoDeFalhaDaExecucao, tx: DatabaseTransaction, execucaoId: string) => Promise<void>
  /** O perfil da tarefa: é por ele que o processador acha o prazo único da execução (`PRAZO_DA_EXECUCAO_MS`). */
  readonly perfil: Perfil
  /** `preparar` → modelo → `concluir` na transação do `gravar`. Quem chama já conferiu a suspensão e leu a execução. */
  executar(execucao: ExecucaoLida, ia: LLMProvider, sinal: AbortSignal, gravar: GravadorDaConclusao): Promise<ResultadoGravado>
}

export function comoExecutavel<Entrada, Saida, Lido>(comando: ExecucaoCommand<Entrada, Saida, Lido>): ComandoExecutavel {
  return {
    tarefa: comando.tarefa.nome,
    funcao: comando.tarefa.funcao,
    fila: comando.fila,
    perfil: comando.tarefa.perfil,
    daRotina: comando.daRotina === true,
    ...(comando.aoFalharDefinitivo === undefined ? {} : { aoFalharDefinitivo: (codigo, tx, execucaoId) => comando.aoFalharDefinitivo?.(codigo, tx, execucaoId) ?? Promise.resolve() }),
    async executar(execucao, ia, sinal, gravar) {
      const { entrada, lido, alunoId, turmaId, semModelo } = await comando.preparar(execucao)
      if (semModelo === true) {
        if (comando.concluirSemModelo === undefined) throw new InvariantException('o comando pediu para concluir sem modelo e não sabe como')
        const concluirSemModelo = comando.concluirSemModelo.bind(comando)
        return gravar((tx, execucaoId) => concluirSemModelo(lido, tx, execucaoId))
      }
      const { saida } = await ia.gerar({
        tarefa: comando.tarefa,
        entrada,
        escolaId: requireEscolaId(),
        execucaoId: execucao.id,
        sinal,
        fila: comando.fila,
        ...(alunoId === undefined ? {} : { alunoId }),
        ...(turmaId === undefined ? {} : { turmaId }),
      })
      const jaGravado = await comando.antesDeConcluir?.(saida, lido)
      if (jaGravado !== undefined) return gravar(() => Promise.resolve(jaGravado))
      return gravar((tx, execucaoId) => comando.concluir(saida, lido, tx, execucaoId))
    },
  }
}
