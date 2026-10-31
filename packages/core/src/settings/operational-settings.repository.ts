import { eq } from 'drizzle-orm'
import { requireEscolaId } from '../context/context-escola.js'
import type { Database } from '../db/database.js'
import { configuracaoOperacionalEscola, type ConfiguredConcurrency } from '../db/schema/configuracao-operacional-escola.js'

/** O que a escola configurou. Nulo é "usa o padrão do ambiente". */
export interface OperationalSettingsRow {
  fuso: string | null
  diasLetivos: number[] | null
  /** `HH:MM:SS`, como o Postgres devolve `time`. */
  inicio: string | null
  fim: string | null
  limiteReqUsuarioMin: number | null
  limiteReqEscolaMin: number | null
  vagas: ConfiguredConcurrency | null
}

/**
 * `configuracao_operacional_escola` no escopo da escola do contexto (regra 10, item 3): a API lê a
 * da escola do token, e o despachante, a da escola do job, abrindo o contexto dela. Não existe
 * leitura por escola vinda de argumento.
 */
export class OperationalSettingsRepository {
  constructor(private readonly banco: Database) {}

  /** A linha da escola do contexto, ou `undefined` se ela não configurou nada. */
  async daEscola(): Promise<OperationalSettingsRow | undefined> {
    const escolaId = requireEscolaId()
    const [linha] = await this.banco
      .select({
        fuso: configuracaoOperacionalEscola.fuso,
        diasLetivos: configuracaoOperacionalEscola.diasLetivos,
        inicio: configuracaoOperacionalEscola.inicio,
        fim: configuracaoOperacionalEscola.fim,
        limiteReqUsuarioMin: configuracaoOperacionalEscola.limiteReqUsuarioMin,
        limiteReqEscolaMin: configuracaoOperacionalEscola.limiteReqEscolaMin,
        vagas: configuracaoOperacionalEscola.vagas,
      })
      .from(configuracaoOperacionalEscola)
      .where(eq(configuracaoOperacionalEscola.escolaId, escolaId))
    return linha
  }
}
