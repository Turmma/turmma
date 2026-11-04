import { ErrorCode } from '@educa/shared'
import { and, asc, eq, exists, gt, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'
import type { Database, DatabaseTransaction } from '../db/database.js'
import { codigoRecuperacao } from '../db/schema/codigo-recuperacao.js'
import { conta } from '../db/schema/conta.js'
import { convite } from '../db/schema/convite.js'
import { sessao, type MotivoDeEncerramento } from '../db/schema/sessao.js'
import { usuario } from '../db/schema/usuario.js'
import { Unscoped } from '../db/unscoped.decorator.js'
import { DomainException } from '../error/domain.exception.js'

/**
 * A conta global (o login da equipe), que não tem escola: as três escritas nela que o ciclo de vida e a redefinição do
 * MFA fazem depois de a escola do usuário ser conhecida (F3, tarefa 1.0; Tech Spec do F3, seção 6), e o achar ou criar
 * a conta pelo e-mail do convite (`contaParaConvite`; onboarding-por-convite, tarefa 1.0) e a trava das contas do passo (3) da
 * planilha de professores (`travarEConferir`; 6.0). Saíram da resolução de tenant
 * do módulo `sessao` quando o ciclo de vida veio para o `nucleo`, que não importa `apps/api`.
 *
 * O desvio da regra 10, item 9 fica contido por teste: a classe não sai pelo barrel do `@educa/core` (só pelo
 * subcaminho `@educa/core/conta-global`), e só o módulo `sessao` da API, a pasta do ciclo de vida e **o arquivo**
 * `estrutura/cadastro-de-professor.ts` a importam (`apps/api/test/architecture.test.ts` e a regra `cerca-conta-global`).
 * As quatro primeiras exceções são antigas e mudaram de lugar, mas já estão no ponto que a regra 10, item 9 aponta como sinal de
 * desenho errado: qualquer outra aqui é mudança de spec, discutida antes.
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

  /**
   * Trava em `FOR SHARE`, em ordem de id e num comando só, as contas que o passo (1) da planilha de professores achou ou criou
   * (onboarding-por-convite, 6.0; Tech Spec, seção 5, "O job"), e confere que cada uma ainda tem o e-mail da linha: devolve
   * `false` se alguma sumiu ou perdeu o e-mail (a limpeza da conta sem uso a esvaziou entre o (1) e o (3)). Com o `FOR SHARE`,
   * a limpeza que chegar depois espera o fim do passo (3). Só as contas do próprio job são lidas, pelo id que o (1) devolveu, e
   * nada delas sai daqui além do veredito. Chega ao processor pelo `cadastro-de-professor.ts`, que repassa a função ao motor.
   */
  @Unscoped('a conta é global: o passo (3) da planilha de professores trava em FOR SHARE as contas que o passo (1) do próprio job achou, pelo id, e devolve só se cada uma ainda tem o e-mail da linha')
  async travarEConferir(contas: ReadonlyMap<string, string>): Promise<boolean> {
    if (contas.size === 0) return true
    const esperado = new Map([...contas].map(([email, id]) => [id, email]))
    const travadas = await this.banco
      .select({ id: conta.id, email: conta.email })
      .from(conta)
      .where(inArray(conta.id, [...esperado.keys()]))
      .orderBy(asc(conta.id))
      .for('share')
    return travadas.length === esperado.size && travadas.every((travada) => travada.email?.toLowerCase() === esperado.get(travada.id))
  }

  /**
   * Acha ou cria a conta do e-mail, para o convite do coordenador e o do professor: conta nova nasce sem senha. Não lê
   * nada da conta existente além do id, e quem chama não diz ao operador nem à coordenação se ela já existia.
   *
   * A conta existente fica travada (`FOR NO KEY UPDATE`) até o fim da transação do convite (17.0): a limpeza da conta
   * sem uso, na desativação ou no expurgo da madrugada, não apaga o e-mail de uma conta que está recebendo convite (o
   * expurgo a pula, com `skip locked`, e a desativação espera). Se a limpeza travou antes, esta leitura espera o commit
   * dela, relê a linha, e a conta sem e-mail não é achada: o convite cria outra conta, com o e-mail.
   */
  @Unscoped('a conta é global: acha ou cria pelo e-mail, sem ler nada dela, e devolve só o id e se ela é nova')
  async contaParaConvite(email: string): Promise<{ id: string; nova: boolean }> {
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const [criada] = await this.banco.insert(conta).values({ email }).onConflictDoNothing({ target: conta.email }).returning({ id: conta.id })
      if (criada !== undefined) return { id: criada.id, nova: true }
      const [existente] = await this.banco.select({ id: conta.id }).from(conta).where(eq(conta.email, email)).limit(1).for('no key update')
      if (existente !== undefined) return { id: existente.id, nova: false }
    }
    // Três limpezas seguidas da mesma conta no meio de um convite não acontecem: se acontecer, quem convida tenta de novo.
    throw new DomainException(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
  }
}
