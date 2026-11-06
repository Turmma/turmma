import { previaDaPlanilhaResponseSchema, type EstadoDeVinculo, type EstadoDoProfessor, type MarcasDaPlanilha, type OrigemDeVinculo } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { convidarProfessorDaPlanilha } from '../../convite/convidar-professor-da-planilha.js'
import type { DatabaseTransaction } from '../../db/database.js'
import type { TurmaDoAno } from '../../estrutura/turma.repository.js'
import type { AulaGravada } from '../alocacao.repository.js'
import { ContaDaPlanilhaPerdidaError, DiferencaNaPlanilhaError } from '../erros.js'
import type { AnoDeDestino, ImportacaoRepository, ProfessorDaEscola } from '../importacao.repository.js'
import type { AmbienteDaGravacao } from '../tipo.js'
import { classificar, tipoGrade } from './grade.js'

const auditar = vi.hoisted(() => vi.fn())
vi.mock('../../convite/convidar-professor-da-planilha.js', () => ({ convidarProfessorDaPlanilha: vi.fn() }))
vi.mock('../../auditoria/auditoria-recorder.js', () => ({ AuditoriaRecorder: class { gravar = auditar } }))
const revogar = vi.hoisted(() => vi.fn())
vi.mock('../../ciclo-de-vida/ciclo-de-vida.repository.js', () => ({ CicloDeVidaRepository: class { revogarDeQuemSaiu = revogar } }))
const convidar = vi.mocked(convidarProfessorDaPlanilha)

const CABECALHO = 'turma;disciplina;professor;email;dia;inicio;fim;sala'
const SEM_MARCAS: MarcasDaPlanilha = { transferir: [], desligar: [], encerrar: [] }
const TX = {} as unknown as DatabaseTransaction
const ANO: AnoDeDestino = { id: 'ano-1', inicio: '2026-02-01', fim: '2026-12-15', situacao: 'em_curso' }

interface Dados {
  turmas?: readonly TurmaDoAno[]
  disciplinas?: ReadonlyArray<{ id: string; nome: string }>
  professores?: readonly ProfessorDaEscola[]
  vinculos?: ReadonlyArray<{ id: string; usuarioId: string; turmaId: string; disciplinaId: string | null; estado: EstadoDeVinculo; origem?: OrigemDeVinculo }>
  aulas?: readonly AulaGravada[]
}

/** Só o que o tipo lê do repositório; a escrita e as travas são das integrações do worker. */
function repositorioCom(dados: Dados = {}): ImportacaoRepository {
  return {
    turmasDoAno: () => Promise.resolve([...(dados.turmas ?? [])]),
    disciplinasDaEscola: () => Promise.resolve([...(dados.disciplinas ?? [])]),
    professoresDaEscola: () => Promise.resolve([...(dados.professores ?? [])]),
    vinculosDeProfessorDoAno: () => Promise.resolve((dados.vinculos ?? []).map((vinculo) => ({ ...vinculo, origem: vinculo.origem ?? ('coordenacao' as const) }))),
    aulasDoAno: () => Promise.resolve([...(dados.aulas ?? [])]),
  } as unknown as ImportacaoRepository
}

const turma = (id: string, nome: string, chave: string | null): TurmaDoAno => ({ id, nome, chave, serie: { id: `serie-${id}`, etapa: 'ef_anos_finais', ano: 8 } })
const professor = (usuarioId: string, email: string | null, estado: EstadoDoProfessor): ProfessorDaEscola => ({ usuarioId, nome: `Professor ${usuarioId}`, email, estado })
const linha = (turmaNome: string, dia: string, inicio: string, fim: string, extras: { disciplina?: string; professor?: string; email?: string; sala?: string } = {}): string =>
  [turmaNome, extras.disciplina ?? 'Química', extras.professor ?? 'Ana Souza', extras.email ?? 'ana@escola.invalid', dia, inicio, fim, extras.sala ?? ''].join(';')
const previa = (linhas: string[], dados: Dados = {}) => tipoGrade.previa(repositorioCom(dados), ANO, [CABECALHO, ...linhas].join('\n'))

const T8A = turma('t-8a', '8º A', '8a')
const T8B = turma('t-8b', '8º B', '8b')
const QUIMICA = { id: 'd-quimica', nome: 'Química' }
const ANA = professor('u-ana', 'ana@escola.invalid', 'ativo')

/** O repositório de escrita falso do `aplicar`: registra a ordem das chamadas; `apagadasAMenos` e `encerradosAMenos` simulam a diferença que o passo (3) acha. */
function gravacaoFalsa(apagadasAMenos = 0, encerradosAMenos = 0) {
  const chamadas: string[] = []
  const gravacao = {
    seriesDaEscola: () => Promise.resolve([]),
    criarSerie: () => Promise.resolve('serie-nova'),
    criarTurma: (_ano: string, { nome }: { nome: string }) => Promise.resolve(`turma-${nome}`),
    criarDisciplina: (nome: string) => Promise.resolve(`disciplina-${nome}`),
    professoresDaEscola: () => Promise.resolve([professor('u-novo', 'ana@escola.invalid', 'pendente')]),
    criarVinculosDeProfessorDaGrade: (_ano: string, novos: ReadonlyArray<{ usuarioId: string; turmaId: string; disciplinaId: string }>) => {
      chamadas.push(`vinculos:${String(novos.length)}`)
      return Promise.resolve(novos.map(({ usuarioId, turmaId, disciplinaId }, posicao) => ({ id: `v-${String(posicao)}`, usuarioId, turmaId, disciplinaId })))
    },
    apagarAulas: (_ano: string, ids: readonly string[]) => {
      chamadas.push(`apagadas:${ids.join(',')}`)
      return Promise.resolve(ids.length - apagadasAMenos)
    },
    gravarAulas: (_ano: string, aulas: readonly unknown[]) => {
      chamadas.push(`aulas:${String(aulas.length)}`)
      return Promise.resolve(aulas.length)
    },
    encerrarVinculosDeProfessorDaGrade: (_ano: string, ids: readonly string[], motivo: string) => {
      chamadas.push(`encerrados:${ids.join(',')}:${motivo}`)
      return Promise.resolve(ids.slice(0, ids.length - encerradosAMenos).map((id) => ({ id, usuarioId: `u-de-${id}`, turmaId: `t-de-${id}`, estadoAntes: 'confirmado' as const })))
    },
  }
  const ambiente = { tx: { insert: vi.fn() }, ciclo: {} } as unknown as AmbienteDaGravacao
  return { gravacao: gravacao as unknown as ImportacaoRepository, ambiente, chamadas }
}

describe('tipoGrade.previa', () => {
  it('escola vazia: toda linha é "novo", e a prévia conta o que nasce ao gravar', async () => {
    const lida = await previa([linha('8º A', '2', '8:00', '8:50'), linha('8A', 'segunda', '09:00', '09:50', { disciplina: 'QUIMICA' }), linha('8º B', '3', '8:00', '8:50', { professor: 'Bruno', email: 'BRUNO@escola.invalid' })])
    expect(lida.linhas.map(({ linha: numero, resultado }) => [numero, resultado])).toEqual([[2, 'novo'], [3, 'novo'], [4, 'novo']])
    expect(lida.contagens).toEqual({ aulas: 3, ja_existem: 0, turmas_novas: 2, disciplinas_novas: 1, professores_novos: 2, vinculos_criados: 2 })
    expect(lida.candidatos).toEqual([])
    expect(() => previaDaPlanilhaResponseSchema.parse({ linhas: lida.linhas, contagens: lida.contagens, candidatos: lida.candidatos })).not.toThrow()
  })

  it('o e-mail do banco nunca vai à resposta, e o que se guarda é a aula lida: e-mail em minúsculas, nome sem espaço a mais, dia e horário normalizados', async () => {
    const lida = await previa([`8º A;  Química ; Ana   Souza ; ANA@Escola.invalid ;Terça-feira;8h50;09:40:00;  Lab  2 `], { professores: [professor('u-1', 'ana@escola.invalid', 'ativo')] })
    expect(lida.guardado).toEqual([{ linha: 2, turma: '8º A', disciplina: 'Química', nome: 'Ana Souza', email: 'ana@escola.invalid', dia: 2, inicio: '08:50', fim: '09:40', sala: 'Lab 2' }])
    expect(JSON.stringify([lida.linhas, lida.contagens, lida.candidatos])).not.toMatch(/ana|escola\.invalid|Souza/i)
  })

  it('aceita o dia pelo número ou pelo nome, e o horário em quatro grafias', async () => {
    const dias = ['1', 'seg', 'Segunda-feira', 'ter', 'terça', '3', 'qua', 'quinta', 'sex', 'sábado', '7', 'domingo']
    const lida = await previa(dias.map((dia, posicao) => linha('8A', dia, `${String(6 + posicao)}:00`, `${String(6 + posicao)}:50`)))
    expect((lida.guardado as Array<{ dia: number }>).map(({ dia }) => dia)).toEqual([1, 1, 1, 2, 2, 3, 3, 4, 5, 6, 7, 7])
    const horarios = await previa([linha('8A', '1', '8:05', '08:55'), linha('8A', '1', '9h', '9h50'), linha('8A', '1', '10:00:00', '10:50:00')])
    expect((horarios.guardado as Array<{ inicio: string; fim: string }>).map(({ inicio, fim }) => `${inicio}-${fim}`)).toEqual(['08:05-08:55', '09:00-09:50', '10:00-10:50'])
  })

  it('caractere de controle na turma, na disciplina, no nome ou na sala é erro da linha, com o código de cada campo', async () => {
    const lida = await previa([
      linha('8\u0007A', '1', '8:00', '8:50'),
      linha('8A', '1', '8:00', '8:50', { disciplina: 'Quí\u0007mica' }),
      linha('8A', '1', '8:00', '8:50', { professor: 'Ana\u0007 Souza' }),
      linha('8A', '1', '8:00', '8:50', { sala: 'Sala\u0007 1' }),
    ])
    expect(lida.linhas.map(({ linha: numero, resultado, erro }) => [numero, resultado, erro])).toEqual([
      [2, 'erro', 'turma_invalida'],
      [3, 'erro', 'disciplina_invalida'],
      [4, 'erro', 'nome_invalido'],
      [5, 'erro', 'sala_longa'],
    ])
  })

  it('dois professores com o mesmo nome e e-mails diferentes são duas pessoas e dois vínculos: o professor se identifica pelo e-mail', async () => {
    const lida = await previa([
      linha('8A', '1', '8:00', '8:50', { professor: 'Ana Souza', email: 'ana.um@escola.invalid' }),
      linha('8A', '1', '9:00', '9:50', { professor: 'Ana Souza', email: 'ana.dois@escola.invalid' }),
    ], { turmas: [T8A], disciplinas: [QUIMICA] })
    expect(lida.linhas.map(({ resultado }) => resultado)).toEqual(['novo', 'novo'])
    expect(lida.contagens).toMatchObject({ professores_novos: 2, vinculos_criados: 2, aulas: 2 })
  })

  it('aponta o primeiro erro de cada linha com o código, na ordem em que a coordenação corrige, e só as que passam da leitura do texto vão para o que se guarda', async () => {
    const lida = await previa([
      linha('', '1', '8:00', '8:50'),
      linha('Turma Azul', '1', '8:00', '8:50'),
      linha('8A', '1', '8:00', '8:50', { disciplina: '' }),
      linha('8A', '1', '8:00', '8:50', { professor: '', email: '' }),
      linha('8A', '1', '8:00', '8:50', { professor: '', email: 'a@escola.invalid' }),
      linha('8A', '1', '8:00', '8:50', { professor: 'x'.repeat(201) }),
      linha('8A', '1', '8:00', '8:50', { email: 'sem-arroba' }),
      linha('8A', '1', '8:00', '8:50', { professor: 'Ana', email: '' }),
      linha('8A', 'feriado', '8:00', '8:50'),
      linha('8A', '8', '8:00', '8:50'),
      linha('8A', '1', '25:00', '8:50'),
      linha('8A', '1', 'cedo', '8:50'),
      linha('8A', '1', '9:00', '8:00'),
      linha('8A', '1', '9:00', '9:00'),
      linha('8A', '1', '8:00', '8:50', { sala: 'x'.repeat(41) }),
      '8A;Química;Ana',
      linha('8A', '1', '8:00', '8:50', { disciplina: 'y'.repeat(81) }),
      linha('8A', '1', '8:00', '8:50'),
      linha('8A'.padEnd(41, 'x'), '1', '8:00', '8:50'),
      linha('8A', '1', '8:60', '9:00'),
    ])
    expect(lida.linhas.map(({ linha: numero, resultado, erro }) => [numero, resultado, erro])).toEqual([
      [2, 'erro', 'turma_vazia'],
      [3, 'erro', 'turma_invalida'],
      [4, 'erro', 'disciplina_vazia'],
      [5, 'erro', 'sem_professor'],
      [6, 'erro', 'nome_vazio'],
      [7, 'erro', 'nome_invalido'],
      [8, 'erro', 'email_invalido'],
      [9, 'erro', 'email_invalido'],
      [10, 'erro', 'dia_invalido'],
      [11, 'erro', 'dia_invalido'],
      [12, 'erro', 'horario_invalido'],
      [13, 'erro', 'horario_invalido'],
      [14, 'erro', 'fim_antes_do_inicio'],
      [15, 'erro', 'fim_antes_do_inicio'],
      [16, 'erro', 'sala_longa'],
      [17, 'erro', 'linha_incompleta'],
      [18, 'erro', 'disciplina_invalida'],
      [19, 'novo', undefined],
      [20, 'erro', 'turma_invalida'],
      [21, 'erro', 'horario_invalido'],
    ])
    // Guarda o que passou da leitura do texto (a "Turma Azul" é erro do banco, e o gravar a recusa pelo erro); a linha com erro de texto não vai.
    expect((lida.guardado as Array<{ linha: number }>).map(({ linha: numero }) => numero)).toEqual([3, 19])
  })

  it('a turma sem série no nome é erro, e a de série fora do recorte também ("4A"); a turma de mesma chave duas vezes na escola é ambígua', async () => {
    const lida = await previa([linha('4A', '1', '8:00', '8:50'), linha('8º A', '1', '8:00', '8:50')], { turmas: [turma('t-1', '8A', null), turma('t-2', '8º A', null)] })
    expect(lida.linhas.map(({ erro }) => erro)).toEqual(['turma_invalida', 'turma_ambigua'])
  })

  it('professor em duas turmas no mesmo horário: aviso nas duas linhas, e a aula entra; terminar às 9h e começar às 9h não é o mesmo horário', async () => {
    const banco = { turmas: [T8A, T8B], disciplinas: [QUIMICA], professores: [ANA] }
    const lida = await previa([linha('8A', '1', '8:00', '8:50'), linha('8B', '1', '8:30', '9:20'), linha('8B', '1', '9:20', '10:10'), linha('8B', '2', '8:00', '8:50')], banco)
    expect(lida.linhas.map(({ resultado, aviso }) => [resultado, aviso])).toEqual([
      ['entra', 'professor_em_duas_turmas'],
      ['entra', 'professor_em_duas_turmas'],
      ['entra', undefined],
      ['entra', undefined],
    ])
  })

  it('turma com duas aulas no mesmo horário: aviso nas duas linhas, e o aviso do professor vem antes', async () => {
    const banco = { turmas: [T8A, T8B], disciplinas: [QUIMICA, { id: 'd-hist', nome: 'História' }], professores: [ANA, professor('u-bia', 'bia@escola.invalid', 'ativo')] }
    const lida = await previa(
      [
        linha('8A', '1', '8:00', '8:50'),
        linha('8A', '1', '8:00', '8:50', { disciplina: 'História', professor: 'Bia', email: 'bia@escola.invalid' }),
        linha('8B', '1', '8:20', '9:00', { disciplina: 'História', professor: 'Bia', email: 'bia@escola.invalid' }),
      ],
      banco,
    )
    expect(lida.linhas.map(({ aviso }) => aviso)).toEqual(['turma_com_duas_aulas', 'professor_em_duas_turmas', 'professor_em_duas_turmas'])
  })

  it('a mesma aula duas vezes (mesmo professor, turma e disciplina, no mesmo dia e início) é erro na segunda', async () => {
    const lida = await previa([linha('8A', '1', '8:00', '8:50'), linha('8A', '1', '8:00', '9:30')], { turmas: [T8A], disciplinas: [QUIMICA], professores: [ANA] })
    expect(lida.linhas.map(({ resultado, erro }) => [resultado, erro])).toEqual([['entra', undefined], ['erro', 'aula_repetida']])
    // A mesma tripla no mesmo dia, em outro horário, é outra aula.
    const outroHorario = await previa([linha('8A', '1', '8:00', '8:50'), linha('8A', '1', '9:00', '9:50')], { turmas: [T8A], disciplinas: [QUIMICA], professores: [ANA] })
    expect(outroHorario.linhas.map(({ resultado, erro }) => [resultado, erro])).toEqual([['entra', undefined], ['entra', undefined]])
  })

  it('a turma, a disciplina e o professor que nascem levam o nome da primeira linha que os pediu, também quando a mesma coisa vem escrita de outro jeito mais adiante', async () => {
    const linhas = [
      linha('8º C', '1', '8:00', '8:50', { disciplina: 'Física', professor: 'Ana Souza' }),
      linha('8C', '2', '8:00', '8:50', { disciplina: 'fisica', professor: 'Ana S.' }),
    ]
    const nenhum = { turmas: [], disciplinas: [], professores: [], vinculos: [], aulas: [] }
    const nomes = async (guardadas: string[]) => {
      const { turmasNovas, disciplinasNovas, professoresNovos } = classificar('ano-1', (await previa(guardadas)).guardado as Parameters<typeof classificar>[1], nenhum)
      return [turmasNovas.map(({ nome }) => nome), disciplinasNovas.map(({ nome }) => nome), professoresNovos.map(({ nome }) => nome)]
    }
    const daPrimeira = await nomes([linhas[0] ?? ''])
    const daSegunda = await nomes([linhas[1] ?? ''])
    expect(daSegunda).not.toEqual(daPrimeira)
    expect(await nomes(linhas)).toEqual(daPrimeira)
  })

  it('o professor da escola é o do e-mail: ativo, aceito e com convite em aberto recebem o vínculo; revogado e desativado voltam "novo"; vencido é erro; e-mail sem conta na escola é "novo"', async () => {
    const banco = {
      turmas: [T8A],
      disciplinas: [QUIMICA],
      professores: [professor('u-1', 'ativo@escola.invalid', 'ativo'), professor('u-2', 'aceito@escola.invalid', 'aceito'), professor('u-3', 'pendente@escola.invalid', 'pendente'), professor('u-4', 'revogado@escola.invalid', 'revogado'), professor('u-5', 'desativado@escola.invalid', 'desativado'), professor('u-6', 'vencido@escola.invalid', 'vencido'), professor('u-7', null, 'ativo')],
    }
    const emails = ['ativo', 'aceito', 'pendente', 'revogado', 'desativado', 'vencido', 'de-fora']
    const lida = await previa(emails.map((email, posicao) => linha('8A', '1', `${String(6 + posicao)}:00`, `${String(6 + posicao)}:50`, { email: `${email}@escola.invalid` })), banco)
    expect(lida.linhas.map(({ resultado, erro }) => [resultado, erro])).toEqual([
      ['entra', undefined],
      ['entra', undefined],
      ['entra', undefined],
      ['novo', undefined],
      ['novo', undefined],
      ['erro', 'professor_com_convite_vencido'],
      ['novo', undefined],
    ])
    expect(lida.contagens).toMatchObject({ professores_novos: 3 })
  })

  it('o vínculo aberto da tripla é reaproveitado, em qualquer estado: a aula igual "já existe", a com outro fim ou sala "entra", e só a tripla sem vínculo conta como vínculo novo', async () => {
    const banco = {
      turmas: [T8A, T8B],
      disciplinas: [QUIMICA],
      professores: [ANA],
      vinculos: [
        { id: 'v-conf', usuarioId: 'u-ana', turmaId: 't-8a', disciplinaId: 'd-quimica', estado: 'confirmado' as const },
        { id: 'v-contestado', usuarioId: 'u-ana', turmaId: 't-8b', disciplinaId: 'd-quimica', estado: 'contestado' as const },
      ],
      aulas: [{ id: 'a-1', vinculoId: 'v-conf', diaSemana: 1, inicio: '08:00', fim: '08:50', sala: null }],
    }
    const lida = await previa([linha('8A', '1', '8:00', '8:50'), linha('8A', '1', '8:00', '9:30'), linha('8A', '2', '8:00', '8:50', { sala: 'Lab' }), linha('8B', '1', '10:00', '10:50')], banco)
    expect(lida.linhas.map(({ resultado }) => resultado)).toEqual(['ja_existe', 'erro', 'entra', 'entra'])
    const alterada = await previa([linha('8A', '1', '8:00', '9:30'), linha('8A', '1', '8:00', '8:50', { sala: 'Lab' })], banco)
    expect(alterada.linhas.map(({ resultado }) => resultado)).toEqual(['entra', 'erro'])
    expect(lida.contagens).toEqual({ aulas: 2, ja_existem: 1, turmas_novas: 0, disciplinas_novas: 0, professores_novos: 0, vinculos_criados: 0 })
  })

  it('a aula igual no fim e diferente só na sala "entra": a sala também é o que a planilha muda', async () => {
    const banco = {
      turmas: [T8A],
      disciplinas: [QUIMICA],
      professores: [ANA],
      vinculos: [{ id: 'v-conf', usuarioId: 'u-ana', turmaId: 't-8a', disciplinaId: 'd-quimica', estado: 'confirmado' as const }],
      aulas: [{ id: 'a-1', vinculoId: 'v-conf', diaSemana: 1, inicio: '08:00', fim: '08:50', sala: 'Sala 1' }],
    }
    const outraSala = await previa([linha('8A', '1', '8:00', '8:50', { sala: 'Sala 2' })], banco)
    expect(outraSala.linhas.map(({ resultado }) => resultado)).toEqual(['entra'])
    const mesmaSala = await previa([linha('8A', '1', '8:00', '8:50', { sala: 'Sala 1' })], banco)
    expect(mesmaSala.linhas.map(({ resultado }) => resultado)).toEqual(['ja_existe'])
  })

  it('a disciplina que a escola não tem, sozinha, faz a linha "novo" e pede um vínculo; turma e professor da escola não contam', async () => {
    const lida = await previa([linha('8A', '1', '8:00', '8:50', { disciplina: 'Física' })], { turmas: [T8A], disciplinas: [QUIMICA], professores: [ANA] })
    expect(lida.linhas.map(({ resultado }) => resultado)).toEqual(['novo'])
    expect(lida.contagens).toEqual({ aulas: 1, ja_existem: 0, turmas_novas: 0, disciplinas_novas: 1, professores_novos: 0, vinculos_criados: 1 })
  })

  it('o mesmo professor em duas disciplinas da mesma turma no mesmo horário avisa só da turma: não é professor em duas turmas', async () => {
    const lida = await previa([linha('8A', '1', '8:00', '8:50'), linha('8A', '1', '8:00', '8:50', { disciplina: 'Física' })], { turmas: [T8A], disciplinas: [QUIMICA, { id: 'd-fisica', nome: 'Física' }], professores: [ANA] })
    expect(lida.linhas.map(({ aviso }) => aviso)).toEqual(['turma_com_duas_aulas', 'turma_com_duas_aulas'])
  })

  it('o professor chamado de volta (revogado ou desativado) que ainda tem vínculo aberto o mantém: a aula vai nele, e nenhum vínculo nasce', async () => {
    const banco = {
      turmas: [T8A],
      disciplinas: [QUIMICA],
      vinculos: [{ id: 'v-1', usuarioId: 'u-ana', turmaId: 't-8a', disciplinaId: 'd-quimica', estado: 'pendente' as const }],
    }
    for (const estado of ['revogado', 'desativado'] as const) {
      const lida = await previa([linha('8A', '1', '8:00', '8:50')], { ...banco, professores: [professor('u-ana', 'ana@escola.invalid', estado)] })
      expect(lida.contagens, estado).toMatchObject({ aulas: 1, professores_novos: 1, vinculos_criados: 0 })
    }
  })

  it('a tripla que só tem vínculo encerrado, que a leitura não traz, ganha um vínculo pendente', async () => {
    const lida = await previa([linha('8A', '1', '8:00', '8:50')], { turmas: [T8A], disciplinas: [QUIMICA], professores: [ANA], vinculos: [] })
    expect(lida.contagens).toMatchObject({ aulas: 1, vinculos_criados: 1, turmas_novas: 0 })
  })

  it('"Química" e "quimica" são a mesma disciplina da escola, e duas da escola com a mesma chave deixam a linha ambígua', async () => {
    const banco = { turmas: [T8A], professores: [ANA] }
    const mesma = await previa([linha('8A', '1', '8:00', '8:50', { disciplina: 'quimica' })], { ...banco, disciplinas: [QUIMICA] })
    expect(mesma.contagens).toMatchObject({ disciplinas_novas: 0 })
    const ambigua = await previa([linha('8A', '1', '8:00', '8:50', { disciplina: 'quimica' })], { ...banco, disciplinas: [QUIMICA, { id: 'd-2', nome: 'Quimica' }] })
    expect(ambigua.linhas[0]).toEqual({ linha: 2, resultado: 'erro', erro: 'disciplina_ambigua' })
  })

  it('a assinatura muda com o que a coordenação viu: o estado do professor, o vínculo e a aula gravada', async () => {
    const aula = [linha('8A', '1', '8:00', '8:50')]
    const base = { turmas: [T8A], disciplinas: [QUIMICA], professores: [ANA] }
    const conferida = (await previa(aula, base)).assinatura
    expect((await previa(aula, base)).assinatura).toBe(conferida)
    expect((await previa(aula, { ...base, professores: [professor('u-ana', 'ana@escola.invalid', 'desativado')] })).assinatura).not.toBe(conferida)
    const pendente = { id: 'v-1', usuarioId: 'u-ana', turmaId: 't-8a', disciplinaId: 'd-quimica', estado: 'pendente' as const }
    const comVinculo = { ...base, vinculos: [pendente] }
    expect((await previa(aula, comVinculo)).assinatura).not.toBe(conferida)
    expect((await previa(aula, { ...comVinculo, vinculos: [{ ...pendente, estado: 'confirmado' as const }] })).assinatura).not.toBe((await previa(aula, comVinculo)).assinatura)
    expect((await previa(aula, { ...comVinculo, aulas: [{ id: 'a-1', vinculoId: 'v-1', diaSemana: 1, inicio: '08:00', fim: '08:50', sala: null }] })).assinatura).not.toBe((await previa(aula, comVinculo)).assinatura)
  })

  it('a assinatura muda quando só o estado do professor, a aula gravada, a turma ou a disciplina mudam, e a linha segue com o mesmo resultado', async () => {
    const aula = [linha('8A', '1', '8:00', '9:00')]
    const vinculo = { id: 'v-1', usuarioId: 'u-ana', turmaId: 't-8a', disciplinaId: 'd-quimica', estado: 'pendente' as const }
    const vinculos = [vinculo]
    const base = { turmas: [T8A], disciplinas: [QUIMICA], professores: [ANA], vinculos, aulas: [{ id: 'a-1', vinculoId: 'v-1', diaSemana: 1, inicio: '08:00', fim: '08:50', sala: 'Sala 1' }] }
    const conferida = await previa(aula, base)
    expect(conferida.linhas.map(({ resultado }) => resultado)).toEqual(['entra'])
    const mudadas = [
      { ...base, professores: [professor('u-ana', 'ana@escola.invalid', 'aceito')] },
      { ...base, aulas: [{ id: 'a-1', vinculoId: 'v-1', diaSemana: 1, inicio: '08:00', fim: '08:40', sala: 'Sala 1' }] },
      { ...base, aulas: [{ id: 'a-1', vinculoId: 'v-1', diaSemana: 1, inicio: '08:00', fim: '08:50', sala: 'Sala 9' }] },
      { ...base, turmas: [turma('t-8a-outra', '8º A', '8a')], vinculos: [{ ...vinculo, turmaId: 't-8a-outra' }] },
      { ...base, disciplinas: [{ id: 'd-outra', nome: 'Química' }], vinculos: [{ ...vinculo, disciplinaId: 'd-outra' }] },
    ]
    for (const [posicao, mudada] of mudadas.entries()) {
      const lida = await previa(aula, mudada)
      expect(lida.linhas.map(({ resultado }) => resultado), String(posicao)).toEqual(['entra'])
      expect(lida.assinatura, String(posicao)).not.toBe(conferida.assinatura)
    }
  })

  it('cabeçalho que não é o da grade responde ENTRADA_INVALIDA', async () => {
    await expect(tipoGrade.previa(repositorioCom(), ANO, 'turma;nome;matricula\n8A;Ana;1')).rejects.toMatchObject({ codigo: 'ENTRADA_INVALIDA' })
  })
})

describe('tipoGrade.emailsDasContas', () => {
  it('só os professores que a escola ainda não tem, ou chama de volta, e uma vez cada um', async () => {
    const guardado = [
      ...['ativo', 'revogado', 'desativado', 'de-fora', 'de-fora'].map((email, posicao) => ({ linha: posicao + 2, turma: '8A', disciplina: 'Química', nome: 'Fulana', email: `${email}@escola.invalid`, dia: 1, inicio: '08:00', fim: '08:50', sala: null })),
    ]
    const banco = { professores: [professor('u-1', 'ativo@escola.invalid', 'ativo'), professor('u-2', 'revogado@escola.invalid', 'revogado'), professor('u-3', 'desativado@escola.invalid', 'desativado')] }
    expect(await tipoGrade.emailsDasContas?.(repositorioCom(banco), guardado)).toEqual(['revogado@escola.invalid', 'desativado@escola.invalid', 'de-fora@escola.invalid'])
    expect(await tipoGrade.emailsDasContas?.(repositorioCom(banco), [{ lixo: true }])).toBeUndefined()
  })
})

describe('tipoGrade.planejar e travar', () => {
  const guardadoDe = async (linhas: string[], dados: Dados = {}) => (await previa(linhas, dados)).guardado

  beforeEach(() => {
    convidar.mockReset()
    auditar.mockReset()
    revogar.mockReset()
  })

  it('o que o gravar guardou sem a forma da grade: sem plano e sem trava', async () => {
    expect(await tipoGrade.planejar(repositorioCom(), ANO, [{ lixo: true }], SEM_MARCAS)).toBeUndefined()
    const travar = vi.fn()
    await tipoGrade.travar?.({ travarUsuarios: travar, travarTurmas: travar } as unknown as ImportacaoRepository, ANO, [{ lixo: true }], SEM_MARCAS, { contas: new Map(), travarContas: () => Promise.resolve(true) }, TX)
    expect(travar).not.toHaveBeenCalled()
  })

  it('a trava trava os professores que as linhas citam, as contas e as turmas que elas tocam, nessa ordem, e só chama a trava das contas quando há conta', async () => {
    const ordem: string[] = []
    const banco = { turmas: [T8A, T8B, turma('t-9a', '9º A', '9a')], professores: [ANA, professor('u-bia', 'bia@escola.invalid', 'ativo')] }
    const repositorio = {
      ...repositorioCom(banco),
      travarUsuarios: (ids: readonly string[]) => Promise.resolve(void ordem.push(`usuarios:${ids.join(',')}`)),
      travarTurmas: (_ano: string, ids: readonly string[]) => Promise.resolve(void ordem.push(`turmas:${ids.join(',')}`)),
    } as unknown as ImportacaoRepository
    const guardado = await guardadoDe([linha('8B', '1', '8:00', '8:50'), linha('8º A', '2', '8:00', '8:50'), linha('7A', '2', '9:00', '9:50', { professor: 'Nova', email: 'nova@escola.invalid' })], banco)
    const travarContas = vi.fn(() => {
      ordem.push('contas')
      return Promise.resolve(true)
    })
    await tipoGrade.travar?.(repositorio, ANO, guardado, SEM_MARCAS, { contas: new Map([['nova@escola.invalid', 'c-1']]), travarContas }, TX)
    expect(ordem).toEqual(['usuarios:u-ana', 'contas', 'turmas:t-8a,t-8b'])
    ordem.length = 0
    await tipoGrade.travar?.(repositorio, ANO, guardado, SEM_MARCAS, { contas: new Map(), travarContas }, TX)
    expect(ordem).toEqual(['usuarios:u-ana', 'turmas:t-8a,t-8b'])
  })

  it('conta que perdeu o e-mail entre o passo (1) e o (3): ContaDaPlanilhaPerdidaError, antes de travar as turmas', async () => {
    const travarTurmas = vi.fn()
    const repositorio = { ...repositorioCom(), travarUsuarios: vi.fn(), travarTurmas } as unknown as ImportacaoRepository
    const guardado = await guardadoDe([linha('8A', '1', '8:00', '8:50')])
    await expect(tipoGrade.travar?.(repositorio, ANO, guardado, SEM_MARCAS, { contas: new Map([['ana@escola.invalid', 'c-1']]), travarContas: () => Promise.resolve(false) }, TX)).rejects.toBeInstanceOf(ContaDaPlanilhaPerdidaError)
    expect(travarTurmas).not.toHaveBeenCalled()
  })

  it('professor novo sem a conta do passo (1): ContaDaPlanilhaPerdidaError; convite que não se faz: DiferencaNaPlanilhaError', async () => {
    const guardado = await guardadoDe([linha('8A', '1', '8:00', '8:50')])
    const { gravacao, ambiente } = gravacaoFalsa()
    const plano = await tipoGrade.planejar(repositorioCom(), ANO, guardado, SEM_MARCAS, new Map())
    await expect(plano?.aplicar(gravacao, ambiente)).rejects.toBeInstanceOf(ContaDaPlanilhaPerdidaError)
    const comConta = await tipoGrade.planejar(repositorioCom(), ANO, guardado, SEM_MARCAS, new Map([['ana@escola.invalid', 'c-1']]))
    convidar.mockResolvedValue(false)
    await expect(comConta?.aplicar(gravacao, ambiente)).rejects.toBeInstanceOf(DiferencaNaPlanilhaError)
  })

  it('o plano chama o professor novo pelo convite da planilha, com a conta e o nome da primeira linha dele', async () => {
    const guardado = await guardadoDe([linha('8A', '1', '8:00', '8:50'), linha('8A', '2', '8:00', '8:50', { professor: 'Ana Outra Grafia' })])
    const plano = await tipoGrade.planejar(repositorioCom(), ANO, guardado, SEM_MARCAS, new Map([['ana@escola.invalid', 'c-1']]))
    expect(plano?.resumo).toEqual({ aulas: 2, ja_existem: 0, turmas_novas: 1, disciplinas_novas: 1, professores_novos: 1, vinculos_criados: 1 })
    convidar.mockResolvedValue(true)
    const { gravacao, ambiente, chamadas } = gravacaoFalsa()
    await plano?.aplicar(gravacao, ambiente)
    expect(convidar).toHaveBeenCalledOnce()
    expect(convidar).toHaveBeenCalledWith(expect.anything(), { contaId: 'c-1', nome: 'Ana Souza' })
    expect(chamadas).toEqual(['vinculos:1', 'apagadas:', 'aulas:2', 'encerrados::realocacao'])
    expect(auditar.mock.calls.map(([, acao]) => acao)).toEqual(['turma.criada', 'vinculo.criado'])
    expect(auditar.mock.calls[1]?.[2]).toMatchObject({ depois: { papel: 'professor', estado: 'pendente', origem: 'grade', disciplinaId: 'disciplina-Química' } })
  })
})

describe('tipoGrade, reimportar substitui a grade do ano (12.0, RF9)', () => {
  const vinculo = (id: string, extras: { turmaId?: string; usuarioId?: string; origem?: OrigemDeVinculo; estado?: EstadoDeVinculo } = {}) => ({
    id,
    usuarioId: extras.usuarioId ?? 'u-ana',
    turmaId: extras.turmaId ?? 't-8a',
    disciplinaId: 'd-quimica',
    estado: extras.estado ?? ('confirmado' as const),
    origem: extras.origem ?? ('coordenacao' as const),
  })
  const aulaGravada = (id: string, vinculoId: string, inicio: string, fim: string): AulaGravada => ({ id, vinculoId, diaSemana: 1, inicio, fim, sala: null })
  /** A escola com a Ana na 8ºA e no 8ºB, sem nenhuma aula da planilha: o que cada vínculo e cada aula faria se a planilha não os trouxesse. */
  const escola = (vinculos: NonNullable<Dados['vinculos']>, aulas: NonNullable<Dados['aulas']> = []): Dados => ({ turmas: [T8A, T8B], disciplinas: [QUIMICA], professores: [ANA], vinculos, aulas })
  const daAna8A = linha('8A', '1', '8:00', '8:50')

  beforeEach(() => {
    convidar.mockReset()
    auditar.mockReset()
    revogar.mockReset()
  })

  it('a aula gravada que nenhuma linha traz sai do ano, e a que a linha confirma ou muda fica: a prévia conta só as que saem', async () => {
    const dados = escola([vinculo('v-1')], [aulaGravada('a-fica', 'v-1', '08:00', '08:50'), aulaGravada('a-muda', 'v-1', '09:00', '09:50'), aulaGravada('a-sai', 'v-1', '10:00', '10:50')])
    const lida = await previa([daAna8A, linha('8A', '1', '9:00', '9:30')], dados)
    expect(lida.linhas.map(({ resultado }) => resultado)).toEqual(['ja_existe', 'entra'])
    expect(lida.contagens).toEqual({ aulas: 1, ja_existem: 1, turmas_novas: 0, disciplinas_novas: 0, professores_novos: 0, vinculos_criados: 0, aulas_removidas: 1 })
    const plano = await tipoGrade.planejar(repositorioCom(dados), ANO, lida.guardado, SEM_MARCAS)
    const { gravacao, ambiente, chamadas } = gravacaoFalsa()
    await plano?.aplicar(gravacao, ambiente)
    expect(chamadas).toEqual(['vinculos:0', 'apagadas:a-sai', 'aulas:1', 'encerrados::realocacao'])
  })

  it('o vínculo que perdeu todas as aulas é candidato "sai da grade", com o rótulo de professor, turma e disciplina; o citado por alguma linha não é', async () => {
    const id8b = randomUUID()
    const dados = escola([vinculo('v-8a'), vinculo(id8b, { turmaId: 't-8b' })], [aulaGravada('a-8a', 'v-8a', '08:00', '08:50'), aulaGravada('a-8b', id8b, '08:00', '08:50')])
    const lida = await previa([daAna8A], dados)
    expect(lida.candidatos).toEqual([{ id: id8b, acao: 'encerrar', rotulo: 'Professor u-ana · 8º B · Química' }])
    expect(lida.contagens).toMatchObject({ aulas_removidas: 1 })
    expect(() => previaDaPlanilhaResponseSchema.parse({ linhas: lida.linhas, contagens: lida.contagens, candidatos: lida.candidatos })).not.toThrow()
  })

  it('o vínculo da grade sem aula é candidato; o feito à mão sem aula fica e não é; o feito à mão que tinha aula é candidato', async () => {
    const dados = escola(
      [vinculo('v-grade', { turmaId: 't-8b', origem: 'grade', estado: 'pendente' }), vinculo('v-mao', { turmaId: 't-8b', origem: 'coordenacao' }), vinculo('v-lista', { turmaId: 't-8b', origem: 'lista' }), vinculo('v-mao-com-aula', { origem: 'coordenacao' })],
      [aulaGravada('a-1', 'v-mao-com-aula', '08:00', '08:50')],
    )
    const lida = await previa([linha('8A', '2', '8:00', '8:50', { disciplina: 'Química', professor: 'Bruno', email: 'bruno@escola.invalid' })], dados)
    expect(lida.candidatos.map(({ id }) => id).sort()).toEqual(['v-grade', 'v-mao-com-aula'])
    expect(lida.contagens).toMatchObject({ aulas_removidas: 1 })
  })

  it('planilha com erro de linha não oferece candidato nem conta aula que sai: ela não grava, e o aviso seria falso', async () => {
    const dados = escola([vinculo('v-8b', { turmaId: 't-8b', origem: 'grade' })], [aulaGravada('a-8b', 'v-8b', '08:00', '08:50')])
    const comErro = await previa([daAna8A, linha('8A', '1', '9:00', '8:00')], dados)
    expect(comErro.linhas.map(({ erro }) => erro)).toEqual([undefined, 'fim_antes_do_inicio'])
    expect(comErro.candidatos).toEqual([])
    expect(comErro.contagens).not.toHaveProperty('aulas_removidas')
    const semLeitura = await previa([daAna8A, '8A;Química'], dados)
    expect(semLeitura.candidatos).toEqual([])
    const semErro = await previa([daAna8A], dados)
    expect(semErro.candidatos.map(({ id }) => id)).toEqual(['v-8b'])
    // O erro da classificação (a mesma aula duas vezes), e não da leitura, também cala os candidatos e a contagem do que sai.
    const repetida = await previa([daAna8A, daAna8A], dados)
    expect(repetida.linhas.map(({ erro }) => erro)).toEqual([undefined, 'aula_repetida'])
    expect(repetida.candidatos).toEqual([])
    expect(repetida.contagens).not.toHaveProperty('aulas_removidas')
  })

  it('a assinatura muda quando entra ou sai uma aula do ano, ou um candidato, mesmo com as linhas iguais', async () => {
    const base = escola([vinculo('v-1'), vinculo('v-2', { turmaId: 't-8b', origem: 'grade' })], [aulaGravada('a-1', 'v-1', '08:00', '08:50')])
    const conferida = (await previa([daAna8A], base)).assinatura
    const maisUmaAula = { ...base, aulas: [...(base.aulas ?? []), aulaGravada('a-2', 'v-1', '11:00', '11:50')] }
    expect((await previa([daAna8A], maisUmaAula)).assinatura).not.toBe(conferida)
    const semOCandidato = { ...base, vinculos: [vinculo('v-1')] }
    expect((await previa([daAna8A], semOCandidato)).assinatura).not.toBe(conferida)
  })

  it('só o marcado encerra: o plano encerra os vínculos marcados por `realocacao`, grava `vinculo.encerrado` com a origem `grade` e revoga o acesso de quem saiu', async () => {
    const dados = escola([vinculo('v-8a'), vinculo('v-8b', { turmaId: 't-8b', usuarioId: 'u-bia' })], [aulaGravada('a-8a', 'v-8a', '08:00', '08:50')])
    const guardado = (await previa([daAna8A], dados)).guardado
    revogar.mockResolvedValue([{ id: 'acesso-1', turmaId: 't-de-v-8b' }])
    const semMarca = await tipoGrade.planejar(repositorioCom(dados), ANO, guardado, SEM_MARCAS)
    expect(semMarca?.resumo).not.toHaveProperty('vinculos_encerrados')
    const falsa = gravacaoFalsa()
    await semMarca?.aplicar(falsa.gravacao, falsa.ambiente)
    expect(falsa.chamadas).toContain('encerrados::realocacao')
    expect(revogar).not.toHaveBeenCalled()

    const comMarca = await tipoGrade.planejar(repositorioCom(dados), ANO, guardado, { ...SEM_MARCAS, encerrar: ['v-8b'] })
    expect(comMarca?.resumo).toMatchObject({ vinculos_encerrados: 1 })
    expect(comMarca?.assinatura).toBe(semMarca?.assinatura)
    const { gravacao, ambiente, chamadas } = gravacaoFalsa()
    auditar.mockReset()
    await comMarca?.aplicar(gravacao, ambiente)
    expect(chamadas).toEqual(['vinculos:0', 'apagadas:', 'aulas:0', 'encerrados:v-8b:realocacao'])
    expect(revogar).toHaveBeenCalledWith('u-de-v-8b', 't-de-v-8b')
    expect(auditar.mock.calls.map(([, acao, dados]) => [acao, dados])).toEqual([
      ['vinculo.encerrado', { entidadeId: 'v-8b', antes: { estado: 'confirmado' }, depois: { estado: 'encerrado', motivo: 'realocacao', origem: 'grade' } }],
      ['acesso_turma.revogado', { entidadeId: 'acesso-1', depois: { turmaId: 't-de-v-8b' } }],
    ])
  })

  it('vínculo marcado que já não está aberto, ou aula que já não existe: DiferencaNaPlanilhaError, e a importação sai `desatualizada`', async () => {
    const dados = escola([vinculo('v-8a'), vinculo('v-8b', { turmaId: 't-8b', origem: 'grade' })], [aulaGravada('a-8a', 'v-8a', '08:00', '08:50'), aulaGravada('a-8b', 'v-8b', '08:00', '08:50')])
    const guardado = (await previa([daAna8A], dados)).guardado
    const plano = await tipoGrade.planejar(repositorioCom(dados), ANO, guardado, { ...SEM_MARCAS, encerrar: ['v-8b'] })
    const semOVinculo = gravacaoFalsa(0, 1)
    await expect(plano?.aplicar(semOVinculo.gravacao, semOVinculo.ambiente)).rejects.toBeInstanceOf(DiferencaNaPlanilhaError)
    const semAAula = gravacaoFalsa(1, 0)
    await expect(plano?.aplicar(semAAula.gravacao, semAAula.ambiente)).rejects.toBeInstanceOf(DiferencaNaPlanilhaError)
    expect(revogar).not.toHaveBeenCalled()
  })

  it('a trava trava também o professor e a turma de cada vínculo marcado, e só os marcados, na mesma ordem: usuários, contas, turmas por id', async () => {
    const ordem: string[] = []
    const dados = escola([vinculo('v-8a'), vinculo('v-9b', { turmaId: 't-9b', usuarioId: 'u-bia' }), vinculo('v-8b', { turmaId: 't-8b', usuarioId: 'u-caio' }), vinculo('v-9c', { turmaId: 't-9c', usuarioId: 'u-dani' })])
    const repositorio = {
      ...repositorioCom({ ...dados, professores: [ANA, professor('u-bia', 'bia@escola.invalid', 'ativo'), professor('u-caio', 'caio@escola.invalid', 'ativo'), professor('u-dani', 'dani@escola.invalid', 'ativo')] }),
      travarUsuarios: (ids: readonly string[]) => Promise.resolve(void ordem.push(`usuarios:${[...ids].sort().join(',')}`)),
      travarTurmas: (_ano: string, ids: readonly string[]) => Promise.resolve(void ordem.push(`turmas:${ids.join(',')}`)),
    } as unknown as ImportacaoRepository
    const guardado = (await previa([daAna8A], dados)).guardado
    await tipoGrade.travar?.(repositorio, ANO, guardado, { ...SEM_MARCAS, encerrar: ['v-9b', 'v-8b'] }, { contas: new Map(), travarContas: () => Promise.resolve(true) }, TX)
    expect(ordem).toEqual(['usuarios:u-ana,u-bia,u-caio', 'turmas:t-8a,t-8b,t-9b'])
    ordem.length = 0
    await tipoGrade.travar?.(repositorio, ANO, guardado, SEM_MARCAS, { contas: new Map(), travarContas: () => Promise.resolve(true) }, TX)
    expect(ordem).toEqual(['usuarios:u-ana', 'turmas:t-8a'])
  })
})
