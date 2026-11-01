# Achados das revisões — `tasks/prd-nomes-de-mercado/8_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-10-31 14:42:54 · `tasks/prd-nomes-de-mercado/8_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum mudou. Nenhum dos 192 arquivos alterados grava em `nota` ou toca em `lancadaPor`/`lancada_por`. Isso inclui os jobs do worker, o despachante, o realtime e o apoio de teste de `apps/api/test/`. Todos com autor humano? sim, porque esta onda não abre nem altera caminho de escrita.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. Em `apps/api/src/entrega/entrega.int.test.ts`, `apps/api/src/artefato/artefato.int.test.ts` e `apps/api/src/atividade/correcao/correcao.int.test.ts` só mudaram nomes de tipo e de fixture (`SessaoDeTeste` → `TestSessao`, `BancadaDeSessoes` → `SessaoFixtures`, `ApiDeTeste` → `TestApi`). Nenhuma asserção mudou.

Supervisão do tutor: ok. `apps/api/src/tutor/tutor.int.test.ts` e `apps/api/src/tutor/tutor-modelo.int.test.ts` só trocaram tipos e o modelo falso (`subirModeloDeMentira` → `startFakeModel`, `ambienteDoModeloDeMentira` → `fakeModelEnv`). As consultas SQL a `mensagem_tutor` e `sinal_tutor` continuam idênticas.

Autonomia declarada e visível: sim. `apps/api/src/governanca/governanca.int.test.ts` e `apps/api/src/governanca/analista.int.test.ts` só renomearam tipos. Continuam o filtro `funcao: 'tutor_com_o_aluno'` e os casos de D45 e D64.

Bloqueantes: nenhum.

O que conferi, em cada arquivo alterado de `apps/` e `infra/`:
- **Linhas:** cada arquivo de código tem o mesmo número de linhas adicionadas e removidas. Só `8_task.md` e `travas.md` crescem, e são documentos.
- **Textos dos casos:** os títulos de `describe`/`it`/`test` antes e depois são idênticos em todos os arquivos.
- **Asserções:** a contagem de `expect(`/`assert` é a mesma antes e depois em todos os arquivos.
- **Casos desligados:** nenhum `.skip`, `.only`, `.todo`, `xit` ou `xdescribe` foi introduzido.
- **Execução dos testes:** nenhum `vitest.config`, `package.json` ou `tsconfig` mudou, então nenhum teste saiu da coleta.
- **Textos entre aspas:** fora dos comentários, só mudaram:
  - nomes de erro: `'FalhaDeJob'` → `'JobFailureError'`, `'ErroParaAFila'` → `'QueueFacingError'`, `'PrazoDaFilaEsgotado'` → `'QueueTimeoutError'`;
  - tokens de injeção de dependência do realtime: `REALTIME_DB_POOL`, `REALTIME_REDIS_CLIENT`, `IDENTITY_CONFIG`, `REALTIME_LOGGER`, `SESSAO_READER`.

  Os nomes de erro mudaram juntos na classe e nos testes que os conferem (`apps/worker/test/expurgo-da-escola.int.test.ts:1208,1213` e `apps/worker/test/expurgo-de-acesso.int.test.ts:814`). Nenhum dos dois grupos toca em nota, aprovação, tutor ou governança.
- **`docs/regulacao.md`:** não foi tocado nesta tarefa.

Recomendações:
- Os nomes de erro que mudaram estão no campo `name` dos erros, e esse campo pode aparecer em log ou em registro de falha de job. Não é assunto da regra 70, mas vale o `privacy-guardian` ou o revisor de observabilidade confirmar que nenhum painel ou alerta filtra pelos nomes antigos.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/src/entrega/entrega.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/src/tutor/tutor.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/api/src/governanca/governanca.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/worker/src/job-failure.error.ts

## privacy-guardian · 1ª rodada · APROVADO · 2026-10-31 14:43:45 · `tasks/prd-nomes-de-mercado/8_task.md`

VEREDITO: APROVADO

A tarefa só troca nomes de código. Nada mudou no que o sistema guarda sobre aluno, no que mostra, no que registra em log ou no que manda ao provedor de IA.

**Campos pessoais tocados:** nenhum. O mapa `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/mapas/8.json` tem 148 entradas e todas são troca de nome de símbolo. Comparei palavra por palavra as linhas tiradas e as postas em todos os arquivos alterados de `apps/` e `infra/`. Todo nome que mudou está no mapa. As três exceções não mexem em dado:
- `despachante` e `relay` aparecem só em comentário de `outbox-relay.test.ts`;
- `as` sumiu porque o alias saiu de `apps/worker/test/queue.fixture.ts`, como o documento da tarefa registra.

**Fora da tabela de dados do docs/lgpd.md:** nenhum, porque não entrou campo novo.

**Autorização por objeto:** ok. Nenhuma rota, guarda ou consulta mudou. Os testes de isolamento e de acesso da API só trocaram nomes de tipo e de fixture (por exemplo `BancadaDeSessoes` → `SessaoFixtures`, `ApiDeTeste` → `TestApi`). Nenhuma asserção mudou.

**Logs:** limpos. Nenhum nome de evento de log mudou (`job.*`, `correcao.*` e os demais). Fila, cron e fuso continuam os mesmos (`'agendamentos'`, `'America/Sao_Paulo'`). Nenhuma variável de ambiente lida mudou de nome; em `infra/compose.yml` mudou só o comentário da linha 380. Fora de comentário, só mudaram estes textos entre aspas:
- **Nome de erro:** `FalhaDeJob` → `JobFailureError`, `ErroParaAFila` → `QueueFacingError`, `PrazoDaFilaEsgotado` → `QueueTimeoutError`. O nome novo aparece no campo `tipo` do resumo de erro gravado em log (`packages/core/src/error/summarize-error.ts:63`). É nome de classe, não dado pessoal. A mensagem que vai ao Redis continua sendo só o código da falha.
- **Descrição dos tokens de injeção do realtime** (`apps/realtime/src/system.gateway.ts:8-10`, `apps/realtime/src/app.module.ts:9-10`). São texto interno de `Symbol()`, usado de forma igual onde o valor é registrado e onde é injetado.

**Auditoria:** presente e sem mudança. As rotinas que limpam dado vencido (`expurgar-*`), apagam os dados de um aluno (`eliminar-titular.ts`) e montam o arquivo pedido pelo titular (`montar-arquivo.ts`) só trocaram o nome dos tipos de dependência e o tipo `Processador` por `JobProcessor`. Os prazos de guarda, a janela da escola, as consultas e a gravação na auditoria ficaram iguais.

**Envio externo:** não mudou. Em `apps/api/src/tutor/tutor-modelo.int.test.ts` só trocaram os nomes do modelo falso (`subirModeloDeMentira` → `startFakeModel`). As consultas a `mensagem_tutor` e `sinal_tutor` continuam idênticas.

**Seed/fixture:** sintético. Os arquivos de apoio de teste mudaram só de nome (`Bancada<X>` → `<X>Fixtures`), sem nenhum dado novo.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `TODO.md:337` ainda cita `FalhaDeJob`. Vale atualizar para `JobFailureError` numa próxima onda ou na retro.
2. Procurei os nomes antigos de erro em `infra/` e no repositório inteiro e não achei nenhum painel ou alerta que filtre por eles. Se houver algum painel fora do repositório, na observabilidade da VM, ele precisa passar a usar os nomes novos. Isso é operação, não LGPD.
3. Sobrou um nome antigo de símbolo fora de texto de caso de teste: `LinhaDeAuditoria`, em `apps/api/test/lista.int.test.ts:136`. O mapa o marca como "fica" em `inventario-adenda-2.md:21`, então está coerente. Os outros nomes antigos que sobraram estão em texto de `describe`, que a tarefa manda manter.

**Pergunta de fechamento:** a resposta à secretaria continua a mesma de antes. Nada que guarda, lista ou monta o arquivo do titular mudou de comportamento: `apps/worker/src/processors/montar-arquivo.ts`, `eliminar-titular.ts` e a auditoria estão como estavam.

## test-engineer · 1ª rodada · REPROVADO · 2026-10-31 14:45:16 · `tasks/prd-nomes-de-mercado/8_task.md`

VEREDITO: REPROVADO

Cenários exigidos:
- RF6: o texto de `describe`, `it` e `test` fica igual.
- Nenhum caso sai e nenhuma asserção muda de sentido.
- Fila, métrica e evento de log ficam com as mesmas strings.
- `@educa/despachante` e `apps/despachante` ficam intactos.
- `Bancada…` e `…-de-teste` dão zero.
- O `conferir` e o `restos` passam.
- Cada ocorrência `trava` do relatório tem linha no `travas.md` e bloco de mutação na tarefa (subtarefa 8.3).

Cobertos:
- **RF6:** no `git diff -U0` de `apps/` e `infra/`, nenhuma linha com `describe(`, `it(`, `test(` (nem `.each`, `.skip`, `.only`, `.todo`) foi alterada, e nenhuma linha de string solta (título de caso quebrado em outra linha) mudou. Os `fica` do relatório (`describe('lerConfiguracao'`, `'ExecutorDeJobs e a vaga'`, `'AvisoDeVagaLivre'`, `'SandboxDeCpu: …'`) estão com o texto antigo, como deve ser.
- **Nenhum caso saiu:** em todos os arquivos de `apps/` e `infra/`, o `--numstat` tem o mesmo número de linhas acrescentadas e tiradas. A diferença do total (1817 contra 1777) vem só do `8_task.md` e do `travas.md`.
- **Só nomes mudaram:** a lista de palavras alteradas (`--word-diff`) tem só identificadores, mais três tipos de string previstos:
  - a descrição dos `Symbol('…')` do realtime;
  - o `this.name` de `JobFailureError`, `QueueFacingError` e `QueueTimeoutError`;
  - o `name: 'FalhaDeJob'` → `'JobFailureError'` em `expurgo-da-escola.int.test.ts:1208,1213` e `expurgo-de-acesso.int.test.ts:814`, que a adenda 1 e o `travas.md:169` autorizam.
- **Strings que ficam:** nenhum nome de fila, métrica ou evento de log mudou, nem `@educa/despachante`.
- **Bancada:** nenhum `Bancada[A-Z]` sobra em `apps/`, `infra/` e `e2e/`. Os `…-de-teste` que sobram são dados de teste (`'equipe-de-teste'`, chaves sintéticas), não nome de peça.
- **Testes rodados:** os unitários de `job-executor.test.ts`, `job-publisher.test.ts` e `synthetic.test.ts` passam (72 de 72).
- **Sem `.skip` novo e sem mock novo.**

Bloqueantes:
1. **`tasks/prd-nomes-de-mercado/8_task.md:107`: a seção "Mutações" diz "Sem mutação", mas a própria onda achou travas.**
   - O `8.relatorio.md` classifica 12 ocorrências como `trava`: linhas 15, 19 a 24, 29, 30 e 33 a 36.
   - A tarefa acrescentou três linhas ao `travas.md`, a 168 (Symbol, forma C), a 169 (`this.name`, formas A e C) e a 170 (`compose.yml`, forma C).
   - O `travas.md:12` diz que "toda prova é um bloco de mutação da onda". A subtarefa 8.3 (`8_task.md:27-28`) manda dar bloco de mutação a cada trava achada. A própria frase da linha 107 ("vale enquanto o relatório não achar trava nova") deixou de valer.
   - Sem os blocos, o portão não provou nada destas travas. A forma A da 169 é a única prova de que os dois testes do expurgo leem o `this.name`, e ela não foi feita.
   - **Correção exigida:** trocar a linha 107 por um bloco por trava, no formato da 7.0 (`7_task.md:93-210`):
     - **forma A**, em `apps/worker/src/job-failure.error.ts:15`: `this.name = 'JobFailureError'` volta a `'FalhaDeJob'`. Os casos que ficam vermelhos são `apps/worker/test/expurgo-da-escola.int.test.ts › permissão: a rotina só roda como rotina do sistema, e o job da escola só no contexto de uma escola` e `apps/worker/test/expurgo-de-acesso.int.test.ts › permissão: só a rotina do sistema expurga; um job de escola com esse tipo falha sem apagar nada`;
     - **forma C** para o `this.name` de `QueueFacingError` (`apps/worker/src/job-executor.ts:156`) e de `QueueTimeoutError` (`apps/despachante/src/job-publisher.ts:27`), para as cinco descrições de `Symbol` (`apps/realtime/src/app.module.ts:9-10`, `apps/realtime/src/system.gateway.ts:8-10`) e para o comentário de `infra/compose.yml:380`. Todas com `teste: tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados`, como a 7.0 fez nas linhas 201 e 210.
2. **`8_task.md:42-52`: a tabela "Testes que provam a regra" não tem linha para as travas 168 a 170.**
   - A 7.0 deu uma linha por trava (`7_task.md:65-68`, por exemplo "`HashDeSenha` em `infra/scripts`, C | mutação | `restos`").
   - **Correção exigida:** acrescentar as três linhas, a forma A citando os dois casos pelo nome e as formas C citando o `restos`.

Recomendações:
- Os checkboxes 8.1 a 8.5 (`8_task.md:25-30`) continuam em `[ ]`, mas o trabalho foi feito. Vale marcá-los ao fechar.
- A coluna "Caso" da tabela de testes está vazia em todas as linhas, como na 7.0. Citar o caso pelo nome (por exemplo `restos.test.ts › a árvore não tem resto dos mapas aplicados`) facilita a validação.
- O bloco de divergências, linhas 76 a 93, junta "Resolvida" com o texto antigo "Aberta". Separar o histórico, ou marcar a entrada antiga como superada, evita confusão.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/8_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/travas.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/mapas/8.relatorio.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/worker/src/job-failure.error.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/worker/test/expurgo-da-escola.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/worker/test/expurgo-de-acesso.int.test.ts

## revisor-geral · 1ª rodada · REPROVADO · 2026-10-31 14:45:46 · `tasks/prd-nomes-de-mercado/8_task.md`

VEREDITO: REPROVADO
Escopo: incompleto
Aderência à Tech Spec: divergência em §10 (mutação por trava) e no procedimento de `tasks.md`, passo 5
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")

Bloqueantes:

- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/8_task.md:107`: a seção "Mutações" ainda diz "**Sem mutação:** rename, sem condição nova. Vale enquanto o relatório não achar trava nova." Só que o relatório achou trava nova, e a própria tarefa já a registrou em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/travas.md:162-170` ("Achadas na 8.0"). São três travas:
  - a descrição dos `Symbol('…')` do realtime, forma C;
  - o `this.name` de `FalhaDeJob`, `ErroParaAFila` e `PrazoDaFilaEsgotado`, forma A para `FalhaDeJob` (pelos dois testes de expurgo) e C para os outros dois;
  - o comentário de `infra/compose.yml:380`, forma C.

  A Tech Spec §10 manda "um bloco por trava, numa de três formas". O passo 5 do procedimento diz o mesmo, e a subtarefa 8.3 também ("ganha linha no `travas.md` e bloco de mutação aqui"). Então as subtarefas 8.3 e 8.5 não foram feitas, e a frase que ficou na seção é falsa sobre a própria árvore.

  **Correção exigida:** trocar a linha 107 por blocos ```` ```mutacao ```` no formato da 7.0 (`7_task.md:93-131`):
  - **Forma A:** devolver `this.name = 'JobFailureError'` a `'FalhaDeJob'` em `apps/worker/src/job-failure.error.ts`, apontando os casos de `apps/worker/test/expurgo-da-escola.int.test.ts` (perto das linhas 1208 e 1213) e de `apps/worker/test/expurgo-de-acesso.int.test.ts` (perto da 814) que ficam vermelhos.
  - **Forma C:** um bloco para cada uma das outras (`QueueFacingError` em `apps/worker/src/job-executor.ts:156`, `QueueTimeoutError` em `apps/despachante/src/job-publisher.ts:27`, os cinco `Symbol` de `apps/realtime/src/app.module.ts` e `system.gateway.ts`, e o comentário de `infra/compose.yml:380`), citando `tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados`.

Recomendações:
- `8_task.md`, seção "Divergências resolvidas": o texto original ficou como um item próprio, que abre com "**Aberta, enviada ao Orquestrador**" e diz "Falta trocar `OpcoesDaMontagem`…". Quem lê sem contexto entende que ainda está aberta. Deixe esse texto como citação dentro do item "Resolvida", e não como item do mesmo nível.
- `8_task.md:25-30`: as caixas das subtarefas continuam `[ ]`.
- `apps/api/test/operador-mfa.fixture.ts:19`: ficou "vêm da `OperadorFixtures`", com o artigo de "bancada". Use "das `OperadorFixtures`" ou "do `OperadorFixtures`".
- `apps/despachante/src/outbox-relay.test.ts:25`: na troca à mão, "o despachante" virou "o relay" na prosa. No resto da onda, a prosa continua "despachante" (o serviço fica com esse nome). Use a mesma palavra nos dois lugares.
- A divergência de `publicarComVaga` (`inventario-back.md:368` contra `:566` e `:574`) foi resolvida a favor da tabela. As duas listas que citam o helper como "fica" continuam erradas no inventário: corrigir na 13.0 ou por correção do Arquiteto.

Conferido sem achado:
- `conferir` verde (209.551 itens) e `restos` limpo, os dois rodados agora.
- Cada `para` do `8.json` bate com a linha do inventário que ele cita. Nenhuma linha de `apps/worker/`, `apps/despachante/`, `apps/realtime/` ou `apps/api/test/` em `inventario-back.md` e `inventario-adenda-2.md` ficou sem mapa.
- Em `apps/api/src/`, só mudou o uso do apoio de teste.
- `packages/`, `tools/` (fora dos mapas), `package.json`, as filas, os eventos e os títulos de `describe`/`it`/`test` estão intactos.
- O `LinhaDeAuditoria` local que sobrou segue a regra da adenda 2 para declaração dentro de função.
- A divergência de `OpcoesDaMontagem` já está na Tech Spec §5 (passo 5 e o parágrafo do `de` repetido).

## infra-guardian · 1ª rodada · APROVADO · 2026-10-31 14:48:26 · `tasks/prd-nomes-de-mercado/8_task.md`

VEREDITO: APROVADO
Caminho quente tocado: fila (worker, despachante e realtime, só os nomes)
Rate limit: ok (o limite por escola e a vaga por escola não mudaram)
Fila e prioridade: ok
Concorrência: protegida (a vaga, a renovação e a idempotência do executor não mudaram)
Índice e paginação: ok (não se aplica, a tarefa não tem query nova)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- Três exceções agora se chamam de outro jeito no campo `erro.tipo` do log, que vem de `summarizeError`, porque o `this.name` mudou junto com a classe: `FalhaDeJob` virou `JobFailureError`, `ErroParaAFila` virou `QueueFacingError` e `PrazoDaFilaEsgotado` virou `QueueTimeoutError`. Isso aparece em `job.tentativa_falhou`, em `despachante.publicacao_falhou` e nos outros `erro:` desses dois apps. Nenhum alerta, painel ou runbook lê esse valor: procurei em `infra/grafana/`, `infra/k6/` e `docs/`, e o `job_falhos{tipo}` é o tipo do job, não o da exceção. O `failedReason` do BullMQ continua sendo o código. O efeito é só na busca de log antigo pelo nome antigo. Vale uma linha no runbook na 13.0. O registro está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/travas.md`, seção "Achadas na 8.0".
- O `TODO.md:337` ainda cita `FalhaDeJob`. É documento, então fica para a 13.0.

O que conferi:
- **Strings:** comparei todas as strings que saíram e entraram no diff de `apps/` e `infra/`. Nome de fila, nome de métrica, `evento` de log, variável de ambiente e texto de `describe`, `it` e `test` estão iguais. As únicas strings que mudaram são as dos comentários entre crases, os três `this.name` acima, o `name:` que dois testes de expurgo esperam desse erro, e as descrições dos `Symbol(...)` de injeção de dependência do realtime, que nenhum teste lê.
- **Números:** nenhum literal numérico mudou. O `SHUTDOWN_GRACE_MS` continua 20_000, e o `shutdown.test.ts` o compara com o `stop_grace_period: 25s`.
- **Identificadores:** todo identificador que mudou é de uma entrada do `8.json`. A única troca fora do mapa é o alias `OpcoesDoDespachante` que saiu, e ela está registrada na tarefa.
- **Compose:** rodei `docker compose config` com o `.env.example`, no `infra/compose.yml` de antes (HEAD) e no de agora. As duas saídas têm 925 linhas e são idênticas.
- **Tipos:** `tsc --noEmit` sem erro em `apps/worker`, `apps/despachante`, `apps/realtime`, `apps/api` e `infra`.
- **Testes:** os de unidade de worker, despachante e realtime passaram (218 casos), e a integração do worker também (`--project integracao apps/worker/test/`, 286 casos).

Ao rodar o `docker compose config`, um comando meu criou por engano o arquivo `infra/compose.yml.old-audit`. Apaguei logo em seguida, e o `git status` de `infra/` voltou a mostrar só os arquivos da tarefa.

## test-engineer · 2ª rodada · APROVADO · 2026-10-31 15:49:00 · `tasks/prd-nomes-de-mercado/8_task.md`

VEREDITO: APROVADO

Cenários exigidos: o rename não muda nenhum caso (RF7, pelo `conferir`); nada sobra em código (pelo `restos`); as strings de fila, métrica e evento de log não mudam; o texto de `describe`, `it` e `test` não muda (RF6); e cada trava achada na onda tem o seu bloco de mutação. As travas são três linhas do `travas.md`, 168 a 170, com 12 ocorrências `trava` no `8.relatorio.md`:
- **Forma A:** o `this.name` de `JobFailureError`, prova pelos dois testes do expurgo.
- **Forma C:** o `this.name` de `QueueFacingError` e de `QueueTimeoutError`, as cinco descrições de `Symbol` do realtime e o comentário de `infra/compose.yml:380`.

Cobertos:
- **Correção 1 da 1ª rodada, feita.** A seção "Mutações" (`8_task.md:110-198`) agora tem um bloco por trava, no formato da 7.0:
  - **Forma A:** dois blocos sobre `apps/worker/src/job-failure.error.ts`, um por teste. Os dois casos existem com esses nomes, em `apps/worker/test/expurgo-da-escola.int.test.ts:1205` (o `name` esperado está nas linhas 1208 e 1213) e em `apps/worker/test/expurgo-de-acesso.int.test.ts:809` (`name` na 814). Os dois esperam `name: 'JobFailureError'`, então o nome antigo `'FalhaDeJob'` os deixa vermelhos pela cláusula certa.
  - **Forma C:** um bloco para `apps/worker/src/job-executor.ts:156`, um para `apps/despachante/src/job-publisher.ts:27`, cinco para os `Symbol` (`apps/realtime/src/app.module.ts:9-10` e `apps/realtime/src/system.gateway.ts:8-10`) e um para `infra/compose.yml:380`. Todos citam `tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados`.
  - Conferi com grep que a linha `-` de cada bloco é igual, caractere por caractere, à linha atual da árvore. Assim o portão consegue aplicar cada mutação.
- **Correção 2 da 1ª rodada, feita.** A tabela "Testes que provam a regra" (`8_task.md:53-56`) ganhou as três linhas novas. A da forma A cita os dois casos pelo nome, e as da forma C citam o `restos`. Elas batem com a coluna "Forma" do `travas.md:168-170`.
- **O diff de código desde a rodada aprovada** é de duas linhas de comentário: `apps/api/test/operador-mfa.fixture.ts:19` e `apps/despachante/src/outbox-relay.test.ts:22`. Nenhuma toca condição nem asserção, e não há `.skip`, teste comentado nem mock novo.
- **IA e concorrência:** a onda não chama provedor de IA, então o adaptador falso não se aplica. O rename não cria operação que possa acontecer duas vezes ao mesmo tempo, então não cabe teste de concorrência.

Bloqueantes: nenhum.

Recomendações:
- O texto da linha 169 do `travas.md` ainda descreve a trava pelos nomes antigos (`FalhaDeJob`, `ErroParaAFila`, `PrazoDaFilaEsgotado`). Está coerente, porque descreve o que a trava lê, mas citar também o nome novo ajudaria a busca. Isso fica para a 13.0 (documentos).
- O token `SESSAO_READER` continua com nome meio em português e meio em inglês. Foi decisão do inventário e não desta auditoria; registro só para a retro.

Arquivos que olhei:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/8_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/travas.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/.processo/ordens/8_task-diff-r2-limpo.patch

## revisor-geral · 2ª rodada · APROVADO · 2026-10-31 15:49:07 · `tasks/prd-nomes-de-mercado/8_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum
Recomendações: nenhuma nova. As da 1ª rodada que ficaram sem aplicar estão na tabela "Recomendações sem aplicar" do `8_task.md`, cada uma com destino ou motivo.

Nesta rodada auditei só o diff e confirmei que a correção pedida foi feita.

**Correção 1 (`8_task.md:107`): feita.** A linha "Sem mutação" saiu. No lugar há dez blocos ```mutacao no formato da 7.0, um por trava das três linhas de "Achadas na 8.0" (`travas.md:168-170`). Conferi cada bloco contra a árvore:

- **Forma A, `this.name` de `JobFailureError`:** o `-` bate com `apps/worker/src/job-failure.error.ts:15`. Os dois casos citados existem com esse título exato, em `apps/worker/test/expurgo-da-escola.int.test.ts:1205` e `apps/worker/test/expurgo-de-acesso.int.test.ts:809`. Os dois esperam `name: 'JobFailureError'` (linhas 1208, 1213 e 814). Com a string de volta a `'FalhaDeJob'`, os dois ficam vermelhos.
- **Forma C, nome de `QueueFacingError` e `QueueTimeoutError`:** os blocos batem com `apps/worker/src/job-executor.ts:156` e `apps/despachante/src/job-publisher.ts:27`.
- **Forma C, `Symbol` do realtime:** os cinco blocos batem com `apps/realtime/src/app.module.ts:9-10` e `apps/realtime/src/system.gateway.ts:8-10`.
- **Forma C, comentário do compose:** o bloco bate com `infra/compose.yml:380`.
- **O teste das formas C existe e alcança essas trocas:** `tools/renomear/restos.test.ts:330` tem o caso "a árvore não tem resto dos mapas aplicados". O `restos.ts` busca em string e em comentário, e o `tools/renomear/mapas/8.json` tem as entradas `FalhaDeJob`, `CLIENTE_REDIS_REALTIME` e `GRACA_DO_DESLIGAMENTO_MS`. As quatro linhas novas da tabela de testes e a "Autoconferência" dizem o mesmo que os blocos.

**Recomendações que a Mesa mandou aplicar: aplicadas.**
- A divergência "Aberta" virou citação dentro do item "Resolvida".
- As caixas 8.1 a 8.5 estão marcadas.
- `apps/api/test/operador-mfa.fixture.ts:19` diz "das `OperadorFixtures`".
- `apps/despachante/src/outbox-relay.test.ts:25` diz "despachante".

Arquivos conferidos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/8_task.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/travas.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/7_task.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/.processo/ordens/8_task-diff-r2-limpo.patch`
