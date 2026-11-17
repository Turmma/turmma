import { sql } from 'drizzle-orm'
import { check, pgTable, smallint, text } from 'drizzle-orm/pg-core'
import { COMPONENTES_BNCC, type AreaDoConhecimento, type ComponenteBncc, type Etapa } from '@educa/shared'

const lista = (valores: readonly string[]): string => valores.map((valor) => `'${valor}'`).join(', ')

/**
 * A habilidade da BNCC (glossário, "Habilidade"; classificacao-bncc, 1.0; Tech Spec, seção 3): os anos finais do Ensino Fundamental e o
 * Ensino Médio, carregados do `bncc-dados` na versão fixa `dados-2026.08` pela migration `0059_habilidade_bncc` (o JSON está em
 * `src/db/bncc/`, com a conferência contra o PDF homologado). **Tabela pública, sem `escola_id`**: a BNCC é de todas as escolas, e a
 * exceção está no item 1 das Regras transversais do `docs/modelo-de-dados.md` (regra 10, item 1). Não tem dado de pessoa.
 *
 * - `codigo` é a chave (`EF69LP01`, `EM13CNT301`) e nunca sai: a carga atualiza o texto e a versão, jamais apaga um código.
 * - `componente` é do Fundamental (e das `EM13LP`, de Língua Portuguesa); `area` é do Médio; `anos` são os do Fundamental (6 a 9), e o Médio não os tem.
 * - `localizador` é a página do PDF homologado em que a habilidade está.
 * - Computação não entra (D65, `TODO.md`).
 */
export const habilidadeBncc = pgTable(
  'habilidade_bncc',
  {
    codigo: text().primaryKey(),
    descricao: text().notNull(),
    etapa: text().$type<Etapa>().notNull(),
    componente: text().$type<ComponenteBncc>(),
    area: text().$type<AreaDoConhecimento>(),
    anos: smallint().array(),
    versao: text().notNull(),
    localizador: text().notNull(),
  },
  (tabela) => [
    check('habilidade_bncc_codigo_valido', sql`${tabela.codigo} ~ '^(EF(06|07|08|09|67|69|89)[A-Z]{2}[0-9]{2}|EM13(LGG|MAT|CNT|CHS)[0-9]{3}|EM13LP[0-9]{2})$'`),
    check('habilidade_bncc_etapa_valida', sql.raw(`"habilidade_bncc"."etapa" in ('ef_anos_finais', 'em')`)),
    check(
      'habilidade_bncc_recorte_da_etapa',
      sql.raw(
        `("habilidade_bncc"."etapa" = 'ef_anos_finais' and "habilidade_bncc"."componente" is not null and "habilidade_bncc"."area" is null and "habilidade_bncc"."anos" is not null and cardinality("habilidade_bncc"."anos") > 0 and "habilidade_bncc"."anos" <@ array[6, 7, 8, 9]::smallint[])
        or ("habilidade_bncc"."etapa" = 'em' and "habilidade_bncc"."area" is not null and "habilidade_bncc"."anos" is null)`,
      ),
    ),
    check('habilidade_bncc_componente_valido', sql.raw(`"habilidade_bncc"."componente" is null or "habilidade_bncc"."componente" in (${lista(COMPONENTES_BNCC)})`)),
    check('habilidade_bncc_area_valida', sql.raw(`"habilidade_bncc"."area" is null or "habilidade_bncc"."area" in ('linguagens', 'matematica', 'ciencias_da_natureza', 'ciencias_humanas')`)),
  ],
)
