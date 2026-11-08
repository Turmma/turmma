import { ALFABETO_DA_SENHA_PROVISORIA, TAMANHO_DA_SENHA_PROVISORIA } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { sortearSenhaProvisoria } from './senha-provisoria.service.js'

describe('sortearSenhaProvisoria (acesso-e-convites, tarefa 9.0)', () => {
  it('o alfabeto tem 31 caracteres e não tem 0, 1, I, L nem O, que se confundem na tela do aluno', () => {
    expect(ALFABETO_DA_SENHA_PROVISORIA).toHaveLength(31)
    for (const proibido of '01ILO') expect(ALFABETO_DA_SENHA_PROVISORIA).not.toContain(proibido)
  })

  it('pede um sorteio por posição, sempre sobre o alfabeto inteiro (sem resto de divisão), e usa o índice sorteado', () => {
    const pedidos: number[] = []
    const senha = sortearSenhaProvisoria((maximo) => {
      pedidos.push(maximo)
      return pedidos.length - 1
    })
    expect(pedidos).toEqual(Array<number>(TAMANHO_DA_SENHA_PROVISORIA).fill(ALFABETO_DA_SENHA_PROVISORIA.length))
    expect(senha).toBe([...ALFABETO_DA_SENHA_PROVISORIA].slice(0, TAMANHO_DA_SENHA_PROVISORIA).join(''))
  })

  it('a senha sorteada de verdade tem oito caracteres do alfabeto', () => {
    for (let vez = 0; vez < 200; vez++) expect(sortearSenhaProvisoria()).toMatch(/^[2-9A-HJKMNP-Z]{8}$/)
  })
})
