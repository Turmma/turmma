# Relatório sintético do adaptador falso da reserva

Este relatório **não é de um modelo**. Ele existe para o adaptador falso da reserva (`falso-reserva`) ter uma entrada em
`MODELOS_APROVADOS` (`packages/core/src/ia/modelos-aprovados.ts`) e a guarda do `sha256` valer também para ele.

- **Onde vale:** `AMBIENTE=local` e `staging`, na carga, na bancada e na demonstração. Com `AMBIENTE=producao` a entrada do
  `falso-reserva` não torna nenhuma tarefa elegível, e a subida recusa a reserva falsa.
- **O que ele diz:** nada sobre taxa, custo ou segurança de modelo algum. O adaptador falso devolve a versão determinística da
  tarefa, feita só do que veio na entrada, sem chamar ninguém e sem custo.
- **O que ele não substitui:** a avaliação de `tasks/prd-reserva-e-avaliacao/avaliacao.md`. Entrada de provedor de verdade só nasce
  de um relatório gerado por `tools/ia/avaliar-modelos.ts`, com as amostras, os eliminatórios e o `resultado.json`.

## O `resultado.json` sintético

Ao lado deste relatório está o `resultado.json` do mesmo formato que `tools/ia/avaliar-modelos.ts` grava, com **todas as linhas** da tabela de
`tasks/prd-reserva-e-avaliacao/avaliacao.md` aprovadas e nenhuma eliminatória reprovada. Ele é **sintético**: nenhuma amostra rodou, e cada linha diz isso na parte
`sintetico`. A classificação do material vai marcada no perfil `rapido`, o que o catálogo de tarefas diz hoje. A guarda de `MODELOS_APROVADOS`
(`problemasDaCadeiaDeAprovacao`) confere a cadeia inteira também para esta entrada: o `sha256` abaixo é o do arquivo, e editar o `resultado.json` sem refazer este relatório quebra o teste.

sha256 do `resultado.json`: `d116a218dc61c2e6c3f7e1963f6d6af94f1dc7a9545e521d239f4428a4ad87b1`

## Limites desta medida

- Nenhuma resposta de modelo foi lida: as respostas do relatório da correção sem a conferência da máquina são 0, porque não há resposta.
- Os lotes retidos não foram enviados a ninguém: a linha dos lotes e a da classificação são sintéticas, e este relatório não consome nenhum lote.
- Nada aqui diz que o adaptador falso passaria na equidade, na D55 ou em qualquer linha. Ele vale só fora de produção, e a subida recusa a reserva falsa em `AMBIENTE=producao`.

