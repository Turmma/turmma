import {
  convite,
  disciplina,
  estadoDoProfessor,
  requireAnoEmCurso,
  requireEscolaId,
  requestSessao,
  turma,
  usuario,
  vinculo,
  type Database,
  type DatabaseTransaction,
} from '@educa/nucleo'
import {
  InvariantException,
  ESTADOS_DO_PROFESSOR_ALOCAVEIS,
  type PaginationQuery,
  type ContestacaoDeVinculo,
  type EstadoDeVinculo,
  type EstadoDoProfessor,
  type MotivoDeEncerramentoDeVinculo,
  type PapelDeVinculo,
} from '@educa/shared'
import { and, asc, desc, eq, gt, inArray, isNotNull, ne, sql, type SQL } from 'drizzle-orm'

export interface NovoVinculo {
  readonly usuarioId: string
  readonly turmaId: string
  readonly disciplinaId: string | null
  readonly papel: PapelDeVinculo
}

/** O vínculo lido com o nome da turma e da disciplina, do jeito que os dois DTOs precisam. */
export interface VinculoLido {
  readonly id: string
  readonly usuarioId: string
  readonly papel: PapelDeVinculo
  readonly turma: { readonly id: string; readonly nome: string }
  readonly disciplina: { readonly id: string; readonly nome: string } | null
  readonly estado: EstadoDeVinculo
  readonly contestacao: ContestacaoDeVinculo | null
  readonly complemento: string | null
  readonly motivoEncerramento: MotivoDeEncerramentoDeVinculo | null
  readonly decididoEm: Date | null
}

/**
 * O que o professor decide. Confirmar apaga o código e o complemento de uma contestação anterior: ela deixou de valer, e
 * o texto livre não fica guardado sem motivo (regra 20).
 */
export type Decisao =
  | { readonly estado: 'confirmado' }
  | { readonly estado: 'contestado'; readonly contestacao: ContestacaoDeVinculo; readonly complemento: string | null }

const colunas = {
  id: vinculo.id,
  usuarioId: vinculo.usuarioId,
  papel: vinculo.papel,
  turmaId: turma.id,
  turmaNome: turma.nome,
  disciplinaId: disciplina.id,
  disciplinaNome: disciplina.nome,
  estado: vinculo.estado,
  contestacao: vinculo.contestacao,
  complemento: vinculo.complemento,
  motivoEncerramento: vinculo.motivoEncerramento,
  decididoEm: vinculo.decididoEm,
}

/**
 * Os vínculos da escola do contexto no ano letivo em curso dela, e só deles: escola, ano e, para o professor, o próprio
 * usuário vêm do contexto que a `SessaoGuard` gravou, nunca de argumento (regra 10, itens 2 e 3). Sem ano em curso,
 * `requireAnoEmCurso` falha fechado com `NAO_ENCONTRADO` antes de qualquer consulta (Tech Spec, seção 5).
 *
 * As FKs compostas são a segunda camada: o vínculo nunca aponta para a turma, o usuário ou a disciplina de outra escola,
 * nem para a turma de outro ano.
 */
export class VinculoRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /** O vínculo nasce `pendente`, com `criado_por` do contexto. O repetido fora do `encerrado` é barrado pelo índice único. */
  async criar(novo: NovoVinculo): Promise<string> {
    const { usuarioId: criadoPor } = requestSessao()
    const [criado] = await this.banco
      .insert(vinculo)
      .values({
        escolaId: requireEscolaId(),
        anoLetivoId: requireAnoEmCurso(),
        usuarioId: novo.usuarioId,
        turmaId: novo.turmaId,
        disciplinaId: novo.disciplinaId,
        papel: novo.papel,
        estado: 'pendente',
        criadoPor,
      })
      .returning({ id: vinculo.id })
    if (criado === undefined) throw new InvariantException('vínculo não criado')
    return criado.id
  }

  /**
   * O vínculo de aluno que a aprovação da reivindicação cria (A1, 8.0, RF13): nasce `confirmado`, com `decidido_em` da
   * decisão, sem disciplina, e com quem aprovou em `criado_por`. Com o `decidido_em`, o aluno continua na lista de alunos
   * da turma depois da virada do ano (E19; `TODO.md`).
   */
  async criarAlunoConfirmado(usuarioId: string, turmaId: string): Promise<void> {
    await this.banco.insert(vinculo).values({
      escolaId: requireEscolaId(),
      anoLetivoId: requireAnoEmCurso(),
      usuarioId,
      turmaId,
      disciplinaId: null,
      papel: 'aluno',
      estado: 'confirmado',
      criadoPor: requestSessao().usuarioId,
      decididoEm: sql`now()`,
    })
  }

  /**
   * Se a coordenação pode alocar este usuário numa turma (A1, 13.0, decidido pelo Joaquim em 27/09/2026): um `professor`
   * da escola do contexto cujo estado, por `estadoDoProfessor` (a mesma função da lista da coordenação e do refazer e do
   * revogar), está em `ESTADOS_DO_PROFESSOR_ALOCAVEIS` — o convite em aberto e dentro do prazo, o `aceito` e o `ativo`.
   * O estado sai do `desativado_em` do usuário e do último convite `tipo = 'professor'` dele na escola (maior `expira_em`,
   * depois maior `id`, a ordem de `ConviteRepository.dadosDoProfessor`), com a hora do banco.
   *
   * O usuário de outra escola, o que não é professor, o inexistente, e o professor `vencido`, `revogado` ou `desativado`
   * dão `false`, e o serviço responde `NAO_ENCONTRADO` igual para todos (regra 10, item 6). A escola vem do contexto nas
   * duas consultas; na do convite ela é segunda camada, porque a FK composta já prende o convite à escola do usuário.
   */
  async professorAlocavel(usuarioId: string): Promise<boolean> {
    const escolaId = requireEscolaId()
    const [professor] = await this.banco
      .select({ desativadoEm: usuario.desativadoEm, agora: sql<Date>`now()`.mapWith(usuario.desativadoEm) })
      .from(usuario)
      .where(and(eq(usuario.escolaId, escolaId), eq(usuario.id, usuarioId), eq(usuario.papel, 'professor')))
    if (professor === undefined) return false
    const [ultimoConvite] = await this.banco
      .select({ id: convite.id, expiraEm: convite.expiraEm, usadoEm: convite.usadoEm, revogadoEm: convite.revogadoEm })
      .from(convite)
      .where(and(eq(convite.escolaId, escolaId), eq(convite.usuarioId, usuarioId), eq(convite.tipo, 'professor')))
      .orderBy(desc(convite.expiraEm), desc(convite.id))
      .limit(1)
    const estado = estadoDoProfessor({ desativadoEm: professor.desativadoEm, ultimoConvite, agora: professor.agora })
    return (ESTADOS_DO_PROFESSOR_ALOCAVEIS as readonly EstadoDoProfessor[]).includes(estado)
  }

  /** Uma página dos vínculos do ano, do estado pedido ou de todos, em ordem de criação, com uma linha a mais. */
  listar({ pagina, limite, estado }: PaginationQuery & { readonly estado?: EstadoDeVinculo | undefined }): Promise<VinculoLido[]> {
    return this.#lerComReferencias(
      and(estado === undefined ? undefined : eq(vinculo.estado, estado), pagina === undefined ? undefined : gt(vinculo.id, pagina)),
      limite + 1,
    )
  }

  /** Uma página dos vínculos do usuário do contexto no ano, em ordem de criação, com uma linha a mais. */
  listarDoUsuario({ pagina, limite }: PaginationQuery): Promise<VinculoLido[]> {
    return this.#lerComReferencias(and(this.#doUsuario(), pagina === undefined ? undefined : gt(vinculo.id, pagina)), limite + 1)
  }

  async porId(id: string): Promise<VinculoLido | undefined> {
    const [linha] = await this.#lerComReferencias(eq(vinculo.id, id), 1)
    return linha
  }

  async porIdDoUsuario(id: string): Promise<VinculoLido | undefined> {
    const [linha] = await this.#lerComReferencias(and(eq(vinculo.id, id), this.#doUsuario()), 1)
    return linha
  }

  /**
   * A turma do vínculo, sem trava: o encerrar a lê para travar a turma antes do vínculo (a ordem turma → vínculo, a mesma
   * do excluir e da eliminação; correção 2026-10-03-acesso-sobrevive-ao-vinculo). A turma de um vínculo não muda; o
   * estado é relido depois, com a trava (`travar`).
   */
  async turmaDe(id: string): Promise<string | undefined> {
    const [linha] = await this.banco.select({ turmaId: vinculo.turmaId }).from(vinculo).where(and(this.#escopo(), eq(vinculo.id, id)))
    return linha?.turmaId
  }

  /**
   * O estado do vínculo, travado em `FOR UPDATE` até o fim da transação: o segundo clique espera o primeiro e relê o
   * estado já mudado (regra 80, item 7). `doUsuario` restringe ao vínculo do usuário do contexto (o professor dono).
   * Devolve também de quem é e a turma, que o encerramento usa para revogar o acesso de quem saiu.
   */
  async travar(
    id: string,
    { doUsuario }: { readonly doUsuario: boolean },
  ): Promise<{ readonly estado: EstadoDeVinculo; readonly usuarioId: string; readonly turmaId: string } | undefined> {
    const [linha] = await this.banco
      .select({ estado: vinculo.estado, usuarioId: vinculo.usuarioId, turmaId: vinculo.turmaId })
      .from(vinculo)
      .where(and(this.#escopo(), eq(vinculo.id, id), doUsuario ? this.#doUsuario() : undefined))
      .for('update')
    return linha
  }

  /**
   * `update … where id and usuario_id = ctx and estado in ('pendente', 'contestado')` (Tech Spec, seção 5, "Vínculo"):
   * só o dono decide, e só de um estado em decisão. Devolve se mudou.
   */
  async decidir(id: string, decisao: Decisao): Promise<boolean> {
    const mudados = await this.banco
      .update(vinculo)
      .set(
        decisao.estado === 'confirmado'
          ? { estado: 'confirmado', contestacao: null, complemento: null, decididoEm: sql`now()` }
          : { estado: 'contestado', contestacao: decisao.contestacao, complemento: decisao.complemento, decididoEm: sql`now()` },
      )
      .where(and(this.#escopo(), eq(vinculo.id, id), this.#doUsuario(), inArray(vinculo.estado, ['pendente', 'contestado'])))
      .returning({ id: vinculo.id })
    return mudados.length === 1
  }

  /** Encerra o vínculo que ainda não está encerrado. Devolve se mudou. */
  async encerrar(id: string, motivo: MotivoDeEncerramentoDeVinculo): Promise<boolean> {
    const mudados = await this.banco
      .update(vinculo)
      .set({ estado: 'encerrado', motivoEncerramento: motivo, encerradoEm: sql`now()` })
      .where(and(this.#escopo(), eq(vinculo.id, id), ne(vinculo.estado, 'encerrado')))
      .returning({ id: vinculo.id })
    return mudados.length === 1
  }

  /**
   * A virada do ano (10.0; Tech Spec, seção 5, "Vínculo"): os vínculos do ano, de professor e de aluno, que não estavam
   * encerrados vão a `encerrado` por `fim_do_ano`; depois, o `complemento` sai de todo vínculo do ano, inclusive do
   * encerrado antes por `desligamento` ou `realocacao`. Roda na transação do encerramento do ano, e devolve as contagens
   * para a auditoria.
   *
   * O ano é o que o `AnoLetivoRepository` acabou de passar a `encerrado` na mesma transação, com a escola do contexto,
   * nunca o id do cliente. A escola vem do contexto aqui também: um ano de outra escola não acha vínculo nenhum.
   */
  async virarAno(anoLetivoId: string): Promise<{ readonly vinculosEncerrados: number; readonly textosDeContestacaoApagados: number }> {
    const doAno = and(eq(vinculo.escolaId, requireEscolaId()), eq(vinculo.anoLetivoId, anoLetivoId))
    const encerrados = await this.banco
      .update(vinculo)
      .set({ estado: 'encerrado', motivoEncerramento: 'fim_do_ano', encerradoEm: sql`now()` })
      .where(and(doAno, ne(vinculo.estado, 'encerrado')))
      .returning({ id: vinculo.id })
    const apagados = await this.banco
      .update(vinculo)
      .set({ complemento: null })
      .where(and(doAno, isNotNull(vinculo.complemento)))
      .returning({ id: vinculo.id })
    return { vinculosEncerrados: encerrados.length, textosDeContestacaoApagados: apagados.length }
  }

  /**
   * Escola e ano do contexto, e só vínculo de professor: é o que a coordenação aloca e corrige, e o que o professor
   * confirma. O vínculo de aluno (do seed no F1, da lista no F2) não aparece na lista da coordenação e responde como
   * inexistente nas rotas de vínculo (10.4, decidido em 18/09/2026).
   */
  #escopo(): SQL | undefined {
    return and(eq(vinculo.escolaId, requireEscolaId()), eq(vinculo.anoLetivoId, requireAnoEmCurso()), eq(vinculo.papel, 'professor'))
  }

  #doUsuario(): SQL {
    return eq(vinculo.usuarioId, requestSessao().usuarioId)
  }

  async #lerComReferencias(filtro: SQL | undefined, limite: number): Promise<VinculoLido[]> {
    const linhas = await this.banco
      .select(colunas)
      .from(vinculo)
      .innerJoin(turma, and(eq(turma.escolaId, vinculo.escolaId), eq(turma.anoLetivoId, vinculo.anoLetivoId), eq(turma.id, vinculo.turmaId)))
      .leftJoin(disciplina, and(eq(disciplina.escolaId, vinculo.escolaId), eq(disciplina.id, vinculo.disciplinaId)))
      .where(and(this.#escopo(), filtro))
      .orderBy(asc(vinculo.id))
      .limit(limite)
    return linhas.map(({ turmaId, turmaNome, disciplinaId, disciplinaNome, ...resto }) => ({
      ...resto,
      turma: { id: turmaId, nome: turmaNome },
      disciplina: disciplinaId === null || disciplinaNome === null ? null : { id: disciplinaId, nome: disciplinaNome },
    }))
  }
}
