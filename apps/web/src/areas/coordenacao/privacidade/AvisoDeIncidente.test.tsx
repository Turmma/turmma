// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prepararTela, redeFalsa, renderizarTela } from '../../../__fixtures__/render-screen'
import AvisoDeIncidente from './AvisoDeIncidente'

/**
 * A faixa que o aviso de incidente deixa depois de "Ver depois" (telas da coordenação, 13.0; RF23): ela fica acima da tela, fora do
 * miolo que rola, e diz a altura que ocupa em `--faixa-de-incidente` para o miolo descontá-la. A altura de verdade (e a página que
 * não rola a 1366 × 768) é do e2e (`e2e/incidentes.spec.ts`); aqui se prova o recado: a variável existe com a faixa e some com ela.
 */
prepararTela()

const VARIAVEL = '--faixa-de-incidente'
const aVariavel = () => document.documentElement.style.getPropertyValue(VARIAVEL)

const DO_INCIDENTE = {
  incidentes: [
    {
      id: '0197a1c0-0000-7000-8000-000000000001',
      conhecidoEm: '2026-10-01T15:00:00.000Z',
      circunstancias: 'Circunstância',
      categorias: ['conversa_do_aluno'],
      titularesEstimados: 40,
      risco: 'relevante',
      contencao: 'Contenção feita',
      correcao: 'Correção em curso',
      avisadoEm: '2026-10-01T16:00:00.000Z',
      confirmadoEm: null,
    },
  ],
  prazoLegal: 'A escola comunica a ANPD e os titulares em até 3 dias úteis.',
}

beforeEach(() => {
  // Tudo o que o `jsdom` não tem e a peça usa: o `<dialog>` modal e o observador de tamanho.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  )
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  Element.prototype.scrollTo = () => undefined
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
  }
})

afterEach(() => {
  document.documentElement.style.removeProperty(VARIAVEL)
})

describe('AvisoDeIncidente: a faixa diz a altura que ocupa', () => {
  it('com o diálogo aberto não há variável; com a faixa ela vale a altura mais o vão de 24 px; e sai quando a faixa sai', async () => {
    const usuario = userEvent.setup()
    redeFalsa().responderPor('/v1/privacidade/incidentes', { status: 200, corpo: DO_INCIDENTE })
    renderizarTela(<AvisoDeIncidente />)
    await screen.findByRole('alertdialog', { name: 'Aviso de incidente de segurança' })
    expect(aVariavel()).toBe('')

    await usuario.click(screen.getByRole('button', { name: 'Ver depois' }))
    // O `jsdom` não calcula altura (a faixa mede 0), então o que resta é o vão do `main`.
    await waitFor(() => expect(aVariavel()).toBe('24px'))

    await usuario.click(screen.getByRole('button', { name: 'Ver o aviso' }))
    await waitFor(() => expect(aVariavel()).toBe(''))
  })

  it('a faixa acompanha a altura dela: é observada, mede de novo quando muda, e deixa de medir quando sai', async () => {
    const usuario = userEvent.setup()
    // O observador falso faz o que o de verdade faz: só avisa de quem foi observado, e para de avisar depois do `disconnect`.
    const observados: Element[] = []
    let desconectou = false
    let medirDeNovo: () => void = () => undefined
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(avisar: () => void) {
          medirDeNovo = () => {
            if (!desconectou && observados.length > 0) avisar()
          }
        }
        observe(elemento: Element): void {
          observados.push(elemento)
        }
        unobserve(): void {}
        disconnect(): void {
          desconectou = true
        }
      },
    )
    redeFalsa().responderPor('/v1/privacidade/incidentes', { status: 200, corpo: DO_INCIDENTE })
    renderizarTela(<AvisoDeIncidente />)
    await screen.findByRole('alertdialog', { name: 'Aviso de incidente de segurança' })
    await usuario.click(screen.getByRole('button', { name: 'Ver depois' }))
    const faixa = await screen.findByRole('region', { name: 'Aviso de incidente de segurança' })
    // A faixa é o que se observa: sem isso o navegador não avisaria quando ela quebra em duas linhas.
    expect(observados).toEqual([faixa])
    // A faixa quebra em duas linhas num computador estreito: 96 px de altura, mais o vão.
    Object.defineProperty(faixa, 'offsetHeight', { configurable: true, value: 96 })
    medirDeNovo()
    expect(aVariavel()).toBe('120px')

    // Com a faixa fora (o aviso reaberto), uma medição que ainda chegasse não pode gravar a variável de novo.
    await usuario.click(screen.getByRole('button', { name: 'Ver o aviso' }))
    await waitFor(() => expect(aVariavel()).toBe(''))
    expect(desconectou).toBe(true)
    medirDeNovo()
    expect(aVariavel()).toBe('')
  })
})
