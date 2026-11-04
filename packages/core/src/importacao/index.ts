// As planilhas da escola (F2, tarefa 4.0): o motor da prévia, do gravar e do job de três passos, e o repository da fila e do calendário.
export { CalendarioRepository } from './calendario.repository.js'
export { ImportacaoRepository, TAMANHO_DO_LOTE } from './importacao.repository.js'
export type { AnoDeDestino, EventoGravado, EventoNovo, ImportacaoLida, ImportacaoParaExecutar, NovaImportacao } from './importacao.repository.js'
export { ehFalhaDeTrava, executarPlanilha, ImportacaoIlegivelError, MotorDePlanilha, TENTATIVAS_DO_JOB } from './motor.js'
export type { ExecucaoOptions, ResultadoDaExecucao } from './motor.js'
export type { PlanoDaImportacao, PreviaDoTipo, TipoDeImportacao } from './tipo.js'
