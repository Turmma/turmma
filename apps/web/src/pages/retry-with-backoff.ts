import { ErrorCode } from '@educa/shared'
import { ErroDaApi } from '../api/client'

/**
 * O reenvio da reivindicação quando o sistema está cheio (A1, 17.0; Tech Spec da A1, seção 9, "Página pública"; W8).
 *
 * Às 7h30 o semáforo do hash responde 503 com `Retry-After` a quem não coube na vez, sem gravar nada (L9). A página repete
 * **o mesmo pedido, com a mesma `chaveEnvio`**, até três vezes: se um envio anterior chegou a gravar e só a resposta se
 * perdeu, o reenvio responde `enviado` sem pedido novo (E21). Cada reenvio espera o `Retry-After` somado a uma variação
 * aleatória, para trinta computadores da sala que ouviram o mesmo 503 não voltarem todos no mesmo instante. Depois do
 * terceiro, a página para e oferece "Tentar de novo", que é a pessoa quem aperta.
 *
 * Fica fora do componente para ser testado sem DOM: a web não tem ambiente de DOM na unidade.
 */

/** Quantas vezes a página repete o 503 sozinha antes de oferecer "Tentar de novo". */
export const MAXIMO_DE_REENVIOS = 3

/** A espera quando a resposta não trouxe `Retry-After` (a queda de rede, a borda sem instância). */
export const ESPERA_SEM_RETRY_AFTER_SEGUNDOS = 2

/** A maior variação somada à espera: os computadores da sala se espalham por até um segundo depois do `Retry-After`. */
export const VARIACAO_MAXIMA_MS = 1000

/**
 * Quanto esperar antes do reenvio, em milissegundos: o `Retry-After` inteiro, nunca menos, mais a variação sorteada.
 * `aleatorio` é um número em [0, 1), o `Math.random()` da página.
 */
export function esperaDoReenvio(esperaSegundos: number | undefined, aleatorio: number): number {
  const segundos = esperaSegundos !== undefined && esperaSegundos >= 0 ? esperaSegundos : ESPERA_SEM_RETRY_AFTER_SEGUNDOS
  return segundos * 1000 + Math.floor(aleatorio * VARIACAO_MAXIMA_MS)
}

/** O que deu o envio, depois dos reenvios. */
export type DesfechoDoEnvio =
  /** O servidor respondeu `enviado`. */
  | { readonly tipo: 'enviado' }
  /** O 503 voltou depois do terceiro reenvio: a página para e oferece "Tentar de novo". */
  | { readonly tipo: 'cheio' }
  /** Uma resposta que não se repete: a recusa, o limite, o acesso que caiu. */
  | { readonly tipo: 'falhou'; readonly erro: unknown }
  /** A tela mudou enquanto o envio estava no ar (outro link na aba, a página saiu): ninguém olha para a resposta. */
  | { readonly tipo: 'descartado' }

export interface OpcoesDoReenvio {
  /** Espera os milissegundos dados; na página, o `setTimeout`. */
  readonly esperar: (ms: number) => Promise<void>
  /** Um número em [0, 1); na página, o `Math.random`. */
  readonly aleatorio: () => number
  /** Avisa que o 503 chegou e que a página vai repetir: é quando a tela diz "Tentando de novo…". */
  readonly aoEsperar: () => void
  /** Se a tela que pediu o envio ainda é a de agora. */
  readonly valendo: () => boolean
}

const ehSistemaCheio = (erro: unknown): erro is ErroDaApi => erro instanceof ErroDaApi && erro.codigo === ErrorCode.INDISPONIVEL_TENTE_DE_NOVO

/**
 * Manda o envio e repete o 503 até `MAXIMO_DE_REENVIOS` vezes. `enviar` é sempre o mesmo pedido, com a mesma chave: quem
 * chama monta o pedido uma vez e o fecha aqui dentro.
 */
export async function enviarComReenvio(enviar: () => Promise<unknown>, opcoes: OpcoesDoReenvio): Promise<DesfechoDoEnvio> {
  for (let reenvios = 0; ; reenvios++) {
    try {
      await enviar()
      return opcoes.valendo() ? { tipo: 'enviado' } : { tipo: 'descartado' }
    } catch (erro) {
      if (!opcoes.valendo()) return { tipo: 'descartado' }
      if (!ehSistemaCheio(erro)) return { tipo: 'falhou', erro }
      if (reenvios >= MAXIMO_DE_REENVIOS) return { tipo: 'cheio' }
      opcoes.aoEsperar()
      await opcoes.esperar(esperaDoReenvio(erro.esperaSegundos, opcoes.aleatorio()))
      if (!opcoes.valendo()) return { tipo: 'descartado' }
    }
  }
}
