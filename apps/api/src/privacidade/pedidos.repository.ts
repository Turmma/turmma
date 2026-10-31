import { requireEscolaId, requestIdentity, pedidoTitular, usuario, type Database, type DatabaseTransaction } from '@educa/core'
import type { Compartilhamento, EstadoDoPedido, SolicitanteDoPedido, TipoDePedidoDoTitular } from '@educa/shared'
import { PRAZO_DA_ELIMINACAO_DIAS } from '@educa/shared'
import { and, asc, desc, eq, gt, isNull, lt, ne, or, sql, type SQL } from 'drizzle-orm'

/** O que o registro do pedido grava, além do que vem da requisição. */
export interface PedidoParaRegistrar {
  readonly titularId: string
  readonly papelTitular: 'aluno' | 'professor'
  readonly tipo: TipoDePedidoDoTitular
  readonly solicitante: SolicitanteDoPedido
  readonly chegouEm: string
  readonly chaveEnvio: string
  readonly homonimo: boolean
  /**
   * O estado em que o pedido nasce: `em_preparacao` quando gera arquivo (acesso e portabilidade, que enfileiram o job na
   * mesma transação), `recebido` na compartilhamento e na correção (F3, tarefa 13.0), e `agendado` na eliminação (14.0), com
   * `eliminar_em` em 7 dias pelo relógio do banco.
   */
  readonly estado: 'recebido' | 'em_preparacao' | 'agendado'
  /** A foto do compartilhamento no momento do registro (F3, tarefa 12.0): é ela que sobrevive ao expurgo do titular. */
  readonly compartilhamento: Compartilhamento
}

/**
 * Um pedido como a lista, o detalhe e as ações o acham: os campos que a máquina de estados precisa, a foto do
 * compartilhamento e a conta do titular, que decide o "pedido sobre si mesmo" (a mesma `conta_id` de quem pediu
 * responde como inexistente).
 */
export interface PedidoAchado {
  readonly id: string
  readonly titularId: string
  readonly contaDoTitular: string | null
  readonly tipo: TipoDePedidoDoTitular
  readonly solicitante: SolicitanteDoPedido
  readonly chegouEm: string
  readonly estado: EstadoDoPedido
  readonly concluidoEm: Date | null
  readonly homonimo: boolean | null
  readonly nomeTrocado: boolean | null
  readonly compartilhamento: Compartilhamento
}

const colunasDoPedido = {
  id: pedidoTitular.id,
  titularId: pedidoTitular.titularId,
  tipo: pedidoTitular.tipo,
  solicitante: pedidoTitular.solicitante,
  chegouEm: pedidoTitular.chegouEm,
  estado: pedidoTitular.estado,
  concluidoEm: pedidoTitular.concluidoEm,
  homonimo: pedidoTitular.homonimo,
  nomeTrocado: pedidoTitular.nomeTrocado,
  compartilhamento: pedidoTitular.compartilhamento,
}

/**
 * Os pedidos do titular na escola do contexto (F3, RF10 e RF16; Tech Spec do F3, seções 3 e 4; regra 10, item 3):
 * escola e pessoa vêm do contexto. O pedido guarda só id, tipo, quem pediu, datas, estado, autor e a foto do
 * compartilhamento: **nenhuma coluna de nome, matrícula ou texto**, e o nome do titular só entra na resposta pela
 * junção com o `usuario`, que some quando ele é eliminado.
 *
 * O registro decide a corrida no banco (`insert … on conflict (escola_id, chave_envio) do nothing`), como a
 * `execucao_agente.chave_envio`; a mesma chave, com o mesmo conteúdo e da mesma coordenação, é sempre o mesmo pedido
 * (regra 80, item 7). As ações decidem pelo
 * `where` do `update`, e só a chamada que mudou registra o passo na auditoria.
 */
export class PedidosRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /**
   * Grava o pedido no estado que `pedido.estado` diz e devolve o id e, na eliminação, o instante `eliminar_em`. Com a chave
   * de envio já usada na escola, não grava e devolve `undefined`: quem chama devolve o pedido daquela chave, que é sempre o
   * mesmo, e confere que ele é o pedido que foi pedido (Tech Spec do F3, seções 4 e 5).
   *
   * **A eliminação `agendado` só entra uma por titular**: o único parcial `pedido_titular_agendado_unico` recusa a segunda
   * (com outra chave de envio) com 23505, e quem chama a traduz em `PEDIDO_EM_ESTADO_INVALIDO`. O `eliminar_em` é o `now()`
   * do banco mais `PRAZO_DA_ELIMINACAO_DIAS`: o relógio é um só, o da transação.
   */
  async registrar(pedido: PedidoParaRegistrar): Promise<{ readonly id: string; readonly eliminarEm: Date | null } | undefined> {
    const { usuarioId } = requestIdentity()
    const [gravado] = await this.banco
      .insert(pedidoTitular)
      .values({
        escolaId: requireEscolaId(),
        titularId: pedido.titularId,
        papelTitular: pedido.papelTitular,
        tipo: pedido.tipo,
        solicitante: pedido.solicitante,
        chegouEm: pedido.chegouEm,
        estado: pedido.estado,
        ...(pedido.estado === 'agendado' ? { eliminarEm: sql`now() + make_interval(days => ${PRAZO_DA_ELIMINACAO_DIAS})` } : {}),
        compartilhamento: pedido.compartilhamento,
        homonimo: pedido.homonimo,
        registradoPor: usuarioId,
        chaveEnvio: pedido.chaveEnvio,
      })
      .onConflictDoNothing({ target: [pedidoTitular.escolaId, pedidoTitular.chaveEnvio] })
      .returning({ id: pedidoTitular.id, eliminarEm: pedidoTitular.eliminarEm })
    return gravado
  }

  /**
   * Cancela a eliminação agendada e devolve quem ela era (o titular), ou `undefined` quando o pedido não está mais em
   * condição de ser cancelado: não está `agendado` (só a eliminação fica, pelo check `pedido_titular_agendado_com_prazo`), **já passou de `eliminar_em`** ou o job da 15.0 **já o
   * enfileirou**. O `where` decide a corrida do clique duplo e a do 8º dia, e a linha fica travada até o fim da transação:
   * quem chama devolve o acesso depois, na mesma transação (pedido → usuário). A tabela também recusa o estado `cancelado` sem
   * `cancelado_em` e `cancelado_por` juntos.
   */
  async cancelar(id: string): Promise<{ readonly titularId: string } | undefined> {
    const { usuarioId } = requestIdentity()
    const [cancelado] = await this.banco
      .update(pedidoTitular)
      .set({ estado: 'cancelado', canceladoEm: sql`now()`, canceladoPor: usuarioId })
      .where(
        and(
          eq(pedidoTitular.escolaId, requireEscolaId()),
          eq(pedidoTitular.id, id),
          eq(pedidoTitular.estado, 'agendado'),
          sql`${pedidoTitular.eliminarEm} > now()`,
          isNull(pedidoTitular.eliminacaoEnfileiradaEm),
        ),
      )
      .returning({ titularId: pedidoTitular.titularId })
    return cancelado
  }

  /**
   * O pedido desta chave de envio, na escola do contexto, **registrado por quem pede**: o de outra coordenação responde
   * como inexistente. É o que a colisão da chave devolve, e quem chama confere que o pedido é este mesmo.
   */
  async daChave(chaveEnvio: string): Promise<PedidoAchado | undefined> {
    return this.#um(and(eq(pedidoTitular.escolaId, requireEscolaId()), eq(pedidoTitular.chaveEnvio, chaveEnvio), eq(pedidoTitular.registradoPor, requestIdentity().usuarioId)))
  }

  /** O pedido deste id, na escola do contexto, com a conta do titular. O de outra escola e o inexistente não vêm. */
  async de(id: string): Promise<PedidoAchado | undefined> {
    return this.#um(and(eq(pedidoTitular.escolaId, requireEscolaId()), eq(pedidoTitular.id, id)))
  }

  /**
   * A página de pedidos da escola, **na chave da tela** (`ordenarOsPedidos`, da web): a chegada mais recente primeiro e o id
   * crescente no empate. `depoisDe` é o id do último item da página anterior (o `proxima`); o repository acha a chegada dele
   * **na escola do contexto, e entre os pedidos que a pessoa pode ler**, e devolve o que vem depois dele na chave. O cursor de
   * outra escola, o que não existe e o do pedido sobre a própria pessoa de quem lê respondem a mesma coisa, a página vazia
   * (regra 10, item 6), e nunca a primeira página de novo: a tela leria em laço. `limite + 1` linhas: a mais só diz que há próxima
   * página. O nome e as turmas do titular entram por quem chama, porque o titular pode já não existir ("Titular eliminado"). **O
   * pedido sobre a própria pessoa de quem pediu não entra**: ele responde como inexistente em toda rota, e quem atende um pedido
   * nunca é quem o pediu. O filtro vem antes do limite, senão a página sairia menor e a `proxima` erraria.
   *
   * A chave não tem índice próprio, de propósito: o `(escola_id, id)` já filtra pelo escopo, e a ordenação roda sobre os pedidos de
   * **uma escola**, que são dezenas por ano e não crescem com o uso do aluno (regra 80, item 8).
   */
  async listar(depoisDe: string | undefined, limite: number, deQuemPediu: { readonly usuarioId: string; readonly contaId: string | null }): Promise<PedidoAchado[]> {
    const daLista = and(
      eq(pedidoTitular.escolaId, requireEscolaId()),
      ne(pedidoTitular.titularId, deQuemPediu.usuarioId),
      ...(deQuemPediu.contaId === null ? [] : [sql`(${usuario.contaId} is null or ${usuario.contaId} <> ${deQuemPediu.contaId})`]),
    )
    if (depoisDe === undefined) return this.#vários(daLista, limite + 1)
    // O cursor é achado por `#vários`, e não por `#um` ou `de`: é a junção com `usuario` e o `daLista` que aplicam a escola e a
    // exclusão pela conta. Uma busca só pelo id devolveria o cursor de outra escola ou do pedido sobre quem lê.
    const [cursor] = await this.#vários(and(daLista, eq(pedidoTitular.id, depoisDe)), 1)
    if (cursor === undefined) return []
    const depoisDele = or(lt(pedidoTitular.chegouEm, cursor.chegouEm), and(eq(pedidoTitular.chegouEm, cursor.chegouEm), gt(pedidoTitular.id, cursor.id)))
    return this.#vários(and(daLista, depoisDele), limite + 1)
  }

  /**
   * Conclui o pedido aberto de acesso, portabilidade, compartilhamento ou correção: `estado`, `concluido_em` e
   * `concluido_por` juntos, e **só a chamada que mudou** devolve o estado em que o pedido estava (o `where` decide a
   * corrida do clique duplo). O estado anterior sai do próprio `update`, de uma subconsulta que **trava a linha**: o job
   * do arquivo (13.0) passa `em_preparacao` para `pronto` por fora, e um estado lido antes do `update` poderia não ser o
   * que foi trocado (a auditoria diria `pronto` de um pedido que estava `em_preparacao`). A eliminação não conclui por
   * aqui: é o job dela (tarefa 15.0), que assina com o autor `rotina`.
   */
  async concluir(id: string): Promise<EstadoDoPedido | undefined> {
    const { usuarioId } = requestIdentity()
    const escolaId = requireEscolaId()
    const concluidoEm = new Date()
    const { rows } = await this.banco.execute<{ anterior: EstadoDoPedido }>(sql`
      update pedido_titular p set estado = 'concluido', concluido_em = ${concluidoEm.toISOString()}::timestamptz, concluido_por = ${usuarioId}
      from (
        select a.id, a.estado from pedido_titular a
        where a.escola_id = ${escolaId} and a.id = ${id}
          and a.tipo in ('acesso', 'portabilidade', 'compartilhamento', 'correcao')
          and a.estado in ('recebido', 'em_preparacao', 'pronto')
        for update
      ) anterior
      where p.escola_id = ${escolaId} and p.id = anterior.id
      returning anterior.estado as anterior
    `)
    return rows[0]?.anterior
  }

  /**
   * O nome corrigido do titular (F3, RF13b): muda **só o `usuario` da escola do contexto**, e só quando o pedido de
   * correção ainda está aberto — o `where`, com a subconsulta do pedido, decide a corrida do clique duplo. O nome
   * anterior não volta para lugar nenhum: a auditoria não o traz, e quem o tem em texto livre o perde no expurgo.
   */
  async corrigirNome(id: string, nome: string): Promise<boolean> {
    const escolaId = requireEscolaId()
    const atualizado = await this.banco.execute(sql`
      update usuario u set nome = ${nome}
      where u.escola_id = ${escolaId} and u.id = (
        select p.titular_id from pedido_titular p
        where p.escola_id = ${escolaId} and p.id = ${id}
          and p.tipo = 'correcao' and p.estado in ('recebido', 'pronto')
      )
      returning u.id
    `)
    return atualizado.rows.length > 0
  }

  async #um(criterio: SQL | undefined): Promise<PedidoAchado | undefined> {
    const [linha] = await this.banco
      .select({ ...colunasDoPedido, contaDoTitular: usuario.contaId })
      .from(pedidoTitular)
      .leftJoin(usuario, and(eq(usuario.escolaId, pedidoTitular.escolaId), eq(usuario.id, pedidoTitular.titularId)))
      .where(criterio)
      .orderBy(asc(pedidoTitular.id))
      .limit(1)
    return linha
  }

  async #vários(criterio: SQL | undefined, limite: number): Promise<PedidoAchado[]> {
    return this.banco
      .select({ ...colunasDoPedido, contaDoTitular: usuario.contaId })
      .from(pedidoTitular)
      .leftJoin(usuario, and(eq(usuario.escolaId, pedidoTitular.escolaId), eq(usuario.id, pedidoTitular.titularId)))
      .where(criterio)
      .orderBy(desc(pedidoTitular.chegouEm), asc(pedidoTitular.id))
      .limit(limite)
  }
}
