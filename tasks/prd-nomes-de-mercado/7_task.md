# Tarefa 7.0 — Onda da api, símbolos (linha back)

**Funcionalidade:** nomes-de-mercado · **Depende de:** 6.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `test-engineer`, `revisor-geral`
**Porte:** grande

## Objetivo

Os símbolos técnicos de `apps/api/src/` passam ao nome de mercado: `SessaoGuard`, `TokenIssuer`, `forRoot`,
`TenantResolutionRepository` e o resto do anexo. A cerca da resolução de tenant e os marcadores de operação continuam
recusando o que recusavam. Corre em linha com a web.

## Contexto necessário

- `tasks.md`, "O procedimento de cada onda" (o mapa leva `"linha": true`)
- `techspec.md` §5 (as linhas não tocam documento, e trava de `tools/` nelas é divergência), §7c (a linha só é verde
  depois da esteira da spec) e §10
- `prd.md` RF3, RF7 e RF11
- `inventario-back.md`, as linhas com caminho em `apps/api/src/`. As linhas `apps/api/src` de `inventario-adenda-2.md`
- `inventario.md` §1 (o nome misto, como `TurmaController`) e a adenda 3 (`loadLoginConfig`)
- `travas.md`, as linhas com 7.0 na coluna "Onda"

## Subtarefas

- [ ] 7.1 — O mapa `tools/renomear/mapas/7.json`, com `"linha": true`
- [ ] 7.2 — O `aplicar` e a classificação. `static com(` vira `forRoot(`: o "com" em prosa e em string fica
- [ ] 7.3 — As travas:
  - `ZONAS` (linha 49) com `TenantResolutionRepository`;
  - `NOMES_DOS_MARCADORES` (linha 552) e as fixtures 651, 652 e 657 a 659;
  - a chave `HashDeSenha` nos tipos de `infra/scripts/`.

  O `ResolucaoDeTenantRepository` das fixtures de `tools/guardas/__fixtures__/camadas/` é `fica`
- [ ] 7.4 — O `conferir` e o `restos`. A busca dos nomes antigos em `apps/` e `e2e/`, sem `docs/` (é da 13.0)
- [ ] 7.5 — Os blocos de mutação

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/` | alterado |
| `apps/worker/test/`, `apps/realtime/test/`, `apps/despachante/test/` | alterado |
| `apps/worker/src/app.module.ts`, `apps/despachante/src/app.module.ts`, `apps/realtime/src/app.module.ts` | alterado |
| `infra/test/`, `infra/scripts/` | alterado |
| `e2e/support/seed.ts`, `e2e/support/operacao.ts` (os `e2e/__fixtures__/sessao.ts` e `operacao.ts` de antes da 6.0) | alterado |
| `e2e/entrar-na-escola.spec.ts`, `e2e/pedido-do-titular.spec.ts` | alterado |
| `tools/ci/codigo-do-autenticador.test.ts` | alterado |
| `tools/renomear/mapas/7.json`, `tools/renomear/mapas/7.relatorio.md` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| `conferir` | ferramenta | só nome, os mesmos casos (RF7) | |
| `restos` | ferramenta | nada sobra em código; documento não conta na linha | |
| esteira | esteira | verde na esteira da spec, depois do encontro | |
| "com" em prosa e em string | `restos` | fica | |
| edição em `tools/` fora dos previstos, ou em documento | `aplicar` | recusada pelo `--escopo` | |
| fixtures das camadas | `restos` | o `fica` é liberado | |
| `ZONAS`, A | mutação | "a varredura acha as três classes dentro da zona" (66 a 74), com `TenantResolutionRepository`: vermelho | |
| `NOMES_DOS_MARCADORES`, A | mutação | 651, 652 e 657 a 659: vermelhos | |
| `HashDeSenha` em `infra/scripts`, C | mutação | `restos` | |

## Como testar

- A forma C cita `tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados`.
- Os marcadores e as zonas: `npx vitest run --project unidade apps/api/test/arquitetura.test.ts`.
- A tipagem dos scripts de carga: `npx tsc -p infra/tsconfig.json --noEmit`.
- O `static com(` (`inventario-back.md:39`) vale também no `app.module.ts` do worker, do despachante e do realtime:
  a linha é inteira desta onda.
- Ao fechar, a linha não espera a esteira: ela roda na `spec/nomes-de-mercado` depois do encontro (Tech Spec §7c).

## Autoconferência

As 12 perguntas do modelo, no plano. Na 4, o caso das zonas só alcança a cláusula com a classe renomeada: confira que
ele fica vermelho com o nome antigo na regex.

## Fora do escopo desta tarefa

O worker, o despachante, o realtime e o apoio de teste de `apps/api/test/` (8.0), e os documentos (13.0).

## Divergências resolvidas nesta tarefa

## Mutações

Um bloco por trava (Tech Spec §10), na forma da coluna do `travas.md`.

## Recomendações sem aplicar
