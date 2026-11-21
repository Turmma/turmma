# Tarefa 5.0 — A Operação lê o uso de IA de cada escola, no dia, no mês e nos 12 meses anteriores

**Funcionalidade:** camada-ia · **Depende de:** 3.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`
**Porte:** grande

## Objetivo

`GET /v1/operacao/uso` traz, por escola, o grupo `ia` de hoje e do mês, com custo por aluno, porcentagem e o que a reserva
atendeu, e ordena por custo; `GET …/escolas/:id/uso-ia` devolve os 12 meses anteriores pelo retrato. Nenhum campo de pessoa.

## Contexto necessário

- `techspec.md` §4 (as duas primeiras linhas e o parágrafo de `situacao`), §6, §7c (`EXPLAIN` do `uso()` por custo e dos 12 meses)
- `prd.md` RF11, §4 (o operador não vê pessoa), §7 ("Escola sem aluno ativo", "Escola sem valor")
- `cenarios.md` §1 RF11 (as quatro primeiras), §2 ("Operação", "Meses, retrato", "Meses, consumo")
- `.claude/rules/` 10 (itens 8 e 9), 20 (item 4), 80
- Código: `apps/api/src/operacao/painel/painel.repository.ts` › `uso()` (o terceiro `@Unscoped` do I1),
  `packages/shared/src/operacao/painel.ts` (`ORDENS_DO_PAINEL`, o schema do uso), `apps/api/test/registered-routes.ts`

## Subtarefas

- [ ] 5.1 — `ORDENS_DO_PAINEL` ganha `custo`, ou o uso ganha schema próprio de ordem, sem dar `custo` à aba Escolas
- [ ] 5.2 — `uso()` monta a soma e os alunos com os trechos exportados do `OrcamentoDoMesRepository` (2.0); o "agora" entra como parâmetro
- [ ] 5.3 — `GET …/escolas/:id/uso-ia` em `runInContext` de `:id`, lendo o retrato; mês sem retrato `sem_retrato`
- [ ] 5.4 — Contrato estrito em `packages/shared` e em `apps/api/test/contracts.test.ts`; a rota em `ROTAS_DO_PAINEL`
- [ ] 5.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/operacao/painel/painel.repository.ts`, `apps/api/src/operacao/painel/painel.service.ts`, `apps/api/src/operacao/painel/painel.controller.ts` | alterado |
| `packages/shared/src/operacao/painel.ts`, `packages/shared/src/operacao/painel.test.ts` | alterado |
| `apps/api/test/painel-leitura.int.test.ts`, `apps/api/test/contracts.test.ts`, `apps/api/test/registered-routes.ts` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| contrato estrito, sem campo de pessoa | U, I | RF11 | |
| `ordem=custo`: a de maior custo do mês primeiro | I | a ordem | |
| `ordem=custo` em `/escolas`: `VALIDACAO` | U, I | custo só no uso | |
| `chamadasPeloProvedorDeReserva` conta linhas; `execucoes` conta execuções | I | as duas contagens | |
| sem ano em curso: `sem_aluno_ativo`, porcentagem nula, reais visíveis | I | sem divisão por zero | |
| sem valor nem na rede: `sem_orcamento`, `origemDoValor = nenhuma` | I | a precedência na leitura | |
| A e B da `cenarios.md` §2: A 20% e 100 alunos, B 111% e 900 | I | cada linha da sua escola | |
| a chamada de A às 23h30 do último dia conta no mês; vínculo do ano anterior não; aluno em duas turmas, uma vez | I | os trechos do repository | |
| relógio falso, não o `now()` do Postgres | I | o "agora" como parâmetro | |
| 12 meses, cada um do seu retrato; B com retrato num mês em que A não tem: A `sem_retrato`, 12 itens | I | escopo do retrato | |
| B com consumo nos mesmos meses: os de A só com o custo de A | I | escopo da soma | |
| retrato com zero aluno: `sem_aluno_ativo`; id inexistente: `NAO_ENCONTRADO` | I | regra 10.6 | |
| `EXPLAIN (ANALYZE, BUFFERS)` do `uso()` por custo e dos 12 meses, num ano da maior escola | I | o índice | |
| coordenação, professor e aluno em `…/uso-ia`: 404 com o corpo do inexistente | I | `ROTAS_DO_PAINEL` | |

## Como testar

- Uso por escola: `apps/api/test/painel-leitura.int.test.ts` › "duas escolas com uso diferente no dia e no mês; a de mais
  requisições no mês vem antes…" e › "a ordem por uso conta o mesmo período…"
- `EXPLAIN` com o `.toSQL()`: `apps/api/test/semana-itens.int.test.ts`
- Fixture: `apps/api/test/painel.fixture.ts`
- `npx vitest run --project integracao apps/api/test/painel-leitura.int.test.ts`
- Armadilha: o I1 de `architecture.test.ts` fixa três `@Unscoped` no `PainelRepository`; não abra um quarto

## Fora do escopo desta tarefa

A tela (8.0); o retrato é gravado pela medida (4.0).

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
