import { convite, ErroDeDominio, erroDoPostgresEm, escola, exigirEscolaDoContexto, usuario, type Banco, type DadosDaCoordenacao, type DadosDoProfessor, type TipoDeConvite, type TransacaoBanco } from '@educa/nucleo'
import { ErrorCode, InvariantException } from '@educa/shared'
import { and, desc, eq, exists, gte, isNotNull, isNull, sql } from 'drizzle-orm'

/**
 * A primeira metade da chave do `pg_advisory_xact_lock` que põe em fila, por escola, o que mexe no convite da coordenação
 * dela (Tech Spec da A0b, seção 7c, "Convite da escola" e "Ativação por convite"): gerar, refazer e revogar pelo painel e
 * pelo `ops:*`, e a ativação pelo convite (o aceite, e o login com o bilhete, com ou sem MFA). O convite do professor usa a
 * mesma trava (A1, tarefa 3.0): cadastrar, refazer e revogar pela coordenação da escola. A segunda
 * metade é `hashtext` do id da escola, e escolas diferentes não esperam uma pela outra. As outras chaves do código são
 * 7_000_001 (migração) e 7_000_002 (operadores).
 */
export const CHAVE_DA_TRAVA_DO_CONVITE_DA_ESCOLA = 7_000_003

/**
 * O convite e o usuário convidado dentro da escola do contexto (tarefa 7.0). O que atravessa escolas (achar o convite
 * pelo hash do token, a conta global) fica na resolução de tenant; aqui tudo leva a escola do contexto.
 */
export class ConviteRepository {
  constructor(private readonly banco: Banco | TransacaoBanco) {}

  /** O nome da escola do contexto, que o `consultar` mostra. */
  async nomeDaEscola(): Promise<string | undefined> {
    const [linha] = await this.banco.select({ nome: escola.nome }).from(escola).where(eq(escola.id, exigirEscolaDoContexto())).limit(1)
    return linha?.nome
  }

  /**
   * O usuário convidado, com o papel do convite (o coordenador, pelo operador; o professor, pela coordenação da escola,
   * A1), inativo até o aceite (`desativado_em = now()`). Se a conta já tem usuário inativo desse papel nesta escola
   * (convite revogado ou aceito sem a primeira entrada, ou usuário desativado que a escola chama de volta), ele volta a
   * esperar o convite novo, com `desativado_em` de agora e o nome digitado agora: revogar e gerar (ou cadastrar de novo)
   * com o mesmo e-mail é como se corrige o nome (Tech Spec da A0b, seção 5). O `desativado_em` novo, posterior ao aceite
   * antigo, faz o convite antigo já usado deixar de ativar. Se o usuário está ativo, não devolve nada e não muda nada, nem
   * o nome: não há o que convidar.
   */
  async usuarioConvidado(contaId: string, nome: string, papel: TipoDeConvite): Promise<string | undefined> {
    const [linha] = await this.banco
      .insert(usuario)
      .values({ escolaId: exigirEscolaDoContexto(), contaId, papel, nome, desativadoEm: sql`now()` })
      .onConflictDoUpdate({
        target: [usuario.escolaId, usuario.contaId, usuario.papel],
        set: { desativadoEm: sql`now()`, nome },
        setWhere: isNotNull(usuario.desativadoEm),
      })
      .returning({ id: usuario.id })
    return linha?.id
  }

  /**
   * Grava o convite do tipo pedido. Se o usuário já tem convite em aberto nesta escola, o índice
   * `convite_pendente_unico` recusa, e a recusa sai como `CONFLITO`: é a rede de segurança da trava da escola.
   */
  async criarConvite(dados: { tipo: TipoDeConvite; tokenHash: string; usuarioId: string; expiraEm: Date }): Promise<string> {
    let criado: { id: string } | undefined
    try {
      ;[criado] = await this.banco
        .insert(convite)
        .values({ escolaId: exigirEscolaDoContexto(), tokenHash: dados.tokenHash, tipo: dados.tipo, usuarioId: dados.usuarioId, expiraEm: dados.expiraEm })
        .returning({ id: convite.id })
    } catch (erro) {
      const doPostgres = erroDoPostgresEm(erro)
      if (doPostgres?.code === '23505' && doPostgres.constraint === 'convite_pendente_unico') throw new ErroDeDominio(ErrorCode.CONFLITO)
      throw erro
    }
    if (criado === undefined) throw new InvariantException('convite não devolvido pelo insert')
    return criado.id
  }

  /**
   * Põe a transação na fila da trava do convite da escola do contexto (`pg_advisory_xact_lock(7_000_003,
   * hashtext(escola_id::text))`); solta sozinha no commit ou no rollback. Quem gera, refaz ou revoga pega a trava antes
   * de ler o estado da coordenação, e quem ativa pelo convite a pega como primeira instrução da transação: dois pedidos
   * na mesma escola decidem um depois do outro, cada um vendo o que o anterior gravou.
   */
  async travarEscola(): Promise<void> {
    await this.banco.execute(sql`select pg_advisory_xact_lock(${CHAVE_DA_TRAVA_DO_CONVITE_DA_ESCOLA}, hashtext(${exigirEscolaDoContexto()}::uuid::text))`)
  }

  /**
   * O que decide o estado da coordenação da escola do contexto (`estadoDaCoordenacao`): se há coordenador ativo, o
   * último convite de coordenação (maior `expira_em`, depois maior `id`) com o `desativado_em` do usuário dele, e a
   * hora do banco. Só convite `tipo = 'coordenador'`. Escola inexistente: `undefined`.
   */
  async dadosDaCoordenacao(): Promise<DadosDaCoordenacao | undefined> {
    const escolaId = exigirEscolaDoContexto()
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
      .where(and(eq(convite.escolaId, exigirEscolaDoContexto()), eq(convite.id, conviteId), eq(convite.tipo, 'coordenador')))
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
    const escolaId = exigirEscolaDoContexto()
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
      .set({ revogadoEm: sql`now()` })
      .where(and(eq(convite.escolaId, exigirEscolaDoContexto()), eq(convite.id, conviteId), eq(convite.tipo, tipo), isNull(convite.usadoEm), isNull(convite.revogadoEm)))
      .returning({ usuarioId: convite.usuarioId })
    return revogado?.usuarioId
  }

  /** Revoga o convite do tipo pedido, usado ou não, se ainda não foi revogado. Devolve se revogou. */
  async revogar(conviteId: string, tipo: TipoDeConvite): Promise<boolean> {
    const revogados = await this.banco
      .update(convite)
      .set({ revogadoEm: sql`now()` })
      .where(and(eq(convite.escolaId, exigirEscolaDoContexto()), eq(convite.id, conviteId), eq(convite.tipo, tipo), isNull(convite.revogadoEm)))
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
    const escolaId = exigirEscolaDoContexto()
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
}
