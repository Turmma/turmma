import type { CategoriaDeDadoDoIncidente, RiscoDoIncidente } from '@educa/shared'
import { and, desc, eq, isNull, min, sql } from 'drizzle-orm'
import { requireEscolaId } from '../contexto/escola-do-contexto.js'
import type { Database, DatabaseTransaction } from '../db/banco.js'
import { incidente, incidenteEscola } from '../db/schema/incidente.js'
import { requestIdentity } from '../identidade/guarda-autenticacao.js'

/** Quantos incidentes a leitura devolve: os sem confirmação vêm primeiro, então nenhum pendente fica de fora por causa do corte. */
export const LIMITE_DA_LISTA_DE_INCIDENTES = 50

/** A seção do incidente como a escola a lê: a dela, e nada do que é da operação nem das outras escolas. */
export interface IncidenteLidoPelaEscola {
  /** O id da ligação com a escola: não é o do incidente, que as escolas afetadas dividem. */
  readonly id: string
  readonly conhecidoEm: Date
  readonly circunstancias: string
  readonly categorias: CategoriaDeDadoDoIncidente[]
  readonly titularesEstimados: number
  readonly risco: RiscoDoIncidente
  readonly contencao: string
  readonly correcao: string
  readonly avisadoEm: Date
  readonly confirmadoEm: Date | null
}

/**
 * A seção de incidente da escola do contexto (F3, RF9; Tech Spec do F3, seções 4 e 6), lida e confirmada no escopo dela
 * (regra 10, item 3): `incidente_escola` tem `escola_id`, e todo método começa por ele, vindo do contexto e nunca de argumento.
 * `incidente`, que não tem escola, só entra por junção com a ligação dela, para trazer a data em que a Turmma soube; este
 * arquivo **não escreve** nele. Quem o escreve é o `OperacaoPrivacidadeRepository` (`ops:incidente`), e o expurgo o apaga por prazo.
 *
 * Nenhum método é `@Unscoped`. O incidente de outra escola, o inexistente e o de id mal formado respondem igual para quem pergunta:
 * `existe` e `confirmar` não distinguem (regra 10, item 6).
 */
export class IncidenteDaEscolaRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /** Os incidentes da escola: os sem confirmação primeiro, e dentro de cada grupo o mais recente (pela data em que a Turmma soube). */
  async daEscola(): Promise<IncidenteLidoPelaEscola[]> {
    return this.banco
      .select({
        id: incidenteEscola.id,
        conhecidoEm: incidente.conhecidoEm,
        circunstancias: incidenteEscola.circunstancias,
        categorias: incidenteEscola.categorias,
        titularesEstimados: incidenteEscola.titularesEstimados,
        risco: incidenteEscola.risco,
        contencao: incidenteEscola.contencao,
        correcao: incidenteEscola.correcao,
        avisadoEm: incidenteEscola.avisadoEm,
        confirmadoEm: incidenteEscola.confirmadoEm,
      })
      .from(incidenteEscola)
      .innerJoin(incidente, eq(incidente.id, incidenteEscola.incidenteId))
      .where(eq(incidenteEscola.escolaId, requireEscolaId()))
      .orderBy(sql`${incidenteEscola.confirmadoEm} is not null`, desc(incidente.conhecidoEm), desc(incidenteEscola.id))
      .limit(LIMITE_DA_LISTA_DE_INCIDENTES)
  }

  /** Se a seção existe nesta escola. */
  async existe(id: string): Promise<boolean> {
    const linhas = await this.banco
      .select({ id: incidenteEscola.id })
      .from(incidenteEscola)
      .where(and(eq(incidenteEscola.escolaId, requireEscolaId()), eq(incidenteEscola.id, id)))
    return linhas.length > 0
  }

  /**
   * Confirma o recebimento em nome do usuário da requisição e diz se foi **esta chamada** que confirmou. `where confirmado_em is
   * null` decide a corrida no banco: de duas confirmações ao mesmo tempo só uma altera a linha, a primeira fica, e a outra devolve
   * `false` sem erro.
   */
  async confirmar(id: string): Promise<boolean> {
    const confirmadas = await this.banco
      .update(incidenteEscola)
      .set({ confirmadoEm: sql`now()`, confirmadoPor: requestIdentity().usuarioId })
      .where(and(eq(incidenteEscola.escolaId, requireEscolaId()), eq(incidenteEscola.id, id), isNull(incidenteEscola.confirmadoEm)))
      .returning({ id: incidenteEscola.id })
    return confirmadas.length > 0
  }

  /**
   * Quando a Turmma soube do incidente mais antigo da escola ainda sem confirmação, ou `undefined` se não há nenhum: é o que o
   * alerta de 24 h mede (`incidente.horas_sem_confirmacao`).
   */
  async conhecidoEmDoPendenteMaisAntigo(): Promise<Date | undefined> {
    const [linha] = await this.banco
      .select({ conhecidoEm: min(incidente.conhecidoEm) })
      .from(incidenteEscola)
      .innerJoin(incidente, eq(incidente.id, incidenteEscola.incidenteId))
      .where(and(eq(incidenteEscola.escolaId, requireEscolaId()), isNull(incidenteEscola.confirmadoEm)))
    return linha?.conhecidoEm ?? undefined
  }
}
