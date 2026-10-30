import { credencialMatricula, requireEscolaId, usuario, type Database, type DatabaseTransaction } from '@educa/nucleo'
import { and, eq, isNull } from 'drizzle-orm'

/** A credencial achada pela matrícula: o usuário e o hash, nunca a matrícula nem o nome. */
export interface CredencialDoAluno {
  readonly usuarioId: string
  readonly senhaHash: string | null
  /** A eliminação está agendada (F3, 14.0): com a senha certa, a resposta é `ACESSO_SUSPENSO`, e nada é emitido. */
  readonly suspenso: boolean
}

/**
 * A credencial por matrícula (tarefa 11.0), sempre na escola do contexto (regra 10, item 3). No login, esse contexto é
 * o da escola do slug, aberto pela resolução de tenant (em `sessao/`) antes de ler a credencial: a matrícula nunca é
 * procurada fora da escola, e a mesma matrícula em outra escola é outra conta (regra 60, item 6).
 */
export class CredencialMatriculaRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /**
   * A credencial de aluno ativo com a matrícula, na escola do contexto. Usuário desativado (aluno transferido), que não
   * é aluno, ou matrícula que não existe dão `undefined`, e quem chama responde igual à senha errada. O aluno com a
   * eliminação agendada **vem**, com `suspenso`: a senha dele é conferida como a de qualquer um (mesmo hash, mesmo
   * contador), e só com ela certa a resposta é `ACESSO_SUSPENSO`.
   */
  async doAlunoAtivo(matricula: string): Promise<CredencialDoAluno | undefined> {
    const escolaId = requireEscolaId()
    const [linha] = await this.banco
      .select({ usuarioId: credencialMatricula.usuarioId, senhaHash: credencialMatricula.senhaHash, eliminacaoAgendadaEm: usuario.eliminacaoAgendadaEm })
      .from(credencialMatricula)
      .innerJoin(usuario, and(eq(usuario.escolaId, credencialMatricula.escolaId), eq(usuario.id, credencialMatricula.usuarioId)))
      .where(and(eq(credencialMatricula.escolaId, escolaId), eq(credencialMatricula.matricula, matricula), eq(usuario.papel, 'aluno'), isNull(usuario.desativadoEm)))
      .limit(1)
    return linha === undefined ? undefined : { usuarioId: linha.usuarioId, senhaHash: linha.senhaHash, suspenso: linha.eliminacaoAgendadaEm !== null }
  }

  /** Grava credenciais de alunos da escola do contexto: o seed sintético (e, no F2, a reivindicação). */
  async criar(novas: ReadonlyArray<{ usuarioId: string; matricula: string; senhaHash: string }>): Promise<void> {
    if (novas.length === 0) return
    const escolaId = requireEscolaId()
    await this.banco.insert(credencialMatricula).values(novas.map((nova) => ({ ...nova, escolaId })))
  }
}
