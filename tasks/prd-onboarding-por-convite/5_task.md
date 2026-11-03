# Tarefa 5.0 — A importação tem limites, expira parada, e o calendário se lê

**Funcionalidade:** onboarding-por-convite · **Depende de:** 4.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

A prévia e o gravar respeitam os limites por usuário e por escola; a importação parada fecha sozinha e a final sai em 90
dias; a coordenação acompanha a importação por `GET /v1/importacoes/:id`; e coordenação e professor leem o calendário.

## Contexto necessário

- `techspec.md` §3 (`importacao_planilha`, os índices), §4 (`GET /v1/importacoes/:id`, `GET /v1/calendario`, o filtro
  `anoLetivoId`), §5 (a tabela de estados e o parágrafo dos expurgos), §6 (o alvo novo do `sistema.expurgar-acesso`), §7c
- `prd.md` RF10, RF15, RF16
- `cenarios.md` "Job e estados" (expurgos), "Isolamento e ano letivo", tabela "Limites"
- Regra 80 itens 1, 3 e 10; regra 20 item 16; regra 10 item 9
- Código: `packages/core/src/retencao/expurgo-da-escola.repository.ts`, `expurgo-de-acesso.repository.ts`;
  `apps/worker/src/processors/expurgar-escola.ts`, `expurgar-acesso.ts`; `packages/core/src/rate-limit/`;
  `docs/runbook.md`

## Subtarefas

- [ ] 5.1 — Limites: prévia e gravar, 20/min por usuário no mesmo balde; duas prévias simultâneas por escola, no Redis, com o gravar ocupando vaga e prazo de validade; 512 KB e 3.000 linhas só nessas rotas
- [ ] 5.2 — `retencao.expurgar-escola` fecha `falhou` a `na_fila` de mais de 1 h; `sistema.expurgar-acesso` tira a importação final de 90 dias (`@Unscoped` com a justificativa); os dois com `skip locked`
- [ ] 5.3 — `GET /v1/importacoes/:id` (coordenador, da escola, mesmo sem ano em curso)
- [ ] 5.4 — `GET /v1/calendario`: coordenador, com o filtro do planejado; professor com vínculo confirmado, no ano em curso
- [ ] 5.5 — Alertas (`falhou` acima de 20% em 1 h; `na_fila` há 30 min; passo (3) acima de 1 s), com o parágrafo do `docs/runbook.md`
- [ ] 5.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/retencao/expurgo-da-escola.repository.ts`, `expurgo-de-acesso.repository.ts` | alterado |
| `apps/api/src/estrutura/importacao/importacao.controller.ts`, `importacao.service.ts` | alterado |
| `apps/api/src/estrutura/grade/calendario.controller.ts`, `calendario.service.ts`, `packages/core/src/importacao/calendario.repository.ts` | novo |
| `apps/api/src/rate-limit.module.ts` | alterado |
| `infra/grafana/` (alertas), `docs/runbook.md` | alterado |
| `apps/worker/test/expurgo-da-escola.int.test.ts`, `apps/worker/test/expurgo-de-acesso.int.test.ts`, `apps/api/test/calendario.int.test.ts` | alterado; novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| Relógio falso: com 59 min o expurgo mantém a `na_fila`; com 61 min fecha `falhou`, `linhas` e `marcas` nulas | integração | expurgo de 1 h | |
| [P] Expurgo com o job segurando a linha: pula, sem esperar | [P] | `skip locked` | |
| A importação final sai em 90 dias; com 89, fica | integração | `sistema.expurgar-acesso` | |
| `GET /v1/importacoes/:id` da B: igual a inexistente | integração | isolamento | |
| Sem ano em curso, `GET /v1/importacoes/:id` responde, só com as da escola | integração | ano | |
| `GET /v1/calendario` da B fica invisível ao coordenador e ao professor | integração | isolamento | |
| O calendário do coordenador aceita o filtro do planejado | integração | ano | |
| Professor só com vínculo encerrado ou pendente: calendário igual a inexistente | integração | vínculo encerrado e aberto | |
| Prévia e gravar acima de 20/min, no mesmo balde: 429 | integração | Limites | |
| [P] Terceira prévia simultânea na escola: recusada, e a outra escola segue | [P] | Limites | |
| O gravar ocupa vaga de prévia | integração | Limites | |
| A vaga volta quando o processo morre (prazo de validade) | integração | Limites | |
| 512 KB ou 3.000 linhas: `ENTRADA_INVALIDA` só nessas rotas; 3.000 entram | integração | Limites | |
| O alerta novo tem parágrafo no runbook | unidade | regra 80, item 10 | |

## Como testar

- Expurgo com relógio: `apps/worker/test/expurgo-de-acesso.int.test.ts › borda: nos limites de cada prazo, contados do relógio injetado, o vencido de todas as escolas (e sem escola) sai, e o que está no prazo fica`; por escola: `apps/worker/test/expurgo-da-escola.int.test.ts › encurtar o prazo em A tira a linha de A e mantém a de B, …`
- Limite por escola: `apps/api/test/rate-limit.int.test.ts › isolamento: limite de escola esgotado na escola A não gera 429 para a escola B`
- Teto: `apps/api/test/lista.int.test.ts › 201 linhas ou 64 KB + 1 byte na prévia e na gravação: ENTRADA_INVALIDA, …`
- Alerta: `tools/guardas/alerta-tem-runbook.test.ts`
- Comandos: `npx vitest run --project integracao apps/worker/test/expurgo-da-escola.int.test.ts apps/api/test/calendario.int.test.ts`

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3, o expurgo precisa de uma `na_fila` em cada escola e de uma `concluida` com a mesma idade.

## Fora do escopo desta tarefa

A tela do calendário (14.0); a grade (11.0 e 12.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
