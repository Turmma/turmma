# Tarefa 8.0 — A execução interrompida grava a estimada de cada destino, com custo

**Funcionalidade:** reserva-e-avaliacao · **Depende de:** 5.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
**Porte:** grande

## Objetivo

A execução interrompida (worker morto, encerrada pela varredura ou pela reentrega) passa a gravar custo: os dois tetos da tarefa
ao preço do modelo de cada destino, uma linha para o principal e outra para o provedor de reserva quando a tarefa tem aprovação
para o provedor dele. O custo superestima (D14) e o compartilhamento do aluno cita os dois (LGPD, art. 18, VII). Até aqui a
interrompida grava sem custo (`consumoEstimadoDaInterrompida`, abertura, passo 4).

## Contexto necessário

- `techspec.md` §3 ("A estimativa", `pelo_provedor_de_reserva`), §7
- `prd.md` RF5, RF6 (a interrompida), §6 (D14)
- `cenarios.md` §1: RF5, da linha "Interrompida pela **varredura**…" até "Interrompida de tarefa sem aprovação…" (sete linhas, a da
  Operação incluída); RF6, "A interrompida grava uma linha por destino…"
- Código: `packages/core/src/ia/consumo.ts` (`consumoEstimadoDaInterrompida`, `DestinoDoAdaptador`), `apps/api/src/ia/consumo.repository.ts`
  (`registrarEstimada`), `varredura-de-execucoes.ts` (linha 105), `execucao.processor.ts` (linha 209, `#aoReentregar`),
  `apps/api/src/ia/ia-do-worker.module.ts` (`DESTINO_DO_ADAPTADOR`, de onde vem o `destino`; a §2 diz `worker.module.ts`, que não
  existe), `llm-gateway.ts` › `destinoDoAdaptador`

## Subtarefas

- [x] 8.1 — `destinosDaInterrompida(tarefa)`: o principal sempre; a reserva configurada se a tarefa tem entrada em
  `MODELOS_APROVADOS` para o `provedorId` dela, sem comparar o modelo nem a conferência (destino superestimado)
- [x] 8.2 — `consumoEstimadoDaInterrompida` com os dois tetos ao preço do modelo de cada destino; `pelo_provedor_de_reserva`
  falsa nas duas; sai o `custoMicros: 0` e o comentário que aponta "a tarefa 11.0 da camada-ia"
- [x] 8.3 — `registrarEstimada(execucao, destinos, precos)`, com a tabela de preços por porta, injetada na varredura e no
  processor; as linhas do mesmo `InterrompidaEncerrada`, na escola do `returning`, na transação do encerramento, sem `@Unscoped` novo
- [x] 8.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/ia/consumo.ts`, `packages/core/src/ia/consumo.test.ts`, `packages/core/src/index.ts` | alterado |
| `apps/api/src/ia/consumo.repository.ts`, `apps/api/src/ia/varredura-de-execucoes.ts`, `apps/api/src/ia/execucao.processor.ts` | alterado |
| `apps/api/src/ia/ia-do-worker.module.ts` | alterado |
| `apps/api/src/ia/execucao-interrompida.int.test.ts`, `apps/api/test/arquivo-do-titular.int.test.ts`, `apps/api/test/painel-leitura.int.test.ts` | alterado |
| `apps/api/src/worker.module.ts` (o `CicloDoWorkerDeIa` recebe o `DESTINO_DA_RESERVA` e monta os `destinos` da varredura e do processor), `apps/api/test/fila-de-ia.fixture.ts` (a bancada passa `destinos` e `precos`), `apps/api/src/material/classificacao.int.test.ts` (os três `new VarreduraDeExecucoes(…, fila.destino, …)` passam `fila.destinos`), `apps/api/src/ia/reserva-na-subida.int.test.ts` (o `main-worker` de verdade com a reserva falsa e sem reserva) | alterado (fora da lista prevista: a fiação que a divergência abaixo descreve) |
| `docs/arquitetura.md`, `docs/lgpd.md` (linha 99), `docs/runbook.md`, `TODO.md`, `techspec.md` §3, `cenarios.md` §1 (RF6) | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| varredura (300 s), tarefa aprovada para a reserva, preços 1.300/5.200 e 2.000/8.000: duas linhas, cada uma com os dois tetos ao seu preço; o compartilhamento lista as duas | I | os dois destinos | preços diferentes | `execucao-interrompida.int.test.ts` › a reserva configurada › varredura (300 s), tarefa aprovada…; os casos de `execucao-interrompida.int.test.ts` leem o rastro com `alunoTrailStatement` e provam de ponta a ponta quem grava as linhas; `arquivo-do-titular.int.test.ts` › as duas linhas estimadas da execução interrompida… insere as linhas à mão e prova só o **leitor** do arquivo do titular (passaria antes da 8.0): não conta como prova do RF5 |
| o mesmo pela reentrega (`#aoReentregar`) | I | os dois caminhos | a varredura desligada no caso | `execucao-interrompida.int.test.ts` › … › reentrega do job (`#aoReentregar`), a varredura desligada |
| as duas com `pelo_provedor_de_reserva = false`, a da reserva com o provedor dela | I | a coluna | — | os dois casos acima (o `toEqual` do par leva `pelo_provedor_de_reserva`, o `provedor` e o `modelo` de cada linha); `consumo.test.ts` › a estimada leva a coluna da Operação falsa nos dois destinos |
| duas varreduras em `Promise.all`: exatamente duas linhas | I | concorrência | duas réplicas na trava | `execucao-interrompida.int.test.ts` › … › duas varreduras em `Promise.all` na mesma `rodando` |
| a gravação da linha da reserva falha: desfaz as duas e o encerramento | I | a transação | a falha só na segunda linha | `execucao-interrompida.int.test.ts` › … › a gravação da linha da reserva falha (só a segunda) |
| duas escolas: cada par na escola da sua execução | I | regra 10 | a 1ª execução do lote é da outra escola | `execucao-interrompida.int.test.ts` › … › duas escolas: cada par fica na escola da sua execução |
| aprovação para o provedor da reserva com outro modelo: as duas; o compartilhamento lista as duas | U, I | sem comparar o modelo | o modelo diferente | `consumo.test.ts` › destinosDaInterrompida › a aprovação é de outro modelo…; `execucao-interrompida.int.test.ts` › … › aprovação para o provedor da reserva com outro modelo |
| reserva configurada e recusada na conferência: as duas | I | a escolha da linha 99 | conferência recusada | `execucao-interrompida.int.test.ts` › … › reserva configurada e recusada na conferência da D62 |
| aprovação para outro `provedorId`: só a do principal; o compartilhamento só o principal | U, I | o provedor | o mesmo modelo, outro provedor | `consumo.test.ts` › destinosDaInterrompida › aprovação para outro provedor…; `execucao-interrompida.int.test.ts` › … › aprovação para outro `provedorId` |
| tarefa sem aprovação: só a do principal | U, I | não sempre | a reserva configurada e conferida | `consumo.test.ts` › destinosDaInterrompida › tarefa sem aprovação…; `execucao-interrompida.int.test.ts` › … › tarefa sem aprovação para a reserva |
| custo > 0 em cada linha, a da reserva no preço dela; sem a entrada contada | U | D14 | preços diferentes | `consumo.test.ts` › consumoEstimadoDaInterrompida: o custo dos dois tetos… (27.820 e 42.800, o custo > 0 e a reserva no preço dela) |
| a Operação: uma interrompida com reserva e uma desviada de verdade, na mesma escola: `chamadasPeloProvedorDeReserva = 1` | I | contam as enviadas | as duas na mesma escola | `painel-leitura.int.test.ts` › a interrompida com a reserva grava as duas estimadas… |
| a estimada não leva o aluno fora do freio, como hoje | I | regra 20 | — | `execucao-interrompida.int.test.ts` › … › fora do freio (o de antes, com o principal) e o `aluno_id: null` das duas linhas do par |

## Como testar

- Varredura: `execucao-interrompida.int.test.ts` › "varredura, limiar: a `rodando` de 301 s é encerrada com a linha estimada, e a de 299 s fica"
- Reentrega: › "worker morto: a reentrega encerra com EXECUCAO_INTERROMPIDA, sem modelo, e deixa uma linha estimada"
- Falha, réplicas e isolamento: › "a gravação falha: o encerramento se desfaz…", › "varredura, duas réplicas: o encerramento e a linha saem
  uma vez só…" e › "isolamento, reentrega: o job da A com o `execucaoId` da B…"
- Freio: › "fora do freio: a linha estimada não leva o aluno…"
- Compartilhamento: `arquivo-do-titular.int.test.ts` › "a linha estimada da execução interrompida (sem `aluno_id`…"
- Operação: `painel-leitura.int.test.ts` › "`chamadasPeloProvedorDeReserva` conta linhas e `execucoes` conta execuções…"
- Concorrência: `WriteBlockTrigger` e `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`)
- `npx vitest run --project integracao apps/api/src/ia/execucao-interrompida.int.test.ts`
- Armadilha: a `cenarios.md` cita `fila-de-ia.int.test.ts` para a reentrega; o precedente é o `execucao-interrompida`
- Fiação do worker de verdade: `reserva-na-subida.int.test.ts` › "a execução interrompida que a varredura da subida encerra…" (com e sem reserva)

## Fora do escopo desta tarefa

O roteamento (4.0 a 7.0); os preços reais (14.0).

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano antes de codar.

1. **Mutações.** As cláusulas de produção do diff, cada uma com o seu bloco em "Mutações": em `destinosDaInterrompida`, o `if (reserva === undefined)`, o termo da tarefa, o termo do provedor, o ternário e o padrão `MODELOS_APROVADOS`; em `consumoEstimadoDaInterrompida`, o custo, a chave do preço (`destino.identidade`), o instante da vigência, a tabela `precos` repassada, a coluna `peloProvedorDeReserva: false` e o teto da entrada; no `registrarEstimada`, o laço por destino e a tabela repassada; na varredura e no processor, `destinosDaInterrompida(…, destinos)` e `precos`; no worker, a junção de `reserva` aos `destinos` e o provider `DESTINO_DA_RESERVA`. A linha `precos = PRECO_DOS_MODELOS` do processor e o `precos: TabelaDePrecos = PRECO_DOS_MODELOS` da varredura são o padrão de quem não injeta: a tabela do produto só tem preço zero (o falso) até a 14.0, e nenhum caso distingue o padrão de uma tabela vazia; sem bloco, por isso.
2. **Texto na tela.** A tarefa não tem tela.
3. **O que distingue.** Preços diferentes nos dois destinos (1.300/5.200 e 2.000/8.000, e os tetos de 24.300 e 700 dão custos diferentes: 35.230 e 54.200); aprovação de outra tarefa, de outro `provedorId` com o mesmo modelo, e do mesmo provedor com outro modelo; a escola B com a execução mais velha do lote; a falha só na linha do provedor da reserva (gatilho com `new.provedor`).
4. **Checagem anterior.** A `rodando` é semeada com a idade do banco e a varredura a alcança pelo limiar de 300 s; a reentrega passa pelo `update … where estado = 'rodando'` antes das linhas; o aluno do Tutor tem vínculo na turma. O compartilhamento é lido pela mesma `alunoTrailStatement` do produto, e a `rodando` não depende de outro arquivo (`esvaziarAsSobras` antes de cada caso).
5. **A asserção olha o resultado.** As linhas do banco, uma por provedor, com o custo, os tokens, a coluna da Operação e a escola; o rastro do aluno antes e depois (o que entrou); `chamadasPeloProvedorDeReserva` lido pelo `PainelService`; nada espia o repository.
6. **Guarda nova.** Nenhuma.
7. **Comentários e docs.** `consumo.ts`, `consumo.repository.ts`, `docs/arquitetura.md`, `docs/lgpd.md` (linha 99) e `docs/runbook.md` dizem "uma linha por destino possível"; os nomes (`destinosDaInterrompida`, `DestinosConfigurados`, `DESTINO_DA_RESERVA`, `registrarEstimada`) vêm da árvore.
8. **Divergência.** Uma, de forma (tabela abaixo): sem regra nova, o PRD não a contradiz, e a decisão está na `techspec.md` §3 e no `cenarios.md` (RF6).
9. **Peça que já existe.** `custoDaChamada`, `precoDoModelo`, `chaveDoPreco`, `MODELOS_APROVADOS`, `adaptadorDaReserva`, a bancada `FilaDeIa`, `WriteBlockTrigger` e `esperarNaTrava`: importados, nenhum copiado.
10. **Concorrência.** Duas varreduras em `Promise.all` com a barreira do `WriteBlockTrigger` e `esperarNaTrava` (a transação do encerramento é a mesma de antes; só o número de linhas muda).
11. **Isolamento e a coluna "Caso".** O caso das duas escolas põe a mais velha do lote na B, e cada par fica na escola da própria execução (a escola vem do `returning`, que a tarefa não muda); a coluna "Caso" está preenchida.
12. **Guardiões.** `tenancy` (as linhas na escola do `InterrompidaEncerrada`, sem `@Unscoped` novo), `privacy` (nenhum campo novo; o `provedor` de cada destino no compartilhamento, a coluna da Operação fora do arquivo), `conformidade` (a estimada é custo e destino, nunca nota nem decisão), `infra` (uma linha a mais por execução interrompida, no mesmo passo de 5 s e o mesmo lote de 200; a varredura não ganha consulta). O `achados/indice.md` traz só a linha da 5.0 que a 8.0 fecha (o `privacy-guardian`, 1ª).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| `destinosDaInterrompida(tarefa, configurados)` recebe os `DestinosConfigurados` (o principal, a reserva e as aprovações) além da tarefa; a `VarreduraDeExecucoes` e o `ExecucaoProcessor` recebem `destinos` no lugar de `destino`, mais `precos`; o `IaDoWorkerModule` ganha o `DESTINO_DA_RESERVA`, e o `CicloDoWorkerDeIa` (`worker.module.ts`, fora da lista) junta os dois | A Tech Spec diz `destinosDaInterrompida(tarefa)` e `registrarEstimada(execucao, destinos, precos)`: a função precisa saber qual é a reserva e quais são as aprovações, e quem as tem é a configuração do worker; o `ia-do-worker.module.ts` só provê, e quem monta a varredura e o processor é o `worker.module.ts` | `techspec.md` §3 (o parágrafo depois de `registrarEstimada`), `cenarios.md` §1 RF6 (`destinosDaInterrompida`) |

## Mutações

`--faltando: 0 linhas (20 blocos, 0 motivos)`

```mutacao
arquivo: packages/core/src/ia/consumo.ts
teste: packages/core/src/ia/consumo.test.ts › sem reserva configurada: só o principal
-  if (reserva === undefined) return [principal]
+  if (reserva === undefined) return []
```

```mutacao
arquivo: packages/core/src/ia/consumo.ts
teste: packages/core/src/ia/consumo.test.ts › tarefa sem aprovação, ou só com a de outra tarefa
-  return aprovados.some((entrada) => entrada.tarefa === tarefa && entrada.provedorId === reserva.identidade) ? [principal, reserva] : [principal]
+  return aprovados.some((entrada) => entrada.provedorId === reserva.identidade) ? [principal, reserva] : [principal]
```

```mutacao
arquivo: packages/core/src/ia/consumo.ts
teste: packages/core/src/ia/consumo.test.ts › aprovação para outro provedor, com o mesmo modelo da reserva
-  return aprovados.some((entrada) => entrada.tarefa === tarefa && entrada.provedorId === reserva.identidade) ? [principal, reserva] : [principal]
+  return aprovados.some((entrada) => entrada.tarefa === tarefa) ? [principal, reserva] : [principal]
```

```mutacao
arquivo: packages/core/src/ia/consumo.ts
teste: packages/core/src/ia/consumo.test.ts › tarefa aprovada para o provedor da reserva configurada
-  return aprovados.some((entrada) => entrada.tarefa === tarefa && entrada.provedorId === reserva.identidade) ? [principal, reserva] : [principal]
+  return aprovados.some((entrada) => entrada.tarefa === tarefa && entrada.provedorId === reserva.identidade) ? [principal] : [principal, reserva]
```

```mutacao
arquivo: packages/core/src/ia/consumo.ts
teste: packages/core/src/ia/consumo.test.ts › sem a lista injetada vale `MODELOS_APROVADOS`
-export function destinosDaInterrompida(tarefa: TarefaDeIa, { principal, reserva, aprovados = MODELOS_APROVADOS }: DestinosConfigurados): readonly DestinoDoAdaptador[] {
+export function destinosDaInterrompida(tarefa: TarefaDeIa, { principal, reserva, aprovados = [] }: DestinosConfigurados): readonly DestinoDoAdaptador[] {
```

```mutacao
arquivo: packages/core/src/ia/consumo.ts
teste: packages/core/src/ia/consumo.test.ts › cada destino leva os dois tetos ao preço do seu modelo
-    custoMicros: custoDaChamada(tokens, precoDoModelo(chaveDoPreco(destino.identidade, modelo), em, precos)),
+    custoMicros: 0,
```

```mutacao
arquivo: packages/core/src/ia/consumo.ts
teste: packages/core/src/ia/consumo.test.ts › cada destino leva os dois tetos ao preço do seu modelo
-    custoMicros: custoDaChamada(tokens, precoDoModelo(chaveDoPreco(destino.identidade, modelo), em, precos)),
+    custoMicros: custoDaChamada(tokens, precoDoModelo(chaveDoPreco('principal-x', modelo), em, precos)),
```

```mutacao
arquivo: packages/core/src/ia/consumo.ts
teste: packages/core/src/ia/consumo.test.ts › o preço é o da vigência do instante da linha
-    custoMicros: custoDaChamada(tokens, precoDoModelo(chaveDoPreco(destino.identidade, modelo), em, precos)),
+    custoMicros: custoDaChamada(tokens, precoDoModelo(chaveDoPreco(destino.identidade, modelo), new Date(8_640_000_000_000_000), precos)),
```

```mutacao
arquivo: packages/core/src/ia/consumo.ts
teste: packages/core/src/ia/consumo.test.ts › cada destino leva os dois tetos ao preço do seu modelo
-    custoMicros: custoDaChamada(tokens, precoDoModelo(chaveDoPreco(destino.identidade, modelo), em, precos)),
+    custoMicros: custoDaChamada(tokens, precoDoModelo(chaveDoPreco(destino.identidade, modelo), em)),
```

```mutacao
arquivo: packages/core/src/ia/consumo.ts
teste: packages/core/src/ia/consumo.test.ts › a estimada leva a coluna da Operação falsa nos dois destinos
-    peloProvedorDeReserva: false,
+    peloProvedorDeReserva: true,
```

```mutacao
arquivo: packages/core/src/ia/consumo.ts
teste: packages/core/src/ia/consumo.test.ts › cada destino leva os dois tetos ao preço do seu modelo
-  const tokens = { tokensDeEntrada: tarefa.maximoDeTokensDeEntrada, tokensDeSaida: tarefa.maximoDeTokensDeSaida }
+  const tokens = { tokensDeEntrada: tarefa.maximoDeTokensDeSaida, tokensDeSaida: tarefa.maximoDeTokensDeSaida }
```

```mutacao
arquivo: apps/api/src/ia/consumo.repository.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › tarefa aprovada para a reserva, preços
-      for (const destino of destinos) {
+      for (const destino of destinos.slice(0, 1)) {
```

```mutacao
arquivo: apps/api/src/ia/consumo.repository.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › tarefa aprovada para a reserva, preços
-        await this.registrar(consumoEstimadoDaInterrompida({ tarefa: TASK_CATALOG[execucao.tarefa], destino, precos, execucaoId: execucao.id, duracaoMs: execucao.duracaoMs, em }))
+        await this.registrar(consumoEstimadoDaInterrompida({ tarefa: TASK_CATALOG[execucao.tarefa], destino, execucaoId: execucao.id, duracaoMs: execucao.duracaoMs, em }))
```

```mutacao
arquivo: apps/api/src/ia/varredura-de-execucoes.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › tarefa aprovada para a reserva, preços
-      for (const encerrada of encerradas) await consumo.registrarEstimada(encerrada, destinosDaInterrompida(encerrada.tarefa, this.destinos), this.precos)
+      for (const encerrada of encerradas) await consumo.registrarEstimada(encerrada, [this.destinos.principal], this.precos)
```

```mutacao
arquivo: apps/api/src/ia/varredura-de-execucoes.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › tarefa aprovada para a reserva, preços
-      for (const encerrada of encerradas) await consumo.registrarEstimada(encerrada, destinosDaInterrompida(encerrada.tarefa, this.destinos), this.precos)
+      for (const encerrada of encerradas) await consumo.registrarEstimada(encerrada, destinosDaInterrompida(encerrada.tarefa, this.destinos), PRECO_DOS_MODELOS)
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › a varredura desligada: as duas linhas
-        await new ConsumoRepository(tx).registrarEstimada(interrompida, destinosDaInterrompida(interrompida.tarefa, destinos), precos)
+        await new ConsumoRepository(tx).registrarEstimada(interrompida, [destinos.principal], precos)
```

```mutacao
arquivo: apps/api/src/ia/execucao.processor.ts
teste: apps/api/src/ia/execucao-interrompida.int.test.ts › a varredura desligada: as duas linhas
-        await new ConsumoRepository(tx).registrarEstimada(interrompida, destinosDaInterrompida(interrompida.tarefa, destinos), precos)
+        await new ConsumoRepository(tx).registrarEstimada(interrompida, destinosDaInterrompida(interrompida.tarefa, destinos), PRECO_DOS_MODELOS)
```

```mutacao
arquivo: apps/api/src/worker.module.ts
teste: apps/api/src/ia/reserva-na-subida.int.test.ts › a execução interrompida que a varredura da subida encerra deixa as duas linhas estimadas
-    this.#destinos = reserva === null ? { principal: destino } : { principal: destino, reserva }
+    this.#destinos = { principal: destino }
```

```mutacao
arquivo: apps/api/src/ia/ia-do-worker.module.ts
teste: apps/api/src/ia/reserva-na-subida.int.test.ts › a execução interrompida que a varredura da subida encerra deixa as duas linhas estimadas
-            return reserva === undefined ? null : { origem: reserva.origem, envio: reserva.envio, identidade: reserva.identidade, modeloDoPerfil: (perfil) => reserva.modeloDoPerfil(perfil) }
+            return null
```

```mutacao
arquivo: apps/api/src/ia/ia-do-worker.module.ts
teste: apps/api/src/ia/reserva-na-subida.int.test.ts › a execução interrompida que a varredura da subida encerra deixa uma linha só
-            return reserva === undefined ? null : { origem: reserva.origem, envio: reserva.envio, identidade: reserva.identidade, modeloDoPerfil: (perfil) => reserva.modeloDoPerfil(perfil) }
+            return { origem: 'falso', envio: { envioExterno: false, provedorId: null }, identidade: 'falso-reserva', modeloDoPerfil: () => 'modelo-falso' }
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | `InterrompidaEncerrada` como tipo de marca, devolvido só pelo `ExecucaoRepository`, para a garantia do `escolaId` ser estrutural e não documental | `TODO.md`: muda o contrato do repository, e a FK composta `(escola_id, execucao_id)` segura hoje |
| privacy-guardian (1ª) | `compartilhamento.ts` marcar como "possível, não confirmado" os destinos vindos só de `codigo_de_erro = 'EXECUCAO_INTERROMPIDA'` | `TODO.md`, para a validação da spec ou para quem tocar a lista: muda o que o titular lê, e o `prd.md` (§6, linhas 59-60) pede o destino "possível" nas linhas sem pedir o rótulo |
| test-engineer (1ª) | Provar a conferência recusada no `reserva-na-subida.int.test.ts` (reserva recusada na subida, duas linhas), porque a varredura não consulta o gateway | `TODO.md`: caso novo no worker de verdade, mais que poucas linhas |
| test-engineer (1ª) | Varredura disputando com a reentrega a mesma execução `rodando` com reserva, esperando exatamente um par | `TODO.md`: caso novo de concorrência; a trava do encerramento não mudou (o próprio revisor diz que não bloqueia) |
| revisor-geral (1ª) | `destinoDaReserva(config)` ao lado de `destinoDoAdaptador`, no lugar do mapeamento copiado em `ia-do-worker.module.ts:118-124` | `TODO.md`: toca `llm-gateway.ts`, fora dos arquivos da tarefa |
| infra-guardian (1ª) | Gravar as linhas estimadas do lote num INSERT só, ou corrigir a conta "2 × 5 × 5 s = 50 s" (o `statement_timeout` é por instrução) | `TODO.md`: muda a gravação; o próprio revisor diz que já valia antes e que o passo cabe |
| infra-guardian (1ª) | A mesma tabela de preços do gateway precisa chegar ao `CicloDoWorkerDeIa` quando a 14.0 der ao gateway uma tabela por porta | `14_task.md` (14.3, `PRECO_DOS_MODELOS` com os preços reais): o Implementador acrescenta a dependência no "Contexto necessário" dela |
| revisor-geral (2ª) | `cenarios.md` §1, linha do RF5 pela varredura (linha 61): citar também `execucao-interrompida.int.test.ts` como prova, para o `cenarios.md` e o `8_task.md` dizerem a mesma coisa sobre o que prova o RF5 (a linha 64 já cobre a varredura em `execucao-interrompida.int.test.ts`, então a regra tem teste) | `TODO.md`, dono: a validação da spec: é só a citação de um documento, e a regra já tem teste |
| revisor-geral (2ª), test-engineer (2ª) | `execucao-interrompida.int.test.ts:256` (`quebrarAGravacaoDa`): ler o literal do `quote_literal` numa variável antes de montar `soDoProvedor` | recusada: legibilidade de um auxiliar de teste que o 1º item da ordem acabou de mexer; sem efeito no que o caso prova |
| test-engineer (2ª) | `reserva-na-subida.int.test.ts:313`: tirar o `toHaveLength(2)`, que o `toMatchObject` sobre a lista já garante | recusada: o `toHaveLength` repete a conferência e nomeia o número esperado; sem efeito no que o caso prova |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-22 20:15:55 | 2026-11-22 20:16:24 | `tenancy-guardian` | 1 | APROVADO | ad5a3317e6f2b0f50 |
| 2026-11-22 20:16:01 | 2026-11-22 20:16:45 | `conformidade-reviewer` | 1 | APROVADO | a524acb16c4b97521 |
| 2026-11-22 20:15:58 | 2026-11-22 20:17:01 | `privacy-guardian` | 1 | APROVADO | a2a0f96b58aada8d9 |
| 2026-11-22 20:16:09 | 2026-11-22 20:17:22 | `revisor-geral` | 1 | APROVADO | a7526bc17547eec4d |
| 2026-11-22 20:16:03 | 2026-11-22 20:17:37 | `infra-guardian` | 1 | APROVADO | a9be9ffd546f6f5d5 |
| 2026-11-22 20:16:06 | 2026-11-22 20:19:20 | `test-engineer` | 1 | APROVADO | a036edac29ca40171 |
| 2026-11-22 20:35:17 | 2026-11-22 20:35:48 | `revisor-geral` | 2 | APROVADO | a62807431733a6676 |
| 2026-11-22 20:35:10 | 2026-11-22 20:36:30 | `test-engineer` | 2 | APROVADO | a6d1fa1bbafe723a1 |
