import { z } from 'zod'
import { paginationQuerySchema, pageSchema } from '../estrutura/pagination.js'
import { CHAVES_DE_FUNCAO } from '../time/funcoes.js'

/**
 * A entrega (glossário, "Entrega"; regra 70, item 3): o que a IA produziu e que espera a decisão de uma pessoa. Nasce
 * `pendente`, e só a aprovação registrada, com autor e data, a faz valer. No MVP há dois tipos: a versão adaptada de uma
 * atividade (função `adaptacao`) e o lote de correção de objetiva (função `correcao_de_objetiva`).
 */
export const ESTADOS_DE_ENTREGA = ['pendente', 'aprovada', 'rejeitada'] as const
export type EstadoDeEntrega = (typeof ESTADOS_DE_ENTREGA)[number]

export const TIPOS_DE_ENTREGA = ['versao_adaptada', 'lote_de_correcao'] as const
export type TipoDeEntrega = (typeof TIPOS_DE_ENTREGA)[number]

export const NOME_DO_TIPO_DE_ENTREGA: Readonly<Record<TipoDeEntrega, string>> = {
  versao_adaptada: 'Versão adaptada',
  lote_de_correcao: 'Correção da turma',
}

/**
 * Consulta de `GET /v1/entregas`: a página, o estado e a turma. O professor só recebe as das turmas em que tem vínculo
 * confirmado, com ou sem o filtro de turma.
 */
export const entregasQuerySchema = paginationQuerySchema.extend({ estado: z.enum(ESTADOS_DE_ENTREGA).optional(), turmaId: z.uuid().optional() }).strict()
export type EntregasQuery = z.infer<typeof entregasQuerySchema>

/** Quem decidiu, para a linha "Aprovado por … · quando". Só o professor da turma recebe este nome. */
export const autorDaDecisaoSchema = z.strictObject({ id: z.uuid(), nome: z.string().min(1) })

/**
 * Uma entrega, como o professor da turma a vê em "Seu time": o que é, de que função veio, a que artefato ou atividade
 * aplicada se refere, o estado e, depois de decidida, quem decidiu, quando e a justificativa da rejeição.
 */
export const entregaSchema = z.strictObject({
  id: z.uuid(),
  tipo: z.enum(TIPOS_DE_ENTREGA),
  funcao: z.enum(CHAVES_DE_FUNCAO),
  estado: z.enum(ESTADOS_DE_ENTREGA),
  turmaId: z.uuid(),
  /** O título do artefato, para a tela não precisar de outra chamada. */
  titulo: z.string().min(1),
  /** A versão adaptada, na entrega de adaptação. */
  artefatoId: z.uuid().nullable(),
  /** A atividade aplicada, na entrega do lote de correção. */
  atividadeAplicadaId: z.uuid().nullable(),
  criadaEm: z.iso.datetime(),
  decididaEm: z.iso.datetime().nullable(),
  decididaPor: autorDaDecisaoSchema.nullable(),
  justificativa: z.string().min(1).nullable(),
})
export type Entrega = z.infer<typeof entregaSchema>

export const listaDeEntregasResponseSchema = pageSchema(entregaSchema)
export type ListaDeEntregasResponse = z.infer<typeof listaDeEntregasResponseSchema>

export const DECISOES_DE_ENTREGA = ['aprovar', 'rejeitar'] as const
export type DecisaoDeEntrega = (typeof DECISOES_DE_ENTREGA)[number]

export const TAMANHO_MINIMO_DA_JUSTIFICATIVA = 8
export const TAMANHO_MAXIMO_DA_JUSTIFICATIVA = 500

/**
 * Corpo de `POST /v1/entregas/:id/decidir`. Rejeitar exige justificativa (regra 70, item 3); aprovar não a aceita. A
 * justificativa é texto do professor **sobre a saída da IA**, e a tela avisa para não escrever sobre aluno: fica na
 * entrega e nunca vai a log nem a auditoria (`docs/lgpd.md`).
 *
 * O lote de correção **não se aprova por aqui**: a aprovação dele é `POST /v1/entregas/:id/aprovar-lote`, que grava o
 * registro da validação (D56). Aprovar um lote por esta rota responde `ENTRADA_INVALIDA`, e o banco recusa o lote
 * aprovado sem validação mesmo por fora da API. Rejeitar o lote é por aqui.
 */
export const decidirEntregaRequestSchema = z.discriminatedUnion('decisao', [
  z.strictObject({ decisao: z.literal('aprovar') }),
  z.strictObject({ decisao: z.literal('rejeitar'), justificativa: z.string().trim().min(TAMANHO_MINIMO_DA_JUSTIFICATIVA).max(TAMANHO_MAXIMO_DA_JUSTIFICATIVA) }),
])
export type DecidirEntregaRequest = z.infer<typeof decidirEntregaRequestSchema>

/** Resposta de `POST /v1/entregas/:id/decidir`: a entrega decidida. A que já tinha decisão responde `ENTREGA_JA_DECIDIDA`. */
export const entregaResponseSchema = entregaSchema
export type EntregaResponse = Entrega
