# Tarefa 12.0 — Reimportar a grade a substitui sem perder o id, e a grade se lê por turma

**Funcionalidade:** onboarding-por-convite · **Depende de:** 5.0, 11.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

Reimportar a grade substitui as aulas do ano mantendo o id da alocação por (vínculo, dia, início), que a `Aula` da F2b
vai apontar; o vínculo que perdeu as aulas aparece "sai da grade" e só encerra marcado. Coordenação e professor leem a
grade por turma em `GET /v1/grade`.

## Contexto necessário

- `techspec.md` §3 (o parágrafo da `alocacao`), §4 (`GET /v1/grade`: coordenador com `anoLetivoId?`; professor com
  vínculo confirmado, só com id e nome do colega), §5 "Gravar" ("encerra só o marcado"), §7 (DTO)
- `prd.md` RF9, RF16; regra 60 item 8
- `cenarios.md` RF9, "Virada de ano" (grade do planejado), "Isolamento e ano letivo"
- Código: o tipo grade da 11.0; o `GET /v1/calendario` da 5.0 (mesmo controller); `apps/api/test/contracts.test.ts`

## Subtarefas

- [ ] 12.1 — Reimportação: substitui no ano, mantendo o id por (vínculo, dia, início); "sai da grade" como candidato; encerra só o marcado, pelo `encerrar`
- [ ] 12.2 — `GET /v1/grade?turmaId=`: coordenador (com o filtro do planejado); professor com vínculo confirmado na turma, no ano em curso; DTO sem e-mail
- [ ] 12.3 — `docs/modelo-de-dados.md` conferido (o id estável que a `Aula` da F2b aponta)
- [ ] 12.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/importacao/tipos/grade.ts` | alterado |
| `apps/api/src/estrutura/grade/grade.controller.ts`, `grade.service.ts`, `packages/core/src/importacao/grade.repository.ts` | novo |
| `packages/shared/src/importacao/grade.ts` | alterado |
| `apps/api/test/grade.int.test.ts`, `apps/api/test/contracts.test.ts` | novo; alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| Reimportar mantém o id da alocação | integração | caminho feliz (RF9) | |
| Vínculo da grade sem aula: "sai da grade" | integração | RF9 | |
| "Sai da grade" encerra só com marca | integração | RF9 | |
| "Sai da grade" passa pelo `encerrar` e revoga o acesso | integração | RF5 | |
| Vínculo feito à mão sem aula fica, e não é candidato | integração | RF9 | |
| Grade e calendário do planejado não tocam o ano anterior | integração | ano | |
| Grade da B, para coordenador e para professor: igual a inexistente | integração | isolamento | |
| Professor só com vínculo pendente ou contestado: grade igual a inexistente | integração | permissão | |
| Vínculo encerrado em X e confirmado em Y: grade só de Y | integração | vínculo encerrado e aberto | |
| Sem ano em curso: a grade do coordenador aceita o filtro do planejado | integração | ano | |
| Sem ano em curso: a grade do professor segue o ano em curso | integração | ano | |
| `contracts.test.ts`: a grade do professor traz o colega só com id e nome | unidade | DTO | |
| Auditoria `vinculo.encerrado` da grade, com a origem | integração | RF17 | |

## Como testar

- Isolamento de leitura: `apps/api/test/estrutura-isolamento.int.test.ts › as listagens da coordenação de A trazem só o que é de A, com as linhas de B existindo`
- Revogação: `apps/api/test/acesso-fim-do-vinculo.int.test.ts › encerrar o último vínculo do professor na turma revoga o acesso que ele gerou, …`
- Comando: `npx vitest run --project integracao apps/api/test/grade.int.test.ts`

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3, o professor com vínculo confirmado numa turma e pendente em outra.

## Fora do escopo desta tarefa

A tela da grade (14.0); a `Aula` concreta (F2b).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
