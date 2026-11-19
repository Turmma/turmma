// @vitest-environment jsdom
import { AVISO_DO_CODIGO_GASTO_SEM_ENTRAR, ErrorCode, MENSAGENS_DE_ERRO } from '@educa/shared'
import { QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, renderHook, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { ApiError, PRAZOS_DA_CHAMADA_MS } from '../api/client'
import { createQueryClient } from '../api/query-client'
import { desafioDaEtapa, entrarPorEmail, esquecerDesafio, guardarDesafio } from '../api/sessao'
import { fakeNetwork, renderScreen, setupScreen, type FakeNetwork, type FakeResponse } from '../__fixtures__/render-screen'
import { ROUTES } from '../paths'
import { EscolherEscola } from './EscolherEscola'
import { DESCARTADA, esperaDoIndisponivel, LIMITE_DA_ESPERA_DO_INDISPONIVEL_S, useEsperaDoIndisponivel } from './espera-do-indisponivel'
import { Mfa } from './Mfa'

/**
 * A espera única do 503 do Redis de fila fora (54.0; RF13), no segundo fator e na escolha de escola da entrada: o tempo que a
 * tela espera, o aviso, o botão, o `ErrorState` do segundo 503, e o recomeço (a segunda pessoa na mesma aba, a mesma entrada
 * de novo, a resposta atrasada). A rede é falsa e o relógio é falso; a tela, a sessão e o cliente são os de verdade. O
 * seletor de escola tem os casos dele em `components/SeletorDeEscola.test.tsx`, e a jornada pelo navegador, a 1366 × 768 e a
 * 360 px, em `e2e/entrar-na-escola.spec.ts`.
 */
setupScreen()

const REQUISICAO = '0190f5a0-0000-7000-8000-000000000001'
const AVISO = 'Tentando de novo em instantes'
const CAMINHO_DO_MFA = '/v1/sessao/mfa'
const CAMINHO_DA_ESCOLA = '/v1/sessao/escola'
const ESCOLA_A = '0197a1c0-0000-7000-8000-00000000000a'
const ESCOLA_B = '0197a1c0-0000-7000-8000-00000000000b'
const PRONTA: FakeResponse = { status: 200, corpo: { etapa: 'pronta', token: 'token-da-pessoa', expiraEm: '2099-01-01T00:00:00.000Z' } }

/** O 503 do Redis de fila fora, como a API o dá: o código tipado e o `Retry-After`. */
const indisponivel = (segundos?: number): FakeResponse => ({
  status: 503,
  corpo: { erro: { codigo: 'INDISPONIVEL_TENTE_DE_NOVO', mensagem: 'texto da API que a tela não usa', requisicaoId: REQUISICAO } },
  ...(segundos === undefined ? {} : { cabecalhos: { 'Retry-After': String(segundos) } }),
})
const recusa: FakeResponse = { status: 401, corpo: { erro: { codigo: 'NAO_AUTENTICADO', mensagem: 'x', requisicaoId: REQUISICAO } } }

let rede: FakeNetwork

beforeEach(() => {
  vi.useFakeTimers()
  esquecerDesafio()
  rede = fakeNetwork()
})

afterEach(() => {
  vi.useRealTimers()
})

const pedidosA = (caminho: string) => rede.chamadas.filter((chamada) => chamada.caminho === caminho)
const avancar = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))
const deixarAsPromessasAndar = () => act(() => vi.advanceTimersByTimeAsync(0))
/** A resposta que chega passa pelo `fetch`, pela leitura do corpo e pela validação: mais de uma volta de promessas até a tela mudar. */
async function assentar(): Promise<void> {
  for (let volta = 0; volta < 5; volta++) await deixarAsPromessasAndar()
}

/** O desafio `mfa` de uma pessoa, na memória da aba, como a entrada por e-mail o deixa. */
function chegarAoSegundoFator(desafio: string): void {
  guardarDesafio('mfa', desafio)
}

function abrirOSegundoFator() {
  const localizacao = memoryLocation({ path: ROUTES.mfa, record: true })
  const tela = renderScreen(createElement(Router, { hook: localizacao.hook, children: createElement(Mfa) }))
  return { localizacao, ...tela }
}

const campoCodigo = () => screen.getByLabelText(/Código do aplicativo/)
const botaoEntrar = () => screen.getByRole('button', { name: /^(Entrar|Entrando…)$/ })
const regiaoDeStatus = () => screen.getAllByRole('status').find((regiao) => regiao.tagName === 'P') as HTMLElement

async function digitarEEnviar(codigo = '123456'): Promise<void> {
  fireEvent.change(campoCodigo(), { target: { value: codigo } })
  fireEvent.click(botaoEntrar())
  await deixarAsPromessasAndar()
}

describe('esperaDoIndisponivel: quanto a tela espera', () => {
  it('o Retry-After até 10 s vale, o de 11 s não, e sem o cabeçalho ou de outro código não há espera', () => {
    expect(LIMITE_DA_ESPERA_DO_INDISPONIVEL_S).toBe(10)
    const erro = (codigo: ErrorCode, segundos?: number) => new ApiError(codigo, segundos)
    expect(esperaDoIndisponivel(erro(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, 3))).toBe(3)
    expect(esperaDoIndisponivel(erro(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, 10))).toBe(10)
    expect(esperaDoIndisponivel(erro(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, 11))).toBeUndefined()
    expect(esperaDoIndisponivel(erro(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO))).toBeUndefined()
    // O piso de 1 s da entrada: um `Retry-After: 0` não faz a escola inteira martelar a rota.
    expect(esperaDoIndisponivel(erro(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, 0))).toBe(1)
    expect(esperaDoIndisponivel(erro(ErrorCode.NAO_AUTENTICADO, 3))).toBeUndefined()
    expect(esperaDoIndisponivel(new Error('rede'))).toBeUndefined()
  })
})

describe('o segundo fator com o Redis de fila fora', () => {
  it('Retry-After: 3 desabilita o botão, diz "Tentando de novo em instantes" em role="status" e repete o mesmo código uma vez, com o mesmo desafio', async () => {
    chegarAoSegundoFator('desafio-da-pessoa-a')
    rede.responder(indisponivel(3))
    rede.responder(PRONTA)
    const { localizacao } = abrirOSegundoFator()

    // Antes de qualquer envio: o aviso está escondido (`sr-only`), sem texto, e o foco não foi para o botão.
    expect(regiaoDeStatus().className).toContain('sr-only')
    expect(regiaoDeStatus().textContent).toBe('')
    expect(document.activeElement).toBe(document.body)

    await digitarEEnviar('654321')
    expect(pedidosA(CAMINHO_DO_MFA)).toHaveLength(1)
    expect((botaoEntrar() as HTMLButtonElement).disabled).toBe(true)
    expect(regiaoDeStatus().textContent).toContain(AVISO)
    expect(regiaoDeStatus().className).not.toContain('sr-only')
    // A contagem é para quem enxerga: o leitor de tela ouve só o aviso.
    expect(regiaoDeStatus().querySelector('[aria-hidden="true"]')?.textContent).toContain('3 s')
    expect(screen.queryByRole('alert')).toBeNull()

    await avancar(2_900)
    expect(pedidosA(CAMINHO_DO_MFA)).toHaveLength(1)
    await avancar(200)
    expect(pedidosA(CAMINHO_DO_MFA)).toHaveLength(2)
    expect(pedidosA(CAMINHO_DO_MFA).map((pedido) => pedido.autorizacao)).toEqual(['Bearer desafio-da-pessoa-a', 'Bearer desafio-da-pessoa-a'])
    await assentar()
    expect(localizacao.history?.at(-1)).toBe(ROUTES.inicio)
  })

  it('o segundo 503 vai ao ErrorState, sem nova espera, e o foco volta ao botão', async () => {
    chegarAoSegundoFator('desafio-da-pessoa-a')
    rede.responder(indisponivel(3))
    rede.responder(indisponivel(3))
    abrirOSegundoFator()

    await digitarEEnviar()
    // O botão desabilitado perdeu o foco: é o que a tela devolve ao terminar.
    ;(document.activeElement as HTMLElement | null)?.blur()
    await avancar(3_000)

    expect(pedidosA(CAMINHO_DO_MFA)).toHaveLength(2)
    expect(screen.getByRole('alert').textContent).toBe('O sistema está indisponível no momento. Tente de novo em instantes.')
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
    // O aviso saiu, o botão voltou a valer e está com o foco.
    expect(regiaoDeStatus().textContent).not.toContain(AVISO)
    // Nem a contagem escondida sobra, nem o "Entrando…" de quem não está entrando.
    expect(regiaoDeStatus().querySelector('[aria-hidden]')).toBeNull()
    expect(regiaoDeStatus().textContent).toBe('')
    expect((botaoEntrar() as HTMLButtonElement).disabled).toBe(false)
    expect(document.activeElement).toBe(botaoEntrar())
    // Nenhuma terceira tentativa sai sozinha.
    await avancar(60_000)
    expect(pedidosA(CAMINHO_DO_MFA)).toHaveLength(2)
  })

  it('o limite: Retry-After de 10 s espera, o de 11 s vai direto ao ErrorState, e sem o cabeçalho também', async () => {
    chegarAoSegundoFator('desafio-da-pessoa-a')
    rede.responder(indisponivel(10))
    rede.responder(PRONTA)
    abrirOSegundoFator()
    await digitarEEnviar()
    await avancar(9_900)
    expect(pedidosA(CAMINHO_DO_MFA)).toHaveLength(1)
    await avancar(200)
    expect(pedidosA(CAMINHO_DO_MFA)).toHaveLength(2)

    for (const resposta of [indisponivel(11), indisponivel()]) {
      esquecerDesafio()
      chegarAoSegundoFator('desafio-da-pessoa-a')
      const antes = pedidosA(CAMINHO_DO_MFA).length
      rede.responder(resposta)
      const tela = abrirOSegundoFator()
      await digitarEEnviar()
      expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
      await avancar(60_000)
      expect(pedidosA(CAMINHO_DO_MFA)).toHaveLength(antes + 1)
      tela.unmount()
    }
  })

  it('outro erro não espera: o código errado mostra a mensagem do campo, e o foco volta ao botão', async () => {
    chegarAoSegundoFator('desafio-da-pessoa-a')
    rede.responder(recusa)
    abrirOSegundoFator()
    campoCodigo().focus()
    await digitarEEnviar()
    // Quem está no campo, digitando o código de novo, fica nele: o foco só volta ao botão quando foi perdido.
    expect(document.activeElement).toBe(campoCodigo())
    expect(screen.getByRole('alert').textContent).toContain('código')
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    expect(pedidosA(CAMINHO_DO_MFA)).toHaveLength(1)
  })

  it('enquanto o pedido está no ar, sem 503, a região de status diz "Entrando…" e fica escondida', async () => {
    chegarAoSegundoFator('desafio-da-pessoa-a')
    const noAr = rede.segurar()
    abrirOSegundoFator()
    await digitarEEnviar()
    expect(regiaoDeStatus().textContent).toBe('Entrando…')
    expect(regiaoDeStatus().className).toContain('sr-only')
    noAr.liberar(recusa)
    await assentar()
  })

  it('recomeço: a tela que sai durante a espera, com o mesmo desafio na aba, não repete o pedido', async () => {
    chegarAoSegundoFator('desafio-da-pessoa-a')
    rede.responder(indisponivel(3))
    const tela = abrirOSegundoFator()
    await digitarEEnviar()
    tela.unmount()
    await avancar(10_000)
    expect(pedidosA(CAMINHO_DO_MFA)).toHaveLength(1)
  })

  it('recomeço: depois do segundo 503, "Tentar de novo" sai na hora e tem de novo a sua espera única', async () => {
    chegarAoSegundoFator('desafio-da-pessoa-a')
    rede.responder(indisponivel(2))
    rede.responder(indisponivel(2))
    rede.responder(indisponivel(2))
    rede.responder(PRONTA)
    const { localizacao } = abrirOSegundoFator()
    await digitarEEnviar()
    await avancar(2_000)
    expect(pedidosA(CAMINHO_DO_MFA)).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await deixarAsPromessasAndar()
    // A primeira tentativa da entrada nova sai sem espera, e só o 503 dela espera, uma vez.
    expect(pedidosA(CAMINHO_DO_MFA)).toHaveLength(3)
    expect(regiaoDeStatus().textContent).toContain(AVISO)
    await avancar(2_000)
    expect(pedidosA(CAMINHO_DO_MFA)).toHaveLength(4)
    await assentar()
    expect(localizacao.history?.at(-1)).toBe(ROUTES.inicio)
  })

  it('recomeço: a segunda pessoa na mesma aba não herda o aviso, e a repetição da primeira não leva o desafio dela', async () => {
    chegarAoSegundoFator('desafio-da-pessoa-a')
    rede.responder(indisponivel(5))
    const primeira = abrirOSegundoFator()
    await digitarEEnviar()
    expect(regiaoDeStatus().textContent).toContain(AVISO)

    // A pessoa sai (a tela some) e a seguinte chega ao mesmo computador, com o desafio dela.
    primeira.unmount()
    esquecerDesafio()
    chegarAoSegundoFator('desafio-da-pessoa-b')
    const segunda = abrirOSegundoFator()
    expect(screen.queryByText(AVISO)).toBeNull()
    expect((botaoEntrar() as HTMLButtonElement).disabled).toBe(false)

    await avancar(10_000)
    // Nada saiu pelo desafio de quem entrou depois, e a tela da segunda continua onde estava.
    expect(pedidosA(CAMINHO_DO_MFA)).toHaveLength(1)
    expect(segunda.localizacao.history?.at(-1)).toBe(ROUTES.mfa)
    expect(screen.queryByText(AVISO)).toBeNull()
  })

  it('recomeço: se o desafio da aba muda durante a espera, com a mesma tela montada, a repetição não sai', async () => {
    chegarAoSegundoFator('desafio-da-pessoa-a')
    rede.responder(indisponivel(3))
    const { localizacao } = abrirOSegundoFator()
    await digitarEEnviar()
    expect(regiaoDeStatus().textContent).toContain(AVISO)

    esquecerDesafio()
    chegarAoSegundoFator('desafio-da-pessoa-b')
    await avancar(3_000)
    await assentar()
    expect(pedidosA(CAMINHO_DO_MFA)).toHaveLength(1)
    expect(regiaoDeStatus().textContent).not.toContain(AVISO)
    expect((botaoEntrar() as HTMLButtonElement).disabled).toBe(false)
    // A tentativa descartada não navega nem mostra falha: quem chegou depois continua no formulário dele.
    expect(localizacao.history?.at(-1)).toBe(ROUTES.mfa)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('o TEMPO_ESGOTADO depois do código certo mostra o aviso do código gasto, sem esperar nem repetir o mesmo código', async () => {
    chegarAoSegundoFator('desafio-da-pessoa-a')
    rede.responder({ status: 503, corpo: { erro: { codigo: 'TEMPO_ESGOTADO', mensagem: 'x', requisicaoId: REQUISICAO } }, cabecalhos: { 'Retry-After': '5' } })
    abrirOSegundoFator()
    await digitarEEnviar()
    await avancar(60_000)
    expect(pedidosA(CAMINHO_DO_MFA)).toHaveLength(1)
    expect(screen.getByRole('alert').textContent).toBe(AVISO_DO_CODIGO_GASTO_SEM_ENTRAR)
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    expect(regiaoDeStatus().textContent).not.toContain(AVISO)
  })

  it('o prazo estourado no navegador, sem resposta da API, mostra o texto geral do TEMPO_ESGOTADO, e não o do código gasto', async () => {
    chegarAoSegundoFator('desafio-da-pessoa-a')
    // A resposta que não chega: o `fetch` fica no ar até o prazo da chamada abortar, como no navegador (`comPrazo`).
    const pendurado = vi.fn(
      (_caminho: string, opcoes: RequestInit = {}) =>
        new Promise<Response>((_resolver, rejeitar) => {
          opcoes.signal?.addEventListener('abort', () => rejeitar(new DOMException('abortada', 'AbortError')))
        }),
    )
    vi.stubGlobal('fetch', pendurado)
    abrirOSegundoFator()
    await digitarEEnviar()
    await avancar(PRAZOS_DA_CHAMADA_MS.leitura)
    await assentar()
    expect(pendurado).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('alert').textContent).toBe(MENSAGENS_DE_ERRO.TEMPO_ESGOTADO)
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
  })

  it('recomeço: a resposta atrasada da repetição, com a tela já fora, não navega', async () => {
    chegarAoSegundoFator('desafio-da-pessoa-a')
    rede.responder(indisponivel(2))
    const atrasada = rede.segurar()
    const primeira = abrirOSegundoFator()
    await digitarEEnviar()
    await avancar(2_000)
    expect(pedidosA(CAMINHO_DO_MFA)).toHaveLength(2)
    primeira.unmount()

    atrasada.liberar(PRONTA)
    await assentar()
    expect(primeira.localizacao.history?.at(-1)).toBe(ROUTES.mfa)
  })

  it('recomeço: a resposta atrasada da repetição, com erro e com a tela já fora, não apaga o desafio de quem chegou depois nem leva a lugar nenhum', async () => {
    chegarAoSegundoFator('desafio-da-pessoa-a')
    rede.responder(indisponivel(2))
    const atrasada = rede.segurar()
    const primeira = abrirOSegundoFator()
    await digitarEEnviar()
    await avancar(2_000)
    expect(pedidosA(CAMINHO_DO_MFA)).toHaveLength(2)
    primeira.unmount()
    esquecerDesafio()
    chegarAoSegundoFator('desafio-da-pessoa-b')

    // O quinto código errado da pessoa A, já com o Redis de volta: a tela dela apagaria o desafio e levaria à entrada.
    atrasada.liberar({
      status: 429,
      corpo: { erro: { codigo: 'CONTA_SEGURADA', mensagem: 'x', requisicaoId: REQUISICAO } },
      cabecalhos: { 'Retry-After': '30' },
    })
    await assentar()
    expect(desafioDaEtapa('mfa')).toBe('desafio-da-pessoa-b')
    expect(primeira.localizacao.history?.at(-1)).toBe(ROUTES.mfa)
  })

  it('a chamada que outra já trocou, ao acabar de esperar, não para a contagem da nova', async () => {
    const esperas: Array<() => void> = []
    const esperar = (): Promise<void> => new Promise((resolver) => esperas.push(resolver))
    const { result } = renderHook(() => useEsperaDoIndisponivel(esperar))
    const queda = (segundos: number) => () => Promise.reject(new ApiError(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, segundos))

    let primeira: Promise<unknown> = Promise.resolve()
    await act(async () => {
      primeira = result.current.run(queda(3))
      await Promise.resolve()
    })
    await act(async () => {
      void result.current.run(queda(4))
      await Promise.resolve()
    })
    expect(result.current.restante).toBe(4)

    // A espera da primeira acaba depois de a segunda ter começado: a contagem é da segunda.
    await act(async () => {
      esperas[0]?.()
      expect(await primeira).toBe(DESCARTADA)
    })
    expect(result.current.restante).toBe(4)
    await avancar(1_000)
    expect(result.current.restante).toBe(3)
  })

  it('recomeço: a resposta atrasada da tentativa anterior não muda a tela de quem chegou depois', async () => {
    chegarAoSegundoFator('desafio-da-pessoa-a')
    const atrasada = rede.segurar()
    const primeira = abrirOSegundoFator()
    await digitarEEnviar()
    primeira.unmount()
    esquecerDesafio()
    chegarAoSegundoFator('desafio-da-pessoa-b')
    const segunda = abrirOSegundoFator()

    atrasada.liberar(PRONTA)
    await deixarAsPromessasAndar()
    expect(primeira.localizacao.history?.at(-1)).toBe(ROUTES.mfa)
    expect(segunda.localizacao.history?.at(-1)).toBe(ROUTES.mfa)
    expect(screen.getByRole('heading', { name: 'Segundo fator' })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('a escolha de escola da entrada com o Redis de fila fora', () => {
  const ACESSOS = [
    { usuarioId: ESCOLA_A, escolaNome: 'Colégio Vista Alegre', redeNome: 'Rede Vista Alegre', papel: 'professor' },
    { usuarioId: ESCOLA_B, escolaNome: 'Escola Municipal do Norte', redeNome: 'Rede Norte', papel: 'professor' },
  ]

  /** O login por e-mail que leva a `escolher`: guarda o desafio e a lista, como a entrada faz. */
  async function chegarAEscolha(desafio: string): Promise<void> {
    rede.responder({ status: 200, corpo: { etapa: 'escolher', desafio, acessos: ACESSOS } })
    await entrarPorEmail({ email: 'pessoa@escola.invalid', senha: 'senha-sintetica-correta-1' })
  }

  function abrirAEscolha() {
    const localizacao = memoryLocation({ path: ROUTES.escolherEscola, record: true })
    const tela = renderScreen(createElement(Router, { hook: localizacao.hook, children: createElement(EscolherEscola) }))
    return { localizacao, ...tela }
  }

  const escola = (nome: string) => screen.getByRole('button', { name: new RegExp(nome) })

  it('espera o Retry-After uma vez, com os botões desabilitados e o aviso, e repete a mesma escolha com o mesmo desafio', async () => {
    await chegarAEscolha('desafio-da-escolha')
    rede.responder(indisponivel(4))
    rede.responder(PRONTA)
    const { localizacao } = abrirAEscolha()

    fireEvent.click(escola('Escola Municipal do Norte'))
    await deixarAsPromessasAndar()
    expect(pedidosA(CAMINHO_DA_ESCOLA)).toHaveLength(1)
    expect(screen.getAllByRole('button').every((botao) => (botao as HTMLButtonElement).disabled)).toBe(true)
    expect(regiaoDeStatus().textContent).toContain(AVISO)
    expect(screen.queryByRole('alert')).toBeNull()

    await avancar(4_000)
    expect(pedidosA(CAMINHO_DA_ESCOLA)).toHaveLength(2)
    expect(pedidosA(CAMINHO_DA_ESCOLA).map((pedido) => pedido.autorizacao)).toEqual(['Bearer desafio-da-escolha', 'Bearer desafio-da-escolha'])
    await assentar()
    expect(localizacao.history?.at(-1)).toBe(ROUTES.inicio)
  })

  it('sem 503, a região de status fica escondida e vazia, e diz "Entrando…" enquanto a escolha está no ar', async () => {
    await chegarAEscolha('desafio-da-escolha')
    const noAr = rede.segurar()
    const { localizacao } = abrirAEscolha()
    expect(regiaoDeStatus().className).toContain('sr-only')
    expect(regiaoDeStatus().textContent).toBe('')

    fireEvent.click(escola('Escola Municipal do Norte'))
    await deixarAsPromessasAndar()
    expect(regiaoDeStatus().textContent).toBe('Entrando…')
    expect(regiaoDeStatus().className).toContain('sr-only')
    noAr.liberar(PRONTA)
    await assentar()
    expect(localizacao.history?.at(-1)).toBe(ROUTES.inicio)
  })

  it('o segundo 503 vai ao ErrorState, sem nova espera; o foco volta à escola escolhida, e "Tentar de novo" repete a mesma escola', async () => {
    await chegarAEscolha('desafio-da-escolha')
    rede.responder(indisponivel(2))
    rede.responder(indisponivel(2))
    rede.responder(PRONTA)
    const { localizacao } = abrirAEscolha()

    fireEvent.click(escola('Escola Municipal do Norte'))
    await deixarAsPromessasAndar()
    ;(document.activeElement as HTMLElement | null)?.blur()
    await avancar(2_000)
    expect(pedidosA(CAMINHO_DA_ESCOLA)).toHaveLength(2)
    expect(screen.getByRole('alert').textContent).toBe('O sistema está indisponível no momento. Tente de novo em instantes.')
    expect(regiaoDeStatus().textContent).not.toContain(AVISO)
    expect(document.activeElement).toBe(escola('Escola Municipal do Norte'))
    await avancar(60_000)
    expect(pedidosA(CAMINHO_DA_ESCOLA)).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await deixarAsPromessasAndar()
    expect(pedidosA(CAMINHO_DA_ESCOLA)).toHaveLength(3)
    await assentar()
    expect(localizacao.history?.at(-1)).toBe(ROUTES.inicio)
    // A escolha repetida é a mesma: o corpo do terceiro pedido leva a escola B.
    expect(JSON.stringify(vi.mocked(fetch).mock.calls.at(-1)?.[1]?.body)).toContain(ESCOLA_B)
  })

  it('recomeço: com o ErrorState na tela, o desafio da aba passa a ser de outra pessoa: "Tentar de novo" não manda a escolha dela, e a falha some', async () => {
    await chegarAEscolha('desafio-da-escolha-a')
    rede.responder(indisponivel(2))
    rede.responder(indisponivel(2))
    abrirAEscolha()
    fireEvent.click(escola('Escola Municipal do Norte'))
    await deixarAsPromessasAndar()
    await avancar(2_000)
    expect(pedidosA(CAMINHO_DA_ESCOLA)).toHaveLength(2)
    expect(screen.getByRole('alert').textContent).toContain('indisponível')

    esquecerDesafio()
    await chegarAEscolha('desafio-da-escolha-b')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    await assentar()
    expect(pedidosA(CAMINHO_DA_ESCOLA)).toHaveLength(2)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('recomeço: com o ErrorState na tela, o desafio da aba passa a ser de outra pessoa e a tela desenha de novo: a falha dela some', async () => {
    await chegarAEscolha('desafio-da-escolha-a')
    rede.responder(indisponivel(2))
    rede.responder(indisponivel(2))
    const { localizacao, rerender } = abrirAEscolha()
    fireEvent.click(escola('Escola Municipal do Norte'))
    await deixarAsPromessasAndar()
    await avancar(2_000)
    expect(screen.getByRole('alert').textContent).toContain('indisponível')

    esquecerDesafio()
    await chegarAEscolha('desafio-da-escolha-b')
    rerender(
      createElement(QueryClientProvider, {
        client: createQueryClient(),
        children: createElement(Router, { hook: localizacao.hook, children: createElement(EscolherEscola) }),
      }),
    )
    await assentar()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
  })

  it('recomeço: se o desafio da aba muda durante a espera, com a mesma tela montada, a repetição não sai e o aviso some', async () => {
    await chegarAEscolha('desafio-da-escolha-a')
    rede.responder(indisponivel(3))
    const { localizacao, rerender } = abrirAEscolha()
    fireEvent.click(escola('Escola Municipal do Norte'))
    await deixarAsPromessasAndar()
    expect(regiaoDeStatus().textContent).toContain(AVISO)

    esquecerDesafio()
    await chegarAEscolha('desafio-da-escolha-b')
    await avancar(3_000)
    await assentar()
    expect(pedidosA(CAMINHO_DA_ESCOLA)).toHaveLength(1)
    expect(regiaoDeStatus().textContent).not.toContain(AVISO)
    expect(localizacao.history?.at(-1)).toBe(ROUTES.escolherEscola)
    expect(screen.queryByRole('alert')).toBeNull()

    // E com o desafio de antes de volta na aba, a tela também não encontra falha nenhuma da escolha que foi descartada.
    esquecerDesafio()
    await chegarAEscolha('desafio-da-escolha-a')
    rerender(
      createElement(QueryClientProvider, {
        client: createQueryClient(),
        children: createElement(Router, { hook: localizacao.hook, children: createElement(EscolherEscola) }),
      }),
    )
    await assentar()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('Retry-After de 11 s vai direto ao ErrorState, e a segunda pessoa na mesma aba não herda o aviso nem a repetição', async () => {
    await chegarAEscolha('desafio-da-escolha-a')
    rede.responder(indisponivel(11))
    const primeira = abrirAEscolha()
    fireEvent.click(escola('Colégio Vista Alegre'))
    await deixarAsPromessasAndar()
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
    expect(pedidosA(CAMINHO_DA_ESCOLA)).toHaveLength(1)
    primeira.unmount()

    esquecerDesafio()
    await chegarAEscolha('desafio-da-escolha-b')
    rede.responder(indisponivel(5))
    abrirAEscolha()
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    fireEvent.click(escola('Colégio Vista Alegre'))
    await deixarAsPromessasAndar()
    expect(regiaoDeStatus().textContent).toContain(AVISO)
  })
})
