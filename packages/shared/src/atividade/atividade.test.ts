import { describe, expect, it } from 'vitest'
import type { ConteudoDeAtividade } from '../assistente/conteudo.js'
import { atividadeAplicadaSchema, aplicarAtividadeRequestSchema, emptyBodyRequestSchema, emptyOrMissingBodyRequestSchema, atividadeEncerradaResponseSchema } from './atividade-aplicada.js'
import { diagnosticoGravadoSchema, loteApresentadoSchema, correcaoDoLoteResponseSchema, loteAprovadoResponseSchema, resumoDoLoteSchema, validacaoDoLoteSchema, MOTIVOS_DE_DESTAQUE } from './correcao.js'
import { desempenhoDaTurmaQuerySchema, desempenhoDaTurmaResponseSchema } from './desempenho.js'
import {
  minhaAtividadeSchema,
  numeroDaQuestaoSchema,
  responderQuestaoRequestSchema,
  questaoDaProvaSchema,
  questaoDoCaminhoSchema,
  meuDiagnosticoResponseSchema,
  provaResponseSchema,
  questaoSalvaResponseSchema,
  questoesDaProva,
} from './prova.js'

// Valores fixos e sintéticos: o pacote não tem os tipos do Node.
const UM_ID = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b'
const OUTRO_ID = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c'
const AGORA = '2026-10-04T13:00:00.000Z'

const habilidade = { codigo: 'QUI.EM.05', descricao: 'Identificar o reagente limitante e o reagente em excesso.' }
const citacao = { materialId: UM_ID, pagina: 151, trecho: 'O reagente limitante é o que acaba primeiro.' }
const conteudo: ConteudoDeAtividade = {
  tipo: 'atividade_objetiva',
  titulo: 'Lista de estequiometria',
  questoes: [
    { enunciado: 'Qual é o reagente limitante?', alternativas: ['H2', 'O2', 'H2O', 'Nenhum'], gabarito: 0, habilidade, citacao, explicacao: 'O H2 acaba primeiro.' },
    { enunciado: 'Quantos mols de água se formam?', alternativas: ['1', '2', '3', '4'], gabarito: 1, habilidade, citacao, explicacao: 'A proporção é de 2 para 2.' },
  ],
}
const prova = { atividadeAplicadaId: UM_ID, titulo: 'Lista de estequiometria', avaliativa: false, estado: 'aberta', adaptacao: null, questoes: questoesDaProva(conteudo), respostas: [{ questao: 1, alternativa: 2, sequencia: 3 }], enviadaEm: null }

describe('a prova que o aluno recebe: sem gabarito e sem explicação', () => {
  it('as questões da prova saem do artefato só com número, enunciado e alternativas', () => {
    const questoes = questoesDaProva(conteudo)
    expect(questoes).toEqual([
      { numero: 1, enunciado: 'Qual é o reagente limitante?', alternativas: ['H2', 'O2', 'H2O', 'Nenhum'] },
      { numero: 2, enunciado: 'Quantos mols de água se formam?', alternativas: ['1', '2', '3', '4'] },
    ])
    // Em nenhuma profundidade: nem a chave do gabarito, nem o texto da explicação, nem a habilidade, nem a página.
    const texto = JSON.stringify(questoes)
    for (const proibido of ['gabarito', 'explicacao', 'habilidade', 'citacao', 'O H2 acaba primeiro', 'QUI.EM.05']) expect(texto, proibido).not.toContain(proibido)
    for (const questao of questoes) expect(Object.keys(questao).sort()).toEqual(['alternativas', 'enunciado', 'numero'])
    expect(provaResponseSchema.safeParse(prova).success).toBe(true)
  })

  it('o schema da prova recusa a questão inteira do artefato e qualquer campo que entregue a resposta', () => {
    const [primeira] = conteudo.questoes
    const [daProva] = questoesDaProva(conteudo)
    expect(questaoDaProvaSchema.safeParse({ numero: 1, ...primeira }).success).toBe(false)
    for (const [caso, campo] of [
      ['gabarito', { gabarito: 0 }],
      ['explicação', { explicacao: 'O H2 acaba primeiro.' }],
      ['habilidade', { habilidade }],
      ['citação', { citacao }],
      ['alternativa correta com outro nome', { correta: 0 }],
    ] as const) {
      expect(questaoDaProvaSchema.safeParse({ ...daProva, ...campo }).success, caso).toBe(false)
      expect(provaResponseSchema.safeParse({ ...prova, questoes: [{ ...daProva, ...campo }] }).success, caso).toBe(false)
    }
    // Na prova inteira também não: nem o gabarito em lista, nem o artefato de carona.
    expect(provaResponseSchema.safeParse({ ...prova, gabarito: [0, 1] }).success).toBe(false)
    expect(provaResponseSchema.safeParse({ ...prova, conteudo }).success).toBe(false)
    expect(provaResponseSchema.safeParse({ ...prova, respostas: [{ questao: 1, alternativa: 2, sequencia: 3, correta: false }] }).success).toBe(false)
  })

  it('a prova adaptada leva só os tipos da adaptação, e a lista do aluno não traz acerto nem colega', () => {
    expect(provaResponseSchema.safeParse({ ...prova, adaptacao: { tipos: ['fonte_ampliada', 'tempo_adicional'], tempoExtraPercentual: 50 } }).success).toBe(true)
    expect(provaResponseSchema.safeParse({ ...prova, adaptacao: { tipos: ['fonte_ampliada'], motivo: 'baixa visão' } }).success).toBe(false)
    const minha = { id: UM_ID, titulo: 'Lista', disciplina: { id: OUTRO_ID, nome: 'Química' }, avaliativa: true, situacao: 'enviada', questoes: 8, respondidas: 8, aplicadaEm: AGORA, enviadaEm: AGORA }
    expect(minhaAtividadeSchema.safeParse(minha).success).toBe(true)
    for (const campo of [{ acertos: 6 }, { mediaDaTurma: 5.2 }, { colegas: [UM_ID] }, { nota: 7.5 }]) expect(minhaAtividadeSchema.safeParse({ ...minha, ...campo }).success, Object.keys(campo)[0]).toBe(false)
  })

  it('a resposta é o índice da alternativa, de 0 a 3, numa questão de 1 a 20; o salvo não diz se está certo', () => {
    expect(responderQuestaoRequestSchema.parse({ alternativa: 3 })).toEqual({ alternativa: 3 })
    // A `sequencia` é opcional (cliente antigo), inteira e não negativa; o zero é a escala da linha anterior à coluna.
    expect(responderQuestaoRequestSchema.parse({ alternativa: 3, sequencia: 0 })).toEqual({ alternativa: 3, sequencia: 0 })
    for (const sequencia of [-1, 1.5, '2', null]) expect(responderQuestaoRequestSchema.safeParse({ alternativa: 1, sequencia }).success, String(sequencia)).toBe(false)
    for (const alternativa of [-1, 4, 1.5, 'a', null]) expect(responderQuestaoRequestSchema.safeParse({ alternativa }).success, String(alternativa)).toBe(false)
    expect(responderQuestaoRequestSchema.safeParse({ alternativa: 1, alunoId: UM_ID }).success).toBe(false)
    // O número da questão chega como texto no caminho.
    expect(numeroDaQuestaoSchema.parse('3')).toBe(3)
    for (const numero of ['0', '21', 'tres', '1.5']) expect(numeroDaQuestaoSchema.safeParse(numero).success, numero).toBe(false)
    // No caminho, a questão só tem um ou dois dígitos, de 1 a 20: o `coerce` sozinho aceitaria `0x3`, `+3`, `1e1` e `001`.
    expect(questaoDoCaminhoSchema.parse('3')).toBe(3)
    expect(questaoDoCaminhoSchema.parse('01')).toBe(1)
    expect(questaoDoCaminhoSchema.parse('1')).toBe(1)
    expect(questaoDoCaminhoSchema.parse('20')).toBe(20)
    for (const numero of ['0', '00', '21', '99', '001', '0x3', '+3', '1e1', '-1', '1.5', ' 3', '3 ', 'tres', '']) expect(questaoDoCaminhoSchema.safeParse(numero).success, numero).toBe(false)
    const salva = { questao: 1, alternativa: 2, sequencia: 4, respondidaEm: AGORA }
    expect(questaoSalvaResponseSchema.safeParse(salva).success).toBe(true)
    // O que ficou gravado sempre diz a sua `sequencia`: é com ela que a tela sabe se perdeu.
    expect(questaoSalvaResponseSchema.safeParse({ questao: 1, alternativa: 2, respondidaEm: AGORA }).success).toBe(false)
    expect(provaResponseSchema.safeParse({ ...prova, respostas: [{ questao: 1, alternativa: 2 }] }).success).toBe(false)
    expect(questaoSalvaResponseSchema.safeParse({ ...salva, correta: true }).success).toBe(false)
  })
})

describe('o diagnóstico do aluno (D46): por habilidade, sem nota e sem a turma', () => {
  const diagnostico = {
    atividadeAplicadaId: UM_ID,
    titulo: 'Lista de estequiometria',
    acertos: 1,
    total: 2,
    porHabilidade: [{ habilidade, acertos: 1, total: 2 }],
    questoes: [
      { numero: 1, alternativa: 0, gabarito: 0, correta: true, explicacao: 'O H2 acaba primeiro.', citacao },
      { numero: 2, alternativa: null, gabarito: 1, correta: false, explicacao: 'A proporção é de 2 para 2.', citacao },
    ],
    aprovadoPor: { nome: 'Camila Duarte' },
    aprovadoEm: AGORA,
  }

  it('traz o acerto por habilidade e por questão, com quem aprovou e quando', () => {
    expect(meuDiagnosticoResponseSchema.safeParse(diagnostico).success).toBe(true)
    // Sem a aprovação não há diagnóstico: o schema não tem como representar o lote pendente.
    expect(meuDiagnosticoResponseSchema.safeParse({ ...diagnostico, aprovadoEm: null }).success).toBe(false)
    const { aprovadoEm: _semData, ...semAprovacao } = diagnostico
    expect(meuDiagnosticoResponseSchema.safeParse(semAprovacao).success).toBe(false)
  })

  it('recusa nota, conceito, média da turma, colega e texto sobre o aluno', () => {
    for (const campo of [{ nota: 5 }, { conceito: 'B' }, { mediaDaTurma: 6.4 }, { posicaoNaTurma: 12 }, { colegas: [] }, { observacao: 'distraído nas últimas questões' }, { devolutiva: 'Estude mais.' }]) {
      expect(meuDiagnosticoResponseSchema.safeParse({ ...diagnostico, ...campo }).success, Object.keys(campo)[0]).toBe(false)
    }
    expect(diagnosticoGravadoSchema.safeParse([{ codigo: 'QUI.EM.05', acertos: 1, total: 2 }]).success).toBe(true)
    expect(diagnosticoGravadoSchema.safeParse([{ codigo: 'QUI.EM.05', acertos: 1, total: 2, comentario: 'precisa reforçar' }]).success).toBe(false)
  })
})

describe('aplicar e encerrar', () => {
  it('aplicar pede o artefato, a turma e se é avaliativa; quem aplica vem da sessão, e os corpos vazios são estritos', () => {
    const corpo = { artefatoId: UM_ID, turmaId: OUTRO_ID, avaliativa: true }
    expect(aplicarAtividadeRequestSchema.parse(corpo)).toEqual(corpo)
    for (const campo of [{ aplicadaPor: UM_ID }, { escolaId: UM_ID }, { alunos: [UM_ID] }]) expect(aplicarAtividadeRequestSchema.safeParse({ ...corpo, ...campo }).success, Object.keys(campo)[0]).toBe(false)
    expect(aplicarAtividadeRequestSchema.safeParse({ artefatoId: UM_ID, turmaId: OUTRO_ID }).success).toBe(false)
    expect(emptyBodyRequestSchema.safeParse({}).success).toBe(true)
    expect(emptyBodyRequestSchema.safeParse({ forcar: true }).success).toBe(false)
  })

  it('o corpo que pode faltar vale como vazio, e qualquer campo continua sendo recusado', () => {
    expect(emptyOrMissingBodyRequestSchema.parse(undefined)).toEqual({})
    expect(emptyOrMissingBodyRequestSchema.parse({})).toEqual({})
    expect(emptyOrMissingBodyRequestSchema.safeParse({ forcar: true }).success).toBe(false)
    // O corpo vazio e estrito, sem o `default`, não aceita faltar: é o que `meus-dados` e a privacidade pedem.
    expect(emptyBodyRequestSchema.safeParse(undefined).success).toBe(false)
  })

  it('a atividade aplicada mostra só contagem de participação, e o encerrar devolve a execução da correção, ou nulo com a função suspensa', () => {
    const atividade = { id: UM_ID, artefatoId: OUTRO_ID, turmaId: UM_ID, titulo: 'Lista', avaliativa: false, estado: 'encerrada', questoes: 8, aplicadaEm: AGORA, encerradaEm: AGORA, participacao: { alunos: 32, iniciaram: 30, enviaram: 28 }, entrega: null }
    expect(atividadeAplicadaSchema.safeParse(atividade).success).toBe(true)
    expect(atividadeAplicadaSchema.safeParse({ ...atividade, participacao: { ...atividade.participacao, quemNaoEnviou: ['Ana'] } }).success).toBe(false)
    expect(atividadeEncerradaResponseSchema.safeParse({ atividade, execucaoId: UM_ID }).success).toBe(true)
    expect(atividadeEncerradaResponseSchema.safeParse({ atividade, execucaoId: null }).success).toBe(true)
  })
})

describe('o lote de correção e o registro da validação (D33, D56)', () => {
  const resumo = {
    alunosDaTurma: 32,
    corrigidos: 30,
    questoes: 2,
    mediaDeAcertos: 1.4,
    distribuicao: [{ de: 0, ate: 0, alunos: 3 }, { de: 1, ate: 1, alunos: 12 }, { de: 2, ate: 2, alunos: 15 }],
    porHabilidade: [{ habilidade, acertos: 42, total: 60 }],
    porQuestao: [{ numero: 1, habilidade, gabarito: 0, acertos: 20, porAlternativa: [20, 5, 3, 1], emBranco: 1 }, { numero: 2, habilidade, gabarito: 1, acertos: 22, porAlternativa: [4, 22, 2, 1], emBranco: 1 }],
  }
  const apresentado = { resumo, destaques: [{ alunoId: UM_ID, motivos: ['em_branco'] }] }
  const validacao = { id: UM_ID, apresentado, aberto: [{ alunoId: UM_ID, abertoEm: AGORA }], confirmadaPor: { id: OUTRO_ID, nome: 'Camila Duarte' }, confirmadaEm: AGORA }
  const entrega = { id: UM_ID, tipo: 'lote_de_correcao', funcao: 'correcao_de_objetiva', estado: 'aprovada', turmaId: UM_ID, titulo: 'Lista', artefatoId: null, atividadeAplicadaId: OUTRO_ID, criadaEm: AGORA, decididaEm: AGORA, decididaPor: { id: OUTRO_ID, nome: 'Camila Duarte' }, justificativa: null }

  it('o resumo do lote é só número somado: não aceita nome, nota nem campo de aluno', () => {
    expect(resumoDoLoteSchema.safeParse(resumo).success).toBe(true)
    for (const campo of [{ notaMedia: 6.4 }, { melhorAluno: 'Ana Beatriz' }, { alunos: [{ nome: 'Ana' }] }]) expect(resumoDoLoteSchema.safeParse({ ...resumo, ...campo }).success, Object.keys(campo)[0]).toBe(false)
  })

  it('o que fica gravado como apresentado tem o resumo e os destaques só com id e motivo de lista fechada', () => {
    expect(loteApresentadoSchema.safeParse(apresentado).success).toBe(true)
    expect(MOTIVOS_DE_DESTAQUE).toEqual(['em_branco', 'fora_do_historico', 'padrao_de_erro'])
    for (const [caso, destaque] of [
      ['nome do aluno', { alunoId: UM_ID, motivos: ['em_branco'], nome: 'Ana Beatriz' }],
      ['motivo em texto livre', { alunoId: UM_ID, motivos: ['parece ter colado do colega'] }],
      ['motivo de comportamento', { alunoId: UM_ID, motivos: ['desatento'] }],
      ['sem motivo', { alunoId: UM_ID, motivos: [] }],
      ['observação', { alunoId: UM_ID, motivos: ['em_branco'], observacao: 'faltou muito' }],
    ] as const) {
      expect(loteApresentadoSchema.safeParse({ resumo, destaques: [destaque] }).success, caso).toBe(false)
    }
    const { resumo: _semResumo, ...semResumo } = apresentado
    expect(loteApresentadoSchema.safeParse(semResumo).success).toBe(false)
  })

  it('a validação guarda o apresentado, o aberto, quem confirmou e quando; sem um deles não é validação', () => {
    expect(validacaoDoLoteSchema.safeParse(validacao).success).toBe(true)
    for (const campo of ['apresentado', 'aberto', 'confirmadaPor', 'confirmadaEm'] as const) {
      const { [campo]: _fora, ...semCampo } = validacao
      expect(validacaoDoLoteSchema.safeParse(semCampo).success, campo).toBe(false)
    }
    expect(validacaoDoLoteSchema.safeParse({ ...validacao, aberto: [{ alunoId: UM_ID }] }).success).toBe(false)
    expect(loteAprovadoResponseSchema.safeParse({ entrega, validacao }).success).toBe(true)
    // O lote aprovado sempre volta com a validação: aprovar sem registro não tem resposta possível.
    expect(loteAprovadoResponseSchema.safeParse({ entrega }).success).toBe(false)
    expect(loteAprovadoResponseSchema.safeParse({ entrega, validacao: null }).success).toBe(false)
  })

  it('a correção do lote, para o professor da turma, não tem nota: tem acertos, destaques e o contador', () => {
    const correcao = { alunoId: UM_ID, nome: 'Ana Beatriz', acertos: 0, total: 2, emBranco: 2 }
    const resposta = {
      atividadeAplicadaId: OUTRO_ID,
      titulo: 'Lista',
      entrega: { id: UM_ID, estado: 'pendente' },
      resumo,
      destaques: [{ ...correcao, motivos: ['em_branco'], abertoEm: null }],
      outras: [{ ...correcao, alunoId: OUTRO_ID, nome: 'Bruno Tavares', acertos: 2, emBranco: 0 }],
      destaquesAbertos: 0,
      podeAprovar: false,
      validacao: null,
    }
    expect(correcaoDoLoteResponseSchema.safeParse(resposta).success).toBe(true)
    expect(correcaoDoLoteResponseSchema.safeParse({ ...resposta, outras: [{ ...correcao, nota: 10 }] }).success).toBe(false)
    expect(correcaoDoLoteResponseSchema.safeParse({ ...resposta, destaques: [{ ...correcao, motivos: ['em_branco'], abertoEm: null, comentarioDaIa: 'provável desinteresse' }] }).success).toBe(false)
  })
})

describe('desempenho da turma (D34, D45)', () => {
  it('a finalidade é de lista fechada, e a consulta não aceita filtro por professor nem por aluno', () => {
    expect(desempenhoDaTurmaQuerySchema.safeParse({}).success).toBe(true)
    expect(desempenhoDaTurmaQuerySchema.safeParse({ finalidade: 'acompanhamento_pedagogico' }).success).toBe(true)
    expect(desempenhoDaTurmaQuerySchema.safeParse({ finalidade: 'ver como a professora está indo' }).success).toBe(false)
    for (const campo of ['professorId', 'alunoId', 'ordenarPor']) expect(desempenhoDaTurmaQuerySchema.safeParse({ [campo]: UM_ID }).success, campo).toBe(false)
  })

  it('a resposta é acerto por habilidade, da turma e de cada aluno, sem nota, ranking nem texto sobre o aluno', () => {
    const aluno = { alunoId: UM_ID, nome: 'Ana Beatriz', acertos: 1, total: 2, porHabilidade: [{ habilidade, acertos: 1, total: 2 }] }
    const resposta = { turmaId: OUTRO_ID, lotesAprovados: 1, porHabilidade: [{ habilidade, acertos: 42, total: 60, alunosAbaixoDaMetade: 4 }], alunos: [aluno] }
    expect(desempenhoDaTurmaResponseSchema.safeParse(resposta).success).toBe(true)
    expect(desempenhoDaTurmaResponseSchema.safeParse({ turmaId: OUTRO_ID, lotesAprovados: 0, porHabilidade: [], alunos: [] }).success).toBe(true)
    for (const campo of [{ nota: 5 }, { posicao: 1 }, { perfil: 'desatenta' }, { tempoOcioso: 300 }, { adaptacao: 'fonte ampliada' }]) {
      expect(desempenhoDaTurmaResponseSchema.safeParse({ ...resposta, alunos: [{ ...aluno, ...campo }] }).success, Object.keys(campo)[0]).toBe(false)
    }
    expect(desempenhoDaTurmaResponseSchema.safeParse({ ...resposta, professor: { id: UM_ID, nome: 'Camila' } }).success).toBe(false)
  })
})
