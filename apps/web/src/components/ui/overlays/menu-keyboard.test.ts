import { describe, expect, it } from 'vitest'
import { itemDaTecla, itemInicial } from './menu-keyboard'

const ITENS = [{ rotulo: 'Só conversar' }, { rotulo: 'Atividade objetiva' }, { rotulo: 'Plano de aula', desabilitado: true }, { rotulo: 'Adaptação' }]

describe('teclado do menu', () => {
  it('as setas andam, dão a volta e pulam o item desligado', () => {
    expect(itemDaTecla(ITENS, 0, 'ArrowDown')).toBe(1)
    // O 2 está desligado: de 1, a seta vai direto ao 3.
    expect(itemDaTecla(ITENS, 1, 'ArrowDown')).toBe(3)
    expect(itemDaTecla(ITENS, 3, 'ArrowDown')).toBe(0)
    expect(itemDaTecla(ITENS, 3, 'ArrowUp')).toBe(1)
    expect(itemDaTecla(ITENS, 0, 'ArrowUp')).toBe(3)
  })

  it('Home e End vão ao primeiro e ao último item ligado', () => {
    expect(itemDaTecla(ITENS, 1, 'Home')).toBe(0)
    expect(itemDaTecla(ITENS, 1, 'End')).toBe(3)
    const comPontasDesligadas = [{ rotulo: 'A', desabilitado: true }, { rotulo: 'B' }, { rotulo: 'C' }, { rotulo: 'D', desabilitado: true }]
    expect(itemDaTecla(comPontasDesligadas, 2, 'Home')).toBe(1)
    expect(itemDaTecla(comPontasDesligadas, 1, 'End')).toBe(2)
  })

  it('uma letra leva ao próximo item que começa por ela, sem acento nem caixa, dando a volta', () => {
    expect(itemDaTecla(ITENS, 0, 'a')).toBe(1)
    expect(itemDaTecla(ITENS, 1, 'A')).toBe(3)
    expect(itemDaTecla(ITENS, 3, 'a')).toBe(1)
    expect(itemDaTecla(ITENS, 1, 's')).toBe(0)
    // O "Plano de aula" está desligado: a letra não para nele.
    expect(itemDaTecla(ITENS, 0, 'p')).toBeUndefined()
    expect(itemDaTecla([{ rotulo: 'Água' }, { rotulo: 'Época' }], 0, 'e')).toBe(1)
  })

  it('a letra com Ctrl, Alt ou ⌘ é atalho do navegador, e não busca no menu', () => {
    expect(itemDaTecla(ITENS, 0, 'a', true)).toBeUndefined()
    expect(itemDaTecla(ITENS, 0, 'a', false)).toBe(1)
    // As setas continuam valendo com o modificador: quem segura o Ctrl por engano não perde a navegação.
    expect(itemDaTecla(ITENS, 0, 'ArrowDown', true)).toBe(1)
  })

  it('Tab, Enter, Esc e as teclas de controle não são de navegação', () => {
    for (const tecla of ['Tab', 'Enter', 'Escape', 'Shift', ' ', 'ArrowRight']) expect(itemDaTecla(ITENS, 0, tecla)).toBeUndefined()
  })

  it('o item que recebe o foco ao abrir é o primeiro ligado, ou o último pela seta para cima', () => {
    expect(itemInicial(ITENS)).toBe(0)
    expect(itemInicial(ITENS, 'ultimo')).toBe(3)
    expect(itemInicial([{ rotulo: 'A', desabilitado: true }, { rotulo: 'B' }])).toBe(1)
    expect(itemInicial([{ rotulo: 'A', desabilitado: true }])).toBeUndefined()
    expect(itemDaTecla([{ rotulo: 'A', desabilitado: true }], 0, 'ArrowDown')).toBeUndefined()
  })
})
