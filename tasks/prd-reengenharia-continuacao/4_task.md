# Tarefa 4.0 — O pedido acima do teto de entrada da tarefa é recusado antes de qualquer envio

**Funcionalidade:** reengenharia-continuacao · **Depende de:** 3.0
**Subagentes obrigatórios:** `infra-guardian`, `conformidade-reviewer`, `llm-integrator`, `frontend-reviewer`
**Porte:** grande

## Objetivo

Toda tarefa declara `maximoDeTokensDeEntrada`, pelo pior pedido válido. O gateway recusa o pedido acima dele com
`PEDIDO_ACIMA_DO_TETO`, antes do orçamento e do envio, sem `consumo_ia`; a tela mostra "Tentar de novo", e o Tutor não conta
a troca. `PASSAGEIROS` vai da web para `packages/shared`.

## Contexto necessário

- `techspec.md` §2 (linha `packages/core/src/ia/`), §8 (inteiro)
- `prd.md` RF7 ("nunca com erro cru"), RF8; regras 30, 40, 50, 70, 80
- `revisao-spec.md` rodada 6, "Recomendações para as tarefas": o 503 do `PEDIDO_ACIMA_DO_TETO` só importa se um caminho
  síncrono o devolver; diga qual, ou registre que não há
- Código: `packages/core/src/ia/task.ts` (`esquemaDeEntrada` l.48, `maximoDeTokensDeSaida` l.52, `montarPedido` l.66);
  `packages/core/src/ia/tasks/*.ts`; `packages/core/src/ia/llm-gateway.ts`; `packages/core/src/ia/errors.ts`
  (`LLM_ERROR_CODES`); `packages/shared/src/errors/error-code.ts`; `packages/core/src/error/domain.exception.ts`
  (`HTTP_STATUS_BY_CODE`); `apps/web/src/api/ciclo-de-execucao.ts` (`PASSAGEIROS` l.109, `aparenciaDaFalha` l.130)

## Subtarefas

- [x] 4.1 — `maximoDeTokensDeEntrada` obrigatório em `TaskDefinition`; o valor de cada tarefa sai do gerador do pior
  pedido (cada campo no limite do `esquemaDeEntrada`, montado pelo `montarPedido`, com o prompt)
- [x] 4.2 — A recusa no `LLMGateway`, antes do orçamento e do `fetch`; log `ia.geracao.pedido_acima_do_teto` com tarefa e
  ids; métrica `ia.pedido_acima_do_teto{tarefa}`
- [x] 4.3 — `PEDIDO_ACIMA_DO_TETO` em `LLM_ERROR_CODES`, no `ErrorCode` de `shared` e em `HTTP_STATUS_BY_CODE` (503);
  `PASSAGEIROS` em `packages/shared/src/tutor/` (ou `system/`), com o código novo; a web importa de lá.
  Busca: `grep -rn "PASSAGEIROS" apps/web/src e2e docs`
- [x] 4.4 — Alerta `infra/grafana/alertas/ia-pedido-acima-do-teto.yaml` e o parágrafo do `docs/runbook.md`
- [x] 4.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/ia/teto-de-entrada.ts`, `packages/core/src/ia/teto-de-entrada.test.ts`, `packages/shared/src/tutor/passageiros.ts`, `packages/shared/src/tutor/passageiros.test.ts`, `infra/grafana/alertas/ia-pedido-acima-do-teto.yaml`, `apps/api/src/ia/teto-de-entrada.int.test.ts` | novo |
| `packages/core/src/ia/task.ts`, `packages/core/src/ia/tasks/adaptar-atividade.ts`, `gerar-atividade-objetiva.ts`, `gerar-plano-de-aula.ts`, `propor-ferramenta.ts`, `relatorio-da-correcao.ts`, `resumo-do-analista.ts`, `turno-do-tutor.ts` (todos em `packages/core/src/ia/tasks/`), `packages/core/src/ia/llm-gateway.ts`, `packages/core/src/ia/llm-gateway.test.ts`, `packages/core/src/ia/errors.ts`, `packages/core/src/error/domain.exception.ts`, `packages/shared/src/errors/error-code.ts`, `packages/shared/src/errors/messages.ts`, `packages/shared/src/index.ts`, `apps/web/src/api/ciclo-de-execucao.ts`, `apps/web/src/api/ciclo-de-execucao.test.ts`, `infra/test/alertas.test.ts`, `docs/runbook.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| pior pedido cabe | U | por tarefa, o pior pedido válido cabe no teto. Mutação: um teto abaixo do pior pedido | `packages/core/src/ia/teto-de-entrada.test.ts` › `<tarefa>: o pior pedido cabe no teto, e o teto não sobra mais que a margem` (uma por tarefa) |
| gerador, quem contorna | U | string sem `max`, array sem `max`, campo aninhado ou em união sem limite: falha, um caso por forma | `teto-de-entrada.test.ts` › `string sem max`, `array sem max`, `campo aninhado sem limite…`, `campo sem limite num braço de união…`, `campo opcional e anulável sem limite`, `o que o gerador não sabe montar também falha…` |
| gerador, alvo some | U | sem `esquemaDeEntrada`, ou catálogo vazio: vermelho | `teto-de-entrada.test.ts` › `o catálogo tem as tarefas do contrato…`, `tarefa sem esquemaDeEntrada é vermelho…`, `o valor que nem passa no próprio esquema é vermelho…` |
| acima do teto | U | nenhum `fetch`, orçamento não consultado, sem `consumo_ia`, métrica +1 | `packages/core/src/ia/llm-gateway.test.ts` › `acima do teto: PEDIDO_ACIMA_DO_TETO, nenhuma chamada ao modelo, orçamento não consultado, sem consumo, métrica +1 na tarefa` |
| a tarefa sem teto não compila | U | `@ts-expect-error` | `teto-de-entrada.test.ts` › `a tarefa sem maximoDeTokensDeEntrada não compila` |
| o status | U | `HTTP_STATUS_BY_CODE.PEDIDO_ACIMA_DO_TETO === 503`; a tarefa diz o caminho síncrono que o devolve, ou registra que não há | `llm-gateway.test.ts` › `cada código de IA é um código do contrato da API, com o status dele` |
| Tutor | I | o turno recusado acima do teto (teto rebaixado na definição injetada) não conta como troca | `apps/api/src/ia/teto-de-entrada.int.test.ts` › `o turno recusado acima do teto termina falhou com o código, sem resposta nem consumo, e a pergunta não conta como troca do dia` |
| a tela | U | `aparenciaDaFalha('PEDIDO_ACIMA_DO_TETO') === 'fila'` ("Tentar de novo"). Mutação: deixar o código fora de `PASSAGEIROS` | `apps/web/src/api/ciclo-de-execucao.test.ts` › `o pedido acima do teto de entrada é defeito nosso e a tela oferece tentar de novo, nunca o erro cru` |
| `PASSAGEIROS` fixada | U | em `shared`, a lista inteira, com `IA_SAIDA_INVALIDA`, `IA_ENTRADA_INVALIDA` e `PEDIDO_ACIMA_DO_TETO`. Mutação: tirar um código | `packages/shared/src/tutor/passageiros.test.ts` › `é a lista inteira, com os três de entrada e de teto da IA` |
| métrica | U | só o rótulo `tarefa`; nenhum usuário nem escola | `llm-gateway.test.ts` › `a métrica leva só o rótulo tarefa: nenhuma escola, execução nem usuário` |
| log | U | a linha da recusa leva tarefa, ids e código; nunca entrada nem prompt (regra 20, item 9) | `llm-gateway.test.ts` › `o log da recusa leva a tarefa, os ids e o código; nunca a entrada nem o prompt (regra 20, item 9)` |
| alerta | U | `infra/test/alertas.test.ts` tem a regra nova; `alerta-tem-runbook.test.ts` acha o parágrafo. Mutação: trocar o limiar | `infra/test/alertas.test.ts` › `são as das Tech Specs, com o for: e o limiar declarados…`; `tools/guardas/alerta-tem-runbook.test.ts` › `no repositório, cada arquivo de infra/grafana/alertas/ tem entrada correspondente…` |

## Como testar

- Gateway: `packages/core/src/ia/llm-gateway.test.ts` › "entrada com nome de aluno é recusada, o modelo não é chamado e o
  orçamento não é consultado" — a mesma forma, com o teto
- Status: › "cada código de IA é um código do contrato da API, com o status dele"
- Tela: `apps/web/src/api/ciclo-de-execucao.test.ts` › "o envio recusado guarda o código do catálogo, e nunca o erro cru"
- Tutor sem troca: `apps/api/src/ia/ia.int.test.ts` › "recusa a 61ª troca do aluno no dia… a pergunta que falhou não conta"
- Comandos: `npx vitest run --project unidade packages/core/src/ia/llm-gateway.test.ts`; `npx vitest run --project integracao apps/api/src/ia/teto-de-entrada.int.test.ts`
- Armadilha: o caso "acima do teto" precisa de um pedido que passe pelo `esquemaDeEntrada` e mesmo assim exceda o teto; rebaixe o teto na definição injetada, não estoure o esquema

## Autoconferência

1. **Mutação de cada cláusula:** a seção "Mutações" tem um bloco por cláusula do diff (a chamada à recusa e a ordem antes do orçamento, o `<=`, a regra fixa que não passa por ela, o código, a métrica, o log, cada forma sem limite do gerador, cada ramo de `retirarCampo`, o teto de cada tarefa, `PASSAGEIROS`, o alerta). O `--faltando` não aponta nenhuma linha. À mão: o campo de `task.ts` (só tipo, provado pelo `@ts-expect-error`), o `medidor` das duas interfaces e do `app.module.ts`/`ia.module.ts` (a prova é o caso de integração que lê a métrica), e o campo `maximoDeTokensDeEntrada` de cada uma das sete tarefas (o teste por tarefa).
2. **Texto na tela:** a tarefa não acrescenta texto novo à tela. A mensagem do catálogo (`PEDIDO_ACIMA_DO_TETO`) é a mesma dos outros códigos de falha nossa, e `grep -rln "Tentar de novo" e2e/` não muda com ela.
3. **Segundo dado:** o caso do Tutor tem dois alunos (um com 59 perguntas no dia e teto rebaixado, outro com o teto normal que conclui), e o gerador tem um caso por forma de campo, inclusive a união com um braço sem limite.
4. **Checagem anterior:** o caso "acima do teto" do gateway usa entrada que passa pelo esquema e pela checagem do nome de aluno; o controle com o teto normal conclui (o caso do Tutor, 2º `it`), então a recusa vem do teto. O orçamento e o `fetch` são espiados e não são chamados.
5. **Asserção:** as asserções olham o estado final da execução (`falhou`/`PEDIDO_ACIMA_DO_TETO`), a ausência de `consumo_ia` e de resposta depois de `executor.ociosa()`, e a contagem de trocas pela consulta real do orçamento, não o texto do código.
6. **Guarda nova:** o gerador falha em campo sem limite, e `teto-de-entrada.test.ts` tem um caso para cada forma que ele conhece (string, array, aninhado, união, opcional/anulável, regex, formato, record, catchall, unknown) e para o alvo que some (tarefa sem esquema, valor que não passa no esquema, campo que não se retira).
7. **Comentários:** o docblock de `teto-de-entrada.ts` diz o que o gerador faz (falha, não adivinha), e o de `domain.exception.ts`/`error-code.ts`/`docs/mvp-contratos.md` diz que nenhuma rota síncrona devolve o 503 (a execução roda em segundo plano e o código vai para `execucao_agente.erro`).
8. **Divergências:** as três linhas da tabela têm a decisão no `techspec.md` §2/§8 e em `cenarios.md`; o `prd.md` não diz o contrário (o PRD §8 pede que as métricas de IA não levem escola nem usuário, e a nova leva só `tarefa`).
9. **Peça que já existe:** `estimarTokens` (`fake-adapter.ts`) e `montarMensagens` (`openai-compat-adapter.ts`) são reaproveitados; o `PASSAGEIROS` sai da web para o `shared`, e não é copiado.
10. **Concorrência:** a recusa não grava nada nem toma vaga; não há operação que corra em paralelo (a conta é pura sobre a entrada). Sem corrida a provar.
11. **Isolamento e "Caso":** a tarefa não cria repository nem query; o escopo de tenant não muda (o log leva `escolaId` do contexto, a métrica não leva escola). A tabela de testes tem o caso de cada linha na coluna "Caso".
12. **Guardiões e achados:** o `achados/indice.md` não tem linha de revisão desta tarefa (só `revisao-spec`, `1_task` e `3_task`, que não tocam o gateway). `infra-guardian`: a recusa vem antes do limitador e do envio, o alerta tem runbook; `conformidade-reviewer`: nada de nota nem decisão sobre aluno, o Tutor não perde a vez; `llm-integrator`: sem SDK, sem provedor pago, a execução registra o código; `frontend-reviewer`: a tela cai em "Tentar de novo" (`aparenciaDaFalha === 'fila'`), nunca o erro cru.

## Fora do escopo desta tarefa

O limitador de tokens (10.0), que reserva pela estimativa do pedido real (§5), e não pelo teto; a contagem no uso do Tutor (9.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O teto do Analista é o valor do gerador, 642.267 tokens (100 recortes × 60 habilidades × 300 caracteres), e o schema dele não muda | Triagem do Arquiteto: a spec está certa. A 10.0 reserva pelo pedido real (caracteres ÷ 4 + saída), e não pelo teto, que só serve à guarda de defeito e à linha estimada da execução interrompida | `techspec.md` §8 ("O teto do Analista"), §5 "Os tokens (49.0)" |
| Entram também, fora da lista de previstos, porque inventários fechados os exigem: `tools/testes/metricas.ts` (`NOMES_NO_PROMETHEUS`, uma chave por métrica de `METRICS`), `infra/grafana/paineis/fundacao.json` (o painel de cada métrica: `painel.test.ts` reprova a métrica sem gráfico), `infra/scripts/ensaio-alertas.ts` (`REGRAS_PROVISIONADAS`), `tools/guardas/alerta-tem-runbook.test.ts` (a lista dos arquivos e dos títulos de alerta), `docs/mvp-contratos.md` (a lista dos códigos com status), e `apps/api/src/app.module.ts` e `ia.module.ts` (o medidor chega ao gateway) | Teste de lista fechada vermelho, ou o medidor sem caminho até o gateway | `techspec.md` §2 (linha `packages/core/src/ia/`), §8 (a métrica `ia.pedido_acima_do_teto`) |
| `packages/shared/src/governanca/analista.ts` entra entre os alterados: a `disciplina.nome` do recorte, do recorte nominal e do alerta ganha `.max(TAMANHO_MAXIMO_NOME_DISCIPLINA)` | O gerador falha em campo sem limite, e era o único do Analista (o cadastro já limita o nome a 80) | `techspec.md` §8 (o gerador falha se algum campo do esquema não tem limite) |

## Mutações

--faltando: 27 linhas (23 blocos, 4 motivos)

Um bloco por cláusula do diff: a recusa no gateway (a chamada, a ordem antes do orçamento, o `<=`, a regra fixa que não passa por ela, o código, a métrica e o log), o gerador do pior pedido (cada forma de campo sem limite, cada ramo de `retirarCampo`), o teto de cada tarefa (abaixo do pior pedido, e um acima da margem), os códigos do contrato, o alerta, o painel, o runbook e a fiação do medidor.

Sem bloco, com o motivo (o `--faltando` aceita a crase igual ao termo). São termos de `retirarCampo` que a guarda seguinte repete ou que dão o mesmo `return false`; nenhum muda o resultado de `piorEntradaDaTarefa`:

- `typeof atual !== 'object'`, no laço e na guarda final: o caminho que o zod devolve termina no campo que ele recusa, dentro de um objeto, e nunca dentro de um primitivo; por isso nenhum caso do esquema real o alcança com um primitivo, e o termo só serve de rede. Sem ele, um primitivo no laço vira `undefined` ao indexar (e a guarda final o devolve com `return false`), mas na guarda final uma **string** quebraria: `Object.hasOwn('aaa', 'length')` e `Object.hasOwn('aaa', '0')` dão `true`, e o `Reflect.deleteProperty` lança `TypeError`. Só o `null` quebra com os caminhos reais, e o `atual === null` tem bloco.
- `ultima === undefined`: o caminho vazio (regra na raiz) dá `Object.hasOwn(atual, undefined)` falso, e o `return false` sai de qualquer forma.
- `!Object.hasOwn(atual, ultima)`: é o que faz o laço terminar quando o campo recusado não existe (sem ele o `Reflect.deleteProperty` devolveria `true` e o laço não acabaria). Mutá-lo trava o portão em laço síncrono, que o `testTimeout` do vitest não interrompe, e por isso não vira bloco. O ramo tem caso próprio, `a regra que recusa sempre o mesmo campo opcional: ele é retirado uma vez, e na volta seguinte o gerador fica vermelho`: a regra recusa `b` sempre, o gerador o retira na primeira volta, e na segunda o campo já não existe e a guarda devolve `false`. O caso da raiz (`o valor que nem passa no próprio esquema é vermelho`) não o alcança, porque o caminho vazio sai antes, no `ultima === undefined`.

O que o `--faltando` não vê, conferido à mão: o campo `maximoDeTokensDeEntrada` da `TaskDefinition` (`task.ts`) é só tipo, e a prova é o `@ts-expect-error` de `teto-de-entrada.test.ts` (o `tsc` do portão, e não o vitest); o `medidor` em `LLMGatewayDependencies` e em `LLMGatewayPorts`, o `export` de `PASSAGEIROS` em `shared/src/index.ts` e o `import` da web são tipo e re-exportação, sem condição; o `globalMeter()` do `ia.module.ts` só vale em produção, e a fiação do `medidor` tem bloco.

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › acima do teto: PEDIDO_ACIMA_DO_TETO, nenhuma chamada ao modelo, orçamento não consultado, sem consumo, métrica
     const fixa = tarefa.semModelo?.(entrada)
     if (fixa === undefined) {
       // Antes do orçamento e do envio: o pedido que estoura o teto da tarefa é defeito nosso, e não gasta nada nem a vez de ninguém.
-      this.exigirPedidoDentroDoTeto(pedido, entrada, inicio)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › acima do teto: PEDIDO_ACIMA_DO_TETO, nenhuma chamada ao modelo, orçamento não consultado, sem consumo, métrica
falha: expect(consultar).not.toHaveBeenCalled()
-      this.exigirPedidoDentroDoTeto(pedido, entrada, inicio)
-      await this.exigirOrcamento(pedido, inicio)
+      await this.exigirOrcamento(pedido, inicio)
+      this.exigirPedidoDentroDoTeto(pedido, entrada, inicio)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › a regra fixa não manda nada ao modelo e não passa pelo teto: o aluno no assunto delicado recebe a mensagem mesmo com o teto estourado
     const fixa = tarefa.semModelo?.(entrada)
-    if (fixa === undefined) {
+    this.exigirPedidoDentroDoTeto(pedido, entrada, inicio)
+    if (fixa === undefined) {
-      // Antes do orçamento e do envio: o pedido que estoura o teto da tarefa é defeito nosso, e não gasta nada nem a vez de ninguém.
-      this.exigirPedidoDentroDoTeto(pedido, entrada, inicio)
       await this.exigirOrcamento(pedido, inicio)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o teto é inclusivo: o pedido do tamanho exato do teto passa, e um token a menos o recusa
-    if (tokensDoPedido(tarefa, entrada) <= tarefa.maximoDeTokensDeEntrada) return
+    if (tokensDoPedido(tarefa, entrada) < tarefa.maximoDeTokensDeEntrada) return
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o teto é inclusivo: o pedido do tamanho exato do teto passa, e um token a menos o recusa
-    if (tokensDoPedido(tarefa, entrada) <= tarefa.maximoDeTokensDeEntrada) return
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › acima do teto: PEDIDO_ACIMA_DO_TETO, nenhuma chamada ao modelo, orçamento não consultado, sem consumo, métrica
-    this.pedidosAcimaDoTeto?.add(1, { tarefa: tarefa.nome })
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › a métrica leva só o rótulo `tarefa`: nenhuma escola, execução nem usuário
-    this.pedidosAcimaDoTeto?.add(1, { tarefa: tarefa.nome })
+    this.pedidosAcimaDoTeto?.add(1, { tarefa: tarefa.nome, escolaId: pedido.escolaId })
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › acima do teto: PEDIDO_ACIMA_DO_TETO, nenhuma chamada ao modelo, orçamento não consultado, sem consumo, métrica
-    throw new LLMError('PEDIDO_ACIMA_DO_TETO')
+    throw new LLMError('IA_INDISPONIVEL')
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o log da recusa leva a tarefa, os ids e o código; nunca a entrada nem o prompt
-    this.dependencias.logger?.warn({ evento: 'ia.geracao.pedido_acima_do_teto', tipo, codigo: 'PEDIDO_ACIMA_DO_TETO', escolaId: pedido.escolaId, execucaoId: pedido.execucaoId, duracaoMs })
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o log da recusa leva a tarefa, os ids e o código; nunca a entrada nem o prompt
falha: not.toContain(entradaDeAtividade().trechos
-    this.dependencias.logger?.warn({ evento: 'ia.geracao.pedido_acima_do_teto', tipo, codigo: 'PEDIDO_ACIMA_DO_TETO', escolaId: pedido.escolaId, execucaoId: pedido.execucaoId, duracaoMs })
+    this.dependencias.logger?.warn({ evento: 'ia.geracao.pedido_acima_do_teto', tipo, codigo: 'PEDIDO_ACIMA_DO_TETO', escolaId: pedido.escolaId, execucaoId: pedido.execucaoId, duracaoMs, entrada })
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o log da recusa leva a tarefa, os ids e o código; nunca a entrada nem o prompt
falha: not.toContain(gerarAtividadeObjetiva.prompt.sistema
-    this.dependencias.logger?.warn({ evento: 'ia.geracao.pedido_acima_do_teto', tipo, codigo: 'PEDIDO_ACIMA_DO_TETO', escolaId: pedido.escolaId, execucaoId: pedido.execucaoId, duracaoMs })
+    this.dependencias.logger?.warn({ evento: 'ia.geracao.pedido_acima_do_teto', tipo, codigo: 'PEDIDO_ACIMA_DO_TETO', escolaId: pedido.escolaId, execucaoId: pedido.execucaoId, duracaoMs, prompt: tarefa.prompt.sistema })
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › acima do teto: PEDIDO_ACIMA_DO_TETO, nenhuma chamada ao modelo, orçamento não consultado, sem consumo, métrica
-    this.pedidosAcimaDoTeto = dependencias.medidor?.createCounter(METRICS.pedidoAcimaDoTeto, { description: 'Pedidos de IA recusados acima do teto de entrada da tarefa, por tarefa' })
+    this.pedidosAcimaDoTeto = undefined
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › acima do teto: PEDIDO_ACIMA_DO_TETO, nenhuma chamada ao modelo, orçamento não consultado, sem consumo, métrica
-    for (const tarefa of TAREFAS_DE_IA) this.pedidosAcimaDoTeto?.add(0, { tarefa })
```

```mutacao
arquivo: packages/core/src/telemetry/metrics.ts
teste: packages/core/src/ia/llm-gateway.test.ts › acima do teto: PEDIDO_ACIMA_DO_TETO, nenhuma chamada ao modelo, orçamento não consultado, sem consumo, métrica
-  pedidoAcimaDoTeto: 'ia.pedido_acima_do_teto',
+  pedidoAcimaDoTeto: 'ia.pedido_teto',
```

```mutacao
arquivo: packages/shared/src/errors/error-code.ts
teste: packages/core/src/ia/llm-gateway.test.ts › cada código de IA é um código do contrato da API, com o status dele
-  PEDIDO_ACIMA_DO_TETO: 'PEDIDO_ACIMA_DO_TETO',
+  PEDIDO_ACIMA_DO_TETO: 'PEDIDO_ACIMA',
```

```mutacao
arquivo: packages/shared/src/errors/messages.ts
teste: apps/web/src/api/ciclo-de-execucao.test.ts › o pedido acima do teto de entrada é defeito nosso e a tela oferece tentar de novo, nunca o erro cru
-  PEDIDO_ACIMA_DO_TETO: 'Não foi possível concluir agora. Tente de novo em instantes.',
+  PEDIDO_ACIMA_DO_TETO: 'Não foi possível concluir agora. Envie de novo.',
```

```mutacao
arquivo: packages/core/src/error/domain.exception.ts
teste: packages/core/src/ia/llm-gateway.test.ts › cada código de IA é um código do contrato da API, com o status dele
-  PEDIDO_ACIMA_DO_TETO: 503,
+  PEDIDO_ACIMA_DO_TETO: 500,
```

```mutacao
arquivo: packages/core/src/ia/errors.ts
teste: packages/core/src/ia/llm-gateway.test.ts › cada código de IA é um código do contrato da API, com o status dele
-  ErrorCode.PEDIDO_ACIMA_DO_TETO,
```

```mutacao
arquivo: packages/shared/src/tutor/passageiros.ts
teste: apps/web/src/api/ciclo-de-execucao.test.ts › o pedido acima do teto de entrada é defeito nosso e a tela oferece tentar de novo, nunca o erro cru
-  ErrorCode.PEDIDO_ACIMA_DO_TETO,
```

```mutacao
arquivo: packages/shared/src/tutor/passageiros.ts
teste: packages/shared/src/tutor/passageiros.test.ts › é a lista inteira, com os três de entrada e de teto da IA
-  ErrorCode.IA_ENTRADA_INVALIDA,
```

```mutacao
arquivo: apps/api/src/ia/ia.module.ts
teste: apps/api/src/ia/teto-de-entrada.int.test.ts › o turno recusado acima do teto termina falhou com o código, sem resposta nem consumo, e a pergunta não conta como troca do dia
-            createLLMGateway(config, { registro: new ConsumoRepository(banco), orcamento, suspensao, logger, medidor: opcoes.medidor ?? globalMeter() }),
+            createLLMGateway(config, { registro: new ConsumoRepository(banco), orcamento, suspensao, logger }),
```

```mutacao
arquivo: apps/api/src/app.module.ts
teste: apps/api/src/ia/teto-de-entrada.int.test.ts › o turno recusado acima do teto termina falhou com o código, sem resposta nem consumo, e a pergunta não conta como troca do dia
-        IaModule.forRoot({ config: config.ia, ...(opcoes.logger === undefined ? {} : { logger: opcoes.logger }), ...(opcoes.medidor === undefined ? {} : { medidor: opcoes.medidor }) }),
+        IaModule.forRoot({ config: config.ia, ...(opcoes.logger === undefined ? {} : { logger: opcoes.logger }) }),
```

```mutacao
arquivo: packages/core/src/ia/teto-de-entrada.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › campo sem limite num braço de união: o braço grande não esconde o sem limite
-  return (def.checks ?? []).map((verificacao) => verificacao._zod.def)
+  return (def.checks).map((verificacao) => verificacao._zod.def)
```

```mutacao
arquivo: packages/core/src/ia/teto-de-entrada.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › texto e lista no `max`, tamanho exato no `length`, número no maior, opcional presente e a união no maior braço
-  return valores.reduce((maior, valor) => (JSON.stringify(valor).length > JSON.stringify(maior).length ? valor : maior))
+  return valores.reduce((maior, valor) => (JSON.stringify(valor).length < JSON.stringify(maior).length ? valor : maior))
```

```mutacao
arquivo: packages/core/src/ia/teto-de-entrada.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › texto e lista no `max`, tamanho exato no `length`, número no maior, opcional presente e a união no maior braço
-  return verificacoes.find((verificacao) => verificacao.check === 'length_equals')?.length ?? verificacoes.find((verificacao) => verificacao.check === 'max_length')?.maximum
+  return verificacoes.find((verificacao) => verificacao.check === 'max_length')?.maximum
```

```mutacao
arquivo: packages/core/src/ia/teto-de-entrada.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › texto e lista no `max`, tamanho exato no `length`, número no maior, opcional presente e a união no maior braço
-  return verificacoes.find((verificacao) => verificacao.check === 'length_equals')?.length ?? verificacoes.find((verificacao) => verificacao.check === 'max_length')?.maximum
+  return verificacoes.find((verificacao) => verificacao.check === 'length_equals')?.length ?? undefined
```

```mutacao
arquivo: packages/core/src/ia/teto-de-entrada.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › texto e lista no `max`, tamanho exato no `length`, número no maior, opcional presente e a união no maior braço
-  if (conhecido !== undefined) return conhecido
```

```mutacao
arquivo: packages/core/src/ia/teto-de-entrada.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › o que o gerador não sabe montar também falha: formato livre, chaves livres e forma desconhecida
-  if (def.format !== undefined) throw new EntradaSemLimiteError(caminho, `string de formato "${def.format}", que o gerador não sabe montar`)
```

```mutacao
arquivo: packages/core/src/ia/teto-de-entrada.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › o que o gerador não sabe montar também falha: formato livre, chaves livres e forma desconhecida
-  if (deFormato !== undefined) throw new EntradaSemLimiteError(caminho, `string com regra de formato (${deFormato.format ?? '?'}), que o gerador não sabe montar`)
```

```mutacao
arquivo: packages/core/src/ia/teto-de-entrada.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › string sem `max`
-  if (tamanho === undefined) throw new EntradaSemLimiteError(caminho, 'string sem limite de tamanho (`max`)')
```

```mutacao
arquivo: packages/core/src/ia/teto-de-entrada.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › texto e lista no `max`, tamanho exato no `length`, número no maior, opcional presente e a união no maior braço
-  if (teto?.value === undefined) return Number.MAX_SAFE_INTEGER
```

```mutacao
arquivo: packages/core/src/ia/teto-de-entrada.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › o limite exclusivo fica abaixo do valor: o inteiro em uma unidade, o decimal em meia
-  return teto.inclusive === false ? (inteiro ? teto.value - 1 : teto.value - 0.5) : teto.value
+  return teto.inclusive === true ? (inteiro ? teto.value - 1 : teto.value - 0.5) : teto.value
```

```mutacao
arquivo: packages/core/src/ia/teto-de-entrada.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › o limite exclusivo fica abaixo do valor: o inteiro em uma unidade, o decimal em meia
-  return teto.inclusive === false ? (inteiro ? teto.value - 1 : teto.value - 0.5) : teto.value
+  return teto.inclusive === false ? (inteiro ? teto.value - 0.5 : teto.value - 1) : teto.value
```

```mutacao
arquivo: packages/core/src/ia/teto-de-entrada.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › array sem `max`
-  if (tamanho === undefined) throw new EntradaSemLimiteError(caminho, 'array sem limite de itens (`max`)')
```

```mutacao
arquivo: packages/core/src/ia/teto-de-entrada.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › texto e lista no `max`, tamanho exato no `length`, número no maior, opcional presente e a união no maior braço
-  if (def.catchall !== undefined && definicaoDe(def.catchall).type !== 'never') throw new EntradaSemLimiteError(caminho, 'objeto com chaves livres (`catchall`)')
+  if (definicaoDe(def.catchall).type !== 'never') throw new EntradaSemLimiteError(caminho, 'objeto com chaves livres (`catchall`)')
```

```mutacao
arquivo: packages/core/src/ia/teto-de-entrada.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › texto e lista no `max`, tamanho exato no `length`, número no maior, opcional presente e a união no maior braço
-  if (def.catchall !== undefined && definicaoDe(def.catchall).type !== 'never') throw new EntradaSemLimiteError(caminho, 'objeto com chaves livres (`catchall`)')
+  if (def.catchall !== undefined) throw new EntradaSemLimiteError(caminho, 'objeto com chaves livres (`catchall`)')
```

```mutacao
arquivo: packages/core/src/ia/teto-de-entrada.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › o que o gerador não sabe montar também falha: formato livre, chaves livres e forma desconhecida
-  if (valor === undefined) throw new EntradaSemLimiteError(caminho, `forma "${def.type}" sem limite que o gerador conheça`)
```

```mutacao
arquivo: packages/core/src/ia/teto-de-entrada.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › o campo que a regra recusa mas não dá para retirar é vermelho: no meio de um valor nulo, dentro de um array, ou na raiz
-    if (typeof atual !== 'object' || atual === null) return false
+    if (typeof atual !== 'object') return false
```

```mutacao
arquivo: packages/core/src/ia/teto-de-entrada.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › o campo que a regra recusa mas não dá para retirar é vermelho: no meio de um valor nulo, dentro de um array, ou na raiz
-  if (ultima === undefined || typeof atual !== 'object' || atual === null || Array.isArray(atual) || !Object.hasOwn(atual, ultima)) return false
+  if (ultima === undefined || typeof atual !== 'object' || Array.isArray(atual) || !Object.hasOwn(atual, ultima)) return false
```

```mutacao
arquivo: packages/core/src/ia/teto-de-entrada.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › o campo que a regra recusa mas não dá para retirar é vermelho: no meio de um valor nulo, dentro de um array, ou na raiz
-  if (ultima === undefined || typeof atual !== 'object' || atual === null || Array.isArray(atual) || !Object.hasOwn(atual, ultima)) return false
+  if (ultima === undefined || typeof atual !== 'object' || atual === null || !Object.hasOwn(atual, ultima)) return false
```

```mutacao
arquivo: packages/core/src/ia/teto-de-entrada.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › tarefa sem `esquemaDeEntrada` é vermelho, e não teto sem prova
-  if (esquema === undefined) throw new EntradaSemLimiteError(tarefa.nome, 'tarefa sem `esquemaDeEntrada`')
```

```mutacao
arquivo: packages/core/src/ia/teto-de-entrada.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › o pedido de cada tarefa passa pelo esquema de entrada, com o campo opcional que o esquema aceita presente
-    if (lida.success) return lida.data
```

```mutacao
arquivo: packages/core/src/ia/teto-de-entrada.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › a regra cruzada que recusa um campo opcional o retira: o pior pedido válido segue sem ele
-    if (!retirou) {
+    if (retirou) {
```

```mutacao
arquivo: packages/core/src/ia/tasks/relatorio-da-correcao.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › relatorio_da_correcao: o pior pedido cabe no teto, e o teto não sobra mais que a margem
-  maximoDeTokensDeEntrada: 3200,
+  maximoDeTokensDeEntrada: 3100,
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › propor_ferramenta: o pior pedido cabe no teto, e o teto não sobra mais que a margem
-  maximoDeTokensDeEntrada: 18200,
+  maximoDeTokensDeEntrada: 18100,
```

```mutacao
arquivo: packages/core/src/ia/tasks/gerar-atividade-objetiva.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › gerar_atividade_objetiva: o pior pedido cabe no teto, e o teto não sobra mais que a margem
-  maximoDeTokensDeEntrada: 26100,
+  maximoDeTokensDeEntrada: 26000,
```

```mutacao
arquivo: packages/core/src/ia/tasks/gerar-plano-de-aula.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › gerar_plano_de_aula: o pior pedido cabe no teto, e o teto não sobra mais que a margem
-  maximoDeTokensDeEntrada: 26100,
+  maximoDeTokensDeEntrada: 26000,
```

```mutacao
arquivo: packages/core/src/ia/tasks/adaptar-atividade.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › adaptar_atividade: o pior pedido cabe no teto, e o teto não sobra mais que a margem
-  maximoDeTokensDeEntrada: 22900,
+  maximoDeTokensDeEntrada: 22800,
```

```mutacao
arquivo: packages/core/src/ia/tasks/turno-do-tutor.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › turno_do_tutor: o pior pedido cabe no teto, e o teto não sobra mais que a margem
-  maximoDeTokensDeEntrada: 24300,
+  maximoDeTokensDeEntrada: 24200,
```

```mutacao
arquivo: packages/core/src/ia/tasks/resumo-do-analista.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › resumo_do_analista: o pior pedido cabe no teto, e o teto não sobra mais que a margem
-  maximoDeTokensDeEntrada: 642300,
+  maximoDeTokensDeEntrada: 642200,
```

```mutacao
arquivo: packages/core/src/ia/tasks/turno-do-tutor.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › turno_do_tutor: o pior pedido cabe no teto, e o teto não sobra mais que a margem
-  maximoDeTokensDeEntrada: 24300,
+  maximoDeTokensDeEntrada: 30000,
```

```mutacao
arquivo: packages/shared/src/governanca/analista.ts
teste: packages/core/src/ia/teto-de-entrada.test.ts › resumo_do_analista: o pior pedido cabe no teto, e o teto não sobra mais que a margem
-const disciplinaDoRecorteSchema = z.strictObject({ id: z.uuid(), nome: z.string().min(1).max(TAMANHO_MAXIMO_NOME_DISCIPLINA) })
+const disciplinaDoRecorteSchema = z.strictObject({ id: z.uuid(), nome: z.string().min(1) })
```

```mutacao
arquivo: infra/grafana/alertas/ia-pedido-acima-do-teto.yaml
teste: infra/test/alertas.test.ts › são as das Tech Specs, com o `for:` e o limiar declarados
-                    params: [0]
+                    params: [5]
```

```mutacao
arquivo: infra/grafana/alertas/ia-pedido-acima-do-teto.yaml
teste: infra/test/alertas.test.ts › são as das Tech Specs, com o `for:` e o limiar declarados
-              expr: 'sum by (tarefa) (increase(ia_pedido_acima_do_teto_total[10m]))'
+              expr: 'sum by (tarefa) (increase(ia_pedido_acima_do_teto_total[1h]))'
```

```mutacao
arquivo: infra/scripts/ensaio-alertas.ts
teste: infra/test/alertas.test.ts › são as das Tech Specs, com o `for:` e o limiar declarados
-  iaPedidoAcimaDoTeto: 'educa-ia-pedido-acima-do-teto',
```

```mutacao
arquivo: tools/testes/metricas.ts
teste: infra/test/painel.test.ts › toda métrica do código tem painel: nenhuma é exportada sem que alguém a veja
-  pedidoAcimaDoTeto: ['ia_pedido_acima_do_teto_total'],
```

```mutacao
arquivo: infra/grafana/paineis/fundacao.json
teste: infra/test/painel.test.ts › toda consulta do painel usa uma métrica que o código exporta, com o nome que o Prometheus dá a ela
-          "expr": "sum by (tarefa) (increase(ia_pedido_acima_do_teto_total[1h]))",
+          "expr": "sum by (tarefa) (increase(ia_pedido_teto_total[1h]))",
```

```mutacao
arquivo: docs/runbook.md
teste: tools/guardas/alerta-tem-runbook.test.ts › no repositório, cada arquivo de `infra/grafana/alertas/` tem entrada correspondente em `docs/runbook.md`, completa
-## Pedido de IA acima do teto de entrada
+## Pedido de IA acima do teto da entrada
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| frontend-reviewer (1ª) | "`PEDIDO_ACIMA_DO_TETO` repete literalmente a de `IA_ENTRADA_INVALIDA`. Isso é coerente com a decisão de tratar como defeito nosso." | Recusada: o próprio revisor a chama de coerente, e o teste que exige mensagem em português para todo código segue valendo. |
| conformidade-reviewer (1ª) | Um caso pela rota que o professor usa para ler a conversa, mostrando a pergunta sem resposta, para provar o item 4 do jeito que o professor a recebe | `TODO.md`: não é barato (teste de integração novo por outra rota) e o comportamento já existia para as outras falhas de IA; o revisor diz que não bloqueia. |
| conformidade-reviewer (1ª) | O `max(80)` em `disciplina.nome` do Analista depende de a coluna ter o mesmo limite; se um nome com mais de 80 caracteres entrou antes, a execução do Analista daquela escola falha com `IA_ENTRADA_INVALIDA` | Recusada: o `infra-guardian` (1ª) conferiu que o único caminho de escrita (`disciplina.repository.ts`, por `CriarDisciplinaRequest`) já limita a 80, "então nenhum dado gravado fica inválido". |
| infra-guardian (1ª), revisor-geral (1ª) | Montar as mensagens uma vez só e repassar ao adaptador (`tokensDoPedido` chama `montarMensagens`, e o adaptador monta de novo; no Analista, até ~2,5 MB duas vezes); guardar o JSON Schema de cada tarefa | Tarefa 10.0 (reserva de tokens pelo pedido real, que reaproveita a mesma estimativa): muda o contrato entre gateway e adaptador, fora do que uma recomendação barata cobre. |
| infra-guardian (1ª) | Com um defeito de teto às 10h, cada "Tentar de novo" grava uma `execucao_agente` e uma `mensagem_tutor`, mesmo que repetir dê o mesmo resultado | Retro da spec (D86): "se a mensagem deve continuar sendo a de erro passageiro" é decisão de produto; o limite por usuário e o alerta já seguram o volume. |
| llm-integrator (1ª) | O teto do Analista (642.300 tokens) é maior que a janela de qualquer modelo plausível: a guarda fica inerte e quem protege é a reserva do limitador (10.0) | Tarefa 10.0 e retro da spec: é o desenho da §8, já registrado como divergência. |
| llm-integrator (1ª) | Uma linha no relatório da spec dizendo que a guarda não altera a precificação | Relatório de fechamento da spec: a Mesa avisa o Orquestrador; não é do código desta tarefa. |
| test-engineer (2ª) | "Nenhum teste afirma o formato novo [`problema.code` na mensagem do `EntradaSemLimiteError`]. Bastaria trocar o `toThrow` do caso novo por `toThrow('b: custom')`: aí, se voltassem a usar `message`, o teste ficaria vermelho." | Não aplicar: as recomendações de quem aprovou não entram em ordem depois da primeira (revisar-tarefa, passo 4), e o próprio revisor diz que não bloqueia, porque o gerador só roda em teste, com valor sintético. Destino: a tarefa futura que alterar `teto-de-entrada.test.ts`. |
| revisor-geral (2ª) | "Comentário em `teto-de-entrada.ts:179`: diz que a mensagem do zod "pode trazer o valor recebido". Vale citar um caso concreto, ou o `code` do zod que traz isso, para quem vier depois não desfazer a troca achando que é só gosto." | Mesmo destino: comentário, sem efeito sobre a regra; fica para quem mexer em `teto-de-entrada.ts`. |
| revisor-geral (2ª) | "`4_task.md:120`: o parágrafo do `typeof atual !== 'object'` admite que uma string na guarda final faria o `Reflect.deleteProperty` lançar `TypeError`. [...] Fica só o registro: não há caso que prove esse cenário." | Recusada: é registro, não pedido. O revisor diz que os caminhos reais do zod não chegam lá. |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-15 19:33:26 | 2026-11-15 19:33:45 | `frontend-reviewer` | 1 | APROVADO | aa2b96ffb0796b951 |
| 2026-11-15 19:33:15 | 2026-11-15 19:33:55 | `conformidade-reviewer` | 1 | APROVADO | ae813c45f485c68c9 |
| 2026-11-15 19:33:43 | 2026-11-15 19:34:03 | `tenancy-guardian` | 1 | APROVADO | aeba007f44654c884 |
| 2026-11-15 19:33:10 | 2026-11-15 19:34:25 | `infra-guardian` | 1 | APROVADO | a3b204321018fe9aa |
| 2026-11-15 19:33:48 | 2026-11-15 19:34:29 | `privacy-guardian` | 1 | APROVADO | ac6e2acaf66167ea0 |
| 2026-11-15 19:33:37 | 2026-11-15 19:34:31 | `revisor-geral` | 1 | APROVADO | aee94c7cdd0dcdd43 |
| 2026-11-15 19:33:21 | 2026-11-15 19:34:50 | `llm-integrator` | 1 | APROVADO | a6f30486dcd92e864 |
| 2026-11-15 19:33:32 | 2026-11-15 19:35:53 | `test-engineer` | 1 | REPROVADO | affa47ee413357adb |
| 2026-11-15 19:50:59 | 2026-11-15 19:51:23 | `revisor-geral` | 2 | APROVADO | a1b615c61b104d812 |
| 2026-11-15 19:50:51 | 2026-11-15 19:51:26 | `test-engineer` | 2 | APROVADO | a97c521f3035cc8fe |
| 2026-11-15 19:51:06 | 2026-11-15 19:51:26 | `infra-guardian` | 2 | APROVADO | adbfc71475fdd9e9e |
| 2026-11-15 19:51:14 | 2026-11-15 19:51:29 | `privacy-guardian` | 2 | APROVADO | aa890b07b72b06793 |
| 2026-11-15 19:51:22 | 2026-11-15 19:51:41 | `conformidade-reviewer` | 2 | APROVADO | ae3524d62a915fc3a |
| 2026-11-15 19:51:30 | 2026-11-15 19:51:44 | `llm-integrator` | 2 | APROVADO | ab044eb23dac21af7 |
| 2026-11-15 19:51:38 | 2026-11-15 19:51:48 | `frontend-reviewer` | 2 | APROVADO | a3f5cbbcc463c25c0 |
| 2026-11-15 19:51:46 | 2026-11-15 19:51:55 | `tenancy-guardian` | 2 | APROVADO | a42debad03f86d6ea |
