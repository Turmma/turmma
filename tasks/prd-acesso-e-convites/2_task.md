# Tarefa 2.0 — O envio adia sem prender a fila: `EMAIL_POR_MINUTO` e a saída de adiar

**Funcionalidade:** acesso-e-convites · **Depende de:** 1.0
**Subagentes obrigatórios:** `infra-guardian`, `tenancy-guardian`, `test-engineer`
**Porte:** grande

## Objetivo

O job de e-mail consome o `EMAIL_POR_MINUTO` (global, atômico no Redis de fila) e, sem vaga, reserva alheia ou Redis, adia: libera a vaga da escola, volta a `publicado`, não gasta tentativa nem uso, e espera o `msBeforeNext` mais até 5 s sorteados; mede resultado e adiamento, com alerta.

## Contexto necessário

- `techspec.md` seções 2, 5 ("E-mail") e 7c; `cenarios.md` RF11 (o `EMAIL_POR_MINUTO` e o adiamento) e "Limites"
- `.claude/rules/80` itens 2, 3, 5 e 10
- `apps/worker/src/job-executor.ts:394-401` (`esperarVaga`): o modelo; aqui o job já tomou a vaga
- `packages/core/src/queue/escola-concurrency-limiter.ts:43` (`vaga:normal:sistema`)

## Subtarefas

- [ ] 2.1 — O limitador do `EMAIL_POR_MINUTO` no Redis de fila, com a metade reservada ao link da conta, sem seguro em memória; o ponto sem envio volta só na mesma janela
- [ ] 2.2 — A saída de adiar no `job-executor`: para a renovação, libera a vaga, linha a `publicado`, sem `uso.marcar('jobs')`, espera com o sorteio injetado
- [ ] 2.3 — Métricas de e-mail por resultado e de adiamento; alerta `falhou` acima de 20% em 1 h, com o parágrafo do `docs/runbook.md`
- [ ] 2.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/email/limite-por-minuto.ts` | novo |
| `packages/core/src/email/index.ts` | alterado |
| `apps/worker/src/job-executor.ts` | alterado |
| `apps/worker/src/processors/enviar-email.ts` | alterado |
| `packages/core/src/telemetry/metrics.ts` | alterado |
| `infra/grafana/alertas/email-falhou.yaml` | novo |
| `docs/runbook.md` | alterado |
| `apps/worker/src/job-executor.test.ts` | alterado |
| `apps/worker/test/enviar-email-adiamento.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| `EMAIL_POR_MINUTO` estourado, adiado mais vezes que as tentativas | integração | tentativas intactas, nunca `falhou`, envia quando a vaga abre | |
| Redis de fila fora | integração | adia, nenhum envio, nada `falhou`, sem seguro em memória | |
| Redis de fila de volta | integração | retomado, envia uma vez | |
| escola com limite `normal` = 1 e um convite adiado | integração | outro job `normal` da escola roda sem esperar a validade da vaga | |
| job adiado | integração | linha em `publicado`, contador `jobs` intacto | |
| espera do job adiado | integração | entre o `msBeforeNext` e ele mais 5 s, nunca 1 s fixo | |
| [U] sorteio injetado: limites | unidade | mínimo `msBeforeNext`, máximo + 5 s; o mesmo com o prazo da reserva e com o Redis fora (30 s) | |
| [U] dois sorteios diferentes | unidade | esperas diferentes | |
| `EMAIL_POR_MINUTO` = 1, ponto consumido e linha com reserva alheia, `enviado` ou `cancelado` | integração | o ponto volta, o envio seguinte sai no minuto | |
| ponto consumido no segundo 59, devolvido no minuto seguinte | integração | não volta | |
| tentativa recusada pelo SMTP ou caída | integração | o ponto não volta | |
| [P] reentrega com a reserva alheia presa na barreira | paralelo | adia até o prazo (relógio falso), sem tentativa, depois envia; cai ignorando o prazo | |
| [P] mais consumos que o teto, de dois workers | paralelo | envios = teto exato; cai com ler-e-gravar | |
| métricas | integração | resultado e adiamento lidos como no `metrics.int.test.ts` | |
| alerta novo | unidade | tem a entrada no runbook (`alerta-tem-runbook.test.ts`) | |

## Como testar

- Métrica: `apps/realtime/test/metrics.int.test.ts` › "realtime.conexoes acompanha os clientes abertos nesta instância, sem rótulo de escola, sala ou usuário"; apoio `MedidorDeTeste` (`tools/testes/metricas.ts`)
- Alerta: `tools/guardas/alerta-tem-runbook.test.ts` › "reprova: regra nova sem entrada no runbook"
- Vaga e despachante: `QueueFixtures.reservar(escolaId, fila, limite)` e `despachante(log, opcoes)` (`apps/worker/test/queue.fixture.ts`)
- Teto entre instâncias: `apps/api/test/rate-limit.int.test.ts` › "o limite gasto numa instância vale na outra: o 21º pedido, na API 2, recebe 429"
- Sorteio: injete a fonte como o relógio (`Clock`, `packages/core/src/clock.ts`)
- Comando: `npx vitest run --project integracao apps/worker/test/enviar-email-adiamento.int.test.ts`

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 4: com a vaga ocupada pelo adiado, o outro job tem de esperar se a liberação sumir; prove pelo efeito, não pela espera.

## Fora do escopo desta tarefa

A cota de 300/h do "Enviar" (3.0); o job da conta e a metade reservada vista pelo lado dele (5.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
