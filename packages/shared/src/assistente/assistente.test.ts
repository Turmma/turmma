import { describe, expect, it } from 'vitest'
import { adaptarArtefatoRequestSchema, gerarComFerramentaRequestSchema, renomearArtefatoRequestSchema, artefatoResponseSchema } from './artefato.js'
import { conteudoDeAtividadeSchema, conteudoDePlanoDeAulaSchema, conteudoDoArtefatoSchema, questaoObjetivaSchema, TIPOS_DE_ADAPTACAO } from './conteudo.js'
import {
  conversaDoAssistenteQuerySchema,
  conteudoDaMensagemDoAgenteSchema,
  mensagemDaConversaSchema,
  mensagemAoAssistenteRequestSchema,
  conversaDoAssistenteResponseSchema,
  FERRAMENTAS_GERADORAS,
  MAXIMO_DE_MENSAGENS_POR_PAGINA,
  RESPOSTAS_A_PROPOSTA,
} from './conversa.js'
import { entregasQuerySchema, entregaSchema, decidirEntregaRequestSchema, TAMANHO_MINIMO_DA_JUSTIFICATIVA } from './entrega.js'
import { CATALOGO_DE_HABILIDADES, HABILIDADE_GERAL, habilidadeDoCatalogo, habilidadesDaDisciplina } from './habilidades.js'

// Valores fixos e sintéticos: o pacote não tem os tipos do Node.
const UM_ID = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b'
const OUTRO_ID = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c'
const CHAVE = '4f1c2d3e-5a6b-4c7d-8e9f-0a1b2c3d4e5f'
const AGORA = '2026-10-04T13:00:00.000Z'

const citacao = { materialId: UM_ID, pagina: 151, trecho: 'O reagente limitante é o que acaba primeiro.' }
const questao = {
  enunciado: 'Qual é o reagente limitante na reação de 2 mol de H2 com 2 mol de O2?',
  alternativas: ['H2', 'O2', 'H2O', 'Nenhum'],
  gabarito: 0,
  habilidade: { codigo: 'QUI.EM.05', descricao: 'Identificar o reagente limitante e o reagente em excesso.' },
  citacao,
  explicacao: 'A proporção é de 2 H2 para 1 O2, então o H2 acaba primeiro.',
}
const atividade = { tipo: 'atividade_objetiva', titulo: 'Lista de estequiometria', questoes: [questao] }
const plano = {
  tipo: 'plano_de_aula',
  titulo: 'Reagente limitante',
  objetivos: ['Identificar o reagente limitante'],
  habilidades: [questao.habilidade],
  duracaoMinutos: 50,
  etapas: [{ titulo: 'Abertura', minutos: 10, descricao: 'Retomar a equação balanceada.' }],
  avaliacao: 'Três questões no fim da aula.',
  citacoes: [citacao],
}

describe('conteúdo do artefato: toda geração cita a página (D6; regra 30, item 12)', () => {
  it('a atividade e o plano com citação passam, e o conteúdo é o que foi escrito', () => {
    expect(conteudoDoArtefatoSchema.parse(atividade)).toEqual(atividade)
    expect(conteudoDoArtefatoSchema.parse(plano)).toEqual(plano)
  })

  it('questão sem citação, com citação sem página ou sem material, e plano sem citação nenhuma são recusados', () => {
    const { citacao: _semCitacao, ...semCitacao } = questao
    expect(questaoObjetivaSchema.safeParse(semCitacao).success).toBe(false)
    expect(conteudoDeAtividadeSchema.safeParse({ ...atividade, questoes: [semCitacao] }).success).toBe(false)
    expect(questaoObjetivaSchema.safeParse({ ...questao, citacao: { materialId: UM_ID, trecho: 'sem página' } }).success).toBe(false)
    expect(questaoObjetivaSchema.safeParse({ ...questao, citacao: { pagina: 3, trecho: 'sem material' } }).success).toBe(false)
    expect(questaoObjetivaSchema.safeParse({ ...questao, citacao: { ...citacao, pagina: 0 } }).success).toBe(false)
    expect(conteudoDePlanoDeAulaSchema.safeParse({ ...plano, citacoes: [] }).success).toBe(false)
    const { citacoes: _semCitacoes, ...planoSemCitacoes } = plano
    expect(conteudoDePlanoDeAulaSchema.safeParse(planoSemCitacoes).success).toBe(false)
  })

  it('campo a mais é recusado em qualquer nível, e não descartado: o que o modelo inventar não entra', () => {
    for (const [caso, conteudo] of [
      ['na atividade', { ...atividade, observacao: 'turma fraca' }],
      ['na questão', { ...atividade, questoes: [{ ...questao, dica: 'a resposta é a primeira' }] }],
      ['na citação', { ...atividade, questoes: [{ ...questao, citacao: { ...citacao, url: 'https://exemplo.invalid' } }] }],
      ['na habilidade', { ...atividade, questoes: [{ ...questao, habilidade: { ...questao.habilidade, aluno: 'Ana' } }] }],
      ['no plano', { ...plano, perfilDaTurma: 'agitada' }],
      ['na etapa do plano', { ...plano, etapas: [{ ...plano.etapas[0], alunoQuePrecisaDeAtencao: 'João' }] }],
    ] as const) {
      expect(conteudoDoArtefatoSchema.safeParse(conteudo).success, caso).toBe(false)
    }
  })

  it('a questão tem quatro alternativas e gabarito dentro delas', () => {
    expect(questaoObjetivaSchema.safeParse({ ...questao, alternativas: ['a', 'b', 'c'] }).success).toBe(false)
    expect(questaoObjetivaSchema.safeParse({ ...questao, gabarito: 4 }).success).toBe(false)
    expect(questaoObjetivaSchema.safeParse({ ...questao, gabarito: -1 }).success).toBe(false)
  })

  it('a adaptação do conteúdo é só tipo de lista fechada: texto livre, tipo inventado e campo sobre o aluno são recusados', () => {
    for (const tipo of TIPOS_DE_ADAPTACAO) expect(conteudoDeAtividadeSchema.safeParse({ ...atividade, adaptacao: { tipos: [tipo] } }).success, tipo).toBe(true)
    for (const [caso, adaptacao] of [
      ['texto livre no lugar do tipo', { tipos: ['o aluno tem baixa visão'] }],
      ['campo de observação', { tipos: ['fonte_ampliada'], observacao: 'para o João, que tem laudo' }],
      ['campo de aluno', { tipos: ['fonte_ampliada'], alunoId: UM_ID }],
      ['texto no lugar do objeto', 'fonte ampliada para o João'],
      ['sem tipo nenhum', { tipos: [] }],
    ] as const) {
      expect(conteudoDeAtividadeSchema.safeParse({ ...atividade, adaptacao }).success, caso).toBe(false)
    }
  })
})

describe('adaptar um artefato (D35, D67)', () => {
  it('aceita tipos da lista com a chave do envio, e tempo extra só junto de tempo_adicional', () => {
    expect(adaptarArtefatoRequestSchema.parse({ tipos: ['fonte_ampliada', 'linguagem_direta'], chaveEnvio: CHAVE })).toEqual({ tipos: ['fonte_ampliada', 'linguagem_direta'], chaveEnvio: CHAVE })
    expect(adaptarArtefatoRequestSchema.safeParse({ tipos: ['tempo_adicional'], tempoExtraPercentual: 50, chaveEnvio: CHAVE }).success).toBe(true)
    expect(adaptarArtefatoRequestSchema.safeParse({ tipos: ['fonte_ampliada'], tempoExtraPercentual: 50, chaveEnvio: CHAVE }).success).toBe(false)
    expect(adaptarArtefatoRequestSchema.safeParse({ tipos: ['tempo_adicional'], tempoExtraPercentual: 500, chaveEnvio: CHAVE }).success).toBe(false)
  })

  it('texto livre sobre o aluno não tem por onde entrar: campo a mais, tipo fora da lista, tipo repetido e pedido sem tipo são recusados', () => {
    for (const [caso, corpo] of [
      ['descrição do aluno', { tipos: ['fonte_ampliada'], descricao: 'aluno com TDAH, precisa de menos texto', chaveEnvio: CHAVE }],
      ['motivo', { tipos: ['fonte_ampliada'], motivo: 'laudo de baixa visão', chaveEnvio: CHAVE }],
      ['aluno', { tipos: ['fonte_ampliada'], alunoId: UM_ID, chaveEnvio: CHAVE }],
      ['tipo que é texto livre', { tipos: ['para o aluno surdo do 2ºB'], chaveEnvio: CHAVE }],
      ['tipos como texto', { tipos: 'fonte_ampliada', chaveEnvio: CHAVE }],
      ['tipo repetido', { tipos: ['fonte_ampliada', 'fonte_ampliada'], chaveEnvio: CHAVE }],
      ['sem tipo', { tipos: [], chaveEnvio: CHAVE }],
      ['sem chave', { tipos: ['fonte_ampliada'] }],
      ['escola no corpo', { tipos: ['fonte_ampliada'], chaveEnvio: CHAVE, escolaId: UM_ID }],
    ] as const) {
      expect(adaptarArtefatoRequestSchema.safeParse(corpo).success, caso).toBe(false)
    }
  })
})

describe('ferramentas e artefato', () => {
  it('gerar pede turma, disciplina, tema e chave, só para as ferramentas que geram; escola e ano não vêm do cliente', () => {
    const corpo = { turmaId: UM_ID, disciplinaId: OUTRO_ID, tema: 'Reagente limitante', quantidade: 5, chaveEnvio: CHAVE }
    expect(gerarComFerramentaRequestSchema.parse(corpo)).toEqual(corpo)
    expect(FERRAMENTAS_GERADORAS).toEqual(['atividade_objetiva', 'plano_de_aula'])
    for (const [caso, errado] of [
      ['sem chave', { ...corpo, chaveEnvio: undefined }],
      ['tema vazio', { ...corpo, tema: '   ' }],
      ['questões demais', { ...corpo, quantidade: 21 }],
      ['escola no corpo', { ...corpo, escolaId: UM_ID }],
      ['ano no corpo', { ...corpo, anoLetivoId: UM_ID }],
      ['professor no corpo', { ...corpo, professorId: UM_ID }],
    ] as const) {
      expect(gerarComFerramentaRequestSchema.safeParse(errado).success, caso).toBe(false)
    }
  })

  it('renomear muda só o título: o conteúdo gerado não se edita por aqui', () => {
    expect(renomearArtefatoRequestSchema.parse({ titulo: ' Lista 2 ' })).toEqual({ titulo: 'Lista 2' })
    expect(renomearArtefatoRequestSchema.safeParse({ titulo: 'Lista 2', conteudo: atividade }).success).toBe(false)
    expect(renomearArtefatoRequestSchema.safeParse({ titulo: '' }).success).toBe(false)
  })

  it('a resposta do artefato traz a versão adaptada com os tipos e o estado da entrega, e nada sobre aluno', () => {
    const resumido = { id: UM_ID, tipo: 'atividade_objetiva', titulo: 'Lista', turmaId: UM_ID, disciplinaId: OUTRO_ID, origemId: null, adaptacao: null, entrega: null, criadoEm: AGORA }
    const adaptada = { ...resumido, id: OUTRO_ID, origemId: UM_ID, adaptacao: { tipos: ['fonte_ampliada'] }, entrega: { id: UM_ID, estado: 'pendente', decididaEm: null } }
    const resposta = { ...resumido, conteudo: atividade, versoesAdaptadas: [adaptada], aplicacoes: [] }
    expect(artefatoResponseSchema.safeParse(resposta).success).toBe(true)
    expect(artefatoResponseSchema.safeParse({ ...resposta, versoesAdaptadas: [{ ...adaptada, alunos: [UM_ID] }] }).success).toBe(false)
    expect(artefatoResponseSchema.safeParse({ ...resposta, versoesAdaptadas: [{ ...adaptada, adaptacao: { tipos: ['fonte_ampliada'], paraQuem: 'Ana' } }] }).success).toBe(false)
  })
})

describe('conversa com o Assistente (D18; regra 70, item 8)', () => {
  it('a mensagem leva texto, turma, disciplina e chave; escola, ano e dono da thread não vêm do cliente', () => {
    const corpo = { texto: 'Monta uma lista de estequiometria para o 2ºB', turmaId: UM_ID, disciplinaId: OUTRO_ID, chaveEnvio: CHAVE }
    expect(mensagemAoAssistenteRequestSchema.parse(corpo)).toEqual(corpo)
    for (const campo of ['escolaId', 'anoLetivoId', 'usuarioId', 'threadId']) expect(mensagemAoAssistenteRequestSchema.safeParse({ ...corpo, [campo]: UM_ID }).success, campo).toBe(false)
    expect(mensagemAoAssistenteRequestSchema.safeParse({ ...corpo, texto: '' }).success).toBe(false)
    expect(mensagemAoAssistenteRequestSchema.safeParse({ ...corpo, chaveEnvio: 'chave-1' }).success).toBe(false)
  })

  it('"só conversar" é uma marca opcional de lista fechada: sem ela nada muda, e ela não aceita texto livre', () => {
    const corpo = { texto: 'Só conversar', turmaId: UM_ID, disciplinaId: OUTRO_ID, chaveEnvio: CHAVE }
    expect(RESPOSTAS_A_PROPOSTA).toEqual(['so_conversar'])
    expect(mensagemAoAssistenteRequestSchema.parse(corpo)).toEqual(corpo)
    expect(mensagemAoAssistenteRequestSchema.parse({ ...corpo, resposta: 'so_conversar' })).toEqual({ ...corpo, resposta: 'so_conversar' })
    for (const resposta of ['abrir_ferramenta', 'gerar', '', 'prefiro conversar sobre o aluno', null, true]) {
      expect(mensagemAoAssistenteRequestSchema.safeParse({ ...corpo, resposta }).success, String(resposta)).toBe(false)
    }
    // Continua estrito: a marca não abre a porta para campo vizinho.
    expect(mensagemAoAssistenteRequestSchema.safeParse({ ...corpo, resposta: 'so_conversar', proposta: { ferramenta: 'atividade_objetiva' } }).success).toBe(false)
  })

  it('o Assistente responde texto com página citada ou a proposta de ferramenta; a proposta só de ferramenta que gera', () => {
    const parametros = { turmaId: UM_ID, disciplinaId: OUTRO_ID, tema: 'Reagente limitante', quantidade: 5 }
    expect(conteudoDaMensagemDoAgenteSchema.safeParse({ tipo: 'texto', texto: 'O capítulo 7 trata disso.', citacoes: [citacao] }).success).toBe(true)
    expect(conteudoDaMensagemDoAgenteSchema.safeParse({ tipo: 'proposta_de_ferramenta', texto: 'Quer abrir a ferramenta?', proposta: { ferramenta: 'atividade_objetiva', parametros } }).success).toBe(true)
    // A Adaptação parte de um artefato e tem rota própria: o Assistente não a propõe com tema solto.
    expect(conteudoDaMensagemDoAgenteSchema.safeParse({ tipo: 'proposta_de_ferramenta', texto: 'Quer adaptar?', proposta: { ferramenta: 'adaptacao', parametros } }).success).toBe(false)
    expect(conteudoDaMensagemDoAgenteSchema.safeParse({ tipo: 'texto', texto: 'Sem citações declaradas.' }).success).toBe(false)
    expect(conteudoDaMensagemDoAgenteSchema.safeParse({ tipo: 'nota', texto: '7,5' }).success).toBe(false)
  })

  it('a conversa devolve as mensagens do professor e do agente, com teto, e não aceita filtro de outra pessoa', () => {
    const doProfessor = { id: UM_ID, autor: 'usuario', tipo: 'texto', texto: 'Monta uma lista', turmaId: UM_ID, disciplinaId: OUTRO_ID, criadaEm: AGORA }
    const doAgente = { id: OUTRO_ID, autor: 'agente', tipo: 'texto', texto: 'Aqui está.', citacoes: [citacao], criadaEm: AGORA }
    expect(conversaDoAssistenteResponseSchema.safeParse({ mensagens: [doProfessor, doAgente] }).success).toBe(true)
    expect(mensagemDaConversaSchema.safeParse({ ...doAgente, autor: 'usuario' }).success).toBe(false)
    expect(conversaDoAssistenteResponseSchema.safeParse({ mensagens: Array.from({ length: MAXIMO_DE_MENSAGENS_POR_PAGINA + 1 }, () => doAgente) }).success).toBe(false)
    expect(conversaDoAssistenteQuerySchema.parse({})).toEqual({ limite: 50 })
    for (const campo of ['usuarioId', 'professorId', 'threadId']) expect(conversaDoAssistenteQuerySchema.safeParse({ [campo]: UM_ID }).success, campo).toBe(false)
  })
})

describe('entrega: aprovar ou rejeitar com justificativa (regra 70, item 3)', () => {
  it('rejeitar exige justificativa, e aprovar não a aceita', () => {
    expect(decidirEntregaRequestSchema.parse({ decisao: 'aprovar' })).toEqual({ decisao: 'aprovar' })
    expect(decidirEntregaRequestSchema.safeParse({ decisao: 'rejeitar' }).success).toBe(false)
    expect(decidirEntregaRequestSchema.safeParse({ decisao: 'rejeitar', justificativa: 'x'.repeat(TAMANHO_MINIMO_DA_JUSTIFICATIVA - 1) }).success).toBe(false)
    expect(decidirEntregaRequestSchema.safeParse({ decisao: 'rejeitar', justificativa: '        ' }).success).toBe(false)
    expect(decidirEntregaRequestSchema.safeParse({ decisao: 'rejeitar', justificativa: 'O enunciado mudou o que é cobrado.' }).success).toBe(true)
    expect(decidirEntregaRequestSchema.safeParse({ decisao: 'aprovar', justificativa: 'aprovado com ressalva' }).success).toBe(false)
    expect(decidirEntregaRequestSchema.safeParse({ decisao: 'publicar' }).success).toBe(false)
    // Quem decide vem da sessão, nunca do corpo.
    expect(decidirEntregaRequestSchema.safeParse({ decisao: 'aprovar', decididaPor: UM_ID }).success).toBe(false)
  })

  it('a entrega e a consulta dela não têm nota nem filtro por professor', () => {
    const entrega = { id: UM_ID, tipo: 'lote_de_correcao', funcao: 'correcao_de_objetiva', estado: 'pendente', turmaId: UM_ID, titulo: 'Lista', artefatoId: null, atividadeAplicadaId: OUTRO_ID, criadaEm: AGORA, decididaEm: null, decididaPor: null, justificativa: null }
    expect(entregaSchema.safeParse(entrega).success).toBe(true)
    expect(entregaSchema.safeParse({ ...entrega, nota: 7.5 }).success).toBe(false)
    expect(entregaSchema.safeParse({ ...entrega, funcao: 'corretor' }).success).toBe(false)
    expect(entregasQuerySchema.safeParse({ estado: 'pendente', turmaId: UM_ID }).success).toBe(true)
    expect(entregasQuerySchema.safeParse({ estado: 'pendente', professorId: UM_ID }).success).toBe(false)
  })
})

describe('catálogo de habilidades por disciplina, em código', () => {
  it('Química do Ensino Médio cobre estequiometria, do balanceamento ao rendimento', () => {
    const quimica = habilidadesDaDisciplina('Química', 'em')
    const deEstequiometria = quimica.filter((habilidade) => habilidade.tema === 'Estequiometria').map((habilidade) => habilidade.descricao.toLowerCase())
    expect(deEstequiometria.length).toBeGreaterThanOrEqual(4)
    for (const assunto of ['conservação da massa', 'massa molar', 'equação balanceada', 'reagente limitante', 'rendimento']) {
      expect(deEstequiometria.some((descricao) => descricao.includes(assunto)), assunto).toBe(true)
    }
  })

  it('a disciplina é achada sem acento nem maiúscula, e a etapa separa o catálogo', () => {
    const quimica = CATALOGO_DE_HABILIDADES.quimica_em.habilidades
    for (const nome of ['Química', 'QUIMICA', '  química ']) expect(habilidadesDaDisciplina(nome, 'em'), nome).toEqual(quimica)
    expect(habilidadesDaDisciplina('Ciências', 'ef_anos_finais')).toEqual(CATALOGO_DE_HABILIDADES.ciencias_ef.habilidades)
    // Química dos anos finais e a disciplina que o catálogo curto não conhece caem na habilidade geral: nunca lista vazia.
    expect(habilidadesDaDisciplina('Química', 'ef_anos_finais')).toEqual([HABILIDADE_GERAL])
    expect(habilidadesDaDisciplina('Projeto de Vida', 'em')).toEqual([HABILIDADE_GERAL])
  })

  it('todo código é único, cabe no contrato e não se apresenta como código da BNCC', () => {
    const todas = [...Object.values(CATALOGO_DE_HABILIDADES).flatMap((disciplina) => [...disciplina.habilidades]), HABILIDADE_GERAL]
    const codigos = todas.map((habilidade) => habilidade.codigo)
    expect(new Set(codigos).size).toBe(codigos.length)
    for (const habilidade of todas) {
      expect(habilidade.codigo.length, habilidade.codigo).toBeLessThanOrEqual(20)
      // O formato da BNCC é `EM13CNT101` ou `EF09CI02`: o catálogo curto não afirma correspondência com ela.
      expect(habilidade.codigo, habilidade.codigo).not.toMatch(/^E[FM]\d{2}/)
      expect(habilidadeDoCatalogo(habilidade.codigo)).toEqual(habilidade)
      expect(questaoObjetivaSchema.safeParse({ ...questao, habilidade: { codigo: habilidade.codigo, descricao: habilidade.descricao } }).success, habilidade.codigo).toBe(true)
    }
    expect(habilidadeDoCatalogo('EM13CNT101')).toBeUndefined()
  })
})
