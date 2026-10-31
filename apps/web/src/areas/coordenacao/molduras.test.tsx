// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { lazy, useEffect, type ReactElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { criarClienteDeConsultas } from '../../api/query-client'
import Escola, { ABAS_DE_ESCOLA, type AbaDeEscola } from './Escola'
import { useFocarOTituloDaMoldura } from './comum/moldura'
import Privacidade from './privacidade/Privacidade'
import Registros, { ABAS_DE_REGISTROS, type AbaDeRegistros } from './Registros'

/**
 * As molduras `Escola` e `Registros` (telas da coordenação, 3.0; RF10 e RF17): o título do lugar, as abas e, dentro, a tela. O que se
 * prova é o que a moldura faz: a aba do endereço é a selecionada, trocar navega para o endereço de hoje da outra, o `h1` é um só e
 * a aba do navegador diz de onde a tela é. As telas de dentro são provadas nos testes delas; aqui são um parágrafo.
 */

afterEach(cleanup)

const ENDERECO_DA_ABA = (abas: readonly { id: string; caminho: string }[], id: string) => abas.find((aba) => aba.id === id)?.caminho

function noEndereco(endereco: string, tela: ReactElement): { tela: ReactElement; local: ReturnType<typeof memoryLocation> } {
  const local = memoryLocation({ path: endereco, record: true })
  return {
    local,
    tela: (
      <QueryClientProvider client={criarClienteDeConsultas()}>
        <Router hook={local.hook}>{tela}</Router>
      </QueryClientProvider>
    ),
  }
}

function dentro(texto: string): ReactNode {
  return <p>{texto}</p>
}

describe('Escola', () => {
  it('as três abas, na ordem, cada uma no endereço de hoje da tela dela', () => {
    expect(ABAS_DE_ESCOLA.map(({ id, rotulo, caminho }) => ({ id, rotulo, caminho }))).toEqual([
      { id: 'turmas', rotulo: 'Turmas', caminho: '/estrutura' },
      { id: 'professores', rotulo: 'Professores', caminho: '/professores' },
      { id: 'material', rotulo: 'Material', caminho: '/material' },
    ])
  })

  it.each([
    ['turmas', 'Turmas', 'Escola: turmas'],
    ['professores', 'Professores', 'Escola: professores'],
    ['material', 'Material', 'Escola: material'],
  ] as const satisfies readonly (readonly [AbaDeEscola, string, string])[])('a aba do endereço (%s) é a única selecionada, o `h1` é "Escola" e a aba do navegador diz "%s"', (aba, rotulo, titulo) => {
    const { tela } = noEndereco('/', (
      <Escola aba={aba}>{dentro('a tela de dentro')}</Escola>
    ))
    render(tela)

    const abas = screen.getAllByRole('tab')
    expect(abas.map((candidata) => candidata.textContent)).toEqual(['Turmas', 'Professores', 'Material'])
    expect(abas.filter((candidata) => candidata.getAttribute('aria-selected') === 'true').map((candidata) => candidata.textContent)).toEqual([rotulo])
    expect(screen.getAllByRole('heading', { level: 1 }).map((h1) => h1.textContent)).toEqual(['Escola'])
    expect(document.title).toBe(`${titulo} · Turmma`)
    // A tela de dentro está no painel da aba, e o painel é a região que rola: com nome e na ordem do Tab.
    const painel = screen.getByRole('tabpanel', { name: rotulo })
    expect(within(painel).getByText('a tela de dentro')).toBeTruthy()
    expect(painel.getAttribute('tabindex')).toBe('0')
  })

  it('trocar de aba navega para o endereço de hoje da outra, sem empilhar nada além disso', async () => {
    const { tela, local } = noEndereco('/estrutura', (
      <Escola aba="turmas">{dentro('turmas')}</Escola>
    ))
    render(tela)
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('tab', { name: 'Professores' }))
    expect(local.history?.at(-1)).toBe(ENDERECO_DA_ABA(ABAS_DE_ESCOLA, 'professores'))
    await usuario.click(screen.getByRole('tab', { name: 'Material' }))
    expect(local.history?.at(-1)).toBe(ENDERECO_DA_ABA(ABAS_DE_ESCOLA, 'material'))
  })

  it('só o miolo rola a partir de 768 px: o painel da aba tem a altura da janela menos o que a moldura gasta, e a página abaixo disso rola', () => {
    const { tela } = noEndereco('/', (
      <Escola aba="turmas">{dentro('x')}</Escola>
    ))
    render(tela)
    const classes = screen.getByRole('tabpanel').className.split(' ')
    expect(classes).toContain('md:overflow-y-auto')
    // O que é posicionado dentro do miolo (os `sr-only`) fica preso nele, e não aumenta a página por fora.
    expect(classes).toContain('md:relative')
    expect(classes.some((classe) => /^md:max-h-\[calc\(100dvh-/.test(classe))).toBe(true)
    // Nenhuma classe sem o prefixo `md:` prende a altura: abaixo de 768 px quem rola é a página.
    expect(classes.filter((classe) => /^(?:max-h|h|overflow-y)-/.test(classe))).toEqual([])
  })

  it('trocar de aba desmonta a tela de antes na hora, em vez de escondê-la enquanto a da outra aba carrega', () => {
    // A tela que sai tem de sair de verdade: escondida, ela continuaria montada e com as leituras dela vivas (a lista de pedidos
    // sai da memória no instante em que ninguém a observa, `gcTime: 0`). Sem a `key` da `Suspense` por aba, o React só a esconde.
    const desmontou = vi.fn()
    function TelaDeAntes() {
      useEffect(() => desmontou, [])
      return <p>a tela de antes</p>
    }
    const Carregando = lazy(() => new Promise<{ default: () => ReactElement }>(() => undefined))
    const local = memoryLocation({ path: '/', record: true })
    const cliente = criarClienteDeConsultas()
    const montar = (aba: AbaDeEscola, filho: ReactNode) => (
      <QueryClientProvider client={cliente}>
        <Router hook={local.hook}>
          <Escola aba={aba}>{filho}</Escola>
        </Router>
      </QueryClientProvider>
    )
    const { rerender } = render(montar('turmas', <TelaDeAntes />))
    expect(screen.getByText('a tela de antes')).toBeTruthy()
    expect(desmontou).not.toHaveBeenCalled()

    rerender(montar('professores', <Carregando />))
    expect(screen.getByText('Carregando…')).toBeTruthy()
    expect(desmontou).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('a tela de antes')).toBeNull()
  })

  it('a tela de dentro leva o foco ao título da moldura, que tem `tabindex` -1', async () => {
    function ComFoco() {
      const focar = useFocarOTituloDaMoldura()
      return (
        <button type="button" onClick={focar}>
          Focar o título
        </button>
      )
    }
    const { tela } = noEndereco('/', (
      <Escola aba="professores">
        <ComFoco />
      </Escola>
    ))
    render(tela)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Focar o título' }))
    const h1 = screen.getByRole('heading', { level: 1, name: 'Escola' })
    expect(h1.getAttribute('tabindex')).toBe('-1')
    expect(document.activeElement).toBe(h1)
  })
})

describe('Registros', () => {
  it('as três abas, na ordem: a IA é a Governança, os pedidos abrem em /privacidade/pedidos, e a Privacidade, nos prazos de guarda', () => {
    expect(ABAS_DE_REGISTROS.map(({ id, rotulo, caminho }) => ({ id, rotulo, caminho }))).toEqual([
      { id: 'ia', rotulo: 'IA', caminho: '/governanca' },
      { id: 'pedidos', rotulo: 'Pedidos', caminho: '/privacidade/pedidos' },
      { id: 'privacidade', rotulo: 'Privacidade', caminho: '/privacidade/retencao' },
    ])
  })

  it.each([
    ['ia', 'IA', 'Registros: IA'],
    ['pedidos', 'Pedidos', 'Registros: pedidos'],
    ['privacidade', 'Privacidade', 'Registros: privacidade'],
  ] as const satisfies readonly (readonly [AbaDeRegistros, string, string])[])('a aba do endereço (%s) é a única selecionada, o `h1` é "Registros" e a aba do navegador diz "%s"', (aba, rotulo, titulo) => {
    const { tela } = noEndereco('/', (
      <Registros aba={aba}>{dentro('a tela de dentro')}</Registros>
    ))
    render(tela)

    const abas = screen.getAllByRole('tab')
    expect(abas.map((candidata) => candidata.textContent)).toEqual(['IA', 'Pedidos', 'Privacidade'])
    expect(abas.filter((candidata) => candidata.getAttribute('aria-selected') === 'true').map((candidata) => candidata.textContent)).toEqual([rotulo])
    expect(screen.getAllByRole('heading', { level: 1 }).map((h1) => h1.textContent)).toEqual(['Registros'])
    expect(document.title).toBe(`${titulo} · Turmma`)
  })

  it('trocar de aba navega para o endereço de hoje da outra', async () => {
    const { tela, local } = noEndereco('/governanca', (
      <Registros aba="ia">{dentro('ia')}</Registros>
    ))
    render(tela)
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('tab', { name: 'Pedidos' }))
    expect(local.history?.at(-1)).toBe('/privacidade/pedidos')
    await usuario.click(screen.getByRole('tab', { name: 'Privacidade' }))
    expect(local.history?.at(-1)).toBe('/privacidade/retencao')
  })
})

describe('Privacidade, dentro de Registros', () => {
  it.each([
    ['retencao', 'Prazos de guarda'],
    ['suboperadores', 'Empresas'],
    ['incidentes', 'Incidentes'],
  ] as const)('/privacidade/%s marca "%s" no seletor, e o seletor não é aba nem título', (aba, marcada) => {
    const { tela } = noEndereco('/', (
      <Registros aba="privacidade">
        <Privacidade aba={aba} />
      </Registros>
    ))
    render(tela)

    const seletor = screen.getByRole('radiogroup', { name: 'O que ver em Privacidade' })
    const opcoes = within(seletor).getAllByRole('radio')
    expect(opcoes.map((opcao) => opcao.textContent)).toEqual(['Prazos de guarda', 'Empresas', 'Incidentes'])
    expect(opcoes.filter((opcao) => opcao.getAttribute('aria-checked') === 'true').map((opcao) => opcao.textContent)).toEqual([marcada])
    // Nunca aba dentro de aba (RF17): as três abas são as de Registros, e a Privacidade acrescenta nenhuma.
    expect(screen.getAllByRole('tab')).toHaveLength(3)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('escolher no seletor navega para o endereço de hoje da tela, e uma tela que não existe abre os pedidos pela troca', async () => {
    const { tela, local } = noEndereco('/privacidade/retencao', (
      <Registros aba="privacidade">
        <Privacidade aba="retencao" />
      </Registros>
    ))
    render(tela)
    const usuario = userEvent.setup()

    await usuario.click(screen.getByRole('radio', { name: 'Incidentes' }))
    expect(local.history?.at(-1)).toBe('/privacidade/incidentes')
    await usuario.click(screen.getByRole('radio', { name: 'Empresas' }))
    expect(local.history?.at(-1)).toBe('/privacidade/suboperadores')

    cleanup()
    const desconhecida = noEndereco('/privacidade/nao-existe', <Privacidade aba="nao-existe" />)
    render(desconhecida.tela)
    expect(desconhecida.local.history?.at(-1)).toBe('/privacidade/pedidos')
  })
})
