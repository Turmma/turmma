import { conteudoDePlanoDeAulaSchema, TAMANHO_MAXIMO_DO_TEMA, type Citacao, type ConteudoDePlanoDeAula } from '@educa/shared'
import { z } from 'zod'
import {
  citacaoDaFrase,
  dadoEmJson,
  dadosDosTrechos,
  contextoDaTurmaSchema,
  habilidadesSchema,
  trechoSchema,
  extrairFatos,
  frasesDoMaterial,
  problemasDasCitacoes,
  type FraseDoMaterial,
} from '../material.js'
import { PROMPT_GERAR_PLANO_DE_AULA } from '../prompts/gerar-plano-de-aula.js'
import { defineTask, MaterialSemConteudoAproveitavelError } from '../task.js'
import { cortar, enumerar, palavras, palavrasEmComum } from '../text.js'

export const planoDeAulaInputSchema = z.strictObject({
  tema: z.string().min(1).max(TAMANHO_MAXIMO_DO_TEMA),
  duracaoMinutos: z.number().int().min(10).max(240),
  contexto: contextoDaTurmaSchema,
  habilidades: habilidadesSchema,
  trechos: z.array(trechoSchema).min(1).max(12),
})
export type PlanoDeAulaInput = z.infer<typeof planoDeAulaInputSchema>

/** Um ponto do material em que uma etapa se apoia: como chamá-lo no meio da frase, entre aspas, e a frase de onde saiu. */
interface Apoio extends FraseDoMaterial {
  /** "o conceito de reagente limitante", ou "o trecho “…”" quando o material não tem frase definitória. */
  readonly referencia: string
  /** "reagente limitante": para citar entre aspas e para a lista da avaliação. */
  readonly nome: string
  /** Quantas palavras do tema pedido a frase tem. */
  readonly afinidade: number
}

function apoiosDoMaterial(entrada: PlanoDeAulaInput): Apoio[] {
  const fatos = extrairFatos(entrada.trechos).filter((fato) => !fato.numerico)
  if (fatos.length > 0) {
    return fatos.map((fato) => ({
      materialId: fato.materialId,
      pagina: fato.pagina,
      frase: fato.frase,
      referencia: `o conceito de ${fato.termo}`,
      nome: fato.termo,
      afinidade: palavrasEmComum(entrada.tema, fato.frase),
    }))
  }
  // Sem frase definitória, o apoio é a própria frase, chamada pelas primeiras palavras dela.
  return frasesDoMaterial(entrada.trechos)
    .filter((frase) => palavras(frase.frase).length >= 6)
    .map((frase) => {
      const comeco = `${palavras(frase.frase).slice(0, 5).join(' ')}…`
      return { ...frase, referencia: `o trecho “${comeco}”`, nome: comeco, afinidade: palavrasEmComum(entrada.tema, frase.frase) }
    })
}

/**
 * Quatro apoios, na ordem do material. Primeiro os que falam do tema pedido; faltando, completa com os outros,
 * espalhados do começo ao fim. Com menos de quatro no material inteiro, repete o último.
 */
function quatroApoios(apoios: readonly Apoio[]): [Apoio, Apoio, Apoio, Apoio] {
  const ordem = apoios.map((_apoio, indice) => indice)
  const doTema = ordem.filter((indice) => (apoios[indice]?.afinidade ?? 0) > 0).sort((a, b) => (apoios[b]?.afinidade ?? 0) - (apoios[a]?.afinidade ?? 0))
  const outros = ordem.filter((indice) => !doTema.includes(indice))
  const espalhados = [0, 1 / 3, 2 / 3, 1].map((fracao) => outros[Math.round((outros.length - 1) * fracao)]).filter((indice) => indice !== undefined)
  const escolhidos = [...new Set([...doTema, ...espalhados, ...outros])].slice(0, 4).sort((a, b) => a - b)
  const escolher = (posicao: number): Apoio => {
    const apoio = apoios[escolhidos[Math.min(posicao, escolhidos.length - 1)] ?? -1]
    // Material sem nenhuma frase aproveitável não vira plano inventado.
    if (apoio === undefined) throw new MaterialSemConteudoAproveitavelError()
    return apoio
  }
  return [escolher(0), escolher(1), escolher(2), escolher(3)]
}

function citacoesSemRepetir(apoios: readonly Apoio[]): Citacao[] {
  const vistas = new Set<string>()
  return apoios.flatMap((apoio) => {
    const chave = `${apoio.materialId}:${apoio.pagina}`
    if (vistas.has(chave)) return []
    vistas.add(chave)
    return [citacaoDaFrase(apoio)]
  })
}

export const gerarPlanoDeAula = defineTask({
  nome: 'gerar_plano_de_aula',
  funcao: 'conversa_e_ferramentas',
  perfil: 'padrao',
  esquemaDeEntrada: planoDeAulaInputSchema,
  esquemaDeSaida: conteudoDePlanoDeAulaSchema,
  prompt: PROMPT_GERAR_PLANO_DE_AULA,
  maximoDeTokensDeSaida: 4000,
  levaTextoLivreDePessoa: false,
  levaTextoDeAluno: false,

  montarPedido(entrada) {
    return {
      instrucao: `Monte um plano de aula de ${entrada.duracaoMinutos} minutos sobre o tema pedido, a partir dos trechos do material.`,
      dados: [
        { tipo: 'tema_pedido_pelo_professor', corpo: entrada.tema },
        dadoEmJson('serie_e_disciplina', entrada.contexto),
        dadoEmJson('habilidades', entrada.habilidades),
        ...dadosDosTrechos(entrada.trechos),
      ],
    }
  },

  conferir(entrada, saida) {
    const problemas = problemasDasCitacoes(saida.citacoes, entrada.trechos, 'Lista de citações')
    saida.etapas.forEach((etapa, indice) => {
      // O schema deixa a citação da etapa opcional; a regra não deixa (regra 30, item 12).
      if (etapa.citacao === undefined) problemas.push(`Etapa ${indice + 1}: falta a citação. Toda etapa cita o material e a página de onde saiu.`)
      else problemas.push(...problemasDasCitacoes([etapa.citacao], entrada.trechos, `Etapa ${indice + 1}`))
    })
    const codigos = new Set(entrada.habilidades.map((habilidade) => habilidade.codigo))
    if (saida.habilidades.some((habilidade) => !codigos.has(habilidade.codigo))) problemas.push('As habilidades do plano precisam ser das recebidas, copiadas como vieram.')
    const soma = saida.etapas.reduce((total, etapa) => total + etapa.minutos, 0)
    if (soma > entrada.duracaoMinutos) problemas.push(`As etapas somam ${soma} minutos, e a aula tem ${entrada.duracaoMinutos}. A soma não pode passar da duração.`)
    if (saida.duracaoMinutos !== entrada.duracaoMinutos) problemas.push(`"duracaoMinutos" precisa ser a duração pedida: ${entrada.duracaoMinutos}.`)
    return problemas
  },

  falso(entrada): ConteudoDePlanoDeAula {
    const apoios = apoiosDoMaterial(entrada)
    const [abertura, exposicao, pratica, fechamento] = quatroApoios(apoios)
    const usados = [abertura, exposicao, pratica, fechamento]
    const nomes = [...new Set(usados.map((apoio) => apoio.nome))]
    const referencias = [...new Set(usados.map((apoio) => apoio.referencia))]
    // Cada parte tem pelo menos um minuto, e o fechamento fica com o que sobrar: a soma é sempre a duração pedida.
    const minutosDaAbertura = Math.max(1, Math.floor(entrada.duracaoMinutos * 0.15))
    const minutosDaExposicao = Math.max(1, Math.floor(entrada.duracaoMinutos * 0.35))
    const minutosDaPratica = Math.max(1, Math.floor(entrada.duracaoMinutos * 0.35))
    const minutosDoFechamento = entrada.duracaoMinutos - minutosDaAbertura - minutosDaExposicao - minutosDaPratica
    return {
      tipo: 'plano_de_aula',
      titulo: cortar(`Plano de aula — ${entrada.tema}`, 160),
      objetivos: referencias.map((referencia) => cortar(`Explicar ${referencia} com as próprias palavras, com apoio do material.`, 300)),
      habilidades: [...entrada.habilidades],
      duracaoMinutos: entrada.duracaoMinutos,
      etapas: [
        {
          titulo: 'Abertura: o que a turma já sabe',
          minutos: minutosDaAbertura,
          descricao: cortar(`Pergunte à turma o que ela entende por “${abertura.nome}” e anote as respostas no quadro, sem corrigir ainda. Depois leia com ela o trecho da página ${abertura.pagina}.`, 800),
          citacao: citacaoDaFrase(abertura),
        },
        {
          titulo: 'Exposição dialogada',
          minutos: minutosDaExposicao,
          descricao: cortar(`Apresente ${exposicao.referencia} a partir da página ${exposicao.pagina} do material. A cada conceito, peça um exemplo à turma antes de dar o seu.`, 800),
          citacao: citacaoDaFrase(exposicao),
        },
        {
          titulo: 'Prática em duplas',
          minutos: minutosDaPratica,
          descricao: cortar(`Em duplas, os alunos explicam um ao outro ${pratica.referencia} e escrevem um exemplo próprio, consultando a página ${pratica.pagina}. Circule pela sala e anote as dúvidas que se repetem.`, 800),
          citacao: citacaoDaFrase(pratica),
        },
        {
          titulo: 'Fechamento',
          minutos: minutosDoFechamento,
          descricao: cortar(`Volte às respostas do quadro e compare com o que o material diz sobre ${fechamento.referencia}, na página ${fechamento.pagina}. Cada aluno escreve, em uma frase, o que mudou no que pensava.`, 800),
          citacao: citacaoDaFrase(fechamento),
        },
      ],
      avaliacao: cortar(`Atividade objetiva curta sobre ${enumerar(nomes)}, com a página do material citada em cada questão, corrigida em sala no fim da aula.`, 600),
      citacoes: citacoesSemRepetir(usados),
    }
  },
})
