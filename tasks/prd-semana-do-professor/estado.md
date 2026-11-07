# Estado da execução — semana-do-professor

## Agora
- **Pausa** de 16:30 a 20:20 (06/11), a pedido do Joaquim; os três Implementadores reiniciados com `PEDIDO de retomada` às 20:20, vigia religada.
- **Espero:** linha 1: ociosa (8.0 encontrada). Linha 2: ociosa; nada a partir (só 7.0 e 8.0 restam). Linha 3: o da 7.0 (porte grande, 1ª tentativa), pedida às ~23:10 ao par reiniciado
- **Devo ainda:** No fechamento, escrever no `TODO.md` os quatro destinos da ordem r1 da 1.0 que ninguém escreveu (`.processo/ordens/1_task-r2.md` da linha 1): volume do `delete` no encerramento do ano (Infra e operação), reserva do expurgo da `aula` (LGPD e conformidade), rótulo "Registro da aula" em `Retencao.tsx` (para o Validador), S7 do `cenarios.md` (para a retro). Correção `carga-da-semana` na próxima linha ociosa **com a máquina calma** (é medida de k6): o `TODO.md` (2.0) dava à 6.0 o `GET /v1/semana` no cenário de carga das 7h30, e ela não fez nem revisor cobrou (relatório do Implementador 3).
- **Base:** `spec/semana-do-professor` em `69a98f27` (encontro da 8.0). Esteira: verde em `5e6da27`; a de `69a98f2` roda: ler no próximo encontro

## Concluídas
- 8.0 (linha 1), 07/11 ~00:50: `237648ea`, uma tentativa e uma divergência de desenho (opção (a) do Arquiteto, techspec §9 e cenarios T5/T6 no commit); os sete revisores aprovaram na 2ª rodada. A Semana com itens só foi vista pelo e2e: a vitrine não tem grade (no `TODO.md`).
- 5.0 (linha 2), 07/11 ~00:00: `0328c254`, uma tentativa; test-engineer e revisor-geral aprovaram na 2ª rodada, os outros na 1ª. Três destinos novos no `TODO.md`; a constante única do 55P03 (TODO da 4.0) segue aberta, porque a ordem mandou não ampliar.
| Tarefa | Commit | Modelo | Rodadas | Observação |
|---|---|---|---|---|
| 1.0 | `7732c208` | Sonnet 5.5 | 2 | antes, a correção `base-fixa-acima-do-limite` (`8ca3d1da`) por `DIVERGÊNCIA` de portão |
| 2.0 | `63b88c11` | Sonnet 5.5 | 2 | esteira verde em `63fc7f1`; depois dela, abertas as linhas 2 e 3 |
| 3.0 | `c37cba8e` | Sonnet 5.5 | 2 | linha 1; encontro na 2ª tentativa (a 1ª caiu por prazo da máquina, load 20); spec em `0cd5dd46` |
| 4.0 | `71738c89` | Sonnet 5.5 | — | linha 2; CONFLITO no encontro, correção `encontro-4-semana` (`c3101bb9`); spec em `16df7293` |
| 6.0 | `346fc1f6` | Sonnet 5.5 | 2 | linha 3; DIVERGÊNCIA de desenho (`DaySelector`, Joaquim escolheu A); encontro na 2ª tentativa (a 1ª caiu por prazo, load 14); spec em `803eef9a`; não fez o item de carga do `TODO.md` (2.0) |
| correção `e2e-conflito-do-gerar` | `055464f7` | Sonnet 5.5 | 2 | linha 1; e2e dependia da releitura de 15 s; encontro na 2ª tentativa (a 1ª caiu por prazo, load 25), refeito com prazo de 540 s; spec em `fd031679` |

## Esperando o Joaquim

## 06/11/2026 ~16:40 — F2b tarefa 6.0 (linha 3)
Decisão: no celular, a aba Semana mostra os dias com qual peça, já que o `SegmentedControl` da techspec §9 vai só até 4 opções e a semana tem de 5 a 7 dias?
Contexto: `.processo/ordens/divergencia-6.md`, no checkout da linha 3. RF12 e T9 não mudam em nenhuma opção; muda o desenho e o catálogo.
Opções: A) peça nova `DaySelector` no catálogo (`components/ui`, linha na interface 10.2, galeria) | B) avançar e voltar dia a dia com `Button`, sem peça nova | C) abrir o `SegmentedControl` para até 7
Recomendo: A, porque mostra a semana inteira em botões, como o RF12 pede, e a peça volta a servir no calendário e no aluno.
**Respondida em 06/11/2026 ~16:55: o Joaquim escolheu A** (no terminal do Arquiteto, confirmado no do Orquestrador). O Arquiteto reescreveu a §9 sem commit; vai no commit da 6.0, com a linha do `DaySelector` na interface 10.2.
Seguem sem depender: a 3.0 (linha 1) e a 4.0 (linha 2), que são de API e não tocam a §9. A vigia continua ligada. A pergunta está aberta na sessão do Arquiteto, que não deve ser reiniciada até a resposta.
## O que falhou
- 07/11 ~00:48, encontro da 8.0: VERIFICAÇÃO RECUSADA por estouro dos 180 s (carga 16, linha 3 em e2e); o 2º passou. É a segunda vez na noite: o prazo fixo do `linhas.ts encontro` não aguenta a máquina com outra linha testando.
- 07/11 ~00:00, encontro da 5.0: 1º RECUSADO porque o andar tinha a techspec §9 e o cenarios T5 sem commit (a triagem da divergência da 8.0) e a 5.0 mexia nos mesmos arquivos; descartei a cópia do andar, que a linha 1 já tinha. 2º: VERIFICAÇÃO RECUSADA por estouro dos 180 s com carga 18 (linhas 1 e 3 em e2e), depois de a mesma verificação passar; o 3º passou. Para a retro: a edição sem commit do Arquiteto no andar trava o encontro de outra linha, e o prazo fixo da verificação cai com a máquina cheia.
- 06/11 ~21:55: o encontro da 4.0 (linha 2, `71738c89`, aprovada pela Mesa) deu CONFLITO em `packages/core/src/index.ts`, que a 3.0 também mexeu. Correção `encontro-4` na linha 2
- 06/11 ~14:40: na 1.0, o portão parou em `tools/processo/harness/base-fixa.test.ts`: a base fixa tem 40.006 B, acima de 40.000 B, desde a D87 (`8d624453`, nesta branch). Não vem da tarefa
## O que decidi sem perguntar
- 06/11 ~23:20: o encontro da correção `e2e-conflito-do-gerar` (linha 1) caiu por prazo com load 25 (mutações da linha 2); tipagem passou, o lint foi morto. Refiz com `EDUCA_ENCONTRO_PRAZO_DA_VERIFICACAO_MS=540000`: mesma verificação, só mais tempo, e passou. Para a retro: o prazo fixo de 180 s cai toda vez que outra linha roda mutação; é o terceiro encontro recusado por máquina hoje
- 06/11 ~23:22: a linha 1 levou a 8.0, e não a correção `carga-da-semana`: com load 25 a medida do k6 não vale. A correção fica em "Devo ainda", para a primeira linha ociosa com a máquina calma
- 06/11 ~22:55: encontro da 6.0 (linha 3) recusado por prazo com load 14 (e2e da linha 1 rodando); repito quando a carga cair, como no da 3.0. A pendência de carga da 6.0 vira correção `carga-da-semana` numa linha ociosa, sem segurar a 7.0. Para a retro: dono de item do `TODO.md` posto numa tarefa não chega aos revisores dela
- 06/11 ~22:48: o Implementador 2 deixou o `TODO.md` e o documento da `encontro-4-semana` sem commit depois do encontro; o commit deles (`f64232d9`) deixou a linha com commit que a spec não tinha, e o `linhas.ts` recusou a partida ("falta o encontro") e o encontro ("sem trabalho em curso"). Como era só documento, juntei à mão no andar da spec (`git merge --no-ff`, `5b43da40`, push). Para a retro: o `linhas.ts` não tem caminho para commit depois do encontro
- 06/11 ~22:05: DIVERGÊNCIA de portão na correção `encontro-4` (doc `tasks/correcoes/encontro-4-semana.md`): `tools/renomear/restos.test.ts:350` pega o nome `Linha` em `apps/api/test/semana-itens.int.test.ts:41`, da 3.0, já vermelho na spec. Mandei corrigir dentro da própria `encontro-4`, porque o merge em curso não deixa commit separado e o resto entra com ele. Para a retro: a 3.0 entrou na spec com o portão vermelho nesse teste. A linha 1 vai bater nele também até o encontro da 4.0
- 06/11 ~21:25: o encontro da 3.0 (linha 1, `c37cba8e`) deu VERIFICAÇÃO RECUSADA por prazo (tipagem e lint passaram de 180 s com load 20 em 12 núcleos, por causa da mutação da linha 3). A spec não tinha andado desde `b388f260`, então não havia o que consertar: em vez da correção `encontro-3`, repito o encontro quando a carga cair. Se cair de novo por prazo com a máquina calma, aí é correção. Refeito às 21:25 com load 8: passou.
- 06/11 12:12: abri a F2b, e não a F2c, embora o `estado.ts` sem nome escolha a F2c (que já tem PRD e Tech Spec): o Joaquim pediu "depois do pouso já abre a F2b", e ela é a primeira pendente do roadmap
- 06/11 ~14:40: `DIVERGÊNCIA` de portão na 1.0 (base fixa 6 B acima do limite pela D87): correção `base-fixa-acima-do-limite` na linha 1, pelo Implementador reiniciado, enxugando o `CLAUDE.md` sem subir o limite; guardiões só os de sempre (documento de processo)
