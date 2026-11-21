# Abertura — reserva-e-avaliacao (F5b)

Esta spec nasceu do corte da F5 em 21/11/2026 (Joaquim; `tasks/prd-camada-ia/estado.md`, "Esperando o Joaquim", 20/11 23:28):
a lista da F5 tinha 13 tarefas, uma acima do teto de 12, e a 13.0 espera as chaves de teste dos finalistas, que são do
Joaquim (PRD §10). A F5a (`camada-ia`, da 1.0 à 8.0, custo e orçamento) pousa sem depender delas; a reserva e a avaliação
vêm para cá, sem mudar requisito, desenho nem cenário.

O que já existe, aprovado na F5:

- `prd.md`: RF1 a RF4, a parte da reserva do RF5, a da reserva e da execução interrompida do RF6, e RF13 a RF16, com
  os números da F5
- `techspec.md` e `cenarios.md`: as seções da reserva e da avaliação, com a numeração da F5
- `rascunho-das-tarefas/`: a lista da 9.0 à 13.0 (`lista.md`) e os documentos `9_task.md` a `13_task.md`, como a F5 os
  deixou. A F5 não começou nenhuma delas
- a história da revisão da spec: `tasks/prd-camada-ia/revisao-spec.md` (rodada 6, APROVADA) e
  `tasks/prd-camada-ia/achados/revisao-spec.md`

Começa **depois da F5a pousar**, com a fase `sem-revisao-da-spec` (há PRD e Tech Spec, e ainda não há `revisao-spec.md`
nem `tasks.md` nesta pasta). Ao abrir o andar, o Arquiteto:

1. Lê o que a F5a deixou na `develop`: o `llm-gateway.ts` (a linha por chamada, `registrarLinhas`, a estimada), o
   `consumo.ts` (`PRECO_DOS_MODELOS`, `custoDaChamada`), o `llm-config.ts` (`exigePreco`), a coluna
   `consumo_ia.pelo_provedor_de_reserva` e o `uso()` da Operação, que já conta `chamadasPeloProvedorDeReserva`; e as
   divergências que as tarefas da F5a registraram na `tasks/prd-camada-ia/techspec.md` e no `cenarios.md` de lá.
2. Roda o `revisar-spec` nesta pasta, contra esse código. O desenho foi aprovado na F5; a rodada confere o que a F5a mudou
   embaixo dele (nomes, assinaturas, o que já está feito) e grava o `revisao-spec.md` daqui.
3. Roda o `criar-tasks` a partir de `rascunho-das-tarefas/`: renumera da 1.0 à 5.0, acerta as dependências (a 9.0 da F5
   dependia da 2.0, que já pousou) e as referências dos documentos (`prd.md`, `techspec.md` e `cenarios.md` passam a ser os
   desta pasta), e completa o "Como testar" com os precedentes que a F5a deixou.
4. Confere que a estimada da interrompida ainda grava sem custo (`consumoEstimadoDaInterrompida`, em
   `packages/core/src/ia/consumo.ts`, aponta a 11.0 da F5): o custo dela é desta spec. E as pendências da F5 que são desta
   spec no `TODO.md`: a linha 99 de `docs/lgpd.md` com `pelo_provedor_de_reserva`
   (dona: a 10.0 da F5, 10.4) e o teste de que `provedor` guarda o id da reserva.

A 13.0 da F5 (rodar a avaliação por finalista) só parte com as chaves de teste dos finalistas; sem elas, a F5b não fecha
(D37). A pergunta vai ao Joaquim quando a 12.0 da F5 estiver pronta.
