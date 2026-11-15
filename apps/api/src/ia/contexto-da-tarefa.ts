import { nomeDaSerie } from '@educa/shared'

/** O teto de série e de disciplina no contexto das tarefas de IA (os schemas da tarefa). */
const TAMANHO_MAXIMO_DO_CONTEXTO = 60

/** Série e disciplina como a tarefa as recebe: o nome que a escola deu, sem nome de turma nem de pessoa. */
export function contextoDaTarefa(turma: { serie: { etapa: 'ef_anos_finais' | 'em'; ano: number }; disciplina: string }): { serie: string; disciplina: string } {
  return { serie: nomeDaSerie(turma.serie).slice(0, TAMANHO_MAXIMO_DO_CONTEXTO), disciplina: turma.disciplina.slice(0, TAMANHO_MAXIMO_DO_CONTEXTO) }
}
