# Tarefa 4.0 — O motor da planilha grava o calendário: prévia, gravar e job em três passos

**Funcionalidade:** onboarding-por-convite · **Depende de:** 2.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

A planilha de calendário entra pela API: a prévia classifica, gravar responde 202 e enfileira, e o job
`estrutura.gravar-planilha` refaz a classificação e grava em três passos. É o motor das outras três planilhas.

## Contexto necessário

- `techspec.md` §4 (as três rotas de importação; o filtro `anoLetivoId`), §5 "Planilha", "O job" e a tabela de estados,
  "Gravar" (só "Calendário: substitui no ano"), §6, §7c
- `prd.md` RF2, RF10, RF15, RF16, RF17
- `cenarios.md` RF2, RF10, "Job e estados"
- Regra 00 item 4; regra 80 itens 2, 3 e 7; D49
- Código: `packages/core/src/queue/`; `packages/shared/src/system/job-definitions.ts` e o teste dele; `apps/worker/src/composition.ts`, `job-executor.ts`, `composition.test.ts`; `apps/api/src/estrutura/lista/`

## Subtarefas

- [ ] 4.1 — `packages/core/src/importacao/`: o motor (classificação em lote, assinatura, três passos, escrita condicional, resultados) e o tipo calendário
- [ ] 4.2 — `ImportacaoRepository` com escopo; o gravar refaz a prévia, fecha `falhou` a `na_fila` de mais de 1 h (`for update nowait`; travada: `CONFLITO`) e enfileira
- [ ] 4.3 — Rotas `POST /v1/importacoes/:tipo/previa` e `POST /v1/importacoes/:tipo` (coordenador), com o filtro `anoLetivoId` validado no servidor
- [ ] 4.4 — `estrutura.gravar-planilha` em `packages/shared/src/system/job-definitions.ts` (constante `TIPO_GRAVAR_PLANILHA`, fila `normal`, escopo `escola`, executor `worker`, dados estritos só com o id da importação), vinda da 2.2; `apps/worker/src/processors/gravar-planilha.ts`: escola da linha; os tempos do passo (3); nova tentativa com espera crescente; métricas por resultado e do passo (3)
- [ ] 4.5 — Auditoria `planilha.gravada` (tipo e contagens)
- [ ] 4.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/importacao/motor.ts`, `importacao.repository.ts`, `tipos/calendario.ts`, `index.ts` | novo |
| `apps/api/src/estrutura/importacao/importacao.controller.ts`, `importacao.service.ts` | novo |
| `apps/api/src/estrutura/estrutura.module.ts` | alterado |
| `apps/worker/src/processors/gravar-planilha.ts` | novo |
| `apps/worker/src/composition.ts` | alterado |
| `packages/shared/src/system/job-definitions.ts`, `job-definitions.test.ts` | alterado |
| `apps/api/test/importacao.int.test.ts`, `apps/worker/test/gravar-planilha.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| Calendário: a prévia classifica, gravar responde 202 e o job conclui | integração | caminho feliz | |
| Gravar sem prévia, com texto errado: `ENTRADA_INVALIDA`, nenhuma importação | integração | RF2 | |
| Marca fora dos candidatos: `ENTRADA_INVALIDA` | integração | RF2 | |
| Data fora do ano letivo: erro na linha | integração | RF10 | |
| Evento de um dia entra; fim antes do início é erro | integração | borda (feriado de um dia) | |
| Reimportar substitui só no ano de destino | integração | RF10 | |
| A prévia mostra o que entra e o que sai | integração | RF10 | |
| [P] Gravar duas vezes: uma `na_fila`, a outra `CONFLITO` | [P] | único parcial | |
| `na_fila` há mais de 1 h: o gravar seguinte a fecha `falhou` (`expirada`) | integração | | |
| `na_fila` travada por um job rodando: `CONFLITO` sem esperar | integração | `nowait` | |
| Assinatura diferente: `desatualizada` | integração | | |
| Ano encerrado entre o gravar e o job: `desatualizada` | integração | | |
| [P] `encerrar` do ano com o job pausado: espera ou `desatualizada`; nunca grava no ano encerrado | [P] | `FOR SHARE` do ano | |
| [P] Duas execuções, barreira depois do (2): um conjunto de eventos; métrica com uma `concluida` e uma `ignorada` | [P] | `for update` | |
| Falha no segundo lote de 1.200 eventos, sempre: `na_fila` e zero eventos entre tentativas; no fim, `falhou` | integração | uma transação | |
| Ano travado mais de 1 s no (3): nada parcial; solto, conclui; sempre travado, `falhou` | integração | `lock_timeout` | |
| `linhas` e `marcas` nulas em `concluida`, `desatualizada` e `falhou` | integração | | |
| Tentativas esgotadas e falha definitiva: `falhou` com o código | integração | | |
| Com o payload adulterado, o job usa a escola da linha | integração | isolamento | |
| Prévia e gravar com `turmaId` ou marca da B: igual a inexistente | integração | isolamento | |
| Sem ano em curso: prévia e gravar com o filtro do planejado funcionam; sem filtro, `NAO_ENCONTRADO` | integração | ano | |
| Filtro com ano de outra escola ou encerrado: `NAO_ENCONTRADO` | integração | ano | |
| Professor na prévia e no gravar: recusado | integração | permissão | |
| Auditoria `planilha.gravada` com tipo e contagens, sem nome | integração | RF17 | |
| Log do job: ids, contagens e código, nunca a linha | integração | regra 20, item 9 | |

## Como testar

- API: `apps/api/test/lista.int.test.ts › a prévia aponta cada linha ruim com o código, entre as boas; …` (`escolaComTurmas()`); isolamento: `apps/api/test/estrutura-isolamento.int.test.ts › a turma de B, no contexto de A, …`
- Worker com relógio: `apps/worker/test/expurgo-de-acesso.int.test.ts` (`relogioEm`, o processor criado com repositório e relógio)
- Barreira e trava: `WriteBlockTrigger`, `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`); auditoria: `auditoriaDa(bancada, escolaId, acao)` (`apps/api/test/material.fixture.ts`)
- Comandos: `npx vitest run --project integracao apps/api/test/importacao.int.test.ts apps/worker/test/gravar-planilha.int.test.ts`
- Registro de jobs: `apps/worker/src/composition.test.ts` exige processador para todo tipo do worker na réplica de cada fila dele, e o 3º caso lista os tipos da `normal` (passa a incluir o novo); `job-definitions.test.ts` conta os tipos e fixa os prazos: o novo entra na lista e no `prazoMs`
- Armadilhas: o desfecho de uma execução se prova chamando o processor (tentativa 1); nos [P] do `lock_timeout`, só o estado final

## Autoconferência

As 12 perguntas do modelo, no plano. Na 4, o gravar com erro precisa chegar ao `refaz a prévia`, não parar no limite de tamanho.

## Fora do escopo desta tarefa

Limites, expurgos e leituras (5.0); os outros tipos (6.0, 7.0, 11.0); telas (13.0, 14.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
