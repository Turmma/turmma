// @vitest-environment jsdom
import { MENSAGENS_DE_ERRO } from '@educa/shared'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeNetwork, renderScreen, setupScreen, type FakeNetwork, type FakeResponse } from '../__fixtures__/render-screen'
import { CAMINHO_DA_SALA_STORAGE_KEY, guardarCaminhoDaSala, lerCaminhoDaSala, VALIDADE_DO_CAMINHO_DA_SALA_MS } from './caminho-da-sala'
import { TurmaPublica } from './TurmaPublica'

/**
 * A conta da escola na página da sala (acesso-e-convites, 16.0; RF14; `cenarios.md`, "Telas" e "Conta da escola do aluno"), o que roda sem navegador: a volta do provedor
 * (`?conta=provada`) abre a sala pelo caminho guardado e o pedido sai sem senha; o caminho que falta, venceu ou é de outra sala recomeça pelo link ou pelo código sem chamar a
 * API; as falhas; e o botão que prova a conta. A navegação ao provedor, o `sessionStorage` de um navegador de verdade e a jornada com o `oidc-falso` ficam no e2e
 * (`conta-da-escola-na-sala.spec.ts`): o `jsdom` não navega.
 */
setupScreen()

const SLUG = 'colegio-a'
const OUTRO_SLUG = 'colegio-b'
const TOKEN = 'token-do-link-da-sala'
const CODIGO = 'ABCD2345'
const NOME_ID = '0192a4c0-5b1e-7c3d-8e4f-a0b1c2d3e4f7'
const REQUISICAO = '0190f5a0-0000-7000-8000-000000000001'
const ABRIR = '/v1/salas/abrir'
const REIVINDICAR = '/v1/salas/reivindicar'
const ACESSO = `/v1/escolas/${SLUG}/acesso`

const erro = (status: number, codigo: string): FakeResponse => ({ status, corpo: { erro: { codigo, mensagem: 'x', requisicaoId: REQUISICAO } } })
const SALA: FakeResponse = { status: 200, corpo: { turma: { nome: '7A' }, nomes: [{ id: NOME_ID, nome: 'Aluna Sintética' }] } }
const SALA_SEM_NOMES: FakeResponse = { status: 200, corpo: { turma: { nome: '7A' }, nomes: [] } }
const ENVIADO: FakeResponse = { status: 200, corpo: { resultado: 'enviado' } }
const COM_GOOGLE: FakeResponse = { status: 200, corpo: { nome: 'Escola sintética', provedores: ['google'] } }
const COM_OS_DOIS: FakeResponse = { status: 200, corpo: { nome: 'Escola sintética', provedores: ['google', 'microsoft'] } }
const SEM_PROVEDOR: FakeResponse = { status: 200, corpo: { nome: 'Escola sintética', provedores: [] } }

const CONTA_PERDIDA = 'Comece de novo pelo link ou pelo código da sala'
const CONFIRMADA = 'Conta da escola confirmada. Escolha o seu nome e informe a matrícula: não precisa criar senha.'
const BOTAO_DA_CONTA = 'Entrar com a conta da escola'
const CAMPO_DA_SENHA = 'Crie uma senha'

let rede: FakeNetwork
/** O que a API responde a cada rota; o caso troca a resposta no meio (a rede que volta), e a rota lê a de agora. */
const respostas: { abrir: FakeResponse | Promise<FakeResponse>; reivindicar: FakeResponse; acesso: FakeResponse } = { abrir: SALA, reivindicar: ENVIADO, acesso: SEM_PROVEDOR }

beforeEach(() => {
  respostas.abrir = SALA
  respostas.reivindicar = ENVIADO
  respostas.acesso = SEM_PROVEDOR
  rede = fakeNetwork()
  rede.responderPor(ABRIR, () => respostas.abrir)
  rede.responderPor(REIVINDICAR, () => respostas.reivindicar)
  rede.responderPor(ACESSO, () => respostas.acesso)
})

afterEach(() => {
  // Os espiões (o relógio, o `setItem`) saem aqui, e não no fim do caso: o caso que falha antes não os deixa para o seguinte.
  vi.restoreAllMocks()
  window.sessionStorage.clear()
  window.history.replaceState(null, '', '/')
})

/** O aluno está no endereço da sala, com o `search` e o `hash` que o caso pede. */
function noEndereco(busca = '', fragmento = ''): void {
  window.history.replaceState(null, '', `/e/${SLUG}/turma${busca}${fragmento}`)
}

/** O navegador voltou do provedor: `?conta=provada` na barra e, se o caso quer, o caminho guardado antes de sair. */
function voltarDoProvedor(guardado: Parameters<typeof guardarCaminhoDaSala>[1] | null = { tipo: 'link', token: TOKEN }): void {
  if (guardado !== null) guardarCaminhoDaSala(SLUG, guardado)
  noEndereco('?conta=provada')
}

/** Os corpos que a página mandou a uma rota, na ordem. */
function corposDe(caminho: string): Record<string, unknown>[] {
  return vi
    .mocked(fetch)
    .mock.calls.filter(([alvo]) => alvo === caminho)
    .map(([, opcoes]) => JSON.parse(String(opcoes?.body ?? '{}')) as Record<string, unknown>)
}

const aviso = () => screen.queryByRole('alert')

/** Espera a leitura dos provedores da escola acabar na tela: a chamada saiu e a resposta, ou o erro, já foi pintada. Confere a ausência só depois disto. */
async function esperarOsProvedores(): Promise<void> {
  await waitFor(() => expect(vi.mocked(fetch).mock.calls.map(([alvo]) => alvo)).toContain(ACESSO))
  await act(async () => {
    await new Promise((resolver) => window.setTimeout(resolver, 50))
  })
}

describe('a volta do provedor: a sala abre pelo caminho guardado e o pedido sai sem senha', () => {
  it('abre pelo token guardado, mostra a conta confirmada sem campo de senha nem botão da conta, e tira o caminho e o parâmetro da barra', async () => {
    voltarDoProvedor()
    respostas.acesso = COM_GOOGLE
    respostas.abrir = SALA
    renderScreen(<TurmaPublica slug={SLUG} />)

    expect(await screen.findByRole('radio', { name: 'Aluna Sintética' })).toBeTruthy()
    expect(corposDe(ABRIR)).toEqual([{ slug: SLUG, token: TOKEN }])
    expect(screen.getByText(CONFIRMADA)).toBeTruthy()
    expect(screen.queryByLabelText(CAMPO_DA_SENHA)).toBeNull()
    expect(screen.queryByRole('button', { name: BOTAO_DA_CONTA })).toBeNull()
    expect(vi.mocked(fetch).mock.calls.map(([alvo]) => alvo)).not.toContain(ACESSO)
    // O colega que abre a sala na mesma aba depois não herda o caminho, e o F5 não repete a volta.
    expect(window.sessionStorage.getItem(CAMINHO_DA_SALA_STORAGE_KEY)).toBeNull()
    expect(window.location.search).toBe('')
  })

  it('o pedido do nome sai com o token, a matrícula e a chave, e sem senha; a tela diz para esperar o professor, sem nada do pedido', async () => {
    voltarDoProvedor()
    respostas.abrir = SALA
    respostas.reivindicar = ENVIADO
    renderScreen(<TurmaPublica slug={SLUG} />)
    const usuario = userEvent.setup()

    await usuario.click(await screen.findByRole('radio', { name: 'Aluna Sintética' }))
    await usuario.type(screen.getByLabelText('Matrícula'), 'M-001')
    await usuario.click(screen.getByRole('button', { name: 'Enviar pedido' }))

    expect(await screen.findByRole('heading', { name: 'Pedido enviado' })).toBeTruthy()
    const [pedido] = corposDe(REIVINDICAR)
    expect(pedido).toMatchObject({ slug: SLUG, token: TOKEN, listaNomeId: NOME_ID, matricula: 'M-001' })
    expect(typeof pedido?.chaveEnvio).toBe('string')
    expect(pedido).not.toHaveProperty('senha')
    expect(pedido).not.toHaveProperty('codigo')
    const pagina = document.body.textContent ?? ''
    expect(pagina).toContain('Espere o professor aprovar. Até lá, entrar com a conta da escola diz que ela não está liberada.')
    expect(pagina).not.toContain('Matrícula ou senha incorretas')
    expect(pagina).not.toContain('Aluna Sintética')
    expect(pagina).not.toContain('M-001')
  })

  it('o pedido da conta reenviado depois de uma falha leva a mesma chave; com a matrícula mudada, outra', async () => {
    voltarDoProvedor()
    respostas.abrir = SALA
    respostas.reivindicar = erro(503, 'INDISPONIVEL_TENTE_DE_NOVO')
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      renderScreen(<TurmaPublica slug={SLUG} />)
      const usuario = userEvent.setup({ advanceTimers: (ms) => void vi.advanceTimersByTime(ms) })
      await usuario.click(await screen.findByRole('radio', { name: 'Aluna Sintética' }))
      await usuario.type(screen.getByLabelText('Matrícula'), 'M-001')
      // O sistema cheio: o envio espera e repete até desistir, e o pedido que ficou sem resposta é o que o próximo clique reenvia.
      await usuario.click(screen.getByRole('button', { name: 'Enviar pedido' }))
      await vi.advanceTimersByTimeAsync(10 * 60_000)
      expect((await screen.findByRole('alert')).textContent).toBe('O sistema está cheio agora.')
      const tentativas = corposDe(REIVINDICAR).length
      await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
      await vi.advanceTimersByTimeAsync(10 * 60_000)
      await usuario.type(screen.getByLabelText('Matrícula'), '2')
      await usuario.click(screen.getByRole('button', { name: /^(Enviar pedido|Tentar de novo)$/ }))
      await vi.advanceTimersByTimeAsync(10 * 60_000)

      const corpos = corposDe(REIVINDICAR)
      const chaves = new Set(corpos.slice(0, tentativas * 2).map((corpo) => corpo.chaveEnvio))
      expect(chaves.size).toBe(1)
      expect(corpos.at(-1)?.chaveEnvio).not.toBe(corpos[0]?.chaveEnvio)
      expect(corpos.at(-1)).toMatchObject({ matricula: 'M-0012' })
      expect(corpos.at(-1)).not.toHaveProperty('senha')
    } finally {
      vi.useRealTimers()
    }
  })

  it('conta provada com a sala sem nome livre: a confirmação não aparece, só o chamado ao professor', async () => {
    voltarDoProvedor()
    respostas.abrir = SALA_SEM_NOMES
    renderScreen(<TurmaPublica slug={SLUG} />)

    expect(await screen.findByText('Nenhum nome livre nesta turma.')).toBeTruthy()
    expect(screen.queryByText(CONFIRMADA)).toBeNull()
  })

  it('o caminho guardado pelo código abre pelo código, e o pedido leva o código, não o token', async () => {
    voltarDoProvedor({ tipo: 'codigo', codigo: CODIGO })
    respostas.abrir = SALA
    respostas.reivindicar = ENVIADO
    renderScreen(<TurmaPublica slug={SLUG} />)
    const usuario = userEvent.setup()

    await usuario.click(await screen.findByRole('radio', { name: 'Aluna Sintética' }))
    await usuario.type(screen.getByLabelText('Matrícula'), 'M-001')
    await usuario.click(screen.getByRole('button', { name: 'Enviar pedido' }))

    await screen.findByRole('heading', { name: 'Pedido enviado' })
    expect(corposDe(ABRIR)).toEqual([{ slug: SLUG, codigo: CODIGO }])
    const [pedido] = corposDe(REIVINDICAR)
    expect(pedido).toMatchObject({ codigo: CODIGO })
    expect(pedido).not.toHaveProperty('token')
    expect(pedido).not.toHaveProperty('senha')
  })

  it('"Voltar à lista de nomes" depois do pedido da conta: a lista volta ao formulário de matrícula e senha, com o botão da conta, e nada do pedido anterior', async () => {
    voltarDoProvedor()
    respostas.acesso = COM_GOOGLE
    respostas.abrir = SALA
    respostas.reivindicar = ENVIADO
    renderScreen(<TurmaPublica slug={SLUG} />)
    const usuario = userEvent.setup()
    await usuario.click(await screen.findByRole('radio', { name: 'Aluna Sintética' }))
    await usuario.type(screen.getByLabelText('Matrícula'), 'M-001')
    await usuario.click(screen.getByRole('button', { name: 'Enviar pedido' }))
    await usuario.click(await screen.findByRole('button', { name: 'Voltar à lista de nomes' }))

    expect(await screen.findByLabelText(CAMPO_DA_SENHA)).toBeTruthy()
    expect((screen.getByLabelText('Matrícula') as HTMLInputElement).value).toBe('')
    expect((screen.getByRole('radio', { name: 'Aluna Sintética' }) as HTMLInputElement).checked).toBe(false)
    expect(await screen.findByRole('button', { name: BOTAO_DA_CONTA })).toBeTruthy()
    expect(screen.queryByText(CONFIRMADA)).toBeNull()
    expect(aviso()).toBeNull()
  })
})

describe('a conta que não vale mais: provar de novo pelo link ou pelo código', () => {
  it('o servidor recusa a conta (`ENTRADA_INVALIDA`): o aviso, o campo do código com o foco, e nenhum "Pedido enviado"', async () => {
    voltarDoProvedor()
    respostas.abrir = SALA
    respostas.reivindicar = erro(400, 'ENTRADA_INVALIDA')
    renderScreen(<TurmaPublica slug={SLUG} />)
    const usuario = userEvent.setup()
    await usuario.click(await screen.findByRole('radio', { name: 'Aluna Sintética' }))
    await usuario.type(screen.getByLabelText('Matrícula'), 'M-001')
    await usuario.click(screen.getByRole('button', { name: 'Enviar pedido' }))

    expect((await screen.findByRole('alert')).textContent).toBe(CONTA_PERDIDA)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Código da turma')))
    expect(screen.queryByRole('heading', { name: 'Pedido enviado' })).toBeNull()
  })

  it('com a senha, o `ENTRADA_INVALIDA` é erro de campo e fica como sempre: o texto geral, e a tela do formulário', async () => {
    noEndereco('', `#${TOKEN}`)
    respostas.abrir = SALA
    respostas.reivindicar = erro(400, 'ENTRADA_INVALIDA')
    renderScreen(<TurmaPublica slug={SLUG} />)
    const usuario = userEvent.setup()
    await usuario.click(await screen.findByRole('radio', { name: 'Aluna Sintética' }))
    await usuario.type(screen.getByLabelText('Matrícula'), 'M-001')
    await usuario.type(screen.getByLabelText(CAMPO_DA_SENHA), 'uma frase que só eu sei')
    await usuario.click(screen.getByRole('button', { name: 'Enviar pedido' }))

    expect((await screen.findByRole('alert')).textContent).toBe(MENSAGENS_DE_ERRO.ENTRADA_INVALIDA)
    expect(screen.queryByLabelText('Código da turma')).toBeNull()
  })

  it.each([
    ['nada foi guardado', () => voltarDoProvedor(null)],
    [
      'o caminho guardado venceu',
      () => {
        vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000)
        guardarCaminhoDaSala(SLUG, { tipo: 'link', token: TOKEN }, 1_800_000_000_000 - VALIDADE_DO_CAMINHO_DA_SALA_MS - 1)
        noEndereco('?conta=provada')
      },
    ],
    [
      'o caminho guardado é de outra sala',
      () => {
        guardarCaminhoDaSala(OUTRO_SLUG, { tipo: 'link', token: TOKEN })
        noEndereco('?conta=provada')
      },
    ],
  ])('%s: o aviso e o foco no código, a API nem é chamada, e o parâmetro sai da barra', async (_caso, preparar) => {
    preparar()
    renderScreen(<TurmaPublica slug={SLUG} />)

    expect((await screen.findByRole('alert')).textContent).toBe(CONTA_PERDIDA)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Código da turma')))
    expect(corposDe(ABRIR)).toEqual([])
    expect(window.location.search).toBe('')
  })

  it('o caminho guardado sem `?conta=provada` não vale: a tela é a do código, sem aviso, e o caminho é apagado', async () => {
    guardarCaminhoDaSala(SLUG, { tipo: 'link', token: TOKEN })
    noEndereco()
    renderScreen(<TurmaPublica slug={SLUG} />)

    expect(await screen.findByLabelText('Código da turma')).toBeTruthy()
    expect(aviso()).toBeNull()
    expect(corposDe(ABRIR)).toEqual([])
    expect(window.sessionStorage.getItem(CAMINHO_DA_SALA_STORAGE_KEY)).toBeNull()
  })

  it('só o valor `provada` vale: `?conta=outra` é como sem o parâmetro', async () => {
    guardarCaminhoDaSala(SLUG, { tipo: 'link', token: TOKEN })
    noEndereco('?conta=outra')
    renderScreen(<TurmaPublica slug={SLUG} />)

    expect(await screen.findByLabelText('Código da turma')).toBeTruthy()
    expect(aviso()).toBeNull()
    expect(corposDe(ABRIR)).toEqual([])
  })

  it('o link novo no fragmento vence a volta: abre por ele, com senha, e a prova da conta não vale para outra sala', async () => {
    guardarCaminhoDaSala(SLUG, { tipo: 'codigo', codigo: CODIGO })
    noEndereco('?conta=provada', '#token-de-outra-sala')
    respostas.abrir = SALA
    renderScreen(<TurmaPublica slug={SLUG} />)

    expect(await screen.findByLabelText(CAMPO_DA_SENHA)).toBeTruthy()
    expect(corposDe(ABRIR)).toEqual([{ slug: SLUG, token: 'token-de-outra-sala' }])
    expect(screen.queryByText(CONFIRMADA)).toBeNull()
    expect(window.sessionStorage.getItem(CAMINHO_DA_SALA_STORAGE_KEY)).toBeNull()
  })
})

describe('as falhas da volta do provedor', () => {
  it('a rede que cai ao abrir a sala pelo código guardado: "Tentar de novo", que abre a sala ainda com a conta provada', async () => {
    voltarDoProvedor({ tipo: 'codigo', codigo: CODIGO })
    respostas.abrir = erro(503, 'INDISPONIVEL_TENTE_DE_NOVO')
    renderScreen(<TurmaPublica slug={SLUG} />)
    const usuario = userEvent.setup()

    expect((await screen.findByRole('alert')).textContent).toBe('O sistema está cheio agora.')
    // O aluno não digitou nada: a tela não o manda de volta ao campo do código.
    expect(screen.queryByLabelText('Código da turma')).toBeNull()
    // Enquanto a nova tentativa está no ar, a tela é "Abrindo a turma…", não o campo do código.
    let liberar: (resposta: FakeResponse) => void = () => undefined
    respostas.abrir = new Promise<FakeResponse>((resolver) => (liberar = resolver))
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('Abrindo a turma…')).toBeTruthy()
    expect(screen.queryByLabelText('Código da turma')).toBeNull()
    liberar(SALA)

    expect(await screen.findByRole('radio', { name: 'Aluna Sintética' })).toBeTruthy()
    expect(screen.getByText(CONFIRMADA)).toBeTruthy()
    expect(screen.queryByLabelText(CAMPO_DA_SENHA)).toBeNull()
  })

  it('o código digitado que cai por servidor, sem a conta, segue como sempre: o campo do código com o aviso', async () => {
    noEndereco()
    respostas.abrir = erro(503, 'INDISPONIVEL_TENTE_DE_NOVO')
    renderScreen(<TurmaPublica slug={SLUG} />)
    const usuario = userEvent.setup()
    await usuario.type(await screen.findByLabelText('Código da turma'), CODIGO)
    await usuario.click(screen.getByRole('button', { name: 'Abrir a turma' }))

    expect((await screen.findByRole('alert')).textContent).toBe('O sistema está cheio agora.')
    expect(screen.getByLabelText('Código da turma')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
  })

  it('a sala que não vale mais (`NAO_ENCONTRADO`) na volta leva ao código, com o texto do caminho usado', async () => {
    voltarDoProvedor()
    respostas.abrir = erro(404, 'NAO_ENCONTRADO')
    renderScreen(<TurmaPublica slug={SLUG} />)

    expect((await screen.findByRole('alert')).textContent).toBe('Este link não vale mais. Peça o código atual ao professor.')
    expect(screen.getByLabelText('Código da turma')).toBeTruthy()
  })

  it('a recusa do pedido (`REIVINDICACAO_RECUSADA`) segue sem senha: o texto de sempre, a lista relida e o foco na matrícula', async () => {
    voltarDoProvedor()
    respostas.abrir = SALA
    respostas.reivindicar = erro(409, 'REIVINDICACAO_RECUSADA')
    renderScreen(<TurmaPublica slug={SLUG} />)
    const usuario = userEvent.setup()
    await usuario.click(await screen.findByRole('radio', { name: 'Aluna Sintética' }))
    await usuario.type(screen.getByLabelText('Matrícula'), 'M-001')
    await usuario.click(screen.getByRole('button', { name: 'Enviar pedido' }))

    expect((await screen.findByRole('alert')).textContent).toBe('Não foi possível enviar. Confira a matrícula; se estiver certa, chame o professor.')
    await waitFor(() => expect(corposDe(ABRIR)).toHaveLength(2))
    expect(document.activeElement).toBe(screen.getByLabelText('Matrícula'))
    expect(screen.getByText(CONFIRMADA)).toBeTruthy()
    expect(screen.queryByLabelText(CAMPO_DA_SENHA)).toBeNull()
  })
})

describe('o botão "Entrar com a conta da escola"', () => {
  /** O aluno abre a sala pelo link, sem ter provado conta nenhuma. */
  async function abrirPeloLink(): Promise<void> {
    noEndereco('', `#${TOKEN}`)
    respostas.abrir = SALA
    renderScreen(<TurmaPublica slug={SLUG} />)
    await screen.findByRole('radio', { name: 'Aluna Sintética' })
  }

  it('escola com um provedor: um botão "Entrar com a conta da escola", ao lado do formulário de matrícula e senha', async () => {
    respostas.acesso = COM_GOOGLE
    await abrirPeloLink()

    expect(await screen.findByRole('button', { name: BOTAO_DA_CONTA })).toBeTruthy()
    expect(screen.getByLabelText(CAMPO_DA_SENHA)).toBeTruthy()
    expect(screen.queryByText(CONFIRMADA)).toBeNull()
  })

  it('escola com os dois provedores: um botão por provedor, com o nome dele', async () => {
    respostas.acesso = COM_OS_DOIS
    await abrirPeloLink()

    expect(await screen.findByRole('button', { name: 'Entrar com a conta Google da escola' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Entrar com a conta Microsoft da escola' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: BOTAO_DA_CONTA })).toBeNull()
  })

  it('escola sem provedor liberado: nenhum botão, e a matrícula e a senha seguem', async () => {
    await abrirPeloLink()

    await esperarOsProvedores()
    expect(screen.queryByRole('button', { name: /Entrar com a conta/ })).toBeNull()
    expect(document.body.textContent).not.toContain('Tem a conta da escola?')
    expect(screen.getByLabelText(CAMPO_DA_SENHA)).toBeTruthy()
  })

  it('a leitura dos provedores que falha: nenhum botão e nenhum erro na tela, porque o formulário continua sendo o caminho', async () => {
    respostas.acesso = erro(404, 'NAO_ENCONTRADO')
    await abrirPeloLink()

    await esperarOsProvedores()
    expect(screen.queryByRole('button', { name: /Entrar com a conta/ })).toBeNull()
    expect(aviso()).toBeNull()
    expect(screen.getByLabelText(CAMPO_DA_SENHA)).toBeTruthy()
  })

  it('sala sem nome livre: nada de botão da conta, só o chamado ao professor, e a leitura dos provedores nem sai', async () => {
    respostas.acesso = COM_GOOGLE
    noEndereco('', `#${TOKEN}`)
    respostas.abrir = SALA_SEM_NOMES
    renderScreen(<TurmaPublica slug={SLUG} />)

    expect(await screen.findByText('Nenhum nome livre nesta turma.')).toBeTruthy()
    // A seção só monta com nome livre, e é ela que lê os provedores: sem a condição, a leitura sairia e o cartão apareceria um ciclo depois.
    await act(async () => {
      await new Promise((resolver) => window.setTimeout(resolver, 50))
    })
    expect(vi.mocked(fetch).mock.calls.map(([alvo]) => alvo)).not.toContain(ACESSO)
    expect(document.body.textContent).not.toContain('Tem a conta da escola?')
    expect(screen.queryByRole('button', { name: BOTAO_DA_CONTA })).toBeNull()
  })

  it('o clique pelo link guarda o token da sala e deixa o botão ocupado, e a página restaurada do histórico devolve o botão', async () => {
    respostas.acesso = COM_GOOGLE
    await abrirPeloLink()
    // O jsdom não navega: o `location.assign` do clique só registra "Not implemented", e o que a tela faz antes dele é o que se vê.
    const registro = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const usuario = userEvent.setup()

    await usuario.click(await screen.findByRole('button', { name: BOTAO_DA_CONTA }))

    expect(lerCaminhoDaSala(SLUG)).toEqual({ tipo: 'link', token: TOKEN })
    expect((screen.getByRole('button', { name: 'Entrando…' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Entrando com a conta da escola…').getAttribute('role')).toBe('status')
    expect(aviso()).toBeNull()
    fireEvent(window, new PageTransitionEvent('pageshow', { persisted: false }))
    expect((screen.getByRole('button', { name: 'Entrando…' }) as HTMLButtonElement).disabled).toBe(true)
    expect(lerCaminhoDaSala(SLUG)).toEqual({ tipo: 'link', token: TOKEN })
    // A página restaurada do histórico não roda o efeito da sala: o caminho gravado no clique sai aqui, e não fica 15 min na aba.
    fireEvent(window, new PageTransitionEvent('pageshow', { persisted: true }))
    expect(((await screen.findByRole('button', { name: BOTAO_DA_CONTA })) as HTMLButtonElement).disabled).toBe(false)
    expect(window.sessionStorage.getItem(CAMINHO_DA_SALA_STORAGE_KEY)).toBeNull()
    expect(screen.queryByText('Entrando com a conta da escola…')).toBeNull()
    registro.mockRestore()
  })

  it('o clique na sala aberta pelo código guarda o código, não o token', async () => {
    respostas.acesso = COM_GOOGLE
    noEndereco()
    renderScreen(<TurmaPublica slug={SLUG} />)
    const registro = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const usuario = userEvent.setup()
    await usuario.type(await screen.findByLabelText('Código da turma'), CODIGO)
    await usuario.click(screen.getByRole('button', { name: 'Abrir a turma' }))

    await usuario.click(await screen.findByRole('button', { name: BOTAO_DA_CONTA }))

    expect(lerCaminhoDaSala(SLUG)).toEqual({ tipo: 'codigo', codigo: CODIGO })
    registro.mockRestore()
  })

  it('sem sessionStorage a tela não sai: o aviso diz para usar a matrícula e a senha, e o botão continua livre', async () => {
    respostas.acesso = COM_GOOGLE
    await abrirPeloLink()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('cheio', 'QuotaExceededError')
    })
    const usuario = userEvent.setup()
    const botao = await screen.findByRole('button', { name: BOTAO_DA_CONTA })

    await usuario.click(botao)

    expect((await screen.findByRole('alert')).textContent).toBe('Não foi possível entrar com a conta da escola agora. Use a matrícula e a senha.')
    expect((screen.getByRole('button', { name: BOTAO_DA_CONTA }) as HTMLButtonElement).disabled).toBe(false)
  })
})
