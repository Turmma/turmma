import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

/**
 * A medida do `ouro` (`docs/aia/ouro/`) e dos lotes retidos (`docs/aia/ouro-retido/`): o formato do corpus, o `MEDIDAS.json` com a `base` medida em 21/10/2026 e o alvo de cada política, a conta de recall e
 * precisão por categoria, a pior de várias execuções e a comparação com o alvo e com a base. Vive aqui, e não em `__fixtures__/`, porque duas coisas a leem: o `golden.test.ts` (o `ouro`, contra as funções de hoje) e
 * a ferramenta da avaliação (`tools/ia/`, os lotes retidos contra o modelo do finalista; reserva-e-avaliacao, 13.0), cuja guarda do ponto de entrada proíbe tudo o que é de fixture.
 *
 * Este arquivo só lê e mede: quem altera o `ouro` é o Arquiteto, e o Implementador nunca o toca (README do `ouro`, "Quem altera"). Não importa tarefa nem adaptador: o que depende do tipo de entrada de uma
 * tarefa (`entradaDoPedidoDeRespostaPronta`) fica em `__fixtures__/golden.ts`.
 *
 * **Não sai pelo índice do core nem entra em `apps/`:** lê disco de forma síncrona (`readFileSync`), o que é aceitável em teste e na ferramenta da avaliação, e inaceitável dentro de uma requisição. Quem precisar
 * dele em runtime lê o arquivo de forma assíncrona, em outro módulo.
 */

export const POLITICAS = ['riscoAVida', 'assuntoDelicado', 'pedidoDeRespostaPronta', 'julgamentoDeTextoDeAluno', 'saidaComNota', 'saidaQualitativa'] as const
export type Politica = (typeof POLITICAS)[number]

/**
 * A pasta do `ouro`, a partir do módulo que a pede: `import.meta.url`, e nunca o diretório de onde o teste foi
 * chamado. O padrão é este arquivo, quatro pastas abaixo da raiz do repositório (`packages/core/src/ia`).
 */
export function raizDoOuro(urlDoModulo: string = import.meta.url): string {
  return fileURLToPath(new URL('../../../../docs/aia/ouro', urlDoModulo))
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

export function readJson(nome: string, raiz: string = raizDoOuro()): unknown {
  return JSON.parse(readFileSync(join(raiz, nome), 'utf8'))
}

export function interpretarCorpus(politica: Politica, bruto: unknown): Corpus {
  return corpusSchema(politica).parse(bruto)
}

export function readCorpus(politica: Politica, raiz: string = raizDoOuro()): Corpus {
  return interpretarCorpus(politica, readJson(`${politica}.json`, raiz))
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

export function readMedidas(raiz: string = raizDoOuro()): Medidas {
  const corpora = Object.fromEntries(POLITICAS.map((politica) => [politica, readCorpus(politica, raiz)])) as Record<Politica, Corpus>
  return interpretarMedidas(readJson('MEDIDAS.json', raiz), corpora, tarefaConcluidaNaLista(raizDoRepositorio(raiz)))
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

/**
 * A pior de várias medidas: em cada categoria, a execução com menos acertos; no recall e na precisão, o menor valor de cada um.
 * É a "pior de três" da regra 40: a melhor execução esconderia o modelo que oscila.
 */
export function piorDe(medidas: readonly Medida[]): Medida {
  const [primeira] = medidas
  if (primeira === undefined) throw new GoldenRejectedError('sem medida para escolher a pior')
  const porCategoria: Record<string, Contagem> = {}
  for (const medida of medidas) {
    for (const [categoria, contagem] of Object.entries(medida.porCategoria)) {
      const atual = porCategoria[categoria]
      if (atual === undefined || contagem.certos < atual.certos) porCategoria[categoria] = contagem
    }
  }
  return {
    recall: Math.min(...medidas.map((medida) => medida.recall)),
    precisao: Math.min(...medidas.map((medida) => medida.precisao)),
    porCategoria,
    barradasDasPositivas: Math.min(...medidas.map((medida) => medida.barradasDasPositivas)),
    positivas: primeira.positivas,
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

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// O alvo do `riscoAVida`

/** O alvo do `riscoAVida` no `MEDIDAS.json`: a perda máxima por categoria e a precisão mínima. */
export type AlvoDoRiscoAVida = Medidas['riscoAVida']['alvo']
/** O `riscoAVida` de `MEDIDAS.json` inteiro: a base, o alvo, as categorias fora do alvo e o piso delas. */
export type MedidaDoRiscoAVida = Medidas['riscoAVida']

/** As categorias que perderam mais amostras do que o alvo admite (`perdaMaxima`): `explicita` 0, `giria_abreviacao` 1. Categoria que o lote não tem não perdeu nenhuma: sem amostra dela, não há o que perder (o piso da base, esse sim, cobra a que falta, em `quedasDaBase`). */
export function perdasAcimaDoAlvo(medida: Pick<Medida, 'porCategoria'>, perdaMaxima: Readonly<Record<string, number>>): string[] {
  return Object.entries(perdaMaxima).flatMap(([categoria, maxima]) => {
    const { certos, total } = medida.porCategoria[categoria] ?? { certos: 0, total: 0 }
    return total - certos > maxima ? [`${categoria}: perdeu ${String(total - certos)} e o alvo aceita ${String(maxima)}`] : []
  })
}

/** A precisão abaixo do mínimo do alvo, ou `undefined`: exatamente o mínimo passa (0,8 de 0,8). */
export function precisaoAbaixoDoAlvo(medida: Pick<Medida, 'precisao'>, precisaoMinima: number): string | undefined {
  return medida.precisao < precisaoMinima ? `precisão ${String(medida.precisao)}, e o alvo pede ${String(precisaoMinima)}` : undefined
}

/**
 * O alvo inteiro do `riscoAVida` contra a medida de um lote (a pior das execuções, `piorDe`): a perda máxima por categoria, a precisão mínima e o piso das categorias fora do alvo
 * (`ameaca_a_terceiro`), que não pode cair da **base do lote** (a do padrão de antes, em `RETIDOS.json`, e não a do `ouro`). Devolve os problemas, um por defeito; vazio é "alcançou".
 */
export function problemasDoAlvoDoRiscoAVida(medida: Medida, medidas: Medidas['riscoAVida'], baseDoLote: Base): string[] {
  const piso = Object.fromEntries(Object.entries(baseDoLote.porCategoria).filter(([categoria]) => categoria in medidas.pisoForaDoAlvo))
  const precisao = precisaoAbaixoDoAlvo(medida, medidas.alvo.precisaoMinima)
  return [...perdasAcimaDoAlvo(medida, medidas.alvo.perdaMaxima), ...(precisao === undefined ? [] : [precisao]), ...quedasDaBase({ ...baseDoLote, porCategoria: piso }, medida)]
}
