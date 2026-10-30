# Inventário de rename (D81): apps/api, apps/worker, apps/despachante, apps/realtime

Levantamento só de leitura, em `src` e `test` dos quatro apps (sem `node_modules` nem `dist`). `packages/` é de outro agente: a seção "Peças de `packages/` que este escopo importa" lista o que o rename de lá vai arrastar para cá.

**Como ler**
- **Usos** = nº de arquivos de código (todo o repositório, menos `tasks/` e `mockups/`) que citam o nome atual, contando o arquivo que o define; `(+N)` = arquivos de `docs/`, `.claude/`, `CLAUDE.md`, `README.md`, `TODO.md`, `ROADMAP.md`. É `git grep -lE` com palavra inteira: serve de ordem de grandeza (nome genérico como `Despachante` ou `BANCO` infla). Linha com vários nomes mostra o uso do primeiro. Linha de pasta conta os arquivos que importam da pasta. Teste sem import (`*.int.test.ts`) dá 0: ninguém o importa.
- Linha de arquivo: o nome novo segue o do símbolo principal (kebab-case); `*.test.ts` acompanha o arquivo que testa.
- Os nomes propostos usam o vocabulário do NestJS, BullMQ, Drizzle, Socket.IO e do guia §9. Onde não há nome de mercado exato, a alternativa vem em "Dúvidas".
- Domínio em português (`Turma`, `Escola`, `Operador`, `Sessao`, `Convite`, `Material`, `Lote`...) fica como prefixo e o sufixo técnico vai para inglês.
- Aqui só entra peça técnica. Métodos, verbos (`criar`, `executar`, `lerPedido*`, `paginar`...), variáveis locais, textos de teste, tabelas, colunas, filas, env, métricas, eventos de log, códigos de erro, rotas e eventos de WebSocket **não** entram (os que parecem e não mudam estão em "Não muda, mas parece").

**Resumo:** 383 linhas propostas (cerca de 470 nomes, porque várias linhas agrupam nomes irmãos), em 17 grupos. Fora dos grupos: Dúvidas (D1 a D22), "Não muda, mas parece", "Examinados e mantidos", constantes e peças de `packages/`.

## Propostas por tipo de peça

### Módulos, tokens de injeção e bootstrap (API)

**Regra do grupo:** Módulo, token e fábrica com prefixo técnico em português passa para o nome de mercado (`DatabaseModule`, `RateLimitModule`, `DB`, `configureApp`); o domínio fica em português. Token de DI em SCREAMING_CASE traduz o termo técnico e mantém o domínio.

| Atual | Proposto | Tipo | Onde (caminho) | Usos (arquivos de código, +docs) |
|---|---|---|---|---|
| `BancoModule` | `DatabaseModule` | módulo | `apps/api/src/banco.module.ts` | 3 (+1) |
| `banco.module.ts` | `database.module.ts` | arquivo | `apps/api/src/` | 30 (+0) |
| `POOL_BANCO` | `DB_POOL` | token DI | `apps/api/src/banco.module.ts` | 6 (+0) |
| `BANCO` | `DB` | token DI (instância Drizzle) | `apps/api/src/banco.module.ts` | 65 (+5) |
| `LimiteModule` | `RateLimitModule` | módulo | `apps/api/src/limite.module.ts` | 3 (+1) |
| `limite.module.ts` | `rate-limit.module.ts` | arquivo | `apps/api/src/` | 6 (+0) |
| `CLIENTE_REDIS_CACHE` | `REDIS_CACHE_CLIENT` | token DI | `apps/api/src/limite.module.ts` | 6 (+0) |
| `LIMITES_DA_ESCOLA` | `ESCOLA_RATE_LIMITS` | token DI | `apps/api/src/limite.module.ts` | 2 (+0) |
| `UsoModule` | `UsageModule` | módulo | `apps/api/src/uso.module.ts` | 2 (+1) |
| `uso.module.ts` | `usage.module.ts` | arquivo | `apps/api/src/` | 2 (+0) |
| `CLIENTE_REDIS_USO` | `REDIS_USAGE_CLIENT` | token DI | `apps/api/src/uso.module.ts` | 2 (+0) |
| `CLIENTE_REDIS_LOGIN` | `REDIS_LOGIN_CLIENT` | token DI | `apps/api/src/credencial/cliente-redis-login.ts` | 24 (+0) |
| `cliente-redis-login.ts` | `login-redis-client.ts` | arquivo | `apps/api/src/credencial/` | 2 (+0) |
| `http/paginacao.ts` | `http/pagination.ts` | arquivo | `apps/api/src/http/` | 15 (+2) |
| `configurar-app.ts (API)` | `configure-app.ts` | arquivo | `apps/api/src/` | 24 (+0) |
| `configurarAplicacao` | `configureApp` | função (fábrica) | `apps/api/src/configurar-app.ts` | 25 (+0) |
| `OpcoesDeMontagem (api)` | `AppModuleOptions` | interface | `apps/api/src/app.module.ts` | 2 (+0) |
| `static com(...) em todo módulo dinâmico` | `forRoot(...)` | método estático (convenção Nest) | `apps/api/src/**/*.module.ts, apps/{worker,despachante,realtime}/src/app.module.ts` | 30 (+0) |

### Módulo sistema (saúde, prontidão, estado, contexto, avisos, jobs sintéticos)

**Regra do grupo:** As rotas HTTP (`/saude`, `/prontidao`, `/v1/sistema/*`) e as chaves de permissão (`sistema_contexto`...) não mudam; só classe, arquivo e pasta.

| Atual | Proposto | Tipo | Onde (caminho) | Usos (arquivos de código, +docs) |
|---|---|---|---|---|
| `SistemaModule` | `SystemModule` | módulo | `apps/api/src/sistema/sistema.module.ts` | 2 (+0) |
| `sistema.module.ts` | `system.module.ts` | arquivo | `apps/api/src/sistema/` | 2 (+0) |
| `sistema/ (pasta)` | `system/` | pasta | `apps/api/src/sistema/` | 5 (+2) |
| `SaudeController` | `HealthController` | controller | `apps/api/src/sistema/saude.controller.ts` | 2 (+0) |
| `SaudeService` | `HealthService` | service | `apps/api/src/sistema/saude.service.ts` | 5 (+0) |
| `saude.controller.ts, saude.service.ts` | `health.controller.ts, health.service.ts` | arquivo | `apps/api/src/sistema/` | 4 (+0) |
| `ProntidaoController (API)` | `ReadinessController` | controller | `apps/api/src/sistema/prontidao.controller.ts` | 4 (+1) |
| `prontidao.controller.ts (API)` | `readiness.controller.ts` | arquivo | `apps/api/src/sistema/` | 2 (+1) |
| `EstadoController` | `StatusController` | controller | `apps/api/src/sistema/estado.controller.ts` | 2 (+0) |
| `EstadoService` | `StatusService` | service | `apps/api/src/sistema/estado.service.ts` | 4 (+0) |
| `estado.controller.ts, estado.service.ts, estado.service.test.ts` | `status.controller.ts, status.service.ts, status.service.test.ts` | arquivo | `apps/api/src/sistema/` | 3 (+0) |
| `VERSAO_DO_SISTEMA` | `SYSTEM_VERSION` | token DI | `apps/api/src/sistema/estado.service.ts` | 2 (+0) |
| `AMBIENTE_DO_SISTEMA` | `SYSTEM_ENVIRONMENT` | token DI | `apps/api/src/sistema/estado.service.ts` | 2 (+0) |
| `RELOGIO_DO_ESTADO` | `STATUS_CLOCK` | token DI | `apps/api/src/sistema/estado.service.ts` | 2 (+0) |
| `ContextoController` | `ContextController` | controller | `apps/api/src/sistema/contexto.controller.ts` | 2 (+0) |
| `contexto.controller.ts` | `context.controller.ts` | arquivo | `apps/api/src/sistema/` | 1 (+0) |
| `AvisosController` | `NoticesController` | controller | `apps/api/src/sistema/avisos.controller.ts` | 2 (+0) |
| `AVISOS_DO_SISTEMA` | `SYSTEM_NOTICES` | token DI | `apps/api/src/sistema/avisos.controller.ts` | 2 (+0) |
| `avisos.controller.ts` | `notices.controller.ts` | arquivo | `apps/api/src/sistema/` | 1 (+0) |
| `JobsSinteticosController` | `SyntheticJobsController` | controller | `apps/api/src/sistema/jobs-sinteticos.controller.ts` | 2 (+0) |
| `JobsSinteticosConsultaController` | `SyntheticJobsQueryController` | controller | `apps/api/src/sistema/jobs-sinteticos.controller.ts` | 2 (+0) |
| `JobsSinteticosService` | `SyntheticJobsService` | service | `apps/api/src/sistema/jobs-sinteticos.service.ts` | 3 (+0) |
| `jobs-sinteticos.controller.ts, jobs-sinteticos.service.ts` | `synthetic-jobs.controller.ts, synthetic-jobs.service.ts` | arquivo | `apps/api/src/sistema/` | 24 (+2) |

### Controllers, services e repositories de prefixo técnico (sessão e operação)

**Regra do grupo:** Recurso técnico (`eu`, `saida`, `renovacao`, `externa`, `segundo-fator`) vira o termo de mercado (`Me`, `Logout`, `Refresh`, `External`, `Mfa`); recurso de domínio (`Convite`, `Turma`, `Troca de escola`) fica. Rota HTTP não muda.

| Atual | Proposto | Tipo | Onde (caminho) | Usos (arquivos de código, +docs) |
|---|---|---|---|---|
| `EuController` | `MeController` | controller | `apps/api/src/sessao/eu/eu.controller.ts` | 2 (+0) |
| `EuService` | `MeService` | service | `apps/api/src/sessao/eu/eu.service.ts` | 4 (+0) |
| `EuRepository` | `MeRepository` | repository | `apps/api/src/sessao/eu/eu.repository.ts` | 6 (+0) |
| `LinhaDoEu` | `MeRow` | type | `apps/api/src/sessao/eu/eu.repository.ts` | 3 (+0) |
| `eu/ (pasta, sessao/)` | fica (`Eu` é termo do glossário; §2 do inventário) | pasta | `apps/api/src/sessao/eu/` | 19 (+2) |
| `EuDoOperadorController` | `OperadorMeController` | controller | `apps/api/src/operacao/eu/eu.controller.ts` | 2 (+0) |
| `EuDoOperadorService` | `OperadorMeService` | service | `apps/api/src/operacao/eu/eu.service.ts` | 3 (+0) |
| `eu/ (pasta, operacao/)` | fica (`Eu` é termo do glossário; §2 do inventário) | pasta | `apps/api/src/operacao/eu/` | 19 (+2) |
| `SaidaController` | `LogoutController` | controller | `apps/api/src/sessao/saida/saida.controller.ts` | 2 (+0) |
| `SaidaService` | `LogoutService` | service | `apps/api/src/sessao/saida/saida.service.ts` | 3 (+0) |
| `saida/ (pasta)` | `logout/` | pasta | `apps/api/src/sessao/saida/` | 1 (+0) |
| `RenovacaoController` | `RefreshController` | controller | `apps/api/src/sessao/renovacao/renovacao.controller.ts` | 2 (+0) |
| `RenovacaoService` | `RefreshService` | service | `apps/api/src/sessao/renovacao/renovacao.service.ts` | 3 (+0) |
| `renovacao/ (pasta)` | `refresh/` | pasta | `apps/api/src/sessao/renovacao/` | 1 (+1) |
| `LoginExternoController` | `ExternalLoginController` | controller | `apps/api/src/sessao/externa/externa.controller.ts` | 2 (+0) |
| `externa.controller.ts, externa.service.ts` | `external-login.controller.ts, external-login.service.ts` | arquivo | `apps/api/src/sessao/externa/` | 3 (+0) |
| `LoginExterno (service)` | `ExternalLoginService` | service | `apps/api/src/sessao/externa/externa.service.ts` | 16 (+0) |
| `ContaExternaRepository` | `ContaExternalRepository` | repository | `apps/api/src/sessao/externa/conta-externa.repository.ts` | 5 (+1) |
| `externa/ (pasta)` | `external/` | pasta | `apps/api/src/sessao/externa/` | 12 (+0) |
| `ProvedorExternoPort` | `ExternalProviderPort` | port | `apps/api/src/sessao/externa/provedor-externo.port.ts` | 4 (+0) |
| `provedor-externo.port.ts` | `external-provider.port.ts` | arquivo | `apps/api/src/sessao/externa/` | 3 (+0) |
| `PROVEDOR_EXTERNO` | `EXTERNAL_PROVIDER` | token DI | `apps/api/src/sessao/sessao.module.ts` | 1 (+0) |
| `SegundoFatorDoOperadorController` | `OperadorMfaController` | controller | `apps/api/src/operacao/segundo-fator/segundo-fator.controller.ts` | 2 (+0) |
| `SegundoFatorDoOperadorService` | `OperadorMfaService` | service | `apps/api/src/operacao/segundo-fator/segundo-fator.service.ts` | 4 (+0) |
| `segundo-fator/ (pasta, operacao/)` | `mfa/` | pasta | `apps/api/src/operacao/segundo-fator/` | 3 (+0) |
| `ResolucaoDeTenantRepository` | `TenantResolutionRepository` | repository | `apps/api/src/sessao/tenant/resolucao-de-tenant.repository.ts` | 29 (+2) |
| `resolucao-de-tenant.repository.ts` | `tenant-resolution.repository.ts` | arquivo | `apps/api/src/sessao/tenant/` | 28 (+1) |
| `EscritaDeSessaoRepository` | `SessaoWriteRepository` | repository | `apps/api/src/credencial/escrita-de-sessao.repository.ts` | 7 (+0) |
| `CriacaoDeSessaoRepository` | `SessaoCreateRepository` | repository | `apps/api/src/credencial/criacao-de-sessao.repository.ts` | 8 (+0) |
| `escrita-de-sessao.repository.ts, criacao-de-sessao.repository.ts` | `sessao-write.repository.ts, sessao-create.repository.ts` | arquivo | `apps/api/src/credencial/` | 5 (+0) |
| `RenovacaoDeOperador (resultado de renovar)` | `OperadorRefresh` | interface | `apps/api/src/operacao/sessao/sessao.service.ts` | 6 (+0) |
| `ResultadoDaRenovacao / ResultadoDaRenovacaoHttp / RESULTADOS_DA_RENOVACAO / resultadoPeloCookie / JANELA_DE_JA_RENOVADO_SEGUNDOS` | `RefreshResult / RefreshHttpResult / REFRESH_RESULTS / resultByCookie / ALREADY_REFRESHED_WINDOW_SECONDS` | tipos / consts / função | `apps/api/src/sessao/renovacao/renovacao.service.ts` | 1 (+0) |
| `Redirecionamento` | `Redirect` | interface | `apps/api/src/sessao/externa/externa.service.ts` | 4 (+0) |

### Material, extração de PDF e lote

**Regra do grupo:** Peça técnica (extrator, fila em memória, upload, marca de leitura) em inglês; `Material`, `Trecho`, `Lote` ficam.

| Atual | Proposto | Tipo | Onde (caminho) | Usos (arquivos de código, +docs) |
|---|---|---|---|---|
| `leitor-da-lista.ts (ListaReader)` | `lista-reader.ts` | arquivo | `apps/api/src/estrutura/lista/` | 4 (+0) |
| `ExtratorDePdf` | `PdfExtractor` | classe | `apps/api/src/material/extracao-de-pdf.ts` | 5 (+0) |
| `extracao-de-pdf.ts` | `pdf-extraction.ts` | arquivo | `apps/api/src/material/` | 6 (+0) |
| `FilaDeExtracao` | `ExtractionQueue` | classe (fila em memória do processo) | `apps/api/src/material/fila-de-extracao.ts` | 5 (+0) |
| `TrabalhoDeExtracao` | `ExtractionTask` | type | `apps/api/src/material/fila-de-extracao.ts` | 1 (+0) |
| `OpcoesDaFila` | `ExtractionQueueOptions` | interface | `apps/api/src/material/fila-de-extracao.ts` | 1 (+0) |
| `fila-de-extracao.ts` | `extraction-queue.ts` | arquivo | `apps/api/src/material/` | 4 (+0) |
| `CicloDaExtracao` | `ExtractionLifecycle` | classe (OnApplicationBootstrap/Shutdown) | `apps/api/src/material/material.module.ts` | 1 (+0) |
| `BuscaDeTrechos` | `TrechoSearch` | classe | `apps/api/src/material/busca-de-trechos.ts` | 15 (+0) |
| `busca-de-trechos.ts` | `trecho-search.ts` | arquivo | `apps/api/src/material/` | 12 (+0) |
| `RecebimentoDoMaterial` | `MaterialUploadInterceptor` | const (FileInterceptor) | `apps/api/src/material/recebimento.ts` | 2 (+0) |
| `recebimento.ts` | `material-upload.ts` | arquivo | `apps/api/src/material/` | 3 (+0) |
| `LeituraDoLote` | `LoteReadMarker` | classe (marca no Redis da leitura do lote) | `apps/api/src/atividade/correcao/leitura-do-lote.ts` | 5 (+0) |
| `leitura-do-lote.ts` | `lote-read-marker.ts` | arquivo | `apps/api/src/atividade/correcao/` | 4 (+0) |

### Guardas e decorators HTTP

**Regra do grupo:** `Guarda*` vira `<Domínio>Guard`; `Conferencia*` (verificação) vira `*Check`; arquivo segue o nome em kebab-case com o sufixo de mercado (`.guard.ts`).

| Atual | Proposto | Tipo | Onde (caminho) | Usos (arquivos de código, +docs) |
|---|---|---|---|---|
| `GuardaDeOperador` | `OperadorGuard` | guard | `apps/api/src/operacao/guarda-de-operador.ts` | 15 (+0) |
| `guarda-de-operador.ts` | `operador.guard.ts` | arquivo | `apps/api/src/operacao/` | 4 (+0) |
| `IDENTIDADE_DA_OPERACAO` | `OPERACAO_IDENTITY` | token DI | `apps/api/src/operacao/guarda-de-operador.ts` | 1 (+0) |
| `SESSOES_DE_OPERADOR` | `OPERADOR_SESSIONS` | token DI | `apps/api/src/operacao/guarda-de-operador.ts` | 2 (+0) |
| `LeituraDaSessaoDeOperador` | `OperadorSessionReader` | interface | `apps/api/src/operacao/guarda-de-operador.ts` | 2 (+0) |
| `provedoresDaGuardaDeOperador` | `operadorGuardProviders` | função (fábrica de providers) | `apps/api/src/operacao/guarda-de-operador.ts` | 3 (+0) |
| `RotaDeOperacao` | `OperacaoRoute` | decorator | `apps/api/src/operacao/marcadores.ts` | 19 (+1) |
| `EntradaDeOperacao` | `OperacaoLoginRoute` | decorator | `apps/api/src/operacao/marcadores.ts` | 13 (+0) |
| `marcadores.ts` | `decorators.ts` | arquivo | `apps/api/src/operacao/` | 4 (+0) |
| `GuardaDoEnvio` | `MaterialUploadGuard` | guard | `apps/api/src/material/recebimento.ts` | 4 (+0) |
| `GuardaDoCodigo` | `CodigoRateLimit` | interface (porta do limite de código errado) | `apps/api/src/sessao/tenant/acesso-da-sala.ts` | 4 (+0) |
| `ConferenciaDoAutor` | `AuthorCheck` | type (função que confere o autor da escrita) | `apps/api/src/sessao/conferencia-do-autor.ts` | 14 (+1) |
| `conferencia-do-autor.ts` | `author-check.ts` | arquivo | `apps/api/src/sessao/` | 3 (+0) |
| `ConferenciaDeFuncao` | `FuncaoSuspensionCheck` | classe | `apps/api/src/ia/conferencia-de-funcao.ts` | 8 (+0) |
| `conferencia-de-funcao.ts` | `funcao-suspension-check.ts` | arquivo | `apps/api/src/ia/` | 4 (+0) |
| `artefato/conferencia.ts` | `artefato/output-validation.ts` | arquivo (funções que conferem a saída da IA) | `apps/api/src/artefato/conferencia.ts` | 3 (+0) |

### Limitadores, contadores e métricas de login/sala

**Regra do grupo:** Nome de mercado do mecanismo (lockout, bulkhead, rate limit, window counter, fallback); o assunto de domínio (`Sala`, `Escola`) fica como prefixo.

| Atual | Proposto | Tipo | Onde (caminho) | Usos (arquivos de código, +docs) |
|---|---|---|---|---|
| `ContadorDeTentativas` | `LoginLockout` | classe (lockout de login) | `apps/api/src/credencial/contador-de-tentativas.ts` | 20 (+2) |
| `contador-de-tentativas.ts` | `login-lockout.ts` | arquivo | `apps/api/src/credencial/` | 9 (+1) |
| `ContadorEmJanela` | `WindowCounter` | classe (rate limiter por janela) | `apps/api/src/credencial/senha/contador-em-janela.ts` | 15 (+2) |
| `ContagemNaJanela` | `WindowCount` | interface | `apps/api/src/credencial/senha/contador-em-janela.ts` | 2 (+0) |
| `OpcoesDoContador` | `WindowCounterOptions` | interface | `apps/api/src/credencial/senha/contador-em-janela.ts` | 1 (+0) |
| `contador-em-janela.ts` | `window-counter.ts` | arquivo | `apps/api/src/credencial/senha/` | 8 (+0) |
| `SemaforoDeHash` | `HashBulkhead` | classe (bulkhead do argon2) | `apps/api/src/credencial/senha/semaforo-de-hash.ts` | 16 (+1) |
| `SemaforoSemProtecao` | `UnprotectedHashBulkhead` | classe | `apps/api/src/credencial/senha/semaforo-de-hash.ts` | 3 (+0) |
| `semaforo-de-hash.ts` | `hash-bulkhead.ts` | arquivo | `apps/api/src/credencial/senha/` | 5 (+0) |
| `ConferenciaNaVez` | `PasswordVerifier` | classe | `apps/api/src/credencial/senha/conferencia-na-vez.ts` | 5 (+0) |
| `TentativaDeSenha` | `PasswordAttempt` | interface | `apps/api/src/credencial/senha/conferencia-na-vez.ts` | 3 (+0) |
| `SenhaConferida` | `VerifiedPassword` | interface | `apps/api/src/credencial/senha/conferencia-na-vez.ts` | 2 (+0) |
| `conferencia-na-vez.ts` | `password-verifier.ts` | arquivo | `apps/api/src/credencial/senha/` | 3 (+0) |
| `RebaixamentoPorEscola` | `EscolaIpThrottle` | classe | `apps/api/src/credencial/senha/rebaixamento.ts` | 4 (+0) |
| `rebaixamento.ts` | `ip-throttle.ts` | arquivo | `apps/api/src/credencial/senha/` | 3 (+0) |
| `LimiteDoEmailPorIp` | `EmailIpRateLimit` | classe | `apps/api/src/credencial/senha/limite-email-ip.ts` | 4 (+0) |
| `limite-email-ip.ts` | `email-ip-rate-limit.ts` | arquivo | `apps/api/src/credencial/senha/` | 4 (+0) |
| `BaldeDeLogin` | `LoginBucket` | interface | `apps/api/src/credencial/senha/baldes-de-login.ts` | 7 (+0) |
| `baldeDaEscola, baldeDaEscolaDesconhecida, baldeDaEquipe` | `escolaBucket, escolaDesconhecidaBucket, equipeBucket` | funções (fábricas) | `apps/api/src/credencial/senha/baldes-de-login.ts` | 5 (+0) |
| `baldes-de-login.ts` | `login-buckets.ts` | arquivo | `apps/api/src/credencial/senha/` | 6 (+0) |
| `DuracaoDoLogin` | `LoginDurationHistogram` | classe | `apps/api/src/credencial/senha/duracao-do-login.ts` | 3 (+0) |
| `duracao-do-login.ts` | `login-duration.ts` | arquivo | `apps/api/src/credencial/senha/` | 2 (+0) |
| `SeguroDoLogin` | `LoginFallbackTracker` | classe (agrega a proporção atendida sem Redis) | `apps/api/src/credencial/seguro-do-login.ts` | 6 (+0) |
| `FonteDoSeguro` | `FallbackSource` | interface | `apps/api/src/credencial/seguro-do-login.ts` | 1 (+0) |
| `seguro-do-login.ts` | `login-fallback.ts` | arquivo | `apps/api/src/credencial/` | 3 (+0) |
| `LimitesDaSala` | `SalaRateLimits` | classe | `apps/api/src/sala/limites-da-sala.ts` | 8 (+0) |
| `DependenciasDosLimites` | `SalaRateLimitsDependencies` | interface | `apps/api/src/sala/limites-da-sala.ts` | 1 (+0) |
| `limites-da-sala.ts` | `sala-rate-limits.ts` | arquivo | `apps/api/src/sala/` | 8 (+2) |
| `LimiteDePedidosDeIa` | `IaRequestRateLimit` | classe | `apps/api/src/assistente/limite-de-pedidos-de-ia.ts` | 13 (+0) |
| `limite-de-pedidos-de-ia.ts` | `ai-request-rate-limit.ts` | arquivo | `apps/api/src/assistente/` | 16 (+0) |
| `FalhasDeEntradaDaOperacao` | `OperacaoLoginFailureCounter` | classe | `apps/api/src/operacao/falhas-de-entrada.ts` | 4 (+0) |
| `falhas-de-entrada.ts` | `login-failure-counter.ts` | arquivo | `apps/api/src/operacao/` | 3 (+0) |

### Segurança: token, desafio, cookie, segredo, hash

**Regra do grupo:** `Desafio` = `Challenge`, `Bilhete` = `Ticket`, `Cifra` = `Cipher`, `Dispositivo` = `Device`. Strings gravadas e lidas por fora (tipo do JWT `desafio+jwt`, prefixo Redis `desafio:usado:`, nomes de cookie `educa_sessao`) NÃO mudam.

| Atual | Proposto | Tipo | Onde (caminho) | Usos (arquivos de código, +docs) |
|---|---|---|---|---|
| `EmissorDeDesafio` | `ChallengeIssuer` | classe | `apps/api/src/credencial/desafio.ts` | 17 (+0) |
| `ConsumoDeDesafio` | `ChallengeConsumer` | classe | `apps/api/src/credencial/desafio.ts` | 7 (+0) |
| `verificarDesafio` | `verifyChallenge` | função | `apps/api/src/credencial/desafio.ts` | 9 (+0) |
| `PedidoDeDesafio / DesafioVerificado` | `ChallengeRequest / VerifiedChallenge` | interfaces | `apps/api/src/credencial/desafio.ts` | 2 (+0) |
| `AUDIENCIA_DESAFIO / VALIDADE_DESAFIO_SEGUNDOS / PREFIXO_DESAFIO_USADO` | `CHALLENGE_AUDIENCE / CHALLENGE_TTL_SECONDS / USED_CHALLENGE_PREFIX` | constantes | `apps/api/src/credencial/desafio.ts` | 6 (+0) |
| `desafio.ts` | `challenge.ts` | arquivo | `apps/api/src/credencial/` | 6 (+0) |
| `EmissorDeDesafioDeOperador` | `OperadorChallengeIssuer` | classe | `apps/api/src/operacao/desafio-de-operador.ts` | 7 (+0) |
| `ConsumoDeDesafioDeOperador` | `OperadorChallengeConsumer` | classe | `apps/api/src/operacao/desafio-de-operador.ts` | 5 (+0) |
| `verificarDesafioDeOperador` | `verifyOperadorChallenge` | função | `apps/api/src/operacao/desafio-de-operador.ts` | 6 (+0) |
| `PedidoDeDesafioDeOperador / DesafioDeOperadorVerificado / EtapaDoDesafioDeOperador` | `OperadorChallengeRequest / VerifiedOperadorChallenge / OperadorChallengeStep` | interfaces/types | `apps/api/src/operacao/desafio-de-operador.ts` | 1 (+0) |
| `AUDIENCIA_DESAFIO_DE_OPERADOR / VALIDADE_DESAFIO_DE_OPERADOR_SEGUNDOS / PREFIXO_DESAFIO_DE_OPERADOR_USADO / ETAPAS_DO_DESAFIO_DE_OPERADOR` | `OPERADOR_CHALLENGE_AUDIENCE / OPERADOR_CHALLENGE_TTL_SECONDS / USED_OPERADOR_CHALLENGE_PREFIX / OPERADOR_CHALLENGE_STEPS` | constantes | `apps/api/src/operacao/desafio-de-operador.ts` | 2 (+0) |
| `desafio-de-operador.ts` | `operador-challenge.ts` | arquivo | `apps/api/src/operacao/` | 10 (+0) |
| `BilheteDeConvite` | `ConviteTicket` | classe (JWT que liga o link aceito ao login) | `apps/api/src/sessao/convite/bilhete-de-convite.ts` | 4 (+0) |
| `BilheteVerificado` | `VerifiedConviteTicket` | interface | `apps/api/src/sessao/convite/bilhete-de-convite.ts` | 1 (+0) |
| `TIPO_BILHETE / AUDIENCIA_BILHETE / VALIDADE_BILHETE_SEGUNDOS` | `TICKET_TYPE / TICKET_AUDIENCE / TICKET_TTL_SECONDS` | constantes | `apps/api/src/sessao/convite/bilhete-de-convite.ts` | 2 (+0) |
| `bilhete-de-convite.ts` | `convite-ticket.ts` | arquivo | `apps/api/src/sessao/convite/` | 3 (+0) |
| `CifraDoSegredo` | `SecretCipher` | classe | `apps/api/src/credencial/cifra-do-segredo.ts` | 13 (+0) |
| `SegredoCifrado` | `CipheredSecret` | type | `apps/api/src/credencial/cifra-do-segredo.ts` | 1 (+0) |
| `cifra-do-segredo.ts` | `secret-cipher.ts` | arquivo | `apps/api/src/credencial/` | 4 (+0) |
| `HashDeSenha` | `PasswordHasher` | classe | `apps/api/src/credencial/hash-de-senha.ts` | 30 (+0) |
| `hash-de-senha.ts` | `password-hasher.ts` | arquivo | `apps/api/src/credencial/` | 7 (+0) |
| `ParametrosDoHash` | `HashParams` | interface | `apps/api/src/credencial/configuracao-de-login.ts` | 2 (+0) |
| `hash-do-token.ts` | `token-hash.ts` | arquivo | `apps/api/src/credencial/` | 12 (+0) |
| `identificadores-do-login.ts` | `login-identifiers.ts` | arquivo | `apps/api/src/credencial/` | 7 (+0) |
| `segundo-fator.ts (TOTP, códigos de recuperação)` | `totp.ts` | arquivo | `apps/api/src/credencial/` | 3 (+0) |
| `CookieDeDispositivo` | `DeviceCookie` | classe | `apps/api/src/credencial/cookie-dispositivo.ts` | 13 (+0) |
| `cookie-dispositivo.ts` | `device-cookie.ts` | arquivo | `apps/api/src/credencial/` | 8 (+0) |
| `COOKIE_SESSAO / COOKIE_DISPOSITIVO` | `SESSAO_COOKIE / DEVICE_COOKIE` | constantes (nome do cookie) | `apps/api/src/credencial/cookies.ts` | 14 (+0) |
| `OpcoesDoCookie` | `CookieOptions` | interface | `apps/api/src/credencial/cookies.ts` | 1 (+0) |
| `dispositivo-de-operador.ts` | `operador-device-cookie.ts` | arquivo | `apps/api/src/operacao/` | 6 (+0) |
| `COOKIE_DISPOSITIVO_DE_OPERADOR / cookieDeDispositivoDeOperador` | `OPERADOR_DEVICE_COOKIE / operadorDeviceCookie` | const / função | `apps/api/src/operacao/dispositivo-de-operador.ts` | 6 (+0) |
| `origem-da-requisicao.ts` | `request-origin.ts` | arquivo | `apps/api/src/credencial/` | 11 (+0) |
| `OrigemDaRequisicao` | `RequestOrigin` | interface | `apps/api/src/credencial/origem-da-requisicao.ts` | 9 (+0) |
| `SessaoDeOperadorParaGuarda / SessaoDeOperadorParaRenovar` | `SessaoDeOperadorForGuard / SessaoDeOperadorForRefresh` | interfaces | `apps/api/src/operacao/sessao/prazos-da-sessao.ts` | 4 (+0) |
| `prazos-da-sessao.ts` | `sessao-timeouts.ts` | arquivo | `apps/api/src/operacao/sessao/` | 8 (+0) |
| `configuracao-de-login.ts` | `login-config.ts` | arquivo | `apps/api/src/credencial/` | 6 (+0) |
| `ConfiguracaoLogin / ConfiguracaoMfa` | `LoginConfig / MfaConfig` | interfaces | `apps/api/src/credencial/configuracao-de-login.ts` | 13 (+0) |
| `lerConfiguracaoLogin` | `loadLoginConfig` (adenda 3) | função | `apps/api/src/credencial/configuracao-de-login.ts` | 5 (+0) |
| `configuracao-externa.ts` | `external-login-config.ts` | arquivo | `apps/api/src/credencial/` | 6 (+0) |
| `ConfiguracaoLoginExterno / lerConfiguracaoLoginExterno` | `ExternalLoginConfig / loadExternalLoginConfig` (adenda 3) | interface / função | `apps/api/src/credencial/configuracao-externa.ts` | 7 (+0) |
| `conclusao-de-login.ts + ConclusaoDeLogin` | `login-completion.ts + LoginCompletion` | arquivo + classe | `apps/api/src/sessao/conclusao/` | 7 (+0) |
| `conclusao/ (pasta)` | `completion/` | pasta | `apps/api/src/sessao/conclusao/` | 7 (+0) |
| `sessoes-sinteticas.ts` | `synthetic-sessions.ts` | arquivo | `apps/api/src/sessao/tenant/` | 5 (+0) |
| `SessaoSintetica / PedidoDeSessoesSinteticas / criarSessoesSinteticas / emissorDeTokenSintetico` | `SyntheticSession / SyntheticSessionsRequest / createSyntheticSessions / syntheticTokenIssuer` | tipos / funções | `apps/api/src/sessao/tenant/sessoes-sinteticas.ts` | 3 (+0) |

### Erros

**Regra do grupo:** Classe de erro termina em `Error` (sufixo de mercado) e o resto vai para inglês técnico, com o domínio mantido. Os códigos (`NAO_ENCONTRADO`, `TEMPO_ESGOTADO`) não mudam. As recusas de domínio estão marcadas e entram na dúvida D6.

| Atual | Proposto | Tipo | Onde (caminho) | Usos (arquivos de código, +docs) |
|---|---|---|---|---|
| `RenovacaoRecusada` | `RefreshRejectedError` | classe (extends ErroDeDominio) | `apps/api/src/sessao/renovacao/renovacao.service.ts` | 2 (+0) |
| `RenovacaoDeOperadorRecusada` | `OperadorRefreshRejectedError` | classe (extends ErroDeDominio) | `apps/api/src/operacao/sessao/sessao.service.ts` | 2 (+0) |
| `RenovacaoDeOperador` | `OperadorRefresh` | type/const (resultado) | `apps/api/src/operacao/sessao/sessao.service.ts` | 6 (+0) |
| `OperadorRecusado` | `OperadorRejectedError` | classe | `apps/api/src/ops/comando.ts` | 13 (+0) |
| `DesativacaoRecusada` | `DesativacaoRejectedError` | classe | `apps/api/src/ops/operador.ts` | 1 (+0) |
| `ArgumentoInvalido` | `InvalidArgumentError` | classe | `apps/api/src/ops/comando.ts` | 21 (+0) |
| `ProvedorExternoFalhou` | `ExternalProviderError` | classe | `apps/api/src/sessao/externa/provedor-externo.port.ts` | 3 (+0) |
| `SegredoNaoDecifra` | `SecretDecryptionError` | classe | `apps/api/src/credencial/cifra-do-segredo.ts` | 4 (+0) |
| `NaoGravou` | `NotWrittenError` | classe (não exportada) | `apps/api/src/sala/reivindicacao/reivindicacao.service.ts` | 1 (+0) |
| `FalhaDeJob` | `JobFailureError` | classe | `apps/worker/src/falha-de-job.ts` | 16 (+1) |
| `falha-de-job.ts` | `job-failure.error.ts` | arquivo | `apps/worker/src/` | 13 (+0) |
| `TempoEsgotado` | `JobTimeoutError` | classe (não exportada) | `apps/worker/src/executor.ts` | 1 (+0) |
| `ErroParaAFila` | `QueueFacingError` | classe (não exportada; é o erro que o BullMQ grava no Redis) | `apps/worker/src/executor.ts` | 2 (+0) |
| `PrazoDaFilaEsgotado` | `QueueTimeoutError` | classe | `apps/despachante/src/fila-de-publicacao.ts` | 2 (+0) |
| `ErroDeConexao (realtime)` | `ConnectionError` | interface | `apps/realtime/src/autenticacao-do-handshake.ts` | 4 (+0) |
| `erroDeConexaoNaoAutenticada / erroDeConexaoIndisponivel` | `unauthenticatedConnectionError / unavailableConnectionError` | funções (fábricas) | `apps/realtime/src/autenticacao-do-handshake.ts` | 2 (+0) |

### Jobs, processadores e executor (worker)

**Regra do grupo:** Vocabulário do BullMQ: `Processador` = `JobProcessor`, `Agendamento` = `JobSchedule`, executor = `JobExecutor`; pasta `processadores/` = `processors/`. Tipo de job (`sistema.consolidar_uso`), nome de fila no Redis e métrica não mudam.

| Atual | Proposto | Tipo | Onde (caminho) | Usos (arquivos de código, +docs) |
|---|---|---|---|---|
| `ExecutorDeJobs` | `JobExecutor` | classe | `apps/worker/src/executor.ts` | 3 (+1) |
| `executor.ts` | `job-executor.ts` | arquivo | `apps/worker/src/` | 4 (+0) |
| `Processador` | `JobProcessor` | type | `apps/worker/src/executor.ts` | 14 (+2) |
| `ProcessadoresDeJob` | `JobProcessors` | type | `apps/worker/src/executor.ts` | 4 (+0) |
| `ProcessadorSemTipo` | `UntypedJobProcessor` | type (não exportado) | `apps/worker/src/executor.ts` | 1 (+0) |
| `ExecucaoDoJob` | `JobExecution` | interface | `apps/worker/src/executor.ts` | 3 (+0) |
| `JobDaFila` | `QueuedJob` | type | `apps/worker/src/executor.ts` | 2 (+0) |
| `AvisoDeVagaLivre` | `SlotReleasedNotifier` | classe | `apps/worker/src/executor.ts` | 3 (+0) |
| `VagaDoJob` | `JobSlot` | interface (não exportada) | `apps/worker/src/executor.ts` | 1 (+0) |
| `TentativaEmAndamento` | `InFlightAttempt` | interface (não exportada) | `apps/worker/src/executor.ts` | 1 (+0) |
| `RenovacaoDaVaga` | `SlotRenewal` | classe (não exportada) | `apps/worker/src/executor.ts` | 1 (+0) |
| `DependenciasDoExecutor` | `JobExecutorDependencies` | interface | `apps/worker/src/executor.ts` | 4 (+0) |
| `processadores/ (pasta)` | `processors/` | pasta | `apps/worker/src/processadores/` | 14 (+2) |
| `sintetico.ts, sintetico.sandbox.ts, sintetico.test.ts` | `synthetic.ts, synthetic.sandbox.ts, synthetic.test.ts` | arquivo | `apps/worker/src/processadores/` | 3 (+0) |
| `criarProcessadorSintetico` | `createSyntheticProcessor` | função (fábrica do processor) | `apps/worker/src/processadores/sintetico.ts` | 4 (+0) |
| `SandboxDeCpu` | `CpuSandbox` | classe | `apps/worker/src/processadores/sintetico.ts` | 4 (+0) |
| `QueimaDeCpu` | `CpuBurner` | interface | `apps/worker/src/processadores/sintetico.ts` | 2 (+0) |
| `ARQUIVO_DO_SANDBOX` | `SANDBOX_FILE` | const | `apps/worker/src/processadores/sintetico.ts` | 1 (+0) |
| `agendamentos.ts` | `job-schedules.ts` | arquivo | `apps/worker/src/` | 10 (+2) |
| `Agendamento` | `JobSchedule` | interface | `apps/worker/src/agendamentos.ts` | 2 (+0) |
| `AGENDAMENTOS` | `JOB_SCHEDULES` | const | `apps/worker/src/agendamentos.ts` | 4 (+1) |
| `TipoAgendado` | `ScheduledJobType` | type | `apps/worker/src/agendamentos.ts` | 1 (+0) |
| `registrarAgendamentos` | `registerJobSchedulers` | função | `apps/worker/src/agendamentos.ts` | 3 (+0) |
| `criarDisparoDeAgendamento` | `createScheduleProcessor` | função (fábrica do processor do scheduler) | `apps/worker/src/agendamentos.ts` | 3 (+0) |
| `FILA_DOS_AGENDAMENTOS` | `SCHEDULES_QUEUE` | const (o valor 'agendamentos' não muda) | `apps/worker/src/agendamentos.ts` | 4 (+0) |
| `FUSO_DOS_AGENDAMENTOS / TENTATIVAS_DO_DISPARO` | `SCHEDULE_TIMEZONE / SCHEDULE_ATTEMPTS` | consts | `apps/worker/src/agendamentos.ts` | 2 (+0) |
| `CicloDoWorker` | `WorkerLifecycle` | classe (não exportada) | `apps/worker/src/app.module.ts` | 1 (+0) |
| `MedidorDeStorage` | `StorageSizeReader` | classe (soma bytes por escola listando objetos) | `apps/worker/src/storage/medidor-de-storage.ts` | 5 (+0) |
| `medidor-de-storage.ts` | `storage-size-reader.ts` | arquivo | `apps/worker/src/storage/` | 4 (+1) |

### Montagem e bootstrap

**Regra do grupo:** `montar*` vira `create*` (fábrica), `*Montado` vira `*Runtime`, `montagem.ts` vira `composition.ts` (composition root); `Configuracao*` vira `*Config`, `lerConfiguracao` vira `loadConfig` (adenda 3).

| Atual | Proposto | Tipo | Onde (caminho) | Usos (arquivos de código, +docs) |
|---|---|---|---|---|
| `montagem.ts (worker)` | `composition.ts` | arquivo | `apps/worker/src/` | 17 (+2) |
| `montarWorker` | `createWorker` | função (fábrica) | `apps/worker/src/montagem.ts` | 11 (+1) |
| `WorkerMontado` | `WorkerRuntime` | interface | `apps/worker/src/montagem.ts` | 5 (+0) |
| `montarProcessadores` | `createProcessors` | função (fábrica) | `apps/worker/src/montagem.ts` | 2 (+0) |
| `ProcessadoresMontados / PecasDosProcessadores` | `ProcessorSet / ProcessorParts` | interfaces | `apps/worker/src/montagem.ts` | 1 (+0) |
| `montarRotinas` | `createRoutines` | função (não exportada) | `apps/worker/src/montagem.ts` | 1 (+0) |
| `OpcoesDaMontagem (worker)` | `CreateWorkerOptions` | interface | `apps/worker/src/montagem.ts` | 3 (+0) |
| `GRACA_DO_DESLIGAMENTO_MS` | `SHUTDOWN_GRACE_MS` | const | `apps/worker/src/montagem.ts` | 3 (+0) |
| `montagem.ts (despachante)` | `composition.ts` | arquivo | `apps/despachante/src/` | 4 (+0) |
| `montarDespachante` | `createOutboxRelay` | função (fábrica) | `apps/despachante/src/montagem.ts` | 4 (+0) |
| `DespachanteMontado` | `OutboxRelayRuntime` | interface | `apps/despachante/src/montagem.ts` | 4 (+0) |
| `OpcoesDaMontagem (despachante)` | `CreateOutboxRelayOptions` | interface | `apps/despachante/src/montagem.ts` | 3 (+0) |
| `CicloDoDespachante` | `OutboxRelayLifecycle` | classe (não exportada) | `apps/despachante/src/app.module.ts` | 1 (+0) |
| `criarAplicacaoRealtime` | `createRealtimeApp` | função (fábrica) | `apps/realtime/src/configurar-app.ts` | 3 (+0) |
| `configurar-app.ts (realtime)` | `configure-app.ts` | arquivo | `apps/realtime/src/` | 24 (+0) |
| `ConfiguracaoWorker / ConfiguracaoStorage` | `WorkerConfig / StorageConfig` | interfaces | `apps/worker/src/config.ts` | 3 (+0) |
| `ConfiguracaoDespachante` | `DespachanteConfig` | interface | `apps/despachante/src/config.ts` | 3 (+0) |
| `ConfiguracaoRealtime` | `RealtimeConfig` | interface | `apps/realtime/src/config.ts` | 4 (+0) |
| `ConfiguracaoApi` | `ApiConfig` | interface | `apps/api/src/config.ts` | 5 (+0) |
| `lerConfiguracao (4 apps)` | `loadConfig` (adenda 3) | função (config.ts de api, worker, despachante, realtime) | `apps/*/src/config.ts` | 16 (+0) |

### Medição e métricas

**Regra do grupo:** `Medicao*` vira `*Gauge` (são gauges observáveis do OpenTelemetry); `Medidor` do OTel (`Meter`) é de `packages/`. Nome de métrica não muda.

| Atual | Proposto | Tipo | Onde (caminho) | Usos (arquivos de código, +docs) |
|---|---|---|---|---|
| `MedicaoPorEscola` | `EscolaGauge` | classe abstrata | `apps/worker/src/medicao-por-escola.ts` | 6 (+0) |
| `medicao-por-escola.ts` | `escola-gauge.ts` | arquivo | `apps/worker/src/` | 5 (+0) |
| `DependenciasDaMedicaoPorEscola / DescricaoDaMedicaoPorEscola` | `EscolaGaugeDependencies / EscolaGaugeDescription` | interfaces | `apps/worker/src/medicao-por-escola.ts` | 1 (+0) |
| `INTERVALO_DA_MEDICAO_POR_ESCOLA_MS` | `ESCOLA_GAUGE_INTERVAL_MS` | const | `apps/worker/src/medicao-por-escola.ts` | 1 (+0) |
| `MedicaoDoIncidente (+ DependenciasDaMedicaoDoIncidente)` | `IncidenteGauge (+ IncidenteGaugeDependencies)` | classe | `apps/worker/src/medicao-do-incidente.ts` | 3 (+0) |
| `MedicaoDoExpurgo (+ DependenciasDaMedicaoDoExpurgo)` | `ExpurgoGauge (+ ExpurgoGaugeDependencies)` | classe | `apps/worker/src/medicao-do-expurgo.ts` | 3 (+0) |
| `MedicaoDoArquivo (+ DependenciasDaMedicaoDoArquivo)` | `ArquivoGauge (+ ArquivoGaugeDependencies)` | classe | `apps/worker/src/medicao-do-arquivo.ts` | 3 (+0) |
| `MedicaoDaEliminacao (+ DependenciasDaMedicaoDaEliminacao)` | `EliminacaoGauge (+ EliminacaoGaugeDependencies)` | classe | `apps/worker/src/medicao-da-eliminacao.ts` | 3 (+0) |
| `medicao-do-incidente.ts, medicao-do-expurgo.ts, medicao-do-arquivo.ts, medicao-da-eliminacao.ts` | `incidente-gauge.ts, expurgo-gauge.ts, arquivo-gauge.ts, eliminacao-gauge.ts` | arquivos | `apps/worker/src/` | 3 (+0) |
| `MedicaoDaFila` | `QueueGauge` | classe | `apps/despachante/src/metricas-espera.ts` | 4 (+0) |
| `DependenciasDaMedicao / OpcoesDaMedicao` | `QueueGaugeDependencies / QueueGaugeOptions` | interfaces | `apps/despachante/src/metricas-espera.ts` | 1 (+0) |
| `SerieDaFila` | `QueueSeries` | interface | `apps/despachante/src/metricas-espera.ts` | 1 (+0) |
| `metricas-espera.ts` | `queue-gauge.ts` | arquivo | `apps/despachante/src/` | 3 (+1) |

### Despachante (classes e arquivos de dentro)

**Regra do grupo:** O app e o pacote `@educa/despachante` ficam. Dentro dele, a classe vira o padrão que ela implementa (outbox relay / sweeper / job publisher) segundo o guia §9.

| Atual | Proposto | Tipo | Onde (caminho) | Usos (arquivos de código, +docs) |
|---|---|---|---|---|
| `Despachante` | `OutboxRelay` | classe | `apps/despachante/src/despachante.ts` | 13 (+0) |
| `despachante.ts, despachante.test.ts` | `outbox-relay.ts, outbox-relay.test.ts` | arquivo | `apps/despachante/src/` | 4 (+0) |
| `DependenciasDoDespachante / DependenciasDaPublicacao / OpcoesDoDespachante` | `OutboxRelayDependencies / PublishDependencies / OutboxRelayOptions` | interfaces | `apps/despachante/src/despachante.ts` | 2 (+0) |
| `Reconciliacao` | `OutboxSweeper` | classe | `apps/despachante/src/reconciliacao.ts` | 4 (+1) |
| `DependenciasDaReconciliacao / OpcoesDaReconciliacao / ResultadoDaReconciliacao` | `OutboxSweeperDependencies / OutboxSweeperOptions / SweepResult` | interfaces | `apps/despachante/src/reconciliacao.ts` | 1 (+0) |
| `reconciliacao.ts` | `outbox-sweeper.ts` | arquivo | `apps/despachante/src/` | 1 (+0) |
| `FilaDePublicacao` | `JobPublisher` | interface | `apps/despachante/src/fila-de-publicacao.ts` | 4 (+0) |
| `PublicacaoBullMQ` | `BullMQJobPublisher` | classe | `apps/despachante/src/fila-de-publicacao.ts` | 4 (+0) |
| `FilaBullMQ` | `BullMQQueue` | interface (a fatia da Queue que se usa) | `apps/despachante/src/fila-de-publicacao.ts` | 2 (+0) |
| `SituacaoNaFila` | `QueuedJobState` | type | `apps/despachante/src/fila-de-publicacao.ts` | 1 (+0) |
| `fila-de-publicacao.ts` | `job-publisher.ts` | arquivo | `apps/despachante/src/` | 5 (+0) |
| `publicarComVaga` | `publishWithSlot` | função (helper exportado) | `apps/despachante/src/despachante.ts` | 2 (+0) |

### Realtime

**Regra do grupo:** O namespace `/sistema` do Socket.IO, o prefixo Redis `realtime` e os eventos não mudam; só classe, arquivo e token.

| Atual | Proposto | Tipo | Onde (caminho) | Usos (arquivos de código, +docs) |
|---|---|---|---|---|
| `SistemaGateway` | `SystemGateway` | gateway | `apps/realtime/src/sistema.gateway.ts` | 2 (+0) |
| `sistema.gateway.ts` | `system.gateway.ts` | arquivo | `apps/realtime/src/` | 3 (+0) |
| `ProntidaoController (realtime)` | `ReadinessController` | controller | `apps/realtime/src/prontidao.controller.ts` | 4 (+1) |
| `prontidao.controller.ts (realtime)` | `readiness.controller.ts` | arquivo | `apps/realtime/src/` | 2 (+0) |
| `AdaptadorSocketIoComRedis` | `RedisIoAdapter` | classe (nome do exemplo da doc do Nest) | `apps/realtime/src/adaptador-redis.ts` | 2 (+0) |
| `adaptador-redis.ts` | `redis-adapter.ts` | arquivo | `apps/realtime/src/` | 3 (+0) |
| `criarAdaptadorRedis / criarClienteRedisDoRealtime / prepararServidorRealtime` | `createRedisAdapter / createRealtimeRedisClient / prepareRealtimeServer` | funções (fábricas) | `apps/realtime/src/adaptador-redis.ts` | 1 (+0) |
| `OPCOES_DO_SERVIDOR_REALTIME / PREFIXO_REDIS_REALTIME` | `REALTIME_SERVER_OPTIONS / REALTIME_REDIS_PREFIX` | consts (o valor 'realtime' não muda) | `apps/realtime/src/adaptador-redis.ts` | 1 (+0) |
| `autenticacao-do-handshake.ts` | `handshake-auth.ts` | arquivo | `apps/realtime/src/` | 2 (+0) |
| `autenticacaoDoHandshake` | `handshakeAuth` | função (middleware do Socket.IO) | `apps/realtime/src/autenticacao-do-handshake.ts` | 2 (+0) |
| `DadosDoSocket / SocketRealtime` | `SocketData / RealtimeSocket` | tipos | `apps/realtime/src/autenticacao-do-handshake.ts` | 1 (+0) |
| `CONFIGURACAO_IDENTIDADE` | `IDENTITY_CONFIG` | token DI | `apps/realtime/src/sistema.gateway.ts` | 2 (+0) |
| `LEITURA_DE_SESSAO` | `SESSAO_READER` | token DI | `apps/realtime/src/sistema.gateway.ts` | 2 (+0) |
| `LOGGER_REALTIME` | `REALTIME_LOGGER` | token DI | `apps/realtime/src/sistema.gateway.ts` | 2 (+0) |
| `CLIENTE_REDIS_REALTIME` | `REALTIME_REDIS_CLIENT` | token DI | `apps/realtime/src/app.module.ts` | 1 (+0) |
| `POOL_BANCO_REALTIME` | `REALTIME_DB_POOL` | token DI | `apps/realtime/src/app.module.ts` | 1 (+0) |
| `salaDaEscola` | `escolaRoom` | função (nome da room do Socket.IO) | `apps/realtime/src/sistema.gateway.ts` | 3 (+0) |

### Comandos de terminal (ops/)

**Regra do grupo:** A pasta `ops/` e os scripts `ops:*` ficam; só os arquivos de infraestrutura do comando (`comando`, `migrar`, `sessao-sintetica`) e as classes técnicas. Os verbos `executarOps*` e `lerPedido*` ficam.

| Atual | Proposto | Tipo | Onde (caminho) | Usos (arquivos de código, +docs) |
|---|---|---|---|---|
| `comando.ts` | `command.ts` | arquivo | `apps/api/src/ops/` | 4 (+0) |
| `SaidaDoComando / BancoDoComando / PedidoDoComando` | `CommandOutput / CommandDatabase / CommandRequest` | interfaces (duplicadas em comando.ts e sessao-sintetica.ts) | `apps/api/src/ops/comando.ts` | 16 (+0) |
| `migrar.ts` | fica (ponto de entrada chamado pelo compose de produção; adenda 1 do `inventario.md`) | arquivo (o compose chama dist/ops/migrar.js) | `apps/api/src/ops/migrar.ts` | 1 (+0) |
| `sessao-sintetica.ts` | fica (ponto de entrada do `ops:sessao-sintetica`; adenda 1 do `inventario.md`) | arquivo | `apps/api/src/ops/` | 2 (+0) |

### Padrão de nome: Dependencias*, Opcoes*, Configuracao*

**Regra do grupo:** `DependenciasDoX` vira `XDependencies`, `OpcoesDoX` vira `XOptions`, `ConfiguracaoX` vira `XConfig`; o `X` segue o que ele mesmo virar neste inventário (por isso aparece `Refresh`, `LoginCompletion`).

| Atual | Proposto | Tipo | Onde (caminho) | Usos (arquivos de código, +docs) |
|---|---|---|---|---|
| `DependenciasDaSessaoDoOperador` | `SessaoDoOperadorDependencies` | interface | `apps/api/src/operacao/sessao/sessao.service.ts` | 1 (+0) |
| `DependenciasDaEntrada` | `EntradaDependencies` | interface | `apps/api/src/operacao/entrada/entrada.service.ts` | 1 (+0) |
| `DependenciasDoSegundoFator` | `OperadorMfaDependencies` | interface | `apps/api/src/operacao/segundo-fator/segundo-fator.service.ts` | 1 (+0) |
| `DependenciasDoConviteDeOperador` | `ConviteDeOperadorDependencies` | interface | `apps/api/src/operacao/convite/convite-operador.service.ts` | 1 (+0) |
| `DependenciasDaConclusao` | `LoginCompletionDependencies` | interface | `apps/api/src/sessao/conclusao/conclusao-de-login.ts` | 1 (+0) |
| `DependenciasDaRenovacao` | `RefreshDependencies` | interface | `apps/api/src/sessao/renovacao/renovacao.service.ts` | 1 (+0) |
| `DependenciasDoLoginExterno` | `ExternalLoginDependencies` | interface | `apps/api/src/sessao/externa/externa.service.ts` | 1 (+0) |
| `DependenciasDoConvite` | `ConviteDependencies` | interface | `apps/api/src/sessao/convite/convite.service.ts` | 2 (+0) |
| `DependenciasDaTroca` | `TrocaDeEscolaDependencies` | interface | `apps/api/src/sessao/troca-de-escola/troca-de-escola.service.ts` | 1 (+0) |
| `DependenciasDoMfa` | `MfaDependencies` | interface | `apps/api/src/sessao/mfa/mfa.service.ts` | 1 (+0) |
| `DependenciasDoLoginPorMatricula` | `LoginPorMatriculaDependencies` | interface | `apps/api/src/sessao/login/matricula.service.ts` | 1 (+0) |
| `DependenciasDoLogin` | `LoginDependencies` | interface | `apps/api/src/sessao/login/login.service.ts` | 3 (+0) |
| `DependenciasDoMaterial` | `MaterialDependencies` | interface | `apps/api/src/material/material.service.ts` | 1 (+0) |
| `DependenciasDaReivindicacao` | `ReivindicacaoDependencies` | interface | `apps/api/src/sala/reivindicacao/reivindicacao.service.ts` | 1 (+0) |
| `DependenciasDoPrivacidadeService` | `PrivacidadeServiceDependencies` | interface | `apps/api/src/privacidade/privacidade.service.ts` | 1 (+0) |
| `DependenciasDaConsolidacao` | `UsageConsolidationDependencies` | interface | `apps/worker/src/processadores/consolidar-uso.ts` | 1 (+0) |
| `DependenciasDoExpurgoDaEscola` | `ExpurgoDaEscolaDependencies` | interface | `apps/worker/src/processadores/expurgar-escola.ts` | 1 (+0) |
| `DependenciasDoExpurgoDeAcesso` | `ExpurgoDeAcessoDependencies` | interface | `apps/worker/src/processadores/expurgar-acesso.ts` | 1 (+0) |
| `DependenciasDoExpurgo` | `ExpurgoDeJobsDependencies` | interface | `apps/worker/src/processadores/expurgar-jobs.ts` | 3 (+0) |
| `DependenciasDaMontagemDoArquivo` | `MontarArquivoDependencies` | interface | `apps/worker/src/processadores/montar-arquivo.ts` | 1 (+0) |
| `DependenciasDaRotinaDeExpurgo` | `ExpurgoRoutineDependencies` | interface | `apps/worker/src/processadores/expurgar-dado-pessoal.ts` | 1 (+0) |
| `DependenciasDaEliminacaoDoTitular` | `EliminacaoDoTitularDependencies` | interface | `apps/worker/src/processadores/eliminar-titular.ts` | 1 (+0) |
| `OpcoesDoModuloDaOperacao` | `OperacaoModuleOptions` | interface | `apps/api/src/operacao/operacao.module.ts` | 1 (+0) |
| `OpcoesDoModuloDeSessao` | `SessaoModuleOptions` | interface | `apps/api/src/sessao/sessao.module.ts` | 1 (+0) |
| `OpcoesDaSala` | `SalaModuleOptions` | interface | `apps/api/src/sala/sala.module.ts` | 1 (+0) |
| `OpcoesDaPrivacidade` | `PrivacidadeModuleOptions` | interface | `apps/api/src/privacidade/privacidade.module.ts` | 1 (+0) |
| `OpcoesDoAssistente` | `AssistenteModuleOptions` | interface | `apps/api/src/assistente/assistente.module.ts` | 1 (+0) |
| `OpcoesDoModuloDeIa` | `IaModuleOptions` | interface | `apps/api/src/ia/ia.module.ts` | 1 (+0) |
| `OpcoesDoPdf` | `PdfOptions` | interface | `apps/api/src/artefato/pdf-do-artefato.ts` | 1 (+0) |
| `ConfiguracaoSala` | `SalaConfig` | interface | `apps/api/src/sala/configuracao-da-sala.ts` | 4 (+0) |
| `ConfiguracaoDoArmazemDaApi` | `FileStorageApiConfig (depende da renomeação de ArmazemDeArquivos em nucleo)` | interface | `apps/api/src/privacidade/configuracao-do-armazem.ts` | 3 (+0) |
| `configuracao-do-armazem.ts, configuracao-da-sala.ts` | `file-storage-config.ts, sala-config.ts` | arquivos | `apps/api/src/privacidade/, apps/api/src/sala/` | 2 (+0) |

### Helpers de teste (peças e arquivos)

**Regra do grupo:** Helper de teste: `Bancada*` vira `*Fixtures`; `*-de-teste.ts` vira `*.fixture.ts` com o domínio na frente; nome de função verbal (`subirApi`, `esperarErro`) fica.

| Atual | Proposto | Tipo | Onde (caminho) | Usos (arquivos de código, +docs) |
|---|---|---|---|---|
| `BancadaDeSessoes` | `SessaoFixtures` | classe (test fixture builder) | `apps/api/test/sessao-de-teste.ts` | 100 (+1) |
| `BancadaDeOperadores` | `OperadorFixtures` | classe | `apps/api/test/sessao-de-operador.ts` | 12 (+0) |
| `BancadaDeFila` | `QueueFixtures` | classe | `apps/worker/test/fila-de-teste.ts` | 21 (+0) |
| `OPERADOR_DA_BANCADA` | `FIXTURES_OPERADOR` | const | `apps/worker/test/fila-de-teste.ts` | 1 (+0) |
| `PedidoDaBancada` | `FixtureRequest` | interface | `apps/worker/test/fila-de-teste.ts` | 1 (+0) |
| `LogEmMemoria` | `InMemoryLog` | classe | `apps/worker/test/fila-de-teste.ts` | 20 (+0) |
| `fila-de-teste.ts` | `queue.fixture.ts` | arquivo | `apps/worker/test/` | 23 (+0) |
| `execucao-do-job.ts (execucaoDoJob)` | `job-execution.fixture.ts (jobExecution)` | arquivo / função | `apps/worker/test/` | 7 (+0) |
| `ModeloDeMentira / subirModeloDeMentira / ambienteDoModeloDeMentira` | `FakeModel / startFakeModel / fakeModelEnv` | classe / funções | `apps/api/test/escola-com-tutor.ts` | 2 (+0) |
| `GatilhoDeParada` | `WriteBlockTrigger` | classe (trigger de banco que segura a escrita) | `apps/api/test/gatilho-de-parada.ts` | 17 (+4) |
| `gatilho-de-parada.ts` | `write-block-trigger.ts` | arquivo | `apps/api/test/` | 21 (+1) |
| `CapturaDeDadoPessoal` | `PersonalDataCapture` | classe | `apps/api/test/captura-de-dado-pessoal.ts` | 3 (+0) |
| `captura-de-dado-pessoal.ts` | `personal-data-capture.ts` | arquivo | `apps/api/test/` | 2 (+0) |
| `ApiDeTeste` | `TestApi` | interface | `apps/api/test/api-com-sessao.ts` | 59 (+0) |
| `api-com-sessao.ts` | `test-api.ts` | arquivo | `apps/api/test/` | 64 (+1) |
| `configuracao-de-teste.ts` | `test-config.ts` | arquivo | `apps/api/test/` | 32 (+0) |
| `MONTAGEM_DE_TESTE / SobreposicaoDeTeste / configuracaoDeTeste` | `TEST_APP_OPTIONS / TestOverrides / testConfig` | const / tipo / função | `apps/api/test/configuracao-de-teste.ts` | 15 (+1) |
| `sessao-de-teste.ts` | `sessao.fixture.ts` | arquivo | `apps/api/test/` | 102 (+1) |
| `SessaoDeTeste / OpcoesDeSessao` | `TestSessao / SessaoFixtureOptions` | interfaces | `apps/api/test/sessao-de-teste.ts` | 56 (+0) |
| `sessao-de-operador.ts` | `operador-session.fixture.ts` | arquivo | `apps/api/test/` | 1 (+0) |
| `SessaoDeOperadorDeTeste` | `TestOperadorSessao` | interface | `apps/api/test/sessao-de-operador.ts` | 5 (+0) |
| `segundo-fator-de-operador.ts` | `operador-mfa.fixture.ts` | arquivo | `apps/api/test/` | 8 (+0) |
| `ativacao-de-teste.ts` | `ativacao.fixture.ts` | arquivo | `apps/api/test/` | 2 (+0) |
| `CenarioDeAtivacao / ContaDeTeste / ConviteDeTeste` | `ActivationScenario / TestConta / TestConvite` | interfaces | `apps/api/test/ativacao-de-teste.ts` | 3 (+0) |
| `atividade-de-teste.ts` | `atividade.fixture.ts` | arquivo | `apps/api/test/` | 6 (+1) |
| `OpcoesDoArtefatoDeTeste / OpcoesDaAplicacao` | `TestArtefatoOptions / AplicacaoOptions` | interfaces | `apps/api/test/atividade-de-teste.ts, escola-com-tutor.ts` | 1 (+0) |
| `material-de-teste.ts` | `material.fixture.ts` | arquivo | `apps/api/test/` | 6 (+0) |
| `OpcoesDoEnvio / CamposDoEnvio` | `UploadOptions / UploadFields` | interfaces | `apps/api/test/material-de-teste.ts` | 1 (+0) |
| `painel-de-teste.ts` | `painel.fixture.ts` | arquivo | `apps/api/test/` | 6 (+0) |
| `sala-de-teste.ts` | `sala.fixture.ts` | arquivo | `apps/api/test/` | 10 (+0) |
| `SalaDeTeste / OpcoesDoPedido` | `TestSala / SalaRequestOptions` | interfaces | `apps/api/test/sala-de-teste.ts` | 12 (+0) |
| `escola-com-turma.ts, escola-com-assistente.ts, escola-com-tutor.ts` | `escola-turma.fixture.ts, escola-assistente.fixture.ts, escola-tutor.fixture.ts` | arquivos | `apps/api/test/` | 19 (+0) |
| `trava-da-escola.ts` | `escola-lock.ts` | arquivo | `apps/api/test/` | 4 (+0) |
| `texto-adulterado.ts, texto-adulterado.test.ts` | `tampered-text.ts, tampered-text.test.ts` | arquivos | `apps/api/test/` | 2 (+0) |
| `rotas-registradas.ts` | `registered-routes.ts` | arquivo | `apps/api/test/` | 6 (+0) |
| `RotaRegistrada` | `RegisteredRoute` | interface | `apps/api/test/rotas-registradas.ts` | 4 (+0) |
| `realtime-de-teste.ts` | `realtime.fixture.ts` | arquivo | `apps/realtime/test/` | 3 (+0) |
| `InstanciaDeTeste / OpcoesDeConexao` | `TestInstance / ConnectionOptions` | interfaces | `apps/realtime/test/realtime-de-teste.ts` | 3 (+0) |

### Arquivos de teste de assunto técnico

**Regra do grupo:** Arquivo de teste de unidade acompanha o arquivo que testa; aqui estão os de integração cujo assunto é peça técnica e o nome está em português. Teste de assunto de domínio (`convite`, `turma`, `ops-*`) fica.

| Atual | Proposto | Tipo | Onde (caminho) | Usos (arquivos de código, +docs) |
|---|---|---|---|---|
| `arquitetura.test.ts` | `architecture.test.ts` | arquivo | `apps/api/test/` | 8 (+4) |
| `contratos.test.ts` | `contracts.test.ts` | arquivo | `apps/api/test/` | 1 (+2) |
| `contexto.int.test.ts` | `context.int.test.ts` | arquivo | `apps/api/test/` | 0 (+0) |
| `erro.int.test.ts` | `error.int.test.ts` | arquivo | `apps/api/test/` | 0 (+1) |
| `estado-avisos.int.test.ts` | `status-notices.int.test.ts` | arquivo | `apps/api/test/` | 0 (+0) |
| `saude.int.test.ts, prontidao.int.test.ts` | `health.int.test.ts, readiness.int.test.ts` | arquivos | `apps/api/test/` | 0 (+0) |
| `limite.int.test.ts` | `rate-limit.int.test.ts` | arquivo | `apps/api/test/` | 0 (+0) |
| `limites-da-sala.int.test.ts` | `sala-rate-limits.int.test.ts` | arquivo | `apps/api/test/` | 1 (+1) |
| `semaforo-de-login.int.test.ts` | `login-bulkhead.int.test.ts` | arquivo | `apps/api/test/` | 1 (+1) |
| `ataque-de-senha.int.test.ts` | `password-attack.int.test.ts` | arquivo | `apps/api/test/` | 2 (+1) |
| `renovacao.int.test.ts, saida.int.test.ts` | `refresh.int.test.ts, logout.int.test.ts` | arquivos | `apps/api/test/` | 0 (+0) |
| `sessao-externa.int.test.ts, sessao-guarda.int.test.ts` | `external-login.int.test.ts, sessao-guard.int.test.ts` | arquivos | `apps/api/test/` | 0 (+1) |
| `segundo-fator-operador.int.test.ts, segundo-fator-operador-concorrencia.int.test.ts` | `operador-mfa.int.test.ts, operador-mfa-concurrency.int.test.ts` | arquivos | `apps/api/test/` | 0 (+0) |
| `jobs-sinteticos.int.test.ts` | `synthetic-jobs.int.test.ts` | arquivo | `apps/api/test/` | 0 (+0) |
| `permissao-no-boot.test.ts` | `permissao-boot-check.test.ts` | arquivo | `apps/api/test/` | 0 (+0) |
| `borda-de-entrada.int.test.ts, borda-de-entrada-sessao.int.test.ts, borda-de-entrada-ultimos-modulos.int.test.ts` | `input-boundary.int.test.ts, input-boundary-sessao.int.test.ts, input-boundary-late-modules.int.test.ts` | arquivos (citados em .claude/rules/10 e 20) | `apps/api/test/` | 0 (+2) |
| `ativacao-sob-trava.int.test.ts` | `ativacao-under-lock.int.test.ts` | arquivo | `apps/api/test/` | 2 (+0) |
| `executor.test.ts, montagem.test.ts, desligamento.test.ts (worker)` | `job-executor.test.ts, composition.test.ts, shutdown.test.ts` | arquivos | `apps/worker/src/` | 1 (+0) |
| `bancada.int.test.ts, esperar-o-redis.test.ts, execucao.int.test.ts, reexecucao.int.test.ts, prazo-do-job.int.test.ts (worker)` | `queue-fixtures.int.test.ts, wait-for-redis.test.ts, job-execution.int.test.ts, job-reexecution.int.test.ts, job-timeout.int.test.ts` | arquivos | `apps/worker/test/` | 0 (+0) |
| `medicao-da-eliminacao.int.test.ts, medicao-do-arquivo.int.test.ts, medicao-do-incidente.int.test.ts (worker)` | `eliminacao-gauge.int.test.ts, arquivo-gauge.int.test.ts, incidente-gauge.int.test.ts` | arquivos | `apps/worker/test/` | 0 (+0) |
| `metricas-espera.int.test.ts, pronto-do-redis.int.test.ts, reconciliacao.int.test.ts, redis-fora.int.test.ts, vagas.int.test.ts (despachante)` | `queue-gauge.int.test.ts, redis-ready.int.test.ts, outbox-sweeper.int.test.ts, redis-down.int.test.ts, slots.int.test.ts` | arquivos | `apps/despachante/test/` | 1 (+2) |
| `metricas.int.test.ts, sistema.int.test.ts (realtime)` | `metrics.int.test.ts, system.int.test.ts` | arquivos | `apps/realtime/test/` | 1 (+1) |

### Camada de IA da API (achado na consolidação)

**Regra do grupo:** a mesma do núcleo: o domínio (`Execucao`, `Usuario`) fica, o termo técnico vai para inglês.

| Atual | Proposto | Tipo | Onde (caminho) | Usos |
|---|---|---|---|---|
| `AgendadorDeExecucoes` | `ExecucaoScheduler` | classe (comando assíncrono idempotente, 202) | `apps/api/src/ia/agendador-de-execucoes.ts` | a contar na Tech Spec |
| `PedidoDeExecucao` | `ExecucaoRequest` | interface | `apps/api/src/ia/agendador-de-execucoes.ts` | a contar |
| `agendador-de-execucoes.ts` | `execucao.scheduler.ts` | arquivo | `apps/api/src/ia/` | a contar |
| `exigirUsuarioDoContexto` | `requireUsuarioId` | função | `apps/api/src/ia/contexto-da-execucao.ts` | a contar |
| `contexto-da-execucao.ts` | `execucao-context.ts` | arquivo | `apps/api/src/ia/` | a contar |

## Peças de `packages/` que este escopo importa (para o outro agente e para a ordem do rename)

Não são do meu escopo, mas o rename delas toca estes apps. Entre parênteses, quantos arquivos de `apps/{api,worker,despachante,realtime}` as importam hoje de `@educa/nucleo` ou `@educa/shared`:

`Banco` (150), `TransacaoBanco` (61), `PoolBanco` (22), `criarBanco` (20), `criarPool` (23), `ConfiguracaoBanco` (7); `CodigoDeErro` (162), `ErroDeDominio` (94), `ErroDeInvariante` (44), `ErroDeIa` (9), `ConfiguracaoInvalida` (25); `Relogio` (45); `executarNoContexto` (82), `exigirEscolaDoContexto` (51), `ContextoDaRequisicao` (8); `Permite` (40), `RotaAnonima` (18), `SemEscopo` (7), `SemLimite` (1), `LimiteQueRebaixa` (5); `RegistroDeAuditoria` (26); `ConfiguracaoOperacional(Repository)` (14 e 7), `ProxiesConfiaveis` (13), `LimitadorDeRequisicoes` (7), `ContadorDeUso` (7), `Drenagem` (6), `Batimento` (6), `Enfileirador` (10), `DespachoRepository` (8), `JobRegistroRepository` (7), `RegistroDeJobs` (9), `VagasPorEscola` (7), `VagasPorFila` (6), `OuvinteDeJobs` (1), `ExecutorNoProcesso` (10), `ExecutorDeAgente` (4), `ExecutorDeJob` (2), `ArmazemDeArquivos` (7), `ArmazemEmMemoria` (6), `ArmazemS3` (3), `GuardaDeAutenticacao/Limite/Sessao/Permissao` (1 a 2 cada), `FiltroGlobalDeErro` (2), `InterceptorDeUso` (1), `ConferenciaDasPermissoes` (2), `LoggerBase`/`LoggerDoNest`, `resumirErro` (23), `criarClienteRedisDaApi` (7), `criarClienteRedisDaFila` (7), `nomeDaFilaBullMQ` (9), `observarRedis`, `observarPoolDoBanco`, `observarSeguroDoLimite`, `registrarErrosDoProcesso`, `lerConfiguracao*`, `Configuracao*` (Banco, Identidade, Telemetria, Drenagem, Limite, DeIa), `middlewareDeContexto`, `middlewareDeMetricasHttp`, `METADADO_ROTA_DE_OPERACAO`, `METADADO_ENTRADA_DE_OPERACAO`.

Equivalentes de mercado desses (guia §9), para alinhar com os daqui: `Drenagem` = graceful shutdown, `Batimento` = heartbeat, `FiltroGlobalDeErro` = global exception filter, `Guarda*` = guards, `Enfileirador` = outbox, `LimitadorDeRequisicoes` = rate limiter.

Pares que precisam andar juntos com o que está neste inventário: `POOL_BANCO`/`BANCO` com `PoolBanco`/`Banco` (D14); `EXECUTOR_DE_AGENTE`/`ORCAMENTO_DE_IA`/`SUSPENSAO_DE_FUNCAO` com `ExecutorDeAgente` e a pasta `ia/` (D1); `ConfiguracaoDoArmazemDaApi` com `ArmazemDeArquivos`; `vagas.int.test.ts`, `AvisoDeVagaLivre`, `VagaDoJob`, `RenovacaoDaVaga` com `VagasPorEscola` (vaga = slot).

## Dúvidas

Fechadas em `inventario.md` §2. Onde a decisão de lá difere do que estava proposto, a tabela acima já traz o nome decidido.

## Não muda, mas parece

A peça muda de nome; a string gravada ou lida por fora **fica**:

| O quê | Onde está | Fica | Peça que muda perto |
|---|---|---|---|
| Rotas HTTP | `GET /saude`, `/prontidao`, `/v1/sistema/{estado,avisos,contexto,jobs-sinteticos}`, `/v1/eu`, `/v1/operacao/eu`, `DELETE /v1/sessao` (saída), `/v1/sessao/renovar`, `/v1/sessao/atividade`, `/v1/sessao/externa`, `/v1/conta/mfa` | iguais | os controllers `Saude`, `Prontidao`, `Estado`, `Eu`, `Saida`, `Renovacao`, `LoginExterno`, `SegundoFator...` |
| Chaves de permissão | `@Permite('sistema_contexto','ler')`, `'sistema_job_sintetico'`, `'sessao','registrar_atividade'` (matriz em `packages/shared`) | iguais | `ContextoController`, `JobsSinteticos*`, `AtividadeController` |
| Namespace e room do Socket.IO | `NAMESPACE_REALTIME_SISTEMA` (`/sistema`), room `escola:{id}`, prefixo Redis `realtime`, `connectionName` de Redis (`worker`, `worker-vagas`) | iguais | `SistemaGateway`, `salaDaEscola`, `PREFIXO_REDIS_REALTIME` |
| Nome de fila e de job | fila `agendamentos` (BullMQ), nomes de `nomeDaFilaBullMQ`, tipos `sistema.consolidar_uso`, `sistema.expurgar_*` (`TIPO_*` em `packages/shared`), `TIPO_JOB_SINTETICO` | iguais | `FILA_DOS_AGENDAMENTOS`, `AGENDAMENTOS`, `Processador`, `criarProcessadorSintetico` |
| Tabelas e colunas | `job_registro`, `sessao.refresh_hash`, `configuracao_operacional_escola`, `execucao_agente`, `autor_operador` | iguais | repositories e pastas `renovacao/`, `processadores/` |
| Eventos de log e nomes de `Logger` | `job.iniciado`, `worker.iniciado`, `despachante.vaga_indisponivel`, `limite.redis_indisponivel`, `uso.contador_indisponivel`, `login.rede_do_ip_sem_banco`, `agendamento.disparado`; `new Logger('banco'`, `'limite'`, `'uso'`, `'login')`; `servico: 'worker'` e `'migrar'` | iguais | `BancoModule`, `LimiteModule`, `UsoModule`, `FalhaDeJob`, `montarWorker` |
| Métricas Prometheus | `login.duracao`, `login.falhas`, `limite.seguro_ativo`, `operacao.entrada_falha`, `METRICAS.*` e o gauge de cada `Medicao*` | iguais | `DuracaoDoLogin`, `SeguroDoLogin`, `FalhasDeEntradaDaOperacao`, `Medicao*` |
| Variáveis de ambiente | `BANCO_URL`, `BANCO_TIMEOUT_CONEXAO_MS`, `MIGRAR_TIMEOUT_CONSULTA_MS`, `LOGIN_PROTECAO_DESLIGADA`, `LOGIN_REDIS_PRAZO_MS`, `LIMITE_*`, `OPERADOR` (nos `ops:*`) | iguais | `lerConfiguracao*`, `Configuracao*`, `esquemaAmbienteMigrar` |
| Códigos de erro e de falha de job | `NAO_ENCONTRADO`, `TEMPO_ESGOTADO`, `EXECUCAO_INTERROMPIDA`, `SESSAO_ENCERRADA`, `CONTA_SEGURADA`, `FUNCAO_SUSPENSA` | iguais | `FalhaDeJob`, `TempoEsgotado`, `ErroParaAFila`, `RenovacaoRecusada` |
| `name` do erro | `this.name = 'ArgumentoInvalido'`, `'FalhaDeJob'`, `'ErroParaAFila'`, `'PrazoDaFilaEsgotado'` | **muda junto com a classe** (o `name` acompanha o nome; aparece no log e na pilha que o BullMQ grava) | todas as classes de erro |
| JWT e Redis do login | `typ: 'desafio+jwt'` e `'convite+jwt'`, `aud: 'sessao'`, prefixo `desafio:usado:`, `rl:op:{sub}`, marca da leitura do lote | iguais | `EmissorDeDesafio`, `BilheteDeConvite`, `TIPO_BILHETE`, `LeituraDoLote` |
| Cookies | `educa_sessao`, `educa_dispositivo`, o do OIDC e os de operador | iguais | `COOKIE_SESSAO`, `COOKIE_DISPOSITIVO`, `CookieDeDispositivo` |
| Scripts e compose que citam arquivo | `package.json` raiz: `ops:sessao-sintetica` → `apps/api/dist/ops/sessao-sintetica.js`; `infra/compose.yml:123` e runbook: `dist/ops/migrar.js` (serviço `migrar`); o serviço e o pacote `@educa/despachante` | os **scripts** `ops:*` e o nome do serviço `migrar` ficam, mas o caminho do `.js` **muda** se `migrar.ts` e `sessao-sintetica.ts` forem renomeados: três arquivos fora de `apps/` a tocar | `ops/migrar.ts`, `ops/sessao-sintetica.ts` |
| Caminho de arquivo dentro de string | `ARQUIVO_DO_SANDBOX = new URL('./sintetico.sandbox.js', ...)` (worker); `tsconfig`, `knip.json` e `eslint.config.mjs` que citam pasta ou arquivo | o texto **tem de mudar junto** com o arquivo (não aparece como `import`) | `processadores/sintetico.sandbox.ts` e as pastas renomeadas |
| Caminhos citados em docs, regras e guardas | `.claude/rules/10` e `20` citam `apps/api/test/borda-de-entrada-ultimos-modulos.int.test.ts`, `contratos.test.ts` e `arquitetura.test.ts`; `tools/guardas/*` e `apps/api/test/arquitetura.test.ts` leem pastas por nome (`ops/`, `http/`, `operacao/`) | a regra escrita aponta para o arquivo: renomear o teste exige atualizar a rota na regra | arquivos de teste da lista acima; `tools/guardas/repositories-com-escopo.test.ts` |
| Description de `Symbol('X')` | `Symbol('POOL_BANCO')` etc. | muda junto com o `const` (sem efeito externo) | os tokens de DI |
| Nome de método que parece peça | `Despachante.acordar`, `ExecutorDeJobs.processar`, `AcessoDaSala.naSala`, `naEscolaSemUsuario`, `publicarComVaga` (função exportada), `contextoDaEscola`/`contextoDoJob` | ficam (verbo/helper) | a classe ou arquivo onde moram |
| Rótulo de métrica | `ROTULO_ESCOLA`, rótulo `escola_id`, `fila`, `metodo` | iguais | `BaldeDeLogin.rotulo`, `SerieDaFila` |

## Examinados e mantidos (nenhuma linha)

- **Pastas e arquivos**: `http/` (já é inglês; só `paginacao.ts` entra), `ops/` (nome de mercado; só `comando.ts`, `migrar.ts`, `sessao-sintetica.ts` entram), `config.ts`, `main.ts`, `app.module.ts`, `storage/` (worker), `src/`, `test/`; as pastas de domínio `artefato`, `assistente`, `atividade`, `entrega`, `estrutura`, `governanca`, `material`, `operacao`, `privacidade`, `professores`, `sala`, `sessao`, `tutor` e as subpastas `ano-letivo`, `disciplina`, `escola-sessao`, `lista`, `provedores-da-escola`, `serie`, `turma`, `vinculo`, `acesso-da-turma`, `decisao`, `minha-turma`, `reivindicacao`, `salas`, `minha-atividade`, `atividade-aplicada`, `correcao`, `desempenho`, `acesso-da-escola`, `convite`, `login`, `mfa`, `tenant`, `troca-de-escola`, `entrada`, `escola`, `operador`, `painel`.
- **Classes com prefixo de domínio**: `TurmaService`, `ConviteController`, `GovernancaRepository`, `TutorModule`, `ProfessoresRepository`, `AlunosAtivosRepository`, `AcessoDaTurma*`, `AtividadeAplicada*`, `SessaoDoOperador*`, `ConviteDeOperador*`, `PainelController`, `LoteController`, `FerramentasController`, `ListaLivreRepository`, `RedeEEscolaRepository`, `TitularesRepository`, `ContagensDePrivacidadeRepository`, `RegistroDeAcessoRepository` (registro de acesso do Marco Civil), `OrcamentoRepository`, `SuspensaoRepository`, `ConsumoRepository`, `ExecucaoRepository`, `AssistenteService`, `TrocaDeEscola*`, `MeusDadosController`, `MeusVinculosController`, `EscolaSessao*`, `LoginService`, `LoginEmailController`, `LoginMatriculaController`, `MfaService`, `ContaMfaController`, `SessaoMfaController`, `RedefinirMfaController`, `OpenIdClientAdapter`, `CookieOidc`, e as peças de domínio `LoginPorMatricula`, `EliminacaoDoTitular`, `RedefinicaoDeMfa`, `AcessoDaSala`, `PdfDoArtefato`, `RegistroDeAtividade` (ver D16).
- **Worker**: os `criar*` dos processadores (`criarExpurgoDeJobs`, `criarExpurgoDeAcesso`, `criarExpurgoDaEscola`, `criarRotinaDeExpurgo`, `criarEliminacaoDoTitular`, `criarMontagemDoArquivo`, `criarConsolidacaoDeUso`) e os arquivos `consolidar-uso.ts`, `eliminar-titular.ts`, `expurgar-*.ts`, `montar-arquivo.ts`: verbo + domínio, são o nome do tipo de job; `criarClienteS3`, `prefixoDaEscola`, `PREFIXO_DAS_ESCOLAS`.
- **Despachante**: `contextoDaEscola`, `contextoDoJob`, `esperaDoMaisAntigo`, `publicarComVaga` (helpers), `AppModule`.
- **Ops e realtime**: `executarOps*`, `lerPedido*`, `abrirBancoDeOperacao`, `urlDoBancoDeOperacao`, `criarArquivoDoToken`, `esquemaNome`, `lerOperador` (verbos e funções de comando); `cookie-de-operador.ts`, `token-do-convite.ts` (nome misto: `cookie` e `token` em inglês, domínio em português).
- **Credencial e sessão**: `cookies.ts`, `credencial-matricula.repository.ts`, `identificador-do-aluno.ts`, `registro-de-acesso.repository.ts`, `sessao-de-origem.repository.ts`, `sessao/index.ts`, `credencial/index.ts`, `redefinicao-de-mfa.ts`, `escola-sem-usuario.ts`, `acesso-da-sala.ts`, `codigo-da-sala.ts`, `entrada-da-sala.ts`, `convite-de-professor.service.ts`.
- **Tutor, atividade, material**: `sinais-do-turno.ts`, `supervisao.*`, `correcao-de-objetiva.ts`, `lote.ts`, `citacoes.ts`, `trecho-citado.ts`, `ferramentas.*`, `pdf-do-artefato.ts` (nome misto aceito).
- **Testes de domínio**: `convite*.int.test.ts`, `acesso-da-turma.int.test.ts`, `ops-*.int.test.ts`, `painel-*.int.test.ts`, `salas-*.int.test.ts`, `incidente`, `retencao`, `compartilhamento`, `historico`, `introducao`, `virada-do-ano`, `eliminacao-agendada`, `ciclo-de-vida`, `escola-montada` (varredura transversal das rotas da escola), `login-convite-revogado`, `pedido-titular`, `arquivo-do-titular`, `uso.int.test.ts`.

## Constantes (D4)

193 `export const NOME_EM_MAIUSCULAS` nos quatro apps (prazo, teto, prefixo, motivo e rótulo: `INTERVALO_SONDAGEM_MS`, `LOTE_DE_RESERVA`, `TETO_DA_ESPERA_DO_REDIS_MS`, `TENTATIVAS_DO_DISPARO`, `FALHAS_ANTES_DE_SEGURAR`, `MOTIVO_*`, `PREFIXO_*`, `JANELA_*`, `VALIDADE_*`, `TETO_*`, `MAXIMO_*`, `MINIMO_*`). As tabelas só incluem as que são token de DI, nome de cookie ou andam com uma peça renomeada. Se D4 pedir tradução geral, é uma varredura mecânica à parte; o risco é de merge, não de comportamento.

## Contagem

Total 383 linhas: 128 de arquivo ou pasta e 255 de classe, interface, token, função ou erro (várias agrupam 2 a 4 nomes irmãos; contando cada nome, cerca de 470).
