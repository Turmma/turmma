# Correção — o `restos` e o `novas` do `reaplicar` comparam o `fica` e a troca à mão pelo caminho antigo, e 28 restos da 5.0 sobram em arquivos que ela moveu

**Origem:** tarefa 5.0 (X8 `nomes-de-mercado`), `DIVERGÊNCIA` da 5.0 triada pelo Arquiteto (`triagem-divergencia-5.md`, escolha (b)).
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `privacy-guardian`
<!-- O PEDIDO do Orquestrador dizia: nenhum além de test-engineer e revisor-geral. A Mesa 2 acrescentou o `privacy-guardian`: o docblock de `tools/renomear/restos.ts` (linha 24) cita a regra 20, e a citação soma o guardião (`guardioes-por-caminho.ts`). -->

## Sintoma

Com a 5.0 aplicada, `node tools/renomear/restos.ts` lista 28 restos em arquivos que a própria 5.0 moveu, e cada um tem um `fica` (ou uma
troca à mão registrada) no mapa de uma onda anterior. O `fica` guarda o `arquivo` como a árvore o tinha logo depois da onda que o
classificou (mapas 3 e 4); a 5.0 moveu o arquivo, a árvore tem o caminho novo, e a comparação por caminho já não casa. O mesmo vale para a
linha da tabela "Troca à mão" do relatório e para a lista `novas` do `reaplicar`, que usa o mesmo `estaClassificada`.

## Fora desta correção

`M tasks/prd-nomes-de-mercado/techspec.md`, `M tasks/prd-nomes-de-mercado/travas.md`, `?? tools/renomear/mapas/5.json` e
`?? tools/renomear/mapas/5.relatorio.md` são da 5.0, que corre na linha 1; esta linha nasceu de `d60a9c3f` e não os tem. A frase da Tech Spec §5 que
esta correção cumpre está na triagem do Arquiteto e vai no commit da 5.0.

## Causa

Defeito da 2.0, não regra nova: a Tech Spec §5 já libera "o `fica` … a troca à mão registrada", e o `casos.md` (`restos`, Verde) tem
"o `fica`". O que faltou dizer, e o código não fazia, é que a liberação continua valendo depois que uma onda **posterior** move o
arquivo. O `restos` comparava o caminho registrado (`OcorrenciaClassificada.arquivo`, a chave `arquivo\0nome` da troca à mão) com o
caminho de hoje, sem levar o registrado pelos movimentos `arquivo` e `pasta` das ondas seguintes.

A escolha (a), reescrever o mapa e o relatório de onda feita, ficou descartada pelo Arquiteto: eles são o registro do que a onda decidiu, o
trabalho manual se repete a cada onda que move (132 `fica` agora, e de novo na 6.0), e não cobre a troca à mão nem o `novas`.

## Teste que reproduz

`tools/renomear/restos.test.ts` › `restos: o arquivo que uma onda seguinte moveu` (dez casos) e `tools/renomear/reaplicar.test.ts` ›
`o fica de uma onda num arquivo que uma onda seguinte moveu não é referência nova, e o arquivo que chegou ao caminho antigo é`.

Verdes que a correção acrescenta: o `fica` num arquivo movido por arquivo; num arquivo dentro de pasta movida; o `fica` que é a própria
pasta; duas ondas que movem o mesmo arquivo (a→b→c); a troca à mão registrada num arquivo movido. Vermelhos que provam o limite: o `fica`
(e a troca à mão) da onda N não libera o arquivo que **chegou** ao caminho antigo depois do move; o move da própria onda N não leva o `fica` dela;
o move de uma onda anterior não leva o `fica` de uma onda seguinte.

Vermelho antes (com `mapa.ts`, `restos.ts` e `reaplicar.ts` do HEAD): seis casos do `restos` falham (o resto aparece no arquivo novo, ou o
limite sai com o caminho trocado). Verde depois. O mesmo vermelho se obtém tirando a tradução (`return arquivo` em `arquivoDepoisDasOndas`):
7 falhas, as seis e a do `reaplicar`.

## Correção

- `mapa.ts`: `arquivoDepoisDasOndas(arquivo, mapas, indiceDaOnda)` leva o arquivo pelos movimentos `arquivo` e `pasta` das ondas **seguintes**,
  na ordem das ondas e das entradas (arquivo: `de` igual leva a `para`; pasta: o prefixo `de/` vira `para/`, o que inclui o `fica` que é pasta, com `/` no fim),
  e `ocorrenciasNoLugarDeHoje(mapas)` a aplica a todas as ocorrências. O mapa e o relatório não se reescrevem. A função fica num lugar só.
- `restos.ts`: o `fica` vem de `ocorrenciasNoLugarDeHoje`, e a chave da troca à mão de cada relatório passa por `arquivoDepoisDasOndas` com a posição da onda dele.
- `reaplicar.ts`: o `novas` usa `ocorrenciasNoLugarDeHoje`.
- `casos.md` (`restos`, Verde e Vermelho): os casos novos.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian (1ª) | "O docblock de `restos.ts:24-25` continua sendo a única barreira de dado pessoal na saída da ferramenta. Se a esteira um dia arquivar essa saída, convém trocar a premissa escrita por uma guarda que rode." | `TODO.md`, com a condição "se a esteira passar a arquivar a saída do `restos`"; hoje nada arquiva, e a guarda pede decisão de comportamento fora desta correção |
| revisor-geral (1ª) | "A frase nova da Tech Spec §5 vai no commit da 5.0, na L1. Se o encontro da L2 for para a spec antes desse commit, … sem a frase. O Orquestrador precisa confirmar no encontro que a frase entra junto, ou logo depois." | Não é desta correção (fora dela: `techspec.md` é da 5.0, seção "Fora desta correção"); fica com o Orquestrador, que conduz o encontro das linhas |

## Mutações

```mutacao
arquivo: tools/renomear/mapa.ts
teste: tools/renomear/restos.test.ts › o fica de uma onda num arquivo que uma onda seguinte moveu
-      if (entrada.tipo === 'arquivo' && atual === entrada.de) atual = entrada.para
+      if (entrada.tipo === 'arquivo' && false) atual = entrada.para
```

```mutacao
arquivo: tools/renomear/mapa.ts
teste: tools/renomear/restos.test.ts › o fica de um arquivo dentro de uma pasta que uma onda seguinte moveu
-      else if (entrada.tipo === 'pasta' && atual.startsWith(`${entrada.de}/`)) atual = `${entrada.para}${atual.slice(entrada.de.length)}`
+      else if (false) atual = `${entrada.para}${atual.slice(entrada.de.length)}`
```

```mutacao
arquivo: tools/renomear/mapa.ts
teste: tools/renomear/restos.test.ts › o fica de um arquivo dentro de uma pasta que uma onda seguinte moveu
-      else if (entrada.tipo === 'pasta' && atual.startsWith(`${entrada.de}/`)) atual = `${entrada.para}${atual.slice(entrada.de.length)}`
+      else if (entrada.tipo === 'pasta' && atual.startsWith(`${entrada.de}/`)) atual = `${entrada.para}`
```

```mutacao
arquivo: tools/renomear/mapa.ts
teste: tools/renomear/restos.test.ts › o fica que é a própria pasta que uma onda seguinte moveu
-      else if (entrada.tipo === 'pasta' && atual.startsWith(`${entrada.de}/`)) atual = `${entrada.para}${atual.slice(entrada.de.length)}`
+      else if (entrada.tipo === 'pasta' && atual.startsWith(`${entrada.de}/`)) atual = `${entrada.para}${atual.slice(entrada.de.length)}`.replace(/\/$/, '')
```

```mutacao
arquivo: tools/renomear/mapa.ts
teste: tools/renomear/restos.test.ts › o fica de uma pasta irmã de prefixo igual não é levado pelo move da pasta
-      else if (entrada.tipo === 'pasta' && atual.startsWith(`${entrada.de}/`)) atual = `${entrada.para}${atual.slice(entrada.de.length)}`
+      else if (entrada.tipo === 'pasta' && atual.startsWith(entrada.de)) atual = `${entrada.para}${atual.slice(entrada.de.length)}`
```

```mutacao
arquivo: tools/renomear/mapa.ts
teste: tools/renomear/restos.test.ts › o move da própria onda não leva o fica dela: o fica é do arquivo como a onda o deixa
-  for (const mapa of mapas.slice(indiceDaOnda + 1)) {
+  for (const mapa of mapas.slice(indiceDaOnda)) {
```

```mutacao
arquivo: tools/renomear/mapa.ts
teste: tools/renomear/restos.test.ts › duas ondas que movem o mesmo arquivo, na ordem das ondas
-  for (const mapa of mapas.slice(indiceDaOnda + 1)) {
+  for (const mapa of mapas.slice(indiceDaOnda + 1, indiceDaOnda + 2)) {
```

```mutacao
arquivo: tools/renomear/mapa.ts
teste: tools/renomear/restos.test.ts › o move de uma onda anterior não leva o fica de uma onda seguinte
-  for (const mapa of mapas.slice(indiceDaOnda + 1)) {
+  for (const mapa of mapas) {
```

```mutacao
arquivo: tools/renomear/mapa.ts
teste: tools/renomear/restos.test.ts › o fica de uma onda num arquivo que uma onda seguinte moveu
-  return mapas.flatMap((mapa, indice) => mapa.ocorrencias.map((ocorrencia) => ({ ...ocorrencia, arquivo: arquivoDepoisDasOndas(ocorrencia.arquivo, mapas, indice) })))
+  return mapas.flatMap((mapa) => mapa.ocorrencias)
```

```mutacao
arquivo: tools/renomear/restos.ts
teste: tools/renomear/restos.test.ts › a troca à mão registrada num arquivo que uma onda seguinte moveu
-  const registrada = new Set(mapas.flatMap((mapa, indice) => [...trocaAMaoRegistrada(arvore.lerOuNada(`${PASTA_DOS_MAPAS}/${mapa.nome}.relatorio.md`) ?? '')].map((chave) => chaveDaTrocaAMaoNoLugarDeHoje(chave, mapas, indice))))
+  const registrada = new Set(mapas.flatMap((mapa, indice) => [...trocaAMaoRegistrada(arvore.lerOuNada(`${PASTA_DOS_MAPAS}/${mapa.nome}.relatorio.md`) ?? '')].map((chave) => chaveDaTrocaAMaoNoLugarDeHoje(chave, mapas, mapas.length))))
```

```mutacao
arquivo: tools/renomear/restos.ts
teste: tools/renomear/restos.test.ts › a troca à mão registrada num arquivo que uma onda seguinte moveu
-  return `${arquivoDepoisDasOndas(arquivo, mapas, indiceDaOnda)}\u0000${nome}`
+  return `${arquivo}\u0000${nome}`
```

```mutacao
arquivo: tools/renomear/restos.ts
teste: tools/renomear/restos.test.ts › a troca à mão da onda N não libera o arquivo que chegou ao caminho antigo depois do move
-  return `${arquivoDepoisDasOndas(arquivo, mapas, indiceDaOnda)}\u0000${nome}`
+  return `${arquivo}\u0000${nome}`
```

```mutacao
arquivo: tools/renomear/restos.ts
teste: tools/renomear/restos.test.ts › o fica de uma onda num arquivo que uma onda seguinte moveu
-  const fica = ocorrenciasNoLugarDeHoje(mapas).filter((ocorrencia) => ocorrencia.classe === 'fica')
+  const fica = mapas.flatMap((mapa) => mapa.ocorrencias).filter((ocorrencia) => ocorrencia.classe === 'fica')
```

```mutacao
arquivo: tools/renomear/reaplicar.ts
teste: tools/renomear/reaplicar.test.ts › o fica de uma onda num arquivo que uma onda seguinte moveu não é referência nova, e o arquivo que chegou ao caminho antigo é
-  const ocorrencias = ocorrenciasNoLugarDeHoje(mapas)
+  const ocorrencias = mapas.flatMap((mapa) => mapa.ocorrencias)
```

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-30 23:57:21 | 2026-10-30 23:57:44 | `privacy-guardian` | 1 | APROVADO | ac7a930accfa4f8f5 |
| 2026-10-30 23:57:20 | 2026-10-30 23:58:28 | `revisor-geral` | 1 | APROVADO | adc9aff9319011630 |
| 2026-10-30 23:57:19 | 2026-10-30 23:58:55 | `test-engineer` | 1 | REPROVADO | a4daed1f2a7e35410 |
| 2026-10-31 00:05:50 | 2026-10-31 00:06:09 | `privacy-guardian` | 2 | APROVADO | af580c80cb31a198a |
| 2026-10-31 00:05:44 | 2026-10-31 00:06:12 | `revisor-geral` | 2 | APROVADO | a6b6fee6e3f5ba14b |
| 2026-10-31 00:05:33 | 2026-10-31 00:06:26 | `test-engineer` | 2 | APROVADO | a9ab27b7f2e417d04 |
