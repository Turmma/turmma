import { and, eq, exists, gt, isNotNull, isNull, or, sql } from 'drizzle-orm'
import type { Database, DatabaseTransaction } from '../db/banco.js'
import { codigoRecuperacao } from '../db/schema/codigo-recuperacao.js'
import { conta } from '../db/schema/conta.js'
import { convite } from '../db/schema/convite.js'
import { sessao, type MotivoDeEncerramento } from '../db/schema/sessao.js'
import { usuario } from '../db/schema/usuario.js'
import { Unscoped } from '../db/sem-escopo.decorator.js'

/**
 * A conta global (o login da equipe), que não tem escola: as três escritas nela que o ciclo de vida e a redefinição do
 * MFA fazem depois de a escola do usuário ser conhecida (F3, tarefa 1.0; Tech Spec do F3, seção 6). Saíram da
 * resolução de tenant do módulo `sessao` quando o ciclo de vida veio para o `nucleo`, que não importa `apps/api`.
 *
 * O desvio da regra 10, item 9 fica contido por teste: a classe não sai pelo barrel do `@educa/nucleo` (só pelo
 * subcaminho `@educa/nucleo/conta-global`), e só o módulo `sessao` da API e esta pasta a importam
 * (`apps/api/test/arquitetura.test.ts`). As três exceções são antigas e mudaram de lugar, mas já estão no ponto que a
 * regra 10, item 9 aponta como sinal de desenho errado (a terceira no mesmo módulo): qualquer outra aqui é mudança de
 * spec, discutida antes.
 */
export class ContaGlobalRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /**
   * Encerra todas as sessões ainda abertas da conta, em todas as escolas dela, com o motivo dado: a redefinição do MFA
   * (17.4) e a limpeza da conta sem usuário ativo (17.1). A sessão de aluno não tem conta e nunca é alcançada. Devolve
   * só quantas, e quem chama não as põe em resposta nem em auditoria de escola nenhuma: seriam também de outra escola.
   */
  @Unscoped('a credencial da equipe é global: redefinir o segundo fator ou limpar a conta encerra as sessões dela em todas as escolas, pelo conta_id já verificado, e devolve só a quantidade')
  async encerrarSessoesDaConta(contaId: string, motivo: MotivoDeEncerramento): Promise<number> {
    const encerradas = await this.banco
      .update(sessao)
      .set({ encerradaEm: sql`now()`, motivo })
      .where(and(eq(sessao.contaId, contaId), isNull(sessao.encerradaEm)))
      .returning({ id: sessao.id })
    return encerradas.length
  }

  /**
   * Trava a conta (`FOR UPDATE`) na transação da desativação ou da eliminação (17.0), antes de mexer no usuário ou na
   * sessão: duas desativações de usuários da mesma conta, em A e em B, esperam uma pela outra, e a segunda, relendo,
   * vê a primeira. É a mesma trava da redefinição do MFA, e na mesma ordem (conta, depois sessão).
   */
  @Unscoped('a credencial da equipe é global: a desativação e a eliminação travam a conta do usuário da escola do contexto, pelo conta_id lido nela, e não devolvem nada')
  async travarConta(contaId: string): Promise<void> {
    await this.banco.select({ id: conta.id }).from(conta).where(eq(conta.id, contaId)).for('update')
  }

  /**
   * Com a conta já travada (`travarConta`), limpa a conta que deixou de servir a qualquer escola (17.0; regra 20, item
   * 18): apaga e-mail, senha, segredo e passo do TOTP e os códigos de recuperação, e encerra as sessões ainda abertas
   * dela (motivo `conta_limpa`), que saem com o expurgo de 30 dias. A linha fica só com o id, que os usuários desativados ainda apontam.
   *
   * A conta serve enquanto tem um usuário ativo em alguma escola, ou um usuário que espera um convite ainda válido (não
   * usado, não revogado e no prazo): apagar o e-mail agora deixaria o aceite desse convite sem login. Quando esse convite
   * deixa de valer, o `sistema.expurgar-acesso` limpa a conta de madrugada, pelo mesmo critério. Devolve se limpou.
   */
  @Unscoped('a credencial da equipe é global: depois de desativar ou eliminar um usuário, confere se a conta ainda tem usuário ativo ou convite válido em alguma escola e, se não tem, apaga a credencial dela; devolve só se limpou')
  async limparContaSemUso(contaId: string): Promise<boolean> {
    const conviteValido = this.banco
      .select({ um: sql`1` })
      .from(convite)
      .where(and(eq(convite.escolaId, usuario.escolaId), eq(convite.usuarioId, usuario.id), isNull(convite.usadoEm), isNull(convite.revogadoEm), gt(convite.expiraEm, sql`now()`)))
    const [emUso] = await this.banco
      .select({ id: usuario.id })
      .from(usuario)
      .where(and(eq(usuario.contaId, contaId), or(isNull(usuario.desativadoEm), exists(conviteValido))))
      .limit(1)
    if (emUso !== undefined) return false
    const limpas = await this.banco
      .update(conta)
      .set({ email: null, senhaHash: null, mfaSegredoCifrado: null, mfaChaveVersao: null, mfaAtivadoEm: null, mfaUltimoPasso: null })
      .where(and(eq(conta.id, contaId), isNotNull(conta.email)))
      .returning({ id: conta.id })
    await this.banco.delete(codigoRecuperacao).where(eq(codigoRecuperacao.contaId, contaId))
    await this.encerrarSessoesDaConta(contaId, 'conta_limpa')
    return limpas.length === 1
  }
}
