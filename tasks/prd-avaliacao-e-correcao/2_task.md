# Tarefa 2.0 — Pulso da API, indisponibilidade, `limiteDaTentativa` e o 503 das rotas de prova

**Funcionalidade:** avaliacao-e-correcao · **Depende de:** 1.0
**Subagentes obrigatórios:** `infra-guardian`, `tenancy-guardian`
**Porte:** grande

## Objetivo

A API registra a própria queda e o limite de cada tentativa passa a contá-la: o tempo volta a quem estava em prova, e
a instância que não consegue pulsar recusa as rotas de prova em vez de cobrar tempo que não houve.

## Contexto necessário

- `techspec.md` §5.4, §5.7, §7c (alerta do pulso), §11 (desvio da regra 10), §13
- `prd.md` RF6
- `cenarios.md` §1 RF6 (as linhas do pulso, da lacuna e do 503), §2 (alerta do pulso), §3 (g)
- `revisao-spec.md` rodada 4 (rotas de prova, só HTTP pulsa, uma consulta, alerta por instância)
- `.claude/rules/80`; `apps/api/src/main.ts` (o `listen`)

## Subtarefas

- [ ] 2.1 — `limiteDaTentativa` pura, em ponto fixo (§5.4)
- [ ] 2.2 — O pulso (§5.7): uma instrução, conexão própria, tique e relógio injetáveis, antes do `listen`, só no HTTP
- [ ] 2.3 — 503 nas rotas de prova de hoje (`prova`, PUT, envio); a 3.0 e a 8.0 a aplicam às novas
- [ ] 2.4 — Pulso e indisponibilidades lidos numa consulta
- [ ] 2.5 — Expurgo da indisponibilidade aos 13 meses (como `expurgar-acesso`); métrica, alerta, runbook, arquitetura
- [ ] 2.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/shared/src/atividade/limite-da-tentativa.ts` | novo |
| `packages/shared/src/atividade/limite-da-tentativa.test.ts` | novo |
| `packages/shared/src/index.ts` | alterado |
| `apps/api/src/atividade/pulso/pulso.repository.ts` | novo |
| `apps/api/src/atividade/pulso/pulso.service.ts` | novo |
| `apps/api/src/atividade/pulso/rotas-de-prova.guard.ts` | novo |
| `apps/api/src/atividade/pulso/pulso.int.test.ts` | novo |
| `apps/api/src/atividade/atividade.module.ts` | alterado |
| `apps/api/src/atividade/minha-atividade/minha-atividade.controller.ts` | alterado |
| `apps/api/src/main.ts` | alterado |
| `infra/grafana/alertas/pulso-da-api-parado.yaml` | novo |
| `docs/runbook.md` | alterado |
| `docs/arquitetura.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| Indisponibilidade de 5 min dentro e fora da prova | unidade | só a sobreposição conta | uma dentro, uma fora | |
| Duas indisponibilidades, a segunda dentro do limite já estendido | unidade | ponto fixo | a segunda fica fora numa passada só | |
| Lacuna aberta de 2 min e de 20 s | unidade | o limiar de 30 s | os dois lados | |
| Extensão de aluno e de turma | unidade | as duas somam; a de outro aluno não | dois alunos | |
| Lacuna de 40 s grava; 20 s não; tabela vazia não | integração | o limiar no banco | três estados | |
| Pulso parado 40 min, volta | integração | grava 40, igual à lacuna aberta | sem teto em nenhuma | |
| Falha forçada depois do `update` | integração | nada grava; aparece no próximo | commits separados ficam vermelhos | |
| `pg_terminate_backend` na conexão do pulso | integração | o tique seguinte reconecta, sem indisponibilidade | tique injetado | |
| Relógio injetado +31 s; +29 s | integração | 503 em `prova`, PUT e envio, só a partir de 30 s; `minhas-atividades` segue; o tique volta e aceitam | os dois lados | |
| Primeiro pulso antes do `listen` | integração | sem tráfego antes | primeiro pulso segurado (`WriteBlockTrigger` em `pulso_da_api`): a porta só aceita depois de soltar | |
| Corrida (g) pulso × pulso | integração | uma lacuna só | a primeira segurada no insert da indisponibilidade; partida com 40 s | |
| Expurgo da indisponibilidade | integração | sai aos 13 meses; a de 12 fica | os dois lados da fronteira | |
| Regra do alerta | unidade | dispara com pulso de 2 min, por instância | a outra instância pulsando | |

## Como testar

- Sem precedente de pulso. Relógio injetado: `apps/worker/test/varrer-envios.int.test.ts › com 59 min a linha e o objeto
  ficam, com 61 min saem: a linha e a varredura leem o mesmo Clock`
- Corrida: `WriteBlockTrigger` e `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`)
- Alerta: siga o formato de `infra/grafana/alertas/ia-provedor-de-reserva.yaml`
- `npx vitest run --project integracao apps/api/src/atividade/pulso/pulso.int.test.ts`; unidade com
  `npx vitest run packages/shared/src/atividade/limite-da-tentativa.test.ts`
- Armadilha: o teste não dorme; o tique e o relógio da recusa são injetados

## Autoconferência

As perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`). A 4: a instância de teste pulsa no `beforeAll`,
para o 503 não responder antes da regra.

## Fora do escopo desta tarefa

As rotas novas do aluno (3.0); a rotina (6.0); o Tutor (7.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
