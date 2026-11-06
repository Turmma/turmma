import type { TipoDePlanilha } from './contratos.js'

/**
 * Os cabeçalhos dos quatro modelos de planilha (PRD, RF1 e RF2; Tech Spec, seção 9), na ordem das colunas. É daqui que a tela gera
 * o modelo para baixar e que a prévia confere o cabeçalho do arquivo que a coordenação sobe: o modelo baixado e preenchido entra
 * sem erro porque os dois lados leem esta tabela. Aluno traz só turma, nome e matrícula (regra 20, item 2).
 */
export const CABECALHOS_DA_PLANILHA = {
  alunos: ['turma', 'nome', 'matricula'],
  professores: ['nome', 'email'],
  grade: ['turma', 'disciplina', 'professor', 'email', 'dia', 'inicio', 'fim', 'sala'],
  calendario: ['inicio', 'fim', 'tipo', 'descricao'],
} as const satisfies Record<TipoDePlanilha, readonly string[]>

/** As colunas que podem ficar em branco: só a sala da grade (PRD, RF7). */
export const COLUNAS_OPCIONAIS_DA_PLANILHA = {
  alunos: [],
  professores: [],
  grade: ['sala'],
  calendario: [],
} as const satisfies Record<TipoDePlanilha, readonly string[]>
