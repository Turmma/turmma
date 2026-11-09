// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeNetwork, renderScreen, setupScreen } from '../../__fixtures__/render-screen'
import { createQueryClient } from '../../api/query-client'
import { ContaDaEscola } from './ContaDaEscola'

/**
 * "Conta da escola" em "Eu" (acesso-e-convites, 15.0; `cenarios.md`, "Telas"): só aparece com um provedor liberado pela escola, e mostra o resultado que a volta do provedor traz na barra
 * (`?ligacao=`), tirando-o dela. A navegação ao provedor (o botão ocupado, o `iniciar` com `intencao=ligar`) é do e2e: o `jsdom` não navega.
 */
setupScreen()

const EU = {
  status: 200,
  corpo: {
    usuarioId: '0192a4c0-5b1e-7c3d-8e4f-a0b1c2d3e4f7',
    papel: 'aluno',
    nome: 'Aluno sintético',
    escola: { id: '0192a4c0-5b1e-7c3d-8e4f-a0b1c2d3e4f8', nome: 'Escola sintética', slug: 'escola-sintetica' },
    inatividadeMin: 30,
    introducaoVistaEm: null,
    acessos: [],
  },
} as const
const ACESSO = '/v1/escolas/escola-sintetica/acesso'
const COM_GOOGLE = { status: 200, corpo: { nome: 'Escola sintética', provedores: ['google'] } } as const
const COM_OS_DOIS = { status: 200, corpo: { nome: 'Escola sintética', provedores: ['google', 'microsoft'] } } as const
const SEM_PROVEDOR = { status: 200, corpo: { nome: 'Escola sintética', provedores: [] } } as const
const REQUISICAO = '0190f5a0-0000-7000-8000-000000000001'
const FALHA_DE_REDE = { status: 503, corpo: { erro: { codigo: 'SERVICO_INDISPONIVEL', mensagem: 'x', requisicaoId: REQUISICAO } } } as const

const TITULO = 'Conta da escola'
const BOTAO = 'Ligar a conta da escola'

/** O navegador voltou do provedor em `/aluno/eu`, com o resultado na barra. */
function voltarDoProvedor(resultado?: string): void {
  window.history.replaceState(null, '', resultado === undefined ? '/aluno/eu' : `/aluno/eu?ligacao=${resultado}`)
}

afterEach(() => voltarDoProvedor())

describe('Conta da escola em "Eu"', () => {
  it('sem provedor liberado pela escola: nada na tela', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/eu', EU)
    rede.responderPor(ACESSO, SEM_PROVEDOR)
    renderScreen(<ContaDaEscola />)

    await new Promise((pronto) => setTimeout(pronto, 50))
    expect(rede.chamadas.map((chamada) => chamada.caminho)).toContain(ACESSO)
    expect(screen.queryByText(TITULO)).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('carregando: nada até saber a escola e os provedores, e sem consultar os provedores antes do endereço da escola', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/eu', () => new Promise<never>(() => undefined))
    renderScreen(<ContaDaEscola />)

    await new Promise((pronto) => setTimeout(pronto, 50))
    expect(screen.queryByText(TITULO)).toBeNull()
    expect(rede.chamadas.map((chamada) => chamada.caminho)).toEqual(['/v1/eu'])
  })

  it('com um provedor: o título, o botão "Ligar a conta da escola" e nenhum aviso', async () => {
    const historico = vi.spyOn(window.history, 'replaceState')
    const rede = fakeNetwork()
    rede.responderPor('/v1/eu', EU)
    rede.responderPor(ACESSO, COM_GOOGLE)
    renderScreen(<ContaDaEscola />)

    expect(await screen.findByRole('button', { name: BOTAO })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: TITULO })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText('Conta da escola ligada')).toBeNull()
    // Sem resultado na barra, a tela não mexe no histórico do computador.
    expect(historico).not.toHaveBeenCalled()
  })

  it('com os dois provedores: um botão para cada, com o nome do provedor', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/eu', EU)
    rede.responderPor(ACESSO, COM_OS_DOIS)
    renderScreen(<ContaDaEscola />)

    expect(await screen.findByRole('button', { name: 'Ligar a conta Google da escola' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ligar a conta Microsoft da escola' })).toBeTruthy()
  })

  it('a leitura dos provedores que falha: o erro com "Tentar de novo", e nenhum botão de ligar', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/eu', EU)
    rede.responderPor(ACESSO, FALHA_DE_REDE)
    renderScreen(<ContaDaEscola />)

    expect(await screen.findByRole('button', { name: 'Tentar de novo' }, { timeout: 8_000 })).toBeTruthy()
    expect(screen.queryByRole('button', { name: BOTAO })).toBeNull()
  }, 15_000)

  it('`ligada`: "Conta da escola ligada" num status, sem o botão, e o parâmetro sai da barra', async () => {
    voltarDoProvedor('ligada')
    const rede = fakeNetwork()
    rede.responderPor('/v1/eu', EU)
    rede.responderPor(ACESSO, COM_GOOGLE)
    renderScreen(<ContaDaEscola />)

    const status = await screen.findByText('Conta da escola ligada')
    expect(status.getAttribute('role')).toBe('status')
    // O sucesso não se veste de erro.
    expect(status.className).not.toContain('text-erro')
    expect(screen.queryByRole('button', { name: BOTAO })).toBeNull()
    expect(window.location.search).toBe('')
    expect(window.location.pathname).toBe('/aluno/eu')
  })

  it.each([
    ['conflito', 'Esta conta já está ligada a outro aluno. Fale com o professor'],
    ['recusada', 'Esta conta não é da escola. Escolha a conta da escola e tente de novo'],
  ] as const)('`%s`: o aviso num alerta que diz o próximo passo, e o botão segue para tentar outra conta', async (resultado, texto) => {
    voltarDoProvedor(resultado)
    const rede = fakeNetwork()
    rede.responderPor('/v1/eu', EU)
    rede.responderPor(ACESSO, COM_GOOGLE)
    renderScreen(<ContaDaEscola />)

    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toBe(texto)
    expect(alerta.className).toContain('text-erro')
    expect(screen.getByRole('button', { name: BOTAO })).toBeTruthy()
    expect(window.location.search).toBe('')
  })

  it.each(['provedor', 'valor-que-ninguem-escreveu'])('`%s`: o aviso da queda do provedor e o botão vira "Tentar de novo"', async (resultado) => {
    voltarDoProvedor(resultado)
    const rede = fakeNetwork()
    rede.responderPor('/v1/eu', EU)
    rede.responderPor(ACESSO, COM_GOOGLE)
    renderScreen(<ContaDaEscola />)

    expect((await screen.findByRole('alert')).textContent).toBe('Não foi possível ligar a conta agora. Tente de novo')
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: BOTAO })).toBeNull()
  })

  it('`provedor` com os dois provedores: cada botão diz de que conta é a nova tentativa, e não ficam dois "Tentar de novo" iguais', async () => {
    voltarDoProvedor('provedor')
    const rede = fakeNetwork()
    rede.responderPor('/v1/eu', EU)
    rede.responderPor(ACESSO, COM_OS_DOIS)
    renderScreen(<ContaDaEscola />)

    expect(await screen.findByRole('button', { name: 'Tentar de novo com a conta Google' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tentar de novo com a conta Microsoft' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
  })

  it('os provedores da escola não são lidos de novo a cada abertura de "Eu": a consulta anônima divide o balde por IP com a entrada da escola, e vale por minutos', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/eu', EU)
    rede.responderPor(ACESSO, COM_GOOGLE)
    const cliente = createQueryClient()
    const abrir = () =>
      render(
        <QueryClientProvider client={cliente}>
          <ContaDaEscola />
        </QueryClientProvider>,
      )
    const primeira = abrir()
    expect(await screen.findByRole('button', { name: BOTAO })).toBeTruthy()
    primeira.unmount()
    // Cinco minutos depois (só o relógio de `Date`, o que o TanStack Query lê): o aluno seguinte abre "Eu" no mesmo computador, e a escola é a mesma.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + 5 * 60_000)
    try {
      abrir()
      expect(await screen.findByRole('button', { name: BOTAO })).toBeTruthy()
      await new Promise((pronto) => setTimeout(pronto, 50))
    } finally {
      vi.useRealTimers()
    }

    expect(rede.chamadas.filter((chamada) => chamada.caminho === ACESSO)).toHaveLength(1)
  })

  it('o clique: o botão fica ocupado e desabilitado, e a página que o navegador restaura do histórico (`pageshow` persistido) devolve o botão; um `pageshow` comum não mexe', async () => {
    const rede = fakeNetwork()
    rede.responderPor('/v1/eu', EU)
    rede.responderPor(ACESSO, COM_GOOGLE)
    renderScreen(<ContaDaEscola />)
    // O jsdom não navega: o `location.assign` do clique só registra "Not implemented", e o que a tela faz antes dele é o que se vê.
    const erro = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    fireEvent.click(await screen.findByRole('button', { name: BOTAO }))

    const ocupado = screen.getByRole('button', { name: 'Ligando…' }) as HTMLButtonElement
    expect(ocupado.disabled).toBe(true)
    expect(screen.getByText('Ligando a conta da escola…').getAttribute('role')).toBe('status')
    fireEvent(window, new PageTransitionEvent('pageshow', { persisted: false }))
    expect((screen.getByRole('button', { name: 'Ligando…' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent(window, new PageTransitionEvent('pageshow', { persisted: true }))
    expect(((await screen.findByRole('button', { name: BOTAO })) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.queryByText('Ligando a conta da escola…')).toBeNull()
    erro.mockRestore()
  })

  it('o aviso mora só no estado da tela: o colega que abre "Eu" no mesmo computador, com a barra limpa, não o vê', async () => {
    voltarDoProvedor('conflito')
    const rede = fakeNetwork()
    rede.responderPor('/v1/eu', EU)
    rede.responderPor(ACESSO, COM_GOOGLE)
    const primeira = renderScreen(<ContaDaEscola />)
    expect(await screen.findByRole('alert')).toBeTruthy()
    primeira.unmount()

    renderScreen(<ContaDaEscola />)
    expect(await screen.findByRole('button', { name: BOTAO })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
