// @vitest-environment jsdom
import type { PapelDeUsuario } from '@educa/shared'
import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { consultaEu } from '../api/eu'
import { criarClienteDeConsultas } from '../api/cliente-de-consultas'
import { ROTAS } from '../caminhos'
import { classesDo } from '../__fixtures__/cor-das-classes'
import { prepararTela, redeFalsa, type RedeFalsa } from '../__fixtures__/tela'
import { CascaDaEscola } from './CascaDaEscola'

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
  return { status: 200, corpo: { usuarioId, papel, nome, escola: ESCOLA, inatividadeMin: 30, introducaoVistaEm: null, acessos: [] } }
}

/** A página vazia de "Esperando você", que só o papel com "Seu time" pede depois do `/v1/eu`. */
const SEM_ENTREGAS = { status: 200, corpo: { itens: [] } }

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
  if (papel === 'professor') rede.responder(SEM_ENTREGAS)
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

describe('onde ficam os itens de navegação em cada largura (RF14)', () => {
  it('abaixo de 768 px, o professor tem os itens na barra de baixo, e a gaveta fica com o resto', async () => {
    const rede = redeFalsa()
    await abrirCasca(rede, 'professor', 'estreita', ROTAS.turmas)

    // A barra é irmã da gaveta, e não filha dela: com o `dialog` modal aberto o navegador a deixa inerte.
    const barra = screen.getByRole('navigation', { name: 'Seções' })
    expect(barra.closest('dialog')).toBeNull()
    expect(within(barra).getAllByRole('link').map((link) => link.textContent)).toEqual(['Início', 'Ferramentas', 'Turmas'])
    expect(document.documentElement.hasAttribute('data-barra-de-baixo')).toBe(true)

    const gaveta = gavetaDaPagina()
    expect(gaveta.querySelector('nav[aria-label="Seções"]')).toBeNull()
    for (const nome of ['Seu time', 'Sua conta']) expect(gaveta.querySelector(`nav[aria-label="${nome}"]`), nome).not.toBeNull()
    expect(gaveta.textContent).toContain('Colégio Vista Alegre')

    // O `<main>` guarda embaixo a altura da barra (o lugar dela é a variável do `<html>`).
    expect(classesDo(screen.getByRole('main')).has('pb-[calc(var(--barra-baixo,0px)+2rem)]')).toBe(true)
  })

  it('abaixo de 768 px, o aluno tem os três itens na barra, e o Privacidade continua no rodapé da gaveta', async () => {
    const rede = redeFalsa()
    await abrirCasca(rede, 'aluno', 'estreita', ROTAS.tutor)

    const barra = screen.getByRole('navigation', { name: 'Seções' })
    expect(within(barra).getAllByRole('link').map((link) => link.textContent)).toEqual(['Tutor', 'Atividades', 'Minha turma'])
    const gaveta = gavetaDaPagina()
    expect(gaveta.querySelector('nav[aria-label="Seções"]')).toBeNull()
    expect(within(gaveta).getByRole('navigation', { name: 'Rodapé', hidden: true })).toBeTruthy()
  })

  it('abaixo de 768 px, a coordenação, com sete itens, mantém a navegação na gaveta e não tem barra de baixo', async () => {
    const rede = redeFalsa()
    await abrirCasca(rede, 'coordenador', 'estreita', ROTAS.estrutura)

    expect(screen.queryByRole('navigation', { name: 'Seções' })).toBeNull()
    expect(document.documentElement.hasAttribute('data-barra-de-baixo')).toBe(false)
    const itens = gavetaDaPagina().querySelectorAll('nav[aria-label="Seções"] a')
    expect(Array.from(itens).map((item) => item.textContent)).toEqual(['Governança', 'Agentes', 'Analista', 'Estrutura', 'Professores', 'Material', 'Privacidade'])
    expect(classesDo(screen.getByRole('main')).has('pb-[calc(var(--barra-baixo,0px)+2rem)]')).toBe(true)
  })

  it('de 768 a 1023 px o trilho abre a lateral por cima com todos os itens, e não há barra de baixo (A20)', async () => {
    const rede = redeFalsa()
    await abrirCasca(rede, 'professor', 'media', ROTAS.turmas)

    expect(document.documentElement.hasAttribute('data-barra-de-baixo')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir a lateral' }))
    const gaveta = screen.getByRole('dialog', { name: 'Menu' })
    expect(within(gaveta).getAllByRole('link', { name: /^(Início|Ferramentas|Turmas)$/ }).map((link) => link.textContent)).toEqual(['Início', 'Ferramentas', 'Turmas'])
    expect(gaveta.querySelectorAll('nav[aria-label="Seções"]')).toHaveLength(1)
  })

  it('a partir de 1024 px a lateral aberta tem os itens, sem gaveta e sem barra de baixo', async () => {
    const rede = redeFalsa()
    await abrirCasca(rede, 'professor', 'larga', ROTAS.turmas)

    expect(document.querySelector('dialog')).toBeNull()
    expect(document.documentElement.hasAttribute('data-barra-de-baixo')).toBe(false)
    const secoes = screen.getAllByRole('navigation', { name: 'Seções' })
    expect(secoes).toHaveLength(1)
    expect(within(secoes[0] as HTMLElement).getAllByRole('link').map((link) => link.textContent)).toEqual(['Início', 'Ferramentas', 'Turmas'])
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
