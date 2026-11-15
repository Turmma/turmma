# Tarefa 3.0 — A fila `ferramenta` existe, com vaga própria por escola, e o executor de jobs mora no `core` (47.0)

**Funcionalidade:** reengenharia-continuacao · **Depende de:** nenhuma
**Subagentes obrigatórios:** `infra-guardian`, `tenancy-guardian`
**Porte:** grande

## Objetivo

A fila `ferramenta` nasce entre a `interativa` e a `normal`, com 4 vagas por escola, e a `interativa` vai a 10. O
`JobExecutor` vai para `packages/core/src/jobs/`, para a 5.0 o usar na API. O alerta de job esperando olha também a `ferramenta`.

## Contexto necessário

- `techspec.md` §2 (linhas `packages/core/src/jobs/`, `packages/shared/src/system/`, `operational-settings.ts`), §3, §5 "A fila", §7c "Limite por escola"
- `prd.md` RF2; regras 00, 10, 40, 80 (2, 3, 9, 10)
- `tasks/prd-reengenharia/onda-3a.md` "Filas separadas e a vaga por escola" (a conta do pool por réplica)
- Código: a migration `packages/core/drizzle/0049_*.sql` (a `pdf` nos mesmos checks); `apps/worker/src/job-executor.ts` e
  `composition.ts:186`

## Subtarefas

- [ ] 3.1 — Migration `0058`, no molde da `0049`
- [ ] 3.2 — `ferramenta` em `QUEUE_NAMES` (depois da `interativa`), `QUEUE_PRIORITY` e `WORKER_POOL_OPTIONS_BY_QUEUE`
  (como a `interativa`); `VAGAS_ESCOLA_FERRAMENTA` 4 e `VAGAS_ESCOLA_INTERATIVA` 10 no despachante e no worker; `.env.example`
- [ ] 3.3 — `JobExecutor`, `SlotReleasedNotifier` e os dois erros vão para `packages/core/src/jobs/`; sem reexportar do lugar antigo
- [ ] 3.4 — `job-interativo-esperando.yaml` olha as duas filas; `docs/runbook.md` (l.39) diz as duas
- [ ] 3.5 — `docs/infra.md` §5.3 e `docs/arquitetura.md`: a fila nova e as vagas
- [ ] 3.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0058_fila_ferramenta.sql`, `packages/core/src/jobs/job-executor.ts`, `packages/core/src/jobs/job-adiado.error.ts`, `packages/core/src/jobs/job-failure.error.ts`, `packages/core/src/jobs/index.ts`, `packages/core/src/jobs/job-executor.test.ts` | novo (os quatro de código, movidos de `apps/worker/src/`) |
| `packages/core/drizzle/meta/_journal.json`, `packages/core/src/index.ts`, `packages/shared/src/system/jobs.ts`, `packages/core/src/queue/queues.ts`, `packages/core/src/settings/operational-settings.ts`, `apps/worker/src/composition.ts`, `apps/worker/src/config.ts`, `apps/despachante/src/config.ts`, `.env.example`, `infra/compose.yml`, `infra/grafana/alertas/job-interativo-esperando.yaml`, `infra/test/alertas.int.test.ts`, `docs/runbook.md`, `docs/infra.md`, `docs/arquitetura.md`, `apps/despachante/test/slots.int.test.ts` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| vaga própria | I | A com 4 sintéticos na `ferramenta` espera na 5.ª; um `interativa` da A começa na hora. Mutação: a chave da `interativa` | |
| isolamento das vagas | I | com as 4 da A tomadas, a `ferramenta` da B começa na hora. Mutação: a chave sem a escola | |
| sobreposição da escola | I | `vagas.ferramenta = 2` vale só para aquela escola; `vagas` nula usa 4 | |
| a `interativa` vai a 10, a `ferramenta` nasce com 4 | U | o padrão do despachante e do worker; não sobe com 0, fração ou texto | |
| pool da `ferramenta` | U | `WORKER_POOL_OPTIONS_BY_QUEUE.ferramenta` com o lock e o stalled da `interativa` | |
| prioridade | I | um `ferramenta` novo começa antes de qualquer `normal` não iniciado, e depois de um `interativa` (`QUEUE_PRIORITY`) | |
| caminho antigo | — | `grep -rn "apps/worker/src/job-executor" apps packages tools docs` vazio, ou cada linha justificada | |
| migration | I | os dois checks aceitam `ferramenta` e recusam fila desconhecida | |
| inventário | I | `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts` verde (rode à mão) | |
| executor no `core` | U | os testes de hoje passam no lugar novo | |
| alerta | I | `ferramenta` esperando mais de 30 s dispara `job-interativo-esperando`; 20 s não fica pendente. Mutação: a regra só com a `interativa` | |
| alerta tem runbook | U | `tools/guardas/alerta-tem-runbook.test.ts` acha o parágrafo | |
| compose | I | `tools/ci/compose.int.test.ts` com as variáveis novas (rode-o: o portão não o puxa) | |

## Como testar

- Vagas: `apps/despachante/test/slots.int.test.ts` › "borda: vagas nula usa o padrão; vagas.lote=5 vale só para aquela
  escola" e "A sem vaga não atrasa B: com as vagas interativas da A tomadas…"; troque a fila pela `ferramenta`
- Prioridade: › "caminho feliz: com 1.000 lotes na fila, um interativo novo começa antes de qualquer lote não iniciado"
- Check da migration: › "o banco recusa vaga que o despachante não saberia usar…"; e `apps/worker/test/extrair-pdf.int.test.ts`
  › "o check da fila de `job_registro` aceita `pdf`…"
- Alerta: `infra/test/alertas.int.test.ts` › "borda: espera curta não dispara — a 20 s nem fica pendente…"
- Comando: `npx vitest run --project integracao apps/despachante/test/slots.int.test.ts`
- Armadilha (retro da F4, grupo E): migration nova quebra o inventário fora do diff; rode o `mvp-tables` e o `compose.int` à mão

## Autoconferência

As 12 perguntas do modelo, respondidas no plano. Na 1: o SQL da migration e a lista da `ferramenta` em cada constante são
blocos. Na 9: mova o executor, não copie.

## Fora do escopo desta tarefa

O `ia.executar` e o `worker-ia` (5.0); o alerta da espera estourada (7.0).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar
