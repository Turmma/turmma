# Estado da execução — avaliacao-e-correcao

## Agora
- **Espero (23/11 14:40):** a linha 2 (`Implementador 2` e `Mesa 2`, Sonnet), aberta às 14:36 em `…--l2`, na **1.0** (porte grande), 1ª tentativa, desde 14:39. Tarefas conferidas pelo `test-engineer` (`b9dd2353`). **Correção `d55-recusa-rubrica` em escalada (23/11 13:41):** `conformidade-reviewer` e `revisor-geral` reprovaram 2 vezes seguidas (rubrica + texto de aluno colado sem marca; separação por vocabulário); ordem `.processo/ordens/2026-11-23-d55-recusa-rubrica-r2.md`, na linha 1. Diagnóstico do `Arquiteto 2` em `.processo/ordens/diagnostico-d55-recusa-rubrica.md` (linha 1); o Joaquim escolheu A às 14:54. **Espero (23/11 ~15:00):** o `Implementador`, reiniciado na linha 1, na retomada da correção: aplica os pontos 1 a 4 de A e a ordem r2; a Mesa julga contra o "Resto aceito". Paralelo: 3.0, 5.0 e 7.0 depois da 2.0; 10.0 depois da 1.0; 11.0 ao lado da 12.0.
- **Devo ainda:** com a 1.0 encontrada, partem 2.0 e 10.0 (paralelo). No fechamento da F6, levar ao `TODO.md` a alternativa C do diagnóstico d55 (rubrica pelo cartão da ferramenta, sem conversa livre e sem modelo) como requisito do PRD da F7 mínima, por pedido do Arquiteto 2 com a decisão do Joaquim. A `develop` tem a retro da F5b sem push (`88192a63`): o push dela é do Joaquim.
- **Base:** `spec/avaliacao-e-correcao` na abertura, sobre a `develop` em `23761ad6` (F5b pousada, esteira verde, execução 45194314577, tentativa 2)
- **Decidido (23/11), aviso fixo da coluna "Saiu da aba":** o Joaquim aprovou, nesta conversa, o texto proposto em `cenarios.md` §4, sem mudança.

## Concluídas
| Tarefa | Commit | Modelo | Rodadas | Observação |
|---|---|---|---|---|

## Esperando o Joaquim
## 23/11 13:42 — correção d55-recusa-rubrica (linha 1), BLOQUEIO do Arquiteto 2 — RESPONDIDA (23/11 14:54, no terminal do Arquiteto 2): alternativa A, a conferência da saída como barreira declarada e o resto de até 120 caracteres aceito; C vai para o PRD da F7 mínima
Decisão: aceitar a alternativa A (a conferência da saída como barreira declarada, com um resto aceito por escrito) ou B (recusar de novo os pedidos 3 e 4 do achado)?
Contexto: pelo vocabulário não se separa um enunciado curto entre aspas de uma resposta de aluno do mesmo tamanho; o HEAD também deixava passar texto de aluno curto, sem conferência da saída. Arquivo: `.processo/ordens/diagnostico-d55-recusa-rubrica.md`, no checkout da linha 1.
Opções: A — todo pedido de rubrica de redação ou discursiva com dois-pontos ou aspas liga a conferência da saída; um trecho livre de até 120 caracteres passa ao modelo, aceito por escrito | B — esse pedido volta a ser recusado, como no HEAD; a rubrica de redação escrita naturalmente continua recusada
Recomendo: A, e C (rubrica pelo cartão da ferramenta, sem conversa livre) como requisito no PRD da F7 mínima: A fecha o furo que o HEAD tinha e cumpre a rubrica que a D55 permite.
Segura só a correção. A F6 não depende dela: a 1.0 parte às 14:10 em outra linha, porque a linha 1 está com a correção na árvore.
- **(23/11 13:44) Antes da 12.0 (tela do aluno):** o texto do Enviar com 503, novo, em `cenarios.md` §4: "Não deu para enviar agora. Suas respostas estão guardadas; tente de novo em instantes. O tempo da queda volta para você." Não trava nada antes da tela.
- **(23/11 13:30) Push da `develop`:** a retro da F5b (`88192a63`) está na `develop` local, sem push; perguntei se faço agora ou no próximo pouso.

## O que falhou
- 23/11 12:28: a esteira da `develop` no pouso da F5b caiu na fatia 8 do e2e sem rodar teste (timeout do runner baixando imagem do `ghcr.io`); verde na segunda tentativa, só a fatia que caiu.

## O que decidi sem perguntar
- 23/11 12:28: a correção da D55 (decisão do Joaquim, 22/11 12:55, "corrige a D55 depois da F5b"; `tasks/prd-reserva-e-avaliacao/achado-d55-recusa-rubrica.md`) corre na linha 1 desta spec, durante o PRD, e não em andar próprio: a rubrica antes da aplicação é escopo da F6, uma correção avulsa seguraria a spec até o pouso dela (uma por vez, passo 3), e o par da linha estava ocioso. Seguinte: a F6, primeira pendente do `ROADMAP.md`; a F18, antes dela na ordem da fatia, depende do provedor da VPS, em aberto.
