# Achados das revisões — `tasks/prd-ingestao-do-material/8_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-13 14:27:38 · `tasks/prd-ingestao-do-material/8_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova. A tabela `material` ganha `edicao`, `substitui_id` e `substituido_por` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/drizzle/0056_material_edicao.sql`). As duas FKs novas são compostas com a escola, `(escola_id, substitui_id)` e `(escola_id, substituido_por)` → `material(escola_id, id)`, com `set null` só na coluna do id, então uma edição não consegue apontar para material de outra escola. O índice parcial `material_uma_edicao_em_andamento` começa por `escola_id`. A `material` não varia por período e já não tinha `anoLetivoId`; a tarefa não muda isso. O check `auditoria_rotina_so_nas_acoes` foi ampliado para `material.substituido`, e o `AuditoriaRecorder` grava o `escolaId` que vem do contexto.

Queries verificadas:
- `apps/api/src/material/material.repository.ts`, os quatro métodos novos: `alvoDaEdicao`, `travarAlvoDaEdicao` (`for update`), `edicaoEmAndamentoSobre` e `seriesDoMaterial`. Todos filtram por `requireEscolaId()`.
- `packages/core/src/material/extracao.repository.ts`, nos métodos `substituirAnterior` (o update da antiga e o delete dos trechos dela) e `lerParaExtrair`. O escopo vem do contexto. A `antigaId` é lida da própria linha já escopada, e a FK composta a prende à mesma escola.
- `apps/api/src/material/material.service.ts`, `enviarEdicao` e `#gravarEdicao`. A licença é lida por `LicencaRepository.paraUso`, que é escopado. A herança é lida dentro da transação, com a linha travada.
- Endpoint `POST /v1/materiais/:id/edicoes`. O id é UUID (`IdPipe`). O corpo é `z.strictObject({ edicao, titulo })`, então `escolaId` e qualquer campo herdado no corpo dão `ENTRADA_INVALIDA`, e o teste "o pedido não escolhe o que é herdado" prova isso. Não há `@Unscoped` novo.
- O SQL dos blocos 1 e 2 do runbook é procedimento de operador, não código da aplicação. Os joins e o subselect do bloco 2 casam `escola_id`.

Teste de isolamento: presente e efetivo. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/material-edicao.int.test.ts:394`, removi mentalmente o escopo de `alvoDaEdicao`, e cada um dos três casos quebra:
- **Alvo `pronto` da escola B:** a requisição passa a responder `ENTRADA_INVALIDA` em vez de 404.
- **Alvo `processando`:** passa a responder `EDICAO_EM_ANDAMENTO` (409).
- **Licença vencida:** grava `material.recusado` na escola A, e o teste confere que a auditoria da A está vazia.

A resposta também é comparada com a do id inexistente, e o teste confere que nenhum byte chega ao storage. No nível do repository, o caso da l.417 quebra se o escopo sair de `travarAlvoDaEdicao` ou de `seriesDoMaterial`.

Bloqueantes: nenhum.

Recomendações:
- `apps/api/test/material-edicao.int.test.ts:425`: a asserção `edicaoEmAndamentoSobre(alvo) === false` no contexto da escola A não provaria nada se o escopo saísse do método, porque a escola B não tem edição em andamento sobre aquele alvo. Criar uma edição `processando` na B antes da asserção a torna efetiva.
- `packages/core/src/material/extracao.repository.ts`, em `substituirAnterior`: as cláusulas `escolaId` do update e do delete dos trechos não têm bloco de mutação. Não dá para explorar, porque a FK composta prende a `antigaId` à escola, mas um bloco por cláusula deixaria o escopo coberto como o resto da tarefa.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-13 14:27:48 · `tasks/prd-ingestao-do-material/8_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa 8.0 é a edição nova de material e não lê nem grava `Nota`, `correcao`, `entrega` nem `lote`, em nenhuma camada (API, worker, migration, seed ou teste). Todos com autor humano? Não se aplica.

Decisão autônoma sobre aluno: ausente. O pedido de edição só aceita `edicao` e `titulo` (`enviarEdicaoRequestSchema`, strict). O resto vem do material que a coordenação já tinha enviado e declarado. A troca da anterior pela nova acontece sozinha quando a extração termina, mas é consequência do envio humano, que fica em `material.edicao_enviada` com o usuário como autor (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.service.ts:296`). Não envolve aluno, e a extração é o `PdfExtractor`, sem IA.

Aprovação registrada: ok. Nada aqui é saída de IA que chega ao aluno. O ponto que olhei com mais cuidado foi o check `auditoria_rotina_so_nas_acoes`, que ficou mais aberto: ele agora aceita `material.substituido` com o autor `rotina` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/drizzle/0056_material_edicao.sql`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/db/schema/auditoria.ts:72`). Isso não abre caminho para a rotina aprovar coisa alguma:
- a lista só ganhou essa ação;
- `entrega.decidida` e `lote.aprovado` continuam recusados para a `rotina` pelo banco;
- o teste que prova isso continua valendo (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/auditoria/auditoria.int.test.ts:249-257`).

Apagar os trechos da edição anterior também não apaga o que a IA já produziu: as citações do Tutor são cópias em `jsonb` (`mensagem_tutor.citacoes`), sem FK para `trecho`.

Supervisão do tutor: ok. A tarefa não toca o tutor.

Autonomia declarada e visível: sim. Nenhum agente foi alterado.

Itens 7, 8 e 9: nada de inferência emocional, nada de nota em discursiva ou redação, nada de indicador de professor. A auditoria nova guarda só ids e o que foi herdado, sem título, rótulo nem arquivo.

Bloqueantes: nenhum.

Recomendações:
- O `describe` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/auditoria/auditoria.int.test.ts:230` ainda diz "o banco o aceita só nas quatro ações da eliminação", e a lista de `aceita %s` (l.238-243) não tem `material.substituido`. Hoje a única prova de que o banco aceita essa ação é o caso de `material-edicao.int.test.ts:434`. Vale atualizar o título e incluir `['material.substituido', 'material']` no `it.each`, para que o teste da auditoria descreva sozinho a lista que fecha a regra 70, item 3.
- Para a 12.0: na tela, deixar claro que a troca pela edição nova acontece quando a leitura do PDF termina, e não na hora do envio, para a coordenação não achar que a anterior saiu antes da hora. Isso não é exigência desta tarefa.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-13 14:27:50 · `tasks/prd-ingestao-do-material/8_task.md`

VEREDITO: APROVADO

A tarefa 8.0 passa pela regra 20 sem nenhum bloqueante. Não rodei os testes de integração; conferi o diff, a migration e os casos de teste por leitura.

Campos pessoais tocados: `material.edicao` é o rótulo da edição: texto curto da coordenação, de 1 a 60 caracteres, preso por um check no banco e sem dado de pessoa. `substitui_id` e `substituido_por` só ligam um material a outro, sem dado de pessoa. `enviado_por` da edição nova é gravado como no envio comum, a partir da sessão.

Fora da tabela de dados do docs/lgpd.md: nada. A linha "Material da escola" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/docs/lgpd.md:101`) já traz o rótulo, as duas ligações e o que a auditoria guarda, e a retenção segue a do material (`material_excluido`). O arquivo do titular (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/titular/leitura-do-titular.ts:387`) inclui `edicao` e lista as duas ligações em `fora`, com o motivo. `material.titulo` não está em `COLUNAS_DA_TROCA_DE_NOME`, então deixar `edicao` fora dela é coerente. Nenhum campo proibido para aluno entra, e a tarefa não toca dado de aluno.

Autorização por objeto: ok. Testei mentalmente trocar o id na URL:
- **Escopo:** `alvoDaEdicao`, `travarAlvoDaEdicao`, `edicaoEmAndamentoSobre` e `seriesDoMaterial` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.repository.ts:115-154`) filtram pela escola do contexto.
- **Mesma resposta:** o alvo de outra escola, excluído, já substituído, que falhou ou que não existe responde `NAO_ENCONTRADO`, com o mesmo corpo, antes de ler qualquer byte. Os três casos da outra escola (`pronto`, `processando` e com licença vencida) comparam o corpo com o do inexistente, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/material-edicao.int.test.ts:394`.
- **`EDICAO_EM_ANDAMENTO` não confirma nada a quem não pode:** só sai depois do filtro da escola.
- **Professor:** recebe `NAO_ENCONTRADO` (`material-edicao.int.test.ts:348`).
- **Saída:** a resposta passa por `materialResponseSchema` estrito, montado a partir das colunas escolhidas uma a uma em `colunasDaLinha`, sem `enviado_por`.

Logs: limpos. `material.edicao_enviada` registra só ids e o tamanho (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.service.ts:307`), e os logs do worker só ids e contagens.

Auditoria: presente.
- **`material.edicao_enviada`:** autor é a coordenação, guarda ids e o que foi herdado, sem título, rótulo nem arquivo (`strictObject`).
- **`material.substituido`:** autor é a `rotina`, porque o worker não tem pessoa no contexto. O check `auditoria_rotina_so_nas_acoes` foi ampliado na 0056 (`NOT VALID` e depois `VALIDATE`). Não é aprovação de saída de IA, então a regra 70 não é afetada.
- **Teste:** a auditoria sem texto de título ou rótulo está provada em `material-edicao.int.test.ts:434`.
- **Exclusão:** a saída do material antigo é exclusão lógica, registrada em `material.substituido`.

Envio externo: nenhum. A tarefa não chama IA.

Seed/fixture: sintético. A fixture nova `enviarEdicaoDeMaterial` usa o PDF de demonstração. As fixtures de web e e2e só ganharam `edicao: null` e `substitui: null`. Os dois blocos de SQL do runbook não levam dado de pessoa e pedem que o registro posterior tenha só contagens.

Pergunta de fechamento: responde. O arquivo do titular de quem enviou ou excluiu o material inclui `edicao`, e as duas ações novas ficam na auditoria consultável. A tarefa não envia nada para fora.

Bloqueantes: nenhum.

Recomendações:
1. Em `docs/lgpd.md:101`, o fim da coluna de retenção lista os ids que a auditoria guarda em `(material.enviado, material.excluido, material.recusado)`. Vale acrescentar `material.edicao_enviada` ali, para a lista ficar completa.
2. `edicao` é texto livre e foi classificado como "sem dado de pessoa", igual ao `titulo`. Se um dia `material.titulo` entrar na troca de nome da eliminação, `edicao` precisa entrar junto. Convém deixar isso anotado em `troca-de-nome.ts`, na lista do que "fica de fora, de propósito".
3. O campo `substitui` sai também na leitura do professor. É só um id de material, sem dado de pessoa. A 12.0 deve conferir que a tela não mostra o título do material substituído a quem não o alcança mais.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-13 14:28:48 · `tasks/prd-ingestao-do-material/8_task.md`

VEREDITO: APROVADO
Caminho quente tocado: migration | fila (o job `pdf` de extração, que é lote)
Rate limit: ok. A edição passa pelos mesmos `MaterialUploadGuard` e `#exigirDentroDosTetos`, com teto por pessoa e por escola, e a linha nova conta no teto porque `inserir` grava `enviado_por`. Nenhum limite é por IP.
Fila e prioridade: ok. A extração continua no job `pdf`, enfileirado uma vez por material pelo outbox, na mesma transação da linha. Fazer a substituição na transação da extração não leva trabalho para dentro do request.
Concorrência: protegida. Três proteções seguram as corridas:
- a trava de envios da escola com a checagem de edição em andamento, e o índice parcial `material_uma_edicao_em_andamento` repetindo a regra no banco, com o `23505` mapeado;
- o alvo lido com `for update` dentro da transação;
- `marcarPronto` e `substituirAnterior` com `excluido_em is null`.

Os sete testes [P] cobrem essas corridas, e os três arquivos de integração da tarefa passaram aqui (48 testes).
Índice e paginação: ok. `edicaoEmAndamentoSobre` usa o índice parcial `(escola_id, substitui_id)`, e o `delete` dos trechos da edição anterior usa `trecho_pagina_do_material_unica (escola_id, material_id, pagina)`. Nenhuma listagem nova.
Degradação de IA: não se aplica
Migration: compatível. Colunas novas anuláveis, FKs sobre colunas que nascem vazias, índice e check em `material` (tabela pequena), check da auditoria afrouxado. Nenhum `NOT NULL`, nenhum rename e nenhum backfill. A volta do código está no runbook, com os dois blocos de SQL provados por `volta-da-f4.int.test.ts`.
Métrica e alerta: ok. A extração já mede o desfecho, e o caso `pronto` agora inclui a substituição. Não há alerta novo, e a seção nova do runbook diz que é procedimento, não alerta.
Bloqueantes: nenhum

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/drizzle/0056_material_edicao.sql:15-17`: o migrador do drizzle roda tudo numa transação só (`packages/core/src/db/migrate.ts:89`). Assim, o `ACCESS EXCLUSIVE` que o `DROP CONSTRAINT` pega em `auditoria` fica preso até o commit, inclusive durante o `VALIDATE`. Numa transação única, o par `NOT VALID` + `VALIDATE` não ganha nada. É o mesmo padrão da 0036 e roda fora do horário letivo, por isso não bloqueia. Mas `auditoria` cresce com toda ação registrada. Vale registrar na seção 7 da Tech Spec ou no runbook quanto tempo o `VALIDATE` leva com a auditoria do tamanho previsto para dez escolas, comparado ao `MIGRAR_TIMEOUT_CONSULTA_MS`, ou separar a mudança do check numa migration própria.
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/shared/src/material/material.ts` (`materialSchema`): o contrato de resposta é `strictObject`, e o web valida a lista com ele (`apps/web/src/areas/coordenacao/material/api/material.ts:38`, `apps/web/src/areas/professor/artefatos/api/titulos-dos-materiais.ts:14`). Uma aba com o bundle antigo aberta durante o deploy recusa a lista inteira por causa de `edicao` e `substitui`. O padrão já existe no repositório e o deploy é fora do horário letivo. Fica para a retro: avaliar resposta tolerante a campo novo no cliente, ou recarregar a aba quando a versão muda.
3. Não há métrica própria de latência e erro do `POST /v1/materiais/:id/edicoes`, igual ao envio da 7.0. Não é caminho quente e a extração mede o que pesa. Se o painel de operação passar a acompanhar a ingestão, entram as duas rotas juntas.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-13 14:29:12 · `tasks/prd-ingestao-do-material/8_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok (as seis divergências estão na `techspec.md` §11, linha 8.0)
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

O que conferi: a ordem do `enviarEdicao` segue a §5. Primeiro vem o alvo, com escopo, depois a licença do alvo antes de ler o arquivo. Na transação, o alvo é lido `for update` e a herança vem dessa leitura. A transição da extração tem `excluido_em is null`, e o `update` da anterior também. Não achei `.skip`, `any` nem `TODO`. Nada da 9.0 (filtro de série), da 10.0 (`fontes`) ou da 12.0 (`PATCH` e tela) entrou. `edicao` e `substitui` no `materialSchema` já estavam previstos na §4, na saída do `GET`.

Recomendações:
1. **Edição sobre alvo que já tem edição em andamento.**
   - O código: em `apps/api/src/material/material.service.ts:290-296`, o passo 1 só recusa o alvo que está `processando`. Quando o alvo está `pronto` mas já tem uma edição B sendo lida, uma segunda edição (C, mesmo sem corrida) grava o PDF de até 20 MB no storage, abre a transação e só ali recebe `EDICAO_EM_ANDAMENTO`.
   - A spec não exige recusar antes, mas o comentário em `packages/shared/src/errors/error-code.ts:193-195` diz que a recusa "sai antes de ler o arquivo", o que não vale para esse caso.
   - Sugestão: chamar `edicaoEmAndamentoSobre` também no passo 1, ou corrigir o comentário.
2. **Texto do runbook se contradiz** (`docs/runbook.md`, "Voltar o código depois da F4").
   - O item "Os jobs `pdf`… ficam parados… e voltam a andar no worker novo" e a frase "os jobs `pdf` que o bloco 1 não concluiu seguem" não batem com o bloco 1, que conclui todos os jobs em `aguardando`, `reservado`, `publicado` e `ativo`.
   - "Conclui os jobs `pdf` que não começaram" também inclui o `ativo`, que já começou.
   - O SQL está certo e é o que o teste roda; quem está de plantão lê o texto.
3. **`cenarios.md` sem as divergências novas.** O `cenarios.md` não ganhou o alvo `falhou` respondendo `NAO_ENCONTRADO`, nem o bloco 2 do roll-forward. Os dois são comportamento testado. A divergência da recusa com zero séries cita `cenarios.md` "Edição nova", mas essa seção não fala disso. Vale uma linha em cada seção, como a 5.0 fez.
4. **Recomendação da 7.0 que ficou sem registro.** O `privacy-guardian` da 7.0 deixou para a 8.0 o fato de a auditoria não registrar `licencaId` nem `serieIds` (linha 1444 do `7_task.md`).
   - `material.edicao_enviada` (`packages/core/src/auditoria/acoes.ts:118-128`) continua sem os dois, embora o texto diga que guarda "o que foi herdado".
   - Sugestão: aplicar, ou registrar em "Recomendações sem aplicar" do `8_task.md`, que está vazia.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/shared/src/errors/error-code.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/docs/runbook.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/cenarios.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/auditoria/acoes.ts`

## test-engineer · 1ª rodada · REPROVADO · 2026-11-13 14:30:14 · `tasks/prd-ingestao-do-material/8_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:** os da tabela da 8.0 e os do `cenarios.md` nas seções "Edição nova" (o que é desta tarefa), "Corridas" (as cinco da edição), "Migração" (volta do código; material sem série), "Permissão / escola sem ano letivo" e "Isolamento" (edição da A sobre material da B `pronto`, `processando` e com licença vencida).

**Cobertos:** cada linha da tabela tem o seu caso, citado pelo nome, em `material-edicao.int.test.ts`, `material-envio-orfao.int.test.ts` e `volta-da-f4.int.test.ts`. As asserções olham o resultado: busca, linhas, trechos, objetos, `envio_de_material`, auditoria e `guardadas`. Não achei nenhum `.skip` nem `.only`. As corridas da edição são concorrência de verdade: duas chamadas presas por `WriteBlockTrigger`, `esperarNaTrava` ou barreira no extrator. Não há IA nesta tarefa. Não rodei nenhum teste e não alterei arquivo nenhum.

**Bloqueantes:**

1. **Duas mutações estão na tabela e não têm bloco nem motivo.** A seção "Mutações" explica por que três não viraram bloco, mas não fala destas duas:
   - `8_task.md:51` declara "tirar o `for update`", que fica em `apps/api/src/material/material.repository.ts:259`. Não há bloco. **Correção:** um bloco que tira `.for('update')`, apontando o caso "[P] edição C…".
   - `8_task.md:55` declara "herdar do passo 1", que fica em `material.service.ts:280` (`herdadas` lidas na transação). Não há bloco. **Correção:** um bloco que faz a edição herdar as séries lidas no passo 1, apontando o caso "[P] a edição parada depois de guardar o arquivo…".

2. **Há cláusulas novas sem bloco que um teste mataria, ou que mataria com um ajuste pequeno:**
   - `material.repository.ts:246`, `isNull(material.excluidoEm)` do `alvoDaEdicao`: o único bloco desta linha tira só o `escolaId`. O caso "alvo excluído" pega a remoção pelo `guardadas`, mas o bloco não existe. **Correção:** o bloco.
   - `material.repository.ts:258`, `eq(material.escolaId, …)` do `travarAlvoDaEdicao`: o teste do repository (`material-edicao.int.test.ts:424`) pega a remoção, mas não há bloco. **Correção:** o bloco.
   - `material.repository.ts:268`, `isNull(material.excluidoEm)` do `edicaoEmAndamentoSobre`: tirada a cláusula, nenhum teste fica vermelho. Falta o caso em que a coordenação exclui a edição presa em `processando` e manda outra. Sem a cláusula, ela recebe `EDICAO_EM_ANDAMENTO` para sempre, e o índice não ajuda, porque ignora a linha excluída. **Correção:** o caso "edição `processando` excluída libera o lugar: a próxima é 201", e o bloco.

3. **Há escopo de tenant que nenhum teste prova (regra 10, item 5):**
   - Em `material-edicao.int.test.ts:425`, a asserção `edicaoEmAndamentoSobre(alvo)` dá `false` também sem `eq(material.escolaId, …)` (`material.repository.ts:268`). O alvo da B não tem edição em andamento, então a asserção é decoração. **Correção:** antes da asserção, a B manda uma edição sobre o alvo dela, para que ela fique `processando`. Depois, um bloco que tira o `escolaId`.
   - Em `packages/core/src/material/extracao.repository.ts:99`, ninguém prova o `eq(material.escolaId, escolaId)` do `update` de `substituirAnterior`. **Correção:** um caso direto no repository. No contexto da A, `substituirAnterior(x, antigaDaB)` devolve `false`, e a linha da B continua sem `excluido_em` nem `substituido_por`. Depois, o bloco.

4. **O caso dos dois jobs esconde a falha de um deles.** Em `material-edicao.int.test.ts:632`, `Promise.allSettled(jobs)` engole a rejeição. O `cenarios.md` (linha 163) exige "os dois `concluido`". Hoje, se o segundo job lançasse, ele iria para retentativa e para `job.falhos`, e o teste seguiria verde. **Correção:** conferir que os dois resultados são `fulfilled`, ou usar `Promise.all`.

5. **A edição sobre material sem série não tem teste.** A divergência da própria tarefa (`8_task.md:83`) cobre o material de antes da F4 numa escola sem série. Em `material.service.ts:295`, a mutação `herdadas.length > 0` → `true` sobrevive, e ela chamaria `gravarSeries` com lista vazia. O `material.recusado` com `serieIds: []` só tem prova de unidade, no schema (`acoes.test.ts`). **Correção:** um caso de integração com um alvo sem `material_serie`:
   - a edição é 201 e nasce sem série;
   - com a licença vencida, a resposta é `LICENCA_VENCIDA` e a auditoria guarda `serieIds: []`.
   
   E um bloco sobre o `> 0`.

**Recomendações:**
- Três cláusulas não têm como morrer e merecem uma linha de motivo na seção "Mutações":
  - `estado = 'pronto'` em `material.repository.ts:258`: um `pronto` nunca volta a `processando`;
  - `arquivo.size === 0` em `material.service.ts` (`enviarEdicao`): o buffer vazio já falha na assinatura de PDF;
  - o `escolaId` do `delete` de trechos em `extracao.repository.ts`: o delete só roda depois do `update` com escopo.
- Permissão do aluno: `cenarios.md:188` pede "Aluno: o mesmo, em todas as rotas de material". Não há caso do aluno no `POST /:id/edicoes`.
- Expurgo da edição substituída: o `on delete set null` da 0056 não tem teste que prove que o expurgo não trava na FK nova. O cenário é da 10.0, mas a FK nasce aqui.
- `volta-da-f4.int.test.ts`:
  - o teste 2 depende do estado deixado pelo teste 1;
  - o `licenciante` "preenchido" é o que a própria fixture inseriu, então a asserção nada prova sobre o código;
  - o nome do teste 3 ("é a única coisa que fecha o `processando`") promete mais do que ele prova, que é a recusa do check `material_falha_valida`.
- No caso dos dois jobs, conferir também os capítulos gravados uma vez só, como diz o cenário, e não só os trechos.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/8_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/material-edicao.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/material-envio-orfao.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/db/volta-da-f4.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/material/extracao.repository.ts

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-13 15:03:57 · `tasks/prd-ingestao-do-material/8_task.md`

VEREDITO: APROVADO

Tabelas verificadas: `material` (rótulo `edicao`, `substitui_id`, `substituido_por`), `material_serie`, `trecho`, `capitulo_do_material`, `auditoria` (o autor `rotina` em `material.substituido`). Esta rodada não muda schema nem a migration `0056`. Confirmei que os arquivos de produção da árvore atual (`material.repository.ts`, `material.service.ts`, `material.controller.ts`, `extracao.repository.ts`, `0056_material_edicao.sql`) são idênticos aos do commit `5d880e9`.

Queries verificadas:
- **`MaterialRepository.edicaoEmAndamentoSobre`:** o teste agora cria na escola B uma edição `processando` sobre o alvo dela. No contexto da escola A a resposta tem de ser `false`, e no da B, `true`. Se a cláusula `escolaId` sair, a escola A recebe `true` e o teste quebra. A recomendação 1 da rodada anterior foi aplicada.
- **`MaterialRepository.travarAlvoDaEdicao`:** ganhou bloco de mutação que tira o `escolaId` e outro que tira o `for update`.
- **`MaterialRepository.alvoDaEdicao`:** ganhou bloco de mutação que tira o `excluido_em is null`.
- **`ExtracaoDoMaterialRepository.substituirAnterior` (`packages/core/src/material/extracao.repository.ts:94-104`):**
  - O `update`: há teste novo que chama o método no contexto da escola A e exige `false`, com o alvo da B ainda sem `excluido_em` e sem `substituido_por`. No contexto da B, a mesma chamada substitui. O bloco de mutação da cláusula `escolaId` do `update` foi incluído, e o teste quebraria sem ela.
  - O `delete` dos trechos: ficou sem bloco, com motivo escrito no `8_task.md`. Conferi no código e o motivo se sustenta. O `delete` só roda se o `update` com escopo devolveu linha (linha 101), e então o `antigaId` já foi achado na escola do contexto. A recomendação 2 está atendida.

Teste de isolamento: presente e efetivo. Também entraram nesta rodada:
- o aluno que tenta editar material recebe `NAO_ENCONTRADO`, e nada é lido nem guardado;
- o SQL direto dos testes novos (`delete from material_serie` e `count` de `capitulo_do_material`) filtra por `escola_id`.

Bloqueantes: nenhum.

Recomendações:
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/material-edicao.int.test.ts`, o teste da substituição na escola A depende de `alvoDaB`. Vale confirmar ali que a escola A tem material próprio, para que a resposta `false` não venha de uma escola vazia. É cobertura extra: hoje a mutação já deixa o teste vermelho.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-13 15:04:03 · `tasks/prd-ingestao-do-material/8_task.md`

VEREDITO: APROVADO

**Rodada 2.** Desde a rodada 1 nenhum código de produção mudou. Conferi o patch `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/.processo/ordens/8_task-diff-r1-r2.patch` e o que ele afeta.

**A recomendação da rodada 1 foi aplicada.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/docs/lgpd.md:101`, na linha "Material da escola", a lista de ids da auditoria agora traz `material.edicao_enviada` e também `material.substituido`. As outras duas recomendações estão registradas na seção "Recomendações sem aplicar" de `8_task.md`: uma foi para o `TODO.md` e a outra para a tarefa 12.0.

Campos pessoais tocados: nenhum novo nesta rodada. Os da rodada 1 continuam: o rótulo `edicao`, sem dado de pessoa, e as ligações `substitui_id` e `substituido_por`, que levam só ids.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. A rodada acrescenta testes que reforçam isso, sem mudar código:
- O aluno recebe `NAO_ENCONTRADO`, e nada é lido nem guardado no storage.
- `edicaoEmAndamentoSobre`, no contexto da escola A, devolve `false` mesmo quando a B tem uma edição em andamento. No contexto da B, devolve `true`.
- `substituirAnterior`, no contexto da escola A, não toca o alvo da B. Os blocos de mutação novos tiram a cláusula de escola e mostram que o teste quebra sem ela.

Logs: limpos. Nenhum log novo.

Auditoria: presente.
- O teste em `packages/core/src/auditoria/auditoria.int.test.ts` agora inclui `material.substituido` entre as ações que o banco aceita com autor `rotina`. Isso bate com o check da migration `0056_material_edicao.sql:16`, e essa ação não aprova nada.
- A recusa de material sem série grava `material.recusado` com `serieIds: []`, sem o título.

Envio externo: nenhum nesta tarefa.

Seed/fixture: sintético.
- A amostra de PDF em `tools/demonstracao/amostra-de-capitulos.ts` tem só títulos de capítulo de química, sem pessoa.
- O teste da volta do código usa "Editora X" como licenciante.

Bloqueantes: nenhum.

Recomendações:
- O teste `volta-da-f4.int.test.ts` deixou de conferir que o `licenciante` fica preenchido e passou a apoiar-se nos testes da API. A tabela de testes de `8_task.md` (linha "volta do código") e a de `cenarios.md` ainda dizem "`licenciante` preenchido" como algo que esse teste prova. Vale alinhar o texto ao que o teste prova hoje. Não é falha de privacidade.

Pergunta de fechamento: a resposta é a mesma da rodada 1. O rótulo `edicao` entra no arquivo do titular com o resto do material, e a auditoria guarda só ids.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-13 15:04:09 · `tasks/prd-ingestao-do-material/8_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum (o diff da rodada 2 só muda testes, docs e um comentário; nenhum código de produção mudou)
Rate limit: ok (não mudou desde a rodada 1)
Fila e prioridade: ok. O bloco 1 do runbook conclui os jobs `pdf` nos estados `aguardando`, `reservado`, `publicado` e `ativo`. O texto novo de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/docs/runbook.md` (linhas 999 a 1035) agora diz o mesmo que o SQL. Antes dizia "não começaram", e o SQL também concluía o `ativo`.
Concorrência: protegida. O caso "[P] dois jogos da mesma edição" ficou mais exigente: agora usa `Promise.all` em vez de `allSettled`, os dois jobs precisam terminar sem erro, e os capítulos têm de aparecer uma vez só.
Índice e paginação: ok (não mudou)
Degradação de IA: não se aplica
Migration: compatível. A 0056 não mudou. O `volta-da-f4.int.test.ts` roda o bloco 1 uma vez no `beforeAll`, e cada caso roda sozinho.
Métrica e alerta: ok (não mudou; a métrica própria de `POST /v1/materiais/:id/edicoes` segue registrada no `TODO.md` desde a rodada 1)
Bloqueantes: nenhum. A rodada 1 não exigiu correção.
Recomendações: nenhuma nova. Os testes novos em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/material-edicao.int.test.ts` usam o extrator falso e não chamam provedor pago. O relógio fixo volta ao normal no `afterEach` (linha 147).

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-13 15:04:23 · `tasks/prd-ingestao-do-material/8_task.md`

VEREDITO: APROVADO

A recomendação que a Mesa mandou aplicar foi feita. O `describe` e o `it.each` do autor `rotina` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/auditoria/auditoria.int.test.ts:230-244` agora listam `material.substituido`. Isso bate com o check `auditoria_rotina_so_nas_acoes` da `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/drizzle/0056_material_edicao.sql:16`. Essa auditoria registra a troca de um material por outra edição, feita pelo job de leitura do PDF, sem modelo de IA. Não é aprovação de saída de IA, então não precisa de autor humano.

A rodada 1 não exigiu correção. Esta rodada só muda testes e documentos (`material-edicao.int.test.ts`, `volta-da-f4.int.test.ts`, `auditoria.int.test.ts`, `docs/lgpd.md`, `docs/runbook.md`, `8_task.md`, `cenarios.md` e um comentário em `error-code.ts`). Nenhum deles toca nota, tutor, autonomia de agente, decisão sobre aluno ou indicador de professor. A extração do PDF (`extrair-pdf.ts`, `extracao.repository.ts`) não chama o gateway de IA.

Caminhos de escrita em Nota: nenhum nesta tarefa nem nesta rodada. Todos com autor humano? sim (não há caminho novo).
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok (a tarefa não cria saída de IA. A troca de edição é ato da coordenação, que fica na auditoria como `material.edicao_enviada`. A rotina só registra `material.substituido`, que não aprova nada.)
Supervisão do tutor: ok (fora do escopo, nada mudou)
Autonomia declarada e visível: sim (nada mudou)
Bloqueantes: nenhum
Recomendações:
- A da rodada 1 sobre a tela segue para a tarefa 12.0, como já está em `8_task.md` na seção "Recomendações sem aplicar". A tela precisa deixar claro que a edição nova substitui a antiga quando a leitura do PDF termina, e não no envio.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-13 15:04:44 · `tasks/prd-ingestao-do-material/8_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

Esta rodada não muda código de produção, só testes, documentação e o `8_task.md`. Conferi o que a Mesa mandou aplicar:
- O runbook "Voltar o código depois da F4" agora explica os jobs `pdf`: o bloco 1 conclui os quatro estados, e o roll-forward diz que nenhum job da época da volta sobra.
- O `cenarios.md` ganhou as linhas pedidas: em "Edição nova", o alvo `falhou` e o material sem série; em "Migração", o roll-forward.
- O comentário de `EDICAO_EM_ANDAMENTO` em `error-code.ts` agora descreve a ordem real do `enviarEdicao`.
- A recomendação sobre `licencaId` e `serieIds` na auditoria foi para "Recomendações sem aplicar".

Os filtros `teste: … › …` dos blocos de mutação novos acham, cada um, o teste citado em `material-edicao.int.test.ts` ou em `material-envio-orfao.int.test.ts`. O `relogio.fixo` do teste novo do material sem série volta a `undefined` no `afterEach` (linha 147).

Recomendações:
- **Tabela do `8_task.md` com nome de teste que não existe mais.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/8_task.md:56`, a linha "volta do código" cita o teste "o bloco 1 é a única coisa que fecha o `processando`…". Ele foi renomeado para "um `falha` novo no lugar de `extracao_falhou` no bloco 1 é recusado pelo banco…". A mesma linha ainda diz que esse teste prova o "`licenciante` preenchido", e o `volta-da-f4.int.test.ts` deixou de conferir isso. O cabeçalho do teste explica por quê: a prova está nos testes da API, a herança em `material-edicao.int.test.ts` e o envio em `material.int.test.ts`.
  - Correção: atualizar o nome do teste e apontar o `licenciante` para esses dois testes.
- **Mesmo descompasso no `cenarios.md`.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/cenarios.md:185`, o cenário "Volta do código" ainda diz "`licenciante` preenchido". Ou se tira essa parte de lá, ou se diz que a prova vem do envio e da herança na API.
- **A mutação "herdar do passo 1" troca o protótipo da classe.** Ela atribui `MaterialRepository.prototype.seriesDoMaterial`, o que vale para o processo inteiro do teste mutado, e não só para a chamada. Funciona e está explicada no texto. Se o formato de bloco contíguo permitir, passar `seriesDoAlvo` direto para `#gravarEdicao` deixaria a mutação mais fiel ao que ela descreve.

## test-engineer · 2ª rodada · REPROVADO · 2026-11-13 15:06:01 · `tasks/prd-ingestao-do-material/8_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:** as cinco correções da 1ª rodada; o caso do aluno no `POST /:id/edicoes`; os três pontos de `volta-da-f4.int.test.ts`; os capítulos uma vez só no caso dos dois jobs; e cada linha da tabela de testes ligada a um teste que existe com aquele nome.

**Cobertos** (conferi contra o patch r1→r2 e o código atual; `material-edicao.int.test.ts` passou com 32 de 32):
1. **Mutação "tirar o `for update`":** o bloco existe e aponta o caso "edição C…". Sem a trava, C não espera, recebe `EDICAO_EM_ANDAMENTO` em vez de `NAO_ENCONTRADO`, e a espera pela trava (`esperarNaTrava '%for update%'`) não chega.
2. **Mutação "herdar do passo 1":** o bloco existe e aponta o caso "a edição parada depois de guardar o arquivo". Ele devolve `seriesDoAlvo` no lugar da leitura sob a trava, e o caso espera `[outraSerie]`.
3. **Cláusulas que faltavam bloco:**
   - `isNull(excluidoEm)` do `alvoDaEdicao`: bloco que aponta "alvo excluído". Sem a cláusula, o arquivo chega a ser guardado e `guardadas` muda.
   - `escolaId` do `travarAlvoDaEdicao`: bloco no teste do repository, linha 479.
   - `isNull(excluidoEm)` do `edicaoEmAndamentoSobre`: caso novo nas linhas 378–390, mais o bloco. Sem a cláusula, a edição presa e excluída gera um 409 e a próxima não sai 201.
4. **Isolamento:**
   - A escola B agora tem uma edição `processando` antes da pergunta da A (linha 473). Há também a contraprova na B, que dá `true` (linha 481), e o bloco que tira o `escolaId`.
   - Caso direto de `substituirAnterior` (linhas 489–501): na escola A dá `false` e a linha da B fica intacta; na B dá `true`. Tem bloco.
5. **Dois jobs:** agora usa `Promise.all` (linha 704), e os capítulos são contados uma vez (linhas 715–716).
6. **Material sem série** (linhas 392–413): a edição é 201 com `serieIds: []` e nenhuma linha em `material_serie`. Com a licença vencida, a resposta é `LICENCA_VENCIDA` e a recusa guarda `serieIds: []`. O `toMatchObject` com array vazio exige o mesmo tamanho, então a asserção vale. O bloco `if (true)` chama `gravarSeries([])`, que falha.
7. **Recomendações que a Mesa mandou aplicar:**
   - O motivo das três cláusulas que não morrem está escrito.
   - O caso do aluno existe (linhas 364–376), com a verificação de que nada foi guardado.
   - Em `volta-da-f4.int.test.ts`, o bloco 1 roda uma vez no `beforeAll`, e saiu a asserção do `licenciante`, que só conferia a linha que o próprio teste inseriu.
   - O caso dos capítulos uma vez só foi feito.
8. Sem `.skip`, sem mock que esconda a regra, e nenhum provedor de IA envolvido.

**Bloqueantes:**
1. **A linha "volta do código" da tabela cita um teste que não existe mais e promete o que nenhum teste citado prova.** Fica em `tasks/prd-ingestao-do-material/8_task.md:56`.
   - Ela cita "o bloco 1 é a única coisa que fecha o `processando`…". Nesta rodada esse teste foi renomeado para "um `falha` novo no lugar de `extracao_falhou` no bloco 1 é recusado pelo banco…" (`volta-da-f4.int.test.ts:186`).
   - Ela também promete "`licenciante` preenchido". A única asserção disso saiu de `volta-da-f4.int.test.ts` nesta rodada, e nenhum dos três testes citados prova mais esse item.
   - O mesmo item continua exigido em `tasks/prd-ingestao-do-material/cenarios.md:184`.
   - Quem prova hoje é o caso da herança em `material-edicao.int.test.ts:204` (`licenciante: 'Editora renomeada'`), e ele não está citado nessa linha.
   - O caso que de fato prova o bloco 1 ("o bloco 1 fecha o que está `processando`…", linha 156) também não está citado.
   - **Correção:**
     - Na linha 56, trocar o nome antigo pelo atual.
     - Citar o caso da linha 156.
     - Tirar "`licenciante` preenchido" da linha da volta e apontá-lo para "a edição herda disciplina, séries, titularidade e licença do alvo… o `licenciante` é o da licença", ou citar esse caso na mesma linha.
     - Ajustar `cenarios.md:184` do mesmo jeito: o `licenciante` preenchido é provado pela API, como o próprio cabeçalho de `volta-da-f4.int.test.ts` já diz.

**Recomendações:**
- **Bloco "herdar do passo 1"** (`8_task.md`, bloco de `material.service.ts:265`): ele troca `MaterialRepository.prototype.seriesDoMaterial` para o processo inteiro. Só não contamina outros casos porque o filtro roda um caso só. Um bloco que passe `seriesDoAlvo` direto para `#gravarEdicao` seria mais fiel à mutação descrita.
- **Bloco do `for update`:** o vermelho chega pela espera em `esperarNaTrava` que não termina, antes da asserção de `NAO_ENCONTRADO`. Isso vale, mas falta uma linha no documento dizendo que o resultado sem a trava seria 409 em vez de 404.
- **Caso "material sem série"** (linhas 405 e 411): `relogio.fixo = undefined` no meio do caso é redundante com o `afterEach`, que já zera o relógio. Pode sair.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/8_task.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/cenarios.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/db/volta-da-f4.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/material-edicao.int.test.ts`

## test-engineer · 3ª rodada · APROVADO · 2026-11-13 15:45:04 · `tasks/prd-ingestao-do-material/8_task.md`

VEREDITO: APROVADO

Cenários exigidos: os mesmos da rodada anterior. A correção desta rodada é a linha "volta do código" da tabela, mais o mesmo cenário em `cenarios.md`. Isso inclui o fechamento do `processando` pelo bloco 1, a lista da F4 lida pelo schema congelado, a recusa de um `falha` novo, o roll-forward do bloco 2 e o `licenciante` preenchido.

Cobertos:
- **Correção exigida 1, feita.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/8_task.md`, a linha "volta do código" cita agora os quatro testes pelo nome atual. Os quatro existem em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/db/volta-da-f4.int.test.ts`, nas linhas 156, 172, 186 e 196. Ela cita também o caso que prova o bloco 1, "o bloco 1 fecha o que está `processando`…", na linha 156. O nome antigo não aparece mais em lugar nenhum fora de `achados/`.
- **O `licenciante` saiu da linha da volta e foi para a linha "herança".** Essa linha cita "a edição herda disciplina, séries, titularidade e licença do alvo…" (`material-edicao.int.test.ts:204`). Esse caso renomeia a licença por SQL e afirma `licenciante: 'Editora renomeada'` na linha 223, então prova o item de fato e não só que o código rodou.
- **`cenarios.md:184-187` foi ajustado do mesmo jeito.** O cenário descreve o que o bloco 1 prova e aponta o `licenciante` para a herança da "Edição nova" e para o envio da 7.0.
- **Recomendação aplicada: o bloco "herdar do passo 1".** Agora ele troca `seriesDoMaterial` pelo protótipo, com `finally` que devolve a original, e declara `falha: expect(resposta.corpo['serieIds']).toEqual([outraSerie])`. Essa asserção existe em `material-edicao.int.test.ts:750`, no caso da linha 718, e é exatamente a cláusula que a mutação derruba. O texto explica por que não dá para passar `seriesDoAlvo` como argumento: o bloco precisa ser um trecho contíguo e não atravessa a linha em branco. A explicação confere com o código: a chamada está em `material.service.ts:265` e a leitura `herdadas` na linha 280.
- **Recomendação aplicada: 409 e não 404 sem o `for update`.** O texto foi escrito na tabela e em "Mutações", e confere com `material.service.ts:279`.
- **Recomendação aplicada: o `relogio.fixo = undefined` redundante saiu do caso sem série.** Tirar a linha é seguro, porque o `afterEach` em `material-edicao.int.test.ts:145-147` já zera o relógio.
- Nenhum código de produção mudou nesta rodada. Nenhum `.skip`, nenhum teste comentado e nenhum mock novo.

Bloqueantes: nenhum.

Recomendações:
- O texto de "Mutações" aponta `material.service.ts:276-279`, mas a checagem de `EDICAO_EM_ANDAMENTO` sob a trava está na linha 279. Vale citar só a 279, ou o nome `edicaoEmAndamentoSobre`, que não envelhece quando o arquivo muda.

## revisor-geral · 3ª rodada · APROVADO · 2026-11-13 15:45:05 · `tasks/prd-ingestao-do-material/8_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

Esta foi uma rodada nova, então auditei só o diff da rodada 2 para a 3. Nenhum código de produção mudou; a rodada anterior não pediu correção. O que mudou foi isto:

- **Teste.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/material-edicao.int.test.ts` saiu a linha `relogio.fixo = undefined` de dentro do caso. Ela era redundante: o `afterEach` (linha 147) já zera o relógio depois de cada caso. A ordem do caso não muda, e `esperarExtracao` (linha 411) não depende do relógio.
- **Tabela da tarefa.** A linha "volta do código" agora cita os quatro casos de `volta-da-f4.int.test.ts`, com os mesmos nomes que estão no arquivo (linhas 156, 172, 186 e 196). O "licenciante preenchido" passou para a linha "herança", com o motivo escrito. Isso fecha a recomendação da rodada 2.
- **Cenário.** `cenarios.md`, no cenário "Volta do código", foi alinhado ao mesmo texto. A seção da `techspec.md` sobre a 8.0 (linha 195) já descrevia o bloco 1, o bloco 2 e o teste `volta-da-f4.int.test.ts`, então não falta nada lá.
- **Mutação "herdar do passo 1".** Ganhou a linha `falha:` e um `finally` que devolve a função original do protótipo, para a troca não vazar para o caso seguinte. O motivo de não passar `seriesDoAlvo` como argumento está escrito no documento.
- **Mutação do `for update`.** O texto agora explica por que o teste fica vermelho em `esperarNaTrava` e não chega a ver o 409. A referência ao `#gravarEdicao` confere com o código atual do service.

Recomendações:
- `8_task.md`, parágrafo novo de "Mutações": a referência `material.service.ts:276-279` está escrita como número de linha e vai ficar velha na primeira edição do service. Melhor apontar pelo nome (`#gravarEdicao`, a checagem `edicaoEmAndamentoSobre`).
- O bloco "herdar do passo 1" troca uma função no protótipo do repository a partir de código de produção. Funciona como mutação e o `finally` limita o efeito, mas, se o service um dia passar a receber o repository por injeção, vale trocar o bloco pela versão por argumento.
