# Tarefa 1.0 — O PDF é extraído no worker, na fila `pdf`, e o objeto sai do storage em todo caminho da 45.0

**Funcionalidade:** ingestao-do-material · **Depende de:** nenhuma
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

O job `material.extrair-pdf`, na fila `pdf` do `apps/worker`, extrai o PDF do storage e o apaga depois do commit;
falha, prazo, exclusão e expurgo também apagam.

## Contexto necessário

- `techspec.md` §1, §2, §3 (as colunas da 45.0), §5 "Extração", §6, §7, §7c, §11 (desvios da 45.0)
- `prd.md` RF13, RF15
- `tasks/prd-reengenharia/onda-3b.md`: "O PDF no worker (45.0)" e "3. Falha"
- `.claude/rules/` 00, 10, 20 (itens 7 e 9), 40, 80
- Código: `apps/api/src/material/pdf-extraction.ts`, `apps/api/src/material/extraction-queue.ts`, `apps/api/src/material/material.service.ts`; `packages/shared/src/system/jobs.ts`;
  `packages/core/src/queue/queues.ts`; `packages/core/src/settings/operational-settings.ts`; `apps/worker/src/composition.ts`

## Subtarefas

- [x] 1.1 — `PdfExtractor` e o repository da extração em `packages/core/src/material/`, com os testes de hoje
- [x] 1.2 — `guardarBytes` e `lerBytes` no `FileStorage` (S3 e memória), com prazo; bucket sem versionamento
- [x] 1.3 — Migration: `processado_em` e `objeto_apagado_em`, nulas; os checks de fila e de `vagas` aceitam `pdf` (`NOT VALID`, `VALIDATE`)
- [x] 1.4 — `pdf` em `QUEUE_NAMES`; `material.extrair-pdf` (10 min, 3 tentativas); `VAGAS_ESCOLA_PDF=2` no worker e no despachante; pool de um PDF por vez com `lockDuration` e stalled; `worker-pdf` no `infra/compose.yml`, `cpus` limitado
- [x] 1.5 — Processador: a transição da §5 abre a transação (sem linha, conclui sem efeito); `sem_texto`, `arquivo_invalido` e objeto ausente vão a `falhou` numa tentativa; objeto ausente de material fora de `processando` conclui sem efeito; o objeto sai depois do commit
- [x] 1.6 — O envio grava o objeto e enfileira; exclusão em `processando` e expurgo apagam o objeto
- [x] 1.7 — Métrica e log, com `arquivo_ausente` à parte de `extracao_falhou` (R6)
- [x] 1.8 — Documentos: `docs/modelo-de-dados.md` (corrigir "o arquivo não é guardado"), `docs/lgpd.md` (o PDF temporário), `docs/arquitetura.md`, `docs/infra.md` (a réplica)
- [x] 1.9 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/material/pdf-extractor.ts`, `packages/core/src/material/extracao.repository.ts`, `packages/core/src/material/index.ts`, `packages/core/drizzle/0049_*.sql`, `apps/worker/src/processors/extrair-pdf.ts`, `apps/worker/test/extrair-pdf.int.test.ts` | novo |
| `packages/core/src/index.ts`, `packages/core/src/titular/file-storage.ts`, `packages/core/src/queue/queues.ts`, `packages/core/src/settings/operational-settings.ts`, `packages/core/src/db/schema/material.ts`, `packages/shared/src/system/jobs.ts`, `packages/shared/src/system/job-definitions.ts`, `apps/worker/src/composition.ts`, `apps/worker/src/config.ts`, `apps/despachante/src/config.ts`, `apps/api/src/material/material.service.ts`, `apps/api/src/material/material.repository.ts`, `apps/api/src/material/extraction-queue.ts`, `apps/api/src/material/pdf-extraction.ts`, `infra/compose.yml` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| caminho feliz | I | `pronto`, trechos, as duas colunas; o objeto sai só depois do commit | `extrair-pdf.int.test.ts` › "`pronto`, um trecho por página, as duas colunas; o objeto só sai depois do commit" (a leitura do estado e dos trechos por outra conexão, no `apagar`); e "o storage recusando apagar…" |
| Prazo | I | `TEMPO_ESGOTADO`, vaga livre; na 3ª, `falhou` e objeto apagado | › "prazo: cada tentativa estoura em `TEMPO_ESGOTADO` e a vaga sai; na 3ª o job e o material ficam `falhou` e o objeto é apagado", pelo worker de verdade; o `job.falhos` é o gauge do despachante, que conta o `falhou` de `job_registro` (`queue-gauge.int.test.ts`) |
| SIGTERM além da graça | I | `EXECUCAO_INTERROMPIDA` na última; com tentativa sobrando, o objeto fica | › "SIGTERM além da graça: com tentativa sobrando o job segue `ativo` e o objeto fica; na última, o job termina `falhou/EXECUCAO_INTERROMPIDA` e a vaga sai" (o processo morto, com o material `processando` até o "Descartar" da 3.0); e, com o processo vivo, os três casos do `quandoAbortar` (o sinal aborta no meio, na última tentativa e já abortado: na última o material fecha em `falhou` e o objeto sai; com tentativa sobrando, ele fica) |
| Falha final | I | job e material `falhou`, `job.falhostipo` sobe, objeto apagado | › "na última tentativa o material vira `falhou`, o objeto sai e o erro sobe para o job terminar `falhou`"; "com tentativa sobrando o erro sobe, o material continua `processando` e o objeto fica para a próxima"; "o storage fora na leitura é erro da tentativa, e não objeto ausente" |
| `sem_texto`; `arquivo_invalido` | I | `falhou` numa tentativa, vaga liberada | › "$caso: `falhou` com o motivo, o objeto apagado, a tentativa 1 conclui sem lançar (vaga liberada)", os dois casos do `it.each` |
| objeto ausente, `processando` | I | `extracao_falhou`, sem valor novo em `falha` | › "objeto ausente de material `processando`: `extracao_falhou`, sem valor novo em `falha`, `arquivo_ausente` no log à parte de `extracao_falhou`, e na métrica" |
| [P] excluído entre `lerParaExtrair` e `lerBytes` | P | sem efeito, sem `job.falhos`. Mutação: todo ausente vira `falhou` (R6) | › "[P] excluído entre `lerParaExtrair` e `lerBytes`: sem efeito, sem `falhou`, sem falha de job; a métrica diz `sem_efeito`"; "[P] excluído enquanto o PDF é extraído (…)", dois casos; "objeto ausente de material que já saiu de `processando`…" e "material que já saiu de `processando` ou foi excluído, com o objeto ainda no storage: o job nem lê o objeto, e ele fica" |
| [P] segundo job parado até o primeiro dar commit | P | segue `pronto`. Mutações: só `excluido_em`; `falhou` sem `estado = 'processando'` | › "[P] o segundo job do mesmo material, parado até o primeiro dar commit: o material segue `pronto`, os trechos uma vez, e o segundo conclui sem efeito"; "o job repetido depois de `pronto` não faz nada" |
| concorrência: dois jobs em `Promise.all` | P | trechos uma vez | › "[P] dois jobs do mesmo material em `Promise.all`, os dois com os bytes na mão: os trechos entram uma vez e o material fica `pronto`" (a barreira os junta; a métrica diz um `pronto` e um `sem_efeito`) |
| exclusão em `processando` | I | objeto some, o job não grava | `apps/api/test/material.int.test.ts` › "excluir um material `processando` apaga o objeto e registra"; "o job que chega depois da exclusão de um material `processando` não extrai nem grava nada, mesmo com o objeto de volta no storage" (o job rodado pelo processador, o extrator espiado); "excluir com o storage fora deixa o objeto e `objeto_apagado_em` nulo, para o expurgo; a exclusão vale"; "a coordenação da A que exclui o id de um material `processando` da B recebe o mesmo `NAO_ENCONTRADO`, e o objeto e a linha da B ficam" |
| vaga: A com 10 pendentes e vaga 2 | I | o PDF da B conclui antes. Mutação: ignorar a vaga | › "a vaga da escola: A com 10 PDFs pendentes e vaga 2 não segura a B, que conclui antes do último de A" (a vaga é a do despachante e do executor, que esta tarefa não altera; o caso prova que a fila `pdf` as usa) |
| checks da migration | I | aceitam `pdf`; os `UPDATE` fecham o `processando` antigo e tiram o material antigo da varredura | › "os `UPDATE` da migration tiram todo material antigo da varredura do objeto e fecham o `processando` que a API anterior deixou…" (lê o `.sql` e roda os dois `UPDATE` na escola do caso); › "o check da fila de `job_registro` aceita `pdf`…"; "o check das vagas da escola aceita `pdf`…"; "o material tem as duas colunas novas, nulas ao nascer, e o índice parcial do objeto a apagar" |
| configuração | U | vaga 2 e cede à escola, nos dois apps; `worker-pdf` um por vez, `lockDuration`, stalled, e não sobe sem o storage (R6) | `extrair-pdf.int.test.ts` › "a réplica da fila `pdf` sobe com um PDF por vez, o lock de 60 s e a verificação de stalled de 20 s…" (o `opts` do `Worker` de verdade); `apps/worker/src/config.test.ts` › "o worker-pdf atende só a fila `pdf`, com o pool de um PDF por vez, e lê o storage…", "o worker-pdf não sobe sem %s…", "o worker-pdf não sobe sem o pool da fila…", "não sobe com VAGAS_ESCOLA_PDF=%s…"; `apps/despachante/src/config.test.ts` (vaga `pdf` 2) e `outbox-relay.test.ts` (a sobreposta pela escola); `apps/worker/src/composition.test.ts` › "todo tipo que o worker executa tem processador na réplica de cada fila…"; `tools/ci/compose.int.test.ts` e `ambiente.test.ts` (o `worker-pdf` do compose e as variáveis) |
| isolamento, repository | I | `lerParaExtrair` com o id da B: vazio. Mutação: tirar `escola_id` | › "o repository: `lerParaExtrair` com o id da B no contexto da A não acha nada, e o da A acha"; "o repository: marcar pronto, falhou ou objeto apagado, e listar os excluídos, com a escola A no contexto, não alcançam o material da B" |
| isolamento, job | I | job da A com material da B: nada lido nem gravado | › "o job da A com o id de um material da B: nada é lido, gravado nem apagado, e o material da B segue `processando` com o objeto" (a leitura do storage contada: zero) |
| expurgo | I | apaga os objetos da A, não os da B | `expurgo-da-escola.int.test.ts` › "apaga o objeto do excluído da escola e registra; o excluído de B, o `processando` vigente…"; "com o storage recusando, o objeto fica sem registro e o job não falha; na noite seguinte sai"; "com a janela letiva aberta nenhum objeto é apagado…"; "mais de um lote: 105 objetos…"; o repository: "o repository: `objeto_apagado_em` guarda o primeiro instante, o cursor do expurgo segue o id, e o lote precisa de tamanho" |
| envio: recusa, teto e corrida | I | o objeto da recusa sai; o do que ficou, não; um job só | `material.int.test.ts` › o envio recusado pelo duplicado e pelo teto de materiais em leitura (na corrida), com o storage recusando apagar o objeto (o id no log), e dois envios do mesmo arquivo ao mesmo tempo (o armazém e o `job_registro` conferidos) |
| log e métrica | I | ids e códigos, nunca título, arquivo, licenciante, texto; `arquivo_ausente` à parte (R6) | › "as linhas levam ids, tentativa, códigos e contagens: nunca título, nome de arquivo, licenciante nem texto do PDF"; "a métrica leva só o resultado, nunca a escola nem o material"; `material.int.test.ts` › "nenhuma linha leva título, licenciante, nome de arquivo, texto da busca nem texto de trecho…" |

## Como testar

- Processador: `apps/worker/test/expurgo-da-escola.int.test.ts` › "toda categoria percorrida grava a sua linha…", com `rodar(escolaId, processador)` e `job-execution.fixture.ts`
- Prazo e SIGTERM: `apps/worker/test/job-timeout.int.test.ts`, `job-reexecution.int.test.ts`
- Configuração: `apps/worker/src/config.test.ts`, `apps/despachante/src/config.test.ts`
- Storage: `InMemoryFileStorage` (`packages/core/src/titular/file-storage.ts:57`), com `lerBytes` numa barreira para os [P]
- Comando: `npx vitest run --project integracao apps/worker/test/extrair-pdf.int.test.ts`
- Armadilha: cada termo da transição é um bloco, e o SQL em template string também (retro da F2c, M1)

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas antes de codar e conferidas depois.

**Plano.** `packages/core/src/material/` ganha `PdfExtractor` (movido de `apps/api`, com os testes de hoje), `ExtracaoDoMaterialRepository` (a transição da §5 e o cursor do expurgo), `chaveDoTemporario` e `uuidV7`. O `FileStorage` ganha `guardarBytes` e `lerBytes` com prazo (S3 e memória). A migration `0049` põe `processado_em` e `objeto_apagado_em` (nulas), amplia os checks de fila e de `vagas` com `pdf` (`NOT VALID`, `VALIDATE`) e tem dois `UPDATE`: o material antigo sai da varredura do objeto (`objeto_apagado_em = enviado_em`), e o `processando` que a API anterior deixou, sem job nem objeto, vira `falhou` (`extracao_falhou`). O `apps/worker` ganha `processors/extrair-pdf.ts` na fila `pdf` (o processador recupera o controle quando o sinal aborta, e a última tentativa fecha o material), e o expurgo noturno apaga o objeto do excluído. A API grava o objeto, insere a linha e enfileira na mesma transação, e a exclusão de `processando` apaga o objeto. `infra/compose.yml` ganha `worker-pdf`.

1. **Mutação de cada cláusula.** Cada termo da transição (`escola_id`, `estado = 'processando'`, `excluido_em is null`) em `lerParaExtrair`, `marcarPronto` e `marcarFalhou`, o `isNull(objeto_apagado_em)` de `marcarObjetoApagado`, os quatro termos de `excluidosComObjeto` (escola, `isNotNull(excluido_em)`, `isNull(objeto_apagado_em)`, o cursor) e o `limite < 1`; cada `if` do processador (sem linha, objeto ausente, `extracao_falhou` que sobe, `falha` que fecha, `disciplinaId` ausente, `!gravou`, `!mudou`, a última tentativa, o `sem_efeito` no log) e as duas linhas do `apagarObjeto`; no envio, `guardarBytes`, a limpeza do órfão, o `enfileirarUmaVez`, o 503 e a exclusão de `processando`; no expurgo, a janela; na configuração, o `pdf` em `atendeStorage` e as réplicas da composição; nas peças do storage e do `PdfExtractor`, o que os testes de hoje alcançam; e, da ordem de correção, o `quandoAbortar` (as duas linhas), o log do órfão do envio, o lock e o stalled da `pdf` (a constante e as duas linhas da composição) e cada `UPDATE` da migration. O que não tem bloco leva o motivo, na seção "Mutações".
2. **O texto na tela.** A tarefa não tem tela: não se aplica.
3. **O segundo dado.** Cada caso de isolamento usa a escola B com material `processando` e objeto no storage (o da A não o alcança); o `lerParaExtrair` tem material `pronto`, excluído e `falhou` com o objeto ainda no storage, para a leitura do storage provar o `estado` e o `excluido_em`; o expurgo tem o excluído da B e o `processando` vigente da A.
4. **Checagem anterior que responde antes.** `lerParaExtrair` filtra e `marcarFalhou` filtra de novo: o teste do `estado` na leitura conta as leituras do storage (`aoLerBytes`), e não o estado final; o `marcarPronto` e o `marcarFalhou` têm casos em que a leitura já passou (o excluído durante a extração, o segundo job parado).
5. **Resultado, e não forma.** Os casos olham a linha do material, os trechos, o objeto no storage, a métrica por `resultado` e o log; nenhum lê texto de arquivo.
6. **Guarda nova.** Nenhuma regra de lint nem teste estrutural nasce aqui; o `guardas/definicoes-de-job` ganha a exceção de `TIPO_EXTRAIR_PDF` (3 tentativas), com o caso que a prova.
7. **Comentários.** Os docblocks de `extrair-pdf.ts`, `extracao.repository.ts` e do expurgo descrevem o que o código faz, inclusive que, com o processo morto no meio da última tentativa, o material fica `processando` até o "Descartar" da 3.0, e que a varredura da 2.0 é só do objeto de `pronto`, `falhou` e excluído.
8. **Divergências.** Na tabela abaixo, cada uma com o lugar da spec onde a decisão está (e o que ficou a acrescentar antes da primeira rodada).
9. **Peça que já existe.** O `PdfExtractor` e o `temAssinaturaDePdf` foram movidos para o `core` (dois módulos os usam, o worker e a API), e não copiados; o executor, o outbox, os slots, o `InMemoryFileStorage` e `QueueFixtures` são os de sempre.
10. **Concorrência.** Os [P] estão com a ordem forçada: `aoLerBytes` segura a leitura do segundo job até o primeiro dar commit; o `Promise.all` só passa depois de os dois chegarem com os bytes na mão; o excluído durante a leitura e durante a extração é por SQL, no ponto certo.
11. **Isolamento e coluna "Caso".** O caso de isolamento do repository passa só ids da B no contexto da A (leitura, as três escritas e o cursor do expurgo); a coluna "Caso" da tabela de testes nomeia o caso de cada linha, um para cada coisa que a linha diz.
12. **Guardiões.** `tenancy`: escopo no repository, nenhum método recebe escola, isolamento no job e no repository. `privacy`: o objeto é privado, sai em todo caminho, o log leva só ids e códigos, a coluna nova entra em `fora` do arquivo do titular e em `docs/lgpd.md`. `infra`: a fila `pdf` com vaga por escola e pool de um, o prazo, a migration `NOT VALID`/`VALIDATE`, a métrica por `resultado`; o alerta e o runbook são da 3.0. O `achados/indice.md` só tem as rodadas da spec.

## Fora do escopo desta tarefa

Varredura (2.0); `ops:jobs` e alerta (3.0); capítulos (4.0); substituição (8.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O id do material nasce na aplicação (`uuidV7`, em `packages/core/src/material/uuid-v7.ts`) e o objeto vai ao storage antes da transação, sem a linha de `envio_de_material` | a chave do objeto leva o id, e o objeto é gravado antes da linha; a `envio_de_material` é da 2.0 e o órfão desta tarefa é apagado no `catch` do envio (melhor esforço) | `techspec.md` §5 "Envio e edição", passo (2), "Id da aplicação (UUIDv7)"; §11, linha "1.0" |
| A chave do objeto é `material-temporario/<escola>/<id>` (`chaveDoTemporario`), a escola vinda do contexto | regra 10: nenhum método recebe a escola | `techspec.md` §11, linha "1.0" (`chaveDoTemporario`); §7 "PDF temporário" |
| A varredura de `processando` parado, que era da API, sai aqui, e a 2.0 não a refaz: o `processando` sem job é fechado pela migration (o legado), pelo processador (o prazo e o desligamento, com o processo vivo) e pelo "Descartar" da 3.0 (o processo morto) | a extração saiu do processo da API; a varredura da 2.0 só olha o objeto de `pronto`, `falhou` e excluído | `techspec.md` §11, linha "1.0"; §7c "Estados" (descarte); `cenarios.md` "Extração no worker e capítulos" (o desligamento, o processo morto, os `UPDATE`) |
| O expurgo noturno apaga o objeto do excluído (`excluidosComObjeto`, lotes de 100, só dentro da janela), e a exclusão de `processando` o apaga na hora | "exclusão em `processando`" e "expurgo" da tabela "3. Falha" da onda 3b | `techspec.md` §11, linha "1.0" (`excluidosComObjeto`); `cenarios.md` "Extração no worker e capítulos", o caso do expurgo noturno |
| O objeto ausente de material `processando` é `arquivo_ausente` no log e na métrica, e `extracao_falhou` em `falha` | R6: sem valor novo em `falha`, e o sinal de objeto perdido à parte | `techspec.md` §11, linha "1.0" (`arquivo_ausente`); `cenarios.md` "Extração no worker e capítulos" |
| O tipo `material.extrair-pdf` tem 3 tentativas, e a guarda `definicoes-de-job` o admite | a Tech Spec diz 3 tentativas; a guarda esperava 5 | `techspec.md` §7c "Fila e prioridade" ("3 tentativas"); §11, linha "1.0" (`definicoes-de-job`) |
| O processador recupera o controle quando o sinal aborta (`quandoAbortar`): na última tentativa fecha o material e apaga o objeto; o lock da `pdf` é de 60 s e o stalled, de 20 s | o prazo e o desligamento não podem deixar o material `processando` com o objeto se o processo vive; 20 s para o valor ser deste pool, e não o padrão do BullMQ | `techspec.md` §11, linha "1.0" (`quandoAbortar`, `WORKER_POOL_OPTIONS_BY_QUEUE`); `cenarios.md` "Extração no worker e capítulos" |
| A migration `0049` fecha em `falhou` o `processando` que a API anterior deixou (sem job nem objeto) | sem ela o material conta no teto de 3 em leitura para sempre; `falhou` pode ser enviado de novo | `techspec.md` §11, linha "1.0"; `cenarios.md` "Extração no worker e capítulos" (os `UPDATE` da `0049`) |
| `processado_em` e `objeto_apagado_em` entram em `fora` do arquivo do titular (`leitura-do-titular.ts`) | o teste de arquitetura exige destino para toda coluna nova; são instantes do material, sem a pessoa | `techspec.md` §11, linha "1.0" (`fora`); §3 (as colunas da 45.0) |
| O job sintético não entra na fila `pdf` (`FILAS_DO_SINTETICO`); o `PdfExtractor` e o `pdfjs-dist` vão para o `packages/core` | a réplica `pdf` não executa o sintético; o extrator é do worker, que não importa da API | `techspec.md` §11, linha "1.0" (`FILAS_DO_SINTETICO`); §2 (`packages/core/src/material/`, `PdfExtractor`) |

## Mutações

--faltando: 54 linhas (44 blocos, 10 motivos)

Um bloco por cláusula, na ordem: o repository da extração (cada termo da transição e do expurgo), o processador, o envio e a exclusão na API, o expurgo, a configuração e a composição, o storage, o `uuidV7` e o `PdfExtractor`.

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › `lerParaExtrair` com o id da B
falha: toBeUndefined()
 .from(material)
-.where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), eq(material.estado, 'processando'), isNull(material.excluidoEm)))
+.where(and(eq(material.id, id), eq(material.estado, 'processando'), isNull(material.excluidoEm)))
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › nem lê o objeto
falha: toBe(0)
 .from(material)
-.where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), eq(material.estado, 'processando'), isNull(material.excluidoEm)))
+.where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), isNull(material.excluidoEm)))
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › nem lê o objeto
falha: toBe(0)
 .from(material)
-.where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), eq(material.estado, 'processando'), isNull(material.excluidoEm)))
+.where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), eq(material.estado, 'processando')))
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › o repository: marcar pronto
falha: toBeUndefined()
 .set({ estado: 'pronto', paginas, processadoEm: sql`now()` })
-.where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), eq(material.estado, 'processando'), isNull(material.excluidoEm)))
+.where(and(eq(material.id, id), eq(material.estado, 'processando'), isNull(material.excluidoEm)))
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › dois jobs do mesmo material em `Promise.all`
falha: arrayContaining
 .set({ estado: 'pronto', paginas, processadoEm: sql`now()` })
-.where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), eq(material.estado, 'processando'), isNull(material.excluidoEm)))
+.where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), isNull(material.excluidoEm)))
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › excluído enquanto o PDF é extraído
falha: resultado: 'sem_efeito'
 .set({ estado: 'pronto', paginas, processadoEm: sql`now()` })
-.where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), eq(material.estado, 'processando'), isNull(material.excluidoEm)))
+.where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), eq(material.estado, 'processando')))
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › o repository: marcar pronto
falha: toBe(false)
 .set({ estado: 'falhou', falha, processadoEm: sql`now()` })
-.where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), eq(material.estado, 'processando'), isNull(material.excluidoEm)))
+.where(and(eq(material.id, id), eq(material.estado, 'processando'), isNull(material.excluidoEm)))
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › o segundo job do mesmo material, parado
falha: arrayContaining
 .set({ estado: 'falhou', falha, processadoEm: sql`now()` })
-.where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), eq(material.estado, 'processando'), isNull(material.excluidoEm)))
+.where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), isNull(material.excluidoEm)))
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › excluído entre
falha: resultado: 'sem_efeito'
 .set({ estado: 'falhou', falha, processadoEm: sql`now()` })
-.where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), eq(material.estado, 'processando'), isNull(material.excluidoEm)))
+.where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), eq(material.estado, 'processando')))
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › o repository: marcar pronto
falha: objeto_apagado_em).toBeNull()
 .set({ objetoApagadoEm: sql`now()` })
-.where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), isNull(material.objetoApagadoEm)))
+.where(and(eq(material.id, id), isNull(material.objetoApagadoEm)))
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › o repository: `objeto_apagado_em` guarda o primeiro instante
falha: toEqual(instante)
 .set({ objetoApagadoEm: sql`now()` })
-.where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), isNull(material.objetoApagadoEm)))
+.where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id)))
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › o repository: `objeto_apagado_em` guarda o primeiro instante
falha: rejects.toThrow()
-if (limite < 1) throw new InvariantException('lote do expurgo do objeto sem tamanho')
+if (limite < 0) throw new InvariantException('lote do expurgo do objeto sem tamanho')
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › o repository: marcar pronto
falha: toEqual([])
 .from(material)
-.where(and(eq(material.escolaId, requireEscolaId()), isNotNull(material.excluidoEm), isNull(material.objetoApagadoEm), depoisDe === undefined ? undefined : gt(material.id, depoisDe)))
+.where(and(isNotNull(material.excluidoEm), isNull(material.objetoApagadoEm), depoisDe === undefined ? undefined : gt(material.id, depoisDe)))
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › apaga o objeto do excluído da escola e registra
falha: vigenteDeA.chave
 .from(material)
-.where(and(eq(material.escolaId, requireEscolaId()), isNotNull(material.excluidoEm), isNull(material.objetoApagadoEm), depoisDe === undefined ? undefined : gt(material.id, depoisDe)))
+.where(and(eq(material.escolaId, requireEscolaId()), isNull(material.objetoApagadoEm), depoisDe === undefined ? undefined : gt(material.id, depoisDe)))
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › o repository: `objeto_apagado_em` guarda o primeiro instante
falha: toEqual([segundo])
 .from(material)
-.where(and(eq(material.escolaId, requireEscolaId()), isNotNull(material.excluidoEm), isNull(material.objetoApagadoEm), depoisDe === undefined ? undefined : gt(material.id, depoisDe)))
+.where(and(eq(material.escolaId, requireEscolaId()), isNotNull(material.excluidoEm), depoisDe === undefined ? undefined : gt(material.id, depoisDe)))
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › o repository: `objeto_apagado_em` guarda o primeiro instante
falha: toEqual([maior])
 .from(material)
-.where(and(eq(material.escolaId, requireEscolaId()), isNotNull(material.excluidoEm), isNull(material.objetoApagadoEm), depoisDe === undefined ? undefined : gt(material.id, depoisDe)))
+.where(and(eq(material.escolaId, requireEscolaId()), isNotNull(material.excluidoEm), isNull(material.objetoApagadoEm), undefined))
```

```mutacao
arquivo: apps/worker/src/processors/extrair-pdf.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › nem lê o objeto
falha: toBe(0)
 const material = await new ExtracaoDoMaterialRepository(banco).lerParaExtrair(materialId)
-if (material === undefined) return 'sem_efeito'
```

```mutacao
arquivo: apps/worker/src/processors/extrair-pdf.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › objeto ausente de material `processando`
falha: resolves.toBeUndefined()
-if (bytes === undefined) return (await falharDeVez(materialId, 'extracao_falhou', 'material.arquivo_ausente', tentativa)) ? 'arquivo_ausente' : 'sem_efeito'
+if (bytes === null) return (await falharDeVez(materialId, 'extracao_falhou', 'material.arquivo_ausente', tentativa)) ? 'arquivo_ausente' : 'sem_efeito'
```

```mutacao
arquivo: apps/worker/src/processors/extrair-pdf.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › com tentativa sobrando o erro sobe
falha: rejects.toThrow()
-if (resultado.falha === 'extracao_falhou') throw new JobFailureError(JobFailureCode.ERRO_INTERNO)
+if (false) throw new JobFailureError(JobFailureCode.ERRO_INTERNO)
```

```mutacao
arquivo: apps/worker/src/processors/extrair-pdf.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › `falhou` com o motivo, o objeto apagado
falha: resolves.toBeUndefined()
-if (resultado.falha !== null) return (await falharDeVez(materialId, resultado.falha, 'material.extracao_falhou', tentativa)) ? 'falhou' : 'sem_efeito'
+if (false) return (await falharDeVez(materialId, resultado.falha, 'material.extracao_falhou', tentativa)) ? 'falhou' : 'sem_efeito'
```

```mutacao
arquivo: apps/worker/src/processors/extrair-pdf.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › excluído enquanto o PDF é extraído
falha: resultado: 'sem_efeito'
-if (resultado.falha !== null) return (await falharDeVez(materialId, resultado.falha, 'material.extracao_falhou', tentativa)) ? 'falhou' : 'sem_efeito'
+if (resultado.falha !== null) return (await falharDeVez(materialId, resultado.falha, 'material.extracao_falhou', tentativa)) ? 'falhou' : 'falhou'
```

```mutacao
arquivo: apps/worker/src/processors/extrair-pdf.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › excluído entre
falha: resultado: 'sem_efeito'
-if (bytes === undefined) return (await falharDeVez(materialId, 'extracao_falhou', 'material.arquivo_ausente', tentativa)) ? 'arquivo_ausente' : 'sem_efeito'
+if (bytes === undefined) return (await falharDeVez(materialId, 'extracao_falhou', 'material.arquivo_ausente', tentativa)) ? 'arquivo_ausente' : 'arquivo_ausente'
```

```mutacao
arquivo: apps/worker/src/processors/extrair-pdf.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › excluído enquanto o PDF é extraído
falha: resolves.toBeUndefined()
 // Excluído, ou já extraído por outro job, enquanto era lido: nenhum trecho entra, e o objeto é de quem mudou a linha.
-if (disciplinaId === undefined) return false
```

```mutacao
arquivo: apps/worker/src/processors/extrair-pdf.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › excluído enquanto o PDF é extraído
falha: resultado: 'sem_efeito'
-if (!gravou) return 'sem_efeito'
```

```mutacao
arquivo: apps/worker/src/processors/extrair-pdf.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › excluído entre
falha: resultado: 'sem_efeito'
 const mudou = await new ExtracaoDoMaterialRepository(banco).marcarFalhou(materialId, codigo)
-if (!mudou) return false
```

```mutacao
arquivo: apps/worker/src/processors/extrair-pdf.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › na última tentativa o material vira
falha: resultado: 'falhou'
-if (!ultimaTentativa) {
+if (true) {
```

```mutacao
arquivo: apps/worker/src/processors/extrair-pdf.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › na última tentativa o material vira
falha: resultado: 'falhou'
-const ultimaTentativa = tentativa >= TENTATIVAS_DA_EXTRACAO
+const ultimaTentativa = tentativa > TENTATIVAS_DA_EXTRACAO
```

```mutacao
arquivo: apps/worker/src/processors/extrair-pdf.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › objeto ausente de material que já saiu
falha: toHaveLength(2)
-if (desfecho === 'sem_efeito') logger.info({ evento: 'material.extracao_sem_efeito', materialId, tentativa })
+if (false) logger.info({ evento: 'material.extracao_sem_efeito', materialId, tentativa })
```

```mutacao
arquivo: apps/worker/src/processors/extrair-pdf.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › `pronto`, um trecho por página
-await armazem.apagar(chaveDoTemporario(materialId))
```

```mutacao
arquivo: apps/worker/src/processors/extrair-pdf.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › `pronto`, um trecho por página
-await new ExtracaoDoMaterialRepository(banco).marcarObjetoApagado(materialId)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material.int.test.ts › excluir um material `processando` apaga o objeto
falha: toBe(false)
-if (estado === 'processando') await this.#apagarObjetoDoExcluido(id)
+if (false) await this.#apagarObjetoDoExcluido(id)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material.int.test.ts › storage fora do ar no envio
-if (erro instanceof FileStorageUnavailableError) throw new DomainException(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, undefined, DEFAULT_RETRY_AFTER_SECONDS)
+if (false) throw new DomainException(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, undefined, DEFAULT_RETRY_AFTER_SECONDS)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material.int.test.ts › o envio guarda o PDF no storage
-await enfileirador.enfileirarUmaVez(tx, TIPO_EXTRAIR_PDF, { materialId: novo.id }, novo.id)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material.int.test.ts › o envio guarda o PDF no storage
-await armazem.guardarBytes(chaveDoTemporario(id), bytes, { prazoMs: PRAZO_DO_OBJETO_DO_MATERIAL_MS })
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material.int.test.ts › o envio que a transação recusa
falha: ficaram.toSorted()
-await armazem.apagar(chaveDoTemporario(id)).catch((falha: unknown) => logger.warn({ evento: 'material.objeto_nao_apagado', materialId: id, erro: summarizeError(falha) }))
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material.int.test.ts › o envio guarda o PDF no storage
-const novo = await materiais.inserir({ id, disciplinaId, titulo: pedido.titulo, titularidade: pedido.titularidade, licenciante: pedido.licenciante ?? null, licenca, sha256, tamanhoBytes: bytes.byteLength })
+const novo = await materiais.inserir({ disciplinaId, titulo: pedido.titulo, titularidade: pedido.titularidade, licenciante: pedido.licenciante ?? null, licenca, sha256, tamanhoBytes: bytes.byteLength })
```

```mutacao
arquivo: apps/api/src/material/material.module.ts
teste: apps/api/test/material.int.test.ts › o envio guarda o PDF no storage
-opcoes.armazemDeTeste === undefined ? S3FileStorage.criar(opcoes.armazem) : { armazem: opcoes.armazemDeTeste, encerrar: (): void => undefined }
+true ? S3FileStorage.criar(opcoes.armazem) : { armazem: opcoes.armazemDeTeste, encerrar: (): void => undefined }
```

```mutacao
arquivo: apps/worker/src/processors/expurgar-escola.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › com a janela letiva aberta nenhum objeto
falha: excluido.chave
 if (ids.length === 0) break
-if (estaNaJanela(janela, relogio.agora())) break
+if (false) break
```

```mutacao
arquivo: apps/worker/src/config.ts
teste: apps/worker/src/config.test.ts › o worker-pdf não sobe sem
-const atendeStorage = atendeLote || filas?.FILAS.includes('normal') === true || filas?.FILAS.includes('pdf') === true
+const atendeStorage = atendeLote || filas?.FILAS.includes('normal') === true
```

```mutacao
arquivo: apps/worker/src/composition.ts
teste: apps/worker/src/composition.test.ts › todo tipo que o worker executa tem processador
-...(config.pools.pdf === undefined ? {} : processadoresDaPdf(pecas)),
+...(true ? {} : processadoresDaPdf(pecas)),
```

```mutacao
arquivo: apps/worker/src/composition.ts
teste: apps/worker/src/composition.test.ts › o arquivo do titular, a planilha e os e-mails
-...(config.pools.normal === undefined ? {} : processadoresDaNormal(pecas)),
+...(true ? {} : processadoresDaNormal(pecas)),
```

```mutacao
arquivo: apps/worker/src/composition.ts
teste: apps/worker/src/composition.test.ts › o arquivo do titular, a planilha e os e-mails
-return FILAS_DO_SINTETICO.some((fila) => config.pools[fila] !== undefined) ? { [TIPO_JOB_SINTETICO]: createSyntheticProcessor(cpu, efeitos) } : {}
+return false ? { [TIPO_JOB_SINTETICO]: createSyntheticProcessor(cpu, efeitos) } : {}
```

```mutacao
arquivo: packages/core/src/titular/file-storage.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › objeto ausente de material `processando`
-return lido === undefined ? undefined : new Uint8Array(lido)
+return new Uint8Array(lido ?? [])
```

```mutacao
arquivo: packages/core/src/titular/file-storage.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › o storage fora na leitura
-return this.objetos.has(chave) || this.bytes.has(chave)
+return this.objetos.has(chave)
```

```mutacao
arquivo: packages/core/src/titular/s3-file-storage.ts
teste: packages/core/src/titular/s3-file-storage.test.ts › `lerBytes` do objeto que não existe
-if (erro instanceof S3ServiceException && (erro.name === 'NoSuchKey' || erro.$metadata.httpStatusCode === 404)) return undefined
+if ((erro.name === 'NoSuchKey' || erro.$metadata.httpStatusCode === 404)) return undefined
```

```mutacao
arquivo: packages/core/src/titular/s3-file-storage.ts
teste: packages/core/src/titular/s3-file-storage.test.ts › `lerBytes` do objeto que não existe
falha: toBeUndefined()
-if (erro instanceof S3ServiceException && (erro.name === 'NoSuchKey' || erro.$metadata.httpStatusCode === 404)) return undefined
+if (erro instanceof S3ServiceException && (erro.name === 'NoSuchKey')) return undefined
```

```mutacao
arquivo: packages/core/src/titular/s3-file-storage.ts
teste: packages/core/src/titular/s3-file-storage.test.ts › o prazo da chamada corta
-await this.cliente.send(comando, prazoMs === undefined ? undefined : { abortSignal: AbortSignal.timeout(prazoMs) })
+await this.cliente.send(comando, undefined)
```

```mutacao
arquivo: packages/core/src/material/uuid-v7.ts
teste: packages/core/src/material/uuid-v7.test.ts › é um UUID de versão 7
-bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70
+bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
```

```mutacao
arquivo: packages/core/src/material/uuid-v7.ts
teste: packages/core/src/material/uuid-v7.test.ts › é um UUID de versão 7
-bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
+bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0xc0
```

```mutacao
arquivo: packages/core/src/material/pdf-extractor.ts
teste: packages/core/src/material/pdf-extractor.test.ts › com menos de três páginas
falha: toEqual(paginas)
-if (comTexto.length < MINIMO_DE_PAGINAS_PARA_TIRAR_LINHA_REPETIDA) break
+if (false) break
```

```mutacao
arquivo: packages/core/src/material/pdf-extractor.ts
teste: packages/core/src/material/pdf-extractor.test.ts › não tira nada se a linha muda em outra coisa
falha: toEqual(paginas)
-if (!daBorda.every((linha) => linha === daBorda[0])) break
```

```mutacao
arquivo: packages/core/src/material/pdf-extractor.ts
teste: packages/core/src/material/pdf-extractor.test.ts › tira também o cabeçalho corrido
-const daBorda = comTexto.map((linhas) => semNumeros((borda === 'fim' ? linhas.at(-1) : linhas[0]) ?? ''))
+const daBorda = comTexto.map((linhas) => semNumeros((linhas.at(-1)) ?? ''))
```

```mutacao
arquivo: packages/core/src/material/pdf-extractor.ts
teste: packages/core/src/material/pdf-extractor.test.ts › tira também o cabeçalho corrido
-restantes = restantes.map((linhas) => (borda === 'fim' ? linhas.slice(0, -1) : linhas.slice(1)))
+restantes = restantes.map((linhas) => (linhas.slice(0, -1)))
```

```mutacao
arquivo: packages/core/src/material/pdf-extractor.ts
teste: packages/core/src/material/pdf-extractor.test.ts › arquivo com a assinatura de PDF e o resto corrompido
-return erro instanceof Error && ERROS_DE_ARQUIVO.has(erro.name) ? 'arquivo_invalido' : 'extracao_falhou'
+return false ? 'arquivo_invalido' : 'extracao_falhou'
```

```mutacao
arquivo: packages/core/src/material/pdf-extractor.ts
teste: packages/core/src/material/pdf-extractor.test.ts › PDF que abre e não tem texto
-if (trechos.length === 0) return { falha: 'sem_texto' }
+if (false) return { falha: 'sem_texto' }
```

```mutacao
arquivo: packages/core/src/material/pdf-extractor.ts
teste: packages/core/src/material/pdf-extractor.test.ts › o material de demonstração vira seis trechos
-if (item.hasEOL) {
+if (false) {
```

```mutacao
arquivo: packages/core/src/material/pdf-extractor.ts
teste: packages/core/src/material/pdf-extractor.test.ts › tira a última linha que se repete em todas as páginas
-const semNumeros = (linha: string): string => linha.replace(/\d+/g, '#')
+const semNumeros = (linha: string): string => linha.replace(/\d{9}/g, '#')
```
```mutacao
arquivo: apps/api/src/app.module.ts
teste: apps/api/test/material.int.test.ts › o envio guarda o PDF no storage
  logger: opcoes.logger ?? createLogger({ servico: 'api' }),
  armazem: config.armazem,
-...(opcoes.armazemDeArquivos === undefined ? {} : { armazemDeTeste: opcoes.armazemDeArquivos }),
+...(true ? {} : { armazemDeTeste: opcoes.armazemDeArquivos }),
```
```mutacao
arquivo: apps/worker/src/composition.ts
teste: apps/worker/src/composition.test.ts › todo tipo que o worker executa tem processador
-return armazem === undefined ? {} : { [TIPO_EXTRAIR_PDF]: criarExtracaoDoPdf({ banco, armazem, extrator: extrator ?? new PdfExtractor(), logger, medidor }) }
+return true ? {} : { [TIPO_EXTRAIR_PDF]: criarExtracaoDoPdf({ banco, armazem, extrator: extrator ?? new PdfExtractor(), logger, medidor }) }
```

```mutacao
arquivo: apps/worker/src/processors/extrair-pdf.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › o desligamento além da graça ou o prazo
falha: toBe('rejeitou')
-const resultado = await Promise.race([extrator.extrair(bytes, sinal), quandoAbortar(sinal)])
+const resultado = await extrator.extrair(bytes, sinal)
```

```mutacao
arquivo: apps/worker/src/processors/extrair-pdf.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › o desligamento além da graça ou o prazo
falha: toBe('rejeitou')
    const falhar = (): void => rejeitar(new JobFailureError(JobFailureCode.ERRO_INTERNO))
-   if (sinal.aborted) falhar()
-   else sinal.addEventListener('abort', falhar, { once: true })
+   sinal.addEventListener('abort', falhar, { once: true })
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material.int.test.ts › o envio recusado pela transação, com o storage recusando apagar o objeto
falha: expect(avisos)
-await armazem.apagar(chaveDoTemporario(id)).catch((falha: unknown) => logger.warn({ evento: 'material.objeto_nao_apagado', materialId: id, erro: summarizeError(falha) }))
+await armazem.apagar(chaveDoTemporario(id)).catch(() => undefined)
```

```mutacao
arquivo: packages/core/src/queue/queues.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › a réplica da fila `pdf` sobe com um PDF por vez
falha: lockDuration: 60_000
-pdf: { lockDurationMs: 60_000, stalledIntervalMs: 20_000 },
+pdf: { lockDurationMs: 5_000, stalledIntervalMs: 20_000 },
```

```mutacao
arquivo: apps/worker/src/composition.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › a réplica da fila `pdf` sobe com um PDF por vez
falha: lockDuration: 60_000
-lockDuration: WORKER_POOL_OPTIONS_BY_QUEUE[fila].lockDurationMs,
```

```mutacao
arquivo: apps/worker/src/composition.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › a réplica da fila `pdf` sobe com um PDF por vez
falha: stalledInterval: 20_000
-stalledInterval: WORKER_POOL_OPTIONS_BY_QUEUE[fila].stalledIntervalMs,
```

```mutacao
arquivo: packages/core/drizzle/0049_material_extracao_no_worker.sql
teste: apps/worker/test/extrair-pdf.int.test.ts › os `UPDATE` da migration
falha: objeto_apagado_em, id).toBeInstanceOf(Date)
-UPDATE "material" SET "objeto_apagado_em" = "enviado_em" WHERE "objeto_apagado_em" IS NULL;--> statement-breakpoint
+UPDATE "material" SET "objeto_apagado_em" = "enviado_em" WHERE "objeto_apagado_em" IS NOT NULL;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0049_material_extracao_no_worker.sql
teste: apps/worker/test/extrair-pdf.int.test.ts › os `UPDATE` da migration
falha: antigoProcessando)).toMatchObject
-UPDATE "material" SET "estado" = 'falhou', "falha" = 'extracao_falhou', "processado_em" = now() WHERE "estado" = 'processando';--> statement-breakpoint
+UPDATE "material" SET "estado" = 'falhou', "falha" = 'extracao_falhou', "processado_em" = now() WHERE "estado" = 'pronto';--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0049_material_extracao_no_worker.sql
teste: apps/worker/test/extrair-pdf.int.test.ts › os `UPDATE` da migration
-UPDATE "material" SET "estado" = 'falhou', "falha" = 'extracao_falhou', "processado_em" = now() WHERE "estado" = 'processando';--> statement-breakpoint
+UPDATE "material" SET "estado" = 'falhou', "falha" = 'extracao_falhou' WHERE "estado" = 'processando';--> statement-breakpoint
```

**Sem bloco, com o motivo** (as linhas que o `--faltando` ainda lista):

- `packages/core/src/db/schema/material.ts:73` (o `.where(...)` do índice parcial): descreve o índice que a migration `0049` cria; o teste "o material tem as duas colunas novas, nulas ao nascer, e o índice parcial do objeto a apagar" lê o `pg_indexes` do banco migrado, e mutar o schema TypeScript não muda o banco de teste.
- `packages/core/src/titular/s3-file-storage.ts:93` (`?? undefined`): só estreita o tipo opcional do `Body`; a resposta de sucesso sempre o traz, e `undefined` e `undefined` não se distinguem.
- `packages/core/src/material/pdf-extractor.ts:99, 108 e 132` (o prazo vencido): a falha `extracao_falhou` sai por três pontos (a entrada, o laço e o `catch`), e tirar um só não muda o resultado, só o trabalho feito; o caso "com o prazo já vencido, nada é lido" prova o resultado.
- `pdf-extractor.ts:100` (`!temAssinaturaDePdf`): a conferência antes do pdfjs só evita abrir o parser; o pdfjs recusa o mesmo arquivo como `InvalidPDFException`, que `falhaDoErro` traduz em `arquivo_invalido`, o mesmo resultado. A assinatura tem teste próprio ("a assinatura é conferida no conteúdo, nos primeiros 1024 bytes").
- `pdf-extractor.ts:114` (`!('str' in item)`), `:125` (`linhasPorPagina.length === 0`), `:62` e `:66` (os controles e o espaço único): código movido sem mudança, com os testes de hoje; o PDF de demonstração não tem marcador de conteúdo nem caractere de controle, e o documento sem página não chega a esta linha (o pdfjs o recusa antes). Nenhum caso novo os alcança sem criar um PDF só para eles.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª), infra-guardian (1ª) | O índice `material_objeto_a_apagar_idx` precisa de `@Unscoped` com justificativa escrita e de `EXPLAIN` na varredura; conferir também por `EXPLAIN` que `excluidosComObjeto` usa o `material_excluido_idx` | 2.0 (a varredura entre escolas é dela); o `EXPLAIN` do expurgo, na 2.0 junto com o da varredura |
| infra-guardian (1ª) | Capacidade da fila `pdf`: uma réplica, pool 1; um PDF que estoura o prazo três vezes segura a fila por cerca de 30 min; dizer no `docs/infra.md` quantas réplicas o onboarding pede | 9.0 (a corrida das 300 apostilas); o alerta de idade da fila `pdf`, 3.0 |
| infra-guardian (1ª) | Rollback: parágrafo no runbook sobre as linhas `job_registro` com `fila = 'pdf'` que o despachante antigo não reserva | 3.0 (alerta e runbook, conforme a Autoconferência, item 12, desta tarefa) |
| infra-guardian (1ª), privacy-guardian (1ª) | A spec precisa pousar com a 2.0 junto, sem pouso parcial, porque o `docs/lgpd.md` já conta com a varredura | Orquestrador, na hora do pouso (não é código desta tarefa); o bloqueante 1 acima trata do `processando` preso |
| revisor-geral (1ª) | Os tetos do §7c (100 envios por hora por pessoa, 300 por escola, 300 pendentes por escola) não estão em nenhuma tarefa do `tasks.md`, e o código segue com 30, 60 e 3 | Arquiteto, no planejamento (`tasks.md`): dar dono aos tetos; não é desta tarefa |
| test-engineer (1ª) | Falha final: nenhum caso mostra o job terminando `falhou` pelo caminho `ERRO_INTERNO` (o `extracao_falhou` que sobe); só o prazo passa pelo worker | `TODO.md` (um caso de worker para o `ERRO_INTERNO`); o Implementador registra |
| conformidade-reviewer (1ª) | Chamar de novo o revisor quando a 4.0 (capítulos) ou outra tarefa da F4 ligar `trecho` ao Assistente ou ao Tutor | 4.0 (`4_task.md`): o Arquiteto confere a linha "Subagentes obrigatórios" ao criar as tarefas |
| privacy-guardian (2ª), infra-guardian (2ª) | A spec pousa com a 2.0 e a 3.0, porque o `docs/lgpd.md` conta com a varredura e com o descarte; sem a 3.0 o material fica `processando` com o objeto | Orquestrador, na hora do pouso (não é código desta tarefa) |
| tenancy-guardian (2ª) | O teste dos dois `UPDATE` da 0049 acrescenta o filtro `escola_id`; a frase "e o de outra escola não muda" do `cenarios.md` sugere um isolamento que o teste não dá | `TODO.md` |
| tenancy-guardian (2ª), revisor-geral (2ª), infra-guardian (2ª) | O cabeçalho da 0049 e o comentário não dizem que os dois `UPDATE` são entre todas as escolas e trocam o `estado` de linhas vivas; a janela do deploy, no runbook | `TODO.md`; runbook da 3.0 (3.4) |
| revisor-geral (2ª), infra-guardian (2ª) | `interromper()` em `composition.ts` não espera o processador fechar o material antes de `armazemS3?.encerrar()` e `pool.end()` | 3.0 (o "Descartar" é o dono do `processando` preso); `TODO.md` |
| revisor-geral (2ª) | `3_task.md`, caso "Descartar o PDF": dizer o estado de partida e que o descarte libera o teto de 3 | 3.0 (`3_task.md`): o Arquiteto, ao revisar a tarefa; `TODO.md` |
| infra-guardian (2ª) | A janela do deploy cria material `processando` sem job: parágrafo no runbook ou ordem do deploy | 3.0 (runbook, 3.4) |
| revisor-geral, infra-guardian, test-engineer (2ª) | Pequenos de teste: `await` no `encerrar` (~658), 2 s para 10 s no "preso" (~308), `estado: 'processando'` do processador falso (~483), teto na corrida e `arrayContaining` do aviso, `sinal` obrigatório, citar os casos da linha "envio: recusa, teto e corrida" | `TODO.md` |
| conformidade-reviewer (2ª) | Chamar o revisor quando a 4.0 ligar `trecho` ao Assistente ou ao Tutor | 4.0 (`4_task.md`): o Arquiteto confere a linha "Subagentes obrigatórios" |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-11 13:37:03 | 2026-11-11 13:37:30 | `conformidade-reviewer` | 1 | APROVADO | a454d85fd0f872cad |
| 2026-11-11 13:36:25 | 2026-11-11 13:37:41 | `tenancy-guardian` | 1 | APROVADO | a30cb9e62f8c6ab83 |
| 2026-11-11 13:36:32 | 2026-11-11 13:38:10 | `privacy-guardian` | 1 | APROVADO | af9eb5923b65245ed |
| 2026-11-11 13:36:40 | 2026-11-11 13:39:42 | `infra-guardian` | 1 | APROVADO | aafb3467efa82a6e2 |
| 2026-11-11 13:36:57 | 2026-11-11 13:40:15 | `revisor-geral` | 1 | REPROVADO | ae1cc0977e55a8df3 |
| 2026-11-11 13:36:49 | 2026-11-11 13:41:05 | `test-engineer` | 1 | REPROVADO | af7999f5f35d802fd |
| 2026-11-11 14:35:40 | 2026-11-11 14:36:26 | `tenancy-guardian` | 2 | APROVADO | a29b2d08ffdaa6499 |
| 2026-11-11 14:35:59 | 2026-11-11 14:36:27 | `conformidade-reviewer` | 2 | APROVADO | ac7e6107ef840f40a |
| 2026-11-11 14:35:47 | 2026-11-11 14:37:17 | `privacy-guardian` | 2 | REPROVADO | a298084b0e70287ec |
| 2026-11-11 14:35:24 | 2026-11-11 14:37:43 | `revisor-geral` | 2 | APROVADO | a7f9e33cd1ecdbe67 |
| 2026-11-11 14:35:54 | 2026-11-11 14:37:45 | `infra-guardian` | 2 | APROVADO | a7f980693cd7ee4eb |
| 2026-11-11 14:35:35 | 2026-11-11 14:38:43 | `test-engineer` | 2 | APROVADO | a514e4e5a3d3ee403 |
| 2026-11-11 14:59:41 | 2026-11-11 15:00:01 | `revisor-geral` | 3 | APROVADO | aa20fbf7d5ec154b5 |
| 2026-11-11 14:59:37 | 2026-11-11 15:00:12 | `test-engineer` | 3 | APROVADO | a3b248b1c41ebc65c |
| 2026-11-11 14:59:33 | 2026-11-11 15:00:12 | `privacy-guardian` | 3 | APROVADO | ad7c56373ddbc7339 |
