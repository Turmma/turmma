import { ALFABETO_DO_CODIGO_DE_RECUPERACAO, ErrorCode } from '@educa/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * As etapas do login que a 19.0 ligou à tela: matrícula, segundo fator e convite. Como o módulo de sessão guarda
 * token, desafio e bilhete em variável de módulo (regra 50, item 7), cada teste recarrega os módulos, como uma aba
 * recém-aberta.
 */
interface RespostaFalsa {
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
let fila: RespostaFalsa[] = []

const importarSessao = () => import('./sessao')
const importarConvite = () => import('./convite')
const importarMfa = () => import('./mfa')
const importarCliente = () => import('./client')

let sessao: Awaited<ReturnType<typeof importarSessao>>
let convite: Awaited<ReturnType<typeof importarConvite>>
let mfa: Awaited<ReturnType<typeof importarMfa>>
let cliente: Awaited<ReturnType<typeof importarCliente>>

const DAQUI_A_MUITO = '2099-01-01T00:00:00.000Z'
const PRONTA = { etapa: 'pronta', token: 'token-1', expiraEm: DAQUI_A_MUITO }

function envelope(codigo: string) {
  return { erro: { codigo, mensagem: 'texto que a tela não usa', requisicaoId: '0190f5a0-0000-7000-8000-000000000001' } }
}

function responderCom(...respostas: RespostaFalsa[]): void {
  fila = [...respostas]
}

async function erroDe(promessa: Promise<unknown>): Promise<InstanceType<typeof cliente.ErroDaApi>> {
  const erro = await promessa.then(
    () => undefined,
    (motivo: unknown) => motivo,
  )
  expect(erro).toBeInstanceOf(cliente.ErroDaApi)
  return erro as InstanceType<typeof cliente.ErroDaApi>
}

beforeEach(async () => {
  chamadas.length = 0
  fila = []
  vi.resetModules()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (caminho: string, opcoes?: RequestInit) => {
      const cabecalhos = new Headers(opcoes?.headers)
      const corpo = typeof opcoes?.body === 'string' ? (JSON.parse(opcoes.body) as unknown) : undefined
      chamadas.push({ caminho, metodo: opcoes?.method ?? 'GET', autorizacao: cabecalhos.get('Authorization'), corpo })
      const resposta = fila.shift()
      if (resposta === undefined) throw new Error(`chamada sem resposta preparada: ${opcoes?.method ?? 'GET'} ${caminho}`)
      await Promise.resolve()
      return new Response(resposta.corpo === undefined ? null : JSON.stringify(resposta.corpo), { status: resposta.status, headers: resposta.cabecalhos ?? {} })
    }),
  )
  ;[sessao, convite, mfa, cliente] = await Promise.all([importarSessao(), importarConvite(), importarMfa(), importarCliente()])
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  expect(fila, 'resposta preparada que nenhuma chamada consumiu').toHaveLength(0)
})

describe('entrada por matrícula', () => {
  it('manda o endereço da escola no corpo: é ele que diz de qual escola é a matrícula (RF7)', async () => {
    responderCom({ status: 200, corpo: PRONTA })
    await sessao.entrarPorMatricula({ slug: 'colegio-a', matricula: '1234', senha: 'senha-do-enzo' })
    expect(chamadas).toEqual([
      expect.objectContaining({
        caminho: sessao.CAMINHO_DA_ENTRADA_POR_MATRICULA,
        metodo: 'POST',
        corpo: { slug: 'colegio-a', matricula: '1234', senha: 'senha-do-enzo' },
        // O aluno não tem token nem desafio: a rota é anônima.
        autorizacao: null,
      }),
    ])
    expect(sessao.estadoDaSessao()).toBe('aberta')
  })

  it('o 503 do semáforo também é atraso aqui: às 7h30 quem está na fila é a turma inteira', async () => {
    vi.useFakeTimers()
    responderCom({ status: 503, corpo: envelope(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO), cabecalhos: { 'Retry-After': '2' } }, { status: 200, corpo: PRONTA })

    const entrada = sessao.entrarPorMatricula({ slug: 'colegio-a', matricula: '1234', senha: 'senha-do-enzo' })
    await vi.advanceTimersByTimeAsync(2_000)
    await expect(entrada).resolves.toEqual(PRONTA)
    expect(chamadas).toHaveLength(2)
  })
})

describe('segundo fator', () => {
  /** O login por e-mail que termina em `mfa`: é ele que deixa o desafio na memória desta aba. */
  async function comDesafioDeMfa(desafio = 'desafio.mfa.jwt'): Promise<void> {
    responderCom({ status: 200, corpo: { etapa: 'mfa', desafio } })
    await sessao.entrarPorEmail({ email: 'renata@escola.test', senha: 'segredo-da-renata' })
    chamadas.length = 0
  }

  it('manda o desafio da etapa no Authorization, e nunca o desafio de outra etapa', async () => {
    await comDesafioDeMfa()
    responderCom({ status: 200, corpo: PRONTA })
    await sessao.entrarComSegundoFator({ codigo: '123456' })
    expect(chamadas).toEqual([
      expect.objectContaining({ caminho: sessao.CAMINHO_DO_SEGUNDO_FATOR, metodo: 'POST', autorizacao: 'Bearer desafio.mfa.jwt', corpo: { codigo: '123456' } }),
    ])
    // O desafio da etapa `mfa` não serve para configurar o segundo fator de uma conta que ainda não o tem.
    expect(sessao.desafioDaEtapa('configurar_mfa')).toBeUndefined()
  })

  it('sem desafio nesta aba (um F5 na tela), nem sai chamada: a pessoa refaz a senha', async () => {
    const erro = await erroDe(sessao.entrarComSegundoFator({ codigo: '123456' }))
    expect(erro.codigo).toBe(ErrorCode.NAO_AUTENTICADO)
    expect(chamadas).toHaveLength(0)
  })

  it('o 503 não é repetido sozinho aqui: repetir gastaria tentativa do contador da conta com um código de 30 s', async () => {
    await comDesafioDeMfa()
    responderCom({ status: 503, corpo: envelope(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO), cabecalhos: { 'Retry-After': '2' } })
    const erro = await erroDe(sessao.entrarComSegundoFator({ codigo: '123456' }))
    expect(erro.codigo).toBe(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
    expect(chamadas).toHaveLength(1)
  })

  it('o desafio gasto no quinto código errado sai da memória, e o código certo seguinte nem chega à API', async () => {
    await comDesafioDeMfa()
    responderCom({ status: 429, corpo: envelope(ErrorCode.CONTA_SEGURADA), cabecalhos: { 'Retry-After': '30' } })
    const erro = await erroDe(sessao.entrarComSegundoFator({ codigo: '000000' }))
    expect(erro.esperaSegundos).toBe(30)

    // É a tela que esquece o desafio ao ver `CONTA_SEGURADA` (Mfa.tsx), porque só ela sabe que vai levar à entrada.
    sessao.esquecerDesafio()
    chamadas.length = 0
    expect((await erroDe(sessao.entrarComSegundoFator({ codigo: '123456' }))).codigo).toBe(ErrorCode.NAO_AUTENTICADO)
    expect(chamadas).toHaveLength(0)
  })

  it('configurar e ativar levam o desafio de configurar_mfa, e a ativação o esquece: ela o consome na API', async () => {
    responderCom({ status: 200, corpo: { etapa: 'configurar_mfa', desafio: 'desafio.configurar.jwt' } })
    await sessao.entrarPorEmail({ email: 'renata@escola.test', senha: 'segredo-da-renata' })
    chamadas.length = 0

    responderCom({ status: 200, corpo: { uri: 'otpauth://totp/Educa.ia:coordena%C3%A7%C3%A3o?secret=ABCD', segredo: 'ABCD' } })
    await mfa.configurarMfa()
    // Códigos no alfabeto do contrato (sem 0, 1, I e O, que se confundem no papel), com 12 caracteres.
    responderCom({ status: 200, corpo: { codigosRecuperacao: Array.from({ length: 10 }, (_, indice) => `ABCDEFGHJKL${ALFABETO_DO_CODIGO_DE_RECUPERACAO[indice] ?? '2'}`) } })
    await mfa.ativarMfa('123456')

    expect(chamadas.map((chamada) => [chamada.caminho, chamada.autorizacao])).toEqual([
      [mfa.CAMINHO_DA_CONFIGURACAO_DE_MFA, 'Bearer desafio.configurar.jwt'],
      [mfa.CAMINHO_DA_ATIVACAO_DE_MFA, 'Bearer desafio.configurar.jwt'],
    ])
    expect(sessao.desafioDaEtapa('configurar_mfa')).toBeUndefined()
  })

  it('sem desafio, configurar não chama a API: o segredo nunca é pedido por quem não provou a senha', async () => {
    const erro = await erroDe(mfa.configurarMfa())
    expect(erro.codigo).toBe(ErrorCode.NAO_AUTENTICADO)
    expect(chamadas).toHaveLength(0)
  })
})

describe('convite', () => {
  const TOKEN = 'token-sintetico-do-convite'

  it('o token vai no corpo, nunca na URL da API, que fica em log de borda e no histórico', async () => {
    responderCom({ status: 200, corpo: { escolaNome: 'Colégio sintético' } })
    await convite.consultarConvite(TOKEN)
    expect(chamadas[0]?.caminho).toBe(convite.CAMINHO_DA_CONSULTA_DE_CONVITE)
    expect(chamadas[0]?.caminho).not.toContain(TOKEN)
    expect(chamadas[0]?.corpo).toEqual({ token: TOKEN })
  })

  /** O aceite com o link que continua na tela: a vez não muda enquanto ele está no ar. */
  const naMesmaVez = () => 0

  it('conta nova: o aceite com senha guarda o desafio de configurar_mfa, e nenhuma sessão é aberta', async () => {
    const resposta = { etapa: 'configurar_mfa', desafio: 'desafio.configurar.jwt' }
    responderCom({ status: 200, corpo: resposta })
    expect(await convite.aceitarConviteNaVez({ token: TOKEN, senha: 'senha-nova-com-doze' }, naMesmaVez)).toEqual({ tipo: 'aceito', resposta })
    expect(chamadas[0]).toMatchObject({ caminho: convite.CAMINHO_DO_ACEITE_DE_CONVITE, metodo: 'POST', corpo: { token: TOKEN, senha: 'senha-nova-com-doze' } })
    expect(sessao.desafioDaEtapa('configurar_mfa')).toBe('desafio.configurar.jwt')
    expect(sessao.convitePendente()).toBe(false)
    expect(sessao.tokenDeAcesso()).toBeUndefined()
  })

  it('W14: o professor com a conta nova recebe `entrar` no aceite com senha, e o bilhete vai no login com a senha criada', async () => {
    const resposta = { etapa: 'entrar', bilhete: 'bilhete.do.professor.jwt' }
    responderCom({ status: 200, corpo: resposta })
    expect(await convite.aceitarConviteNaVez({ token: TOKEN, senha: 'senha-nova-com-doze' }, naMesmaVez)).toEqual({ tipo: 'aceito', resposta })
    expect(sessao.convitePendente()).toBe(true)
    expect(sessao.desafioDaEtapa('configurar_mfa')).toBeUndefined()
    responderCom({ status: 200, corpo: PRONTA })
    await sessao.entrarPorEmail({ email: 'professor@escola.test', senha: 'senha-nova-com-doze' })
    expect(chamadas.at(-1)?.corpo).toEqual({ email: 'professor@escola.test', senha: 'senha-nova-com-doze', bilhete: 'bilhete.do.professor.jwt' })
  })

  it('a recusa do aceite volta como falha, com o erro tipado, e nada fica guardado', async () => {
    responderCom({ status: 400, corpo: envelope(ErrorCode.ENTRADA_INVALIDA) })
    const desfecho = await convite.aceitarConviteNaVez({ token: TOKEN }, naMesmaVez)
    expect(desfecho).toMatchObject({ tipo: 'falhou', erro: { codigo: ErrorCode.ENTRADA_INVALIDA } })
    expect(sessao.convitePendente()).toBe(false)
  })

  it('recomeço: o aceite que volta depois de outro link chegar à aba é descartado, dê certo ou não, e não guarda bilhete nem desafio', async () => {
    for (const resposta of [
      { status: 200, corpo: { etapa: 'entrar', bilhete: 'bilhete.do.link.anterior.jwt' } },
      { status: 200, corpo: { etapa: 'configurar_mfa', desafio: 'desafio.do.link.anterior.jwt' } },
      { status: 404, corpo: envelope(ErrorCode.NAO_ENCONTRADO) },
      { status: 503, corpo: envelope(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO) },
    ]) {
      // A vez do link sobe enquanto o aceite está no ar: é o `hashchange` de outro link colado na aba.
      let vez = 0
      responderCom(resposta)
      const aceite = convite.aceitarConviteNaVez({ token: TOKEN }, () => vez)
      vez = 1
      expect(await aceite, String(resposta.status)).toEqual({ tipo: 'descartado' })
      expect(sessao.convitePendente()).toBe(false)
      expect(sessao.desafioDaEtapa('configurar_mfa')).toBeUndefined()
    }
  })

  it('recomeço: o aceite descartado não apaga o bilhete que o aceite do link novo já guardou', async () => {
    let responderAoAnterior: (resposta: Response) => void = () => undefined
    const anteriorSaiu = new Promise<void>((saiu) => {
      vi.mocked(fetch).mockImplementationOnce(() => {
        saiu()
        return new Promise<Response>((resolver) => (responderAoAnterior = resolver))
      })
    })
    let vez = 0
    const anterior = convite.aceitarConviteNaVez({ token: TOKEN }, () => vez)
    await anteriorSaiu
    // O link novo chega, e o aceite dele sai e volta com o aceite do anterior ainda no ar.
    vez = 1
    responderCom({ status: 200, corpo: { etapa: 'entrar', bilhete: 'bilhete.do.link.novo.jwt' } })
    expect((await convite.aceitarConviteNaVez({ token: 'token-sintetico-do-link-novo' }, () => vez)).tipo).toBe('aceito')
    responderAoAnterior(new Response(JSON.stringify({ etapa: 'entrar', bilhete: 'bilhete.do.link.anterior.jwt' }), { status: 200 }))
    expect(await anterior).toEqual({ tipo: 'descartado' })
    responderCom({ status: 200, corpo: PRONTA })
    await sessao.entrarPorEmail({ email: 'camila@escola.test', senha: 'segredo-da-camila' })
    expect(chamadas.at(-1)?.corpo).toEqual({ email: 'camila@escola.test', senha: 'segredo-da-camila', bilhete: 'bilhete.do.link.novo.jwt' })
  })

  it('conta que já existe: o bilhete fica em memória e vai no corpo do próximo login, uma vez só', async () => {
    responderCom({ status: 200, corpo: { etapa: 'entrar', bilhete: 'bilhete.jwt' } })
    await convite.aceitarConviteNaVez({ token: TOKEN }, naMesmaVez)
    expect(sessao.convitePendente()).toBe(true)

    // Senha errada: o bilhete precisa sobreviver, senão a segunda tentativa entraria sem ativar a escola do convite.
    responderCom({ status: 401, corpo: envelope(ErrorCode.NAO_AUTENTICADO) })
    await erroDe(sessao.entrarPorEmail({ email: 'camila@escola.test', senha: 'errada' }))
    expect(chamadas.at(-1)?.corpo).toEqual({ email: 'camila@escola.test', senha: 'errada', bilhete: 'bilhete.jwt' })
    expect(sessao.convitePendente()).toBe(true)

    responderCom({ status: 200, corpo: PRONTA })
    await sessao.entrarPorEmail({ email: 'camila@escola.test', senha: 'segredo-da-camila' })
    expect(chamadas.at(-1)?.corpo).toEqual({ email: 'camila@escola.test', senha: 'segredo-da-camila', bilhete: 'bilhete.jwt' })
    // Depois da resposta, quem carrega o convite é o desafio assinado pela API, e não mais esta aba.
    expect(sessao.convitePendente()).toBe(false)
  })

  it('sem convite aceito nesta aba, o login não manda bilhete nenhum', async () => {
    responderCom({ status: 200, corpo: PRONTA })
    await sessao.entrarPorEmail({ email: 'camila@escola.test', senha: 'segredo-da-camila' })
    expect(chamadas.at(-1)?.corpo).toEqual({ email: 'camila@escola.test', senha: 'segredo-da-camila' })
  })
})

describe('meia credencial não sobrevive à sessão', () => {
  it('a sessão aberta apaga desafio, bilhete e aviso: no Chromebook do carrinho nada disso passa para a pessoa seguinte', async () => {
    responderCom({ status: 200, corpo: { etapa: 'entrar', bilhete: 'bilhete.jwt' } })
    await convite.aceitarConviteNaVez({ token: 'token-sintetico-do-convite' }, () => 0)
    sessao.definirAvisoDaEntrada('aviso qualquer')
    sessao.guardarDesafio('mfa', 'desafio.mfa.jwt')

    responderCom({ status: 200, corpo: PRONTA })
    await sessao.entrarPorEmail({ email: 'camila@escola.test', senha: 'segredo-da-camila' })

    expect(sessao.desafioDaEtapa('mfa')).toBeUndefined()
    expect(sessao.convitePendente()).toBe(false)
    expect(sessao.avisoDaEntrada()).toBeUndefined()
  })
})

describe('escolha e troca de escola', () => {
  const ACESSOS = [
    { usuarioId: '0190f5a0-0000-7000-8000-00000000000a', escolaNome: 'Colégio Vista Alegre', redeNome: 'Rede Vista Alegre', papel: 'professor' as const },
    { usuarioId: '0190f5a0-0000-7000-8000-00000000000b', escolaNome: 'Escola Municipal Sete', redeNome: 'Rede Municipal de Joinville', papel: 'coordenador' as const },
  ]
  const ESCOLHER = { etapa: 'escolher', desafio: 'desafio.escolher.jwt', acessos: ACESSOS }

  /** Uma sessão aberta nesta aba, como depois do login por e-mail. */
  async function comSessaoAberta(): Promise<void> {
    responderCom({ status: 200, corpo: PRONTA })
    await sessao.entrarPorEmail({ email: 'camila@escola.test', senha: 'segredo-da-camila' })
    chamadas.length = 0
  }

  it('a etapa escolher guarda os acessos que a tela lista, e eles somem quando a sessão abre', async () => {
    responderCom({ status: 200, corpo: ESCOLHER })
    await sessao.entrarPorEmail({ email: 'camila@escola.test', senha: 'segredo-da-camila' })
    // Sem isto a tela da escolha não teria o que listar: o desafio é opaco, e não há sessão para consultar `/v1/eu`.
    expect(sessao.acessosParaEscolher()).toEqual(ACESSOS)

    responderCom({ status: 200, corpo: PRONTA })
    await sessao.escolherEscola(ACESSOS[0]?.usuarioId ?? '')
    expect(chamadas.at(-1)).toMatchObject({
      caminho: sessao.CAMINHO_DA_ESCOLA_DA_SESSAO,
      metodo: 'POST',
      autorizacao: 'Bearer desafio.escolher.jwt',
      corpo: { usuarioId: ACESSOS[0]?.usuarioId },
    })
    expect(sessao.tokenDeAcesso()).toBe('token-1')
    // Meia credencial não sobrevive à sessão aberta (regra 50, item 7), e a lista de escolas vai junto com ela.
    expect(sessao.acessosParaEscolher()).toEqual([])
  })

  it('sem o desafio nesta aba, escolher não manda pedido nenhum: um F5 na tela da escolha manda refazer a senha', async () => {
    expect((await erroDe(sessao.escolherEscola(ACESSOS[0]?.usuarioId ?? ''))).codigo).toBe(ErrorCode.NAO_AUTENTICADO)
    expect(chamadas).toEqual([])
  })

  it('a troca esvazia o cache da escola anterior com o token do destino já em memória, e nunca antes', async () => {
    await comSessaoAberta()
    const limpezas: (string | undefined)[] = []
    sessao.aoTrocarDeSessao(() => limpezas.push(sessao.tokenDeAcesso()))

    responderCom({ status: 200, corpo: { etapa: 'pronta', token: 'token-da-escola-b', expiraEm: DAQUI_A_MUITO } })
    await sessao.trocarDeEscola(ACESSOS[1]?.usuarioId ?? '')

    expect(chamadas.at(-1)).toMatchObject({ caminho: sessao.CAMINHO_DA_ESCOLA_DA_SESSAO, metodo: 'POST', autorizacao: 'Bearer token-1' })
    // Esvaziar o cache refaz as buscas que estão na tela. Com o token da escola de origem ainda em memória — e na
    // troca que passa pelo segundo fator ele ainda vale —, essas buscas voltariam com o dado dela e o regravariam no
    // cliente, dentro da escola de destino (regra 10, item 1). E sem limpeza nenhuma a turma de A simplesmente ficaria.
    expect(limpezas, 'o cache precisa ser esvaziado já com o token do destino').toEqual(['token-da-escola-b'])
    expect(sessao.tokenDeAcesso()).toBe('token-da-escola-b')
  })

  it('a troca para a coordenação para no segundo fator: nada é esvaziado, porque a pessoa continua na escola de origem', async () => {
    await comSessaoAberta()
    let limpezas = 0
    sessao.aoTrocarDeSessao(() => limpezas++)
    responderCom({ status: 200, corpo: { etapa: 'mfa', desafio: 'desafio.mfa.jwt' } })
    await sessao.trocarDeEscola(ACESSOS[1]?.usuarioId ?? '')

    expect(sessao.desafioDaEtapa('mfa')).toBe('desafio.mfa.jwt')
    // A sessão de origem continua valendo até o código ser aceito (Tech Spec, seção 5, "Troca de escola"): a tela
    // dela continua servindo, e desistir do código devolve a pessoa à escola em que ela está.
    expect(sessao.tokenDeAcesso()).toBe('token-1')
    expect(sessao.estadoDaSessao()).toBe('aberta')
    expect(limpezas, 'nada mudou de escola ainda').toBe(0)

    // O código aceito grava a sessão do destino: é aí que o cache da escola de origem sai, com o token novo já valendo.
    responderCom({ status: 200, corpo: { etapa: 'pronta', token: 'token-da-escola-b', expiraEm: DAQUI_A_MUITO } })
    await sessao.entrarComSegundoFator({ codigo: '123456' })
    expect(limpezas).toBe(1)
    expect(sessao.tokenDeAcesso()).toBe('token-da-escola-b')
  })

  it('a troca recusada não esvazia o cache nem derruba a sessão em que a pessoa está', async () => {
    await comSessaoAberta()
    let limpezas = 0
    sessao.aoTrocarDeSessao(() => limpezas++)

    responderCom({ status: 404, corpo: envelope(ErrorCode.NAO_ENCONTRADO) })
    expect((await erroDe(sessao.trocarDeEscola(ACESSOS[1]?.usuarioId ?? ''))).codigo).toBe(ErrorCode.NAO_ENCONTRADO)

    // A sessão de matrícula e a da conta da escola recebem 404 aqui: a pessoa continua onde estava, com a tela dela.
    expect(limpezas).toBe(0)
    expect(sessao.tokenDeAcesso()).toBe('token-1')
    expect(sessao.estadoDaSessao()).toBe('aberta')
  })

  it('o aviso de atividade vai à rota da sessão com o token, e não a nenhuma tela', async () => {
    await comSessaoAberta()
    responderCom({ status: 204 })
    await sessao.registrarAtividade()
    expect(chamadas).toEqual([expect.objectContaining({ caminho: sessao.CAMINHO_DA_ATIVIDADE, metodo: 'POST', autorizacao: 'Bearer token-1' })])
  })
})

describe('quem está na aba, para o login por cima da tela', () => {
  const RENATA = { usuarioId: '0190f5a0-0000-7000-8000-00000000000a', papel: 'coordenador' as const, escola: { slug: 'colegio-vista-alegre' } }
  const CAMILA = { usuarioId: '0190f5a0-0000-7000-8000-00000000000c', papel: 'professor' as const, escola: { slug: 'colegio-vista-alegre' } }

  /** Abre a sessão, guarda quem está e deixa a sessão vencer com um `NAO_AUTENTICADO` que persiste. */
  async function comSessaoVencida(quem: typeof RENATA): Promise<void> {
    responderCom({ status: 200, corpo: PRONTA })
    await sessao.entrarPorEmail({ email: 'renata@escola.test', senha: 'segredo-da-renata' })
    sessao.lembrarQuemEsta(quem)
    responderCom(
      { status: 401, corpo: envelope(ErrorCode.NAO_AUTENTICADO) },
      { status: 401, corpo: envelope(ErrorCode.NAO_AUTENTICADO) },
    )
    const esquema = { safeParse: (valor: unknown) => ({ success: true as const, data: valor }) }
    await erroDe(sessao.buscarComSessao('/v1/eu', esquema))
    expect(sessao.estadoDaSessao()).toBe('vencida')
    chamadas.length = 0
  }

  it('a sessão vencida guarda o caminho de volta: o papel diz o formulário, e o slug, o endereço da escola', async () => {
    await comSessaoVencida(RENATA)
    // É o mínimo para o diálogo: nem nome, nem e-mail, nem matrícula — o resto morreu junto com o cache.
    expect(sessao.quemEstaNaSessao()).toEqual({ usuarioId: RENATA.usuarioId, papel: 'coordenador', escolaSlug: 'colegio-vista-alegre' })
  })

  it('a mesma pessoa voltando não descarta a tela; outra pessoa no mesmo computador, sim', async () => {
    await comSessaoVencida(RENATA)
    responderCom({ status: 200, corpo: PRONTA })
    await sessao.entrarPorEmail({ email: 'renata@escola.test', senha: 'segredo-da-renata' })
    expect(sessao.lembrarQuemEsta(RENATA), 'a mesma pessoa continua de onde estava').toBe(false)

    await comSessaoVencida(RENATA)
    responderCom({ status: 200, corpo: PRONTA })
    await sessao.entrarPorEmail({ email: 'camila@escola.test', senha: 'segredo-da-camila' })
    expect(sessao.lembrarQuemEsta(CAMILA), 'o Chromebook do carrinho passou de mão').toBe(true)
    // E a pergunta não se repete: a tela já foi descartada uma vez.
    expect(sessao.lembrarQuemEsta(CAMILA)).toBe(false)
  })

  it('"Entrar com outra conta" descarta a sessão vencida: a tela de trás sai, e o Voltar não a traz', async () => {
    await comSessaoVencida(RENATA)
    sessao.descartarSessaoVencida()

    // `anonima`, e não `vencida`: é o que faz a rota protegida levar à entrada em vez de remontar a tela da pessoa
    // anterior com o diálogo por cima.
    expect(sessao.estadoDaSessao()).toBe('anonima')
    expect(sessao.quemEstaNaSessao()).toBeUndefined()
  })

  it('o "Sair" apaga quem estava: a entrada não tem por que saber quem usou este computador', async () => {
    responderCom({ status: 200, corpo: PRONTA })
    await sessao.entrarPorEmail({ email: 'renata@escola.test', senha: 'segredo-da-renata' })
    sessao.lembrarQuemEsta(RENATA)
    responderCom({ status: 204 })
    await sessao.sair()
    expect(sessao.quemEstaNaSessao()).toBeUndefined()
  })
})
