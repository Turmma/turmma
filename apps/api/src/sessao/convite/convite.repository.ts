import { CANCELAR_O_ENVIO_DO_CONVITE, CHAVE_DA_TRAVA_DO_CONVITE_DA_ESCOLA, conta, convite, ConviteDaEscolaRepository, escola, requireEscolaId, usuario, type Database, type DatabaseTransaction, type DadosDaCoordenacao, type DadosDoProfessor, type TipoDeConvite, type UltimoConviteDoProfessor } from '@educa/core'
import { and, asc, desc, eq, exists, gte, inArray, isNotNull, isNull, sql } from 'drizzle-orm'

/** A chave da trava do convite da escola mora no core (a 6.0 a subiu com o resto que o job da planilha usa); a API a reexporta para os testes. */
export { CHAVE_DA_TRAVA_DO_CONVITE_DA_ESCOLA }

/**
 * O convite e o usuário convidado dentro da escola do contexto (tarefa 7.0). O que atravessa escolas (achar o convite
 * pelo hash do token, a conta global) fica na resolução de tenant; aqui tudo leva a escola do contexto.
 */
export class ConviteRepository extends ConviteDaEscolaRepository {
  /** O banco é o da base; declarado aqui de novo para a guarda de escopo dos repositories (`escopo-dos-repositories.ts`) o enxergar nesta classe. */
  constructor(protected override readonly banco: Database | DatabaseTransaction) {
    super(banco)
  }

  /** O nome da escola do contexto, que o `consultar` mostra. */
  async nomeDaEscola(): Promise<string | undefined> {
    const [linha] = await this.banco.select({ nome: escola.nome }).from(escola).where(eq(escola.id, requireEscolaId())).limit(1)
    return linha?.nome
  }

  /**
   * O que decide o estado da coordenação da escola do contexto (`estadoDaCoordenacao`): se há coordenador ativo, o
   * último convite de coordenação (maior `expira_em`, depois maior `id`) com o `desativado_em` do usuário dele, e a
   * hora do banco. Só convite `tipo = 'coordenador'`. Escola inexistente: `undefined`.
   */
  async dadosDaCoordenacao(): Promise<DadosDaCoordenacao | undefined> {
    const escolaId = requireEscolaId()
    const coordenadorAtivo = this.banco
      .select({ um: sql`1` })
      .from(usuario)
      .where(and(eq(usuario.escolaId, escolaId), eq(usuario.papel, 'coordenador'), isNull(usuario.desativadoEm)))
    const [daEscola] = await this.banco
      .select({ coordenadorAtivo: sql<boolean>`exists(${coordenadorAtivo})`, agora: sql<Date>`now()`.mapWith(convite.expiraEm) })
      .from(escola)
      .where(eq(escola.id, escolaId))
    if (daEscola === undefined) return undefined
    const [ultimoConvite] = await this.banco
      .select({ id: convite.id, expiraEm: convite.expiraEm, usadoEm: convite.usadoEm, revogadoEm: convite.revogadoEm, usuarioDesativadoEm: usuario.desativadoEm })
      .from(convite)
      .innerJoin(usuario, and(eq(usuario.escolaId, convite.escolaId), eq(usuario.id, convite.usuarioId)))
      .where(and(eq(convite.escolaId, escolaId), eq(convite.tipo, 'coordenador')))
      .orderBy(desc(convite.expiraEm), desc(convite.id))
      .limit(1)
    return { coordenadorAtivo: daEscola.coordenadorAtivo, ultimoConvite, agora: daEscola.agora }
  }

  /** Se o convite desta escola já foi revogado; `undefined` quando não há convite de coordenação com esse id nela. */
  async revogado(conviteId: string): Promise<boolean | undefined> {
    const [linha] = await this.banco
      .select({ revogadoEm: convite.revogadoEm })
      .from(convite)
      .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.id, conviteId), eq(convite.tipo, 'coordenador')))
      .limit(1)
    return linha === undefined ? undefined : linha.revogadoEm !== null
  }

  /**
   * Ativa o usuário pelo convite aceito, uma vez só: só se ele está inativo e o convite dele foi usado, não foi revogado
   * e foi aceito depois de o usuário ficar inativo. Dois logins ao mesmo tempo ativam uma vez, e o convite revogado
   * entre a leitura e aqui não ativa ninguém. O prazo depois do aceite é o do bilhete, conferido antes. Devolve se
   * ativou.
   */
  async ativarPorConvite(usuarioId: string, conviteId: string): Promise<boolean> {
    const escolaId = requireEscolaId()
    const conviteAceito = this.banco
      .select({ um: sql`1` })
      .from(convite)
      .where(
        and(
          eq(convite.escolaId, escolaId),
          eq(convite.id, conviteId),
          eq(convite.usuarioId, usuario.id),
          isNotNull(convite.usadoEm),
          isNull(convite.revogadoEm),
          gte(convite.usadoEm, usuario.desativadoEm),
        ),
      )
    const ativados = await this.banco
      .update(usuario)
      .set({ desativadoEm: null })
      .where(and(eq(usuario.escolaId, escolaId), eq(usuario.id, usuarioId), isNotNull(usuario.desativadoEm), exists(conviteAceito)))
      .returning({ id: usuario.id })
    return ativados.length === 1
  }

  /**
   * Revoga o convite desta escola para o refazer, só se ele ainda está em aberto (não usado e não revogado; vencido
   * também) e é do tipo pedido, e devolve o usuário dele, para o convite novo; `undefined` quando não revogou. O `update`
   * espera a linha de quem a mexe ao mesmo tempo e confere as condições de novo depois: dois refazer, ou o refazer e o
   * aceite, revogam no máximo uma vez, e só o que ainda estava em aberto (Tech Spec da A0b, seção 7c). O `tipo` no
   * `where` é a segunda camada de quem chama: o operador já achou a escola por um convite `coordenador`, e a coordenação
   * da escola já achou o último convite `professor` do usuário (I7).
   */
  async revogarParaRefazer(conviteId: string, tipo: TipoDeConvite): Promise<string | undefined> {
    const [revogado] = await this.banco
      .update(convite)
      .set({ revogadoEm: sql`now()`, ...CANCELAR_O_ENVIO_DO_CONVITE })
      .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.id, conviteId), eq(convite.tipo, tipo), isNull(convite.usadoEm), isNull(convite.revogadoEm)))
      .returning({ usuarioId: convite.usuarioId })
    return revogado?.usuarioId
  }

  /** Revoga o convite do tipo pedido, usado ou não, se ainda não foi revogado. Devolve se revogou. */
  async revogar(conviteId: string, tipo: TipoDeConvite): Promise<boolean> {
    const revogados = await this.banco
      .update(convite)
      .set({ revogadoEm: sql`now()`, ...CANCELAR_O_ENVIO_DO_CONVITE })
      .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.id, conviteId), eq(convite.tipo, tipo), isNull(convite.revogadoEm)))
      .returning({ id: convite.id })
    return revogados.length === 1
  }

  /**
   * O que decide o estado do professor (`estadoDoProfessor`) para o refazer e o revogar da coordenação (A1, tarefa 3.0):
   * o `desativado_em` do usuário **professor** desta escola, o último convite `tipo = 'professor'` dele (maior
   * `expira_em`, depois maior `id`) e a hora do banco. Usuário de outro papel, de outra escola, inexistente, ou professor
   * sem convite de professor nenhum: `undefined`, a resposta do inexistente (I7). O `tipo` e o papel ficam no `where`.
   */
  async dadosDoProfessor(usuarioId: string): Promise<(DadosDoProfessor & { readonly ultimoConvite: NonNullable<DadosDoProfessor['ultimoConvite']> }) | undefined> {
    const escolaId = requireEscolaId()
    const [linha] = await this.banco
      .select({
        id: convite.id,
        expiraEm: convite.expiraEm,
        usadoEm: convite.usadoEm,
        revogadoEm: convite.revogadoEm,
        desativadoEm: usuario.desativadoEm,
        agora: sql<Date>`now()`.mapWith(convite.expiraEm),
      })
      .from(convite)
      .innerJoin(usuario, and(eq(usuario.escolaId, convite.escolaId), eq(usuario.id, convite.usuarioId)))
      .where(and(eq(convite.escolaId, escolaId), eq(convite.usuarioId, usuarioId), eq(convite.tipo, 'professor'), eq(usuario.papel, 'professor')))
      .orderBy(desc(convite.expiraEm), desc(convite.id))
      .limit(1)
    if (linha === undefined) return undefined
    const { desativadoEm, agora, ...ultimoConvite } = linha
    return { desativadoEm, ultimoConvite, agora }
  }

  /**
   * Os professores da escola do contexto que o "Enviar convites" pode alcançar (acesso-e-convites, tarefa 3.0), todos ou só os `usuarioIds` pedidos, em ordem de id: o
   * que decide o estado (`estadoDoProfessor`: o `desativado_em`, o último convite de professor e a hora do banco) e o endereço da conta, para a cifra do envio.
   * A conta entra só pelo `usuario.conta_id` da escola: id de professor de outra escola, de outro papel ou inexistente não volta, e o `where` leva o escopo nas duas
   * consultas (regra 10, item 3). O endereço nunca sai daqui para uma resposta, e sem conta (a conta já foi limpa) vem `null`.
   */
  async professoresParaEnvio(usuarioIds?: readonly string[]): Promise<ProfessorParaEnvio[]> {
    const escolaId = requireEscolaId()
    const professores = await this.banco
      .select({ usuarioId: usuario.id, email: conta.email, desativadoEm: usuario.desativadoEm, agora: sql<Date>`now()`.mapWith(usuario.desativadoEm) })
      .from(usuario)
      .leftJoin(conta, eq(conta.id, usuario.contaId))
      .where(and(eq(usuario.escolaId, escolaId), eq(usuario.papel, 'professor'), usuarioIds === undefined ? undefined : inArray(usuario.id, [...usuarioIds])))
      .orderBy(asc(usuario.id))
    if (professores.length === 0) return []
    const convites = await this.banco
      .select({ usuarioId: convite.usuarioId, id: convite.id, expiraEm: convite.expiraEm, usadoEm: convite.usadoEm, revogadoEm: convite.revogadoEm })
      .from(convite)
      .where(
        and(
          eq(convite.escolaId, escolaId),
          eq(convite.tipo, 'professor'),
          inArray(
            convite.usuarioId,
            professores.map((professor) => professor.usuarioId),
          ),
        ),
      )
      .orderBy(asc(convite.usuarioId), desc(convite.expiraEm), desc(convite.id))
    const ultimo = new Map<string, UltimoConviteDoProfessor>()
    for (const { usuarioId, ...lido } of convites) if (!ultimo.has(usuarioId)) ultimo.set(usuarioId, lido)
    return professores.map(({ usuarioId, email, desativadoEm, agora }) => ({ usuarioId, email, dados: { desativadoEm, agora, ultimoConvite: ultimo.get(usuarioId) } }))
  }
}

/** Um professor que o "Enviar convites" pode alcançar: o usuário, o endereço da conta (para a cifra, nunca para a resposta) e o que decide o estado dele. */
export interface ProfessorParaEnvio {
  readonly usuarioId: string
  readonly email: string | null
  readonly dados: DadosDoProfessor
}
