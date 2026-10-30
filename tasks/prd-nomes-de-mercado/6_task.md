# Tarefa 6.0 — Onda dos arquivos e das pastas de todos os apps e do e2e

**Funcionalidade:** nomes-de-mercado · **Depende de:** 5.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `test-engineer`, `revisor-geral`
**Porte:** grande

## Objetivo

Os arquivos e as pastas técnicos de `apps/` e de `e2e/` passam ao nome de mercado, com os sufixos do Nest
(`rate-limit.guard.ts`), `components/ui/`, `gallery/` e `*.fixture.ts`. Os símbolos ficam para as linhas. Cada trava que
lê o caminho continua recusando, e o lint, o `knip` e as supressões apontam para os arquivos novos.

## Contexto necessário

- `tasks.md`, "O procedimento de cada onda"
- `techspec.md` §5 (o passo 3 e a razão de os arquivos virem antes das linhas) e §10
- `prd.md` RF5, RF6, RF7 e RF11
- As linhas de tipo `arquivo` e `pasta` de `inventario-back.md`, com "Arquivos de teste de assunto técnico"
- `inventario-web-e2e.md`: §13, §14 e as linhas `arquivo` e `pasta` das outras seções
- `inventario.md` §1 (`*-de-teste.ts` vira `<dominio>.fixture.ts`) e a adenda 1 (os pontos de entrada de `ops/` ficam)
- `travas.md`, as linhas com 6.0 na coluna "Onda"

## Subtarefas

- [ ] 6.1 — O mapa `tools/renomear/mapas/6.json`. O rename só de caixa passa pelo nome intermediário
- [ ] 6.2 — O `aplicar` e a classificação. `ARQUIVO_DO_SANDBOX` é nome solto, e vai à mão
- [ ] 6.3 — As travas do `travas.md` com 6.0:
  - a fixture de `cerca-resolucao-de-tenant` muda de caminho, e as strings esperadas entram em `excecoesDoConferir`;
  - as exceções de `guardioes-por-caminho.ts`;
  - o caminho de `ZONAS`;
  - `correcao.int.test.ts` e `assistente.int.test.ts`;
  - `avatar-so-nas-duas-pecas`;
  - o `dist` de `infra/scripts/`;
  - `eslint.config.mjs` (72 e 116) e `eslint-suppressions.json`;
  - `guardas.test.ts:159`;
  - `mutacoes.ts`;
  - `nome-dos-chunks.ts`
- [ ] 6.4 — As provas:
  - o `conferir`, o `restos` e o lint sem supressão órfã;
  - a árvore igual num checkout limpo;
  - a busca dos nomes antigos em `apps/web/src`, `e2e/` e `docs/`.
- [ ] 6.5 — Os blocos de mutação

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/`, `apps/web/`, `apps/worker/`, `apps/realtime/`, `apps/despachante/` | alterado |
| `e2e/**`, `playwright.config.ts` | alterado |
| `infra/test/`, `infra/scripts/` | alterado |
| `tools/guardas/`, `tools/processo/`, `tools/ci/`, `tools/testes/` | alterado |
| `eslint.config.mjs`, `eslint-suppressions.json`, `knip.json`, `package.json` | alterado |
| `tools/renomear/mapas/` | novo |
| `CLAUDE.md`, `.claude/**`, `docs/**` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| `conferir` | ferramenta | os mesmos casos; `*-de-teste.ts` movido para `.fixture.ts` com os casos dele | |
| `restos` e esteira | ferramenta | nada sobra, e tudo verde | |
| `data-testid` e rotas | `conferir` | iguais | |
| rename só de caixa | checkout | o checkout limpo dá a mesma árvore | |
| `cerca-resolucao-de-tenant`, A | mutação | `camadas.test.ts`, 142 a 146 e 221: vermelho | |
| `cerca-resolucao-de-tenant`, C | mutação | o filtro vazio acusa o `path` | |
| `guardioes-por-caminho`, A | mutação | `components/ui/ai/` volta a pedir os três guardiões | |
| `ZONAS`, C | mutação | o `restos` acusa a metade do caminho | |
| `correcao.int.test.ts`, A | mutação | a chamada fora do service e da rota: vermelha. Se a onda não renomear esses arquivos, é `fica` | |
| `assistente.int.test.ts`, A | mutação | o repository novo que toca `mensagemAgente`: vermelho | |
| `avatar-so-nas-duas-pecas`, A | mutação | um arquivo em `gallery/` importando o avatar: vermelho | |
| `infra/scripts` e `ARQUIVO_DO_SANDBOX`, C | mutação | `restos` | |
| `eslint.config.mjs` 72 e 116, C | mutação | o filtro vazio | |
| `guardas.test.ts:159` | mutação | o caminho virtual com o nome novo | |
| `mutacoes.ts`, A | mutação | `e2e/support/` continua apoio | |
| `nome-dos-chunks`, A | mutação | o teste dele, com o caminho novo | |

## Como testar

- A forma C cita `tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados` ou o caso da fonte em
  `tools/guardas/filtros-casam.test.ts`.
- As camadas: `npx vitest run --project unidade tools/guardas/camadas.test.ts`.
- Os guardiões: `npx vitest run --project unidade tools/processo/harness/guardioes.test.ts`.
- O sandbox do worker quebra só com a imagem: `npx vitest run --project infra infra/test/jobs.int.test.ts`.
- O checkout limpo: `git clone` do andar numa pasta temporária, e `git ls-files` igual.

## Autoconferência

As 12 perguntas do modelo, no plano. Na 6, a cerca que mudou de lugar reprova, e não se cala.

## Fora do escopo desta tarefa

Os símbolos dos apps e do e2e (7.0 a 11.0). Os pontos de entrada de `apps/api/src/ops/` (adenda 1).

## Divergências resolvidas nesta tarefa

## Mutações

Um bloco por trava (Tech Spec §10), na forma da coluna do `travas.md`.

## Recomendações sem aplicar
