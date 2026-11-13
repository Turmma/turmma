# Correção — o job `infra` da esteira passa dos 45 min e é cancelado no `timeout-minutes`

**Origem:** esteira run 43325031136 em `03454fa` (`gh run view 43325031136 --log`): o job `infra (borda, métricas, alertas e jobs no compose)` foi cancelado aos 45 min, ainda rodando testes.
**Subagentes obrigatórios:** `infra-guardian`, `test-engineer`, `revisor-geral`, `privacy-guardian`
<!-- Os guardiões vieram no PEDIDO do Orquestrador. O `revisor-geral` também é obrigatório: a correção toca `.github/` e `tools/ci/` (passo 5 de `corrigir`). O `privacy-guardian` entra por ordem da Mesa: o `ci.yml` e o `esteira.test.ts` citam a regra 20 (artefato público, dado sintético), que soma o guardião dela. -->

## Sintoma

O job `infra` roda `npm run ci:infra`, que sobe o compose e roda `vitest run --project infra`. Na execução 43325031136 o passo
começou às 23:01:40 e foi cancelado às 23:45:56, depois de 44 min 16 s, com o arquivo `alerta-do-arquivo.int.test.ts` já verde e ainda
sem ter fechado a lista. Todos os outros jobs da execução passaram (o e2e, em fatias, e a integração, em 23 min).

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

Falha da **tarefa 3.0** (a do ensaio de alertas), vista só na esteira. O projeto `infra` do Vitest roda **um arquivo por vez**
(`fileParallelism: false`, em `vitest.config.ts`): os testes param e religam serviços do compose, e dois ao mesmo tempo se
atrapalhariam. A duração do job é, portanto, a **soma** dos arquivos. Medida no log da execução (a duração de cada arquivo):

| arquivo | duração |
|---|---|
| `alertas.int.test.ts` | 1113 s |
| `borda.int.test.ts` | 407 s |
| `alerta-do-pdf-parado.int.test.ts` | 346 s |
| `jobs.int.test.ts` | 205 s |
| `alerta-da-eliminacao`, `alerta-do-incidente`, `alerta-do-arquivo`, `metricas` | de 110 a 125 s cada |
| `expurgo-da-carga`, `conferir-carga` | 9 s e 4 s |
| `alerta-do-expurgo` | ainda não tinha rodado quando o prazo cancelou |

Os dez que rodaram somam 2.547 s (42,5 min), mais o `npm ci` e a subida do compose: o teto de 45 min já não cabia, e cada alerta novo
(a 3.0 trouxe cinco arquivos, cada um esperando o `for:` real da regra no Grafana) soma mais uns 2 min. Subir o número do
`timeout-minutes` só adiaria o problema, e é o mesmo caminho que o e2e já fez em fatias
(`tasks/correcoes/2026-10-03-e2e-em-fatias.md`).

## Teste que reproduz

`tools/ci/esteira.test.ts` › `a infra roda em fatias que não se cancelam…` (a matriz, o `fail-fast: false` e o `/n` do nome do job) e
`tem os jobs verificar, integracao, infra e e2e…` (o passo passa `--shard=<fatia>/<n>`); e `tools/ci/scripts.test.ts` ›
`ci:infra leva a fatia da esteira ao Vitest…` (o `infra.ts` repassa a fatia a `npm run test:infra`, e fatia malformada reprova antes
de subir o compose). Vermelhos antes (o job não tinha matriz e o `infra.ts` ignorava o argumento), verdes depois.

## Correção

O job `infra` passa a rodar em **3 fatias**, cada uma no seu runner e no seu compose, como o e2e: `strategy.matrix.fatia: [1, 2, 3]`,
`fail-fast: false`, e `npm run ci:infra -- --shard=${{ matrix.fatia }}/3`. O `tools/ci/infra.ts` valida a fatia (mesma regra do
e2e: um só `--shard=<i>/<n>`, com 1 ≤ i ≤ n, e reprova antes de subir qualquer coisa) e a leva a `npm run test:infra -- --shard=<i>/<n>`.
O Vitest reparte os **arquivos** por hash do caminho, e a conta pelo log da execução dá, para as 11 do projeto hoje, 646 s, 780 s e 1.237 s
(o `alertas.int.test.ts` sozinho já é 1.113 s, e é o piso de qualquer repartição): a fatia mais longa fica em uns 25 min com o
`npm ci` e a subida do compose, contra os 45 min do teto de cada fatia. Cobertura a mesma: toda fatia roda o seu pedaço, e a união delas
é o projeto inteiro (o Vitest reparte sem sobra nem repetição). O portão local e `npm run test:infra` sem argumento seguem
rodando o projeto inteiro. O comentário do `timeout-minutes` no `ci.yml` diz a conta, como o do e2e.

## Mutações

--faltando: 4 linhas (12 blocos, 0 motivos)

```mutacao
arquivo: tools/ci/compose.ts
teste: tools/ci/scripts.test.ts › ci:infra leva a fatia da esteira ao Vitest
-  if (argumentos.length === 0) return null
+  if (false) return null
```

```mutacao
arquivo: tools/ci/compose.ts
teste: tools/ci/scripts.test.ts › ci:infra leva a fatia da esteira ao Vitest
falha: not.toBe(0)
-  const fatia = /^--shard=(\d+)\/(\d+)$/.exec(argumentos.length === 1 ? (argumentos[0] ?? '') : '')
+  const fatia = /^--shard=(\d+)\/(\d+)$/.exec(true ? (argumentos[0] ?? '') : '')
```

```mutacao
arquivo: tools/ci/compose.ts
teste: tools/ci/scripts.test.ts › ci:infra leva a fatia da esteira ao Vitest
falha: not.toBe(0)
-  if (fatia === null || indice < 1 || indice > total) {
+  if (false || indice < 1 || indice > total) {
```

```mutacao
arquivo: tools/ci/compose.ts
teste: tools/ci/scripts.test.ts › ci:infra leva a fatia da esteira ao Vitest
falha: not.toBe(0)
-  if (fatia === null || indice < 1 || indice > total) {
+  if (fatia === null || false || indice > total) {
```

```mutacao
arquivo: tools/ci/compose.ts
teste: tools/ci/scripts.test.ts › ci:infra leva a fatia da esteira ao Vitest
falha: not.toBe(0)
-  if (fatia === null || indice < 1 || indice > total) {
+  if (fatia === null || indice < 1 || false) {
```

```mutacao
arquivo: tools/ci/compose.ts
teste: tools/ci/scripts.test.ts › ci:infra leva a fatia da esteira ao Vitest
-      { nome, comando: 'npm', argumentos: ['run', script, ...(fatia === null ? [] : ['--', `--shard=${fatia}`])] },
+      { nome, comando: 'npm', argumentos: ['run', script] },
```

```mutacao
arquivo: tools/ci/infra.ts
teste: tools/ci/scripts.test.ts › ci:infra leva a fatia da esteira ao Vitest
-await encerrarCom(executarTestesComInfra('testes de integração da infra', 'test:infra', fatiaDosArgumentosDaInfra(process.argv.slice(2))))
+await encerrarCom(executarTestesComInfra('testes de integração da infra', 'test:infra', null))
```

```mutacao
arquivo: .github/workflows/ci.yml
teste: tools/ci/esteira.test.ts › a infra roda em fatias que não se cancelam
       # Uma fatia vermelha não cancela as outras: o vermelho de cada uma continua aparecendo.
-      fail-fast: false
+      fail-fast: true
```

```mutacao
arquivo: .github/workflows/ci.yml
teste: tools/ci/esteira.test.ts › a infra roda em fatias que não se cancelam
-        fatia: [1, 2, 3]
+        fatia: [1]
```

```mutacao
arquivo: .github/workflows/ci.yml
teste: tools/ci/esteira.test.ts › a infra roda em fatias que não se cancelam
-    name: infra ${{ matrix.fatia }}/3 (borda, métricas, alertas e jobs no compose)
+    name: infra ${{ matrix.fatia }} (borda, métricas, alertas e jobs no compose)
```

```mutacao
arquivo: .github/workflows/ci.yml
teste: tools/ci/esteira.test.ts › a infra roda em fatias que não se cancelam
     # (a matriz, o `/3` do nome e o do passo), em vez de subir este número.
-    timeout-minutes: 45
+    timeout-minutes: 90
```

```mutacao
arquivo: .github/workflows/ci.yml
teste: tools/ci/esteira.test.ts › tem os jobs verificar, integracao, infra e e2e
-      - run: npm run ci:infra -- --shard=${{ matrix.fatia }}/3
+      - run: npm run ci:infra
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (1ª), test-engineer (1ª), infra-guardian (1ª) | `vitest.config.ts:15-17` ainda diz "uns 16 min dos ~21 da integração" para o projeto `infra`, e contradiz o README e o runbook novos | Arquivo que a correção não toca. Já está em `TODO.md` ("Job `infra` da esteira perto do teto, sem guarda", que cita o `vitest.config.ts`, o README e `.claude/rules/40-testes.md`); a Mesa leva o achado ao Orquestrador no relatório |
| revisor-geral (1ª) | `fatiaDosArgumentosDaInfra` (`tools/ci/compose.ts:185-195`) copia `fatiaDosArgumentos` (`tools/ci/prazo-do-e2e.ts:65-75`); extrair uma função comum | Mexe em `prazo-do-e2e.ts`, que a correção não toca, e em dois contratos de erro. `TODO.md`, com a recomendação como está |
| revisor-geral (1ª) | `fatiasDoE2e()` (`esteira.test.ts:84-86`) virou repasse de `fatiasDoJob('e2e')`: chamar direto e apagar | Recusada: o repasse tem quatro usos (linhas 362, 365, 466, 485) e a troca é só de forma, sem efeito em teste nem comportamento |
| revisor-geral (1ª) | `TODO.md:442-450` ("Job `infra` da esteira perto do teto") fica resolvido em boa parte por esta correção | É do Orquestrador: fechar o item ou reduzi-lo ao que sobra (o `vitest.config.ts`, o README:60, a `40-testes.md:102` e a frase do runbook sobre o e2e) |
| revisor-geral (1ª) | A asserção `timeout-minutes ≤ 45` não liga o teto ao tamanho real das fatias | Retro: a mitigação hoje é o comentário do `ci.yml` e o runbook |
| infra-guardian (1ª) | Guarda: o total de fatias não pode passar do número de arquivos `*.int.test.ts` de `infra/test` (fatia vazia faz o Vitest falhar com "No test files found") | Cláusula nova com mutação própria, sem relação com o defeito corrigido. `TODO.md` |
| infra-guardian (1ª) | O total `/3` está escrito em três lugares do `ci.yml`; um lugar só evitaria editar três linhas | Retro: o teste já confere que os três batem com a matriz |
| test-engineer (1ª) | A união das fatias ser o projeto inteiro depende do Vitest, não de teste nosso | Registrada para a validação; está declarada no documento |
| privacy-guardian (1ª) | Dizer no commit que os textos da regra 20 (`ci.yml:142-168`, `esteira.test.ts:50, 411, 448`) não foram mexidos | Sem aplicar no código: vai na mensagem do commit |
| privacy-guardian (1ª) | O despejo de log do compose no job `infra` sai no log público e depende de `infra/test` usar dado sintético (regra 20, item 17); um comentário curto no job `infra` | Retro: não muda comportamento, mas é comentário novo em `ci.yml`, que a correção só tocaria por este motivo |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-12 21:19:54 | 2026-11-12 21:20:13 | `privacy-guardian` | 1 | APROVADO | abc3a395b44963cf5 |
| 2026-11-12 21:19:52 | 2026-11-12 21:20:33 | `revisor-geral` | 1 | APROVADO | a165be1944294299c |
| 2026-11-12 21:19:49 | 2026-11-12 21:20:44 | `infra-guardian` | 1 | APROVADO | a865844a96a16620a |
| 2026-11-12 21:19:51 | 2026-11-12 21:21:00 | `test-engineer` | 1 | APROVADO | a57d140393d503228 |
| 2026-11-12 21:27:48 | 2026-11-12 21:28:02 | `revisor-geral` | 2 | APROVADO | aaf90b15bca912539 |
| 2026-11-12 21:27:46 | 2026-11-12 21:28:23 | `test-engineer` | 2 | APROVADO | a6d982aa53318f9ed |
