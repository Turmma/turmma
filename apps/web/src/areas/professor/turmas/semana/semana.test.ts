import type { AulaDaSemana, DiaDaSemana, SemanaResponse } from '@educa/shared'
import { describe, expect, it } from 'vitest'
import {
  abaDeTurmasDoEndereco,
  acharAula,
  aulaDoEndereco,
  chaveDaAula,
  comTextoGravado,
  enderecoSemAula,
  descricaoDaAula,
  deveAbrirAdeHoje,
  diasFiltrados,
  ehDataValida,
  emAndamento,
  enderecoDaAbaDeTurmas,
  enderecoDaAula,
  enderecoDaSemana,
  faltaOCalendario,
  faltaPreencher,
  filtroDoEndereco,
  haSemanaAnterior,
  haSemanaSeguinte,
  hojeNoFusoDaEscola,
  horaDaAula,
  nomeCompletoDoDia,
  nomeDaAula,
  rotuloDoTexto,
  segundaDe,
  semanaDoEndereco,
  semanaToca,
  somarDias,
  tituloDaSemana,
  vazioDaSemana,
} from './semana'

const id = (n: number) => `0197a1c0-0000-7000-8000-${String(n).padStart(12, '0')}`
const ANO = { inicio: '2026-02-02', fim: '2026-12-18' }

const aula = (extra: Partial<AulaDaSemana> = {}): AulaDaSemana => ({
  vinculoId: id(1),
  turmaId: id(2),
  turma: '7ºA',
  disciplinaId: id(3),
  disciplina: 'Matemática',
  inicio: '07:30',
  fim: '08:20',
  sala: null,
  texto: null,
  foraDaGrade: false,
  ...extra,
})
const dia = (data: string, extra: Partial<DiaDaSemana> = {}): DiaDaSemana => ({ data, eventos: [], aulas: [], itens: [], ...extra })
const resposta = (extra: Partial<SemanaResponse> = {}): SemanaResponse => ({ ano: ANO, hoje: '2026-11-10', agora: '09:00', gradeImportada: true, calendarioImportado: true, dias: [], ...extra })

describe('as datas da Semana (sem fuso: aritmética de calendário)', () => {
  it('a semana vai de segunda a domingo: o domingo pertence à semana que termina nele', () => {
    expect(segundaDe('2026-11-10')).toBe('2026-11-09')
    expect(segundaDe('2026-11-09')).toBe('2026-11-09')
    expect(segundaDe('2026-11-15')).toBe('2026-11-09')
    expect(segundaDe('2026-11-16')).toBe('2026-11-16')
  })

  it('soma dias atravessando mês e ano', () => {
    expect(somarDias('2026-11-30', 1)).toBe('2026-12-01')
    expect(somarDias('2026-12-28', 7)).toBe('2027-01-04')
    expect(somarDias('2026-03-02', -7)).toBe('2026-02-23')
  })

  it('só aceita data que existe no calendário', () => {
    expect(ehDataValida('2026-11-09')).toBe(true)
    expect(ehDataValida('2026-02-30')).toBe(false)
    expect(ehDataValida('09/11/2026')).toBe(false)
    expect(ehDataValida('2026-13-45')).toBe(false)
    expect(ehDataValida(null)).toBe(false)
  })

  it('hoje é o do fuso da escola, e não o do navegador: 02h UTC ainda é o dia anterior em São Paulo', () => {
    expect(hojeNoFusoDaEscola(new Date('2026-11-10T02:00:00Z'))).toBe('2026-11-09')
    expect(hojeNoFusoDaEscola(new Date('2026-11-10T12:00:00Z'))).toBe('2026-11-10')
  })

  it('os textos: título da semana (no mês e atravessando o mês), hora e nome do dia', () => {
    expect(tituloDaSemana('2026-11-09')).toBe('9 a 15 de novembro')
    expect(tituloDaSemana('2026-11-30')).toBe('30 de novembro a 6 de dezembro')
    expect(horaDaAula('07:30')).toBe('7h30')
    expect(horaDaAula('08:00')).toBe('8h')
    expect(nomeCompletoDoDia('2026-11-10')).toBe('Terça, 10 de novembro')
  })
})

describe('o cartão da aula', () => {
  it('o nome acessível é só "Terça, 7h30, 7ºA, Matemática"', () => {
    expect(nomeDaAula('2026-11-10', aula())).toBe('Terça, 7h30, 7ºA, Matemática')
  })

  it('S14 e T11: "Falta preencher" é da aula de hoje ou futura sem texto; a passada sem texto e a com texto não levam', () => {
    expect(faltaPreencher('2026-11-10', '2026-11-10', aula())).toBe(true)
    expect(faltaPreencher('2026-11-11', '2026-11-10', aula())).toBe(true)
    expect(faltaPreencher('2026-11-09', '2026-11-10', aula())).toBe(false)
    expect(faltaPreencher('2026-11-10', '2026-11-10', aula({ texto: 'Frações' }))).toBe(false)
  })

  it('o rótulo do texto muda no dia da aula: "O que vou dar" até ele, "O que foi dado" depois', () => {
    expect(rotuloDoTexto('2026-11-10', '2026-11-10')).toBe('O que vou dar')
    expect(rotuloDoTexto('2026-11-09', '2026-11-10')).toBe('O que foi dado')
  })

  it('"Agora" só na aula de hoje cujo horário contém o agora: o fim não conta', () => {
    expect(emAndamento('2026-11-10', '2026-11-10', '07:30', aula())).toBe(true)
    expect(emAndamento('2026-11-10', '2026-11-10', '08:20', aula())).toBe(false)
    expect(emAndamento('2026-11-10', '2026-11-10', '07:29', aula())).toBe(false)
    expect(emAndamento('2026-11-11', '2026-11-10', '07:45', aula())).toBe(false)
  })

  it('a descrição diz o horário, a sala, o estado e o texto, e nunca soma o que falta', () => {
    expect(descricaoDaAula('2026-11-10', '2026-11-10', true, aula({ sala: '12', texto: 'Frações' }))).toBe('7h30 às 8h20. Sala 12. Em andamento. O que vou dar: Frações')
    expect(descricaoDaAula('2026-11-10', '2026-11-10', false, aula())).toBe('7h30 às 8h20. Falta preencher')
    expect(descricaoDaAula('2026-11-09', '2026-11-10', false, aula({ foraDaGrade: true }))).toBe('7h30 às 8h20. Fora da grade')
  })
})

describe('o endereço leva só ids e datas', () => {
  it('`?semana=` vira a segunda da semana; inválido, ou sem o parâmetro, não pede semana nenhuma', () => {
    expect(semanaDoEndereco('?ver=semana&semana=2026-11-12')).toBe('2026-11-09')
    expect(semanaDoEndereco('semana=2026-02-30')).toBeUndefined()
    expect(semanaDoEndereco('semana=amanhã')).toBeUndefined()
    expect(semanaDoEndereco('ver=semana')).toBeUndefined()
  })

  it('`?turma=` só vale com dois UUIDs separados por ponto', () => {
    expect(filtroDoEndereco(`turma=${id(2)}.${id(3)}`)).toEqual({ turmaId: id(2), disciplinaId: id(3) })
    expect(filtroDoEndereco(`turma=${id(2)}`)).toBeUndefined()
    expect(filtroDoEndereco(`turma=${id(2)}.${id(3)}.${id(4)}`)).toBeUndefined()
    expect(filtroDoEndereco('turma=7A.matematica')).toBeUndefined()
    expect(filtroDoEndereco(`turma=${id(2)}x.${id(3)}`)).toBeUndefined()
    expect(filtroDoEndereco(`turma=${id(2)}.${id(3)}x`)).toBeUndefined()
    expect(filtroDoEndereco('')).toBeUndefined()
  })

  it('trocar de semana ou de filtro mantém o resto e tira `?aula=`: a aula aberta é de uma semana só', () => {
    const busca = `ver=semana&turma=${id(2)}.${id(3)}&aula=${id(1)}.2026-11-10.0730`
    expect(enderecoDaSemana('/professor/turmas', busca, { semana: '2026-11-16' })).toBe(`/professor/turmas?ver=semana&turma=${id(2)}.${id(3)}&semana=2026-11-16`)
    expect(enderecoDaSemana('/professor/turmas', busca, { turma: undefined })).toBe('/professor/turmas?ver=semana')
    expect(enderecoDaSemana('/professor/turmas', 'ver=semana&semana=2026-11-16', { semana: undefined })).toBe('/professor/turmas?ver=semana')
    // "Todas as turmas" é o valor vazio: tira o filtro, e não deixa `turma=` no endereço.
    expect(enderecoDaSemana('/professor/turmas', `ver=semana&turma=${id(2)}.${id(3)}`, { turma: '' })).toBe('/professor/turmas?ver=semana')
  })

  it('o clique no cartão põe `?aula=<vinculoId>.<data>.<HHMM>`, sem texto da aula nem nome', () => {
    const endereco = enderecoDaAula('/professor/turmas', 'ver=semana', aula({ texto: 'Frações do João' }), '2026-11-10')
    expect(endereco).toBe(`/professor/turmas?ver=semana&aula=${id(1)}.2026-11-10.0730`)
    expect(endereco).not.toContain('Fra')
  })
})

describe('a navegação presa ao ano (RF2)', () => {
  it('não há "anterior" na semana que contém o começo do ano, nem "seguinte" na que contém o fim', () => {
    expect(haSemanaAnterior('2026-02-02', ANO)).toBe(false)
    expect(haSemanaAnterior('2026-02-09', ANO)).toBe(true)
    expect(haSemanaSeguinte('2026-12-14', ANO)).toBe(false)
    expect(haSemanaSeguinte('2026-12-07', ANO)).toBe(true)
  })

  it('o ano que começa no meio da semana: a semana do começo é a última com "anterior" desligado', () => {
    const quarta = { inicio: '2026-02-04', fim: '2026-12-18' }
    expect(haSemanaAnterior('2026-02-02', quarta)).toBe(false)
    expect(semanaToca('2026-02-02', quarta)).toBe(true)
    expect(semanaToca('2026-01-26', quarta)).toBe(false)
    expect(semanaToca('2026-12-21', quarta)).toBe(false)
  })

  it('semana pedida fora do ano abre a de hoje; a de hoje, ou a pedida antes de ler o ano, não muda de lugar', () => {
    expect(deveAbrirAdeHoje('2025-11-03', '2025-11-03', resposta())).toBe(true)
    expect(deveAbrirAdeHoje('2026-11-02', '2026-11-02', resposta())).toBe(false)
    expect(deveAbrirAdeHoje('2025-11-03', '2025-11-03', undefined)).toBe(false)
    expect(deveAbrirAdeHoje(undefined, '2025-11-03', resposta())).toBe(false)
    // A semana de hoje fora do ano (o ano acabou) é a de hoje: não há para onde ir, e não pode haver laço.
    expect(deveAbrirAdeHoje('2026-11-09', '2026-11-09', resposta({ ano: { inicio: '2026-01-05', fim: '2026-03-01' } }))).toBe(false)
    expect(deveAbrirAdeHoje('2025-11-03', '2025-11-03', resposta({ ano: null }))).toBe(false)
  })
})

describe('o filtro corta o que a API devolveu', () => {
  it('só a turma e a disciplina pedidas; a que não é dela deixa os dias sem aula', () => {
    const outra = aula({ turmaId: id(9), turma: '8ºB' })
    const outraDisciplina = aula({ disciplinaId: id(8), disciplina: 'História' })
    const dias = [dia('2026-11-10', { aulas: [aula(), outra, outraDisciplina] })]
    expect(diasFiltrados(dias, { turmaId: id(2), disciplinaId: id(3) })[0]?.aulas).toEqual([aula()])
    expect(diasFiltrados(dias, { turmaId: id(2), disciplinaId: id(8) })[0]?.aulas).toEqual([outraDisciplina])
    expect(diasFiltrados(dias, { turmaId: id(77), disciplinaId: id(3) })[0]?.aulas).toEqual([])
    expect(diasFiltrados(dias, undefined)).toBe(dias)
  })
})

describe('o vazio que diz por quê (RF12)', () => {
  const semana = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']

  it('sem ano em curso, sem grade e semana fora do ano têm cada um a sua frase', () => {
    expect(vazioDaSemana(resposta({ ano: null }), [])?.titulo).toBe('O ano letivo ainda não começou')
    expect(vazioDaSemana(resposta({ gradeImportada: false }), semana.map((d) => dia(d)))?.titulo).toBe('A coordenação ainda não importou a grade')
    expect(vazioDaSemana(resposta({ hoje: '2026-11-10' }), [])?.titulo).toBe('Sem aulas nesta semana')
    expect(vazioDaSemana(resposta({ hoje: '2026-01-10' }), [])).toEqual({ titulo: 'O ano letivo ainda não começou', descricao: 'As aulas aparecem aqui a partir de 2 de fevereiro.' })
  })

  it('a semana inteira de recesso diz o recesso; feriado ou evento sem aula não é vazio, porque a tela mostra o que cai nos dias', () => {
    const recesso = semana.map((d) => dia(d, { eventos: [{ tipo: 'recesso', descricao: 'Recesso de outubro' }] }))
    expect(vazioDaSemana(resposta(), recesso)).toEqual({ titulo: 'Semana de recesso', descricao: 'Recesso de outubro: a escola está em recesso nesta semana.' })
    // Só sábado e domingo, sem evento: não há dia de aula para estar em recesso.
    expect(vazioDaSemana(resposta(), [dia('2026-11-14'), dia('2026-11-15')])?.titulo).toBe('Sem aulas nesta semana')
    // Recesso sem descrição ainda diz que é recesso.
    const semDescricao = semana.map((d) => dia(d, { eventos: [{ tipo: 'recesso', descricao: '' }] }))
    expect(vazioDaSemana(resposta(), semDescricao)?.descricao).toBe('A escola está em recesso nesta semana.')
    const umFeriado = semana.map((d, i) => dia(d, i === 0 ? { eventos: [{ tipo: 'feriado', descricao: 'Finados' }] } : {}))
    expect(vazioDaSemana(resposta(), umFeriado)).toBeUndefined()
    expect(vazioDaSemana(resposta(), semana.map((d) => dia(d)))?.titulo).toBe('Sem aulas nesta semana')
    const comAula = semana.map((d, i) => dia(d, i === 1 ? { aulas: [aula()] } : {}))
    expect(vazioDaSemana(resposta(), comAula)).toBeUndefined()
  })

  it('o aviso do calendário só aparece com a grade importada e o calendário não', () => {
    expect(faltaOCalendario(resposta({ calendarioImportado: false }))).toBe(true)
    expect(faltaOCalendario(resposta({ calendarioImportado: false, gradeImportada: false }))).toBe(false)
    expect(faltaOCalendario(resposta({ calendarioImportado: false, ano: null }))).toBe(false)
    expect(faltaOCalendario(resposta())).toBe(false)
    expect(faltaOCalendario(undefined)).toBe(false)
  })
})

describe('as abas de Turmas guardam só `ver`', () => {
  it('`?ver=semana` abre a Semana; qualquer outra coisa, ou nada, abre Turmas', () => {
    expect(abaDeTurmasDoEndereco('ver=semana')).toBe('semana')
    expect(abaDeTurmasDoEndereco('ver=outra')).toBe('turmas')
    expect(abaDeTurmasDoEndereco('')).toBe('turmas')
  })

  it('trocar de aba leva só o `ver`: o que a Semana pôs por cima não vai à lista', () => {
    expect(enderecoDaAbaDeTurmas('/professor/turmas', 'semana')).toBe('/professor/turmas?ver=semana')
    expect(enderecoDaAbaDeTurmas('/professor/turmas', 'turmas')).toBe('/professor/turmas')
  })
})

const UUID_A = '0197a1c0-0000-7000-8000-000000000401'

describe('o endereço da aula (`?aula=`, 7.0)', () => {
  it('lê o vínculo, a data e o início; o que não tem essa forma, ou tem hora ou data que não existem, não é aula', () => {
    expect(aulaDoEndereco(`ver=semana&aula=${UUID_A}.2026-11-10.0730`)).toEqual({ vinculoId: UUID_A, data: '2026-11-10', inicio: '07:30' })
    expect(aulaDoEndereco('ver=semana')).toBeUndefined()
    expect(aulaDoEndereco(`aula=${UUID_A}.2026-11-10`)).toBeUndefined()
    expect(aulaDoEndereco(`aula=${UUID_A}.2026-11-10.0730.x`)).toBeUndefined()
    expect(aulaDoEndereco('aula=1837.2026-11-10.0730')).toBeUndefined()
    expect(aulaDoEndereco(`aula=${UUID_A}.2026-02-30.0730`)).toBeUndefined()
    expect(aulaDoEndereco(`aula=${UUID_A}.2026-11-10.2561`)).toBeUndefined()
    expect(aulaDoEndereco(`aula=${UUID_A}.2026-11-10.2400`)).toBeUndefined()
    expect(aulaDoEndereco(`aula=${UUID_A}.2026-11-10.730`)).toBeUndefined()
  })

  it('a chave da aula é a mesma do endereço, e `enderecoSemAula` tira só o `aula`', () => {
    expect(chaveDaAula(UUID_A, '2026-11-10', '07:30')).toBe(`${UUID_A}.2026-11-10.0730`)
    expect(enderecoSemAula('/turmas', `ver=semana&semana=2026-11-09&aula=${UUID_A}.2026-11-10.0730&turma=x`)).toBe('/turmas?ver=semana&semana=2026-11-09&turma=x')
    expect(enderecoSemAula('/turmas', 'ver=semana')).toBe('/turmas?ver=semana')
  })
})

describe('achar a aula e pôr nela o texto gravado (7.0)', () => {
  const aula = (extra: Partial<AulaDaSemana> = {}): AulaDaSemana => ({
    vinculoId: UUID_A,
    turmaId: '0197a1c0-0000-7000-8000-000000000101',
    turma: '7ºA',
    disciplinaId: '0197a1c0-0000-7000-8000-000000000500',
    disciplina: 'Matemática',
    inicio: '07:30',
    fim: '08:20',
    sala: null,
    texto: null,
    foraDaGrade: false,
    ...extra,
  })
  const dia = (data: string, aulas: AulaDaSemana[]): DiaDaSemana => ({ data, eventos: [], aulas, itens: [] })
  const resposta = (dias: DiaDaSemana[]): SemanaResponse => ({ ano: { inicio: '2026-02-02', fim: '2026-12-18' }, hoje: '2026-11-10', agora: '09:00', gradeImportada: true, calendarioImportado: true, dias })

  it('acha pela data, pelo vínculo e pelo início; a aula de outro vínculo, de outro início ou de outro dia não é a pedida', () => {
    const dias = [dia('2026-11-10', [aula(), aula({ inicio: '08:20', fim: '09:10' })]), dia('2026-11-11', [aula()])]
    expect(acharAula(dias, { vinculoId: UUID_A, data: '2026-11-10', inicio: '08:20' })?.fim).toBe('09:10')
    expect(acharAula(dias, { vinculoId: UUID_A, data: '2026-11-10', inicio: '09:10' })).toBeUndefined()
    expect(acharAula(dias, { vinculoId: '0197a1c0-0000-7000-8000-000000000999', data: '2026-11-10', inicio: '07:30' })).toBeUndefined()
    expect(acharAula(dias, { vinculoId: UUID_A, data: '2026-11-12', inicio: '07:30' })).toBeUndefined()
  })

  it('o texto gravado entra só na aula da gravação: a aula dupla, o outro dia e a outra disciplina ficam como estavam', () => {
    const outra = aula({ vinculoId: '0197a1c0-0000-7000-8000-000000000402', texto: 'de outra disciplina' })
    const lida = resposta([dia('2026-11-10', [aula(), aula({ inicio: '08:20', fim: '09:10' }), outra]), dia('2026-11-11', [aula()])])
    const nova = comTextoGravado(lida, { vinculoId: UUID_A, data: '2026-11-10', inicio: '07:30', texto: 'Frações' })
    expect(nova.dias[0]?.aulas.map((a) => a.texto)).toEqual(['Frações', null, 'de outra disciplina'])
    expect(nova.dias[1]?.aulas[0]?.texto).toBeNull()
    expect(lida.dias[0]?.aulas[0]?.texto).toBeNull()
  })

  it('a gravação de uma escola não entra na semana de outra: o mesmo dia e o mesmo horário, com outro vínculo, ficam como estavam', () => {
    const daEscolaB = aula({ vinculoId: '0197a1c0-0000-7000-8000-0000000009b2', texto: 'da escola B' })
    const lida = resposta([dia('2026-11-10', [daEscolaB])])
    const nova = comTextoGravado(lida, { vinculoId: UUID_A, data: '2026-11-10', inicio: '07:30', texto: 'gravado na escola A' })
    expect(nova).toEqual(lida)
  })

  it('apagar o texto: a aula da grade fica sem texto; a que saiu da grade deixa de existir', () => {
    const lida = resposta([dia('2026-11-10', [aula({ texto: 'x' }), aula({ inicio: '10:00', fim: '10:50', texto: 'y', foraDaGrade: true })])])
    const apagada = comTextoGravado(comTextoGravado(lida, { vinculoId: UUID_A, data: '2026-11-10', inicio: '07:30', texto: null }), { vinculoId: UUID_A, data: '2026-11-10', inicio: '10:00', texto: null })
    expect(apagada.dias[0]?.aulas.map((a) => [a.inicio, a.texto])).toEqual([['07:30', null]])
  })

  it('a aula fora da grade que ganha texto fica, com o texto novo', () => {
    const lida = resposta([dia('2026-11-10', [aula({ texto: 'y', foraDaGrade: true })])])
    const nova = comTextoGravado(lida, { vinculoId: UUID_A, data: '2026-11-10', inicio: '07:30', texto: 'novo' })
    expect(nova.dias[0]?.aulas.map((a) => [a.texto, a.foraDaGrade])).toEqual([['novo', true]])
  })
})
