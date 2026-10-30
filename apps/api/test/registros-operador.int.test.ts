import 'reflect-metadata'
import { METRICS, type Database } from '@educa/nucleo'
import { ErrorCode, aceitarConviteDeOperadorResponseSchema, entradaDeOperadorResponseSchema } from '@educa/shared'
import type { INestApplication } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { BANCO } from '../src/banco.module.js'
import { COOKIE_SESSAO_DE_OPERADOR } from '../src/operacao/cookie-de-operador.js'
import { criarOperador, desativarOperador, gerarConviteDeOperador } from '../src/ops/operador.js'
import { codigoDoPasso, configurar, doIp, entrar, esperarErro, ipSorteado, passoAtual, pedir, subir, valorDoCookie } from './segundo-fator-de-operador.js'
import { BancadaDeOperadores } from './sessao-de-operador.js'

const SENHA = 'senha-do-operador-dos-registros-1'

interface Acesso {
  readonly operadorId: string | null
  readonly evento: string
  readonly ip: string
}

interface Auditoria {
  readonly autor: string
  readonly acao: string
}

/**
 * C37 (Tech Spec da A0, seções 3 e 5): a entrada, a falha de entrada e a saída vão para `acesso_operacao`, com o IP; a
 * criação, a desativação, o segundo fator configurado e o convite gerado e revogado vão para `auditoria_operacao`, com
 * o autor do comando no comando e o operador da sessão no segundo fator.
 */
describe('registros da operação: acesso e auditoria (C37, tarefa 8.0)', () => {
  const operadores = new BancadaDeOperadores()
  const medidor = new MedidorDeTeste()
  /** Os operadores que o `criar` deste arquivo fez, fora da bancada: apagados no fim, com o que aponta para eles. */
  const criadosAqui: string[] = []
  let app: INestApplication
  let url: string
  let banco: Database
  let autor: string

  beforeAll(async () => {
    ;({ app, url } = await subir(undefined, undefined, medidor.medidor))
    banco = app.get<Database>(BANCO)
    autor = (await operadores.operador()).apelido
  })

  afterAll(async () => {
    await app.close()
    for (const tabela of ['auditoria_operacao where operador_alvo_id', 'acesso_operacao where operador_id', 'sessao_operador where operador_id', 'convite_operador where operador_id', 'codigo_recuperacao_operador where operador_id', 'operador where id']) {
      await operadores.pool.query(`delete from ${tabela} = any($1::uuid[])`, [criadosAqui])
    }
    await operadores.fechar()
    await medidor.encerrar()
  })

  async function acessosDoIp(ip: string): Promise<Acesso[]> {
    const { rows } = await operadores.pool.query<Acesso>(`select operador_id as "operadorId", evento, host(ip) as ip from acesso_operacao where ip = $1::inet order by em, id`, [ip])
    return rows
  }

  async function auditoriaDe(operadorId: string): Promise<Auditoria[]> {
    const { rows } = await operadores.pool.query<Auditoria>('select autor, acao from auditoria_operacao where operador_alvo_id = $1 order by em, id', [operadorId])
    return rows
  }

  const falhasNaMetrica = async () => (await medidor.pontos(METRICS.entradaFalhaDaOperacao)).reduce((soma, ponto) => soma + (typeof ponto.valor === 'number' ? ponto.valor : 0), 0)

  it('pela API: a entrada grava `entrada` com operador e IP; o primeiro código grava `operador.mfa_configurado` com o próprio operador como autor, uma vez só; a saída grava `saida` com o IP', async () => {
    const { operadorId, apelido } = await operadores.operador()
    // Dois convites pelo comando: o segundo revoga o primeiro.
    await gerarConviteDeOperador(banco, autor, apelido)
    const [ipDoAceite, ipDaEntrada, ipDaSegunda, ipDaSaida] = [ipSorteado(), ipSorteado(), ipSorteado(), ipSorteado()]
    const token = (await gerarConviteDeOperador(banco, autor, apelido)).token
    const aceite = aceitarConviteDeOperadorResponseSchema.parse((await pedir(url, 'POST', '/v1/operacao/convite/aceitar', { token, senha: SENHA }, doIp(ipDoAceite))).corpo)
    const { corpo: configurado } = await configurar(url, aceite.desafio)
    if (configurado === undefined) throw new Error('configurar recusado')
    // O configurar sozinho não é "segundo fator configurado": nada fica ativo, e nada é auditado.
    expect((await auditoriaDe(operadorId)).map((linha) => linha.acao)).not.toContain('operador.mfa_configurado')

    const primeira = await entrar(url, { desafio: configurado.desafio, codigo: codigoDoPasso(configurado.segredo, passoAtual()) }, doIp(ipDaEntrada))
    expect(primeira.status).toBe(200)
    expect(await acessosDoIp(ipDaEntrada)).toEqual([{ operadorId, evento: 'entrada', ip: ipDaEntrada }])

    // A segunda entrada, com o segundo fator já ativo, grava outra `entrada` e nenhuma auditoria nova.
    const deNovo = entradaDeOperadorResponseSchema.parse((await pedir(url, 'POST', '/v1/operacao/sessao/email', { email: `${apelido}@turmma.invalid`, senha: SENHA }, doIp(ipDaSegunda))).corpo)
    expect((await entrar(url, { desafio: deNovo.desafio, codigo: codigoDoPasso(configurado.segredo, passoAtual() + 1) }, doIp(ipDaSegunda))).status).toBe(200)
    expect(await acessosDoIp(ipDaSegunda)).toEqual([{ operadorId, evento: 'entrada', ip: ipDaSegunda }])

    const refresh = valorDoCookie(primeira.setCookie, COOKIE_SESSAO_DE_OPERADOR) ?? ''
    expect((await pedir(url, 'POST', '/v1/operacao/sessao/sair', undefined, { ...doIp(ipDaSaida), Cookie: `${COOKIE_SESSAO_DE_OPERADOR}=${refresh}` })).status).toBe(204)
    expect(await acessosDoIp(ipDaSaida)).toEqual([{ operadorId, evento: 'saida', ip: ipDaSaida }])

    // O aceite não é entrada: não grava acesso.
    expect(await acessosDoIp(ipDoAceite)).toEqual([])
    expect(await auditoriaDe(operadorId)).toEqual([
      { autor, acao: 'convite_operador.gerado' },
      { autor, acao: 'convite_operador.revogado' },
      { autor, acao: 'convite_operador.gerado' },
      // O aceite, com o próprio operador de autor (A0b, tarefa 9.0).
      { autor: apelido, acao: 'convite_operador.aceito' },
      { autor: apelido, acao: 'operador.mfa_configurado' },
    ])
  })

  it('a falha de entrada, pela senha e pelo código, grava `entrada_falha` com o IP e sem operador, e soma na métrica; a senha certa e o código certo não', async () => {
    const { operadorId, apelido } = await operadores.operador()
    const token = (await gerarConviteDeOperador(banco, autor, apelido)).token
    const aceite = aceitarConviteDeOperadorResponseSchema.parse((await pedir(url, 'POST', '/v1/operacao/convite/aceitar', { token, senha: SENHA }, doIp())).corpo)
    const { corpo: configurado } = await configurar(url, aceite.desafio)
    if (configurado === undefined) throw new Error('configurar recusado')
    const antes = await falhasNaMetrica()

    const [ipDaSenha, ipDoCodigo] = [ipSorteado(), ipSorteado()]
    esperarErro(await pedir(url, 'POST', '/v1/operacao/sessao/email', { email: `${apelido}@turmma.invalid`, senha: 'senha-errada-de-proposito' }, doIp(ipDaSenha)), 401, ErrorCode.NAO_AUTENTICADO)
    // Um código que não é o do passo: o segredo é o certo, o passo está fora da janela.
    esperarErro(await entrar(url, { desafio: configurado.desafio, codigo: codigoDoPasso(configurado.segredo, passoAtual() + 10) }, doIp(ipDoCodigo)), 401, ErrorCode.NAO_AUTENTICADO)
    expect(await acessosDoIp(ipDaSenha)).toEqual([{ operadorId: null, evento: 'entrada_falha', ip: ipDaSenha }])
    expect(await acessosDoIp(ipDoCodigo)).toEqual([{ operadorId: null, evento: 'entrada_falha', ip: ipDoCodigo }])
    expect(await falhasNaMetrica()).toBe(antes + 2)

    // Com a senha e o código certos: nenhuma falha a mais, nem no registro, nem na métrica.
    const ipCerto = ipSorteado()
    const certo = entradaDeOperadorResponseSchema.parse((await pedir(url, 'POST', '/v1/operacao/sessao/email', { email: `${apelido}@turmma.invalid`, senha: SENHA }, doIp(ipCerto))).corpo)
    expect(certo.etapa).toBe('configurar_mfa')
    const { corpo: deNovo } = await configurar(url, certo.desafio, doIp(ipCerto))
    if (deNovo === undefined) throw new Error('configurar recusado')
    expect((await entrar(url, { desafio: deNovo.desafio, codigo: codigoDoPasso(deNovo.segredo, passoAtual()) }, doIp(ipCerto))).status).toBe(200)
    expect(await acessosDoIp(ipCerto)).toEqual([{ operadorId, evento: 'entrada', ip: ipCerto }])
    expect(await falhasNaMetrica()).toBe(antes + 2)
  })

  it('pelo comando: criar, convite, desativar gravam a auditoria com o autor do OPERADOR e o alvo certo, e nenhum acesso', async () => {
    const apelido = `r-${randomBytes(6).toString('hex')}`
    const { operadorId } = await criarOperador(banco, autor, { apelido, nome: 'Pessoa Sintética dos Registros', email: `${apelido}@turmma.invalid` })
    criadosAqui.push(operadorId)
    await gerarConviteDeOperador(banco, autor, apelido)
    await desativarOperador(banco, autor, apelido)
    expect(await auditoriaDe(operadorId)).toEqual([
      { autor, acao: 'operador.criado' },
      { autor, acao: 'convite_operador.gerado' },
      { autor, acao: 'convite_operador.revogado' },
      { autor, acao: 'convite_operador.gerado' },
      { autor, acao: 'convite_operador.revogado' },
      { autor, acao: 'operador.desativado' },
    ])
    const { rows } = await operadores.pool.query<{ total: number }>('select count(*)::int as total from acesso_operacao where operador_id = $1', [operadorId])
    expect(rows[0]?.total).toBe(0)
  })
})
