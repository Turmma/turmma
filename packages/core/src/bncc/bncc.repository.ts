import type { AreaDoConhecimento, ComponenteBncc, Etapa } from '@educa/shared'
import { and, asc, eq, inArray, sql, type SQL } from 'drizzle-orm'
import { Unscoped } from '../db/unscoped.decorator.js'
import type { Database, DatabaseTransaction } from '../db/database.js'
import { habilidadeBncc } from '../db/schema/habilidade-bncc.js'

/** A habilidade como a leitura a devolve: o código, o texto oficial e o grupo da cobertura (o componente no Fundamental, a área no Médio). Nada mais sai da tabela. */
export interface HabilidadeDaBncc {
  readonly codigo: string
  readonly descricao: string
  readonly grupo: ComponenteBncc | AreaDoConhecimento
}

/**
 * Como a leitura recorta a tabela: por **etapas** (as candidatas de um recorte, que quem chama filtra pelo componente e pelas séries), por **série** (as que a série tem: no Fundamental as que listam o ano, no Médio todas, porque a
 * BNCC do Médio não é seriada) ou por **código** (o texto oficial de uma habilidade).
 */
export type FiltroDeHabilidades =
  | { readonly etapas: readonly Etapa[] }
  | { readonly etapa: Etapa; readonly ano: number }
  | { readonly codigo: string }

function recorteDe(filtro: FiltroDeHabilidades): SQL | undefined {
  if ('etapas' in filtro) return inArray(habilidadeBncc.etapa, [...filtro.etapas])
  if ('codigo' in filtro) return eq(habilidadeBncc.codigo, filtro.codigo)
  return and(eq(habilidadeBncc.etapa, filtro.etapa), filtro.etapa === 'em' ? undefined : sql`${habilidadeBncc.anos} @> array[${filtro.ano}]::smallint[]`)
}

/**
 * A leitura da tabela pública `habilidade_bncc` (classificacao-bncc; Tech Spec, seção 6; regra 10, itens 1 e 9). A BNCC é de todas as escolas e não tem `escola_id`: por isso a leitura mora **aqui, uma vez**, e não nos
 * repositories com escopo de escola, que ficariam cada um com uma exceção. É o único `@Unscoped` da leitura da BNCC; quem precisa de habilidade (a classificação, a troca da questão, a cobertura) passa por ele e aplica à parte o
 * que é regra do seu módulo.
 */
export class BnccRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /** As habilidades do recorte, na ordem do código. */
  @Unscoped('a tabela da BNCC é pública e não tem escola_id (regra 10, item 1): devolve só código, texto e grupo de habilidade, nunca dado de escola nem de pessoa')
  async habilidades(filtro: FiltroDeHabilidades): Promise<HabilidadeDaBncc[]> {
    return this.banco
      .select({
        codigo: habilidadeBncc.codigo,
        descricao: habilidadeBncc.descricao,
        // O grupo é a área no Médio (as `EM13LP` têm componente e área: a área vence, são de Linguagens) e o componente no Fundamental (que não tem área); o check `habilidade_bncc_recorte_da_etapa` garante um dos dois.
        grupo: sql<ComponenteBncc | AreaDoConhecimento>`coalesce(${habilidadeBncc.area}, ${habilidadeBncc.componente})`,
      })
      .from(habilidadeBncc)
      .where(recorteDe(filtro))
      .orderBy(asc(habilidadeBncc.codigo))
  }
}
