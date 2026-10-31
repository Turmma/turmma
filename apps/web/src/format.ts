// Data e número sempre pelo Intl em pt-BR (regra 50, item 12). Os formatadores são criados uma vez.

const dataHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
// Data sem hora (`2026-09-13`) é lida em UTC e mostrada em UTC: senão o fuso a leva para o dia anterior.
const dataSemHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' })
const numero = new Intl.NumberFormat('pt-BR')
const dia = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

/** `2026-09-14T13:05:00.000Z` → `14/09/2026, 10:05`, no fuso do navegador. */
export function formatarDataHora(iso: string): string {
  return dataHora.format(new Date(iso))
}

/** `2026-09-13` → `13 de setembro de 2026`. */
export function formatarData(data: string): string {
  return dataSemHora.format(new Date(`${data}T00:00:00Z`))
}

/** `2026-09-14T23:05:00.000Z` → `14/09/2026`, o dia no fuso do navegador, sem a hora: o começo e o fim de uma vigência. */
export function formatarDiaDoInstante(iso: string): string {
  return dia.format(new Date(iso))
}

/** `1234` → `1.234`: número inteiro no formato local, sem unidade. */
export function formatarNumero(quantidade: number): string {
  return numero.format(quantidade)
}

/** `1234` com `aviso`/`avisos` → `1.234 avisos`. Singular só no 1: o CLDR de pt trata 0 como singular, e se escreve "0 avisos". */
export function formatarQuantidade(quantidade: number, singular: string, pluralizado: string): string {
  return `${numero.format(quantidade)} ${quantidade === 1 ? singular : pluralizado}`
}

/** As partes de um instante num fuso, para montar o texto sem depender da pontuação que o Intl escolhe. */
function partesDoInstante(instante: Date, fuso: string | undefined): Record<'day' | 'month' | 'year' | 'hour' | 'minute', string> {
  const formatador = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    ...(fuso === undefined ? {} : { timeZone: fuso }),
  })
  const partes = { day: '', month: '', year: '', hour: '', minute: '' }
  for (const parte of formatador.formatToParts(instante)) if (parte.type in partes) partes[parte.type as keyof typeof partes] = parte.value
  return partes
}

/**
 * `2026-09-19T13:42:00.000Z` → `19/09, 10h42`, no fuso do navegador: o "quando" da linha de aprovação
 * (`docs/interface.md` 11.3). O ano só aparece quando não é o de agora (`19/09/2025, 10h42`): no dia a dia ele é ruído,
 * e na auditoria de um registro antigo a data sem ano diria o dia errado. `fuso` e `agora` existem para o teste.
 */
export function formatarDiaEHora(iso: string, { fuso, agora = new Date() }: { fuso?: string; agora?: Date } = {}): string {
  const instante = partesDoInstante(new Date(iso), fuso)
  const dia = instante.year === partesDoInstante(agora, fuso).year ? `${instante.day}/${instante.month}` : `${instante.day}/${instante.month}/${instante.year}`
  return `${dia}, ${instante.hour}h${instante.minute}`
}
