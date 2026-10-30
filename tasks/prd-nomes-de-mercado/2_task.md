# Tarefa 2.0 — O `conferir` prova "só nome", o `restos` prova que nada sobrou, e nenhum filtro casa vazio

**Funcionalidade:** nomes-de-mercado · **Depende de:** 1.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `test-engineer`, `revisor-geral`
**Porte:** grande

## Objetivo

As três provas de toda onda: o `conferir.ts` compara a foto do `HEAD` com a árvore, o `restos.ts` busca o nome antigo
de todos os mapas, e a trava contra filtro vazio acusa o glob, o caminho e o `path` que não casam com nada.

## Contexto necessário

- `techspec.md` §5: "O `conferir`", "O `restos`" e "A trava contra filtro vazio"; §10
- `casos.md`: "`conferir`", "`restos`" e "Trava contra filtro vazio"
- `prd.md` RF3, RF7 e RF11
- `travas.md`, "A forma da prova" (a forma C cita os casos de árvore da 2.3 e da 2.4)
- `tools/guardas/index.mjs`: `configuracaoDasGuardas` e `EXCECOES_DAS_GUARDAS`

## Subtarefas

- [ ] 2.1 — O `conferir`: a foto do `HEAD` (por `git show`) e a da árvore, o mapa na foto de antes, as exceções
- [ ] 2.2 — O `restos`, com as liberações do §5, sobre todos os mapas. O mapa com `"linha": true` não olha documento
  enquanto não existir `mapas/13.json`. Com o `13.json`, todos olham, e o ouro deixa de ser isento
- [ ] 2.3 — `tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados`: roda sobre a árvore real com
  os mapas de `tools/renomear/mapas/`. É o caso que a forma C das ondas cita
- [ ] 2.4 — `tools/guardas/filtros-casam.test.ts`: a base dividida do §5, as fontes de `casos.md` com o mínimo de hoje
  gravado, e a exceção nominal com o motivo. Um caso por fonte, sobre a árvore real
- [ ] 2.5 — Fixture real: o `eslint.config.mjs`, o `knip.json` e o `paths:` de uma regra, copiados como estão. Os
  comandos já estão no procedimento de onda do `tasks.md`
- [ ] 2.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `tools/renomear/` | novo |
| `tools/guardas/filtros-casam.test.ts` | novo |
| `tools/guardas/__fixtures__/filtros/` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| `conferir`, "Vermelho quando" | unidade | um caso por item | |
| `conferir`, um caso que entra | unidade | vermelho (RF7) | |
| `conferir`, `describe` mudado | unidade | vermelho (RF6) | |
| `conferir`, string em `infra/test/` | unidade | vermelho | |
| `conferir`, string em `tools/renomear/` | unidade | verde: fora da foto | |
| `conferir`, "Verde quando" | unidade | um caso por item | |
| `restos`, "Vermelho" | unidade | um caso por item | |
| `restos`, "Verde" | unidade | um caso por liberação | |
| `restos`, `de` de um mapa anterior | unidade | vermelho | |
| `restos`, mapa de linha sem `13.json` | unidade | documento com nome antigo passa | |
| `restos`, mapa de linha com `13.json` | unidade | o mesmo documento fica vermelho | |
| `restos` na árvore | unidade | zero com os mapas aplicados | |
| filtro vazio, "Verde" | unidade | um caso por item | |
| filtro vazio, "Vermelho" | unidade | um caso por item | |
| filtro vazio na árvore | unidade | cada fonte rende o mínimo gravado | |
| quem contorna é acusado | unidade | o nome antigo passado para template ou chave (`conferir`); em crase, regex ou `dist` (`restos`); o glob que só casa na fixture (filtro): um caso cada | |
| o alvo não existe | unidade | o `conferir` com foto vazia ou pasta inexistente, o comando `restos` sem mapa e a fonte que não carrega falham alto, um caso cada | |

## Como testar

- O mínimo por fonte e a árvore real: `tools/processo/harness/caminhos.test.ts › o repositório de hoje passa, com contagem
  mínima e ao menos um caminho em cada pasta da raiz`.
- A base: `arquivosDoRepositorio()` de `tools/guardas/guardas.test.ts`; a configuração do ESLint, por
  `eslint.calculateConfigForFile` (`guardas.test.ts › a guarda de erro tipado fica…`).
- O AST da foto: siga `tools/guardas/escopo-dos-repositories.ts`. O repositório temporário vem da 1.0.
- Comandos: `npx vitest run --project unidade tools/renomear/ tools/guardas/filtros-casam.test.ts`.

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3, o mínimo fica vermelho com uma fonte pulada (as entries do `knip.json`).

## Fora do escopo desta tarefa

O `aplicar` (1.0), os mapas de onda e qualquer rename.

## Divergências resolvidas nesta tarefa

## Mutações

Um bloco por cláusula do §5: cada categoria da foto, o mapa na foto de antes, as exceções, cada liberação do `restos`,
o mapa de linha e o `13.json`, a base dividida, a exceção nominal e o mínimo de cada fonte.

## Recomendações sem aplicar
