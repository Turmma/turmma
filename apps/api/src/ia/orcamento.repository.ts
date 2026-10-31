import {
  configuracaoOperacionalEscola,
  diaDeUso,
  execucaoAgente,
  requireEscolaId,
  FUSO_DO_USO,
  mensagemTutor,
  systemClock,
  vinculo,
  type Database,
  type OrcamentoQuery,
  type OrcamentoDecision,
  type OrcamentoDeIa,
  type Clock,
  type DatabaseTransaction,
} from '@educa/core'
import { TROCAS_POR_DIA_PADRAO_DO_TUTOR, TROCAS_POR_MES_PADRAO_DO_TUTOR } from '@educa/shared'
import { and, count, eq, gte, ne, notExists, sql, type SQL } from 'drizzle-orm'

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
 * olhar para ninguém. O contrato ainda não tem teto de IA por escola configurável:
 * fora do Tutor, a consulta permite.
 */
export class OrcamentoRepository implements OrcamentoDeIa {
  constructor(
    private readonly banco: Database | DatabaseTransaction,
    private readonly relogio: Clock = systemClock,
  ) {}

  async consultar(consulta: OrcamentoQuery): Promise<OrcamentoDecision> {
    const escolaId = requireEscolaId()
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
