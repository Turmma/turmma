import type { ChaveDeFuncao } from '@educa/shared'
import type { LLMConfig } from '../config/config-ia.js'
import { InvalidConfigError } from '../config/validar-config.js'
import { currentContext } from '../contexto/contexto.js'
import { summarizeError } from '../erro/resumir-erro.js'
import type { LoggerBase } from '../log/logger.js'
import { systemClock, type Clock } from '../relogio.js'
import type { ModelAdapter, RepairHint } from './adaptador.js'
import { FakeAdapter } from './adaptador-falso.js'
import { OpenAICompatAdapter } from './adaptador-openai-compat.js'
import { ResilientAdapter } from './adaptador-resiliente.js'
import type { ConsumoDeIa, OrcamentoDeIa, RegistroDeConsumo } from './consumo.js'
import { LLMError, type LLMErrorCode } from './erros.js'
import { semMarcacao } from './limpar-saida.js'
import { SEM_ENVIO_EXTERNO, type LLMProvider, type GenerationMeasurement, type GenerationRequest, type GenerationResult } from './porta.js'
import { exigirFuncaoAtiva, type SuspensaoDeFuncao } from './suspensao.js'
import type { TaskDefinition } from './tarefa.js'

/** O que o provedor escreve no log: evento fixo, ids, duração. Nunca entrada, saída nem prompt (regra 20, item 9). */
export type LLMLogger = Pick<LoggerBase, 'info' | 'warn'>

export interface LLMGatewayDependencies {
  readonly adaptador: ModelAdapter
  readonly registro: RegistroDeConsumo
  readonly orcamento: OrcamentoDeIa
  readonly suspensao: SuspensaoDeFuncao
  readonly logger?: LLMLogger
  readonly relogio?: Clock
}

/** Funções cujo gasto é de um aluno: sem `alunoId` não há como consultar o freio dele, e a chamada é recusada. */
const FUNCOES_COM_ORCAMENTO_POR_ALUNO: ReadonlySet<ChaveDeFuncao> = new Set<ChaveDeFuncao>(['tutor_com_o_aluno'])

/** Uma primeira chamada e uma repetição, dizendo ao modelo o que veio errado. Depois disso é erro tipado. */
const TENTATIVAS_MAXIMAS = 2
const PROBLEMAS_MAXIMOS_NA_REPETICAO = 8
export const MODELO_DA_REGRA_FIXA = 'regra_fixa'

type Interpretacao<Saida> =
  | { readonly ok: true; readonly saida: Saida }
  // `naConferencia`: o JSON e o schema passaram, e quem reprovou foi a conferência da tarefa (o conteúdo, não a forma).
  | { readonly ok: false; readonly problemas: readonly string[]; readonly naConferencia?: boolean }

/** Do texto do modelo à saída que o domínio pode usar: JSON, schema, ajuste e conferência da tarefa, nesta ordem. */
function interpretar<Entrada, Saida>(tarefa: TaskDefinition<Entrada, Saida>, entrada: Entrada, texto: string): Interpretacao<Saida> {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    return { ok: false, problemas: ['A resposta não é um JSON válido: veio texto fora do objeto, ou o objeto veio cortado.'] }
  }
  // A tela mostra o texto como texto: a marcação que o modelo põe por hábito sai antes de validar.
  const limpo = semMarcacao(bruto)
  return validar(tarefa, entrada, tarefa.prepararResposta?.(entrada, limpo) ?? limpo)
}

function validar<Entrada, Saida>(tarefa: TaskDefinition<Entrada, Saida>, entrada: Entrada, bruto: unknown): Interpretacao<Saida> {
  const lida = tarefa.esquemaDeSaida.safeParse(bruto)
  if (!lida.success) {
    const problemas = lida.error.issues.slice(0, PROBLEMAS_MAXIMOS_NA_REPETICAO).map((problema) => `${problema.path.join('.') || 'resposta'}: ${problema.message}`)
    return { ok: false, problemas }
  }
  const saida = tarefa.ajustar?.(entrada, lida.data) ?? lida.data
  const problemas = tarefa.conferir?.(entrada, saida) ?? []
  return problemas.length === 0 ? { ok: true, saida } : { ok: false, problemas: problemas.slice(0, PROBLEMAS_MAXIMOS_NA_REPETICAO), naConferencia: true }
}

interface Gasto {
  modelo: string
  tokensDeEntrada: number
  tokensDeSaida: number
  tentativas: number
}

/**
 * A implementação da porta, igual para todo adaptador. Em toda chamada, nesta ordem: valida a entrada, confere se a
 * escola suspendeu a função, consulta o orçamento (salvo na resposta de regra fixa), chama o modelo (o prazo e a repetição do que não cobrou são do `ResilientAdapter`), valida a saída (repetindo uma vez),
 * registra o consumo e escreve o log.
 *
 * Nada que não foi registrado é devolvido: se o registro falhar, a chamada falha (regra 30, item 4).
 */
export class LLMGateway implements LLMProvider {
  private readonly relogio: Clock

  constructor(private readonly dependencias: LLMGatewayDependencies) {
    this.relogio = dependencias.relogio ?? systemClock
  }

  async gerar<Entrada, Saida>(pedido: GenerationRequest<Entrada, Saida>): Promise<GenerationResult<Saida>> {
    const { tarefa } = pedido
    const { adaptador } = this.dependencias
    const inicio = performance.now()
    // O conteúdo de tarefa que leva texto livre de pessoa (aluno ou professor) não entra no registro de consumo: o
    // registro dele é a conversa, que tem dono, acesso restrito e retenção.
    const conteudo = <Conteudo extends object>(campos: Conteudo): Conteudo | Record<string, never> => (tarefa.levaTextoLivreDePessoa ? {} : campos)

    // A escola do pedido é a de quem está pedindo. Com contexto de escola (a requisição, ou a execução em segundo
    // plano), pedir em nome de outra escola é defeito de quem chamou: recusa antes de consultar, gastar ou registrar
    // na escola errada (regra 10, item 3). Sem escola no contexto não há com o que comparar aqui, e quem recusa é a porta
    // da suspensão, logo abaixo, que lê a escola do contexto e falha fechada (`IA_INDISPONIVEL`): nada executa, nem
    // consulta orçamento, nem registra consumo.
    const escolaDoContexto = currentContext()?.escolaId
    if (escolaDoContexto !== undefined && escolaDoContexto !== pedido.escolaId) {
      const tipo = tarefa.nome
      this.dependencias.logger?.warn({ evento: 'ia.geracao.escola_fora_do_contexto', tipo })
      throw new LLMError('IA_ENTRADA_INVALIDA')
    }

    // Entrada fora do schema é erro de quem chamou, antes de qualquer gasto: chave a mais (um nome) para aqui.
    const lida = tarefa.esquemaDeEntrada.safeParse(pedido.entrada)
    if (!lida.success || (FUNCOES_COM_ORCAMENTO_POR_ALUNO.has(tarefa.funcao) && pedido.alunoId === undefined)) {
      this.avisar(pedido, 'IA_ENTRADA_INVALIDA', inicio, 0)
      throw new LLMError('IA_ENTRADA_INVALIDA')
    }
    const entrada = lida.data

    // Função suspensa pela escola não executa nada: nem modelo, nem regra fixa, nem consulta de orçamento (D60).
    try {
      await exigirFuncaoAtiva(this.dependencias.suspensao, tarefa.funcao)
    } catch (erro) {
      this.avisar(pedido, erro instanceof LLMError ? erro.codigoDeIa : 'IA_INDISPONIVEL', inicio, 0)
      throw erro
    }
    // A resposta de regra fixa não gasta modelo e não passa pelo orçamento: o aluno que escreve sobre um assunto
    // delicado recebe a mensagem com o 188 mesmo no fim do freio do dia (D36).
    const fixa = tarefa.semModelo?.(entrada)
    if (fixa === undefined) await this.exigirOrcamento(pedido, inicio)

    const gasto: Gasto = { modelo: adaptador.modeloDoPerfil(tarefa.perfil), tokensDeEntrada: 0, tokensDeSaida: 0, tentativas: 0 }
    let saida: Saida
    try {
      saida = fixa === undefined ? await this.chamarAteValer(pedido, entrada, gasto) : this.exigirSaidaFixa(tarefa, entrada, fixa)
    } catch (erro) {
      const codigo: LLMErrorCode = erro instanceof LLMError ? erro.codigoDeIa : 'IA_INDISPONIVEL'
      // Erro que não é da camada é defeito nosso (na versão determinística, na conferência): fica o resumo, sem mensagem.
      if (!(erro instanceof LLMError)) this.dependencias.logger?.warn({ evento: 'ia.geracao.erro_inesperado', erro: summarizeError(erro) })
      const medicao = this.medir(pedido, gasto, inicio, false)
      // O registro da falha é o melhor possível: se ele também falhar, o erro que sobe continua sendo o da chamada.
      await this.dependencias.registro.registrar(this.consumo(pedido, medicao, { ...conteudo({ entrada }), estado: 'falhou', codigoDeErro: codigo })).catch(() => undefined)
      this.avisar(pedido, codigo, inicio, gasto.tentativas)
      throw erro instanceof LLMError ? erro : new LLMError('IA_INDISPONIVEL')
    }

    const medicao = this.medir(pedido, gasto, inicio, fixa !== undefined)
    try {
      await this.dependencias.registro.registrar(this.consumo(pedido, medicao, { ...conteudo({ entrada, saida }), estado: 'concluida' }))
    } catch {
      this.avisar(pedido, 'IA_INDISPONIVEL', inicio, gasto.tentativas)
      throw new LLMError('IA_INDISPONIVEL')
    }
    const tipo = tarefa.nome
    const { duracaoMs, tentativas } = medicao
    this.dependencias.logger?.info({ evento: 'ia.geracao.concluida', tipo, escolaId: pedido.escolaId, execucaoId: pedido.execucaoId, duracaoMs, tentativas })
    return { saida, medicao }
  }

  /** Sem conseguir consultar o orçamento, não se gasta: a falha da consulta fecha a porta, não abre. */
  private async exigirOrcamento<Entrada, Saida>(pedido: GenerationRequest<Entrada, Saida>, inicio: number): Promise<void> {
    let codigo: LLMErrorCode | undefined
    let tenteDeNovoEmSegundos: number | undefined
    try {
      const decisao = await this.dependencias.orcamento.consultar({
        funcao: pedido.tarefa.funcao,
        ...(pedido.alunoId === undefined ? {} : { alunoId: pedido.alunoId }),
        ...(pedido.turmaId === undefined ? {} : { turmaId: pedido.turmaId }),
        ...(pedido.execucaoId === undefined ? {} : { execucaoId: pedido.execucaoId }),
      })
      if (!decisao.permitido) {
        codigo = decisao.codigo
        tenteDeNovoEmSegundos = decisao.tenteDeNovoEmSegundos
      }
    } catch {
      codigo = 'IA_INDISPONIVEL'
    }
    if (codigo === undefined) return
    this.avisar(pedido, codigo, inicio, 0)
    throw new LLMError(codigo, tenteDeNovoEmSegundos)
  }

  /** A regra fixa também passa pelo schema e pela conferência: texto nosso com defeito não chega a ninguém. */
  private exigirSaidaFixa<Entrada, Saida>(tarefa: TaskDefinition<Entrada, Saida>, entrada: Entrada, fixa: Saida): Saida {
    const validada = validar(tarefa, entrada, fixa)
    if (!validada.ok) throw new LLMError('IA_SAIDA_INVALIDA')
    return validada.saida
  }

  private async chamarAteValer<Entrada, Saida>(pedido: GenerationRequest<Entrada, Saida>, entrada: Entrada, gasto: Gasto): Promise<Saida> {
    const { tarefa } = pedido
    let correcao: RepairHint | undefined
    let reprovadaNaConferencia = false
    let problemasDaUltima: readonly string[] = []
    while (gasto.tentativas < TENTATIVAS_MAXIMAS) {
      gasto.tentativas += 1
      // O prazo da chamada é do `ResilientAdapter`, que sabe o do perfil. O sinal de quem chamou (o executor) o cancela.
      const sinal = pedido.sinal ?? new AbortController().signal
      const resposta = await this.dependencias.adaptador.chamar({ tarefa, entrada, sinal, ...(correcao === undefined ? {} : { correcao }) })
      gasto.modelo = resposta.modelo
      gasto.tokensDeEntrada += resposta.tokensDeEntrada
      gasto.tokensDeSaida += resposta.tokensDeSaida
      const interpretada = interpretar(tarefa, entrada, resposta.texto)
      if (interpretada.ok) return interpretada.saida
      correcao = { respostaAnterior: resposta.texto, problemas: interpretada.problemas }
      reprovadaNaConferencia = interpretada.naConferencia === true
      problemasDaUltima = interpretada.problemas
    }
    // Só quando o modelo respondeu na forma certa e errou no conteúdo: modelo que devolve lixo continua sendo falha.
    const reserva = reprovadaNaConferencia ? tarefa.reservaQuandoInvalida?.(entrada, problemasDaUltima) : undefined
    if (reserva !== undefined) {
      const validada = validar(tarefa, entrada, reserva)
      if (validada.ok) {
        const tipo = tarefa.nome
        this.dependencias.logger?.info({ evento: 'ia.geracao.reserva', tipo, escolaId: pedido.escolaId, execucaoId: pedido.execucaoId, tentativas: gasto.tentativas })
        return validada.saida
      }
    }
    throw new LLMError('IA_SAIDA_INVALIDA')
  }

  private medir<Entrada, Saida>(pedido: GenerationRequest<Entrada, Saida>, gasto: Gasto, inicio: number, regraFixa: boolean): GenerationMeasurement {
    const { adaptador } = this.dependencias
    return {
      origem: regraFixa ? 'regra_fixa' : adaptador.origem,
      perfil: pedido.tarefa.perfil,
      modelo: regraFixa ? MODELO_DA_REGRA_FIXA : gasto.modelo,
      promptVersao: pedido.tarefa.prompt.versao,
      tokensDeEntrada: gasto.tokensDeEntrada,
      tokensDeSaida: gasto.tokensDeSaida,
      duracaoMs: Math.round(performance.now() - inicio),
      tentativas: gasto.tentativas,
      // Só há envio externo se alguma chamada chegou a sair para um provedor de fora, e então o provedor vai junto. A regra
      // fixa não chama ninguém: as tentativas ficam em 0, e é isso que a deixa sem envio.
      ...(gasto.tentativas > 0 ? adaptador.envio : SEM_ENVIO_EXTERNO),
    }
  }

  private consumo<Entrada, Saida>(
    pedido: GenerationRequest<Entrada, Saida>,
    medicao: GenerationMeasurement,
    resultado: Pick<ConsumoDeIa, 'entrada' | 'saida' | 'estado' | 'codigoDeErro'>,
  ): ConsumoDeIa {
    return {
      // O aluno só entra no consumo das funções que são dele (o Tutor): nas outras, o consumo não tem pessoa (D64).
      ...(pedido.alunoId === undefined || !FUNCOES_COM_ORCAMENTO_POR_ALUNO.has(pedido.tarefa.funcao) ? {} : { alunoId: pedido.alunoId }),
      ...(pedido.execucaoId === undefined ? {} : { execucaoId: pedido.execucaoId }),
      tarefa: pedido.tarefa.nome,
      funcao: pedido.tarefa.funcao,
      ...medicao,
      ...resultado,
      em: this.relogio.agora(),
    }
  }

  /** A tarefa fixa a função e o perfil: o `tipo` no log diz os dois. */
  private avisar<Entrada, Saida>(pedido: GenerationRequest<Entrada, Saida>, codigo: LLMErrorCode, inicio: number, tentativas: number): void {
    const tipo = pedido.tarefa.nome
    const duracaoMs = Math.round(performance.now() - inicio)
    this.dependencias.logger?.warn({ evento: 'ia.geracao.falhou', tipo, codigo, escolaId: pedido.escolaId, execucaoId: pedido.execucaoId, duracaoMs, tentativas })
  }
}

export interface LLMGatewayPorts {
  readonly registro: RegistroDeConsumo
  readonly orcamento: OrcamentoDeIa
  readonly suspensao: SuspensaoDeFuncao
  readonly logger?: LLMLogger
  readonly relogio?: Clock
}

/**
 * Monta a porta a partir da configuração: é aqui, e só aqui, que `IA_ADAPTADOR` escolhe o adaptador, e que ele ganha o
 * prazo por perfil, a repetição e o disjuntor.
 */
export function createLLMGateway(config: LLMConfig, portas: LLMGatewayPorts): LLMProvider {
  if (config.adaptador === 'openai_compat' && config.modelo === undefined) throw new InvalidConfigError(['LLM_BASE_URL', 'LLM_MODELO'])
  // A latência simulada é só do adaptador falso (teste de carga, regra 80, item 11): o do provedor tem a do provedor.
  const interno =
    config.modelo === undefined ? new FakeAdapter(config.latenciaFalsaMs === undefined ? {} : { latenciaMs: config.latenciaFalsaMs }) : new OpenAICompatAdapter(config.modelo)
  const adaptador = new ResilientAdapter(interno, { prazosMs: config.prazosMs, recuoMs: config.recuoMs, aleatorio: Math.random })
  return new LLMGateway({ adaptador, ...portas })
}
