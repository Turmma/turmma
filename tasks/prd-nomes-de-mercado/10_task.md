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

- [x] 10.1 — O mapa `tools/renomear/mapas/10.json`, com `"linha": true`
- [x] 10.2 — O `aplicar` e a classificação. Muda o nome da constante (`CHAVE_` → `_QUERY_KEY`), e o valor da chave
  fica
- [x] 10.3 — As travas: o `travas.md` não lista nenhuma desta onda. A que o relatório achar ganha linha e bloco
- [x] 10.4 — O `conferir` e o `restos`. A busca dos nomes antigos em `apps/web/src` e `e2e/`
- [x] 10.5 — A seção "Mutações"

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/`, `apps/web/chunk-names.ts` (o `nome-dos-chunks.ts` de antes da 6.0), `apps/web/chunk-names.test.ts`, `apps/web/vite.config.ts` | alterado |
| `eslint-suppressions.json` | alterado (a chave de `LoginPorCima.tsx`, que acompanha o componente; triagem da 9.0) |
| `e2e/operacao-escolas.spec.ts` | sem diff no fim (importa `estados-da-escola.ts`, que não muda de nome) |
| `e2e/operacao-uso.spec.ts` | alterado |
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

31/10 — O passo 5 alcança cinco arquivos fora dos previstos, só por comentário: `e2e/casca.spec.ts:683` (`RODAPE_DA_LATERAL` → `SIDEBAR_FOOTER`, troca legítima) e quatro homônimos que a onda desfaz e registra como `fica` (`Aparencia` e `TamanhoDaLetra`, os componentes, em `e2e/aparencia.spec.ts`, `e2e/tokens.spec.ts` e `e2e/tamanho-da-letra.spec.ts`; o `semComentarios` de `tools/ci/duracao-do-e2e.ts`, outra função). Previstos da tarefa, Tech Spec §5 (passo 5) e `inventario-web-e2e.md:555` — triagem do Arquiteto, 31/10.

31/10 — Leituras do anexo, confirmadas na triagem: `consultarConvite` e `consultarConviteDeOperador` (`inventario-web-e2e.md:448` e `:496`) ficam, por serem `fetch` comum e não `queryOptions`; as três `CHAVE_` de `localStorage` seguem o §10 (`THEME_STORAGE_KEY`, `TEXT_SIZE_STORAGE_KEY`, `SIDEBAR_COLLAPSED_STORAGE_KEY`) e as linhas delas no §15 dizem "vale o §10"; `caminhoDoX` fica e `formatar*` entra (`inventario.md` §2, decisão 3); `PARAMETRO_DO_X` entra pela linha 287. Anexo (`inventario-web-e2e.md:448`, `:496`, `:528`, `:529`, `:533`, `:555`) — triagem do Arquiteto, 31/10.

31/10 — Travas achadas pelo relatório: `travas.md:188` a `:190` (os arquivos de `estados.test.tsx:169`, o `this.name` de `ErroDaApi` e a regex negativa de `estados.test.tsx:32`); a linha 140 ganhou "10.0" na coluna Onda. Tech Spec §5 e `travas.md`.

01/11 — Ordem r1 da Mesa 2 (2ª divergência da 10.0), resolvida pelo Arquiteto e aprovada pelo Joaquim: a adenda 4 (`inventario-adenda-4.md:20` a `:23`) põe quatro nomes no mapa (`chamarComSessaoDeOperador` → `operadorAuthedRequest`, `CHAVE_DO_ACESSO` → `ACESSO_QUERY_KEY`, `CHAVE_DOS_PEDIDOS` → `PEDIDOS_QUERY_KEY`, `CHAVE_DA_CONTAGEM_DE_PEDIDOS` → `CONTAGEM_DE_PEDIDOS_QUERY_KEY`), com o valor das chaves intacto (o `conferir` prova), e `apps/web/index.html` entra nos previstos só pelo comentário da linha 16 (`resolverTema` → `resolveTheme`, troca à mão registrada no relatório). Os testes `RegiaoQueRola.test.tsx` e `RegiaoDaLista.test.tsx` acompanharam os componentes (`ScrollArea.test.tsx`, `ScrollableList.test.tsx`).

## Mutações

Um bloco por trava (Tech Spec §10), na forma da coluna do `travas.md`. O relatório achou as três linhas de `travas.md:188` a `:190`, e usou as de `:101`, `:140` e `:95`.

A onda não acrescenta condição: o `conferir` prova que só o nome mudou. O `--faltando` lista 337 linhas de produção com condição em `apps/web/src/`: são linhas que já existiam e que o rename só reescreveu (`instanceof ApiError`, `<LoadingState`, `<ErrorState`, `ROUTES.…`, `TEXT_SIZE_STORAGE_KEY`, `THEME_STORAGE_KEY` e afins). As travas da onda têm os blocos abaixo.

**`estados.test.tsx`** (`travas.md:188`, forma A). Com o nome antigo de um dos três arquivos, o `readFileSync` do caso não o acha e o caso fica vermelho.

```mutacao
arquivo: apps/web/src/components/states/estados.test.tsx
teste: apps/web/src/components/states/estados.test.tsx › nenhum importa
-    for (const arquivo of ['LoadingState.tsx', 'ErrorState.tsx', 'EmptyState.tsx']) {
+    for (const arquivo of ['EstadoCarregando.tsx', 'ErrorState.tsx', 'EmptyState.tsx']) {
```

**`client.ts`** (`travas.md:189`, forma A). Com o `this.name` no nome antigo, os dois `name: 'ApiError'` de `eu.test.ts` ficam vermelhos.

```mutacao
arquivo: apps/web/src/api/client.ts
teste: apps/web/src/api/eu.test.ts › resposta fora do contrato
-    this.name = 'ApiError'
+    this.name = 'ErroDaApi'
```

**`estados.test.tsx:32`** (`travas.md:190`, forma B). A negativa só prova alguma coisa com o nome novo: a mutação põe o nome da classe num `<span>` fora do `alert` (logo depois do `</p>`), de modo que a asserção da linha 30 passa e só a negativa da linha 32 fica vermelha.

```mutacao
arquivo: apps/web/src/components/states/ErrorState.tsx
teste: apps/web/src/components/states/estados.test.tsx › o `alert` é só a mensagem do catálogo
-      </p>
+      </p>
+      {erro instanceof Error ? <span>{erro.name}</span> : null}
```

**`chunk-names.test.ts`** (`travas.md:101`, forma C, linhas 151, 164 e 171). Os nomes dos arquivos movidos são lidos como texto; o caso confere que cada um está dentro da entrada e passaria igual com o nome antigo, então a prova é o `restos`.

```mutacao
arquivo: apps/web/chunk-names.test.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-    for (const daEntrada of ['ui/Button.tsx', 'ui/button-variants.ts', 'ui/overlays/Dialog.tsx', 'ui/fields/FormField.tsx', 'states/EmptyState.tsx', 'MenuDaPessoa.tsx', 'ui/fields/field-styles.ts', 'pedidos/Menu.tsx'])
+    for (const daEntrada of ['ui/Button.tsx', 'ui/button-variants.ts', 'ui/overlays/Dialog.tsx', 'ui/fields/FormField.tsx', 'states/EstadoVazio.tsx', 'MenuDaPessoa.tsx', 'ui/fields/field-styles.ts', 'pedidos/Menu.tsx'])
```

```mutacao
arquivo: apps/web/chunk-names.test.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-    for (const daEntrada of ['ui/overlays/Dialog.tsx', 'ui/overlays/modal-dialog.ts', 'ReauthDialog.tsx', 'DialogoDoConvite.tsx']) {
+    for (const daEntrada of ['ui/overlays/Dialog.tsx', 'ui/overlays/modal-dialog.ts', 'LoginPorCima.tsx', 'DialogoDoConvite.tsx']) {
```

```mutacao
arquivo: apps/web/chunk-names.test.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-    for (const daEntrada of ['states/LoadingState.tsx', 'states/ErrorState.tsx', 'states/EmptyState.tsx', 'ui/Button.tsx']) {
+    for (const daEntrada of ['states/EstadoCarregando.tsx', 'states/EstadoErro.tsx', 'states/EstadoVazio.tsx', 'ui/Button.tsx']) {
```

**`estilos.test.ts`** (`travas.md:140`, forma A, linhas 89, 96, 557 e 621). Com o caminho antigo do QR, a varredura não acha o arquivo (89 e 96), a lista fechada difere (557) e o QR deixa de ser a exceção (621).

```mutacao
arquivo: apps/web/src/estilos.test.ts
teste: apps/web/src/estilos.test.ts › nenhum arquivo da web pede cor fora do @theme
-const ARQUIVOS_COM_BRANCO_FIXO = ['components/QrCode.tsx']
+const ARQUIVOS_COM_BRANCO_FIXO = ['components/CodigoQr.tsx']
```

```mutacao
arquivo: apps/web/src/estilos.test.ts
teste: apps/web/src/estilos.test.ts › nenhum arquivo da web pede cor fora do @theme
-const ARQUIVOS_COM_COR_EM_LINHA = ['components/QrCode.tsx', 'components/ui/onca/CabecaOnca.tsx']
+const ARQUIVOS_COM_COR_EM_LINHA = ['components/CodigoQr.tsx', 'components/ui/onca/CabecaOnca.tsx']
```

```mutacao
arquivo: apps/web/src/estilos.test.ts
teste: apps/web/src/estilos.test.ts › a cor escrita à mão é de duas peças só
-    expect([...ARQUIVOS_COM_COR_EM_LINHA].sort()).toEqual(['components/QrCode.tsx', 'components/ui/onca/CabecaOnca.tsx'])
+    expect([...ARQUIVOS_COM_COR_EM_LINHA].sort()).toEqual(['components/CodigoQr.tsx', 'components/ui/onca/CabecaOnca.tsx'])
```

```mutacao
arquivo: apps/web/src/estilos.test.ts
teste: apps/web/src/estilos.test.ts › o QR é a única exceção
-    expect(classesReprovadas('components/QrCode.tsx', qr)).toEqual([])
+    expect(classesReprovadas('components/CodigoQr.tsx', qr)).toEqual([])
```

**`perigo-cheio.test.ts`** (`travas.md:140`, forma C, linhas 24 e 34). O nome do componente está em texto de descrição e de mensagem, que nenhum caso compara; a prova é o `restos`.

```mutacao
arquivo: apps/web/src/components/perigo-cheio.test.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-  'components/dialogs.tsx': 'o botão da `DangerConfirmDialog`, que exclui',
+  'components/dialogs.tsx': 'o botão da `ConfirmacaoDePerigo`, que exclui',
```

```mutacao
arquivo: apps/web/src/components/perigo-cheio.test.ts
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-    expect(novos, 'o `perigo` cheio só vive dentro de uma confirmação: use `ConfirmDialog` ou `DangerConfirmDialog`').toEqual([])
+    expect(novos, 'o `perigo` cheio só vive dentro de uma confirmação: use `ConfirmDialog` ou `ConfirmacaoDePerigo`').toEqual([])
```

**`eslint-suppressions.json`** (`travas.md:95`, forma C). O lint é a trava e não é caso de Vitest (como na 5.0 e na 9.0); a chave com o nome antigo é resto do mapa, e o `restos` a acusa.

```mutacao
arquivo: eslint-suppressions.json
teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados
-  "apps/web/src/components/ReauthDialog.tsx": {
+  "apps/web/src/components/LoginPorCima.tsx": {
```


## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª), infra-guardian (1ª) | Registrar a troca do `this.name` de `ErroDaApi` para `'ApiError'` | Já registrada: trava `travas.md:189` e o bloco `client.ts` em "Mutações". Sem texto novo |
| frontend-reviewer (1ª) | `chamarComSessaoDeOperador` e as constantes locais `CHAVE_DO_ACESSO`, `CHAVE_DOS_PEDIDOS`, `CHAVE_DA_CONTAGEM_DE_PEDIDOS` fora do inventário | Tratadas: entraram pela adenda 4 do inventário, aprovada pelo Joaquim em 01/11 (`inventario-adenda-4.md:20` a `:23`), e estão no mapa |
| test-engineer (1ª) | `dasEscolasQueryOptions`, `dasRedesQueryOptions` e `doUsoQueryOptions` carregam a preposição do nome antigo | Seguem o anexo aprovado; retro da X8 (registro do inventário) |
| test-engineer (1ª) | A linha "esteira" só se confere no encontro | Não é da tarefa (Tech Spec §7c): o Validador a lê com `tools/processo/esteira.ts` antes de fechar a spec |
| revisor-geral (1ª) | `relatorio.ts` mostra `estados.test.tsx:169` como `fica` onde o `travas.md` diz trava | Ferramenta fora desta onda (`tools/renomear/relatorio.ts`); `TODO.md` e retro da X8 |
| revisor-geral (1ª) | `casca-sem-import.test.ts:68` cita `Dica` no texto de entrada de um caso | Arquivo que a tarefa não toca e texto que o `conferir` não prevê fora do mapa; `TODO.md`, para o próximo toque no arquivo |
| tenancy-guardian (2ª), infra-guardian (2ª), frontend-reviewer (2ª) | `describe('RegiaoQueRola')` em `ScrollArea.test.tsx:32` e a interface `PropsDaRegiaoQueRola` em `ScrollArea.tsx:6` ficam com o nome antigo | Ficam: o título de `describe` não muda (RF6; `inventario-web-e2e.md:555`, item d) e as `Props…` de fora do kit ficam (`inventario-web-e2e.md:68`), como o revisor-geral conferiu |
| frontend-reviewer (2ª) | `resolverTema` em `theme.test.ts:55` e `:120`; `useTamanhoDaLetra` em `text-size.test.ts:233`; alinhar `PropsDaRegiaoQueRola` com `ScrollAreaProps` | Texto de título de caso, que fica pelo RF6 e RF7 (o test-engineer conferiu); o alinhamento de `Props` não entra: fica pelo `inventario-web-e2e.md:68` |
| revisor-geral (2ª) | A linha `apps/web/index.html \| resolverTema \| 16` foi escrita à mão em `tools/renomear/mapas/10.relatorio.md:115`, arquivo que o `aplicar` gera: gerar de novo apaga a linha, e o `restos` usa a tabela | Ferramenta fora desta onda; retro da X8 (o mapa ou a ferramenta devem aceitar troca à mão declarada) |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-31 23:01:05 | 2026-10-31 23:01:36 | `tenancy-guardian` | 1 | APROVADO | ab3bfdab28da0b8b3 |
| 2026-10-31 23:01:12 | 2026-10-31 23:02:05 | `infra-guardian` | 1 | APROVADO | a2d76bc1c51b4a941 |
| 2026-10-31 23:01:07 | 2026-10-31 23:02:10 | `privacy-guardian` | 1 | APROVADO | a110a9e8c6733589c |
| 2026-10-31 23:01:10 | 2026-10-31 23:02:34 | `conformidade-reviewer` | 1 | APROVADO | a2633b373a91a5978 |
| 2026-10-31 23:01:15 | 2026-10-31 23:03:12 | `frontend-reviewer` | 1 | APROVADO | a72e31af94ad463e5 |
| 2026-10-31 23:01:18 | 2026-10-31 23:03:50 | `test-engineer` | 1 | REPROVADO | acf725f1d74041ad1 |
| 2026-10-31 23:01:20 | 2026-10-31 23:05:09 | `revisor-geral` | 1 | REPROVADO | a6c2d3b13cc877008 |
| 2026-10-31 23:59:29 | 2026-10-31 23:59:46 | `tenancy-guardian` | 2 | APROVADO | a263f50232e5bc818 |
| 2026-10-31 23:59:35 | 2026-10-31 23:59:54 | `privacy-guardian` | 2 | APROVADO | a028de8fff14bd292 |
| 2026-10-31 23:59:41 | 2026-10-31 23:59:56 | `conformidade-reviewer` | 2 | APROVADO | a1dbca066d9a31679 |
| 2026-10-31 23:59:46 | 2026-10-31 23:59:58 | `infra-guardian` | 2 | APROVADO | ab07781b60289bc5f |
| 2026-10-31 23:59:53 | 2026-11-01 00:00:24 | `frontend-reviewer` | 2 | APROVADO | a11d69877832a34d1 |
| 2026-11-01 00:00:02 | 2026-11-01 00:00:41 | `test-engineer` | 2 | APROVADO | afbce2ca7e03c0cfa |
| 2026-11-01 00:00:11 | 2026-11-01 00:01:33 | `revisor-geral` | 2 | APROVADO | a6f0d90689b8f2fcf |
