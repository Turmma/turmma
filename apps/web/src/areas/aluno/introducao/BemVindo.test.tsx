// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { criarClienteDeConsultas } from '../../../api/query-client'
import { consultaEu } from '../../../api/eu'
import { prepararTela, redeFalsa } from '../../../__fixtures__/render-screen'
import { ContextoDaSaida } from '../../../components/sign-out-context'
import { CHAVE_DA_LETRA, escolherLetra } from '../../../text-size'
import { GRUPOS_DO_AVISO } from './aviso-de-privacidade'
import BemVindo from './BemVindo'
import { FALA_DO_TUTOR, PASSOS_DO_ALUNO } from './textos-da-introducao'

/**
 * A introdução do aluno nos quatro estados (telas do aluno e primeiro acesso, 9.0; RF12, RF13, RF16, RF18, RF20): carregando,
 * erro, data desconhecida (vale a primeira vez), e com dado, na primeira vez e revendo. A rede é falsa; a peça, o cliente de
 * consultas, a rota e o armazenamento são os de verdade. O que os textos dizem está em `textos-da-introducao.test.ts`; a
 * entrada em dois computadores, o clique duplo no navegador e a 360 px estão em `e2e/aluno-introducao.spec.ts`.
 */
prepararTela()

const ESCOLA = { id: '0197a1c0-0000-7000-8000-0000000000e1', nome: 'Colégio Vista Alegre', slug: 'vista-alegre' }
const REQUISICAO = '0190f5a0-0000-7000-8000-000000000001'
const FALHA = { status: 429, corpo: { erro: { codigo: 'LIMITE_EXCEDIDO', mensagem: 'x', requisicaoId: REQUISICAO } } } as const
const PRIMEIRA_DATA = '2026-10-25T12:00:00.000Z'
const DATA_ANTIGA = '2026-02-01T10:00:00.000Z'
const euComData = (introducaoVistaEm: string | null) => ({
  status: 200,
  corpo: { usuarioId: '0197a1c0-0000-7000-8000-0000000000a1', papel: 'aluno', nome: 'Camila Souza', escola: ESCOLA, inatividadeMin: 30, introducaoVistaEm, acessos: [] },
})

afterEach(() => {
  window.localStorage.clear()
  escolherLetra('padrao')
})

/** A área do aluno monta as rotas sob `/aluno`; o `Router` com a mesma base dá ao link e ao `navigate` o endereço que o navegador teria. */
function montar(opcoes: { readonly sair?: () => void } = {}) {
  const cliente = criarClienteDeConsultas()
  const localizacao = memoryLocation({ path: '/aluno/bem-vindo', record: true })
  const sair = opcoes.sair ?? vi.fn()
  render(
    <QueryClientProvider client={cliente}>
      <ContextoDaSaida value={{ sair, saindo: false }}>
        <Router base="/aluno" hook={localizacao.hook}>
          <BemVindo />
        </Router>
      </ContextoDaSaida>
    </QueryClientProvider>,
  )
  return { cliente, localizacao, sair }
}

const fala = () => screen.getByRole('heading', { level: 1 })
const botao = (nome: string) => screen.getByRole('button', { name: nome })
const talvezBotao = (nome: string) => screen.queryByRole('button', { name: nome })

type Usuario = ReturnType<typeof userEvent.setup>

/** Espera a fala do passo `n` (a partir de 1) na tela. */
const esperarOPasso = (n: number) => waitFor(() => expect(fala().textContent).toBe(PASSOS_DO_ALUNO[n - 1]?.fala))

/** Chega ao passo `n` (a partir de 1) pelo "Continuar", um clique por passo. */
async function irAoPasso(usuario: Usuario, n: number): Promise<void> {
  // A fala do passo 1 também é a do carregando: o "Continuar" só existe com a leitura terminada.
  await screen.findByRole('button', { name: 'Continuar' })
  for (let passo = 1; passo < n; passo++) {
    await usuario.click(botao('Continuar'))
    await esperarOPasso(passo + 1)
  }
}

/** Passa por todos os passos, na ordem, e chama `aoChegar` em cada um. */
async function percorrer(usuario: Usuario, aoChegar: (n: number) => void | Promise<void>): Promise<void> {
  await screen.findByRole('button', { name: 'Continuar' })
  for (let n = 1; n <= PASSOS_DO_ALUNO.length; n++) {
    if (n > 1) await usuario.click(botao('Continuar'))
    await esperarOPasso(n)
    await aoChegar(n)
  }
}

describe('BemVindo: carregando', () => {
  it('mostra a fala do passo 1 e o "Sair", sem "Fechar", sem "Pular" e sem "Continuar" enquanto o modo não se sabe', async () => {
    const rede = redeFalsa()
    const leitura = rede.segurar()
    montar()

    expect(fala().textContent).toBe(FALA_DO_TUTOR)
    expect(fala().textContent).toBe(PASSOS_DO_ALUNO[0]?.fala)
    expect(botao('Sair')).toBeTruthy()
    expect(talvezBotao('Fechar')).toBeNull()
    expect(talvezBotao('Pular')).toBeNull()
    expect(talvezBotao('Continuar')).toBeNull()

    leitura.liberar(euComData(null))
    await waitFor(() => expect(botao('Continuar')).toBeTruthy())
  })
})

describe('BemVindo: erro', () => {
  it('diz o erro com "Tentar de novo", "Voltar para a abertura" e o "Sair"; tentar de novo leva aos passos', async () => {
    const rede = redeFalsa()
    rede.responder(FALHA)
    rede.responder(euComData(null))
    const usuario = userEvent.setup()
    montar()

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Introdução')
    expect(screen.getByRole('link', { name: 'Voltar para a abertura' }).getAttribute('href')).toBe('/aluno/inicio')
    expect(botao('Sair')).toBeTruthy()
    expect(talvezBotao('Pular')).toBeNull()
    expect(talvezBotao('Fechar')).toBeNull()

    await usuario.click(botao('Tentar de novo'))
    await waitFor(() => expect(fala().textContent).toBe(FALA_DO_TUTOR))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('"Sair" no erro sai da conta e não grava nada', async () => {
    const rede = redeFalsa()
    rede.responder(FALHA)
    const usuario = userEvent.setup()
    const { sair } = montar()
    await screen.findByRole('alert')

    await usuario.click(botao('Sair'))
    expect(sair).toHaveBeenCalledTimes(1)
    expect(rede.chamadas.filter((chamada) => chamada.metodo === 'POST')).toEqual([])
  })
})

describe('BemVindo: com dado', () => {
  it('uma releitura do `/v1/eu` que falha não tira os passos da tela: o erro é de quem ainda não tem dado', async () => {
    const rede = redeFalsa()
    rede.responder(euComData(null))
    rede.responder(FALHA)
    const { cliente } = montar()
    await screen.findByRole('button', { name: 'Continuar' })

    // O TanStack avisa a tela uma tarefa depois de a leitura terminar: sem esperar essa tarefa, o caso passaria mesmo se o erro tirasse os passos.
    await act(async () => {
      await cliente.refetchQueries({ queryKey: consultaEu.queryKey })
      await new Promise((resolver) => setTimeout(resolver, 0))
    })

    expect(cliente.getQueryState(consultaEu.queryKey)?.status).toBe('error')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(botao('Continuar')).toBeTruthy()
    expect(fala().textContent).toBe(FALA_DO_TUTOR)
  })
})

describe('BemVindo: primeira vez', () => {
  it('data nula é a primeira vez: o passo 1 diz que o Tutor é um programa e pode errar, sem "Fechar" nem "Pular"', async () => {
    const rede = redeFalsa()
    rede.responder(euComData(null))
    montar()

    await waitFor(() => expect(botao('Continuar')).toBeTruthy())
    expect(fala().textContent).toMatch(/um programa da escola/)
    expect(document.body.textContent).toMatch(/posso errar/i)
    expect(talvezBotao('Fechar')).toBeNull()
    expect(talvezBotao('Pular')).toBeNull()
  })

  it('os passos 1 a 3 não têm "Pular" nem X, o Esc não sai, e o 4 tem "Pular" do mesmo tamanho que "Continuar"', async () => {
    const rede = redeFalsa()
    rede.responder(euComData(null))
    const usuario = userEvent.setup()
    const { localizacao } = montar()
    await waitFor(() => expect(botao('Continuar')).toBeTruthy())

    await percorrer(usuario, async (n) => {
      expect(talvezBotao('Fechar'), `passo ${String(n)}`).toBeNull()
      await usuario.keyboard('{Escape}')
      expect(localizacao.history.at(-1), `passo ${String(n)}`).toBe('/aluno/bem-vindo')
      if (n < PASSOS_DO_ALUNO.length) expect(talvezBotao('Pular'), `passo ${String(n)}`).toBeNull()
    })
    // Parado no passo 4: o "Pular" existe, do mesmo desenho que o "Continuar" (RF16).
    expect(botao('Pular').className).toBe(botao('Continuar').className)
    expect(rede.chamadas.filter((chamada) => chamada.metodo === 'POST')).toEqual([])
  })

  it('o passo 3 mostra o aviso: os quatro grupos, com todas as frases, e a supervisão é a da faixa', async () => {
    const rede = redeFalsa()
    rede.responder(euComData(null))
    const usuario = userEvent.setup()
    montar()
    await waitFor(() => expect(botao('Continuar')).toBeTruthy())
    await irAoPasso(usuario, 3)

    expect(fala().textContent).toBe('Veja o que a escola guarda de você.')
    const titulos = screen.getAllByRole('heading', { level: 2 }).map((titulo) => titulo.textContent)
    expect(titulos).toEqual(GRUPOS_DO_AVISO.map((grupo) => grupo.titulo))
    for (const grupo of GRUPOS_DO_AVISO) for (const frase of grupo.frases) expect(screen.getAllByText(frase), frase).toHaveLength(1)
  })

  it('o aviso mostra "Role para ler mais" enquanto há o que ler abaixo, e o tira ao chegar ao fim da região', async () => {
    const rede = redeFalsa()
    rede.responder(euComData(null))
    const usuario = userEvent.setup()
    montar()
    await waitFor(() => expect(botao('Continuar')).toBeTruthy())
    await irAoPasso(usuario, 3)
    const regiao = screen.getByRole('region', { name: 'Aviso de privacidade' })
    const rolarPara = (topo: number) => {
      Object.defineProperty(regiao, 'clientHeight', { configurable: true, value: 200 })
      Object.defineProperty(regiao, 'scrollHeight', { configurable: true, value: 1000 })
      regiao.scrollTop = topo
      fireEvent.scroll(regiao)
    }

    expect(screen.getByText('Role para ler mais')).toBeTruthy()
    rolarPara(300)
    expect(screen.getByText('Role para ler mais')).toBeTruthy()
    rolarPara(800)
    expect(screen.queryByText('Role para ler mais')).toBeNull()
    rolarPara(100)
    expect(screen.getByText('Role para ler mais')).toBeTruthy()
  })

  it('seguir ou pular no passo 4 sem escolher a letra deixa o armazenamento vazio; escolher "Maior" guarda na hora', async () => {
    const rede = redeFalsa()
    rede.responder(euComData(null))
    rede.responderPor('/v1/eu/introducao', { status: 200, corpo: { introducaoVistaEm: PRIMEIRA_DATA } })
    const usuario = userEvent.setup()
    const { localizacao } = montar()
    await waitFor(() => expect(botao('Continuar')).toBeTruthy())
    await irAoPasso(usuario, 4)
    expect(Object.entries(window.localStorage)).toEqual([])

    await usuario.click(screen.getByRole('radio', { name: 'Maior' }))
    expect(window.localStorage.getItem(CHAVE_DA_LETRA)).toBe('maior')

    await usuario.click(botao('Pular'))
    expect(window.localStorage.getItem(CHAVE_DA_LETRA)).toBe('maior')
    expect(localizacao.history.at(-1)).toBe('/aluno/inicio')
  })

  it.each(['Continuar', 'Pular'])('"%s" no passo 4, sem escolher a letra, faz as mesmas coisas: um POST, a data no cache e a ida à abertura', async (saida) => {
    const rede = redeFalsa()
    rede.responder(euComData(null))
    rede.responderPor('/v1/eu/introducao', { status: 200, corpo: { introducaoVistaEm: PRIMEIRA_DATA } })
    const usuario = userEvent.setup()
    const { cliente, localizacao } = montar()
    await irAoPasso(usuario, 4)
    expect(Object.entries(window.localStorage)).toEqual([])

    await usuario.click(botao(saida))

    await waitFor(() => expect(cliente.getQueryData(consultaEu.queryKey)?.introducaoVistaEm).toBe(PRIMEIRA_DATA))
    expect(localizacao.history.at(-1)).toBe('/aluno/inicio')
    expect(rede.chamadas.filter((chamada) => chamada.metodo === 'POST').map((chamada) => chamada.caminho)).toEqual(['/v1/eu/introducao'])
    expect(Object.entries(window.localStorage)).toEqual([])
  })

  it('dois cliques seguidos em "Continuar" no último passo fazem um POST só', async () => {
    const rede = redeFalsa()
    rede.responder(euComData(null))
    // A gravação fica no ar até o fim do caso: com a resposta já no cache, o segundo clique cairia em "revendo" e o caso passaria sem a trava.
    let liberar: () => void = () => undefined
    const noAr = new Promise<void>((resolver) => (liberar = resolver))
    rede.responderPor('/v1/eu/introducao', async () => {
      await noAr
      return { status: 200, corpo: { introducaoVistaEm: PRIMEIRA_DATA } }
    })
    const usuario = userEvent.setup()
    const { cliente } = montar()
    await waitFor(() => expect(botao('Continuar')).toBeTruthy())
    await irAoPasso(usuario, 4)

    await usuario.dblClick(botao('Continuar'))
    expect(rede.chamadas.filter((chamada) => chamada.metodo === 'POST')).toHaveLength(1)

    liberar()
    await waitFor(() => expect(cliente.getQueryData(consultaEu.queryKey)?.introducaoVistaEm).toBe(PRIMEIRA_DATA))
    expect(rede.chamadas.filter((chamada) => chamada.metodo === 'POST')).toHaveLength(1)
  })

  it('se a gravação falha, a pessoa segue para a abertura do mesmo jeito e a data continua nula no cache', async () => {
    const rede = redeFalsa()
    rede.responder(euComData(null))
    rede.responderPor('/v1/eu/introducao', FALHA)
    const usuario = userEvent.setup()
    const { cliente, localizacao } = montar()
    await waitFor(() => expect(botao('Continuar')).toBeTruthy())
    await irAoPasso(usuario, 4)

    await usuario.click(botao('Continuar'))

    await waitFor(() => expect(rede.chamadas.some((chamada) => chamada.metodo === 'POST')).toBe(true))
    expect(localizacao.history.at(-1)).toBe('/aluno/inicio')
    expect(cliente.getQueryData(consultaEu.queryKey)?.introducaoVistaEm).toBeNull()
  })

  it('"Sair" no meio sai da conta e não grava: nenhum POST', async () => {
    const rede = redeFalsa()
    rede.responder(euComData(null))
    const usuario = userEvent.setup()
    const { sair } = montar()
    await waitFor(() => expect(botao('Continuar')).toBeTruthy())
    await irAoPasso(usuario, 2)

    await usuario.click(botao('Sair'))
    expect(sair).toHaveBeenCalledTimes(1)
    expect(rede.chamadas.filter((chamada) => chamada.metodo === 'POST')).toEqual([])
  })
})

describe('BemVindo: revendo', () => {
  it('com a data já gravada, "Fechar" está em todo passo e "Pular" em nenhum', async () => {
    const rede = redeFalsa()
    rede.responder(euComData(DATA_ANTIGA))
    const usuario = userEvent.setup()
    montar()
    await waitFor(() => expect(botao('Continuar')).toBeTruthy())

    await percorrer(usuario, (n) => {
      expect(botao('Fechar'), `passo ${String(n)}`).toBeTruthy()
      expect(talvezBotao('Pular'), `passo ${String(n)}`).toBeNull()
    })
  })

  it.each([1, 2, 3, 4])('com a data já gravada, "Fechar" no passo %i volta a Eu sem gravar nada', async (passo) => {
    const rede = redeFalsa()
    rede.responder(euComData(DATA_ANTIGA))
    const usuario = userEvent.setup()
    const { localizacao } = montar()
    await irAoPasso(usuario, passo)
    expect(localizacao.history.at(-1)).toBe('/aluno/bem-vindo')

    await usuario.click(botao('Fechar'))

    expect(localizacao.history.at(-1)).toBe('/aluno/eu')
    expect(rede.chamadas.filter((chamada) => chamada.metodo === 'POST')).toEqual([])
  })

  it.each([1, 2, 3])('com a data já gravada, o Esc no passo %i, que na primeira vez é obrigatório, leva a Eu sem gravar nada', async (passo) => {
    const rede = redeFalsa()
    rede.responder(euComData(DATA_ANTIGA))
    const usuario = userEvent.setup()
    const { localizacao } = montar()
    await irAoPasso(usuario, passo)
    // O Esc é o primeiro gesto de saída: a tela ainda está em `/aluno/bem-vindo`, e só ele pode levá-la a Eu.
    expect(localizacao.history.at(-1)).toBe('/aluno/bem-vindo')

    await usuario.keyboard('{Escape}')

    expect(localizacao.history.at(-1)).toBe('/aluno/eu')
    expect(rede.chamadas.filter((chamada) => chamada.metodo === 'POST')).toEqual([])
  })

  it('na primeira vez o Esc não leva a lugar nenhum: os passos 1 a 3 são avisos obrigatórios', async () => {
    const rede = redeFalsa()
    rede.responder(euComData(null))
    const usuario = userEvent.setup()
    const { localizacao } = montar()
    await irAoPasso(usuario, 2)

    await usuario.keyboard('{Escape}')

    expect(localizacao.history.at(-1)).toBe('/aluno/bem-vindo')
    expect(rede.chamadas.filter((chamada) => chamada.metodo === 'POST')).toEqual([])
  })

  it('o último "Continuar" de quem revê também só fecha: a data não muda e nada é gravado', async () => {
    const rede = redeFalsa()
    rede.responder(euComData(DATA_ANTIGA))
    const usuario = userEvent.setup()
    const { cliente, localizacao } = montar()
    await waitFor(() => expect(botao('Continuar')).toBeTruthy())
    await irAoPasso(usuario, 4)

    await usuario.click(botao('Continuar'))

    expect(localizacao.history.at(-1)).toBe('/aluno/eu')
    expect(cliente.getQueryData(consultaEu.queryKey)?.introducaoVistaEm).toBe(DATA_ANTIGA)
    expect(rede.chamadas.filter((chamada) => chamada.metodo === 'POST')).toEqual([])
  })
})

describe('BemVindo: o que a tela nunca mostra', () => {
  it('nenhum passo tem pontos, sequência, contador de uso nem a palavra "nota" (RF10, D59)', async () => {
    const rede = redeFalsa()
    rede.responder(euComData(null))
    const usuario = userEvent.setup()
    montar()
    await waitFor(() => expect(botao('Continuar')).toBeTruthy())

    await percorrer(usuario, (n) => {
      const texto = fala().closest('[data-tela-de-foco]')?.textContent ?? ''
      expect(texto, `passo ${String(n)}`).not.toMatch(/\bnotas?\b|pontos|sequência|meta\b|prêmio|ranking/i)
    })
  })
})
