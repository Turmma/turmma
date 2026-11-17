# Correção — o job `verificar` da esteira passa dos 15 min com a suíte inteira verde, e a unidade vira fatias

**Origem:** esteira run 43965073602 em `ea6f3a0` (branch `spec/reengenharia-continuacao`): o job `verificar` foi cancelado pelo `timeout-minutes: 15` com o `test:processo` já verde.
**Subagentes obrigatórios:** `infra-guardian`, `test-engineer`, `revisor-geral`, `privacy-guardian`
<!-- Os três primeiros vieram no PEDIDO do Orquestrador; `revisor-geral` também por tocar `.github/` e `tools/ci/` (passo 5 de `corrigir`). `privacy-guardian` vem do caminho: `.github/` liga a `infra-guardian` e `privacy-guardian` (`tools/processo/guardioes-por-caminho.ts`). -->

## Sintoma

`verificar (tipos, lint e guardas, segredo, dependências, unidade)` começou às 21:56:40 e foi cancelado às 22:11:47 (15 min), sem teste vermelho: a unidade terminou verde às 22:11:29
(`Test Files 506 passed`, `Tests 9581 passed`, `Duration 577.16s`) e o `test:processo` também (52 passed, 14,6 s). O cancelamento caiu nos últimos segundos, entre o fim do `test:processo` e o fim do job.
`tools/processo/esteira.ts` lê a execução cancelada sem push novo como vermelha. Nas execuções anteriores da mesma branch o `ci:verificar` levou 8,5, 9,5, 11 e 9,5 min (job inteiro, com o `npm ci`: 10, 11, 12,5 e 11).

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

**A suíte de unidade não cresceu; o runner estava cerca de 45% mais lento, e o job não tinha folga para isso.** A execução anterior (`43961164264`, `a796c84`, verde) rodou os mesmos 506 arquivos e
9581 testes. As duas, etapa a etapa (log de cada job `verificar`):

| Etapa | `43961164264` (verde) | `43965073602` (cancelada) | Razão |
|---|---|---|---|
| `tsc` (tipos) | 86 s | 126 s | 1,47 |
| `eslint` + guarda de camadas | 88 s | 123 s | 1,40 |
| unidade (`Duration`) | 387 s | 577 s | 1,49 |
| `test:processo` | 10 s | 15 s | 1,5 |
| `catraca.test.ts` (o `npm run lint` dentro da unidade) | 64 s | 105 s | 1,64 |
| `restos.test.ts` | 51 s | 76 s | 1,50 |

A razão é a mesma em etapas de natureza diferente (compilador, lint, Vitest, git), o que descarta uma etapa que cresceu e aponta o runner (a causa dentro do GitHub não se vê do log; o que o log mostra é a lentidão uniforme). O job é uma fila de cinco etapas em 2 núcleos, e a soma, com o `npm ci` e o checkout, era de uns 10 a 12,5 min: 67% a 83% do teto de 15 min, e 1,5× sobre isso são 15 a 19 min.
O teto de 15 min foi escrito para a média, e a variação do runner passou a ser maior do que a folga.

Subir o `timeout-minutes` só adia: a unidade cresce a cada tarefa (505 → 506 arquivos, 9519 → 9581 testes entre as duas últimas execuções verdes), como cresceram a integração (de 20 para 30 min), o e2e (de 1 para 11 fatias) e a
infra (de 1 para 3). A saída que a esteira já adotou três vezes é a mesma: repartir.

## Teste que reproduz

`tools/ci/esteira.test.ts › a unidade roda em fatias que não se cancelam …`, `› tem os jobs verificar, unidade, integracao, infra e e2e …` e `› o verificar não roda a unidade …`;
`tools/ci/scripts.test.ts › ci:unidade …` e `› ci:verificar roda tipos, lint, as guardas da lista e o git hook …`. Rodados antes da correção, falham porque o job `unidade` e o script `ci:unidade` não existem e o
`ci:verificar` ainda chama `npm run test:unidade`.

## Correção

A unidade sai do `verificar` e vira um job próprio, em duas fatias, como a infra e o e2e já eram:

- `.github/workflows/ci.yml`: o job `unidade` (`unidade 1/2` e `unidade 2/2`, matriz `fatia: [1, 2]`, `fail-fast: false`, `npm run ci:unidade -- --shard=<i>/2`, teto de 15 min por fatia). O `verificar` fica com tipos, lint, guardas,
  segredo, dependências e o git hook, e o nome dele deixa de dizer "unidade". O teto de 15 min dos dois fica como estava: a folga vem de repartir, e não do número.
- `tools/ci/unidade.ts` e o script `ci:unidade` do `package.json`: rodam `npm run test:unidade`, com `-- --shard=<i>/<n>` quando a esteira passa a fatia, e a suíte inteira sem ela (a máquina de quem desenvolve).
- `tools/ci/verificar.ts`: sem a etapa `test:unidade`. O `test:processo` (15 s) continua nele: é um arquivo só, e rodá-lo nas duas fatias o repetiria.
- `tools/ci/executar.ts`: `fatiaDosArgumentosDoVitest(argumentos, suite)` é a leitura do `--shard=<i>/<n>` que estava em `compose.ts` como `fatiaDosArgumentosDaInfra`, agora das duas suítes
  (`infra.ts` e `unidade.ts`), em vez de uma terceira cópia (a leitura do e2e, em `prazo-do-e2e.ts`, aceita outros argumentos do Playwright e continua à parte).
- `tools/ci/esteira.test.ts` e `tools/ci/scripts.test.ts`: os testes do "Teste que reproduz", mais a guarda de que a unidade tem mais de uma fatia, e de que a matriz, o nome do job e o `--shard` do passo concordam.
- `README.md` e `docs/runbook.md` (seção nova "Esteira vermelha no `verificar` ou na unidade", e o `verificar` do 60% do e2e que passa a ser o job `unidade`, onde o `esteira.test.ts` roda).

Medido na máquina (`npm run ci:unidade -- --shard=<i>/2`, uma depois da outra): a fatia 1 leva 254 arquivos e 87 s de Vitest, e a 2, 253 arquivos e 77 s (a suíte inteira, 162 s), ou seja, repartidas
quase por igual. No runner da esteira, onde a unidade inteira levou 387 s e 577 s no lento, cada fatia leva a metade disso, uns 200 a 290 s (estimativa pela metade), e o job com o `npm ci`, uns 4 a 6 min: com 1,5× de lentidão, ainda menos
que os 10 a 12,5 min de antes. Na primeira corrida da fatia 1, dois casos de `tools/processo/harness/npx-sem-instalar.test.ts` falharam com a saída do `npx` vazia, e o arquivo passou isolado (4 passed) e na
suíte inteira do portão: é intermitência desse teste do harness, que não toca nada desta correção, e fica registrada para o Orquestrador (`Recomendações sem aplicar`).

O portão da tarefa não muda: ele roda `npm run test:unidade` inteiro (`tools/processo/sequencia-do-portao.ts`), e o `ci:unidade` sem fatia é o mesmo comando.

## Mutações

--faltando: 0 linhas (6 blocos, 0 motivos)

Seis linhas novas com condição, que os blocos abaixo alcançam, são as da leitura da fatia, que passou de `compose.ts` (`fatiaDosArgumentosDaInfra`) para `executar.ts` (`fatiaDosArgumentosDoVitest`, usada pela infra e pela unidade) e a do `ci:unidade`.
O teste é o que o `ci:unidade` prova, e a infra já tem o seu (`ci:infra leva a fatia da esteira ao Vitest …`).

```mutacao
arquivo: tools/ci/executar.ts
teste: tools/ci/scripts.test.ts › ci:unidade leva a fatia da esteira ao Vitest, sai vermelho quando a unidade falha, e fatia malformada reprova antes de rodar
falha: rodarScript('unidade.ts', null).chamadas).toEqual(['npm run test:unidade'])
-  if (argumentos.length === 0) return null
   const fatia = /^--shard=(\d+)\/(\d+)$/.exec(argumentos.length === 1 ? (argumentos[0] ?? '') : '')
```

```mutacao
arquivo: tools/ci/executar.ts
teste: tools/ci/scripts.test.ts › ci:unidade leva a fatia da esteira ao Vitest, sai vermelho quando a unidade falha, e fatia malformada reprova antes de rodar
falha: expect(resultado.codigo, malformada.join(' ')).not.toBe(0)
-  const fatia = /^--shard=(\d+)\/(\d+)$/.exec(argumentos.length === 1 ? (argumentos[0] ?? '') : '')
+  const fatia = /^--shard=(\d+)\/(\d+)$/.exec(argumentos[0] ?? '')
```

```mutacao
arquivo: tools/ci/executar.ts
teste: tools/ci/scripts.test.ts › ci:unidade leva a fatia da esteira ao Vitest, sai vermelho quando a unidade falha, e fatia malformada reprova antes de rodar
falha: expect(resultado.codigo, malformada.join(' ')).not.toBe(0)
-  if (fatia === null || indice < 1 || indice > total) {
+  if (indice < 1 || indice > total) {
```

```mutacao
arquivo: tools/ci/executar.ts
teste: tools/ci/scripts.test.ts › ci:unidade leva a fatia da esteira ao Vitest, sai vermelho quando a unidade falha, e fatia malformada reprova antes de rodar
falha: expect(resultado.codigo, malformada.join(' ')).not.toBe(0)
-  if (fatia === null || indice < 1 || indice > total) {
+  if (fatia === null || indice > total) {
```

```mutacao
arquivo: tools/ci/executar.ts
teste: tools/ci/scripts.test.ts › ci:unidade leva a fatia da esteira ao Vitest, sai vermelho quando a unidade falha, e fatia malformada reprova antes de rodar
falha: expect(resultado.codigo, malformada.join(' ')).not.toBe(0)
-  if (fatia === null || indice < 1 || indice > total) {
+  if (fatia === null || indice < 1) {
```

```mutacao
arquivo: tools/ci/unidade.ts
teste: tools/ci/scripts.test.ts › ci:unidade leva a fatia da esteira ao Vitest, sai vermelho quando a unidade falha, e fatia malformada reprova antes de rodar
falha: rodarScript('unidade.ts', null).chamadas).toEqual(['npm run test:unidade'])
-  executarEtapas([{ nome: 'testes de unidade', comando: 'npm', argumentos: ['run', 'test:unidade', ...(fatia === null ? [] : ['--', `--shard=${fatia}`])] }]),
+  executarEtapas([{ nome: 'testes de unidade', comando: 'npm', argumentos: ['run', 'test:unidade', ...['--', `--shard=${String(fatia)}`]] }]),
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| Implementador | `tools/processo/harness/npx-sem-instalar.test.ts` falhou duas vezes numa corrida da fatia 1 da unidade (saída do `npx` vazia) e passou isolado e no portão | Intermitência de teste do harness, fora desta correção: cabe ao Orquestrador pedir a correção própria se a esteira a pegar |
| infra-guardian (1ª) | O job `verificar` trocou de nome; se a `develop`, a `release` ou a `main` exigissem o check pelo nome antigo, o merge esperaria um check que nunca chega. Conferir com `gh api repos/Turmma/turmma/branches/develop/protection` | Conferido pela Mesa em 16/11: as três branches respondem "Branch not protected" (404), sem check obrigatório. Nada a fazer |
| infra-guardian (1ª), test-engineer (1ª), revisor-geral (1ª) | O limite de "7 min de teste numa fatia" só existe em comentário e no runbook; sem anotação "unidade perto do teto" no molde da do `tools/ci/e2e.ts` | Não aplicar: é comportamento novo em `tools/ci/unidade.ts` (anotação no resumo), não ajuste de texto; o `revisor-geral` já a manda para a retro. Destino: retro da spec decide; o Orquestrador a leva |
| revisor-geral (1ª) | A guarda "o `/N` do nome do job é o tamanho da matriz" está só no teste da unidade (`esteira.test.ts:385`); juntar as checagens ou estendê-la à infra e ao e2e | Não aplicar: é uma escolha entre dois desenhos, sem defeito, e estender a guarda à infra e ao e2e sai do escopo da correção. Destino: retro da spec, junto com a anotação acima |
| test-engineer (1ª) | Estimativas de tempo no comentário do `ci.yml` ("uns 5 min", "200 a 290 s" por fatia) a conferir na primeira execução | Não aplicar agora: só a esteira mede. Destino: Orquestrador, ao ler a primeira execução da esteira com o job `unidade`, troca a estimativa pela medida |
| infra-guardian, revisor-geral, test-engineer (1ª) | `tools/processo/harness/npx-sem-instalar.test.ts` intermitente (saída do `npx` vazia), que agora pode deixar uma fatia da unidade vermelha | Já está em "Recomendações sem aplicar" do documento. Destino: Orquestrador abre `/corrigir` dele se voltar a aparecer na esteira |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-16 21:37:08 | 2026-11-16 21:37:29 | `privacy-guardian` | 1 | APROVADO | ac9e9d24b3fcc5ba6 |
| 2026-11-16 21:37:06 | 2026-11-16 21:37:44 | `revisor-geral` | 1 | APROVADO | a21e07d35fd99ab14 |
| 2026-11-16 21:37:03 | 2026-11-16 21:37:50 | `infra-guardian` | 1 | APROVADO | a25e22e6ad0007a39 |
| 2026-11-16 21:37:05 | 2026-11-16 21:38:04 | `test-engineer` | 1 | APROVADO | a3253c29154ca01f5 |
