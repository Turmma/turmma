import {
  DomainException,
  LLMError,
  runInContext,
  requireEscolaId,
  exigirFuncaoAtiva,
  type Database,
  type TaskDefinition,
  type ExecucaoAgendada,
  type AgenteExecutor,
  type LLMProvider,
  type SuspensaoDeFuncao,
  type DatabaseTransaction,
} from '@educa/nucleo'
import { ErrorCode, execucaoInputSchema, resultadoGravadoSchema, type ExecucaoInput, type ExecucaoAceitaResponse, type ResultadoGravado } from '@educa/shared'
import { copiarContextoDeQuemPede } from './contexto-da-execucao.js'
import { ExecucaoDaSessaoRepository, ExecucaoRepository } from './execucao.repository.js'

/** O que um pacote de domínio entrega para disparar uma tarefa de IA. Escola, ano letivo e pessoa vêm da sessão. */
export interface PedidoDeExecucao<Entrada, Saida> {
  readonly tarefa: TaskDefinition<Entrada, Saida>
  /** A chave que a tela sorteou para este envio (`chaveEnvio` do corpo): a mesma chave devolve a mesma execução. */
  readonly chaveEnvio: string
  /**
   * O que fica em `execucao_agente.entrada` (`execucaoInputSchema`): só os parâmetros que não estão em outra
   * linha. O texto do professor e o do aluno **não** vêm aqui: ficam em `mensagem_agente` e `mensagem_tutor`.
   */
  readonly entradaDaExecucao: ExecucaoInput
  /**
   * A entrada da tarefa, ou como montá-la. A função roda **depois** de a rota responder, já no contexto de quem pediu:
   * é o lugar de buscar os trechos do material e de reler a mensagem gravada, para o `POST` não esperar por isso.
   */
  readonly entrada: Entrada | (() => Promise<Entrada>)
  /** No Tutor: o aluno e a turma, para o freio do dia e o pacote do mês (D38). */
  readonly alunoId?: string
  readonly turmaId?: string
  /**
   * Roda na **mesma transação** que grava a execução, só quando ela é nova: é onde entra a mensagem de quem pediu
   * (`mensagem_agente`, `mensagem_tutor`), ligada à execução. Na chave repetida não roda.
   */
  readonly aoGravar?: (tx: DatabaseTransaction, execucaoId: string) => Promise<void>
  /**
   * Recebe a saída **já validada** e grava o que a execução produz (a mensagem do agente, o artefato, a entrega),
   * devolvendo a referência que vai para `resultado`. Roda na mesma transação que conclui a execução: ou ficam as duas
   * coisas, ou nenhuma. Cada linha gravada aponta para a execução por `execucao_id`.
   */
  readonly aoConcluir: (saida: Saida, tx: DatabaseTransaction, execucaoId: string) => Promise<ResultadoGravado>
}

/**
 * O serviço que os pacotes de domínio usam para disparar IA, para nenhum repetir a dança: confere a suspensão, grava
 * a `execucao_agente` como `pendente` (idempotente pela chave de envio), responde o id e só então roda a tarefa, em
 * segundo plano, pelo `AgenteExecutor`.
 *
 * - **Função suspensa** é recusada antes de gravar (`FUNCAO_SUSPENSA`).
 * - **A mesma chave duas vezes** grava uma execução e produz uma vez: o índice único decide quem grava, o `update`
 *   condicional decide quem roda, e a chave de outra pessoa responde como inexistente.
 * - **O trabalho roda no contexto de quem pediu** (escola, pessoa, ano letivo), copiado na hora do pedido: os
 *   repositories de domínio que ele usa têm o mesmo escopo que teriam na requisição.
 * - **A falha** vira `falhou` com o código, pelo executor; nada do que `aoConcluir` gravou fica.
 */
export class AgendadorDeExecucoes {
  constructor(
    private readonly banco: Database,
    private readonly ia: LLMProvider,
    private readonly executor: AgenteExecutor,
    private readonly suspensao: SuspensaoDeFuncao,
  ) {}

  async agendar<Entrada, Saida>(pedido: PedidoDeExecucao<Entrada, Saida>): Promise<ExecucaoAceitaResponse> {
    const { tarefa } = pedido
    const escolaId = requireEscolaId()
    const contexto = copiarContextoDeQuemPede()
    const entradaDaExecucao = execucaoInputSchema.parse(pedido.entradaDaExecucao)
    // Defeito de quem chama, não do usuário: a entrada gravada precisa ser a da tarefa que vai rodar.
    if (entradaDaExecucao.tarefa !== tarefa.nome) throw new LLMError('IA_ENTRADA_INVALIDA')

    await exigirFuncaoAtiva(this.suspensao, tarefa.funcao)

    const execucaoId = await this.banco.transaction(async (tx) => {
      const execucoes = new ExecucaoDaSessaoRepository(tx)
      const nova = await execucoes.gravarPendente(tarefa.nome, pedido.chaveEnvio, entradaDaExecucao)
      if (nova !== undefined) {
        await pedido.aoGravar?.(tx, nova)
        return nova
      }
      // A chave já foi usada na escola. Se foi por esta pessoa, é o reenvio: a mesma execução. Se não, é como se não existisse.
      const existente = await execucoes.daChave(pedido.chaveEnvio)
      if (existente === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      // A chave é desta pessoa, mas de outro pedido: a tela reaproveitou a chave, e não há execução a devolver.
      if (existente.tarefa !== tarefa.nome) throw new DomainException(ErrorCode.CONFLITO)
      return existente.id
    })

    const execucao: ExecucaoAgendada = { id: execucaoId, escolaId, chave: pedido.chaveEnvio }
    // No reenvio também: se a execução ainda está pendente (o processo caiu antes de rodá-la), é isto que a retoma. Se
    // já está rodando ou terminou, o executor e o `update` condicional não a deixam rodar de novo.
    this.executor.agendar(execucao, (sinal) =>
      runInContext(contexto, async () => {
        const entrada = typeof pedido.entrada === 'function' ? await (pedido.entrada as () => Promise<Entrada>)() : pedido.entrada
        const { saida } = await this.ia.gerar({
          tarefa,
          entrada,
          escolaId,
          execucaoId,
          sinal,
          ...(pedido.alunoId === undefined ? {} : { alunoId: pedido.alunoId }),
          ...(pedido.turmaId === undefined ? {} : { turmaId: pedido.turmaId }),
        })
        return this.banco.transaction(async (tx) => {
          const resultado = resultadoGravadoSchema.parse(await pedido.aoConcluir(saida, tx, execucaoId))
          // Se o prazo ou a varredura já encerraram a execução, o que foi produzido agora é desfeito junto.
          if (!(await new ExecucaoRepository(tx).concluirRodando(execucao, resultado))) throw new LLMError('IA_TEMPO_ESGOTADO')
          return resultado
        })
      }),
    )
    return { execucaoId }
  }
}
