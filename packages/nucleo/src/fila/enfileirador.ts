import { JOB_DEFINITIONS, type JobData, type JobDefinition, type QueueName, type JobOptions, type JobType } from '@educa/shared'
import type { TransacaoBanco } from '../db/banco.js'
import type { JobRegistroRepository, LinhaNova, ResultadoDaChave } from './job-registro.repository.js'
import { MotivoDaRecusaDoJob, PedidoDeJobRecusado } from './pedido-de-job-recusado.js'

/** A prioridade vem só da fila: 1 é a mais urgente. */
export const PRIORIDADE_DA_FILA: Readonly<Record<QueueName, number>> = { interativa: 1, normal: 2, lote: 3 }

/** As opções são opcionais, salvo no tipo que deixa o `naoUrgente` com quem enfileira (o sintético). */
type ArgumentosDeOpcoes<Tipo extends JobType> = Record<never, never> extends JobOptions<Tipo> ? [opcoes?: JobOptions<Tipo>] : [opcoes: JobOptions<Tipo>]

/** O que as opções carregam, sem o tipo do job: a conferência é em execução, contra a definição. */
interface OpcoesLidas {
  readonly fila?: QueueName
  readonly naoUrgente?: boolean
}

/**
 * Porta de entrada de todo trabalho demorado (regra 00, item 4). Grava na transação de quem pede,
 * então o job existe se, e somente se, o que o originou foi gravado. A escola e o `requisicaoId`
 * vêm do contexto, nunca do pedido.
 *
 * O pedido é um tipo de `JOB_DEFINITIONS`, os dados desse tipo e, no máximo, a fila e o `naoUrgente` que a definição
 * deixa escolher. Antes de gravar, os dados passam pelo esquema estrito do tipo e a fila e o `naoUrgente` pela definição:
 * pedido que ela recusa lança `PedidoDeJobRecusado` e não grava linha nem ocupa chave de idempotência.
 *
 * A recusa é sempre uma promessa rejeitada, nunca uma exceção síncrona: quem engole o erro com `.catch` o engole de verdade.
 *
 * Nada vai ao Redis aqui: quem publica é o despachante. Com o Redis de fila fora, o pedido continua
 * sendo aceito.
 */
export class Enfileirador {
  constructor(private readonly repositorio: JobRegistroRepository) {}

  async enfileirar<Tipo extends JobType>(tx: TransacaoBanco, tipo: Tipo, dados: JobData<Tipo>, ...opcoes: ArgumentosDeOpcoes<Tipo>): Promise<string> {
    return this.repositorio.inserir(tx, linhaDoPedido(tipo, dados, opcoes[0]))
  }

  /**
   * Como `enfileirar`, uma vez só por escola, tipo e `chaveIdempotencia` enquanto o job da chave não terminou (F3, Tech
   * Spec, seção 5). Devolve o id do job gravado, ou, na colisão, o do que já existe (nulo se ele terminou nesse
   * intervalo): os dois são "já enfileirado". Um segundo job da mesma chave depois de o primeiro terminar é aceito, e
   * quem usa a chave precisa tolerar a reexecução. Só em job de escola, com a escola no contexto.
   */
  async enfileirarUmaVez<Tipo extends JobType>(
    tx: TransacaoBanco,
    tipo: Tipo,
    dados: JobData<Tipo>,
    chaveIdempotencia: string,
    ...opcoes: ArgumentosDeOpcoes<Tipo>
  ): Promise<ResultadoDaChave> {
    return this.repositorio.inserirUmaVez(tx, linhaDoPedido(tipo, dados, opcoes[0]), chaveIdempotencia)
  }
}

/** A linha que o repository grava, ou `PedidoDeJobRecusado`: a fila e o `naoUrgente` da definição, os dados lidos pelo esquema. */
function linhaDoPedido(tipo: JobType, dados: unknown, opcoes: OpcoesLidas | undefined): LinhaNova {
  const definicao: JobDefinition = JOB_DEFINITIONS[tipo]
  const fila = opcoes?.fila ?? definicao.filas[0]
  if (!definicao.filas.includes(fila)) throw new PedidoDeJobRecusado(tipo, MotivoDaRecusaDoJob.FILA_FORA_DA_DEFINICAO)
  const lidos = definicao.dados.safeParse(dados)
  if (!lidos.success) throw new PedidoDeJobRecusado(tipo, MotivoDaRecusaDoJob.DADOS_INVALIDOS)
  return { tipo, fila, prioridade: PRIORIDADE_DA_FILA[fila], dados: lidos.data, naoUrgente: naoUrgenteDo(tipo, definicao, opcoes) }
}

function naoUrgenteDo(tipo: JobType, definicao: JobDefinition, opcoes: OpcoesLidas | undefined): boolean {
  if (definicao.naoUrgente !== 'do-pedido') {
    if (opcoes?.naoUrgente !== undefined) throw new PedidoDeJobRecusado(tipo, MotivoDaRecusaDoJob.NAO_URGENTE_FIXO)
    return definicao.naoUrgente
  }
  if (opcoes?.naoUrgente === undefined) throw new PedidoDeJobRecusado(tipo, MotivoDaRecusaDoJob.NAO_URGENTE_AUSENTE)
  return opcoes.naoUrgente
}
