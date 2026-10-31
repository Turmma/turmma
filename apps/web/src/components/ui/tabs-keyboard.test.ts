import { describe, expect, it } from 'vitest'
import { abaDaTecla, abaNaOrdemDoTab } from './tabs-keyboard'

const ABAS = ['visao-geral', 'alunos', 'atividades']

describe('teclado das abas', () => {
  it('as setas andam uma aba e dão a volta nas pontas', () => {
    expect(abaDaTecla(ABAS, 'visao-geral', 'ArrowRight')).toBe('alunos')
    expect(abaDaTecla(ABAS, 'atividades', 'ArrowRight')).toBe('visao-geral')
    expect(abaDaTecla(ABAS, 'alunos', 'ArrowLeft')).toBe('visao-geral')
    expect(abaDaTecla(ABAS, 'visao-geral', 'ArrowLeft')).toBe('atividades')
  })

  it('Home e End vão à primeira e à última', () => {
    expect(abaDaTecla(ABAS, 'alunos', 'Home')).toBe('visao-geral')
    expect(abaDaTecla(ABAS, 'alunos', 'End')).toBe('atividades')
  })

  it('o Tab e as outras teclas não são da lista: seguem para o navegador', () => {
    for (const tecla of ['Tab', 'Enter', ' ', 'ArrowDown', 'a']) expect(abaDaTecla(ABAS, 'alunos', tecla)).toBeUndefined()
  })

  it('a parada do Tab é a aba ativa; com a ativa fora da lista, é a primeira, e nunca nenhuma', () => {
    expect(abaNaOrdemDoTab(ABAS, 'alunos')).toBe('alunos')
    expect(abaNaOrdemDoTab(ABAS, 'sumiu')).toBe('visao-geral')
    expect(abaNaOrdemDoTab([], 'alunos')).toBeUndefined()
  })

  it('sem abas, ou com a ativa fora da lista, não leva a lugar nenhum', () => {
    expect(abaDaTecla([], 'alunos', 'ArrowRight')).toBeUndefined()
    expect(abaDaTecla(ABAS, 'sumiu', 'ArrowRight')).toBeUndefined()
  })
})
