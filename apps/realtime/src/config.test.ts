import { describe, expect, it } from 'vitest'
import { InvalidConfigError, loadConfig } from './config.js'

const ambienteValido = {
  REALTIME_PORTA: '3000',
  REDIS_FILA_URL: 'redis://redis-fila:6379',
  REALTIME_STREAM_TAMANHO_MAXIMO: '10000',
  AMBIENTE: 'local',
  IDENTIDADE_CHAVE_ASSINATURA: 'chave_sintetica_de_teste_com_32_caracteres',
  BANCO_URL: 'postgres://educa:senha_sintetica_xyz@postgres:5432/educa',
  BANCO_POOL_MAXIMO: '4',
  BANCO_TIMEOUT_CONEXAO_MS: '2000',
  BANCO_TIMEOUT_CONSULTA_MS: '1500',
  DRENAGEM_ESPERA_BORDA_MS: '5000',
  DRENAGEM_PRAZO_MS: '10000',
  TELEMETRIA_OTLP_URL: 'http://observabilidade:4318/',
  TELEMETRIA_INTERVALO_MS: '5000',
}

function erroDe(ambiente: Record<string, string | undefined>): InvalidConfigError {
  try {
    loadConfig(ambiente)
  } catch (erro) {
    if (erro instanceof InvalidConfigError) return erro
    throw erro
  }
  throw new Error('a configuração deveria ter sido recusada')
}

describe('lerConfiguracao do realtime', () => {
  it('converte o ambiente em configuração tipada', () => {
    expect(loadConfig(ambienteValido)).toEqual({
      porta: 3000,
      redis: { url: 'redis://redis-fila:6379', tamanhoMaximoDoStream: 10000 },
      identidade: {
        ambiente: 'local',
        chaveAssinatura: new TextEncoder().encode(ambienteValido.IDENTIDADE_CHAVE_ASSINATURA),
      },
      banco: { url: ambienteValido.BANCO_URL, maximoConexoes: 4, timeoutConexaoMs: 2000, timeoutConsultaMs: 1500 },
      drenagem: { esperaDaBordaMs: 5000, prazoMs: 10000 },
      telemetria: { otlpUrl: 'http://observabilidade:4318', intervaloMs: 5000 },
    })
  })

  it.each(Object.keys(ambienteValido))('não sobe sem %s', (variavel) => {
    expect(erroDe({ ...ambienteValido, [variavel]: undefined }).variaveis).toEqual([variavel])
  })

  it('não sobe com banco inválido: desde a tarefa 3.0 o handshake lê a sessão gravada, e sem Postgres ninguém entra', () => {
    expect(erroDe({ ...ambienteValido, BANCO_URL: 'postgres://postgres' }).variaveis).toEqual(['BANCO_URL'])
    expect(erroDe({ ...ambienteValido, BANCO_POOL_MAXIMO: '0' }).variaveis).toEqual(['BANCO_POOL_MAXIMO'])
    expect(erroDe({ ...ambienteValido, BANCO_TIMEOUT_CONSULTA_MS: 'sem prazo' }).variaveis).toEqual(['BANCO_TIMEOUT_CONSULTA_MS'])
  })

  it('aponta de uma vez os problemas de Redis, identidade e drenagem, sem repetir o valor', () => {
    const erro = erroDe({
      ...ambienteValido,
      REDIS_FILA_URL: 'http://usuario:senha_sintetica_xyz@redis',
      IDENTIDADE_CHAVE_ASSINATURA: 'curta',
      DRENAGEM_ESPERA_BORDA_MS: '10000',
    })
    expect(erro.variaveis).toEqual(['DRENAGEM_ESPERA_BORDA_MS', 'IDENTIDADE_CHAVE_ASSINATURA', 'REDIS_FILA_URL'])
    expect(erro.message).not.toContain('senha_sintetica_xyz')
  })
})
