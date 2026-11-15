# Tarefa 4.0 — O pedido acima do teto de entrada da tarefa é recusado antes de qualquer envio

**Funcionalidade:** reengenharia-continuacao · **Depende de:** 3.0
**Subagentes obrigatórios:** `infra-guardian`, `conformidade-reviewer`, `llm-integrator`, `frontend-reviewer`
**Porte:** grande

## Objetivo

Toda tarefa declara `maximoDeTokensDeEntrada`, pelo pior pedido válido. O gateway recusa o pedido acima dele com
`PEDIDO_ACIMA_DO_TETO`, antes do orçamento e do envio, sem `consumo_ia`; a tela mostra "Tentar de novo", e o Tutor não conta
a troca. `PASSAGEIROS` vai da web para `packages/shared`.

## Contexto necessário

- `techspec.md` §2 (linha `packages/core/src/ia/`), §8 (inteiro)
- `prd.md` RF7 ("nunca com erro cru"), RF8; regras 30, 40, 50, 70, 80
- `revisao-spec.md` rodada 6, "Recomendações para as tarefas": o 503 do `PEDIDO_ACIMA_DO_TETO` só importa se um caminho
  síncrono o devolver; diga qual, ou registre que não há
- Código: `packages/core/src/ia/task.ts` (`esquemaDeEntrada` l.48, `maximoDeTokensDeSaida` l.52, `montarPedido` l.66);
  `packages/core/src/ia/tasks/*.ts`; `packages/core/src/ia/llm-gateway.ts`; `packages/core/src/ia/errors.ts`
  (`LLM_ERROR_CODES`); `packages/shared/src/errors/error-code.ts`; `packages/core/src/error/domain.exception.ts`
  (`HTTP_STATUS_BY_CODE`); `apps/web/src/api/ciclo-de-execucao.ts` (`PASSAGEIROS` l.109, `aparenciaDaFalha` l.130)

## Subtarefas

- [ ] 4.1 — `maximoDeTokensDeEntrada` obrigatório em `TaskDefinition`; o valor de cada tarefa sai do gerador do pior
  pedido (cada campo no limite do `esquemaDeEntrada`, montado pelo `montarPedido`, com o prompt)
- [ ] 4.2 — A recusa no `LLMGateway`, antes do orçamento e do `fetch`; log `ia.geracao.pedido_acima_do_teto` com tarefa e
  ids; métrica `ia.pedido_acima_do_teto{tarefa}`
- [ ] 4.3 — `PEDIDO_ACIMA_DO_TETO` em `LLM_ERROR_CODES`, no `ErrorCode` de `shared` e em `HTTP_STATUS_BY_CODE` (503);
  `PASSAGEIROS` em `packages/shared/src/tutor/` (ou `system/`), com o código novo; a web importa de lá.
  Busca: `grep -rn "PASSAGEIROS" apps/web/src e2e docs`
- [ ] 4.4 — Alerta `infra/grafana/alertas/ia-pedido-acima-do-teto.yaml` e o parágrafo do `docs/runbook.md`
- [ ] 4.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/ia/teto-de-entrada.ts`, `packages/core/src/ia/teto-de-entrada.test.ts`, `packages/shared/src/tutor/passageiros.ts`, `packages/shared/src/tutor/passageiros.test.ts`, `infra/grafana/alertas/ia-pedido-acima-do-teto.yaml`, `apps/api/src/ia/teto-de-entrada.int.test.ts` | novo |
| `packages/core/src/ia/task.ts`, `packages/core/src/ia/tasks/adaptar-atividade.ts`, `gerar-atividade-objetiva.ts`, `gerar-plano-de-aula.ts`, `propor-ferramenta.ts`, `relatorio-da-correcao.ts`, `resumo-do-analista.ts`, `turno-do-tutor.ts` (todos em `packages/core/src/ia/tasks/`), `packages/core/src/ia/llm-gateway.ts`, `packages/core/src/ia/llm-gateway.test.ts`, `packages/core/src/ia/errors.ts`, `packages/core/src/error/domain.exception.ts`, `packages/shared/src/errors/error-code.ts`, `packages/shared/src/errors/messages.ts`, `packages/shared/src/index.ts`, `apps/web/src/api/ciclo-de-execucao.ts`, `apps/web/src/api/ciclo-de-execucao.test.ts`, `infra/test/alertas.test.ts`, `docs/runbook.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| pior pedido cabe | U | por tarefa, o pior pedido válido cabe no teto. Mutação: um teto abaixo do pior pedido | |
| gerador, quem contorna | U | string sem `max`, array sem `max`, campo aninhado ou em união sem limite: falha, um caso por forma | |
| gerador, alvo some | U | sem `esquemaDeEntrada`, ou catálogo vazio: vermelho | |
| acima do teto | U | nenhum `fetch`, orçamento não consultado, sem `consumo_ia`, métrica +1 | |
| a tarefa sem teto não compila | U | `@ts-expect-error` | |
| o status | U | `HTTP_STATUS_BY_CODE.PEDIDO_ACIMA_DO_TETO === 503`; a tarefa diz o caminho síncrono que o devolve, ou registra que não há | |
| Tutor | I | o turno recusado acima do teto (teto rebaixado na definição injetada) não conta como troca | |
| a tela | U | `aparenciaDaFalha('PEDIDO_ACIMA_DO_TETO') === 'fila'` ("Tentar de novo"). Mutação: deixar o código fora de `PASSAGEIROS` | |
| `PASSAGEIROS` fixada | U | em `shared`, a lista inteira, com `IA_SAIDA_INVALIDA`, `IA_ENTRADA_INVALIDA` e `PEDIDO_ACIMA_DO_TETO`. Mutação: tirar um código | |
| métrica | U | só o rótulo `tarefa`; nenhum usuário nem escola | |
| log | U | a linha da recusa leva tarefa, ids e código; nunca entrada nem prompt (regra 20, item 9) | |
| alerta | U | `infra/test/alertas.test.ts` tem a regra nova; `alerta-tem-runbook.test.ts` acha o parágrafo. Mutação: trocar o limiar | |

## Como testar

- Gateway: `packages/core/src/ia/llm-gateway.test.ts` › "entrada com nome de aluno é recusada, o modelo não é chamado e o
  orçamento não é consultado" — a mesma forma, com o teto
- Status: › "cada código de IA é um código do contrato da API, com o status dele"
- Tela: `apps/web/src/api/ciclo-de-execucao.test.ts` › "o envio recusado guarda o código do catálogo, e nunca o erro cru"
- Tutor sem troca: `apps/api/src/ia/ia.int.test.ts` › "recusa a 61ª troca do aluno no dia… a pergunta que falhou não conta"
- Comandos: `npx vitest run --project unidade packages/core/src/ia/llm-gateway.test.ts`; `npx vitest run --project integracao apps/api/src/ia/teto-de-entrada.int.test.ts`
- Armadilha: o caso "acima do teto" precisa de um pedido que passe pelo `esquemaDeEntrada` e mesmo assim exceda o teto; rebaixe o teto na definição injetada, não estoure o esquema

## Autoconferência

As 12 perguntas do modelo, respondidas no plano. Na 6: o gerador do pior pedido é guarda, com uma fixture por forma de
campo sem limite. Na 4: a recusa vem antes do orçamento; confira que o caso não para numa checagem anterior (a do nome
de aluno).

## Fora do escopo desta tarefa

O limitador de tokens (10.0), que lê o teto como estimativa; a contagem no uso do Tutor (9.0).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar
