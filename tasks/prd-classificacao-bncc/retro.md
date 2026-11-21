# Retrospectiva — classificacao-bncc (F4b)

20/11/2026, pelo Arquiteto 2, no térreo, depois do pouso (`eca08d57`), ao lado do PRD da F5 (D86). **Completa** (D86): a taxa subiu
(14,4% contra 10,1% da X6) e seis causas se repetiram. Comparação com a retro da X6 (`tasks/prd-reengenharia-continuacao/retro.md`).

O que pesa nos números: 13 tarefas em duas linhas (L1 com 1.0 a 8.0 menos a 9.0, depois 10.0 a 13.0; L2 com a 9.0 e as correções do fim),
Sonnet nas tarefas que o `estado.md` registra (1.0 a 9.0; da 10.0 à 13.0 o registro não tem a coluna). A primeira spec com uma função de IA
que roda sozinha (a classificação, autonomia 1) e com uma medida de modelo local no caminho crítico.

## Medidas

```
Tarefas: 13 · Rodadas de revisor: 174 · Reprovações: 25 (14,4%), uma delas AJUSTES NECESSÁRIOS (llm-integrator, 10.0)
Por revisor: test-engineer 27/13 · revisor-geral 28/7 · infra-guardian 25/3 · conformidade-reviewer 25/1 · llm-integrator 6/1
             tenancy-guardian 25/0 · privacy-guardian 25/0 · frontend-reviewer 9/0 · pedagogia-reviewer 4/0
Por modelo do implementador: Sonnet; 13,4 rodadas e 1,9 reprovação por tarefa; 2 diagnósticos do Arquiteto (4.0, escalada do
  test-engineer; 10.0, escalada do revisor-geral); 2 divergências (1.0 portão, workers órfãos da X6; 10.0 ordem, triagem do Arquiteto);
  pedido → commit com mediana de 163 min
Rodadas por tarefa: média 13,4; pior 10.0 com 17 (três rodadas, a escalada)
Rodadas que caducaram sem reprovação: 61 de 174 (35%)
Correções fora de tarefa: 9 com commit (2 planejadas: a M3 da F4 e a leitura de null da §7c; 3 da esteira; 2 da validação; 1 de merge;
  1 pedida pelo Joaquim, metodos-de-mercado) e 1 em FALHA sem commit (alertas-do-ensaio-na-esteira, intermitente)
Duração: Tech Spec 17/11 08:56; revisão da spec 08:57 → 10:17; tarefas 10:41; construção 11:01 de 17/11 → 09:29 de 20/11 (2 d 22 h),
  com ~28 h paradas entre a 8.0/9.0 (18/11 15:18) e o pedido da 10.0 (19/11 19:19), à espera da medida local do modelo;
  validação r1 09:52 (APROVADA COM RESSALVAS), duas correções, r2 20:17 (APROVADA); pedido de pouso ~20:17
Revisão da spec: 6 rodadas, 29 vereditos, 20 não aprovados (15 REPROVADO, 5 AJUSTES), em 1 h 20
Validação: r1 com 0 crítico, 2 maiores, 7 menores; r2 APROVADA, 0 crítico, 0 maior, 3 menores
```

Como contei: a união da seção "Revisões" dos 13 `N_task.md` com `achados/indice.md`, por (tarefa, revisor, rodada). A seção perdeu a 1ª
rodada inteira em três documentos (4.0, 5.0 e 7.0: 19 linhas, 6 reprovações), que só o índice guarda (grupo F). O pedido de cada tarefa
pela primeira mensagem `PEDIDO … Tarefa:` do Orquestrador nas sessões das linhas (`…specclassificacao-bncc--l1`, `--l2`), em UTC,
convertida para a hora do commit (-03). A esteira por `gh run list --branch spec/classificacao-bncc`.

| | F3 | X8 | F2 | F2b | F2c | F4 | X6 | F4b |
|---|---|---|---|---|---|---|---|---|
| Tarefas | 20 | 13 | 16 | 8 | 19 | 12 | 14 | 13 |
| Reprovações nas tarefas | 22,9% | 15,2% | 15,4% | 2,2% | 12,6% | 11,3% | 10,1% | **14,4%** |
| Rodadas por tarefa | 11,8 | 11,6 | 12,2 | 11,3 | 13,4 | 14,8 | 14,1 | 13,4 |
| Caducadas sem reprovação | 34% | 30% | 33% | 41% | 39% | 44% | 41% | 35% |
| Correções fora de tarefa | 9 | 26 | 13 | 4 | 25 | 10 | 16 | 9 |
| Crítico ou maior no 1º /validar | 1 c, 2 M | 1 c (+1 c) | 2 c | 1 M | 1 c, 2 M | 1 M | nenhum | **2 M** |
| Tarefas sem nenhuma reprovação | 1 de 20 | 1 de 13 | 1 de 16 | 6 de 8 | 3 de 19 | 2 de 12 | 4 de 14 | **0 de 13** |
| Rodadas da revisão da spec (não aprovadas) | — | 29 (21) | 35 (27) | 19 (13) | 17 (11) | 28 (21) | 31 (18) | 29 (20) |

## As cinco medidas da D79

**1. Do pedido ao commit.** Mediana de **163 min**, contra 145 na X6, 158 na F4 e 99 no F3. As longas: 10.0 (421, a divergência de ordem e a
escalada), 5.0 (304, a carga das 300 apostilas), 3.0 (217, a máquina reiniciou no meio), 4.0 (204, a escalada). As curtas: 12.0 (72), 9.0
(77), 6.0 (86).

**2. Tarefas sem reprovação.** **0 de 13**, contra 4 de 14 na X6. Oito das treze reprovaram só no `test-engineer`.

**3. O grupo A (cláusula sem prova).** **7** (1.0, 3.0, 7.0, 8.0, 10.0, 11.0, 13.0), contra 4 na X6 e 6 na F4. A 13.0 é o `and(` de um
argumento por linha, a M4 da X6, aceita e não feita.

**4. Vermelhos da esteira por push.** 37 execuções: **3 verdes, 20 vermelhas, 14 canceladas**. Das 20, **14 só no `verificar`**, pelos
dois commits do lote retido sem a linha `Fora do processo:` (`3209137c`, 17/11 19:45, e `080e774f`, 19/11): o `verificar` ficou cego três
dias, até o pouso (grupo E). As outras seis: código, 4 (a 3.0, os e2e que contavam as funções, `a590dafd`; a 4.0, a métrica nova fora da
lista do teste de infra, `97baf9f8`; a 5.0, a extração do teste que enfileirava a classificação, `b8fbdeea`; a 10.0, `atividade.int.test.ts`,
verde no push seguinte); runner, 3 (o `buildx` em `c4dddef8`, o `npm ci` em `d89816f5`, o ghcr.io em `09d4e4fd`); intermitente, 1 (o ensaio
de alertas, `d89816f5`). Três dos quatro de código são inventário que o portão não puxou (a família da M2 da F4).

**5. Do último commit ao pedido de pouso.** Último código às 19:40 de 20/11 (`4d08de34`), validação r2 às 20:17, pedido de pouso no mesmo
minuto: **~40 min**, contra 55 na X6 e 1 h 30 na F4.

## Grupos de causa

| # | Causa | Ocorrências | Onde evitar |
|---|---|---|---|
| A | **A divergência ficou só no documento da tarefa.** A FK `set null` e o check de `corrigida_por` na `techspec.md` e não no `cenarios.md` (2.0, revisor-geral 1ª; a autoconferência 8 afirmava o contrário); a lista fechada `CODIGOS_DA_BNCC` (7.0, revisor-geral 1ª: nenhum dos dois arquivos mudou); os textos de erro da tela (8.0, revisor-geral 1ª); a questão que cita duas seções (10.0, revisor-geral 1ª) e o Tutor sem caso de `QUI.EM.05` (10.0, revisor-geral 2ª, a escalada) | 5 reprovações em 4 tarefas, 1 escalada | o portão: o aviso da M3 da X7 se cala com qualquer mudança no arquivo (10.0: o `cenarios.md` mudou no caso do chat, não na linha citada) e só informa (M1). O texto do `executar-task` e a autoconferência 8 já pedem o mesmo |
| B | **Cláusula sem prova** (o grupo A da D79): o cenário da tabela sem teste (1.0); o piso de 80% provado só pela remoção do critério (3.0); o `.for('update')` e o `update` sem condição (7.0); o bloco vermelho por exceção, e não pela asserção (8.0, duas vezes); o `disabled={motivo !== undefined}` e o ternário numa linha que já tinha bloco (8.0, 11.0); a cláusula de `DadoNominal.tsx` (10.0); os termos do `and(` de um argumento por linha (13.0) | 7 | autoconferência 1 (aviso 3); o `--faltando` do `and(` de várias linhas é a M4 da X6, aberta (P) |
| C | **A versão anterior não lê o que a nova grava, ou deixa o dado num estado que a nova não conserta** (regra 80, item 9): o backfill de seções que o `worker-pdf` anterior, de volta, desfaz em silêncio (2.0, infra 1ª); o runbook "volta sem passo nenhum" e o código da F4 lendo `licenciante` nulo (9.0, test-engineer 1ª); a questão com `habilidade: null` que a produção não abre (10.0, infra 1ª). A §7c da Tech Spec prometia o teste da 10.0, e nenhuma tarefa o carregava; a expansão virou a correção `leitura-de-habilidade-nula`, pousada à parte, e o conflito de ~30 arquivos no merge da `develop` virou outra (`merge-da-develop-leitura-de-null`) | 3 reprovações, 2 correções | a Tech Spec (a linha "Migration" da §7c só pergunta da migration: aviso 1) e o `criar-tasks` (a expansão vira tarefa, antes de quem grava: M2) |
| D | **O teste verde sem provar a regra, pela entrada que monta.** O isolamento com `LIMIT 10` que só vale com o banco vazio (5.0, test-engineer); o estado final igual ao inicial, que um job parado também deixa (6.0, test-engineer); o pior pedido com o mesmo valor em todos os trechos, que a união deduplica (10.0, llm-integrator); o `EXPLAIN` de outras consultas (5.0, infra) e de um SQL escrito à mão (10.0, test-engineer); o espião no repository que soma (12.0, test-engineer, regra 40) | 6 em 5 tarefas | autoconferência 5 (aviso 4) |
| E | **Commit de código de processo fora de tarefa, que o hook deixa passar e a esteira recusa.** O lote retido (`3209137c`) e a medida local (`080e774f`), em `docs/aia/ouro-retido/`, commitados pelo Orquestrador sem `(correção …)`: a linha `Fora do processo:` é só do terminal do Joaquim, e o hook do commit cobra a marca só de sessão de papel. 14 execuções vermelhas só no `verificar`, o `verificar` cego três dias (compensado com `ci:verificar` à mão a cada encontro) e o censo do e2e lendo a execução de três dias antes (pendência do `TODO.md`) | 2 commits, 14 vermelhos | o hook (M3) e o censo (M4) |
| F | **A seção "Revisões" cortada** (o grupo E da X6, de novo): a 4.0, a 5.0 e a 7.0 perderam a 1ª rodada inteira, 19 linhas e 6 reprovações, mesmo com o aviso 4 da X6 no `executar-task` desde a manhã de 17/11 | 3 documentos | a M2 da X6, aceita e aberta (P) |
| G | **A concorrência [P] escrita em sequência** (4.0, test-engineer 1ª), e a correção que esqueceu o `consumo_ia` da linha estimada (4.0, 2ª, a escalada): o `cenarios.md` prometia "uma chamada, um consumo, uma gravação", e a semântica herdada da 6.0 da X6 (quem acha `rodando` encerra e grava a estimada) dá "nenhuma gravação" | 2 reprovações na mesma tarefa, 1 escalada | autoconferência 10, que já diz isso; e a revisão da spec, que não cruzou o cenário com a semântica herdada. Sem proposta nova |
| — | Uma vez só, sem proposta: a habilidade de outro recorte na mesma execução (4.0, revisor-geral, defeito de produto pego na revisão); a soma dupla da `injecao` no medidor (3.0); a prop da 11.0 entrando na 8.0 (escopo); a consulta do alerta sem índice (5.0, infra; a 0064 entrou); o `cenarios.md` ausente na 1ª rodada da revisão da spec (os nove revisores o pediram; aviso 2); as ~28 h paradas à espera do modelo local no Windows (a Tech Spec pôs a medida no caminho crítico e a mão do Joaquim nela); os três `@Unscoped` e a descrição do modelo, pegos só na validação (as duas maiores, corrigidas; a guarda de arquitetura agora segura o quarto `@Unscoped`) | 1 cada | — |

**Revisão da spec.** As 20 não aprovadas giraram em torno de: o `cenarios.md`, que não existia na 1ª rodada (os nove); a execução da rotina
sem ano letivo numa tabela que exige um (tenancy, revisor-geral); a degradação do lote herdada do Tutor e a "janela das 5h" que não existia
(infra, três rodadas); a seção sem execução e o componente apagado sem estado nem saída (test-engineer, cinco rodadas); o efeito da suspensão
sobre o que a IA já classificou (conformidade). É o desenho que a revisão existe para pegar. O que ela não pegou foi a §7c prometendo o teste
da versão anterior sem tarefa que o fizesse (grupo C).

**Falsos positivos.** Nenhum.

**Pendências marcadas para a retro**

| Pendência | Destino |
|---|---|
| O `domain-researcher`, obrigatório na 1.0, sem rodada na seção "Revisões" (validação, menor) | M6 |
| `esteira.ts --censo` lê só execução toda verde (`TODO.md`, fechamento) | M4 |
| 14 subitens do `tasks.md` em `[ ]` com as tarefas `[x]` (`TODO.md`, validação r1) | aviso 5; os 14 marcados nesta retro |
| Caminho absoluto gravado em `achados/` (`TODO.md`, correção merge-da-develop) | M5 |
| O filtro `m.licenciante is null` do bloco "volta ao código da F4" sem caso (9.0, "pauta da retro") | sem mudança: o bloco só vale até o `DROP COLUMN material.licenciante`, no deploy seguinte ao da `0065` (`TODO.md`), e depois dele a volta ao código da F4 não existe. Sem o filtro, o nome viria da licença, que é a verdade desde a 9.0; não vale uma correção para uma janela de um deploy |
| Guardar o código `legado` num campo da auditoria `artefato.habilidade_trocada` (11.0, "dono: Joaquim, na retro") | sem mudança: a condição do item ("só vale se houver artefato anterior à 10.0 fora de dado sintético") não acontece; não há escola real até o piloto (D1, D71). Fica no `TODO.md` para quando houver |
| O painel com os capítulos duas vezes (8.0); "confirmada" contra "alterada" na correção (8.0); a habilidade que deixa de ser candidata (8.0); a anulação só na métrica (10.0) | produto, não processo: ficam no `TODO.md`, para a próxima spec que tocar o painel do material ou o dossiê, com o Joaquim. A habilidade que deixa de ser candidata existe fora da sala de teste: a correção da coordenação sobrevive à mudança de recorte (6.0) e o código dela sai da lista de candidatas |
| A reserva de tokens 20% maior e o custo das reexecuções por `IA_SAIDA_INVALIDA` (10.0, "11.0 ou a retro") | operação, não processo: ficam no `TODO.md`, para o painel do piloto |

## Propostas

### Aviso (só skill ou modelo de documento)

**Aviso 1. A §7c pergunta pela volta do código, não só pela migration** (grupo C, 3)

```
Mudança: .claude/skills/criar-techspec/template.md, §7c, a linha "Migration | compatível com o código anterior?" passa a:
  | Migration e volta do código | para cada formato novo que se grava (coluna, valor de jsonb, estado) e cada dado que a versão nova deixa
  de gravar: a versão em produção lê o que a nova grava? A anterior, de volta, deixa o dado num estado que a nova não conserta? Cada "não"
  é uma expansão que pousa antes (os leitores aceitam), o teste que lê o dado novo com o esquema do HEAD e a seção "Voltar o código depois
  da N.0" do runbook. Na F4b, a 2.0, a 9.0 e a 10.0 reprovaram por isso, e a expansão da 10.0 pousou à parte, com conflito de ~30 arquivos |
Efeito esperado: as três reprovações, e a correção de merge.
```

**Aviso 2. O `cenarios.md` vai junto da Tech Spec para a revisão** (revisão da spec, os nove na 1ª rodada)

```
Mudança: .claude/skills/criar-techspec/template.md, §10, no fim: "O `cenarios.md`, na mesma pasta, acompanha a Tech Spec desde a
  primeira rodada da revisão: os testes por RF, o isolamento efetivo, cada corrida com a ordem forçada e a mutação que a derruba, e os
  textos e estados de cada tela. Na F4b ele faltou, e os nove revisores o pediram na 1ª rodada."
Efeito esperado: uma rodada inteira da revisão da spec.
```

**Aviso 3. A mutação prova pela asserção, e o número nos dois lados** (grupo B, 7)

```
Mudança: .claude/skills/criar-tasks/task-template.md, autoconferência 1, no fim: "O bloco fica vermelho pela asserção, não por exceção: o
  mutante que lê propriedade de undefined e derruba a renderização não prova a cláusula (use ?.; 8.0 da F4b). Número (piso, teto,
  taxa) se prova nos dois lados da fronteira, e o bloco troca o número, não tira o critério (3.0). Também ficam de fora do --faltando:
  o atributo de JSX com comparação (disabled={motivo !== undefined}, 8.0 e 11.0), o .for('update') e o update sem condição (7.0)."
Efeito esperado: as reprovações da 3.0, 7.0, 8.0 e 11.0; a 13.0 sai com a M4 da X6.
```

**Aviso 4. A entrada do teste distingue o caso** (grupo D, 6)

```
Mudança: task-template.md, autoconferência 5, no fim: "E a entrada do teste distingue o caso: o estado esperado no fim é diferente do
  que já valia antes (um job que não faz nada não pode passar; 6.0 da F4b); o pior caso usa valores distintos, que a deduplicação não
  junta (10.0); a leitura com LIMIT no banco compartilhado filtra pelo id do outro lado, e não conta com o banco vazio (5.0); o
  repository que soma ou junta não é espiado (regra 40; 12.0); e o EXPLAIN roda o .toSQL() da consulta do repository, uma por consulta
  nova no caminho quente, como apps/api/test/semana-itens.int.test.ts (consultasDosItens), nunca um SQL escrito no teste (5.0, 10.0)."
Efeito esperado: as seis reprovações do grupo.
```

**Aviso 5. A tarefa marca as subtarefas dela** (pendência do `tasks.md`)

```
Mudança: .claude/skills/executar-task/SKILL.md, passo 7: "Marque a tarefa `[x]` em `tasks.md`" passa a "Marque a tarefa e as subtarefas
  dela `[x]` em `tasks.md`". Na F4b, 14 subitens ficaram em [ ] com as 13 tarefas feitas (validação, menor).
Efeito esperado: o menor some; o encontro já sabe juntar o tasks.md com as subtarefas marcadas (linhas.ts).
```

### Confirmação

**M1. A divergência que fica só na tarefa para a rodada antes dos revisores** (grupo A; `tools/processo/divergencias.ts`,
`portao-local.ts`, `.claude/skills/revisar-tarefa/SKILL.md`)

```
Mudança: (a) o aviso lê a coluna "Onde está na spec" de cada linha nova e cobra cada arquivo que ela cita (techspec.md, cenarios.md, o
  documento da seção 11), e não "um dos dois mudou"; com arquivo:linha citado, cobra que o diff toque aquele trecho. (b) O aviso sai
  também no `portao-local.ts revisores`. (c) revisar-tarefa, passo 1.3: com o aviso, a Mesa não chama revisor e manda DEVOLUÇÃO com a
  linha e o arquivo. Casos de teste: a linha que cita os dois com só um mudado; a que cita cenarios.md:140 com o diff em outro trecho.
Recomendo: aplicar, como correção. Cinco reprovações e uma escalada do revisor-geral; o texto já existe no executar-task e na
  autoconferência 8, e o aviso de hoje se cala com qualquer mudança no arquivo. A devolução custa uma conferência; a rodada, sete revisores.
```

**M2. O formato novo que a produção não lê vira tarefa de expansão, antes de quem grava** (grupo C; `.claude/skills/criar-tasks/SKILL.md`)

```
Mudança: na geração das tarefas: "Cada linha da §7c 'Migration e volta do código' com um 'não' vira: uma tarefa de expansão (os leitores
  aceitam o formato novo, com o teste que lê o dado novo com o esquema de hoje), primeira da cadeia de quem grava, marcada para pousar
  na develop antes, quando a §7c diz; e, na tarefa que grava, a subtarefa da seção 'Voltar o código depois da N.0' do runbook, com o
  caso que a prova."
Recomendo: aplicar. A §7c da F4b prometia o teste e nenhuma tarefa o carregava: três reprovações, a correção pousada à parte e o conflito
  de ~30 arquivos, que custou outra correção e uma noite. O criar-tasks decide a marcação dos guardiões: por isso é confirmação.
```

**M3. O commit de código de processo fora de tarefa é recusado em qualquer sessão** (grupo E; `tools/processo/portao.ts`, `decidirCommit`)

```
Mudança: o hook do commit aplica a todo commit de sessão do Claude Code, o Orquestrador incluído, a mesma conta do conferir-entregas
  (ehCodigoParaAEsteira): arquivo de código, de produto ou de processo, sem "(tarefa N.0)" ou "(correção <slug>)" é recusado, com o
  caminho: abrir a correção (docs/aia/ouro-retido/ leva o conformidade-reviewer) ou pedir ao Joaquim o commit no terminal dele, com
  "Fora do processo:". Caso de teste: o commit do Orquestrador só com docs/aia/ouro-retido/x.json, recusado; o mesmo com "(correção …)",
  aceito.
Recomendo: aplicar, como correção. Dois commits deixaram o verificar vermelho em 14 execuções e cego por três dias, e o censo leu a
  execução de três dias antes. O hook e a esteira contavam diferente; a esteira está certa.
```

**M4. O censo lê a execução mais nova com o e2e verde** (pendência do `TODO.md`; `tools/ci/esteira.ts`)

```
Mudança: `esteira.ts --censo` escolhe a execução mais nova em que todas as fatias de e2e estão verdes, mesmo com outro job vermelho, e
  diz no topo qual leu e o que estava vermelho nela. Caso de teste com a execução de verificar vermelho e e2e verde.
Recomendo: aplicar, junto da M3, na mesma correção. A M3 tira o caso desta spec, mas o censo depende só do e2e, e outro job vermelho
  (o runner, o infra intermitente) o faz ler execução velha de novo.
```

**M5. O achado grava caminho relativo** (pendência do `TODO.md`; `tools/processo/revisoes.ts`)

```
Mudança: ao gravar o bloco em achados/, o hook troca a raiz do checkout (a do andar ou da linha, /home/…/.maestri/floors/<andar>/) por
  nada, deixando o caminho relativo à raiz do repositório. Caso de teste: o achado com o caminho absoluto de uma linha sai relativo.
Recomendo: aplicar, como correção. O repositório é público, o caminho leva o usuário da máquina, e o do andar apagado não abre para
  quem lê depois.
```

**M6. O `domain-researcher` é pesquisa, não rodada** (pendência da validação; `.claude/skills/criar-tasks/SKILL.md`)

```
Mudança: na tabela de guardiões, a linha "depende de regra externa ou API de terceiro | domain-researcher" passa a dizer: "pesquisa antes
  do código: entra como subtarefa, com o relatório (arquivo ou hash), e não na linha 'Subagentes obrigatórios', porque não dá veredito e
  o hook não a conta como rodada".
Recomendo: aplicar. Foi o que a 1.0 fez (a conferência 1.2, com hash); o Validador procurou a rodada que não podia existir.
```

**P. As correções aceitas que voltaram nesta spec** (já aceitas, não pedem palavra nova)

```
A M2 da X6 (a seção "Revisões" não se perde por script) e a M4 da X6 (o --faltando junta o and( de várias linhas) seguem [ ] no
  TODO.md, e as duas causas voltaram: a 4.0, a 5.0 e a 7.0 perderam a 1ª rodada (19 linhas, 6 reprovações), e a 13.0 reprovou no and(.
  A M2 da F4 (o portão puxa o inventário quando o diff toca o inventariado) é a família de três dos quatro vermelhos de código da esteira.
Recomendo: o Orquestrador fazer a M2 e a M4 da X6 antes das tarefas da F5, e a M2 da F4 na fila logo depois. Abertas desde 15/11 e 17/11:
  M1, M3 e M7 da X6; M1, M2 e M4 da F4.
```

## O que tirar

Nada. O `tenancy-guardian` e o `privacy-guardian` (25 rodadas cada), o `frontend-reviewer` (9) e o `pedagogia-reviewer` (4) não reprovaram
nas tarefas, mas os quatro reprovaram ou pediram ajuste na revisão da spec (a execução sem ano letivo, a marca de `corrigida_por` que a
eliminação anula, o `cenarios.md`, o critério do lote retido), e as recomendações deles nas tarefas viraram linha do `TODO.md`. Numa spec com
tabela pública, três `@Unscoped` e um campo apagado pela eliminação do titular, tirá-los seria ler o número ao contrário (regras 10 e 20).

## Decisão

Mostrei o bloco ao Joaquim em 20/11/2026, às 22:05, no terminal do Arquiteto 2. Ele respondeu "aprovo", que vale a recomendação de cada
uma. Os avisos foram aplicados depois da resposta; nenhum teve objeção.

| Proposta | Tipo | Resultado | Onde |
|---|---|---|---|
| 1. A §7c pergunta pela volta do código | aviso | aceita, aplicada | `.claude/skills/criar-techspec/template.md`, §7c, linha "Migration e volta do código" |
| 2. O `cenarios.md` vai junto da Tech Spec para a revisão | aviso | aceita, aplicada | `template.md`, fim da §10 |
| 3. A mutação prova pela asserção, e o número nos dois lados | aviso | aceita, aplicada | `.claude/skills/criar-tasks/task-template.md`, autoconferência 1 |
| 4. A entrada do teste distingue o caso | aviso | aceita, aplicada | `task-template.md`, autoconferência 5 |
| 5. A tarefa marca as subtarefas dela | aviso | aceita, aplicada | `.claude/skills/executar-task/SKILL.md`, passo 7 |
| M1. A divergência só na tarefa para a rodada antes dos revisores | confirmação | aceita, como correção | `TODO.md`, "Da retrospectiva da F4b" |
| M2. O formato novo vira tarefa de expansão | confirmação | aceita, aplicada | `.claude/skills/criar-tasks/SKILL.md`, "Diretrizes" |
| M3. O commit de código de processo fora de tarefa é recusado | confirmação | aceita, como correção | `TODO.md`, idem |
| M4. O censo lê a execução mais nova com o e2e verde | confirmação | aceita, como correção, junto da M3 | `TODO.md`, idem |
| M5. O achado grava caminho relativo | confirmação | aceita, como correção | `TODO.md`, idem |
| M6. O `domain-researcher` é pesquisa, não rodada | confirmação | aceita, aplicada | `criar-tasks/SKILL.md`, tabela de guardiões |
| P. A M2 e a M4 da X6 antes das tarefas da F5; a M2 da F4 logo depois | já aceitas | recomendado ao Orquestrador | `TODO.md`, cabeçalho da seção da F4b |

Recusadas: nenhuma.

Itens do `TODO.md` que esperavam esta retro: os 14 subitens do `tasks.md` (marcados), o caminho absoluto (vira a M5), o censo (vira a M4), o
filtro do `licenciante` (fechado, sem mudança), o código `legado` (anotado, sem mudança agora) e os seis de produto e de operação (anotados com
o destino).
