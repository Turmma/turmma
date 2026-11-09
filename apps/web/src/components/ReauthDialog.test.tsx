// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it } from 'vitest'
import { Router } from 'wouter'
import { memoryLocation } from 'wouter/memory-location'
import { esquecerBilheteDaTroca, bilheteDaTroca, lembrarQuemEsta } from '../api/sessao'
import { fakeNetwork, renderScreen, setupScreen } from '../__fixtures__/render-screen'
import { ReauthDialog } from './ReauthDialog'

/**
 * "Sua sessão expirou", o que a 13.0 (acesso-e-convites) mudou nele: o aluno que volta digitando a senha **provisória** recebe o bilhete da troca, e o diálogo o leva à tela de troca da escola
 * dele, em vez de a uma tela que não existe. O resto do diálogo (a entrada que abre a sessão, o fim de sessão) é do e2e da sessão vencida.
 */
setupScreen()

const SLUG = 'colegio-a'

beforeAll(() => {
  // O `jsdom` não implementa o `dialog` modal: o diálogo só precisa estar aberto e presente na árvore.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

function abrirODialogo() {
  const localizacao = memoryLocation({ path: '/aluno/inicio', record: true })
  renderScreen(
    <Router hook={localizacao.hook}>
      <ReauthDialog />
    </Router>,
  )
  return localizacao
}

describe('o diálogo da sessão vencida', () => {
  it('o aluno que digita a senha provisória vai para a troca na escola dele, e o bilhete fica na memória', async () => {
    esquecerBilheteDaTroca()
    lembrarQuemEsta({ usuarioId: '0197a1c0-0000-7000-8000-000000000001', papel: 'aluno', escola: { slug: SLUG } })
    const rede = fakeNetwork()
    rede.responder({ status: 200, corpo: { etapa: 'trocar_senha', bilhete: 'bilhete.da.aluna' } })
    const localizacao = abrirODialogo()
    const usuario = userEvent.setup()

    await usuario.type(screen.getByLabelText('Matrícula'), '1234')
    await usuario.type(screen.getByLabelText('Senha'), 'ABCD-EFGH')
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(localizacao.history?.at(-1)).toBe(`/e/${SLUG}/trocar-senha`))
    expect(bilheteDaTroca()?.valor).toBe('bilhete.da.aluna')
  })
})
