// @vitest-environment jsdom
import { ErrorCode, MENSAGENS_DE_ERRO, mensagemDaEntradaPorMatricula, TAMANHO_MINIMO_SENHA_NOVA } from '@educa/shared'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { entrarPorMatricula, esquecerBilheteDaTroca } from '../api/sessao'
import { caminhoDaEscola, caminhoDaTrocaDaProvisoria } from '../paths'
import { fakeNetwork, renderScreen, setupScreen, type FakeNetwork, type FakeResponse } from '../__fixtures__/render-screen'
import { TrocarSenhaProvisoria } from './TrocarSenhaProvisoria'

/**
 * "Crie a sua senha" (acesso-e-convites, 13.0; RF13), o que roda sem navegador: os quatro estados da lista de provisórias de antes, a troca e as suas falhas, o bilhete que não vale, e o recomeço do
 * aluno seguinte no mesmo computador. A rede é falsa e responde por caminho; o módulo de sessão, o cliente de consultas, a rota e a tela são os de verdade. A jornada pelo navegador, a 360 px e o
 * bilhete fora do armazenamento de um navegador de verdade ficam no e2e (`troca-da-provisoria.spec.ts`).
 */
setupScreen()

const SLUG = 'colegio-a'
const CAMINHO_DAS_TROCAS = '/v1/sessao/matricula/trocas'
const CAMINHO_DA_TROCA = '/v1/sessao/matricula/trocar-senha'
const BILHETE_A = 'bilhete.da.aluna.a'
const BILHETE_B = 'bilhete.do.aluno.b'
const SENHA_NOVA = 'uma-frase-que-so-a-aluna-sabe'
const REQUISICAO = '0190f5a0-0000-7000-8000-000000000001'
const erro = (status: number, codigo: string): FakeResponse => ({ status, corpo: { erro: { codigo, mensagem: 'x', requisicaoId: REQUISICAO } } })
const LISTA_VAZIA: FakeResponse = { status: 200, corpo: { anteriores: [] } }
const PRONTA: FakeResponse = { status: 200, corpo: { etapa: 'pronta', token: 'token-do-aluno', expiraEm: '2099-01-01T00:00:00.000Z' } }
/** O fuso da unidade é Tóquio (+9): 17:05 de UTC é 02:05 do dia 13. O "14:05" de São Paulo é o do e2e. */
const DUAS_DE_ANTES: FakeResponse = {
  status: 200,
  corpo: {
    anteriores: [
      { geradaEm: '2026-11-12T17:05:00.000Z', papel: 'coordenador', usada: true },
      { geradaEm: '2026-11-10T15:30:00.000Z', papel: 'professor', usada: false },
    ],
  },
}

let rede: FakeNetwork

beforeEach(() => {
  esquecerBilheteDaTroca()
  rede = fakeNetwork()
})

/** O aluno entrou com a provisória: o login responde `trocar_senha`, e o bilhete fica na memória, como no navegador. */
async function chegarComOBilhete(bilhete: string): Promise<void> {
  rede.responder({ status: 200, corpo: { etapa: 'trocar_senha', bilhete } })
  await entrarPorMatricula({ slug: SLUG, matricula: '1234', senha: 'ABCD-EFGH' })
}

function abrirATela() {
  const localizacao = memoryLocation({ path: caminhoDaTrocaDaProvisoria(SLUG), record: true })
  renderScreen(
    <Router hook={localizacao.hook}>
      <TrocarSenhaProvisoria slug={SLUG} />
    </Router>,
  )
  return localizacao
}

const campoSenha = () => screen.getByLabelText(/^Senha nova/, { selector: 'input' })
const botaoCriar = () => screen.getByRole('button', { name: /Criar a senha e entrar|Salvando…/ })
const caminhoAtual = (localizacao: ReturnType<typeof abrirATela>) => localizacao.history?.at(-1)
/** A resposta que só chega quando o teste a libera: é a lista, ou a troca, atrasada. */
function atrasada(): { resposta: (caminho: string) => Promise<FakeResponse>; liberar: (resposta: FakeResponse) => void } {
  let liberar: (resposta: FakeResponse) => void = () => undefined
  const espera = new Promise<FakeResponse>((resolver) => (liberar = resolver))
  return { resposta: () => espera, liberar: (resposta) => liberar(resposta) }
}

describe('a tela aberta sem o bilhete', () => {
  it('um F5, ou o endereço digitado à mão: manda entrar de novo com a provisória, sem formulário e sem chamar a rede', () => {
    abrirATela()

    expect(screen.getByRole('alert').textContent).toBe('Entre de novo com a sua matrícula e a senha provisória. Se ela não valer mais, peça a senha de novo ao professor.')
    expect(screen.queryByLabelText(/^Senha nova/)).toBeNull()
    expect(screen.getByRole('link', { name: 'Voltar à entrada' }).getAttribute('href')).toBe(caminhoDaEscola(SLUG))
    expect(rede.chamadas).toHaveLength(0)
  })
})

describe('a lista das provisórias de antes', () => {
  it('com dado: uma linha por provisória, com quem gerou, quando e se foi usada, e a lista lida com o bilhete no Authorization', async () => {
    await chegarComOBilhete(BILHETE_A)
    rede.responderPor(CAMINHO_DAS_TROCAS, DUAS_DE_ANTES)
    abrirATela()

    expect(await screen.findByText('Gerada pela coordenação em 13/11/2026 às 02:05 · usada')).toBeTruthy()
    expect(screen.getByText('Gerada pelo professor em 11/11/2026 às 00:30 · não usada')).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByText('É a primeira vez que você troca a senha.')).toBeNull()
    expect(rede.chamadas.filter((chamada) => chamada.caminho === CAMINHO_DAS_TROCAS).map((chamada) => chamada.autorizacao)).toEqual([`Bearer ${BILHETE_A}`])
  })

  it('primeira troca: a frase "É a primeira vez…" no lugar da lista, sem tabela e sem lista vazia', async () => {
    await chegarComOBilhete(BILHETE_A)
    rede.responderPor(CAMINHO_DAS_TROCAS, LISTA_VAZIA)
    abrirATela()

    expect(await screen.findByText('É a primeira vez que você troca a senha.')).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('carregando: o esqueleto parado no lugar das linhas, o campo de senha já livre, e o esqueleto some quando a lista chega', async () => {
    await chegarComOBilhete(BILHETE_A)
    const lista = atrasada()
    rede.responderPor(CAMINHO_DAS_TROCAS, lista.resposta)
    abrirATela()

    expect(await screen.findByText('Carregando as senhas provisórias de antes…')).toBeTruthy()
    expect(document.querySelector('[data-esqueleto]')).not.toBeNull()
    expect(screen.getByText('Carregando as senhas provisórias de antes…').closest('[role="status"]')).not.toBeNull()
    expect((campoSenha() as HTMLInputElement).disabled).toBe(false)
    expect((botaoCriar() as HTMLButtonElement).disabled).toBe(false)

    await act(async () => {
      lista.liberar(DUAS_DE_ANTES)
      await Promise.resolve()
    })
    expect(await screen.findByText('Gerada pela coordenação em 13/11/2026 às 02:05 · usada')).toBeTruthy()
    expect(document.querySelector('[data-esqueleto]')).toBeNull()
  })

  it('a lista falhou: o aviso com "Tentar de novo", o campo de senha segue livre, e o botão lê a lista de novo', async () => {
    await chegarComOBilhete(BILHETE_A)
    let leituras = 0
    // 429 não se repete sozinho (`shouldRetry`): o aviso aparece na hora, sem esperar a nova tentativa automática de um segundo.
    rede.responderPor(CAMINHO_DAS_TROCAS, () => (++leituras === 1 ? erro(429, ErrorCode.LIMITE_EXCEDIDO) : LISTA_VAZIA))
    abrirATela()

    const aviso = await screen.findByRole('alert')
    expect(aviso.textContent).toBe(MENSAGENS_DE_ERRO[ErrorCode.LIMITE_EXCEDIDO])
    const usuario = userEvent.setup()
    // O campo de senha e o botão seguem: a lista é informação, e não porta.
    await usuario.type(campoSenha(), SENHA_NOVA)
    expect((campoSenha() as HTMLInputElement).value).toBe(SENHA_NOVA)
    expect((botaoCriar() as HTMLButtonElement).disabled).toBe(false)

    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByText('É a primeira vez que você troca a senha.')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(leituras).toBe(2)
  })

  it('a lista recusada pelo bilhete (vencido, ou a provisória que já foi usada): a tela vira o aviso "Peça a senha de novo ao professor", sem formulário', async () => {
    await chegarComOBilhete(BILHETE_A)
    rede.responderPor(CAMINHO_DAS_TROCAS, erro(401, ErrorCode.NAO_AUTENTICADO))
    abrirATela()

    expect((await screen.findByRole('alert')).textContent).toBe('Esta senha provisória não vale mais. Peça a senha de novo ao professor.')
    expect(screen.queryByLabelText(/^Senha nova/)).toBeNull()
    expect(screen.getByRole('link', { name: 'Voltar à entrada' }).getAttribute('href')).toBe(caminhoDaEscola(SLUG))
  })
})

describe('trocar a senha', () => {
  async function abrirComALista(bilhete = BILHETE_A) {
    await chegarComOBilhete(bilhete)
    rede.responderPor(CAMINHO_DAS_TROCAS, LISTA_VAZIA)
    const localizacao = abrirATela()
    await screen.findByText('É a primeira vez que você troca a senha.')
    return localizacao
  }
  const trocas = () => rede.chamadas.filter((chamada) => chamada.caminho === CAMINHO_DA_TROCA)

  it('a senha nova abre a sessão: o bilhete vai no Authorization, e a aluna segue para a entrada da área dela', async () => {
    const localizacao = await abrirComALista()
    rede.responder(PRONTA)
    const usuario = userEvent.setup()

    expect(document.activeElement).toBe(campoSenha())
    expect(campoSenha().getAttribute('autocomplete')).toBe('new-password')
    await usuario.type(campoSenha(), SENHA_NOVA)
    await usuario.click(botaoCriar())

    await waitFor(() => expect(caminhoAtual(localizacao)).toBe('/'))
    expect(trocas().map((chamada) => chamada.autorizacao)).toEqual([`Bearer ${BILHETE_A}`])
    // A senha nova sai da memória da tela assim que a resposta chega.
    expect((campoSenha() as HTMLInputElement).value).toBe('')
  })

  it('senha curta: a regra aparece no campo, a senha digitada fica e o foco volta a ele', async () => {
    await abrirComALista()
    rede.responder(erro(400, ErrorCode.ENTRADA_INVALIDA))
    const usuario = userEvent.setup()
    await usuario.type(campoSenha(), 'curta')
    await usuario.click(botaoCriar())

    expect(await screen.findByText(`A senha precisa ter pelo menos ${String(TAMANHO_MINIMO_SENHA_NOVA)} caracteres.`)).toBeTruthy()
    expect((campoSenha() as HTMLInputElement).value).toBe('curta')
    expect(campoSenha().getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(campoSenha())
    // Enviar de novo, sem digitar, tira o aviso da regra enquanto a resposta não chega, e ele volta se a senha segue curta.
    const segunda = rede.segurar()
    await usuario.click(botaoCriar())
    await waitFor(() => expect(botaoCriar().textContent).toBe('Salvando…'))
    expect(screen.queryByText(`A senha precisa ter pelo menos ${String(TAMANHO_MINIMO_SENHA_NOVA)} caracteres.`)).toBeNull()
    segunda.liberar(erro(400, ErrorCode.ENTRADA_INVALIDA))
    expect(await screen.findByText(`A senha precisa ter pelo menos ${String(TAMANHO_MINIMO_SENHA_NOVA)} caracteres.`)).toBeTruthy()
    // Digitar de novo tira o aviso da regra.
    await usuario.type(campoSenha(), 'x')
    expect(screen.queryByText(`A senha precisa ter pelo menos ${String(TAMANHO_MINIMO_SENHA_NOVA)} caracteres.`)).toBeNull()
  })

  it('o bilhete vencido na hora de trocar: o aviso "Peça a senha de novo ao professor" e a senha digitada sai da tela', async () => {
    await abrirComALista()
    rede.responder(erro(401, ErrorCode.NAO_AUTENTICADO))
    const usuario = userEvent.setup()
    await usuario.type(campoSenha(), SENHA_NOVA)
    await usuario.click(botaoCriar())

    expect((await screen.findByRole('alert')).textContent).toBe('Esta senha provisória não vale mais. Peça a senha de novo ao professor.')
    expect(screen.queryByLabelText(/^Senha nova/)).toBeNull()
  })

  it('a conta segurada diz quanto esperar e não oferece "Tentar de novo", que só seguraria mais', async () => {
    await abrirComALista()
    rede.responder({ status: 429, corpo: erro(429, ErrorCode.CONTA_SEGURADA).corpo })
    const usuario = userEvent.setup()
    await usuario.type(campoSenha(), SENHA_NOVA)
    // O `Retry-After` vem no cabeçalho, e a rede falsa não os manda: sem ele a mensagem é a do catálogo, sem o tempo.
    await usuario.click(botaoCriar())

    expect((await screen.findByRole('alert')).textContent).toBe(mensagemDaEntradaPorMatricula(ErrorCode.CONTA_SEGURADA))
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    expect((campoSenha() as HTMLInputElement).value).toBe(SENHA_NOVA)
  })

  it('a rede caiu: o aviso com "Tentar de novo" e a senha no campo; o envio comum tira o aviso na hora, e "Tentar de novo" o mantém até a resposta', async () => {
    await abrirComALista()
    rede.responder({ status: 503 })
    const usuario = userEvent.setup()
    await usuario.type(campoSenha(), SENHA_NOVA)
    await usuario.click(botaoCriar())

    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
    expect((campoSenha() as HTMLInputElement).value).toBe(SENHA_NOVA)

    // O envio comum: o aviso da tentativa anterior sai na hora, e o botão volta a ficar livre quando a resposta chega.
    const comum = rede.segurar()
    await usuario.click(botaoCriar())
    await waitFor(() => expect(botaoCriar().textContent).toBe('Salvando…'))
    expect(screen.queryByRole('alert')).toBeNull()
    comum.liberar({ status: 503 })
    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
    expect((botaoCriar() as HTMLButtonElement).disabled).toBe(false)

    // O "Tentar de novo" mantém o aviso até a resposta, e a resposta que o recusa troca o aviso pelo erro do campo.
    const deNovo = rede.segurar()
    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(botaoCriar().textContent).toBe('Salvando…'))
    expect(screen.getByRole('alert')).toBeTruthy()
    deNovo.liberar(erro(400, ErrorCode.ENTRADA_INVALIDA))
    expect(await screen.findByText(`A senha precisa ter pelo menos ${String(TAMANHO_MINIMO_SENHA_NOVA)} caracteres.`)).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(trocas()).toHaveLength(3)
  })

  it('dois envios seguidos mandam uma troca só: o segundo, que chega antes de o botão desligar, é descartado', async () => {
    await abrirComALista()
    const noAr = atrasada()
    rede.responderPor(CAMINHO_DA_TROCA, noAr.resposta)
    const usuario = userEvent.setup()
    await usuario.type(campoSenha(), SENHA_NOVA)
    const formulario = campoSenha().closest('form') as HTMLFormElement

    fireEvent.submit(formulario)
    fireEvent.submit(formulario)
    await waitFor(() => expect(botaoCriar().textContent).toBe('Salvando…'))
    expect((botaoCriar() as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getAllByRole('status').map((estado) => estado.textContent)).toContain('Salvando…')
    expect(trocas()).toHaveLength(1)

    await act(async () => {
      noAr.liberar(erro(401, ErrorCode.NAO_AUTENTICADO))
      await Promise.resolve()
    })
    expect(trocas()).toHaveLength(1)
  })
})

describe('o recomeço: o aluno seguinte no mesmo computador', () => {
  it('o colega entra com a provisória dele e vê uma tela limpa: sem a senha digitada, sem o aviso e sem a lista de quem saiu', async () => {
    await chegarComOBilhete(BILHETE_A)
    // A primeira leitura é a de A, e a segunda a de B: `responderPor` acumula, e quem casa primeiro responde todas.
    let leituras = 0
    rede.responderPor(CAMINHO_DAS_TROCAS, () => (++leituras === 1 ? DUAS_DE_ANTES : LISTA_VAZIA))
    const localizacao = abrirATela()
    await screen.findByText('Gerada pela coordenação em 13/11/2026 às 02:05 · usada')
    rede.responder(erro(400, ErrorCode.ENTRADA_INVALIDA))
    const usuario = userEvent.setup()
    await usuario.type(campoSenha(), 'curta')
    await usuario.click(botaoCriar())
    await screen.findByText(`A senha precisa ter pelo menos ${String(TAMANHO_MINIMO_SENHA_NOVA)} caracteres.`)

    await usuario.click(screen.getByRole('link', { name: 'Voltar à entrada' }))
    expect(caminhoAtual(localizacao)).toBe(caminhoDaEscola(SLUG))
    cleanup()

    // O bilhete de A saiu junto: quem voltar à tela sem entrar de novo cai no aviso.
    abrirATela()
    expect(screen.getByRole('alert').textContent).toContain('Entre de novo com a sua matrícula')
    cleanup()

    await chegarComOBilhete(BILHETE_B)
    abrirATela()
    expect(await screen.findByText('É a primeira vez que você troca a senha.')).toBeTruthy()

    expect((campoSenha() as HTMLInputElement).value).toBe('')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText(/Gerada pela coordenação/)).toBeNull()
    expect(rede.chamadas.filter((chamada) => chamada.caminho === CAMINHO_DAS_TROCAS).map((chamada) => chamada.autorizacao)).toEqual([`Bearer ${BILHETE_A}`, `Bearer ${BILHETE_B}`])
  })

  it('a resposta da lista do aluno que saiu, chegando depois, não troca a lista de quem entrou', async () => {
    await chegarComOBilhete(BILHETE_A)
    const deA = atrasada()
    let leituras = 0
    rede.responderPor(CAMINHO_DAS_TROCAS, (caminho) => (++leituras === 1 ? deA.resposta(caminho) : LISTA_VAZIA))
    abrirATela()
    await screen.findByText('Carregando as senhas provisórias de antes…')
    await userEvent.setup().click(screen.getByRole('link', { name: 'Voltar à entrada' }))
    cleanup()

    await chegarComOBilhete(BILHETE_B)
    abrirATela()
    expect(await screen.findByText('É a primeira vez que você troca a senha.')).toBeTruthy()

    // A lista de A chega agora, e é a de uma aluna que já saiu: a tela de B continua como estava.
    await act(async () => {
      deA.liberar(DUAS_DE_ANTES)
      await new Promise((resolver) => setTimeout(resolver, 0))
    })
    expect(screen.queryByText(/Gerada pela coordenação/)).toBeNull()
    expect(screen.getByText('É a primeira vez que você troca a senha.')).toBeTruthy()
  })
})

describe('o bilhete não sai da memória', () => {
  // A URL é do e2e (`e2e/troca-da-provisoria.spec.ts`): o `window.location` do jsdom não é a localização que a tela lê (`memoryLocation`).
  it('nem o armazenamento do navegador nem os cookies guardam o bilhete, e a senha nova também não vai a eles', async () => {
    await chegarComOBilhete(BILHETE_A)
    rede.responderPor(CAMINHO_DAS_TROCAS, LISTA_VAZIA)
    abrirATela()
    await screen.findByText('É a primeira vez que você troca a senha.')
    await userEvent.setup().type(campoSenha(), SENHA_NOVA)

    const guardado = JSON.stringify({ ...window.localStorage }) + JSON.stringify({ ...window.sessionStorage }) + document.cookie
    expect(guardado).not.toContain(BILHETE_A)
    expect(guardado).not.toContain(SENHA_NOVA)
  })
})
