# Tarefa 5.0 — O texto acompanha a reimportação da grade e do calendário

**Funcionalidade:** semana-do-professor · **Depende de:** 4.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `test-engineer`
**Porte:** grande

## Objetivo

Reimportar a grade mantém o texto da aula que continua, leva o texto da que só mudou de horário, apaga o futuro da que saiu
e deixa o passado fora da grade; reimportar o calendário não apaga texto.

## Contexto necessário

- `techspec.md` seção 5 ("Reimportar"), 6 e 7c (a ordem global, corridas 2 e 3); `cenarios.md` "Reimportação da grade" (J1 a J16)
- `prd.md` RF13, RF14
- `packages/core/src/importacao/tipos/grade.ts:512-514`: o passo entra entre `gravarAulas` e `encerrarOsMarcados`
- `packages/core/src/importacao/importacao.repository.ts:236`: o `lock_timeout` de 1 s e o `statement_timeout` de 1,5 s do passo (3)
- `packages/core/src/importacao/motor.ts:41`: o motor repete em `40P01`, `55P03` e `40001`
- `packages/core/src/semana/aula.repository.ts` (4.0): a classe da trava; importe pelo caminho, sem mexer no barril

## Subtarefas

- [ ] 5.1 — No passo: a escola do `requireEscolaId()` do job e o ano de destino; a trava consultiva dos vínculos que já existiam e têm aula que sai ou entra, num comando só, na ordem de `hashtext(escolaId‖vinculoId)`; só então a leitura da `aula`
- [ ] 5.2 — O pareamento por (vínculo, dia) na ordem de início; o par re-chaveia início e fim em todas as datas, menos onde um fora da grade já ocupa o início novo; a que sai sem par apaga os registros de data ≥ hoje (Brasília)
- [ ] 5.3 — Prévia, resumo, assinatura e auditoria do F2 sem mudança
- [ ] 5.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/importacao/tipos/grade.ts` | alterado |
| `packages/core/src/semana/texto-acompanha-a-grade.ts` | novo |
| `apps/api/test/semana-reimportacao.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| J1 | integração | a que continua mantém | |
| J2, com o `fim` novo nos re-chaveados | integração | só o horário mudou | |
| J3 | integração | a que sai sem par | |
| J4 | integração | colisão sem apagar passado | |
| J5 | integração | aula dupla | |
| saem duas, entra uma: a primeira re-chaveia, a segunda sai sem par | integração | pareamento desigual | |
| aula que muda de dia: o futuro da terça sai, nada vai à quarta | integração | só (vínculo, dia) | |
| J6 | integração | escola B intacta | |
| J7 | integração | a mesma grade duas vezes | |
| o mesmo job entregue duas vezes (D49) | integração | idempotência | |
| falha injetada em `encerrarOsMarcados`: grade e registros voltam juntos | integração | uma transação | |
| J8 | integração | "hoje" de Brasília | |
| J9 | integração | sem menção ao registro | |
| J10 | integração | RF13 | |
| J11a | integração | job primeiro | |
| J11b | integração | gravação primeiro | |
| J12 | integração | fora da grade × re-chaveamento | |
| J15 | integração | ano planejado | |
| J16 | integração | sem deadlock com o "sai da grade" | |
| vínculo novo da reimportação não toma trava nem lê a `aula` | integração | o conjunto travado | |

Linha de log nova, se houver: só ids, sem texto e sem contagem de registros.

## Como testar

- Pausa no job e o outro lado por SQL: `apps/api/test/importacao-alunos.int.test.ts:455-470` (`WriteBlockTrigger`, `esperarNaTrava`, a janela de 1 s)
- Reimportação real e "sai da grade": `apps/api/test/grade.int.test.ts › o marcado encerra por \`realocacao\`, e só ele…`
- Mudança entre o gravar e o job: `apps/api/test/grade.int.test.ts:402`
- Comando: `npx vitest run --project integracao apps/api/test/semana-reimportacao.int.test.ts`
- Armadilhas (retro da F2, grupo C): cada direção é um caso; o `esperarNaTrava` casa a classe própria da trava e `wait_event = 'advisory'` (a do convite também é consultiva); com o job parado dentro do passo, o outro lado vai por SQL, sem `await` lento antes do commit

## Autoconferência

As 12 perguntas do modelo, no plano. Na 10: J11a, J11b, J12 e J16 com a ordem forçada, um caso por direção.

## Fora do escopo desta tarefa

O `PUT` (4.0); as telas.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
