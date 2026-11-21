# Tarefa 4.0 — Acima do teto de segurança só o lote espera, e a Operação é avisada a 80%, 100% e no teto

**Funcionalidade:** camada-ia · **Depende de:** 2.0
**Subagentes obrigatórios:** `tenancy-guardian`, `infra-guardian`, `llm-integrator`
**Porte:** grande

## Objetivo

Com o custo do mês acima de orçamento × teto ÷ 100, o job de lote da escola é adiado até a virada ou até o teto subir, e
nada mais para. A medida do worker publica o uso do mês e do teto por escola, regrava o retrato e alimenta três alertas
com runbook.

## Contexto necessário

- `techspec.md` §5 ("O teto de segurança"), §6 (a medida), §7 (o log), §7c (métrica e alerta, laços)
- `prd.md` RF9 (o lado da Operação), RF10, §7 ("Virada do mês")
- `cenarios.md` §1 RF8 (retrato), RF9 (a medida e os alertas, menos o da reserva), RF10 (todas), §2 ("Soma do mês", o
  lote de A segue e o de B é adiado), §3 (o retrato por duas réplicas)
- `.claude/rules/` 10, 30 (item 8), 80
- Código: `apps/api/src/ia/orcamento.repository.ts` (`OrcamentoQuery`), `apps/api/src/ia/execucao.processor.ts`
  (`JobAdiadoError`, motivos), `apps/worker/src/classificacao-gauge.ts` e o registro em `apps/worker/src/composition.ts`,
  `infra/grafana/alertas/classificacao-atrasada.yaml`

## Subtarefas

- [ ] 4.1 — `OrcamentoQuery` ganha `fila`; só a `lote` confere o teto, pelo `OrcamentoDoMesRepository`; `IA_ORCAMENTO_ESGOTADO`
  com `tenteDeNovoEmSegundos = mín(até a virada de São Paulo, 3.600)`
- [ ] 4.2 — O processador adia com motivo `orcamento`, sem contar tentativa; `ia.lote.adiado{motivo}`; log `ia.lote.adiado_pelo_orcamento` só com ids
- [ ] 4.3 — `apps/worker/src/orcamento-gauge.ts`: `ia.orcamento.uso_do_mes{escola_id}` e `ia.orcamento.uso_do_teto{escola_id}`
  de uma soma só, e o retrato regravado com `on conflict`; sem série em escola `sem_orcamento` ou `sem_aluno_ativo`
- [ ] 4.4 — Alertas `ia-orcamento-do-mes.yaml` (0,8 e 1,0) e `ia-orcamento-teto.yaml` (1,0), com os parágrafos do runbook;
  o do teto cita "Classificação do material atrasada"
- [ ] 4.5 — `docs/runbook.md`, "Voltar o código depois da camada-ia 4.0": o lote adiado volta a correr
- [ ] 4.6 — Nada em `packages/shared`: o código de erro entrou na 2.0
- [ ] 4.7 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/ia/orcamento.repository.ts`, `apps/api/src/ia/execucao.processor.ts`, `apps/api/src/ia/ia-do-worker.module.ts` | alterado |
| `packages/core/src/ia/llm-gateway.ts`, `packages/core/src/ia/errors.ts` | alterado |
| `apps/api/src/ia/orcamento-teto.int.test.ts` | novo |
| `apps/worker/src/orcamento-gauge.ts`, `apps/worker/src/composition.ts`, `apps/worker/test/orcamento-gauge.int.test.ts` | novo e alterado |
| `infra/grafana/alertas/ia-orcamento-do-mes.yaml`, `infra/grafana/alertas/ia-orcamento-teto.yaml`, `infra/test/alertas.test.ts` | novo e alterado |
| `docs/runbook.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| teto 200%: no limite exato o lote segue; um micro acima, `pendente` com `JobAdiadoError(orcamento)`, sem tentativa, métrica +1 | I | `>`, não `>=` | |
| às 23h50 do último dia: 600 s; no meio do mês: 3.600 | U | o `mín` | |
| na virada, o adiado roda; com o teto subido, também | I | RF10 | |
| `sem_orcamento` ou `sem_aluno_ativo`: nunca adiado | I | orçamento zero não é teto zero | |
| acima de 100% e do teto, `interativa`, `ferramenta` e `normal` são atendidas | I | só o lote | |
| A (20%) segue e B (111%, teto 100%) é adiada | I | escopo da soma | |
| a medida publica 0,79 → 0,81 → 1,02 para a escola certa | I | a série | |
| escola `sem_orcamento` e `sem_aluno_ativo`: nenhuma série | I | sem divisão por zero | |
| o retrato às 21h30 do último dia grava o mês que acaba; duas réplicas, uma linha | I | o mês de São Paulo; `on conflict` | |
| os alertas têm expressão, `for:`, `noDataState = OK` e runbook; o do teto cita "Classificação do material atrasada" | U | o alerta | |

## Como testar

- Adiamento: `apps/api/src/material/classificacao.int.test.ts` › "balde cheio (a recusa antes da chamada): a execução volta
  a `pendente`, o job é adiado com motivo `provedor`…" — troque o motivo por `orcamento` e o balde pelo custo semeado
- Relógio falso e virada: o mesmo arquivo › "o job que volta às 10h05 de segunda…"
- Medida: `apps/worker/test/importacao-gauge.int.test.ts` › "a importação de B não aparece na série de A…" e
  › "montada no worker de lote…"
- Alerta: `infra/test/alertas.test.ts` › "são as das Tech Specs, com o `for:` e o limiar declarados…";
  `tools/guardas/alerta-tem-runbook.test.ts`
- Retrato em corrida: `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`)
- `npx vitest run --project integracao apps/api/src/ia/orcamento-teto.int.test.ts apps/worker/test/orcamento-gauge.int.test.ts`

## Fora do escopo desta tarefa

O alerta da reserva (9.0); as telas (7.0, 8.0); o corte do Tutor (D38, não muda).

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano antes de codar.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

```mutacao
arquivo:
teste:
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
