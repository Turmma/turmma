# Estado da execução — avaliacao-e-correcao

## Agora
- **Espero (23/11 13:20):** a retro da F5b, com o `Arquiteto 2` no térreo (`retro.md` ainda sem commit na `develop`, ponta `23761ad6`). O `Arquiteto`, no andar, parou na fase `sem-tarefas` (revisão da spec aprovada em 4 rodadas, `d52e9ea0`) até a `develop` com o `retro.md` chegar à branch. A F6 foi cortada de novo (`3ad38c00`): fica a prova online; lote, contestação e Turmas viram a F6d `correcao-e-atencao`. A linha 1 (`Implementador` e `Mesa`, Sonnet) na correção `d55-recusa-rubrica`, 1ª tentativa, desde 23/11 12:33.
- **Devo ainda:** trazer a `develop` para a spec depois do commit da retro (D86, passo 8); o `Arquiteto` para antes do `criar-tasks` até o `retro.md` estar na branch. Na retro, o item do `tenancy-guardian` da 7.0 da F5b e o menor 5 da validação da F5b (o hook e a retomada do mesmo subagente).
- **Base:** `spec/avaliacao-e-correcao` na abertura, sobre a `develop` em `23761ad6` (F5b pousada, esteira verde, execução 45194314577, tentativa 2)
- **Decidido (23/11), aviso fixo da coluna "Saiu da aba":** o Joaquim aprovou, nesta conversa, o texto proposto em `cenarios.md` §4, sem mudança.

## Concluídas
| Tarefa | Commit | Modelo | Rodadas | Observação |
|---|---|---|---|---|

## Esperando o Joaquim
## O que falhou
- 23/11 12:28: a esteira da `develop` no pouso da F5b caiu na fatia 8 do e2e sem rodar teste (timeout do runner baixando imagem do `ghcr.io`); verde na segunda tentativa, só a fatia que caiu.

## O que decidi sem perguntar
- 23/11 12:28: a correção da D55 (decisão do Joaquim, 22/11 12:55, "corrige a D55 depois da F5b"; `tasks/prd-reserva-e-avaliacao/achado-d55-recusa-rubrica.md`) corre na linha 1 desta spec, durante o PRD, e não em andar próprio: a rubrica antes da aplicação é escopo da F6, uma correção avulsa seguraria a spec até o pouso dela (uma por vez, passo 3), e o par da linha estava ocioso. Seguinte: a F6, primeira pendente do `ROADMAP.md`; a F18, antes dela na ordem da fatia, depende do provedor da VPS, em aberto.
