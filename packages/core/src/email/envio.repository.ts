import { and, eq, sql } from 'drizzle-orm'
import { requireEscolaId } from '../context/context-escola.js'
import type { Database } from '../db/database.js'
import { convite } from '../db/schema/convite.js'

/** Quanto tempo a reserva de um envio vale: passado isso, o processo que a fez é dado como morto e outro retoma a linha (Tech Spec, seção 5). */
export const MINUTOS_DA_RESERVA_DO_ENVIO = 2

/**
 * O que a reserva do envio do convite devolve:
 * - `reservado`: a linha é do chamador, com o que ele precisa para montar a mensagem; `reserva` é a marca dele, e só com ela a
 *   linha termina `enviado`, `falhou` ou volta a `na_fila`;
 * - `reserva_alheia`: outro processo reservou e a reserva ainda vale, até `ate`;
 * - `encerrado`: o envio já terminou (`enviado`, `falhou`, `cancelado`);
 * - `inexistente`: não há convite com esse id nesta escola. É a mesma resposta para o id da outra escola (regra 10, item 6).
 */
export type ReservaDoEnvio =
  | { readonly resultado: 'reservado'; readonly reserva: Date; readonly tokenCifrado: Buffer; readonly destinoCifrado: Buffer; readonly escola: string }
  | { readonly resultado: 'reserva_alheia'; readonly ate: Date }
  | { readonly resultado: 'encerrado' }
  | { readonly resultado: 'inexistente' }

/**
 * O envio do convite por e-mail, do lado do worker (acesso-e-convites, tarefa 1.0; Tech Spec, seções 5 e 6). Tudo leva a escola
 * do contexto do job, que o executor tirou da linha dele (`job_registro`) e nunca do payload (regra 10, item 3).
 *
 * A reserva é **um `update` só**, e o Postgres a decide: o segundo processo espera a linha do primeiro, relê a condição e não a
 * encontra mais livre. O envio acontece fora de qualquer transação, e a marca da reserva (`envio_reservado_em`, com a
 * precisão de milissegundo, a que o JavaScript guarda) é o que prova, no fim, que a linha ainda é de quem enviou.
 */
export class EnvioRepository {
  constructor(private readonly banco: Database) {}

  /**
   * Reserva o convite para o chamador, se ele está `na_fila` ou `enviando` com a reserva vencida (mais de
   * `MINUTOS_DA_RESERVA_DO_ENVIO`), e devolve o token e o endereço cifrados com o nome da escola. Sem a reserva, diz por quê.
   */
  async reservar(conviteId: string): Promise<ReservaDoEnvio> {
    const escolaId = requireEscolaId()
    const { rows } = await this.banco.execute<{ reserva: Date; tokenCifrado: Buffer; destinoCifrado: Buffer; escola: string }>(sql`
      with reservado as (
        update convite
        set envio = 'enviando', envio_reservado_em = date_trunc('milliseconds', clock_timestamp())
        where escola_id = ${escolaId} and id = ${conviteId}
          and (envio = 'na_fila' or (envio = 'enviando' and envio_reservado_em <= now() - make_interval(mins => ${MINUTOS_DA_RESERVA_DO_ENVIO})))
        returning escola_id, envio_reservado_em, token_cifrado, destino_cifrado
      )
      select reservado.envio_reservado_em as reserva, reservado.token_cifrado as "tokenCifrado", reservado.destino_cifrado as "destinoCifrado", escola.nome as escola
      from reservado join escola on escola.id = reservado.escola_id
    `)
    const reservado = rows[0]
    // O `execute` cru devolve o instante como o driver o entrega (texto, em parte das configurações): a marca volta a `Date` aqui,
    // porque é com ela que `concluir` e `devolver` comparam a coluna, e a precisão de milissegundo é a do `Date`.
    if (reservado !== undefined) return { resultado: 'reservado', ...reservado, reserva: new Date(reservado.reserva) }
    const [atual] = await this.banco
      .select({ envio: convite.envio, reservadoEm: convite.envioReservadoEm })
      .from(convite)
      .where(and(eq(convite.escolaId, escolaId), eq(convite.id, conviteId)))
    if (atual === undefined) return { resultado: 'inexistente' }
    if (atual.envio === 'enviando' && atual.reservadoEm !== null) return { resultado: 'reserva_alheia', ate: new Date(atual.reservadoEm.getTime() + MINUTOS_DA_RESERVA_DO_ENVIO * 60_000) }
    return { resultado: 'encerrado' }
  }

  /**
   * Termina o envio com o desfecho dado, e só se a linha ainda é de quem reservou: `envio = 'enviando'` e a marca dele. Perde os
   * cifrados. Devolve se gravou; `false` é a linha que a revogação cancelou, ou que outro processo retomou, enquanto o e-mail ia.
   */
  async concluir(conviteId: string, reserva: Date, desfecho: 'enviado' | 'falhou'): Promise<boolean> {
    const gravados = await this.banco
      .update(convite)
      .set({
        envio: desfecho,
        enviadoEm: desfecho === 'enviado' ? sql`now()` : null,
        tokenCifrado: null,
        destinoCifrado: null,
        envioReservadoEm: null,
      })
      .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.id, conviteId), eq(convite.envio, 'enviando'), eq(convite.envioReservadoEm, reserva)))
      .returning({ id: convite.id })
    return gravados.length === 1
  }

  /** Devolve a linha a `na_fila` (o SMTP pediu para tentar depois), com os cifrados, sob a mesma condição de `concluir`. */
  async devolver(conviteId: string, reserva: Date): Promise<boolean> {
    const gravados = await this.banco
      .update(convite)
      .set({ envio: 'na_fila', envioReservadoEm: null })
      .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.id, conviteId), eq(convite.envio, 'enviando'), eq(convite.envioReservadoEm, reserva)))
      .returning({ id: convite.id })
    return gravados.length === 1
  }
}
