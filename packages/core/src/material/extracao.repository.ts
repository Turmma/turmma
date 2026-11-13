import { InvariantException, type FalhaDeMaterial } from '@educa/shared'
import { and, asc, eq, gt, isNotNull, isNull, sql } from 'drizzle-orm'
import { requireEscolaId } from '../context/context-escola.js'
import type { Database, DatabaseTransaction } from '../db/database.js'
import { capituloDoMaterial, material } from '../db/schema/material.js'
import { trecho } from '../db/schema/trecho.js'
import type { CapituloLido } from './chapter-reader.js'
import type { PaginaExtraida } from './pdf-extractor.js'

/** O material que a extração vai ler: o suficiente para gravar os trechos, e nada do que ele é. */
export interface MaterialParaExtrair {
  readonly id: string
  readonly disciplinaId: string
  /** O material que esta edição substitui quando ficar pronta (8.0); nulo no que não é edição. Não muda depois do envio. */
  readonly substituiId: string | null
}

/** Quantos trechos vão num `insert` só: um capítulo cabe em um, e um livro de mil páginas não vira um comando de 20 MB. */
const TRECHOS_POR_INSERCAO = 50

/**
 * O que a extração do PDF lê e grava no material, na escola do contexto e só nela (regra 10, item 3): no worker, a escola é a de
 * `job_registro.escola_id`, que o executor já pôs no contexto. Nenhum método recebe escola.
 *
 * A transição é a mesma em todo caminho: `where escola_id = :ctx and id = :id and estado = 'processando' and excluido_em is null`. É ela
 * que faz o job repetido, o job que chega depois da exclusão e o segundo job do mesmo material saírem sem efeito (D49): a linha que não
 * pega é "já foi tratado", e nunca falha.
 */
export class ExtracaoDoMaterialRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /** O material `processando` e não excluído com esse id, na escola do contexto. O de outra escola não é achado. */
  async lerParaExtrair(id: string): Promise<MaterialParaExtrair | undefined> {
    const [linha] = await this.banco
      .select({ id: material.id, disciplinaId: material.disciplinaId, substituiId: material.substituiId })
      .from(material)
      .where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), eq(material.estado, 'processando'), isNull(material.excluidoEm)))
    return linha
  }

  /**
   * `processando` → `pronto`, com o total de páginas e o instante em que saiu de `processando`, numa instrução só, e devolve a disciplina.
   * `undefined` é "sem linha": excluído, ou já tratado por outro job. Quem recebe `undefined` não grava trecho nenhum.
   */
  async marcarPronto(id: string, paginas: number): Promise<string | undefined> {
    const [pronto] = await this.banco
      .update(material)
      .set({ estado: 'pronto', paginas, processadoEm: sql`now()` })
      .where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), eq(material.estado, 'processando'), isNull(material.excluidoEm)))
      .returning({ disciplinaId: material.disciplinaId })
    return pronto?.disciplinaId
  }

  /**
   * `processando` → `falhou`, com o código da lista fechada e o instante em que saiu de `processando`. Devolve se a linha mudou. Não mexe no que
   * já saiu de `processando` nem no excluído: o objeto que o job não achou, de um material que já está `pronto` ou excluído, não o faz falhar.
   */
  async marcarFalhou(id: string, falha: FalhaDeMaterial): Promise<boolean> {
    const falhos = await this.banco
      .update(material)
      .set({ estado: 'falhou', falha, processadoEm: sql`now()` })
      .where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), eq(material.estado, 'processando'), isNull(material.excluidoEm)))
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
   * Grava os capítulos que o leitor achou, na ordem. **Só depois de `marcarPronto` ter achado a linha**, na mesma transação: quem não passou pela transição
   * não chama, e o insert não esconde o segundo job com `on conflict` (a violação do `(escola_id, material_id, ordem)` o denunciaria). Sem capítulo, não grava nada.
   */
  async gravarCapitulos(materialId: string, capitulos: readonly CapituloLido[]): Promise<void> {
    if (capitulos.length === 0) return
    const escolaId = requireEscolaId()
    await this.banco.insert(capituloDoMaterial).values(capitulos.map(({ ordem, numero, titulo, paginaInicial, paginaFinal }) => ({ escolaId, materialId, ordem, numero, titulo, paginaInicial, paginaFinal })))
  }

  /**
   * A edição nova ficou pronta e a anterior sai da busca (8.0): marca a **antiga** da escola do contexto como excluída, com a edição que a substituiu, e apaga os trechos dela, na transação da extração. Só
   * muda a que ainda não foi excluída: se a coordenação a excluiu enquanto a nova era lida, nada muda (`false`), o `excluido_em` dela é o da exclusão, e quem chama não grava `material.substituido`.
   * Sem `excluido_por`: quem substituiu foi a extração, e quem mandou a edição está em `material.edicao_enviada`.
   */
  async substituirAnterior(novaId: string, antigaId: string): Promise<boolean> {
    const escolaId = requireEscolaId()
    const substituidas = await this.banco
      .update(material)
      .set({ excluidoEm: sql`now()`, substituidoPor: novaId })
      .where(and(eq(material.escolaId, escolaId), eq(material.id, antigaId), isNull(material.excluidoEm)))
      .returning({ id: material.id })
    if (substituidas.length === 0) return false
    await this.banco.delete(trecho).where(and(eq(trecho.escolaId, escolaId), eq(trecho.materialId, antigaId)))
    return true
  }

  /** Marca que o objeto do material foi apagado do storage (ou que nunca esteve lá). Gravar de novo não muda o primeiro instante. */
  async marcarObjetoApagado(id: string): Promise<void> {
    await this.banco
      .update(material)
      .set({ objetoApagadoEm: sql`now()` })
      .where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), isNull(material.objetoApagadoEm)))
  }

  /**
   * Os ids do material **excluído** da escola do contexto cujo objeto ainda pode estar no storage, em ordem, a partir de `depoisDe` (exclusive):
   * o expurgo noturno apaga o objeto antes da linha. O `processando` que não foi excluído nunca entra: o objeto dele é o da extração em curso.
   */
  async excluidosComObjeto(depoisDe: string | undefined, limite: number): Promise<string[]> {
    if (limite < 1) throw new InvariantException('lote do expurgo do objeto sem tamanho')
    const linhas = await this.banco
      .select({ id: material.id })
      .from(material)
      .where(and(eq(material.escolaId, requireEscolaId()), isNotNull(material.excluidoEm), isNull(material.objetoApagadoEm), depoisDe === undefined ? undefined : gt(material.id, depoisDe)))
      .orderBy(asc(material.id))
      .limit(limite)
    return linhas.map(({ id }) => id)
  }
}
