import { artefato, atividadeAplicada, correcao, entrega, requireAnoEmCurso, requireEscolaId, requestSessao, turma, usuario, vinculo, type Database, type DatabaseTransaction } from '@educa/nucleo'
import { MAXIMO_DE_ALUNOS_NO_DESEMPENHO } from '@educa/shared'
import { and, asc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm'

/** De que disciplinas a leitura é: todas as da turma (coordenação), ou só as que a professora leciona nela. */
export type DisciplinasDaLeitura = 'todas' | readonly string[]

/** O acerto somado de um aluno numa habilidade, nos lotes aprovados da turma. */
export interface AcertoDoAlunoNaHabilidade {
  readonly alunoId: string
  readonly codigo: string
  readonly acertos: number
  readonly total: number
}

const lotesAprovadosDaTurma = (turmaId: string, disciplinas: DisciplinasDaLeitura): SQL | undefined =>
  and(
    eq(entrega.escolaId, requireEscolaId()),
    eq(entrega.anoLetivoId, requireAnoEmCurso()),
    eq(entrega.turmaId, turmaId),
    eq(entrega.tipo, 'lote_de_correcao'),
    // Só o que a professora validou vale como desempenho: lote pendente ou rejeitado não entra em número nenhum.
    eq(entrega.estado, 'aprovada'),
    disciplinas === 'todas' ? undefined : inArray(artefato.disciplinaId, [...disciplinas]),
  )

const aplicacaoDaEntrega = and(eq(atividadeAplicada.escolaId, entrega.escolaId), eq(atividadeAplicada.anoLetivoId, entrega.anoLetivoId), eq(atividadeAplicada.id, entrega.atividadeAplicadaId))
const artefatoDaAplicacao = and(eq(artefato.escolaId, atividadeAplicada.escolaId), eq(artefato.anoLetivoId, atividadeAplicada.anoLetivoId), eq(artefato.id, atividadeAplicada.artefatoId))

/**
 * O desempenho da turma (D34, D45, D46): acerto por habilidade, **só de lote `aprovada`**, na escola e no ano letivo do
 * contexto. Quem pode ler é decidido antes, por `turmaDaEscola` (coordenação) ou `disciplinasDaProfessora`; as leituras
 * de dado recebem as disciplinas e não conferem quem pede.
 */
export class DesempenhoRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /** A turma do ano em curso da escola do contexto existe? A de outra escola ou de outro ano não é achada. */
  async turmaDaEscola(turmaId: string): Promise<boolean> {
    const [linha] = await this.banco
      .select({ id: turma.id })
      .from(turma)
      .where(and(eq(turma.escolaId, requireEscolaId()), eq(turma.anoLetivoId, requireAnoEmCurso()), eq(turma.id, turmaId)))
    return linha !== undefined
  }

  /**
   * As disciplinas em que a professora **da sessão** tem vínculo `confirmado` na turma, no ano em curso. Lista vazia é
   * a turma que não é dela (ou de outra escola, ou inexistente): quem chama responde `NAO_ENCONTRADO`.
   */
  async disciplinasDaProfessora(turmaId: string): Promise<string[]> {
    const linhas = await this.banco
      .selectDistinct({ disciplinaId: vinculo.disciplinaId })
      .from(vinculo)
      .where(
        and(
          eq(vinculo.escolaId, requireEscolaId()),
          eq(vinculo.anoLetivoId, requireAnoEmCurso()),
          eq(vinculo.turmaId, turmaId),
          eq(vinculo.usuarioId, requestSessao().usuarioId),
          eq(vinculo.papel, 'professor'),
          eq(vinculo.estado, 'confirmado'),
        ),
      )
    return linhas.flatMap((linha) => linha.disciplinaId ?? [])
  }

  /** Quantos lotes aprovados a turma tem, nas disciplinas da leitura. */
  async lotesAprovados(turmaId: string, disciplinas: DisciplinasDaLeitura): Promise<number> {
    const [linha] = await this.banco
      .select({ total: sql<number>`count(*)::int` })
      .from(entrega)
      .innerJoin(atividadeAplicada, aplicacaoDaEntrega)
      .innerJoin(artefato, artefatoDaAplicacao)
      .where(lotesAprovadosDaTurma(turmaId, disciplinas))
    return linha?.total ?? 0
  }

  /** O acerto de cada aluno em cada habilidade, somado nos lotes aprovados: o `jsonb` do diagnóstico aberto em linhas e somado no banco. */
  acertosPorAlunoEHabilidade(turmaId: string, disciplinas: DisciplinasDaLeitura): Promise<AcertoDoAlunoNaHabilidade[]> {
    const habilidade = sql`jsonb_to_recordset(${correcao.porHabilidade}) as habilidade(codigo text, acertos int, total int)`
    return this.banco
      .select({ alunoId: correcao.alunoId, codigo: sql<string>`habilidade.codigo`, acertos: sql<number>`sum(habilidade.acertos)::int`, total: sql<number>`sum(habilidade.total)::int` })
      .from(entrega)
      .innerJoin(atividadeAplicada, aplicacaoDaEntrega)
      .innerJoin(artefato, artefatoDaAplicacao)
      .innerJoin(correcao, and(eq(correcao.escolaId, entrega.escolaId), eq(correcao.anoLetivoId, entrega.anoLetivoId), eq(correcao.entregaId, entrega.id)))
      .crossJoinLateral(habilidade)
      .where(lotesAprovadosDaTurma(turmaId, disciplinas))
      .groupBy(correcao.alunoId, sql`habilidade.codigo`)
  }

  /** A descrição de cada habilidade que aparece nas atividades dos lotes aprovados, pelo código (o catálogo é nosso, em código). */
  async descricoesDasHabilidades(turmaId: string, disciplinas: DisciplinasDaLeitura): Promise<Map<string, string>> {
    const questao = sql`jsonb_array_elements(${artefato.conteudo} -> 'questoes') as questao`
    const linhas = await this.banco
      .selectDistinct({ codigo: sql<string>`questao -> 'habilidade' ->> 'codigo'`, descricao: sql<string>`questao -> 'habilidade' ->> 'descricao'` })
      .from(entrega)
      .innerJoin(atividadeAplicada, aplicacaoDaEntrega)
      .innerJoin(artefato, artefatoDaAplicacao)
      .crossJoinLateral(questao)
      .where(lotesAprovadosDaTurma(turmaId, disciplinas))
      .orderBy(sql`1`, sql`2`)
    const descricoes = new Map<string, string>()
    for (const linha of linhas) if (!descricoes.has(linha.codigo)) descricoes.set(linha.codigo, linha.descricao)
    return descricoes
  }

  /** Os alunos da turma agora: vínculo de aluno `confirmado`, de usuário ativo, em ordem de nome e, no nome repetido, de id. Só id e nome. */
  alunos(turmaId: string): Promise<{ alunoId: string; nome: string }[]> {
    return this.banco
      .selectDistinct({ alunoId: usuario.id, nome: usuario.nome })
      .from(vinculo)
      .innerJoin(usuario, and(eq(usuario.escolaId, vinculo.escolaId), eq(usuario.id, vinculo.usuarioId)))
      .where(
        and(
          eq(vinculo.escolaId, requireEscolaId()),
          eq(vinculo.anoLetivoId, requireAnoEmCurso()),
          eq(vinculo.turmaId, turmaId),
          eq(vinculo.papel, 'aluno'),
          eq(vinculo.estado, 'confirmado'),
          isNull(usuario.desativadoEm),
        ),
      )
      .orderBy(asc(usuario.nome), asc(usuario.id))
      .limit(MAXIMO_DE_ALUNOS_NO_DESEMPENHO)
  }
}
