import { jobRegistro, Unscoped, type Database, type DatabaseTransaction } from '@educa/core'
import type { QueueName } from '@educa/shared'
import { and, desc, eq } from 'drizzle-orm'

/** O job que falhou de vez, como a operação o vê: só ids, tipo, código e data. Nunca o `dados`. */
export interface JobQueFalhou {
  readonly id: string
  readonly escolaId: string | null
  readonly tipo: string
  readonly fila: QueueName
  readonly codigoFalha: string | null
  readonly concluidoEm: Date | null
}

/** Quantos jobs a listagem devolve: os mais recentes, o bastante para a operação agir sem paginar. */
export const LIMITE_DA_LISTA_DE_JOBS_QUE_FALHARAM = 200

const CAMPOS = {
  id: jobRegistro.id,
  escolaId: jobRegistro.escolaId,
  tipo: jobRegistro.tipo,
  fila: jobRegistro.fila,
  codigoFalha: jobRegistro.codigoFalha,
  concluidoEm: jobRegistro.concluidoEm,
}

/**
 * O que a operação lê de `job_registro` para listar, reprocessar e descartar (ingestao-do-material, 3.0; onda 3b, 46.0): só os jobs `falhou`,
 * de todas as escolas, porque o job que falhou de vez é nosso e a escola nem o vê. Os dois métodos são `@Unscoped` e **nenhum tem escopo**:
 * quem marca a linha (`reabrirFalho`, `descartarFalho`) é o `JobOutboxRepository`, no contexto da escola que a leitura devolve (regra 10, item 9:
 * são dois, e não passam de dois). Nenhum devolve `dados`: ele pode trazer o id do material e o do pedido.
 */
export class JobsQueFalharamRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  @Unscoped('comando da operação: lista os jobs que falharam de vez em todas as escolas; devolve só id, escola, tipo, fila, código e data, nunca o dados')
  async listar(): Promise<JobQueFalhou[]> {
    const linhas = await this.banco.select(CAMPOS).from(jobRegistro).where(eq(jobRegistro.estado, 'falhou')).orderBy(desc(jobRegistro.concluidoEm)).limit(LIMITE_DA_LISTA_DE_JOBS_QUE_FALHARAM)
    return linhas.map((linha) => ({ ...linha, fila: linha.fila as QueueName }))
  }

  /**
   * O job `falhou` com o id, travado até o fim da transação (`for update`): dois comandos sobre o mesmo job passam um de cada vez, e o segundo
   * já não o acha. Devolve o `dados` só com o que o descarte do PDF precisa: o id do material.
   */
  @Unscoped('comando da operação: acha o job que falhou pelo id, em qualquer escola, e o trava; devolve só id, escola, tipo, fila e o id do material do dados, nunca o resto')
  async travarFalho(id: string): Promise<(JobQueFalhou & { readonly materialId: string | null }) | undefined> {
    const [linha] = await this.banco
      .select({ ...CAMPOS, dados: jobRegistro.dados })
      .from(jobRegistro)
      .where(and(eq(jobRegistro.id, id), eq(jobRegistro.estado, 'falhou')))
      .for('update')
    if (linha === undefined) return undefined
    const { dados, ...resto } = linha
    const materialId = typeof dados['materialId'] === 'string' ? dados['materialId'] : null
    return { ...resto, fila: resto.fila as QueueName, materialId }
  }
}
