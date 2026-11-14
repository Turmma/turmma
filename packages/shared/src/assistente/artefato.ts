import { z } from 'zod'
import { paginationQuerySchema, pageSchema } from '../estrutura/pagination.js'
import { idempotencyKeySchema } from '../time/idempotency-key.js'
import { adaptacaoAplicadaSchema, conteudoDoArtefatoSchema, TIPOS_DE_ADAPTACAO, TIPOS_DE_ARTEFATO } from './conteudo.js'
import { parametrosDeFerramentaSchema, FERRAMENTAS_GERADORAS } from './conversa.js'
import { ESTADOS_DE_ENTREGA } from './entrega.js'
import { ESTADOS_DE_ATIVIDADE_APLICADA } from '../atividade/atividade-aplicada.js'

/**
 * As ferramentas e o artefato (MVP, A2; D18, D67, D74): `POST /v1/ferramentas/:ferramenta/gerar`, as rotas de
 * `/v1/artefatos` e `POST /v1/artefatos/:id/adaptar`. O artefato é do professor, ligado à turma e à disciplina, e só o
 * professor com vínculo confirmado na turma o alcança. **O aluno nunca lê o artefato**: ele recebe a prova, sem gabarito,
 * pela atividade aplicada.
 */

/** `:ferramenta` de `POST /v1/ferramentas/:ferramenta/gerar`. */
export const parametroFerramentaSchema = z.enum(FERRAMENTAS_GERADORAS)
export type ParametroFerramenta = z.infer<typeof parametroFerramentaSchema>

/**
 * Corpo de `POST /v1/ferramentas/:ferramenta/gerar`: os parâmetros da ferramenta e a chave do envio. É o mesmo caso de
 * uso que o cartão da conversa dispara (D18). Responde 202 com a execução; o resultado dela traz o `artefatoId`.
 */
export const gerarComFerramentaRequestSchema = parametrosDeFerramentaSchema.extend({ chaveEnvio: idempotencyKeySchema }).strict()
export type GerarComFerramentaRequest = z.infer<typeof gerarComFerramentaRequestSchema>

/** Consulta de `GET /v1/artefatos`: a página e a turma. Sem turma, os de todas as turmas com vínculo confirmado do professor. */
export const artefatosQuerySchema = paginationQuerySchema.extend({ turmaId: z.uuid().optional() }).strict()
export type ArtefatosQuery = z.infer<typeof artefatosQuerySchema>

/** A entrega de uma versão adaptada, resumida: é o que diz se ela está pendente, aprovada ou rejeitada. */
export const entregaDoArtefatoSchema = z.strictObject({ id: z.uuid(), estado: z.enum(ESTADOS_DE_ENTREGA), decididaEm: z.iso.datetime().nullable() })

/**
 * Um artefato na listagem: o que é, de que turma e disciplina, e, se for versão adaptada, de qual artefato saiu, com
 * que tipos de adaptação e em que estado está a entrega dela. A adaptação é sempre o **tipo**, nunca o motivo nem o
 * aluno (D35, D67).
 */
export const artefatoResumidoSchema = z.strictObject({
  id: z.uuid(),
  tipo: z.enum(TIPOS_DE_ARTEFATO),
  titulo: z.string().min(1),
  turmaId: z.uuid(),
  disciplinaId: z.uuid(),
  origemId: z.uuid().nullable(),
  adaptacao: adaptacaoAplicadaSchema.nullable(),
  entrega: entregaDoArtefatoSchema.nullable(),
  criadoEm: z.iso.datetime(),
})
export type ArtefatoResumido = z.infer<typeof artefatoResumidoSchema>

export const listaDeArtefatosResponseSchema = pageSchema(artefatoResumidoSchema)
export type ListaDeArtefatosResponse = z.infer<typeof listaDeArtefatosResponseSchema>

/** Onde o artefato foi aplicado ("Atribuída à turma"). */
export const aplicacaoDoArtefatoSchema = z.strictObject({
  id: z.uuid(),
  turmaId: z.uuid(),
  estado: z.enum(ESTADOS_DE_ATIVIDADE_APLICADA),
  aplicadaEm: z.iso.datetime(),
})

export const MAXIMO_DE_VERSOES_NO_ARTEFATO = 50

/** O que a fonte diz de si quando a linha do material não existe mais (o expurgo a apagou): a citação continua valendo, com a página. */
export const TITULO_DA_FONTE_SEM_LINHA = 'material da escola'

/** Teto de materiais diferentes que um artefato cita: o plano cita até 8 no fim e uma por etapa; uma questão, um. */
export const MAXIMO_DE_FONTES_NO_ARTEFATO = 100

/**
 * Um material que o artefato cita (ingestao-do-material, 10.0; RF11): o título e a edição **de agora**, lidos pela escola do
 * contexto, e se a edição já foi substituída por outra. Só o que a professora precisa para saber de onde a citação veio:
 * nunca o hash, a chave do objeto, quem enviou nem o licenciante (regra 20, item 4). Sem a linha, o título é
 * `TITULO_DA_FONTE_SEM_LINHA`, sem edição.
 */
export const fonteDoArtefatoSchema = z.strictObject({
  materialId: z.uuid(),
  titulo: z.string().min(1),
  edicao: z.string().min(1).nullable(),
  substituido: z.boolean(),
})
export type FonteDoArtefato = z.infer<typeof fonteDoArtefatoSchema>

/**
 * Como a fonte se escreve na tela e no PDF, igual nos dois: `Química 2`, `Química 2 (2025)`, `Química 2 (2024, edição
 * anterior)` ou `Química 2 (edição anterior)`. A edição vem do rótulo que a coordenação deu, e o "edição anterior" é o que
 * a troca de edição acrescenta, sem apagar a citação que já estava no artefato.
 */
export function rotuloDaFonte({ titulo, edicao, substituido }: Pick<FonteDoArtefato, 'titulo' | 'edicao' | 'substituido'>): string {
  const detalhes = [...(edicao === null ? [] : [edicao]), ...(substituido ? ['edição anterior'] : [])]
  return detalhes.length === 0 ? titulo : `${titulo} (${detalhes.join(', ')})`
}

/**
 * Resposta de `GET /v1/artefatos/:id` e de `PATCH /v1/artefatos/:id`: o artefato inteiro, com o conteúdo (questões com
 * gabarito e página citada, ou o plano), as versões adaptadas que saíram dele, as aplicações e as `fontes`: o título e a
 * edição de cada material citado, e se a edição foi substituída. Só o professor da turma.
 */
export const artefatoResponseSchema = artefatoResumidoSchema
  .extend({
    conteudo: conteudoDoArtefatoSchema,
    versoesAdaptadas: z.array(artefatoResumidoSchema).max(MAXIMO_DE_VERSOES_NO_ARTEFATO),
    aplicacoes: z.array(aplicacaoDoArtefatoSchema).max(MAXIMO_DE_VERSOES_NO_ARTEFATO),
    fontes: z.array(fonteDoArtefatoSchema).max(MAXIMO_DE_FONTES_NO_ARTEFATO),
  })
  .strict()
export type ArtefatoResponse = z.infer<typeof artefatoResponseSchema>

/** Corpo de `PATCH /v1/artefatos/:id`: só o título. O conteúdo gerado não se edita por aqui, e o artefato aplicado não muda. */
export const renomearArtefatoRequestSchema = z.strictObject({ titulo: z.string().trim().min(1).max(160) })
export type RenomearArtefatoRequest = z.infer<typeof renomearArtefatoRequestSchema>

/**
 * Corpo de `POST /v1/artefatos/:id/adaptar`: os **tipos de adaptação**, de lista fechada e sem repetir, o tempo extra (só
 * junto de `tempo_adicional`) e a chave do envio. **Não existe campo de texto**: nada aqui descreve um aluno, uma
 * condição ou um motivo (D35, D67), e campo a mais é `ENTRADA_INVALIDA`. Só atividade objetiva que não é versão adaptada
 * se adapta. Responde 202; a versão nasce com uma entrega `pendente`, e só chega à turma depois de aprovada.
 */
export const adaptarArtefatoRequestSchema = z
  .strictObject({
    tipos: z
      .array(z.enum(TIPOS_DE_ADAPTACAO))
      .min(1)
      .max(TIPOS_DE_ADAPTACAO.length)
      .refine((tipos) => new Set(tipos).size === tipos.length, 'tipo repetido'),
    tempoExtraPercentual: z.number().int().min(10).max(100).optional(),
    chaveEnvio: idempotencyKeySchema,
  })
  .refine((pedido) => pedido.tempoExtraPercentual === undefined || pedido.tipos.includes('tempo_adicional'), { path: ['tempoExtraPercentual'], message: 'tempo extra só com tempo_adicional' })
export type AdaptarArtefatoRequest = z.infer<typeof adaptarArtefatoRequestSchema>
