# Tarefa 1.0 — Toda chamada ao modelo grava o seu custo, pelo preço vigente, numa linha só dela

**Funcionalidade:** camada-ia · **Depende de:** nenhuma
**Subagentes obrigatórios:** `privacy-guardian`, `infra-guardian`, `llm-integrator`
**Porte:** grande

## Objetivo

Cada chamada enviada ao adaptador grava a sua linha em `consumo_ia`, com custo em micros pelo preço vigente (hoje é
sempre zero, numa linha por execução); a Governança passa a contar execuções, não linhas.

## Contexto necessário

- `techspec.md` §1, §2 (`packages/core/src/ia/`), §3 ("Uma linha por chamada enviada", "A estimativa", primeira frase),
  §5 ("A subida": modelo sem preço), §7c ("Volta do código")
- `prd.md` RF5, RF6, §6 (D14), §7 ("Preço sobe no meio do mês")
- `cenarios.md` §1: RF5 (as três primeiras linhas e a da Governança), RF6 (as quatro primeiras)
- `.claude/rules/30-camada-ia.md` (item 4), `80-infra-e-carga.md`
- Código: `consumo.ts` (`PRECO_DOS_MODELOS`), `llm-gateway.ts` (`chamarAteValer`, o registro, `exigirPrecoDosModelosMenores`),
  `apps/api/src/ia/consumo.repository.ts`, `apps/api/src/governanca/governanca.repository.ts`

## Subtarefas

- [x] 1.1 — `PRECO_DOS_MODELOS` com chave `provedor:modelo`, uma lista de vigências (`vigenteDesde`, `fonte`, entrada e saída
  em micros por mil tokens); `custoDaChamada(tokens, preço)` com `ceil`; o preço é o da vigência no instante da chamada
- [x] 1.2 — O gateway grava uma linha por chamada enviada (`tentativas = 1`): a saída inválida grava `falhou`/`IA_SAIDA_INVALIDA`,
  `entrada` e `saida` só na última; a troca para o menor leva o modelo e o preço de cada um; a chamada que saiu sem uso
  (prazo, conexão, servidor) grava a entrada contada e a saída no teto da tarefa; a que não saiu não grava
- [x] 1.3 — Fora de `local`, com `openai_compat`, a subida recusa modelo do principal sem preço, citando a variável
- [x] 1.4 — A Governança conta `count(distinct execucao_id)`
- [x] 1.5 — `docs/runbook.md`, "Voltar o código depois da camada-ia 1.0": a anterior conta linhas como execuções; a web
  antiga com a API nova cai no `ErrorState` (vale também para a 6.0)
- [x] 1.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/ia/consumo.ts`, `packages/core/src/ia/consumo.test.ts` | alterado |
| `packages/core/src/ia/llm-gateway.ts`, `packages/core/src/ia/llm-gateway.test.ts` | alterado |
| `packages/core/src/config/llm-config.ts`, `packages/core/src/config/llm-config.test.ts` | alterado |
| `packages/core/src/index.ts` | alterado |
| `apps/api/src/ia/consumo.repository.ts`, `apps/api/src/ia/ia.int.test.ts` | alterado |
| `apps/api/src/governanca/governanca.repository.ts`, `apps/api/src/governanca/governanca.int.test.ts` | alterado |
| `docs/runbook.md` | alterado |
| `packages/shared/src/governanca/governanca.ts`, `packages/shared/src/governanca/governanca.test.ts` | alterado (o contrato troca `chamadas` por `execucoes`, 1.4 e 1.5) |
| `apps/api/src/governanca/governanca.service.ts` | alterado (soma `execucoes`) |
| `apps/web/src/areas/coordenacao/governanca/textos-da-governanca.ts`, `textos-da-governanca.test.ts`, `Governanca.test.tsx`; `apps/web/src/areas/coordenacao/painel/Painel.test.tsx` | alterado (o mesmo contrato, na web) |
| `apps/api/src/tutor/tutor.service.ts` | alterado (a linha da regra fixa leva `custoMicros: 0`) |
| `apps/api/src/ia/prazo-com-tokens.int.test.ts` | alterado (a linha da 1.ª chamada inválida, sem a linha do prazo) |
| `packages/core/src/db/schema/consumo-ia.ts` | alterado (só o docblock) |
| `packages/core/src/ia/openai-compat-adapter.test.ts`, `packages/core/src/ia/tasks/classificar-secoes.test.ts`, `conteudo.test.ts`, `numeros.test.ts` | alterado (duas linhas por execução com repetição) |
| `docs/modelo-de-dados.md` | alterado |
| `tasks/prd-camada-ia/techspec.md`, `tasks/prd-camada-ia/cenarios.md`, `TODO.md` | alterado (divergências e recomendações sem aplicar) |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| 3.000 + 250 tokens a 1.300 e 5.200 micros por mil: 5.200 | U | a conta | `consumo.test.ts` › 3.000 de entrada e 250 de saída a 1.300 e 5.200 micros por mil tokens: 5.200 |
| 1.001 + 1 tokens: para cima | U | `ceil` | `consumo.test.ts` › a fração de micro arredonda para cima, nunca para baixo: 1.001 + 1 tokens e 1 token só |
| duas vigências do mesmo modelo: cada chamada no seu preço; a linha antiga não muda | U | preço novo só nas seguintes | `consumo.test.ts` › cada chamada fica no preço da sua vigência e `llm-gateway.test.ts` › duas vigências do mesmo modelo: cada chamada grava o preço do seu instante, e a linha antiga não muda com o preço novo. "O mês soma as duas" é do `orcamento-do-mes.repository.int.test.ts`, de tarefa adiante; o `ia.int.test.ts` › grava o custo em micros que a linha traz prova só que o repository grava o `custoMicros` |
| o mesmo modelo em dois provedores, a preços diferentes | U | a chave `provedor:modelo` | `consumo.test.ts` › o mesmo modelo em dois provedores tem dois preços; `llm-gateway.test.ts` › o mesmo modelo em dois provedores, a preços diferentes |
| primeira saída inválida, segunda válida: duas linhas, cada uma com os seus tokens e custo | I | uma linha por chamada | `ia.int.test.ts` › a primeira saída inválida e a segunda válida: duas linhas no banco |
| `entrada` e `saida` só na segunda linha | I | regra 20 | o mesmo caso (`tem_entrada` e `tem_saida` só na `concluida`) |
| troca para o menor: duas linhas, modelo e preço de cada um | I | o modelo que atendeu | `ia.int.test.ts` › a troca para o modelo menor: duas linhas no banco, cada uma com o seu modelo e o seu custo; `llm-gateway.test.ts` › troca para o menor: duas linhas |
| prazo esgotado depois do envio: a linha tem entrada contada, saída no teto, custo > 0 | I | D14 | `ia.int.test.ts` › o prazo esgotado depois do envio: a linha tem a entrada contada |
| disjuntor aberto: nenhuma linha | U | só o que saiu | `llm-gateway.test.ts` › disjuntor aberto no lote: nenhuma linha, e o job adia; fora do lote, › disjuntor aberto fora do lote: uma linha da falha |
| principal inválido duas vezes: duas linhas | U | o limite | `llm-gateway.test.ts` › principal inválido duas vezes: duas linhas |
| `AMBIENTE=producao`, `openai_compat`, modelo sem preço: a subida recusa citando a variável | U | modelo sem preço não sobe | `llm-gateway.test.ts` › AMBIENTE=producao com openai_compat e o modelo comum sem preço: recusa citando LLM_MODELO; `llm-config.test.ts` › o preço do modelo é exigido na subida |
| Governança com uma execução de duas linhas: `execucoes = 1` | I | `count(distinct)` | `governanca.int.test.ts` › a execução com duas linhas de consumo conta uma execução; › a linha sem execução conta uma por linha |


## Como testar

- Conta: `packages/core/src/ia/consumo.test.ts` › "os dois do adaptador falso custam zero; modelo que não está na tabela não
  tem preço" (a forma de montar a tabela)
- Linhas por chamada: `packages/core/src/ia/llm-gateway.test.ts` › "degrau 2: passados os 8 s sem vaga, vai ao modelo menor
  do perfil…" (o menor e o consumo); `ScriptedAdapter` (`packages/core/src/ia/__fixtures__/scripted-adapter.ts`) para a
  inválida e o prazo
- Subida: `packages/core/src/config/llm-config.test.ts` › "em produção o adaptador falso é recusado…"
- Governança: `apps/api/src/governanca/governanca.int.test.ts` › "o mês sem consumo responde zerado…"
- `npx vitest run --project unidade packages/core/src/ia/` e `npx vitest run --project integracao apps/api/src/ia/ia.int.test.ts`


## Fora do escopo desta tarefa

A coluna `pelo_provedor_de_reserva` (2.0); o provedor de reserva (9.0 a 11.0); a estimada da interrompida com dois destinos (11.0).

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano antes de codar.

1. **Mutação de cada cláusula:** a seção "Mutações" tem um bloco por termo e por ternário do diff (preço: `hasOwn`, `=== undefined`, os três termos da vigência, o `ceil` nos dois sentidos; gateway: os dois termos do registro da falha, o `semEnvio`, a linha sem envio, `ultima`/`concluida`, a entrada só na última, o `falhou` do registro, a chave `provedor:modelo` nos dois lugares, o `exigePreco`, os dois motivos da subida; config: os dois termos e a variável de cada perfil; repository: o `custoMicros`; Governança: o `count(distinct)` e o termo da linha sem execução). `--faltando` está vazio, e o motivo escrito de cada termo sem bloco está no começo da seção. Rodei os blocos isolados antes do portão.
2. **Texto na tela:** a tarefa troca o rótulo `chamadas` por `execucoes` no contrato e em `textoDoConsumo`/`textoDoCusto`; o texto que o coordenador lê não mudou. `grep -rln 'chamadas' e2e/ apps/web/src` não acha texto de tela com o campo; os testes da web tocados rodaram isolados.
3. **Segundo dado:** o caso do `count(distinct)` insere uma segunda linha da mesma execução, e o da linha sem execução insere duas sem `execucao_id`; o do preço tem duas vigências e dois provedores com o mesmo modelo.
4. **Checagem anterior:** os casos de integração do gateway usam `Roteirizado` (provedor externo com `provedorId`) e a tabela de preços do teste, e a linha é lida do banco pela escola e pela execução; o dublê lança `LLMError` com o código que a produção lança (`IA_TEMPO_ESGOTADO`).
5. **Asserção olha o resultado:** todas leem as linhas gravadas (estado, código, tokens, custo, modelo, `entrada`/`saida`), não o texto do código. O "nenhuma linha" do lote é `toHaveLength(0)` depois de o job adiar.
6. **Guarda nova:** nenhuma.
7. **Comentário que afirma o que o código não faz:** conferi os docblocks de `consumo.ts`, `llm-gateway.ts`, `consumo-ia.ts` (schema), `textos-da-governanca.ts` e as duas seções de `docs/` (`modelo-de-dados.md`, `runbook.md`); o runbook cita só variáveis e campos que existem (`LLM_MODELO`, `LLM_MODELO_<PERFIL>`, `AMBIENTE`, `consumo_ia.provedor`, `GET /v1/governanca/consumo`).
8. **Divergência que muda regra:** três, na tabela abaixo: a contagem de execuções e a chamada que não saiu estão na `techspec.md` §3 e §4 e no `cenarios.md` (RF5); a subida pelo `createLLMGateway`, na `techspec.md` §5 e no `cenarios.md` (RF6).
9. **Peça que já existe:** o preço usa a chave e o `chaveDoBalde` que o gateway já tinha (`provedorId ?? origem`); a subida substitui `exigirPrecoDosModelosMenores` em vez de somar uma segunda conferência; `SEM_ENVIO_EXTERNO` e `registrar` são os de antes.
10. **Concorrência:** não há operação nova que rode duas vezes ao mesmo tempo; o `registrarLinhas` é sequencial de propósito (uma que falha não esconde a seguinte), e o caso que prova isso é `se o registro de uma das linhas falhar`.
11. **Isolamento e coluna "Caso":** a linha da tabela de testes tem o caso na coluna; o isolamento está em `a linha é da escola de quem gastou` (a escola B não ganha linha) e no `count` da Governança, que já filtrava por `escolaId`; a tarefa não acrescenta consulta nova nem mexe no `where`.
12. **Guardiões e achados:** `privacy-guardian` (regra 20: `entrada`/`saida` só na última linha, nada de conteúdo de saída inválida; `consumo_ia.provedor` por linha dá a lista do arquivo do titular mais exata), `infra-guardian` (a subida recusa modelo sem preço; um insert por chamada no caminho quente, sem ida a mais ao banco; runbook da volta), `llm-integrator` (custo pelo preço vigente, `ceil`, estimativa que superestima). `achados/indice.md` ainda não tem linha desta tarefa.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| `execucoes` é `count(distinct execucao_id)` **mais uma por linha sem `execucao_id`** | O `count(distinct)` ignora `NULL`: a resposta da regra fixa do Tutor (frase de crise, `tentativas = 0`) grava a linha sem execução, e ela sumiria da conta do mês | `techspec.md` §4 (Governança, `execucoes`); `cenarios.md` §1, RF5 (a linha da Governança, com o caso da linha sem execução) |
| A chamada que não saiu fora do lote deixa **uma** linha da falha (`tentativas = 0`, sem tokens, custo nem envio); no lote, nenhuma | A spec diz "a que não saiu não grava", mas a falha do tutor e da ferramenta (disjuntor aberto, sem vaga) tem de continuar com a sua linha, como a do balde cheio da X6; o lote adia e tenta de novo, e por isso não grava | `techspec.md` §3 ("Uma linha por chamada enviada"); `cenarios.md` §1, RF5 |
| A subida recusa o modelo do principal sem preço pelo `createLLMGateway` (com `LLMConfig.exigePreco`), e não dentro do `loadLLMConfig` | O `loadLLMConfig` não conhece a tabela de preços, e fazer a conta ali quebraria os testes que carregam produção com `openai_compat` para outro fim; o `createLLMGateway` já conferia o modelo menor e recebe a tabela por porta | `techspec.md` §5 ("A subida"); `cenarios.md` §1, RF6 (a linha da subida) |

## Mutações

`--faltando: 0 linhas (38 blocos, 4 motivos)`

Motivos (termo sem bloco, com o porquê):

- `erro instanceof LLMError` (`llm-gateway.ts`, a guarda do push de `chamadaSemUso`): só estreita o tipo de `unknown` para ler `semEnvio`; para erro que não é `LLMError` o `semEnvio` é `undefined`, e o resultado é o mesmo com ou sem o termo. O `semEnvio` e o ternário do código têm bloco.
- `config.modelo?.modelos[perfil] ?? ''` e `config.modelo?.variaveisDosModelos?.[perfil] ?? 'LLM_MODELO'` (`exigirPrecoDosModelos`): o `loadLLMConfig` preenche `modelo.modelos` e `variaveisDosModelos` sempre que `exigePreco` é `true`; o `?.` e o `??` só servem ao tipo (config montada à mão no teste).
- `vigente === undefined` (`precoDoModelo`): tirar o termo deixa `Date.parse(vigente.vigenteDesde)` lendo propriedade de `undefined`, e o vermelho seria de exceção, não de asserção; o bloco com `vigente?.vigenteDesde` prova a cláusula pelo resultado (nenhuma vigência escolhida).

```mutacao
arquivo: packages/core/src/ia/consumo.ts
teste: packages/core/src/ia/consumo.test.ts › o nome que existe em todo objeto
-  const vigencias = Object.hasOwn(tabela, chave) ? tabela[chave] : undefined
+  const vigencias = tabela[chave]
   if (vigencias === undefined) return undefined
```

```mutacao
arquivo: packages/core/src/ia/consumo.ts
teste: packages/core/src/ia/consumo.test.ts › modelo que não está na tabela
   const vigencias = Object.hasOwn(tabela, chave) ? tabela[chave] : undefined
-  if (vigencias === undefined) return undefined
   let vigente: VigenciaDePreco | undefined
```

```mutacao
arquivo: packages/core/src/ia/consumo.ts
teste: packages/core/src/ia/consumo.test.ts › antes da primeira vigência não há preço
-    if (desde <= instante.getTime() && (vigente === undefined || desde > Date.parse(vigente.vigenteDesde))) vigente = vigencia
+    if (vigente === undefined || desde > Date.parse(vigente.vigenteDesde)) vigente = vigencia
```

```mutacao
arquivo: packages/core/src/ia/consumo.ts
teste: packages/core/src/ia/consumo.test.ts › a vigência vale a partir do instante exato
-    if (desde <= instante.getTime() && (vigente === undefined || desde > Date.parse(vigente.vigenteDesde))) vigente = vigencia
+    if (desde < instante.getTime() && (vigente === undefined || desde > Date.parse(vigente.vigenteDesde))) vigente = vigencia
```

```mutacao
arquivo: packages/core/src/ia/consumo.ts
teste: packages/core/src/ia/consumo.test.ts › cada chamada fica no preço da sua vigência
-    if (desde <= instante.getTime() && (vigente === undefined || desde > Date.parse(vigente.vigenteDesde))) vigente = vigencia
+    if (desde <= instante.getTime()) vigente = vigencia
```

```mutacao
arquivo: packages/core/src/ia/consumo.ts
teste: packages/core/src/ia/consumo.test.ts › cada chamada fica no preço da sua vigência
-    if (desde <= instante.getTime() && (vigente === undefined || desde > Date.parse(vigente.vigenteDesde))) vigente = vigencia
+    if (desde <= instante.getTime() && desde > Date.parse(vigente?.vigenteDesde ?? '')) vigente = vigencia
```

```mutacao
arquivo: packages/core/src/ia/consumo.ts
teste: packages/core/src/ia/consumo.test.ts › a lista em ordem de data
-    if (desde <= instante.getTime() && (vigente === undefined || desde > Date.parse(vigente.vigenteDesde))) vigente = vigencia
+    if (desde <= instante.getTime() && vigente === undefined) vigente = vigencia
```

```mutacao
arquivo: packages/core/src/ia/consumo.ts
teste: packages/core/src/ia/consumo.test.ts › o adaptador falso, o modelo local
-  if (preco === undefined) return 0
+  if (preco === undefined) return 1
   const microsPorMil
```

```mutacao
arquivo: packages/core/src/ia/consumo.ts
teste: packages/core/src/ia/consumo.test.ts › a fração de micro arredonda para cima
-  return (microsPorMil - resto) / 1_000 + (resto === 0 ? 0 : 1)
+  return (microsPorMil - resto) / 1_000 + (0)
```

```mutacao
arquivo: packages/core/src/ia/consumo.ts
teste: packages/core/src/ia/consumo.test.ts › a conta exata não ganha micro a mais
-  return (microsPorMil - resto) / 1_000 + (resto === 0 ? 0 : 1)
+  return (microsPorMil - resto) / 1_000 + (1)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › a chamada anterior que saiu continua tendo a sua linha
-      if (gasto.chamadas.length > 0 || !adiavelSemEnvio) {
+      if (!adiavelSemEnvio) {
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › disjuntor aberto fora do lote
-      if (gasto.chamadas.length > 0 || !adiavelSemEnvio) {
+      if (gasto.chamadas.length > 0) {
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › disjuntor aberto no lote
-        if (!(erro instanceof LLMError && erro.semEnvio)) gasto.chamadas.push(this.chamadaSemUso(pedido, entrada, correcao, gasto.modelo, inicioDaChamada, erro instanceof LLMError ? erro.codigoDeIa : 'IA_INDISPONIVEL'))
+        if (!(erro instanceof LLMError && false)) gasto.chamadas.push(this.chamadaSemUso(pedido, entrada, correcao, gasto.modelo, inicioDaChamada, erro instanceof LLMError ? erro.codigoDeIa : 'IA_INDISPONIVEL'))
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › a repetição que cai leva a correção na entrada contada
-        if (!(erro instanceof LLMError && erro.semEnvio)) gasto.chamadas.push(this.chamadaSemUso(pedido, entrada, correcao, gasto.modelo, inicioDaChamada, erro instanceof LLMError ? erro.codigoDeIa : 'IA_INDISPONIVEL'))
+        if (!(erro instanceof LLMError && erro.semEnvio)) gasto.chamadas.push(this.chamadaSemUso(pedido, entrada, correcao, gasto.modelo, inicioDaChamada, 'IA_INDISPONIVEL'))
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › a chamada que voltou grava o custo
-      if (interpretada.ok) return interpretada.saida
+      void interpretada.ok
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o mesmo modelo em dois provedores, a preços diferentes
-    const preco = precoDoModelo(chaveDoPreco(adaptador.envio.provedorId ?? adaptador.origem, modelo), em, precos)
+    const preco = precoDoModelo(chaveDoPreco(adaptador.origem, modelo), em, precos)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o preço é do
-  const provedor = adaptador.envio.provedorId ?? adaptador.origem
+  const provedor = adaptador.origem
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › disjuntor aberto fora do lote
-    if (chamadas.length === 0) {
-      return [this.consumo(pedido, { ...medicao, tentativas: 0, ...SEM_ENVIO_EXTERNO }, { ...final.conteudo, estado: final.estado, ...(final.codigoDeErro === undefined ? {} : { codigoDeErro: final.codigoDeErro }) }, 0, this.relogio.agora())]
-    }
+    if (chamadas.length === 0) return []
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › disjuntor aberto fora do lote
-      return [this.consumo(pedido, { ...medicao, tentativas: 0, ...SEM_ENVIO_EXTERNO }, { ...final.conteudo, estado: final.estado, ...(final.codigoDeErro === undefined ? {} : { codigoDeErro: final.codigoDeErro }) }, 0, this.relogio.agora())]
+      return [this.consumo(pedido, { ...medicao, tentativas: 0, ...SEM_ENVIO_EXTERNO }, { ...final.conteudo, estado: final.estado }, 0, this.relogio.agora())]
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › primeira saída inválida e a segunda válida
-      const concluida = ultima && final.estado === 'concluida'
+      const concluida = final.estado === 'concluida'
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › principal inválido duas vezes
-      const concluida = ultima && final.estado === 'concluida'
+      const concluida = ultima
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › a chamada que voltou grava o custo
-      const resultado: Pick<ConsumoDeIa, 'estado' | 'codigoDeErro'> = concluida ? { estado: 'concluida' } : { estado: 'falhou', codigoDeErro: chamada.codigoDeErro }
+      const resultado: Pick<ConsumoDeIa, 'estado' | 'codigoDeErro'> = { estado: 'falhou', codigoDeErro: chamada.codigoDeErro }
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › `entrada` e `saida` ficam só na última linha
-      return this.consumo(pedido, medida, { ...(ultima ? final.conteudo : {}), ...resultado }, chamada.custoMicros, chamada.em)
+      return this.consumo(pedido, medida, { ...final.conteudo, ...resultado }, chamada.custoMicros, chamada.em)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › se o registro de uma das linhas falhar
-    if (falhou) throw new LLMError('IA_INDISPONIVEL')
+    void falhou
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o preço precisa já estar vigente
-  exigirPrecoDosModelos(config, interno, portas.precos, (portas.relogio ?? systemClock).agora())
+  exigirPrecoDosModelos(config, interno, portas.precos, systemClock.agora())
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › com preço em todos os modelos, sobe
-    config.exigePreco === true ? PERFIS.filter((perfil) => semPreco(config.modelo?.modelos[perfil] ?? '')).map((perfil) => config.modelo?.variaveisDosModelos?.[perfil] ?? 'LLM_MODELO') : []
+    true ? PERFIS.filter((perfil) => semPreco(config.modelo?.modelos[perfil] ?? '')).map((perfil) => config.modelo?.variaveisDosModelos?.[perfil] ?? 'LLM_MODELO') : []
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › com preço em todos os modelos, sobe
-  const dosMenores = Object.entries(config.modelosMenores ?? {})
+  const dosMenores = Object.entries(config.modelosMenores ?? { rapido: 'sem-preco' })
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o perfil com modelo próprio sem preço cita a variável dele
-  if (doPrincipal.length === 0 && dosMenores.length === 0) return
+  if (dosMenores.length === 0) return
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › modelo menor sem preço em PRECO_DOS_MODELOS
-  if (doPrincipal.length === 0 && dosMenores.length === 0) return
+  if (doPrincipal.length === 0) return
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o principal e o menor sem preço juntos
-  throw new InvalidConfigError([...new Set([...doPrincipal, ...dosMenores])].sort(), [...(doPrincipal.length === 0 ? [] : [MOTIVO_MODELO_SEM_PRECO]), ...(dosMenores.length === 0 ? [] : [MOTIVO_MODELO_MENOR_SEM_PRECO])])
+  throw new InvalidConfigError([...new Set([...doPrincipal, ...dosMenores])].sort(), [...[], ...(dosMenores.length === 0 ? [] : [MOTIVO_MODELO_MENOR_SEM_PRECO])])
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o modelo comum sem preço: recusa citando
-  throw new InvalidConfigError([...new Set([...doPrincipal, ...dosMenores])].sort(), [...(doPrincipal.length === 0 ? [] : [MOTIVO_MODELO_SEM_PRECO]), ...(dosMenores.length === 0 ? [] : [MOTIVO_MODELO_MENOR_SEM_PRECO])])
+  throw new InvalidConfigError([...new Set([...doPrincipal, ...dosMenores])].sort(), [...(doPrincipal.length === 0 ? [] : [MOTIVO_MODELO_SEM_PRECO]), MOTIVO_MODELO_MENOR_SEM_PRECO])
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts › o preço do modelo é exigido na subida
-  return valores.AMBIENTE !== 'local' && valores.IA_ADAPTADOR === 'openai_compat'
+  return valores.IA_ADAPTADOR === 'openai_compat'
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts › o preço do modelo é exigido na subida
-  return valores.AMBIENTE !== 'local' && valores.IA_ADAPTADOR === 'openai_compat'
+  return valores.AMBIENTE !== 'local'
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts › o preço do modelo é exigido na subida
-    ...(exigeOPreco(valores) ? { exigePreco: true as const } : {}),
+    ...{ exigePreco: true as const },
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts › de qual variável vem o modelo de cada perfil
-  return doPerfil[perfil] === undefined ? 'LLM_MODELO' : `LLM_MODELO_${perfil.toUpperCase()}`
+  return 'LLM_MODELO'
```

```mutacao
arquivo: apps/api/src/ia/consumo.repository.ts
teste: apps/api/src/ia/ia.int.test.ts › grava o custo em micros que a linha traz
-      custoMicros: consumo.custoMicros,
+      custoMicros: 0,
```

```mutacao
arquivo: apps/api/src/governanca/governanca.repository.ts
teste: apps/api/src/governanca/governanca.int.test.ts › a execução com duas linhas de consumo
-        execucoes: sql<number>`(count(distinct ${consumoIa.execucaoId}) + count(*) filter (where ${consumoIa.execucaoId} is null))::int`,
+        execucoes: sql<number>`count(*)::int`,
```

```mutacao
arquivo: apps/api/src/governanca/governanca.repository.ts
teste: apps/api/src/governanca/governanca.int.test.ts › a linha sem execução
-        execucoes: sql<number>`(count(distinct ${consumoIa.execucaoId}) + count(*) filter (where ${consumoIa.execucaoId} is null))::int`,
+        execucoes: sql<number>`count(distinct ${consumoIa.execucaoId})::int`,
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (1ª) | `llm-gateway.ts`: `ChamadaEnviada.codigoDeErro` é mutável e é corrigido depois de criado; passar o código ao montar a chamada | Não aplicada: refatoração em três pontos do gateway, sem mudar comportamento, que caducaria todos os revisores. Destino: a 10.0, que reabre o `chamarContando` |
| revisor-geral (1ª), conformidade-reviewer (1ª), llm-integrator (1ª), test-engineer (1ª) | `textos-da-governanca.ts`: "ainda não é medido nesta versão" fica impreciso, porque o custo agora é medido | Destino: 6.0, subtarefa 6.4 ("sai a frase do custo não medido"); texto de tela, e a 6.0 refaz a tela |
| privacy-guardian (1ª) | Na Governança, `comEnvioExterno` conta chamadas e `execucoes` conta execuções: um rótulo que deixe a diferença clara | Destino: 6.0 (6.4 troca a Governança; a 6.0 devolve as execuções por função) |
| privacy-guardian (1ª) | `docs/lgpd.md`, linha 99: dizer que a execução pode ter mais de uma linha de consumo e que a da saída inválida não guarda conteúdo | Destino: `TODO.md` ("Da camada-ia, tarefa 1.0"); `docs/lgpd.md` não é arquivo desta tarefa, e nenhum campo pessoal novo entrou |
| conformidade-reviewer (1ª) | `packages/core/src/db/schema/mensagem-tutor.ts:28` diz que o freio do dia "conta as chamadas dele em `consumo_ia`" | Destino: `TODO.md`; o erro é anterior à tarefa e o arquivo não é dela (o mesmo erro no `consumo-ia.ts` foi corrigido na rodada 1) |
| infra-guardian (1ª) | `registrarLinhas(...).catch(() => undefined)` descarta sem rastro a linha que não gravou; um contador `ia.consumo.registro_falhou{funcao}` | Destino: `TODO.md`; métrica nova muda comportamento e contrato de observabilidade |
| infra-guardian (1ª), llm-integrator (1ª) | A subida com `openai_compat` fora de `local` só funciona depois que o modelo real (inclusive o Ollama) entra em `PRECO_DOS_MODELOS`; checklist de deploy da F18 e aviso no `.env.example` | Destino: `TODO.md` (F18); `.env.example` não é arquivo desta tarefa, e o runbook já traz a recusa na subida |
| infra-guardian (1ª) | Confirmar que nenhum painel ou alerta lê a causa da falha em `consumo_ia` em vez de `execucao_agente` | Recusada, conferido: fora de teste, só `apps/api/src/ia/consumo.repository.ts` toca `codigo_de_erro`/`codigoDeErro` em `apps/api/src` e `apps/web/src` |
| test-engineer (1ª) | O caso da troca para o menor em `ia.int.test.ts` espera 8 s em tempo real; usar relógio falso | Recusada: roda com folga (limite de 30 s) e a unidade já prova o mesmo com relógio falso |
| test-engineer (1ª) | `ia.int.test.ts` importa de `../../../../packages/core/src/...` em vez de `@educa/core` | Destino: `TODO.md`; mexe na superfície exportada de `@educa/core` |
| test-engineer (1ª) | Falta um caso que fixe, passando pelo `ResilientAdapter` com o servidor falso, que 429 que sobra e conexão recusada gravam a estimativa | Destino: 10.0, que trata o principal caído e passa pelo `ResilientAdapter` |
| revisor-geral (2ª) | A linha RF5 nova em `cenarios.md:51` cita só o arquivo (`llm-gateway.test.ts`), sem a camada ("unidade"); outras linhas trazem a camada junto | Não aplicada: só recomendação de revisor que aprovou, depois da primeira ordem do documento; é rótulo de documento, sem efeito sobre a prova. Destino: quem tocar o `cenarios.md` na validação |
| revisor-geral (2ª) | Na validação, conferir que a 10.0 (`codigoDeErro` mutável) e a 6.4 (texto "ainda não é medido") pegam as recomendações da 1ª rodada | Destino: Validador; já estão na tabela "Sem aplicar" do `1_task.md` |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-21 01:41:45 | 2026-11-21 01:42:16 | `tenancy-guardian` | 1 | APROVADO | a9a4baa02ab83104d |
| 2026-11-21 01:41:24 | 2026-11-21 01:42:31 | `privacy-guardian` | 1 | APROVADO | a284e33a41d191089 |
| 2026-11-21 01:41:49 | 2026-11-21 01:42:45 | `conformidade-reviewer` | 1 | APROVADO | a063d4bfa9f42137c |
| 2026-11-21 01:41:32 | 2026-11-21 01:42:55 | `llm-integrator` | 1 | APROVADO | afadc3802c0a7afe5 |
| 2026-11-21 01:41:28 | 2026-11-21 01:43:25 | `infra-guardian` | 1 | APROVADO | a081bf6f68847f00b |
| 2026-11-21 01:41:41 | 2026-11-21 01:43:47 | `revisor-geral` | 1 | REPROVADO | a9dc16f13fc0ad414 |
| 2026-11-21 01:41:36 | 2026-11-21 01:44:46 | `test-engineer` | 1 | APROVADO | a4daac6aa925d2ad5 |
| 2026-11-21 02:05:51 | 2026-11-21 02:06:16 | `revisor-geral` | 2 | APROVADO | a825c411e6b0b65b8 |
| 2026-11-21 02:05:40 | 2026-11-21 02:07:01 | `test-engineer` | 2 | APROVADO | a3d0d638e6dca6d1f |
