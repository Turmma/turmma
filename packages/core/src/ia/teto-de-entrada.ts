import type { z } from 'zod'
import type { RepairHint } from './adapter.js'
import { estimarTokens } from './fake-adapter.js'
import { buildMensagens } from './openai-compat-adapter.js'
import type { TaskDefinition } from './task.js'

/**
 * O teto de entrada de cada tarefa (`TaskDefinition.maximoDeTokensDeEntrada`): o tamanho do **pior pedido válido**, isto é, o que o
 * `buildPedido` monta quando cada campo do `esquemaDeEntrada` está no seu limite, somado ao prompt do sistema. O gateway
 * recusa o pedido que passa dele (`PEDIDO_ACIMA_DO_TETO`), antes do orçamento e do envio: entrada que passou pelo schema e mesmo
 * assim estoura é defeito nosso (o teto não acompanhou um campo ou um prompt que cresceu), e não pedido de quem usa.
 *
 * O número de cada tarefa é escrito à mão na definição e **conferido contra o gerador daqui** (`teto-de-entrada.test.ts`):
 * o teste falha quando o pior pedido passa do teto (campo ou prompt que cresceu) e quando o teto sobra muito (limite que caiu).
 */

/** A margem de sobra que um teto escrito à mão pode ter sobre o pior pedido, para não afrouxar o que o limitador lê (10.0). */
export const SOBRA_MAXIMA_DO_TETO = 0.1

const UUID_DE_EXEMPLO = '0190f5a0-0000-7000-8000-0000000000e1'
const INSTANTE_DE_EXEMPLO = '2026-10-05T13:00:00.000Z'
const DATA_DE_EXEMPLO = '2026-10-05'

/** O campo que o gerador não sabe levar ao limite: sem `max`, ou de uma forma que ele não conhece. Diz onde e por quê, nunca o valor. */
export class EntradaSemLimiteError extends Error {
  override readonly name = 'EntradaSemLimiteError'
  constructor(
    readonly caminho: string,
    readonly motivo: string,
  ) {
    super(`${caminho}: ${motivo}`)
  }
}

interface Verificacao {
  readonly check?: string
  readonly format?: string
  readonly maximum?: number
  readonly length?: number
  readonly value?: number
  readonly inclusive?: boolean
}

/** O pedaço do `_zod.def` do zod 4 que o gerador lê. Os campos que uma forma não tem ficam fora. */
interface Definicao {
  readonly type: string
  readonly format?: string
  readonly checks?: readonly { readonly _zod: { readonly def: Verificacao } }[]
  readonly shape?: Readonly<Record<string, z.ZodType>>
  readonly element?: z.ZodType
  readonly items?: readonly z.ZodType[]
  readonly options?: readonly z.ZodType[]
  readonly entries?: Readonly<Record<string, string | number>>
  readonly values?: readonly (string | number | boolean | null | undefined)[]
  readonly innerType?: z.ZodType
  readonly in?: z.ZodType
  readonly left?: z.ZodType
  readonly right?: z.ZodType
  readonly catchall?: z.ZodType
}

const definicaoDe = (esquema: z.ZodType): Definicao => (esquema as unknown as { _zod: { def: Definicao } })._zod.def

function verificacoesDe(def: Definicao): readonly Verificacao[] {
  return (def.checks ?? []).map((verificacao) => verificacao._zod.def)
}

function maiorEmTexto(valores: readonly unknown[]): unknown {
  return valores.reduce((maior, valor) => (JSON.stringify(valor).length > JSON.stringify(maior).length ? valor : maior))
}

const TEXTO_DE_FORMATO_CONHECIDO: Readonly<Record<string, string>> = { uuid: UUID_DE_EXEMPLO, datetime: INSTANTE_DE_EXEMPLO, date: DATA_DE_EXEMPLO }

/** O tamanho que uma verificação de comprimento (`length_equals` ou `max_length`) dá ao texto ou à lista, se der. */
function tamanhoNoLimite(def: Definicao): number | undefined {
  const verificacoes = verificacoesDe(def)
  return verificacoes.find((verificacao) => verificacao.check === 'length_equals')?.length ?? verificacoes.find((verificacao) => verificacao.check === 'max_length')?.maximum
}

function textoNoLimite(def: Definicao, caminho: string): string {
  const conhecido = TEXTO_DE_FORMATO_CONHECIDO[String(def.format)]
  if (conhecido !== undefined) return conhecido
  if (def.format !== undefined) throw new EntradaSemLimiteError(caminho, `string de formato "${def.format}", que o gerador não sabe montar`)
  // Uma regra de formato escrita à mão (`regex`, `startsWith`…) pode recusar o texto que o gerador monta: quem a declara diz o pior valor.
  const deFormato = verificacoesDe(def).find((verificacao) => verificacao.check === 'string_format')
  if (deFormato !== undefined) throw new EntradaSemLimiteError(caminho, `string com regra de formato (${deFormato.format ?? '?'}), que o gerador não sabe montar`)
  const tamanho = tamanhoNoLimite(def)
  if (tamanho === undefined) throw new EntradaSemLimiteError(caminho, 'string sem limite de tamanho (`max`)')
  return 'a'.repeat(tamanho)
}

function numeroNoLimite(def: Definicao): number {
  const inteiro = verificacoesDe(def).some((verificacao) => verificacao.check === 'number_format')
  const teto = verificacoesDe(def).find((verificacao) => verificacao.check === 'less_than')
  // Sem `max`, o número ainda tem tamanho: no JSON seguro, o maior inteiro tem 16 dígitos.
  if (teto?.value === undefined) return Number.MAX_SAFE_INTEGER
  return teto.inclusive === false ? (inteiro ? teto.value - 1 : teto.value - 0.5) : teto.value
}

function listaNoLimite(def: Definicao, caminho: string): unknown[] {
  const tamanho = tamanhoNoLimite(def)
  if (tamanho === undefined) throw new EntradaSemLimiteError(caminho, 'array sem limite de itens (`max`)')
  const item = noLimite(def.element as z.ZodType, `${caminho}[]`)
  return Array.from({ length: tamanho }, () => item)
}

function objetoNoLimite(def: Definicao, caminho: string): Record<string, unknown> {
  if (def.catchall !== undefined && definicaoDe(def.catchall).type !== 'never') throw new EntradaSemLimiteError(caminho, 'objeto com chaves livres (`catchall`)')
  return Object.fromEntries(Object.entries(def.shape as Readonly<Record<string, z.ZodType>>).map(([chave, valor]) => [chave, noLimite(valor, `${caminho}.${chave}`)]))
}

type ValorNoLimite = (def: Definicao, caminho: string) => unknown

/** Quem embrulha outro esquema (opcional, anulável, com valor padrão…): o valor é o do de dentro, com o campo presente. */
const doInterior: ValorNoLimite = (def, caminho) => noLimite(def.innerType as z.ZodType, caminho)

/** O valor no limite de cada forma de esquema que o gerador conhece. Forma que não está aqui falha: não se adivinha o limite. */
const VALOR_NO_LIMITE: Readonly<Record<string, ValorNoLimite>> = {
  string: textoNoLimite,
  number: (def) => numeroNoLimite(def),
  boolean: () => true,
  null: () => null,
  enum: (def) => maiorEmTexto(Object.values(def.entries as Readonly<Record<string, string | number>>)),
  literal: (def) => maiorEmTexto(def.values as readonly unknown[]),
  array: listaNoLimite,
  tuple: (def, caminho) => (def.items as readonly z.ZodType[]).map((item, indice) => noLimite(item, `${caminho}[${indice}]`)),
  object: objetoNoLimite,
  union: (def, caminho) => maiorEmTexto((def.options as readonly z.ZodType[]).map((braco, indice) => noLimite(braco, `${caminho}|${indice}`))),
  intersection: (def, caminho) => ({ ...(noLimite(def.left as z.ZodType, caminho) as object), ...(noLimite(def.right as z.ZodType, caminho) as object) }),
  optional: doInterior,
  nullable: doInterior,
  default: doInterior,
  prefault: doInterior,
  readonly: doInterior,
  catch: doInterior,
  nonoptional: doInterior,
  pipe: (def, caminho) => noLimite(def.in as z.ZodType, caminho),
}

/**
 * O valor do esquema com cada campo no limite: texto e lista no `max`, número no maior, o campo opcional presente, a união no braço
 * de maior tamanho. Forma sem limite declarado, ou que o gerador não conhece, é falha (`EntradaSemLimiteError`) e não valor
 * adivinhado: o teto de uma tarefa que o gerador não alcança não estaria provado.
 */
export function noLimite(esquema: z.ZodType, caminho = 'entrada'): unknown {
  const def = definicaoDe(esquema)
  const valor = VALOR_NO_LIMITE[def.type]
  if (valor === undefined) throw new EntradaSemLimiteError(caminho, `forma "${def.type}" sem limite que o gerador conheça`)
  return valor(def, caminho)
}

/** Tira da entrada o campo que o `caminho` aponta, se ele existe num objeto. Devolve se tirou. */
function retirarCampo(raiz: unknown, caminho: readonly PropertyKey[]): boolean {
  let atual: unknown = raiz
  for (const chave of caminho.slice(0, -1)) {
    if (typeof atual !== 'object' || atual === null) return false
    atual = (atual as Record<PropertyKey, unknown>)[chave]
  }
  const ultima = caminho.at(-1)
  if (ultima === undefined || typeof atual !== 'object' || atual === null || Array.isArray(atual) || !Object.hasOwn(atual, ultima)) return false
  return Reflect.deleteProperty(atual, ultima)
}

/**
 * A entrada do pior pedido válido da tarefa: o esquema de entrada dela, cada campo no limite. Uma regra cruzada (a atividade de
 * origem da adaptação não pode já ser adaptada; tempo extra só com o tipo `tempo_adicional`) recusa o campo opcional que o
 * gerador pôs: ele é retirado, porque com a regra não é pedido válido. Falha (`EntradaSemLimiteError`) se a tarefa não tem esquema,
 * se algum campo não tem limite, ou se o valor montado ainda não passa no próprio esquema, e nos três casos o teto não estaria provado.
 */
export function piorEntradaDaTarefa<Entrada, Saida>(tarefa: Pick<TaskDefinition<Entrada, Saida>, 'nome' | 'esquemaDeEntrada'>): Entrada {
  const esquema = tarefa.esquemaDeEntrada as z.ZodType<Entrada> | undefined
  if (esquema === undefined) throw new EntradaSemLimiteError(tarefa.nome, 'tarefa sem `esquemaDeEntrada`')
  const montada = noLimite(esquema, tarefa.nome)
  // Cada volta que continua retira ao menos um campo que existia, e os campos são finitos: o laço termina.
  for (;;) {
    const lida = esquema.safeParse(montada)
    if (lida.success) return lida.data
    const retirou = lida.error.issues.map((problema) => retirarCampo(montada, problema.path)).some(Boolean)
    if (!retirou) {
      // Só o caminho e o tipo do erro: a mensagem do zod pode trazer o valor recebido, e o valor é entrada (regra 20, item 9).
      const onde = lida.error.issues.slice(0, 3).map((problema) => `${problema.path.join('.') || 'entrada'}: ${problema.code}`)
      throw new EntradaSemLimiteError(tarefa.nome, `o pior pedido montado não passa no próprio esquema (${onde.join('; ')})`)
    }
  }
}

/**
 * O tamanho estimado do pedido de uma tarefa, na primeira chamada: as mensagens que o adaptador monta (sistema com as regras
 * comuns e o JSON Schema da saída, e a instrução com os dados), a quatro caracteres por token (`estimarTokens`). As mensagens são
 * as do formato do `openai-compat-adapter` (`buildMensagens`): se um adaptador montar as dele de outro jeito, o teto passa a medir uma
 * coisa e o envio outra, e quem o troca confere esta conta. A repetição depois de uma saída inválida soma a resposta anterior e a
 * correção, e elas só entram quando quem chama as passa (a reserva de tokens da repetição, 49.0): o teto de entrada é do pedido que a tarefa monta, sem elas.
 */
export function tokensDoPedido<Entrada, Saida>(tarefa: TaskDefinition<Entrada, Saida>, entrada: Entrada, correcao?: RepairHint): number {
  return buildMensagens({ tarefa, entrada, ...(correcao === undefined ? {} : { correcao }) }).reduce((soma, mensagem) => soma + estimarTokens(mensagem.content), 0)
}

/** O tamanho estimado do pior pedido válido da tarefa: o que o `maximoDeTokensDeEntrada` dela precisa cobrir. */
export function tokensDoPiorPedido<Entrada, Saida>(tarefa: TaskDefinition<Entrada, Saida>): number {
  return tokensDoPedido(tarefa, piorEntradaDaTarefa(tarefa))
}
