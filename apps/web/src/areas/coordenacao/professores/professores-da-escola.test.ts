import type { ProfessorDaEscola, VinculoDaCoordenacao } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { contagemDeProfessores, MOTIVO_DO_ENCERRAMENTO, porQueNaoRecebeTurma, professorAlocavel, professorDoEndereco, professoresDaTabela, vinculosDoProfessor } from './professores-da-escola'

/**
 * A conta que a aba Professores desenha (telas da coordenação, 6.0; RF13): as turmas e as disciplinas dos vínculos de cada professor,
 * o professor que o endereço abre e a contagem. Sem rede e sem tela: o que se prova é o que a linha diria.
 */

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const CAMILA: ProfessorDaEscola = { usuarioId: id(502), nome: 'Camila', estado: 'ativo', envio: null, enviadoEm: null }
const RAFAEL: ProfessorDaEscola = { usuarioId: id(501), nome: 'Rafael', estado: 'pendente', envio: null, enviadoEm: null }
const BEATRIZ: ProfessorDaEscola = { usuarioId: id(503), nome: 'Beatriz', estado: 'vencido', envio: null, enviadoEm: null }
const TURMA = (n: number, nome: string) => ({ id: id(100 + n), nome })
const T7A = TURMA(1, '7ºA')
const T7B = TURMA(2, '7ºB')
const T10A = TURMA(3, '10ºA')
const MATEMATICA = { id: id(700), nome: 'Matemática' }
const FISICA = { id: id(701), nome: 'Física' }

const vinculo = (n: number, professor: ProfessorDaEscola, turma: { id: string; nome: string }, estado: VinculoDaCoordenacao['estado'], disciplina: { id: string; nome: string } | null = MATEMATICA): VinculoDaCoordenacao => ({
  id: id(600 + n),
  usuarioId: professor.usuarioId,
  papel: 'professor',
  turma,
  ...(disciplina === null ? {} : { disciplina }),
  estado,
})
const inteiros = (itens: readonly VinculoDaCoordenacao[]) => ({ itens, completa: true })
const daLinha = (professor: ProfessorDaEscola, vinculos: readonly VinculoDaCoordenacao[]) => {
  const linha = professoresDaTabela([professor], inteiros(vinculos))[0]
  if (linha === undefined) throw new Error('sem a linha')
  return linha
}

describe('professoresDaTabela: as turmas e as disciplinas de cada professor', () => {
  it('duas disciplinas na mesma turma: a turma uma vez, as duas disciplinas pelo nome', () => {
    const linha = daLinha(CAMILA, [vinculo(1, CAMILA, T7A, 'confirmado', MATEMATICA), vinculo(2, CAMILA, T7A, 'pendente', FISICA)])
    expect(linha.turmas).toEqual(['7ºA'])
    expect(linha.disciplinas).toEqual(['Física', 'Matemática'])
  })

  it('a mesma disciplina em duas turmas: as duas turmas, a disciplina uma vez', () => {
    const linha = daLinha(CAMILA, [vinculo(1, CAMILA, T7B, 'confirmado'), vinculo(2, CAMILA, T7A, 'confirmado')])
    expect(linha.turmas).toEqual(['7ºA', '7ºB'])
    expect(linha.disciplinas).toEqual(['Matemática'])
  })

  it('o vínculo pendente, o confirmado e o contestado contam; o encerrado já não é do professor', () => {
    const linha = daLinha(CAMILA, [
      vinculo(1, CAMILA, T7A, 'pendente', MATEMATICA),
      vinculo(2, CAMILA, T7B, 'confirmado', MATEMATICA),
      vinculo(3, CAMILA, T10A, 'contestado', FISICA),
      vinculo(4, CAMILA, TURMA(4, '8ºA'), 'encerrado', { id: id(702), nome: 'Química' }),
    ])
    expect(linha.turmas).toEqual(['7ºA', '7ºB', '10ºA'])
    expect(linha.disciplinas).toEqual(['Física', 'Matemática'])
  })

  it('a turma 10 vem depois da 7, e não da 1', () => {
    expect(daLinha(CAMILA, [vinculo(1, CAMILA, T10A, 'confirmado'), vinculo(2, CAMILA, T7A, 'confirmado')]).turmas).toEqual(['7ºA', '10ºA'])
  })

  it('o vínculo de cada professor é só dele, e o que não é de professor não entra', () => {
    const doAluno: VinculoDaCoordenacao = { ...vinculo(9, RAFAEL, T7B, 'confirmado'), papel: 'aluno' }
    const [camila, rafael] = professoresDaTabela([RAFAEL, CAMILA], inteiros([vinculo(1, CAMILA, T7A, 'confirmado'), doAluno]))
    expect([camila?.professor.nome, camila?.turmas]).toEqual(['Camila', ['7ºA']])
    expect([rafael?.professor.nome, rafael?.turmas]).toEqual(['Rafael', []])
  })

  it('o vínculo sem disciplina dá a turma e nenhuma disciplina', () => {
    const linha = daLinha(CAMILA, [vinculo(1, CAMILA, T7A, 'confirmado', null)])
    expect(linha.turmas).toEqual(['7ºA'])
    expect(linha.disciplinas).toEqual([])
  })

  it('o professor sem vínculo fica com as duas listas vazias, e a tela diz o traço', () => {
    const linha = daLinha(BEATRIZ, [vinculo(1, CAMILA, T7A, 'confirmado')])
    expect([linha.turmas, linha.disciplinas]).toEqual([[], []])
  })

  it('sem os vínculos lidos (carregando, erro, sem ano em curso), nenhum professor ganha turma', () => {
    const [linha] = professoresDaTabela([CAMILA], undefined)
    expect([linha?.turmas, linha?.disciplinas]).toEqual([[], []])
  })

  it('os professores saem pelo nome, e não pela ordem em que a API os entrega', () => {
    expect(professoresDaTabela([RAFAEL, CAMILA, BEATRIZ], inteiros([])).map((linha) => linha.professor.nome)).toEqual(['Beatriz', 'Camila', 'Rafael'])
  })
})

describe('professorDoEndereco: o professor que a consulta abre', () => {
  const lista = [CAMILA, RAFAEL]

  it('o id que está na lista abre aquele professor', () => {
    expect(professorDoEndereco(`professor=${CAMILA.usuarioId}`, lista)).toBe(CAMILA)
    expect(professorDoEndereco(`painel=ano&professor=${RAFAEL.usuarioId}`, lista)).toBe(RAFAEL)
  })

  it('o id que a lista não tem — de outra escola, inventado, vazio ou ausente — não abre nada', () => {
    expect(professorDoEndereco(`professor=${BEATRIZ.usuarioId}`, lista)).toBeUndefined()
    expect(professorDoEndereco('professor=nao-e-um-id', lista)).toBeUndefined()
    expect(professorDoEndereco('professor=', lista)).toBeUndefined()
    expect(professorDoEndereco('', lista)).toBeUndefined()
    expect(professorDoEndereco(`professor=${CAMILA.usuarioId}`, [])).toBeUndefined()
  })

  it('só o parâmetro `professor` abre: o id em outro parâmetro é ignorado', () => {
    expect(professorDoEndereco(`painel=${CAMILA.usuarioId}`, lista)).toBeUndefined()
  })
})

describe('contagemDeProfessores', () => {
  it.each([
    [1, '1 professor'],
    [2, '2 professores'],
    [31, '31 professores'],
  ] as const)('%i → %s', (quantos, esperado) => {
    expect(contagemDeProfessores(quantos)).toBe(esperado)
  })
})

describe('professorAlocavel e porQueNaoRecebeTurma: quem recebe turma e, quando não recebe, por quê', () => {
  it('recebe o convite em aberto, o aceito e o ativo; o vencido, o revogado e o desativado não', () => {
    expect(['pendente', 'aceito', 'ativo'].map((estado) => professorAlocavel(estado as ProfessorDaEscola['estado']))).toEqual([true, true, true])
    expect(['vencido', 'revogado', 'desativado'].map((estado) => professorAlocavel(estado as ProfessorDaEscola['estado']))).toEqual([false, false, false])
  })

  it('quem recebe turma não tem motivo; cada um que não recebe tem o seu, em texto, com o caminho de volta', () => {
    for (const estado of ['pendente', 'aceito', 'ativo'] as const) expect(porQueNaoRecebeTurma(estado), estado).toBeUndefined()
    expect(porQueNaoRecebeTurma('vencido')).toBe('O convite venceu. Refaça o convite para acrescentar uma turma.')
    expect(porQueNaoRecebeTurma('revogado')).toBe('O convite foi revogado. Para acrescentar uma turma, cadastre o mesmo e-mail de novo.')
    expect(porQueNaoRecebeTurma('desativado')).toBe('A conta foi desativada. Para acrescentar uma turma, cadastre o mesmo e-mail de novo.')
  })
})

describe('vinculosDoProfessor: o que o painel lista', () => {
  it('todo estado do professor entra — o encerrado ao lado do aberto, o contestado —, pela turma (7ºA antes de 10ºA) e depois pela disciplina', () => {
    const itens = [
      vinculo(1, CAMILA, T10A, 'confirmado', MATEMATICA),
      vinculo(2, CAMILA, T7A, 'encerrado', MATEMATICA),
      vinculo(3, CAMILA, T7A, 'contestado', FISICA),
      vinculo(4, CAMILA, T7B, 'pendente', MATEMATICA),
    ]
    expect(vinculosDoProfessor(itens, CAMILA.usuarioId).map((dele) => [dele.turma.nome, dele.disciplina?.nome, dele.estado])).toEqual([
      ['7ºA', 'Física', 'contestado'],
      ['7ºA', 'Matemática', 'encerrado'],
      ['7ºB', 'Matemática', 'pendente'],
      ['10ºA', 'Matemática', 'confirmado'],
    ])
  })

  it('o vínculo de outro professor não entra, nem o de papel que não é de professor', () => {
    const doAluno: VinculoDaCoordenacao = { ...vinculo(3, CAMILA, T7A, 'confirmado'), papel: 'aluno' }
    const itens = [vinculo(1, CAMILA, T7A, 'confirmado'), vinculo(2, RAFAEL, T7B, 'confirmado'), doAluno]
    expect(vinculosDoProfessor(itens, CAMILA.usuarioId).map((dele) => dele.id)).toEqual([id(601)])
    expect(vinculosDoProfessor(itens, BEATRIZ.usuarioId)).toEqual([])
  })

  it('o motivo do encerramento diz as três razões em português', () => {
    expect(MOTIVO_DO_ENCERRAMENTO).toEqual({ fim_do_ano: 'fim do ano letivo', desligamento: 'desligamento', realocacao: 'realocação' })
  })
})
