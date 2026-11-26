import { randomInt } from 'node:crypto'
import { ALTERNATIVAS_POR_QUESTAO, InvariantException, alternativaSchema, type Embaralhar, type QuestaoDaProva } from '@educa/shared'
import { z } from 'zod'

/**
 * A ordem da prova de um aluno (avaliacao-e-correcao, 4.0; RF8; Tech Spec §5.3): **só de apresentação**. A tentativa guarda, uma vez, em que ordem o aluno vê as questões e as
 * alternativas; a resposta, a correção, o relatório e o diagnóstico continuam pelo número da questão e pelo índice da alternativa **originais**.
 */

/** Nenhum índice repete. Com quatro índices, cada um de 0 a 3 (`alternativaSchema`), é o mesmo que ser uma permutação. */
const semRepeticao = (indices: readonly number[]): boolean => new Set(indices).size === indices.length

/** `[0, 1, …, n - 1]`: a ordem original. */
const identidade = (tamanho: number): number[] => Array.from({ length: tamanho }, (_, indice) => indice)

/** O sorteio: um inteiro de 0 a `limiteExclusivo - 1`. Em produção é `crypto.randomInt`; o teste injeta a sequência que quer, e nada aqui depende do acaso. */
export type Sorteador = (limiteExclusivo: number) => number

export const sorteadorDeProducao: Sorteador = (limiteExclusivo) => randomInt(limiteExclusivo)

/**
 * O que a coluna `tentativa_atividade.ordem` guarda: `questoes` são os números originais na ordem em que o aluno os vê; `alternativas[k]` é a ordem das alternativas da questão
 * de número original `k + 1` (o índice original de cada posição). Só posições, números: nenhum texto, nenhuma pessoa.
 */
export const ordemDaProvaSchema = z
  .strictObject({
    questoes: z.array(z.number()),
    alternativas: z.array(z.array(alternativaSchema).length(ALTERNATIVAS_POR_QUESTAO).refine(semRepeticao, { message: 'as alternativas são uma permutação' })),
  })
  .refine(({ questoes }) => [...questoes].sort((a, b) => a - b).every((numero, indice) => numero === indice + 1), { message: 'as questões são uma permutação de 1 a n' })
export type OrdemDaProva = z.infer<typeof ordemDaProvaSchema>

/** Fisher–Yates com o sorteador dado: `[0, 1, …, n - 1]` na ordem sorteada. A cada posição `i`, de trás para a frente, sorteia `sortear(i + 1)`: o sorteador que sempre devolve `0` gira a lista uma casa para a esquerda. */
function permutar(tamanho: number, sortear: Sorteador): number[] {
  const indices = identidade(tamanho)
  for (let posicao = tamanho - 1; posicao > 0; posicao -= 1) {
    const outra = sortear(posicao + 1)
    ;[indices[posicao], indices[outra]] = [indices[outra] as number, indices[posicao] as number]
  }
  return indices
}

/**
 * A ordem do aluno que começa agora: **nula quando a aplicação não embaralha nada** (o sorteador nem é chamado). Só alternativas deixa as questões na ordem original, e só
 * questões deixa as alternativas na ordem original: a que não foi pedida fica na identidade, e o sorteio dela não acontece.
 */
export function sortearOrdem(total: number, embaralhar: Embaralhar, sortear: Sorteador): OrdemDaProva | null {
  if (!embaralhar.questoes && !embaralhar.alternativas) return null
  const questoes = (embaralhar.questoes ? permutar(total, sortear) : identidade(total)).map((indice) => indice + 1)
  const alternativas = Array.from({ length: total }, () => (embaralhar.alternativas ? permutar(ALTERNATIVAS_POR_QUESTAO, sortear) : identidade(ALTERNATIVAS_POR_QUESTAO)))
  return { questoes, alternativas }
}

/** A ordem gravada, lida de volta: coluna nula é "sem embaralhar"; o que não é uma ordem de verdade é defeito dos dados, não entrada do aluno. */
export function readOrdem(gravada: unknown): OrdemDaProva | null {
  if (gravada === null || gravada === undefined) return null
  const lida = ordemDaProvaSchema.safeParse(gravada)
  if (!lida.success) throw new InvariantException('ordem da prova inválida')
  return lida.data
}

/**
 * A prova do aluno: as questões do artefato (na ordem original, com a identidade nas alternativas) postas na ordem dele. O `numero` da questão e o índice de cada alternativa
 * seguem os originais. Ordem que não bate com a atividade é defeito dos dados, e a prova não sai.
 */
export function naOrdemDoAluno(originais: readonly QuestaoDaProva[], ordem: OrdemDaProva | null): QuestaoDaProva[] {
  if (ordem === null) return [...originais]
  if (ordem.questoes.length !== originais.length || ordem.alternativas.length !== originais.length) throw new InvariantException('ordem da prova não bate com a atividade')
  return ordem.questoes.map((numero) => {
    const original = originais[numero - 1]
    const posicoes = ordem.alternativas[numero - 1]
    if (original === undefined || posicoes === undefined) throw new InvariantException('ordem da prova aponta questão que não existe')
    return {
      numero: original.numero,
      enunciado: original.enunciado,
      alternativas: posicoes.map((indice) => original.alternativas[indice] as string),
      ordemDasAlternativas: posicoes,
    }
  })
}
