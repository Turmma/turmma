# Tarefa 2.0 — Nenhum PDF fica para trás: `envio_de_material`, objeto antes da linha, varredura horária

**Funcionalidade:** ingestao-do-material · **Depende de:** 1.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

Todo objeto que o envio grava sai do storage, mesmo sem commit: a linha de `envio_de_material` nasce antes do
`guardarBytes` e sai na transação; a varredura horária limpa o que sobrou depois de 1 h, e o órfão pós-commit em 25 h.

## Contexto necessário

- `techspec.md` §3 (`envio_de_material`), §5 "Envio e edição" (2) a (4), §6, §7c
- `prd.md` RF13
- `tasks/prd-reengenharia/onda-3b.md` "3. Falha": "Órfão" e "Órfão em duas escolas"
- `cenarios.md` "Envio, séries e licença no envio": as linhas do objeto e da varredura
- `.claude/rules/` 10 (item 9), 20 (item 7), 40, 80
- Código: o envio em `apps/api/src/material/material.service.ts`; `apps/worker/src/job-schedules.ts`; `packages/core/src/db/unscoped.decorator.ts`

## Subtarefas

- [ ] 2.1 — Migration: `envio_de_material` (pk composta, FK da escola); classificação `sem_pessoa`
- [ ] 2.2 — Id UUIDv7, a linha, depois o `guardarBytes` com prazo; a transação apaga a linha sob `lock_timeout` curto, ou desfaz com 503
- [ ] 2.3 — O `catch`: falha do `guardarBytes` tenta apagar o objeto e deixa a linha; falha depois apaga o objeto (ausente conta) e só então a linha; `apagar` que falha deixa a linha
- [ ] 2.4 — Varredura horária (fila `lote`): linhas de mais de 1 h, `for update skip locked`, no contexto de cada escola, objeto e depois linha, prazo curto; e o órfão pós-commit (25 h). `@Unscoped` com a justificativa no mesmo método (R6)
- [ ] 2.5 — Log da varredura; `docs/lgpd.md` e `docs/modelo-de-dados.md`
- [ ] 2.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0050_*.sql`, `packages/core/src/material/envio.repository.ts`, `apps/worker/src/processors/varrer-envios.ts`, `apps/api/test/material-envio-orfao.int.test.ts`, `apps/worker/test/varrer-envios.int.test.ts` | novo |
| `packages/core/src/db/schema/material.ts`, `packages/core/src/material/index.ts`, `packages/shared/src/system/job-definitions.ts`, `packages/shared/src/privacidade/classificacao.ts`, `apps/api/src/material/material.service.ts`, `apps/api/src/material/material.repository.ts`, `apps/worker/src/composition.ts`, `apps/worker/src/job-schedules.ts`, `docs/lgpd.md`, `docs/modelo-de-dados.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| caminho feliz | I | a linha existe antes do `guardarBytes` e não sobra | |
| `CONFLITO` depois do `guardarBytes` | I | objeto e linha apagados. Mutação: tirar o apagar do `catch` | |
| `LIMITE_EXCEDIDO` sob a trava | I | objeto e linha apagados | |
| commit forçado a falhar | I | objeto e linha apagados | |
| `guardarBytes` estoura o prazo e grava depois do `apagar` | I | 503, a linha fica; 61 min, a varredura apaga. Mutação: apagar a linha nesse `catch` | |
| `CONFLITO` com o `apagar` falhando | I | a linha fica. Mutações: linha antes do objeto; não conferir o `apagar` | |
| `apagar` falha uma vez na varredura | I | sai na hora seguinte | |
| queda antes do commit | I | 59 min fica, 61 min sai, mesmo `Clock`. Mutação: tirar a leitura da tabela | |
| linha sem objeto | I | sai sem erro | |
| a varredura apagou a linha de um envio lento | I | 503, nada em `material`. Mutação: não conferir o `delete` | |
| [P] envio com a linha travada, varredura das 61 min | P | pula, o envio confirma. Mutações: tirar `skip locked`; tirar o travar | |
| órfão `pronto` 25 h; 23 h | I | sai; fica | |
| órfão `falhou` 25 h, `apagar` da 1.0 falhou | I | sai. Mutação: `processado_em` só no sucesso | |
| órfão excluído 25 h; `processando` 25 h; de antes da migration | I | sai; fica; não entra | |
| isolamento: duas escolas | I | cada `apagar` no contexto da sua. Mutação: um contexto só | |
| falha numa escola | I | as outras seguem | |
| o `@Unscoped` | U | `architecture.test.ts` acha a justificativa; lê só escola e id (R6) | |
| log da varredura | I | ids e contagens, nunca título, arquivo, licenciante | |

## Como testar

- Envio: `apps/api/test/material.int.test.ts` › "na mesma escola é `CONFLITO`…" e › "a pessoa no teto recebe `LIMITE_EXCEDIDO`…"; `InMemoryFileStorage` com `guardarBytes` que grava depois de um sinal
- Trava: `WriteBlockTrigger` e `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`), como `suboperador.int.test.ts` › "concorrência: dois encerramentos…"
- Varredura: `rodar(escolaId, processador)` de `apps/worker/test/expurgo-da-escola.int.test.ts`; `RelogioMovel` (`apps/worker/test/enviar-email-da-conta.int.test.ts:41`)
- Comando: `npx vitest run --project integracao apps/worker/test/varrer-envios.int.test.ts`
- Armadilha: 59 e 61 min do mesmo `Clock`, nunca `Date.now()`

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano. Na 1: cada `catch` e a
ordem objeto→linha.

## Fora do escopo desta tarefa

`LICENCA_VENCIDA` (7.0) e `EDICAO_EM_ANDAMENTO` (8.0) entram nesta suíte nas tarefas delas.

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar
