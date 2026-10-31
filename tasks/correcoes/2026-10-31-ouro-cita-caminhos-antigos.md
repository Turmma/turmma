# Correção — o ouro cita os caminhos de antes da 5.0

**Origem:** `tasks/prd-nomes-de-mercado/travas.md`, "O ouro" (a 13.0 depende dela), depois da 5.0 (`bc33a536`).
**Subagentes obrigatórios:** `test-engineer`, `conformidade-reviewer`, `revisor-geral`
<!-- Os dois primeiros vieram no PEDIDO do Orquestrador; quem altera o ouro é o Arquiteto, com o `conformidade-reviewer` (RF16 da X7). O `revisor-geral` o hook cobrou no commit: o ouro conta como código de processo. -->

**Sem mutação:** nenhum arquivo de `apps/*/src`, `packages/*/src` nem `tools/` muda; só documento do ouro, o selo dele e
um anexo da spec.

## Sintoma

A 5.0 moveu `packages/nucleo` para `packages/core` e, no anexo, `__fixtures__/ouro.ts` para `__fixtures__/golden.ts`,
`ouro.test.ts` para `golden.test.ts`, `selo-do-ouro.test.ts` para `golden-seal.test.ts` e
`__fixtures__/amostras-do-assistente-revisao.ts` para `__fixtures__/assistente-review-samples.ts` (`mapas/5.json`). Nenhuma
onda toca o ouro (`travas.md`, "O ouro"), e cinco citações ficaram com o caminho de antes:

| Arquivo | Linha | Citava |
|---|---|---|
| `docs/aia/ouro/README.md` | 8 | `selo-do-ouro.test.ts` |
| `docs/aia/ouro/README.md` | 20 | `packages/nucleo/src/ia/__fixtures__/amostras-do-assistente-revisao.ts` |
| `docs/aia/ouro/README.md` | 126 | `packages/nucleo/src/ia/__fixtures__/ouro.ts` e `ouro.test.ts` |
| `docs/aia/ouro-retido/README.md` | 25 | `ouro.test.ts` |
| `docs/aia/ouro-retido/RETIDOS.json` | 421 | `ouro.test.ts` (o `como` da medida independente da 3.0) |

## Fora desta correção

Nada: a árvore do andar `spec/nomes-de-mercado--l2` estava limpa antes da correção.

## Causa

O ouro é isento das ondas: mudar o README quebra o `SELO.json`, e só o Arquiteto o altera. O `restos` só passa a olhar o
ouro com o `mapas/13.json` (`tools/renomear/restos.ts`), e por isso a troca fica com esta correção, antes da 13.0.

A busca foi feita contra todas as entradas não `fica` dos mapas 3, 4 e 5, pelo nome do arquivo sem extensão, nos quatro
arquivos de texto do ouro (`README.md` e `MEDIDAS.json` de `ouro/`, `README.md` e `RETIDOS.json` de `ouro-retido/`). Fora
das cinco acima, os acertos são palavra comum em prosa (`contexto`, `estado`, `tarefa`, `texto`, `chaves`, `adaptador`),
não citação de arquivo. Os lotes (`*.json` de amostras) não citam caminho.

## Teste que reproduz

`packages/core/src/ia/golden-seal.test.ts › a pasta real confere com o SELO.json`: com o README novo e o selo antigo fica
vermelho (`README.md: o conteúdo mudou desde o selo`), e com ele os quatro casos que copiam a pasta real (5 de 6 vermelhos,
rodado em 31/10); com o selo regravado, os 6 verdes, e o `golden.test.ts` também. Nenhum teste lê as citações; o
`ouro-retido/` ainda não é lido por teste (a 26.0 da X5 o liga).

## Correção

1. As cinco citações passam ao caminho de hoje. A frase da linha 8 diz onde o selo nasceu e onde está hoje
   (`packages/core/src/ia/golden-seal.test.ts`), sem o nome antigo, que viraria resto quando o `restos` olhar o ouro.
   No `RETIDOS.json` o `como` é registro de uma medida feita em `1f770ea`, quando o arquivo ainda se chamava
   `ouro.test.ts`; a troca aponta o arquivo que o leitor de hoje acha, e o histórico fica no git.
2. `docs/aia/ouro/SELO.json` regravado com o sha256 do README novo (os outros sete arquivos não mudaram).
3. De passagem, `tasks/prd-nomes-de-mercado/casos.md` ganha os dois limites do `conferir` que a correção
   `2026-10-30-conferir-homonimo-de-outro-pacote` deixou em "Recomendações sem aplicar": `export * as X from` e o import
   por padrão repassado. Os dois erram para o vermelho. O comentário do topo de `conferir.ts` não muda (código de
   `tools/`, fora deste pedido).

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer 1ª (1) e (2) | No `casos.md`, dizer a condição do `export * as X` (o `X` igual ao `de`, e o caminho relativo que entra no pacote) e juntar o import de namespace repassado ao por padrão | Aplicadas: só texto do anexo |
| test-engineer 1ª (3) | O comentário do topo de `tools/renomear/conferir.ts` (linhas 22-23) apresenta o `export * as X from` como forma seguida, sem citar o limite | Para a próxima correção que mexer em `conferir.ts`: `tools/` está fora deste pedido |
| test-engineer 1ª (4) | O `como` do `RETIDOS.json:421` reescreve um registro feito em `1f770ea` | Mantida a troca: o `conformidade-reviewer` conferiu que a expressão, o commit e os números ficam intactos, e o nome antigo viraria resto quando o `restos` olhar o ouro (`mapas/13.json`) |
| conformidade-reviewer 1ª (1) | `docs/aia/ouro/README.md:9` cita `tools/guardas/ouro-separado.ts`, nome em português de um arquivo que a 29.0 ainda vai criar | Para a 29.0, que decide o nome e corrige a citação junto; hoje não há caminho novo a apontar |
| conformidade-reviewer 1ª (2) | Uniformizar: a linha 8 usa o caminho completo, a 126 e o `ouro-retido/README.md:25` só `golden.test.ts` | Recusada: a 126 dá o caminho completo do `golden.ts` na mesma frase, e o retido cita o arquivo como antes; mexer de novo no README pede outro selo sem ganho de sentido |
| revisor-geral 1ª (1) | O `casos.md` entrou de passagem no commit do ouro; da próxima vez, commit próprio | Aceita para a próxima: aqui veio no mesmo pedido do Orquestrador, e o documento declara o acréscimo |
| revisor-geral 1ª (2) | `docs/aia/ouro/README.md:7-8`: a segunda parte da frase do selo ficou sem verbo, e as linhas passam da largura do arquivo | Para a próxima alteração do README: cada mudança pede selo novo e outra rodada |
| revisor-geral 1ª (3) | "a árvore da linha 2" pede o contexto do D79 | Aplicada em "Fora desta correção" |

## Revisões

Preenchida pelo hook quando cada revisor termina. Não edite à mão.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-31 02:24:59 | 2026-10-31 02:26:12 | `conformidade-reviewer` | 1 | APROVADO | af8a486de9d0b85d3 |
| 2026-10-31 02:25:06 | 2026-10-31 02:26:41 | `test-engineer` | 1 | APROVADO | a4bd6f8aeea485752 |
| 2026-10-31 02:29:01 | 2026-10-31 02:29:57 | `revisor-geral` | 1 | APROVADO | ab1b3c13fc9a10bfd |
