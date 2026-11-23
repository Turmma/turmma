# Tarefa 6.0 — A rotina encerra a prova vencida no fim efetivo, e não durante uma queda

**Funcionalidade:** avaliacao-e-correcao · **Depende de:** 3.0, 5.0
**Subagentes obrigatórios:** `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian`
**Porte:** grande

## Objetivo

A prova vencida encerra sozinha, no minuto, dentro do horário letivo, e o lote nasce pendente; com o pulso velho nada
encerra. A carga da manhã de segunda prova isso em escala.

## Contexto necessário

- `techspec.md` §5.5, §5.6, §7b (AIA), §7c (alertas, carga), §13
- `prd.md` RF5, RF6; §7 (função suspensa)
- `cenarios.md` §2 (a rotina, as auditorias), §3 (c), (e), (f), (j), (l), §5 (carga)
- `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts` (`encerrar`, `exigirAtiva`)
- `apps/worker/src/processors/agendar-classificacao.ts`: a rotina `sistema.*` que grava um job por escola

## Subtarefas

- [ ] 6.1 — `sistema.encerrar-provas-vencidas` (por minuto, fila `lote`, `naoUrgente: false`, chave do minuto): não
  roda com pulso de mais de 30 s; lista, `@Unscoped` com justificativa, as do ano em curso pelo índice parcial
- [ ] 6.2 — `atividade.encerrar-vencidas` por escola (`naoUrgente: false`): contexto da escola do payload; por
  aplicação, `for update`, o pulso, o fim efetivo e `encerrarPeloLimite` (sem o alcance do professor, com a suspensão)
- [ ] 6.3 — `enviada_em = limite`, `envio = 'limite'`; auditoria `atividade.encerrada_pelo_limite` sem aluno; sino
- [ ] 6.4 — Alertas (prova aberta 5 min além do fim **efetivo**; p95 do PUT) e runbook
- [ ] 6.5 — `docs/aia/correcao-de-objetiva.md`, etapa 1: 1.4/1 (o gatilho) e 1.4/9 (a contagem só no lote)
- [ ] 6.6 — `infra/k6/prova-online.js` e a corrida registrada
- [ ] 6.7 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/shared/src/system/job-definitions.ts` | alterado |
| `apps/worker/src/job-schedules.ts` | alterado |
| `apps/worker/src/processors/encerrar-provas-vencidas.ts` | novo |
| `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts` | alterado |
| `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts` | alterado |
| `apps/worker/test/encerrar-provas.int.test.ts` | novo |
| `infra/grafana/alertas/prova-vencida-aberta.yaml` | novo |
| `infra/grafana/alertas/prova-put-p95.yaml` | novo |
| `infra/k6/prova-online.js` | novo |
| `docs/runbook.md` | alterado |
| `docs/aia/correcao-de-objetiva.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| Vencidas em A e em B, só o job de A | integração | a de B segue aberta, sem lote nem auditoria | as duas vencidas | |
| Aluno estendido além do `fecha_em` | integração | não encerra até o limite dele | a extensão é de um aluno | |
| Indisponibilidade dentro da janela | integração | não encerra no `fecha_em` | | |
| Pulso parado 1 min | integração | a rotina não lista; o pulso volta: encerra | | |
| Job gravado antes da queda, rodado com o pulso velho | integração | não encerra | a conferência na transação | |
| Dentro do horário letivo | integração | encerra no minuto | `naoUrgente: true` fica vermelho pelo despachante | |
| Ano encerrado | integração | não lista; o alerta não conta | | |
| Função suspensa em A | integração | encerra sem lote nem correção, e não volta a listar | B corrige | |
| Vencida sem envio | integração | entra na correção com o salvo | | |
| Auditoria por aplicação, sem aluno | integração | uma por aplicação | gravar por tentativa fica vermelho | |
| (c) resposta × job; (e) job × professor; (f) job × job e o cron duplicado; (j) estender × rotina; (l) pulso × rotina | integração | as ordens forçadas da `cenarios.md` §3 | uma linha por corrida | |
| Carga [C] | carga | p95 do PUT < 500 ms; enviadas = gravadas; a queda de 90 s anda o limite e não encerra; o controle negativo reprova | o comando, a data e os números na coluna "Caso" | |

## Como testar

- Rotina por escola: `apps/worker/test/classificacao-agendada.int.test.ts › grava um material.agendar-classificacao por
  escola, na fila de lote…` e `› [P] duas rotinas ao mesmo tempo…`
- Suspensão: `apps/api/src/atividade/atividade.int.test.ts › com a função de correção suspensa, a atividade encerra…`
- Encerrar ao mesmo tempo: `› quatro cliques no primeiro encerramento, ao mesmo tempo…`
- Janela letiva: `packages/shared/src/system/job-definitions.test.ts` e `apps/despachante/test/janela.int.test.ts`
- Carga: siga `infra/k6/reivindicacao-em-sala.js`; `docs/runbook.md`, "Quando a carga vale como registro"
- `npx vitest run --project integracao apps/worker/test/encerrar-provas.int.test.ts`

## Autoconferência

As perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`). A 7 vale para a AIA e o runbook.

## Fora do escopo desta tarefa

A segunda chamada (9.0) encerra pelo mesmo caminho, sem mudança aqui.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
