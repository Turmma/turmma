# Tarefa 7.0 — Tutor travado por aluno até o fim da janela ou o limite dele

**Funcionalidade:** avaliacao-e-correcao · **Depende de:** 2.0
**Subagentes obrigatórios:** `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian`, `privacy-guardian`
**Porte:** grande

## Objetivo

O Tutor trava para cada aluno do `abre_em` até o fim da janela (com as extensões da turma) ou o limite dele, o que vier
depois; prova de amanhã não trava; a segunda chamada trava só o convocado.

## Contexto necessário

- `techspec.md` §5.4, §5.10, §7
- `prd.md` §6 ("Prova aberta trava o Tutor"); decisão do Joaquim na Tech Spec ("só na janela")
- `cenarios.md` §2 (as linhas do Tutor, a memória do Tutor), §1 RF6 (a lacuna aberta no Tutor)
- `revisao-spec.md` rodada 4: na lacuna aberta, o limite original é o `fecha_em` e já passou
- `apps/api/src/tutor/tutor.repository.ts` (`avaliativaAberta`) e `TUTOR_PAUSADO_EM_AVALIACAO`
- `.claude/rules/70` itens 4 e 4c; `30` item 10

## Subtarefas

- [x] 7.1 — `avaliativaAberta(turmaId)` vira por aluno: pela janela efetiva da turma ou pelo limite dele
  (`limiteDaTentativa`); sem janela, como hoje; o convocado da segunda chamada pela tabela de convocados
- [x] 7.2 — A consulta pelo índice `(escola_id, turma_id)`, com a latência medida (roda a cada turno)
- [x] 7.3 — A memória do Tutor não seleciona tempo adicional, saídas nem limite
- [x] 7.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/tutor/tutor.repository.ts` | alterado |
| `apps/api/src/tutor/tutor.service.ts` | alterado |
| `apps/api/src/tutor/tutor-trava-da-prova.int.test.ts` | novo |
| `apps/api/src/tutor/trava-duration.ts` | novo (o histograma `tutor.trava.duracao`, em volta da conferência) |
| `packages/core/src/telemetry/metrics.ts` e `metrics.test.ts` | alterados (a métrica nova, com `escola_id`, na lista fechada) |
| `tools/testes/metricas.ts`, `infra/test/metricas.int.test.ts` e `infra/grafana/paineis/fundacao.json` | alterados (o nome no Prometheus, a lista fechada de infra e o painel do p95) |
| `docs/mvp-contratos.md` | alterado (a conferência (3) diz "este aluno") |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| Prova de amanhã | integração | não trava | `abre_em` no futuro | `tutor-trava-da-prova.int.test.ts › prova de amanhã não trava; aberta há um minuto, trava` |
| Dentro da janela | integração | trava a turma, só ela | a outra turma da escola | `tutor-trava-da-prova.int.test.ts › dentro da janela trava a turma, e só ela: o aluno da outra turma da escola segue livre, e o da turma da prova, travado pela rota` |
| Depois do fim efetivo | integração | destrava | a aplicação segue `aberta` (a rotina não rodou) | `tutor-trava-da-prova.int.test.ts › depois do fim efetivo, destrava, mesmo com a aplicação ainda aberta (a rotina não rodou); a mesma prova com o fim adiante trava` |
| Aluno estendido além do `fecha_em` | integração | segue travado até o limite dele; o colega destrava | trava só pelo `fecha_em` fica vermelho | `tutor-trava-da-prova.int.test.ts › o aluno estendido além do `fecha_em` segue travado até o limite dele, e o colega sem extensão destrava`; `tutor-trava-da-prova.int.test.ts › a extensão de outro aluno não segura o colega: ele destrava no `fecha_em`` |
| Indisponibilidade fechada empurrando o limite além do `fecha_em` | integração | segue travado | a mesma cena sem a indisponibilidade destrava; a queda anterior à tentativa não conta | `tutor-trava-da-prova.int.test.ts › uma indisponibilidade fechada dentro da prova empurra o limite além do `fecha_em` e segue travado; sem ela, destrava` |
| Lacuna aberta montada à mão | integração | segue travado além do limite original (= `fecha_em`, já passado); o Tutor responde 409, não 503 | tique parado e relógio da recusa injetado ainda fresco; sem a lacuna, destrava | `tutor-trava-da-prova.int.test.ts › a lacuna aberta montada à mão (pulso envelhecido 3 min) segue travando além do limite original, que já passou, e o Tutor responde 409, não 503; sem a lacuna, destrava` |
| Segunda chamada aberta | integração | trava o convocado, não o colega | convocado semeado no banco; o convocado de uma segunda chamada não é o de outra | `tutor-trava-da-prova.int.test.ts › trava o convocado, não o colega`; `tutor-trava-da-prova.int.test.ts › quem é convocado de uma segunda chamada não é convocado de outra da turma: encerrada a dele, destrava` |
| Memória do Tutor | integração | sem tempo adicional, saídas nem limite | aluno com +50%, 7 saídas e extensão; o prompt capturado no adaptador falso não traz nenhum (a chave `"percentual"`, não a palavra solta), e traz a memória do trabalho dele (o controle); o log do turno, capturado, não traz a pergunta, o título da prova nem o percentual (e não está vazio) | `tutor-trava-da-prova.int.test.ts › não leva tempo adicional, saídas da aba, extensão nem limite: o aluno com +50%, 7 saídas e extensão tem a memória do trabalho dele, o pedido ao modelo não traz nenhum dos três e o log do turno não traz a pergunta, o título da prova nem o percentual` |
| Avaliativa sem janela | integração | trava enquanto aberta; encerrada, destrava | `abre_em` nulo semeado no banco | `tutor-trava-da-prova.int.test.ts › a avaliativa sem janela (a de antes da F6) trava enquanto está aberta; encerrada, destrava`; `tutor-trava-da-prova.int.test.ts › a atividade que não é avaliativa não trava` |
| Extensão da turma, aluno sem tentativa | integração | travado até `fecha_em` + extensão | sem a extensão, destrava | `tutor-trava-da-prova.int.test.ts › a extensão da turma, com o aluno sem tentativa, trava até o `fecha_em` mais a extensão; sem ela, destrava` |
| O limite e o fim da janela: o que vier depois | integração | o aluno cujo limite já passou segue travado até o fim da janela; a tentativa sem limite base vale a janela | janela aberta com o limite no passado, e depois a janela vencida | `tutor-trava-da-prova.int.test.ts › o aluno cujo limite já passou segue travado até o fim da janela, que vem depois: o que vier depois decide`; `tutor-trava-da-prova.int.test.ts › a tentativa sem limite base (a prova só com janela) vale a janela: trava até o `fecha_em`, e destrava depois` |
| A extensão, a tentativa e a queda de outra prova ou de um colega | integração | não esticam a trava deste aluno nem desta prova | a outra prova está encerrada e o colega tem a tentativa; o aluno que não começou | `tutor-trava-da-prova.int.test.ts › a extensão e a tentativa de outra prova da turma não esticam esta: a outra está encerrada, esta já acabou`; `tutor-trava-da-prova.int.test.ts › a tentativa e a queda de um colega não esticam o aluno que não começou` |
| Repository no contexto da A com turma e aluno da B, prova da B na janela | integração | não trava | a B travada no contexto dela; a escola da A com o ano da B, e a escola da B com o ano da A | `tutor-trava-da-prova.int.test.ts › o repository no contexto da A, com a turma, o aluno e o ano da B, não alcança a prova da B na janela; a B, no contexto dela, sim`; `tutor-trava-da-prova.int.test.ts › a extensão e a tentativa da B não esticam a trava da A: o aluno da A sem a extensão dele destrava` |
| Duas avaliativas abertas na turma | integração | trava pela que vale, não pela primeira por id | a primeira por id já acabou (a rotina não rodou) e a segunda está na janela | `tutor-trava-da-prova.int.test.ts › duas avaliativas abertas na turma: a primeira por id já acabou e a rotina não rodou, a segunda está na janela, e o Tutor trava pela segunda` |
| Plano da consulta de cada turno | integração | `EXPLAIN` pelo índice da turma, sem varrer a tabela | o `.toSQL()` da consulta principal (as de extensão e de queda não têm plano conferido: ficam no `TODO.md`) | `tutor-trava-da-prova.int.test.ts › a consulta principal de cada turno (as provas abertas da turma) desce pela turma, no índice da atividade aplicada, e não varre a tabela; as de extensão e de queda não têm plano conferido` |
| Latência medida | integração | uma medida por conferência, só com `escola_id`: sem prova, com prova na janela e quando a conferência lança; a da escola A não soma na da B | a contagem do histograma antes e depois de cada chamada | `tutor-trava-da-prova.int.test.ts › grava uma medida por conferência, só com a escola no rótulo: sem prova (uma consulta), com prova na janela (as extras) e quando a conferência lança`; `tutor-trava-da-prova.int.test.ts › a medida da escola A não soma na da B: cada conferência cai na série da escola do contexto` |

## Como testar

- Trava: `apps/api/src/tutor/tutor.int.test.ts › trava o Tutor para os alunos da turma, e só para ela; encerrada,
  destrava` e `› abre entre o 202 e a execução…`
- Convocado e tentativa semeados direto no banco (a 9.0 faz a rota)
- `npx vitest run --project integracao apps/api/src/tutor/tutor-trava-da-prova.int.test.ts`

## Autoconferência

1. **Mutação de cada cláusula:** a seção "Mutações" tem 38 blocos e 6 motivos, e o `--faltando` sai vazio. Os termos das junções
   da tentativa e do convocado e do `where`, a janela e a segunda chamada (os dois termos de cada `or`), o `continue` da sem janela,
   a extensão (a prova, a da turma e a do aluno), a soma da turma (`=== null`, os minutos, o `+ daTurmaEmMs`), a tentativa sem limite
   próprio, cada argumento de `limiteDaTentativa` (base, extensões, aluno, começo, pulso e quedas) e o `Math.max` dos dois lados mais o
   `?? 0`; o laço (o `.limit(1)` e a decisão pela primeira candidata) e a medida (o `medirATrava` em volta, a escola do contexto, a medida quando a conferência lança e o único rótulo). Sem bloco e com motivo: a escola e o ano das junções (a FK composta torna iguais), o ano da extensão (idem), o `or` inteiro do filtro da extensão (a função
   repete), o `<` do instante e, cada um sozinho, o `desde` da leitura das quedas e o `iniciadaEm` da função (um descarta o que o outro também descarta; o bloco troca os dois).
2. **O texto na tela:** a tarefa não tem tela e não põe texto novo em `apps/web`. O código `TUTOR_PAUSADO_EM_AVALIACAO` e o título da prova
   que a tela mostra são os de antes.
3. **O segundo dado de cada cláusula:** o aluno de outra turma, o convocado e o colega, o aluno com e sem extensão, a queda anterior à
   tentativa ao lado da de dentro, a tentativa de outra prova encerrada, o ano da B no contexto da A e o da A no da B (cada escola tem o
   seu ano, e só os dois cruzados separam a escola do ano).
4. **A checagem anterior que responde antes:** os dois casos que vão pela rota usam o aluno da turma, com vínculo confirmado, que passa
   pela sessão e pelo alcance antes de chegar à trava; o do `409` dentro da janela tem, na mesma cena, o colega da turma sem prova, que
   recebe `202` (a rota não recusa por outro motivo). O pulso é posto fresco antes de cada caso: o banco de teste guarda o do arquivo
   anterior, e um pulso velho abriria uma lacuna em toda tentativa.
5. **A asserção olha o resultado:** o que o aluno obtém (o título da prova que o trava, ou nada, e o `409` com o código), nunca a forma
   do código; o `EXPLAIN` lê o `.toSQL()` da própria consulta do repository (`consultaDasAvaliativasAbertas`), com o `seqscan` desligado.
6. **Guarda nova:** nenhuma.
7. **Comentário que afirma o que o código não faz:** o docblock de `avaliativaAberta` diz "por aluno" (os casos do colega e do
   estendido), "o que vier depois" (o do limite que já passou, com a janela aberta) e "a queda da API não destrava o Tutor" (o da lacuna
   aberta e o da indisponibilidade fechada); o da consulta diz que a sem janela entra sempre e a segunda chamada só para o convocado
   (os casos da sem janela e da segunda chamada); o do service passou a dizer "para o aluno". O `docs/mvp-contratos.md` diz o mesmo.
8. **Divergências:** nenhuma. A assinatura de `avaliativaAberta(turmaId)` não mudou (o aluno vem do contexto), e os três chamadores do
   comando e do service seguem iguais. O `prd.md` (§6) e o `cenarios.md` (§2) dizem o mesmo que o código.
9. **Latência medida (regra 80, item 10) e alerta:** `tutor.trava.duracao{escola_id}`, em segundos, gravada em volta de `avaliativaAberta` com qualquer desfecho (a conferência roda no `POST`, no `preparar` e no `concluir`, e a duração da rota não alcança os dois últimos). O painel `fundacao.json` mostra o p95 por escola. **Decisão: sem alerta nesta tarefa**: o limiar só se acerta com a carga da sala (a tarefa 6.5 mede o cenário `prova-online.js`), e alerta sem limiar medido acorda quem opera por nada; por isso não há parágrafo novo no `docs/runbook.md`. A métrica não leva aluno, turma nem prova, só a escola (regra 20, item 9).
10. **Peça que já existe:** `limiteDaTentativa` e `QuedasDaApiRepository.leituraDesde` (a 2.0), e a bancada `FilaDeIa`, `startFakeModel`
   e `lancarLote` do Tutor. Peça nova: a consulta de `consultaDasAvaliativasAbertas`, que o `EXPLAIN` lê, e o `medirATrava`, que segue o `LoginDurationHistogram` (a medida de duração que já existe).
11. **A operação em duas chamadas ao mesmo tempo:** nenhuma. É leitura, sem gravação, e a corrida entre a prova que abre e o turno que
    já passou do `202` é a que o `turno.command.ts` já aceita e documenta (o `concluir` sem trava, regra 80); a trava por aluno não a muda.
12. **O isolamento quebra sem a cláusula:** a escola e o ano têm cada um o seu caso, com o ano da B no contexto da A e o da A no da B (os
    dois cruzados), e a extensão e a tentativa da B não esticam a trava da A. Cada linha da tabela de testes tem o caso na coluna "Caso".
13. **Os guardiões:** `tenancy-guardian` (o escopo no repository, o aluno do contexto em todas as junções, `NAO_ENCONTRADO` não se aplica:
    a resposta é o `409` ou o `202`, igual para todos), `conformidade-reviewer` (a trava por aluno é a regra 70, item 4, e a 4c; sem
    campo novo, nada do tempo adicional chega à memória) e `infra-guardian` (a consulta de cada turno desce pelo índice da turma, uma
    leitura só quando não há prova, e a queda da API não destrava o Tutor no meio da prova). O `achados/indice.md` não tem linha que
    toque o Tutor; as da 2.0 que tocam o `limiteDaTentativa` e o pulso (a leitura numa consulta só) já estão atendidas pela
    `leituraDesde`, que o repository chama.

## Fora do escopo desta tarefa

A rota da segunda chamada (9.0).

## Divergências resolvidas nesta tarefa

Nenhuma.

| Divergência | Motivo | Onde está na spec |
|---|---|---|

## Mutações

Cada bloco aplica a mutação, roda o caso citado e exige vermelho. Os casos de `tutor-trava-da-prova.int.test.ts` rodam sobre o banco compartilhado, com o pulso fresco posto antes de cada um e as duas tabelas globais devolvidas ao que eram no `afterAll`. O código novo é o `avaliativaAberta` e a consulta que ele lê (`consultaDasAvaliativasAbertas`), em `tutor.repository.ts`, e o `medirATrava`, em `trava-duration.ts`; a 7.3 (a memória) não muda código: o caso dela prova que as colunas novas não chegam ao pedido ao modelo, e não há linha de produção a mutar.

--faltando: 0 linhas (38 blocos, 6 motivos). O `.where(` de `consultaDasAvaliativasAbertas` é contexto do bloco do termo da escola, e cada um dos outros seis argumentos do `and(` tem o seu bloco.

**Sem bloco, com o motivo (cláusula equivalente ou coberta por outra peça):**

- Nas junções, os termos `eq(tentativaAtividade.escolaId, atividadeAplicada.escolaId)` e `eq(tentativaAtividade.anoLetivoId, atividadeAplicada.anoLetivoId)`, e `eq(convocadoDaSegundaChamada.escolaId, atividadeAplicada.escolaId)`: a tentativa e o convocado de uma aplicação são, por FK composta, da mesma escola e do mesmo ano da aplicação, e o id da aplicação é único; tirar um deles dá o mesmo resultado. Ficam porque a chave única da tentativa é `(escola, ano, aplicação, aluno)` e a do convocado é `(escola, aplicação, aluno)`: com a chave inteira o índice único é o que a junção usa (o `EXPLAIN` da 7.2 lê esta mesma consulta). O escopo que decide é o do `where`, que tem um bloco por termo.
- `eq(extensaoDeTempo.escolaId, escolaId)`: a aplicação tem id único, e a extensão dela é, por FK composta, da mesma escola; tirar o termo dá o mesmo resultado. Fica pela regra 10, item 3 (toda consulta leva o escopo do contexto).
- `eq(extensaoDeTempo.anoLetivoId, anoLetivoId)`: a extensão é, por FK composta, do mesmo ano da aplicação, e o `atividadeAplicadaId` já é de uma aplicação lida com o ano do contexto na consulta principal; tirar o termo dá o mesmo resultado. Entra pela regra 10, item 3 (a escola e o ano do contexto em toda cláusula), e porque a escola da extensão está ao lado dele.
- `or(isNull(extensaoDeTempo.alunoId), eq(extensaoDeTempo.alunoId, alunoId))` **inteiro**: a decisão sobre quais extensões valem é de `limiteDaTentativa` (que filtra por aluno) e da soma da turma (`extensao.alunoId === null`); o filtro do banco só poupa ler a extensão dos colegas. Os dois termos sozinhos têm bloco, e é o que prova que cada um chega à conta.
- `candidata.agora.getTime() < …`, o `<` contra `<=`: o instante do fim é o `fecha_em` ou o limite, e o `agora` é o `now()` do banco; os dois só são iguais ao microssegundo, e o teste não tem como pôr o relógio do banco nesse ponto sem relógio injetável (o `limiteDaTentativa` e o PUT usam o mesmo `now()`).
- `.leituraDesde(candidata.iniciadaEm)` e o `iniciadaEm` da função do limite, **cada um sozinho**: os dois descartam a queda anterior à tentativa, o primeiro ao ler e o segundo ao recortar cada queda em `[iniciadaEm, limite]`, e tirar um só dá o mesmo limite. O bloco "o começo da tentativa" troca os dois pelo começo do mundo, e é ele que prova que a queda anterior não conta.

<!-- tentativa: a junção pela aplicação -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › a extensão e a tentativa de outra prova da turma
falha: .toBeUndefined()
-and(eq(tentativaAtividade.escolaId, atividadeAplicada.escolaId), eq(tentativaAtividade.anoLetivoId, atividadeAplicada.anoLetivoId), eq(tentativaAtividade.atividadeAplicadaId, atividadeAplicada.id), eq(tentativaAtividade.alunoId, alunoId)),
+and(eq(tentativaAtividade.escolaId, atividadeAplicada.escolaId), eq(tentativaAtividade.anoLetivoId, atividadeAplicada.anoLetivoId), eq(tentativaAtividade.alunoId, alunoId)),
```

<!-- tentativa: a junção pelo aluno -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › a tentativa e a queda de um colega
falha: .toBeUndefined()
-and(eq(tentativaAtividade.escolaId, atividadeAplicada.escolaId), eq(tentativaAtividade.anoLetivoId, atividadeAplicada.anoLetivoId), eq(tentativaAtividade.atividadeAplicadaId, atividadeAplicada.id), eq(tentativaAtividade.alunoId, alunoId)),
+and(eq(tentativaAtividade.escolaId, atividadeAplicada.escolaId), eq(tentativaAtividade.anoLetivoId, atividadeAplicada.anoLetivoId), eq(tentativaAtividade.atividadeAplicadaId, atividadeAplicada.id)),
```

<!-- convocado: a junção pela aplicação -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › quem é convocado de uma segunda chamada não é convocado de outra
falha: .toBe('Segunda chamada dele')
-.leftJoin(convocadoDaSegundaChamada, and(eq(convocadoDaSegundaChamada.escolaId, atividadeAplicada.escolaId), eq(convocadoDaSegundaChamada.atividadeAplicadaId, atividadeAplicada.id), eq(convocadoDaSegundaChamada.alunoId, alunoId)))
+.leftJoin(convocadoDaSegundaChamada, and(eq(convocadoDaSegundaChamada.escolaId, atividadeAplicada.escolaId), eq(convocadoDaSegundaChamada.alunoId, alunoId)))
```

<!-- convocado: a junção pelo aluno -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › trava o convocado, não o colega
falha: .toBeUndefined()
-.leftJoin(convocadoDaSegundaChamada, and(eq(convocadoDaSegundaChamada.escolaId, atividadeAplicada.escolaId), eq(convocadoDaSegundaChamada.atividadeAplicadaId, atividadeAplicada.id), eq(convocadoDaSegundaChamada.alunoId, alunoId)))
+.leftJoin(convocadoDaSegundaChamada, and(eq(convocadoDaSegundaChamada.escolaId, atividadeAplicada.escolaId), eq(convocadoDaSegundaChamada.atividadeAplicadaId, atividadeAplicada.id)))
```

<!-- where: eq(atividadeAplicada.escolaId, escolaId), -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › o repository no contexto da A
falha: .toBeUndefined()
 .where(
 and(
-eq(atividadeAplicada.escolaId, escolaId),
```

<!-- where: eq(atividadeAplicada.anoLetivoId, anoLetivoId), -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › o repository no contexto da A
falha: .toBeUndefined()
 eq(atividadeAplicada.escolaId, escolaId),
-eq(atividadeAplicada.anoLetivoId, anoLetivoId),
```

<!-- where: eq(atividadeAplicada.turmaId, turmaId), -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › dentro da janela trava a turma, e só ela
falha: .toBeUndefined()
 eq(atividadeAplicada.anoLetivoId, anoLetivoId),
-eq(atividadeAplicada.turmaId, turmaId),
```

<!-- where: eq(atividadeAplicada.avaliativa, true), -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › a atividade que não é avaliativa não trava
falha: .toBeUndefined()
-eq(atividadeAplicada.avaliativa, true),
```

<!-- where: eq(atividadeAplicada.estado, 'aberta'), -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › a avaliativa sem janela
falha: .toBeUndefined()
-eq(atividadeAplicada.estado, 'aberta'),
```

<!-- where: a janela já abriu (o `or` inteiro) -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › prova de amanhã não trava
falha: .toBeUndefined()
-or(isNull(atividadeAplicada.abreEm), lte(atividadeAplicada.abreEm, sql`now()`)),
```

<!-- where: a sem janela entra (`isNull(abre_em)`) -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › a avaliativa sem janela
falha: .toBe('Prova sem janela')
-or(isNull(atividadeAplicada.abreEm), lte(atividadeAplicada.abreEm, sql`now()`)),
+lte(atividadeAplicada.abreEm, sql`now()`),
```

<!-- where: a janela já abriu (`lte(abre_em, now())`) -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › prova de amanhã não trava
falha: .toBe('Prova de amanhã')
-or(isNull(atividadeAplicada.abreEm), lte(atividadeAplicada.abreEm, sql`now()`)),
+isNull(atividadeAplicada.abreEm),
```

<!-- where: a segunda chamada só do convocado (o `or` inteiro) -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › trava o convocado, não o colega
falha: .toBeUndefined()
-or(isNull(atividadeAplicada.segundaChamadaDe), isNotNull(convocadoDaSegundaChamada.id)),
```

<!-- where: a que não é segunda chamada entra (`isNull(segunda_chamada_de)`) -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › prova de amanhã não trava
falha: .toBe('Prova de amanhã')
-or(isNull(atividadeAplicada.segundaChamadaDe), isNotNull(convocadoDaSegundaChamada.id)),
+isNotNull(convocadoDaSegundaChamada.id),
```

<!-- where: o convocado entra (`isNotNull(convocado.id)`) -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › trava o convocado, não o colega
falha: .toBe('Prova original')
-or(isNull(atividadeAplicada.segundaChamadaDe), isNotNull(convocadoDaSegundaChamada.id)),
+isNull(atividadeAplicada.segundaChamadaDe),
```

<!-- a avaliativa sem janela trava -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › a avaliativa sem janela
falha: .toBe('Prova sem janela')
-if (candidata.fechaEm === null) return { titulo: candidata.titulo }
+if (candidata.fechaEm === null) continue
```

<!-- extensão: só desta prova -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › a extensão e a tentativa de outra prova da turma
falha: .toBeUndefined()
-.where(and(eq(extensaoDeTempo.escolaId, escolaId), eq(extensaoDeTempo.anoLetivoId, anoLetivoId), eq(extensaoDeTempo.atividadeAplicadaId, candidata.id), or(isNull(extensaoDeTempo.alunoId), eq(extensaoDeTempo.alunoId, alunoId))))
+.where(and(eq(extensaoDeTempo.escolaId, escolaId), eq(extensaoDeTempo.anoLetivoId, anoLetivoId), or(isNull(extensaoDeTempo.alunoId), eq(extensaoDeTempo.alunoId, alunoId))))
```

<!-- extensão: a da turma (`isNull(aluno)`) -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › a extensão da turma, com o aluno sem tentativa
falha: .toBe('Prova estendida à turma')
-.where(and(eq(extensaoDeTempo.escolaId, escolaId), eq(extensaoDeTempo.anoLetivoId, anoLetivoId), eq(extensaoDeTempo.atividadeAplicadaId, candidata.id), or(isNull(extensaoDeTempo.alunoId), eq(extensaoDeTempo.alunoId, alunoId))))
+.where(and(eq(extensaoDeTempo.escolaId, escolaId), eq(extensaoDeTempo.anoLetivoId, anoLetivoId), eq(extensaoDeTempo.atividadeAplicadaId, candidata.id), or(eq(extensaoDeTempo.alunoId, alunoId))))
```

<!-- extensão: a do aluno (`eq(aluno)`) -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › o aluno estendido além do
falha: .toBe('Prova com extensão')
-.where(and(eq(extensaoDeTempo.escolaId, escolaId), eq(extensaoDeTempo.anoLetivoId, anoLetivoId), eq(extensaoDeTempo.atividadeAplicadaId, candidata.id), or(isNull(extensaoDeTempo.alunoId), eq(extensaoDeTempo.alunoId, alunoId))))
+.where(and(eq(extensaoDeTempo.escolaId, escolaId), eq(extensaoDeTempo.anoLetivoId, anoLetivoId), eq(extensaoDeTempo.atividadeAplicadaId, candidata.id), or(isNull(extensaoDeTempo.alunoId))))
```

<!-- soma da turma: só a extensão sem aluno -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › a extensão da turma, com o aluno sem tentativa
falha: .toBe('Prova estendida à turma')
-const daTurmaEmMs = extensoes.filter((extensao) => extensao.alunoId === null).reduce((soma, extensao) => soma + extensao.minutos * MS_POR_MINUTO, 0)
+const daTurmaEmMs = extensoes.filter((extensao) => extensao.alunoId !== null).reduce((soma, extensao) => soma + extensao.minutos * MS_POR_MINUTO, 0)
```

<!-- soma da turma: minutos em milissegundos -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › a extensão da turma, com o aluno sem tentativa
falha: .toBe('Prova estendida à turma')
-const daTurmaEmMs = extensoes.filter((extensao) => extensao.alunoId === null).reduce((soma, extensao) => soma + extensao.minutos * MS_POR_MINUTO, 0)
+const daTurmaEmMs = extensoes.filter((extensao) => extensao.alunoId === null).reduce((soma, extensao) => soma + extensao.minutos, 0)
```

<!-- o fim da janela leva a extensão da turma -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › a extensão da turma, com o aluno sem tentativa
falha: .toBe('Prova estendida à turma')
-const fimDaJanela = candidata.fechaEm.getTime() + daTurmaEmMs
+const fimDaJanela = candidata.fechaEm.getTime()
```

<!-- o aluno sem tentativa não tem limite próprio -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › o aluno estendido além do
falha: .toBe('Prova com extensão')
-candidata.iniciadaEm === null
-? null
+true
+? null
```

<!-- limite: a base da tentativa -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › o aluno estendido além do
falha: .toBe('Prova com extensão')
-: limiteDaTentativa({ alunoId, iniciadaEm: candidata.iniciadaEm, limiteBase: candidata.limiteBaseEm, extensoes, ...(await quedas.leituraDesde(candidata.iniciadaEm)) })
+: limiteDaTentativa({ alunoId, iniciadaEm: candidata.iniciadaEm, limiteBase: null, extensoes, ...(await quedas.leituraDesde(candidata.iniciadaEm)) })
```

<!-- limite: as extensões -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › o aluno estendido além do
falha: .toBe('Prova com extensão')
-: limiteDaTentativa({ alunoId, iniciadaEm: candidata.iniciadaEm, limiteBase: candidata.limiteBaseEm, extensoes, ...(await quedas.leituraDesde(candidata.iniciadaEm)) })
+: limiteDaTentativa({ alunoId, iniciadaEm: candidata.iniciadaEm, limiteBase: candidata.limiteBaseEm, extensoes: [], ...(await quedas.leituraDesde(candidata.iniciadaEm)) })
```

<!-- limite: o aluno -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › o aluno estendido além do
falha: .toBe('Prova com extensão')
-: limiteDaTentativa({ alunoId, iniciadaEm: candidata.iniciadaEm, limiteBase: candidata.limiteBaseEm, extensoes, ...(await quedas.leituraDesde(candidata.iniciadaEm)) })
+: limiteDaTentativa({ alunoId: '', iniciadaEm: candidata.iniciadaEm, limiteBase: candidata.limiteBaseEm, extensoes, ...(await quedas.leituraDesde(candidata.iniciadaEm)) })
```

<!-- limite: o começo da tentativa -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › uma indisponibilidade fechada dentro da prova
falha: .toBeUndefined()
-: limiteDaTentativa({ alunoId, iniciadaEm: candidata.iniciadaEm, limiteBase: candidata.limiteBaseEm, extensoes, ...(await quedas.leituraDesde(candidata.iniciadaEm)) })
+: limiteDaTentativa({ alunoId, iniciadaEm: new Date(0), limiteBase: candidata.limiteBaseEm, extensoes, ...(await quedas.leituraDesde(new Date(0))) })
```

<!-- limite: o pulso e as indisponibilidades -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › uma indisponibilidade fechada dentro da prova
falha: .toBe('Prova com queda')
-: limiteDaTentativa({ alunoId, iniciadaEm: candidata.iniciadaEm, limiteBase: candidata.limiteBaseEm, extensoes, ...(await quedas.leituraDesde(candidata.iniciadaEm)) })
+: limiteDaTentativa({ alunoId, iniciadaEm: candidata.iniciadaEm, limiteBase: candidata.limiteBaseEm, extensoes, pulso: null, indisponibilidades: [] })
```

<!-- a lacuna aberta conta -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › a lacuna aberta montada à mão
falha: .toBe('Prova com a API fora')
-: limiteDaTentativa({ alunoId, iniciadaEm: candidata.iniciadaEm, limiteBase: candidata.limiteBaseEm, extensoes, ...(await quedas.leituraDesde(candidata.iniciadaEm)) })
+: limiteDaTentativa({ alunoId, iniciadaEm: candidata.iniciadaEm, limiteBase: candidata.limiteBaseEm, extensoes, pulso: null, indisponibilidades: [] })
```

<!-- decide o que vier depois: só o limite -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › o aluno cujo limite já passou segue travado
falha: .toBe('Prova de duas horas')
-if (candidata.agora.getTime() < Math.max(fimDaJanela, limite?.getTime() ?? 0)) return { titulo: candidata.titulo }
+if (candidata.agora.getTime() < (limite?.getTime() ?? 0)) return { titulo: candidata.titulo }
```

<!-- decide o que vier depois: só o fim da janela -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › o aluno estendido além do
falha: .toBe('Prova com extensão')
-if (candidata.agora.getTime() < Math.max(fimDaJanela, limite?.getTime() ?? 0)) return { titulo: candidata.titulo }
+if (candidata.agora.getTime() < fimDaJanela) return { titulo: candidata.titulo }
```

<!-- sem limite, o fim da janela decide -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › depois do fim efetivo
falha: .toBeUndefined()
-if (candidata.agora.getTime() < Math.max(fimDaJanela, limite?.getTime() ?? 0)) return { titulo: candidata.titulo }
+if (candidata.agora.getTime() < Math.max(fimDaJanela, limite?.getTime() ?? Number.POSITIVE_INFINITY)) return { titulo: candidata.titulo }
```

<!-- o laço olha todas as candidatas, não só a primeira por id (`.limit(1)`) -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › duas avaliativas abertas na turma
falha: .toBe(tituloDe.get(segunda))
-.orderBy(asc(atividadeAplicada.id))
+.orderBy(asc(atividadeAplicada.id)).limit(1)
```

<!-- o laço decide por todas as candidatas, não só pela primeira -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › duas avaliativas abertas na turma
falha: .toBe(tituloDe.get(segunda))
-if (candidata.agora.getTime() < Math.max(fimDaJanela, limite?.getTime() ?? 0)) return { titulo: candidata.titulo }
+return candidata.agora.getTime() < Math.max(fimDaJanela, limite?.getTime() ?? 0) ? { titulo: candidata.titulo } : undefined
```

<!-- a conferência é medida -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › grava uma medida por conferência
falha: .toBe(antes.contagem + 1)
-return medirATrava(this.medidor, this.#aluno().escolaId, () => this.#quemTrava(turmaId))
+return this.#quemTrava(turmaId)
```

<!-- a medida leva a escola do contexto -->
```mutacao
arquivo: apps/api/src/tutor/tutor.repository.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › a medida da escola A não soma na da B
falha: .toBe(antesB.contagem + 1)
-return medirATrava(this.medidor, this.#aluno().escolaId, () => this.#quemTrava(turmaId))
+return medirATrava(this.medidor, 'sistema', () => this.#quemTrava(turmaId))
```

<!-- a medida sai também quando a conferência lança -->
```mutacao
arquivo: apps/api/src/tutor/trava-duration.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › grava uma medida por conferência
falha: .toBe(comProva.contagem + 1)
-try {
-return await conferir()
-} finally {
-histograma.record((performance.now() - inicio) / 1_000, { [ROTULO_ESCOLA]: escolaId })
-}
+const resultado = await conferir()
+histograma.record((performance.now() - inicio) / 1_000, { [ROTULO_ESCOLA]: escolaId })
+return resultado
```

<!-- o único rótulo é a escola -->
```mutacao
arquivo: apps/api/src/tutor/trava-duration.ts
teste: apps/api/src/tutor/tutor-trava-da-prova.int.test.ts › grava uma medida por conferência
falha: .toEqual([ROTULO_ESCOLA])
-histograma.record((performance.now() - inicio) / 1_000, { [ROTULO_ESCOLA]: escolaId })
+histograma.record((performance.now() - inicio) / 1_000, { [ROTULO_ESCOLA]: escolaId, turma: escolaId })
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| conformidade-reviewer (1ª) | O professor não vê quais alunos da turma estão com o Tutor travado depois do `fecha_em` (o estendido, o convocado): pergunta de produto para a tela do modo sala | Tarefa 11.0 (painel "Acompanhar"). O revisor citou a 9.0, mas o documento da 9.0 diz que a tela é da 11.0. Não é lacuna da regra 70: o aluno travado não usa o Tutor |
| revisor-geral (1ª) | `cenarios.md` §2 (linhas 102 a 105) aponta `tutor.int.test.ts` para os casos que estão em `tutor-trava-da-prova.int.test.ts` | `TODO.md`: o arquivo não é um que a tarefa toque; o Validador confere a referência no fim da funcionalidade |
| revisor-geral (1ª) | `consultaDasAvaliativasAbertas` ficou pública só para o `EXPLAIN`; ver como a correção `explain-semana-itens` expõe a consulta | `TODO.md`: o docblock já explica o motivo, e mudar a forma não muda comportamento nem contrato |
| infra-guardian (1ª) | O `EXPLAIN` só confere `atividade_aplicada`; estender às consultas de extensão, tentativa e convocado | `TODO.md`: exige expor mais consultas só para o `.toSQL()`; o título do caso agora diz o que o plano confere (item 10 da ordem) |
| infra-guardian (1ª) | O laço faz duas consultas por candidata; trazer a soma das extensões na consulta principal ou ler as quedas uma vez antes do laço | Tarefa 6.0 (a rotina encerra a prova vencida, que é o que faz o número de candidatas crescer). A mudança de desenho muda comportamento, e a instância das quedas já saiu do laço (item 4 da ordem) |
| infra-guardian (1ª) | O cenário k6 previsto (`prova-online.js`) não gera turnos do Tutor com prova aberta | Tarefa 6.5 (carga `prova-online.js`) |
| test-engineer (1ª) | O "409, não 503" da lacuna aberta promete mais do que o teste prova: a `FilaDeIa` não chama `PulsoService.start()`, e `aceitaProva()` devolve sempre `true` | `TODO.md`: provar de verdade exige subir uma API com o relógio do pulso injetado, bancada nova; o `cenarios.md` pede só o relógio da recusa ainda fresco, que está atendido |
| test-engineer (1ª) | A tarefa diz "latência medida", mas o diff não traz métrica | Atendida: `tutor.trava.duracao{escola_id}` (item 1 da ordem) |
| test-engineer (1ª) | "A extensão e a tentativa da B não esticam a trava da A" não falharia sem o escopo da escola | Recusada: é controle de cena, e o próprio revisor diz que a prova de isolamento está no caso dos dois contextos cruzados; a seção "Mutações" já registra isso |
| test-engineer (2ª), revisor-geral (2ª) | O comando e o service constroem o repository sem passar o medidor que recebem; nenhum teste prova que um turno de verdade grava as três medidas, e o `globalMeter()` de produção não é exercitado | `TODO.md`: ligar o medidor nos cinco pontos e provar pela `FilaDeIa`; entra junto com a 6.5 (carga) |
| test-engineer (2ª) | O controle do log (`log.length > 0`) não prova que o log do turno foi capturado: `linhasDeLog` acumula o arquivo inteiro | `TODO.md`: endurecer o controle |
| test-engineer (2ª), conformidade-reviewer (2ª) | `"percentual"` estreita a busca: comentar qual texto legítimo contém a palavra solta e buscar também o valor semeado | `TODO.md`: comentário e asserção de teste, sem mudar comportamento |
| test-engineer (2ª), infra-guardian (2ª), tenancy-guardian (2ª) | `delete from indisponibilidade` sem filtro no `beforeAll`: só é seguro com os arquivos de integração rodando um por vez; a premissa deveria constar na configuração da bancada | `TODO.md`: a configuração do vitest de integração não é da tarefa |
| infra-guardian (2ª), revisor-geral (2ª) | Guardar o histograma num lugar fixo (como o `LoginDurationHistogram`, ou um `WeakMap` por medidor) em vez de pedi-lo a cada conferência | Recusada: o docblock de `trava-duration.ts` justifica, o SDK reaproveita o mesmo instrumento e o comportamento não muda |
| infra-guardian (2ª) | Voltar ao alerta da trava com o limiar que sair da carga da 6.5, e registrar o lembrete no `TODO.md` | Tarefa 6.5 (carga `prova-online.js`); a decisão "sem alerta" está escrita na tarefa, e o `TODO.md` guarda o lembrete |
| revisor-geral (2ª) | `7_task.md` dizia "32 blocos, 5 motivos" e "o código novo é só o `avaliativaAberta`" | Aplicada: 38 blocos e 6 motivos, e o `trava-duration.ts` entra no texto |
| revisor-geral (2ª) | O repository é o único que recebe um `Meter`; mover a medida só se houver segundo caso | `TODO.md`: decisão de desenho só quando houver o segundo caso |
| tenancy-guardian (2ª) | `#aluno()` é chamado duas vezes por conferência: passar o resultado da primeira | Recusada: o contexto é o mesmo, sem risco, e a mudança mexe em linhas que os blocos de "Mutações" citam |
| privacy-guardian (2ª) | Manter `{{escola_id}}` (UUID, nunca o nome da escola) como legenda do painel 62 | Nenhuma ação: é a regra a manter num refinamento futuro do painel |
| conformidade-reviewer (2ª) | Quando a 11.0 mostrar ao professor quem está travado, dizer só o fato ("Tutor pausado: em prova"), sem o motivo da extensão nem o tempo adicional (regra 20, item 3) | Tarefa 11.0 (painel "Acompanhar"), junto com a pergunta de produto da 1ª rodada |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-24 00:51:29 | 2026-11-24 00:52:19 | `tenancy-guardian` | 1 | APROVADO | a973ab127eab1632c |
| 2026-11-24 00:51:33 | 2026-11-24 00:52:19 | `privacy-guardian` | 1 | APROVADO | a170e836730c88dd2 |
| 2026-11-24 00:51:30 | 2026-11-24 00:52:28 | `conformidade-reviewer` | 1 | APROVADO | abea570133bb2fe01 |
| 2026-11-24 00:51:35 | 2026-11-24 00:53:16 | `revisor-geral` | 1 | APROVADO | a3322e6144dc6d2c8 |
| 2026-11-24 00:51:31 | 2026-11-24 00:53:46 | `infra-guardian` | 1 | REPROVADO | ae5eb3e9f1caf58f4 |
| 2026-11-24 00:51:34 | 2026-11-24 00:55:16 | `test-engineer` | 1 | REPROVADO | a7dc3d9a484a3442b |
| 2026-11-24 01:53:22 | 2026-11-24 01:53:55 | `tenancy-guardian` | 2 | APROVADO | ae4ee0b956c2d5ab6 |
| 2026-11-24 01:53:27 | 2026-11-24 01:54:04 | `conformidade-reviewer` | 2 | APROVADO | a4a0a628bf31affa6 |
| 2026-11-24 01:53:38 | 2026-11-24 01:54:12 | `privacy-guardian` | 2 | APROVADO | a145b0f4a6edcdbfa |
| 2026-11-24 01:53:33 | 2026-11-24 01:54:14 | `infra-guardian` | 2 | APROVADO | aa81054f958108e26 |
| 2026-11-24 01:53:50 | 2026-11-24 01:55:07 | `revisor-geral` | 2 | APROVADO | a57e63703d46e1853 |
| 2026-11-24 01:53:45 | 2026-11-24 01:55:46 | `test-engineer` | 2 | APROVADO | ae2235da4249bee02 |
