# Tarefa 4.0 — Acima do teto de segurança só o lote espera, e a Operação é avisada a 80%, 100% e no teto

**Funcionalidade:** camada-ia · **Depende de:** 2.0
**Subagentes obrigatórios:** `tenancy-guardian`, `infra-guardian`, `llm-integrator`
**Porte:** grande

## Objetivo

Com o custo do mês acima de orçamento × teto ÷ 100, o job de lote da escola é adiado até a virada ou até o teto subir, e
nada mais para. A medida do worker publica o uso do mês e do teto por escola, regrava o retrato e alimenta três alertas
com runbook.

## Contexto necessário

- `techspec.md` §5 ("O teto de segurança"), §6 (a medida), §7 (o log), §7c (métrica e alerta, laços)
- `prd.md` RF9 (o lado da Operação), RF10, §7 ("Virada do mês")
- `cenarios.md` §1 RF8 (retrato), RF9 (a medida e os alertas, menos o da reserva), RF10 (todas), §2 ("Soma do mês", o
  lote de A segue e o de B é adiado), §3 (o retrato por duas réplicas)
- `.claude/rules/` 10, 30 (item 8), 80
- Código: `apps/api/src/ia/orcamento.repository.ts` (`OrcamentoQuery`), `apps/api/src/ia/execucao.processor.ts`
  (`JobAdiadoError`, motivos), `apps/worker/src/classificacao-gauge.ts` e o registro em `apps/worker/src/composition.ts`,
  `infra/grafana/alertas/classificacao-atrasada.yaml`

## Subtarefas

- [x] 4.1 — `OrcamentoQuery` ganha `fila`; só a `lote` confere o teto, pelo `OrcamentoDoMesRepository`; `IA_ORCAMENTO_ESGOTADO`
  com `tenteDeNovoEmSegundos = mín(até a virada de São Paulo, 3.600)`
- [x] 4.2 — O processador adia com motivo `orcamento`, sem contar tentativa; `ia.lote.adiado{motivo}`; log `ia.lote.adiado_pelo_orcamento` só com ids
- [x] 4.3 — `apps/worker/src/orcamento-gauge.ts`: `ia.orcamento.uso_do_mes{escola_id}` e `ia.orcamento.uso_do_teto{escola_id}`
  de uma soma só, e o retrato regravado com `on conflict`; sem série em escola `sem_orcamento` ou `sem_aluno_ativo`
- [x] 4.4 — Alertas `ia-orcamento-do-mes.yaml` (0,8 e 1,0) e `ia-orcamento-teto.yaml` (1,0), com os parágrafos do runbook;
  o do teto cita "Classificação do material atrasada"
- [x] 4.5 — `docs/runbook.md`, "Voltar o código depois da camada-ia 4.0": o lote adiado volta a correr
- [x] 4.6 — Nada em `packages/shared`: o código de erro entrou na 2.0
- [x] 4.7 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/ia/orcamento.repository.ts`, `apps/api/src/ia/execucao.processor.ts`, `apps/api/src/ia/ia-do-worker.module.ts` | alterado |
| `packages/core/src/ia/llm-gateway.ts`, `packages/core/src/ia/errors.ts` | alterado |
| `apps/api/src/ia/orcamento-teto.int.test.ts` | novo |
| `apps/worker/src/orcamento-gauge.ts`, `apps/worker/src/composition.ts`, `apps/worker/test/orcamento-gauge.int.test.ts` | novo e alterado |
| `infra/grafana/alertas/ia-orcamento-do-mes.yaml`, `infra/grafana/alertas/ia-orcamento-teto.yaml`, `infra/test/alertas.test.ts` | novo e alterado |
| `docs/runbook.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| teto 200%: no limite exato o lote segue; um micro acima, `pendente` com `JobAdiadoError(orcamento)`, sem tentativa, métrica +1 | I | `>`, não `>=` |  `apps/api/src/ia/orcamento-teto.int.test.ts` › teto 200%: no limite exato o lote segue; um micro acima, a execução volta a `pendente`… |
| às 23h50 do último dia: 600 s; no meio do mês: 3.600 | U e I | o `mín` |  `apps/api/src/ia/orcamento.repository.test.ts` › o que falta para a virada, em segundos, no fuso de São Paulo… (a conta, unidade); `apps/api/src/ia/orcamento-teto.int.test.ts` › a espera é a menor entre o que falta para a virada do mês e uma hora… (o `mín` pelo processador) |
| na virada, o adiado roda; com o teto subido, também | I | RF10 |  `apps/api/src/ia/orcamento-teto.int.test.ts` › na virada do mês o lote adiado roda; e com o teto subido pela Operação, também |
| `sem_orcamento` ou `sem_aluno_ativo`: nunca adiado | I | orçamento zero não é teto zero |  `apps/api/src/ia/orcamento-teto.int.test.ts` › escola `sem_orcamento` ou `sem_aluno_ativo`: o lote nunca é adiado pelo teto… |
| acima de 100% e do teto, `interativa`, `ferramenta` e `normal` são atendidas | I | só o lote |  `apps/api/src/ia/orcamento-teto.int.test.ts` › acima de 100% e do teto, `interativa`, `ferramenta` e `normal` são atendidas…; `apps/api/src/ia/orcamento-teto.int.test.ts` › acima do teto, uma ferramenta e um turno do Tutor, pelo processador e pelo gateway de verdade, terminam `concluida` e gravam consumo… (a `fila` chega ao gateway); `ia.int.test.ts` › o código do teto de segurança só adia a fila de lote…; `apps/api/src/ia/orcamento-teto.int.test.ts` › só o código do teto (e o provedor sem vaga) adia o lote… |
| A (20%) segue e B (111%, teto 100%) é adiada | I | escopo da soma |  `apps/api/src/ia/orcamento-teto.int.test.ts` › a A (20%, teto de R$ 1.000) segue e a B (111%, teto de R$ 900) é adiada… |
| a medida publica 0,79 → 0,81 → 1,02 para a escola certa | I | a série |  `apps/worker/test/orcamento-gauge.int.test.ts` › a medida publica 0,79 → 0,81 → 1,02 para a escola certa…; › montada no worker de lote… |
| escola `sem_orcamento` e `sem_aluno_ativo`: nenhuma série | I | sem divisão por zero |  `apps/worker/test/orcamento-gauge.int.test.ts` › a escola `sem_orcamento` e a `sem_aluno_ativo` não têm série nenhuma…; › a escola que deixa de ter orçamento perde as duas séries…; › a lista de escolas que falha zera as duas séries |
| o retrato às 21h30 do último dia grava o mês que acaba; duas réplicas, uma linha | I | o mês de São Paulo; `on conflict` |  `apps/worker/test/orcamento-gauge.int.test.ts` › o retrato às 21h30 do último dia grava o mês que acaba…; › duas réplicas da medida regravando o mesmo mês… |
| os alertas têm expressão, `for:`, `noDataState = OK` e runbook; o do teto cita "Classificação do material atrasada" | U | o alerta |  `infra/test/alertas.test.ts` › são as das Tech Specs, com o `for:` e o limiar declarados…; `tools/guardas/alerta-tem-runbook.test.ts` › no repositório, cada arquivo de `infra/grafana/alertas/` tem entrada correspondente em `docs/runbook.md`, completa |

## Como testar

- Adiamento: `apps/api/src/material/classificacao.int.test.ts` › "balde cheio (a recusa antes da chamada): a execução volta
  a `pendente`, o job é adiado com motivo `provedor`…" — troque o motivo por `orcamento` e o balde pelo custo semeado
- Relógio falso e virada: o mesmo arquivo › "o job que volta às 10h05 de segunda…"
- Medida: `apps/worker/test/importacao-gauge.int.test.ts` › "a importação de B não aparece na série de A…" e
  › "montada no worker de lote…"
- Alerta: `infra/test/alertas.test.ts` › "são as das Tech Specs, com o `for:` e o limiar declarados…";
  `tools/guardas/alerta-tem-runbook.test.ts`
- Retrato em corrida: `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`)
- `npx vitest run --project integracao apps/api/src/ia/orcamento-teto.int.test.ts apps/worker/test/orcamento-gauge.int.test.ts`

## Fora do escopo desta tarefa

O alerta da reserva (9.0); as telas (7.0, 8.0); o corte do Tutor (D38, não muda).

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas antes de codar e conferidas no fim.

1. **Mutações:** a seção "Mutações" abaixo tem um bloco por cláusula do diff (a escolha da fila, o `null` do orçamento, a negação do teto, o `>`, o `* 100n`, os dois lados do `mín`, as quatro contas da virada, os dois termos do `adiavelPeloOrcamento`, o motivo do adiamento, as duas contagens, as duas séries da medida e o registro no worker), e o `--faltando` está em 0 linhas; os termos que são só estreitamento de tipo estão com o motivo escrito.
2. **Texto na tela:** não se aplica, a tarefa não tem tela. Os títulos e o runbook dos alertas são texto para a Operação, conferidos em `infra/test/alertas.test.ts` e em `tools/guardas/alerta-tem-runbook.test.ts`.
3. **Segundo dado:** duas escolas com valor, alunos e teto diferentes (A a 20% do teto e B a 111%), no lote e na medida; o mês que acaba e o que começa; o custo no limite exato e um micro acima; a escola `sem_orcamento` e a `sem_aluno_ativo` com gasto enorme.
4. **Checagem anterior que responde antes:** o processador confere a janela letiva e a suspensão da função antes do gateway, e o teste põe o horário fora da janela da escola; a recusa do teto sai do gateway, antes de qualquer chamada ao modelo, e o caso confere que não há linha em `consumo_ia`.
5. **Asserção no resultado:** os casos comparam a execução no banco (`pendente`, sem consumo, `falhas_seguidas` 0), o `JobAdiadoError` devolvido (motivo e `baseMs`), a série publicada pelo medidor e o retrato gravado; nenhum compara texto de arquivo.
6. **Guarda nova:** não há regra de lint nem guarda nova; o que vale são as listas fechadas que já existem e foram atualizadas (`METRICS_WITH_ESCOLA`, `metrics.test.ts`, `NOMES_NO_PROMETHEUS`, `REGRAS_PROVISIONADAS`, a lista de `alerta-tem-runbook.test.ts`), e a lista fechada do lote (`['classificar_secoes']`): comando novo no lote reabre a conta da correção de objetiva.
7. **Comentários que afirmam o que o código não faz:** reli o docblock do `OrcamentoRepository`, do `JobAdiadoError`/`MotivoDoAdiamento`, do `OrcamentoGauge`, do processador e o comentário de `IA_ORCAMENTO_ESGOTADO` (que ainda dizia "esse é o desenho da 4.0"), e o título do caso das duas réplicas da 2.0, que prometia "a do último valor" sem provar qual valor fica.
8. **Divergências:** uma, abaixo, já na `techspec.md` e no `cenarios.md`. O que não é regra e por isso não é divergência: o comentário de `IA_ORCAMENTO_ESGOTADO` em `error-code.ts`, que o `TODO.md` pediu à 4.0 conferir (só o comentário foi reescrito; código, mensagem e status não mudaram, e a 4.6 segue valendo), e os arquivos fora de "Arquivos previstos": `packages/core/src/ia/consumo.ts` (o campo `fila` de `OrcamentoQuery` mora lá, e não em `errors.ts`), `packages/core/src/jobs/job-adiado.error.ts` (o motivo novo), `apps/api/src/ia/metricas-da-execucao.ts` e `packages/core/src/telemetry/metrics.ts` (o contador e as duas séries), as listas fechadas das métricas e dos alertas (`metrics.test.ts`, `tools/testes/metricas.ts`, `infra/test/metricas.int.test.ts`, `infra/scripts/ensaio-alertas.ts`, `tools/guardas/alerta-tem-runbook.test.ts`), o painel `infra/grafana/paineis/fundacao.json` (três painéis: toda métrica exportada tem painel), a lista de quem usa a rotina em `apps/api/test/architecture.test.ts`, a bancada `fila-de-ia.fixture.ts` (o orçamento do gateway passa a usar o relógio dela), o caso novo de `ia.int.test.ts` e o teste de unidade `apps/api/src/ia/orcamento.repository.test.ts` (a conta pura da virada, que saiu do arquivo de integração); `ia-do-worker.module.ts` e `errors.ts` não precisaram mudar.
9. **Peça que já existe:** a conta é a do `OrcamentoDoMesRepository` (2.0), o adiamento é o `JobAdiadoError` com motivo novo, a medida é uma `EscolaGauge` (a da `classificacao-gauge`), o alerta segue o molde de `classificacao-atrasada.yaml`, e `segundosAteAViradaDoMes` usa `diaDeSaoPaulo` e `FUSO_DO_ORCAMENTO` do `shared`; só o que é novo foi escrito.
10. **Concorrência:** o retrato regravado por duas réplicas cai na mesma chave com `on conflict do update` (2.0), e o caso da corrida usa `esperarNaTrava(…, 2)` (a primeira, parada no gatilho, e a segunda, esperando a chave única dela) para provar que a segunda espera, que a linha é uma só e que vale a do último valor. O teto não tem trava: as 2 vagas do lote podem passar do teto juntas, o que a Tech Spec §5 aceita.
11. **Isolamento:** a soma do teto parte de `requireEscolaId()` no `OrcamentoDoMesRepository`; o caso A e B (A segue, B é adiada, no mesmo mês) e o da medida, com duas escolas de números diferentes, ficam vermelhos se a soma deixar de ser por escola. Nenhuma tabela nova.
12. **Guardiões:** `tenancy-guardian` (o escopo vem do contexto; nenhum `@Unscoped`; o teto e a medida conferidos com A e B); `infra-guardian` (o lote espera sem gastar tentativa, as interativas nunca esperam, a medida é uma soma por escola a cada 5 min, três alertas com runbook e o de volta do código); `llm-integrator` (o teto confere antes da chamada, só no lote, o custo vem do que foi gravado, e o Tutor não é tocado).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| `ia.lote.adiado{motivo}` conta também os adiamentos por `janela` e por `provedor`, que já existiam e não somavam nada, e o código do teto numa fila que não é a do lote termina a execução como `falhou`, sem adiar | A spec fala de uma métrica por motivo; contar só `orcamento` deixaria o rótulo sem sentido (uma linha em cada ponto, no mesmo helper), e o adiamento só vale onde há o que adiar | `techspec.md:98` (§5, "O teto de segurança"); `cenarios.md:80` (RF10) |

## Mutações

`--faltando: 0 linhas (30 blocos, 2 motivos)`

Motivos (linha ou termo sem bloco, com o porquê):

- `tetoPercentual === null` em `orcamento.repository.ts` e em `orcamento-gauge.ts`, e `erro instanceof LLMError` em `execucao.processor.ts`: estreitamento de tipo, sem caso que o alcance. Escola com valor definido sempre tem teto (`orcamentoVigente` cai no padrão de 200%), e o `adiavelNoLote`, ao lado, faz o mesmo com o `instanceof`; outro erro não traz `codigoDeIa`. Tirar o termo deixa o comportamento igual.
- `import`, o campo `fila?` do `OrcamentoQuery`, o motivo novo de `MotivoDoAdiamento`, o contador `ia.lote.adiado` e as constantes de `metrics.ts`: declaração de tipo e de nome de métrica, sem cláusula a mutar; os nomes são provados pelas listas fechadas (`metrics.test.ts`, `infra/test/metricas.int.test.ts`) e o valor que o contador soma, pelos blocos de `loteAdiado` acima.

```mutacao
arquivo: apps/api/src/ia/orcamento.repository.ts
teste: apps/api/src/ia/orcamento-teto.int.test.ts › teto 200%: no limite exato o lote segue
-    if (consulta.fila === 'lote') return this.#tetoDeSeguranca()
+    if (consulta.fila === 'nunca') return this.#tetoDeSeguranca()
```

```mutacao
arquivo: apps/api/src/ia/orcamento.repository.ts
teste: apps/api/src/ia/orcamento-teto.int.test.ts › acima de 100% e do teto
-    if (consulta.fila === 'lote') return this.#tetoDeSeguranca()
+    if (consulta.fila !== undefined) return this.#tetoDeSeguranca()
```

```mutacao
arquivo: apps/api/src/ia/orcamento.repository.ts
teste: apps/api/src/ia/orcamento-teto.int.test.ts › escola `sem_orcamento` ou `sem_aluno_ativo`
-    if (orcamentoMicros === null || tetoPercentual === null) return { permitido: true }
+    if (tetoPercentual === null) return { permitido: true }
```

```mutacao
arquivo: apps/api/src/ia/orcamento.repository.ts
teste: apps/api/src/ia/orcamento-teto.int.test.ts › teto 200%: no limite exato o lote segue
-    if (!acimaDoTeto) return { permitido: true }
+    if (acimaDoTeto) return { permitido: true }
```

```mutacao
arquivo: apps/api/src/ia/orcamento.repository.ts
teste: apps/api/src/ia/orcamento-teto.int.test.ts › teto 200%: no limite exato o lote segue
-    const acimaDoTeto = BigInt(custoMicros) * 100n > BigInt(orcamentoMicros) * BigInt(tetoPercentual)
+    const acimaDoTeto = BigInt(custoMicros) * 100n >= BigInt(orcamentoMicros) * BigInt(tetoPercentual)
```

```mutacao
arquivo: apps/api/src/ia/orcamento.repository.ts
teste: apps/api/src/ia/orcamento-teto.int.test.ts › teto 200%: no limite exato o lote segue
-    const acimaDoTeto = BigInt(custoMicros) * 100n > BigInt(orcamentoMicros) * BigInt(tetoPercentual)
+    const acimaDoTeto = BigInt(custoMicros) > BigInt(orcamentoMicros) * BigInt(tetoPercentual)
```

```mutacao
arquivo: apps/api/src/ia/orcamento.repository.ts
teste: apps/api/src/ia/orcamento-teto.int.test.ts › a espera é a menor entre
-    return { permitido: false, codigo: 'IA_ORCAMENTO_ESGOTADO', tenteDeNovoEmSegundos: Math.min(segundosAteAViradaDoMes(agora), ESPERA_MAXIMA_DO_TETO_SEGUNDOS) }
+    return { permitido: false, codigo: 'IA_ORCAMENTO_ESGOTADO', tenteDeNovoEmSegundos: segundosAteAViradaDoMes(agora) }
```

```mutacao
arquivo: apps/api/src/ia/orcamento.repository.ts
teste: apps/api/src/ia/orcamento-teto.int.test.ts › a espera é a menor entre
-    return { permitido: false, codigo: 'IA_ORCAMENTO_ESGOTADO', tenteDeNovoEmSegundos: Math.min(segundosAteAViradaDoMes(agora), ESPERA_MAXIMA_DO_TETO_SEGUNDOS) }
+    return { permitido: false, codigo: 'IA_ORCAMENTO_ESGOTADO', tenteDeNovoEmSegundos: ESPERA_MAXIMA_DO_TETO_SEGUNDOS }
```

```mutacao
arquivo: apps/api/src/ia/orcamento.repository.ts
teste: apps/api/src/ia/orcamento.repository.test.ts › o que falta para a virada, em segundos
-  const diasDoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
+  const diasDoMes = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate()
```

```mutacao
arquivo: apps/api/src/ia/orcamento.repository.ts
teste: apps/api/src/ia/orcamento.repository.test.ts › o que falta para a virada, em segundos
-  const faltamMs = ((diasDoMes - dia + 1) * SEGUNDOS_DO_DIA - desdeAMeiaNoite) * 1_000 - agora.getUTCMilliseconds()
+  const faltamMs = ((diasDoMes - dia) * SEGUNDOS_DO_DIA - desdeAMeiaNoite) * 1_000 - agora.getUTCMilliseconds()
```

```mutacao
arquivo: apps/api/src/ia/orcamento.repository.ts
teste: apps/api/src/ia/orcamento.repository.test.ts › o que falta para a virada, em segundos
-  const faltamMs = ((diasDoMes - dia + 1) * SEGUNDOS_DO_DIA - desdeAMeiaNoite) * 1_000 - agora.getUTCMilliseconds()
+  const faltamMs = ((diasDoMes - dia + 1) * SEGUNDOS_DO_DIA - desdeAMeiaNoite) * 1_000 + agora.getUTCMilliseconds()
```

```mutacao
arquivo: apps/api/src/ia/orcamento.repository.ts
teste: apps/api/src/ia/orcamento.repository.test.ts › o que falta para a virada, em segundos
-  return Math.ceil(faltamMs / 1_000)
+  return Math.floor(faltamMs / 1_000)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: apps/api/src/ia/orcamento-teto.int.test.ts › teto 200%: no limite exato o lote segue
-        ...(pedido.fila === undefined ? {} : { fila: pedido.fila }),
+        ...{},
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: apps/api/src/ia/orcamento-teto.int.test.ts › teto 200%: no limite exato o lote segue
-        ...(pedido.fila === undefined ? {} : { fila: pedido.fila }),
+        ...(pedido.fila === undefined ? {} : { fila: 'normal' }),
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: apps/api/src/ia/orcamento-teto.int.test.ts › acima do teto, uma ferramenta e um turno do Tutor
-        ...(pedido.fila === undefined ? {} : { fila: pedido.fila }),
+        ...(pedido.fila === undefined ? {} : { fila: 'lote' }),
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/orcamento-teto.int.test.ts › só o código do teto
-    if (erro instanceof LLMError && adiavelPeloOrcamento(erro, comando)) {
+    if (erro instanceof LLMError) {
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/ia.int.test.ts › o código do teto de segurança só adia a fila de lote
-  return comando?.fila === 'lote' && erro.codigoDeIa === ErrorCode.IA_ORCAMENTO_ESGOTADO
+  return erro.codigoDeIa === ErrorCode.IA_ORCAMENTO_ESGOTADO
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/orcamento-teto.int.test.ts › só o código do teto
-  return comando?.fila === 'lote' && erro.codigoDeIa === ErrorCode.IA_ORCAMENTO_ESGOTADO
+  return comando?.fila === 'lote'
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/orcamento-teto.int.test.ts › o log do adiamento
-    if (motivo === 'orcamento') logger.warn({ evento: 'ia.lote.adiado_pelo_orcamento', execucaoId, escolaId, tipo, codigo, esperaMs })
+    if (motivo !== 'orcamento') logger.warn({ evento: 'ia.lote.adiado_pelo_orcamento', execucaoId, escolaId, tipo, codigo, esperaMs })
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/orcamento-teto.int.test.ts › teto 200%: no limite exato o lote segue
-    throw new JobAdiadoError(esperaMs, motivo)
+    throw new JobAdiadoError(esperaMs, 'provedor')
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/orcamento-teto.int.test.ts › os três adiamentos do lote
-    this.#metricas.loteAdiado(motivo)
+    this.#metricas.loteAdiado('provedor')
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/orcamento-teto.int.test.ts › os três adiamentos do lote
-      this.#metricas.loteAdiado('janela')
+      this.#metricas.loteAdiado('provedor')
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/orcamento-teto.int.test.ts › os três adiamentos do lote
-      await this.#adiarOLote(erro, { execucaoId, escolaId, tipo }, 'orcamento')
+      await this.#adiarOLote(erro, { execucaoId, escolaId, tipo }, 'provedor')
```

```mutacao
arquivo: apps/worker/src/orcamento-gauge.ts
teste: apps/worker/test/orcamento-gauge.int.test.ts › a escola `sem_orcamento` e a `sem_aluno_ativo`
-    if (orcamentoMicros === null || tetoPercentual === null) return undefined
+    if (tetoPercentual === null) return undefined
```

```mutacao
arquivo: apps/worker/src/orcamento-gauge.ts
teste: apps/worker/test/orcamento-gauge.int.test.ts › a medida publica 0,79
-    this.#daVolta.set(requireEscolaId(), custoMicros / ((orcamentoMicros * tetoPercentual) / 100))
+    this.#daVolta.set(requireEscolaId(), custoMicros / orcamentoMicros)
```

```mutacao
arquivo: apps/worker/src/orcamento-gauge.ts
teste: apps/worker/test/orcamento-gauge.int.test.ts › a medida publica 0,79
-    return custoMicros / orcamentoMicros
+    return custoMicros / ((orcamentoMicros * tetoPercentual) / 100)
```

```mutacao
arquivo: apps/worker/src/orcamento-gauge.ts
teste: apps/worker/test/orcamento-gauge.int.test.ts › a medida publica 0,79
-    this.#doTeto = this.#daVolta
+    this.#doTeto = this.#doTeto
```

```mutacao
arquivo: apps/worker/src/orcamento-gauge.ts
teste: apps/worker/test/orcamento-gauge.int.test.ts › a escola que deixa de ter orçamento perde as duas séries
-    this.#daVolta = new Map()
+    this.#daVolta = this.#daVolta
```

```mutacao
arquivo: apps/worker/src/orcamento-gauge.ts
teste: apps/worker/test/orcamento-gauge.int.test.ts › a escola `sem_orcamento` e a `sem_aluno_ativo`
-    const orcamento = await this.dependencias.repositorio.regravarRetrato(agora)
+    const orcamento = await (this.dependencias.repositorio as any).doMes('2026-11', agora)
```

```mutacao
arquivo: apps/worker/src/composition.ts
teste: apps/worker/test/orcamento-gauge.int.test.ts › montada no worker de lote
-          new OrcamentoGauge({ escolas, repositorio: new OrcamentoDoMesRepository(banco), relogio, logger, medidor }),
+          new OrcamentoGauge({ escolas: { listIds: async () => [] }, repositorio: new OrcamentoDoMesRepository(banco), relogio, logger, medidor }),
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian 1ª | O caso A/B prova o escopo da soma do custo; o da contagem de alunos e do valor por aluno fica só nos testes da 2.0 | Recusada: já provado em `packages/core/src/ia/orcamento-do-mes.repository.int.test.ts` (2.0); a 4.0 não toca essa conta |
| privacy-guardian 1ª | `summary` dos alertas leva `escola_id` ao canal; registrar o canal na lista de suboperadores de `docs/lgpd.md` quando for escolhido | `TODO.md` (vale para os alertas por escola que já existiam; é decisão da escolha do canal) |
| conformidade-reviewer 1ª | Texto do runbook do teto: nas telas da 7.0 e 8.0 deixar claro que é espera por orçamento, não falha da IA, sem sugerir decisão sobre aluno | Tarefas 7.0 e 8.0 (as telas) |
| conformidade-reviewer 1ª | Citar a lista fechada do lote (`orcamento-teto.int.test.ts`) como checagem da regra 70 itens 1 e 3 | `TODO.md`: mexe em `.claude/rules/70-conformidade-cne.md`, fora dos arquivos da tarefa |
| llm-integrator 1ª | Manter o teste da lista fechada como guarda quando a correção de objetiva entrar em lote | Nada a fazer: o teste já existe; a regra fica no `TODO.md` da correção de objetiva |
| llm-integrator 1ª | `ia.lote.adiado{motivo="orcamento"}` já dá a contagem para o painel da 7.0/8.0 | Tarefas 7.0 e 8.0 |
| revisor-geral 1ª, infra-guardian 1ª | No desligamento (`encerrar` no meio da volta) `uso_do_teto` troca por uma volta parcial e `uso_do_mes` não: as duas séries se separam por um instante | `TODO.md`: só no desligamento, sem efeito no alerta (`for: 1m`); mexe em código e caducaria todos os aprovados |
| revisor-geral 1ª | `segundosAteAViradaDoMes` monta um segundo `Intl.DateTimeFormat`; juntar com a unificação `diaDeSaoPaulo`/`diaDeUso` | `TODO.md` (a unificação já está lá) |
| revisor-geral 1ª | O runbook manda subir valor/teto por `PUT /v1/operacao/escolas/:id/orcamento-ia`, da 3.0 ainda aberta | Tarefa 3.0: conferir o passo do runbook quando ela fechar |
| infra-guardian 1ª | 4 consultas por chamada do lote (`doMes`); olhar a duração no staging no primeiro onboarding grande | `TODO.md` (staging) |
| infra-guardian 1ª | Sem trava, as 2 vagas do lote passam do teto juntas; rever se um comando de lote mais caro entrar | Nada a fazer: aceito na Tech Spec §5, e a lista fechada do lote trava comando novo |
| test-engineer 2ª | O caso novo cobre `ferramenta` e `interativa` pelo gateway, não `normal`; um terceiro item no laço fecharia o RF9 | `TODO.md`: a `normal` já é provada no repository, e a mutação do bloco novo de `llm-gateway.ts` pega a troca da `fila` |
| test-engineer 2ª, revisor-geral 2ª | O caso do log deixa passar chaves numéricas de envelope (`nivel`, `level`, `time`, `tempo`, `pid`); comparar o conjunto de chaves com uma lista fechada ou tirar do envelope do logger | `TODO.md`: só vira defeito se o logger ganhar chave numérica nova de envelope |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-21 05:06:48 | 2026-11-21 05:07:26 | `tenancy-guardian` | 1 | APROVADO | af9f31fd123f4144b |
| 2026-11-21 05:07:08 | 2026-11-21 05:07:46 | `privacy-guardian` | 1 | APROVADO | ac5927f22dbe64c22 |
| 2026-11-21 05:07:12 | 2026-11-21 05:07:51 | `conformidade-reviewer` | 1 | APROVADO | a78e2d0c6b51422d3 |
| 2026-11-21 05:06:56 | 2026-11-21 05:07:59 | `llm-integrator` | 1 | APROVADO | a12302b771985ca11 |
| 2026-11-21 05:07:04 | 2026-11-21 05:08:20 | `revisor-geral` | 1 | APROVADO | ae2227ccf51602e07 |
| 2026-11-21 05:06:52 | 2026-11-21 05:08:31 | `infra-guardian` | 1 | APROVADO | a5b13c7f890bd17dc |
| 2026-11-21 05:07:00 | 2026-11-21 05:09:33 | `test-engineer` | 1 | REPROVADO | a18fd1f462886c2ef |
| 2026-11-21 05:36:43 | 2026-11-21 05:37:05 | `revisor-geral` | 2 | APROVADO | a6b68a5875a752ea2 |
| 2026-11-21 05:36:36 | 2026-11-21 05:37:25 | `test-engineer` | 2 | APROVADO | aa08878d74bf8e472 |
