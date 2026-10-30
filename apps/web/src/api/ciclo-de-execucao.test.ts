import { ErrorCode, INTERVALO_DA_CONSULTA_DE_EXECUCAO_MS, MENSAGENS_DE_ERRO, type MensagemDoAgente, type ExecucaoResponse } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import {
  aceitarEnvio,
  aparenciaDaFalha,
  chavesParaInvalidar,
  codigoDoErro,
  comecarEnvio,
  desistirDaConsulta,
  emCurso,
  estaDemorando,
  intervaloDaConsulta,
  LIMIAR_DA_DEMORA_MS,
  recusarEnvio,
  registrarExecucao,
  tentarDeNovo,
  type CicloDeExecucao,
} from './ciclo-de-execucao'
import { ErroDaApi } from './cliente'

const EXECUCAO = '0190f5a0-0000-7000-8000-0000000000e1'
const OUTRA_EXECUCAO = '0190f5a0-0000-7000-8000-0000000000e2'
const MENSAGEM: MensagemDoAgente = { id: '0190f5a0-0000-7000-8000-0000000000d1', criadaEm: '2026-10-05T13:00:00.000Z', autor: 'agente', tipo: 'texto', texto: 'Resposta.', citacoes: [] }
const ARTEFATO = '0190f5a0-0000-7000-8000-0000000000a1'
const ENTREGA = '0190f5a0-0000-7000-8000-0000000000b1'

/** Um sorteio que devolve chaves conhecidas, na ordem: o teste diz qual chave cada envio levou. */
function sorteio(...chaves: string[]): () => string {
  const fila = [...chaves]
  return () => {
    const chave = fila.shift()
    if (chave === undefined) throw new Error('sorteio além do esperado')
    return chave
  }
}

type Pedido = { readonly texto: string }
const PEDIDO: Pedido = { texto: 'uma atividade de estequiometria' }

function execucao(estado: ExecucaoResponse['estado'], campos: Partial<ExecucaoResponse> = {}): ExecucaoResponse {
  return { id: EXECUCAO, tarefa: 'propor_ferramenta', estado, resultado: null, erro: null, ...campos }
}

function esperando(): CicloDeExecucao<Pedido> {
  const ciclo = aceitarEnvio(comecarEnvio<Pedido>(undefined, PEDIDO, sorteio('chave-1'), 1_000), 'chave-1', EXECUCAO)
  if (ciclo === undefined) throw new Error('era para estar esperando')
  return ciclo
}

describe('o envio: a chave e o pedido duplo', () => {
  it('cada pedido novo sorteia a própria chave', () => {
    const sortear = sorteio('chave-1', 'chave-2')
    const primeiro = comecarEnvio<Pedido>(undefined, PEDIDO, sortear, 1_000)
    expect(primeiro).toEqual({ etapa: 'enviando', pedido: PEDIDO, chaveEnvio: 'chave-1', desde: 1_000 })
    const concluido: CicloDeExecucao<Pedido> = { etapa: 'concluida', pedido: PEDIDO, chaveEnvio: 'chave-1', execucaoId: EXECUCAO, resultado: { tipo: 'mensagem', mensagem: MENSAGEM } }
    expect(comecarEnvio(concluido, { texto: 'outro pedido' }, sortear, 2_000)).toEqual({ etapa: 'enviando', pedido: { texto: 'outro pedido' }, chaveEnvio: 'chave-2', desde: 2_000 })
  })

  it('com um pedido no ar, o segundo Enter não manda nada e não gasta chave', () => {
    const enviando = comecarEnvio<Pedido>(undefined, PEDIDO, sorteio('chave-1'), 1_000)
    // O sorteio vazio lançaria se a regra tentasse sortear: o pedido duplo nem chega a ter chave.
    expect(comecarEnvio(enviando, PEDIDO, sorteio(), 1_001)).toBeUndefined()
    expect(comecarEnvio(esperando(), PEDIDO, sorteio(), 1_002)).toBeUndefined()
    expect(emCurso(enviando)).toBe(true)
    expect(emCurso(esperando())).toBe(true)
    expect(emCurso(undefined)).toBe(false)
  })

  it('o 202 leva o ciclo a esperar aquela execução; o de um envio que já não é o da tela é ignorado', () => {
    const enviando = comecarEnvio<Pedido>(undefined, PEDIDO, sorteio('chave-1'), 1_000)
    expect(aceitarEnvio(enviando, 'chave-1', EXECUCAO)).toEqual({ etapa: 'esperando', pedido: PEDIDO, chaveEnvio: 'chave-1', desde: 1_000, execucaoId: EXECUCAO })
    expect(aceitarEnvio(enviando, 'chave-antiga', OUTRA_EXECUCAO)).toBe(enviando)
    expect(aceitarEnvio(undefined, 'chave-1', EXECUCAO)).toBeUndefined()
  })

  it('o envio recusado guarda o código do catálogo, e nunca o erro cru', () => {
    const enviando = comecarEnvio<Pedido>(undefined, PEDIDO, sorteio('chave-1'), 1_000)
    expect(recusarEnvio(enviando, 'chave-1', new ErroDaApi(ErrorCode.FUNCAO_SUSPENSA))).toEqual({ etapa: 'falhou', pedido: PEDIDO, chaveEnvio: 'chave-1', erro: 'FUNCAO_SUSPENSA' })
    const semCodigo = recusarEnvio(enviando, 'chave-1', new TypeError('Failed to fetch at https://provedor.example/v1'))
    expect(semCodigo).toEqual({ etapa: 'falhou', pedido: PEDIDO, chaveEnvio: 'chave-1', erro: 'ERRO_INTERNO' })
    expect(codigoDoErro('texto solto')).toBe('ERRO_INTERNO')
  })
})

describe('"Tentar de novo": qual chave vai', () => {
  it('o envio que não foi aceito repete com a mesma chave: a mesma chave devolve a mesma execução', () => {
    const falhou = recusarEnvio(comecarEnvio<Pedido>(undefined, PEDIDO, sorteio('chave-1'), 1_000), 'chave-1', new ErroDaApi(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO))
    expect(tentarDeNovo(falhou, sorteio(), 5_000)).toEqual({ etapa: 'enviando', pedido: PEDIDO, chaveEnvio: 'chave-1', desde: 5_000 })
  })

  it('a consulta que deixou de responder também repete com a mesma chave, para reencontrar a execução', () => {
    const semConsulta = desistirDaConsulta(esperando(), new ErroDaApi(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO))
    expect(semConsulta).toEqual({ etapa: 'falhou', pedido: PEDIDO, chaveEnvio: 'chave-1', erro: 'INDISPONIVEL_TENTE_DE_NOVO' })
    expect(tentarDeNovo(semConsulta, sorteio(), 5_000)?.chaveEnvio).toBe('chave-1')
  })

  it('a execução que falhou repete com chave nova: a antiga devolveria a execução que falhou', () => {
    const falhou = registrarExecucao(esperando(), execucao('falhou', { erro: ErrorCode.IA_INDISPONIVEL }))
    expect(falhou).toEqual({ etapa: 'falhou', pedido: PEDIDO, chaveEnvio: 'chave-1', execucaoId: EXECUCAO, erro: 'IA_INDISPONIVEL' })
    expect(tentarDeNovo(falhou, sorteio('chave-2'), 5_000)).toEqual({ etapa: 'enviando', pedido: PEDIDO, chaveEnvio: 'chave-2', desde: 5_000 })
  })

  it('só a falha se repete: com o pedido no ar, concluído ou sem pedido, nada sai', () => {
    expect(tentarDeNovo(esperando(), sorteio(), 5_000)).toBeUndefined()
    expect(tentarDeNovo<Pedido>(undefined, sorteio(), 5_000)).toBeUndefined()
    const concluida = registrarExecucao(esperando(), execucao('concluida', { resultado: { tipo: 'mensagem', mensagem: MENSAGEM } }))
    expect(tentarDeNovo(concluida, sorteio(), 5_000)).toBeUndefined()
  })
})

describe('a consulta da execução: quando para', () => {
  it('consulta no intervalo do contrato enquanto a execução não termina', () => {
    expect(intervaloDaConsulta(undefined, false)).toBe(INTERVALO_DA_CONSULTA_DE_EXECUCAO_MS)
    expect(intervaloDaConsulta({ estado: 'pendente' }, false)).toBe(INTERVALO_DA_CONSULTA_DE_EXECUCAO_MS)
    expect(intervaloDaConsulta({ estado: 'rodando' }, false)).toBe(INTERVALO_DA_CONSULTA_DE_EXECUCAO_MS)
  })

  it('para de consultar na concluída e na que falhou, e quando a própria consulta falha', () => {
    expect(intervaloDaConsulta({ estado: 'concluida' }, false)).toBe(false)
    expect(intervaloDaConsulta({ estado: 'falhou' }, false)).toBe(false)
    expect(intervaloDaConsulta({ estado: 'rodando' }, true)).toBe(false)
    expect(intervaloDaConsulta(undefined, true)).toBe(false)
  })

  it('pendente e rodando não mudam o ciclo; a concluída traz o resultado; a de outra execução é ignorada', () => {
    const ciclo = esperando()
    expect(registrarExecucao(ciclo, execucao('pendente'))).toBe(ciclo)
    expect(registrarExecucao(ciclo, execucao('rodando'))).toBe(ciclo)
    expect(registrarExecucao(ciclo, execucao('concluida', { id: OUTRA_EXECUCAO, resultado: { tipo: 'mensagem', mensagem: MENSAGEM } }))).toBe(ciclo)
    expect(registrarExecucao(ciclo, execucao('concluida', { resultado: { tipo: 'mensagem', mensagem: MENSAGEM } }))).toEqual({
      etapa: 'concluida',
      pedido: PEDIDO,
      chaveEnvio: 'chave-1',
      execucaoId: EXECUCAO,
      resultado: { tipo: 'mensagem', mensagem: MENSAGEM },
    })
  })

  it('a demora é avisada a partir do limiar, e não antes', () => {
    expect(estaDemorando(1_000, 1_000 + LIMIAR_DA_DEMORA_MS - 1)).toBe(false)
    expect(estaDemorando(1_000, 1_000 + LIMIAR_DA_DEMORA_MS)).toBe(true)
  })
})

describe('o que a tela lê de novo quando a execução conclui', () => {
  it('a resposta do Assistente invalida a conversa, e só ela', () => {
    expect(chavesParaInvalidar({ tipo: 'mensagem', mensagem: MENSAGEM })).toEqual([['assistente', 'conversa']])
  })

  it('o artefato gerado invalida os artefatos; a versão adaptada invalida também as entregas, que alimentam "Esperando você" e o contador da lateral', () => {
    expect(chavesParaInvalidar({ tipo: 'artefato', artefatoId: ARTEFATO, entregaId: null })).toEqual([['artefatos']])
    expect(chavesParaInvalidar({ tipo: 'artefato', artefatoId: ARTEFATO, entregaId: ENTREGA })).toEqual([['artefatos'], ['entregas']])
    expect(chavesParaInvalidar({ tipo: 'lote_de_correcao', entregaId: ENTREGA })).toEqual([['entregas']])
  })
})

describe('como a falha aparece: nunca erro cru (regra 80, item 4)', () => {
  it('função suspensa pela escola é aviso que explica, e não erro que se repete', () => {
    expect(aparenciaDaFalha(ErrorCode.FUNCAO_SUSPENSA)).toBe('suspensa')
  })

  it('o limite de pedidos por minuto é dito com calma, e não como falha da IA nem como erro', () => {
    expect(aparenciaDaFalha(ErrorCode.LIMITE_EXCEDIDO)).toBe('limite')
    // O envio recusado pelo limite não chegou a virar execução: repetir usa a mesma chave.
    const recusado = recusarEnvio(comecarEnvio<Pedido>(undefined, PEDIDO, sorteio('chave-1'), 1_000), 'chave-1', new ErroDaApi(ErrorCode.LIMITE_EXCEDIDO))
    expect(tentarDeNovo(recusado, sorteio(), 70_000)?.chaveEnvio).toBe('chave-1')
  })

  it('o que passa sozinho vira aviso com "Tentar de novo"; o que pede mudança vem com a mensagem do catálogo', () => {
    expect([ErrorCode.IA_INDISPONIVEL, ErrorCode.IA_TEMPO_ESGOTADO, ErrorCode.EXECUCAO_INTERROMPIDA, ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, ErrorCode.ERRO_INTERNO].map(aparenciaDaFalha)).toEqual(['fila', 'fila', 'fila', 'fila', 'fila'])
    expect([ErrorCode.MATERIAL_INSUFICIENTE, ErrorCode.IA_ORCAMENTO_ESGOTADO, ErrorCode.NAO_ENCONTRADO, ErrorCode.CONFLITO].map(aparenciaDaFalha)).toEqual(['explicada', 'explicada', 'explicada', 'explicada'])
  })

  it('todo código que o ciclo guarda tem mensagem em português no catálogo', () => {
    for (const codigo of Object.values(ErrorCode)) expect(MENSAGENS_DE_ERRO[codigo]).toMatch(/\p{L}/u)
  })
})
