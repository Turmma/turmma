# Tarefas — reengenharia-continuacao (X6)

**PRD:** `prd.md` · **Tech Spec:** `techspec.md` · **Cenários:** `cenarios.md`
<!-- Quantas estão concluídas não se escreve aqui: `node tools/processo/estado.ts` conta pela lista. -->

Os números da X5 (42.0, 47.0…) estão entre parênteses no título. Quatorze tarefas, duas acima da meta de 12: o corte
possível é pousar a 12.0, a 13.0 e a 14.0 (a web e o Redis) como spec à parte. Ficaram nesta porque correm em linha
paralela desde o começo e não alongam o caminho, que é o da IA (1.0 → 11.0).

## Lista

- [x] **1.0 — O Assistente, as ferramentas, o artefato e o Analista rodam por comando registrado, ainda no processo (42.0)**
  - [ ] 1.1 Caracterização, num commit antes: o hash de cada prompt contra a `versao`, e a entrega do assistente e do artefato nascendo `pendente`
  - [ ] 1.2 `ExecucaoCommand` e o registro em `apps/api/src/ia/`; o `agendar` chama `preparar` e `concluir` do comando
  - [ ] 1.3 Os comandos de `assistente/`, `artefato/` (ferramentas, artefato, `propor_ferramenta`) e `governanca/` (Analista)
  - [ ] 1.4 Testes

- [x] **2.0 — O Tutor roda por comando: a D36 grava em transação própria e a S12 se confere no `preparar` e no `concluir` (42.0)**
  - [ ] 2.1 O comando do Tutor; o `lido` vira retorno tipado do `preparar`
  - [ ] 2.2 O `assunto_delicado` numa transação própria, antes da conclusão condicional
  - [ ] 2.3 `ExecucaoRequest` fica só com `aoGravar`; teste: toda `TarefaDeIa` tem comando, salvo `relatorio_da_correcao`
  - [ ] 2.4 Testes

- [x] **3.0 — A fila `ferramenta` existe, com vaga própria por escola, e o executor de jobs mora no `core` (47.0)**
  - [x] 3.1 Migration 0058: `ferramenta` nos checks de `job_registro` e das vagas (`NOT VALID`, `VALIDATE`, `lock_timeout`)
  - [x] 3.2 `ferramenta` em `QUEUE_NAMES`, `QUEUE_PRIORITY`, `WORKER_POOL_OPTIONS_BY_QUEUE`; `VAGAS_ESCOLA_FERRAMENTA` 4, `VAGAS_ESCOLA_INTERATIVA` 10
  - [x] 3.3 `JobExecutor` e `SlotReleasedNotifier` de `apps/worker` para `packages/core/src/jobs/`
  - [x] 3.4 `job-interativo-esperando.yaml` olha também a `ferramenta`, com o runbook
  - [x] 3.5 Testes

- [ ] **4.0 — O pedido acima do teto de entrada da tarefa é recusado antes de qualquer envio**
  - [ ] 4.1 `maximoDeTokensDeEntrada` obrigatório em `TaskDefinition`, calculado pelo pior pedido válido
  - [ ] 4.2 `PEDIDO_ACIMA_DO_TETO` (503) em `LLM_ERROR_CODES`, `shared` e `HTTP_STATUS_BY_CODE`; `PASSAGEIROS` vai da web para `shared`
  - [ ] 4.3 Métrica `ia.pedido_acima_do_teto{tarefa}`, alerta e runbook
  - [ ] 4.4 Testes

- [ ] **5.0 — A IA roda no worker: o `POST` grava o job e o `main-worker` conclui, uma vez só (47.0)**
  - [ ] 5.1 `ia.executar` em `JOB_DEFINITIONS`; o `agendar` grava o job no outbox na transação da execução
  - [ ] 5.2 `main-worker.ts` e `worker.module.ts`; o `AppModule` sai do `LLM_PROVIDER`; sai o `InProcessAgenteExecutor`
  - [ ] 5.3 `ExecucaoProcessor`: `pendente → rodando` e a conclusão condicionais, o prazo único; a varredura de hoje vai como está
  - [ ] 5.4 O `ExecucaoRepository` lê a escola do contexto; o `preparar` repete o alcance
  - [ ] 5.5 A bancada `fila-de-ia.fixture.ts`, as 23 trocas de `EXECUTOR_DE_AGENTE` e a guarda
  - [ ] 5.6 `worker-ia-1` e `-2` no compose; configuração; documentos
  - [ ] 5.7 Testes

- [ ] **6.0 — Execução duplicada ou interrompida não chama o modelo de novo, e o consumo estimado fica no rastro (47.0)**
  - [ ] 6.1 A reentrega em `rodando` encerra com `EXECUCAO_INTERROMPIDA`, com a linha estimada em `consumo_ia` na mesma transação
  - [ ] 6.2 A varredura nova: `rodando` velha e `pendente` sem job vivo, com o `EXPLAIN`
  - [ ] 6.3 A conta do laço da varredura
  - [ ] 6.4 `docs/lgpd.md`: `job_registro` cita `ia.executar`; `consumo_ia` diz o que a linha estimada leva
  - [ ] 6.5 Testes

- [ ] **7.0 — A pergunta do Tutor que espera mais de 20 s termina com "Tentar de novo", e o operador é avisado (47.0)**
  - [ ] 7.1 O corte no processador e no `GET /v1/execucoes/:id`, por `update` condicional
  - [ ] 7.2 `ia.espera_estourada{escola_id}`, o alerta e o runbook que separa uma escola de várias
  - [ ] 7.3 A mensagem fixa acima do "Tentar de novo" na tela do aluno; a AIA do Tutor
  - [ ] 7.4 Testes

- [ ] **8.0 — Texto de aluno não sai do Brasil: a subida e o gateway conferem a D62 (50.0)**
  - [ ] 8.1 `categoriasEnviadas` e `levaTextoDeAluno` em toda tarefa, fixadas no `DECLARADO`
  - [ ] 8.2 A conferência do suboperador vigente na subida da API e do `main-worker`
  - [ ] 8.3 A recusa no `LLMGateway`, antes do orçamento e do envio
  - [ ] 8.4 Runbook e AIA
  - [ ] 8.5 Testes

- [ ] **9.0 — A professora vê quantas perguntas o Tutor não respondeu hoje, sem o texto**
  - [ ] 9.1 `semRespostaHoje` em `supervisao.repository.ts` e no contrato de `shared`
  - [ ] 9.2 A linha do aluno no uso do Tutor
  - [ ] 9.3 `docs/lgpd.md` ("Uso do Tutor") e a N21 da AIA
  - [ ] 9.4 Testes

- [ ] **10.0 — Toda chamada de modelo passa pelo limite de tokens por minuto, com degradação (49.0)**
  - [ ] 10.1 `TokenLimiter` com `RateLimiterRedis`: o balde geral e os da `ferramenta` e da `normal`; o `insuranceLimiter`
  - [ ] 10.2 A espera de 8 s, o modelo menor (fora do `turno_do_tutor`) e `IA_INDISPONIVEL`, dentro do prazo único
  - [ ] 10.3 Configuração; métricas; alertas e runbook
  - [ ] 10.4 Testes

- [ ] **11.0 — A carga da manhã prova o Tutor dentro da meta com a IA no worker (47.0)**
  - [ ] 11.1 `FASE=sala` em `justica-entre-escolas.js`, com o `kill -9`; `infra/carga.env`
  - [ ] 11.2 A corrida de base e a da árvore na mesma sessão; o relatório
  - [ ] 11.3 `docs/infra.md`: o piso do contrato e as premissas medidas

- [x] **12.0 — Toda chamada da web à API tem prazo, e a resposta de prova pendurada não trava as outras (52.0)**
  - [x] 12.1 `comPrazo` no `apiRequest`, em `material.ts` e em `artefatos.ts`
  - [x] 12.2 A guarda de `fetch` fora do cliente
  - [x] 12.3 O `PUT` estourado vai para o fim da `fila-de-respostas`
  - [x] 12.4 Testes

- [x] **13.0 — Uma tela que quebra fora de uma área mostra a falha com o caminho de volta (56.0)**
  - [ ] 13.1 `AreaErrorBoundary paginaInteira` em volta do `<Switch>` de `AppRoutes`
  - [ ] 13.2 "Voltar ao início" na `Falha`
  - [ ] 13.3 Testes

- [ ] **14.0 — Com o Redis fora, o segundo fator e a escolha de escola pedem para tentar de novo, sem gastar tentativa (54.0)**
  - [ ] 14.1 `#semRedis` devolve `INDISPONIVEL_TENTE_DE_NOVO` com `Retry-After`; `conferirLivre` antes de qualquer reserva
  - [ ] 14.2 A web espera o `Retry-After` uma vez, na entrada e no seletor
  - [ ] 14.3 Testes

## Dependências e paralelismo

Migration, schema e `packages/shared` não correm juntas: 3.0, 4.0, 5.0 e 9.0 vão uma de cada vez. O `docs/runbook.md` e o
`docs/aia/tutor.md` são de 3.0, 4.0, 7.0, 8.0, 9.0 e 10.0, que por isso também não se cruzam. A web e o Redis (12.0, 13.0,
14.0) não tocam nada da IA; a 13.0 e a 14.0 dividem o `docs/interface.md` com a 7.0 e a 9.0, e uma com a outra; a 14.0 e a 5.0, os testes de `apps/api/test/`.

| Tarefa | Depende de | Pode correr em paralelo com |
|---|---|---|
| 1.0 | — | 3.0, 12.0, 13.0, 14.0 |
| 2.0 | 1.0 | 3.0, 4.0, 12.0, 13.0, 14.0 |
| 3.0 | — | 1.0, 2.0, 12.0, 13.0, 14.0 |
| 4.0 | 3.0 | 2.0, 12.0, 13.0, 14.0 |
| 5.0 | 2.0, 4.0 | 12.0, 13.0 |
| 6.0 | 5.0 | 12.0, 13.0, 14.0 |
| 7.0 | 6.0 | 12.0 |
| 8.0 | 7.0 | 12.0, 13.0, 14.0 |
| 9.0 | 8.0 | 12.0 |
| 10.0 | 9.0 | 12.0, 13.0, 14.0 |
| 11.0 | 10.0 | 12.0, 13.0, 14.0 |
| 12.0 | — | 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0, 13.0, 14.0 |
| 13.0 | — | 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0, 11.0, 12.0 |
| 14.0 | — | 1.0, 2.0, 3.0, 4.0, 6.0, 8.0, 10.0, 11.0, 12.0 |

A 4.0 antes da 5.0 e da 6.0: a linha estimada da execução interrompida leva os dois tetos da tarefa. A 5.0 leva a IA ao
worker com o caminho normal; a 6.0 fecha o RF3 (corrida, reentrega, varredura nova, linha estimada). A 6.0 antes da 7.0:
as duas mexem no `ExecucaoRepository` e no processador. A 9.0 conta os códigos da 4.0, da 6.0, da 7.0 e da 8.0, e por isso
vem depois delas.

## Subagentes por tarefa

`test-engineer` e `revisor-geral` em todas.

| Tarefa | Subagentes obrigatórios | Porte |
|---|---|---|
| 1.0 | `tenancy-guardian`, `conformidade-reviewer`, `llm-integrator` | grande |
| 2.0 | `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator` | grande |
| 3.0 | `infra-guardian`, `tenancy-guardian` | grande |
| 4.0 | `infra-guardian`, `conformidade-reviewer`, `llm-integrator`, `frontend-reviewer` | grande |
| 5.0 | `tenancy-guardian`, `infra-guardian`, `conformidade-reviewer`, `llm-integrator` | grande |
| 6.0 | `privacy-guardian`, `tenancy-guardian`, `infra-guardian` | grande |
| 7.0 | `infra-guardian`, `tenancy-guardian`, `conformidade-reviewer`, `frontend-reviewer` | grande |
| 8.0 | `privacy-guardian`, `infra-guardian`, `conformidade-reviewer`, `llm-integrator` | grande |
| 9.0 | `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `frontend-reviewer` | grande |
| 10.0 | `infra-guardian`, `conformidade-reviewer`, `llm-integrator` | grande |
| 11.0 | `infra-guardian`, `llm-integrator` | grande |
| 12.0 | `infra-guardian`, `frontend-reviewer` | pequeno |
| 13.0 | `frontend-reviewer` | pequeno |
| 14.0 | `infra-guardian`, `tenancy-guardian`, `frontend-reviewer` | grande |

## Critério de pronto da funcionalidade

Do `ROADMAP.md`, X6, com o recorte do Joaquim de 14/11/2026 (o resto da X6 foi para as fases donas):

- Nenhuma chamada de modelo no processo HTTP da API; o Tutor na `interativa`, as ferramentas na `ferramenta`, o Analista
  na `normal`, com vaga por escola (RF1, RF2)
- Execução duplicada ou interrompida não chama o modelo de novo nem conta a troca, e o consumo fica a mais, nunca a menos
  (RF3); a D36 e a S12 valem no worker (RF4)
- A pergunta que espera mais de 20 s termina com "Tentar de novo", visível ao professor, com alerta e runbook (RF5)
- p95 do turno do Tutor ≤ base + 1 s; na carga da manhã, espera p95 do Tutor < 2 s e da ferramenta < 10 s, nenhum
  "indisponível", com a corrida registrada (RF6)
- Limite de tokens por minuto com degradação, métricas e alertas (RF7, RF8); a D62 conferida na subida e no gateway
  (RF9, RF10)
- A web com prazo em toda chamada, tela de falha com volta e o Redis fora sem gastar tentativa (RF11 a RF13)
- `docs/infra.md`, `docs/arquitetura.md`, `docs/guia-do-desenvolvedor.md`, `docs/runbook.md`, `docs/lgpd.md` e
  `docs/aia/tutor.md` atualizados nas tarefas que os mudam (RF14); esteira verde no último commit
- O roteiro da demonstração (`docs/roteiro-da-demonstracao.md`) não muda de tela: a 7.0 e a 9.0 conferem que o passo do
  Tutor e o da professora continuam batendo com `e2e/roteiro-da-demonstracao.spec.ts`
