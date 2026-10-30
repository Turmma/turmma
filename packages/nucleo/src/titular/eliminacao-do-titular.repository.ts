import type { Compartilhamento, PapelDoTitular } from '@educa/shared'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { requireEscolaId } from '../contexto/escola-do-contexto.js'
import type { Database, DatabaseTransaction } from '../db/banco.js'
import { arquivoTitular } from '../db/schema/arquivo-titular.js'
import { pedidoTitular } from '../db/schema/pedido-titular.js'
import { usuario } from '../db/schema/usuario.js'

/** O pedido de eliminação vencido que o job elimina: o titular, o papel e quem registrou (o autor, se ainda for da escola). */
export interface PedidoDeEliminacao {
  readonly id: string
  readonly titularId: string
  readonly papel: PapelDoTitular
  readonly registradoPor: string
}

/** Um pedido aberto do mesmo titular que a eliminação conclui junto: o id e o estado que ele tinha. */
export interface PedidoConcluidoComOTitular {
  readonly id: string
  readonly estado: 'recebido' | 'em_preparacao' | 'pronto'
}

/**
 * As leituras e escritas da eliminação do titular (F3, tarefa 15.0; Tech Spec do F3, seção 5, "Eliminação") na escola do
 * contexto, nunca na de um argumento (regra 10, item 3). O escopo da escola é o de toda instrução daqui; o que muda o
 * `usuario` é o `CicloDeVidaService`, e o que muda a auditoria é o `AuditoriaRecorder`: este repositório só toca o pedido,
 * as execuções e o consumo do titular e as linhas de `arquivo_titular`.
 *
 * **O relógio é o do banco** (`now()`): o `eliminar_em` foi gravado com ele, e o prazo se confere com ele. O `agora` injetado
 * só serve ao que o job grava como "data da anonimização" (`anonimizada_em`), como o expurgo por prazo.
 */
export class EliminacaoDoTitularRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /**
   * O pedido de eliminação `agendado` e já vencido (`eliminar_em <= now()`) da escola do contexto, sem travar. O de outra
   * escola, o inexistente, o cancelado, o concluído e o que ainda não venceu não vêm.
   */
  async vencido(pedidoId: string): Promise<PedidoDeEliminacao | undefined> {
    const [linha] = await this.banco
      .select({ id: pedidoTitular.id, titularId: pedidoTitular.titularId, papel: pedidoTitular.papelTitular, registradoPor: pedidoTitular.registradoPor })
      .from(pedidoTitular)
      .where(and(eq(pedidoTitular.escolaId, requireEscolaId()), eq(pedidoTitular.id, pedidoId), eq(pedidoTitular.tipo, 'eliminacao'), eq(pedidoTitular.estado, 'agendado'), sql`${pedidoTitular.eliminarEm} <= now()`))
      .limit(1)
    return linha
  }

  /**
   * O mesmo pedido, **em `FOR UPDATE`**, com o prazo reconferido sob a trava: dois jobs do mesmo pedido esperam um pelo outro, e
   * o segundo relê o estado que o primeiro deixou (`concluido`), então sai sem efeito. A primeira trava da ordem pedido →
   * usuário.
   */
  async travarVencido(pedidoId: string): Promise<PedidoDeEliminacao | undefined> {
    const [linha] = await this.banco
      .select({ id: pedidoTitular.id, titularId: pedidoTitular.titularId, papel: pedidoTitular.papelTitular, registradoPor: pedidoTitular.registradoPor })
      .from(pedidoTitular)
      .where(and(eq(pedidoTitular.escolaId, requireEscolaId()), eq(pedidoTitular.id, pedidoId), eq(pedidoTitular.tipo, 'eliminacao'), eq(pedidoTitular.estado, 'agendado'), sql`${pedidoTitular.eliminarEm} <= now()`))
      .limit(1)
      .for('update')
    return linha
  }

  /** O nome completo do titular na escola, ou `undefined` quando ele já não existe nela (eliminado por outro caminho). */
  async nomeDoTitular(titularId: string): Promise<string | undefined> {
    const [linha] = await this.banco
      .select({ nome: usuario.nome })
      .from(usuario)
      .where(and(eq(usuario.escolaId, requireEscolaId()), eq(usuario.id, titularId)))
      .limit(1)
    return linha?.nome
  }

  /**
   * Se quem registrou o pedido ainda é usuário **ativo** da escola. Lê com `FOR KEY SHARE` (como o gatilho da auditoria), que **só
   * segura a linha dentro de uma transação**: na etapa 3 (a transação do `eliminar`) ele não sai entre esta leitura e a gravação
   * do registro que o assina. Na etapa 2 a leitura roda fora de transação e a trava solta na hora: se a pessoa for desativada entre
   * a leitura e a gravação da faixa, a faixa falha e a tentativa seguinte assina como a rotina. Desativado, eliminado ou de outra
   * escola é "não": o autor passa a ser a rotina.
   */
  async registradorAtivo(registradoPor: string): Promise<boolean> {
    const [linha] = await this.banco
      .select({ id: usuario.id })
      .from(usuario)
      .where(and(eq(usuario.escolaId, requireEscolaId()), eq(usuario.id, registradoPor), isNull(usuario.desativadoEm)))
      .limit(1)
      .for('key share')
    return linha !== undefined
  }

  /** A foto do compartilhamento refeita, no próprio pedido (a coluna que o expurgo e a eliminação deixam sem o aluno). */
  async gravarCompartilhamento(pedidoId: string, foto: Compartilhamento): Promise<void> {
    await this.banco
      .update(pedidoTitular)
      .set({ compartilhamento: foto })
      .where(and(eq(pedidoTitular.escolaId, requireEscolaId()), eq(pedidoTitular.id, pedidoId)))
  }

  /**
   * Anonimiza as execuções que o titular pediu e o texto do consumo delas, como o expurgo por prazo faz (F3, tarefa 4.0): a
   * `entrada` vira `{ tarefa }`, `solicitada_por` fica nulo e `anonimizada_em` recebe o `agora`; o consumo dessas execuções
   * perde `entrada` e `saida`. A linha, o estado, o `resultado` e o `erro` ficam, com as FKs de quem aponta para elas: o que a
   * IA gerou continua ligado ao que foi aprovado (regra 70, item 6). **Antes do `eliminar`**: o `on delete set null` da FK
   * deixaria o tema do professor na `entrada`. Devolve quantas execuções.
   */
  async anonimizarExecucoes(titularId: string, agora: Date): Promise<number> {
    const escolaId = requireEscolaId()
    const resultado = await this.banco.execute<{ execucoes: number }>(sql`
      with execucoes as (
        update execucao_agente
        set entrada = jsonb_build_object('tarefa', tarefa), solicitada_por = null, anonimizada_em = ${agora.toISOString()}::timestamptz
        where escola_id = ${escolaId} and solicitada_por = ${titularId} and anonimizada_em is null
        returning id
      ),
      texto_do_modelo as (
        update consumo_ia c
        set entrada = null, saida = null
        where c.escola_id = ${escolaId} and c.execucao_id in (select id from execucoes) and (c.entrada is not null or c.saida is not null)
        returning c.id
      )
      select count(*)::int as execucoes from execucoes
    `)
    return resultado.rows[0]?.execucoes ?? 0
  }

  /**
   * Marca `apagado_em` nos arquivos dos pedidos do titular (o `objeto` sai do storage na noite seguinte, pelo expurgo da
   * escola, e a linha só depois). O que já estava marcado não muda. Devolve quantos.
   */
  async marcarArquivosApagados(titularId: string): Promise<number> {
    const escolaId = requireEscolaId()
    const marcados = await this.banco
      .update(arquivoTitular)
      .set({ apagadoEm: sql`now()` })
      .where(
        and(
          eq(arquivoTitular.escolaId, escolaId),
          isNull(arquivoTitular.apagadoEm),
          sql`${arquivoTitular.pedidoId} in (select p.id from pedido_titular p where p.escola_id = ${escolaId} and p.titular_id = ${titularId})`,
        ),
      )
      .returning({ id: arquivoTitular.id })
    return marcados.length
  }

  /**
   * Conclui os **outros pedidos abertos** do titular (`recebido`, `em_preparacao`, `pronto`): sem a pessoa não há o que
   * atender, e o de acesso `em_preparacao` ficaria disparando o alerta de 2 h. Cada um fica com o estado que tinha, para a
   * auditoria `pedido.concluido`. Trava em `FOR UPDATE`, em ordem de `id`. O `concluido_por` é o de quem registrou o pedido.
   */
  async concluirOutrosAbertos(titularId: string, pedidoDaEliminacaoId: string): Promise<PedidoConcluidoComOTitular[]> {
    const escolaId = requireEscolaId()
    const resultado = await this.banco.execute<{ id: string; estado: PedidoConcluidoComOTitular['estado'] }>(sql`
      with alvo as (
        select id, estado from pedido_titular
        where escola_id = ${escolaId} and titular_id = ${titularId} and id <> ${pedidoDaEliminacaoId}
          and estado in ('recebido', 'em_preparacao', 'pronto')
        order by id
        for update
      )
      update pedido_titular p
      set estado = 'concluido', concluido_em = now(), concluido_por = p.registrado_por
      from alvo
      where p.escola_id = ${escolaId} and p.id = alvo.id
      returning p.id, alvo.estado
    `)
    return resultado.rows.map(({ id, estado }) => ({ id, estado }))
  }

  /**
   * Conclui o pedido da eliminação com as duas marcas (`nome_trocado`, `homonimo`), **só se ainda `agendado`**. O
   * `concluido_por` é o `registrado_por`: o autor que a auditoria diz (a pessoa da coordenação ou a rotina) é o da
   * auditoria, e o gatilho de usuário da escola não vale nesta coluna (migration 0035). Devolve se esta chamada concluiu.
   */
  async concluir(pedidoId: string, marcas: { nomeTrocado: boolean; homonimo: boolean }): Promise<boolean> {
    const concluidos = await this.banco
      .update(pedidoTitular)
      .set({ estado: 'concluido', concluidoEm: sql`now()`, concluidoPor: pedidoTitular.registradoPor, nomeTrocado: marcas.nomeTrocado, homonimo: marcas.homonimo })
      .where(and(eq(pedidoTitular.escolaId, requireEscolaId()), eq(pedidoTitular.id, pedidoId), eq(pedidoTitular.estado, 'agendado')))
      .returning({ id: pedidoTitular.id })
    return concluidos.length > 0
  }
}
