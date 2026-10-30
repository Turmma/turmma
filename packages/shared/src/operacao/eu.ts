import { z } from 'zod'

/**
 * Identificador curto da pessoa da nossa equipe (`joaquim`, `gabriel-s`): o apelido do operador e o `OPERADOR` dos
 * comandos `ops:*`, que vai para `auditoria.autor_operador`. É a única definição no código: o contrato, os comandos e a
 * `RegistroDeAuditoria` a leem. Os checks do banco (`operador_apelido_formato`, `auditoria_operador_formato` e
 * `auditoria_operacao_autor_formato`) não são gerados dela: o schema e a migration os escrevem por extenso, e
 * `packages/nucleo/src/db/formato-do-operador.int.test.ts` prova, no banco migrado, que cada um tem exatamente esta
 * expressão. Mudar uma sem a outra deixa esse teste vermelho.
 */
export const FORMATO_OPERADOR = /^[a-z][a-z0-9-]{1,31}$/

const apelidoDoOperador = z.string().regex(FORMATO_OPERADOR)

/**
 * Corpo de `GET /v1/operacao/eu` (Tech Spec da A0, seção 4): o apelido e o nome do operador da sessão, e nada mais.
 * Estrito: nem id, nem e-mail, nem nada da sessão sai por aqui (seção 7, "DTO de saída").
 */
export const euDoOperadorResponseSchema = z
  .object({
    apelido: apelidoDoOperador,
    nome: z.string().min(1).max(200),
  })
  .strict()

export type EuDoOperadorResponse = z.infer<typeof euDoOperadorResponseSchema>
