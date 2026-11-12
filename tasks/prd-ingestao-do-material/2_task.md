# Tarefa 2.0 — Nenhum PDF fica para trás: `envio_de_material`, objeto antes da linha, varredura horária

**Funcionalidade:** ingestao-do-material · **Depende de:** 1.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

Todo objeto que o envio grava sai do storage, mesmo sem commit: a linha de `envio_de_material` nasce antes do
`guardarBytes` e sai na transação; a varredura horária limpa o que sobrou depois de 1 h, e o órfão pós-commit em 25 h.

## Contexto necessário

- `techspec.md` §3 (`envio_de_material`), §5 "Envio e edição" (2) a (4), §6, §7c
- `prd.md` RF13
- `tasks/prd-reengenharia/onda-3b.md` "3. Falha": "Órfão" e "Órfão em duas escolas"
- `cenarios.md` "Envio, séries e licença no envio": as linhas do objeto e da varredura
- `.claude/rules/` 10 (item 9), 20 (item 7), 40, 80
- Código: o envio em `apps/api/src/material/material.service.ts`; `apps/worker/src/job-schedules.ts`; `packages/core/src/db/unscoped.decorator.ts`

## Subtarefas

- [x] 2.1 — Migration: `envio_de_material` (pk composta, FK da escola); classificação `sem_pessoa`
- [x] 2.2 — Id UUIDv7, a linha, depois o `guardarBytes` com prazo; a transação apaga a linha sob `lock_timeout` curto, ou desfaz com 503
- [x] 2.3 — O `catch`: falha do `guardarBytes` tenta apagar o objeto e deixa a linha; falha depois apaga o objeto (ausente conta) e só então a linha; `apagar` que falha deixa a linha
- [x] 2.4 — Varredura horária (fila `lote`): linhas de mais de 1 h, `for update skip locked`, no contexto de cada escola, objeto e depois linha, prazo curto; e o órfão pós-commit (25 h). `@Unscoped` com a justificativa no mesmo método (R6)
- [x] 2.5 — Log da varredura; `docs/lgpd.md` e `docs/modelo-de-dados.md`
- [x] 2.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0050_*.sql`, `packages/core/src/material/envio.repository.ts`, `apps/worker/src/processors/varrer-envios.ts`, `apps/api/test/material-envio-orfao.int.test.ts`, `apps/worker/test/varrer-envios.int.test.ts` | novo (o repository saiu como `envio-de-material.repository.ts`, mais `varredura.repository.ts`: ver as divergências) |
| `packages/core/src/db/schema/material.ts`, `packages/core/src/material/index.ts`, `packages/shared/src/system/job-definitions.ts`, `packages/shared/src/privacidade/classificacao.ts`, `apps/api/src/material/material.service.ts`, `apps/api/src/material/material.repository.ts`, `apps/worker/src/composition.ts`, `apps/worker/src/job-schedules.ts`, `docs/lgpd.md`, `docs/modelo-de-dados.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| caminho feliz | I | a linha existe antes do `guardarBytes` e não sobra | `material-envio-orfao.int.test.ts` › "caminho feliz: a linha existe antes do `guardarBytes` e não sobra depois do commit" |
| `CONFLITO` depois do `guardarBytes` | I | objeto e linha apagados. Mutação: tirar o apagar do `catch` | `material-envio-orfao.int.test.ts` › "`CONFLITO` depois do `guardarBytes`: o objeto e a linha saem" |
| `LIMITE_EXCEDIDO` sob a trava | I | objeto e linha apagados | › "`LIMITE_EXCEDIDO` reconferido sob a trava: o objeto e a linha saem" (o teto enche dentro do `guardarBytes`, depois da conferência da entrada) |
| commit forçado a falhar | I | objeto e linha apagados | › "o commit forçado a falhar: o objeto e a linha saem, e nada fica em `material`" (gatilho `deferrable initially deferred` que lança no commit) |
| `guardarBytes` estoura o prazo e grava depois do `apagar` | I | 503, a linha fica; 61 min, a varredura apaga. Mutação: apagar a linha nesse `catch` | › "o `guardarBytes` estoura o prazo e o objeto chega depois do `apagar`: 503, a linha fica, e a varredura das 61 min apaga o objeto e a linha" (com 59 min a linha fica; o PUT que chegou antes do `apagar` do `catch` sai na hora) |
| `CONFLITO` com o `apagar` falhando | I | a linha fica. Mutações: linha antes do objeto; não conferir o `apagar` | › "`CONFLITO` com o `apagar` falhando: o objeto e a linha ficam, o log diz só o id, e a varredura apaga os dois"; e, para a linha que não sai, › "a linha do envio que não sai (o `delete` falha): a recusa continua sendo a resposta…" |
| `apagar` falha uma vez na varredura | I | sai na hora seguinte | `varrer-envios.int.test.ts` › "o `apagar` falhando uma vez: a linha e o objeto ficam, o job falha para a fila repetir, e na hora seguinte saem"; e › "o `apagar` que não responde estoura o prazo curto" |
| queda antes do commit | I | 59 min fica, 61 min sai, mesmo `Clock`. Mutação: tirar a leitura da tabela | › "com 59 min a linha e o objeto ficam, com 61 min saem: a linha e a varredura leem o mesmo `Clock`" |
| linha sem objeto | I | sai sem erro | › "linha sem objeto (a queda foi antes do upload): sai sem erro" |
| a varredura apagou a linha de um envio lento | I | 503, nada em `material`. Mutação: não conferir o `delete` | `material-envio-orfao.int.test.ts` › "a varredura apagou a linha de um envio lento: 503, e nada em `material`"; e, para a varredura que ainda segura a linha, › "a varredura segurando a linha do envio: o envio espera pouco (`lock_timeout`), desfaz com 503…" |
| [P] envio com a linha travada, varredura das 61 min | P | pula, o envio confirma. Mutações: tirar `skip locked`; tirar o travar | `material-envio-orfao.int.test.ts` › "[P] o envio lento com a linha travada: a varredura das 61 min pula a linha e não apaga o objeto, e o envio confirma" (`WriteBlockTrigger` no `delete` da linha); e `varrer-envios.int.test.ts` › "[P] a linha que um envio lento já travou é pulada…" (a transação do envio lento, aberta numa conexão à parte) |
| órfão `pronto` 25 h; 23 h | I | sai; fica | `varrer-envios.int.test.ts` › "`pronto` há 25 h sai e fica registrado; há 23 h, não" |
| órfão `falhou` 25 h, `apagar` da 1.0 falhou | I | sai. Mutação: `processado_em` só no sucesso | › "`falhou` há 25 h com o `apagar` da extração caído: o `processado_em` da falha o leva à varredura, que apaga" (a falha vem do processador de verdade, e o relógio da varredura está 25 h adiante) |
| órfão excluído 25 h; `processando` 25 h; de antes da migration | I | sai; fica; não entra | › "excluído há 25 h sai; `processando` há 25 h mantém o objeto; o de antes da migration (`objeto_apagado_em` preenchido) não entra" |
| isolamento: duas escolas | I | cada `apagar` no contexto da sua. Mutação: um contexto só | `varrer-envios.int.test.ts` › "duas escolas: cada `apagar` roda no contexto da sua, com a chave dela" (a linha) e › "duas escolas: cada `apagar` roda no contexto da sua e a marca vai só para a linha dela" (o órfão); o repository, com a B no contexto da A: › "o repository da linha, com a escola A no contexto, não alcança a linha da B…", › "`apagarNoEnvio` e `apagar` tiram só a linha do id…", › "o repository da extração, com a escola A no contexto, não marca o objeto da B como apagado" |
| falha numa escola | I | as outras seguem | › "a falha numa escola não segura as outras: a da B sai, a da A fica, e o job falha no fim" |
| o `@Unscoped` | U | a guarda acha a justificativa estática (30 caracteres ou mais) nos dois métodos; a leitura devolve só escola e id (R6) | `tools/guardas/repositories-com-escopo.test.ts` › "todo método público real tem (a) a prova do contexto, (b) @SemEscopo com motivo ou (c) a entrada na lista" (a guarda lê as duas leituras de `varredura.repository.ts`); e `varrer-envios.int.test.ts` › "as duas leituras `@Unscoped` têm a justificativa escrita e devolvem só a escola e o id" |
| o corte do job e o storage fora do ar | I | o `sinal` abortado: nenhum `apagar` a mais, a transação desfaz e a linha fica livre; o storage fora (3 falhas seguidas em duas escolas): três `apagar`, nas duas passadas; uma chave que falha sempre numa escola só não para as outras; o alvo que passa zera a conta; erro que não é do storage não conta. Mutações: tirar a leitura do `sinal`, o limite, a regra das duas escolas, o zerar da conta | `varrer-envios.int.test.ts` › "o `sinal` já abortado: nenhum `apagar` é chamado…", › "o `sinal` aborta com o armazém mudo…" (a linha fica livre por `for update nowait`), › "o storage fora do ar (3 falhas seguidas, em duas escolas) para a passada…", › "o storage fora do ar também para a passada do objeto que sobrou…", › "uma chave que falha sempre, mesmo em vários alvos de uma escola só, não para as outras…", › "o alvo que passa zera a conta…" e › "falha que não é do storage não conta como storage fora…" (o erro é o que o `S3FileStorage` lança de fato) |
| a espera de 1 s do envio | U | `ESPERA_MAXIMA_PELA_LINHA_DO_ENVIO_MS` é 1 s e menor que o `statement_timeout` da API. Mutação: 2,5 s | `packages/core/src/material/envio-de-material.repository.test.ts` › "é de 1 s, e menor que o `statement_timeout` da API…" |
| log da varredura | I | ids e contagens, nunca título, arquivo, licenciante | `varrer-envios.int.test.ts` › "o log leva só ids e contagens: nunca título, arquivo, licenciante nem a chave do objeto"; e `material-envio-orfao.int.test.ts` › "`CONFLITO` com o `apagar` falhando…" (o aviso do envio leva só o `materialId`) |

## Como testar

- Envio: `apps/api/test/material.int.test.ts` › "na mesma escola é `CONFLITO`…" e › "a pessoa no teto recebe `LIMITE_EXCEDIDO`…"; `InMemoryFileStorage` com `guardarBytes` que grava depois de um sinal
- Trava: `WriteBlockTrigger` e `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`), como `suboperador.int.test.ts` › "concorrência: dois encerramentos…"
- Varredura: `rodar(escolaId, processador)` de `apps/worker/test/expurgo-da-escola.int.test.ts`; `RelogioMovel` (`apps/worker/test/enviar-email-da-conta.int.test.ts:41`)
- Comando: `npx vitest run --project integracao apps/worker/test/varrer-envios.int.test.ts`
- Armadilha: 59 e 61 min do mesmo `Clock`, nunca `Date.now()`

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano. Na 1: cada `catch` e a
ordem objeto→linha.

1. **Cada cláusula do diff tem o seu bloco?** Os blocos estão em "Mutações", um por termo (a linha com `and(...)` ganha um por
   `eq`/`lt`/`isNull`, e a leitura sem escopo, o `limit` e o `orderBy` têm o seu). Os `catch` e a ordem objeto→linha, um a um:
   (a) o `catch` de `#guardarObjeto` tenta apagar o objeto e **deixa a linha** (bloco: tirar o `apagar` dali; caso do `guardarBytes` que grava depois);
   (b) o `.catch` de `enviar` chama `#desfazerEnvio` (bloco: tirar a chamada; e o do `55P03` → 503);
   (c) em `#desfazerEnvio`, o objeto sai **primeiro**, e o `apagar` que falha faz o `return` e **deixa a linha** (blocos: tirar o `return`; apagar a linha antes do `try`; tirar o `.catch` da linha, que deixa a recusa virar 500);
   (d) o `if` do `apagarNoEnvio` na transação (blocos: sem o `if...throw`, sem a instrução inteira);
   (e) a varredura: o objeto sai antes da linha (`apagarComPrazo` e depois `envios.apagar`, um bloco para cada), a linha travada é pulada (`if (!travarParada) return false`), `falhou` conta e o `throw` do fim faz a fila repetir, e o `catch` de cada alvo não segura os outros (caso da falha numa escola);
   (f) o corte e o storage fora do ar (rodada 1): o `sinal` conferido antes de cada alvo (um bloco por termo do `||`), o `catch` que sai sem contar falha quando o `sinal` abortou, o `storageFora` que 3 falhas de storage seguidas em duas escolas ligam (o limite, a regra das duas escolas, o zerar da conta e o `FileStorageUnavailableError` que conta, um bloco para cada), o listener do `sinal` dentro do `apagarComPrazo`, e o `estado` do resumo;
   (g) o `finally` do `apagarComPrazo` (`clearTimeout`, `removeEventListener`) e o `if (sinal.aborted) aoAbortar()` não têm bloco: só desarmam o relógio e o listener, e o segundo só vale se o `sinal` abortar entre o laço e o `apagar`, uma janela que o teste não alcança. Sem bloco, com motivo, em "Mutações".
2. **O texto que entra na tela já aparece nela?** Não há tela nem texto novo: a tarefa não toca `apps/web`.
3. **O cenário tem o segundo dado?** Duas escolas em toda leitura (a B tem a linha e o objeto; o contexto é o da A); linha de 59 e de 61 min do **mesmo** `Clock`;
   material `pronto` de 23 e de 25 h, `falhou`, excluído, `processando` e o de antes da migration (`objeto_apagado_em` preenchido); mais alvos que o lote.
4. **Alguma checagem anterior responde antes?** O envio precisa passar pela assinatura, pelos tetos e pela licença até o `guardarBytes`; cada caso de `material-envio-orfao`
   prova com um gancho **dentro** do `guardarBytes` que a linha já existia, então não cai numa recusa de entrada. A varredura cai em `rotinaDoSistema` antes de tudo, e os
   casos rodam como rotina do sistema (o caso de "só roda como rotina do sistema" é o único fora).
5. **A asserção olha o resultado?** Olha o banco (`envio_de_material`, `material`, `objeto_apagado_em`) e o armazém (`existe`/`bytes`), nunca o código. As de ausência vêm depois do
   `await rodar(...)` ou da resposta que poderia trazê-las, e os blocos com asserção negativa levam `falha:`.
6. **A guarda nova tem fixture de quem a contorna?** Nenhuma guarda nova: as duas leituras `@Unscoped` entram na guarda existente (`tools/guardas/repositories-com-escopo.test.ts`, que lê a justificativa estática)
   e na `architecture.test.ts` (a classificação da tabela nova, com bloco de mutação).
7. **Algum comentário afirma o que o código não faz?** Relidos: o docblock de `enviar` e o de `#guardarObjeto` (a falha do `guardarBytes` deixa a linha), o de `travarParada` ("só dentro da transação"),
   o de `criarVarreduraDeTemporarios` (a falha de um alvo não segura os outros, e o job falha no fim) e o do repository da varredura (nada se apaga ali). `criado_em` é o relógio do banco e a varredura lê o `Clock`: dito na divergência.
8. **A divergência cria ou muda regra, e a coluna "Onde está na spec" diz a verdade?** Cria: o `lock_timeout` de 1 s com 503, o job urgente, a falha do job no fim, o lote de 500 e o prazo de 10 s, as duas leituras `@Unscoped`.
   Cada uma ganhou a linha na tabela de testes (ou o caso no `cenarios.md`) e a palavra do código está na Tech Spec (`grep -n "lock_timeout\|urgente\|500\|10 s\|varredura.repository\|envio-de-material" techspec.md cenarios.md`, conferido).
   Para o `infra-guardian`: quem chama é o worker da fila `lote`, sem entrada de fora; 1 vez por hora por réplica, até 500 alvos em cada passada; grava só `delete` em `envio_de_material` e `objeto_apagado_em`.
9. **Qual peça existente faz isto?** Reaproveitadas: `chaveDoTemporario`, `uuidV7`, `FileStorage.apagar`, `ExtracaoDoMaterialRepository.marcarObjetoApagado`, `postgresErrorIn`, `@Unscoped`, `runInContext`, `Clock`,
   `RelogioMovel`, `WriteBlockTrigger`. Novas: o repository da linha e o das duas leituras da varredura (não havia peça para elas).
10. **A corrida tem as duas direções, com a ordem forçada?** Duas: o envio lento que travou a linha primeiro (a varredura pula, `skip locked`) e a varredura que a travou primeiro (o envio espera 1 s e desfaz com 503),
    ambas com a ordem forçada por `WriteBlockTrigger`/`esperarNaTrava` ou por transação aberta numa conexão à parte, e a soltura por sinal (a linha sumir), não por tempo. Nenhum `Promise.all` solto; 59 e 61 min do mesmo `Clock`.
11. **O teste de isolamento quebraria sem o escopo?** Quebra: o repository roda com a escola A no contexto e o id é da B (`travarParada`, `apagarNoEnvio`, `apagar`, `marcarObjetoApagado`); há um bloco para cada
    `escola_id` tirado. A coluna "Caso" da tabela acima tem um caso para cada coisa que a linha diz.
12. **Os guardiões e o índice dos achados.** Li `achados/indice.md`: da 1.0 pesam aqui a retenção do PDF em `docs/lgpd.md` (atualizada), a asserção de log sem `arrayContaining` onde o conteúdo importa (o caso do log compara a lista de chaves)
    e o "órfão em 25 h" da Tech Spec (conferido: §5, §7 e §11 dizem 1 h para o envio sem commit e 25 h para o pós-commit). `tenancy-guardian`: escopo do contexto em todo método, as duas `@Unscoped` com justificativa,
    teste da B no contexto da A. `privacy-guardian`: a tabela é `sem_pessoa`, o log leva só ids e contagens, `docs/lgpd.md` atualizado. `infra-guardian`: migration só expande (tabela nova, índice em tabela vazia),
    `lock_timeout` de 1 s abaixo do `statement_timeout` de 2 s, varredura idempotente e segura com duas réplicas (`skip locked`), nada em memória, sem alerta novo (então sem parágrafo de runbook).

## Fora do escopo desta tarefa

`LICENCA_VENCIDA` (7.0) e `EDICAO_EM_ANDAMENTO` (8.0) entram nesta suíte nas tarefas delas.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O job `sistema.varrer-temporarios-de-material` é **urgente** (`naoUrgente: false`), no minuto 10 de cada hora (`10 * * * *`), prazo 10 min | rotina leve; uma rotina horária segurada pela janela letiva deixaria o PDF no storage de 7h às 18h, contra o RF13 | `techspec.md` §7c ("Fila e prioridade") e §11, linha "2.0" |
| A falha de qualquer alvo não segura os outros, mas o job falha no fim (a fila repete); o storage fora do ar (3 `FileStorageUnavailableError` seguidos em duas escolas ou mais) e o `sinal` do executor param a execução; uma chave que falha sempre, numa escola só, não para as outras | o `apagar` que não saiu precisa de nova tentativa, e a escola que falha não pode atrasar a outra | `techspec.md` §11, linha "2.0"; `cenarios.md` "Envio...": "Falha numa escola não para as outras" |
| Cada passada trata até 500 alvos, e cada `apagar` tem prazo de 10 s | o lote vezes o prazo de cada `apagar` **não cabe** nos 10 min do job no pior caso (500 × 10 s × 2 passadas); o que garante o corte é o `sinal` do executor e a parada com o storage fora do ar (3 falhas seguidas em duas escolas ou mais), e o resto sai na próxima tentativa ou na hora seguinte | `techspec.md` §5 (4), §7c e §11; `cenarios.md`, o caso do lote (linha nova do "Envio") |
| Duas leituras `@Unscoped`, em `VarreduraDoMaterialRepository`: a de `envio_de_material` e a do órfão pós-commit em `material`; ambas devolvem só escola e id | a varredura precisa achar alvos de todas as escolas; quem apaga roda no contexto da escola, com repositories com escopo | `techspec.md` §6 e §11 |
| A espera pela linha do envio é de 1 s (`lock_timeout`, `ESPERA_MAXIMA_PELA_LINHA_DO_ENVIO_MS`), e o `55P03` vira 503 | menor que o `statement_timeout` da API (2 s), que cortaria antes e daria `57014` | `techspec.md` §5 (3) e §11; `cenarios.md`, o caso "A varredura segurando a linha do envio" |
| `criado_em` da linha é o relógio do banco (`now()`), e a varredura lê o `Clock` do job | o teste de 59/61 min usa o mesmo `Clock` para a linha e para a varredura: as linhas do teste nascem com o `Clock` movido; em produção os dois relógios são o da máquina | `techspec.md` §11, linha "2.0"; `cenarios.md`, o caso "Queda entre o `guardarBytes` e o commit" |
| O repository da linha é `envio-de-material.repository.ts` (a spec dizia `envio.repository.ts`), e as leituras entre escolas ficam em `varredura.repository.ts` | o teste de arquitetura de classes cercadas acusou colisão com o `EnvioRepository` do e-mail; separar as leituras sem escopo deixa as duas `@Unscoped` num arquivo só | `techspec.md` §11, linha "2.0" |

## Mutações

--faltando: 20 linhas (17 blocos, 3 motivos)

Um bloco por termo, na ordem: o repository da linha (a escola e o id de cada `delete`/`select`, o `lock_timeout`, o `for update skip locked`), as duas leituras da varredura, o processador (guarda de rotina do sistema, folgas, a ordem objeto→linha, a linha travada, o contexto de cada escola, o fim que falha o job, e, da rodada 1, o `sinal`, o storage fora do ar e o `estado` do resumo), o envio na API (a linha antes do objeto, o `apagarNoEnvio` conferido, o `#desfazerEnvio` e o `catch` do `guardarBytes`, com e sem a linha), a fiação (job urgente, agendamento, composição, classificação) e a espera de 1 s.

Sem bloco, com o motivo:

- `material.service.ts` (`licenciante: pedido.licenciante ?? null`): a linha da 1.0, só reindentada pelo `.transaction(...).catch(...)`; o `??` não mudou nesta tarefa (o `--faltando` a lista só pelo recuo novo), e o caso do envio com `licenciante: null` em `material.int.test.ts` já o cobre.
- `varredura.repository.ts`, `.orderBy(asc(material.id))` e o desempate `asc(envioDeMaterial.materialId)`: a ordem só decide quem sai primeiro quando há mais alvos que o lote, e o caso do lote já prova o `criado_em` (o desempate por id só vale com instantes iguais, que o banco não repete na prática).
- `varrer-envios.ts`, `clearTimeout(relogio)` e `removeEventListener` do `finally` do `apagarComPrazo`: só desarmam o relógio e o listener; sem eles o resultado é o mesmo, e o processo apenas espera o relógio acabar.
- `varrer-envios.ts`, `if (sinal.aborted) aoAbortar()` no `apagarComPrazo`: só vale se o `sinal` abortar entre a conferência do laço e o `apagar`, uma janela de microssegundos que o teste não alcança sem trocar o relógio do processo; o listener, que cobre o aborto durante o `apagar`, tem o seu bloco.
- `material.ts` e a migration 0050: a chave primária composta, a FK da escola e o índice `envio_de_material_criado_em_idx` são estrutura; o índice só dá velocidade à leitura da varredura (a tabela tem as linhas de minutos), e a FK e a chave são cobertas pelo teste de arquitetura e pelos casos que inserem linhas.

```mutacao
arquivo: packages/core/src/material/envio-de-material.repository.ts
teste: apps/worker/test/varrer-envios.int.test.ts › `registrar` grava a escola do contexto
falha: await naEscola(c.escolaId, () => new EnvioDeMaterialRepository(bancada.banco).registrar(id))
-await this.banco.insert(envioDeMaterial).values({ escolaId: requireEscolaId(), materialId })
+await this.banco.insert(envioDeMaterial).values({ escolaId: materialId, materialId })
```

```mutacao
arquivo: packages/core/src/material/envio-de-material.repository.ts
teste: apps/api/test/material-envio-orfao.int.test.ts › a varredura segurando a linha do envio
falha: expect(erroDe(resposta)).toEqual({ status: 503, codigo: ErrorCode.INDISPONIVEL_TENTE_DE_NOVO })
-await this.banco.execute(sql`select set_config('lock_timeout', ${String(ESPERA_MAXIMA_PELA_LINHA_DO_ENVIO_MS)}, true)`)
```

```mutacao
arquivo: packages/core/src/material/envio-de-material.repository.ts
teste: apps/worker/test/varrer-envios.int.test.ts › o repository da linha, com a escola A no contexto
falha: expect(await dentro.apagarNoEnvio(idB)).toBe(false)
-.where(and(eq(envioDeMaterial.escolaId, escolaId), eq(envioDeMaterial.materialId, materialId)))
+.where(and(eq(envioDeMaterial.materialId, materialId)))
```

```mutacao
arquivo: packages/core/src/material/envio-de-material.repository.ts
teste: apps/worker/test/varrer-envios.int.test.ts › `apagarNoEnvio` e `apagar` tiram só a linha do id
falha: expect(await temLinha(c.escolaId, dois)).toBe(true)
-.where(and(eq(envioDeMaterial.escolaId, escolaId), eq(envioDeMaterial.materialId, materialId)))
+.where(and(eq(envioDeMaterial.escolaId, escolaId)))
```

```mutacao
arquivo: packages/core/src/material/envio-de-material.repository.ts
teste: apps/worker/test/varrer-envios.int.test.ts › `apagarNoEnvio` e `apagar` tiram só a linha do id
falha: expect(respostas).toEqual([true, false])
-return apagadas.length > 0
+return true
```

```mutacao
arquivo: packages/core/src/material/envio-de-material.repository.ts
teste: apps/worker/test/varrer-envios.int.test.ts › o repository da linha, com a escola A no contexto
falha: expect(await temLinha(b.escolaId, idB)).toBe(true)
-await this.banco.delete(envioDeMaterial).where(and(eq(envioDeMaterial.escolaId, requireEscolaId()), eq(envioDeMaterial.materialId, materialId)))
+await this.banco.delete(envioDeMaterial).where(and(eq(envioDeMaterial.materialId, materialId)))
```

```mutacao
arquivo: packages/core/src/material/envio-de-material.repository.ts
teste: apps/worker/test/varrer-envios.int.test.ts › `apagarNoEnvio` e `apagar` tiram só a linha do id
falha: expect(await temLinha(c.escolaId, dois)).toBe(true)
-await this.banco.delete(envioDeMaterial).where(and(eq(envioDeMaterial.escolaId, requireEscolaId()), eq(envioDeMaterial.materialId, materialId)))
+await this.banco.delete(envioDeMaterial).where(and(eq(envioDeMaterial.escolaId, requireEscolaId())))
```

```mutacao
arquivo: packages/core/src/material/envio-de-material.repository.ts
teste: apps/worker/test/varrer-envios.int.test.ts › o repository da linha, com a escola A no contexto
falha: expect(await dentro.travarParada(idB, depois)).toBe(false)
-.where(and(eq(envioDeMaterial.escolaId, requireEscolaId()), eq(envioDeMaterial.materialId, materialId), lt(envioDeMaterial.criadoEm, criadaAntesDe)))
+.where(and(eq(envioDeMaterial.materialId, materialId), lt(envioDeMaterial.criadoEm, criadaAntesDe)))
```

```mutacao
arquivo: packages/core/src/material/envio-de-material.repository.ts
teste: apps/worker/test/varrer-envios.int.test.ts › `registrar` grava a escola do contexto
falha: expect(await dentro.travarParada(randomUUID(), new Date(Date.now() + HORA_MS))).toBe(false)
-.where(and(eq(envioDeMaterial.escolaId, requireEscolaId()), eq(envioDeMaterial.materialId, materialId), lt(envioDeMaterial.criadoEm, criadaAntesDe)))
+.where(and(eq(envioDeMaterial.escolaId, requireEscolaId()), lt(envioDeMaterial.criadoEm, criadaAntesDe)))
```

```mutacao
arquivo: packages/core/src/material/envio-de-material.repository.ts
teste: apps/worker/test/varrer-envios.int.test.ts › `registrar` grava a escola do contexto
falha: expect(await dentro.travarParada(id, new Date(Date.now() - HORA_MS))).toBe(false)
-.where(and(eq(envioDeMaterial.escolaId, requireEscolaId()), eq(envioDeMaterial.materialId, materialId), lt(envioDeMaterial.criadoEm, criadaAntesDe)))
+.where(and(eq(envioDeMaterial.escolaId, requireEscolaId()), eq(envioDeMaterial.materialId, materialId)))
```

```mutacao
arquivo: packages/core/src/material/envio-de-material.repository.ts
teste: apps/worker/test/varrer-envios.int.test.ts › a linha que um envio lento já travou
falha: await Promise.race([rodar(relogio), espera])
-.for('update', { skipLocked: true })
```

```mutacao
arquivo: packages/core/src/material/envio-de-material.repository.ts
teste: apps/worker/test/varrer-envios.int.test.ts › a linha que um envio lento já travou
falha: await Promise.race([rodar(relogio), espera])
-.for('update', { skipLocked: true })
+.for('update', {})
```

```mutacao
arquivo: packages/core/src/material/varredura.repository.ts
teste: apps/worker/test/varrer-envios.int.test.ts › com 59 min a linha e o objeto ficam
falha: expect(ultimoResumo()).toMatchObject({ enviosApagadosTotal: 0, enviosPuladosTotal: 0 })
-.where(lt(envioDeMaterial.criadoEm, criadaAntesDe))
```

```mutacao
arquivo: packages/core/src/material/varredura.repository.ts
teste: apps/worker/test/varrer-envios.int.test.ts › o lote limita o que cada execução trata
falha: expect(await temLinha(c.escolaId, maisAntigo)).toBe(false)
-.orderBy(asc(envioDeMaterial.criadoEm), asc(envioDeMaterial.materialId))
```

```mutacao
arquivo: packages/core/src/material/varredura.repository.ts
teste: apps/worker/test/varrer-envios.int.test.ts › o lote limita o que cada execução trata
falha: expect(await temLinha(c.escolaId, maisNovo)).toBe(true)
 .orderBy(asc(envioDeMaterial.criadoEm), asc(envioDeMaterial.materialId))
-.limit(limite)
```

```mutacao
arquivo: packages/core/src/material/varredura.repository.ts
teste: apps/worker/test/varrer-envios.int.test.ts › excluído há 25 h sai
falha: expect(apagadas).not.toContain(chaveDe(c.escolaId, antigo))
-.where(and(isNull(material.objetoApagadoEm), or(lt(material.processadoEm, antesDe), lt(material.excluidoEm, antesDe))))
+.where(and(or(lt(material.processadoEm, antesDe), lt(material.excluidoEm, antesDe))))
```

```mutacao
arquivo: packages/core/src/material/varredura.repository.ts
teste: apps/worker/test/varrer-envios.int.test.ts › `pronto` há 25 h sai
falha: expect(await temObjeto(c.escolaId, velho)).toBe(false)
-.where(and(isNull(material.objetoApagadoEm), or(lt(material.processadoEm, antesDe), lt(material.excluidoEm, antesDe))))
+.where(and(isNull(material.objetoApagadoEm), or(lt(material.excluidoEm, antesDe))))
```

```mutacao
arquivo: packages/core/src/material/varredura.repository.ts
teste: apps/worker/test/varrer-envios.int.test.ts › excluído há 25 h sai
falha: expect(apagadas).toContain(chaveDe(c.escolaId, excluido))
-.where(and(isNull(material.objetoApagadoEm), or(lt(material.processadoEm, antesDe), lt(material.excluidoEm, antesDe))))
+.where(and(isNull(material.objetoApagadoEm), or(lt(material.processadoEm, antesDe))))
```

```mutacao
arquivo: packages/core/src/material/varredura.repository.ts
teste: apps/worker/test/varrer-envios.int.test.ts › o lote limita também os objetos que sobraram
falha: expect([(await linhaDoMaterial(primeiro)).objeto_apagado_em, (await linhaDoMaterial(segundo)).objeto_apagado_em].filter((marca) => marca !== null)).toHaveLength(1)
 .orderBy(asc(material.id))
-.limit(limite)
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › só roda como rotina do sistema
falha: await expect(rodar(relogio, { doSistema: false })).rejects.toMatchObject({ codigo: JobFailureCode.DADOS_INVALIDOS })
-if (contexto?.rotinaDoSistema !== true) throw new JobFailureError(JobFailureCode.DADOS_INVALIDOS, true)
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › com 59 min a linha e o objeto ficam
falha: expect(await temLinha(c.escolaId, id)).toBe(true)
-const linhasAntesDe = new Date(agora - FOLGA_DA_LINHA_DO_ENVIO_MS)
+const linhasAntesDe = new Date(agora)
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › `pronto` há 25 h sai
falha: expect(await temObjeto(c.escolaId, novo)).toBe(true)
-const objetosAntesDe = new Date(agora - FOLGA_DO_OBJETO_QUE_SOBROU_MS)
+const objetosAntesDe = new Date(agora)
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › as folgas são 1 h e 25 h
falha: expect([FOLGA_DA_LINHA_DO_ENVIO_MS, FOLGA_DO_OBJETO_QUE_SOBROU_MS]).toEqual([HORA_MS, 25 * HORA_MS])
-export const FOLGA_DA_LINHA_DO_ENVIO_MS = 60 * 60_000
+export const FOLGA_DA_LINHA_DO_ENVIO_MS = 30 * 60_000
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › as folgas são 1 h e 25 h
falha: expect([FOLGA_DA_LINHA_DO_ENVIO_MS, FOLGA_DO_OBJETO_QUE_SOBROU_MS]).toEqual([HORA_MS, 25 * HORA_MS])
-export const FOLGA_DO_OBJETO_QUE_SOBROU_MS = 25 * 60 * 60_000
+export const FOLGA_DO_OBJETO_QUE_SOBROU_MS = 20 * 60 * 60_000
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › a linha que um envio lento já travou
falha: await Promise.race([rodar(relogio), espera])
-if (!(await envios.travarParada(alvo.materialId, linhasAntesDe))) return false
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › com 59 min a linha e o objeto ficam
falha: expect(await temObjeto(c.escolaId, id)).toBe(false)
 if (!(await envios.travarParada(alvo.materialId, linhasAntesDe))) return false
-await apagarComPrazo(armazem, chaveDoTemporario(alvo.materialId), prazoDoApagarMs, sinal)
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › `pronto` há 25 h sai
falha: expect(await temObjeto(c.escolaId, velho)).toBe(false)
 await naEscola(alvo, async () => {
-await apagarComPrazo(armazem, chaveDoTemporario(alvo.materialId), prazoDoApagarMs, sinal)
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › com 59 min a linha e o objeto ficam
falha: expect(await temLinha(c.escolaId, id)).toBe(false)
-await envios.apagar(alvo.materialId)
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › a linha que um envio lento já travou
falha: expect(ultimoResumo()).toMatchObject({ enviosApagadosTotal: 0, enviosPuladosTotal: 1 })
-if (apagou) andamento.enviosApagadosTotal += 1
+if (!apagou) andamento.enviosApagadosTotal += 1
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › a falha numa escola não segura as outras
falha: await expect(rodar(relogio, { armazemDoCaso: recusaA })).rejects.toThrow('objeto de material não apagado')
-andamento.falhasTotal += 1
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › o `apagar` falhando uma vez
falha: await expect(rodar(relogio, { armazemDoCaso: dele })).rejects.toThrow('objeto de material não apagado')
-if (andamento.falhasTotal > 0) throw new InvariantException('objeto de material não apagado em alguma escola')
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › `pronto` há 25 h sai
falha: expect((await linhaDoMaterial(velho)).objeto_apagado_em).toBeInstanceOf(Date)
-await new ExtracaoDoMaterialRepository(banco).marcarObjetoApagado(alvo.materialId)
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › o `apagar` que não responde estoura o prazo curto
falha: await expect(Promise.race([rodar(relogio, { armazemDoCaso: mudo, prazoDoApagarMs: 50 }), espera]).finally(() => clearTimeout(relogioDaEspera))).rejects.toThrow('objeto de material não apagado')
-await Promise.race([armazem.apagar(chave), interrompido])
+await armazem.apagar(chave)
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › duas escolas: cada `apagar` roda no contexto da sua, com a chave dela
falha: expect(apagadas.toSorted()).toEqual([chaveDe(a.escolaId, idA), chaveDe(b.escolaId, idB)].toSorted())
-const naEscola = <T>({ escolaId }: AlvoDaVarredura, trabalho: () => Promise<T>): Promise<T> => runInContext({ requisicaoId: contexto.requisicaoId, escolaId }, trabalho)
+let umaSo: string | undefined
+const naEscola = <T>({ escolaId }: AlvoDaVarredura, trabalho: () => Promise<T>): Promise<T> => runInContext({ requisicaoId: contexto.requisicaoId, escolaId: (umaSo ??= escolaId) }, trabalho)
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › o `sinal` já abortado
falha: expect(chamadas()).toBe(0)
-if (sinal.aborted || andamento.storageFora) return
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › o `sinal` já abortado
falha: expect(chamadas()).toBe(0)
-if (sinal.aborted || andamento.storageFora) return
+if (andamento.storageFora) return
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › 3 falhas seguidas, em duas escolas
falha: expect(chamadas()).toBe(FALHAS_SEGUIDAS_DO_STORAGE_FORA)
-if (sinal.aborted || andamento.storageFora) return
+if (sinal.aborted) return
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › o `sinal` aborta com o armazém mudo
falha: expect(ultimoResumo()).toMatchObject({ estado: 'cortada', falhasTotal: 0, enviosApagadosTotal: 0 })
-if (sinal.aborted) return 'cortada'
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › 3 falhas seguidas, em duas escolas
falha: expect(chamadas()).toBe(FALHAS_SEGUIDAS_DO_STORAGE_FORA)
-andamento.falhasDeStorageSeguidas.push(alvo.escolaId)
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › 3 falhas seguidas, em duas escolas
falha: expect(chamadas()).toBe(FALHAS_SEGUIDAS_DO_STORAGE_FORA)
-andamento.storageFora = storageForaDepoisDe(andamento.falhasDeStorageSeguidas)
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › falha que não é do storage não conta
falha: expect(chamadas()).toBe(4)
-if (erro instanceof FileStorageUnavailableError) {
+if (erro instanceof Error) {
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › o alvo que passa zera a conta
falha: expect(ultimoResumo()).toMatchObject({ estado: 'completa', falhasTotal: 3, enviosApagadosTotal: 1 })
-andamento.falhasDeStorageSeguidas.length = 0
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › uma chave que falha sempre
falha: expect(chamadas()).toBe(4)
-return escolasDasFalhas.length >= FALHAS_SEGUIDAS_DO_STORAGE_FORA && new Set(escolasDasFalhas).size >= 2
+return escolasDasFalhas.length >= FALHAS_SEGUIDAS_DO_STORAGE_FORA
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › o alvo que passa zera a conta
falha: expect(ultimoResumo()).toMatchObject({ estado: 'completa', falhasTotal: 3, enviosApagadosTotal: 1 })
-return escolasDasFalhas.length >= FALHAS_SEGUIDAS_DO_STORAGE_FORA && new Set(escolasDasFalhas).size >= 2
+return new Set(escolasDasFalhas).size >= 2
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › 3 falhas seguidas, em duas escolas
falha: expect(ultimoResumo()).toMatchObject({ estado: 'storage_fora', falhasTotal: 3, enviosApagadosTotal: 0, objetosApagadosTotal: 0 })
-export const FALHAS_SEGUIDAS_DO_STORAGE_FORA = 3
+export const FALHAS_SEGUIDAS_DO_STORAGE_FORA = 4
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › 3 falhas seguidas, em duas escolas
falha: expect(ultimoResumo()).toMatchObject({ estado: 'storage_fora', falhasTotal: 3, enviosApagadosTotal: 0, objetosApagadosTotal: 0 })
-export const FALHAS_SEGUIDAS_DO_STORAGE_FORA = 3
+export const FALHAS_SEGUIDAS_DO_STORAGE_FORA = 2
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › o `sinal` aborta com o armazém mudo
falha: relogioDaEspera = setTimeout(() => rejeitar(new Error('o job não voltou depois do corte')), 5_000)
-else sinal.addEventListener('abort', aoAbortar, { once: true })
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › o `sinal` já abortado
falha: expect(ultimoResumo()).toMatchObject({ estado: 'cortada', falhasTotal: 0, enviosApagadosTotal: 0, objetosApagadosTotal: 0 })
-if (sinal.aborted) return 'cortada'
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › 3 falhas seguidas, em duas escolas
falha: expect(ultimoResumo()).toMatchObject({ estado: 'storage_fora', falhasTotal: 3, enviosApagadosTotal: 0, objetosApagadosTotal: 0 })
-return andamento.storageFora ? 'storage_fora' : 'completa'
+return 'completa'
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-envio-orfao.int.test.ts › caminho feliz
falha: expect(resposta.status).toBe(201)
-await new EnvioDeMaterialRepository(banco).registrar(id)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-envio-orfao.int.test.ts › caminho feliz
falha: expect(await linhasDoEnvio(escola.coordenacao.escolaId)).toEqual([])
-if (!(await new EnvioDeMaterialRepository(tx).apagarNoEnvio(id))) throw new DomainException(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, undefined, DEFAULT_RETRY_AFTER_SECONDS)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-envio-orfao.int.test.ts › a varredura apagou a linha de um envio lento
falha: expect(erroDe(resposta)).toEqual({ status: 503, codigo: ErrorCode.INDISPONIVEL_TENTE_DE_NOVO })
-if (!(await new EnvioDeMaterialRepository(tx).apagarNoEnvio(id))) throw new DomainException(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, undefined, DEFAULT_RETRY_AFTER_SECONDS)
+await new EnvioDeMaterialRepository(tx).apagarNoEnvio(id)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-envio-orfao.int.test.ts › `CONFLITO` depois do `guardarBytes`
falha: expect(objetosDaEscola(api, escola.coordenacao.escolaId)).toEqual([])
-await this.#desfazerEnvio(id)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-envio-orfao.int.test.ts › a varredura segurando a linha do envio
falha: expect(erroDe(resposta)).toEqual({ status: 503, codigo: ErrorCode.INDISPONIVEL_TENTE_DE_NOVO })
-if (postgresErrorIn(erro)?.code === TRAVA_NAO_DISPONIVEL) throw new DomainException(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, undefined, DEFAULT_RETRY_AFTER_SECONDS)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-envio-orfao.int.test.ts › o `guardarBytes` estoura o prazo
falha: expect(objetosDaEscola(api, escolaId)).toEqual([])
-await armazem.apagar(chaveDoTemporario(id)).catch((falha: unknown) => this.dependencias.logger.warn({ evento: 'material.objeto_nao_apagado', materialId: id, erro: summarizeError(falha) }))
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-envio-orfao.int.test.ts › `CONFLITO` com o `apagar` falhando
falha: expect(id).toBeDefined()
 logger.warn({ evento: 'material.objeto_nao_apagado', materialId: id, erro: summarizeError(falha) })
-return
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-envio-orfao.int.test.ts › a linha do envio que não sai
falha: expect(erroDe(resposta)).toEqual({ status: 409, codigo: ErrorCode.CONFLITO })
-await new EnvioDeMaterialRepository(banco).apagar(id).catch((falha: unknown) => logger.warn({ evento: 'material.envio_nao_apagado', materialId: id, erro: summarizeError(falha) }))
+await new EnvioDeMaterialRepository(banco).apagar(id)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-envio-orfao.int.test.ts › `CONFLITO` depois do `guardarBytes`
falha: expect(await linhasDoEnvio(escola.coordenacao.escolaId)).toEqual([])
-await new EnvioDeMaterialRepository(banco).apagar(id).catch((falha: unknown) => logger.warn({ evento: 'material.envio_nao_apagado', materialId: id, erro: summarizeError(falha) }))
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-envio-orfao.int.test.ts › `CONFLITO` com o `apagar` falhando
falha: expect(id).toBeDefined()
 async #desfazerEnvio(id: string): Promise<void> {
 const { banco, armazem, logger } = this.dependencias
-try {
+await new EnvioDeMaterialRepository(banco).apagar(id)
+try {
```

```mutacao
arquivo: packages/shared/src/system/job-definitions.ts
teste: packages/shared/src/system/job-definitions.test.ts › cada tipo declara a fila
falha: expect(resumo).toEqual({
 [TIPO_VARRER_TEMPORARIOS_DE_MATERIAL]: defineJob({
 filas: ['lote'],
 escopo: 'sistema',
 executor: 'worker',
 dados: semDados,
 retentativa: RETENTATIVA_DE_HOJE,
 prazoMs: 600_000,
-naoUrgente: false,
+naoUrgente: true,
```

```mutacao
arquivo: apps/worker/src/job-schedules.ts
teste: apps/worker/test/uso.int.test.ts › a varredura do PDF que sobrou
falha: expect(agendadores.map(({ key, pattern, tz }) => ({ key, pattern, tz })).sort((a, b) => a.key.localeCompare(b.key))).toEqual([
-{ tipo: TIPO_VARRER_TEMPORARIOS_DE_MATERIAL, padrao: '10 * * * *' },
+{ tipo: TIPO_VARRER_TEMPORARIOS_DE_MATERIAL, padrao: '10 3 * * *' },
```

```mutacao
arquivo: apps/worker/src/composition.ts
teste: apps/worker/src/composition.test.ts › o arquivo do titular, a planilha
falha: expect(await tiposDaReplicaDa('lote')).toEqual([
-[TIPO_VARRER_TEMPORARIOS_DE_MATERIAL]: criarVarreduraDeTemporarios({ banco, armazem, relogio, logger }),
```

```mutacao
arquivo: packages/shared/src/privacidade/classificacao.ts
teste: apps/api/test/architecture.test.ts › a CLASSIFICACAO_DAS_TABELAS confere com as migrations
falha: expect(problemasDaClassificacao(CLASSIFICACAO_DAS_TABELAS, colunas, COLUNAS_FORA_DO_ARQUIVO)).toEqual([])
-envio_de_material: SEM_PESSOA,
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-envio-orfao.int.test.ts › o `guardarBytes` estoura o prazo
falha: expect(id).toBeDefined()
-await armazem.apagar(chaveDoTemporario(id)).catch((falha: unknown) => this.dependencias.logger.warn({ evento: 'material.objeto_nao_apagado', materialId: id, erro: summarizeError(falha) }))
+await armazem.apagar(chaveDoTemporario(id)).catch((falha: unknown) => this.dependencias.logger.warn({ evento: 'material.objeto_nao_apagado', materialId: id, erro: summarizeError(falha) }))
+await new EnvioDeMaterialRepository(this.dependencias.banco).apagar(id)
```

```mutacao
arquivo: packages/core/src/material/envio-de-material.repository.ts
teste: packages/core/src/material/envio-de-material.repository.test.ts › é de 1 s
falha: expect(ESPERA_MAXIMA_PELA_LINHA_DO_ENVIO_MS).toBe(1_000)
-export const ESPERA_MAXIMA_PELA_LINHA_DO_ENVIO_MS = 1_000
+export const ESPERA_MAXIMA_PELA_LINHA_DO_ENVIO_MS = 2_500
```

```mutacao
arquivo: apps/worker/src/processors/varrer-envios.ts
teste: apps/worker/test/varrer-envios.int.test.ts › o `sinal` aborta com o armazém mudo
falha: await Promise.race([execucao, espera]).finally(() => clearTimeout(relogioDaEspera))
 // O corte do job não é falha do alvo: a transação já desfez, e a hora seguinte o retoma.
-if (sinal.aborted) return
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª) | `#guardarObjeto`: com o `guardarBytes` estourando os 30 s, não esperar até 5 s pelo `apagar` do `catch`; devolver o 503 na hora | `TODO.md`: muda o comportamento do envio e o caso "o `guardarBytes` estoura o prazo" (o PUT que chega antes do `apagar` do `catch` sai na hora) |
| infra-guardian (1ª) | Somar ao log `material.varredura` a duração da execução | `TODO.md`: muda o conjunto de chaves do log, que o caso do log passou a comparar por igualdade |
| revisor-geral (1ª) | `#desfazerEnvio`, depois do `55P03`: o `apagar(id)` da linha roda sem `lock_timeout`; aplicar a mesma espera curta, ou não apagar a linha nesse caminho | `TODO.md`: muda o caminho de falha do envio e o caso "a varredura segurando a linha do envio" |
| test-engineer (1ª) | Duas varreduras ao mesmo tempo (duas execuções ou duas réplicas), uma parada no `apagar`: caso novo | `TODO.md`: caso de integração novo com ordem forçada; o `skip locked` já está provado contra o envio lento |
| test-engineer (1ª) | Escola com falha persistente pode segurar as outras: o lote de 500 é global, ordenado por `criado_em` | `TODO.md`: decisão de desenho do lote (por escola ou global), fora das linhas que a tarefa toca |
| test-engineer (1ª) | `material.int.test.ts:368`: acrescentar `expect(linhasDoEnvio).toEqual([])` | `TODO.md`: o arquivo não é tocado por esta tarefa; o caso feliz de `material-envio-orfao.int.test.ts` já prova que a linha não sobra |
| tenancy-guardian (2ª) | `percorrer`: o `FileStorageUnavailableError` de qualquer escola para a passada de todas; só é seguro com um storage único | `TODO.md`, junto do item "Uma escola com falha persistente pode segurar as outras" (dono: o Arquiteto); o critério de parada agora exige falhas em duas escolas, e a premissa do storage único continua |
| privacy-guardian (2ª) | `summarizeError` grava as linhas da pilha (`pilha`) no log, com caminhos de arquivo do servidor | `TODO.md` (dono: quem mexer no log); não é dado pessoal e já era assim na rodada 1 |
| revisor-geral (2ª) | `varrer-envios.ts`: o `if (aoAbortar)` do `finally` é sempre verdadeiro, porque o executor da `Promise` roda de forma síncrona; pode virar atribuição direta | `TODO.md` (dono: quem mexer na varredura) |
| revisor-geral (2ª) | Um só `apagar` lento já não liga o `storageFora` (a regra pede 3 falhas em duas escolas); o alerta de "objeto não apagado" deveria levar em conta o `estado` do resumo | `TODO.md` (dono: o Arquiteto); é o mesmo assunto do lote global |
| infra-guardian (2ª) | O corte por `TEMPO_ESGOTADO` repete a execução e pode coincidir com a da hora seguinte; falta o caso de duas varreduras ao mesmo tempo | Já está no `TODO.md` ("Duas varreduras ao mesmo tempo") |
| infra-guardian (2ª) | Somar `duracaoMs` ao resumo | Já está no `TODO.md` ("Somar ao log `material.varredura` a duração da execução") |
| tenancy-guardian (3ª) | Duas escolas com chaves que falham sempre, entre os alvos mais antigos (A, B, A, sem alvo que passe no meio), disparam `storage_fora` toda hora e deixam o PDF das outras escolas no storage; registrar o caso na decisão do lote | `TODO.md`, no item "Uma escola com falha persistente pode segurar as outras" (dono: o Arquiteto); acrescentado o exemplo de duas escolas |
| revisor-geral (3ª) | `storageForaDepoisDe`: a lista não reinicia quando a escola muda; (a, a, a, b) já conta como storage fora, e uma falha persistente da B para as escolas seguintes; acrescentar o exemplo ao item do lote, ou contar escolas distintas | Igual à do `tenancy-guardian` acima: o mesmo item do `TODO.md` (a contagem por escolas distintas muda o critério e a prova, é decisão do Arquiteto) |
| test-engineer (3ª) | Resta caso parecido com o defeito corrigido: três chaves com defeito permanente, de duas escolas, seguidas no início da leitura, param a varredura de todas a cada hora; `docs/lgpd.md` garante só o caso de uma escola | Igual às duas acima: o mesmo item do `TODO.md`; a frase do `docs/lgpd.md` segue o que o Arquiteto decidir |
| privacy-guardian (3ª) | O PDF de uma escola cuja chave falha sempre fica sem prazo automático; o alerta precisa separar "storage fora" de "chave com defeito" | Já está no `TODO.md` ("O alerta de 'objeto não apagado' deveria ler o `estado` do resumo", revisor-geral, 2ª) |
| privacy-guardian (3ª) | O critério de 3 falhas em duas escolas supõe um storage único; com storage por escola ou região, revisar a retenção do `docs/lgpd.md` junto | Já está no `TODO.md` ("A parada por 'storage fora' supõe um storage único", tenancy-guardian, 2ª) |
| infra-guardian (3ª) | Storage fora com alvos de uma escola só: a regra das duas escolas não dispara e a execução gasta até 10 min (até 500 × 10 s, cada um com uma conexão de `lote` e uma transação aberta) a cada tentativa; anotar no item do lote global e do alerta pelo `estado` | `TODO.md`, no item do lote global (dono: o Arquiteto); acrescentado este pior caso |
| infra-guardian (3ª), test-engineer (3ª) | `varrer-envios.ts:149`: o alvo pulado (`travarParada` devolve `false`, o storage nem foi chamado) zera `falhasDeStorageSeguidas` como se tivesse passado; zerar só quando um `apagar` passou de fato, ou escrever o comentário | `TODO.md` (dono: quem mexer na varredura). Muda o critério de parada, que acabou de ser provado por mutação; não é barata |
| test-engineer (3ª) | A conta de falhas atravessa as duas passadas: `[a, a, b]` com dois envios da A no fim da primeira passada e o primeiro objeto da B para a passada dos objetos inteira; deixar escrito que é intencional, ou zerar entre as passadas, com caso de teste | `TODO.md` (dono: quem mexer na varredura). Muda o critério de parada |
| test-engineer (3ª) | `varrer-envios.int.test.ts:277-278`: `idA` e `idB` nascem com o mesmo `criado_em`, e o desempate é `randomUUID`; fixar a ordem com `enviosNaOrdem([a, b], base)` | `TODO.md`, item único "Acabamento dos casos novos de `varrer-envios.int.test.ts`" (dono: quem mexer nesse teste). O caso `:530` é a prova determinística |
| test-engineer (3ª) | O caso `:563` (zerar a conta) só se distingue pelo `estado`; um quinto alvo depois da sequência deixaria a prova também na contagem de chamadas | Mesmo item de acabamento do `TODO.md` |
| revisor-geral (3ª) | No caso "o alvo que passa zera a conta" o laço repete o `enviosNaOrdem`; usar o helper | Mesmo item de acabamento do `TODO.md` |
| revisor-geral (3ª) | No caso "falha que não é do storage", os envios usam o mesmo `RelogioMovel` sem avançar, e o comentário "a, a, b, b" não é a ordem da leitura; a asserção não depende da ordem | Mesmo item de acabamento do `TODO.md` (corrigir o comentário) |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-11 15:57:14 | 2026-11-11 15:57:34 | `conformidade-reviewer` | 1 | APROVADO | aeea931677c9a8134 |
| 2026-11-11 15:56:58 | 2026-11-11 15:57:36 | `tenancy-guardian` | 1 | APROVADO | a0e433e0d464a5aba |
| 2026-11-11 15:57:02 | 2026-11-11 15:58:05 | `privacy-guardian` | 1 | APROVADO | a400c4a5eb9f35b2c |
| 2026-11-11 15:57:05 | 2026-11-11 15:58:57 | `infra-guardian` | 1 | REPROVADO | a23d0229e9774fca9 |
| 2026-11-11 15:57:11 | 2026-11-11 15:59:06 | `revisor-geral` | 1 | REPROVADO | a7f61edf1d6f8d49f |
| 2026-11-12 15:01:38 | 2026-11-12 15:05:04 | `test-engineer` | 1 | APROVADO | af9c6152aaa0e3b7f |
| 2026-11-12 16:13:15 | 2026-11-12 16:13:35 | `tenancy-guardian` | 2 | APROVADO | a854d0aae68fdc631 |
| 2026-11-12 16:13:07 | 2026-11-12 16:13:45 | `revisor-geral` | 2 | APROVADO | a3781350cb756d28f |
| 2026-11-12 16:12:57 | 2026-11-12 16:13:45 | `infra-guardian` | 2 | APROVADO | a6e2fb1f6bf7c4ef4 |
| 2026-11-12 16:13:31 | 2026-11-12 16:13:54 | `conformidade-reviewer` | 2 | APROVADO | adac6d8ffa22a8736 |
| 2026-11-12 16:13:22 | 2026-11-12 16:13:59 | `privacy-guardian` | 2 | APROVADO | a0287de272b6ded3b |
| 2026-11-12 16:13:27 | 2026-11-12 16:14:56 | `test-engineer` | 2 | REPROVADO | a7b792115531c1b6e |
| 2026-11-12 19:47:10 | 2026-11-12 19:47:35 | `tenancy-guardian` | 3 | APROVADO | a326502afaf1a933f |
| 2026-11-12 19:47:03 | 2026-11-12 19:47:42 | `revisor-geral` | 3 | APROVADO | a5ef38c2035257c4d |
| 2026-11-12 19:47:16 | 2026-11-12 19:47:42 | `privacy-guardian` | 3 | APROVADO | acce3be81c077a78b |
| 2026-11-12 19:47:23 | 2026-11-12 19:47:51 | `infra-guardian` | 3 | APROVADO | a6692ab88142d5e38 |
| 2026-11-12 19:47:27 | 2026-11-12 19:47:52 | `conformidade-reviewer` | 3 | APROVADO | a1244449fb8b44510 |
| 2026-11-12 19:46:59 | 2026-11-12 19:48:21 | `test-engineer` | 3 | APROVADO | a37e409df07e398d0 |
