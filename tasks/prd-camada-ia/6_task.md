# Tarefa 6.0 — A coordenação vê "IA do mês: N% do previsto" no Painel e na Governança, sem reais nem tokens

**Funcionalidade:** camada-ia · **Depende de:** 2.0
**Subagentes obrigatórios:** `tenancy-guardian`, `conformidade-reviewer`, `frontend-reviewer`
**Porte:** grande

## Objetivo

`GET /v1/governanca/consumo` passa a devolver o orçamento do mês (`situacao`, `porcentagem`, `aviso`) e, por função, a
`parte` e as execuções, sem tokens nem custo. O Painel mostra "IA do mês: N% do previsto" com o aviso, e a Governança
troca os tokens pela `parte`.

## Contexto necessário

- `techspec.md` §4 (`governanca/consumo`, `situacao`, `aviso`), §7c ("Volta do código"), §9 ("Coordenação")
- `prd.md` RF9, RF12, §4, §6
- `cenarios.md` §1 RF9 (a linha da API), RF12, §2 ("Soma do mês"), §4 (coordenação, erro, celular e acessibilidade)
- Código: `packages/shared/src/governanca/governanca.ts`, `apps/api/src/governanca/governanca.service.ts`,
  `textos-da-governanca.ts` (`textoDoConsumo`), `Governanca.tsx`, `Painel.tsx` (`OConsumoDoMes`)

## Subtarefas

- [x] 6.1 — Contrato estrito em `packages/shared`: `orcamento`, `porFuncao [{ funcao, parte, execucoes }]`, `tutor`
- [x] 6.2 — O serviço lê o `OrcamentoDoMesRepository` (2.0); o mês fechado, o retrato
- [x] 6.3 — A auditoria de orçamento fora da leitura da coordenação
- [x] 6.4 — Governança: a `parte`, a porcentagem e o aviso; sai a frase do custo não medido
- [x] 6.5 — Painel: a linha "IA do mês", com os estados e o aviso
- [x] 6.6 — `docs/interface.md` §3 com os textos da `cenarios.md` §4; o passo da Governança no roteiro da demonstração e no seu e2e
- [x] 6.7 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/shared/src/governanca/governanca.ts`, `packages/shared/src/governanca/governanca.test.ts` | alterado |
| `apps/api/src/governanca/governanca.service.ts`, `apps/api/src/governanca/governanca.repository.ts`, `apps/api/src/governanca/governanca.int.test.ts` | alterado |
| `apps/web/src/areas/coordenacao/governanca/` (textos, tela, `api/governanca.ts` e os testes) | alterado |
| `apps/web/src/areas/coordenacao/painel/Painel.tsx`, `apps/web/src/areas/coordenacao/painel/Painel.test.tsx` | alterado |
| `e2e/governanca.spec.ts`, `e2e/painel-da-coordenacao.spec.ts`, `e2e/roteiro-da-demonstracao.spec.ts` | alterado |
| `docs/interface.md`, `docs/roteiro-da-demonstracao.md` | alterado |
| `apps/api/test/governanca-consumo.plano.int.test.ts` (o `EXPLAIN` do ano da maior escola, num banco só dele: o custo da carga não cabe no `governanca.int.test.ts`) | novo |
| `apps/web/src/areas/coordenacao/governanca/OrcamentoDoMes.tsx` (a linha do orçamento e a falha do consumo, que o Painel e a Governança usam) | novo |
| `apps/web/src/api/contrato/resposta-fora-do-contrato.ts` (a classe, o texto e o `lidoPeloContrato`, que a Operação já tinha: a Governança passa a usá-los), `apps/web/src/api/query-client.ts`, `apps/web/src/api/client.test.ts`, `apps/web/src/operacao/api/painel.ts`, `apps/web/src/operacao/textos.ts` (só passam a importar de lá) | novo e alterados |
| `tasks/prd-camada-ia/techspec.md` (§7c, "Volta do código"), `tasks/prd-camada-ia/cenarios.md` (§4, "Erro") | alterado |
| `apps/web/src/components/ui/ProgressBar.tsx`, `docs/interface.md` 10.2 (o valor escrito quebra dentro do cartão: a 360 px "75% do que a IA trabalhou no mês · 2 execuções" ultrapassava a borda) | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| o schema estrito recusa `tokens*` e `custoMicros` | U, I | RF12 | `governanca.test.ts` › "a coordenação não lê tokens nem reais…"; `governanca.int.test.ts` › "soma por função, no mês, sem origem…" |
| a 79% `aviso = null`; a 80% exatos `80`; a 100% `100`; no mês seguinte e no `?mes=` fechado a 120%, `null` | I | `>=` e o mês corrente | `governanca.int.test.ts` › "o aviso: a 79% é nulo…" e "o mês fechado a 120% não traz aviso…" |
| `parte` soma 100 (± arredondamento); zero token: `parte = 0` em todas | I | sem divisão por zero | `governanca.int.test.ts` › "a parte soma 100…"; a execução com duas linhas, num mês fechado (Assistente 500 + 500 em duas linhas, Tutor 3000: 25% e 75%): "a execução com duas linhas de consumo…" |
| a leitura da coordenação não grava o retrato do mês | I | só lê | `governanca.int.test.ts` › "a leitura da coordenação não grava o retrato…" |
| sem ano em curso e sem orçamento: sem porcentagem e sem aviso | I | `situacao` | `governanca.int.test.ts` › "sem valor, `sem_orcamento`; sem ano em curso e com valor, `sem_aluno_ativo`…"; o mês sem retrato: "o mês sem consumo e sem retrato responde sem função e `sem_retrato`…" |
| coordenação de A lê 20% e a de B 111% (`cenarios.md` §2) | I | escopo | `governanca.int.test.ts` › "a coordenação de A lê 20% e a de B lê 111%…" |
| professor e aluno: 404; a auditoria de orçamento fora da leitura da coordenação | I | o papel; RF12 | `governanca.int.test.ts` › "professor e aluno não alcançam nenhuma rota da governança…" e "as alterações de orçamento de A estão na auditoria…" |
| `EXPLAIN (ANALYZE, BUFFERS)` do `porFuncao`, num ano da maior escola | I | o índice | `governanca-consumo.plano.int.test.ts` › "o consumo por função de um mês da maior escola lê só o `consumo_ia_mes_idx`…" |
| os textos do Painel e da Governança sem "R$", "token" nem "crédito" | U | RF12, D40 | `textos-da-governanca.test.ts` › "nenhum texto do consumo e do orçamento diz…"; `Governanca.test.tsx` › "o consumo por função fica depois da tabela…" |
| Painel e Governança, o texto exato da `cenarios.md` §4 por estado: `definido`, aviso 80, aviso 100, `sem_orcamento`, `sem_aluno_ativo`; carregando; erro "…Tentar de novo" | U | §4 | `textos-da-governanca.test.ts` › "o orçamento do mês: o texto exato de cada estado…"; `Painel.test.tsx` › "o texto de cada estado do orçamento…" e "o consumo do mês: carregando, erro que relê só o consumo…"; `Governanca.test.tsx` › "o texto de cada estado do orçamento…", "carregando: só o aviso de leitura…" e "erro: diz o que fazer…" |
| Governança: "Assistente de ensino: 41% do que a IA trabalhou no mês · 128 execuções"; o traço de cada função tem o tamanho da `parte`; carregando, erro, mês sem execução | U | o texto, o tamanho da barra e os estados | `textos-da-governanca.test.ts` › "a parte da função é dita em porcentagem…"; `Governanca.test.tsx` › "o consumo por função fica depois da tabela…" (texto e `width` de cada barra) e "o mês sem execução: o orçamento aparece…" |
| resposta fora do contrato: "Atualize a página" | U | a volta do código | `Governanca.test.tsx` › "a resposta fora do contrato…"; `Painel.test.tsx` › "a resposta fora do contrato…"; `client.test.ts` › "a resposta fora do contrato não se repete…" |
| Painel e Governança a 360 px sem rolagem; alvo de 24 px; nada só por hover; aviso e porcentagem com texto, com a escola a 120% do previsto (o aviso de 100%, a frase mais longa) | E2E | §4 | `painel-da-coordenacao.spec.ts` › "a escola com entregas…" (120%, aviso de 100%, `paginaNaoRola`, axe); `governanca.spec.ts` › "a página não rola, a tabela vira lista no celular…" (120%, o aviso dentro da janela, os dois projetos); `roteiro-da-demonstracao.spec.ts` › o passo da Governança (o texto de `sem_orcamento`, o estado da escola dele) |

## Como testar

- API: `governanca.int.test.ts` › "o mês sem consumo e sem retrato responde sem função e `sem_retrato`…"
- Painel: `Painel.test.tsx` › "o consumo do mês: carregando, erro que relê só o consumo…"
- Governança: `Governanca.test.tsx` › "o consumo do mês por função fica depois da tabela…"
- E2E: `e2e/painel-da-coordenacao.spec.ts` › "a escola com entregas…"; `e2e/governanca.spec.ts` › "a página não rola, a tabela
  vira lista no celular…"; `paginaNaoRola` (`e2e/support/coordenacao.ts`)
- `npx vitest run --project integracao apps/api/src/governanca/governanca.int.test.ts`; `npx playwright test e2e/governanca.spec.ts`
- **Telas:** `coordenacao`, `/coordenacao/painel` (a linha "IA do mês", ao abrir) e `/coordenacao/governanca` (o
  consumo por função, ao abrir), de `COORDENACAO_ROUTES` em `apps/web/src/paths.ts`; sem mockup

## Fora do escopo desta tarefa

A Operação (7.0, 8.0); o sino (F13).

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano antes de codar.

1. **Mutações:** cada cláusula do diff tem o seu bloco em "Mutações", e o `--faltando` está no começo da seção. Os termos que o
   `--faltando` não vê (o campo do esquema zod, a `parte` do serviço, a coluna a mais no `select` do `EXPLAIN`, a fiação do
   `OrcamentoDoMes` e do `FalhaDoConsumo`) estão à mão, um por cláusula.
2. **Texto na tela:** "Consumo do mês: … tokens" saiu do Painel e "…tokens · …" e "não é medido" saíram da Governança; os e2e
   que os citavam (`painel-da-coordenacao`, `governanca`, `roteiro-da-demonstracao`) foram atualizados e rodam isolados. A escola
   do e2e, sem valor por aluno, vê `sem_orcamento` (a Governança, a escola sem ano e o roteiro); com `passarDoPrevistoDeIa`
   (`e2e/support/governanca.ts`, por SQL), o Painel e a Governança a 360 px e a 1366 px escrevem "IA do mês: 120% do previsto." e o
   aviso de 100%, a frase mais longa, dentro da janela e sem violação de acessibilidade.
3. **Segundo dado:** o `?mes=` fechado a 120% (retrato com valor diferente do de hoje), duas escolas com 20% e 111%, e uma
   execução com duas linhas de consumo (as funções com peso diferente), para que `tokensDoMes` e a `parte` quebrem sem cada termo.
4. **Checagem anterior:** os casos de integração passam pelo `GET /v1/governanca/consumo` com a coordenação, depois do
   `requireAnoEmCurso`: o caso `sem_aluno_ativo` é o da escola **sem** ano em curso, e o `sem_orcamento` o da escola sem valor; os
   dois chegam à linha do orçamento.
5. **Asserção:** os casos de web esperam a resposta (`findBy`/`waitFor` do texto positivo) antes de afirmar a ausência de
   "Tentar de novo", de aviso ou de "token". O `EXPLAIN` lê o `.toSQL()` de `consultaDoConsumoPorFuncao`, a consulta que o `consumo()`
   executa, e não um SQL escrito no teste.
6. **Guarda nova:** nenhuma. O esquema estrito é o do contrato, e o caso do esquema recusa cada campo proibido no topo, na
   função e no orçamento.
7. **Comentários e `docs/`:** os JSDoc dizem o que o código faz (a `parte` é a conta do servidor; o custo e os tokens não saem);
   `docs/interface.md` 3 e o roteiro foram escritos a partir dos textos do código, e o roteiro já não diz "tokens".
8. **Divergência:** uma, a web antiga com a API nova; a `techspec.md` §7c e a `cenarios.md` §4 dizem agora "Atualize a página".
9. **Peça que já existe:** o `OrcamentoDoMesRepository` (2.0) faz a conta do mês, e `parteDosTokens` e `mesDeSaoPaulo` estão em
   `packages/shared`; a `RespostaForaDoContrato` e o `lidoPeloContrato` da 7.0 foram movidos para `apps/web/src/api/`, e não copiados.
10. **Concorrência:** a leitura não grava nada; sem corrida. O `?mes=` do mês corrente e o `agora` vêm do mesmo relógio do serviço.
    O caso "a leitura da coordenação não grava o retrato…" compara `orcamento_ia_do_mes` antes e depois do `GET` (mês corrente e
    fechado), para a leitura nunca virar escrita sem ninguém perceber.
11. **Isolamento e a coluna "Caso":** o caso "A lê 20% e B lê 111%" prova o escopo do **orçamento** (o custo e os alunos da própria
    escola); o escopo do `consumoPorFuncao` é do caso "soma por função…, e não soma o de outra escola", e o do retrato de um mês
    fechado é do caso "o mês fechado a 120%…", que grava um retrato de B no mesmo mês (A lê 120% e B lê 50%). Cada linha da tabela de
    testes tem o caso.
12. **Guardiões:** `tenancy-guardian` (escopo no repository, o 404 de professor e aluno), `conformidade-reviewer` (D40, D64: sem
    real, sem token, por função, nunca por pessoa), `frontend-reviewer` (os quatro estados, 360 px, nada só por hover).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| A web antiga lendo a API nova: a Tech Spec dizia `ErrorState`; o texto é "Atualize a página", sem "Tentar de novo" (a classe `RespostaForaDoContrato` da 7.0 passa a morar em `api/` para a Governança também usá-la, e `operacao/textos.ts` a reexporta) | a `cenarios.md` §4 e a 7.0 já dizem "Atualize a página"; repetir traria a mesma resposta | `techspec.md` §7c, "Volta do código" (`RespostaForaDoContrato`); `cenarios.md` §4 ("Erro"); `docs/interface.md` 3 (Painel) |

## Mutações

`--faltando: 0 linhas (44 blocos, 0 motivos)`

Cada bloco tira uma cláusula, ou um termo de uma linha com vários, e o teste citado tem de ficar vermelho. A condição
`consumo.data !== undefined` de `Governanca.tsx` vira vermelha ao ganhar `&& consumo.isError` (o consumo com dado deixa de aparecer), e
o `situacao === 'definido'` de `textoDoOrcamento` tem o seu bloco, com o caso que passa um estado fora do contrato (`sem_orcamento` com 10%).

```mutacao
arquivo: apps/api/src/governanca/governanca.service.ts
teste: apps/api/src/governanca/governanca.int.test.ts › o mês fechado a 120% não traz aviso
-    const mes = consulta.mes ?? mesDeSaoPaulo(agora)
+    const mes = mesDeSaoPaulo(agora)
```

```mutacao
arquivo: apps/api/src/governanca/governanca.service.ts
teste: apps/api/src/governanca/governanca.int.test.ts › a execução com duas linhas de consumo
-    const tokensDoMes = gastaram.reduce((soma, linha) => soma + linha.tokensDeEntrada + linha.tokensDeSaida, 0)
+    const tokensDoMes = gastaram.reduce((soma, linha) => soma + linha.tokensDeEntrada, 0)
```

```mutacao
arquivo: apps/api/src/governanca/governanca.service.ts
teste: apps/api/src/governanca/governanca.int.test.ts › soma por função, no mês, sem origem
-      porFuncao: gastaram.map((linha) => ({ funcao: linha.funcao, parte: parteDosTokens(linha.tokensDeEntrada + linha.tokensDeSaida, tokensDoMes), execucoes: linha.execucoes })),
+      porFuncao: gastaram.map((linha) => ({ funcao: linha.funcao, parte: parteDosTokens(linha.tokensDeEntrada, tokensDoMes), execucoes: linha.execucoes })),
```

```mutacao
arquivo: apps/api/src/governanca/governanca.service.ts
teste: apps/api/src/governanca/governanca.int.test.ts › o aviso: a 79% é nulo
-      orcamento: { situacao, porcentagem, aviso },
+      orcamento: { situacao, porcentagem, aviso: null },
```

```mutacao
arquivo: apps/api/src/governanca/governanca.service.ts
teste: apps/api/src/governanca/governanca.int.test.ts › o aviso: a 79% é nulo
-      orcamento: { situacao, porcentagem, aviso },
+      orcamento: { situacao, porcentagem: 0, aviso },
```

```mutacao
arquivo: apps/api/src/governanca/governanca.repository.ts
teste: apps/api/test/governanca-consumo.plano.int.test.ts › o consumo por função de um mês da maior escola
falha: no['Node Type']
-        tokensDeSaida: sql<number>`coalesce(sum(${consumoIa.tokensDeSaida}), 0)::int`,
+        tokensDeSaida: sql<number>`coalesce(sum(${consumoIa.tokensDeSaida}), 0)::int`,
+        duracaoMs: sql<number>`coalesce(sum(${consumoIa.duracaoMs}), 0)::int`,
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: apps/api/src/governanca/governanca.int.test.ts › o mês fechado a 120% não traz aviso
-      .where(and(eq(orcamentoIaDoMes.escolaId, requireEscolaId()), eq(orcamentoIaDoMes.mes, primeiroDiaDoMes(mes))))
+      .where(eq(orcamentoIaDoMes.mes, primeiroDiaDoMes(mes)))
```

```mutacao
arquivo: packages/shared/src/governanca/governanca.ts
teste: packages/shared/src/governanca/governanca.test.ts › a situação, a porcentagem inteira e o aviso
falha: comParte(101)
-  parte: z.number().int().min(0).max(100),
+  parte: z.number().int().min(0),
```

```mutacao
arquivo: packages/shared/src/governanca/governanca.ts
teste: packages/shared/src/governanca/governanca.test.ts › a situação, a porcentagem inteira e o aviso
falha: comParte(101)
-  parte: z.number().int().min(0).max(100),
+  parte: z.number().int().max(100),
```

```mutacao
arquivo: packages/shared/src/governanca/governanca.ts
teste: packages/shared/src/governanca/governanca.test.ts › a situação, a porcentagem inteira e o aviso
falha: comParte(101)
-  parte: z.number().int().min(0).max(100),
+  parte: z.number().min(0).max(100),
```

```mutacao
arquivo: packages/shared/src/governanca/governanca.ts
teste: packages/shared/src/governanca/governanca.test.ts › a situação, a porcentagem inteira e o aviso
falha: expect(com(invalido)
-    porcentagem: z.number().int().nonnegative().nullable(),
+    porcentagem: z.number().nonnegative().nullable(),
```

```mutacao
arquivo: packages/shared/src/governanca/governanca.ts
teste: packages/shared/src/governanca/governanca.test.ts › a situação, a porcentagem inteira e o aviso
falha: expect(com(invalido)
-    porcentagem: z.number().int().nonnegative().nullable(),
+    porcentagem: z.number().int().nullable(),
```

```mutacao
arquivo: packages/shared/src/governanca/governanca.ts
teste: packages/shared/src/governanca/governanca.test.ts › a situação, a porcentagem inteira e o aviso
falha: expect(com(invalido)
-    aviso: z.union([z.literal(80), z.literal(100)]).nullable(),
+    aviso: z.number().int().nullable(),
```

```mutacao
arquivo: packages/shared/src/governanca/governanca.ts
teste: packages/shared/src/governanca/governanca.test.ts › a situação, a porcentagem inteira e o aviso
falha: expect(com(invalido)
-  .refine(({ situacao, porcentagem, aviso }) => (situacao === 'definido' ? porcentagem !== null : porcentagem === null && aviso === null), { message: 'porcentagem e aviso só valem em `definido`' })
+  .refine(({ situacao, porcentagem, aviso }) => (situacao === 'definido' ? porcentagem !== null : porcentagem === null), { message: 'porcentagem e aviso só valem em `definido`' })
```

```mutacao
arquivo: packages/shared/src/governanca/governanca.ts
teste: packages/shared/src/governanca/governanca.test.ts › a situação, a porcentagem inteira e o aviso
falha: expect(com(invalido)
-  .refine(({ situacao, porcentagem, aviso }) => (situacao === 'definido' ? porcentagem !== null : porcentagem === null && aviso === null), { message: 'porcentagem e aviso só valem em `definido`' })
+  .refine(({ situacao, porcentagem, aviso }) => (situacao === 'definido' ? true : porcentagem === null && aviso === null), { message: 'porcentagem e aviso só valem em `definido`' })
```

```mutacao
arquivo: packages/shared/src/governanca/governanca.ts
teste: packages/shared/src/governanca/governanca.test.ts › a situação, a porcentagem inteira e o aviso
falha: expect(com(invalido)
-  .refine(({ situacao, porcentagem, aviso }) => (situacao === 'definido' ? porcentagem !== null : porcentagem === null && aviso === null), { message: 'porcentagem e aviso só valem em `definido`' })
+  .refine(({ situacao, porcentagem, aviso }) => (situacao === 'definido' ? porcentagem !== null : aviso === null), { message: 'porcentagem e aviso só valem em `definido`' })
```

```mutacao
arquivo: packages/shared/src/governanca/governanca.ts
teste: packages/shared/src/governanca/governanca.test.ts › a coordenação não lê tokens nem reais
falha: orcamento: { ...consumo.orcamento, ...campo }
 export const orcamentoDoConsumoSchema = z
-  .strictObject({
+  .object({
```

```mutacao
arquivo: packages/shared/src/governanca/governanca.ts
teste: packages/shared/src/governanca/governanca.test.ts › a coordenação não lê tokens nem reais
falha: porFuncao: [{ ...consumo.porFuncao[0], ...campo }]
-export const consumoDaFuncaoSchema = z.strictObject({
+export const consumoDaFuncaoSchema = z.object({
```

```mutacao
arquivo: packages/shared/src/governanca/governanca.ts
teste: packages/shared/src/governanca/governanca.test.ts › a coordenação não lê tokens nem reais
falha: topo ${Object.keys(campo)[0]
-export const consumoResponseSchema = z.strictObject({
+export const consumoResponseSchema = z.object({
```

```mutacao
arquivo: packages/shared/src/governanca/governanca.ts
teste: packages/shared/src/governanca/governanca.test.ts › a parte é a fatia da função
-  if (tokensDoMes <= 0) return 0
```

```mutacao
arquivo: packages/shared/src/governanca/governanca.ts
teste: packages/shared/src/governanca/governanca.test.ts › a parte é a fatia da função
-  return Math.round((tokensDaFuncao * 100) / tokensDoMes)
+  return Math.floor((tokensDaFuncao * 100) / tokensDoMes)
```

```mutacao
arquivo: apps/web/src/api/query-client.ts
teste: apps/web/src/api/client.test.ts › a resposta fora do contrato não se repete
falha: shouldRetry(0, new RespostaForaDoContrato())
-  if (erro instanceof RespostaForaDoContrato) return false
```

```mutacao
arquivo: apps/web/src/api/contrato/resposta-fora-do-contrato.ts
teste: apps/web/src/areas/coordenacao/governanca/Governanca.test.tsx › a resposta fora do contrato
-      if (!lido.success) throw new RespostaForaDoContrato()
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/api/governanca.ts
teste: apps/web/src/areas/coordenacao/governanca/Governanca.test.tsx › a resposta fora do contrato
-  queryFn: ({ signal }) => authedGet(`${CAMINHO_DA_GOVERNANCA}/consumo`, lidoPeloContrato(consumoResponseSchema), signal),
+  queryFn: ({ signal }) => authedGet(`${CAMINHO_DA_GOVERNANCA}/consumo`, consumoResponseSchema, signal),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/Governanca.tsx
teste: apps/web/src/areas/coordenacao/governanca/Governanca.test.tsx › carregando: só o aviso de leitura, sem o orçamento
falha: expect(within(doConsumo()).queryByRole('alert'))
-      {consumo.isError && <FalhaDoConsumo erro={consumo.error} tentando={consumo.isFetching} aoTentarDeNovo={() => void consumo.refetch({ cancelRefetch: false })} />}
+      {<FalhaDoConsumo erro={consumo.error} tentando={consumo.isFetching} aoTentarDeNovo={() => void consumo.refetch({ cancelRefetch: false })} />}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/Governanca.tsx
teste: apps/web/src/areas/coordenacao/governanca/Governanca.test.tsx › erro: diz o que fazer
-      {consumo.isError && <FalhaDoConsumo erro={consumo.error} tentando={consumo.isFetching} aoTentarDeNovo={() => void consumo.refetch({ cancelRefetch: false })} />}
+      {consumo.isError && null}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/Governanca.tsx
teste: apps/web/src/areas/coordenacao/governanca/Governanca.test.tsx › a resposta fora do contrato
-      {consumo.isError && <FalhaDoConsumo erro={consumo.error} tentando={consumo.isFetching} aoTentarDeNovo={() => void consumo.refetch({ cancelRefetch: false })} />}
+      {consumo.isError && <ErrorState erro={consumo.error} tentando={consumo.isFetching} aoTentarDeNovo={() => void consumo.refetch()} />}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/Governanca.tsx
teste: apps/web/src/areas/coordenacao/governanca/Governanca.test.tsx › o consumo por função fica depois da tabela
-      {consumo.data !== undefined ? (
+      {consumo.data !== undefined && consumo.isError ? (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/Governanca.tsx
teste: apps/web/src/areas/coordenacao/governanca/Governanca.test.tsx › o mês sem execução
-          {consumo.data.porFuncao.length === 0 ? (
+          {consumo.data.porFuncao.length === 99 ? (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/Governanca.tsx
teste: apps/web/src/areas/coordenacao/governanca/Governanca.test.tsx › o consumo por função fica depois da tabela
-          <OrcamentoDoMes orcamento={consumo.data.orcamento} />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/painel/Painel.tsx
teste: apps/web/src/areas/coordenacao/painel/Painel.test.tsx › mostra os quatro números da escola
-      <OrcamentoDoMes orcamento={consumo.data.orcamento} />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/painel/Painel.tsx
teste: apps/web/src/areas/coordenacao/painel/Painel.test.tsx › a resposta fora do contrato
-      <FalhaDoConsumo erro={consumo.error} tentando={consumo.isFetching} aoTentarDeNovo={() => void consumo.refetch()} />
+      <ErrorState erro={consumo.error} tentando={consumo.isFetching} aoTentarDeNovo={() => void consumo.refetch()} />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/painel/Painel.tsx
teste: apps/web/src/areas/coordenacao/painel/Painel.test.tsx › o consumo do mês: carregando, erro que relê só o consumo
-    return consumo.isError ? (
+    return false ? (
```

```mutacao
arquivo: apps/web/src/components/ui/ProgressBar.tsx
teste: apps/web/src/areas/coordenacao/governanca/Governanca.test.tsx › o consumo por função fica depois da tabela
-        <span className="min-w-0 font-semibold break-words text-tinta tabular-nums">{texto ?? percentualDaBarra(valor, maximo)}</span>
+        <span className="min-w-0 font-semibold break-words text-tinta tabular-nums">{percentualDaBarra(valor, maximo)}</span>
```

```mutacao
arquivo: apps/web/src/components/ui/ProgressBar.tsx
teste: e2e/governanca.spec.ts › a página não rola, a tabela vira lista no celular
projeto: celular
falha: expect(valoresForaDoCartao)
-        <span className="min-w-0 font-semibold break-words text-tinta tabular-nums">{texto ?? percentualDaBarra(valor, maximo)}</span>
+        <span className="shrink-0 font-semibold text-tinta tabular-nums">{texto ?? percentualDaBarra(valor, maximo)}</span>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/OrcamentoDoMes.tsx
teste: apps/web/src/areas/coordenacao/governanca/Governanca.test.tsx › o texto de cada estado do orçamento
-      {aviso !== null && <Alert tom="atencao">{aviso}</Alert>}
+      {<Alert tom="atencao">{aviso}</Alert>}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/OrcamentoDoMes.tsx
teste: apps/web/src/areas/coordenacao/governanca/Governanca.test.tsx › o texto de cada estado do orçamento
-      {aviso !== null && <Alert tom="atencao">{aviso}</Alert>}
+      {aviso !== null && null}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/OrcamentoDoMes.tsx
teste: apps/web/src/areas/coordenacao/governanca/Governanca.test.tsx › a resposta fora do contrato
-  if (erro instanceof RespostaForaDoContrato) {
+  if (erro === undefined) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/textos-da-governanca.ts
teste: apps/web/src/areas/coordenacao/governanca/textos-da-governanca.test.ts › o orçamento do mês: o texto exato de cada estado
falha: textoDoOrcamento({ situacao: 'sem_orcamento', porcentagem: 10, aviso: 80 })
-  if (situacao === 'definido' && porcentagem !== null) return { linha: `IA do mês: ${formatNumber(porcentagem)}% do previsto.`, aviso: aviso === null ? null : AVISO_DO_ORCAMENTO[aviso] }
+  if (porcentagem !== null) return { linha: `IA do mês: ${formatNumber(porcentagem)}% do previsto.`, aviso: aviso === null ? null : AVISO_DO_ORCAMENTO[aviso] }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/textos-da-governanca.ts
teste: apps/web/src/areas/coordenacao/governanca/textos-da-governanca.test.ts › o orçamento do mês: o texto exato de cada estado
-  if (situacao === 'definido' && porcentagem !== null) return { linha: `IA do mês: ${formatNumber(porcentagem)}% do previsto.`, aviso: aviso === null ? null : AVISO_DO_ORCAMENTO[aviso] }
+  if (situacao === 'definido') return { linha: `IA do mês: ${formatNumber(porcentagem ?? 0)}% do previsto.`, aviso: aviso === null ? null : AVISO_DO_ORCAMENTO[aviso] }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/textos-da-governanca.ts
teste: apps/web/src/areas/coordenacao/governanca/textos-da-governanca.test.ts › o orçamento do mês: o texto exato de cada estado
-  if (situacao === 'definido' && porcentagem !== null) return { linha: `IA do mês: ${formatNumber(porcentagem)}% do previsto.`, aviso: aviso === null ? null : AVISO_DO_ORCAMENTO[aviso] }
+  if (situacao === 'definido' && porcentagem !== null) return { linha: `IA do mês: ${formatNumber(porcentagem)}% do previsto.`, aviso: AVISO_DO_ORCAMENTO[aviso ?? 80] }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/textos-da-governanca.ts
teste: apps/web/src/areas/coordenacao/governanca/textos-da-governanca.test.ts › o orçamento do mês: o texto exato de cada estado
-  return { linha: SEM_PORCENTAGEM[situacao === 'definido' ? 'sem_retrato' : situacao], aviso: null }
+  return { linha: SEM_PORCENTAGEM[situacao === 'definido' ? 'sem_orcamento' : situacao], aviso: null }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/textos-da-governanca.ts
teste: apps/web/src/areas/coordenacao/governanca/textos-da-governanca.test.ts › o orçamento do mês: o texto exato de cada estado
-  return { linha: SEM_PORCENTAGEM[situacao === 'definido' ? 'sem_retrato' : situacao], aviso: null }
+  return { linha: SEM_PORCENTAGEM[situacao === 'definido' ? 'sem_retrato' : 'sem_orcamento'], aviso: null }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/governanca/Governanca.tsx
teste: apps/web/src/areas/coordenacao/governanca/Governanca.test.tsx › o consumo por função fica depois da tabela
-                <ProgressBar key={linha.funcao} rotulo={nomeDaFuncao(linha.funcao)} valor={linha.parte} texto={textoDaParte(linha)} />
+                <ProgressBar key={linha.funcao} rotulo={nomeDaFuncao(linha.funcao)} valor={0} texto={textoDaParte(linha)} />
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| `conformidade-reviewer`, 1ª | Escola com um professor só: a linha por função ("Assistente de ensino") conta, na prática, o uso daquele professor; avaliar o piso de dois professores da D45 | Decisão de produto, e a linha por função já existia antes da tarefa: validação e retro (Arquiteto); `TODO.md` |
| `conformidade-reviewer`, 1ª | O texto do aviso de 100% ("a equipe Turmma vai conversar com vocês se isso se repetir") pode ser lido como cobrança | O texto é o da `cenarios.md` §4 e do PRD; confirmar o tom com o Gabriel; `TODO.md` |
| `frontend-reviewer`, 1ª; `revisor-geral`, 1ª | `FalhaDoConsumo` (`OrcamentoDoMes.tsx`) refaz a caixa de erro que o `ErrorState` e o `Alert tom="erro"` já desenham; a Operação tem outra cópia (`CascaDaOperacao.tsx`) | Muda o markup e quebra os blocos de mutação que citam `FalhaDoConsumo`; centralizar a variante "Atualize a página" junto com a da Operação: `TODO.md` |
| `frontend-reviewer`, 1ª | Botão "Atualizar a página" (`location.reload`) no lugar do texto só | Muda o texto de tela fixado na `cenarios.md` §4 ("sem 'Tentar de novo'"): `TODO.md`, para o Arquiteto decidir |
| `frontend-reviewer`, 1ª | A foto do computador não mostra o consumo por função: conferir a 1366 px no projeto `chromebook` | Fica para o Validador, que fotografa cada requisito com tela |
| `frontend-reviewer`, 1ª | `e2e/governanca.spec.ts` usa `p > span.font-semibold`, que depende das classes da `ProgressBar` | Trocar por `data-testid` altera `ProgressBar.tsx`, que a mutação de 360 px cita: `TODO.md` |
| `infra-guardian`, 1ª | `::int` na soma de tokens do mês (`governanca.repository.ts`) estoura perto de 2,1 bilhões por função | O cast já existia antes da tarefa e a linha está no bloco de mutação do `EXPLAIN`; trocar para `::float8` ou `::bigint` muda contrato e plano: `TODO.md` |
| `infra-guardian`, 1ª | `consumoPorFuncao` e `doMes` leem a mesma faixa do índice, duas vezes | Aceito: a rota não se atualiza sozinha (`semLeituraSozinha`); reabrir se o Painel passar a se atualizar sozinho |
| `privacy-guardian`, 1ª | Aplicar o mesmo piso da D45 se a tela ganhar recorte por série ou turma | Não há recorte nesta tarefa; recusada |
| `revisor-geral`, 1ª | Em `textos-da-governanca.ts` o mapa `situacao === 'definido' ? 'sem_retrato' : situacao` esconde um caso que o `refine` do contrato já impede | Muda a linha que dois blocos de mutação citam, sem mudar comportamento; `TODO.md` |
| `revisor-geral`, 1ª | O "Tentar de novo" do Painel chama `consumo.refetch()` sem `cancelRefetch: false`, e o da Governança passa a opção | Muda comportamento e a linha que o bloco de mutação do Painel cita: `TODO.md` |
| `test-engineer`, 2ª | RF9 "no mês seguinte": falta um caso com relógio falso perto da meia-noite do último dia (o serviço usa `mesDeSaoPaulo(relogio.agora())` e o teste usa o `now()` do Postgres) | Exige injetar o relógio nos dois lados do teste: `TODO.md` (risco só na virada do mês) |
| `test-engineer`, 2ª | O caso da auditoria (6.3) grava a linha por SQL; gravar pelo `PUT` da Operação provaria o caminho real | O `PUT` e a auditoria dele são da Operação e têm teste próprio (`apps/api/test/painel-escrita.int.test.ts`, 3.0); a 6.0 só prova que a coordenação não os lê: recusada |
| `revisor-geral`, 2ª | `passarDoPrevistoDeIa` (`e2e/support/governanca.ts`) muda o custo da primeira linha de `consumo_ia` pela ordem do `id`, sem filtrar pelo mês corrente; funciona porque `montarEscolaComEntregas` grava tudo em `now()` | `TODO.md`: só importa se o suporte passar a gravar linha em mês fechado |
| `revisor-geral`, 2ª | No caso das duas linhas (`governanca.int.test.ts`), a consulta do `execucao_id` não filtra `estado = 'concluida'` | `TODO.md`: o resultado não muda (a chave estrangeira aceita qualquer execução de A) |
| `test-engineer`, 3ª | O bloco de mutação do `escola_id` de `retrato()` só fica vermelho se o retrato de B for o primeiro que o seq scan devolve (a consulta pega `[linha]` sem `order by`); falta um caso em que só B tem retrato num mês fechado e A lê `sem_retrato` | Validação e retro (Arquiteto); `TODO.md` |
| `test-engineer`, 3ª | No Painel, `paginaNaoRola` substituiu `horizontalOverflow`: no `chromebook` exige também que a página não role na vertical a 1366 × 768 | Validador confirma que o portão rodou o caso nos dois projetos e dentro de metade do prazo |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-20 23:21:34 | 2026-11-20 23:23:32 | `test-engineer` | 1 | REPROVADO | a7d1dfc28dbf55c92 |
| 2026-11-21 19:40:18 | 2026-11-21 19:40:59 | `tenancy-guardian` | 1 | APROVADO | a122a8cd318884abf |
| 2026-11-21 19:40:25 | 2026-11-21 19:41:17 | `conformidade-reviewer` | 1 | APROVADO | a0fdccd1812177df4 |
| 2026-11-21 19:40:33 | 2026-11-21 19:41:36 | `frontend-reviewer` | 1 | APROVADO | ab0855836c9a5d363 |
| 2026-11-21 19:40:55 | 2026-11-21 19:41:56 | `privacy-guardian` | 1 | APROVADO | a200bbf54fa438e5f |
| 2026-11-21 19:41:02 | 2026-11-21 19:41:57 | `infra-guardian` | 1 | APROVADO | a97a4f18ac8977f6a |
| 2026-11-21 19:40:48 | 2026-11-21 19:42:48 | `revisor-geral` | 1 | APROVADO | a1c2b129cd355d4f1 |
| 2026-11-21 19:40:41 | 2026-11-21 19:44:21 | `test-engineer` | 2 | REPROVADO | a718925f8d1ce7dbf |
| 2026-11-21 21:17:52 | 2026-11-21 21:18:31 | `revisor-geral` | 2 | APROVADO | a8f085d6f7e56c41c |
| 2026-11-21 21:17:44 | 2026-11-21 21:19:42 | `test-engineer` | 3 | APROVADO | a849c62323ddeaed1 |
