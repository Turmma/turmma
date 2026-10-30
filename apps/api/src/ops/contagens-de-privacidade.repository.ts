import { arquivoTitular, requireEscolaId, expurgoExecucao, pedidoTitular, type Database, type DatabaseTransaction } from '@educa/nucleo'
import { ESTADOS_DO_PEDIDO, type EstadoDoPedido } from '@educa/shared'
import { asc, desc, eq, sql } from 'drizzle-orm'

/** O que o `ops:privacidade` conta do atendimento, do arquivo e do expurgo de uma escola: números e uma data, nenhuma pessoa. */
export interface ContagensDoAtendimento {
  /** Quantos pedidos há em cada estado, com zero nos estados sem pedido. */
  readonly pedidos: Readonly<Record<EstadoDoPedido, number>>
  /** `vencidas`: `agendado` com o `eliminar_em` já passado, que o job da noite ainda não concluiu. */
  readonly eliminacoes: { readonly agendadas: number; readonly vencidas: number }
  /** `ativos`: o arquivo que ainda baixa; `vencidos`: passou da validade e a linha ainda está lá (a rotina da noite o apaga). */
  readonly arquivos: { readonly ativos: number; readonly vencidos: number }
  /** A última execução de cada categoria do catálogo: quantas terminaram, quantas pararam, e quando foi a mais recente. */
  readonly expurgo: { readonly categoriasConcluidas: number; readonly categoriasPendentes: number; readonly ultimaExecucaoEm: Date | null }
}

/**
 * As contagens que a operação lê do atendimento ao titular (F3, tarefa 19.0; RF17; Tech Spec do F3, seção 6): o
 * `pedido_titular`, o `arquivo_titular` e o `expurgo_execucao` de **uma** escola, a do contexto que o `ops:privacidade` abriu
 * para ela (regra 10, item 3). Cada leitura leva o `escola_id` do contexto, nunca de argumento, e **nenhuma coluna de pessoa é
 * lida**: só estado, datas e a categoria do expurgo. Nenhum método é `@Unscoped`.
 *
 * Os suboperadores e os incidentes da escola o comando conta pelos leitores que já existem
 * (`SuboperadorDaEscolaRepository` e `IncidenteDaEscolaRepository`), e não por aqui: as quatro tabelas da operação têm
 * dono único no teste de arquitetura.
 */
export class ContagensDePrivacidadeRepository {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  async doAtendimento(): Promise<ContagensDoAtendimento> {
    const escolaId = requireEscolaId()

    const pedidos = await this.banco
      .select({
        estado: pedidoTitular.estado,
        total: sql<number>`count(*)::int`,
        vencidas: sql<number>`count(*) filter (where ${pedidoTitular.estado} = 'agendado' and ${pedidoTitular.eliminarEm} < now())::int`,
      })
      .from(pedidoTitular)
      .where(eq(pedidoTitular.escolaId, escolaId))
      .groupBy(pedidoTitular.estado)
    const porEstado = Object.fromEntries(ESTADOS_DO_PEDIDO.map((estado) => [estado, pedidos.find((linha) => linha.estado === estado)?.total ?? 0])) as Record<EstadoDoPedido, number>

    const [arquivos] = await this.banco
      .select({
        ativos: sql<number>`count(*) filter (where ${arquivoTitular.apagadoEm} is null and ${arquivoTitular.expiraEm} > now())::int`,
        vencidos: sql<number>`count(*) filter (where ${arquivoTitular.apagadoEm} is null and ${arquivoTitular.expiraEm} <= now())::int`,
      })
      .from(arquivoTitular)
      .where(eq(arquivoTitular.escolaId, escolaId))

    // A última execução de cada categoria: `distinct on` pela categoria, da mais recente para a mais antiga.
    const ultimas = this.banco
      .selectDistinctOn([expurgoExecucao.categoria], { concluida: expurgoExecucao.concluida, em: expurgoExecucao.em })
      .from(expurgoExecucao)
      .where(eq(expurgoExecucao.escolaId, escolaId))
      .orderBy(asc(expurgoExecucao.categoria), desc(expurgoExecucao.em))
      .as('ultimas')
    const [expurgo] = await this.banco
      .select({
        concluidas: sql<number>`count(*) filter (where ${ultimas.concluida})::int`,
        pendentes: sql<number>`count(*) filter (where not ${ultimas.concluida})::int`,
        ultima: sql<string | null>`max(${ultimas.em})`,
      })
      .from(ultimas)

    return {
      pedidos: porEstado,
      eliminacoes: { agendadas: porEstado.agendado, vencidas: pedidos.reduce((soma, linha) => soma + linha.vencidas, 0) },
      arquivos: { ativos: arquivos?.ativos ?? 0, vencidos: arquivos?.vencidos ?? 0 },
      expurgo: {
        categoriasConcluidas: expurgo?.concluidas ?? 0,
        categoriasPendentes: expurgo?.pendentes ?? 0,
        ultimaExecucaoEm: expurgo?.ultima == null ? null : new Date(expurgo.ultima),
      },
    }
  }
}
