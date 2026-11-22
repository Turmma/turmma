# Tarefa 3.0 — A causa da falha atravessa o `ResilientAdapter`: o 429 que sobra é falta de vaga, o 4xx não é queda

**Funcionalidade:** reserva-e-avaliacao · **Depende de:** 1.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`
**Porte:** grande

## Objetivo

O `traduzir` do `ResilientAdapter` deixa de apagar a classificação do `ProviderError`: o `LLMError` ganha os motivos `limite`
(o 429 que sobrou da repetição) e `rejeitada` (outro 4xx), fora de `semEnvio`. No gateway, o `limite` desce o degrau do modelo
menor, como o balde cheio; a `rejeitada` termina sem degrau. A linha da chamada que saiu e voltou com 429 ou conexão recusada
leva a estimativa (D14) e o provedor dela. Sem reserva ainda: o degrau dela é da 7.0.

## Contexto necessário

- `techspec.md` §5 ("A causa da falha"; "A chamada", o ramo 1 até o menor)
- `prd.md` RF3 (a parte do limite), §6 (D14)
- `cenarios.md` §1 RF3: "O 429 que sobra da repetição…" (só até o menor), "O 4xx rejeitado (401…)" (sem a reserva, que a 4.0
  acrescenta), "O 429 que sobra e a conexão recusada gravam a estimativa…"
- `TODO.md`, linha "(camada-ia, validação, 22/11/2026) `tasks/prd-camada-ia/1_task.md:410`": esta tarefa a fecha
- Código: `packages/core/src/ia/errors.ts` (`MotivoDaIndisponibilidade`, `semEnvio`), `resilient-adapter.ts` (`traduzir`, a repetição
  do 429 e o `Retry-After`), `llm-gateway.ts` (o degrau do menor, `chamadaSemUso`), `__fixtures__/fake-llama-server.ts`

## Subtarefas

- [x] 3.1 — `limite` e `rejeitada` em `MotivoDaIndisponibilidade`, fora de `semEnvio`; o `traduzir` os preserva; sem motivo
  continuam o 5xx e a conexão. Confira cada leitor de `motivo` e de `semEnvio` (`grep -rn "semEnvio\|\.motivo" packages apps`)
- [x] 3.2 — No gateway, o `limite` desce ao modelo menor (a tarefa que o tem; o Tutor e a classificação não, D36), e sem menor
  termina `IA_INDISPONIVEL` como o balde cheio; a `rejeitada` termina `IA_INDISPONIVEL` sem degrau
- [x] 3.3 — A linha do 429 que sobra e da conexão recusada: entrada contada, saída no teto, o provedor; o comentário de
  `errors.ts` e o de `consumo.ts` com a regra
- [x] 3.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/ia/errors.ts` | alterado |
| `packages/core/src/ia/resilient-adapter.ts`, `packages/core/src/ia/resilient-adapter.test.ts` | alterado |
| `packages/core/src/ia/llm-gateway.ts`, `packages/core/src/ia/llm-gateway.test.ts` | alterado |
| `TODO.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| o 429 que sobra, sem `Retry-After`, pelo `ResilientAdapter` real: `LLMError` com `limite`, `semEnvio` falso | U | o `traduzir` | adaptador interno que lança `ProviderError` de verdade | `resilient-adapter.test.ts` › 429 duas vezes: nunca uma terceira, e o erro é o de indisponível; › a causa atravessa; › pelo servidor falso › 429 duas vezes: `limite`, depois da única repetição |
| o mesmo com `Retry-After` além do prazo: `limite`, com a espera sugerida | U | as duas formas do 429 | a espera que vai a quem chamou | `resilient-adapter.test.ts` › 429 com Retry-After além do prazo: nenhuma repetição, e a espera sugerida vai para quem chamou |
| 401 e 403: `rejeitada`; 500 e conexão: sem motivo | U | a classificação | um código por caso | `resilient-adapter.test.ts` › pelo servidor falso: o código HTTP vira a causa (401, 403, 500, conexão recusada) |
| `limite` no principal, tarefa com menor: vai ao menor; as linhas, na ordem: a estimada do principal (`envio_externo`, o provedor) e a do menor | U | regra 80.4 | a ordem das duas linhas | `llm-gateway.test.ts` › `limite` no principal, tarefa com menor: vai ao menor; as linhas, na ordem; › o `limite` com `Retry-After` além do prazo também desce ao menor; › o menor que também recusa por limite; › o `limite` do menor, que já era o modelo da chamada |
| `limite` no Tutor e na classificação, com `modelosMenores` configurado para o `rapido`: não vai ao menor; `IA_INDISPONIVEL` | U | D36 | o menor configurado e não usado | `llm-gateway.test.ts` › o `limite` do Tutor e da classificação, com `modelosMenores` configurado para o `rapido`, não vai ao menor |
| `rejeitada` no principal, com menor disponível: não vai ao menor; termina `IA_INDISPONIVEL` | U | não é falta de vaga | o menor disponível | `llm-gateway.test.ts` › `rejeitada` (o 401 e o 403 do servidor, em `resilient-adapter.test.ts`) no principal, com menor disponível |
| a linha do 429 e a da conexão recusada: entrada contada, saída no teto, custo > 0, o provedor | U | D14 | preço diferente de zero injetado | `llm-gateway.test.ts` › o 429 que sobra e a conexão recusada gravam a estimativa, pelo `ResilientAdapter` com o servidor falso › 429 que sobra da repetição: uma linha; › conexão recusada: a mesma linha estimada, com o provedor |
| a variante sem reserva do "degrau 3" segue igual à da X6 | U | sem regressão | — | `llm-gateway.test.ts` › degrau 3: sem vaga no principal nem no menor, termina IA_INDISPONIVEL aos 8 s, sem chamar o modelo, sem erro cru e sem dizer que houve envio (o caso da X6, sem alteração); › o balde do principal cheio, sem menor para o perfil |

## Como testar

- O 429: `resilient-adapter.test.ts` › "429 duas vezes: nunca uma terceira, e o erro é o de indisponível" e › "429 com Retry-After além do
  prazo: nenhuma repetição, e a espera sugerida vai para quem chamou" — acrescente a asserção do `motivo`
- O degrau: `llm-gateway.test.ts` › "degrau 2: passados os 8 s sem vaga, vai ao modelo menor do perfil…" (o balde falso e o relógio);
  aqui a falta de vaga vem do 429, com o `ResilientAdapter` real sobre um adaptador que lança `ProviderError`
- O motivo vazio: `llm-gateway.test.ts` › "o provedor que falhou depois de a chamada sair não é `semEnvio`: o motivo fica vazio e a linha de
  consumo registra a falha"
- O servidor falso: `__fixtures__/fake-llama-server.ts`, como em `openai-compat-adapter.test.ts`
- `npx vitest run --project unidade packages/core/src/ia/resilient-adapter.test.ts packages/core/src/ia/llm-gateway.test.ts`
- Armadilha: `limite` em `semEnvio` apaga a linha do principal; a mutação "limite em semEnvio" tem de ficar vermelha

## Fora do escopo desta tarefa

A reserva depois do menor (7.0); a `rejeitada` com reserva elegível (4.0).

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano antes de codar.

1. **Mutações:** a seção "Mutações" traz um bloco por cláusula (os termos do `if` do `motivoDaFalha`, a guarda do `catch` do degrau, cada `if` das peças novas do gateway, o `semEnvio` e o `limite` dentro dele) e dois motivos. O que o `--faltando` não vê (o ternário de `modeloMenorDaTarefa`, a reserva do menor no retorno de `chamarComDegrau` e `gasto.modelo = menor.modelo`, o `?? 'normal'`) também tem bloco, conferido à mão.
2. **Texto na tela:** não se aplica, a tarefa não tem tela.
3. **O que distingue:** o `limite` em `semEnvio` apaga a linha do principal, e o caso que o prova tem a linha estimada com o custo e o provedor; a reserva acertada é a do menor, e não a do principal (`acertosPorModelo`); o menor configurado e não usado (o Tutor e a classificação) e o menor disponível e não usado (`rejeitada`) são casos à parte.
4. **Checagem anterior que responde antes:** o balde do principal está aberto nos casos do `limite` (o `LimiteDeMentira` sem `fechados`), e o dublê lança o `ProviderError` de verdade, que o `ResilientAdapter` real traduz; o caso do código HTTP (401, 403, 429, 500, conexão recusada) usa o servidor falso e o adaptador de verdade.
5. **A asserção olha o resultado:** o motivo, a lista de baldes pedidos, o modelo de cada chamada e as linhas de consumo, nunca o texto do código. As ausências (`não vai ao menor`) são a lista de baldes pedidos igual à esperada, depois de a chamada terminar.
6. **Guarda nova:** nenhuma.
7. **Comentários:** o de `errors.ts` (`MotivoDaIndisponibilidade`, `semEnvio`, `ProviderError`), o de `consumo.ts` (a linha da chamada que saiu) e o de `reservarVaga` dizem o que o código faz; a regra "o `limite` termina com o motivo dele, não `sem_vaga`" está na linha de Divergências.
8. **Divergência:** duas linhas abaixo, com a decisão na `techspec.md` §5 e no `cenarios.md` §1 RF3 antes dos revisores.
9. **Peça que já existe:** o degrau do menor é o mesmo do balde cheio (`reservarOMenor` o divide); a estimativa da linha é a da `chamadaSemUso`, que não mudou.
10. **Concorrência:** não se aplica; a repetição do 429 é a do `cockatiel`, com teste existente.
11. **Isolamento:** não se aplica (sem repository). Cada linha da tabela de testes tem o caso na coluna "Caso".
12. **Guardiões:** `achados/indice.md` da pasta lido; a 1.0 não tocou o degrau. O `infra-guardian` pede a regra 80, item 4 (a degradação declarada, sem erro cru) e o `llm-integrator` a estimativa de custo da linha (D14); os dois estão nos casos.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O `limite` que não acha menor, ou cujo menor também não tem vaga, termina `IA_INDISPONIVEL` **com o motivo `limite`** (e a espera do `Retry-After`), e não `sem_vaga`. | `sem_vaga` é `semEnvio` (a chamada nem saiu) e o lote adia sem linha de consumo; o 429 saiu, tem linha estimada, e dizer `semEnvio` apagaria a linha (a armadilha da tarefa). O `sem_vaga` do degrau da reserva é da 4.0. | `techspec.md` §5, "A causa da falha"; `cenarios.md` §1 RF3, "O 429 que sobra da repetição" |
| O `limite` desce ao menor **sem a espera de 8 s** do balde, na mesma tentativa, e só com o limitador configurado; o menor que já era o modelo da chamada não desce de novo. | A espera é do balde nosso cheio; o 429 já é a recusa do provedor, e esperar mais 8 s à toa gasta o prazo único da execução. Sem limitador (o `local`) não há degrau, como no balde. | `techspec.md` §5, "A causa da falha"; `cenarios.md` §1 RF3, "O 429 que sobra da repetição" |

## Mutações

`--faltando: 0 linhas (24 blocos, 1 motivo)`

Motivos (termo sem bloco, com o porquê):

- `erro instanceof LLMError` (`llm-gateway.ts`, a guarda do `catch` do degrau): só estreita o tipo de `unknown` para ler `motivo`; para erro que não é `LLMError` o `motivo` é `undefined`, e o resultado é o mesmo com ou sem o termo. O `motivo === 'limite'` e o `vaga.modelo === undefined` têm bloco.

```mutacao
arquivo: packages/core/src/ia/errors.ts
teste: packages/core/src/ia/resilient-adapter.test.ts › 429 duas vezes: nunca uma terceira
-    return this.motivo === 'sem_vaga' || this.motivo === 'disjuntor'
+    return this.motivo === 'sem_vaga' || this.motivo === 'disjuntor' || this.motivo === 'limite'
```

```mutacao
arquivo: packages/core/src/ia/errors.ts
teste: packages/core/src/ia/llm-gateway.test.ts › vai ao menor; as linhas, na ordem
-    return this.motivo === 'sem_vaga' || this.motivo === 'disjuntor'
+    return this.motivo === 'sem_vaga' || this.motivo === 'disjuntor' || this.motivo === 'limite'
```

```mutacao
arquivo: packages/core/src/ia/errors.ts
teste: packages/core/src/ia/resilient-adapter.test.ts › a causa atravessa
-    return this.motivo === 'sem_vaga' || this.motivo === 'disjuntor'
+    return this.motivo === 'sem_vaga' || this.motivo === 'disjuntor' || this.motivo === 'rejeitada'
```

```mutacao
arquivo: packages/core/src/ia/resilient-adapter.ts
teste: packages/core/src/ia/resilient-adapter.test.ts › a causa atravessa
-  if (falha === 'limite' || falha === 'rejeitada') return falha
+  if (falha === 'rejeitada') return falha
```

```mutacao
arquivo: packages/core/src/ia/resilient-adapter.ts
teste: packages/core/src/ia/resilient-adapter.test.ts › a causa atravessa
-  if (falha === 'limite' || falha === 'rejeitada') return falha
+  if (falha === 'limite') return falha
```

```mutacao
arquivo: packages/core/src/ia/resilient-adapter.ts
teste: packages/core/src/ia/resilient-adapter.test.ts › 429 duas vezes: nunca uma terceira
-  if (erro instanceof ProviderError) return new LLMError(erro.codigoDeIa, erro.tenteDeNovoEmSegundos, motivoDaFalha(erro.falha))
+  if (erro instanceof ProviderError) return new LLMError(erro.codigoDeIa, erro.tenteDeNovoEmSegundos)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o 401 e o 403 do servidor
-      const desceAoMenor = erro instanceof LLMError && erro.motivo === 'limite' && vaga.modelo === undefined
+      const desceAoMenor = erro instanceof LLMError && vaga.modelo === undefined
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › que já era o modelo da chamada
-      const desceAoMenor = erro instanceof LLMError && erro.motivo === 'limite' && vaga.modelo === undefined
+      const desceAoMenor = erro instanceof LLMError && erro.motivo === 'limite'
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › sem menor para o perfil: termina
-        if (menor === undefined) throw erro
+        if (menor === undefined) throw new LLMError('IA_INDISPONIVEL')
       gasto.modelo = menor.modelo
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o sinal de quem chamou é o da chamada ao adaptador
-    const sinal = pedido.sinal ?? new AbortController().signal
+    const sinal = new AbortController().signal
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o sinal de quem chamou é também o da chamada ao menor
-      const resposta = await this.chamarContando(pedido, chamadaAoModelo({ tarefa, entrada, sinal }, correcao, menor.modelo), gasto, inicioDoMenor, correcao)
+      const resposta = await this.chamarContando(pedido, chamadaAoModelo({ tarefa, entrada, sinal: new AbortController().signal }, correcao, menor.modelo), gasto, inicioDoMenor, correcao)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › a duração da linha do menor é a da chamada dele
-      return { resposta, reserva: menor.reserva, inicioDaChamada: inicioDoMenor }
+      return { resposta, reserva: menor.reserva, inicioDaChamada }
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › vai ao menor; as linhas, na ordem
-      const menor = desceAoMenor ? await this.descerPorLimite(pedido, entrada, correcao) : undefined
+      const menor = desceAoMenor ? undefined : undefined
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › vai ao menor; as linhas, na ordem
-      return { resposta, reserva: menor.reserva, inicioDaChamada: inicioDoMenor }
+      return { resposta, reserva: vaga.reserva, inicioDaChamada: inicioDoMenor }
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o menor que também recusa por limite
         if (menor === undefined) throw erro
-      gasto.modelo = menor.modelo
       const inicioDoMenor = performance.now()
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › degrau 2: passados os 8 s
     const vaga = await this.reservarOMenor(pedido, estimativa, fila, limite)
-    if (vaga !== undefined) return vaga
     this.descer('indisponivel', tarefa.nome, this.modeloMenorDaTarefa(pedido) ?? principal)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o balde do principal cheio, sem menor para o perfil
-    this.descer('indisponivel', tarefa.nome, this.modeloMenorDaTarefa(pedido) ?? principal)
+    this.descer('indisponivel', tarefa.nome, this.modeloMenorDaTarefa(pedido))
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › do Tutor e da classificação, com
-    return TAREFAS_SEM_MODELO_MENOR.has(tarefa.nome) ? undefined : this.dependencias.modelosMenores?.[tarefa.perfil]
+    return this.dependencias.modelosMenores?.[tarefa.perfil]
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › vai ao menor; as linhas, na ordem
-    return tokensDoPedido(pedido.tarefa, entrada, correcao) + pedido.tarefa.maximoDeTokensDeSaida
+    return tokensDoPedido(pedido.tarefa, entrada, correcao)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › sem menor para o perfil: termina
     const menor = this.modeloMenorDaTarefa(pedido)
-    if (menor === undefined) return undefined
     const resultado = await limite.reservar(this.chaveDoBalde(menor), estimativa, fila)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o menor também sem vaga
     this.anotarUsoDoTeto(menor, resultado.usoDoTeto)
-    if (!resultado.concedida) return undefined
     this.descer('modelo_menor', pedido.tarefa.nome, menor)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › sem limitador configurado não há degrau
     const limite = this.dependencias.limiteDeTokens
-    if (limite === undefined) return undefined
     const vaga = await this.reservarOMenor(pedido, this.estimativaDoPedido(pedido, entrada, correcao), pedido.fila ?? 'normal', limite)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › com `Retry-After` além do prazo também desce ao menor
-    const vaga = await this.reservarOMenor(pedido, this.estimativaDoPedido(pedido, entrada, correcao), pedido.fila ?? 'normal', limite)
+    const vaga = await this.reservarOMenor(pedido, this.estimativaDoPedido(pedido, entrada, correcao), pedido.fila, limite)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › sem menor para o perfil: termina
     const vaga = await this.reservarOMenor(pedido, this.estimativaDoPedido(pedido, entrada, correcao), pedido.fila ?? 'normal', limite)
-    if (vaga === undefined) this.descer('indisponivel', pedido.tarefa.nome, this.dependencias.adaptador.modeloDoPerfil(pedido.tarefa.perfil))
     return vaga
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian, privacy-guardian, conformidade-reviewer, infra-guardian, llm-integrator, revisor-geral e test-engineer (1ª) | `apps/api/src/ia/execucao.processor.ts:334` (`adiavelNoLote`) adia todo `IA_INDISPONIVEL` que não seja `soberania`, e a `rejeitada` (401, 403) volta ao lote, a chamada que o provedor recusou reenviada a cada 30 s com uma linha estimada por volta | `TODO.md`, dono: Arquiteto, junto da 4.0 (a techspec §5 diz que a `rejeitada` "termina como hoje" e a 4.0 trata a `rejeitada` como não-queda). Muda comportamento e está em `apps/api`, fora dos arquivos da tarefa |
| llm-integrator (1ª) | A reserva do principal, já concedida, não é devolvida nem acertada quando o `limite` desce ao menor; o balde fica cobrado até o minuto virar | `TODO.md`, dono: a 7.0, que mexe em `reservarVaga` e no balde por `provedor:modelo`. Muda comportamento do limitador |
| llm-integrator (1ª) | Anexar na validação a taxa de 429 medida na subida (provedor e cota), para a precificação não ser chute | `TODO.md`, dono: Arquiteto, na validação da funcionalidade e na conta de D39. Não é código |
| infra-guardian (1ª) | Quando o menor recebe a vaga e depois também devolve `limite`, `ia.degradacao{degrau}` conta `modelo_menor` e nunca `indisponivel` (o mesmo vale no balde cheio, anterior à tarefa) | `TODO.md`, dono: a 4.0, que mexe em `descer` e `DEGRAUS` (subtarefa 4.3). Muda a métrica |
| infra-guardian, test-engineer (1ª) | O fim por `limite` loga `ia.geracao.sem_vaga`, o mesmo nome do balde nosso cheio; um evento próprio, ou o motivo dentro do evento | `TODO.md`, dono: a 4.0 (subtarefa 4.3, o log do degrau; a 6.0 acrescenta o contador por motivo). Muda o nome de um evento de log |
| revisor-geral, test-engineer (1ª) | `descerPorLimite` registra o degrau `indisponivel` com o modelo do principal, e o caminho do balde cheio com `modeloMenorDaTarefa ?? principal`: escolher um critério só e escrever o porquê | `TODO.md`, dono: a 4.0, junto do item acima. O teste do caso do balde cheio fixa o modelo de propósito; trocar o critério muda log e teste |
| revisor-geral (1ª) | Para a 6.0: a chamada ao menor entra na mesma tentativa, e a segunda volta do `chamarAteValer` pode dar até quatro chamadas ao destino principal; a 6.0 conta a chamada ao menor no contador do principal e ganha um caso (429 no principal, menor inválido, segunda tentativa) | `TODO.md`, dono: a 6.0 (subtarefa 6.1). Contador por destino é dela |
| conformidade-reviewer (1ª) | Na AIA do Tutor (D60), no procedimento de degradação, uma linha: o 429 do provedor nunca leva o Tutor a um modelo menor (D36) | `TODO.md`, dono: a 14.5 (as AIAs). Texto de `docs/aia/tutor.md`, fora desta tarefa |
| test-engineer (1ª) | Os casos de conexão recusada fecham o servidor falso e reusam a porta (`resilient-adapter.test.ts`, "conexão recusada: sem motivo, depois da repetição"; `llm-gateway.test.ts`, o describe do 429 e da conexão recusada): outro worker pode abrir a mesma porta | `TODO.md`, dono: a tarefa que mexer nesses casos. Uma porta que nunca abre exige um auxiliar no `fake-llama-server.ts`, fora das poucas linhas; o padrão (fechar e reusar) é o dos casos de conexão que já existiam |
| test-engineer (2ª) | Citar os dois casos novos (o sinal e a duração do menor) na linha da tabela "Testes que provam a regra" do `3_task.md`, junto do "`limite` no principal, tarefa com menor" | Recusada: a linha já cita o caso do menor, e os dois casos novos têm bloco em "Mutações", que o portão prova (24 blocos). A tabela é a que o Arquiteto escreveu; citar o caso é opcional |
| test-engineer (2ª) | O caso do sinal confere que o sinal passado ao menor é o mesmo objeto, mas não aborta o sinal durante a chamada ao menor para ver o cancelamento de ponta a ponta | `TODO.md`, dono: a 6.0 (o prazo da execução com a repetição e a reserva, `prazo-com-tokens.int.test.ts`). A mutação de hoje já fica vermelha |
| test-engineer (2ª) | Nenhum caso fixa a duração da linha do menor que também falha (`inicioDoMenor` passado ao `chamarContando`) | `TODO.md`, dono: a 4.0, que mexe em `Gasto` e na linha de consumo por destino. Não é cláusula nova desta rodada |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-22 14:41:58 | 2026-11-22 14:42:24 | `tenancy-guardian` | 1 | APROVADO | a6c4326e5df785326 |
| 2026-11-22 14:42:01 | 2026-11-22 14:42:40 | `conformidade-reviewer` | 1 | APROVADO | a12cbe5ccaa1a00ce |
| 2026-11-22 14:42:05 | 2026-11-22 14:42:49 | `llm-integrator` | 1 | APROVADO | a74d2755b13015736 |
| 2026-11-22 14:42:00 | 2026-11-22 14:42:50 | `privacy-guardian` | 1 | APROVADO | a3eb53388a5aa2e2d |
| 2026-11-22 14:42:03 | 2026-11-22 14:43:20 | `infra-guardian` | 1 | APROVADO | a6fb05d6757784e11 |
| 2026-11-22 14:42:08 | 2026-11-22 14:43:21 | `revisor-geral` | 1 | APROVADO | ad542c523b910dafc |
| 2026-11-22 14:42:06 | 2026-11-22 14:43:45 | `test-engineer` | 1 | APROVADO | aca2c70b176191cf2 |
| 2026-11-22 15:03:35 | 2026-11-22 15:03:46 | `tenancy-guardian` | 2 | APROVADO | a3eca4f99c2220255 |
| 2026-11-22 15:03:42 | 2026-11-22 15:04:03 | `privacy-guardian` | 2 | APROVADO | aab5b6e930f62b0d0 |
| 2026-11-22 15:03:48 | 2026-11-22 15:04:09 | `conformidade-reviewer` | 2 | APROVADO | ac146b1d5c910c49c |
| 2026-11-22 15:04:01 | 2026-11-22 15:04:25 | `llm-integrator` | 2 | APROVADO | a5544a4cd06631dad |
| 2026-11-22 15:03:55 | 2026-11-22 15:04:33 | `infra-guardian` | 2 | APROVADO | af02f62cbf3098317 |
| 2026-11-22 15:04:14 | 2026-11-22 15:04:37 | `revisor-geral` | 2 | APROVADO | a3f2da3af5ccab849 |
| 2026-11-22 15:04:07 | 2026-11-22 15:05:00 | `test-engineer` | 2 | APROVADO | a051258168de7848e |
