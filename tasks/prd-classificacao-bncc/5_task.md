# Tarefa 5.0 — A classificação é agendada na extração e às 19h, com o teto de três noites e o alerta

**Funcionalidade:** classificacao-bncc · **Depende de:** 4.0
**Subagentes obrigatórios:** `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian`
**Porte:** grande

## Objetivo

A extração cria as execuções das seções novas; às 19h, por escola, a rotina agenda a seção sem classificação ou cuja
última falhou (menos de três vezes seguidas); o alerta `classificacao-atrasada` avisa na abertura da janela; e 300
apostilas cabem numa noite.

## Contexto necessário

- `techspec.md` §5 "Seções", "Agendar" (a), "Degradação do lote"; §7c
- `prd.md` RF5, RF15
- `cenarios.md` "Seções e agendamento" (até o laço), "Alerta e métrica", "Carga", P9
- `revisao-spec.md`, rodada 6 (o runbook)
- `.claude/rules/`: 10, 70, 80
- Código: `apps/worker/src/job-schedules.ts`, `packages/core/src/cron/cron-escolas.repository.ts`,
  `infra/grafana/alertas/pdf-parado.yaml`, `infra/scripts/carga-ingestao.ts`

## Subtarefas

- [x] 5.1 — As execuções e os jobs na extração (§5 "Seções"); a seção herdada não ganha execução
- [x] 5.2 — O job `material.agendar-classificacao` e a rotina das 19h em `JOB_SCHEDULES` (§5 "Agendar" (a)), com P9
- [x] 5.3 — A seção com falha numa execução só dela; o laço em lotes de 500 (§7c "Laços")
- [x] 5.4 — O alerta `classificacao-atrasada` e o runbook (a rodada 6 da `revisao-spec.md`)
- [x] 5.5 — A carga das 300 apostilas, rodada (`cenarios.md` "Carga")
- [x] 5.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/shared/src/system/job-definitions.ts`, `packages/shared/src/system/job-definitions.test.ts`, `apps/worker/src/job-schedules.ts`, `apps/worker/test/uso.int.test.ts`, `apps/worker/src/processors/extrair-pdf.ts`, `apps/worker/test/extrair-pdf.int.test.ts`, `apps/worker/src/app.module.ts`, `docs/runbook.md`, `package.json` | alterado |
| `apps/api/src/material/agendar-classificacao.ts`, `apps/api/src/material/agendamento.int.test.ts`, `apps/api/src/material/secoes.repository.ts`, `infra/grafana/alertas/classificacao-atrasada.yaml`, `infra/test/alerta-de-classificacao-atrasada.int.test.ts`, `infra/scripts/carga-classificacao.ts`, `infra/test/carga-classificacao.test.ts` | novo e alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| 25 seções | I | 3 execuções (12, 12, 1), cada seção com o seu `execucao_id` | |
| execução e job | I | sem ano nem `solicitada_por`; `naoUrgente`. Mutação: `false` | |
| sem componente; função suspensa | I | seções, nenhuma execução | |
| dois jobs da extração em `Promise.all` | P | execuções uma vez | |
| seção herdada | I | sem execução; as outras ganham | |
| rotina: `nao_agendada`; `nao_classificada` com menos de 3 | I | agenda | |
| rotina: corrigida sem execução | I | não agenda. Mutação: tirar o filtro de `corrigida_em` | |
| rotina: `aguardando`; `classificada`; `sem_habilidade`; material não `pronto`; sem componente | I | não toca, um caso cada. Mutação: aceitar `concluida` | |
| rotina da A | I | não toca a da B. Mutação: tirar `escola_id` | |
| rotina com a função suspensa | I | nada | |
| quarta noite | I | sem modelo. Mutação: tirar o `< 3` | |
| retomada; depois de `EXECUCAO_INTERROMPIDA` | I | volta na noite seguinte | |
| noite seguinte à falha de 12 | I | 12 execuções de uma; as 11 zeram, a que falha chega a 3. Mutação: agrupar com `falhas_seguidas > 0` | |
| seção nova na mesma noite | I | separada das com falha | |
| laço com mais de 500; com o sinal | I | um lote por transação; para entre lotes. Mutação: um lote só | |
| P9, rotina × rotina | P | uma execução. Mutação: tirar `is not distinct from` | |
| agenda | I | 19h de São Paulo, sem duplicar o agendador | |
| alerta: `falhou` na noite; `pendente` de antes; janela da escola diferente | I | dispara, um caso cada | |
| alerta: `pendente` da própria noite; sem elas; outra escola | I | não dispara, um caso cada | |
| alerta tem runbook | U | `alerta-tem-runbook.test.ts` | |
| log da rotina | U | sem título, texto nem código | |
| carga: 300 materiais | C | nenhuma seção sem classificação na abertura | |
| carga: provedor fora 10 min; Tutor da B | C | adiam e retomam; medido, com vagas e réplicas | |

## Como testar

- Rotina por escola: `apps/worker/test/expurgo-da-escola.int.test.ts` › "[P] duas rotinas ao mesmo tempo criam um job por escola"; agenda: `apps/worker/test/uso.int.test.ts`
- Alerta: `infra/test/alerta-do-pdf-parado.int.test.ts` › "o worker-pdf parado e o job pendente há 16 min…"; runbook como "## Extração de PDF parada"
- Carga: `infra/scripts/carga-ingestao.ts` e `infra/test/carga-ingestao.test.ts` › "a projeção é a vazão medida vezes as 300…"
- `npx vitest run --project integracao apps/api/src/material/agendamento.int.test.ts`
- Armadilha: semeie mais seções que o lote, e uma de outra escola (autoconferência 4)

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3: cada estado da seção ao lado do que a rotina pega.

## Fora do escopo desta tarefa

O recorte (6.0); reclassificar e D76 (7.0).

## Plano (Implementador)

**Arquivos:** os da tabela "Arquivos previstos", com três mudanças de lugar (divergências 1 e 2): a lógica do agendamento mora em `packages/core/src/material/agendamento-da-classificacao.repository.ts` (e não em `apps/api/src/material/agendar-classificacao.ts` e `secoes.repository.ts`), os processadores em `apps/worker/src/processors/agendar-classificacao.ts` e a fiação em `apps/worker/src/composition.ts` (o worker não tem `app.module.ts`). Novos: `packages/core/src/material/classificacao-atrasada.repository.ts`, `apps/worker/src/classificacao-gauge.ts`, `infra/scripts/conferir-carga-classificacao.ts`, `apps/worker/test/classificacao-agendada.int.test.ts`. Alterados além dos previstos: `packages/core/src/queue/janela-letiva.ts` (+ teste: `ultimaNoite`), `packages/core/src/telemetry/metrics.ts` (+ teste), `packages/core/src/index.ts`, `packages/shared/src/index.ts`, `apps/worker/src/composition.ts` (+ teste), `apps/api/test/architecture.test.ts` (a lista de quem usa a rotina), `infra/grafana/paineis/fundacao.json` (o painel obrigatório da métrica), `infra/scripts/ensaio-alertas.ts`, `infra/test/alertas.test.ts`, `infra/test/metricas.int.test.ts`, `tools/guardas/alerta-tem-runbook.test.ts`, `tools/testes/metricas.ts`, `infra/k6/ingestao.js` (o ritmo do Tutor da B vira variável, com o mesmo padrão de antes), `packages/core/src/jobs/job-executor.test.ts`.

**Interfaces:** `TIPO_AGENDAR_CLASSIFICACAO_DAS_ESCOLAS` (`sistema.agendar-classificacao`: fila `lote`, escopo `sistema`, executor `worker`, não urgente, 10 min) e `TIPO_AGENDAR_CLASSIFICACAO` (`material.agendar-classificacao`: escopo `escola`, 30 min); `AgendamentoDaClassificacaoRepository` (`funcaoEstaAtiva`, `proximasSecoes(limite, { materialId?, depoisDe? })`, `agendar(secoes, enfileirador, maximoDeExecucoes?)`); `ClassificacaoAtrasadaRepository.atrasadas(fechouEm, abriuEm)`; `ultimaNoite(janela, agora)`; `ClassificacaoGauge` (a `EscolaGauge` da métrica `classificacao.execucoes_atrasadas`); `criarRotinaDaClassificacao` e `criarAgendamentoDaClassificacao`; o alerta `educa-classificacao-atrasada` e a entrada do runbook.

**Testes:** a tabela acima, com a lista "linha → caso" abaixo; o cenário de carga é manual (`npm run carga:classificacao`), com o veredito em `conferir-carga-classificacao.ts` e a unidade `infra/test/carga-classificacao.test.ts`.

**Linha → caso** (a tabela não tem a coluna "Caso"; aqui estão os arquivos: `A` = `apps/api/src/material/agendamento.int.test.ts`, `W` = `apps/worker/test/classificacao-agendada.int.test.ts`, `X` = `apps/worker/test/extrair-pdf.int.test.ts`):

| Linha da tabela | Caso |
|---|---|
| 25 seções | `A` › "25 seções do mesmo recorte: três execuções (12, 12 e 1)…"; `X` › "[I] 30 capítulos: três execuções (12, 12 e 6)…" |
| execução e job | `A` › "nao_agendada e nao_classificada com menos de 3 falhas ganham execução, sem ano nem pessoa…"; `X` › "[I] material com componente e série…"; a mutação de `naoUrgente: false` está nos blocos do `job-definitions` |
| sem componente; função suspensa | `A` › "a disciplina sem componente…", "a função suspensa na escola…"; `X` › "[I] a disciplina sem componente…", "[I] a função suspensa na escola…" |
| dois jobs da extração em `Promise.all` | `X` › "[P] dois jobs da mesma extração em `Promise.all`…" |
| seção herdada | `X` › "[I] a seção que herdou a correção da anterior não vai à classificação; as outras, sim" |
| rotina: `nao_agendada`; `nao_classificada` com menos de 3 | `A` › "nao_agendada e nao_classificada com menos de 3 falhas ganham execução…" |
| rotina: corrigida sem execução | `A` › "a seção corrigida sem execução não é agendada…", "a seção corrigida pela coordenação não é lida, mesmo sem execução" |
| rotina: `aguardando`; `classificada`; `sem_habilidade`; material não `pronto`; sem componente | `A` › "aguardando (execução pendente)…", "aguardando (execução rodando)…", "classificada ou sem habilidade (execução concluída)…", "o material não está `pronto`…", "o material foi excluído…", "o material não tem série declarada…", "a disciplina sem componente…", "só é lida a seção sem execução ou a que falhou abaixo do teto…" |
| rotina da A não toca a da B | `A` › "a rotina da escola A não toca a seção da B", "isolamento: o repository, no contexto da A…" |
| rotina com a função suspensa | `A` › "a função suspensa na escola…", "a suspensão de outra função da escola não suspende a classificação" |
| quarta noite | `A` › "a seção com 3 falhas seguidas não chama o modelo na quarta noite; com 2, sim" |
| retomada; depois de `EXECUCAO_INTERROMPIDA` | `A` › "a execução que falhou sem somar (EXECUCAO_INTERROMPIDA, FUNCAO_SUSPENSA) volta na noite seguinte…" |
| noite seguinte à falha de 12; seção nova na mesma noite | `A` › "a execução de 12 seções falhou por causa de uma…"; `apps/api/src/material/classificacao.int.test.ts` (da 4.0) › "a saída inválida soma 1 nas doze seções da execução, e o sucesso seguinte zera" |
| laço com mais de 500; com o sinal | `A` › "mais seções que o lote: cada lote numa transação…", "um lote por transação: quando o segundo lote enfileira…", "um lote por transação: o lote que falha desfaz só ele…", "a função suspensa entre o primeiro e o segundo lote…", "cada lote corre com o `statement_timeout` de 20 s", "o sinal abortado entre os lotes…", "o limite de execuções da noite…" |
| P9, rotina × rotina | `A` › "[P] P9: dois agendamentos…" (os dois casos); `W` › "[P] duas rotinas ao mesmo tempo criam um job por escola" |
| agenda | `apps/worker/test/uso.int.test.ts` › "as rotinas são agendadas à 1h, às 2h, às 3h30 e às 4h30 de São Paulo, a da classificação às 19h…" |
| alerta: dispara / não dispara | `W` › a medição (cinco casos, um por condição) e `infra/test/alerta-de-classificacao-atrasada.int.test.ts` › "a falha da noite, a pendente de antes e a falha da noite da janela própria disparam; a pendente da noite, a falha da abertura e a escola sem execução não" |
| alerta tem runbook | `tools/guardas/alerta-tem-runbook.test.ts` |
| log da rotina | `W` › "grava um `material.agendar-classificacao` por escola…; o log só tem contagens e ids"; `A` › "mais seções que o lote…o log diz os lotes, as execuções e as seções, sem título nem texto" |
| carga | `infra/test/carga-classificacao.test.ts` (o veredito) e a corrida registrada abaixo |

### A carga rodada (5.5)

`npm run carga:classificacao`, em 18/11/2026, sobre o compose de carga (adaptador **falso**, nenhuma chamada a provedor pago), a corrida inteira em **159 minutos**. As escolas e os alunos são sintéticos: a A recebeu 300 apostilas `prontas` de 25 seções de uma página cada (componente `quimica`, 9º ano, 7.500 seções), e a B, 60 alunos do Tutor.

| O que se mediu | Resultado |
|---|---|
| Configuração | 2 réplicas do `worker-ia` (`IA_REPLICAS`), pool `lote` de 1 por réplica, vaga da escola no lote 2 (`VAGAS_ESCOLA_LOTE`), balde do `lote` de 125 mil tokens/min (5 % de 2,5 milhões), **31 mil tokens por execução** (30.400 de entrada e 600 de saída: o recorte maior da §7c) e 6 s por chamada |
| Agendamento | o job da A criou **7.500 seções em 630 execuções, 630 jobs** (15 lotes de 500, 42 execuções cada: 41 de 12 e uma de 8; a Tech Spec dizia ~625) |
| Classificação | **630 execuções concluídas, 7.500 seções classificadas, 0 sem classificação, 0 falhas, 0 pendentes** |
| Vazão | 13,7 s por execução, **4,4 por minuto** (a conta de 31 mil tokens dá 4); as 630 levam **2,4 h**, dentro das 10 h da noite |
| Provedor fora | com 126 execuções concluídas, os dois `worker-ia` ficaram parados por 10 min: **0 execuções concluídas durante a parada**, e depois dela as 501 que esperavam voltaram a andar sozinhas, até o fim, sem nenhuma `falhou` |
| Tutor da B | base de 6.062 ms (61 turnos) e **6.097 ms com o lote andando** (90 turnos): +35 ms, dentro da margem de 500; nenhum 429 e nenhuma resposta inesperada nas duas fases |
| `EXPLAIN (ANALYZE)` da medição do alerta, 18/11/2026 (item 1 da ordem da rodada 1) | cópia do banco de teste com **400 mil turnos de Tutor** (10 % `falhou`) e 631 execuções `classificar_secoes` (4 `falhou`, 2 `pendente`) na mesma escola, `analyze` feito, a consulta como o `pg` a manda (parâmetros): **sem o índice**, `Parallel Seq Scan` em `execucao_agente`, 22,4 ms e 11.789 buffers, 133 mil linhas removidas por trabalhador; **com `execucao_agente_classificacao_idx`**, `BitmapOr` de dois `Bitmap Index Scan` (o `falhou` por `concluida_em` e o `pendente`), **0,075 ms e 5 buffers**, só as linhas da classificação |
| `EXPLAIN (ANALYZE)` | a cobertura da série (sobre as 7.500 seções) em **3 ms**, e o join da busca (trecho → seção da página → habilidades) em **6 ms**; o teto é 200 ms. O texto das páginas é o mesmo, então a busca varre a tabela de trechos: com texto real o filtro `tsvector` é seletivo |

A corrida terminou com "reprovou" por um número que a spec não pede: o veredito esperava 625 execuções (7.500 ÷ 12), e o agendamento fez 630. O critério da spec, "nenhuma seção sem classificação na abertura da janela", foi atendido (0 de 7.500). O veredito passou a esperar 630 (15 lotes × 42) e a explicar a conta; a medida não mudou, e ele não foi corrido de novo sobre uma segunda corrida de 159 min (divergência abaixo). O ensaio anterior, com o Tutor da B a 90 turnos por minuto e 30 alunos, ficou com 429 e p95 de 12,9 s na base, e por isso o ritmo e o número de alunos mudaram (divergência abaixo).

### Autoconferência

1. **Mutações:** a seção "Mutações" abaixo, um bloco por cláusula do diff, e a meia linha do porquê onde nenhum teste distingue (a lista do `--faltando` fecha com blocos e motivos). Os blocos de P9, do `< 3`, do agrupamento de falha, do `limite` e do corpo do alerta foram escritos junto de um teste que falha sem eles; o `where` de `proximasSecoes` ganhou três casos de leitura (a vaga do lote, o cursor, a seção corrigida entre a leitura e o agendamento), porque o `flatMap` e o `agendar` escondiam o filtro de SQL.
2. **Texto na tela:** nenhum. A tarefa não tem tela; o que a coordenação lê é o runbook, que o alerta cita.
3. **Segundo dado e o estado da seção:** a seção `nao_agendada` (sem execução) e a `nao_classificada` (execução `falhou`, menos de 3) são as únicas que a rotina pega; `aguardando` (execução `pendente` ou `rodando`), `classificada` e `sem_habilidade` (execução `concluida`), a corrigida sem execução, o material não `pronto` ou excluído, a disciplina sem componente e o material sem série ficam como estão, um caso cada (a tabela "Linha → caso"). O segundo dado é a escola B, com seção, suspensão e execução próprias, e o material de 25 seções que passa do lote.
4. **Checagem anterior:** a função suspensa é lida a cada lote (não só no começo); o `agendar` troca o `execucao_id` com `execucao_id is not distinct from :lido` e `corrigida_em is null`; a execução que perde a corrida sai na mesma transação, sem job. A extração só agenda o material que acabou de gravar (`materialId` no filtro).
5. **Asserção:** os casos de ausência (nenhuma execução, nenhum job, escola sem série) vêm ao lado do caso em que a mesma chamada agenda; o que se lê é o banco, e não o retorno do repository, exceto no P9, em que o retorno `{ execucoes: 0, secoes: 0 }` é o que se prova.
6. **Guarda nova:** nenhuma. A classe de repository só mora em `*.repository.ts` (`repositories-com-escopo`), e a lista de quem usa a rotina (`architecture.test.ts`) ganhou o `classificacao-gauge.ts` e o `agendar-classificacao.ts`.
7. **Comentários e docs:** os docblocks dizem o que o código faz; `docs/runbook.md` tem a entrada "Classificação do material atrasada"; a Tech Spec §2, §5 e §7c e o `cenarios.md` levam o que a tarefa mudou (a tabela de divergências).
8. **Divergências:** a tabela abaixo; todas entraram na `techspec.md` ou no `cenarios.md`. O `prd.md` não diz o contrário.
9. **Peça que já existe:** `JobOutbox.enfileirarUmaVez` e a rotina do expurgo (`criarRotinaDoExpurgo`, o molde), `EscolaGauge` e as quatro medições irmãs, `CronEscolasRepository.listarIds`, `OperationalSettings<JanelaLetiva>` e `estaNaJanela`, `FilaDeIa` e `entregarDeNovo` (6.0), `liberarJanelaDaA`, `semearTutorDaB` e os ajudantes da carga do expurgo e da ingestão.
10. **Corrida:** P9 (a rotina duas vezes, o primeiro agendamento parado depois de ler) e a rotina das 19h duas vezes ao mesmo tempo (`Promise.all`, um job por escola, pela chave da noite); dois jobs da mesma extração (a transição para `pronto` é de quem a fez).
11. **Isolamento:** a seção, a suspensão, a execução e o job da B ficam intocados pela rotina da A, pelo agendamento da A com a seção da B na mão (a FK composta e o `s.escola_id` do `update`) e pela medição do alerta (a coluna "Caso" da tabela acima).
12. **Guardiões:** `tenancy-guardian` (o `escola_id` em toda consulta, o contexto da escola do job, a lista de escolas como a única consulta sem escopo), `conformidade-reviewer` (a execução não tem pessoa nem ano e não decide nada sobre aluno; a classificação não vira nota), `infra-guardian` (o horário letivo, o pool, o limite da noite, o alerta com runbook, a carga com o adaptador falso); `test-engineer` e `revisor-geral` entram pela Mesa.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O agendamento mora no `core` (`AgendamentoDaClassificacaoRepository`, em `agendamento-da-classificacao.repository.ts`), e os processadores, em `apps/worker`; o `apps/api/src/material` só tem o teste (`agendamento.int.test.ts`) | A tabela de arquivos previstos pôs `agendar-classificacao.ts` e `secoes.repository.ts` na API e `app.module.ts` no worker. Mas a extração (`apps/worker`, fila `pdf`) e o job da escola (`worker-lote`) usam o mesmo agendamento, e a guarda `app-nao-importa-app` proíbe o worker de importar a API. O worker não tem `app.module.ts` (a fiação é `composition.ts`), e a guarda `repositories-com-escopo` só aceita classe `*Repository` em `*.repository.ts` | `techspec.md` §2 e §5 ("Agendar"); `cenarios.md` ("Seções e agendamento") |
| O job de agendamento da escola e a rotina das 19h rodam no `worker-lote` (banco e outbox, sem modelo); só a execução usa o pool `lote` do `worker-ia` | A Tech Spec dizia "pool `lote` no `worker-ia`, 1 por réplica" para a fila inteira. O agendamento não chama modelo, e pôr 15 lotes de 500 seções no pool de 1 por réplica seguraria as execuções atrás dele | `techspec.md` §7c ("Fila") |
| O limite da noite é de 1.000 execuções por escola (`EXECUCOES_POR_NOITE_DA_ESCOLA`), e o `agendar` recebe o que ainda cabe (`maximoDeExecucoes`) | A spec dizia "o limite de execuções por noite e por escola" sem o valor. Mil execuções são 12 mil seções, quase o dobro das 7.500 de 300 apostilas, e custam ~R$ 32 por noite no pior caso. O teste do limite achou um erro real: o laço parava só entre lotes, e um lote de 500 seções passava do limite em até 42 execuções; o `agendar` agora para ao criar a última que cabe | `techspec.md` §5 ("Agendar" (a)); `cenarios.md` ("Limite da noite"); `agendamento.int.test.ts` › "o limite de execuções da noite" |
| A rotina das 19h é um tipo próprio, `sistema.agendar-classificacao`, que grava um `material.agendar-classificacao` por escola, com a data local da escola por chave | A spec nomeava só o job da escola. Rotina que enfileira por escola é a do expurgo (`retencao.expurgar-escola`): a chave "a data local da noite" no fuso de cada escola faz duas rotinas ao mesmo tempo, ou duas réplicas, darem um job por escola | `techspec.md` §5 ("Agendar" (a)); `uso.int.test.ts` › as rotinas são agendadas…; `classificacao-agendada.int.test.ts` › "[P] duas rotinas ao mesmo tempo…" |
| O alerta lê a métrica `classificacao.execucoes_atrasadas{escola_id}`, medida de 5 em 5 minutos pelo `worker-lote`, na janela da escola (`ultimaNoite`) | A spec dizia a condição do alerta, não de onde ela sai. O Grafana não lê o banco: a medição por escola é a `EscolaGauge` (a mesma do expurgo, do incidente, do arquivo e da eliminação), e a janela é a da escola, que não é a padrão para quem a mudou | `techspec.md` §7c ("Alerta"); `cenarios.md` ("Alerta e métrica"); `infra/grafana/alertas/classificacao-atrasada.yaml`; `docs/runbook.md` ("Classificação do material atrasada") |
| O log do job da escola chama-se `classificacao.agendada` e leva `estado` (`fim`, `suspensa`, `limite`, `sinal`), `lotesTotal`, `execucoesTotal` e `secoesTotal` | A guarda `log-sem-dado-pessoal` recusa um valor sob chave operacional (o motivo da parada) numa variável com nome de dado; o nome `estado` é operacional. O runbook usa o `estado` para dizer por que a noite parou | `docs/runbook.md` ("Classificação do material atrasada", causas 4 e 6); `cenarios.md` ("Log da rotina e do job da escola") |
| A carga usa o recorte maior da classificação (~31 mil tokens por execução, 30.400 de entrada e 600 de saída), o Tutor da B a 30 turnos por minuto (e não 90), e o provedor fora é o `worker-ia` parado por 10 minutos | A spec manda a 5.0 dimensionar pela conta de 31 mil (§7c, "Vazão"), e o falso dá os mesmos tokens a todo turno: 90 turnos do Tutor de 31 mil são 2,8 milhões de tokens por minuto, mais que o balde interativo de 2,375 milhões, e a base do Tutor da B ficou em 12,9 s no ensaio, com 429 por causa da consulta da execução de cada aluno. O adiamento por provedor fora (`IA_INDISPONIVEL`) já está provado na 4.0 com o adaptador que recusa; aqui o que se prova é a retomada de 600 jobs depois de o `worker-ia` voltar | `techspec.md` §7c ("Vazão" e "Carga"); `cenarios.md` ("Carga") |
| O agendamento cria 630 execuções para as 300 apostilas, e não 625 | Cada lote de 500 seções é uma transação que agenda tudo o que leu, e 500 ÷ 12 deixa uma execução de 8 por lote: 15 lotes × 42. Agrupar o resto com o lote seguinte exigiria deixar seção sem execução entre duas transações (a corrida P9 e a regra de "nenhuma seção sem execução no meio de um lote"); o custo são cinco execuções a mais por noite. O veredito da carga esperava 625 e foi corrigido para 630 depois da corrida, com a conta escrita; a medida de vazão não depende do número | `techspec.md` §7c ("Vazão"); `cenarios.md` ("Carga") |
| A tarefa ganha a migration `0064_indice_da_classificacao_atrasada.sql` (índice parcial `execucao_agente_classificacao_idx`) | O plano de tarefa não tinha migration. A medição do alerta (`ClassificacaoAtrasadaRepository`) roda a cada 5 minutos por escola, o dia inteiro, sobre `execucao_agente`, que ganha uma linha por turno do Tutor e só é anonimizada. O único índice parcial de estado só cobre `pendente` e `rodando`, e o ramo `falhou` lia a tabela da escola inteira (a infra-guardian, 1ª rodada, exigiu o índice e o `EXPLAIN`). Sem `concurrently`, como a 0034 e a 0057: o `migrar` roda tudo numa transação | `techspec.md` §7c ("Alerta"); `cenarios.md` ("Alerta e métrica"); `docs/infra.md` |
| O `EXPLAIN` da cobertura e do join da busca é o da forma que a Tech Spec dá (a leitura por `secao_do_material` e `habilidade_da_secao`), com o volume do cenário, e não o da consulta final | A cobertura (`GET /v1/materiais/cobertura`, 13.0) e a busca com as habilidades (10.0) ainda não existem; o plano que a 5.0 consegue medir é o dos dois índices que as migrations já criaram. Refazer com a consulta de verdade é de quem a escreve (`TODO.md`) | `cenarios.md` ("Carga"); `TODO.md` (a entrada da 5.0) |

## Mutações

`--faltando: 14 linhas (55 blocos, 31 motivos)`. As 55 mutações abaixo foram escritas a partir do código desta árvore, e a ferramenta do portão as corre; o que sobra da lista, abaixo dos blocos, é o que nenhum teste distingue ou o que só o `tsc` do portão prova.

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/agendamento.int.test.ts › a função suspensa na escola
-      .where(and(eq(suspensaoDeFuncao.escolaId, requireEscolaId()), eq(suspensaoDeFuncao.funcao, FUNCAO_DA_CLASSIFICACAO), isNull(suspensaoDeFuncao.retomadaEm)))
+      .where(and(eq(suspensaoDeFuncao.funcao, FUNCAO_DA_CLASSIFICACAO), isNull(suspensaoDeFuncao.retomadaEm)))
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/agendamento.int.test.ts › a função suspensa na escola
-      .where(and(eq(suspensaoDeFuncao.escolaId, requireEscolaId()), eq(suspensaoDeFuncao.funcao, FUNCAO_DA_CLASSIFICACAO), isNull(suspensaoDeFuncao.retomadaEm)))
+      .where(and(eq(suspensaoDeFuncao.escolaId, requireEscolaId()), eq(suspensaoDeFuncao.funcao, FUNCAO_DA_CLASSIFICACAO)))
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/agendamento.int.test.ts › a suspensão de outra função da escola não suspende a classificação
-      .where(and(eq(suspensaoDeFuncao.escolaId, requireEscolaId()), eq(suspensaoDeFuncao.funcao, FUNCAO_DA_CLASSIFICACAO), isNull(suspensaoDeFuncao.retomadaEm)))
+      .where(and(eq(suspensaoDeFuncao.escolaId, requireEscolaId()), isNull(suspensaoDeFuncao.retomadaEm)))
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/agendamento.int.test.ts › as seções da B não aparecem nas próximas da A
         and(
-          eq(secaoDoMaterial.escolaId, escolaId),
           isNull(secaoDoMaterial.corrigidaEm),
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/agendamento.int.test.ts › a seção corrigida pela coordenação não é lida
           eq(secaoDoMaterial.escolaId, escolaId),
-          isNull(secaoDoMaterial.corrigidaEm),
           eq(material.estado, 'pronto'),
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/agendamento.int.test.ts › o material não está `pronto`
           isNull(secaoDoMaterial.corrigidaEm),
-          eq(material.estado, 'pronto'),
           isNull(material.excluidoEm),
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/agendamento.int.test.ts › o material foi excluído
           eq(material.estado, 'pronto'),
-          isNull(material.excluidoEm),
           sql`${disciplina.componenteBncc} is not null`,
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/agendamento.int.test.ts › a seção de disciplina sem componente não ocupa vaga do lote
           isNull(material.excluidoEm),
-          sql`${disciplina.componenteBncc} is not null`,
           exists(
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/agendamento.int.test.ts › a seção de material sem série declarada não ocupa vaga do lote
           sql`${disciplina.componenteBncc} is not null`,
-          exists(
-            this.tx
-              .select({ um: sql`1` })
-              .from(materialSerie)
-              .where(and(eq(materialSerie.escolaId, secaoDoMaterial.escolaId), eq(materialSerie.materialId, secaoDoMaterial.materialId))),
-          ),
           or(isNull(secaoDoMaterial.execucaoId), and(eq(execucaoAgente.estado, 'falhou'), lt(secaoDoMaterial.falhasSeguidas, TETO_DE_FALHAS_SEGUIDAS))),
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/agendamento.int.test.ts › a seção de material sem série declarada não ocupa vaga do lote
               .from(materialSerie)
-              .where(and(eq(materialSerie.escolaId, secaoDoMaterial.escolaId), eq(materialSerie.materialId, secaoDoMaterial.materialId))),
+              .where(and(eq(materialSerie.escolaId, secaoDoMaterial.escolaId))),
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/agendamento.int.test.ts › nao_agendada e nao_classificada com menos de 3 falhas ganham execução
-          or(isNull(secaoDoMaterial.execucaoId), and(eq(execucaoAgente.estado, 'falhou'), lt(secaoDoMaterial.falhasSeguidas, TETO_DE_FALHAS_SEGUIDAS))),
+          or(and(eq(execucaoAgente.estado, 'falhou'), lt(secaoDoMaterial.falhasSeguidas, TETO_DE_FALHAS_SEGUIDAS))),
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/agendamento.int.test.ts › nao_agendada e nao_classificada com menos de 3 falhas ganham execução
-          or(isNull(secaoDoMaterial.execucaoId), and(eq(execucaoAgente.estado, 'falhou'), lt(secaoDoMaterial.falhasSeguidas, TETO_DE_FALHAS_SEGUIDAS))),
+          or(isNull(secaoDoMaterial.execucaoId)),
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/agendamento.int.test.ts › só é lida a seção sem execução ou a que falhou abaixo do teto
-          or(isNull(secaoDoMaterial.execucaoId), and(eq(execucaoAgente.estado, 'falhou'), lt(secaoDoMaterial.falhasSeguidas, TETO_DE_FALHAS_SEGUIDAS))),
+          or(isNull(secaoDoMaterial.execucaoId), and(lt(secaoDoMaterial.falhasSeguidas, TETO_DE_FALHAS_SEGUIDAS))),
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/agendamento.int.test.ts › a seção com 3 falhas seguidas não chama o modelo na quarta noite
-          or(isNull(secaoDoMaterial.execucaoId), and(eq(execucaoAgente.estado, 'falhou'), lt(secaoDoMaterial.falhasSeguidas, TETO_DE_FALHAS_SEGUIDAS))),
+          or(isNull(secaoDoMaterial.execucaoId), and(eq(execucaoAgente.estado, 'falhou'))),
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/agendamento.int.test.ts › só é lida a seção sem execução ou a que falhou abaixo do teto
-          or(isNull(secaoDoMaterial.execucaoId), and(eq(execucaoAgente.estado, 'falhou'), lt(secaoDoMaterial.falhasSeguidas, TETO_DE_FALHAS_SEGUIDAS))),
+          or(isNull(secaoDoMaterial.execucaoId), and(inArray(execucaoAgente.estado, ['falhou', 'concluida']), lt(secaoDoMaterial.falhasSeguidas, TETO_DE_FALHAS_SEGUIDAS))),
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › a extração agenda só as seções do material que extraiu
-          filtro.materialId === undefined ? undefined : eq(secaoDoMaterial.materialId, filtro.materialId),
+          undefined,
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/agendamento.int.test.ts › depois do cursor
-          filtro.depoisDe === undefined ? undefined : gt(secaoDoMaterial.id, filtro.depoisDe),
+          undefined,
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/agendamento.int.test.ts › o limite de execuções da noite
-      for (let inicio = 0; inicio < grupo.length && execucoes < maximoDeExecucoes; inicio += SECOES_POR_EXECUCAO) {
+      for (let inicio = 0; inicio < grupo.length; inicio += SECOES_POR_EXECUCAO) {
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/agendamento.int.test.ts › a rotina duas vezes: o primeiro parado depois de ler
-        if (trocadas === 0) continue
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/agendamento.int.test.ts › o material que perdeu a série entre a leitura e o agendamento
-      if (series === undefined) continue
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/agendamento.int.test.ts › a execução de 12 seções falhou por causa de uma
-      const chave = alvo.falhasSeguidas > 0 ? `falha|${alvo.secaoId}` : `${alvo.componente}|${series}`
+      const chave = `${alvo.componente}|${series}`
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/agendamento.int.test.ts › a rotina duas vezes: o primeiro parado depois de ler
-         and s.execucao_id is not distinct from lida.execucao_id
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/agendamento.int.test.ts › a seção que a coordenação corrigiu entre a leitura e o agendamento
          and s.execucao_id is not distinct from lida.execucao_id
-         and s.corrigida_em is null`)
+         `)
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/agendamento.int.test.ts › materiais do mesmo componente e das mesmas séries vão juntos
        where s.escola_id = ${escolaId}
-         and s.id = lida.id
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/agendamento.int.test.ts › a rotina duas vezes: o primeiro parado depois de ler
-    if (total === 0) {
+    if (total < 0) {
```

```mutacao
arquivo: apps/worker/src/processors/agendar-classificacao.ts
teste: apps/worker/test/classificacao-agendada.int.test.ts › permissão: a rotina só roda como rotina do sistema
-    if (contexto?.rotinaDoSistema !== true) throw new JobFailureError(JobFailureCode.DADOS_INVALIDOS, true)
```

```mutacao
arquivo: apps/worker/src/processors/agendar-classificacao.ts
teste: apps/worker/test/classificacao-agendada.int.test.ts › grava um `material.agendar-classificacao` por escola
-        if (resultado.situacao === 'enfileirado') enfileiradosTotal += 1
+        if (resultado.situacao !== 'enfileirado') enfileiradosTotal += 1
```

```mutacao
arquivo: apps/worker/src/processors/agendar-classificacao.ts
teste: apps/worker/test/classificacao-agendada.int.test.ts › uma escola que falha não segura as outras
-    if (falhasTotal > 0) throw new InvariantException('classificação não enfileirada em alguma escola')
```

```mutacao
arquivo: apps/worker/src/processors/agendar-classificacao.ts
teste: apps/api/src/material/agendamento.int.test.ts › o sinal abortado entre os lotes
-      if (sinal.aborted) {
+      if (sinal.aborted && false) {
```

```mutacao
arquivo: apps/worker/src/processors/agendar-classificacao.ts
teste: apps/api/src/material/agendamento.int.test.ts › o limite de execuções da noite
-      if (execucoesTotal >= limiteDeExecucoes) {
+      if (execucoesTotal > limiteDeExecucoes) {
```

```mutacao
arquivo: apps/worker/src/processors/agendar-classificacao.ts
teste: apps/api/src/material/agendamento.int.test.ts › a função suspensa na escola
-        if (!(await repositorio.funcaoEstaAtiva())) return 'suspensa' as const
```

```mutacao
arquivo: apps/worker/src/processors/agendar-classificacao.ts
teste: apps/api/src/material/agendamento.int.test.ts › mais seções que o lote
-        if (ultima === undefined) return 'fim' as const
```

```mutacao
arquivo: apps/worker/src/processors/agendar-classificacao.ts
teste: apps/api/src/material/agendamento.int.test.ts › a função suspensa na escola
-      if (feito === 'suspensa' || feito === 'fim') {
+      if (feito === 'fim') {
```

```mutacao
arquivo: apps/worker/src/processors/agendar-classificacao.ts
teste: apps/api/src/material/agendamento.int.test.ts › mais seções que o lote
-      if (feito === 'suspensa' || feito === 'fim') {
+      if (feito === 'suspensa') {
```

```mutacao
arquivo: apps/worker/src/classificacao-gauge.ts
teste: apps/worker/test/classificacao-agendada.int.test.ts › a escola sem execução atrasada fica sem série
-    return atrasadas === 0 ? undefined : atrasadas
+    return atrasadas
```

```mutacao
arquivo: packages/core/src/material/classificacao-atrasada.repository.ts
teste: apps/worker/test/classificacao-agendada.int.test.ts › a escola sem execução atrasada fica sem série
-          eq(execucaoAgente.escolaId, requireEscolaId()),
```

```mutacao
arquivo: packages/core/src/material/classificacao-atrasada.repository.ts
teste: apps/worker/test/classificacao-agendada.int.test.ts › só a classificação conta
-          eq(execucaoAgente.funcao, FUNCAO_DA_TAREFA_DE_IA.classificar_secoes),
```

```mutacao
arquivo: packages/core/src/material/classificacao-atrasada.repository.ts
teste: apps/worker/test/classificacao-agendada.int.test.ts › conta a `falhou` na noite e a `pendente` de antes dela
-            and(eq(execucaoAgente.estado, 'falhou'), gte(execucaoAgente.concluidaEm, fechouEm), lt(execucaoAgente.concluidaEm, abriuEm)),
+            and(gte(execucaoAgente.concluidaEm, fechouEm), lt(execucaoAgente.concluidaEm, abriuEm)),
```

```mutacao
arquivo: packages/core/src/material/classificacao-atrasada.repository.ts
teste: apps/worker/test/classificacao-agendada.int.test.ts › conta a `falhou` na noite e a `pendente` de antes dela
-            and(eq(execucaoAgente.estado, 'falhou'), gte(execucaoAgente.concluidaEm, fechouEm), lt(execucaoAgente.concluidaEm, abriuEm)),
+            and(eq(execucaoAgente.estado, 'falhou'), lt(execucaoAgente.concluidaEm, abriuEm)),
```

```mutacao
arquivo: packages/core/src/material/classificacao-atrasada.repository.ts
teste: apps/worker/test/classificacao-agendada.int.test.ts › conta a `falhou` na noite e a `pendente` de antes dela
-            and(eq(execucaoAgente.estado, 'falhou'), gte(execucaoAgente.concluidaEm, fechouEm), lt(execucaoAgente.concluidaEm, abriuEm)),
+            and(eq(execucaoAgente.estado, 'falhou'), gte(execucaoAgente.concluidaEm, fechouEm)),
```

```mutacao
arquivo: packages/core/src/material/classificacao-atrasada.repository.ts
teste: apps/worker/test/classificacao-agendada.int.test.ts › conta a `falhou` na noite e a `pendente` de antes dela
-            and(eq(execucaoAgente.estado, 'pendente'), lt(execucaoAgente.criadaEm, fechouEm)),
+            and(lt(execucaoAgente.criadaEm, fechouEm)),
```

```mutacao
arquivo: packages/core/src/material/classificacao-atrasada.repository.ts
teste: apps/worker/test/classificacao-agendada.int.test.ts › conta a `falhou` na noite e a `pendente` de antes dela
-            and(eq(execucaoAgente.estado, 'pendente'), lt(execucaoAgente.criadaEm, fechouEm)),
+            and(eq(execucaoAgente.estado, 'pendente')),
```

```mutacao
arquivo: packages/core/src/queue/janela-letiva.ts
teste: packages/core/src/queue/janela-letiva.test.ts › sem dia letivo ou com horário invertido, não há noite
-  if (inicio === undefined || fim === undefined || inicio >= fim) return undefined
+  if (inicio === undefined || fim === undefined) return undefined
```

```mutacao
arquivo: packages/core/src/queue/janela-letiva.ts
teste: packages/core/src/queue/janela-letiva.test.ts › o domingo é o dia 7
-    const diaDaSemana = new Date(meiaNoite).getUTCDay() === 0 ? 7 : new Date(meiaNoite).getUTCDay()
+    const diaDaSemana = new Date(meiaNoite).getUTCDay() === 0 ? 0 : new Date(meiaNoite).getUTCDay()
```

```mutacao
arquivo: packages/core/src/queue/janela-letiva.ts
teste: packages/core/src/queue/janela-letiva.test.ts › sábado às 10h
-    if (!janela.diasLetivos.includes(diaDaSemana)) continue
```

```mutacao
arquivo: packages/core/src/queue/janela-letiva.ts
teste: packages/core/src/queue/janela-letiva.test.ts › terça às 10h
-    if (abriuEm === undefined) {
+    if (false) {
```

```mutacao
arquivo: packages/core/src/queue/janela-letiva.ts
teste: packages/core/src/queue/janela-letiva.test.ts › terça às 3h, antes de a escola abrir
-      if (abertura <= agora.getTime()) abriuEm = abertura
+      abriuEm = abertura
```

```mutacao
arquivo: packages/shared/src/system/job-definitions.ts
teste: packages/shared/src/system/job-definitions.test.ts › cada tipo declara a fila, o não urgente, o escopo e o executor de hoje
   [TIPO_AGENDAR_CLASSIFICACAO_DAS_ESCOLAS]: defineJob({
     filas: ['lote'],
     escopo: 'sistema',
     executor: 'worker',
     dados: semDados,
     retentativa: RETENTATIVA_DE_HOJE,
     prazoMs: 600_000,
-    naoUrgente: true,
+  naoUrgente: false,
```

```mutacao
arquivo: packages/shared/src/system/job-definitions.ts
teste: packages/shared/src/system/job-definitions.test.ts › cada tipo declara a fila, o não urgente, o escopo e o executor de hoje
   [TIPO_AGENDAR_CLASSIFICACAO]: defineJob({
     filas: ['lote'],
     escopo: 'escola',
     executor: 'worker',
     dados: semDados,
     retentativa: RETENTATIVA_DE_HOJE,
     prazoMs: 1_800_000,
-    naoUrgente: true,
+  naoUrgente: false,
```

```mutacao
arquivo: packages/shared/src/system/job-definitions.ts
teste: apps/api/src/material/agendamento.int.test.ts › nao_agendada e nao_classificada com menos de 3 falhas ganham execução
   [TIPO_EXECUTAR_LOTE]: defineJob({
     filas: ['lote'],
     escopo: 'escola',
     executor: 'api',
     dados: execucaoDeIaSchema,
     retentativa: RETENTATIVA_DA_IA,
     prazoMs: 150_000,
-    naoUrgente: true,
+  naoUrgente: false,
```

```mutacao
arquivo: apps/worker/src/processors/extrair-pdf.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › a função suspensa na escola
-  if (!(await agendamento.funcaoEstaAtiva())) return 0
```

```mutacao
arquivo: apps/worker/src/processors/extrair-pdf.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › a seção que herdou a correção da anterior
-  const secoesHerdadasTotal = substituiId === null ? 0 : await fecharAEdicao(tx, materialId, substituiId)
+  const secoesHerdadasTotal = substituiId !== null ? 0 : await fecharAEdicao(tx, materialId, substituiId)
```

```mutacao
arquivo: apps/worker/src/processors/agendar-classificacao.ts
teste: apps/api/src/material/agendamento.int.test.ts › a função suspensa entre o primeiro e o segundo lote
-        if (!(await repositorio.funcaoEstaAtiva())) return 'suspensa' as const
+        if (cursor === undefined && !(await repositorio.funcaoEstaAtiva())) return 'suspensa' as const
```

```mutacao
arquivo: apps/worker/src/processors/agendar-classificacao.ts
teste: apps/api/src/material/agendamento.int.test.ts › cada lote corre com o `statement_timeout` de 20 s
-        await tx.execute(sql`select set_config('statement_timeout', ${String(PRAZO_DO_LOTE_MS)}, true)`)
```

```mutacao
arquivo: apps/worker/src/processors/agendar-classificacao.ts
teste: apps/api/src/material/agendamento.int.test.ts › um lote por transação: quando o segundo lote enfileira
-    for (;;) {
+    await banco.transaction(async (tx0) => { for (;;) {
       if (sinal.aborted) {
         estado = 'sinal'
         break
       }
       if (execucoesTotal >= limiteDeExecucoes) {
         estado = 'limite'
         break
       }
       // O lote nunca passa do que ainda cabe no limite da noite: cada execução leva até 12 seções.
       const tamanho = Math.min(lote, (limiteDeExecucoes - execucoesTotal) * SECOES_POR_EXECUCAO)
-      const feito = await banco.transaction(async (tx) => {
+    const feito = await (async (tx) => {
         await tx.execute(sql`select set_config('statement_timeout', ${String(PRAZO_DO_LOTE_MS)}, true)`)
         const repositorio = new AgendamentoDaClassificacaoRepository(tx)
         if (!(await repositorio.funcaoEstaAtiva())) return 'suspensa' as const
         const proximas = await repositorio.proximasSecoes(tamanho, cursor === undefined ? {} : { depoisDe: cursor })
         const ultima = proximas.at(-1)
         if (ultima === undefined) return 'fim' as const
         return { ultima: ultima.secaoId, agendado: await repositorio.agendar(proximas, enfileirador, limiteDeExecucoes - execucoesTotal) }
-      })
+    })(tx0)
       if (feito === 'suspensa' || feito === 'fim') {
         estado = feito
         break
       }
       cursor = feito.ultima
       lotesTotal += 1
       execucoesTotal += feito.agendado.execucoes
       secoesTotal += feito.agendado.secoes
-    }
+    } })
```

### O que ficou sem bloco, e por quê

- `apps/worker/src/classificacao-gauge.ts:40`, `if (noite === undefined) return undefined`: é o estreitamento de tipo de `ultimaNoite` (que devolve `undefined` para a janela sem dia letivo), que o `tsc` do portão exige antes de ler `noite.fechouEm`; a janela sem noite está provada em `janela-letiva.test.ts` › "sem dia letivo ou com horário invertido, não há noite".
- `apps/worker/src/composition.ts:402`, `? []`: o ramo "sem medidor, nenhuma medição" é a lista vazia que o tipo `Meter | undefined` pede; o ramo com medidor tem o caso `classificacao-agendada.int.test.ts` › "montada no worker de lote", e o sem medidor é o das outras quatro medições, que o `createWorker` já tinha.
- `apps/worker/src/processors/agendar-classificacao.ts:109`, `const proximas = await repositorio.proximasSecoes(tamanho, cursor === undefined ? {} : { depoisDe: cursor })`: o cursor é a defesa contra reler a seção que nenhum lote consegue agendar; com o `depoisDe` provado no repository (`agendamento.int.test.ts` › "depois do cursor"), o ternário só decide se o primeiro lote o leva, e o laço termina do mesmo jeito sem ele nos cenários alcançáveis (a seção que perde a corrida volta a ter execução, e a de material sem série nem sai da leitura).
- `packages/core/src/material/agendamento-da-classificacao.repository.ts:89`, `eq(material.escolaId, secaoDoMaterial.escolaId)`: é a chave composta da junção, que as FKs compostas do modelo já garantem (a seção só aponta para material, disciplina, execução e série da própria escola); a junção sem um dos dois termos devolve a mesma linha. O isolamento tem o `where` de `escolaId` da consulta, com bloco e caso próprio.
- `packages/core/src/material/agendamento-da-classificacao.repository.ts:89`, `eq(material.id, secaoDoMaterial.materialId)`: é a chave composta da junção, que as FKs compostas do modelo já garantem (a seção só aponta para material, disciplina, execução e série da própria escola); a junção sem um dos dois termos devolve a mesma linha. O isolamento tem o `where` de `escolaId` da consulta, com bloco e caso próprio.
- `packages/core/src/material/agendamento-da-classificacao.repository.ts:90`, `eq(disciplina.escolaId, material.escolaId)`: é a chave composta da junção, que as FKs compostas do modelo já garantem (a seção só aponta para material, disciplina, execução e série da própria escola); a junção sem um dos dois termos devolve a mesma linha. O isolamento tem o `where` de `escolaId` da consulta, com bloco e caso próprio.
- `packages/core/src/material/agendamento-da-classificacao.repository.ts:90`, `eq(disciplina.id, material.disciplinaId)`: é a chave composta da junção, que as FKs compostas do modelo já garantem (a seção só aponta para material, disciplina, execução e série da própria escola); a junção sem um dos dois termos devolve a mesma linha. O isolamento tem o `where` de `escolaId` da consulta, com bloco e caso próprio.
- `packages/core/src/material/agendamento-da-classificacao.repository.ts:91`, `eq(execucaoAgente.escolaId, secaoDoMaterial.escolaId)`: é a chave composta da junção, que as FKs compostas do modelo já garantem (a seção só aponta para material, disciplina, execução e série da própria escola); a junção sem um dos dois termos devolve a mesma linha. O isolamento tem o `where` de `escolaId` da consulta, com bloco e caso próprio.
- `packages/core/src/material/agendamento-da-classificacao.repository.ts:91`, `eq(execucaoAgente.id, secaoDoMaterial.execucaoId)`: é a chave composta da junção, que as FKs compostas do modelo já garantem (a seção só aponta para material, disciplina, execução e série da própria escola); a junção sem um dos dois termos devolve a mesma linha. O isolamento tem o `where` de `escolaId` da consulta, com bloco e caso próprio.
- `packages/core/src/material/agendamento-da-classificacao.repository.ts:92`, `.where(`: o `where` multilinha de `proximasSecoes`, cujos termos têm um bloco cada (escola, correção, estado, exclusão, componente, série, as quatro partes do `or`, o material e o cursor); a linha sozinha não tem condição.
- `packages/core/src/material/agendamento-da-classificacao.repository.ts:103`, `eq(materialSerie.escolaId, secaoDoMaterial.escolaId)`: é a chave composta da junção, que as FKs compostas do modelo já garantem (a seção só aponta para material, disciplina, execução e série da própria escola); a junção sem um dos dois termos devolve a mesma linha. O isolamento tem o `where` de `escolaId` da consulta, com bloco e caso próprio.
- `packages/core/src/material/agendamento-da-classificacao.repository.ts:112`, `return linhas.flatMap((linha) => (linha.componente === null ? [] : [{ ...linha, componente: linha.componente }]))`: é o estreitamento de tipo do componente (`ComponenteBncc | null` para `ComponenteBncc`); o `is not null` do SQL, que tem bloco, já deixa só as seções com componente.
- `packages/core/src/material/agendamento-da-classificacao.repository.ts:123`, `if (secoes.length === 0) return { execucoes: 0, secoes: 0 }`: atalho que poupa a consulta das séries; sem ele a lista vazia segue pelo `#agrupar` e devolve o mesmo `{ execucoes: 0, secoes: 0 }` (mutante equivalente no resultado).
- `packages/core/src/material/agendamento-da-classificacao.repository.ts:128`, `let inicio = 0; inicio < grupo.length`: é o limite do laço `for` por seção, que o `SECOES_POR_EXECUCAO` fatia; sem ele o laço não termina. O outro termo da linha (`execucoes < maximoDeExecucoes`) tem bloco.
- `packages/core/src/material/agendamento-da-classificacao.repository.ts:146`, `grupos.set(chave, [...(grupos.get(chave) ?? []), secao])`: é o primeiro elemento de cada grupo (o `Map` ainda não tem a chave); sem o `?? []` o espalhamento de `undefined` não compila.
- `packages/core/src/material/agendamento-da-classificacao.repository.ts:156`, `eq(serie.escolaId, materialSerie.escolaId)`: é a chave composta da junção, que as FKs compostas do modelo já garantem (a seção só aponta para material, disciplina, execução e série da própria escola); a junção sem um dos dois termos devolve a mesma linha. O isolamento tem o `where` de `escolaId` da consulta, com bloco e caso próprio.
- `packages/core/src/material/agendamento-da-classificacao.repository.ts:156`, `eq(serie.id, materialSerie.serieId)`: é a chave composta da junção, que as FKs compostas do modelo já garantem (a seção só aponta para material, disciplina, execução e série da própria escola); a junção sem um dos dois termos devolve a mesma linha. O isolamento tem o `where` de `escolaId` da consulta, com bloco e caso próprio.
- `packages/core/src/material/agendamento-da-classificacao.repository.ts:157`, `eq(materialSerie.escolaId, requireEscolaId())`: a leitura das séries dos materiais já lidos: o `materialId` é um uuid único no banco e a PK de `material_serie` leva a escola, então tirar o termo de escola ou o `inArray` devolve as mesmas séries para os materiais que o `#agrupar` consulta (mutante equivalente no resultado); o escopo da regra 10 está no texto e na guarda `repositories-com-escopo`.
- `packages/core/src/material/agendamento-da-classificacao.repository.ts:157`, `inArray(materialSerie.materialId, [...materialIds])`: a leitura das séries dos materiais já lidos: o `materialId` é um uuid único no banco e a PK de `material_serie` leva a escola, então tirar o termo de escola ou o `inArray` devolve as mesmas séries para os materiais que o `#agrupar` consulta (mutante equivalente no resultado); o escopo da regra 10 está no texto e na guarda `repositories-com-escopo`.
- `packages/core/src/material/agendamento-da-classificacao.repository.ts:159`, `for (const linha of linhas) porMaterial.set(linha.materialId, [...(porMaterial.get(linha.materialId) ?? []), `${linha.etapa}${String(linha.ano)}`])`: é o primeiro elemento de cada grupo (o `Map` ainda não tem a chave); sem o `?? []` o espalhamento de `undefined` não compila.
- `packages/core/src/material/agendamento-da-classificacao.repository.ts:178`, `if (execucao === undefined) return 0`: é o estreitamento de tipo do `returning()` desestruturado; o `insert` sempre devolve a linha que gravou.
- `packages/core/src/material/agendamento-da-classificacao.repository.ts:184`, `update secao_do_material s set execucao_id = ${execucao.id}`: são o `update` e o `from (values …)` do SQL, a sintaxe do comando: sem elas o SQL não roda. As condições do `where` do `update` têm bloco (`is not distinct from`, `corrigida_em`), menos a da escola: a seção da B não chega ao `update` da A (a leitura das séries leva a escola do contexto e a descarta, caso `isolamento` de `agendamento.int.test.ts`), e a FK composta recusaria a execução da A numa seção da B, de modo que tirar o termo não muda o resultado (mutante equivalente).
- `packages/core/src/material/agendamento-da-classificacao.repository.ts:185`, `from (values ${valores}) as lida(id, execucao_id)`: são o `update` e o `from (values …)` do SQL, a sintaxe do comando: sem elas o SQL não roda. As condições do `where` do `update` têm bloco (`is not distinct from`, `corrigida_em`), menos a da escola: a seção da B não chega ao `update` da A (a leitura das séries leva a escola do contexto e a descarta, caso `isolamento` de `agendamento.int.test.ts`), e a FK composta recusaria a execução da A numa seção da B, de modo que tirar o termo não muda o resultado (mutante equivalente).
- `packages/core/src/material/agendamento-da-classificacao.repository.ts:190`, `const total = trocadas.rowCount ?? 0`: `rowCount` é `number | null` no retorno do `execute`; o `?? 0` é o estreitamento de tipo, e o zero é o caso da corrida perdida (bloco no `if (total === 0)`).
- `packages/core/src/material/agendamento-da-classificacao.repository.ts:193`, `eq(execucaoAgente.escolaId, escolaId)`: a limpeza da execução que perdeu a corrida: o id acaba de ser gerado e é único, então o `delete` sem o termo de escola ou de id apaga a mesma linha; o escopo da regra 10 está no texto e na guarda `repositories-com-escopo`, e o efeito (a execução some, sem job) tem bloco no `if (total === 0)`.
- `packages/core/src/material/agendamento-da-classificacao.repository.ts:193`, `eq(execucaoAgente.id, execucao.id)`: a limpeza da execução que perdeu a corrida: o id acaba de ser gerado e é único, então o `delete` sem o termo de escola ou de id apaga a mesma linha; o escopo da regra 10 está no texto e na guarda `repositories-com-escopo`, e o efeito (a execução some, sem job) tem bloco no `if (total === 0)`.
- `packages/core/src/material/classificacao-atrasada.repository.ts:19`, `.where(`: o `where` de uma só chamada, cujos termos têm um bloco cada (escola, função, os dois lados do `or`); a linha sozinha não tem condição.
- `packages/core/src/material/classificacao-atrasada.repository.ts:29`, `return linha?.total ?? 0`: `count()` sempre devolve uma linha; o `?? 0` é o estreitamento de tipo do `select` desestruturado.
- `packages/core/src/queue/janela-letiva.ts:81`, `inicio === undefined`: é o estreitamento de tipo do horário que `msDoHorario` devolve (`number | undefined`), exigido pelo `tsc` antes da comparação `inicio >= fim`, que tem bloco; `estaNaJanela` já valida os mesmos dois.
- `packages/core/src/queue/janela-letiva.ts:81`, `fim === undefined`: é o estreitamento de tipo do horário que `msDoHorario` devolve (`number | undefined`), exigido pelo `tsc` antes da comparação `inicio >= fim`, que tem bloco; `estaNaJanela` já valida os mesmos dois.
- `packages/core/drizzle/0064_indice_da_classificacao_atrasada.sql` e o `index('execucao_agente_classificacao_idx')` de `packages/core/src/db/schema/execucao-agente.ts`: SQL de migration e declaração de índice, sem cláusula de produto a mutar (o banco do teste já vem migrado, e mutar o arquivo não muda o que ele tem). A definição é provada por `classificacao-agendada.int.test.ts` › "a consulta da medição tem o índice parcial", e o uso, pelo `EXPLAIN` registrado acima.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª) | O limite da noite (`execucoesTotal`, `agendar-classificacao.ts:91`) recomeça do zero na retentativa, e uma falha no meio do laço pode levar a escola a ~5.000 execuções na noite: contar o que já foi criado desde o fecho da janela, em `execucao_agente`, antes de calcular o `maximoDeExecucoes` | Muda o comportamento do laço e pede teste e bloco próprios, o que não cabe em recomendação barata. `TODO.md`, antes do piloto (o teto de custo da noite) |
| revisor-geral (1ª) | `proximasSecoes` ordena pelo id da seção e `agendar` agrupa por recorte só dentro do lote de 500: cada lote deixa uma execução parcial por recorte; ordenar por material ou recorte antes do id reduz as execuções extras | Muda a ordem da leitura e o número de execuções (contrato dos cenários); é custo, não bug. `TODO.md`, com a carga das 300 apostilas como medida de partida |
| revisor-geral (1ª) | Deixar explícito, na linha "carga" da tabela "Testes que provam a regra", que o "provedor fora" foi trocado por `worker-ia` parado e que o adiamento por `IA_INDISPONIVEL` vem da 4.0 | A tabela é critério de aceite do Arquiteto, e a troca já está registrada em `cenarios.md` ("Carga") e na divergência resolvida do `5_task.md`; a Mesa não edita critério para acomodar resultado |
| conformidade-reviewer (1ª) | Ao fechar a 7.0, conferir se o caminho de suspender a função pelo comando D76 deixa na auditoria da escola quem suspendeu e por quê | Tarefa 7.0 (reclassificar e D76), que escreve esse caminho |
| conformidade-reviewer (1ª) | Um caso no teste de auditoria ou de governança que prove "o que a IA gerou, quem aprovou e quando" para uma seção agendada pela rotina, sem `solicitada_por` | Cobertura extra, em arquivo que a tarefa não toca. `TODO.md`, dono: a tarefa que tocar o teste de auditoria ou de governança |
| test-engineer (1ª) | `classificada` e `sem_habilidade` dividem um caso só (o da execução `concluida`); a tabela pede "um caso cada" | Recusada: o próprio revisor diz que basta, porque a regra lê só o estado da execução |
| test-engineer (1ª) | O veredito da carga passou de 625 para 630 depois da corrida e não foi corrido de novo; os números medidos passam no veredito novo | Só registro: a Validação da spec confere (o Validador lê o `5_task.md` e o `docs/infra.md`) |

Da rodada 2 (`.processo/ordens/5_task-r2.md`):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (2ª) | Citar a 0064 nominalmente na entrada do `TODO.md` sobre índices sem `concurrently` antes do staging, junto da 0057; ao refazer com volume real, considerar o `statement_timeout` de 2 s do migrador | `TODO.md`, na entrada que já existe (antes do staging) |
| infra-guardian (2ª), tenancy-guardian (2ª), test-engineer (1ª e 2ª) | O caso da janela própria do alerta depende do relógio de parede e só distingue as janelas entre 5h e 7h; fixar o relógio | Já documentado no comentário do teste; a prova que não depende da hora é `classificacao-agendada.int.test.ts`. `TODO.md`: fixar o relógio quando alguém tocar esse cenário |
| infra-guardian (2ª), conformidade-reviewer (2ª), test-engineer (2ª), revisor-geral (2ª) | O limite da noite que recomeça do zero na retentativa (até ~5.000 execuções) precisa fechar antes do piloto, com dono definido | Já está no `TODO.md` (a entrada criada na rodada 1, "antes do piloto"); o dono falta: o Orquestrador o define ao fechar a spec, e o Validador cobra |
| conformidade-reviewer (2ª) | O caso "o que a IA gerou, quem aprovou e quando" para a execução da rotina das 19h, sem `solicitada_por` | Já está no `TODO.md`, com dono; segue aberta |
| conformidade-reviewer (2ª) | Na 7.0, conferir que o freio da suspensão da função continua bastando antes do piloto | Tarefa 7.0 (reclassificar e D76) |
| tenancy-guardian (2ª) | Um caso que chame `agendar` na escola A com as seções da B e confira que nenhuma linha da B mudou, mesmo sem a FK composta, para proteger o termo de escola do `update` e do `delete` contra refatoração | Retro da funcionalidade (D86); hoje a FK composta cobre e o docblock avisa |
| revisor-geral (2ª) | A divergência da 0064 no `5_task.md` cita `docs/infra.md`, que não menciona a 0064 nem `execucao_agente_classificacao_idx`: tirar a referência ou registrar o índice no trecho da classificação | `TODO.md` (uma linha, para quem tocar `docs/infra.md` na próxima tarefa); o Orquestrador confere antes do pouso |
| revisor-geral (2ª) | `cenarios.md:183`: falta o ponto entre "tirar cada termo do `where`" e "O índice parcial…" | `TODO.md`, junto da linha acima (erro de pontuação, sem efeito) |
| privacy-guardian (2ª) | Anotar em `docs/lgpd.md`, na linha de `consumo_ia`, que `classificar_secoes` guarda só ids e versão do prompt | Já está no `TODO.md`, com dono na 9.0 (que toca `docs/lgpd.md`) |
| privacy-guardian (2ª) | Uma linha no runbook dizendo que a consulta de "Primeiro olhar" sobre `execucao_agente` vem de chamado e fica registrada (D76) | Tarefa 7.0 (D76), que escreve o caminho do chamado |
| test-engineer (2ª) | O caso do `statement_timeout` cobre um lote só: usar `lote: 1` com 2 seções e guardar o valor das duas chamadas | `TODO.md` (reforço de teste, sem mudar comportamento) |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-18 04:45:19 | 2026-11-18 04:46:13 | `infra-guardian` | 2 | APROVADO | ace88a369beb6d72e |
| 2026-11-18 04:45:49 | 2026-11-18 04:46:18 | `conformidade-reviewer` | 2 | APROVADO | a98940d620085e971 |
| 2026-11-18 04:45:41 | 2026-11-18 04:46:22 | `tenancy-guardian` | 2 | APROVADO | a3c42343c12b73b7d |
| 2026-11-18 04:45:57 | 2026-11-18 04:46:36 | `revisor-geral` | 2 | APROVADO | aef137ebabdf9f85d |
| 2026-11-18 04:46:05 | 2026-11-18 04:46:36 | `privacy-guardian` | 2 | APROVADO | a77a156e9c21f8f41 |
| 2026-11-18 04:45:32 | 2026-11-18 04:46:45 | `test-engineer` | 2 | APROVADO | a259db2b867966243 |
