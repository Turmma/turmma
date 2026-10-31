import { systemClock, type Clock } from '@educa/core'
import { createHmac, timingSafeEqual } from 'node:crypto'

/** Contas lembradas por navegador: no Chromebook do carrinho, uma turma inteira passa pelo mesmo. */
export const MAXIMO_DE_ENTRADAS_DO_DISPOSITIVO = 50
/** Cada entrada sai 30 dias depois do último login daquela conta neste navegador. */
export const VALIDADE_DA_ENTRADA_DO_DISPOSITIVO_MS = 30 * 24 * 60 * 60_000
/** O cookie inteiro dura o mesmo que a entrada mais nova: é regravado a cada login. */
export const MAX_AGE_DO_COOKIE_DISPOSITIVO_SEGUNDOS = VALIDADE_DA_ENTRADA_DO_DISPOSITIVO_MS / 1_000

/** Bytes do HMAC em cada entrada: 128 bits bastam para não haver colisão entre contas, e o cookie cabe em 4 kB. */
const BYTES_DO_HMAC = 16
const FORMATO_DA_ENTRADA = /^([\w-]{22}):([0-9a-z]{1,10})$/
const FOLGA_DE_RELOGIO_MS = 5 * 60_000
const FORMATO_DA_VERSAO = /^[1-9][0-9]?$/

interface Entrada {
  readonly hmac: string
  /** Quando esta conta entrou neste navegador pela última vez, em segundos. */
  readonly segundos: number
}

/**
 * O cookie `educa_dispositivo` (Tech Spec, seção 5, "Passagem"): até 50 entradas `HMAC(chave da versão, e-mail)`,
 * cada uma com a data do último login, e a versão da chave na frente (`1.hmac:data.hmac:data`).
 *
 * - Serve só para dizer que a tentativa vem de um navegador em que a conta já entrou: decide o sufixo `conhecido` do
 *   contador de tentativas, e mais nada. Não dá acesso, não identifica a pessoa e não vai para o registro de acesso.
 * - Sem a chave, ninguém fabrica a entrada de uma conta: um script em outro navegador não se passa por conhecido.
 * - Cookie de outra versão da chave, ou fora do formato, vale como vazio: trocar a chave invalida todos.
 * - A entrada vencida sai; com 50 vivas, sai a mais antiga.
 */
export class DeviceCookie {
  constructor(
    private readonly versao: number,
    private readonly chave: Uint8Array,
    private readonly relogio: Clock = systemClock,
  ) {}

  /** A entrada da conta: o HMAC do identificador já normalizado, com a chave desta versão. */
  entradaDe(identificador: string): string {
    return createHmac('sha256', this.chave).update(identificador).digest().subarray(0, BYTES_DO_HMAC).toString('base64url')
  }

  /** Se a conta já entrou neste navegador nos últimos 30 dias, com a chave atual. */
  conhece(valor: string | undefined, identificador: string): boolean {
    const procurada = Buffer.from(this.entradaDe(identificador))
    return this.#entradasVivas(valor).some((entrada) => {
      const lida = Buffer.from(entrada.hmac)
      return lida.length === procurada.length && timingSafeEqual(lida, procurada)
    })
  }

  /** O valor novo do cookie depois de um login da conta: a entrada dela no topo, com a data de agora. */
  comEntrada(valor: string | undefined, identificador: string): string {
    const nova: Entrada = { hmac: this.entradaDe(identificador), segundos: Math.floor(this.relogio.agora().getTime() / 1_000) }
    const outras = this.#entradasVivas(valor)
      .filter((entrada) => entrada.hmac !== nova.hmac)
      .sort((a, b) => b.segundos - a.segundos)
      .slice(0, MAXIMO_DE_ENTRADAS_DO_DISPOSITIVO - 1)
    return [String(this.versao), ...[nova, ...outras].map((entrada) => `${entrada.hmac}:${entrada.segundos.toString(36)}`)].join('.')
  }

  #entradasVivas(valor: string | undefined): Entrada[] {
    if (valor === undefined) return []
    const [versao, ...partes] = valor.split('.')
    if (versao === undefined || !FORMATO_DA_VERSAO.test(versao) || Number(versao) !== this.versao) return []
    const agora = this.relogio.agora().getTime()
    return partes.slice(0, MAXIMO_DE_ENTRADAS_DO_DISPOSITIVO).flatMap((parte) => {
      const casou = FORMATO_DA_ENTRADA.exec(parte)
      if (casou?.[1] === undefined || casou[2] === undefined) return []
      const segundos = Number.parseInt(casou[2], 36)
      const idadeMs = agora - segundos * 1_000
      // Um pouco no futuro vale: o relógio das duas instâncias da API não é o mesmo ao milissegundo.
      return idadeMs > -FOLGA_DE_RELOGIO_MS && idadeMs < VALIDADE_DA_ENTRADA_DO_DISPOSITIVO_MS ? [{ hmac: casou[1], segundos }] : []
    })
  }
}
