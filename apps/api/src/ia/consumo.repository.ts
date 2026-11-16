import { randomUUID } from 'node:crypto'
import { consumoEstimadoDaInterrompida, consumoIa, requireEscolaId, runInContext, systemClock, TASK_CATALOG, type Database, type ConsumoDeIa, type DatabaseTransaction, type DestinoDoAdaptador, type RegistroDeConsumo } from '@educa/core'
import type { InterrompidaEncerrada } from './execucao.repository.js'

/**
 * A porta `RegistroDeConsumo` sobre `consumo_ia` (regra 30, item 4). A escola é a do contexto de quem gastou
 * (`requireEscolaId()`, lida a cada chamada): o registro não a traz, e sem escola no contexto lança antes de
 * gravar. Não há leitura aqui, só a inserção de uma linha na escola dele.
 *
 * `entrada` e `saida` chegam ausentes nas tarefas que levam texto livre de pessoa e são gravadas nulas; nas funções do
 * Tutor o banco recusa qualquer outra coisa (`consumo_ia_sem_conversa_de_pessoa`). Nada daqui vai a log.
 */
export class ConsumoRepository implements RegistroDeConsumo {
  constructor(private readonly banco: Database | DatabaseTransaction) {}

  async registrar(consumo: ConsumoDeIa): Promise<void> {
    await this.banco.insert(consumoIa).values({
      escolaId: requireEscolaId(),
      alunoId: consumo.alunoId ?? null,
      execucaoId: consumo.execucaoId ?? null,
      tarefa: consumo.tarefa,
      funcao: consumo.funcao,
      perfil: consumo.perfil,
      origem: consumo.origem,
      modelo: consumo.modelo,
      promptVersao: consumo.promptVersao,
      tokensDeEntrada: consumo.tokensDeEntrada,
      tokensDeSaida: consumo.tokensDeSaida,
      duracaoMs: consumo.duracaoMs,
      envioExterno: consumo.envioExterno,
      provedor: consumo.provedorId,
      tentativas: consumo.tentativas,
      estado: consumo.estado,
      codigoDeErro: consumo.codigoDeErro ?? null,
      entrada: consumo.entrada ?? null,
      saida: consumo.saida ?? null,
      em: consumo.em,
    })
  }

  /**
   * A linha estimada de uma execução `rodando` que foi encerrada como interrompida (X6, 6.0): os dois tetos da tarefa, o envio do adaptador configurado, e nenhum aluno nem
   * texto (`consumoEstimadoDaInterrompida`). **Na escola da própria execução** (a varredura roda sem escola no contexto e a recebe do `returning`), e na transação de quem a
   * encerrou: chame com o `tx` que fez o `update`, para o encerramento e a linha ficarem juntos ou nenhum dos dois. Só ids, tarefa e números: nada daqui vai a log.
   *
   * `execucao.escolaId` só pode vir de um `InterrompidaEncerrada` que o `ExecucaoRepository` devolveu do `returning` do `update` (`encerrarRodando`,
   * `encerrarRodandasVelhas`), nunca de argumento de quem chama de fora (regra 10, item 3): a FK composta `(escola_id, execucao_id)` de `consumo_ia` recusa a escola
   * que não é a da execução.
   */
  async registrarEstimada(execucao: InterrompidaEncerrada, destino: DestinoDoAdaptador): Promise<void> {
    const consumo = consumoEstimadoDaInterrompida({ tarefa: TASK_CATALOG[execucao.tarefa], destino, execucaoId: execucao.id, duracaoMs: execucao.duracaoMs, em: systemClock.agora() })
    await runInContext({ requisicaoId: randomUUID(), escolaId: execucao.escolaId }, () => this.registrar(consumo))
  }
}
