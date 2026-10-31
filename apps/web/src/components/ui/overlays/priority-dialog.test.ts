import { afterEach, describe, expect, it } from 'vitest'
import { haDialogoPrioritario, quandoNaoHouverPrioritario, registrarDialogoPrioritario } from './priority-dialog'

/**
 * O aviso de incidente é o diálogo que se lê primeiro, e o painel que abre pelo endereço espera por ele
 * (correção 2026-10-17-painel-pelo-endereco-cobre-o-aviso). A ordem real dos modais na camada de cima é do navegador e é do e2e
 * (`e2e/incidentes.spec.ts`); aqui está a regra de quando quem espera é chamado.
 */
describe('o diálogo prioritário', () => {
  // O registro mora no módulo: um teste que quebrasse no meio deixaria o prioritário na tela para os outros, e a falha apareceria longe.
  afterEach(() => {
    expect(haDialogoPrioritario()).toBe(false)
  })

  it('sem prioritário na tela, quem quer abrir abre já', () => {
    let abriu = 0
    quandoNaoHouverPrioritario(() => (abriu += 1))
    expect(abriu).toBe(1)
  })

  it('com prioritário na tela, quem quer abrir espera, e abre uma vez só quando o último sai', () => {
    const tirarUm = registrarDialogoPrioritario()
    const tirarOutro = registrarDialogoPrioritario()
    expect(haDialogoPrioritario()).toBe(true)
    let abriu = 0
    quandoNaoHouverPrioritario(() => (abriu += 1))
    expect(abriu).toBe(0)
    tirarUm()
    expect(abriu).toBe(0)
    tirarOutro()
    expect(abriu).toBe(1)
    expect(haDialogoPrioritario()).toBe(false)
    // O que já abriu não abre de novo, nem se outro prioritário vier e sair.
    registrarDialogoPrioritario()()
    expect(abriu).toBe(1)
  })

  it('tirar duas vezes o mesmo prioritário não tira o de outro', () => {
    const tirar = registrarDialogoPrioritario()
    const outro = registrarDialogoPrioritario()
    tirar()
    tirar()
    expect(haDialogoPrioritario()).toBe(true)
    outro()
    expect(haDialogoPrioritario()).toBe(false)
  })

  it('quem desistiu da espera não abre quando o prioritário sai', () => {
    const tirar = registrarDialogoPrioritario()
    let abriu = 0
    const desistir = quandoNaoHouverPrioritario(() => (abriu += 1))
    desistir()
    tirar()
    expect(abriu).toBe(0)
  })

  it('quem espera abre na ordem em que pediu', () => {
    const tirar = registrarDialogoPrioritario()
    const ordem: string[] = []
    quandoNaoHouverPrioritario(() => ordem.push('primeiro'))
    quandoNaoHouverPrioritario(() => ordem.push('segundo'))
    tirar()
    expect(ordem).toEqual(['primeiro', 'segundo'])
  })
})
