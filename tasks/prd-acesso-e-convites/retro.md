# Retrospectiva — acesso-e-convites (F2c)

11/11/2026, pelo Arquiteto 2, no térreo, depois do pouso (`43006575`, esteira verde 43011825278). **Completa** (D86): a taxa subiu
(12,6% contra 2,2% da F2b) e três causas se repetiram. Comparação com a retro da F2b (`tasks/prd-semana-do-professor/retro.md`) e,
nas cinco medidas da D79, com a do F3.

O que pesa nos números: 19 tarefas (17 do plano e as 18.0 e 19.0 da validação), todas com Sonnet 5.5, em três linhas; a spec mais
densa de segurança até aqui (tokens, links, senha provisória, conta da escola, travas de repository); e a máquina, com três linhas
dividindo 12 núcleos e o relógio da VM recuando até 1,7 s (timesyncd), que gerou 11 correções de teste.

## Medidas

```
Tarefas: 19 · Rodadas de revisor: 254 · Reprovações: 32 (12,6%)
Por revisor: test-engineer 42/20 · revisor-geral 42/6 · infra-guardian 37/4 · privacy-guardian 37/2
             tenancy-guardian 37/0 · conformidade-reviewer 37/0 · frontend-reviewer 16/0
Por modelo do implementador: Sonnet 5.5 nas 19; 13,4 rodadas e 1,7 reprovação por tarefa; 3 diagnósticos do Arquiteto
  (5.0, 7.0, 9.0, as três escaladas do test-engineer); 2 BLOQUEIOs destravados pelo Joaquim (16.0 e a correção
  incidente-ao-entrar-de-novo); 4 divergências de desenho (4.0 e 10.0 triadas; 12.0 e o maior 1 da validação, paradas do Joaquim);
  pedido → commit com mediana de ~108 min (nas 8 tarefas em que a hora do pedido se recupera)
Rodadas por tarefa: média 13,4; pior 16.0 com 28 (quatro rodadas de sete revisores)
Rodadas que caducaram sem reprovação: ~100 de 254 (39%)
Correções fora de tarefa: 25
Duração: revisão da spec 07/11 10:38 → 10:57; tarefas geradas 11:24; construção 11:30 → 10/11 20:45 (3 d 9 h)
  fechamento: validação r1 12:26 (REPROVADA), r2 16:44, r3 20:02 (APROVADA); pedido de pouso ~21:40; pouso 11/11
Revisão da spec: 4 rodadas, 17 rodadas de revisor, 11 não aprovadas, em 19 min
Validação: rodada 1 REPROVADA (1 crítico, 2 maiores, 5 menores); rodada 2 e 3 APROVADA
```

Como contei: as seções "Revisões" dos 19 `N_task.md` e o `achados/indice.md`, que bate com elas salvo na 3.0 (a seção do documento
perdeu a 1ª rodada inteira, com a reprovação do `test-engineer`: somei as seis linhas do índice); o tempo pelo `git log`; o pedido pelas
sessões das linhas em `~/.claude/projects` (os andares já foram apagados, e nas sessões retomadas o primeiro pedido não é o da partida:
ficaram 8 tarefas, 1.0 280 min, 2.0 53, 5.0 107, 7.0 192, 9.0 110, 10.0 127, 6.0 88, 11.0 57); a esteira por
`gh run list --branch spec/acesso-e-convites`.

| | F3 | X8 | F2 | F2b | F2c |
|---|---|---|---|---|---|
| Tarefas | 20 | 13 | 16 | 8 | 19 |
| Reprovações nas tarefas | 22,9% | 15,2% | 15,4% | 2,2% | **12,6%** |
| Rodadas por tarefa | 11,8 | 11,6 | 12,2 | 11,3 | 13,4 |
| Caducadas sem reprovação | 34% | 30% | 33% | 41% | 39% |
| Correções fora de tarefa | 9 | 26 | 13 | 4 | **25** |
| Crítico ou maior no 1º /validar | 1 c, 2 M | 1 c (+1 c) | 2 c | 1 M | 1 c, 2 M |
| Tarefas sem nenhuma reprovação | 1 de 20 | 1 de 13 | 1 de 16 | 6 de 8 | 3 de 19 |
| Rodadas da revisão da spec (não aprovadas) | — | 29 (21) | 35 (27) | 19 (13) | 17 (11) |

## As cinco medidas da D79

**1. Do pedido ao commit.** Mediana de **~108 min** nas 8 recuperáveis, contra 87 na F2b e 99 no F3. A 1.0 (280) leva a manhã de
07/11 com três correções de carga; a 7.0 (192), duas rodadas de escalada.

**2. Tarefas sem reprovação.** **3 de 19** (8.0, 11.0, 18.0), contra 6 de 8 na F2b. O número volta ao que era antes dela.

**3. O grupo A (cláusula sem prova).** **12**, contra 0 na F2b, 7 na F2 e 17 no F3. Oito deles são cláusulas que o
`--faltando` não lista (grupo A abaixo): o modelo já dizia "cada termo de uma condição composta", e quem implementa confiou na lista
da ferramenta. É a causa da M1.

**4. Vermelhos da esteira por push.** 62 execuções: **18 verdes, 8 vermelhas, 36 canceladas**. Os oito: o compose sem o `mailpit`
(`933177ce`, 1.0), a lista de rotas com "convite" (`25cf9ee8`, 3.0), o e2e 3/9 da primeira carga (`c720f67c` e `4832c76b`; o segundo
virou a correção `incidente-ao-entrar-de-novo`), o retorno do repository de matrícula (`1bda038e`, 10.0), o byte do cookie OIDC
(`87186c1c`), o recomeço na mesma aba no celular (`2acd5adc`, defeito antigo da A5/X2) e o 503 do ensaio de alertas (`8c07d22d`).
Três são do grupo D (inventário fora do diff); a M1 da F2b (o `restos`) não voltou.

**5. Do último commit ao pouso.** Último código às 20:45 de 10/11, fechamento às 21:29, pedido de pouso às ~21:40: **55 min** de
processo, contra ~35 na F2b. O pouso foi na manhã de 11/11.

## Grupos de causa

| # | Causa | Ocorrências | Onde evitar |
|---|---|---|---|
| A | **Cláusula sem teste que caia sem ela.** Em 8, a cláusula era uma que o `--faltando` não lista: termo de uma linha com vários (5.0, 15.0, 16.0), SQL ou Lua em template string (2.0, 5.0), linha sem condição que protege — a chamada que confere antes, o semáforo, a fiação de uma guarda, o campo zod (4.0, 9.0 r2, 10.0, 14.0). Nas outras 4, o cenário não tinha o segundo dado (9.0 r1, 17.0 r1 e r2, 5.0 r2) | 12 reprovações do `test-engineer` em 10 tarefas | autoconferência 1 e `executar-task` (aviso 1); a ferramenta (M1) |
| B | **Asserção de ausência ou contagem que passa antes de a resposta chegar**: o `waitFor` negativo que passa na primeira volta (16.0), o "antes" lido antes de a tela montar (19.0), a espera cumprida antes da resposta segurada (12.0), a asserção que sempre passa no e2e (6.0) | 4 | autoconferência 5 (aviso 2) |
| C | **Carga [C] provada pelo teste do script, e não pela corrida**: a fase `professores` passou pela 10.0 com `carga-importacao.test.ts` e caiu na primeira corrida da validação (crítico 1 e maior 2); a 16.0 mudou o que a sala manda sem atualizar o k6, generalizou a conclusão de 5% de alunos pela conta, e o medidor novo dava "não medido" como pico 0 (infra r1 a r3, test-engineer r3, privacy r3 pelo runbook) | 2 tarefas, 6 reprovações, 1 crítico, 1 maior, 3 correções (`medidor-do-balde-anonimo`, `k2-calmo`, `carga-professores`) | `task-template.md`, a linha de carga (aviso 3) |
| D | **O acréscimo que quebra o teste de inventário fora do diff**: serviço novo no compose (1.0), rota nova com "convite" (3.0), campo a mais no retorno do repository (10.0), botão novo na lista de ações do painel (19.0), cinco e2e da regra antiga (7.0) | 4 vermelhos da esteira, 4 correções, 2 reprovações | `executar-task`, "Quem usa o que mudou" (aviso 4) |
| E | **A tela promete um dado ou uma ação que nenhuma rota entrega**: a confirmação da provisória mostrava a matrícula que nenhuma leitura levava à web (12.0); a borda "E-mail que volta" pedia corrigir um e-mail sem caminho (maior 1 da validação) | 2, com duas paradas do Joaquim e três tarefas novas (17.0, 18.0, 19.0) | `criar-techspec/template.md`, §9 (aviso 5) |
| F | **Teste preso à máquina calma ou ao relógio de parede**: unidade criando a própria carga, `mtime` contra `Date.now()`, desafio de login com `iat` à frente, "o último convite" por `expiraEm`, dois processos que precisam se sobrepor, a primeira carga do e2e sob a rede do perfil, e2e acima de metade do prazo | 11 correções (`unidade-independente-da-carga`, `testes-sob-carga`, `encontro-na-fila-de-carga`, `desafio-com-folga-de-relogio`, `professores-int-sem-relogio`, `professores-e2e-sem-relogio`, `fila-de-carga-sem-relogio`, `segundo-fator-na-casca`, `incidente-ao-entrar-de-novo`, `e2e-decima-fatia`, `censo-e2e-convite-mfa`), ~18 h da construção | autoconferência 10 (aviso 6) |
| G | **A seção "Revisões" apagada por `Write`** (3.0, com a 1ª rodada perdida de vez; 5.0; 12.0, refeita à mão), mais duas na X1. O protocolo §5 já proíbe; o erro voltou | 3 | código de processo: hook (M2) |
| — | O "Sem aplicar" da 2ª rodada foi ao `TODO.md` e não ao documento da correção (menor 2 da validação r3) | 1 | `executar-task`, "O que volta" (junto do aviso 6, barato) |
| — | Correção de portão no meio de uma tarefa herda os alvos da tarefa em curso (07/11 16:35, 08/11 11:10): o Orquestrador tratou o caso como trabalho da tarefa, nas duas vezes | 2 | sem proposta: a regra que ele aplicou está no `estado.md`; o passo 7 do `/seguir` não cabe no orçamento de leitura (RF26) por um caso que ele já resolve |

**Revisão da spec.** As 11 não aprovadas: a D85 decidida depois da Tech Spec e fora dela (privacy e revisor-geral, a mesma causa),
o job de sistema que nasce de requisição (tenancy), a provisória gerada duas vezes sem trava, a cota de 300/h e o adiar (infra, três
rodadas), os quatro estados das telas novas (frontend), e quatro do `test-engineer` (o `desativar` que não chega à cláusula, os
homônimos, a variação aleatória da espera). São o desenho que a revisão existe para pegar. A P2 e a P3 da F2b (o cenário de corrida
com a ordem, o arquivo do titular) não reprovaram de novo.

**Falsos positivos.** Nenhum.

## Propostas

### Aviso (só skill, papel ou modelo de documento): aceitas pelo Joaquim e aplicadas às 09:40

**Aviso 1. O `--faltando` é o piso, não a lista** (grupo A, 8)

```
Mudança 1: .claude/skills/executar-task/SKILL.md, depois de "Na X4, a 4.0 e a 6.0 reprovaram por linha que ele já apontava.":
  o --faltando lê a linha com condição e não vê (a) cada termo de uma linha com vários, (b) SQL ou Lua em template string,
  (c) a linha sem condição que protege; esses a pergunta 1 lista à mão.
Mudança 2: .claude/skills/criar-tasks/task-template.md, autoconferência 1: as linhas sem condição que protegem (a chamada que
  confere antes, a fiação de uma guarda, o campo zod) e o SQL ou Lua em template string entram na lista.
Efeito esperado: as oito reprovações do grupo A que a ferramenta não apontava, até a M1 chegar
```

**Aviso 2. A ausência só se afirma depois da resposta** (grupo B, 4)

```
Mudança: task-template.md, autoconferência 5: asserção de ausência ou contagem espera a resposta que poderia trazer o que ela
  nega (waitForResponse, o pedido contado, um controle com o positivo), e o "antes" se lê com a tela parada.
Efeito esperado: as reprovações da 6.0, 12.0, 16.0 e 19.0
```

**Aviso 3. A linha [C] leva a corrida de verdade** (grupo C; o maior 2 da validação)

```
Mudança: task-template.md, depois da tabela de testes: a linha de carga leva o comando, a data, os números e a condição da
  máquina ("Quando a carga vale como registro", docs/runbook.md); a tarefa que muda o que a tela ou a rota manda atualiza o
  cenário de carga.
Efeito esperado: o crítico 1 da validação e a reprovação da 16.0 pelo k6 desatualizado
```

**Aviso 4. Acrescentar também conta** (grupo D, 6)

```
Mudança: executar-task/SKILL.md, "Quem usa o que mudou": serviço, rota, botão numa lista de ações e campo no retorno quebram os
  testes de inventário, com os quatro desta spec citados.
Efeito esperado: os quatro vermelhos da esteira e a reprovação da 7.0. Responde os dois itens do TODO.md dirigidos à retro (a
  lista de rotas com "convite" e o portão arrastar os int vizinhos) sem mexer no portão: o grep acha os quatro, e o portão rodar
  todo int vizinho custaria minutos em toda tarefa por um caso que a busca resolve.
```

**Aviso 5. De onde vem cada coisa da tela** (grupo E, 2)

```
Mudança: .claude/skills/criar-techspec/template.md, §9, parágrafo novo antes de "Altura": cada dado e cada ação da tela citam a
  rota da §4 e o campo do esquema; o que não tem rota vira item da §4 ou sai da tela, antes da revisão da spec.
Efeito esperado: as duas paradas do Joaquim e as três tarefas novas, pegas na Tech Spec
```

**Aviso 6. O teste não depende da máquina nem do relógio de parede; o "Sem aplicar" de cada ordem** (grupo F, 11; e a menor)

```
Mudança 1: task-template.md, autoconferência 10, no fim: instantes do mesmo relógio, folga entre processos, esperar pelo sinal
  e não por tempo, "o último" pela ordem de criação.
Mudança 2: executar-task/SKILL.md, "O que volta": copiar o "Sem aplicar" de cada ordem anterior (.processo/ordens/<documento>-r<n>.md).
Efeito esperado: as correções de relógio e carga em teste novo; a tabela de recomendações inteira no documento
```

### Confirmação

**M1. O `--faltando` termo a termo, e o SQL e o Lua em template string** (grupo A; `tools/processo/mutacoes.ts`, código de processo)

```
Mudança: a linha com vários termos é listada com um item por termo, e só sai com bloco que tire aquele termo ou motivo que o
  cite; a linha nova em template string com SQL ou Lua é listada mesmo sem condição de TypeScript.
Recomendei: aplicar, como correção. O modelo já dizia "cada termo" e o erro voltou porque a lista da ferramenta passa por completa.
```

**M2. O `Write` não reescreve documento com a seção "Revisões"** (grupo G; hook PreToolUse de `Write`, código de processo)

```
Mudança: modo novo em tools/processo/hook-revisoes.ts, ligado a um PreToolUse de Write em .claude/settings.json: recusa o Write
  sobre arquivo de tasks/ que já tem "## Revisões" quando o conteúdo novo não traz a tabela de antes.
Recomendei: aplicar, como correção. Cinco perdas em duas specs, uma delas sem volta (a 1ª rodada da 3.0).
```

## Pendências marcadas para a retro

| Pendência | Destino |
|---|---|
| Validação r1, maior 2: a linha do resultado de todo [C] | aviso 3; item do `TODO.md` fechado |
| Validação r2, menor 1: triagem com rota e migration sem `revisar-spec` | fechado sem mudança: a tarefa nova leva todos os guardiões, que leram o desenho na 18.0, e nada se perdeu |
| Validação r3, menor 2: "Sem aplicar" de todas as rodadas | aviso 6; item fechado |
| A fila de carga não serializa a unidade de outra linha | fechado sem mudança: o remédio é o teste não depender da carga (aviso 6); serializar a unidade serializaria as linhas |
| A lista de rotas com "convite" só roda na esteira; o portão arrastar os int vizinhos | aviso 4; itens fechados, o portão fica como está |
| 2.0: o alerta de idade da fila `normal` | não agora; fica no `TODO.md`, para a spec de infra antes do piloto |
| 16.0: três recomendações do `test-engineer` (`expect.poll`, a espera de 50 ms, a fração de alunos pela conta) | o padrão foi às perguntas 5 e 10; os três casos ficam no `TODO.md` (Implementador) |
| E2e que andam o fluxo à mão sob carga; nenhum e2e do aceite até a entrada na mesma aba | ficam no `TODO.md` (Implementador); o padrão está no aviso 6 |
| Estado: o portão usado como depurador (5.0) | uma ocorrência, diagnosticada na escalada; sem proposta |

## O que tirar

Nada. O `tenancy-guardian` e o `conformidade-reviewer` rodaram 37 vezes cada sem reprovar, e o `frontend-reviewer` 16, mas cada um
deixou recomendação que entrou (o índice tem as linhas), e correm em paralelo, ~40 s. Numa spec de autenticação, tirar o guardião de
isolamento por não ter reprovado seria ler o número ao contrário (regra 10).

## Decisão

Mostrei o bloco ao Joaquim em 11/11/2026, às ~09:20, no terminal do Arquiteto 2; ele respondeu "aprovo" às 09:40, que vale a
recomendação de cada uma. Apliquei os seis avisos na hora; o harness de processo (`tools/processo/harness`, 609 casos) ficou verde
com eles. M1 e M2 mudam código e entram como correção no `TODO.md`.

| Proposta | Decisão | Onde |
|---|---|---|
| Aviso 1. O `--faltando` é o piso | aplicada | `executar-task/SKILL.md`, passo 2; `task-template.md`, autoconferência 1 |
| Aviso 2. A ausência depois da resposta | aplicada | `task-template.md`, autoconferência 5 |
| Aviso 3. A linha [C] leva a corrida | aplicada | `task-template.md`, depois da tabela de testes |
| Aviso 4. Acrescentar também conta | aplicada | `executar-task/SKILL.md`, "Quem usa o que mudou" |
| Aviso 5. De onde vem cada coisa da tela | aplicada | `criar-techspec/template.md`, §9 |
| Aviso 6. Máquina e relógio; o "Sem aplicar" de cada ordem | aplicada | `task-template.md`, autoconferência 10; `executar-task/SKILL.md`, "O que volta" |
| M1. O `--faltando` termo a termo | aceita, como correção | `TODO.md`, "(F2c, retro, M1)" |
| M2. O hook do `Write` sobre "Revisões" | aceita, como correção | `TODO.md`, "(F2c, retro, M2)" |
