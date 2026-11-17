# Tarefa 5.0 — A classificação é agendada na extração e às 19h, com o teto de três noites e o alerta

**Funcionalidade:** classificacao-bncc · **Depende de:** 4.0
**Subagentes obrigatórios:** `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian`
**Porte:** grande

## Objetivo

A extração cria as execuções das seções novas; às 19h, por escola, a rotina agenda a seção sem classificação ou cuja
última falhou (menos de três vezes seguidas); o alerta `classificacao-atrasada` avisa na abertura da janela; e 300
apostilas cabem numa noite.

## Contexto necessário

- `techspec.md` §5 "Seções", "Agendar" (a), "Degradação do lote"; §7c
- `prd.md` RF5, RF15
- `cenarios.md` "Seções e agendamento" (até o laço), "Alerta e métrica", "Carga", P9
- `revisao-spec.md`, rodada 6 (o runbook)
- `.claude/rules/`: 10, 70, 80
- Código: `apps/worker/src/job-schedules.ts`, `packages/core/src/cron/cron-escolas.repository.ts`,
  `infra/grafana/alertas/pdf-parado.yaml`, `infra/scripts/carga-ingestao.ts`

## Subtarefas

- [ ] 5.1 — As execuções e os jobs na extração (§5 "Seções"); a seção herdada não ganha execução
- [ ] 5.2 — O job `material.agendar-classificacao` e a rotina das 19h em `JOB_SCHEDULES` (§5 "Agendar" (a)), com P9
- [ ] 5.3 — A seção com falha numa execução só dela; o laço em lotes de 500 (§7c "Laços")
- [ ] 5.4 — O alerta `classificacao-atrasada` e o runbook (a rodada 6 da `revisao-spec.md`)
- [ ] 5.5 — A carga das 300 apostilas, rodada (`cenarios.md` "Carga")
- [ ] 5.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/shared/src/system/job-definitions.ts`, `packages/shared/src/system/job-definitions.test.ts`, `apps/worker/src/job-schedules.ts`, `apps/worker/test/uso.int.test.ts`, `apps/worker/src/processors/extrair-pdf.ts`, `apps/worker/test/extrair-pdf.int.test.ts`, `apps/worker/src/app.module.ts`, `docs/runbook.md`, `package.json` | alterado |
| `apps/api/src/material/agendar-classificacao.ts`, `apps/api/src/material/agendamento.int.test.ts`, `apps/api/src/material/secoes.repository.ts`, `infra/grafana/alertas/classificacao-atrasada.yaml`, `infra/test/alerta-de-classificacao-atrasada.int.test.ts`, `infra/scripts/carga-classificacao.ts`, `infra/test/carga-classificacao.test.ts` | novo e alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| 25 seções | I | 3 execuções (12, 12, 1), cada seção com o seu `execucao_id` | |
| execução e job | I | sem ano nem `solicitada_por`; `naoUrgente`. Mutação: `false` | |
| sem componente; função suspensa | I | seções, nenhuma execução | |
| dois jobs da extração em `Promise.all` | P | execuções uma vez | |
| seção herdada | I | sem execução; as outras ganham | |
| rotina: `nao_agendada`; `nao_classificada` com menos de 3 | I | agenda | |
| rotina: corrigida sem execução | I | não agenda. Mutação: tirar o filtro de `corrigida_em` | |
| rotina: `aguardando`; `classificada`; `sem_habilidade`; material não `pronto`; sem componente | I | não toca, um caso cada. Mutação: aceitar `concluida` | |
| rotina da A | I | não toca a da B. Mutação: tirar `escola_id` | |
| rotina com a função suspensa | I | nada | |
| quarta noite | I | sem modelo. Mutação: tirar o `< 3` | |
| retomada; depois de `EXECUCAO_INTERROMPIDA` | I | volta na noite seguinte | |
| noite seguinte à falha de 12 | I | 12 execuções de uma; as 11 zeram, a que falha chega a 3. Mutação: agrupar com `falhas_seguidas > 0` | |
| seção nova na mesma noite | I | separada das com falha | |
| laço com mais de 500; com o sinal | I | um lote por transação; para entre lotes. Mutação: um lote só | |
| P9, rotina × rotina | P | uma execução. Mutação: tirar `is not distinct from` | |
| agenda | I | 19h de São Paulo, sem duplicar o agendador | |
| alerta: `falhou` na noite; `pendente` de antes; janela da escola diferente | I | dispara, um caso cada | |
| alerta: `pendente` da própria noite; sem elas; outra escola | I | não dispara, um caso cada | |
| alerta tem runbook | U | `alerta-tem-runbook.test.ts` | |
| log da rotina | U | sem título, texto nem código | |
| carga: 300 materiais | C | nenhuma seção sem classificação na abertura | |
| carga: provedor fora 10 min; Tutor da B | C | adiam e retomam; medido, com vagas e réplicas | |

## Como testar

- Rotina por escola: `apps/worker/test/expurgo-da-escola.int.test.ts` › "[P] duas rotinas ao mesmo tempo criam um job por escola"; agenda: `apps/worker/test/uso.int.test.ts`
- Alerta: `infra/test/alerta-do-pdf-parado.int.test.ts` › "o worker-pdf parado e o job pendente há 16 min…"; runbook como "## Extração de PDF parada"
- Carga: `infra/scripts/carga-ingestao.ts` e `infra/test/carga-ingestao.test.ts` › "a projeção é a vazão medida vezes as 300…"
- `npx vitest run --project integracao apps/api/src/material/agendamento.int.test.ts`
- Armadilha: semeie mais seções que o lote, e uma de outra escola (autoconferência 4)

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3: cada estado da seção ao lado do que a rotina pega.

## Fora do escopo desta tarefa

O recorte (6.0); reclassificar e D76 (7.0).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar

