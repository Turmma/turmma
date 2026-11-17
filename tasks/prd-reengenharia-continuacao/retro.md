# Retrospectiva — reengenharia-continuacao (X6)

17/11/2026, pelo Arquiteto 2, no térreo, depois do pouso (`b9898c6a`), ao lado da F4b `classificacao-bncc` (D86). **Completa** (D86): a taxa
caiu (10,1% contra 11,3% da F4), mas cinco causas se repetiram. Comparação com a retro da F4 (`tasks/prd-ingestao-do-material/retro.md`).

O que pesa nos números: 14 tarefas em três linhas (L1 com 4.0 a 12.0 menos a 13.0 e a 14.0; L2 com 3.0, 13.0, 14.0 e as correções; L3 com 1.0
e 2.0), todas com Sonnet; a primeira spec de reengenharia de IA (fila, corte, teto de tokens, D62) e a primeira com três linhas ao mesmo tempo.

## Medidas

```
Tarefas: 14 · Rodadas de revisor: 198 · Reprovações: 20 (10,1%) · nenhum AJUSTES NECESSÁRIOS nas tarefas
Por revisor: test-engineer 30/8 · revisor-geral 30/5 · infra-guardian 28/5 · privacy-guardian 28/1 · conformidade-reviewer 28/1
             tenancy-guardian 28/0 · llm-integrator 14/0 · frontend-reviewer 12/0
Por modelo do implementador: Sonnet nas 14 (o estado.md escreve "Sonnet 5.5" em quatro e "Sonnet" em dez); 14,1 rodadas e 1,4 reprovação
  por tarefa; 1 diagnóstico do Arquiteto (14.0, escalada do revisor-geral); 1 BLOQUEIO (8.0, a prontidão da API e a D62, decidido pelo
  Joaquim); 5 divergências (8.0 desenho; encontro-4 desenho, mal-entendido; faltando-termo-a-termo desenho, detalhe; 4.0 e 13.0 portão, a
  catraca); pedido → commit com mediana de ~145 min (13 tarefas, sem a 8.0, que esperou o Joaquim; com ela, ~149)
Rodadas por tarefa: média 14,1; pior 14.0 com 21 (três rodadas, a escalada)
Rodadas que caducaram sem reprovação: 81 de 198 (41%)
Correções fora de tarefa: 16 (2 planejadas, a M1 e a M2 da F2c; 14 vindas da esteira, do portão ou do encontro)
Duração: PRD 15/11 01:08; revisão da spec 01:16 → 03:04; tarefas 11:59 (depois do commit da retro da F4, 11:39, D86);
  construção 12:03 de 15/11 → 01:00 de 17/11 (1 d 13 h); validação r1 23:41 de 16/11 (APROVADA), r2 00:15, r3 01:35 (APROVADA);
  pedido de pouso ~01:55
Revisão da spec: 6 rodadas, 31 vereditos, 18 não aprovados (15 REPROVADO, 3 AJUSTES), em 1 h 48
Validação: rodada 1 com 0 crítico, 0 maior, 7 menores; r2 e r3 APROVADAS, 0 crítico, 0 maior, 2 menores novos
```

Como contei: a união da seção "Revisões" dos 14 `N_task.md` com `achados/indice.md`, por (tarefa, revisor, rodada). A seção perdeu a 1ª rodada
inteira em três documentos (2.0, 7.0 e 10.0: 21 linhas, 4 reprovações), que só o índice guarda (grupo E abaixo); nas outras onze, onde as duas
fontes têm a mesma linha, o veredito bate. O pedido de cada tarefa pela primeira mensagem `PEDIDO … Tarefa:` nas sessões das linhas
(`~/.claude/projects/*specreengenharia-continuacao--l1`, `--l2`, `--l3`), em UTC, convertida para a hora do commit. A esteira por
`gh run list --branch spec/reengenharia-continuacao`, a partir de 15/11 11:40.

| | F3 | X8 | F2 | F2b | F2c | F4 | X6 |
|---|---|---|---|---|---|---|---|
| Tarefas | 20 | 13 | 16 | 8 | 19 | 12 | 14 |
| Reprovações nas tarefas | 22,9% | 15,2% | 15,4% | 2,2% | 12,6% | 11,3% | **10,1%** |
| Rodadas por tarefa | 11,8 | 11,6 | 12,2 | 11,3 | 13,4 | 14,8 | 14,1 |
| Caducadas sem reprovação | 34% | 30% | 33% | 41% | 39% | 44% | 41% |
| Correções fora de tarefa | 9 | 26 | 13 | 4 | 25 | 10 | 16 |
| Crítico ou maior no 1º /validar | 1 c, 2 M | 1 c (+1 c) | 2 c | 1 M | 1 c, 2 M | 1 M | **nenhum** |
| Tarefas sem nenhuma reprovação | 1 de 20 | 1 de 13 | 1 de 16 | 6 de 8 | 3 de 19 | 2 de 12 | 4 de 14 |
| Rodadas da revisão da spec (não aprovadas) | — | 29 (21) | 35 (27) | 19 (13) | 17 (11) | 28 (21) | 31 (18) |

## As cinco medidas da D79

**1. Do pedido ao commit.** Mediana de **~145 min** nas 13 sem parada, contra 158 na F4, 108 na F2c e 99 no F3. As longas: 5.0 (246, a IA
saindo do processo da API), 1.0 (218), 12.0 (201). A 8.0 levou 435 min, com a parada do Joaquim (09:55 a 10:30) e uma hora do `Implementador`
esperando um monitor de `pgrep -f` que casava consigo mesmo (grupo G).

**2. Tarefas sem reprovação.** **4 de 14** (1.0, 3.0, 6.0, 13.0), contra 2 de 12 na F4.

**3. O grupo A (cláusula sem prova).** **4** (2.0, 4.0, 9.0, 11.0), contra 6 na F4 e 12 na F2c. A 9.0 é o `and(` de um argumento por linha
(`this.#semResposta(),`), que o `--faltando` ainda não vê (recomendação aberta da correção `faltando-termo-a-termo`); a 2.0, a chamada sem
condição de uma função nova; a 4.0, o motivo falso no lugar do bloco; a 11.0, a montagem de `lerASala` em `infra/scripts/`.

**4. Vermelhos da esteira por push.** 43 execuções: **10 verdes, 11 vermelhas, 22 canceladas**, e uma das canceladas (`ea6f3a0`) era vermelho
de fato, o job `verificar` cortado nos 15 min. As 12 causas: o teste que depende do relógio ou da folga da máquina, 5 (`b8280ad`, `5878210`,
`346d5d8`, `438120f`, `26031b5`); a varredura global contra a sobra do banco compartilhado, 3 (`ef1ec80` e `29e1804`, a mesma causa, que era
também defeito de produto da 6.0, e `4741f2c`); o número procurado no log que cabe num UUID, 1 (`785f7d3`); o `TETO` da catraca, 1
(`ddfe209`); o celular da 9.0, 1 (`afd3ebe`); o teto do `verificar`, 1 (`ea6f3a0`). Contra 6 vermelhas em 36 na F4: o dobro, e 9 das 12 são
de teste, não de produto.

**5. Do último commit ao pedido de pouso.** Último código à 01:00 de 17/11 (`490e1fd8`), validação r3 à 01:35, pedido de pouso ~01:55: **~55 min**,
contra 1 h 30 na F4 e 55 min na F2c.

## Grupos de causa

| # | Causa | Ocorrências | Onde evitar |
|---|---|---|---|
| A | **O erro que não diz se o servidor gravou.** O estouro do prazo no navegador saía como o `TEMPO_ESGOTADO` do servidor, que as telas tratam como recusa garantida (12.0, revisor-geral 1ª); o mesmo código, vindo do 503 rápido do banco, fazia a fila da prova reenviar sem recuo (12.0, infra 1ª); o aviso da correção afirmava que nada foi aprovado (12.0, test-engineer 2ª); o código certo do MFA já gasto quando o Redis cai depois (14.0, infra 1ª); o erro da repetição que sobe com a tentativa descartada (14.0, revisor-geral 1ª); a tela que diz "o código estava certo" quando a resposta nem chegou (14.0, revisor-geral 2ª, a escalada e o diagnóstico) | 6 reprovações em 2 tarefas, 1 escalada | a Tech Spec: a §7c não pergunta, para cada código de erro, de onde ele vem e se o servidor pode ter gravado (aviso 1) |
| B | **O teste depende do relógio, da folga da máquina ou do que outro arquivo deixou.** Nas tarefas: o "Redis fora e de volta" só passa com a máquina folgada (7.0, test-engineer), o e2e contra uma janela de 2 s de relógio real (14.0, test-engineer). Na esteira, 9 vermelhos: o `statement_timeout` de 2 s que o runner carregado passa (`execucao-pendente-na-leitura-por-serie`); a primeira chamada que passa dos 100 ms do cliente do limite e cai no seguro em memória (`limite-do-ip-no-consultar-convite`); duas marcas no mesmo milissegundo (`reserva-no-mesmo-milissegundo`); o dia contado em três relógios na virada da meia-noite de SP (`prazo-do-pedido-na-virada-do-dia`); a rede do navegador travada, a quarta vez (`e2e-pedidos-do-titular`); a varredura que pega primeiro a sobra que o `expurgo-da-escola.int.test.ts` deixa (`varredura-do-main-worker`, dois vermelhos, e `varredura-da-pendente-na-esteira`); o `4242` achado dentro de um UUID (`uuid-no-log-do-job-timeout`) | 2 reprovações, 9 vermelhos, 8 correções | autoconferência 10 e 4 (aviso 2). Cinco dos testes eram de specs anteriores (F2c, F3, F4): nenhuma etapa da X6 os evitaria, e o custo foi a medida 4 |
| C | **O documento afirma o que a árvore não tem** (o grupo A da F4, de novo, agora em `docs/`): a AIA do Tutor com o texto novo da N10 (5.0, privacy) e com uma supervisão que não existe (7.0, conformidade); o runbook mandando corrigir `LLM_API_KEY`, que se chama `LLM_CHAVE_API` (10.0, infra); o documento e o comentário com a premissa "o balde cheio vale 0,8" (10.0, revisor-geral); a subtarefa de rollback marcada feita sem estar (5.0, revisor-geral) | 5 em 3 tarefas | autoconferência 7, que só fala de comentário (aviso 3) |
| D | **Cláusula sem teste que caia sem ela** (o grupo A da D79) | 4 (2.0, 4.0, 9.0, 11.0) | autoconferência 1; o `--faltando` para o `and(` de várias linhas (M4) |
| E | **A seção "Revisões" cortada por script.** O gancho do `Write` (correção `write-sobre-revisoes`, desta spec) segurou o `Write`, mas o `Implementador` mudou os documentos por `python3 … open(p,'w')` no Bash, com `s = s[:i] + tabela`, e cortou o fim do arquivo: a 2.0, a 7.0 e a 10.0 perderam a 1ª rodada inteira (21 linhas, 4 reprovações). É o limite que a correção declarou ("`Bash` com `>` não passa por ele"). Nas transcrições, o `Implementador` reescreve o `N_task.md` por script em quase toda tarefa | 3 documentos | o gancho (M2) e o `executar-task` (aviso 4) |
| F | **O `TETO` exato da catraca com linhas em paralelo.** `catraca.test.ts` reprova a soma abaixo do `TETO` ("quem corta a função baixa o número no mesmo commit"); duas linhas que baixam supressão ao mesmo tempo mudam a mesma linha do arquivo, e o encontro ou deixa o `TETO` acima da soma ou dá conflito | 1 vermelho (`ddfe209`), 2 divergências de portão (4.0 na L1, 13.0 na L2), 4 correções (`teto-de-complexity-da-catraca`, `teto-da-catraca-depois-da-2-0`, `spec-na-linha-2`, parte da `encontro-4`) | a guarda (M1) |
| G | **O `Implementador` esperando com `pgrep -f`**, que casa com o próprio comando e nunca avisa: uma hora parada na 8.0, depois do portão vermelho às 08:30. Na F4 foi uma vez, sem proposta; o texto do `executar-task` ("Nunca escreva laço de espera com `pgrep`") já existia nas duas | 2 specs seguidas | o gancho (M3) |
| H | **A integração ao lado dos workers do compose de pé** (a M3 da F4, aceita e não feita): na 9.0 a integração deu 14 de 31 e 17 de 31 vermelhos com a vitrine de pé (test-engineer, 2ª) | 1 nesta spec, 3 na F4 | a M3 da F4 (P) |
| — | Uma vez só, sem proposta: a prontidão da API presa à D62 (8.0, desenho da spec, subiu ao Joaquim e voltou escrita: é o caminho certo); a variável nova com `:?` no compose que pararia o deploy (11.0, infra; está no `TODO.md` para o pouso); o layout do celular que descia o botão (9.0); o job `verificar` acima dos 15 min (vai com a M7) | 1 cada | — |

**Revisão da spec.** As 18 não aprovadas giraram em torno de uma coisa: a tabela de estados da execução, na linha `pendente`, não dizia quem
grava o corte dos 20 s, com que relógio, e quais cláusulas o `update` leva (infra, revisor-geral, test-engineer, tenancy e llm-integrator em
três rodadas); depois, o teto de tokens contra o pico que a própria spec calcula (infra), o prazo único que nunca valia na configuração
(test-engineer), a degradação sem registro na AIA (conformidade) e a execução que podia sumir da lista de compartilhamento (privacy). É o
desenho que a revisão existe para pegar, e ele saiu de lá: a validação não achou crítico nem maior pela primeira vez.

**Falsos positivos.** Nenhum.

**Pendências marcadas para a retro**

| Pendência | Destino |
|---|---|
| A vitrine com os workers de pé rouba as filas da integração (9.0, "para a retro") | grupo H, P |
| O monitor de `pgrep` preso na 8.0 (`estado.md`, "O que falhou") | grupo G, M3 |
| O `TETO` exato quebra quando duas linhas baixam supressão (`estado.md`, 15/11 19:00) | grupo F, M1 |
| 2 recomendações da Mesa na ordem r1 de `teto-da-catraca-depois-da-2-0` | grupo F, M1 |
| Menor 2 da validação r1: a autoconferência 4 do `8_task.md` citava controles da prontidão da API | feito nesta retro, por Edit, com a nota "Revisto na retro" |
| Menor 3: a D77, item 5, ainda trata a IA no processo da API como dívida aberta | M6 |
| Menor 5: o status da `techspec.md` e o histórico | conferido: "implementada em 17/11/2026 (revista em 16/11/2026 …)" está completo |
| Menor 7: o critério de pronto do `tasks.md` que nomeia a 7.0 e a 9.0 sem linha no documento delas | M5 |
| Menor 8c: o `entrar-na-escola.spec.ts:218` perto do censo, e se a nova tentativa do `gotoComNovaTentativa` conta | sem proposta: o censo mede o caso inteiro, com a nova tentativa, porque é o prazo do caso que estoura; na esteira do fechamento (`eac0008`) o `:218` ficou abaixo de dois terços |
| "Unidade perto do teto" em `tools/ci/unidade.ts` e a guarda do `/N` estendida à infra e ao e2e (correção `teto-do-verificar-na-esteira`) | M7 |
| Os 14.0 r3: `cenarios.md` §7 sem o [U] do prazo estourado no navegador | conferido na validação (RF11 e RF13 ATENDIDOS, `client.test.ts`); sem mudança |

## Propostas

### Aviso (só skill, papel ou modelo de documento), mostradas às 08:55, com hora para aplicar às 09:25

**Aviso 1. A §7c pergunta se o erro deixa dúvida sobre o que foi gravado** (grupo A, 6)

```
Mudança: .claude/skills/criar-techspec/template.md, §7c, linha nova depois de "Quando cada dependência cai":
  | O erro que não diz se gravou | para cada código de erro novo, ou de sentido mudado, no caminho: de onde ele vem (o servidor, que
  recusou antes de gravar; o prazo do navegador; a conexão que caiu), se o servidor pode ter gravado, o que a tela afirma e se o cliente
  repete, com recuo. O prazo do navegador e a conexão que caiu são sempre "pode ter gravado". Na X6, a 12.0 e a 14.0 (seis reprovações e
  uma escalada) |
Efeito esperado: as seis reprovações da 12.0 e da 14.0, pegas na revisão da spec.
```

**Aviso 2. Os padrões novos do teste que depende da máquina** (grupo B, 2 reprovações e 9 vermelhos)

```
Mudança 1: .claude/skills/criar-tasks/task-template.md, autoconferência 10, no fim: "Na X6: o cliente com corte curto (os 100 ms do limite,
  que manda a primeira chamada ao seguro em memória) e o statement_timeout de 2 s, que a esteira carregada passa: o teste não conta com a
  chamada caber no corte; duas marcas de clock_timestamp() no mesmo milissegundo; o dia calculado em três relógios (o banco na semeadura,
  a tela, o teste) na virada da meia-noite de SP: calcule o esperado a partir do que o banco gravou."
Mudança 2: task-template.md, autoconferência 4, no fim: "Job que varre o banco inteiro (varredura, expurgo) é testado com a sobra que outro
  arquivo deixa: semeie antes mais linhas que o lote da volta, e uma com valor extremo (a de 2025), como a correção
  varredura-da-pendente-na-esteira. E a busca por um valor no texto do log usa um que não caiba num UUID (só hexadecimal não serve)."
Efeito esperado: as duas reprovações da 7.0 e da 14.0, e os vermelhos dos testes novos (a varredura, duas vezes; o UUID). Os de specs
  anteriores só se acham quando caem.
```

**Aviso 3. O texto novo em `docs/` também é afirmação** (grupo C, 5)

```
Mudança: task-template.md, autoconferência 7, no fim: "Vale também para o texto novo em docs/ (a AIA, o runbook, lgpd.md, infra.md): cada
  frase que diz o que o sistema faz tem o arquivo ou o caso que a prova, e o nome de variável, comando ou métrica vem da árvore (grep),
  nunca de memória. Na X6, a AIA prometia uma supervisão que não existia (7.0) e o runbook mandava corrigir LLM_API_KEY (10.0)."
Efeito esperado: as reprovações da 5.0 (privacy), da 7.0 (conformidade) e da 10.0 (infra).
```

**Aviso 4. O documento da tarefa se muda com Edit, nunca por script** (grupo E, 3)

```
Mudança: .claude/skills/executar-task/SKILL.md, passo 5, antes de "Antes de pedir": "O N_task.md se muda com Edit. Script que reescreve o
  arquivo (python com open(..., 'w'), sed -i, >) não passa pelo gancho do Write: na X6 cortou a seção 'Revisões' da 2.0, da 7.0 e da 10.0
  (s = s[:i] + tabela), e a rodada perdida só ficou no achados/."
Efeito esperado: nenhuma rodada perdida; a M2 segura o que o texto não segurar.
```

### Confirmação

**M1. A catraca reprova a soma acima do `TETO`, não abaixo** (grupo F; `tools/guardas/catraca.ts` e `catraca.test.ts`)

```
Mudança: somasForaDoTeto reprova só soma > TETO. A soma abaixo do TETO vira aviso informativo, e quem baixa o TETO é o Orquestrador no
  fechamento da spec, num commit só, depois do último encontro. A comparação por arquivo com o HEAD (arquivosQueGanharam) continua
  reprovando a supressão que cresce, no portão de cada tarefa; na esteira, a soma contra o TETO segura o crescimento. O caso "uma supressão
  a menos sem baixar o TETO reprova" vira "passa, com o aviso", e o "uma a mais reprova" fica.
Recomendo: aplicar, como correção. Com linhas em paralelo (D79), cada baixa mexe na mesma linha do arquivo: foram quatro correções, duas
  divergências de portão e um vermelho nesta spec. O ESLint já guarda a supressão por arquivo; o TETO exato só repetia isso e brigava no merge.
```

**M2. A seção "Revisões" não se perde por script** (grupo E; `tools/processo/hook-revisoes.ts`, `.claude/settings.json`)

```
Mudança: o hook guarda, a cada linha que escreve, uma cópia da tabela em .processo/ (fora de tasks/, sem commit). Antes do commit
  (PreToolUse do Bash com git commit, onde o hook já olha) e a cada linha nova, compara com o documento: linha que sumiu volta para a tabela
  e o hook avisa quem a cortou. Caso de teste: o documento reescrito por script sem a seção, e com a seção sem uma rodada.
Recomendo: aplicar, como correção. O gancho do Write desta spec pegou o caminho que o texto já proibia, e o Implementador passou pelo outro;
  um terceiro aviso em texto não fecha isso, e a contagem desta retro só saiu certa porque o achados/ guardava a rodada.
```

**M3. O gancho recusa o laço de espera com `pgrep`** (grupo G; `.claude/settings.json` e o hook do Bash)

```
Mudança: PreToolUse de Bash e de Monitor recusa (saída 2) o comando com while/until e pgrep -f, com a mensagem "rode o comando com
  run_in_background e espere o aviso do fim". Caso de teste para o laço recusado e para o pgrep solto, que passa.
Recomendo: aplicar, como correção. Duas specs seguidas, uma hora parada em cada, com o texto do executar-task já dizendo o mesmo.
```

**M4. O `--faltando` junta o `and(` de várias linhas** (grupo D; `tools/processo/mutacoes.ts`)

```
Mudança: a recomendação aberta da correção faltando-termo-a-termo (privacy 2ª, tenancy 1ª, test-engineer e revisor-geral 2ª), já no
  TODO.md: as linhas de um and(/or( de um argumento por linha se juntam antes de partir em termos, e cada termo vira um item.
Recomendo: aplicar, como correção. Foi o que reprovou a 9.0, e o modelo da tarefa já manda conferir esse caso à mão.
```

**M5. Item do critério de pronto que nomeia uma tarefa vira subtarefa dela** (menor 7 da validação; `.claude/skills/criar-tasks/SKILL.md`)

```
Mudança: na geração do tasks.md, "item do critério de pronto que nomeia uma tarefa (a 7.0 e a 9.0 conferem o roteiro da demonstração)
  entra também como subtarefa no N_task.md dela, com o teste que confere". O criar-tasks decide a marcação dos guardiões: por isso é confirmação.
Recomendo: aplicar. Uma frase; na X6 o Validador conferiu o roteiro no lugar das duas tarefas.
```

**M6. A D77 anota que a dívida da IA no processo da API foi paga** (menor 3 da validação; `docs/decisoes.md`)

```
Mudança: no fim da D77, item 5: "Paga: a extração de PDF na F4 e a execução de IA na X6 (tarefa 5.0, 16/11/2026)." Sem mudar a decisão
  nem a linha do CLAUDE.md.
Recomendo: aplicar. É registro, não decisão nova; o TODO.md já fechou o item.
```

**M7. O teto de cada job da esteira, com aviso e conta** (pendência da correção `teto-do-verificar-na-esteira`; `tools/ci/`, `ci.yml`)

```
Mudança: junto da M4 da F4 (a fatia do e2e vem da conta), na mesma correção: o /N do nome derivado de strategy.job-total nos três jobs
  com matriz (unidade, infra, e2e), e a anotação "perto do teto" no resumo de tools/ci/unidade.ts, como a do e2e.
Recomendo: aplicar, junto da M4 da F4. Três specs seguidas com um job da esteira passando do teto sem aviso antes (a fatia do e2e na F2c e
  na F4, o infra de 45 min na F4, o verificar de 15 min aqui).
```

**P. A M1 a M4 da F4, aceitas em 15/11 e não feitas**

```
Seguem [ ] no TODO.md. A M3 (a integração recusa os workers de pé) voltou na 9.0, com 14 e 17 de 31 vermelhos ao lado da vitrine.
Recomendo: o Orquestrador fazer a M3 da F4 antes das tarefas da F4b, e a M4 da F4 com a M7 desta; a M1 e a M2 da F4 na fila. Já estão
  aceitas; não pedem palavra nova.
```

## O que tirar

Nada. O `tenancy-guardian` (28 rodadas), o `llm-integrator` (14) e o `frontend-reviewer` (12) não reprovaram, mas os três deixaram
recomendações que viraram linha do `TODO.md` ou da Tech Spec, e correm em paralelo; na revisão da spec, o `llm-integrator` e o
`tenancy-guardian` estiveram entre os que fecharam a tabela de estados. Tirar o guardião de isolamento de uma spec que mexe em fila,
varredura sem escopo e `@Unscoped` seria ler o número ao contrário (regra 10).

## Decisão

Mostrei o bloco ao Joaquim em 17/11/2026, às 08:55, no terminal do Arquiteto 2. Ele respondeu "aprovo" às 09:54, que vale a recomendação
de cada uma. Os avisos foram aplicados depois da resposta; nenhum teve objeção.

| Proposta | Tipo | Resultado | Onde |
|---|---|---|---|
| 1. A §7c pergunta se o erro deixa dúvida sobre o que foi gravado | aviso | aceita, aplicada | `.claude/skills/criar-techspec/template.md`, §7c, linha "O erro que não diz se gravou" |
| 2. Os padrões novos do teste que depende da máquina | aviso | aceita, aplicada | `task-template.md`, autoconferências 4 e 10 |
| 3. O texto novo em `docs/` também é afirmação | aviso | aceita, aplicada | `task-template.md`, autoconferência 7 |
| 4. O documento da tarefa se muda com Edit | aviso | aceita, aplicada | `.claude/skills/executar-task/SKILL.md`, passo 5 |
| M1. A catraca reprova só a soma acima do `TETO` | confirmação | aceita, como correção | `TODO.md`, "Da retrospectiva da X6" |
| M2. A seção "Revisões" não se perde por script | confirmação | aceita, como correção | idem |
| M3. O gancho recusa o laço de espera com `pgrep` | confirmação | aceita, como correção | idem |
| M4. O `--faltando` junta o `and(` de várias linhas | confirmação | aceita, como correção | idem (a linha da F2c marcada) |
| M5. Item do critério de pronto que nomeia tarefa vira subtarefa | confirmação | aceita, aplicada | `.claude/skills/criar-tasks/SKILL.md` |
| M6. A D77 anota a dívida paga | confirmação | aceita, aplicada | `docs/decisoes.md`, fim da D77 |
| M7. O teto de cada job da esteira, com aviso e conta | confirmação | aceita, como correção, junto da M4 da F4 | `TODO.md`, "Da retrospectiva da X6" |
| P. A M3 da F4 antes das tarefas da F4b; a M4 da F4 com a M7 | já aceitas | recomendado ao Orquestrador | `TODO.md`, cabeçalho da seção da X6 |

Recusadas: nenhuma.

Itens do `TODO.md` que esperavam esta retro, marcados: os menores 2, 3, 7 e 8c da validação, a pendência da correção
`teto-do-verificar-na-esteira` (vira a M7) e a recomendação do `and(` de várias linhas (vira a M4). A linha duplicada da M2 da F2c (uma `[ ]`
e outra `[x]`) ficou só a `[x]`.
