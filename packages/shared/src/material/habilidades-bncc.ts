import { z } from 'zod'
import { CODIGO_DE_HABILIDADE_BNCC } from '../bncc/componentes.js'

/**
 * `GET /v1/habilidades-bncc` (classificacao-bncc, 7.0; Tech Spec, seção 4): as habilidades que um material, ou o artefato do professor, pode receber. A lista é o recorte atual: o componente da disciplina e as séries
 * do material (ou a série da turma do artefato). A maior, Língua Portuguesa do 6º ao 9º com o Médio, passa de 260; o teto do schema é o da entrada da classificação.
 */
export const MAXIMO_DE_HABILIDADES_NA_LISTA = 300

/** Exatamente um dos dois: `materialId` (a coordenação e o professor da disciplina) ou `artefatoId` (o professor dono). Os dois, ou nenhum, é `ENTRADA_INVALIDA`. */
export const habilidadesBnccQuerySchema = z.union([z.strictObject({ materialId: z.uuid() }), z.strictObject({ artefatoId: z.uuid() })])
export type HabilidadesBnccQuery = z.infer<typeof habilidadesBnccQuerySchema>

export const habilidadeCandidataSchema = z.strictObject({ codigo: z.string().regex(CODIGO_DE_HABILIDADE_BNCC), descricao: z.string().min(1) })
export type HabilidadeCandidataBncc = z.infer<typeof habilidadeCandidataSchema>

/** A lista das candidatas na ordem do código. Sem componente na disciplina, vem vazia e `semComponente` é `true`: a tela explica, e a troca só aceita `null`. */
export const habilidadesBnccResponseSchema = z.strictObject({
  itens: z.array(habilidadeCandidataSchema).max(MAXIMO_DE_HABILIDADES_NA_LISTA),
  semComponente: z.boolean(),
})
export type HabilidadesBnccResponse = z.infer<typeof habilidadesBnccResponseSchema>
