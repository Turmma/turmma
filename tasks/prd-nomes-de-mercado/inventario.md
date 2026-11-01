# Inventário — Nomes de mercado (X8)

**Status:** aprovado (Joaquim, 29/10/2026, no terminal do Arquiteto, junto com o PRD: "Aprovo os dois") (⛔)
**Levantado em:** 29/10/2026, sobre a `spec/nomes-de-mercado` em `06316e96`, só por leitura

Este documento traz as decisões, as regras e o que acompanha fora do código. As tabelas, uma linha por peça com o nome
atual, o nome novo, o tipo, o caminho e o número de usos, estão em três anexos:

| Anexo | Escopo | Linhas |
|---|---|---|
| `inventario-core-shared.md` | `packages/nucleo` (vira `packages/core`) e `packages/shared` | 916: 326 peças, 453 schemas e DTOs, 124 arquivos, 13 pastas |
| `inventario-back.md` | `apps/api`, `apps/worker`, `apps/despachante`, `apps/realtime` | 383, ou cerca de 470 nomes |
| `inventario-web-e2e.md` | `apps/web` e `e2e/` | 402: 317 peças, mais 85 consultas e chaves do TanStack Query |

São cerca de 1.700 linhas e 2.000 nomes. Onde uma linha tinha duas propostas, vale a que ficou na tabela. As dúvidas
das três varreduras estão fechadas na §2.

## 1. Regras de tradução

Valem para as três tabelas e para o código que vier depois. A guarda do RF8 usa os prefixos e sufixos da coluna da
esquerda.

| Português | Inglês | Exemplo |
|---|---|---|
| `Adaptador<X>` | `<X>Adapter` | `AdaptadorFalso` → `FakeAdapter`, `AdaptadorRoteirizado` → `ScriptedAdapter` |
| `<X>EmMemoria` | `InMemory<X>` | `ArmazemEmMemoria` → `InMemoryFileStorage` |
| `Guarda<X>` | `<X>Guard` | `GuardaDeAutenticacao` → `AuthGuard`, `GuardaDeSessao` → `SessaoGuard` |
| `Filtro<X>` | `<X>Filter` | `FiltroGlobalDeErro` → `AllExceptionsFilter` |
| `Interceptor<X>` | `<X>Interceptor` | `InterceptorDeUso` → `UsageInterceptor` |
| `Erro<X>`, `Falha<X>` | `<X>Exception` no erro de domínio e de invariante, como no NestJS e no Spring; `<X>Error` no erro de peça | `ErroDeDominio` → `DomainException`, `ErroDeInvariante` → `InvariantException`, `ErroDeIa` → `LLMError` |
| erro de recusa | sufixo `Error`, o termo técnico em inglês e o substantivo de domínio em português | `RenovacaoRecusada` → `RefreshRejectedError`, `OperadorRecusado` → `OperadorRejectedError`, `ArgumentoInvalido` → `InvalidArgumentError` |
| `Emissor<X>` | `<X>Issuer` | `EmissorDeToken` → `TokenIssuer` |
| `Armazem<X>` | `<X>FileStorage` | `ArmazemS3` → `S3FileStorage` |
| `Configuracao<X>`, `lerConfiguracao<X>` | `<X>Config`, `load<X>Config` | `ConfiguracaoBanco` → `DatabaseConfig` |
| `Opcoes<X>`, `Dependencias<X>` | `<X>Options`, `<X>Dependencies` | `OpcoesDoPool` → `WorkerPoolOptions` |
| `Linha<X>` (a linha lida ou gravada) | `<X>Row` | `LinhaDaSessao` → `SessaoRow` |
| `METADADO_<X>` | `<X>_KEY` | `METADADO_ROTA_ANONIMA` → `IS_PUBLIC_KEY` |
| `esquema<X>` (zod) | `<x>Schema` | `esquemaTurma` → `turmaSchema` |
| `Pedido<X>`, `Resposta<X>`, `Consulta<X>` (DTO HTTP) | `<X>Request`, `<X>Response`, `<X>Query` | `RespostaLogin` → `LoginResponse` |
| `EntradaDe<X>`, `SaidaDe<X>` (tarefa de IA) | `<X>Input`, `<X>Output` | `EntradaDoTutor` → `TutorInput` |
| `Bancada<X>` (apoio de teste) | `<X>Fixtures` | `BancadaDeSessoes` → `SessaoFixtures` |
| `*-de-teste.ts` | `<dominio>.fixture.ts` | `material-de-teste.ts` → `material.fixture.ts` |
| `Processador`, `Agendamento`, `ExecutorDeJobs` (BullMQ) | `JobProcessor`, `JobSchedule`, `JobExecutor` | |
| `Medicao<X>` (gauge do OpenTelemetry) | `<X>Gauge` | `MedicaoDaFila` → `QueueGauge` |
| `consulta<X>` (TanStack Query) | `<x>QueryOptions` | `consultaMeusVinculos` → `meusVinculosQueryOptions` |
| `CHAVE_<X>` (TanStack Query) | `<X>_QUERY_KEY` | |
| kit visual | o nome do shadcn ou do Radix; nas peças de IA, o do AI Elements | `Botao` → `Button`, `Dialogo` → `Dialog`, `PainelLado` → `Sheet`, `MensagemIA` → `AIMessage`, `CaixaPedido` → `PromptInput` |
| arquivo e pasta técnicos | inglês, em kebab-case, com o sufixo do Nest (`.guard.ts`, `.filter.ts`, `.exception.ts`, `.decorator.ts`) | `guarda-limite.ts` → `rate-limit.guard.ts`, `fila/` → `queue/` |

**Nome misto.** O domínio fica em português e o termo técnico vai em inglês, como em `TurmaController`. Vale também
dentro do identificador: `SessaoGuard`, `EscolaConcurrencyLimiter`, `ConviteTicket`, `OperadorTokenIssuer`.

## 2. Decisões

Cada dúvida das varreduras, fechada com a recomendação do Arquiteto. Você corta ou troca qualquer uma na aprovação.

**Alcance**

1. **Os schemas zod e os DTOs entram** (453 linhas, a maior parte do rename). Ficam com `<X>Request`, `<X>Response`,
   `<X>Query` e `<x>Schema`, e não com `Dto`, porque assim entrada e saída se distinguem e "Resposta" deixa de
   competir com a resposta do aluno, que é termo do glossário. O `Pedido<X>` de domínio fica (`PedidoDoTitular`,
   `PedidoDaTurma`)
2. **O `static com(...)` dos módulos dinâmicos vira `forRoot(...)`.** É a única exceção a "métodos ficam", porque o
   nome é a convenção do NestJS para módulo dinâmico (30 arquivos)
3. **As funções de utilitário genérico entram** (`chamarApi`, `formatarNumero`, `baixarPorUrl`, `useMidia` e as de
   `formatar.ts`, `tema.ts`, `letra.ts` e `api/cliente.ts`). O verbo de domínio fica (`entrarPorEmail`,
   `caminhoDaTurmaDoProfessor`, `estimarTokens`)
4. **As constantes `UPPER_SNAKE` de valor ficam** (cerca de 630, como `TAMANHO_MAXIMO_EMAIL`, `RETENCAO_SESSAO_DIAS`
   e `PREFIXO_LIMITE_*`). Entram só o token de injeção, o mapa e a chave de metadado
5. **Os decorators entram:** `@SemEscopo` → `@Unscoped`, `@RotaAnonima` → `@Public`, `@SemLimite` → `@SkipRateLimit`,
   `@Permite` → `@RequirePermissao`. A guarda que procura cada um pelo nome passa a procurar o nome novo (§4)

**IA e outbox**

6. **`Adaptador` vira `Adapter`, e não `Provider`.** A D13 diz "porta e adaptador", e com `Provider` a palavra
   apareceria em três níveis: na porta (`LLMProvider`), no adaptador e no `provedor` de domínio (`ProvedorDaEscola`).
   `ProvedorDeIa`, que implementa a porta, vira `LLMGateway`
7. **`Ia` fica como prefixo de domínio no back e no núcleo** (`IaModule`, `OrcamentoDeIa`, a pasta `ia/`). A peça
   técnica da camada usa `LLM` (`LLMError`, `LLMGateway`). No kit visual vale o nome do AI Elements (`AIMessage`,
   `AIBadge`, a pasta `components/ui/ai/`)
8. **`Enfileirador` vira `JobOutbox`, e `JobRegistroRepository` vira `JobOutboxRepository`.** É o transactional
   outbox do guia, §9. A tabela continua `job_registro`
9. **A classe `Despachante` vira `OutboxRelay`, e `Reconciliacao` vira `OutboxSweeper`.** O app e o serviço do compose
   continuam `despachante`
10. **`RegistroDeAuditoria` vira `AuditoriaRecorder`,** e não `AuditLog`, porque a regra 20.10 diz que auditoria não é
    log
11. **`ouro` vira `golden`** (`golden.ts`, `GoldenRejectedError`): é o *golden set* de `docs/avaliacao-de-modelos.md`

**Núcleo, contexto e banco**

12. **`exigirEscolaDoContexto` vira `requireEscolaId()`** (86 arquivos) e `contextoAtual` vira `currentContext()`
13. **`Banco` e `TransacaoBanco` viram `Database` e `DatabaseTransaction`.** Os tokens `BANCO` e `POOL_BANCO` viram
    `DB` e `DB_POOL`, como nas receitas do Drizzle para o Nest
14. **Pastas do núcleo:** `fila/` → `queue/`, `limite/` → `rate-limit/`, `erro/` → `error/`, `entrada/` → `pipes/`,
    `contexto/` → `context/`, `telemetria/` → `telemetry/`, `instancia/` → `runtime/`, `uso/` → `usage/`,
    `rotina/` → `cron/`, `configuracao/` → `settings/` e `ia/tarefas/` → `ia/tasks/`. **Ficam** `identidade/`, que é
    o contexto de identidade e tenancy, `ia/`, `auditoria/`, `titular/`, `retencao/`, `ciclo-de-vida/` e `permissao/`.
    No shared, `erros/` → `errors/` e `sistema/` → `system/`, e `time/` fica
15. **Os tokens de injeção seguem a peça que injetam.** Peça de domínio, token de domínio (`ORCAMENTO_DE_IA`). Peça
    renomeada, token renomeado com o nome misto (`EXECUTOR_DE_AGENTE` → `AGENTE_EXECUTOR`)
16. **`Dependencias`, `Opcoes` e `Configuracao` viram `XDependencies`, `XOptions` e `XConfig`,** sem abreviar
17. **`montagem.ts`, `montar*` e `*Montado` viram `composition.ts`, `create*` e `*Runtime`.** É o composition root
18. **`Medicao*` vira `*Gauge`**, que é o observable gauge do OpenTelemetry

**API**

19. **`sistema/` vira `system/`,** e as subpastas técnicas da sessão também mudam: `saida/` → `logout/`,
    `renovacao/` → `refresh/`, `externa/` → `external/`, `conclusao/` → `completion/` e `segundo-fator/` → `mfa/`.
    **Fica `eu/`,** porque "Eu" está no glossário. A rota HTTP não muda em nenhum desses casos
20. **Ficam como domínio:** `TimeController` (o time de agentes), a "atividade" da sessão
    (`AtividadeController` e `RegistroDeAtividade`, para não colidir com o `Heartbeat` da instância),
    `artefato/conferencia.ts`, `estrutura/exclusao.ts`, `salaDaEscola` e os decorators de operação, que viram
    `@OperacaoRoute` e `@OperacaoLoginRoute`
21. **`ContextoController` vira `ContextController`, `AvisosController` vira `NoticesController` e `AVISOS_DO_SISTEMA`
    vira `SYSTEM_NOTICES`:** são os avisos de sistema e de manutenção, não os de domínio
22. **Arquivo cujo nome não casa com a classe e não é tradução** (`acesso-publico.repository.ts`) fica, porque está
    fora da D81

**Web e e2e**

23. **`e2e/__fixtures__/` vira `e2e/support/`,** porque quase tudo ali é helper e page object. O `perfis.ts` vira
    `profiles.ts`. A pasta `apps/web/src/__fixtures__/` fica, porque é o nome do Vitest
24. **`sessao` fica na web** (`api/sessao.ts` e `sessao/`). Mudam só os wrappers genéricos (`authedRequest`,
    `authedGet`) e o hook de inatividade (`useIdleTimeout`)
25. **`Tela` vira `Page`, `BarraPresa` vira `StickyFooter`, `MotorFormulario` vira `SchemaForm`, `SeloDeEstado` vira
    `StatusBadge` e `Contador` vira `CountBadge`.** `Badge` não se funde: seria redesenho, não rename
26. **Ficam como domínio e produto:** os `Dialogo…` de fora do kit (`DialogoDoConvite`, `DialogoDeDecisao`), os
    controles `Aparencia` e `TamanhoDaLetra` (o tipo `Aparencia` de `tema.ts` vira `ThemePreference`), `Sino`, os
    `textos*.ts`, a pasta `areas/*/comum/` (as peças técnicas de dentro dela mudam, como `Moldura` → `TabbedPage`),
    `espelho-da-fila.ts`, os nomes dos projetos do Playwright (`chromebook`, `celular`) e as `Props…` dos componentes
    que ficam. O `useCicloDeExecucao` vira `useExecutionLifecycle`
27. **`galeria/` vira `gallery/`.** O endereço `/galeria` e o `data-galeria` ficam
28. **Nada muda de lugar.** Os utilitários soltos em `paginas/` (`reenvio-da-sala.ts`, `fragmento.ts`), o `a3.ts` do
    e2e, que mistura duas coisas, e o storage, que mora em `titular/`, mudam só de nome. Mover fica para outra
    correção

## 3. O que fica

- **O domínio do glossário**, com o prefixo de domínio dos `*Controller`, `*Service`, `*Repository` e `*Module`
- **A casca e as telas da web,** em `inventario-web-e2e.md`, seção "Ficam (casca e telas)", e a onça
- **O que é lido ou gravado fora do código.** A seção "Não muda, mas parece" de cada anexo dá, para cada peça que muda,
  a string que fica: a tabela `job_registro`, as filas `interativa`, `normal` e `lote`, as chaves `vaga:` e `rl:` do
  Redis, a variável `IA_ADAPTADOR` e os valores `falso` e `openai_compat`, os códigos de erro, as rotas `/prontidao`,
  `/saude` e `/v1/sistema/*`, o namespace `/sistema` do socket.io, as métricas, os eventos de log, o campo
  `chaveEnvio` e os parâmetros `?pagina=` e `?limite=`
- `apps/despachante` e `@educa/despachante`, o `@educa/shared` e os subcaminhos `@educa/core/ciclo-de-vida` e
  `@educa/core/conta-global`

## 4. O que acompanha fora de `apps/`, `packages/` e `e2e/`

Esses arquivos escrevem o nome ou o caminho da peça como texto, e o compilador não acusa se ficarem para trás. Nada
neles é renomeado: muda só o nome ou o caminho que eles citam. Na guarda, um teste prova que ela continua pegando o
caso que pegava.

- **Guardas e processo:** `tools/guardas/` (`regras-erro.mjs`, `index.mjs`, `regras-log.mjs`, `regras-ia.mjs`,
  `regras-tenant.mjs`, `escopo-dos-repositories.ts`, `camadas.cjs`, `tabelas-do-nucleo.mjs`, e os testes e
  `__fixtures__` que repetem os nomes), `tools/processo/` (`guardioes-por-caminho.ts`, `portao.ts`, `mutacoes.ts`,
  `separar-achados.ts`, `harness/caminhos.test.ts`, `revisoes.test.ts`), `tools/testes/` (`integracao.setup.ts`,
  `metricas.ts`), `tools/ia/medir-risco-a-vida.ts`, `tools/demonstracao/ia-com-o-material.test.ts` e `tools/ci/`, nas
  referências ao Playwright. **O risco está aqui:** a guarda que procura `SemEscopo` ou `exigirEscolaDoContexto` por
  texto fica verde sem checar nada se o nome mudar e ela não. É a regra 10
- **Configuração:** `eslint-suppressions.json` (17 caminhos de `packages/nucleo`; caminho esquecido reativa a
  supressão), `eslint.config.mjs`, `knip.json`, o `package.json` da raiz e o de `packages/nucleo` (os `exports` e o
  `build` que copia `vaga.lua`), `apps/web/nome-dos-chunks.ts` (caminhos do kit em texto), `tsconfig`, `Dockerfile`,
  `.github/`, `infra/compose.yml` (`nucleo/src/instancia` e `dist/ops/migrar.js`) e `infra/test/`
- **Strings que apontam arquivo:** o `ARQUIVO_DO_SANDBOX` do worker e o `readFileSync` de `vaga.lua`
- **Documentos:** `CLAUDE.md`, `.claude/rules/` (a regra 10.9 nomeia `@SemEscopo`; as checagens citam caminhos de
  `packages/nucleo`), `.claude/skills/`, `.claude/agents/`, `docs/guia-do-desenvolvedor.md` (§3 a §9),
  `docs/arquitetura.md`, `docs/interface.md` (a §10 lista o kit pelo nome), `packages/core/src/ia/README.md` e
  `components/ui/ai/README.md`. O `docs/decisoes.md` e as specs fechadas não mudam, porque são histórico

## 5. Adendas

**Adenda 1 — 29/10/2026, aprovada pelo Joaquim no terminal do Arquiteto, na revisão da spec (rodada 1)**

- Os arquivos de `apps/api/src/ops/` que são pontos de entrada chamados por texto (`migrar.ts`, pelo compose de
  produção e pelo runbook; `sessao-sintetica.ts`, pelo `package.json`) **ficam com o nome**. As peças de dentro
  deles mudam. O compose de produção não muda
- O arquivo da interface do adaptador, `ia/adaptador.ts`, vira `ia/adapter.ts`, e não `model-adapter.ts`. Assim ele
  não casa com o glob `*-adapter.ts` da guarda do SDK de IA, que isenta só os três adaptadores. `AdaptadorDeIa` vira
  `LLMAdapterKind`, e não `LLMProviderKind` (decisão 6)
- **O `this.name` das classes de erro acompanha a classe** (`'ErroDeDominio'` → `'DomainException'`). O campo `tipo`
  do log muda junto, e nenhum alerta nem o runbook o leem

**Adenda 2 — 29/10/2026, aprovada pelo Joaquim no terminal do Arquiteto, na revisão da spec (rodada 2)**

- 94 declarações de topo de arquivo que seguem uma regra do §1 já aprovada (`Linha<X>`, `Opcoes<X>`, `Dependencias<X>`,
  `<X>EmMemoria`, `Adaptador<X>`, `esquema<X>`, `lerConfiguracao<X>`, `consulta<X>`) e que as varreduras não
  listaram. A tabela está em `inventario-adenda-2.md`, com o nome novo de cada uma e o que fica de fora
- A guarda do RF8 (`guarda.md`) recusa exatamente o que esta adenda e os anexos renomeiam: com tudo aplicado, a árvore
  inteira passa

**Adenda 3 — 30/10/2026, aprovada pelo Joaquim no terminal do Arquiteto, na revisão da spec (rodada 4)**

- `lerConfiguracao<X>` vira `load<X>Config` em todo o inventário, como o §1 e o anexo do core: `readLoginConfig`,
  `readExternalLoginConfig` e `readConfig` dos quatro apps (anexo back), `readFileStorageConfig` e `readSalaConfig`
  (adenda 2) passam a `load…`. O Joaquim escolheu o verbo "para todos"; o quinto nome, `readConfig`, foi achado na
  rodada 5

**Adenda 4 — 01/11/2026, aprovada pelo Joaquim no terminal do Orquestrador, na tarefa 10.0 (triagem da 2ª divergência)**

- Quatro nomes da web de regra já aprovada que nenhum anexo listava: `chamarComSessaoDeOperador` → `operadorAuthedRequest`
  (o par do operador do `authedRequest`, decisão 24) e três `CHAVE_` do TanStack Query não exportadas → `<X>_QUERY_KEY`
  (§1). A tabela está em `inventario-adenda-4.md`. Os valores das chaves não mudam

**Adenda 5 — 01/11/2026, aprovada pelo Joaquim no terminal do Orquestrador (opção A), na triagem da divergência da 12.0**

- Onze declarações de topo de regra já aprovada (§1) que a guarda do RF8 acusou na árvore depois das ondas 3.0 a 11.0:
  a adenda 2 as tirou por terem homônimo já citado num anexo, pelo nome e não pelo caminho. A tabela está em
  `inventario-adenda-5.md`. Entram numa correção com mapa próprio, antes de a 12.0 retomar; a guarda não ganha exceção
