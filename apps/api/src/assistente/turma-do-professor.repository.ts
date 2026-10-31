import { artefato, atividadeAplicada, disciplina, requireAnoEmCurso, requireEscolaId, serie, requestSessao, turma, vinculo, type Database, type DatabaseTransaction } from '@educa/core'
import type { Etapa } from '@educa/shared'
import { and, eq, exists, sql, type AnyColumn, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

/** As colunas de uma linha que dizem de que turma ela é: a escola, o ano letivo e a turma. */
export interface ColunasDaTurma {
  readonly escolaId: AnyColumn
  readonly anoLetivoId: AnyColumn
  readonly turmaId: AnyColumn
}

/** A disciplina do vínculo exigido: um id já conferido, ou a coluna (ou a subconsulta) que diz de que disciplina a linha é. */
export type DisciplinaDoVinculo = string | AnyColumn | SQL

/**
 * O `turma_vinculada` da `MATRIZ`, num lugar só: existe vínculo `confirmado` de professor do **usuário do contexto** na
 * turma **e na disciplina** da linha, na escola e no ano da própria linha. É `exists`, e não `join`: quem dá duas
 * disciplinas na mesma turma tem dois vínculos, e o `join` repetiria a linha.
 *
 * O usuário vem da sessão, nunca de argumento (regra 10, item 3). Vínculo pendente, contestado ou encerrado não dá
 * alcance: o professor que saiu em março não lê a turma em outubro (regra 20, item 18).
 *
 * **A disciplina é obrigatória** (regra 10, item 4; regra 70, item 3): a professora de Matemática do 2ºB não lê o
 * artefato de Química da colega da mesma turma, nem decide a versão adaptada ou o lote de correção dela. Quem decide
 * sobre uma saída de IA é a professora daquela disciplina naquela turma. A disciplina vem da própria linha: a coluna
 * `disciplina_id` do artefato, `disciplinaDoArtefato` para a atividade aplicada, `disciplinaDaEntrega` para a entrega
 * (versão adaptada ou lote). Subconsulta que não acha a disciplina dá nulo, e nulo não casa com vínculo nenhum.
 */
export function comVinculoConfirmadoDoProfessor(banco: Database | DatabaseTransaction, colunas: ColunasDaTurma, disciplinaId: DisciplinaDoVinculo): SQL {
  const { usuarioId } = requestSessao()
  return exists(
    banco
      .select({ um: vinculo.id })
      .from(vinculo)
      .where(
        and(
          eq(vinculo.escolaId, colunas.escolaId),
          eq(vinculo.anoLetivoId, colunas.anoLetivoId),
          eq(vinculo.turmaId, colunas.turmaId),
          eq(vinculo.usuarioId, usuarioId),
          eq(vinculo.papel, 'professor'),
          eq(vinculo.estado, 'confirmado'),
          eq(vinculo.disciplinaId, disciplinaId),
        ),
      ),
  )
}

/** As colunas de uma linha que apontam para um artefato do mesmo ano: a atividade aplicada, a entrega da versão adaptada. */
export interface ColunasDoArtefato {
  readonly escolaId: AnyColumn
  readonly anoLetivoId: AnyColumn
  readonly artefatoId: AnyColumn
}

const artefatoDaLinha = alias(artefato, 'artefato_da_linha')
const aplicacaoDaEntrega = alias(atividadeAplicada, 'aplicacao_da_entrega')
const artefatoDaAplicacao = alias(artefato, 'artefato_da_aplicacao')

/**
 * A disciplina do artefato para o qual a linha aponta, como subconsulta: é o `disciplinaId` de
 * `comVinculoConfirmadoDoProfessor` para a **atividade aplicada** (`atividade_aplicada.artefato_id`). O artefato é
 * lido na escola e no ano da própria linha.
 */
export function disciplinaDoArtefato(banco: Database | DatabaseTransaction, colunas: ColunasDoArtefato): SQL {
  const consulta = banco
    .select({ disciplinaId: artefatoDaLinha.disciplinaId })
    .from(artefatoDaLinha)
    .where(and(eq(artefatoDaLinha.escolaId, colunas.escolaId), eq(artefatoDaLinha.anoLetivoId, colunas.anoLetivoId), eq(artefatoDaLinha.id, colunas.artefatoId)))
  return sql`(${consulta})`
}

/**
 * A disciplina de uma **entrega**, como subconsulta: a do artefato dela, na versão adaptada; a do artefato da atividade
 * aplicada, no lote de correção. É o `disciplinaId` de `comVinculoConfirmadoDoProfessor` para listar e decidir entrega
 * e para aprovar o lote. `colunas` são as da tabela `entrega` (ou de um alias dela).
 */
export function disciplinaDaEntrega(banco: Database | DatabaseTransaction, colunas: ColunasDoArtefato & { readonly atividadeAplicadaId: AnyColumn }): SQL {
  const doLote = banco
    .select({ disciplinaId: artefatoDaAplicacao.disciplinaId })
    .from(aplicacaoDaEntrega)
    .innerJoin(artefatoDaAplicacao, and(eq(artefatoDaAplicacao.escolaId, aplicacaoDaEntrega.escolaId), eq(artefatoDaAplicacao.anoLetivoId, aplicacaoDaEntrega.anoLetivoId), eq(artefatoDaAplicacao.id, aplicacaoDaEntrega.artefatoId)))
    .where(and(eq(aplicacaoDaEntrega.escolaId, colunas.escolaId), eq(aplicacaoDaEntrega.anoLetivoId, colunas.anoLetivoId), eq(aplicacaoDaEntrega.id, colunas.atividadeAplicadaId)))
  return sql`coalesce(${disciplinaDoArtefato(banco, colunas)}, (${doLote}))`
}

/** A turma e a disciplina de um pedido, como a tarefa de IA as recebe: a série e o nome da disciplina, sem nome de turma nem de pessoa. */
export interface TurmaComDisciplina {
  readonly serie: { readonly etapa: Etapa; readonly ano: number }
  readonly disciplina: string
}

/**
 * A turma e a disciplina em que o professor do contexto pode pedir IA: turma do ano em curso da escola do contexto, com
 * vínculo `confirmado` dele **naquela disciplina**. Escola, ano e pessoa vêm da sessão (regra 10, item 3).
 */
export class TurmaDoProfessorRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /**
   * A série da turma e o nome da disciplina, se o professor do contexto tem vínculo confirmado nas duas. Turma ou
   * disciplina de outra escola, de outro ano, de outro professor ou inexistente: `undefined`, e quem chama responde
   * `NAO_ENCONTRADO`, igual para todas (regra 10, item 6).
   */
  async turmaComDisciplina(turmaId: string, disciplinaId: string): Promise<TurmaComDisciplina | undefined> {
    const escolaId = requireEscolaId()
    const [linha] = await this.banco
      .select({ etapa: serie.etapa, ano: serie.ano, disciplina: disciplina.nome })
      .from(turma)
      .innerJoin(serie, and(eq(serie.escolaId, turma.escolaId), eq(serie.id, turma.serieId)))
      .innerJoin(disciplina, and(eq(disciplina.escolaId, turma.escolaId), eq(disciplina.id, disciplinaId)))
      .where(and(eq(turma.escolaId, escolaId), eq(turma.anoLetivoId, requireAnoEmCurso()), eq(turma.id, turmaId), comVinculoConfirmadoDoProfessor(this.banco, { escolaId: turma.escolaId, anoLetivoId: turma.anoLetivoId, turmaId: turma.id }, disciplinaId)))
    return linha === undefined ? undefined : { serie: { etapa: linha.etapa, ano: linha.ano }, disciplina: linha.disciplina }
  }
}
