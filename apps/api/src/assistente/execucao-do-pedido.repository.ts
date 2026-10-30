import { ErroDeDominio, execucaoAgente, exigirAnoEmCurso, exigirEscolaDoContexto, sessaoDaRequisicao, type Banco, type TransacaoBanco } from '@educa/nucleo'
import { ErrorCode, execucaoInputSchema, type ExecucaoInput, type TarefaDeIa } from '@educa/shared'
import { and, eq } from 'drizzle-orm'

/**
 * O que a execução relê antes de rodar: a `entrada` **gravada** com ela, pela chave do envio, na escola e no ano do
 * contexto e só se foi a pessoa do contexto que pediu. O que vale é o que está no banco, e não o corpo de um reenvio
 * com a mesma chave. A `entrada` é `jsonb`, sem FK: é validada de novo aqui, e os ids dela são relidos por quem a usa,
 * pelo repository de cada um, no mesmo escopo.
 */
export class ExecucaoDoPedidoRepository {
  constructor(private readonly banco: Banco | TransacaoBanco) {}

  /** A entrada gravada da execução desta chave, da tarefa esperada. A de outra pessoa, de outra escola ou de outra tarefa: `NAO_ENCONTRADO`. */
  async entradaDaChave<Tarefa extends TarefaDeIa>(chaveEnvio: string, tarefa: Tarefa): Promise<Extract<ExecucaoInput, { tarefa: Tarefa }>> {
    const [linha] = await this.banco
      .select({ entrada: execucaoAgente.entrada })
      .from(execucaoAgente)
      .where(
        and(
          eq(execucaoAgente.escolaId, exigirEscolaDoContexto()),
          eq(execucaoAgente.anoLetivoId, exigirAnoEmCurso()),
          eq(execucaoAgente.chaveEnvio, chaveEnvio),
          eq(execucaoAgente.solicitadaPor, sessaoDaRequisicao().usuarioId),
          eq(execucaoAgente.tarefa, tarefa),
        ),
      )
    const lida = execucaoInputSchema.safeParse(linha?.entrada)
    if (!lida.success || lida.data.tarefa !== tarefa) throw new ErroDeDominio(ErrorCode.NAO_ENCONTRADO)
    return lida.data as Extract<ExecucaoInput, { tarefa: Tarefa }>
  }
}
