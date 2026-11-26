import { InvariantException, type QuestaoDaProva } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { readOrdem, naOrdemDoAluno, ordemDaProvaSchema, sortearOrdem, sorteadorDeProducao, type OrdemDaProva, type Sorteador } from './ordem-da-prova.js'

/** Um sorteador de roteiro: devolve, na ordem, os números dados, e anota quantas vezes foi chamado e com que limite. Roteiro curto ou número fora do limite é defeito do teste. */
function roteiro(...numeros: number[]): { sortear: Sorteador; chamadas: number[] } {
  const fila = [...numeros]
  const chamadas: number[] = []
  const sortear: Sorteador = (limite) => {
    chamadas.push(limite)
    const proximo = fila.shift()
    if (proximo === undefined || proximo >= limite) throw new Error(`o roteiro não tem um número válido para o limite ${String(limite)}`)
    return proximo
  }
  return { sortear, chamadas }
}

const NUNCA: Sorteador = () => {
  throw new Error('o sorteador não devia ser chamado')
}

const IDENTIDADE_DAS_ALTERNATIVAS = [0, 1, 2, 3]
const SEM_EMBARALHAR = { questoes: false, alternativas: false }

/** Três questões de teste, com o texto de cada alternativa dizendo a questão e o índice original: o que o aluno vê diz de onde veio. */
const originais: QuestaoDaProva[] = [1, 2, 3].map((numero) => ({
  numero,
  enunciado: `Enunciado ${String(numero)}`,
  alternativas: IDENTIDADE_DAS_ALTERNATIVAS.map((indice) => `Q${String(numero)} alternativa ${String(indice)}`),
  ordemDasAlternativas: IDENTIDADE_DAS_ALTERNATIVAS,
}))

describe('ordem da prova: o sorteio por aluno', () => {
  describe('sortearOrdem', () => {
    it('sem embaralhar nada a ordem é nula, e o sorteador nem é chamado', () => {
      expect(sortearOrdem(5, SEM_EMBARALHAR, NUNCA)).toBeNull()
    })

    it('com o sorteador que sempre devolve 0, cada lista gira uma casa para a esquerda: questões 2, 3, 4, 5, 1 e alternativas 1, 2, 3, 0 em todas', () => {
      const { sortear, chamadas } = roteiro(...Array<number>(4 + 5 * 3).fill(0))
      expect(sortearOrdem(5, { questoes: true, alternativas: true }, sortear)).toEqual({
        questoes: [2, 3, 4, 5, 1],
        alternativas: [[1, 2, 3, 0], [1, 2, 3, 0], [1, 2, 3, 0], [1, 2, 3, 0], [1, 2, 3, 0]],
      })
      // Primeiro as 4 voltas das questões (5, 4, 3, 2), depois as 3 de cada questão, na ordem original delas (4, 3, 2).
      expect(chamadas).toEqual([5, 4, 3, 2, ...Array.from({ length: 5 }, () => [4, 3, 2]).flat()])
    })

    it('o sorteador que sempre devolve o máximo deixa a ordem original, mas ela ainda é gravada (a aplicação embaralha)', () => {
      const { sortear } = roteiro(2, 1, 3, 2, 1, 3, 2, 1, 3, 2, 1)
      expect(sortearOrdem(3, { questoes: true, alternativas: true }, sortear)).toEqual({ questoes: [1, 2, 3], alternativas: [[0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3]] })
    })

    it('só alternativas: as questões ficam na ordem original e o sorteio delas não acontece (3 voltas por questão, nenhuma de 5)', () => {
      const { sortear, chamadas } = roteiro(...Array<number>(5 * 3).fill(0))
      const ordem = sortearOrdem(5, { questoes: false, alternativas: true }, sortear)
      expect(ordem?.questoes).toEqual([1, 2, 3, 4, 5])
      expect(ordem?.alternativas).toEqual(Array.from({ length: 5 }, () => [1, 2, 3, 0]))
      expect(chamadas).toEqual(Array.from({ length: 5 }, () => [4, 3, 2]).flat())
    })

    it('só questões: as alternativas ficam na ordem original e só as 4 voltas das questões sorteiam', () => {
      const { sortear, chamadas } = roteiro(...Array<number>(4).fill(0))
      const ordem = sortearOrdem(5, { questoes: true, alternativas: false }, sortear)
      expect(ordem?.questoes).toEqual([2, 3, 4, 5, 1])
      expect(ordem?.alternativas).toEqual(Array.from({ length: 5 }, () => IDENTIDADE_DAS_ALTERNATIVAS))
      expect(chamadas).toEqual([5, 4, 3, 2])
    })

    it('as 24 ordens possíveis de quatro alternativas saem, uma por roteiro, e cada uma é uma permutação (nenhuma alternativa some ou se repete)', () => {
      const vistas = new Set<string>()
      for (const a of [0, 1, 2, 3]) {
        for (const b of [0, 1, 2]) {
          for (const c of [0, 1]) {
            const { sortear } = roteiro(a, b, c)
            const ordem = sortearOrdem(1, { questoes: false, alternativas: true }, sortear)
            expect([...(ordem?.alternativas[0] ?? [])].sort()).toEqual(IDENTIDADE_DAS_ALTERNATIVAS)
            vistas.add(JSON.stringify(ordem?.alternativas[0]))
          }
        }
      }
      expect(vistas.size).toBe(24)
    })

    it('o sorteio de produção devolve inteiros de 0 ao limite menos 1, e todos eles saem', () => {
      const vistos = new Set(Array.from({ length: 400 }, () => sorteadorDeProducao(4)))
      expect([...vistos].sort()).toEqual([0, 1, 2, 3])
    })

    it('com o sorteio de produção, a ordem é sempre válida pelo esquema, qualquer que seja o sorteio', () => {
      for (let vez = 0; vez < 100; vez += 1) {
        expect(ordemDaProvaSchema.safeParse(sortearOrdem(20, { questoes: true, alternativas: true }, sorteadorDeProducao)).success).toBe(true)
      }
    })
  })

  describe('readOrdem', () => {
    it('coluna nula (ou ausente) é "sem embaralhar"', () => {
      expect(readOrdem(null)).toBeNull()
      expect(readOrdem(undefined)).toBeNull()
    })

    it('uma ordem válida volta como está', () => {
      const ordem: OrdemDaProva = { questoes: [2, 1], alternativas: [[1, 0, 3, 2], [0, 1, 2, 3]] }
      expect(readOrdem(ordem)).toEqual(ordem)
    })

    it.each([
      ['questão repetida', { questoes: [1, 1], alternativas: [[0, 1, 2, 3], [0, 1, 2, 3]] }],
      ['questão fora de 1 a n', { questoes: [2, 3], alternativas: [[0, 1, 2, 3], [0, 1, 2, 3]] }],
      ['alternativa repetida', { questoes: [1], alternativas: [[0, 0, 2, 3]] }],
      ['alternativa fora de 0 a 3', { questoes: [1], alternativas: [[0, 1, 2, 4]] }],
      ['só três alternativas', { questoes: [1], alternativas: [[0, 1, 2]] }],
      ['campo a mais', { questoes: [1], alternativas: [[0, 1, 2, 3]], nome: 'Maria' }],
      ['texto no lugar da ordem', 'embaralhada'],
    ])('%s é defeito dos dados: InvariantException', (_, gravada) => {
      expect(() => readOrdem(gravada)).toThrow(InvariantException)
    })
  })

  describe('naOrdemDoAluno', () => {
    it('sem ordem, a prova é a original, com a identidade nas alternativas', () => {
      expect(naOrdemDoAluno(originais, null)).toEqual(originais)
    })

    it('as questões saem na ordem do aluno, com o número original, e cada alternativa leva o índice original e o texto dele', () => {
      const ordem: OrdemDaProva = { questoes: [3, 1, 2], alternativas: [[1, 2, 0, 3], [3, 2, 1, 0], [0, 2, 1, 3]] }
      const prova = naOrdemDoAluno(originais, ordem)
      expect(prova.map((questao) => questao.numero)).toEqual([3, 1, 2])
      // A questão 3 usa a ordem de alternativas da questão 3 (a terceira da lista), e não a da posição em que aparece.
      expect(prova[0]).toEqual({ numero: 3, enunciado: 'Enunciado 3', alternativas: ['Q3 alternativa 0', 'Q3 alternativa 2', 'Q3 alternativa 1', 'Q3 alternativa 3'], ordemDasAlternativas: [0, 2, 1, 3] })
      expect(prova[1]?.ordemDasAlternativas).toEqual([1, 2, 0, 3])
      expect(prova[1]?.alternativas).toEqual(['Q1 alternativa 1', 'Q1 alternativa 2', 'Q1 alternativa 0', 'Q1 alternativa 3'])
      expect(prova[2]?.ordemDasAlternativas).toEqual([3, 2, 1, 0])
      for (const questao of prova) {
        questao.alternativas.forEach((texto, posicao) => expect(texto).toBe(`Q${String(questao.numero)} alternativa ${String(questao.ordemDasAlternativas[posicao])}`))
      }
    })

    it('não muda a lista original', () => {
      naOrdemDoAluno(originais, { questoes: [3, 2, 1], alternativas: [[3, 2, 1, 0], [3, 2, 1, 0], [3, 2, 1, 0]] })
      expect(originais.map((questao) => questao.numero)).toEqual([1, 2, 3])
      expect(originais[0]?.ordemDasAlternativas).toEqual(IDENTIDADE_DAS_ALTERNATIVAS)
    })

    it('ordem de outra quantidade de questões, ou com ordem de alternativas de menos ou de mais, é defeito dos dados', () => {
      const quatroOrdens = [[0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3]]
      // Questões de menos que a atividade (com as alternativas certas), questões de mais que a atividade, e as questões certas com ordem de alternativas de menos e de mais.
      expect(() => naOrdemDoAluno(originais, { questoes: [1, 2], alternativas: quatroOrdens.slice(0, 3) })).toThrow(InvariantException)
      expect(() => naOrdemDoAluno(originais.slice(0, 2), { questoes: [1, 2, 3], alternativas: quatroOrdens.slice(0, 2) })).toThrow(InvariantException)
      expect(() => naOrdemDoAluno(originais, { questoes: [1, 2, 3], alternativas: quatroOrdens.slice(0, 2) })).toThrow(InvariantException)
      expect(() => naOrdemDoAluno(originais, { questoes: [1, 2, 3], alternativas: quatroOrdens })).toThrow(InvariantException)
    })

    it('número de questão que a atividade não tem (ordem montada à mão, fora do `readOrdem`) é defeito dos dados', () => {
      expect(() => naOrdemDoAluno(originais, { questoes: [1, 2, 4], alternativas: [[0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3]] })).toThrow(InvariantException)
    })
  })
})
