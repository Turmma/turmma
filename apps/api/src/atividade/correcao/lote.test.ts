import { loteApresentadoSchema, type QuestaoObjetiva } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { corrigirTentativa, type RespostasDaTentativa } from '@educa/core'
import { loteApresentado, marcaDoApresentado, resumoDoLote, type CorrecaoDoLote, type DadosDoLote } from './lote.js'

const MATERIAL = '018f4e2a-7b1c-7d3e-9a4b-0123456789ab'
const ANA = '018f4e2a-7b1c-7d3e-9a4b-00000000000a'
const BIA = '018f4e2a-7b1c-7d3e-9a4b-00000000000b'
const CAIO = '018f4e2a-7b1c-7d3e-9a4b-00000000000c'

function questao(gabarito: number, codigo: string | null): QuestaoObjetiva {
  return { enunciado: 'Enunciado sintético', alternativas: ['a', 'b', 'c', 'd'], gabarito, habilidade: codigo === null ? null : { codigo, descricao: `Habilidade ${codigo}` }, citacao: { materialId: MATERIAL, pagina: 1, trecho: 'trecho' }, explicacao: 'explicação' }
}

const QUESTOES = [questao(0, 'QUI.EM.05'), questao(1, 'QUI.EM.05'), questao(2, 'QUI.EM.06')]

function dados(tentativas: Record<string, (number | null)[]>, destaques: Record<string, CorrecaoDoLote['destaques']> = {}, alunosDaTurma = 5): DadosDoLote {
  const respostas = new Map<string, RespostasDaTentativa>(
    Object.entries(tentativas).map(([alunoId, marcadas]) => [alunoId, new Map(marcadas.flatMap((alternativa, indice) => (alternativa === null ? [] : [[indice + 1, alternativa] as const])))]),
  )
  const correcoes = [...respostas].map(([alunoId, marcadas]) => ({ alunoId, ...corrigirTentativa(QUESTOES, marcadas), destaques: destaques[alunoId] ?? [], destaqueAbertoEm: null }))
  return { questoes: QUESTOES, alunosDaTurma, correcoes, respostas }
}

describe('resumo do lote com questão sem habilidade (classificacao-bncc, 10.0)', () => {
  it('a linha sem habilidade soma as questões de todos os alunos, vem na ordem em que aparece na atividade e não toca a de nenhum código', () => {
    const questoes = [questao(0, 'EM13CNT101'), questao(1, null), questao(2, null)]
    const respostas = new Map<string, RespostasDaTentativa>([
      [ANA, new Map([[1, 0], [2, 1], [3, 2]])],
      [BIA, new Map([[1, 3], [2, 1], [3, 0]])],
    ])
    const correcoes = [...respostas].map(([alunoId, marcadas]) => ({ alunoId, ...corrigirTentativa(questoes, marcadas), destaques: [], destaqueAbertoEm: null }))
    const resumo = resumoDoLote({ questoes, alunosDaTurma: 2, correcoes, respostas })
    expect(resumo.porHabilidade).toEqual([
      { habilidade: questoes[0]?.habilidade, acertos: 1, total: 2 },
      { habilidade: null, acertos: 3, total: 4 },
    ])
    expect(resumo.porQuestao.map((linha) => linha.habilidade?.codigo ?? null)).toEqual(['EM13CNT101', null, null])
  })
})

describe('a ordem da linha sem habilidade no resumo do lote (correção 2026-11-20-leitura-de-habilidade-nula)', () => {
  it('segue a ordem da atividade, e não vai para o fim: com a questão 1 sem habilidade, ela vem primeiro', () => {
    const questoes = [questao(0, null), questao(1, 'EM13CNT101'), questao(2, 'EM13CNT102')]
    const respostas = new Map<string, RespostasDaTentativa>([[ANA, new Map([[1, 0], [2, 1], [3, 3]])]])
    const correcoes = [...respostas].map(([alunoId, marcadas]) => ({ alunoId, ...corrigirTentativa(questoes, marcadas), destaques: [], destaqueAbertoEm: null }))
    const resumo = resumoDoLote({ questoes, alunosDaTurma: 1, correcoes, respostas })
    expect(resumo.porHabilidade.map((linha) => [linha.habilidade?.codigo ?? null, linha.acertos, linha.total])).toEqual([[null, 1, 1], ['EM13CNT101', 1, 1], ['EM13CNT102', 0, 1]])
  })
})

describe('resumo do lote', () => {
  const lote = dados({ [ANA]: [0, 1, 2], [BIA]: [0, 3, null], [CAIO]: [null, null, null] })

  it('soma os corrigidos, a média de questões acertadas, a distribuição por contagem de acertos e o acerto por habilidade', () => {
    const resumo = resumoDoLote(lote)
    expect(resumo).toMatchObject({ alunosDaTurma: 5, corrigidos: 3, questoes: 3, mediaDeAcertos: 1.33 })
    expect(resumo.distribuicao).toEqual([
      { de: 0, ate: 0, alunos: 1 },
      { de: 1, ate: 1, alunos: 1 },
      { de: 2, ate: 2, alunos: 0 },
      { de: 3, ate: 3, alunos: 1 },
    ])
    expect(resumo.porHabilidade).toEqual([
      { habilidade: { codigo: 'QUI.EM.05', descricao: 'Habilidade QUI.EM.05' }, acertos: 3, total: 6 },
      { habilidade: { codigo: 'QUI.EM.06', descricao: 'Habilidade QUI.EM.06' }, acertos: 1, total: 3 },
    ])
  })

  it('por questão: quantos marcaram cada alternativa, quantos acertaram e quantos deixaram em branco', () => {
    expect(resumoDoLote(lote).porQuestao).toEqual([
      { numero: 1, habilidade: QUESTOES[0]?.habilidade, gabarito: 0, acertos: 2, porAlternativa: [2, 0, 0, 0], emBranco: 1 },
      { numero: 2, habilidade: QUESTOES[1]?.habilidade, gabarito: 1, acertos: 1, porAlternativa: [0, 1, 0, 1], emBranco: 1 },
      { numero: 3, habilidade: QUESTOES[2]?.habilidade, gabarito: 2, acertos: 1, porAlternativa: [0, 0, 1, 0], emBranco: 2 },
    ])
  })

  it('o resumo só tem número somado: nenhum id de aluno, nenhum nome, nenhuma nota', () => {
    const texto = JSON.stringify(resumoDoLote(lote))
    for (const proibido of [ANA, BIA, CAIO, 'nota', 'conceito', 'pontuacao', 'nome']) expect(texto).not.toContain(proibido)
  })

  it('lote sem correção nenhuma tem média zero e a distribuição zerada', () => {
    const vazio = resumoDoLote(dados({}))
    expect(vazio).toMatchObject({ corrigidos: 0, mediaDeAcertos: 0, porHabilidade: [] })
    expect(vazio.distribuicao.every((faixa) => faixa.alunos === 0)).toBe(true)
  })
})

describe('o que a validação guarda como apresentado', () => {
  const lote = dados({ [CAIO]: [null, null, null], [ANA]: [0, 1, 2], [BIA]: [3, 3, 3] }, { [CAIO]: ['em_branco'], [BIA]: ['fora_do_historico', 'padrao_de_erro'] })

  it('leva o resumo e só os destacados, com o id e os motivos, em ordem de id, e passa no schema estrito do contrato', () => {
    const apresentado = loteApresentado(lote)
    expect(apresentado.destaques).toEqual([
      { alunoId: BIA, motivos: ['fora_do_historico', 'padrao_de_erro'] },
      { alunoId: CAIO, motivos: ['em_branco'] },
    ])
    expect(apresentado.resumo).toEqual(resumoDoLote(lote))
    expect(loteApresentadoSchema.safeParse(apresentado).success).toBe(true)
  })

  it('a marca é a mesma para o mesmo lote e muda quando um número, um destaque ou o tamanho da turma muda', () => {
    const marca = marcaDoApresentado(loteApresentado(lote))
    expect(marcaDoApresentado(loteApresentado(dados({ [CAIO]: [null, null, null], [ANA]: [0, 1, 2], [BIA]: [3, 3, 3] }, { [CAIO]: ['em_branco'], [BIA]: ['fora_do_historico', 'padrao_de_erro'] })))).toBe(marca)
    expect(marcaDoApresentado(loteApresentado(dados({ [CAIO]: [null, null, null], [ANA]: [0, 1, 3], [BIA]: [3, 3, 3] }, { [CAIO]: ['em_branco'], [BIA]: ['fora_do_historico', 'padrao_de_erro'] })))).not.toBe(marca)
    expect(marcaDoApresentado(loteApresentado(dados({ [CAIO]: [null, null, null], [ANA]: [0, 1, 2], [BIA]: [3, 3, 3] }, { [CAIO]: ['em_branco'] })))).not.toBe(marca)
    expect(marcaDoApresentado(loteApresentado(dados({ [CAIO]: [null, null, null], [ANA]: [0, 1, 2], [BIA]: [3, 3, 3] }, { [CAIO]: ['em_branco'], [BIA]: ['fora_do_historico', 'padrao_de_erro'] }, 6)))).not.toBe(marca)
  })

  it('abrir um destaque não muda a marca: o que foi apresentado é o mesmo', () => {
    const aberto: DadosDoLote = { ...lote, correcoes: lote.correcoes.map((correcao) => ({ ...correcao, destaqueAbertoEm: new Date('2026-10-04T10:00:00Z') })) }
    expect(marcaDoApresentado(loteApresentado(aberto))).toBe(marcaDoApresentado(loteApresentado(lote)))
  })
})

describe('a marca de que a coluna "Saiu da aba" foi mostrada (D70, D88)', () => {
  const lote = dados({ [ANA]: [0, 1, 2], [BIA]: [3, 3, 3] })

  it('no lote da avaliativa o apresentado leva `saidaDaAbaMostrada: true`, e nenhuma contagem; sem ela, o campo não existe', () => {
    const comColuna = loteApresentado({ ...lote, saidaDaAbaMostrada: true })
    expect(loteApresentadoSchema.parse(comColuna).saidaDaAbaMostrada).toBe(true)
    expect(JSON.stringify(comColuna)).not.toMatch(/saidas/i)
    for (const semColuna of [loteApresentado(lote), loteApresentado({ ...lote, saidaDaAbaMostrada: false })]) {
      expect(Object.keys(semColuna).sort()).toEqual(['destaques', 'resumo'])
    }
    // A marca entra na do que foi apresentado: a leitura de quem não viu a coluna não vale para a aprovação de quem a viu.
    expect(marcaDoApresentado(comColuna)).not.toBe(marcaDoApresentado(loteApresentado(lote)))
  })
})
