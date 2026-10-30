import { describe, expect, it } from 'vitest'
import {
  alertaDoAnalistaSchema,
  analistaNominalQuerySchema,
  conteudoDoResumoDoAnalistaSchema,
  recorteDoAnalistaSchema,
  analistaNominalResponseSchema,
  resumoDoAnalistaResponseSchema,
  FINALIDADES_DA_LEITURA_NOMINAL,
  GRUPO_MINIMO_DE_PROFESSORES,
  HIPOTESES_DO_ANALISTA,
  TEXTO_DA_HIPOTESE,
} from './analista.js'
import {
  consumoQuerySchema,
  resumoDaGovernancaQuerySchema,
  itemDaGovernancaSchema,
  suspenderFuncaoRequestSchema,
  consumoResponseSchema,
  funcoesDaGovernancaResponseSchema,
  resumoDaGovernancaResponseSchema,
} from './governanca.js'
import { CHAVES_DE_FUNCAO, FUNCOES } from '../time/funcoes.js'
import { chaveDeFuncaoSchema, timeResponseSchema, montarTime } from '../time/time.js'

// Valores fixos e sintéticos: o pacote não tem os tipos do Node.
const UM_ID = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b'
const OUTRO_ID = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c'
const AGORA = '2026-10-04T13:00:00.000Z'
const serie = { id: UM_ID, etapa: 'em', ano: 2 }
const disciplina = { id: OUTRO_ID, nome: 'Química' }
const habilidade = { codigo: 'QUI.EM.05', descricao: 'Identificar o reagente limitante e o reagente em excesso.' }

/** Os jeitos de um campo de professor entrar numa resposta agregada. Todos precisam ser recusados (D45, D64). */
const CAMPOS_DE_PROFESSOR = [
  { professorId: UM_ID },
  { professor: { id: UM_ID, nome: 'Camila Duarte' } },
  { nomeDoProfessor: 'Camila Duarte' },
  { decididaPor: { id: UM_ID, nome: 'Camila Duarte' } },
  { aprovadoPor: 'Camila Duarte · 14h10' },
  { porProfessor: [{ professorId: UM_ID, total: 12 }] },
  { ranking: [UM_ID] },
] as const

describe('governança da coordenação: agregada, sem professor (D45, D64; regra 70, itens 8 e 9)', () => {
  const item = { id: UM_ID, funcao: 'correcao_de_objetiva', tipo: 'lote_de_correcao', estado: 'aprovada', serie, criadaEm: AGORA, decididaEm: AGORA }
  const resumo = { numeros: { geradoPorIa: 41, aprovadoPorPessoa: 30, rejeitado: 2, esperando: 9 }, itens: [item] }

  it('o resumo diz o que a IA gerou e se uma pessoa decidiu, e quando', () => {
    expect(resumoDaGovernancaResponseSchema.parse(resumo)).toEqual(resumo)
  })

  it.each(CAMPOS_DE_PROFESSOR)('o resumo com campo de professor é recusado, no item e na resposta: %o', (campo) => {
    expect(itemDaGovernancaSchema.safeParse({ ...item, ...campo }).success).toBe(false)
    expect(resumoDaGovernancaResponseSchema.safeParse({ ...resumo, itens: [{ ...item, ...campo }] }).success).toBe(false)
    expect(resumoDaGovernancaResponseSchema.safeParse({ ...resumo, ...campo }).success).toBe(false)
    expect(resumoDaGovernancaResponseSchema.safeParse({ ...resumo, numeros: { ...resumo.numeros, ...campo } }).success).toBe(false)
  })

  it('o item não leva a turma, que numa disciplina aponta um professor só, nem a justificativa da rejeição', () => {
    for (const campo of [{ turmaId: UM_ID }, { turma: '2ºB' }, { justificativa: 'O enunciado mudou o que é cobrado' }, { titulo: 'Lista do 2ºB' }]) {
      expect(itemDaGovernancaSchema.safeParse({ ...item, ...campo }).success, Object.keys(campo)[0]).toBe(false)
    }
  })

  it('a consulta não tem filtro nem ordenação por professor, por turma ou por pessoa', () => {
    expect(resumoDaGovernancaQuerySchema.safeParse({ estado: 'pendente' }).success).toBe(true)
    for (const campo of [{ professorId: UM_ID }, { ordenarPor: 'professor' }, { ordem: 'professor' }, { turmaId: UM_ID }, { usuarioId: UM_ID }, { agruparPor: 'professor' }]) {
      expect(resumoDaGovernancaQuerySchema.safeParse(campo).success, Object.keys(campo)[0]).toBe(false)
    }
  })

  it('o consumo é por função, com o pacote do Tutor; não existe consumo por professor nem por aluno', () => {
    const somado = { chamadas: 120, tokensDeEntrada: 48000, tokensDeSaida: 21000, custoMicros: 0, comEnvioExterno: 0 }
    const consumo = { mes: '2026-10', total: somado, porFuncao: [{ ...somado, funcao: 'tutor_com_o_aluno' }], tutor: { trocasNoMes: 412, pacoteDoMes: 9600, trocasPorDiaPorAluno: 60, trocasPorMesPorAluno: 300 } }
    expect(consumoResponseSchema.safeParse(consumo).success).toBe(true)
    for (const campo of [...CAMPOS_DE_PROFESSOR, { porAluno: [{ alunoId: UM_ID, trocas: 60 }] }, { porUsuario: [] }]) {
      expect(consumoResponseSchema.safeParse({ ...consumo, ...campo }).success, Object.keys(campo)[0]).toBe(false)
      expect(consumoResponseSchema.safeParse({ ...consumo, porFuncao: [{ ...somado, funcao: 'tutor_com_o_aluno', ...campo }] }).success, Object.keys(campo)[0]).toBe(false)
    }
    expect(consumoQuerySchema.safeParse({ mes: '2026-10' }).success).toBe(true)
    for (const consulta of [{ mes: '2026-13' }, { mes: 'outubro' }, { professorId: UM_ID }, { alunoId: UM_ID }]) expect(consumoQuerySchema.safeParse(consulta).success, JSON.stringify(consulta)).toBe(false)
  })
})

describe('o que cada função faz sozinha, e a suspensão por função (D9, D60)', () => {
  it('o que a coordenação lê sobre cada função está em português comum: sem código de decisão, de regra nem de fase', () => {
    for (const chave of CHAVES_DE_FUNCAO) {
      for (const texto of [FUNCOES[chave].nome, FUNCOES[chave].fazSozinha, FUNCOES[chave].esperaAprovacao]) {
        expect(texto, chave).not.toMatch(/\bD\d{1,3}\b|\bregra \d|\bRF\d|\bF\d{1,2}\b|\bA[0-5]\b|\bAIA\b/)
      }
    }
    // O aviso de atenção humana está dito a quem decide a compra, com o que o professor não recebe.
    expect(FUNCOES.sinais_para_o_professor.fazSozinha).toMatch(/assunto pessoal delicado/)
    expect(FUNCOES.sinais_para_o_professor.fazSozinha).toMatch(/não recebe o que o aluno escreveu/)
    // E que o Tutor não é aprovado resposta por resposta, mas é acompanhado pelo professor.
    expect(FUNCOES.tutor_com_o_aluno.esperaAprovacao).toMatch(/professor da turma acompanha/)
  })

  it('o time sai do catálogo: três agentes, as seis funções, e só a função suspensa aparece suspensa', () => {
    const time = montarTime(new Set(['correcao_de_objetiva'] as const))
    expect(timeResponseSchema.safeParse(time).success).toBe(true)
    const funcoes = time.agentes.flatMap((agente) => agente.funcoes)
    expect(funcoes.map((funcao) => funcao.chave).sort()).toEqual([...CHAVES_DE_FUNCAO].sort())
    expect(funcoes.filter((funcao) => funcao.suspensa).map((funcao) => funcao.chave)).toEqual(['correcao_de_objetiva'])
    // Suspender a correção não suspende a conversa do mesmo agente.
    const assistente = time.agentes.find((agente) => agente.agente === 'assistente_de_ensino')
    expect(assistente?.funcoes.map((funcao) => [funcao.chave, funcao.suspensa])).toEqual([
      ['conversa_e_ferramentas', false],
      ['correcao_de_objetiva', true],
      ['adaptacao', false],
    ])
    for (const funcao of funcoes) {
      expect(funcao.fazSozinha, funcao.chave).toBe(FUNCOES[funcao.chave].fazSozinha)
      expect(funcao.autonomia, funcao.chave).toBe(FUNCOES[funcao.chave].autonomia)
    }
    expect(montarTime(new Set()).agentes.flatMap((agente) => agente.funcoes).some((funcao) => funcao.suspensa)).toBe(false)
  })

  it('a função da rota é uma chave do catálogo, e o motivo da suspensão é de lista fechada, nunca texto', () => {
    for (const chave of CHAVES_DE_FUNCAO) expect(chaveDeFuncaoSchema.safeParse(chave).success, chave).toBe(true)
    for (const chave of ['corretor', 'tutor', 'toString', '']) expect(chaveDeFuncaoSchema.safeParse(chave).success, chave).toBe(false)
    expect(suspenderFuncaoRequestSchema.parse({})).toEqual({})
    expect(suspenderFuncaoRequestSchema.safeParse({ motivo: 'incidente' }).success).toBe(true)
    expect(suspenderFuncaoRequestSchema.safeParse({ motivo: 'a professora Ana reclamou da correção do João' }).success).toBe(false)
    expect(suspenderFuncaoRequestSchema.safeParse({ observacao: 'texto livre' }).success).toBe(false)
  })

  it('as funções da governança mostram a suspensão vigente sem dizer quem suspendeu', () => {
    const base = montarTime(new Set(['adaptacao'] as const))
    const agentes = base.agentes.map((agente) => ({ ...agente, funcoes: agente.funcoes.map((funcao) => ({ ...funcao, suspensao: funcao.suspensa ? { suspensaEm: AGORA, motivo: null } : null })) }))
    expect(funcoesDaGovernancaResponseSchema.safeParse({ agentes }).success).toBe(true)
    const comAutor = agentes.map((agente) => ({ ...agente, funcoes: agente.funcoes.map((funcao) => ({ ...funcao, suspensao: { suspensaEm: AGORA, motivo: null, suspensaPor: { id: UM_ID, nome: 'Renata' } } })) }))
    expect(funcoesDaGovernancaResponseSchema.safeParse({ agentes: comAutor }).success).toBe(false)
  })
})

describe('resumo do Analista: agregado com grupo mínimo, sem pessoa e sem texto livre (D45, D57)', () => {
  const recorte = { serie, disciplina, professores: 2, alunos: 61, lotesAprovados: 3, acertoPercentual: 58.5, porHabilidade: [{ habilidade, acertos: 70, total: 122 }] }
  const alerta = { tipo: 'habilidade_com_acerto_baixo', serie, disciplina, habilidade, valor: 39, referencia: 60, hipoteses: ['conteudo_recente'] }
  const conteudo = {
    periodo: { inicio: '2026-09-28', fim: '2026-10-04' },
    escola: { atividadesAplicadas: 6, lotesAprovados: 4, lotesEsperando: 2, versoesAdaptadasAprovadas: 1, trocasComOTutor: 412, sinais: { travou: 14, resposta_pronta: 5, duvida_repetida: 3, atencao_humana: 1 } },
    recortes: [recorte],
    recortesNominais: [{ serie, disciplina: { id: UM_ID, nome: 'Física' } }],
    alertas: [alerta],
  }

  it('o conteúdo estruturado passa, e é o que a resposta devolve', () => {
    expect(conteudoDoResumoDoAnalistaSchema.parse(conteudo)).toEqual(conteudo)
    expect(resumoDoAnalistaResponseSchema.safeParse({ resumo: { id: UM_ID, geradoEm: AGORA, conteudo } }).success).toBe(true)
    expect(resumoDoAnalistaResponseSchema.safeParse({ resumo: null }).success).toBe(true)
  })

  it('o recorte com um professor só não entra com número: o grupo mínimo é dois', () => {
    expect(GRUPO_MINIMO_DE_PROFESSORES).toBe(2)
    expect(recorteDoAnalistaSchema.safeParse(recorte).success).toBe(true)
    for (const professores of [0, 1]) {
      expect(recorteDoAnalistaSchema.safeParse({ ...recorte, professores }).success, String(professores)).toBe(false)
      expect(conteudoDoResumoDoAnalistaSchema.safeParse({ ...conteudo, recortes: [{ ...recorte, professores }] }).success, String(professores)).toBe(false)
    }
    // O que ficou de fora aparece só como recorte nominal, sem número nenhum.
    expect(conteudoDoResumoDoAnalistaSchema.safeParse({ ...conteudo, recortesNominais: [{ serie, disciplina, acertoPercentual: 41 }] }).success).toBe(false)
    expect(conteudoDoResumoDoAnalistaSchema.safeParse({ ...conteudo, recortesNominais: [{ serie, disciplina, professores: 1 }] }).success).toBe(false)
  })

  it.each(CAMPOS_DE_PROFESSOR)('o resumo com campo de professor é recusado no recorte, no alerta e no conteúdo: %o', (campo) => {
    expect(recorteDoAnalistaSchema.safeParse({ ...recorte, ...campo }).success).toBe(false)
    expect(alertaDoAnalistaSchema.safeParse({ ...alerta, ...campo }).success).toBe(false)
    expect(conteudoDoResumoDoAnalistaSchema.safeParse({ ...conteudo, ...campo }).success).toBe(false)
    expect(conteudoDoResumoDoAnalistaSchema.safeParse({ ...conteudo, escola: { ...conteudo.escola, ...campo } }).success).toBe(false)
  })

  it('não há nome de aluno, turma nem texto livre: o alerta é tipo, número e hipótese de lista fechada', () => {
    for (const [caso, errado] of [
      ['aluno no recorte', { ...conteudo, recortes: [{ ...recorte, alunosEmRisco: [{ id: UM_ID, nome: 'Heitor Alves' }] }] }],
      ['turma no recorte', { ...conteudo, recortes: [{ ...recorte, turmaId: UM_ID }] }],
      ['texto do modelo no conteúdo', { ...conteudo, texto: 'A professora de Química do 2ºB precisa rever o capítulo 7.' }],
      ['parágrafos de prosa', { ...conteudo, paragrafos: ['O 2ºB foi mal.'] }],
      ['texto no alerta', { ...conteudo, alertas: [{ ...alerta, texto: 'Heitor e Ana estão em risco.' }] }],
      ['hipótese escrita pelo modelo', { ...conteudo, alertas: [{ ...alerta, hipoteses: ['a professora faltou muito'] }] }],
      ['alerta sem hipótese', { ...conteudo, alertas: [{ ...alerta, hipoteses: [] }] }],
      ['tipo de alerta sobre pessoa', { ...conteudo, alertas: [{ ...alerta, tipo: 'professor_com_turma_fraca' }] }],
    ] as const) {
      expect(conteudoDoResumoDoAnalistaSchema.safeParse(errado).success, caso).toBe(false)
    }
    // Toda hipótese fala do conteúdo e do material, e nenhuma de uma pessoa.
    for (const hipotese of HIPOTESES_DO_ANALISTA) expect(TEXTO_DA_HIPOTESE[hipotese], hipotese).not.toMatch(/professor|aluno|coordena/i)
  })

  it('o nominal é rota própria: turma e finalidade obrigatórias, finalidade de lista fechada e nenhuma de avaliar o professor', () => {
    expect(analistaNominalQuerySchema.safeParse({ turmaId: UM_ID, finalidade: 'apoio_a_aluno_em_risco' }).success).toBe(true)
    expect(analistaNominalQuerySchema.safeParse({ turmaId: UM_ID }).success).toBe(false)
    expect(analistaNominalQuerySchema.safeParse({ finalidade: 'apoio_a_aluno_em_risco' }).success).toBe(false)
    expect(analistaNominalQuerySchema.safeParse({ turmaId: UM_ID, finalidade: 'avaliar o desempenho da professora' }).success).toBe(false)
    expect(analistaNominalQuerySchema.safeParse({ turmaId: UM_ID, finalidade: 'pedido_do_titular', professorId: UM_ID }).success).toBe(false)
    for (const finalidade of FINALIDADES_DA_LEITURA_NOMINAL) expect(finalidade).not.toMatch(/avalia|cobranca|sancao|dispensa|ranking|desempenho_do_professor/)
  })

  it('o nominal nomeia os professores da turma, sem aluno, sem ordenação e sem comparação entre professores', () => {
    const nominal = {
      turma: { id: UM_ID, nome: '2ºB', serie },
      professores: [{ id: OUTRO_ID, nome: 'Camila Duarte', disciplina }],
      lotesAprovados: 2,
      porHabilidade: [{ habilidade, acertos: 30, total: 64 }],
      sinais: { travou: 8, resposta_pronta: 2, duvida_repetida: 1 },
    }
    expect(analistaNominalResponseSchema.safeParse(nominal).success).toBe(true)
    // A contagem de atenção humana por turma aponta poucos alunos: só existe somada na escola inteira (D36).
    expect(analistaNominalResponseSchema.safeParse({ ...nominal, sinais: { ...nominal.sinais, atencao_humana: 1 } }).success).toBe(false)
    // Entregas por turma ao lado do professor nomeado seriam medição de adoção nominal (D64).
    for (const campo of [{ entregas: { pendentes: 1, aprovadas: 2, rejeitadas: 0 } }, { artefatosGerados: 14 }, { usoDoAssistente: 31 }]) {
      expect(analistaNominalResponseSchema.safeParse({ ...nominal, ...campo }).success, Object.keys(campo)[0]).toBe(false)
    }
    for (const campo of [{ alunos: [{ id: UM_ID, nome: 'Ana' }] }, { posicaoDoProfessor: 3 }, { mediaDosOutrosProfessores: 71 }, { recomendacao: 'conversar com a professora' }]) {
      expect(analistaNominalResponseSchema.safeParse({ ...nominal, ...campo }).success, Object.keys(campo)[0]).toBe(false)
    }
    expect(analistaNominalResponseSchema.safeParse({ ...nominal, professores: [{ ...nominal.professores[0], usoDaIa: 42 }] }).success).toBe(false)
  })
})
