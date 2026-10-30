# Tarefa 5.0 — Onda do core, arquivos e pastas, e `@educa/nucleo` vira `@educa/core`

**Funcionalidade:** nomes-de-mercado · **Depende de:** 4.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`, `test-engineer`, `revisor-geral`
**Porte:** grande

## Objetivo

`packages/nucleo/` vira `packages/core/` e `@educa/nucleo` vira `@educa/core`, com as pastas e os arquivos de dentro.
O compose de produção não muda, e cada trava que lê o caminho do core continua recusando.

## Contexto necessário

- `tasks.md`, "O procedimento de cada onda"
- `techspec.md` §5 (os passos 3 e 4), §7c, §10, §11 (o desvio de `infra/scripts/`) e §12 (o lock)
- `prd.md` RF4, RF7 e RF11
- `inventario-core-shared.md` §0, e as linhas `nucleo/` do §16 e do §17
- `inventario.md` §3 e §4, e a adenda 1 (`ia/adapter.ts`)
- `travas.md`, as linhas com 5.0 na coluna "Onda"
- `.claude/rules/80-infra-e-carga.md`

## Subtarefas

- [ ] 5.1 — O mapa `tools/renomear/mapas/5.json`: o pacote, as pastas e os arquivos. `vaga.lua` é nome solto: o
  `build` e o `readFileSync` vão à mão
- [ ] 5.2 — O `aplicar` e a classificação. O lock: `git diff package-lock.json` sem versão mudada (§12)
- [ ] 5.3 — As travas do `travas.md` com 5.0. Os três scripts de `infra/scripts/` passam a tirar os tipos de
  `typeof import(<fonte>)` (§11). As fixtures do escopo passam a importar `@educa/core`. O `-w` e o `db:gerar` vão no
  `package.json` da raiz, e o workspace no `knip.json`
- [ ] 5.4 — As provas:
  - o `conferir` e o `restos`;
  - `npm run build`;
  - `npm run db:gerar` sem migration;
  - `docker compose config` na raiz, igual ao de antes;
  - `git diff --stat -- apps/web/src/componentes/ui/onca/` vazio.

  Depois, a busca dos nomes antigos em `apps/web/src`, `e2e/` e `docs/`
- [ ] 5.5 — Os blocos de mutação. O ouro não se toca aqui (`travas.md`, "O ouro"): avise o Orquestrador no relatório

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/` | alterado |
| `apps/` | alterado |
| `e2e/` | alterado |
| `infra/` | alterado |
| `tools/` | alterado |
| `.github/` | alterado |
| `package.json`, `package-lock.json`, `knip.json`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.base.json` | alterado |
| `eslint.config.mjs`, `eslint-suppressions.json`, `CLAUDE.md` | alterado |
| `.claude/` | alterado |
| `docs/` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| `conferir`, `restos`, esteira | ferramenta | só nome, nada sobra, verde | |
| `db:gerar` | comando | sem migration, e o `_journal` sem diff | |
| imagens e compose de produção | esteira | construídas; o compose sem diff de serviço (RF4) | |
| lock | diff | nenhuma versão muda | |
| `REPOSITORIES_SEM_ESCOPO`, C | mutação | `lista-arquivo-inexistente`: vermelho | |
| `regras-tenant` e `index.mjs` `db/**`, A | mutação | `import { escola } from '@educa/core'` no service: vermelho | |
| `camadas.cjs`, A | mutação | as cinco violações: vermelhas | |
| `arquitetura.test.ts` 260 e 271, A | mutação | 345–348, 427–430 e 526–529: vermelhos | |
| `tabelas-do-nucleo`, A | mutação | a tabela de fora do core: vermelho | |
| `ESCOPO_DO_ERRO_TIPADO`, A | mutação | `throw new Error` em `packages/core/src/x.ts`: vermelho | |
| `porta-unica` 11 e 12, A | mutação | vermelhos com o caminho antigo | |
| `PASTA_DOS_ADAPTADORES`, A | mutação | `adapter.ts` e `llm-gateway.ts` importando o SDK: vermelhos | |
| `caminhos.test.ts` do harness, A | mutação | vermelho com a pasta antiga | |
| `entrega.int.test.ts`, A | mutação | `decidir` fora da rota, em `packages/core/src`: vermelho | |
| `dockerfile.test.ts:118`, B | mutação | o nome novo proibido no Dockerfile: vermelho | |
| `dockerfile.test.ts:111`, A | mutação | vermelho com o caminho antigo | |
| forma C pelo `restos` | mutação | um bloco por trava: `arquitetura.test.ts:50`, `LEITURA`, `infra/scripts`, `medir-risco-a-vida`, `vaga.lua`, o `package.json` da raiz, `borda`, `resolucao-do-shared` e `caminhos-da-esteira` | |
| forma C pelo filtro vazio | mutação | um bloco por fonte: `paths:`, `eslint.config.mjs` e `knip.json` | |

## Como testar

- A forma C cita `tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados` ou o caso da fonte em
  `tools/guardas/filtros-casam.test.ts` (2.0).
- As camadas: `npx vitest run --project unidade tools/guardas/camadas.test.ts`. A árvore `__fixtures__/camadas/packages/nucleo/`
  muda de caminho junto.
- O Dockerfile: `infra/docker/servico.Dockerfile` e `tools/ci/dockerfile.test.ts`.
- O `jobs.int.test.ts` roda no projeto `infra`, com o compose: `npx vitest run --project infra infra/test/jobs.int.test.ts`.

## Autoconferência

As 12 perguntas do modelo, no plano. Na 6, rode cada fixture com o caminho novo.

## Fora do escopo desta tarefa

O ouro (correção do Arquiteto depois desta onda). Os arquivos dos apps (6.0).

## Divergências resolvidas nesta tarefa

## Mutações

Um bloco por trava (Tech Spec §10), na forma da coluna do `travas.md`.

## Recomendações sem aplicar
