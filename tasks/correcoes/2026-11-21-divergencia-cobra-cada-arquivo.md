# Correção — o aviso de divergência cobra "um dos dois mudou" em vez de cada arquivo citado na coluna "Onde está na spec"

**Origem:** retro da F4b (`tasks/prd-classificacao-bncc/retro.md`), M1, entrada do `TODO.md` "(F4b, retro, M1)".
**Subagentes obrigatórios:** `revisor-geral`, `test-engineer`, `privacy-guardian`
<!-- O PEDIDO do Orquestrador ditou os dois primeiros; o `privacy-guardian` vem da conta do portão (`portao-local.ts revisores`, por caminho alterado: `tools/processo/guardioes-por-caminho.ts`). -->

## Sintoma

Na F4b, cinco reprovações do `revisor-geral` em quatro tarefas (e uma escalada) vieram de divergência que entrou no `techspec.md` mas não no
`cenarios.md` (ou o contrário), ou que citava `cenarios.md:140` com o diff em outro trecho. O aviso do portão (`tools/processo/divergencias.ts`)
calou nesses casos: ele só olha se **um dos dois** arquivos da spec mudou.

## Fora desta correção

nada

## Causa

`avisoDeDivergencia` cala quando `techspec.md` **ou** `cenarios.md` está entre os alterados (`arquivosDaSpec.some(...)`), sem ler a coluna "Onde está na
spec" da linha nova: não sabe qual arquivo a linha cita, e a linha que cita os dois fica quite com um só. O `arquivo:linha` citado também não é
lido. E o aviso só sai no portão da tarefa, não em `portao-local.ts revisores`, que é o que a Mesa lê antes de chamar revisor.

## Teste que reproduz

`tools/processo/divergencias.test.ts`: `citacoesDaLinha` (a última célula da linha, cada `.md` citado, com a linha ou o intervalo), `avisoDeDivergencia`
(a linha que cita os dois com só um mudado; a que cita `cenarios.md:140` com o diff em outro trecho) e `avisoDaDivergenciaSoNoDocumento` com o `git diff`
de verdade. Vermelho antes: com os testes escritos e o código ainda antigo, 16 dos 37 casos do arquivo caíram (`citacoesDaLinha` não existia, e a linha que cita `techspec.md` e `cenarios.md` com só um alterado dava `null`); verde depois (44 casos).

## Correção

`tools/processo/divergencias.ts` passou a ler a coluna "Onde está na spec" (a última célula da linha de tabela): `citacoesDaLinha` tira dela cada `.md` citado
(`techspec.md` e `cenarios.md` na pasta do documento; o que tem caminho, como `docs/runbook.md`, na raiz do repositório) com a linha ou o intervalo (`arquivo:140`,
`arquivo:140-150`). Não é citação o nome que começa no meio de outro: URL (`https://host/x/a.md`), caminho absoluto (`/home/u/a.md`), `foo//x.md`, placeholder (`<spec>/cenarios.md`) e glob (`prd-*/techspec.md`) são ignorados (o lookbehind de `CITACAO_DE_MD`), e `cenarios.mdx` e `x.md5` também (o lookahead). `avisoDeDivergencia` cobra **cada** um: arquivo que não mudou é "falta mudar", e o citado com linha, que mudou mas cujo diff não a toca
(`trechoTocadoNoDiff`, `git diff -U0` contra o HEAD, só o lado novo; remoção pura não conta; arquivo fora do HEAD vale inteiro), é "o arquivo mudou, mas não nessa
linha". O aviso passou a listar, por linha pendente, o que falta. A linha sem coluna (texto corrido) ou que não cita nenhum `.md` cai no critério antigo (um dos
dois). `portao-local.ts revisores` imprime o mesmo aviso, depois das linhas dos revisores e sem mudar o código de saída, e o `revisar-tarefa`, passo 1.3, manda
`DEVOLUÇÃO` com a linha e o arquivo, sem chamar revisor. O aviso começa por `Atenção:` (e não por `Aviso:`, palavra que a guarda de nomes `restos.test.ts` recusa em documento vivo, e que o `revisar-tarefa` precisa citar). Os dois casos do sintoma, e o `techspec.md` citado com o `cenarios.md` mudado (que o critério antigo
calava), são casos do teste; os testes que codificavam "um dos dois cala" foram reescritos para o critério novo.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian (1ª) | `divergencias.ts:661-662`: normalizar o caminho do `.md` da última célula e recusar o que sai da raiz (`../x.md`) | `TODO.md`: muda comportamento (recusa citação), e o revisor mesmo diz que não vaza nada (leitura local, saída booleana). O Implementador acrescenta a linha (o `TODO.md` já está na árvore desta correção) |
| test-engineer (1ª) | caso que rode `portao-local.ts revisores` num repositório temporário, no lugar da prova textual do fonte | `TODO.md`: o caso existente segue o padrão do que já havia para o portão, e o revisor aprovou. O Implementador acrescenta a linha |
| revisor-geral (1ª) | em `trechoTocadoNoDiff`, guardar por arquivo o `existeNoHead` e o `git diff` | Recusada: a linha cita poucos arquivos, o resultado não muda, e o cache acrescenta estado e cláusula nova a provar por mutação, sem ganho que se meça |
| revisor-geral (1ª) | a `DEVOLUÇÃO` obrigatória pode parar a rodada à toa quando a seção da `techspec.md` já foi atualizada antes da tarefa e não aparece no diff contra o HEAD | Acompanhar na retro da próxima spec que passar por aqui; o revisor rodou `citacoesDaLinha` nas tarefas da F4b e a leitura saiu correta. Sem mudança agora |
| revisor-geral (1ª) | `.md` sem caminho que não é da spec (`prd.md`, `glossario.md`) passa sem cobrança | Recusada: é o comportamento documentado na seção "Correção" do documento e prendido pelo caso "o .md sem caminho que não é da spec não são cobrados"; o próprio revisor a deu como registro |
| revisor-geral (3ª), privacy-guardian (3ª), test-engineer (3ª) | Seção "Correção" do documento: a frase das exclusões (URL, caminho absoluto, `foo//x.md`, placeholder, glob, `cenarios.mdx`, `x.md5`) entrou no meio de "com a linha ou o intervalo (`arquivo:140`, …", e parece falar do lookahead. Mover a frase para depois de "`arquivo:140-150`)." | Aplicada ao copiar a tabela, com Edit: só texto do documento da tarefa, que não caduca nenhuma rodada |
| test-engineer (3ª) | O bloco de mutação só prova o `/` do lookbehind; `\w`, `.` e `-` não mudam nenhum resultado (a varredura da esquerda já começa no começo do nome). Registrar no comentário que são só defesa, ou tirá-los | Recusada: mexer em `divergencias.ts` caducaria os três revisores por uma defesa que não muda resultado, e o comentário atual já diz o que o lookbehind faz |
| test-engineer (3ª) | O caminho absoluto ignorado repõe o falso negativo `/docs/runbook.md`, que a 2ª rodada registrou | Acompanhar na retro da F5, se aparecer citação da spec com barra no começo. Está dito em "Correção" e era o que o caminho (a) aceitava; sem mudança agora |

## Mutações

--faltando: 0 linhas (40 blocos, 0 motivos)

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › URL, caminho absoluto
-const CITACAO_DE_MD = /(?<![\w./-])((?:[\w.-]+\/)*[\w.-]+\.md)(?![\w])(?::(\d+)(?:-(\d+))?)?/g
+const CITACAO_DE_MD = /((?:[\w.-]+\/)*[\w.-]+\.md)(?![\w])(?::(\d+)(?:-(\d+))?)?/g
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › o .md com letra ou número colado depois
-const CITACAO_DE_MD = /(?<![\w./-])((?:[\w.-]+\/)*[\w.-]+\.md)(?![\w])(?::(\d+)(?:-(\d+))?)?/g
+const CITACAO_DE_MD = /(?<![\w./-])((?:[\w.-]+\/)*[\w.-]+\.md)(?::(\d+)(?:-(\d+))?)?/g
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › ou sem nada citado na última célula, não há citação: vale o "um dos dois"
-  if (!linha.startsWith('|')) return null
+  if (false) return null
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › a linha citada, e o intervalo, ficam na citação
-const CITACAO_DE_MD = /(?<![\w./-])((?:[\w.-]+\/)*[\w.-]+\.md)(?![\w])(?::(\d+)(?:-(\d+))?)?/g
+const CITACAO_DE_MD = /(?<![\w./-])((?:[\w.-]+\/)*[\w.-]+\.md)(?![\w])(?::(\d+))?/g
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › lê a última célula: cada .md citado, na pasta do documento
-  if (partes[partes.length - 1] === '') partes.pop()
+  if (partes[partes.length - 1] === 'x') partes.pop()
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › ou sem nada citado na última célula, não há citação: vale o "um dos dois"
-  if (partes === null || partes.length < 3) return null
+  if (partes.length < 3) return null
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › ou sem nada citado na última célula, não há citação: vale o "um dos dois"
-  if (partes === null || partes.length < 3) return null
+  if (partes === null || partes.length < 2) return null
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › o mesmo arquivo com duas linhas são duas citações; sem a linha, uma só
-    if (citacao !== null && !citacoes.some((outra) => referencia(outra) === referencia(citacao))) citacoes.push(citacao)
+    if (citacao !== null) citacoes.push(citacao)
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › e o .md sem caminho que não é da spec não são cobrados
-    if (citacao !== null && !citacoes.some((outra) => referencia(outra) === referencia(citacao))) citacoes.push(citacao)
+    if (!citacoes.some((outra) => referencia(outra) === referencia(citacao))) citacoes.push(citacao)
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › ou sem nada citado na última célula, não há citação: vale o "um dos dois"
-  return citacoes.length > 0 ? citacoes : null
+  return citacoes.length > 0
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › o ./ do começo do caminho sai
-  const caminho = (achado[1] ?? '').replace(/^\.\//, '')
+  const caminho = (achado[1] ?? '').replace(/^x\//, '')
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › lê a última célula: cada .md citado, na pasta do documento
-  if (!caminho.includes('/') && !daSpec) return null
+  if (!daSpec) return null
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › lê a última célula: cada .md citado, na pasta do documento
-  if (!caminho.includes('/') && !daSpec) return null
+  if (!caminho.includes('/')) return null
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › lê a última célula: cada .md citado, na pasta do documento
-  const arquivo = daSpec ? posix.join(posix.dirname(documento), caminho) : caminho
+  const arquivo = posix.join(posix.dirname(documento), caminho)
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › lê a última célula: cada .md citado, na pasta do documento
-  if (achado[2] === undefined) return { arquivo }
+  if (false) return { arquivo }
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › a linha citada, e o intervalo, ficam na citação
-  return { arquivo, de, ate: achado[3] === undefined ? de : Number(achado[3]) }
+  return { arquivo, de, ate: Number(achado[3]) }
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › a linha em texto corrido entra no aviso sem o marcador da lista e sem o negrito
-  const texto = (celulas(linha)?.[0] ?? linha).replace(/^[-*]\s+/, '').replaceAll('**', '')
+  const texto = (celulas(linha)?.[0] ?? linha).replaceAll('**', '')
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › a linha em texto corrido entra no aviso sem o marcador da lista e sem o negrito
-  const texto = (celulas(linha)?.[0] ?? linha).replace(/^[-*]\s+/, '').replaceAll('**', '')
+  const texto = (celulas(linha)?.[0] ?? linha).replace(/^[-*]\s+/, '')
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › a linha em texto corrido entra no aviso sem o marcador da lista e sem o negrito
-  const texto = (celulas(linha)?.[0] ?? linha).replace(/^[-*]\s+/, '').replaceAll('**', '')
+  const texto = (celulas(linha)?.[0] ?? '').replace(/^[-*]\s+/, '').replaceAll('**', '')
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › com linha nova e a spec parada, avisa e diz o documento, a quantidade e o arquivo que falta
falha: expect(aviso).not.toContain('undefined')
-  if (citacao.de === undefined) return citacao.arquivo
+  if (false) return citacao.arquivo
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › linha em texto corrido, sem coluna: basta um dos dois
-  if (citacoes === null) {
+  if (false) {
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › com o diff em outro trecho avisa; com o diff nela, não
-    else if (citacao.de !== undefined && !tocou(citacao.arquivo, citacao.de, citacao.ate ?? citacao.de)) faltas.push(`${referencia(citacao)}: o arquivo mudou, mas não nessa linha`)
+    else if (citacao.de !== undefined && tocou(citacao.arquivo, citacao.de, citacao.ate ?? citacao.de)) faltas.push(`${referencia(citacao)}: o arquivo mudou, mas não nessa linha`)
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › sem linha nova, sem aviso
-  if (pendentes.length === 0) return null
+  if (false) return null
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › cita cenarios.md:3 e o diff está em outro trecho: avisa; o diff na linha 3 cala
-    if (existeNoHead(raiz, arquivo)) {
+    if (false) {
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › cita cenarios.md:3 e o diff está em outro trecho: avisa; o diff na linha 3 cala
-      for (const trecho of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
+      for (const trecho of diff.matchAll(/^@@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › cita cenarios.md:3 e o diff está em outro trecho: avisa; o diff na linha 3 cala
-        const quantas = trecho[2] === undefined ? 1 : Number(trecho[2])
+        const quantas = trecho[2] === undefined ? 0 : Number(trecho[2])
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › cita cenarios.md:3 e o diff está em outro trecho: avisa; o diff na linha 3 cala
-    return lidos === 'novo' || lidos.some(([inicio, fim]) => inicio <= ate && fim >= de)
+    return lidos === 'novo'
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › cita cenarios.md:3 e o diff está em outro trecho: avisa; o diff na linha 3 cala
-    return lidos === 'novo' || lidos.some(([inicio, fim]) => inicio <= ate && fim >= de)
+    return lidos === 'novo' || lidos.some(([inicio, fim]) => inicio <= ate)
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › cita cenarios.md:3 e o diff está em outro trecho: avisa; o diff na linha 3 cala
-    return lidos === 'novo' || lidos.some(([inicio, fim]) => inicio <= ate && fim >= de)
+    return lidos === 'novo' || lidos.some(([inicio, fim]) => fim >= de)
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › a linha que cita os dois, com só um mudado, avisa e diz qual falta
-    if (!alterados.includes(citacao.arquivo)) faltas.push(`falta mudar ${referencia(citacao)}`)
+    if (!alterados.includes(citacao.arquivo) && !citacoes.some((outra) => alterados.includes(outra.arquivo))) faltas.push(`falta mudar ${referencia(citacao)}`)
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › com o diff em outro trecho avisa; com o diff nela, não
-    else if (citacao.de !== undefined && !tocou(citacao.arquivo, citacao.de, citacao.ate ?? citacao.de)) faltas.push(`${referencia(citacao)}: o arquivo mudou, mas não nessa linha`)
+    else if (citacao.de === undefined && !tocou(citacao.arquivo, citacao.de, citacao.ate ?? citacao.de)) faltas.push(`${referencia(citacao)}: o arquivo mudou, mas não nessa linha`)
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › linha em texto corrido, sem coluna: basta um dos dois
-    return arquivosDaSpec.some((arquivo) => alterados.includes(arquivo)) ? [] : [`falta mudar ${arquivosDaSpec.join(' ou ')} (a linha não diz onde está na spec)`]
+    return arquivosDaSpec.every((arquivo) => alterados.includes(arquivo)) ? [] : [`falta mudar ${arquivosDaSpec.join(' ou ')} (a linha não diz onde está na spec)`]
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › só a última célula conta: o .md citado na divergência ou no motivo não é cobrado
-  for (const achado of (partes[partes.length - 1] ?? '').matchAll(CITACAO_DE_MD)) {
+  for (const achado of partes.join(' ').matchAll(CITACAO_DE_MD)) {
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › e o .md sem caminho que não é da spec não são cobrados
-  if (!caminho.includes('/') && !daSpec) return null
+  if (false) return null
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › a linha só removida dentro do intervalo citado não é trecho tocado
-        if (quantas > 0) lidos.push([inicio, inicio + quantas - 1])
+        lidos.push([inicio, inicio + quantas - 1])
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › cita cenarios.md:3 e o diff está em outro trecho: avisa; o diff na linha 3 cala
-    return lidos === 'novo' || lidos.some(([inicio, fim]) => inicio <= ate && fim >= de)
+    return lidos === 'novo' || lidos.some(([inicio, fim]) => inicio <= ate || fim >= de)
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › vale como tocado em qualquer linha citada
-    return lidos === 'novo' || lidos.some(([inicio, fim]) => inicio <= ate && fim >= de)
+    return lidos.some(([inicio, fim]) => inicio <= ate && fim >= de)
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › a divergência longa vai ao aviso cortada em 80 caracteres, com reticências
-  return texto.length > 80 ? `${texto.slice(0, 80)}…` : texto
+  return texto
```

```mutacao
arquivo: tools/processo/divergencias.ts
teste: tools/processo/divergencias.test.ts › o intervalo citado vai inteiro ao aviso
-  return citacao.ate === citacao.de ? `${citacao.arquivo}:${String(citacao.de)}` : `${citacao.arquivo}:${String(citacao.de)}-${String(citacao.ate)}`
+  return `${citacao.arquivo}:${String(citacao.de)}`
```

```mutacao
arquivo: tools/processo/portao-local.ts
teste: tools/processo/divergencias.test.ts › o subcomando revisores imprime o mesmo aviso, depois das linhas dos revisores, e não muda o código de saída
-  if (divergencia !== null) process.stdout.write(`\n${divergencia}`)
+  if (divergencia !== null && divergencia === '') process.stdout.write(`\n${divergencia}`)
```


## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-21 01:51:08 | 2026-11-21 01:51:31 | `privacy-guardian` | 1 | APROVADO | a1e78039676ce1b50 |
| 2026-11-21 01:51:06 | 2026-11-21 01:52:09 | `revisor-geral` | 1 | APROVADO | a945534c4485109cc |
| 2026-11-21 01:51:07 | 2026-11-21 01:52:16 | `test-engineer` | 1 | APROVADO | ae810042ef8444df1 |
| 2026-11-21 02:13:04 | 2026-11-21 02:13:41 | `privacy-guardian` | 2 | APROVADO | ae167e480fbbaaf3a |
| 2026-11-21 02:12:53 | 2026-11-21 02:13:41 | `revisor-geral` | 2 | REPROVADO | aa9612e54684fc354 |
| 2026-11-21 02:12:58 | 2026-11-21 02:15:14 | `test-engineer` | 2 | REPROVADO | a3c71015296bd9328 |
| 2026-11-21 02:28:02 | 2026-11-21 02:28:28 | `revisor-geral` | 3 | APROVADO | a94d0b0e9b404535a |
| 2026-11-21 02:28:12 | 2026-11-21 02:28:39 | `privacy-guardian` | 3 | APROVADO | acf09757075e94b2a |
| 2026-11-21 02:28:09 | 2026-11-21 02:28:56 | `test-engineer` | 3 | APROVADO | a3c144859266b0c24 |
