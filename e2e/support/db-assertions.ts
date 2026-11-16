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

/**
 * Uma pergunta do aluno que o Tutor não respondeu (RF5, reengenharia-continuacao 9.0): a execução terminou `falhou` com `IA_INDISPONIVEL`, o corte da espera, e a
 * pergunta ficou na conversa, na questão de uma atividade aplicada. Gravada direto, porque o corte pede 20 s de fila parada e o caso é o da tela da professora.
 */
export async function semearPerguntaSemRespostaNoBanco(escolaId: string, turmaId: string, alunoId: string, atividadeAplicadaId: string, questao: number): Promise<void> {
  const banco = new Client({ connectionString: urlDoBancoDeTeste() })
  await banco.connect()
  try {
    await banco.query(
      `with cortada as (
         insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, estado, erro, entrada, concluida_em)
         select t.escola_id, t.ano_letivo_id, 'tutor_com_o_aluno', 'turno_do_tutor', $3, gen_random_uuid(), 'falhou', 'IA_INDISPONIVEL', '{"tarefa":"turno_do_tutor"}', now()
           from turma t where t.escola_id = $1 and t.id = $2
         returning id, escola_id, ano_letivo_id
       )
       insert into mensagem_tutor (escola_id, ano_letivo_id, turma_id, aluno_id, execucao_id, atividade_aplicada_id, questao, autor, texto)
       select escola_id, ano_letivo_id, $2, $3, id, $4, $5, 'aluno', 'Pergunta sintética sem resposta' from cortada`,
      [escolaId, turmaId, alunoId, atividadeAplicadaId, questao],
    )
  } finally {
    await banco.end()
  }
}
