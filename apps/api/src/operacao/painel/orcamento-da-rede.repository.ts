import { rede, Unscoped, type DatabaseExecutor } from '@educa/core'
import { mesmoOrcamentoDefinido, type OrcamentoDefinido } from '@educa/shared'
import { eq } from 'drizzle-orm'

/** O que o `PUT` da rede devolve: o que ela definia antes, e se o pedido mudou algo (só então gravou, e só então se audita). */
export interface OrcamentoDaRedeDefinido {
  readonly antes: OrcamentoDefinido
  readonly mudou: boolean
}

/**
 * O orçamento de IA da rede (camada-ia, tarefa 3.0; Tech Spec, seções 3, 5 e 6; RF7): o valor por aluno e o teto de segurança que a escola herda quando não tem os dela. A rede fica **acima do tenant**, sem
 * escola e sem contexto de escola, e por isso o `PUT` dela é a exceção declarada da operação: um único método `@Unscoped`, o `definir`, que prende cada leitura e a escrita ao **id da rede do caminho**
 * (`where rede.id`). Só o `painel.service.ts` o usa, na transação do `PUT`, depois de conferir o autor.
 *
 * `select … for update` e a gravação na mesma transação: dois `PUT` da mesma rede esperam um pelo outro na linha, e o segundo lê como `antes` o que o primeiro gravou. Sem `insert`: a linha da rede já existe, e
 * a rede inexistente não tem linha a travar (devolve `undefined`).
 */
export class OrcamentoDaRedeRepository {
  constructor(private readonly banco: DatabaseExecutor) {}

  @Unscoped('acima do tenant: a rede não tem escola; só o painel do operador a grava, pelo id do caminho, e devolve só valor e teto')
  async definir(redeId: string, depois: OrcamentoDefinido): Promise<OrcamentoDaRedeDefinido | undefined> {
    const [linha] = await this.banco
      .select({ valorPorAlunoMicros: rede.iaValorPorAlunoMicros, tetoPercentual: rede.iaTetoDeSegurancaPercentual })
      .from(rede)
      .where(eq(rede.id, redeId))
      .for('update')
    if (linha === undefined) return undefined
    const antes: OrcamentoDefinido = { valorPorAlunoMicros: linha.valorPorAlunoMicros, tetoPercentual: linha.tetoPercentual }
    if (mesmoOrcamentoDefinido(antes, depois)) return { antes, mudou: false }
    await this.banco.update(rede).set({ iaValorPorAlunoMicros: depois.valorPorAlunoMicros, iaTetoDeSegurancaPercentual: depois.tetoPercentual }).where(eq(rede.id, redeId))
    return { antes, mudou: true }
  }
}
