import { describe, expect, it } from 'vitest'
import { ErrorCode } from '../errors/error-code.js'
import { MENSAGENS_DE_ERRO } from '../errors/messages.js'
import { idempotencyKeySchema } from './idempotency-key.js'
import { execucaoInputSchema, execucaoResponseSchema, execucaoAceitaResponseSchema, resultadoGravadoSchema, FORMATO_DO_CODIGO_DE_ERRO, FUNCAO_DA_TAREFA_DE_IA, TAREFAS_DE_IA } from './execucao.js'
import { FUNCOES } from './funcoes.js'

// Valores fixos e sintéticos: o pacote não tem os tipos do Node.
const UM_ID = '0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b'
const AGORA = '2026-10-04T13:00:00.000Z'

describe('execução de agente: 202 com o id, e a consulta até terminar', () => {
  const mensagem = { id: UM_ID, autor: 'agente', tipo: 'texto', texto: 'Aqui está.', citacoes: [], criadaEm: AGORA }
  const concluida = { id: UM_ID, tarefa: 'propor_ferramenta', estado: 'concluida', resultado: { tipo: 'mensagem', mensagem }, erro: null }

  it('toda tarefa tem a função dela no catálogo, e a chave do envio é UUID', () => {
    for (const tarefa of TAREFAS_DE_IA) expect(Object.keys(FUNCOES), tarefa).toContain(FUNCAO_DA_TAREFA_DE_IA[tarefa])
    expect(FUNCAO_DA_TAREFA_DE_IA.relatorio_da_correcao).toBe('correcao_de_objetiva')
    expect(FUNCAO_DA_TAREFA_DE_IA.adaptar_atividade).toBe('adaptacao')
    expect(FUNCAO_DA_TAREFA_DE_IA.turno_do_tutor).toBe('tutor_com_o_aluno')
    expect(idempotencyKeySchema.safeParse('4f1c2d3e-5a6b-4c7d-8e9f-0a1b2c3d4e5f').success).toBe(true)
    expect(idempotencyKeySchema.safeParse('clique-1').success).toBe(false)
    expect(execucaoAceitaResponseSchema.safeParse({ execucaoId: UM_ID }).success).toBe(true)
    expect(execucaoAceitaResponseSchema.safeParse({ execucaoId: UM_ID, resultado: {} }).success).toBe(false)
  })

  it('o resultado só existe na concluída e o erro só na que falhou, e o erro é código do catálogo, com mensagem que diz o que fazer', () => {
    expect(execucaoResponseSchema.safeParse(concluida).success).toBe(true)
    expect(execucaoResponseSchema.safeParse({ ...concluida, estado: 'rodando' }).success).toBe(false)
    expect(execucaoResponseSchema.safeParse({ ...concluida, resultado: null }).success).toBe(false)
    expect(execucaoResponseSchema.safeParse({ ...concluida, estado: 'pendente', resultado: null }).success).toBe(true)
    const falhou = { ...concluida, estado: 'falhou', resultado: null, erro: 'IA_INDISPONIVEL' }
    expect(execucaoResponseSchema.safeParse(falhou).success).toBe(true)
    expect(execucaoResponseSchema.safeParse({ ...falhou, erro: null }).success).toBe(false)
    // O erro cru do provedor nunca chega à tela: só código que tem mensagem no catálogo.
    expect(execucaoResponseSchema.safeParse({ ...falhou, erro: 'Error: 429 Too Many Requests' }).success).toBe(false)
    for (const codigo of ['IA_INDISPONIVEL', 'IA_TEMPO_ESGOTADO', 'IA_SAIDA_INVALIDA', 'FUNCAO_SUSPENSA', 'EXECUCAO_INTERROMPIDA', 'MATERIAL_INSUFICIENTE'] as const) {
      expect(execucaoResponseSchema.safeParse({ ...falhou, erro: codigo }).success, codigo).toBe(true)
      expect(MENSAGENS_DE_ERRO[codigo], codigo).toMatch(/Tente de novo|Envie de novo|Fale com a coordenação|Confira/)
      expect(MENSAGENS_DE_ERRO[codigo], codigo).not.toMatch(/\b(erro|exception|timeout|provedor|modelo|token)\b/i)
    }
    // Nunca o prompt, o modelo nem o custo.
    for (const campo of [{ entrada: {} }, { modelo: 'qwen' }, { custoMicros: 12 }, { solicitadaPor: UM_ID }]) expect(execucaoResponseSchema.safeParse({ ...concluida, ...campo }).success, Object.keys(campo)[0]).toBe(false)
  })

  it('todo código de erro tem o formato que o banco aceita na execução e no consumo', () => {
    for (const codigo of Object.values(ErrorCode)) expect(codigo, codigo).toMatch(FORMATO_DO_CODIGO_DE_ERRO)
    for (const cru of ['saida invalida', 'ia_indisponivel', 'Error: boom', 'X']) expect(cru, cru).not.toMatch(FORMATO_DO_CODIGO_DE_ERRO)
  })

  it('o que a execução grava é só referência: o texto da resposta do Assistente e do Tutor não cabe no resultado nem na entrada', () => {
    expect(resultadoGravadoSchema.safeParse({ tipo: 'mensagem_do_tutor', mensagemId: UM_ID }).success).toBe(true)
    expect(resultadoGravadoSchema.safeParse({ tipo: 'artefato', artefatoId: UM_ID, entregaId: null }).success).toBe(true)
    expect(resultadoGravadoSchema.safeParse({ tipo: 'mensagem_do_tutor', mensagemId: UM_ID, texto: 'O que a equação diz?' }).success).toBe(false)
    expect(resultadoGravadoSchema.safeParse({ tipo: 'mensagem', mensagem }).success).toBe(false)
    expect(execucaoInputSchema.safeParse({ tarefa: 'turno_do_tutor' }).success).toBe(true)
    expect(execucaoInputSchema.safeParse({ tarefa: 'turno_do_tutor', texto: 'não entendi a questão 3' }).success).toBe(false)
    expect(execucaoInputSchema.safeParse({ tarefa: 'propor_ferramenta', texto: 'monta uma lista para o 2ºB' }).success).toBe(false)
    // A marca de "só conversar" é de lista fechada, e só da conversa: não vira campo de texto nem serve a outra tarefa.
    expect(execucaoInputSchema.safeParse({ tarefa: 'propor_ferramenta', resposta: 'so_conversar' }).success).toBe(true)
    expect(execucaoInputSchema.safeParse({ tarefa: 'propor_ferramenta', resposta: 'prefiro falar do aluno' }).success).toBe(false)
    expect(execucaoInputSchema.safeParse({ tarefa: 'turno_do_tutor', resposta: 'so_conversar' }).success).toBe(false)
    expect(execucaoInputSchema.safeParse({ tarefa: 'adaptar_atividade', artefatoId: UM_ID, tipos: ['fonte_ampliada'] }).success).toBe(true)
    expect(execucaoInputSchema.safeParse({ tarefa: 'adaptar_atividade', artefatoId: UM_ID, tipos: ['fonte_ampliada'], aluno: 'Ana' }).success).toBe(false)
  })
})
