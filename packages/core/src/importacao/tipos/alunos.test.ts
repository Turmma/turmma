import { describe, expect, it } from 'vitest'
import type { TurmaDoAno } from '../../estrutura/turma.repository.js'
import { classificar } from './alunos.js'

const ANO = 'ano-2026'
const SEM_USO: ReadonlySet<string> = new Set()

const turma = (id: string, nome: string, chave: string | null, etapa: 'ef_anos_finais' | 'em' = 'ef_anos_finais', serieAno = 8): TurmaDoAno => ({ id, nome, chave, serie: { id: `serie-${id}`, etapa, ano: serieAno } })
const lida = (linha: number, turmaEscrita: string, nome: string, matricula: string) => ({ linha, turma: turmaEscrita, nome, matricula })

describe('classificar (planilha de alunos)', () => {
  it('"8ºA", "8º A", "8A", "8a" e "8º ano A" são a mesma turma: uma turma nova, com o nome da primeira grafia e a série do 8º ano do Fundamental', () => {
    const lidas = ['8ºA', '8º A', '8A', '8a', '8º ano A'].map((escrita, posicao) => lida(posicao + 2, escrita, `Aluno ${String(posicao)}`, `m${String(posicao)}`))

    const { linhas, novas, resumo } = classificar(ANO, lidas, [], SEM_USO)

    expect(linhas.map((l) => l.resultado)).toEqual(['entra', 'entra', 'entra', 'entra', 'entra'])
    expect(novas).toEqual([{ chave: '8a', nome: '8ºA', serie: { etapa: 'ef_anos_finais', ano: 8 } }])
    expect(resumo).toEqual({ entram: 5, ja_existem: 0, turmas_novas: 1 })
  })

  it('o nome da turma nova perde o espaço a mais: "9º   B" é criada como "9º B"', () => {
    const { novas } = classificar(ANO, [lida(2, '9º   B', 'Aluno', 'm1')], [], SEM_USO)

    expect(novas.map((nova) => nova.nome)).toEqual(['9º B'])
  })

  it('a série vem do dígito: 6 a 9 é o Fundamental, 1 a 3 é o Médio; 4, 5 e 0 não têm série e a turma que a escola não tem é erro', () => {
    const lidas = ['6A', '9B', '1C', '3D', '4A', '5B', '0C'].map((escrita, posicao) => lida(posicao + 2, escrita, 'Nome', `m${String(posicao)}`))

    const { linhas, novas } = classificar(ANO, lidas, [], SEM_USO)

    expect(novas.map((nova) => [nova.chave, nova.serie.etapa, nova.serie.ano])).toEqual([
      ['1c', 'em', 1],
      ['3d', 'em', 3],
      ['6a', 'ef_anos_finais', 6],
      ['9b', 'ef_anos_finais', 9],
    ])
    expect(linhas.map((l) => l.erro)).toEqual([undefined, undefined, undefined, undefined, 'turma_invalida', 'turma_invalida', 'turma_invalida'])
  })

  it('a turma da escola com a mesma chave que outra (o que nenhum índice deixa nascer, mas a conta de nome sim) é "turma ambígua" nas duas grafias, e a que tem a chave só dela casa', () => {
    const turmas = [turma('t1', '8A', null), turma('t2', '8º A', null), turma('t3', '8B', '8b'), turma('t4', '9A', '9a'), turma('t5', '9º A', '9a')]

    const { linhas } = classificar(ANO, [lida(2, '8A', 'A', 'm1'), lida(3, '8 a', 'B', 'm2'), lida(4, '8b', 'C', 'm3'), lida(5, '9 A', 'D', 'm4')], turmas, SEM_USO)

    expect(linhas.map((l) => [l.resultado, l.erro, l.destino])).toEqual([
      ['erro', 'turma_ambigua', undefined],
      ['erro', 'turma_ambigua', undefined],
      ['entra', undefined, { tipo: 'existente', turmaId: 't3' }],
      ['erro', 'turma_ambigua', undefined],
    ])
  })

  it('a turma com a chave nula é achada pelo nome quando ele tem o padrão ("8º A" sem chave casa com "8a") e, sem o padrão, só pelo nome sem acento nem caixa', () => {
    const turmas = [turma('t1', '8º A', null), turma('t2', 'Turma Azul', null), turma('t3', 'Turma Ámbar', null)]

    const { linhas, novas } = classificar(ANO, [lida(2, '8A', 'A', 'm1'), lida(3, 'TURMA  azul', 'B', 'm2'), lida(4, 'turma ambar', 'C', 'm3'), lida(5, 'Turma Verde', 'D', 'm4')], turmas, SEM_USO)

    expect(linhas.map((l) => [l.erro, l.destino])).toEqual([
      [undefined, { tipo: 'existente', turmaId: 't1' }],
      [undefined, { tipo: 'existente', turmaId: 't2' }],
      [undefined, { tipo: 'existente', turmaId: 't3' }],
      ['turma_invalida', undefined],
    ])
    expect(novas).toEqual([])
  })

  it('o erro da linha vem na ordem turma, nome, matrícula, forma de documento; a matrícula repetida só aparece na linha que não tem erro antes', () => {
    const lidas = [
      lida(2, '', 'Sem turma', 'm1'),
      lida(3, '8A', '', 'm2'),
      lida(4, '8A', 'x'.repeat(201), 'm3'),
      lida(5, '8A', 'Sem matrícula', ''),
      lida(6, '8A', 'Matrícula longa', 'm'.repeat(41)),
      lida(7, '8A', 'Científica', '1,2345E+11'),
      lida(8, '8A', 'Documento', '123.456.789-09'),
      lida(9, '8A', 'Repetida um', 'igual'),
      lida(10, '8A', 'Repetida dois', 'igual'),
      lida(11, '', 'Repetida e sem turma', 'igual'),
    ]

    const { linhas } = classificar(ANO, lidas, [], SEM_USO)

    expect(linhas.map((l) => l.erro)).toEqual([
      'turma_vazia',
      'sem_nome',
      'nome_invalido',
      'sem_matricula',
      'matricula_invalida',
      'matricula_notacao_cientifica',
      'matricula_parece_documento',
      'matricula_repetida',
      'matricula_repetida',
      'turma_vazia',
    ])
  })

  it('a matrícula em uso é "já existe" e não cria turma: a turma que só ela pedia não nasce', () => {
    const { linhas, novas, resumo } = classificar(ANO, [lida(2, '9C', 'Já cadastrada', 'em-uso'), lida(3, '7D', 'Nova', 'livre')], [], new Set(['em-uso']))

    expect(linhas.map((l) => l.resultado)).toEqual(['ja_existe', 'entra'])
    expect(novas.map((nova) => nova.chave)).toEqual(['7d'])
    expect(resumo).toEqual({ entram: 1, ja_existem: 1, turmas_novas: 1 })
  })

  it('a assinatura muda com o ano, com o resultado de uma linha, com a turma de destino (renomear a turma tocada) e com o erro; a mesma entrada dá a mesma assinatura', () => {
    const lidas = [lida(2, '8A', 'Ana', 'm1'), lida(3, '8A', 'Bia', 'm2')]
    const base = classificar(ANO, lidas, [turma('t1', '8A', '8a')], SEM_USO).assinatura

    expect(classificar(ANO, lidas, [turma('t1', '8A', '8a')], SEM_USO).assinatura).toBe(base)
    expect(classificar('ano-2027', lidas, [turma('t1', '8A', '8a')], SEM_USO).assinatura).not.toBe(base)
    expect(classificar(ANO, lidas, [turma('t1', '8A', '8a')], new Set(['m2'])).assinatura).not.toBe(base)
    expect(classificar(ANO, lidas, [turma('t1', '9B', '9b')], SEM_USO).assinatura).not.toBe(base)
    expect(classificar(ANO, lidas, [turma('t1', '8A', '8a'), turma('t2', '8º A', null)], SEM_USO).assinatura).not.toBe(base)
    expect(classificar(ANO, lidas, [turma('t9', '8A', '8a')], SEM_USO).assinatura).not.toBe(base)
    expect(classificar(ANO, [lida(2, '8A', 'Ana', 'm1'), lida(3, '8A', 'Bia', 'm1')], [turma('t1', '8A', '8a')], SEM_USO).assinatura).not.toBe(base)
  })
})
