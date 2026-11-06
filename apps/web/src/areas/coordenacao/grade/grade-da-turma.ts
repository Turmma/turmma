import type { AulaDaGrade } from '@educa/shared'

/**
 * A grade de uma turma montada para a tabela (F2, 14.0; Tech Spec, seção 9): os dias nas colunas e os horários nas linhas. Fora da
 * tela para ser provada sem navegador. Nenhuma regra de negócio mora aqui: quem diz o que é aula, e de quem, é a API; esta peça só
 * as põe no lugar que a coordenação lê.
 */

/** Os sete dias, de 1 (segunda) a 7 (domingo), como o `diaSemana` da API. */
const NOME_DO_DIA: Readonly<Record<number, string>> = { 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado', 7: 'Domingo' }

/** A grade sempre mostra segunda a sexta; sábado e domingo só aparecem quando alguma aula cai neles. */
const DIAS_DA_SEMANA_LETIVA = [1, 2, 3, 4, 5] as const

export const NOME_DA_DISCIPLINA_QUE_SAIU = 'Disciplina sem nome'

export interface DiaDaGrade {
  readonly numero: number
  readonly nome: string
}

export interface HorarioDaGrade {
  readonly chave: string
  readonly inicio: string
  readonly fim: string
}

/** O que a célula diz de uma aula: a disciplina, o professor (só o nome) e a sala, se houver. */
export interface AulaDaCelula {
  readonly id: string
  readonly disciplina: string
  readonly professor: string
  readonly sala: string | null
}

export interface GradeMontada {
  readonly dias: readonly DiaDaGrade[]
  readonly horarios: readonly HorarioDaGrade[]
  /** As aulas de um dia e horário: mais de uma é possível (turma dividida, aula conjunta), e todas aparecem. */
  readonly aulasEm: (dia: number, horario: HorarioDaGrade) => readonly AulaDaCelula[]
}

const chaveDoHorario = (inicio: string, fim: string): string => `${inicio}-${fim}`

export function montarGrade(aulas: readonly AulaDaGrade[], nomeDaDisciplina: (disciplinaId: string | null) => string | undefined): GradeMontada {
  const diasComAula = new Set(aulas.map(({ diaSemana }) => diaSemana))
  const dias = [1, 2, 3, 4, 5, 6, 7].filter((dia) => (DIAS_DA_SEMANA_LETIVA as readonly number[]).includes(dia) || diasComAula.has(dia)).map((numero) => ({ numero, nome: NOME_DO_DIA[numero] ?? String(numero) }))
  const horarios = [...new Map(aulas.map(({ inicio, fim }) => [chaveDoHorario(inicio, fim), { chave: chaveDoHorario(inicio, fim), inicio, fim }])).values()].sort((a, b) =>
    a.inicio === b.inicio ? a.fim.localeCompare(b.fim) : a.inicio.localeCompare(b.inicio),
  )
  const celulas = new Map<string, AulaDaCelula[]>()
  for (const aula of aulas) {
    const chave = `${String(aula.diaSemana)}|${chaveDoHorario(aula.inicio, aula.fim)}`
    const daCelula = celulas.get(chave) ?? []
    daCelula.push({ id: aula.id, disciplina: nomeDaDisciplina(aula.disciplinaId) ?? NOME_DA_DISCIPLINA_QUE_SAIU, professor: aula.professor.nome, sala: aula.sala })
    celulas.set(chave, daCelula)
  }
  for (const daCelula of celulas.values()) daCelula.sort((a, b) => a.disciplina.localeCompare(b.disciplina, 'pt-BR') || a.professor.localeCompare(b.professor, 'pt-BR'))
  return { dias, horarios, aulasEm: (dia, horario) => celulas.get(`${String(dia)}|${horario.chave}`) ?? [] }
}
