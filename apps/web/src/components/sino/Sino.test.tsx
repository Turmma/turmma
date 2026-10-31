// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { Sino, type ItemDoSino } from './Sino'

/**
 * O sino, a peça (telas da coordenação, 1.0; RF4 e RF5): o botão e o que a lista diz em cada estado. A lista chega por prop,
 * e a peça não lê nada. O `jsdom` não implementa o `dialog` modal: o teste instala o `showModal` e o `close`.
 */
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})
afterEach(cleanup)

const INCIDENTE: ItemDoSino = { id: 'a', titulo: 'Incidente de segurança sem confirmação', detalhe: 'Avisado em 01/10/2026.', urgente: true, para: '/privacidade/incidentes' }
const CONVITE: ItemDoSino = { id: 'b', titulo: 'Refazer o convite de Paulo Sintético', detalhe: 'O convite venceu.', urgente: false, para: '/professores?professor=u1' }
const TURMAS: ItemDoSino = { id: 'c', titulo: 'Turmas sem professor', detalhe: 'Aloque.', urgente: false, para: '/estrutura?situacao=sem-professor', contador: { n: 3, oQueConta: 'turmas sem professor' } }

type PropsDoSino = Parameters<typeof Sino>[0]

function desenhar(sobre: Partial<PropsDoSino> & { readonly semFaltaPara?: boolean } = {}, caminho = '/painel') {
  const { semFaltaPara = false, ...resto } = sobre
  const funcoes = { aoTentarDeNovo: vi.fn(), aoAtualizar: vi.fn() }
  const localizacao = memoryLocation({ path: caminho, record: true })
  const props: PropsDoSino = { itens: [], situacao: 'pronta', ...(semFaltaPara ? {} : { faltaPara: '/estrutura?painel=falta' }), ...funcoes, ...resto }
  render(
    <Router hook={localizacao.hook}>
      <Sino {...props} />
    </Router>,
  )
  return { ...funcoes, localizacao }
}

describe('o botão do sino', () => {
  it('diz quantos esperam, ou "nada", no nome acessível', () => {
    desenhar({ itens: [INCIDENTE, CONVITE] })
    expect(screen.getByRole('button', { name: 'Esperando você, 2' })).toBeTruthy()
    cleanup()
    desenhar({ itens: [] })
    expect(screen.getByRole('button', { name: 'Esperando você, nada' })).toBeTruthy()
  })

  it('o nome do botão diz "ou mais" quando a lista lida é um piso; sem item, não há número a completar', () => {
    const cem = Array.from({ length: 100 }, (_, i): ItemDoSino => ({ ...CONVITE, id: `c${String(i)}` }))
    desenhar({ itens: cem, situacao: 'parcial', ouMais: true })
    expect(screen.getByRole('button', { name: 'Esperando você, 100 ou mais' })).toBeTruthy()
    expect(document.querySelector('[data-contador]')?.textContent).toBe('100+ ou mais esperando você')
    cleanup()
    // O controle: os mesmos 100, sem a marca, são 100.
    desenhar({ itens: cem, situacao: 'pronta' })
    expect(screen.getByRole('button', { name: 'Esperando você, 100' })).toBeTruthy()
    cleanup()
    desenhar({ itens: [], situacao: 'parcial', ouMais: true })
    expect(screen.getByRole('button', { name: 'Esperando você, parte não carregou' })).toBeTruthy()
  })

  it('"nada" só vale para a lista lida inteira: carregando, parcial e erro têm o nome do que falta', () => {
    for (const [situacao, nome] of [
      ['carregando', 'Esperando você, carregando'],
      ['parcial', 'Esperando você, parte não carregou'],
      ['erro', 'Esperando você, não carregou'],
    ] as const) {
      desenhar({ situacao })
      expect(screen.getByRole('button', { name: nome })).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Esperando você, nada' })).toBeNull()
      cleanup()
    }
  })

  it('o número é um contador parado, sem nada animado, e some com a lista vazia', () => {
    desenhar({ itens: [INCIDENTE] })
    const contador = document.querySelector('[data-contador]')
    expect(contador?.textContent).toContain('1')
    expect(contador?.className ?? '').not.toMatch(/animate|pulse|ping|bounce|transition/)
    cleanup()
    desenhar({ itens: [] })
    expect(document.querySelector('[data-contador]')).toBeNull()
  })

  it('abrir a lista não pede nada: nenhum "Tentar de novo" nem "Atualizar" é chamado', async () => {
    const usuario = userEvent.setup()
    const { aoTentarDeNovo, aoAtualizar } = desenhar({ itens: [INCIDENTE] })
    await usuario.click(screen.getByRole('button', { name: 'Esperando você, 1' }))
    expect(screen.getByRole('dialog', { name: 'Esperando você' })).toBeTruthy()
    expect(aoTentarDeNovo).not.toHaveBeenCalled()
    expect(aoAtualizar).not.toHaveBeenCalled()
  })
})

describe('a lista "Esperando você"', () => {
  it('traz os grupos "Urgente" e "Da escola", cada item um link para a tela que resolve, e o contador só no que o tem', async () => {
    const usuario = userEvent.setup()
    desenhar({ itens: [INCIDENTE, CONVITE, TURMAS] })
    await usuario.click(screen.getByRole('button', { name: /^Esperando você, 3/ }))
    const painel = screen.getByRole('dialog', { name: 'Esperando você' })

    const urgente = within(within(painel).getByRole('region', { name: 'Urgente' }))
    const daEscola = within(within(painel).getByRole('region', { name: 'Da escola' }))
    expect(urgente.getAllByRole('link')).toHaveLength(1)
    expect(urgente.getByRole('link', { name: /Incidente de segurança/ }).getAttribute('href')).toBe('/privacidade/incidentes')
    expect(daEscola.getAllByRole('link')).toHaveLength(2)
    expect(daEscola.getByRole('link', { name: /Refazer o convite de Paulo/ }).getAttribute('href')).toBe('/professores?professor=u1')
    expect(daEscola.getByRole('link', { name: /Turmas sem professor/ }).textContent).toContain('3')
    expect(within(painel).queryByText('Tudo em dia')).toBeNull()
  })

  it('só aparece o grupo que tem item', async () => {
    const usuario = userEvent.setup()
    desenhar({ itens: [CONVITE] })
    await usuario.click(screen.getByRole('button', { name: 'Esperando você, 1' }))
    expect(screen.queryByRole('region', { name: 'Urgente' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Da escola' })).toBeTruthy()
  })

  it('ir a um item fecha a lista, e a tela de destino fica sem nada por cima', async () => {
    const usuario = userEvent.setup()
    const { localizacao } = desenhar({ itens: [CONVITE] })
    await usuario.click(screen.getByRole('button', { name: 'Esperando você, 1' }))
    await usuario.click(screen.getByRole('link', { name: /Refazer o convite/ }))
    expect(screen.queryByRole('dialog', { name: 'Esperando você' })).toBeNull()
    expect(localizacao.history?.at(-1)).toBe('/professores?professor=u1')
  })

  it('o item que muda só a consulta do endereço, na mesma tela, também fecha a lista', async () => {
    const usuario = userEvent.setup()
    desenhar({ itens: [CONVITE] }, '/professores')
    await usuario.click(screen.getByRole('button', { name: 'Esperando você, 1' }))
    expect(screen.getByRole('dialog', { name: 'Esperando você' })).toBeTruthy()
    await usuario.click(screen.getByRole('link', { name: /Refazer o convite/ }))
    expect(screen.queryByRole('dialog', { name: 'Esperando você' })).toBeNull()
  })

  it('o vazio é "Tudo em dia" com ícone ilustrado, sem mascote, e o link do que falta para a escola', async () => {
    const usuario = userEvent.setup()
    desenhar({ itens: [], situacao: 'pronta' })
    await usuario.click(screen.getByRole('button', { name: 'Esperando você, nada' }))
    const painel = screen.getByRole('dialog', { name: 'Esperando você' })
    expect(within(painel).getByText('Tudo em dia')).toBeTruthy()
    expect(painel.querySelector('svg[data-icone]')).not.toBeNull()
    // Sem a onça (a de corpo inteiro é decisão do Joaquim): nenhuma imagem, nenhum desenho de mascote.
    expect(painel.querySelector('img, [data-onca], [data-mascote]')).toBeNull()
    expect(within(painel).getByRole('link', { name: 'Ver o que falta para a escola' }).getAttribute('href')).toBe('/estrutura?painel=falta')
  })

  it('a lista parcial mostra o que veio, diz que parte não carregou e nunca diz "Tudo em dia", nem sem item', async () => {
    const usuario = userEvent.setup()
    const { aoTentarDeNovo } = desenhar({ itens: [], situacao: 'parcial' })
    await usuario.click(screen.getByRole('button', { name: 'Esperando você, parte não carregou' }))
    const painel = screen.getByRole('dialog', { name: 'Esperando você' })
    expect(within(painel).getByText('Parte da lista não carregou')).toBeTruthy()
    expect(within(painel).queryByText('Tudo em dia')).toBeNull()
    await usuario.click(within(painel).getByRole('button', { name: 'Tentar de novo' }))
    expect(aoTentarDeNovo).toHaveBeenCalledTimes(1)
  })

  it('com itens e parte sem ler: os itens e o aviso, juntos', async () => {
    const usuario = userEvent.setup()
    desenhar({ itens: [CONVITE], situacao: 'parcial' })
    await usuario.click(screen.getByRole('button', { name: 'Esperando você, 1' }))
    const painel = screen.getByRole('dialog', { name: 'Esperando você' })
    expect(within(painel).getByText('Parte da lista não carregou')).toBeTruthy()
    expect(within(painel).getByRole('link', { name: /Refazer o convite/ })).toBeTruthy()
  })

  it('lendo: o texto parado de carregando, sem "Tudo em dia"', async () => {
    const usuario = userEvent.setup()
    desenhar({ itens: [], situacao: 'carregando' })
    await usuario.click(screen.getByRole('button', { name: 'Esperando você, carregando' }))
    const painel = screen.getByRole('dialog', { name: 'Esperando você' })
    expect(within(painel).getByText('Carregando o que espera você…')).toBeTruthy()
    expect(within(painel).queryByText('Tudo em dia')).toBeNull()
  })

  it('o erro tem "Tentar de novo", e o "Atualizar" e o "Atualizado às" vêm de quem usa a peça', async () => {
    const usuario = userEvent.setup()
    const { aoTentarDeNovo, aoAtualizar } = desenhar({ itens: [], situacao: 'erro', erro: new Error('caiu'), atualizadoEm: new Date(2026, 9, 16, 14, 32) })
    await usuario.click(screen.getByRole('button', { name: 'Esperando você, não carregou' }))
    const painel = screen.getByRole('dialog', { name: 'Esperando você' })
    expect(within(painel).queryByText('Tudo em dia')).toBeNull()
    await usuario.click(within(painel).getByRole('button', { name: 'Tentar de novo' }))
    expect(aoTentarDeNovo).toHaveBeenCalledTimes(1)
    expect(within(painel).getByText('Atualizado às 14:32')).toBeTruthy()
    await usuario.click(within(painel).getByRole('button', { name: 'Atualizar' }))
    expect(aoAtualizar).toHaveBeenCalledTimes(1)
  })
})

describe('o sino do professor, pelas props opcionais (telas do professor, 1.0)', () => {
  const NA_TURMA_A: ItemDoSino = { id: 'p', titulo: 'Correção para revisar', detalhe: 'Atividade de estequiometria', urgente: false, para: '/aprovar/1', grupo: '1º A' }
  const NA_TURMA_B: ItemDoSino = { id: 'q', titulo: 'Confirme sua turma', detalhe: 'Química', urgente: false, para: '/turmas', grupo: '2º B' }
  const NA_TURMA_A_DE_NOVO: ItemDoSino = { id: 'r', titulo: 'Pedidos de nome para decidir', detalhe: '2 pedidos esperando a decisão', urgente: false, para: '/turmas/1', grupo: '1º A' }

  it('o item com `grupo` aparece no grupo dele, na ordem em que o grupo apareceu, e não em "Da escola"', async () => {
    const usuario = userEvent.setup()
    desenhar({ itens: [NA_TURMA_A, NA_TURMA_B, NA_TURMA_A_DE_NOVO], semFaltaPara: true })
    await usuario.click(screen.getByRole('button', { name: 'Esperando você, 3' }))
    const painel = screen.getByRole('dialog', { name: 'Esperando você' })
    expect(within(painel).queryByRole('region', { name: 'Da escola' })).toBeNull()
    const turmaA = within(within(painel).getByRole('region', { name: '1º A' }))
    expect(turmaA.getAllByRole('link').map((link) => link.textContent)).toEqual([expect.stringContaining('Correção para revisar'), expect.stringContaining('Pedidos de nome para decidir')])
    expect(within(within(painel).getByRole('region', { name: '2º B' })).getAllByRole('link')).toHaveLength(1)
    const titulos = within(painel)
      .getAllByRole('heading', { level: 3 })
      .map((titulo) => titulo.textContent)
    expect(titulos).toEqual(['1º A', '2º B'])
  })

  it('o item sem `grupo` continua em "Da escola"', async () => {
    const usuario = userEvent.setup()
    desenhar({ itens: [NA_TURMA_A, CONVITE] })
    await usuario.click(screen.getByRole('button', { name: 'Esperando você, 2' }))
    expect(within(within(screen.getByRole('dialog', { name: 'Esperando você' })).getByRole('region', { name: 'Da escola' })).getByRole('link', { name: /Refazer o convite/ })).toBeTruthy()
  })

  it('o vazio da professora tem o texto dela e nenhum link "Ver o que falta para a escola"', async () => {
    const usuario = userEvent.setup()
    desenhar({ itens: [], situacao: 'pronta', semFaltaPara: true, textoDoVazio: 'Nada espera a sua decisão agora.' })
    await usuario.click(screen.getByRole('button', { name: 'Esperando você, nada' }))
    const painel = screen.getByRole('dialog', { name: 'Esperando você' })
    expect(within(painel).getByText('Tudo em dia')).toBeTruthy()
    expect(within(painel).getByText('Nada espera a sua decisão agora.')).toBeTruthy()
    expect(within(painel).queryByText('Nada espera a coordenação agora.')).toBeNull()
    expect(within(painel).queryByText('Ver o que falta para a escola')).toBeNull()
  })

  it('o aviso da leitura parcial pode dizer o que não foi lido; sem ele, a frase de sempre', async () => {
    const usuario = userEvent.setup()
    desenhar({ itens: [NA_TURMA_A], situacao: 'parcial', avisoDaLeituraParcial: 'Parte da lista não carregou. Não foi possível ler os pedidos de nome de 2 turmas.' })
    await usuario.click(screen.getByRole('button', { name: 'Esperando você, 1' }))
    const painel = screen.getByRole('dialog', { name: 'Esperando você' })
    expect(within(painel).getByText('Parte da lista não carregou. Não foi possível ler os pedidos de nome de 2 turmas.')).toBeTruthy()
    expect(within(painel).queryByText('Tudo em dia')).toBeNull()
  })
})

describe('o pé do sino (telas do professor, 2.0)', () => {
  const PE = {
    titulo: 'Acompanhar a IA',
    links: [
      { rotulo: 'O que o Assistente fez', para: '/time/assistente' },
      { rotulo: 'O que o Tutor viu', para: '/time/tutor' },
    ],
  } as const

  async function abrir(sobre: Partial<PropsDoSino>, nome: string) {
    const usuario = userEvent.setup()
    const resultado = desenhar({ semFaltaPara: true, ...sobre })
    await usuario.click(screen.getByRole('button', { name: nome }))
    return { ...resultado, painel: screen.getByRole('dialog', { name: 'Esperando você' }), usuario }
  }

  it('os dois links ficam no fim da lista, com o endereço de cada um, e não contam no número do sino', async () => {
    const { painel } = await abrir({ itens: [CONVITE], pe: PE }, 'Esperando você, 1')
    const pe = within(painel).getByRole('region', { name: 'Acompanhar a IA' })
    const links = within(pe).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual([expect.stringContaining('O que o Assistente fez'), expect.stringContaining('O que o Tutor viu')])
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/time/assistente', '/time/tutor'])
    // O pé vem depois dos itens da lista, e o contador do botão continua sendo o dos itens.
    expect(painel.querySelector('[data-pe-do-sino]')?.compareDocumentPosition(within(painel).getByRole('link', { name: /Refazer o convite/ }))).toBe(Node.DOCUMENT_POSITION_PRECEDING)
    expect(document.querySelector('[data-contador]')?.textContent).toContain('1')
  })

  it('aparece em toda situação da leitura: em dia, carregando, parcial e com erro', async () => {
    for (const [sobre, nome] of [
      [{ itens: [], situacao: 'pronta' }, 'Esperando você, nada'],
      [{ itens: [], situacao: 'carregando' }, 'Esperando você, carregando'],
      [{ itens: [], situacao: 'parcial' }, 'Esperando você, parte não carregou'],
      [{ itens: [], situacao: 'erro' }, 'Esperando você, não carregou'],
    ] as const) {
      const { painel } = await abrir({ ...sobre, pe: PE }, nome)
      expect(within(painel).getAllByRole('link').map((link) => link.getAttribute('href')), sobre.situacao).toEqual(['/time/assistente', '/time/tutor'])
      cleanup()
    }
  })

  it('ir a um dos links fecha a lista, como qualquer item', async () => {
    const { painel, usuario } = await abrir({ itens: [], pe: PE }, 'Esperando você, nada')
    await usuario.click(within(painel).getByRole('link', { name: 'O que o Tutor viu' }))
    expect(screen.queryByRole('dialog', { name: 'Esperando você' })).toBeNull()
  })

  it('sem o pé, ou com o pé sem link, a lista não tem região de pé (o sino da coordenação é o de sempre)', async () => {
    const { painel } = await abrir({ itens: [INCIDENTE] }, 'Esperando você, 1')
    expect(painel.querySelector('[data-pe-do-sino]')).toBeNull()
    cleanup()
    const vazio = await abrir({ itens: [INCIDENTE], pe: { titulo: 'Acompanhar a IA', links: [] } }, 'Esperando você, 1')
    expect(vazio.painel.querySelector('[data-pe-do-sino]')).toBeNull()
  })
})
