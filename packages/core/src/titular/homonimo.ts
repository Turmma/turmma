import { sql } from 'drizzle-orm'
import { requireEscolaId } from '../context/context-escola.js'
import type { Database, DatabaseTransaction } from '../db/database.js'

/**
 * Se o nome do titular é o de outra pessoa da escola (F3, RF15; Tech Spec do F3, seção 5, "Eliminação"): outro **aluno ativo**
 * com o mesmo nome completo, ou um nome **livre** igual na lista de nomes de qualquer turma. A comparação é por nome inteiro,
 * sem caixa e sem espaço nas pontas, feita pelo banco (`lower(btrim())`) com o nome que o próprio `usuario` guarda.
 *
 * É **a regra da troca de nome**, uma só para os três lugares que a usam: a prévia e o registro do pedido (a coordenação vê o
 * aviso antes de pedir) e a etapa 2 do job da eliminação (sem troca, porque o texto livre com aquele nome pode ser do outro).
 * A resposta é só sim ou não: nunca diz quem é o outro. A escola é a do contexto, e o professor nunca conta como
 * homônimo (a troca só acontece para aluno).
 */
export async function haHomonimoDoTitular(banco: Database | DatabaseTransaction, titularId: string): Promise<boolean> {
  const escolaId = requireEscolaId()
  const { rows } = await banco.execute<{ homonimo: boolean }>(sql`
    select (
      exists (
        select 1 from usuario t
        join usuario u on u.escola_id = t.escola_id and u.id <> t.id and u.papel = 'aluno' and u.desativado_em is null
          and lower(btrim(u.nome)) = lower(btrim(t.nome))
        where t.escola_id = ${escolaId} and t.id = ${titularId}
      )
      or exists (
        select 1 from usuario t
        join lista_nome l on l.escola_id = t.escola_id and l.estado = 'livre' and lower(btrim(l.nome)) = lower(btrim(t.nome))
        where t.escola_id = ${escolaId} and t.id = ${titularId}
      )
    ) as homonimo
  `)
  return rows[0]?.homonimo ?? false
}
