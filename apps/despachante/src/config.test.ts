import { describe, expect, it } from 'vitest'
import { MOTIVO_VAGAS_DESLIGADAS_EM_PRODUCAO } from '@educa/core'
import { InvalidConfigError, loadConfig } from './config.js'

const ambienteValido = {
  AMBIENTE: 'local',
  VAGAS_POR_ESCOLA_DESLIGADAS: 'false',
  BANCO_URL: 'postgres://educa:senha_sintetica_xyz@postgres:5432/educa',
  BANCO_POOL_MAXIMO: '3',
  BANCO_TIMEOUT_CONEXAO_MS: '2000',
  BANCO_TIMEOUT_CONSULTA_MS: '2000',
  REDIS_FILA_URL: 'redis://redis-fila:6379',
  VAGAS_ESCOLA_INTERATIVA: '5',
  VAGAS_ESCOLA_NORMAL: '5',
  VAGAS_ESCOLA_LOTE: '2',
  JANELA_LETIVA_FUSO: 'America/Sao_Paulo',
  JANELA_LETIVA_DIAS: '1,2,3,4,5',
  JANELA_LETIVA_INICIO: '07:00',
  JANELA_LETIVA_FIM: '18:00',
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

describe('lerConfiguracao do despachante', () => {
  it('converte o ambiente, com statement_timeout próprio no pool e as vagas padrão por fila', () => {
    expect(loadConfig(ambienteValido)).toEqual({
      banco: { url: ambienteValido.BANCO_URL, maximoConexoes: 3, timeoutConexaoMs: 2000, timeoutConsultaMs: 2000 },
      redisFilaUrl: 'redis://redis-fila:6379',
      vagasPadrao: { interativa: 5, normal: 5, lote: 2 },
      janelaPadrao: { fuso: 'America/Sao_Paulo', diasLetivos: [1, 2, 3, 4, 5], inicio: '07:00', fim: '18:00' },
      telemetria: { otlpUrl: 'http://observabilidade:4318', intervaloMs: 5000 },
    })
  })

  it.each([
    ['JANELA_LETIVA_FUSO', 'Brasil/Joinville'],
    ['JANELA_LETIVA_FUSO', 'UTC-3'],
    ['JANELA_LETIVA_DIAS', '0,1'],
    ['JANELA_LETIVA_DIAS', 'seg-sex'],
    ['JANELA_LETIVA_DIAS', ''],
    ['JANELA_LETIVA_INICIO', '7h'],
    ['JANELA_LETIVA_INICIO', '25:00'],
    ['JANELA_LETIVA_FIM', '06:00'],
    ['JANELA_LETIVA_FIM', '07:00'],
  ])('não sobe com %s=%s: horário letivo que não se aplica seguraria ou soltaria o lote na hora errada', (variavel, valor) => {
    expect(erroDe({ ...ambienteValido, [variavel]: valor }).variaveis).toEqual([variavel])
  })

  it('escola com aula aos sábados no padrão: os dias saem em ordem e sem repetição', () => {
    expect(loadConfig({ ...ambienteValido, JANELA_LETIVA_DIAS: '6,1,2,3,4,5,1' }).janelaPadrao.diasLetivos).toEqual([1, 2, 3, 4, 5, 6])
  })

  it.each(['0', '-2', '1.5', 'duas'])('não sobe com VAGAS_ESCOLA_LOTE=%s: vaga zero pararia toda escola sem configuração própria', (valor) => {
    expect(erroDe({ ...ambienteValido, VAGAS_ESCOLA_LOTE: valor }).variaveis).toEqual(['VAGAS_ESCOLA_LOTE'])
  })

  it('com VAGAS_POR_ESCOLA_DESLIGADAS=true fora de produção, sobe sem teto por escola (controle negativo do cenário de carga)', () => {
    expect(loadConfig({ ...ambienteValido, VAGAS_POR_ESCOLA_DESLIGADAS: 'true' }).vagasPorEscolaDesligadas).toBe(true)
  })

  it('recusa subir com VAGAS_POR_ESCOLA_DESLIGADAS=true e AMBIENTE=producao: a flag de teste não vira porta aberta', () => {
    const erro = erroDe({ ...ambienteValido, AMBIENTE: 'producao', VAGAS_POR_ESCOLA_DESLIGADAS: 'true' })
    expect(erro.variaveis).toEqual(['VAGAS_POR_ESCOLA_DESLIGADAS'])
    expect(erro.motivos).toEqual([MOTIVO_VAGAS_DESLIGADAS_EM_PRODUCAO])
    expect(loadConfig({ ...ambienteValido, AMBIENTE: 'producao' })).not.toHaveProperty('vagasPorEscolaDesligadas')
  })

  it.each(Object.keys(ambienteValido))('não sobe sem %s', (variavel) => {
    expect(erroDe({ ...ambienteValido, [variavel]: undefined }).variaveis).toEqual([variavel])
  })

  it('aponta os problemas pelo nome, sem repetir a senha da URL', () => {
    const erro = erroDe({ ...ambienteValido, BANCO_URL: 'mysql://educa:senha_sintetica_xyz@postgres/educa', REDIS_FILA_URL: 'redis-fila:6379' })
    expect(erro.variaveis).toEqual(['BANCO_URL', 'REDIS_FILA_URL'])
    expect(erro.message).not.toContain('senha_sintetica_xyz')
  })
})
