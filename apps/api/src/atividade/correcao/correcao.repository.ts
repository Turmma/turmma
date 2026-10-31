import {
  artefato,
  atividadeAplicada,
  correcao,
  entrega,
  requireAnoEmCurso,
  requireEscolaId,
  respostaAtividade,
  requestSessao,
  tentativaAtividade,
  usuario,
  validacaoDoLote,
  type Database,
  type DatabaseTransaction,
} from '@educa/core'
import type { DestaquesAbertos, DiagnosticoGravado, EstadoDeEntrega, LoteApresentado, MotivoDeDestaque } from '@educa/shared'
import { and, asc, desc, eq, inArray, isNull, lt, lte, ne, sql, type SQL } from 'drizzle-orm'
import { InvariantException } from '@educa/shared'
import { comVinculoConfirmadoDoProfessor, disciplinaDaEntrega } from '../../assistente/turma-do-professor.repository.js'
import { alunosDaTurma } from '../atividade-aplicada/atividade-aplicada.repository.js'
import { MAXIMO_DE_LOTES_NO_HISTORICO, type RespostasDaTentativa } from './correcao-de-objetiva.js'

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
}

export interface NovaCorrecao {
  readonly alunoId: string
  readonly acertos: number
  readonly total: number
  readonly emBranco: number
  readonly porHabilidade: DiagnosticoGravado
  readonly destaques: MotivoDeDestaque[]
}

export interface ValidacaoLida {
  readonly id: string
  readonly apresentado: unknown
  readonly aberto: unknown
  readonly confirmadaPor: string
  readonly nomeDeQuemConfirmou: string | null
  readonly confirmadaEm: Date
}

/** A correção de um aluno num lote aprovado: o histórico que explica o `fora_do_historico`. */
export interface CorrecaoDoHistorico {
  readonly alunoId: string
  readonly titulo: string
  readonly acertos: number
  readonly total: number
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
  alunosDaTurma: alunosDaTurma(entrega),
}

/**
 * A correção de objetiva no banco (D33, D46, D56): o lote, as correções, a abertura dos destaques e a validação.
 *
 * **Leitura e decisão são da professora com vínculo `confirmado` na turma do lote e na disciplina do artefato**
 * (regra 10, itens 3 e 4): escola, ano e pessoa vêm do contexto, a turma e a disciplina, da própria linha. O que
 * grava correção (`criarLote`) só é chamado de dentro do encerramento, depois de a aplicação ser achada no alcance e
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
  async travarLote(entregaId: string): Promise<LoteLido | undefined> {
    const [linha] = await this.#lotes(eq(entrega.id, entregaId)).for('update', { of: entrega })
    return linha
  }

  /** O lote com esse id, no alcance, sem travar: para devolver a entrega como ficou. */
  async lote(entregaId: string): Promise<LoteLido | undefined> {
    const [linha] = await this.#lotes(eq(entrega.id, entregaId))
    return linha
  }

  /** Se a aplicação já tem lote que não foi rejeitado (pendente ou aprovado): é o que faz o segundo encerramento não corrigir de novo. */
  async temLoteVigente(atividadeAplicadaId: string): Promise<boolean> {
    const [linha] = await this.banco
      .select({ id: entrega.id })
      .from(entrega)
      .where(and(this.#escopo(), eq(entrega.atividadeAplicadaId, atividadeAplicadaId), ne(entrega.estado, 'rejeitada')))
      .limit(1)
    return linha !== undefined
  }

  /**
   * As respostas de cada tentativa da aplicação, pelo aluno (ou só as de um aluno). A tentativa sem resposta entra, com o
   * mapa vazio: é a prova em branco. Uma consulta depois da outra: dentro de transação, a conexão é uma só.
   */
  async respostasPorAluno(atividadeAplicadaId: string, alunoId?: string): Promise<Map<string, RespostasDaTentativa>> {
    const escolaId = requireEscolaId()
    const anoLetivoId = requireAnoEmCurso()
    const tentativas = await this.banco
      .select({ alunoId: tentativaAtividade.alunoId })
      .from(tentativaAtividade)
      .where(and(eq(tentativaAtividade.escolaId, escolaId), eq(tentativaAtividade.anoLetivoId, anoLetivoId), eq(tentativaAtividade.atividadeAplicadaId, atividadeAplicadaId), alunoId === undefined ? undefined : eq(tentativaAtividade.alunoId, alunoId)))
      .orderBy(asc(tentativaAtividade.alunoId))
    const respostas = await this.banco
      .select({ alunoId: respostaAtividade.alunoId, questao: respostaAtividade.questao, alternativa: respostaAtividade.alternativa })
      .from(respostaAtividade)
      .where(and(eq(respostaAtividade.escolaId, escolaId), eq(respostaAtividade.anoLetivoId, anoLetivoId), eq(respostaAtividade.atividadeAplicadaId, atividadeAplicadaId), alunoId === undefined ? undefined : eq(respostaAtividade.alunoId, alunoId)))
    const porAluno = new Map<string, Map<number, number>>(tentativas.map((tentativa) => [tentativa.alunoId, new Map<number, number>()]))
    for (const resposta of respostas) porAluno.get(resposta.alunoId)?.set(resposta.questao, resposta.alternativa)
    return porAluno
  }

  /**
   * As correções dos alunos em lotes **aprovados** (antes de `antes`, se dito), na mesma disciplina, no ano em curso: até
   * `MAXIMO_DE_LOTES_NO_HISTORICO` por aluno, das mais novas para as mais antigas. Correção de lote pendente ou
   * rejeitado não entra: não é resultado que valha. Lê pelo índice `(escola_id, aluno_id, id)`.
   */
  async historicoAprovado(alunoIds: readonly string[], disciplinaId: string, antes?: Date): Promise<CorrecaoDoHistorico[]> {
    if (alunoIds.length === 0) return []
    const ordenadas = this.banco
      .select({
        alunoId: correcao.alunoId,
        titulo: artefato.titulo,
        acertos: correcao.acertos,
        total: correcao.total,
        correcaoId: correcao.id,
        posicao: sql<number>`row_number() over (partition by ${correcao.alunoId} order by ${correcao.id} desc)`.as('posicao'),
      })
      .from(correcao)
      .innerJoin(entrega, and(eq(entrega.escolaId, correcao.escolaId), eq(entrega.id, correcao.entregaId)))
      .innerJoin(atividadeAplicada, and(eq(atividadeAplicada.escolaId, correcao.escolaId), eq(atividadeAplicada.anoLetivoId, correcao.anoLetivoId), eq(atividadeAplicada.id, correcao.atividadeAplicadaId)))
      .innerJoin(artefato, artefatoDaAplicacao)
      .where(
        and(
          eq(correcao.escolaId, requireEscolaId()),
          eq(correcao.anoLetivoId, requireAnoEmCurso()),
          inArray(correcao.alunoId, [...alunoIds]),
          eq(entrega.estado, 'aprovada'),
          antes === undefined ? undefined : lt(entrega.decididaEm, antes),
          eq(artefato.disciplinaId, disciplinaId),
        ),
      )
      .as('ordenadas')
    return this.banco
      .select({ alunoId: ordenadas.alunoId, titulo: ordenadas.titulo, acertos: ordenadas.acertos, total: ordenadas.total })
      .from(ordenadas)
      .where(lte(ordenadas.posicao, MAXIMO_DE_LOTES_NO_HISTORICO))
      .orderBy(asc(ordenadas.alunoId), desc(ordenadas.correcaoId))
  }

  /**
   * O lote e as correções dele, juntos: a entrega nasce `pendente`, da função `correcao_de_objetiva`, na turma da
   * aplicação. O índice único parcial (um lote não rejeitado por aplicação) é a segunda barreira contra o segundo lote.
   */
  async criarLote(aplicacao: { readonly id: string; readonly turmaId: string }, correcoes: readonly NovaCorrecao[]): Promise<string> {
    const escolaId = requireEscolaId()
    const anoLetivoId = requireAnoEmCurso()
    const [criada] = await this.banco
      .insert(entrega)
      .values({ escolaId, anoLetivoId, turmaId: aplicacao.turmaId, funcao: 'correcao_de_objetiva', tipo: 'lote_de_correcao', atividadeAplicadaId: aplicacao.id })
      .returning({ id: entrega.id })
    if (criada === undefined) throw new InvariantException('lote não criado')
    await this.banco.insert(correcao).values(correcoes.map((nova) => ({ escolaId, anoLetivoId, entregaId: criada.id, atividadeAplicadaId: aplicacao.id, ...nova })))
    return criada.id
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
      })
      .from(correcao)
      .innerJoin(usuario, and(eq(usuario.escolaId, correcao.escolaId), eq(usuario.id, correcao.alunoId)))
      .where(and(eq(correcao.escolaId, requireEscolaId()), eq(correcao.anoLetivoId, requireAnoEmCurso()), eq(correcao.entregaId, entregaId), alunoId === undefined ? undefined : eq(correcao.alunoId, alunoId)))
      .orderBy(asc(usuario.nome), asc(correcao.alunoId))
  }

  /**
   * Registra a abertura do destaque, **uma vez só**: quem abriu e quando (D56). `false` é o destaque que já estava
   * aberto (a primeira hora fica) ou a correção sem destaque, que não se abre.
   */
  async abrirDestaque(entregaId: string, alunoId: string): Promise<boolean> {
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
  async gravarValidacao(lote: { readonly entregaId: string; readonly atividadeAplicadaId: string }, apresentado: LoteApresentado, aberto: DestaquesAbertos): Promise<string> {
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
