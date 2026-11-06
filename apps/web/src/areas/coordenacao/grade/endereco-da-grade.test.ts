import { describe, expect, it } from 'vitest'
import { painelDoEndereco } from './endereco-da-grade'

describe('o que abre por cima de Grade e calendário, no endereço', () => {
  it.each([
    ['?painel=importar-grade', 'importar-grade'],
    ['painel=importar-calendario', 'importar-calendario'],
    ['painel=importar-calendario&outro=1', 'importar-calendario'],
  ])('%s abre o painel %s', (busca, painel) => {
    expect(painelDoEndereco(busca)).toBe(painel)
  })

  it.each(['', 'painel=', 'painel=ano', 'painel=importar', 'painel=Importar-Grade', 'turma=0190f5a0'])('valor fora da lista (%j) é ignorado', (busca) => {
    expect(painelDoEndereco(busca)).toBeUndefined()
  })
})
