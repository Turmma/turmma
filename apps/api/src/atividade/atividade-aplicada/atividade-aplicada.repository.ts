import { artefato, atividadeAplicada, entrega, requireAnoEmCurso, requireEscolaId, requestSessao, tentativaAtividade, turma, usuario, vinculo, type Database, type DatabaseTransaction } from '@educa/core'
import type { AtividadesAplicadasQuery, EstadoDeAtividadeAplicada, EstadoDeEntrega, TipoDeArtefato } from '@educa/shared'
import { and, desc, eq, lt, sql, type AnyColumn, type SQL } from 'drizzle-orm'
import { InvariantException } from '@educa/shared'
import { comVinculoConfirmadoDoProfessor, disciplinaDoArtefato } from '../../assistente/turma-do-professor.repository.js'

/** Uma atividade aplicada como a professora da turma a lê: só contagem de participação, sem aluno. */
export interface AplicacaoLida {
  readonly id: string
  readonly artefatoId: string
  readonly turmaId: string
  readonly titulo: string
  readonly avaliativa: boolean
  readonly estado: EstadoDeAtividadeAplicada
  readonly questoes: number
  readonly aplicadaEm: Date
  readonly encerradaEm: Date | null
  readonly alunos: number
  readonly iniciaram: number
  readonly enviaram: number
  readonly entrega: { readonly id: string; readonly estado: EstadoDeEntrega } | null
}

/** O artefato que a professora quer aplicar, com o que decide se pode: o tipo, se é versão adaptada, e a entrega dela. */
export interface ArtefatoParaAplicar {
  readonly id: string
  readonly tipo: TipoDeArtefato
  readonly disciplinaId: string
  readonly versaoAdaptada: boolean
  readonly entregaEstado: EstadoDeEntrega | null
}

/** A atividade aplicada travada para o encerramento, com o conteúdo do artefato, que tem o gabarito. */
export interface AplicacaoTravada {
  readonly id: string
  readonly turmaId: string
  readonly estado: EstadoDeAtividadeAplicada
  readonly disciplinaId: string
  readonly conteudo: unknown
}

export interface NovaAplicacao {
  readonly turmaId: string
  readonly artefatoId: string
  readonly avaliativa: boolean
}

/** Quantos alunos a turma tem agora: vínculo de aluno `confirmado`, de usuário ativo. Só a contagem. */
export function alunosDaTurma(colunas: { readonly escolaId: AnyColumn; readonly anoLetivoId: AnyColumn; readonly turmaId: AnyColumn }): SQL<number> {
  return sql<number>`(select count(distinct ${vinculo.usuarioId})::int from ${vinculo} inner join ${usuario} on ${usuario.escolaId} = ${vinculo.escolaId} and ${usuario.id} = ${vinculo.usuarioId} where ${vinculo.escolaId} = ${colunas.escolaId} and ${vinculo.anoLetivoId} = ${colunas.anoLetivoId} and ${vinculo.turmaId} = ${colunas.turmaId} and ${vinculo.papel} = 'aluno' and ${vinculo.estado} = 'confirmado' and ${usuario.desativadoEm} is null)`
}

const tentativasDaAplicacao = (condicao: SQL = sql`true`): SQL<number> =>
  sql<number>`(select count(*)::int from ${tentativaAtividade} where ${tentativaAtividade.escolaId} = ${atividadeAplicada.escolaId} and ${tentativaAtividade.anoLetivoId} = ${atividadeAplicada.anoLetivoId} and ${tentativaAtividade.atividadeAplicadaId} = ${atividadeAplicada.id} and ${condicao})`

/**
 * O lote de correção mais novo da aplicação (o id é `uuidv7`): o pendente ou aprovado, ou, se o último foi rejeitado, o
 * rejeitado. A turma entra no filtro porque é a da aplicação (FK) e é por ela que o índice da entrega começa.
 */
const loteMaisNovo = sql<{ id: string; estado: EstadoDeEntrega } | null>`(select jsonb_build_object('id', ${entrega.id}, 'estado', ${entrega.estado}) from ${entrega} where ${entrega.escolaId} = ${atividadeAplicada.escolaId} and ${entrega.anoLetivoId} = ${atividadeAplicada.anoLetivoId} and ${entrega.turmaId} = ${atividadeAplicada.turmaId} and ${entrega.atividadeAplicadaId} = ${atividadeAplicada.id} order by ${entrega.id} desc limit 1)`

const colunas = {
  id: atividadeAplicada.id,
  artefatoId: atividadeAplicada.artefatoId,
  turmaId: atividadeAplicada.turmaId,
  titulo: artefato.titulo,
  avaliativa: atividadeAplicada.avaliativa,
  estado: atividadeAplicada.estado,
  questoes: sql<number>`jsonb_array_length(${artefato.conteudo} -> 'questoes')`,
  aplicadaEm: atividadeAplicada.aplicadaEm,
  encerradaEm: atividadeAplicada.encerradaEm,
  alunos: alunosDaTurma(atividadeAplicada),
  iniciaram: tentativasDaAplicacao(),
  enviaram: tentativasDaAplicacao(sql`${tentativaAtividade.enviadaEm} is not null`),
  entrega: loteMaisNovo,
}

/**
 * As atividades aplicadas da escola e do ano letivo do contexto que a professora do contexto alcança: as das turmas em
 * que ela tem vínculo `confirmado` **na disciplina do artefato** (`turma_vinculada`; regra 10, itens 3 e 4). A turma e
 * a disciplina que autorizam são as da própria linha, lidas do banco. Coordenação e aluno não têm vínculo de
 * professor: nada é achado. A professora de outra disciplina da mesma turma também não acha nada.
 *
 * Nada daqui serve ao aluno: o conteúdo do artefato tem o gabarito.
 */
export class AtividadeAplicadaRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  #noAlcance(): SQL | undefined {
    return and(
      eq(atividadeAplicada.escolaId, requireEscolaId()),
      eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()),
      comVinculoConfirmadoDoProfessor(this.banco, atividadeAplicada, disciplinaDoArtefato(this.banco, atividadeAplicada)),
    )
  }

  #lidas(condicao: SQL | undefined) {
    return this.banco
      .select(colunas)
      .from(atividadeAplicada)
      .innerJoin(artefato, and(eq(artefato.escolaId, atividadeAplicada.escolaId), eq(artefato.anoLetivoId, atividadeAplicada.anoLetivoId), eq(artefato.id, atividadeAplicada.artefatoId)))
      .where(and(this.#noAlcance(), condicao))
  }

  /** A aplicação com esse id, se está no alcance. A de outra escola, de outro ano, de outra turma, de outra disciplina ou inexistente não é achada. */
  async porId(id: string): Promise<AplicacaoLida | undefined> {
    const [linha] = await this.#lidas(eq(atividadeAplicada.id, id))
    return linha
  }

  /** Uma página das aplicações da turma no alcance, da mais nova para a mais antiga, com uma linha a mais que diz se há próxima. */
  listar({ turmaId, pagina, limite }: AtividadesAplicadasQuery): Promise<AplicacaoLida[]> {
    return this.#lidas(and(eq(atividadeAplicada.turmaId, turmaId), pagina === undefined ? undefined : lt(atividadeAplicada.id, pagina)))
      .orderBy(desc(atividadeAplicada.id))
      .limit(limite + 1)
  }

  /**
   * O artefato que se quer aplicar, se a professora do contexto o alcança: vínculo confirmado na turma **dele**, na
   * disciplina **dele**. Com a entrega da versão adaptada, quando ele é uma.
   */
  async artefatoParaAplicar(artefatoId: string): Promise<ArtefatoParaAplicar | undefined> {
    const [linha] = await this.banco
      .select({ id: artefato.id, tipo: artefato.tipo, disciplinaId: artefato.disciplinaId, origemId: artefato.origemId, entregaEstado: entrega.estado })
      .from(artefato)
      .leftJoin(entrega, and(eq(entrega.escolaId, artefato.escolaId), eq(entrega.anoLetivoId, artefato.anoLetivoId), eq(entrega.artefatoId, artefato.id)))
      .where(
        and(
          eq(artefato.escolaId, requireEscolaId()),
          eq(artefato.anoLetivoId, requireAnoEmCurso()),
          eq(artefato.id, artefatoId),
          comVinculoConfirmadoDoProfessor(this.banco, artefato, artefato.disciplinaId),
        ),
      )
    return linha === undefined ? undefined : { id: linha.id, tipo: linha.tipo, disciplinaId: linha.disciplinaId, versaoAdaptada: linha.origemId !== null, entregaEstado: linha.entregaEstado }
  }

  /** A turma do ano em curso em que a professora do contexto tem vínculo confirmado naquela disciplina: é onde ela pode aplicar. */
  async podeAplicarNaTurma(turmaId: string, disciplinaId: string): Promise<boolean> {
    const [linha] = await this.banco
      .select({ id: turma.id })
      .from(turma)
      .where(
        and(
          eq(turma.escolaId, requireEscolaId()),
          eq(turma.anoLetivoId, requireAnoEmCurso()),
          eq(turma.id, turmaId),
          comVinculoConfirmadoDoProfessor(this.banco, { escolaId: turma.escolaId, anoLetivoId: turma.anoLetivoId, turmaId: turma.id }, disciplinaId),
        ),
      )
    return linha !== undefined
  }

  /**
   * Grava a aplicação, `aberta`, com a pessoa da sessão como quem aplicou (regra 70, item 3). A segunda aberta da mesma
   * turma e do mesmo artefato cai no índice único (23505), que o filtro global traduz em `CONFLITO`.
   */
  async criar(nova: NovaAplicacao): Promise<string> {
    const [criada] = await this.banco
      .insert(atividadeAplicada)
      .values({ escolaId: requireEscolaId(), anoLetivoId: requireAnoEmCurso(), turmaId: nova.turmaId, artefatoId: nova.artefatoId, avaliativa: nova.avaliativa, aplicadaPor: requestSessao().usuarioId })
      .returning({ id: atividadeAplicada.id })
    if (criada === undefined) throw new InvariantException('atividade aplicada não criada')
    return criada.id
  }

  /**
   * A aplicação no alcance, **travada até o fim da transação** (`for update`): o segundo encerramento espera o primeiro,
   * e a resposta, a tentativa e o envio do aluno, que travam a mesma linha em `for share`, esperam ou são esperados. É
   * o que faz o conjunto de tentativas e respostas ficar parado antes da correção (regra 80, item 7).
   */
  async travar(id: string): Promise<AplicacaoTravada | undefined> {
    const [linha] = await this.banco
      .select({ id: atividadeAplicada.id, turmaId: atividadeAplicada.turmaId, estado: atividadeAplicada.estado, disciplinaId: artefato.disciplinaId, conteudo: artefato.conteudo })
      .from(atividadeAplicada)
      .innerJoin(artefato, and(eq(artefato.escolaId, atividadeAplicada.escolaId), eq(artefato.anoLetivoId, atividadeAplicada.anoLetivoId), eq(artefato.id, atividadeAplicada.artefatoId)))
      .where(and(this.#noAlcance(), eq(atividadeAplicada.id, id)))
      .for('update', { of: atividadeAplicada })
    return linha
  }

  /** `aberta` → `encerrada`, com a hora do banco. A já encerrada não muda: a data do primeiro encerramento fica. */
  async encerrar(id: string): Promise<void> {
    await this.banco
      .update(atividadeAplicada)
      .set({ estado: 'encerrada', encerradaEm: sql`now()` })
      .where(and(eq(atividadeAplicada.escolaId, requireEscolaId()), eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()), eq(atividadeAplicada.id, id), eq(atividadeAplicada.estado, 'aberta')))
  }
}
