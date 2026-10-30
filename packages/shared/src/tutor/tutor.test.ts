import { describe, expect, it } from 'vitest'
import { sinaisQuerySchema, grupoDeSinaisSchema, sinaisResponseSchema, sinalSchema, TIPOS_DE_SINAL } from './sinal.js'
import { usoDoTutorQuerySchema, usoDoTutorResponseSchema, usoDoAlunoSchema } from './uso.js'
import {
  conversaDoTutorQuerySchema,
  mensagemDoTutorSchema,
  mensagemAoTutorRequestSchema,
  conversaDoTutorResponseSchema,
  memoriaDoTutorResponseSchema,
  ESTADOS_DO_TUTOR,
  TROCAS_POR_DIA_PADRAO_DO_TUTOR,
  TROCAS_POR_MES_PADRAO_DO_TUTOR,
} from './tutor.js'

// Valores fixos e sintéticos: o pacote não tem os tipos do Node.
const UM_ID = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b'
const OUTRO_ID = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c'
const CHAVE = '4f1c2d3e-5a6b-4c7d-8e9f-0a1b2c3d4e5f'
const AGORA = '2026-10-04T13:00:00.000Z'
const aluno = { id: UM_ID, nome: 'Ana Beatriz' }

describe('sinal do Tutor: tipo fechado e referência ao trabalho (D34, D36, D57)', () => {
  const travou = { id: UM_ID, tipo: 'travou', aluno, atividadeAplicadaId: OUTRO_ID, questao: 3, materialId: null, pagina: null, criadoEm: AGORA }
  const atencao = { id: UM_ID, tipo: 'atencao_humana', aluno, criadoEm: AGORA }

  it('os sinais de trabalho carregam onde aconteceu, e o tipo é da lista fechada', () => {
    expect(TIPOS_DE_SINAL).toEqual(['travou', 'resposta_pronta', 'duvida_repetida', 'atencao_humana'])
    expect(sinalSchema.parse(travou)).toEqual(travou)
    for (const tipo of ['resposta_pronta', 'duvida_repetida']) expect(sinalSchema.safeParse({ ...travou, tipo }).success, tipo).toBe(true)
    for (const tipo of ['desatento', 'triste', 'fora_de_escopo', 'ocioso']) expect(sinalSchema.safeParse({ ...travou, tipo }).success, tipo).toBe(false)
  })

  it('`atencao_humana` com qualquer conteúdo é recusado: nem a conversa, nem o assunto, nem onde foi', () => {
    expect(sinalSchema.parse(atencao)).toEqual(atencao)
    for (const [caso, campo] of [
      ['o que o aluno escreveu', { conteudo: 'meus pais estão brigando muito' }],
      ['um trecho', { trecho: 'não aguento mais' }],
      ['o assunto', { assunto: 'família' }],
      ['um resumo', { resumo: 'aluno relatou problema em casa' }],
      ['a mensagem', { mensagemId: OUTRO_ID }],
      ['a execução', { execucaoId: OUTRO_ID }],
      ['a atividade', { atividadeAplicadaId: OUTRO_ID }],
      ['a questão', { questao: 3 }],
      ['a página', { materialId: OUTRO_ID, pagina: 12 }],
      ['a referência vazia dos outros sinais', { atividadeAplicadaId: null, questao: null, materialId: null, pagina: null }],
      ['um nível de risco', { risco: 'alto' }],
    ] as const) {
      expect(sinalSchema.safeParse({ ...atencao, ...campo }).success, caso).toBe(false)
    }
  })

  it('nenhum sinal aceita texto sobre o aluno, e o agrupado nunca soma `atencao_humana`', () => {
    for (const campo of [{ detalhe: 'parecia ansiosa' }, { texto: 'pediu a resposta três vezes' }, { humor: 'irritado' }, { duvida: 'como acho o mol?' }]) {
      expect(sinalSchema.safeParse({ ...travou, ...campo }).success, Object.keys(campo)[0]).toBe(false)
    }
    const grupo = { tipo: 'travou', atividadeAplicadaId: OUTRO_ID, questao: 3, alunos: 8 }
    expect(grupoDeSinaisSchema.safeParse(grupo).success).toBe(true)
    expect(grupoDeSinaisSchema.safeParse({ ...grupo, tipo: 'atencao_humana' }).success).toBe(false)
    expect(grupoDeSinaisSchema.safeParse({ ...grupo, nomes: ['Ana'] }).success).toBe(false)
    expect(sinaisResponseSchema.safeParse({ itens: [travou, atencao], grupos: [grupo] }).success).toBe(true)
  })

  it('a consulta exige a turma, e não aceita aluno nem escola', () => {
    expect(sinaisQuerySchema.safeParse({ turmaId: UM_ID }).success).toBe(true)
    expect(sinaisQuerySchema.safeParse({}).success).toBe(false)
    for (const campo of ['alunoId', 'escolaId']) expect(sinaisQuerySchema.safeParse({ turmaId: UM_ID, [campo]: UM_ID }).success, campo).toBe(false)
  })
})

describe('conversa com o Tutor (D36, D38, D47)', () => {
  it('a mensagem leva o texto, a atividade ou o material e a chave; aluno, turma e escola vêm da sessão', () => {
    const corpo = { texto: 'Como acho o reagente limitante?', atividadeAplicadaId: UM_ID, chaveEnvio: CHAVE }
    expect(mensagemAoTutorRequestSchema.parse(corpo)).toEqual(corpo)
    expect(mensagemAoTutorRequestSchema.safeParse({ texto: 'Dúvida do capítulo 7', materialId: UM_ID, chaveEnvio: CHAVE }).success).toBe(true)
    for (const campo of ['alunoId', 'turmaId', 'escolaId']) expect(mensagemAoTutorRequestSchema.safeParse({ ...corpo, [campo]: UM_ID }).success, campo).toBe(false)
    expect(mensagemAoTutorRequestSchema.safeParse({ ...corpo, texto: '   ' }).success).toBe(false)
    expect(mensagemAoTutorRequestSchema.safeParse({ texto: 'sem chave' }).success).toBe(false)
  })

  it('a questão só vai com a atividade aplicada, e a página, com o material: é a referência que o professor vê no uso', () => {
    const base = { texto: 'Como acho o reagente limitante?', chaveEnvio: CHAVE }
    expect(mensagemAoTutorRequestSchema.safeParse({ ...base, atividadeAplicadaId: UM_ID, questao: 3 }).success).toBe(true)
    expect(mensagemAoTutorRequestSchema.safeParse({ ...base, materialId: UM_ID, pagina: 151 }).success).toBe(true)
    expect(mensagemAoTutorRequestSchema.safeParse({ ...base, questao: 3 }).success).toBe(false)
    expect(mensagemAoTutorRequestSchema.safeParse({ ...base, pagina: 151 }).success).toBe(false)
    expect(mensagemAoTutorRequestSchema.safeParse({ ...base, materialId: UM_ID, questao: 3 }).success).toBe(false)
    for (const questao of [0, 21, 1.5]) expect(mensagemAoTutorRequestSchema.safeParse({ ...base, atividadeAplicadaId: UM_ID, questao }).success, String(questao)).toBe(false)
  })

  it('o Tutor responde texto com página citada ou a mensagem fixa de assunto delicado; o aluno só escreve texto', () => {
    const citacao = { materialId: UM_ID, pagina: 151, trecho: 'O reagente limitante é o que acaba primeiro.' }
    expect(mensagemDoTutorSchema.safeParse({ id: UM_ID, autor: 'tutor', tipo: 'texto', texto: 'O que a equação diz?', citacoes: [citacao], criadaEm: AGORA }).success).toBe(true)
    expect(mensagemDoTutorSchema.safeParse({ id: UM_ID, autor: 'tutor', tipo: 'assunto_delicado', texto: 'Mensagem combinada com a sua escola.', criadaEm: AGORA }).success).toBe(true)
    expect(mensagemDoTutorSchema.safeParse({ id: UM_ID, autor: 'aluno', tipo: 'texto', texto: 'Qual é a resposta?', criadaEm: AGORA }).success).toBe(true)
    expect(mensagemDoTutorSchema.safeParse({ id: UM_ID, autor: 'aluno', tipo: 'assunto_delicado', texto: 'x', criadaEm: AGORA }).success).toBe(false)
    // O Tutor não devolve a resposta da questão nem dado de colega como campo.
    for (const campo of [{ gabarito: 0 }, { respostaCerta: 'H2' }, { colegas: ['Bruno'] }]) {
      expect(mensagemDoTutorSchema.safeParse({ id: UM_ID, autor: 'tutor', tipo: 'texto', texto: 'Vamos por partes.', citacoes: [], criadaEm: AGORA, ...campo }).success, Object.keys(campo)[0]).toBe(false)
    }
  })

  it('a conversa diz o estado, o freio do dia e a avaliação que trava, e a consulta não aceita outro aluno', () => {
    expect(ESTADOS_DO_TUTOR).toEqual(['ligado', 'avaliacao', 'fora', 'limite'])
    const conversa = { estado: 'avaliacao', uso: { hoje: 12, limiteDoDia: TROCAS_POR_DIA_PADRAO_DO_TUTOR }, avaliacaoAberta: { titulo: 'Prova de estequiometria' }, mensagens: [] }
    expect(conversaDoTutorResponseSchema.safeParse(conversa).success).toBe(true)
    expect(conversaDoTutorResponseSchema.safeParse({ ...conversa, uso: { hoje: 12, limiteDoDia: 0 } }).success).toBe(false)
    expect(conversaDoTutorResponseSchema.safeParse({ ...conversa, usoDaTurma: 420 }).success).toBe(false)
    expect(conversaDoTutorQuerySchema.safeParse({ atividadeAplicadaId: UM_ID }).success).toBe(true)
    expect(conversaDoTutorQuerySchema.safeParse({ alunoId: OUTRO_ID }).success).toBe(false)
    // O padrão da D38, para a coluna nula da configuração da escola.
    expect([TROCAS_POR_DIA_PADRAO_DO_TUTOR, TROCAS_POR_MES_PADRAO_DO_TUTOR]).toEqual([60, 300])
  })
})

describe('memória do Tutor (D66): o trabalho do aluno, nunca a pessoa', () => {
  const habilidade = { codigo: 'QUI.EM.05', descricao: 'Identificar o reagente limitante e o reagente em excesso.' }
  const trabalho = { atividadeAplicadaId: UM_ID, titulo: 'Lista de estequiometria', enviadaEm: AGORA, resultado: { acertos: 5, total: 8, aReforcar: [habilidade] } }
  const sinal = { tipo: 'travou', atividadeAplicadaId: UM_ID, questao: 3, criadoEm: AGORA }

  it('lista trabalhos e sinais de trabalho; o resultado é nulo enquanto o lote não foi aprovado', () => {
    expect(memoriaDoTutorResponseSchema.safeParse({ trabalhos: [trabalho, { ...trabalho, resultado: null }], sinais: [sinal] }).success).toBe(true)
    // `atencao_humana` não é memória de trabalho, e não aparece para o aluno como coisa que o Tutor "sabe" dele.
    expect(memoriaDoTutorResponseSchema.safeParse({ trabalhos: [], sinais: [{ ...sinal, tipo: 'atencao_humana' }] }).success).toBe(false)
  })

  it('não tem onde escrever o jeito, o humor, a atenção ou o comportamento do aluno', () => {
    for (const campo of [{ perfil: 'aluno ansioso, desiste rápido' }, { observacoes: ['pouco atento'] }, { humor: 'frustrado' }, { resumoDoAluno: 'tem dificuldade de concentração' }, { adaptacao: 'fonte ampliada' }]) {
      expect(memoriaDoTutorResponseSchema.safeParse({ trabalhos: [trabalho], sinais: [sinal], ...campo }).success, Object.keys(campo)[0]).toBe(false)
    }
    expect(memoriaDoTutorResponseSchema.safeParse({ trabalhos: [{ ...trabalho, comoTerminou: 'saiu irritado' }], sinais: [] }).success).toBe(false)
    expect(memoriaDoTutorResponseSchema.safeParse({ trabalhos: [], sinais: [{ ...sinal, detalhe: 'chorou' }] }).success).toBe(false)
  })
})

describe('uso do Tutor por turma: nenhum uso é invisível ao professor, e supervisão não é vigilância (regra 70, itens 4 e 7; D47)', () => {
  const referencia = { atividadeAplicadaId: OUTRO_ID, questao: 3, materialId: null, pagina: null }
  const uso = { aluno, trocasHoje: 12, ultimaTrocaEm: AGORA, ultimaReferencia: referencia }
  const resposta = { turmaId: UM_ID, limiteDoDia: 60, trocasDaTurmaNoMes: 412, pacoteDaTurmaNoMes: 9600, alunos: [uso] }

  it('por aluno: as trocas do dia, a hora da última e em que ele estava; o aluno sem sinal nenhum aparece do mesmo jeito', () => {
    expect(usoDoTutorResponseSchema.parse(resposta)).toEqual(resposta)
    // Quem só fez perguntas comuns, fora de atividade e de material, e não trocou hoje: continua visível.
    const semSinal = { aluno: { id: OUTRO_ID, nome: 'Bruno Tavares' }, trocasHoje: 0, ultimaTrocaEm: AGORA, ultimaReferencia: { atividadeAplicadaId: null, questao: null, materialId: null, pagina: null } }
    expect(usoDoTutorResponseSchema.safeParse({ ...resposta, alunos: [uso, semSinal] }).success).toBe(true)
    expect(usoDoAlunoSchema.safeParse({ ...uso, ultimaReferencia: { atividadeAplicadaId: null, questao: null, materialId: OUTRO_ID, pagina: 151 } }).success).toBe(true)
    // Sem a hora da última troca ou sem as trocas do dia, o uso não está dito.
    for (const campo of ['trocasHoje', 'ultimaTrocaEm', 'ultimaReferencia'] as const) {
      const { [campo]: _fora, ...semCampo } = uso
      expect(usoDoAlunoSchema.safeParse(semCampo).success, campo).toBe(false)
    }
  })

  it('sem conteúdo de conversa: pergunta, resposta, trecho, assunto e resumo são recusados', () => {
    for (const campo of [
      { ultimaPergunta: 'não entendi nada da questão 3' },
      { ultimaResposta: 'O que a equação diz?' },
      { texto: 'meus pais brigaram' },
      { trecho: 'não entendi' },
      { assunto: 'reagente limitante' },
      { resumo: 'pediu a resposta duas vezes' },
      { mensagens: [] },
      { mensagemId: OUTRO_ID },
      { execucaoId: OUTRO_ID },
    ]) {
      expect(usoDoAlunoSchema.safeParse({ ...uso, ...campo }).success, Object.keys(campo)[0]).toBe(false)
    }
    expect(usoDoAlunoSchema.safeParse({ ...uso, ultimaReferencia: { ...referencia, pergunta: 'qual é a resposta?' } }).success).toBe(false)
  })

  it('sem tempo ocioso, sem histórico de navegação e sem leitura sobre o aluno', () => {
    for (const campo of [
      { tempoOciosoSegundos: 540 },
      { tempoDeSessaoMinutos: 22 },
      { tempoEntreTrocas: 90 },
      { online: true },
      { historico: [referencia] },
      { referencias: [referencia] },
      { paginasAbertas: [150, 151] },
      { saidasDaAba: 3 },
      { engajamento: 'baixo' },
      { atencao: 'dispersa' },
      { posicao: 1 },
      { sinais: ['atencao_humana'] },
    ]) {
      expect(usoDoAlunoSchema.safeParse({ ...uso, ...campo }).success, Object.keys(campo)[0]).toBe(false)
    }
    for (const campo of [{ quemNaoUsou: [aluno] }, { ranking: [aluno] }, { alunosSemUso: 20 }]) expect(usoDoTutorResponseSchema.safeParse({ ...resposta, ...campo }).success, Object.keys(campo)[0]).toBe(false)
  })

  it('a consulta é só a turma: não aceita aluno, período, ordenação nem escola', () => {
    expect(usoDoTutorQuerySchema.parse({ turmaId: UM_ID })).toEqual({ turmaId: UM_ID })
    expect(usoDoTutorQuerySchema.safeParse({}).success).toBe(false)
    for (const campo of [{ alunoId: OUTRO_ID }, { desde: '2026-09-01' }, { ordenarPor: 'trocas' }, { escolaId: OUTRO_ID }]) expect(usoDoTutorQuerySchema.safeParse({ turmaId: UM_ID, ...campo }).success, Object.keys(campo)[0]).toBe(false)
  })
})
