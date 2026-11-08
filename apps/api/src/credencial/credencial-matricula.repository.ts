import { contaExterna, credencialMatricula, requireAnoEmCurso, requireEscolaId, requestSessao, usuario, vinculo, type Database, type DatabaseTransaction } from '@educa/core'
import { JANELA_DO_CONFLITO_DA_SENHA_PROVISORIA_SEGUNDOS, VALIDADE_DA_SENHA_PROVISORIA_HORAS } from '@educa/shared'
import { and, eq, exists, isNull, sql, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

/** A credencial achada pela matrícula: o usuário e o hash, nunca a matrícula nem o nome. */
export interface CredencialDoAluno {
  readonly usuarioId: string
  readonly senhaHash: string | null
  /** A eliminação está agendada (F3, 14.0): com a senha certa, a resposta é `ACESSO_SUSPENSO`, e nada é emitido. */
  readonly suspenso: boolean
}

/** O alcance de quem gera a senha provisória: a coordenação (toda a escola) ou o professor (a turma em que tem vínculo confirmado). */
export type AlcanceDaProvisoria = 'unidade' | 'turma_vinculada'

/** O que a geração precisa saber do aluno travado, depois do escopo: se há credencial, se entra pela conta da escola e se há provisória recente. */
export interface EstadoDaProvisoria {
  /** O aluno tem credencial por matrícula (todo aluno aprovado tem; sem ela não há o que trocar). */
  readonly temCredencial: boolean
  /** O aluno tem a conta da escola ligada: entra por ela, e a senha dele não é tocada. */
  readonly contaLigada: boolean
  /** Há provisória não usada gerada há menos de `JANELA_DO_CONFLITO_DA_SENHA_PROVISORIA_SEGUNDOS`, de qualquer autor. */
  readonly recente: boolean
}

/** A provisória gravada: só a validade. A senha nunca volta do banco. */
export interface ProvisoriaGravada {
  readonly expiraEm: Date
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

  /**
   * Se quem pede alcança o aluno, **sem travar nada** (acesso-e-convites, tarefa 9.0): a primeira conferência da geração, antes do hash, para quem não o alcança não ocupar o
   * semáforo do argon2 nem uma conexão do pool (regra 80, item 5). O escopo é o de `travarAlunoParaProvisoria`, que repete a conferência dentro da transação curta.
   */
  async alcancaAluno(usuarioId: string, alcance: AlcanceDaProvisoria): Promise<boolean> {
    const [achado] = await this.#alunoQueAlcanca(usuarioId, alcance)
    return achado !== undefined
  }

  /**
   * Trava o usuário do aluno (`FOR NO KEY UPDATE`: a mesma trava do "ligar" e da aprovação com conta, que se serializam com a geração) **se**
   * quem pede o alcança, e devolve se o achou (acesso-e-convites, tarefa 9.0; Tech Spec, seção 5, "Senha provisória"). Só dentro da transação curta da gravação, depois do
   * hash: a espera do semáforo nunca acontece com a linha travada. O escopo mora na própria instrução, antes de qualquer outra leitura, e a escola vem do contexto (regra 10, item 3):
   * - o usuário é aluno da escola, ativo e sem eliminação agendada (a suspensão devolve o acesso com a mesma senha, e a provisória a trocaria);
   * - a coordenação (`unidade`) alcança qualquer um deles, com ou sem ano em curso;
   * - o professor (`turma_vinculada`) alcança o aluno com vínculo `confirmado` numa turma do **ano em curso** em que ele, o professor da sessão,
   *   também tem vínculo `confirmado`. Vínculo pendente, contestado ou encerrado do professor, ou o do aluno numa turma antiga (transferido),
   *   não alcança. Sem ano em curso, `requireAnoEmCurso` responde `NAO_ENCONTRADO`.
   * O professor, o coordenador, o aluno de outra escola e o id que não existe dão o mesmo `false`: quem chama responde `NAO_ENCONTRADO` igual.
   * Nunca devolve nome nem matrícula.
   */
  async travarAlunoParaProvisoria(usuarioId: string, alcance: AlcanceDaProvisoria): Promise<boolean> {
    const [travado] = await this.#alunoQueAlcanca(usuarioId, alcance).for('no key update')
    return travado !== undefined
  }

  /** A seleção do aluno do escopo de quem gera, a mesma da leitura e da trava. A coordenação não tem condição de turma (`sql\`true\``, dito, e não um `undefined` que o `and` ignora). */
  #alunoQueAlcanca(usuarioId: string, alcance: AlcanceDaProvisoria) {
    const escolaId = requireEscolaId()
    return this.banco
      .select({ id: usuario.id })
      .from(usuario)
      .where(
        and(
          eq(usuario.escolaId, escolaId),
          eq(usuario.id, usuarioId),
          eq(usuario.papel, 'aluno'),
          isNull(usuario.desativadoEm),
          isNull(usuario.eliminacaoAgendadaEm),
          alcance === 'unidade' ? sql`true` : this.#aTurmaEDoProfessor(usuarioId, escolaId),
        ),
      )
      .limit(1)
  }

  /** Existe turma do ano em curso em que o aluno e o professor da sessão têm vínculo `confirmado`: o `exists` do alcance do professor, nunca um `join` que repita a linha. */
  #aTurmaEDoProfessor(alunoId: string, escolaId: string): SQL {
    const anoLetivoId = requireAnoEmCurso()
    const { usuarioId: professorId } = requestSessao()
    const doAluno = alias(vinculo, 'vinculo_do_aluno')
    const doProfessor = alias(vinculo, 'vinculo_do_professor')
    return exists(
      this.banco
        .select({ um: doAluno.id })
        .from(doAluno)
        .innerJoin(
          doProfessor,
          and(eq(doProfessor.escolaId, doAluno.escolaId), eq(doProfessor.anoLetivoId, doAluno.anoLetivoId), eq(doProfessor.turmaId, doAluno.turmaId)),
        )
        .where(
          and(
            eq(doAluno.escolaId, escolaId),
            eq(doAluno.anoLetivoId, anoLetivoId),
            eq(doAluno.usuarioId, alunoId),
            eq(doAluno.papel, 'aluno'),
            eq(doAluno.estado, 'confirmado'),
            eq(doProfessor.usuarioId, professorId),
            eq(doProfessor.papel, 'professor'),
            eq(doProfessor.estado, 'confirmado'),
          ),
        ),
    )
  }

  /**
   * O estado da credencial do aluno que acabou de ser travado: se ela existe, se a conta da escola está ligada e se há provisória não usada gerada
   * há menos de 10 s (acesso-e-convites, tarefa 9.0). A provisória usada ou vencida e anulada não conta: as três colunas estão nulas. O relógio é o do
   * banco (`clock_timestamp()`, depois da trava): quem esperou a trava enxerga a geração que acabou de terminar. Só chamar depois de
   * `travarAlunoParaProvisoria`. Nunca devolve hash, matrícula nem nome.
   */
  async estadoDaProvisoria(usuarioId: string): Promise<EstadoDaProvisoria> {
    const escolaId = requireEscolaId()
    const [credencial] = await this.banco
      .select({
        recente: sql<boolean>`coalesce(${credencialMatricula.provisoriaExpiraEm} > clock_timestamp() + make_interval(hours => ${VALIDADE_DA_SENHA_PROVISORIA_HORAS}) - make_interval(secs => ${JANELA_DO_CONFLITO_DA_SENHA_PROVISORIA_SEGUNDOS}), false)`,
      })
      .from(credencialMatricula)
      .where(and(eq(credencialMatricula.escolaId, escolaId), eq(credencialMatricula.usuarioId, usuarioId)))
      .limit(1)
    const [ligada] = await this.banco
      .select({ id: contaExterna.id })
      .from(contaExterna)
      .where(and(eq(contaExterna.escolaId, escolaId), eq(contaExterna.usuarioId, usuarioId)))
      .limit(1)
    return { temCredencial: credencial !== undefined, contaLigada: ligada !== undefined, recente: credencial?.recente ?? false }
  }

  /**
   * Grava a provisória no lugar da senha: apaga o `senha_hash` e a provisória anterior (a troca é um `update` só), guarda o hash novo, a validade de 24 h
   * contada do relógio do banco e quem gerou (acesso-e-convites, tarefa 9.0). `undefined` se o aluno não tem credencial. Só chamar com o usuário travado.
   */
  async gravarProvisoria(usuarioId: string, hash: string, geradaPor: string): Promise<ProvisoriaGravada | undefined> {
    const [gravada] = await this.banco
      .update(credencialMatricula)
      .set({
        senhaHash: null,
        provisoriaHash: hash,
        provisoriaExpiraEm: sql`clock_timestamp() + make_interval(hours => ${VALIDADE_DA_SENHA_PROVISORIA_HORAS})`,
        provisoriaGeradaPor: geradaPor,
      })
      .where(and(eq(credencialMatricula.escolaId, requireEscolaId()), eq(credencialMatricula.usuarioId, usuarioId)))
      .returning({ expiraEm: credencialMatricula.provisoriaExpiraEm })
    return gravada?.expiraEm == null ? undefined : { expiraEm: gravada.expiraEm }
  }
}
