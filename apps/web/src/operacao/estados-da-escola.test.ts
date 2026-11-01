import { ESTADOS_DA_COORDENACAO } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { STATUS_COLORS, STATUS_FAMILIES } from '../components/ui/StatusBadge'
import { TEXTO_DO_ESTADO, TOM_DO_ESTADO } from './estados-da-escola'

/**
 * W10 (estados): o texto de cada estado da coordenação, como a lista do painel o mostra. A tabela é a do cenário, escrita
 * aqui por extenso: um texto trocado, ou um estado novo no contrato sem texto, deixa vermelho.
 */
const ESPERADO = {
  sem_convite: 'Sem convite',
  pendente: 'Convite enviado, ainda não aberto',
  vencido: 'Convite vencido',
  revogado: 'Convite revogado',
  aceito: 'Convite aceito, falta o primeiro acesso',
  sem_coordenacao: 'Sem coordenação ativa',
  ativa: 'Ativa',
}

describe('W10: o texto de cada estado da coordenação na lista', () => {
  it('é o do cenário, para os sete estados do contrato, e nenhum a mais', () => {
    expect(TEXTO_DO_ESTADO).toEqual(ESPERADO)
    expect(Object.keys(TEXTO_DO_ESTADO).toSorted()).toEqual([...ESTADOS_DA_COORDENACAO].toSorted())
  })

  it('nenhum texto mostra o identificador do estado, e dois estados nunca dizem a mesma coisa', () => {
    for (const estado of ESTADOS_DA_COORDENACAO) {
      const texto = TEXTO_DO_ESTADO[estado]
      // "Sem coordenação ativa" contém a palavra "ativa", e isso é texto; o identificador cru é o valor inteiro, ou o
      // que tem sublinhado (`sem_convite`).
      for (const identificador of ESTADOS_DA_COORDENACAO) expect(texto).not.toBe(identificador)
      expect(texto).not.toContain('_')
    }
    expect(new Set(Object.values(TEXTO_DO_ESTADO)).size).toBe(ESTADOS_DA_COORDENACAO.length)
  })

  it('a cor é de reforço e vem das famílias de estado da 9.1: verde só para a escola ativa', () => {
    for (const estado of ESTADOS_DA_COORDENACAO) {
      expect(STATUS_FAMILIES).toContain(TOM_DO_ESTADO[estado])
      expect(STATUS_COLORS[TOM_DO_ESTADO[estado]]).toMatch(/^bg-(ok|pendente|erro|info)-cx text-(ok|pendente|erro|info)$/)
    }
    expect(ESTADOS_DA_COORDENACAO.filter((estado) => TOM_DO_ESTADO[estado] === 'ok')).toEqual(['ativa'])
  })
})
