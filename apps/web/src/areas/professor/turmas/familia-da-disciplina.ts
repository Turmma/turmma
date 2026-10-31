import type { FamiliaDeCor } from '../../../components/ui/Contador'

/**
 * As famílias que o ladrilho da disciplina pode ter. O amarelo é da faixa "Confirme sua turma" e o vermelho é de erro e de perigo:
 * cor é categoria e nunca julgamento (`docs/interface.md` 9.1), então a disciplina não toma nenhuma das duas.
 */
const FAMILIAS_DA_DISCIPLINA = ['azul', 'verde', 'roxo', 'turquesa', 'anil', 'lima', 'rosa', 'laranja'] as const satisfies readonly FamiliaDeCor[]

/**
 * A família do ladrilho de uma disciplina, a mesma sempre para o mesmo id: a cor reconhece a disciplina de relance, e dois
 * cartões da mesma disciplina não discordam. Sem disciplina no vínculo, vale o id da turma.
 */
export function familiaDaDisciplina(id: string): FamiliaDeCor {
  let soma = 0
  for (const caractere of id) soma = (soma * 31 + caractere.charCodeAt(0)) % 9973
  return FAMILIAS_DA_DISCIPLINA[soma % FAMILIAS_DA_DISCIPLINA.length] ?? 'azul'
}
