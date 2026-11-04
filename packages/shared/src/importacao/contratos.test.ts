import { describe, expect, it } from 'vitest'
import { CABECALHOS_DA_PLANILHA, COLUNAS_OPCIONAIS_DA_PLANILHA } from './modelos.js'
import {
  aulaDaGradeSchema,
  CHAVES_DO_RESUMO_DA_IMPORTACAO,
  eventoDoCalendarioSchema,
  gravarPlanilhaRequestSchema,
  importacaoSchema,
  linhaDaPreviaDaPlanilhaSchema,
  MAXIMO_DE_BYTES_DA_PLANILHA,
  MAXIMO_DE_LINHAS_DA_PLANILHA,
  previaDaPlanilhaRequestSchema,
  resumoDaImportacaoSchema,
  TIPOS_DE_PLANILHA,
} from './contratos.js'

const UM_UUID = '0191f3a6-6b9e-7c1a-8f35-2d4c5b6a7e80'
const OUTRO_UUID = '0191f3a6-6b9e-7c1a-8f35-2d4c5b6a7e81'

describe('o resumo da importação é só contagem', () => {
  it('aceita contagens inteiras não negativas de chaves da lista', () => {
    expect(resumoDaImportacaoSchema.parse({ entram: 3, transferidos: 0, turmas_novas: 2 })).toEqual({ entram: 3, transferidos: 0, turmas_novas: 2 })
    expect(resumoDaImportacaoSchema.safeParse({}).success).toBe(true)
  })

  it('recusa chave que não é contagem, como `nome`, `matricula` e `email`', () => {
    for (const chave of ['nome', 'matricula', 'email']) expect(resumoDaImportacaoSchema.safeParse({ [chave]: 1 }).success, chave).toBe(false)
  })

  it('recusa valor que não é inteiro não negativo: texto, fracionário e negativo', () => {
    for (const valor of ['Maria Souza', 1.5, -1, null]) expect(resumoDaImportacaoSchema.safeParse({ entram: valor }).success, String(valor)).toBe(false)
  })

  it('toda chave da lista é recusada se o valor for um nome: nenhuma abre espaço para texto', () => {
    for (const chave of CHAVES_DO_RESUMO_DA_IMPORTACAO) expect(resumoDaImportacaoSchema.safeParse({ [chave]: 'Maria Souza' }).success, chave).toBe(false)
  })
})

describe('o estado de uma importação', () => {
  const base = { id: UM_UUID, tipo: 'alunos', estado: 'concluida', resumo: { entram: 2 }, erro: null, criadoEm: '2026-11-03T10:00:00.000Z', concluidaEm: '2026-11-03T10:00:05.000Z' }

  it('a concluída traz o resumo, a que falhou traz o código', () => {
    expect(importacaoSchema.safeParse(base).success).toBe(true)
    expect(importacaoSchema.safeParse({ ...base, estado: 'falhou', resumo: null, erro: 'expirou' }).success).toBe(true)
  })

  it('resumo fora de `concluida` e erro fora de `falhou` são recusados', () => {
    expect(importacaoSchema.safeParse({ ...base, estado: 'na_fila' }).success).toBe(false)
    expect(importacaoSchema.safeParse({ ...base, erro: 'expirou' }).success).toBe(false)
    expect(importacaoSchema.safeParse({ ...base, estado: 'falhou', resumo: null, erro: null }).success).toBe(false)
  })

  it('o erro é de lista fechada: texto livre é recusado', () => {
    expect(importacaoSchema.safeParse({ ...base, estado: 'falhou', resumo: null, erro: 'duplicate key value violates unique constraint' }).success).toBe(false)
  })

  it('campo a mais é recusado', () => {
    expect(importacaoSchema.safeParse({ ...base, linhas: [] }).success).toBe(false)
  })
})

describe('o texto da planilha, até 512 KB em UTF-8', () => {
  it('512 KB exatos entram; um byte a mais, não', () => {
    expect(previaDaPlanilhaRequestSchema.safeParse({ texto: 'a'.repeat(MAXIMO_DE_BYTES_DA_PLANILHA) }).success).toBe(true)
    expect(previaDaPlanilhaRequestSchema.safeParse({ texto: 'a'.repeat(MAXIMO_DE_BYTES_DA_PLANILHA + 1) }).success).toBe(false)
  })

  it('conta bytes, não caracteres: o "ç" pesa 2, o "€" pesa 3 e o emoji pesa 4', () => {
    expect(previaDaPlanilhaRequestSchema.safeParse({ texto: 'ç'.repeat(MAXIMO_DE_BYTES_DA_PLANILHA / 2) }).success).toBe(true)
    expect(previaDaPlanilhaRequestSchema.safeParse({ texto: `${'ç'.repeat(MAXIMO_DE_BYTES_DA_PLANILHA / 2)}a` }).success).toBe(false)
    expect(previaDaPlanilhaRequestSchema.safeParse({ texto: '€'.repeat(Math.floor(MAXIMO_DE_BYTES_DA_PLANILHA / 3) + 1) }).success).toBe(false)
    expect(previaDaPlanilhaRequestSchema.safeParse({ texto: '😀'.repeat(MAXIMO_DE_BYTES_DA_PLANILHA / 4) }).success).toBe(true)
    expect(previaDaPlanilhaRequestSchema.safeParse({ texto: `${'😀'.repeat(MAXIMO_DE_BYTES_DA_PLANILHA / 4)}a` }).success).toBe(false)
  })

  it('3.000 linhas de dado entram; 3.001, não, na prévia e no gravar, com qualquer quebra de linha', () => {
    // O número escrito por extenso: com a constante dos dois lados, o teste mudaria junto com o teto.
    expect(MAXIMO_DE_LINHAS_DA_PLANILHA).toBe(3_000)
    const planilha = (linhas: number, quebra: string): string => ['a;b', ...Array.from({ length: linhas }, () => 'x;y')].join(quebra)
    for (const quebra of ['\n', '\r\n', '\r']) {
      expect(previaDaPlanilhaRequestSchema.safeParse({ texto: planilha(3_000, quebra) }).success).toBe(true)
      expect(previaDaPlanilhaRequestSchema.safeParse({ texto: planilha(3_001, quebra) }).success).toBe(false)
      expect(gravarPlanilhaRequestSchema.safeParse({ texto: planilha(3_001, quebra) }).success).toBe(false)
    }
  })

  it('o cabeçalho e as linhas vazias não contam para o teto', () => {
    const linhas = Array.from({ length: MAXIMO_DE_LINHAS_DA_PLANILHA }, () => 'x;y')
    expect(previaDaPlanilhaRequestSchema.safeParse({ texto: ['a;b', '', ...linhas, '', '  ', ''].join('\n') }).success).toBe(true)
    expect(previaDaPlanilhaRequestSchema.safeParse({ texto: ['a;b', ...linhas, 'x;y'].join('\n') }).success).toBe(false)
  })

  it('a escola não vem do corpo: `escolaId` é recusado, na prévia e no gravar', () => {
    expect(previaDaPlanilhaRequestSchema.safeParse({ texto: 'x', escolaId: UM_UUID }).success).toBe(false)
    expect(gravarPlanilhaRequestSchema.safeParse({ texto: 'x', escolaId: UM_UUID }).success).toBe(false)
  })
})

describe('gravar traz as marcas da coordenação', () => {
  it('sem marcas, as três listas nascem vazias: nada é transferido, desligado nem encerrado', () => {
    expect(gravarPlanilhaRequestSchema.parse({ texto: 'x' }).marcas).toEqual({ transferir: [], desligar: [], encerrar: [] })
  })

  it('as marcas são ids; nome ou matrícula no lugar do id é recusado', () => {
    expect(gravarPlanilhaRequestSchema.safeParse({ texto: 'x', marcas: { desligar: [UM_UUID, OUTRO_UUID] } }).success).toBe(true)
    expect(gravarPlanilhaRequestSchema.safeParse({ texto: 'x', marcas: { desligar: ['2026001'] } }).success).toBe(false)
    expect(gravarPlanilhaRequestSchema.safeParse({ texto: 'x', marcas: { excluir: [UM_UUID] } }).success).toBe(false)
  })
})

describe('a linha da prévia', () => {
  it('o erro vem só no resultado `erro`, e o resultado `erro` vem sempre com o código', () => {
    expect(linhaDaPreviaDaPlanilhaSchema.safeParse({ linha: 2, resultado: 'erro', erro: 'turma_sem_serie' }).success).toBe(true)
    expect(linhaDaPreviaDaPlanilhaSchema.safeParse({ linha: 2, resultado: 'erro' }).success).toBe(false)
    expect(linhaDaPreviaDaPlanilhaSchema.safeParse({ linha: 2, resultado: 'entra', erro: 'turma_sem_serie' }).success).toBe(false)
  })

  it('o código é uma palavra, não um texto montado com o dado da linha', () => {
    expect(linhaDaPreviaDaPlanilhaSchema.safeParse({ linha: 2, resultado: 'erro', erro: 'matrícula 2026001 repetida' }).success).toBe(false)
  })
})

describe('os modelos de planilha', () => {
  it('cada tipo tem o seu cabeçalho, e o aluno traz só turma, nome e matrícula (regra 20, item 2)', () => {
    expect(Object.keys(CABECALHOS_DA_PLANILHA).sort()).toEqual([...TIPOS_DE_PLANILHA].sort())
    expect(CABECALHOS_DA_PLANILHA.alunos).toEqual(['turma', 'nome', 'matricula'])
    expect(CABECALHOS_DA_PLANILHA.professores).toEqual(['nome', 'email'])
    expect(CABECALHOS_DA_PLANILHA.grade).toEqual(['turma', 'disciplina', 'professor', 'email', 'dia', 'inicio', 'fim', 'sala'])
    expect(CABECALHOS_DA_PLANILHA.calendario).toEqual(['inicio', 'fim', 'tipo', 'descricao'])
  })

  it('só a sala da grade pode ficar em branco, e é coluna do cabeçalho dela', () => {
    expect(COLUNAS_OPCIONAIS_DA_PLANILHA).toEqual({ alunos: [], professores: [], grade: ['sala'], calendario: [] })
    for (const tipo of TIPOS_DE_PLANILHA) for (const coluna of COLUNAS_OPCIONAIS_DA_PLANILHA[tipo]) expect(CABECALHOS_DA_PLANILHA[tipo] as readonly string[]).toContain(coluna)
  })
})

describe('a aula da grade e o evento do calendário', () => {
  const aula = { id: UM_UUID, turmaId: OUTRO_UUID, disciplinaId: null, professor: { usuarioId: UM_UUID, nome: 'Ana Lima' }, diaSemana: 1, inicio: '07:30', fim: '08:20', sala: null }

  it('a aula aceita o horário de hora e minuto, o dia de 1 a 7, e recusa o resto', () => {
    expect(aulaDaGradeSchema.safeParse(aula).success).toBe(true)
    for (const mudanca of [{ diaSemana: 0 }, { diaSemana: 8 }, { inicio: '7:30' }, { fim: '24:00' }, { inicio: '07:30:00' }]) expect(aulaDaGradeSchema.safeParse({ ...aula, ...mudanca }).success, JSON.stringify(mudanca)).toBe(false)
  })

  it('o evento tem descrição de 1 a 120 caracteres e data de verdade', () => {
    const evento = { id: UM_UUID, tipo: 'feriado', inicio: '2026-11-15', fim: '2026-11-15', descricao: 'Proclamação da República' }
    expect(eventoDoCalendarioSchema.safeParse(evento).success).toBe(true)
    expect(eventoDoCalendarioSchema.safeParse({ ...evento, descricao: 'x'.repeat(120) }).success).toBe(true)
    expect(eventoDoCalendarioSchema.safeParse({ ...evento, descricao: 'x'.repeat(121) }).success).toBe(false)
    expect(eventoDoCalendarioSchema.safeParse({ ...evento, descricao: '' }).success).toBe(false)
    expect(eventoDoCalendarioSchema.safeParse({ ...evento, inicio: '2026-13-01' }).success).toBe(false)
    expect(eventoDoCalendarioSchema.safeParse({ ...evento, tipo: 'prova' }).success).toBe(false)
  })
})
