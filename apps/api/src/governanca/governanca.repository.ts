import {
  artefato,
  configuracaoOperacionalEscola,
  consumoIa,
  contextoAtual,
  entrega,
  execucaoAgente,
  exigirEscolaDoContexto,
  FUSO_DO_USO,
  mensagemTutor,
  serie,
  sessaoDaRequisicao,
  suspensaoDeFuncao,
  turma,
  vinculo,
  type Banco,
  type TransacaoBanco,
} from '@educa/nucleo'
import { GRUPO_MINIMO_DE_PROFESSORES, type ChaveDeFuncao, type ResumoDaGovernancaQuery, type EstadoDeEntrega, type Etapa, type MotivoDeSuspensao, type TipoDeEntrega } from '@educa/shared'
import { and, count, desc, eq, gte, isNull, lt, notExists, sql, type SQL } from 'drizzle-orm'

/** Os quatro números da governança, na escola e no ano letivo do contexto. */
export interface NumerosDaGovernanca {
  readonly geradoPorIa: number
  readonly aprovadoPorPessoa: number
  readonly rejeitado: number
  readonly esperando: number
}

/** Uma entrega como a governança a mostra: sem turma, sem quem decidiu, sem título e sem justificativa. */
export interface EntregaDaGovernanca {
  readonly id: string
  readonly funcao: ChaveDeFuncao
  readonly tipo: TipoDeEntrega
  readonly estado: EstadoDeEntrega
  readonly criadaEm: Date
  readonly decididaEm: Date | null
  readonly serieId: string
  readonly etapa: Etapa
  readonly ano: number
}

/** O consumo de uma função no período, somado. Sem origem, sem aluno, sem entrada e sem saída. */
export interface ConsumoDaFuncao {
  readonly funcao: ChaveDeFuncao
  readonly chamadas: number
  readonly tokensDeEntrada: number
  readonly tokensDeSaida: number
  readonly custoMicros: number
  readonly comEnvioExterno: number
}

export interface SuspensaoLida {
  readonly id: string
  readonly funcao: ChaveDeFuncao
  readonly motivo: MotivoDeSuspensao | null
  readonly suspensaEm: Date
}

export interface SuspensaoRetomada {
  readonly id: string
  readonly suspensaEm: Date
  readonly retomadaEm: Date
}

/** O ano letivo em curso da sessão, ou `null` na escola que ainda não abriu nenhum: a governança abre vazia, não com erro. */
export function anoEmCursoOuNulo(): string | null {
  const anoLetivoId = contextoAtual()?.anoLetivoId
  return typeof anoLetivoId === 'string' ? anoLetivoId : null
}

/**
 * A governança de IA da coordenação (MVP, A5; D9, D45, D60, D64; regra 70, itens 5, 6, 8 e 9), na escola do contexto e,
 * no que varia por período, no ano letivo dele. Nada vem do cliente para decidir o escopo (regra 10, item 3).
 *
 * **Nenhuma consulta daqui agrupa, filtra ou ordena por professor**, e nenhuma seleciona coluna de pessoa: a entrega sai
 * sem `decidida_por`, sem turma, sem título e sem justificativa; o consumo, sem `aluno_id`, sem `origem`, sem `entrada`
 * e sem `saida`. A única conta que olha professor é o **grupo mínimo** (D45): quantos professores distintos têm entrega na
 * série, para a linha de uma série com um professor só não identificar quem ele é.
 */
export class GovernancaRepository {
  constructor(private readonly banco: Banco | TransacaoBanco) {}

  /** O que a IA gerou no ano (artefatos e lotes de correção) e o que as pessoas decidiram sobre as entregas. */
  async numeros(): Promise<NumerosDaGovernanca> {
    const anoLetivoId = anoEmCursoOuNulo()
    if (anoLetivoId === null) return { geradoPorIa: 0, aprovadoPorPessoa: 0, rejeitado: 0, esperando: 0 }
    const escolaId = exigirEscolaDoContexto()
    const [entregas] = await this.banco
      .select({
        lotes: sql<number>`count(*) filter (where ${entrega.tipo} = 'lote_de_correcao')::int`,
        aprovadas: sql<number>`count(*) filter (where ${entrega.estado} = 'aprovada')::int`,
        rejeitadas: sql<number>`count(*) filter (where ${entrega.estado} = 'rejeitada')::int`,
        pendentes: sql<number>`count(*) filter (where ${entrega.estado} = 'pendente')::int`,
      })
      .from(entrega)
      .where(and(eq(entrega.escolaId, escolaId), eq(entrega.anoLetivoId, anoLetivoId)))
    const [artefatos] = await this.banco
      .select({ total: count() })
      .from(artefato)
      .where(and(eq(artefato.escolaId, escolaId), eq(artefato.anoLetivoId, anoLetivoId)))
    return {
      geradoPorIa: (artefatos?.total ?? 0) + (entregas?.lotes ?? 0),
      aprovadoPorPessoa: entregas?.aprovadas ?? 0,
      rejeitado: entregas?.rejeitadas ?? 0,
      esperando: entregas?.pendentes ?? 0,
    }
  }

  /**
   * A série da turma tem entregas de pelo menos `GRUPO_MINIMO_DE_PROFESSORES` professores distintos no ano (D45). Conta
   * quem tem **dado** na série, não quem tem vínculo nela: o professor de cada entrega é quem criou o artefato (a versão
   * adaptada) ou quem aplicou a atividade (o lote de correção). Com dois professores alocados e só um gerando entrega, a
   * linha da série diria o que **ele** gerou e aprovou, e insinuaria que o outro não usa a ferramenta (D64). Conta
   * professores distintos e não diz quais. Só vale porque olha o ano em curso: no ano encerrado, o expurgo anula
   * `artefato.criado_por` (F3, tarefa 4.0), e o `coalesce` passaria a contar outros professores, ou nenhum.
   */
  #serieComGrupoMinimo(): SQL {
    return sql`(
      select count(distinct coalesce(artefato_da_serie.criado_por, aplicacao_da_serie.aplicada_por))
        from entrega entrega_da_serie
        join turma turma_da_serie
          on turma_da_serie.escola_id = entrega_da_serie.escola_id and turma_da_serie.ano_letivo_id = entrega_da_serie.ano_letivo_id and turma_da_serie.id = entrega_da_serie.turma_id
        left join artefato artefato_da_serie
          on artefato_da_serie.escola_id = entrega_da_serie.escola_id and artefato_da_serie.ano_letivo_id = entrega_da_serie.ano_letivo_id and artefato_da_serie.id = entrega_da_serie.artefato_id
        left join atividade_aplicada aplicacao_da_serie
          on aplicacao_da_serie.escola_id = entrega_da_serie.escola_id and aplicacao_da_serie.ano_letivo_id = entrega_da_serie.ano_letivo_id and aplicacao_da_serie.id = entrega_da_serie.atividade_aplicada_id
       where entrega_da_serie.escola_id = ${entrega.escolaId}
         and entrega_da_serie.ano_letivo_id = ${entrega.anoLetivoId}
         and turma_da_serie.serie_id = ${turma.serieId}
    ) >= ${GRUPO_MINIMO_DE_PROFESSORES}`
  }

  /**
   * Uma página de "o que a IA gerou e quem aprovou", **da mais nova para a mais antiga** (o id é `uuidv7`), com uma
   * linha a mais que diz se há próxima. Só entram as entregas de série com grupo mínimo de professores: o contrato exige
   * a série em toda linha, então a entrega da série de um professor só fica fora da lista (e conta nos números).
   */
  async entregas({ pagina, limite, estado }: ResumoDaGovernancaQuery): Promise<EntregaDaGovernanca[]> {
    const anoLetivoId = anoEmCursoOuNulo()
    if (anoLetivoId === null) return []
    return this.banco
      .select({ id: entrega.id, funcao: entrega.funcao, tipo: entrega.tipo, estado: entrega.estado, criadaEm: entrega.criadaEm, decididaEm: entrega.decididaEm, serieId: serie.id, etapa: serie.etapa, ano: serie.ano })
      .from(entrega)
      .innerJoin(turma, and(eq(turma.escolaId, entrega.escolaId), eq(turma.anoLetivoId, entrega.anoLetivoId), eq(turma.id, entrega.turmaId)))
      .innerJoin(serie, and(eq(serie.escolaId, turma.escolaId), eq(serie.id, turma.serieId)))
      .where(
        and(
          eq(entrega.escolaId, exigirEscolaDoContexto()),
          eq(entrega.anoLetivoId, anoLetivoId),
          estado === undefined ? undefined : eq(entrega.estado, estado),
          pagina === undefined ? undefined : lt(entrega.id, pagina),
          this.#serieComGrupoMinimo(),
        ),
      )
      .orderBy(desc(entrega.id))
      .limit(limite + 1)
  }

  /** O começo do dia `dia` (`AAAA-MM-DD`) no fuso do uso: o mês do consumo vira onde vira o do freio do Tutor. */
  #inicioDoDia(dia: string): SQL {
    return sql`(${dia}::date)::timestamp at time zone ${FUSO_DO_USO}`
  }

  /**
   * O consumo de IA da escola entre os dois dias (o primeiro entra, o segundo não), **somado por função** (D14, D64).
   * `consumo_ia` não tem ano letivo nem usuário; o índice `(escola_id, funcao, em)` serve a consulta. Não abre por
   * origem nem por aluno: `regra_fixa` com `aluno_id` marcaria quem caiu no encaminhamento da D36.
   */
  consumoPorFuncao(desde: string, ate: string): Promise<ConsumoDaFuncao[]> {
    return this.banco
      .select({
        funcao: consumoIa.funcao,
        chamadas: sql<number>`count(*)::int`,
        tokensDeEntrada: sql<number>`coalesce(sum(${consumoIa.tokensDeEntrada}), 0)::int`,
        tokensDeSaida: sql<number>`coalesce(sum(${consumoIa.tokensDeSaida}), 0)::int`,
        custoMicros: sql<number>`coalesce(sum(${consumoIa.custoMicros}), 0)::float8`,
        comEnvioExterno: sql<number>`count(*) filter (where ${consumoIa.envioExterno})::int`,
      })
      .from(consumoIa)
      .where(and(eq(consumoIa.escolaId, exigirEscolaDoContexto()), gte(consumoIa.em, this.#inicioDoDia(desde)), lt(consumoIa.em, this.#inicioDoDia(ate))))
      .groupBy(consumoIa.funcao)
  }

  /**
   * As trocas com o Tutor entre os dois dias, na escola e no ano letivo do contexto, com a conta do freio: a pergunta do
   * aluno cuja execução não terminou `falhou`. É uma contagem só, da escola inteira.
   */
  async trocasComOTutor(desde: string, ate: string): Promise<number> {
    const anoLetivoId = anoEmCursoOuNulo()
    if (anoLetivoId === null) return 0
    const falhou = this.banco
      .select({ id: execucaoAgente.id })
      .from(execucaoAgente)
      .where(and(eq(execucaoAgente.escolaId, mensagemTutor.escolaId), eq(execucaoAgente.id, mensagemTutor.execucaoId), eq(execucaoAgente.estado, 'falhou')))
    const [linha] = await this.banco
      .select({ total: count() })
      .from(mensagemTutor)
      .where(
        and(
          eq(mensagemTutor.escolaId, exigirEscolaDoContexto()),
          eq(mensagemTutor.anoLetivoId, anoLetivoId),
          eq(mensagemTutor.autor, 'aluno'),
          gte(mensagemTutor.criadaEm, this.#inicioDoDia(desde)),
          lt(mensagemTutor.criadaEm, this.#inicioDoDia(ate)),
          notExists(falhou),
        ),
      )
    return linha?.total ?? 0
  }

  /** Os limites do Tutor configurados na escola (nulo vale o padrão do contrato) e quantos alunos as turmas do ano somam. */
  async pacoteDoTutor(): Promise<{ porDia: number | null; porMes: number | null; alunos: number }> {
    const escolaId = exigirEscolaDoContexto()
    const anoLetivoId = anoEmCursoOuNulo()
    const [limites] = await this.banco
      .select({ porDia: configuracaoOperacionalEscola.tutorTrocasPorDia, porMes: configuracaoOperacionalEscola.tutorTrocasPorMes })
      .from(configuracaoOperacionalEscola)
      .where(eq(configuracaoOperacionalEscola.escolaId, escolaId))
    const [turmas] =
      anoLetivoId === null
        ? [{ alunos: 0 }]
        : await this.banco
            .select({ alunos: count() })
            .from(vinculo)
            .where(and(eq(vinculo.escolaId, escolaId), eq(vinculo.anoLetivoId, anoLetivoId), eq(vinculo.papel, 'aluno'), eq(vinculo.estado, 'confirmado')))
    return { porDia: limites?.porDia ?? null, porMes: limites?.porMes ?? null, alunos: turmas?.alunos ?? 0 }
  }

  /** As suspensões vigentes da escola: no máximo uma por função (índice único parcial), no máximo seis linhas. */
  suspensoesVigentes(): Promise<SuspensaoLida[]> {
    return this.banco
      .select({ id: suspensaoDeFuncao.id, funcao: suspensaoDeFuncao.funcao, motivo: suspensaoDeFuncao.motivo, suspensaEm: suspensaoDeFuncao.suspensaEm })
      .from(suspensaoDeFuncao)
      .where(and(eq(suspensaoDeFuncao.escolaId, exigirEscolaDoContexto()), isNull(suspensaoDeFuncao.retomadaEm)))
  }

  /**
   * Grava a suspensão vigente da função, com a pessoa da sessão e a hora do banco, e devolve o id. `undefined` é a função
   * que já estava suspensa: o índice único parcial decide, sem "verifica e depois grava" (regra 80, item 7), e o segundo
   * clique não cria segunda linha.
   */
  async suspender(funcao: ChaveDeFuncao, motivo: MotivoDeSuspensao | null): Promise<string | undefined> {
    const [criada] = await this.banco
      .insert(suspensaoDeFuncao)
      .values({ escolaId: exigirEscolaDoContexto(), funcao, motivo, suspensaPor: sessaoDaRequisicao().usuarioId })
      .onConflictDoNothing({ target: [suspensaoDeFuncao.escolaId, suspensaoDeFuncao.funcao], where: sql`retomada_em is null` })
      .returning({ id: suspensaoDeFuncao.id })
    return criada?.id
  }

  /**
   * Fecha a suspensão vigente da função, numa instrução só, com a pessoa da sessão e a hora do banco. `undefined` é a
   * função que não estava suspensa nesta escola: nada foi gravado.
   */
  async retomar(funcao: ChaveDeFuncao): Promise<SuspensaoRetomada | undefined> {
    const [fechada] = await this.banco
      .update(suspensaoDeFuncao)
      .set({ retomadaPor: sessaoDaRequisicao().usuarioId, retomadaEm: sql`now()` })
      .where(and(eq(suspensaoDeFuncao.escolaId, exigirEscolaDoContexto()), eq(suspensaoDeFuncao.funcao, funcao), isNull(suspensaoDeFuncao.retomadaEm)))
      .returning({ id: suspensaoDeFuncao.id, suspensaEm: suspensaoDeFuncao.suspensaEm, retomadaEm: suspensaoDeFuncao.retomadaEm })
    if (fechada === undefined || fechada.retomadaEm === null) return undefined
    return { id: fechada.id, suspensaEm: fechada.suspensaEm, retomadaEm: fechada.retomadaEm }
  }
}
