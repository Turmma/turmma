import { acessoTurma, anoLetivo, requireEscolaId, listaNome, reivindicacao, type Database, type DatabaseTransaction } from '@educa/core'
import type { AnoLetivo, PaginationQuery, CriarAnoLetivoRequest, SituacaoDoAnoLetivo } from '@educa/shared'
import { and, asc, eq, gt, inArray, isNull, sql } from 'drizzle-orm'
import { InvariantException } from '@educa/shared'

/** O que a virada fez na sala das turmas do ano: só contagens, que a auditoria `ano_letivo.encerrado` leva. */
export interface ViradaDaSala {
  readonly acessosRevogados: number
  readonly pedidosEncerrados: number
  readonly linhasDaListaApagadas: number
}

const colunas = { id: anoLetivo.id, ano: anoLetivo.ano, inicio: anoLetivo.inicio, fim: anoLetivo.fim, situacao: anoLetivo.situacao }

/**
 * Os anos letivos da escola do contexto, e só dela: nenhum método recebe escola (regra 10, item 3). Id de outra escola
 * não acha nada, e o service responde como inexistente.
 *
 * Abrir e encerrar são `update` condicionais na situação: a transição acontece uma vez, e o segundo ano em curso da
 * escola é barrado pelo índice único parcial `ano_letivo_um_em_curso_por_escola`, não por uma leitura antes da
 * escrita (regra 80, item 7).
 */
export class AnoLetivoRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  async criar(pedido: CriarAnoLetivoRequest): Promise<AnoLetivo> {
    const [criado] = await this.banco
      .insert(anoLetivo)
      .values({ escolaId: requireEscolaId(), ano: pedido.ano, inicio: pedido.inicio, fim: pedido.fim, situacao: 'planejado' })
      .returning(colunas)
    if (criado === undefined) throw new InvariantException('ano letivo não criado')
    return criado
  }

  /** Uma página dos anos da escola, em ordem de criação, com uma linha a mais que diz se há próxima. */
  listar({ pagina, limite }: PaginationQuery): Promise<AnoLetivo[]> {
    return this.banco
      .select(colunas)
      .from(anoLetivo)
      .where(and(eq(anoLetivo.escolaId, requireEscolaId()), pagina === undefined ? undefined : gt(anoLetivo.id, pagina)))
      .orderBy(asc(anoLetivo.id))
      .limit(limite + 1)
  }

  async porId(id: string): Promise<AnoLetivo | undefined> {
    const [linha] = await this.banco
      .select(colunas)
      .from(anoLetivo)
      .where(and(eq(anoLetivo.escolaId, requireEscolaId()), eq(anoLetivo.id, id)))
    return linha
  }

  /** Passa o ano de `de` a `para`, se ele estiver em `de`. Devolve o ano mudado, ou nada se não estava. */
  async mudarSituacao(id: string, de: SituacaoDoAnoLetivo, para: SituacaoDoAnoLetivo): Promise<AnoLetivo | undefined> {
    const [mudado] = await this.banco
      .update(anoLetivo)
      .set({ situacao: para })
      .where(and(eq(anoLetivo.escolaId, requireEscolaId()), eq(anoLetivo.id, id), eq(anoLetivo.situacao, de)))
      .returning(colunas)
    return mudado
  }

  /**
   * A virada da sala das turmas do ano (A1, tarefa 10.0; Tech Spec da A1, seção 7, "Virada de ano"), dentro da transação
   * do `encerrar` e depois de o ano ter mudado para `encerrado`. Três escritas, nesta ordem:
   *
   * 1. Revoga todo acesso da turma do ano ainda não revogado, vencido ou não: nenhum link nem código do ano sobra aberto.
   * 2. Fecha os pedidos `pendente` do ano como `encerrada`, sem o hash, a chave e a marca de matrícula errada (check
   *    `reivindicacao_segredo_so_pendente`). Não é decisão (regra 70, item 2): `decidida_por`, `decidida_em` e
   *    `decidida_como` continuam nulos.
   * 3. Apaga os nomes `livre` e `reivindicado` do ano (a minimização vence a exclusão lógica; `docs/lgpd.md`). O `set null`
   *    da FK deixa sem nome os pedidos que apontavam para eles (o recusado, o encerrado); o `aprovado` fica.
   *
   * A 2 vem antes da 3: o check `reivindicacao_pendente_com_nome` recusa (23514) o `set null` num pedido pendente. Nenhum
   * pedido novo chega entre as duas: a reivindicação e a decisão travam o ano em curso em `FOR SHARE` (10.2), e o `update`
   * do ano, que veio antes, as fez esperar ou recusar.
   */
  async virarSala(anoLetivoId: string): Promise<ViradaDaSala> {
    const escolaId = requireEscolaId()
    const revogados = await this.banco
      .update(acessoTurma)
      .set({ revogadoEm: sql`now()` })
      .where(and(eq(acessoTurma.escolaId, escolaId), eq(acessoTurma.anoLetivoId, anoLetivoId), isNull(acessoTurma.revogadoEm)))
      .returning({ id: acessoTurma.id })
    const encerrados = await this.banco
      .update(reivindicacao)
      .set({ estado: 'encerrada', senhaHash: null, chaveEnvio: null, teveMatriculaErrada: null })
      .where(and(eq(reivindicacao.escolaId, escolaId), eq(reivindicacao.anoLetivoId, anoLetivoId), eq(reivindicacao.estado, 'pendente')))
      .returning({ id: reivindicacao.id })
    const apagadas = await this.banco
      .delete(listaNome)
      .where(and(eq(listaNome.escolaId, escolaId), eq(listaNome.anoLetivoId, anoLetivoId), inArray(listaNome.estado, ['livre', 'reivindicado'])))
      .returning({ id: listaNome.id })
    return { acessosRevogados: revogados.length, pedidosEncerrados: encerrados.length, linhasDaListaApagadas: apagadas.length }
  }
}
