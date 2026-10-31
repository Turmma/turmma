import {
  ALFABETO_DO_CODIGO_DE_RECUPERACAO,
  DIGITOS_DO_CODIGO_MFA,
  QUANTIDADE_DE_CODIGOS_DE_RECUPERACAO,
  TAMANHO_DO_CODIGO_DE_RECUPERACAO,
} from '@educa/shared'
import { createHmac, randomInt } from 'node:crypto'
import { Secret, TOTP } from 'otpauth'

/** Parâmetros do TOTP (Tech Spec, seção 5, "TOTP"): os que todo app autenticador de computador aceita. */
export const ALGORITMO_TOTP = 'SHA1'
export const PERIODO_TOTP_SEGUNDOS = 30
/** Um passo para cada lado: o relógio do computador da escola pode estar até 30 s fora. */
export const JANELA_TOTP = 1
/** Bytes do segredo: 160 bits, o tamanho do SHA1 (RFC 4226). */
export const BYTES_DO_SEGREDO = 20
/** Quem emite, como o app autenticador mostra. Nada da pessoa: nem nome, nem e-mail, nem escola. */
const EMISSOR_TOTP = 'Educa.ia'
const ROTULO_TOTP = 'coordenação'
/** O rótulo do segredo do operador Turmma (A0): no app autenticador, a conta da operação não se confunde com a da escola. */
export const ROTULO_TOTP_DA_OPERACAO = 'operação'

/** O segredo recém-gerado: os bytes (que só vão para a cifra), o base32 e a URI que a pessoa leva ao app. */
export interface SegredoNovo {
  readonly bytes: Uint8Array
  readonly base32: string
  readonly uri: string
}

function totp(segredo: Secret, rotulo = ROTULO_TOTP): TOTP {
  return new TOTP({ issuer: EMISSOR_TOTP, label: rotulo, secret: segredo, algorithm: ALGORITMO_TOTP, digits: DIGITOS_DO_CODIGO_MFA, period: PERIODO_TOTP_SEGUNDOS })
}

/** O segredo novo; o rótulo só muda o que o app autenticador mostra (o da escola, sem ele; o do operador, `operação`). */
export function gerarSegredo(rotulo = ROTULO_TOTP): SegredoNovo {
  const segredo = new Secret({ size: BYTES_DO_SEGREDO })
  return { bytes: new Uint8Array(segredo.bytes), base32: segredo.base32, uri: totp(segredo, rotulo).toString() }
}

/**
 * O passo (contador de 30 s desde 1970) do código, se ele vale agora com a janela de um passo para cada lado, ou
 * `undefined`. Quem chama grava o passo com `update … where mfa_ultimo_passo < $passo`: o mesmo código não passa
 * duas vezes, nem o de um passo já usado.
 */
export function passoDoCodigo(segredo: Uint8Array, codigo: string, agora: Date): number | undefined {
  const timestamp = agora.getTime()
  const delta = totp(new Secret({ buffer: segredo.slice().buffer })).validate({ token: codigo, timestamp, window: JANELA_TOTP })
  if (delta === null) return undefined
  return TOTP.counter({ period: PERIODO_TOTP_SEGUNDOS, timestamp }) + delta
}

/** Os dez códigos de recuperação, sorteados com `randomInt` sobre o alfabeto sem símbolos que se confundem. */
export function gerarCodigosDeRecuperacao(): string[] {
  return Array.from({ length: QUANTIDADE_DE_CODIGOS_DE_RECUPERACAO }, () =>
    Array.from({ length: TAMANHO_DO_CODIGO_DE_RECUPERACAO }, () => ALFABETO_DO_CODIGO_DE_RECUPERACAO[randomInt(ALFABETO_DO_CODIGO_DE_RECUPERACAO.length)]).join(''),
  )
}

const FORMATO_DA_RECUPERACAO = new RegExp(`^[${ALFABETO_DO_CODIGO_DE_RECUPERACAO}]{${String(TAMANHO_DO_CODIGO_DE_RECUPERACAO)}}$`)

/**
 * O código de recuperação como foi gerado: maiúsculas, sem espaço nem hífen (a pessoa copia do papel como der). Fora
 * do alfabeto ou do tamanho, `undefined`: não há código assim, e a tentativa conta como erro.
 */
export function normalizarRecuperacao(digitado: string): string | undefined {
  const normalizado = digitado.replace(/[\s-]/g, '').toUpperCase()
  return FORMATO_DA_RECUPERACAO.test(normalizado) ? normalizado : undefined
}

/** O HMAC-SHA256 do código normalizado, em base64url (43 caracteres): é o que `codigo_recuperacao.hmac` guarda. */
export function hmacDaRecuperacao(chave: Uint8Array, codigo: string): string {
  return createHmac('sha256', chave).update(codigo).digest('base64url')
}
