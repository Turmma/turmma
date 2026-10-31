import { requireAnoEmCurso, requireEscolaId, reivindicacao, type Database, type DatabaseTransaction } from '@educa/core'
import { and, eq } from 'drizzle-orm'

/** O pedido novo: a turma do acesso, o nome escolhido, a chave do envio e o hash da senha, já calculado fora da transação. */
export interface NovoPedido {
  readonly turmaId: string
  readonly listaNomeId: string
  readonly chaveEnvio: string
  readonly senhaHash: string
  /** Se o nome teve matrícula errada pelo mesmo acesso na janela do contador (7.0): só sim ou não. */
  readonly teveMatriculaErrada: boolean
}

/**
 * Os pedidos de reivindicação na escola e no ano do contexto (A1, tarefa 6.0; regra 10, item 3). Na página pública, o
 * contexto é o que o `AcessoDaSala` abriu com a linha do acesso vigente: escola e ano nunca vêm de argumento, e a turma é
 * a da linha, aqui só filtro. As FKs compostas com a escola são a segunda camada: o nome e a turma de outra escola não
 * entram.
 *
 * Nada daqui devolve o hash, a chave nem a matrícula, e nada daqui vai a log.
 */
export class ReivindicacaoRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  /**
   * Se a chave do envio já está num pedido da turma do acesso, na escola e no ano do contexto: é o reenvio do mesmo pedido
   * (o clique duplo, o 503 que a página repete), que responde `enviado` sem pedido novo. A mesma chave num pedido de
   * outra turma não conta (E21). Pelo índice único `(escola_id, chave_envio)`.
   *
   * Não filtra pelo estado: a chave só existe no pedido pendente, pelo check `reivindicacao_segredo_so_pendente`, e a
   * decisão (8.0) e o encerramento (10.0) a apagam na mesma escrita. Uma chave de pedido decidido não sobra para ser achada.
   */
  async chaveGravada(turmaId: string, chaveEnvio: string): Promise<boolean> {
    const [linha] = await this.banco
      .select({ id: reivindicacao.id })
      .from(reivindicacao)
      .where(
        and(
          eq(reivindicacao.escolaId, requireEscolaId()),
          eq(reivindicacao.chaveEnvio, chaveEnvio),
          eq(reivindicacao.anoLetivoId, requireAnoEmCurso()),
          eq(reivindicacao.turmaId, turmaId),
        ),
      )
      .limit(1)
    return linha !== undefined
  }

  /**
   * Grava o pedido `pendente`, com a chave, o hash e o `teve_matricula_errada` que o serviço leu do contador do nome
   * (7.0). O nome de outra escola ou inexistente sobe como o 23503 da FK; o nome que já tem pendente e a chave já
   * gravada na escola, como o 23505 dos índices únicos. Quem chama decide, sem ler o nome da restrição.
   */
  async inserirPendente(novo: NovoPedido): Promise<void> {
    await this.banco.insert(reivindicacao).values({
      escolaId: requireEscolaId(),
      anoLetivoId: requireAnoEmCurso(),
      turmaId: novo.turmaId,
      listaNomeId: novo.listaNomeId,
      chaveEnvio: novo.chaveEnvio,
      senhaHash: novo.senhaHash,
      teveMatriculaErrada: novo.teveMatriculaErrada,
    })
  }
}
