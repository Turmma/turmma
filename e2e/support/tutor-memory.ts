import { randomUUID } from 'node:crypto'
import type { MemoriaDoTutorResponse } from '../../packages/shared/src/index.ts'

/**
 * O que `GET /v1/tutor/memoria` entrega, para o teste de "Como estou indo" (telas do aluno e primeiro acesso, 7.0): o
 * trabalho que o Tutor lembra, com ou sem correção aprovada, e a resposta inteira com os `sinais`. Dado inventado, de
 * ninguém. Serve só ao e2e (`aluno-eu.spec.ts`): o teste de componente de Eu monta o contrato num ajudante próprio, porque o `tsc` da web não compila este import (divergência registrada em `7_task.md`).
 */
export type TrabalhoNaMemoria = MemoriaDoTutorResponse['trabalhos'][number]
export type ResultadoDoTrabalho = NonNullable<TrabalhoNaMemoria['resultado']>

/** O trabalho enviado. Sem `resultado`, a correção ainda espera a aprovação de quem dá a aula (`resultado: null`). */
export function trabalhoNaMemoria(campos: Partial<TrabalhoNaMemoria> = {}): TrabalhoNaMemoria {
  return { atividadeAplicadaId: randomUUID(), titulo: 'Lista sintética de reações', enviadaEm: '2026-10-05T13:00:00.000Z', resultado: null, ...campos }
}

/** A correção aprovada: quantas certas de quantas e as habilidades a rever, na ordem que a API mandou. */
export function resultadoAprovado(campos: Partial<ResultadoDoTrabalho> = {}): ResultadoDoTrabalho {
  return { acertos: 7, total: 8, aReforcar: [], ...campos }
}

/** A resposta da memória com os trabalhos dados e um sinal de trabalho, que a tela de Eu não pode mostrar nem guardar. */
export function memoriaDoAluno(trabalhos: readonly TrabalhoNaMemoria[]): MemoriaDoTutorResponse {
  return { trabalhos: [...trabalhos], sinais: [{ tipo: 'resposta_pronta', atividadeAplicadaId: trabalhos[0]?.atividadeAplicadaId ?? null, questao: 3, criadoEm: '2026-10-05T13:30:00.000Z' }] }
}
