import type { Redis } from 'ioredis'
import { InvariantException } from '@educa/shared'
import { contextoAtual } from '../contexto/contexto.js'
import { SemEscopo } from '../db/sem-escopo.decorator.js'
import { relogioDoSistema, type Relogio } from '../relogio.js'
import { diaDeUso } from './dia-de-uso.js'

/** O que é contado por escola e por dia: requisição atendida pela API e execução de job no worker. */
export type MetricaDeUso = 'req' | 'jobs'

/**
 * Por quanto tempo o contador de um dia fica no Redis sem ser consolidado. A consolidação roda toda
 * noite e apaga o que gravou; o prazo só existe para o Redis de fila (`noeviction`) não acumular
 * chave se a consolidação ficar parada, e dá mais de um mês para alguém perceber e religá-la.
 */
export const VALIDADE_DO_CONTADOR_SEGUNDOS = 35 * 24 * 60 * 60

/** Quantas chaves cada `SCAN` e cada `MGET` da consolidação pede de uma vez. */
export const CHAVES_POR_LEITURA = 1_000

/** A contagem de um dia fechado de uma escola, como estava no Redis. Métrica sem chave fica ausente. */
export interface ContagemDoDia {
  escolaId: string
  dia: string
  requisicoes?: number
  jobs?: number
}

const FORMATO_CHAVE = /^uso:(\d{4}-\d{2}-\d{2}):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(req|jobs)$/

/**
 * Apaga a chave só se ela ainda tem o valor que a consolidação gravou no banco. Um incremento que
 * chegue entre a leitura e a remoção não se perde: a chave fica, e a próxima consolidação regrava o
 * dia com o valor novo.
 */
const APAGAR_SE_IGUAL = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0`

const JUSTIFICATIVA_LEITURA =
  'a consolidação noturna é rotina nossa e precisa descobrir quais escolas tiveram uso; ' +
  'devolve só escola, dia e contagem, e toda gravação volta ao escopo da escola lida'

export interface OpcoesDoContadorDeUso {
  /** De onde vem a hora que decide o dia. Só o teste troca, para marcar às 23h59 e às 00h01. */
  relogio?: Relogio
  /** Prefixo das chaves. Só o teste troca, para não disputar os contadores com outro teste. */
  prefixo?: string
  /** Chamado quando o incremento falha. A falha nunca chega a quem marcou. */
  aoFalhar?: (erro: unknown) => void
}

/**
 * Contadores de uso por escola e por dia no Redis de fila: `uso:{dia}:{escola}:req|jobs` (Tech Spec,
 * seção 5, "Uso por escola").
 *
 * - `marcar` é disparar e esquecer: não devolve promessa, não espera o Redis e nunca lança. Com o
 *   Redis fora ou travado, a requisição e o job seguem como se o contador não existisse; o que se
 *   perde é só a contagem daquele instante.
 * - A escola vem do contexto (token na API, job no worker), nunca de argumento. Sem escola (rota
 *   anônima, rotina do sistema), nada é contado.
 * - O dia é o de São Paulo no instante da marcação.
 */
export class ContadorDeUso {
  readonly #relogio: Relogio
  readonly #prefixo: string
  readonly #aoFalhar: (erro: unknown) => void

  constructor(
    private readonly redis: Redis,
    opcoes: OpcoesDoContadorDeUso = {},
  ) {
    this.#relogio = opcoes.relogio ?? relogioDoSistema
    this.#prefixo = opcoes.prefixo === undefined ? '' : `${opcoes.prefixo}:`
    this.#aoFalhar = opcoes.aoFalhar ?? (() => undefined)
  }

  /** Soma um na métrica da escola do contexto, no dia de agora. Sem esperar e sem lançar. */
  marcar(metrica: MetricaDeUso): void {
    const escolaId = contextoAtual()?.escolaId
    if (escolaId === undefined) return
    try {
      const chave = this.chave(diaDeUso(this.#relogio.agora()), escolaId, metrica)
      this.redis
        .pipeline()
        .incr(chave)
        // O prazo é fixado no primeiro incremento do dia e não é renovado pelos seguintes.
        .expire(chave, VALIDADE_DO_CONTADOR_SEGUNDOS, 'NX')
        .exec()
        .then((resultados) => {
          const erro = resultados?.find(([falha]) => falha !== null)?.[0]
          if (erro !== undefined && erro !== null) this.#aoFalhar(erro)
        }, this.#aoFalhar)
    } catch (erro) {
      this.#aoFalhar(erro)
    }
  }

  /**
   * As contagens de todos os dias anteriores a `hoje`, de todas as escolas. `hoje` segue aberto e
   * não entra. Chave que sumiu entre o `SCAN` e o `GET` (outra consolidação a apagou) é ignorada.
   */
  @SemEscopo(JUSTIFICATIVA_LEITURA)
  async lerDiasFechados(hoje: string): Promise<ContagemDoDia[]> {
    const chaves: Array<{ chave: string; escolaId: string; dia: string; metrica: MetricaDeUso }> = []
    const vistas = new Set<string>()
    let cursor = '0'
    do {
      const [proximo, lote] = await this.redis.scan(cursor, 'MATCH', `${this.#prefixo}uso:*`, 'COUNT', CHAVES_POR_LEITURA)
      cursor = proximo
      for (const chave of lote) {
        // O SCAN pode devolver a mesma chave duas vezes.
        if (!chave.startsWith(this.#prefixo) || vistas.has(chave)) continue
        const achado = FORMATO_CHAVE.exec(chave.slice(this.#prefixo.length))
        if (achado === null) continue
        const [, dia, escolaId, metrica] = achado as unknown as [string, string, string, MetricaDeUso]
        vistas.add(chave)
        // Comparar texto de data ISO é comparar datas.
        if (dia < hoje) chaves.push({ chave, escolaId, dia, metrica })
      }
    } while (cursor !== '0')

    const contagens = new Map<string, ContagemDoDia>()
    for (let inicio = 0; inicio < chaves.length; inicio += CHAVES_POR_LEITURA) {
      const parte = chaves.slice(inicio, inicio + CHAVES_POR_LEITURA)
      const valores = await this.redis.mget(parte.map(({ chave }) => chave))
      parte.forEach(({ escolaId, dia, metrica }, indice) => {
        const valor = valores[indice]
        if (valor === null || valor === undefined) return
        const chaveDoDia = `${escolaId}:${dia}`
        const contagem = contagens.get(chaveDoDia) ?? { escolaId, dia }
        contagem[metrica === 'req' ? 'requisicoes' : 'jobs'] = Number(valor)
        contagens.set(chaveDoDia, contagem)
      })
    }
    return [...contagens.values()]
  }

  /**
   * Depois de gravar no banco, apaga o contador do dia da escola do contexto, se ele ainda tem o
   * valor gravado. Devolve `true` se apagou.
   */
  async apagarConsolidado(dia: string, metrica: MetricaDeUso, valorGravado: number): Promise<boolean> {
    const escolaId = contextoAtual()?.escolaId
    if (escolaId === undefined) throw new InvariantException('contador de uso sem escola no contexto')
    const apagadas = await this.redis.eval(APAGAR_SE_IGUAL, 1, this.chave(dia, escolaId, metrica), String(valorGravado))
    return apagadas === 1
  }

  private chave(dia: string, escolaId: string, metrica: MetricaDeUso): string {
    return `${this.#prefixo}uso:${dia}:${escolaId}:${metrica}`
  }
}
