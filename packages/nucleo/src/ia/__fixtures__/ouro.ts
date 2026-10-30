import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import type { AssistenteInput } from '../tarefas/propor-ferramenta.js'
import type { TutorInput } from '../tarefas/turno-do-tutor.js'

/**
 * O corpus `ouro` (`docs/aia/ouro/`): as frases que **não** foram usadas para escrever os padrões das políticas de
 * conformidade, e o `MEDIDAS.json`, com a `base` medida em 21/10/2026 e o alvo de cada política. Este arquivo só lê:
 * quem altera o `ouro` é o Arquiteto, e o Implementador nunca o toca (README do `ouro`, "Quem altera").
 */

export const POLITICAS = ['riscoAVida', 'assuntoDelicado', 'pedidoDeRespostaPronta', 'julgamentoDeTextoDeAluno', 'saidaComNota', 'saidaQualitativa'] as const
export type Politica = (typeof POLITICAS)[number]

/**
 * A pasta do `ouro`, a partir do módulo que a pede: `import.meta.url`, e nunca o diretório de onde o teste foi
 * chamado. O padrão é este arquivo, cinco pastas abaixo da raiz do repositório (`packages/nucleo/src/ia/__fixtures__`).
 */
export function raizDoOuro(urlDoModulo: string = import.meta.url): string {
  return fileURLToPath(new URL('../../../../../docs/aia/ouro', urlDoModulo))
}

/** Toda chave a mais é recusada: campo novo no `ouro` ou no `MEDIDAS` é decisão do Arquiteto, e não passa calado. */
const fechado = z.strictObject

const contextoSchema = fechado({
  comQuestao: z.boolean().optional(),
  turnoAnteriorDoAluno: z.string().min(1).optional(),
  turnosDoProfessor: z.array(z.string().min(1)).optional(),
  mensagemDoProfessor: z.string().min(1).optional(),
})

const amostraSchema = fechado({
  id: z.string().regex(/^[A-Z]{2}-\d{3}$/),
  texto: z.string().min(1),
  categoria: z.string().min(1),
  esperado: z.enum(['casa', 'nao_casa']),
  fonte: z.enum(['sintetica', 'revisor']),
  contexto: contextoSchema.optional(),
})
export type Amostra = z.infer<typeof amostraSchema>

function corpusSchema(politica: Politica) {
  return fechado({
    politica: z.literal(politica),
    regra: z.string().min(1),
    escritoPor: z.string().min(1),
    versao: z.number().int().min(1),
    amostras: z.array(amostraSchema).min(1),
  }).superRefine((corpus, contexto) => {
    const vistos = new Set<string>()
    for (const amostra of corpus.amostras) {
      if (vistos.has(amostra.id)) contexto.addIssue({ code: 'custom', message: `o id ${amostra.id} aparece duas vezes` })
      vistos.add(amostra.id)
    }
  })
}
export type Corpus = z.infer<ReturnType<typeof corpusSchema>>

export function lerJson(nome: string, raiz: string = raizDoOuro()): unknown {
  return JSON.parse(readFileSync(join(raiz, nome), 'utf8'))
}

export function interpretarCorpus(politica: Politica, bruto: unknown): Corpus {
  return corpusSchema(politica).parse(bruto)
}

export function lerCorpus(politica: Politica, raiz: string = raizDoOuro()): Corpus {
  return interpretarCorpus(politica, lerJson(`${politica}.json`, raiz))
}

const contagemSchema = fechado({
  certos: z.number().int().min(0),
  total: z.number().int().min(1),
}).refine((contagem) => contagem.certos <= contagem.total, { message: 'certos passa do total' })
const proporcao = z.number().min(0).max(1)

const baseSchema = fechado({
  medidaEm: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recall: proporcao,
  precisao: proporcao,
  porCategoria: z.record(z.string(), contagemSchema),
})
export type Base = z.infer<typeof baseSchema>

const naoCairDaBase = z.literal('nao_cair_da_base')
const tarefaDoDocumento = z.string().regex(/^\d+\.0$/)

/**
 * Cada política tem a sua forma de alvo, e a string `nao_cair_da_base` só vale onde a política já tem `base`: política
 * nova (sem função até a tarefa dela) tem alvo absoluto, nunca igual à base (onda-0 §2.1, R42).
 */
const medidasSchema = fechado({
  riscoAVida: fechado({
    base: baseSchema,
    alvo: fechado({
      erraPara: z.literal('mais'),
      perdaMaxima: z.record(z.string(), z.number().int().min(0)),
      precisaoMinima: proporcao,
    }),
    foraDoAlvo: z.array(z.string()),
    pisoForaDoAlvo: z.record(z.string(), naoCairDaBase),
  }),
  assuntoDelicado: fechado({ base: baseSchema, alvo: naoCairDaBase }),
  pedidoDeRespostaPronta: fechado({ base: baseSchema, alvo: naoCairDaBase }),
  julgamentoDeTextoDeAluno: fechado({
    base: baseSchema,
    alvo: fechado({
      recall: proporcao,
      semCasar: z.array(z.string()),
      medidoSem: z.array(z.string()),
      naoCairDaBase: z.array(z.string()),
    }),
  }),
  saidaComNota: fechado({ base: baseSchema, alvo: naoCairDaBase }),
  saidaQualitativa: fechado({
    base: baseSchema.nullable(),
    alvo: fechado({ recall: proporcao, legitimasBarradas: z.number().int().min(0) }),
    semBaseAte: tarefaDoDocumento.optional(),
  }).refine((medida) => medida.base !== null || medida.semBaseAte !== undefined, { message: 'base nula só com semBaseAte' }),
})
export type Medidas = z.infer<typeof medidasSchema>

/** O `ouro` ou o `MEDIDAS` que não confere com o corpus: o teste distingue esta recusa de um erro qualquer. */
export class GoldenRejectedError extends Error {}

/** Se a tarefa do documento (`"3.0"`) já está concluída. O padrão lê a lista de tarefas da reengenharia, `tasks.md`. */
export type TarefaConcluida = (tarefa: string) => boolean

export function tarefaConcluidaNaLista(raizDoRepositorio: string): TarefaConcluida {
  const lista = readFileSync(join(raizDoRepositorio, 'tasks/prd-reengenharia/tasks.md'), 'utf8')
  return (tarefa) => new RegExp(String.raw`^- \[x\] \*\*${tarefa.replace('.', String.raw`\.`)} `, 'm').test(lista)
}

/** A raiz do repositório, que fica três pastas acima do `ouro` (`docs/aia/ouro`). */
const raizDoRepositorio = (raiz: string): string => join(raiz, '../../..')

export function interpretarMedidas(bruto: unknown, corpora: Readonly<Record<Politica, Corpus>>, tarefaConcluida: TarefaConcluida): Medidas {
  const medidas = medidasSchema.parse(bruto)
  const falhas: string[] = []
  const categoriasDe = (politica: Politica): Set<string> => new Set(corpora[politica].amostras.map((amostra) => amostra.categoria))
  const confere = (politica: Politica, onde: string, categorias: Iterable<string>): void => {
    const existentes = categoriasDe(politica)
    for (const categoria of categorias) if (!existentes.has(categoria)) falhas.push(`${politica}: ${onde} cita a categoria ${categoria}, que não existe no corpus`)
  }
  for (const politica of POLITICAS) {
    const base = medidas[politica].base
    if (base !== null) confere(politica, 'a base', Object.keys(base.porCategoria))
  }
  confere('riscoAVida', 'perdaMaxima', Object.keys(medidas.riscoAVida.alvo.perdaMaxima))
  confere('riscoAVida', 'foraDoAlvo', medidas.riscoAVida.foraDoAlvo)
  confere('riscoAVida', 'pisoForaDoAlvo', Object.keys(medidas.riscoAVida.pisoForaDoAlvo))
  const julgamento = medidas.julgamentoDeTextoDeAluno.alvo
  confere('julgamentoDeTextoDeAluno', 'semCasar', julgamento.semCasar)
  confere('julgamentoDeTextoDeAluno', 'naoCairDaBase', julgamento.naoCairDaBase)
  const idsDoJulgamento = new Set(corpora.julgamentoDeTextoDeAluno.amostras.map((amostra) => amostra.id))
  for (const id of julgamento.medidoSem) if (!idsDoJulgamento.has(id)) falhas.push(`julgamentoDeTextoDeAluno: medidoSem cita o id ${id}, que não existe no corpus`)
  const qualitativa = medidas.saidaQualitativa
  if (qualitativa.base === null && qualitativa.semBaseAte !== undefined && tarefaConcluida(qualitativa.semBaseAte)) {
    falhas.push(`saidaQualitativa: a tarefa ${qualitativa.semBaseAte} já fechou e a base continua nula`)
  }
  if (falhas.length > 0) throw new GoldenRejectedError(falhas.join('\n'))
  return medidas
}

export function lerMedidas(raiz: string = raizDoOuro()): Medidas {
  const corpora = Object.fromEntries(POLITICAS.map((politica) => [politica, lerCorpus(politica, raiz)])) as Record<Politica, Corpus>
  return interpretarMedidas(lerJson('MEDIDAS.json', raiz), corpora, tarefaConcluidaNaLista(raizDoRepositorio(raiz)))
}

export interface Contagem {
  certos: number
  total: number
}

export interface Medida {
  recall: number
  precisao: number
  /** `certos` é o que a função acertou: barrou a `casa`, ou deixou passar a `nao_casa`. */
  porCategoria: Record<string, Contagem>
  /** Quantas `casa` do alvo a função barrou, e quantas há: o `16/75` do `riscoAVida`. */
  barradasDasPositivas: number
  positivas: number
}

const arredondar = (valor: number): number => Math.round(valor * 1000) / 1000

/**
 * Mede uma função contra as amostras. `foraDoAlvo` são categorias contadas por categoria, mas fora do recall e da
 * precisão (`ameaca_a_terceiro`, no `riscoAVida`).
 */
export function medir(amostras: readonly Amostra[], barra: (amostra: Amostra) => boolean, foraDoAlvo: readonly string[] = []): Medida {
  const porCategoria: Record<string, Contagem> = {}
  let positivas = 0
  let barradasDasPositivas = 0
  let barradas = 0
  for (const amostra of amostras) {
    const barrada = barra(amostra)
    const contagem = (porCategoria[amostra.categoria] ??= { certos: 0, total: 0 })
    contagem.total += 1
    if (barrada === (amostra.esperado === 'casa')) contagem.certos += 1
    if (foraDoAlvo.includes(amostra.categoria)) continue
    if (barrada) barradas += 1
    if (amostra.esperado === 'casa') {
      positivas += 1
      if (barrada) barradasDasPositivas += 1
    }
  }
  return {
    recall: arredondar(barradasDasPositivas / Math.max(positivas, 1)),
    precisao: arredondar(barradasDasPositivas / Math.max(barradas, 1)),
    porCategoria,
    barradasDasPositivas,
    positivas,
  }
}

const dizContagem = (contagem: Contagem | undefined): string => (contagem === undefined ? 'sem a categoria' : `${String(contagem.certos)}/${String(contagem.total)}`)

/** O que a medida tem de diferente da `base`, para cima ou para baixo: a reprodução da 1.0 é exata. */
export function diferencasDaBase(base: Base, medida: Medida): string[] {
  const diferencas: string[] = []
  for (const categoria of new Set([...Object.keys(base.porCategoria), ...Object.keys(medida.porCategoria)])) {
    const esperada = base.porCategoria[categoria]
    const atual = medida.porCategoria[categoria]
    if (esperada === undefined || atual === undefined || atual.certos !== esperada.certos || atual.total !== esperada.total) {
      diferencas.push(`${categoria}: ${dizContagem(atual)}, e a base diz ${dizContagem(esperada)}`)
    }
  }
  if (medida.recall !== base.recall) diferencas.push(`recall ${String(medida.recall)}, e a base diz ${String(base.recall)}`)
  if (medida.precisao !== base.precisao) diferencas.push(`precisão ${String(medida.precisao)}, e a base diz ${String(base.precisao)}`)
  return diferencas
}

/** As categorias que ficaram abaixo da `base`: o piso. Subir não é queda, e uma que sobe não paga a que cai. */
export function quedasDaBase(base: Base, medida: Medida): string[] {
  const quedas: string[] = []
  for (const [categoria, esperada] of Object.entries(base.porCategoria)) {
    const atual = medida.porCategoria[categoria]
    if (atual === undefined || atual.certos < esperada.certos) quedas.push(`${categoria}: ${dizContagem(atual)}, e a base diz ${dizContagem(esperada)}`)
  }
  return quedas
}

/** As amostras que a medida considera: o `medidoSem` do alvo tira as que o padrão de hoje já conhecia (JT-001 a JT-012). */
export function semOsNaoMedidos(amostras: readonly Amostra[], medidoSem: readonly string[]): Amostra[] {
  return amostras.filter((amostra) => !medidoSem.includes(amostra.id))
}

/** A questão em andamento que o aluno tem diante de si quando o `ouro` diz `comQuestao: true`. Qualquer uma serve: a regra só olha se existe. */
const questaoEmAndamento: NonNullable<TutorInput['questao']> = {
  numero: 1,
  enunciado: 'Qual é a massa molar da água?',
  alternativas: ['10 g/mol', '18 g/mol', '20 g/mol', '32 g/mol'],
  habilidade: { codigo: 'EM13CNT104', descricao: 'Relacionar mol, massa molar e constante de Avogadro à quantidade de matéria' },
}

/** README do `ouro`, "O que a 1.0 passa à função": `comQuestao` é `questao` definida; `turnoAnteriorDoAluno` é o turno anterior do aluno. */
export function entradaDoPedidoDeRespostaPronta(amostra: Amostra): Pick<TutorInput, 'duvida' | 'questao' | 'turnosAnteriores'> {
  const anterior = amostra.contexto?.turnoAnteriorDoAluno
  const turnosAnteriores: TutorInput['turnosAnteriores'] = anterior === undefined ? [] : [{ autor: 'aluno', texto: anterior }]
  const entrada = { duvida: amostra.texto, turnosAnteriores }
  return amostra.contexto?.comQuestao === true ? { ...entrada, questao: questaoEmAndamento } : entrada
}

/** README do `ouro`: `turnosDoProfessor` são os turnos anteriores do professor, na ordem. */
export function turnosDoProfessor(amostra: Amostra): AssistenteInput['turnosAnteriores'] {
  return (amostra.contexto?.turnosDoProfessor ?? []).map((texto) => ({ autor: 'professor', texto }))
}
