# Tarefa 2.0 — A professora vê a semana dela (`GET /v1/semana`)

**Funcionalidade:** semana-do-professor · **Depende de:** 1.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `test-engineer`
**Porte:** grande

## Objetivo

`GET /v1/semana?segunda=` devolve as aulas da professora na escola do token e no ano em curso, com feriado e recesso fora,
os registros e o fora da grade passado; `itens` vazio até a 3.0.

## Contexto necessário

- `techspec.md` seções 4, 5 ("Ler"), 6, 7; `cenarios.md` "Leitura", R2, R3, R4, R7; `prd.md` RF1 a RF4, RF9, RF10, RF12
- `packages/core/src/importacao/grade.repository.ts` e `calendario.repository.ts`: consultas com escopo
- `apps/api/src/app.module.ts:64` (`relogioDaPrivacidade`): o jeito de injetar relógio para o S13

## Subtarefas

- [ ] 2.1 — `packages/shared/src/semana/`: contrato estrito das duas rotas (seção 4), `TAMANHO_MAXIMO_DO_TEXTO_DA_AULA = 500` e a tabela de rótulos dos tipos e estados dos itens
- [ ] 2.2 — `SemanaRepository`: as quatro primeiras consultas da seção 5, "Ler"
- [ ] 2.3 — A montagem dos dias, função pura no `apps/api/src/semana/`, no `FUSO_DO_USO`; sem ano em curso, `ano: null` e nenhum dia
- [ ] 2.4 — Controller, service, módulo e relógio injetável
- [ ] 2.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/shared/src/semana/semana.ts`, `packages/shared/src/semana/semana.test.ts` | novo |
| `packages/shared/src/index.ts` | alterado |
| `packages/core/src/semana/semana.repository.ts`, `packages/core/src/semana/index.ts` | novo |
| `packages/core/src/index.ts` | alterado |
| `apps/api/src/semana/semana.module.ts`, `apps/api/src/semana/semana.controller.ts`, `apps/api/src/semana/semana.service.ts`, `apps/api/src/semana/montar-dias.ts`, `apps/api/src/semana/montar-dias.test.ts` | novo |
| `apps/api/src/app.module.ts` | alterado |
| `apps/api/test/semana.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| S1 | integração | só `confirmado` gera aula | |
| S2 | integração | fim de semana; ordem | |
| S3 | integração | feriado tira, evento não | |
| S4 | integração | recesso por cruzamento | |
| evento que termina no domingo anterior, e o que começa na segunda seguinte, não entram | integração | as duas metades do cruzamento | |
| S5 | integração | só os dias do ano | |
| S6, parte do `GET` | integração | `ano: null` | |
| S7, parte do `GET`; registro do ano anterior inserido direto não volta | integração | filtro, não o `delete` | |
| vínculo confirmado no ano anterior, com alocação e registro, não gera aula | integração | o ano | |
| aula de colega confirmado da mesma turma não aparece | integração | o `usuarioId` | |
| S8 | integração | vínculo encerrado | |
| S11 | integração | duas disciplinas | |
| S12 | integração | turma sem professor | |
| S13 | integração | `hoje` e `agora` em Brasília | |
| S14, servidor | unidade | a montagem, com o fora da grade de hoje e futuro fora | |
| S15 | unidade | rótulos numa tabela só | |
| S16, parte do `GET` | integração | aula dupla | |
| `gradeImportada` false em A, B com grade | integração | escopo | |
| `calendarioImportado` false em A, B com calendário; as aulas de A aparecem | integração | escopo | |
| `ano` é o de A, B com outras datas | integração | escopo | |
| G7 e, pela rota, `segunda` que não é segunda e campo a mais: `ENTRADA_INVALIDA` | unidade e integração | contrato estrito | |
| chaves exatas da aula, sem e-mail, nome de professor nem `atualizadoEm` | integração | DTO | |
| R2, aulas e registros | integração | duas escolas | |
| R3 | integração | eventos da B | |
| R4, parte do `GET` | integração | substituto e antecessor | |
| R7, parte do `GET` | integração | coordenação e aluno recusados | |

O filtro de ano dos registros e o `papel = professor` não ficam vermelhos com dado nenhum: registre a redundância nas
Mutações, sem bloco verde.

## Como testar

- Leitura do professor com vínculos em estados: `apps/api/test/calendario.int.test.ts › professor sem vínculo confirmado (pendente, encerrado, só no ano planejado ou nenhum)…`
- Isolamento de repository: `apps/api/test/calendario.int.test.ts:152`
- Grade: `executarPlanilha`, como em `apps/api/test/grade.int.test.ts` (o R4 pela reimportação real)
- Relógio: como `relogio` em `apps/api/test/arquivo-do-titular.int.test.ts:71`
- Comando: `npx vitest run --project integracao apps/api/test/semana.int.test.ts`
- Armadilha (retro da F2, grupo E): todo id do caso de isolamento é da B

## Autoconferência

As 12 perguntas do modelo, no plano. Na 4: sem `requireAnoEmCurso()`.

## Fora do escopo desta tarefa

Itens (3.0), `PUT` (4.0), telas.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
