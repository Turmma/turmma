# Estado da execução — semana-do-professor

## Agora
- **Pausa** de 16:30 a 20:20 (06/11), a pedido do Joaquim; os três Implementadores reiniciados com `PEDIDO de retomada` às 20:20, vigia religada.
- **Espero:** linha 1: o `RELATÓRIO` da correção `e2e-conflito-do-gerar` (esteira vermelha em `b388f260`, execução 42277176677, e2e `acesso-da-turma.spec.ts:972`), pedida às 21:30; a esteira de `0cd5dd46` (execução 42318323952) ainda roda, ler no próximo encontro; linha 2: o da correção `encontro-4` (o encontro da 4.0, `71738c89`, deu CONFLITO em `packages/core/src/index.ts` com a 3.0), pedida às ~21:55 ao par reiniciado; linha 3: o da 6.0 (as três de porte grande, 1ª tentativa), pedidas em 06/11 ~16:10. A 6.0 parou em DIVERGÊNCIA de desenho (SegmentedControl da seção 9 da techspec × interface.md 10.2 e R3); parada respondida (A, `DaySelector`); retomada pedida ao Implementador 3, reiniciado, com a techspec §9 atualizada pelo Arquiteto sem commit no checkout da linha 3
- **Devo ainda:** no fechamento, escrever no `TODO.md` os quatro destinos da ordem r1 da 1.0 que ninguém escreveu (`.processo/ordens/1_task-r2.md` da linha 1): volume do `delete` no encerramento do ano (Infra e operação), reserva do expurgo da `aula` (LGPD e conformidade), rótulo "Registro da aula" em `Retencao.tsx` (para o Validador), S7 do `cenarios.md` (para a retro).
- **Base:** `spec/semana-do-professor` em `0cd5dd46`

## Concluídas
| Tarefa | Commit | Modelo | Rodadas | Observação |
|---|---|---|---|---|
| 1.0 | `7732c208` | Sonnet 5.5 | 2 | antes, a correção `base-fixa-acima-do-limite` (`8ca3d1da`) por `DIVERGÊNCIA` de portão |
| 2.0 | `63b88c11` | Sonnet 5.5 | 2 | esteira verde em `63fc7f1`; depois dela, abertas as linhas 2 e 3 |
| 3.0 | `c37cba8e` | Sonnet 5.5 | 2 | linha 1; encontro na 2ª tentativa (a 1ª caiu por prazo da máquina, load 20); spec em `0cd5dd46` |

## Esperando o Joaquim

## 06/11/2026 ~16:40 — F2b tarefa 6.0 (linha 3)
Decisão: no celular, a aba Semana mostra os dias com qual peça, já que o `SegmentedControl` da techspec §9 vai só até 4 opções e a semana tem de 5 a 7 dias?
Contexto: `.processo/ordens/divergencia-6.md`, no checkout da linha 3. RF12 e T9 não mudam em nenhuma opção; muda o desenho e o catálogo.
Opções: A) peça nova `DaySelector` no catálogo (`components/ui`, linha na interface 10.2, galeria) | B) avançar e voltar dia a dia com `Button`, sem peça nova | C) abrir o `SegmentedControl` para até 7
Recomendo: A, porque mostra a semana inteira em botões, como o RF12 pede, e a peça volta a servir no calendário e no aluno.
**Respondida em 06/11/2026 ~16:55: o Joaquim escolheu A** (no terminal do Arquiteto, confirmado no do Orquestrador). O Arquiteto reescreveu a §9 sem commit; vai no commit da 6.0, com a linha do `DaySelector` na interface 10.2.
Seguem sem depender: a 3.0 (linha 1) e a 4.0 (linha 2), que são de API e não tocam a §9. A vigia continua ligada. A pergunta está aberta na sessão do Arquiteto, que não deve ser reiniciada até a resposta.
## O que falhou
- 06/11 ~21:55: o encontro da 4.0 (linha 2, `71738c89`, aprovada pela Mesa) deu CONFLITO em `packages/core/src/index.ts`, que a 3.0 também mexeu. Correção `encontro-4` na linha 2
- 06/11 ~14:40: na 1.0, o portão parou em `tools/processo/harness/base-fixa.test.ts`: a base fixa tem 40.006 B, acima de 40.000 B, desde a D87 (`8d624453`, nesta branch). Não vem da tarefa
## O que decidi sem perguntar
- 06/11 ~22:05: DIVERGÊNCIA de portão na correção `encontro-4` (doc `tasks/correcoes/encontro-4-semana.md`): `tools/renomear/restos.test.ts:350` pega o nome `Linha` em `apps/api/test/semana-itens.int.test.ts:41`, da 3.0, já vermelho na spec. Mandei corrigir dentro da própria `encontro-4`, porque o merge em curso não deixa commit separado e o resto entra com ele. Para a retro: a 3.0 entrou na spec com o portão vermelho nesse teste. A linha 1 vai bater nele também até o encontro da 4.0
- 06/11 ~21:25: o encontro da 3.0 (linha 1, `c37cba8e`) deu VERIFICAÇÃO RECUSADA por prazo (tipagem e lint passaram de 180 s com load 20 em 12 núcleos, por causa da mutação da linha 3). A spec não tinha andado desde `b388f260`, então não havia o que consertar: em vez da correção `encontro-3`, repito o encontro quando a carga cair. Se cair de novo por prazo com a máquina calma, aí é correção. Refeito às 21:25 com load 8: passou.
- 06/11 12:12: abri a F2b, e não a F2c, embora o `estado.ts` sem nome escolha a F2c (que já tem PRD e Tech Spec): o Joaquim pediu "depois do pouso já abre a F2b", e ela é a primeira pendente do roadmap
- 06/11 ~14:40: `DIVERGÊNCIA` de portão na 1.0 (base fixa 6 B acima do limite pela D87): correção `base-fixa-acima-do-limite` na linha 1, pelo Implementador reiniciado, enxugando o `CLAUDE.md` sem subir o limite; guardiões só os de sempre (documento de processo)
