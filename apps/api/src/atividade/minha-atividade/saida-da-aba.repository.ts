import { requireAnoEmCurso, requireEscolaId, requestSessao, saidaDaAba, tentativaAtividade, type Database, type DatabaseTransaction } from '@educa/core'
import { and, eq, sql } from 'drizzle-orm'

/**
 * A saída da aba do aluno da sessão (avaliacao-e-correcao, 8.0; D70; regra 10, itens 3 e 5; regra 20). **O aluno é o da sessão**, a escola e o ano são os do contexto: nenhum deles chega por
 * argumento. A `saida_da_aba` guarda só a chave (uuid v4 da tela), sem `id` e sem horário; a contagem que o professor lê é `tentativa_atividade.saidas_da_aba`, **por tentativa**, e nunca somada
 * por aluno entre provas.
 *
 * Quem chama (`MinhaAtividadeService.registrarSaida`) já achou a atividade na turma do aluno e viu que a prova está em andamento; este repository ainda assim só grava para a tentativa que o
 * aluno da sessão tem **neste escopo**: com o id de uma aplicação de outra escola ou de outro ano, não há tentativa, e nada é gravado.
 */
export class SaidaDaAbaRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /**
   * Registra a saída e soma na tentativa **só se a chave é nova** (`on conflict do nothing` na chave primária: o reenvio da fila da tela, depois de um 5xx, não conta duas vezes). Diz se a
   * chave era nova: o service não usa o valor (a rota responde 204 nos dois casos, para o reenvio não ter resposta diferente), e ele existe para o teste do repository provar a chave repetida e o escopo. A linha só nasce de uma tentativa do aluno da sessão, na escola e no ano do contexto (`insert … select` dela), então um id que não é dali devolve `false` sem tocar em nada.
   *
   * **A soma é do banco** (`saidas_da_aba + 1`), nunca "lê a contagem e grava o lido mais um": duas saídas de chaves diferentes ao mesmo tempo somam as duas. A tentativa não é travada antes
   * do `insert`, e o `update` dela só vem depois, na mesma transação.
   */
  async registrar(atividadeAplicadaId: string, chave: string): Promise<boolean> {
    const escolaId = requireEscolaId()
    const anoLetivoId = requireAnoEmCurso()
    const alunoId = requestSessao().usuarioId
    const daTentativa = and(
      eq(tentativaAtividade.escolaId, escolaId),
      eq(tentativaAtividade.anoLetivoId, anoLetivoId),
      eq(tentativaAtividade.atividadeAplicadaId, atividadeAplicadaId),
      eq(tentativaAtividade.alunoId, alunoId),
    )
    const nova = await this.banco
      .insert(saidaDaAba)
      .select(
        this.banco
          .select({
            escolaId: tentativaAtividade.escolaId,
            anoLetivoId: tentativaAtividade.anoLetivoId,
            atividadeAplicadaId: tentativaAtividade.atividadeAplicadaId,
            alunoId: tentativaAtividade.alunoId,
            chave: sql<string>`${chave}::uuid`.as('chave'),
          })
          .from(tentativaAtividade)
          .where(daTentativa),
      )
      .onConflictDoNothing()
      .returning({ chave: saidaDaAba.chave })
    if (nova.length === 0) return false
    await this.banco
      .update(tentativaAtividade)
      .set({ saidasDaAba: sql`${tentativaAtividade.saidasDaAba} + 1` })
      .where(daTentativa)
    return true
  }
}
