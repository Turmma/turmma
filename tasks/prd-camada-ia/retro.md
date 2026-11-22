# Retrospectiva — camada-ia (F5a)

22/11/2026, pelo Arquiteto 2, no térreo, depois do pouso (`56779010`), ao lado da F5b (D86). **Completa** (D86): a taxa caiu
(8,4% contra 14,4% da F4b), mas duas causas se repetiram (o teste que passa sem montar o caso, quatro reprovações; e a rodada
devolvida pela linha de guardiões, dez devoluções). Comparação com a retro da F4b (`tasks/prd-classificacao-bncc/retro.md`).

O que pesa nos números: 8 tarefas em três linhas (L1: 3.0, 5.0, 8.0; L2: 1.0, 2.0, 4.0, 7.0, 6.0; L3 e a L1 nas folgas: as
correções), todas com Sonnet; antes e ao lado das tarefas, as seis correções de processo que a retro da F4b aceitou. O corte em
F5a e F5b (resposta do Joaquim em 21/11, 13:48) deixou aqui as tarefas 1.0 a 8.0; a 9.0 a 13.0 são a F5b.

## Medidas

```
Tarefas: 8 · Rodadas de revisor: 83 · Reprovações: 7 (8,4%)
  (sem a rodada da conferência das tarefas que o hook gravou no 6_task.md, 20/11 23:23; com ela, 8 de 84, 9,5%)
Por revisor: test-engineer 16/5 · revisor-geral 16/2 · tenancy-guardian 11/0 · privacy-guardian 11/0 · conformidade-reviewer 11/0
             infra-guardian 11/0 · frontend-reviewer 5/0 · llm-integrator 2/0
Por modelo do implementador: Sonnet nas 8; 10,4 rodadas e 0,9 reprovação por tarefa; nenhum diagnóstico do Arquiteto (a escalada
  da 6.0 era falsa: contava a conferência das tarefas, e o Orquestrador a destravou); 2 divergências triadas pelo Arquiteto
  (7.0 ordem, mal-entendido; 8.0 desenho, detalhe registrado na Tech Spec); 11 devoluções da Mesa (grupo B e C)
Rodadas por tarefa: média 10,4; piores 7.0 e 8.0 com 14
Rodadas que caducaram sem reprovação: 23 de 83 (28%)
Correções fora de tarefa: 14 com commit — 6 de processo, planejadas pela retro da F4b (M2 e M4 da X6, M2 da F4, M1, M3+M4 e M5 da
  F4b); 8 da esteira ou de defeito (o teto da integração, as rotas fora da lista, o tutor-modelo, as duas limpezas do e2e, o E3 e
  o W4 no celular, o censo perto do prazo). 129 rodadas nelas, 12 reprovações, todas do test-engineer ou do revisor-geral
Duração: andar 20/11 21:52; PRD 22:10; Tech Spec 22:33; revisão da spec 22:33 → 22:59 (26 min); tarefas 23:23 (PRD → tarefas em
  1 h 13); construção do pedido da 1.0 (00:32 de 21/11) ao commit da 8.0 (23:41), 23 h 09, com o PC desligado às ~08:40 (16
  arquivos com 0 byte na L1, restaurados), o reinício das ~11:20 e a parada pedida pelo Joaquim (16:06 → 19:07); validação r1
  00:22 de 22/11; pedido de pouso 01:40; pouso ~09:45, por git (grupo F)
Revisão da spec: 6 rodadas, 27 vereditos, 19 não aprovados (17 REPROVADO, 2 AJUSTES), em 26 min
Validação: r1 APROVADA, 0 crítico, 0 maior, 5 menores
```

Como contei: a seção "Revisões" dos oito `N_task.md` contra o `achados/indice.md`, por (documento, revisor, fim): nenhuma rodada do
índice falta na seção (o grupo F da F4b não voltou: a M2 da X6 pousou antes das tarefas). O pedido de cada tarefa pela primeira
mensagem `PEDIDO de Orquestrador … Tarefa:` nas sessões das linhas (`…speccamada-ia--l1`, `--l2`, `--l3`), em UTC, convertida para
-03. As devoluções, pelas mensagens `DEVOLUÇÃO de Mesa` nas mesmas sessões. A esteira por `gh run list --branch spec/camada-ia`.

| | F3 | X8 | F2 | F2b | F2c | F4 | X6 | F4b | F5a |
|---|---|---|---|---|---|---|---|---|---|
| Tarefas | 20 | 13 | 16 | 8 | 19 | 12 | 14 | 13 | 8 |
| Reprovações nas tarefas | 22,9% | 15,2% | 15,4% | 2,2% | 12,6% | 11,3% | 10,1% | 14,4% | **8,4%** |
| Rodadas por tarefa | 11,8 | 11,6 | 12,2 | 11,3 | 13,4 | 14,8 | 14,1 | 13,4 | **10,4** |
| Caducadas sem reprovação | 34% | 30% | 33% | 41% | 39% | 44% | 41% | 35% | **28%** |
| Correções fora de tarefa | 9 | 26 | 13 | 4 | 25 | 10 | 16 | 9 | **14** (6 planejadas) |
| Crítico ou maior no 1º /validar | 1 c, 2 M | 1 c (+1 c) | 2 c | 1 M | 1 c, 2 M | 1 M | nenhum | 2 M | **nenhum** |
| Tarefas sem nenhuma reprovação | 1 de 20 | 1 de 13 | 1 de 16 | 6 de 8 | 3 de 19 | 2 de 12 | 4 de 14 | 0 de 13 | **1 de 8** |
| Rodadas da revisão da spec (não aprovadas) | — | 29 (21) | 35 (27) | 19 (13) | 17 (11) | 28 (21) | 31 (18) | 29 (20) | **27 (19)** |

## As cinco medidas da D79

**1. Do pedido ao commit.** Mediana de **112 min**, contra 163 na F4b, 145 na X6 e 99 no F3. Por tarefa: 2.0 (89), 1.0 (95),
5.0 (97), 4.0 (104), 3.0 (120), 8.0 (125), 7.0 (142, a divergência de ordem), 6.0 (773 de parede: o reinício do PC, as três
horas da parada, três portões que caíram pela duração do caso da Governança, 20 s contra 15, e a escalada falsa).

**2. Tarefas sem reprovação.** **1 de 8** (a 2.0), contra 0 de 13 na F4b. Cinco das sete reprovaram só no `test-engineer`, e as
outras duas só no `revisor-geral`, as duas pela divergência registrada na spec (grupo C).

**3. O grupo A (cláusula sem prova).** **2** (7.0, o `find` sem bloco; 6.0, o bloco que ficava vermelho pelo `parse` do esquema e
não pela asserção), contra 7 na F4b e 4 na X6. O `and(` de várias linhas (M4 da X6) não voltou.

**4. Vermelhos da esteira por push.** 58 execuções: **11 verdes, 7 vermelhas, 40 canceladas** por push mais novo. **Nenhuma só no
`verificar`** (eram 14 na F4b: a M3 funcionou). As sete: o teto de 30 min da integração, 2 (`21e6186`, `c2265b8`; as verdes antes
levavam 22, 28,5 e 28,3 min, e nada avisava); código das tarefas, 1 execução com 2 defeitos que o teto escondia (`0e85765`: as
rotas da 3.0 fora da lista conferida de `ops-escola.int.test.ts`, e o `tutor-modelo` consumindo o lote que a 4.0 passou a agendar
na extração); a `develop`, 1 (`970e37c`, a limpeza do painel sem o `job_registro`); e2e intermitente, 3 (o W4 e o E3 no celular, o
`professor-inicio`/`professor-introducao` no chromebook, este sem correção).

**5. Do último commit ao pedido de pouso.** Último código à 01:05 de 22/11 (`d45c532b`), pedido à 01:40: **35 min**, contra ~40 na
F4b e 55 na X6. Do pedido ao pouso, ~8 h: a noite, à espera da palavra do Joaquim.

## O que as propostas da F4b fizeram

| Proposta | Resultado na F5a |
|---|---|
| Aviso 1, a §7c pergunta pela volta do código | sem ocorrência (a 0067 e as colunas da 2.0 passaram sem reprovação de versão anterior) |
| Aviso 2, o `cenarios.md` junto da Tech Spec | funcionou: a revisão da spec já o leu na 1ª rodada e durou 26 min (1 h 20 na F4b) |
| Aviso 3, a mutação prova pela asserção | voltou uma vez (6.0) |
| Aviso 4, a entrada do teste distingue o caso | **voltou**: grupo A, quatro reprovações |
| Aviso 5, a tarefa marca as subtarefas | funcionou (a validação não achou subitem em `[ ]`) |
| M1, a divergência cobrada por arquivo | funcionou: pousou às 02:29 de 21/11; depois dela a 3.0 e a 8.0 foram devolvidas antes dos revisores, e nenhuma rodada reprovou por divergência ausente |
| M2, a expansão vira tarefa | sem ocorrência |
| M3 e M4, o commit de processo e o censo | funcionaram: nenhum vermelho só no `verificar`, e o censo achou os dois casos perto do prazo |
| M5, o achado com caminho relativo | funcionou (o último absoluto é o da 1.0, gravado antes do pouso dela) |
| M6, o `domain-researcher` é pesquisa | sem ocorrência |
| P, a M2 e a M4 da X6 antes das tarefas | funcionaram: nenhuma rodada perdida, nenhum `and(` reprovado. A M2 da F4 (inventário no portão) pousou, mas a tabela dela tem duas linhas, e a lista de rotas não está nela (M3 abaixo) |

## Grupos de causa

| # | Causa | Ocorrências | Onde evitar |
|---|---|---|---|
| A | **O teste passa sem montar o caso que promete.** A corrida das duas réplicas com `esperarNaTrava` de 1, que a primeira réplica sozinha satisfaz (4.0); o caso "os tokens das duas linhas pesam na parte" sem asserção da parte, com o bloco vermelho pelo `parse` (6.0, 2ª); a lista com uma rede só, em que `find(() => true)` passa (7.0); a ordem por custo semeada sem custo nenhum (8.0). E o "a do último valor" da 2.0, com as duas regravações gravando o mesmo valor, que quatro revisores apontaram como recomendação | 4 reprovações, 1 recomendação de 4 revisores | o `criar-tasks`. A autoconferência já diz cada uma (a 3, o segundo dado; a 10(b), quantos na trava; a 5, o estado final diferente; a 1, pela asserção), e o aviso 4 da F4b acrescentou mais: respondida na conversa, ela não fica. A entrada que distingue tem de estar escrita na tabela de testes, onde o `test-engineer` a confere na conferência das tarefas (aviso 1) |
| B | **A rodada devolvida pela linha "Subagentes obrigatórios".** Nove das quatorze correções e a 8.0 pediram rodada com guardião a menos: o caminho (`guardioes-por-caminho.ts`) pede os quatro em todo arquivo de `apps/`, `e2e/` e no código de processo da RF16, testes inclusive, e o `PEDIDO` do Orquestrador e a 8.0 marcavam menos. Cada uma custou uma conferência da Mesa e um pedido de novo | 10 devoluções | a Mesa. O hook já cobra quem o caminho pede (RF15, `obrigatoriosDoCommit`), e o `revisores` já os lista: a devolução não protege nada. O `revisar-tarefa` ainda diz que "o hook só cobra o que está escrito na linha", o que deixou de ser verdade (M1) |
| C | **A divergência que não chegou à spec.** A 1.0 (`revisor-geral`, antes de a M1 da F4b pousar); a 3.0 e a 8.0, devolvidas pela M1 antes dos revisores; e a 3.0 de novo, que registrou a divergência com um parágrafo no meio da tabela da §4 e tirou o `GET /v1/governanca/consumo` dela (`revisor-geral`) | 2 reprovações, 2 devoluções | a autoconferência do Implementador: o `revisores` que a Mesa roda ele pode rodar antes de pedir (aviso 2) |
| D | **A recomendação com destino `TODO.md` que não chegou lá.** A 6.0 e a 7.0 deixaram 25 linhas só no documento (menor da validação; o fechamento as levou). A conferência do `executar-task` vale "antes de cada rodada", e a tabela da rodada final chega depois dela | 2 tarefas | o `executar-task`, no `RELATÓRIO` com "APROVADO por todos" (aviso 3) |
| E | **O e2e no celular que toca antes de a tela assentar.** O E3 saltou o relógio com o `GET /escolas` no ar, e a repetição apagou o aviso (correção `e2e-operacao-aviso-da-sessao-no-celular`); o W4 tocou o "Fechar" da folha de baixo que subiu quando as turmas chegaram (`e2e-professores-convite-vencido-no-celular`). Os dois casos são de antes da F5a; caíram nela | 2 correções, 2 vermelhos | a autoconferência 5 fala da resposta antes da asserção, não do toque nem do salto do relógio (aviso 4) |
| F | **O andar do Maestri que não pousa nem se apaga.** 20/11, o `floor delete` da L1 da F4b ("malformed floorLifecycleVerdictResult frame": saiu da lista, ficaram checkout e branch); 22/11, o `floor land` da F5a sem resposta duas vezes (10 s), pousado com `git merge --ff-only spec/camada-ia` no térreo e push, e os quatro `floor delete` com timeout ou o mesmo erro, mas apagando | 2 pousos | o passo 8 do `/seguir`, que só conhece o `floor land` (aviso 5) |
| — | Uma vez só, ou já resolvido: a integração no teto de 30 min (as fatias resolveram; a subida estava à vista nas verdes); as rotas da 3.0 fora da lista conferida, que o portão não puxou (família do inventário: M3); o `tutor-modelo` herdando a fila de outro arquivo (a bancada resolveu); as duas limpezas do e2e no mesmo dia, a segunda trocando a lista escrita à mão pelo catálogo (`pg_constraint`), o que fecha a causa; o mês em UTC no teste dos 12 meses (5.0, autoconferência 10); o PC desligado com as três linhas trabalhando; a escalada falsa da 6.0 (M2); o `revisoes-nao-se-perdem.test.ts` que caiu sob carga na L1 (M4) | 1 cada | — |

**Revisão da spec.** As 19 não aprovadas giraram em torno de: a soma do mês com escopo em só duas das quatro leituras (tenancy, três
rodadas); a estimada da reserva gravada só na varredura (privacy, infra); o `PUT` de rede sem confirmação (frontend); o
`AMBIENTE=carga` que não existe (infra, test-engineer); a escola sem ano letivo em curso sem cenário (test-engineer, cinco rodadas).
É o desenho que a revisão existe para pegar, e ela levou 26 min.

**Falsos positivos.** Nenhum. O `test-engineer` da 6.0 não rodou o `governanca.int.test.ts` porque o compose de teste 2 tinha
workers de pé, e disse isso no veredito: não foi falso positivo, mas é o compose compartilhado entre as linhas.

**Pendências marcadas para a retro**

| Pendência | Destino |
|---|---|
| O pouso que o `floor land` não fez (estado da F5b, "O que falhou") | aviso 5 |
| A escalada da 6.0 contava a conferência das tarefas (estado da F5a, "O que decidi sem perguntar") | M2 |
| `tools/processo/revisoes-nao-se-perdem.test.ts` caiu sob carga no portão da L1, passou isolado 3/3 | M4: é o item (d) do resto da M2 da X6 no `TODO.md`, que já diz por quê |
| As 25 recomendações da 6.0 e da 7.0 sem linha no `TODO.md` (validação, menor) | o fechamento as levou; aviso 3 para não voltar |

## Propostas

### Aviso (só skill ou modelo de documento)

**Aviso 1. A tabela de testes diz a entrada que distingue** (grupo A, 4 reprovações)

```
Mudança: .claude/skills/criar-tasks/task-template.md, "Testes que provam a regra": a tabela ganha a coluna "O que distingue",
  entre "O que prova" e "Caso", e a linha de baixo da tabela: "O que distingue: o dado sem o qual a regra apagada passa
  igual — duas redes e a da escola não é a primeira (7.0 da F5a); custos diferentes, semeados fora da ordem esperada (8.0);
  duas na trava, não uma (4.0); a asserção que o nome do caso promete (6.0). Linha sem esse dado é a que o test-engineer
  devolve na conferência das tarefas." A autoconferência 3 passa a começar por "A coluna 'O que distingue' está no teste?".
Efeito esperado: as quatro reprovações; o dado sai da conversa do Implementador e vai para o documento que o test-engineer
  confere antes de existir código.
```

**Aviso 2. O Implementador roda o `revisores` antes de pedir** (grupos B e C)

```
Mudança: .claude/skills/executar-task/SKILL.md, passo 5, antes de "Com o portão local verde, peça a rodada", e
  .claude/skills/corrigir/SKILL.md, passo 5, depois do `conferir`: "Rode `node tools/processo/portao-local.ts revisores
  <documento>`. Quem a linha 'Revisores obrigatórios' traz e a 'Subagentes obrigatórios' não, acrescente com Edit: é o
  caminho que pede, não escolha sua. O bloco 'Atenção' tem de sair vazio. Na F5a, onze rodadas foram devolvidas por um dos
  dois." E em executar-task, na conferência da divergência: "A linha nova da techspec.md entra fora de qualquer tabela,
  com linha em branco antes e depois (a 3.0 da F5a tirou uma rota da tabela da §4)."
Efeito esperado: as devoluções e a reprovação da 3.0.
```

**Aviso 3. A recomendação da rodada final vai ao `TODO.md`** (grupo D)

```
Mudança: executar-task, "O que volta", RELATÓRIO com "APROVADO por todos": depois de "copie a tabela dele para
  'Recomendações sem aplicar'", acrescentar: "e cada linha com destino `TODO.md` vai agora ao `TODO.md`, na seção 'Da
  <funcionalidade>, tarefa N.0', no mesmo commit: a conferência antes de cada rodada não alcança a tabela que chega com a
  aprovação (na F5a, a 6.0 e a 7.0 deixaram 25 linhas de fora)."
Efeito esperado: o menor da validação.
```

**Aviso 4. No celular, o toque e o salto do relógio esperam a tela assentar** (grupo E)

```
Mudança: task-template.md, autoconferência 5, no fim: "E o toque e o salto do relógio (`page.clock.fastForward`) esperam
  a tela parar: toda leitura que a tela disparou respondeu e o texto que ela traz está na tela. No celular a folha de baixo
  cresce com o conteúdo e o botão sobe (o W4), e o salto com uma leitura no ar estoura o prazo dela, que repete e conta como
  uso (o E3): duas correções na F5a."
Efeito esperado: a próxima correção dessa família.
```

**Aviso 5. O pouso sem o `floor land`** (grupo F)

```
Mudança: .claude/skills/seguir/passos/8-validacao-e-pouso.md, depois do bloco "Pousar": "Se o `maestri floor land` não
  responder (22/11, F5a: timeout de 10 s, duas vezes, a develop intacta), pouse por git, no térreo: `git merge --ff-only
  spec/<funcionalidade>` (a develop não andou: a conferência acima), `git push origin develop`. O `maestri floor delete` de
  cada andar pode responder timeout ou 'malformed floorLifecycleVerdictResult frame' e apagar assim mesmo (20/11 e 22/11):
  confira com `git worktree list` e `git branch`, e o que ficou, contido na develop, sai com `git worktree remove` e
  `git branch -d`."
Efeito esperado: o próximo pouso sem improviso.
```

### Confirmação

**M1. A Mesa não devolve pelo guardião que o caminho pede** (grupo B; `.claude/skills/revisar-tarefa/SKILL.md`, passo 1, item 2)

```
Mudança: o item 2 passa a: "Em correção, confira a linha 'Subagentes obrigatórios' contra o que o caminho não sabe: o
  frontend-reviewer na tela, o llm-integrator na IA, o pedagogia-reviewer no conteúdo, e o revisor-geral acima de 5 arquivos
  fora de tasks/. Faltou um desses: DEVOLUÇÃO. Os quatro guardiões e o revisor-geral que o caminho pede
  (guardioes-por-caminho.ts) vêm na linha 'Revisores obrigatórios' do item 3, e o hook os cobra (RF15): chame-os e
  acrescente-os à linha com Edit, sem devolução." E sai a frase "o hook só cobra o que está escrito na linha", que deixou de
  ser verdade com a RF15.
Recomendo: aplicar. Dez devoluções sem proteger nada: o hook já exige esses guardiões no commit, e a Mesa já os lê no
  `revisores`. Quem implementa continua sem escolher quem o audita: quem escolhe é o caminho.
```

**M2. A contagem da escalada não inclui a conferência das tarefas** (pendência; `revisar-tarefa`, "Antes de enviar, conte")

```
Mudança: depois de "pelas últimas rodadas dele na seção 'Revisões'": "Rodada que começou antes do commit das tarefas
  (`git log -1 --format=%ci -- tasks/prd-<f>/tasks.md`, o primeiro) é da conferência das tarefas, não desta: não conta."
Recomendo: aplicar. A 6.0 foi escalada por duas "seguidas", e a primeira era de 20/11 23:21, da conferência das tarefas;
  o Orquestrador destravou à mão. Uma linha de texto evita a escalada falsa sem mexer no hook.
```

**M3. O portão puxa a lista de rotas quando o diff toca um controller** (rotas da 3.0; `tools/processo/inventarios-do-portao.ts`)

```
Mudança: uma linha nova em INVENTARIOS_DO_PORTAO: `apps/api/src/**/*.controller.ts` → `apps/api/test/ops-escola.int.test.ts`
  (a lista das rotas registradas, `ROTAS_PERMITIDAS`) e `apps/api/test/operacao-isolamento.int.test.ts`
  (`ROTAS_COM_SESSAO_DE_OPERADOR`). Caso de teste: o diff com um controller alterado alcança os dois inventários.
Recomendo: aplicar, como correção. É a família da M2 da F4 (três dos quatro vermelhos de código da F4b); a tabela dela só
  conhece migration e compose. As rotas da 3.0 ficaram quatro horas escondidas atrás do teto e custaram uma correção.
```

**M4. O teste da trava da seção "Revisões" não depende da máquina calma** (pendência; `tools/processo/revisoes-nao-se-perdem.test.ts`)

```
Mudança: o item (d) do resto da M2 da X6 (TODO.md): os dois casos da trava seguram até o `comTrava` desistir (10 s) e
  afirmam saída diferente de 0 e o documento intacto, em vez de esperar 2.500 ms e dar o processo por vivo.
Recomendo: aplicar, como correção (teste intermitente), quando uma linha estiver ociosa. Caiu uma vez sob carga, no portão
  da L1; o item (d) já previa exatamente isso.
```

## O que tirar

Nada, e fica o número. Os quatro guardiões não reprovaram nenhuma das 8 tarefas nem das 14 correções (são 44 rodadas nas tarefas
e 71 nas correções, das quais 32 nas sete que só mexem em teste ou no suporte do e2e). Mas reprovaram 9
vezes na revisão da spec (a soma do mês com escopo pela metade, a estimada da reserva, o `AMBIENTE=carga`), as recomendações
deles viraram 30 linhas do `TODO.md`, e o "testes e fixtures inclusive" é escolha da X7 (pasta nova nasce protegida). Tirá-los da
correção que só toca teste mexeria na revisão do teste de isolamento (regra 10, item 5) e da semeadura (regra 20, item 17): não
proponho. Se a próxima spec repetir zero em correção só de teste, o número volta à retro com a pergunta.

## Decisão

Mostradas ao Joaquim em 22/11 às 10:00, no terminal do `Arquiteto 2`. Resposta às 11:18: "aprovo" (vale a recomendação de cada
uma; os avisos, aprovados antes do prazo das 10:30, aplicados junto).

| Proposta | Resultado | Onde |
|---|---|---|
| Aviso 1 | aplicado | `task-template.md`: coluna "O que distingue", a linha de baixo da tabela e a autoconferência 3 |
| Aviso 2 | aplicado | `executar-task`, passo 5 (o `revisores` e a linha da `techspec.md` fora de tabela); `corrigir`, passo 5 |
| Aviso 3 | aplicado | `executar-task`, "O que volta", RELATÓRIO com "APROVADO por todos" |
| Aviso 4 | aplicado | `task-template.md`, autoconferência 5 |
| Aviso 5 | aplicado | `seguir/passos/8-validacao-e-pouso.md`, depois do bloco "Pousar" |
| M1 | aplicada | `revisar-tarefa`, passo 1, item 2; sai "o hook só cobra o que está escrito na linha" |
| M2 | aplicada | `revisar-tarefa`, "Antes de enviar, conte". O comando ficou `git log --reverse --format=%ci -- <tasks.md> \| head -1`: o `-1` da proposta daria o commit mais novo, e não o primeiro |
| M3 | aceita, por correção | `TODO.md`, "Da retrospectiva da F5a" |
| M4 | aceita, por correção, com linha ociosa | `TODO.md`, "Da retrospectiva da F5a" (é o item (d) do resto da M2 da X6) |
