import { describe, expect, it } from 'vitest'
import { MOTIVO_VAGAS_DESLIGADAS_EM_PRODUCAO } from '@educa/core'
import { InvalidConfigError, loadConfig } from './config.js'

const storageValido = {
  STORAGE_URL: 'http://storage:8333',
  STORAGE_REGIAO: 'us-east-1',
  STORAGE_BUCKET: 'educa-local',
  STORAGE_CHAVE_ACESSO: 'chave_sintetica',
  STORAGE_CHAVE_SECRETA: 'segredo_sintetico_xyz',
}

/** O e-mail do convite (acesso-e-convites, tarefa 1.0): só a chave e o endereço da web são obrigatórios; o adaptador padrão é o falso. */
const emailValido = {
  EMAIL_TOKEN_KEY: 'chave-sintetica-do-email-com-32-caracteres',
  EMAIL_URL_DA_WEB: 'http://web.teste:8080/',
}

/** O e-mail que o worker aceita em produção: SMTP de provedor contratado, com TLS e o id do suboperador. */
const emailDeProducao = { EMAIL_ADAPTADOR: 'smtp', EMAIL_SMTP_HOST: 'smtp.provedor.example', EMAIL_SMTP_TLS: 'true', EMAIL_PROVEDOR_ID: 'provedor-sintetico' }

const ambienteValido = {
  ...storageValido,
  ...emailValido,
  AMBIENTE: 'local',
  VAGAS_POR_ESCOLA_DESLIGADAS: 'false',
  WORKER_THREADS_MAXIMO: '2',
  BANCO_URL: 'postgres://educa:senha_sintetica_xyz@postgres:5432/educa',
  BANCO_POOL_MAXIMO: '80',
  BANCO_TIMEOUT_CONEXAO_MS: '2000',
  BANCO_TIMEOUT_CONSULTA_MS: '2000',
  REDIS_FILA_URL: 'redis://redis-fila:6379',
  FILAS: 'interativa,normal',
  WORKER_POOL_INTERATIVA: '50',
  WORKER_POOL_NORMAL: '30',
  VAGAS_ESCOLA_INTERATIVA: '5',
  VAGAS_ESCOLA_NORMAL: '5',
  VAGAS_ESCOLA_LOTE: '2',
  VAGAS_ESCOLA_PDF: '2',
  TELEMETRIA_OTLP_URL: 'http://observabilidade:4318/',
  TELEMETRIA_INTERVALO_MS: '5000',
}

/** A réplica que atende só a fila interativa: a única que não toca o storage. */
const soInterativa = { FILAS: 'interativa' }

/** O horário letivo padrão, que só o worker-lote lê (F3, tarefa 3.0): o expurgo da escola para quando ele abre. */
const janelaValida = {
  JANELA_LETIVA_FUSO: 'America/Sao_Paulo',
  JANELA_LETIVA_DIAS: '1,2,3,4,5',
  JANELA_LETIVA_INICIO: '07:00',
  JANELA_LETIVA_FIM: '18:00',
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

describe('lerConfiguracao do worker', () => {
  it('converte o ambiente: só as filas de FILAS, cada uma com o próprio pool', () => {
    const { email, ...configuracao } = loadConfig(ambienteValido)
    expect(email).toMatchObject({ adaptador: 'falso', urlDaWeb: 'http://web.teste:8080' })
    expect(configuracao).toEqual({
      banco: { url: ambienteValido.BANCO_URL, maximoConexoes: 80, timeoutConexaoMs: 2000, timeoutConsultaMs: 2000 },
      redisFilaUrl: 'redis://redis-fila:6379',
      pools: { interativa: 50, normal: 30 },
      vagasPadrao: { interativa: 5, normal: 5, lote: 2, pdf: 2 },
      threadsMaximo: 2,
      telemetria: { otlpUrl: 'http://observabilidade:4318', intervaloMs: 5000 },
      storage: { url: 'http://storage:8333', regiao: 'us-east-1', bucket: 'educa-local', chaveAcesso: 'chave_sintetica', chaveSecreta: 'segredo_sintetico_xyz' },
    })
  })

  it.each(Object.keys(emailValido))('quem atende a fila normal não sobe sem %s: o e-mail do convite sai dela (acesso-e-convites, tarefa 1.0)', (variavel) => {
    expect(erroDe({ ...ambienteValido, [variavel]: undefined }).variaveis).toEqual([variavel])
  })

  it('quem atende só a interativa ou só o lote sobe sem nenhuma variável do e-mail, e a configuração não a leva', () => {
    const semEmail = Object.fromEntries(Object.keys(emailValido).map((variavel) => [variavel, undefined]))
    expect(loadConfig({ ...ambienteValido, ...semEmail, ...soInterativa })).not.toHaveProperty('email')
    // Com as variáveis do e-mail presentes, a réplica que não manda e-mail também não as lê.
    expect(loadConfig({ ...ambienteValido, ...soInterativa })).not.toHaveProperty('email')
    expect(loadConfig({ ...ambienteValido, ...semEmail, ...janelaValida, FILAS: 'lote', WORKER_POOL_LOTE: '10' })).not.toHaveProperty('email')
  })

  it('o worker da fila normal recusa a partida com o e-mail falso em produção, e a mensagem cita só a variável', () => {
    const erro = erroDe({ ...ambienteValido, AMBIENTE: 'producao', EMAIL_ADAPTADOR: 'falso' })
    expect(erro.variaveis).toEqual(['EMAIL_ADAPTADOR'])
    expect(erro.message).not.toContain(emailValido.EMAIL_TOKEN_KEY)
  })

  it('o worker-lote atende só o lote, e o pool de outra fila no ambiente não liga a fila', () => {
    const lote = { ...ambienteValido, ...storageValido, ...janelaValida, FILAS: 'lote', WORKER_POOL_LOTE: '10' }
    expect(loadConfig(lote).pools).toEqual({ lote: 10 })
  })

  it('o worker-pdf atende só a fila `pdf`, com o pool de um PDF por vez, e lê o storage: o PDF sai dele e o objeto é apagado (ingestao-do-material, tarefa 1.0)', () => {
    const pdf = { ...ambienteValido, FILAS: 'pdf', WORKER_POOL_PDF: '1' }
    expect(loadConfig(pdf).pools).toEqual({ pdf: 1 })
    expect(loadConfig(pdf).vagasPadrao.pdf).toBe(2)
    expect(loadConfig(pdf).storage).toEqual(loadConfig(ambienteValido).storage)
    // Sem e-mail e sem horário letivo: a réplica do PDF não manda e-mail nem expurga.
    expect(loadConfig(pdf)).not.toHaveProperty('email')
    expect(loadConfig(pdf).janelaPadrao).toBeUndefined()
  })

  it.each(Object.keys(storageValido))('o worker-pdf não sobe sem %s: sem o storage ele não leria nem apagaria o PDF', (variavel) => {
    expect(erroDe({ ...ambienteValido, FILAS: 'pdf', WORKER_POOL_PDF: '1', [variavel]: undefined }).variaveis).toEqual([variavel])
  })

  it('o worker-pdf não sobe sem o pool da fila, e o pool não é de outra fila', () => {
    expect(erroDe({ ...ambienteValido, FILAS: 'pdf' }).variaveis).toEqual(['WORKER_POOL_PDF'])
  })

  it.each(['0', '-2', '1.5', 'duas'])('não sobe com VAGAS_ESCOLA_PDF=%s: vaga zero pararia o PDF de toda escola sem configuração própria', (valor) => {
    expect(erroDe({ ...ambienteValido, VAGAS_ESCOLA_PDF: valor }).variaveis).toEqual(['VAGAS_ESCOLA_PDF'])
  })

  it('quem atende o lote (a consolidação mede os bytes, o expurgo apaga o arquivo) ou a fila normal (monta o arquivo do titular) lê o storage; quem atende só a interativa, não', () => {
    const lote = { ...ambienteValido, ...storageValido, ...janelaValida, FILAS: 'lote', WORKER_POOL_LOTE: '10' }
    expect(loadConfig(lote).storage).toEqual({
      url: 'http://storage:8333',
      regiao: 'us-east-1',
      bucket: 'educa-local',
      chaveAcesso: 'chave_sintetica',
      chaveSecreta: 'segredo_sintetico_xyz',
    })
    expect(loadConfig(ambienteValido).storage).toEqual(loadConfig(lote).storage)
    expect(loadConfig({ ...ambienteValido, ...soInterativa }).storage).toBeUndefined()
  })

  it.each(Object.keys(storageValido))('quem atende a fila normal não sobe sem %s: o arquivo do titular é gravado no storage (F3, tarefa 13.0)', (variavel) => {
    expect(erroDe({ ...ambienteValido, [variavel]: undefined }).variaveis).toEqual([variavel])
  })

  it('quem atende só a interativa sobe sem nenhuma variável do storage', () => {
    const semStorage = Object.fromEntries(Object.keys(storageValido).map((variavel) => [variavel, undefined]))
    expect(loadConfig({ ...ambienteValido, ...semStorage, ...soInterativa })).toMatchObject({ pools: { interativa: 50 } })
  })

  it('o worker-lote lê o horário letivo padrão, que o expurgo da escola confere a cada lote; o worker-interativo não', () => {
    const lote = { ...ambienteValido, ...storageValido, ...janelaValida, FILAS: 'lote', WORKER_POOL_LOTE: '10' }
    expect(loadConfig(lote).janelaPadrao).toEqual({ fuso: 'America/Sao_Paulo', diasLetivos: [1, 2, 3, 4, 5], inicio: '07:00', fim: '18:00' })
    expect(loadConfig(ambienteValido).janelaPadrao).toBeUndefined()
  })

  it.each(Object.keys(janelaValida))('o worker-lote não sobe sem %s', (variavel) => {
    const lote = { ...ambienteValido, ...storageValido, ...janelaValida, FILAS: 'lote', WORKER_POOL_LOTE: '10', [variavel]: undefined }
    expect(erroDe(lote).variaveis).toEqual([variavel])
  })

  it.each(Object.keys(storageValido))('o worker-lote não sobe sem %s', (variavel) => {
    const lote = { ...ambienteValido, ...storageValido, ...janelaValida, FILAS: 'lote', WORKER_POOL_LOTE: '10', [variavel]: undefined }
    expect(erroDe(lote).variaveis).toEqual([variavel])
  })

  it('a mensagem do storage inválido cita só a variável, nunca o segredo', () => {
    const erro = erroDe({ ...ambienteValido, ...storageValido, ...janelaValida, FILAS: 'lote', WORKER_POOL_LOTE: '10', STORAGE_URL: 'storage:8333', STORAGE_CHAVE_SECRETA: '' })
    expect(erro.variaveis).toEqual(['STORAGE_CHAVE_SECRETA', 'STORAGE_URL'])
    expect(erro.message).not.toContain(storageValido.STORAGE_CHAVE_SECRETA)
  })

  it.each(Object.keys(ambienteValido))('não sobe sem %s', (variavel) => {
    expect(erroDe({ ...ambienteValido, [variavel]: undefined }).variaveis).toContain(variavel)
  })

  it.each(['0', '-1', '1.5', 'todas'])('não sobe com WORKER_THREADS_MAXIMO=%s: o sandbox de CPU precisa de um teto inteiro', (valor) => {
    expect(erroDe({ ...ambienteValido, WORKER_THREADS_MAXIMO: valor }).variaveis).toEqual(['WORKER_THREADS_MAXIMO'])
  })

  it('com VAGAS_POR_ESCOLA_DESLIGADAS=true fora de produção, sobe sem teto por escola (controle negativo do cenário de carga)', () => {
    expect(loadConfig({ ...ambienteValido, VAGAS_POR_ESCOLA_DESLIGADAS: 'true' }).vagasPorEscolaDesligadas).toBe(true)
    expect(loadConfig(ambienteValido)).not.toHaveProperty('vagasPorEscolaDesligadas')
  })

  it('recusa subir com VAGAS_POR_ESCOLA_DESLIGADAS=true e AMBIENTE=producao: a flag de teste não vira porta aberta', () => {
    const erro = erroDe({ ...ambienteValido, ...emailDeProducao, AMBIENTE: 'producao', VAGAS_POR_ESCOLA_DESLIGADAS: 'true' })
    expect(erro.variaveis).toEqual(['VAGAS_POR_ESCOLA_DESLIGADAS'])
    expect(erro.motivos).toEqual([MOTIVO_VAGAS_DESLIGADAS_EM_PRODUCAO])
  })

  it('não sobe sem o pool de uma fila que atende', () => {
    expect(erroDe({ ...ambienteValido, ...storageValido, ...janelaValida, FILAS: 'interativa,normal,lote' }).variaveis).toEqual(['WORKER_POOL_LOTE'])
  })

  it.each(['', 'interativa,prioritaria', 'interativa,interativa', 'INTERATIVA'])('não sobe com FILAS=%j', (valor) => {
    expect(erroDe({ ...ambienteValido, FILAS: valor }).variaveis).toEqual(['FILAS'])
  })

  it.each(['0', '-1', '2.5', 'muitos'])('não sobe com WORKER_POOL_INTERATIVA=%s', (valor) => {
    expect(erroDe({ ...ambienteValido, WORKER_POOL_INTERATIVA: valor }).variaveis).toEqual(['WORKER_POOL_INTERATIVA'])
  })
})
