# Tarefa [N.0] — [título]

**Funcionalidade:** [nome] · **Depende de:** [N.0 ou nenhuma]
**Subagentes obrigatórios:** `...`
**Porte:** pequeno | grande
<!-- test-engineer e revisor-geral são obrigatórios em toda tarefa, marcados ou não.
     O porte diz quanto a tarefa deve levar (criar-tasks, "Porte da tarefa"). -->

## Objetivo

O que esta tarefa entrega, em uma frase. Ao terminar, o que passa a funcionar que antes
não funcionava.

## Contexto necessário

Quem implementa esta tarefa começa com contexto limpo e não participou de nenhuma conversa. Da Tech
Spec e do PRD ele lê só o que estiver apontado aqui, pelo número:

- `techspec.md` seção [n]
- `prd.md` RF[n]
- `.claude/rules/[quais e por quê]`
- Fluxo relacionado em `docs/fluxos.md`, se houver
- Código existente relevante: `caminho/arquivo.ts` — e o que olhar nele

## Subtarefas

- [ ] N.1 —
- [ ] N.2 —
- [ ] N.3 — Testes

## Arquivos previstos

<!-- Caminho de verdade, um por linha (`apps/web/src/…`): é o que diz com quem a tarefa corre em paralelo. -->
| Arquivo | Novo ou alterado |
|---|---|

## Testes que provam a regra

Definidos com o `test-engineer`. Não improvise aqui.

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| caminho feliz | integração | | |
| borda: [caso do domínio] | integração | | |
| permissão: quem não pode | integração | | |
| isolamento entre escolas | integração | | |
| concorrência: [as duas chamadas ao mesmo tempo, com `Promise.all`] | integração | | |
| estados da tela: [carregando, erro, vazio, com dado; o vazio e o "falta" só com a leitura terminada e sem erro; o foco depois de cada ação que troca o que aparece] | e2e | | |
| recomeço da tela: [a segunda pessoa na mesma aba, sem reload; a mesma entrada de novo — mesmo link, mesmo token; a resposta atrasada da entrada anterior, com a resposta segurada no teste (`page.route` ou `page.clock.pauseAt`); a lista recarregada ou a falha com o diálogo aberto] | e2e | | |
| log novo: [a linha capturada] | integração | não leva nome, e-mail, matrícula, token, senha nem código (regra 20, item 9) | |

A coluna "Caso" é de quem implementa, preenchida antes da Mesa: `arquivo › nome do caso`, um por comportamento
da linha. Na X4, 7 das 14 reprovações foram linha sem caso, ou com caso para metade dela.

A linha de concorrência diz **em paralelo**, com as transações abertas juntas, e não "clique duplo".
Foram três reprovações no F1 por prova sequencial: a segunda chamada era recusada por uma leitura
que o service faz antes, e não pela restrição do banco que o teste dizia provar. Se a operação não
pode acontecer duas vezes ao mesmo tempo, apague a linha; se pode, ela é obrigatória.

A linha de recomeço vale para tarefa que cria ou altera tela com sessão, link ou formulário, e leva os
quatro casos — segunda pessoa, mesma entrada, resposta atrasada, e a lista recarregada ou a falha com o
diálogo aberto (o foco, o aviso e o desafio da tentativa anterior saem) — ou diz por que um não se aplica.
Foram nove achados no F1 e três reprovações na A0 (10.0 e 11.0): o cache da pessoa anterior que
nenhum teste provava esvaziar, e o mesmo link colado de novo na aba, que não mudava o estado e
deixava a tela presa com o token na barra. Na A0b foram mais quatro, todas no quarto caso: o foco,
o aviso ou o desafio da tentativa anterior sobrando depois de uma falha ou de a lista recarregar.
A linha de log vale para toda linha de log nova, e sai quando a tarefa não escreve nenhuma: três
recomendações na A0 (7.0, 8.0, 9.0) foram log sem teste do conteúdo.

## Como testar

Até 150 palavras. Quem implementa começa sem contexto e num modelo menor: diga o **como**, não só o
quê.

- Teste a copiar, por cenário que tem precedente: `arquivo › nome do caso`, e o que muda nele
- Peça de apoio: a fixture, o helper ou a fábrica de dados, com o nome da função
- Comando para rodar isolado: `npx vitest run --project integracao <arquivo>` ou
  `node tools/ci/e2e.ts --manter-ambiente e2e/<arquivo>.spec.ts`
- Armadilhas já vistas nesta funcionalidade que valem aqui (do `achados/indice.md` e do `estado.md`)
- Telas (só em tarefa com tela): uma linha por tela que a tarefa cria ou altera, com o papel
  (`coordenacao`, `professora` ou `aluno`), o endereço, o clique que leva ao estado (`text=<aba>`) e o
  mockup de referência, se houver. É a lista que o Implementador e a Mesa fotografam (`tools/vitrine/`)

## Autoconferência

Quem implementa responde cada pergunta **por escrito, no plano**, antes de codar (`executar-task`, passo 2). Pergunta que
não se aplica à tarefa: diga por quê, em meia linha. O `test-engineer` é quem mais reprova, e cada reprovação custa uma
rodada nova; o caso que originou cada pergunta está em `docs/processo-licoes.md`.

1. **Qual é a mutação de cada cláusula?** Liste cada cláusula que o diff acrescenta — condição de `where`, `if` de guarda,
   `catch` que traduz erro, restrição ou índice de migration, trava de clique, cada termo de uma condição composta
   (`a && b && c` são três) — e, na tela, a condição que mostra ou esconde um pedaço do JSX, cada efeito (o foco devolvido,
   a medida gravada com `style.setProperty`, a guarda dele) e o id dentro de uma `queryKey`. Inclua as cópias da mesma regra
   em outro arquivo e as que entram depois, para atender um revisor. Cada uma ganha um bloco na seção "Mutações"; bloco cujo
   teste continua verde reprova o portão: falta o teste, e não o bloco. Trava se prova pelo efeito (dois registros), não
   pela espera.
2. **O texto que você põe na tela já aparece nela?** Procure o texto novo em `e2e/` (`grep -rln '<texto>' e2e/`) e rode
   isolados os specs que o contam (`toHaveCount`, `nth`): o portão só puxa os specs que citam texto **removido**.
3. **O cenário tem o segundo dado que torna a cláusula observável?** Se o repository filtra por turma, aluno em **duas**
   turmas; se filtra por estado, vínculo em cada estado; se lê `inatividadeMin`, escola com valor **diferente** do padrão.
   Apagar a cláusula tem de deixar algo vermelho.
4. **Alguma checagem anterior responde antes da regra sob teste?** A rota cai em `requireAnoEmCurso()`, o e-mail não acha
   ninguém: o teste fica verde pelo motivo errado. Percorra o caminho até a linha que interessa e confirme que o cenário
   chega nela.
5. **A asserção olha o resultado, ou a forma do código?** Asserção sobre texto de arquivo, nome de função ou lista vazia
   passa igual se a regra ler o campo errado. Compare o que o usuário obtém.
6. **A guarda nova (regra de lint, teste estrutural, trava de pasta) tem fixture de quem a contorna, e falha quando o alvo
   some?** Uma fixture e o teste vermelho para cada forma de escrever o mesmo que a regra conhece (reexportação,
   `import *`, `import()` e `require`, o caminho como texto em outra posição, alias). A cerca sobre arquivo que mudou de
   lugar reprova, e não se cala; o `ignore` da configuração tem caso que prova que não esconde o real.
7. **Algum comentário, docblock ou nota da tarefa afirma o que o código não faz?** Neste repositório a regra do módulo mora
   no comentário: quem lê "e só elas" conclui que o caso está barrado, e o próximo a mexer "corrige" o código pelo comentário.
8. **A divergência que você vai registrar cria ou muda uma regra, e a coluna "Onde está na spec" diz a verdade?** Uma trava
   nova, um subcomando a mais sob a mesma conferência, uma gravação nova numa rota sem sessão: antes do código, a
   divergência ganha a sua linha na tabela de testes e a resposta do guardião que ela toca (quem chama sem autenticação,
   quantas vezes por segundo, o que grava a cada vez). Antes da primeira rodada, abra cada lugar que a coluna cita e ache lá
   a decisão, com a palavra do código; se a decisão muda algo que mais de um documento descreve, procure o termo antigo em
   todos de uma vez, com `grep`. Subtarefa de busca ou de commit à parte só fica `[x]` com a prova no documento: a saída do
   `grep` (vazia, ou cada linha justificada) e o hash do commit de caracterização.
9. **Qual peça que já existe faz isto?** Procure em `apps/api/src/sessao/` e em `packages/core/` antes de escrever.
   Reaproveite importando; se a peça está no lugar errado para dois módulos, mova-a para arquivo próprio ou para o
   `nucleo`, nesta tarefa, e não copie.
10. **A operação que pode acontecer duas vezes ao mesmo tempo tem teste com as duas chamadas em paralelo (`Promise.all`), e
    a corrida entre duas operações diferentes, ou a resposta que chega fora de ordem, tem a ordem forçada?** No banco,
    `GatilhoDeParada` e `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`); na tela, a resposta segurada com
    `page.route` ou o relógio parado com `page.clock.pauseAt`, como a correção `2026-10-03-decididos-continuam-marcados`.
    `Promise.all` solto prova a ordem que sair, e vira intermitente no banco carregado da esteira.
11. **O teste de isolamento quebraria sem a cláusula de escopo do repository, e cada linha da tabela de testes tem o caso na
    coluna "Caso", um para cada coisa que a linha diz?** Remova mentalmente a cláusula e pergunte se algo ficaria vermelho.
    "Fecha e volta", "em endereço, cabeçalho ou corpo" são dois ou três casos, ou asserções que o nome do caso diz: na X4, a
    1.0, a 2.0, a 5.0, a 8.0, a 9.0 e a 10.0 reprovaram por linha sem caso ou com metade.
12. **Onde o plano atende cada item de "O que verificar" dos guardiões marcados (`.claude/agents/<nome>.md`), e o que o
    `achados/indice.md` já diz?** Se `tasks/prd-<funcionalidade>/achados/indice.md` existe, leia: é uma linha por rodada com
    o que os revisores já exigiram. Abra o bloco inteiro (`achados/<N>_task.md`) só das linhas que tocam o que você vai
    mexer; o corpo todo passa de 600 KB por funcionalidade e não cabe na janela.

## Fora do escopo desta tarefa

O que pertence a outra tarefa e não deve ser implementado aqui.

## Divergências resolvidas nesta tarefa

Preenchida por quem implementa (`executar-task`, passo 2). Uma linha por decisão que se afasta da
Tech Spec, do `cenarios.md` ou da subtarefa. A coluna "Onde está na spec" é preenchida **antes dos
revisores**: divergência sem ela está só na tarefa, e o `revisor-geral` reprova (foram quatro
reprovações na A1). Sem nenhuma, escreva "nenhuma".

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

Preenchida por quem implementa (`executar-task`, passo 2): um bloco por cláusula que o diff
acrescenta, inclusive as que a tabela de testes não cita e as cópias da mesma regra em outro arquivo.
O portão da tarefa aplica cada bloco, roda o teste citado e exige vermelho. Linha com `-` sai, com
`+` entra, com espaço é contexto. Cláusula que só vale no celular leva a linha `projeto: celular` depois de
`teste:` (só em teste de e2e; sem ela o caso roda no `chromebook`). Sem cláusula nova, escreva "nenhuma".

```mutacao
arquivo: [caminho do arquivo que tem a cláusula]
teste: [caminho do teste] › [nome do caso]
  [linha de contexto, que fica]
- [a cláusula que sai]
```

## Recomendações sem aplicar

Recomendação de revisor que não foi aplicada, com destino: `TODO.md`, a tarefa que toca o arquivo,
ou recusada com o motivo. Destino `TODO.md` é a linha já escrita no `TODO.md`, no commit da tarefa, e
não promessa. "Anularia as aprovações" não é motivo (`executar-task`, passo 5). Sem nenhuma, escreva
"nenhuma".

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|

<!-- A seção "Revisões" é criada no fim deste arquivo pelo hook tools/processo/revisoes.ts,
     quando o primeiro revisor termina, e o que os revisores exigem vai para
     achados/<este arquivo>, resumido em achados/indice.md. Não escreva nenhum dos três à mão
     e não acrescente seção depois de "Revisões". -->

