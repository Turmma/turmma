import { requireEscolaId, material, Unscoped, requestSessao, trecho, vinculo, type Database, type DatabaseTransaction } from '@educa/core'
import type { MateriaisQuery, EstadoDeMaterial, FalhaDeMaterial, LicencaDeMaterial, TitularidadeDeMaterial } from '@educa/shared'
import { and, asc, desc, eq, exists, gt, gte, isNull, lt, sql, type SQL } from 'drizzle-orm'
import { InvariantException } from '@educa/shared'
import type { PaginaExtraida } from './pdf-extraction.js'

/**
 * Como o material é alcançado, pela célula da `MATRIZ`: a coordenação alcança todo material da escola (`unidade`); o
 * professor, só o das disciplinas em que tem vínculo `confirmado` no ano em curso (`disciplinas_vinculadas`, o
 * `turma_vinculada` da matriz aplicado a material, que é da disciplina e não da turma).
 */
export type AlcanceDoMaterial = 'unidade' | 'disciplinas_vinculadas'

/** O material como a coordenação e o professor o leem. Nunca o resumo do arquivo nem quem enviou. */
export interface MaterialLido {
  readonly id: string
  readonly titulo: string
  readonly disciplinaId: string
  readonly titularidade: TitularidadeDeMaterial
  readonly licenciante: string | null
  readonly licenca: LicencaDeMaterial
  readonly estado: EstadoDeMaterial
  readonly falha: FalhaDeMaterial | null
  readonly paginas: number | null
  readonly trechos: number
  readonly enviadoEm: Date
}

export interface NovoMaterial {
  readonly disciplinaId: string
  readonly titulo: string
  readonly titularidade: TitularidadeDeMaterial
  readonly licenciante: string | null
  readonly licenca: LicencaDeMaterial
  readonly sha256: string
  readonly tamanhoBytes: number
}

/** Quantos envios a escola e a pessoa fizeram na janela, e quantos materiais da escola ainda estão sendo lidos. */
export interface EnviosNaJanela {
  readonly daEscola: number
  readonly doUsuario: number
  readonly emProcessamento: number
}

/** Uma página achada, com o texto inteiro dela. Quem responde à web corta; o Assistente e o Tutor leem inteira. */
export interface TrechoAchado {
  readonly materialId: string
  readonly disciplinaId: string
  readonly titulo: string
  readonly pagina: number
  readonly texto: string
}

export interface FiltroDaBusca {
  readonly texto: string
  readonly disciplinaId?: string | undefined
  readonly materialId?: string | undefined
  readonly limite: number
  /**
   * `todas`: a página precisa ter todas as palavras (`websearch_to_tsquery`, o contrato da rota). `qualquer`: basta
   * uma, e a página que tem todas vem na frente — é o que serve a quem busca com a frase inteira de uma pessoa.
   */
  readonly palavras: 'todas' | 'qualquer'
}

/**
 * Quantas páginas do material viraram trecho. Escrito com os nomes qualificados: numa consulta de uma tabela só, o
 * drizzle escreve a coluna sem a tabela, e `escola_id = escola_id` dentro da subconsulta seria o trecho com ele mesmo.
 */
const quantosTrechos = sql<number>`(select count(*)::int from "trecho" where "trecho"."escola_id" = "material"."escola_id" and "trecho"."material_id" = "material"."id")`

const colunas = {
  id: material.id,
  titulo: material.titulo,
  disciplinaId: material.disciplinaId,
  titularidade: material.titularidade,
  licenciante: material.licenciante,
  licenca: material.licenca,
  estado: material.estado,
  falha: material.falha,
  paginas: material.paginas,
  trechos: quantosTrechos,
  enviadoEm: material.enviadoEm,
}

const colunasDoTrecho = { materialId: trecho.materialId, disciplinaId: trecho.disciplinaId, titulo: material.titulo, pagina: trecho.pagina, texto: trecho.texto }

/** Quantos trechos vão num `insert` só: um capítulo cabe em um, e um livro de mil páginas não vira um comando de 20 MB. */
const TRECHOS_POR_INSERCAO = 50

/**
 * O material e os trechos da escola do contexto, e só dela: nenhum método recebe escola (regra 10, item 3). A escola
 * vem de `requireEscolaId()`, na requisição e na extração em segundo plano, que roda num contexto com a escola
 * do material que ela lê.
 *
 * Toda leitura deixa de fora o material excluído (`excluido_em`). A busca só enxerga material `pronto`.
 */
export class MaterialRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /**
   * Só o material das disciplinas em que o professor do contexto tem vínculo `confirmado` no ano em curso da escola.
   * Sem ano em curso não há vínculo que valha, e nada é alcançado. O usuário e o ano vêm do contexto, nunca de argumento.
   */
  #noAlcance(alcance: AlcanceDoMaterial): SQL | undefined {
    if (alcance === 'unidade') return undefined
    const { usuarioId, anoLetivoId } = requestSessao()
    if (anoLetivoId === null) return sql`false`
    return exists(
      this.banco
        .select({ um: vinculo.id })
        .from(vinculo)
        .where(
          and(
            eq(vinculo.escolaId, material.escolaId),
            eq(vinculo.anoLetivoId, anoLetivoId),
            eq(vinculo.usuarioId, usuarioId),
            eq(vinculo.papel, 'professor'),
            eq(vinculo.estado, 'confirmado'),
            eq(vinculo.disciplinaId, material.disciplinaId),
          ),
        ),
    )
  }

  /**
   * Segura os envios da escola do contexto até o fim da transação: dois envios ao mesmo tempo contam um depois do
   * outro, e o teto não é furado pela corrida (regra 80, item 7). A trava é da escola: outra escola não espera.
   */
  async travarEnviosDaEscola(): Promise<void> {
    await this.banco.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`material.envio:${requireEscolaId()}`}, 0))`)
  }

  /**
   * O que a escola e a pessoa do contexto já enviaram desde `desde`, contando o que falhou e o que foi excluído (o
   * arquivo foi recebido do mesmo jeito), e quantos materiais da escola estão `processando` agora.
   */
  async enviosNaJanela(desde: Date): Promise<EnviosNaJanela> {
    const { usuarioId } = requestSessao()
    const [linha] = await this.banco
      .select({
        daEscola: sql<number>`count(*) filter (where ${gte(material.enviadoEm, desde)})::int`,
        doUsuario: sql<number>`count(*) filter (where ${and(gte(material.enviadoEm, desde), eq(material.enviadoPor, usuarioId))})::int`,
        emProcessamento: sql<number>`count(*) filter (where ${and(eq(material.estado, 'processando'), isNull(material.excluidoEm))})::int`,
      })
      .from(material)
      .where(eq(material.escolaId, requireEscolaId()))
    return linha ?? { daEscola: 0, doUsuario: 0, emProcessamento: 0 }
  }

  /**
   * Grava o material, `processando`, com a declaração verdadeira (só chega aqui quem passou por
   * `motivoDaRecusaDoMaterial`). O mesmo arquivo de novo na escola esbarra no índice único `(escola_id, sha256)` entre
   * os não excluídos e não falhos, e sai `CONFLITO` pelo filtro de erro: dois envios ao mesmo tempo gravam um.
   */
  async inserir(novo: NovoMaterial): Promise<MaterialLido> {
    const { usuarioId } = requestSessao()
    const [gravado] = await this.banco
      .insert(material)
      .values({ ...novo, escolaId: requireEscolaId(), declaracao: true, enviadoPor: usuarioId })
      .returning({ ...colunas, trechos: sql<number>`0` })
    if (gravado === undefined) throw new InvariantException('material não gravado')
    return gravado
  }

  /** Uma página dos materiais não excluídos, em ordem de envio, com uma linha a mais que diz se há próxima. */
  listar({ pagina, limite, disciplinaId }: MateriaisQuery, alcance: AlcanceDoMaterial): Promise<MaterialLido[]> {
    return this.banco
      .select(colunas)
      .from(material)
      .where(
        and(
          eq(material.escolaId, requireEscolaId()),
          isNull(material.excluidoEm),
          disciplinaId === undefined ? undefined : eq(material.disciplinaId, disciplinaId),
          pagina === undefined ? undefined : gt(material.id, pagina),
          this.#noAlcance(alcance),
        ),
      )
      .orderBy(asc(material.id))
      .limit(limite + 1)
  }

  /** O material não excluído com esse id, se quem pede o alcança; o de outra escola não é achado. */
  async porId(id: string, alcance: AlcanceDoMaterial): Promise<MaterialLido | undefined> {
    const [linha] = await this.banco
      .select(colunas)
      .from(material)
      .where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), isNull(material.excluidoEm), this.#noAlcance(alcance)))
    return linha
  }

  /**
   * A exclusão lógica: marca o material da escola com esse id, com quem excluiu, e devolve o que ele era. O de outra
   * escola, o inexistente e o já excluído não são achados (`undefined`), e nada muda.
   */
  async excluir(id: string): Promise<{ disciplinaId: string; estado: EstadoDeMaterial } | undefined> {
    const { usuarioId } = requestSessao()
    const [excluido] = await this.banco
      .update(material)
      .set({ excluidoEm: sql`now()`, excluidoPor: usuarioId })
      .where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), isNull(material.excluidoEm)))
      .returning({ disciplinaId: material.disciplinaId, estado: material.estado })
    return excluido
  }

  /** Apaga de fato os trechos do material da escola, e devolve quantos: texto de material excluído não fica na busca. */
  async apagarTrechos(materialId: string): Promise<number> {
    const apagados = await this.banco
      .delete(trecho)
      .where(and(eq(trecho.escolaId, requireEscolaId()), eq(trecho.materialId, materialId)))
      .returning({ id: trecho.id })
    return apagados.length
  }

  /**
   * `processando` → `pronto`, com o total de páginas, numa instrução só, e devolve a disciplina do material. Não acha
   * (`undefined`) o material que foi excluído ou que a varredura já deu por falho enquanto era lido: quem recebe
   * `undefined` não grava trecho nenhum.
   */
  async marcarPronto(id: string, paginas: number): Promise<string | undefined> {
    const [pronto] = await this.banco
      .update(material)
      .set({ estado: 'pronto', paginas })
      .where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), eq(material.estado, 'processando'), isNull(material.excluidoEm)))
      .returning({ disciplinaId: material.disciplinaId })
    return pronto?.disciplinaId
  }

  /** `processando` → `falhou`, com o código da lista fechada. Não mexe no que já saiu de `processando`. */
  async marcarFalhou(id: string, falha: FalhaDeMaterial): Promise<boolean> {
    const falhos = await this.banco
      .update(material)
      .set({ estado: 'falhou', falha })
      .where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), eq(material.estado, 'processando')))
      .returning({ id: material.id })
    return falhos.length > 0
  }

  /** Grava um trecho por página com texto. A página repetida não entra duas vezes (`trecho_pagina_do_material_unica`). */
  async gravarTrechos(materialId: string, disciplinaId: string, paginas: readonly PaginaExtraida[]): Promise<void> {
    const escolaId = requireEscolaId()
    for (let inicio = 0; inicio < paginas.length; inicio += TRECHOS_POR_INSERCAO) {
      const lote = paginas.slice(inicio, inicio + TRECHOS_POR_INSERCAO)
      await this.banco
        .insert(trecho)
        .values(lote.map(({ pagina, texto }) => ({ escolaId, disciplinaId, materialId, pagina, texto })))
        .onConflictDoNothing({ target: [trecho.escolaId, trecho.materialId, trecho.pagina] })
    }
  }

  /**
   * A busca por texto completo em português (`trecho.busca`), **sempre com a escola do contexto**, só em material
   * `pronto` e não excluído, e dentro do alcance de quem pede. As páginas vêm por relevância; no empate, pela ordem do
   * material e da página, para a mesma busca devolver sempre a mesma lista.
   *
   * O filtro começa por `trecho.escola_id` e `disciplina_id`, que são o começo do índice GIN (regra 80, item 8).
   */
  buscar({ texto, disciplinaId, materialId, limite, palavras }: FiltroDaBusca, alcance: AlcanceDoMaterial): Promise<TrechoAchado[]> {
    const escolaId = requireEscolaId()
    const todas = sql`websearch_to_tsquery('portuguese', ${texto})`
    // `a & b` vira `a | b`: a consulta já saiu do analisador do Postgres, e o texto dela só tem lexemas e operadores.
    const consulta = palavras === 'todas' ? todas : sql`replace(${todas}::text, '&', '|')::tsquery`
    return this.banco
      .select(colunasDoTrecho)
      .from(trecho)
      .innerJoin(material, and(eq(material.escolaId, trecho.escolaId), eq(material.id, trecho.materialId)))
      .where(
        and(
          eq(trecho.escolaId, escolaId),
          eq(material.escolaId, escolaId),
          disciplinaId === undefined ? undefined : eq(trecho.disciplinaId, disciplinaId),
          materialId === undefined ? undefined : eq(trecho.materialId, materialId),
          sql`${trecho.busca} @@ ${consulta}`,
          eq(material.estado, 'pronto'),
          isNull(material.excluidoEm),
          this.#noAlcance(alcance),
        ),
      )
      .orderBy(desc(sql`${trecho.busca} @@ ${todas}`), desc(sql`ts_rank(${trecho.busca}, ${consulta})`), asc(trecho.materialId), asc(trecho.pagina))
      .limit(limite)
  }

  /** As páginas de um material `pronto` e não excluído da escola **e da disciplina pedida**, em ordem, até `limite`. */
  paginasDoMaterial(materialId: string, disciplinaId: string, limite: number, alcance: AlcanceDoMaterial): Promise<TrechoAchado[]> {
    const escolaId = requireEscolaId()
    return this.banco
      .select(colunasDoTrecho)
      .from(trecho)
      .innerJoin(material, and(eq(material.escolaId, trecho.escolaId), eq(material.id, trecho.materialId)))
      .where(
        and(
          eq(trecho.escolaId, escolaId),
          eq(material.escolaId, escolaId),
          eq(trecho.disciplinaId, disciplinaId),
          eq(trecho.materialId, materialId),
          eq(material.estado, 'pronto'),
          isNull(material.excluidoEm),
          this.#noAlcance(alcance),
        ),
      )
      .orderBy(asc(trecho.pagina))
      .limit(limite)
  }
}

const JUSTIFICATIVA_DA_VARREDURA =
  'Rotina nossa, sem requisição: encerra o material que ficou `processando` porque o processo que o lia caiu. O PDF não é guardado, então não há o que retomar; não lê título, texto nem pessoa, só troca o estado.'

/**
 * A única consulta do módulo sem a cláusula de escola (regra 10, item 9): a varredura do que ficou para trás. Fica numa
 * classe própria para o repository que atende requisição não ter método sem escopo nenhum.
 */
export class MaterialParadoRepository {
  constructor(private readonly banco: Database) {}

  /**
   * Todo material `processando` enviado antes de `antesDe` vira `falhou` com `extracao_falhou`, em qualquer escola.
   * Devolve quantos. O excluído fica como está: ninguém o vê.
   */
  @Unscoped(JUSTIFICATIVA_DA_VARREDURA)
  async falharParados(antesDe: Date): Promise<number> {
    const falhos = await this.banco
      .update(material)
      .set({ estado: 'falhou', falha: 'extracao_falhou' })
      .where(and(eq(material.estado, 'processando'), lt(material.enviadoEm, antesDe), isNull(material.excluidoEm)))
      .returning({ id: material.id })
    return falhos.length
  }
}
