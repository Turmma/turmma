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

- [ ] 1.1 — `PdfExtractor` e o repository da extração em `packages/core/src/material/`, com os testes de hoje
- [ ] 1.2 — `guardarBytes` e `lerBytes` no `FileStorage` (S3 e memória), com prazo; bucket sem versionamento
- [ ] 1.3 — Migration: `processado_em` e `objeto_apagado_em`, nulas; os checks de fila e de `vagas` aceitam `pdf` (`NOT VALID`, `VALIDATE`)
- [ ] 1.4 — `pdf` em `QUEUE_NAMES`; `material.extrair-pdf` (10 min, 3 tentativas); `VAGAS_ESCOLA_PDF=2` no worker e no despachante; pool de um PDF por vez com `lockDuration` e stalled; `worker-pdf` no `infra/compose.yml`, `cpus` limitado
- [ ] 1.5 — Processador: a transição da §5 abre a transação (sem linha, conclui sem efeito); `sem_texto`, `arquivo_invalido` e objeto ausente vão a `falhou` numa tentativa; objeto ausente de material fora de `processando` conclui sem efeito; o objeto sai depois do commit
- [ ] 1.6 — O envio grava o objeto e enfileira; exclusão em `processando` e expurgo apagam o objeto
- [ ] 1.7 — Métrica e log, com `arquivo_ausente` à parte de `extracao_falhou` (R6)
- [ ] 1.8 — Documentos: `docs/modelo-de-dados.md` (corrigir "o arquivo não é guardado"), `docs/lgpd.md` (o PDF temporário), `docs/arquitetura.md`, `docs/infra.md` (a réplica)
- [ ] 1.9 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/material/pdf-extractor.ts`, `packages/core/src/material/extracao.repository.ts`, `packages/core/src/material/index.ts`, `packages/core/drizzle/0049_*.sql`, `apps/worker/src/processors/extrair-pdf.ts`, `apps/worker/test/extrair-pdf.int.test.ts` | novo |
| `packages/core/src/index.ts`, `packages/core/src/titular/file-storage.ts`, `packages/core/src/queue/queues.ts`, `packages/core/src/settings/operational-settings.ts`, `packages/core/src/db/schema/material.ts`, `packages/shared/src/system/jobs.ts`, `packages/shared/src/system/job-definitions.ts`, `apps/worker/src/composition.ts`, `apps/worker/src/config.ts`, `apps/despachante/src/config.ts`, `apps/api/src/material/material.service.ts`, `apps/api/src/material/material.repository.ts`, `apps/api/src/material/extraction-queue.ts`, `apps/api/src/material/pdf-extraction.ts`, `infra/compose.yml` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| caminho feliz | I | `pronto`, trechos, as duas colunas; o objeto sai só depois do commit | |
| Prazo | I | `TEMPO_ESGOTADO`, vaga livre; na 3ª, `falhou` e objeto apagado | |
| SIGTERM além da graça | I | `EXECUCAO_INTERROMPIDA` na última; com tentativa sobrando, o objeto fica | |
| Falha final | I | job e material `falhou`, `job.falhostipo` sobe, objeto apagado | |
| `sem_texto`; `arquivo_invalido` | I | `falhou` numa tentativa, vaga liberada | |
| objeto ausente, `processando` | I | `extracao_falhou`, sem valor novo em `falha` | |
| [P] excluído entre `lerParaExtrair` e `lerBytes` | P | sem efeito, sem `job.falhos`. Mutação: todo ausente vira `falhou` (R6) | |
| [P] segundo job parado até o primeiro dar commit | P | segue `pronto`. Mutações: só `excluido_em`; `falhou` sem `estado = 'processando'` | |
| concorrência: dois jobs em `Promise.all` | P | trechos uma vez | |
| exclusão em `processando` | I | objeto some, o job não grava | |
| vaga: A com 10 pendentes e vaga 2 | I | o PDF da B conclui antes. Mutação: ignorar a vaga | |
| checks da migration | I | aceitam `pdf` | |
| configuração | U | vaga 2 e cede à escola, nos dois apps; `worker-pdf` um por vez, `lockDuration`, stalled, e não sobe sem o storage (R6) | |
| isolamento, repository | I | `lerParaExtrair` com o id da B: vazio. Mutação: tirar `escola_id` | |
| isolamento, job | I | job da A com material da B: nada lido nem gravado | |
| expurgo | I | apaga os objetos da A, não os da B | |
| log e métrica | I | ids e códigos, nunca título, arquivo, licenciante, texto; `arquivo_ausente` à parte (R6) | |

## Como testar

- Processador: `apps/worker/test/expurgo-da-escola.int.test.ts` › "toda categoria percorrida grava a sua linha…", com `rodar(escolaId, processador)` e `job-execution.fixture.ts`
- Prazo e SIGTERM: `apps/worker/test/job-timeout.int.test.ts`, `job-reexecution.int.test.ts`
- Configuração: `apps/worker/src/config.test.ts`, `apps/despachante/src/config.test.ts`
- Storage: `InMemoryFileStorage` (`packages/core/src/titular/file-storage.ts:57`), com `lerBytes` numa barreira para os [P]
- Comando: `npx vitest run --project integracao apps/worker/test/extrair-pdf.int.test.ts`
- Armadilha: cada termo da transição é um bloco, e o SQL em template string também (retro da F2c, M1)

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano.

## Fora do escopo desta tarefa

Varredura (2.0); `ops:jobs` e alerta (3.0); capítulos (4.0); substituição (8.0).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar
