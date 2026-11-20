import {
  artefato,
  capituloDoMaterial,
  CARACTERES_LIDOS_POR_PAGINA,
  disciplina,
  execucaoAgente,
  habilidadeBncc,
  habilidadeDaSecao,
  material,
  materialSerie,
  PAGINAS_LIDAS_POR_SECAO,
  requestSessao,
  requireAnoEmCurso,
  requireEscolaId,
  secaoDoMaterial,
  serie,
  trecho,
  turma,
  type Database,
  type DatabaseTransaction,
} from '@educa/core'
import { descricaoParaOModelo, habilidadeEhCandidata, MAXIMO_DE_HABILIDADES_POR_SECAO, type ComponenteBncc, type HabilidadeCandidataBncc, type EstadoDeExecucao, type OrigemDaHabilidadeDaSecao, type SecaoDaQuestao, type SerieDoRecorte } from '@educa/shared'
import { and, asc, eq, gte, inArray, isNotNull, isNull, lte, or, sql } from 'drizzle-orm'
import { comVinculoConfirmadoDoProfessor } from '../assistente/turma-do-professor.repository.js'

/** A seção viva que a execução classifica: o que o `preparar` monta a entrada. O texto vem à parte (`paginasDaSecao`). */
export interface SecaoParaClassificar {
  readonly secaoId: string
  readonly materialId: string
  readonly titulo: string | null
  readonly paginaInicial: number
  readonly paginaFinal: number
  readonly disciplinaId: string
}

/** A seção como o painel a lê (classificacao-bncc, 7.0): as páginas, o capítulo, a execução que a classifica e se a coordenação a corrigiu. Nunca `corrigida_por`, que é dado de pessoa e fica no banco. */
export interface SecaoLida {
  readonly id: string
  readonly ordem: number
  readonly paginaInicial: number
  readonly paginaFinal: number
  readonly capituloNumero: number | null
  readonly capituloTitulo: string | null
  readonly estadoDaExecucao: EstadoDeExecucao | null
  readonly corrigida: boolean
}

/** Uma habilidade da seção, com o texto da BNCC e quem a pôs. */
export interface HabilidadeLida {
  readonly secaoId: string
  readonly codigo: string
  readonly descricao: string
  readonly origem: OrigemDaHabilidadeDaSecao
}

/** O componente e as séries que decidem quais habilidades da BNCC um material (ou o artefato do professor) pode receber. */
export interface RecorteDasHabilidades {
  readonly componente: ComponenteBncc | null
  readonly series: SerieDoRecorte[]
}

/** O que a gravação devolve por seção gravada: quanto o material esperou desde o envio, para a métrica (§7c). */
export interface SecaoGravada {
  readonly secaoId: string
  readonly segundosDesdeOEnvio: number
}

/**
 * As seções do material para a **classificação** (classificacao-bncc, tarefa 4.0; Tech Spec, seções 5 e 6): a leitura do `preparar`, a gravação do `concluir`, a limpeza da execução sem candidata e a falha que soma
 * em `falhas_seguidas`. A escola é a do contexto do job (`job_registro.escola_id`, que o `JobExecutor` grava): entra em **toda** cláusula (regra 10, item 3), e nenhum método a recebe por argumento. Com o contexto da
 * escola A e a execução da B, nada é lido nem mudado. Uma instância por banco ou por transação: o `concluir` e o gancho de falha recebem a transação da execução.
 */
export class SecoesRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /**
   * As seções **vivas** da execução: `execucao_id = :esta`, sem `corrigida_em` (a correção da coordenação vence, P1a) e de material `pronto` e não excluído (P4). Na ordem do material e da seção, até o que a execução
   * comporta (`limite`).
   */
  async vivasDaExecucao(execucaoId: string, limite: number): Promise<SecaoParaClassificar[]> {
    const escolaId = requireEscolaId()
    const linhas = await this.banco
      .select({
        secaoId: secaoDoMaterial.id,
        materialId: secaoDoMaterial.materialId,
        titulo: capituloDoMaterial.titulo,
        paginaInicial: secaoDoMaterial.paginaInicial,
        paginaFinal: secaoDoMaterial.paginaFinal,
        disciplinaId: material.disciplinaId,
      })
      .from(secaoDoMaterial)
      .innerJoin(material, and(eq(material.escolaId, secaoDoMaterial.escolaId), eq(material.id, secaoDoMaterial.materialId)))
      .leftJoin(capituloDoMaterial, and(eq(capituloDoMaterial.escolaId, secaoDoMaterial.escolaId), eq(capituloDoMaterial.id, secaoDoMaterial.capituloId)))
      .where(and(eq(secaoDoMaterial.escolaId, escolaId), eq(secaoDoMaterial.execucaoId, execucaoId), isNull(secaoDoMaterial.corrigidaEm), eq(material.estado, 'pronto'), isNull(material.excluidoEm)))
      .orderBy(asc(secaoDoMaterial.materialId), asc(secaoDoMaterial.ordem))
      .limit(limite)
    return linhas
  }

  /** O texto de cada página da seção, na ordem, até o que a classificação lê (`PAGINAS_LIDAS_POR_SECAO` páginas, `CARACTERES_LIDOS_POR_PAGINA` de cada). */
  async paginasDaSecao(materialId: string, paginaInicial: number, paginaFinal: number): Promise<string[]> {
    const escolaId = requireEscolaId()
    const ate = Math.min(paginaFinal, paginaInicial + PAGINAS_LIDAS_POR_SECAO - 1)
    const linhas = await this.banco
      .select({ texto: sql<string>`left(${trecho.texto}, ${CARACTERES_LIDOS_POR_PAGINA})` })
      .from(trecho)
      .where(and(eq(trecho.escolaId, escolaId), eq(trecho.materialId, materialId), sql`${trecho.pagina} between ${paginaInicial} and ${ate}`))
      .orderBy(asc(trecho.pagina))
    return linhas.map((linha) => linha.texto)
  }

  /** O componente de cada disciplina e as séries de cada material, para o recorte das candidatas. Disciplina sem componente não aparece com valor: `null`. */
  async recorteDosMateriais(disciplinaIds: readonly string[], materialIds: readonly string[]): Promise<{ componentes: Map<string, ComponenteBncc | null>; series: Map<string, SerieDoRecorte[]> }> {
    const escolaId = requireEscolaId()
    const componentes = new Map<string, ComponenteBncc | null>()
    if (disciplinaIds.length > 0) {
      const linhas = await this.banco
        .select({ id: disciplina.id, componente: disciplina.componenteBncc })
        .from(disciplina)
        .where(and(eq(disciplina.escolaId, escolaId), inArray(disciplina.id, [...disciplinaIds])))
      for (const linha of linhas) componentes.set(linha.id, linha.componente)
    }
    const series = new Map<string, SerieDoRecorte[]>()
    if (materialIds.length > 0) {
      const linhas = await this.banco
        .select({ materialId: materialSerie.materialId, etapa: serie.etapa, ano: serie.ano })
        .from(materialSerie)
        .innerJoin(serie, and(eq(serie.escolaId, materialSerie.escolaId), eq(serie.id, materialSerie.serieId)))
        .where(and(eq(materialSerie.escolaId, escolaId), inArray(materialSerie.materialId, [...materialIds])))
      for (const linha of linhas) series.set(linha.materialId, [...(series.get(linha.materialId) ?? []), { etapa: linha.etapa, ano: linha.ano }])
    }
    return { componentes, series }
  }

  /**
   * A consulta que `habilidadesDasPaginas` roda, sem executá-la: o `EXPLAIN` da Tech Spec, seção 7c, a lê daqui (`.toSQL()`), e não de uma cópia escrita à mão. O `or(...)` de páginas traz de uma vez as
   * seções candidatas de todas as páginas da busca (até 20), cada uma presa à escola e ao material pelo índice `(escola_id, material_id, pagina_inicial)`.
   */
  consultaDasHabilidadesDasPaginas(paginas: ReadonlyArray<{ readonly materialId: string; readonly pagina: number }>, soDaCoordenacao: boolean) {
    const escolaId = requireEscolaId()
    return this.banco
      .select({
        materialId: secaoDoMaterial.materialId,
        paginaInicial: secaoDoMaterial.paginaInicial,
        paginaFinal: secaoDoMaterial.paginaFinal,
        codigo: habilidadeDaSecao.codigo,
        descricao: habilidadeBncc.descricao,
      })
      .from(secaoDoMaterial)
      .innerJoin(habilidadeDaSecao, and(eq(habilidadeDaSecao.escolaId, secaoDoMaterial.escolaId), eq(habilidadeDaSecao.secaoId, secaoDoMaterial.id)))
      .innerJoin(habilidadeBncc, eq(habilidadeBncc.codigo, habilidadeDaSecao.codigo))
      .where(
        and(
          eq(secaoDoMaterial.escolaId, escolaId),
          or(...paginas.map((pagina) => and(eq(secaoDoMaterial.materialId, pagina.materialId), lte(secaoDoMaterial.paginaInicial, pagina.pagina), gte(secaoDoMaterial.paginaFinal, pagina.pagina)))),
          soDaCoordenacao ? eq(habilidadeDaSecao.origem, 'coordenacao') : undefined,
        ),
      )
      .orderBy(asc(habilidadeDaSecao.codigo))
  }

  /**
   * As habilidades da BNCC da **seção de cada página** dada (classificacao-bncc, 10.0; Tech Spec, seção 5, "Geração"), no recorte atual da turma: só as que `habilidadeEhCandidata` aceita para o componente da
   * disciplina e para a série da turma (o 9º ano não recebe `EF06…` de um material passado do 6º ao 9º). Página de antes do primeiro capítulo, de seção ainda `aguardando` ou `sem_habilidade`, e disciplina sem
   * componente: lista vazia. `soDaCoordenacao` (a função suspensa) deixa só `origem: 'coordenacao'`. A escola é a do contexto e entra no `secao_do_material` e no `habilidade_da_secao` (a junção usa o índice
   * `(escola_id, material_id, pagina_inicial)` da seção e a chave `(escola_id, secao_id, codigo)` da habilidade). Devolve por `materialId:pagina`, na ordem do código, até `MAXIMO_DE_HABILIDADES_POR_SECAO`.
   * **Premissa:** as páginas vêm de uma busca que já conferiu o estado e a licença do material (`TrechoSearch.find`); este método lê a classificação da seção, e **não** confere se o material está `pronto`, nem a licença,
   * nem se foi excluído. Quem o chamar com página que não veio dessa busca pode ler as habilidades de material excluído da própria escola (nunca de outra: a escola é a do contexto).
   */
  async habilidadesDasPaginas(
    paginas: ReadonlyArray<{ readonly materialId: string; readonly pagina: number }>,
    recorte: { readonly disciplinaId: string; readonly serieId: string },
    soDaCoordenacao: boolean,
  ): Promise<Map<string, HabilidadeCandidataBncc[]>> {
    const porPagina = new Map<string, HabilidadeCandidataBncc[]>()
    if (paginas.length === 0) return porPagina
    const escolaId = requireEscolaId()
    const [turmaDoPedido] = await this.banco
      .select({ componente: disciplina.componenteBncc, etapa: serie.etapa, ano: serie.ano })
      .from(serie)
      .innerJoin(disciplina, and(eq(disciplina.escolaId, serie.escolaId), eq(disciplina.id, recorte.disciplinaId)))
      .where(and(eq(serie.escolaId, escolaId), eq(serie.id, recorte.serieId)))
    if (turmaDoPedido === undefined || turmaDoPedido.componente === null) return porPagina
    const { componente } = turmaDoPedido
    const series: SerieDoRecorte[] = [{ etapa: turmaDoPedido.etapa, ano: turmaDoPedido.ano }]
    const linhas = await this.consultaDasHabilidadesDasPaginas(paginas, soDaCoordenacao)
    for (const { materialId, pagina } of paginas) {
      const daPagina = linhas
        .filter((linha) => linha.materialId === materialId && linha.paginaInicial <= pagina && pagina <= linha.paginaFinal && habilidadeEhCandidata(linha.codigo, componente, series))
        .slice(0, MAXIMO_DE_HABILIDADES_POR_SECAO)
        // A descrição acima do teto do contrato vai cortada (`descricaoParaOModelo`); o texto inteiro fica em `habilidade_bncc`.
        .map(({ codigo, descricao }) => ({ codigo, descricao: descricaoParaOModelo(descricao) }))
      porPagina.set(`${materialId}:${String(pagina)}`, daPagina)
    }
    return porPagina
  }

  /**
   * A seção de cada página dada (classificacao-bncc, 11.0; RF9): o capítulo (nulo no bloco de páginas), as páginas e as habilidades que ela tem agora, de qualquer origem, na ordem do código. É o que a tela do artefato mostra como
   * "o capítulo" da questão e põe primeiro na lista da troca. Só o material `pronto` e não excluído: a página de um material que saiu, de antes do primeiro capítulo ou de seção que não existe não tem entrada. A escola é a do contexto
   * e entra em toda junção; **só se chama com as páginas de um artefato já achado no alcance** (a citação vem do `jsonb`, sem FK, e a escola do contexto é o que impede ler a seção de outra). Chave: `materialId:pagina`.
   */
  async daPagina(paginas: ReadonlyArray<{ readonly materialId: string; readonly pagina: number }>): Promise<Map<string, SecaoDaQuestao>> {
    const porPagina = new Map<string, SecaoDaQuestao>()
    if (paginas.length === 0) return porPagina
    const escolaId = requireEscolaId()
    const secoes = await this.banco
      .select({
        id: secaoDoMaterial.id,
        materialId: secaoDoMaterial.materialId,
        paginaInicial: secaoDoMaterial.paginaInicial,
        paginaFinal: secaoDoMaterial.paginaFinal,
        capituloNumero: capituloDoMaterial.numero,
        capituloTitulo: capituloDoMaterial.titulo,
      })
      .from(secaoDoMaterial)
      .innerJoin(material, and(eq(material.escolaId, secaoDoMaterial.escolaId), eq(material.id, secaoDoMaterial.materialId)))
      .leftJoin(capituloDoMaterial, and(eq(capituloDoMaterial.escolaId, secaoDoMaterial.escolaId), eq(capituloDoMaterial.id, secaoDoMaterial.capituloId)))
      .where(
        and(
          eq(secaoDoMaterial.escolaId, escolaId),
          eq(material.estado, 'pronto'),
          isNull(material.excluidoEm),
          or(...paginas.map((pagina) => and(eq(secaoDoMaterial.materialId, pagina.materialId), lte(secaoDoMaterial.paginaInicial, pagina.pagina), gte(secaoDoMaterial.paginaFinal, pagina.pagina)))),
        ),
      )
    if (secoes.length === 0) return porPagina
    const habilidades = await this.habilidadesDasSecoes(secoes.map((secao) => secao.id))
    for (const { materialId, pagina } of paginas) {
      const secao = secoes.find((candidata) => candidata.materialId === materialId && candidata.paginaInicial <= pagina && pagina <= candidata.paginaFinal)
      if (secao === undefined) continue
      porPagina.set(`${materialId}:${String(pagina)}`, {
        capitulo: secao.capituloTitulo === null ? null : { numero: secao.capituloNumero, titulo: secao.capituloTitulo },
        paginaInicial: secao.paginaInicial,
        paginaFinal: secao.paginaFinal,
        habilidades: habilidades.filter((habilidade) => habilidade.secaoId === secao.id).map(({ codigo, origem }) => ({ codigo, origem })),
      })
    }
    return porPagina
  }

  /**
   * O `concluir` da classificação: relê os materiais **`for share`** (`pronto` e não excluído, P4b: a exclusão que chega no meio espera a gravação, ou a gravação nem acontece) e **trava as seções `for update`** (P1b), **só as que
   * ainda são desta execução e não foram corrigidas**: `execucao_id = :esta and corrigida_em is null` é a única conferência (P1a, P2, P9, P10b), feita com a trava já tomada, de modo que a correção, a limpeza ou o reclassificar que
   * chegam no meio esperam o commit e a execução que perdeu a seção não a grava. Depois, nas seções travadas: as habilidades `origem: 'ia'` no lugar das que a IA pôs antes, `classificada_em` e `falhas_seguidas` zerada. A seção que não foi
   * travada (corrigida no meio, execução trocada, material excluído) não ganha nada, e a execução conclui sem efeito nela. A correção que esperou a trava aplica **por cima** e lê como "antes" os códigos da IA que ela acabou de ver.
   */
  async saveClassificacao(execucaoId: string, respostas: ReadonlyArray<{ readonly secaoId: string; readonly codigos: readonly string[] }>): Promise<SecaoGravada[]> {
    const escolaId = requireEscolaId()
    if (respostas.length === 0) return []
    const secoes = await this.banco
      .select({ id: secaoDoMaterial.id, materialId: secaoDoMaterial.materialId })
      .from(secaoDoMaterial)
      .where(and(eq(secaoDoMaterial.escolaId, escolaId), inArray(secaoDoMaterial.id, respostas.map((resposta) => resposta.secaoId))))
    if (secoes.length === 0) return []
    const materiaisVivos = await this.banco
      .select({ id: material.id })
      .from(material)
      .where(and(eq(material.escolaId, escolaId), inArray(material.id, [...new Set(secoes.map((secao) => secao.materialId))]), eq(material.estado, 'pronto'), isNull(material.excluidoEm)))
      .for('share')
    const vivos = new Set(materiaisVivos.map((linha) => linha.id))
    const aGravar = respostas.filter((resposta) => {
      const secao = secoes.find((candidata) => candidata.id === resposta.secaoId)
      return secao !== undefined && vivos.has(secao.materialId)
    })
    const travadas = await this.banco
      .select({ id: secaoDoMaterial.id })
      .from(secaoDoMaterial)
      .where(and(eq(secaoDoMaterial.escolaId, escolaId), inArray(secaoDoMaterial.id, aGravar.map((resposta) => resposta.secaoId)), eq(secaoDoMaterial.execucaoId, execucaoId), isNull(secaoDoMaterial.corrigidaEm)))
      .orderBy(asc(secaoDoMaterial.id))
      .for('update')
    const minhas = new Set(travadas.map((linha) => linha.id))
    const gravadas: SecaoGravada[] = []
    for (const resposta of aGravar) {
      if (!minhas.has(resposta.secaoId)) continue
      await this.banco.delete(habilidadeDaSecao).where(and(eq(habilidadeDaSecao.escolaId, escolaId), eq(habilidadeDaSecao.secaoId, resposta.secaoId), eq(habilidadeDaSecao.origem, 'ia')))
      if (resposta.codigos.length > 0) {
        await this.banco.insert(habilidadeDaSecao).values(resposta.codigos.map((codigo) => ({ escolaId, secaoId: resposta.secaoId, codigo, origem: 'ia' as const })))
      }
      const atualizada = await this.banco.execute<{ id: string; segundos: string }>(sql`
        update secao_do_material s
           set classificada_em = now(), falhas_seguidas = 0
          from material m
         where s.escola_id = ${escolaId}
           and s.id = ${resposta.secaoId}
           and m.escola_id = s.escola_id
           and m.id = s.material_id
        returning s.id, extract(epoch from (now() - m.enviado_em))::text as segundos`)
      const linha = atualizada.rows[0]
      if (linha === undefined) continue
      gravadas.push({ secaoId: resposta.secaoId, segundosDesdeOEnvio: Math.max(0, Number(linha.segundos)) })
    }
    return gravadas
  }

  /**
   * A execução sem candidata (P11): as seções **não corrigidas** que a citam perdem o `execucao_id`, e as habilidades `origem: 'ia'` e `falhas_seguidas` voltam a zero. É o mesmo "limpar" da mudança de recorte
   * (`AgendamentoDaClassificacaoRepository.clearDoRecorte`, no `core`), e volta a seção a `nao_agendada`. A corrigida não se toca. Com `soAsSecoes`, só essas (as seções vivas sem recorte, numa execução que classifica as outras).
   *
   * O `update` é um só, com `execucao_id = :esta`, e só as seções que ele devolveu perdem o código da IA: a que o job da mudança de recorte levou a uma execução nova entre o `preparar` e aqui não casa, segue com a execução
   * nova e com o que ela gravar. Ler as seções antes, em outro comando, abriria a janela em que a limpeza apagaria a execução nova.
   */
  async clearDaExecucao(execucaoId: string, soAsSecoes?: readonly string[]): Promise<number> {
    const escolaId = requireEscolaId()
    const limpas = await this.banco
      .update(secaoDoMaterial)
      .set({ execucaoId: null, falhasSeguidas: 0, classificadaEm: null })
      .where(and(eq(secaoDoMaterial.escolaId, escolaId), eq(secaoDoMaterial.execucaoId, execucaoId), isNull(secaoDoMaterial.corrigidaEm), soAsSecoes === undefined ? undefined : inArray(secaoDoMaterial.id, [...soAsSecoes])))
      .returning({ id: secaoDoMaterial.id })
    if (limpas.length === 0) return 0
    await this.banco.delete(habilidadeDaSecao).where(and(eq(habilidadeDaSecao.escolaId, escolaId), inArray(habilidadeDaSecao.secaoId, limpas.map((secao) => secao.id)), eq(habilidadeDaSecao.origem, 'ia')))
    return limpas.length
  }

  /** A execução terminou `falhou` por `IA_SAIDA_INVALIDA`: soma 1 em `falhas_seguidas` das seções dela. Chamada na transação da passagem a `falhou`, e só por quem passou. */
  async somarFalha(execucaoId: string): Promise<void> {
    await this.banco
      .update(secaoDoMaterial)
      .set({ falhasSeguidas: sql`${secaoDoMaterial.falhasSeguidas} + 1` })
      .where(and(eq(secaoDoMaterial.escolaId, requireEscolaId()), eq(secaoDoMaterial.execucaoId, execucaoId)))
  }

  /**
   * As seções do material da escola do contexto, em ordem, com o capítulo, a execução que as classifica e se foram corrigidas (classificacao-bncc, 7.0; Tech Spec, seção 4). A situação sai de `situacaoDaSecao`. Quem chama já
   * conferiu que o material é alcançado (`MaterialRepository.porId`); a escola vem do contexto, e a leitura é a do material pedido, nunca a de outro.
   */
  async doMaterial(materialId: string, secaoId?: string): Promise<SecaoLida[]> {
    const linhas = await this.banco
      .select({
        id: secaoDoMaterial.id,
        ordem: secaoDoMaterial.ordem,
        paginaInicial: secaoDoMaterial.paginaInicial,
        paginaFinal: secaoDoMaterial.paginaFinal,
        capituloNumero: capituloDoMaterial.numero,
        capituloTitulo: capituloDoMaterial.titulo,
        estadoDaExecucao: execucaoAgente.estado,
        corrigidaEm: secaoDoMaterial.corrigidaEm,
      })
      .from(secaoDoMaterial)
      .leftJoin(capituloDoMaterial, and(eq(capituloDoMaterial.escolaId, secaoDoMaterial.escolaId), eq(capituloDoMaterial.id, secaoDoMaterial.capituloId)))
      .leftJoin(execucaoAgente, and(eq(execucaoAgente.escolaId, secaoDoMaterial.escolaId), eq(execucaoAgente.id, secaoDoMaterial.execucaoId)))
      .where(and(eq(secaoDoMaterial.escolaId, requireEscolaId()), eq(secaoDoMaterial.materialId, materialId), secaoId === undefined ? undefined : eq(secaoDoMaterial.id, secaoId)))
      .orderBy(asc(secaoDoMaterial.ordem))
    return linhas.map(({ corrigidaEm, ...resto }) => ({ ...resto, corrigida: corrigidaEm !== null }))
  }

  /** As habilidades das seções dadas, com o texto da BNCC, na ordem do código. A tabela da BNCC é pública: a escola é a da `habilidade_da_secao`, e só ela entra na junção. */
  async habilidadesDasSecoes(secaoIds: readonly string[]): Promise<HabilidadeLida[]> {
    return this.banco
      .select({ secaoId: habilidadeDaSecao.secaoId, codigo: habilidadeDaSecao.codigo, descricao: habilidadeBncc.descricao, origem: habilidadeDaSecao.origem })
      .from(habilidadeDaSecao)
      .innerJoin(habilidadeBncc, eq(habilidadeBncc.codigo, habilidadeDaSecao.codigo))
      .where(and(eq(habilidadeDaSecao.escolaId, requireEscolaId()), inArray(habilidadeDaSecao.secaoId, [...secaoIds])))
      .orderBy(asc(habilidadeDaSecao.codigo))
  }

  /**
   * A seção que a coordenação vai corrigir, **`for update`** até o fim da transação (P1b, P5): a do material dado, da escola do contexto. A de outro material, a de outra escola e a inexistente não são achadas. O `concluir` da
   * classificação trava a mesma linha, então a correção espera a gravação da IA e aplica por cima, e duas correções passam uma depois da outra.
   */
  async lockParaCorrigir(materialId: string, secaoId: string): Promise<{ id: string } | undefined> {
    const [linha] = await this.banco
      .select({ id: secaoDoMaterial.id })
      .from(secaoDoMaterial)
      .where(and(eq(secaoDoMaterial.escolaId, requireEscolaId()), eq(secaoDoMaterial.materialId, materialId), eq(secaoDoMaterial.id, secaoId)))
      .for('update')
    return linha
  }

  /** Os códigos que a seção tem agora, de qualquer origem, na ordem do código: o "antes" e o "depois" da auditoria da correção. */
  async codigosDaSecao(secaoId: string): Promise<string[]> {
    const linhas = await this.banco
      .select({ codigo: habilidadeDaSecao.codigo })
      .from(habilidadeDaSecao)
      .where(and(eq(habilidadeDaSecao.escolaId, requireEscolaId()), eq(habilidadeDaSecao.secaoId, secaoId)))
      .orderBy(asc(habilidadeDaSecao.codigo))
    return linhas.map((linha) => linha.codigo)
  }

  /**
   * A correção da coordenação (RF6): as habilidades da seção, **todas**, são trocadas pelas dadas, com `origem: 'coordenacao'`, e a seção ganha `corrigida_em` (a marca; a eliminação do titular não a toca) e `corrigida_por`
   * (só autoria). Zero códigos é correção válida. Quem chama já travou a seção (`lockParaCorrigir`).
   */
  async saveCorrecao(secaoId: string, codigos: readonly string[]): Promise<void> {
    const escolaId = requireEscolaId()
    await this.banco.delete(habilidadeDaSecao).where(and(eq(habilidadeDaSecao.escolaId, escolaId), eq(habilidadeDaSecao.secaoId, secaoId)))
    if (codigos.length > 0) await this.banco.insert(habilidadeDaSecao).values(codigos.map((codigo) => ({ escolaId, secaoId, codigo, origem: 'coordenacao' as const })))
    await this.banco
      .update(secaoDoMaterial)
      .set({ corrigidaEm: sql`now()`, corrigidaPor: requestSessao().usuarioId })
      .where(and(eq(secaoDoMaterial.escolaId, escolaId), eq(secaoDoMaterial.id, secaoId)))
  }

  /** Quantas seções do material a coordenação corrigiu: as que o reclassificar preserva. */
  async countCorrigidas(materialId: string): Promise<number> {
    return this.banco.$count(secaoDoMaterial, and(eq(secaoDoMaterial.escolaId, requireEscolaId()), eq(secaoDoMaterial.materialId, materialId), isNotNull(secaoDoMaterial.corrigidaEm)))
  }

  /** O recorte de um material: o componente da disciplina e as séries declaradas. Sem série, a lista vem vazia; sem componente, `null`. */
  async recorteDoMaterial(materialId: string, disciplinaId: string): Promise<RecorteDasHabilidades> {
    const { componentes, series } = await this.recorteDosMateriais([disciplinaId], [materialId])
    return { componente: componentes.get(disciplinaId) ?? null, series: series.get(materialId) ?? [] }
  }

  /**
   * O recorte de um artefato **do professor da sessão** (classificacao-bncc, 7.0; Tech Spec, seção 4): o componente da disciplina e a série da turma. Só o dono (`criado_por`), com vínculo confirmado nesta disciplina e
   * turma no ano em curso: o artefato de um colega, de outra escola, de outro ano e o inexistente não são achados.
   */
  async recorteDoArtefato(artefatoId: string): Promise<RecorteDasHabilidades | undefined> {
    const escolaId = requireEscolaId()
    const [linha] = await this.banco
      .select({ componente: disciplina.componenteBncc, etapa: serie.etapa, ano: serie.ano })
      .from(artefato)
      .innerJoin(turma, and(eq(turma.escolaId, artefato.escolaId), eq(turma.anoLetivoId, artefato.anoLetivoId), eq(turma.id, artefato.turmaId)))
      .innerJoin(serie, and(eq(serie.escolaId, turma.escolaId), eq(serie.id, turma.serieId)))
      .innerJoin(disciplina, and(eq(disciplina.escolaId, artefato.escolaId), eq(disciplina.id, artefato.disciplinaId)))
      .where(
        and(
          eq(artefato.escolaId, escolaId),
          eq(artefato.anoLetivoId, requireAnoEmCurso()),
          eq(artefato.id, artefatoId),
          eq(artefato.criadoPor, requestSessao().usuarioId),
          comVinculoConfirmadoDoProfessor(this.banco, { escolaId: artefato.escolaId, anoLetivoId: artefato.anoLetivoId, turmaId: artefato.turmaId }, artefato.disciplinaId),
        ),
      )
    return linha === undefined ? undefined : { componente: linha.componente, series: [{ etapa: linha.etapa, ano: linha.ano }] }
  }
}
