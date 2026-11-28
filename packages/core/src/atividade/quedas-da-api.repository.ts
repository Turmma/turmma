import { LIMIAR_DA_LACUNA_MS, type IntervaloDeIndisponibilidade, type PulsoDoLimite } from '@educa/shared'
import { gt, sql } from 'drizzle-orm'
import type { Database, DatabaseTransaction } from '../db/database.js'
import { indisponibilidade, pulsoDaApi } from '../db/schema/prova-online.js'
import { Unscoped } from '../db/unscoped.decorator.js'

/** O que `QuedasDaApiRepository.leituraDesde` devolve: o pulso (e o `now()` do banco) e as indisponibilidades fechadas que terminam depois do começo da tentativa. */
export interface LeituraDasQuedas {
  readonly pulso: PulsoDoLimite | null
  readonly indisponibilidades: IntervaloDeIndisponibilidade[]
}

/**
 * A leitura que `limiteDaTentativa` consome: o pulso e as indisponibilidades **numa consulta só**, com uma visão só do banco (Tech Spec §5.4). Duas leituras deixariam um
 * pulso entre elas e contariam a mesma queda como aberta e como fechada, ou nenhuma das duas. Só as indisponibilidades que terminam depois de `desde` (o começo da tentativa)
 * entram: as anteriores não tocam a prova. Recebe o banco ou a transação de quem chama: o PUT lê na transação dele, e a rotina que encerra a prova vencida, na do `for update`.
 *
 * A consulta parte de `pulso_da_api` com `leftJoin`: com essa tabela vazia (backup restaurado sem ela) as indisponibilidades fechadas também não aparecem, e o limite de quem
 * está em prova encolhe. Dura até o primeiro pulso, que recria a linha (`RECRIAR_A_LINHA`) antes de a instância ouvir a porta.
 *
 * Mora no `core` desde a 6.0 (avaliacao-e-correcao): a API (o PUT, `prova`, `tempo`, o Tutor) e o worker (a rotina) a leem, e o worker não importa `apps/api`.
 */
export class QuedasDaApiRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  @Unscoped('o pulso e a indisponibilidade são fatos globais da API, sem escola nem pessoa: a leitura é a mesma para toda escola, e o escopo da tentativa é de quem a chama')
  async leituraDesde(desde: Date): Promise<LeituraDasQuedas> {
    const linhas = await this.banco
      .select({ ultimoEm: pulsoDaApi.ultimoEm, agora: sql`now()`.mapWith(pulsoDaApi.ultimoEm), inicio: indisponibilidade.inicio, fim: indisponibilidade.fim })
      .from(pulsoDaApi)
      .leftJoin(indisponibilidade, gt(indisponibilidade.fim, desde))
    const [primeira] = linhas
    return {
      pulso: primeira === undefined ? null : { ultimoEm: primeira.ultimoEm, agora: primeira.agora },
      indisponibilidades: linhas.flatMap(({ inicio, fim }) => (inicio === null || fim === null ? [] : [{ inicio, fim }])),
    }
  }
}

/** O pulso está velho: a API ficou mais que o limiar (30 s) sem pulsar, ou a linha do pulso não existe. Nada encerra nesse estado (Tech Spec §5.6). */
export function pulsoEstaVelho(pulso: PulsoDoLimite | null): boolean {
  return pulso === null || pulso.agora.getTime() - pulso.ultimoEm.getTime() > LIMIAR_DA_LACUNA_MS
}
