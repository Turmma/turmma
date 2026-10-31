import 'reflect-metadata'
import { ALGORITMO_TOKEN, EMISSOR_TOKEN, TIPO_TOKEN } from '@educa/core'
import { ErrorCode, MENSAGENS_DE_ERRO, SYSTEM_REALTIME_NAMESPACE, REALTIME_RECONNECTION } from '@educa/shared'
import { Redis } from 'ioredis'
import { SignJWT } from 'jose'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { connect } from 'node:net'
import { setTimeout as esperar } from 'node:timers/promises'
import type { Socket as SocketCliente } from 'socket.io-client'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { valorObrigatorio } from '../../../tools/ci/compose.ts'
import { aguardarSaudavel, compose, composeAssincronoOuFalha } from '../../../tools/testes/compose.ts'
import { BancadaDeSessoes, type SessaoDeTeste } from '../../api/test/sessao-de-teste.js'
import { PREFIXO_REDIS_REALTIME } from '../src/adaptador-redis.js'
import { salaDaEscola } from '../src/sistema.gateway.js'
import {
  coletar,
  conectar,
  criarCliente,
  criarEmissor,
  ambienteDeTeste,
  loggerEmMemoria,
  recusaDaConexao,
  subirInstancia,
  urlRedisDeFila,
  type InstanciaDeTeste,
} from './realtime-de-teste.js'

// Escolas e sessões reais no Postgres do compose de teste: desde a tarefa 3.0 o handshake lê a sessão
// gravada, com a mesma consulta da `SessaoGuard` da API. Token sem sessão não entra.
const bancada = new BancadaDeSessoes()
let ESCOLA_A: string
let ESCOLA_B: string
/** Duas sessões em cada escola: A1 e A2 provam a sala compartilhada, B1 e B2 o isolamento. */
let SESSAO_A1: SessaoDeTeste
let SESSAO_A2: SessaoDeTeste
let SESSAO_B1: SessaoDeTeste
let SESSAO_B2: SessaoDeTeste
let USUARIO_A1: string
let USUARIO_A2: string
let USUARIO_B2: string

beforeAll(async () => {
  ;[ESCOLA_A, ESCOLA_B] = await Promise.all([bancada.escola(), bancada.escola()])
  ;[[SESSAO_A1, SESSAO_A2], [SESSAO_B1, SESSAO_B2]] = (await Promise.all([
    bancada.sessoes(ESCOLA_A, { quantidade: 2 }),
    bancada.sessoes(ESCOLA_B, { quantidade: 2 }),
  ])) as [[SessaoDeTeste, SessaoDeTeste], [SessaoDeTeste, SessaoDeTeste]]
  USUARIO_A1 = SESSAO_A1.usuarioId
  USUARIO_A2 = SESSAO_A2.usuarioId
  USUARIO_B2 = SESSAO_B2.usuarioId
})

afterAll(async () => {
  await bancada.fechar()
})

// Tempo para uma emissão que não deveria chegar ter tido a chance de chegar.
const JANELA_DE_SILENCIO_MS = 600

const chaveDeAssinatura = () => new TextEncoder().encode(valorObrigatorio(ambienteDeTeste, 'IDENTIDADE_CHAVE_ASSINATURA'))

/** Um token assinado à mão, com a chave do ambiente, para o caso que o `TokenIssuer` não produz. */
function assinar(claims: { esc: string; sub: string; sid: string }, emissor: string): Promise<string> {
  const agora = Math.floor(Date.now() / 1000)
  return new SignJWT({ esc: claims.esc, sid: claims.sid })
    .setProtectedHeader({ alg: ALGORITMO_TOKEN, typ: TIPO_TOKEN })
    .setIssuer(emissor)
    .setSubject(claims.sub)
    .setIssuedAt(agora)
    .setExpirationTime(agora + 600)
    .sign(chaveDeAssinatura())
}

/** Assinatura e prazo certos, `sid` que nunca foi gravado: é o token sintético do F0, sem sessão. */
function tokenDeSessaoInexistente(escolaId: string, usuarioId: string): Promise<string> {
  return assinar({ esc: escolaId, sub: usuarioId, sid: randomUUID() }, EMISSOR_TOKEN)
}

/** A sessão é real e o `sid` existe: só o emissor é o `sintetico` que saiu na tarefa 3.0. */
function tokenComEmissorSintetico(sessao: SessaoDeTeste): Promise<string> {
  return assinar({ esc: sessao.escolaId, sub: sessao.usuarioId, sid: sessao.sessaoId }, 'sintetico')
}

const clientes: SocketCliente[] = []
function registrar(cliente: SocketCliente): SocketCliente {
  clientes.push(cliente)
  return cliente
}

afterEach(() => {
  for (const cliente of clientes.splice(0)) cliente.disconnect()
})

describe('realtime em duas instâncias, com o adaptador de streams no Redis de fila', () => {
  const log1 = loggerEmMemoria()
  const log2 = loggerEmMemoria()
  let instancia1: InstanciaDeTeste
  let instancia2: InstanciaDeTeste
  let emissor: Awaited<ReturnType<typeof criarEmissor>>

  beforeAll(async () => {
    instancia1 = await subirInstancia(log1.logger)
    instancia2 = await subirInstancia(log2.logger)
    emissor = await criarEmissor()
  })

  afterAll(async () => {
    await emissor.fechar()
    await instancia1.app.close()
    await instancia2.app.close()
  })

  async function conectado(instancia: InstanciaDeTeste, sessao: SessaoDeTeste): Promise<SocketCliente> {
    const cliente = registrar(criarCliente(instancia.url, await sessao.tokenNovo()))
    await conectar(cliente)
    return cliente
  }

  function emitirParaEscola(escolaId: string, dados: Record<string, string>): void {
    emissor.servidor.of(SYSTEM_REALTIME_NAMESPACE).to(salaDaEscola(escolaId)).emit('sistema.teste', dados)
  }

  it('clientes da mesma escola em instâncias diferentes recebem a mesma emissão', async () => {
    const naInstancia1 = await conectado(instancia1, SESSAO_A1)
    const naInstancia2 = await conectado(instancia2, SESSAO_A2)
    const recebidos1 = coletar(naInstancia1, 'sistema.teste')
    const recebidos2 = coletar(naInstancia2, 'sistema.teste')

    emitirParaEscola(ESCOLA_A, { marca: 'emissao-1' })

    await expect.poll(() => recebidos1).toEqual([{ marca: 'emissao-1' }])
    await expect.poll(() => recebidos2).toEqual([{ marca: 'emissao-1' }])
    // Uma vez só: a instância não entrega de novo o que leu do stream.
    await esperar(JANELA_DE_SILENCIO_MS)
    expect(recebidos1).toHaveLength(1)
    expect(recebidos2).toHaveLength(1)
  })

  it('a sala da escola é a mesma nas duas instâncias: a consulta de sockets atravessa o Redis e só traz a escola A', async () => {
    const a1 = await conectado(instancia1, SESSAO_A1)
    const a2 = await conectado(instancia2, SESSAO_A2)
    await conectado(instancia1, SESSAO_B1)
    await conectado(instancia2, SESSAO_B2)

    const naSalaA = await emissor.servidor.of(SYSTEM_REALTIME_NAMESPACE).in(salaDaEscola(ESCOLA_A)).fetchSockets()

    expect(naSalaA.map((socket) => socket.id).sort()).toEqual([a1.id, a2.id].sort())
    // O handshake atravessa o Redis nessa consulta: o token verificado e a query já não estão nele.
    for (const socket of naSalaA) {
      expect(socket.handshake.auth).toEqual({})
      expect(socket.handshake.query).toEqual({})
    }
    expect(naSalaA.map((socket) => socket.data)).toEqual(
      expect.arrayContaining([
        { identidade: { escolaId: ESCOLA_A, usuarioId: USUARIO_A1 } },
        { identidade: { escolaId: ESCOLA_A, usuarioId: USUARIO_A2 } },
      ]),
    )
  })

  it('isolamento: a emissão para a escola A não chega a cliente da escola B, em nenhuma das instâncias', async () => {
    const a1 = await conectado(instancia1, SESSAO_A1)
    const b1 = await conectado(instancia1, SESSAO_B1)
    const b2 = await conectado(instancia2, SESSAO_B2)
    const recebidosA1 = coletar(a1, 'sistema.teste')
    const recebidosB1 = coletar(b1, 'sistema.teste')
    const recebidosB2 = coletar(b2, 'sistema.teste')

    emitirParaEscola(ESCOLA_A, { marca: 'so-da-a' })
    await expect.poll(() => recebidosA1).toEqual([{ marca: 'so-da-a' }])
    await esperar(JANELA_DE_SILENCIO_MS)

    expect(recebidosB1).toEqual([])
    expect(recebidosB2).toEqual([])

    // E na volta: o que é da B não chega a quem entrou com sessão da A.
    emitirParaEscola(ESCOLA_B, { marca: 'so-da-b' })
    await expect.poll(() => recebidosB1).toEqual([{ marca: 'so-da-b' }])
    await esperar(JANELA_DE_SILENCIO_MS)
    expect(recebidosA1).toEqual([{ marca: 'so-da-a' }])
  })

  it('isolamento: cliente da escola B não entra na sala da A pedindo por nome, nem no auth, nem na query, nem por evento', async () => {
    const tokenB = await SESSAO_B2.tokenNovo()
    const intruso = registrar(
      criarCliente(instancia2.url, tokenB, {
        auth: { token: tokenB, escolaId: ESCOLA_A, sala: salaDaEscola(ESCOLA_A) },
        query: { escolaId: ESCOLA_A, sala: salaDaEscola(ESCOLA_A) },
      }),
    )
    await conectar(intruso)
    for (const evento of ['join', 'entrar', 'subscribe', 'sala']) intruso.emit(evento, salaDaEscola(ESCOLA_A))
    const a1 = await conectado(instancia1, SESSAO_A1)
    const recebidosIntruso = coletar(intruso, 'sistema.teste')
    const recebidosA1 = coletar(a1, 'sistema.teste')
    await esperar(200)

    emitirParaEscola(ESCOLA_A, { marca: 'nao-e-da-b' })
    await expect.poll(() => recebidosA1).toEqual([{ marca: 'nao-e-da-b' }])
    await esperar(JANELA_DE_SILENCIO_MS)

    expect(recebidosIntruso).toEqual([])
    const naSalaA = await emissor.servidor.of(SYSTEM_REALTIME_NAMESPACE).in(salaDaEscola(ESCOLA_A)).fetchSockets()
    expect(naSalaA.map((socket) => socket.id)).toEqual([a1.id])
    const naSalaB = await emissor.servidor.of(SYSTEM_REALTIME_NAMESPACE).in(salaDaEscola(ESCOLA_B)).fetchSockets()
    expect(naSalaB.map((socket) => socket.data)).toEqual([{ identidade: { escolaId: ESCOLA_B, usuarioId: USUARIO_B2 } }])
  })

  describe('autenticação no handshake', () => {
    const recusaEsperada = {
      message: ErrorCode.NAO_AUTENTICADO,
      data: { codigo: ErrorCode.NAO_AUTENTICADO, mensagem: MENSAGENS_DE_ERRO.NAO_AUTENTICADO },
    }

    it.each<[string, () => Promise<{ token: string; auth?: Record<string, unknown>; query?: Record<string, string> }>]>([
      ['sem token', async () => ({ token: '', auth: {} })],
      ['token só na query da URL', async () => {
        const token = await SESSAO_A1.tokenNovo()
        return { token, auth: {}, query: { token, access_token: token } }
      }],
      // Token de uma sessão que existe e continua válida: o que vence é o token, e mesmo assim não entra.
      ['token vencido', async () => ({ token: await SESSAO_A1.tokenEm(new Date(Date.now() - 20 * 60_000)) })],
      ['assinatura de outra escola colada no corpo', async () => {
        const [cabecalho, corpo] = (await SESSAO_A1.tokenNovo()).split('.')
        const assinaturaDeB = (await SESSAO_B1.tokenNovo()).split('.')[2]
        return { token: `${cabecalho}.${corpo}.${assinaturaDeB}` }
      }],
      // Token bem assinado de uma sessão que nunca existiu: o `sid` sorteado não casa com nenhuma linha.
      ['token com sessão inexistente', async () => ({ token: await tokenDeSessaoInexistente(ESCOLA_A, USUARIO_A1) })],
      ['token que não é texto', async () => ({ token: '', auth: { token: { esc: ESCOLA_A } } })],
    ])('recusa %s com NAO_AUTENTICADO, sem dizer o que falhou', async (_caso, montar) => {
      const { token, auth, query } = await montar()
      const cliente = registrar(criarCliente(instancia1.url, token, { ...(auth === undefined ? {} : { auth }), ...(query === undefined ? {} : { query }) }))
      expect(await recusaDaConexao(cliente)).toEqual(recusaEsperada)
    })

    it('token no cabeçalho Authorization não autentica: só o pacote de conexão vale', async () => {
      const token = await SESSAO_A1.tokenNovo()
      const cliente = registrar(
        criarCliente(instancia1.url, token, { auth: {}, cabecalhos: { Authorization: `Bearer ${token}` }, transports: ['polling'] }),
      )
      expect(await recusaDaConexao(cliente)).toEqual(recusaEsperada)
    })

    it('o namespace padrão `/` recusa até token válido: não existe entrada sem autenticação e sem sala', async () => {
      const cliente = registrar(criarCliente(instancia1.url, await SESSAO_A1.tokenNovo(), { namespace: '/' }))
      expect(await recusaDaConexao(cliente)).toEqual(recusaEsperada)
    })

    it('o token do emissor sintético do F0, assinado com a mesma chave e com a sessão real, é recusado', async () => {
      const cliente = registrar(criarCliente(instancia1.url, await tokenComEmissorSintetico(SESSAO_A1)))
      expect(await recusaDaConexao(cliente)).toEqual(recusaEsperada)
      // A mesma sessão, com o emissor `educa`, entra: o que recusou foi o emissor, não a sessão.
      await conectar(registrar(criarCliente(instancia1.url, await SESSAO_A1.tokenNovo())))
    })

    it('o handshake não move `ultimo_uso_em`: conectar ao realtime não conta como atividade da pessoa', async () => {
      const [sessao] = await bancada.sessoes(ESCOLA_A)
      if (sessao === undefined) throw new Error('sessão de teste não criada')
      const lerUltimoUso = async (): Promise<string> => {
        const { rows } = await bancada.pool.query<{ em: string }>('select ultimo_uso_em::text as em from sessao where id = $1', [sessao.sessaoId])
        if (rows[0] === undefined) throw new Error('sessão não encontrada')
        return rows[0].em
      }
      const antes = await lerUltimoUso()

      await conectar(registrar(criarCliente(instancia1.url, await sessao.tokenNovo())))
      await conectar(registrar(criarCliente(instancia2.url, await sessao.tokenNovo())))

      // Sem isto, a reconexão automática da web renovaria sessão ociosa para sempre, e a inatividade (RF13)
      // nunca venceria em quem deixa a aba aberta.
      expect(await lerUltimoUso()).toBe(antes)
    })

    it('sessão encerrada no banco recusa o handshake seguinte, e a sessão viva da mesma escola segue entrando', async () => {
      const [viva, encerrada] = await bancada.sessoes(ESCOLA_A, { quantidade: 2 })
      if (viva === undefined || encerrada === undefined) throw new Error('sessões de teste não criadas')
      // Conectada antes: o corte vale para o handshake seguinte, não para a conexão já aberta.
      await conectar(registrar(criarCliente(instancia1.url, await encerrada.tokenNovo())))
      await bancada.encerrar(encerrada.sessaoId)

      const cliente = registrar(criarCliente(instancia1.url, await encerrada.tokenNovo()))
      expect(await recusaDaConexao(cliente)).toEqual(recusaEsperada)
      await conectar(registrar(criarCliente(instancia1.url, await viva.tokenNovo())))
    })
  })

  it('Postgres fora: o handshake é recusado com INDISPONIVEL_TENTE_DE_NOVO, nunca com NAO_AUTENTICADO, e a tentativa seguinte entra com o mesmo token', async () => {
    const token = await SESSAO_A1.tokenNovo()
    const cliente = registrar(criarCliente(instancia1.url, token))
    // O recuo com que o cliente volta: `REALTIME_RECONNECTION` espalha as tentativas em ±50%, para a sala inteira
    // não tentar no mesmo milissegundo. Recusa de middleware o socket.io não repete sozinho (ele destrói o
    // socket ao receber CONNECT_ERROR), então quem tenta de novo é a web, com estas opções.
    expect(cliente.io.opts).toMatchObject(REALTIME_RECONNECTION)

    const indisponivel = {
      message: ErrorCode.INDISPONIVEL_TENTE_DE_NOVO,
      data: { codigo: ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, mensagem: MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO },
    }
    log1.linhas.length = 0
    compose('pause', 'postgres')
    try {
      expect(await recusaDaConexao(cliente, 30_000)).toEqual(indisponivel)
      // Mais duas tentativas, como a escola inteira reconectando: a recusa é sempre a mesma.
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        expect(await recusaDaConexao(registrar(criarCliente(instancia1.url, token)), 30_000)).toEqual(indisponivel)
      }
    } finally {
      compose('unpause', 'postgres')
      await aguardarSaudavel('postgres')
    }
    // Três recusas, uma linha de aviso: sem o espaçamento, a queda do banco encheria o log com uma linha por
    // cliente reconectando (regra 80). E nela não há token, nem consulta, nem URL de conexão.
    const avisos = log1.linhas.map((linha) => JSON.parse(linha) as Record<string, unknown>).filter((registro) => registro['evento'] === 'realtime.sessao_indisponivel')
    expect(avisos).toHaveLength(1)
    const bruto = JSON.stringify(avisos)
    for (const parte of token.split('.')) expect(bruto).not.toContain(parte)
    expect(bruto).not.toContain('postgres://')
    expect(bruto).not.toContain('select')

    // A queda do banco não encerrou sessão nenhuma: a mesma sessão e o mesmo token entram assim que ele volta.
    await expect
      .poll(async () => conectar(registrar(criarCliente(instancia1.url, token)), 10_000).then(() => true, () => false), { timeout: 60_000, interval: 1_000 })
      .toBe(true)
  }, 180_000)

  it('a reconexão se autentica com o token vigente, lido a cada tentativa, e não com o do primeiro acesso', async () => {
    let tokenVigente = await SESSAO_A1.tokenNovo()
    const cliente = registrar(criarCliente(instancia1.url, () => tokenVigente))
    await conectar(cliente)
    tokenVigente = await SESSAO_A2.tokenNovo()

    const reconectou = new Promise<void>((resolver) => cliente.io.once('reconnect', () => resolver()))
    cliente.io.engine.close()
    await reconectou

    await expect
      .poll(async () => {
        const naSala = await emissor.servidor.of(SYSTEM_REALTIME_NAMESPACE).in(salaDaEscola(ESCOLA_A)).fetchSockets()
        return naSala.map((socket) => socket.data.identidade?.usuarioId)
      })
      .toEqual([USUARIO_A2])
  })

  it('a /prontidao do realtime não consulta o Redis: com ele travado, segue 200 na hora', async () => {
    compose('pause', 'redis-fila')
    try {
      const inicio = performance.now()
      const resposta = await fetch(`${instancia1.url}/prontidao`)
      expect(resposta.status).toBe(200)
      expect(performance.now() - inicio).toBeLessThan(250)
    } finally {
      compose('unpause', 'redis-fila')
      await aguardarSaudavel('redis-fila')
    }
  })

  it('o Redis de fila reinicia durante a aula: sem os clientes reconectarem, a emissão seguinte chega às duas instâncias', async () => {
    const a1 = await conectado(instancia1, SESSAO_A1)
    const a2 = await conectado(instancia2, SESSAO_A2)
    const quedas: string[] = []
    for (const cliente of [a1, a2]) cliente.on('disconnect', (motivo) => quedas.push(motivo))
    const recebidos1 = coletar(a1, 'sistema.teste')
    const recebidos2 = coletar(a2, 'sistema.teste')

    await composeAssincronoOuFalha('restart', 'redis-fila')
    await aguardarSaudavel('redis-fila')

    // A primeira emissão depois da volta pode encontrar o laço de leitura ainda reconectando: repete
    // até chegar, e o que importa é chegar às duas sem ninguém ter caído.
    await expect
      .poll(
        () => {
          emitirParaEscola(ESCOLA_A, { marca: 'depois-do-redis' })
          return recebidos1.length > 0 && recebidos2.length > 0
        },
        { timeout: 20_000, interval: 1_000 },
      )
      .toBe(true)
    expect(quedas).toEqual([])
  }, 60_000)

  it('o log da conexão leva escola e usuário por id, e nunca o token nem a query da URL', async () => {
    log1.linhas.length = 0
    const token = await SESSAO_A1.tokenNovo()
    await conectar(registrar(criarCliente(instancia1.url, token, { query: { nome: 'Enzo Martins', sentinela: 'valor-da-query' } })))
    await recusaDaConexao(registrar(criarCliente(instancia1.url, `${token}x`, { query: { sentinela: 'valor-da-query' } })))

    const registros = log1.linhas.map((linha) => JSON.parse(linha) as Record<string, unknown>)
    expect(registros.find((registro) => registro.evento === 'realtime.conexao_aceita')).toMatchObject({
      escolaId: ESCOLA_A,
      usuarioId: USUARIO_A1,
    })
    expect(registros.find((registro) => registro.evento === 'realtime.conexao_recusada')).toMatchObject({ codigo: ErrorCode.NAO_AUTENTICADO })
    const bruto = log1.linhas.join('')
    for (const parte of token.split('.')) expect(bruto).not.toContain(parte)
    expect(bruto).not.toContain('valor-da-query')
    expect(bruto).not.toContain('Enzo')
  })
})

describe('stream do adaptador no Redis de fila', () => {
  it('tem teto de tamanho: o Redis de fila não expulsa chave, e o stream não cresce sem limite', async () => {
    const redis = new Redis(urlRedisDeFila())
    await redis.del(PREFIXO_REDIS_REALTIME)
    const emissor = await criarEmissor(100)
    try {
      for (let indice = 0; indice < 1_000; indice++) {
        emissor.servidor.of(SYSTEM_REALTIME_NAMESPACE).to(salaDaEscola(ESCOLA_A)).emit('sistema.teste', { indice })
      }
      await expect.poll(async () => redis.xinfo('STREAM', PREFIXO_REDIS_REALTIME).then(() => true), { timeout: 5_000 }).toBe(true)
      await esperar(500)
      // O corte é aproximado (MAXLEN ~), por nó do stream: fica perto do teto, longe das 1.000 emissões.
      expect(await redis.xlen(PREFIXO_REDIS_REALTIME)).toBeLessThanOrEqual(300)
    } finally {
      await emissor.fechar()
      await redis.quit()
    }
  })
})

describe('drenagem do realtime', () => {
  it('põe /prontidao em 503 com os clientes ainda conectados e, ao fechar, os derruba com motivo que permite reconectar', async () => {
    const instancia = await subirInstancia(loggerEmMemoria().logger, { DRENAGEM_ESPERA_BORDA_MS: '1000', DRENAGEM_PRAZO_MS: '5000' })
    const cliente = registrar(criarCliente(instancia.url, await SESSAO_A1.tokenNovo()))
    // Sem reconexão aqui: o teste quer ver o motivo da queda, não a volta.
    cliente.io.opts.reconnection = false
    await conectar(cliente)
    const motivo = new Promise<string>((resolver) => cliente.once('disconnect', resolver))

    const fechamento = instancia.app.close()
    await esperar(200)
    const prontidao = await fetch(`${instancia.url}/prontidao`)
    expect(prontidao.status).toBe(503)
    expect(await prontidao.json()).toEqual({ pronta: false })
    expect(cliente.connected).toBe(true)

    await fechamento
    // "transport close" reconecta sozinho; "io server disconnect" deixaria o cliente parado.
    expect(await motivo).toBe('transport close')
  })

  it('com clientes conectados e conexões que a borda discou e não usou, o fechamento termina logo depois da espera, sem estourar o prazo', async () => {
    const esperaDaBordaMs = 500
    // O prazo encerraria o processo com código 1: aqui ele fica longe, e o teste mede o fechamento.
    const instancia = await subirInstancia(loggerEmMemoria().logger, { DRENAGEM_ESPERA_BORDA_MS: String(esperaDaBordaMs), DRENAGEM_PRAZO_MS: '60000' })
    const token = await SESSAO_A1.tokenNovo()
    const conectados = await Promise.all(
      Array.from({ length: 12 }, async (_, indice) => {
        // Metade fica no long-polling, metade sobe para websocket, como os alunos atrás da borda.
        const cliente = registrar(criarCliente(instancia.url, token, indice % 2 === 0 ? { transports: ['polling'] } : {}))
        await conectar(cliente)
        return cliente
      }),
    )
    const { port } = new URL(instancia.url)
    const semUso = await Promise.all(
      Array.from({ length: 3 }, async () => {
        const conexao = connect(Number(port), '127.0.0.1')
        await once(conexao, 'connect')
        return conexao
      }),
    )
    try {
      const inicio = performance.now()
      const fechamento = instancia.app.close().then(() => 'fechou' as const)
      expect(await Promise.race([fechamento, esperar(esperaDaBordaMs + 2_000, 'segurou')])).toBe('fechou')
      expect(performance.now() - inicio).toBeLessThan(esperaDaBordaMs + 2_000)
      await expect.poll(() => conectados.filter((cliente) => cliente.connected).length).toBe(0)
    } finally {
      for (const conexao of semUso) conexao.destroy()
    }
  }, 90_000)

  it('drenando, GET a rota inexistente não derruba a instância, e o long-polling em andamento fecha dentro do prazo', async () => {
    const excecoesSemTratamento: unknown[] = []
    const aoExcecao = (erro: unknown) => excecoesSemTratamento.push(erro)
    process.on('uncaughtException', aoExcecao)
    try {
      const instancia = await subirInstancia(loggerEmMemoria().logger, { DRENAGEM_ESPERA_BORDA_MS: '1000', DRENAGEM_PRAZO_MS: '5000' })
      const cliente = registrar(criarCliente(instancia.url, await SESSAO_A1.tokenNovo(), { transports: ['polling'] }))
      cliente.io.opts.reconnection = false
      await conectar(cliente)

      const inicio = performance.now()
      const fechamento = instancia.app.close()
      await esperar(200)
      const inexistente = await fetch(`${instancia.url}/rota-que-nao-existe`)
      expect(inexistente.status).toBe(404)
      expect(inexistente.headers.get('connection')).toBe('close')

      await fechamento
      expect(performance.now() - inicio).toBeLessThan(5_000)
      await expect.poll(() => cliente.connected).toBe(false)
      expect(excecoesSemTratamento).toEqual([])
    } finally {
      process.off('uncaughtException', aoExcecao)
    }
  })
})
