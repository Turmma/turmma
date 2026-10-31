import { describe, expect, it } from 'vitest'
import { paginar, paginarPor } from './pagination.js'

describe('paginar: o corte da página de uma listagem', () => {
  const linhas = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]

  it('até o limite as linhas voltam inteiras e sem proxima', () => {
    expect(paginar(linhas.slice(0, 3), 3)).toEqual({ itens: linhas.slice(0, 3) })
    expect(paginar(linhas.slice(0, 2), 3)).toEqual({ itens: linhas.slice(0, 2) })
  })

  it('uma linha além do limite é cortada, e proxima é o id da última devolvida', () => {
    const pagina = paginar(linhas, 3)
    expect(pagina.itens).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
    expect(pagina.proxima).toBe('c')
  })

  it('com limite zero a página é vazia e não aponta proxima', () => {
    expect(paginar(linhas, 0)).toEqual({ itens: [] })
  })

  it('a lista vazia dá página vazia, sem proxima', () => {
    expect(paginar([], 3)).toEqual({ itens: [] })
    expect('proxima' in paginar([], 3)).toBe(false)
  })
})

describe('paginarPor: o mesmo corte, pela chave de ordem que o repository usou', () => {
  const alunos = [
    { id: 'linha-1', usuarioId: 'u1' },
    { id: 'linha-2', usuarioId: 'u2' },
    { id: 'linha-3', usuarioId: 'u3' },
  ]

  it('proxima é a chave usuarioId da última devolvida, e não o id da linha', () => {
    const pagina = paginarPor(alunos, 2, (aluno) => aluno.usuarioId)
    expect(pagina.itens.map((aluno) => aluno.id)).toEqual(['linha-1', 'linha-2'])
    expect(pagina.proxima).toBe('u2')
  })

  it('até o limite as linhas não dão proxima, na chave de usuarioId', () => {
    expect(paginarPor(alunos, 3, (aluno) => aluno.usuarioId)).toEqual({ itens: alunos })
  })
})
