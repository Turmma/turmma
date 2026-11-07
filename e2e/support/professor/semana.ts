import { Client } from 'pg'
import { expect, type Locator, type Page } from '@playwright/test'
import { urlDoBancoDeTeste } from '../../../tools/ci/compose.ts'
import { entrarPelaApiSemMedirAPrimeiraCarga, SIGN_IN_TIMEOUT_MS } from '../casca.ts'
import {
  confirmarVinculosNoBanco,
  criarAlocacaoDoProfessor,
  criarAulasNoBanco,
  criarEquipeComSenha,
  type AlocacaoDeTeste,
  type AulaDeTeste,
  type EquipeDeTeste,
} from '../seed.ts'

/**
 * A cena da aba **Semana** de Turmas (F2b, 6.0): uma professora com turmas confirmadas e a grade delas no banco, **de verdade** (a API, a
 * sessão e o banco são os do compose; só o relógio é o da máquina). Como o servidor lê o relógio dele, o caso nunca fixa uma data: ele
 * parte de **hoje** e conta semanas a partir dele (`proxima` é toda no futuro, `anterior` toda no passado), e o ano letivo é ajustado para
 * rodear o hoje, em vez de ficar nas datas da fixture.
 *
 * As contas de data abaixo são do teste e não repetem as da tela (`semana.ts`): o nome do dia e o mês saem do `Intl`, e não da tabela
 * que o código de produção usa, para um erro de texto lá não se repetir aqui.
 */

const NOMES_DOS_DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const
const MES_POR_EXTENSO = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' })

/** Hoje, `AAAA-MM-DD`, no fuso da escola (o mesmo que a API usa). */
export function hojeEmSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

/** O dia da semana de hoje, como a grade conta (1 = segunda … 7 = domingo). */
export function diaDeHoje(): number {
  return new Date(`${hojeEmSaoPaulo()}T00:00:00Z`).getUTCDay() || 7
}

/**
 * Uma aula no dia da semana de hoje, uma por turma, para o caso que olha o dia de hoje na tela: a API só manda sábado e domingo
 * quando têm aula (RF1), e sem ela, no fim de semana, a coluna de hoje não existe.
 */
export const gradeDeHoje = (indice: number): readonly AulaDeTeste[] => [{ dia: diaDeHoje(), inicio: `0${String(7 + indice)}:30`, fim: `0${String(8 + indice)}:20` }]

export function somar(data: string, dias: number): string {
  const resultado = new Date(`${data}T00:00:00Z`)
  resultado.setUTCDate(resultado.getUTCDate() + dias)
  return resultado.toISOString().slice(0, 10)
}

export function segundaDe(data: string): string {
  const dia = new Date(`${data}T00:00:00Z`).getUTCDay()
  return somar(data, dia === 0 ? -6 : 1 - dia)
}

/** O nome acessível do dia no seletor do celular: "Terça, 10 de novembro". */
export function nomeDoDia(data: string): string {
  const momento = new Date(`${data}T00:00:00Z`)
  return `${NOMES_DOS_DIAS[momento.getUTCDay()]}, ${String(momento.getUTCDate())} de ${MES_POR_EXTENSO.format(momento)}`
}

/** O dia da semana pelo nome só ("Terça"), como o cartão o diz. */
export function diaPorExtenso(data: string): string {
  return NOMES_DOS_DIAS[new Date(`${data}T00:00:00Z`).getUTCDay()] ?? ''
}

async function comBanco<T>(tarefa: (banco: Client) => Promise<T>): Promise<T> {
  const banco = new Client({ connectionString: urlDoBancoDeTeste() })
  await banco.connect()
  try {
    return await tarefa(banco)
  } finally {
    await banco.end()
  }
}

/** O ano letivo em curso da escola, trocado por outro que rodeie o hoje: o servidor lê o relógio da máquina. */
async function ajustarOAno(escolaId: string, inicio: string, fim: string): Promise<void> {
  await comBanco((banco) => banco.query("update ano_letivo set inicio = $2, fim = $3 where escola_id = $1 and situacao = 'em_curso'", [escolaId, inicio, fim]))
}

/** O registro de texto de uma aula (`aula`), direto no banco: o que a professora escreveria no painel (7.0). */
export async function registrarAulaNoBanco(escolaId: string, vinculoId: string, aula: { readonly data: string; readonly inicio: string; readonly fim: string; readonly texto: string }): Promise<void> {
  await comBanco((banco) =>
    banco.query('insert into aula (escola_id, ano_letivo_id, vinculo_id, data, inicio, fim, conteudo) select escola_id, ano_letivo_id, id, $3, $4, $5, $6 from vinculo where escola_id = $1 and id = $2', [
      escolaId,
      vinculoId,
      aula.data,
      aula.inicio,
      aula.fim,
      aula.texto,
    ]),
  )
}

/** O id da disciplina de um vínculo: é o que o `?turma=<turmaId>.<disciplinaId>` leva. */
export async function disciplinaDoVinculo(escolaId: string, vinculoId: string): Promise<string> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ disciplina_id: string }>('select disciplina_id from vinculo where escola_id = $1 and id = $2', [escolaId, vinculoId])
    const id = rows[0]?.disciplina_id
    if (id === undefined) throw new Error('vínculo sem disciplina no banco do e2e')
    return id
  })
}

export interface CenaDaSemana {
  readonly professora: EquipeDeTeste
  /** Uma turma por disciplina pedida, todas confirmadas. */
  readonly turmas: readonly AlocacaoDeTeste[]
  /** A segunda-feira da semana de hoje; `proxima` e `anterior` são as vizinhas. */
  readonly hoje: string
  readonly segunda: string
  readonly proxima: string
  readonly anterior: string
  readonly ano: { readonly inicio: string; readonly fim: string }
}

export interface CenaOptions {
  /** Uma turma por disciplina. Padrão: Matemática, História e Química. */
  readonly disciplinas?: readonly string[]
  /** As aulas da grade de cada turma (índice → aulas). Padrão: a turma 0 e a 1 na terça, a 2 na quarta. */
  readonly grade?: (indiceDaTurma: number) => readonly AulaDeTeste[]
  /** Sem grade nenhuma, como a escola que ainda não importou. */
  readonly semGrade?: boolean
  readonly ano?: { readonly inicio: string; readonly fim: string }
}

const GRADE_PADRAO: readonly (readonly AulaDeTeste[])[] = [
  [{ dia: 2, inicio: '07:30', fim: '08:20' }],
  [{ dia: 2, inicio: '08:20', fim: '09:10' }],
  [{ dia: 3, inicio: '07:30', fim: '08:20' }],
]

/** Uma turma confirmada por disciplina, para a professora. */
async function criarAsTurmas(professora: EquipeDeTeste, disciplinas: readonly string[]): Promise<AlocacaoDeTeste[]> {
  const turmas: AlocacaoDeTeste[] = []
  for (const disciplina of disciplinas) {
    const turma = await criarAlocacaoDoProfessor(professora.escolaId, professora.usuarioId, [disciplina])
    await confirmarVinculosNoBanco(professora.escolaId, turma.vinculoIds)
    turmas.push(turma)
  }
  return turmas
}

/** A grade de cada turma: a pedida, ou a padrão (índice → aulas). */
async function gravarAGrade(escolaId: string, turmas: readonly AlocacaoDeTeste[], grade: CenaOptions['grade']): Promise<void> {
  for (const [indice, turma] of turmas.entries()) {
    const aulas = grade?.(indice) ?? GRADE_PADRAO[indice] ?? []
    const vinculoId = turma.vinculoIds[0]
    if (vinculoId !== undefined && aulas.length > 0) await criarAulasNoBanco(escolaId, vinculoId, aulas)
  }
}

/** Monta a professora, as turmas confirmadas, a grade e o ano que rodeia o hoje. Não entra: quem usa decide como a professora chega. */
export async function montarASemana(opcoes: CenaOptions = {}): Promise<CenaDaSemana> {
  const hoje = hojeEmSaoPaulo()
  const segunda = segundaDe(hoje)
  const ano = opcoes.ano ?? { inicio: somar(segunda, -63), fim: somar(hoje, 70) }
  const professora = await criarEquipeComSenha()
  await ajustarOAno(professora.escolaId, ano.inicio, ano.fim)
  const turmas = await criarAsTurmas(professora, opcoes.disciplinas ?? ['Matemática', 'História', 'Química'])
  if (opcoes.semGrade !== true) await gravarAGrade(professora.escolaId, turmas, opcoes.grade)
  return { professora, turmas, hoje, segunda, proxima: somar(segunda, 7), anterior: somar(segunda, -7), ano }
}

export const caminhoDaSemana = (semana?: string): string => `/professor/turmas?ver=semana${semana === undefined ? '' : `&semana=${semana}`}`

export const tituloDaSemana = (page: Page): Locator => page.getByRole('heading', { name: /^Semana de / })

/** A professora entra pela API e abre a Semana numa carga só, esperando o título dela (a leitura vem depois, com os cartões). */
export async function abrirASemana(page: Page, cena: Pick<CenaDaSemana, 'professora'>, endereco: string = caminhoDaSemana()): Promise<void> {
  await entrarPelaApiSemMedirAPrimeiraCarga(page, cena.professora, endereco, async () => {
    await expect(tituloDaSemana(page)).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
  })
}

/** Abaixo de 768 px a Semana mostra um dia por vez. */
export const noCelular = (page: Page): boolean => (page.viewportSize()?.width ?? 0) < 768

/** O cartão de uma aula pelo nome acessível inteiro ("Terça, 7h30, 7ºA, Matemática"). */
export const cartaoDaAula = (page: Page, nome: string): Locator => page.getByRole('button', { name: nome, exact: true })

/** No celular, escolhe o dia no seletor; no computador, todos os dias já estão à vista. */
export async function irAoDia(page: Page, data: string, hasTouch: boolean): Promise<void> {
  if (!noCelular(page)) return
  const dia = page.getByRole('radio', { name: nomeDoDia(data) })
  if (hasTouch) await dia.tap()
  else await dia.click()
}
