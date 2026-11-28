import {
  artefato,
  atividadeAplicada,
  correcao,
  entrega,
  requireAnoEmCurso,
  requireEscolaId,
  requestSessao,
  tentativaAtividade,
  usuario,
  validacaoDoLote,
  type Database,
  type DatabaseTransaction,
} from '@educa/core'
import type { DestaquesAbertos, DiagnosticoGravado, EstadoDeEntrega, LoteApresentado, MotivoDeDestaque } from '@educa/shared'
import { and, asc, desc, eq, isNull, sql, type SQL } from 'drizzle-orm'
import { InvariantException } from '@educa/shared'
import { comVinculoConfirmadoDoProfessor, disciplinaDaEntrega } from '../../assistente/turma-do-professor.repository.js'
import { alunosDaTurma } from '../atividade-aplicada/atividade-aplicada.repository.js'

/** O lote de correção de uma atividade aplicada, com o que a professora precisa para ler, abrir destaque e aprovar. */
export interface LoteLido {
  readonly entregaId: string
  readonly estado: EstadoDeEntrega
  readonly criadaEm: Date
  readonly decididaEm: Date | null
  readonly decididaPor: string | null
  readonly nomeDeQuemDecidiu: string | null
  readonly justificativa: string | null
  readonly atividadeAplicadaId: string
  readonly turmaId: string
  readonly disciplinaId: string
  readonly titulo: string
  readonly conteudo: unknown
  /** Só a avaliativa tem prova online, e só nela o lote traz a coluna "Saiu da aba" (D70). */
  readonly avaliativa: boolean
  readonly alunosDaTurma: number
}

/** Uma linha de `correcao` com o nome do aluno, que só a professora da turma recebe (D34). */
export interface CorrecaoLida {
  readonly alunoId: string
  readonly nome: string
  readonly acertos: number
  readonly total: number
  readonly emBranco: number
  readonly porHabilidade: DiagnosticoGravado
  readonly destaques: MotivoDeDestaque[]
  readonly destaqueAbertoEm: Date | null
  /**
   * Quantas vezes a aba da prova perdeu o foco **nesta tentativa** (`tentativa_atividade.saidas_da_aba`; D70). Só o lote da avaliativa a mostra (o service decide), e nada a leva para o
   * registro da validação nem para o resumo: é fato do professor da turma, sem consequência (D88).
   */
  readonly saidasDaAba: number
}

export interface ValidacaoLida {
  readonly id: string
  readonly apresentado: unknown
  readonly aberto: unknown
  readonly confirmadaPor: string
  readonly nomeDeQuemConfirmou: string | null
  readonly confirmadaEm: Date
}

const artefatoDaAplicacao = and(eq(artefato.escolaId, atividadeAplicada.escolaId), eq(artefato.anoLetivoId, atividadeAplicada.anoLetivoId), eq(artefato.id, atividadeAplicada.artefatoId))
const aplicacaoDaEntrega = and(eq(atividadeAplicada.escolaId, entrega.escolaId), eq(atividadeAplicada.anoLetivoId, entrega.anoLetivoId), eq(atividadeAplicada.id, entrega.atividadeAplicadaId))

const colunasDoLote = {
  entregaId: entrega.id,
  estado: entrega.estado,
  criadaEm: entrega.criadaEm,
  decididaEm: entrega.decididaEm,
  decididaPor: entrega.decididaPor,
  nomeDeQuemDecidiu: usuario.nome,
  justificativa: entrega.justificativa,
  atividadeAplicadaId: atividadeAplicada.id,
  turmaId: entrega.turmaId,
  disciplinaId: artefato.disciplinaId,
  titulo: artefato.titulo,
  conteudo: artefato.conteudo,
  avaliativa: atividadeAplicada.avaliativa,
  alunosDaTurma: alunosDaTurma(entrega),
}

/**
 * A correção de objetiva no banco (D33, D46, D56): o lote, as correções, a abertura dos destaques e a validação.
 *
 * **Leitura e decisão são da professora com vínculo `confirmado` na turma do lote e na disciplina do artefato**
 * (regra 10, itens 3 e 4): escola, ano e pessoa vêm do contexto, a turma e a disciplina, da própria linha. O que
 * grava correção (`createLote`) só é chamado de dentro do encerramento, depois de a aplicação ser achada no alcance e
 * travada.
 *
 * Nenhuma coluna daqui guarda nota, conceito ou texto sobre o aluno (D46, D55, D57).
 */
export class CorrecaoRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  #escopo(): SQL | undefined {
    return and(eq(entrega.escolaId, requireEscolaId()), eq(entrega.anoLetivoId, requireAnoEmCurso()), eq(entrega.tipo, 'lote_de_correcao'))
  }

  #lotes(condicao: SQL | undefined) {
    return this.banco
      .select(colunasDoLote)
      .from(entrega)
      .innerJoin(atividadeAplicada, aplicacaoDaEntrega)
      .innerJoin(artefato, artefatoDaAplicacao)
      .leftJoin(usuario, and(eq(usuario.escolaId, entrega.escolaId), eq(usuario.id, entrega.decididaPor)))
      .where(and(this.#escopo(), comVinculoConfirmadoDoProfessor(this.banco, entrega, disciplinaDaEntrega(this.banco, entrega)), condicao))
  }

  /**
   * O lote mais novo da atividade aplicada, no alcance da professora (o id é `uuidv7`): o pendente ou o aprovado, ou o
   * rejeitado, se foi o último. `travar` segura a linha da entrega em `for share` até o fim da transação: a aprovação,
   * que a trava em `for update`, espera a abertura de destaque em curso, e a abertura que chega depois relê o estado.
   */
  async loteDaAplicacao(atividadeAplicadaId: string, travar = false): Promise<LoteLido | undefined> {
    const consulta = this.#lotes(eq(entrega.atividadeAplicadaId, atividadeAplicadaId)).orderBy(desc(entrega.id)).limit(1)
    const [linha] = await (travar ? consulta.for('share', { of: entrega }) : consulta)
    return linha
  }

  /**
   * O lote com esse id de entrega, no alcance, **travado para a decisão** (`for update`): o segundo clique em aprovar
   * espera o primeiro e relê a entrega já decidida (regra 80, item 7). A versão adaptada não é lote: não é achada.
   */
  async lockLote(entregaId: string): Promise<LoteLido | undefined> {
    const [linha] = await this.#lotes(eq(entrega.id, entregaId)).for('update', { of: entrega })
    return linha
  }

  /** O lote com esse id, no alcance, sem travar: para devolver a entrega como ficou. */
  async lote(entregaId: string): Promise<LoteLido | undefined> {
    const [linha] = await this.#lotes(eq(entrega.id, entregaId))
    return linha
  }

  /**
   * As correções do lote (ou só a de um aluno), com o nome do aluno, em ordem de nome e, no nome repetido, de id. Não
   * confere quem pede: o service chama depois de achar o lote no alcance.
   */
  correcoesDoLote(entregaId: string, alunoId?: string): Promise<CorrecaoLida[]> {
    return this.banco
      .select({
        alunoId: correcao.alunoId,
        nome: usuario.nome,
        acertos: correcao.acertos,
        total: correcao.total,
        emBranco: correcao.emBranco,
        porHabilidade: correcao.porHabilidade,
        destaques: correcao.destaques,
        destaqueAbertoEm: correcao.destaqueAbertoEm,
        saidasDaAba: sql<number>`coalesce(${tentativaAtividade.saidasDaAba}, 0)::int`,
      })
      .from(correcao)
      .innerJoin(usuario, and(eq(usuario.escolaId, correcao.escolaId), eq(usuario.id, correcao.alunoId)))
      .leftJoin(
        tentativaAtividade,
        and(
          eq(tentativaAtividade.escolaId, correcao.escolaId),
          eq(tentativaAtividade.anoLetivoId, correcao.anoLetivoId),
          eq(tentativaAtividade.atividadeAplicadaId, correcao.atividadeAplicadaId),
          eq(tentativaAtividade.alunoId, correcao.alunoId),
        ),
      )
      .where(and(eq(correcao.escolaId, requireEscolaId()), eq(correcao.anoLetivoId, requireAnoEmCurso()), eq(correcao.entregaId, entregaId), alunoId === undefined ? undefined : eq(correcao.alunoId, alunoId)))
      .orderBy(asc(usuario.nome), asc(correcao.alunoId))
  }

  /**
   * Registra a abertura do destaque, **uma vez só**: quem abriu e quando (D56). `false` é o destaque que já estava
   * aberto (a primeira hora fica) ou a correção sem destaque, que não se abre.
   */
  async openDestaque(entregaId: string, alunoId: string): Promise<boolean> {
    const abertas = await this.banco
      .update(correcao)
      .set({ destaqueAbertoEm: sql`now()`, destaqueAbertoPor: requestSessao().usuarioId })
      .where(
        and(
          eq(correcao.escolaId, requireEscolaId()),
          eq(correcao.anoLetivoId, requireAnoEmCurso()),
          eq(correcao.entregaId, entregaId),
          eq(correcao.alunoId, alunoId),
          isNull(correcao.destaqueAbertoEm),
          sql`cardinality(${correcao.destaques}) > 0`,
        ),
      )
      .returning({ id: correcao.id })
    return abertas.length > 0
  }

  /** O registro da validação (D56), com a pessoa da sessão como quem confirmou e a hora do banco. Uma por lote (índice único). */
  async saveValidacao(lote: { readonly entregaId: string; readonly atividadeAplicadaId: string }, apresentado: LoteApresentado, aberto: DestaquesAbertos): Promise<string> {
    const [gravada] = await this.banco
      .insert(validacaoDoLote)
      .values({ escolaId: requireEscolaId(), anoLetivoId: requireAnoEmCurso(), entregaId: lote.entregaId, atividadeAplicadaId: lote.atividadeAplicadaId, apresentado, aberto, confirmadaPor: requestSessao().usuarioId })
      .returning({ id: validacaoDoLote.id })
    if (gravada === undefined) throw new InvariantException('validação não gravada')
    return gravada.id
  }

  /**
   * `pendente` → `aprovada`, com a pessoa da sessão e a hora do banco, e diz se aprovou. Só lote, só no alcance da
   * professora (turma e disciplina). **É o único `update` que aprova lote**, e só roda com sessão de pessoa: sem
   * sessão, `requestSessao` recusa. O gatilho adiado do banco exige a validação gravada na mesma transação.
   */
  async aprovar(entregaId: string): Promise<boolean> {
    const aprovadas = await this.banco
      .update(entrega)
      .set({ estado: 'aprovada', decididaPor: requestSessao().usuarioId, decididaEm: sql`now()` })
      .where(and(this.#escopo(), comVinculoConfirmadoDoProfessor(this.banco, entrega, disciplinaDaEntrega(this.banco, entrega)), eq(entrega.id, entregaId), eq(entrega.estado, 'pendente')))
      .returning({ id: entrega.id })
    return aprovadas.length > 0
  }

  /** A validação do lote, com o nome de quem confirmou (nulo se a pessoa foi eliminada: o id fica). */
  async validacao(entregaId: string): Promise<ValidacaoLida | undefined> {
    const [linha] = await this.banco
      .select({
        id: validacaoDoLote.id,
        apresentado: validacaoDoLote.apresentado,
        aberto: validacaoDoLote.aberto,
        confirmadaPor: validacaoDoLote.confirmadaPor,
        nomeDeQuemConfirmou: usuario.nome,
        confirmadaEm: validacaoDoLote.confirmadaEm,
      })
      .from(validacaoDoLote)
      .leftJoin(usuario, and(eq(usuario.escolaId, validacaoDoLote.escolaId), eq(usuario.id, validacaoDoLote.confirmadaPor)))
      .where(and(eq(validacaoDoLote.escolaId, requireEscolaId()), eq(validacaoDoLote.anoLetivoId, requireAnoEmCurso()), eq(validacaoDoLote.entregaId, entregaId)))
    return linha
  }
}
