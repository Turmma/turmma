# Inventário de rename (D81) — `packages/nucleo` e `packages/shared`

Levantamento só de leitura (nenhum arquivo do repositório foi tocado). Base: `export (abstract )?(class|interface|type|enum|const|function)` de `packages/nucleo/src` e `packages/shared/src` (1.648 exports) + nomes de arquivo e de pasta, abrindo o arquivo quando o nome não bastava. Referência de equivalentes: `docs/guia-do-desenvolvedor.md` §9 e `packages/nucleo/src/ia/README.md`.

**Como ler as colunas.** *Usos* = nº de arquivos do repositório (apps, packages, tools, infra, e2e; sem `node_modules`, `dist`, `docs`, `tasks`) em que o nome aparece como palavra inteira, **sem contar o arquivo que o define**; inclui o `index.ts` que reexporta e inclui menções em comentário, então é um piso para o trabalho de rename e um teto para "quem importa". Em nomes muito genéricos (`Dado`, `Fila`, `Banco`, `Identidade`, `Ambiente`, `Relogio`, `migrar`, `Telemetria`) o número é inflado por texto comum; o rename deve ser feito por símbolo (TS language service), não por busca textual. Em *Arquivos*, o número é de quem importa o arquivo pelo caminho.

**Convenção de nome misto** (a da D81): domínio em português + sufixo técnico em inglês (`TurmaController`). Onde a peça técnica carrega um conceito de domínio, o conceito fica: `RequirePermissao`, `SessaoGuard`, `EscolaConcurrencyLimiter`, `requireEscolaId`.

## 0. Pacote

| Atual | Proposto | Tipo | Onde | Usos |
|---|---|---|---|---|
| `@educa/nucleo` | `@educa/core` (já decidido; só registro) | pacote | `packages/nucleo/package.json`, pasta `packages/nucleo` → `packages/core` | ver `grep -rl "@educa/nucleo"` na X8 |
| subcaminho `@educa/nucleo/armazem-s3` | `@educa/core/s3-file-storage` | export do `package.json` | `packages/nucleo/package.json` (`exports`) | 5 arquivos (`apps/api` privacidade.module, `apps/worker` montagem, testes) |
| subcaminhos `@educa/nucleo/ciclo-de-vida` e `/conta-global` | ficam (domínio: ciclo de vida do titular, conta global); só o prefixo do pacote muda | export do `package.json` | `packages/nucleo/package.json` | — |
| `@educa/shared` | fica | pacote | — | — |
| script `build` copia `src/fila/vaga.lua` para `dist/fila/vaga.lua` | atualizar para `src/queue/concurrency-slot.lua` → `dist/queue/concurrency-slot.lua` (e o `readFileSync` em `vagas-por-escola.ts`) | script | `packages/nucleo/package.json` | 1 |

## 1. Regras de tradução (resumo)

| Português | Inglês | Exemplo |
|---|---|---|
| `Adaptador<X>` | `<X>Adapter` | `AdaptadorFalso` → `FakeAdapter` |
| `Guarda<X>` | `<X>Guard` | `GuardaDeSessao` → `SessaoGuard` |
| `Filtro<X>` | `<X>Filter` | `FiltroGlobalDeErro` → `AllExceptionsFilter` |
| `Interceptor<X>` | `<X>Interceptor` | `InterceptorDeUso` → `UsageInterceptor` |
| `Emissor<X>` | `<X>Issuer` | `EmissorDeToken` → `TokenIssuer` |
| `Erro<X>` (peça técnica) | `<X>Error` / `<X>Exception` | `ErroDeIa` → `LLMError`; `ErroDeDominio` → `DomainException` |
| `<X>EmMemoria` | `InMemory<X>` | `ArmazemEmMemoria` → `InMemoryFileStorage` |
| `Configuracao<X>` | `<X>Config` | `ConfiguracaoBanco` → `DatabaseConfig` |
| `Opcoes<X>` | `<X>Options` | `OpcoesDoPool` → `WorkerPoolOptions` |
| `Dependencias<X>` | `<X>Dependencies` | `DependenciasDoProvedor` → `LLMGatewayDependencies` |
| `Linha<X>` | `<X>Row` | `LinhaDaSessao` → `SessaoRow` |
| `METADADO_<X>` | `<X>_KEY` | `METADADO_ROTA_ANONIMA` → `IS_PUBLIC_KEY` |
| `esquema<X>` (zod) | `<x>Schema` | `esquemaTurma` → `turmaSchema` |
| `Pedido<X>` / `Resposta<X>` / `Consulta<X>` (DTO HTTP) | `<X>Request` / `<X>Response` / `<X>Query` | `RespostaLogin` → `LoginResponse` |
| `EntradaDe<X>` / `SaidaDe<X>` (tarefa de IA) | `<X>Input` / `<X>Output` | `EntradaDoTutor` → `TutorInput` |
| `lerConfiguracao<X>` | `load<X>Config` | `lerConfiguracaoBanco` → `loadDatabaseConfig` |
| pasta/arquivo técnico | inglês, kebab-case, sufixo do Nest (`.guard.ts`, `.filter.ts`, `.exception.ts`, `.decorator.ts`, `.interceptor.ts`) | `guarda-limite.ts` → `rate-limit.guard.ts` |

Fora do rename (por regra): métodos de classe e verbos de utilitário de domínio (`estimarTokens`, `limparSaidaDoModelo`, `avaliarSessao`, `estaNaJanela`, `normalizar`, `frases`...), constantes de valor `UPPER_SNAKE` que não são mapa, token ou instância (442 em nucleo+shared: `TAMANHO_MAXIMO_EMAIL`, `RETENCAO_SESSAO_DIAS`, `MOTIVO_*`, `PREFIXO_LIMITE_*`...; ver dúvida 7), strings de coluna, tabela, fila, rota, métrica, evento de log e código de erro.

## 2. Provedor de IA, adaptadores e tarefas

Regras: `Adaptador<X>` → `<X>Adapter`; a porta `LLMProvider` já é nome de mercado e fica; a classe que implementa a porta e orquestra (`ProvedorDeIa`) → `LLMGateway`; `<X>EmMemoria` → `InMemory<X>`; `Dependencias<X>` → `<X>Dependencies`; `Opcoes<X>` → `<X>Options`; `Configuracao<X>` → `<X>Config`; `PedidoAoModelo`/`RespostaDoModelo` → `ModelRequest`/`ModelResponse`. Ficam por serem domínio: `OrcamentoDeIa`, `SuspensaoDeFuncao`, `RegistroDeConsumo`, `ConsumoDeIa`, `Perfil`, `PERFIS`, `ExecucaoAgendada`, as tarefas (`gerarAtividadeObjetiva`, `proporFerramenta`, `turnoDoTutor`...) e os `PROMPT_*`.

| Atual | Proposto | Tipo | Onde (packages/) | Usos |
|---|---|---|---|---|
| `AdaptadorDeIa` | `LLMProviderKind` | type | `nucleo/src/config/config-ia.ts` | 1 |
| `ConfiguracaoDeIa` | `LLMConfig` | interface | `nucleo/src/config/config-ia.ts` | 5 |
| `ConfiguracaoDoExecutor` | `AgenteExecutorConfig` | interface | `nucleo/src/config/config-ia.ts` | 2 |
| `ConfiguracaoDoModelo` | `ModelConfig` | interface | `nucleo/src/config/config-ia.ts` | 3 |
| `esquemaAmbienteDeIa` | `llmEnvSchema` | const (zod) | `nucleo/src/config/config-ia.ts` | 1 |
| `lerConfiguracaoDeIa` | `loadLLMConfig` | função | `nucleo/src/config/config-ia.ts` | 4 |
| `AdaptadorFalso` | `FakeAdapter` | class | `nucleo/src/ia/adaptador-falso.ts` | 5 |
| `OpcoesDoAdaptadorFalso` | `FakeAdapterOptions` | interface | `nucleo/src/ia/adaptador-falso.ts` | 0 |
| `AdaptadorOpenAICompat` | `OpenAICompatAdapter` | class | `nucleo/src/ia/adaptador-openai-compat.ts` | 3 |
| `MensagemDoChat` | `ChatMessage` | interface | `nucleo/src/ia/adaptador-openai-compat.ts` | 0 |
| `AdaptadorResiliente` | `ResilientAdapter` | class | `nucleo/src/ia/adaptador-resiliente.ts` | 4 |
| `PoliticaDeResiliencia` | `ResiliencePolicy` | interface | `nucleo/src/ia/adaptador-resiliente.ts` | 1 |
| `AdaptadorDeModelo` | `ModelAdapter` | interface | `nucleo/src/ia/adaptador.ts` | 10 |
| `ChamadaAoModelo` | `ModelCall` | interface | `nucleo/src/ia/adaptador.ts` | 5 |
| `CorrecaoPedida` | `RepairHint` | interface | `nucleo/src/ia/adaptador.ts` | 2 |
| `RespostaDoModelo` | `ModelResponse` | interface | `nucleo/src/ia/adaptador.ts` | 5 |
| `CodigoDeOrcamento` | `OrcamentoCode` | type | `nucleo/src/ia/consumo.ts` | 1 |
| `ConsultaDeOrcamento` | `OrcamentoQuery` | interface | `nucleo/src/ia/consumo.ts` | 4 |
| `ConsumoEmMemoria` | `InMemoryConsumo` | class | `nucleo/src/ia/consumo.ts` | 9 |
| `DecisaoDoOrcamento` | `OrcamentoDecision` | type | `nucleo/src/ia/consumo.ts` | 2 |
| `LimitesDoOrcamentoEmMemoria` | `InMemoryOrcamentoLimits` | interface | `nucleo/src/ia/consumo.ts` | 1 |
| `OrcamentoEmMemoria` | `InMemoryOrcamento` | class | `nucleo/src/ia/consumo.ts` | 9 |
| `RegistroEmMemoria` | `InMemoryRecord` | type | `nucleo/src/ia/consumo.ts` | 0 |
| `CODIGOS_DE_ERRO_DE_IA` | `LLM_ERROR_CODES` | const (lista) | `nucleo/src/ia/erros.ts` | 2 |
| `CodigoDeErroDeIa` | `LLMErrorCode` | type | `nucleo/src/ia/erros.ts` | 4 |
| `ErroDeIa` | `LLMError` | class | `nucleo/src/ia/erros.ts` | 25 |
| `ErroDoProvedor` | `ProviderError` | class | `nucleo/src/ia/erros.ts` | 3 |
| `FalhaDoProvedor` | `ProviderFailure` | type | `nucleo/src/ia/erros.ts` | 3 |
| `DependenciasDoExecutor` | `AgenteExecutorDependencies` | interface | `nucleo/src/ia/executor.ts` | 3 |
| `ExecucoesEmMemoria` | `InMemoryExecucoes` | class | `nucleo/src/ia/executor.ts` | 2 |
| `ExecutorDeAgente` | `AgenteExecutor` | interface | `nucleo/src/ia/executor.ts` | 9 |
| `EXECUTOR_DE_AGENTE` | `AGENTE_EXECUTOR` | token DI (achado na consolidação; `ORCAMENTO_DE_IA` e `SUSPENSAO_DE_FUNCAO` ficam, porque a peça é de domínio) | `apps/api/src/ia/ia.module.ts` | a contar |
| `ExecutorNoProcesso` | `InProcessAgenteExecutor` | class | `nucleo/src/ia/executor.ts` | 12 |
| `RepositorioDeExecucoes` | `ExecucaoRepository` | interface | `nucleo/src/ia/executor.ts` | 4 |
| `MedicaoDaGeracao` | `GenerationMeasurement` | type | `nucleo/src/ia/porta.ts` | 3 |
| `OrigemDaSaida` | `OutputSource` | type | `nucleo/src/ia/porta.ts` | 3 |
| `PedidoDeGeracao` | `GenerationRequest` | interface | `nucleo/src/ia/porta.ts` | 3 |
| `ResultadoDaGeracao` | `GenerationResult` | interface | `nucleo/src/ia/porta.ts` | 3 |
| `DependenciasDoProvedor` | `LLMGatewayDependencies` | interface | `nucleo/src/ia/provedor.ts` | 1 |
| `PortasDoProvedor` | `LLMGatewayPorts` | interface | `nucleo/src/ia/provedor.ts` | 1 |
| `ProvedorDeIa` | `LLMGateway` | class | `nucleo/src/ia/provedor.ts` | 11 |
| `RegistradorDeIa` | `LLMLogger` | type | `nucleo/src/ia/provedor.ts` | 2 |
| `criarProvedorDeIa` | `createLLMGateway` | função | `nucleo/src/ia/provedor.ts` | 6 |
| `SuspensoesEmMemoria` | `InMemorySuspensoes` | class | `nucleo/src/ia/suspensao.ts` | 9 |
| `Dado` | `PromptData` | interface | `nucleo/src/ia/tarefa.ts` | 26 |
| `DefinicaoDeTarefa` | `TaskDefinition` | interface | `nucleo/src/ia/tarefa.ts` | 11 |
| `MaterialSemConteudoAproveitavel` | `MaterialSemConteudoAproveitavelError` | class | `nucleo/src/ia/tarefa.ts` | 4 |
| `PedidoAoModelo` | `ModelRequest` | interface | `nucleo/src/ia/tarefa.ts` | 1 |
| `PromptVersionado` | `VersionedPrompt` | interface | `nucleo/src/ia/tarefa.ts` | 8 |
| `definirTarefa` | `defineTask` | função | `nucleo/src/ia/tarefa.ts` | 7 |
| `CATALOGO_DE_TAREFAS` | `TASK_CATALOG` | const (mapa) | `nucleo/src/ia/tarefas/index.ts` | 2 |

## 3. Fixtures de teste do pacote (nucleo/src/ia/__fixtures__)

Regra: o fixture segue a peça que ele imita (`AdaptadorRoteirizado` → `ScriptedAdapter`); `amostras-do-X` → `X-samples`; `ouro` → `golden`.

| Atual | Proposto | Tipo | Onde (packages/) | Usos |
|---|---|---|---|---|
| `AdaptadorRoteirizado` | `ScriptedAdapter` | class | `nucleo/src/ia/__fixtures__/adaptador-roteirizado.ts` | 7 |
| `AmostraDaRevisao` | `ReviewSample` | interface | `nucleo/src/ia/__fixtures__/amostras-do-assistente-revisao.ts` | 0 |
| `AmostraDoAssistente` | `AssistenteSample` | interface | `nucleo/src/ia/__fixtures__/amostras-do-assistente.ts` | 0 |
| `AmostraDePedido` | `RequestSample` | interface | `nucleo/src/ia/__fixtures__/amostras-do-tutor.ts` | 1 |
| `AmostraDeSaida` | `OutputSample` | interface | `nucleo/src/ia/__fixtures__/amostras-do-tutor.ts` | 0 |
| `comContextoDaEscolaDoPedido` | `withEscolaContextOfRequest` | função | `nucleo/src/ia/__fixtures__/contexto-da-escola.ts` | 6 |
| `OuroRecusado` | `GoldenRejectedError` | class | `nucleo/src/ia/__fixtures__/ouro.ts` | 1 |
| `PedidoRecebido` | `ReceivedRequest` | interface | `nucleo/src/ia/__fixtures__/servidor-llama-falso.ts` | 1 |
| `RespostaRoteirizada` | `ScriptedResponse` | interface | `nucleo/src/ia/__fixtures__/servidor-llama-falso.ts` | 1 |
| `ServidorLlamaFalso` | `FakeLlamaServer` | interface | `nucleo/src/ia/__fixtures__/servidor-llama-falso.ts` | 2 |
| `respostaDoChat` | `chatResponse` | função | `nucleo/src/ia/__fixtures__/servidor-llama-falso.ts` | 2 |
| `subirServidorLlamaFalso` | `startFakeLlamaServer` | função | `nucleo/src/ia/__fixtures__/servidor-llama-falso.ts` | 2 |

## 4. Fila, outbox e concorrência por escola

Regras (guia §9): `Enfileirador` + `job_registro` = transactional outbox → `JobOutbox`; `Reconciliacao` = outbox sweeper → `Sweep*`; `Despacho` → `Dispatch`; `VagasPorEscola` = semáforo por tenant → `EscolaConcurrencyLimiter`; `Fila` → `Queue`; `Pedido...Recusado` → `...RejectedError`. `JanelaLetiva` (horário letivo da escola) é domínio e fica.

| Atual | Proposto | Tipo | Onde (packages/) | Usos |
|---|---|---|---|---|
| `CursorDaReconciliacao` | `SweepCursor` | type | `nucleo/src/fila/despacho.repository.ts` | 2 |
| `DespachoRepository` | `DispatchRepository` | class | `nucleo/src/fila/despacho.repository.ts` | 11 |
| `EscolaComPendentes` | `EscolaWithPendingJobs` | type | `nucleo/src/fila/despacho.repository.ts` | 3 |
| `JobParaReconciliar` | `JobToSweep` | type | `nucleo/src/fila/despacho.repository.ts` | 2 |
| `JobReservado` | `ReservedJob` | type | `nucleo/src/fila/despacho.repository.ts` | 5 |
| `MedicaoDeFalhos` | `FailedJobsMeasurement` | type | `nucleo/src/fila/despacho.repository.ts` | 4 |
| `MedicaoDePendentes` | `PendingJobsMeasurement` | type | `nucleo/src/fila/despacho.repository.ts` | 4 |
| `EfeitoDaExecucao` | `SyntheticEffect` | interface | `nucleo/src/fila/efeito-sintetico.repository.ts` | 1 |
| `EfeitoSinteticoRepository` | `SyntheticEffectRepository` | class | `nucleo/src/fila/efeito-sintetico.repository.ts` | 4 |
| `TABELA_DO_EFEITO_SINTETICO` | `SYNTHETIC_EFFECT_TABLE` | const | `nucleo/src/fila/efeito-sintetico.repository.ts` | 2 |
| `Enfileirador` | `JobOutbox` | class | `nucleo/src/fila/enfileirador.ts` | 21 |
| `PRIORIDADE_DA_FILA` | `QUEUE_PRIORITY` | const (mapa) | `nucleo/src/fila/enfileirador.ts` | 5 |
| `FILAS_POR_PRIORIDADE` | `QUEUES_BY_PRIORITY` | const (mapa) | `nucleo/src/fila/filas.ts` | 3 |
| `OPCOES_DO_POOL_POR_FILA` | `WORKER_POOL_OPTIONS_BY_QUEUE` | const (mapa) | `nucleo/src/fila/filas.ts` | 2 |
| `OpcoesDoPool` | `WorkerPoolOptions` | interface | `nucleo/src/fila/filas.ts` | 1 |
| `nomeDaFilaBullMQ` | `bullmqQueueName` | função | `nucleo/src/fila/filas.ts` | 12 |
| `EstadoRegistrado` | `RegisteredJobState` | interface | `nucleo/src/fila/job-registro.repository.ts` | 1 |
| `JobParaExecutar` | `JobToRun` | interface | `nucleo/src/fila/job-registro.repository.ts` | 2 |
| `JobRegistroRepository` | `JobOutboxRepository` | class | `nucleo/src/fila/job-registro.repository.ts` | 10 |
| `LinhaNova` | `NewJobRow` | interface | `nucleo/src/fila/job-registro.repository.ts` | 3 |
| `ResultadoDaChave` | `IdempotencyKeyResult` | type | `nucleo/src/fila/job-registro.repository.ts` | 3 |
| `ResultadoDoInicio` | `JobStartResult` | type | `nucleo/src/fila/job-registro.repository.ts` | 2 |
| `escopoDoJobNoContexto` | `jobScopeInContext` | função | `nucleo/src/fila/job-registro.repository.ts` | 4 |
| `OuvinteDeJobs` | `JobNotificationListener` | class | `nucleo/src/fila/ouvinte-de-jobs.ts` | 3 |
| `MotivoDaRecusaDoJob` | `JobRejectionReason` | const+type | `nucleo/src/fila/pedido-de-job-recusado.ts` | 3 |
| `PedidoDeJobRecusado` | `JobRequestRejectedError` | class | `nucleo/src/fila/pedido-de-job-recusado.ts` | 5 |
| `DadosDoJobNaFila` | `QueuedJobData` | type | `nucleo/src/fila/publicacao.ts` | 6 |
| `OpcoesDeJobPublicado` | `PublishedJobOptions` | interface | `nucleo/src/fila/publicacao.ts` | 2 |
| `esquemaDadosDoJobNaFila` | `queuedJobDataSchema` | const (zod) | `nucleo/src/fila/publicacao.ts` | 2 |
| `executorDoJob` | `jobExecutor` | função | `nucleo/src/fila/publicacao.ts` | 3 |
| `opcoesDeJob` | `jobOptions` | função | `nucleo/src/fila/publicacao.ts` | 6 |
| `VagasPorEscola` | `EscolaConcurrencyLimiter` | class | `nucleo/src/fila/vagas-por-escola.ts` | 9 |
| `DEFINICOES_DE_JOB` | `JOB_DEFINITIONS` | const (mapa) | `shared/src/sistema/definicoes-de-job.ts` | 19 |
| `DadosDoJob` | `JobData` | type | `shared/src/sistema/definicoes-de-job.ts` | 3 |
| `DadosLidosDoJob` | `ParsedJobData` | type | `shared/src/sistema/definicoes-de-job.ts` | 2 |
| `DefinicaoDeJob` | `JobDefinition` | interface | `shared/src/sistema/definicoes-de-job.ts` | 3 |
| `EscopoDeJob` | `JobScope` | type | `shared/src/sistema/definicoes-de-job.ts` | 1 |
| `EsquemaDosDadosDoJob` | `JobDataSchema` | type | `shared/src/sistema/definicoes-de-job.ts` | 2 |
| `ExecutorDeJob` | `JobExecutor` | type | `shared/src/sistema/definicoes-de-job.ts` | 5 |
| `OpcoesDoJob` | `JobOptions` | type | `shared/src/sistema/definicoes-de-job.ts` | 3 |
| `RegistroDeJobs` | `JobRegistry` | type | `shared/src/sistema/definicoes-de-job.ts` | 12 |
| `RetentativaDeJob` | `JobRetry` | interface | `shared/src/sistema/definicoes-de-job.ts` | 1 |
| `TipoDeJob` | `JobType` | type | `shared/src/sistema/definicoes-de-job.ts` | 7 |
| `definirJob` | `defineJob` | função | `shared/src/sistema/definicoes-de-job.ts` | 6 |
| `DadosJobSintetico` | `SyntheticJobData` | type | `shared/src/sistema/jobs-sinteticos.ts` | 2 |
| `PedidoJobSintetico` | `SyntheticJobRequest` | type | `shared/src/sistema/jobs-sinteticos.ts` | 3 |
| `RespostaEstadoDeJob` | `JobStateResponse` | type | `shared/src/sistema/jobs-sinteticos.ts` | 3 |
| `RespostaJobAceito` | `JobAcceptedResponse` | type | `shared/src/sistema/jobs-sinteticos.ts` | 3 |
| `esquemaDadosJobSintetico` | `syntheticJobDataSchema` | const (zod) | `shared/src/sistema/jobs-sinteticos.ts` | 3 |
| `esquemaPedidoJobSintetico` | `syntheticJobRequestSchema` | const (zod) | `shared/src/sistema/jobs-sinteticos.ts` | 2 |
| `esquemaRespostaEstadoDeJob` | `jobStateResponseSchema` | const (zod) | `shared/src/sistema/jobs-sinteticos.ts` | 3 |
| `esquemaRespostaJobAceito` | `jobAcceptedResponseSchema` | const (zod) | `shared/src/sistema/jobs-sinteticos.ts` | 2 |
| `CODIGOS_DE_FALHA_DE_JOB` | `JOB_FAILURE_CODES` | const (lista) | `shared/src/sistema/jobs.ts` | 3 |
| `CodigoDeFalhaDeJob` | `JobFailureCode` | const+type | `shared/src/sistema/jobs.ts` | 25 |
| `ESTADOS_DE_JOB` | `JOB_STATES` | const (lista) | `shared/src/sistema/jobs.ts` | 2 |
| `EstadoDeJob` | `JobState` | type | `shared/src/sistema/jobs.ts` | 3 |
| `FILAS` | `QUEUE_NAMES` | const (lista) | `shared/src/sistema/jobs.ts` | 14 |
| `Fila` | `QueueName` | type | `shared/src/sistema/jobs.ts` | 31 |

## 5. Erros e filtro de exceção

Regras: erro de domínio e de invariante seguem o nome do NestJS/Java (`DomainException`, `InvariantException`); classe que estende `Error` e é peça técnica ganha sufixo `Error`; `FiltroGlobalDeErro` → `AllExceptionsFilter` (nome da documentação do NestJS, *Exception filters*). Os códigos (`NAO_ENCONTRADO`...) são string e ficam.

| Atual | Proposto | Tipo | Onde (packages/) | Usos |
|---|---|---|---|---|
| `MapaDeAuditoriaInvalido` | `InvalidAuditoriaMapError` | class | `nucleo/src/auditoria/acoes.ts` | 1 |
| `AuditoriaRecusada` | `AuditoriaRejectedError` | class | `nucleo/src/auditoria/auditoria-recusada.ts` | 8 |
| `MotivoDeRecusaDaAuditoria` | `AuditoriaRejectionReason` | const+type | `nucleo/src/auditoria/auditoria-recusada.ts` | 1 |
| `RegistroDeAuditoria` | `AuditoriaRecorder` | class | `nucleo/src/auditoria/registro-de-auditoria.ts` | 40 |
| `ConfiguracaoInvalida` | `InvalidConfigError` | class | `nucleo/src/config/validar-config.ts` | 37 |
| `MigracaoFalhou` | `MigrationFailedError` | class | `nucleo/src/db/migrar.ts` | 2 |
| `ErroDeDominio` | `DomainException` | class | `nucleo/src/erro/erro-de-dominio.ts` | 119 |
| `STATUS_HTTP_DO_CODIGO` | `HTTP_STATUS_BY_CODE` | const (mapa) | `nucleo/src/erro/erro-de-dominio.ts` | 2 |
| `TENTE_DE_NOVO_PADRAO_SEGUNDOS` | `DEFAULT_RETRY_AFTER_SECONDS` | const | `nucleo/src/erro/erro-de-dominio.ts` | 10 |
| `FiltroGlobalDeErro` | `AllExceptionsFilter` | class | `nucleo/src/erro/filtro-global.ts` | 3 |
| `mapearErroPostgres` | `mapPostgresError` | função | `nucleo/src/erro/mapear-erro-postgres.ts` | 5 |
| `ErroDoPostgres` | `PostgresError` | interface | `nucleo/src/erro/resumir-erro.ts` | 5 |
| `ResumoDeErro` | `ErrorSummary` | interface | `nucleo/src/erro/resumir-erro.ts` | 1 |
| `ehErroDoPostgres` | `isPostgresError` | função | `nucleo/src/erro/resumir-erro.ts` | 2 |
| `erroDoPostgresEm` | `postgresErrorIn` | função | `nucleo/src/erro/resumir-erro.ts` | 13 |
| `resumirErro` | `summarizeError` | função | `nucleo/src/erro/resumir-erro.ts` | 33 |
| `RotasSemPermissao` | `RoutesWithoutPermissaoError` | class | `nucleo/src/permissao/conferencia-das-permissoes.ts` | 2 |
| `ArmazemIndisponivel` | `FileStorageUnavailableError` | class | `nucleo/src/titular/armazem-de-arquivos.ts` | 6 |
| `CodigoDeErro` | `ErrorCode` | const+type | `shared/src/erros/codigo-de-erro.ts` | 277 |
| `RespostaDeErro` | `ErrorResponse` | interface | `shared/src/erros/codigo-de-erro.ts` | 2 |
| `ErroDeInvariante` | `InvariantException` | class | `shared/src/erros/erro-de-invariante.ts` | 70 |

## 6. Banco, pool, migração e escopo

Regras: `Banco` → `Database`; `Linha<X>` (linha lida/gravada) → `<X>Row`; `criar<X>` → `create<X>`; `lerConfiguracao<X>` → `load<X>Config`; `@SemEscopo` → `@Unscoped` (guia §9: bypass explícito do filtro de tenant). As consts do Drizzle que espelham tabela (`jobRegistro`, `usoInfraDiario`...) ficam: ver dúvida.

| Atual | Proposto | Tipo | Onde (packages/) | Usos |
|---|---|---|---|---|
| `ExecutorDeAuditoria` | `DatabaseExecutor` | type | `nucleo/src/auditoria/auditoria.repository.ts` | 7 |
| `LinhaNovaDeAuditoria` | `AuditoriaInsertRow` | interface | `nucleo/src/auditoria/insercao-de-auditoria.repository.ts` | 0 |
| `inserirAuditoria` | `insertAuditoria` | função | `nucleo/src/auditoria/insercao-de-auditoria.repository.ts` | 5 |
| `LinhaOperacional` | `OperationalSettingsRow` | interface | `nucleo/src/configuracao/configuracao-operacional.repository.ts` | 3 |
| `Banco` | `Database` | type | `nucleo/src/db/banco.ts` | 211 |
| `TransacaoBanco` | `DatabaseTransaction` | type | `nucleo/src/db/banco.ts` | 82 |
| `criarBanco` | `createDatabase` | função | `nucleo/src/db/banco.ts` | 29 |
| `lerConfiguracaoBanco` | `loadDatabaseConfig` | função | `nucleo/src/db/banco.ts` | 5 |
| `ConfiguracaoMigracao` | `MigrationConfig` | interface | `nucleo/src/db/migrar.ts` | 2 |
| `migrar` | `migrate` | função | `nucleo/src/db/migrar.ts` | 15 |
| `ConfiguracaoBanco` | `DatabaseConfig` | interface | `nucleo/src/db/pool.ts` | 10 |
| `PoolBanco` | `DatabasePool` | type | `nucleo/src/db/pool.ts` | 31 |
| `bancoResponde` | `pingDatabase` | função | `nucleo/src/db/pool.ts` | 3 |
| `criarPool` | `createPool` | função | `nucleo/src/db/pool.ts` | 31 |
| `ehErroDeConexao` | `isConnectionError` | função | `nucleo/src/db/pool.ts` | 2 |
| `tabelasDoMvp` | `mvpTables` | const (mapa) | `nucleo/src/db/schema/mvp/tabelas.ts` | 3 |
| `SemEscopo` | `Unscoped` | função (decorator) | `nucleo/src/db/sem-escopo.decorator.ts` | 46 |
| `justificativaSemEscopo` | `unscopedJustification` | função | `nucleo/src/db/sem-escopo.decorator.ts` | 9 |
| `LinhaDaSessao` | `SessaoRow` | interface | `nucleo/src/identidade/sessao.repository.ts` | 7 |
| `instrucaoDasPessoasDesativadas` | `expurgoDeactivatedPeopleStatement` | função | `nucleo/src/retencao/expurgo-da-escola.repository.ts` | 2 |
| `instrucaoDoLoteDaEscola` | `expurgoSchoolBatchStatement` | função | `nucleo/src/retencao/expurgo-da-escola.repository.ts` | 2 |
| `instrucaoDoRegistroDoExpurgo` | `expurgoRecordStatement` | função | `nucleo/src/retencao/expurgo-da-escola.repository.ts` | 2 |
| `instrucaoDoLoteDeAcesso` | `expurgoAccessBatchStatement` | função | `nucleo/src/retencao/expurgo-de-acesso.repository.ts` | 2 |
| `instrucaoDoLoteVencido` | `expurgoExpiredBatchStatement` | função | `nucleo/src/retencao/expurgo-de-jobs.repository.ts` | 2 |
| `instrucaoDoRastroDoAluno` | `alunoTrailStatement` | função | `nucleo/src/titular/compartilhamento.repository.ts` | 2 |
| `LinhasDaTabela` | `TableRows` | type | `nucleo/src/titular/leitura-do-titular.ts` | 1 |
| `colunasDoSelect` | `selectColumns` | função | `nucleo/src/titular/leitura-do-titular.ts` | 2 |

## 7. Contexto da requisição (tenant)

Regras (guia §9: `contexto` = ThreadLocal/TenantContext): `Contexto...` → `Context...`; funções-acessor trocam o verbo/substantivo técnico para inglês e mantêm o domínio (`Escola`, `Operador`, `Sessao`) em português.

| Atual | Proposto | Tipo | Onde (packages/) | Usos |
|---|---|---|---|---|
| `exigirAnoEmCurso` | `requireAnoEmCurso` | função | `nucleo/src/contexto/ano-em-curso.ts` | 29 |
| `CABECALHO_REQUISICAO_ID` | `REQUEST_ID_HEADER` | const | `nucleo/src/contexto/contexto.ts` | 1 |
| `ContextoDaRequisicao` | `RequestContext` | interface | `nucleo/src/contexto/contexto.ts` | 10 |
| `SessaoDaRequisicao` | `RequestSessao` | interface | `nucleo/src/contexto/contexto.ts` | 3 |
| `contextoAtual` | `currentContext` | função | `nucleo/src/contexto/contexto.ts` | 57 |
| `definirOperadorNoContexto` | `setContextOperador` | função | `nucleo/src/contexto/contexto.ts` | 3 |
| `definirSessaoNoContexto` | `setContextSessao` | função | `nucleo/src/contexto/contexto.ts` | 5 |
| `executarNoContexto` | `runInContext` | função | `nucleo/src/contexto/contexto.ts` | 98 |
| `exigirOperadorDoContexto` | `requireContextOperador` | função | `nucleo/src/contexto/contexto.ts` | 4 |
| `middlewareDeContexto` | `contextMiddleware` | função | `nucleo/src/contexto/contexto.ts` | 3 |
| `resolverRequisicaoId` | `resolveRequestId` | função | `nucleo/src/contexto/contexto.ts` | 2 |
| `exigirEscolaDoContexto` | `requireEscolaId` | função | `nucleo/src/contexto/escola-do-contexto.ts` | 86 |

## 8. Guards, decorators e token (autenticação, sessão, permissão)

Regras (guia §9: filter chain de segurança, `@Permite` + `MATRIZ`): `Guarda<X>` → `<X>Guard`; `Emissor<X>` → `<X>Issuer`; decorators com o nome da documentação do NestJS (`@Public()` da receita de autenticação, `@SkipThrottle()` do throttler → `@SkipRateLimit()`); `METADADO_<X>` → `<X>_KEY` (padrão `ROLES_KEY`/`IS_PUBLIC_KEY` da documentação). `Sessao`, `Permissao`, `Operacao` ficam em português por serem domínio.

| Atual | Proposto | Tipo | Onde (packages/) | Usos |
|---|---|---|---|---|
| `EmissorDeToken` | `TokenIssuer` | class | `nucleo/src/identidade/emissor-de-token.ts` | 19 |
| `EmissorDeTokenDeOperador` | `OperadorTokenIssuer` | class | `nucleo/src/identidade/emissor-de-token.ts` | 8 |
| `PedidoDeTokenDeAcesso` | `AccessTokenRequest` | interface | `nucleo/src/identidade/emissor-de-token.ts` | 1 |
| `PedidoDeTokenDeOperador` | `OperadorTokenRequest` | interface | `nucleo/src/identidade/emissor-de-token.ts` | 1 |
| `TokenDeAcesso` | `AccessToken` | interface | `nucleo/src/identidade/emissor-de-token.ts` | 1 |
| `GuardaDeAutenticacao` | `AuthGuard` | class | `nucleo/src/identidade/guarda-autenticacao.ts` | 7 |
| `identidadeDaRequisicao` | `requestIdentity` | função | `nucleo/src/identidade/guarda-autenticacao.ts` | 10 |
| `sessaoDaRequisicao` | `requestSessao` | função | `nucleo/src/identidade/guarda-autenticacao.ts` | 32 |
| `GuardaDeSessao` | `SessaoGuard` | class | `nucleo/src/identidade/guarda-sessao.ts` | 35 |
| `LeituraDeSessao` | `SessaoReader` | interface | `nucleo/src/identidade/guarda-sessao.ts` | 4 |
| `METADADO_ENTRADA_DE_OPERACAO` | `OPERACAO_ENTRY_KEY` | const (chave de metadado) | `nucleo/src/identidade/marcadores-de-operacao.ts` | 7 |
| `METADADO_ROTA_DE_OPERACAO` | `OPERACAO_ROUTE_KEY` | const (chave de metadado) | `nucleo/src/identidade/marcadores-de-operacao.ts` | 8 |
| `MarcadorDeOperacao` | `OperacaoMarker` | type | `nucleo/src/identidade/marcadores-de-operacao.ts` | 1 |
| `marcadorDeOperacao` | `operacaoMarker` | função | `nucleo/src/identidade/marcadores-de-operacao.ts` | 4 |
| `bearerDeDesafio` | `isChallengeBearer` | função | `nucleo/src/identidade/rota-sem-sessao.ts` | 3 |
| `rotaSemSessao` | `isRouteWithoutSessao` | função | `nucleo/src/identidade/rota-sem-sessao.ts` | 7 |
| `guardarTokenDaRequisicao` | `storeRequestToken` | função | `nucleo/src/identidade/token-da-requisicao.ts` | 2 |
| `tokenDaRequisicao` | `requestToken` | função | `nucleo/src/identidade/token-da-requisicao.ts` | 2 |
| `Identidade` | `Identity` | interface | `nucleo/src/identidade/verificar-token.ts` | 4 |
| `TokenDeOperadorVerificado` | `VerifiedOperadorToken` | interface | `nucleo/src/identidade/verificar-token.ts` | 3 |
| `TokenVerificado` | `VerifiedToken` | interface | `nucleo/src/identidade/verificar-token.ts` | 9 |
| `bearerDeOperador` | `operadorBearer` | função | `nucleo/src/identidade/verificar-token.ts` | 3 |
| `cookieDeOperador` | `operadorCookie` | função | `nucleo/src/identidade/verificar-token.ts` | 4 |
| `extrairTokenBearer` | `extractBearerToken` | função | `nucleo/src/identidade/verificar-token.ts` | 8 |
| `verificarToken` | `verifyToken` | função | `nucleo/src/identidade/verificar-token.ts` | 11 |
| `verificarTokenDeOperador` | `verifyOperadorToken` | função | `nucleo/src/identidade/verificar-token.ts` | 6 |
| `LimiteDaBuscaDeTitulares` | `TitularSearchRateLimit` | função (decorator) | `nucleo/src/limite/limite-da-busca-de-titulares.decorator.ts` | 3 |
| `METADADO_LIMITE_DA_BUSCA_DE_TITULARES` | `TITULAR_SEARCH_RATE_LIMIT_KEY` | const (chave de metadado) | `nucleo/src/limite/limite-da-busca-de-titulares.decorator.ts` | 2 |
| `AceitaDesafio` | `AcceptsChallenge` | função (decorator) | `nucleo/src/limite/rota-anonima.decorator.ts` | 4 |
| `LimiteQueRebaixa` | `DowngradeRateLimit` | função (decorator) | `nucleo/src/limite/rota-anonima.decorator.ts` | 12 |
| `METADADO_ACEITA_DESAFIO` | `ACCEPTS_CHALLENGE_KEY` | const (chave de metadado) | `nucleo/src/limite/rota-anonima.decorator.ts` | 1 |
| `METADADO_LIMITE_QUE_REBAIXA` | `DOWNGRADE_RATE_LIMIT_KEY` | const (chave de metadado) | `nucleo/src/limite/rota-anonima.decorator.ts` | 1 |
| `METADADO_ROTA_ANONIMA` | `IS_PUBLIC_KEY` | const (chave de metadado) | `nucleo/src/limite/rota-anonima.decorator.ts` | 4 |
| `METADADO_SEM_LIMITE` | `SKIP_RATE_LIMIT_KEY` | const (chave de metadado) | `nucleo/src/limite/rota-anonima.decorator.ts` | 1 |
| `RotaAnonima` | `Public` | função (decorator) | `nucleo/src/limite/rota-anonima.decorator.ts` | 28 |
| `SemLimite` | `SkipRateLimit` | função (decorator) | `nucleo/src/limite/rota-anonima.decorator.ts` | 2 |
| `ConferenciaDasPermissoes` | `PermissaoBootCheck` | class | `nucleo/src/permissao/conferencia-das-permissoes.ts` | 5 |
| `RotaSemDeclaracao` | `UndeclaredRoute` | interface | `nucleo/src/permissao/conferencia-das-permissoes.ts` | 1 |
| `rotasSemPermissao` | `routesWithoutPermissao` | função | `nucleo/src/permissao/conferencia-das-permissoes.ts` | 2 |
| `GuardaDePermissao` | `PermissaoGuard` | class | `nucleo/src/permissao/guarda-permissao.ts` | 4 |
| `CelulaPermitida` | `PermittedCell` | interface | `nucleo/src/permissao/permite.decorator.ts` | 2 |
| `METADADO_PERMITE` | `PERMISSAO_KEY` | const (chave de metadado) | `nucleo/src/permissao/permite.decorator.ts` | 3 |
| `Permite` | `RequirePermissao` | função (decorator) | `nucleo/src/permissao/permite.decorator.ts` | 47 |

## 9. Limite de taxa (rate limit)

Regras (guia §9): `Limitador...` → `RateLimiter`; `Guarda...Limite` → `RateLimitGuard`; o 'seguro' em memória é o `insuranceLimiter` da biblioteca `rate-limiter-flexible` (por isso `insurance`); `Proxies...` → `TrustedProxies`.

| Atual | Proposto | Tipo | Onde (packages/) | Usos |
|---|---|---|---|---|
| `ipDoCliente` | `clientIp` | função | `nucleo/src/limite/chaves.ts` | 3 |
| `ipEncaminhado` | `forwardedIp` | função | `nucleo/src/limite/chaves.ts` | 1 |
| `limiteDoSeguro` | `insuranceLimit` | função | `nucleo/src/limite/chaves.ts` | 8 |
| `normalizarIp` | `normalizeIp` | função | `nucleo/src/limite/chaves.ts` | 2 |
| `segundosParaTentarDeNovo` | `retryAfterSeconds` | função | `nucleo/src/limite/chaves.ts` | 5 |
| `GuardaDeLimite` | `RateLimitGuard` | class | `nucleo/src/limite/guarda-limite.ts` | 3 |
| `acimaDoLimiteDoIp` | `isOverIpLimit` | função | `nucleo/src/limite/guarda-limite.ts` | 13 |
| `ipDaRequisicao` | `requestIp` | função | `nucleo/src/limite/guarda-limite.ts` | 14 |
| `ConfiguracaoLimite` | `RateLimitConfig` | interface | `nucleo/src/limite/limitador.ts` | 3 |
| `LimitadorDeRequisicoes` | `RateLimiter` | class | `nucleo/src/limite/limitador.ts` | 10 |
| `ResultadoDoLimite` | `RateLimitResult` | type | `nucleo/src/limite/limitador.ts` | 2 |
| `lerConfiguracaoLimite` | `loadRateLimitConfig` | função | `nucleo/src/limite/limitador.ts` | 2 |
| `ProporcaoEmJanela` | `SlidingWindowRatio` | class | `nucleo/src/limite/proporcao-em-janela.ts` | 7 |
| `ProxiesConfiaveis` | `TrustedProxies` | class | `nucleo/src/limite/proxies-confiaveis.ts` | 17 |
| `ResolverNome` | `NameResolver` | type | `nucleo/src/limite/proxies-confiaveis.ts` | 0 |

## 10. Ciclo de vida do processo, relógio e utilitários

Regras (guia §9): `Batimento` = heartbeat; `Drenagem` = graceful shutdown; `ContadorDeUso` = usage metering → `UsageMeter`; `Relogio` → `Clock`; `Interceptor<X>` → `<X>Interceptor`; `Logger<X>` → `<X>Logger`. Itens de configuração por escola (`ConfiguracaoOperacional`) e a rotina noturna (`EscolasDaRotinaRepository`) estão aqui e são dúvida.

| Atual | Proposto | Tipo | Onde (packages/) | Usos |
|---|---|---|---|---|
| `Ambiente` | `Environment` | type | `nucleo/src/config/validar-config.ts` | 17 |
| `ConfiguracaoIdentidade` | `AuthConfig` | interface | `nucleo/src/config/validar-config.ts` | 14 |
| `esquemaAmbienteIdentidade` | `authEnvSchema` | const (zod) | `nucleo/src/config/validar-config.ts` | 3 |
| `esquemaAmbienteProtecaoDoLogin` | `loginProtectionEnvSchema` | const (zod) | `nucleo/src/config/validar-config.ts` | 0 |
| `esquemaAmbienteVagasDesligadas` | `concurrencyLimitDisabledEnvSchema` | const (zod) | `nucleo/src/config/validar-config.ts` | 0 |
| `lerConfiguracaoIdentidade` | `loadAuthConfig` | função | `nucleo/src/config/validar-config.ts` | 4 |
| `lerProtecaoDoLoginDesligada` | `isLoginProtectionDisabled` | função | `nucleo/src/config/validar-config.ts` | 3 |
| `lerVagasPorEscolaDesligadas` | `isEscolaConcurrencyLimitDisabled` | função | `nucleo/src/config/validar-config.ts` | 4 |
| `validarAmbiente` | `validateEnvironment` | função | `nucleo/src/config/validar-config.ts` | 17 |
| `ConfiguracaoOperacionalRepository` | `OperationalSettingsRepository` | class | `nucleo/src/configuracao/configuracao-operacional.repository.ts` | 10 |
| `ConfiguracaoOperacional` | `OperationalSettings` | class | `nucleo/src/configuracao/configuracao-operacional.ts` | 17 |
| `LimitesDeRequisicao` | `RateLimits` | interface | `nucleo/src/configuracao/configuracao-operacional.ts` | 5 |
| `OpcoesDaConfiguracaoOperacional` | `OperationalSettingsOptions` | interface | `nucleo/src/configuracao/configuracao-operacional.ts` | 1 |
| `VagasPorFila` | `ConcurrencyByQueue` | type | `nucleo/src/configuracao/configuracao-operacional.ts` | 7 |
| `VagasConfiguradas` | `ConfiguredConcurrency` | type | `nucleo/src/db/schema/configuracao-operacional-escola.ts` | 3 |
| `Batimento` | `Heartbeat` | class | `nucleo/src/instancia/batimento.ts` | 7 |
| `ConfiguracaoDrenagem` | `GracefulShutdownConfig` | interface | `nucleo/src/instancia/drenagem.ts` | 3 |
| `Drenagem` | `GracefulShutdown` | class | `nucleo/src/instancia/drenagem.ts` | 10 |
| `RespostaDeProntidao` | `ReadinessResult` | interface | `nucleo/src/instancia/drenagem.ts` | 1 |
| `lerConfiguracaoDrenagem` | `loadGracefulShutdownConfig` | função | `nucleo/src/instancia/drenagem.ts` | 4 |
| `avisoEspacado` | `throttledWarn` | função | `nucleo/src/log/aviso-espacado.ts` | 20 |
| `LoggerDoNest` | `NestLogger` | class | `nucleo/src/log/logger-do-nest.ts` | 9 |
| `OpcoesDoLogger` | `LoggerOptions` | interface | `nucleo/src/log/logger.ts` | 1 |
| `criarLogger` | `createLogger` | função | `nucleo/src/log/logger.ts` | 37 |
| `registrarErrosDoProcesso` | `registerProcessErrorHandlers` | função | `nucleo/src/log/logger.ts` | 7 |
| `tratadorDeErroDoProcesso` | `processErrorHandler` | função | `nucleo/src/log/logger.ts` | 1 |
| `criarClienteRedisDaApi` | `createApiRedisClient` | função | `nucleo/src/redis/clientes.ts` | 9 |
| `criarClienteRedisDaFila` | `createQueueRedisClient` | função | `nucleo/src/redis/clientes.ts` | 10 |
| `Relogio` | `Clock` | interface | `nucleo/src/relogio.ts` | 53 |
| `relogioDoSistema` | `systemClock` | const (instância) | `nucleo/src/relogio.ts` | 34 |
| `EscolasDaRotinaRepository` | `CronEscolasRepository` | class | `nucleo/src/rotina/escolas-da-rotina.repository.ts` | 10 |
| `InstanciaRedis` | `RedisInstance` | type | `nucleo/src/telemetria/metricas.ts` | 1 |
| `ContadorDeUso` | `UsageMeter` | class | `nucleo/src/uso/contador-uso.ts` | 10 |
| `ContagemDoDia` | `DailyCount` | interface | `nucleo/src/uso/contador-uso.ts` | 1 |
| `MetricaDeUso` | `UsageMetric` | type | `nucleo/src/uso/contador-uso.ts` | 1 |
| `OpcoesDoContadorDeUso` | `UsageMeterOptions` | interface | `nucleo/src/uso/contador-uso.ts` | 1 |
| `InterceptorDeUso` | `UsageInterceptor` | class | `nucleo/src/uso/interceptor-de-uso.ts` | 2 |
| `UsoDoPeriodo` | `UsagePeriod` | interface | `nucleo/src/uso/uso.repository.ts` | 5 |
| `UsoRepository` | `UsageRepository` | class | `nucleo/src/uso/uso.repository.ts` | 7 |

## 11. Telemetria e métricas

Regra: nome de peça e de função de instrumentação em inglês (`startTelemetry`, `observeRedis`); o NOME da métrica Prometheus (valor em `METRICAS`) NÃO muda.

| Atual | Proposto | Tipo | Onde (packages/) | Usos |
|---|---|---|---|---|
| `ConfiguracaoTelemetria` | `TelemetryConfig` | interface | `nucleo/src/telemetria/iniciar.ts` | 5 |
| `ServicoInstrumentado` | `InstrumentedService` | type | `nucleo/src/telemetria/iniciar.ts` | 1 |
| `Telemetria` | `Telemetry` | interface | `nucleo/src/telemetria/iniciar.ts` | 1 |
| `iniciarTelemetria` | `startTelemetry` | função | `nucleo/src/telemetria/iniciar.ts` | 5 |
| `lerConfiguracaoTelemetria` | `loadTelemetryConfig` | função | `nucleo/src/telemetria/iniciar.ts` | 6 |
| `medidorGlobal` | `globalMeter` | função | `nucleo/src/telemetria/iniciar.ts` | 8 |
| `METRICAS` | `METRICS` | const (mapa) | `nucleo/src/telemetria/metricas.ts` | 46 |
| `METRICAS_COM_ESCOLA` | `METRICS_WITH_ESCOLA` | const (mapa) | `nucleo/src/telemetria/metricas.ts` | 4 |
| `middlewareDeMetricasHttp` | `httpMetricsMiddleware` | função | `nucleo/src/telemetria/metricas.ts` | 4 |
| `observarConexoesRealtime` | `observeRealtimeConnections` | função | `nucleo/src/telemetria/metricas.ts` | 2 |
| `observarEventLoop` | `observeEventLoop` | função | `nucleo/src/telemetria/metricas.ts` | 2 |
| `observarPoolDoBanco` | `observeDatabasePool` | função | `nucleo/src/telemetria/metricas.ts` | 6 |
| `observarRedis` | `observeRedis` | função | `nucleo/src/telemetria/metricas.ts` | 6 |
| `observarSeguroDoLimite` | `observeInsuranceLimiter` | função | `nucleo/src/telemetria/metricas.ts` | 5 |
| `rotaDaRequisicao` | `requestRoute` | função | `nucleo/src/telemetria/metricas.ts` | 2 |
| `temporalidadeDasMetricas` | `metricsTemporality` | função | `nucleo/src/telemetria/temporalidade.ts` | 3 |

## 12. Storage de arquivos (S3)

Regra: `Armazem<X>` → `FileStorage` (porta) / `S3FileStorage` / `InMemoryFileStorage`; o subcaminho público `@educa/nucleo/armazem-s3` vira `.../s3-file-storage`.

| Atual | Proposto | Tipo | Onde (packages/) | Usos |
|---|---|---|---|---|
| `ArmazemDeArquivos` | `FileStorage` | interface | `nucleo/src/titular/armazem-de-arquivos.ts` | 9 |
| `ArmazemEmMemoria` | `InMemoryFileStorage` | class | `nucleo/src/titular/armazem-de-arquivos.ts` | 7 |
| `OpcoesDaUrlDeDownload` | `DownloadUrlOptions` | interface | `nucleo/src/titular/armazem-de-arquivos.ts` | 2 |
| `UrlAssinadaPeloFalso` | `FakeSignedUrl` | interface | `nucleo/src/titular/armazem-de-arquivos.ts` | 1 |
| `ArmazemS3` | `S3FileStorage` | class | `nucleo/src/titular/armazem-s3.ts` | 5 |
| `ConfiguracaoDoArmazemS3` | `S3FileStorageConfig` | interface | `nucleo/src/titular/armazem-s3.ts` | 0 |
| `criarClienteDoArmazem` | `createS3Client` | função | `nucleo/src/titular/armazem-s3.ts` | 1 |
| `chaveDoObjeto` | `objectKey` | função | `nucleo/src/titular/arquivo-do-titular.repository.ts` | 2 |

## 13. Pipes de entrada

`IdPipe` e `ZodValidationPipe` já têm nome de mercado e ficam; só mudam as interfaces de opções e a pasta.

| Atual | Proposto | Tipo | Onde (packages/) | Usos |
|---|---|---|---|---|
| `OpcoesDoIdPipe` | `IdPipeOptions` | interface | `nucleo/src/entrada/id.pipe.ts` | 2 |
| `OpcoesDoZodValidationPipe` | `ZodValidationPipeOptions` | interface | `nucleo/src/entrada/zod-validation.pipe.ts` | 2 |

## 14. Contrato HTTP técnico no shared (sistema, paginação, realtime, idempotência)

Regras: `Resposta<X>` → `<X>Response`, `Pedido<X>` → `<X>Request`, `Consulta<X>` → `<X>Query`, `esquema<X>` → `<x>Schema`; constantes e tipos de infraestrutura (fila, job, realtime, status) em inglês. Rotas (`/prontidao`, `/saude`, `/v1/sistema/...`) e nomes de campo no JSON NÃO mudam.

| Atual | Proposto | Tipo | Onde (packages/) | Usos |
|---|---|---|---|---|
| `PedidoSemCorpo` | `EmptyBodyRequest` | type | `shared/src/atividade/atividade-aplicada.ts` | 9 |
| `ConsultaPaginada` | `PaginationQuery` | type | `shared/src/estrutura/paginacao.ts` | 25 |
| `esquemaConsultaPaginada` | `paginationQuerySchema` | const (zod) | `shared/src/estrutura/paginacao.ts` | 19 |
| `esquemaDePagina` | `pageSchema` | função (fábrica zod) | `shared/src/estrutura/paginacao.ts` | 14 |
| `PedidoSemCorpoDeOperador` | `OperadorEmptyBodyRequest` | type | `shared/src/operacao/sessao.ts` | 3 |
| `esquemaPedidoSemCorpoDeOperador` | `operadorEmptyBodyRequestSchema` | const (zod) | `shared/src/operacao/sessao.ts` | 3 |
| `RespostaContexto` | `ContextResponse` | type | `shared/src/sistema/contexto.ts` | 2 |
| `esquemaRespostaContexto` | `contextResponseSchema` | const (zod) | `shared/src/sistema/contexto.ts` | 3 |
| `AMBIENTES_DO_SISTEMA` | `SYSTEM_ENVIRONMENTS` | const (lista) | `shared/src/sistema/estado.ts` | 2 |
| `COMPONENTES_DO_SISTEMA` | `SYSTEM_COMPONENTS` | const (lista) | `shared/src/sistema/estado.ts` | 1 |
| `ComponenteDoSistema` | `SystemComponent` | type | `shared/src/sistema/estado.ts` | 2 |
| `RespostaEstado` | `SystemStatusResponse` | type | `shared/src/sistema/estado.ts` | 4 |
| `SITUACOES_DE_COMPONENTE` | `COMPONENT_STATUSES` | const (lista) | `shared/src/sistema/estado.ts` | 1 |
| `esquemaRespostaEstado` | `systemStatusResponseSchema` | const (zod) | `shared/src/sistema/estado.ts` | 6 |
| `RespostaProntidao` | `ReadinessResponse` | interface | `shared/src/sistema/prontidao.ts` | 4 |
| `AutenticacaoRealtime` | `RealtimeAuth` | interface | `shared/src/sistema/realtime.ts` | 1 |
| `CAMINHO_REALTIME` | `REALTIME_PATH` | const | `shared/src/sistema/realtime.ts` | 2 |
| `NAMESPACE_REALTIME_SISTEMA` | `SYSTEM_REALTIME_NAMESPACE` | const | `shared/src/sistema/realtime.ts` | 5 |
| `OpcoesDoClienteRealtime` | `RealtimeClientOptions` | interface | `shared/src/sistema/realtime.ts` | 1 |
| `RECONEXAO_REALTIME` | `REALTIME_RECONNECTION` | const (config) | `shared/src/sistema/realtime.ts` | 3 |
| `opcoesDoClienteRealtime` | `realtimeClientOptions` | função | `shared/src/sistema/realtime.ts` | 2 |
| `RespostaSaude` | `HealthResponse` | interface | `shared/src/sistema/saude.ts` | 3 |
| `esquemaChaveEnvio` | `idempotencyKeySchema` | const (zod) | `shared/src/time/chave-envio.ts` | 6 |

## 15. Schemas zod e DTOs de contrato (regra mecânica)

Regra: `esquema<X>` → `<x>Schema` (convenção do zod, sufixo `Schema`); `esquemaPedido<X>` → `<x>RequestSchema`, `esquemaResposta<X>` → `<x>ResponseSchema`, `esquemaConsulta<X>` → `<x>QuerySchema`; os tipos inferidos seguem: `Pedido<X>` → `<X>Request`, `Resposta<X>` → `<X>Response`, `Consulta<X>` → `<X>Query`. Nas tarefas de IA: `esquemaEntradaDo<X>` → `<x>InputSchema`, `EntradaDo<X>` → `<X>Input`, idem `Saida`. "Resposta" também é termo de domínio do glossário (resposta do aluno a um item); `...Response` elimina essa ambiguidade.

**Ficam, por serem domínio (só o schema ganha sufixo):** `PedidoDaTurma` (nome pedido pelo aluno na sala), `PedidoDoTitular`, `PedidoDeMeusDados` (pedido do titular, LGPD). Em `nucleo/src/titular` os `Pedido...` (`PedidoDeEliminacao`, `PedidoDeLeitura`, `PedidoDeTroca`, `PedidoDoUsuario`, `PedidoParaMontar`, `PedidoConcluidoComOTitular`) são parâmetros de domínio e ficam. O nome dos campos no JSON (`itens`, `proxima`, `chaveEnvio`...) não muda.

| Atual | Proposto | Tipo | Onde (packages/) | Usos |
|---|---|---|---|---|
| `esquemaContextoDaTurma` | `contextoDaTurmaSchema` | const (zod) | `nucleo/src/ia/material.ts` | 5 |
| `esquemaHabilidades` | `habilidadesSchema` | const (zod) | `nucleo/src/ia/material.ts` | 3 |
| `esquemaTrecho` | `trechoSchema` | const (zod) | `nucleo/src/ia/material.ts` | 6 |
| `EntradaDeAdaptacao` | `AdaptacaoInput` | type | `nucleo/src/ia/tarefas/adaptar-atividade.ts` | 2 |
| `esquemaEntradaDeAdaptacao` | `adaptacaoInputSchema` | const (zod) | `nucleo/src/ia/tarefas/adaptar-atividade.ts` | 1 |
| `EntradaDeAtividadeObjetiva` | `AtividadeObjetivaInput` | type | `nucleo/src/ia/tarefas/gerar-atividade-objetiva.ts` | 2 |
| `esquemaEntradaDeAtividadeObjetiva` | `atividadeObjetivaInputSchema` | const (zod) | `nucleo/src/ia/tarefas/gerar-atividade-objetiva.ts` | 1 |
| `EntradaDePlanoDeAula` | `PlanoDeAulaInput` | type | `nucleo/src/ia/tarefas/gerar-plano-de-aula.ts` | 2 |
| `esquemaEntradaDePlanoDeAula` | `planoDeAulaInputSchema` | const (zod) | `nucleo/src/ia/tarefas/gerar-plano-de-aula.ts` | 1 |
| `EntradaDoAssistente` | `AssistenteInput` | type | `nucleo/src/ia/tarefas/propor-ferramenta.ts` | 4 |
| `SaidaDoAssistente` | `AssistenteOutput` | type | `nucleo/src/ia/tarefas/propor-ferramenta.ts` | 1 |
| `esquemaEntradaDoAssistente` | `assistenteInputSchema` | const (zod) | `nucleo/src/ia/tarefas/propor-ferramenta.ts` | 2 |
| `esquemaPropostaDoAssistente` | `propostaDoAssistenteSchema` | const (zod) | `nucleo/src/ia/tarefas/propor-ferramenta.ts` | 1 |
| `esquemaSaidaDoAssistente` | `assistenteOutputSchema` | const (zod) | `nucleo/src/ia/tarefas/propor-ferramenta.ts` | 1 |
| `EntradaDoRelatorio` | `RelatorioInput` | type | `nucleo/src/ia/tarefas/relatorio-da-correcao.ts` | 2 |
| `SaidaDoRelatorio` | `RelatorioOutput` | type | `nucleo/src/ia/tarefas/relatorio-da-correcao.ts` | 1 |
| `esquemaEntradaDoRelatorio` | `relatorioInputSchema` | const (zod) | `nucleo/src/ia/tarefas/relatorio-da-correcao.ts` | 1 |
| `esquemaSaidaDoRelatorio` | `relatorioOutputSchema` | const (zod) | `nucleo/src/ia/tarefas/relatorio-da-correcao.ts` | 1 |
| `EntradaDoAnalista` | `AnalistaInput` | type | `nucleo/src/ia/tarefas/resumo-do-analista.ts` | 3 |
| `SaidaDoAnalista` | `AnalistaOutput` | type | `nucleo/src/ia/tarefas/resumo-do-analista.ts` | 1 |
| `esquemaEntradaDoAnalista` | `analistaInputSchema` | const (zod) | `nucleo/src/ia/tarefas/resumo-do-analista.ts` | 1 |
| `esquemaSaidaDoAnalista` | `analistaOutputSchema` | const (zod) | `nucleo/src/ia/tarefas/resumo-do-analista.ts` | 1 |
| `EntradaDoTutor` | `TutorInput` | type | `nucleo/src/ia/tarefas/turno-do-tutor.ts` | 5 |
| `SaidaDoTutor` | `TutorOutput` | type | `nucleo/src/ia/tarefas/turno-do-tutor.ts` | 3 |
| `esquemaEntradaDoTutor` | `tutorInputSchema` | const (zod) | `nucleo/src/ia/tarefas/turno-do-tutor.ts` | 2 |
| `esquemaSaidaDoTutor` | `tutorOutputSchema` | const (zod) | `nucleo/src/ia/tarefas/turno-do-tutor.ts` | 1 |
| `ConsultaArtefatos` | `ArtefatosQuery` | type | `shared/src/assistente/artefato.ts` | 4 |
| `PedidoAdaptarArtefato` | `AdaptarArtefatoRequest` | type | `shared/src/assistente/artefato.ts` | 4 |
| `PedidoGerarComFerramenta` | `GerarComFerramentaRequest` | type | `shared/src/assistente/artefato.ts` | 4 |
| `PedidoRenomearArtefato` | `RenomearArtefatoRequest` | type | `shared/src/assistente/artefato.ts` | 3 |
| `RespostaArtefato` | `ArtefatoResponse` | type | `shared/src/assistente/artefato.ts` | 7 |
| `RespostaListaDeArtefatos` | `ListaDeArtefatosResponse` | type | `shared/src/assistente/artefato.ts` | 3 |
| `esquemaAplicacaoDoArtefato` | `aplicacaoDoArtefatoSchema` | const (zod) | `shared/src/assistente/artefato.ts` | 1 |
| `esquemaArtefatoResumido` | `artefatoResumidoSchema` | const (zod) | `shared/src/assistente/artefato.ts` | 1 |
| `esquemaConsultaArtefatos` | `artefatosQuerySchema` | const (zod) | `shared/src/assistente/artefato.ts` | 2 |
| `esquemaEntregaDoArtefato` | `entregaDoArtefatoSchema` | const (zod) | `shared/src/assistente/artefato.ts` | 2 |
| `esquemaParametroFerramenta` | `parametroFerramentaSchema` | const (zod) | `shared/src/assistente/artefato.ts` | 2 |
| `esquemaPedidoAdaptarArtefato` | `adaptarArtefatoRequestSchema` | const (zod) | `shared/src/assistente/artefato.ts` | 4 |
| `esquemaPedidoGerarComFerramenta` | `gerarComFerramentaRequestSchema` | const (zod) | `shared/src/assistente/artefato.ts` | 4 |
| `esquemaPedidoRenomearArtefato` | `renomearArtefatoRequestSchema` | const (zod) | `shared/src/assistente/artefato.ts` | 4 |
| `esquemaRespostaArtefato` | `artefatoResponseSchema` | const (zod) | `shared/src/assistente/artefato.ts` | 5 |
| `esquemaRespostaListaDeArtefatos` | `listaDeArtefatosResponseSchema` | const (zod) | `shared/src/assistente/artefato.ts` | 4 |
| `esquemaAdaptacaoAplicada` | `adaptacaoAplicadaSchema` | const (zod) | `shared/src/assistente/conteudo.ts` | 4 |
| `esquemaCitacao` | `citacaoSchema` | const (zod) | `shared/src/assistente/conteudo.ts` | 7 |
| `esquemaConteudoDeAtividade` | `conteudoDeAtividadeSchema` | const (zod) | `shared/src/assistente/conteudo.ts` | 11 |
| `esquemaConteudoDePlanoDeAula` | `conteudoDePlanoDeAulaSchema` | const (zod) | `shared/src/assistente/conteudo.ts` | 3 |
| `esquemaConteudoDoArtefato` | `conteudoDoArtefatoSchema` | const (zod) | `shared/src/assistente/conteudo.ts` | 7 |
| `esquemaEtapaDoPlano` | `etapaDoPlanoSchema` | const (zod) | `shared/src/assistente/conteudo.ts` | 0 |
| `esquemaHabilidade` | `habilidadeSchema` | const (zod) | `shared/src/assistente/conteudo.ts` | 8 |
| `esquemaQuestaoObjetiva` | `questaoObjetivaSchema` | const (zod) | `shared/src/assistente/conteudo.ts` | 2 |
| `ConsultaConversaDoAssistente` | `ConversaDoAssistenteQuery` | type | `shared/src/assistente/conversa.ts` | 3 |
| `PedidoMensagemAoAssistente` | `MensagemAoAssistenteRequest` | type | `shared/src/assistente/conversa.ts` | 5 |
| `RespostaAProposta` | `APropostaResponse` | type | `shared/src/assistente/conversa.ts` | 0 |
| `RespostaConversaDoAssistente` | `ConversaDoAssistenteResponse` | type | `shared/src/assistente/conversa.ts` | 4 |
| `esquemaConsultaConversaDoAssistente` | `conversaDoAssistenteQuerySchema` | const (zod) | `shared/src/assistente/conversa.ts` | 3 |
| `esquemaConteudoDaMensagemDoAgente` | `conteudoDaMensagemDoAgenteSchema` | const (zod) | `shared/src/assistente/conversa.ts` | 6 |
| `esquemaConteudoDaMensagemDoUsuario` | `conteudoDaMensagemDoUsuarioSchema` | const (zod) | `shared/src/assistente/conversa.ts` | 3 |
| `esquemaMensagemDaConversa` | `mensagemDaConversaSchema` | const (zod) | `shared/src/assistente/conversa.ts` | 2 |
| `esquemaMensagemDoAgente` | `mensagemDoAgenteSchema` | const (zod) | `shared/src/assistente/conversa.ts` | 2 |
| `esquemaMensagemDoUsuario` | `mensagemDoUsuarioSchema` | const (zod) | `shared/src/assistente/conversa.ts` | 1 |
| `esquemaParametrosDeFerramenta` | `parametrosDeFerramentaSchema` | const (zod) | `shared/src/assistente/conversa.ts` | 4 |
| `esquemaPedidoMensagemAoAssistente` | `mensagemAoAssistenteRequestSchema` | const (zod) | `shared/src/assistente/conversa.ts` | 4 |
| `esquemaPropostaDeFerramenta` | `propostaDeFerramentaSchema` | const (zod) | `shared/src/assistente/conversa.ts` | 1 |
| `esquemaRespostaConversaDoAssistente` | `conversaDoAssistenteResponseSchema` | const (zod) | `shared/src/assistente/conversa.ts` | 5 |
| `ConsultaEntregas` | `EntregasQuery` | type | `shared/src/assistente/entrega.ts` | 4 |
| `PedidoDecidirEntrega` | `DecidirEntregaRequest` | type | `shared/src/assistente/entrega.ts` | 5 |
| `RespostaEntrega` | `EntregaResponse` | type | `shared/src/assistente/entrega.ts` | 4 |
| `RespostaListaDeEntregas` | `ListaDeEntregasResponse` | type | `shared/src/assistente/entrega.ts` | 5 |
| `esquemaAutorDaDecisao` | `autorDaDecisaoSchema` | const (zod) | `shared/src/assistente/entrega.ts` | 2 |
| `esquemaConsultaEntregas` | `entregasQuerySchema` | const (zod) | `shared/src/assistente/entrega.ts` | 3 |
| `esquemaEntrega` | `entregaSchema` | const (zod) | `shared/src/assistente/entrega.ts` | 4 |
| `esquemaPedidoDecidirEntrega` | `decidirEntregaRequestSchema` | const (zod) | `shared/src/assistente/entrega.ts` | 4 |
| `esquemaRespostaEntrega` | `entregaResponseSchema` | const (zod) | `shared/src/assistente/entrega.ts` | 4 |
| `esquemaRespostaListaDeEntregas` | `listaDeEntregasResponseSchema` | const (zod) | `shared/src/assistente/entrega.ts` | 5 |
| `ConsultaAtividadesAplicadas` | `AtividadesAplicadasQuery` | type | `shared/src/atividade/atividade-aplicada.ts` | 4 |
| `PedidoAplicarAtividade` | `AplicarAtividadeRequest` | type | `shared/src/atividade/atividade-aplicada.ts` | 4 |
| `RespostaAtividadeAplicada` | `AtividadeAplicadaResponse` | type | `shared/src/atividade/atividade-aplicada.ts` | 4 |
| `RespostaAtividadeEncerrada` | `AtividadeEncerradaResponse` | type | `shared/src/atividade/atividade-aplicada.ts` | 4 |
| `RespostaListaDeAtividadesAplicadas` | `ListaDeAtividadesAplicadasResponse` | type | `shared/src/atividade/atividade-aplicada.ts` | 3 |
| `esquemaAtividadeAplicada` | `atividadeAplicadaSchema` | const (zod) | `shared/src/atividade/atividade-aplicada.ts` | 2 |
| `esquemaConsultaAtividadesAplicadas` | `atividadesAplicadasQuerySchema` | const (zod) | `shared/src/atividade/atividade-aplicada.ts` | 2 |
| `esquemaPedidoAplicarAtividade` | `aplicarAtividadeRequestSchema` | const (zod) | `shared/src/atividade/atividade-aplicada.ts` | 3 |
| `esquemaPedidoSemCorpo` | `emptyBodyRequestSchema` | const (zod) | `shared/src/atividade/atividade-aplicada.ts` | 6 |
| `esquemaPedidoSemCorpoOuAusente` | `emptyOrMissingBodyRequestSchema` | const (zod) | `shared/src/atividade/atividade-aplicada.ts` | 7 |
| `esquemaRespostaAtividadeAplicada` | `atividadeAplicadaResponseSchema` | const (zod) | `shared/src/atividade/atividade-aplicada.ts` | 4 |
| `esquemaRespostaAtividadeEncerrada` | `atividadeEncerradaResponseSchema` | const (zod) | `shared/src/atividade/atividade-aplicada.ts` | 5 |
| `esquemaRespostaListaDeAtividadesAplicadas` | `listaDeAtividadesAplicadasResponseSchema` | const (zod) | `shared/src/atividade/atividade-aplicada.ts` | 4 |
| `RespostaCorrecaoDoLote` | `CorrecaoDoLoteResponse` | type | `shared/src/atividade/correcao.ts` | 6 |
| `RespostaDestaqueAberto` | `DestaqueAbertoResponse` | type | `shared/src/atividade/correcao.ts` | 5 |
| `RespostaLoteAprovado` | `LoteAprovadoResponse` | type | `shared/src/atividade/correcao.ts` | 4 |
| `esquemaCorrecaoDoAluno` | `correcaoDoAlunoSchema` | const (zod) | `shared/src/atividade/correcao.ts` | 1 |
| `esquemaDestaque` | `destaqueSchema` | const (zod) | `shared/src/atividade/correcao.ts` | 1 |
| `esquemaDestaquesAbertos` | `destaquesAbertosSchema` | const (zod) | `shared/src/atividade/correcao.ts` | 4 |
| `esquemaDiagnosticoGravado` | `diagnosticoGravadoSchema` | const (zod) | `shared/src/atividade/correcao.ts` | 5 |
| `esquemaFaixaDeAcertos` | `faixaDeAcertosSchema` | const (zod) | `shared/src/atividade/correcao.ts` | 1 |
| `esquemaLoteApresentado` | `loteApresentadoSchema` | const (zod) | `shared/src/atividade/correcao.ts` | 6 |
| `esquemaQuestaoDoLote` | `questaoDoLoteSchema` | const (zod) | `shared/src/atividade/correcao.ts` | 1 |
| `esquemaRespostaCorrecaoDoLote` | `correcaoDoLoteResponseSchema` | const (zod) | `shared/src/atividade/correcao.ts` | 5 |
| `esquemaRespostaCorrigida` | `corrigidaResponseSchema` | const (zod) | `shared/src/atividade/correcao.ts` | 1 |
| `esquemaRespostaDestaqueAberto` | `destaqueAbertoResponseSchema` | const (zod) | `shared/src/atividade/correcao.ts` | 4 |
| `esquemaRespostaLoteAprovado` | `loteAprovadoResponseSchema` | const (zod) | `shared/src/atividade/correcao.ts` | 5 |
| `esquemaResumoDoLote` | `resumoDoLoteSchema` | const (zod) | `shared/src/atividade/correcao.ts` | 2 |
| `esquemaValidacaoDoLote` | `validacaoDoLoteSchema` | const (zod) | `shared/src/atividade/correcao.ts` | 2 |
| `ConsultaDesempenhoDaTurma` | `DesempenhoDaTurmaQuery` | type | `shared/src/atividade/desempenho.ts` | 3 |
| `RespostaDesempenhoDaTurma` | `DesempenhoDaTurmaResponse` | type | `shared/src/atividade/desempenho.ts` | 7 |
| `esquemaConsultaDesempenhoDaTurma` | `desempenhoDaTurmaQuerySchema` | const (zod) | `shared/src/atividade/desempenho.ts` | 3 |
| `esquemaDesempenhoDoAluno` | `desempenhoDoAlunoSchema` | const (zod) | `shared/src/atividade/desempenho.ts` | 1 |
| `esquemaHabilidadeDaTurma` | `habilidadeDaTurmaSchema` | const (zod) | `shared/src/atividade/desempenho.ts` | 1 |
| `esquemaRespostaDesempenhoDaTurma` | `desempenhoDaTurmaResponseSchema` | const (zod) | `shared/src/atividade/desempenho.ts` | 6 |
| `ConsultaMinhasAtividades` | `MinhasAtividadesQuery` | type | `shared/src/atividade/prova.ts` | 2 |
| `PedidoResponderQuestao` | `ResponderQuestaoRequest` | type | `shared/src/atividade/prova.ts` | 3 |
| `RespostaAtividadeEnviada` | `AtividadeEnviadaResponse` | type | `shared/src/atividade/prova.ts` | 4 |
| `RespostaMeuDiagnostico` | `MeuDiagnosticoResponse` | type | `shared/src/atividade/prova.ts` | 8 |
| `RespostaMinhasAtividades` | `MinhasAtividadesResponse` | type | `shared/src/atividade/prova.ts` | 3 |
| `RespostaProva` | `ProvaResponse` | type | `shared/src/atividade/prova.ts` | 9 |
| `RespostaQuestaoSalva` | `QuestaoSalvaResponse` | type | `shared/src/atividade/prova.ts` | 8 |
| `RespostaSalva` | `SalvaResponse` | type | `shared/src/atividade/prova.ts` | 3 |
| `esquemaAcertoPorHabilidade` | `acertoPorHabilidadeSchema` | const (zod) | `shared/src/atividade/prova.ts` | 4 |
| `esquemaAlternativa` | `alternativaSchema` | const (zod) | `shared/src/atividade/prova.ts` | 2 |
| `esquemaConsultaMinhasAtividades` | `minhasAtividadesQuerySchema` | const (zod) | `shared/src/atividade/prova.ts` | 2 |
| `esquemaEspelhoDaFila` | `espelhoDaFilaSchema` | const (zod) | `shared/src/atividade/prova.ts` | 2 |
| `esquemaMinhaAtividade` | `minhaAtividadeSchema` | const (zod) | `shared/src/atividade/prova.ts` | 3 |
| `esquemaNumeroDaQuestao` | `numeroDaQuestaoSchema` | const (zod) | `shared/src/atividade/prova.ts` | 3 |
| `esquemaPedidoResponderQuestao` | `responderQuestaoRequestSchema` | const (zod) | `shared/src/atividade/prova.ts` | 3 |
| `esquemaQuestaoDaProva` | `questaoDaProvaSchema` | const (zod) | `shared/src/atividade/prova.ts` | 2 |
| `esquemaQuestaoDoCaminho` | `questaoDoCaminhoSchema` | const (zod) | `shared/src/atividade/prova.ts` | 3 |
| `esquemaQuestaoDoDiagnostico` | `questaoDoDiagnosticoSchema` | const (zod) | `shared/src/atividade/prova.ts` | 1 |
| `esquemaRespostaAtividadeEnviada` | `atividadeEnviadaResponseSchema` | const (zod) | `shared/src/atividade/prova.ts` | 3 |
| `esquemaRespostaMeuDiagnostico` | `meuDiagnosticoResponseSchema` | const (zod) | `shared/src/atividade/prova.ts` | 5 |
| `esquemaRespostaMinhasAtividades` | `minhasAtividadesResponseSchema` | const (zod) | `shared/src/atividade/prova.ts` | 6 |
| `esquemaRespostaProva` | `provaResponseSchema` | const (zod) | `shared/src/atividade/prova.ts` | 6 |
| `esquemaRespostaQuestaoSalva` | `questaoSalvaResponseSchema` | const (zod) | `shared/src/atividade/prova.ts` | 5 |
| `esquemaRespostaSalva` | `salvaResponseSchema` | const (zod) | `shared/src/atividade/prova.ts` | 1 |
| `esquemaSequencia` | `sequenciaSchema` | const (zod) | `shared/src/atividade/prova.ts` | 1 |
| `PedidoCriarAnoLetivo` | `CriarAnoLetivoRequest` | type | `shared/src/estrutura/ano-letivo.ts` | 5 |
| `RespostaAnoLetivo` | `AnoLetivoResponse` | type | `shared/src/estrutura/ano-letivo.ts` | 3 |
| `RespostaListaDeAnosLetivos` | `ListaDeAnosLetivosResponse` | type | `shared/src/estrutura/ano-letivo.ts` | 3 |
| `esquemaAnoLetivo` | `anoLetivoSchema` | const (zod) | `shared/src/estrutura/ano-letivo.ts` | 1 |
| `esquemaPedidoCriarAnoLetivo` | `criarAnoLetivoRequestSchema` | const (zod) | `shared/src/estrutura/ano-letivo.ts` | 3 |
| `esquemaRespostaAnoLetivo` | `anoLetivoResponseSchema` | const (zod) | `shared/src/estrutura/ano-letivo.ts` | 3 |
| `esquemaRespostaListaDeAnosLetivos` | `listaDeAnosLetivosResponseSchema` | const (zod) | `shared/src/estrutura/ano-letivo.ts` | 3 |
| `PedidoCriarDisciplina` | `CriarDisciplinaRequest` | type | `shared/src/estrutura/disciplina.ts` | 5 |
| `PedidoRenomearDisciplina` | `RenomearDisciplinaRequest` | type | `shared/src/estrutura/disciplina.ts` | 3 |
| `RespostaDisciplina` | `DisciplinaResponse` | type | `shared/src/estrutura/disciplina.ts` | 3 |
| `RespostaListaDeDisciplinas` | `ListaDeDisciplinasResponse` | type | `shared/src/estrutura/disciplina.ts` | 3 |
| `esquemaDisciplina` | `disciplinaSchema` | const (zod) | `shared/src/estrutura/disciplina.ts` | 1 |
| `esquemaPedidoCriarDisciplina` | `criarDisciplinaRequestSchema` | const (zod) | `shared/src/estrutura/disciplina.ts` | 2 |
| `esquemaPedidoRenomearDisciplina` | `renomearDisciplinaRequestSchema` | const (zod) | `shared/src/estrutura/disciplina.ts` | 2 |
| `esquemaRespostaDisciplina` | `disciplinaResponseSchema` | const (zod) | `shared/src/estrutura/disciplina.ts` | 4 |
| `esquemaRespostaListaDeDisciplinas` | `listaDeDisciplinasResponseSchema` | const (zod) | `shared/src/estrutura/disciplina.ts` | 3 |
| `ConsultaListaDaTurma` | `ListaDaTurmaQuery` | type | `shared/src/estrutura/lista.ts` | 3 |
| `PedidoNomeAvulso` | `NomeAvulsoRequest` | type | `shared/src/estrutura/lista.ts` | 4 |
| `PedidoTextoDaLista` | `TextoDaListaRequest` | type | `shared/src/estrutura/lista.ts` | 3 |
| `RespostaGravacaoDaLista` | `GravacaoDaListaResponse` | type | `shared/src/estrutura/lista.ts` | 4 |
| `RespostaListaDaTurma` | `ListaDaTurmaResponse` | type | `shared/src/estrutura/lista.ts` | 3 |
| `RespostaPreviaDaLista` | `PreviaDaListaResponse` | type | `shared/src/estrutura/lista.ts` | 7 |
| `esquemaConsultaListaDaTurma` | `listaDaTurmaQuerySchema` | const (zod) | `shared/src/estrutura/lista.ts` | 2 |
| `esquemaLinhaDaPrevia` | `linhaDaPreviaSchema` | const (zod) | `shared/src/estrutura/lista.ts` | 2 |
| `esquemaMatriculaDigitada` | `matriculaDigitadaSchema` | const (zod) | `shared/src/estrutura/lista.ts` | 4 |
| `esquemaNomeDaLista` | `nomeDaListaSchema` | const (zod) | `shared/src/estrutura/lista.ts` | 4 |
| `esquemaPedidoNomeAvulso` | `nomeAvulsoRequestSchema` | const (zod) | `shared/src/estrutura/lista.ts` | 2 |
| `esquemaPedidoTextoDaLista` | `textoDaListaRequestSchema` | const (zod) | `shared/src/estrutura/lista.ts` | 2 |
| `esquemaRespostaGravacaoDaLista` | `gravacaoDaListaResponseSchema` | const (zod) | `shared/src/estrutura/lista.ts` | 4 |
| `esquemaRespostaListaDaTurma` | `listaDaTurmaResponseSchema` | const (zod) | `shared/src/estrutura/lista.ts` | 5 |
| `esquemaRespostaPreviaDaLista` | `previaDaListaResponseSchema` | const (zod) | `shared/src/estrutura/lista.ts` | 6 |
| `PedidoProvedoresDaEscola` | `ProvedoresDaEscolaRequest` | type | `shared/src/estrutura/provedores.ts` | 3 |
| `RespostaProvedoresDaEscola` | `ProvedoresDaEscolaResponse` | type | `shared/src/estrutura/provedores.ts` | 3 |
| `esquemaPedidoProvedoresDaEscola` | `provedoresDaEscolaRequestSchema` | const (zod) | `shared/src/estrutura/provedores.ts` | 3 |
| `esquemaProvedorDaEscola` | `provedorDaEscolaSchema` | const (zod) | `shared/src/estrutura/provedores.ts` | 1 |
| `esquemaRespostaProvedoresDaEscola` | `provedoresDaEscolaResponseSchema` | const (zod) | `shared/src/estrutura/provedores.ts` | 2 |
| `PedidoCriarSerie` | `CriarSerieRequest` | type | `shared/src/estrutura/serie.ts` | 5 |
| `RespostaListaDeSeries` | `ListaDeSeriesResponse` | type | `shared/src/estrutura/serie.ts` | 3 |
| `RespostaSerie` | `SerieResponse` | type | `shared/src/estrutura/serie.ts` | 3 |
| `esquemaPedidoCriarSerie` | `criarSerieRequestSchema` | const (zod) | `shared/src/estrutura/serie.ts` | 2 |
| `esquemaRespostaListaDeSeries` | `listaDeSeriesResponseSchema` | const (zod) | `shared/src/estrutura/serie.ts` | 3 |
| `esquemaRespostaSerie` | `serieResponseSchema` | const (zod) | `shared/src/estrutura/serie.ts` | 3 |
| `esquemaSerie` | `serieSchema` | const (zod) | `shared/src/estrutura/serie.ts` | 5 |
| `ConsultaAlunosDaTurma` | `AlunosDaTurmaQuery` | type | `shared/src/estrutura/turma.ts` | 3 |
| `ConsultaTurma` | `TurmaQuery` | type | `shared/src/estrutura/turma.ts` | 3 |
| `PedidoCriarTurma` | `CriarTurmaRequest` | type | `shared/src/estrutura/turma.ts` | 4 |
| `PedidoRenomearTurma` | `RenomearTurmaRequest` | type | `shared/src/estrutura/turma.ts` | 3 |
| `RespostaAlunosDaTurma` | `AlunosDaTurmaResponse` | type | `shared/src/estrutura/turma.ts` | 3 |
| `RespostaListaDeTurmas` | `ListaDeTurmasResponse` | type | `shared/src/estrutura/turma.ts` | 3 |
| `RespostaTurma` | `TurmaResponse` | type | `shared/src/estrutura/turma.ts` | 3 |
| `RespostaTurmaAberta` | `TurmaAbertaResponse` | type | `shared/src/estrutura/turma.ts` | 4 |
| `esquemaAlunoDaTurma` | `alunoDaTurmaSchema` | const (zod) | `shared/src/estrutura/turma.ts` | 1 |
| `esquemaConsultaAlunosDaTurma` | `alunosDaTurmaQuerySchema` | const (zod) | `shared/src/estrutura/turma.ts` | 2 |
| `esquemaConsultaTurma` | `turmaQuerySchema` | const (zod) | `shared/src/estrutura/turma.ts` | 2 |
| `esquemaPedidoCriarTurma` | `criarTurmaRequestSchema` | const (zod) | `shared/src/estrutura/turma.ts` | 2 |
| `esquemaPedidoRenomearTurma` | `renomearTurmaRequestSchema` | const (zod) | `shared/src/estrutura/turma.ts` | 2 |
| `esquemaRespostaAlunosDaTurma` | `alunosDaTurmaResponseSchema` | const (zod) | `shared/src/estrutura/turma.ts` | 5 |
| `esquemaRespostaListaDeTurmas` | `listaDeTurmasResponseSchema` | const (zod) | `shared/src/estrutura/turma.ts` | 3 |
| `esquemaRespostaTurma` | `turmaResponseSchema` | const (zod) | `shared/src/estrutura/turma.ts` | 4 |
| `esquemaRespostaTurmaAberta` | `turmaAbertaResponseSchema` | const (zod) | `shared/src/estrutura/turma.ts` | 3 |
| `esquemaTurma` | `turmaSchema` | const (zod) | `shared/src/estrutura/turma.ts` | 1 |
| `ConsultaVinculos` | `VinculosQuery` | type | `shared/src/estrutura/vinculo.ts` | 3 |
| `PedidoContestarVinculo` | `ContestarVinculoRequest` | type | `shared/src/estrutura/vinculo.ts` | 4 |
| `PedidoCriarVinculo` | `CriarVinculoRequest` | type | `shared/src/estrutura/vinculo.ts` | 4 |
| `PedidoEncerrarVinculo` | `EncerrarVinculoRequest` | type | `shared/src/estrutura/vinculo.ts` | 3 |
| `RespostaListaDeVinculos` | `ListaDeVinculosResponse` | type | `shared/src/estrutura/vinculo.ts` | 3 |
| `RespostaMeusVinculos` | `MeusVinculosResponse` | type | `shared/src/estrutura/vinculo.ts` | 4 |
| `RespostaVinculo` | `VinculoResponse` | type | `shared/src/estrutura/vinculo.ts` | 4 |
| `RespostaVinculoDaCoordenacao` | `VinculoDaCoordenacaoResponse` | type | `shared/src/estrutura/vinculo.ts` | 3 |
| `esquemaConsultaVinculos` | `vinculosQuerySchema` | const (zod) | `shared/src/estrutura/vinculo.ts` | 2 |
| `esquemaPedidoContestarVinculo` | `contestarVinculoRequestSchema` | const (zod) | `shared/src/estrutura/vinculo.ts` | 2 |
| `esquemaPedidoCriarVinculo` | `criarVinculoRequestSchema` | const (zod) | `shared/src/estrutura/vinculo.ts` | 2 |
| `esquemaPedidoEncerrarVinculo` | `encerrarVinculoRequestSchema` | const (zod) | `shared/src/estrutura/vinculo.ts` | 2 |
| `esquemaRespostaListaDeVinculos` | `listaDeVinculosResponseSchema` | const (zod) | `shared/src/estrutura/vinculo.ts` | 3 |
| `esquemaRespostaMeusVinculos` | `meusVinculosResponseSchema` | const (zod) | `shared/src/estrutura/vinculo.ts` | 3 |
| `esquemaRespostaVinculo` | `vinculoResponseSchema` | const (zod) | `shared/src/estrutura/vinculo.ts` | 3 |
| `esquemaRespostaVinculoDaCoordenacao` | `vinculoDaCoordenacaoResponseSchema` | const (zod) | `shared/src/estrutura/vinculo.ts` | 3 |
| `esquemaVinculo` | `vinculoSchema` | const (zod) | `shared/src/estrutura/vinculo.ts` | 1 |
| `esquemaVinculoDaCoordenacao` | `vinculoDaCoordenacaoSchema` | const (zod) | `shared/src/estrutura/vinculo.ts` | 1 |
| `ConsultaAnalistaNominal` | `AnalistaNominalQuery` | type | `shared/src/governanca/analista.ts` | 3 |
| `PedidoGerarResumoDoAnalista` | `GerarResumoDoAnalistaRequest` | type | `shared/src/governanca/analista.ts` | 3 |
| `RespostaAnalistaNominal` | `AnalistaNominalResponse` | type | `shared/src/governanca/analista.ts` | 5 |
| `RespostaResumoDoAnalista` | `ResumoDoAnalistaResponse` | type | `shared/src/governanca/analista.ts` | 3 |
| `esquemaAlertaDoAnalista` | `alertaDoAnalistaSchema` | const (zod) | `shared/src/governanca/analista.ts` | 2 |
| `esquemaConsultaAnalistaNominal` | `analistaNominalQuerySchema` | const (zod) | `shared/src/governanca/analista.ts` | 3 |
| `esquemaConteudoDoResumoDoAnalista` | `conteudoDoResumoDoAnalistaSchema` | const (zod) | `shared/src/governanca/analista.ts` | 7 |
| `esquemaPedidoGerarResumoDoAnalista` | `gerarResumoDoAnalistaRequestSchema` | const (zod) | `shared/src/governanca/analista.ts` | 2 |
| `esquemaRecorteDoAnalista` | `recorteDoAnalistaSchema` | const (zod) | `shared/src/governanca/analista.ts` | 2 |
| `esquemaRecorteNominal` | `recorteNominalSchema` | const (zod) | `shared/src/governanca/analista.ts` | 1 |
| `esquemaRespostaAnalistaNominal` | `analistaNominalResponseSchema` | const (zod) | `shared/src/governanca/analista.ts` | 5 |
| `esquemaRespostaResumoDoAnalista` | `resumoDoAnalistaResponseSchema` | const (zod) | `shared/src/governanca/analista.ts` | 5 |
| `ConsultaConsumo` | `ConsumoQuery` | type | `shared/src/governanca/governanca.ts` | 3 |
| `ConsultaResumoDaGovernanca` | `ResumoDaGovernancaQuery` | type | `shared/src/governanca/governanca.ts` | 4 |
| `PedidoSuspenderFuncao` | `SuspenderFuncaoRequest` | type | `shared/src/governanca/governanca.ts` | 3 |
| `RespostaConsumo` | `ConsumoResponse` | type | `shared/src/governanca/governanca.ts` | 3 |
| `RespostaFuncaoDaGovernanca` | `FuncaoDaGovernancaResponse` | type | `shared/src/governanca/governanca.ts` | 2 |
| `RespostaFuncoesDaGovernanca` | `FuncoesDaGovernancaResponse` | type | `shared/src/governanca/governanca.ts` | 5 |
| `RespostaResumoDaGovernanca` | `ResumoDaGovernancaResponse` | type | `shared/src/governanca/governanca.ts` | 3 |
| `esquemaConsultaConsumo` | `consumoQuerySchema` | const (zod) | `shared/src/governanca/governanca.ts` | 3 |
| `esquemaConsultaResumoDaGovernanca` | `resumoDaGovernancaQuerySchema` | const (zod) | `shared/src/governanca/governanca.ts` | 3 |
| `esquemaConsumoSomado` | `consumoSomadoSchema` | const (zod) | `shared/src/governanca/governanca.ts` | 1 |
| `esquemaFuncaoDaGovernanca` | `funcaoDaGovernancaSchema` | const (zod) | `shared/src/governanca/governanca.ts` | 1 |
| `esquemaItemDaGovernanca` | `itemDaGovernancaSchema` | const (zod) | `shared/src/governanca/governanca.ts` | 2 |
| `esquemaPedidoSuspenderFuncao` | `suspenderFuncaoRequestSchema` | const (zod) | `shared/src/governanca/governanca.ts` | 3 |
| `esquemaRespostaConsumo` | `consumoResponseSchema` | const (zod) | `shared/src/governanca/governanca.ts` | 5 |
| `esquemaRespostaFuncaoDaGovernanca` | `funcaoDaGovernancaResponseSchema` | const (zod) | `shared/src/governanca/governanca.ts` | 4 |
| `esquemaRespostaFuncoesDaGovernanca` | `funcoesDaGovernancaResponseSchema` | const (zod) | `shared/src/governanca/governanca.ts` | 5 |
| `esquemaRespostaResumoDaGovernanca` | `resumoDaGovernancaResponseSchema` | const (zod) | `shared/src/governanca/governanca.ts` | 5 |
| `esquemaSuspensaoVigente` | `suspensaoVigenteSchema` | const (zod) | `shared/src/governanca/governanca.ts` | 1 |
| `ConsultaBuscaDeMaterial` | `BuscaDeMaterialQuery` | type | `shared/src/material/material.ts` | 3 |
| `ConsultaMateriais` | `MateriaisQuery` | type | `shared/src/material/material.ts` | 4 |
| `PedidoEnviarMaterial` | `EnviarMaterialRequest` | type | `shared/src/material/material.ts` | 3 |
| `RespostaBuscaDeMaterial` | `BuscaDeMaterialResponse` | type | `shared/src/material/material.ts` | 3 |
| `RespostaListaDeMateriais` | `ListaDeMateriaisResponse` | type | `shared/src/material/material.ts` | 3 |
| `RespostaMaterial` | `MaterialResponse` | type | `shared/src/material/material.ts` | 3 |
| `esquemaConsultaBuscaDeMaterial` | `buscaDeMaterialQuerySchema` | const (zod) | `shared/src/material/material.ts` | 3 |
| `esquemaConsultaMateriais` | `materiaisQuerySchema` | const (zod) | `shared/src/material/material.ts` | 2 |
| `esquemaMaterial` | `materialSchema` | const (zod) | `shared/src/material/material.ts` | 2 |
| `esquemaPedidoEnviarMaterial` | `enviarMaterialRequestSchema` | const (zod) | `shared/src/material/material.ts` | 4 |
| `esquemaRespostaBuscaDeMaterial` | `buscaDeMaterialResponseSchema` | const (zod) | `shared/src/material/material.ts` | 5 |
| `esquemaRespostaListaDeMateriais` | `listaDeMateriaisResponseSchema` | const (zod) | `shared/src/material/material.ts` | 6 |
| `esquemaRespostaMaterial` | `materialResponseSchema` | const (zod) | `shared/src/material/material.ts` | 4 |
| `esquemaTrechoEncontrado` | `trechoEncontradoSchema` | const (zod) | `shared/src/material/material.ts` | 1 |
| `PedidoAceitarConviteDeOperador` | `AceitarConviteDeOperadorRequest` | type | `shared/src/operacao/convite.ts` | 4 |
| `PedidoConsultarConviteDeOperador` | `ConsultarConviteDeOperadorRequest` | type | `shared/src/operacao/convite.ts` | 2 |
| `RespostaAceitarConviteDeOperador` | `AceitarConviteDeOperadorResponse` | type | `shared/src/operacao/convite.ts` | 3 |
| `RespostaConsultarConviteDeOperador` | `ConsultarConviteDeOperadorResponse` | type | `shared/src/operacao/convite.ts` | 4 |
| `esquemaPedidoAceitarConviteDeOperador` | `aceitarConviteDeOperadorRequestSchema` | const (zod) | `shared/src/operacao/convite.ts` | 2 |
| `esquemaPedidoConsultarConviteDeOperador` | `consultarConviteDeOperadorRequestSchema` | const (zod) | `shared/src/operacao/convite.ts` | 2 |
| `esquemaRespostaAceitarConviteDeOperador` | `aceitarConviteDeOperadorResponseSchema` | const (zod) | `shared/src/operacao/convite.ts` | 6 |
| `esquemaRespostaConsultarConviteDeOperador` | `consultarConviteDeOperadorResponseSchema` | const (zod) | `shared/src/operacao/convite.ts` | 4 |
| `PedidoEntradaDeOperador` | `EntradaDeOperadorRequest` | type | `shared/src/operacao/entrada.ts` | 4 |
| `RespostaEntradaDeOperador` | `EntradaDeOperadorResponse` | type | `shared/src/operacao/entrada.ts` | 4 |
| `esquemaPedidoEntradaDeOperador` | `entradaDeOperadorRequestSchema` | const (zod) | `shared/src/operacao/entrada.ts` | 2 |
| `esquemaRespostaEntradaDeOperador` | `entradaDeOperadorResponseSchema` | const (zod) | `shared/src/operacao/entrada.ts` | 6 |
| `RespostaEuDoOperador` | `EuDoOperadorResponse` | type | `shared/src/operacao/eu.ts` | 4 |
| `esquemaRespostaEuDoOperador` | `euDoOperadorResponseSchema` | const (zod) | `shared/src/operacao/eu.ts` | 5 |
| `ConsultaDoPainel` | `PainelQuery` | type | `shared/src/operacao/painel.ts` | 6 |
| `PedidoConviteDaCoordenacao` | `ConviteDaCoordenacaoRequest` | type | `shared/src/operacao/painel.ts` | 5 |
| `PedidoCriarEscola` | `CriarEscolaRequest` | type | `shared/src/operacao/painel.ts` | 6 |
| `PedidoCriarRede` | `CriarRedeRequest` | type | `shared/src/operacao/painel.ts` | 5 |
| `RespostaConviteDaCoordenacao` | `ConviteDaCoordenacaoResponse` | type | `shared/src/operacao/painel.ts` | 6 |
| `RespostaCriadoNoPainel` | `CriadoNoPainelResponse` | type | `shared/src/operacao/painel.ts` | 4 |
| `RespostaEscolasDoPainel` | `EscolasDoPainelResponse` | type | `shared/src/operacao/painel.ts` | 5 |
| `RespostaRedesDoPainel` | `RedesDoPainelResponse` | type | `shared/src/operacao/painel.ts` | 3 |
| `RespostaUsoDoPainel` | `UsoDoPainelResponse` | type | `shared/src/operacao/painel.ts` | 6 |
| `esquemaConsultaDoPainel` | `painelQuerySchema` | const (zod) | `shared/src/operacao/painel.ts` | 3 |
| `esquemaEmailConvidado` | `emailConvidadoSchema` | const (zod) | `shared/src/operacao/painel.ts` | 4 |
| `esquemaEscolaDoPainel` | `escolaDoPainelSchema` | const (zod) | `shared/src/operacao/painel.ts` | 1 |
| `esquemaIdDoPedido` | `idDoPedidoSchema` | const (zod) | `shared/src/operacao/painel.ts` | 2 |
| `esquemaNomeDigitado` | `nomeDigitadoSchema` | const (zod) | `shared/src/operacao/painel.ts` | 5 |
| `esquemaPedidoConviteDaCoordenacao` | `conviteDaCoordenacaoRequestSchema` | const (zod) | `shared/src/operacao/painel.ts` | 4 |
| `esquemaPedidoCriarEscola` | `criarEscolaRequestSchema` | const (zod) | `shared/src/operacao/painel.ts` | 4 |
| `esquemaPedidoCriarRede` | `criarRedeRequestSchema` | const (zod) | `shared/src/operacao/painel.ts` | 4 |
| `esquemaRedeDoPainel` | `redeDoPainelSchema` | const (zod) | `shared/src/operacao/painel.ts` | 1 |
| `esquemaRespostaConviteDaCoordenacao` | `conviteDaCoordenacaoResponseSchema` | const (zod) | `shared/src/operacao/painel.ts` | 6 |
| `esquemaRespostaCriadoNoPainel` | `criadoNoPainelResponseSchema` | const (zod) | `shared/src/operacao/painel.ts` | 5 |
| `esquemaRespostaEscolasDoPainel` | `escolasDoPainelResponseSchema` | const (zod) | `shared/src/operacao/painel.ts` | 6 |
| `esquemaRespostaRedesDoPainel` | `redesDoPainelResponseSchema` | const (zod) | `shared/src/operacao/painel.ts` | 5 |
| `esquemaRespostaUsoDoPainel` | `usoDoPainelResponseSchema` | const (zod) | `shared/src/operacao/painel.ts` | 5 |
| `esquemaSlugDaEscola` | `slugDaEscolaSchema` | const (zod) | `shared/src/operacao/painel.ts` | 4 |
| `esquemaUsoDaEscolaDoPainel` | `usoDaEscolaDoPainelSchema` | const (zod) | `shared/src/operacao/painel.ts` | 1 |
| `esquemaUsoDoPeriodoDoPainel` | `usoDoPeriodoDoPainelSchema` | const (zod) | `shared/src/operacao/painel.ts` | 1 |
| `PedidoConfigurarSegundoFatorDeOperador` | `ConfigurarSegundoFatorDeOperadorRequest` | type | `shared/src/operacao/segundo-fator.ts` | 3 |
| `PedidoSegundoFatorDeOperador` | `SegundoFatorDeOperadorRequest` | type | `shared/src/operacao/segundo-fator.ts` | 3 |
| `RespostaConfigurarSegundoFatorDeOperador` | `ConfigurarSegundoFatorDeOperadorResponse` | type | `shared/src/operacao/segundo-fator.ts` | 6 |
| `RespostaSegundoFatorDeOperador` | `SegundoFatorDeOperadorResponse` | type | `shared/src/operacao/segundo-fator.ts` | 3 |
| `esquemaPedidoConfigurarSegundoFatorDeOperador` | `configurarSegundoFatorDeOperadorRequestSchema` | const (zod) | `shared/src/operacao/segundo-fator.ts` | 2 |
| `esquemaPedidoSegundoFatorDeOperador` | `segundoFatorDeOperadorRequestSchema` | const (zod) | `shared/src/operacao/segundo-fator.ts` | 2 |
| `esquemaRespostaConfigurarSegundoFatorDeOperador` | `configurarSegundoFatorDeOperadorResponseSchema` | const (zod) | `shared/src/operacao/segundo-fator.ts` | 6 |
| `esquemaRespostaSegundoFatorDeOperador` | `segundoFatorDeOperadorResponseSchema` | const (zod) | `shared/src/operacao/segundo-fator.ts` | 5 |
| `RespostaRenovacaoDeOperador` | `RenovacaoDeOperadorResponse` | type | `shared/src/operacao/sessao.ts` | 4 |
| `esquemaRespostaRenovacaoDeOperador` | `renovacaoDeOperadorResponseSchema` | const (zod) | `shared/src/operacao/sessao.ts` | 4 |
| `RespostaDoArquivo` | `ArquivoResponse` | type | `shared/src/privacidade/arquivo.ts` | 7 |
| `RespostaMeusDados` | `MeusDadosResponse` | type | `shared/src/privacidade/arquivo.ts` | 5 |
| `esquemaBaixarArquivoDaEscola` | `baixarArquivoDaEscolaSchema` | const (zod) | `shared/src/privacidade/arquivo.ts` | 2 |
| `esquemaPedidoDeMeusDados` | `pedidoDeMeusDadosSchema` | const (zod) | `shared/src/privacidade/arquivo.ts` | 1 |
| `esquemaRespostaDoArquivo` | `arquivoResponseSchema` | const (zod) | `shared/src/privacidade/arquivo.ts` | 4 |
| `esquemaRespostaMeusDados` | `meusDadosResponseSchema` | const (zod) | `shared/src/privacidade/arquivo.ts` | 3 |
| `RespostaIncidentes` | `IncidentesResponse` | type | `shared/src/privacidade/incidente.ts` | 4 |
| `esquemaIncidenteDaEscola` | `incidenteDaEscolaSchema` | const (zod) | `shared/src/privacidade/incidente.ts` | 2 |
| `esquemaRespostaIncidentes` | `incidentesResponseSchema` | const (zod) | `shared/src/privacidade/incidente.ts` | 5 |
| `RespostaRetencao` | `RetencaoResponse` | type | `shared/src/privacidade/retencao.ts` | 5 |
| `esquemaPrazoFixo` | `prazoFixoSchema` | const (zod) | `shared/src/privacidade/retencao.ts` | 1 |
| `esquemaRespostaRetencao` | `retencaoResponseSchema` | const (zod) | `shared/src/privacidade/retencao.ts` | 4 |
| `esquemaRetencaoDaCategoria` | `retencaoDaCategoriaSchema` | const (zod) | `shared/src/privacidade/retencao.ts` | 1 |
| `RespostaSuboperadores` | `SuboperadoresResponse` | type | `shared/src/privacidade/suboperador.ts` | 4 |
| `esquemaRespostaSuboperadores` | `suboperadoresResponseSchema` | const (zod) | `shared/src/privacidade/suboperador.ts` | 5 |
| `esquemaSuboperadorDaEscola` | `suboperadorDaEscolaSchema` | const (zod) | `shared/src/privacidade/suboperador.ts` | 1 |
| `RespostaBuscaDeTitulares` | `BuscaDeTitularesResponse` | type | `shared/src/privacidade/titular.ts` | 4 |
| `RespostaPedidos` | `PedidosResponse` | type | `shared/src/privacidade/titular.ts` | 3 |
| `RespostaPreviaDoTitular` | `PreviaDoTitularResponse` | type | `shared/src/privacidade/titular.ts` | 5 |
| `esquemaBuscaDeTitulares` | `buscaDeTitularesSchema` | const (zod) | `shared/src/privacidade/titular.ts` | 2 |
| `esquemaCompartilhamento` | `compartilhamentoSchema` | const (zod) | `shared/src/privacidade/titular.ts` | 2 |
| `esquemaCorrecaoDeNome` | `correcaoDeNomeSchema` | const (zod) | `shared/src/privacidade/titular.ts` | 3 |
| `esquemaItemDoPedido` | `itemDoPedidoSchema` | const (zod) | `shared/src/privacidade/titular.ts` | 1 |
| `esquemaLinhaDoCompartilhamento` | `linhaDoCompartilhamentoSchema` | const (zod) | `shared/src/privacidade/titular.ts` | 1 |
| `esquemaPedidoDoTitular` | `pedidoDoTitularSchema` | const (zod) | `shared/src/privacidade/titular.ts` | 3 |
| `esquemaRegistroDePedido` | `registroDePedidoSchema` | const (zod) | `shared/src/privacidade/titular.ts` | 3 |
| `esquemaRespostaBuscaDeTitulares` | `buscaDeTitularesResponseSchema` | const (zod) | `shared/src/privacidade/titular.ts` | 3 |
| `esquemaRespostaPedidos` | `pedidosResponseSchema` | const (zod) | `shared/src/privacidade/titular.ts` | 3 |
| `esquemaRespostaPreviaDoTitular` | `previaDoTitularResponseSchema` | const (zod) | `shared/src/privacidade/titular.ts` | 3 |
| `esquemaTitularAchado` | `titularAchadoSchema` | const (zod) | `shared/src/privacidade/titular.ts` | 1 |
| `esquemaTitularDoPedido` | `titularDoPedidoSchema` | const (zod) | `shared/src/privacidade/titular.ts` | 1 |
| `PedidoCadastrarProfessor` | `CadastrarProfessorRequest` | type | `shared/src/professores/professores.ts` | 6 |
| `RespostaConviteDeProfessor` | `ConviteDeProfessorResponse` | type | `shared/src/professores/professores.ts` | 6 |
| `RespostaListaDeProfessores` | `ListaDeProfessoresResponse` | type | `shared/src/professores/professores.ts` | 3 |
| `esquemaPedidoCadastrarProfessor` | `cadastrarProfessorRequestSchema` | const (zod) | `shared/src/professores/professores.ts` | 3 |
| `esquemaPedidoSemCorpoDoConviteDeProfessor` | `conviteDeProfessorEmptyBodyRequestSchema` | const (zod) | `shared/src/professores/professores.ts` | 2 |
| `esquemaProfessorDaEscola` | `professorDaEscolaSchema` | const (zod) | `shared/src/professores/professores.ts` | 1 |
| `esquemaRespostaConviteDeProfessor` | `conviteDeProfessorResponseSchema` | const (zod) | `shared/src/professores/professores.ts` | 5 |
| `esquemaRespostaListaDeProfessores` | `listaDeProfessoresResponseSchema` | const (zod) | `shared/src/professores/professores.ts` | 5 |
| `PedidoGerarAcesso` | `GerarAcessoRequest` | type | `shared/src/sala/acesso.ts` | 4 |
| `RespostaAcessoDaTurma` | `AcessoDaTurmaResponse` | type | `shared/src/sala/acesso.ts` | 3 |
| `RespostaAcessoGerado` | `AcessoGeradoResponse` | type | `shared/src/sala/acesso.ts` | 9 |
| `esquemaPedidoGerarAcesso` | `gerarAcessoRequestSchema` | const (zod) | `shared/src/sala/acesso.ts` | 3 |
| `esquemaPedidoRevogarAcesso` | `revogarAcessoRequestSchema` | const (zod) | `shared/src/sala/acesso.ts` | 2 |
| `esquemaRespostaAcessoDaTurma` | `acessoDaTurmaResponseSchema` | const (zod) | `shared/src/sala/acesso.ts` | 4 |
| `esquemaRespostaAcessoGerado` | `acessoGeradoResponseSchema` | const (zod) | `shared/src/sala/acesso.ts` | 8 |
| `RespostaMinhaTurma` | `MinhaTurmaResponse` | type | `shared/src/sala/minha-turma.ts` | 4 |
| `esquemaRespostaMinhaTurma` | `minhaTurmaResponseSchema` | const (zod) | `shared/src/sala/minha-turma.ts` | 5 |
| `ConsultaPedidosDaTurma` | `PedidosDaTurmaQuery` | type | `shared/src/sala/pedidos.ts` | 3 |
| `PedidoDecidirReivindicacoes` | `DecidirReivindicacoesRequest` | type | `shared/src/sala/pedidos.ts` | 4 |
| `RespostaDecisao` | `DecisaoResponse` | type | `shared/src/sala/pedidos.ts` | 6 |
| `RespostaPedidosDaTurma` | `PedidosDaTurmaResponse` | type | `shared/src/sala/pedidos.ts` | 6 |
| `esquemaConsultaPedidosDaTurma` | `pedidosDaTurmaQuerySchema` | const (zod) | `shared/src/sala/pedidos.ts` | 2 |
| `esquemaPedidoDaTurma` | `pedidoDaTurmaSchema` | const (zod) | `shared/src/sala/pedidos.ts` | 1 |
| `esquemaPedidoDecidirReivindicacoes` | `decidirReivindicacoesRequestSchema` | const (zod) | `shared/src/sala/pedidos.ts` | 2 |
| `esquemaRespostaDecisao` | `decisaoResponseSchema` | const (zod) | `shared/src/sala/pedidos.ts` | 8 |
| `esquemaRespostaPedidosDaTurma` | `pedidosDaTurmaResponseSchema` | const (zod) | `shared/src/sala/pedidos.ts` | 5 |
| `PedidoAbrirSala` | `AbrirSalaRequest` | type | `shared/src/sala/salas.ts` | 4 |
| `PedidoReivindicarSala` | `ReivindicarSalaRequest` | type | `shared/src/sala/salas.ts` | 5 |
| `RespostaReivindicacao` | `ReivindicacaoResponse` | type | `shared/src/sala/salas.ts` | 4 |
| `RespostaSalaAberta` | `SalaAbertaResponse` | type | `shared/src/sala/salas.ts` | 6 |
| `esquemaPedidoAbrirSala` | `abrirSalaRequestSchema` | const (zod) | `shared/src/sala/salas.ts` | 3 |
| `esquemaPedidoReivindicarSala` | `reivindicarSalaRequestSchema` | const (zod) | `shared/src/sala/salas.ts` | 3 |
| `esquemaRespostaReivindicacao` | `reivindicacaoResponseSchema` | const (zod) | `shared/src/sala/salas.ts` | 5 |
| `esquemaRespostaSalaAberta` | `salaAbertaResponseSchema` | const (zod) | `shared/src/sala/salas.ts` | 9 |
| `RespostaAcessoDaEscola` | `AcessoDaEscolaResponse` | type | `shared/src/sessao/acesso-da-escola.ts` | 4 |
| `esquemaRespostaAcessoDaEscola` | `acessoDaEscolaResponseSchema` | const (zod) | `shared/src/sessao/acesso-da-escola.ts` | 3 |
| `PedidoAceitarConvite` | `AceitarConviteRequest` | type | `shared/src/sessao/convite.ts` | 4 |
| `PedidoConsultarConvite` | `ConsultarConviteRequest` | type | `shared/src/sessao/convite.ts` | 2 |
| `RespostaAceitarConvite` | `AceitarConviteResponse` | type | `shared/src/sessao/convite.ts` | 4 |
| `RespostaConsultarConvite` | `ConsultarConviteResponse` | type | `shared/src/sessao/convite.ts` | 4 |
| `esquemaPedidoAceitarConvite` | `aceitarConviteRequestSchema` | const (zod) | `shared/src/sessao/convite.ts` | 2 |
| `esquemaPedidoConsultarConvite` | `consultarConviteRequestSchema` | const (zod) | `shared/src/sessao/convite.ts` | 2 |
| `esquemaRespostaAceitarConvite` | `aceitarConviteResponseSchema` | const (zod) | `shared/src/sessao/convite.ts` | 3 |
| `esquemaRespostaConsultarConvite` | `consultarConviteResponseSchema` | const (zod) | `shared/src/sessao/convite.ts` | 3 |
| `PedidoEscolaSessao` | `EscolaSessaoRequest` | type | `shared/src/sessao/escola-sessao.ts` | 3 |
| `RespostaEscolaSessao` | `EscolaSessaoResponse` | type | `shared/src/sessao/escola-sessao.ts` | 3 |
| `esquemaPedidoEscolaSessao` | `escolaSessaoRequestSchema` | const (zod) | `shared/src/sessao/escola-sessao.ts` | 2 |
| `esquemaRespostaEscolaSessao` | `escolaSessaoResponseSchema` | const (zod) | `shared/src/sessao/escola-sessao.ts` | 2 |
| `RespostaEu` | `EuResponse` | type | `shared/src/sessao/eu.ts` | 5 |
| `RespostaIntroducao` | `IntroducaoResponse` | type | `shared/src/sessao/eu.ts` | 4 |
| `esquemaAcessoDaConta` | `acessoDaContaSchema` | const (zod) | `shared/src/sessao/eu.ts` | 2 |
| `esquemaRespostaEu` | `euResponseSchema` | const (zod) | `shared/src/sessao/eu.ts` | 3 |
| `esquemaRespostaIntroducao` | `introducaoResponseSchema` | const (zod) | `shared/src/sessao/eu.ts` | 3 |
| `PedidoLoginEmail` | `LoginEmailRequest` | type | `shared/src/sessao/login.ts` | 4 |
| `RespostaLogin` | `LoginResponse` | type | `shared/src/sessao/login.ts` | 8 |
| `esquemaPedidoLoginEmail` | `loginEmailRequestSchema` | const (zod) | `shared/src/sessao/login.ts` | 2 |
| `esquemaRespostaLogin` | `loginResponseSchema` | const (zod) | `shared/src/sessao/login.ts` | 9 |
| `PedidoLoginMatricula` | `LoginMatriculaRequest` | type | `shared/src/sessao/matricula.ts` | 4 |
| `esquemaPedidoLoginMatricula` | `loginMatriculaRequestSchema` | const (zod) | `shared/src/sessao/matricula.ts` | 2 |
| `PedidoAtivarMfa` | `AtivarMfaRequest` | type | `shared/src/sessao/mfa.ts` | 2 |
| `PedidoMfa` | `MfaRequest` | type | `shared/src/sessao/mfa.ts` | 5 |
| `PedidoRedefinirMfa` | `RedefinirMfaRequest` | type | `shared/src/sessao/mfa.ts` | 2 |
| `RespostaAtivarMfa` | `AtivarMfaResponse` | type | `shared/src/sessao/mfa.ts` | 4 |
| `RespostaConfigurarMfa` | `ConfigurarMfaResponse` | type | `shared/src/sessao/mfa.ts` | 5 |
| `esquemaPedidoAtivarMfa` | `ativarMfaRequestSchema` | const (zod) | `shared/src/sessao/mfa.ts` | 2 |
| `esquemaPedidoMfa` | `mfaRequestSchema` | const (zod) | `shared/src/sessao/mfa.ts` | 2 |
| `esquemaPedidoRedefinirMfa` | `redefinirMfaRequestSchema` | const (zod) | `shared/src/sessao/mfa.ts` | 2 |
| `esquemaRespostaAtivarMfa` | `ativarMfaResponseSchema` | const (zod) | `shared/src/sessao/mfa.ts` | 4 |
| `esquemaRespostaConfigurarMfa` | `configurarMfaResponseSchema` | const (zod) | `shared/src/sessao/mfa.ts` | 4 |
| `RespostaRenovacao` | `RenovacaoResponse` | type | `shared/src/sessao/renovacao.ts` | 4 |
| `esquemaRespostaRenovacao` | `renovacaoResponseSchema` | const (zod) | `shared/src/sessao/renovacao.ts` | 3 |
| `esquemaTokenDeLink` | `tokenDeLinkSchema` | const (zod) | `shared/src/sessao/token.ts` | 3 |
| `PedidoTrocaDeEscola` | `TrocaDeEscolaRequest` | type | `shared/src/sessao/troca-de-escola.ts` | 3 |
| `esquemaPedidoTrocaDeEscola` | `trocaDeEscolaRequestSchema` | const (zod) | `shared/src/sessao/troca-de-escola.ts` | 2 |
| `RespostaAvisos` | `AvisosResponse` | type | `shared/src/sistema/avisos.ts` | 2 |
| `esquemaAviso` | `avisoSchema` | const (zod) | `shared/src/sistema/avisos.ts` | 2 |
| `esquemaRespostaAvisos` | `avisosResponseSchema` | const (zod) | `shared/src/sistema/avisos.ts` | 6 |
| `EntradaDaExecucao` | `ExecucaoInput` | type | `shared/src/time/execucao.ts` | 5 |
| `RespostaExecucao` | `ExecucaoResponse` | type | `shared/src/time/execucao.ts` | 7 |
| `RespostaExecucaoAceita` | `ExecucaoAceitaResponse` | type | `shared/src/time/execucao.ts` | 20 |
| `esquemaEntradaDaExecucao` | `execucaoInputSchema` | const (zod) | `shared/src/time/execucao.ts` | 6 |
| `esquemaRespostaExecucao` | `execucaoResponseSchema` | const (zod) | `shared/src/time/execucao.ts` | 5 |
| `esquemaRespostaExecucaoAceita` | `execucaoAceitaResponseSchema` | const (zod) | `shared/src/time/execucao.ts` | 7 |
| `esquemaResultadoDaExecucao` | `resultadoDaExecucaoSchema` | const (zod) | `shared/src/time/execucao.ts` | 1 |
| `esquemaResultadoGravado` | `resultadoGravadoSchema` | const (zod) | `shared/src/time/execucao.ts` | 6 |
| `RespostaTime` | `TimeResponse` | type | `shared/src/time/time.ts` | 4 |
| `esquemaAgenteDoTime` | `agenteDoTimeSchema` | const (zod) | `shared/src/time/time.ts` | 1 |
| `esquemaChaveDeFuncao` | `chaveDeFuncaoSchema` | const (zod) | `shared/src/time/time.ts` | 4 |
| `esquemaFuncaoDoTime` | `funcaoDoTimeSchema` | const (zod) | `shared/src/time/time.ts` | 2 |
| `esquemaRespostaTime` | `timeResponseSchema` | const (zod) | `shared/src/time/time.ts` | 7 |
| `ConsultaSinais` | `SinaisQuery` | type | `shared/src/tutor/sinal.ts` | 3 |
| `RespostaSinais` | `SinaisResponse` | type | `shared/src/tutor/sinal.ts` | 4 |
| `esquemaConsultaSinais` | `sinaisQuerySchema` | const (zod) | `shared/src/tutor/sinal.ts` | 3 |
| `esquemaGrupoDeSinais` | `grupoDeSinaisSchema` | const (zod) | `shared/src/tutor/sinal.ts` | 2 |
| `esquemaRespostaSinais` | `sinaisResponseSchema` | const (zod) | `shared/src/tutor/sinal.ts` | 5 |
| `esquemaSinal` | `sinalSchema` | const (zod) | `shared/src/tutor/sinal.ts` | 2 |
| `ConsultaConversaDoTutor` | `ConversaDoTutorQuery` | type | `shared/src/tutor/tutor.ts` | 3 |
| `PedidoMensagemAoTutor` | `MensagemAoTutorRequest` | type | `shared/src/tutor/tutor.ts` | 5 |
| `RespostaConversaDoTutor` | `ConversaDoTutorResponse` | type | `shared/src/tutor/tutor.ts` | 7 |
| `RespostaMemoriaDoTutor` | `MemoriaDoTutorResponse` | type | `shared/src/tutor/tutor.ts` | 7 |
| `esquemaConsultaConversaDoTutor` | `conversaDoTutorQuerySchema` | const (zod) | `shared/src/tutor/tutor.ts` | 3 |
| `esquemaMensagemDoAlunoAoTutor` | `mensagemDoAlunoAoTutorSchema` | const (zod) | `shared/src/tutor/tutor.ts` | 1 |
| `esquemaMensagemDoTutor` | `mensagemDoTutorSchema` | const (zod) | `shared/src/tutor/tutor.ts` | 2 |
| `esquemaMensagemDoTutorAoAluno` | `mensagemDoTutorAoAlunoSchema` | const (zod) | `shared/src/tutor/tutor.ts` | 2 |
| `esquemaPedidoMensagemAoTutor` | `mensagemAoTutorRequestSchema` | const (zod) | `shared/src/tutor/tutor.ts` | 4 |
| `esquemaRespostaConversaDoTutor` | `conversaDoTutorResponseSchema` | const (zod) | `shared/src/tutor/tutor.ts` | 6 |
| `esquemaRespostaMemoriaDoTutor` | `memoriaDoTutorResponseSchema` | const (zod) | `shared/src/tutor/tutor.ts` | 5 |
| `esquemaSinalNaMemoria` | `sinalNaMemoriaSchema` | const (zod) | `shared/src/tutor/tutor.ts` | 1 |
| `esquemaTrabalhoNaMemoria` | `trabalhoNaMemoriaSchema` | const (zod) | `shared/src/tutor/tutor.ts` | 1 |
| `ConsultaUsoDoTutor` | `UsoDoTutorQuery` | type | `shared/src/tutor/uso.ts` | 3 |
| `RespostaUsoDoTutor` | `UsoDoTutorResponse` | type | `shared/src/tutor/uso.ts` | 4 |
| `esquemaConsultaUsoDoTutor` | `usoDoTutorQuerySchema` | const (zod) | `shared/src/tutor/uso.ts` | 3 |
| `esquemaReferenciaDaUltimaTroca` | `referenciaDaUltimaTrocaSchema` | const (zod) | `shared/src/tutor/uso.ts` | 1 |
| `esquemaRespostaUsoDoTutor` | `usoDoTutorResponseSchema` | const (zod) | `shared/src/tutor/uso.ts` | 5 |
| `esquemaUsoDoAluno` | `usoDoAlunoSchema` | const (zod) | `shared/src/tutor/uso.ts` | 2 |

## 16. Pastas

Pastas técnicas ganham nome em inglês; pastas que são conceito de domínio ficam (`auditoria`, `ciclo-de-vida`, `convite`, `permissao`, `retencao`, `titular`, e em `shared` `estrutura`, `sala`, `sessao`, `operacao`, `privacidade`, `governanca`, `assistente`, `atividade`, `material`, `professores`, `tutor`, `time`). Já em inglês e ficam: `db`, `log`, `redis`, `config`, `ia/prompts`, `ia/__fixtures__`. `identidade` é dúvida (domínio ou `auth`).

| Atual | Proposto | Tipo | Onde | Observação / Usos |
|---|---|---|---|---|
| `erro/` | `error/` | pasta | `packages/nucleo/src` | 6 arquivos na pasta; 22 arquivos a importam pelo caminho (a maioria dos consumidores entra pelo `index.ts` do pacote) |
| `entrada/` | `pipes/` | pasta | `packages/nucleo/src` | 4 arquivos na pasta; 3 arquivos a importam pelo caminho (a maioria dos consumidores entra pelo `index.ts` do pacote) |
| `fila/` | `queue/` | pasta | `packages/nucleo/src` | 14 arquivos na pasta; 9 arquivos a importam pelo caminho (a maioria dos consumidores entra pelo `index.ts` do pacote) |
| `limite/` | `rate-limit/` | pasta | `packages/nucleo/src` | 10 arquivos na pasta; 7 arquivos a importam pelo caminho (a maioria dos consumidores entra pelo `index.ts` do pacote) |
| `contexto/` | `context/` | pasta | `packages/nucleo/src` | 4 arquivos na pasta; 45 arquivos a importam pelo caminho (a maioria dos consumidores entra pelo `index.ts` do pacote) |
| `telemetria/` | `telemetry/` | pasta | `packages/nucleo/src` | 4 arquivos na pasta; 8 arquivos a importam pelo caminho (a maioria dos consumidores entra pelo `index.ts` do pacote) |
| `instancia/` | `runtime/` | pasta | `packages/nucleo/src` | 3 arquivos na pasta; 3 arquivos a importam pelo caminho (a maioria dos consumidores entra pelo `index.ts` do pacote) |
| `uso/` | `usage/` | pasta | `packages/nucleo/src` | 5 arquivos na pasta; 4 arquivos a importam pelo caminho (a maioria dos consumidores entra pelo `index.ts` do pacote) |
| `rotina/` | `cron/` | pasta | `packages/nucleo/src` | 1 arquivos na pasta; 2 arquivos a importam pelo caminho (a maioria dos consumidores entra pelo `index.ts` do pacote) |
| `configuracao/` | `settings/` | pasta | `packages/nucleo/src` | 3 arquivos na pasta; 4 arquivos a importam pelo caminho (a maioria dos consumidores entra pelo `index.ts` do pacote) |
| `ia/tarefas/` | `ia/tasks/` | pasta | `packages/nucleo/src` | 12 arquivos na pasta; 6 arquivos a importam pelo caminho (a maioria dos consumidores entra pelo `index.ts` do pacote) |
| `erros/` | `errors/` | pasta | `packages/shared/src` | 5 arquivos na pasta; 38 arquivos a importam pelo caminho (a maioria dos consumidores entra pelo `index.ts` do pacote) |
| `sistema/` | `system/` | pasta | `packages/shared/src` | 11 arquivos na pasta; 5 arquivos a importam pelo caminho (a maioria dos consumidores entra pelo `index.ts` do pacote) |

## 17. Arquivos

Regra: o arquivo acompanha o nome da peça que exporta (e o `.test.ts` acompanha o arquivo). O caminho já inclui a pasta nova da seção anterior. Testes sem peça única (`entrada.test.ts`, `nome-da-fila.test.ts`) acompanham a pasta. Arquivos de peça de domínio (`avaliar-sessao.ts`, `janela-letiva.ts`, `estado-da-coordenacao.ts`, `db/schema/*.ts`) ficam.

| Atual (packages/) | Proposto (packages/, já na pasta nova) | Tipo | Usos (importam pelo caminho) |
|---|---|---|---|
| `nucleo/src/erro/erro-de-dominio.ts` | `nucleo/src/error/domain.exception.ts` | arquivo | 22 |
| `nucleo/src/erro/erro-de-dominio.test.ts` | `nucleo/src/error/domain.exception.test.ts` | arquivo (teste) | 0 |
| `nucleo/src/erro/filtro-global.ts` | `nucleo/src/error/all-exceptions.filter.ts` | arquivo | 1 |
| `nucleo/src/erro/mapear-erro-postgres.ts` | `nucleo/src/error/map-postgres-error.ts` | arquivo | 3 |
| `nucleo/src/erro/mapear-erro-postgres.test.ts` | `nucleo/src/error/map-postgres-error.test.ts` | arquivo (teste) | 0 |
| `nucleo/src/erro/resumir-erro.ts` | `nucleo/src/error/summarize-error.ts` | arquivo | 9 |
| `nucleo/src/fila/despacho.repository.ts` | `nucleo/src/queue/dispatch.repository.ts` | arquivo | 2 |
| `nucleo/src/fila/efeito-sintetico.repository.ts` | `nucleo/src/queue/synthetic-effect.repository.ts` | arquivo | 1 |
| `nucleo/src/fila/enfileirador.ts` | `nucleo/src/queue/job-outbox.ts` | arquivo | 2 |
| `nucleo/src/fila/filas.ts` | `nucleo/src/queue/queues.ts` | arquivo | 5 |
| `nucleo/src/fila/job-registro.repository.ts` | `nucleo/src/queue/job-outbox.repository.ts` | arquivo | 7 |
| `nucleo/src/fila/ouvinte-de-jobs.ts` | `nucleo/src/queue/job-notification-listener.ts` | arquivo | 1 |
| `nucleo/src/fila/pedido-de-job-recusado.ts` | `nucleo/src/queue/job-request-rejected.error.ts` | arquivo | 2 |
| `nucleo/src/fila/publicacao.ts` | `nucleo/src/queue/publishing.ts` | arquivo | 2 |
| `nucleo/src/fila/publicacao.test.ts` | `nucleo/src/queue/publishing.test.ts` | arquivo (teste) | 0 |
| `nucleo/src/fila/vagas-por-escola.ts` | `nucleo/src/queue/escola-concurrency-limiter.ts` | arquivo | 1 |
| `nucleo/src/fila/vaga.lua` | `nucleo/src/queue/concurrency-slot.lua` | arquivo | 0 |
| `nucleo/src/fila/nome-da-fila.test.ts` | `nucleo/src/queue/queue-name.test.ts` | arquivo | 0 |
| `nucleo/src/ia/adaptador.ts` | `nucleo/src/ia/model-adapter.ts` | arquivo | 11 |
| `nucleo/src/ia/adaptador-falso.ts` | `nucleo/src/ia/fake-adapter.ts` | arquivo | 8 |
| `nucleo/src/ia/adaptador-openai-compat.ts` | `nucleo/src/ia/openai-compat-adapter.ts` | arquivo | 6 |
| `nucleo/src/ia/adaptador-openai-compat.test.ts` | `nucleo/src/ia/openai-compat-adapter.test.ts` | arquivo (teste) | 0 |
| `nucleo/src/ia/adaptador-resiliente.ts` | `nucleo/src/ia/resilient-adapter.ts` | arquivo | 3 |
| `nucleo/src/ia/adaptador-resiliente.test.ts` | `nucleo/src/ia/resilient-adapter.test.ts` | arquivo (teste) | 0 |
| `nucleo/src/ia/porta.ts` | `nucleo/src/ia/port.ts` | arquivo | 13 |
| `nucleo/src/ia/provedor.ts` | `nucleo/src/ia/llm-gateway.ts` | arquivo | 18 |
| `nucleo/src/ia/provedor.test.ts` | `nucleo/src/ia/llm-gateway.test.ts` | arquivo (teste) | 0 |
| `nucleo/src/ia/erros.ts` | `nucleo/src/ia/errors.ts` | arquivo | 15 |
| `nucleo/src/ia/tarefa.ts` | `nucleo/src/ia/task.ts` | arquivo | 44 |
| `nucleo/src/ia/texto.ts` | `nucleo/src/ia/text.ts` | arquivo | 59 |
| `nucleo/src/ia/limpar-saida.ts` | `nucleo/src/ia/clean-output.ts` | arquivo | 3 |
| `nucleo/src/ia/limpar-saida.test.ts` | `nucleo/src/ia/clean-output.test.ts` | arquivo (teste) | 0 |
| `nucleo/src/ia/ouro.test.ts` | `nucleo/src/ia/golden.test.ts` | arquivo | 5 |
| `nucleo/src/ia/selo-do-ouro.test.ts` | `nucleo/src/ia/golden-seal.test.ts` | arquivo | 0 |
| `nucleo/src/ia/__fixtures__/adaptador-roteirizado.ts` | `nucleo/src/ia/__fixtures__/scripted-adapter.ts` | arquivo | 5 |
| `nucleo/src/ia/__fixtures__/amostras-do-assistente.ts` | `nucleo/src/ia/__fixtures__/assistente-samples.ts` | arquivo | 1 |
| `nucleo/src/ia/__fixtures__/amostras-do-assistente-revisao.ts` | `nucleo/src/ia/__fixtures__/assistente-review-samples.ts` | arquivo | 1 |
| `nucleo/src/ia/__fixtures__/amostras-do-tutor.ts` | `nucleo/src/ia/__fixtures__/tutor-samples.ts` | arquivo | 1 |
| `nucleo/src/ia/__fixtures__/contexto-da-escola.ts` | `nucleo/src/ia/__fixtures__/escola-context.ts` | arquivo | 6 |
| `nucleo/src/ia/__fixtures__/entradas.ts` | `nucleo/src/ia/__fixtures__/inputs.ts` | arquivo | 9 |
| `nucleo/src/ia/__fixtures__/ouro.ts` | `nucleo/src/ia/__fixtures__/golden.ts` | arquivo | 5 |
| `nucleo/src/ia/__fixtures__/servidor-llama-falso.ts` | `nucleo/src/ia/__fixtures__/fake-llama-server.ts` | arquivo | 2 |
| `nucleo/src/contexto/contexto.ts` | `nucleo/src/context/context.ts` | arquivo | 48 |
| `nucleo/src/contexto/contexto.test.ts` | `nucleo/src/context/context.test.ts` | arquivo (teste) | 0 |
| `nucleo/src/contexto/escola-do-contexto.ts` | `nucleo/src/context/context-escola.ts` | arquivo | 20 |
| `nucleo/src/limite/chaves.ts` | `nucleo/src/rate-limit/keys.ts` | arquivo | 5 |
| `nucleo/src/limite/chaves.test.ts` | `nucleo/src/rate-limit/keys.test.ts` | arquivo (teste) | 0 |
| `nucleo/src/limite/guarda-limite.ts` | `nucleo/src/rate-limit/rate-limit.guard.ts` | arquivo | 2 |
| `nucleo/src/limite/limitador.ts` | `nucleo/src/rate-limit/rate-limiter.ts` | arquivo | 2 |
| `nucleo/src/limite/limite-da-busca-de-titulares.decorator.ts` | `nucleo/src/rate-limit/titular-search-rate-limit.decorator.ts` | arquivo | 2 |
| `nucleo/src/limite/proporcao-em-janela.ts` | `nucleo/src/rate-limit/sliding-window-ratio.ts` | arquivo | 3 |
| `nucleo/src/limite/proporcao-em-janela.test.ts` | `nucleo/src/rate-limit/sliding-window-ratio.test.ts` | arquivo (teste) | 0 |
| `nucleo/src/limite/proxies-confiaveis.ts` | `nucleo/src/rate-limit/trusted-proxies.ts` | arquivo | 3 |
| `nucleo/src/limite/proxies-confiaveis.test.ts` | `nucleo/src/rate-limit/trusted-proxies.test.ts` | arquivo (teste) | 0 |
| `nucleo/src/limite/rota-anonima.decorator.ts` | `nucleo/src/rate-limit/route-markers.decorator.ts` | arquivo | 6 |
| `nucleo/src/identidade/emissor-de-token.ts` | `nucleo/src/identidade/token-issuer.ts` | arquivo | 3 |
| `nucleo/src/identidade/emissor-de-token.test.ts` | `nucleo/src/identidade/token-issuer.test.ts` | arquivo (teste) | 0 |
| `nucleo/src/identidade/guarda-autenticacao.ts` | `nucleo/src/identidade/auth.guard.ts` | arquivo | 2 |
| `nucleo/src/identidade/guarda-sessao.ts` | `nucleo/src/identidade/sessao.guard.ts` | arquivo | 2 |
| `nucleo/src/identidade/guarda-sessao.test.ts` | `nucleo/src/identidade/sessao.guard.test.ts` | arquivo (teste) | 0 |
| `nucleo/src/identidade/marcadores-de-operacao.ts` | `nucleo/src/identidade/operacao-markers.ts` | arquivo | 6 |
| `nucleo/src/identidade/rota-sem-sessao.ts` | `nucleo/src/identidade/route-without-sessao.ts` | arquivo | 6 |
| `nucleo/src/identidade/rota-sem-sessao.test.ts` | `nucleo/src/identidade/route-without-sessao.test.ts` | arquivo (teste) | 0 |
| `nucleo/src/identidade/token-da-requisicao.ts` | `nucleo/src/identidade/request-token.ts` | arquivo | 4 |
| `nucleo/src/identidade/verificar-token.ts` | `nucleo/src/identidade/verify-token.ts` | arquivo | 16 |
| `nucleo/src/identidade/verificar-token.test.ts` | `nucleo/src/identidade/verify-token.test.ts` | arquivo (teste) | 0 |
| `nucleo/src/permissao/conferencia-das-permissoes.ts` | `nucleo/src/permissao/permissao-boot-check.ts` | arquivo | 3 |
| `nucleo/src/permissao/guarda-permissao.ts` | `nucleo/src/permissao/permissao.guard.ts` | arquivo | 2 |
| `nucleo/src/permissao/permite.decorator.ts` | `nucleo/src/permissao/require-permissao.decorator.ts` | arquivo | 4 |
| `nucleo/src/instancia/batimento.ts` | `nucleo/src/runtime/heartbeat.ts` | arquivo | 3 |
| `nucleo/src/instancia/drenagem.ts` | `nucleo/src/runtime/graceful-shutdown.ts` | arquivo | 3 |
| `nucleo/src/instancia/drenagem.test.ts` | `nucleo/src/runtime/graceful-shutdown.test.ts` | arquivo (teste) | 0 |
| `nucleo/src/uso/contador-uso.ts` | `nucleo/src/usage/usage-meter.ts` | arquivo | 3 |
| `nucleo/src/uso/dia-de-uso.ts` | `nucleo/src/usage/usage-day.ts` | arquivo | 6 |
| `nucleo/src/uso/dia-de-uso.test.ts` | `nucleo/src/usage/usage-day.test.ts` | arquivo (teste) | 0 |
| `nucleo/src/uso/interceptor-de-uso.ts` | `nucleo/src/usage/usage.interceptor.ts` | arquivo | 1 |
| `nucleo/src/uso/uso.repository.ts` | `nucleo/src/usage/usage.repository.ts` | arquivo | 2 |
| `nucleo/src/log/aviso-espacado.ts` | `nucleo/src/log/throttled-warn.ts` | arquivo | 3 |
| `nucleo/src/log/logger-do-nest.ts` | `nucleo/src/log/nest-logger.ts` | arquivo | 4 |
| `nucleo/src/redis/clientes.ts` | `nucleo/src/redis/clients.ts` | arquivo | 2 |
| `nucleo/src/redis/clientes.test.ts` | `nucleo/src/redis/clients.test.ts` | arquivo (teste) | 0 |
| `nucleo/src/telemetria/iniciar.ts` | `nucleo/src/telemetry/start.ts` | arquivo | 5 |
| `nucleo/src/telemetria/metricas.ts` | `nucleo/src/telemetry/metrics.ts` | arquivo | 84 |
| `nucleo/src/telemetria/metricas.test.ts` | `nucleo/src/telemetry/metrics.test.ts` | arquivo (teste) | 0 |
| `nucleo/src/telemetria/temporalidade.ts` | `nucleo/src/telemetry/temporality.ts` | arquivo | 3 |
| `nucleo/src/titular/armazem-de-arquivos.ts` | `nucleo/src/titular/file-storage.ts` | arquivo | 3 |
| `nucleo/src/titular/armazem-s3.ts` | `nucleo/src/titular/s3-file-storage.ts` | arquivo | 5 |
| `nucleo/src/titular/armazem-s3.int.test.ts` | `nucleo/src/titular/s3-file-storage.int.test.ts` | arquivo (teste) | 0 |
| `nucleo/src/titular/armazem-s3.test.ts` | `nucleo/src/titular/s3-file-storage.test.ts` | arquivo (teste) | 0 |
| `nucleo/src/entrada/entrada.test.ts` | `nucleo/src/pipes/pipes.test.ts` | arquivo | 20 |
| `nucleo/src/db/banco.ts` | `nucleo/src/db/database.ts` | arquivo | 40 |
| `nucleo/src/db/migrar.ts` | `nucleo/src/db/migrate.ts` | arquivo | 8 |
| `nucleo/src/db/migrar.int.test.ts` | `nucleo/src/db/migrate.int.test.ts` | arquivo (teste) | 0 |
| `nucleo/src/db/sem-escopo.decorator.ts` | `nucleo/src/db/unscoped.decorator.ts` | arquivo | 12 |
| `nucleo/src/db/sem-escopo.decorator.test.ts` | `nucleo/src/db/unscoped.decorator.test.ts` | arquivo (teste) | 0 |
| `nucleo/src/db/schema/mvp/tabelas.ts` | `nucleo/src/db/schema/mvp/tables.ts` | arquivo | 31 |
| `nucleo/src/config/config-ia.ts` | `nucleo/src/config/llm-config.ts` | arquivo | 7 |
| `nucleo/src/config/config-ia.test.ts` | `nucleo/src/config/llm-config.test.ts` | arquivo (teste) | 0 |
| `nucleo/src/config/validar-config.ts` | `nucleo/src/config/validate-config.ts` | arquivo | 20 |
| `nucleo/src/config/validar-config.test.ts` | `nucleo/src/config/validate-config.test.ts` | arquivo (teste) | 0 |
| `nucleo/src/auditoria/insercao-de-auditoria.repository.ts` | `nucleo/src/auditoria/auditoria-insert.repository.ts` | arquivo | 4 |
| `nucleo/src/auditoria/registro-de-auditoria.ts` | `nucleo/src/auditoria/auditoria-recorder.ts` | arquivo | 7 |
| `nucleo/src/auditoria/registro-de-auditoria.test.ts` | `nucleo/src/auditoria/auditoria-recorder.test.ts` | arquivo (teste) | 0 |
| `nucleo/src/auditoria/auditoria-recusada.ts` | `nucleo/src/auditoria/auditoria-rejected.error.ts` | arquivo | 6 |
| `nucleo/src/relogio.ts` | `nucleo/src/clock.ts` | arquivo | 8 |
| `nucleo/src/rotina/escolas-da-rotina.repository.ts` | `nucleo/src/cron/cron-escolas.repository.ts` | arquivo | 2 |
| `nucleo/src/configuracao/configuracao-operacional.ts` | `nucleo/src/settings/operational-settings.ts` | arquivo | 4 |
| `nucleo/src/configuracao/configuracao-operacional.test.ts` | `nucleo/src/settings/operational-settings.test.ts` | arquivo (teste) | 0 |
| `nucleo/src/configuracao/configuracao-operacional.repository.ts` | `nucleo/src/settings/operational-settings.repository.ts` | arquivo | 4 |
| `shared/src/erros/codigo-de-erro.ts` | `shared/src/errors/error-code.ts` | arquivo | 7 |
| `shared/src/erros/erro-de-invariante.ts` | `shared/src/errors/invariant.exception.ts` | arquivo | 2 |
| `shared/src/erros/erro-de-invariante.test.ts` | `shared/src/errors/invariant.exception.test.ts` | arquivo (teste) | 0 |
| `shared/src/erros/mensagens.ts` | `shared/src/errors/messages.ts` | arquivo | 54 |
| `shared/src/erros/mensagens.test.ts` | `shared/src/errors/messages.test.ts` | arquivo (teste) | 0 |
| `shared/src/sistema/contexto.ts` | `shared/src/system/context.ts` | arquivo | 48 |
| `shared/src/sistema/definicoes-de-job.ts` | `shared/src/system/job-definitions.ts` | arquivo | 2 |
| `shared/src/sistema/definicoes-de-job.test.ts` | `shared/src/system/job-definitions.test.ts` | arquivo (teste) | 0 |
| `shared/src/sistema/estado.ts` | `shared/src/system/status.ts` | arquivo | 98 |
| `shared/src/sistema/jobs-sinteticos.ts` | `shared/src/system/synthetic-jobs.ts` | arquivo | 10 |
| `shared/src/sistema/jobs-sinteticos.test.ts` | `shared/src/system/synthetic-jobs.test.ts` | arquivo (teste) | 0 |
| `shared/src/sistema/prontidao.ts` | `shared/src/system/readiness.ts` | arquivo | 7 |
| `shared/src/sistema/saude.ts` | `shared/src/system/health.ts` | arquivo | 8 |
| `shared/src/estrutura/paginacao.ts` | `shared/src/estrutura/pagination.ts` | arquivo | 33 |
| `shared/src/time/chave-envio.ts` | `shared/src/time/idempotency-key.ts` | arquivo | 6 |

### Arquivos que mudam só por acompanhar a pasta ou o teste

Os arquivos abaixo não têm nome técnico próprio, mas mudam de caminho com a pasta da seção 16: `fila/janela-letiva.ts` (+ `.test.ts`) e `fila/publicacao.test.ts` e `fila/prazo-declarado...`; `limite/*.test.ts` (`chaves`, `proporcao-em-janela`, `proxies-confiaveis`); `contexto/ano-em-curso.ts`; `ia/tarefas/*` (os arquivos são nomes de tarefa de domínio: `adaptar-atividade.ts`, `gerar-atividade-objetiva.ts`, `gerar-plano-de-aula.ts`, `propor-ferramenta.ts`, `relatorio-da-correcao.ts`, `resumo-do-analista.ts`, `turno-do-tutor.ts`, mais `index.ts` e os testes `conteudo`, `numeros`, `tarefas`, `turno-do-tutor`); `uso/dia-de-uso.test.ts`; `instancia/drenagem.test.ts`; `configuracao/configuracao-operacional.test.ts`; `erro/erro-de-dominio.test.ts`. Mais um teste com nome técnico fora do padrão `<arquivo>.test.ts`: `db/schema/mvp/tabelas-do-mvp.int.test.ts` → `db/schema/mvp/mvp-tables.int.test.ts` (citado como "Checagem" nas regras 20 e 70 e em `eslint-suppressions.json`).

## Dúvidas

Fechadas em `inventario.md` §2. Onde a decisão de lá difere do que estava proposto, a tabela acima já traz o nome decidido.

## Não muda, mas parece

A peça ou o arquivo muda; a string gravada ou lida por fora (Redis, Postgres, HTTP, Prometheus, env, log, compose) fica.

| Peça que muda | O que fica | Onde é gravado ou lido |
|---|---|---|
| `Enfileirador` / `JobRegistroRepository` → `JobOutbox...` | Tabela `job_registro` e suas colunas; canal `pg_notify` `job` (`CANAL_NOTIFICACAO_JOB`); `jobId` do BullMQ = `job_registro.id` | Postgres; `LISTEN job`; Redis (BullMQ) |
| `Fila` → `QueueName`, `FILAS` → `QUEUE_NAMES`, `nomeDaFilaBullMQ` | Os valores `'interativa'`, `'normal'`, `'lote'` e o nome real da fila no Redis (o da fila do worker; `api-<fila>` para executor `api`) | Redis (filas BullMQ), `job_registro.fila`, `infra/` (alertas, painel) |
| `VagasPorEscola` → `EscolaConcurrencyLimiter`, `vaga.lua` → `concurrency-slot.lua` | Chave ZSET `vaga:{fila}:{escola}` e o conteúdo do script | Redis de fila |
| `LimitadorDeRequisicoes` → `RateLimiter`, `PREFIXO_LIMITE_*` | Prefixos `rl:u:`, `rl:e:`, `rl:ip:`, `rl:ip-login`, `rl:busca-titular` e cabeçalho `Retry-After` | Redis de cache; testes de carga |
| `METADADO_<X>` → `<X>_KEY` | Os textos `'educa:rota-anonima'`, `'educa:sem-limite'`, `'educa:permite'`... (internos; podem acompanhar, sem efeito externo) | Metadados do Nest (`SetMetadata`) |
| `CodigoDeErro` → `ErrorCode`, `ErroDeDominio` → `DomainException`, `RespostaDeErro` → `ErrorResponse` | Todos os códigos (`NAO_ENCONTRADO`, `LIMITE_EXCEDIDO`, `INDISPONIVEL_TENTE_DE_NOVO`...) e os campos do corpo de erro | Resposta HTTP, `execucao_agente.erro`, `job_registro.codigo_falha`, web |
| `ErroDeIa` → `LLMError`, `CodigoDeErroDeIa` | `IA_INDISPONIVEL`, `IA_TEMPO_ESGOTADO`, `IA_SAIDA_INVALIDA`, `FUNCAO_SUSPENSA`, `IA_ORCAMENTO_ESGOTADO`... | `consumo_ia`, `execucao_agente`, resposta da API |
| `AdaptadorFalso`/`AdaptadorOpenAICompat` → `*Adapter`, `AdaptadorDeIa` | Variável `IA_ADAPTADOR` e seus valores `falso` e `openai_compat`; o campo `origem` (`falso`, `openai_compat`, `regra_fixa`) e o check de `consumo_ia`; as `LLM_*` | Env, `.env.example`, `infra/`, Postgres (`consumo_ia.origem`) |
| `Batimento` → `Heartbeat` | Caminho do arquivo de batimento e o comando de healthcheck (`COMANDO_HEALTHCHECK_BATIMENTO`) | `infra/compose.yml` (menciona `nucleo/src/instancia`) |
| `Drenagem` → `GracefulShutdown`, `RespostaProntidao` | Rotas `GET /prontidao` e `GET /saude` e o corpo `{ pronta }` / `{ ok }` | Borda (Caddy), compose, sondas |
| `METRICAS` → `METRICS`, `middlewareDeMetricasHttp`, `observar*` | Nomes das métricas Prometheus, rótulos (`ROTULO_ESCOLA`) e as rotas normalizadas | `infra/` (alertas, painel), `infra/test/metricas.int.test.ts` |
| `criarLogger`, `LoggerDoNest` → `NestLogger`, `avisoEspacado` | Nomes de evento de log (`correcao.concluida`...), `CAMINHOS_REDACT` | Saída do pino, guardas de log (`tools/guardas/regras-log.mjs`) |
| `ContadorDeUso` → `UsageMeter`, `UsoRepository` | Tabela `uso_infra_diario` e as chaves de contador no Redis de fila | Postgres, Redis |
| `ArmazemS3` → `S3FileStorage`, `chaveDoObjeto` → `objectKey` | Formato da chave do objeto no bucket e as variáveis `S3_*` | Bucket, env |
| `SemEscopo` → `Unscoped` | Os textos das regras 10.9 e dos guardiões, e a justificativa gravada ao lado do decorator | `.claude/rules`, `tools/guardas` |
| `RespostaEstado`, `RespostaAvisos`, `RespostaContexto`, `RespostaSaude` → `*Response` | Rotas `/v1/sistema/estado`, `/v1/sistema/avisos`, `/v1/sistema/contexto`; namespace socket.io `/sistema`; campos `versao`, `ambiente`, `componentes`, `situacao`, `itens` | API, web, realtime |
| `ConsultaPaginada` → `PaginationQuery`, `esquemaDePagina` → `pageSchema` | Parâmetros `?pagina=` e `?limite=` e os campos `itens`, `proxima` | Todas as listagens (API, web) |
| `esquemaChaveEnvio` → `idempotencyKeySchema` | Campo JSON `chaveEnvio` e coluna `execucao_agente.chave_envio` | API, web, Postgres |
| `DEFINICOES_DE_JOB` → `JOB_DEFINITIONS`, `ESTADOS_DE_JOB` → `JOB_STATES`, `CodigoDeFalhaDeJob` | Os tipos de job (`TIPO_*`, ex. `sistema.*`), os estados (`aguardando`, `reservado`, `publicado`, `ativo`, `concluido`, `falhou`) e os códigos de falha | `job_registro` (tipo, estado, codigo_falha), BullMQ |
| `tabelasDoMvp` → `mvpTables`, consts Drizzle (`jobRegistro`, `usoInfraDiario`, `threadAgente`...) | Todas as tabelas e colunas; `drizzle.config.ts` e a pasta `drizzle/` (migrations) | Postgres |
| `@educa/nucleo` → `@educa/core` | Nada de runtime; mudam o `name` do `package.json`, os imports de todos os apps, o `tsconfig`/workspace e o `Dockerfile` | monorepo inteiro |

## Referências por caminho ou por nome fora do pacote (o rename quebra se não forem juntas)

Verificado por grep, só leitura. São lugares que escrevem o caminho ou o nome da peça como texto, e não importam o símbolo; o compilador não os acusa.

- `eslint-suppressions.json`: 17 caminhos de `packages/nucleo/src/...` (`auditoria/acoes.ts`, `auditoria/registro-de-auditoria.ts`, `config/config-ia.ts`, `configuracao/configuracao-operacional.ts`, `erro/filtro-global.ts`, `fila/job-registro.repository.ts`, `ia/adaptador-openai-compat.ts`, `ia/provedor.ts`, `ia/tarefas/*.ts`, `identidade/guarda-sessao.ts`, `limite/guarda-limite.ts`, `log/logger.ts`...). Renomear o arquivo sem atualizar a chave reativa as supressões.
- `tools/guardas/`: `regras-erro.mjs` (`ErroDeDominio`, `ErroDeInvariante`), `index.mjs` (`ErroDeInvariante`, `LoggerDoNest`), `regras-log.mjs` (`resumirErro`), `regras-ia.mjs` (`LLMProvider`, caminho `nucleo/src/ia/adaptador`), `regras-tenant.mjs` (`Banco`), `escopo-dos-repositories.ts` (`SemEscopo`, `exigirEscolaDoContexto`, `contextoAtual`, `Banco`, `TransacaoBanco`, `TokenVerificado`, `ExecutorDeAuditoria`, `AuditoriaRecusada`, `inserirAuditoria`, `escopoDoJobNoContexto`, `identidadeDaRequisicao`), `camadas.cjs` (`SemEscopo`, `ciclo-de-vida`, `conta-global`), `tabelas-do-nucleo.mjs`, e os testes `guardas.test.ts`, `repositories-com-escopo.test.ts` e os `__fixtures__` que repetem os nomes.
- `tools/processo/`: `guardioes-por-caminho.ts` e `portao.ts` (`SemEscopo`), `mutacoes.ts` (`LinhaNova`), `separar-achados.ts` (`migrar`), `harness/caminhos.test.ts`, `revisoes.test.ts`.
- `tools/testes/integracao.setup.ts` (`criarLogger`, `migrar`) e `tools/testes/metricas.ts` (`METRICAS`, `temporalidadeDasMetricas`); `tools/ia/medir-risco-a-vida.ts` (`AdaptadorRoteirizado`, `ConsumoEmMemoria`, `OrcamentoEmMemoria`, `ProvedorDeIa`, `SuspensoesEmMemoria`, `criarProvedorDeIa`, `executarNoContexto`, `lerConfiguracaoDeIa`); `tools/demonstracao/ia-com-o-material.test.ts` (5 caminhos).
- `knip.json` (`migrar`), `eslint.config.mjs` (`ipDaRequisicao`, `ZodValidationPipe`).
- `apps/api/test/arquitetura.test.ts` (15 caminhos de `nucleo/src/...`: `identidade`, `retencao`, `titular`, `rotina`, `permissao`, `limite`), `infra/compose.yml` (`nucleo/src/instancia`), `infra/test/{metricas.int,painel,alertas}.test.ts` (`nucleo/src/telemetria`), `apps/web/src/api/sessao.ts` (comentário com `nucleo/src/limite`), `apps/api/src/material/busca-de-trechos.ts`.
- `packages/nucleo/package.json`: `exports` (`./armazem-s3`) e o script `build` (`cp src/fila/vaga.lua`); `packages/nucleo/src/fila/vagas-por-escola.ts` lê `vaga.lua` do disco; `packages/nucleo/drizzle.config.ts` aponta `src/db/schema/*.ts` (fica, a pasta não muda).
- Documentos que citam os nomes e o caminho: `CLAUDE.md` (regras 10, 20, 70), `.claude/rules/*.md` (`@SemEscopo`, `@Permite`, `@RotaAnonima`, `ErroDeDominio`, caminhos `apps/api/test/...`), `docs/guia-do-desenvolvedor.md` §3 a §9, `packages/nucleo/src/ia/README.md` (cita `ErroDeIa`, `LLMProvider`, `SuspensaoDeFuncao`, `OrcamentoDeIa`, `RegistroDeConsumo`, `ExecutorDeAgente`, `AgendadorDeExecucoes`, `ConferenciaDeFuncao`, `LLM_PROVIDER`, `EXECUTOR_DE_AGENTE`, `SUSPENSAO_DE_FUNCAO`, `ORCAMENTO_DE_IA`).

## Citadas no guia §9 mas fora deste escopo (estão em `apps/`)

Para quem levanta `apps/`: `Reconciliacao` (despachante → outbox sweeper), `ExecutorDeJobs` e `Processador` (job handlers), `ContadorEmJanela`, `ContadorDeTentativas`, `SemaforoDeHash` (bulkhead), `AgendadorDeExecucoes`, `ConferenciaDeFuncao`, `BancadaDeSessoes` (100 arquivos), `GuardaDeOperador`, os decorators `@RotaDeOperacao` e `@EntradaDeOperacao` (`apps/api/src/operacao/marcadores.ts`), `apps/despachante` (nome do app = outbox relay). Os tokens de injeção `LLM_PROVIDER`, `EXECUTOR_DE_AGENTE`, `SUSPENSAO_DE_FUNCAO`, `ORCAMENTO_DE_IA` já estão em inglês.

## Já com nome de mercado (ficam)

`LLMProvider`, `IdPipe`, `ZodValidationPipe`, `Logger`/`LoggerBase`, `Schema`/`schema`, `Perfil`, todos os `*Repository`/`*Service` de domínio (`AuditoriaRepository`, `SessaoRepository`, `CicloDeVidaService`, `ContaGlobalRepository`, `ExpurgoDaEscolaRepository`, `RetencaoDaEscolaRepository`, `ArquivoDoTitularRepository`, `CompartilhamentoRepository`, `EliminacaoDoTitularRepository`, `IncidenteDaEscolaRepository`, `SuboperadorDaEscolaRepository`), as peças de domínio `EliminacaoDoTitular`, `LeituraDoTitular`, `TrocaDeNome`, `Compartilhamento`, `JanelaLetiva`, `ExecucaoAgendada`, `OrcamentoDeIa`, `SuspensaoDeFuncao`, `RegistroDeConsumo`, as tarefas de IA e os `PROMPT_*`, as tabelas Drizzle (`db/schema/*`) e tudo o que é verbo de utilitário de domínio listado na seção 1.
