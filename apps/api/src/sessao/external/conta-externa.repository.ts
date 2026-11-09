import { conta, contaExterna, escola, requireEscolaId, provedorEscola, sessao, sessaoAindaVale, usuario, type Database, type ProvedorExterno, type DatabaseTransaction } from '@educa/core'
import { and, eq, isNull, sql, type SQL } from 'drizzle-orm'

/** A chave da conta externa: o provedor, o tenant (só na Microsoft) e o identificador estável. */
export interface ChaveDaContaExterna {
  readonly provedor: ProvedorExterno
  readonly tenant: string | null
  readonly sujeito: string
}

/** A ligação achada: o usuário da escola, se está ativo, se a eliminação dele está agendada (14.0) e a conta dele (nula para aluno). */
export interface LigacaoDaContaExterna {
  readonly usuarioId: string
  readonly contaId: string | null
  readonly ativo: boolean
  /** A eliminação está agendada: a conta do provedor está certa, e a resposta é `acesso_suspenso`, sem sessão. */
  readonly suspenso: boolean
}

/** O professor ativo da escola com aquele e-mail na conta, se ele já tem uma conta externa ligada e se a eliminação dele está agendada (14.0). */
export interface ProfessorPeloEmail {
  readonly usuarioId: string
  readonly contaId: string
  readonly jaLigado: boolean
  readonly suspenso: boolean
}

/** A sessão de aluno que vale agora: só os ids, nunca o refresh nem o hash. */
export interface SessaoDoAluno {
  readonly sessaoId: string
  readonly usuarioId: string
}

/**
 * A conta externa ligada e os domínios liberados, sempre na escola do contexto (regra 10, item 3). No login, esse
 * contexto é o da escola do cookie `educa_oidc`, aberto antes de ler qualquer coisa: a mesma conta Google ligada em A
 * não existe para B, e o domínio que B cadastrou não abre a ligação de A (Tech Spec, seção 6).
 */
export class ContaExternalRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /** Se o domínio (`hd`) ou o tenant (`tid`) está liberado para o provedor na escola do contexto. */
  async dominioLiberado(provedor: ProvedorExterno, dominio: string): Promise<boolean> {
    const escolaId = requireEscolaId()
    const [linha] = await this.banco
      .select({ id: provedorEscola.id })
      .from(provedorEscola)
      .where(and(eq(provedorEscola.escolaId, escolaId), eq(provedorEscola.provedor, provedor), eq(provedorEscola.valor, dominio), isNull(provedorEscola.removidoEm)))
      .limit(1)
    return linha !== undefined
  }

  /** Se a escola do contexto liberou algum domínio ou tenant do provedor. */
  async provedorLiberado(provedor: ProvedorExterno): Promise<boolean> {
    const escolaId = requireEscolaId()
    const [linha] = await this.banco
      .select({ id: provedorEscola.id })
      .from(provedorEscola)
      .where(and(eq(provedorEscola.escolaId, escolaId), eq(provedorEscola.provedor, provedor), isNull(provedorEscola.removidoEm)))
      .limit(1)
    return linha !== undefined
  }

  /**
   * A ligação da conta externa na escola do contexto, pelo índice único (a mesma expressão com `coalesce`), com o
   * usuário dela. Ligação de outra escola não aparece.
   */
  async ligacao(chave: ChaveDaContaExterna): Promise<LigacaoDaContaExterna | undefined> {
    const escolaId = requireEscolaId()
    const [linha] = await this.banco
      .select({ usuarioId: contaExterna.usuarioId, contaId: usuario.contaId, desativadoEm: usuario.desativadoEm, eliminacaoAgendadaEm: usuario.eliminacaoAgendadaEm })
      .from(contaExterna)
      .innerJoin(usuario, and(eq(usuario.escolaId, contaExterna.escolaId), eq(usuario.id, contaExterna.usuarioId)))
      .where(
        and(
          eq(contaExterna.escolaId, escolaId),
          eq(contaExterna.provedor, chave.provedor),
          sql`coalesce(${contaExterna.tenant}, '') = ${chave.tenant ?? ''}`,
          eq(contaExterna.sujeito, chave.sujeito),
        ),
      )
      .limit(1)
    if (linha === undefined) return undefined
    return { usuarioId: linha.usuarioId, contaId: linha.contaId, ativo: linha.desativadoEm === null, suspenso: linha.eliminacaoAgendadaEm !== null }
  }

  /**
   * O professor ativo da escola do contexto cuja conta tem o e-mail, e se ele já tem conta externa ligada. A conta é
   * global, mas só é alcançada a partir do usuário da escola: um professor de B com o mesmo e-mail não aparece em A, e
   * a coordenação e o aluno nunca aparecem (só o professor é ligado pelo e-mail, RF9 e RF10).
   */
  async professorPeloEmail(email: string): Promise<ProfessorPeloEmail | undefined> {
    const escolaId = requireEscolaId()
    const [linha] = await this.banco
      .select({
        usuarioId: usuario.id,
        contaId: conta.id,
        jaLigado: sql<boolean>`exists (select 1 from ${contaExterna} where ${contaExterna.escolaId} = ${usuario.escolaId} and ${contaExterna.usuarioId} = ${usuario.id})`,
        suspenso: sql<boolean>`${usuario.eliminacaoAgendadaEm} is not null`,
      })
      .from(usuario)
      .innerJoin(conta, eq(conta.id, usuario.contaId))
      .where(and(eq(usuario.escolaId, escolaId), eq(usuario.papel, 'professor'), isNull(usuario.desativadoEm), eq(conta.email, email)))
      .limit(1)
    return linha
  }

  /**
   * Liga a conta externa ao usuário, na escola do contexto. Devolve o id da ligação, ou `undefined` se o banco a
   * recusou por um dos índices únicos: a mesma conta externa já ligada (outro retorno chegou antes), ou o usuário que
   * já tem outra conta externa (RF9). Quem chama relê a ligação para saber qual dos dois foi.
   */
  async ligar(usuarioId: string, chave: ChaveDaContaExterna): Promise<string | undefined> {
    const escolaId = requireEscolaId()
    const [criada] = await this.banco
      .insert(contaExterna)
      .values({ escolaId, usuarioId, provedor: chave.provedor, tenant: chave.tenant, sujeito: chave.sujeito })
      .onConflictDoNothing()
      .returning({ id: contaExterna.id })
    return criada?.id
  }

  /**
   * A sessão de aluno aberta cujo refresh atual tem o hash do cookie, **na escola do contexto** (acesso-e-convites, 15.0): o `iniciar` do `intencao=ligar` sabe quem liga pelo
   * `educa_sessao`, que vai à navegação da própria web. Só o refresh atual vale (o anterior, de uma rotação, não), e só se a sessão ainda vale agora (`sessaoAindaVale`, a mesma
   * conferência da guarda e da renovação). Sessão de professor, de coordenador, de outra escola, vencida, encerrada ou de usuário desativado ou com a eliminação agendada: `undefined`.
   */
  async sessaoDoAluno(refreshHash: string): Promise<SessaoDoAluno | undefined> {
    const [linha] = await this.#estadoDaSessao(eq(sessao.refreshHash, refreshHash))
    return linha !== undefined && linha.papel === 'aluno' && sessaoAindaVale(linha) ? { sessaoId: linha.sessaoId, usuarioId: linha.usuarioId } : undefined
  }

  /**
   * Trava o usuário do aluno (`FOR NO KEY UPDATE`: a mesma trava da geração da senha provisória e da aprovação com conta, que se serializam com a ligação) e, **com a linha travada**,
   * confere que a sessão em que o `iniciar` o achou ainda vale e é dele (15.0; Tech Spec, seção 5, "Senha provisória"). É a conferência que separa "ligar" de "gerar": quem gerou a
   * provisória primeiro encerrou as sessões dele, e a ligação que esperava a trava as vê encerradas e não liga. `sessaoAindaVale` já recusa o aluno desativado ou com a eliminação
   * agendada. O usuário e a sessão vêm do cookie cifrado do `iniciar`, e a escola é a do contexto: o cookie com o aluno de uma escola e a escola de outra não acha linha nenhuma.
   * A sessão em si não tem trava: a saída do aluno não pega a do usuário, e pode encerrá-la entre esta conferência e o `insert`, caso em que a conta liga do mesmo jeito. A corrida é
   * aceita: é ato do próprio aluno, e a provisória, que é o que a trava protege, segue serializada com a ligação. Só dentro da transação da ligação.
   */
  async travarAlunoDaSessao(usuarioId: string, sessaoId: string): Promise<boolean> {
    const escolaId = requireEscolaId()
    await this.banco
      .select({ id: usuario.id })
      .from(usuario)
      .where(and(eq(usuario.escolaId, escolaId), eq(usuario.id, usuarioId)))
      .limit(1)
      .for('no key update')
    const [linha] = await this.#estadoDaSessao(and(eq(sessao.id, sessaoId), eq(sessao.usuarioId, usuarioId)))
    return linha !== undefined && sessaoAindaVale(linha)
  }

  /** A sessão e o que decide se ela vale, na escola do contexto, pela condição: a leitura que a `SessaoGuard` faz, sem o ano letivo e sem trava. */
  #estadoDaSessao(condicao: SQL | undefined) {
    return this.banco
      .select({
        sessaoId: sessao.id,
        usuarioId: sessao.usuarioId,
        papel: usuario.papel,
        desativadoEm: usuario.desativadoEm,
        eliminacaoAgendadaEm: usuario.eliminacaoAgendadaEm,
        encerradaEm: sessao.encerradaEm,
        expiraEm: sessao.expiraEm,
        ultimoUsoEm: sessao.ultimoUsoEm,
        inatividadeAlunoMin: escola.inatividadeAlunoMin,
        inatividadeEquipeMin: escola.inatividadeEquipeMin,
        agora: sql<Date>`now()`.mapWith(sessao.expiraEm),
      })
      .from(sessao)
      .innerJoin(usuario, and(eq(usuario.escolaId, sessao.escolaId), eq(usuario.id, sessao.usuarioId)))
      .innerJoin(escola, eq(escola.id, sessao.escolaId))
      .where(and(eq(sessao.escolaId, requireEscolaId()), condicao))
      .limit(1)
  }
}
