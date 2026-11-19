import type { ArtefatoResumido, EstadoDeEntrega } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { agruparPorTurma, enderecoComFiltros, filter, filtrosLigados, readFiltros, rotuloDeVerDocumentos, SEM_FILTROS, TITULO_DA_TURMA_SEM_NOME } from './criados'

/**
 * O que a tela de Criados decide sem rede (telas do professor, 5.0; RF12): os filtros do endereço, o que cada um deixa passar, o
 * agrupamento por turma e o texto do botão do celular.
 */

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const TURMA_A = id(101)
const TURMA_B = id(102)
const QUIMICA = id(500)
const FISICA = id(501)

function artefato(n: number, campos: Partial<ArtefatoResumido> = {}, estado?: EstadoDeEntrega): ArtefatoResumido {
  return {
    id: id(n),
    tipo: 'atividade_objetiva',
    titulo: `Documento ${String(n)}`,
    turmaId: TURMA_A,
    disciplinaId: QUIMICA,
    origemId: null,
    adaptacao: null,
    entrega: estado === undefined ? null : { id: id(900 + n), estado, decididaEm: null },
    criadoEm: '2026-10-05T09:00:00.000Z',
    ...campos,
  }
}

const ADAPTACAO: ArtefatoResumido['adaptacao'] = { tipos: ['fonte_ampliada'] }
const ORIGINAL_DE_ATIVIDADE = artefato(1)
const ADAPTADA_PENDENTE = artefato(2, { origemId: id(1), adaptacao: ADAPTACAO }, 'pendente')
const ADAPTADA_APROVADA = artefato(3, { origemId: id(1), adaptacao: ADAPTACAO }, 'aprovada')
const PLANO = artefato(4, { tipo: 'plano_de_aula' })

describe('readFiltros', () => {
  it('lê os três filtros do endereço, e a turma em minúsculas, que é como a chave do cache e o servidor a tratam', () => {
    expect(readFiltros(`tipo=plano_de_aula&turma=${TURMA_B.toUpperCase()}&estado=rejeitada`)).toEqual({ tipo: 'plano_de_aula', turma: TURMA_B, estado: 'rejeitada' })
  })

  it('sem parâmetro, ou com valor que a tela não conhece, cai em "todos": um tipo fora da lista, um estado fora da lista, uma turma que não é um id', () => {
    expect(readFiltros('')).toEqual(SEM_FILTROS)
    expect(readFiltros('tipo=prova&estado=para_aprovar&turma=7a')).toEqual(SEM_FILTROS)
    expect(readFiltros('tipo=&estado=&turma=')).toEqual(SEM_FILTROS)
    // O valor do estado é o do contrato, e não o rótulo da tela: o texto "Esperando você" não é um estado.
    expect(readFiltros('estado=Esperando%20voc%C3%AA').estado).toBe('todos')
  })

  it('a turma que a professora não tem continua sendo a que o endereço diz: quem responde por ela é o servidor, e não a tela', () => {
    expect(readFiltros(`turma=${id(777)}`).turma).toBe(id(777))
  })
})

describe('enderecoComFiltros', () => {
  it('põe o filtro, troca o que já estava e tira com "todos" ou sem turma; o endereço sem filtro é o limpo, sem "?"', () => {
    expect(enderecoComFiltros('/criados', '', { tipo: 'plano_de_aula' })).toBe('/criados?tipo=plano_de_aula')
    expect(enderecoComFiltros('/criados', 'tipo=plano_de_aula', { tipo: 'atividade_objetiva' })).toBe('/criados?tipo=atividade_objetiva')
    expect(enderecoComFiltros('/criados', 'tipo=plano_de_aula', { tipo: 'todos' })).toBe('/criados')
    expect(enderecoComFiltros('/criados', `turma=${TURMA_A}`, { turma: undefined })).toBe('/criados')
    expect(enderecoComFiltros('/criados', `tipo=plano_de_aula&turma=${TURMA_A}&estado=aprovada`, SEM_FILTROS)).toBe('/criados')
  })

  it('mexe só no filtro que a mudança cita, e não tira o parâmetro de quem não é filtro (o painel do sino abre por `?item=`)', () => {
    expect(enderecoComFiltros('/criados', `item=abc&tipo=plano_de_aula&estado=aprovada`, { estado: 'pendente' })).toBe('/criados?item=abc&tipo=plano_de_aula&estado=pendente')
    expect(enderecoComFiltros('/criados', `item=abc&tipo=plano_de_aula`, SEM_FILTROS)).toBe('/criados?item=abc')
    // Uma mudança que não cita a turma não a tira.
    expect(enderecoComFiltros('/criados', `turma=${TURMA_A}`, { tipo: 'plano_de_aula' })).toBe(`/criados?turma=${TURMA_A}&tipo=plano_de_aula`)
    // Nem o estado: trocar o tipo com um estado já no endereço deixa o estado como está.
    expect(enderecoComFiltros('/criados', 'estado=aprovada', { tipo: 'plano_de_aula' })).toBe('/criados?estado=aprovada&tipo=plano_de_aula')
  })
})

describe('filtrosLigados', () => {
  it('conta cada um dos três filtros que não está em "todos"', () => {
    expect(filtrosLigados(SEM_FILTROS)).toBe(0)
    expect(filtrosLigados({ ...SEM_FILTROS, tipo: 'plano_de_aula' })).toBe(1)
    expect(filtrosLigados({ tipo: 'plano_de_aula', turma: TURMA_A, estado: 'todos' })).toBe(2)
    expect(filtrosLigados({ tipo: 'plano_de_aula', turma: TURMA_A, estado: 'aprovada' })).toBe(3)
  })
})

describe('filtrar', () => {
  const TODOS = [ORIGINAL_DE_ATIVIDADE, ADAPTADA_PENDENTE, ADAPTADA_APROVADA, PLANO]

  it('sem filtro deixa passar tudo, na ordem em que veio', () => {
    expect(filter(TODOS, SEM_FILTROS)).toEqual(TODOS)
  })

  it('o tipo deixa passar só os desse tipo, e a versão adaptada é do tipo da atividade de onde saiu', () => {
    expect(filter(TODOS, { tipo: 'plano_de_aula', estado: 'todos' })).toEqual([PLANO])
    expect(filter(TODOS, { tipo: 'atividade_objetiva', estado: 'todos' })).toEqual([ORIGINAL_DE_ATIVIDADE, ADAPTADA_PENDENTE, ADAPTADA_APROVADA])
  })

  it('o estado é o da decisão sobre a versão adaptada: com "Esperando você" ligado, o original e o plano não passam', () => {
    expect(filter(TODOS, { tipo: 'todos', estado: 'pendente' })).toEqual([ADAPTADA_PENDENTE])
    expect(filter(TODOS, { tipo: 'todos', estado: 'aprovada' })).toEqual([ADAPTADA_APROVADA])
    expect(filter(TODOS, { tipo: 'todos', estado: 'rejeitada' })).toEqual([])
  })

  it('tipo e estado juntos: só passa o que tem os dois', () => {
    expect(filter(TODOS, { tipo: 'atividade_objetiva', estado: 'pendente' })).toEqual([ADAPTADA_PENDENTE])
    expect(filter(TODOS, { tipo: 'plano_de_aula', estado: 'pendente' })).toEqual([])
  })
})

describe('agruparPorTurma', () => {
  const nomeDaTurma = (turmaId: string) => ({ [TURMA_A]: '7ºA', [TURMA_B]: '8ºB' })[turmaId]
  const nomeDaDisciplina = (disciplinaId: string) => ({ [QUIMICA]: 'Química', [FISICA]: 'Física' })[disciplinaId]

  it('um grupo por turma e disciplina, na ordem em que aparecem, e a mesma turma com duas disciplinas dá dois grupos', () => {
    const grupos = agruparPorTurma(
      [artefato(10), artefato(11, { turmaId: TURMA_B }), artefato(12), artefato(13, { disciplinaId: FISICA })],
      nomeDaTurma,
      nomeDaDisciplina,
    )
    expect(grupos.map((grupo) => [grupo.titulo, grupo.itens.map((item) => item.id)])).toEqual([
      ['7ºA · Química', [id(10), id(12)]],
      ['8ºB · Química', [id(11)]],
      ['7ºA · Física', [id(13)]],
    ])
  })

  it('sem o nome da disciplina o título é só a turma, e sem o da turma é "Outra turma": nunca o id', () => {
    const grupos = agruparPorTurma([artefato(20, { disciplinaId: id(999) }), artefato(21, { turmaId: id(998) })], nomeDaTurma, nomeDaDisciplina)
    expect(grupos.map((grupo) => grupo.titulo)).toEqual(['7ºA', TITULO_DA_TURMA_SEM_NOME])
    expect(JSON.stringify(grupos.map((grupo) => grupo.titulo))).not.toContain('0197a1c0')
  })

  it('lista vazia, nenhum grupo', () => {
    expect(agruparPorTurma([], nomeDaTurma, nomeDaDisciplina)).toEqual([])
  })
})

describe('rotuloDeVerDocumentos', () => {
  it('diz quantos documentos a lista tem, no singular e no plural, com "ou mais" enquanto faltam páginas, e "Ver a lista" quando não há nenhum', () => {
    expect(rotuloDeVerDocumentos(7, false)).toBe('Ver 7 documentos')
    expect(rotuloDeVerDocumentos(1, false)).toBe('Ver 1 documento')
    expect(rotuloDeVerDocumentos(1, true)).toBe('Ver 1 ou mais documentos')
    expect(rotuloDeVerDocumentos(12, true)).toBe('Ver 12 ou mais documentos')
    expect(rotuloDeVerDocumentos(0, false)).toBe('Ver a lista')
    expect(rotuloDeVerDocumentos(0, true)).toBe('Ver a lista')
  })
})
