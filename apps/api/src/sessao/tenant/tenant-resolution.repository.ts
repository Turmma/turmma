import { acessoTurma, anoLetivo, codigoRecuperacao, conta, convite, DomainException, escola, rede, registroAcesso, Unscoped, sessao, usuario, type Database, type EstadoDaSessao, type MotivoDeEncerramento, type TipoDeConvite, type DatabaseTransaction } from '@educa/core'
import { ErrorCode, type PapelDeUsuario } from '@educa/shared'
import { and, eq, gt, gte, isNotNull, isNull, lt, ne, or, sql, type SQL } from 'drizzle-orm'

/**
 * A sessão achada pelo hash do cookie, travada para a renovação decidir (tarefa 5.0): só ids, estado, datas, o papel
 * e a inatividade da escola, sem nada da pessoa. `pelo` diz se o cookie é o atual ou o anterior.
 */
export interface SessaoParaRenovar extends EstadoDaSessao {
  readonly id: string
  readonly escolaId: string
  readonly usuarioId: string
  readonly familia: string
  readonly pelo: 'atual' | 'anterior'
  readonly atualApresentado: boolean
  readonly rotacionadoEm: Date | null
  readonly motivo: MotivoDeEncerramento | null
}

/** A credencial achada pelo e-mail: o id, o hash (nulo enquanto a conta não tem senha) e se o MFA está ativo. Nunca o e-mail. */
export interface CredencialDaConta {
  readonly id: string
  readonly senhaHash: string | null
  readonly mfaAtivo: boolean
}

/**
 * O segundo fator de uma conta, achado pelo `conta_id` do desafio ou da sessão verificados: o segredo cifrado e a
 * versão da chave, se está ativo, e o último passo aceito. O e-mail vem só para o cookie `educa_dispositivo` e o
 * sufixo do contador, que usam o HMAC dele: nunca sai em resposta nem em log.
 */
export interface MfaDaConta {
  readonly id: string
  readonly email: string
  readonly segredoCifrado: Buffer | null
  readonly chaveVersao: number | null
  readonly ativadoEm: Date | null
  readonly ultimoPasso: number | null
}

/** Um usuário ativo de uma conta: só o id, a escola e o papel, nunca o nome. */
export interface UsuarioAtivoDaConta {
  readonly usuarioId: string
  readonly escolaId: string
  readonly papel: PapelDeUsuario
}

/**
 * O convite válido (não usado, não revogado, no prazo) achado pelo hash do token: os ids, o tipo (o aceite do professor
 * não leva ao segundo fator, A1) e se a conta do convidado já tem senha. Nunca o nome nem o e-mail.
 */
export interface ConviteValido {
  readonly escolaId: string
  readonly usuarioId: string
  readonly contaId: string
  readonly tipo: TipoDeConvite
  readonly contaTemSenha: boolean
}

/** O convite que o aceite acabou de marcar como usado: só os ids. */
export interface ConviteUsado {
  readonly id: string
  readonly escolaId: string
  readonly usuarioId: string
}

/** O usuário da conta que espera o convite aceito para ser ativado: o usuário, a escola, o papel e o convite. */
export interface UsuarioComConviteAceito extends UsuarioAtivoDaConta {
  readonly conviteId: string
}

/**
 * O acesso vigente da sala achado pelo link ou pelo código (A1, tarefa 5.0): só a escola, o ano e a turma da linha, que
 * viram o contexto da página pública, e o id do acesso, que prende o contador de matrícula errada por nome ao acesso
 * (7.0): o "Gerar novo" começa do zero. Nunca o hash do token, o HMAC do código, a validade nem o autor.
 */
export interface AcessoDaSalaAchado {
  readonly acessoId: string
  readonly escolaId: string
  readonly anoLetivoId: string
  readonly turmaId: string
}

/**
 * A fronteira da resolução de tenant (Tech Spec, seção 6): toda operação que acontece antes de existir escola no
 * contexto, e as da `conta` global, que não tem escola, fora as do ciclo de vida. Cada método leva `@Unscoped` com a
 * justificativa da tabela da seção 6, e devolve o mínimo para quem chama chegar à escola certa. As três escritas na conta
 * global que o ciclo de vida faz (travar, limpar e encerrar as sessões dela) moram na `ContaGlobalRepository`, em
 * `nucleo/ciclo-de-vida` (F3, tarefa 1.0), que o worker alcança.
 *
 * O desvio da regra 10, item 9 (mais de três exceções) fica contido por teste: só os arquivos de
 * `apps/api/src/sessao` importam esta classe (`apps/api/test/architecture.test.ts`). As tarefas seguintes
 * acrescentam os outros métodos da mesma tabela.
 */
export class ResolucaoDeTenantRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /**
   * Com o `banco` sendo a transação da renovação: acha a sessão cujo hash atual ou anterior é o do cookie e a trava
   * (`FOR UPDATE OF sessao`, sem travar o usuário nem a escola). Duas renovações do mesmo cookie esperam uma pela
   * outra, e a segunda relê a linha já rotacionada: o hash que era atual passa a ser o anterior.
   */
  @Unscoped('o cookie de renovação não diz a escola: a sessão é achada pelo hash atual ou anterior do refresh, e só depois a escola dela vira contexto')
  async sessaoParaRenovar(refreshHash: string): Promise<SessaoParaRenovar | undefined> {
    const [linha] = await this.banco
      .select({
        id: sessao.id,
        escolaId: sessao.escolaId,
        usuarioId: sessao.usuarioId,
        familia: sessao.familia,
        refreshHash: sessao.refreshHash,
        atualApresentado: sessao.atualApresentado,
        rotacionadoEm: sessao.rotacionadoEm,
        encerradaEm: sessao.encerradaEm,
        motivo: sessao.motivo,
        expiraEm: sessao.expiraEm,
        ultimoUsoEm: sessao.ultimoUsoEm,
        papel: usuario.papel,
        desativadoEm: usuario.desativadoEm,
        eliminacaoAgendadaEm: usuario.eliminacaoAgendadaEm,
        inatividadeAlunoMin: escola.inatividadeAlunoMin,
        inatividadeEquipeMin: escola.inatividadeEquipeMin,
        agora: sql<Date>`now()`.mapWith(sessao.expiraEm),
      })
      .from(sessao)
      .innerJoin(usuario, and(eq(usuario.escolaId, sessao.escolaId), eq(usuario.id, sessao.usuarioId)))
      .innerJoin(escola, eq(escola.id, sessao.escolaId))
      .where(or(eq(sessao.refreshHash, refreshHash), eq(sessao.refreshHashAnterior, refreshHash)))
      .limit(1)
      .for('update', { of: sessao })
    if (linha === undefined) return undefined
    const { refreshHash: atual, ...resto } = linha
    return { ...resto, pelo: atual === refreshHash ? 'atual' : 'anterior' }
  }

  /**
   * Os usuários com que a conta entra: ativos e **sem eliminação agendada** (F3, 14.0). A escola em que a pessoa tem a
   * eliminação agendada não é escolha nem destino do login por e-mail, da troca de escola e do segundo fator, e a pessoa
   * continua entrando nas outras. `comSuspensos` devolve também os agendados: só a redefinição do MFA pelo operador o usa, para
   * que a coordenação de cada escola da conta saiba que o segundo fator foi redefinido.
   */
  @Unscoped('a credencial da equipe é global: depois da senha verificada, lista em que escolas a conta tem usuário ativo, só com id, escola e papel')
  usuariosAtivosDaConta(contaId: string, opcoes: { readonly comSuspensos?: boolean } = {}): Promise<UsuarioAtivoDaConta[]> {
    return this.banco
      .select({ usuarioId: usuario.id, escolaId: usuario.escolaId, papel: usuario.papel })
      .from(usuario)
      .where(and(eq(usuario.contaId, contaId), isNull(usuario.desativadoEm), ...(opcoes.comSuspensos === true ? [] : [isNull(usuario.eliminacaoAgendadaEm)])))
      .orderBy(usuario.escolaId, usuario.id)
  }

  /**
   * Se a conta tem usuário de equipe ativo com a eliminação agendada (F3, 14.0). Só depois da senha certa e só quando nenhum
   * usuário da conta pode entrar: é o que decide entre `ACESSO_SUSPENSO` e a resposta única do login.
   */
  @Unscoped('a credencial da equipe é global: depois da senha verificada e sem usuário que possa entrar, diz se a conta tem uma escola com a eliminação agendada, sem dizer qual')
  async temAcessoSuspenso(contaId: string): Promise<boolean> {
    const [linha] = await this.banco
      .select({ id: usuario.id })
      .from(usuario)
      .where(and(eq(usuario.contaId, contaId), isNull(usuario.desativadoEm), isNotNull(usuario.eliminacaoAgendadaEm), ne(usuario.papel, 'aluno')))
      .limit(1)
    return linha !== undefined
  }

  /**
   * Os acessos da conta para o `/v1/eu` (12.0 do F1; o seletor da A1, 12.0) e para a etapa `escolher` do login (20.0):
   * cada usuário ativo de equipe, com o nome da escola, o nome da rede dela e o papel. O usuário desativado (saiu da
   * escola), o que ainda espera o convite (inativo até o login que o ativa, 7.0) e o que tem a eliminação agendada (14.0)
   * não aparecem. Nada da outra escola além
   * do nome dela e do da rede: nem id, nem turma, nem número de turmas, nem vínculo.
   */
  @Unscoped('a credencial da equipe é global: o /v1/eu e a etapa escolher listam, pela conta já verificada, em que escolas ela tem usuário ativo, só com id, nome da escola, nome da rede e papel')
  acessosDaConta(contaId: string): Promise<Array<{ usuarioId: string; escolaNome: string; redeNome: string; papel: PapelDeUsuario }>> {
    return this.banco
      .select({ usuarioId: usuario.id, escolaNome: escola.nome, redeNome: rede.nome, papel: usuario.papel })
      .from(usuario)
      .innerJoin(escola, eq(escola.id, usuario.escolaId))
      .innerJoin(rede, eq(rede.id, escola.redeId))
      .where(and(eq(usuario.contaId, contaId), isNull(usuario.desativadoEm), isNull(usuario.eliminacaoAgendadaEm), ne(usuario.papel, 'aluno')))
      .orderBy(escola.nome, usuario.id)
  }

  /**
   * A data mais antiga em que a conta viu a introdução, entre os usuários ativos dela **com o mesmo papel** (telas do aluno,
   * tarefa 1.0): a professora que já viu a introdução na escola A não a vê de novo ao entrar na B. O papel é filtrado na
   * query, porque a introdução da coordenação não é a do professor. Mesmo critério de `acessosDaConta` (sem desativado e sem
   * eliminação agendada); o `min` ignora quem ainda não viu. Devolve só a data: nada da outra escola, nem o nome dela, e ela não
   * sai em `acessos` nem na etapa `escolher` do login.
   */
  @Unscoped('a credencial da equipe é global: o /v1/eu lê, pela conta da sessão, a data mais antiga em que um usuário ativo dela, com o mesmo papel, viu a introdução; devolve só essa data, que não sai em acessos nem no login')
  async introducaoMaisAntigaDaConta(contaId: string, papel: PapelDeUsuario): Promise<Date | null> {
    const [linha] = await this.banco
      .select({ maisAntiga: sql<Date | string | null>`min(${usuario.introducaoVistaEm})` })
      .from(usuario)
      .where(and(eq(usuario.contaId, contaId), eq(usuario.papel, papel), isNull(usuario.desativadoEm), isNull(usuario.eliminacaoAgendadaEm)))
    return linha?.maisAntiga == null ? null : new Date(linha.maisAntiga)
  }

  @Unscoped('a credencial da equipe é global: o login por e-mail acha a conta pelo e-mail antes de haver escola, e devolve só o id, o hash e se o MFA está ativo')
  async contaPorEmail(email: string): Promise<CredencialDaConta | undefined> {
    const [linha] = await this.banco
      .select({ id: conta.id, senhaHash: conta.senhaHash, mfaAtivadoEm: conta.mfaAtivadoEm })
      .from(conta)
      .where(eq(conta.email, email))
      .limit(1)
    return linha === undefined ? undefined : { id: linha.id, senhaHash: linha.senhaHash, mfaAtivo: linha.mfaAtivadoEm !== null }
  }

  @Unscoped('a falha de login por e-mail acontece antes de haver escola: grava o registro de acesso com escola e usuário nulos, só com o evento e o IP')
  async gravarFalhaDeLoginPorEmail(ip: string): Promise<void> {
    await this.banco.insert(registroAcesso).values({ escolaId: null, usuarioId: null, evento: 'login_falho', ip })
  }

  @Unscoped('a conta é global e não tem escola: criar a credencial da equipe grava só o e-mail e devolve só os ids, sem ler conta existente')
  async criarContas(emails: readonly string[]): Promise<string[]> {
    if (emails.length === 0) return []
    const criadas = await this.banco
      .insert(conta)
      .values(emails.map((email) => ({ email })))
      .returning({ id: conta.id })
    return criadas.map((criada) => criada.id)
  }
  /**
   * A conta limpa (17.0), sem e-mail, não é achada: um desafio emitido antes da limpeza não conclui nada e responde como
   * credencial inválida.
   */
  @Unscoped('a credencial da equipe é global: verificar o TOTP e a recuperação lê a conta pelo conta_id do desafio ou da sessão verificados, nunca pelo do cliente')
  async mfaDaConta(contaId: string): Promise<MfaDaConta | undefined> {
    const [linha] = await this.banco
      .select({
        id: conta.id,
        email: conta.email,
        segredoCifrado: conta.mfaSegredoCifrado,
        chaveVersao: conta.mfaChaveVersao,
        ativadoEm: conta.mfaAtivadoEm,
        ultimoPasso: conta.mfaUltimoPasso,
      })
      .from(conta)
      .where(eq(conta.id, contaId))
      .limit(1)
    if (linha?.email === null || linha === undefined) return undefined
    return { ...linha, email: linha.email }
  }

  /**
   * Grava o segredo novo só enquanto o MFA está inativo (`mfa_ativado_em is null`): quem tem só a senha de uma conta
   * com MFA não troca o segundo fator. Devolve se gravou.
   */
  @Unscoped('a credencial da equipe é global: configurar o MFA escreve na conta pelo conta_id do desafio verificado, e só com o MFA inativo')
  async gravarSegredoDeMfa(contaId: string, cifrado: Buffer, versao: number): Promise<boolean> {
    const gravadas = await this.banco
      .update(conta)
      .set({ mfaSegredoCifrado: cifrado, mfaChaveVersao: versao, mfaUltimoPasso: null })
      .where(and(eq(conta.id, contaId), isNull(conta.mfaAtivadoEm)))
      .returning({ id: conta.id })
    return gravadas.length === 1
  }

  /**
   * Com o `banco` sendo a transação da ativação: liga o MFA com o passo do código que a provou, só se ainda estava
   * inativo e com o mesmo segredo que foi conferido (duas ativações juntas passam uma vez), troca os códigos de
   * recuperação da conta pelos novos (só HMAC) e devolve se ativou.
   */
  @Unscoped('a credencial da equipe é global: ativar o MFA escreve na conta e nos códigos de recuperação dela, pelo conta_id do desafio verificado')
  async ativarMfa(contaId: string, segredoConferido: Buffer, passo: number, hmacs: readonly string[]): Promise<boolean> {
    const ativadas = await this.banco
      .update(conta)
      .set({ mfaAtivadoEm: sql`now()`, mfaUltimoPasso: passo })
      .where(and(eq(conta.id, contaId), isNull(conta.mfaAtivadoEm), eq(conta.mfaSegredoCifrado, segredoConferido)))
      .returning({ id: conta.id })
    if (ativadas.length !== 1) return false
    await this.banco.delete(codigoRecuperacao).where(eq(codigoRecuperacao.contaId, contaId))
    await this.banco.insert(codigoRecuperacao).values(hmacs.map((hmac) => ({ contaId, hmac })))
    return true
  }

  /**
   * Aceita o passo do TOTP só se ele é maior que o último aceito (`update … where mfa_ultimo_passo < $passo`): o mesmo
   * código em dois pedidos ao mesmo tempo passa uma vez, e um código já usado não volta (regra 80, item 7).
   */
  @Unscoped('a credencial da equipe é global: aceitar o código do app autenticador grava mfa_ultimo_passo na conta do desafio verificado')
  async avancarPassoDoMfa(contaId: string, passo: number): Promise<boolean> {
    const aceitas = await this.banco
      .update(conta)
      .set({ mfaUltimoPasso: passo })
      .where(and(eq(conta.id, contaId), isNotNull(conta.mfaAtivadoEm), or(isNull(conta.mfaUltimoPasso), lt(conta.mfaUltimoPasso, passo))))
      .returning({ id: conta.id })
    return aceitas.length === 1
  }

  /**
   * Marca o código de recuperação como usado, uma vez só (`where usado_em is null`), e devolve se ele valia. Os códigos
   * só existem com o MFA ativo: nascem na ativação e saem na redefinição, na mesma transação de cada uma.
   */
  @Unscoped('a credencial da equipe é global: consumir o código de recuperação escreve nos códigos da conta do desafio verificado')
  async usarCodigoDeRecuperacao(contaId: string, hmac: string): Promise<boolean> {
    const usados = await this.banco
      .update(codigoRecuperacao)
      .set({ usadoEm: sql`now()` })
      .where(and(eq(codigoRecuperacao.contaId, contaId), eq(codigoRecuperacao.hmac, hmac), isNull(codigoRecuperacao.usadoEm)))
      .returning({ id: codigoRecuperacao.id })
    return usados.length === 1
  }

  /**
   * Com o `banco` sendo a transação da redefinição: trava a conta (`FOR UPDATE`) e devolve se o MFA dela está ativo e
   * as escolas dos usuários ativos dela, só os ids. `FOR UPDATE`, e não `FOR NO KEY UPDATE`, de propósito: conflita
   * com o `FOR KEY SHARE` da FK de `usuario`, então um usuário novo dessa conta em outra escola (convite, 7.0) ou já
   * foi gravado antes e aparece aqui, ou espera o commit. Duas redefinições da mesma conta esperam uma pela outra.
   */
  @Unscoped('a credencial da equipe é global: redefinir o MFA confere, com a conta travada, em que escolas ela tem usuário ativo, só pelos ids')
  async travarContaParaRedefinir(contaId: string): Promise<{ mfaAtivo: boolean; escolasAtivas: string[] } | undefined> {
    const [linha] = await this.banco.select({ ativadoEm: conta.mfaAtivadoEm }).from(conta).where(eq(conta.id, contaId)).for('update')
    if (linha === undefined) return undefined
    const ativos = await this.banco
      .selectDistinct({ escolaId: usuario.escolaId })
      .from(usuario)
      .where(and(eq(usuario.contaId, contaId), isNull(usuario.desativadoEm)))
      .orderBy(usuario.escolaId)
    return { mfaAtivo: linha.ativadoEm !== null, escolasAtivas: ativos.map((ativo) => ativo.escolaId) }
  }

  /** Apaga o segundo fator da conta: segredo, versão, ativação, último passo e todos os códigos de recuperação. */
  @Unscoped('a credencial da equipe é global: a redefinição do MFA apaga o segundo fator da conta, depois de conferida a escola de todos os usuários ativos dela')
  async apagarMfa(contaId: string): Promise<void> {
    await this.banco.update(conta).set({ mfaSegredoCifrado: null, mfaChaveVersao: null, mfaAtivadoEm: null, mfaUltimoPasso: null }).where(eq(conta.id, contaId))
    await this.banco.delete(codigoRecuperacao).where(eq(codigoRecuperacao.contaId, contaId))
  }

  /**
   * A escola de um usuário, para o `ops:redefinir-mfa` abrir o contexto dela: o operador recebe só o id do usuário,
   * e a escola vem daqui, nunca do argumento. Devolve só a escola e a conta, nunca o nome.
   */
  @Unscoped('rotina do operador (ops:redefinir-mfa): o comando recebe só o usuarioId do pedido formal, e a escola dele vira o contexto')
  async escolaDoUsuarioParaOperador(usuarioId: string): Promise<{ escolaId: string; contaId: string | null; ativo: boolean } | undefined> {
    const [linha] = await this.banco
      .select({ escolaId: usuario.escolaId, contaId: usuario.contaId, desativadoEm: usuario.desativadoEm })
      .from(usuario)
      .where(eq(usuario.id, usuarioId))
      .limit(1)
    return linha === undefined ? undefined : { escolaId: linha.escolaId, contaId: linha.contaId, ativo: linha.desativadoEm === null }
  }

  /**
   * O convite que ainda vale, pelo hash do token: expirado, revogado, usado e inexistente dão todos `undefined`, e quem
   * chama responde o mesmo erro (regra 10, item 6).
   */
  @Unscoped('o link do convite não diz a escola: o convite válido é achado pelo hash do token, e só depois a escola dele vira contexto; devolve só ids, o tipo e se a conta tem senha')
  async conviteValidoPorHash(tokenHash: string): Promise<ConviteValido | undefined> {
    const [linha] = await this.banco
      .select({ escolaId: convite.escolaId, usuarioId: convite.usuarioId, contaId: conta.id, tipo: convite.tipo, senhaHash: conta.senhaHash })
      .from(convite)
      .innerJoin(usuario, and(eq(usuario.escolaId, convite.escolaId), eq(usuario.id, convite.usuarioId)))
      .innerJoin(conta, eq(conta.id, usuario.contaId))
      .where(and(eq(convite.tokenHash, tokenHash), isNull(convite.usadoEm), isNull(convite.revogadoEm), gt(convite.expiraEm, sql`now()`)))
      .limit(1)
    return linha === undefined ? undefined : { escolaId: linha.escolaId, usuarioId: linha.usuarioId, contaId: linha.contaId, tipo: linha.tipo, contaTemSenha: linha.senhaHash !== null }
  }

  /**
   * Com o `banco` sendo a transação do aceite: marca o convite como usado, uma vez só (`update … where usado_em is null
   * and revogado_em is null and expira_em > now()`). Dois aceites com o mesmo token ao mesmo tempo passam um: o segundo
   * espera a trava da linha e, relendo, já não a acha (regra 80, item 7).
   */
  @Unscoped('o link do convite não diz a escola: o aceite marca como usado o convite do hash do token, uma vez só, e devolve só os ids')
  async usarConvitePorHash(tokenHash: string): Promise<ConviteUsado | undefined> {
    const [usado] = await this.banco
      .update(convite)
      .set({ usadoEm: sql`now()` })
      .where(and(eq(convite.tokenHash, tokenHash), isNull(convite.usadoEm), isNull(convite.revogadoEm), gt(convite.expiraEm, sql`now()`)))
      .returning({ id: convite.id, escolaId: convite.escolaId, usuarioId: convite.usuarioId })
    return usado
  }

  /**
   * Grava a senha da conta só enquanto ela não tem senha (`where senha_hash is null`): o link do convite nunca troca a
   * senha de uma conta existente, nem na corrida com o aceite de outro convite da mesma conta. Devolve se gravou.
   */
  @Unscoped('a credencial da equipe é global: a senha no aceite do convite é gravada na conta do usuário do convite, e só enquanto ela não tem senha')
  async definirSenhaNoAceite(contaId: string, senhaHash: string): Promise<boolean> {
    const gravadas = await this.banco
      .update(conta)
      .set({ senhaHash })
      .where(and(eq(conta.id, contaId), isNull(conta.senhaHash)))
      .returning({ id: conta.id })
    return gravadas.length === 1
  }

  /**
   * O usuário da conta que espera ativação pelo convite do bilhete: inativo, com esse convite usado, não revogado e
   * aceito depois de o usuário ficar inativo (`usado_em >= desativado_em`). A última condição separa o usuário que
   * espera o convite (fica inativo na criação, e o aceite vem depois) do usuário desativado depois de ter entrado: esse
   * não volta pelo convite antigo. O prazo depois do aceite é o do bilhete (30 min), não o `expira_em`, que valeu no
   * aceite.
   */
  @Unscoped('a credencial da equipe é global: depois da senha (e do segundo fator) verificados, acha o usuário da conta que espera o convite do bilhete, só com ids, escola e papel')
  async usuarioComConviteAceito(contaId: string, conviteId: string): Promise<UsuarioComConviteAceito | undefined> {
    const [linha] = await this.banco
      .select({ usuarioId: usuario.id, escolaId: usuario.escolaId, papel: usuario.papel, conviteId: convite.id })
      .from(usuario)
      .innerJoin(convite, and(eq(convite.escolaId, usuario.escolaId), eq(convite.usuarioId, usuario.id)))
      .where(
        and(
          eq(usuario.contaId, contaId),
          eq(convite.id, conviteId),
          isNotNull(usuario.desativadoEm),
          isNotNull(convite.usadoEm),
          isNull(convite.revogadoEm),
          gte(convite.usadoEm, usuario.desativadoEm),
        ),
      )
      .limit(1)
    return linha
  }

  /**
   * Quantas escolas tem a rede cujo IP público de saída (`rede.ips_saida`) é este (15.2): o limite por IP da rota de
   * e-mail é multiplicado por elas, porque a rede municipal sai por um IP só. Devolve só o número, 0 quando o IP não é de
   * rede nenhuma; com o mesmo IP em duas redes, vale a maior. O IP vem normalizado da borda (`requestIp`).
   */
  @Unscoped('ler rede por IP de saída: o limite por IP da rota de e-mail acontece antes de haver escola; devolve só o número de escolas da rede, nunca id nem nome')
  async escolasDaRedeDoIpDeSaida(ip: string): Promise<number> {
    const porRede = this.banco
      .select({ escolas: sql<number>`count(${escola.id})::int`.as('escolas') })
      .from(rede)
      .innerJoin(escola, eq(escola.redeId, rede.id))
      .where(sql`${ip}::inet = any(${rede.ipsSaida})`)
      .groupBy(rede.id)
      .as('por_rede')
    const [linha] = await this.banco.select({ maior: sql<number>`coalesce(max(${porRede.escolas}), 0)::int` }).from(porRede)
    return linha?.maior ?? 0
  }

  @Unscoped('ler escola por slug: o slug é o que dá a escola, e é público (/acesso); devolve só o id, para a escola virar o contexto')
  async escolaPorSlug(slug: string): Promise<string | undefined> {
    const [linha] = await this.banco.select({ id: escola.id }).from(escola).where(eq(escola.slug, slug)).limit(1)
    return linha?.id
  }

  /**
   * Acha ou cria a conta do e-mail, para o convite do coordenador (7.0) e o do professor (A1, tarefa 3.0): conta nova
   * nasce sem senha. Não lê nada da conta existente além do id, e quem chama não diz ao operador nem à coordenação se ela
   * já existia.
   *
   * A conta existente fica travada (`FOR NO KEY UPDATE`) até o fim da transação do convite (17.0): a limpeza da conta
   * sem uso, na desativação ou no expurgo da madrugada, não apaga o e-mail de uma conta que está recebendo convite (o
   * expurgo a pula, com `skip locked`, e a desativação espera). Se a limpeza travou antes, esta leitura espera o commit
   * dela, relê a linha, e a conta sem e-mail não é achada: o convite cria outra conta, com o e-mail.
   */
  @Unscoped('a conta é global e não tem escola: o convite da coordenação, pelo comando ou pelo painel, e o do professor, pela coordenação da escola, acham ou criam a conta pelo e-mail, travando a existente, sem ler nada dela, e devolvem só o id e se ela é nova')
  async contaParaConvite(email: string): Promise<{ id: string; nova: boolean }> {
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const [criada] = await this.banco.insert(conta).values({ email }).onConflictDoNothing({ target: conta.email }).returning({ id: conta.id })
      if (criada !== undefined) return { id: criada.id, nova: true }
      const [existente] = await this.banco.select({ id: conta.id }).from(conta).where(eq(conta.email, email)).limit(1).for('no key update')
      if (existente !== undefined) return { id: existente.id, nova: false }
    }
    // Três limpezas seguidas da mesma conta no meio de um convite não acontecem: se acontecer, o operador tenta de novo.
    throw new DomainException(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
  }

  /**
   * A escola de um convite de coordenação, para o revogar (e o refazer) do operador abrir o contexto dela: o comando e o
   * painel recebem só o id do convite. Só convite `tipo = 'coordenador'`: o de outro tipo não é achado, como o inexistente.
   */
  @Unscoped('rotina do operador, pelo comando ou pelo painel: recebe só o id do convite de coordenação, e a escola dele vira o contexto, nunca o argumento')
  async escolaDoConviteParaOperador(conviteId: string): Promise<string | undefined> {
    const [linha] = await this.banco
      .select({ escolaId: convite.escolaId })
      .from(convite)
      .where(and(eq(convite.id, conviteId), eq(convite.tipo, 'coordenador')))
      .limit(1)
    return linha?.escolaId
  }

  /**
   * O acesso da sala pelo link (A1, tarefa 5.0): o vigente (não revogado, `expira_em > now()`) cujo `token_hash` é este,
   * da escola do slug e no ano `em_curso` dela. O token é único no sistema e não diz a escola; o slug é conferido contra a
   * escola da linha no mesmo comando, e o token de outra escola, vencido, revogado, de ano encerrado ou de turma excluída
   * (a cascata o levou) dão todos `undefined` (regra 10, item 6). O acesso, a escola, o ano e a turma saem da linha, nunca
   * do cliente.
   */
  @Unscoped('o link e o código da sala não dizem a escola: o acesso vigente é achado pelo hash do token, conferido contra a escola do slug e o ano em curso dela, e devolve só o acesso, a escola, o ano e a turma')
  async acessoDaSalaPorToken(slug: string, tokenHash: string): Promise<AcessoDaSalaAchado | undefined> {
    return this.#acessoDaSala(slug, eq(acessoTurma.tokenHash, tokenHash))
  }

  /**
   * O acesso da sala pelo código (A1, tarefa 5.0): o vigente cujo `codigo_hmac` é este, buscado já na escola do slug,
   * no ano `em_curso` dela. O código é único só entre os não revogados de uma escola, e a chave do HMAC é uma só: o mesmo
   * código vigente em duas escolas tem o mesmo HMAC, e só o slug separa as duas.
   */
  @Unscoped('o link e o código da sala não dizem a escola: o acesso vigente é achado pelo HMAC do código dentro da escola do slug, no ano em curso dela, e devolve só o acesso, a escola, o ano e a turma')
  async acessoDaSalaPorCodigo(slug: string, codigoHmac: string): Promise<AcessoDaSalaAchado | undefined> {
    return this.#acessoDaSala(slug, eq(acessoTurma.codigoHmac, codigoHmac))
  }

  /** O acesso vigente da escola do slug, no ano em curso dela, que também atende a `chave` (o token ou o código). */
  async #acessoDaSala(slug: string, chave: SQL): Promise<AcessoDaSalaAchado | undefined> {
    const [linha] = await this.banco
      .select({ acessoId: acessoTurma.id, escolaId: acessoTurma.escolaId, anoLetivoId: acessoTurma.anoLetivoId, turmaId: acessoTurma.turmaId })
      .from(acessoTurma)
      .innerJoin(escola, and(eq(escola.id, acessoTurma.escolaId), eq(escola.slug, slug)))
      .innerJoin(anoLetivo, and(eq(anoLetivo.escolaId, acessoTurma.escolaId), eq(anoLetivo.id, acessoTurma.anoLetivoId), eq(anoLetivo.situacao, 'em_curso')))
      .where(and(chave, isNull(acessoTurma.revogadoEm), gt(acessoTurma.expiraEm, sql`now()`)))
      .limit(1)
    return linha
  }
}
