import { ErrorCode } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { setImmediate as proximaVolta, setTimeout as esperar } from 'node:timers/promises'
import type { ConfiguracaoDoExecutor } from '../config/config-ia.js'
import { executarNoContexto } from '../contexto/contexto.js'
import { ErroDeDominio } from '../erro/erro-de-dominio.js'
import { resumirErro } from '../erro/resumir-erro.js'
import type { LoggerBase } from '../log/logger.js'
import { relogioDoSistema, type Relogio } from '../relogio.js'
import { ErroDeIa } from './erros.js'

export const ESTADOS_DA_EXECUCAO = ['pendente', 'rodando', 'concluida', 'falhou'] as const
export type EstadoDaExecucao = (typeof ESTADOS_DA_EXECUCAO)[number]

/** A execução ficou `pendente` ou `rodando` além do prazo: o processo caiu ou reiniciou no meio dela. */
export const EXECUCAO_INTERROMPIDA = ErrorCode.EXECUCAO_INTERROMPIDA
/** O que `execucao_agente.erro` guarda: um código do contrato, e mais nada. */
export type CodigoDeFalhaDaExecucao = ErrorCode

/** A `execucao_agente` que o `POST` já gravou como `pendente` antes de responder `202`. */
export interface ExecucaoAgendada {
  readonly id: string
  /** Da linha gravada, que nasceu do contexto autenticado. Fora da requisição não há contexto: o escopo viaja aqui. */
  readonly escolaId: string
  /** Chave de idempotência, única por escola (`execucao_agente`). */
  readonly chave: string
}

/**
 * Porta do repositório de execuções. A implementação em Postgres escreve em `execucao_agente`, sempre com
 * `escola_id` na cláusula (regra 10), e resolve a disputa no banco, não com "verifica e depois grava" (regra 80,
 * item 7).
 */
export interface RepositorioDeExecucoes {
  /**
   * `pendente` → `rodando`, numa instrução só (`update … where estado = 'pendente'`), gravando o instante do início.
   * Devolve `false` quando a execução não estava mais `pendente`: outra instância pegou, ela já terminou, ou a
   * varredura a encerrou. Quem recebe `false` não roda.
   */
  marcarRodando(execucao: ExecucaoAgendada): Promise<boolean>
  /** `rodando` → `concluida`, com o resultado (a mensagem ou o `artefatoId`). Não mexe em quem não está `rodando`. */
  marcarConcluida(execucao: ExecucaoAgendada, resultado: unknown): Promise<void>
  /** `rodando` → `falhou`, com o código. Não mexe em quem não está `rodando`. */
  marcarFalhou(execucao: ExecucaoAgendada, codigo: CodigoDeFalhaDaExecucao): Promise<void>
  /**
   * A varredura: toda execução `rodando` iniciada antes de `antesDe`, e toda `pendente` criada antes de `antesDe`,
   * vira `falhou` com `EXECUCAO_INTERROMPIDA`. Devolve quantas. É rotina nossa entre escolas (`@SemEscopo`, regra 10,
   * item 9): não lê conteúdo, só encerra o que o processo que caiu deixou para trás.
   */
  falharInterrompidas(antesDe: Date): Promise<number>
}

/**
 * Roda o trabalho de IA **depois** de a requisição responder. O domínio grava a execução como `pendente`, chama
 * `agendar` e devolve `202`; a tela consulta `GET /v1/execucoes/:id`.
 */
export interface ExecutorDeAgente {
  /**
   * Devolve na hora e nunca lança pelo trabalho. O que `trabalho` devolve é o `resultado` da execução. Ele precisa
   * tolerar reexecução com a mesma chave sem duplicar efeito (D49), e respeitar o `sinal`, que aborta no prazo.
   */
  agendar(execucao: ExecucaoAgendada, trabalho: (sinal: AbortSignal) => Promise<unknown>): void
}

interface NaFila {
  readonly execucao: ExecucaoAgendada
  readonly trabalho: (sinal: AbortSignal) => Promise<unknown>
}

export interface DependenciasDoExecutor {
  readonly repositorio: RepositorioDeExecucoes
  readonly config: ConfiguracaoDoExecutor
  readonly logger?: Pick<LoggerBase, 'info' | 'warn'>
  readonly relogio?: Relogio
}

/** Quantos prazos de execução uma linha pode ficar parada antes de a varredura a encerrar. */
const PRAZOS_ATE_A_VARREDURA = 2

const chaveDe = (execucao: ExecucaoAgendada): string => `${execucao.escolaId}:${execucao.chave}`

function codigoDaFalha(erro: unknown): CodigoDeFalhaDaExecucao {
  if (erro instanceof ErroDeDominio) return erro.codigo
  return 'ERRO_INTERNO'
}

/**
 * O executor da fatia de apresentação: roda **no processo da API, em segundo plano**. É exceção declarada à regra 00,
 * item 4, e à D49 (D77; `docs/mvp-rapido.md`, seção 4, item 1), e vale só enquanto o dado for sintético.
 *
 * O que ele garante mesmo assim: idempotência por chave, teto de execuções por escola e no total (regra 80, item 3),
 * prazo por execução, e nenhuma execução presa em `rodando` depois que o processo cai.
 *
 * TODO(fila): trocar por job do worker. `agendar` passa a publicar um job pelo `Enfileirador` (fila `agentes`,
 * prioridade interativa), com a chave da execução como chave de idempotência; o processador do worker faz o que
 * `rodar` faz aqui. Somem a fila em memória e as vagas deste processo (a vaga por escola já é do despachante,
 * `VagasPorEscola`), e a varredura vira a reconciliação da fila. A interface e o repositório não mudam, e o
 * domínio não percebe a troca.
 */
export class ExecutorNoProcesso implements ExecutorDeAgente {
  private readonly fila: NaFila[] = []
  /** Chaves agendadas ou rodando nesta instância: a segunda chamada com a mesma chave não entra. */
  private readonly emCurso = new Set<string>()
  private readonly rodandoPorEscola = new Map<string, number>()
  private rodando = 0
  private readonly promessas = new Set<Promise<void>>()
  private varredura: NodeJS.Timeout | undefined
  private readonly relogio: Relogio

  constructor(private readonly dependencias: DependenciasDoExecutor) {
    this.relogio = dependencias.relogio ?? relogioDoSistema
  }

  agendar(execucao: ExecucaoAgendada, trabalho: (sinal: AbortSignal) => Promise<unknown>): void {
    const chave = chaveDe(execucao)
    if (this.emCurso.has(chave)) return
    this.emCurso.add(chave)
    this.fila.push({ execucao, trabalho })
    // Na próxima volta do laço de eventos, não nesta: quem agendou termina de responder antes de o trabalho começar.
    setImmediate(() => this.despachar())
  }

  /**
   * Na subida do processo: encerra o que ficou para trás e repete a varredura a cada prazo de execução. Com duas
   * instâncias da API, uma não encerra o que a outra está rodando: só cai o que passou do dobro do prazo, e nenhuma
   * execução viva chega lá, porque o prazo a aborta antes.
   */
  async iniciar(): Promise<void> {
    await this.varrer()
    this.varredura = setInterval(() => void this.varrer(), this.dependencias.config.timeoutMs)
    this.varredura.unref()
  }

  encerrar(): void {
    clearInterval(this.varredura)
    this.varredura = undefined
  }

  /** Nunca lança: banco fora na varredura é aviso no log, e a próxima varredura tenta de novo. */
  async varrer(): Promise<number> {
    const antesDe = new Date(this.relogio.agora().getTime() - PRAZOS_ATE_A_VARREDURA * this.dependencias.config.timeoutMs)
    try {
      const total = await this.dependencias.repositorio.falharInterrompidas(antesDe)
      if (total > 0) this.dependencias.logger?.warn({ evento: 'ia.execucao.interrompidas_encerradas', total })
      return total
    } catch (erro) {
      this.dependencias.logger?.warn({ evento: 'ia.execucao.varredura_falhou', erro: resumirErro(erro) })
      return 0
    }
  }

  /** Para teste e para o desligamento: resolve quando não há nada na fila nem rodando. */
  async ociosa(): Promise<void> {
    while (this.fila.length > 0 || this.promessas.size > 0) {
      if (this.promessas.size > 0) await Promise.all(this.promessas)
      else await proximaVolta()
    }
  }

  /** Dá vaga ao primeiro da fila cuja escola ainda tem vaga: a escola no teto espera, e não segura a de trás. */
  private despachar(): void {
    const { vagasNoTotal, vagasPorEscola } = this.dependencias.config
    while (this.rodando < vagasNoTotal) {
      const indice = this.fila.findIndex((item) => (this.rodandoPorEscola.get(item.execucao.escolaId) ?? 0) < vagasPorEscola)
      const [item] = indice === -1 ? [] : this.fila.splice(indice, 1)
      if (item === undefined) return
      const { escolaId } = item.execucao
      this.rodando += 1
      this.rodandoPorEscola.set(escolaId, (this.rodandoPorEscola.get(escolaId) ?? 0) + 1)
      // Cada execução roda num contexto próprio, só com a escola dela. Sem isso ela herdaria o contexto de quem
      // disparou o despacho, que pode ser a requisição de outra pessoa, de outra escola: a execução que termina é
      // quem chama a próxima da fila. O log sairia com o usuário errado, e um repository com escopo no contexto
      // leria a escola errada.
      const promessa = executarNoContexto({ requisicaoId: randomUUID(), escolaId }, () => this.rodar(item)).finally(() => {
        this.rodando -= 1
        const restantes = (this.rodandoPorEscola.get(escolaId) ?? 1) - 1
        if (restantes === 0) this.rodandoPorEscola.delete(escolaId)
        else this.rodandoPorEscola.set(escolaId, restantes)
        this.emCurso.delete(chaveDe(item.execucao))
        this.promessas.delete(promessa)
        this.despachar()
      })
      this.promessas.add(promessa)
    }
  }

  /** Nunca rejeita: promessa rejeitada sem tratamento derruba o processo (`registrarErrosDoProcesso`). */
  private async rodar({ execucao, trabalho }: NaFila): Promise<void> {
    const inicio = performance.now()
    const execucaoId = execucao.id
    const { escolaId } = execucao
    const controle = new AbortController()
    try {
      // Quem decide se roda é o banco: outra instância, ou uma chamada anterior com a mesma chave, pode ter pegado.
      if (!(await this.dependencias.repositorio.marcarRodando(execucao))) return
      const resultado = await this.comPrazo(trabalho(controle.signal), controle)
      await this.dependencias.repositorio.marcarConcluida(execucao, resultado)
      const duracaoMs = Math.round(performance.now() - inicio)
      this.dependencias.logger?.info({ evento: 'ia.execucao.concluida', execucaoId, escolaId, duracaoMs })
    } catch (erro) {
      const codigo = codigoDaFalha(erro)
      const duracaoMs = Math.round(performance.now() - inicio)
      this.dependencias.logger?.warn({ evento: 'ia.execucao.falhou', execucaoId, escolaId, codigo, duracaoMs, erro: resumirErro(erro) })
      // Sem conseguir gravar a falha, a linha fica `rodando` e a varredura a encerra.
      await this.dependencias.repositorio.marcarFalhou(execucao, codigo).catch(() => undefined)
    }
  }

  /** O prazo aborta o sinal e libera a vaga, mesmo que o trabalho ignore o sinal: o resultado atrasado é descartado. */
  private async comPrazo(trabalho: Promise<unknown>, controle: AbortController): Promise<unknown> {
    const cancelarPrazo = new AbortController()
    const prazo = esperar(this.dependencias.config.timeoutMs, undefined, { signal: cancelarPrazo.signal }).then(() => {
      controle.abort()
      throw new ErroDeIa('IA_TEMPO_ESGOTADO')
    })
    // O trabalho abandonado no prazo pode rejeitar depois: a rejeição tardia já tem dono.
    trabalho.catch(() => undefined)
    try {
      return await Promise.race([trabalho, prazo])
    } finally {
      cancelarPrazo.abort()
      prazo.catch(() => undefined)
    }
  }
}

interface LinhaEmMemoria {
  estado: EstadoDaExecucao
  escolaId: string
  criadaEm: Date
  iniciadaEm?: Date
  resultado?: unknown
  codigo?: CodigoDeFalhaDaExecucao
}

/** Repositório em memória, para teste. A linha nasce com `criarPendente`, como o `POST` faz no banco. */
export class ExecucoesEmMemoria implements RepositorioDeExecucoes {
  private readonly linhas = new Map<string, LinhaEmMemoria>()

  constructor(private readonly relogio: Relogio = relogioDoSistema) {}

  criarPendente(execucao: ExecucaoAgendada): void {
    if (!this.linhas.has(execucao.id)) this.linhas.set(execucao.id, { estado: 'pendente', escolaId: execucao.escolaId, criadaEm: this.relogio.agora() })
  }

  ler(execucaoId: string): Readonly<LinhaEmMemoria> | undefined {
    return this.linhas.get(execucaoId)
  }

  private daEscola(execucao: ExecucaoAgendada): LinhaEmMemoria | undefined {
    const linha = this.linhas.get(execucao.id)
    return linha?.escolaId === execucao.escolaId ? linha : undefined
  }

  async marcarRodando(execucao: ExecucaoAgendada): Promise<boolean> {
    const linha = this.daEscola(execucao)
    if (linha?.estado !== 'pendente') return false
    linha.estado = 'rodando'
    linha.iniciadaEm = this.relogio.agora()
    return true
  }

  async marcarConcluida(execucao: ExecucaoAgendada, resultado: unknown): Promise<void> {
    const linha = this.daEscola(execucao)
    if (linha?.estado !== 'rodando') return
    linha.estado = 'concluida'
    linha.resultado = resultado
  }

  async marcarFalhou(execucao: ExecucaoAgendada, codigo: CodigoDeFalhaDaExecucao): Promise<void> {
    const linha = this.daEscola(execucao)
    if (linha?.estado !== 'rodando') return
    linha.estado = 'falhou'
    linha.codigo = codigo
  }

  async falharInterrompidas(antesDe: Date): Promise<number> {
    let total = 0
    for (const linha of this.linhas.values()) {
      const desde = linha.estado === 'rodando' ? linha.iniciadaEm : linha.estado === 'pendente' ? linha.criadaEm : undefined
      if (desde === undefined || desde >= antesDe) continue
      linha.estado = 'falhou'
      linha.codigo = EXECUCAO_INTERROMPIDA
      total += 1
    }
    return total
  }
}
