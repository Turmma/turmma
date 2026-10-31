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

- [x] 6.1 — O mapa `tools/renomear/mapas/6.json`. O rename só de caixa passa pelo nome intermediário
- [x] 6.2 — O `aplicar` e a classificação. `ARQUIVO_DO_SANDBOX` é nome solto, e vai à mão
- [x] 6.3 — As travas do `travas.md` com 6.0:
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
- [x] 6.4 — As provas:
  - o `conferir`, o `restos` e o lint sem supressão órfã;
  - a árvore igual num checkout limpo;
  - a busca dos nomes antigos em `apps/web/src`, `e2e/` e `docs/`. Depois da rodada 1 (ordem `.processo/ordens/6_task-r1.md`, item 5), pelas formas parciais:
    `git grep -nE "componentes/|ui/ia/|ui/campos/|ui/icones/|ui/sobrepostos/|galeria/|secoes/|paginas/|processadores/|rotas\.tsx|estilos\.css|Galeria\.tsx" -- . ':!docs/decisoes.md' ':!docs/aia/ouro' ':!docs/aia/ouro-retido' ':!tasks' ':!mockups' ':!tools/renomear' ':!apps/web/src/estilos.test.ts'`
    e `git grep -n "__fixtures__/" -- e2e tools/ci`, mais a busca do nome de arquivo do mapa sem a pasta-mãe (`basename` de cada `de` que já não existe na árvore), em comentário e em documento.
    O que a busca achou foi trocado pelo caminho novo: comentários e documentos de `apps/`, `e2e/`, `tools/`, `packages/`, `docs/`, `.claude/`, `README.md`, `ROADMAP.md` e `TODO.md`. O que sobra é só o que o RF7 manda manter: título de `describe`/`it` (`chunk-names.test.ts:127,145`, `casca-sem-import.test.ts:59`, `avatar-so-nas-duas-pecas.test.ts:53`, `Gallery.test.tsx:65`, `guardioes.test.ts:103,116,128`, `codigo-do-autenticador.test.ts:20`, `playwright.test.ts:56`); o caminho virtual de fixture (`paginas/Fixture.tsx` e `paginas/Nova.tsx` em `estilos.test.ts`); a frase histórica de `docs/mvp-rapido.md:323` ("moravam em `componentes/*` até a X5"); e a URL `/v1/sessao/externa/`, que é rota da API e não muda. Depois, `restos`: limpo; `conferir`: verde.
- [x] 6.5 — Os blocos de mutação

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
| `packages/core/src/ciclo-de-vida/conta-global.repository.ts`, `packages/core/src/identidade/operacao-markers.ts`, `packages/core/src/identidade/route-without-sessao.test.ts`, `packages/core/src/queue/synthetic-effect.repository.ts` | alterado (só comentário com caminho movido) |
| `packages/shared/src/privacidade/classificacao.ts` | alterado (só comentário) |
| `tools/vitrine/escola.ts` | alterado (import e comentário de `e2e/__fixtures__/`) |
| `README.md`, `ROADMAP.md`, `TODO.md` | alterado (só caminho movido, em texto de documento) |

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

- 2026-10-31, Arquiteto: previstos sem os comentários de caminho em `packages/core` e `packages/shared` e sem `tools/vitrine/escola.ts` (Tech Spec §5, passos 3 e 5); entram nomeados (triagem do Arquiteto, 31/10). Detalhe não previsto.
- 2026-10-31, Arquiteto: `inventario-back.md:153` fora do mapa: a §2.20 do inventário fecha a dúvida (`artefato/conferencia.ts` fica).

## Mutações

Um bloco por trava (Tech Spec §10), na forma da coluna do `travas.md`. Em toda forma A, a mutação devolve a trava ao nome antigo e um caso que já existe fica vermelho. Nenhum caso entra (RF7). Na forma C, o teste citado é o que a coluna cita: a trava contra filtro vazio (`filtros-casam.test.ts`), o `restos` ou o `jobs.int.test.ts`. `correcao.int.test.ts` (linha 71) fica sem bloco: a onda não renomeia `correcao/correcao.service.ts` nem `correcao/lote.controller.ts`, que são de domínio (a coluna diz `fica`).

**`camadas.cjs`, `cerca-resolucao-de-tenant`** (linha 38, forma A e C). Com o `to.path` no nome antigo, a cerca olha um arquivo que a fixture e o repositório não têm mais: a violação marcada some, e o alvo some do grafo.

```mutacao
arquivo: tools/guardas/camadas.cjs
teste: tools/guardas/camadas.test.ts › cerca-resolucao-de-tenant reprova só o que a fixture marca
-to: { path: `${SESSAO}tenant/tenant-resolution\\.repository\\.ts$` },
+to: { path: `${SESSAO}tenant/resolucao-de-tenant\\.repository\\.ts$` },
```

```mutacao
arquivo: tools/guardas/camadas.cjs
teste: tools/guardas/camadas.test.ts › real: todo alvo de regra existe no grafo
-to: { path: `${SESSAO}tenant/tenant-resolution\\.repository\\.ts$` },
+to: { path: `${SESSAO}tenant/resolucao-de-tenant\\.repository\\.ts$` },
```

**`guardioes-por-caminho.ts`** (linhas 41 e 134, forma A). Com o prefixo de `ui/ai/` no nome antigo, a pasta volta a pedir só `C I`; com `gallery/`, `index.css` ou `chunk-names.ts` no nome antigo, a exceção casa arquivo nenhum e vira exceção morta.

```mutacao
arquivo: tools/processo/guardioes-por-caminho.ts
teste: tools/processo/harness/guardioes.test.ts › vale o prefixo mais longo
-{ prefixo: 'apps/web/src/components/ui/ai/', guardioes: [P, C, I] },
+{ prefixo: 'apps/web/src/componentes/ui/ia/', guardioes: [P, C, I] },
```

```mutacao
arquivo: tools/processo/guardioes-por-caminho.ts
teste: tools/processo/harness/guardioes.test.ts › cada exceção casa ao menos um arquivo versionado
-{ prefixo: 'apps/web/src/gallery/', guardioes: [P, C] },
+{ prefixo: 'apps/web/src/galeria/', guardioes: [P, C] },
```

```mutacao
arquivo: tools/processo/guardioes-por-caminho.ts
teste: tools/processo/harness/guardioes.test.ts › cada exceção casa ao menos um arquivo versionado
-{ prefixo: 'apps/web/src/index.css', guardioes: [C] },
+{ prefixo: 'apps/web/src/estilos.css', guardioes: [C] },
```

```mutacao
arquivo: tools/processo/guardioes-por-caminho.ts
teste: tools/processo/harness/guardioes.test.ts › cada exceção casa ao menos um arquivo versionado
-{ prefixo: 'apps/web/chunk-names.ts', guardioes: [I] },
+{ prefixo: 'apps/web/nome-dos-chunks.ts', guardioes: [I] },
```

**`assistente.int.test.ts`** (linha 72, forma A). **Prova de sanidade, e não de nome antigo:** a lista exata dos arquivos que tocam `mensagemAgente` não mudou de nome nesta onda, e por isso não há nome antigo a devolver. O bloco prova que ela continua exata: sem o repository do titular na lista, a varredura acusa o arquivo que sobra.

```mutacao
arquivo: apps/api/src/assistente/assistente.int.test.ts
teste: apps/api/src/assistente/assistente.int.test.ts › fora de teste, só o repository da conversa
-expect(tocam).toEqual(['apps/api/src/assistente/conversa.repository.ts', 'apps/api/src/ia/execucao.repository.ts', 'apps/api/src/privacidade/titulares.repository.ts'])
+expect(tocam).toEqual(['apps/api/src/assistente/conversa.repository.ts', 'apps/api/src/privacidade/titulares.repository.ts'])
```

**`avatar-so-nas-duas-pecas.test.ts`** (forma A). Com `galeria/` no nome antigo, o arquivo da pasta nova que importa o avatar deixa de ser acusado.

```mutacao
arquivo: apps/web/src/components/ui/ai/avatar-so-nas-duas-pecas.test.ts
teste: apps/web/src/components/ui/ai/avatar-so-nas-duas-pecas.test.ts › as telas e a galeria que mostram a onça
-for (const tela of ['areas/coordenacao/governanca/Agentes.tsx', 'areas/coordenacao/governanca/Analista.tsx', 'gallery/sections/marca-onca.tsx']) expect(daAssinatura, tela).toContain(tela)
+for (const tela of ['areas/coordenacao/governanca/Agentes.tsx', 'areas/coordenacao/governanca/Analista.tsx', 'galeria/secoes/marca-onca.tsx']) expect(daAssinatura, tela).toContain(tela)
```

**`ARQUIVO_DO_SANDBOX`** (linha 88, forma C). Com o `.js` do sandbox no nome antigo, o worker não acha o arquivo na imagem e o `jobs.int.test.ts` quebra alto.

```mutacao
arquivo: apps/worker/src/processors/synthetic.ts
teste: infra/test/jobs.int.test.ts
-export const ARQUIVO_DO_SANDBOX = new URL(import.meta.url.endsWith('.ts') ? './synthetic.sandbox.ts' : './synthetic.sandbox.js', import.meta.url)
+export const ARQUIVO_DO_SANDBOX = new URL(import.meta.url.endsWith('.ts') ? './synthetic.sandbox.ts' : './sintetico.sandbox.js', import.meta.url)
```

**`eslint.config.mjs`** (linhas 72 e 116, forma C). Com o `files` no nome antigo, o filtro não casa arquivo nenhum e a trava contra filtro vazio acusa.

```mutacao
arquivo: eslint.config.mjs
teste: tools/guardas/filtros-casam.test.ts › eslint.config.mjs, files: cada item casa com um arquivo
-files: ['apps/worker/src/processors/**/*.ts'],
+files: ['apps/worker/src/processadores/**/*.ts'],
```

```mutacao
arquivo: eslint.config.mjs
teste: tools/guardas/filtros-casam.test.ts › eslint.config.mjs, files: cada item casa com um arquivo
-files: ['apps/web/src/components/ui/**/*.{ts,tsx}'],
+files: ['apps/web/src/componentes/ui/**/*.{ts,tsx}'],
```

**`knip.json`** (linha 145, forma C). Com a entry no nome antigo, ela não casa arquivo e a trava acusa.

```mutacao
arquivo: knip.json
teste: tools/guardas/filtros-casam.test.ts › knip.json, entries: cada item casa com um arquivo
-"src/index.css"
+"src/estilos.css"
```

**`guardas.test.ts:159`** (forma A). Com o caminho virtual no nome antigo, o `files` do kit não o alcança e o import proibido passa.

```mutacao
arquivo: tools/guardas/guardas.test.ts
teste: tools/guardas/guardas.test.ts › reprova import, import type
-const NO_KIT = 'apps/web/src/components/ui/x.tsx'
+const NO_KIT = 'apps/web/src/componentes/ui/x.tsx'
```

**`mutacoes.ts`** (linhas 681 e 696, forma A). O `e2e/support/` não é `apps/` nem `packages/`; se a reconstrução passasse a alcançá-lo, a mutação de fixture do e2e reconstruiria a web sem precisar.

```mutacao
arquivo: tools/processo/mutacoes.ts
teste: tools/processo/mutacoes.test.ts › mutação de fonte provada por e2e reconstrói a web
-return tipoDoTeste(mutacao.teste) === 'e2e' && /^(apps|packages)\//.test(mutacao.arquivo)
+return tipoDoTeste(mutacao.teste) === 'e2e' && /^(apps|packages|e2e)\//.test(mutacao.arquivo)
```

**`chunk-names.ts`** (linha 101, forma A). Com a fachada da área no nome antigo, `routes.tsx` deixa de ser fachada, e com a peça no nome antigo a lista cita um arquivo que não existe.

```mutacao
arquivo: apps/web/chunk-names.ts
teste: apps/web/chunk-names.test.ts › o chunk que sai de src/areas/<papel>/ leva o nome da pasta
-return new RegExp(`${PASTA_DAS_AREAS}${area}/routes\\.tsx?$`).test(idDoModulo.replaceAll('\\', '/').replace(/[?#].*$/, ''))
+return new RegExp(`${PASTA_DAS_AREAS}${area}/rotas\\.tsx?$`).test(idDoModulo.replaceAll('\\', '/').replace(/[?#].*$/, ''))
```

```mutacao
arquivo: apps/web/chunk-names.ts
teste: apps/web/chunk-names.test.ts › o tamanho da letra
-'settings/TamanhoDaLetra',
+'ajustes/TamanhoDaLetra',
```

**`architecture.test.ts`** (linha 1404, forma A). A regex do `login.service` sem o `(?<![\w-])` casa o `external-login.service` e a varredura acusa um importador a mais. O `ZONAS` (linha 49) tem o bloco próprio, mais abaixo.

```mutacao
arquivo: apps/api/test/architecture.test.ts
teste: apps/api/test/architecture.test.ts › fora de teste, só o login-email.controller.ts e o sessao.module.ts o importam
-const IMPORTA_O_LOGIN_SERVICE = /(?<![\w-])login\.service\.js['"]/
+const IMPORTA_O_LOGIN_SERVICE = /\blogin\.service\.js['"]/
```

**`escola.repository.test.ts`** (linha 143, forma A). Com a bancada no nome antigo, o importador que existe fica fora da lista e a varredura acusa.

```mutacao
arquivo: apps/api/src/operacao/escola/escola.repository.test.ts
teste: apps/api/src/operacao/escola/escola.repository.test.ts › fora de teste, só o painel da operação
-'apps/api/test/sessao.fixture.ts',
+'apps/api/test/sessao-de-teste.ts',
```

**`playwright.test.ts`** (linha 136, forma A). Com o import do `perfis` no nome antigo, o caso que exige o `test` com perfil não acha o spec.

```mutacao
arquivo: tools/ci/playwright.test.ts
teste: tools/ci/playwright.test.ts › todo spec usa o test com perfil
-expect(texto, spec).toMatch(/import \{[^}]*\btest\b[^}]*\} from '\.\/support\/profiles\.ts'/)
+expect(texto, spec).toMatch(/import \{[^}]*\btest\b[^}]*\} from '\.\/__fixtures__\/perfis\.ts'/)
```

**`camadas.cjs` (exceção do `sessao`)** (linha 137, forma A). Com o teste de arquitetura no nome antigo, o `architecture.test.ts` deixa de estar na lista e importa `sessao/` sem o `index`.

```mutacao
arquivo: tools/guardas/camadas.cjs
teste: tools/guardas/camadas.test.ts › real: zero violações e zero ciclos
-'apps/api/test/architecture.test.ts',
-]),
-soPeloIndex('credencial'
+'apps/api/test/arquitetura.test.ts',
+]),
+soPeloIndex('credencial'
```

**`.size-limit.json` e `infra/test/{carga,expurgo-da-carga}.test.ts`** (linhas 144 e 146, forma C). O nome antigo nos rótulos e nas strings é resto do mapa.

```mutacao
arquivo: infra/test/carga.test.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-const tetoPorUsuario = Number(/export const TETO_DE_PEDIDOS_DE_IA_POR_USUARIO = (\d+)/.exec(lerArquivo('apps/api/src/assistente/ai-request-rate-limit.ts'))?.[1])
+const tetoPorUsuario = Number(/export const TETO_DE_PEDIDOS_DE_IA_POR_USUARIO = (\d+)/.exec(lerArquivo('apps/api/src/assistente/limite-de-pedidos-de-ia.ts'))?.[1])
```

**Exemplos e leituras por caminho** (linhas 135, 141 e 142, forma C). O nome antigo em um exemplo de teste, em uma leitura do fixture do e2e e na pasta do CSV é resto do mapa, e o `restos` o acusa.

```mutacao
arquivo: tools/processo/revisoes.test.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-arquivo = 'apps/worker/src/job-executor.ts',
+arquivo = 'apps/worker/src/executor.ts',
```

```mutacao
arquivo: apps/web/src/areas/aluno/introducao/textos-da-introducao.test.ts
teste: apps/web/src/areas/aluno/introducao/textos-da-introducao.test.ts › a lista `FALAS_DA_INTRODUCAO_DO_ALUNO` do e2e é a das falas dos passos
-const fonte = readFileSync(join(import.meta.dirname, '..', '..', '..', '..', '..', '..', 'e2e', 'support', 'casca.ts'), 'utf8')
+const fonte = readFileSync(join(import.meta.dirname, '..', '..', '..', '..', '..', '..', 'e2e', '__fixtures__', 'casca.ts'), 'utf8')
```

```mutacao
arquivo: e2e/estrutura.spec.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-const ARQUIVO_DO_EXCEL = 'e2e/support/lista-excel.csv'
+const ARQUIVO_DO_EXCEL = 'e2e/__fixtures__/lista-excel.csv'
```

**`architecture.test.ts`, `ZONAS_DAS_CLASSES_CERCADAS`** (linha 49, forma C). O `restos` não vê a regex (o caminho dela vai sem a pasta-mãe `tenant/`); o bloco prova a metade do caminho: sem o nome da classe e com o caminho antigo, nenhum arquivo de `sessao/` casa e a varredura "acha as três classes dentro da zona delas" fica vermelha.

```mutacao
arquivo: apps/api/test/architecture.test.ts
teste: apps/api/test/architecture.test.ts › a varredura enxerga o código: acha as três classes dentro da zona delas
-{ classe: 'ResolucaoDeTenantRepository', uso: /\bResolucaoDeTenantRepository\b|tenant-resolution\.repository/, zona: ['apps/api/src/sessao/'] },
+{ classe: 'ResolucaoDeTenantRepository', uso: /resolucao-de-tenant\.repository/, zona: ['apps/api/src/sessao/'] },
```

**`infra/scripts` (o `dist`)** (linha 74 da tabela, forma C). Cada um dos três scripts escreve o `dist` do arquivo movido; o nome antigo em qualquer um é resto do mapa.

```mutacao
arquivo: infra/scripts/carga-login.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-sessoes: await importar('apps/api/dist/sessao/tenant/synthetic-sessions.js'),
+sessoes: await importar('apps/api/dist/sessao/tenant/sessoes-sinteticas.js'),
```

```mutacao
arquivo: infra/scripts/carga-sala.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-sessoes: await importar('apps/api/dist/sessao/tenant/synthetic-sessions.js'),
+sessoes: await importar('apps/api/dist/sessao/tenant/sessoes-sinteticas.js'),
```

```mutacao
arquivo: infra/scripts/ensaio-alertas.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-const sessoes = await importar<{ criarSessoesSinteticas: typeof criarSessoesSinteticas; emissorDeTokenSintetico: typeof emissorDeTokenSintetico }>('apps/api/dist/sessao/tenant/synthetic-sessions.js')
+const sessoes = await importar<{ criarSessoesSinteticas: typeof criarSessoesSinteticas; emissorDeTokenSintetico: typeof emissorDeTokenSintetico }>('apps/api/dist/sessao/tenant/sessoes-sinteticas.js')
```

**`architecture.test.ts`, `QUEM_USA_A_ROTINA`** (linha 1336, forma A). Com o processador no nome antigo, a lista cita um arquivo que não existe e o `existsSync` do caso acusa.

```mutacao
arquivo: apps/api/test/architecture.test.ts
teste: apps/api/test/architecture.test.ts › fora dos testes, só o worker-lote usa a lista de escolas da rotina
-'apps/worker/src/processors/expurgar-dado-pessoal.ts',
+'apps/worker/src/processadores/expurgar-dado-pessoal.ts',
```

**`casca-sem-import.test.ts`, `perigo-cheio.test.ts` e `estilos.test.ts`** (trava 140, forma A). Na regex `(?:ai|onca)` o `ai/` solto não é `pasta-mãe/nome`, e o `restos` não o vê; com ele no nome antigo, o detector deixa passar a pasta e o caso acusa. As listas fechadas de `perigo-cheio` e de `estilos` citam arquivo que deixa de existir.

```mutacao
arquivo: apps/web/src/components/casca-sem-import.test.ts
teste: apps/web/src/components/casca-sem-import.test.ts › o detector reprova a peça e a pasta por caminho relativo
-if (/(?:^|\/)(?:ai|onca)\//.test(resolvido)) return 'pasta fora da entrada'
+if (/(?:^|\/)(?:ia|onca)\//.test(resolvido)) return 'pasta fora da entrada'
```

```mutacao
arquivo: apps/web/src/components/perigo-cheio.test.ts
teste: apps/web/src/components/perigo-cheio.test.ts › os arquivos que o escrevem são os da lista fechada
-'components/ui/button-variants.ts': 'a definição: a constante e a variante `perigo` com `cheio`',
+'componentes/ui/button-variants.ts': 'a definição: a constante e a variante `perigo` com `cheio`',
```

```mutacao
arquivo: apps/web/src/estilos.test.ts
teste: apps/web/src/estilos.test.ts › a cor escrita à mão é de duas peças só
-const ARQUIVOS_COM_COR_EM_LINHA = ['components/CodigoQr.tsx', 'components/ui/onca/CabecaOnca.tsx']
+const ARQUIVOS_COM_COR_EM_LINHA = ['componentes/CodigoQr.tsx', 'components/ui/onca/CabecaOnca.tsx']
```

**Travas de texto** (linhas 95, 138 e 146 do `travas.md`, e o comentário de `infra/compose.yml:381`, forma C). São caminhos escritos como texto em exemplo de teste, em chave de JSON e em comentário; o nome antigo em qualquer um é resto do mapa, e o `restos` o acusa. A 95 também fica sem supressão órfã no lint do portão.

```mutacao
arquivo: tools/guardas/guardas.test.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-...['apps/api/src/main.ts', 'apps/web/src/pages/Casca.tsx', 'tools/ci/verificar.ts'].flatMap((caminho): [string, string, number][] => [
+...['apps/api/src/main.ts', 'apps/web/src/paginas/Casca.tsx', 'tools/ci/verificar.ts'].flatMap((caminho): [string, string, number][] => [
```

```mutacao
arquivo: tools/guardas/tamanho-das-pastas.test.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-expect(todos).toContain('apps/web/src/areas/professor/routes.tsx')
+expect(todos).toContain('apps/web/src/areas/professor/rotas.tsx')
```

```mutacao
arquivo: .size-limit.json
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-"name": "JS de entrada da web (o chunk index-*.js, sozinho). O primeiro carregamento inteiro — a entrada e os pedaços que ela importa estaticamente, nada além — tem teto de 150 kB no teste do build de verdade (apps/web/chunk-names.test.ts), porque um glob não sabe quem importa quem; no MVP de apresentação, com as áreas do professor e do aluno, perto de 127 kB",
+"name": "JS de entrada da web (o chunk index-*.js, sozinho). O primeiro carregamento inteiro — a entrada e os pedaços que ela importa estaticamente, nada além — tem teto de 150 kB no teste do build de verdade (apps/web/nome-dos-chunks.test.ts), porque um glob não sabe quem importa quem; no MVP de apresentação, com as áreas do professor e do aluno, perto de 127 kB",
```

```mutacao
arquivo: eslint-suppressions.json
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-"apps/web/src/components/CascaDaEscola.tsx": {
+"apps/web/src/componentes/CascaDaEscola.tsx": {
```

```mutacao
arquivo: infra/compose.yml
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-# Docker só manda SIGKILL depois dela. Um teste liga os dois (`apps/worker/src/shutdown.test.ts`).
+# Docker só manda SIGKILL depois dela. Um teste liga os dois (`apps/worker/src/desligamento.test.ts`).
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| Implementador (antes da 1ª) | `correcao.int.test.ts` (`travas.md:71`) | `fica`: a onda não renomeia `correcao/correcao.service.ts` nem `correcao/lote.controller.ts`, e a coluna diz `fica` nesse caso |
| Implementador (antes da 1ª) | Fixture `tools/guardas/__fixtures__/kit-importa-api.ts` e `guardas.test.ts:192` | `fica` com a linha `inventario-web-e2e.md:557`: os especificadores `../../../api/cliente` e `../../../sessao/inatividade` não resolvem a arquivo nenhum, o `conferir` não aceita exceção a especificador e o `restos` aceita `fica`. Não há linha de "Não muda, mas parece" para ela; fica para o Arquiteto decidir se vale uma |
| tenancy-guardian (1ª) | Alinhar a chave `cerca-resolucao-de-tenant` (`camadas.cjs:147`, `camadas.test.ts:142`) ao símbolo `ResolucaoDeTenantRepository` | Símbolo: é da 7.0, que renomeia a classe; mudar a chave agora é antecipar a onda de símbolos (`tasks/prd-nomes-de-mercado/tasks.md`) |
| tenancy-guardian (1ª) | Registrar nas "Divergências resolvidas" a regex `IMPORTA_O_LOGIN_SERVICE` (`\b` → `(?<![\w-])`, `architecture.test.ts:1404`) | O bloco `architecture.test.ts` das Mutações já a descreve, com a razão (o `external-login.service` casava); registro de divergência é do Arquiteto, na retro |
| conformidade-reviewer (1ª), privacy-guardian (1ª) | `docs/decisoes.md:1506` ainda cita `apps/web/src/componentes/ui/onca/` | Fora de propósito: `techspec.md`, linha 65, exclui `docs/decisoes.md` da varredura |
| infra-guardian (1ª) | `infra/test/jobs.int.test.ts` (o sandbox do worker no `dist`) não foi rodado | Precisa da imagem; roda na esteira da `develop` (D52), antes do pouso, e o Validador confere |
| test-engineer (1ª) | Escrever na tabela que o cenário "rename só de caixa" não se aplica à 6.0 (o `6.json` não tem entrada só de caixa) | Muda a tabela de testes da tarefa; é do Arquiteto decidir se o cenário sai da 6.0, na retro |
| test-engineer (1ª) | Alinhar o texto da linha 68 da tabela (cerca, forma C) ao caso que o bloco cita | Idem: texto da tabela e do `travas.md` é do Arquiteto |
| revisor-geral (1ª), test-engineer (1ª) | O `restos` não vê caminho parcial em comentário, em `.md` dentro de `apps/` e em rótulo de JSON | Limite da ferramenta da 2.0: retro e `travas.md`, antes das ondas 9.0 a 11.0 (Arquiteto) |
| revisor-geral (1ª) | Comentar no mapa que as duas entradas `pasta` de `paginas` citam a mesma linha `inventario-web-e2e.md:409` | O `6.json` não tem comentário; recusada, a linha cobre as duas e o relatório do mapa já as lista |
| revisor-geral (1ª), test-engineer (1ª) | Fixture `tools/guardas/__fixtures__/kit-importa-api.ts`: `fica` sem linha em "Não muda, mas parece" | Já está nas "Recomendações sem aplicar" do documento; decisão do Arquiteto |
| test-engineer (2ª) | O bloco extra de `estilos.test.ts` (linha 96) cita o caso "a cor escrita à mão é de duas peças só" (`apps/web/src/estilos.test.ts`, linha 556), que compara a constante com uma lista do próprio teste e fica vermelho com qualquer mudança; o caso que prova que o caminho existe é "nenhum arquivo da web pede cor fora do @theme da 9.10…" (linha 369, `toContain` da linha 386) | A ordem da rodada 1 pediu bloco só para `casca-sem-import` e `perigo-cheio` (item 4 de `6_task-r1.md`); o de `estilos` foi além. Troca de caso citado em bloco extra: próxima tarefa que toque `estilos.test.ts`, ou retro |
| test-engineer (2ª) | As listas de `architecture.test.ts` nas linhas 559, 634, 1394 e 1439 seguem sem bloco próprio | Registrar no `travas.md` se ficam cobertas pelo `existsSync` ou pela varredura de cada caso: retro (Arquiteto) |
| test-engineer (2ª) | O bloco de `perigo-cheio.test.ts` cita o caso pelo começo do nome, sem "nem mais nem menos" | O portão aceitou o nome; citar o nome inteiro evita ambiguidade se surgir caso com o mesmo começo: próxima tarefa que toque o documento (7.0 em diante) |
| revisor-geral (2ª) | `packages/core/src/telemetry/metrics.test.ts`, `packages/shared/src/system/job-definitions.ts`, `vitest.config.ts`, `.size-limit.json` e `infra/compose.yml` mudaram (só comentário e rótulo) e não estão nos "Arquivos previstos" | Detalhe não previsto: o Arquiteto os nomeia na lista, como fez na triagem de 31/10 (mesmo caso de `tools/vitrine/escola.ts`) |
| revisor-geral (2ª) | Restos por nome de arquivo sem a pasta: `tools/processo/revisoes.test.ts:2072` (`tema.ts`), `TODO.md:1640` (`cena.ts`), `TODO.md:1832` (`executor.ts`) e o caminho virtual de `apps/web/chunk-names.test.ts:137` (`textos-das-fontes.ts` em `components\ui\ai\`) | Fora do alcance do RF3 (`apps/`, `packages/`, `e2e/`) os três primeiros; o quarto é caminho virtual de teste. Trocar ou registrar na próxima tarefa que tocar cada um (o `chunk-names.test.ts` é da 9.0 a 11.0, a das linhas de web) |
| revisor-geral (2ª), test-engineer (1ª) | O `restos` não vê o nome do arquivo sem a pasta-mãe nem a regex com pedaço do caminho | Limite da ferramenta da 2.0: retro e `travas.md`, antes das ondas 9.0 a 11.0 (Arquiteto); a busca manual da 6.4 continua valendo até lá |
| infra-guardian (2ª) | `infra/test/jobs.int.test.ts` não rodou nesta tarefa; rodar `carga-login` uma vez em modo seco confirma que o `dist` tem o caminho novo (`apps/api/dist/sessao/tenant/synthetic-sessions.js`) | Esteira da `develop` (D52), antes do pouso; o Validador confere |
| tenancy-guardian (2ª) | Alinhar a chave `cerca-resolucao-de-tenant` (`camadas.cjs:147`, `camadas.test.ts:142`) ao nome da classe | 7.0, quando `ResolucaoDeTenantRepository` for renomeada |
| conformidade-reviewer (2ª) | `docs/decisoes.md:1506` ainda cita `apps/web/src/componentes/ui/onca/` | Fora da varredura por `techspec.md`, linha 65; retro |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-31 05:44:06 | 2026-10-31 05:45:23 | `tenancy-guardian` | 1 | APROVADO | a24d339b67bdc2d15 |
| 2026-10-31 05:44:11 | 2026-10-31 05:46:11 | `conformidade-reviewer` | 1 | APROVADO | a9f319ce60e51cc8b |
| 2026-10-31 05:44:08 | 2026-10-31 05:46:52 | `privacy-guardian` | 1 | APROVADO | a95e9bef742681223 |
| 2026-10-31 05:44:14 | 2026-10-31 05:46:53 | `infra-guardian` | 1 | APROVADO | a9ee1426c5f9fb5cf |
| 2026-10-31 05:44:17 | 2026-10-31 05:48:52 | `test-engineer` | 1 | REPROVADO | ae1fefad122abba82 |
| 2026-10-31 05:44:20 | 2026-10-31 05:49:12 | `revisor-geral` | 1 | REPROVADO | aaf4a62b286f07585 |
| 2026-10-31 08:27:14 | 2026-10-31 08:27:31 | `infra-guardian` | 2 | APROVADO | acfc7e6d2c969f8cf |
| 2026-10-31 08:27:01 | 2026-10-31 08:27:31 | `tenancy-guardian` | 2 | APROVADO | aa2e97f51695b49d3 |
| 2026-10-31 08:27:09 | 2026-10-31 08:27:40 | `conformidade-reviewer` | 2 | APROVADO | acf614babfd36738e |
| 2026-10-31 08:27:05 | 2026-10-31 08:28:00 | `privacy-guardian` | 2 | APROVADO | acc49ffcad67bbe91 |
| 2026-10-31 08:26:46 | 2026-10-31 08:28:13 | `test-engineer` | 2 | APROVADO | a4aef39e0b4ee00ce |
| 2026-10-31 08:26:57 | 2026-10-31 08:28:54 | `revisor-geral` | 2 | APROVADO | a8b39cd6128beaab2 |
