# Correção — o `validarMapa` recusa o `de` de símbolo repetido mesmo quando os dois `arquivo` caem em pacotes diferentes

**Origem:** divergência da 8.0 de `nomes-de-mercado` (triagem do Arquiteto, 31/10), com a regra em `ec5f9541` (`spec/nomes-de-mercado`: Tech Spec §5 e `casos.md`, "Recusas").
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`
<!-- Os guardiões vieram no PEDIDO do Orquestrador. `revisor-geral` também porque a correção toca `tools/` com o `aplicar` de uma onda do rename. -->

## Sintoma

O mapa da 8.0 não passa no `aplicar`: `OpcoesDaMontagem` é declarado no worker e no despachante (`inventario-back.md:316` e `:321`), com destinos diferentes, e as duas entradas levam o mesmo `de`. O `validarMapa` as recusa com `de-repetido` (`o "OpcoesDaMontagem" aparece mais de uma vez no mapa`), embora cada uma tenha `arquivo` e os dois caiam em pacotes diferentes.

## Divergências resolvidas nesta tarefa

- Passo 5 com o `de` de símbolo repetido (ordem r1, item 1): a Tech Spec §5 (passo 5) e o `casos.md` ("Comentário e documento") passaram a mandá-lo à troca à mão em todo lugar. Triagem do Arquiteto no `539162fb` (`spec/nomes-de-mercado`), trazido por `git merge spec/nomes-de-mercado`.

## Fora desta correção

Nada. Árvore limpa na L3.

## Causa

Duas coisas, ambas por tratar o `de` como chave única do mapa. (1) `validarMapa` (`tools/renomear/mapa.ts`) guardava os `de` já vistos num `Set` e recusava o segundo, sem olhar o tipo nem o `arquivo`; a Tech Spec §5 passou a dizer que, no símbolo, o `de` repetido é o mesmo `de` no mesmo pacote, e o `aplicar` já acha a declaração pelo `arquivo` e o `conferir` já segue cada entrada só no pacote dela. (2) A recusa não era o único travamento: o passo 5 (`aplicarPasso5`, `tools/renomear/texto.ts`) montava um `Map` pelo `de` e, com duas entradas de mesmo `de`, a última apagava a primeira, então todo comentário de código e todo documento vivo que citava o homônimo recebia o `para` da última entrada, em qualquer pacote (a revisão mostrou `// as \`Opcoes\` do api` saindo como `WebOptions`), sem recusa do `aplicar`, do `conferir` nem do `restos`.

## Teste que reproduz

`tools/renomear/aplicar.test.ts`, em "as seis recusas, e a árvore sai igual › o de de símbolo repetido":
- verde com a correção, vermelho antes: `os dois arquivo em pacotes diferentes: cada declaração sai com o para da sua entrada, e quem a importa também` (antes da correção, `de-repetido`; o homônimo de `apps/api/src/outro.ts` fica como está);
- vermelho antes, verde depois (o passo 5, `texto.ts`): `o de repetido em comentário e em documento: nenhum para é escolhido, os três vão para a troca à mão, e o símbolo de entrada única troca` (o `Opcoes`, que é comum, entre crases e em `{@link}`) e `o de repetido composto (o OpcoesDaMontagem da 8.0), solto na prosa de um comentário e de um documento: fica, e vai para a troca à mão` (o composto, solto);
- `tools/renomear/conferir.test.ts`, em "o nome exportado segue a entrada só no pacote do arquivo dela…": `as duas entradas de mesmo de, uma por pacote (o mapa da 8.0): cada declaração é esperada com o para da sua entrada, nas duas ordens` (verde antes e depois: o `conferir` já seguia cada entrada no pacote dela, e o caso o prende, com as quatro divergências esperadas quando os `para` trocam de pacote);
- vermelho, e verde antes e depois (prendem os limites da regra): `uma das entradas sem arquivo (vale em todo pacote): recusa, nas duas ordens`, `os dois arquivo no mesmo pacote: recusa, mesmo com destinos diferentes` e `o mesmo de em tipos diferentes (símbolo e arquivo): recusa`.

## Correção

Em `mapa.ts`, `validarMapa` guarda as entradas vistas por `de` e recusa a nova só se `seRepetem` com alguma delas: repete quando uma das duas não é símbolo, quando uma não tem `arquivo`, ou quando os dois `arquivo` caem no mesmo pacote. `pacoteDoArquivo` passa de `conferir.ts` para `mapa.ts` (exportado) e o `conferir` o importa de lá: é a mesma definição de pacote nos dois lados. O `de` único e o `de` repetido sem `arquivo` seguem como antes (uma recusa por entrada repetida).

No passo 5, `aplicarPasso5` monta `repetidos` (os `de` de símbolo com mais de uma entrada) e o passa ao `trocarTrecho` (4º parâmetro, padrão vazio): o token que está em `repetidos` não se troca, nem composto, nem entre crases, nem em `{@link}`, e vai para a `aMao` do relatório, em comentário e em documento (Tech Spec §5, `539162fb`). O `restos` continua chamando o `trocarTrecho` sem `repetidos`: ele ainda cobra o nome antigo, e a troca à mão registrada o libera. O teste novo põe um comentário com o `Opcoes` nos dois pacotes e um `docs/x.md`, com um símbolo de entrada única no mesmo comentário, que troca. Os itens 3 a 5 da ordem são de teste: o import de um pacote no outro (`aplicar.test.ts`), o `conferir` com as duas entradas homônimas nas duas ordens (`conferir.test.ts`) e o comentário do campo `arquivo` da entrada de tipo `arquivo`.

## Sem aplicar

- Item 2 da ordem (`indiceDe` em `referencias.ts` e `simbolosDe` em `restos.ts` montam o `Map` pelo `de`): ali só o `de` e o `comum` são lidos, e o `comum` sai do `de` (`ehComum`, `mapa.ts`). Duas entradas com o mesmo `de` têm o mesmo `comum`, então não importa qual delas o `Map` guarda (triagem do Arquiteto).
- `paraONomeExportado` com `find` (linha "Sem aplicar" da Mesa): fica fora, vai para a retro de nomes-de-mercado. O motivo só vale enquanto o `conferir` continuar procurando cada entrada no pacote dela (condição apontada pelo revisor-geral).
- `conferir.test.ts` (caso trocado das duas entradas): comentário dizendo que a ordem de `esperadas` é a ordem ordenada que `dos` devolve (test-engineer, 3ª). Recusada pela Mesa: é só comentário em teste, aplicá-la caducaria as duas aprovações por um ciclo inteiro, e a asserção já é exata e independe da ordem das entradas (revisor-geral, 3ª).
- O `filter` dentro de `filter` (`texto.ts`) segue recusado, como na ordem r2. Quando escolhe a entrada errada, o `conferir` espera um `para` diferente do que o `aplicar` gravou: o resultado é o `conferir` vermelho, nunca verde.

## Mutações

```mutacao
arquivo: tools/renomear/mapa.ts
teste: tools/renomear/aplicar.test.ts › os dois arquivo em pacotes diferentes
-  return pacoteDoArquivo(a.arquivo) === pacoteDoArquivo(b.arquivo)
+  return true
```

```mutacao
arquivo: tools/renomear/mapa.ts
teste: tools/renomear/aplicar.test.ts › uma das entradas sem arquivo
-  if (a.tipo !== 'simbolo' || b.tipo !== 'simbolo' || a.arquivo === undefined || b.arquivo === undefined) return true
+  if (a.tipo !== 'simbolo' || b.tipo !== 'simbolo') return true
+  if (a.arquivo === undefined || b.arquivo === undefined) return false
```

```mutacao
arquivo: tools/renomear/mapa.ts
teste: tools/renomear/aplicar.test.ts › os dois arquivo no mesmo pacote
-  return pacoteDoArquivo(a.arquivo) === pacoteDoArquivo(b.arquivo)
+  return a.arquivo === b.arquivo
```

```mutacao
arquivo: tools/renomear/mapa.ts
teste: tools/renomear/aplicar.test.ts › o mesmo de em tipos diferentes
-  if (a.tipo !== 'simbolo' || b.tipo !== 'simbolo' || a.arquivo === undefined || b.arquivo === undefined) return true
+  if (a.arquivo === undefined || b.arquivo === undefined) return true
```

```mutacao
arquivo: tools/renomear/mapa.ts
teste: tools/renomear/aplicar.test.ts › o de se repete
-    if (doMesmoDe.some((vista) => seRepetem(vista, entrada))) recusas.push({ codigo: 'de-repetido', detalhe: `o "${entrada.de}" aparece mais de uma vez no mapa` })
+    if (doMesmoDe.some((vista) => !seRepetem(vista, entrada))) recusas.push({ codigo: 'de-repetido', detalhe: `o "${entrada.de}" aparece mais de uma vez no mapa` })
```

```mutacao
arquivo: tools/renomear/mapa.ts
teste: tools/renomear/aplicar.test.ts › os dois arquivo em pacotes diferentes
-    const doMesmoDe = vistos.get(entrada.de) ?? []
+    const doMesmoDe = vistos.get(entrada.de) ?? [entrada]
```

```mutacao
arquivo: tools/renomear/texto.ts
teste: tools/renomear/aplicar.test.ts › o de repetido em comentário e em documento
-    if (repetidos.has(entrada.de)) {
+    if (repetidos.has(entrada.de) && entrada.de === '') {
```

```mutacao
arquivo: tools/renomear/texto.ts
teste: tools/renomear/aplicar.test.ts › o de repetido composto
-    if (repetidos.has(entrada.de)) {
+    if (repetidos.has(entrada.de) && entrada.comum) {
```

```mutacao
arquivo: tools/renomear/texto.ts
teste: tools/renomear/aplicar.test.ts › o de repetido em comentário e em documento
-    const resultado = trocarTrecho(texto.slice(inicio, fim), entradas, simbolos, repetidos)
+    const resultado = trocarTrecho(texto.slice(inicio, fim), entradas, simbolos)
```

```mutacao
arquivo: tools/renomear/texto.ts
teste: tools/renomear/aplicar.test.ts › o de repetido em comentário e em documento
-  const resultado = trocarTrecho(texto, entradas, simbolos, repetidos)
+  const resultado = trocarTrecho(texto, entradas, simbolos)
```

```mutacao
arquivo: tools/renomear/texto.ts
teste: tools/renomear/aplicar.test.ts › o de repetido em comentário e em documento
-  const repetidos = new Set(doSimbolo.filter((entrada) => doSimbolo.filter((outra) => outra.de === entrada.de).length > 1).map((entrada) => entrada.de))
+  const repetidos = new Set(doSimbolo.filter((entrada) => doSimbolo.filter((outra) => outra.de === entrada.de).length > 0).map((entrada) => entrada.de))
```

```mutacao
arquivo: tools/renomear/mapa.ts
teste: tools/renomear/aplicar.test.ts › os dois arquivo em pacotes diferentes
-  return partes.slice(0, partes[0] === 'apps' || partes[0] === 'packages' ? 2 : 1).join('/')
+  return partes.slice(0, 1).join('/')
```

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-31 12:05:18 | 2026-10-31 12:06:27 | `revisor-geral` | 1 | REPROVADO | ae7a351beb3c8df9f |
| 2026-10-31 12:05:17 | 2026-10-31 12:06:36 | `test-engineer` | 1 | APROVADO | a62574def5ac9e9b0 |
| 2026-10-31 13:32:08 | 2026-10-31 13:32:42 | `revisor-geral` | 2 | APROVADO | aa2d43916fb525797 |
| 2026-10-31 13:32:02 | 2026-10-31 13:32:59 | `test-engineer` | 2 | REPROVADO | a76b605ed2294a7d0 |
| 2026-10-31 13:38:58 | 2026-10-31 13:39:15 | `revisor-geral` | 3 | APROVADO | afbe5fb57f5e95a0e |
| 2026-10-31 13:38:54 | 2026-10-31 13:39:25 | `test-engineer` | 3 | APROVADO | a8dacacbbcfde77d3 |
