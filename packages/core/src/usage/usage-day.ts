/**
 * O fuso em que o dia de uso vira. É o do contrato e o do horário letivo das escolas do recorte:
 * a requisição das 23h59 de São Paulo é daquele dia, mesmo já sendo o dia seguinte em UTC.
 */
export const FUSO_DO_USO = 'America/Sao_Paulo'

/** `AAAA-MM-DD`. */
export const FORMATO_DIA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
/** `AAAA-MM`. */
export const FORMATO_MES = /^\d{4}-(0[1-9]|1[0-2])$/

const formatador = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_DO_USO, year: 'numeric', month: '2-digit', day: '2-digit' })

/** O dia civil do instante em São Paulo, como `AAAA-MM-DD`. */
export function diaDeUso(instante: Date): string {
  const partes = Object.fromEntries(formatador.formatToParts(instante).map((parte) => [parte.type, parte.value]))
  return `${partes['year']}-${partes['month']}-${partes['day']}`
}

/** `true` só para um dia do calendário que existe (`2026-02-30` não existe). */
export function diaValido(dia: string): boolean {
  if (!FORMATO_DIA.test(dia)) return false
  return new Date(`${dia}T00:00:00Z`).toISOString().slice(0, 10) === dia
}

/** O dia anterior no calendário. Aritmética de calendário, sem fuso: `2027-01-01` → `2026-12-31`. */
export function diaAnterior(dia: string): string {
  const data = new Date(`${dia}T00:00:00Z`)
  data.setUTCDate(data.getUTCDate() - 1)
  return data.toISOString().slice(0, 10)
}

/** O primeiro e o último dia do mês `AAAA-MM`. */
export function limitesDoMes(mes: string): { primeiro: string; ultimo: string } {
  const [ano, numero] = mes.split('-').map(Number) as [number, number]
  // Dia 0 do mês seguinte é o último deste.
  const ultimo = new Date(Date.UTC(ano, numero, 0)).toISOString().slice(0, 10)
  return { primeiro: `${mes}-01`, ultimo }
}
