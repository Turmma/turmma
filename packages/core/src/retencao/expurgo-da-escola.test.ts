import { CHAVES_DE_RETENCAO } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { ALVOS_DO_EXPURGO_DA_ESCOLA, CATEGORIAS_DO_EXPURGO, LOTE_MAXIMO_DO_ALVO, noitesSeguidasSemConcluir, ordemDaNoite } from './expurgo-da-escola.repository.js'

const CATALOGO = [
  'conversa_tutor',
  'sinal_tutor',
  'conversa_professor',
  'execucao_agente',
  'texto_do_modelo',
  'consumo_por_aluno',
  'trabalho_do_aluno',
  'reivindicacao_decidida',
  'autoria_de_artefato',
  'material_excluido',
  'vinculo_encerrado',
  'pessoa_desativada',
]

describe('catálogo coberto pelo expurgo da escola (F3, tarefa 5.0)', () => {
  it('toda categoria do catálogo passa pelo expurgo, na ordem do catálogo, e nenhuma ficou pendente de tarefa', () => {
    expect([...CATEGORIAS_DO_EXPURGO]).toEqual([...CHAVES_DE_RETENCAO])
    expect([...CATEGORIAS_DO_EXPURGO]).toEqual(CATALOGO)
  })

  it('toda categoria tem ao menos um alvo, e o lote menor que o do job é só o da eliminação da pessoa', () => {
    for (const categoria of CATEGORIAS_DO_EXPURGO) expect(ALVOS_DO_EXPURGO_DA_ESCOLA[categoria].length, categoria).toBeGreaterThan(0)
    expect(Object.keys(ALVOS_DO_EXPURGO_DA_ESCOLA).toSorted()).toEqual([...CHAVES_DE_RETENCAO].toSorted())
    expect(LOTE_MAXIMO_DO_ALVO).toEqual({ usuario: 100 })
  })
})

describe('ordem da noite do expurgo da escola (F3, tarefas 3.0 a 5.0)', () => {
  it('sem categoria pendente, a ordem do catálogo', () => {
    expect(ordemDaNoite(undefined)).toEqual(CATALOGO)
  })

  it('com a pendente, começa por ela e dá a volta no catálogo, passando por todas uma vez', () => {
    expect(ordemDaNoite('sinal_tutor')).toEqual([...CATALOGO.slice(1), 'conversa_tutor'])
    expect(ordemDaNoite('texto_do_modelo')).toEqual([...CATALOGO.slice(4), ...CATALOGO.slice(0, 4)])
    expect(ordemDaNoite('autoria_de_artefato')).toEqual([...CATALOGO.slice(8), ...CATALOGO.slice(0, 8)])
    expect(ordemDaNoite('conversa_tutor')).toEqual(CATALOGO)
  })

  it('a pendente da última categoria (a eliminação da pessoa) vai para o começo da noite', () => {
    expect(ordemDaNoite('pessoa_desativada')).toEqual(['pessoa_desativada', ...CATALOGO.slice(0, -1)])
  })
})

describe('noites seguidas sem concluir, que o alerta lê (F3, tarefa 3.0)', () => {
  const completa = { contada: true, concluidas: 3 }
  const parcial = { contada: true, concluidas: 2 }
  const antesDaPrimeira = { contada: false, concluidas: 0 }

  it('duas noites parciais dão 2; parcial seguida de completa (ontem parcial) dá 1; ontem completa dá 0', () => {
    expect(noitesSeguidasSemConcluir([parcial, parcial], 3)).toBe(2)
    expect(noitesSeguidasSemConcluir([parcial, completa], 3)).toBe(1)
    expect(noitesSeguidasSemConcluir([completa, parcial], 3)).toBe(0)
  })

  it('a noite sem nenhuma categoria concluída conta como incompleta', () => {
    expect(noitesSeguidasSemConcluir([{ contada: true, concluidas: 0 }, parcial], 3)).toBe(2)
  })

  it('a noite anterior à primeira execução da escola não conta, nem como incompleta', () => {
    expect(noitesSeguidasSemConcluir([parcial, antesDaPrimeira], 3)).toBe(1)
    expect(noitesSeguidasSemConcluir([antesDaPrimeira, antesDaPrimeira], 3)).toBe(0)
  })
})
