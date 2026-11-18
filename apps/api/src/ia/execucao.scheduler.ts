import {
  DomainException,
  LLMError,
  requireEscolaId,
  exigirFuncaoAtiva,
  type Database,
  type JobOutbox,
  type SuspensaoDeFuncao,
  type DatabaseTransaction,
} from '@educa/core'
import { ErrorCode, execucaoInputSchema, InvariantException, TIPO_EXECUTAR_IA, type ExecucaoInput, type ExecucaoAceitaResponse, type TarefaDeIa } from '@educa/shared'
import { copiarContextoDeQuemPede } from './execucao-context.js'
import { ExecucaoDaSessaoRepository } from './execucao.repository.js'
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

/**
 * O serviço que os pacotes de domínio usam para disparar IA, para nenhum repetir a dança: confere a suspensão, grava
 * a `execucao_agente` como `pendente` **e o job `ia.executar` no outbox, na mesma transação** (D49), e responde o id. Nenhuma
 * requisição espera o modelo: quem o chama é o `ExecucaoProcessor` do `main-worker` (X6, 5.0), que relê a execução pelo id.
 *
 * - **Função suspensa** é recusada antes de gravar (`FUNCAO_SUSPENSA`).
 * - **A mesma chave duas vezes** grava uma execução e um job: o índice único decide quem grava (e só quem grava enfileira), e a
 *   chave de outra pessoa responde como inexistente.
 * - **O job leva só o id da execução** (`{ execucaoId }`), com a execução como chave de idempotência: a escola vem da linha do
 *   outbox, e a entrada, a pessoa e o ano, da `execucao_agente`.
 * - **A fila é a do comando**: o Tutor na `interativa`, as ferramentas e a `propor_ferramenta` na `ferramenta`, o Analista na `normal`.
 * - **O Redis fora não derruba o `POST`**: o job está no Postgres e sai quando o Redis volta.
 */
export class ExecucaoScheduler {
  constructor(
    private readonly banco: Database,
    private readonly suspensao: SuspensaoDeFuncao,
    private readonly comandos: RegistroDeComandos,
    private readonly fila: JobOutbox,
  ) {}

  async agendar(pedido: ExecucaoComComando): Promise<ExecucaoAceitaResponse> {
    // A tarefa, a função e a fila são as do comando. Sem comando registrado, o `de` lança antes de gravar.
    const comando = this.comandos.de(pedido.comando)
    // A fila `lote` é da rotina (a classificação do material): nenhuma requisição a pede, e o job dela é `ia.executar-lote`, gravado por quem cria a execução sem pessoa.
    if (comando.fila === 'lote') throw new InvariantException('a tarefa do lote não se agenda por requisição')
    const fila = comando.fila
    requireEscolaId()
    // Quem pede precisa estar no contexto (escola, pessoa e ano): a execução grava `solicitada_por` e o ano da requisição.
    copiarContextoDeQuemPede()
    const entradaDaExecucao = execucaoInputSchema.parse(pedido.entradaDaExecucao)
    // Defeito de quem chama, não do usuário: a entrada gravada precisa ser a da tarefa que vai rodar.
    if (entradaDaExecucao.tarefa !== comando.tarefa) throw new LLMError('IA_ENTRADA_INVALIDA')

    await exigirFuncaoAtiva(this.suspensao, comando.funcao)

    const execucaoId = await this.banco.transaction(async (tx) => {
      const execucoes = new ExecucaoDaSessaoRepository(tx)
      // O reenvio, que é o caso comum de chave repetida, lê antes de gravar: o `insert … on conflict` espera a transação que está mudando a linha
      // (o worker, passando-a a `rodando`), e o reenvio esperaria com ele.
      const reenvio = await execucoes.daChave(pedido.chaveEnvio)
      if (reenvio !== undefined) return this.#doReenvio(reenvio, comando.tarefa)
      const nova = await execucoes.gravarPendente(comando.tarefa, pedido.chaveEnvio, entradaDaExecucao)
      if (nova !== undefined) {
        await pedido.aoGravar?.(tx, nova)
        await this.fila.enfileirarUmaVez(tx, TIPO_EXECUTAR_IA, { execucaoId: nova }, nova, { fila })
        return nova
      }
      // A chave entrou entre a leitura e a gravação (o clique duplo em paralelo). Se foi por esta pessoa, é o reenvio: a mesma execução, que já tem o job
      // dela. Se não, é como se não existisse.
      const existente = await execucoes.daChave(pedido.chaveEnvio)
      if (existente === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      return this.#doReenvio(existente, comando.tarefa)
    })
    return { execucaoId }
  }

  /** A execução que a chave já tem. Se a chave é desta pessoa mas de outra tarefa, a tela reaproveitou a chave, e não há execução a devolver. */
  #doReenvio(existente: { id: string; tarefa: TarefaDeIa }, tarefa: TarefaDeIa): string {
    if (existente.tarefa !== tarefa) throw new DomainException(ErrorCode.CONFLITO)
    return existente.id
  }
}
