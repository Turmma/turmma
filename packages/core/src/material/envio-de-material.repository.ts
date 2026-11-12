import { and, eq, lt, sql } from 'drizzle-orm'
import { requireEscolaId } from '../context/context-escola.js'
import type { Database, DatabaseTransaction } from '../db/database.js'
import { envioDeMaterial } from '../db/schema/material.js'

/**
 * A espera máxima pela trava da linha do envio, na transação do envio (`set local`): a varredura a segura enquanto apaga o objeto, e o envio que
 * espera mais que isso desfaz com 503 em vez de prender a requisição. É menor que o `statement_timeout` da API (2 s), que cortaria a espera antes
 * e daria `57014` no lugar do `55P03`.
 */
export const ESPERA_MAXIMA_PELA_LINHA_DO_ENVIO_MS = 1_000

/**
 * A linha do envio em andamento (ingestao-do-material, tarefa 2.0; Tech Spec, seção 5, "Envio e edição"), na escola do contexto e só nela
 * (regra 10, item 3): nenhum método recebe a escola. A linha nasce **antes** de o objeto ir ao storage e sai na transação do envio; o que sobra
 * (a API caiu, o PUT atrasado gravou depois do `apagar`, o `apagar` falhou) a varredura horária acha pela linha. Sem pessoa, só ids e um instante.
 */
export class EnvioDeMaterialRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /** Grava a linha do envio, com o instante do banco. Roda fora da transação do envio: precisa estar no banco **antes** do `guardarBytes`. */
  async registrar(materialId: string): Promise<void> {
    await this.banco.insert(envioDeMaterial).values({ escolaId: requireEscolaId(), materialId })
  }

  /**
   * Apaga a linha dentro da transação do envio, sob `lock_timeout` curto, e devolve se havia linha. `false` é "a varredura já a apagou" (o envio
   * foi lento demais): quem chama desfaz o envio com 503, para o material nunca existir sem o objeto que a varredura apagou. O `55P03` da espera
   * pela trava da varredura sobe como erro, e quem chama também o trata como 503. Só vale dentro de transação: o `set local` morre com ela.
   */
  async apagarNoEnvio(materialId: string): Promise<boolean> {
    const escolaId = requireEscolaId()
    await this.banco.execute(sql`select set_config('lock_timeout', ${String(ESPERA_MAXIMA_PELA_LINHA_DO_ENVIO_MS)}, true)`)
    const apagadas = await this.banco
      .delete(envioDeMaterial)
      .where(and(eq(envioDeMaterial.escolaId, escolaId), eq(envioDeMaterial.materialId, materialId)))
      .returning({ materialId: envioDeMaterial.materialId })
    return apagadas.length > 0
  }

  /** Apaga a linha sem transação: o `catch` do envio e a varredura a chamam **depois** de o objeto sair do storage. Linha que não existe não é erro. */
  async apagar(materialId: string): Promise<void> {
    await this.banco.delete(envioDeMaterial).where(and(eq(envioDeMaterial.escolaId, requireEscolaId()), eq(envioDeMaterial.materialId, materialId)))
  }

  /**
   * Trava a linha do envio, se ela tem mais de uma hora, para a varredura apagar o objeto e a linha sem o envio lento entrar no meio. `for update
   * skip locked`: a linha que um envio em andamento já travou (ele a apaga no fim da transação dele) é pulada, e o objeto fica para o envio. Devolve se
   * a linha foi travada. Só vale dentro da transação da varredura: a trava morre com ela.
   */
  async travarParada(materialId: string, criadaAntesDe: Date): Promise<boolean> {
    const travadas = await this.banco
      .select({ materialId: envioDeMaterial.materialId })
      .from(envioDeMaterial)
      .where(and(eq(envioDeMaterial.escolaId, requireEscolaId()), eq(envioDeMaterial.materialId, materialId), lt(envioDeMaterial.criadoEm, criadaAntesDe)))
      .for('update', { skipLocked: true })
    return travadas.length > 0
  }
}
