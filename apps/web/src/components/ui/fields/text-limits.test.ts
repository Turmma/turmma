import { TAMANHO_MAXIMO_DA_JUSTIFICATIVA, TAMANHO_MINIMO_DA_JUSTIFICATIVA } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { limitarTexto, problemaDoTexto, tamanhoDoTexto, textoDoContador } from './text-limits'

const JUSTIFICATIVA = { minimo: TAMANHO_MINIMO_DA_JUSTIFICATIVA, maximo: TAMANHO_MAXIMO_DA_JUSTIFICATIVA }

describe('texto do campo de várias linhas', () => {
  it('conta sem o espaço das pontas, como a API conta', () => {
    expect(tamanhoDoTexto('  abc  \n')).toBe(3)
    expect(tamanhoDoTexto('        ')).toBe(0)
    expect(textoDoContador('  A questão 3  ', JUSTIFICATIVA)).toBe('11 de 500')
  })

  it('a justificativa da rejeição tem de 8 a 500 caracteres, e a mensagem diz quanto falta', () => {
    expect(problemaDoTexto('', JUSTIFICATIVA)).toBe('Escreva pelo menos 8 caracteres.')
    // Oito espaços não são oito caracteres.
    expect(problemaDoTexto('        ', JUSTIFICATIVA)).toBe('Escreva pelo menos 8 caracteres.')
    expect(problemaDoTexto('errada', JUSTIFICATIVA)).toBe('Escreva pelo menos 8 caracteres: faltam 2.')
    expect(problemaDoTexto('erradas', JUSTIFICATIVA)).toBe('Escreva pelo menos 8 caracteres: falta 1.')
    expect(problemaDoTexto('erradas!', JUSTIFICATIVA)).toBeUndefined()
    expect(problemaDoTexto('x'.repeat(500), JUSTIFICATIVA)).toBeUndefined()
    expect(problemaDoTexto('x'.repeat(501), JUSTIFICATIVA)).toBe('Use até 500 caracteres.')
  })

  it('o campo corta no máximo pela mesma conta do contador: o espaço das pontas não gasta o limite', () => {
    // Dentro do limite, o texto fica como foi escrito, com o espaço do fim que a pessoa acabou de digitar.
    expect(limitarTexto('  abc ', 5)).toBe('  abc ')
    // 498 letras e dois espaços na frente: o contador diz 498, e o campo ainda aceita mais duas.
    const quase = `  ${'x'.repeat(498)}`
    expect(textoDoContador(quase, { maximo: 500 })).toBe('498 de 500')
    expect(limitarTexto(`${quase}yz`, 500)).toBe(`${quase}yz`)
    // A terceira já passa: o que sai é o fim, e o contador para em 500.
    const cortado = limitarTexto(`${quase}yzw`, 500)
    expect(cortado).toBe(`${quase}yz`)
    expect(textoDoContador(cortado, { maximo: 500 })).toBe('500 de 500')
    // A colagem maior que o limite entra cortada, e o que o campo guarda nunca tem problema de tamanho máximo.
    expect(tamanhoDoTexto(limitarTexto('y'.repeat(900), 500))).toBe(500)
    expect(problemaDoTexto(limitarTexto(` ${'y'.repeat(900)} `, 500), { maximo: 500 })).toBeUndefined()
  })

  it('sem mínimo, o texto vazio serve', () => {
    expect(problemaDoTexto('', { maximo: 200 })).toBeUndefined()
  })
})
