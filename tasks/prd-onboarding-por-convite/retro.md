# Retrospectiva — onboarding-por-convite (F2)

06/11/2026, pelo Arquiteto, no térreo, depois do pouso (`d0479ad9`). Comparação com a retrospectiva da X8
(`tasks/prd-nomes-de-mercado/retro.md`) e, nas cinco medidas da D79, com a do F3 (`tasks/prd-lgpd-e-titular/retro.md`).

O que pesa nos números:

- é a primeira spec de **produto** depois da X8, e a primeira com linhas em paralelo desde o começo: 16 tarefas em duas linhas,
  todas com Sonnet (o `implementador.md`);
- a spec foi **cortada em duas** depois da revisão (F2 aqui, F2c `acesso-e-convites`), por decisão do Joaquim em 03/11;
- três paradas de máquina: a formatação do PC (04/11 10:10 → 22:05), as sessões que caíram (05/11 manhã) e cinco horas esperando um
  `wsl --shutdown` que não consertou o relógio da VM (05/11 18:25 → 23:06; já virou "Máquina não é parada", `ccc762a8`).

## Medidas

```
Tarefas: 16 · Rodadas de revisor: 195 · Reprovações: 30 (15,4%)
Por revisor: test-engineer 35/14 · revisor-geral 35/9 · infra-guardian 30/3 · tenancy-guardian 29/2 · privacy-guardian 29/1
             conformidade-reviewer 29/0 · frontend-reviewer 8/1
Por modelo do implementador: Sonnet nas 16; 12,2 rodadas e 1,9 reprovação por tarefa; 2 diagnósticos do Arquiteto
  (3.0 e a correção e2e-contrato-da-lista-8, os dois com ESCALADA); 7 triagens de divergência; nenhum BLOQUEIO;
  pedido → commit com mediana de ~68 min (14 tarefas legíveis)
Rodadas por tarefa: média 12,2; pior 1.0 com 18 (três rodadas) e 3.0 com 15 (três tentativas, escalada, diagnóstico)
Rodadas que caducaram sem reprovação do próprio revisor: 65 de 195 (33%)
Correções fora de tarefa: 13, com 105 rodadas e 8 reprovações (7,6%)
Duração: spec 03/11 09:59 → tarefas 16:01 (~6 h, com 1 h 40 de VM parada e a pergunta do corte)
  construção 03/11 16:10 (1.0) → 06/11 05:10 (16.0): 1.0 a 11.0 em 18 h; 12.0 a 16.0 em ~18 h depois da formatação
  intervalo entre commits de tarefa: mediana ~88 min (de 15 min a 8 h 04)
  fechamento 06/11 05:10 → pouso 10:48 (três rodadas de validação, seis correções)
Revisão da spec: 10 rodadas, 35 rodadas de revisor, 27 não aprovadas (X8: 29/21; X4: 18)
Validação: rodada 1 REPROVADA (2 críticos), 2 APROVADA, 3 APROVADA (revalidação depois de duas correções de teste)
```

Como contei: as tabelas "Revisões" dos 16 `N_task.md`, de `revisao-spec.md` e das 13 correções do período (as 11 datadas de 03 a
06/11 em `tasks/correcoes/`, mais `encontro-6-onboarding` e `encontro-10-onboarding`). A 10.0 e a 16.0 perderam a 1ª rodada da seção
"Revisões" quando o documento foi reescrito; ela foi recontada pelo `achados/indice.md` (grupo H). O tempo pelo `git log`, e não
pelas horas do `estado.md`: de 06/11 ~02:00 em diante elas saíram de 6 a 7 h adiantadas (o commit `19f8e2cc`, das 10:06, escreve
"~16:00"; grupo I). A esteira por `gh run list --branch spec/onboarding-por-convite`.

| | F3 | X4 | X8 | F2 |
|---|---|---|---|---|
| Tarefas | 20 | 11 | 13 | 16 |
| Reprovações nas tarefas | 22,9% | 10,4% | 15,2% | 15,4% |
| Rodadas por tarefa | 11,8 | 12,2 | 11,6 | 12,2 |
| Caducadas sem reprovação | 34% | 33% | 30% | 33% |
| Correções fora de tarefa | 9 | 19 | 26 | 13 |
| Crítico ou maior no 1º /validar | 1 c, 2 M | 1 c | 1 c (+1 c) | 2 c |
| Tarefas sem nenhuma reprovação | 1 de 20 | 2 de 11 | 1 de 13 | 1 de 16 |
| Rodadas da revisão da spec (não aprovadas) | — | 18 | 29 (21) | 35 (27) |

## As cinco medidas da D79

**1. Do pedido ao commit.** Mediana de **~68 min** nas 14 tarefas em que a partida está no `estado.md` (a 12.0 e a 13.0 atravessaram a
noite da formatação e ficam de fora); era **99 min** no F3. A mais longa foi a 14.0 (8 h, com as cinco horas do relógio da VM), depois
a 10.0 (3 h 36: o portão ficou vermelho no lint às 05:31 e o Implementador esperou 2 h 30 sem ver). Onze tarefas em 18 h, nas duas
linhas, é o melhor ritmo medido até aqui.

**2. Tarefas sem reprovação.** 1 de 16 (15.0). Era 1 de 20 no F3. O número não se mexe: quase toda tarefa leva uma reprovação, quase
sempre do `test-engineer`, e aprova na 2ª.

**3. O grupo A (cláusula sem prova).** **7** reprovações do `test-engineer` por cláusula nova sem bloco de mutação ou sem caso que a
alcance (4.0, 5.0, 7.0, 8.0, 10.0, 11.0, 12.0), contra 17 no F3 e 9 na X8. O `--faltando` as lista em todas; o que falta é ler a lista
como obrigação. Não proponho mudar o portão agora: a M1 da X8 (o bloco diz qual `expect` cai) ainda está no `TODO.md`, e a próxima mudança
no `mutacoes.ts` vai junto dela.

**4. Vermelhos da esteira por push.** 42 execuções: **13 verdes, 7 vermelhas, 21 canceladas** (superadas), 1 em curso. Do push ao
veredito, mediana de **40 min**, máximo de 45. Dos 7 vermelhos, **4 foram do `restos` da X8** em arquivo novo (2.0, 9.0, 11.0, 13.0;
grupo B), 2 da mesma métrica com `escola_id` fora da lista fechada do teste de infra (6.0 e 7.0, uma causa só) e 1 intermitente
(`incidentes.spec.ts:295`, não voltou). Cada vermelho do `restos` custou uma correção de ~30 a 60 min e um par reiniciado.

**5. Do último commit ao pouso.** Último commit com mudança fora de `tasks/` às 10:04 (`965fdf49`), pouso às 10:48: **44 min**. Do
último commit de tarefa (16.0, 05:10) ao pouso, 5 h 38, contra 5 h 29 no F3: a validação reprovou uma vez (dois críticos), e duas
correções de teste do despachante, fora da spec, pediram a terceira rodada.

## Grupos de causa

### Tarefas (30 reprovações)

| # | Causa | Ocorrências | Onde | Onde evitar |
|---|---|---|---|---|
| A | **Cláusula nova sem bloco ou sem caso que chegue nela** | 7 | 4.0 (`anoPorId`), 5.0 (teto de 100 KB; blocos prometidos que não existem), 7.0 (`tipo.travar?.()`), 8.0 (escrita condicional do nome), 10.0 (`ne(vinculo.estado, 'encerrado')` com motivo falso; `delete` de `retirarNomes`), 11.0 ("não vê" só no nome do caso), 12.0 (`.for('update')`) | autoconferência 1; medida 3 acima |
| C | **A corrida não é corrida, ou é na direção errada** | 4 tarefas, 6 reprovações | 3.0 ×4 (o N1 da A1: o teste montava um estado que não existe; a corrida passa pela transição), 7.0 (`esperarNaTrava` acha o próprio job, e a API dispara depois; HTTP dentro do `lock_timeout` de 1 s), 9.0 (o cenário pede o job primeiro e o teste prova a aprovação primeiro, com SQL à mão), 12.0 ("sai da grade" só em sequência) | `N_task.md`: a autoconferência 10 diz "force a ordem", mas não diz as três armadilhas do job do passo (3) |
| D | **Divergência decidida só no documento da tarefa** | 4 | 3.0 (encerramento fora do `encerrar`), 5.0 (duas), 8.0 (quatro, no mesmo documento), 10.0 (a trava nova) | já é regra (`executar-task`, aviso crítico do passo 2; autoconferência 8); falta o passo mecânico antes da rodada |
| E | **O ano esconde a escola no teste de isolamento** | 3 (1 crítico) | 1.0 (recomendação do `test-engineer`: os repositories irmãos filtram escola e ano, e só a escola tirada fica verde), 4.0 (`anoPorId`), validação rodada 1 (`GradeRepository.aulasDaTurma`: o caso passava o ano da A com a turma da B; correção `escopo-de-escola-da-grade`) | autoconferência 11 e o "O que verificar" do `tenancy-guardian`: os dois pedem "remova a cláusula", e nenhum diz que o ano de cada escola já separa |
| F | **Limite de corpo global sem dizer em quais rotas vale** | 2 tarefas, 3 reprovações | 5.0 (o teto novo quebrou o envio de material: infra e revisor-geral), 8.0 (o 1 MB estendido a rotas que a spec não citava) | Tech Spec: a §7c dizia o teto, não o middleware que já cobre as outras rotas (`apps/api/src/configure-app.ts`) |
| G | **Acesso à tabela global `conta` fora da cerca** | 2 tarefas, 4 reprovações | 1.0 (ponte pelo barril de `estrutura/`, já cercada na própria 1.0), 6.0 (`travarContas` no `ImportacaoRepository`, com `requireEscolaId()` chamado e descartado) | o tenancy-guardian pegou as duas; a brecha do `requireEscolaId()` descartado está declarada como limite conhecido da guarda. Uma ocorrência depois da cerca nova: sem proposta |
| — | Tela: `AbortController` cancelado no `StrictMode` (13.0), texto pedindo não escrever nome de pessoa (14.0) | 1 cada | — | sem proposta |

**Falsos positivos.** Nenhum. A divergência entre o `infra-guardian` e o `test-engineer` na 3.0 (o convite pendente entra ou não no
desativar) era real: a triagem e o diagnóstico mudaram a Tech Spec (§2, RF6).

### Correções e esteira (o que custou fora das tarefas)

| # | Causa | Ocorrências | Onde evitar |
|---|---|---|---|
| B | **O `restos` da X8 não vê arquivo novo.** `tools/renomear/arvore.ts:29` lista só `git ls-files --cached`; o arquivo que a tarefa cria ainda não está no índice quando o portão roda, e o resto do mapa (`migrar`, `Linha`, `Banco`, `Escolha`, `chamarApi`) só aparece no portão da tarefa seguinte, ou na esteira | 5 (2.0, 9.0, 11.0, 13.0, 16.0): 4 dos 7 vermelhos da esteira e as correções `comentario-com-simbolo-do-mapa`, `restos-linha-na-9`, `restos-da-carga-da-16`, mais parte da `nona-fatia` e da `encontro-10-onboarding` | código de processo: o `restos` vê o arquivo não ignorado que ainda não foi adicionado |
| J | **Encontro com conflito em arquivo que nenhuma das duas previu** | 2 | `encontro-6-onboarding` (os barris `index.ts` de `core/importacao`, `core` e `shared`, pela 5.0 e pela 6.0), `encontro-10-onboarding` (a assinatura do `travar` do motor, pela 10.0 e pela 11.0) | `criar-tasks`, "Autorize o paralelo": o barril não é citado como arquivo de registro, e a peça que as duas estendem (o motor) não é tratada como tronco |
| K | **Contrato ou limite compartilhado que quebra teste que a tarefa não tocou** | 3 | 8.0 (o contrato novo da lista derrubou quatro specs de e2e que sobem a lista pela tela; correção de três tentativas, duas triagens, escalada e diagnóstico), 16.0 (o teto de 100 quebrou o caso de 501 da 10.0: crítico 1 da validação), 4.0 (a métrica nova com `escola_id` fora da lista fechada de `infra/test/metricas.int.test.ts`; dois vermelhos) | `executar-task`: a regra 40 diz o preço ("o que a tarefa quebra fora dos testes que alterou aparece uma tarefa depois"), e nada manda procurar quem usa o que mudou |
| L | e2e perto do prazo (entrada e recarga pela tela sob o perfil lento) | 2 (`nona-fatia`, `e2e-perto-do-prazo-da-f2`) | a receita já existe (`entrarPelaApiSemMedirAPrimeiraCarga`, `e2e/support/`); é a quinta correção com a mesma causa desde 26/10. Sem proposta nova: a "Como testar" de toda tarefa com e2e já deve apontá-la (contexto das tarefas) |
| M | Teste de temporização que dependia do relógio da máquina | 3 (`synthetic.test.ts` dentro da `nona-fatia`, `slots-vaga-…`, `despachante-sem-prazo-…`), todos fora da spec | a validação registrou a receita (estado escrito e rodada chamada à mão); o caso irmão já está no `TODO.md`. Sem proposta |

### Revisão da spec (27 não aprovadas em 35)

| # | Causa | Ocorrências | Onde evitar |
|---|---|---|---|
| N | **A spec foi revista inteira antes do corte.** O corte em duas specs só apareceu no `criar-tasks`, depois da rodada 8; das 27 não aprovadas, pelo menos 13 foram sobre o que saiu para a F2c (a conta global no worker, tenancy 1 a 3 e revisor-geral 1 a 3; a senha provisória e o link da conta, privacy 2 a 6) | 13+ | `criar-techspec`: o teto de palavras é medido uma vez, ao salvar (a Tech Spec saiu com 1.999 e chegou a 3.616 na revisão); nada manda contar as tarefas antes de pedir a revisão |
| — | O passo (3) do job desenhado por partes: cada correção abria uma janela nova (rodadas 3 a 7: estado sem saída, `fechar` aceitando `encerrada`, releitura sem trava, ordem das travas e `40P01`) | 6 | é o que a revisão existe para pegar; a tabela de corridas do `cenarios.md` saiu boa e serviu às tarefas (grupo C) |

### Processo do Orquestrador

| # | Causa | Ocorrências | Onde evitar |
|---|---|---|---|
| H | **A seção "Revisões" apagada ao reescrever o documento** | 2 (10.0, 16.0; e duas na X1) | o protocolo proíbe (item 5), e ninguém trava: um hook pode |
| I | **Horas do `estado.md` estimadas, e a tabela "Concluídas" sem linhas**: de 06/11 ~02:00 em diante, todas as horas de "Agora" saíram 6 a 7 h à frente do git; e as tarefas encontradas entraram como itens soltos acima da tabela (8 delas) ou não entraram (4.0 a 11.0), sem modelo nem rodadas | 9+ | `seguir/passos/estado-md.md` |

## Propostas

### Aviso (só skill, papel ou modelo de documento)

**P1. As três armadilhas da corrida contra o job** (grupo C, 4 tarefas, 6 reprovações)

```
Mudança: .claude/skills/criar-tasks/task-template.md, autoconferência 10, no fim: "Contra o job que grava em passos: (a) a
  direção é a que o cenário nomeia (quem vai primeiro), e cada direção é um caso; (b) `esperarNaTrava` conta também quem
  segura a trava: espere o número de processos certo, ou um padrão que só o lado esperado casa; (c) com o job parado dentro
  de um passo com `lock_timeout` curto, o outro lado vai por SQL, ou para antes de o job entrar no passo. Na F2, a 3.0, a
  7.0, a 9.0 e a 12.0 reprovaram por corrida que não era corrida (`processo-licoes.md`)."
Efeito esperado: as seis reprovações do grupo C
```

**P2. O ano esconde a escola** (grupo E, 3, um crítico)

```
Mudança: .claude/skills/criar-tasks/task-template.md, autoconferência 11, depois de "Remova mentalmente a cláusula…":
  "Repository que filtra por escola e por ano: o ano de cada escola já separa, e a escola tirada fica verde se o caso usa o
  ano da A. No caso de isolamento, todo id que o repository recebe é da B (o ano, a turma), lido no contexto da A, como
  `apps/api/test/calendario.int.test.ts:152`. Na F2, a 4.0 e a validação (`aulasDaTurma`) caíram nisso."
Efeito esperado: o crítico 2 da validação e a reprovação da 4.0. A mesma linha no tenancy-guardian é a M4
```

**P3. Divergência na spec antes da rodada, conferida por `grep`** (grupo D, 4)

```
Mudança: .claude/skills/executar-task/SKILL.md, seção 5 "Revisão", antes de pedir a rodada à Mesa: "Antes de pedir, para cada linha de
  'Divergências resolvidas', procure a palavra do código no `techspec.md` e no `cenarios.md` (`grep -n`). Não achou: a
  decisão entra lá agora, na seção que a coluna 'Onde está na spec' cita. Na F2, a 3.0, a 5.0, a 8.0 (quatro linhas) e a
  10.0 reprovaram no revisor-geral por divergência que só existia no documento da tarefa."
Efeito esperado: as quatro reprovações do revisor-geral do grupo D
```

**P4. Contar as tarefas antes da revisão da spec** (grupo N, 13+ rodadas não aprovadas)

```
Mudança: .claude/skills/criar-techspec/SKILL.md, passo 7 "Salvar e medir", depois do teto: "Conte também as tarefas que a
  Tech Spec vai pedir (um comportamento por tarefa, até três guardiões com veto, uma tela por tarefa: o critério do
  `criar-tasks`). Passou de 12, a pergunta do corte em duas specs vai ao Joaquim aqui, antes da revisão: a revisão de cada
  spec cobre só a parte dela. Na F2, o corte veio depois de oito rodadas, e pelo menos 13 das 27 não aprovadas eram sobre o
  que foi para a F2c."
Efeito esperado: metade das rodadas da revisão da spec de uma funcionalidade grande
```

**P5. O limite de corpo nomeia as rotas** (grupo F, 3)

```
Mudança: .claude/skills/criar-techspec/SKILL.md, passo 5 "Seções obrigatórias", no item "Carga e falha": "Limite de corpo, de linhas ou de taxa
  diz em quais rotas vale e o que o middleware global já cobre (`apps/api/src/configure-app.ts`): teto novo que entra no
  global muda as outras rotas. Na F2, o teto da 5.0 quebrou o envio de material, e a 8.0 estendeu o 1 MB a rotas que a spec
  não citava."
Efeito esperado: as três reprovações do grupo F
```

**P6. Procurar quem usa o que mudou** (grupo K, 3, um crítico e uma escalada)

```
Mudança: .claude/skills/executar-task/SKILL.md, seção 4, no começo de "Com os testes da tarefa verdes: o portão, uma vez": "Mudou contrato de rota, esquema ou constante de
  `packages/shared`, a assinatura de uma peça do `core` ou uma lista que um teste fecha (métrica, ação de auditoria): procure
  quem a usa (`grep -rl '<nome>' apps packages e2e infra --include='*.test.ts' --include='*.spec.ts'`) e rode isolados os
  testes achados que você não alterou. O portão só roda os que a árvore alterou (regra 40). Na F2, a 8.0 derrubou quatro
  specs de e2e, a 16.0 o caso de 501 da 10.0 (crítico da validação) e a 4.0 a lista de métricas do teste de infra."
Efeito esperado: os três vermelhos que só apareciam uma tarefa depois, e a correção com escalada da lista
```

**P7. Hora de `date` e a tabela "Concluídas"** (grupo I)

```
Mudança: .claude/skills/seguir/passos/estado-md.md, depois do modelo: "A hora de cada linha de 'Agora' sai de
  `date '+%d/%m %H:%M'`, nunca de memória (na F2, de 06/11 ~02:00 em diante as horas saíram 6 a 7 h à frente do git). A
  tarefa encontrada entra como linha da tabela 'Concluídas', com modelo e rodadas, e não como item solto: é a tabela que a
  retrospectiva lê (na F2, oito entraram como item e oito não entraram)."
Efeito esperado: as medidas 1 e 5 da D79 legíveis no estado, sem recontar pelo git
```

### Confirmação, item a item

**M1. O `restos` vê o arquivo novo** (`tools/renomear/`, código de processo; grupo B, 5)

```
Mudança: tools/renomear/restos.ts (e o que ele usa de arvore.ts) — a varredura do `restos` lista também os arquivos não
  ignorados que ainda não estão no índice (`git ls-files --cached --others --exclude-standard`). Só o `restos`: o `aplicar`
  e o `conferir` continuam só com os versionados. Caso novo em restos.test.ts (o resto num arquivo criado e não adicionado
  deixa o comando vermelho) e bloco de mutação da opção.
Custo: nenhum tempo de portão a mais (a unidade já roda o `restos` inteiro)
Efeito esperado: os 4 vermelhos da esteira e as 3 correções do grupo B passam a cair no portão da própria tarefa
```

**M2. O barril e a peça que as duas estendem, no paralelo** (`criar-tasks`, que decide o paralelo; grupo J, 2)

```
Mudança: .claude/skills/criar-tasks/SKILL.md, "Autorize o paralelo", depois de "o arquivo de registro que as duas editariam
  (rotas, navegação, módulo)": "e o barril (`index.ts`) de cada pacote em que a tarefa exporta peça nova. Tarefa que muda a
  assinatura de uma peça que outra também estende (o motor, uma porta, um tipo base) não corre em paralelo com ela. Na F2, o
  encontro da 6.0 e o da 10.0 deram conflito nos barris de `core`, `core/importacao` e `shared`, e na assinatura do `travar`
  do motor."
Efeito esperado: as duas correções de encontro; o `linhas.ts` passa a ver o barril nos "Arquivos previstos"
```

**M3. Write não apaga a seção "Revisões"** (`.claude/settings.json` e um hook novo em `.claude/hooks/`; grupo H, 2 aqui e 2 na X1)

```
Mudança: um hook PreToolUse em Write que recusa sobrescrever um `tasks/**/*.md` que já existe e tem a seção "## Revisões",
  com a mensagem "use Edit: Write apaga a seção Revisões (protocolo, item 5)". Teste do hook com o arquivo com e sem a seção.
Efeito esperado: a seção que o Validador e a retro leem deixa de perder rodadas; o menor da validação sai do TODO.md
```

**M4. O ano esconde a escola, no tenancy-guardian** (lista "O que verificar" de um guardião com veto; grupo E)

```
Mudança: .claude/agents/tenancy-guardian.md, "O que verificar", item 4, depois de "o teste quebra?": "Repository que filtra por
  escola e por ano: confira que o caso passa ao repository o ano e a turma da B, no contexto da A. Com o ano da A, o filtro
  de ano esconde a falta do de escola (validação da F2, `GradeRepository.aulasDaTurma`)."
Efeito esperado: o guardião pega o que a validação pegou; é a P2 do lado de quem revisa
```

### O que tirar

Nada. O `conformidade-reviewer` rodou 29 vezes nas tarefas sem reprovar (22/0 na X8), e a medida sugeriria tirá-lo de spec sem nota
nem tutor. Não sustenta: ele corre em paralelo com os outros (~40 s), sem alongar a rodada; e a F2 desliga e transfere aluno, que é
decisão sobre aluno (regra 70, item 2). Quem o pede é a tabela por caminho (`guardioes-por-caminho.ts`), e afrouxá-la não entra por
retrospectiva.

## A decisão em aberto: o arquivo do titular traz os atos de terceiros sobre ele?

Da triagem da validação (`validacao.md`, "Pendências herdadas"; `TODO.md`, grupo da validação). O arquivo do titular
(`packages/core/src/titular/leitura-do-titular.ts:378`) traz da `auditoria` só o que o titular **fez** (`autor_usuario_id`). O que a
coordenação fez **sobre** ele não entra: `aluno.transferido`, `lista.transferida`, `usuario.nome_corrigido`, `lista.nome_corrigido`. As
linhas em si (vínculo encerrado com motivo, vínculo novo, nome atual) entram. `lista_nome.retirado` fica de fora de qualquer jeito: o
nome sai de fato e não tem titular futuro.

Opções levadas: (1) sim, por alvo e sem quem fez; (2) fica como está; (3) sim, com as leituras. Recomendei a (1): o art. 19 da LGPD e o
teste de fechamento da regra 20 pedem o que a escola guarda e fez com o dado dele; o autor é dado pessoal de outra pessoa; e a leitura
viraria uma janela sobre o trabalho da equipe. **O Joaquim escolheu a (1)** e aprovou o texto: **D85** (`docs/decisoes.md`). O código vai
na F2c, que já constrói o "por alvo" da senha provisória (`TODO.md`, "(F2, retro, D85)"; `ROADMAP.md`, F2c; `docs/lgpd.md`).

## Decisão

Mostrei as propostas ao Joaquim em 06/11/2026, às 11:14, no terminal do Arquiteto. Ele respondeu "aplique o recomendado" às
confirmações (as quatro, que eu recomendei) e não objetou aos avisos; apliquei os avisos junto, sem esperar as 11:45. M1 e M3 mudam
código de processo e entram como correção no `TODO.md`, como as da X4, X7 e X8. A M4 também: a lista do guardião tem a cópia gravada do
RF21, que o hook conta como código, e o commit de documento foi recusado com ela.

Uma mudança no texto da P6 ao aplicar: a métrica da 4.0 já estava coberta pela "Lista fechada" do `executar-task`, que cita
`infra/test/metricas.int.test.ts` pelo nome; a P6 entrou como o parágrafo "Quem usa o que mudou", logo depois dela, só com o contrato
e o limite.

| Proposta | Decisão | Onde |
|---|---|---|
| P1. As três armadilhas da corrida contra o job (aviso) | aplicada; o caso foi para `docs/processo-licoes.md` | `task-template.md`, autoconferência 10 |
| P2. O ano esconde a escola (aviso) | aplicada; caso em `processo-licoes.md` | `task-template.md`, autoconferência 11 |
| P3. Divergência na spec antes da rodada, por `grep` (aviso) | aplicada | `executar-task/SKILL.md`, seção 5 |
| P4. Contar as tarefas antes da revisão da spec (aviso) | aplicada | `criar-techspec/SKILL.md`, passo 7 |
| P5. O limite de corpo nomeia as rotas (aviso) | aplicada | `criar-techspec/SKILL.md`, passo 5, "Carga e falha" |
| P6. Quem usa o que mudou (aviso) | aplicada, sem a parte da métrica | `executar-task/SKILL.md`, seção 4, depois de "Lista fechada" |
| P7. Hora de `date` e a tabela "Concluídas" (aviso) | aplicada | `seguir/passos/estado-md.md` |
| M1. O `restos` vê o arquivo novo | aceita, como correção (código de `tools/`) | `TODO.md`, "(F2, retro, M1)" |
| M2. O barril e a peça que as duas estendem, no paralelo | aplicada | `criar-tasks/SKILL.md`, "Autorize o paralelo" |
| M3. Write não apaga a seção "Revisões" | aceita, como correção (hook) | `TODO.md`, "(F2, retro, M3)" |
| M4. O ano esconde a escola, no tenancy-guardian | aceita, como correção: a lista tem cópia gravada (RF21, `tools/processo/harness/__fixtures__/revisores-antes/`), e o hook trata a cópia como código | `TODO.md`, "(F2, retro, M4)" |
| D85. O arquivo do titular traz o que a escola fez sobre ele | registrada | `docs/decisoes.md`, `CLAUDE.md`, `docs/lgpd.md`, `ROADMAP.md`, `TODO.md` |
