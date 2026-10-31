import { artefato, atividadeAplicada, entrega, requireAnoEmCurso, requireEscolaId, requestSessao, usuario, type Database, type DatabaseTransaction } from '@educa/core'
import type { ChaveDeFuncao, EntregasQuery, EstadoDeEntrega, TipoDeEntrega } from '@educa/shared'
import { and, desc, eq, lt, sql, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { InvariantException } from '@educa/shared'
import { comVinculoConfirmadoDoProfessor, disciplinaDaEntrega } from '../assistente/turma-do-professor.repository.js'

/** Uma entrega como o professor da turma a lê: com o título do artefato a que se refere e o nome de quem decidiu. */
export interface EntregaLida {
  readonly id: string
  readonly tipo: TipoDeEntrega
  readonly funcao: ChaveDeFuncao
  readonly estado: EstadoDeEntrega
  readonly turmaId: string
  readonly titulo: string | null
  readonly artefatoId: string | null
  readonly atividadeAplicadaId: string | null
  readonly criadaEm: Date
  readonly decididaEm: Date | null
  readonly decididaPor: string | null
  readonly nomeDeQuemDecidiu: string | null
  readonly justificativa: string | null
}

/** A versão adaptada que acabou de nascer, e que a entrega segura até a aprovação. */
export interface NovaEntregaDeVersaoAdaptada {
  readonly turmaId: string
  readonly artefatoId: string
  readonly execucaoId: string
}

/** O artefato do lote: o da atividade aplicada, que tem o título que a tela mostra. */
const artefatoDoLote = alias(artefato, 'artefato_do_lote')

/**
 * As entregas da escola e do ano letivo do contexto que o professor do contexto alcança: as das turmas em que ele tem
 * vínculo `confirmado` **na disciplina da entrega** (`turma_vinculada`; regra 10, itens 3 e 4; regra 70, item 3). **A
 * turma que autoriza é a da própria entrega**, que o banco prende à do artefato ou da atividade aplicada por FK, e **a
 * disciplina é a do artefato dela** (o da versão adaptada, ou o da atividade aplicada, no lote): nada vem do cliente
 * para autorizar. A professora de outra disciplina da mesma turma não lê nem decide a entrega da colega.
 *
 * Decidir é um `update … where estado = 'pendente'`: a segunda decisão não acha linha e não troca a primeira (regra 80,
 * item 7). Quem decide é a pessoa da **sessão**: sem sessão no contexto, `requestSessao` recusa, e nada é decidido.
 * A justificativa é texto do professor: fica só na linha, e nunca vai a log nem a auditoria (regra 20, item 9).
 */
export class EntregaRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  #noAlcance(): SQL | undefined {
    return and(
      eq(entrega.escolaId, requireEscolaId()),
      eq(entrega.anoLetivoId, requireAnoEmCurso()),
      comVinculoConfirmadoDoProfessor(this.banco, { escolaId: entrega.escolaId, anoLetivoId: entrega.anoLetivoId, turmaId: entrega.turmaId }, disciplinaDaEntrega(this.banco, entrega)),
    )
  }

  #lidas(condicao: SQL | undefined) {
    return this.banco
      .select({
        id: entrega.id,
        tipo: entrega.tipo,
        funcao: entrega.funcao,
        estado: entrega.estado,
        turmaId: entrega.turmaId,
        titulo: sql<string | null>`coalesce(${artefato.titulo}, ${artefatoDoLote.titulo})`,
        artefatoId: entrega.artefatoId,
        atividadeAplicadaId: entrega.atividadeAplicadaId,
        criadaEm: entrega.criadaEm,
        decididaEm: entrega.decididaEm,
        decididaPor: entrega.decididaPor,
        nomeDeQuemDecidiu: usuario.nome,
        justificativa: entrega.justificativa,
      })
      .from(entrega)
      .leftJoin(artefato, and(eq(artefato.escolaId, entrega.escolaId), eq(artefato.anoLetivoId, entrega.anoLetivoId), eq(artefato.id, entrega.artefatoId)))
      .leftJoin(atividadeAplicada, and(eq(atividadeAplicada.escolaId, entrega.escolaId), eq(atividadeAplicada.anoLetivoId, entrega.anoLetivoId), eq(atividadeAplicada.id, entrega.atividadeAplicadaId)))
      .leftJoin(artefatoDoLote, and(eq(artefatoDoLote.escolaId, atividadeAplicada.escolaId), eq(artefatoDoLote.anoLetivoId, atividadeAplicada.anoLetivoId), eq(artefatoDoLote.id, atividadeAplicada.artefatoId)))
      .leftJoin(usuario, and(eq(usuario.escolaId, entrega.escolaId), eq(usuario.id, entrega.decididaPor)))
      .where(and(this.#noAlcance(), condicao))
  }

  /**
   * Uma página das entregas no alcance, **da mais nova para a mais antiga** (o id é `uuidv7`), com uma linha a mais que
   * diz se há próxima. `estado` e `turmaId` só restringem: a turma de outro professor não acha nada.
   */
  listar({ pagina, limite, estado, turmaId }: EntregasQuery): Promise<EntregaLida[]> {
    return this.#lidas(and(estado === undefined ? undefined : eq(entrega.estado, estado), turmaId === undefined ? undefined : eq(entrega.turmaId, turmaId), pagina === undefined ? undefined : lt(entrega.id, pagina)))
      .orderBy(desc(entrega.id))
      .limit(limite + 1)
  }

  /** A entrega com esse id, se está no alcance; a de outra escola, de outro ano, de outra turma ou inexistente não é achada. */
  async porId(id: string): Promise<EntregaLida | undefined> {
    const [linha] = await this.#lidas(eq(entrega.id, id))
    return linha
  }

  /**
   * `pendente` → `aprovada` ou `rejeitada`, numa instrução só, com a pessoa da sessão e a hora do banco, e diz se
   * decidiu. `false` é a entrega que já tinha decisão (ou que saiu do alcance): nada foi gravado.
   */
  async decidir(id: string, estado: 'aprovada' | 'rejeitada', justificativa: string | null): Promise<boolean> {
    const decididas = await this.banco
      .update(entrega)
      .set({ estado, decididaPor: requestSessao().usuarioId, decididaEm: sql`now()`, justificativa })
      .where(and(this.#noAlcance(), eq(entrega.id, id), eq(entrega.estado, 'pendente')))
      .returning({ id: entrega.id })
    return decididas.length > 0
  }

  /**
   * A entrega `pendente` da versão adaptada, na transação que grava o artefato dela (regra 70, item 3): ou nascem as
   * duas, ou nenhuma. A função é a `adaptacao`; o banco prende a turma à do artefato e aceita uma entrega por versão.
   */
  async criarDaVersaoAdaptada(nova: NovaEntregaDeVersaoAdaptada): Promise<string> {
    const [criada] = await this.banco
      .insert(entrega)
      .values({ escolaId: requireEscolaId(), anoLetivoId: requireAnoEmCurso(), turmaId: nova.turmaId, funcao: 'adaptacao', tipo: 'versao_adaptada', artefatoId: nova.artefatoId, execucaoId: nova.execucaoId })
      .returning({ id: entrega.id })
    if (criada === undefined) throw new InvariantException('entrega não criada')
    return criada.id
  }
}
