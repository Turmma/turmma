import { conta, contaExterna, requireEscolaId, provedorEscola, usuario, type Database, type ProvedorExterno, type DatabaseTransaction } from '@educa/core'
import { and, eq, isNull, sql } from 'drizzle-orm'

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
}
