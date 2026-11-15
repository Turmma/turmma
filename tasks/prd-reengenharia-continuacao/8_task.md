# Tarefa 8.0 — Texto de aluno não sai do Brasil: a subida e o gateway conferem a D62 (50.0)

**Funcionalidade:** reengenharia-continuacao · **Depende de:** 7.0
**Subagentes obrigatórios:** `privacy-guardian`, `infra-guardian`, `conformidade-reviewer`, `llm-integrator`
**Porte:** grande

## Objetivo

Toda tarefa de IA declara `levaTextoDeAluno` e `categoriasEnviadas`. Com provedor externo, a API e o `main-worker` não
ficam prontos sem um suboperador vigente da `IA_PROVEDOR_ID` com `pais = 'BR'`, `veda_treinamento`, `alcance = 'todas'` e
todas as categorias das tarefas registradas; o adaptador falso e o local sobem sem ele. A cada chamada, o `LLMGateway`
recusa a tarefa com texto de aluno sem declaração conferida, antes do orçamento e do envio.

## Contexto necessário

- `techspec.md` §5 "A D62", §7b
- `prd.md` RF9, RF10; §8b
- `docs/decisoes.md` D62; `tasks/prd-reengenharia/onda-3c.md` "RF20 — a D62 na subida (50.0)"
- `.claude/rules/` 20 (itens 12, 13), 30 (itens 1, 9), 40, 70, 80
- Código: `packages/core/src/ia/task.ts`, `packages/core/src/ia/tasks/`, `packages/core/src/ia/tasks/tarefas.test.ts`;
  `packages/core/src/ia/llm-gateway.ts`; `packages/core/src/db/schema/suboperador.ts` (o docblock diz os campos);
  `packages/core/src/titular/suboperador-da-escola.repository.ts`; `packages/core/src/config/llm-config.ts`
  (`IA_PROVEDOR_ID`); `apps/api/src/system/readiness.controller.ts`; `apps/api/src/main-worker.ts` (5.0)

## Subtarefas

- [ ] 8.1 — `levaTextoDeAluno` e `categoriasEnviadas` obrigatórios em `TaskDefinition`; o `DECLARADO` de `tarefas.test.ts`
  fixa os dois de toda tarefa; `levaTextoDeAluno: true` exige `conversa_do_aluno`
- [ ] 8.2 — A conferência do suboperador vigente na subida da API e do `main-worker` (leitura `@Unscoped`, com motivo): com
  o banco fora, a prontidão fica vermelha e o worker não consome fila
- [ ] 8.3 — No `LLMGateway`, antes do orçamento e do `fetch`: `IA_INDISPONIVEL` e o log `ia.geracao.soberania_recusada`
- [ ] 8.4 — `docs/runbook.md`: encerrar o suboperador pede reiniciar API e `worker-ia`; `docs/aia/tutor.md`: o turno recusado
  pela D62 como limitação, só com a regra da D36
- [ ] 8.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/ia/soberania.ts`, `packages/core/src/ia/soberania.test.ts`, `apps/api/src/ia/soberania-na-subida.int.test.ts` | novo |
| `packages/core/src/ia/task.ts`, `packages/core/src/ia/tasks/`, `packages/core/src/ia/llm-gateway.ts`, `packages/core/src/ia/llm-gateway.test.ts`, `packages/core/src/titular/suboperador-da-escola.repository.ts`, `packages/core/src/index.ts`, `apps/api/src/main.ts`, `apps/api/src/main-worker.ts`, `apps/api/src/ia/ia.module.ts`, `apps/api/src/system/readiness.controller.ts`, `docs/runbook.md`, `docs/aia/tutor.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| sobe, externo | I | suboperador vigente `BR`, `veda_treinamento`, `alcance = 'todas'` e a união das categorias: pronto | |
| recusa por campo | I | um caso por `pais`, `veda_treinamento`, `alcance`, vigência (`fim` preenchido) | |
| recusa por categoria | I | um caso por categoria faltando. Mutação: conferir só `conversa_do_aluno` | |
| outro provedor | I | o suboperador vigente é de outra `IA_PROVEDOR_ID`: recusa | |
| banco fora | I | a API não fica pronta; o `main-worker` não consome fila | |
| falso e local | I | sobem sem suboperador | |
| `DECLARADO` | U | fixa `levaTextoDeAluno` e `categoriasEnviadas` de toda tarefa. Mutação: tirar uma categoria | |
| `DECLARADO`, alvo some | U | tarefa registrada sem linha no `DECLARADO`: vermelho; tarefa definida fora do catálogo é acusada | |
| texto de aluno exige a categoria | U | `levaTextoDeAluno: true` sem `conversa_do_aluno`: vermelho | |
| a tarefa sem a declaração | U | não compila (`@ts-expect-error`) | |
| gateway recusa | U | marca ligada e declaração não conferida: nenhum `fetch`, orçamento não consultado, `IA_INDISPONIVEL`. Mutação: conferir depois do orçamento | |
| gateway, falso | U | marca ligada e adaptador falso: a chamada sai | |
| log | U | `soberania_recusada` leva tarefa, ids e o provedor; nunca entrada, nome nem prompt | |
| AIA e runbook | — | os parágrafos existem e dizem o que o código faz | |

## Como testar

- Gateway: `packages/core/src/ia/llm-gateway.test.ts` › "função suspensa na escola A recusa com erro próprio, sem chamar o
  adaptador, sem consultar orçamento e sem registrar consumo" — a mesma forma
- Subida: `packages/core/src/ia/llm-gateway.test.ts` › "criarProvedorDeIa: sem nada configurado, a porta é a do adaptador
  falso"; prontidão com o banco fora: `apps/despachante/test/redis-ready.int.test.ts` como forma
- `DECLARADO`: `packages/core/src/ia/tasks/tarefas.test.ts` › "o catálogo do núcleo tem exatamente as tarefas do contrato…"
- Comando: `npx vitest run --project integracao apps/api/src/ia/soberania-na-subida.int.test.ts`
- Armadilha (F4, aviso 3): o "banco fora" para o banco de fato no teste, e o dublê lança o erro que o driver lança

## Autoconferência

As 12 perguntas do modelo, no plano. Na 1: cada campo da conferência do suboperador é um bloco. Na 6: o `DECLARADO` é
guarda, com os dois lados.

## Fora do escopo desta tarefa

O provedor de reserva e o roteamento para ele (F5); a contagem no uso (9.0).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar
