import {
  configuracaoOperacionalEscola,
  diaDeUso,
  execucaoAgente,
  requireEscolaId,
  FUSO_DO_USO,
  mensagemTutor,
  OrcamentoDoMesRepository,
  systemClock,
  vinculo,
  type Database,
  type OrcamentoQuery,
  type OrcamentoDecision,
  type OrcamentoDeIa,
  type Clock,
  type DatabaseTransaction,
} from '@educa/core'
import { diaDeSaoPaulo, FUSO_DO_ORCAMENTO, mesDeSaoPaulo, TROCAS_POR_DIA_PADRAO_DO_TUTOR, TROCAS_POR_MES_PADRAO_DO_TUTOR } from '@educa/shared'
import { and, count, eq, gte, ne, notExists, sql, type SQL } from 'drizzle-orm'

/** A espera máxima, em segundos, do lote adiado pelo teto: de hora em hora ele confere de novo, e assim vê o teto que a Operação subiu sem esperar a virada do mês. */
export const ESPERA_MAXIMA_DO_TETO_SEGUNDOS = 3_600

const SEGUNDOS_DO_DIA = 86_400

const formatadorDaHora = new Intl.DateTimeFormat('en-GB', { timeZone: FUSO_DO_ORCAMENTO, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' })

/**
 * Quantos segundos faltam, em São Paulo, para o mês virar (a meia-noite do dia 1), arredondado para cima. O mês e o dia são os do orçamento (`mesDeSaoPaulo`, `diaDeSaoPaulo`), e o
 * relógio da parede vem do fuso, nunca de um deslocamento fixo.
 */
export function segundosAteAViradaDoMes(agora: Date): number {
  const [ano = 0, mes = 0, dia = 0] = diaDeSaoPaulo(agora).split('-').map(Number)
  const diasDoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  const [hora = 0, minuto = 0, segundo = 0] = formatadorDaHora.format(agora).split(':').map(Number)
  const desdeAMeiaNoite = hora * 3_600 + minuto * 60 + segundo
  const faltamMs = ((diasDoMes - dia + 1) * SEGUNDOS_DO_DIA - desdeAMeiaNoite) * 1_000 - agora.getUTCMilliseconds()
  return Math.ceil(faltamMs / 1_000)
}

/**
 * A porta `OrcamentoDeIa`: o freio diário do aluno e o pacote do mês da turma no Tutor (D38), com os limites da
 * configuração da escola (`configuracao_operacional_escola`; nulo vale o padrão do contrato; D41).
 *
 * **O que conta como troca, nos dois limites: a pergunta do aluno, em `mensagem_tutor`, cuja execução não falhou.**
 * - A pergunta que o modelo não conseguiu responder não gasta o dia do aluno nem o mês da turma: quando a execução
 *   termina `falhou`, a pergunta deixa de contar.
 * - A pergunta ainda em andamento conta: quem manda dez de uma vez não passa do freio.
 * - A mesma linha serve ao dia (por aluno) e ao mês (por turma), que `consumo_ia` não saberia somar: ele não tem turma.
 *
 * A escola é a do contexto de quem pediu, lida **antes** de qualquer retorno (`requireEscolaId()`): a consulta não
 * a recebe, e sem escola no contexto lança até para a função que não é o Tutor, que de outro modo seria permitida sem
 * olhar para ninguém.
 *
 * **O teto de segurança** (camada-ia, 4.0; Tech Spec §5; D40): a consulta da fila `lote` é a única conferida contra o custo do mês. Com o orçamento `definido` e o custo **acima** (`>`, nunca `>=`) de
 * orçamento × teto ÷ 100, ela volta `IA_ORCAMENTO_ESGOTADO`, com `tenteDeNovoEmSegundos` = o menor entre o que falta para a virada do mês de São Paulo e 3.600; o processador adia o job (motivo `orcamento`)
 * em vez de falhá-lo. Escola `sem_orcamento` ou `sem_aluno_ativo` nunca é segurada: orçamento zero não é teto zero. Fora do lote e do Tutor, a consulta permite: o Tutor, a ferramenta e o `normal` nunca esperam
 * por orçamento (D38).
 */
export class OrcamentoRepository implements OrcamentoDeIa {
  constructor(
    private readonly banco: Database | DatabaseTransaction,
    private readonly relogio: Clock = systemClock,
  ) {}

  async check(consulta: OrcamentoQuery): Promise<OrcamentoDecision> {
    const escolaId = requireEscolaId()
    if (consulta.fila === 'lote') return this.#tetoDeSeguranca()
    if (consulta.funcao !== 'tutor_com_o_aluno' || consulta.alunoId === undefined) return { permitido: true }
    const { alunoId, turmaId } = consulta
    const [limites] = await this.banco
      .select({ porDia: configuracaoOperacionalEscola.tutorTrocasPorDia, porMes: configuracaoOperacionalEscola.tutorTrocasPorMes })
      .from(configuracaoOperacionalEscola)
      .where(eq(configuracaoOperacionalEscola.escolaId, escolaId))

    // O dia e o mês viram no fuso do uso, como o resto do sistema: a pergunta das 23h59 de São Paulo é de hoje.
    const hoje = diaDeUso(this.relogio.agora())
    const trocasHoje = await this.trocas(escolaId, consulta, eq(mensagemTutor.alunoId, alunoId), hoje)
    if (trocasHoje >= (limites?.porDia ?? TROCAS_POR_DIA_PADRAO_DO_TUTOR)) return { permitido: false, codigo: 'LIMITE_DIARIO_DO_TUTOR' }

    if (turmaId === undefined) return { permitido: true }
    // O pacote é por aluno, somado na turma: quem precisa mais usa o saldo de quem usou menos.
    const [turma] = await this.banco
      .select({ alunos: count() })
      .from(vinculo)
      .where(and(eq(vinculo.escolaId, escolaId), eq(vinculo.turmaId, turmaId), eq(vinculo.papel, 'aluno'), eq(vinculo.estado, 'confirmado')))
    const pacote = (limites?.porMes ?? TROCAS_POR_MES_PADRAO_DO_TUTOR) * Math.max(1, turma?.alunos ?? 0)
    const trocasNoMes = await this.trocas(escolaId, consulta, eq(mensagemTutor.turmaId, turmaId), `${hoje.slice(0, 7)}-01`)
    return trocasNoMes >= pacote ? { permitido: false, codigo: 'PACOTE_DO_TUTOR_ESGOTADO' } : { permitido: true }
  }

  /** O lote contra o teto de segurança do mês corrente de São Paulo, pela escola do contexto: o custo gravado, o orçamento de hoje e o teto vigente, pelo `OrcamentoDoMesRepository`. */
  async #tetoDeSeguranca(): Promise<OrcamentoDecision> {
    const agora = this.relogio.agora()
    const orcamento = await new OrcamentoDoMesRepository(this.banco).doMes(mesDeSaoPaulo(agora), agora)
    // Sem orçamento (`sem_orcamento`, `sem_aluno_ativo`) o orçamento é nulo: orçamento zero não é teto zero, e o lote segue.
    const { orcamentoMicros, tetoPercentual, custoMicros } = orcamento
    if (orcamentoMicros === null || tetoPercentual === null) return { permitido: true }
    // Inteiros de ponta a ponta: `>` exato, sem a fração de micro que o ponto flutuante perderia.
    const acimaDoTeto = BigInt(custoMicros) * 100n > BigInt(orcamentoMicros) * BigInt(tetoPercentual)
    if (!acimaDoTeto) return { permitido: true }
    return { permitido: false, codigo: 'IA_ORCAMENTO_ESGOTADO', tenteDeNovoEmSegundos: Math.min(segundosAteAViradaDoMes(agora), ESPERA_MAXIMA_DO_TETO_SEGUNDOS) }
  }

  /** As perguntas de aluno desde o começo do dia `desde`, na escola, de quem o filtro disser, fora as que falharam e a de quem está perguntando. */
  private async trocas(escolaId: string, consulta: OrcamentoQuery, deQuem: SQL | undefined, desde: string): Promise<number> {
    const falhou = this.banco
      .select({ id: execucaoAgente.id })
      .from(execucaoAgente)
      .where(and(eq(execucaoAgente.escolaId, mensagemTutor.escolaId), eq(execucaoAgente.id, mensagemTutor.execucaoId), eq(execucaoAgente.estado, 'falhou')))
    const [linha] = await this.banco
      .select({ total: count() })
      .from(mensagemTutor)
      .where(
        and(
          eq(mensagemTutor.escolaId, escolaId),
          deQuem,
          eq(mensagemTutor.autor, 'aluno'),
          gte(mensagemTutor.criadaEm, sql`(${desde}::date)::timestamp at time zone ${FUSO_DO_USO}`),
          consulta.execucaoId === undefined ? undefined : ne(mensagemTutor.execucaoId, consulta.execucaoId),
          notExists(falhou),
        ),
      )
    return linha?.total ?? 0
  }
}
