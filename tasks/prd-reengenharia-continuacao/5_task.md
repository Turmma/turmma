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

- [x] 5.1 — `ia.executar` em `JOB_DEFINITIONS` (§2); o `agendar` o grava pelo `enfileirarUmaVez` na transação
- [x] 5.2 — `main-worker.ts` e `worker.module.ts`; o `AppModule` sem `LLM_PROVIDER`; saem `InProcessAgenteExecutor` e `IA_EXECUCOES_*`
- [x] 5.3 — `ExecucaoProcessor`: as transições condicionais e o prazo único da §5; sem conexão presa durante o modelo
- [x] 5.4 — `ExecucaoRepository` com a escola do contexto, fora de `REPOSITORIES_SEM_ESCOPO`, salvo a varredura
- [x] 5.5 — `apps/api/test/fila-de-ia.fixture.ts`; as 23 trocas de `EXECUTOR_DE_AGENTE` passam por ela; a guarda
- [x] 5.6 — Compose, `IA_REPLICAS`, conexões; rollback (§13); os quatro documentos. Busca:
  `grep -rn "InProcessAgenteExecutor\|IA_EXECUCOES_\|IA_EXECUCAO_TIMEOUT_MS" apps packages docs infra .env.example`
- [x] 5.7 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/main-worker.ts`, `apps/api/src/worker.module.ts`, `apps/api/test/fila-de-ia.fixture.ts`, `tools/guardas/executor-so-na-bancada.test.ts` | novo |
| `apps/api/src/ia/`, `apps/api/src/tutor/`, `apps/api/src/assistente/`, `apps/api/src/artefato/`, `apps/api/src/governanca/`, `apps/api/src/entrega/`, `apps/api/src/app.module.ts`, `apps/api/src/main.ts`, `apps/api/src/config.ts`, `apps/api/test/`, `packages/core/src/ia/executor.ts`, `packages/core/src/config/llm-config.ts`, `packages/core/src/index.ts`, `packages/shared/src/system/job-definitions.ts`, `tools/guardas/escopo-dos-repositories.ts`, `infra/compose.yml`, `.env.example`, `tools/ci/compose.int.test.ts`, `docs/infra.md`, `docs/arquitetura.md`, `docs/guia-do-desenvolvedor.md`, `docs/aia/tutor.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| sem modelo na API | I | `AppModule` sem `LLM_PROVIDER`; `main-worker` sem controller. Mutação: provedor no `AppModule` | `apps/api/src/ia/fila-de-ia.int.test.ts` › o `AppModule` não tem o provedor |
| payload | U | sem id, campo a mais, id não uuid: `DADOS_INVALIDOS` | `fila-de-ia.int.test.ts` › só o id da execução |
| turno pela fila | I | 202, `pendente` e job na mesma transação; conclui; uma troca | `fila-de-ia.int.test.ts` › a execução `pendente` e o job nascem na mesma transação; › o turno do Tutor: 202 |
| clique duplo | P | mesma `chaveEnvio` em `Promise.all`: uma execução, um job | `fila-de-ia.int.test.ts` › clique duplo |
| duplicada depois | I | sobre `concluida`: uma chamada, uma resposta. Mutação: tirar `where estado = 'pendente'` | `fila-de-ia.int.test.ts` › job duplicado sobre a execução concluída |
| prazo único | I | modelo pendurado: `IA_TEMPO_ESGOTADO` aos 140 s e 60 s (Tutor). Mutação: sem `pedido.sinal` | `fila-de-ia.int.test.ts` › o prazo de cada execução é o do perfil |
| desligamento | I | o abort não grava. Mutação: todo abort como prazo | `fila-de-ia.int.test.ts` › o desligamento do worker aborta e não grava |
| configuração do prazo | U | perfil abaixo do `prazoMs` menos a folga | `packages/core/src/ia/prazo-da-execucao.test.ts` › todo perfil tem prazo |
| pool | I | 20 execuções lentas, pool 20: um `select` responde no meio | `fila-de-ia.int.test.ts` › 20 execuções lentas no pool de 20 |
| Redis fora | I | `POST` 202; o job sai na volta | `fila-de-ia.int.test.ts` › o POST dá 202 depressa e o job fica gravado |
| D36 sem job | I | "quero sumir" com a fila cheia e com o Redis fora: mensagem e sinal, nenhum job | `apps/api/src/tutor/tutor.int.test.ts` › a D36 não passa pela fila (os dois casos); › recebe a mensagem fixa na hora; › passa na frente do pacote do mês esgotado |
| S12 pela fila | I | avaliação aberta entre o `POST` e o `preparar`: sem resposta, sem troca | `tutor-modelo.int.test.ts` › a avaliação abre depois do 202 (S12; regra 30, item 10); `tutor.int.test.ts` › abre entre o 202 e a execução |
| Tutor que não roda | I | desligado (D84), suspenso (D9), fora da política (D19): nenhum job. Uma mutação por conferência | `tutor.int.test.ts` › com o Tutor suspenso, a dúvida comum é recusada antes de gravar (D9); › trava o Tutor para os alunos da turma (a avaliação aberta); › passa na frente do pacote do mês esgotado (o 429 do pacote), os três com "nenhum job". **Desligado (D84) e fora da política (D19): sem caso, porque a API não tem essas duas conferências hoje** (`tutor.service.ts`: "nesta fatia não há política de Tutor por turma"); `DIVERGÊNCIA de desenho` enviada ao Orquestrador |
| isolamento, repository | I | contexto da A, execução da B: nem lida nem mudada. Mutação: tirar `escola_id` | `fila-de-ia.int.test.ts` › no contexto da A, a execução da B não é lida nem mudada |
| isolamento, job | I | job da A com `execucaoId` da B: nada muda, sem modelo | `fila-de-ia.int.test.ts` › job da A com o `execucaoId` da B |
| RF2, vagas | P | 5 ferramentas da A juntas: a 5.ª espera, o Tutor da A responde, a B segue | `fila-de-ia.int.test.ts` › cinco ferramentas da A juntas |
| guarda, quem contorna | U | `overrideProvider`, `useValue`, reexportação, `import()`, token como texto | `tools/guardas/executor-so-na-bancada.test.ts` › a suíte que só usa a bancada passa; › quem contorna a bancada |
| guarda, alvo some | U | o token ou a fixture renomeados: vermelho | `tools/guardas/executor-so-na-bancada.test.ts` › com tudo no lugar, nada sumiu |
| escopo | U | o repository fora de `REPOSITORIES_SEM_ESCOPO` | `tools/guardas/repositories-com-escopo.test.ts` (a entrada do `execucao.repository.ts` saiu da lista) |
| compose | I | as duas réplicas, `IA_REPLICAS` igual, conexões para 20 cada (rode à mão) | `tools/ci/ambiente.test.ts` › o `worker-ia` atende as filas da IA; `tools/ci/compose.int.test.ts` › a soma dos pools de todas as instâncias |
| log | I | processador só com ids, tarefa e código | `fila-de-ia.int.test.ts` › o processador loga só ids, a tarefa e o código |

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

1. **Mutação de cada cláusula:** a seção "Mutações" tem um bloco por termo de cada `where` e `and(...)` do `ExecucaoRepository` (`paraIniciar`, `marcarRodando`, `concluirRodando`, `marcarFalhou`, os três `join` de quem pediu), por decisão do processador (não encontrada, já tratada, o prazo do perfil, o sinal do job, quem pediu, a execução relida, a conclusão que achou a execução encerrada, o abort, o código da falha), pelo `antesDeConcluir` e o `sinal` do comando, pelo `agendar`, pelo `if` que força o fechamento do worker, pelas sete partes da configuração do worker, pela `requestSessao`, `requestSessaoDeRequisicao` e `setContextSessao`, e pela guarda. O que não tem bloco está na prosa da seção, com o motivo.
2. **Texto na tela:** a tarefa não toca `apps/web`; nenhum texto novo, e `grep -rln` nos e2e não muda.
3. **Segundo dado:** o repository tem duas escolas (A chama, B é dona) e execuções de fora na B (uma pendente, uma rodando) que ficam como estavam; o caso "quem pediu" tem uma escola por caso; as vagas, duas escolas; a D36, uma pergunta comum à espera ao lado do encaminhamento.
4. **Checagem anterior:** todo "nada muda" tem o controle que muda: o repository chamado no contexto da B muda o que recebe; a pergunta comum da D36 cria o job (`jobsAntes + 1`); o `catálogo` da D55 é o `TAREFAS_DE_IA` inteiro.
5. **Asserção:** o estado final da execução, o do job no outbox, o consumo, o conteúdo do Redis e do log, lidos no banco ou no Redis, nunca o texto do código; o desligamento confere também que o modelo recebeu o abort.
6. **Guarda nova:** `executor-so-na-bancada.test.ts` tem um caso por forma de contornar (`overrideProvider`, `useValue`, reexportação, `import()`, token como texto, caminho relativo) e um para o alvo que some (a bancada apagada, o token renomeado na fonte); o repositório de verdade passa.
7. **Comentários:** os docblocks do processador, do agendador, do `worker-de-ia`, do `ComandoExecutavel` e do `turno.command.ts` dizem o que o código faz agora (job, worker, `antesDeConcluir`); `grep -rn "InProcessAgenteExecutor\|IA_EXECUCOES_\|IA_EXECUCAO_TIMEOUT_MS" apps packages docs infra .env.example` só acha o caso de `llm-config.test.ts` que prova que as variáveis saíram.
8. **Divergências:** as linhas da tabela têm a decisão no `techspec.md` ("Como a 5.0 ficou"); o `prd.md` não diz o contrário. O caso "Tutor que não roda" tem uma divergência de desenho aberta com o Orquestrador (D84 e D19).
9. **Peça que já existe:** `JobExecutor`, `JobOutbox`, `createQueueRedisClient`, `UsageMeter`, `OperationalSettings` e o `EscolaConcurrencyLimiter` do `core`; `SessaoFixtures`, `montarEscolaComTurma` e `urlRedisDeFila` das bancadas; `tools/testes/compose.ts` para parar e subir o Redis. Nada reescrito.
10. **Concorrência:** o clique duplo em `Promise.all` (cinco `agendar` com a mesma chave), o job duplicado sobre a execução concluída, a varredura que encerra a execução enquanto o modelo roda (a resposta e a falha tardias não a reescrevem) e as vagas da escola (RF2).
11. **Isolamento e "Caso":** o repository (`paraIniciar`, `marcarRodando`, `concluirRodando`, `marcarFalhou`) e o job da A com a execução da B têm teste de isolamento; a coluna "Caso" está preenchida.
12. **Guardiões e achados:** `tenancy-guardian` (o repository e o job, a escola vem do contexto), `infra-guardian` (pool sem conexão presa durante o modelo, as duas réplicas e as conexões, a graça do desligamento, o Redis fora), `conformidade-reviewer` (D36 sem fila, D55, a entrega que nasce pendente), `llm-integrator` (o provedor só no worker, o prazo único); as recomendações herdadas da 2.0 e da 3.0 estão na tabela de "Recomendações sem aplicar", com o que foi feito.
13. **Rollback (subtarefa 5.6, Tech Spec §13), conferido na 1ª rodada:** o despachante anterior não trava com o `ia.executar` em voo. O tipo desconhecido vai à fila do worker (`apps/despachante/src/job-publisher.test.ts`: "o tipo da API vai à Queue da API da fila dele, o do worker e o tipo desconhecido, à do worker"); o `worker-interativo` anterior o falha com `TIPO_DESCONHECIDO`, definitivo (`job-executor.ts`), e na `ferramenta` nenhum worker anterior o consome, então o job só fica parado. A execução `pendente` e a `rodando` são encerradas pela varredura da subida da API anterior; o `worker-ia-1` e o `worker-ia-2` continuariam consumindo as filas `api-*` com o compose anterior. O procedimento, com o bloco de SQL, está em `docs/runbook.md`, "Voltar o código depois da 5.0", e `fila-de-ia.int.test.ts` › "a volta do código depois da 5.0" roda o bloco do próprio runbook. Nada trava: não há divergência de desenho.

## Fora do escopo desta tarefa

Reentrega, corrida e varredura nova (6.0); corte (7.0); tokens (10.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O pool de cada fila do `worker-ia` é `WORKER_IA_POOL_INTERATIVA`, `WORKER_IA_POOL_FERRAMENTA` e `WORKER_IA_POOL_NORMAL`, e o pool de conexões, `WORKER_IA_BANCO_POOL_MAXIMO`; a spec dizia `WORKER_POOL_FERRAMENTA` | O `worker-interativo` já lê `WORKER_POOL_INTERATIVA` e `WORKER_POOL_NORMAL` com outros valores (50 e 30) na mesma `.env`: o mesmo nome para as duas réplicas atenderia a fila errada | `techspec.md` §5 "A fila" e "Como a 5.0 ficou" (1); `tools/ci/ambiente.test.ts` |
| O `worker-ia` é a imagem da API (`educa-api`, alvo `api`) com outro `command`, e não um Dockerfile próprio | É o caminho do `migrar`; o `main-worker` é código da API (`apps/api/src/main-worker.ts`), e uma imagem a mais seria um segundo build do mesmo código | `techspec.md` §2, §5 "Como a 5.0 ficou" (1); `tools/ci/compose.int.test.ts` |
| `IA_REPLICAS` é 2 e `POSTGRES_CONEXOES_MAXIMAS`, 300 | As 20 conexões de cada `worker-ia`, mais as da API, dos workers comuns e do despachante, com folga para operação (regra 80, item 9): 250 não comportava as duas réplicas novas (2 × 20) | `techspec.md` §7c, §5 "Como a 5.0 ficou" (1); `tools/ci/compose.int.test.ts` |
| A `ApiConfig` mantém o `ia` | A API não monta o provedor, mas valida a configuração: a subida em produção recusa o adaptador falso, e `IA_REPLICAS` entra no teto por réplica | `techspec.md` §5 "Como a 5.0 ficou" (2); `apps/api/src/config.test.ts` |
| `RequestSessao.sessaoId` é opcional, e `requestSessaoDeRequisicao` é o que exige a sessão | A execução de IA roda como a pessoa que pediu, no worker, sem sessão; sair, trocar de escola e renovar a atividade continuam exigindo | `techspec.md` §5 "Como a 5.0 ficou" (3); `packages/core/src/identidade/request-sessao.test.ts` |
| O `agendar` lê a chave antes de gravar | O `insert … on conflict` espera a transação que muda a linha (o worker, passando-a a `rodando`), e o reenvio esperaria com ele; a corrida do clique duplo em paralelo ainda cai no `on conflict` | `techspec.md` §5 "Como a 5.0 ficou" (4); `fila-de-ia.int.test.ts` › clique duplo |
| O `ComandoExecutavel` ganha o passo opcional `antesDeConcluir`, fora da transação da conclusão | Recomendação das quatro revisões da 2.0: a D36 abria uma transação dentro da da conclusão e segurava duas conexões do pool por execução | `techspec.md` §5 "Como a 5.0 ficou" (5); `execucao-command.test.ts` |
| O Tutor desligado na escola (D84) e fora da política da turma (D19) não têm caso "nenhum job"; a spec pedia os três (desligado, suspenso, fora da política) | A API de hoje só confere a função suspensa (D9), a avaliação aberta na turma e o freio e o pacote (`tutor.service.ts`: "nesta fatia não há política de Tutor por turma"); `fora` nem é devolvido em `GET /v1/tutor/conversa`, e não há campo de escola "Tutor liberado". Criar as duas conferências é funcionalidade nova, e não desta tarefa | `techspec.md` §5 "Como a 5.0 ficou" (7); `cenarios.md` §7 (a linha do Tutor desligado); `DIVERGÊNCIA de desenho` enviada ao Orquestrador |

## Mutações

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › no contexto da A, a execução da B não é lida nem mudada
-      .where(and(eq(execucaoAgente.escolaId, escolaId), eq(execucaoAgente.id, id)))
+      .where(and(eq(execucaoAgente.id, id)))
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › no contexto da A, a execução da B não é lida nem mudada
-      .where(and(eq(execucaoAgente.escolaId, escolaId), eq(execucaoAgente.id, id)))
+      .where(and(eq(execucaoAgente.escolaId, escolaId)))
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › quem pediu foi desativado
-        and(eq(usuario.escolaId, execucaoAgente.escolaId), eq(usuario.id, execucaoAgente.solicitadaPor), isNull(usuario.desativadoEm), isNull(usuario.eliminacaoAgendadaEm)),
+        and(eq(usuario.escolaId, execucaoAgente.escolaId), eq(usuario.id, execucaoAgente.solicitadaPor), isNull(usuario.eliminacaoAgendadaEm)),
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › quem pediu foi desativado
-        and(eq(usuario.escolaId, execucaoAgente.escolaId), eq(usuario.id, execucaoAgente.solicitadaPor), isNull(usuario.desativadoEm), isNull(usuario.eliminacaoAgendadaEm)),
+        and(eq(usuario.escolaId, execucaoAgente.escolaId), eq(usuario.id, execucaoAgente.solicitadaPor), isNull(usuario.desativadoEm)),
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › o turno do Tutor: 202
-        and(eq(usuario.escolaId, execucaoAgente.escolaId), eq(usuario.id, execucaoAgente.solicitadaPor), isNull(usuario.desativadoEm), isNull(usuario.eliminacaoAgendadaEm)),
+        and(eq(usuario.escolaId, execucaoAgente.escolaId), isNull(usuario.desativadoEm), isNull(usuario.eliminacaoAgendadaEm)),
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › quem pediu foi desativado
-      .leftJoin(anoLetivo, and(eq(anoLetivo.escolaId, execucaoAgente.escolaId), eq(anoLetivo.id, execucaoAgente.anoLetivoId), eq(anoLetivo.situacao, 'em_curso')))
+      .leftJoin(anoLetivo, and(eq(anoLetivo.escolaId, execucaoAgente.escolaId), eq(anoLetivo.id, execucaoAgente.anoLetivoId)))
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › quem pediu foi desativado
-      .leftJoin(anoLetivo, and(eq(anoLetivo.escolaId, execucaoAgente.escolaId), eq(anoLetivo.id, execucaoAgente.anoLetivoId), eq(anoLetivo.situacao, 'em_curso')))
+      .leftJoin(anoLetivo, and(eq(anoLetivo.escolaId, execucaoAgente.escolaId), eq(anoLetivo.situacao, 'em_curso')))
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › quem pediu foi desativado
-    const quemPediu = linha.usuarioId !== null && linha.papel !== null && linha.anoEmCurso !== null ? { usuarioId: linha.usuarioId, papel: linha.papel, anoLetivoId: linha.anoLetivoId } : undefined
+    const quemPediu = linha.usuarioId !== null && linha.papel !== null ? { usuarioId: linha.usuarioId, papel: linha.papel, anoLetivoId: linha.anoLetivoId } : undefined
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › no contexto da A, a execução da B não é lida nem mudada
-      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id), eq(execucaoAgente.estado, 'pendente')))
+      .where(and(eq(execucaoAgente.id, id), eq(execucaoAgente.estado, 'pendente')))
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › no contexto da A, a execução da B não é lida nem mudada
-      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id), eq(execucaoAgente.estado, 'pendente')))
+      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.estado, 'pendente')))
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › job duplicado sobre a execução concluída
-      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id), eq(execucaoAgente.estado, 'pendente')))
+      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id)))
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › no contexto da A, a execução da B não é lida nem mudada
       .set({ estado: 'concluida', resultado: referencia, concluidaEm: sql`now()` })
-      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id), eq(execucaoAgente.estado, 'rodando')))
+      .where(and(eq(execucaoAgente.id, id), eq(execucaoAgente.estado, 'rodando')))
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › no contexto da A, a execução da B não é lida nem mudada
       .set({ estado: 'concluida', resultado: referencia, concluidaEm: sql`now()` })
-      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id), eq(execucaoAgente.estado, 'rodando')))
+      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.estado, 'rodando')))
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › a varredura encerrou a execução enquanto o modelo rodava
       .set({ estado: 'concluida', resultado: referencia, concluidaEm: sql`now()` })
-      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id), eq(execucaoAgente.estado, 'rodando')))
+      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id)))
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › no contexto da A, a execução da B não é lida nem mudada
       .set({ estado: 'falhou', erro: codigo, concluidaEm: sql`now()` })
-      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id), eq(execucaoAgente.estado, 'rodando')))
+      .where(and(eq(execucaoAgente.id, id), eq(execucaoAgente.estado, 'rodando')))
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › no contexto da A, a execução da B não é lida nem mudada
       .set({ estado: 'falhou', erro: codigo, concluidaEm: sql`now()` })
-      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id), eq(execucaoAgente.estado, 'rodando')))
+      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.estado, 'rodando')))
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › a varredura encerrou a execução enquanto o modelo rodava
       .set({ estado: 'falhou', erro: codigo, concluidaEm: sql`now()` })
-      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id), eq(execucaoAgente.estado, 'rodando')))
+      .where(and(eq(execucaoAgente.escolaId, requireEscolaId()), eq(execucaoAgente.id, id)))
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › no contexto da A, a execução da B não é lida nem mudada
-    const referencia = resultadoGravadoSchema.parse(resultado)
+    const referencia = resultado
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › quem pediu foi desativado
-      if (paraRodar === undefined || paraRodar.tarefa !== comando.tarefa) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+      if ((false as boolean) || paraRodar.tarefa !== comando.tarefa) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › no contexto da A, a execução da B não é lida nem mudada
       .where(and(eq(execucaoAgente.escolaId, escolaId), eq(execucaoAgente.id, id)))
-    if (linha === undefined) return undefined
+    if (false as boolean) return undefined
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › job da A com o
-    if (lida === undefined) {
+    if (false as boolean) {
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › job duplicado sobre a execução concluída
-    if (!(await execucoes.marcarRodando(execucaoId))) {
+    if ((await execucoes.marcarRodando(execucaoId)) && (false as boolean)) {
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › job da A com o
       logger.warn({ evento: 'ia.execucao.nao_encontrada', execucaoId, escolaId })
-      throw new JobFailureError(JobFailureCode.DADOS_INVALIDOS, true)
+      return
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › job duplicado sobre a execução concluída
       logger.info({ evento: 'ia.execucao.ja_tratada', execucaoId, escolaId, estado: lida.estado })
-      return
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › o prazo de cada execução é o do perfil
falha: expect(prazos[0]?.ms).toBe(60_000)
-    const prazo = (this.dependencias.prazo ?? prazoPorTemporizador)(PRAZO_DA_EXECUCAO_MS[comando?.perfil ?? 'padrao'])
+    const prazo = (this.dependencias.prazo ?? prazoPorTemporizador)(PRAZO_DA_EXECUCAO_MS.padrao)
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › o prazo de cada execução é o do perfil
-    const prazo = (this.dependencias.prazo ?? prazoPorTemporizador)(PRAZO_DA_EXECUCAO_MS[comando?.perfil ?? 'padrao'])
+    const prazo = prazoPorTemporizador(PRAZO_DA_EXECUCAO_MS[comando?.perfil ?? 'padrao'])
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › a tarefa da execução não tem comando registrado
-    const prazo = (this.dependencias.prazo ?? prazoPorTemporizador)(PRAZO_DA_EXECUCAO_MS[comando?.perfil ?? 'padrao'])
+    const prazo = (this.dependencias.prazo ?? prazoPorTemporizador)(PRAZO_DA_EXECUCAO_MS[comando!.perfil])
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › o desligamento do worker aborta e não grava
falha: expect(abortado).toBe(true)
-    const sinal = sinalDoJob === undefined ? prazo.sinal : AbortSignal.any([sinalDoJob, prazo.sinal])
+    const sinal = prazo.sinal
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › quem pediu foi desativado
-    if (lida.quemPediu === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+    if (false as boolean) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › quem pediu foi desativado
-      if (paraRodar === undefined || paraRodar.tarefa !== comando.tarefa) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+      if (paraRodar?.tarefa !== comando.tarefa && paraRodar !== undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › a varredura encerrou a execução enquanto o modelo rodava
-        if (!(await new ExecucaoRepository(tx).concluirRodando(execucaoId, resultado))) throw new ExecucaoJaEncerrada()
+        await new ExecucaoRepository(tx).concluirRodando(execucaoId, resultado)
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › o desligamento do worker aborta e não grava
-    if (sinalDoJob?.aborted === true) {
+    if (sinalDoJob?.aborted === true && false) {
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › a varredura encerrou a execução enquanto o modelo rodava
-    if (erro instanceof ExecucaoJaEncerrada) {
+    if (erro instanceof ExecucaoJaEncerrada && false) {
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › o prazo de cada execução é o do perfil
-    const codigo = prazo.aborted ? ErrorCode.IA_TEMPO_ESGOTADO : erro instanceof DomainException ? erro.codigo : ErrorCode.ERRO_INTERNO
+    const codigo = erro instanceof DomainException ? erro.codigo : ErrorCode.ERRO_INTERNO
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › quem pediu foi desativado
-    const codigo = prazo.aborted ? ErrorCode.IA_TEMPO_ESGOTADO : erro instanceof DomainException ? erro.codigo : ErrorCode.ERRO_INTERNO
+    const codigo = prazo.aborted ? ErrorCode.IA_TEMPO_ESGOTADO : ErrorCode.ERRO_INTERNO
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › a tarefa da execução não tem comando registrado
-    await new ExecucaoRepository(banco)
-      .marcarFalhou(execucaoId, codigo)
-      .catch((erroAoGravar: unknown) => {
-        // Só ids e o código: a mensagem do erro do banco não vai ao log (regra 20, item 9).
-        logger.warn({ evento: 'ia.execucao.falha_nao_gravada', execucaoId, escolaId, codigo, erro: summarizeError(erroAoGravar) })
-        return false
-      })
+    void codigo
```

```mutacao
arquivo: apps/api/src/ia/execucao-command.ts
teste: apps/api/src/ia/execucao-command.test.ts
-      if (jaGravado !== undefined) return gravar(() => Promise.resolve(jaGravado))
```

```mutacao
arquivo: apps/api/src/ia/execucao-command.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › o prazo de cada execução é o do perfil
         execucaoId: execucao.id,
-        sinal,
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor-modelo.int.test.ts › o modelo classificou assunto delicado
-    return saida.classificacao === 'assunto_delicado' ? { tipo: 'mensagem_do_tutor', mensagemId: await this.#encaminhar(pergunta, saida) } : undefined
+    return undefined
```

```mutacao
arquivo: apps/api/src/tutor/turno.command.ts
teste: apps/api/src/tutor/tutor.int.test.ts › grava a pergunta com a execução, responde por pergunta
-    return saida.classificacao === 'assunto_delicado' ? { tipo: 'mensagem_do_tutor', mensagemId: await this.#encaminhar(pergunta, saida) } : undefined
+    return { tipo: 'mensagem_do_tutor', mensagemId: await this.#encaminhar(pergunta, saida) }
```

```mutacao
arquivo: apps/api/src/ia/execucao.scheduler.ts
teste: apps/api/src/ia/ia.int.test.ts › o pedido com a entrada gravada de outra tarefa
-    if (entradaDaExecucao.tarefa !== comando.tarefa) throw new LLMError('IA_ENTRADA_INVALIDA')
```

```mutacao
arquivo: apps/api/src/ia/execucao.scheduler.ts
teste: apps/api/src/ia/ia.int.test.ts › o pedido com a entrada gravada de outra tarefa
-    if (existente.tarefa !== tarefa) throw new DomainException(ErrorCode.CONFLITO)
```

```mutacao
arquivo: apps/api/src/ia/worker-de-ia.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › o desligamento do worker aborta e não grava
-  if (resultado === 'estourou') {
+  if (resultado === 'nunca') {
```

```mutacao
arquivo: apps/api/src/worker-config.ts
teste: apps/api/src/worker-config.test.ts › cada parte que falta
-  if (banco === undefined || proprio === undefined || pools === undefined || vagasPadrao === undefined || vagasDesligadas === undefined || telemetria === undefined || ia === undefined) {
+  if (proprio === undefined || pools === undefined || vagasPadrao === undefined || vagasDesligadas === undefined || telemetria === undefined || ia === undefined) {
```

```mutacao
arquivo: apps/api/src/worker-config.ts
teste: apps/api/src/worker-config.test.ts › cada parte que falta
-  if (banco === undefined || proprio === undefined || pools === undefined || vagasPadrao === undefined || vagasDesligadas === undefined || telemetria === undefined || ia === undefined) {
+  if (banco === undefined || pools === undefined || vagasPadrao === undefined || vagasDesligadas === undefined || telemetria === undefined || ia === undefined) {
```

```mutacao
arquivo: apps/api/src/worker-config.ts
teste: apps/api/src/worker-config.test.ts › cada parte que falta
-  if (banco === undefined || proprio === undefined || pools === undefined || vagasPadrao === undefined || vagasDesligadas === undefined || telemetria === undefined || ia === undefined) {
+  if (banco === undefined || proprio === undefined || vagasPadrao === undefined || vagasDesligadas === undefined || telemetria === undefined || ia === undefined) {
```

```mutacao
arquivo: apps/api/src/worker-config.ts
teste: apps/api/src/worker-config.test.ts › cada parte que falta
-  if (banco === undefined || proprio === undefined || pools === undefined || vagasPadrao === undefined || vagasDesligadas === undefined || telemetria === undefined || ia === undefined) {
+  if (banco === undefined || proprio === undefined || pools === undefined || vagasDesligadas === undefined || telemetria === undefined || ia === undefined) {
```

```mutacao
arquivo: apps/api/src/worker-config.ts
teste: apps/api/src/worker-config.test.ts › cada parte que falta
-  if (banco === undefined || proprio === undefined || pools === undefined || vagasPadrao === undefined || vagasDesligadas === undefined || telemetria === undefined || ia === undefined) {
+  if (banco === undefined || proprio === undefined || pools === undefined || vagasPadrao === undefined || telemetria === undefined || ia === undefined) {
```

```mutacao
arquivo: apps/api/src/worker-config.ts
teste: apps/api/src/worker-config.test.ts › cada parte que falta
-  if (banco === undefined || proprio === undefined || pools === undefined || vagasPadrao === undefined || vagasDesligadas === undefined || telemetria === undefined || ia === undefined) {
+  if (banco === undefined || proprio === undefined || pools === undefined || vagasPadrao === undefined || vagasDesligadas === undefined || ia === undefined) {
```

```mutacao
arquivo: apps/api/src/worker-config.ts
teste: apps/api/src/worker-config.test.ts › cada parte que falta
-  if (banco === undefined || proprio === undefined || pools === undefined || vagasPadrao === undefined || vagasDesligadas === undefined || telemetria === undefined || ia === undefined) {
+  if (banco === undefined || proprio === undefined || pools === undefined || vagasPadrao === undefined || vagasDesligadas === undefined || telemetria === undefined) {
```

```mutacao
arquivo: apps/api/src/worker-config.ts
teste: apps/api/src/worker-config.test.ts › cada parte que falta
-  REDIS_FILA_URL: z.string().regex(/^redis:\/\/[^/\s]+(\/\d+)?$/),
+  REDIS_FILA_URL: z.string(),
```

```mutacao
arquivo: apps/api/src/worker-config.ts
teste: apps/api/src/worker-config.test.ts › o controle negativo
-    ...(vagasDesligadas ? { vagasPorEscolaDesligadas: true as const } : {}),
+    ...({}),
```

```mutacao
arquivo: packages/core/src/identidade/auth.guard.ts
teste: packages/core/src/identidade/request-sessao.test.ts › sem escola, pessoa, papel ou ano
-  if (contexto?.escolaId === undefined || contexto.usuarioId === undefined || contexto.papel === undefined || contexto.anoLetivoId === undefined) {
+  if (contexto.usuarioId === undefined || contexto.papel === undefined || contexto.anoLetivoId === undefined) {
```

```mutacao
arquivo: packages/core/src/identidade/auth.guard.ts
teste: packages/core/src/identidade/request-sessao.test.ts › sem escola, pessoa, papel ou ano
-  if (contexto?.escolaId === undefined || contexto.usuarioId === undefined || contexto.papel === undefined || contexto.anoLetivoId === undefined) {
+  if (contexto?.escolaId === undefined || contexto.papel === undefined || contexto.anoLetivoId === undefined) {
```

```mutacao
arquivo: packages/core/src/identidade/auth.guard.ts
teste: packages/core/src/identidade/request-sessao.test.ts › sem escola, pessoa, papel ou ano
-  if (contexto?.escolaId === undefined || contexto.usuarioId === undefined || contexto.papel === undefined || contexto.anoLetivoId === undefined) {
+  if (contexto?.escolaId === undefined || contexto.usuarioId === undefined || contexto.anoLetivoId === undefined) {
```

```mutacao
arquivo: packages/core/src/identidade/auth.guard.ts
teste: packages/core/src/identidade/request-sessao.test.ts › sem escola, pessoa, papel ou ano
-  if (contexto?.escolaId === undefined || contexto.usuarioId === undefined || contexto.papel === undefined || contexto.anoLetivoId === undefined) {
+  if (contexto?.escolaId === undefined || contexto.usuarioId === undefined || contexto.papel === undefined) {
```

```mutacao
arquivo: packages/core/src/identidade/auth.guard.ts
teste: packages/core/src/identidade/request-sessao.test.ts › `requestSessao` devolve
-  return { escolaId: contexto.escolaId, usuarioId: contexto.usuarioId, papel: contexto.papel, anoLetivoId: contexto.anoLetivoId, ...(contexto.sessaoId === undefined ? {} : { sessaoId: contexto.sessaoId }) }
+  return { escolaId: contexto.escolaId, usuarioId: contexto.usuarioId, papel: contexto.papel, anoLetivoId: contexto.anoLetivoId, sessaoId: contexto.sessaoId }
```

```mutacao
arquivo: packages/core/src/identidade/auth.guard.ts
teste: packages/core/src/identidade/request-sessao.test.ts › `requestSessaoDeRequisicao` exige
-  if (sessao.sessaoId === undefined) throw new DomainException(ErrorCode.NAO_AUTENTICADO)
```

```mutacao
arquivo: packages/core/src/context/context.ts
teste: packages/core/src/identidade/request-sessao.test.ts › `setContextSessao` grava
-  if (sessao.sessaoId !== undefined) contexto.sessaoId = sessao.sessaoId
+  contexto.sessaoId = sessao.sessaoId
```

```mutacao
arquivo: tools/guardas/executor-so-na-bancada.ts
teste: tools/guardas/executor-so-na-bancada.test.ts › a bancada é o único arquivo
-  if (caminho === CAMINHO_DA_BANCADA) return false
```

```mutacao
arquivo: tools/guardas/executor-so-na-bancada.ts
teste: tools/guardas/executor-so-na-bancada.test.ts › um arquivo de pasta
-  return /\.(test|fixture)\.tsx?$/u.test(caminho) || /(^|\/)(test|e2e)\//u.test(caminho)
+  return /\.(test|fixture)\.tsx?$/u.test(caminho)
```

```mutacao
arquivo: tools/guardas/executor-so-na-bancada.ts
teste: tools/guardas/executor-so-na-bancada.test.ts › um arquivo `.fixture.ts` conta como teste
-  return /\.(test|fixture)\.tsx?$/u.test(caminho) || /(^|\/)(test|e2e)\//u.test(caminho)
+  return /(^|\/)(test|e2e)\//u.test(caminho)
```

```mutacao
arquivo: tools/guardas/executor-so-na-bancada.ts
teste: tools/guardas/executor-so-na-bancada.test.ts › a bancada é o único arquivo
-    if (!ehArquivoDeTeste(arquivo.caminho)) continue
```

```mutacao
arquivo: tools/guardas/executor-so-na-bancada.ts
teste: tools/guardas/executor-so-na-bancada.test.ts › quem contorna a bancada
-    for (const { nome } of ALVOS_DA_BANCADA) if (ehNome(texto, nome)) violacoes.push({ arquivo: arquivo.caminho, alvo: nome })
```

```mutacao
arquivo: tools/guardas/executor-so-na-bancada.ts
teste: tools/guardas/executor-so-na-bancada.test.ts › quem contorna a bancada
-    for (const modulo of MODULOS_DA_BANCADA) if (texto.includes(modulo)) violacoes.push({ arquivo: arquivo.caminho, alvo: modulo })
```

```mutacao
arquivo: tools/guardas/executor-so-na-bancada.ts
teste: tools/guardas/executor-so-na-bancada.test.ts › o alvo some
-  if (!existsSync(join(raiz, CAMINHO_DA_BANCADA))) sumidos.push(CAMINHO_DA_BANCADA)
```

```mutacao
arquivo: tools/guardas/executor-so-na-bancada.ts
teste: tools/guardas/executor-so-na-bancada.test.ts › o alvo some
-    if (!existsSync(caminho) || !ehNome(readFileSync(caminho, 'utf8'), nome)) sumidos.push(`${nome} em ${definidoEm}`)
+    if (!ehNome(readFileSync(caminho, 'utf8'), nome)) sumidos.push(`${nome} em ${definidoEm}`)
```

```mutacao
arquivo: tools/guardas/executor-so-na-bancada.ts
teste: tools/guardas/executor-so-na-bancada.test.ts › o alvo some
-    if (!existsSync(caminho) || !ehNome(readFileSync(caminho, 'utf8'), nome)) sumidos.push(`${nome} em ${definidoEm}`)
+    if (!existsSync(caminho)) sumidos.push(`${nome} em ${definidoEm}`)
```

```mutacao
arquivo: tools/guardas/executor-so-na-bancada.ts
teste: tools/guardas/executor-so-na-bancada.test.ts › o alvo some
-  for (const modulo of MODULOS_DA_BANCADA) if (!existsSync(join(raiz, 'apps/api/src/ia', `${modulo}.ts`))) sumidos.push(modulo)
```

```mutacao
arquivo: apps/api/src/ia/execucao.scheduler.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › a execução `pendente` e o job nascem na mesma transação
-        await this.fila.enfileirarUmaVez(tx, TIPO_EXECUTAR_IA, { execucaoId: nova }, nova, { fila: comando.fila })
+        await this.fila.enfileirarUmaVez(this.banco, TIPO_EXECUTAR_IA, { execucaoId: nova }, nova, { fila: comando.fila })
```

```mutacao
arquivo: apps/api/src/ia/prazo-por-temporizador.ts
teste: apps/api/src/ia/prazo-por-temporizador.test.ts › o sinal não está abortado um milissegundo antes do prazo, e está abortado nele
-  const temporizador = setTimeout(() => controle.abort(), prazoMs)
+  const temporizador = setTimeout(() => controle.abort(), prazoMs * 1000)
```

```mutacao
arquivo: apps/api/src/ia/prazo-por-temporizador.ts
teste: apps/api/src/ia/prazo-por-temporizador.test.ts › o prazo de 140 s do perfil padrão não aborta aos 60 s
-  const temporizador = setTimeout(() => controle.abort(), prazoMs)
+  const temporizador = setTimeout(() => controle.abort(), 60_000)
```

```mutacao
arquivo: apps/api/src/ia/prazo-por-temporizador.ts
teste: apps/api/src/ia/prazo-por-temporizador.test.ts › o sinal não está abortado um milissegundo antes do prazo, e está abortado nele
-  const temporizador = setTimeout(() => controle.abort(), prazoMs)
+  const temporizador = setTimeout(() => undefined, prazoMs)
```

```mutacao
arquivo: apps/api/src/ia/prazo-por-temporizador.ts
teste: apps/api/src/ia/prazo-por-temporizador.test.ts › depois do `cancelar`, o sinal não aborta mais, e não fica temporizador pendente
-  return { sinal: controle.signal, cancelar: () => clearTimeout(temporizador) }
+  return { sinal: controle.signal, cancelar: () => undefined }
```

```mutacao
arquivo: apps/api/src/ia/prazo-por-temporizador.ts
teste: apps/api/src/ia/prazo-por-temporizador.test.ts › o temporizador não segura o processo aberto, por causa do `unref`
-  temporizador.unref()
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › a falha que não se grava deixa o aviso
-        logger.warn({ evento: 'ia.execucao.falha_nao_gravada', execucaoId, escolaId, codigo, erro: summarizeError(erroAoGravar) })
```

```mutacao
arquivo: apps/api/src/ia/ia.module.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › o `AppModule` não tem o provedor
-        { provide: RegistroDeComandos, useFactory: () => new RegistroDeComandos() },
+        { provide: RegistroDeComandos, useFactory: () => new RegistroDeComandos() },
+        { provide: LLM_PROVIDER, useValue: {} },
```

```mutacao
arquivo: apps/api/src/ia/execucao.scheduler.ts
teste: apps/api/src/tutor/tutor.int.test.ts › com o Tutor suspenso, a dúvida comum é recusada antes de gravar; retomado, volta
-    await exigirFuncaoAtiva(this.suspensao, comando.funcao)
```

```mutacao
arquivo: apps/api/src/tutor/tutor.service.ts
teste: apps/api/src/tutor/tutor.int.test.ts › trava o Tutor para os alunos da turma, e só para ela; encerrada, destrava
-    if (jaAceita === undefined && (await new TutorDoAlunoRepository(this.banco).avaliativaAberta(turmaId)) !== undefined) throw new DomainException(ErrorCode.TUTOR_PAUSADO_EM_AVALIACAO)
```

```mutacao
arquivo: apps/api/src/tutor/tutor.service.ts
teste: apps/api/src/tutor/tutor.int.test.ts › dez envios ao mesmo tempo, a três trocas do limite, gravam só os três que cabem
         // Recusar aqui desfaz a transação: nem a execução nem a pergunta ficam gravadas, e a troca não é contada.
-        if (!decisao.permitido) throw new LLMError(decisao.codigo, decisao.tenteDeNovoEmSegundos)
+        void decisao
```

Os 80 blocos acima (os 69 da primeira entrega, mais os 11 da ordem da 1ª rodada: a mesma transação do job, o `prazoPorTemporizador`, o aviso da falha que não se grava, o provedor no `AppModule`, e as conferências do Tutor que existem) foram corridos um a um (`node tools/processo/mutacoes.ts`): cada um deixa o teste vermelho. As sete mutações que ficaram verdes na primeira corrida
(a do `id` na leitura, a do `estado = 'pendente'` no job duplicado, a do `resultadoGravadoSchema.parse`, a da trava de produção no `loadWorkerConfig`, a da regra de
`.fixture.ts` e as duas do alvo que some) levaram a reforço de teste, e não a bloco trocado: o caso do repository ganhou execuções da própria escola A, o do job
duplicado confere o estado do segundo job, a conclusão com campo a mais confere o que chega ao banco, o do worker liga a produção com a IA válida e a guarda ganhou os
casos do `.fixture.ts` e do arquivo que some.

**Sem mutação**, cada termo com o motivo (o que a conferência `--faltando` lista, e o que ela não alcança):

- `ComandosDeIaModule.forRoot(opcoes.medidor === undefined ? {} : { medidor: opcoes.medidor })` e `medidor ?? globalMeter()`: só escolhem de onde vem o medidor (o do teste ou o global). O que ele mede está em `infra/test/metricas.int.test.ts`, e nenhuma regra de negócio muda com a escolha.
- `if (comando === undefined) throw new InvariantException(...)`: sem a linha, `comando.executar` lança `TypeError` dentro do mesmo `try`, que cai no mesmo `#aoFalhar` e grava `ERRO_INTERNO`. O caso "a tarefa da execução não tem comando registrado" prova o resultado (falhou, sem modelo), e a forma de chegar nele é a mesma.
- `requisicaoId: currentContext()?.requisicaoId ?? randomUUID()`: só o id de correlação do log, que não entra em nenhuma decisão.
- `paraRodar.tarefa !== comando.tarefa`: defesa em profundidade. O `comando` vem de `lida.tarefa`, da mesma linha que o `paraExecutar` relê pelo id, e o check `execucao_agente_entrada_da_tarefa` a prende à entrada; nenhuma linha do banco faz os dois divergirem.
- `erro instanceof LLMError` e `erro instanceof DomainException` (o `erroDoLog`): só dizem se o log leva o resumo do erro (nome e pilha, nunca a mensagem do provedor). O código que vai à execução e o que o log mostra não mudam, e o caso do log só com ids confere a ausência da mensagem.
- `eq(usuario.escolaId, execucaoAgente.escolaId)` e `eq(anoLetivo.escolaId, execucaoAgente.escolaId)` (os dois `leftJoin` do `paraIniciar`): defesa em profundidade da regra 10. A chave estrangeira composta com a escola (`execucao_agente.solicitada_por` e o ano letivo) já impede a linha em que a pessoa ou o ano são de outra escola, e nenhum teste monta a linha que o banco recusa.
- `linha.usuarioId !== null` e `linha.papel !== null`: vêm da mesma linha do `leftJoin` da pessoa, e um é nulo se e só se o outro é (o `papel` não é nulo na tabela). O TypeScript pede os dois para estreitar o tipo; o termo do ano em curso tem bloco, e o caso "quem pediu foi desativado" cobre a pessoa ausente.
- `!(await estados.marcarRodando(nova))` e `!(await estados.concluirRodando(nova, ...))` (o encaminhamento direto da D36, no `tutor.service.ts`): a execução acabou de ser gravada `pendente` na mesma transação, e nada a muda antes; o ramo só existe para o `false` que não acontece, e vira `IA_INDISPONIVEL` se acontecer.
- `if (reenvio !== undefined) return this.#doReenvio(...)` (o `agendar`): é a leitura antes de gravar, uma otimização do caso comum de chave repetida. Sem ela, o `insert … on conflict do nothing` devolve `undefined` e o caminho de baixo lê a mesma execução, com o mesmo resultado, só esperando a transação do worker.
- `if (total > 0) this.logger.warn(...)` (a varredura): só o aviso de quantas encerrou; a varredura em si é da 6.0.
- `.catch(...)` e o `return false` do `marcarFalhou` (`#aoFalhar`): o corpo do `catch` tem bloco (o aviso `ia.execucao.falha_nao_gravada`); o `return false` só dá ao `catch` o tipo que o `await` pede, e ninguém lê o valor.
- `erro: summarizeError(erroAoGravar)` no aviso da falha que não se grava: trocar por `String(erroAoGravar)` não muda o que o caso vê, porque o Drizzle esconde a mensagem do banco sob o `Failed query`; a regra de não pôr a mensagem no log é a do item 5 do docblock, e o caso confere que o texto do gatilho não aparece.
- `if (!decisao.permitido) throw ...` **antes** da transação do `tutor.service.ts` (a recusa rápida do pacote e do freio): é uma otimização, e tirá-la não muda o que o `POST` responde, porque a mesma conferência dentro da transação (`aoGravar`) recusa com o mesmo código e desfaz o que gravou. A de dentro tem bloco (o caso dos dez envios ao mesmo tempo).
- A suspensão (D9), a avaliação aberta (regra 30, item 10) e o pacote do mês são as três conferências do Tutor que a API tem; o desligado (D84) e a fora da política (D19) não existem na API, como a divergência do documento diz.
- No `worker-de-ia.ts`, as opções que só o teste troca (`opcoes.prefixo`, `opcoes.definicoes`, `opcoes.intervaloRenovacaoDaVagaMs`, `opcoes.graca`), `concorrencia === undefined` (fila sem pool, que a configuração nem monta), o `medidor`, o contador `stalled` e o `aguardandoVaga` (a métrica é conferida em `infra/test/metricas.int.test.ts` e `packages/core/src/telemetry/metrics.test.ts`), o aviso das vagas desligadas e o `encerramento ??=` (a segunda chamada de `encerrar` devolve a primeira): só ligam o que já tem teste no `JobExecutor` do `core`, ou a opção que o teste troca.
- `if (!(erro instanceof InvalidConfigError)) throw erro` (`worker-config.ts`): só repassa o erro que não é de configuração; o que importa, a lista de variáveis de cada parte, tem bloco.
- Na guarda (`tools/guardas/executor-so-na-bancada.ts`): o regex de comentários, o `ehNome`, o `if (definidoEm === '') continue`, a leitura das pastas (`PASTAS_IGNORADAS`, `isDirectory`, `/\.tsx?$/`, o `existsSync` das bases `apps` e `e2e`) são o que o teste da guarda exercita por fixture (comentário que não conta, nome colado a outro, pasta de `node_modules`); o `--faltando` só informa sobre `tools/`, que não é o código do produto.

## Recomendações sem aplicar

Herdadas das tarefas 3.0 e 2.0, destino 5.0 (copiadas das tabelas delas antes de a 5.0 começar):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª da 3.0) | `docs/runbook.md`, causa 1: diagnóstico cita só `worker-interativo-*`; com o `worker-ia` o alerta na `ferramenta` pede o `ps` e o `logs` dele | **Atendida:** `docs/runbook.md`, causas 1 e 2 e o comando de diagnóstico, citam o `worker-ia-1` e o `worker-ia-2` (`ps` e `logs`) e mandam olhá-los primeiro no alerta da `ferramenta` e no da `interativa` do Tutor |
| revisor-geral (1ª da 3.0) | `docs/arquitetura.md` e `docs/infra.md` dizem "nenhuma réplica atende a `ferramenta` antes do `worker-ia`, na 5.0": a frase deixa de valer | **Atendida:** `docs/arquitetura.md` e `docs/infra.md` descrevem o `worker-ia` (a mesma imagem da API, o pool de cada fila, as conexões); `grep -rn "antes do .worker-ia" docs infra` não acha mais a frase |
| test-engineer (1ª da 3.0) | `infra/test/alertas.int.test.ts:305`: o caso da `ferramenta` esperando depende de nenhuma réplica a atender; com o `worker-ia` quebra | **Atendida:** o caso da `ferramenta` esperando (`infra/test/alertas.int.test.ts`) usa o job sintético do executor `worker`, na fila `ferramenta` sem sufixo, que nenhum `worker-*` atende (o `worker-ia` só lê a `api-ferramenta`); o comentário diz isso |
| test-engineer (1ª da 3.0) | `tools/ci/ambiente.test.ts:150`: a conta "dez escolas cabem nos pools" deixa a `FERRAMENTA` de fora sem dizer | **Atendida:** o `tools/ci/ambiente.test.ts` ganhou o caso das vagas do Tutor e da ferramenta de dez escolas (D25) nos pools da IA; o nome da variável é `WORKER_IA_POOL_FERRAMENTA` (divergência registrada acima) |
| privacy-guardian (1ª da 3.0) | O `dados` do job `ia.executar` só com ids: um caso que recuse campo de texto livre no esquema estrito do tipo, em `JOB_DEFINITIONS` | **Atendida:** `fila-de-ia.int.test.ts` › só o id da execução (sem id, id que não é uuid, campo a mais e texto livre são recusados pelo esquema estrito de `ia.executar`) |
| privacy-guardian (1ª da 3.0) | A cópia `failed` no Redis da `ferramenta` só com o código da falha, sem a mensagem do provedor de IA: caso com erro do adaptador | **Atendida:** `fila-de-ia.int.test.ts` › o erro do modelo não vai à cópia do job no Redis, nem ao registro, nem ao log: a execução falha só com o código |
| conformidade-reviewer (1ª da 3.0) | O que a `ferramenta` gera para o aluno nasce pendente com aprovação registrada (regra 70, item 3): teste de integração pelo estado pendente via fila | **Atendida:** `entrega.int.test.ts` e `artefato.int.test.ts` passam pela fila de verdade (`FilaDeIa`) e conferem a entrega `pendente` com a aprovação registrada |
| conformidade-reviewer (1ª da 3.0) | Guarda que recuse job de discursiva ou redação na `ferramenta` (D55) | **Atendida:** `fila-de-ia.int.test.ts` › a IA não tem tarefa de discursiva nem de redação, e o catálogo que o worker consome não cresce por fora (D55) |
| infra-guardian, conformidade-reviewer, revisor-geral, llm-integrator (1ª da 2.0) | A transação própria da D36 abre dentro da transação de conclusão e ocupa duas conexões do pool; separar um passo "antes da conclusão" no `ComandoExecutavel`, fora do `gravar` | **Atendida:** o `ComandoExecutavel` ganhou o passo `antesDeConcluir`, fora do `gravar`; o `TurnoCommand` encaminha a D36 nele, numa transação própria e já concluída, e o `concluir` não abre transação dentro da outra (`execucao-command.test.ts`, `tutor-modelo.int.test.ts` › quando é o modelo que classifica o turno como assunto delicado) |
| privacy-guardian (1ª da 2.0) | Teste do aluno eliminado entre o `preparar` e o `concluir` com `assunto_delicado` | **Não atendida, vai ao `TODO.md`** (seção "Da reengenharia-continuacao, tarefa 5.0"): precisa de uma barreira no meio da chamada ao modelo, e o `startFakeModel` responde de forma síncrona; a chave estrangeira garante o resultado hoje |
| infra-guardian (2ª da 2.0), revisor-geral (2ª da 2.0) | Com o `Promise.all`, o caso da D36 repetida ocupa até quatro conexões do pool da bancada; conferir o tamanho do pool para o teste não ficar instável | **Atendida:** a D36 repetida roda pelo encaminhamento direto, sem fila, e o caso "20 execuções lentas no pool de 20" prova que nenhuma execução segura conexão durante o modelo; o `antesDeConcluir` deixou de aninhar transações, e a bancada tem o pool da réplica separado do da API |

Da 1ª rodada da Mesa (ordem `.processo/ordens/5_task-r1.md`), copiadas da seção "Sem aplicar" dela:

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª) | `execucao.processor.ts:105` e `:167`: a duração e o código da falha só vão para o log; com o provedor fora às 10h nenhuma métrica sobe. Falta o histograma da execução e o contador de falha por código, de onde o alerta "Provedor de IA fora" deve ler | Tarefa 7.0 (subtarefa 7.2: métrica, alerta e runbook de IA); muda comportamento e contrato de métrica |
| infra-guardian (1ª) | Teto global de chamadas ao provedor: sem o `IA_EXECUCOES_TOTAL` o limite passou de 16 para até 144 simultâneas; a 10.0 precisa pousar junto com a 5.0 e este estado intermediário não pode ir para produção | Tarefa 10.0 (o `TokenLimiter`, que usa o `IA_REPLICAS` já lido); o fato de o intermediário não poder ir para produção vai ao Orquestrador no relatório, para o pouso |
| infra-guardian (1ª), llm-integrator (1ª) | SIGTERM além da graça deixa a execução `rodando` até a varredura de 300 s (o aluno espera cerca de 5 min por `EXECUCAO_INTERROMPIDA`); a `pendente` com job ainda na fila por falta de vaga pode ser varrida aos 300 s e cair em `ja_tratada`; "A 6.0 não deve passar sem tratar esses dois casos" | Tarefa 6.0 (reentrega, corrida e varredura nova), que a tarefa já declara como escopo dela |
| test-engineer (1ª) | Duas entregas do mesmo job `pendente` em paralelo, em `Promise.all` | Tarefa 6.0 (a reentrega e a corrida são dela) |
| test-engineer (1ª) | `tools/guardas/executor-so-na-bancada.ts:88` só percorre `apps` e `e2e` | Recusada: hoje nenhum arquivo de `infra/test`, `packages` ou `tools` cita o alvo, e varrer `tools/` esbarra na fixture da própria guarda (`tools/guardas/__fixtures__/executor-na-bancada/`), que existe para citá-lo |
| test-engineer (1ª) | O caso do pool (`fila-de-ia.int.test.ts`) usa `comModelo` e passa por fora do gateway; com o gateway real e `IA_LATENCIA_FALSA_MS` provaria também que orçamento e consumo não seguram conexão | Tarefa 11.0 (a carga da manhã com a IA no worker, que usa a latência simulada) |
| test-engineer (1ª) | O caso do Redis fora chama `agendar` direto; a linha da tabela diz "`POST` 202": um caso pela rota HTTP de uma dúvida comum | `TODO.md`, seção "Da reengenharia-continuacao, tarefa 5.0" |
| revisor-geral (1ª) | `execucao.scheduler.ts:57-59`: `requireEscolaId()` e `copiarContextoDeQuemPede()` chamadas só pela checagem, retorno descartado; trocar por `requireUsuarioId()` (e `requireAnoEmCurso()`) e apagar a função, cujo docblock em `execucao-context.ts:14-18` ainda fala do executor em processo | `TODO.md`, seção "Da reengenharia-continuacao, tarefa 5.0": troca código de produção que a tarefa não pede e que muda o que o agendador exige |
| revisor-geral (1ª) | `main-worker.ts:15`: `startTelemetry('worker', …)` usa o mesmo `service.name` do `apps/worker`; as métricas do `worker-ia` se misturam às do worker de jobs | Tarefa 7.0 (as métricas de IA e o filtro por serviço nos painéis e alertas) |
| privacy-guardian (1ª) | A API ainda recebe `LLM_*` e `IA_PROVEDOR_ID` só para validar a configuração; em produção, não injetar `LLM_CHAVE_API` no contêiner da API (menor privilégio) | `TODO.md`, seção "Da reengenharia-continuacao, tarefa 5.0": mexe no compose de produção e na validação de configuração da API |
| llm-integrator (1ª), privacy-guardian (1ª) | Teste do aluno eliminado entre o `preparar` e o `concluir` com `assunto_delicado` | Já está no `TODO.md` (seção da tarefa 5.0), como a tabela acima diz |

Da 2ª rodada da Mesa (ordem `.processo/ordens/5_task-r2.md`, aprovação final), copiadas da seção "Sem aplicar" dela:

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (2ª) | O caso "a volta do código depois da 5.0" roda o bloco do runbook, que atualiza `execucao_agente` e `job_registro` de todas as escolas do banco de teste, mas só confere a escola A; vale uma cópia do bloco presa à escola do caso, ou conferir que a execução `concluida` e as abertas de outra escola criada no caso ficam como estão | `TODO.md`: estabilidade de teste, não vazamento; a integração roda um arquivo por vez (`fileParallelism: false`) |
| infra-guardian (2ª) | O mesmo caso atualiza o banco inteiro; se os projetos `integracao` e `infra` passarem a rodar juntos no mesmo banco, encerra execuções e jobs de outros arquivos; registrar a dependência num comentário no caso | `TODO.md` (junto da anterior); a 11.0 revê o banco compartilhado na carga |
| infra-guardian (2ª), revisor-geral (2ª) | `docs/runbook.md`, "Voltar o código depois da 5.0", passo 1: diz "a graça é de 20 s", mas o `docker compose stop` espera o `stop_grace_period` de 30 s; dizer os dois números; o comando também não traz o `-f` dos arquivos de compose de produção, se as outras seções trazem | `TODO.md`: texto de runbook que não muda comportamento, a conferir contra o formato das outras seções na próxima vez que o runbook for tocado |
| conformidade-reviewer (2ª) | O texto da N10 e o comentário de `infra/compose.yml:506-507` descrevem a reentrega de hoje (sai como "já tratada"); quando a 6.0 implementar a reentrega, mudam junto | Tarefa 6.0 (que toca `docs/aia/tutor.md` e o `worker-ia`) |
| conformidade-reviewer (2ª) | Confirmar que a mensagem que o aluno recebe com `EXECUCAO_INTERROMPIDA` aparece como aviso do produto, sem erro cru (N10); hoje só `IA_TEMPO_ESGOTADO` e `IA_INDISPONIVEL` estão cobertos | Tarefa 6.0 (que cria a reentrega com esse código) e 7.0 (a mensagem "Tentar de novo") |
| llm-integrator (2ª), infra-guardian (2ª) | Reentrega do job e varredura de 300 s; o desligamento deixa a execução `rodando` por até cerca de 5 min; métricas de duração e de falha por código da execução, de onde o alerta de provedor fora deve ler (o aviso novo `ia.execucao.falha_nao_gravada` também é só log) | 6.0 (reentrega e varredura) e 7.0 (subtarefa 7.2, métrica e alerta), como já na tabela da 1ª rodada |
| llm-integrator (2ª), infra-guardian (2ª), privacy-guardian (2ª) | Teto global de chamadas ao provedor (até 144 simultâneas sem o `IA_EXECUCOES_TOTAL`) e não injetar `LLM_CHAVE_API` no contêiner da API em produção | Tarefa 10.0 (`TokenLimiter`); **o estado intermediário sem a 10.0 não pode ir para produção**: o Orquestrador leva isso ao pouso. A segunda parte já está no `TODO.md` |
| llm-integrator (2ª), privacy-guardian (2ª) | Caso do Redis fora pela rota HTTP do Tutor; teste do aluno eliminado entre o `preparar` e o `concluir` com `assunto_delicado` | Já estão no `TODO.md`, seção da tarefa 5.0 |
| revisor-geral (2ª) | `apps/api/src/ia/prazo-por-temporizador.test.ts`, último caso: o `getTimerCount() === 1` não prova o `unref`, só o `hasRef()` prova; a primeira asserção pode sair | `TODO.md`: asserção redundante, o caso já falha pelo `hasRef()` (bloco de mutação do `unref` no documento) |
| revisor-geral (2ª) | Os dois casos de `fila-de-ia.int.test.ts` que criam gatilho no banco de teste esperariam lock da tabela se a suíte rodasse em paralelo no mesmo banco | Tarefa 11.0 (a carga) |
| test-engineer (2ª) | `tutor.int.test.ts:608`: o controle do caso "relê o contexto" usa `naQuestao(3)`, e três dos quatro casos mandam `onde: {}`; um controle sem questão cobriria o turno que não vem de questão | `TODO.md`: o controle atual já faz o espião poder falhar |
| test-engineer (2ª) | `apps/worker/src/shutdown.test.ts:35`: os "3 s" estão escritos à mão; importar `ESPERA_APOS_INTERROMPER_MS` de `apps/api/src/ia/worker-de-ia.ts`; o teste usa o `SHUTDOWN_GRACE_MS` do `apps/worker`, e não a graça do `worker-ia` (hoje os dois valem 20 s) | `TODO.md` |
| test-engineer (2ª) | Entrega paralela do mesmo job `pendente` em `Promise.all`; pool com o gateway real e `IA_LATENCIA_FALSA_MS` | 6.0 e 11.0, como na tabela da 1ª rodada |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-16 01:53:39 | 2026-11-16 01:54:43 | `tenancy-guardian` | 1 | APROVADO | afe764b4977f0ca20 |
| 2026-11-16 01:53:56 | 2026-11-16 01:55:27 | `conformidade-reviewer` | 1 | APROVADO | a6b5666f126a3e016 |
| 2026-11-16 01:54:05 | 2026-11-16 01:55:39 | `llm-integrator` | 1 | APROVADO | acc6ca7f1dffb6c1e |
| 2026-11-16 01:53:47 | 2026-11-16 01:57:05 | `infra-guardian` | 1 | APROVADO | aa1f44030a5b8e160 |
| 2026-11-16 01:54:22 | 2026-11-16 01:57:29 | `revisor-geral` | 1 | REPROVADO | a07dd249b783a4742 |
| 2026-11-16 01:54:30 | 2026-11-16 01:58:20 | `privacy-guardian` | 1 | REPROVADO | aceb9c9e12e8bf430 |
| 2026-11-16 01:54:13 | 2026-11-16 01:58:49 | `test-engineer` | 1 | REPROVADO | a82025d9d0bd72106 |
| 2026-11-16 03:00:09 | 2026-11-16 03:00:51 | `tenancy-guardian` | 2 | APROVADO | a65ed50f397d847e8 |
| 2026-11-16 03:00:34 | 2026-11-16 03:01:00 | `conformidade-reviewer` | 2 | APROVADO | ae2c210092478e5b5 |
| 2026-11-16 03:00:47 | 2026-11-16 03:01:08 | `llm-integrator` | 2 | APROVADO | a9aa7b027afec9e9b |
| 2026-11-16 03:00:22 | 2026-11-16 03:01:10 | `infra-guardian` | 2 | APROVADO | ad79d75567fcfbb86 |
| 2026-11-16 03:01:35 | 2026-11-16 03:02:08 | `privacy-guardian` | 2 | APROVADO | a7ceb0994c78ad70c |
| 2026-11-16 03:01:20 | 2026-11-16 03:02:20 | `revisor-geral` | 2 | APROVADO | a001a4852f868d77c |
| 2026-11-16 03:01:05 | 2026-11-16 03:02:31 | `test-engineer` | 2 | APROVADO | a04fc6ec8d5533abe |
