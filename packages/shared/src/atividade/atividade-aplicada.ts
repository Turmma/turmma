import { z } from 'zod'
import { ESTADOS_DE_ENTREGA } from '../assistente/entrega.js'
import { paginationQuerySchema, pageSchema } from '../estrutura/pagination.js'

/**
 * A atividade aplicada (MVP, A3): o professor aplica uma atividade objetiva à turma, os alunos respondem, e o professor
 * encerra. **Aplicar é o ato humano registrado que leva a saída da IA ao aluno** (regra 70, item 3): fica com autor e
 * data na linha e na auditoria (`atividade.aplicada`). Nesta fatia não há `Nota` (D46): o que sai é diagnóstico formativo.
 */
export const ESTADOS_DE_ATIVIDADE_APLICADA = ['aberta', 'encerrada'] as const
export type EstadoDeAtividadeAplicada = (typeof ESTADOS_DE_ATIVIDADE_APLICADA)[number]

/**
 * Corpo de `POST /v1/atividades-aplicadas`: o artefato, a turma e se é avaliativa. Só atividade objetiva se aplica.
 * A versão adaptada só se aplica com a entrega dela `aprovada`: sem isso, `VERSAO_ADAPTADA_NAO_APROVADA`, e o banco
 * recusa mesmo por fora da API. Com a avaliativa aberta, o Tutor da turma fica travado (regra 30, item 10).
 *
 * A versão adaptada vai para a turma como qualquer atividade: **não existe vínculo entre aluno e adaptação** (D35).
 */
export const aplicarAtividadeRequestSchema = z.strictObject({
  artefatoId: z.uuid(),
  turmaId: z.uuid(),
  avaliativa: z.boolean(),
})
export type AplicarAtividadeRequest = z.infer<typeof aplicarAtividadeRequestSchema>

/** Consulta de `GET /v1/atividades-aplicadas`: a turma (obrigatória, com vínculo confirmado do professor) e a página. */
export const atividadesAplicadasQuerySchema = paginationQuerySchema.extend({ turmaId: z.uuid() }).strict()
export type AtividadesAplicadasQuery = z.infer<typeof atividadesAplicadasQuerySchema>

/**
 * Uma atividade aplicada, como o professor da turma a vê: de que artefato veio, o estado, quantos alunos a turma tem,
 * quantos começaram e quantos enviaram (só contagem), e a entrega do lote de correção, quando já existe.
 */
export const atividadeAplicadaSchema = z.strictObject({
  id: z.uuid(),
  artefatoId: z.uuid(),
  turmaId: z.uuid(),
  titulo: z.string().min(1),
  avaliativa: z.boolean(),
  estado: z.enum(ESTADOS_DE_ATIVIDADE_APLICADA),
  questoes: z.number().int().min(1),
  aplicadaEm: z.iso.datetime(),
  encerradaEm: z.iso.datetime().nullable(),
  participacao: z.strictObject({
    alunos: z.number().int().nonnegative(),
    iniciaram: z.number().int().nonnegative(),
    enviaram: z.number().int().nonnegative(),
  }),
  entrega: z.strictObject({ id: z.uuid(), estado: z.enum(ESTADOS_DE_ENTREGA) }).nullable(),
})
export type AtividadeAplicada = z.infer<typeof atividadeAplicadaSchema>

/** Resposta de `POST /v1/atividades-aplicadas` (201). */
export const atividadeAplicadaResponseSchema = atividadeAplicadaSchema
export type AtividadeAplicadaResponse = AtividadeAplicada

export const listaDeAtividadesAplicadasResponseSchema = pageSchema(atividadeAplicadaSchema)
export type ListaDeAtividadesAplicadasResponse = z.infer<typeof listaDeAtividadesAplicadasResponseSchema>

/** Corpo de `POST /v1/atividades-aplicadas/:id/encerrar`, `POST /v1/atividades-aplicadas/:id/enviar` e dos outros `POST` sem dado: vazio e estrito. */
export const emptyBodyRequestSchema = z.strictObject({})
export type EmptyBodyRequest = z.infer<typeof emptyBodyRequestSchema>

/**
 * O mesmo corpo vazio e estrito, para a rota que aceita não receber corpo nenhum: o Express 5 deixa `req.body` indefinido
 * quando o cliente não manda corpo, e esse valia como `{}`. Qualquer campo continua sendo `ENTRADA_INVALIDA`.
 */
export const emptyOrMissingBodyRequestSchema = emptyBodyRequestSchema.default({})

/**
 * Resposta de `POST /v1/atividades-aplicadas/:id/encerrar`: a atividade, já `encerrada`, e a execução da correção, que
 * monta o lote e a entrega pendente. Encerrar de novo devolve o mesmo, sem segundo lote (o banco aceita um lote não
 * rejeitado por atividade aplicada). Com a função `correcao_de_objetiva` suspensa, a atividade encerra e `execucaoId`
 * vem nulo: a correção só roda quando a coordenação retomar a função e o professor encerrar de novo.
 */
export const atividadeEncerradaResponseSchema = z.strictObject({
  atividade: atividadeAplicadaSchema,
  execucaoId: z.uuid().nullable(),
})
export type AtividadeEncerradaResponse = z.infer<typeof atividadeEncerradaResponseSchema>
