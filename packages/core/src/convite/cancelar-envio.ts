import { sql } from 'drizzle-orm'
import { convite } from '../db/schema/convite.js'

/**
 * O que a revogação de um convite grava no envio dele, no mesmo `update` que grava `revogado_em`: o envio que ainda não saiu
 * (`na_fila`, `enviando`) vira `cancelado` e perde o token e o endereço cifrados, na hora. O `enviado`, o `falhou` e o
 * `cancelado` ficam como estão, e o convite copiado, que não tem envio, também. O job que acordar depois acha `cancelado` e não
 * envia; o que já está no SMTP termina `enviado` só se a linha ainda é dele, e não é (Tech Spec, seção 5, "E-mail").
 *
 * É um valor só para a revogação do refazer, a do revogar e a defesa do `desativar` não cada uma com a sua cópia da regra.
 */
export const CANCELAR_O_ENVIO_DO_CONVITE = {
  envio: sql`case when ${convite.envio} in ('na_fila', 'enviando') then 'cancelado' else ${convite.envio} end`,
  tokenCifrado: sql`null`,
  destinoCifrado: sql`null`,
  envioReservadoEm: sql`null`,
} as const
