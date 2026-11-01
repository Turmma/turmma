import { ErrorCode, euDoOperadorResponseSchema } from '@educa/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEXTO_DA_SAIDA_NAO_CONFIRMADA, TEXTO_DA_SESSAO_ENCERRADA } from '../textos'

/**
 * A sessão do operador guarda token e desafio em variável de módulo (regra 50, item 7): cada teste começa com o módulo
 * recarregado, como uma aba recém-aberta. Para duas abas, o módulo é importado duas vezes, e o `BroadcastChannel` falso
 * entrega a mensagem de uma à outra, como o navegador faz.
 */
type ModuloDeSessao = Awaited<ReturnType<typeof importarSessao>>
const importarSessao = () => import('./sessao')

interface RespostaFalsa {
  readonly status: number
  readonly corpo?: unknown
  readonly cabecalhos?: Record<string, string>
  readonly semRede?: boolean
  /** Segura a resposta até o teste liberar: é a renovação que ainda está no ar quando a pessoa sai. */
  readonly segurar?: Promise<void>
}

interface Chamada {
  readonly caminho: string
  readonly metodo: string
  readonly autorizacao: string | null
  readonly corpo: unknown
}

const chamadas: Chamada[] = []
let fila: RespostaFalsa[] = []

const DAQUI_A_MUITO = '2099-01-01T00:00:00.000Z'
const EU = { apelido: 'ana-op', nome: 'Ana da Operação' }

function envelope(codigo: string) {
  return { erro: { codigo, mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } }
}

function responderCom(...respostas: RespostaFalsa[]): void {
  fila.push(...respostas)
}

function instalarFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (caminho: string, opcoes?: RequestInit) => {
      const cabecalhos = new Headers(opcoes?.headers)
      const corpo = typeof opcoes?.body === 'string' ? (JSON.parse(opcoes.body) as unknown) : undefined
      chamadas.push({ caminho, metodo: opcoes?.method ?? 'GET', autorizacao: cabecalhos.get('Authorization'), corpo })
      const resposta = fila.shift()
      if (resposta === undefined) throw new Error(`chamada sem resposta preparada: ${opcoes?.method ?? 'GET'} ${caminho}`)
      await (resposta.segurar ?? Promise.resolve())
      if (resposta.semRede) throw new TypeError('Failed to fetch')
      return new Response(resposta.corpo === undefined ? null : JSON.stringify(resposta.corpo), { status: resposta.status, headers: resposta.cabecalhos ?? {} })
    }),
  )
}

/** Os `BroadcastChannel` abertos, por nome: a mensagem de um chega aos outros do mesmo nome, nunca a ele mesmo. */
const canaisAbertos: { nome: string; canal: EventTarget }[] = []

function instalarBroadcastChannel(): void {
  class CanalFalso extends EventTarget {
    constructor(readonly name: string) {
      super()
      canaisAbertos.push({ nome: name, canal: this })
    }
    postMessage(dado: unknown): void {
      for (const { nome, canal } of canaisAbertos) {
        if (nome === this.name && canal !== this) canal.dispatchEvent(new MessageEvent('message', { data: dado }))
      }
    }
    close(): void {
      return undefined
    }
  }
  vi.stubGlobal('BroadcastChannel', CanalFalso)
}

/**
 * As Web Locks como o navegador as dá: um pedido por vez em cada nome, e o seguinte só começa quando a tarefa do
 * anterior termina. Um objeto só, para as duas abas do teste, como o navegador é um só.
 */
function travasEmFila(): { request: (nome: string, tarefa: () => Promise<unknown>) => Promise<unknown> } {
  const filas = new Map<string, Promise<unknown>>()
  return {
    request: (nome, tarefa) => {
      const vez = (filas.get(nome) ?? Promise.resolve()).then(tarefa)
      filas.set(
        nome,
        vez.catch(() => undefined),
      )
      return vez
    },
  }
}

async function erroDe(promessa: Promise<unknown>): Promise<{ codigo: string }> {
  const erro = await promessa.then(
    () => undefined,
    (motivo: unknown) => motivo,
  )
  expect(erro).toHaveProperty('codigo')
  return erro as { codigo: string }
}

/** E-mail e senha, depois o código: a aba fica com a sessão aberta e o token dado. Zera as chamadas. */
async function entrar(sessao: ModuloDeSessao, pessoa: { email: string; desafio: string; token: string }): Promise<void> {
  responderCom({ status: 200, corpo: { etapa: 'mfa', desafio: pessoa.desafio } }, { status: 200, corpo: { token: pessoa.token, expiraEm: DAQUI_A_MUITO } })
  await sessao.entrarComoOperador({ email: pessoa.email, senha: 'senha-de-operador-comprida' })
  await sessao.entrarComSegundoFatorDeOperador({ codigo: '123456' })
  chamadas.length = 0
}

const ANA = { email: 'ana@turmma.invalid', desafio: 'desafio-da-ana', token: 'token-da-ana' }
const BRUNO = { email: 'bruno@turmma.invalid', desafio: 'desafio-do-bruno', token: 'token-do-bruno' }

let sessao: ModuloDeSessao

beforeEach(async () => {
  chamadas.length = 0
  fila = []
  canaisAbertos.length = 0
  vi.resetModules()
  instalarFetch()
  instalarBroadcastChannel()
  sessao = await importarSessao()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  expect(fila, 'resposta preparada que nenhuma chamada consumiu').toHaveLength(0)
})

const buscarEu = (modulo: ModuloDeSessao = sessao) => modulo.operadorAuthedRequest('/v1/operacao/eu', euDoOperadorResponseSchema)

describe('as três respostas da conferência da sessão', () => {
  it('ACESSO_VENCIDO renova pelo cookie e repete a mesma chamada com o acesso novo, sem a pessoa perceber', async () => {
    await entrar(sessao, ANA)
    responderCom(
      { status: 401, corpo: envelope(ErrorCode.ACESSO_VENCIDO) },
      { status: 200, corpo: { token: 'token-renovado', expiraEm: DAQUI_A_MUITO } },
      { status: 200, corpo: EU },
    )

    await expect(buscarEu()).resolves.toEqual(EU)

    expect(chamadas.map((chamada) => [chamada.metodo, chamada.caminho, chamada.autorizacao])).toEqual([
      ['GET', '/v1/operacao/eu', `Bearer ${ANA.token}`],
      ['POST', sessao.CAMINHO_DA_RENOVACAO_DE_OPERADOR, null],
      ['GET', '/v1/operacao/eu', 'Bearer token-renovado'],
    ])
    expect(sessao.estadoDaSessaoDeOperador()).toBe('aberta')
    expect(sessao.avisoDaEntradaDeOperador()).toBeUndefined()
  })

  it('duas chamadas em paralelo que recebem ACESSO_VENCIDO renovam uma vez só, e as duas repetem com o acesso novo', async () => {
    await entrar(sessao, ANA)
    responderCom(
      { status: 401, corpo: envelope(ErrorCode.ACESSO_VENCIDO) },
      { status: 401, corpo: envelope(ErrorCode.ACESSO_VENCIDO) },
      { status: 200, corpo: { token: 'token-renovado', expiraEm: DAQUI_A_MUITO } },
      { status: 200, corpo: EU },
      { status: 200, corpo: EU },
    )

    await expect(Promise.all([buscarEu(), buscarEu()])).resolves.toEqual([EU, EU])

    expect(chamadas.filter((chamada) => chamada.caminho === sessao.CAMINHO_DA_RENOVACAO_DE_OPERADOR)).toHaveLength(1)
    expect(chamadas.filter((chamada) => chamada.caminho === '/v1/operacao/eu').map((chamada) => chamada.autorizacao)).toEqual([
      `Bearer ${ANA.token}`,
      `Bearer ${ANA.token}`,
      'Bearer token-renovado',
      'Bearer token-renovado',
    ])
  })

  it('ACESSO_VENCIDO de novo depois da renovação sobe como erro, sem encerrar a sessão: só se renova uma vez', async () => {
    await entrar(sessao, ANA)
    responderCom(
      { status: 401, corpo: envelope(ErrorCode.ACESSO_VENCIDO) },
      { status: 200, corpo: { token: 'token-renovado', expiraEm: DAQUI_A_MUITO } },
      { status: 401, corpo: envelope(ErrorCode.ACESSO_VENCIDO) },
    )

    expect((await erroDe(buscarEu())).codigo).toBe(ErrorCode.ACESSO_VENCIDO)
    expect(chamadas).toHaveLength(3)
    expect(sessao.estadoDaSessaoDeOperador()).toBe('aberta')
  })

  it('o acesso vencido pelo relógio da aba é renovado antes de a chamada sair: nenhuma requisição só para ouvir 401', async () => {
    vi.useFakeTimers({ now: new Date('2026-09-24T12:00:00.000Z') })
    responderCom({ status: 200, corpo: { etapa: 'mfa', desafio: ANA.desafio } }, { status: 200, corpo: { token: ANA.token, expiraEm: '2026-09-24T12:10:00.000Z' } })
    await sessao.entrarComoOperador({ email: ANA.email, senha: 'senha-de-operador-comprida' })
    await sessao.entrarComSegundoFatorDeOperador({ codigo: '123456' })
    chamadas.length = 0
    vi.setSystemTime(new Date('2026-09-24T12:11:00.000Z'))
    responderCom({ status: 200, corpo: { token: 'token-renovado', expiraEm: '2026-09-24T12:21:00.000Z' } }, { status: 200, corpo: EU })

    await buscarEu()

    expect(chamadas.map((chamada) => [chamada.caminho, chamada.autorizacao])).toEqual([
      [sessao.CAMINHO_DA_RENOVACAO_DE_OPERADOR, null],
      ['/v1/operacao/eu', 'Bearer token-renovado'],
    ])
  })

  it('SESSAO_ENCERRADA esquece tudo e leva à entrada com a mensagem de sessão encerrada', async () => {
    await entrar(sessao, ANA)
    const aoTrocar = vi.fn()
    sessao.aoTrocarDeSessaoDeOperador(aoTrocar)
    responderCom({ status: 401, corpo: envelope(ErrorCode.SESSAO_ENCERRADA) })

    expect((await erroDe(buscarEu())).codigo).toBe(ErrorCode.SESSAO_ENCERRADA)

    expect(sessao.estadoDaSessaoDeOperador()).toBe('anonima')
    expect(sessao.avisoDaEntradaDeOperador()).toBe(TEXTO_DA_SESSAO_ENCERRADA)
    expect(sessao.tokenDeOperador()).toBeUndefined()
    expect(aoTrocar).toHaveBeenCalledTimes(1)
    // E nada mais sai com a sessão encerrada: a chamada seguinte nem chega à API.
    expect((await erroDe(buscarEu())).codigo).toBe(ErrorCode.SESSAO_ENCERRADA)
    expect(chamadas).toHaveLength(1)
  })

  it('a renovação recusada depois do ACESSO_VENCIDO também leva à entrada com a mensagem', async () => {
    await entrar(sessao, ANA)
    responderCom({ status: 401, corpo: envelope(ErrorCode.ACESSO_VENCIDO) }, { status: 401, corpo: envelope(ErrorCode.SESSAO_ENCERRADA) })

    expect((await erroDe(buscarEu())).codigo).toBe(ErrorCode.SESSAO_ENCERRADA)
    expect(sessao.estadoDaSessaoDeOperador()).toBe('anonima')
    expect(sessao.avisoDaEntradaDeOperador()).toBe(TEXTO_DA_SESSAO_ENCERRADA)
  })

  it('503 sobe como indisponível e a sessão fica: token, estado e nenhuma mensagem de sessão encerrada', async () => {
    await entrar(sessao, ANA)
    responderCom({ status: 503, corpo: envelope(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO) })

    expect((await erroDe(buscarEu())).codigo).toBe(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
    expect(sessao.estadoDaSessaoDeOperador()).toBe('aberta')
    expect(sessao.tokenDeOperador()).toBe(ANA.token)
    expect(sessao.avisoDaEntradaDeOperador()).toBeUndefined()
  })
})

describe('abrir a aba pelo cookie', () => {
  it('sem sessão no cookie, fica anônima sem aviso: quem só abriu a operação não teve sessão nenhuma terminada', async () => {
    responderCom({ status: 401, corpo: envelope(ErrorCode.SESSAO_ENCERRADA) })
    await sessao.abrirSessaoDeOperadorPeloCookie()
    expect(sessao.estadoDaSessaoDeOperador()).toBe('anonima')
    expect(sessao.avisoDaEntradaDeOperador()).toBeUndefined()
  })

  it('com a API fora, fica indisponível, e não anônima: ninguém vai à entrada porque o banco caiu', async () => {
    responderCom({ status: 503, corpo: envelope(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO) })
    await sessao.abrirSessaoDeOperadorPeloCookie()
    expect(sessao.estadoDaSessaoDeOperador()).toBe('indisponivel')
  })

  it('renova sob a trava própria das Web Locks, e não a da escola', async () => {
    const pedidas: string[] = []
    vi.stubGlobal('navigator', { locks: { request: (nome: string, tarefa: () => Promise<unknown>) => (pedidas.push(nome), tarefa()) } })
    responderCom({ status: 200, corpo: { token: ANA.token, expiraEm: DAQUI_A_MUITO } })
    await sessao.abrirSessaoDeOperadorPeloCookie()
    expect(pedidas).toEqual(['turmma-operacao-renovacao'])
    expect(sessao.estadoDaSessaoDeOperador()).toBe('aberta')
    // Renovar não é uso (tarefa 8.0): o relógio de inatividade só começa na primeira requisição aceita.
    expect(sessao.ultimoUsoDaSessaoDeOperador()).toBeUndefined()
  })

  it('duas abas que renovam juntas esperam a vez na trava das Web Locks: a segunda renovação só sai depois de a primeira voltar', async () => {
    vi.stubGlobal('navigator', { locks: travasEmFila() })
    vi.resetModules()
    const outraAba = await importarSessao()
    let liberar: () => void = () => undefined
    const segurar = new Promise<void>((resolver) => (liberar = resolver))
    responderCom({ status: 200, corpo: { token: 'token-desta-aba', expiraEm: DAQUI_A_MUITO }, segurar }, { status: 200, corpo: { token: 'token-da-outra-aba', expiraEm: DAQUI_A_MUITO } })
    const renovacoes = () => chamadas.filter((chamada) => chamada.caminho === sessao.CAMINHO_DA_RENOVACAO_DE_OPERADOR).length

    const juntas = Promise.all([sessao.renovarSessaoDeOperador(), outraAba.renovarSessaoDeOperador()])
    await new Promise((resolver) => setTimeout(resolver, 10))
    // A primeira está no ar, segurada: a da outra aba espera na trava, sem sair.
    expect(renovacoes()).toBe(1)

    liberar()
    await juntas
    expect(renovacoes()).toBe(2)
    expect(sessao.tokenDeOperador()).toBe('token-desta-aba')
    expect(outraAba.tokenDeOperador()).toBe('token-da-outra-aba')
  })
})

describe('o segundo fator gasta o desafio', () => {
  async function comDesafio(): Promise<void> {
    responderCom({ status: 200, corpo: { etapa: 'mfa', desafio: ANA.desafio } })
    await sessao.entrarComoOperador({ email: ANA.email, senha: 'senha-de-operador-comprida' })
    chamadas.length = 0
  }

  it('o desafio vai no corpo, e o código recusado o esquece aqui também: a pessoa refaz a senha', async () => {
    await comDesafio()
    responderCom({ status: 401, corpo: envelope(ErrorCode.NAO_AUTENTICADO) })

    expect((await erroDe(sessao.entrarComSegundoFatorDeOperador({ codigo: '000000' }))).codigo).toBe(ErrorCode.NAO_AUTENTICADO)

    expect(chamadas[0]).toMatchObject({ caminho: sessao.CAMINHO_DO_SEGUNDO_FATOR_DE_OPERADOR, autorizacao: null, corpo: { desafio: ANA.desafio, codigo: '000000' } })
    expect(sessao.desafioDeOperador('mfa')).toBeUndefined()
    // Sem desafio, a tentativa seguinte nem sai: a API a recusaria do mesmo jeito.
    expect((await erroDe(sessao.entrarComSegundoFatorDeOperador({ codigo: '111111' }))).codigo).toBe(ErrorCode.NAO_AUTENTICADO)
    expect(chamadas).toHaveLength(1)
  })

  it.each([
    ['formato inválido, recusado antes do consumo', 400, ErrorCode.ENTRADA_INVALIDA],
    ['503, que pode não ter chegado ao consumo', 503, ErrorCode.INDISPONIVEL_TENTE_DE_NOVO],
  ])('%s: o desafio fica, e a pessoa tenta de novo na mesma tela', async (_caso, status, codigo) => {
    await comDesafio()
    responderCom({ status, corpo: envelope(codigo) })
    expect((await erroDe(sessao.entrarComSegundoFatorDeOperador({ codigo: '000000' }))).codigo).toBe(codigo)
    expect(sessao.desafioDeOperador('mfa')).toBe(ANA.desafio)
  })

  it('dois envios juntos (o clique duplo em "Entrar") saem como um pedido só, e os dois recebem a sessão aberta', async () => {
    await comDesafio()
    responderCom({ status: 200, corpo: { token: ANA.token, expiraEm: DAQUI_A_MUITO } })

    await Promise.all([sessao.entrarComSegundoFatorDeOperador({ codigo: '123456' }), sessao.entrarComSegundoFatorDeOperador({ codigo: '123456' })])

    expect(chamadas.map((chamada) => chamada.caminho)).toEqual([sessao.CAMINHO_DO_SEGUNDO_FATOR_DE_OPERADOR])
    expect(sessao.estadoDaSessaoDeOperador()).toBe('aberta')
    expect(sessao.tokenDeOperador()).toBe(ANA.token)
  })

  it('o envio que já voltou não segura o seguinte: depois de um 503 dos dois envios juntos, a nova tentativa sai', async () => {
    await comDesafio()
    responderCom({ status: 503, corpo: envelope(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO) })

    const juntos = await Promise.allSettled([sessao.entrarComSegundoFatorDeOperador({ codigo: '123456' }), sessao.entrarComSegundoFatorDeOperador({ codigo: '123456' })])
    expect(juntos.map((resultado) => resultado.status)).toEqual(['rejected', 'rejected'])
    expect(chamadas).toHaveLength(1)

    responderCom({ status: 200, corpo: { token: ANA.token, expiraEm: DAQUI_A_MUITO } })
    await sessao.entrarComSegundoFatorDeOperador({ codigo: '654321' })
    expect(chamadas.map((chamada) => chamada.corpo)).toEqual([
      { desafio: ANA.desafio, codigo: '123456' },
      { desafio: ANA.desafio, codigo: '654321' },
    ])
    expect(sessao.estadoDaSessaoDeOperador()).toBe('aberta')
  })
})

describe('o Sair', () => {
  it('dois Sair juntos (o clique duplo): um pedido à API e a sessão esquecida uma vez; o Sair da sessão seguinte sai de novo', async () => {
    const aoTrocar = vi.fn()
    sessao.aoTrocarDeSessaoDeOperador(aoTrocar)
    await entrar(sessao, ANA)
    aoTrocar.mockClear()
    responderCom({ status: 204 })

    await Promise.all([sessao.sairComoOperador(), sessao.sairComoOperador()])

    expect(chamadas.map((chamada) => chamada.caminho)).toEqual([sessao.CAMINHO_DA_SAIDA_DE_OPERADOR])
    expect(aoTrocar).toHaveBeenCalledTimes(1)
    expect(sessao.estadoDaSessaoDeOperador()).toBe('anonima')

    await entrar(sessao, BRUNO)
    responderCom({ status: 204 })
    await sessao.sairComoOperador()
    expect(chamadas.map((chamada) => chamada.caminho)).toEqual([sessao.CAMINHO_DA_SAIDA_DE_OPERADOR])
    expect(sessao.tokenDeOperador()).toBeUndefined()
  })
})

describe('sem resíduo da pessoa anterior', () => {
  it('sair como Ana e entrar como Bruno na mesma aba: nada da Ana fica em memória nem sai em requisição', async () => {
    const aoTrocar = vi.fn()
    sessao.aoTrocarDeSessaoDeOperador(aoTrocar)
    await entrar(sessao, ANA)
    responderCom({ status: 200, corpo: EU })
    await buscarEu()
    expect(sessao.ultimoUsoDaSessaoDeOperador()).toBeDefined()
    aoTrocar.mockClear()

    responderCom({ status: 204 })
    await sessao.sairComoOperador()

    expect(sessao.tokenDeOperador()).toBeUndefined()
    expect(sessao.desafioDeOperador('mfa')).toBeUndefined()
    expect(sessao.ultimoUsoDaSessaoDeOperador()).toBeUndefined()
    expect(sessao.erroDaSessaoDeOperador()).toBeUndefined()
    expect(sessao.avisoDaEntradaDeOperador()).toBeUndefined()
    expect(sessao.estadoDaSessaoDeOperador()).toBe('anonima')
    // O cache da área (o `/eu` com o nome da Ana) é esvaziado na saída.
    expect(aoTrocar).toHaveBeenCalledTimes(1)

    chamadas.length = 0
    await entrar(sessao, BRUNO)
    responderCom({ status: 200, corpo: { apelido: 'bruno-op', nome: 'Bruno da Operação' } })
    await buscarEu()
    expect(chamadas.map((chamada) => chamada.autorizacao)).toEqual([`Bearer ${BRUNO.token}`])
    expect(sessao.tokenDeOperador()).toBe(BRUNO.token)
    // E a sessão nova esvazia o cache de novo, antes de o Bruno ver qualquer coisa.
    expect(aoTrocar).toHaveBeenCalledTimes(2)
  })

  it('o segundo fator do Bruno leva o desafio do Bruno, nunca o da Ana que desistiu no meio', async () => {
    responderCom({ status: 200, corpo: { etapa: 'mfa', desafio: ANA.desafio } })
    await sessao.entrarComoOperador({ email: ANA.email, senha: 'senha-de-operador-comprida' })
    // A Ana some; o Bruno digita a senha dele, e a senha errada não pode deixar o desafio da Ana para trás.
    responderCom({ status: 401, corpo: envelope(ErrorCode.NAO_AUTENTICADO) })
    await erroDe(sessao.entrarComoOperador({ email: BRUNO.email, senha: 'senha-errada-do-bruno' }))
    expect(sessao.desafioDeOperador('mfa')).toBeUndefined()

    responderCom({ status: 200, corpo: { etapa: 'mfa', desafio: BRUNO.desafio } }, { status: 200, corpo: { token: BRUNO.token, expiraEm: DAQUI_A_MUITO } })
    await sessao.entrarComoOperador({ email: BRUNO.email, senha: 'senha-de-operador-comprida' })
    await sessao.entrarComSegundoFatorDeOperador({ codigo: '123456' })
    expect(chamadas.at(-1)?.corpo).toEqual({ desafio: BRUNO.desafio, codigo: '123456' })
  })

  it('a renovação que estava no ar quando a Ana saiu não devolve o acesso dela à aba', async () => {
    await entrar(sessao, ANA)
    let liberar: () => void = () => undefined
    const segurar = new Promise<void>((resolver) => (liberar = resolver))
    responderCom({ status: 200, corpo: { token: 'token-da-ana-renovado', expiraEm: DAQUI_A_MUITO }, segurar }, { status: 204 })

    const renovacao = sessao.renovarSessaoDeOperador().catch((erro: unknown) => erro)
    await sessao.sairComoOperador()
    liberar()
    await renovacao

    expect(sessao.tokenDeOperador()).toBeUndefined()
    expect(sessao.estadoDaSessaoDeOperador()).toBe('anonima')
  })

  it('o Sair que a API não confirmou esquece a sessão aqui mesmo assim, e a entrada avisa', async () => {
    vi.useFakeTimers()
    await entrar(sessao, ANA)
    responderCom({ status: 0, semRede: true }, { status: 0, semRede: true })
    const saida = sessao.sairComoOperador()
    await vi.advanceTimersByTimeAsync(sessao.ESPERA_ENTRE_TENTATIVAS_DE_SAIDA_MS)
    await saida
    expect(sessao.tokenDeOperador()).toBeUndefined()
    expect(sessao.avisoDaEntradaDeOperador()).toBe(TEXTO_DA_SAIDA_NAO_CONFIRMADA)
  })
})

describe('duas abas da operação', () => {
  it('sair numa encerra a outra pelo canal próprio da operação, sem chamar a API da outra', async () => {
    await entrar(sessao, ANA)
    vi.resetModules()
    const outraAba = await importarSessao()
    responderCom({ status: 200, corpo: { token: 'token-da-outra-aba', expiraEm: DAQUI_A_MUITO } })
    await outraAba.abrirSessaoDeOperadorPeloCookie()
    // A outra aba liga o canal ao assinar a sessão, como a tela faz ao montar.
    outraAba.assinarSessaoDeOperador(() => undefined)
    sessao.assinarSessaoDeOperador(() => undefined)
    const aoTrocarNaOutra = vi.fn()
    outraAba.aoTrocarDeSessaoDeOperador(aoTrocarNaOutra)
    chamadas.length = 0

    responderCom({ status: 204 })
    await sessao.sairComoOperador()

    expect(outraAba.estadoDaSessaoDeOperador()).toBe('anonima')
    expect(outraAba.tokenDeOperador()).toBeUndefined()
    expect(aoTrocarNaOutra).toHaveBeenCalledTimes(1)
    // Uma saída só: a da aba que clicou.
    expect(chamadas.map((chamada) => chamada.caminho)).toEqual([sessao.CAMINHO_DA_SAIDA_DE_OPERADOR])
    // O canal é o da operação, e não o `educa-atividade` da escola: nenhuma aba de escola ouve esta saída.
    expect(new Set(canaisAbertos.map((aberto) => aberto.nome))).toEqual(new Set([sessao.CANAL_DA_OPERACAO]))
    expect(sessao.CANAL_DA_OPERACAO).not.toBe('educa-atividade')
  })

  it('a sessão nova aberta numa aba tira da outra o que era da sessão anterior', async () => {
    responderCom({ status: 200, corpo: { token: 'token-antigo', expiraEm: DAQUI_A_MUITO } })
    await sessao.abrirSessaoDeOperadorPeloCookie()
    sessao.assinarSessaoDeOperador(() => undefined)
    vi.resetModules()
    const outraAba = await importarSessao()
    outraAba.assinarSessaoDeOperador(() => undefined)

    await entrar(outraAba, BRUNO)

    expect(sessao.tokenDeOperador()).toBeUndefined()
    expect(sessao.estadoDaSessaoDeOperador()).toBe('anonima')
  })

  it('o uso numa aba empurra o relógio da outra', async () => {
    await entrar(sessao, ANA)
    sessao.assinarSessaoDeOperador(() => undefined)
    vi.resetModules()
    const outraAba = await importarSessao()
    outraAba.assinarSessaoDeOperador(() => undefined)
    responderCom({ status: 200, corpo: { token: 'token-da-outra-aba', expiraEm: DAQUI_A_MUITO } }, { status: 200, corpo: EU })
    await outraAba.abrirSessaoDeOperadorPeloCookie()
    const antes = sessao.ultimoUsoDaSessaoDeOperador() ?? 0

    await new Promise((resolver) => setTimeout(resolver, 5))
    await buscarEu(outraAba)

    expect(sessao.ultimoUsoDaSessaoDeOperador()).toBe(outraAba.ultimoUsoDaSessaoDeOperador())
    expect(sessao.ultimoUsoDaSessaoDeOperador() ?? 0).toBeGreaterThan(antes)
  })
})

describe('entrada por e-mail', () => {
  it('repete sozinha o 503 do semáforo com Retry-After, e guarda o desafio da etapa que a API devolveu', async () => {
    vi.useFakeTimers()
    responderCom(
      { status: 503, corpo: envelope(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO), cabecalhos: { 'Retry-After': '2' } },
      { status: 200, corpo: { etapa: 'configurar_mfa', desafio: 'desafio-de-configurar' } },
    )
    const entrada = sessao.entrarComoOperador({ email: ANA.email, senha: 'senha-de-operador-comprida' })
    await vi.advanceTimersByTimeAsync(2_000)
    await expect(entrada).resolves.toBe('configurar_mfa')
    expect(chamadas).toHaveLength(2)
    expect(sessao.desafioDeOperador('configurar_mfa')).toBe('desafio-de-configurar')
    expect(sessao.desafioDeOperador('mfa')).toBeUndefined()
  })

  it('503 sem Retry-After (queda, não fila) sobe na hora', async () => {
    responderCom({ status: 503, corpo: envelope(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO) })
    expect((await erroDe(sessao.entrarComoOperador({ email: ANA.email, senha: 'x' }))).codigo).toBe(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
    expect(chamadas).toHaveLength(1)
  })
})
