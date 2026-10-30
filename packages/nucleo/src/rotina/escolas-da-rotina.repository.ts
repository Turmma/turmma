import { asc } from 'drizzle-orm'
import type { Database } from '../db/banco.js'
import { escola } from '../db/schema/escola.js'
import { Unscoped } from '../db/sem-escopo.decorator.js'

/**
 * As escolas que a rotina noturna percorre (F3, tarefa 3.0; Tech Spec do F3, seção 6). A rotina do sistema não tem
 * escola: para fazer qualquer coisa numa escola, ela precisa saber quais existem, e abrir o contexto de cada uma. Daqui
 * em diante tudo roda no contexto da escola, por repositories com escopo.
 *
 * É infraestrutura de rotina, e não de retenção: devolve só os ids, nada mais da escola, e nenhum dado de pessoa. É a
 * única consulta sem escopo do F3 que não é da conta global, da operação ou do expurgo de acesso.
 */
export class CronEscolasRepository {
  constructor(private readonly banco: Database) {}

  /** Os ids de todas as escolas, em ordem: para a rotina noturna e para a medição do alerta de duas noites. Só os ids. */
  @Unscoped(
    'rotina noturna: para abrir o contexto de cada escola, a rotina do sistema (sem escola) e a medição do alerta dela, ' +
      'no worker-lote, precisam saber quais escolas existem; devolve só os ids, sem nenhum outro campo da escola nem dado de ' +
      'pessoa, e não atende requisição de escola nenhuma',
  )
  async listarIds(): Promise<string[]> {
    const linhas = await this.banco.select({ id: escola.id }).from(escola).orderBy(asc(escola.id))
    return linhas.map(({ id }) => id)
  }
}
