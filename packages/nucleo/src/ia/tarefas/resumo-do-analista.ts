import { conteudoDoResumoDoAnalistaSchema, type AlertaDoAnalista, type ConteudoDoResumoDoAnalista, type HipoteseDoAnalista, type RecorteDoAnalista } from '@educa/shared'
import { isDeepStrictEqual } from 'node:util'
import { z } from 'zod'
import { dadoEmJson } from '../material.js'
import { PROMPT_RESUMO_DO_ANALISTA } from '../prompts/resumo-do-analista.js'
import { defineTask } from '../tarefa.js'

/**
 * O Analista recebe **só agregados**: o período, os números da escola e os recortes de série e disciplina que o
 * domínio já montou, nas formas do contrato (`conteudoDoResumoDoAnalistaSchema`, em `@educa/shared`). O recorte com
 * menos de dois professores nem cabe no schema (D45): entra só em `recortesNominais`, sem número. Não há professor,
 * turma nem aluno na entrada; o que não entra não tem como sair.
 *
 * O limiar do alerta é de quem chama, nunca constante daqui (os indicadores ainda são decisão em aberto).
 */
export const analistaInputSchema = conteudoDoResumoDoAnalistaSchema.omit({ alertas: true }).extend({
  /** Abaixo deste acerto a habilidade vira alerta. */
  limiarDeAcertoBaixoPercentual: z.number().min(0).max(100),
})
export type AnalistaInput = z.infer<typeof analistaInputSchema>

/**
 * A saída é **exatamente o que `resumo_do_analista.conteudo` guarda**: o mesmo schema do contrato, sem campo de texto.
 * O que a IA acrescenta são os alertas, e neles só escolhe o tipo e as hipóteses, de listas fechadas; a frase quem
 * monta é a tela (`docs/mvp-contratos.md`, decisão 14). Não existe onde escrever sobre uma pessoa.
 */
export const analistaOutputSchema = conteudoDoResumoDoAnalistaSchema
export type AnalistaOutput = ConteudoDoResumoDoAnalista

/** O acerto de uma habilidade no recorte, em percentual com uma casa: é o `valor` do alerta. */
export function acertoPercentual(acertos: number, total: number): number {
  return Math.round((acertos * 1000) / total) / 10
}

const mesmoRecorte = (alerta: AlertaDoAnalista, recorte: RecorteDoAnalista): boolean => alerta.serie.id === recorte.serie.id && alerta.disciplina.id === recorte.disciplina.id

/**
 * Com a saída em listas fechadas, a conferência deixa de procurar palavra e passa a conferir dado: tudo que veio na
 * entrada volta igual, e cada alerta aponta um recorte e uma habilidade que existem, com o número medido e o limiar
 * recebido. Série, disciplina e habilidade do alerta são as da entrada, campo por campo: é o único texto que há ali,
 * e o modelo não tem como trocá-lo.
 */
function problemasDoResumo(entrada: AnalistaInput, saida: AnalistaOutput): string[] {
  const problemas: string[] = []
  const { limiarDeAcertoBaixoPercentual: limiar, ...agregados } = entrada
  const { alertas, ...devolvidos } = saida
  if (!isDeepStrictEqual(devolvidos, agregados)) problemas.push('"periodo", "escola", "recortes" e "recortesNominais" voltam exatamente como vieram nos dados: não altere, não arredonde e não reordene.')
  const vistos = new Set<string>()
  alertas.forEach((alerta, indice) => {
    const onde = `Alerta ${indice + 1}`
    // Os dados desta fatia sustentam só o alerta de acerto baixo: queda pede período anterior, e os outros não são de habilidade.
    if (alerta.tipo !== 'habilidade_com_acerto_baixo') return void problemas.push(`${onde}: os dados só sustentam o tipo "habilidade_com_acerto_baixo".`)
    const recorte = entrada.recortes.find((candidato) => mesmoRecorte(alerta, candidato))
    const medida = recorte?.porHabilidade.find((item) => item.habilidade.codigo === alerta.habilidade?.codigo)
    if (recorte === undefined || medida === undefined) return void problemas.push(`${onde}: série, disciplina e habilidade precisam ser de um recorte recebido.`)
    if (!isDeepStrictEqual(alerta.serie, recorte.serie) || !isDeepStrictEqual(alerta.disciplina, recorte.disciplina) || !isDeepStrictEqual(alerta.habilidade, medida.habilidade)) {
      problemas.push(`${onde}: série, disciplina e habilidade são copiadas do recorte, campo por campo.`)
    }
    const valor = acertoPercentual(medida.acertos, medida.total)
    if (alerta.valor !== valor || alerta.referencia !== limiar) problemas.push(`${onde}: "valor" é o acerto medido (${valor}) e "referencia" é o limiar recebido (${limiar}).`)
    if (valor >= limiar) problemas.push(`${onde}: só é alerta a habilidade com acerto abaixo do limiar de ${limiar}%.`)
    if (new Set(alerta.hipoteses).size !== alerta.hipoteses.length) problemas.push(`${onde}: não repita hipótese.`)
    const chave = `${recorte.serie.id}:${recorte.disciplina.id}:${medida.habilidade.codigo}`
    if (vistos.has(chave)) problemas.push(`${onde}: já há um alerta para esta habilidade neste recorte.`)
    vistos.add(chave)
  })
  return problemas
}

/**
 * As hipóteses que os números permitem levantar sem modelo. Com um lote só, o número ainda diz pouco; com mais, as
 * duas que cabe conferir primeiro. São sempre sobre o conteúdo e o material, e sempre hipótese.
 */
function hipotesesDoRecorte(recorte: RecorteDoAnalista): HipoteseDoAnalista[] {
  return recorte.lotesAprovados < 2 ? ['poucas_atividades_no_tema'] : ['conteudo_recente', 'questoes_acima_do_material']
}

const MAXIMO_DE_ALERTAS = 20

export const resumoDoAnalista = defineTask({
  nome: 'resumo_do_analista',
  funcao: 'resumo_e_alerta',
  perfil: 'padrao',
  esquemaDeEntrada: analistaInputSchema,
  esquemaDeSaida: analistaOutputSchema,
  prompt: PROMPT_RESUMO_DO_ANALISTA,
  maximoDeTokensDeSaida: 6000,
  levaTextoLivreDePessoa: false,
  levaTextoDeAluno: false,

  montarPedido(entrada) {
    return {
      instrucao: 'Monte o resumo da coordenação: devolva os agregados como vieram e acrescente os alertas das habilidades abaixo do limiar.',
      dados: [dadoEmJson('agregados_por_serie_e_disciplina', entrada)],
    }
  },

  conferir: problemasDoResumo,

  falso(entrada): AnalistaOutput {
    const { limiarDeAcertoBaixoPercentual: limiar, ...agregados } = entrada
    const alertas: AlertaDoAnalista[] = entrada.recortes
      .flatMap((recorte) =>
        recorte.porHabilidade.map((medida) => ({
          tipo: 'habilidade_com_acerto_baixo' as const,
          serie: recorte.serie,
          disciplina: recorte.disciplina,
          habilidade: medida.habilidade,
          valor: acertoPercentual(medida.acertos, medida.total),
          referencia: limiar,
          hipoteses: hipotesesDoRecorte(recorte),
        })),
      )
      .filter((alerta) => alerta.valor < limiar)
      // Do pior para o melhor; no empate, a ordem em que vieram.
      .sort((a, b) => a.valor - b.valor)
      .slice(0, MAXIMO_DE_ALERTAS)
    return { ...agregados, alertas }
  },
})
