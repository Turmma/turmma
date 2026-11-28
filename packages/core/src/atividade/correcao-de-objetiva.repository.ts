import { and, asc, desc, eq, inArray, lt, lte, ne, sql } from 'drizzle-orm'
import { InvariantException, type DiagnosticoGravado, type MotivoDeDestaque } from '@educa/shared'
import { requireEscolaId } from '../context/context-escola.js'
import { requireAnoEmCurso } from '../context/ano-em-curso.js'
import type { Database, DatabaseTransaction } from '../db/database.js'
import { artefato } from '../db/schema/artefato.js'
import { atividadeAplicada } from '../db/schema/atividade-aplicada.js'
import { correcao } from '../db/schema/correcao.js'
import { entrega } from '../db/schema/entrega.js'
import { respostaAtividade } from '../db/schema/resposta-atividade.js'
import { tentativaAtividade } from '../db/schema/tentativa-atividade.js'
import { MAXIMO_DE_LOTES_NO_HISTORICO, type RespostasDaTentativa } from './correcao-de-objetiva.js'

export interface NovaCorrecao {
  readonly alunoId: string
  readonly acertos: number
  readonly total: number
  readonly emBranco: number
  readonly porHabilidade: DiagnosticoGravado
  readonly destaques: MotivoDeDestaque[]
}

/** A correção de um aluno num lote aprovado: o histórico que explica o `fora_do_historico`. */
export interface CorrecaoDoHistorico {
  readonly alunoId: string
  readonly titulo: string
  readonly acertos: number
  readonly total: number
}

/**
 * As quatro consultas da correção de objetiva que o encerramento e a leitura do lote usam (avaliacao-e-correcao, 6.0; Tech Spec §5.6, "Onde mora o miolo"): se a aplicação já tem lote, as
 * respostas de cada tentativa, o histórico aprovado e a criação do lote com as correções. Moraram em `apps/api` (`CorrecaoRepository`) até a rotina que encerra a prova vencida, que roda no
 * worker e não importa `apps/api`, precisar delas. **Escola e ano são os do contexto, em toda consulta** (regra 10, item 3), e nenhuma confere a professora: quem chama já achou a aplicação no
 * alcance dela (o `encerrar`) ou é a rotina do sistema, que corre sem pessoa. Nenhuma coluna daqui guarda nota, conceito nem texto sobre o aluno (D46, D55, D57).
 */
export class CorrecaoDeObjetivaRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  #escopoDoLote() {
    return and(eq(entrega.escolaId, requireEscolaId()), eq(entrega.anoLetivoId, requireAnoEmCurso()), eq(entrega.tipo, 'lote_de_correcao'))
  }

  /** Se a aplicação já tem lote que não foi rejeitado (pendente ou aprovado): é o que faz o segundo encerramento não corrigir de novo. */
  async hasLoteVigente(atividadeAplicadaId: string): Promise<boolean> {
    const [linha] = await this.banco
      .select({ id: entrega.id })
      .from(entrega)
      .where(and(this.#escopoDoLote(), eq(entrega.atividadeAplicadaId, atividadeAplicadaId), ne(entrega.estado, 'rejeitada')))
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
      .innerJoin(artefato, and(eq(artefato.escolaId, atividadeAplicada.escolaId), eq(artefato.anoLetivoId, atividadeAplicada.anoLetivoId), eq(artefato.id, atividadeAplicada.artefatoId)))
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
  async createLote(aplicacao: { readonly id: string; readonly turmaId: string }, correcoes: readonly NovaCorrecao[]): Promise<string> {
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
}
