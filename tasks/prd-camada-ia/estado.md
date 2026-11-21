# Estado da execução — camada-ia

## Agora
- **Espero:** o `RELATÓRIO` do `Implementador 2` (L2) da correção `2026-11-20-faltando-junta-and-de-varias-linhas` (M4 da X6, partida 20/11 23:26) e o do `Implementador` (L1) da `2026-11-21-inventario-no-portao` (M2 da F4, partida 21/11 ~00:1x), 1ª tentativa. A 1.0 parte na primeira linha livre depois das duas. Pergunta do tamanho da spec aberta (não segura nada).
- **Devo ainda:** as M1, M3+M4 e M5 da F4b entram por correção. Push da `develop` (a retro `6496c7b5` está sem push) no próximo pouso. A 13.0 depende das chaves de teste dos finalistas, que são do Joaquim (PRD §10).
- **Base:** `spec/camada-ia` em `2cb1e9ab` (encontro da L1, M2 da X6); esteira verde em `b9188e3`

## Concluídas
| Tarefa | Commit | Modelo | Rodadas | Observação |
|---|---|---|---|---|
| correção `2026-11-20-revisoes-nao-se-perdem-por-script` (M2 da X6, L1) | `bdcef966` | Sonnet | 6 revisores APROVADO na 2ª | 29 casos, 22 mutações; `TODO.md`: M2 marcada e uma linha para a retro |

## Esperando o Joaquim
## 20/11 23:28 — F5 camada-ia, o tamanho da spec, no meu terminal
Decisão: 13 tarefas, uma acima do teto de 12: seguir com uma spec só ou cortar em F5a (1.0 a 8.0, custo e orçamento) e F5b (9.0 a 13.0, reserva e avaliação).
Contexto: `RELATÓRIO` do `Arquiteto`, 23:24; `tasks/prd-camada-ia/tasks.md`. A 13.0 depende das chaves de teste dos finalistas, que são do Joaquim (PRD §10).
Opções: uma spec só, com teto de 13 | F5a e F5b
Recomendo: cortar em F5a e F5b. Numa spec só, o pouso inteiro espera a 13.0, que espera as chaves; cortada, a F5a (custo e orçamento) pousa sem depender delas. Se as chaves chegam logo, uma spec só serve.
Segue sem depender: as correções M2 e M4 da X6 (processo) e a 1.0 em diante, que estão nas duas opções.

## O que falhou
- 20/11 21:4x: o `maestri floor delete` do andar L1 da F4b deu "malformed floorLifecycleVerdictResult frame": o andar saiu da lista, mas o checkout e a branch ficaram; removi à mão (contidos na `develop`). Depois, o `recruit --replace` dos dois Arquitetos falhou pela pasta da L1: pasta vazia, replace, rmdir; `Implementador` e `Mesa` reapontados para o térreo.
## O que decidi sem perguntar
