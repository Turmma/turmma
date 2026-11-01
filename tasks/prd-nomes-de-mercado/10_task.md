# Tarefa 10.0 — Onda da web fora do kit (linha web)

**Funcionalidade:** nomes-de-mercado · **Depende de:** 9.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `frontend-reviewer`, `test-engineer`, `revisor-geral`
**Porte:** grande

## Objetivo

As peças técnicas da web fora do kit passam ao nome de mercado: o cliente HTTP, as consultas (`<x>QueryOptions`), as
chaves (`<X>_QUERY_KEY`), os providers, os hooks, as rotas e o apoio de teste. A casca, as telas e os valores das
chaves do TanStack Query ficam como estão.

## Contexto necessário

- `tasks.md`, "O procedimento de cada onda" (o mapa leva `"linha": true`)
- `techspec.md` §5, §9 e §10
- `prd.md` RF3, RF6 e RF7
- `inventario-web-e2e.md` §6 a §11 e §15, mais "Ficam (casca e telas)" e "Não muda, mas parece". As linhas `apps/web`
  de `inventario-adenda-2.md` fora do kit, e as quatro de `inventario-adenda-4.md` (aprovada em 01/11; triagem da 2ª
  divergência da 10.0)
- `inventario.md` §1, as linhas `consulta<X>` e `CHAVE_<X>`
- `.claude/rules/50-frontend.md`
- A leitura do anexo (triagem da divergência da 10.0): `consultarConvite` e `consultarConviteDeOperador`
  (`inventario-web-e2e.md:448` e `:496`) ficam, porque são `fetch` comum e não `queryOptions`, e o verbo de domínio fica
  (`inventario.md` §2, decisão 3); entram como `fica` no item "Homônimo e texto na 10.0" do anexo. As três `CHAVE_` de
  `localStorage` seguem o §10 (`*_STORAGE_KEY`), e as linhas delas no §15 ganham "(vale o §10)". `caminhoDoX` fica e
  `formatar*` entra (decisão 3). `PARAMETRO_DO_X` entra pela linha 287: a linha aprovada vale sobre a regra geral da
  decisão 4

## Subtarefas

- [ ] 10.1 — O mapa `tools/renomear/mapas/10.json`, com `"linha": true`
- [ ] 10.2 — O `aplicar` e a classificação. Muda o nome da constante (`CHAVE_` → `_QUERY_KEY`), e o valor da chave
  fica
- [ ] 10.3 — As travas: o `travas.md` não lista nenhuma desta onda. A que o relatório achar ganha linha e bloco
- [ ] 10.4 — O `conferir` e o `restos`. A busca dos nomes antigos em `apps/web/src` e `e2e/`
- [ ] 10.5 — A seção "Mutações"

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/`, `apps/web/chunk-names.ts` (o `nome-dos-chunks.ts` de antes da 6.0), `apps/web/chunk-names.test.ts`, `apps/web/vite.config.ts` | alterado |
| `eslint-suppressions.json` | alterado (a chave de `LoginPorCima.tsx`, que acompanha o componente; triagem da 9.0) |
| `e2e/operacao-escolas.spec.ts`, `e2e/operacao-uso.spec.ts` | alterado |
| `e2e/casca.spec.ts` | alterado (o comentário que cita `RODAPE_DA_LATERAL`; triagem da divergência da 10.0) |
| `apps/web/index.html` | alterado (só o comentário do script do tema: `resolverTema` → `resolveTheme`, à mão, porque o passo 5 não lê HTML; troca à mão no relatório; triagem da 2ª divergência da 10.0) |
| `e2e/aparencia.spec.ts`, `e2e/tokens.spec.ts`, `e2e/tamanho-da-letra.spec.ts`, `tools/ci/duracao-do-e2e.ts` | sem diff no fim: o passo 5 troca o comentário do homônimo, a onda desfaz e registra `fica` (Tech Spec §5, passo 5; triagem da divergência da 10.0) |
| `tools/renomear/mapas/10.json`, `tools/renomear/mapas/10.relatorio.md` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| `conferir` | ferramenta | só nome, os mesmos casos (RF7) | |
| `restos` | ferramenta | nada sobra em código | |
| esteira | esteira | verde na esteira da spec, depois do encontro | |
| valores das chaves do TanStack Query | `conferir` | iguais: muda só o nome da constante | |
| `CascaDaEscola`, `MenuDaPessoa` e as telas das áreas | diff | intactos | |
| texto de `describe` do apoio de teste da web | `conferir` | igual (RF6) | |

## Como testar

- A chave da consulta é um array de strings: o `conferir` o compara como literal, e ele não pode mudar.
- As consultas de `areas/**/api/` estão no §15 do anexo (85 exports). O `aplicar` acha os usos pelo `tsconfig` da web.
- `e2e/operacao-escolas.spec.ts` importa `apps/web/src/operacao/estados-da-escola.ts`: por isso está nos previstos.
- A unidade da web: `npx vitest run --project unidade apps/web/`.
- Telas: nenhuma muda. Não há foto nova.
- Ao fechar, a linha não espera a esteira (Tech Spec §7c).

## Autoconferência

As 12 perguntas do modelo, no plano. Na 5: compare os valores das chaves, e não só o nome da constante.

## Fora do escopo desta tarefa

O kit (9.0) e o e2e (11.0), a não ser o arquivo que importa a web e o comentário que o passo 5 alcança (os previstos acima).

## Divergências resolvidas nesta tarefa

## Mutações

**Sem mutação:** rename, sem condição nova. Vale enquanto o relatório não achar trava nova.

## Recomendações sem aplicar
