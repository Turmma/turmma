# Tarefa 3.0 — Onda do `shared`: schemas, DTOs, erros e as pastas `erros/` e `sistema/`

**Funcionalidade:** nomes-de-mercado · **Depende de:** 2.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `test-engineer`, `revisor-geral`
**Porte:** grande

## Objetivo

Todas as peças do `packages/shared` passam ao nome de mercado: os schemas zod, os DTOs, os erros e as pastas `erros/` e
`sistema/`. As chaves do JSON e os códigos de erro ficam como estão, e as travas das regras 20 continuam recusando o
que recusavam.

## Contexto necessário

- `tasks.md`, "O procedimento de cada onda"
- `techspec.md` §5 (o mapa e o `conferir`), §7 e §10
- `prd.md` RF3, RF7 e RF11
- `inventario-core-shared.md`: as linhas com "Onde" em `shared/` (§5, §14 e §15), as pastas `erros/` e `sistema/` (§16),
  as linhas `shared/` do §17 e "Não muda, mas parece". As cinco linhas `packages/shared` de `inventario-adenda-2.md`
- `inventario.md` §1, a adenda 1 (o `this.name` acompanha a classe) e a 3
- `travas.md`, as linhas com 3.0 na coluna "Onda"
- `.claude/rules/20-lgpd-menores.md`, itens 4 e 11

## Subtarefas

- [ ] 3.1 — O mapa `tools/renomear/mapas/3.json`
- [ ] 3.2 — O `aplicar`, e a classificação das ocorrências do relatório
- [ ] 3.3 — As travas: `NOME_DA_CLASSE_DE_INVARIANTE`, o filtro `endsWith('ResponseSchema')` e as chaves de
  `EXCECOES_NOMINAIS` em `contratos.test.ts`, e o `this.name` em `erro.int.test.ts` e em `erro-de-invariante.test.ts`.
  O `not.toContain('Error')` da linha 150 fica mais estrito, e isso vai para o mapa
- [ ] 3.4 — O `conferir` e o `restos` verdes. A busca de cada nome antigo em `apps/web/src`, `e2e/` e `docs/`, com a
  saída no documento
- [ ] 3.5 — Os blocos de mutação

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/` | alterado |
| `apps/` | alterado |
| `e2e/` | alterado |
| `infra/test/` | alterado |
| `infra/scripts/` | alterado |
| `tools/guardas/` | alterado |
| `tools/renomear/mapas/` | novo |
| `CLAUDE.md` | alterado |
| `.claude/` | alterado |
| `docs/` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| `conferir` | ferramenta | nenhuma string, regex, `JsxText` ou chave muda fora das exceções, e os casos são os mesmos (RF7); uma peça renomeada fora do mapa fica vermelha | |
| `restos` | ferramenta | nenhum `de` do mapa sobra (RF3) | |
| esteira | esteira | tipagem, lint, guardas, unidade, integração e e2e verdes | |
| `{ esquemaX }` | `conferir` | a chave do schema fica, e o DTO de saída é o mesmo (regra 20, item 4) | |
| `PedidoDoTitular` e o "Resposta" do aluno | `restos` | ficam, porque são domínio | |
| `NOME_DA_CLASSE_DE_INVARIANTE`, forma A | mutação | `new InvariantException(\`${aluno.nome}\`)`: vermelho | |
| `contratos.test.ts`, forma A | mutação | a fixture com `email` na saída continua vermelha, e o conjunto varrido tem a mesma contagem | |
| `erro.int.test.ts:169` e `erro-de-invariante.test.ts:10`, forma A | mutação | vermelho com o nome antigo | |
| `erro.int.test.ts:166`, forma B | mutação | o filtro que vaza o nome no corpo: vermelho | |

## Como testar

- O procedimento de cada onda está no `tasks.md`; os comandos, em `tools/renomear/`.
- A guarda de erro: `tools/guardas/guardas.test.ts › guarda de erro tipado`. Com `lintar(eslintDasGuardas, fixture,
  caminhoSimulado)`, a fixture de `__fixtures__/` traz a marca `reprova:` na linha.
- O contrato: `apps/api/test/contratos.test.ts`. Rode `npx vitest run --project unidade apps/api/test/contratos.test.ts`.
- O erro na resposta: `npx vitest run --project integracao apps/api/test/erro.int.test.ts`.
- A forma B põe o nome novo proibido no código sob teste: a mutação é no filtro de erro, e não no teste.

## Autoconferência

As 12 perguntas do modelo, no plano. Na 5, o `contratos.test.ts` varre o mesmo conjunto: compare a lista de nomes
antes e depois, pelo mapa, e não só a contagem.

## Fora do escopo desta tarefa

O core (4.0 e 5.0) e os apps, a não ser o import e o uso que o rename do `shared` arrasta.

## Divergências resolvidas nesta tarefa

## Mutações

Um bloco por trava (Tech Spec §10). Os dois casos de `erro.int.test.ts` contam como uma trava, com um bloco para cada
forma.

## Recomendações sem aplicar
