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

- [x] 5.1 — O mapa `tools/renomear/mapas/5.json`: o pacote, as pastas e os arquivos. `vaga.lua` é nome solto: o
  `build` e o `readFileSync` vão à mão
- [x] 5.2 — O `aplicar` e a classificação. O lock: `git diff package-lock.json` sem versão mudada (§12)
- [x] 5.3 — As travas do `travas.md` com 5.0. Os três scripts de `infra/scripts/` passam a tirar os tipos de
  `typeof import(<fonte>)` (§11). As fixtures do escopo passam a importar `@educa/core`. O `-w` e o `db:gerar` vão no
  `package.json` da raiz, e o workspace no `knip.json`
- [x] 5.4 — As provas:
  - o `conferir` e o `restos`;
  - `npm run build`;
  - `npm run db:gerar` sem migration;
  - `docker compose config` na raiz, igual ao de antes;
  - `git diff --stat -- apps/web/src/componentes/ui/onca/` vazio;
  - o lock: o diff de `package-lock.json` é só a troca `@educa/nucleo` → `@educa/core`, a nova ordem das entradas
    (`node_modules/@educa/core` e `packages/core`) e nenhuma versão mudada, e `grep -n "packages/nucleo\|extraneous\|@educa/nucleo" package-lock.json`
    não acha nada. O `aplicar` deixou a entrada `packages/nucleo` com `"extraneous": true`, que nenhum comando do npm
    tira (`npm install --package-lock-only`, `npm prune` e `npm install` a mantêm, e o `npm ci` a aceita): foi podada à
    mão, depois da 1ª rodada (ordem `5_task-r1.md`, item 1).

  Depois, a busca dos nomes antigos em `apps/web/src`, `e2e/` e `docs/`. Resultado: `apps/web/src` e `e2e/` sem
  ocorrência; em `docs/`, `docs/aia/ouro/README.md` (linhas 20 e 126, o ouro, da correção do Arquiteto) e o caminho
  parcial `nucleo/src/...` de `docs/guia-do-desenvolvedor.md` (linhas 74 a 83) e `docs/modelo-de-dados.md:747`, que são
  da 13.0
- [x] 5.5 — Os blocos de mutação. O ouro não se toca aqui (`travas.md`, "O ouro"): avise o Orquestrador no relatório

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
| forma C pelo `restos` | mutação | um bloco por trava: `arquitetura.test.ts:50`, `LEITURA`, `infra/scripts`, `medir-risco-a-vida`, o `package.json` da raiz, `borda`, `resolucao-do-shared` e `caminhos-da-esteira`, mais os achados da 5.0. `vaga.lua` não tem bloco: ver "Sem bloco" em "Mutações" | |
| forma C pelo filtro vazio | mutação | um bloco por fonte que cita o core: `knip.json` e a exceção de log do `index.mjs`. `paths:` e `eslint.config.mjs` não citam `packages/nucleo`: ver "Sem bloco" em "Mutações" | |

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

- 2026-10-31, Arquiteto: o `restos` só libera uma `fica` quando o `arquivo` dela é o do arquivo como está hoje, e as `fica` dos mapas 3 e 4 guardam o caminho de antes do move: depois do `aplicar` da 5.0 sobraram 28 restos que não eram da onda (`ErroDeIa`, `SemEscopo`, `Permite`, `migrar` e outros). Detalhe não previsto, saída (b): a correção `2026-10-31-restos-nao-segue-o-move` (`d1904823`) faz o `restos` seguir o move dos mapas posteriores, e a frase nova da Tech Spec §5 vai neste commit. Com ela, o `restos` deu só as 314 travas de `packages/nucleo` e `@educa/nucleo`, que a troca à mão resolveu.
- 2026-10-31, Arquiteto: o `typeof import(<fonte>)` dos três scripts de `infra/scripts/` (Tech Spec §11, linha do RF7; subtarefa 5.3) não passa no lint: `consistent-type-imports` proíbe a afirmação de tipo com `import()` (11 erros) e a `tabela-so-no-repository` reprova o texto `@educa/core` nele (3 erros). Detalhe não previsto, opção (a): os três scripts ficam como no `HEAD`, só com `@educa/core` e o caminho do `dist` trocados, e a chave dos tipos literais segue sem checagem, como hoje. A Tech Spec §11 (linha do RF7, sem o desvio) e o `travas.md:85` foram mudados pelo Arquiteto e vão neste commit.
- 2026-10-31, registro, sem divergência: a árvore `tools/guardas/__fixtures__/camadas/packages/nucleo/` era movida à mão e o `conferir` a achava sem explicação; entrou no mapa como entrada `pasta` (`inventario-core-shared.md:1115`), sem mudar o resto. O especificador `@educa/nucleo-legado` da fixture de filtros ficou como estava: o `conferir` não aceita trocar especificador, e o nome já não é parecido com o do pacote novo.

## Mutações

Um bloco por trava (Tech Spec §10), na forma da coluna do `travas.md`. Em toda forma A, a mutação devolve a trava ao nome antigo e um caso que já existe fica vermelho. Nenhum caso entra (RF7). Cada bloco foi rodado antes de entrar aqui, vermelho por um caso que rodou e falhou.

**`REPOSITORIES_SEM_ESCOPO`** (`travas.md`, linha 34, forma C, a própria guarda). Com o caminho de `auditoria.repository.ts` no nome antigo, a lista cita um arquivo que não existe e a guarda acusa `lista-arquivo-inexistente`.

```mutacao
arquivo: tools/guardas/escopo-dos-repositories.ts
teste: tools/guardas/repositories-com-escopo.test.ts › todo método público real tem
-arquivo: 'packages/core/src/auditoria/auditoria.repository.ts',
+arquivo: 'packages/nucleo/src/auditoria/auditoria.repository.ts',
```

**`regras-tenant.mjs` (`PACOTE`) e o `index.mjs` (`db/**`)** (linhas 35 e 36, forma A). Com o pacote no nome antigo, o `import … from '@educa/core'` da fixture deixa de ser acusado nos seis caminhos; com a pasta antiga em `db/**`, `packages/core/src/db/schema/x.ts` deixa de ser isento.

```mutacao
arquivo: tools/guardas/regras-tenant.mjs
teste: tools/guardas/guardas.test.ts › reprova trazer do núcleo a tabela, o schema, o módulo inteiro e o texto do pacote em
-const PACOTE = '@educa/core'
+const PACOTE = '@educa/nucleo'
```

```mutacao
arquivo: tools/guardas/index.mjs
teste: tools/guardas/guardas.test.ts › deixa a mesma fixture passar onde a tabela mora
-files: ['packages/core/src/db/**'],
+files: ['packages/nucleo/src/db/**'],
```

**`ESCOPO_DO_ERRO_TIPADO`** (linha 53, forma A). Sem `packages/core/src/**` no escopo, o `throw new Error` de `packages/core/src/x/x.ts` passa.

```mutacao
arquivo: tools/guardas/index.mjs
teste: tools/guardas/guardas.test.ts › reprova Error genérico, texto e literal lançados e o motivo do ErroDeInvariante que não é texto fixo, em
-export const ESCOPO_DO_ERRO_TIPADO = ['apps/*/src/**/*.{ts,tsx}', 'packages/core/src/**/*.{ts,tsx}']
+export const ESCOPO_DO_ERRO_TIPADO = ['apps/*/src/**/*.{ts,tsx}', 'packages/nucleo/src/**/*.{ts,tsx}']
```

**`camadas.cjs`** (linha 37, forma A). Um bloco por lugar que cita o core: as regras `shared-nao-importa-nucleo-nem-app`, `nucleo-nao-importa-app`, `web-nao-importa-nucleo-nem-backend`, `repository-nao-importa-service-nem-controller` (o `from` e a exceção `expurgo-da-escola`) e `cerca-conta-global` (o `CONTA_GLOBAL` e o `pathNot` do ciclo de vida). Cada uma volta a acusar de menos, ou de mais, na árvore de fixtures `__fixtures__/camadas/packages/core/`.

```mutacao
arquivo: tools/guardas/camadas.cjs
teste: tools/guardas/camadas.test.ts › shared-nao-importa-nucleo-nem-app reprova só o que a fixture marca
-to: { path: '^(?:packages/core|apps)/' },
+to: { path: '^(?:packages/nucleo|apps)/' },
```

```mutacao
arquivo: tools/guardas/camadas.cjs
teste: tools/guardas/camadas.test.ts › nucleo-nao-importa-app reprova só o que a fixture marca
-from: { path: '^packages/core/' },
+from: { path: '^packages/nucleo/' },
```

```mutacao
arquivo: tools/guardas/camadas.cjs
teste: tools/guardas/camadas.test.ts › web-nao-importa-nucleo-nem-backend reprova só o que a fixture marca
-to: { path: '^(?:packages/core/|apps/(?!web/))' },
+to: { path: '^(?:packages/nucleo/|apps/(?!web/))' },
```

```mutacao
arquivo: tools/guardas/camadas.cjs
teste: tools/guardas/camadas.test.ts › repository-nao-importa-service-nem-controller reprova só o que a fixture marca
-path: '^(?:apps/api/src|packages/core/src)/.*\\.repository\\.ts$',
+path: '^(?:apps/api/src|packages/nucleo/src)/.*\\.repository\\.ts$',
```

```mutacao
arquivo: tools/guardas/camadas.cjs
teste: tools/guardas/camadas.test.ts › repository-nao-importa-service-nem-controller reprova só o que a fixture marca
-pathNot: '^packages/core/src/retencao/expurgo-da-escola\\.repository\\.ts$',
+pathNot: '^packages/nucleo/src/retencao/expurgo-da-escola\\.repository\\.ts$',
```

```mutacao
arquivo: tools/guardas/camadas.cjs
teste: tools/guardas/camadas.test.ts › cerca-conta-global reprova só o que a fixture marca
-const CONTA_GLOBAL = String.raw`^packages/core/src/ciclo-de-vida/conta-global\.repository\.ts$`
+const CONTA_GLOBAL = String.raw`^packages/nucleo/src/ciclo-de-vida/conta-global\.repository\.ts$`
```

```mutacao
arquivo: tools/guardas/camadas.cjs
teste: tools/guardas/camadas.test.ts › cerca-conta-global reprova só o que a fixture marca
-from: { path: TODO_O_CODIGO, pathNot: [SESSAO, '^packages/core/src/ciclo-de-vida/', TESTE] },
+from: { path: TODO_O_CODIGO, pathNot: [SESSAO, '^packages/nucleo/src/ciclo-de-vida/', TESTE] },
```

**`arquitetura.test.ts`** (linhas 260, 271 e 1321, forma A). As duas regex de `@educa\/core` com o nome antigo deixam de achar o uso nos casos sintéticos da varredura, e o `USO_DA_ROTINA` com as duas metades no nome antigo (a da 4.0 e a da 5.0) deixa de achar o `CronEscolasRepository` no worker-lote.

```mutacao
arquivo: apps/api/test/arquitetura.test.ts
teste: apps/api/test/arquitetura.test.ts › a varredura pega o uso em qualquer forma, e não confunde variável, comentário nem teste com tabela
-return [...texto.matchAll(/(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"](@educa\/core|[^'"]*schema\/(?:operador|suboperador|incidente)(?:\.js|\.ts)?)['"]/g)].flatMap((importacao) =>
+return [...texto.matchAll(/(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"](@educa\/nucleo|[^'"]*schema\/(?:operador|suboperador|incidente)(?:\.js|\.ts)?)['"]/g)].flatMap((importacao) =>
```

```mutacao
arquivo: apps/api/test/arquitetura.test.ts
teste: apps/api/test/arquitetura.test.ts › a varredura pega o uso em qualquer forma, e não confunde variável ou comentário com tabela
-const namespaces = [...texto.matchAll(/import\s+\*\s+as\s+(\w+)\s+from\s+['"]@educa\/core['"]/g)].map((uso) => uso[1] ?? '')
+const namespaces = [...texto.matchAll(/import\s+\*\s+as\s+(\w+)\s+from\s+['"]@educa\/nucleo['"]/g)].map((uso) => uso[1] ?? '')
```

```mutacao
arquivo: apps/api/test/arquitetura.test.ts
teste: apps/api/test/arquitetura.test.ts › fora dos testes, só o worker-lote usa a lista de escolas da rotina
-const USO_DA_ROTINA = /\bCronEscolasRepository\b|cron-escolas\.repository/
+const USO_DA_ROTINA = /\bEscolasDaRotinaRepository\b|escolas-da-rotina\.repository/
```

**`@educa\/core\/conta-global`** (linha 50, forma C). Nenhum caso alcança essa metade da regex; quem a pega é o `restos`.

```mutacao
arquivo: apps/api/test/arquitetura.test.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-{ classe: 'ContaGlobalRepository', uso: /\bContaGlobalRepository\b|conta-global\.repository|@educa\/core\/conta-global/, zona: ['apps/api/src/sessao/', 'packages/core/src/ciclo-de-vida/'] },
+{ classe: 'ContaGlobalRepository', uso: /\bContaGlobalRepository\b|conta-global\.repository|@educa\/nucleo\/conta-global/, zona: ['apps/api/src/sessao/', 'packages/core/src/ciclo-de-vida/'] },
```

**`tabelas-do-nucleo.test.ts`** (linha 44, forma A). Importando o pacote pelo nome antigo, o caso que lê as tabelas exportadas cai.

```mutacao
arquivo: tools/guardas/tabelas-do-nucleo.test.ts
teste: tools/guardas/tabelas-do-nucleo.test.ts › tem toda tabela que o núcleo exporta
-const nucleo = '@educa/core'
+const nucleo = '@educa/nucleo'
```

**`porta-unica.test.ts`** (linha 57, forma A). Os dois caminhos das linhas 11 e 12 e a regex da linha 49 no nome antigo derrubam os casos que os usam.

```mutacao
arquivo: packages/core/src/auditoria/porta-unica.test.ts
teste: packages/core/src/auditoria/porta-unica.test.ts › a tabela só é importada pelo módulo de inserção e pela leitura
-const MODULO_DA_INSERCAO = 'packages/core/src/auditoria/auditoria-insert.repository.ts'
+const MODULO_DA_INSERCAO = 'packages/nucleo/src/auditoria/insercao-de-auditoria.ts'
```

```mutacao
arquivo: packages/core/src/auditoria/porta-unica.test.ts
teste: packages/core/src/auditoria/porta-unica.test.ts › só o RegistroDeAuditoria importa o módulo de inserção
-const REGISTRO = 'packages/core/src/auditoria/auditoria-recorder.ts'
+const REGISTRO = 'packages/nucleo/src/auditoria/registro-de-auditoria.ts'
```

```mutacao
arquivo: packages/core/src/auditoria/porta-unica.test.ts
teste: packages/core/src/auditoria/porta-unica.test.ts › a varredura de importação pega cada forma de importar e deixa o caminho citado como dado
-const IMPORTA_O_MODULO_DE_INSERCAO = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)(['"`])[^'"`\n]*auditoria-insert[^'"`\n]*\1/
+const IMPORTA_O_MODULO_DE_INSERCAO = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)(['"`])[^'"`\n]*insercao-de-auditoria[^'"`\n]*\1/
```

**`LEITURA`** (linha 38 do `porta-unica.test.ts`, forma C): o `restos`.

```mutacao
arquivo: packages/core/src/auditoria/porta-unica.test.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-const LEITURA = 'packages/core/src/auditoria/auditoria.repository.ts'
+const LEITURA = 'packages/nucleo/src/auditoria/auditoria.repository.ts'
```

**`PASTA_DOS_ADAPTADORES`** (linha 63, forma A). Com o glob antigo, os adaptadores deixam de ser isentos; com um glob largo (`*adapter.ts`), a interface `adapter.ts` passa a ser isenta e deixa de ser acusada.

```mutacao
arquivo: tools/guardas/regras-ia.mjs
teste: tools/guardas/guardas.test.ts › deixa o mesmo código passar dentro dos adaptadores
-export const PASTA_DOS_ADAPTADORES = 'packages/core/src/ia/*-adapter.ts'
+export const PASTA_DOS_ADAPTADORES = 'packages/nucleo/src/ia/adaptador-*.ts'
```

```mutacao
arquivo: tools/guardas/regras-ia.mjs
teste: tools/guardas/guardas.test.ts › reprova import, alias, subcaminho, export, require, import\(\) e typeof import\(\) em
-export const PASTA_DOS_ADAPTADORES = 'packages/core/src/ia/*-adapter.ts'
+export const PASTA_DOS_ADAPTADORES = 'packages/core/src/ia/*adapter.ts'
```

**`caminhos.test.ts` do harness** (linha 64, forma A). Uma das três citações da pasta dos adaptadores — a guarda, a regra 30 ou o `llm-integrator.md` — no nome antigo derruba o caso que as compara.

```mutacao
arquivo: tools/guardas/regras-ia.mjs
teste: tools/processo/harness/caminhos.test.ts › a guarda de SDK de IA, a regra 30 e o llm-integrator citam a mesma pasta dos adaptadores
-export const PASTA_DOS_ADAPTADORES = 'packages/core/src/ia/*-adapter.ts'
+export const PASTA_DOS_ADAPTADORES = 'packages/nucleo/src/ia/adaptador-*.ts'
```

```mutacao
arquivo: .claude/rules/30-camada-ia.md
teste: tools/processo/harness/caminhos.test.ts › a guarda de SDK de IA, a regra 30 e o llm-integrator citam a mesma pasta dos adaptadores
-`packages/core/src/ia/*-adapter.ts` é erro de revisão, sem discussão.
+`packages/nucleo/src/ia/adaptador-*.ts` é erro de revisão, sem discussão.
```

```mutacao
arquivo: .claude/agents/llm-integrator.md
teste: tools/processo/harness/caminhos.test.ts › a guarda de SDK de IA, a regra 30 e o llm-integrator citam a mesma pasta dos adaptadores
-1. Nenhum SDK de provedor fora dos adaptadores, `packages/core/src/ia/*-adapter.ts`.
+1. Nenhum SDK de provedor fora dos adaptadores, `packages/nucleo/src/ia/adaptador-*.ts`.
```

**`entrega.int.test.ts`** (linha 70, forma A). A varredura com a pasta antiga lança ao ler uma pasta que não existe; e uma linha que cita `EntregaRepository` e `.decidir(` em um arquivo de `packages/core/src` acrescenta quem usa o repository que decide.

```mutacao
arquivo: apps/api/src/entrega/entrega.int.test.ts
teste: apps/api/src/entrega/entrega.int.test.ts › fora de teste, só a rota de decidir chega ao repository que decide
-const arquivos = ['apps/api/src', 'apps/worker/src', 'apps/despachante/src', 'packages/core/src'].flatMap((pasta) =>
+const arquivos = ['apps/api/src', 'apps/worker/src', 'apps/despachante/src', 'packages/nucleo/src'].flatMap((pasta) =>
```

```mutacao
arquivo: packages/core/src/ia/__fixtures__/escola-context.ts
teste: apps/api/src/entrega/entrega.int.test.ts › fora de teste, só a rota de decidir chega ao repository que decide
-import { currentContext, runInContext } from '../../context/context.js'
+import { currentContext, runInContext } from '../../context/context.js'
+const DECIDE_FORA_DA_ROTA = 'EntregaRepository.decidir('
```

**`dockerfile.test.ts`** (linha 99, formas A e B). O `COPY packages/core/drizzle` no nome antigo derruba o caso da 111, e o `@educa/core` posto no estágio da web, que a 118 proíbe, derruba o da 118.

```mutacao
arquivo: infra/docker/servico.Dockerfile
teste: tools/ci/dockerfile.test.ts › o que a imagem tinha antes continua: porta, migrations da API e argumento da galeria da web
-COPY packages/core/drizzle packages/core/drizzle
+COPY packages/nucleo/drizzle packages/core/drizzle
```

```mutacao
arquivo: infra/docker/servico.Dockerfile
teste: tools/ci/dockerfile.test.ts › a web não parte do `base`: não constrói o nucleo
-RUN VITE_COM_GALERIA=$VITE_COM_GALERIA npm run build -w @educa/web
+RUN VITE_COM_GALERIA=$VITE_COM_GALERIA npm run build -w @educa/core && npm run build -w @educa/web
```

**Forma C, pelo `restos`** (linhas 85 a 99 e 110). Um bloco por trava que nenhum caso alcança: o caminho do `dist` em `infra/scripts/carga-login.ts` e em `medir-risco-a-vida.ts`, o `db:gerar` e um `-w` do `package.json` da raiz, e as linhas de `borda.test.ts` (78 e 95), `resolucao-do-shared.test.ts` (23) e `caminhos-da-esteira.ts` (7).

```mutacao
arquivo: infra/scripts/carga-login.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-nucleo: await importar('packages/core/dist/index.js'),
+nucleo: await importar('packages/nucleo/dist/index.js'),
```

```mutacao
arquivo: tools/ia/medir-risco-a-vida.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-const nucleo = await importar<NucleoEmDist>('packages/core/dist/index.js')
+const nucleo = await importar<NucleoEmDist>('packages/nucleo/dist/index.js')
```

```mutacao
arquivo: package.json
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-"db:gerar": "drizzle-kit generate --config packages/core/drizzle.config.ts",
+"db:gerar": "drizzle-kit generate --config packages/nucleo/drizzle.config.ts",
```

```mutacao
arquivo: package.json
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-"carga:sala": "npm run -s build -w @educa/shared && npm run -s build -w @educa/core && npm run -s build -w @educa/api && node infra/scripts/carga-sala.ts",
+"carga:sala": "npm run -s build -w @educa/shared && npm run -s build -w @educa/nucleo && npm run -s build -w @educa/api && node infra/scripts/carga-sala.ts",
```

```mutacao
arquivo: tools/ci/borda.test.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-const ociosidade = /export const OCIOSIDADE_HTTP_MS = ([\d_]+)/.exec(lerArquivo('packages/core/src/runtime/graceful-shutdown.ts'))
+const ociosidade = /export const OCIOSIDADE_HTTP_MS = ([\d_]+)/.exec(lerArquivo('packages/nucleo/src/runtime/graceful-shutdown.ts'))
```

```mutacao
arquivo: tools/ci/borda.test.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-const daApi = /export const DEFAULT_RETRY_AFTER_SECONDS = (\d+)/.exec(lerArquivo('packages/core/src/error/domain.exception.ts'))?.[1]
+const daApi = /export const DEFAULT_RETRY_AFTER_SECONDS = (\d+)/.exec(lerArquivo('packages/nucleo/src/error/domain.exception.ts'))?.[1]
```

```mutacao
arquivo: tools/ci/resolucao-do-shared.test.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-const origem = join(raizRepositorio, 'packages/core/src/context/context.ts')
+const origem = join(raizRepositorio, 'packages/nucleo/src/context/context.ts')
```

```mutacao
arquivo: tools/ci/caminhos-da-esteira.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-'packages/core/src/x.ts',
+'packages/nucleo/src/x.ts',
```

**Forma C, pelo `restos`, os achados da 5.0** (`travas.md`, "Achadas na 5.0"). O `drizzle.config.ts`, o comentário do `compose.yml`, o `-w` do Dockerfile, o URL fabricado de `golden.test.ts`, o caminho de `medir-risco-a-vida.test.ts`, a fixture `filtros/knip.json`, o `toEqual` de `guardas.test.ts` e o exemplo de `linhas.test.ts`.

```mutacao
arquivo: packages/core/drizzle.config.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-schema: './packages/core/src/db/schema/*.ts',
+schema: './packages/nucleo/src/db/schema/*.ts',
```

```mutacao
arquivo: infra/compose.yml
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-# lock em 5 s, com 3 tentativas (packages/core/src/db/migrate.ts). Mesma imagem da API.
+# lock em 5 s, com 3 tentativas (packages/nucleo/src/db/migrate.ts). Mesma imagem da API.
```

```mutacao
arquivo: infra/docker/servico.Dockerfile
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-RUN npm run build -w @educa/shared && npm run build -w @educa/core
+RUN npm run build -w @educa/shared && npm run build -w @educa/nucleo
```

```mutacao
arquivo: packages/core/src/ia/golden.test.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-expect(raizDoOuro('file:///fabricada/packages/core/src/ia/__fixtures__/golden.ts')).toBe('/fabricada/docs/aia/ouro')
+expect(raizDoOuro('file:///fabricada/packages/nucleo/src/ia/__fixtures__/golden.ts')).toBe('/fabricada/docs/aia/ouro')
```

```mutacao
arquivo: tools/ia/medir-risco-a-vida.test.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-const pasta = '../../packages/core/src/ia/'
+const pasta = '../../packages/nucleo/src/ia/'
```

```mutacao
arquivo: tools/guardas/__fixtures__/filtros/knip.json
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-"packages/core": {
+"packages/nucleo": {
```

```mutacao
arquivo: tools/guardas/guardas.test.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-{ files: ['packages/core/src/log/logger.test.ts'], regras: REGRAS_DE_LOG },
+{ files: ['packages/nucleo/src/log/logger.test.ts'], regras: REGRAS_DE_LOG },
```

```mutacao
arquivo: tools/processo/linhas.test.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-expect(porQueNaoJuntas({ ...a, arquivos: ['packages/core/drizzle/0037_a.sql'] }, b)).toBeNull()
+expect(porQueNaoJuntas({ ...a, arquivos: ['packages/nucleo/drizzle/0037_a.sql'] }, b)).toBeNull()
```

**Forma C, pela trava contra filtro vazio** (`filtros-casam.test.ts`). O workspace `packages/core` do `knip.json` e a exceção de log do `index.mjs` com a pasta antiga não casam com nenhum arquivo.

```mutacao
arquivo: tools/guardas/index.mjs
teste: tools/guardas/filtros-casam.test.ts › EXCECOES_DAS_GUARDAS: cada item casa com um arquivo
-files: ['packages/core/src/log/logger.test.ts'],
+files: ['packages/nucleo/src/log/logger.test.ts'],
```

```mutacao
arquivo: knip.json
teste: tools/guardas/filtros-casam.test.ts › knip.json, workspaces: cada item casa com um arquivo
-"packages/core": {
+"packages/nucleo": {
```

**Sem bloco, com o motivo.**

- `vaga.lua` → `concurrency-slot.lua` (`travas.md`, linha 87): o `readFileSync` roda no carregamento do módulo, então o erro é de carga e o portão o recusa; o `restos` não enxerga nome solto (a mutação dele ficou verde); e o `jobs.int.test.ts` sobe a pilha com `--build` e cai no `beforeAll`. A prova é o `npm run build` e o job `infra` da esteira.
- A metade do caminho do `USO_DA_ROTINA` (`cron-escolas\.repository`, linha 110): o `restos` também não a enxerga, e o caso da rotina a cobre pela outra metade (`CronEscolasRepository`). O bloco acima devolve as duas metades juntas.
- `paths:` das regras (linha 89) e `eslint.config.mjs` (linha 96): nenhum dos dois cita `packages/nucleo`. As regras dizem `packages/*/src/ia/**`, e o `eslint.config.mjs`, só `apps/`. Sem diff, sem trava nova.
- `eslint-suppressions.json` (linha 95): a trava é o `npm run lint`, que não é caso de Vitest; ele passou verde sem supressão órfã.
- O `--faltando` lista 1246 linhas em 118 arquivos: são linhas que já existiam em `packages/nucleo/`, `apps/` e `tools/` e que o git conta como novas pelo move. O rename não acrescenta condição.

## Recomendações sem aplicar

Rodada 1 (`.processo/ordens/5_task-r1.md`):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (1ª) | Um bloco por linha para `packages/core/src/log/nest-logger.ts` (`EXCECOES_DAS_GUARDAS`) e para as outras quatro entradas de `REPOSITORIES_SEM_ESCOPO` | Recusada: o próprio revisor diz que são "cobertas pelo mesmo caso" de outro bloco; o bloco novo repetiria a mesma prova |
| test-engineer (1ª) | Pôr no procedimento de cada onda uma busca do nome antigo no `package-lock.json` | Arquiteto: `tasks.md`, "O procedimento de cada onda", antes da 6.0. O Implementador não edita `tasks.md` |
| revisor-geral (1ª) | `techspec.md:198`: a premissa do lock ainda está "NÃO VERIFICADO" | Arquiteto: o `techspec.md` é dele. Marcar como verificada depois do item 1 |
| revisor-geral (1ª) | Comentários que ainda dizem `src/db/migrar.ts` (`packages/core/drizzle.config.ts:4`) e `db/banco.ts` (`packages/core/src/db/schema/mvp/tables.ts:22`) | `TODO.md`: são nomes de arquivo renomeados nas ondas 3 e 4, em comentário, e o `restos` não pega caminho parcial. Fora do que a 5.0 renomeia |
| revisor-geral, infra-guardian, tenancy-guardian (1ª) | Título de caso com o nome antigo: `tools/guardas/guardas.test.ts:454` ("packages/nucleo/src") e `apps/api/test/arquitetura.test.ts:120` ("barrel do @educa/nucleo") | `TODO.md`: texto de título, sem efeito em trava; o do `arquitetura.test.ts:120` o test-engineer registra como exceção do mapa (`5.json:823`) |
| infra-guardian, llm-integrator, conformidade-reviewer, revisor-geral, tenancy-guardian (1ª) | `README.md` da raiz (linhas 42 e 79) cita `packages/nucleo/drizzle` e `packages/nucleo/src/db/schema` | 13.0 (`tasks.md:31`, "os README"). O arquivo não está nos "Arquivos previstos" da 5.0 |
| llm-integrator, conformidade-reviewer, test-engineer, revisor-geral, tenancy-guardian (1ª) | `packages/core/src/ia/README.md:8` ainda importa de `'@educa/nucleo'` | 13.0 (`tasks.md:31`, "os README"); o test-engineer também a registra para a 13.0 |
| tenancy-guardian (1ª) | `docs/guia-do-desenvolvedor.md:76` cita `nucleo/src/contexto/contexto.ts` | 13.0 (`techspec.md:126`, "o guia, com a §9 reescrita"). Registre o resultado da busca da 5.4 em `docs/` |
| infra-guardian, conformidade-reviewer (1ª) | `TODO.md` (oito linhas) e `ROADMAP.md:360` citam `packages/nucleo` | Arquiteto: documentos de planejamento, fora dos "Arquivos previstos" da 5.0 |
| conformidade-reviewer, llm-integrator, infra-guardian, revisor-geral (1ª) | `docs/aia/ouro/README.md:20` e `:126` apontam para `ouro.ts` e `amostras-do-assistente-revisao.ts` | Correção do Arquiteto depois da onda: o ouro está em "Fora do escopo desta tarefa" e em `travas.md`, "O ouro" |
| tenancy-guardian (1ª) | `REPOSITORIES_SEM_ESCOPO` ainda lista nomes de método em português (`inserir`, `buscarDaEscola`) | A onda que renomeia os métodos: a lista tem de acompanhar, senão a guarda acusa "método inexistente" |
| infra-guardian (1ª) | `packages/core/dist` local guarda pastas do build anterior | Recusada: `dist` não vai ao git e a imagem Docker constrói do zero; o `infra-guardian` aprovou |
| infra-guardian (1ª) | `PASTA_DOS_ADAPTADORES` virou `*-adapter.ts`, e os `*.test.ts` dos adaptadores saem da exceção do SDK | Sem ação: a regra ficou mais estrita, o `llm-integrator` (1ª) conferiu e aprovou, e o lint passa |

Rodada 2 (`.processo/ordens/5_task-r2.md`):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (2ª) | Na 5.4, a tabela de testes diz "mais os achados da 5.0" sem nomear os blocos | Recusada: a seção "Mutações" lista os blocos um a um; nenhum bloco falta |
| test-engineer, revisor-geral, privacy-guardian (2ª) | O relatório ao Orquestrador diz se o `aplicar` recalcula o `include` de outros `tsconfig` movidos (6.0), e deixa `"extraneous": true` no lock de cada workspace movido | O relatório do Implementador ao Orquestrador, antes da 6.0 |
| test-engineer, revisor-geral (2ª) | A busca do nome antigo no `package-lock.json` entra no procedimento de cada onda; `techspec.md:198` passa a "verificada" | Arquiteto: `tasks.md` e `techspec.md` (já em `5_task-r1.md`) |
| llm-integrator (2ª) | `packages/core/src/ia/README.md:8` importa de `'@educa/nucleo'` | 13.0 (já em `5_task-r1.md`) |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-31 01:14:23 | 2026-10-31 01:16:30 | `infra-guardian` | 1 | APROVADO | a46f7b14f02f5127d |
| 2026-10-31 01:14:19 | 2026-10-31 01:16:41 | `conformidade-reviewer` | 1 | APROVADO | ad01e62ca3daa3e30 |
| 2026-10-31 01:14:15 | 2026-10-31 01:16:52 | `privacy-guardian` | 1 | APROVADO | aaa92ae10edad5503 |
| 2026-10-31 01:14:26 | 2026-10-31 01:17:29 | `llm-integrator` | 1 | APROVADO | a619d2fd843bd193c |
| 2026-10-31 01:14:30 | 2026-10-31 01:18:13 | `test-engineer` | 1 | REPROVADO | a54d6162d4941f63a |
| 2026-10-31 01:14:34 | 2026-10-31 01:18:38 | `revisor-geral` | 1 | APROVADO | adc8b87a2d49e6129 |
| 2026-10-31 01:14:12 | 2026-10-31 01:43:29 | `tenancy-guardian` | 1 | APROVADO | a8e8259fb1d163b2f |
| 2026-10-31 02:16:22 | 2026-10-31 02:16:36 | `tenancy-guardian` | 2 | APROVADO | a1175adda2ba53aa8 |
| 2026-10-31 02:16:27 | 2026-10-31 02:16:47 | `privacy-guardian` | 2 | APROVADO | ab359712f0128f720 |
| 2026-10-31 02:16:42 | 2026-10-31 02:16:56 | `llm-integrator` | 2 | APROVADO | a61d76e01b11313ea |
| 2026-10-31 02:16:37 | 2026-10-31 02:16:59 | `infra-guardian` | 2 | APROVADO | a6162b8f763a3a2da |
| 2026-10-31 02:16:32 | 2026-10-31 02:17:00 | `conformidade-reviewer` | 2 | APROVADO | a9751b285505daf2f |
| 2026-10-31 02:16:49 | 2026-10-31 02:17:17 | `test-engineer` | 2 | APROVADO | aed37f3c788ec6ea6 |
| 2026-10-31 02:16:54 | 2026-10-31 02:17:26 | `revisor-geral` | 2 | APROVADO | a41f7abbdfc3cb5e5 |
