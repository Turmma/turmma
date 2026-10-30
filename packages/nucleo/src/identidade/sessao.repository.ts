import type { PapelDeUsuario } from '@educa/shared'
import { and, eq, isNotNull, lte, sql } from 'drizzle-orm'
import type { Database } from '../db/banco.js'
import { anoLetivo } from '../db/schema/ano-letivo.js'
import { escola } from '../db/schema/escola.js'
import { sessao } from '../db/schema/sessao.js'
import { usuario } from '../db/schema/usuario.js'
import type { VerifiedToken } from './verificar-token.js'

/** A linha que a guarda confere: só ids, papel e datas, nada da pessoa. */
export interface SessaoRow {
  readonly usuarioId: string
  readonly papel: PapelDeUsuario
  readonly desativadoEm: Date | null
  /** A eliminação agendada (F3, 14.0): enquanto não é nula, a sessão não vale, mesmo que ainda esteja aberta. */
  readonly eliminacaoAgendadaEm: Date | null
  readonly encerradaEm: Date | null
  readonly expiraEm: Date
  readonly ultimoUsoEm: Date
  readonly inatividadeAlunoMin: number
  readonly inatividadeEquipeMin: number
  readonly anoLetivoId: string | null
  /** Quando a última renovação trocou o cookie; `null` numa sessão nunca renovada. */
  readonly rotacionadoEm: Date | null
  /** Se o token da última renovação já chegou numa requisição (Tech Spec, seção 5, "Renovar"). */
  readonly atualApresentado: boolean
  /** A hora do banco na leitura: a inatividade e o prazo comparam com o mesmo relógio que gravou as datas. */
  readonly agora: Date
}

/**
 * A leitura de sessão da `SessaoGuard`, uma consulta por requisição autenticada e sem cache (Tech Spec, seção 5,
 * "Requisição"): `sessao ⋈ usuario ⋈ escola`, com o ano letivo `em_curso` em left join.
 *
 * O escopo é a escola e a sessão do token verificado, e só dele: o método recebe um `VerifiedToken`, que só o
 * `verifyToken` produz, e não um id solto. É a leitura que cria o contexto da requisição, e por isso não o lê
 * (regra 10, item 3). O `usuario` e o ano são juntados pela mesma escola da sessão, e nunca atravessam escola.
 */
export class SessaoRepository {
  constructor(private readonly banco: Database) {}

  async lerParaGuarda(token: VerifiedToken): Promise<SessaoRow | undefined> {
    const [linha] = await this.banco
      .select({
        usuarioId: sessao.usuarioId,
        papel: usuario.papel,
        desativadoEm: usuario.desativadoEm,
        eliminacaoAgendadaEm: usuario.eliminacaoAgendadaEm,
        encerradaEm: sessao.encerradaEm,
        expiraEm: sessao.expiraEm,
        ultimoUsoEm: sessao.ultimoUsoEm,
        inatividadeAlunoMin: escola.inatividadeAlunoMin,
        inatividadeEquipeMin: escola.inatividadeEquipeMin,
        anoLetivoId: anoLetivo.id,
        rotacionadoEm: sessao.rotacionadoEm,
        atualApresentado: sessao.atualApresentado,
        agora: sql<Date>`now()`.mapWith(sessao.expiraEm),
      })
      .from(sessao)
      .innerJoin(usuario, and(eq(usuario.escolaId, sessao.escolaId), eq(usuario.id, sessao.usuarioId)))
      .innerJoin(escola, eq(escola.id, sessao.escolaId))
      .leftJoin(anoLetivo, and(eq(anoLetivo.escolaId, sessao.escolaId), eq(anoLetivo.situacao, 'em_curso')))
      .where(and(eq(sessao.escolaId, token.escolaId), eq(sessao.id, token.sessaoId)))
      .limit(1)
    return linha
  }

  /**
   * Marca que o token da última renovação chegou: é o que separa a resposta de renovação perdida (o cookie anterior
   * volta sem o token novo ter sido usado) do cookie roubado (volta depois de o token novo ter sido usado).
   *
   * Condicional: só muda a sessão do token, na escola e do usuário do token, que ainda não foi marcada e cuja última rotação é
   * anterior ao `iat` dele. Um token de antes da rotação não marca nada, e duas requisições juntas gravam uma vez.
   * Devolve se marcou.
   */
  async marcarAtualApresentado(token: VerifiedToken): Promise<boolean> {
    if (token.emitidoEm === undefined) return false
    const marcadas = await this.banco
      .update(sessao)
      .set({ atualApresentado: true })
      .where(
        and(
          eq(sessao.escolaId, token.escolaId),
          eq(sessao.id, token.sessaoId),
          // A guarda já conferiu o usuário; a condição repete, para a marcação nunca depender só dela.
          eq(sessao.usuarioId, token.usuarioId),
          eq(sessao.atualApresentado, false),
          isNotNull(sessao.rotacionadoEm),
          lte(sessao.rotacionadoEm, sql`to_timestamp(${token.emitidoEm})`),
        ),
      )
      .returning({ id: sessao.id })
    return marcadas.length > 0
  }
}
