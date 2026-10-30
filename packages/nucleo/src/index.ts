export {
  REQUEST_ID_HEADER,
  currentContext,
  setContextOperador,
  setContextSessao,
  runInContext,
  requireContextOperador,
  contextMiddleware,
  resolveRequestId,
} from './contexto/contexto.js'
export type { RequestContext, RequestSessao } from './contexto/contexto.js'
export { requireAnoEmCurso } from './contexto/ano-em-curso.js'
export { requireEscolaId } from './contexto/escola-do-contexto.js'
export {
  AMBIENTES,
  InvalidConfigError,
  EMISSOR_TOKEN,
  loadAuthConfig,
  isLoginProtectionDisabled,
  isEscolaConcurrencyLimitDisabled,
  MOTIVO_PROTECAO_DO_LOGIN_DESLIGADA_EM_PRODUCAO,
  MOTIVO_VAGAS_DESLIGADAS_EM_PRODUCAO,
  TAMANHO_MINIMO_CHAVE_ASSINATURA,
  validateEnvironment,
} from './config/validar-config.js'
export type { Environment, AuthConfig } from './config/validar-config.js'
export { pingDatabase, createPool, isConnectionError } from './db/pool.js'
export type { DatabaseConfig, DatabasePool } from './db/pool.js'
export { createDatabase, loadDatabaseConfig, schema } from './db/banco.js'
export type { Database, Schema, DatabaseTransaction } from './db/banco.js'
export { LOCK_TIMEOUT_MIGRACAO_MS, migrate, MigrationFailedError, PASTA_MIGRACOES, TENTATIVAS_MIGRACAO } from './db/migrar.js'
export type { MigrationConfig } from './db/migrar.js'
export { jobRegistro } from './db/schema/job-registro.js'
export { unscopedJustification, Unscoped, TAMANHO_MINIMO_JUSTIFICATIVA_SEM_ESCOPO } from './db/sem-escopo.decorator.js'
export {
  OperationalSettings,
  lerJanelaPadrao,
  lerVagasPadrao,
  NOVA_TENTATIVA_DA_CONFIGURACAO_MS,
  resolverJanela,
  resolverLimites,
  resolverVagas,
  resolverVagasDaEscola,
  VAGAS_SEM_LIMITE,
  VALIDADE_DA_CONFIGURACAO_MS,
} from './configuracao/configuracao-operacional.js'
export type { CampoDaJanelaDescartado, RateLimits, OperationalSettingsOptions, ConcurrencyByQueue } from './configuracao/configuracao-operacional.js'
export { estaNaJanela, fusoValido, msDoHorario, proximaAbertura } from './fila/janela-letiva.js'
export type { JanelaLetiva } from './fila/janela-letiva.js'
export { systemClock } from './relogio.js'
export type { Clock } from './relogio.js'
export { OperationalSettingsRepository } from './configuracao/configuracao-operacional.repository.js'
export type { OperationalSettingsRow } from './configuracao/configuracao-operacional.repository.js'
export { configuracaoOperacionalEscola } from './db/schema/configuracao-operacional-escola.js'
export type { ConfiguredConcurrency } from './db/schema/configuracao-operacional-escola.js'
export { DispatchRepository, IDADE_PARA_RECONCILIAR_SEGUNDOS, RESERVA_SEGUNDOS, TETO_DA_CONTAGEM_DE_FALHOS, TETO_DA_CONTAGEM_DE_PENDENTES } from './fila/despacho.repository.js'
export type { SweepCursor, EscolaWithPendingJobs, JobToSweep, ReservedJob, FailedJobsMeasurement, PendingJobsMeasurement } from './fila/despacho.repository.js'
export { QUEUES_BY_PRIORITY, bullmqQueueName, WORKER_POOL_OPTIONS_BY_QUEUE } from './fila/filas.js'
export type { WorkerPoolOptions } from './fila/filas.js'
export { DONO_DAS_VAGAS_DO_SISTEMA, INTERVALO_RENOVACAO_DA_VAGA_MS, EscolaConcurrencyLimiter, VALIDADE_DA_VAGA_MS } from './fila/vagas-por-escola.js'
export { JobOutbox, QUEUE_PRIORITY } from './fila/enfileirador.js'
export { JobRejectionReason, JobRequestRejectedError } from './fila/pedido-de-job-recusado.js'
export { CANAL_NOTIFICACAO_JOB, JobOutboxRepository, PREFIXO_TIPO_SISTEMA } from './fila/job-registro.repository.js'
export type { RegisteredJobState, JobToRun, IdempotencyKeyResult, JobStartResult } from './fila/job-registro.repository.js'
export { SyntheticEffectRepository, SYNTHETIC_EFFECT_TABLE } from './fila/efeito-sintetico.repository.js'
export type { SyntheticEffect } from './fila/efeito-sintetico.repository.js'
export { JobNotificationListener } from './fila/ouvinte-de-jobs.js'
export {
  queuedJobDataSchema,
  jobExecutor,
  jobOptions,
  RETENCAO_JOB_CONCLUIDO_SEGUNDOS,
  RETENCAO_JOB_FALHO_SEGUNDOS,
} from './fila/publicacao.js'
export type { QueuedJobData, PublishedJobOptions } from './fila/publicacao.js'
export { DomainException, HTTP_STATUS_BY_CODE, DEFAULT_RETRY_AFTER_SECONDS } from './erro/erro-de-dominio.js'
export { AllExceptionsFilter } from './erro/filtro-global.js'
export { mapPostgresError } from './erro/mapear-erro-postgres.js'
export { isPostgresError, postgresErrorIn, summarizeError } from './erro/resumir-erro.js'
export type { PostgresError, ErrorSummary } from './erro/resumir-erro.js'
export { AuthGuard, requestIdentity, requestSessao } from './identidade/guarda-autenticacao.js'
export {
  ALGORITMO_TOKEN,
  operadorBearer,
  COOKIE_SESSAO_DE_OPERADOR,
  operadorCookie,
  extractBearerToken,
  TIPO_DESAFIO,
  TIPO_DESAFIO_DE_OPERADOR,
  TIPO_TOKEN,
  TIPO_TOKEN_DE_OPERADOR,
  VALIDADE_MAXIMA_TOKEN_SEGUNDOS,
  verifyToken,
  verifyOperadorToken,
} from './identidade/verificar-token.js'
export { operacaoMarker, OPERACAO_ENTRY_KEY, OPERACAO_ROUTE_KEY } from './identidade/marcadores-de-operacao.js'
export type { OperacaoMarker } from './identidade/marcadores-de-operacao.js'
export { isChallengeBearer, isRouteWithoutSessao } from './identidade/rota-sem-sessao.js'
export type { Identity, VerifiedOperadorToken, VerifiedToken } from './identidade/verificar-token.js'
export { TokenIssuer, OperadorTokenIssuer, VALIDADE_TOKEN_ACESSO_SEGUNDOS } from './identidade/emissor-de-token.js'
export type { AccessTokenRequest, OperadorTokenRequest, AccessToken } from './identidade/emissor-de-token.js'
export { avaliarSessao, inatividadeDoPapel, sessaoAindaVale, tokenDaUltimaRenovacao, TOLERANCIA_DE_INATIVIDADE_MIN } from './identidade/avaliar-sessao.js'
export type { EstadoDaSessao } from './identidade/avaliar-sessao.js'
export { SessaoGuard } from './identidade/guarda-sessao.js'
export type { SessaoReader } from './identidade/guarda-sessao.js'
export { SessaoRepository } from './identidade/sessao.repository.js'
export type { SessaoRow } from './identidade/sessao.repository.js'
export { IdPipe, ZodValidationPipe } from './entrada/index.js'
export type { IdPipeOptions, ZodValidationPipeOptions } from './entrada/index.js'
export { PermissaoBootCheck, RoutesWithoutPermissaoError, routesWithoutPermissao } from './permissao/conferencia-das-permissoes.js'
export type { UndeclaredRoute } from './permissao/conferencia-das-permissoes.js'
export { PermissaoGuard } from './permissao/guarda-permissao.js'
export { PERMISSAO_KEY, RequirePermissao } from './permissao/permite.decorator.js'
export type { PermittedCell } from './permissao/permite.decorator.js'
export { CAMINHOS_REDACT, CHAVES_DE_CREDENCIAL, CHAVES_DE_IDENTIDADE, CHAVES_PESSOAIS, createLogger, registerProcessErrorHandlers, TEXTO_REMOVIDO } from './log/logger.js'
export { throttledWarn } from './log/aviso-espacado.js'
export { NestLogger, TEXTO_MENSAGEM_OMITIDA } from './log/logger-do-nest.js'
export type { LoggerBase, LoggerOptions } from './log/logger.js'
export { ARQUIVO_BATIMENTO, Heartbeat, COMANDO_HEALTHCHECK_BATIMENTO, IDADE_MAXIMA_BATIMENTO_MS } from './instancia/batimento.js'
export { GracefulShutdown, loadGracefulShutdownConfig, OCIOSIDADE_HTTP_MS } from './instancia/drenagem.js'
export type { GracefulShutdownConfig, ReadinessResult } from './instancia/drenagem.js'
export {
  IP_DESCONHECIDO,
  clientIp,
  JANELA_LIMITE_SEGUNDOS,
  insuranceLimit,
  PREFIXO_LIMITE_BUSCA_TITULAR,
  PREFIXO_LIMITE_ESCOLA,
  PREFIXO_LIMITE_IP,
  PREFIXO_LIMITE_IP_LOGIN,
  PREFIXO_LIMITE_IP_OPERACAO,
  PREFIXO_LIMITE_OPERADOR,
  PREFIXO_LIMITE_USUARIO,
  retryAfterSeconds,
} from './limite/chaves.js'
export { isOverIpLimit, RateLimitGuard, requestIp } from './limite/guarda-limite.js'
export { RateLimiter, loadRateLimitConfig } from './limite/limitador.js'
export type { RateLimitConfig, RateLimitResult } from './limite/limitador.js'
export { TrustedProxies } from './limite/proxies-confiaveis.js'
export { AcceptsChallenge, DowngradeRateLimit, IS_PUBLIC_KEY, Public, SkipRateLimit } from './limite/rota-anonima.decorator.js'
export { TitularSearchRateLimit, TITULAR_SEARCH_RATE_LIMIT_KEY } from './limite/limite-da-busca-de-titulares.decorator.js'
export { createApiRedisClient, createQueueRedisClient, TIMEOUT_COMANDO_REDIS_API_MS, TIMEOUT_COMANDO_REDIS_FILA_MS } from './redis/clientes.js'
export { usoInfraDiario } from './db/schema/uso-infra-diario.js'
export { diaAnterior, diaDeUso, diaValido, FORMATO_DIA, FORMATO_MES, FUSO_DO_USO, limitesDoMes } from './uso/dia-de-uso.js'
export { CHAVES_POR_LEITURA, UsageMeter, VALIDADE_DO_CONTADOR_SEGUNDOS } from './uso/contador-uso.js'
export type { DailyCount, UsageMetric, UsageMeterOptions } from './uso/contador-uso.js'
export { UsageInterceptor } from './uso/interceptor-de-uso.js'
export { UsageRepository } from './uso/uso.repository.js'
export type { UsagePeriod } from './uso/uso.repository.js'
export { startTelemetry, loadTelemetryConfig, globalMeter, NOME_DO_MEDIDOR, PRAZO_DA_EXPORTACAO_MS } from './telemetria/iniciar.js'
export { metricsTemporality } from './telemetria/temporalidade.js'
export type { TelemetryConfig, InstrumentedService, Telemetry } from './telemetria/iniciar.js'
export {
  LIMITES_DO_HISTOGRAMA_HTTP_S,
  METRICS,
  METRICS_WITH_ESCOLA,
  httpMetricsMiddleware,
  observeRealtimeConnections,
  observeEventLoop,
  observeDatabasePool,
  observeRedis,
  observeInsuranceLimiter,
  ROTA_NAO_ENCONTRADA,
  requestRoute,
  ROTULO_ESCOLA,
} from './telemetria/metricas.js'
export type { RedisInstance } from './telemetria/metricas.js'
export type { Meter } from '@opentelemetry/api'
export { FATIAS_DA_PROPORCAO_DO_SEGURO, JANELA_DA_PROPORCAO_DO_SEGURO_MS, SlidingWindowRatio } from './limite/proporcao-em-janela.js'
export { ExpurgoDeJobsRepository, expurgoExpiredBatchStatement, LOTE_DO_EXPURGO, RETENCAO_JOB_REGISTRO_DIAS } from './retencao/expurgo-de-jobs.repository.js'
export {
  ALVOS_DO_EXPURGO_DE_ACESSO,
  ExpurgoDeAcessoRepository,
  expurgoAccessBatchStatement,
  RETENCAO_CONVITE_DIAS,
  RETENCAO_INCIDENTE_ANOS,
  RETENCAO_REGISTRO_ACESSO_MESES,
  RETENCAO_SESSAO_DIAS,
} from './retencao/expurgo-de-acesso.repository.js'
export type { AlvoDoExpurgoDeAcesso } from './retencao/expurgo-de-acesso.repository.js'
export { rede, TIPOS_DE_REDE } from './db/schema/rede.js'
export type { TipoDeRede } from './db/schema/rede.js'
export { escola, FORMATO_SLUG, INATIVIDADE_ALUNO_PADRAO_MIN, INATIVIDADE_EQUIPE_PADRAO_MIN, TAMANHO_MAXIMO_SLUG } from './db/schema/escola.js'
export { FORMATO_OPERADOR } from './db/schema/auditoria.js'
export { anoLetivo, SITUACOES_DE_ANO_LETIVO } from './db/schema/ano-letivo.js'
export type { SituacaoDeAnoLetivo } from './db/schema/ano-letivo.js'
export { conta } from './db/schema/conta.js'
export { codigoRecuperacao } from './db/schema/codigo-recuperacao.js'
export { usuario } from './db/schema/usuario.js'
export { serie } from './db/schema/serie.js'
export { disciplina } from './db/schema/disciplina.js'
export { turma } from './db/schema/turma.js'
export { vinculo } from './db/schema/vinculo.js'
export { credencialMatricula } from './db/schema/credencial-matricula.js'
export { listaNome } from './db/schema/lista-nome.js'
export { acessoTurma } from './db/schema/acesso-turma.js'
export { reivindicacao } from './db/schema/reivindicacao.js'
export { retencaoEscola } from './db/schema/retencao-escola.js'
export { suboperador, suboperadorEscola } from './db/schema/suboperador.js'
export { SuboperadorDaEscolaRepository } from './titular/suboperador-da-escola.repository.js'
export type { SuboperadorLidoPelaEscola } from './titular/suboperador-da-escola.repository.js'
export { Compartilhamento } from './titular/compartilhamento.js'
export { haHomonimoDoTitular } from './titular/homonimo.js'
export { COLUNAS_DA_TROCA_DE_NOME, FAIXA_DA_TROCA_DE_NOME, NOME_REMOVIDO, padraoDoNome, TrocaDeNome } from './titular/troca-de-nome.js'
export type { ColunaDaTroca, PedidoDeTroca, ResultadoDaTroca } from './titular/troca-de-nome.js'
export { EliminacaoDoTitular } from './titular/eliminacao-do-titular.js'
export { EliminacaoDoTitularRepository } from './titular/eliminacao-do-titular.repository.js'
export type { EliminacaoOptions, ResultadoDaEliminacao } from './titular/eliminacao-do-titular.js'
export { alunoTrailStatement } from './titular/compartilhamento.repository.js'
export type { AlvoDoCompartilhamento } from './titular/compartilhamento.js'
export { incidente, incidenteEscola } from './db/schema/incidente.js'
export { IncidenteDaEscolaRepository } from './titular/incidente-da-escola.repository.js'
export type { IncidenteLidoPelaEscola } from './titular/incidente-da-escola.repository.js'
export { pedidoTitular } from './db/schema/pedido-titular.js'
export { arquivoTitular } from './db/schema/arquivo-titular.js'
export { InMemoryFileStorage, FileStorageUnavailableError } from './titular/armazem-de-arquivos.js'
export type { FileStorage, DownloadUrlOptions, FakeSignedUrl } from './titular/armazem-de-arquivos.js'
export { ArquivoDoTitularRepository, objectKey } from './titular/arquivo-do-titular.repository.js'
export type { ArquivoAApagar, ArquivoLido, PedidoDoUsuario, PedidoParaMontar } from './titular/arquivo-do-titular.repository.js'
export { selectColumns, LEITURAS_DO_ARQUIVO, LeituraDoTitular } from './titular/leitura-do-titular.js'
export type { CompartilhamentoDoArquivo, DocumentoDoTitular, TableRows, PedidoDeLeitura } from './titular/leitura-do-titular.js'
export { RetencaoDaEscolaRepository } from './retencao/retencao-da-escola.repository.js'
export type { AjusteAGravar } from './retencao/retencao-da-escola.repository.js'
export { expurgoExecucao } from './db/schema/expurgo-execucao.js'
export {
  ALVOS_DO_EXPURGO_DA_ESCOLA,
  CATEGORIAS_DO_EXPURGO,
  ExpurgoDaEscolaRepository,
  expurgoDeactivatedPeopleStatement,
  expurgoSchoolBatchStatement,
  expurgoRecordStatement,
  LIMITE_DE_ELIMINACOES_ENFILEIRADAS_POR_NOITE,
  LOTE_MAXIMO_DO_ALVO,
  NOITES_DO_ALERTA,
  noitesSeguidasSemConcluir,
  ordemDaNoite,
  RETENCAO_EXPURGO_EXECUCAO_MESES,
} from './retencao/expurgo-da-escola.repository.js'
export type { AlvoDoExpurgoDaEscola, CategoriaDoExpurgo, EliminacoesEnfileiradas, LoteDoExpurgo, NoiteDoExpurgo, PrazoDoLote } from './retencao/expurgo-da-escola.repository.js'
export { CronEscolasRepository } from './rotina/escolas-da-rotina.repository.js'
export * from './db/schema/mvp/tabelas.js'
export { contaExterna, PROVEDORES_EXTERNOS } from './db/schema/conta-externa.js'
export type { ProvedorExterno } from './db/schema/conta-externa.js'
export { provedorEscola } from './db/schema/provedor-escola.js'
export { convite, TIPOS_DE_CONVITE, VALIDADE_DO_CONVITE_HORAS, VALIDADE_DO_CONVITE_HORAS_POR_TIPO } from './db/schema/convite.js'
export { estadoDaCoordenacao } from './convite/estado-da-coordenacao.js'
export type { DadosDaCoordenacao, UltimoConviteDaCoordenacao } from './convite/estado-da-coordenacao.js'
export { estadoDoProfessor } from './convite/estado-do-professor.js'
export type { DadosDoProfessor, UltimoConviteDoProfessor } from './convite/estado-do-professor.js'
export type { TipoDeConvite } from './db/schema/convite.js'
export { DURACAO_DA_SESSAO_HORAS, METODOS_DE_SESSAO, MOTIVOS_DE_ENCERRAMENTO, sessao } from './db/schema/sessao.js'
export type { MetodoDeSessao, MotivoDeEncerramento } from './db/schema/sessao.js'
export { EVENTOS_DE_ACESSO, registroAcesso } from './db/schema/registro-acesso.js'
export type { EventoDeAcesso } from './db/schema/registro-acesso.js'
export {
  ACOES_DA_AUDITORIA_DA_OPERACAO,
  acessoOperacao,
  auditoriaOperacao,
  AUTOR_BOOTSTRAP,
  codigoRecuperacaoOperador,
  conviteOperador,
  EVENTOS_DE_ACESSO_DA_OPERACAO,
  MOTIVOS_DE_ENCERRAMENTO_DE_OPERADOR,
  operador,
  sessaoOperador,
  VALIDADE_DO_CONVITE_DE_OPERADOR_HORAS,
} from './db/schema/operador.js'
export type { AcaoDaAuditoriaDaOperacao, EventoDeAcessoDaOperacao, MotivoDeEncerramentoDeOperador } from './db/schema/operador.js'
export { ACOES_DE_AUDITORIA, CAMPOS_PROIBIDOS_NA_AUDITORIA, problemasDoMapaDeAcoes } from './auditoria/acoes.js'
export type { AcaoDeAuditoria, DefinicaoDeAcao, EstadosDaAcao } from './auditoria/acoes.js'
export { AuditoriaRejectedError, MOTIVOS_DE_RECUSA_DA_AUDITORIA } from './auditoria/auditoria-recusada.js'
export type { AuditoriaRejectionReason } from './auditoria/auditoria-recusada.js'
export { AuditoriaRecorder } from './auditoria/registro-de-auditoria.js'
export type { DadosDaAuditoria } from './auditoria/registro-de-auditoria.js'
// Só leitura: a escrita em `auditoria` tem uma porta só, o AuditoriaRecorder (a tabela e o insert ficam fora do pacote).
export { AuditoriaRepository, LIMITE_MAXIMO_DA_LISTAGEM, LIMITE_PADRAO_DA_LISTAGEM } from './auditoria/auditoria.repository.js'
export type { DatabaseExecutor, RegistroAuditado } from './auditoria/auditoria.repository.js'
// Camada de IA (regra 30): o domínio importa a porta, as tarefas e os erros; adaptador é detalhe daqui.
export {
  ADAPTADORES_DE_IA,
  llmEnvSchema,
  loadLLMConfig,
  MOTIVO_ADAPTADOR_FALSO_EM_PRODUCAO,
  MOTIVO_EXECUCAO_MAIS_CURTA_QUE_A_CHAMADA,
  MOTIVO_LLM_SEM_ENDERECO,
  MOTIVO_LLM_SEM_MODELO,
  MOTIVO_PROCESSAMENTO_LOCAL_EM_ENDERECO_DE_FORA,
  MOTIVO_RECUO_MAIOR_QUE_O_PRAZO,
  MOTIVO_VAGAS_DE_IA_INCOERENTES,
} from './config/config-ia.js'
export type { LLMAdapterKind, LLMConfig, AgenteExecutorConfig, ModelConfig } from './config/config-ia.js'
export type { Perfil } from './ia/perfis.js'
export { LLM_ERROR_CODES, LLMError } from './ia/erros.js'
export type { LLMErrorCode } from './ia/erros.js'
export type { LLMProvider, GenerationMeasurement, OutputSource, GenerationRequest, GenerationResult } from './ia/porta.js'
export { MaterialSemConteudoAproveitavelError } from './ia/tarefa.js'
export type { PromptData, TaskDefinition, ModelRequest, VersionedPrompt } from './ia/tarefa.js'
export { InMemoryConsumo, InMemoryOrcamento } from './ia/consumo.js'
export type { OrcamentoCode, OrcamentoQuery, ConsumoDeIa, OrcamentoDecision, InMemoryOrcamentoLimits, OrcamentoDeIa, RegistroDeConsumo } from './ia/consumo.js'
export { exigirFuncaoAtiva, InMemorySuspensoes } from './ia/suspensao.js'
export type { SuspensaoDeFuncao } from './ia/suspensao.js'
export { createLLMGateway, MODELO_DA_REGRA_FIXA, LLMGateway } from './ia/provedor.js'
export type { LLMGatewayDependencies, LLMGatewayPorts, LLMLogger } from './ia/provedor.js'
export { FakeAdapter, MODELO_FALSO } from './ia/adaptador-falso.js'
export { OpenAICompatAdapter } from './ia/adaptador-openai-compat.js'
export type { ModelAdapter } from './ia/adaptador.js'
export { ESTADOS_DA_EXECUCAO, EXECUCAO_INTERROMPIDA, InMemoryExecucoes, InProcessAgenteExecutor } from './ia/executor.js'
export type { CodigoDeFalhaDaExecucao, AgenteExecutorDependencies, EstadoDaExecucao, ExecucaoAgendada, AgenteExecutor, ExecucaoRepository } from './ia/executor.js'
export { contextoDaTurmaSchema, trechoSchema } from './ia/material.js'
export type { ContextoDaTurma, Trecho } from './ia/material.js'
export { TASK_CATALOG } from './ia/tarefas/index.js'
export { adaptarAtividade, adaptacaoInputSchema } from './ia/tarefas/adaptar-atividade.js'
export type { AdaptacaoInput } from './ia/tarefas/adaptar-atividade.js'
export { atividadeObjetivaInputSchema, gerarAtividadeObjetiva } from './ia/tarefas/gerar-atividade-objetiva.js'
export type { AtividadeObjetivaInput } from './ia/tarefas/gerar-atividade-objetiva.js'
export { planoDeAulaInputSchema, gerarPlanoDeAula } from './ia/tarefas/gerar-plano-de-aula.js'
export type { PlanoDeAulaInput } from './ia/tarefas/gerar-plano-de-aula.js'
export {
  atribuiNotaOuConceito,
  conversaPedeJulgamentoDeTextoDeAluno,
  assistenteInputSchema,
  propostaDoAssistenteSchema,
  assistenteOutputSchema,
  pedeJulgamentoDeTextoDeAluno,
  proporFerramenta,
  RECUSA_DE_CORRECAO_DE_TEXTO_DE_ALUNO,
  turnosQuePodemIrAoModelo,
} from './ia/tarefas/propor-ferramenta.js'
export type { AssistenteInput, PropostaDoAssistente, AssistenteOutput } from './ia/tarefas/propor-ferramenta.js'
export { relatorioInputSchema, relatorioOutputSchema, relatorioDaCorrecao } from './ia/tarefas/relatorio-da-correcao.js'
export type { RelatorioInput, RelatorioOutput } from './ia/tarefas/relatorio-da-correcao.js'
export { analistaInputSchema, analistaOutputSchema, resumoDoAnalista } from './ia/tarefas/resumo-do-analista.js'
export type { AnalistaInput, AnalistaOutput } from './ia/tarefas/resumo-do-analista.js'
export {
  CLASSIFICACOES_DO_TURNO,
  tutorInputSchema,
  tutorOutputSchema,
  MENSAGEM_DE_ASSUNTO_DELICADO,
  MENSAGEM_DE_RISCO_A_VIDA,
  ehAssuntoDelicado,
  turnoDoTutor,
} from './ia/tarefas/turno-do-tutor.js'
export type { ClassificacaoDoTurno, TutorInput, TutorOutput } from './ia/tarefas/turno-do-tutor.js'
