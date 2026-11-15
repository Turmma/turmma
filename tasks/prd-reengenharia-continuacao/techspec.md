# Tech Spec — Reengenharia, continuação (X6)

**PRD:** `tasks/prd-reengenharia-continuacao/prd.md`
**Status:** rascunho

Joaquim, 15/11/2026: o worker de IA é um segundo ponto de entrada do `apps/api`, e o modelo menor é opcional até a D37. O
desenho de outubro (`tasks/prd-reengenharia/onda-3a.md`, `onda-3c.md`) vale onde esta spec não diz outra coisa, com os nomes de
antes da X8 (`nucleo` é `core`, `cliente.ts` é `client.ts`).

## 1. Resumo da abordagem

Cada tarefa de IA ganha um **comando registrado**, que relê do banco, pelo id da execução, o que hoje vai por closure ao
`ExecucaoScheduler` (`entrada`, `lido`, `aoConcluir`). Com o comando no lugar, o `agendar` grava, na mesma transação
da execução, um job `ia.executar` no outbox de hoje (`JobOutbox`, D49), com payload `{ execucaoId }` e `executor: 'api'`. O despachante
publica o job em `api-interativa`, `api-ferramenta` ou `api-normal` (`bullmqQueueName`) quando a escola tem vaga. Quem consome é
`apps/api/src/main-worker.ts`, o NestJS sem HTTP (`NestFactory.createApplicationContext`), com o `JobExecutor`, que sai de
`apps/worker` para `@educa/core/jobs`. O gateway ganha o limite de tokens por minuto (o `RateLimiterRedis` do
`rate-limiter-flexible`, já usado em `packages/core/src/rate-limit/`) e a conferência da D62. A web ganha o prazo e a borda de erro
na raiz, e o desafio da escola com o Redis fora responde como o do operador.

## 2. Módulos afetados

| Módulo | Novo ou alterado | O quê |
|---|---|---|
| `packages/core/src/jobs/` (subcaminho `@educa/core/jobs`) | novo, movido | `JobExecutor`, `SlotReleasedNotifier` e a montagem de pool por fila, de `apps/worker/src/job-executor.ts`; o `apps/worker` passa a importar dali |
| `packages/shared/src/system/` | alterado | `ferramenta` em `QUEUE_NAMES`, depois de `interativa`; o tipo `ia.executar` em `JOB_DEFINITIONS`, com `{ execucaoId: uuid }`, `executor: 'api'`, `prazoMs: 150_000`, uma tentativa (a reentrega é tratada pelo estado, §5) |
| `apps/api/src/ia/` | alterado | `ExecucaoCommand` e o registro; o `ExecucaoScheduler` publica no outbox; o `ExecucaoProcessor`; sai o `InProcessAgenteExecutor` |
| `apps/api/src/{tutor,assistente,artefato,governanca}/` | alterado | cada service troca as closures por um comando no módulo dono |
| `apps/api/src/main-worker.ts`, `worker.module.ts` | novo | sobe só os módulos de domínio, o `IaModule` com o provedor e o executor; **o `AppModule` HTTP deixa de prover `LLM_PROVIDER`** |
| `packages/core/src/ia/` | alterado | `TokenLimiter` (porta e implementação), degradação no `LLMGateway`, conferência da D62 por chamada, métricas |
| `packages/core/src/config/llm-config.ts` | alterado | `LLM_TOKENS_POR_MINUTO`, `LLM_MODELO_MENOR_<PERFIL>` (opcional), `IA_REPLICAS`, `IA_LATENCIA_FALSA_MS_PADRAO`; saem `IA_EXECUCOES_POR_ESCOLA`, `IA_EXECUCOES_TOTAL`, `IA_EXECUCAO_TIMEOUT_MS` |
| `packages/core/src/settings/operational-settings.ts` | alterado | `VAGAS_ESCOLA_FERRAMENTA` (4); `VAGAS_ESCOLA_INTERATIVA` de 5 para 10 (R42 da X5) |
| `apps/api/src/credencial/challenge.ts`, `apps/web/src/pages/` da entrada | alterado | 54.0 |
| `apps/web/src/api/client.ts`, `apps/web/src/main.tsx`, `components/AreaErrorBoundary` | alterado | 52.0 e 56.0 |
| `infra/compose.yml`, `infra/k6/justica-entre-escolas.js`, `infra/grafana/alertas/` | alterado | `worker-ia-1` e `worker-ia-2`, a fase `sala`, quatro alertas |
| `docs/infra.md`, `arquitetura.md`, `guia-do-desenvolvedor.md`, `runbook.md`, `aia/tutor.md` | alterado | a IA no worker; sai a "exceção declarada" |

## 3. Modelo de dados

Nenhuma tabela nova nem coluna nova. **Migration 0050**, no molde da `0049_material_extracao_no_worker.sql`: amplia
`job_registro_fila_valida` e `configuracao_operacional_vagas_validas` com `ferramenta` (`NOT VALID`, depois `VALIDATE CONSTRAINT`,
com `lock_timeout`). É compatível com o código anterior, que nunca grava `ferramenta`.

## 4. API

Nenhuma rota nova; as de IA seguem com `202` e `GET /v1/execucoes/:id`, que também dá `IA_INDISPONIVEL` na espera estourada (§5). A
escolha de escola e o segundo fator da escola, com o Redis fora, dão `503 INDISPONIVEL_TENTE_DE_NOVO` com `Retry-After` (hoje, `401`).

## 5. Fluxo

**O comando.** `ExecucaoCommand<E, S>` tem `tarefa`, `fila`, `preparar(execucao)` → `{ entrada, lido, alunoId?, turmaId? }` e
`concluir(saida, lido, tx, execucaoId)` → `ResultadoGravado`. Um teste exige um comando para toda `TarefaDeIa`, salvo
`relatorio_da_correcao`, que não tem chamador (R23 da X5). O `aoGravar` continua na requisição: é ele que grava a pergunta e conta a
troca na mesma transação. Antes de mover qualquer `aoConcluir`, um teste fixa as mensagens e o hash de cada prompt contra a
`versao` dele e caracteriza "a entrega nasce `pendente`".

**O contexto no worker.** A escola vem de `job_registro.escola_id`, que o executor já põe no contexto. O `preparar` lê a execução
pelo id no escopo dela e monta o contexto: `usuarioId` de `solicitada_por`, ano letivo da linha, papel relido do vínculo ativo.
`solicitada_por` nulo (pessoa eliminada) ou vínculo encerrado termina a execução com `NAO_ENCONTRADO`, sem modelo.

**A execução.** O processador faz `pendente → rodando` (`update … where estado = 'pendente'`; quem não pegou sai sem modelo),
roda `preparar`, chama o gateway com o sinal da tentativa e conclui na transação (`concluirRodando`).

| Estado de `execucao_agente` | Entra por | Sai por | Prazo e o que acontece quando estoura ou o processo morre |
|---|---|---|---|
| `pendente` | `POST` (com o job no outbox, mesma transação) | processador: `rodando`; espera estourada: `falhou IA_INDISPONIVEL` | o job espera a vaga; na `interativa`, 20 s desde `criada_em` sem chegar ao processador → `falhou IA_INDISPONIVEL`, sem modelo, troca não conta |
| `rodando` | processador | `concluida` ou `falhou <código>` | o corte do perfil (60 s `rapido`, 140 s `padrao`) abaixo do `prazoMs` de 150 s; worker morto: a reentrega (stalled, ~15 s) acha `rodando` e grava `falhou EXECUCAO_INTERROMPIDA`, sem modelo, com o consumo estimado (§8) |
| `concluida`, `falhou` | — | — | finais; a reentrega sai sem efeito |

A varredura `falharInterrompidas` vai para o `main-worker`, como rede de segurança.

**A D36 e a S12 no comando do Tutor.** O `assunto_delicado` grava a mensagem fixa e o `atencao_humana` sempre que o `concluir` roda,
mesmo com a execução já encerrada: o sinal fica fora do `where estado = 'rodando'`, com chave única por execução. A avaliação
aberta se confere no `preparar` e de novo no `concluir`, como hoje em `tutor.service.ts`.

**A fila.** Tutor na `interativa`; ferramentas, artefato e `propor_ferramenta` na `ferramenta`; Analista na `normal`. A vaga é a de
hoje (`concurrency-slot.lua`, por fila e escola). A conta por réplica é a de `onda-3a.md` ("Filas separadas"): pool 50, 20 e 2. O job não
segura conexão de banco durante a chamada ao modelo.

**Os tokens (49.0).** `TokenLimiter.reservar(modelo, estimativa, prioridade)`: a estimativa é caracteres ÷ 4 +
`maximoDeTokensDeSaida`, acertada pelo uso real depois. O balde é por `provedor:modelo`, com teto de 80 % do
`LLM_TOKENS_POR_MINUTO`; o trabalho da `normal` e do `lote` para nos 50 %. Com o Redis fora, cada réplica segura o teto ÷
`IA_REPLICAS` (o `insuranceLimiter` da própria biblioteca). Sem vaga no teto, o pedido espera até 8 s, depois vai ao
`LLM_MODELO_MENOR_<PERFIL>` (com o balde dele), e só então dá `IA_INDISPONIVEL`. Sem modelo menor configurado, o degrau é pulado e
registrado. O provedor de reserva fica para o F5. O orçamento da 48.0 (56 s e 136 s) já inclui os 8 s.

**A D62 (50.0 e RF10).** Na subida da API e do `main-worker`, com `openai_compat` sem `LLM_PROCESSAMENTO_LOCAL`, o
`suboperador` vigente da `IA_PROVEDOR_ID` precisa de `pais = 'BR'`, `veda_treinamento`, `conversa_do_aluno` em `categorias` e
`alcance = 'todas'`. O falso e o local passam. Banco fora: não fica pronta e tenta de novo. A cada chamada, o
`LLMGateway` lê `tarefa.levaTextoDeAluno`: com a marca, e sem a declaração conferida na subida, recusa com `IA_INDISPONIVEL` antes
do orçamento e do `fetch`, e loga `ia.geracao.soberania_recusada`. A marca é campo obrigatório
da tarefa.

**A web (52.0, 56.0).** O `apiRequest` liga um `AbortController` próprio ao sinal de quem chamou: o prazo estourado vira
`ApiError(TEMPO_ESGOTADO)`, que o `ErrorState` mostra com "Tentar de novo", e o cancelamento de quem chamou relança o
`AbortError`. Os prazos são os do PRD (RF11); os `fetch` de `areas/coordenacao/material/api/material.ts` e
`areas/professor/artefatos/api/artefatos.ts` passam pelo mesmo `comPrazo`, e `no-restricted-globals` barra `fetch` fora de
`api/client.ts`. O `PUT` estourado volta à fila de reenvio
(`areas/aluno/fila-de-respostas.ts`) e não segura as outras questões. Em `main.tsx`, `<AreaErrorBoundary paginaInteira>` envolve
as rotas, com o texto e o "Voltar ao início" de `FALHA_DA_AREA`.

**O Redis fora (54.0).** `#semRedis` de `credencial/challenge.ts` devolve `INDISPONIVEL_TENTE_DE_NOVO` com `Retry-After`, como
`operacao/operador-challenge.ts`; `conferirLivre` roda antes de qualquer reserva de tentativa. A web espera o `Retry-After` uma
vez.

## 6. Isolamento (obrigatório)

O payload leva só `execucaoId`. O `ExecucaoRepository` passa a ler a escola de `requireEscolaId()`, e não do argumento: sai de
`REPOSITORIES_SEM_ESCOPO` (`tools/guardas/escopo-dos-repositories.ts`), salvo `falharInterrompidas` (`@Unscoped`, como hoje). Testes: contexto da escola A
lendo o id da B dá vazio, e sem a cláusula fica vermelho; job da A com o `execucaoId` da B deixa a execução `pendente`, sem
`fetch` e sem `consumo_ia`; quatro ferramentas da A não ocupam vaga da B. Métricas e alertas de IA não levam escola, salvo
`ia.espera_estourada{escola_id}`, que é contagem.

## 7. Dado pessoal (obrigatório)

| Item | Resposta |
|---|---|
| Campos pessoais | nenhum novo; a linha `job_registro` de `docs/lgpd.md` passa a citar `ia.executar` |
| O que vai para log | ids, tipo da tarefa, código; nunca entrada, saída ou prompt |
| O que é enviado a provedor externo | o mesmo de hoje, agora só com processamento no Brasil quando leva texto de aluno |
| Retenção, auditoria, arquivo do titular | sem mudança |
| Autorização por objeto | o `preparar` repete a conferência de alcance que o `POST` fez (turma, atividade, material) |

## 7b. Conformidade CNE

Tutor de alto risco, supervisão sem mudança (D8, D47). O risco é a D36 e a S12 no trânsito para o worker: são os primeiros
casos do comando do Tutor. O `conformidade-reviewer` revisa as tarefas de comando, de worker e de D62.

## 7c. Carga e falha (obrigatório)

| Item | Resposta |
|---|---|
| Caminho quente | Tutor, ferramenta, gateway, login, prova |
| Carga na manhã | `docs/infra.md` §3.2: 0,75 turno/s por escola; ~1,5 milhão de tokens/min no pico |
| Fila e prioridade | `interativa` (Tutor), `ferramenta` (professor esperando), `normal` (Analista) |
| Limite por escola | vaga por fila: 10 `interativa`, 4 `ferramenta`, sobrepostas por `configuracao_operacional_escola.vagas` |
| Rate limit | `IaRequestRateLimit`, sem mudança |
| Corridas | `pendente → rodando` condicional (barreira entre a leitura e o `update`: uma pega, um `fetch`; sem o `where estado = 'pendente'`, vermelho); reentrega com `rodando` (barreira: a 1.ª marca antes do `fetch`, a 2.ª grava `EXECUCAO_INTERROMPIDA`); o sinal da D36 com chave única por execução (reentrega não duplica) |
| Índices e migration | nenhum índice; 0050, compatível |
| Quando cada dependência cai | Redis de fila: o `POST` dá 202 (o job está no outbox) e roda quando ele volta; a escolha de escola dá 503. Provedor: disjuntor da 48.0, degradação, `IA_INDISPONIVEL`. Banco na subida: não fica pronto |
| Métrica e alerta | `ia.chamada.duracao_s{provedor,perfil,resultado}`, `ia.chamada.erros{provedor,perfil,codigo}`, `ia.disjuntor.aberto{provedor,modelo,perfil}`, `ia.degradacao{degrau}`, `ia.tokens.uso_do_teto{modelo}`, `ia.espera_estourada{escola_id}`; alertas "IA: espera estourada" (escola grande ou falta de capacidade), "Provedor de IA fora" (disjuntor 2 min), "Tokens acima de 80 %" (5 min) e o `job-interativo-esperando.yaml` estendido à `ferramenta`, cada um com parágrafo no runbook |
| Carga | `justica-entre-escolas.js`: a `FASE=base` mede o p95 do turno no build anterior e no da tarefa; a `FASE=sala` nova, com `IA_LATENCIA_FALSA_MS` 6 s e `IA_LATENCIA_FALSA_MS_PADRAO` 50 s, mede a espera por fila; um `kill -9` do `worker-ia-1` no meio, com os `EXECUCAO_INTERROMPIDA` num contador com teto igual aos jobs ativos dele |

O banco: pool 20 por `worker-ia`; `POSTGRES_CONEXOES_MAXIMAS` sobe para caber a soma, conferida por `tools/ci/compose.int.test.ts`.

## 8. Uso de IA

Nenhuma tarefa nem prompt novo (o hash da §5 prova). O custo não muda; a execução interrompida grava a reserva estimada em
`consumo_ia` pelo `RegistroDeConsumo`, a mais e nunca a menos (D14).

## 9. Frontend

Sem tela nova: o `ErrorState` e a `AreaErrorBoundary` de hoje. O prazo é de relógio, e o teste usa relógio falso.

## 10. Testes

| Camada | O que será testado |
|---|---|
| Unidade | `comPrazo`, o `TokenLimiter` com relógio falso, a configuração, a recusa da D62 |
| Integração | os casos de `onda-3a.md` §3 e `onda-3c.md` §3 que ficam; a subida em cada ramo da D62; o desafio com `tools/testes/redis-travado.ts` |
| E2E | o Tutor e uma ferramenta com o `worker-ia` no compose do e2e; os obrigatórios da regra 40 |
| Isolamento | §6 |

## 11. Conformidade com as regras

| Regra | Como é atendida | Desvio e justificativa | Documento |
|---|---|---|---|
| 00.4, 80.2 | IA no worker, prioridade por fila | — | — |
| 80.4 | limite, degradação, nunca erro cru | sem o provedor de reserva: é o F5 (D29) | PRD §3 |
| 80.5 | estado no Redis e no banco | o disjuntor é por réplica, como na 48.0 | `onda-3c.md` |
| 10, 20, 70 | §6, §7, §7b | — | — |

## 12. Premissas não verificadas

⚠️ NÃO VERIFICADO: "1 ferramenta por minuto por escola" (`onda-3a.md`). A `FASE=sala` mede, e o `docs/infra.md` registra. O teto
real de tokens e os modelos menores esperam a D37; até lá, o padrão do local é `LLM_TOKENS_POR_MINUTO` obrigatório só fora do
`AMBIENTE=local`.

## 13. Riscos técnicos

- **O `main-worker` montar o que a API monta.** Um teste de composição: ele sem controller nem porta, o `AppModule` sem `LLM_PROVIDER`.
- **O executor movido mudar o worker de hoje.** A tarefa é mecânica (`git mv` e import), provada pelas suítes do worker.
- **Memória das réplicas novas na VPS (D82).** A tarefa do compose mede o RSS do `worker-ia`, e o `docs/infra.md` registra.
