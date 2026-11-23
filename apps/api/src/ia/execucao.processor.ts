import { randomUUID } from 'node:crypto'
import {
  currentContext,
  destinosDaInterrompida,
  DomainException,
  estaNaJanela,
  exigirFuncaoAtiva,
  JobAdiadoError,
  JobFailureError,
  LLMError,
  MEIO_ABRE_O_DISJUNTOR_EM_MS,
  PRAZO_DA_EXECUCAO_MS,
  PRECO_DOS_MODELOS,
  proximaAbertura,
  requireEscolaId,
  runInContext,
  summarizeError,
  type Clock,
  type Database,
  type DestinosConfigurados,
  type JanelaLetiva,
  type JobExecution,
  type JobProcessor,
  type LLMProvider,
  type LoggerBase,
  type Meter,
  type OperationalSettings,
  type RequestContext,
  type SuspensaoDeFuncao,
  type TabelaDePrecos,
} from '@educa/core'
import { ErrorCode, InvariantException, JobFailureCode, resultadoGravadoSchema, type ResultadoGravado, type TIPO_EXECUTAR_IA, type TIPO_EXECUTAR_LOTE } from '@educa/shared'
import type { ComandoExecutavel, GravadorDaConclusao } from './execucao-command.js'
import { ConsumoRepository } from './consumo.repository.js'
import { ESPERA_MAXIMA_DA_INTERATIVA_SEGUNDOS, ExecucaoDaSessaoRepository, ExecucaoRepository, type ExecucaoParaIniciar } from './execucao.repository.js'
import { MetricasDaExecucao } from './metricas-da-execucao.js'
import { prazoPorTemporizador, type FabricaDePrazo } from './prazo-por-temporizador.js'
import type { RegistroDeComandos } from './registro-de-comandos.js'

export interface ExecucaoProcessorDependencies {
  readonly banco: Database
  /** O único lugar da API que alcança o modelo: o provedor do `main-worker`. */
  readonly ia: LLMProvider
  readonly comandos: RegistroDeComandos
  readonly suspensao: SuspensaoDeFuncao
  /** Para onde o adaptador configurado manda o conteúdo, o principal e a reserva: a linha estimada da execução interrompida, uma por destino, leva o envio e o modelo dele (D14). */
  readonly destinos: DestinosConfigurados
  /** A tabela de preços da porta, que a linha estimada de cada destino lê (F5b, 8.0). Sem ela vale `PRECO_DOS_MODELOS`, a do gateway. */
  readonly precos?: TabelaDePrecos
  readonly logger: LoggerBase
  /** Onde o corte da espera e a execução interrompida são contados (`ia.espera_estourada`, `ia.execucao.interrompida`). */
  readonly medidor: Meter
  /** O prazo único de cada perfil. Só o teste troca, para ver o estouro sem esperar 140 s. */
  readonly prazo?: FabricaDePrazo
  /** O horário letivo da escola do contexto: o job do `lote` que volta dentro dele é adiado até o fim (a classificação nunca roda com a escola em aula, regra 80, item 2). */
  readonly janelaDaEscola: Pick<OperationalSettings<JanelaLetiva>, 'daEscola'>
  /** O relógio da janela. Só o teste o troca, para pôr o job às 7h05 sem esperar. */
  readonly relogio: Clock
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
 * 2. **`pendente → rodando`** é um `update … where estado = 'pendente'` (e, na `interativa`, `criada_em` dentro dos 20 s de espera): a entrega duplicada, a execução que já terminou, a que a
 *    varredura encerrou e a pergunta que esperou mais de 20 s não rodam, e o modelo não é chamado. **Com zero linhas na `interativa`, tenta-se o corte** (`pendente` com mais de 20 s →
 *    `falhou IA_INDISPONIVEL`, sem modelo, e `ia.espera_estourada` soma só quando o `update` devolve a linha; RF5). **Com zero linhas ainda, a execução ou terminou, ou está `rodando`**: a reentrega
 *    (o worker morreu no meio, ou a outra entrega ainda roda) a encerra com `EXECUCAO_INTERROMPIDA` por um `update … where estado = 'rodando'`,
 *    **sem modelo e sem troca**, e grava as linhas estimadas de `consumo_ia`, uma por destino, na mesma transação (X6, 6.0; F5b, 8.0; D14, D49). A conclusão da outra entrega, se
 *    ainda vier, acha a linha encerrada e se desfaz.
 * 3. **Monta o contexto de quem pediu** (a pessoa e o papel dela, e o ano letivo da linha) e roda o comando: `preparar`
 *    (que repete o alcance do `POST`, vínculo inclusive) → modelo → `concluir` na transação do `gravar`. Pessoa desativada ou com eliminação
 *    agendada (o fim do vínculo desativa a conta, regra 20, item 18) e ano virado dão `NAO_ENCONTRADO`, sem modelo e sem `consumo_ia`. Nenhuma conexão fica presa durante o modelo.
 * 4. **O prazo único** do perfil (`PRAZO_DA_EXECUCAO_MS`) conta do `rodando` e vai ao gateway como `pedido.sinal`: cobre a espera
 *    dos tokens, as duas tentativas e o degrau. Estourado pelo próprio sinal, grava `falhou IA_TEMPO_ESGOTADO`. O abort do job
 *    (desligamento do worker, `prazoMs` do tipo) **não grava**: a reentrega decide.
 * 5. **Log só com ids, tarefa e código** (regra 20, item 9): nunca a mensagem do provedor nem a entrada.
 *
 * **O `lote`** (classificacao-bncc, 4.0; Tech Spec §5): o comando da fila `lote` é da rotina, e o mesmo processador o roda em `ia.executar-lote`, com quatro diferenças. (a) Sem pessoa nem ano: só o comando `daRotina` roda com
 * `quemPediu` ausente, lendo a execução por `paraExecutarDaRotina`. (b) **Antes de `rodando`**, confere a janela letiva (dentro dela, `JobAdiadoError` até a abertura, motivo `janela`, sem modelo e sem transição) e a
 * suspensão da função (suspensa, `pendente → falhou FUNCAO_SUSPENSA`, sem modelo). (c) O provedor que não atendeu (`IA_INDISPONIVEL` que não é recusa de soberania: balde cheio, disjuntor aberto, provedor fora) **não falha**: a
 * execução volta a `pendente` e o job é adiado (`provedor`), sem gastar tentativa. (d) Passando a `falhou`, o gancho do comando roda **na mesma transação**, para somar `falhas_seguidas`.
 */
export class ExecucaoProcessor {
  readonly #metricas: MetricasDaExecucao

  constructor(private readonly dependencias: ExecucaoProcessorDependencies) {
    this.#metricas = new MetricasDaExecucao(dependencias.medidor)
  }

  /** O processador de `JobExecutor`, ligado a `ia.executar`. */
  readonly processar: JobProcessor<typeof TIPO_EXECUTAR_IA> & JobProcessor<typeof TIPO_EXECUTAR_LOTE> = async ({ execucaoId }, _execucao: JobExecution, sinalDoJob?: AbortSignal) => {
    const { banco, logger } = this.dependencias
    const escolaId = requireEscolaId()
    const execucoes = new ExecucaoRepository(banco)
    const lida = await execucoes.paraIniciar(execucaoId)
    if (lida === undefined) {
      // Execução de outra escola ou que não existe: o job é defeito, e nada muda.
      logger.warn({ evento: 'ia.execucao.nao_encontrada', execucaoId, escolaId })
      throw new JobFailureError(JobFailureCode.DADOS_INVALIDOS, true)
    }
    // O comando é o da tarefa que a linha diz ter; sem comando registrado, é defeito de montagem e a execução falha em vez de ficar `rodando`.
    const comando = this.#comandoDe(lida.tarefa)
    if (!(await this.#canComecar(execucoes, execucaoId, escolaId, lida, comando))) return
    await this.#run(comando, lida, execucaoId, escolaId, sinalDoJob)
  }

  /** O que vem antes do `rodando`: o `lote` confere a janela e a suspensão, e todos passam pelo `pendente → rodando`. */
  async #canComecar(execucoes: ExecucaoRepository, execucaoId: string, escolaId: string, lida: ExecucaoParaIniciar, comando: ComandoExecutavel | undefined): Promise<boolean> {
    if (comando?.fila === 'lote' && (await this.#antesDeRodarOLote(execucoes, execucaoId, escolaId, lida, comando))) return false
    return this.#comecar(execucoes, execucaoId, escolaId, lida, comando)
  }

  /** A chamada ao modelo, sob o prazo único da execução; a falha vai a `#aoFalhar`. */
  async #run(comando: ComandoExecutavel | undefined, lida: ExecucaoParaIniciar, execucaoId: string, escolaId: string, sinalDoJob: AbortSignal | undefined): Promise<void> {
    const { logger } = this.dependencias
    const inicio = performance.now()
    const prazo = (this.dependencias.prazo ?? prazoPorTemporizador)(PRAZO_DA_EXECUCAO_MS[comando?.perfil ?? 'padrao'])
    const sinal = sinalDoJob === undefined ? prazo.sinal : AbortSignal.any([sinalDoJob, prazo.sinal])
    try {
      if (comando === undefined) throw new InvariantException('a tarefa não tem comando registrado')
      await this.#rodar(comando, lida, execucaoId, escolaId, sinal)
      const duracaoMs = duracaoDesde(inicio)
      const tipo = lida.tarefa
      logger.info({ evento: 'ia.execucao.concluida', execucaoId, escolaId, tipo, duracaoMs })
    } catch (erro) {
      await this.#aoFalhar(erro, { execucaoId, escolaId, tipo: lida.tarefa, inicio, sinalDoJob, prazo: prazo.sinal, comando })
    } finally {
      prazo.cancelar()
    }
  }

  /**
   * O que o `lote` confere **antes** de a execução passar a `rodando`, nesta ordem: a janela letiva da escola (dentro dela o job é adiado até a abertura, `JobAdiadoError` com motivo `janela`, e a execução segue `pendente`: nenhum
   * modelo, nenhuma transição) e a suspensão da função (suspensa, `pendente → falhou FUNCAO_SUSPENSA`, sem modelo e sem consumo). `true` quando o processador deve parar aqui; a janela lança, e a suspensão devolve `true`.
   */
  async #antesDeRodarOLote(execucoes: ExecucaoRepository, execucaoId: string, escolaId: string, lida: ExecucaoParaIniciar, comando: ComandoExecutavel): Promise<boolean> {
    const { janelaDaEscola, relogio, suspensao, logger } = this.dependencias
    // Só a execução `pendente` espera pela janela: a que já terminou, ou está `rodando`, segue para o `#comecar` e para a reentrega.
    if (lida.estado !== 'pendente') return false
    const janela = await janelaDaEscola.daEscola()
    const agora = relogio.agora()
    if (estaNaJanela(janela, agora)) {
      const esperaMs = Math.max(1, proximaAbertura(janela, agora).getTime() - agora.getTime())
      const tipo = lida.tarefa
      logger.info({ evento: 'ia.execucao.adiada_pela_janela', execucaoId, escolaId, tipo, esperaMs })
      this.#metricas.loteAdiado('janela')
      throw new JobAdiadoError(esperaMs, 'janela')
    }
    try {
      await exigirFuncaoAtiva(suspensao, comando.funcao)
    } catch (erro) {
      const codigo = erro instanceof DomainException ? erro.codigo : ErrorCode.ERRO_INTERNO
      // Quem a suspensão não alcançou (a leitura da suspensão que falhou) não termina a execução: o job falha e a reentrega decide.
      if (codigo !== ErrorCode.FUNCAO_SUSPENSA) throw erro
      await execucoes.falharPendente(execucaoId, ErrorCode.FUNCAO_SUSPENSA)
      const tipo = lida.tarefa
      logger.warn({ evento: 'ia.execucao.falhou', execucaoId, escolaId, tipo, codigo })
      return true
    }
    return false
  }

  /**
   * O `pendente → rodando`. `false`: a execução não começa aqui, ou porque a pergunta passou da espera (o corte a encerra, sem modelo e sem troca), ou porque já estava `rodando` ou terminou (a reentrega decide).
   * Só a `interativa` (o Tutor) tem espera máxima: a `ferramenta` e a `normal` esperam a vaga sem corte (RF5).
   */
  async #comecar(execucoes: ExecucaoRepository, execucaoId: string, escolaId: string, lida: ExecucaoParaIniciar, comando: ComandoExecutavel | undefined): Promise<boolean> {
    const espera = comando?.fila === 'interativa' ? ESPERA_MAXIMA_DA_INTERATIVA_SEGUNDOS : undefined
    if (!(await execucoes.marcarRodando(execucaoId, espera))) {
      if (espera !== undefined && (await this.#cortarEspera(execucoes, execucaoId, escolaId, lida))) return false
      await this.#aoReentregar(execucaoId, escolaId, lida)
      return false
    }
    return true
  }

  /**
   * O corte da espera (RF5): a `interativa` que passou de 20 s `pendente` termina `falhou IA_INDISPONIVEL`, **sem modelo** e sem linha em `consumo_ia`, e a troca não conta. O `update` condicional
   * é quem decide (o `GET` disputa o mesmo corte), e só quem recebe a linha soma `ia.espera_estourada`. `false` é a execução que não estava `pendente` ou que ainda cabe na espera.
   */
  async #cortarEspera(execucoes: ExecucaoRepository, execucaoId: string, escolaId: string, lida: ExecucaoParaIniciar): Promise<boolean> {
    if (!(await execucoes.cortarEspera(execucaoId, ESPERA_MAXIMA_DA_INTERATIVA_SEGUNDOS))) return false
    this.#metricas.esperaEstourada(escolaId)
    const tipo = lida.tarefa
    const codigo = ErrorCode.IA_INDISPONIVEL
    this.dependencias.logger.warn({ evento: 'ia.execucao.espera_estourada', execucaoId, escolaId, tipo, codigo })
    return true
  }

  /**
   * A execução já não estava `pendente`: ou terminou (nada a fazer: o job foi entregue de novo), ou está `rodando`, e então a entrega que a pegou morreu ou ainda
   * roda. A decisão é do `update` condicional, e não da leitura de antes (`lida.estado` pode já estar velho): quem encerra recebe a linha, e só ele grava as
   * estimadas (uma por destino), na mesma transação. A gravação que falha desfaz o encerramento e todas as linhas, e a execução segue `rodando` para a varredura.
   */
  async #aoReentregar(execucaoId: string, escolaId: string, lida: ExecucaoParaIniciar): Promise<void> {
    const { logger, banco, destinos, precos = PRECO_DOS_MODELOS } = this.dependencias
    const tipo = lida.tarefa
    let encerrada: boolean
    try {
      encerrada = await banco.transaction(async (tx) => {
        const interrompida = await new ExecucaoRepository(tx).encerrarRodando(execucaoId)
        if (interrompida === undefined) return false
        await new ConsumoRepository(tx).registrarEstimada(interrompida, destinosDaInterrompida(interrompida.tarefa, destinos), precos)
        return true
      })
    } catch (erro) {
      // Só ids: a mensagem do erro do banco não vai ao log (regra 20, item 9).
      logger.warn({ evento: 'ia.execucao.interrupcao_nao_gravada', execucaoId, escolaId, tipo, erro: summarizeError(erro) })
      return
    }
    const codigo = ErrorCode.EXECUCAO_INTERROMPIDA
    if (encerrada) {
      this.#metricas.interrompida(escolaId, 'reentrega')
      logger.warn({ evento: 'ia.execucao.interrompida', execucaoId, escolaId, tipo, codigo })
    } else logger.info({ evento: 'ia.execucao.ja_tratada', execucaoId, escolaId, estado: lida.estado })
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
    // Só o comando da rotina (a classificação do material) roda sem pessoa nem ano: nos outros, a pessoa ausente (desativada, eliminada) ou o ano virado é `NAO_ENCONTRADO`.
    if (lida.quemPediu === undefined && !comando.daRotina) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const contexto: RequestContext = {
      requisicaoId: currentContext()?.requisicaoId ?? randomUUID(),
      escolaId,
      ...(lida.quemPediu === undefined ? {} : { usuarioId: lida.quemPediu.usuarioId, papel: lida.quemPediu.papel, anoLetivoId: lida.quemPediu.anoLetivoId }),
    }
    await runInContext(contexto, async () => {
      // A suspensão se confere de novo: quem suspendeu a função depois do `202` não gasta busca de material nem modelo.
      await exigirFuncaoAtiva(this.dependencias.suspensao, comando.funcao)
      const paraRodar = comando.daRotina ? await new ExecucaoRepository(this.dependencias.banco).paraExecutarDaRotina(execucaoId) : await new ExecucaoDaSessaoRepository(this.dependencias.banco).paraExecutar(execucaoId)
      if (paraRodar === undefined || paraRodar.tarefa !== comando.tarefa) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      await comando.run(paraRodar, this.dependencias.ia, sinal, this.#gravador(execucaoId))
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

  async #aoFalhar(
    erro: unknown,
    { execucaoId, escolaId, tipo, inicio, sinalDoJob, prazo, comando }: { execucaoId: string; escolaId: string; tipo: string; inicio: number; sinalDoJob: AbortSignal | undefined; prazo: AbortSignal; comando: ComandoExecutavel | undefined },
  ): Promise<void> {
    const { logger, banco } = this.dependencias
    if (this.#semFalhaParaGravar(erro, { execucaoId, escolaId, tipo, sinalDoJob })) return
    // O lote não falha por causa do provedor: volta a `pendente` e o job é adiado (a execução que o prazo único estourou, não: `prazo.aborted` vale `IA_TEMPO_ESGOTADO`).
    if (erro instanceof LLMError && adiavelNoLote(erro, comando, prazo)) {
      await this.#adiarOLote(erro, { execucaoId, escolaId, tipo }, 'provedor')
      return
    }
    // O teto de segurança do orçamento do mês (camada-ia, 4.0): só o lote o recebe, e ele espera, sem falhar e sem gastar tentativa, até a virada do mês ou até a Operação subir o teto.
    if (erro instanceof LLMError && adiavelPeloOrcamento(erro, comando)) {
      await this.#adiarOLote(erro, { execucaoId, escolaId, tipo }, 'orcamento')
      return
    }
    // O prazo único estourou pelo próprio sinal: o gateway devolve `IA_TEMPO_ESGOTADO` (ou outro código, se a chamada cedeu antes), e o código é o do prazo.
    const codigo = codigoDaFalha(erro, prazo.aborted)
    // O erro tipado já diz tudo pelo código; o que não é tipado leva o resumo (nome e pilha, nunca a mensagem do provedor).
    const erroDoLog = erro instanceof LLMError || erro instanceof DomainException ? undefined : summarizeError(erro)
    const duracaoMs = duracaoDesde(inicio)
    logger.warn({ evento: 'ia.execucao.falhou', execucaoId, escolaId, tipo, codigo, duracaoMs, erro: erroDoLog })
    // Sem conseguir gravar a falha, a linha fica `rodando` e a varredura a encerra. O gancho do comando (as `falhas_seguidas` da classificação) roda na mesma transação, e só se a execução passou a `falhou` agora.
    await banco
      .transaction(async (tx) => {
        const passou = await new ExecucaoRepository(tx).marcarFalhou(execucaoId, codigo)
        if (passou) await comando?.aoFalharDefinitivo?.(codigo, tx, execucaoId)
        return passou
      })
      .catch((erroAoGravar: unknown) => {
        // Só ids e o código: a mensagem do erro do banco não vai ao log (regra 20, item 9).
        logger.warn({ evento: 'ia.execucao.falha_nao_gravada', execucaoId, escolaId, codigo, erro: summarizeError(erroAoGravar) })
        return false
      })
  }

  /** O que não grava falha nenhuma: o desligamento do worker e o prazo do job abortam o sinal do job, e não a execução (a reentrega decide, 6.0); e a execução que a varredura já encerrou. */
  #semFalhaParaGravar(erro: unknown, { execucaoId, escolaId, tipo, sinalDoJob }: { execucaoId: string; escolaId: string; tipo: string; sinalDoJob: AbortSignal | undefined }): boolean {
    const { logger } = this.dependencias
    if (sinalDoJob?.aborted === true) {
      logger.warn({ evento: 'ia.execucao.abortada', execucaoId, escolaId, tipo })
      return true
    }
    if (erro instanceof ExecucaoJaEncerrada) {
      logger.warn({ evento: 'ia.execucao.encerrada_por_outro', execucaoId, escolaId, tipo })
      return true
    }
    return false
  }

  /**
   * O provedor não atendeu o lote (balde cheio, disjuntor aberto, provedor fora), ou o custo do mês passou do teto de segurança (camada-ia, 4.0): a execução volta a `pendente` e o job é adiado, **sem tentativa**
   * (`JobAdiadoError`, motivo `provedor` ou `orcamento`), e `ia.lote.adiado{motivo}` soma. A espera é a que o balde ou o teto disse (`tenteDeNovoEmSegundos`) ou, sem ela, a do meio-abre do disjuntor; o executor soma o jitter. Se o `update` não achou a execução `rodando` (a varredura a encerrou), não há o que adiar e o job termina.
   */
  async #adiarOLote(erro: LLMError, { execucaoId, escolaId, tipo }: { execucaoId: string; escolaId: string; tipo: string }, motivo: 'provedor' | 'orcamento'): Promise<void> {
    const { logger, banco } = this.dependencias
    const voltou = await new ExecucaoRepository(banco).voltarAPendente(execucaoId).catch((erroAoGravar: unknown) => {
      logger.warn({ evento: 'ia.execucao.volta_nao_gravada', execucaoId, escolaId, erro: summarizeError(erroAoGravar) })
      return false
    })
    if (!voltou) return
    const esperaMs = erro.tenteDeNovoEmSegundos === undefined ? MEIO_ABRE_O_DISJUNTOR_EM_MS : erro.tenteDeNovoEmSegundos * 1_000
    this.#metricas.loteAdiado(motivo)
    // Só ids, a tarefa, o código e a espera: nunca o valor do orçamento, do custo nem da porcentagem (regra 20, item 9).
    const codigo = erro.codigoDeIa
    if (motivo === 'orcamento') logger.warn({ evento: 'ia.lote.adiado_pelo_orcamento', execucaoId, escolaId, tipo, codigo, esperaMs })
    else logger.warn({ evento: 'ia.execucao.adiada_pelo_provedor', execucaoId, escolaId, tipo, codigo, esperaMs })
    throw new JobAdiadoError(esperaMs, motivo)
  }
}

/** O lote que o provedor não atendeu (balde cheio, disjuntor aberto, provedor fora) espera; a soberania é recusa definitiva, e o prazo único estourado vale `IA_TEMPO_ESGOTADO`. */
function adiavelNoLote(erro: LLMError, comando: ComandoExecutavel | undefined, prazo: AbortSignal): boolean {
  return comando?.fila === 'lote' && !prazo.aborted && erro.codigoDeIa === ErrorCode.IA_INDISPONIVEL && erro.motivo !== 'soberania'
}

/** O teto de segurança passou: o lote espera, e nenhuma outra fila recebe esse código (o gateway só o devolve ao `lote`). */
function adiavelPeloOrcamento(erro: LLMError, comando: ComandoExecutavel | undefined): boolean {
  return comando?.fila === 'lote' && erro.codigoDeIa === ErrorCode.IA_ORCAMENTO_ESGOTADO
}

/** O prazo único estourou pelo próprio sinal: o código é o do prazo; senão, o do erro tipado, ou `ERRO_INTERNO`. */
function codigoDaFalha(erro: unknown, prazoEstourou: boolean): ErrorCode {
  if (prazoEstourou) return ErrorCode.IA_TEMPO_ESGOTADO
  return erro instanceof DomainException ? erro.codigo : ErrorCode.ERRO_INTERNO
}
