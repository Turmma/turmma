import { randomUUID } from 'node:crypto'
import { consumoEstimadoDaInterrompida, consumoIa, requireEscolaId, runInContext, systemClock, TASK_CATALOG, type Database, type ConsumoDeIa, type DatabaseTransaction, type DestinoDoAdaptador, type RegistroDeConsumo, type TabelaDePrecos } from '@educa/core'
import type { InterrompidaEncerrada } from './execucao.repository.js'

/**
 * A porta `RegistroDeConsumo` sobre `consumo_ia` (regra 30, item 4). A escola é a do contexto de quem gastou
 * (`requireEscolaId()`, lida a cada chamada): o registro não a traz, e sem escola no contexto lança antes de
 * gravar. Não há leitura aqui, só a inserção de uma linha na escola dele.
 *
 * `pelo_provedor_de_reserva` é a do destino da chamada (`ConsumoDeIa.peloProvedorDeReserva`, camada do gateway, F5b 4.0): verdadeira só na linha que saiu para a reserva, e falsa na que o gateway grava
 * para o principal e na estimada da interrompida (uma por destino possível, com o provedor de cada um: o do adaptador configurado e, se a tarefa tem aprovação para ela, o da reserva). `provedor` é o id de quem recebeu o conteúdo de cada chamada, e é ele que o arquivo do titular lê.
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
      custoMicros: consumo.custoMicros,
      duracaoMs: consumo.duracaoMs,
      envioExterno: consumo.envioExterno,
      provedor: consumo.provedorId,
      peloProvedorDeReserva: consumo.peloProvedorDeReserva ?? false,
      tentativas: consumo.tentativas,
      estado: consumo.estado,
      codigoDeErro: consumo.codigoDeErro ?? null,
      entrada: consumo.entrada ?? null,
      saida: consumo.saida ?? null,
      em: consumo.em,
    })
  }

  /**
   * As linhas estimadas de uma execução `rodando` que foi encerrada como interrompida (X6, 6.0; F5b, 8.0): **uma por destino** (`destinosDaInterrompida`: o principal, e a reserva quando a tarefa tem
   * aprovação para o provedor dela), cada uma com os dois tetos da tarefa ao preço do modelo do destino (`precos`, a tabela da porta), o envio dele, e nenhum aluno nem texto
   * (`consumoEstimadoDaInterrompida`). **Na escola da própria execução** (a varredura roda sem escola no contexto e a recebe do `returning`), e na transação de quem a
   * encerrou: chame com o `tx` que fez o `update`, para o encerramento e as linhas ficarem juntos ou nenhum: a linha da reserva que falha desfaz a do principal e o encerramento. Só ids, tarefa e números: nada daqui vai a log.
   *
   * `execucao.escolaId` só pode vir de um `InterrompidaEncerrada` que o `ExecucaoRepository` devolveu do `returning` do `update` (`encerrarRodando`,
   * `encerrarRodandasVelhas`), nunca de argumento de quem chama de fora (regra 10, item 3): a FK composta `(escola_id, execucao_id)` de `consumo_ia` recusa a escola
   * que não é a da execução.
   */
  async registrarEstimada(execucao: InterrompidaEncerrada, destinos: readonly DestinoDoAdaptador[], precos: TabelaDePrecos): Promise<void> {
    const em = systemClock.agora()
    await runInContext({ requisicaoId: randomUUID(), escolaId: execucao.escolaId }, async () => {
      for (const destino of destinos) {
        await this.registrar(consumoEstimadoDaInterrompida({ tarefa: TASK_CATALOG[execucao.tarefa], destino, precos, execucaoId: execucao.id, duracaoMs: execucao.duracaoMs, em }))
      }
    })
  }
}
