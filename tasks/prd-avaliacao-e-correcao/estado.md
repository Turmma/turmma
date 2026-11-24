# Estado da execução — avaliacao-e-correcao

## Agora
- **Espero:** linha 1 (`Implementador` e `Mesa`) na **7.0** (porte grande, partida 23/11 depois do encontro da correção explain), 1ª tentativa. Linha 2 (`Implementador 2` e `Mesa 2`) na **5.0** (porte grande, partida 23/11 depois do encontro da 10.0), 1ª tentativa. Linha 3 (`Implementador 3` e `Mesa 3`, aberta às ~22:30) na **3.0**, 1ª tentativa.
- **Devo ainda:** No fechamento da F6, levar ao `TODO.md` a alternativa C do diagnóstico d55 (rubrica pelo cartão da ferramenta, sem conversa livre e sem modelo) como requisito do PRD da F7 mínima, por pedido do Arquiteto 2 com a decisão do Joaquim. No fechamento, levar também ao `TODO.md` as duas linhas de "Recomendações sem aplicar" de `tasks/correcoes/2026-11-23-explain-semana-itens.md` (regex sem `ano_letivo_id`; regra no lugar da lista de nomes); as outras duas vão para a retro.
- **Base:** `spec/avaliacao-e-correcao` em `4876cb1f` (encontro da correção explain); esteira VERMELHA em `5e4d786` (execução 45308060223, o mesmo EXPLAIN, anterior à correção), execução nova rodando em `4876cb1`
- **Decidido (23/11), aviso fixo da coluna "Saiu da aba":** o Joaquim aprovou, nesta conversa, o texto proposto em `cenarios.md` §4, sem mudança.

## Concluídas
| Tarefa | Commit | Modelo | Rodadas | Observação |
|---|---|---|---|---|
| 2.0 (linha 1) | `aee849ff` → spec `bdd0936d` | Sonnet | 2 (`test-engineer` reprovou na 1ª) | encontro 23/11, verificação verde |
| 1.0 (linha 2) | `cb79a2c2` → spec `8778bddb` | Sonnet | 3 (divergência de desenho na 2ª; BLOQUEIO do Arquiteto; o Joaquim escolheu A, a exceção do art. 18 no arquivo do titular) | encontro 23/11 ~17:35, verificação verde |
| correção d55-recusa-rubrica (linha 1) | `b448df3d` → spec `84852d06`; "Resto aceito" reescrito pelo Arquiteto, itens 3 e 4 em `5ec3577d` e item 1 em `6c187bd3` | Sonnet | 3 (escalada na 2ª; diagnóstico do Arquiteto 2; alternativa A do Joaquim) | encontro 23/11 ~15:40, verificação verde; esteira verde em `b9dd235` (execução 45219624849) antes deste push |
| 10.0 (linha 2) | `f860fc60` → spec `5e4d7867` | Sonnet | 2 (sete revisores aprovaram na 2ª) | encontro 23/11, verificação verde; seis itens da Mesa no `TODO.md`; "Mudar a janela da prova" e o painel da prova ficam para a Validação |
| correção explain-semana-itens (linha 1) | `89884d98` → spec `4876cb1f` | Sonnet | 3 (`revisor-geral` reprovou na 2ª, aprovou na 3ª) | encontro 23/11, verificação verde; esteira vermelha de `5e4d786` é o mesmo EXPLAIN, anterior à correção |

## Esperando o Joaquim
## 23/11 16:25 — 1.0 (linha 2), BLOQUEIO do Arquiteto na divergência da 2ª rodada — RESPONDIDA (23/11 ~17:05, no terminal do Arquiteto): A, os dois entram na versão `coordenacao` por exceção declarada (art. 18); PRD, Tech Spec, cenarios.md e docs/lgpd.md editados pelo Arquiteto na linha 2, sem commit, vão no commit da 1.0
Decisão: o arquivo do titular na versão `coordenacao` (aluno sem conta ativa, baixado pela coordenação para entregar a ele) leva o tempo adicional e a contagem de saídas da aba?
Contexto: o PRD §4, o RF9 e o §5 dizem que a coordenação não vê nenhum dos dois, e a saída da aba toca a regra 70, item 7 (D70). É o único caminho do art. 18 para esse titular; a F3 abriu a mesma exceção para a conversa do Tutor. Arquivo: `.processo/ordens/divergencia-1_task-r2.md`, no checkout da linha 2.
Opções: A — as duas, por exceção declarada no PRD, como a conversa do Tutor na F3 | B — as duas fora | C — tempo adicional dentro, saída da aba fora
Recomendo: A, a do Arquiteto e do Implementador: o argumento da F3 vale inteiro, com dado menos sensível (contagem por prova, sem horário; tempo adicional sem quem concedeu), e só sob pedido, auditado.
Segura a 1.0 e, com ela, toda a F6: 2.0 e 10.0 esperam a 1.0. Vigia desligada. A pergunta está no terminal do Arquiteto (linha 2): não reiniciar.
## 23/11 15:45 — correção d55-recusa-rubrica (já na spec), o item 3 do "Resto aceito" passa do limite aceito — RESPONDIDA (23/11, nesta conversa): fica; o Arquiteto reescreve o item 3 (e o 4) com o caso real
Decisão: o texto de aluno longo que traz "turma", "série" ou "nível" chega ao modelo com a conferência da saída ligada. Fica assim, ou abre correção para voltar a recusá-lo?
Contexto: você aceitou um resto de até 120 caracteres. A conformidade achou na 3ª rodada um texto de aluno de 271 caracteres que o HEAD recusava e agora passa, porque essas palavras zeram a contagem. Aprovou, e o documento diz, errado, que esses textos eram "recusados por outra marca". Arquivo: `.processo/ordens/2026-11-23-d55-recusa-rubrica-r3.md` e "Resto aceito" em `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`.
Opções: fica — o Arquiteto reescreve o item 3 com o caso real, e a alternativa C na F7 mínima fecha o furo | corrige — nova correção na linha 1 que recusa o trecho acima de 120 caracteres mesmo com essas palavras, sob risco de recusar de novo os pedidos 3 e 4 do achado
Recomendo: fica. A barreira declarada (a conferência da saída) está ligada nesse caso, o modelo é o Ollama local até a F5c, e a C resolve a separação de verdade.
Não segura nada: a 1.0 corre na linha 2, e a linha 1 fica ociosa até a 1.0 se encontrar.
## 23/11 13:42 — correção d55-recusa-rubrica (linha 1), BLOQUEIO do Arquiteto 2 — RESPONDIDA (23/11 14:54, no terminal do Arquiteto 2): alternativa A, a conferência da saída como barreira declarada e o resto de até 120 caracteres aceito; C vai para o PRD da F7 mínima
Decisão: aceitar a alternativa A (a conferência da saída como barreira declarada, com um resto aceito por escrito) ou B (recusar de novo os pedidos 3 e 4 do achado)?
Contexto: pelo vocabulário não se separa um enunciado curto entre aspas de uma resposta de aluno do mesmo tamanho; o HEAD também deixava passar texto de aluno curto, sem conferência da saída. Arquivo: `.processo/ordens/diagnostico-d55-recusa-rubrica.md`, no checkout da linha 1.
Opções: A — todo pedido de rubrica de redação ou discursiva com dois-pontos ou aspas liga a conferência da saída; um trecho livre de até 120 caracteres passa ao modelo, aceito por escrito | B — esse pedido volta a ser recusado, como no HEAD; a rubrica de redação escrita naturalmente continua recusada
Recomendo: A, e C (rubrica pelo cartão da ferramenta, sem conversa livre) como requisito no PRD da F7 mínima: A fecha o furo que o HEAD tinha e cumpre a rubrica que a D55 permite.
Segura só a correção. A F6 não depende dela: a 1.0 parte às 14:10 em outra linha, porque a linha 1 está com a correção na árvore.
- **(23/11 13:44) Antes da 12.0 (tela do aluno)** — APROVADO pelo Joaquim (23/11, nesta conversa), sem mudança: o texto do Enviar com 503, novo, em `cenarios.md` §4: "Não deu para enviar agora. Suas respostas estão guardadas; tente de novo em instantes. O tempo da queda volta para você." Não trava nada antes da tela.
- **(23/11 13:30) Push da `develop`** — RESPONDIDA: "agora"; push feito (`23761ad6..88192a63`): a retro da F5b (`88192a63`) está na `develop` local, sem push; perguntei se faço agora ou no próximo pouso.

## O que falhou
- 23/11 12:28: a esteira da `develop` no pouso da F5b caiu na fatia 8 do e2e sem rodar teste (timeout do runner baixando imagem do `ghcr.io`); verde na segunda tentativa, só a fatia que caiu.

## O que decidi sem perguntar
- 23/11 15:40: a correção d55 começou às 12:28, antes do quadro das linhas, e por isso ficou fora dele; registrei-a à mão em `.processo/linhas.json` (linha 1, `correcao`, desde 12:28) e o encontro passou.
- 23/11 12:28: a correção da D55 (decisão do Joaquim, 22/11 12:55, "corrige a D55 depois da F5b"; `tasks/prd-reserva-e-avaliacao/achado-d55-recusa-rubrica.md`) corre na linha 1 desta spec, durante o PRD, e não em andar próprio: a rubrica antes da aplicação é escopo da F6, uma correção avulsa seguraria a spec até o pouso dela (uma por vez, passo 3), e o par da linha estava ocioso. Seguinte: a F6, primeira pendente do `ROADMAP.md`; a F18, antes dela na ordem da fatia, depende do provedor da VPS, em aberto.
