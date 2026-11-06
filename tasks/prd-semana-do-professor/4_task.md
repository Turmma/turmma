# Tarefa 4.0 — A professora grava o que vai dar (`PUT /v1/aulas`)

**Funcionalidade:** semana-do-professor · **Depende de:** 2.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `test-engineer`
**Porte:** grande

## Objetivo

`PUT /v1/aulas` grava, corrige e apaga o texto da aula dela, travando o ano e depois o vínculo; o que não é dela responde
como o inexistente.

## Contexto necessário

- `techspec.md` seções 4, 5 ("Gravar"), 6, 7 e 7c (a ordem global e as corridas 1 e 4); `cenarios.md` "Gravação", R1, R1b, R4, R7, S6, S16, J13, J14
- `prd.md` RF5, RF10, RF11, RF15
- `packages/core/src/estrutura/turma.repository.ts` (`travarAnoEmCurso`)
- `packages/core/src/convite/convite-da-escola.repository.ts:18`: a classe de trava em duas chaves; a nova é outra (procure `7_000_00` para não repetir)
- `packages/core/src/ciclo-de-vida/conta-global.repository.ts:122`: o `55P03` traduzido em `INDISPONIVEL_TENTE_DE_NOVO`
- A conferência do vínculo **lê sem trava de linha**: nunca `VinculoRepository.travar` (abre o ciclo com `encerrarOsMarcados`)

## Subtarefas

- [ ] 4.1 — `AulaRepository.gravar`: `lock_timeout` de 2 s; (1) `travarAnoEmCurso()`; (2) o vínculo é dela, `confirmado`, da escola e do ano do contexto; (3) `pg_advisory_xact_lock(<classe>, hashtext(escolaId‖vinculoId))`; (4) a data no ano, sem feriado nem recesso, com alocação ou registro **passado**; upsert com `setWhere` da escola; vazio apaga
- [ ] 4.2 — A classe da trava exportada para a 5.0; controller e service no módulo `semana`
- [ ] 4.3 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/semana/aula.repository.ts` | novo |
| `packages/core/src/semana/index.ts` | alterado |
| `apps/api/src/semana/aulas.controller.ts`, `apps/api/src/semana/aulas.service.ts` | novo |
| `apps/api/src/semana/semana.module.ts` | alterado |
| `apps/api/test/aulas.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| G1, uma linha por cláusula | integração | `NAO_ENCONTRADO`, nada gravado | |
| G1: data futura e de hoje, sem alocação, com registro gravado direto | integração | o "passado" | |
| G2 | integração | o fora da grade se corrige | |
| G3 | integração | vazio apaga; 500 grava; 501 recusa | |
| `"  abc  "` grava `"abc"`; 500 com espaços nas pontas grava | integração | aparar antes de medir | |
| vazio sem registro: `texto: null`, sem linha | integração | apagar idempotente | |
| o segundo `PUT` muda `conteudo` e `atualizadoEm`; o `fim` é o da alocação | integração | upsert | |
| no fora da grade, o `fim` gravado fica | integração | upsert | |
| G4 | integração | ano anterior | |
| G5 | integração | log sem texto, sem auditoria | |
| G6, `Promise.all`, as duas com sucesso, uma linha | integração | RF15 | |
| campo a mais, data inexistente e `inicio` mal formado: `ENTRADA_INVALIDA` | integração | contrato estrito | |
| R1 | integração | a mesma resposta | |
| o vínculo da própria professora na escola B, com o token de A | integração | a cláusula da escola | |
| R1b (a) colega de A, trava presa: `NAO_ENCONTRADO` na hora | integração | confere, depois trava | |
| R1b (b) `(escolaA‖vinculoB)` presa: a mesma resposta na hora | integração | chave composta | |
| R4, parte do `PUT` | integração | antecessor | |
| R7, parte do `PUT` | integração | coordenação e aluno | |
| S6, parte do `PUT` | integração | sem ano em curso | |
| S16, parte do `PUT` | integração | aula dupla | |
| J13: na fila da trava, `INDISPONIVEL_TENTE_DE_NOVO` | integração | `lock_timeout` | |
| J14: pausa da virada, `PUT` na fila do ano, `NAO_ENCONTRADO`, nada no ano encerrado | integração | trava do ano | |

O `setWhere` da escola no `on conflict` é inalcançável com a FK composta: prove-o, ou registre a redundância na seção 11
da Tech Spec antes da Mesa.

## Como testar

- J14: `apps/api/test/virada-do-ano.int.test.ts › concorrência: o professor contesta com texto no mesmo instante em que o ano é encerrado…`, com `WriteBlockTrigger` e `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`)
- G6: `apps/api/test/virada-do-ano.int.test.ts › clique duplo: dois \`encerrar\` em paralelo…`
- Trava presa e `lock_timeout`: `apps/api/test/acesso-fim-do-vinculo.int.test.ts:334`
- Log capturado: as `linhasDeLog` de `subirApi` (`apps/api/test/test-api.ts:26`)
- Comando: `npx vitest run --project integracao apps/api/test/aulas.int.test.ts`
- Armadilha (retro da F2, grupo C): a direção é a que o cenário nomeia, e o `esperarNaTrava` casa só o lado esperado

## Autoconferência

As 12 perguntas do modelo, no plano. Na 4: o R1b (a) chega na trava só se a conferência falhar depois dela.

## Fora do escopo desta tarefa

Passo da grade (5.0), painel (7.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
