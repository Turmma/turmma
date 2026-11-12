import { and, asc, isNull, lt, or } from 'drizzle-orm'
import type { Database } from '../db/database.js'
import { envioDeMaterial, material } from '../db/schema/material.js'
import { Unscoped } from '../db/unscoped.decorator.js'

/** O que a varredura precisa para abrir o contexto da escola: a escola e o id do material, e nada mais (sem título, arquivo, licenciante nem pessoa). */
export interface AlvoDaVarredura {
  readonly escolaId: string
  readonly materialId: string
}

const JUSTIFICATIVA_DOS_ENVIOS =
  'rotina nossa, sem requisição, no worker de lote: o envio que não chegou a virar material não tem dono, e a varredura horária precisa achar os de todas as escolas para abrir o contexto de ' +
  'cada uma; devolve só a escola e o id, sem título, arquivo, licenciante nem pessoa, e não atende requisição de escola nenhuma'

const JUSTIFICATIVA_DOS_OBJETOS =
  'rotina nossa, sem requisição, no worker de lote: o PDF que sobrou no storage depois do commit (o apagar falhou ou o processo caiu) precisa ser achado em todas as escolas para abrir o contexto ' +
  'de cada uma; devolve só a escola e o id, sem título, arquivo, licenciante nem pessoa, e não atende requisição de escola nenhuma'

/**
 * As duas leituras entre escolas da varredura horária do PDF que sobrou no storage (ingestao-do-material, tarefa 2.0; Tech Spec, seções 5 e 6; onda 3b,
 * 3. Falha). Cada uma é `@Unscoped`, só devolve `(escola, id)`, e **nada se apaga aqui**: quem apaga abre o contexto da escola do alvo e usa os
 * repositories com escopo (`EnvioDeMaterialRepository`, `ExtracaoDoMaterialRepository`). Se aparecer uma terceira leitura sem escopo neste módulo, o desenho
 * está errado (regra 10, item 9).
 */
export class VarreduraDoMaterialRepository {
  constructor(private readonly banco: Database) {}

  /** Os envios cuja linha tem mais de `criadaAntesDe`: o objeto pode estar no storage sem material nenhum. Em ordem de criação, até `limite`. */
  @Unscoped(JUSTIFICATIVA_DOS_ENVIOS)
  async enviosParados(criadaAntesDe: Date, limite: number): Promise<AlvoDaVarredura[]> {
    return this.banco
      .select({ escolaId: envioDeMaterial.escolaId, materialId: envioDeMaterial.materialId })
      .from(envioDeMaterial)
      .where(lt(envioDeMaterial.criadoEm, criadaAntesDe))
      .orderBy(asc(envioDeMaterial.criadoEm), asc(envioDeMaterial.materialId))
      .limit(limite)
  }

  /**
   * O material cujo objeto ainda pode estar no storage 25 h depois de o objeto dever ter saído: já saiu de `processando` (`processado_em`) ou foi
   * excluído (`excluido_em`) antes de `antesDe` (a data nula nunca é menor que nada), e `objeto_apagado_em` é nulo. O `processando` não excluído nunca entra (o objeto é o da extração
   * em curso), e o material de antes da F4 (`objeto_apagado_em = enviado_em`) também não. Em ordem de id, até `limite`.
   */
  @Unscoped(JUSTIFICATIVA_DOS_OBJETOS)
  async objetosQueSobraram(antesDe: Date, limite: number): Promise<AlvoDaVarredura[]> {
    return this.banco
      .select({ escolaId: material.escolaId, materialId: material.id })
      .from(material)
      .where(and(isNull(material.objetoApagadoEm), or(lt(material.processadoEm, antesDe), lt(material.excluidoEm, antesDe))))
      .orderBy(asc(material.id))
      .limit(limite)
  }
}
