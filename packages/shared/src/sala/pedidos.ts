import { z } from 'zod'
import { paginationQuerySchema, pageSchema } from '../estrutura/pagination.js'
import { FINALIDADES_DA_LEITURA_DE_ALUNOS } from '../estrutura/turma.js'

/**
 * Os pedidos de reivindicação da turma e a decisão sobre eles (A1, tarefa 8.0, RF12 e RF13; Tech Spec da A1, seções 4 e
 * 5): o professor com vínculo confirmado na turma e a coordenação leem os pedidos pendentes e decidem os selecionados.
 * Só a aprovação de uma pessoa cria o aluno (D4, regra 60, item 7). Nada de escola nem de ano vem do cliente.
 */

/** Mais pedidos que uma decisão leva de uma vez (RF12: não há "aprovar todos"; a tela explica o teto). */
export const MAXIMO_DE_PEDIDOS_POR_DECISAO = 40

/**
 * Consulta de `GET /v1/turmas/:id/reivindicacoes`: a página e a finalidade, a mesma lista fechada da leitura dos alunos
 * da turma. A coordenação é obrigada a mandá-la (regra 20, item 10), e a falta dela é `ENTRADA_INVALIDA` antes de procurar
 * a turma; o professor com vínculo confirmado lê sem finalidade, e a que ele mandar não grava nada. Estrita.
 */
export const pedidosDaTurmaQuerySchema = paginationQuerySchema.extend({ finalidade: z.enum(FINALIDADES_DA_LEITURA_DE_ALUNOS).optional() }).strict()
export type PedidosDaTurmaQuery = z.infer<typeof pedidosDaTurmaQuerySchema>

/**
 * Um pedido pendente, como quem decide o vê: o id, o nome da lista que o aluno escolheu, a hora do pedido e se houve
 * tentativa com matrícula errada naquele nome (só sim ou não, sem número, hora nem matrícula tentada). Nunca a matrícula,
 * o hash nem a chave do envio.
 */
export const pedidoDaTurmaSchema = z.strictObject({
  id: z.uuid(),
  nome: z.string().min(1),
  solicitadaEm: z.iso.datetime(),
  teveMatriculaErrada: z.boolean(),
})
export type PedidoDaTurma = z.infer<typeof pedidoDaTurmaSchema>

/** Resposta de `GET /v1/turmas/:id/reivindicacoes`: os pedidos pendentes da turma em ordem de id, com `proxima` quando há mais. */
export const pedidosDaTurmaResponseSchema = pageSchema(pedidoDaTurmaSchema)
export type PedidosDaTurmaResponse = z.infer<typeof pedidosDaTurmaResponseSchema>

/** O que quem decide faz com os pedidos selecionados: aprovar cria o aluno; recusar devolve o nome à lista. */
export const DECISOES_DE_PEDIDO = ['aprovar', 'recusar'] as const
export type DecisaoDePedido = (typeof DECISOES_DE_PEDIDO)[number]

/**
 * Corpo de `POST /v1/reivindicacoes/decidir`: de 1 a 40 ids, sem repetir, e a decisão, a mesma para todos. Estrito:
 * `escolaId`, `turmaId` ou qualquer campo a mais é `ENTRADA_INVALIDA`.
 */
export const decidirReivindicacoesRequestSchema = z.strictObject({
  ids: z
    .array(z.uuid())
    .min(1)
    .max(MAXIMO_DE_PEDIDOS_POR_DECISAO)
    .refine((ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length, 'id repetido'),
  decisao: z.enum(DECISOES_DE_PEDIDO),
})
export type DecidirReivindicacoesRequest = z.infer<typeof decidirReivindicacoesRequestSchema>

/**
 * O que aconteceu com cada id (Tech Spec da A1, seção 4, "Uma resposta só"): `decidida` por este pedido; `ja_decidida`,
 * o pedido que quem decide alcança e que outra decisão fechou antes; `nao_encontrada`, o inexistente, o de outra escola ou
 * ano e, para o professor, o de turma sem vínculo confirmado dele, igual para todos.
 */
export const RESULTADOS_DA_DECISAO = ['decidida', 'ja_decidida', 'nao_encontrada'] as const
export type ResultadoDaDecisao = (typeof RESULTADOS_DA_DECISAO)[number]

/** Resposta de `POST /v1/reivindicacoes/decidir`: o resultado de cada id, na ordem do pedido. Estrita: nada do aluno. */
export const decisaoResponseSchema = z.strictObject({
  resultados: z.array(z.strictObject({ id: z.uuid(), resultado: z.enum(RESULTADOS_DA_DECISAO) })).max(MAXIMO_DE_PEDIDOS_POR_DECISAO),
})
export type DecisaoResponse = z.infer<typeof decisaoResponseSchema>
