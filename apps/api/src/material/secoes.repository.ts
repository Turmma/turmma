import {
  capituloDoMaterial,
  CARACTERES_LIDOS_POR_PAGINA,
  disciplina,
  habilidadeBncc,
  habilidadeDaSecao,
  material,
  materialSerie,
  PAGINAS_LIDAS_POR_SECAO,
  requireEscolaId,
  secaoDoMaterial,
  serie,
  trecho,
  Unscoped,
  type Database,
  type DatabaseTransaction,
} from '@educa/core'
import { habilidadeEhCandidata, type ComponenteBncc, type SerieDoRecorte } from '@educa/shared'
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'

/** A seção viva que a execução classifica: o que o `preparar` monta a entrada. O texto vem à parte (`paginasDaSecao`). */
export interface SecaoParaClassificar {
  readonly secaoId: string
  readonly materialId: string
  readonly titulo: string | null
  readonly paginaInicial: number
  readonly paginaFinal: number
  readonly disciplinaId: string
}

export interface HabilidadeCandidata {
  readonly codigo: string
  readonly descricao: string
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
   * As habilidades candidatas de um recorte: as da tabela pública da BNCC (sem escola, regra 10, item 1) que `habilidadeEhCandidata` aceita para o componente e as séries, na ordem do código. Um conjunto por par
   * componente e séries; quem junta vários recortes (a execução com mais de um material) une os conjuntos.
   */
  @Unscoped('a tabela da BNCC é pública e não tem escola_id (regra 10, item 1): devolve só código e descrição de habilidade, nunca dado de escola nem de pessoa')
  async candidatas(componente: ComponenteBncc, series: readonly SerieDoRecorte[]): Promise<HabilidadeCandidata[]> {
    const etapas = [...new Set(series.map((serie) => serie.etapa))]
    if (etapas.length === 0) return []
    const linhas = await this.banco
      .select({ codigo: habilidadeBncc.codigo, descricao: habilidadeBncc.descricao })
      .from(habilidadeBncc)
      .where(inArray(habilidadeBncc.etapa, etapas))
      .orderBy(asc(habilidadeBncc.codigo))
    return linhas.filter((linha) => habilidadeEhCandidata(linha.codigo, componente, series))
  }

  /**
   * O `concluir` da classificação: relê os materiais **`for share`** (`pronto` e não excluído, P4b: a exclusão que chega no meio espera a gravação, ou a gravação nem acontece) e grava cada seção
   * `where execucao_id = :esta and corrigida_em is null` (P1a e o `execucao_id` trocado por SQL, P9): `classificada_em`, `falhas_seguidas` zerada, as habilidades `origem: 'ia'` no lugar das que a IA pôs antes.
   * A seção que o `update` não devolveu (corrigida no meio, execução trocada, material excluído) não ganha nada e a execução conclui sem efeito nela. O `for update` da seção fica para a 7.0.
   */
  async gravarClassificacao(execucaoId: string, respostas: ReadonlyArray<{ readonly secaoId: string; readonly codigos: readonly string[] }>): Promise<SecaoGravada[]> {
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
    const gravadas: SecaoGravada[] = []
    for (const resposta of respostas) {
      const secao = secoes.find((candidata) => candidata.id === resposta.secaoId)
      if (secao === undefined || !vivos.has(secao.materialId)) continue
      const atualizada = await this.banco.execute<{ id: string; segundos: string }>(sql`
        update secao_do_material s
           set classificada_em = now(), falhas_seguidas = 0
          from material m
         where s.escola_id = ${escolaId}
           and s.id = ${secao.id}
           and s.execucao_id = ${execucaoId}
           and s.corrigida_em is null
           and m.escola_id = s.escola_id
           and m.id = s.material_id
        returning s.id, extract(epoch from (now() - m.enviado_em))::text as segundos`)
      const linha = atualizada.rows[0]
      if (linha === undefined) continue
      await this.banco.delete(habilidadeDaSecao).where(and(eq(habilidadeDaSecao.escolaId, escolaId), eq(habilidadeDaSecao.secaoId, secao.id), eq(habilidadeDaSecao.origem, 'ia')))
      if (resposta.codigos.length > 0) {
        await this.banco.insert(habilidadeDaSecao).values(resposta.codigos.map((codigo) => ({ escolaId, secaoId: secao.id, codigo, origem: 'ia' as const })))
      }
      gravadas.push({ secaoId: secao.id, segundosDesdeOEnvio: Math.max(0, Number(linha.segundos)) })
    }
    return gravadas
  }

  /**
   * A execução sem candidata (P11): as seções **não corrigidas** que a citam perdem o `execucao_id`, e as habilidades `origem: 'ia'` e `falhas_seguidas` voltam a zero. É o mesmo "limpar" da mudança de recorte
   * (`AgendamentoDaClassificacaoRepository.limparDoRecorte`, no `core`), e volta a seção a `nao_agendada`. A corrigida não se toca. Com `soAsSecoes`, só essas (as seções vivas sem recorte, numa execução que classifica as outras).
   *
   * O `update` é um só, com `execucao_id = :esta`, e só as seções que ele devolveu perdem o código da IA: a que o job da mudança de recorte levou a uma execução nova entre o `preparar` e aqui não casa, segue com a execução
   * nova e com o que ela gravar. Ler as seções antes, em outro comando, abriria a janela em que a limpeza apagaria a execução nova.
   */
  async limparDaExecucao(execucaoId: string, soAsSecoes?: readonly string[]): Promise<number> {
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
}
