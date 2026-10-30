import { describe, expect, it } from 'vitest'
import {
  InvalidConfigError,
  authEnvSchema,
  loadAuthConfig,
  isLoginProtectionDisabled,
  isEscolaConcurrencyLimitDisabled,
  MOTIVO_PROTECAO_DO_LOGIN_DESLIGADA_EM_PRODUCAO,
  MOTIVO_VAGAS_DESLIGADAS_EM_PRODUCAO,
} from './validar-config.js'

const CHAVE_SINTETICA = 'chave_sintetica_de_teste_com_32_caracteres'

const ambienteLocal = {
  AMBIENTE: 'local',
  IDENTIDADE_CHAVE_ASSINATURA: CHAVE_SINTETICA,
}

function erroDe(ambiente: Record<string, string | undefined>, ler: (ambiente: Record<string, string | undefined>) => unknown = loadAuthConfig): InvalidConfigError {
  try {
    ler(ambiente)
  } catch (erro) {
    if (erro instanceof InvalidConfigError) return erro
    throw erro
  }
  throw new Error('a configuração deveria ter sido recusada')
}

describe('lerConfiguracaoIdentidade', () => {
  it('devolve só o ambiente e a chave: não há emissor configurável', () => {
    const config = loadAuthConfig(ambienteLocal)
    expect(Object.keys(config).sort()).toEqual(['ambiente', 'chaveAssinatura'])
    expect(config.ambiente).toBe('local')
    expect(new TextDecoder().decode(config.chaveAssinatura)).toBe(CHAVE_SINTETICA)
  })

  it('sobe em produção com as mesmas variáveis: não sobrou flag de identidade que produção precise desligar', () => {
    expect(loadAuthConfig({ ...ambienteLocal, AMBIENTE: 'producao' }).ambiente).toBe('producao')
  })

  it('a variável ACEITAR_TOKEN_SINTETICO não existe mais: mandá-la não muda nada e não reprova o boot', () => {
    expect(Object.keys(authEnvSchema.shape).sort()).toEqual(['AMBIENTE', 'IDENTIDADE_CHAVE_ASSINATURA'])
    expect(loadAuthConfig({ ...ambienteLocal, ACEITAR_TOKEN_SINTETICO: 'true' })).toEqual(loadAuthConfig(ambienteLocal))
  })

  it.each(['prod', 'production', 'PRODUCAO', ''])('recusa AMBIENTE="%s": produção escrita de outro jeito não escapa da trava', (valor) => {
    expect(erroDe({ ...ambienteLocal, AMBIENTE: valor }).variaveis).toEqual(['AMBIENTE'])
  })

  it.each(Object.keys(ambienteLocal))('não sobe sem %s', (variavel) => {
    expect(erroDe({ ...ambienteLocal, [variavel]: undefined }).variaveis).toEqual([variavel])
  })

  it('recusa chave de assinatura curta, sem repetir a chave na mensagem', () => {
    const curta = 'chave_curta_sintetica'
    const erro = erroDe({ ...ambienteLocal, IDENTIDADE_CHAVE_ASSINATURA: curta })
    expect(erro.variaveis).toEqual(['IDENTIDADE_CHAVE_ASSINATURA'])
    expect(erro.message).not.toContain(curta)
    expect(JSON.stringify(erro.motivos)).not.toContain(curta)
  })
})

describe('lerVagasPorEscolaDesligadas (controle negativo do cenário de carga)', () => {
  const ambiente = { AMBIENTE: 'local', VAGAS_POR_ESCOLA_DESLIGADAS: 'false' }

  it('desligada por padrão do .env.example, e ligada só quando pedida escrita assim', () => {
    expect(isEscolaConcurrencyLimitDisabled(ambiente)).toBe(false)
    expect(isEscolaConcurrencyLimitDisabled({ ...ambiente, VAGAS_POR_ESCOLA_DESLIGADAS: 'true' })).toBe(true)
  })

  it('recusa AMBIENTE=producao com a vaga por escola desligada, apontando a flag e o motivo', () => {
    const erro = erroDe({ AMBIENTE: 'producao', VAGAS_POR_ESCOLA_DESLIGADAS: 'true' }, isEscolaConcurrencyLimitDisabled)
    expect(erro.variaveis).toEqual(['VAGAS_POR_ESCOLA_DESLIGADAS'])
    expect(erro.motivos).toEqual([MOTIVO_VAGAS_DESLIGADAS_EM_PRODUCAO])
  })

  it('aceita produção com a vaga por escola ligada', () => {
    expect(isEscolaConcurrencyLimitDisabled({ AMBIENTE: 'producao', VAGAS_POR_ESCOLA_DESLIGADAS: 'false' })).toBe(false)
  })

  it.each(['1', 'TRUE', 'sim', '', ' true'])('recusa VAGAS_POR_ESCOLA_DESLIGADAS="%s": ninguém desliga a justiça entre escolas sem querer', (valor) => {
    expect(erroDe({ ...ambiente, VAGAS_POR_ESCOLA_DESLIGADAS: valor }, isEscolaConcurrencyLimitDisabled).variaveis).toEqual(['VAGAS_POR_ESCOLA_DESLIGADAS'])
  })

  it.each(Object.keys(ambiente))('não sobe sem %s', (variavel) => {
    expect(erroDe({ ...ambiente, [variavel]: undefined }, isEscolaConcurrencyLimitDisabled).variaveis).toEqual([variavel])
  })
})

describe('lerProtecaoDoLoginDesligada (controle negativo do cenário "login às 7h30", tarefa 16.0)', () => {
  const ambiente = { AMBIENTE: 'local', LOGIN_PROTECAO_DESLIGADA: 'false' }

  it('desligada por padrão do .env.example, e ligada só quando pedida escrita assim', () => {
    expect(isLoginProtectionDisabled(ambiente)).toBe(false)
    expect(isLoginProtectionDisabled({ ...ambiente, LOGIN_PROTECAO_DESLIGADA: 'true' })).toBe(true)
  })

  it('permissão: recusa AMBIENTE=producao com a proteção do login desligada, apontando a flag e o motivo', () => {
    const erro = erroDe({ AMBIENTE: 'producao', LOGIN_PROTECAO_DESLIGADA: 'true' }, isLoginProtectionDisabled)
    expect(erro.variaveis).toEqual(['LOGIN_PROTECAO_DESLIGADA'])
    expect(erro.motivos).toEqual([MOTIVO_PROTECAO_DO_LOGIN_DESLIGADA_EM_PRODUCAO])
  })

  it('aceita produção com a proteção ligada', () => {
    expect(isLoginProtectionDisabled({ AMBIENTE: 'producao', LOGIN_PROTECAO_DESLIGADA: 'false' })).toBe(false)
  })

  it.each(['1', 'TRUE', 'sim', '', ' true'])('recusa LOGIN_PROTECAO_DESLIGADA="%s": ninguém desliga a proteção do login sem querer', (valor) => {
    expect(erroDe({ ...ambiente, LOGIN_PROTECAO_DESLIGADA: valor }, isLoginProtectionDisabled).variaveis).toEqual(['LOGIN_PROTECAO_DESLIGADA'])
  })

  it.each(Object.keys(ambiente))('não sobe sem %s', (variavel) => {
    expect(erroDe({ ...ambiente, [variavel]: undefined }, isLoginProtectionDisabled).variaveis).toEqual([variavel])
  })
})
