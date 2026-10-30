import { currentContext, LOTE_DO_EXPURGO, type AlvoDoExpurgoDeAcesso, type ExpurgoDeAcessoRepository, type LoggerBase, type Clock } from '@educa/nucleo'
import { JobFailureCode, type TIPO_EXPURGAR_ACESSO } from '@educa/shared'
import type { Processador } from '../executor.js'
import { FalhaDeJob } from '../falha-de-job.js'

/** Quantas linhas saíram de cada alvo: um total por alvo, e o compilador recusa o objeto a que falte um. */
export type TotaisDoExpurgoDeAcesso = Record<AlvoDoExpurgoDeAcesso, number>

export interface DependenciasDoExpurgoDeAcesso {
  repositorio: Pick<ExpurgoDeAcessoRepository, 'apagarLoteVencido' | 'limparLoteDeContasSemUso'>
  relogio: Clock
  logger: LoggerBase
  /** Linhas por lote. Só o teste troca. */
  lote?: number
}

/**
 * `sistema.expurgar-acesso` (tarefa 17.0): apaga o registro de acesso com mais de 6 meses, a sessão encerrada ou
 * expirada há mais de 30 dias, o convite usado, revogado ou expirado há mais de 30 dias e o acesso da turma vencido ou
 * revogado há mais de 30 dias (A1, tarefa 10.0), e, com os mesmos prazos, o
 * acesso, a sessão e o convite da operação Turmma (tarefa 9.0), e o incidente de segurança com mais de 5 anos, com as seções
 * das escolas em cascata (F3, tarefa 9.0), um lote de 5.000 por
 * instrução, tabela por tabela, até sobrar lote incompleto. Depois limpa a conta da equipe que ficou sem usuário ativo
 * e sem convite válido, que a desativação deixou para quando o convite vencesse. Cada lote é uma transação curta: a sessão é lida pela
 * guarda em toda requisição, e o expurgo não pode segurar lock nela.
 *
 * O prazo é contado de um `agora` só, lido do relógio no começo: a execução inteira usa o mesmo corte, e o teste o
 * injeta nos limites.
 *
 * Tolera reexecução (D49): o que já saiu não volta, e apagar de novo não apaga nada. Duas execuções ao mesmo tempo
 * pegam linhas diferentes; o lote de um worker que morreu no meio é desfeito pelo Postgres e sai na execução seguinte.
 * Loga só as contagens, nunca linha.
 */
export function criarExpurgoDeAcesso({ repositorio, relogio, logger, lote = LOTE_DO_EXPURGO }: DependenciasDoExpurgoDeAcesso): Processador<typeof TIPO_EXPURGAR_ACESSO> {
  return async () => {
    if (currentContext()?.rotinaDoSistema !== true) throw new FalhaDeJob(JobFailureCode.DADOS_INVALIDOS, true)
    const agora = relogio.agora()
    const apagar = async (alvo: AlvoDoExpurgoDeAcesso): Promise<number> => {
      let total = 0
      for (;;) {
        const doLote = await repositorio.apagarLoteVencido(alvo, agora, lote)
        total += doLote
        if (doLote < lote) return total
      }
    }
    const limparContas = async (): Promise<number> => {
      let total = 0
      for (;;) {
        const doLote = await repositorio.limparLoteDeContasSemUso(agora, lote)
        total += doLote
        if (doLote < lote) return total
      }
    }
    // Uma tabela depois da outra, na ordem de `ALVOS_DO_EXPURGO_DE_ACESSO` (as propriedades avaliam na ordem em que estão
    // escritas, e o teste "lotes" confere a ordem), e a conta por último: nunca dois lotes do mesmo job ao mesmo tempo.
    // Objeto literal com o tipo declarado, sem afirmação: alvo novo sem total é erro de compilação (tarefa 9.0 da A0b).
    const totais: TotaisDoExpurgoDeAcesso = {
      registro_acesso: await apagar('registro_acesso'),
      sessao: await apagar('sessao'),
      convite: await apagar('convite'),
      acesso_turma: await apagar('acesso_turma'),
      acesso_operacao: await apagar('acesso_operacao'),
      sessao_operador: await apagar('sessao_operador'),
      convite_operador: await apagar('convite_operador'),
      incidente: await apagar('incidente'),
    }
    const contasLimpasTotal = await limparContas()
    const {
      registro_acesso: registrosDeAcessoTotal,
      sessao: sessoesTotal,
      convite: convitesTotal,
      acesso_turma: acessosDaTurmaTotal,
      acesso_operacao: acessosDaOperacaoTotal,
      sessao_operador: sessoesDeOperadorTotal,
      convite_operador: convitesDeOperadorTotal,
      incidente: incidentesTotal,
    } = totais
    // Só contagens, uma chave fixa por tabela.
    logger.info({
      evento: 'acesso.expurgado',
      registrosDeAcessoTotal,
      sessoesTotal,
      convitesTotal,
      acessosDaTurmaTotal,
      acessosDaOperacaoTotal,
      sessoesDeOperadorTotal,
      convitesDeOperadorTotal,
      incidentesTotal,
      contasLimpasTotal,
    })
  }
}
