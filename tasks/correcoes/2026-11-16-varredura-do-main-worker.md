# Correção — a varredura do `main-worker` volta 0 para sempre quando uma execução ficou `rodando` por mais de ~24,8 dias

**Origem:** esteira run 43829237157 (`ef1ec80`), job de integração, `apps/api/src/ia/ia.int.test.ts` › "varredura do main-worker" (teste da tarefa 6.0): `expected 0 to be greater than or equal to 2`.
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `tenancy-guardian`, `infra-guardian`, `privacy-guardian`, `conformidade-reviewer`

## Sintoma

Na esteira, `fila.varredura().varrer()` devolveu 0 no caso da 6.0 (12 ms, sem erro visível), e a execução `rodando` e a `pendente` sem job não foram encerradas. Na execução anterior o mesmo caso passou, e rodado sozinho, ou o arquivo inteiro, no banco do portão, passa sempre. Reproduzido em banco novo com os dois arquivos que rodam antes dele na esteira: `EDUCA_BANCO_NOVO=1 npx vitest run --project integracao apps/worker/test/expurgo-da-escola.int.test.ts packages/core/src/db/schema/mvp/mvp-tables.int.test.ts apps/api/src/ia/ia.int.test.ts` (o Vitest põe antes o arquivo que falhou na rodada anterior: a falha só aparece quando o `ia.int` vem depois do `expurgo-da-escola`).

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

`apps/worker/test/expurgo-da-escola.int.test.ts` semeia, e deixa no banco, uma execução `rodando` com `iniciada_em` de 2025. A varredura (`VarreduraDeExecucoes.#encerrarRodandas`) a pega primeiro (a mais antiga), e a duração que ela devolve do `update` (`now() - iniciada_em`, ~440 dias, 3,8 × 10¹⁰ ms) vai para `consumo_ia.duracao_ms`, que é `integer` (máximo 2.147.483.647 ms, ~24,8 dias). O `insert` falha com SQLSTATE `22003` (valor fora da faixa); a transação desfaz o lote inteiro (o `update` junto); `varrer()` engole o erro no `catch` (aviso `ia.execucao.varredura_falhou`, que o teste não lê) e devolve 0. A `pendente` nem chega a ser varrida: o `await` da `rodando` lançou antes.

Não é só defeito de teste: em produção, **uma única execução esquecida em `rodando` por mais de 24,8 dias** (a API fora por um mês, uma réplica que nunca voltou) trava a varredura para sempre. Cada volta repete a mesma falha, nenhuma outra `rodando` nem `pendente` é encerrada, e o aviso que sai no log não diz qual linha. Falha da 6.0 (`consumoEstimadoDaInterrompida` não limitava a duração ao que a coluna comporta).

## Teste que reproduz

- `apps/api/src/ia/execucao-interrompida.int.test.ts` › "varredura, execução esquecida há mais de 24,8 dias: a `rodando` encerra com a duração no teto do inteiro da linha, e não trava a volta das outras `rodando`": vermelho antes (`expected 0 to be greater than or equal to 2`), verde depois. Determinístico: uma `rodando` de 40 dias.
- `packages/core/src/ia/consumo.test.ts` › "cabe no `integer` de `consumo_ia.duracao_ms`: a execução esquecida há 40 dias leva o teto, e não um número que o `insert` recusa" e "abaixo do teto a duração é a medida, arredondada, e nunca negativa": a regra, sem banco.

## Correção

`packages/core/src/ia/consumo.ts`: `DURACAO_MAXIMA_DA_LINHA_MS = 2_147_483_647` e `consumoEstimadoDaInterrompida` limita `duracaoMs` a ele (`Math.min(DURACAO_MAXIMA_DA_LINHA_MS, …)`). É o ponto único por onde passam a reentrega (`encerrarRodando`) e a varredura (`encerrarRodandasVelhas`), e a linha continua superestimando (D14): o teto é a maior duração que a coluna guarda. Nenhuma migration, nenhum repository tocado, nenhuma query nova: o `update` e o `registrarEstimada` seguem na escola de cada execução, como antes.

Não mexi no `ia.int.test.ts`: o caso da 6.0 está certo, e passa com a causa removida (verificado sobre o banco novo com os dois arquivos anteriores e sobre o banco que eles deixam). O acúmulo de `pendente` antigas que o `expurgo-da-escola` deixa (2.672 linhas) pode, num banco que acumulou mais de 1.000 delas sem job, empurrar a `pendente` do caso para uma volta seguinte (o lote da volta é de 200 × 5 passes, por desenho); não aconteceu nas execuções acima e fica como recomendação, sem aplicar.

## Mutações

--faltando: 0 linhas (2 blocos, 0 motivos)

```mutacao
arquivo: packages/core/src/ia/consumo.ts
teste: packages/core/src/ia/consumo.test.ts › cabe no `integer` de `consumo_ia.duracao_ms`: a execução esquecida há 40 dias leva o teto, e não um número que o `insert` recusa
-    duracaoMs: Math.min(DURACAO_MAXIMA_DA_LINHA_MS, Math.max(0, Math.round(duracaoMs))),
+    duracaoMs: Math.max(0, Math.round(duracaoMs)),
```

```mutacao
arquivo: packages/core/src/ia/consumo.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › varredura, execução esquecida há mais de 24,8 dias: a `rodando` encerra com a duração no teto do inteiro da linha, e não trava a volta das outras `rodando`
-    duracaoMs: Math.min(DURACAO_MAXIMA_DA_LINHA_MS, Math.max(0, Math.round(duracaoMs))),
+    duracaoMs: Math.max(0, Math.round(duracaoMs)),
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (1ª) | Pôr uma `pendente` sem job no caso de integração | Recusada: a própria seção "Correção" deste documento mostra que a `pendente` do caso depende do acúmulo de `pendente` sem job que o `expurgo-da-escola` deixa (lote de 200 × 5); pô-la no caso novo o tornaria dependente da ordem dos arquivos. O caso da 6.0 em `ia.int.test.ts` já cobre a `pendente`. |
| revisor-geral (1ª), privacy-guardian (1ª), conformidade-reviewer (1ª), infra-guardian (1ª), test-engineer (1ª) | `expurgo-da-escola.int.test.ts` apagar o que semeia (ou o teste da 6.0 não depender da ordem dos arquivos); registrar a recomendação no `TODO.md` | `TODO.md`. Arquivo de outra tarefa (`apps/worker/test`), fora desta correção. |
| revisor-geral (1ª), privacy-guardian (1ª), conformidade-reviewer (1ª), infra-guardian (1ª), test-engineer (1ª) | O aviso `ia.execucao.varredura_falhou` não diz qual execução travou o lote: incluir o `execucaoId` (UUID) | `TODO.md`: muda `varredura-de-execucoes.ts`, que esta correção não toca, e o comportamento do log. |
| infra-guardian (1ª), test-engineer (1ª) | Isolar a falha por linha: `try` próprio para `#encerrarRodandas` e `#encerrarPendentes`; se o lote falhar, encerrar linha a linha | `TODO.md` (tarefa futura em `varredura-de-execucoes.ts`; muda o comportamento da varredura). |
| infra-guardian (1ª) | Métrica de falha da varredura, alerta para falha seguida em N voltas e parágrafo em `docs/runbook.md` | `TODO.md` (tarefa futura; muda o contrato de observabilidade e toca `docs/runbook.md`). |
| test-engineer (2ª) | Recolocar no caso da varredura (ou no da reentrega) o comentário que explicava os 40 dias | Recusada: contradiz o `revisor-geral` (1ª), que pediu tirar esse comentário porque repete o nome do teste e o JSDoc de `DURACAO_MAXIMA_DA_LINHA_MS`. |
| test-engineer (2ª) | Citar o teste novo da reentrega em "Teste que reproduz" | Recusada: ninguém reprovou na 2ª rodada; o teste da reentrega é segunda prova do mesmo teto. |
| revisor-geral (2ª) | Terceiro bloco em "Mutações", com a mesma mutação, para o caso da reentrega | Recusada: a cláusula já tem bloco, e a reentrega é uma segunda prova dela (test-engineer, 2ª). |
| revisor-geral (2ª) | No caso da reentrega, conferir que a execução gravou uma única linha | Recusada: ninguém reprovou; os outros `it` de reentrega do arquivo conferem a linha única. |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-16 07:58:26 | 2026-11-16 07:58:39 | `tenancy-guardian` | 1 | APROVADO | a81798177f8ad4691 |
| 2026-11-16 07:58:25 | 2026-11-16 07:58:46 | `revisor-geral` | 1 | APROVADO | ad996475691b3a1b5 |
| 2026-11-16 07:58:28 | 2026-11-16 07:58:47 | `privacy-guardian` | 1 | APROVADO | a3f42ad7721d41149 |
| 2026-11-16 07:58:29 | 2026-11-16 07:58:49 | `conformidade-reviewer` | 1 | APROVADO | aa22d3b37d4cbb775 |
| 2026-11-16 07:58:27 | 2026-11-16 07:58:58 | `infra-guardian` | 1 | APROVADO | a63535aa30f5e813c |
| 2026-11-16 07:58:23 | 2026-11-16 07:59:10 | `test-engineer` | 1 | APROVADO | ad7d2960e075971b6 |
| 2026-11-16 08:07:45 | 2026-11-16 08:08:08 | `revisor-geral` | 2 | APROVADO | a811cbd701d6ba149 |
| 2026-11-16 08:07:41 | 2026-11-16 08:08:19 | `test-engineer` | 2 | APROVADO | a725a5c52a6d5659d |
