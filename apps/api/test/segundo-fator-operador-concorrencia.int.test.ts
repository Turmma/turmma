import 'reflect-metadata'
import { type Database } from '@educa/nucleo'
import { ErrorCode, segundoFatorDeOperadorResponseSchema, type ConfigurarSegundoFatorDeOperadorResponse } from '@educa/shared'
import type { INestApplication } from '@nestjs/common'
import type { Redis } from 'ioredis'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { BANCO } from '../src/banco.module.js'
import { ConsumoDeDesafioDeOperador } from '../src/operacao/desafio-de-operador.js'
import { PREFIXO_DO_CONTADOR_DA_OPERACAO } from '../src/operacao/entrada/entrada.service.js'
import { OperadorRepository } from '../src/operacao/operador/operador.repository.js'
import { desativarOperador } from '../src/ops/operador.js'
import { CLIENTE_REDIS_LOGIN, ContadorDeTentativas } from '../src/credencial/index.js'
import {
  ativarNoBanco,
  barreira,
  base32DoGravado,
  codigoDoPasso,
  configurar,
  desafio,
  desafioInvalido,
  entrar,
  esperarErro,
  esperarNaFila,
  esperarSoIdApelidoEDatas,
  estadoDoOperador,
  forma,
  hmacDoCodigo,
  passoAtual,
  pedir,
  subir,
  type Resposta,
} from './segundo-fator-de-operador.js'
import { BancadaDeOperadores } from './sessao-de-operador.js'

/**
 * As consultas que ficam na fila da linha do operador, como o `pg_stat_activity` as mostra: o `update` do configurar,
 * o `for update` do `/sessao/mfa` e o `for update` do `desativar` (e do `convite`), que procura pelo apelido.
 */
const CONFIGURAR_NA_FILA = 'update "operador" set "mfa_segredo_cifrado"%'
const ENTRAR_NA_FILA = 'select "id", "email", "mfa_segredo_cifrado"%for update'
const DESATIVAR_NA_FILA = 'select "id", "apelido" from "operador"%for update'

type Metodo = 'trocarCodigosDeRecuperacao' | 'abrirSessao'

describe('segundo fator do operador: as travas contra a corrida (tarefa 7.0)', () => {
  const operadores = new BancadaDeOperadores()
  let app: INestApplication
  let url: string
  let banco: Database
  let autor: string

  beforeAll(async () => {
    ;({ app, url } = await subir())
    banco = app.get<Database>(BANCO)
    // O autor dos `desativar`: com ele e o alvo, há sempre dois ativos, e ninguém desativa a si mesmo.
    autor = (await operadores.operador()).apelido
  })

  afterAll(async () => {
    vi.restoreAllMocks()
    await app.close()
    await operadores.fechar()
  })

  /**
   * Segura a **primeira** chamada do método do repository numa barreira, antes de ele rodar: a transação de quem chamou
   * já tem a linha do operador (pelo `update` do configurar ou pelo `for update` do `/sessao/mfa`). As outras passam.
   */
  function segurarAntesDe(metodo: Metodo): { chegou: Promise<void>; soltar: () => void } {
    const espera = barreira()
    const original = OperadorRepository.prototype[metodo] as (...argumentos: unknown[]) => Promise<unknown>
    let primeira = true
    vi.spyOn(OperadorRepository.prototype, metodo).mockImplementation(async function (this: OperadorRepository, ...argumentos: unknown[]) {
      if (primeira) {
        primeira = false
        await espera.esperar()
      }
      return original.apply(this, argumentos)
    } as never)
    return { chegou: espera.chegaram, soltar: espera.soltar }
  }

  /** Segura a primeira `/sessao/mfa` ou o primeiro configurar **depois** de consumir o `jti` e antes da transação. */
  function segurarDepoisDoJti(): { chegou: Promise<void>; soltar: () => void } {
    const consumo = app.get(ConsumoDeDesafioDeOperador)
    const original = consumo.consumir.bind(consumo)
    const espera = barreira()
    let primeira = true
    vi.spyOn(consumo, 'consumir').mockImplementation(async (verificado) => {
      await original(verificado)
      if (primeira) {
        primeira = false
        await espera.esperar()
      }
    })
    return { chegou: espera.chegaram, soltar: espera.soltar }
  }

  async function falhasNoContador(operadorId: string): Promise<string | null> {
    const chave = app.get(ContadorDeTentativas).chaveDe(operadorId, 'outro', PREFIXO_DO_CONTADOR_DA_OPERACAO)
    return app.get<Redis>(CLIENTE_REDIS_LOGIN, { strict: false }).hget(chave, 'falhas')
  }

  const comoDesafioInvalidoEmEntrar = async (operadorId: string) => forma(await entrar(url, { desafio: await desafioInvalido(operadorId, 'mfa'), codigo: '123456' }))
  const comoDesafioInvalidoEmConfigurar = async (operadorId: string) => forma((await configurar(url, await desafioInvalido(operadorId, 'configurar_mfa'))).resposta)

  function corpoDe(resultado: { corpo: ConfigurarSegundoFatorDeOperadorResponse | undefined }): ConfigurarSegundoFatorDeOperadorResponse {
    if (resultado.corpo === undefined) throw new Error('configurar recusado')
    return resultado.corpo
  }

  describe('C18: dois configurar em paralelo, nas duas ordens', () => {
    it.each(['a aba A trava primeiro', 'a aba B trava primeiro'] as const)(
      '%s: o segundo espera na linha e vence; o segredo e os códigos gravados são os dele; o código da primeira recebe "configure de novo" sem contar tentativa, e só o da vencedora ativa',
      async (ordem) => {
        const { operadorId } = await operadores.operador()
        const [desafioA, desafioB] = [await desafio(operadorId, 'configurar_mfa'), await desafio(operadorId, 'configurar_mfa')]
        const [primeiro, segundo] = ordem === 'a aba A trava primeiro' ? [desafioA, desafioB] : [desafioB, desafioA]

        const trava = segurarAntesDe('trocarCodigosDeRecuperacao')
        const doPrimeiro = configurar(url, primeiro)
        await trava.chegou
        const doSegundo = configurar(url, segundo)
        // O segundo está parado no `update` do configurar, na fila da linha que o primeiro gravou.
        await esperarNaFila(operadores.pool, CONFIGURAR_NA_FILA)
        trava.soltar()
        const [perdedora, vencedora] = [corpoDe(await doPrimeiro), corpoDe(await doSegundo)]
        vi.restoreAllMocks()

        const gravado = await estadoDoOperador(operadores.pool, operadorId)
        expect(base32DoGravado(operadorId, gravado.segredoCifrado ?? Buffer.alloc(0), gravado.chaveVersao ?? 0)).toBe(vencedora.segredo)
        expect(gravado.hmacs).toEqual(vencedora.codigosRecuperacao.map(hmacDoCodigo).sort())
        expect(gravado.hmacs.filter((hmac) => perdedora.codigosRecuperacao.map(hmacDoCodigo).includes(hmac))).toEqual([])

        // A perdedora, com o código do segredo dela: 409 "configure de novo", sem conferir o código nem contar tentativa.
        const configureDeNovo = await entrar(url, { desafio: perdedora.desafio, codigo: codigoDoPasso(perdedora.segredo, passoAtual()) })
        esperarErro(configureDeNovo, 409, ErrorCode.CONFLITO)
        expect(await falhasNoContador(operadorId)).toBeNull()
        expect(await estadoDoOperador(operadores.pool, operadorId)).toMatchObject({ ativadoEm: null, ultimoPasso: null, sessoes: 0 })

        // A vencedora ativa; depois, só os códigos de recuperação dela valem.
        expect((await entrar(url, { desafio: vencedora.desafio, codigo: codigoDoPasso(vencedora.segredo, passoAtual()) })).status).toBe(200)
        esperarErro(await entrar(url, { desafio: await desafio(operadorId, 'mfa'), recuperacao: perdedora.codigosRecuperacao[0] ?? '' }), 401, ErrorCode.NAO_AUTENTICADO)
        expect((await entrar(url, { desafio: await desafio(operadorId, 'mfa'), recuperacao: vencedora.codigosRecuperacao[0] ?? '' })).status).toBe(200)
      },
    )
  })

  describe('C18b: `/sessao/mfa` da aba A e configurar da aba B, nas duas ordens', () => {
    it('o `/sessao/mfa` trava primeiro: ativa o segredo que conferiu, e o configurar, que esperava, é recusado sem trocar nada', async () => {
      const { operadorId } = await operadores.operador()
      const abaA = corpoDe(await configurar(url, await desafio(operadorId, 'configurar_mfa')))
      const desafioB = await desafio(operadorId, 'configurar_mfa')

      const trava = segurarAntesDe('abrirSessao')
      const daAbaA = entrar(url, { desafio: abaA.desafio, codigo: codigoDoPasso(abaA.segredo, passoAtual()) })
      await trava.chegou
      const daAbaB = configurar(url, desafioB)
      await esperarNaFila(operadores.pool, CONFIGURAR_NA_FILA)
      trava.soltar()
      const [entrada, { resposta: configuracao }] = [await daAbaA, await daAbaB]
      vi.restoreAllMocks()

      expect(entrada.status).toBe(200)
      expect(forma(configuracao)).toEqual(await comoDesafioInvalidoEmConfigurar(operadorId))
      const ativo = await estadoDoOperador(operadores.pool, operadorId)
      expect(ativo.ativadoEm).toBeInstanceOf(Date)
      expect(base32DoGravado(operadorId, ativo.segredoCifrado ?? Buffer.alloc(0), ativo.chaveVersao ?? 0)).toBe(abaA.segredo)
      expect(ativo.hmacs).toEqual(abaA.codigosRecuperacao.map(hmacDoCodigo).sort())
    })

    it('o configurar trava primeiro: o `/sessao/mfa`, que esperava, recebe "configure de novo" sem contar tentativa, e nada é ativado', async () => {
      const { operadorId } = await operadores.operador()
      const abaA = corpoDe(await configurar(url, await desafio(operadorId, 'configurar_mfa')))
      const desafioB = await desafio(operadorId, 'configurar_mfa')

      const trava = segurarAntesDe('trocarCodigosDeRecuperacao')
      const daAbaB = configurar(url, desafioB)
      await trava.chegou
      const daAbaA = entrar(url, { desafio: abaA.desafio, codigo: codigoDoPasso(abaA.segredo, passoAtual()) })
      await esperarNaFila(operadores.pool, ENTRAR_NA_FILA)
      trava.soltar()
      const [abaB, entrada] = [corpoDe(await daAbaB), await daAbaA]
      vi.restoreAllMocks()

      esperarErro(entrada, 409, ErrorCode.CONFLITO)
      expect(await falhasNoContador(operadorId)).toBeNull()
      const gravado = await estadoDoOperador(operadores.pool, operadorId)
      expect(gravado).toMatchObject({ ativadoEm: null, ultimoPasso: null, sessoes: 0 })
      expect(base32DoGravado(operadorId, gravado.segredoCifrado ?? Buffer.alloc(0), gravado.chaveVersao ?? 0)).toBe(abaB.segredo)
    })
  })

  describe('C6b: o desafio emitido antes do `desativar`, nas ordens que a trava produz', () => {
    it('(a) o `desativar` ganha: com o `/sessao/mfa` parado entre o `jti` e o `for update`, ele confirma, e o `/sessao/mfa` é recusado como desafio inválido; fica o estado do C6, sem sessão', async () => {
      const { operadorId, apelido } = await operadores.operador()
      const { base32 } = await ativarNoBanco(operadores.pool, operadorId)
      const antes = await estadoDoOperador(operadores.pool, operadorId)
      expect(antes.hmacs).toHaveLength(10)

      const trava = segurarDepoisDoJti()
      const pendente = entrar(url, { desafio: await desafio(operadorId, 'mfa'), codigo: codigoDoPasso(base32, passoAtual()) })
      await trava.chegou
      await desativarOperador(banco, autor, apelido)
      trava.soltar()
      const resposta = await pendente
      vi.restoreAllMocks()

      expect(forma(resposta)).toEqual(await comoDesafioInvalidoEmEntrar(operadorId))
      expect(resposta.setCookie).toEqual([])
      const depois = await estadoDoOperador(operadores.pool, operadorId)
      esperarSoIdApelidoEDatas(depois)
      expect(depois.sessoes).toBe(0)
    })

    it('(b) o `/sessao/mfa` ganha: parado entre o `for update` e o insert, o `desativar` espera na linha (pg_locks); depois, a sessão aberta é encerrada por ele, e a requisição seguinte recebe SESSAO_ENCERRADA', async () => {
      const { operadorId, apelido } = await operadores.operador()
      const { base32 } = await ativarNoBanco(operadores.pool, operadorId)

      const trava = segurarAntesDe('abrirSessao')
      const pendente = entrar(url, { desafio: await desafio(operadorId, 'mfa'), codigo: codigoDoPasso(base32, passoAtual()) })
      await trava.chegou
      let desativou = false
      const desativacao = desativarOperador(banco, autor, apelido).then(() => {
        desativou = true
      })
      await esperarNaFila(operadores.pool, DESATIVAR_NA_FILA)
      expect(desativou).toBe(false)
      trava.soltar()
      const resposta: Resposta = await pendente
      await desativacao
      vi.restoreAllMocks()

      expect(resposta.status).toBe(200)
      const { token } = segundoFatorDeOperadorResponseSchema.parse(resposta.corpo)
      const depois = await estadoDoOperador(operadores.pool, operadorId)
      expect({ sessoes: depois.sessoes, sessoesAbertas: depois.sessoesAbertas }).toEqual({ sessoes: 1, sessoesAbertas: 0 })
      const { rows } = await operadores.pool.query<{ motivo: string }>('select motivo from sessao_operador where operador_id = $1', [operadorId])
      expect(rows).toEqual([{ motivo: 'desativacao' }])
      esperarSoIdApelidoEDatas(depois)
      esperarErro(await pedir(url, 'GET', '/v1/operacao/eu', undefined, { Authorization: `Bearer ${token}` }), 401, ErrorCode.SESSAO_ENCERRADA)
    })

    it('(c) configurar com o `desativar` ganhando (parado antes do `update … returning mfa_versao`): recusado como desafio inválido, e nenhum segredo nem código fica', async () => {
      const { operadorId, apelido } = await operadores.operador()
      const trava = segurarDepoisDoJti()
      const pendente = configurar(url, await desafio(operadorId, 'configurar_mfa'))
      await trava.chegou
      await desativarOperador(banco, autor, apelido)
      trava.soltar()
      const { resposta } = await pendente
      vi.restoreAllMocks()

      expect(forma(resposta)).toEqual(await comoDesafioInvalidoEmConfigurar(operadorId))
      esperarSoIdApelidoEDatas(await estadoDoOperador(operadores.pool, operadorId))
    })

    it('(c) configurar ganhando (parado depois do `update … returning mfa_versao`): o `desativar` espera na linha e depois apaga segredo e códigos; o desafio `mfa` devolvido cai no (d)', async () => {
      const { operadorId, apelido } = await operadores.operador()
      const trava = segurarAntesDe('trocarCodigosDeRecuperacao')
      const pendente = configurar(url, await desafio(operadorId, 'configurar_mfa'))
      await trava.chegou
      let desativou = false
      const desativacao = desativarOperador(banco, autor, apelido).then(() => {
        desativou = true
      })
      await esperarNaFila(operadores.pool, DESATIVAR_NA_FILA)
      expect(desativou).toBe(false)
      trava.soltar()
      const configurado = corpoDe(await pendente)
      await desativacao
      vi.restoreAllMocks()

      esperarSoIdApelidoEDatas(await estadoDoOperador(operadores.pool, operadorId))
      const resposta = await entrar(url, { desafio: configurado.desafio, codigo: codigoDoPasso(configurado.segredo, passoAtual()) })
      expect(forma(resposta)).toEqual(await comoDesafioInvalidoEmEntrar(operadorId))
      expect((await estadoDoOperador(operadores.pool, operadorId)).sessoes).toBe(0)
    })

    it('(d) em sequência: o desafio emitido antes e usado depois do `desativar` é recusado como inválido, sem sessão', async () => {
      const { operadorId, apelido } = await operadores.operador()
      const { base32 } = await ativarNoBanco(operadores.pool, operadorId)
      const emitido = await desafio(operadorId, 'mfa')
      await desativarOperador(banco, autor, apelido)
      const resposta = await entrar(url, { desafio: emitido, codigo: codigoDoPasso(base32, passoAtual()) })
      expect(forma(resposta)).toEqual(await comoDesafioInvalidoEmEntrar(operadorId))
      const depois = await estadoDoOperador(operadores.pool, operadorId)
      esperarSoIdApelidoEDatas(depois)
      expect(depois.sessoes).toBe(0)
    })
  })
})
