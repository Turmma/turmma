import { describe, expect, it } from 'vitest'
import { adulterarPenultimo } from './tampered-text.js'

describe('adulterarPenultimo', () => {
  // `…uAq` é o final do cookie da esteira (run 36024251576) em que o "alterado" saiu igual ao válido.
  it.each(['xyzuAq', 'xyzuAA', 'xyzuBA', 'xyzuBq', 'xyzuqB', 'xyzu__', 'xyzu--'])(
    'muda só o penúltimo caractere de %s, e o resultado é outro valor',
    (valor) => {
      const adulterado = adulterarPenultimo(valor)
      expect(adulterado).not.toBe(valor)
      expect(adulterado).toHaveLength(valor.length)
      expect(adulterado.slice(0, -2)).toBe(valor.slice(0, -2))
      expect(adulterado.slice(-1)).toBe(valor.slice(-1))
      expect(adulterado.at(-2)).toMatch(/^[\w-]$/)
    },
  )
})
