import { disciplina, execucaoAgente, habilidadeBncc, habilidadeDaSecao, material, requireEscolaId, secaoDoMaterial, serie, Unscoped, type Database, type DatabaseTransaction } from '@educa/core'
import type { ComponenteBncc, Etapa, GrupoDaCobertura } from '@educa/shared'
import { and, asc, eq, isNotNull, isNull, ne, or, sql, type SQL } from 'drizzle-orm'
import { declaradoParaASerie, proprioOuComLicencaVigente } from './material.repository.js'

/** A série da escola do contexto: o recorte da cobertura. */
export interface SerieDaCobertura {
  readonly etapa: Etapa
  readonly ano: number
}

/** Uma habilidade que a série tem, com o grupo em que a cobertura a reúne (o componente no Fundamental, a área no Médio). */
export interface HabilidadeDaSerie {
  readonly codigo: string
  readonly descricao: string
  readonly grupo: GrupoDaCobertura
}

/** O par que uma seção em uso cobre: o código e o componente da disciplina do material dela. */
export interface HabilidadeCoberta {
  readonly componente: ComponenteBncc
  readonly codigo: string
}

/** Quantas seções dos materiais em uso de uma série ainda não estão classificadas, por componente da disciplina do material. */
export interface SecoesSemClassificacaoDoComponente {
  readonly componente: ComponenteBncc
  readonly total: number
}

/**
 * O material que a escola usa **hoje** numa série (classificacao-bncc, 13.0; Tech Spec, seção 5, "Cobertura"): `pronto`, não excluído (o substituído sai junto, `excluido_em`), declarado para a série e próprio ou de licença
 * vigente hoje: o mesmo filtro da busca e da geração (`declaradoParaASerie`, `proprioOuComLicencaVigente`, cópias únicas de `material.repository.ts`).
 */
function materialEmUso(banco: Database | DatabaseTransaction, serieId: string, hoje: string): SQL | undefined {
  return and(
    eq(material.escolaId, requireEscolaId()),
    eq(material.estado, 'pronto'),
    isNull(material.excluidoEm),
    declaradoParaASerie(banco, serieId),
    proprioOuComLicencaVigente(banco, hoje),
  )
}

/**
 * A seção que já terminou a classificação (`classificada` ou `sem_habilidade`, `situacaoDaSecao`): a corrigida pela coordenação, ou a que a execução `concluida` classificou. Quem a lê tem a execução em junção à esquerda:
 * a seção sem execução, com `pendente`, `rodando` ou `falhou`, não terminou.
 */
const terminouAClassificacao = or(isNotNull(secaoDoMaterial.corrigidaEm), eq(execucaoAgente.estado, 'concluida'))

/**
 * A cobertura de uma série pela BNCC (classificacao-bncc, 13.0; RF19): a série, as habilidades que ela tem, as que as seções dos materiais em uso cobrem e quantas seções ainda não foram classificadas. A escola é a do contexto e
 * entra em **todo** método (regra 10, item 3); nenhum o recebe por argumento. A tabela da BNCC é pública e a única leitura sem escola (`habilidadesDaSerie`).
 */
export class CoberturaRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /** A série da escola do contexto. A de outra escola e a inexistente não são achadas (`undefined`), e quem chama responde `NAO_ENCONTRADO` igual às duas (regra 10, item 6). */
  async serieDaEscola(serieId: string): Promise<SerieDaCobertura | undefined> {
    const [linha] = await this.banco
      .select({ etapa: serie.etapa, ano: serie.ano })
      .from(serie)
      .where(and(eq(serie.escolaId, requireEscolaId()), eq(serie.id, serieId)))
    return linha
  }

  /**
   * As habilidades da BNCC que a série tem, na ordem do código: no Fundamental, as que listam o ano dela (`anos`); no Médio, todas (a BNCC do Médio não é seriada). É a lista de que a cobertura subtrai o que os materiais cobrem.
   * A tabela é pública e não tem `escola_id` (regra 10, item 1).
   */
  @Unscoped('a tabela da BNCC é pública e não tem escola_id (regra 10, item 1): devolve só código, texto e grupo de habilidade, nunca dado de escola nem de pessoa')
  habilidadesDaSerie(recorte: SerieDaCobertura): Promise<HabilidadeDaSerie[]> {
    return this.banco
      .select({
        codigo: habilidadeBncc.codigo,
        descricao: habilidadeBncc.descricao,
        // O grupo é a área no Médio (as `EM13LP` têm componente e área: a área vence, são de Linguagens) e o componente no Fundamental (que não tem área); o check `habilidade_bncc_recorte_da_etapa` garante um dos dois.
        grupo: sql<GrupoDaCobertura>`coalesce(${habilidadeBncc.area}, ${habilidadeBncc.componente})`,
      })
      .from(habilidadeBncc)
      .where(and(eq(habilidadeBncc.etapa, recorte.etapa), recorte.etapa === 'em' ? undefined : sql`${habilidadeBncc.anos} @> array[${recorte.ano}]::smallint[]`))
      .orderBy(asc(habilidadeBncc.codigo))
  }

  /**
   * A consulta que `habilidadesCobertas` roda, sem executá-la: o `EXPLAIN` da Tech Spec, seção 7c, a lê daqui (`.toSQL()`). Parte da habilidade da seção (chave `(escola_id, secao_id, codigo)`) e liga a seção, o material e a
   * disciplina pelos ids e pela escola; a execução entra à esquerda, para a seção sem execução não sumir.
   */
  consultaDasCobertas(serieId: string, hoje: string, soDaCoordenacao: boolean) {
    const escolaId = requireEscolaId()
    return this.banco
      .selectDistinct({ componente: sql<ComponenteBncc>`${disciplina.componenteBncc}`, codigo: habilidadeDaSecao.codigo })
      .from(habilidadeDaSecao)
      .innerJoin(secaoDoMaterial, and(eq(secaoDoMaterial.escolaId, habilidadeDaSecao.escolaId), eq(secaoDoMaterial.id, habilidadeDaSecao.secaoId)))
      .innerJoin(material, and(eq(material.escolaId, secaoDoMaterial.escolaId), eq(material.id, secaoDoMaterial.materialId)))
      .innerJoin(disciplina, and(eq(disciplina.escolaId, material.escolaId), eq(disciplina.id, material.disciplinaId)))
      .leftJoin(execucaoAgente, and(eq(execucaoAgente.escolaId, secaoDoMaterial.escolaId), eq(execucaoAgente.id, secaoDoMaterial.execucaoId)))
      .where(
        and(
          eq(habilidadeDaSecao.escolaId, escolaId),
          materialEmUso(this.banco, serieId, hoje),
          // Sem componente a disciplina não tem recorte: o código que a seção ainda guarda (a correção que o apagar do componente deixou) não conta.
          isNotNull(disciplina.componenteBncc),
          terminouAClassificacao,
          // A função suspensa: vale só a correção da coordenação, a `origem: 'ia'` não conta (Tech Spec, seção 5, "Suspensão").
          soDaCoordenacao ? eq(habilidadeDaSecao.origem, 'coordenacao') : undefined,
        ),
      )
  }

  /** Quantos materiais em uso a série tem (`materialEmUso`): zero é a escola que ainda não enviou material dela, e a tela convida a enviar. */
  materiaisEmUso(serieId: string, hoje: string): Promise<number> {
    return this.banco.$count(material, materialEmUso(this.banco, serieId, hoje))
  }

  /** Os pares (componente da disciplina do material, código) que as seções dos materiais em uso da série cobrem. Quem chama confere cada um contra o recorte (`habilidadeEhCandidata`). */
  habilidadesCobertas(serieId: string, hoje: string, soDaCoordenacao: boolean): Promise<HabilidadeCoberta[]> {
    return this.consultaDasCobertas(serieId, hoje, soDaCoordenacao)
  }

  /**
   * Quantas seções dos materiais em uso da série ainda não terminaram a classificação, por componente da disciplina do material: sem execução (a rotina das 19h ainda não as agendou), à espera da noite
   * (`pendente`, `rodando`) ou que falharam. Com a função suspensa, só a correção vale, e a seção que a coordenação não corrigiu conta como sem classificação (`soDaCoordenacao`). A disciplina sem componente não
   * entra: o material dela não classifica nada, e a tela da cobertura não tem grupo para ela.
   */
  async secoesSemClassificacao(serieId: string, hoje: string, soDaCoordenacao: boolean): Promise<SecoesSemClassificacaoDoComponente[]> {
    const sem = soDaCoordenacao ? isNull(secaoDoMaterial.corrigidaEm) : and(isNull(secaoDoMaterial.corrigidaEm), or(isNull(execucaoAgente.estado), ne(execucaoAgente.estado, 'concluida')))
    return this.banco
      .select({ componente: sql<ComponenteBncc>`${disciplina.componenteBncc}`, total: sql<number>`count(*)::int` })
      .from(secaoDoMaterial)
      .innerJoin(material, and(eq(material.escolaId, secaoDoMaterial.escolaId), eq(material.id, secaoDoMaterial.materialId)))
      .innerJoin(disciplina, and(eq(disciplina.escolaId, material.escolaId), eq(disciplina.id, material.disciplinaId)))
      .leftJoin(execucaoAgente, and(eq(execucaoAgente.escolaId, secaoDoMaterial.escolaId), eq(execucaoAgente.id, secaoDoMaterial.execucaoId)))
      .where(and(eq(secaoDoMaterial.escolaId, requireEscolaId()), materialEmUso(this.banco, serieId, hoje), isNotNull(disciplina.componenteBncc), sem))
      .groupBy(disciplina.componenteBncc)
  }
}
