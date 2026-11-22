# Relatório sintético do adaptador falso da reserva

Este relatório **não é de um modelo**. Ele existe para o adaptador falso da reserva (`falso-reserva`) ter uma entrada em
`MODELOS_APROVADOS` (`packages/core/src/ia/modelos-aprovados.ts`) e a guarda do `sha256` valer também para ele.

- **Onde vale:** `AMBIENTE=local` e `staging`, na carga, na bancada e na demonstração. Com `AMBIENTE=producao` a entrada do
  `falso-reserva` não torna nenhuma tarefa elegível, e a subida recusa a reserva falsa.
- **O que ele diz:** nada sobre taxa, custo ou segurança de modelo algum. O adaptador falso devolve a versão determinística da
  tarefa, feita só do que veio na entrada, sem chamar ninguém e sem custo.
- **O que ele não substitui:** a avaliação de `tasks/prd-reserva-e-avaliacao/avaliacao.md`. Entrada de provedor de verdade só nasce
  de um relatório gerado por `tools/ia/avaliar-modelos.ts`, com as amostras, os eliminatórios e o `resultado.json`.
