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

- [x] 3.1 — Migration `0058`, no molde da `0049`
- [x] 3.2 — `ferramenta` em `QUEUE_NAMES` (depois da `interativa`), `QUEUE_PRIORITY` e `WORKER_POOL_OPTIONS_BY_QUEUE`
  (como a `interativa`); `VAGAS_ESCOLA_FERRAMENTA` 4 e `VAGAS_ESCOLA_INTERATIVA` 10 no despachante e no worker; `.env.example`
- [x] 3.3 — `JobExecutor`, `SlotReleasedNotifier` e os dois erros vão para `packages/core/src/jobs/`; sem reexportar do lugar antigo
- [x] 3.4 — `job-interativo-esperando.yaml` olha as duas filas; `docs/runbook.md` (l.39) diz as duas
- [x] 3.5 — `docs/infra.md` §5.3 e `docs/arquitetura.md`: a fila nova e as vagas
- [x] 3.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0058_fila_ferramenta.sql`, `packages/core/src/jobs/job-executor.ts`, `packages/core/src/jobs/job-adiado.error.ts`, `packages/core/src/jobs/job-failure.error.ts`, `packages/core/src/jobs/index.ts`, `packages/core/src/jobs/job-executor.test.ts` | novo (os quatro de código, movidos de `apps/worker/src/`) |
| `packages/core/drizzle/meta/_journal.json`, `packages/core/src/index.ts`, `packages/shared/src/system/jobs.ts`, `packages/core/src/queue/queues.ts`, `packages/core/src/settings/operational-settings.ts`, `apps/worker/src/composition.ts`, `apps/worker/src/config.ts`, `apps/despachante/src/config.ts`, `.env.example`, `infra/compose.yml`, `infra/grafana/alertas/job-interativo-esperando.yaml`, `infra/test/alertas.int.test.ts`, `docs/runbook.md`, `docs/infra.md`, `docs/arquitetura.md`, `apps/despachante/test/slots.int.test.ts` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| vaga própria | I | A com 4 sintéticos na `ferramenta` espera na 5.ª; um `interativa` da A começa na hora. Mutação: a chave da `interativa` | `apps/despachante/test/slots.int.test.ts › a ferramenta tem vaga própria: a escola A com 4 ferramentas rodando espera na 5.ª, e o Tutor dela (interativa) começa na hora` |
| isolamento das vagas | I | com as 4 da A tomadas, a `ferramenta` da B começa na hora. Mutação: a chave sem a escola | `apps/despachante/test/slots.int.test.ts › A sem vaga de ferramenta não atrasa B: com as 4 vagas da ferramenta da A tomadas` |
| sobreposição da escola | I | `vagas.ferramenta = 2` vale só para aquela escola; `vagas` nula usa 4 | `apps/despachante/test/slots.int.test.ts › borda: vagas nula usa o padrão da ferramenta; vagas.ferramenta=2 vale só para aquela escola` (a de A, a da B e a da C com `vagas` nula); a resolução pura: `packages/core/src/settings/operational-settings.test.ts › a vaga da \`ferramenta\` vale só para a escola que a configurou` |
| a `interativa` vai a 10, a `ferramenta` nasce com 4 | U | o padrão do despachante e do worker; não sobe com 0, fração ou texto | `apps/despachante/src/config.test.ts › converte o ambiente` (10 e 4); `apps/despachante/src/config.test.ts › não sobe com %s=0, fração ou texto` e o mesmo caso em `apps/worker/src/config.test.ts`; `tools/ci/ambiente.test.ts › a vaga do Tutor (\`interativa\`) é 10 e a da ferramenta é 4, as mesmas no despachante e em toda réplica do worker` |
| pool da `ferramenta` | U | `WORKER_POOL_OPTIONS_BY_QUEUE.ferramenta` com o lock e o stalled da `interativa` | `packages/core/src/queue/prioridade-das-filas.test.ts › o pool da \`ferramenta\` tem o lock e o stalled da \`interativa\``; a réplica que atende a fila sobe só com o pool dela: `apps/worker/src/config.test.ts › a fila \`ferramenta\` é uma fila que a réplica pode atender` |
| prioridade | I | um `ferramenta` novo começa antes de qualquer `normal` não iniciado, e depois de um `interativa` (`QUEUE_PRIORITY`) | o começo antes dos normais: `apps/despachante/test/slots.int.test.ts › caminho feliz: com 1.000 normais na fila, uma ferramenta nova começa antes de qualquer normal não iniciado`; a ordem, depois da `interativa`: `packages/core/src/queue/prioridade-das-filas.test.ts › a ordem das filas é a da prioridade` e `apps/despachante/src/outbox-relay.test.ts › a ferramenta é atendida depois da interativa e antes da normal` |
| caminho antigo | — | `grep -rn "apps/worker/src/job-executor" apps packages tools docs` vazio, ou cada linha justificada | a saída do `grep` está em "Divergências resolvidas nesta tarefa", abaixo da tabela |
| migration | I | os dois checks aceitam `ferramenta` e recusam fila desconhecida | `packages/core/src/db/migracao-fila-ferramenta.int.test.ts › o check da fila de \`job_registro\` aceita toda fila de \`QUEUE_NAMES\``, `› o check das vagas aceita \`vagas.ferramenta\``, `› só expande`, `› os dois checks terminam validados` e `› antes da migration o banco recusa \`ferramenta\``; o schema diz o mesmo: `packages/core/src/queue/prioridade-das-filas.test.ts › o check de \`job_registro\` e o das vagas, no schema` |
| inventário | I | `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts` verde (rode à mão) | `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts` (rodado à mão: verde) |
| executor no `core` | U | os testes de hoje passam no lugar novo | `packages/core/src/jobs/job-executor.test.ts` (movido com `git mv`, só os imports mudaram) |
| alerta | I | `ferramenta` esperando mais de 30 s dispara `job-interativo-esperando`; 20 s não fica pendente. Mutação: a regra só com a `interativa` | `infra/test/alertas.int.test.ts › a ferramenta esperando: a 20 s a regra nem fica pendente, passando de 30 s ela fica pendente e dispara` e a expressão exata: `infra/test/alertas.test.ts › são as das Tech Specs` |
| alerta tem runbook | U | `tools/guardas/alerta-tem-runbook.test.ts` acha o parágrafo | `tools/guardas/alerta-tem-runbook.test.ts` (inteiro) |
| compose | I | `tools/ci/compose.int.test.ts` com as variáveis novas (rode-o: o portão não o puxa) | `tools/ci/compose.int.test.ts` (rodado à mão: verde) |

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

**Plano.** `ferramenta` entra em `QUEUE_NAMES` entre a `interativa` e a `normal`, e `QUEUE_PRIORITY` é renumerada (1 a 5) para caber. O pool dela em `WORKER_POOL_OPTIONS_BY_QUEUE` é o da `interativa`. `VAGAS_ESCOLA_FERRAMENTA` (4) entra no schema de `lerVagasPadrao`, no `.env.example` e nos quatro serviços do compose que o leem, e `VAGAS_ESCOLA_INTERATIVA` vai a 10. A migration `0058`, no molde da `0049`, põe `ferramenta` em `job_registro_fila_valida` e em `configuracao_operacional_vagas_validas` (`DROP`, `ADD ... NOT VALID`, `VALIDATE`), com o schema TypeScript e o snapshot dizendo o mesmo. O `JobExecutor`, o `SlotReleasedNotifier` e os dois erros vão com `git mv` para `packages/core/src/jobs/`, com `bullmq` no `core`, e todo importador do worker passa a importar de `@educa/core`. O alerta `job-interativo-esperando` olha `fila=~"interativa|ferramenta"`, e o runbook, a `docs/infra.md` e a `docs/arquitetura.md` dizem as duas filas.

1. **Mutação de cada cláusula.** Os dois `ferramenta` de `QUEUE_NAMES`, os dois números de `QUEUE_PRIORITY` que fixam o lugar da `ferramenta` e o do `pdf`, os dois termos do pool, o `VAGAS_ESCOLA_FERRAMENTA` no schema e na saída de `lerVagasPadrao`, os dois checks do schema, as quatro linhas da migration (os dois `ADD` e os dois `VALIDATE`), os dois valores do `.env.example`, a linha nova de cada um dos quatro serviços do compose, a expressão do alerta e as duas constantes de `infra/scripts`. Cada uma é um bloco, 23 ao todo. O `DROP`, o `NOT VALID` e o executor movido ficam em "Sem bloco, com o motivo".
2. **O texto na tela.** A tarefa não tem tela: não se aplica.
3. **O segundo dado.** O isolamento usa a escola B com a `ferramenta` livre enquanto as 4 da A estão tomadas; a sobreposição tem a A com `vagas.ferramenta = 2`, a B e a C com `vagas` nula, para o padrão (4) e a exceção aparecerem juntos; a migration parte de um banco com um job e uma configuração de antes, e o teste de prioridade tem 1.000 `normal` já na fila.
4. **Checagem anterior que responde antes.** A vaga da `ferramenta` é o `ZSET` `vaga:ferramenta:{escola}`, separado do da `interativa`: o caso da vaga própria prova com a `interativa` da mesma escola começando na hora com as 4 tomadas, e não só com a `ferramenta` esperando. No alerta, o caso de integração insere o `job_registro` com `fila = 'ferramenta'` e confere o estado da regra no Grafana: a unidade (`alertas.test.ts`) fixa a expressão, e a integração prova que a série existe e dispara.
5. **Resultado, e não forma.** Os casos olham quem começou e quem esperou, o `vagas` gravado e aceito pelo banco, a ordem em que o relay serve as filas e o estado da regra de alerta; nenhum lê o texto do código.
6. **Guarda nova.** Nenhuma regra de lint nem teste estrutural nasce aqui; o `prioridade-das-filas.test.ts` confere que os dois checks do schema listam exatamente `QUEUE_NAMES`, para a próxima fila não esquecer um deles.
7. **Comentários.** Os docblocks de `QUEUE_NAMES`, `QUEUE_PRIORITY`, `queues.ts`, do `.env.example` e do `job-interativo-esperando.yaml` dizem o que o código faz hoje (a ordem das cinco filas, o porquê de a prioridade ser renumerada, as duas filas do alerta); o `compose.carga.yml` deixou de dizer cinco vagas.
8. **Divergências.** Na tabela acima, cada uma com o lugar da spec onde a decisão está.
9. **Peça que já existe.** O `JobExecutor`, o `SlotReleasedNotifier` e os dois erros foram movidos com `git mv`, e não copiados: o lugar antigo não existe mais e nada o reexporta. O limitador de vagas (`EscolaConcurrencyLimiter`), o outbox e o relay do despachante são os de sempre; a `ferramenta` só entra nas listas que eles já percorrem.
10. **Concorrência.** As 4 vagas da A tomadas ao mesmo tempo, com o quinto job esperando, são casos de `slots.int.test.ts` (o limitador é Redis, por escola e por fila); a migration não tem concorrência: o `NOT VALID` e o `VALIDATE` só existem para não travar escrita no deploy.
11. **Isolamento e coluna "Caso".** O caso `A sem vaga de ferramenta não atrasa B` é o isolamento do módulo; cada linha da tabela de testes nomeia o caso, e eu conferi cada nome com `grep -F` no arquivo.
12. **Guardiões.** `infra`: fila nova com vaga por escola, `interativa` a 10, migration expand-only (`NOT VALID` e `VALIDATE`), alerta com o runbook, nada de réplica nova. `tenancy`: a vaga é por escola (`vaga:{fila}:{escola}`), a `vagas` da escola só aceita inteiro positivo de fila que existe, e nenhuma tabela nova nasce.

## Fora do escopo desta tarefa

O `ia.executar` e o `worker-ia` (5.0); o alerta da espera estourada (7.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| `QUEUE_PRIORITY` foi renumerada (`interativa` 1, `ferramenta` 2, `normal` 3, `lote` 4, `pdf` 5), e as duas cópias da constante em `infra/scripts/` seguiram (`PRIORIDADE_DA_FILA_PDF = 5`, `PRIORIDADE_DO_LOTE = 4`) | a prioridade é um `smallint` que ordena a varredura e a reconciliação, e não cabe um valor entre o 1 e o 2; as duas constantes de `infra` repetem o número do `pdf` e do `lote` e o teste `alertas.test.ts` as confere; **efeito conhecido no deploy:** a migration não reescreve a `prioridade` das linhas que já estão em `job_registro`, então, até elas terminarem, um `lote` antigo (3) empata com o `normal` novo (3) e um `pdf` antigo (4) com o `lote` novo (4). Só a ordem da varredura e da reconciliação sente, o deploy é fora do horário letivo, e o `UPDATE` na migration foi recusado por mudar a migration (infra-guardian e test-engineer, 1ª rodada; o revisor-geral avaliou e não é bug) | `techspec.md` §5 "A fila" (a renumeração); `cenarios.md` §6 (a linha de prioridade) |
| `bullmq` (6.3.4, a versão do worker) entra em `dependencies` de `packages/core` | o `JobExecutor` importa `UnrecoverableError`, `DelayedError` e os tipos de `Job` do BullMQ, e o `core` não o declarava | `techspec.md` §5 "A fila" (o executor no `core` e a dependência) |
| Arquivos além dos de "Arquivos previstos": `packages/core/src/db/schema/configuracao-operacional-escola.ts` e `job-registro.ts` (os checks do schema), `packages/core/drizzle/meta/0058_snapshot.json`, `infra/compose.carga.yml` (o comentário das vagas), `infra/scripts/ensaio-alertas.ts`, `infra/scripts/expurgo-da-carga.ts`, `package.json` e `package-lock.json` do `core`, `eslint-suppressions.json`, os testes do worker e do despachante que montavam `Record<QueueName, number>` | o schema TypeScript tem de dizer o mesmo que a migration (o `prioridade-das-filas.test.ts` confere); o snapshot do drizzle acompanha a migration; o resto é consequência de `ferramenta` entrar em `QueueName`, de `QUEUE_PRIORITY` mudar e do executor mudar de pacote | `techspec.md` §3 (os dois checks) e §5 "A fila" |
| Não há `WORKER_POOL_FERRAMENTA` nem réplica do worker para a `ferramenta` | nenhuma réplica atende a fila até o `worker-ia` (5.0); o pool existe em `WORKER_POOL_OPTIONS_BY_QUEUE`, e o `config.ts` do worker já aceita a fila `ferramenta` como uma que a réplica pode atender | `techspec.md` §5 "A fila"; `tasks.md`, tarefa 5.0 |
| O caminho antigo: `grep -rn "apps/worker/src/job-executor" apps packages tools docs` não está vazio, e cada linha que sobra é justificada | `tools/processo/revisoes.test.ts` (linhas 95 e 928) usa o caminho como texto de um arquivo qualquer num mock de revisão: não importa nada de lá; `tools/renomear/mapas/*` são os relatórios históricos da renomeação X8, que registram o que existia então e não se reescrevem; nenhum `import`, nenhum doc vivo e nenhum código de `apps` ou `packages` o cita | `techspec.md` §2 (a linha `packages/core/src/jobs/`) |

## Mutações

--faltando: 29 linhas (23 blocos, 4 motivos)

Um bloco por cláusula que o diff acrescenta: a fila nova nas constantes (`QUEUE_NAMES`, `QUEUE_PRIORITY`, o pool), a vaga no padrão (o esquema do ambiente e a resolução), a lista de filas dos dois checks (no schema e na migration `0058`), as variáveis de ambiente (`.env.example` e os quatro serviços do compose), a regra do alerta e as duas prioridades que o `infra/scripts/` copia. O `JobExecutor` e os dois erros só mudaram de lugar (`git mv`, só os imports mudaram): nenhuma cláusula nova neles.

```mutacao
arquivo: packages/shared/src/system/jobs.ts
teste: packages/core/src/queue/queue-name.test.ts › a do worker é o nome de hoje
-export const QUEUE_NAMES = ['interativa', 'ferramenta', 'normal', 'lote', 'pdf'] as const
+export const QUEUE_NAMES = ['interativa', 'normal', 'lote', 'pdf'] as const
```

```mutacao
arquivo: packages/shared/src/system/jobs.ts
teste: apps/despachante/test/slots.int.test.ts › a ferramenta tem vaga própria
-export const QUEUE_NAMES = ['interativa', 'ferramenta', 'normal', 'lote', 'pdf'] as const
+export const QUEUE_NAMES = ['interativa', 'normal', 'lote', 'pdf'] as const
```

```mutacao
arquivo: packages/core/src/queue/job-outbox.ts
teste: packages/core/src/queue/prioridade-das-filas.test.ts › a ordem das filas é a da prioridade
-export const QUEUE_PRIORITY: Readonly<Record<QueueName, number>> = { interativa: 1, ferramenta: 2, normal: 3, lote: 4, pdf: 5 }
+export const QUEUE_PRIORITY: Readonly<Record<QueueName, number>> = { interativa: 1, ferramenta: 3, normal: 3, lote: 4, pdf: 5 }
```

```mutacao
arquivo: packages/core/src/queue/job-outbox.ts
teste: packages/core/src/queue/prioridade-das-filas.test.ts › a ordem das filas é a da prioridade
-export const QUEUE_PRIORITY: Readonly<Record<QueueName, number>> = { interativa: 1, ferramenta: 2, normal: 3, lote: 4, pdf: 5 }
+export const QUEUE_PRIORITY: Readonly<Record<QueueName, number>> = { interativa: 1, ferramenta: 2, normal: 3, lote: 4, pdf: 4 }
```

```mutacao
arquivo: packages/core/src/queue/queues.ts
teste: packages/core/src/queue/prioridade-das-filas.test.ts › o pool da `ferramenta` tem o lock e o stalled da `interativa`
-  ferramenta: { lockDurationMs: 10_000, stalledIntervalMs: 5_000 },
+  ferramenta: { lockDurationMs: 30_000, stalledIntervalMs: 30_000 },
```

```mutacao
arquivo: packages/core/src/queue/queues.ts
teste: packages/core/src/queue/prioridade-das-filas.test.ts › o pool da `ferramenta` tem o lock e o stalled da `interativa`
-  ferramenta: { lockDurationMs: 10_000, stalledIntervalMs: 5_000 },
+  ferramenta: { lockDurationMs: 10_000, stalledIntervalMs: 15_000 },
```

```mutacao
arquivo: packages/core/src/settings/operational-settings.ts
teste: apps/worker/src/config.test.ts › não sobe com VAGAS_ESCOLA_FERRAMENTA=0
   VAGAS_ESCOLA_INTERATIVA: vagaPositiva,
-  VAGAS_ESCOLA_FERRAMENTA: vagaPositiva,
```

```mutacao
arquivo: packages/core/src/settings/operational-settings.ts
teste: apps/despachante/src/config.test.ts › converte o ambiente
-  return { interativa: valores.VAGAS_ESCOLA_INTERATIVA, ferramenta: valores.VAGAS_ESCOLA_FERRAMENTA, normal: valores.VAGAS_ESCOLA_NORMAL, lote: valores.VAGAS_ESCOLA_LOTE, pdf: valores.VAGAS_ESCOLA_PDF }
+  return { interativa: valores.VAGAS_ESCOLA_INTERATIVA, ferramenta: valores.VAGAS_ESCOLA_INTERATIVA, normal: valores.VAGAS_ESCOLA_NORMAL, lote: valores.VAGAS_ESCOLA_LOTE, pdf: valores.VAGAS_ESCOLA_PDF }
```

```mutacao
arquivo: packages/core/src/db/schema/configuracao-operacional-escola.ts
teste: packages/core/src/queue/prioridade-das-filas.test.ts › o check de `job_registro` e o das vagas, no schema
-        and ${tabela.vagas} - 'interativa' - 'ferramenta' - 'normal' - 'lote' - 'pdf' = '{}'::jsonb
+        and ${tabela.vagas} - 'interativa' - 'normal' - 'lote' - 'pdf' = '{}'::jsonb
```

```mutacao
arquivo: packages/core/src/db/schema/job-registro.ts
teste: packages/core/src/queue/prioridade-das-filas.test.ts › o check de `job_registro` e o das vagas, no schema
-    check('job_registro_fila_valida', sql`fila in ('interativa', 'ferramenta', 'normal', 'lote', 'pdf')`),
+    check('job_registro_fila_valida', sql`fila in ('interativa', 'normal', 'lote', 'pdf')`),
```

```mutacao
arquivo: packages/core/drizzle/0058_fila_ferramenta.sql
teste: packages/core/src/db/migracao-fila-ferramenta.int.test.ts › o check das vagas aceita `vagas.ferramenta`
-        and "configuracao_operacional_escola"."vagas" - 'interativa' - 'ferramenta' - 'normal' - 'lote' - 'pdf' = '{}'::jsonb
+        and "configuracao_operacional_escola"."vagas" - 'interativa' - 'normal' - 'lote' - 'pdf' = '{}'::jsonb
```

```mutacao
arquivo: packages/core/drizzle/0058_fila_ferramenta.sql
teste: packages/core/src/db/migracao-fila-ferramenta.int.test.ts › o check da fila de `job_registro` aceita toda fila
-ALTER TABLE "job_registro" ADD CONSTRAINT "job_registro_fila_valida" CHECK (fila in ('interativa', 'ferramenta', 'normal', 'lote', 'pdf')) NOT VALID;--> statement-breakpoint
+ALTER TABLE "job_registro" ADD CONSTRAINT "job_registro_fila_valida" CHECK (fila in ('interativa', 'normal', 'lote', 'pdf')) NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0058_fila_ferramenta.sql
teste: packages/core/src/db/migracao-fila-ferramenta.int.test.ts › os dois checks terminam validados
-ALTER TABLE "configuracao_operacional_escola" VALIDATE CONSTRAINT "configuracao_operacional_vagas_validas";--> statement-breakpoint
+SELECT 1;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0058_fila_ferramenta.sql
teste: packages/core/src/db/migracao-fila-ferramenta.int.test.ts › os dois checks terminam validados
-ALTER TABLE "job_registro" VALIDATE CONSTRAINT "job_registro_fila_valida";
+SELECT 1;
```

```mutacao
arquivo: .env.example
teste: tools/ci/ambiente.test.ts › a vaga do Tutor
-VAGAS_ESCOLA_INTERATIVA=10
+VAGAS_ESCOLA_INTERATIVA=5
```

```mutacao
arquivo: .env.example
teste: tools/ci/ambiente.test.ts › a vaga do Tutor
-VAGAS_ESCOLA_FERRAMENTA=4
+VAGAS_ESCOLA_FERRAMENTA=2
```

```mutacao
arquivo: infra/compose.yml
teste: tools/ci/ambiente.test.ts › a vaga do Tutor
  VAGAS_ESCOLA_INTERATIVA: ${VAGAS_ESCOLA_INTERATIVA:?defina VAGAS_ESCOLA_INTERATIVA}
-      VAGAS_ESCOLA_FERRAMENTA: ${VAGAS_ESCOLA_FERRAMENTA:?defina VAGAS_ESCOLA_FERRAMENTA}
  VAGAS_ESCOLA_NORMAL: ${VAGAS_ESCOLA_NORMAL:?defina VAGAS_ESCOLA_NORMAL}
  VAGAS_ESCOLA_LOTE: ${VAGAS_ESCOLA_LOTE:?defina VAGAS_ESCOLA_LOTE}
  VAGAS_ESCOLA_PDF: ${VAGAS_ESCOLA_PDF:?defina VAGAS_ESCOLA_PDF}
  # Só o controle negativo do cenário de carga liga (npm run carga:controle-negativo); não sobe em produção.
```

```mutacao
arquivo: infra/compose.yml
teste: tools/ci/ambiente.test.ts › a vaga do Tutor
  WORKER_THREADS_MAXIMO: ${WORKER_INTERATIVO_THREADS_MAXIMO:?defina WORKER_INTERATIVO_THREADS_MAXIMO}
  VAGAS_ESCOLA_INTERATIVA: ${VAGAS_ESCOLA_INTERATIVA:?defina VAGAS_ESCOLA_INTERATIVA}
-      VAGAS_ESCOLA_FERRAMENTA: ${VAGAS_ESCOLA_FERRAMENTA:?defina VAGAS_ESCOLA_FERRAMENTA}
```

```mutacao
arquivo: infra/compose.yml
teste: tools/ci/ambiente.test.ts › a vaga do Tutor
  JANELA_LETIVA_FIM: ${JANELA_LETIVA_FIM:?defina JANELA_LETIVA_FIM}
  VAGAS_ESCOLA_INTERATIVA: ${VAGAS_ESCOLA_INTERATIVA:?defina VAGAS_ESCOLA_INTERATIVA}
-      VAGAS_ESCOLA_FERRAMENTA: ${VAGAS_ESCOLA_FERRAMENTA:?defina VAGAS_ESCOLA_FERRAMENTA}
```

```mutacao
arquivo: infra/compose.yml
teste: tools/ci/ambiente.test.ts › a vaga do Tutor
  STORAGE_CHAVE_SECRETA: ${STORAGE_CHAVE_SECRETA:?defina STORAGE_CHAVE_SECRETA}
  VAGAS_ESCOLA_INTERATIVA: ${VAGAS_ESCOLA_INTERATIVA:?defina VAGAS_ESCOLA_INTERATIVA}
-      VAGAS_ESCOLA_FERRAMENTA: ${VAGAS_ESCOLA_FERRAMENTA:?defina VAGAS_ESCOLA_FERRAMENTA}
```

```mutacao
arquivo: infra/grafana/alertas/job-interativo-esperando.yaml
teste: infra/test/alertas.test.ts › são as das Tech Specs
-              expr: max by (fila, escola_id) (job_espera_mais_antiga_s{fila=~"interativa|ferramenta"})
+              expr: max by (fila, escola_id) (job_espera_mais_antiga_s{fila="interativa"})
```

```mutacao
arquivo: infra/scripts/ensaio-alertas.ts
teste: infra/test/alertas.test.ts › são as das Tech Specs
-export const PRIORIDADE_DA_FILA_PDF = 5
+export const PRIORIDADE_DA_FILA_PDF = 4
```

```mutacao
arquivo: infra/scripts/expurgo-da-carga.ts
teste: infra/test/alertas.test.ts › são as das Tech Specs
-export const PRIORIDADE_DO_LOTE = 4
+export const PRIORIDADE_DO_LOTE = 3
```


**Sem bloco, com o motivo:**

- `packages/core/drizzle/0058_fila_ferramenta.sql`, os dois `DROP CONSTRAINT` e o `NOT VALID`: tirar um `DROP` faz o `ADD CONSTRAINT` seguinte falhar na carga da migration (erro de carga, que o portão recusa), e o `NOT VALID` seguido do `VALIDATE` só muda a trava de escrita durante a migration, nunca o estado final que o teste lê; o cabeçalho do arquivo diz a mesma coisa da `0049`.
- `packages/core/src/jobs/job-executor.ts` (as 29 linhas que o `--faltando` lista: `if`, `??`, `||` e `?:` do `#emAndamento` à `registrarFalha`): o arquivo foi movido com `git mv` de `apps/worker/src/job-executor.ts`, e o diff do portão (`--no-renames`) o conta como novo. Nenhuma linha de lógica mudou; só os imports passaram a caminhos relativos do `core` (`../context/context.js`, `../queue/...`, `../usage/usage-meter.js` e os outros). As condições são as de hoje, provadas pelos casos de hoje, que vieram junto no `job-executor.test.ts` movido (adiamento por vaga, vaga renovada e solta, tipo desconhecido, dados inválidos, `DelayedError` e `UnrecoverableError` que sobem, última tentativa, falha que registra) e pelos `apps/worker/test/job-execution.int.test.ts`, `job-reexecution.int.test.ts` e `job-timeout.int.test.ts`, que rodam o executor pelo `@educa/core`. Um bloco por linha repetiria mutação já feita quando o executor nasceu, sem provar nada novo sobre a `ferramenta`; o que esta tarefa muda no executor (o lugar) é provado pelo `job-executor.test.ts` carregar do `core` e pelo `grep` do caminho antigo, abaixo.
- `apps/worker/src/composition.ts`, `packages/core/src/index.ts`, `packages/core/src/jobs/index.ts` e os processadores do worker: só imports e re-exportações, sem condição.
- O alerta na `ferramenta` pela tela (`infra/test/alertas.int.test.ts › a ferramenta esperando`): a expressão exata, que o bloco do `job-interativo-esperando.yaml` muta, é provada pela unidade `alertas.test.ts`; o caso de integração sobe a stack inteira (uns 5 min) e prova o comportamento (20 s não fica pendente, 30 s fica, 1 min dispara), então a mutação roda na unidade e a integração roda uma vez, no portão.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª) | `VALIDATE` do check dentro da mesma transação da 0058, com `ACCESS EXCLUSIVE` em `job_registro`, que cresce a partir da 5.0: a migration seguinte que mexer num check dessa tabela separa o `VALIDATE` | `TODO.md` (o cabeçalho da 0058 já promete; falta o item para não depender de lembrança) |
| infra-guardian (1ª) | `docs/runbook.md`, causa 1: diagnóstico cita só `worker-interativo-*`; com o `worker-ia` o alerta na `ferramenta` pede o `ps` e o `logs` dele | tarefa 5.0 (`5_task.md`), que cria o `worker-ia` |
| revisor-geral (1ª) | Testes com a prioridade antiga escrita à mão: `'lote', 3` em `apps/despachante/test/queue-gauge.int.test.ts` (145, 154, 184, 258) e `apps/worker/test/expurgo.int.test.ts` (80, 91, 144, 206); `'normal', 2` em `packages/core/src/db/migrate.int.test.ts` (94, 97) e em `queue-gauge.int.test.ts` (195), usando `QUEUE_PRIORITY.<fila>` | `TODO.md`: os três arquivos não são tocados por esta tarefa e nenhuma asserção depende do número hoje |
| revisor-geral (1ª) | `docs/arquitetura.md` e `docs/infra.md` dizem "nenhuma réplica atende a `ferramenta` antes do `worker-ia`, na 5.0": a frase deixa de valer | tarefa 5.0, que precisa reescrevê-las |
| test-engineer (1ª) | `infra/test/alertas.int.test.ts:305`: o caso da `ferramenta` esperando depende de nenhuma réplica a atender; com o `worker-ia` quebra | tarefa 5.0 (segurar o job, por exemplo tomando as 4 vagas da escola antes) |
| test-engineer (1ª) | `tools/ci/ambiente.test.ts:150`: a conta "dez escolas cabem nos pools" deixa a `FERRAMENTA` de fora sem dizer | tarefa 5.0, ao criar `WORKER_POOL_FERRAMENTA` |
| test-engineer (1ª) | `slots.int.test.ts:200-221`: o caso do caminho feliz da `ferramenta` prova fila e pool próprios, não a `QUEUE_PRIORITY`, e o prazo de 2 s usa o relógio da máquina | recusada: o próprio test-engineer diz que a prioridade está provada em `prioridade-das-filas.test.ts` e `outbox-relay.test.ts`, e o prazo de 2 s repete o caso da `interativa` (l.171), que já existe; renomear o caso mexe nas referências da tabela "Testes que provam" e dos blocos de "Mutações" |
| test-engineer (1ª) | Não há caso com dois despachantes disputando a vaga da `ferramenta` | recusada: o limitador é o mesmo de todas as filas e já está provado com dois despachantes no lote; o test-engineer chama de "cobertura extra, não lacuna da regra" |
| test-engineer (1ª) | Valores esperados passaram a vir de `QUEUE_PRIORITY.*` em `job-execution.int.test.ts`, `expurgo-da-escola.int.test.ts` e `synthetic-jobs.int.test.ts` | sem ação: o próprio test-engineer conclui que não há furo, a ordem está guardada em `prioridade-das-filas.test.ts` |
| privacy-guardian (1ª) | O `dados` do job `ia.executar` só com ids: um caso que recuse campo de texto livre no esquema estrito do tipo, em `JOB_DEFINITIONS` | tarefa 5.0, que cria o tipo |
| privacy-guardian (1ª) | A cópia `failed` no Redis da `ferramenta` só com o código da falha, sem a mensagem do provedor de IA: caso com erro do adaptador | tarefa 5.0 |
| conformidade-reviewer (1ª) | O que a `ferramenta` gera para o aluno nasce pendente com aprovação registrada (regra 70, item 3): teste de integração pelo estado pendente via fila | tarefa 5.0 |
| conformidade-reviewer (1ª) | Guarda que recuse job de discursiva ou redação na `ferramenta` (D55) | tarefa 5.0 |
| infra-guardian (2ª) | Item no `TODO.md` para pôr `VAGAS_ESCOLA_FERRAMENTA=4` no `.env` da VPS, dono Joaquim, antes do primeiro deploy com a fila `ferramenta` (o passo só está no `docs/runbook.md`; os 6.000 do login têm item no TODO) | Orquestrador, ao pedir o pouso: é o passo do Joaquim, e o runbook já o diz. Item de `TODO.md` não entra agora para não caducar a rodada |
| revisor-geral (2ª) | Uma frase na `techspec.md` §5 "A fila" ou no passo de deploy do runbook sobre o empate de prioridade das linhas antigas | recusada: já está em "Divergências resolvidas" da 3.0, e o próprio revisor-geral concluiu na 1ª rodada que não é bug (a varredura só ordena) |
| test-engineer (2ª), revisor-geral (2ª) | As pendências que a tabela manda para a 5.0 (`alertas.int.test.ts:305`, `ambiente.test.ts:150`, frases de `arquitetura.md` e `infra.md`, causa 1 do runbook, e os testes do privacy-guardian e do conformidade-reviewer) não estão no `5_task.md` | Orquestrador/Arquiteto: copiar as linhas "tarefa 5.0" desta tabela para o `5_task.md` antes de a 5.0 começar. A Mesa não edita documento de tarefa |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-15 14:16:23 | 2026-11-15 14:16:59 | `tenancy-guardian` | 1 | APROVADO | a697f6e0d08ecc933 |
| 2026-11-15 14:16:48 | 2026-11-15 14:17:23 | `privacy-guardian` | 1 | APROVADO | a2cbd150527ed8846 |
| 2026-11-15 14:16:56 | 2026-11-15 14:17:26 | `conformidade-reviewer` | 1 | APROVADO | a4f937a6e947453a5 |
| 2026-11-15 14:16:15 | 2026-11-15 14:17:59 | `infra-guardian` | 1 | APROVADO | a0d36f50141dd1033 |
| 2026-11-15 14:16:40 | 2026-11-15 14:18:08 | `revisor-geral` | 1 | APROVADO | a14089f02fa382cc5 |
| 2026-11-15 14:16:32 | 2026-11-15 14:19:16 | `test-engineer` | 1 | APROVADO | ad7944a13c4c21678 |
| 2026-11-15 15:11:14 | 2026-11-15 15:11:33 | `infra-guardian` | 2 | APROVADO | a682ac0b510aaf1df |
| 2026-11-15 15:11:25 | 2026-11-15 15:11:39 | `tenancy-guardian` | 2 | APROVADO | a7c7f33008546fac8 |
| 2026-11-15 15:11:36 | 2026-11-15 15:11:59 | `test-engineer` | 2 | APROVADO | ac087fafcad768add |
| 2026-11-15 15:11:58 | 2026-11-15 15:12:15 | `privacy-guardian` | 2 | APROVADO | a7e875fb539f0f8ac |
| 2026-11-15 15:11:47 | 2026-11-15 15:12:22 | `revisor-geral` | 2 | APROVADO | ab3c4af139de7fac8 |
| 2026-11-15 15:12:09 | 2026-11-15 15:12:24 | `conformidade-reviewer` | 2 | APROVADO | ac7dca903f0eb3ad0 |
