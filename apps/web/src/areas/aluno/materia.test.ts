import { Atom, BookOpen, Calculator, Landmark } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { FAMILIAS_DE_COR } from '../../components/ui/Contador'
import { caraDaMateria } from './materia'

describe('a cara da matéria na lista de tarefas', () => {
  it('"Matemática", "matematica" e " MATEMÁTICA " são a mesma matéria: família azul e o ícone da calculadora', () => {
    for (const nome of ['Matemática', 'matematica', ' MATEMÁTICA ']) expect(caraDaMateria(nome), nome).toEqual({ familia: 'azul', Icone: Calculator })
  })

  it('"História" acha a família amarela e o ícone dela, e "Física" outra, mesmo com acento', () => {
    expect(caraDaMateria('História')).toEqual({ familia: 'amarelo', Icone: Landmark })
    expect(caraDaMateria('Física')).toEqual({ familia: 'anil', Icone: Atom })
  })

  it('o nome com mais de uma grafia ("Língua Portuguesa", "Português") dá a mesma cara', () => {
    expect(caraDaMateria('Língua Portuguesa')).toEqual(caraDaMateria('Português'))
  })

  it('nome desconhecido cai na reserva, e o nome que é chave de objeto não a atravessa', () => {
    const reserva = { familia: 'anil', Icone: BookOpen }
    expect(caraDaMateria('Robótica')).toEqual(reserva)
    expect(caraDaMateria('')).toEqual(reserva)
    for (const nome of ['constructor', '__proto__', 'toString']) expect(caraDaMateria(nome), nome).toEqual(reserva)
  })

  it('nenhuma matéria usa o laranja, que é da ação (docs/interface.md 9.1), e toda família é uma das dez', () => {
    for (const nome of ['Matemática', 'Língua Portuguesa', 'Ciências', 'Biologia', 'Química', 'Física', 'História', 'Filosofia', 'Geografia', 'Sociologia', 'Língua Inglesa', 'Arte', 'Educação Física', 'Desconhecida']) {
      const { familia } = caraDaMateria(nome)
      expect(familia, nome).not.toBe('laranja')
      expect(FAMILIAS_DE_COR, nome).toContain(familia)
    }
  })
})
