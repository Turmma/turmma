import { Client } from 'pg'
import { urlDoBancoDeTeste } from '../../tools/ci/compose.ts'

/**
 * O que o e2e do fluxo da A2 confere direto no Postgres do compose de teste: a decisão da entrega como ficou gravada.
 * A tela diz quem aprovou e quando; o banco é o que prova que a decisão registrada existe (regra 70, itens 3 e 6).
 */
export interface EntregaNoBanco {
  readonly tipo: string
  readonly funcao: string
  readonly estado: string
  readonly decididaPor: string | null
  readonly decidida: boolean
  readonly justificativa: string | null
}

/** As entregas da escola, na ordem em que nasceram. */
export async function entregasNoBanco(escolaId: string): Promise<EntregaNoBanco[]> {
  const banco = new Client({ connectionString: urlDoBancoDeTeste() })
  await banco.connect()
  try {
    const { rows } = await banco.query<EntregaNoBanco>(
      `select tipo, funcao, estado, decidida_por as "decididaPor", decidida_em is not null as decidida, justificativa
         from entrega where escola_id = $1 order by id`,
      [escolaId],
    )
    return rows
  } finally {
    await banco.end()
  }
}

/** As atividades aplicadas da escola, com a entrega do lote de cada uma, na ordem em que nasceram. */
export async function atividadesAplicadasNoBanco(escolaId: string): Promise<Array<{ id: string; estado: string; avaliativa: boolean }>> {
  const banco = new Client({ connectionString: urlDoBancoDeTeste() })
  await banco.connect()
  try {
    const { rows } = await banco.query<{ id: string; estado: string; avaliativa: boolean }>('select id, estado, avaliativa from atividade_aplicada where escola_id = $1 order by id', [escolaId])
    return rows
  } finally {
    await banco.end()
  }
}

/** O registro da validação de cada lote aprovado da escola (D56): quem confirmou, quantos destaques foram apresentados e quantos foram abertos. */
export async function validacoesNoBanco(escolaId: string): Promise<Array<{ confirmadaPor: string; apresentados: number; abertos: number }>> {
  const banco = new Client({ connectionString: urlDoBancoDeTeste() })
  await banco.connect()
  try {
    const { rows } = await banco.query<{ confirmadaPor: string; apresentados: number; abertos: number }>(
      `select confirmada_por as "confirmadaPor", jsonb_array_length(apresentado -> 'destaques') as apresentados, jsonb_array_length(aberto) as abertos
         from validacao_do_lote where escola_id = $1 order by id`,
      [escolaId],
    )
    return rows
  } finally {
    await banco.end()
  }
}
