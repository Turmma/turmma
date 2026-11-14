import { requireEscolaId, capituloDoMaterial, licencaDeMaterial, material, materialSerie, requestSessao, serie, trecho, vinculo, type Database, type DatabaseTransaction } from '@educa/core'
import type { CapituloDoMaterial, MateriaisQuery, EstadoDeMaterial, FalhaDeMaterial, LicencaDeMaterial, TitularidadeDeMaterial } from '@educa/shared'
import { and, asc, desc, eq, exists, gt, gte, inArray, isNull, lte, ne, or, sql, type SQL } from 'drizzle-orm'
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
  /** O rótulo da edição, nulo no que não é edição ou foi enviada sem rótulo. */
  readonly edicao: string | null
  /** O material que esta edição substitui (ou substituiu); nulo no que não é edição, e na edição cuja anterior saiu no expurgo. */
  readonly substitui: string | null
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
  /** O rótulo da edição ("2025"); só a edição o leva. */
  readonly edicao?: string | null | undefined
  /** O material que esta edição vai substituir quando ficar pronta; só a edição o leva. */
  readonly substituiId?: string | null | undefined
}

/**
 * O que a edição lê do material que vai substituir, e que **herda**: a disciplina, a titularidade, o licenciante, a licença registrada e a de uso. As séries vêm à parte (`seriesDoMaterial`), lidas
 * depois da trava. Nunca o resumo do arquivo nem quem enviou.
 */
export interface AlvoDaEdicao {
  readonly id: string
  readonly estado: EstadoDeMaterial
  readonly titulo: string
  readonly disciplinaId: string
  readonly titularidade: TitularidadeDeMaterial
  readonly licenciante: string | null
  readonly licencaId: string | null
  readonly licenca: LicencaDeMaterial
}

/** O que o `PATCH` lê do material que vai alterar, com a linha travada: se é uma edição ainda `processando` (`substitui` não nulo), ele não se altera. */
export interface MaterialParaAtualizar {
  readonly id: string
  readonly estado: EstadoDeMaterial
  readonly substitui: string | null
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
  /** Só o material declarado para a série. Obrigatório a quem lê por uma turma (Assistente, Tutor); a rota da busca o recebe do cliente, e ele só filtra. */
  readonly serieId?: string | undefined
  /** O dia de São Paulo em que a licença é conferida (`diaDeUso`), do `Clock` de quem chama: nunca o relógio do banco. */
  readonly hoje: string
  readonly limite: number
  /**
   * `todas`: a página precisa ter todas as palavras (`websearch_to_tsquery`, o contrato da rota). `qualquer`: basta
   * uma, e a página que tem todas vem na frente — é o que serve a quem busca com a frase inteira de uma pessoa.
   */
  readonly palavras: 'todas' | 'qualquer'
}

/** Quantos materiais não excluídos da escola há num estado, numa disciplina e numa série (`serieId` nulo: o material sem série). Só ids e uma contagem. */
export interface MateriaisContados {
  readonly disciplinaId: string
  readonly serieId: string | null
  readonly estado: EstadoDeMaterial
  readonly total: number
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
  edicao: material.edicao,
  substitui: material.substituiId,
  estado: material.estado,
  falha: material.falha,
  paginas: material.paginas,
  trechos: quantosTrechos,
  enviadoEm: material.enviadoEm,
}

const colunas = { ...colunasDaLinha, serieIds: dasSeries }

const colunasDoAlvo = {
  id: material.id,
  estado: material.estado,
  titulo: material.titulo,
  disciplinaId: material.disciplinaId,
  titularidade: material.titularidade,
  licenciante: material.licenciante,
  licencaId: material.licencaId,
  licenca: material.licenca,
}

/**
 * O material declarado para a série. A série de outra escola não casa com material desta: o filtro é igual ao da série que não existe.
 * **Uma cópia só**: a lista, a busca, a página aberta, o `materialDaTurma` do Tutor e o `existeMaterialDaSerie` leem a série por aqui.
 * O corte `eq(materialSerie.escolaId, requireEscolaId())` **repete** o da tabela principal de quem chama (regra 10, item 3): é defesa em profundidade e **não é sobra**. Tirar um dos dois não
 * quebra a consulta inteira, porque o outro segura; o teste de isolamento chama o fragmento sozinho, sem o escopo de fora, para provar o dele.
 */
export function declaradoParaASerie(banco: Database | DatabaseTransaction, serieId: string): SQL {
  return exists(
    banco
      .select({ um: materialSerie.serieId })
      .from(materialSerie)
      .where(and(eq(materialSerie.escolaId, requireEscolaId()), eq(materialSerie.materialId, material.id), eq(materialSerie.serieId, serieId))),
  )
}

/**
 * O material que a escola pode ler **hoje**: o próprio (do que não é de terceiro) ou o de terceiro cuja licença registrada vale no dia: `vigente_desde <= hoje` e `vigente_ate` nula ou `>= hoje`.
 * O de terceiro sem licença registrada (o que o código anterior à F4 gravou depois da volta) não é lido: sem licença que o autorize, a escola não o usa (D5). `hoje` é o dia de São Paulo (`diaDeUso`).
 * O corte `eq(licencaDeMaterial.escolaId, requireEscolaId())` **repete** o da tabela principal de quem chama (regra 10, item 3): defesa em profundidade, **não é sobra**; o teste de isolamento chama o
 * fragmento sozinho para provar o dele.
 */
export function proprioOuComLicencaVigente(banco: Database | DatabaseTransaction, hoje: string): SQL | undefined {
  return or(
    ne(material.titularidade, 'terceiro_com_licenca'),
    exists(
      banco
        .select({ um: licencaDeMaterial.id })
        .from(licencaDeMaterial)
        .where(
          and(
            eq(licencaDeMaterial.escolaId, requireEscolaId()),
            eq(licencaDeMaterial.id, material.licencaId),
            lte(licencaDeMaterial.vigenteDesde, hoje),
            or(isNull(licencaDeMaterial.vigenteAte), gte(licencaDeMaterial.vigenteAte, hoje)),
          ),
        ),
    ),
  )
}

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

  /** O material declarado para a série (`declaradoParaASerie`, a cópia única). */
  #comASerie(serieId: string): SQL {
    return declaradoParaASerie(this.banco, serieId)
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

  /**
   * O material que a edição vai substituir, **antes de ler o arquivo**: o não excluído da escola do contexto, em qualquer estado. O de outra escola, o excluído, o já substituído e o inexistente não são achados
   * (`undefined`), e quem chama responde `NAO_ENCONTRADO` igual aos quatro. Leitura sem trava: quem decide é `travarAlvoDaEdicao`, na transação.
   */
  async alvoDaEdicao(id: string): Promise<AlvoDaEdicao | undefined> {
    const [alvo] = await this.banco
      .select(colunasDoAlvo)
      .from(material)
      .where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), isNull(material.excluidoEm)))
    return alvo
  }

  /**
   * O alvo da edição, **`for update`**, lido de dentro da transação do envio: só o `pronto` e não excluído. A substituição de outra edição sobre o mesmo alvo (a extração dela, no worker) segura esta linha até o commit, então
   * quem espera aqui e depois acha o alvo excluído não acha nada (`undefined`): o alvo já foi substituído. Quem lê as séries e a licença depois desta linha as lê já com o que o `PATCH` de séries confirmou.
   */
  async travarAlvoDaEdicao(id: string): Promise<AlvoDaEdicao | undefined> {
    const [alvo] = await this.banco
      .select(colunasDoAlvo)
      .from(material)
      .where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), eq(material.estado, 'pronto'), isNull(material.excluidoEm)))
      .for('update')
    return alvo
  }

  /**
   * A linha do material que o `PATCH` vai alterar, **`for update`** até o fim da transação (ingestao-do-material, 12.0): o não excluído da escola do contexto, em qualquer estado. O de outra escola, o excluído, o
   * substituído e o inexistente não são achados (`undefined`), e quem chama responde `NAO_ENCONTRADO` igual aos quatro. A trava é a mesma do alvo da edição (`travarAlvoDaEdicao`): o `PATCH` espera a edição que está
   * sendo gravada sobre este material e, quando ela confirma, já enxerga a edição `processando` (`EDICAO_EM_ANDAMENTO`); dois `PATCH` do mesmo material passam um depois do outro.
   */
  async travarParaAtualizar(id: string): Promise<MaterialParaAtualizar | undefined> {
    const [linha] = await this.banco
      .select({ id: material.id, estado: material.estado, substitui: material.substituiId })
      .from(material)
      .where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), isNull(material.excluidoEm)))
      .for('update')
    return linha
  }

  /** Troca o título do material da escola do contexto. Quem chama já travou a linha (`travarParaAtualizar`). */
  async renomear(id: string, titulo: string): Promise<void> {
    await this.banco
      .update(material)
      .set({ titulo })
      .where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id)))
  }

  /** Troca as séries declaradas do material da escola do contexto pelas dadas (de 1 a 7, sem repetir): as de antes saem e as novas entram. Quem chama já travou a linha (`travarParaAtualizar`) e conferiu as séries. */
  async substituirSeries(materialId: string, serieIds: readonly string[]): Promise<void> {
    await this.banco.delete(materialSerie).where(and(eq(materialSerie.escolaId, requireEscolaId()), eq(materialSerie.materialId, materialId)))
    await this.gravarSeries(materialId, serieIds)
  }

  /** Há uma edição deste material sendo lida (`processando`, não excluída)? Sob a trava de envios da escola, é a checagem que o índice `material_uma_edicao_em_andamento` repete. */
  async edicaoEmAndamentoSobre(alvoId: string): Promise<boolean> {
    const [achada] = await this.banco
      .select({ id: material.id })
      .from(material)
      .where(and(eq(material.escolaId, requireEscolaId()), eq(material.substituiId, alvoId), eq(material.estado, 'processando'), isNull(material.excluidoEm)))
      .limit(1)
    return achada !== undefined
  }

  /** As séries declaradas do material da escola do contexto, em ordem de id: o que a edição herda. */
  async seriesDoMaterial(materialId: string): Promise<string[]> {
    const linhas = await this.banco
      .select({ serieId: materialSerie.serieId })
      .from(materialSerie)
      .where(and(eq(materialSerie.escolaId, requireEscolaId()), eq(materialSerie.materialId, materialId)))
      .orderBy(asc(materialSerie.serieId))
    return linhas.map((linha) => linha.serieId)
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

  /**
   * Os materiais da escola do contexto contados por disciplina, série e estado (ingestao-do-material, 11.0; RF18): a base do resumo. O material com várias séries entra em cada uma, e o sem nenhuma
   * volta com `serieId` nulo (a junção à esquerda). Fica de fora o excluído, e com ele o substituído por uma edição pronta (a extração marca `excluido_em` na mesma transação que `substituido_por`). Só a coordenação
   * chega aqui (a célula `material.resumir` da `MATRIZ`): não há alcance por vínculo.
   */
  contarPorDisciplinaESerie(): Promise<MateriaisContados[]> {
    return this.banco
      .select({ disciplinaId: material.disciplinaId, serieId: materialSerie.serieId, estado: material.estado, total: sql<number>`count(*)::int` })
      .from(material)
      .leftJoin(materialSerie, and(eq(materialSerie.escolaId, material.escolaId), eq(materialSerie.materialId, material.id)))
      .where(and(eq(material.escolaId, requireEscolaId()), isNull(material.excluidoEm)))
      .groupBy(material.disciplinaId, materialSerie.serieId, material.estado)
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
  buscar({ texto, disciplinaId, materialId, serieId, hoje, limite, palavras }: FiltroDaBusca, alcance: AlcanceDoMaterial): Promise<TrechoAchado[]> {
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
          serieId === undefined ? undefined : this.#comASerie(serieId),
          proprioOuComLicencaVigente(this.banco, hoje),
          this.#noAlcance(alcance),
        ),
      )
      .orderBy(desc(sql`${trecho.busca} @@ ${todas}`), desc(sql`ts_rank(${trecho.busca}, ${consulta})`), asc(trecho.materialId), asc(trecho.pagina))
      .limit(limite)
  }

  /**
   * As páginas de um material `pronto` e não excluído da escola **e da disciplina pedida**, em ordem, até `limite`, **da série dada e de licença vigente hoje**: a página aberta de uma
   * edição substituída, ou de material cuja licença venceu, não devolve nada.
   */
  paginasDoMaterial(materialId: string, disciplinaId: string, serieId: string, hoje: string, limite: number, alcance: AlcanceDoMaterial): Promise<TrechoAchado[]> {
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
          this.#comASerie(serieId),
          proprioOuComLicencaVigente(this.banco, hoje),
          this.#noAlcance(alcance),
        ),
      )
      .orderBy(asc(trecho.pagina))
      .limit(limite)
  }

  /**
   * Há material `pronto`, não excluído, da disciplina e da série, próprio ou de licença vigente hoje? É o que a ferramenta e o chat conferem **antes do `202`** (`SEM_MATERIAL_DA_SERIE`) e o que o
   * Tutor confere depois da D36: o único material da série que venceu, ou que ainda está `processando`, não conta. Quem chama já conferiu que a pessoa alcança a disciplina.
   */
  async existeMaterialDaSerie(serieId: string, disciplinaId: string, hoje: string): Promise<boolean> {
    const [achado] = await this.banco
      .select({ id: material.id })
      .from(material)
      .where(
        and(
          eq(material.escolaId, requireEscolaId()),
          eq(material.disciplinaId, disciplinaId),
          eq(material.estado, 'pronto'),
          isNull(material.excluidoEm),
          this.#comASerie(serieId),
          proprioOuComLicencaVigente(this.banco, hoje),
        ),
      )
      .limit(1)
    return achado !== undefined
  }
}
