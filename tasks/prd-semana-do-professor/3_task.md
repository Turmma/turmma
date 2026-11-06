# Tarefa 3.0 — Os itens do dia entram na semana (RF7)

**Funcionalidade:** semana-do-professor · **Depende de:** 2.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `test-engineer`
**Porte:** grande

## Objetivo

Cada dia do `GET /v1/semana` traz, para cada (turma, disciplina) dos vínculos confirmados da professora, a atividade
aplicada, a encerrada e a correção do Assistente com o estado de hoje, sem nota, acerto nem nome de aluno.

## Contexto necessário

- `techspec.md` seção 5 ("Ler", passo 5), 7, 7b e 7c (o `EXPLAIN`); `cenarios.md` S9, S10, R2 e a linha do `EXPLAIN`
- `prd.md` RF7 e o caso de borda "Feriado no dia da prova"
- `.claude/rules/70`, itens 7 a 9
- `packages/core/src/db/schema/atividade-aplicada.ts:63` (`atividade_aplicada_turma_idx`) e `entrega.ts:89` (`entrega_turma_idx`)
- O contrato `itens[]` e os rótulos já estão em `packages/shared/src/semana/` (2.0): esta tarefa não toca `packages/shared`

## Subtarefas

- [ ] 3.1 — A consulta dos itens no `SemanaRepository`: `atividade_aplicada` cujo `artefato` tem (turma, disciplina) de um vínculo, aplicada ou encerrada na semana, e a `entrega` `lote_de_correcao` dela criada na semana, com o estado de hoje; escopo do contexto
- [ ] 3.2 — A montagem põe cada item no dia, no `FUSO_DO_USO`, mesmo em feriado
- [ ] 3.3 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/semana/semana.repository.ts` | alterado |
| `apps/api/src/semana/semana.service.ts`, `apps/api/src/semana/montar-dias.ts`, `apps/api/src/semana/montar-dias.test.ts` | alterado |
| `apps/api/test/semana-itens.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| S9: aplicada na quarta aparece na quarta da turma e disciplina | integração | RF7 | |
| S9: a do colega de outra disciplina na mesma turma não aparece | integração | disciplina | |
| S9: a correção nos três estados | integração | estado | |
| S9: o item não traz nota, acerto, nome de aluno nem autor (chaves exatas) | integração | DTO | |
| S10: feriado no dia da prova, a aula sai e o item fica | integração | borda | |
| aplicada no domingo às 22h de Brasília fica no domingo | integração | fuso | |
| aplicada fora da semana não aparece | integração | período | |
| `lote_de_correcao` criado fora da semana não aparece | integração | período | |
| entrega de outro tipo na mesma turma não aparece | integração | tipo | |
| aplicada numa semana e encerrada noutra: um item em cada | integração | os dois tipos | |
| correção aprovada depois da semana mostra `aprovada` | integração | estado de hoje | |
| turma e disciplina de vínculo `pendente` não trazem itens | integração | só confirmado | |
| `estado` só no tipo `correcao` | unidade | contrato | |
| `titulo` e rótulos sem palavra de `VOCABULARIO_DE_NOTA` | integração | regra 70 | |
| R2, itens: professora nas duas escolas, atividade aplicada em B, nada com o token de A | integração | isolamento | |
| `EXPLAIN` usa `atividade_aplicada_turma_idx` e `entrega_turma_idx` | integração | regra 80, item 8 | |

## Como testar

- Atividade aplicada, encerrada e lote: `apps/api/test/atividade.fixture.ts` (`criarAtividade`, `aplicarAtividade`, `encerrarAtividade`, `aprovarOLote`)
- `EXPLAIN`: o padrão de `apps/api/test/arquivo-do-titular.int.test.ts:1373` (`explain (format json)`), procurando o nome do índice no plano
- Isolamento: todo id da B, lido no contexto da A (retro da F2, grupo E)
- Relógio às 22h: o mesmo relógio injetável da 2.0
- `VOCABULARIO_DE_NOTA` está em `e2e/support/professor/scenario.ts:17`: copie a expressão no teste de integração, sem importar do e2e
- Comando: `npx vitest run --project integracao apps/api/test/semana-itens.int.test.ts`

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3: a mesma turma com duas disciplinas, e a professora com vínculo pendente noutra.

## Fora do escopo desta tarefa

A tela dos itens (8.0); o `PUT` (4.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
