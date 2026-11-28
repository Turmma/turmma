# Tarefa 6.0 — A rotina encerra a prova vencida no fim efetivo, e não durante uma queda

**Funcionalidade:** avaliacao-e-correcao · **Depende de:** 3.0, 5.0
**Subagentes obrigatórios:** `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian`, `privacy-guardian`
**Porte:** grande

## Objetivo

A prova vencida encerra sozinha, no minuto, dentro do horário letivo, e o lote nasce pendente; com o pulso velho nada
encerra. A carga da manhã de segunda prova isso em escala.

## Contexto necessário

- `techspec.md` §5.5, §5.6, §7b (AIA), §7c (alertas, carga), §13
- `prd.md` RF5, RF6; §7 (função suspensa)
- `cenarios.md` §2 (a rotina, as auditorias), §3 (c), (e), (f), (j), (l), §5 (carga)
- `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts` (`encerrar`, `exigirAtiva`)
- `apps/worker/src/processors/agendar-classificacao.ts`: a rotina `sistema.*` que grava um job por escola
- Da rodada da 5.0 (`5_task.md`, "Recomendações sem aplicar"): confirmar que a corrida estender × rotina (j) cobre também a extensão **da turma** (aluno nulo) no fim efetivo da janela

## Subtarefas

- [x] 6.1 — `sistema.encerrar-provas-vencidas` e `atividade.encerrar-vencidas` (§5.6), os dois com `naoUrgente: false`
- [x] 6.2 — `encerrarPeloLimite`: `for update`, o pulso, o fim efetivo, a suspensão; auditoria sem aluno; sino; os dois
  encerramentos gravam a vencida (§5.5)
- [x] 6.3 — Alertas (prova aberta 5 min além do fim **efetivo**; p95 do PUT) e runbook
- [x] 6.4 — `docs/aia/correcao-de-objetiva.md`, etapa 1: 1.4/1 (o gatilho) e 1.4/9 (a contagem só no lote)
- [x] 6.5 — `infra/k6/prova-online.js` e a corrida registrada
- [x] 6.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/shared/src/system/job-definitions.ts` | alterado |
| `apps/worker/src/job-schedules.ts` | alterado |
| `apps/worker/src/processors/encerrar-provas-vencidas.ts` | novo |
| `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts` | alterado |
| `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts` | alterado |
| `apps/worker/test/encerrar-provas.int.test.ts` | novo |
| `packages/core/drizzle/0069_auditoria_da_rotina_da_prova.sql`, `meta/0069_snapshot.json`, `meta/_journal.json` | novo, novo, alterado (triagem da 6.0; Tech Spec §3) |
| `packages/core/src/db/schema/auditoria.ts` | alterado: o check `auditoria_rotina_so_nas_acoes` |
| `packages/core/src/auditoria/auditoria.int.test.ts` | alterado: `aceita atividade.encerrada_pelo_limite` |
| `apps/api/src/atividade/prova-online-aluno.int.test.ts` | alterado |
| `infra/grafana/alertas/prova-vencida-aberta.yaml` | novo |
| `infra/grafana/alertas/prova-put-p95.yaml` | novo |
| `infra/k6/prova-online.js` | novo |
| `docs/runbook.md` | alterado |
| `docs/aia/correcao-de-objetiva.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| Vencidas em A e em B, só o job de A | integração | a de B segue aberta, sem lote nem auditoria | o job de A com o id da aplicação de B no payload | `apps/worker/test/encerrar-provas.int.test.ts › o job de uma escola › encerra a prova vencida da escola do job e deixa a de outra: nada de lote nem de auditoria na de B, e o id da prova não entra pelo payload` |
| Aluno estendido além do `fecha_em`; indisponibilidade na janela | integração | não encerra até o limite dele nem no `fecha_em` | sem a extensão ou a indisponibilidade, encerra | `apps/worker/test/encerrar-provas.int.test.ts › o job de uma escola › não encerra enquanto o aluno estendido tem tempo…`<br>`apps/worker/test/encerrar-provas.int.test.ts › o job de uma escola › a extensão da turma (aluno nulo) anda o fim efetivo e o limite de cada um…`<br>`apps/worker/test/encerrar-provas.int.test.ts › o job de uma escola › a queda da API que cobre parte do tempo do aluno devolve esse tempo…` |
| Pulso parado 1 min | integração | a rotina não lista; o pulso volta: encerra | com pulso de 20 s, lista | `apps/worker/test/encerrar-provas.int.test.ts › a rotina por minuto › com o pulso parado há 1 min a rotina não lista a escola; com o pulso de 20 s, lista`<br>`apps/worker/test/encerrar-provas.int.test.ts › o job de uma escola › com o pulso velho o job para sem encerrar; com o pulso de volta, encerra` |
| Job gravado antes da queda, rodado com o pulso velho | integração | não encerra | a conferência na transação | `apps/worker/test/encerrar-provas.int.test.ts › a rotina por minuto › o job gravado antes da queda, rodado com o pulso velho, não encerra` |
| Dentro do horário letivo | integração | encerra no minuto | `naoUrgente: true` fica vermelho pelo despachante (que segura o não urgente na janela letiva: `apps/despachante/test/janela.int.test.ts › caminho feliz: não urgente criado numa terça às 10h fica aguardando…`, e o urgente sai na hora: `› borda: na terça às 10h o urgente sai na hora…`) | `apps/worker/test/encerrar-provas.int.test.ts › a rotina por minuto › grava um job por escola com prova vencida, urgente, na fila de lote, com o minuto por chave…` |
| Ano encerrado | integração | não lista; o alerta não conta | a do ano em curso, na mesma escola, lista | `apps/worker/test/encerrar-provas.int.test.ts › a rotina por minuto › o ano encerrado não lista e não é encerrado; o ano em curso da mesma escola lista`<br>`apps/worker/test/encerrar-provas.int.test.ts › a medição do alerta da prova aberta › conta a prova aberta 5 min além do fim efetivo…` |
| Função suspensa em A | integração | encerra sem lote nem correção, e não volta a listar | B corrige | `apps/worker/test/encerrar-provas.int.test.ts › o job de uma escola › a função de correção suspensa na escola: encerra sem lote nem correção e não volta a listar; a outra escola corrige` |
| Vencida sem envio | integração | entra na correção com o salvo; `enviada_em` = limite, não `now()` | duas respostas corrigidas | `apps/worker/test/encerrar-provas.int.test.ts › o job de uma escola › a vencida sem envio entra na correção com o que salvou, e o `enviada_em` é o limite dela, não o `now()` do encerramento` |
| Professora encerra uma vencida e uma com tempo | integração | a vencida: `limite`, `enviada_em` = limite; a outra, `encerramento` | gravar só na rotina | `apps/worker/test/encerrar-provas.int.test.ts › o job de uma escola › a professora encerrando: a vencida leva o limite dela; a que ainda tinha tempo fica sem envio e vai com o que salvou`<br>`apps/api/src/atividade/prova-online-aluno.int.test.ts › a professora encerrando grava a vencida no limite dela (`envio` = limite) e deixa sem envio a que ainda tinha tempo…` |
| Auditoria por aplicação, sem aluno | integração | uma por aplicação | gravar por tentativa fica vermelho | `apps/worker/test/encerrar-provas.int.test.ts › o job de uma escola › uma auditoria por aplicação, sem aluno: o `depois` tem a turma e quantas vencidas, e o autor é a rotina`<br>`packages/core/src/auditoria/auditoria.int.test.ts › aceita atividade.encerrada_pelo_limite` |
| (c) resposta × job; (e) job × professor; (f) job × job e o cron duplicado; (j) estender × rotina; (l) pulso × rotina | integração | as ordens forçadas da `cenarios.md` §3 | (c) também com `encerrarPeloLimite`; (e) nas duas ordens, sem `for update` na trava da rotina: dois lotes ou o job não espera; (f) sem trava: dois lotes; o cron duplicado sem a chave do minuto: dois jobs, com o `job_registro` da escola apagado antes; (j) e (l): encerra | `apps/worker/test/encerrar-provas.int.test.ts › as corridas › (c) a resposta que entrou antes do job entra na correção…`<br>`apps/worker/test/encerrar-provas.int.test.ts › as corridas › corrida e, professora × job: …` e `… › corrida e, job × professora: …`<br>`apps/worker/test/encerrar-provas.int.test.ts › as corridas › (f) job × job: o segundo espera o primeiro…`<br>`apps/worker/test/encerrar-provas.int.test.ts › as corridas › (j) estender × rotina: …`<br>`apps/worker/test/encerrar-provas.int.test.ts › as corridas › (l) pulso × rotina: …` |
| Regra do alerta da prova aberta | unidade | dispara 5 min além do fim efetivo; com aluno estendido, não | o fim pelo `fecha_em` | `packages/core/src/atividade/encerramento.test.ts › fimEfetivo…` e `› provaAbertaAlemDoFim…` (a regra, sem banco)<br>`apps/worker/test/encerrar-provas.int.test.ts › a medição do alerta da prova aberta › conta a prova aberta 5 min além do fim efetivo; a do aluno estendido e a que passou há pouco não contam` |
| Carga [C] | carga | p95 do PUT do fluxo normal < 500 ms; a fila de cada aluno que atravessou a queda vazia em até 60 s; enviadas = gravadas; a queda de 90 s anda o limite e não encerra; os dois controles negativos (o PUT atrasado em 600 ms; as APIs fora por 150 s) reprovam, cada um pelo seu critério | o comando, a data e os números na coluna "Caso" | `npm run carga:prova`, 27/11/2026, na `educa-carga` (a volta da queda do PC, depois da correção `2026-11-27-pool-503` e do critério da opção A, `.processo/divergencia-6.0-carga.md` item 3): **passou**. Máquina calma antes de começar (`docker ps` vazio, load de 1 min 0,24; o hash não entra neste cenário). Início 18:39:34Z, 11 min de cenário: PUT de resposta no fluxo normal p95 **14 ms** (teto 500 ms; mediana 8,4 ms, máx. 97 ms); `put_fluxo_normal_na_volta_ms` (sem teto, só para ler) p95 2,78 s; `put_da_volta_ms` p95 4,98 s; fila mais lenta esvaziada **26 s** depois do fim da queda (teto 60 s); **42.000 enviadas = 42.000 gravadas**; `put_falhas_fora_da_queda` 0 e `respostas_inesperadas` 0; lacuna da queda de **98 s** gravada, **0 provas encerradas durante ela**, canária encerrada depois com o limite andado 98 s. Controles negativos, depois dessa rodada verde, o script os deu como passados: `npm run carga:prova:controle-negativo` (PUT atrasado em 600 ms, início 18:51Z, 16 min) **reprovou pelo p95 do fluxo normal**, 4.567 ms contra 500 (reprovou também pela fila, 456 s, e pelas falhas fora da queda); `npm run carga:prova:controle-da-volta` (APIs fora por 150 s, início 19:08Z, 14 min) **reprovou pela fila da volta**, 162 s contra 60 (e pelo p95 do fluxo normal, 3.220 ms; 42.000 = 42.000, lacuna de 155 s, 0 provas encerradas na queda). O load da partida dos controles não foi lido. Histórico que levou até aqui, e que não vale como registro: nove rodadas reprovaram em 27/11 pelo p95 do PUT e, nas cinco últimas, também pelo PUT falhando fora da queda; a causa era o pool sem conexão no prazo respondendo 500 em vez de 503 (corrigida na `6bfcc86b`) e o recuo da volta disputando o pool com o fluxo normal (critério da opção A, em `cenarios.md` §5 e na Tech Spec §7c). O k6, o `conferir-carga-prova.ts` e `infra/test/carga-prova.test.ts` foram ajustados pelo Arquiteto na triagem (critério dividido e janela da volta), e não pelo Implementador. **Atenção:** o k6 sorteia de 0 a 5 s antes de reenviar na volta da rede, e o app só ganha esse sorteio na 12.3 (`fila-de-respostas.ts` ainda tenta na hora, e `ESPERA_MAXIMA_NA_VOLTA_DA_REDE_MS` ainda não existe): a rodada mediu um cliente mais gentil que o app de hoje, e a carga se repete depois da 12.3 (`12_task.md`). |

## Como testar

- Rotina por escola: `apps/worker/test/classificacao-agendada.int.test.ts › grava um material.agendar-classificacao por
  escola, na fila de lote…` e `› [P] duas rotinas ao mesmo tempo…`
- Suspensão: `apps/api/src/atividade/atividade.int.test.ts › com a função de correção suspensa, a atividade encerra…`
- Encerrar ao mesmo tempo: `› quatro cliques no primeiro encerramento, ao mesmo tempo…`
- Janela letiva: `packages/shared/src/system/job-definitions.test.ts` e `apps/despachante/test/janela.int.test.ts`
- Carga: siga `infra/k6/reivindicacao-em-sala.js`; `docs/runbook.md`, "Quando a carga vale como registro"
- `npx vitest run --project integracao apps/worker/test/encerrar-provas.int.test.ts`

## Autoconferência

As perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`). A 7 vale para a AIA e o runbook.

1. **Mutações:** a seção "Mutações" tem um bloco por cláusula nova do job, da rotina, do miolo (`encerramento.ts`, os três repositories do `core`), do gauge e do check da 0069; o `--faltando` está na primeira linha dela. O que só mudou de pasta (`correcao-de-objetiva.ts`, `correcao-de-objetiva.repository.ts`, `suspensao.repository.ts`, o corpo que a `CorrecaoService` já tinha) entra no `--faltando` porque o `git diff --no-renames` o vê como novo: o conteúdo é o mesmo e os testes que o provavam seguem os mesmos (`git diff -M HEAD` mostra só a troca de `import`).
2. **Texto na tela:** a tarefa não cria nem altera tela; não se aplica.
3. **O que distingue:** cada linha da tabela de testes tem o segundo dado na coluna "O que distingue" e no caso (duas escolas; aluno estendido e aluno sem extensão; pulso de 20 s e de 1 min; ano em curso e ano encerrado na mesma escola; lote de uma escola suspensa e de outra que corrige).
4. **Checagem anterior que responde antes:** a rotina cai na recusa do contexto sem `rotinaDoSistema` e o job em `anoEmCursoDaEscola` (escola sem ano em curso não encerra nada); os casos põem o pulso de agora (`pulsar`) e o ano em curso antes de cada um, e o teste do pulso velho confere que **sem** ele o resultado muda (nenhum caso herda o pulso de outro arquivo: `afterAll` devolve o que era). A varredura é provada com a sobra de outro arquivo: o `escolasComProvaVencida` roda com 5.000 encerradas semeadas no EXPLAIN.
5. **Asserção do resultado:** os casos olham o banco (`estado`, `enviada_em`, `envio`, o lote, a auditoria), nunca o nome da função; o do alerta compara o número que o gauge lê. O EXPLAIN roda a instrução que o repository mandou ao pool, capturada, e não um SQL escrito no teste.
6. **Guarda nova:** nenhuma; a única mudança em `tools/guardas` é `DatabasePool` em `TIPOS_DO_BANCO` (o `core` passou a ter repository que recebe o pool), coberta pelo teste da própria guarda.
7. **Comentário que afirma o que o código não faz:** a AIA (1.4/1 e 1.4/9) e o runbook (as duas entradas do alerta e a seção da prova) foram relidos contra a árvore: métricas (`prova_aberta_alem_do_fim`), rota (`/v1/atividades-aplicadas/:id/respostas/:questao`), rotina (`sistema.encerrar-provas-vencidas`) e arquivos citados vêm de `grep`.
8. **Divergência:** as seis linhas da seção abaixo: as duas primeiras estão na `techspec.md` (§2 e §5 item 6; §3), a terceira, a quinta e a sexta na `cenarios.md` §5 e na `techspec.md` §7c, e a quarta é ajuste do teste, sem spec; a 0069 tem o caso `aceita` e o PRD não diz o contrário (RF5 e RF6 falam do resultado, não do lugar do código).
9. **Peça que já existe:** o `enfileirarUmaVez` e o `chaveDoMinuto` (agendar-classificação), `JobFailureError`, `QuedasDaApiRepository`, `limiteDaTentativa` e a `SuspensaoRepository` (movida) foram reaproveitados; a que estava no lugar errado para dois módulos (API e worker) desceu para o `core`, nesta tarefa, sem cópia.
10. **Corridas com a ordem forçada:** (c), (j) e (l) seguram a trava com `for share` ou SQL à mão e `esperarNaTrava` (as rotas reais ficam no `TODO.md`); (e) usa `WriteBlockTrigger` no `insert` de `entrega` e `esperarNaTrava`, **nas duas ordens** (a professora segura e o job espera; o job segura e a professora espera); (f) é job × job pela trava e o cron duplicado: com o `job_registro` da escola apagado, duas rotinas juntas deixam **um** job, com a chave do minuto. O teste não depende da máquina calma: compara instantes do relógio do banco.
11. **Isolamento e "Caso":** o caso da escola A × B manda o job de A com o id da aplicação de B no payload e lê o escopo do contexto; todas as linhas da tabela têm o caso na coluna "Caso".
12. **Guardiões:** `tenancy-guardian` (escopo no repository, `@Unscoped` só nas duas leituras globais, com justificativa), `conformidade-reviewer` (lote nasce pendente, auditoria sem aluno, check que continua recusando aprovar) e `infra-guardian` (rotina por minuto, `statement_timeout` de 20 s, pulso, alertas com runbook, carga) têm o ponto em que o plano os atende na seção "Mutações" e nos casos acima. `achados/indice.md` lido: as linhas que miram a 6.0 são a escolha `encerramento` × `limite` (já escrita na Tech Spec §5.5 e provada pelo caso da professora), o `tempo` a cada 30 s no k6 (feito, 6.5) e **o lote mostrar ao professor qual tentativa foi enviada pelo limite, com o registro da validação (D56) guardando isso** (`3_task.md`, "Recomendações sem aplicar", destino 6.0): não está nas subtarefas desta tarefa, é tela e DTO do lote, e vai ao Orquestrador no relatório.

## Fora do escopo desta tarefa

A segunda chamada (9.0) encerra pelo mesmo caminho, sem mudança aqui.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec |
|---|---|---|
| O miolo do encerramento e da correção desce de `apps/api` para `packages/core/src/atividade/`, e o job por escola mora no `apps/worker` (executor `worker`, fila `lote`) | O worker não importa `apps/api` (`app-nao-importa-app`), e no `main-worker` o consumo espera a D62 conferida e o `lote` é uma vaga por réplica | `techspec.md` §2 (tabela de módulos, linha `packages/core/src/atividade`) e §5 item 6 ("Onde mora o miolo") |
| A migration `0069_auditoria_da_rotina_da_prova` afrouxa o check `auditoria_rotina_so_nas_acoes` com `atividade.encerrada_pelo_limite` (NOT VALID + VALIDATE), com o check em `auditoria.ts`, o snapshot, o journal e o caso `aceita` | A rotina grava a auditoria como `autorOperador: 'rotina'`, e o check da 0068 só deixa a rotina gravar as ações que lista | `techspec.md` §3 (bullet da `0069`) |
| O cenário de carga `carga:prova` roda **sozinho** (10 escolas × 6 turmas × 35 alunos × 20 itens, `tempo` a cada 30 s, 10% sem rede por 1 min, as duas APIs fora por 90 s), e não junto da `FASE=sala` | A pausa de 90 s das APIs derrubaria os critérios de espera do Tutor e da ferramenta da sala (que reprovariam pela queda, e não pela prova), e o cenário mede o PUT e o limite, não a fila de IA. Decidido na triagem da 6.0: as 60 turmas já são a população da manhã, e os critérios não mudam | `cenarios.md` §5 e `techspec.md` §7c ("Carga"), agora com "em cenário próprio, separado da `FASE=sala`", decidido na triagem |
| O `encerrar-provas.int.test.ts` zera, antes de cada caso, o balde `rl:comecar-prova` do Redis de cache (`zerarOComecar`, no `beforeEach`) | O balde do `comecar` é fixo, 30 por minuto por usuário, e não sobe por `LIMITE_REQ_USUARIO_MIN`. Os casos reusam a Ana, a Bia e o Caio, e o 31º `comecar` do arquivo recebia 429 em `provaVencida` (o caso `cada escola acha o ano em curso…` caía por estar nessa posição, e isolado passava). O limitador não muda | Nenhuma: ajuste do teste, não da spec. O limite de 30 por minuto continua em `techspec.md` §7c |
| O critério da carga é dividido: o p95 de 500 ms vale para o PUT do fluxo normal (`put_fluxo_normal_ms`), e o aluno que está se recuperando (da primeira falha até a fila dele esvaziar) tem o PUT medido à parte (`put_da_volta_ms`, sem limite) e a fila esvaziando em até 60 s depois do fim da queda | Decisão do Joaquim em 27/11/2026: o p95 do PUT geral reprovava pela recuperação da queda (1,15 a 1,37 s, com o PUT que chega sozinho em 14 ms), e o que a recuperação deve cumprir é o tempo de esvaziar a fila. O critério não foi baixado: o limite de 500 ms ficou, e a fila ganhou o teto de 60 s | `cenarios.md` §5 e `techspec.md` §7c |
| A janela da volta (opção A da triagem): o PUT normal que começa antes de `FIM_DA_QUEDA_S + 60` e termina depois de `FIM_DA_QUEDA_S` vai para `put_fluxo_normal_na_volta_ms` (sem limite, só para ler), e as falhas dessa janela só contam se não forem a indisponibilidade da queda | Triagem do Arquiteto e decisão de 27/11/2026 (`.processo/divergencia-6.0-carga.md`, item 3): nos 60 s da volta, o aluno sem fila disputa o pool da API com ~2.100 filas acumuladas, e o p95 normal ali mede a máquina de teste. O k6, o `conferir-carga-prova.ts` e `infra/test/carga-prova.test.ts` foram mudados pelo Arquiteto nessa triagem, não pelo Implementador. Continuam protegidos: a fila (controle de 150 s), o fluxo normal fora da janela (controle de 600 ms) e a perda de resposta | `cenarios.md` §5 e `techspec.md` §7c |

## Mutações

--faltando: 11 linhas (99 blocos; os termos movidos ou equivalentes, por motivo na prosa): as 11 são linha inteira que só estreita tipo, ou que o fluxo não alcança, ou `.where(` de consulta cujas cláusulas têm bloco; o que sobrou de termo tem a crase igual na prosa do fim da seção.

Cada bloco tira uma cláusula ou um termo do código novo da 6.0 e o teste citado fica vermelho. Dividido por arquivo.

**O job e a medição do worker** (`encerrar-provas-vencidas.ts`, `prova-aberta-gauge.ts`):

```mutacao
arquivo: apps/worker/src/processors/encerrar-provas-vencidas.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › exige o contexto da rotina do sistema
- if (contexto?.rotinaDoSistema !== true) throw new JobFailureError(JobFailureCode.DADOS_INVALIDOS, true)
+ if (contexto === undefined) throw new JobFailureError(JobFailureCode.DADOS_INVALIDOS, true)
```

```mutacao
arquivo: apps/worker/src/processors/encerrar-provas-vencidas.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › grava um job por escola com prova vencida
- if (resultado.situacao === 'enfileirado') enfileiradosTotal += 1
+ if (resultado.situacao !== 'enfileirado') enfileiradosTotal += 1
```

```mutacao
arquivo: apps/worker/src/processors/encerrar-provas-vencidas.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a escola cujo job não foi gravado não segura as outras
- if (falhasTotal > 0) throw new InvariantException('encerramento de prova não enfileirado em alguma escola')
+ if (falhasTotal < 0) throw new InvariantException('encerramento de prova não enfileirado em alguma escola')
```

```mutacao
arquivo: apps/worker/src/processors/encerrar-provas-vencidas.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › o ano encerrado não lista e não é encerrado
- if (anoLetivoId === undefined) {
+ if (anoLetivoId === undefined && false) {
```

```mutacao
arquivo: apps/worker/src/processors/encerrar-provas-vencidas.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › com o sinal de parada já dado o job não encerra nenhuma prova
- if (sinal.aborted) {
+ if (sinal.aborted && false) {
```

```mutacao
arquivo: apps/worker/src/processors/encerrar-provas-vencidas.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a prova que sumiu entre a listagem e a trava não é falha
- if (travada === undefined) return 'nao_aplicavel' as const
```

```mutacao
arquivo: apps/worker/src/processors/encerrar-provas-vencidas.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › encerra a prova vencida da escola do job e deixa a de outra
- if (desfecho === 'encerrada') encerradasTotal += 1
+ if (desfecho !== 'encerrada') encerradasTotal += 1
```

```mutacao
arquivo: apps/worker/src/processors/encerrar-provas-vencidas.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › não encerra enquanto o aluno estendido tem tempo
- if (desfecho === 'nao_vencida') naoVencidasTotal += 1
+ if (desfecho !== 'nao_vencida') naoVencidasTotal += 1
```

```mutacao
arquivo: apps/worker/src/processors/encerrar-provas-vencidas.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › com o pulso velho o job para sem encerrar
- if (desfecho === 'pulso_velho') {
+ if (desfecho === 'pulso_velho' && false) {
```

```mutacao
arquivo: apps/worker/src/processors/encerrar-provas-vencidas.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a prova que falha ao encerrar não segura as outras
- if (falhasTotal > 0) throw new InvariantException('prova vencida não encerrada em alguma aplicação')
+ if (falhasTotal < 0) throw new InvariantException('prova vencida não encerrada em alguma aplicação')
```

```mutacao
arquivo: apps/worker/src/prova-aberta-gauge.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › o ano encerrado não lista e não é encerrado
- if (anoLetivoId === undefined) return undefined
```

```mutacao
arquivo: apps/worker/src/prova-aberta-gauge.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › conta a prova aberta 5 min além do fim efetivo
- for (const candidata of candidatas) if (await estaAbertaAlemDoFimEfetivo(banco, candidata)) alemDoFim += 1
+ if (!(await estaAbertaAlemDoFimEfetivo(banco, candidata))) alemDoFim += 1
```

```mutacao
arquivo: apps/worker/src/prova-aberta-gauge.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › conta a prova aberta 5 min além do fim efetivo
falha: toBeUndefined()
- return alemDoFim === 0 ? undefined : alemDoFim
+ return alemDoFim
```

**A correção de objetiva e os destaques**, movidos de `apps/api` para `packages/core/src/atividade/`:

```mutacao
arquivo: packages/core/src/atividade/correcao-de-objetiva.ts
teste: packages/core/src/atividade/correcao-de-objetiva.test.ts
- if (marcada === undefined) emBranco += 1
+ if (marcada !== undefined) emBranco += 1
```

```mutacao
arquivo: packages/core/src/atividade/correcao-de-objetiva.ts
teste: packages/core/src/atividade/correcao-de-objetiva.test.ts
- if (acertou) acertos += 1
+ if (!acertou) acertos += 1
```

```mutacao
arquivo: packages/core/src/atividade/correcao-de-objetiva.ts
teste: packages/core/src/atividade/correcao-de-objetiva.test.ts
- const codigo = questao.habilidade?.codigo ?? null
+ const codigo = questao.habilidade?.codigo ?? 'sem'
```

```mutacao
arquivo: packages/core/src/atividade/correcao-de-objetiva.ts
teste: packages/core/src/atividade/correcao-de-objetiva.test.ts
- const habilidade = porHabilidade.get(codigo) ?? { codigo, acertos: 0, total: 0 }
+ const habilidade = porHabilidade.get(codigo) ?? { codigo, acertos: 1, total: 0 }
```

```mutacao
arquivo: packages/core/src/atividade/correcao-de-objetiva.ts
teste: packages/core/src/atividade/correcao-de-objetiva.test.ts
- if (acertou) habilidade.acertos += 1
+ if (!acertou) habilidade.acertos += 1
```

```mutacao
arquivo: packages/core/src/atividade/correcao-de-objetiva.ts
teste: packages/core/src/atividade/correcao-de-objetiva.test.ts
- if (historico === undefined || historico.total < MINIMO_DE_QUESTOES_NO_HISTORICO) return false
+ if (false || historico.total < MINIMO_DE_QUESTOES_NO_HISTORICO) return false
```

```mutacao
arquivo: packages/core/src/atividade/correcao-de-objetiva.ts
teste: packages/core/src/atividade/correcao-de-objetiva.test.ts
- if (historico === undefined || historico.total < MINIMO_DE_QUESTOES_NO_HISTORICO) return false
+ if (historico === undefined || false) return false
```

```mutacao
arquivo: packages/core/src/atividade/correcao-de-objetiva.ts
teste: packages/core/src/atividade/correcao-de-objetiva.test.ts
- if (correcao.total < MINIMO_DE_QUESTOES_PARA_COMPARAR_COM_O_HISTORICO) return false
+ if (false) return false
```

```mutacao
arquivo: packages/core/src/atividade/correcao-de-objetiva.ts
teste: packages/core/src/atividade/correcao-de-objetiva.test.ts
- const marcadas = questoes.flatMap((_, indice) => respostas.get(indice + 1) ?? [])
+ const marcadas = questoes.flatMap((_, indice) => respostas.get(indice + 1) ?? [0])
```

```mutacao
arquivo: packages/core/src/atividade/correcao-de-objetiva.ts
teste: packages/core/src/atividade/correcao-de-objetiva.test.ts
- if (marcadas.length < MINIMO_DE_RESPOSTAS_PARA_MESMA_ALTERNATIVA) return false
+ if (false) return false
```

```mutacao
arquivo: packages/core/src/atividade/correcao-de-objetiva.ts
teste: packages/core/src/atividade/correcao-de-objetiva.test.ts
- return new Set(marcadas).size === 1 && correcao.acertos < marcadas.length
+ return true && correcao.acertos < marcadas.length
```

```mutacao
arquivo: packages/core/src/atividade/correcao-de-objetiva.ts
teste: packages/core/src/atividade/correcao-de-objetiva.test.ts
- return new Set(marcadas).size === 1 && correcao.acertos < marcadas.length
+ return new Set(marcadas).size === 1 && true
```

```mutacao
arquivo: packages/core/src/atividade/correcao-de-objetiva.ts
teste: packages/core/src/atividade/correcao-de-objetiva.test.ts
- if (colegas < MINIMO_DE_COLEGAS_PARA_COMPARAR) return false
+ if (false) return false
```

```mutacao
arquivo: packages/core/src/atividade/correcao-de-objetiva.ts
teste: packages/core/src/atividade/correcao-de-objetiva.test.ts
- const acertosDosColegas = (lote.acertosPorQuestao[indice] ?? 0) - (marcada === questao.gabarito ? 1 : 0)
+ const acertosDosColegas = (lote.acertosPorQuestao[indice] ?? 0) - 0
```

```mutacao
arquivo: packages/core/src/atividade/correcao-de-objetiva.ts
teste: packages/core/src/atividade/correcao-de-objetiva.test.ts
- if (acertosDosColegas < colegas * FRACAO_DA_TURMA_QUE_ACERTOU) return
+ if (false) return
```

```mutacao
arquivo: packages/core/src/atividade/correcao-de-objetiva.ts
teste: packages/core/src/atividade/correcao-de-objetiva.test.ts
- if (marcada !== undefined && marcada !== questao.gabarito) erradas += 1
+ if (true && marcada !== questao.gabarito) erradas += 1
```

```mutacao
arquivo: packages/core/src/atividade/correcao-de-objetiva.ts
teste: packages/core/src/atividade/correcao-de-objetiva.test.ts
- if (marcada !== undefined && marcada !== questao.gabarito) erradas += 1
+ if (marcada !== undefined && true) erradas += 1
```

```mutacao
arquivo: packages/core/src/atividade/correcao-de-objetiva.ts
teste: packages/core/src/atividade/correcao-de-objetiva.test.ts
- return queATurmaAcertou >= MINIMO_DE_QUESTOES_QUE_A_TURMA_ACERTOU && erradas >= queATurmaAcertou * FRACAO_DE_ERROS_ONDE_A_TURMA_ACERTOU
+ return true && erradas >= queATurmaAcertou * FRACAO_DE_ERROS_ONDE_A_TURMA_ACERTOU
```

```mutacao
arquivo: packages/core/src/atividade/correcao-de-objetiva.ts
teste: packages/core/src/atividade/correcao-de-objetiva.test.ts
- return queATurmaAcertou >= MINIMO_DE_QUESTOES_QUE_A_TURMA_ACERTOU && erradas >= queATurmaAcertou * FRACAO_DE_ERROS_ONDE_A_TURMA_ACERTOU
+ return queATurmaAcertou >= MINIMO_DE_QUESTOES_QUE_A_TURMA_ACERTOU && true
```

```mutacao
arquivo: packages/core/src/atividade/correcao-de-objetiva.ts
teste: packages/core/src/atividade/correcao-de-objetiva.test.ts
- if (emBranco) motivos.add('em_branco')
+ if (false) motivos.add('em_branco')
```

```mutacao
arquivo: packages/core/src/atividade/correcao-de-objetiva.ts
teste: packages/core/src/atividade/correcao-de-objetiva.test.ts
- if (!emBranco && foraDoHistorico(correcao, historico)) motivos.add('fora_do_historico')
+ if (true && foraDoHistorico(correcao, historico)) motivos.add('fora_do_historico')
```

```mutacao
arquivo: packages/core/src/atividade/correcao-de-objetiva.ts
teste: packages/core/src/atividade/correcao-de-objetiva.test.ts
- if (!emBranco && foraDoHistorico(correcao, historico)) motivos.add('fora_do_historico')
+ if (!emBranco && true) motivos.add('fora_do_historico')
```

```mutacao
arquivo: packages/core/src/atividade/correcao-de-objetiva.ts
teste: packages/core/src/atividade/correcao-de-objetiva.test.ts
- if (mesmaAlternativaEmTodas(questoes, respostas, correcao) || errouOndeATurmaAcertou(questoes, respostas, lote)) motivos.add('padrao_de_erro')
+ if (errouOndeATurmaAcertou(questoes, respostas, lote)) motivos.add('padrao_de_erro')
```

```mutacao
arquivo: packages/core/src/atividade/correcao-de-objetiva.ts
teste: packages/core/src/atividade/correcao-de-objetiva.test.ts
- if (mesmaAlternativaEmTodas(questoes, respostas, correcao) || errouOndeATurmaAcertou(questoes, respostas, lote)) motivos.add('padrao_de_erro')
+ if (mesmaAlternativaEmTodas(questoes, respostas, correcao)) motivos.add('padrao_de_erro')
```

**O miolo do encerramento** (`encerramento.ts`):

```mutacao
arquivo: packages/core/src/atividade/encerramento.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a tentativa sem limite
- const comLimite = limites.flatMap(({ id, limite }) => (limite === null ? [] : [{ id, limite }]))
+ const comLimite = limites.flatMap(({ id, limite }) => [{ id, limite: limite ?? new Date(0) }])
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a vencida sem envio entra na correção
- vencidas: comLimite.filter(({ limite }) => limite.getTime() <= agora.getTime()),
+ vencidas: comLimite.filter(({ limite }) => limite.getTime() > agora.getTime()),
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › não encerra enquanto o aluno estendido tem tempo
- ultimoLimite: comLimite.reduce<Date | null>((maior, { limite }) => (maior === null || limite.getTime() > maior.getTime() ? limite : maior), null),
+ ultimoLimite: comLimite.reduce<Date | null>((maior, { limite }) => (maior === undefined || limite.getTime() > maior.getTime() ? limite : maior), null),
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › não encerra enquanto o aluno estendido tem tempo
- ultimoLimite: comLimite.reduce<Date | null>((maior, { limite }) => (maior === null || limite.getTime() > maior.getTime() ? limite : maior), null),
+ ultimoLimite: comLimite.reduce<Date | null>((maior, { limite }) => (maior === null || limite.getTime() < maior.getTime() ? limite : maior), null),
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a queda da API que cobre parte do tempo do aluno
- const desde = tentativas.reduce<Date | undefined>((menor, tentativa) => (menor === undefined || tentativa.iniciadaEm.getTime() < menor.getTime() ? tentativa.iniciadaEm : menor), aPartirDe)
+ const desde = tentativas.reduce<Date | undefined>((menor, tentativa) => (menor === undefined || tentativa.iniciadaEm.getTime() > menor.getTime() ? tentativa.iniciadaEm : menor), aPartirDe)
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.ts
teste: apps/api/src/atividade/prova-online-aluno.int.test.ts › a professora encerrando grava a vencida no limite dela
- if (aplicacao.estado === 'aberta') {
+ if (true) {
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.ts
teste: packages/core/src/atividade/encerramento.test.ts › sem extensão e sem aluno em andamento
- return new Date(Math.max(fechaEm.getTime() + daTurmaEmMs, ultimoLimite?.getTime() ?? 0))
+ return new Date(Math.max(fechaEm.getTime() + daTurmaEmMs, ultimoLimite?.getTime() ?? Infinity))
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › o que não é da rotina volta como não aplicável
- if (aplicacao.estado !== 'aberta' || !aplicacao.avaliativa || aplicacao.fechaEm === null) return 'nao_aplicavel'
+ if (false || !aplicacao.avaliativa || aplicacao.fechaEm === null) return 'nao_aplicavel'
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › o que não é da rotina volta como não aplicável
- if (aplicacao.estado !== 'aberta' || !aplicacao.avaliativa || aplicacao.fechaEm === null) return 'nao_aplicavel'
+ if (aplicacao.estado !== 'aberta' || false || aplicacao.fechaEm === null) return 'nao_aplicavel'
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › o que não é da rotina volta como não aplicável
- if (aplicacao.estado !== 'aberta' || !aplicacao.avaliativa || aplicacao.fechaEm === null) return 'nao_aplicavel'
+ if (aplicacao.estado !== 'aberta' || !aplicacao.avaliativa || false) return 'nao_aplicavel'
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › com o pulso velho o job para sem encerrar
- if (pulsoVelho) return 'pulso_velho'
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › não encerra enquanto o aluno estendido tem tempo
- if (agora.getTime() < fimEfetivo(aplicacao.fechaEm, extensoes, ultimoLimite).getTime()) return 'nao_vencida'
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.ts
teste: apps/api/src/atividade/atividade.int.test.ts › encerrar duas vezes, em seguida e ao mesmo tempo
- if (await correcoes.hasLoteVigente(aplicacao.id)) return
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a função de correção suspensa na escola
- if (await suspensa()) return
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a vencida que ninguém abriu encerra sem lote
- if (respostas.size === 0) return
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.ts
teste: apps/api/src/atividade/correcao/correcao.int.test.ts › só conta lote aprovado: com o primeiro lote aprovado
- const soma = historico.get(anterior.alunoId) ?? { acertos: 0, total: 0 }
+ const soma = historico.get(anterior.alunoId) ?? { acertos: 0, total: 99 }
```

**Os repositórios da rotina e a leitura das quedas** (escopo, estado, extensões, pulso):

```mutacao
arquivo: packages/core/src/atividade/encerramento.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a trava, as tentativas, as extensões e a gravação do contexto de A não alcançam a prova de B
- .where(and(eq(atividadeAplicada.escolaId, requireEscolaId()), eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()), eq(atividadeAplicada.id, id)))
+ .where(and(eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()), eq(atividadeAplicada.id, id)))
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a trava, as tentativas, as extensões e a gravação do contexto de A não alcançam a prova de B
- .where(and(eq(atividadeAplicada.escolaId, requireEscolaId()), eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()), eq(atividadeAplicada.id, id)))
+ .where(and(eq(atividadeAplicada.escolaId, requireEscolaId()), eq(atividadeAplicada.id, id)))
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a trava e a leitura do contexto certo alcançam a prova; encerrar de novo não muda a data
- .where(and(eq(atividadeAplicada.escolaId, requireEscolaId()), eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()), eq(atividadeAplicada.id, id)))
+ .where(and(eq(atividadeAplicada.escolaId, requireEscolaId()), eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso())))
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a trava, as tentativas, as extensões e a gravação do contexto de A não alcançam a prova de B
- .where(and(eq(atividadeAplicada.escolaId, requireEscolaId()), eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()), eq(atividadeAplicada.id, id), eq(atividadeAplicada.estado, 'aberta')))
+ .where(and(eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()), eq(atividadeAplicada.id, id), eq(atividadeAplicada.estado, 'aberta')))
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a trava, as tentativas, as extensões e a gravação do contexto de A não alcançam a prova de B
- .where(and(eq(atividadeAplicada.escolaId, requireEscolaId()), eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()), eq(atividadeAplicada.id, id), eq(atividadeAplicada.estado, 'aberta')))
+ .where(and(eq(atividadeAplicada.escolaId, requireEscolaId()), eq(atividadeAplicada.id, id), eq(atividadeAplicada.estado, 'aberta')))
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a trava e a leitura do contexto certo alcançam a prova; encerrar de novo não muda a data
- .where(and(eq(atividadeAplicada.escolaId, requireEscolaId()), eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()), eq(atividadeAplicada.id, id), eq(atividadeAplicada.estado, 'aberta')))
+ .where(and(eq(atividadeAplicada.escolaId, requireEscolaId()), eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()), eq(atividadeAplicada.estado, 'aberta')))
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a trava e a leitura do contexto certo alcançam a prova; encerrar de novo não muda a data
- .where(and(eq(atividadeAplicada.escolaId, requireEscolaId()), eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()), eq(atividadeAplicada.id, id), eq(atividadeAplicada.estado, 'aberta')))
+ .where(and(eq(atividadeAplicada.escolaId, requireEscolaId()), eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()), eq(atividadeAplicada.id, id)))
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a trava, as tentativas, as extensões e a gravação do contexto de A não alcançam a prova de B
  .from(tentativaAtividade)
  .where(
  and(
- eq(tentativaAtividade.escolaId, requireEscolaId()),
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a trava, as tentativas, as extensões e a gravação do contexto de A não alcançam a prova de B
  .from(tentativaAtividade)
  .where(
  and(
  eq(tentativaAtividade.escolaId, requireEscolaId()),
- eq(tentativaAtividade.anoLetivoId, requireAnoEmCurso()),
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a trava e a leitura do contexto certo alcançam a prova; encerrar de novo não muda a data
  .from(tentativaAtividade)
  .where(
  and(
  eq(tentativaAtividade.escolaId, requireEscolaId()),
  eq(tentativaAtividade.anoLetivoId, requireAnoEmCurso()),
- eq(tentativaAtividade.atividadeAplicadaId, atividadeAplicadaId),
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a trava e a leitura do contexto certo alcançam a prova; encerrar de novo não muda a data
  eq(tentativaAtividade.atividadeAplicadaId, atividadeAplicadaId),
- isNull(tentativaAtividade.enviadaEm),
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a trava, as tentativas, as extensões e a gravação do contexto de A não alcançam a prova de B
- .where(and(eq(extensaoDeTempo.escolaId, requireEscolaId()), eq(extensaoDeTempo.anoLetivoId, requireAnoEmCurso()), eq(extensaoDeTempo.atividadeAplicadaId, atividadeAplicadaId)))
+ .where(and(eq(extensaoDeTempo.anoLetivoId, requireAnoEmCurso()), eq(extensaoDeTempo.atividadeAplicadaId, atividadeAplicadaId)))
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a trava, as tentativas, as extensões e a gravação do contexto de A não alcançam a prova de B
- .where(and(eq(extensaoDeTempo.escolaId, requireEscolaId()), eq(extensaoDeTempo.anoLetivoId, requireAnoEmCurso()), eq(extensaoDeTempo.atividadeAplicadaId, atividadeAplicadaId)))
+ .where(and(eq(extensaoDeTempo.escolaId, requireEscolaId()), eq(extensaoDeTempo.atividadeAplicadaId, atividadeAplicadaId)))
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a trava e a leitura do contexto certo alcançam a prova; encerrar de novo não muda a data
- .where(and(eq(extensaoDeTempo.escolaId, requireEscolaId()), eq(extensaoDeTempo.anoLetivoId, requireAnoEmCurso()), eq(extensaoDeTempo.atividadeAplicadaId, atividadeAplicadaId)))
+ .where(and(eq(extensaoDeTempo.escolaId, requireEscolaId()), eq(extensaoDeTempo.anoLetivoId, requireAnoEmCurso())))
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a trava, as tentativas, as extensões e a gravação do contexto de A não alcançam a prova de B
  .set({ enviadaEm: limite, envio: 'limite' })
  .where(
  and(
- eq(tentativaAtividade.escolaId, requireEscolaId()),
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a trava, as tentativas, as extensões e a gravação do contexto de A não alcançam a prova de B
  .set({ enviadaEm: limite, envio: 'limite' })
  .where(
  and(
  eq(tentativaAtividade.escolaId, requireEscolaId()),
- eq(tentativaAtividade.anoLetivoId, requireAnoEmCurso()),
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a trava e a leitura do contexto certo alcançam a prova; encerrar de novo não muda a data
  .set({ enviadaEm: limite, envio: 'limite' })
  .where(
  and(
  eq(tentativaAtividade.escolaId, requireEscolaId()),
  eq(tentativaAtividade.anoLetivoId, requireAnoEmCurso()),
- eq(tentativaAtividade.atividadeAplicadaId, atividadeAplicadaId),
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a trava e a leitura do contexto certo alcançam a prova; encerrar de novo não muda a data
- eq(tentativaAtividade.id, id),
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a trava e a leitura do contexto certo alcançam a prova; encerrar de novo não muda a data
  eq(tentativaAtividade.id, id),
- isNull(tentativaAtividade.enviadaEm),
```

```mutacao
arquivo: packages/core/src/atividade/provas-vencidas.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › cada escola acha o ano em curso dela
- .innerJoin(anoLetivo, and(eq(anoLetivo.escolaId, atividadeAplicada.escolaId), eq(anoLetivo.id, atividadeAplicada.anoLetivoId), eq(anoLetivo.situacao, 'em_curso')))
+ .innerJoin(anoLetivo, and(eq(anoLetivo.escolaId, atividadeAplicada.escolaId), eq(anoLetivo.id, atividadeAplicada.anoLetivoId), eq(anoLetivo.situacao, 'encerrado')))
```

```mutacao
arquivo: packages/core/src/atividade/provas-vencidas.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a escola entra na rotina só pelo que a prova dela é
  and(
  eq(atividadeAplicada.avaliativa, true),
- eq(atividadeAplicada.estado, 'aberta'),
```

```mutacao
arquivo: packages/core/src/atividade/provas-vencidas.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a escola entra na rotina só pelo que a prova dela é
- lt(atividadeAplicada.fechaEm, sql`now()`),
```

```mutacao
arquivo: packages/core/src/atividade/provas-vencidas.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a escola entra na rotina só pelo que a prova dela é
- exists(this.banco.select({ um: sql`1` }).from(pulsoDaApi).where(sql`now() - ${pulsoDaApi.ultimoEm} <= make_interval(secs => ${LIMIAR_DA_LACUNA_MS / 1000})`)),
```

```mutacao
arquivo: packages/core/src/atividade/provas-vencidas.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › cada escola acha o ano em curso dela
- .where(and(eq(anoLetivo.escolaId, requireEscolaId()), eq(anoLetivo.situacao, 'em_curso')))
+ .where(and(eq(anoLetivo.situacao, 'em_curso')))
```

```mutacao
arquivo: packages/core/src/atividade/provas-vencidas.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › cada escola acha o ano em curso dela
- .where(and(eq(anoLetivo.escolaId, requireEscolaId()), eq(anoLetivo.situacao, 'em_curso')))
+ .where(and(eq(anoLetivo.escolaId, requireEscolaId())))
```

```mutacao
arquivo: packages/core/src/atividade/provas-vencidas.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a lista de provas vencidas da escola do contexto só traz as abertas
- eq(atividadeAplicada.escolaId, requireEscolaId()),
```

```mutacao
arquivo: packages/core/src/atividade/provas-vencidas.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a lista de provas vencidas da escola do contexto só traz as abertas
- eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()),
```

```mutacao
arquivo: packages/core/src/atividade/provas-vencidas.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a lista de provas vencidas da escola do contexto só traz as abertas
  eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()),
  eq(atividadeAplicada.avaliativa, true),
- eq(atividadeAplicada.estado, 'aberta'),
```

```mutacao
arquivo: packages/core/src/atividade/provas-vencidas.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a lista de provas vencidas da escola do contexto só traz as abertas
- lt(atividadeAplicada.fechaEm, corte),
```

```mutacao
arquivo: packages/core/src/atividade/provas-vencidas.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a lista de provas vencidas da escola do contexto só traz as abertas
- .orderBy(asc(atividadeAplicada.fechaEm), asc(atividadeAplicada.id))
+ .orderBy(asc(atividadeAplicada.id))
```

```mutacao
arquivo: packages/core/src/atividade/provas-vencidas.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a lista de provas vencidas da escola do contexto só traz as abertas
- .limit(limite)
```

```mutacao
arquivo: packages/core/src/atividade/quedas-da-api.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a leitura das quedas traz só as que terminam depois do começo da tentativa
- .leftJoin(indisponibilidade, gt(indisponibilidade.fim, desde))
+ .innerJoin(indisponibilidade, gt(indisponibilidade.fim, desde))
```

```mutacao
arquivo: packages/core/src/atividade/quedas-da-api.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a leitura das quedas traz só as que terminam depois do começo da tentativa
- .leftJoin(indisponibilidade, gt(indisponibilidade.fim, desde))
+ .leftJoin(indisponibilidade, lt(indisponibilidade.fim, desde))
```

```mutacao
arquivo: packages/core/src/atividade/quedas-da-api.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a leitura das quedas traz só as que terminam depois do começo da tentativa
- pulso: primeira === undefined ? null : { ultimoEm: primeira.ultimoEm, agora: primeira.agora },
+ pulso: false ? null : { ultimoEm: primeira.ultimoEm, agora: primeira.agora },
```

```mutacao
arquivo: packages/core/src/atividade/quedas-da-api.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a leitura das quedas traz só as que terminam depois do começo da tentativa
- pulso: primeira === undefined ? null : { ultimoEm: primeira.ultimoEm, agora: primeira.agora },
+ pulso: primeira === undefined ? null : { ultimoEm: primeira.ultimoEm, agora: primeira.ultimoEm },
```

```mutacao
arquivo: packages/core/src/atividade/quedas-da-api.repository.ts
teste: packages/core/src/atividade/quedas-da-api.test.ts › sem linha de pulso
- return pulso === null || pulso.agora.getTime() - pulso.ultimoEm.getTime() > LIMIAR_DA_LACUNA_MS
+ return pulso.agora.getTime() - pulso.ultimoEm.getTime() > LIMIAR_DA_LACUNA_MS
```

```mutacao
arquivo: packages/core/src/atividade/quedas-da-api.repository.ts
teste: packages/core/src/atividade/quedas-da-api.test.ts › no limiar
- return pulso === null || pulso.agora.getTime() - pulso.ultimoEm.getTime() > LIMIAR_DA_LACUNA_MS
+ return pulso === null || pulso.agora.getTime() - pulso.ultimoEm.getTime() >= LIMIAR_DA_LACUNA_MS
```

**Mais três do repositório do lote vigente e da janela do alerta** (`correcao-de-objetiva.repository.ts`, `provas-vencidas.repository.ts`):

```mutacao
arquivo: packages/core/src/atividade/correcao-de-objetiva.repository.ts
teste: apps/api/src/atividade/atividade.int.test.ts › o lote rejeitado deixa corrigir de novo
- .where(and(this.#escopoDoLote(), eq(entrega.atividadeAplicadaId, atividadeAplicadaId), ne(entrega.estado, 'rejeitada')))
+ .where(and(this.#escopoDoLote(), eq(entrega.atividadeAplicadaId, atividadeAplicadaId)))
```

```mutacao
arquivo: packages/core/src/atividade/correcao-de-objetiva.repository.ts
teste: apps/api/src/atividade/atividade.int.test.ts › o lote de uma aplicação não impede a correção de outra da mesma turma
- .where(and(this.#escopoDoLote(), eq(entrega.atividadeAplicadaId, atividadeAplicadaId), ne(entrega.estado, 'rejeitada')))
+ .where(and(this.#escopoDoLote(), ne(entrega.estado, 'rejeitada')))
```

```mutacao
arquivo: packages/core/src/atividade/provas-vencidas.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a lista de provas vencidas da escola do contexto só traz as abertas
- return this.#abertasAte(sql`now() - make_interval(secs => ${segundos})`, limite)
+ return this.#abertasAte(sql`now() + make_interval(secs => ${segundos})`, limite)
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a professora encerrando lê as quedas a partir do começo da primeira tentativa, e não da época; sem tentativa, a partir de agora
- const leitura = await new QuedasDaApiRepository(tx).leituraDesde(desde ?? new Date())
+ const leitura = await new QuedasDaApiRepository(tx).leituraDesde(desde ?? new Date(0))
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a professora encerrando lê as quedas a partir do começo da primeira tentativa, e não da época; sem tentativa, a partir de agora
- const desde = tentativas.reduce<Date | undefined>((menor, tentativa) => (menor === undefined || tentativa.iniciadaEm.getTime() < menor.getTime() ? tentativa.iniciadaEm : menor), aPartirDe)
+ const desde = tentativas.reduce<Date | undefined>((menor, tentativa) => (menor === undefined || tentativa.iniciadaEm.getTime() > menor.getTime() ? tentativa.iniciadaEm : menor), aPartirDe)
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › a professora encerrando lê as quedas a partir do começo da primeira tentativa, e não da época; sem tentativa, a partir de agora
- const desde = tentativas.reduce<Date | undefined>((menor, tentativa) => (menor === undefined || tentativa.iniciadaEm.getTime() < menor.getTime() ? tentativa.iniciadaEm : menor), aPartirDe)
+ const desde = tentativas.reduce<Date | undefined>((menor, tentativa) => (menor !== undefined || tentativa.iniciadaEm.getTime() < menor.getTime() ? tentativa.iniciadaEm : menor), aPartirDe)
```

```mutacao
arquivo: packages/core/src/atividade/encerramento.repository.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › corrida e, professora × job: a professora segura a trava ao gravar o lote, o job espera, acha a aplicação encerrada e não grava a auditoria do limite nem encerra de novo
  .where(and(eq(atividadeAplicada.escolaId, requireEscolaId()), eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()), eq(atividadeAplicada.id, id)))
- .for('update', { of: atividadeAplicada })
  return linha
```

```mutacao
arquivo: apps/worker/src/processors/encerrar-provas-vencidas.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › grava um job por escola com prova vencida, urgente, na fila de lote, com o minuto por chave; rodar de novo no mesmo minuto, ou duas rotinas juntas, não cria outro
- const resultado = await runInContext({ requisicaoId: contexto.requisicaoId, escolaId }, () => banco.transaction((tx) => enfileirador.enfileirarUmaVez(tx, TIPO_ENCERRAR_PROVAS_VENCIDAS, {}, chave)))
+ const resultado = await runInContext({ requisicaoId: contexto.requisicaoId, escolaId }, () => banco.transaction((tx) => enfileirador.enfileirarUmaVez(tx, TIPO_ENCERRAR_PROVAS_VENCIDAS, {}, randomUUID())))
```

```mutacao
arquivo: apps/worker/src/processors/encerrar-provas-vencidas.ts
teste: apps/worker/test/encerrar-provas.int.test.ts › cada aplicação é encerrada numa transação com `statement_timeout` de 20 s, que o gatilho de teste lê na hora de gravar o lote
- const PRAZO_DA_APLICACAO_MS = 20_000
+ const PRAZO_DA_APLICACAO_MS = 30_000
```

**O que não tem bloco, e por quê.** Linha movida sem mudança de texto: `correcao-de-objetiva.repository.ts` (as quatro consultas saíram de `apps/api/src/atividade/correcao/correcao.repository.ts` com as mesmas cláusulas, e as mutações delas moram nas tarefas em que nasceram), `encerramento.repository.ts` (a trava, o `innerJoin(artefato, …)` com os três termos de escopo saiu de `AtividadeAplicadaRepository.lock`) e `suspensao.repository.ts` (só mudou de pacote). Linha em que a mutação é equivalente ou o ramo não alcança: `isNotNull(atividadeAplicada.fechaEm)` e `eq(atividadeAplicada.avaliativa, true)` nas duas listas de `provas-vencidas.repository.ts` só espelham o índice parcial `atividade_aplicada_prova_aberta_idx`: o banco já impede `fecha_em` fora da avaliativa (`atividade_aplicada_prova_so_na_avaliativa` e `atividade_aplicada_janela_inteira`), e `lt(fechaEm, …)` já descarta o nulo; os termos `eq(anoLetivo.escolaId, atividadeAplicada.escolaId)` e `eq(anoLetivo.id, atividadeAplicada.anoLetivoId)` do `innerJoin` do ano em curso chegam ao mesmo resultado um sem o outro (o id do ano é único), e o que decide, `eq(anoLetivo.situacao, 'em_curso')`, tem bloco; `(fechaEm === null ? [] : [{ id, fechaEm }])` só estreita o tipo depois do `isNotNull`; `inicio === null` e `fim === null` em `quedas-da-api.repository.ts` vêm sempre juntos (o `leftJoin` sem indisponibilidade traz os dois nulos); `leitura.pulso?.agora ?? new Date()` em `encerramento.ts` só vale com o pulso ausente, e a rotina já parou antes disso em `pulso_velho` (o caso com a tabela vazia está no teste das quedas); `.get(alunoId) ?? new Map<number, number>()` em `correcao.service.ts` não alcança, porque `respostasPorAluno` devolve a tentativa sem resposta com o mapa vazio; `currentContext()?.requisicaoId ?? randomUUID()` em `encerrar-provas-vencidas.ts` só vale na chamada fora do contexto da rotina, que o job nunca faz. O check de `auditoria.ts` (`autor_operador is distinct from 'rotina' or acao in (…)`) espelha o SQL da `0069_auditoria_da_rotina_da_prova.sql`: quem recusa e aceita é o banco, e o caso `aceita` de `auditoria.int.test.ts` prova a migration. `.where(` e `.orderBy(` de uma consulta cujas cláusulas já têm bloco acima não ganham outro.

**Os termos movidos sem mudança** (cada um idêntico ao do `HEAD` em `correcao.repository.ts`, em `atividade-aplicada.repository.ts` e em `suspensao.repository.ts`: código movido, não escrito de novo): `alunoId === undefined ? undefined : eq(respostaAtividade.alunoId, alunoId)`, `alunoId === undefined ? undefined : eq(tentativaAtividade.alunoId, alunoId)`, `antes === undefined ? undefined : lt(entrega.decididaEm, antes)`, `eq(artefato.anoLetivoId, atividadeAplicada.anoLetivoId)`, `eq(artefato.disciplinaId, disciplinaId)`, `eq(artefato.escolaId, atividadeAplicada.escolaId)`, `eq(artefato.id, atividadeAplicada.artefatoId)`, `eq(atividadeAplicada.anoLetivoId, correcao.anoLetivoId)`, `eq(atividadeAplicada.escolaId, correcao.escolaId)`, `eq(atividadeAplicada.id, correcao.atividadeAplicadaId)`, `eq(correcao.anoLetivoId, requireAnoEmCurso())`, `eq(correcao.escolaId, requireEscolaId())`, `eq(entrega.anoLetivoId, requireAnoEmCurso())`, `eq(entrega.escolaId, correcao.escolaId)`, `eq(entrega.escolaId, requireEscolaId())`, `eq(entrega.estado, 'aprovada')`, `eq(entrega.id, correcao.entregaId)`, `eq(entrega.tipo, 'lote_de_correcao')`, `eq(respostaAtividade.anoLetivoId, anoLetivoId)`, `eq(respostaAtividade.atividadeAplicadaId, atividadeAplicadaId)`, `eq(respostaAtividade.escolaId, escolaId)`, `eq(suspensaoDeFuncao.escolaId, escolaId)`, `eq(suspensaoDeFuncao.funcao, funcao)`, `eq(tentativaAtividade.anoLetivoId, anoLetivoId)`, `eq(tentativaAtividade.atividadeAplicadaId, atividadeAplicadaId)`, `eq(tentativaAtividade.escolaId, escolaId)`, `inArray(correcao.alunoId, [...alunoIds])`, `isNull(suspensaoDeFuncao.retomadaEm)`, `this.#escopoDoLote()`.

**As linhas inteiras que ficam sem bloco**, com o motivo: `if (alunoIds.length === 0) return []` (a única chamada, `corrigirLote`, já parou antes com `respostas.size === 0`, então a lista nunca chega vazia); `if (criada === undefined) throw new InvariantException('lote não criado')` (o `returning` do `insert` sempre devolve a linha, e a linha só estreita o tipo); `.where(lte(ordenadas.posicao, MAXIMO_DE_LOTES_NO_HISTORICO))` (movido sem mudança de `correcao.repository.ts`); `return linhas.flatMap(({ id, fechaEm }) => (fechaEm === null ? [] : [{ id, fechaEm }]))` (só estreita o tipo: `fecha_em` nunca é nulo na lista).

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| conformidade-reviewer (1ª), privacy-guardian (1ª) | "Mostrar ao professor a tentativa enviada pelo limite": o lote ainda não mostra qual tentativa foi enviada pelo limite, nem guarda isso no registro da validação (D56); o DTO traz só o `envio` por correção, sem horário de saída nem limite individual na tela da coordenação | É tela e DTO do lote, fora das subtarefas da 6.0; já está no item 12 da autoconferência e em `3_task.md`, "Recomendações sem aplicar". Vai ao Orquestrador no relatório, que dá o dono antes da validação da spec |
| conformidade-reviewer (1ª) | Citar a rotina no `fazSozinha` de `correcao_de_objetiva` (`packages/shared/src/time/funcoes.ts:48`) | `TODO.md`: arquivo que a tarefa não toca e texto lido pela coordenação (regra 70, item 5); o texto de agora não está errado, só não fala do gatilho |
| tenancy-guardian (1ª) | Amarrar `anoLetivoId` no join de `entrega` em `historicoAprovado` (`correcao-de-objetiva.repository.ts:92`) | `TODO.md`: já era assim antes da tarefa e não vaza, porque `correcao` já é filtrada pelo ano; a mutação seria equivalente (nenhum teste ficaria vermelho) |
| privacy-guardian (1ª) | Guarda ou teste que impeça copiar o padrão da pasta `0o777` com tokens (`infra/scripts/carga-prova.ts:312`) | `TODO.md`: hoje está contido e comentado (sessão sintética, pasta apagada no `finally`) |
| infra-guardian (1ª), revisor-geral (1ª) | Laço de 200 em `vencidasDaEscola` (`provas-vencidas.repository.ts`): escola com mais de 200 provas vencidas ainda não no fim efetivo repete as mesmas 200 | `TODO.md`: improvável na escala do piloto; mexe no comportamento do laço, e não só em texto |
| infra-guardian (1ª) | Migration 0069: separar `NOT VALID` e `VALIDATE` | Recusada: o próprio revisor diz que separar não ganha nada sob o `ACCESS EXCLUSIVE`, que segue o precedente da 0056 e da 0060 e que o deploy é fora do horário letivo |
| infra-guardian (1ª) | Custo do gauge: três consultas por prova candidata, até 200 por escola, a cada 5 min | `TODO.md`: "vale medir se o worker-lote ficar disputado"; hoje aceitável |
| test-engineer (1ª) | (j), (l) e (c) passando pelas rotas reais (`rotas.estender`, o tique do `PulsoRepository`, o PUT) com `WriteBlockTrigger`, em vez do SQL à mão | `TODO.md`: reescreve três casos e a `cenarios.md` §3 descreve a ordem forçada nas tabelas, que os casos já forçam; não muda o que a tarefa entrega |
| tenancy-guardian (2ª) | O formato UUID de `escolasComProvaVencida` poderia ser um `toEqual` com a lista exata das escolas do caso (`encerrar-provas.int.test.ts:828`) | `TODO.md`: o revisor diz que não bloqueia; o caso hoje só confere que o retorno é id |
| conformidade-reviewer (2ª), privacy-guardian (2ª) | O lote ainda não mostra ao professor qual tentativa foi enviada pelo limite, e o registro da validação (D56) não guarda isso | Orquestrador, no relatório: é tela e DTO do lote, fora das subtarefas da 6.0 (já no item 12 da autoconferência e em `3_task.md`); precisa de dono antes da validação da spec |
| conformidade-reviewer (2ª) | `fazSozinha` de `correcao_de_objetiva` (`packages/shared/src/time/funcoes.ts:48`) dizer que a prova que vence é encerrada sozinha e que a nota continua com a professora | `TODO.md` (já anotada na r1): arquivo que a tarefa não toca e texto lido pela coordenação (regra 70, item 5) |
| privacy-guardian (2ª) | `encerramento.ts:53`: `leituraDesde(desde ?? new Date())` usa a hora da máquina; o comentário poderia dizer que serve só para cortar a leitura | `TODO.md`: o resultado não muda sem tentativa, só o comentário |
| infra-guardian (2ª), revisor-geral (2ª), test-engineer (2ª) | O sorteio de 0 a 5 s na volta da rede está no k6, mas o app só o ganha na 12.0/12.3 (`fila-de-respostas.ts:172` chama `tryTodas` na hora; `ESPERA_MAXIMA_NA_VOLTA_DA_REDE_MS` não existe). `cenarios.md:167`, `runbook.md` e o cabeçalho do k6 dizem que o `carga-prova.test.ts` confere a constante, e a linha "Carga [C]" não avisa que a rodada mediu um cliente mais gentil que o app de hoje | Tarefa 12.0 (subtarefa 12.3): conferir a constante no `carga-prova.test.ts` e rodar a carga de novo depois dela (já no `12_task.md`). Os três textos passam a dizer "a partir da 12.3" quando a 12.0 tocar neles. O aviso entrou na linha "Carga [C]" desta tarefa |
| infra-guardian (2ª), revisor-geral (2ª) | `techspec.md:174` cita o PUT da volta com p95 de "1,62 s"; a rodada que vale mediu 4,98 s (`put_da_volta_ms`) | `TODO.md`: texto da Tech Spec, que só muda por triagem do Arquiteto |
| infra-guardian (2ª) | `cenarios.md:182` fala do 503 com `Retry-After`, mas `registrarFalha` do k6 (`prova-online.js:115-118`) aceita o 503 sem olhar o cabeçalho | `TODO.md`: muda o script de carga e exigiria nova rodada registrada |
| infra-guardian (2ª), revisor-geral (2ª), test-engineer (2ª) | O load antes dos controles negativos não foi lido | Registrado: "O load da partida dos controles não foi lido" já está na linha "Carga [C]". Na próxima corrida de carga, ler o load também antes dos controles (`TODO.md`, junto da 12.0) |
| infra-guardian (2ª) | `put_fluxo_normal_na_volta_ms` teve p95 de 2,78 s na rodada verde: é o que o aluno sem fila sente por cerca de 60 s depois de uma reinicialização | `TODO.md`, na entrada da medida do pool em 20 por instância: citar o número para a decisão da N2 |
| revisor-geral (2ª) | `6_task.md`, "Divergências resolvidas nesta tarefa": faltam o critério dividido (decisão do Joaquim, N = 60 s) e a janela da volta (opção A), já na `cenarios.md` §5 e na `techspec.md` §7c; e a autoconferência, item 8, diz "as duas linhas" quando a seção tem quatro; e "O script k6 não foi mexido pelo Implementador" não diz que o k6, o `conferir-carga-prova.ts` e o teste mudaram pela mão do Arquiteto | Aplicada neste documento, com Edit, antes do commit (só texto do `6_task.md`, que não caduca revisor): as duas linhas entraram em "Divergências resolvidas", o item 8 da autoconferência foi corrigido e a linha "Carga [C]" diz quem mexeu no k6 |
| test-engineer (2ª) | A largura da janela da volta (`FIM_DA_JANELA_DA_VOLTA_S = FIM_DA_QUEDA_S + LIMITE_DA_VOLTA_S`) não é guardada por teste: o `constante()` do `carga-prova.test.ts` só lê literal; se alguém a alargar, nada fica vermelho | `TODO.md`: mexe em teste e script de carga já com registro válido; hoje o controle de 600 ms ainda reprovaria |
| test-engineer (2ª) | O controle `fila_da_volta` (APIs fora por 150 s) reprova por construção; `cenarios.md` §5 diz "o controle de 150 s prova isso" | `TODO.md`: texto da `cenarios.md`, que só muda por triagem do Arquiteto |
| test-engineer (2ª) | No primeiro caso da (e), o vermelho sem `for update` vem da espera (`esperarNaTrava` estoura), não da asserção `auditorias(id) === 0` | Sem ação: o revisor diz que o vermelho está correto e que não precisa mudar nada |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-27 08:38:10 | 2026-11-27 08:39:32 | `tenancy-guardian` | 1 | APROVADO | af1d6790fffb03b72 |
| 2026-11-27 08:38:18 | 2026-11-27 08:39:56 | `conformidade-reviewer` | 1 | APROVADO | ac6b5870134c7175e |
| 2026-11-27 08:38:50 | 2026-11-27 08:40:25 | `privacy-guardian` | 1 | APROVADO | ae86941f5a389cc83 |
| 2026-11-27 08:38:26 | 2026-11-27 08:41:56 | `infra-guardian` | 1 | REPROVADO | adec36b5b7095761b |
| 2026-11-27 08:38:34 | 2026-11-27 08:42:12 | `test-engineer` | 1 | REPROVADO | a54b3e932b8728bd1 |
| 2026-11-27 08:38:42 | 2026-11-27 08:42:15 | `revisor-geral` | 1 | REPROVADO | a6e50295621695ade |
| 2026-11-27 22:19:53 | 2026-11-27 22:20:40 | `tenancy-guardian` | 2 | APROVADO | ae056498282c46274 |
| 2026-11-27 22:19:59 | 2026-11-27 22:20:54 | `conformidade-reviewer` | 2 | APROVADO | ac57a63fe7858b921 |
| 2026-11-27 22:20:04 | 2026-11-27 22:20:54 | `privacy-guardian` | 2 | APROVADO | a40bbed5299f2dad2 |
| 2026-11-27 22:20:13 | 2026-11-27 22:22:11 | `infra-guardian` | 2 | APROVADO | a0c6b3e109c459d63 |
| 2026-11-27 22:20:31 | 2026-11-27 22:22:48 | `revisor-geral` | 2 | APROVADO | a95d376c0244b79f6 |
| 2026-11-27 22:20:22 | 2026-11-27 22:23:39 | `test-engineer` | 2 | APROVADO | afcad5b742e7fc20f |
