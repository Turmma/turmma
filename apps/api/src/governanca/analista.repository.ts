import {
  anoLetivo,
  artefato,
  atividadeAplicada,
  correcao,
  disciplina,
  entrega,
  execucaoAgente,
  requireAnoEmCurso,
  requireEscolaId,
  mensagemTutor,
  serie,
  sinalTutor,
  mvpTables,
  turma,
  usuario,
  vinculo,
  type Database,
  type DatabaseTransaction,
} from '@educa/nucleo'
import type { ConteudoDoResumoDoAnalista, Etapa, TipoDeSinal } from '@educa/shared'
import { and, asc, count, desc, eq, isNull, ne, notExists, sql, type SQL } from 'drizzle-orm'
import { InvariantException } from '@educa/shared'
import { anoEmCursoOuNulo } from './governanca.repository.js'

/** O recorte do Analista: série × disciplina. Nunca turma, nunca professor. */
export interface ChaveDoRecorte {
  readonly serieId: string
  readonly disciplinaId: string
}

export interface RecorteComLotes extends ChaveDoRecorte {
  readonly etapa: Etapa
  readonly ano: number
  readonly disciplina: string
  readonly lotesAprovados: number
  readonly alunos: number
  /**
   * Quantos professores **distintos** decidiram os lotes aprovados do recorte (`entrega.decidida_por`): é a conta do
   * grupo mínimo (D45). Conta quem tem **dado** no recorte, não quem tem vínculo: com duas professoras alocadas e só uma
   * com lote aprovado, o número do recorte seria o dela. Devolve quantos, nunca quem.
   */
  readonly professores: number
}

export interface AcertoNoRecorte extends ChaveDoRecorte {
  readonly codigo: string
  readonly acertos: number
  readonly total: number
}

export interface NumerosDaEscola {
  readonly atividadesAplicadas: number
  readonly lotesAprovados: number
  readonly lotesEsperando: number
  readonly versoesAdaptadasAprovadas: number
}

export interface TurmaLida {
  readonly id: string
  readonly nome: string
  readonly serieId: string
  readonly etapa: Etapa
  readonly ano: number
}

export interface ProfessorDaTurma {
  readonly id: string
  readonly nome: string
  readonly disciplinaId: string
  readonly disciplina: string
}

/**
 * A tabela `resumo_do_analista`. No índice do `@educa/nucleo` o nome `resumoDoAnalista` é o da tarefa de IA (a exportação
 * explícita vence o `export *` das tabelas), então a tabela sai de `mvpTables`.
 */
const resumoDoAnalista = mvpTables.resumoDoAnalista

const aplicacaoDaEntrega = and(eq(atividadeAplicada.escolaId, entrega.escolaId), eq(atividadeAplicada.anoLetivoId, entrega.anoLetivoId), eq(atividadeAplicada.id, entrega.atividadeAplicadaId))
const artefatoDaAplicacao = and(eq(artefato.escolaId, atividadeAplicada.escolaId), eq(artefato.anoLetivoId, atividadeAplicada.anoLetivoId), eq(artefato.id, atividadeAplicada.artefatoId))
const turmaDaEntrega = and(eq(turma.escolaId, entrega.escolaId), eq(turma.anoLetivoId, entrega.anoLetivoId), eq(turma.id, entrega.turmaId))
const correcaoDaEntrega = and(eq(correcao.escolaId, entrega.escolaId), eq(correcao.anoLetivoId, entrega.anoLetivoId), eq(correcao.entregaId, entrega.id))

/**
 * Os dados do Analista de desempenho escolar (MVP, A5; D34, D45, D46, D64), na escola e no ano letivo do contexto.
 *
 * **O que vira número é só lote `aprovada`**: correção pendente ou rejeitada não entra em conta nenhuma. O agregado é
 * por série e disciplina; a única conta que olha professor é a do grupo mínimo (quantos distintos decidiram lote aprovado
 * no recorte), e nenhuma consulta agrupa, filtra ou ordena por professor. O detalhe de uma turma (`professoresDaTurma`)
 * só é chamado pela leitura nominal, que audita antes de responder.
 */
export class AnalistaRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  #escopo(): { escolaId: string; anoLetivoId: string } {
    return { escolaId: requireEscolaId(), anoLetivoId: requireAnoEmCurso() }
  }

  /** As entregas que valem como desempenho: lote de correção aprovado, na escola e no ano do contexto. */
  #lotesAprovados(mais?: SQL): SQL | undefined {
    const { escolaId, anoLetivoId } = this.#escopo()
    return and(eq(entrega.escolaId, escolaId), eq(entrega.anoLetivoId, anoLetivoId), eq(entrega.tipo, 'lote_de_correcao'), eq(entrega.estado, 'aprovada'), mais)
  }

  /** O começo e o fim do ano letivo em curso (`AAAA-MM-DD`). */
  async periodoDoAno(): Promise<{ inicio: string; fim: string } | undefined> {
    const { escolaId, anoLetivoId } = this.#escopo()
    const [linha] = await this.banco
      .select({ inicio: anoLetivo.inicio, fim: anoLetivo.fim })
      .from(anoLetivo)
      .where(and(eq(anoLetivo.escolaId, escolaId), eq(anoLetivo.id, anoLetivoId)))
    return linha
  }

  /** Os números da escola inteira no ano: aplicações, lotes e versões adaptadas. Contagens, sem pessoa. */
  async numerosDaEscola(): Promise<NumerosDaEscola> {
    const { escolaId, anoLetivoId } = this.#escopo()
    const [aplicacoes] = await this.banco
      .select({ total: count() })
      .from(atividadeAplicada)
      .where(and(eq(atividadeAplicada.escolaId, escolaId), eq(atividadeAplicada.anoLetivoId, anoLetivoId)))
    const [entregas] = await this.banco
      .select({
        lotesAprovados: sql<number>`count(*) filter (where ${entrega.tipo} = 'lote_de_correcao' and ${entrega.estado} = 'aprovada')::int`,
        lotesEsperando: sql<number>`count(*) filter (where ${entrega.tipo} = 'lote_de_correcao' and ${entrega.estado} = 'pendente')::int`,
        versoesAdaptadasAprovadas: sql<number>`count(*) filter (where ${entrega.tipo} = 'versao_adaptada' and ${entrega.estado} = 'aprovada')::int`,
      })
      .from(entrega)
      .where(and(eq(entrega.escolaId, escolaId), eq(entrega.anoLetivoId, anoLetivoId)))
    return {
      atividadesAplicadas: aplicacoes?.total ?? 0,
      lotesAprovados: entregas?.lotesAprovados ?? 0,
      lotesEsperando: entregas?.lotesEsperando ?? 0,
      versoesAdaptadasAprovadas: entregas?.versoesAdaptadasAprovadas ?? 0,
    }
  }

  /** As trocas com o Tutor no ano (a pergunta do aluno cuja execução não falhou), somadas na escola. */
  async trocasComOTutor(): Promise<number> {
    const { escolaId, anoLetivoId } = this.#escopo()
    const falhou = this.banco
      .select({ id: execucaoAgente.id })
      .from(execucaoAgente)
      .where(and(eq(execucaoAgente.escolaId, mensagemTutor.escolaId), eq(execucaoAgente.id, mensagemTutor.execucaoId), eq(execucaoAgente.estado, 'falhou')))
    const [linha] = await this.banco
      .select({ total: count() })
      .from(mensagemTutor)
      .where(and(eq(mensagemTutor.escolaId, escolaId), eq(mensagemTutor.anoLetivoId, anoLetivoId), eq(mensagemTutor.autor, 'aluno'), notExists(falhou)))
    return linha?.total ?? 0
  }

  /**
   * Os sinais do Tutor por tipo, somados. Sem a turma, é a escola inteira (o único lugar em que `atencao_humana` aparece,
   * e só como contagem); com a turma, quem chama descarta `atencao_humana`, que numa turma aponta poucos alunos (D36).
   */
  async sinaisPorTipo(turmaId?: string): Promise<Map<TipoDeSinal, number>> {
    const { escolaId, anoLetivoId } = this.#escopo()
    const linhas = await this.banco
      .select({ tipo: sinalTutor.tipo, total: count() })
      .from(sinalTutor)
      .where(
        and(
          eq(sinalTutor.escolaId, escolaId),
          eq(sinalTutor.anoLetivoId, anoLetivoId),
          turmaId === undefined ? undefined : and(eq(sinalTutor.turmaId, turmaId), ne(sinalTutor.tipo, 'atencao_humana')),
        ),
      )
      .groupBy(sinalTutor.tipo)
    return new Map(linhas.map((linha) => [linha.tipo, linha.total]))
  }

  /** Os recortes (série × disciplina) que têm lote aprovado, com quantos lotes e quantos alunos corrigidos entram em cada um. */
  recortesComLotes(): Promise<RecorteComLotes[]> {
    return this.banco
      .select({
        serieId: serie.id,
        etapa: serie.etapa,
        ano: serie.ano,
        disciplinaId: disciplina.id,
        disciplina: disciplina.nome,
        lotesAprovados: sql<number>`count(distinct ${entrega.id})::int`,
        alunos: sql<number>`count(distinct ${correcao.alunoId})::int`,
        professores: sql<number>`count(distinct ${entrega.decididaPor})::int`,
      })
      .from(entrega)
      .innerJoin(atividadeAplicada, aplicacaoDaEntrega)
      .innerJoin(artefato, artefatoDaAplicacao)
      .innerJoin(turma, turmaDaEntrega)
      .innerJoin(serie, and(eq(serie.escolaId, turma.escolaId), eq(serie.id, turma.serieId)))
      .innerJoin(disciplina, and(eq(disciplina.escolaId, artefato.escolaId), eq(disciplina.id, artefato.disciplinaId)))
      .leftJoin(correcao, correcaoDaEntrega)
      .where(this.#lotesAprovados())
      .groupBy(serie.id, serie.etapa, serie.ano, disciplina.id, disciplina.nome)
      .orderBy(asc(serie.etapa), asc(serie.ano), asc(disciplina.nome), asc(disciplina.id))
  }

  /** O acerto por habilidade em cada recorte: o `jsonb` do diagnóstico aberto em linhas e somado no banco, só de lote aprovado. */
  acertosPorRecorte(): Promise<AcertoNoRecorte[]> {
    const habilidade = sql`jsonb_to_recordset(${correcao.porHabilidade}) as habilidade(codigo text, acertos int, total int)`
    return this.banco
      .select({ serieId: turma.serieId, disciplinaId: artefato.disciplinaId, codigo: sql<string>`habilidade.codigo`, acertos: sql<number>`sum(habilidade.acertos)::int`, total: sql<number>`sum(habilidade.total)::int` })
      .from(entrega)
      .innerJoin(atividadeAplicada, aplicacaoDaEntrega)
      .innerJoin(artefato, artefatoDaAplicacao)
      .innerJoin(turma, turmaDaEntrega)
      .innerJoin(correcao, correcaoDaEntrega)
      .crossJoinLateral(habilidade)
      .where(this.#lotesAprovados())
      .groupBy(turma.serieId, artefato.disciplinaId, sql`habilidade.codigo`)
      .orderBy(sql`habilidade.codigo`)
  }

  /** A descrição de cada habilidade das atividades dos lotes aprovados (da turma, se dada), pelo código: o catálogo é nosso, em código. */
  async descricoesDasHabilidades(turmaId?: string): Promise<Map<string, string>> {
    const questao = sql`jsonb_array_elements(${artefato.conteudo} -> 'questoes') as questao`
    const linhas = await this.banco
      .selectDistinct({ codigo: sql<string>`questao -> 'habilidade' ->> 'codigo'`, descricao: sql<string>`questao -> 'habilidade' ->> 'descricao'` })
      .from(entrega)
      .innerJoin(atividadeAplicada, aplicacaoDaEntrega)
      .innerJoin(artefato, artefatoDaAplicacao)
      .crossJoinLateral(questao)
      .where(this.#lotesAprovados(turmaId === undefined ? undefined : eq(entrega.turmaId, turmaId)))
      .orderBy(sql`1`, sql`2`)
    const descricoes = new Map<string, string>()
    for (const linha of linhas) if (!descricoes.has(linha.codigo)) descricoes.set(linha.codigo, linha.descricao)
    return descricoes
  }

  /** Grava o resumo já validado, ligado à execução que o produziu (um por execução), e devolve o id. */
  async gravarResumo(conteudo: ConteudoDoResumoDoAnalista, execucaoId: string): Promise<string> {
    const { escolaId, anoLetivoId } = this.#escopo()
    const [criado] = await this.banco.insert(resumoDoAnalista).values({ escolaId, anoLetivoId, execucaoId, conteudo }).returning({ id: resumoDoAnalista.id })
    if (criado === undefined) throw new InvariantException('resumo do Analista não gravado')
    return criado.id
  }

  /** O resumo mais recente da escola no ano em curso. Sem ano em curso, nenhum. */
  async ultimoResumo(): Promise<{ id: string; geradoEm: Date; conteudo: unknown } | undefined> {
    const anoLetivoId = anoEmCursoOuNulo()
    if (anoLetivoId === null) return undefined
    const [linha] = await this.banco
      .select({ id: resumoDoAnalista.id, geradoEm: resumoDoAnalista.geradoEm, conteudo: resumoDoAnalista.conteudo })
      .from(resumoDoAnalista)
      .where(and(eq(resumoDoAnalista.escolaId, requireEscolaId()), eq(resumoDoAnalista.anoLetivoId, anoLetivoId)))
      .orderBy(desc(resumoDoAnalista.id))
      .limit(1)
    return linha
  }

  /** A turma do ano em curso da escola do contexto, com a série. A de outra escola ou de outro ano não é achada. */
  async turmaDaEscola(turmaId: string): Promise<TurmaLida | undefined> {
    const { escolaId, anoLetivoId } = this.#escopo()
    const [linha] = await this.banco
      .select({ id: turma.id, nome: turma.nome, serieId: serie.id, etapa: serie.etapa, ano: serie.ano })
      .from(turma)
      .innerJoin(serie, and(eq(serie.escolaId, turma.escolaId), eq(serie.id, turma.serieId)))
      .where(and(eq(turma.escolaId, escolaId), eq(turma.anoLetivoId, anoLetivoId), eq(turma.id, turmaId)))
    return linha
  }

  /**
   * **Leitura nominal** (D45): os professores com vínculo confirmado na turma e a disciplina de cada um, em ordem de
   * nome. Só quem chama é `GET /v1/analista/nominal`, que grava a auditoria na mesma transação.
   */
  async professoresDaTurma(turmaId: string): Promise<ProfessorDaTurma[]> {
    const { escolaId, anoLetivoId } = this.#escopo()
    const linhas = await this.banco
      .selectDistinct({ id: usuario.id, nome: usuario.nome, disciplinaId: disciplina.id, disciplina: disciplina.nome })
      .from(vinculo)
      .innerJoin(usuario, and(eq(usuario.escolaId, vinculo.escolaId), eq(usuario.id, vinculo.usuarioId)))
      .innerJoin(disciplina, and(eq(disciplina.escolaId, vinculo.escolaId), eq(disciplina.id, vinculo.disciplinaId)))
      .where(
        and(eq(vinculo.escolaId, escolaId), eq(vinculo.anoLetivoId, anoLetivoId), eq(vinculo.turmaId, turmaId), eq(vinculo.papel, 'professor'), eq(vinculo.estado, 'confirmado'), isNull(usuario.desativadoEm)),
      )
      .orderBy(asc(usuario.nome), asc(usuario.id), asc(disciplina.nome), asc(disciplina.id))
      .limit(40)
    return linhas
  }

  /** Quantos lotes aprovados a turma tem. */
  async lotesAprovadosDaTurma(turmaId: string): Promise<number> {
    const [linha] = await this.banco.select({ total: count() }).from(entrega).where(this.#lotesAprovados(eq(entrega.turmaId, turmaId)))
    return linha?.total ?? 0
  }

  /** O acerto por habilidade da turma, somado nos lotes aprovados dela. Sem aluno: quem quer por aluno usa o desempenho da turma. */
  acertosDaTurma(turmaId: string): Promise<{ codigo: string; acertos: number; total: number }[]> {
    const habilidade = sql`jsonb_to_recordset(${correcao.porHabilidade}) as habilidade(codigo text, acertos int, total int)`
    return this.banco
      .select({ codigo: sql<string>`habilidade.codigo`, acertos: sql<number>`sum(habilidade.acertos)::int`, total: sql<number>`sum(habilidade.total)::int` })
      .from(entrega)
      .innerJoin(correcao, correcaoDaEntrega)
      .crossJoinLateral(habilidade)
      .where(this.#lotesAprovados(eq(entrega.turmaId, turmaId)))
      .groupBy(sql`habilidade.codigo`)
      .orderBy(sql`habilidade.codigo`)
  }
}
