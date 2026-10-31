/**
 * Horário letivo de uma escola: em que dias da semana e entre que horas, no fuso dela, a escola está
 * em aula. Durante ele, o lote não urgente fica segurado (regra 80, item 2); fora dele, sai.
 *
 * Não conhece feriado: numa quarta de feriado, a quarta é dia letivo e o lote não urgente espera até
 * o fim do horário, sem erro (PRD, casos de borda). O calendário escolar entra no F8.
 */
export interface JanelaLetiva {
  /** Fuso IANA da escola (`America/Sao_Paulo`). A hora que vale é a da parede da escola, nunca UTC. */
  readonly fuso: string
  /** Dias letivos da semana, ISO 8601: 1 é segunda, 7 é domingo. */
  readonly diasLetivos: readonly number[]
  /** Hora local em que o horário letivo começa, `HH:MM` ou `HH:MM:SS`. Incluso: às 07:00 já está dentro. */
  readonly inicio: string
  /** Hora local em que termina, no mesmo formato. Exclusivo: às 18:00 em ponto já está fora. */
  readonly fim: string
}

const MS_POR_SEGUNDO = 1_000
const MS_POR_MINUTO = 60 * MS_POR_SEGUNDO
const MS_POR_HORA = 60 * MS_POR_MINUTO
const MS_POR_DIA = 24 * MS_POR_HORA

/** `HH:MM`, `HH:MM:SS` ou `HH:MM:SS.ffffff`, como o Postgres devolve uma coluna `time`. `24:00` é o fim do dia. */
const FORMATO_HORARIO = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?$/

/** Milissegundos desde a meia-noite, ou `undefined` se o texto não é um horário do dia. */
export function msDoHorario(horario: string): number | undefined {
  const partes = FORMATO_HORARIO.exec(horario)
  if (partes === null) return undefined
  const [, hora = '', minuto = '', segundo = '0', fracao = '0'] = partes
  const ms = Number(hora) * MS_POR_HORA + Number(minuto) * MS_POR_MINUTO + Number(segundo) * MS_POR_SEGUNDO + Math.floor(Number(`0.${fracao}`) * MS_POR_SEGUNDO)
  if (Number(minuto) > 59 || Number(segundo) > 59 || ms > MS_POR_DIA) return undefined
  return ms
}

/** Se o fuso é um nome IANA que o runtime conhece. Fuso desconhecido faria cada consulta da janela lançar. */
export function fusoValido(fuso: string): boolean {
  try {
    formatadorDo(fuso)
    return true
  } catch {
    return false
  }
}

/**
 * Se `agora` cai no horário letivo da escola: dia letivo no fuso dela, com a hora local em
 * `[inicio, fim)`. Fuso desconhecido lança: quem monta a janela o confere antes (`resolverJanela`, `lerJanelaPadrao`).
 */
export function estaNaJanela(janela: JanelaLetiva, agora: Date): boolean {
  return dentro(janela, agora.getTime())
}

/**
 * A partir de quando o lote não urgente pode começar: `agora`, se já está fora do horário letivo; se
 * está dentro, o fim do horário letivo de hoje, no fuso da escola (terça às 10h dá terça às 18h).
 */
export function proximaAbertura(janela: JanelaLetiva, agora: Date): Date {
  const fim = msDoHorario(janela.fim) ?? MS_POR_DIA
  let instante = agora.getTime()
  // Mais de uma volta só num fim às 24:00 emendado com um início às 00:00 do dia seguinte.
  for (let volta = 0; volta < 8 && dentro(janela, instante); volta++) {
    const local = partesLocais(janela.fuso, instante)
    const fimNaParede = local.paredeMs - local.msDoDia + fim
    const convertido = instanteDaParede(janela.fuso, fimNaParede, instante)
    // Numa hora que o horário de verão pula, a conversão pode não andar: anda pela diferença na parede.
    instante = convertido > instante ? convertido : instante + (fim - local.msDoDia)
  }
  return new Date(instante)
}

function dentro(janela: JanelaLetiva, instanteMs: number): boolean {
  const inicio = msDoHorario(janela.inicio)
  const fim = msDoHorario(janela.fim)
  if (inicio === undefined || fim === undefined || inicio >= fim) return false
  const local = partesLocais(janela.fuso, instanteMs)
  return janela.diasLetivos.includes(local.diaDaSemana) && local.msDoDia >= inicio && local.msDoDia < fim
}

const DIA_DA_SEMANA_ISO: Readonly<Record<string, number>> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }

interface PartesLocais {
  diaDaSemana: number
  msDoDia: number
  /** A data e a hora da parede da escola, escritas como se fossem UTC: a diferença para o instante é o deslocamento do fuso. */
  paredeMs: number
}

// Construir um `Intl.DateTimeFormat` custa bem mais do que formatar: um por fuso, reaproveitado.
const formatadores = new Map<string, Intl.DateTimeFormat>()

function formatadorDo(fuso: string): Intl.DateTimeFormat {
  let formatador = formatadores.get(fuso)
  if (formatador === undefined) {
    formatador = new Intl.DateTimeFormat('en-US', {
      timeZone: fuso,
      hourCycle: 'h23',
      weekday: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
    formatadores.set(fuso, formatador)
  }
  return formatador
}

function partesLocais(fuso: string, instanteMs: number): PartesLocais {
  const campos: Record<string, string> = {}
  for (const parte of formatadorDo(fuso).formatToParts(instanteMs)) campos[parte.type] = parte.value
  const numero = (campo: string): number => Number(campos[campo])
  // Os fusos em uso têm deslocamento em minutos inteiros: o milissegundo é o mesmo em qualquer um.
  const ms = new Date(instanteMs).getUTCMilliseconds()
  const msDoDia = numero('hour') * MS_POR_HORA + numero('minute') * MS_POR_MINUTO + numero('second') * MS_POR_SEGUNDO + ms
  const paredeMs = Date.UTC(numero('year'), numero('month') - 1, numero('day')) + msDoDia
  return { diaDaSemana: DIA_DA_SEMANA_ISO[campos['weekday'] ?? ''] ?? 0, msDoDia, paredeMs }
}

/** O instante em que a parede da escola marca `paredeMs`, ajustando o deslocamento do fuso duas vezes (vale na virada de horário de verão). */
function instanteDaParede(fuso: string, paredeMs: number, referenciaMs: number): number {
  const deslocamento = (instanteMs: number): number => partesLocais(fuso, instanteMs).paredeMs - instanteMs
  const aproximado = paredeMs - deslocamento(referenciaMs)
  return paredeMs - deslocamento(aproximado)
}
