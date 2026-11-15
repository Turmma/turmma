# Tarefa 5.0 — A IA roda no worker: o `POST` grava o job e o `main-worker` conclui, uma vez só (47.0)

**Funcionalidade:** reengenharia-continuacao · **Depende de:** 2.0, 4.0
**Subagentes obrigatórios:** `tenancy-guardian`, `infra-guardian`, `conformidade-reviewer`, `llm-integrator`
**Porte:** grande

## Objetivo

O `agendar` grava a execução `pendente` e o job `ia.executar` no outbox, na mesma transação; o `main-worker` o consome, e
nenhuma requisição espera o modelo. A varredura de hoje vai como está para o `main-worker`; a 6.0 a refaz.

## Contexto necessário

- `techspec.md` §1, §2, §5 (sem o corte dos 20 s), §6, §7c, §13
- `prd.md` RF1, RF2, RF4; §6
- `tasks/prd-reengenharia/onda-3a.md` "T9 — a IA no worker", "O processador"; regras 00, 10, 30, 40, 70, 80

## Subtarefas

- [ ] 5.1 — `ia.executar` em `JOB_DEFINITIONS` (§2); o `agendar` o grava pelo `enfileirarUmaVez` na transação
- [ ] 5.2 — `main-worker.ts` e `worker.module.ts`; o `AppModule` sem `LLM_PROVIDER`; saem `InProcessAgenteExecutor` e `IA_EXECUCOES_*`
- [ ] 5.3 — `ExecucaoProcessor`: as transições condicionais e o prazo único da §5; sem conexão presa durante o modelo
- [ ] 5.4 — `ExecucaoRepository` com a escola do contexto, fora de `REPOSITORIES_SEM_ESCOPO`, salvo a varredura
- [ ] 5.5 — `apps/api/test/fila-de-ia.fixture.ts`; as 23 trocas de `EXECUTOR_DE_AGENTE` passam por ela; a guarda
- [ ] 5.6 — Compose, `IA_REPLICAS`, conexões; rollback (§13); os quatro documentos. Busca:
  `grep -rn "InProcessAgenteExecutor\|IA_EXECUCOES_\|IA_EXECUCAO_TIMEOUT_MS" apps packages docs infra .env.example`
- [ ] 5.7 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/main-worker.ts`, `apps/api/src/worker.module.ts`, `apps/api/test/fila-de-ia.fixture.ts`, `tools/guardas/executor-so-na-bancada.test.ts` | novo |
| `apps/api/src/ia/`, `apps/api/src/tutor/`, `apps/api/src/assistente/`, `apps/api/src/artefato/`, `apps/api/src/governanca/`, `apps/api/src/entrega/`, `apps/api/src/app.module.ts`, `apps/api/src/main.ts`, `apps/api/src/config.ts`, `apps/api/test/`, `packages/core/src/ia/executor.ts`, `packages/core/src/config/llm-config.ts`, `packages/core/src/index.ts`, `packages/shared/src/system/job-definitions.ts`, `tools/guardas/escopo-dos-repositories.ts`, `infra/compose.yml`, `.env.example`, `tools/ci/compose.int.test.ts`, `docs/infra.md`, `docs/arquitetura.md`, `docs/guia-do-desenvolvedor.md`, `docs/aia/tutor.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| sem modelo na API | I | `AppModule` sem `LLM_PROVIDER`; `main-worker` sem controller. Mutação: provedor no `AppModule` | |
| payload | U | sem id, campo a mais, id não uuid: `DADOS_INVALIDOS` | |
| turno pela fila | I | 202, `pendente` e job na mesma transação; conclui; uma troca | |
| clique duplo | P | mesma `chaveEnvio` em `Promise.all`: uma execução, um job | |
| duplicada depois | I | sobre `concluida`: uma chamada, uma resposta. Mutação: tirar `where estado = 'pendente'` | |
| prazo único | I | modelo pendurado: `IA_TEMPO_ESGOTADO` aos 140 s e 60 s (Tutor). Mutação: sem `pedido.sinal` | |
| desligamento | I | o abort não grava. Mutação: todo abort como prazo | |
| configuração do prazo | U | perfil abaixo do `prazoMs` menos a folga | |
| pool | I | 20 execuções lentas, pool 20: um `select` responde no meio | |
| Redis fora | I | `POST` 202; o job sai na volta | |
| D36 sem job | I | "quero sumir" com a fila cheia e com o Redis fora: mensagem e sinal, nenhum job | |
| S12 pela fila | I | avaliação aberta entre o `POST` e o `preparar`: sem resposta, sem troca | |
| Tutor que não roda | I | desligado (D84), suspenso (D9), fora da política (D19): nenhum job. Uma mutação por conferência | |
| isolamento, repository | I | contexto da A, execução da B: nem lida nem mudada. Mutação: tirar `escola_id` | |
| isolamento, job | I | job da A com `execucaoId` da B: nada muda, sem modelo | |
| RF2, vagas | P | 5 ferramentas da A juntas: a 5.ª espera, o Tutor da A responde, a B segue | |
| guarda, quem contorna | U | `overrideProvider`, `useValue`, reexportação, `import()`, token como texto | |
| guarda, alvo some | U | o token ou a fixture renomeados: vermelho | |
| escopo | U | o repository fora de `REPOSITORIES_SEM_ESCOPO` | |
| compose | I | as duas réplicas, `IA_REPLICAS` igual, conexões para 20 cada (rode à mão) | |
| log | I | processador só com ids, tarefa e código | |

## Como testar

- Bancada: `apps/worker/test/queue.fixture.ts` (`QueueFixtures`); executor em `apps/worker/src/composition.ts`
- Clique duplo: `apps/api/src/ia/ia.int.test.ts` › "a mesma chave de envio duas vezes ao mesmo tempo…"
- Redis fora: `apps/despachante/test/redis-down.int.test.ts` › "parado: 50 POSTs dão 202…"
- Prazo: `apps/worker/test/job-timeout.int.test.ts`; idade pelo banco, recuando `iniciada_em`
- Guarda: `tools/guardas/guardas.test.ts`, fixtures em `tools/guardas/__fixtures__/`
- Comando: `npx vitest run --project integracao apps/api/src/ia/fila-de-ia.int.test.ts`
- Armadilha (F4): `worker-ia` de pé no compose dá vermelho falso

## Autoconferência

As 12 perguntas do modelo, no plano. Na 1: cada termo de cada `update` é um bloco.

## Fora do escopo desta tarefa

Reentrega, corrida e varredura nova (6.0); corte (7.0); tokens (10.0).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar

Herdadas das tarefas 3.0 e 2.0, destino 5.0 (copiadas das tabelas delas antes de a 5.0 começar):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª da 3.0) | `docs/runbook.md`, causa 1: diagnóstico cita só `worker-interativo-*`; com o `worker-ia` o alerta na `ferramenta` pede o `ps` e o `logs` dele | tarefa 5.0, que cria o `worker-ia` |
| revisor-geral (1ª da 3.0) | `docs/arquitetura.md` e `docs/infra.md` dizem "nenhuma réplica atende a `ferramenta` antes do `worker-ia`, na 5.0": a frase deixa de valer | tarefa 5.0, que precisa reescrevê-las |
| test-engineer (1ª da 3.0) | `infra/test/alertas.int.test.ts:305`: o caso da `ferramenta` esperando depende de nenhuma réplica a atender; com o `worker-ia` quebra | tarefa 5.0 (segurar o job, por exemplo tomando as 4 vagas da escola antes) |
| test-engineer (1ª da 3.0) | `tools/ci/ambiente.test.ts:150`: a conta "dez escolas cabem nos pools" deixa a `FERRAMENTA` de fora sem dizer | tarefa 5.0, ao criar `WORKER_POOL_FERRAMENTA` |
| privacy-guardian (1ª da 3.0) | O `dados` do job `ia.executar` só com ids: um caso que recuse campo de texto livre no esquema estrito do tipo, em `JOB_DEFINITIONS` | tarefa 5.0, que cria o tipo |
| privacy-guardian (1ª da 3.0) | A cópia `failed` no Redis da `ferramenta` só com o código da falha, sem a mensagem do provedor de IA: caso com erro do adaptador | tarefa 5.0 |
| conformidade-reviewer (1ª da 3.0) | O que a `ferramenta` gera para o aluno nasce pendente com aprovação registrada (regra 70, item 3): teste de integração pelo estado pendente via fila | tarefa 5.0 |
| conformidade-reviewer (1ª da 3.0) | Guarda que recuse job de discursiva ou redação na `ferramenta` (D55) | tarefa 5.0 |
| infra-guardian, conformidade-reviewer, revisor-geral, llm-integrator (1ª da 2.0) | A transação própria da D36 abre dentro da transação de conclusão e ocupa duas conexões do pool; separar um passo "antes da conclusão" no `ComandoExecutavel`, fora do `gravar` | Muda o contrato do `ComandoExecutavel` e o desenho do `concluir`. Destino: tarefa 5.0 (a IA vai ao worker; ela já tem o caso "pool" na tabela). Os quatro dizem que o risco é latente |
| privacy-guardian (1ª da 2.0) | Teste do aluno eliminado entre o `preparar` e o `concluir` com `assunto_delicado` | Precisa de barreira e eliminação no meio; hoje a chave estrangeira garante. Destino: tarefa 5.0 (job) |
| infra-guardian (2ª da 2.0), revisor-geral (2ª da 2.0) | Com o `Promise.all`, o caso da D36 repetida ocupa até quatro conexões do pool da bancada; conferir o tamanho do pool para o teste não ficar instável | tarefa 5.0 (a transação própria da D36 e o caso "pool"), o mesmo destino da recomendação da 1ª rodada acima |
