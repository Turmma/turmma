// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { criarClienteDeConsultas } from '../../../api/query-client'
import { consultaEu } from '../../../api/eu'
import { prepararTela, redeFalsa } from '../../../__fixtures__/render-screen'
import { ContextoDaSaida } from '../../../components/sign-out-context'
import { NAVEGACAO } from '../../navigation'
import BemVindo from './BemVindo'
import { O_QUE_A_IA_NUNCA_FAZ } from '../governanca/nunca-faz'
import { DESCRICAO_DO_LUGAR, falaDoPasso1, falasDosPassos, PASSOS_DA_COORDENACAO, TITULO_DE_ONDE_FICA_CADA_COISA } from './textos-da-introducao'

/**
 * A introdução da coordenação nos quatro estados (telas do aluno e primeiro acesso, 11.0; RF12, RF15, RF16, RF18, RF20): carregando,
 * erro, data desconhecida (vale a primeira vez), e com dado, na primeira vez e revendo. A rede é falsa; a peça, o cliente de
 * consultas e a rota são os de verdade. O que os textos dizem está em `textos-da-introducao.test.ts`; a primeira entrada pelo
 * convite, o aviso de incidente por cima, o recomeço da tela e os 360 px estão em `e2e/coordenacao-introducao.spec.ts`.
 */
prepararTela()

const ESCOLA = { id: '0197a1c0-0000-7000-8000-0000000000e1', nome: 'Colégio Vista Alegre', slug: 'vista-alegre' }
const REQUISICAO = '0190f5a0-0000-7000-8000-000000000001'
const FALHA = { status: 429, corpo: { erro: { codigo: 'LIMITE_EXCEDIDO', mensagem: 'x', requisicaoId: REQUISICAO } } } as const
const PRIMEIRA_DATA = '2026-10-25T12:00:00.000Z'
const DATA_ANTIGA = '2026-02-01T10:00:00.000Z'
const euComData = (introducaoVistaEm: string | null) => ({
  status: 200,
  corpo: { usuarioId: '0197a1c0-0000-7000-8000-0000000000a1', papel: 'coordenador', nome: 'Beatriz Lima', escola: ESCOLA, inatividadeMin: 30, introducaoVistaEm, acessos: [] },
})

/** Pelo `Router` com a mesma base da área da coordenação, o `navigate` e o link dão o endereço que o navegador teria. O primeiro lugar é absoluto (`~`). */
function montar(opcoes: { readonly sair?: () => void } = {}) {
  const cliente = criarClienteDeConsultas()
  const localizacao = memoryLocation({ path: '/coordenacao/bem-vindo', record: true })
  const sair = opcoes.sair ?? vi.fn()
  render(
    <QueryClientProvider client={cliente}>
      <ContextoDaSaida value={{ sair, saindo: false }}>
        <Router base="/coordenacao" hook={localizacao.hook}>
          <BemVindo />
        </Router>
      </ContextoDaSaida>
    </QueryClientProvider>,
  )
  return { cliente, localizacao, sair }
}

const PRIMEIRO_LUGAR = NAVEGACAO.coordenador[0]?.caminho ?? ''
const fala = () => screen.getByRole('heading', { level: 1 })
const botao = (nome: string) => screen.getByRole('button', { name: nome })
const talvezBotao = (nome: string) => screen.queryByRole('button', { name: nome })
const gravacoes = (rede: ReturnType<typeof redeFalsa>) => rede.chamadas.filter((chamada) => chamada.metodo === 'POST')

type Usuario = ReturnType<typeof userEvent.setup>

/** Espera a fala do passo `n` (a partir de 1) na tela. */
const esperarOPasso = (n: number) => waitFor(() => expect(fala().textContent).toBe(falasDosPassos(ESCOLA.nome)[n - 1]))

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
  for (let n = 1; n <= PASSOS_DA_COORDENACAO.length; n++) {
    if (n > 1) await usuario.click(botao('Continuar'))
    await esperarOPasso(n)
    await aoChegar(n)
  }
}

describe('BemVindo da coordenação: carregando', () => {
  it('mostra a fala do passo 1 e o "Sair", sem "Fechar", sem "Pular" e sem "Continuar" enquanto o modo não se sabe', async () => {
    const rede = redeFalsa()
    const leitura = rede.segurar()
    montar()

    // O nome da escola ainda não chegou: a fala diz "da sua escola", sem buraco.
    expect(fala().textContent).toBe(falaDoPasso1())
    expect(botao('Sair')).toBeTruthy()
    expect(talvezBotao('Fechar')).toBeNull()
    expect(talvezBotao('Pular')).toBeNull()
    expect(talvezBotao('Continuar')).toBeNull()
    // A função assina embaixo da onça, com o selo "IA" (D17, D58).
    expect(document.querySelector('[data-onca]')?.textContent).toMatch(/Analista de desempenho escolar/)

    leitura.liberar(euComData(null))
    await waitFor(() => expect(botao('Continuar')).toBeTruthy())
  })
})

describe('BemVindo da coordenação: erro', () => {
  it('diz o erro com "Tentar de novo", "Voltar para a abertura" e o "Sair"; tentar de novo leva aos passos', async () => {
    const rede = redeFalsa()
    rede.responder(FALHA)
    rede.responder(euComData(null))
    const usuario = userEvent.setup()
    montar()

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Introdução')
    // O primeiro lugar da coordenação, lido da navegação e absoluto: não `/coordenacao/coordenacao/…`.
    expect(screen.getByRole('link', { name: 'Voltar para a abertura' }).getAttribute('href')).toBe(PRIMEIRO_LUGAR)
    expect(PRIMEIRO_LUGAR).toBe('/coordenacao/painel')
    expect(botao('Sair')).toBeTruthy()
    expect(talvezBotao('Pular')).toBeNull()
    expect(talvezBotao('Fechar')).toBeNull()

    await usuario.click(botao('Tentar de novo'))
    await waitFor(() => expect(fala().textContent).toBe(falaDoPasso1(ESCOLA.nome)))
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
    expect(gravacoes(rede)).toEqual([])
  })
})

describe('BemVindo da coordenação: com dado', () => {
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
    expect(fala().textContent).toBe(falaDoPasso1(ESCOLA.nome))
  })
})

describe('BemVindo da coordenação: primeira vez', () => {
  it('data nula é a primeira vez: o passo 1 tem "Pular" e "Continuar", e nenhum "Fechar"', async () => {
    const rede = redeFalsa()
    rede.responder(euComData(null))
    montar()

    await waitFor(() => expect(botao('Continuar')).toBeTruthy())
    expect(fala().textContent).toBe(falaDoPasso1(ESCOLA.nome))
    expect(botao('Pular')).toBeTruthy()
    expect(talvezBotao('Fechar')).toBeNull()
  })

  it('"Pular" e "Continuar" têm a mesma classe em todo passo (RF16, D59)', async () => {
    const rede = redeFalsa()
    rede.responder(euComData(null))
    const usuario = userEvent.setup()
    montar()
    await waitFor(() => expect(botao('Continuar')).toBeTruthy())

    await percorrer(usuario, (n) => {
      expect(botao('Pular').className, `passo ${String(n)}`).toBe(botao('Continuar').className)
    })
  })

  it('cada passo mostra as frases dele, uma vez cada, na ordem', async () => {
    const rede = redeFalsa()
    rede.responder(euComData(null))
    const usuario = userEvent.setup()
    montar()
    await waitFor(() => expect(botao('Continuar')).toBeTruthy())

    await percorrer(usuario, (n) => {
      const passo = PASSOS_DA_COORDENACAO[n - 1]
      for (const linha of passo?.linhas ?? []) expect(screen.getAllByText(linha), `passo ${String(n)}: ${linha}`).toHaveLength(1)
    })
  })

  it('"onde fica cada coisa" só aparece no último passo, e sai de `NAVEGACAO.coordenador`: um item por lugar, na ordem, com a frase dele', async () => {
    const rede = redeFalsa()
    rede.responder(euComData(null))
    const usuario = userEvent.setup()
    montar()
    await waitFor(() => expect(botao('Continuar')).toBeTruthy())

    await percorrer(usuario, (n) => {
      if (n < PASSOS_DA_COORDENACAO.length) expect(screen.queryByText(TITULO_DE_ONDE_FICA_CADA_COISA), `passo ${String(n)}`).toBeNull()
    })

    // Limite deste caso: ele compara a lista com `NAVEGACAO.coordenador`, e uma lista fixa com os mesmos itens também passaria. Que o código
    // lê a navegação quem prova é a mutação `.slice(1)`, no documento da tarefa.
    const lista = screen.getByRole('region', { name: TITULO_DE_ONDE_FICA_CADA_COISA })
    const itens = within(lista).getAllByRole('listitem')
    expect(itens.map((item) => item.textContent)).toEqual(NAVEGACAO.coordenador.map((lugar) => `${lugar.rotulo} · ${DESCRICAO_DO_LUGAR[lugar.rotulo] ?? ''}`))
    // Lugar que a fase não tem não aparece: nenhum item de fase futura (D73).
    for (const futuro of ['Calendário', 'Rede', 'Operação']) expect(within(lista).queryByText(new RegExp(futuro))).toBeNull()
  })

  it('o passo 1 diz o nome da escola que o `/v1/eu` trouxe, e os outros três não o repetem', async () => {
    const rede = redeFalsa()
    rede.responder(euComData(null))
    const usuario = userEvent.setup()
    montar()
    await waitFor(() => expect(botao('Continuar')).toBeTruthy())

    expect(fala().textContent).toBe(`Eu ajudo a ler os números de ${ESCOLA.nome}.`)
    await percorrer(usuario, (n) => {
      if (n > 1) expect(fala().textContent, `passo ${String(n)}`).not.toContain(ESCOLA.nome)
    })
  })

  it('o passo 4 lista o que a IA nunca faz, uma frase por item e na ordem de `O_QUE_A_IA_NUNCA_FAZ`, dentro da região que rola', async () => {
    const rede = redeFalsa()
    rede.responder(euComData(null))
    const usuario = userEvent.setup()
    montar()
    await irAoPasso(usuario, PASSOS_DA_COORDENACAO.length)

    const regiao = screen.getByRole('region', { name: 'Leia até o fim' })
    const itens = within(regiao)
      .getAllByRole('listitem')
      .map((item) => item.textContent)
    // A lista do que a IA nunca faz vem antes da de lugares, e as duas moram na região que rola.
    expect(itens.slice(0, O_QUE_A_IA_NUNCA_FAZ.length)).toEqual(O_QUE_A_IA_NUNCA_FAZ)
    expect(itens).toHaveLength(O_QUE_A_IA_NUNCA_FAZ.length + NAVEGACAO.coordenador.length)
  })

  it('"Pular" no passo 1 grava a data, leva ao primeiro lugar e deixa o armazenamento vazio', async () => {
    const rede = redeFalsa()
    rede.responder(euComData(null))
    rede.responderPor('/v1/eu/introducao', { status: 200, corpo: { introducaoVistaEm: PRIMEIRA_DATA } })
    const usuario = userEvent.setup()
    const { cliente, localizacao } = montar()
    await waitFor(() => expect(botao('Pular')).toBeTruthy())

    await usuario.click(botao('Pular'))

    await waitFor(() => expect(cliente.getQueryData(consultaEu.queryKey)?.introducaoVistaEm).toBe(PRIMEIRA_DATA))
    // O endereço absoluto, pela raiz: a base `/coordenacao` da área não se soma a ele.
    expect(localizacao.history.at(-1)).toBe(PRIMEIRO_LUGAR)
    expect(gravacoes(rede).map((chamada) => chamada.caminho)).toEqual(['/v1/eu/introducao'])
    expect(Object.entries(window.localStorage)).toEqual([])
  })

  it('"Continuar" no último passo ("Começar") faz o mesmo que "Pular": um POST, a data no cache e a ida ao primeiro lugar', async () => {
    const rede = redeFalsa()
    rede.responder(euComData(null))
    rede.responderPor('/v1/eu/introducao', { status: 200, corpo: { introducaoVistaEm: PRIMEIRA_DATA } })
    const usuario = userEvent.setup()
    const { cliente, localizacao } = montar()
    await irAoPasso(usuario, PASSOS_DA_COORDENACAO.length)

    await usuario.click(botao('Continuar'))

    await waitFor(() => expect(cliente.getQueryData(consultaEu.queryKey)?.introducaoVistaEm).toBe(PRIMEIRA_DATA))
    expect(localizacao.history.at(-1)).toBe(PRIMEIRO_LUGAR)
    expect(gravacoes(rede).map((chamada) => chamada.caminho)).toEqual(['/v1/eu/introducao'])
  })

  it('o Esc não sai na primeira vez, e o Enter continua', async () => {
    const rede = redeFalsa()
    rede.responder(euComData(null))
    const usuario = userEvent.setup()
    const { localizacao } = montar()
    await waitFor(() => expect(botao('Continuar')).toBeTruthy())

    await usuario.keyboard('{Escape}')
    expect(localizacao.history.at(-1)).toBe('/coordenacao/bem-vindo')
    await usuario.keyboard('{Enter}')
    await esperarOPasso(2)
    expect(gravacoes(rede)).toEqual([])
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
    await irAoPasso(usuario, PASSOS_DA_COORDENACAO.length)

    await usuario.dblClick(botao('Continuar'))
    expect(gravacoes(rede)).toHaveLength(1)

    liberar()
    await waitFor(() => expect(cliente.getQueryData(consultaEu.queryKey)?.introducaoVistaEm).toBe(PRIMEIRA_DATA))
    expect(gravacoes(rede)).toHaveLength(1)
  })

  it('se a gravação falha, a pessoa segue ao primeiro lugar do mesmo jeito e a data continua nula no cache', async () => {
    const rede = redeFalsa()
    rede.responder(euComData(null))
    rede.responderPor('/v1/eu/introducao', FALHA)
    const usuario = userEvent.setup()
    const { cliente, localizacao } = montar()
    await waitFor(() => expect(botao('Pular')).toBeTruthy())

    await usuario.click(botao('Pular'))

    await waitFor(() => expect(gravacoes(rede)).toHaveLength(1))
    expect(localizacao.history.at(-1)).toBe(PRIMEIRO_LUGAR)
    expect(cliente.getQueryData(consultaEu.queryKey)?.introducaoVistaEm).toBeNull()
  })

  it('"Sair" no meio sai da conta e não grava: nenhum POST', async () => {
    const rede = redeFalsa()
    rede.responder(euComData(null))
    const usuario = userEvent.setup()
    const { sair } = montar()
    await irAoPasso(usuario, 2)

    await usuario.click(botao('Sair'))
    expect(sair).toHaveBeenCalledTimes(1)
    expect(gravacoes(rede)).toEqual([])
  })
})

describe('BemVindo da coordenação: revendo', () => {
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

  it.each([1, 2, 3, 4])('com a data já gravada, "Fechar" no passo %i leva ao primeiro lugar sem gravar nada', async (passo) => {
    const rede = redeFalsa()
    rede.responder(euComData(DATA_ANTIGA))
    const usuario = userEvent.setup()
    const { localizacao } = montar()
    await irAoPasso(usuario, passo)
    expect(localizacao.history.at(-1)).toBe('/coordenacao/bem-vindo')

    await usuario.click(botao('Fechar'))

    expect(localizacao.history.at(-1)).toBe(PRIMEIRO_LUGAR)
    expect(gravacoes(rede)).toEqual([])
  })

  it('o Esc de quem revê fecha, sem gravar nada', async () => {
    const rede = redeFalsa()
    rede.responder(euComData(DATA_ANTIGA))
    const usuario = userEvent.setup()
    const { localizacao } = montar()
    await irAoPasso(usuario, 2)

    await usuario.keyboard('{Escape}')

    expect(localizacao.history.at(-1)).toBe(PRIMEIRO_LUGAR)
    expect(gravacoes(rede)).toEqual([])
  })

  it('o último "Continuar" de quem revê também só fecha: a data não muda e nada é gravado', async () => {
    const rede = redeFalsa()
    rede.responder(euComData(DATA_ANTIGA))
    const usuario = userEvent.setup()
    const { cliente, localizacao } = montar()
    await irAoPasso(usuario, PASSOS_DA_COORDENACAO.length)

    await usuario.click(botao('Continuar'))

    expect(localizacao.history.at(-1)).toBe(PRIMEIRO_LUGAR)
    expect(cliente.getQueryData(consultaEu.queryKey)?.introducaoVistaEm).toBe(DATA_ANTIGA)
    expect(gravacoes(rede)).toEqual([])
  })
})

describe('BemVindo da coordenação: o que a tela nunca mostra', () => {
  it('nenhum passo tem pontos, sequência, contador de uso, ranking nem meta (RF15, D59, D64)', async () => {
    const rede = redeFalsa()
    rede.responder(euComData(null))
    const usuario = userEvent.setup()
    montar()
    await waitFor(() => expect(botao('Continuar')).toBeTruthy())

    await percorrer(usuario, (n) => {
      const tela = fala().closest('[data-tela-de-foco]')?.textContent ?? ''
      expect(tela, `passo ${String(n)}`).not.toMatch(/pontos|sequência|meta\b|prêmio|ranking|\d+ (?:turmas|aulas|usos)/i)
    })
  })
})
