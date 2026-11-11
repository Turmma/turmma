# Tarefa 3.0 — A operação lista, reprocessa e descarta job (46.0), e o alerta `pdf-parado` avisa

**Funcionalidade:** ingestao-do-material · **Depende de:** 1.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

A equipe lista, reprocessa e descarta job que falhou, com chamado e auditoria, sem ver `dados`; o alerta `pdf-parado`
dispara quando a fila `pdf` para.

## Contexto necessário

- `techspec.md` §2, §6, §7 (auditoria), §7c (alerta), §11 (o `pdf-esperando` não nasce)
- `prd.md` RF13, RF15
- `tasks/prd-reengenharia/onda-3b.md` "T5 — listar, reprocessar e descartar (46.0)": é o desenho dos comandos
- `cenarios.md` "Extração no worker" e "Fila `pdf`"
- `.claude/rules/` 10, 20, 40, 80
- Código: `apps/api/src/ops/command.ts`, `apps/api/src/ops/retencao.ts`, `apps/api/src/ops/revogar-acessos-sala.ts`; `infra/grafana/alertas/importacao-parada.yaml`;
  `infra/scripts/ensaio-alertas.ts`

## Subtarefas

- [ ] 3.1 — `operacao/jobs-que-falharam.repository.ts`: listar e ler por id com `@Unscoped` e motivo; marcar no contexto da escola da linha
- [ ] 3.2 — `ops:jobs-que-falharam`, `ops:reprocessar-job <id> --chamado <n>`, `ops:descartar-job <id> --chamado <n>`, com `where estado = 'falhou'`; reprocessar recusa `ia.*`, `titular.*` e `material.extrair-pdf` ("Tentar de novo é envio novo"); descartar recusa `ia.*` e `titular.*`; o descarte do PDF deixa o material `falhou` e apaga o objeto
- [ ] 3.3 — `job.reprocessado` e `job.descartado` em `packages/core/src/auditoria/acoes.ts`, `z.strictObject`, nunca `dados`
- [ ] 3.4 — Os comandos no `package.json` e no `docs/runbook.md`
- [ ] 3.5 — Alerta `infra/grafana/alertas/pdf-parado.yaml`: o job `pdf` mais antigo pendente há mais de 15 min **e** nenhuma extração terminada (`pronto` ou `falhou`) nos últimos 15; no `ensaio-alertas.ts`; seção no runbook
- [ ] 3.6 — `docs/infra.md`: o disco do temporário no pior caso, cerca de 60 GB (R6)
- [ ] 3.7 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/operacao/jobs-que-falharam.repository.ts`, `apps/api/src/ops/jobs-que-falharam.ts`, `apps/api/src/ops/reprocessar-job.ts`, `apps/api/src/ops/descartar-job.ts`, `apps/api/test/ops-jobs.int.test.ts` | novo |
| `apps/api/src/ops/command.ts`, `packages/core/src/auditoria/acoes.ts`, `package.json`, `docs/runbook.md`, `docs/infra.md` | alterado |
| `infra/grafana/alertas/pdf-parado.yaml`, `infra/scripts/ensaio-alertas.ts`, `infra/test/alertas.int.test.ts` | novo e alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| Reprocessar um tipo aceito | I | o job conclui, a cópia `failed` sai e a reconciliação não republica | |
| concorrência: dois reprocessar em `Promise.all` | P | só um reprocessa | |
| recusa de `ia.*` | I | recusado. Mutação: tirar o tipo da lista | |
| recusa de `titular.*` | I | recusado | |
| recusa de `material.extrair-pdf` | I | "Tentar de novo é envio novo" | |
| Descartar o PDF | I | material `falhou`, objeto apagado, no contexto da escola do job | |
| Descartar `sistema.*`; `retencao.*` | I | descartam (um caso cada) | |
| Descartar um job `aguardando` | I | recusado; linha, material e objeto intactos. Mutação: tirar `where estado = 'falhou'` | |
| `--chamado` 0, negativo, texto | I | recusado antes de tocar a linha (um caso cada) | |
| Auditoria | I | `job.reprocessado` e `job.descartado` com o chamado; uma sentinela em `dados` fora da saída, da auditoria e do log | |
| isolamento: o descarte marca só na escola da linha | I | o material da B com o mesmo id de job não muda. Mutação: marcar fora do contexto | |
| a listagem | I | traz id, escola, tipo, código e data, e nunca `dados` | |
| `pdf-parado`: primeiro job depois de horas sem PDF | I | não dispara | |
| `pdf-parado`: 300 pendentes com extrações terminando, inclusive `falhou` | I | não dispara | |
| `pdf-parado`: `worker-pdf` parado e job pendente há 16 min | I | dispara | |
| o alerta no ensaio | I | `ensaio:alertas` leva `pdf-parado` a disparado | |
| log novo dos comandos | I | ids, tipo, código e chamado; nunca `dados` | |

## Como testar

- Comando: `apps/api/src/ops/revogar-acessos-sala.test.ts` › "sem OPERADOR, ou fora do formato, sai com 2…", `apps/api/test/ops-revogar-acessos-sala.int.test.ts` › "E29: revoga todos os vigentes de A na hora…"
- Não há reprocessar nem descartar hoje (`docs/runbook.md:86` descreve o manual): o mais próximo é a reconciliação em `packages/core/src/queue/`
- Alerta: `infra/test/alertas.int.test.ts` › "caminho feliz: `ensaio:alertas` leva as regras do ensaio a disparadas…"
- Comandos: `npx vitest run --project integracao apps/api/test/ops-jobs.int.test.ts`; `npx vitest run --project infra infra/test/alertas.int.test.ts`
- Armadilha: o alerta tem dois termos e o "terminada" vale para `pronto` e para `falhou`, cada termo com um caso que o derruba

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano. Na 1: cada tipo da
lista de recusa é um bloco, e o SQL da regra do alerta também.

## Fora do escopo desta tarefa

A vaga por escola e o `lockDuration` (1.0); a carga (9.0).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar
