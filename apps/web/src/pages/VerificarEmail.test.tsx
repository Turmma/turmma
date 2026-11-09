// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { describe, expect, it } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { ROUTES } from '../paths'
import { fakeNetwork, setupScreen } from '../__fixtures__/render-screen'
import { VerificarEmail } from './VerificarEmail'

/**
 * "Verificar" (acesso-e-convites, 8.0; RF12), o que o e2e não alcança: o link é de uso único, e a tela de produção não roda no
 * `StrictMode`, que repete o efeito de propósito. Aqui a tela roda dentro dele, e a rede falsa estoura se o pedido sair duas vezes.
 */
setupScreen()

const TOKEN_A = 'A'.repeat(43)
const TOKEN_B = 'B'.repeat(43)
const REQUISICAO = '0190f5a0-0000-7000-8000-000000000001'
const LINK_QUE_NAO_VALE = { status: 404, corpo: { erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'x', requisicaoId: REQUISICAO } } } as const
const CAMINHO_DO_VERIFICAR = '/v1/conta/verificar'

/** O link do e-mail aberto na aba: o token no `#`, como o navegador o recebe. */
function abrirOLink(token: string): void {
  window.history.replaceState(null, '', `${ROUTES.verificar}#${token}`)
}

/** O `render` simples, e não o `renderScreen`: a tela não usa consultas, e com o cliente de consultas em volta o `StrictMode` deste ambiente não repetia o efeito. */
function abrirATela(): void {
  const localizacao = memoryLocation({ path: ROUTES.verificar })
  render(
    <StrictMode>
      <Router hook={localizacao.hook}>
        <VerificarEmail />
      </Router>
    </StrictMode>,
  )
}

describe('Verificar', () => {
  it('o pedido do link sai uma vez só, mesmo com o efeito repetido pelo StrictMode: o link é de uso único', async () => {
    const rede = fakeNetwork()
    rede.responder({ status: 204 })
    abrirOLink(TOKEN_A)
    abrirATela()

    expect(await screen.findByText('E-mail confirmado')).toBeTruthy()
    // Um instante para um segundo pedido, se o efeito repetido o mandasse, chegar à rede (e à tela, se ele falhasse).
    await act(async () => {
      await new Promise((resolver) => setTimeout(resolver, 50))
    })
    expect(rede.chamadas.filter((chamada) => chamada.caminho === CAMINHO_DO_VERIFICAR)).toHaveLength(1)
    expect(screen.getByText('E-mail confirmado')).toBeTruthy()
    // O token saiu da barra.
    expect(window.location.hash).toBe('')
  })

  it('o pedido do link anterior que falha depois de outro link chegar não troca a tela do link novo', async () => {
    const rede = fakeNetwork()
    const doLinkA = rede.segurar()
    rede.responder({ status: 204 })
    abrirOLink(TOKEN_A)
    abrirATela()
    await waitFor(() => expect(rede.chamadas).toHaveLength(1))

    // O link B chega à aba com o pedido de A no ar, e a tela recomeça por ele.
    abrirOLink(TOKEN_B)
    await act(async () => {
      window.dispatchEvent(new HashChangeEvent('hashchange'))
      await Promise.resolve()
    })
    expect(await screen.findByText('E-mail confirmado')).toBeTruthy()

    // A resposta de A chega tarde, e é a de um link que a tela já largou.
    await act(async () => {
      doLinkA.liberar(LINK_QUE_NAO_VALE)
      await new Promise((resolver) => setTimeout(resolver, 0))
    })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('E-mail confirmado')).toBeTruthy()
  })
})
