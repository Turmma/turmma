# Correção — a tela da coordenação fica em "Carregando…" depois da entrada (a trava da rede do navegador, agora fora do `goto`), e dois casos de `pedidos-do-titular.spec.ts` caem com ela

**Origem:** esteira run `43736759780` (commit `b8280ad`, `spec/reengenharia-continuacao`), job `e2e 4/11`: `e2e/pedidos-do-titular.spec.ts:209` (clique estoura os 90 s) e `:424` (elemento ausente); a execução anterior (`6bd8f12`) passou. Pedido do Orquestrador em 15/11/2026.
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `frontend-reviewer`, `privacy-guardian`, `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- Os quatro primeiros vieram no PEDIDO do Orquestrador. Os três últimos a Mesa exigiu na devolução: a árvore altera arquivo de `e2e/`, e todo arquivo de `e2e/` pede os sete (`tools/processo/guardioes-por-caminho.ts`). -->

## Sintoma

```
:209  Error: locator.click: Test timeout of 90000ms exceeded.
        - waiting for getByRole('main').getByRole('tab', { name: 'Pedidos', exact: true })
        at irPelaCoordenacao (support/coordenacao.ts:82) ← entrarNosPedidos (support/pedidos-do-titular.ts:95)
:424  Error: expect(locator).toBeAttached() failed
        Locator: getByRole('heading', { name: 'Painel', level: 1 })  · Timeout: 20000ms
        at esperarPainel (support/casca.ts:296) ← entrarNosPedidos (support/pedidos-do-titular.ts:94)
```

Os outros 181 casos do shard passaram. Nos dois casos o `error-context.md` mostra a casca montada (lateral, nome da pessoa) e o `main` com só `status: Carregando…`.

## Fora desta correção

Nada: o pedido veio sem arquivos da tarefa em curso.

## Causa

**De qual tarefa: de nenhuma.** O diff de `6bd8f12` (verde) a `b8280ad` só toca `tools/processo/`, documentos e regras: nenhum arquivo de `apps/`, `packages/` nem `e2e/`. Não é regressão do código.

**É a trava da rede do navegador sob a rede do perfil, a quarta vez, agora depois do `load`** (as três do `goto`: `2026-10-17-casca-carregando-estoura-o-goto`, `2026-10-26-areas-entrar-estoura-o-prazo`, `2026-11-08-incidente-ao-entrar-de-novo`). O traço (`traco-do-e2e-4`, lido nesta correção) tem a mesma assinatura:

- login, `/v1/eu` e os pedaços da área (`coordenacao-*.js`, `tela-coordenacao-*.js`) chegam em 0,6 s cada;
- numa rajada de pedidos criados no mesmo instante (`:209`: 12, entre eles os `GET /v1/anos-letivos`, `/v1/professores`… ; `:424`: 18 `parte-*.js` e `tela-coordenacao-Painel-*.js`) **nenhum recebe resposta**: `headersSize: -1`, sem `wait` nem `receive`, e o navegador não escreve mais evento nenhum até o fim do caso (76 s no `:209`). O servidor nunca os viu;
- a tela fica no `Suspense` ("Carregando…") para sempre, e o caso espera o prazo dele.

Na mesma execução a trava do `goto` apareceu uma vez e **foi desfeita** pela nova tentativa (`::warning … pedidos-do-titular.spec.ts:462 (chromebook) /entrar: sem load em 15000 ms`, caso verde), e um `DesenhoDaOnca-*.css` levou 10,6 s: o shard 4 estava com a rede do navegador ruim naquele momento. A causa dentro do Chromium **continua sem prova**; esta correção não finge o contrário.

**Por que o remédio de 08/11 não pegou:** ele cobre o `page.goto`. Aqui o `load` veio e os pedaços de depois da entrada ficaram presos, e a espera (`esperarPainel`, e o clique na aba de `irPelaCoordenacao`, que não tem prazo próprio e usa os 90 s do caso) é o que cai. O caminho de entrada é de 139 chamadas.

## Teste que reproduz

`e2e/guardas.spec.ts`, bloco `a tela que fica em Carregando… depois da entrada ganha uma recarga, uma só, e fica anotada` (três casos, nos dois projetos). A rota serve `/coordenacao/painel` com a tela em "Carregando…" e, no pedido seguinte, com o `h1 Painel`; o prazo da tela vai a 1 s (`test.use({ prazoDaTelaMs })`) e o aviso da esteira é guardado, sem escrever no stdout:

1. `o Painel preso em Carregando… é recarregado, abre, anota e avisa a esteira`: `esperarPainel` termina, a rota teve 2 pedidos, a página passou por `/coordenacao/painel`, `about:blank`, `/coordenacao/painel`, e há uma anotação e uma linha `::warning`, com o caminho. O caso confere também que `descricaoDaTelaTravada('http://x/coordenacao/painel?token=a#b', …)` não leva a query nem o fragmento.
2. `só a tela em Carregando… é recarregada, e a recarga é uma só: a falha de outra natureza e a segunda trava reprovam`: com uma tela que tem `status` ("Não foi possível carregar") e não é a de "Carregando…", `esperarPainel` reprova na primeira (1 pedido, nenhuma anotação: o filtro `/^Carregando/` é provado); com a tela em "Carregando…" nas duas cargas, reprova com o erro da espera depois de **uma** recarga (2 pedidos, uma anotação, uma linha `::warning`). 
3. `a página de um contexto novo do navegador também ganha a recarga: no título do Painel e na aba que o clique espera` (a ordem da rodada 1, itens 1 e 2): numa página de `browser.newContext()`, a rota serve "Carregando…", depois o Painel com o título e ainda "Carregando…", depois o Painel com a aba. `esperarPainel` recarrega uma vez (2 pedidos); `activateQuandoAparecer` espera a aba, recarrega outra vez (3 pedidos), clica (`aria-selected` vira `true`), e há duas anotações e duas linhas `::warning`.

**Vermelho antes** (fixture do HEAD, `chromebook`): o caso 1 ficou 24 s no `esperarPainel` e reprovou (a espera não recarrega); o caso 2 chegou a `expect(presa()).toBe(2)` com `Received: 1` e estourou os 30 s do caso. (Na primeira versão o caso 1 abria `/coordenacao/painel?token=…`, que a rota não pega: o app real respondeu e foi para `/entrar`; a query saiu do caso.) **Verde depois:** 20 de 20 (`--repeat-each=5`, os dois projetos), na primeira versão; na da rodada 2, os três casos, 18 de 18 (`--repeat-each=3`, os dois projetos).

**Prova na aplicação real** (caso descartável, apagado: não entra no commit): entrada da coordenação pela tela, com `tela-coordenacao-Painel-*.js` preso na primeira vez e solto depois. Nos dois projetos: uma anotação `/coordenacao/painel: a tela ficou em Carregando… por 20000 ms; uma recarga`, e o Painel abriu na recarga, o que mostra que **a sessão sobrevive à recarga** (a suposição do fixture).

## Correção

Só e2e muda; o produto não.

- `e2e/support/profiles.ts`: `esperarATela(page, esperar)` e `descricaoDaTelaTravada` (exportadas), a opção `prazoDaTelaMs` (`PRAZO_DA_ESPERA_DA_TELA_MS`, 20 s, o prazo que a entrada já tinha) e a fixture automática `travaDoCaso`, que guarda por **caso** (`WeakMap` por `TestInfo`, e não por página) o prazo e o `registrar` único (anotação `primeira-carga-travou` e linha `::warning`, as mesmas da trava do `goto`), usado pelo `goto` do `page` e por `esperarATela`; por ser do caso, a recarga vale também para a página de `browser.newContext()` (`outroNavegador` do roteiro da demonstração e de `incidentes`), e fora de um caso do `test` deste arquivo `esperarATela` espera como antes, sem recarga e sem lançar. O comportamento do `goto` não muda. `esperarATela` espera o que lhe pedem; se a espera falha e o `main` mostra "Carregando…", registra, passa por `about:blank`, volta ao endereço e espera **uma** vez mais com o mesmo prazo. Outra falha é relançada sem recarga.
- `e2e/support/casca.ts`: `esperarPainel` espera o título pelo `esperarATela` (o endereço continua conferido antes).
- `e2e/support/coordenacao.ts`: `irPelaCoordenacao` espera a aba, o seletor e o link pelo `esperarATela` antes de acionar (`activateQuandoAparecer`, agora exportada e testada): o clique não tinha prazo próprio e esperava os 90 s do caso, o `:209`. **O que isso muda para quem lê a esteira:** a espera da aba, do seletor ou do link que demora **sem** estar em "Carregando…" cai em 20 s, com o erro da espera (`expect(...).toBeVisible()`), e não mais ao fim do caso (90 s) com um `locator.click` estourado; com a tela em "Carregando…" são 20 s mais a recarga mais 20 s, dentro dos 90 s. Não é regressão da tela: é o prazo que a entrada já tinha para o título do Painel (`SIGN_IN_TIMEOUT_MS`). Que nenhum caso dependia da folga antiga, só a esteira diz.
- `e2e/guardas.spec.ts`: os três casos acima.
- **O nome do prazo** (ordem, item 3): `PRAZO_DA_ESPERA_DA_TELA_MS`, no padrão português do arquivo. O `PRAZO_DA_TELA_MS` que a ordem sugere é o `de` do mapa `tools/renomear/mapas/11.json` (o teste `restos` reprova o nome antigo na árvore: foi o que reprovou o primeiro portão), e o `SCREEN_TIMEOUT_MS` do mapa já existe em `e2e/support/professor/scenario.ts`. `grep` confere: nenhum outro arquivo importa a constante.
- `pedidos-do-titular.spec.ts` não muda: os casos estão certos e a trava é de qualquer tela depois da entrada.

**O que a correção não prova.** (1) Que a recarga desfaça a trava de verdade na esteira: a trava não se reproduz, e só a esteira diz; o aviso é o instrumento (todo `::warning title=primeira-carga-travou` na execução é uma ocorrência, também com a esteira verde, e ocorrência que se repete é regressão). A mesma segunda carga já desfez a trava do `goto` na própria execução que caiu (`:462`). (2) As três trocas de `activate` por `activateQuandoAparecer` dentro de `irPelaCoordenacao` (aba, seletor, link) não têm caso próprio: o caminho da coordenação pela casca real (lateral, gaveta, abas) não cabe numa página servida pela rota. A função que elas chamam, `activateQuandoAparecer`, tem o caso 3 e o bloco de mutação; a ligação é provada pelo descartável acima (a espera do Painel, que passa pela mesma função de espera) e pelos 139 usos do e2e. (3) Só as esperas de `esperarPainel` e de `irPelaCoordenacao` ganham a recarga: a trava em outro ponto (a tela do professor, uma leitura de dentro de um caso) cai como caía, e é correção nova.

## Mutações

--faltando: 0 linhas (0 blocos, 0 motivos)

```mutacao
arquivo: e2e/support/profiles.ts
teste: e2e/guardas.spec.ts › só a tela em Carregando… é recarregada, e a recarga é uma só: a falha de outra natureza e a segunda trava reprovam
falha: expect(outraTela()).toBe(1)
-    if ((await carregando.count()) === 0) throw erro
```

```mutacao
arquivo: e2e/support/profiles.ts
teste: e2e/guardas.spec.ts › o Painel preso em Carregando… é recarregado, abre, anota e avisa a esteira
     const url = page.url()
-    trava.registrar(descricaoDaTelaTravada(url, trava.prazoMs))
```

```mutacao
arquivo: e2e/support/profiles.ts
teste: e2e/guardas.spec.ts › o Painel preso em Carregando… é recarregado, abre, anota e avisa a esteira
-        testInfo.annotations.push({ type: 'primeira-carga-travou', description: descricao })
```

```mutacao
arquivo: e2e/support/profiles.ts
teste: e2e/guardas.spec.ts › o Painel preso em Carregando… é recarregado, abre, anota e avisa a esteira
-        avisoDaEsteira.escrever(linhaDoAviso(`${relative(process.cwd(), testInfo.file)}:${testInfo.line}`, testInfo.project.name, descricao))
```

```mutacao
arquivo: e2e/support/profiles.ts
teste: e2e/guardas.spec.ts › o Painel preso em Carregando… é recarregado, abre, anota e avisa a esteira
-    await page.goto('about:blank')
```

```mutacao
arquivo: e2e/support/profiles.ts
teste: e2e/guardas.spec.ts › só a tela em Carregando… é recarregada, e a recarga é uma só: a falha de outra natureza e a segunda trava reprovam
     await page.goto(url)
-    await esperar(trava.prazoMs)
```

```mutacao
arquivo: e2e/support/profiles.ts
teste: e2e/guardas.spec.ts › só a tela em Carregando… é recarregada, e a recarga é uma só: a falha de outra natureza e a segunda trava reprovam
     await page.goto(url)
-    await esperar(trava.prazoMs)
+    await esperarATela(page, esperar)
```

```mutacao
arquivo: e2e/support/casca.ts
teste: e2e/guardas.spec.ts › o Painel preso em Carregando… é recarregado, abre, anota e avisa a esteira
-  await esperarATela(page, (timeout) => expect(page.getByRole('heading', { level: 1, name: 'Painel' })).toBeAttached({ timeout }))
+  await expect(page.getByRole('heading', { level: 1, name: 'Painel' })).toBeAttached({ timeout: SIGN_IN_TIMEOUT_MS })
```

```mutacao
arquivo: e2e/support/profiles.ts
teste: e2e/guardas.spec.ts › só a tela em Carregando… é recarregada, e a recarga é uma só: a falha de outra natureza e a segunda trava reprovam
falha: expect(outraTela()).toBe(1)
-    const carregando = page.getByRole('main').getByRole('status').filter({ hasText: /^Carregando/ })
+    const carregando = page.getByRole('main').getByRole('status')
```

```mutacao
arquivo: e2e/support/profiles.ts
teste: e2e/guardas.spec.ts › o Painel preso em Carregando… é recarregado, abre, anota e avisa a esteira
-  return `${new URL(alvo).pathname}: a tela ficou em Carregando… por ${prazoMs} ms; uma recarga`
+  return `${alvo}: a tela ficou em Carregando… por ${prazoMs} ms; uma recarga`
```

```mutacao
arquivo: e2e/support/profiles.ts
teste: e2e/guardas.spec.ts › a página de um contexto novo do navegador também ganha a recarga: no título do Painel e na aba que o clique espera
-    { auto: true },
+    { auto: false },
```

```mutacao
arquivo: e2e/support/coordenacao.ts
teste: e2e/guardas.spec.ts › a página de um contexto novo do navegador também ganha a recarga: no título do Painel e na aba que o clique espera
-  await esperarATela(page, (timeout) => expect(alvo).toBeVisible({ timeout }))
```

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-15 16:52:28 | 2026-11-15 16:52:39 | `tenancy-guardian` | 1 | APROVADO | ab3ebda9975a4b364 |
| 2026-11-15 16:52:22 | 2026-11-15 16:52:48 | `frontend-reviewer` | 1 | APROVADO | a55c166a9ec936ae8 |
| 2026-11-15 16:52:33 | 2026-11-15 16:52:51 | `infra-guardian` | 1 | APROVADO | a0544e78b3b297950 |
| 2026-11-15 16:52:25 | 2026-11-15 16:52:52 | `privacy-guardian` | 1 | APROVADO | abe0d24ed5ca070ac |
| 2026-11-15 16:52:31 | 2026-11-15 16:52:52 | `conformidade-reviewer` | 1 | APROVADO | a7101144fd7714660 |
| 2026-11-15 16:52:19 | 2026-11-15 16:53:31 | `revisor-geral` | 1 | REPROVADO | a05c611939b6085de |
| 2026-11-15 16:52:16 | 2026-11-15 16:54:53 | `test-engineer` | 1 | REPROVADO | afa00fec927b6c8e6 |

## Provas da rodada 2

- `e2e/roteiro-da-demonstracao.spec.ts` e `e2e/incidentes.spec.ts:328` (os dois que usam página de `browser.newContext()` e passam por `esperarPainel` e `irPelaCoordenacao`), nos dois projetos: 4 de 4 verdes (1,6 min), com a trava por caso.
- `e2e/guardas.spec.ts`, os três casos da trava: 18 de 18 (`--repeat-each=3`, os dois projetos).

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| `frontend-reviewer` (1ª) | `page.goto(url)` na recarga usa o `goto` já embrulhado por `gotoComNovaTentativa`; o tempo total pode chegar a 20 s + recarga + 20 s e deve caber nos 90 s do caso, "vale conferir na esteira" | Confirmar na esteira (o aviso `primeira-carga-travou` é o instrumento); sem mudança de código |
| `frontend-reviewer` (1ª) | No celular, o topo mostra "Colégio s…" truncado ao lado de Sino e Sair; "não é desta tarefa" | `TODO.md` (tela da coordenação; fora de uma correção de e2e) |
| `frontend-reviewer` (1ª) | A ligação de `irPelaCoordenacao` ao `esperarATela` não tem caso próprio | Coberta pelo caso 3 e pelo bloco de mutação de `activateQuandoAparecer` (a ordem, item 2) |
| `infra-guardian` (1ª) | Em produção a tela fica em "Carregando…" para sempre quando um pedaço ou leitura não volta; abrir tarefa de produto com prazo, "tente de novo" e recarga | `TODO.md`: tarefa de produto, fora desta correção (que é só de e2e) |
| `infra-guardian` (1ª) | Nada conta as ocorrências de `primeira-carga-travou` por execução; um passo da esteira ou linha no runbook somaria e acenderia acima de um limite | `TODO.md` (esteira); a regra "ocorrência que se repete é regressão" fica no documento |
| `infra-guardian` (1ª) | A ligação de `irPelaCoordenacao` com a recarga não tem caso próprio; "fica registrado para a retro" | Coberta pelo caso 3 |
| `privacy-guardian` (1ª) | Um caso de e2e que conte leituras na auditoria com número exato quebraria depois de uma recarga | Só informação, sem risco de privacidade; o caso ficaria vermelho, sem esconder nada. Nada a fazer |
| `conformidade-reviewer` (1ª) | Avaliar se tarefa que só altera `e2e/support/` precisa do `conformidade-reviewer` | Retro (a tabela é `tools/processo/guardioes-por-caminho.ts`) |
| `test-engineer` (1ª) | O portão só roda o spec alterado: rodar os specs que importam o arquivo de suporte alterado | Retro (processo do portão, `tools/processo/`); esta rodada mostrou o custo |
| 2026-11-15 17:24:24 | 2026-11-15 17:25:25 | `revisor-geral` | 2 | APROVADO | aae4d72f9952896c2 |
| 2026-11-15 17:24:15 | 2026-11-15 17:26:27 | `test-engineer` | 2 | APROVADO | af6cf4957f0adc0e3 |
| `revisor-geral` (2ª) e `test-engineer` (2ª) | Os quatro blocos `mutacao` novos estavam dentro da seção "Revisões", e o lugar deles é "Mutações" | Feito: movidos para "Mutações" com Edit |
| `test-engineer` (2ª) e `revisor-geral` (2ª) | O ramo de `esperarATela` sem caso (`if (trava === undefined) return esperar(PRAZO_DA_ESPERA_DA_TELA_MS)`) não tem teste nem bloco: hoje nenhuma chamada chega nele | `TODO.md`, seção "Da correção 2026-11-15-e2e-pedidos-do-titular": lançar erro claro em vez da espera sem recarga, ou testar o ramo. É só defesa |
| `test-engineer` (2ª) | As três trocas de `activate` por `activateQuandoAparecer` em `irPelaCoordenacao` não têm teste: voltar qualquer uma não derruba caso nenhum | Já dito em "O que a correção não prova", item 2; `TODO.md`, mesma seção |
| `revisor-geral` (2ª) | `travaDoCaso` aparece como fixture no tipo do `test` de todos os specs, embora seja interna | `TODO.md`, mesma seção (se o Playwright permitir um nome ou tipo à parte) |
| `revisor-geral` (2ª) | `esperarATela` (`profiles.ts`) e `esperarATelaDepoisDaRecarga` (`casca.ts`) têm nomes quase iguais e fazem coisas diferentes | `TODO.md`, mesma seção |
