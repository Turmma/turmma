import { conteudoDeAtividadeSchema, MAXIMO_DE_QUESTOES_POR_ATIVIDADE, TAMANHO_MAXIMO_DO_TEMA, type ConteudoDeAtividade, type Habilidade, type QuestaoObjetiva } from '@educa/shared'
import { z } from 'zod'
import {
  citacaoDaFrase,
  citacaoVeioDosTrechos,
  dadoEmJson,
  dadosDosTrechos,
  contextoDaTurmaSchema,
  habilidadesSchema,
  trechoSchema,
  extrairFatos,
  frasesDoMaterial,
  habilidadeMaisProxima,
  termoComArtigo,
  type Fato,
  type FraseDoMaterial,
} from '../material.js'
import { PROMPT_GERAR_ATIVIDADE_OBJETIVA } from '../prompts/gerar-atividade-objetiva.js'
import { defineTask, MaterialSemConteudoAproveitavelError } from '../task.js'
import { capitalizar, cortar, hashEstavel, normalizar, palavras, palavrasEmComum } from '../text.js'

export const atividadeObjetivaInputSchema = z.strictObject({
  /** O que o professor pediu, com as palavras dele. Vai ao modelo como dado. */
  tema: z.string().min(1).max(TAMANHO_MAXIMO_DO_TEMA),
  quantidade: z.number().int().min(1).max(MAXIMO_DE_QUESTOES_POR_ATIVIDADE),
  contexto: contextoDaTurmaSchema,
  /** As habilidades da disciplina que a atividade pode cobrar: toda questão leva uma delas. */
  habilidades: habilidadesSchema,
  /** Os trechos que a busca achou para o tema. Sem trecho não há o que citar, e por isso não há atividade. */
  trechos: z.array(trechoSchema).min(1).max(12),
})
export type AtividadeObjetivaInput = z.infer<typeof atividadeObjetivaInputSchema>

/** Página citada que veio nos trechos, habilidade que veio na entrada, quatro alternativas diferentes. */
export function problemasDasQuestoes(
  questoes: readonly QuestaoObjetiva[],
  entrada: Pick<AtividadeObjetivaInput, 'trechos' | 'habilidades'>,
): string[] {
  const codigos = new Set(entrada.habilidades.map((habilidade) => habilidade.codigo))
  return questoes.flatMap((questao, indice) => {
    const onde = `Questão ${indice + 1}`
    const problemas: string[] = []
    if (!citacaoVeioDosTrechos(questao.citacao, entrada.trechos)) {
      problemas.push(`${onde}: a citação aponta para a página ${questao.citacao.pagina}, que não está nos trechos recebidos. Cite só material e página que vieram nos dados.`)
    }
    if (!codigos.has(questao.habilidade.codigo)) problemas.push(`${onde}: a habilidade precisa ser uma das recebidas, copiada como veio.`)
    if (new Set(questao.alternativas.map(normalizar)).size !== questao.alternativas.length) problemas.push(`${onde}: as quatro alternativas precisam ser diferentes entre si.`)
    return problemas
  })
}

function alternativaDoFato(fato: Fato): string {
  return cortar(fato.numerico ? fato.complemento : `${capitalizar(fato.complemento)}.`, 400)
}

function enunciadoDoFato(fato: Fato): string {
  const alvo = termoComArtigo(fato)
  if (fato.copula !== 'é' && fato.copula !== 'são') return `Segundo o material, a que ${fato.copula.replace(/ a$/, '')} ${alvo}?`
  if (fato.numerico) return `Segundo o material, ${fato.copula === 'são' ? 'quais são' : 'qual é'} ${alvo}?`
  return `Segundo o material, o que ${fato.copula} ${alvo}?`
}

const textoDoFato = (fato: Fato): string => `${fato.termo} ${fato.complemento}`

/**
 * Os distratores são as definições de outros termos do mesmo material: primeiro as do mesmo tipo (valor com valor,
 * definição com definição), depois as que mais têm palavras em comum com a correta, que são as que um aluno
 * confundiria, e por fim as mais próximas no texto. Definição de outro assunto se elimina só de ler.
 */
function distratoresDoFato(fatos: readonly Fato[], indice: number, certo: Fato): string[] {
  const usados = new Set([normalizar(alternativaDoFato(certo))])
  const candidatos = fatos
    .map((fato, posicao) => ({ fato, posicao, afinidade: palavrasEmComum(textoDoFato(certo), textoDoFato(fato)) }))
    .filter(({ posicao }) => posicao !== indice)
    .sort(
      (a, b) =>
        Number(b.fato.numerico === certo.numerico) - Number(a.fato.numerico === certo.numerico) ||
        b.afinidade - a.afinidade ||
        Math.abs(a.posicao - indice) - Math.abs(b.posicao - indice) ||
        a.posicao - b.posicao,
    )
  const distratores: string[] = []
  for (const { fato } of candidatos) {
    const alternativa = alternativaDoFato(fato)
    if (usados.has(normalizar(alternativa))) continue
    usados.add(normalizar(alternativa))
    distratores.push(alternativa)
    if (distratores.length === 3) break
  }
  return distratores
}

/** A posição da correta sai do próprio texto: muda de questão para questão e é sempre a mesma para a mesma questão. */
function comACorretaNaPosicao(correta: string, distratores: readonly string[], semente: string): { alternativas: string[]; gabarito: number } {
  const gabarito = hashEstavel(normalizar(semente)) % (distratores.length + 1)
  const alternativas = [...distratores]
  alternativas.splice(gabarito, 0, correta)
  return { alternativas, gabarito }
}

function questaoDoFato(fatos: readonly Fato[], indice: number, habilidades: readonly Habilidade[]): QuestaoObjetiva | undefined {
  const fato = fatos[indice]
  if (fato === undefined) return undefined
  const distratores = distratoresDoFato(fatos, indice, fato)
  if (distratores.length < 3) return undefined
  return {
    enunciado: cortar(enunciadoDoFato(fato), 1200),
    ...comACorretaNaPosicao(alternativaDoFato(fato), distratores, fato.termo),
    habilidade: habilidadeMaisProxima(habilidades, fato.frase),
    citacao: citacaoDaFrase(fato),
    explicacao: `Na página ${fato.pagina}, o material diz: “${cortar(fato.frase, 480)}”`,
  }
}

const PALAVRAS_MINIMAS_DA_LACUNA = 8
const LETRAS_MINIMAS_DA_PALAVRA_OMITIDA = 6

interface Lacuna extends FraseDoMaterial {
  readonly omitida: string
}

/** A palavra a esconder: a mais comprida da frase, fora a primeira; no empate, a que vem antes. */
function lacunaDaFrase(frase: FraseDoMaterial): Lacuna | undefined {
  const todas = palavras(frase.frase)
  if (todas.length < PALAVRAS_MINIMAS_DA_LACUNA || frase.frase.length > 400) return undefined
  let omitida: string | undefined
  for (const palavra of todas.slice(1)) {
    if (palavra.length < LETRAS_MINIMAS_DA_PALAVRA_OMITIDA || /\d/.test(palavra)) continue
    if (omitida === undefined || palavra.length > omitida.length) omitida = palavra
  }
  return omitida === undefined ? undefined : { ...frase, omitida }
}

function questaoDaLacuna(lacunas: readonly Lacuna[], indice: number, habilidades: readonly Habilidade[]): QuestaoObjetiva | undefined {
  const lacuna = lacunas[indice]
  if (lacuna === undefined) return undefined
  const usadas = new Set([normalizar(lacuna.omitida)])
  const distratores: string[] = []
  const porProximidade = lacunas
    .map((outra, posicao) => ({ outra, posicao }))
    .filter(({ posicao }) => posicao !== indice)
    .sort((a, b) => Math.abs(a.posicao - indice) - Math.abs(b.posicao - indice) || a.posicao - b.posicao)
  for (const { outra } of porProximidade) {
    const palavra = outra.omitida.toLowerCase()
    // Palavra que já está na própria frase não serve de distrator: a frase a denuncia.
    if (usadas.has(normalizar(palavra)) || normalizar(lacuna.frase).includes(normalizar(palavra))) continue
    usadas.add(normalizar(palavra))
    distratores.push(palavra)
    if (distratores.length === 3) break
  }
  if (distratores.length < 3) return undefined
  return {
    enunciado: cortar(`Complete a frase do material: “${lacuna.frase.replace(lacuna.omitida, '______')}”`, 1200),
    ...comACorretaNaPosicao(lacuna.omitida.toLowerCase(), distratores, lacuna.frase),
    habilidade: habilidadeMaisProxima(habilidades, lacuna.frase),
    citacao: citacaoDaFrase(lacuna),
    explicacao: `Na página ${lacuna.pagina}, o material diz: “${cortar(lacuna.frase, 480)}”`,
  }
}

/** Uma de cada página, depois a segunda de cada página: a atividade cobre o material inteiro antes de repetir assunto. */
function intercalarPorPagina<Item extends { materialId: string; pagina: number }>(itens: readonly Item[]): number[] {
  const porPagina = new Map<string, number[]>()
  itens.forEach((item, indice) => {
    const chave = `${item.materialId}:${item.pagina}`
    porPagina.set(chave, [...(porPagina.get(chave) ?? []), indice])
  })
  const filas = [...porPagina.values()]
  const ordem: number[] = []
  for (let rodada = 0; ordem.length < itens.length; rodada += 1) {
    for (const fila of filas) {
      const indice = fila[rodada]
      if (indice !== undefined) ordem.push(indice)
    }
  }
  return ordem
}

/**
 * Dentro de cada página, uma definição, um valor, uma definição: a atividade não fica só de "o que é X?" quando o
 * material também traz relações com número ("qual é a massa molar de…?"). A ordem das páginas não muda.
 */
function alternandoDefinicaoEValor(fatos: readonly Fato[]): Fato[] {
  const paginas = [...new Set(fatos.map((fato) => `${fato.materialId}:${fato.pagina}`))]
  return paginas.flatMap((pagina) => {
    const daPagina = fatos.filter((fato) => `${fato.materialId}:${fato.pagina}` === pagina)
    const definicoes = daPagina.filter((fato) => !fato.numerico)
    const valores = daPagina.filter((fato) => fato.numerico)
    return Array.from({ length: Math.max(definicoes.length, valores.length) }, (_, posicao) => [definicoes[posicao], valores[posicao]]).flat().filter((fato) => fato !== undefined)
  })
}

/**
 * O que fala do tema pedido vem antes, do que mais tem a ver para o que menos; o resto fica na ordem em que estava.
 * Com tema que não aparece em frase nenhuma, a ordem não muda.
 */
function primeiroODoTema(ordem: readonly number[], fatos: readonly Fato[], tema: string): number[] {
  const afinidade = (indice: number): number => palavrasEmComum(tema, `${fatos[indice]?.termo ?? ''} ${fatos[indice]?.frase ?? ''}`)
  return [...ordem].sort((a, b) => afinidade(b) - afinidade(a))
}

/**
 * Questões tiradas das frases definitórias do material ("X é Y", "X corresponde a Y", relação com número). Quando
 * elas não bastam, completa com lacuna: a frase do material com uma palavra escondida.
 */
export function questoesDoMaterial(entrada: Pick<AtividadeObjetivaInput, 'tema' | 'trechos' | 'habilidades' | 'quantidade'>): QuestaoObjetiva[] {
  const fatos = alternandoDefinicaoEValor(extrairFatos(entrada.trechos))
  const questoes: QuestaoObjetiva[] = []
  const frasesUsadas = new Set<string>()
  for (const indice of primeiroODoTema(intercalarPorPagina(fatos), fatos, entrada.tema)) {
    if (questoes.length === entrada.quantidade) break
    const questao = questaoDoFato(fatos, indice, entrada.habilidades)
    if (questao === undefined) continue
    questoes.push(questao)
    frasesUsadas.add(fatos[indice]?.frase ?? '')
  }
  if (questoes.length < entrada.quantidade) {
    const lacunas = frasesDoMaterial(entrada.trechos).flatMap((frase) => lacunaDaFrase(frase) ?? [])
    for (const indice of intercalarPorPagina(lacunas)) {
      if (questoes.length === entrada.quantidade) break
      if (frasesUsadas.has(lacunas[indice]?.frase ?? '')) continue
      const questao = questaoDaLacuna(lacunas, indice, entrada.habilidades)
      if (questao !== undefined) questoes.push(questao)
    }
  }
  return questoes
}

export const gerarAtividadeObjetiva = defineTask({
  nome: 'gerar_atividade_objetiva',
  funcao: 'conversa_e_ferramentas',
  perfil: 'padrao',
  esquemaDeEntrada: atividadeObjetivaInputSchema,
  esquemaDeSaida: conteudoDeAtividadeSchema,
  prompt: PROMPT_GERAR_ATIVIDADE_OBJETIVA,
  maximoDeTokensDeSaida: 6000,
  levaTextoLivreDePessoa: false,
  levaTextoDeAluno: false,

  /**
   * A atividade gerada nunca é versão adaptada: o `adaptacao` que o modelo acrescentar por conta própria sai antes do
   * schema (no ensaio com o Qwen de 04/10/2026, ele vinha em parte das respostas e reprovava a atividade inteira).
   */
  prepararResposta(_entrada, bruto) {
    if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto) || !('adaptacao' in bruto)) return bruto
    const { adaptacao: _adaptacao, ...semAdaptacao } = bruto
    return semAdaptacao
  },

  montarPedido(entrada) {
    return {
      instrucao: `Monte uma atividade com ${entrada.quantidade} questões objetivas sobre o tema pedido, a partir dos trechos do material.`,
      dados: [
        { tipo: 'tema_pedido_pelo_professor', corpo: entrada.tema },
        dadoEmJson('serie_e_disciplina', entrada.contexto),
        dadoEmJson('habilidades', entrada.habilidades),
        ...dadosDosTrechos(entrada.trechos),
      ],
    }
  },

  conferir(entrada, saida) {
    const problemas = problemasDasQuestoes(saida.questoes, entrada)
    if (saida.questoes.length > entrada.quantidade) problemas.push(`Foram pedidas ${entrada.quantidade} questões: não devolva mais que isso.`)
    if (saida.adaptacao !== undefined) problemas.push('A atividade gerada não tem "adaptacao": esse campo só existe na versão adaptada.')
    return problemas
  },

  falso(entrada): ConteudoDeAtividade {
    const questoes = questoesDoMaterial(entrada)
    // Material sem frase aproveitável não vira atividade inventada: falha como saída inválida, e o professor é avisado.
    if (questoes.length === 0) throw new MaterialSemConteudoAproveitavelError()
    return { tipo: 'atividade_objetiva', titulo: cortar(`Atividade — ${entrada.tema}`, 160), questoes }
  },
})
