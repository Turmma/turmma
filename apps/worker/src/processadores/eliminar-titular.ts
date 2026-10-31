import {
  EliminacaoDoTitular,
  estaNaJanela,
  type Database,
  type OperationalSettings,
  type JanelaLetiva,
  type LoggerBase,
  type Clock,
} from '@educa/core'
import type { TIPO_ELIMINAR_TITULAR } from '@educa/shared'
import type { Processador } from '../executor.js'

export interface DependenciasDaEliminacaoDoTitular {
  banco: Database
  /** O horário letivo da escola do contexto: a troca de nome confere a janela entre uma faixa e outra, e para quando ela abre. */
  janelaDaEscola: Pick<OperationalSettings<JanelaLetiva>, 'daEscola'>
  relogio: Clock
  logger: LoggerBase
  /** Linhas examinadas por faixa da troca de nome. Só o teste troca. */
  faixa?: number
}

/**
 * `titular.eliminar` (F3, tarefa 15.0; Tech Spec do F3, seção 5, "Eliminação"): no contexto da escola do job, roda a
 * `EliminacaoDoTitular` do pedido `agendado` e vencido: troca o nome completo nos textos livres (faixas, com a janela letiva
 * conferida entre elas), refaz a foto do compartilhamento, anonimiza, elimina a pessoa, marca os arquivos e conclui o pedido.
 *
 * - **O job leva só o id do pedido**, e o executor o valida pela definição: o titular, o nome e todo o resto são lidos aqui
 *   dentro, na escola do job.
 * - **Sem efeito não é erro**: o pedido que já não está `agendado` (cancelado, concluído por outro job) ou não venceu termina
 *   em silêncio, e o que a janela interrompeu termina também, com o pedido ainda `agendado`; a rotina da noite seguinte o
 *   enfileira de novo (depois de 20 h).
 * - **Reexecução e dois jobs do mesmo pedido** são inofensivos (D49): a troca de nome é idempotente, e a trava do pedido
 *   deixa passar um só.
 * - **Falha** (a troca que quebrou o JSON, o `eliminar` que falhou) sobe: o BullMQ tenta de novo, a etapa 3 foi desfeita
 *   inteira, e o alerta de 48 h aparece se o pedido não concluir.
 * - Loga só o resultado (`status`); nunca o titular, o nome, o termo nem contagem por tabela.
 */
export function criarEliminacaoDoTitular({ banco, janelaDaEscola, relogio, logger, faixa }: DependenciasDaEliminacaoDoTitular): Processador<typeof TIPO_ELIMINAR_TITULAR> {
  return async ({ pedidoId }) => {
    const janela = await janelaDaEscola.daEscola()
    const status = await new EliminacaoDoTitular(banco, relogio).eliminar(pedidoId, {
      janelaAberta: () => estaNaJanela(janela, relogio.agora()),
      ...(faixa === undefined ? {} : { faixa }),
    })
    logger.info({ evento: 'titular.eliminacao', status })
  }
}
