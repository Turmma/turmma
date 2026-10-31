import { InvalidConfigError, validateEnvironment } from '@educa/core'
import { z } from 'zod'

export interface SalaConfig {
  /**
   * A chave do HMAC do código da turma (`SALA_CHAVE_CODIGO`; Tech Spec da A1, seção 3): o banco guarda só o HMAC do
   * código, e quem lê o banco sem a chave não o recupera sorteando os 31⁸ códigos. Separada da chave dos contadores
   * (`LOGIN_CHAVE_CONTADOR`), que a 7.0 usa para as chaves do Redis: quem tem uma não tem a outra.
   */
  readonly chaveCodigo: Uint8Array
}

export const MOTIVO_CHAVE_DA_SALA_REPETIDA = 'SALA_CHAVE_CODIGO precisa ser diferente das outras chaves: cada HMAC tem a própria chave'

/** Chave de HMAC com pelo menos 256 bits, como as do login; própria, para não mudar junto com elas sem ninguém ver. */
export const TAMANHO_MINIMO_CHAVE_DA_SALA = 32

const salaEnvSchema = z.object({
  SALA_CHAVE_CODIGO: z.string().min(TAMANHO_MINIMO_CHAVE_DA_SALA),
})

/**
 * Lê a chave do código da turma. Não sobe sem ela, com menos de 32 caracteres, nem com o mesmo texto de outra chave do
 * ambiente (toda variável com `_CHAVE_` no nome: a dos contadores, a do dispositivo, a da assinatura, a da recuperação,
 * a de cifra, a do cookie do login externo). As mensagens citam só o nome da variável.
 */
export function loadSalaConfig(ambiente: Record<string, string | undefined>): SalaConfig {
  const { SALA_CHAVE_CODIGO: chave } = validateEnvironment(salaEnvSchema, ambiente)
  const repetida = Object.entries(ambiente).some(([nome, valor]) => nome !== 'SALA_CHAVE_CODIGO' && nome.includes('_CHAVE_') && valor === chave)
  if (repetida) throw new InvalidConfigError(['SALA_CHAVE_CODIGO'], [MOTIVO_CHAVE_DA_SALA_REPETIDA])
  return { chaveCodigo: new TextEncoder().encode(chave) }
}
