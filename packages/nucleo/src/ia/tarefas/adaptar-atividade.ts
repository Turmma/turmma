import { adaptacaoAplicadaSchema, conteudoDeAtividadeSchema, type ConteudoDeAtividade, type QuestaoObjetiva, type TipoDeAdaptacao } from '@educa/shared'
import { z } from 'zod'
import { PROMPT_ADAPTAR_ATIVIDADE } from '../prompts/adaptar-atividade.js'
import { dadoEmJson } from '../material.js'
import { defineTask } from '../tarefa.js'
import { capitalizar, cortar } from '../texto.js'

/**
 * A entrada da Adaptação é a atividade e os **tipos** de adaptação, e mais nada (D35, D67). O objeto é estrito: não
 * existe chave para nome, condição, diagnóstico, laudo ou observação sobre aluno, e mandar uma é entrada inválida.
 */
export const adaptacaoInputSchema = z
  .strictObject({
    /** A atividade original, ainda sem adaptação. */
    conteudo: conteudoDeAtividadeSchema,
    adaptacao: adaptacaoAplicadaSchema,
  })
  .superRefine((entrada, contexto) => {
    if (entrada.conteudo.adaptacao !== undefined) {
      contexto.addIssue({ code: 'custom', path: ['conteudo', 'adaptacao'], message: 'a atividade de origem não pode já ser uma versão adaptada' })
    }
    if (entrada.adaptacao.tempoExtraPercentual !== undefined && !entrada.adaptacao.tipos.includes('tempo_adicional')) {
      contexto.addIssue({ code: 'custom', path: ['adaptacao', 'tempoExtraPercentual'], message: 'tempo extra só vale com o tipo tempo_adicional' })
    }
  })
export type AdaptacaoInput = z.infer<typeof adaptacaoInputSchema>

const ABERTURAS_INDIRETAS = /^(Segundo o material|De acordo com o material|Conforme o material|Com base no material)\s*,\s*/iu

function comLinguagemDireta(enunciado: string): string {
  return capitalizar(enunciado.replace(ABERTURAS_INDIRETAS, ''))
}

/** Tira o que vem entre parênteses e quebra o ponto e vírgula em frases: uma ideia por frase, a mesma pergunta. */
function comEnunciadoSimplificado(enunciado: string): string {
  const semParenteses = enunciado.replace(/\s*\([^)]*\)/gu, '')
  const emFrases = semParenteses
    .split(/;\s*/u)
    .map((parte) => capitalizar(parte.trim()))
    .filter((parte) => parte.length > 0)
    .map((parte) => (/[.!?”"]$/u.test(parte) ? parte : `${parte}.`))
    .join(' ')
  return `${emFrases}\nMarque uma alternativa.`
}

/** Aponta a página, sem copiar o trecho: a frase citada costuma ser, palavra por palavra, a alternativa correta. */
function comLeituraDeApoio(questao: QuestaoObjetiva, enunciado: string): string {
  return `Leitura de apoio: releia a página ${questao.citacao.pagina} do material antes de responder.\n\n${enunciado}`
}

/**
 * Só três tipos mexem no texto. Fonte ampliada, tempo adicional e resposta escrita no lugar da oral mudam a
 * apresentação e a aplicação, que são da tela e do PDF: aqui eles ficam registrados em `adaptacao` e o texto não muda.
 */
function adaptarQuestao(questao: QuestaoObjetiva, tipos: readonly TipoDeAdaptacao[]): QuestaoObjetiva {
  let enunciado = questao.enunciado
  if (tipos.includes('linguagem_direta')) enunciado = comLinguagemDireta(enunciado)
  if (tipos.includes('enunciado_simplificado')) enunciado = comEnunciadoSimplificado(enunciado)
  if (tipos.includes('leitura_de_apoio')) enunciado = comLeituraDeApoio(questao, enunciado)
  return { ...questao, enunciado: cortar(enunciado, 1200) }
}

export const adaptarAtividade = defineTask({
  nome: 'adaptar_atividade',
  funcao: 'adaptacao',
  perfil: 'padrao',
  esquemaDeEntrada: adaptacaoInputSchema,
  esquemaDeSaida: conteudoDeAtividadeSchema,
  prompt: PROMPT_ADAPTAR_ATIVIDADE,
  maximoDeTokensDeSaida: 6000,
  levaTextoLivreDePessoa: false,
  levaTextoDeAluno: false,

  /** Os tipos e o tempo extra são do professor (D35, D67): o que o modelo escrever no lugar deles não vale. */
  prepararResposta(entrada, bruto) {
    return typeof bruto === 'object' && bruto !== null && !Array.isArray(bruto) ? { ...bruto, adaptacao: entrada.adaptacao } : bruto
  },

  montarPedido(entrada) {
    return {
      instrucao: 'Prepare a versão adaptada da atividade, aplicando os tipos de adaptação recebidos.',
      dados: [dadoEmJson('tipos_de_adaptacao', entrada.adaptacao), dadoEmJson('atividade_original', entrada.conteudo)],
    }
  },

  /** A adaptação muda a forma, nunca o que é cobrado: mesmo gabarito, mesma habilidade, mesma citação, questão a questão. */
  conferir(entrada, saida) {
    const problemas: string[] = []
    if (saida.questoes.length !== entrada.conteudo.questoes.length) {
      problemas.push(`A atividade original tem ${entrada.conteudo.questoes.length} questões, e a adaptada precisa ter as mesmas, na mesma ordem.`)
    }
    entrada.conteudo.questoes.forEach((original, indice) => {
      const adaptada = saida.questoes[indice]
      if (adaptada === undefined) return
      const onde = `Questão ${indice + 1}`
      if (adaptada.gabarito !== original.gabarito) problemas.push(`${onde}: o gabarito e a ordem das alternativas não mudam na adaptação.`)
      if (adaptada.habilidade.codigo !== original.habilidade.codigo) problemas.push(`${onde}: a habilidade é a da questão original, copiada como veio.`)
      if (adaptada.citacao.materialId !== original.citacao.materialId || adaptada.citacao.pagina !== original.citacao.pagina || adaptada.citacao.trecho !== original.citacao.trecho) {
        problemas.push(`${onde}: a citação é a da questão original, copiada como veio.`)
      }
    })
    const pedidos = [...entrada.adaptacao.tipos].sort().join(',')
    const aplicados = [...(saida.adaptacao?.tipos ?? [])].sort().join(',')
    if (pedidos !== aplicados || saida.adaptacao?.tempoExtraPercentual !== entrada.adaptacao.tempoExtraPercentual) {
      problemas.push('"adaptacao" precisa ser igual à recebida: os mesmos tipos e o mesmo tempo extra.')
    }
    return problemas
  },

  falso(entrada): ConteudoDeAtividade {
    return {
      tipo: 'atividade_objetiva',
      titulo: cortar(`${entrada.conteudo.titulo} (versão adaptada)`, 160),
      questoes: entrada.conteudo.questoes.map((questao) => adaptarQuestao(questao, entrada.adaptacao.tipos)),
      adaptacao: entrada.adaptacao,
    }
  },
})
