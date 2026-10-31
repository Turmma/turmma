import { consumoIa, requireEscolaId, type Database, type ConsumoDeIa, type RegistroDeConsumo, type DatabaseTransaction } from '@educa/core'

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
}
