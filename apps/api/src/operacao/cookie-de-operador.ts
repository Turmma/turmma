import { COOKIE_SESSAO_DE_OPERADOR, type Environment } from '@educa/core'
import { type CookieDeDispositivo, lerCookie, MAX_AGE_DO_COOKIE_DISPOSITIVO_SEGUNDOS, serializarCookie } from '../credencial/index.js'
import { COOKIE_DISPOSITIVO_DE_OPERADOR } from './dispositivo-de-operador.js'
import { DURACAO_DA_SESSAO_DE_OPERADOR_HORAS } from './sessao/prazos-da-sessao.js'

/**
 * O cookie de renovação da sessão do operador (Tech Spec da A0, seção 4): o refresh aleatório, cujo SHA-256 é o
 * `sessao_operador.refresh_hash`. Nome próprio, e não o `educa_sessao` da escola: uma área não lê o cookie da outra, e
 * a `AuthGuard` responde a ele, numa rota de escola, igual a uma rota inexistente (C47). O nome mora no
 * núcleo, com a guarda.
 */
export { COOKIE_SESSAO_DE_OPERADOR }

/**
 * Os dois cookies do operador (sessão e dispositivo) só vão a `/v1/operacao/sessao`: nenhuma outra rota da API, nem as
 * da escola, recebe o refresh nem o dispositivo do operador.
 */
export const CAMINHO_DOS_COOKIES_DE_OPERADOR = '/v1/operacao/sessao'

/** A sessão do operador vive até 8 h; o cookie não passa disso. */
const MAX_AGE_DO_COOKIE_DE_SESSAO_SEGUNDOS = DURACAO_DA_SESSAO_DE_OPERADOR_HORAS * 60 * 60

/**
 * O `Set-Cookie` do `turmma_operacao` com o refresh: `HttpOnly`, `SameSite=Strict`, no caminho `/v1/operacao/sessao`,
 * com as 8 h da sessão, e `Secure` fora do ambiente local. Sai na abertura da sessão e em cada rotação da renovação.
 */
export function cookieDeSessaoDeOperador(refresh: string, ambiente: Environment): string {
  return serializarCookie(COOKIE_SESSAO_DE_OPERADOR, refresh, { ambiente, caminho: CAMINHO_DOS_COOKIES_DE_OPERADOR, maxAgeSegundos: MAX_AGE_DO_COOKIE_DE_SESSAO_SEGUNDOS })
}

/**
 * Os `Set-Cookie` da sessão de operador que acabou de abrir no `/sessao/mfa`: o `turmma_operacao` com o refresh e o
 * `turmma_operacao_dispositivo` com a entrada deste e-mail somada às que o navegador já trazia (a 6.0 o lê para a
 * origem `conhecido` do contador; quem o grava é esta rota). Os dois `HttpOnly`, `SameSite=Strict`, no caminho
 * `/v1/operacao/sessao`, e `Secure` fora do ambiente local, pelo `serializarCookie` do F1.
 */
export function cookiesDaSessaoDeOperador(dados: {
  readonly refresh: string
  /** O e-mail do operador, já normalizado: é o identificador da entrada no cookie de dispositivo. */
  readonly email: string
  readonly cabecalhoCookie: string | undefined
  readonly dispositivo: Pick<CookieDeDispositivo, 'comEntrada'>
  readonly ambiente: Environment
}): string[] {
  const caminho = CAMINHO_DOS_COOKIES_DE_OPERADOR
  const dispositivo = dados.dispositivo.comEntrada(lerCookie(dados.cabecalhoCookie, COOKIE_DISPOSITIVO_DE_OPERADOR), dados.email)
  return [
    serializarCookie(COOKIE_DISPOSITIVO_DE_OPERADOR, dispositivo, { ambiente: dados.ambiente, caminho, maxAgeSegundos: MAX_AGE_DO_COOKIE_DISPOSITIVO_SEGUNDOS }),
    cookieDeSessaoDeOperador(dados.refresh, dados.ambiente),
  ]
}
