# Correção — o `conferir` troca, na foto de antes, o homônimo declarado em outro arquivo do mesmo pacote

**Origem:** 2ª divergência da 9.0 de `nomes-de-mercado` (triagem do Arquiteto, 31/10, seção 1), com a regra em `3d6b9baa` (`spec/nomes-de-mercado`: Tech Spec §5 e `casos.md`, `conferir`).
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`
<!-- Os guardiões vieram no PEDIDO do Orquestrador. `revisor-geral` também porque a correção toca `tools/` com o `conferir` de uma onda do rename. -->

## Sintoma

O `conferir` da 9.0 (mapa `9.json`) sai VERMELHO: `saiu ListItem` / `entrou Linha` em `apps/web`. Há dois `export … Linha` no pacote: o do kit (`components/ui/Linha.tsx`, que a onda renomeia para `ListItem`) e o de `areas/coordenacao/comum/pecas-da-lista.tsx`, que é da 10.0 (`ListRow`) e fica como está. O `aplicar` renomeia por símbolo e deixa o segundo; o `conferir` o troca na foto de antes.

## Fora desta correção

Nada. A correção foi escrita na L2, onde a árvore da 9.0 estava em curso (264 arquivos), e foi trazida para a L3 (árvore limpa) só com `conferir.ts`, `conferir.test.ts` e este documento.

## Causa

`paraONomeExportado` (`tools/renomear/conferir.ts`) segue a entrada `simbolo` com `arquivo` para todo exportado do mesmo **pacote** (`pacoteDoArquivo(item.arquivo) === pasta`). O pacote é o grão da foto, mas a entrada declara um **arquivo**: o homônimo declarado em outro arquivo do mesmo pacote também é trocado na foto de antes, e o `aplicar` não o troca. É o limite (3) do comentário do topo.

## Teste que reproduz

Todos em `tools/renomear/conferir.test.ts`:
- verde, em "o nome exportado segue a entrada só no pacote do arquivo dela e em quem reexporta dele": `o homônimo declarado em outro arquivo do mesmo pacote fica com o nome antigo` (vermelho antes da correção) e `a entrada vale para o arquivo que o `arquivo` dela nomeia no HEAD, mesmo quando a onda o move` (prende que `item.arquivo` é o do HEAD; a rodada 1 da Mesa o pediu);
- vermelho, em "conferir: vermelho quando": `o homônimo de outro arquivo do mesmo pacote sai com o nome novo da entrada`.

## Correção

Em `paraONomeExportado`, no pacote da entrada, o item sem `origem` (o nome declarado no próprio arquivo) só segue a entrada se `item.arquivo === candidata.arquivo` (os dois são caminhos do `HEAD`). O item com `origem` (reexportação) segue como antes. O comentário do topo passa a dizer que o limite (3) cobre só o que sobra: o homônimo do mesmo pacote que outro arquivo reexporta, e o nome importado de outro pacote e repassado.

**Prova real**, no checkout da L2 (com a árvore da 9.0 em curso), o `conferir` do `HEAD` contra o corrigido, nos mapas 3, 4, 5, 6 e 9: a saída dos mapas 3 a 6 é idêntica nos dois (a mesma contagem e o mesmo texto; o vermelho é da árvore estar na 9.0, não do mapa); no mapa 9, o par `saiu ListItem` / `entrou Linha` de `apps/web` some (6 diferenças viram 4). As 4 que sobram são as strings de `apps/web/src/components/perigo-cheio.test.ts` (`<Botao …>` → `<Button …>`), trabalho da 9.0 que a retomada trata; não são do `conferir`.

## Mutações

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › o homônimo declarado em outro arquivo do mesmo pacote fica com o nome antigo
    const pasta = pacoteDoArquivo(candidata.arquivo)
-    if (item.origem === undefined) return item.arquivo === candidata.arquivo
    return pacoteDoArquivo(item.arquivo) === pasta || reexportaDoPacote(item.origem, pasta, nomes)
```

```mutacao
arquivo: tools/renomear/conferir.ts
teste: tools/renomear/conferir.test.ts › a entrada vale para o arquivo que o `arquivo` dela nomeia no HEAD, mesmo quando a onda o move
-    if (item.categoria === 'exportado') return { ...item, arquivo, valor: paraONomeExportado(item, mapa.entradas, nomesDosPacotes) }
+    if (item.categoria === 'exportado') return { ...item, arquivo, valor: paraONomeExportado({ ...item, arquivo }, mapa.entradas, nomesDosPacotes) }
```

## Sem aplicar

Da ordem `.processo/ordens/2026-10-31-conferir-homonimo-no-mesmo-pacote-r1.md` (as quatro outras recomendações foram aplicadas).

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (1ª) | Teste do lado vermelho do limite (3): outro arquivo do pacote da entrada reexporta o homônimo (`export { Banco } from './outro.ts'`), "assim o limite deixa de existir só no comentário" | Recusada: o limite (3) é falso vermelho conhecido, não regra; um teste o fixaria como comportamento esperado. Está no comentário do topo (limite 3), e o teste `quem reexporta do pacote da entrada passa ao nome novo, e quem reexporta o homônimo fica` já cobre a reexportação |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-31 11:16:45 | 2026-10-31 11:17:04 | `revisor-geral` | 2 | APROVADO | aaed6bb85af7e3ac1 |
| 2026-10-31 11:16:39 | 2026-10-31 11:17:13 | `test-engineer` | 2 | APROVADO | afa8131dc43ae910f |
