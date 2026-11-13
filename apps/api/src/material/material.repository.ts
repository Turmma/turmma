import { requireEscolaId, capituloDoMaterial, material, materialSerie, requestSessao, serie, trecho, vinculo, type Database, type DatabaseTransaction } from '@educa/core'
import type { CapituloDoMaterial, MateriaisQuery, EstadoDeMaterial, FalhaDeMaterial, LicencaDeMaterial, TitularidadeDeMaterial } from '@educa/shared'
import { and, asc, desc, eq, exists, gt, gte, inArray, isNull, sql, type SQL } from 'drizzle-orm'
import { InvariantException } from '@educa/shared'

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
  readonly licencaId: string | null
  readonly licenca: LicencaDeMaterial
  /** As séries declaradas, em ordem de id; vazio no material que a migração deixou sem série (a escola sem nenhuma). */
  readonly serieIds: string[]
  readonly estado: EstadoDeMaterial
  readonly falha: FalhaDeMaterial | null
  readonly paginas: number | null
  readonly trechos: number
  readonly enviadoEm: Date
}

export interface NovoMaterial {
  /** O id que a aplicação gerou antes de gravar o objeto: a chave do PDF no storage o leva. */
  readonly id: string
  readonly disciplinaId: string
  readonly titulo: string
  readonly titularidade: TitularidadeDeMaterial
  /** O licenciante **da licença registrada** (`licencaId`), copiado dela: o pedido não traz nome. Nulo no que não é de terceiro. */
  readonly licenciante: string | null
  readonly licencaId: string | null
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

/** As séries do material, em ordem de id. Nomes qualificados, pelo mesmo motivo de `quantosTrechos`; a lista vazia (sem série) é `{}`, nunca nula. */
const dasSeries = sql<string[]>`coalesce((select array_agg("material_serie"."serie_id" order by "material_serie"."serie_id") from "material_serie" where "material_serie"."escola_id" = "material"."escola_id" and "material_serie"."material_id" = "material"."id"), '{}'::uuid[])`

/** As colunas da própria linha: o `insert ... returning` só pode devolver estas, porque as séries ainda não foram gravadas. */
const colunasDaLinha = {
  id: material.id,
  titulo: material.titulo,
  disciplinaId: material.disciplinaId,
  titularidade: material.titularidade,
  licenciante: material.licenciante,
  licencaId: material.licencaId,
  licenca: material.licenca,
  estado: material.estado,
  falha: material.falha,
  paginas: material.paginas,
  trechos: quantosTrechos,
  enviadoEm: material.enviadoEm,
}

const colunas = { ...colunasDaLinha, serieIds: dasSeries }

const colunasDoTrecho = { materialId: trecho.materialId, disciplinaId: trecho.disciplinaId, titulo: material.titulo, pagina: trecho.pagina, texto: trecho.texto }

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

  /** O material declarado para a série. A série de outra escola não casa com material desta: o filtro é igual ao da série que não existe. */
  #comASerie(serieId: string): SQL {
    return exists(
      this.banco
        .select({ um: materialSerie.serieId })
        .from(materialSerie)
        .where(and(eq(materialSerie.escolaId, material.escolaId), eq(materialSerie.materialId, material.id), eq(materialSerie.serieId, serieId))),
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
   * Grava o material, `processando`, com o id que a aplicação gerou e a declaração verdadeira (só chega aqui quem passou por
   * `motivoDaRecusaDoMaterial`). O mesmo arquivo de novo na escola esbarra no índice único `(escola_id, sha256)` entre
   * os não excluídos e não falhos, e sai `CONFLITO` pelo filtro de erro: dois envios ao mesmo tempo gravam um.
   */
  async inserir(novo: NovoMaterial): Promise<Omit<MaterialLido, 'serieIds'>> {
    const { usuarioId } = requestSessao()
    const [gravado] = await this.banco
      .insert(material)
      .values({ ...novo, escolaId: requireEscolaId(), declaracao: true, enviadoPor: usuarioId })
      .returning({ ...colunasDaLinha, trechos: sql<number>`0` })
    if (gravado === undefined) throw new InvariantException('material não gravado')
    return gravado
  }

  /** Quais destas séries são da escola do contexto: a de outra escola e a inexistente não são achadas. Quem chama compara com o que pediu. */
  async seriesDaEscola(serieIds: readonly string[]): Promise<string[]> {
    const achadas = await this.banco
      .select({ id: serie.id })
      .from(serie)
      .where(and(eq(serie.escolaId, requireEscolaId()), inArray(serie.id, [...serieIds])))
    return achadas.map((linha) => linha.id)
  }

  /** Declara as séries do material recém-gravado, na escola do contexto. A chave `(escola_id, material_id, serie_id)` não admite a mesma duas vezes. */
  async gravarSeries(materialId: string, serieIds: readonly string[]): Promise<void> {
    const escolaId = requireEscolaId()
    await this.banco.insert(materialSerie).values(serieIds.map((serieId) => ({ escolaId, materialId, serieId })))
  }

  /** Uma página dos materiais não excluídos, em ordem de envio, com uma linha a mais que diz se há próxima. */
  listar({ pagina, limite, disciplinaId, serieId }: MateriaisQuery, alcance: AlcanceDoMaterial): Promise<MaterialLido[]> {
    return this.banco
      .select(colunas)
      .from(material)
      .where(
        and(
          eq(material.escolaId, requireEscolaId()),
          isNull(material.excluidoEm),
          disciplinaId === undefined ? undefined : eq(material.disciplinaId, disciplinaId),
          serieId === undefined ? undefined : this.#comASerie(serieId),
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

  /** Os capítulos do material da escola do contexto, em ordem. Quem chama já conferiu que o material é alcançado (`porId`); a escola vem do contexto. */
  capitulos(materialId: string): Promise<CapituloDoMaterial[]> {
    return this.banco
      .select({ ordem: capituloDoMaterial.ordem, numero: capituloDoMaterial.numero, titulo: capituloDoMaterial.titulo, paginaInicial: capituloDoMaterial.paginaInicial, paginaFinal: capituloDoMaterial.paginaFinal })
      .from(capituloDoMaterial)
      .where(and(eq(capituloDoMaterial.escolaId, requireEscolaId()), eq(capituloDoMaterial.materialId, materialId)))
      .orderBy(asc(capituloDoMaterial.ordem))
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
