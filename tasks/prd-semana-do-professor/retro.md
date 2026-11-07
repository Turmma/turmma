# Retrospectiva — semana-do-professor (F2b)

07/11/2026, pelo Arquiteto 2, no térreo, depois do pouso (`43f122d7`, esteira verde). **Completa** (D86): a taxa caiu muito
(2,2% contra 15,4% da F2), mas quatro causas se repetiram, três delas fora da revisão das tarefas (a revisão da spec, o encontro das
linhas e a interface). Comparação com a retro da F2 (`tasks/prd-onboarding-por-convite/retro.md`) e, nas cinco medidas da D79, com a
do F3.

O que pesa nos números: 8 tarefas, todas de porte grande, todas com Sonnet 5.5, em três linhas a partir da 3.0; uma pausa de 3 h 50
pedida pelo Joaquim (06/11 16:30 → 20:20); e as três linhas rodando e2e e mutação ao mesmo tempo, com a carga da máquina entre 14 e 25.

## Medidas

```
Tarefas: 8 · Rodadas de revisor: 90 · Reprovações: 2 (2,2%)
Por revisor: revisor-geral 17/1 · test-engineer 16/1 · tenancy-guardian 13/0 · privacy-guardian 13/0
             infra-guardian 13/0 · conformidade-reviewer 13/0 · frontend-reviewer 5/0
Por modelo do implementador: Sonnet 5.5 nas 8; 11,3 rodadas e 0,25 reprovação por tarefa; nenhum diagnóstico do Arquiteto;
  nenhuma escalada; 2 divergências de desenho (6.0, parada do Joaquim; 8.0, triagem) e 1 de portão (1.0);
  pedido → commit com mediana de ~87 min (sem a pausa)
Rodadas por tarefa: média 11,3; pior 7.0 e 8.0 com 14 (duas rodadas de sete revisores, sem reprovação)
Rodadas que caducaram sem reprovação: 37 de 90 (41%)
Correções fora de tarefa: 4 (base-fixa-acima-do-limite, encontro-4-semana, e2e-conflito-do-gerar, carga-da-semana),
  22 rodadas, 1 reprovação
Duração: spec 06/11 12:12 → tarefas 13:50 (1 h 38)
  construção 14:40 (divergência de portão da 1.0) → 07/11 02:04 (carga-da-semana): 11 h 24, ou 7 h 34 sem a pausa
  fechamento: validação às 02:20 (16 min depois do último código); M1 respondida 09:37; pouso 09:56
Revisão da spec: 5 rodadas, 19 rodadas de revisor, 13 não aprovadas, em 22 min
Validação: rodada 1 APROVADA COM RESSALVAS (0 crítico, 1 maior de documento, 7 menores)
```

Como contei: as seções "Revisões" dos oito `N_task.md`, de `revisao-spec.md` e das quatro correções; o tempo pelo `git log` (as
horas do `estado.md` batem com ele, depois da P7 da F2); a esteira por `gh run list --branch spec/semana-do-professor`.

| | F3 | X8 | F2 | F2b |
|---|---|---|---|---|
| Tarefas | 20 | 13 | 16 | 8 |
| Reprovações nas tarefas | 22,9% | 15,2% | 15,4% | **2,2%** |
| Rodadas por tarefa | 11,8 | 11,6 | 12,2 | 11,3 |
| Caducadas sem reprovação | 34% | 30% | 33% | 41% |
| Correções fora de tarefa | 9 | 26 | 13 | 4 |
| Crítico ou maior no 1º /validar | 1 c, 2 M | 1 c (+1 c) | 2 c | 1 M (documento) |
| Tarefas sem nenhuma reprovação | 1 de 20 | 1 de 13 | 1 de 16 | **6 de 8** |
| Rodadas da revisão da spec (não aprovadas) | — | 29 (21) | 35 (27) | 19 (13) |

## As cinco medidas da D79

**1. Do pedido ao commit.** Mediana de **~87 min** (1.0 30, 2.0 48, 5.0 73, 3.0 80, 8.0 93, 7.0 116, 4.0 117, 6.0 170), contra 68 na F2
e 99 no F3. Pesam duas coisas: as oito eram de porte grande, e as três linhas dividiram a máquina (a 6.0 leva os 15 min da parada do
`DaySelector`).

**2. Tarefas sem reprovação.** **6 de 8**, contra 1 de 16 na F2 e 1 de 20 no F3. É a primeira vez que o número se mexe. As duas
reprovações são uma do relógio no e2e (6.0, grupo B) e uma de destino `TODO.md` prometido e não escrito (4.0; uma ocorrência, sem
proposta: o `task-template.md` já diz que o destino é "a linha já escrita").

**3. O grupo A (cláusula sem prova).** **0**, contra 7 na F2, 9 na X8 e 17 no F3. O bloco que diz qual `expect` cai (M1 da X8) e o
`--faltando` lido como obrigação chegaram.

**4. Vermelhos da esteira por push.** 24 execuções: **6 verdes, 3 vermelhas, 14 canceladas** (superadas) e a do pouso. Do push ao
veredito, ~38 min. Os três vermelhos: a base fixa 6 B acima do limite pela D87 (`b9b05fec`, antes das tarefas; correção
`base-fixa-acima-do-limite`), um e2e da F2 que dependia da releitura de 15 s (`b388f260`; correção `e2e-conflito-do-gerar`) e o nome
`Linha` num arquivo novo da 3.0 que o `restos` não viu (`0cd5dd46`; consertado dentro da `encontro-4-semana`). Nenhum é das regras da
F2b; o terceiro é a M1 da retro da F2, aceita e ainda aberta (grupo E).

**5. Do último commit ao pouso.** Último código às 02:04, validação às 02:20, pouso às 09:56: 7 h 52, quase tudo a noite esperando a
resposta da M1. Tempo de processo: **~35 min** (16 da validação, 19 do fechamento depois da resposta), contra 44 na F2.

**As 37 rodadas que caducaram sem reprovação** são a rodada 2 inteira de seis tarefas cuja rodada 1 aprovou com recomendações: a Mesa
manda aplicá-las numa ordem só (`revisar-tarefa`, "Há o que corrigir ou aplicar"), elas mudam código de produção, e a caducidade já
poupa quem não lê teste nem comentário (3.0 e 5.0 só rodaram dois revisores). Custou ~20 min por tarefa (de 11 a 34). Não proponho
mudar: a recomendação aplicada é o que segurou as reprovações em 2, e o `revisar-tarefa` já limita a uma vez por documento.

## Grupos de causa

| # | Causa | Ocorrências | Onde evitar |
|---|---|---|---|
| A | **O encontro recusado pelo prazo fixo de 180 s da verificação**, com outra linha em e2e ou mutação (carga de 14 a 25 em 12 núcleos). Nenhum tinha defeito: repetido com a máquina calma, ou com `EDUCA_ENCONTRO_PRAZO_DA_VERIFICACAO_MS=540000`, passou | 5 (3.0, 6.0, `e2e-conflito-do-gerar`, 5.0, 8.0), cada um de 10 min a 1 h de espera | código de processo: `tools/processo/linhas.ts:49` |
| B | **e2e que depende do relógio real**: a cena só tem aula na terça e na quarta e o caso procura a coluna de hoje (falha todo sábado e domingo); o item criado antes da meia-noite de domingo cai em outra semana | 2 (6.0, reprovação do `test-engineer`; 8.0, recomendação "levar à retro") | `task-template.md`, autoconferência 10 |
| C | **Cenário de corrida da Tech Spec que não força a ordem nem cai com a ordem trocada** | 3 cenários, 5 reprovações na revisão da spec (R1, `tenancy-guardian` 3ª; J16, `infra-guardian` e `test-engineer` 4ª; G1 "passado", `test-engineer` 2ª e 3ª) | `criar-techspec/template.md`, §7c "Corridas de concorrência": a linha pede "o cenário em paralelo que a prova", e não diz que o cenário nomeia a ordem e a troca que o derruba |
| D | **Tabela nova com dado pessoal sem dizer em que versão do arquivo do titular entra** | 3 reprovações na 1ª rodada da revisão da spec (`tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`) | `criar-techspec/template.md`, §7 "Dado pessoal" |
| E | **A mudança de tela que não chega à `docs/interface.md`**: a divergência da 8.0 (um link por disciplina) foi à Tech Spec §9 e ao `cenarios.md` T5, não à 1.8 (a M1 da validação); a prop `contadorAnunciado` do `Textarea` (7.0) não foi à 10.2 (m2), porque o "Contexto" da tarefa dizia "`docs/interface.md` 1.8: não edite" | 2 | `arquiteto.md`, "Divergência"; `executar-task`, depois de "Quem usa o que mudou" |
| F | **A edição sem commit da triagem no andar da spec** trava o encontro de outra linha: a triagem da 8.0 deixou a §9 e o T5 sem commit no andar, a 5.0 mexia nos mesmos arquivos, e o 1º encontro da 5.0 foi recusado (a cópia do andar foi descartada, a linha 1 já a tinha). Na 6.0, com o Arquiteto aberto no checkout da linha 3, deu certo. O passo 6 do `/seguir` diz "reinicie o `Arquiteto` no andar" | 1 (mais a 6.0, que mostra o caminho certo) | `seguir/passos/6-tarefa.md` e `arquiteto.md`: vai junto da P4, que mexe no mesmo parágrafo |
| — | A M1 da retro da F2 (o `restos` vê o arquivo novo), aceita em 06/11 e ainda aberta no `TODO.md`, custou de novo: a 3.0 entrou na spec com o portão vermelho, a esteira de `0cd5dd46` caiu e a `encontro-4-semana` levou o conserto | 1 | já aceita: recomendo ao Orquestrador abri-la antes das tarefas da próxima spec |
| — | A base fixa passou de 40.000 B com a linha da D87 no `CLAUDE.md`; hoje está em **39.642 B**, sobra para quatro ou cinco linhas de decisão | 1 | `registrar-decisao`: P5, barata, antes de voltar |
| — | `linhas.ts` sem caminho para o commit de documento feito na linha depois do encontro (`f64232d9`, juntado à mão em `5b43da40`) | 1 | sem proposta: o Implementador não devia deixar documento sem commit; o caso fica aqui |

**Revisão da spec.** As 13 não aprovadas: 5 do grupo C, 3 do D, 4 sobre o desenho das travas do `PUT /v1/aulas` (a corrida 2 só
num ramo; a trava consultiva com a chave do corpo antes de conferir o dono; a gravação sem a trava do ano em curso; a ordem das
travas contra o `encerrarOsMarcados`) e 1 da escola sem ano letivo em curso. As do desenho das travas são o que a revisão existe
para pegar, e a tabela de corridas saiu boa para as tarefas: a validação elogiou J11a a J16 como padrão. A revisão inteira levou 22
min, contra horas na F2: a P4 da F2 (contar as tarefas antes) não foi exercida, a F2b tinha 8.

**Falsos positivos.** Nenhum.

## Propostas

### Aviso (só skill, papel ou modelo de documento): aplicadas depois de 07/11 11:15, sem objeção

**P1. O e2e não depende do dia de hoje** (grupo B, 2)

```
Mudança: .claude/skills/criar-tasks/task-template.md, autoconferência 10, no fim: "Caso de e2e que olha 'hoje', a semana ou o
  mês correntes: a cena tem dado no dia da semana de hoje (como o T9 da F2b, `grade: () => [{ dia: diaDeHoje, … }]`), ou o
  relógio parado com `page.clock`; o caso passa num sábado, num domingo e às 23h59 de domingo. Na F2b, a 6.0 reprovou com três
  casos que caíam todo fim de semana, e a 8.0 criava o item antes da virada da semana."
Efeito esperado: a reprovação da 6.0 e o vermelho de fim de semana que ninguém vê na sexta
```

**P2. O cenário de corrida nomeia a ordem e a troca que o derruba** (grupo C, 5 reprovações da revisão da spec)

```
Mudança: .claude/skills/criar-techspec/template.md, §7c, linha "Corridas de concorrência", depois de "e o cenário em paralelo que
  a prova": "; o cenário diz a ordem forçada (quem segura a trava, quem chega depois, com `esperarNaTrava` ou `WriteBlockTrigger`)
  e a troca que o deixa vermelho (a ordem antiga das travas, a trava tirada, o passo antes de outro); cenário que passa nas duas
  ordens não prova a trava (na F2b, R1, J16 e G1 caíram na revisão da spec por isso)"
Efeito esperado: as cinco reprovações do grupo C, e o desenho do cenário chegando pronto à autoconferência 10 da tarefa
```

**P3. O arquivo do titular na tabela de dado pessoal** (grupo D, 3)

```
Mudança: .claude/skills/criar-techspec/template.md, §7, linha nova depois de "Retenção e expurgo":
  "| Arquivo do titular | a tabela nova com dado de pessoa entra em qual versão (`packages/core/src/titular/leitura-do-titular.ts`,
  critério do cabeçalho), e quem mais a lê por ele (a coordenação que pede o arquivo) |"
Efeito esperado: as três reprovações da 1ª rodada da revisão da spec da F2b
```

**P4. A divergência chega à interface, e é escrita no checkout da linha** (grupos E e F)

```
Mudança 1: .claude/agents/arquiteto.md, "Divergência", segundo item: "registre na `techspec.md` (e no `cenarios.md`, se houver, e na
  `docs/interface.md`, quando a decisão muda o que uma tela mostra ou uma peça do catálogo), sem commit, **no checkout em que a
  tarefa corre** (o da linha; o andar recebe pelo encontro), …" Na F2b, a 1.8 ficou para trás na 8.0 (a M1 da validação), e a
  edição no andar recusou o encontro da 5.0.
Mudança 2: .claude/skills/seguir/passos/6-tarefa.md, `DIVERGÊNCIA` de `desenho` ou `ordem`: "reinicie o `Arquiteto` no checkout da
  linha da tarefa (sem linhas, no andar)".
Mudança 3: .claude/skills/executar-task/SKILL.md, parágrafo novo depois de "Quem usa o que mudou": "**O catálogo.** Peça de
  `components/ui` nova, ou com prop nova, ganha a linha na `docs/interface.md` 10.2 no commit da tarefa, como o `DaySelector` na
  6.0 da F2b. O 'não edite' do Contexto vale para a seção da tela, não para o catálogo da peça que você mudou (na 7.0, o
  `contadorAnunciado` do `Textarea` ficou fora e voltou como menor da validação)."
Efeito esperado: a M1 e o m2 da validação; o encontro recusado da 5.0
```

**P5. A decisão nova confere a base fixa** (uma ocorrência, sobra de 358 B)

```
Mudança: .claude/skills/registrar-decisao/SKILL.md, depois de "No índice do `CLAUDE.md`, uma linha só": "Antes do commit, rode
  `npx vitest run tools/processo/harness/base-fixa.test.ts`. Passou do limite: enxugue o `CLAUDE.md` (o título da linha, ou um parágrafo
  que repete um documento), nunca suba o limite. Na F2b, a linha da D87 deixou a base 6 B acima, e a 1.0 parou numa DIVERGÊNCIA de
  portão que não era dela."
Efeito esperado: a próxima decisão não para uma tarefa (sobram ~4 linhas de decisão)
```

### Confirmação

**M1. O prazo da verificação do encontro** (grupo A, 5; `tools/processo/linhas.ts`, código de processo)

```
Mudança: tools/processo/linhas.ts:49-50 — PRAZO_DA_VERIFICACAO_MS de 3 para 9 min, e o com `npm ci` de 6 para 12 min, com o
  comentário do porquê (três linhas dividem 12 núcleos; tipagem e lint passam de 180 s com carga 14 a 25). O caso de
  `linhas.test.ts` que fixa o padrão muda junto, e o bloco de mutação do prazo segue valendo.
Por que 9: com 540 s, a verificação da `e2e-conflito-do-gerar` passou com carga 25, a pior da noite.
Efeito esperado: os cinco encontros recusados sem defeito, e as esperas de 10 min a 1 h do Orquestrador
Recomendo: aplicar, como correção (`TODO.md`). O prazo existe para pegar verificação travada; 9 min ainda pega
```

**C1. As três escolhas da tela do painel da aula que a 7.0 levou à retro** (frontend-reviewer, 1ª; mudam comportamento de tela)

```
(a) "Preparar esta aula" com rascunho não salvo: hoje o rascunho se perde, e a dica só fala de "Fechar sem salvar".
    Recomendo: a dica cobre os dois botões ("Fechar e Preparar deixam de lado o que não foi salvo"), sem pergunta nova.
(b) Esc ou "Fechar" durante "Salvando…": o painel fecha e o erro de uma falha tardia some com ele.
    Recomendo: manter (é a Tech Spec, e a gravação leva menos de 1 s); sem mudança.
(c) A semana relida sem a aula fecha o painel sozinho, com o rascunho dentro e sem frase.
    Recomendo: o painel fica aberto com a frase "Esta aula saiu da grade; o texto não foi salvo" e o "Salvar" desligado,
    para a professora copiar o que escreveu.
Destino de (a) e (c): uma correção de tela (`TODO.md`), com o `frontend-reviewer`, e a 1.8 da interface junto.
```

## Pendências marcadas para a retro

| Pendência | Destino |
|---|---|
| m2: `contadorAnunciado` na 10.2 | feito neste commit (`docs/interface.md` 10.2, linha dos campos) |
| m3: "F2b, 2.0" → "4.0" no `modelo-de-dados.md` | feito neste commit |
| S7 do `cenarios.md` (vínculo "encerrado por realocação"; o caso usa o desligado) | feito neste commit: "encerrado antes (por desligamento ou realocação)" |
| As três da 7.0 (dica do Preparar, Esc em "Salvando…", painel que fecha sozinho) | C1 |
| 8.0, privacy: aviso "não escreva nome de aluno" no título da atividade | fica no `TODO.md` como está: o campo é da ferramenta que gera a atividade, e o aviso vai com a próxima tarefa que tocar o formulário dela |
| 8.0, test-engineer: o e2e dos itens depende do relógio real | P1; o caso em si fica no `TODO.md` |
| 4.0, infra: parágrafo do runbook sobre a virada do ano em horário de aula | fica no `TODO.md`, com dono trocado: o `docs/runbook.md` tem suíte (`alerta-tem-runbook`, `caducidade.ts:254`) e entra por correção, não por commit de documento |
| 5.0, conformidade: avisar só a professora do texto apagado com a aula que saiu da grade | junto do m1 (o pareamento da aula dupla), no PRD da próxima fase que mexer na reimportação: as duas são o que a reimportação faz com o texto |
| Estado: o item de carga da 2.0 dado à 6.0 não chegou aos revisores dela | resolvido pela correção `carga-da-semana`; uma ocorrência, sem proposta |

## O que tirar

Nada. O `conformidade-reviewer` e os outros três guardiões rodaram 13 vezes cada sem reprovar, mas cada um pediu algo que entrou (o
índice tem as linhas), e correm em paralelo, ~40 s.

## Decisão

Mostrei o bloco ao Joaquim em 07/11/2026, às 10:50, no terminal do Arquiteto 2. Ele respondeu "aprovei a retro no Arquiteto 2" no
terminal do Orquestrador, às 11:01, que o repassou: vale a recomendação de cada uma. Apliquei os avisos junto, sem esperar as 11:15.
M1 e C1 mudam código e entram como correção no `TODO.md`.

Uma mudança ao aplicar a P4: a frase nova do `seguir/passos/6-tarefa.md` saiu mais curta, sem o exemplo da 5.0, porque o orçamento
de leitura por tarefa (RF26, `tools/processo/harness/seguir.test.ts`) passou de 24.000 B com ela inteira. O exemplo ficou no
`arquiteto.md`.

| Proposta | Decisão | Onde |
|---|---|---|
| P1. O e2e não depende do dia de hoje (aviso) | aplicada | `criar-tasks/task-template.md`, autoconferência 10 |
| P2. O cenário de corrida nomeia a ordem e a troca que o derruba (aviso) | aplicada | `criar-techspec/template.md`, §7c |
| P3. O arquivo do titular na tabela de dado pessoal (aviso) | aplicada | `criar-techspec/template.md`, §7 |
| P4. A divergência chega à interface, escrita no checkout da linha (aviso) | aplicada, com a frase do passo 6 encurtada | `arquiteto.md`, "Divergência"; `seguir/passos/6-tarefa.md`; `executar-task/SKILL.md`, "O catálogo" |
| P5. A decisão nova confere a base fixa (aviso) | aplicada | `registrar-decisao/SKILL.md` |
| M1. O prazo da verificação do encontro, 9 e 12 min | aceita, como correção (código de `tools/`) | `TODO.md`, "(F2b, retro, M1)" |
| C1. O painel da aula com rascunho | aceita como recomendada: (a) e (c) numa correção de tela, (b) fica | `TODO.md`, "(F2b, retro, C1)" |
| Pendências: m2, m3, S7 | feitas neste commit | `docs/interface.md`, `docs/modelo-de-dados.md`, `cenarios.md` |
