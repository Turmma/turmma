# Estado da execução — semana-do-professor

## Agora
- **Espero:** linha 1: o `RELATÓRIO` da 2.0 (porte grande, 1ª tentativa), pedida em 06/11 ~15:25
- **Devo ainda:** no fechamento, escrever no `TODO.md` os quatro destinos da ordem r1 da 1.0 que ninguém escreveu (`.processo/ordens/1_task-r2.md` da linha 1): volume do `delete` no encerramento do ano (Infra e operação), reserva do expurgo da `aula` (LGPD e conformidade), rótulo "Registro da aula" em `Retencao.tsx` (para o Validador), S7 do `cenarios.md` (para a retro). A esteira vermelha em `b9b05fe` é a base fixa, já corrigida em `8ca3d1da`
- **Base:** `spec/semana-do-professor` em `63fc7f1d`

## Concluídas
| Tarefa | Commit | Modelo | Rodadas | Observação |
|---|---|---|---|---|
| 1.0 | `7732c208` | Sonnet 5.5 | 2 | antes, a correção `base-fixa-acima-do-limite` (`8ca3d1da`) por `DIVERGÊNCIA` de portão |

## Esperando o Joaquim
## O que falhou
- 06/11 ~14:40: na 1.0, o portão parou em `tools/processo/harness/base-fixa.test.ts`: a base fixa tem 40.006 B, acima de 40.000 B, desde a D87 (`8d624453`, nesta branch). Não vem da tarefa
## O que decidi sem perguntar
- 06/11 12:12: abri a F2b, e não a F2c, embora o `estado.ts` sem nome escolha a F2c (que já tem PRD e Tech Spec): o Joaquim pediu "depois do pouso já abre a F2b", e ela é a primeira pendente do roadmap
- 06/11 ~14:40: `DIVERGÊNCIA` de portão na 1.0 (base fixa 6 B acima do limite pela D87): correção `base-fixa-acima-do-limite` na linha 1, pelo Implementador reiniciado, enxugando o `CLAUDE.md` sem subir o limite; guardiões só os de sempre (documento de processo)
