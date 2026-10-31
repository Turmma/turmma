import type { ChaveDeFuncao, EstadoDeConsumoDeIa, TarefaDeIa } from '@educa/shared'
import { requireEscolaId } from '../context/context-escola.js'
import { systemClock, type Clock } from '../clock.js'
import { diaDeUso } from '../usage/usage-day.js'
import type { LLMErrorCode } from './errors.js'
import type { Perfil } from './perfis.js'
import type { EnvioDaChamada, OutputSource } from './port.js'

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
  readonly duracaoMs: number
  readonly tentativas: number
  readonly estado: EstadoDeConsumoDeIa
  readonly codigoDeErro?: LLMErrorCode
  readonly em: Date
}

/** Com `envioExterno`, o `provedorId` de quem recebeu o conteúdo; sem ele, nulo (`consumo_ia.provedor`). */
export type ConsumoDeIa = DadosDoConsumo & EnvioDaChamada

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
  consultar(consulta: OrcamentoQuery): Promise<OrcamentoDecision>
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

  async consultar(consulta: OrcamentoQuery): Promise<OrcamentoDecision> {
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
