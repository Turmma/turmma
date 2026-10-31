import { createHmac } from 'node:crypto'
import { type LoginConfig, DeviceCookie } from '../credencial/index.js'
/**
 * O cookie de dispositivo do operador (Tech Spec da A0, seção 5, "Entrada"): o mesmo formato do `educa_dispositivo` do
 * F1, com nome, caminho e chave próprios. Decide só a origem `conhecido`/`outro` do contador `login-op:` e a passagem
 * no semáforo quando o IP passou do limite; não dá acesso nem identifica ninguém (`docs/lgpd.md`, "Cookie de
 * dispositivo").
 *
 * Quem o grava é a entrada completa, depois do segundo fator (`cookiesDaSessaoDeOperador`, em `cookie-de-operador.ts`),
 * no caminho `/v1/operacao/sessao`, o mesmo do `turmma_operacao`; a entrada por e-mail só o lê.
 */
export const OPERADOR_DEVICE_COOKIE = 'turmma_operacao_dispositivo'

/** O rótulo da derivação: a chave do operador sai da do F1 por HMAC, e uma não serve no lugar da outra. */
const ROTULO_DA_CHAVE = 'turmma-operacao-dispositivo'

/**
 * O `DeviceCookie` do operador, com a chave derivada da chave de dispositivo do F1 (`HMAC(chave do F1, rótulo)`)
 * e a mesma versão: trocar a versão do F1 invalida os dois. A entrada da escola para um e-mail não vale como entrada do
 * operador para o mesmo e-mail, nem o contrário.
 */
export function operadorDeviceCookie(dispositivo: LoginConfig['dispositivo']): DeviceCookie {
  return new DeviceCookie(dispositivo.versao, new Uint8Array(createHmac('sha256', dispositivo.chave).update(ROTULO_DA_CHAVE).digest()))
}
