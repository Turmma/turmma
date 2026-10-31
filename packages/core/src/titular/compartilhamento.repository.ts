import { sql, type SQL } from 'drizzle-orm'
import { InvariantException } from '@educa/shared'
import { requireEscolaId } from '../context/context-escola.js'
import type { Database, DatabaseTransaction } from '../db/database.js'
import { FUSO_DO_USO, diaDeUso } from '../usage/usage-day.js'

/** Uma chamada com envio externo atribuível ao titular: o `provedor` é nulo na linha anterior à migration da 7.0. */
export interface ChamadaDoRastro {
  readonly provedor: string | null
  readonly em: Date
}

/**
 * O rastro do aluno em dois ramos de `union all` (F3, tarefa 13.0; Tech Spec do F3, seção 5, "O índice do rastro"): o do
 * `aluno_id`, que desce pelo `consumo_ia_aluno_idx`, e o da execução que ele pediu, que desce pelo
 * `execucao_agente_solicitada_por_idx` e pelo `consumo_ia_execucao_idx`, os dois começando pela escola. Fica fora da classe
 * para o teste de plano usar a mesma instrução que o código roda; a escola é a do contexto, e nunca um argumento.
 */
export function alunoTrailStatement(titularId: string): SQL {
  const escolaId = requireEscolaId()
  return sql`
      select c.provedor, c.em from consumo_ia c
      where c.escola_id = ${escolaId} and c.envio_externo and c.aluno_id = ${titularId}
      union all
      select c.provedor, c.em from consumo_ia c
      join execucao_agente x on x.escola_id = c.escola_id and x.id = c.execucao_id
      where c.escola_id = ${escolaId} and c.envio_externo and x.solicitada_por = ${titularId}
      order by em
    `
}

/** O uso real de um provedor pelo professor: a primeira e a última chamada com envio externo. */
export interface UsoRealPorProvedor {
  readonly provedor: string | null
  readonly primeiro: Date
  readonly ultimo: Date
}

/** O vínculo do titular como professor: quando ele saiu, e se algum segue aberto. */
export interface VinculosDoProfessor {
  readonly encerrado: Date | null
  readonly abertos: number
}

/**
 * As leituras do compartilhamento do titular (F3, tarefa 12.0; regra 00, item 3: o repository é o único lugar que toca
 * o banco). A regra — período, rastro, reserva e hospedagem — fica no `Compartilhamento`, que chama este.
 *
 * **Cada método lê a escola do contexto e nenhum a recebe por parâmetro** (regra 10, item 3): quem chamou não decide
 * o escopo, e não existe caminho para ler o dado de outra escola. O filtro por `escola_id` das consultas é a segunda camada,
 * atrás das FKs compostas (`consumo_ia_aluno_da_escola_fk`, `consumo_ia_execucao_da_escola_fk`,
 * `execucao_agente_solicitada_por_da_escola_fk` e as de `vinculo`, `credencial_matricula` e `conta_externa`), que já impedem
 * a linha de outra escola de apontar para o titular: ele fica para quem alterar a consulta.
 */
export class CompartilhamentoRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /** O horizonte do rastro (o prazo da categoria, em meses) e o fim do dia de uso do `agora`, pela aritmética do banco. */
  async datasDeReferencia(agora: Date, meses: number): Promise<{ horizonte: Date; fimDoDia: Date }> {
    const { rows } = await this.banco.execute<{ horizonte: Date | string; fimDoDia: Date | string }>(sql`
      select (${agora.toISOString()}::timestamptz - make_interval(months => ${meses})) as horizonte,
             (((${diaDeUso(agora)}::date + 1)::timestamp at time zone ${FUSO_DO_USO}) - interval '1 millisecond') as "fimDoDia"
    `)
    const horizonte = dataDoBanco(rows[0]?.horizonte ?? null)
    const fimDoDia = dataDoBanco(rows[0]?.fimDoDia ?? null)
    if (horizonte === null || fimDoDia === null) throw new InvariantException('datas de referência do compartilhamento não calculadas')
    return { horizonte, fimDoDia }
  }

  /** O vínculo do titular como professor, na escola do contexto: o `encerrado_em` mais recente e quantos seguem abertos. */
  async vinculosDoProfessor(titularId: string): Promise<VinculosDoProfessor> {
    const escolaId = requireEscolaId()
    const { rows } = await this.banco.execute<{ encerrado: Date | string | null; abertos: number }>(sql`
      select max(encerrado_em) as encerrado, count(*) filter (where encerrado_em is null)::int as abertos
      from vinculo where escola_id = ${escolaId} and usuario_id = ${titularId} and papel = 'professor'
    `)
    return { encerrado: dataDoBanco(rows[0]?.encerrado ?? null), abertos: rows[0]?.abertos ?? 0 }
  }

  /** A entrada do aluno na escola do contexto: a mais antiga entre a credencial de matrícula e a conta externa ligada. */
  async entradaDoAluno(titularId: string): Promise<Date | null> {
    const escolaId = requireEscolaId()
    const { rows } = await this.banco.execute<{ entrada: Date | string | null }>(sql`
      select least(
        (select min(criada_em) from credencial_matricula where escola_id = ${escolaId} and usuario_id = ${titularId}),
        (select min(ligada_em) from conta_externa where escola_id = ${escolaId} and usuario_id = ${titularId})
      ) as entrada
    `)
    return dataDoBanco(rows[0]?.entrada ?? null)
  }

  /** A entrada do titular como professor, na escola do contexto: o `criado_em` mais antigo dos vínculos dele. */
  async entradaDoProfessor(titularId: string): Promise<Date | null> {
    const escolaId = requireEscolaId()
    const { rows } = await this.banco.execute<{ entrada: Date | string | null }>(sql`
      select min(criado_em) as entrada from vinculo
      where escola_id = ${escolaId} and usuario_id = ${titularId} and papel = 'professor'
    `)
    return dataDoBanco(rows[0]?.entrada ?? null)
  }

  /**
   * As chamadas com envio externo atribuíveis ao titular, na escola do contexto: as que levam o `aluno_id` dele e as
   * das execuções que ele pediu. A linha sem `provedor` é a antiga, anterior à migration da 7.0.
   *
   * **Dois ramos em `union all`, e não um `or` com subconsulta** (triagem de 09/10/2026; Tech Spec do F3, seção 5, "O
   * índice do rastro"): o `or` não desce por índice e lê o consumo da escola inteira (regra 80, item 8). O ramo do
   * `aluno_id` desce pelo `consumo_ia_aluno_idx`; o da execução, pelo `execucao_agente_solicitada_por_idx` e pelo
   * `consumo_ia_execucao_idx`, os dois por `escola_id`. A chamada do Tutor casa pelos dois ramos e vem repetida: o
   * agrupamento usa só a primeira e a última data de cada (`provedor`, suboperador), e a repetição não muda nenhuma.
   */
  async rastroDoAluno(titularId: string): Promise<ChamadaDoRastro[]> {
    const { rows } = await this.banco.execute<{ provedor: string | null; em: Date | string }>(alunoTrailStatement(titularId))
    return rows.map(({ provedor, em }) => ({ provedor, em: dataDoBanco(em) ?? new Date(NaN) }))
  }

  /**
   * O uso real da IA por empresa de um professor, na escola do contexto: por `provedor`, a primeira e a última chamada com
   * envio externo das execuções que ele pediu. **Só o arquivo completo do próprio professor o lê** (D64): a coordenação
   * nunca vê quando um professor usou a IA, e a foto do pedido dele é só por período. A linha sem `provedor` é a antiga.
   */
  async usoRealDoProfessor(titularId: string): Promise<UsoRealPorProvedor[]> {
    const escolaId = requireEscolaId()
    const { rows } = await this.banco.execute<{ provedor: string | null; primeiro: Date | string; ultimo: Date | string }>(sql`
      select c.provedor, min(c.em) as primeiro, max(c.em) as ultimo from consumo_ia c
      join execucao_agente x on x.escola_id = c.escola_id and x.id = c.execucao_id
      where c.escola_id = ${escolaId} and c.envio_externo and x.solicitada_por = ${titularId}
      group by c.provedor
      order by min(c.em), c.provedor
    `)
    return rows.map(({ provedor, primeiro, ultimo }) => ({ provedor, primeiro: dataDoBanco(primeiro) ?? new Date(NaN), ultimo: dataDoBanco(ultimo) ?? new Date(NaN) }))
  }
}

/**
 * O `timestamptz` de uma consulta crua (`execute`) vem como texto, e só as colunas do drizzle são convertidas pelo
 * mapper delas; é por isso que a reconciliação do job também o trata como `::text`. A foto trabalha em instante.
 */
function dataDoBanco(valor: Date | string | null): Date | null {
  return valor === null ? null : valor instanceof Date ? valor : new Date(valor)
}
