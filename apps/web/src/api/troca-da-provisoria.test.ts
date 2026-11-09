import { ErrorCode } from '@educa/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A troca da senha provisória na web (acesso-e-convites, 13.0; RF13): o bilhete que o login devolve fica só na memória do módulo de sessão, vai só no `Authorization`, some quando a sessão
 * abre e muda de dono a cada aluno que chega. Como o módulo guarda o bilhete em variável de módulo (regra 50, item 7), cada teste o recarrega, como uma aba recém-aberta.
 */
interface RespostaSimulada {
  readonly status: number
  readonly corpo?: unknown
  readonly cabecalhos?: Record<string, string>
}

interface Chamada {
  readonly caminho: string
  readonly metodo: string
  readonly autorizacao: string | null
  readonly corpo: unknown
}

const chamadas: Chamada[] = []
let fila: RespostaSimulada[] = []

const importarSessao = () => import('./sessao')
const importarTroca = () => import('./troca-da-provisoria')
const importarCliente = () => import('./client')

let sessao: Awaited<ReturnType<typeof importarSessao>>
let troca: Awaited<ReturnType<typeof importarTroca>>
let cliente: Awaited<ReturnType<typeof importarCliente>>

const DAQUI_A_MUITO = '2099-01-01T00:00:00.000Z'
const PRONTA = { etapa: 'pronta', token: 'token-do-aluno', expiraEm: DAQUI_A_MUITO }
const BILHETE_A = 'bilhete.da.aluna.a'
const BILHETE_B = 'bilhete.do.aluno.b'
const TROCAR_SENHA = (bilhete: string) => ({ etapa: 'trocar_senha', bilhete })
const ENTRADA = { slug: 'colegio-a', matricula: '1234', senha: 'ABCD-EFGH' }

function envelope(codigo: string) {
  return { erro: { codigo, mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } }
}

function responderCom(...respostas: RespostaSimulada[]): void {
  fila = [...respostas]
}

function corpoEnviado(opcoes: RequestInit | undefined): unknown {
  return typeof opcoes?.body === 'string' ? (JSON.parse(opcoes.body) as unknown) : undefined
}

beforeEach(async () => {
  chamadas.length = 0
  fila = []
  vi.resetModules()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (caminho: string, opcoes?: RequestInit) => {
      const metodo = opcoes?.method ?? 'GET'
      chamadas.push({ caminho, metodo, autorizacao: new Headers(opcoes?.headers).get('Authorization'), corpo: corpoEnviado(opcoes) })
      const resposta = fila.shift()
      if (resposta === undefined) throw new Error(`chamada sem resposta preparada: ${metodo} ${caminho}`)
      await Promise.resolve()
      return new Response(resposta.corpo === undefined ? null : JSON.stringify(resposta.corpo), { status: resposta.status, headers: resposta.cabecalhos ?? {} })
    }),
  )
  ;[sessao, troca, cliente] = await Promise.all([importarSessao(), importarTroca(), importarCliente()])
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  expect(fila, 'resposta preparada que nenhuma chamada consumiu').toHaveLength(0)
})

describe('o login de matrícula com a senha provisória', () => {
  it('guarda o bilhete em memória e devolve só a etapa: o bilhete não sai da resposta, e nenhuma sessão abre', async () => {
    responderCom({ status: 200, corpo: TROCAR_SENHA(BILHETE_A) })
    const resposta = await sessao.entrarPorMatricula(ENTRADA)

    expect(resposta).toEqual({ etapa: 'trocar_senha' })
    expect(sessao.bilheteDaTroca()).toEqual({ valor: BILHETE_A, numero: 1 })
    expect(sessao.estadoDaSessao()).not.toBe('aberta')
    expect(sessao.tokenDeAcesso()).toBeUndefined()
  })

  it('o aluno seguinte no mesmo computador ganha outro número e o bilhete dele no lugar do anterior', async () => {
    responderCom({ status: 200, corpo: TROCAR_SENHA(BILHETE_A) }, { status: 200, corpo: TROCAR_SENHA(BILHETE_B) })
    await sessao.entrarPorMatricula(ENTRADA)
    await sessao.entrarPorMatricula({ ...ENTRADA, matricula: '5678' })

    expect(sessao.bilheteDaTroca()).toEqual({ valor: BILHETE_B, numero: 2 })
  })

  it('o login comum que abre a sessão leva o bilhete antigo junto: nada da troca sobra na aba', async () => {
    responderCom({ status: 200, corpo: TROCAR_SENHA(BILHETE_A) }, { status: 200, corpo: PRONTA })
    await sessao.entrarPorMatricula(ENTRADA)
    await sessao.entrarPorMatricula({ ...ENTRADA, matricula: '5678', senha: 'senha-comum-do-aluno' })

    expect(sessao.estadoDaSessao()).toBe('aberta')
    expect(sessao.bilheteDaTroca()).toBeUndefined()
  })

  it('o "Voltar à entrada" esquece o bilhete', async () => {
    responderCom({ status: 200, corpo: TROCAR_SENHA(BILHETE_A) })
    await sessao.entrarPorMatricula(ENTRADA)
    sessao.esquecerBilheteDaTroca()

    expect(sessao.bilheteDaTroca()).toBeUndefined()
  })
})

describe('trocar a senha', () => {
  it('manda o bilhete só no Authorization e a senha só no corpo; a sessão abre e o bilhete sai da memória', async () => {
    responderCom({ status: 200, corpo: TROCAR_SENHA(BILHETE_A) })
    await sessao.entrarPorMatricula(ENTRADA)
    chamadas.length = 0
    responderCom({ status: 200, corpo: PRONTA })

    const resposta = await sessao.trocarSenhaProvisoria('uma-frase-que-so-a-aluna-sabe')

    expect(resposta).toEqual(PRONTA)
    expect(chamadas).toEqual([
      { caminho: sessao.CAMINHO_DA_TROCA_DA_PROVISORIA, metodo: 'POST', autorizacao: `Bearer ${BILHETE_A}`, corpo: { senha: 'uma-frase-que-so-a-aluna-sabe' } },
    ])
    // Nem o bilhete nem a senha vão na URL.
    expect(chamadas[0]?.caminho).not.toContain(BILHETE_A)
    expect(chamadas[0]?.caminho).not.toContain('uma-frase')
    expect(sessao.estadoDaSessao()).toBe('aberta')
    expect(sessao.bilheteDaTroca()).toBeUndefined()
  })

  it('sem bilhete nesta aba (um F5), responde como o bilhete que não vale, sem chamar a rede', async () => {
    const erro = await sessao.trocarSenhaProvisoria('uma-frase-que-so-a-aluna-sabe').then(
      () => undefined,
      (motivo: unknown) => motivo,
    )

    expect(erro).toBeInstanceOf(cliente.ApiError)
    expect((erro as InstanceType<typeof cliente.ApiError>).codigo).toBe(ErrorCode.NAO_AUTENTICADO)
    expect(chamadas).toHaveLength(0)
  })

  it('o bilhete que a API recusa continua na memória até a tela decidir: a recusa não abre sessão', async () => {
    responderCom({ status: 200, corpo: TROCAR_SENHA(BILHETE_A) })
    await sessao.entrarPorMatricula(ENTRADA)
    responderCom({ status: 401, corpo: envelope(ErrorCode.NAO_AUTENTICADO) })

    await expect(sessao.trocarSenhaProvisoria('uma-frase-que-so-a-aluna-sabe')).rejects.toBeInstanceOf(cliente.ApiError)
    expect(sessao.estadoDaSessao()).not.toBe('aberta')
  })

  it('o 503 do semáforo do hash é atraso também aqui: a troca espera o Retry-After e tenta de novo', async () => {
    responderCom({ status: 200, corpo: TROCAR_SENHA(BILHETE_A) })
    await sessao.entrarPorMatricula(ENTRADA)
    chamadas.length = 0
    vi.useFakeTimers()
    responderCom({ status: 503, corpo: envelope(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO), cabecalhos: { 'Retry-After': '2' } }, { status: 200, corpo: PRONTA })

    const troca = sessao.trocarSenhaProvisoria('uma-frase-que-so-a-aluna-sabe')
    await vi.advanceTimersByTimeAsync(2_000)

    await expect(troca).resolves.toEqual(PRONTA)
    expect(chamadas).toHaveLength(2)
    expect(chamadas.every((chamada) => chamada.autorizacao === `Bearer ${BILHETE_A}`)).toBe(true)
  })
})

describe('as provisórias de antes', () => {
  it('lê com o bilhete no Authorization, e o bilhete não entra na chave nem no endereço: a chave leva o número do aluno', async () => {
    responderCom({ status: 200, corpo: TROCAR_SENHA(BILHETE_A) })
    await sessao.entrarPorMatricula(ENTRADA)
    chamadas.length = 0
    responderCom({ status: 200, corpo: { anteriores: [] } })

    const opcoes = troca.trocasDaProvisoriaQueryOptions(1)
    const lista = await (opcoes.queryFn as (contexto: { signal: AbortSignal }) => Promise<unknown>)({ signal: new AbortController().signal })

    expect(lista).toEqual({ anteriores: [] })
    expect(chamadas).toEqual([{ caminho: troca.CAMINHO_DAS_TROCAS, metodo: 'GET', autorizacao: `Bearer ${BILHETE_A}`, corpo: undefined }])
    expect(JSON.stringify(opcoes.queryKey)).not.toContain(BILHETE_A)
    expect(troca.trocasDaProvisoriaQueryOptions(2).queryKey).not.toEqual(opcoes.queryKey)
    // Sai do cache assim que a tela sai, e não se refaz ao voltar o foco: a lista não muda, e cada leitura é uma chamada a mais às 7h30.
    expect(opcoes.gcTime).toBe(0)
    expect(opcoes.staleTime).toBe(Infinity)
    expect(opcoes.refetchOnWindowFocus).toBe(false)
  })

  it('sem bilhete, a leitura falha como o bilhete que não vale, sem chamar a rede', async () => {
    const opcoes = troca.trocasDaProvisoriaQueryOptions(1)
    const erro = await (opcoes.queryFn as (contexto: { signal: AbortSignal }) => Promise<unknown>)({ signal: new AbortController().signal }).then(
      () => undefined,
      (motivo: unknown) => motivo,
    )

    expect((erro as InstanceType<typeof cliente.ApiError>).codigo).toBe(ErrorCode.NAO_AUTENTICADO)
    expect(chamadas).toHaveLength(0)
  })

  it('cada linha diz quem gerou, quando e se foi usada, como a aluna lê', () => {
    const geradaEm = '2026-11-12T17:05:00.000Z'
    // O fuso da unidade é Tóquio: 17:05 de UTC é 02:05 do dia 13. O texto "14:05" de São Paulo é o do e2e.
    expect(troca.textoDaProvisoriaAnterior({ geradaEm, papel: 'coordenador', usada: true })).toBe('Gerada pela coordenação em 13/11/2026 às 02:05 · usada')
    expect(troca.textoDaProvisoriaAnterior({ geradaEm, papel: 'professor', usada: false })).toBe('Gerada pelo professor em 13/11/2026 às 02:05 · não usada')
  })
})
