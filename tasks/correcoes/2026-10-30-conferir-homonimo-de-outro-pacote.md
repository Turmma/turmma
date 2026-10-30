# Correção — o `conferir` troca o nome exportado em todo pacote e reprova o homônimo de outro pacote

**Origem:** divergência da 4.0 de `nomes-de-mercado` (Orquestrador, `divergencia-4b.md`), com a regra do Arquiteto em `3d402a86` (`spec/nomes-de-mercado`: Tech Spec §5, "O `conferir`", e `casos.md`, `conferir`).
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`
<!-- Os guardiões vieram no PEDIDO do Orquestrador. `revisor-geral` também porque a correção toca `tools/` com o `conferir` de uma onda do rename. -->

## Sintoma

O `conferir` da 4.0 sai VERMELHO com seis diferenças, todas de "nome exportado": `DependenciasDoExecutor` (a interface de `apps/worker/src/executor.ts`), `LinhaNova` e `migrar` (de `tools/processo/mutacoes.ts` e `tools/processo/separar-achados.ts`). São homônimos de outro pacote dos símbolos do core que a onda renomeou (`AgenteExecutorDependencies`, `NewJobRow`, `migrate`); o `aplicar`, por símbolo, corretamente não os tocou.

## Fora desta correção

Os 660 arquivos de `/tmp/claude-1000/-home-joaquimdp-Documents-git-Educa-ia/e0057fba-49de-45c4-ac79-a3267803817a/scratchpad/arquivos-da-4.0-em-curso.txt`: o trabalho da 4.0 (mais `tasks/prd-nomes-de-mercado/travas.md`, sujo, e `tools/renomear/mapas/4.json` e `4.relatorio.md`). Ficam na árvore, não entram na revisão nem no commit desta correção.

## Causa

`aplicarMapaAFoto` (`tools/renomear/conferir.ts`) troca o nome exportado da foto de antes por `simbolos.get(item.valor)`: um mapa `de → para` que não olha o pacote nem o `arquivo` da entrada. Todo exportado com o `de` de uma entrada é trocado em qualquer pacote, mas o `aplicar` renomeia por símbolo (a declaração do `arquivo`). O homônimo de outro pacote fica com o nome antigo na árvore e com o novo na foto de antes: duas diferenças por homônimo.

## Teste que reproduz

Todos em `tools/renomear/conferir.test.ts`. O vermelho antes da correção, em "conferir: vermelho quando":
- `o homônimo exportado por outro pacote sai com o nome novo da entrada`.

Os verdes, em "conferir: verde quando › o nome exportado segue a entrada só no pacote do arquivo dela e em quem reexporta dele":
- `o homônimo exportado por outro pacote fica com o nome antigo`;
- `quem reexporta do pacote da entrada passa ao nome novo, e quem reexporta o homônimo fica`;
- `o export { X } do que o arquivo importou do pacote da entrada também passa ao nome novo, e o do homônimo fica`;
- `o caminho relativo e o subcaminho do pacote, vindos de fora dele, também seguem a entrada`;
- `o namespace reexportado e o nome com alias: o nome comparado é o exportado`;
- `a entrada num pacote sem package.json no HEAD só vale na pasta: o reexport pelo nome do pacote não a segue`;
- `a entrada sem arquivo vale em todo pacote`.

## Correção

O `foto.ts` passa a guardar, no nome exportado, a `origem`: o especificador do `export … from`, ou o do `import` do nome que um `export { X }` repassa. O `conferir.ts` troca o nome exportado pela entrada `simbolo` só quando (a) a entrada não tem `arquivo`, ou (b) o arquivo do item está no pacote do `arquivo` da entrada, ou (c) a `origem` do item é esse pacote (pelo nome do `package.json` do `HEAD`, ou por caminho relativo que entra na pasta). O homônimo de outro pacote fica com o nome, como o `aplicar` o deixa. Com o mapa `4.json`, o `conferir` real passa de vermelho (os 3 homônimos) a verde: ficaram à vista as reexportações `export { ConfiguracaoInvalida }` dos `config.ts` dos apps e a fixture de `tools/guardas`, que importam o símbolo do core e o repassam, e a (c) as cobre.

## Mutações

Blocos para as cláusulas novas do `conferir.ts` e do `foto.ts` (a escolha do pacote, a reexportação com `from`, a relativa, o subcaminho, a entrada sem `arquivo`, o `export { X }` de um `import` e o `export * as`). O portão os prova. O homônimo reexportado fica num pacote diferente do reexportador da entrada: a foto conta o nome exportado por pacote, e dois reexports trocados dentro do mesmo pacote dariam o mesmo conjunto (a terceira mutação ficou verde assim, na primeira passada).

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › o homônimo exportado por outro pacote fica com o nome antigo
-    return pacoteDoArquivo(item.arquivo) === pasta || reexportaDoPacote(item.origem, pasta, nomes)
+    return true
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › quem reexporta do pacote da entrada passa ao nome novo
-    return pacoteDoArquivo(item.arquivo) === pasta || reexportaDoPacote(item.origem, pasta, nomes)
+    return pacoteDoArquivo(item.arquivo) === pasta
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › quem reexporta do pacote da entrada passa ao nome novo
-  return nomes.get(pasta) === nomeDoPacoteDe(alvo)
+  return nomes.get(pasta) !== nomeDoPacoteDe(alvo)
```

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › o export { X } do que o arquivo importou do pacote da entrada também passa ao nome novo
-    const origem = origemDaDeclaracao ?? importados.get((elemento.propertyName ?? elemento.name).text)
+    const origem = origemDaDeclaracao
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › o caminho relativo e o subcaminho do pacote, vindos de fora dele, também seguem a entrada
-  if (tipo === 'relativo') return alvo.startsWith(`${pasta}/`)
+  if (tipo === 'relativo') return false
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › a entrada sem arquivo vale em todo pacote
-    if (candidata.arquivo === undefined) return true
+    if (candidata.arquivo === undefined) return false
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › o caminho relativo e o subcaminho do pacote, vindos de fora dele, também seguem a entrada
-const nomeDoPacoteDe = (especificador: string): string => especificador.split('/').slice(0, especificador.startsWith('@') ? 2 : 1).join('/')
+const nomeDoPacoteDe = (especificador: string): string => especificador
```

```mutacao
arquivo: tools/renomear/foto.ts
teste: tools/renomear/conferir.test.ts › o namespace reexportado e o nome com alias: o nome comparado é o exportado
-  if (ts.isNamespaceExport(clausula)) return [{ nome: clausula.name.text, ...(origemDaDeclaracao === undefined ? {} : { origem: origemDaDeclaracao }) }]
+  if (ts.isNamespaceExport(clausula)) return [{ nome: clausula.name.text }]
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › o homônimo exportado por outro pacote fica com o nome antigo
-  if (origem === undefined) return false
+  if (origem === undefined) return true
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › a entrada sem arquivo vale em todo pacote
-    if (candidata.tipo !== 'simbolo' || candidata.de !== item.valor) return false
+    if (candidata.tipo !== 'simbolo') return false
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › o homônimo exportado por outro pacote fica com o nome antigo
-    if (item.categoria === 'exportado') return { ...item, arquivo, valor: paraONomeExportado(item, mapa.entradas, nomesDosPacotes) }
+    if (item.categoria === 'caso') return { ...item, arquivo, valor: paraONomeExportado(item, mapa.entradas, nomesDosPacotes) }
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › o homônimo exportado por outro pacote fica com o nome antigo
-  return entrada?.para ?? item.valor
+  return entrada?.para ?? 'sem-entrada'
```

Doze blocos ao todo. O `--faltando` ainda lista linhas sem bloco, e cada uma fica assim por um motivo:

- `conferir.ts:127` (`entrada.tipo !== 'simbolo' || entrada.arquivo === undefined`): a entrada sem `arquivo` não tem pasta para olhar; o caso `a entrada sem arquivo vale em todo pacote` a atravessa, e sem a segunda metade o `pacoteDoArquivo` receberia `undefined`.
- `conferir.ts:129` (`if (nomes.has(pasta)) continue`): só evita ler o mesmo `package.json` duas vezes; o resultado é o mesmo sem a linha, então não há teste que falhe.
- `conferir.ts:132` (`typeof nome === 'string'`): defesa para um `package.json` sem `name`, que leva ao mesmo lugar que o `catch` (só a pasta vale), provado em `a entrada num pacote sem package.json no HEAD só vale na pasta`.
- `foto.ts:77`, `79`, `81`, `83`, `84` (os ramos do `import`: efeito colateral, por padrão, `* as`): nenhuma entrada de símbolo nomeia um `export default` (a foto o chama `default`), então o binding por padrão ou por namespace nunca é a origem de um nome que a onda renomeie; as linhas só impedem que `import 'x'` e `import * as` lancem.
- `foto.ts:93`, `98`, `135` (o espalhamento opcional da `origem`): provados pelas mutações do `export { X } do que o arquivo importou…` e do `export * as`.
- `foto.ts:104`, `105`, `107`, `108`, `110` e a assinatura de `nomesExportados`: o código antigo, só com o objeto `{ nome }` em volta; os casos `a exportação por padrão e por desestruturação` e `a classe exportada por padrão` já os cobriam e seguem verdes.

## Recomendações sem aplicar

Rodada 2 (`.processo/ordens/2026-10-30-conferir-homonimo-de-outro-pacote-r2.md`); a rodada 1 está em `tasks/correcoes/achados/2026-10-30-conferir-homonimo-de-outro-pacote.md`.

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral 2ª (1) | `export * as X from` grava como verde que o namespace `Banco` passe a `Database`, e o `aplicar`, que renomeia por símbolo, não o tocaria; vale constar como limite (5) no comentário do topo, ou tirar a `origem` do ramo | Limite a registrar em `casos.md` da `spec/nomes-de-mercado` (Arquiteto, mesma entrada do limite da 1ª rodada). Caso improvável; o `conferir` real do `4.json` fica verde |
| revisor-geral 2ª (2) | Os blocos das linhas 50 e 64 do documento citam o caso pelo começo do título | Recusada: o portão aceitou os blocos e o documento fecha no commit desta correção; nenhum caso novo com o mesmo começo existe |
| revisor-geral 2ª (3) | A lista do `--faltando` cita linhas por número, que envelhecem | Recusada: o texto descreve a árvore de agora, nesta correção; a próxima edição de `conferir.ts` cria outro documento |
| test-engineer 2ª (1) | O bloco da linha do `arquivo === undefined` fica vermelho por TypeError, não pela divergência que a asserção espera | Recusada: foi o bloco exigido na 1ª rodada, o portão o aceita e a asserção do caso cobre a regra (`packages/outro` também passa a `Database`) |
| test-engineer 2ª (2) | Escrever bloco para a `conferir.ts:127`, que o caso `a entrada sem arquivo vale em todo pacote` atravessa, em vez de justificar a ausência | Recusada: a justificativa escrita no documento cumpre o que a regra 40, item 7, pede para a linha que fica sem bloco |
| test-engineer 2ª (3) | A justificativa da `conferir.ts:132` cita como prova um caso que passa pelo `catch`, não por `typeof nome === 'string'` | Recusada: é a redação de uma justificativa do documento, sem efeito no código nem no portão; a linha fica sem teste e a tabela acima já a diz |
| test-engineer 2ª (4) | Justificativa torta das `foto.ts:81` e `84`: `import Banco from '@educa/shared'; export { Banco }` troca o nome na foto e o `aplicar` não; entraria como limite (5) | Limite a registrar em `casos.md` da `spec/nomes-de-mercado` (Arquiteto); erra para o vermelho, nunca para o verde |
| test-engineer 2ª (5) | As justificativas das `foto.ts:93`, `98` e `135` citam mutações que estão nas linhas 94 e 97; as linhas são cobertas pelos casos, não por bloco | Recusada, pelo mesmo motivo da (3): as linhas estão cobertas pelos casos, e o que muda é só a palavra no documento |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-30 21:30:09 | 2026-10-30 21:30:58 | `revisor-geral` | 2 | APROVADO | a522c0226e48eef02 |
| 2026-10-30 21:30:04 | 2026-10-30 21:31:50 | `test-engineer` | 2 | APROVADO | a6bd6aa815b54c562 |
