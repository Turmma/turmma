import {
  camposInvalidosDaProva,
  DURACAO_MAXIMA_DA_PROVA_MIN,
  DURACAO_MINIMA_DA_PROVA_MIN,
  type Embaralhar,
  type JanelaDaProva,
  type PercentualDeTempoAdicional,
  type TempoAdicionalDoAluno,
} from '@educa/shared'
import { formatQuantity } from '../../../format'

/**
 * As contas da tela de aplicar a prova que não precisam de tela (avaliacao-e-correcao, 10.0; RF1 a RF3): o horário que o professor escreve
 * vira o instante que a API grava, o que o formulário recusa antes de enviar, o texto do que não cabe e o resumo antes de confirmar.
 *
 * **O horário é o da parede da escola, e não o do navegador**: o professor escreve "10:00" pensando na escola, e o mesmo texto não pode
 * virar outro instante num computador com o fuso trocado. A API recebe o instante em UTC (`janelaDaProvaSchema`).
 */

/** O fuso da escola, o mesmo de `FUSO_DO_USO` na API (o Brasil não tem horário de verão desde 2019, mas a conta não depende disso). */
export const FUSO_DA_PROVA = 'America/Sao_Paulo'

const HORARIO_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

/** As partes de um instante na parede do fuso, em ordem de campo. */
function partesNaParede(instante: number, fuso: string): { ano: number; mes: number; dia: number; hora: number; minuto: number } {
  const formatador = new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const valor = (tipo: Intl.DateTimeFormatPartTypes): number => Number(formatador.formatToParts(instante).find((parte) => parte.type === tipo)?.value ?? Number.NaN)
  return { ano: valor('year'), mes: valor('month'), dia: valor('day'), hora: valor('hour'), minuto: valor('minute') }
}

/** Quanto a parede do fuso está à frente do UTC naquele instante, em milissegundos. */
function adiantoDoFuso(instante: number, fuso: string): number {
  const { ano, mes, dia, hora, minuto } = partesNaParede(instante, fuso)
  return Date.UTC(ano, mes - 1, dia, hora, minuto) - Math.floor(instante / 60_000) * 60_000
}

/**
 * `2026-11-24T10:00` (o que o campo `datetime-local` entrega), na parede da escola → `2026-11-24T13:00:00.000Z`. Texto que não é um horário
 * (campo vazio, data que não existe) devolve `undefined`.
 */
export function instanteDaParedeDaEscola(texto: string, fuso: string = FUSO_DA_PROVA): string | undefined {
  const partes = HORARIO_LOCAL.exec(texto)
  if (partes === null) return undefined
  const [ano, mes, dia, hora, minuto] = partes.slice(1).map(Number) as [number, number, number, number, number]
  const naParede = Date.UTC(ano, mes - 1, dia, hora, minuto)
  const primeiro = naParede - adiantoDoFuso(naParede, fuso)
  // Perto da troca de horário o adianto do instante achado pode ser outro: uma segunda passada o corrige.
  const instante = naParede - adiantoDoFuso(primeiro, fuso)
  const lido = new Date(instante)
  if (Number.isNaN(lido.getTime())) return undefined
  const volta = partesNaParede(instante, fuso)
  // `2026-02-30T10:00` não existe: o instante achado volta como outro dia, e o horário é recusado.
  if (volta.ano !== ano || volta.mes !== mes || volta.dia !== dia || volta.hora !== hora || volta.minuto !== minuto) return undefined
  return lido.toISOString()
}

/** O inverso: `2026-11-24T13:00:00.000Z` → `2026-11-24T10:00`, para o campo `datetime-local` mostrar a janela que já está gravada. */
export function paredeDaEscolaDoInstante(iso: string, fuso: string = FUSO_DA_PROVA): string {
  const { ano, mes, dia, hora, minuto } = partesNaParede(Date.parse(iso), fuso)
  const dois = (numero: number): string => String(numero).padStart(2, '0')
  return `${String(ano).padStart(4, '0')}-${dois(mes)}-${dois(dia)}T${dois(hora)}:${dois(minuto)}`
}

/** `24/11` e `10:00`, na parede da escola. */
function diaEHora(iso: string, fuso: string): { dia: string; hora: string } {
  const { mes, dia, hora, minuto } = partesNaParede(Date.parse(iso), fuso)
  const dois = (numero: number): string => String(numero).padStart(2, '0')
  return { dia: `${dois(dia)}/${dois(mes)}`, hora: `${dois(hora)}:${dois(minuto)}` }
}

interface DadosDoResumo {
  readonly turma: string
  readonly janela: JanelaDaProva
  readonly duracaoMin?: number | undefined
  /** Quantos alunos têm tempo adicional: nunca quais, nem quanto (é adaptação, dado sensível). */
  readonly comTempoAdicional: number
}

/**
 * O resumo antes de confirmar, numa frase, no fuso da escola: "7ºA · abre 24/11 às 10:00 · fecha às 11:40 · 40 min · 2 alunos com tempo
 * adicional". O fim leva o dia só quando não é o mesmo dia da abertura; a duração e o tempo adicional só aparecem quando existem.
 */
export function resumoDaProva({ turma, janela, duracaoMin, comTempoAdicional }: DadosDoResumo, fuso: string = FUSO_DA_PROVA): string {
  const abre = diaEHora(janela.abreEm, fuso)
  const fecha = diaEHora(janela.fechaEm, fuso)
  const partes = [turma, `abre ${abre.dia} às ${abre.hora}`, `fecha ${fecha.dia === abre.dia ? '' : `${fecha.dia} `}às ${fecha.hora}`]
  if (duracaoMin !== undefined) partes.push(`${String(duracaoMin)} min`)
  if (comTempoAdicional > 0) partes.push(`${formatQuantity(comTempoAdicional, 'aluno', 'alunos')} com tempo adicional`)
  return partes.join(' · ')
}

/** O texto de quando a janela não comporta a duração com o maior tempo adicional: os números são os da prova, e a janela pedida é a que cabe. */
export function textoDoTempoQueNaoCabe(duracaoMin: number, maiorPercentual: number): string {
  const janelaMinima = Math.ceil((duracaoMin * (100 + maiorPercentual)) / 100)
  return `O tempo adicional não cabe na janela: com ${String(duracaoMin)} min e +${String(maiorPercentual)}%, a janela precisa de ${String(janelaMinima)} min.`
}

export const TEXTO_DO_ABRE_VAZIO = 'Diga quando a prova abre.'
export const TEXTO_DO_FECHA_VAZIO = 'Diga quando a prova fecha.'
export const TEXTO_DO_FECHA_ANTES_DE_ABRIR = 'A prova precisa fechar depois de abrir.'
export const TEXTO_DA_DURACAO_FORA = `A duração vai de ${String(DURACAO_MINIMA_DA_PROVA_MIN)} a ${String(DURACAO_MAXIMA_DA_PROVA_MIN)} minutos, em número inteiro.`
export const TEXTO_DA_DURACAO_OBRIGATORIA = 'A prova já tem duração: diga a nova. Não dá para tirá-la por aqui.'
export const TEXTO_DO_TEMPO_ADICIONAL_SEM_DURACAO = 'Para dar tempo adicional, diga a duração da prova.'

/** Os campos de horário e duração, como o professor os escreveu: texto, porque é o que o campo guarda. */
export interface CamposDaJanela {
  readonly abre: string
  readonly fecha: string
  readonly duracao: string
}

/** O formulário da prova inteiro: a janela, o embaralhamento e o tempo adicional escolhido por aluno (só quem tem). */
export interface FormularioDaProva extends CamposDaJanela {
  readonly embaralhar: Embaralhar
  readonly tempoAdicional: Readonly<Record<string, PercentualDeTempoAdicional>>
}

export const FORMULARIO_VAZIO_DA_PROVA: FormularioDaProva = {
  abre: '',
  fecha: '',
  duracao: '',
  embaralhar: { questoes: false, alternativas: false },
  tempoAdicional: {},
}

/** O erro de cada campo, ligado a ele na tela. O que não tem erro não aparece. */
export interface ErrosDaProva {
  readonly abre?: string
  readonly fecha?: string
  readonly duracao?: string
  readonly tempoAdicional?: string
}

/** O que a API recebe da prova, já no formato do contrato. */
export interface PedidoDaProva {
  readonly janela: JanelaDaProva
  readonly duracaoMin?: number
  readonly embaralhar: Embaralhar
  readonly tempoAdicional: TempoAdicionalDoAluno[]
}

/** Os dois horários, escritos e conferidos: vazio ou inexistente é erro do campo; o fim tem de vir depois da abertura. */
function conferirOsHorarios(campos: CamposDaJanela): { readonly erros: { abre?: string; fecha?: string }; readonly janela?: JanelaDaProva } {
  const abreEm = instanteDaParedeDaEscola(campos.abre)
  const fechaEm = instanteDaParedeDaEscola(campos.fecha)
  const erros: { abre?: string; fecha?: string } = {}
  if (abreEm === undefined) erros.abre = TEXTO_DO_ABRE_VAZIO
  if (fechaEm === undefined) erros.fecha = TEXTO_DO_FECHA_VAZIO
  if (abreEm === undefined || fechaEm === undefined) return { erros }
  if (Date.parse(fechaEm) <= Date.parse(abreEm)) return { erros: { fecha: TEXTO_DO_FECHA_ANTES_DE_ABRIR } }
  return { erros, janela: { abreEm, fechaEm } }
}

/** A duração, escrita: vazia vale "sem duração"; o que não é inteiro de 5 a 300 é erro do campo. */
function conferirADuracao(texto: string): { readonly erro?: string; readonly duracaoMin?: number } {
  if (texto.trim() === '') return {}
  const duracao = Number(texto)
  if (!Number.isInteger(duracao) || duracao < DURACAO_MINIMA_DA_PROVA_MIN || duracao > DURACAO_MAXIMA_DA_PROVA_MIN) return { erro: TEXTO_DA_DURACAO_FORA }
  return { duracaoMin: duracao }
}

/** O horário e a duração, conferidos sozinhos: o que a mudança de janela e o aplicar têm em comum. */
export function conferirAJanela(campos: CamposDaJanela): { readonly erros: ErrosDaProva; readonly janela?: JanelaDaProva; readonly duracaoMin?: number } {
  const horarios = conferirOsHorarios(campos)
  const duracao = conferirADuracao(campos.duracao)
  const erros: ErrosDaProva = { ...horarios.erros, ...(duracao.erro === undefined ? {} : { duracao: duracao.erro }) }
  if (Object.keys(erros).length > 0 || horarios.janela === undefined) return { erros }
  return { erros, janela: horarios.janela, ...(duracao.duracaoMin === undefined ? {} : { duracaoMin: duracao.duracaoMin }) }
}

/**
 * A mudança de janela conferida: a mesma conferência do horário e da duração, e, se a prova **já tem duração**, o campo não pode ficar vazio (o PATCH é parcial e
 * não tira a duração). Sem erro, o pedido sai com o que mudou de lugar: a janela e, se houver, a duração.
 */
export function conferirAMudancaDeJanela(campos: CamposDaJanela, tinhaDuracao: boolean): { readonly erros: ErrosDaProva; readonly pedido?: { janela: JanelaDaProva; duracaoMin?: number } } {
  const conferida = conferirAJanela(campos)
  if (tinhaDuracao && campos.duracao.trim() === '') return { erros: { ...conferida.erros, duracao: TEXTO_DA_DURACAO_OBRIGATORIA } }
  if (conferida.janela === undefined) return { erros: conferida.erros }
  return { erros: conferida.erros, pedido: { janela: conferida.janela, ...(conferida.duracaoMin === undefined ? {} : { duracaoMin: conferida.duracaoMin }) } }
}

/**
 * O formulário da prova conferido antes de enviar (RF1 a RF3): o erro de cada campo, e, sem erro nenhum, o pedido pronto. É a mesma conferência da
 * API (`camposInvalidosDaProva`, do contrato compartilhado): a tela só diz o campo e o que fazer, e a API continua recusando o que passar.
 */
export function conferirAProva(formulario: FormularioDaProva): { readonly erros: ErrosDaProva; readonly pedido?: PedidoDaProva } {
  const { erros: errosDaJanela, janela, duracaoMin } = conferirAJanela(formulario)
  const tempoAdicional: TempoAdicionalDoAluno[] = Object.entries(formulario.tempoAdicional).map(([alunoId, percentual]) => ({ alunoId, percentual }))
  const erros: { abre?: string; fecha?: string; duracao?: string; tempoAdicional?: string } = { ...errosDaJanela }
  if (tempoAdicional.length > 0 && formulario.duracao.trim() === '') erros.tempoAdicional = TEXTO_DO_TEMPO_ADICIONAL_SEM_DURACAO
  if (Object.keys(erros).length > 0 || janela === undefined) return { erros }
  const prova = { avaliativa: true, janela, duracaoMin, embaralhar: formulario.embaralhar, tempoAdicional }
  // Com janela, duração e tempo adicional preenchidos, o que a conferência compartilhada ainda recusa é o tempo que não cabe: o erro é da janela, no campo "Fecha em".
  if (duracaoMin !== undefined && camposInvalidosDaProva(prova).length > 0) {
    return { erros: { fecha: textoDoTempoQueNaoCabe(duracaoMin, Math.max(...tempoAdicional.map((item) => item.percentual))) } }
  }
  return { erros, pedido: { janela, ...(duracaoMin === undefined ? {} : { duracaoMin }), embaralhar: formulario.embaralhar, tempoAdicional } }
}
