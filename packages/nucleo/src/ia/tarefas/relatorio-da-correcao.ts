import { ALTERNATIVAS_POR_QUESTAO, habilidadeSchema } from '@educa/shared'
import { z } from 'zod'
import { dadoEmJson } from '../material.js'
import { PROMPT_RELATORIO_DA_CORRECAO } from '../prompts/relatorio-da-correcao.js'
import { definirTarefa } from '../tarefa.js'
import { cortar } from '../texto.js'

const contagem = z.number().int().min(0)

/**
 * A correção da objetiva é determinística e é do domínio: compara com o gabarito e conta. Aqui chegam só os
 * **números já calculados**, por questão, da turma inteira; a IA os põe em palavras para o professor. Não há
 * resposta de aluno nem aluno identificado na entrada, e por isso nada do que sai é sobre um aluno.
 */
export const esquemaEntradaDoRelatorio = z.strictObject({
  /** O título do artefato, escrito pelo professor ou pelo Assistente. */
  titulo: z.string().min(1).max(160),
  /** Quantos alunos enviaram a atividade. */
  respondentes: contagem,
  questoes: z
    .array(
      z.strictObject({
        numero: z.number().int().min(1).max(20),
        habilidade: habilidadeSchema,
        gabarito: z.number().int().min(0).max(ALTERNATIVAS_POR_QUESTAO - 1),
        /** Quantas respostas em cada alternativa, na ordem da questão. */
        marcacoes: z.array(contagem).length(ALTERNATIVAS_POR_QUESTAO),
        emBranco: contagem,
      }),
    )
    .min(1)
    .max(20),
})
export type EntradaDoRelatorio = z.infer<typeof esquemaEntradaDoRelatorio>

export const esquemaSaidaDoRelatorio = z.strictObject({
  visaoGeral: z.string().min(1).max(800),
  questoes: z.array(z.strictObject({ numero: z.number().int().min(1).max(20), texto: z.string().min(1).max(500) })).min(1).max(20),
})
export type SaidaDoRelatorio = z.infer<typeof esquemaSaidaDoRelatorio>

type QuestaoCorrigida = EntradaDoRelatorio['questoes'][number]

const LETRAS = ['A', 'B', 'C', 'D'] as const
const letra = (indice: number): string => LETRAS[indice] ?? '?'
const plural = (quantidade: number, um: string, varios: string): string => `${quantidade} ${quantidade === 1 ? um : varios}`

function numerosDaQuestao(questao: QuestaoCorrigida): { acertos: number; total: number; percentual: number } {
  const acertos = questao.marcacoes[questao.gabarito] ?? 0
  const total = questao.marcacoes.reduce((soma, marcadas) => soma + marcadas, 0) + questao.emBranco
  return { acertos, total, percentual: total === 0 ? 0 : Math.round((acertos / total) * 100) }
}

function textoDaQuestao(questao: QuestaoCorrigida): string {
  const { acertos, total, percentual } = numerosDaQuestao(questao)
  if (total === 0) return 'Ninguém respondeu a esta questão.'
  const partes = [`${acertos} de ${total} acertaram (${percentual}%). A correta é a ${letra(questao.gabarito)}.`]
  let maisMarcada = -1
  questao.marcacoes.forEach((marcadas, indice) => {
    if (indice !== questao.gabarito && marcadas > (questao.marcacoes[maisMarcada] ?? 0)) maisMarcada = indice
  })
  if (maisMarcada >= 0) partes.push(`A errada mais marcada foi a ${letra(maisMarcada)}, com ${plural(questao.marcacoes[maisMarcada] ?? 0, 'resposta', 'respostas')}.`)
  if (questao.emBranco > 0) partes.push(`${plural(questao.emBranco, 'ficou', 'ficaram')} em branco.`)
  if (acertos === total) partes.push('Todos acertaram.')
  else if (acertos * 2 < total) partes.push(`Menos da metade acertou: vale retomar “${questao.habilidade.descricao}”.`)
  else partes.push(`A maioria acertou; os erros pedem uma revisão rápida de “${questao.habilidade.descricao}”.`)
  return cortar(partes.join(' '), 500)
}

export const relatorioDaCorrecao = definirTarefa({
  nome: 'relatorio_da_correcao',
  funcao: 'correcao_de_objetiva',
  perfil: 'rapido',
  esquemaDeEntrada: esquemaEntradaDoRelatorio,
  esquemaDeSaida: esquemaSaidaDoRelatorio,
  prompt: PROMPT_RELATORIO_DA_CORRECAO,
  maximoDeTokensDeSaida: 2500,
  levaTextoLivreDePessoa: false,
  levaTextoDeAluno: false,

  montarPedido(entrada) {
    return {
      instrucao: 'Escreva o relatório por questão a partir dos números já calculados.',
      dados: [dadoEmJson('numeros_da_correcao', entrada)],
    }
  },

  conferir(entrada, saida) {
    const pedidas = entrada.questoes.map((questao) => questao.numero).join(',')
    const devolvidas = saida.questoes.map((questao) => questao.numero).join(',')
    return pedidas === devolvidas ? [] : [`O relatório precisa ter um texto para cada questão recebida, na mesma ordem: ${pedidas}.`]
  },

  falso(entrada): SaidaDoRelatorio {
    const porAcerto = [...entrada.questoes].sort((a, b) => numerosDaQuestao(a).percentual - numerosDaQuestao(b).percentual || a.numero - b.numero)
    const [menor] = porAcerto
    const maior = porAcerto.at(-1)
    const extremos =
      menor === undefined || maior === undefined || menor.numero === maior.numero
        ? ''
        : ` A questão com menos acertos foi a ${menor.numero} (${numerosDaQuestao(menor).percentual}%), e a com mais acertos, a ${maior.numero} (${numerosDaQuestao(maior).percentual}%).`
    return {
      visaoGeral: cortar(`Em “${entrada.titulo}”, ${plural(entrada.respondentes, 'aluno enviou', 'alunos enviaram')} ${plural(entrada.questoes.length, 'questão', 'questões')}.${extremos}`, 800),
      questoes: entrada.questoes.map((questao) => ({ numero: questao.numero, texto: textoDaQuestao(questao) })),
    }
  },
})
