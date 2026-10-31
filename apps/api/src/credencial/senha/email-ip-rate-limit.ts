import { throttledWarn, IP_DESCONHECIDO, insuranceLimit, METRICS, systemClock, type Meter, type Clock } from '@educa/core'
import { Logger } from '@nestjs/common'
import { JANELA_DO_CONTADOR_POR_IP_MS, type WindowCounter } from './window-counter.js'

/** O prefixo da chave do contador de tentativas por IP na rota de e-mail, no Redis de fila. */
export const PREFIXO_EMAIL_POR_IP = 'login:email-ip'
/** Quanto o número de escolas da rede de um IP de saída vale sem ser lido de novo. */
export const VALIDADE_DA_REDE_DO_IP_MS = 60_000
/** Teto do cache de rede por IP: passando dele, o cache recomeça. */
const MAXIMO_DE_IPS_NO_CACHE = 10_000

export interface EmailIpRateLimitDependencies {
  readonly janela: Pick<WindowCounter, 'chaveDe' | 'ler' | 'somar'>
  /** `LIMITE_LOGIN_EMAIL_IP_MIN`: tentativas por minuto de um IP na rota de e-mail antes de rebaixar. */
  readonly limitePorMinuto: number
  /** Quantas escolas tem a rede cujo IP de saída (`rede.ips_saida`) é este; 0 quando nenhuma. */
  readonly escolasDaRede: (ip: string) => Promise<number>
  /** Quantas instâncias da API dividem o limite quando a contagem é do seguro em memória (`LIMITE_INSTANCIAS_API`). */
  readonly instancias: number
  readonly medidor: Meter
  readonly relogio?: Clock
}

/**
 * O limite por IP em `/v1/sessao/email` (tarefa 15.2; Tech Spec da identidade, seção 5, "Baldes do semáforo"; regra 80,
 * item 1). Nada é recusado por ele: acima do limite, a tentativa vai para o fim do balde `equipe`.
 *
 * - **Contagem:** toda tentativa na rota conta no minuto do IP, antes do semáforo, exista a conta ou não.
 * - **Limite:** `LIMITE_LOGIN_EMAIL_IP_MIN`. O IP de saída de uma rede (`rede.ips_saida`) recebe o limite vezes o número
 *   de escolas dela, porque a rede municipal sai por um IP só. A rede é lida só depois de o IP passar do limite simples,
 *   com cache de 1 min por IP, na memória da instância.
 * - **Passagem:** quem traz no `educa_dispositivo` a conta que está tentando mantém a vez (a tentativa ainda conta).
 * - **Métrica:** `login.limite_email_ip` conta as tentativas rebaixadas, sem rótulo.
 * - **Seguro:** com a contagem em memória (Redis de fila fora), o limite é dividido pelas instâncias.
 * - **Banco com erro na leitura da rede:** vale o limite simples, com o aviso `login.rede_do_ip_sem_banco` espaçado.
 */
export class EmailIpRateLimit {
  readonly #relogio: Clock
  readonly #rebaixadas: ReturnType<Meter['createCounter']>
  readonly #logger = new Logger('login')
  readonly #avisarRedeSemBanco = throttledWarn(() => this.#logger.warn('login.rede_do_ip_sem_banco'))
  /** IP → escolas da rede dele, por 1 min: o IP fica na memória da instância no máximo o prazo e a varredura seguinte. */
  readonly #redes = new Map<string, { readonly escolas: number; readonly venceEm: number }>()
  #varridoEm = Number.NEGATIVE_INFINITY

  constructor(private readonly dependencias: EmailIpRateLimitDependencies) {
    this.#relogio = dependencias.relogio ?? systemClock
    this.#rebaixadas = dependencias.medidor.createCounter(METRICS.limiteEmailIp, { description: 'Tentativas de login por e-mail rebaixadas pelo limite por IP da rota' })
    // A série nasce em 0 no boot: a taxa do alerta `login-email-limite-ip` conta a primeira rebaixada.
    this.#rebaixadas.add(0)
  }

  /** Conta a tentativa e diz se ela vai para o fim do balde da equipe. */
  async rebaixar(ip: string, conhecido: boolean): Promise<boolean> {
    const { janela, limitePorMinuto, instancias } = this.dependencias
    const { valor, doSeguro } = await janela.somar(janela.chaveDe(PREFIXO_EMAIL_POR_IP, ip))
    const efetivo = (limite: number) => (doSeguro ? insuranceLimit(limite, instancias) : limite)
    if (conhecido || valor <= efetivo(limitePorMinuto)) return false
    if (valor <= efetivo(limitePorMinuto * Math.max(1, await this.#escolasDaRede(ip)))) return false
    this.#rebaixadas.add(1)
    return true
  }

  async #escolasDaRede(ip: string): Promise<number> {
    // O endereço que não foi lido não é IP de rede nenhuma: nem vai ao banco.
    if (ip === IP_DESCONHECIDO) return 0
    const agora = this.#relogio.agora().getTime()
    if (agora - this.#varridoEm >= JANELA_DO_CONTADOR_POR_IP_MS) this.#varrer(agora)
    const guardado = this.#redes.get(ip)
    if (guardado !== undefined && guardado.venceEm > agora) return guardado.escolas
    let escolas: number
    try {
      escolas = await this.dependencias.escolasDaRede(ip)
    } catch {
      // Banco com erro ou lento: o IP vale como de rede nenhuma, sem cache, e o login segue (rebaixado, nunca 500). Só o
      // evento vai ao log, nunca o IP.
      this.#avisarRedeSemBanco()
      return 0
    }
    if (this.#redes.size >= MAXIMO_DE_IPS_NO_CACHE) this.#redes.clear()
    this.#redes.set(ip, { escolas, venceEm: agora + VALIDADE_DA_REDE_DO_IP_MS })
    return escolas
  }

  #varrer(agora: number): void {
    this.#varridoEm = agora
    for (const [ip, guardado] of this.#redes) if (guardado.venceEm <= agora) this.#redes.delete(ip)
  }
}
