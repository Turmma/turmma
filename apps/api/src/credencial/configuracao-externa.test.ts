import { InvalidConfigError, PROVEDORES_EXTERNOS } from '@educa/core'
import { PROVEDORES_DE_CONTA_DA_ESCOLA } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { lerConfiguracaoLoginExterno, MOTIVO_CHAVE_DO_COOKIE, MOTIVO_EMISSOR_SEM_TLS, MOTIVO_PROVEDOR_INCOMPLETO, MOTIVO_RETORNO } from './configuracao-externa.js'

const CHAVE_DO_COOKIE_SINTETICA = 'chave-sintetica-do-cookie-do-login-externo-de-teste'

const GOOGLE_LOCAL = {
  LOGIN_EXTERNO_GOOGLE_EMISSOR: 'http://oidc-falso:8080/google',
  LOGIN_EXTERNO_GOOGLE_CLIENTE: 'cliente-sintetico',
  LOGIN_EXTERNO_GOOGLE_SEGREDO: 'segredo-sintetico-de-teste',
}

const BASE = {
  AMBIENTE: 'local',
  LOGIN_EXTERNO_RETORNO_URL: 'http://127.0.0.1:58080/v1/sessao/externa/retorno',
  LOGIN_EXTERNO_CHAVE_COOKIE: CHAVE_DO_COOKIE_SINTETICA,
}

function erroDe(ambiente: Record<string, string>): InvalidConfigError {
  try {
    lerConfiguracaoLoginExterno(ambiente)
  } catch (erro) {
    if (erro instanceof InvalidConfigError) return erro
    throw erro
  }
  throw new Error('a configuração deveria ter sido recusada')
}

describe('configuração do login pela conta da escola', () => {
  it('a lista de provedores do banco (nucleo) e a do contrato (shared) são a mesma, na mesma ordem', () => {
    expect([...PROVEDORES_EXTERNOS]).toEqual([...PROVEDORES_DE_CONTA_DA_ESCOLA])
  })

  it('sem variável de provedor, fica desligado, e nem retorno nem chave são exigidos (o compose sobe sem conta externa)', () => {
    const configuracao = lerConfiguracaoLoginExterno({ AMBIENTE: 'producao' })
    expect(configuracao.provedores.size).toBe(0)
    expect(configuracao.retorno).toBeUndefined()
    expect(configuracao.chaveDoCookie).toBeUndefined()
  })

  it('com as três variáveis de um provedor, liga só ele, com a chave do cookie de 256 bits', () => {
    const configuracao = lerConfiguracaoLoginExterno({ ...BASE, ...GOOGLE_LOCAL })
    expect([...configuracao.provedores.keys()]).toEqual(['google'])
    expect(configuracao.provedores.get('google')?.emissor.href).toBe('http://oidc-falso:8080/google')
    expect(configuracao.chaveDoCookie?.length).toBe(32)
    expect(configuracao.aceitaEmissorSemTls).toBe(true)
  })

  it('provedor meio preenchido não sobe, e a mensagem cita só os nomes', () => {
    const erro = erroDe({ ...BASE, LOGIN_EXTERNO_MICROSOFT_EMISSOR: 'https://login.microsoftonline.com/organizations/v2.0' })
    expect(erro.variaveis).toEqual(['LOGIN_EXTERNO_MICROSOFT_CLIENTE', 'LOGIN_EXTERNO_MICROSOFT_EMISSOR', 'LOGIN_EXTERNO_MICROSOFT_SEGREDO'])
    expect(erro.motivos).toContain(MOTIVO_PROVEDOR_INCOMPLETO)
    expect(erro.message).not.toContain('login.microsoftonline.com')
  })

  it('fora do local, emissor e retorno em http não sobem', () => {
    const erro = erroDe({ ...BASE, ...GOOGLE_LOCAL, AMBIENTE: 'staging' })
    expect(erro.variaveis).toEqual(['LOGIN_EXTERNO_GOOGLE_EMISSOR'])
    expect(erro.motivos).toContain(MOTIVO_EMISSOR_SEM_TLS)
    const retorno = erroDe({ ...BASE, ...GOOGLE_LOCAL, LOGIN_EXTERNO_GOOGLE_EMISSOR: 'https://accounts.google.com', AMBIENTE: 'staging' })
    expect(retorno.variaveis).toEqual(['LOGIN_EXTERNO_RETORNO_URL'])
  })

  it('o retorno precisa ser o endereço da rota de retorno, sem query', () => {
    for (const valor of ['http://127.0.0.1:58080/', 'http://127.0.0.1:58080/v1/sessao/externa/retorno?x=1', 'não é url']) {
      const erro = erroDe({ ...BASE, ...GOOGLE_LOCAL, LOGIN_EXTERNO_RETORNO_URL: valor })
      expect(erro.variaveis, valor).toEqual(['LOGIN_EXTERNO_RETORNO_URL'])
      expect(erro.motivos, valor).toContain(MOTIVO_RETORNO)
    }
  })

  it('a chave do cookie é obrigatória, longa, e não repete outra chave do sistema', () => {
    expect(erroDe({ ...BASE, ...GOOGLE_LOCAL, LOGIN_EXTERNO_CHAVE_COOKIE: 'curta' }).motivos).toContain(MOTIVO_CHAVE_DO_COOKIE)
    for (const outra of ['IDENTIDADE_CHAVE_ASSINATURA', 'LOGIN_CHAVE_CONTADOR', 'LOGIN_CHAVE_DISPOSITIVO_V1', 'IDENTIDADE_CHAVE_CIFRA_V2', 'IDENTIDADE_CHAVE_RECUPERACAO']) {
      const erro = erroDe({ ...BASE, ...GOOGLE_LOCAL, [outra]: CHAVE_DO_COOKIE_SINTETICA })
      expect(erro.variaveis, outra).toEqual(['LOGIN_EXTERNO_CHAVE_COOKIE'])
    }
  })
})
