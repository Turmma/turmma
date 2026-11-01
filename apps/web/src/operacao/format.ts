import type { UsoDoPainelResponse, UsoDoPeriodoDoPainel } from '@educa/shared'
import { formatNumber, formatQuantity } from '../format'

/**
 * Os formatos da tela Uso do painel da operação (A0b, tarefa 8.0; cenário W5): número, bytes, o dia e o mês de referência
 * e os rótulos de cada medida, em português do Brasil (regra 50, item 12). Regra pura, sem DOM: o teste de unidade prova
 * cada texto.
 */

/** Número inteiro pelo `Intl.NumberFormat('pt-BR')`, o mesmo do resto da web: `1234` → `1.234`. */
export { formatNumber }

/** As unidades acima do byte, na base 1024: é a conta que o sistema operacional do Chromebook e do Windows mostra. */
const UNIDADES_DE_BYTES = ['KB', 'MB', 'GB', 'TB', 'PB'] as const
const BASE_DE_BYTES = 1024

const umaCasa = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

/**
 * Bytes de armazenamento numa unidade que se lê: `0` → `0 bytes`, `1023` → `1.023 bytes`, `1024` → `1 KB`,
 * `1288490189` → `1,2 GB`. Uma casa decimal, no máximo. Quando o arredondamento chega a 1.024 da unidade (1.048.575
 * bytes seriam "1.024 KB"), sobe para a seguinte ("1 MB"): o número mostrado nunca passa de 1.023,9.
 */
export function formatarBytes(bytes: number): string {
  if (bytes < BASE_DE_BYTES) return formatQuantity(bytes, 'byte', 'bytes')
  let valor = bytes / BASE_DE_BYTES
  let unidade = 0
  while (unidade < UNIDADES_DE_BYTES.length - 1 && Math.round(valor * 10) / 10 >= BASE_DE_BYTES) {
    valor /= BASE_DE_BYTES
    unidade++
  }
  return `${umaCasa.format(valor)} ${UNIDADES_DE_BYTES[unidade] ?? 'PB'}`
}

const FORMATO_DO_DIA = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * O dia de referência que a API devolveu (`AAAA-MM-DD`), como se lê: `2026-09-23` → `23/09/2026`. Lido do texto, sem
 * `Date`: o dia é o civil de São Paulo que a API escolheu, e nenhum fuso do navegador o leva para o dia anterior.
 */
export function formatarDia(dia: string): string {
  const partes = FORMATO_DO_DIA.exec(dia)
  if (partes === null) return dia
  const [, ano, mes, numero] = partes
  return `${numero ?? ''}/${mes ?? ''}/${ano ?? ''}`
}

const FORMATO_DO_MES = /^(\d{4})-(0[1-9]|1[0-2])$/

// O dia 15, em UTC: nenhum fuso (±14 h) tira o mês do lugar.
const mesPorExtenso = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/**
 * O mês de referência e até onde ele vai, pelos dois campos que a API devolveu: `{ mes: '2026-09', dia: '2026-09-23' }`
 * → `setembro de 2026, até 23/09`. O mês é contado do dia 1 até o último dia fechado (Tech Spec da A0b, seção 5). A
 * referência fora do formato, que o contrato já recusa, volta como veio, em vez de o `Intl` lançar e derrubar a tela.
 */
export function formatarMesDeReferencia({ mes, dia }: Pick<UsoDoPainelResponse, 'mes' | 'dia'>): string {
  const partes = FORMATO_DO_MES.exec(mes)
  const nome = partes === null ? mes : mesPorExtenso.format(new Date(Date.UTC(Number(partes[1]), Number(partes[2]) - 1, 15)))
  return `${nome}, até ${formatarDia(dia).slice(0, 5)}`
}

/** Os rótulos de cada medida de uso, em minúsculas, como entram no meio de uma frase. */
export const ROTULO_DO_USO: Readonly<Record<keyof UsoDoPeriodoDoPainel, string>> = {
  requisicoes: 'requisições',
  jobs: 'tarefas em segundo plano',
  bytesStorage: 'armazenamento',
}

/** As medidas, na ordem em que a tela as mostra. */
export const MEDIDAS_DO_USO: readonly (keyof UsoDoPeriodoDoPainel)[] = ['requisicoes', 'jobs', 'bytesStorage']

/** O valor de uma medida: bytes na unidade, o resto como número. */
export function formatarMedidaDoUso(medida: keyof UsoDoPeriodoDoPainel, valor: number): string {
  return medida === 'bytesStorage' ? formatarBytes(valor) : formatNumber(valor)
}
