// @vitest-environment jsdom
import type { PapelDeUsuario } from '@educa/shared'
import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useContext } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { consultaEu } from '../api/eu'
import { abrirSessaoPeloCookie } from '../api/sessao'
import { criarClienteDeConsultas } from '../api/cliente-de-consultas'
import { ROTAS } from '../caminhos'
import { classesDo } from '../__fixtures__/cor-das-classes'
import { prepararTela, redeFalsa, type RedeFalsa } from '../__fixtures__/tela'
import { CascaDaEscola } from './CascaDaEscola'
import { ContextoDaSaida } from './saida-da-casca'

/**
 * A casca da escola (`docs/interface.md` 11.1; D80; 13.0): onde ficam os itens de navegação em cada largura, e a gaveta
 * que fecha quando a rota ou a pessoa da sessão troca (a troca de escola é do `areas.spec.ts › troca de escola pelo
 * seletor…`, no navegador). A rede é falsa e todo o resto é a casca de verdade: a
 * sessão, o cliente de consultas e as rotas. Medida, foco e toque são do e2e (`casca.spec.ts`, `casca-no-celular.spec.ts`).
 *
 * O `jsdom` não tem `matchMedia` nem `showModal`: o teste instala os dois. O `matchMedia` casa só as consultas da largura
 * pedida (as duas quebras da casca, 768 e 1024 px), e o `dialog` modal abre e fecha pelo atributo `open`, com o evento
 * `close` que o navegador dispara. Nenhum dos dois esconde a regra: a decisão de largura e o fechamento são da casca.
 */
prepararTela()

type Largura = 'estreita' | 'media' | 'larga'

const ESCOLA = { id: '0197a1c0-0000-7000-8000-0000000000e1', nome: 'Colégio Vista Alegre', slug: 'vista-alegre' }
const PESSOA_A = '0197a1c0-0000-7000-8000-0000000000a1'
const PESSOA_B = '0197a1c0-0000-7000-8000-0000000000b2'

function respostaEu(papel: PapelDeUsuario, usuarioId: string, nome: string) {
  return { status: 200, corpo: { usuarioId, papel, nome, escola: ESCOLA, inatividadeMin: 30, introducaoVistaEm: '2026-02-01T10:00:00.000Z', acessos: [] } }
}

function instalarLargura(largura: Largura): void {
  const casa = (consulta: string): boolean => (consulta === '(min-width: 768px)' ? largura !== 'estreita' : consulta === '(min-width: 1024px)' ? largura === 'larga' : false)
  vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: casa(consulta), media: consulta, addEventListener: () => undefined, removeEventListener: () => undefined }))
}

beforeEach(() => {
  // O `jsdom` não implementa o `dialog` modal. `close` só age aberto, como no navegador: tira o `open` e avisa.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})

function desenhar(caminho: string) {
  const cliente = criarClienteDeConsultas()
  const localizacao = memoryLocation({ path: caminho, record: true })
  render(
    <QueryClientProvider client={cliente}>
      <Router hook={localizacao.hook}>
        <CascaDaEscola>
          <p>Tela aberta</p>
        </CascaDaEscola>
      </Router>
    </QueryClientProvider>,
  )
  return { cliente, localizacao }
}

/** A casca no papel e na largura pedidos, com o `/v1/eu` já respondido e a tela de volta. */
async function abrirCasca(rede: RedeFalsa, papel: PapelDeUsuario, largura: Largura, caminho: string) {
  instalarLargura(largura)
  rede.responder(respostaEu(papel, PESSOA_A, 'Camila Souza'))
  const casca = desenhar(caminho)
  await screen.findByText('Camila Souza')
  return casca
}

const gavetaDaPagina = (): HTMLDialogElement => {
  const gaveta = document.querySelector<HTMLDialogElement>('dialog[aria-label="Menu"]')
  if (gaveta === null) throw new Error('a página não tem a gaveta')
  return gaveta
}

describe('a gaveta fecha com a rota e com a pessoa da sessão', () => {
  it('a pessoa da sessão troca sob o mesmo caminho', async () => {
    const rede = redeFalsa()
    const { cliente, localizacao } = await abrirCasca(rede, 'coordenador', 'media', ROTAS.estrutura)

    // De 768 a 1023 px a lateral abre por cima, pelo trilho: é a gaveta, com o botão que diz que está aberta.
    fireEvent.click(screen.getByRole('button', { name: 'Abrir a lateral' }))
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Abrir a lateral' }).getAttribute('aria-expanded')).toBe('true')

    // O `/v1/eu` volta com outra pessoa (o seletor de escola, o login por cima), e a rota não mudou.
    rede.responder(respostaEu('coordenador', PESSOA_B, 'Beatriz Lima'))
    await cliente.refetchQueries({ queryKey: consultaEu.queryKey })

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull()
    })
    expect(screen.getByRole('button', { name: 'Abrir a lateral' }).getAttribute('aria-expanded')).toBe('false')
    expect(localizacao.history).toEqual([ROTAS.estrutura])
  })

  it('o /v1/eu que chega depois do toque no menu não fecha a gaveta: a pessoa passou de ninguém a alguém, e não de uma a outra', async () => {
    instalarLargura('estreita')
    const rede = redeFalsa()
    const eu = rede.segurar()
    desenhar(ROTAS.estrutura)

    // A barra do topo já está na tela, e o botão do menu responde, antes de a consulta da pessoa voltar (CPU lenta, rede de escola).
    fireEvent.click(screen.getByRole('button', { name: 'Abrir o menu' }))
    expect(gavetaDaPagina().hasAttribute('open')).toBe(true)

    eu.liberar(respostaEu('coordenador', PESSOA_A, 'Camila Souza'))
    // O nome vem do `/v1/eu`: achá-lo prova que a consulta voltou e a casca já a desenhou (o `textContent` da gaveta lê também o `dialog` fechado,
    // e por isso a espera é pelo nome, e não pelo estado da gaveta).
    await screen.findByText('Camila Souza')
    expect(gavetaDaPagina().hasAttribute('open')).toBe(true)
    expect(screen.getByRole('button', { name: 'Abrir o menu' }).getAttribute('aria-expanded')).toBe('true')
  })

  it('a troca de pessoa como a aplicação faz, de A por ninguém e de ninguém para B, fecha a gaveta aberta no meio: a última pessoa conhecida fica guardada', async () => {
    const rede = redeFalsa()
    const { cliente } = await abrirCasca(rede, 'coordenador', 'estreita', ROTAS.estrutura)

    // `aoTrocarDeSessao` (main.tsx) esvazia as consultas: o `/v1/eu` de A some e o de B ainda não voltou.
    const deB = rede.segurar()
    void cliente.resetQueries()
    await waitFor(() => {
      expect(cliente.getQueryData(consultaEu.queryKey)).toBeUndefined()
    })
    // Sem ninguém na sessão a barra do topo continua na tela, e o toque no menu abre a gaveta.
    fireEvent.click(screen.getByRole('button', { name: 'Abrir o menu' }))
    expect(gavetaDaPagina().hasAttribute('open')).toBe(true)

    // B chega: é outra pessoa, e a gaveta que A deixou aberta não fica por cima da sessão dele.
    deB.liberar(respostaEu('coordenador', PESSOA_B, 'Beatriz Lima'))
    await screen.findByText('Beatriz Lima')
    await waitFor(() => {
      expect(gavetaDaPagina().hasAttribute('open')).toBe(false)
    })
    expect(screen.getByRole('button', { name: 'Abrir o menu' }).getAttribute('aria-expanded')).toBe('false')
  })

  it('a rota troca com a gaveta aberta', async () => {
    const rede = redeFalsa()
    const { localizacao } = await abrirCasca(rede, 'coordenador', 'media', ROTAS.estrutura)

    fireEvent.click(screen.getByRole('button', { name: 'Abrir a lateral' }))
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBeTruthy()

    localizacao.navigate(ROTAS.governanca)
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull()
    })
    expect(screen.getByRole('button', { name: 'Abrir a lateral' }).getAttribute('aria-expanded')).toBe('false')
  })
})

describe('a âncora do sino (telas da coordenação, 1.0)', () => {
  it('abaixo de 768 px a âncora está na barra do topo, e acima, no conteúdo: uma só por vez, vazia, para o sino se desenhar nela', async () => {
    for (const [largura, dentroDe] of [
      ['estreita', 'header'],
      ['media', 'main'],
      ['larga', 'main'],
    ] as const) {
      const rede = redeFalsa()
      await abrirCasca(rede, 'coordenador', largura, ROTAS.estrutura)
      const ancoras = document.querySelectorAll('[data-ancora-do-sino]')
      expect(ancoras, largura).toHaveLength(1)
      expect(ancoras[0]?.parentElement?.tagName.toLowerCase(), largura).toBe(dentroDe)
      expect(ancoras[0]?.childElementCount, largura).toBe(0)
      cleanup()
    }
  })

  it('no celular a âncora fica na barra do topo, na mesma fileira do "Sair"', async () => {
    const rede = redeFalsa()
    await abrirCasca(rede, 'coordenador', 'estreita', ROTAS.estrutura)
    const ancora = document.querySelector('[data-ancora-do-sino]')
    expect(ancora?.parentElement?.contains(screen.getByRole('button', { name: 'Sair' }))).toBe(true)
  })
})

describe('onde ficam os itens de navegação em cada largura (RF14)', () => {
  it('abaixo de 768 px, o professor tem os itens na barra de baixo, e a gaveta fica com o resto', async () => {
    const rede = redeFalsa()
    await abrirCasca(rede, 'professor', 'estreita', ROTAS.turmas)

    // A barra é irmã da gaveta, e não filha dela: com o `dialog` modal aberto o navegador a deixa inerte.
    const barra = screen.getByRole('navigation', { name: 'Seções' })
    expect(barra.closest('dialog')).toBeNull()
    expect(within(barra).getAllByRole('link').map((link) => link.textContent)).toEqual(['Início', 'Turmas', 'Ferramentas', 'Criados'])
    expect(document.documentElement.hasAttribute('data-barra-de-baixo')).toBe(true)

    const gaveta = gavetaDaPagina()
    expect(gaveta.querySelector('nav[aria-label="Seções"]')).toBeNull()
    expect(gaveta.querySelector('nav[aria-label="Sua conta"]')).not.toBeNull()
    // "Seu time" saiu da lateral (X3, 2.0): nenhum grupo de agentes na gaveta nem na página.
    expect(document.querySelector('nav[aria-label="Seu time"]')).toBeNull()
    expect(gaveta.textContent).toContain('Colégio Vista Alegre')

    // O `<main>` guarda embaixo a altura da barra (o lugar dela é a variável do `<html>`).
    expect(classesDo(screen.getByRole('main')).has('pb-[calc(var(--barra-baixo,0px)+2rem)]')).toBe(true)
  })

  it('a casca do professor só lê a sessão: as entregas que esperam ele são do sino da área, e não há leitura para o contador de um grupo da lateral (X3, 2.0)', async () => {
    const rede = redeFalsa()
    await abrirCasca(rede, 'professor', 'larga', ROTAS.turmas)
    // Deixa passar o que a casca pediria depois do `/v1/eu`, se ainda pedisse algo.
    await new Promise((resolver) => setTimeout(resolver, 20))
    expect(rede.chamadas.map((chamada) => chamada.caminho.split('?')[0])).toEqual(['/v1/eu'])
  })

  it('abaixo de 768 px, o aluno tem Início, Tarefas e Eu na barra, a gaveta fica sem navegação nem rodapé, e Início acende na conversa do Tutor', async () => {
    const rede = redeFalsa()
    await abrirCasca(rede, 'aluno', 'estreita', ROTAS.tutor)

    const barra = screen.getByRole('navigation', { name: 'Seções' })
    expect(within(barra).getAllByRole('link').map((link) => link.textContent)).toEqual(['Início', 'Tarefas', 'Eu'])
    expect(within(barra).getByRole('link', { name: 'Início' }).getAttribute('aria-current')).toBe('page')
    const gaveta = gavetaDaPagina()
    expect(gaveta.querySelector('nav[aria-label="Seções"]')).toBeNull()
    // "Privacidade" saiu do rodapé: o aluno acha a linha em Eu, e o "Sair" continua no pé da gaveta (D59).
    expect(gaveta.querySelector('nav[aria-label="Rodapé"]')).toBeNull()
    expect(within(gaveta).getByRole('button', { name: 'Sair', hidden: true })).toBeTruthy()
  })

  it('abaixo de 768 px, a coordenação, com os quatro lugares da X2, tem a barra de baixo e a gaveta fica sem a navegação', async () => {
    const rede = redeFalsa()
    await abrirCasca(rede, 'coordenador', 'estreita', ROTAS.estrutura)

    const barra = screen.getByRole('navigation', { name: 'Seções' })
    expect(within(barra).getAllByRole('link').map((link) => link.textContent)).toEqual(['Painel', 'Analista', 'Escola', 'Registros'])
    // A Estrutura é a aba Turmas de Escola: o lugar aceso é o dela.
    expect(within(barra).getByRole('link', { name: 'Escola' }).getAttribute('aria-current')).toBe('page')
    expect(document.documentElement.hasAttribute('data-barra-de-baixo')).toBe(true)
    expect(gavetaDaPagina().querySelector('nav[aria-label="Seções"]')).toBeNull()
    expect(classesDo(screen.getByRole('main')).has('pb-[calc(var(--barra-baixo,0px)+2rem)]')).toBe(true)
  })

  it('de 768 a 1023 px o trilho abre a lateral por cima com todos os itens, e não há barra de baixo (A20)', async () => {
    const rede = redeFalsa()
    await abrirCasca(rede, 'professor', 'media', ROTAS.turmas)

    expect(document.documentElement.hasAttribute('data-barra-de-baixo')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir a lateral' }))
    const gaveta = screen.getByRole('dialog', { name: 'Menu' })
    expect(within(gaveta).getAllByRole('link', { name: /^(Início|Ferramentas|Turmas|Criados)$/ }).map((link) => link.textContent)).toEqual(['Início', 'Turmas', 'Ferramentas', 'Criados'])
    expect(gaveta.querySelectorAll('nav[aria-label="Seções"]')).toHaveLength(1)
  })

  it('a partir de 1024 px a lateral aberta tem os itens, sem gaveta e sem barra de baixo', async () => {
    const rede = redeFalsa()
    await abrirCasca(rede, 'professor', 'larga', ROTAS.turmas)

    expect(document.querySelector('dialog')).toBeNull()
    expect(document.documentElement.hasAttribute('data-barra-de-baixo')).toBe(false)
    const secoes = screen.getAllByRole('navigation', { name: 'Seções' })
    expect(secoes).toHaveLength(1)
    expect(within(secoes[0] as HTMLElement).getAllByRole('link').map((link) => link.textContent)).toEqual(['Início', 'Turmas', 'Ferramentas', 'Criados'])
  })
})

describe('a barra de topo do celular (RF14, RF15)', () => {
  it('tem o menu, a marca, a escola cortada com reticências e o "Sair", de 44 px', async () => {
    const rede = redeFalsa()
    await abrirCasca(rede, 'professor', 'estreita', ROTAS.turmas)

    const topo = screen.getByRole('banner')
    expect(classesDo(topo).has('h-14')).toBe(true)
    // A borda de 2 px em `borda` da D80, no lugar do fio de 1 px em `linha` que a casca antiga tinha.
    for (const classe of ['border-b-2', 'border-borda']) expect(classesDo(topo).has(classe), `a barra de topo: ${classe}`).toBe(true)
    for (const antiga of ['border-b', 'border-linha']) expect(classesDo(topo).has(antiga), `a barra de topo sem a ${antiga} antiga`).toBe(false)
    expect(within(topo).getByRole('button', { name: 'Abrir o menu' }).getAttribute('aria-expanded')).toBe('false')
    expect(within(topo).getByRole('link', { name: 'Turmma, página inicial' })).toBeTruthy()
    const escola = within(topo).getByText('Colégio Vista Alegre')
    for (const classe of ['truncate', 'min-w-0', 'flex-1']) expect(classesDo(escola).has(classe), `a escola: ${classe}`).toBe(true)
    const sair = within(topo).getByRole('button', { name: 'Sair' })
    expect(classesDo(sair).has('min-h-11'), 'o "Sair" tem a face de 44 px').toBe(true)
    expect(classesDo(sair).has('min-w-11')).toBe(true)
  })
})

describe('o espelho da prova de quem saiu não fica ao alcance de quem entrou (53.0, regra 20)', () => {
  const ATIVIDADE_DE_A = '0197a1c0-0000-7000-8000-0000000000c1'
  const ATIVIDADE_DE_B = '0197a1c0-0000-7000-8000-0000000000c2'
  const guardar = (atividade: string, dono: string) =>
    window.sessionStorage.setItem(`educa.escolhas-pendentes.${atividade}`, JSON.stringify({ dono, atividade, pendentes: [{ questao: 1, alternativa: 2, sequencia: 3 }] }))
  const guardada = (atividade: string) => window.sessionStorage.getItem(`educa.escolhas-pendentes.${atividade}`) !== null

  it('o `/v1/eu` de quem entrou apaga o espelho dos outros donos, sem nenhuma atividade aberta, e deixa o dele', async () => {
    window.sessionStorage.clear()
    guardar(ATIVIDADE_DE_A, PESSOA_A)
    guardar(ATIVIDADE_DE_B, PESSOA_B)
    const rede = redeFalsa()
    await abrirCasca(rede, 'aluno', 'larga', ROTAS.inicio)

    await waitFor(() => expect(guardada(ATIVIDADE_DE_B)).toBe(false))
    expect(guardada(ATIVIDADE_DE_A)).toBe(true)
  })

  it('a pessoa da sessão troca sob a mesma tela: o espelho da anterior sai com o `/v1/eu` novo', async () => {
    window.sessionStorage.clear()
    guardar(ATIVIDADE_DE_A, PESSOA_A)
    const rede = redeFalsa()
    const { cliente } = await abrirCasca(rede, 'aluno', 'larga', ROTAS.inicio)
    expect(guardada(ATIVIDADE_DE_A)).toBe(true)

    rede.responder(respostaEu('aluno', PESSOA_B, 'Beatriz Lima'))
    await cliente.refetchQueries({ queryKey: consultaEu.queryKey })

    await waitFor(() => expect(guardada(ATIVIDADE_DE_A)).toBe(false))
  })
})

describe('a saída que a casca oferece à tela (X4, 2.0; D59)', () => {
  // Cada caso sai de verdade, e a saída esquece a sessão que `prepararTela` abriu uma vez: o seguinte a abre de novo.
  beforeEach(async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ token: 'token-de-teste', expiraEm: new Date(Date.now() + 600_000).toISOString() }), { status: 200 })),
    )
    await abrirSessaoPeloCookie()
    vi.unstubAllGlobals()
  })

  function LinhaDeSaida() {
    const { sair, saindo } = useContext(ContextoDaSaida)
    return (
      <button type="button" onClick={sair}>
        {saindo ? 'Tela saindo' : 'Tela sair'}
      </button>
    )
  }

  it('a tela que consome o contexto sai pelo mesmo caminho do "Sair" da casca: encerra na API e volta para a entrada, trocando a entrada do histórico', async () => {
    const rede = redeFalsa()
    instalarLargura('larga')
    rede.responder(respostaEu('aluno', PESSOA_A, 'Camila Souza'))
    const localizacao = memoryLocation({ path: ROTAS.euDoAluno, record: true })
    render(
      <QueryClientProvider client={criarClienteDeConsultas()}>
        <Router hook={localizacao.hook}>
          <CascaDaEscola>
            <LinhaDeSaida />
          </CascaDaEscola>
        </Router>
      </QueryClientProvider>,
    )
    await screen.findByText('Camila Souza')
    expect(screen.getByRole('button', { name: 'Tela sair' })).toBeTruthy()

    rede.responder({ status: 204 })
    fireEvent.click(screen.getByRole('button', { name: 'Tela sair' }))

    await waitFor(() => expect(localizacao.history?.at(-1)).toBe(ROTAS.entrar))
    expect(rede.chamadas.some((chamada) => chamada.metodo === 'DELETE' && chamada.caminho.startsWith('/v1/sessao'))).toBe(true)
    // `replace`: a entrada ocupa o lugar do Eu, e o "voltar" não devolve a tela de quem saiu.
    expect(localizacao.history).toEqual([ROTAS.entrar])
  })

  it('dois cliques seguidos na saída da tela encerram a sessão uma vez só: o segundo, com a primeira ainda no ar, não pede nada à API', async () => {
    const rede = redeFalsa()
    instalarLargura('larga')
    rede.responder(respostaEu('aluno', PESSOA_A, 'Camila Souza'))
    const localizacao = memoryLocation({ path: ROTAS.euDoAluno, record: true })
    render(
      <QueryClientProvider client={criarClienteDeConsultas()}>
        <Router hook={localizacao.hook}>
          <CascaDaEscola>
            <LinhaDeSaida />
          </CascaDaEscola>
        </Router>
      </QueryClientProvider>,
    )
    await screen.findByText('Camila Souza')

    // O encerramento fica no ar: é a janela em que o segundo clique acontece.
    const encerramento = rede.segurar()
    fireEvent.click(screen.getByRole('button', { name: 'Tela sair' }))
    await screen.findByRole('button', { name: 'Tela saindo' })
    fireEvent.click(screen.getByRole('button', { name: 'Tela saindo' }))
    encerramento.liberar({ status: 204 })

    await waitFor(() => expect(localizacao.history).toEqual([ROTAS.entrar]))
    expect(rede.chamadas.filter((chamada) => chamada.metodo === 'DELETE' && chamada.caminho.startsWith('/v1/sessao'))).toHaveLength(1)
  })
})
