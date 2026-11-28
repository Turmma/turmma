import { LIMIAR_DA_LACUNA_MS } from '@educa/shared'
import { and, asc, eq, exists, isNotNull, lt, sql } from 'drizzle-orm'
import { requireAnoEmCurso } from '../context/ano-em-curso.js'
import { requireEscolaId } from '../context/context-escola.js'
import type { Database, DatabaseTransaction } from '../db/database.js'
import { anoLetivo } from '../db/schema/ano-letivo.js'
import { atividadeAplicada } from '../db/schema/atividade-aplicada.js'
import { pulsoDaApi } from '../db/schema/prova-online.js'
import { Unscoped } from '../db/unscoped.decorator.js'

/** A prova aberta cuja janela já passou: só o que o laço do job precisa, para travar e decidir. */
export interface ProvaVencida {
  readonly id: string
  readonly fechaEm: Date
}

/**
 * A listagem das provas vencidas (avaliacao-e-correcao, 6.0; Tech Spec §5.6 e §7c): a avaliativa `aberta`, com janela, do **ano em curso** da escola, cujo `fecha_em` já passou. Quem chama
 * ainda decide se ela venceu de fato (o fim efetivo, com as extensões e as quedas). O índice é o `(fecha_em) where avaliativa and aberta`, que não começa por escola de propósito: a rotina varre todas.
 *
 * - `escolasComProvaVencida` é a **única consulta sem escopo** da rotina: devolve só os ids das escolas, com o pulso fresco numa visão só do banco (com o pulso parado há mais de 30 s, ou sem linha de pulso, devolve vazio: nada encerra durante uma queda).
 * - `vencidasDaEscola` e `abertasComJanelaVencidaHa` são do job de uma escola e da medição dela: escola e ano são os do contexto, nunca de um argumento (regra 10, item 3).
 */
export class ProvasVencidasRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  @Unscoped(
    'rotina por minuto: para gravar um job por escola, a rotina do sistema (sem escola) precisa saber em quais há prova vencida do ano em curso; devolve só os ids das escolas, sem prova, aluno nem dado de pessoa, ' +
      'e não atende requisição de escola nenhuma',
  )
  async escolasComProvaVencida(): Promise<string[]> {
    const linhas = await this.banco
      .selectDistinct({ escolaId: atividadeAplicada.escolaId })
      .from(atividadeAplicada)
      .innerJoin(anoLetivo, and(eq(anoLetivo.escolaId, atividadeAplicada.escolaId), eq(anoLetivo.id, atividadeAplicada.anoLetivoId), eq(anoLetivo.situacao, 'em_curso')))
      .where(
        and(
          eq(atividadeAplicada.avaliativa, true),
          eq(atividadeAplicada.estado, 'aberta'),
          isNotNull(atividadeAplicada.fechaEm),
          lt(atividadeAplicada.fechaEm, sql`now()`),
          exists(this.banco.select({ um: sql`1` }).from(pulsoDaApi).where(sql`now() - ${pulsoDaApi.ultimoEm} <= make_interval(secs => ${LIMIAR_DA_LACUNA_MS / 1000})`)),
        ),
      )
      .orderBy(asc(atividadeAplicada.escolaId))
    return linhas.map(({ escolaId }) => escolaId)
  }

  /** O ano letivo em curso da escola do contexto, ou `undefined` se ela não tem: o job a que a escola não deu ano não encerra nada. */
  async anoEmCursoDaEscola(): Promise<string | undefined> {
    const [linha] = await this.banco
      .select({ id: anoLetivo.id })
      .from(anoLetivo)
      .where(and(eq(anoLetivo.escolaId, requireEscolaId()), eq(anoLetivo.situacao, 'em_curso')))
    return linha?.id
  }

  /** As provas vencidas da escola e do ano do contexto, as de janela mais antiga primeiro, até `limite`: o laço do job (200 por vez, uma transação cada). */
  async vencidasDaEscola(limite: number): Promise<ProvaVencida[]> {
    return this.#abertasAte(sql`now()`, limite)
  }

  /** As provas abertas da escola e do ano do contexto cuja janela passou há mais de `segundos`: o que a medição do alerta olha, antes de conferir o fim efetivo de cada uma. */
  async abertasComJanelaVencidaHa(segundos: number, limite: number): Promise<ProvaVencida[]> {
    return this.#abertasAte(sql`now() - make_interval(secs => ${segundos})`, limite)
  }

  async #abertasAte(corte: ReturnType<typeof sql>, limite: number): Promise<ProvaVencida[]> {
    const linhas = await this.banco
      .select({ id: atividadeAplicada.id, fechaEm: atividadeAplicada.fechaEm })
      .from(atividadeAplicada)
      .where(
        and(
          eq(atividadeAplicada.escolaId, requireEscolaId()),
          eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()),
          eq(atividadeAplicada.avaliativa, true),
          eq(atividadeAplicada.estado, 'aberta'),
          isNotNull(atividadeAplicada.fechaEm),
          lt(atividadeAplicada.fechaEm, corte),
        ),
      )
      .orderBy(asc(atividadeAplicada.fechaEm), asc(atividadeAplicada.id))
      .limit(limite)
    return linhas.flatMap(({ id, fechaEm }) => (fechaEm === null ? [] : [{ id, fechaEm }]))
  }
}
