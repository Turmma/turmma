import { randomUUID } from 'node:crypto'
import {
  currentContext,
  DomainException,
  exigirFuncaoAtiva,
  JobFailureError,
  LLMError,
  PRAZO_DA_EXECUCAO_MS,
  requireEscolaId,
  runInContext,
  summarizeError,
  type Database,
  type DestinoDoAdaptador,
  type JobExecution,
  type JobProcessor,
  type LLMProvider,
  type LoggerBase,
  type RequestContext,
  type SuspensaoDeFuncao,
} from '@educa/core'
import { ErrorCode, InvariantException, JobFailureCode, resultadoGravadoSchema, type ResultadoGravado } from '@educa/shared'
import type { ComandoExecutavel, GravadorDaConclusao } from './execucao-command.js'
import { ConsumoRepository } from './consumo.repository.js'
import { ExecucaoDaSessaoRepository, ExecucaoRepository, type ExecucaoParaIniciar } from './execucao.repository.js'
import { prazoPorTemporizador, type FabricaDePrazo } from './prazo-por-temporizador.js'
import type { RegistroDeComandos } from './registro-de-comandos.js'

export interface ExecucaoProcessorDependencies {
  readonly banco: Database
  /** O único lugar da API que alcança o modelo: o provedor do `main-worker`. */
  readonly ia: LLMProvider
  readonly comandos: RegistroDeComandos
  readonly suspensao: SuspensaoDeFuncao
  /** Para onde o adaptador configurado manda o conteúdo: a linha estimada da execução interrompida leva o envio e o modelo dele (D14). */
  readonly destino: DestinoDoAdaptador
  readonly logger: LoggerBase
  /** O prazo único de cada perfil. Só o teste troca, para ver o estouro sem esperar 140 s. */
  readonly prazo?: FabricaDePrazo
}

/** A conclusão achou a execução já encerrada (a varredura, o prazo): o que o comando gravou foi desfeito, e não há falha a gravar. */
class ExecucaoJaEncerrada extends Error {}

/** Milissegundos desde o `performance.now()` de `inicio`. */
function duracaoDesde(inicio: number): number {
  return Math.round(performance.now() - inicio)
}

/**
 * O processador do job `ia.executar` (X6, 5.0): o que o `POST` deixou `pendente` e o outbox publicou. Roda no `main-worker`, no
 * contexto da escola do job (`job_registro.escola_id`), e conclui a execução **uma vez só**.
 *
 * 1. **Lê a execução pelo id, no escopo da escola do job** (`ExecucaoRepository`). A de outra escola não é achada: o job falha
 *    sem tocar nada e sem modelo.
 * 2. **`pendente → rodando`** é um `update … where estado = 'pendente'`: a entrega duplicada, a execução que já terminou e a que a
 *    varredura encerrou não rodam, e o modelo não é chamado. **Com zero linhas, a execução ou terminou, ou está `rodando`**: a reentrega
 *    (o worker morreu no meio, ou a outra entrega ainda roda) a encerra com `EXECUCAO_INTERROMPIDA` por um `update … where estado = 'rodando'`,
 *    **sem modelo e sem troca**, e grava a linha estimada de `consumo_ia` na mesma transação (X6, 6.0; D14, D49). A conclusão da outra entrega, se
 *    ainda vier, acha a linha encerrada e se desfaz.
 * 3. **Monta o contexto de quem pediu** (a pessoa e o papel dela, e o ano letivo da linha) e roda o comando: `preparar`
 *    (que repete o alcance do `POST`, vínculo inclusive) → modelo → `concluir` na transação do `gravar`. Pessoa desativada ou com eliminação
 *    agendada (o fim do vínculo desativa a conta, regra 20, item 18) e ano virado dão `NAO_ENCONTRADO`, sem modelo e sem `consumo_ia`. Nenhuma conexão fica presa durante o modelo.
 * 4. **O prazo único** do perfil (`PRAZO_DA_EXECUCAO_MS`) conta do `rodando` e vai ao gateway como `pedido.sinal`: cobre a espera
 *    dos tokens, as duas tentativas e o degrau. Estourado pelo próprio sinal, grava `falhou IA_TEMPO_ESGOTADO`. O abort do job
 *    (desligamento do worker, `prazoMs` do tipo) **não grava**: a reentrega decide.
 * 5. **Log só com ids, tarefa e código** (regra 20, item 9): nunca a mensagem do provedor nem a entrada.
 */
export class ExecucaoProcessor {
  constructor(private readonly dependencias: ExecucaoProcessorDependencies) {}

  /** O processador de `JobExecutor`, ligado a `ia.executar`. */
  readonly processar: JobProcessor<'ia.executar'> = async ({ execucaoId }, _execucao: JobExecution, sinalDoJob?: AbortSignal) => {
    const { banco, logger } = this.dependencias
    const escolaId = requireEscolaId()
    const execucoes = new ExecucaoRepository(banco)
    const lida = await execucoes.paraIniciar(execucaoId)
    if (lida === undefined) {
      // Execução de outra escola ou que não existe: o job é defeito, e nada muda.
      logger.warn({ evento: 'ia.execucao.nao_encontrada', execucaoId, escolaId })
      throw new JobFailureError(JobFailureCode.DADOS_INVALIDOS, true)
    }
    if (!(await execucoes.marcarRodando(execucaoId))) {
      await this.#aoReentregar(execucaoId, escolaId, lida)
      return
    }
    const inicio = performance.now()
    // O comando é o da tarefa que a linha diz ter; sem comando registrado, é defeito de montagem e a execução falha em vez de ficar `rodando`.
    const comando = this.#comandoDe(lida.tarefa)
    const prazo = (this.dependencias.prazo ?? prazoPorTemporizador)(PRAZO_DA_EXECUCAO_MS[comando?.perfil ?? 'padrao'])
    const sinal = sinalDoJob === undefined ? prazo.sinal : AbortSignal.any([sinalDoJob, prazo.sinal])
    try {
      if (comando === undefined) throw new InvariantException('a tarefa não tem comando registrado')
      await this.#rodar(comando, lida, execucaoId, escolaId, sinal)
      const duracaoMs = duracaoDesde(inicio)
      const tipo = lida.tarefa
      logger.info({ evento: 'ia.execucao.concluida', execucaoId, escolaId, tipo, duracaoMs })
    } catch (erro) {
      await this.#aoFalhar(erro, { execucaoId, escolaId, tipo: lida.tarefa, inicio, sinalDoJob, prazo: prazo.sinal })
    } finally {
      prazo.cancelar()
    }
  }

  /**
   * A execução já não estava `pendente`: ou terminou (nada a fazer: o job foi entregue de novo), ou está `rodando`, e então a entrega que a pegou morreu ou ainda
   * roda. A decisão é do `update` condicional, e não da leitura de antes (`lida.estado` pode já estar velho): quem encerra recebe a linha, e só ele grava a
   * estimada, na mesma transação. A gravação que falha desfaz o encerramento, e a linha segue `rodando` para a varredura.
   */
  async #aoReentregar(execucaoId: string, escolaId: string, lida: ExecucaoParaIniciar): Promise<void> {
    const { logger, banco, destino } = this.dependencias
    const tipo = lida.tarefa
    let encerrada: boolean
    try {
      encerrada = await banco.transaction(async (tx) => {
        const interrompida = await new ExecucaoRepository(tx).encerrarRodando(execucaoId)
        if (interrompida === undefined) return false
        await new ConsumoRepository(tx).registrarEstimada(interrompida, destino)
        return true
      })
    } catch (erro) {
      // Só ids: a mensagem do erro do banco não vai ao log (regra 20, item 9).
      logger.warn({ evento: 'ia.execucao.interrupcao_nao_gravada', execucaoId, escolaId, tipo, erro: summarizeError(erro) })
      return
    }
    const codigo = ErrorCode.EXECUCAO_INTERROMPIDA
    if (encerrada) logger.warn({ evento: 'ia.execucao.interrompida', execucaoId, escolaId, tipo, codigo })
    else logger.info({ evento: 'ia.execucao.ja_tratada', execucaoId, escolaId, estado: lida.estado })
  }

  #comandoDe(tarefa: ExecucaoParaIniciar['tarefa']): ComandoExecutavel | undefined {
    try {
      return this.dependencias.comandos.de(tarefa)
    } catch {
      return undefined
    }
  }

  /** No contexto de quem pediu: a suspensão se confere de novo, a execução da sessão se relê, e o comando roda. */
  async #rodar(comando: ComandoExecutavel, lida: ExecucaoParaIniciar, execucaoId: string, escolaId: string, sinal: AbortSignal): Promise<void> {
    if (lida.quemPediu === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const contexto: RequestContext = {
      requisicaoId: currentContext()?.requisicaoId ?? randomUUID(),
      escolaId,
      usuarioId: lida.quemPediu.usuarioId,
      papel: lida.quemPediu.papel,
      anoLetivoId: lida.quemPediu.anoLetivoId,
    }
    await runInContext(contexto, async () => {
      // A suspensão se confere de novo: quem suspendeu a função depois do `202` não gasta busca de material nem modelo.
      await exigirFuncaoAtiva(this.dependencias.suspensao, comando.funcao)
      const paraRodar = await new ExecucaoDaSessaoRepository(this.dependencias.banco).paraExecutar(execucaoId)
      if (paraRodar === undefined || paraRodar.tarefa !== comando.tarefa) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      await comando.executar(paraRodar, this.dependencias.ia, sinal, this.#gravador(execucaoId))
    })
  }

  /** `rodando` → `concluida` na mesma transação do que o comando gravou: ou ficam as duas coisas, ou nenhuma. */
  #gravador(execucaoId: string): GravadorDaConclusao {
    return (gravarNaTransacao) =>
      this.dependencias.banco.transaction(async (tx) => {
        const resultado: ResultadoGravado = resultadoGravadoSchema.parse(await gravarNaTransacao(tx, execucaoId))
        // Se a varredura já encerrou a execução, o que foi produzido agora é desfeito junto.
        if (!(await new ExecucaoRepository(tx).concluirRodando(execucaoId, resultado))) throw new ExecucaoJaEncerrada()
        return resultado
      })
  }

  async #aoFalhar(erro: unknown, { execucaoId, escolaId, tipo, inicio, sinalDoJob, prazo }: { execucaoId: string; escolaId: string; tipo: string; inicio: number; sinalDoJob: AbortSignal | undefined; prazo: AbortSignal }): Promise<void> {
    const { logger, banco } = this.dependencias
    // O desligamento do worker e o prazo do job abortam o sinal do job, e não a execução: nada se grava, e a reentrega decide (6.0).
    if (sinalDoJob?.aborted === true) {
      logger.warn({ evento: 'ia.execucao.abortada', execucaoId, escolaId, tipo })
      return
    }
    if (erro instanceof ExecucaoJaEncerrada) {
      logger.warn({ evento: 'ia.execucao.encerrada_por_outro', execucaoId, escolaId, tipo })
      return
    }
    // O prazo único estourou pelo próprio sinal: o gateway devolve `IA_TEMPO_ESGOTADO` (ou outro código, se a chamada cedeu antes), e o código é o do prazo.
    const codigo = prazo.aborted ? ErrorCode.IA_TEMPO_ESGOTADO : erro instanceof DomainException ? erro.codigo : ErrorCode.ERRO_INTERNO
    // O erro tipado já diz tudo pelo código; o que não é tipado leva o resumo (nome e pilha, nunca a mensagem do provedor).
    const erroDoLog = erro instanceof LLMError || erro instanceof DomainException ? undefined : summarizeError(erro)
    const duracaoMs = duracaoDesde(inicio)
    logger.warn({ evento: 'ia.execucao.falhou', execucaoId, escolaId, tipo, codigo, duracaoMs, erro: erroDoLog })
    // Sem conseguir gravar a falha, a linha fica `rodando` e a varredura a encerra.
    await new ExecucaoRepository(banco)
      .marcarFalhou(execucaoId, codigo)
      .catch((erroAoGravar: unknown) => {
        // Só ids e o código: a mensagem do erro do banco não vai ao log (regra 20, item 9).
        logger.warn({ evento: 'ia.execucao.falha_nao_gravada', execucaoId, escolaId, codigo, erro: summarizeError(erroAoGravar) })
        return false
      })
  }
}
