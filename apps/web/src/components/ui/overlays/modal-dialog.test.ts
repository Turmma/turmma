// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { trapFocus, type TeclaDoDialogo } from './modal-dialog'

/**
 * A prisão do foco do `Dialog` e do `Sheet` (X1, tarefa 7.0; Tech Spec, seção 9, "Peças novas"): o Tab que sairia do
 * diálogo volta para dentro dele. O `showModal`, o Esc e o foco devolvido a quem abriu precisam do navegador e são do e2e
 * (`e2e/components-overlays.spec.ts`); aqui está a regra que é só do DOM.
 */
afterEach(() => {
  document.body.innerHTML = ''
})

interface Teclado extends TeclaDoDialogo {
  impedida(): boolean
}

function tecla(key: string, shiftKey = false): Teclado {
  let impedida = false
  return {
    key,
    shiftKey,
    preventDefault: () => {
      impedida = true
    },
    impedida: () => impedida,
  }
}

/**
 * Um diálogo com um título que recebe foco por código (`tabIndex={-1}`, como o miolo do painel e o título da etapa), três
 * controles na ordem do Tab e um desligado no fim, que não é alcançável. Um botão de fora vem antes de tudo.
 */
function montar() {
  document.body.innerHTML = `
    <button id="de-fora">de fora</button>
    <div id="raiz">
      <h2 id="titulo" tabindex="-1">Título</h2>
      <button id="primeiro">Primeiro</button>
      <input id="meio" aria-label="Meio" />
      <a id="ultimo" href="/fim">Último</a>
      <button id="desligado" disabled>Desligado</button>
      <div id="fora-da-ordem" tabindex="-1">Fora da ordem</div>
    </div>`
  const por = (id: string) => {
    const elemento = document.getElementById(id)
    if (elemento === null) throw new Error(`o elemento #${id} não foi montado`)
    return elemento
  }
  return { raiz: por('raiz'), por }
}

describe('prenderOFoco', () => {
  it('o Tab no último controle volta ao primeiro, e o navegador não o leva para fora', () => {
    const { raiz, por } = montar()
    por('ultimo').focus()
    const evento = tecla('Tab')
    trapFocus(evento, raiz)
    expect(document.activeElement).toBe(por('primeiro'))
    expect(evento.impedida()).toBe(true)
  })

  it('o Shift+Tab no primeiro controle vai ao último', () => {
    const { raiz, por } = montar()
    por('primeiro').focus()
    const evento = tecla('Tab', true)
    trapFocus(evento, raiz)
    expect(document.activeElement).toBe(por('ultimo'))
    expect(evento.impedida()).toBe(true)
  })

  it('no meio da ordem, o Tab e o Shift+Tab são do navegador: nada é movido nem impedido', () => {
    const { raiz, por } = montar()
    por('meio').focus()
    for (const shift of [false, true]) {
      const evento = tecla('Tab', shift)
      trapFocus(evento, raiz)
      expect(document.activeElement, `shift ${String(shift)}`).toBe(por('meio'))
      expect(evento.impedida(), `shift ${String(shift)}`).toBe(false)
    }
  })

  it('o foco no título, que está fora da ordem do Tab e antes de todos, não é "o primeiro": o Shift+Tab nele vai ao último, e o Tab segue para o primeiro pelo navegador', () => {
    const { raiz, por } = montar()
    por('titulo').focus()
    const paraTras = tecla('Tab', true)
    trapFocus(paraTras, raiz)
    expect(document.activeElement).toBe(por('ultimo'))
    expect(paraTras.impedida()).toBe(true)

    por('titulo').focus()
    const paraFrente = tecla('Tab')
    trapFocus(paraFrente, raiz)
    expect(document.activeElement).toBe(por('titulo'))
    expect(paraFrente.impedida()).toBe(false)
  })

  it('o foco num elemento fora da ordem que está depois do último: o Tab volta ao primeiro, e o Shift+Tab não intervém', () => {
    const { raiz, por } = montar()
    por('fora-da-ordem').focus()
    const paraFrente = tecla('Tab')
    trapFocus(paraFrente, raiz)
    expect(document.activeElement).toBe(por('primeiro'))
    expect(paraFrente.impedida()).toBe(true)

    por('fora-da-ordem').focus()
    const paraTras = tecla('Tab', true)
    trapFocus(paraTras, raiz)
    expect(document.activeElement).toBe(por('fora-da-ordem'))
    expect(paraTras.impedida()).toBe(false)
  })

  it('o controle desligado não é o último: o Tab no último que se alcança volta ao primeiro', () => {
    const { raiz, por } = montar()
    por('ultimo').focus()
    trapFocus(tecla('Tab'), raiz)
    expect(document.activeElement).not.toBe(por('desligado'))
    expect(document.activeElement).toBe(por('primeiro'))
  })

  it('outra tecla, raiz nula e diálogo sem controle não fazem nada, e não lançam', () => {
    const { raiz, por } = montar()
    por('ultimo').focus()
    const enter = tecla('Enter')
    trapFocus(enter, raiz)
    expect(document.activeElement).toBe(por('ultimo'))
    expect(enter.impedida()).toBe(false)

    const semRaiz = tecla('Tab')
    expect(() => trapFocus(semRaiz, null)).not.toThrow()
    expect(semRaiz.impedida()).toBe(false)

    const vazio = document.createElement('div')
    document.body.append(vazio)
    por('ultimo').focus()
    const semControle = tecla('Tab')
    expect(() => trapFocus(semControle, vazio)).not.toThrow()
    expect(semControle.impedida()).toBe(false)
  })
})
