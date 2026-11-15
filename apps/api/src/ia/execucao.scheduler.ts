import {
  DomainException,
  LLMError,
  runInContext,
  requireEscolaId,
  exigirFuncaoAtiva,
  type Database,
  type ExecucaoAgendada,
  type AgenteExecutor,
  type LLMProvider,
  type SuspensaoDeFuncao,
  type DatabaseTransaction,
} from '@educa/core'
import { ErrorCode, execucaoInputSchema, resultadoGravadoSchema, type ExecucaoInput, type ExecucaoAceitaResponse, type ResultadoGravado, type TarefaDeIa, type ChaveDeFuncao } from '@educa/shared'
import { copiarContextoDeQuemPede } from './execucao-context.js'
import type { ComandoExecutavel, GravadorDaConclusao } from './execucao-command.js'
import { ExecucaoDaSessaoRepository, ExecucaoRepository } from './execucao.repository.js'
import type { RegistroDeComandos } from './registro-de-comandos.js'

/**
 * O pedido de uma tarefa de IA, que sempre tem **comando registrado** (`RegistroDeComandos`): o domínio entrega só a chave do
 * envio, a entrada gravada e, se houver, o que grava junto do `pendente`. Entrada da tarefa e conclusão são do comando, que as
 * relê do banco pelo id da execução: o pedido não leva closure de entrada nem de conclusão.
 */
export interface ExecucaoComComando {
  /** O nome da tarefa: é por ele que o registro acha o comando. */
  readonly comando: TarefaDeIa
  readonly chaveEnvio: string
  readonly entradaDaExecucao: ExecucaoInput
  /**
   * Roda na **mesma transação** que grava a execução, só quando ela é nova: é onde entra a mensagem de quem pediu
   * (`mensagem_agente`), ligada à execução. Na chave repetida não roda. Fica na requisição, nunca no comando.
   */
  readonly aoGravar?: (tx: DatabaseTransaction, execucaoId: string) => Promise<void>
}

interface AlvoDoPedido {
  readonly tarefa: TarefaDeIa
  readonly funcao: ChaveDeFuncao
  readonly rodar: (execucaoId: string, sinal: AbortSignal, gravar: GravadorDaConclusao) => Promise<ResultadoGravado>
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
 * - **A falha** vira `falhou` com o código, pelo executor; nada do que o `concluir` do comando gravou na transação fica.
 * - **O que roda** é `preparar` → modelo → `concluir` do comando registrado, que relê a execução pelo id.
 */
export class ExecucaoScheduler {
  constructor(
    private readonly banco: Database,
    private readonly ia: LLMProvider,
    private readonly executor: AgenteExecutor,
    private readonly suspensao: SuspensaoDeFuncao,
    private readonly comandos: RegistroDeComandos,
  ) {}

  async agendar(pedido: ExecucaoComComando): Promise<ExecucaoAceitaResponse> {
    // A tarefa e a função são as do comando. Sem comando registrado, o `de` lança antes de gravar.
    const alvo = this.#alvoDo(pedido)
    const escolaId = requireEscolaId()
    const contexto = copiarContextoDeQuemPede()
    const entradaDaExecucao = execucaoInputSchema.parse(pedido.entradaDaExecucao)
    // Defeito de quem chama, não do usuário: a entrada gravada precisa ser a da tarefa que vai rodar.
    if (entradaDaExecucao.tarefa !== alvo.tarefa) throw new LLMError('IA_ENTRADA_INVALIDA')

    await exigirFuncaoAtiva(this.suspensao, alvo.funcao)

    const execucaoId = await this.banco.transaction(async (tx) => {
      const execucoes = new ExecucaoDaSessaoRepository(tx)
      const nova = await execucoes.gravarPendente(alvo.tarefa, pedido.chaveEnvio, entradaDaExecucao)
      if (nova !== undefined) {
        await pedido.aoGravar?.(tx, nova)
        return nova
      }
      // A chave já foi usada na escola. Se foi por esta pessoa, é o reenvio: a mesma execução. Se não, é como se não existisse.
      const existente = await execucoes.daChave(pedido.chaveEnvio)
      if (existente === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      // A chave é desta pessoa, mas de outro pedido: a tela reaproveitou a chave, e não há execução a devolver.
      if (existente.tarefa !== alvo.tarefa) throw new DomainException(ErrorCode.CONFLITO)
      return existente.id
    })

    const execucao: ExecucaoAgendada = { id: execucaoId, escolaId, chave: pedido.chaveEnvio }
    // No reenvio também: se a execução ainda está pendente (o processo caiu antes de rodá-la), é isto que a retoma. Se
    // já está rodando ou terminou, o executor e o `update` condicional não a deixam rodar de novo.
    this.executor.agendar(execucao, (sinal) =>
      runInContext(contexto, async () => {
        const gravar: GravadorDaConclusao = (gravarNaTransacao) =>
          this.banco.transaction(async (tx) => {
            const resultado = resultadoGravadoSchema.parse(await gravarNaTransacao(tx, execucaoId))
            // Se o prazo ou a varredura já encerraram a execução, o que foi produzido agora é desfeito junto.
            if (!(await new ExecucaoRepository(tx).concluirRodando(execucao, resultado))) throw new LLMError('IA_TEMPO_ESGOTADO')
            return resultado
          })
        return alvo.rodar(execucaoId, sinal, gravar)
      }),
    )
    return { execucaoId }
  }

  /** Quem roda o pedido: o comando registrado. A tarefa e a função são as dele. */
  #alvoDo(pedido: ExecucaoComComando): AlvoDoPedido {
    const comando = this.comandos.de(pedido.comando)
    return { tarefa: comando.tarefa, funcao: comando.funcao, rodar: (execucaoId, sinal, gravar) => this.#rodarComando(comando, execucaoId, sinal, gravar) }
  }

  /**
   * A execução do comando, no contexto de quem pediu. **Relê a execução pelo id**, no escopo, e confere a suspensão de novo:
   * quem suspendeu a função depois do `202` não gasta busca de material nem modelo. A execução de outra tarefa, de outra
   * pessoa, de outra escola ou de outro ano responde como inexistente (`NAO_ENCONTRADO`).
   */
  async #rodarComando(comando: ComandoExecutavel, execucaoId: string, sinal: AbortSignal, gravar: GravadorDaConclusao): Promise<ResultadoGravado> {
    await exigirFuncaoAtiva(this.suspensao, comando.funcao)
    const lida = await new ExecucaoDaSessaoRepository(this.banco).paraExecutar(execucaoId)
    if (lida === undefined || lida.tarefa !== comando.tarefa) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    return comando.executar(lida, this.ia, sinal, gravar)
  }
}
