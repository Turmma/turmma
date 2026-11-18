import { describe, expect, it } from 'vitest'
import { lerAmbienteExemplo } from '../../../tools/ci/compose.ts'
import { InvalidConfigError, loadWorkerConfig, variavelDoPoolDaIa } from './worker-config.js'

/** O ambiente do `worker-ia` como o compose o monta: o exemplo da raiz e o que o serviço acrescenta (o banco, o pool de conexões e as três filas). */
const ambiente = (): Record<string, string | undefined> => ({
  ...lerAmbienteExemplo(),
  AMBIENTE: 'local',
  BANCO_URL: 'postgres://educa:senha_sintetica_xyz@postgres:5432/educa',
  BANCO_POOL_MAXIMO: '20',
  BANCO_TIMEOUT_CONEXAO_MS: '2000',
  BANCO_TIMEOUT_CONSULTA_MS: '1500',
  REDIS_FILA_URL: 'redis://redis-fila:6379',
  TELEMETRIA_OTLP_URL: 'http://observabilidade:4318/',
  TELEMETRIA_INTERVALO_MS: '5000',
  WORKER_IA_POOL_INTERATIVA: '50',
  WORKER_IA_POOL_FERRAMENTA: '20',
  WORKER_IA_POOL_NORMAL: '2',
  WORKER_IA_POOL_LOTE: '1',
  JANELA_LETIVA_FUSO: 'America/Sao_Paulo',
  JANELA_LETIVA_DIAS: '1,2,3,4,5',
  JANELA_LETIVA_INICIO: '07:00',
  JANELA_LETIVA_FIM: '18:00',
})

const erroDe = (valores: Record<string, string | undefined>): InvalidConfigError => {
  try {
    loadWorkerConfig({ ...ambiente(), ...valores })
  } catch (erro) {
    if (erro instanceof InvalidConfigError) return erro
    throw erro
  }
  throw new Error('a configuração devia ser recusada')
}

describe('a configuração do main-worker', () => {
  it('lê o pool de cada fila da IA pelo nome próprio, o endereço da fila e o pool de conexões da réplica', () => {
    const config = loadWorkerConfig(ambiente())
    expect(config.pools).toEqual({ interativa: 50, ferramenta: 20, normal: 2, lote: 1 })
    expect(config.janelaPadrao).toEqual({ fuso: 'America/Sao_Paulo', diasLetivos: [1, 2, 3, 4, 5], inicio: '07:00', fim: '18:00' })
    expect(config.redisFilaUrl).toBe('redis://redis-fila:6379')
    expect(config.banco.maximoConexoes).toBe(20)
    expect(config.ia.adaptador).toBe('falso')
    expect(config).not.toHaveProperty('vagasPorEscolaDesligadas')
    expect(['interativa', 'ferramenta', 'normal', 'lote'].map((fila) => variavelDoPoolDaIa(fila as 'interativa'))).toEqual(['WORKER_IA_POOL_INTERATIVA', 'WORKER_IA_POOL_FERRAMENTA', 'WORKER_IA_POOL_NORMAL', 'WORKER_IA_POOL_LOTE'])
  })

  it('cada parte que falta ou vem inválida é recusada pelo nome da variável, e todas saem de uma vez', () => {
    expect(erroDe({ REDIS_FILA_URL: undefined }).variaveis).toEqual(['REDIS_FILA_URL'])
    expect(erroDe({ REDIS_FILA_URL: 'http://redis' }).variaveis).toEqual(['REDIS_FILA_URL'])
    expect(erroDe({ BANCO_URL: undefined }).variaveis).toContain('BANCO_URL')
    expect(erroDe({ WORKER_IA_POOL_FERRAMENTA: undefined }).variaveis).toEqual(['WORKER_IA_POOL_FERRAMENTA'])
    expect(erroDe({ WORKER_IA_POOL_NORMAL: '0' }).variaveis).toEqual(['WORKER_IA_POOL_NORMAL'])
    expect(erroDe({ WORKER_IA_POOL_INTERATIVA: 'muitos' }).variaveis).toEqual(['WORKER_IA_POOL_INTERATIVA'])
    expect(erroDe({ WORKER_IA_POOL_LOTE: undefined }).variaveis).toEqual(['WORKER_IA_POOL_LOTE'])
    expect(erroDe({ JANELA_LETIVA_FIM: undefined }).variaveis).toContain('JANELA_LETIVA_FIM')
    expect(erroDe({ VAGAS_ESCOLA_FERRAMENTA: '0' }).variaveis).toContain('VAGAS_ESCOLA_FERRAMENTA')
    // Com a IA de produção válida (o adaptador falso também é recusado em produção), só a flag do cenário de carga barra o boot.
    const iaDeProducao = { AMBIENTE: 'producao', IA_ADAPTADOR: 'openai_compat', LLM_BASE_URL: 'https://api.provedor.example/v1', LLM_MODELO: 'modelo-de-teste', IA_PROVEDOR_ID: 'provedor-de-teste', LLM_PROCESSAMENTO_LOCAL: 'false' }
    expect(erroDe({ ...iaDeProducao, VAGAS_POR_ESCOLA_DESLIGADAS: 'true' }).variaveis).toEqual(['VAGAS_POR_ESCOLA_DESLIGADAS'])
    expect(erroDe({ IA_ADAPTADOR: 'inexistente' }).variaveis).toContain('IA_ADAPTADOR')
    expect(erroDe({ TELEMETRIA_INTERVALO_MS: 'sempre' }).variaveis).toContain('TELEMETRIA_INTERVALO_MS')
    expect(erroDe({ REDIS_FILA_URL: undefined, WORKER_IA_POOL_NORMAL: '0', BANCO_URL: undefined }).variaveis).toEqual(expect.arrayContaining(['REDIS_FILA_URL', 'WORKER_IA_POOL_NORMAL', 'BANCO_URL']))
  })

  it('o controle negativo do cenário de carga liga a flag, e só fora da produção', () => {
    expect(loadWorkerConfig({ ...ambiente(), VAGAS_POR_ESCOLA_DESLIGADAS: 'true' }).vagasPorEscolaDesligadas).toBe(true)
  })
})
