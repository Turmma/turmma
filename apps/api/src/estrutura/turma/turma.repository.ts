import { acessoTurma, anoLetivo, requireAnoEmCurso, requireEscolaId, serie, requestSessao, turma, usuario, vinculo, type Database, type DatabaseTransaction } from '@educa/nucleo'
import type { AlunoDaTurma, PaginationQuery, TurmaAbertaResponse, Turma, Turno } from '@educa/shared'
import { and, asc, eq, exists, gt, isNotNull, isNull, not, or, sql, type SQL } from 'drizzle-orm'
import { InvariantException } from '@educa/shared'
import { excluirSemReferencia } from '../exclusao.js'

export interface NovaTurma {
  readonly serieId: string
  readonly nome: string
  readonly turno: Turno | null
}

/** A turma gravada, sem a série, que o service junta. */
export type TurmaGravada = Omit<Turma, 'serie'>

/**
 * Como a turma é alcançada: a coordenação alcança toda turma da escola (`unidade`); o professor, só a turma em que ele
 * tem vínculo `confirmado` (`turma_vinculada`), as células da `MATRIZ` para `turma.ler` e `aluno_da_turma.ler`.
 */
export type AlcanceDaTurma = 'unidade' | 'turma_vinculada'

const colunas = { id: turma.id, anoLetivoId: turma.anoLetivoId, nome: turma.nome, turno: turma.turno }

/**
 * As turmas da escola do contexto no ano letivo em curso dela, e só delas: escola e ano vêm do contexto que a
 * `SessaoGuard` gravou, nunca de argumento (regra 10, itens 2 e 3). Sem ano em curso, `requireAnoEmCurso` falha
 * fechado com `NAO_ENCONTRADO` antes de qualquer consulta.
 *
 * As FKs compostas `(escola_id, serie_id)` e `(escola_id, ano_letivo_id)` são a segunda camada: mesmo que a série de
 * outra escola passasse por aqui, o banco recusaria a turma.
 */
export class TurmaRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /**
   * Confirma que o ano do contexto ainda está em curso e o trava em `FOR SHARE` até o fim da transação. O `update` do
   * encerramento espera a turma nascer, e a turma que chega depois do encerramento relê o ano já `encerrado` e não
   * nasce: o ano encerrado nunca ganha turma nova, nem na corrida (regra 80, item 7).
   */
  async travarAnoEmCurso(): Promise<boolean> {
    const [linha] = await this.banco
      .select({ id: anoLetivo.id })
      .from(anoLetivo)
      .where(and(eq(anoLetivo.escolaId, requireEscolaId()), eq(anoLetivo.id, requireAnoEmCurso()), eq(anoLetivo.situacao, 'em_curso')))
      .for('share')
    return linha !== undefined
  }

  /**
   * Confirma que a turma do ano em curso com esse id existe e a trava em `FOR KEY SHARE` até o fim da transação (A1, 2.0,
   * C9): o `delete` da turma que chega depois espera, e sai `CONFLITO` pelo nome que esta transação gravou; o que já
   * apagou a turma faz esta leitura não achar nada. O renomear não espera: não mexe na chave.
   */
  async travarContraExclusao(id: string): Promise<boolean> {
    const [linha] = await this.banco
      .select({ id: turma.id })
      .from(turma)
      .where(and(eq(turma.escolaId, requireEscolaId()), eq(turma.anoLetivoId, requireAnoEmCurso()), eq(turma.id, id)))
      .for('key share')
    return linha !== undefined
  }

  /**
   * Confirma que a turma do ano em curso com esse id existe e tem vínculo `confirmado` de professor do usuário do contexto
   * (o mesmo `turma_vinculada` de `aberta`), e a trava em `FOR SHARE` até o fim da transação (A1, 4.0; Tech Spec, seção
   * 3). É a trava do gerar acesso: o `FOR UPDATE` do excluir que chega depois espera, e sai `CONFLITO` pelo acesso que
   * esta transação gravou; o excluir que já apagou a turma faz esta leitura não achar nada, e o gerar sai
   * `NAO_ENCONTRADO` em vez de esbarrar na FK (C11). Dois gerar não se esperam aqui: o único por turma decide (C5).
   */
  async travarComVinculoDoProfessor(id: string): Promise<boolean> {
    const daTurmaVinculada = and(eq(turma.escolaId, requireEscolaId()), eq(turma.anoLetivoId, requireAnoEmCurso()), eq(turma.id, id), this.#comVinculoDoProfessor(undefined))
    const [travada] = await this.banco.select({ id: turma.id }).from(turma).where(daTurmaVinculada).for('share')
    if (travada === undefined) return false
    // O vínculo de novo, num comando próprio, depois da trava (correção 2026-10-03-acesso-sobrevive-ao-vinculo): o
    // encerramento do vínculo e a eliminação do professor travam a turma em `FOR NO KEY UPDATE` (`travarContraOGerar`). Se este
    // gerar esperou por eles, a linha da turma não mudou e o Postgres não reconfere o `exists` acima, que ficou com o
    // retrato de antes. Em `READ COMMITTED`, este comando já enxerga o vínculo encerrado ou apagado, e o gerar sai
    // `NAO_ENCONTRADO` em vez de entregar um acesso a quem acabou de sair.
    const [ainda] = await this.banco.select({ id: turma.id }).from(turma).where(daTurmaVinculada)
    return ainda !== undefined
  }

  /**
   * Confirma que a turma do ano em curso com esse id existe e a trava até o fim da transação, num comando próprio: espera
   * o gerar acesso que está no meio (`FOR SHARE`), e o comando seguinte já enxerga o acesso que ele gravou.
   *
   * - O excluir (A1, 4.0, C11) trava em `FOR UPDATE` antes do `delete`: no mesmo comando, o `not exists` leria o retrato
   *   de antes do gerar, e a cascata levaria um acesso que acabou de ser entregue ao professor.
   * - O encerrar do vínculo (correção 2026-10-03-acesso-sobrevive-ao-vinculo) trava em `FOR NO KEY UPDATE` antes de
   *   travar o vínculo e de revogar o acesso de quem saiu: o acesso que o gerar do mesmo professor acabou de gravar cai
   *   junto, e o gerar que chega depois espera e reconfere o vínculo (`travarComVinculoDoProfessor`). O `NO KEY UPDATE`
   *   barra o gerar e deixa passar o `FOR KEY SHARE` das FKs para a turma (o pedido de reivindicação, a lista).
   *
   * **A ordem é sempre a turma, depois o vínculo**, no excluir (a FK do vínculo pede `FOR KEY SHARE` nele no `delete`),
   * no encerrar e na eliminação. Quem travar os dois em outro caminho segue a mesma ordem, ou abre um deadlock.
   */
  async travarContraOGerar(id: string, modo: 'update' | 'no key update'): Promise<boolean> {
    const [linha] = await this.banco
      .select({ id: turma.id })
      .from(turma)
      .where(and(eq(turma.escolaId, requireEscolaId()), eq(turma.anoLetivoId, requireAnoEmCurso()), eq(turma.id, id)))
      .for(modo)
    return linha !== undefined
  }

  async criar(nova: NovaTurma): Promise<TurmaGravada> {
    const [criada] = await this.banco
      .insert(turma)
      .values({ escolaId: requireEscolaId(), anoLetivoId: requireAnoEmCurso(), serieId: nova.serieId, nome: nova.nome, turno: nova.turno })
      .returning(colunas)
    if (criada === undefined) throw new InvariantException('turma não criada')
    return criada
  }

  /**
   * Troca o nome da turma do ano em curso com esse id e devolve a turma renomeada, com o id da série, que o service
   * troca pela série. A de outro ano (encerrado ou planejado), de outra escola ou inexistente não é achada
   * (`undefined`), e nada muda. O nome de outra turma do mesmo ano é barrado pelo mesmo índice único do criar.
   */
  async renomear(id: string, nome: string): Promise<(TurmaGravada & { readonly serieId: string }) | undefined> {
    const [renomeada] = await this.banco
      .update(turma)
      .set({ nome })
      .where(and(eq(turma.escolaId, requireEscolaId()), eq(turma.anoLetivoId, requireAnoEmCurso()), eq(turma.id, id)))
      .returning({ ...colunas, serieId: turma.serieId })
    return renomeada
  }

  /**
   * Apaga a turma do ano em curso com esse id, se nada aponta para ela e ela não tem acesso vigente, e diz se apagou. Com
   * vínculo (qualquer estado) ou com nome na lista (2.0), a FK barra e sai `CONFLITO` (`excluirSemReferencia`); a 6.0
   * soma o pedido. Com acesso vigente (não revogado e não vencido, 4.0), nada é apagado e volta `false`; o revogado e o
   * vencido saem com a turma, pela cascata da FK do `acesso_turma`. A turma de outro ano, de outra escola ou inexistente
   * também volta `false`: quem chama trava a turma antes (`travarContraOGerar`) e separa os dois casos.
   */
  excluir(id: string): Promise<boolean> {
    return excluirSemReferencia(async () => {
      const escolaId = requireEscolaId()
      const anoLetivoId = requireAnoEmCurso()
      const acessoVigente = this.banco
        .select({ um: acessoTurma.id })
        .from(acessoTurma)
        .where(
          and(
            eq(acessoTurma.escolaId, turma.escolaId),
            eq(acessoTurma.anoLetivoId, turma.anoLetivoId),
            eq(acessoTurma.turmaId, turma.id),
            isNull(acessoTurma.revogadoEm),
            gt(acessoTurma.expiraEm, sql`now()`),
          ),
        )
      const apagadas = await this.banco
        .delete(turma)
        .where(and(eq(turma.escolaId, escolaId), eq(turma.anoLetivoId, anoLetivoId), eq(turma.id, id), not(exists(acessoVigente))))
        .returning({ id: turma.id })
      return apagadas.length > 0
    })
  }

  /** Uma página das turmas do ano em curso, com a série, em ordem de criação e uma linha a mais que diz se há próxima. */
  async listar({ pagina, limite }: PaginationQuery): Promise<Turma[]> {
    const escolaId = requireEscolaId()
    const linhas = await this.banco
      .select({ ...colunas, serieId: serie.id, etapa: serie.etapa, ano: serie.ano })
      .from(turma)
      .innerJoin(serie, and(eq(serie.escolaId, turma.escolaId), eq(serie.id, turma.serieId)))
      .where(and(eq(turma.escolaId, escolaId), eq(turma.anoLetivoId, requireAnoEmCurso()), pagina === undefined ? undefined : gt(turma.id, pagina)))
      .orderBy(asc(turma.id))
      .limit(limite + 1)
    return linhas.map(({ serieId, etapa, ano, ...resto }) => ({ ...resto, serie: { id: serieId, etapa, ano } }))
  }

  /**
   * A turma com esse id no ano da leitura, se quem pede a alcança; senão, nada, e o service responde como inexistente
   * (regra 10, itens 4 e 6).
   *
   * - Sem `anoEncerrado`, o ano da leitura é o em curso do contexto.
   * - Com `anoEncerrado` (o `?anoLetivoId` do cliente, 10.0, RF16), a turma precisa ser desse ano, e o ano precisa ser
   *   da escola do contexto e estar `encerrado`. O ano em curso, o planejado, o de outra escola e o inexistente não
   *   acham nada. O filtro vem do cliente e só restringe: a escola continua vindo do contexto.
   *
   * Com `turma_vinculada`, a turma só aparece se existir vínculo de professor do usuário do contexto nela, lido a cada
   * requisição, sem cache (RF5): no ano em curso, `confirmado`; no ano encerrado, também o que chegou confirmado ao fim
   * do ano (`#confirmadoAteOFimDoAno`). O vínculo é da turma (mesma escola e mesmo ano, pela correlação), e o usuário vem
   * do contexto, nunca de argumento.
   */
  async aberta(id: string, alcance: AlcanceDaTurma, anoEncerrado?: string): Promise<TurmaAbertaResponse | undefined> {
    const [linha] = await this.banco
      .select({ id: turma.id, nome: turma.nome, serieId: serie.id, etapa: serie.etapa, ano: serie.ano })
      .from(turma)
      .innerJoin(serie, and(eq(serie.escolaId, turma.escolaId), eq(serie.id, turma.serieId)))
      .where(
        and(
          eq(turma.escolaId, requireEscolaId()),
          this.#doAnoDaLeitura(anoEncerrado),
          eq(turma.id, id),
          alcance === 'unidade' ? undefined : this.#comVinculoDoProfessor(anoEncerrado),
        ),
      )
    if (linha === undefined) return undefined
    const { serieId, etapa, ano, ...resto } = linha
    return { ...resto, serie: { id: serieId, etapa, ano } }
  }

  /** A turma do ano em curso, ou do ano pedido, se ele for da escola da turma e estiver `encerrado`. */
  #doAnoDaLeitura(anoEncerrado: string | undefined): SQL | undefined {
    if (anoEncerrado === undefined) return eq(turma.anoLetivoId, requireAnoEmCurso())
    return and(
      eq(turma.anoLetivoId, anoEncerrado),
      exists(
        this.banco
          .select({ um: anoLetivo.id })
          .from(anoLetivo)
          .where(and(eq(anoLetivo.escolaId, turma.escolaId), eq(anoLetivo.id, turma.anoLetivoId), eq(anoLetivo.situacao, 'encerrado'))),
      ),
    )
  }

  #comVinculoDoProfessor(anoEncerrado: string | undefined) {
    const { usuarioId } = requestSessao()
    return exists(
      this.banco
        .select({ um: vinculo.id })
        .from(vinculo)
        .where(
          and(
            eq(vinculo.escolaId, turma.escolaId),
            eq(vinculo.anoLetivoId, turma.anoLetivoId),
            eq(vinculo.turmaId, turma.id),
            eq(vinculo.usuarioId, usuarioId),
            eq(vinculo.papel, 'professor'),
            anoEncerrado === undefined ? eq(vinculo.estado, 'confirmado') : TurmaRepository.#confirmadoAteOFimDoAno(),
          ),
        ),
    )
  }

  /**
   * O vínculo que valia quando o ano acabou: `confirmado`, ou encerrado pela virada (`fim_do_ano`) depois de ter sido
   * confirmado. A virada leva também o pendente e o contestado a `fim_do_ano`, e eles nunca deram acesso: o pendente
   * não tem `decidido_em`, e o contestado guarda o código da contestação (confirmar apaga o código). Encerrado por
   * `desligamento` ou `realocacao` não vale: quem saiu não lê (RF16).
   */
  static #confirmadoAteOFimDoAno(): SQL | undefined {
    return or(
      eq(vinculo.estado, 'confirmado'),
      and(eq(vinculo.estado, 'encerrado'), eq(vinculo.motivoEncerramento, 'fim_do_ano'), isNotNull(vinculo.decididoEm), isNull(vinculo.contestacao)),
    )
  }

  /**
   * Uma página dos alunos da turma no ano da leitura (o em curso, ou o `anoEncerrado` que `aberta` já conferiu): quem
   * tem vínculo de aluno válido nela e está ativo, em ordem de `usuarioId`, com uma linha a mais que diz se há próxima.
   * Só id e nome (regra 20, item 4). No ano em curso, o vínculo `confirmado`; no encerrado, o que chegou confirmado ao
   * fim do ano, e não o transferido no meio dele. Não confere quem pede: o service chama depois de `aberta`.
   */
  alunos(turmaId: string, { pagina, limite }: PaginationQuery, anoEncerrado?: string): Promise<AlunoDaTurma[]> {
    return this.banco
      .selectDistinct({ usuarioId: usuario.id, nome: usuario.nome })
      .from(vinculo)
      .innerJoin(usuario, and(eq(usuario.escolaId, vinculo.escolaId), eq(usuario.id, vinculo.usuarioId)))
      .where(
        and(
          eq(vinculo.escolaId, requireEscolaId()),
          eq(vinculo.anoLetivoId, anoEncerrado ?? requireAnoEmCurso()),
          eq(vinculo.turmaId, turmaId),
          eq(vinculo.papel, 'aluno'),
          anoEncerrado === undefined ? eq(vinculo.estado, 'confirmado') : TurmaRepository.#confirmadoAteOFimDoAno(),
          isNull(usuario.desativadoEm),
          pagina === undefined ? undefined : gt(usuario.id, pagina),
        ),
      )
      .orderBy(asc(usuario.id))
      .limit(limite + 1)
  }
}
