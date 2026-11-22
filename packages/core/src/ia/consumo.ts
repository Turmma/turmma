import type { ChaveDeFuncao, EstadoDeConsumoDeIa, TarefaDeIa } from '@educa/shared'
import { requireEscolaId } from '../context/context-escola.js'
import { systemClock, type Clock } from '../clock.js'
import { IDENTIDADE_DA_RESERVA_FALSA } from '../config/llm-config.js'
import { diaDeUso } from '../usage/usage-day.js'
import type { ModelAdapter } from './adapter.js'
import type { LLMErrorCode } from './errors.js'
import { EXECUCAO_INTERROMPIDA } from './executor.js'
import { MODELO_FALSO, MODELO_FALSO_MENOR } from './fake-adapter.js'
import type { Perfil } from './perfis.js'
import type { EnvioDaChamada, OutputSource } from './port.js'
import type { FilaDeTokens } from './token-limiter.js'
import type { TaskDefinition } from './task.js'

/**
 * O que toda execução de IA deixa registrado (regra 30, item 4): é o que sustenta a cobrança, o consumo da
 * governança e a resposta à escola quando ela pergunta por que a IA disse algo.
 *
 * `entrada` e `saida` são conteúdo, e **nunca vão para o log** (regra 20, item 9). Em tarefa que leva texto livre de
 * pessoa (`levaTextoLivreDePessoa`: o turno do Tutor e a conversa do professor com o Assistente) elas não vêm: o
 * registro da conversa é `mensagem_tutor` ou `mensagem_agente`, com o dono, o acesso restrito e a retenção de lá
 * (regra 20, item 14; regra 70, item 8), e `consumo_ia`, que a coordenação consulta, não vira uma cópia dela.
 *
 * **Não há `escolaId` aqui**: o registro fica na escola do contexto de quem gastou (`requireEscolaId()`), e a
 * porta não aceita outra (regra 10, item 3).
 */
interface DadosDoConsumo {
  /** Só no Tutor. O id, nunca o nome. */
  readonly alunoId?: string
  readonly execucaoId?: string
  readonly tarefa: TarefaDeIa
  readonly funcao: ChaveDeFuncao
  readonly perfil: Perfil
  readonly origem: OutputSource
  readonly modelo: string
  readonly promptVersao: string
  /** Ausente (nula na tabela) em tarefa que leva texto livre de pessoa. */
  readonly entrada?: unknown
  /** Ausente (nula na tabela) em tarefa que leva texto livre de pessoa, e quando a execução falhou. */
  readonly saida?: unknown
  readonly tokensDeEntrada: number
  readonly tokensDeSaida: number
  /** O custo da chamada em milionésimos de real, pelo preço vigente no instante dela (`custoDaChamada`). Zero onde não há preço (o adaptador falso, o modelo local) e na regra fixa. */
  readonly custoMicros: number
  readonly duracaoMs: number
  readonly tentativas: number
  readonly estado: EstadoDeConsumoDeIa
  /**
   * Verdadeira só na linha de uma chamada que **saiu para o provedor de reserva**, a atendida e a que falhou depois de sair (F5b, 4.0; `consumo_ia.pelo_provedor_de_reserva`, que o `ConsumoRepository` grava desde a 5.0): é o que a Operação conta, as chamadas **enviadas** à reserva.
   * A estimada da execução interrompida leva o provedor da reserva e esta coluna falsa. Ausente vale falsa: só o gateway a escreve, e o escreve sempre.
   */
  readonly peloProvedorDeReserva?: boolean
  /** O código da camada de IA, ou o da execução que o processo caiu no meio dela (`EXECUCAO_INTERROMPIDA`, a linha estimada). */
  readonly codigoDeErro?: LLMErrorCode | typeof EXECUCAO_INTERROMPIDA
  readonly em: Date
}

/**
 * Com `envioExterno`, o `provedorId` de quem recebeu o conteúdo; sem ele, nulo (`consumo_ia.provedor`).
 *
 * A regra da linha da chamada que **saiu** e voltou sem uso: o 429 que sobrou da repetição (`limite`), outro 4xx (`rejeitada`), a conexão recusada, o 5xx e o prazo gravam a estimativa (a
 * entrada contada e a saída no teto da tarefa, ao preço do modelo que a recebeu) e o provedor dela (D14: o custo nunca é subestimado, e o compartilhamento com o aluno diz para onde o pedido foi).
 * Só a chamada que **não saiu** (o balde cheio, o disjuntor aberto) não tem linha de chamada.
 */
export type ConsumoDeIa = DadosDoConsumo & EnvioDaChamada

/** Para onde o adaptador configurado manda o conteúdo: a origem, o envio (externo, e para quem) e o modelo de cada perfil. É o que a linha estimada de uma execução interrompida leva. */
export type DestinoDoAdaptador = Pick<ModelAdapter, 'origem' | 'envio' | 'identidade' | 'modeloDoPerfil'>

/** Da tarefa, só o que a linha estimada lê: o catálogo (`TASK_CATALOG`) as entrega com os tipos de entrada e de saída de cada uma. */
type DadosDaTarefaParaEstimar = Pick<TaskDefinition<never, unknown>, 'nome' | 'funcao' | 'perfil' | 'prompt' | 'maximoDeTokensDeEntrada' | 'maximoDeTokensDeSaida'>

/**
 * O teto da duração que a linha guarda: o maior `integer` do Postgres (`consumo_ia.duracao_ms`), ~24,8 dias. A execução esquecida em `rodando` por mais que isso (a API fora por um
 * mês, uma réplica que nunca voltou) passaria dele, o `insert` falharia com 22003 e a varredura desfaria o lote de todas as outras, a cada volta.
 */
export const DURACAO_MAXIMA_DA_LINHA_MS = 2_147_483_647

/**
 * A linha de consumo de uma execução `rodando` que o processo não terminou (a reentrega, a varredura): o worker caiu, e ninguém sabe se o
 * pedido chegou a sair nem quanto custou. Por isso ela **superestima, nunca subestima** (D14, regra 20, item 19): os tokens são os **dois tetos da
 * tarefa** (o pior pedido válido e o máximo de saída), e o envio é o do adaptador configurado, como se a chamada tivesse saído.
 * Sem `aluno_id` (o freio do dia conta a pergunta, não a linha) e sem `entrada` nem `saida`; a execução a liga ao rastro de quem a pediu.
 */
export function consumoEstimadoDaInterrompida(entrada: { readonly tarefa: DadosDaTarefaParaEstimar; readonly destino: DestinoDoAdaptador; readonly execucaoId: string; readonly duracaoMs: number; readonly em: Date }): ConsumoDeIa {
  const { tarefa, destino, execucaoId, duracaoMs, em } = entrada
  return {
    execucaoId,
    tarefa: tarefa.nome,
    funcao: tarefa.funcao,
    perfil: tarefa.perfil,
    origem: destino.origem,
    modelo: destino.modeloDoPerfil(tarefa.perfil),
    promptVersao: tarefa.prompt.versao,
    tokensDeEntrada: tarefa.maximoDeTokensDeEntrada,
    tokensDeSaida: tarefa.maximoDeTokensDeSaida,
    // O custo da estimada da interrompida, com um destino por linha, é da tarefa 11.0 da camada-ia; até lá ela segue sem custo.
    custoMicros: 0,
    duracaoMs: Math.min(DURACAO_MAXIMA_DA_LINHA_MS, Math.max(0, Math.round(duracaoMs))),
    // Ao menos uma chamada pode ter saído: é a que se estima.
    tentativas: 1,
    estado: 'falhou',
    codigoDeErro: EXECUCAO_INTERROMPIDA,
    ...destino.envio,
    em,
  }
}

/** O preço de um modelo, em milionésimos de real por mil tokens, o mesmo `micros` do `consumo_ia.custo_micros`. */
export interface PrecoDoModelo {
  readonly entradaMicrosPorMilTokens: number
  readonly saidaMicrosPorMilTokens: number
}

/** Um preço e desde quando ele vale: a lista de um modelo cresce, e a linha antiga nunca muda (o custo de uma chamada é o do instante dela). */
export interface VigenciaDePreco extends PrecoDoModelo {
  /** O instante a partir do qual o preço vale, em ISO 8601 com fuso. */
  readonly vigenteDesde: string
  /** De onde o número veio: a página de preços do provedor e a data em que foi lida. */
  readonly fonte: string
}

/** A chave de cada modelo é `provedor:modelo`: o mesmo modelo em dois provedores tem dois preços. O provedor é o `provedorId` do envio, ou a origem do adaptador onde nada sai. */
export type TabelaDePrecos = Readonly<Record<string, readonly VigenciaDePreco[]>>

export function chaveDoPreco(provedor: string, modelo: string): string {
  return `${provedor}:${modelo}`
}

const VIGENCIA_DO_FALSO = '2026-01-01T00:00:00Z'

/**
 * O preço de cada modelo, no código (Joaquim, 20/11/2026): é o que a subida confere e o que `custoDaChamada` lê (D14, regra 30, item 4). A chave é `provedor:modelo` e o valor, a lista das vigências em
 * ordem de data. **Preço novo é uma vigência a mais**, nunca a troca do número: a chamada antiga mantém o custo que gravou, e a seguinte usa o da vigência do seu instante. O **modelo menor** de um perfil
 * (`LLM_MODELO_MENOR_<PERFIL>`, 49.0) só entra se está aqui, e fora de `AMBIENTE=local` o modelo do principal também: sem preço declarado, a subida falha (`createLLMGateway`), para a chamada não gravar custo
 * zero onde há cobrança. Os do adaptador falso custam zero. O modelo real entra com a D37, junto da linha dele em `docs/avaliacao-de-modelos.md`.
 */
export const PRECO_DOS_MODELOS: TabelaDePrecos = {
  [chaveDoPreco('falso', MODELO_FALSO)]: [{ vigenteDesde: VIGENCIA_DO_FALSO, fonte: 'adaptador falso: não há cobrança', entradaMicrosPorMilTokens: 0, saidaMicrosPorMilTokens: 0 }],
  [chaveDoPreco('falso', MODELO_FALSO_MENOR)]: [{ vigenteDesde: VIGENCIA_DO_FALSO, fonte: 'adaptador falso: não há cobrança', entradaMicrosPorMilTokens: 0, saidaMicrosPorMilTokens: 0 }],
  // A reserva falsa (F5b, 1.0): a identidade dela é outra, e a chave do preço também. Preço zero, como o do principal falso.
  [chaveDoPreco(IDENTIDADE_DA_RESERVA_FALSA, MODELO_FALSO)]: [{ vigenteDesde: VIGENCIA_DO_FALSO, fonte: 'adaptador falso da reserva: não há cobrança', entradaMicrosPorMilTokens: 0, saidaMicrosPorMilTokens: 0 }],
}

/** A vigência do `instante`: a mais recente que já começou. Sem preço declarado para a chave, ou só com vigência futura, `undefined`. */
export function precoDoModelo(chave: string, instante: Date, tabela: TabelaDePrecos = PRECO_DOS_MODELOS): VigenciaDePreco | undefined {
  const vigencias = Object.hasOwn(tabela, chave) ? tabela[chave] : undefined
  if (vigencias === undefined) return undefined
  let vigente: VigenciaDePreco | undefined
  for (const vigencia of vigencias) {
    const desde = Date.parse(vigencia.vigenteDesde)
    if (desde <= instante.getTime() && (vigente === undefined || desde > Date.parse(vigente.vigenteDesde))) vigente = vigencia
  }
  return vigente
}

/**
 * O custo da chamada em micros: (entrada × preço da entrada + saída × preço da saída) ÷ 1.000, **arredondado para cima** (D14: o custo nunca é subestimado). A conta é de inteiros, e a divisão por mil
 * se faz pelo resto, para a fração de micro nunca se perder em ponto flutuante. Sem preço (`undefined`), zero.
 */
export function custoDaChamada(tokens: { readonly tokensDeEntrada: number; readonly tokensDeSaida: number }, preco: PrecoDoModelo | undefined): number {
  if (preco === undefined) return 0
  const microsPorMil = tokens.tokensDeEntrada * preco.entradaMicrosPorMilTokens + tokens.tokensDeSaida * preco.saidaMicrosPorMilTokens
  const resto = microsPorMil % 1_000
  return (microsPorMil - resto) / 1_000 + (resto === 0 ? 0 : 1)
}

/** Porta do registro. A implementação em Postgres grava em `consumo_ia`, na escola do contexto. */
export interface RegistroDeConsumo {
  registrar(consumo: ConsumoDeIa): Promise<void>
}

/** A escola consultada é a do contexto de quem pergunta, e não vem na consulta (regra 10, item 3). */
export interface OrcamentoQuery {
  readonly funcao: ChaveDeFuncao
  /** Presente no Tutor: além do teto da escola, vale o freio diário do aluno (D38). */
  readonly alunoId?: string
  /** Presente no Tutor: a turma cujo pacote do mês é conferido (D38). */
  readonly turmaId?: string
  /**
   * A execução que está perguntando, quando a consulta é feita de dentro dela: a pergunta dela mesma já está gravada
   * e não conta contra ela. Na consulta feita antes de gravar (o `POST` do Tutor), não vem.
   */
  readonly execucaoId?: string
  /**
   * A fila de onde o pedido vem (camada-ia, 4.0; Tech Spec §5, "O teto de segurança"): **só a `lote` é conferida contra o teto de segurança do orçamento do mês**. O Tutor, a ferramenta e o `normal`
   * nunca esperam pelo orçamento (D38, D40). Sem ela vale a `normal`, como no limitador de tokens.
   */
  readonly fila?: FilaDeTokens
}

/** Por que não pode gastar: o teto da escola, o freio diário do aluno ou o pacote do mês da turma. */
export type OrcamentoCode = 'IA_ORCAMENTO_ESGOTADO' | 'LIMITE_DIARIO_DO_TUTOR' | 'PACOTE_DO_TUTOR_ESGOTADO'

export type OrcamentoDecision =
  | { readonly permitido: true }
  | { readonly permitido: false; readonly codigo: OrcamentoCode; readonly tenteDeNovoEmSegundos?: number }

/**
 * Porta do orçamento, consultada **antes** de gastar (D14). Os tetos são configuração por escola e por rede, nunca
 * constante no código (D41): quem os conhece é a implementação, não o provedor.
 */
export interface OrcamentoDeIa {
  check(consulta: OrcamentoQuery): Promise<OrcamentoDecision>
}

/** O que o registro em memória guarda: o consumo e a escola do contexto em que ele foi registrado. */
export type InMemoryRecord = ConsumoDeIa & { readonly escolaId: string }

/** Registro em memória, para teste e para a demonstração enquanto `consumo_ia` não está ligada. Sem escola no contexto, lança. */
export class InMemoryConsumo implements RegistroDeConsumo {
  readonly registros: InMemoryRecord[] = []

  async registrar(consumo: ConsumoDeIa): Promise<void> {
    this.registros.push({ ...consumo, escolaId: requireEscolaId() })
  }
}

export interface InMemoryOrcamentoLimits {
  /** Tokens de entrada e saída somados, por escola, no mês corrente. Sem valor, não há teto. */
  readonly tokensPorEscolaNoMes?: number
  /** Trocas do Tutor por aluno no dia (o freio da D38). Sem valor, não há freio. */
  readonly trocasPorAlunoNoDia?: number
}

/** Orçamento em memória, lido do registro em memória, da escola do contexto. O dia e o mês viram no fuso do uso, como o resto do sistema. */
export class InMemoryOrcamento implements OrcamentoDeIa {
  constructor(
    private readonly consumo: InMemoryConsumo,
    private readonly limites: InMemoryOrcamentoLimits = {},
    private readonly relogio: Clock = systemClock,
  ) {}

  async check(consulta: OrcamentoQuery): Promise<OrcamentoDecision> {
    const escolaId = requireEscolaId()
    const hoje = diaDeUso(this.relogio.agora())
    const mes = hoje.slice(0, 7)
    const daEscola = this.consumo.registros.filter((registro) => registro.escolaId === escolaId)
    if (this.limites.tokensPorEscolaNoMes !== undefined) {
      const gastos = daEscola
        .filter((registro) => diaDeUso(registro.em).startsWith(mes))
        .reduce((soma, registro) => soma + registro.tokensDeEntrada + registro.tokensDeSaida, 0)
      if (gastos >= this.limites.tokensPorEscolaNoMes) return { permitido: false, codigo: 'IA_ORCAMENTO_ESGOTADO' }
    }
    if (consulta.alunoId !== undefined && this.limites.trocasPorAlunoNoDia !== undefined) {
      const trocas = daEscola.filter(
        (registro) => registro.alunoId === consulta.alunoId && registro.funcao === consulta.funcao && registro.estado === 'concluida' && diaDeUso(registro.em) === hoje,
      ).length
      if (trocas >= this.limites.trocasPorAlunoNoDia) return { permitido: false, codigo: 'LIMITE_DIARIO_DO_TUTOR' }
    }
    return { permitido: true }
  }
}
