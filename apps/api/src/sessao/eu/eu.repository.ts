import { escola, requestIdentity, usuario, type Database } from '@educa/nucleo'
import type { PapelDeUsuario } from '@educa/shared'
import { and, eq, sql } from 'drizzle-orm'

export interface LinhaDoEu {
  readonly usuarioId: string
  /** A conta da equipe, só para listar os acessos dela; nula no aluno. Não sai na resposta. */
  readonly contaId: string | null
  readonly papel: PapelDeUsuario
  readonly nome: string
  readonly escola: { readonly id: string; readonly nome: string; readonly slug: string }
  readonly inatividadeAlunoMin: number
  readonly inatividadeEquipeMin: number
  /** Quando esta linha viu a introdução; só dela. A data de outra escola da conta vem de `introducaoMaisAntigaDaConta`. */
  readonly introducaoVistaEm: Date | null
}

/**
 * Quem está na sessão: o usuário e a escola do contexto que a `SessaoGuard` gravou, e só eles. Não recebe id:
 * não há como pedir outro usuário nem outra escola (regra 10, item 3).
 */
export class EuRepository {
  constructor(private readonly banco: Database) {}

  async doContexto(): Promise<LinhaDoEu | undefined> {
    const { escolaId, usuarioId } = requestIdentity()
    const [linha] = await this.banco
      .select({
        usuarioId: usuario.id,
        contaId: usuario.contaId,
        papel: usuario.papel,
        nome: usuario.nome,
        escola: { id: escola.id, nome: escola.nome, slug: escola.slug },
        inatividadeAlunoMin: escola.inatividadeAlunoMin,
        inatividadeEquipeMin: escola.inatividadeEquipeMin,
        introducaoVistaEm: usuario.introducaoVistaEm,
      })
      .from(usuario)
      .innerJoin(escola, eq(escola.id, usuario.escolaId))
      .where(and(eq(usuario.escolaId, escolaId), eq(usuario.id, usuarioId)))
      .limit(1)
    return linha
  }

  /**
   * Marca que a pessoa da sessão viu a introdução e devolve a data que ficou: a primeira (`coalesce`), por mais vezes que seja
   * chamada e por mais de uma ao mesmo tempo (a segunda espera a trava da linha). Só a linha do contexto, `escola_id` e `id`.
   * Não recebe data: é o que impede o `GET /v1/eu` de gravar na linha dela o valor que leu de outra escola. Não pede ano em
   * curso: a escola recém-criada ainda não tem e grava do mesmo jeito. Sem linha (a pessoa saiu entre a guarda e aqui), nada.
   */
  async marcarIntroducaoVista(): Promise<Date | undefined> {
    const { escolaId, usuarioId } = requestIdentity()
    const [linha] = await this.banco
      .update(usuario)
      .set({ introducaoVistaEm: sql`coalesce(${usuario.introducaoVistaEm}, now())` })
      .where(and(eq(usuario.escolaId, escolaId), eq(usuario.id, usuarioId)))
      .returning({ introducaoVistaEm: usuario.introducaoVistaEm })
    return linha?.introducaoVistaEm ?? undefined
  }
}
