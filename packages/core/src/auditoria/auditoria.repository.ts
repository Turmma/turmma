import { PAPEIS_QUE_GERAM_A_SENHA_PROVISORIA, MAXIMO_DE_PROVISORIAS_ANTERIORES_NA_TROCA, type PapelQueGeraASenhaProvisoria } from '@educa/shared'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres'
import type { PgDatabase } from 'drizzle-orm/pg-core'
import { currentContext } from '../context/context.js'
import { requireEscolaId } from '../context/context-escola.js'
import type { Schema } from '../db/database.js'
import { auditoria } from '../db/schema/auditoria.js'
import { AuditoriaRejectedError } from './auditoria-rejected.error.js'

/** O banco ou a transação de quem chama: a gravação vai junto com a ação auditada, e desfaz junto. */
export type DatabaseExecutor = PgDatabase<NodePgQueryResultHKT, Schema>

export interface RegistroAuditado {
  id: string
  escolaId: string | null
  autorUsuarioId: string | null
  autorOperador: string | null
  acao: string
  entidade: string
  entidadeId: string
  antes: Record<string, unknown> | null
  depois: Record<string, unknown> | null
  finalidade: string | null
  requisicaoId: string
  em: Date
}

/** Uma provisória que o aluno ainda não conhecia quando usou a de agora: quando foi gerada, por qual papel, e se alguém a usou. Nunca o nome nem o id de quem gerou. */
export interface ProvisoriaAnterior {
  readonly geradaEm: Date
  readonly papel: PapelQueGeraASenhaProvisoria
  readonly usada: boolean
}

/** Quantos registros de `gerada` e `usada` do aluno a leitura olha: cada geração tem no máximo um uso, e as cotas (5 por dia) deixam isto bem acima das 11 gerações que ela precisa. */
const REGISTROS_LIDOS_POR_ALUNO = 60

/** Quantos envios de material foram recusados numa disciplina e numa série (ou sem série: `serieId` nulo), contados da auditoria. Só ids e uma contagem. */
export interface RecusaDeMaterialContada {
  readonly disciplinaId: string
  readonly serieId: string | null
  readonly total: number
}

export const LIMITE_PADRAO_DA_LISTAGEM = 100
export const LIMITE_MAXIMO_DA_LISTAGEM = 500

/**
 * Leitura de `auditoria` no escopo da escola do contexto (regra 10, item 3). Só lê: a escrita tem uma
 * porta só, o `AuditoriaRecorder`. Não tem rota: a listagem serve ao teste e ao F3, que acrescenta
 * período, cursor e finalidade da consulta.
 */
export class AuditoriaRepository {
  constructor(private readonly banco: DatabaseExecutor) {}

  /** Os registros mais recentes da escola do contexto, do mais novo ao mais antigo. Sem escola, recusa. */
  async listarDaEscola(limite: number = LIMITE_PADRAO_DA_LISTAGEM): Promise<RegistroAuditado[]> {
    const escolaId = currentContext()?.escolaId
    if (escolaId === undefined) throw new AuditoriaRejectedError('sem_escola')
    return this.banco
      .select()
      .from(auditoria)
      .where(eq(auditoria.escolaId, escolaId))
      .orderBy(desc(auditoria.em), desc(auditoria.id))
      .limit(Math.min(Math.max(1, Math.trunc(limite)), LIMITE_MAXIMO_DA_LISTAGEM))
  }

  /**
   * As provisórias que a coordenação ou o professor geraram para o aluno **antes da última**, da mais nova à mais antiga, até `MAXIMO_DE_PROVISORIAS_ANTERIORES_NA_TROCA`
   * (acesso-e-convites, tarefa 10.0, RF13): a tela de troca mostra ao aluno quem gerou uma senha para ele e se ela foi usada. A última gerada é a que ele acabou de usar, e fica de
   * fora. Uma geração conta como usada quando há um `senha_provisoria.usada` do aluno depois dela e antes da geração seguinte. O papel vem do `depois` do registro, e não do usuário
   * que gerou: o autor eliminado continua com o papel. Na escola do contexto (regra 10, item 3); sem escola, `requireEscolaId` recusa.
   */
  async provisoriasAnterioresDoAluno(alunoId: string): Promise<ProvisoriaAnterior[]> {
    const escolaId = requireEscolaId()
    const registros = await this.banco
      .select({ acao: auditoria.acao, em: auditoria.em, depois: auditoria.depois })
      .from(auditoria)
      .where(and(eq(auditoria.escolaId, escolaId), eq(auditoria.entidadeId, alunoId), inArray(auditoria.acao, ['senha_provisoria.gerada', 'senha_provisoria.usada'])))
      .orderBy(desc(auditoria.em), desc(auditoria.id))
      .limit(REGISTROS_LIDOS_POR_ALUNO)
    const geracoes = registros.filter((registro) => registro.acao === 'senha_provisoria.gerada')
    const usos = registros.filter((registro) => registro.acao === 'senha_provisoria.usada')
    // Da mais nova à mais antiga: a primeira é a de agora; o uso de cada uma é o que cai entre ela e a seguinte (a mais nova que veio depois).
    return geracoes.slice(1, 1 + MAXIMO_DE_PROVISORIAS_ANTERIORES_NA_TROCA).map((geracao, indice) => {
      const seguinte = geracoes[indice]
      const usada = usos.some((uso) => uso.em >= geracao.em && (seguinte === undefined || uso.em < seguinte.em))
      return { geradaEm: geracao.em, papel: papelDaGeracao(geracao.depois), usada }
    })
  }

  /**
   * Quantas vezes a `acao` foi gravada desde `desde`, na escola do contexto e pela pessoa da sessão (ingestao-do-material, 12.0): a base do teto do `PATCH` do material, por pessoa e por escola. Só uma
   * contagem. A escola e a pessoa vêm do contexto, nunca de argumento (regra 10, item 3); sem escola, `requireEscolaId` recusa, e sem pessoa a contagem dela é zero. O texto de `acao` vai como parâmetro: o
   * índice `auditoria_escola_em_idx` serve à consulta pela escola e pelo instante.
   */
  async contarDaEscolaEDaPessoaDesde(acao: string, desde: Date): Promise<{ daEscola: number; doUsuario: number }> {
    const escolaId = requireEscolaId()
    const usuarioId = currentContext()?.usuarioId
    const resultado = await this.banco.execute<{ da_escola: number; do_usuario: number }>(sql`
      select count(*)::int as da_escola, (count(*) filter (where autor_usuario_id = ${usuarioId ?? null}))::int as do_usuario
      from auditoria
      where escola_id = ${escolaId} and acao = ${acao} and em >= ${desde.toISOString()}::timestamptz`)
    const linha = resultado.rows[0]
    return { daEscola: linha?.da_escola ?? 0, doUsuario: linha?.do_usuario ?? 0 }
  }

  /**
   * Os envios de material recusados da escola do contexto desde `desde`, por disciplina e por série (ingestao-do-material, 11.0; RF18): a base do resumo do material. Conta só os registros
   * `material.recusado` com um dos `motivos` (sem motivo nenhum, a resposta é vazia, sem consulta), e a recusa de várias séries cai em cada uma delas, como o material de várias séries. A recusa sem série (a edição de um material que a migração
   * deixou sem nenhuma) volta com `serieId` nulo. O `entidade_id` do registro é a disciplina, e a consulta o prende (`entidade = 'disciplina'`: a ação `material.recusado` não grava outra). O texto de `acao` vai escrito na consulta, e não como parâmetro,
   * para o índice parcial `auditoria_material_recusado_idx` servir. Sem escola, `requireEscolaId` recusa.
   */
  async recusasDeMaterialDesde(desde: Date, motivos: readonly string[]): Promise<RecusaDeMaterialContada[]> {
    const escolaId = requireEscolaId()
    if (motivos.length === 0) return []
    const resultado = await this.banco.execute<{ disciplina_id: string; serie_id: string | null; total: number }>(sql`
      select a.entidade_id as disciplina_id, s.serie_id, count(*)::int as total
      from auditoria a
      left join lateral jsonb_array_elements_text(a.depois -> 'serieIds') as s(serie_id) on true
      where a.escola_id = ${escolaId}
        and a.acao = 'material.recusado'
        and a.entidade = 'disciplina'
        and a.em >= ${desde.toISOString()}::timestamptz
        and a.depois ->> 'motivo' in (${sql.join(
          motivos.map((motivo) => sql`${motivo}`),
          sql`, `,
        )})
      group by a.entidade_id, s.serie_id`)
    return resultado.rows.map((linha) => ({ disciplinaId: linha.disciplina_id, serieId: linha.serie_id, total: linha.total }))
  }
}

/** O papel que a geração guardou no `depois`; registro fora do formato (impossível pela porta única) nunca vira o papel de outro. */
function papelDaGeracao(depois: Record<string, unknown> | null): PapelQueGeraASenhaProvisoria {
  const papel = depois?.['papel']
  const conhecido = PAPEIS_QUE_GERAM_A_SENHA_PROVISORIA.find((candidato) => candidato === papel)
  if (conhecido === undefined) throw new AuditoriaRejectedError('dados_fora_do_schema')
  return conhecido
}
