import { describe, expect, it } from 'vitest'
import { diaDaSemanaDe, montarDias, somarDias, type EntradaDaMontagem } from './montar-dias.js'

const V1 = '0199b0a0-0000-7000-8000-000000000001'
const V2 = '0199b0a0-0000-7000-8000-000000000002'
const vinculos = [
  { id: V1, turmaId: '0199b0a0-0000-7000-8000-0000000000a1', turma: '7ºA', disciplinaId: '0199b0a0-0000-7000-8000-0000000000b1', disciplina: 'Matemática' },
  { id: V2, turmaId: '0199b0a0-0000-7000-8000-0000000000a2', turma: '7ºB', disciplinaId: '0199b0a0-0000-7000-8000-0000000000b1', disciplina: 'Matemática' },
]
// 2026-11-02 é segunda-feira.
const SEGUNDA = '2026-11-02'
const base: EntradaDaMontagem = {
  segunda: SEGUNDA,
  ano: { inicio: '2026-02-02', fim: '2026-12-18' },
  hoje: '2026-11-04',
  vinculos,
  alocacoes: [],
  eventos: [],
  registros: [],
  itens: [],
}
const montar = (parcial: Partial<EntradaDaMontagem>) => montarDias({ ...base, ...parcial })
const aloc = (vinculoId: string, diaSemana: number, inicio: string, fim = '08:20', sala: string | null = null) => ({ vinculoId, diaSemana, inicio, fim, sala })

describe('a montagem dos dias da Semana (F2b, tarefa 2.0; S14)', () => {
  it('aritmética de calendário: somar dias atravessa o mês e o ano, e o dia da semana vai de 1 (segunda) a 7 (domingo)', () => {
    expect(somarDias('2026-12-30', 3)).toBe('2027-01-02')
    expect(diaDaSemanaDe('2026-11-02')).toBe(1)
    expect(diaDaSemanaDe('2026-11-08')).toBe(7)
  })

  it('S2: sem aula no fim de semana a semana tem cinco dias; com aula no sábado ele entra, e as aulas do dia vêm em ordem de horário', () => {
    expect(montar({}).map((dia) => dia.data)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'])
    const dias = montar({ alocacoes: [aloc(V1, 6, '09:00'), aloc(V2, 2, '09:00'), aloc(V1, 2, '07:30'), aloc(V2, 2, '07:30')] })
    expect(dias.map((dia) => dia.data)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'])
    expect(dias[1]?.aulas.map((aula) => [aula.inicio, aula.turma])).toEqual([['07:30', '7ºA'], ['07:30', '7ºB'], ['09:00', '7ºB']])
  })

  it('S3: feriado e recesso tiram a aula e o dia traz tipo e descrição; evento aparece e não tira', () => {
    const alocacoes = [aloc(V1, 2, '07:30'), aloc(V1, 3, '07:30'), aloc(V1, 4, '07:30')]
    const eventos = [
      { tipo: 'feriado' as const, inicio: '2026-11-03', fim: '2026-11-03', descricao: 'Finados' },
      { tipo: 'evento' as const, inicio: '2026-11-04', fim: '2026-11-04', descricao: 'Conselho de classe' },
      { tipo: 'recesso' as const, inicio: '2026-10-30', fim: '2026-11-02', descricao: 'Recesso' },
    ]
    const dias = montar({ alocacoes, eventos })
    const por = (data: string) => dias.find((dia) => dia.data === data)
    expect(por('2026-11-03')).toMatchObject({ eventos: [{ tipo: 'feriado', descricao: 'Finados' }], aulas: [] })
    expect(por('2026-11-04')?.eventos).toEqual([{ tipo: 'evento', descricao: 'Conselho de classe' }])
    expect(por('2026-11-04')?.aulas).toHaveLength(1)
    // o recesso começou na semana anterior e ainda cobre a segunda
    expect(por('2026-11-02')?.eventos).toEqual([{ tipo: 'recesso', descricao: 'Recesso' }])
  })

  it('S5: só os dias do ano aparecem, e a semana inteira fora do ano não tem dia', () => {
    const alocacoes = [1, 2, 3, 4, 5].map((dia) => aloc(V1, dia, '07:30'))
    const dias = montar({ segunda: '2026-12-14', ano: { inicio: '2026-02-02', fim: '2026-12-16' }, alocacoes })
    expect(dias.map((dia) => dia.data)).toEqual(['2026-12-14', '2026-12-15', '2026-12-16'])
    expect(montar({ segunda: '2027-01-04', alocacoes })).toEqual([])
  })

  it('S14: o fora da grade passado aparece com o texto; o de hoje e o futuro, sem alocação, ficam de fora', () => {
    const registros = [
      { vinculoId: V1, data: '2026-11-02', inicio: '10:00', fim: '10:50', conteudo: 'passado fora da grade' },
      { vinculoId: V1, data: '2026-11-04', inicio: '10:00', fim: '10:50', conteudo: 'hoje fora da grade' },
      { vinculoId: V1, data: '2026-11-05', inicio: '10:00', fim: '10:50', conteudo: 'futuro fora da grade' },
    ]
    const dias = montar({ registros })
    const aulasDe = (data: string) => dias.find((dia) => dia.data === data)?.aulas
    expect(aulasDe('2026-11-02')).toEqual([expect.objectContaining({ inicio: '10:00', fim: '10:50', texto: 'passado fora da grade', foraDaGrade: true, sala: null })])
    expect(aulasDe('2026-11-04')).toEqual([])
    expect(aulasDe('2026-11-05')).toEqual([])
  })

  it('S14: o registro com alocação do mesmo início dá o texto à aula da grade, e não duplica; sem registro o texto é nulo', () => {
    const registros = [{ vinculoId: V1, data: '2026-11-03', inicio: '07:30', fim: '08:20', conteudo: 'frações' }]
    const dias = montar({ alocacoes: [aloc(V1, 2, '07:30', '08:20', 'Sala 3'), aloc(V1, 2, '08:20', '09:10')], registros })
    expect(dias.find((dia) => dia.data === '2026-11-03')?.aulas).toEqual([
      expect.objectContaining({ inicio: '07:30', texto: 'frações', foraDaGrade: false, sala: 'Sala 3' }),
      expect.objectContaining({ inicio: '08:20', texto: null, foraDaGrade: false }),
    ])
  })

  it('feriado esconde também o registro fora da grade, e o registro de vínculo que não é da professora nunca aparece', () => {
    const eventos = [{ tipo: 'feriado' as const, inicio: '2026-11-02', fim: '2026-11-02', descricao: 'Feriado' }]
    const registros = [
      { vinculoId: V1, data: '2026-11-02', inicio: '10:00', fim: '10:50', conteudo: 'passado' },
      { vinculoId: '0199b0a0-0000-7000-8000-0000000000ff', data: '2026-11-03', inicio: '10:00', fim: '10:50', conteudo: 'de outro vínculo' },
    ]
    const dias = montar({ eventos, registros })
    expect(dias.flatMap((dia) => dia.aulas)).toEqual([])
  })

  it('a alocação de um vínculo que não é da professora não cria aula nem o dia de sábado', () => {
    const dias = montar({ alocacoes: [aloc('0199b0a0-0000-7000-8000-0000000000ff', 6, '09:00'), aloc('0199b0a0-0000-7000-8000-0000000000ff', 2, '09:00')] })
    expect(dias.flatMap((dia) => dia.aulas)).toEqual([])
    expect(dias.map((dia) => dia.data)).not.toContain('2026-11-07')
  })

  it('a ordem do dia é horário, turma e disciplina', () => {
    const W1 = '0199b0a0-0000-7000-8000-000000000011'
    const W2 = '0199b0a0-0000-7000-8000-000000000012'
    const W3 = '0199b0a0-0000-7000-8000-000000000013'
    const disciplinaId = '0199b0a0-0000-7000-8000-0000000000b1'
    const turmaId = '0199b0a0-0000-7000-8000-0000000000a1'
    const doDia = [
      { id: W1, turmaId, turma: '7ºB', disciplinaId, disciplina: 'Artes' },
      { id: W2, turmaId, turma: '7ºA', disciplinaId, disciplina: 'Matemática' },
      { id: W3, turmaId, turma: '7ºA', disciplinaId, disciplina: 'Artes' },
    ]
    // Terça-feira. Na ordem de entrada, nenhuma chave de ordenação coincide com a que o dia pede.
    const dias = montar({ vinculos: doDia, alocacoes: [aloc(W2, 2, '09:00'), aloc(W3, 2, '09:00'), aloc(W1, 2, '09:00'), aloc(W1, 2, '07:30')] })
    expect(dias.find((dia) => dia.data === '2026-11-03')?.aulas.map((aula) => [aula.inicio, aula.turma, aula.disciplina])).toEqual([
      ['07:30', '7ºB', 'Artes'],
      ['09:00', '7ºA', 'Artes'],
      ['09:00', '7ºA', 'Matemática'],
      ['09:00', '7ºB', 'Artes'],
    ])
  })

  it('S14: o registro passado fora da grade não some porque outro vínculo, ou outro horário do mesmo, tem aula no dia', () => {
    // Terça passada (hoje é quarta): V1 dá aula às 7h30, V2 às 10h; o registro de V1 às 10h não tem alocação de V1.
    const registros = [{ vinculoId: V1, data: '2026-11-03', inicio: '10:00', fim: '10:50', conteudo: 'fora da grade de V1' }]
    const dias = montar({ alocacoes: [aloc(V1, 2, '07:30'), aloc(V2, 2, '10:00')], registros })
    expect(dias.find((dia) => dia.data === '2026-11-03')?.aulas.map((aula) => [aula.inicio, aula.turma, aula.texto, aula.foraDaGrade])).toEqual([
      ['07:30', '7ºA', null, false],
      ['10:00', '7ºA', 'fora da grade de V1', true],
      ['10:00', '7ºB', null, false],
    ])
  })

  it('S14: o registro passado fora da grade num sábado sem aula na grade faz o sábado aparecer', () => {
    const registros = [{ vinculoId: V1, data: '2026-11-07', inicio: '09:00', fim: '09:50', conteudo: 'reposição de sábado' }]
    const dias = montar({ hoje: '2026-11-09', registros })
    expect(dias.map((dia) => dia.data)).toContain('2026-11-07')
    expect(dias.find((dia) => dia.data === '2026-11-07')?.aulas).toEqual([expect.objectContaining({ texto: 'reposição de sábado', foraDaGrade: true })])
    expect(dias.map((dia) => dia.data)).not.toContain('2026-11-08')
  })

  describe('os itens do dia (F2b, tarefa 3.0; S9, S10)', () => {
    const turmaId = '0199b0a0-0000-7000-8000-0000000000a1'
    const disciplinaId = '0199b0a0-0000-7000-8000-0000000000b1'
    const A1 = '0199b0a0-0000-7000-8000-0000000000c1'
    const A2 = '0199b0a0-0000-7000-8000-0000000000c2'
    const item = (data: string, tipo: 'aplicada' | 'encerrada' | 'correcao', titulo: string, atividadeAplicadaId = A1, estado?: 'pendente' | 'aprovada' | 'rejeitada') => ({
      data,
      tipo,
      turmaId,
      disciplinaId,
      atividadeAplicadaId,
      titulo,
      ...(estado === undefined ? {} : { estado }),
    })
    const itensDe = (dias: ReturnType<typeof montar>, data: string) => dias.find((dia) => dia.data === data)?.itens

    it('sem item, o dia traz a lista vazia', () => {
      expect(montar({ alocacoes: [aloc(V1, 1, '07:30')] }).every((dia) => dia.itens.length === 0)).toBe(true)
    })

    it('cada item cai no dia dele, e no contrato só ficam as chaves dele (sem o `data`)', () => {
      const dias = montar({ itens: [item('2026-11-04', 'aplicada', 'Lista 1'), item('2026-11-05', 'encerrada', 'Lista 2', A2)] })
      expect(itensDe(dias, '2026-11-04')).toEqual([{ tipo: 'aplicada', turmaId, disciplinaId, atividadeAplicadaId: A1, titulo: 'Lista 1' }])
      expect(itensDe(dias, '2026-11-05')).toEqual([{ tipo: 'encerrada', turmaId, disciplinaId, atividadeAplicadaId: A2, titulo: 'Lista 2' }])
      expect(itensDe(dias, '2026-11-03')).toEqual([])
    })

    it('S10: o dia de feriado e o de recesso perdem a aula e mantêm o item', () => {
      const eventos = [
        { tipo: 'feriado' as const, inicio: '2026-11-04', fim: '2026-11-04', descricao: 'Feriado' },
        { tipo: 'recesso' as const, inicio: '2026-11-05', fim: '2026-11-05', descricao: 'Recesso' },
      ]
      const dias = montar({ alocacoes: [aloc(V1, 3, '07:30'), aloc(V1, 4, '07:30')], eventos, itens: [item('2026-11-04', 'aplicada', 'Prova no feriado'), item('2026-11-05', 'aplicada', 'Prova no recesso', A2)] })
      for (const data of ['2026-11-04', '2026-11-05']) {
        expect(dias.find((dia) => dia.data === data)?.aulas).toEqual([])
        expect(itensDe(dias, data)).toHaveLength(1)
      }
    })

    it('o `estado` só vai na correção: a aplicada e a encerrada nunca o levam, mesmo que a leitura o traga', () => {
      const dias = montar({ itens: [item('2026-11-04', 'aplicada', 'A', A1, 'aprovada'), item('2026-11-04', 'encerrada', 'B', A1, 'rejeitada'), item('2026-11-04', 'correcao', 'C', A1, 'pendente')] })
      expect(itensDe(dias, '2026-11-04')?.map((i) => [i.tipo, Object.keys(i).includes('estado'), i.estado])).toEqual([
        ['aplicada', false, undefined],
        ['encerrada', false, undefined],
        ['correcao', true, 'pendente'],
      ])
      const semEstado = itensDe(montar({ itens: [item('2026-11-04', 'correcao', 'D')] }), '2026-11-04')
      expect(semEstado?.map((i) => Object.keys(i).includes('estado'))).toEqual([false])
    })

    it('a ordem do dia é aplicada, encerrada, correção, depois o título e, no empate, a atividade', () => {
      const dias = montar({
        itens: [item('2026-11-04', 'correcao', 'A', A1, 'pendente'), item('2026-11-04', 'encerrada', 'A'), item('2026-11-04', 'aplicada', 'B', A2), item('2026-11-04', 'aplicada', 'A', A2), item('2026-11-04', 'aplicada', 'A', A1)],
      })
      expect(itensDe(dias, '2026-11-04')?.map((i) => [i.tipo, i.titulo, i.atividadeAplicadaId])).toEqual([
        ['aplicada', 'A', A1],
        ['aplicada', 'A', A2],
        ['aplicada', 'B', A2],
        ['encerrada', 'A', A1],
        ['correcao', 'A', A1],
      ])
    })

    it('o item de um dia que a semana não traz (sábado sem grade, fora do ano) não aparece', () => {
      const dias = montar({ ano: { inicio: '2026-11-03', fim: '2026-12-18' }, itens: [item('2026-11-02', 'aplicada', 'Antes do ano'), item('2026-11-07', 'aplicada', 'No sábado', A2)] })
      expect(dias.flatMap((dia) => dia.itens)).toEqual([])
    })
  })
})
