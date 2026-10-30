import { InvariantException, habilidadeSchema, type Citacao, type Habilidade } from '@educa/shared'
import { z } from 'zod'
import type { Dado } from './tarefa.js'
import { contemTexto, cortar, frases, normalizar, palavras, palavrasEmComum, semPontoFinal } from './texto.js'

/**
 * Um trecho do material da escola, como a busca devolve: a página e o texto dela. É a única forma de conteúdo de
 * material que uma tarefa recebe, e é contra ele que toda citação é conferida (regra 30, item 12).
 */
export const esquemaTrecho = z.strictObject({
  materialId: z.uuid(),
  /** Página do PDF, a partir de 1. */
  pagina: z.number().int().min(1),
  texto: z.string().min(1).max(8000),
})
export type Trecho = z.infer<typeof esquemaTrecho>

/**
 * Série e disciplina, pelo nome que a escola deu ("2ª série do Ensino Médio", "Química"). É contexto para o tom e o
 * nível do texto; não há campo para o nome da turma, do professor ou de aluno.
 */
export const esquemaContextoDaTurma = z.strictObject({
  serie: z.string().min(1).max(60),
  disciplina: z.string().min(1).max(60),
})
export type ContextoDaTurma = z.infer<typeof esquemaContextoDaTurma>

export const esquemaHabilidades = z.array(habilidadeSchema).min(1).max(6)

export function dadosDosTrechos(trechos: readonly Trecho[]): Dado[] {
  return trechos.map((trecho) => ({
    tipo: 'trecho_do_material',
    atributos: { materialId: trecho.materialId, pagina: trecho.pagina },
    corpo: trecho.texto,
  }))
}

export function dadoEmJson(tipo: string, valor: unknown): Dado {
  return { tipo, corpo: JSON.stringify(valor) }
}

/** A citação aponta para uma página que veio nos trechos? Página inventada é saída inválida. */
export function citacaoVeioDosTrechos(citacao: Pick<Citacao, 'materialId' | 'pagina'>, trechos: readonly Trecho[]): boolean {
  return trechos.some((trecho) => trecho.materialId === citacao.materialId && trecho.pagina === citacao.pagina)
}

export function problemasDasCitacoes(citacoes: readonly Citacao[], trechos: readonly Trecho[], onde: string): string[] {
  return citacoes
    .filter((citacao) => !citacaoVeioDosTrechos(citacao, trechos))
    .map((citacao) => `${onde}: a citação aponta para a página ${citacao.pagina}, que não está nos trechos recebidos. Cite só material e página que vieram nos dados.`)
}

/**
 * Uma frase definitória do material: "Reagente limitante é o reagente que acaba primeiro…", "O mol é a unidade…",
 * "A massa molar da água é 18 g/mol". É dela que a versão determinística tira questão, objetivo de plano e apoio
 * do Tutor.
 */
export interface Fato {
  readonly materialId: string
  readonly pagina: number
  /** A frase como está no material, sem o título de seção que a extração do PDF cola na frente dela. */
  readonly frase: string
  /** "o", "a", "os", "as", "um", "uma", ou vazio quando o material define sem artigo ("Mol é…"). */
  readonly artigo: string
  /** O termo como se escreve no meio de uma frase: "mol", "reagente limitante", "constante de Avogadro". */
  readonly termo: string
  /** "é", "são", "corresponde a", "equivale a"… */
  readonly copula: string
  readonly complemento: string
  /** O complemento é um valor ("18 g/mol"): pede "qual é", e distrator que também seja valor. */
  readonly numerico: boolean
}

const TERMO_E_COMPLEMENTO = /^(.+?)\s+(é|são|corresponde a|correspondem a|equivale a|equivalem a)\s+(.+)$/u
const COM_ARTIGO = /^(O|A|Os|As|Um|Uma)\s+(.+)$/u
/** "7.1 O que a estequiometria responde Estequiometria é…": o título da seção não tem ponto, e a extração o emenda na frase. */
const SECAO_COLADA = /^\d+\.\d+(?:\.\d+)*\s/u
/** Nome de conceito é feito de palavras: vírgula, dois-pontos, sinal de conta ou seta dizem que aquilo é oração ou equação. */
const SO_PALAVRAS = /^[\p{L}\p{N}][\p{L}\p{N}\s–-]*$/u
const PALAVRAS_MAXIMAS_DO_TERMO = 10
/** Quem começa assim retoma o que veio antes ("Esse valor é…", "Qual é…"): não nomeia conceito. */
const NAO_ABRE_TERMO = new Set(
  (
    'esse essa esses essas este esta estes estas isso isto aquilo aquele aquela ele ela eles elas nele nela nesse nessa neste nesta ' +
    'qual quais que quem quanto quanta quantos quantas como quando onde se para por em na no nas nos pela pelo cada todo toda todos ' +
    'todas so entao logo assim ja tambem'
  ).split(' '),
)
/** "O limitante não é o reagente de menor massa": o que vem antes do verbo nega ou restringe, e a frase não define. */
const NAO_FECHA_TERMO = new Set('nao nunca sempre so tambem ja ainda quase que se'.split(' '))
/** A definição diz o que a coisa é: começa por um nome com determinante ("a substância que…", "aquilo que…"). */
const ABRE_DEFINICAO = /^(o|a|os|as|um|uma|aquilo|aquele|aquela|aqueles|aquelas)\s/iu
/**
 * Predicado que começa como definição e não é: "o mesmo de uma receita" (comparação), "o do O2" (retoma outro nome),
 * "o limitante e o pão está em excesso" (duas orações).
 */
const NAO_E_DEFINICAO = [/^(o|a)s? mesm[oa]s?\b/iu, /^(o|a|os|as) d[aeo]s?\b/iu, /^(o|a|os|as|um|uma)\s+\S+\s+e\s/iu]
const PALAVRAS_MINIMAS_DA_DEFINICAO = 4

function minusculaInicial(texto: string): string {
  return texto.charAt(0).toLocaleLowerCase('pt-BR') + texto.slice(1)
}

/** O complemento é um valor, e só um valor: conta de exemplo ("250 g × 80 / 100 = 200 g, ou 2 mol") não é fato do material. */
function ehValor(complemento: string): boolean {
  return /^\d/u.test(complemento) && complemento.length <= 60 && !/=|, /u.test(complemento)
}

/**
 * A relação com número escrita como item de lista: "Água, H2O: 2 × 1 + 16 = 18 g/mol." O nome, a fórmula, a conta e o
 * valor. A unidade diz o que o valor é: g/mol é massa molar.
 */
const MASSA_MOLAR_EM_ITEM = /^(\p{Lu}[\p{L} ]{1,40}), ([A-Z][A-Za-z0-9()]{0,14}): [^=]{1,40}= (\d[\d,]* g\/mol)$/u

function massaMolarDoItem(frase: string, trecho: Trecho): Fato | undefined {
  const achado = MASSA_MOLAR_EM_ITEM.exec(semPontoFinal(frase))
  if (achado === null) return undefined
  const [, nome = '', formula = '', valor = ''] = achado
  return {
    materialId: trecho.materialId,
    pagina: trecho.pagina,
    frase,
    artigo: 'a',
    termo: `massa molar de ${minusculaInicial(nome)} (${formula})`,
    copula: 'é',
    complemento: valor,
    numerico: true,
  }
}

function fatoDaFrase(frase: string, trecho: Trecho): Fato | undefined {
  // Pergunta não define nada ("Qual é o reagente limitante?").
  if (frase.endsWith('?')) return undefined
  const doItem = massaMolarDoItem(frase, trecho)
  if (doItem !== undefined) return doItem
  const achado = TERMO_E_COMPLEMENTO.exec(semPontoFinal(frase))
  if (achado === null) return undefined
  const [, antesDoVerbo = '', copula = '', depoisDoVerbo = ''] = achado

  let sujeito = antesDoVerbo
  if (SECAO_COLADA.test(sujeito)) {
    // Depois do título colado, a frase de verdade começa na última palavra com maiúscula.
    const partes = sujeito.split(' ')
    const inicio = partes.findLastIndex((parte) => /^\p{Lu}/u.test(parte))
    if (inicio <= 0) return undefined
    sujeito = partes.slice(inicio).join(' ')
  }
  if (!/^\p{Lu}/u.test(sujeito) || !SO_PALAVRAS.test(sujeito)) return undefined
  const comArtigo = COM_ARTIGO.exec(sujeito)
  const artigo = (comArtigo?.[1] ?? '').toLowerCase()
  const termo = comArtigo?.[2] ?? minusculaInicial(sujeito)
  const palavrasDoTermo = palavras(normalizar(termo))
  if (palavrasDoTermo.length === 0 || palavrasDoTermo.length > PALAVRAS_MAXIMAS_DO_TERMO) return undefined
  if (NAO_ABRE_TERMO.has(palavrasDoTermo[0] ?? '') || NAO_FECHA_TERMO.has(palavrasDoTermo.at(-1) ?? '')) return undefined

  // O que vem depois do ponto e vírgula é outra informação ("; seu símbolo é n…"), não a definição.
  const complemento = (depoisDoVerbo.split(';')[0] ?? '').trim()
  const numerico = ehValor(complemento)
  if (!numerico) {
    if (/^\d/u.test(complemento)) return undefined
    // "corresponde a" e "equivale a" já dizem que a frase define; com "é" e "são", quem diz é a forma do complemento.
    const definePelaForma = ABRE_DEFINICAO.test(complemento) && !NAO_E_DEFINICAO.some((padrao) => padrao.test(complemento))
    if ((copula === 'é' || copula === 'são') && !definePelaForma) return undefined
    if (palavras(complemento).length < PALAVRAS_MINIMAS_DA_DEFINICAO) return undefined
  }
  return {
    materialId: trecho.materialId,
    pagina: trecho.pagina,
    frase: frase.slice(antesDoVerbo.length - sujeito.length),
    artigo,
    termo,
    copula,
    complemento,
    numerico,
  }
}

/** Os fatos do material, na ordem em que aparecem, um por termo (o primeiro vence). */
export function extrairFatos(trechos: readonly Trecho[]): Fato[] {
  const vistos = new Set<string>()
  const fatos: Fato[] = []
  for (const trecho of trechos) {
    for (const frase of frases(trecho.texto)) {
      const fato = fatoDaFrase(frase, trecho)
      if (fato === undefined) continue
      const chave = normalizar(fato.termo)
      if (vistos.has(chave)) continue
      vistos.add(chave)
      fatos.push(fato)
    }
  }
  return fatos
}

/** "o reagente limitante" ou, quando o material define sem artigo, "reagente limitante". */
export function termoComArtigo(fato: Pick<Fato, 'artigo' | 'termo'>): string {
  return fato.artigo.length === 0 ? fato.termo : `${fato.artigo} ${fato.termo}`
}

/** O fato cujo termo aparece no texto (a dúvida do aluno, o pedido do professor); entre vários, o de termo mais comprido. */
export function fatoCitadoNoTexto(fatos: readonly Fato[], texto: string): Fato | undefined {
  let melhor: Fato | undefined
  for (const fato of fatos) {
    if (!contemTexto(texto, fato.termo)) continue
    if (melhor === undefined || fato.termo.length > melhor.termo.length) melhor = fato
  }
  return melhor
}

export interface FraseDoMaterial {
  readonly materialId: string
  readonly pagina: number
  readonly frase: string
}

export function frasesDoMaterial(trechos: readonly Trecho[]): FraseDoMaterial[] {
  return trechos.flatMap((trecho) => frases(trecho.texto).map((frase) => ({ materialId: trecho.materialId, pagina: trecho.pagina, frase })))
}

/** A frase do material com mais palavras em comum com o texto; no empate, a que vem antes. `undefined` sem nenhuma em comum. */
export function fraseMaisProxima(candidatas: readonly FraseDoMaterial[], texto: string): FraseDoMaterial | undefined {
  let melhor: FraseDoMaterial | undefined
  let pontos = 0
  for (const candidata of candidatas) {
    const emComum = palavrasEmComum(texto, candidata.frase)
    if (emComum > pontos) {
      melhor = candidata
      pontos = emComum
    }
  }
  return melhor
}

/** A habilidade cuja descrição mais se parece com o texto; no empate, a primeira da lista. */
export function habilidadeMaisProxima(habilidades: readonly Habilidade[], texto: string): Habilidade {
  const [primeira, ...demais] = habilidades
  if (primeira === undefined) throw new InvariantException('lista de habilidades vazia')
  let melhor = primeira
  let pontos = palavrasEmComum(primeira.descricao, texto)
  for (const habilidade of demais) {
    const emComum = palavrasEmComum(habilidade.descricao, texto)
    if (emComum > pontos) {
      melhor = habilidade
      pontos = emComum
    }
  }
  return melhor
}

export function citacaoDaFrase(frase: FraseDoMaterial): Citacao {
  return { materialId: frase.materialId, pagina: frase.pagina, trecho: cortar(frase.frase, 400) }
}
