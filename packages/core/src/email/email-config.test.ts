import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'
import { describe, expect, it } from 'vitest'
import { InvalidConfigError } from '../config/validate-config.js'
import {
  BYTES_DA_CHAVE_DO_TOKEN_DE_EMAIL,
  loadEmailConfig,
  MOTIVO_EMAIL_FALSO_EM_PRODUCAO,
  MOTIVO_EMAIL_NO_MAILPIT,
  MOTIVO_EMAIL_SEM_PROVEDOR_ID,
  MOTIVO_EMAIL_SEM_SERVIDOR,
  MOTIVO_EMAIL_SEM_TLS,
} from './email-config.js'

const CHAVE = 'chave-sintetica-do-email-com-32-caracteres'
const BASE = { AMBIENTE: 'local', EMAIL_TOKEN_KEY: CHAVE, EMAIL_URL_DA_WEB: 'https://app.turmma.example' }
/** O SMTP de um provedor contratado, tudo no lugar: o teste que prova uma exigência tira só ela. */
const PRODUCAO = {
  ...BASE,
  AMBIENTE: 'producao',
  EMAIL_ADAPTADOR: 'smtp',
  EMAIL_SMTP_HOST: 'smtp.provedor.example',
  EMAIL_SMTP_TLS: 'true',
  EMAIL_PROVEDOR_ID: 'provedor-sintetico',
}

function erroDe(ambiente: Record<string, string | undefined>): InvalidConfigError {
  try {
    loadEmailConfig(ambiente)
  } catch (erro) {
    if (erro instanceof InvalidConfigError) return erro
    throw erro
  }
  throw new Error('a configuração deveria ter sido recusada')
}

describe('loadEmailConfig', () => {
  it('só a chave e o endereço da web são obrigatórios: sem o resto, sobe com o adaptador falso e o endereço sem barra no fim', () => {
    const config = loadEmailConfig({ ...BASE, EMAIL_URL_DA_WEB: 'https://app.turmma.example/' })
    expect(config).toMatchObject({ adaptador: 'falso', urlDaWeb: 'https://app.turmma.example' })
    expect(config).not.toHaveProperty('smtp')
    expect(config.chaveDoToken).toHaveLength(BYTES_DA_CHAVE_DO_TOKEN_DE_EMAIL)
  })

  it('o teto de mensagens por minuto é o 60 de partida, vale o da variável, e zero, fração ou texto são recusados (também vazio vale o de partida)', () => {
    expect(loadEmailConfig(BASE).porMinuto).toBe(60)
    expect(loadEmailConfig({ ...BASE, EMAIL_POR_MINUTO: '' }).porMinuto).toBe(60)
    expect(loadEmailConfig({ ...BASE, EMAIL_POR_MINUTO: '240' }).porMinuto).toBe(240)
    for (const invalido of ['0', '-3', '1.5', 'muitos', '100001']) expect(erroDe({ ...BASE, EMAIL_POR_MINUTO: invalido }).variaveis, invalido).toEqual(['EMAIL_POR_MINUTO'])
  })

  it.each(['EMAIL_TOKEN_KEY', 'EMAIL_URL_DA_WEB'])('não sobe sem %s, nem com ela vazia', (variavel) => {
    expect(erroDe({ ...BASE, [variavel]: undefined }).variaveis).toEqual([variavel])
    expect(erroDe({ ...BASE, [variavel]: '' }).variaveis).toEqual([variavel])
  })

  it('a chave de menos de 32 caracteres e o endereço que não é http(s) não sobem, citando só a variável', () => {
    const curta = erroDe({ ...BASE, EMAIL_TOKEN_KEY: 'curta' })
    expect(curta.variaveis).toEqual(['EMAIL_TOKEN_KEY'])
    expect(curta.message).not.toContain('curta')
    expect(erroDe({ ...BASE, EMAIL_URL_DA_WEB: 'ftp://app.turmma.example' }).variaveis).toEqual(['EMAIL_URL_DA_WEB'])
  })

  it('a chave AES sai do HKDF do texto: 32 bytes, a mesma para o mesmo texto e outra para outro', () => {
    const a = loadEmailConfig(BASE).chaveDoToken
    expect(loadEmailConfig(BASE).chaveDoToken).toEqual(a)
    expect(loadEmailConfig({ ...BASE, EMAIL_TOKEN_KEY: `${CHAVE}-outra` }).chaveDoToken).not.toEqual(a)
    expect(Buffer.from(a).includes(Buffer.from(CHAVE))).toBe(false)
    // Resposta conhecida: o HKDF-SHA256 do texto com o rótulo `educa.email.token.aes-256-gcm`. Trocar o rótulo troca a chave, e o convite na fila deixa de decifrar.
    expect(Buffer.from(a).toString('hex')).toBe('b66ce5283a05659a03788c560556c008fb9c3b61eea528c3af6eed54116b9e22')
  })

  it('o SMTP do desenvolvimento: porta 587 e sem TLS por padrão, com o remetente e as credenciais só quando as duas vêm', () => {
    const mailpit = { ...BASE, EMAIL_ADAPTADOR: 'smtp', EMAIL_SMTP_HOST: 'mailpit', EMAIL_SMTP_PORTA: '1025' }
    expect(loadEmailConfig(mailpit).smtp).toEqual({ host: 'mailpit', porta: 1025, tls: false, remetente: 'Turmma <nao-responda@turmma.invalid>' })
    expect(loadEmailConfig({ ...mailpit, EMAIL_SMTP_PORTA: undefined }).smtp?.porta).toBe(587)
    expect(loadEmailConfig({ ...mailpit, EMAIL_SMTP_USUARIO: 'conta' }).smtp).not.toHaveProperty('usuario')
    expect(loadEmailConfig({ ...mailpit, EMAIL_SMTP_USUARIO: 'conta', EMAIL_SMTP_SENHA: 'senha-sintetica' }).smtp).toMatchObject({ usuario: 'conta', senha: 'senha-sintetica' })
  })

  it('o adaptador falso ignora o servidor SMTP que o ambiente traga: a configuração não leva `smtp`', () => {
    expect(loadEmailConfig({ ...BASE, EMAIL_ADAPTADOR: 'falso', EMAIL_SMTP_HOST: 'mailpit' })).not.toHaveProperty('smtp')
  })

  it('smtp sem EMAIL_SMTP_HOST não sobe, em qualquer ambiente', () => {
    expect(erroDe({ ...BASE, EMAIL_ADAPTADOR: 'smtp' })).toMatchObject({ variaveis: ['EMAIL_SMTP_HOST'], motivos: [MOTIVO_EMAIL_SEM_SERVIDOR] })
    expect(erroDe({ ...PRODUCAO, EMAIL_SMTP_HOST: undefined })).toMatchObject({ variaveis: ['EMAIL_SMTP_HOST'], motivos: [MOTIVO_EMAIL_SEM_SERVIDOR] })
  })

  it('fora do ambiente local, sem EMAIL_PROVEDOR_ID a partida é recusada, também com a variável vazia', () => {
    expect(loadEmailConfig(PRODUCAO).provedorId).toBe('provedor-sintetico')
    expect(erroDe({ ...PRODUCAO, EMAIL_PROVEDOR_ID: undefined })).toMatchObject({ variaveis: ['EMAIL_PROVEDOR_ID'], motivos: [MOTIVO_EMAIL_SEM_PROVEDOR_ID] })
    expect(erroDe({ ...PRODUCAO, EMAIL_PROVEDOR_ID: '' })).toMatchObject({ variaveis: ['EMAIL_PROVEDOR_ID'], motivos: [MOTIVO_EMAIL_SEM_PROVEDOR_ID] })
    expect(erroDe({ ...PRODUCAO, AMBIENTE: 'staging', EMAIL_PROVEDOR_ID: undefined }).variaveis).toEqual(['EMAIL_PROVEDOR_ID'])
  })

  it('fora do ambiente local, sem TLS a partida é recusada, com o EMAIL_SMTP_TLS ausente, vazio ou false', () => {
    expect(loadEmailConfig(PRODUCAO).smtp?.tls).toBe(true)
    for (const valor of [undefined, '', 'false']) {
      expect(erroDe({ ...PRODUCAO, EMAIL_SMTP_TLS: valor }), String(valor)).toMatchObject({ variaveis: ['EMAIL_SMTP_TLS'], motivos: [MOTIVO_EMAIL_SEM_TLS] })
    }
  })

  it('fora do ambiente local, o host do Mailpit (ou de qualquer endereço da nossa rede) é recusado', () => {
    for (const host of ['mailpit', 'localhost', '127.0.0.1', '10.0.0.5', 'host.docker.internal']) {
      expect(erroDe({ ...PRODUCAO, EMAIL_SMTP_HOST: host }), host).toMatchObject({ variaveis: ['EMAIL_SMTP_HOST'], motivos: [MOTIVO_EMAIL_NO_MAILPIT] })
    }
    expect(loadEmailConfig({ ...PRODUCAO, EMAIL_SMTP_HOST: '8.8.8.8' }).smtp?.host).toBe('8.8.8.8')
    expect(loadEmailConfig({ ...PRODUCAO, EMAIL_SMTP_HOST: '10.provedor.example' }).smtp?.host).toBe('10.provedor.example')
  })

  it('as três exigências valem juntas, e o ambiente local dispensa as três com o Mailpit', () => {
    const erro = erroDe({ ...PRODUCAO, EMAIL_SMTP_HOST: 'mailpit', EMAIL_SMTP_TLS: 'false', EMAIL_PROVEDOR_ID: undefined })
    expect(erro.variaveis).toEqual(['EMAIL_PROVEDOR_ID', 'EMAIL_SMTP_HOST', 'EMAIL_SMTP_TLS'])
    expect(erro.motivos).toEqual([MOTIVO_EMAIL_SEM_PROVEDOR_ID, MOTIVO_EMAIL_SEM_TLS, MOTIVO_EMAIL_NO_MAILPIT])
    expect(loadEmailConfig({ ...BASE, EMAIL_ADAPTADOR: 'smtp', EMAIL_SMTP_HOST: 'mailpit' }).smtp?.host).toBe('mailpit')
  })

  it('o adaptador falso é recusado em produção, e vale em staging e em local', () => {
    expect(erroDe({ ...BASE, AMBIENTE: 'producao' })).toMatchObject({ variaveis: ['EMAIL_ADAPTADOR'], motivos: [MOTIVO_EMAIL_FALSO_EM_PRODUCAO] })
    expect(loadEmailConfig({ ...BASE, AMBIENTE: 'staging' }).adaptador).toBe('falso')
    expect(loadEmailConfig(BASE).adaptador).toBe('falso')
    // Em produção o SMTP do provedor contratado sobe, com o id do suboperador na configuração.
    expect(loadEmailConfig(PRODUCAO)).toMatchObject({ adaptador: 'smtp', provedorId: 'provedor-sintetico', smtp: { host: 'smtp.provedor.example', tls: true } })
  })

  it('o .env.example e o de teste já são uma configuração válida: o Mailpit do compose, sem TLS, em AMBIENTE=local', () => {
    const raiz = fileURLToPath(new URL('../../../../', import.meta.url))
    const exemplo = parseEnv(readFileSync(`${raiz}.env.example`, 'utf8'))
    const teste = { ...exemplo, ...parseEnv(readFileSync(`${raiz}infra/teste.env`, 'utf8')) }
    expect(loadEmailConfig(exemplo)).toMatchObject({ adaptador: 'smtp', porMinuto: 60, smtp: { host: 'mailpit', porta: 1025, tls: false }, urlDaWeb: exemplo['EMAIL_URL_DA_WEB'] })
    expect(loadEmailConfig(teste).urlDaWeb).toBe(teste['EMAIL_URL_DA_WEB'])
  })
})
