import { z } from 'zod'
import { CODIGO_DE_HABILIDADE_BNCC, COMPONENTES_BNCC, NOME_DO_COMPONENTE, type ComponenteBncc } from '../bncc/componentes.js'
import type { Etapa } from '../estrutura/serie.js'
import { AREAS_DO_CONHECIMENTO, type AreaDoConhecimento } from '../estrutura/disciplina.js'
import { MAXIMO_DE_HABILIDADES_NA_LISTA } from './habilidades-bncc.js'

/**
 * O grupo em que a cobertura de uma série (classificacao-bncc, 13.0; Tech Spec, seção 5, "Cobertura") reúne as habilidades: o **componente** no Fundamental e a **área** no Médio, que é como a tabela
 * `habilidade_bncc` as guarda (`componente` num, `area` no outro; as `EM13LP` ficam com `area: linguagens`). A chave é única dentro de uma série, que é de uma etapa só; `matematica` é componente no
 * Fundamental e área no Médio, e nunca os dois na mesma cobertura.
 */
export type GrupoDaCobertura = ComponenteBncc | AreaDoConhecimento

/** O componente das habilidades que o componente da disciplina procura no Fundamental: Biologia, Física e Química procuram em Ciências, e Filosofia e Sociologia não têm candidata ali. */
const GRUPO_NO_FUNDAMENTAL: Readonly<Record<ComponenteBncc, GrupoDaCobertura | null>> = {
  arte: 'arte',
  biologia: 'ciencias',
  ciencias: 'ciencias',
  educacao_fisica: 'educacao_fisica',
  ensino_religioso: 'ensino_religioso',
  filosofia: null,
  fisica: 'ciencias',
  geografia: 'geografia',
  historia: 'historia',
  lingua_inglesa: 'lingua_inglesa',
  lingua_portuguesa: 'lingua_portuguesa',
  matematica: 'matematica',
  quimica: 'ciencias',
  sociologia: null,
}

/**
 * A área do Médio em que cai o material de cada componente: a primeira sigla de `SIGLAS_NO_MEDIO` (as `EM13LP` da Língua Portuguesa ficam em Linguagens). Ensino Religioso não tem habilidade no Médio, e o material
 * dele não cobre nada ali.
 */
const GRUPO_NO_MEDIO: Readonly<Record<ComponenteBncc, GrupoDaCobertura | null>> = {
  arte: 'linguagens',
  biologia: 'ciencias_da_natureza',
  ciencias: 'ciencias_da_natureza',
  educacao_fisica: 'linguagens',
  ensino_religioso: null,
  filosofia: 'ciencias_humanas',
  fisica: 'ciencias_da_natureza',
  geografia: 'ciencias_humanas',
  historia: 'ciencias_humanas',
  lingua_inglesa: 'linguagens',
  lingua_portuguesa: 'linguagens',
  matematica: 'matematica',
  quimica: 'ciencias_da_natureza',
  sociologia: 'ciencias_humanas',
}

/**
 * O grupo da cobertura em que cai o material de uma disciplina com este componente, numa série da etapa dada: o componente que ela procura no Fundamental, a área no Médio. `null` quando a etapa não
 * tem candidata para o componente (Filosofia no Fundamental, Ensino Religioso no Médio): o material dela não cobre nada ali.
 */
export function grupoDaCoberturaDoComponente(componente: ComponenteBncc, etapa: Etapa): GrupoDaCobertura | null {
  return (etapa === 'ef_anos_finais' ? GRUPO_NO_FUNDAMENTAL : GRUPO_NO_MEDIO)[componente]
}

/**
 * `GET /v1/materiais/cobertura` (classificacao-bncc, 13.0; RF19; Tech Spec, seções 4 e 5, "Cobertura"): para uma série da escola, as habilidades da BNCC que nenhum material em uso cobre. A consulta é a série e nada mais:
 * a escola vem do token, nunca do cliente (regra 10, item 3).
 */
export const coberturaQuerySchema = z.strictObject({ serieId: z.uuid() })
export type CoberturaQuery = z.infer<typeof coberturaQuerySchema>

/** O nome de cada área do Médio como a coordenação o lê na cobertura. `ensino_religioso` está na lista de áreas da disciplina, mas a BNCC do Médio não tem habilidade dele. */
export const NOME_DA_AREA_DA_BNCC: Readonly<Record<AreaDoConhecimento, string>> = {
  linguagens: 'Linguagens',
  matematica: 'Matemática',
  ciencias_da_natureza: 'Ciências da Natureza',
  ciencias_humanas: 'Ciências Humanas',
  ensino_religioso: 'Ensino Religioso',
}

/** O nome do grupo da cobertura na tela: o componente no Fundamental, a área no Médio. */
export function nomeDoGrupoDaCobertura(chave: GrupoDaCobertura, etapa: 'ef_anos_finais' | 'em'): string {
  if (etapa === 'em') return NOME_DA_AREA_DA_BNCC[chave as AreaDoConhecimento]
  return NOME_DO_COMPONENTE[chave as ComponenteBncc]
}

/** Uma habilidade que nenhum material em uso cobre: o código e o texto da BNCC. */
export const habilidadeSemMaterialSchema = z.strictObject({ codigo: z.string().regex(CODIGO_DE_HABILIDADE_BNCC), descricao: z.string().min(1) })
export type HabilidadeSemMaterial = z.infer<typeof habilidadeSemMaterialSchema>

const contagem = z.number().int().nonnegative()

/**
 * Um grupo da cobertura (o componente no Fundamental, a área no Médio): `total` é quantas habilidades a série tem nele; `semMaterial`, as que nenhum material em uso cobre, na ordem do código; e
 * `secoesSemClassificacao`, quantas seções dos materiais em uso do grupo ainda não estão classificadas (à espera da noite, que falharam ou que a rotina ainda não agendou): enquanto houver, a lista de
 * `semMaterial` pode estar maior do que será. Só ids, códigos e contagens: nenhum título de material.
 */
export const grupoDaCoberturaSchema = z.strictObject({
  chave: z.enum([...new Set([...COMPONENTES_BNCC, ...AREAS_DO_CONHECIMENTO])] as [GrupoDaCobertura, ...GrupoDaCobertura[]]),
  total: contagem,
  semMaterial: z.array(habilidadeSemMaterialSchema).max(MAXIMO_DE_HABILIDADES_NA_LISTA),
  secoesSemClassificacao: contagem,
})
export type GrupoDaCoberturaResponse = z.infer<typeof grupoDaCoberturaSchema>

/**
 * A cobertura de uma série: o recorte (`etapa`, para a tela escrever "componente" ou "área"), quantos materiais em uso a série tem (zero: a escola ainda não enviou material dela, e a tela convida a enviar), os grupos em ordem de nome e se a classificação pela IA está suspensa (a cobertura vale só pelas habilidades que a coordenação corrigiu). */
export const coberturaResponseSchema = z.strictObject({
  serieId: z.uuid(),
  etapa: z.enum(['ef_anos_finais', 'em']),
  materiaisEmUso: contagem,
  grupos: z.array(grupoDaCoberturaSchema),
  classificacaoSuspensa: z.boolean(),
})
export type CoberturaResponse = z.infer<typeof coberturaResponseSchema>
