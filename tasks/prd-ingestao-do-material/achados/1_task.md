# Achados das revisões — `tasks/prd-ingestao-do-material/1_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-11 13:37:30 · `tasks/prd-ingestao-do-material/1_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A tarefa não toca `nota`, `lancadaPor` nem caminho de job, seed, importação ou webhook que grave nota. Todos com autor humano? Não se aplica, porque não há caminho novo nem alterado.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok, nada a aprovar. O job `material.extrair-pdf` não usa IA. Ele lê o PDF com `pdfjs-dist` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/material/pdf-extractor.ts:2`) e grava em `trecho` o material que a coordenação enviou (D75). Isso é conteúdo da escola, não saída de IA, e não pede a aprovação do item 3. O processador (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/src/processors/extrair-pdf.ts:1-16`) e o repository (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/material/extracao.repository.ts:1-7`) não importam nenhum provedor de modelo.

Supervisão do tutor: ok. A tarefa não muda o tutor. A única citação é um comentário do `infra/compose.yml` sobre limitar a CPU do `worker-pdf`, para a leitura do PDF não tomar a máquina do Tutor.

Autonomia declarada e visível: sim, sem mudança. A tarefa não cria agente nem muda autonomia.

Bloqueantes: nenhum.

Os outros pontos da regra 70 também não são alcançados:
- **Discursiva e redação (D55):** nenhum campo, tela ou prompt de nota.
- **Vigilância:** nenhuma inferência sobre aluno. As colunas novas `processado_em` e `objeto_apagado_em` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/drizzle/0049_material_extracao_no_worker.sql`) são instantes técnicos do material.
- **Medir o professor (D45):** nenhum indicador de professor. A métrica nova só leva o resultado da extração, sem escola nem material.
- **`docs/regulacao.md`:** não foi alterado.

Recomendações:
- A tarefa não lista o `conformidade-reviewer` entre os subagentes obrigatórios, e isso está certo: não há nota, correção, tutor, autonomia nem indicador de professor. Quando a 4.0 (capítulos) ou outra tarefa da F4 ligar `trecho` ao Assistente ou ao Tutor, vale chamar o revisor de novo. Isso vale para a busca, para a citação até a página (D6) e para o que fica disponível ao aluno.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-11 13:37:41 · `tasks/prd-ingestao-do-material/1_task.md`

VEREDITO: APROVADO

Tabelas verificadas:
- `material`: ganhou as colunas `processado_em` e `objeto_apagado_em` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/drizzle/0049_material_extracao_no_worker.sql`). A tabela já tem `escola_id`. Ela não varia por ano letivo, e isso está escrito no docblock do schema.
- `trecho`: continua gravado com `escolaId` vindo do contexto.
- `job_registro` e `configuracao_operacional_escola`: só os checks foram alargados para aceitar `pdf`.
- Nenhuma tabela nova de domínio.
- Os ids continuam UUID. O `uuidV7` da aplicação tem 74 bits ao acaso e não é sequencial.

Queries verificadas:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/material/extracao.repository.ts`: `lerParaExtrair`, `marcarPronto`, `marcarFalhou`, `gravarTrechos`, `marcarObjetoApagado` e `excluidosComObjeto`. Todos pegam a escola de `requireEscolaId()`, nenhum recebe escola por parâmetro, e sem escola no contexto a chamada falha (o teste prova isso).
- `chaveDoTemporario` (`packages/core/src/material/temporario.ts`) monta a chave com a escola do contexto. Por isso o job da A não alcança o objeto da B, mesmo que o repository falhasse.
- O worker pega a escola de `job_registro` pelo executor. O payload leva só `materialId` (`z.strictObject`), e o outbox lê a escola de `currentContext()`.
- Na API, `enviar` e `excluir` (`apps/api/src/material/material.service.ts`) usam a escola da sessão. O objeto só é apagado depois que `excluir` acha o material dentro do escopo; o id de outra escola continua dando 404 `NAO_ENCONTRADO`, sem diferença em relação ao id inexistente.
- No expurgo (`apps/worker/src/processors/expurgar-escola.ts`), o repository é montado uma vez e lê a escola do contexto a cada chamada.
- Controller e contrato não mudaram: nenhum `escolaId` entra pelo corpo nem pela query string.
- O `@Unscoped` de `MaterialParadoRepository` saiu junto com a varredura antiga. Não entrou nenhum `@Unscoped` novo.
- Nada aqui toca a camada de rede.

Teste de isolamento: presente e efetivo. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/test/extrair-pdf.int.test.ts`:
- Linhas 415-425: sem a cláusula de escola em `lerParaExtrair`, o material da B é achado e o `toBeUndefined` quebra.
- Linhas 427-442: sem a cláusula de escola, `marcarPronto`, `marcarFalhou`, `marcarObjetoApagado` e `excluidosComObjeto` alcançam a linha da B, e os `toMatchObject`, `toBeNull` e `toEqual([])` quebram.
- Linhas 465-475: o job da A com o id da B. Sem o escopo, o material da B vira `falhou` e a asserção `estado: 'processando'` quebra.
- `apps/worker/test/expurgo-da-escola.int.test.ts`: o excluído da B segue com o objeto e com `objeto_apagado_em` nulo depois do expurgo da A.

Bloqueantes: nenhum.

Recomendações:
1. O índice `material_objeto_a_apagar_idx` (`packages/core/src/db/schema/material.ts`, migration 0049) não começa por `escola_id`. Ele serve à varredura entre escolas da 2.0, que vai precisar de `@Unscoped` com justificativa escrita. Convém deixar isso explícito na 2.0 e auditar lá.
2. Falta um caso na API em que a coordenação da A exclui o id de um material `processando` da B e o objeto da B continua no storage. Hoje isso está coberto só indiretamente, pela chave com a escola do contexto e pelo 404 do `excluir`.
3. O UUIDv7 expõe na URL o instante em que o material foi criado. Não entrega volume e segue o padrão do `uuidv7()` que o Postgres já usa nas outras tabelas, mas o fato poderia ficar registrado no `docs/lgpd.md`.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-11 13:38:10 · `tasks/prd-ingestao-do-material/1_task.md`

VEREDITO: APROVADO

A tarefa 1.0 não tem bloqueante. Ela não cria campo de pessoa, não manda nada para fora do sistema e o PDF não sobra no storage em nenhum caminho que esta tarefa cobre. Três pontos ficam como recomendação, nenhum de violação.

**Campos pessoais tocados:** nenhum campo de pessoa novo. As colunas novas `material.processado_em` e `material.objeto_apagado_em` só guardam instantes técnicos. O PDF temporário é material didático da escola, guardado no storage privado com chave `material-temporario/<escola>/<material>`, só ids, montada com a escola do contexto (`packages/core/src/material/temporario.ts:9`). A saída da API (`colunas` em `apps/api/src/material/material.repository.ts`) não mudou e não expõe as colunas novas.

**Fora da tabela de dados do docs/lgpd.md:** nada. A linha "Material da escola" (`docs/lgpd.md:101`) passou a descrever o PDF temporário, o bucket privado sem versionamento e as duas colunas. As duas colunas também entraram em `fora` do arquivo do titular (`packages/core/src/titular/leitura-do-titular.ts:393-394`).

**Autorização por objeto:** ok.
- As rotas da API não mudaram. A exclusão segue dando 404 para o que não é da escola.
- No worker, a escola vem do contexto do job e nenhum método recebe escola. Todo método de `ExtracaoDoMaterialRepository` filtra por `escola_id`, inclusive `marcarObjetoApagado` e `excluidosComObjeto`.
- O isolamento tem teste no repository e no job: o job da escola A com o id de um material da B não lê, não grava e não apaga nada. As mutações declaradas tiram o `escola_id`.

**Logs:** limpos. As linhas levam `materialId`, tentativa, código, contagens e `summarizeError`, que guarda só o tipo do erro e a pilha filtrada, sem mensagem. A métrica leva só `resultado`. Testes com sentinela de título, licenciante, nome de arquivo e texto do PDF: `apps/worker/test/extrair-pdf.int.test.ts:479`, `:495` e `apps/api/test/material.int.test.ts:804`.

**Auditoria:** presente. `material.enviado` e `material.excluido` continuam gravados na mesma transação. A exclusão agora guarda também o `estado`. Apagar o objeto é rotina técnica e não é ato que a regra 20, item 10, mande auditar.

**Envio externo:** nenhum. A extração roda local no worker, com pdfjs. O job leva só `{ materialId }`.

**Seed/fixture:** sintético. Os testes usam o PDF de demonstração, PDFs montados no próprio teste e título sentinela.

**Demais itens do checklist:**
- **Bucket privado:** o objeto vai com `ContentDisposition: attachment` e `CacheControl: no-store`. Nenhuma URL assinada é gerada para o PDF.
- **Erro sem dado:** com o storage fora, o envio responde 503 `INDISPONIVEL_TENTE_DE_NOVO` com `Retry-After`, sem gravar linha nem job.
- **O objeto sai do storage:** depois do commit da extração, na falha definitiva, na exclusão de material `processando` e no expurgo noturno dos excluídos (dentro da janela, em lotes, com cursor). Cada um desses caminhos tem teste.

**Pergunta de fechamento:** responde. O PDF não é dado de aluno e não foi a lugar nenhum fora do storage privado, onde fica até a extração. Do material ficam os metadados, e o arquivo do titular já os cobre (`enviado_por`, `excluido_por`, licenciante).

**Bloqueantes:** nenhum.

**Recomendações:**
1. **O teste não prova "sem versionamento".** `packages/core/src/titular/s3-file-storage.int.test.ts:53` diz que o objeto não tem versão. Só que o `GetObject` depois do `DeleteObject` devolveria ausente mesmo com o versionamento ligado, por causa do marcador de exclusão. Sugestão: conferir `GetBucketVersioning` diferente de `Enabled`, ou `ListObjectVersions` vazio depois de apagar. Hoje só a configuração padrão do SeaweedFS e o `docs/infra.md:280` sustentam isso.
2. **O texto da LGPD já conta com a varredura da 2.0.** `docs/lgpd.md:101` diz que o órfão "sai pela varredura em até 25 h". Nesta tarefa esse objeto ainda não tem saída: o envio que a transação recusou e o storage não deixou apagar (`apps/api/src/material/material.service.ts:149`), e a última tentativa morta por SIGTERM. Garantir que a 2.0 entre na mesma spec, antes do merge na `develop`.
3. **O órfão do envio não deixa rastro.** O `.catch(() => undefined)` em `apps/api/src/material/material.service.ts:149` engole a falha. Sugestão: um `logger.warn({ evento: 'material.objeto_nao_apagado', materialId: id, erro: summarizeError(erro) })`, como já se faz na exclusão.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-11 13:39:42 · `tasks/prd-ingestao-do-material/1_task.md`

VEREDITO: APROVADO
Caminho quente tocado: fila | migration | deploy
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok
Bloqueantes: nenhum

Recomendações:
1. `packages/core/drizzle/0049_material_extracao_no_worker.sql:10-15`: o `NOT VALID` seguido de `VALIDATE` não alivia trava nenhuma. O `migrate.ts` aplica todas as migrations numa transação só, então o `DROP` e o `ADD CONSTRAINT` seguram `ACCESS EXCLUSIVE` em `job_registro` e `configuracao_operacional_escola` até o commit, e o `VALIDATE` varre a tabela debaixo dessa trava. Hoje isso é seguro, porque `job_registro` passa pelo expurgo e o deploy roda fora do horário letivo, e a 0042 e a 0047 já fazem igual. Mesmo assim, o comentário da migration promete mais do que o código entrega. Quando houver staging ou piloto, o `VALIDATE` deve ir para uma migration separada, ou o comentário deve dizer o que de fato acontece.
2. `packages/core/src/db/schema/material.ts:71` (`material_objeto_a_apagar_idx`): o índice é `(processado_em, excluido_em)` e não começa por `escola_id`. Não reprova, porque `material` não cresce com aluno e o índice parcial é pequeno. Mas a varredura da 2.0 precisa ser `@Unscoped` e ter um `EXPLAIN` mostrando que usa esse índice. Para o `excluidosComObjeto` do expurgo, conferir com `EXPLAIN` que ele usa o `material_excluido_idx`.
3. Capacidade da fila `pdf`: há uma réplica só, com pool 1 e vaga por escola 2. Como a vaga é maior que o pool, quem limita de fato é a réplica. Um PDF que estoura o prazo três vezes segura a ingestão de todas as escolas por cerca de 30 minutos, e o worker-pdf parado para toda a fila. A corrida das 300 apostilas fica para a 9.0, que precisa medir isso e dizer no `docs/infra.md` quantas réplicas o onboarding pede. O alerta de idade da fila `pdf` (3.0) também precisa pegar esse caso.
4. Entre esta tarefa e a 2.0 não há varredura de material `processando` parado: a da API foi removida aqui e só volta no worker. O material que fica `processando` (SIGTERM na última tentativa, ou o limite de stalled do BullMQ) conta no teto `MATERIAIS_EM_PROCESSAMENTO_POR_ESCOLA = 3` e pode bloquear o envio da escola. A spec precisa pousar com a 2.0 junto, sem pouso parcial.
5. Rollback: depois do deploy, sobram linhas de `job_registro` com `fila = 'pdf'` e tipo `material.extrair-pdf`, que o código anterior não conhece. Vale um parágrafo no runbook dizendo que o despachante antigo não as reserva, ou o que fazer com elas, para o rollback continuar sendo um comando.
6. `packages/core/src/queue/job-outbox.ts:7` (`pdf: 4`): a prioridade não tem efeito, porque a `pdf` é uma fila do BullMQ só dela. Ou se diz isso no comentário, ou se tira a impressão de que ela compete com as outras filas.

Não rodei as suítes, nem a de integração nem a de carga. O veredito vem da leitura do diff e dos nomes dos casos em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/test/extrair-pdf.int.test.ts`.

Arquivos lidos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/src/processors/extrair-pdf.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/material/extracao.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/drizzle/0049_material_extracao_no_worker.sql`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/src/processors/expurgar-escola.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/infra/compose.yml`

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-11 13:40:15 · `tasks/prd-ingestao-do-material/1_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em `techspec.md` §11, linha "1.0": duas promessas apontam para a 2.0, e o `2_task.md` contradiz uma e não prevê a outra.
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

**Bloqueantes:**

1. **O `processando` sem job vivo fica preso para sempre.** A tarefa tira a varredura de `processando` parado da API e registra em dois lugares que "a varredura da 2.0 o fecha": na linha 1.0 do §11 da `techspec.md` e no `cenarios.md`, linhas 67-68. Diz o mesmo em `apps/worker/test/extrair-pdf.int.test.ts:624`. A 2.0 não planeja isso. O `2_task.md:54` declara o contrário: "`processando` 25 h … fica". A varredura da 2.0 só pega material com `processado_em` ou `excluido_em` preenchido (onda 3b, linha 97). Sobram dois casos sem ninguém para fechar:
   - **SIGTERM além da graça na última tentativa.** O teste prova o desfecho em `extrair-pdf.int.test.ts:630-633`: job `falhou/EXECUCAO_INTERROMPIDA`, material `processando` e o objeto no storage, sem prazo para sair. Isso fere o RF13, que pede o objeto apagado em todo caminho, e o §7c "Estados" da Tech Spec.
   - **O `processando` que a API antiga deixou no deploy.** Não tem objeto nem job, então nada o fecha. A 3.0 só descarta job que existe.
   
   Nos dois casos o material conta no teto `MATERIAIS_EM_PROCESSAMENTO_POR_ESCOLA = 3` (`apps/api/src/material/material.service.ts:37`). Três presos bastam para a escola não enviar mais nada, sem fim.

   **Correção exigida:**
   - Decida quem fecha esse `processando`, com `falhou`, `processado_em` e o objeto apagado, e escreva essa decisão no lugar certo. Pode ser uma subtarefa nova na 2.0, com o caso no `2_task.md` separando esse material do "`processando` 25 h fica". Pode ser nesta tarefa, por exemplo na migration para o legado e no processador ou executor para o SIGTERM.
   - Corrija junto os textos que hoje citam a 2.0: a linha 1.0 do §11 da `techspec.md`, o `cenarios.md:68`, o comentário de `extrair-pdf.int.test.ts:624` e o docblock prometido no item 7 da autoconferência.
   - Se a escolha for a 2.0, ela precisa constar no `2_task.md` antes do commit desta tarefa.

**Recomendações:**
- `apps/api/src/material/material.service.ts`: o `catch` do envio engole a falha do `apagar` com `.catch(() => undefined)`, sem log. Registre o id do material, como `#apagarObjetoDoExcluido` já faz com `material.objeto_nao_apagado`. O docblock de `enviar` também diz que o objeto "fica órfão" quando a transação falha, mas o código tenta apagá-lo antes. Alinhe o texto ao código.
- `infra/compose.yml`: o comentário do serviço `worker-pdf` diz que o `docs/infra.md` informa quantas réplicas as 300 apostilas pedem. O documento não traz esse número, que é da 9.0. Tire a referência ou aponte para a 9.0.
- `packages/core/src/db/schema/material.ts`: o índice `material_objeto_a_apagar_idx` não começa pela escola. Para a varredura da 2.0, que roda sem escopo, ele faz sentido. Já `excluidosComObjeto` filtra por escola e se apoia no `material_excluido_idx`. Vale uma linha dizendo isso, para o índice não parecer furo da regra 80, item 8.
- Os tetos do §7c (100 envios por hora por pessoa, 300 por escola, 300 pendentes por escola) não estão em nenhuma tarefa do `tasks.md`, e o código segue com 30, 60 e 3. Não é desta tarefa, mas o planejamento precisa dar dono a eles.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/2_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/test/extrair-pdf.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/src/processors/extrair-pdf.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/infra/compose.yml
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/db/schema/material.ts

## test-engineer · 1ª rodada · REPROVADO · 2026-11-11 13:41:05 · `tasks/prd-ingestao-do-material/1_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- Caminho feliz: `pronto`, os trechos, as duas colunas, e o objeto apagado só depois do commit.
- Prazo, com `TEMPO_ESGOTADO` em cada tentativa e `falhou` na 3ª.
- SIGTERM além da graça, com tentativa sobrando e na última.
- Falha final.
- `sem_texto` e `arquivo_invalido` em uma tentativa só.
- Objeto ausente de material `processando` (R6).
- Objeto ausente, ou objeto presente, de material que já saiu de `processando` ou foi excluído.
- [P] Material excluído entre `lerParaExtrair` e `lerBytes`.
- [P] Material excluído durante a extração.
- [P] Segundo job parado até o primeiro dar commit.
- [P] Dois jobs do mesmo material em `Promise.all`.
- Job repetido depois de `pronto`.
- Exclusão em `processando`, também com o storage fora.
- Envio: o objeto é gravado e o job é pedido; 503 com o storage fora; o objeto órfão é apagado quando a transação recusa.
- Vaga por escola: A com 10 pendentes não segura a B.
- Checks da migration.
- Configuração: vaga 2, pool 1, `lockDuration`, stalled, e o worker-pdf não sobe sem o storage.
- Isolamento no repository e no job.
- Expurgo: A e não B, a janela letiva, o storage recusando, lotes.
- Log e métrica só com ids e códigos.

**Cobertos:**
- Quase todos têm teste que olha o resultado: a linha do material, os trechos, o objeto no storage, a métrica por `resultado` e o log.
- Os [P] têm a ordem forçada de verdade, com o gancho `aoLerBytes` e a barreira. O `Promise.all` junta os dois jobs com os bytes na mão, então é concorrência real e não duas chamadas em sequência.
- O prazo, o SIGTERM e a vaga passam pelo worker de verdade.
- Nenhum `.skip`, `.only` ou `any` no diff. Nenhum provedor de IA envolvido.
- O `--faltando` lista 10 linhas, e as 10 estão entre as "Sem bloco, com o motivo".
- Rodei `apps/worker/test/extrair-pdf.int.test.ts` (28 de 28 passaram) e `apps/api/test/material.int.test.ts` (45 de 45 passaram).

**Bloqueantes:**

1. **`apps/api/test/material.int.test.ts:769`**: "excluir um material `processando` apaga o objeto e registra; o job que chega depois não grava nada".
   - O que está errado: a parte "o job que chega depois não grava nada" tem uma asserção que sempre passa. O `esperarExtracao` (`apps/api/test/material.fixture.ts`) só roda o job dos materiais cujo objeto ainda está no armazém. Depois do DELETE o objeto já saiu, então nenhum job roda, e o `trechosDa(...) == []` da linha 781 nunca deixaria de passar. Se a exclusão não apagasse o objeto, o job rodaria e sairia sem efeito: também passaria. Isso viola a regra 40, item 5.
   - Correção exigida: rodar o processador `material.extrair-pdf` para esse `id` de forma explícita, no contexto da escola, depois da exclusão, e conferir que o resultado é `sem_efeito` e que o estado e os trechos ficam como estão. Ou então tirar a cláusula do nome do caso e da linha "exclusão em `processando`" da tabela, apontando para o caso do worker que já prova isso: "objeto ausente de material que já saiu de `processando` (… excluído)".

2. **`packages/core/src/queue/queues.ts:40`** (`pdf: { lockDurationMs: 60_000, stalledIntervalMs: 30_000 }`) e a linha "configuração" da tabela de testes do `1_task.md`.
   - O que está errado: a linha da tabela diz que prova "`worker-pdf` um por vez, `lockDuration`, stalled". Nenhum dos casos citados olha `lockDuration` ou stalled: nem `config.test.ts`, nem `composition.test.ts`, nem `ambiente.test.ts`, nem `compose.int.test.ts`. Nenhum teste do repositório lê `WORKER_POOL_OPTIONS_BY_QUEUE`. São dois itens da linha sem teste nenhum.
   - Por que importa: o lock de 60 s é o que impede a extração, que ocupa a CPU sem parar, de ser dada por parada e rodar duas vezes.
   - Correção exigida: um teste de unidade que fixe `WORKER_POOL_OPTIONS_BY_QUEUE.pdf` (lock maior que o intervalo de stalled, com os valores declarados) e que mostre que `apps/worker/src/composition.ts:209-210` os passa ao `Worker` da fila `pdf`. A alternativa é tirar os dois itens da tabela e registrar o motivo na seção "Mutações".

**Recomendações:**
- **Isolamento do job**, `apps/worker/test/extrair-pdf.int.test.ts:465`: a tabela diz "nada lido", mas não há contagem de leituras. Contar com `aoLerBytes` e esperar zero. Hoje o caso não falharia sem a cláusula de escola em `lerParaExtrair`, porque a chave do objeto vem da escola do contexto. Quem prova essa cláusula é o caso do repository.
- **[P] segundo job parado**, `extrair-pdf.int.test.ts:312`: o caso só funciona se o segundo job ler a linha antes de o primeiro dar commit. Se a ordem se inverter, `segundoChegou` nunca solta e o caso estoura o tempo. Segurar também a primeira leitura até a segunda chegar tira essa dependência da ordem.
- **Recusa do envio**, `material.int.test.ts:760`: o nome diz "(teto, duplicado)", mas só o duplicado é exercitado. Falta um caso com o teto de `processando`.
- **Envio concorrente**, `material.int.test.ts:361` ("dois envios do mesmo arquivo ao mesmo tempo gravam um"): conferir também que o armazém não ficou com objeto órfão e que há um só `job_registro` de `material.extrair-pdf`.
- **Falha final**: nenhum caso mostra o job terminando `falhou` pelo caminho `ERRO_INTERNO` (o `extracao_falhou` que sobe). Os casos chamam o processador direto. Só o prazo passa pelo worker e chega ao estado do job.
- **Migration 0049, linha 9** (`UPDATE material SET objeto_apagado_em = enviado_em`): esse preenchimento dos materiais antigos não tem teste e não aparece no "Plano". Basta citá-lo no plano, ou dar um caso a ele.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-11 14:36:26 · `tasks/prd-ingestao-do-material/1_task.md`

VEREDITO: APROVADO

Tabelas verificadas: `material` (`escola_id` presente; a 0049 não cria tabela nova, só acrescenta as colunas técnicas `processado_em` e `objeto_apagado_em` e dois `UPDATE`). Também `trecho` e `job_registro`, pelo caminho do processador. `material` não varia por período, então não precisa de `anoLetivoId`. Os ids continuam UUID (UUIDv7 da aplicação, agora registrado no `docs/lgpd.md`).

Queries verificadas:
- **Os dois `UPDATE` da migration 0049.** Estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/drizzle/0049_material_extracao_no_worker.sql:546-547`. Rodam entre escolas, mas são migração de dados num passo só, sem contexto de requisição. Só mudam `estado`, `falha`, `processado_em` e `objeto_apagado_em` de cada linha. Não mexem em `escola_id`, não copiam nem movem dado entre escolas e não leem nada de volta. O filtro `estado = 'processando'` pega só o legado da API anterior, que não tinha job nem objeto. O excluído que estava `processando` também vira `falhou`, o que é inofensivo e o teste cobre. O único efeito fora da própria linha é liberar o reenvio do mesmo arquivo. Esse efeito fica dentro da escola, porque `material_arquivo_na_escola_unico` é `(escola_id, sha256)` e exclui `falhou`. É seguro.
- **`ExtracaoDoMaterialRepository`.** `lerParaExtrair`, `marcarPronto`, `marcarFalhou`, `marcarObjetoApagado` e `excluidosComObjeto` continuam com `escola_id = requireEscolaId()`, e nenhum método recebe a escola por parâmetro. O processador mudou em dois pontos, `quandoAbortar` e o `sinal` padrão. Nenhum dos dois cria caminho novo até o banco, e o fechamento na última tentativa continua passando por `marcarFalhou`, que tem escopo.
- **`material.service.ts:150`.** O log do objeto que não foi apagado leva só o `materialId` e o resumo do erro. Não leva a chave nem a escola de outro tenant.
- **Índice `material_objeto_a_apagar_idx`.** O comentário diz por que ele não começa pela escola e põe o `@Unscoped` com justificativa na 2.0. Não há `@Unscoped` novo nesta rodada.

Teste de isolamento: presente e efetivo.
- **API, `material.int.test.ts:195`.** A coordenação da A exclui o material da B que está `processando` e recebe 404 `NAO_ENCONTRADO`, a mesma resposta de um id inexistente. O objeto e a linha da B continuam lá. Sem a cláusula de escola na exclusão, viria 204 e o objeto sairia, então o teste quebra.
- **Worker, `extrair-pdf.int.test.ts:503`.** O teste agora conta as leituras do storage e exige zero. Sem `escola_id` no `lerParaExtrair`, o job da A leria o objeto da B e o teste quebraria.

Bloqueantes: nenhum.

Recomendações:
1. O teste dos `UPDATE` da migration, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/test/extrair-pdf.int.test.ts:399` e `:406`, acrescenta ao SQL o filtro `"escola_id" = $1` antes de executar. Por isso a afirmação de que o material de outra escola não muda só prova o filtro do próprio teste, não a migration, que é sem filtro de propósito. Reescrever a linha em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/cenarios.md` ("e o de outra escola não muda"), ou tirar a asserção. Do jeito que está, ela sugere uma garantia de isolamento que o teste não dá.
2. O comentário da 0049 poderia dizer que os dois `UPDATE` são, de propósito, entre todas as escolas e só no estado da própria linha. Assim quem lê não procura o escopo que falta.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-11 14:36:27 · `tasks/prd-ingestao-do-material/1_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. O diff desta rodada não grava em `Nota` por nenhum caminho: o processador `material.extrair-pdf`, o envio e a exclusão na API, a migration `0049` e as fixtures de teste não tocam `Nota`. Todos com autor humano? Não se aplica.
Decisão autônoma sobre aluno: ausente. O `UPDATE` novo da migration `0049` (`processando` passa a `falhou`/`extracao_falhou`) muda o estado de um material da escola, não a trajetória de nenhum aluno.
Aprovação registrada: ok. Nenhuma saída de IA nasce neste diff. A extração do PDF é leitura de texto sem modelo, e a exceção da D47 não aparece em nenhum agente.
Supervisão do tutor: ok. O tutor não foi tocado. Ele só é citado no comentário do `worker-pdf` em `infra/compose.yml`, que trata da divisão de CPU.
Autonomia declarada e visível: sim. Nada mudou na governança nem na declaração de autonomia dos agentes.
Bloqueantes: nenhum.

O que conferi nesta rodada nova:
- **Correções exigidas na 1ª rodada:** não havia nenhuma.
- **A recomendação da 1ª rodada:** chamar de novo este revisor quando a 4.0, ou outra tarefa da F4, ligar `trecho` ao Assistente ou ao Tutor. Ela está registrada em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/1_task.md`, com a 4.0 como dona.
- **Itens 7, 8 e 9:** as linhas novas de log do envio (`material.objeto_nao_apagado`) levam só id, evento e erro. Não há inferência sobre aluno, métrica de professor, ranking nem nada que alcance a conversa do professor.
- **D55:** nenhum campo, tela ou prompt de nota ou devolutiva sobre discursiva ou redação.
- **`docs/regulacao.md`:** não mudou nesta rodada.
- **Fotos da tela:** a tarefa não tem tela e o prompt não trouxe fotos.

Recomendações:
- Mantém-se a da 1ª rodada: quando a 4.0 ligar os trechos extraídos ao Assistente ou ao Tutor, chamar o `conformidade-reviewer`. O ponto a conferir é que o texto do material chega ao modelo como dado, não como instrução (regra 70, item 4c, por analogia), e que a resposta do Tutor apoiada em trecho continua supervisionada (item 4).

Arquivos lidos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/.processo/ordens/diff-r1-r2.patch`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/src/processors/extrair-pdf.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/drizzle/0049_material_extracao_no_worker.sql`

## privacy-guardian · 2ª rodada · REPROVADO · 2026-11-11 14:37:17 · `tasks/prd-ingestao-do-material/1_task.md`

VEREDITO: REPROVADO

**Campos pessoais tocados:** nenhum campo novo. Mudaram a linha "Material da escola" de `docs/lgpd.md` (a nota sobre o UUIDv7) e as colunas técnicas `processado_em` e `objeto_apagado_em`, que a migration 0049 agora preenche. Dado de aluno não entra.

**Fora da tabela de dados do docs/lgpd.md:** nenhum campo. A linha do material, porém, ficou com a retenção do PDF errada depois desta rodada (bloqueante abaixo).

**Autorização por objeto:** ok.
- O caso novo em `apps/api/test/material.int.test.ts` testa a coordenação da escola A apagando o id de um material `processando` da escola B. A resposta é o mesmo `404 NAO_ENCONTRADO` de um id que não existe, e o objeto e a linha da B ficam intactos.
- O job da escola A com o id de um material da B agora conta as leituras do storage, e elas dão zero.

**Logs:** limpos.
- `material.objeto_nao_apagado` (`apps/api/src/material/material.service.ts:150`) leva só o `materialId` e o resumo do erro. `summarizeError` (`packages/core/src/error/summarize-error.ts:49-66`) devolve tipo, sqlstate, constraint e as linhas da pilha, nunca a mensagem. O teste confirma que a chave do storage não aparece no log.
- Os logs do processador (`apps/worker/src/processors/extrair-pdf.ts:97, 128, 139, 144, 150`), inclusive no aborto e no fechamento da última tentativa, levam só ids, tentativa, código e o resumo do erro.

**Auditoria:** presente. Nada nesta rodada muda ação que exija auditoria.

**Envio externo:** nenhum. A extração do PDF é local, sem IA.

**Seed/fixture:** sintético. `extrairMaterial` e os casos novos usam o PDF de demonstração e as variações dele.

**O que você pediu para conferir:**
- **Migration 0049:** o `processando` legado não deixou objeto. A API anterior segurava os bytes na memória do processo (`git show HEAD:apps/api/src/material/extraction-queue.ts`, linha 39) e nunca gravou no storage. O primeiro `UPDATE` ainda põe `objeto_apagado_em = enviado_em` em toda linha antiga, então nada antigo entra na varredura. O teste roda os dois `UPDATE` só na escola do caso e confirma que outra escola não muda.
- **Teste de versionamento do S3:** confere o status do bucket e que, depois de apagar, não sobra versão nem marcador de exclusão. Está bom.
- **Nota do UUIDv7:** bate com `packages/core/src/material/uuid-v7.ts` (instante em ms e 74 bits aleatórios, não sequencial).

**Bloqueantes:**

1. **`docs/lgpd.md:101`: a retenção do PDF diz o contrário do novo desenho.**
   - **O que está escrito:** "O objeto de um envio que não virou linha, ou de um job que nunca rodou, sai pela varredura em até 25 h".
   - **O que mudou nesta rodada:**
     - A varredura da 2.0 passou a olhar só o objeto de material `pronto`, `falhou` ou excluído (`techspec.md:182`, e o índice parcial em `packages/core/src/db/schema/material.ts:73`).
     - O material que fica `processando` com o objeto, porque o processo morreu na última tentativa ou porque o job não chegou a rodar, só sai pelo "Descartar" da 3.0, um comando manual disparado pelo alerta (`3_task.md:25, 49`).
     - O caso SIGTERM do processo morto (`apps/worker/test/extrair-pdf.int.test.ts`, cerca da linha 483) prova isso: depois do job `falhou`, o material segue `processando` e o objeto fica.
   - **Por que bloqueia:** a escola, como controladora, recebe pelo dossiê um prazo de 25 h que o código não cumpre. Para esse caso não há prazo no código: o objeto fica até alguém rodar o comando.
   - **Correção exigida, uma das duas:**
     - (a) corrigir a linha: o objeto de material `processando` cujo job falhou de vez, ou nunca rodou, sai pelo "Descartar" da 3.0, acionado pelo alerta de job falhou de vez, sem prazo automático; e dizer que a varredura cobre só o envio sem linha e o objeto de `pronto`, `falhou` e excluído;
     - (b) dar à varredura da 2.0, ou ao expurgo noturno, a regra de fechar o `processando` sem job vivo há mais de 25 h e apagar o objeto dele, e escrever isso em `2_task.md` com um cenário. Aí a frase de hoje passa a ser verdade.

**Recomendações:**
- `packages/core/src/titular/s3-file-storage.int.test.ts:66`: `.not.toBe('Enabled')` também aceita `Suspended`. A listagem de versões já pega a sobra depois de apagar, mas afirmar que o status vem vazio deixaria a intenção ("o bucket nunca teve versionamento") explícita.
- A mesma linha de `docs/lgpd.md` poderia dizer que, quando o storage recusa o apagar no envio recusado, o log guarda só o id do material, para casar com o caso novo do teste.
- Fica de pé a recomendação da 1ª rodada: a spec pousa com a 2.0 e a 3.0, porque o `docs/lgpd.md` conta com a varredura e com o descarte.

**Pergunta de fechamento:** sobre aluno, o código continua respondendo. Esta rodada não toca dado de aluno nem envio externo. A reprovação é só pela retenção do PDF da escola, que o mapa de dados promete e o código não cumpre.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-11 14:37:43 · `tasks/prd-ingestao-do-material/1_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

Bloqueantes: nenhum

**A correção exigida na 1ª rodada foi feita.** Conferi no código, não só na descrição do Implementador.

- **O `processando` deixado pela API antiga:** a migration `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/drizzle/0049_material_extracao_no_worker.sql:15` fecha esse material em `falhou`/`extracao_falhou` com `processado_em`. O `UPDATE` que tira o material antigo da varredura roda antes, então o material fechado não volta para ela. O caso novo de `extrair-pdf.int.test.ts` lê o próprio `.sql` e roda os dois `UPDATE` na escola do caso. Ele inclui a escola que não muda e as mutações de cada `WHERE`.
- **O SIGTERM e o prazo com o processo vivo:** `apps/worker/src/processors/extrair-pdf.ts:114` corre o extrator contra `quandoAbortar(sinal)`. Na última tentativa, o `catch` em `:137-147` chama `falharDeVez`: o material fecha e o objeto sai. Com tentativa sobrando, os dois ficam. O teste cobre três situações: o sinal aborta no meio, o sinal já chega abortado e há tentativa sobrando. As duas mutações do `quandoAbortar` derrubam o teste.
- **O SIGTERM com o processo morto:** o job termina `falhou/EXECUCAO_INTERROMPIDA` e o alerta `job-falhou-de-vez.yaml` dispara (ele já existe). Quem fecha o material é o `ops:descartar-job` da 3.0. O `3_task.md` 3.2 já diz que "o descarte do PDF deixa o material `falhou` e apaga o objeto". O dono existe e está planejado.
- **Os textos que citavam a 2.0 foram corrigidos:** a linha 1.0 do §11 da `techspec.md`, o `cenarios.md:67-72`, o comentário do teste (`extrair-pdf.int.test.ts:714-716`), o docblock do processador e o item 7 da autoconferência. O `2_task.md:54` ("`processando` 25 h fica") agora é coerente: a varredura não toca o `processando`. Não sobra nenhum texto dizendo que a 2.0 fecha esse material.

Recomendações:

1. **O desligamento não espera o processador terminar.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/src/composition.ts:243-253`, `interromper()` aborta o sinal, grava a falha do job, e logo depois `armazemS3?.encerrar()` e `pool.end()` desmontam o storage e o banco. O fechamento do material pelo processador corre contra esse desmonte.
   - Os desfechos têm dono: o objeto com `processado_em` vai para a varredura da 2.0, e o material ainda `processando` vai para o Descartar da 3.0.
   - Mas o docblock em `extrair-pdf.ts:60-62` promete mais do que o código garante ("com o processo ainda vivo").
   - No teste de worker (`extrair-pdf.int.test.ts:692`, `:704` e `:717`), o processador de verdade foi trocado por um que nunca devolve, então o SIGTERM com o processador real ninguém prova.
   - Sugestão: `interromper` espera as tentativas terminarem, com prazo curto dentro do `stop_grace_period`, ou o docblock passa a dizer que é melhor esforço.
2. **`3_task.md`, caso "Descartar o PDF":** dizer o estado de partida (job `EXECUCAO_INTERROMPIDA`, material `processando` com objeto) e que o descarte libera o teto de 3 em leitura. Com o processo vivo, o processador já fecha o material, então este é o único caso em que o descarte tem trabalho no material. O runbook da 3.4 ("Job que falhou de vez") deve dizer que é para descartar.
3. **O cabeçalho da `0049`** começa com "Só expande", mas agora a migration também troca o `estado` de linhas vivas. Se a API antiga estiver extraindo durante o deploy, esse material vira `falhou`. É aceitável fora do horário letivo, mas o comentário deveria dizer isso (regra 80, item 9).
4. **`extrair-pdf.int.test.ts:658`:** `void montado.encerrar().then(...)` encerra sem `await`. O worker e o Redis podem vazar para o caso seguinte. O `it` deveria ser `async` e esperar o encerramento.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-11 14:37:45 · `tasks/prd-ingestao-do-material/1_task.md`

VEREDITO: APROVADO
Caminho quente tocado: fila | migration
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok
Bloqueantes: nenhum

Recomendações:

1. **A janela do deploy cria material `processando` que fica preso.** O `migrar` roda com a API anterior ainda no ar. Um envio que caia entre o `UPDATE` da `packages/core/drizzle/0049_material_extracao_no_worker.sql:12` e a troca do contêiner nasce `processando`, e o código antigo só o extrai na memória do processo. Se a troca mata essa extração, nada fecha o material:
   - a varredura antiga da API saiu;
   - o "Descartar" da 3.0 parte de um job, e esse material não tem job.

   A única saída é a coordenação excluí-lo, e até lá ele ocupa uma das 3 vagas de leitura da escola. A janela é curta e o deploy é fora do horário letivo, por isso não bloqueia. Peça um parágrafo no runbook ou a ordem do deploy (parar a `api` antes do `migrar`, ou rodar o `UPDATE` de novo depois da troca).

2. **O pouso depende da 3.0.** O processo que morre na última tentativa agora fica para o "Descartar" da 3.0 (`apps/worker/src/processors/extrair-pdf.ts:61-62`, `techspec.md` §11). A recomendação anterior, de pousar junto com a 2.0, passa a valer também para a 3.0: sem ela, o material fica `processando` com o objeto no storage.

3. **No desligamento forçado, fechar o material disputa com o encerramento.** Em `apps/worker/src/composition.ts:243-253`, o `executor.interromper()` só espera a falha do job. O `falharDeVez` que o `quandoAbortar` dispara roda em paralelo com o `armazemS3?.encerrar()` e o `pool.end()`. Se perder essa corrida, o material fica `processando`, e só o log `material.falha_nao_gravada` registra isso. Quem cobre hoje é a 3.0. Para fechar com o processo vivo como o docblock promete, vale esperar o processador, com um teto dentro dos 5 s entre a graça e o `stop_grace_period`.

4. **A limpeza do teste do lock não é esperada.** Em `apps/worker/test/extrair-pdf.int.test.ts:440-442`, o `void montado.encerrar().then(() => bancadaDoCaso.fechar())` roda sem `await`, e a conexão pode vazar para o caso seguinte ou para o `afterAll`. Torne o caso `async` e espere o encerramento.

5. **A conta dos valores novos está certa.** No `packages/core/src/queue/queues.ts:38-40`: o lock de 60 s com a verificação a cada 20 s devolve o job da réplica morta em até 80 s. A renovação na metade (30 s) fica abaixo do lock, então nenhum job é dado por parado sem estar. O comentário do `QUEUE_PRIORITY` em `packages/core/src/queue/job-outbox.ts:6` também confere com o código: a `pdf` tem fila e réplica próprias. Nada a corrigir nos dois.

## test-engineer · 2ª rodada · APROVADO · 2026-11-11 14:38:43 · `tasks/prd-ingestao-do-material/1_task.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- Caminho feliz: o objeto sai só depois do commit.
- Prazo e SIGTERM, com e sem tentativa sobrando, mais o sinal que aborta com o extrator que o ignora.
- Falha final.
- `sem_texto` e `arquivo_invalido`.
- Objeto ausente, de material `processando` e de material que já saiu de `processando`.
- [P] material excluído entre a leitura da linha e a do objeto, e durante a extração.
- [P] segundo job parado até o primeiro dar commit.
- [P] dois jobs em `Promise.all`.
- Exclusão de `processando`, com o job que chega depois.
- Exclusão cruzada de A em B.
- Vaga por escola.
- Checks e `UPDATE` da migration 0049.
- Configuração da réplica `pdf`: um PDF por vez, lock, stalled e storage.
- Isolamento no repository e no job.
- Expurgo.
- Envio recusado por duplicado, por teto e com o storage recusando apagar.
- Envios concorrentes do mesmo arquivo.
- Log e métrica.

**Cobertos:** todos. Confiro as duas correções exigidas na 1ª rodada e o que entrou depois:

1. **Correção 1 (`material.int.test.ts`):** feita. A cláusula saiu do nome do caso de exclusão e ganhou caso próprio: "o job que chega depois da exclusão de um material `processando` não extrai nem grava nada, mesmo com o objeto de volta no storage". Ele põe o objeto de volta no armazém, roda o processador de forma explícita (`extrairMaterial`, no contexto da escola, na última tentativa) e confere que o extrator espiado não foi chamado, que não há trechos e que a linha segue `processando` sem `falha`.
   - Sem o termo `excluido_em` em `lerParaExtrair`, o job extrairia e gravaria, e o caso ficaria vermelho. O caso olha o efeito e não o desfecho `sem_efeito`, que o processador não devolve; para a regra, a prova é a mesma.
   - Entrou também o caso cruzado: a A recebe o mesmo `NAO_ENCONTRADO` do id inexistente, e o objeto e a linha da B ficam.
2. **Correção 2 (lock e stalled da fila `pdf`):** feita. O caso "a réplica da fila `pdf` sobe com um PDF por vez, o lock de 60 s e a verificação de stalled de 20 s…" lê o `opts` do `Worker` montado por `createWorker` (`queue.fixture.ts:35`), fixa a constante e confere que o lock é maior que a verificação.
   - O stalled foi para 20 s, que é diferente dos 30 s que o BullMQ usa sem configuração. Por isso os blocos das linhas 209 e 210 de `composition.ts` ficam vermelhos de verdade.
3. **`quandoAbortar`:** os dois blocos (o `Promise.race` e o `sinal.aborted`) são alcançados pelo caso dos três sinais.
   - O caso "já abortado" mata a mutação do `aborted`, porque abortar de novo um sinal já abortado não dispara o evento.
   - Os 100 ms de espera não são dependência de corretude: com o código certo, a conferência do `aborted` cobre a máquina lenta.
4. **Fechamento na última tentativa:** "última" e "já abortada" terminam `falhou`, com o objeto apagado. "Sobrando" fica `processando`, com o objeto.
5. **`UPDATE` da 0049:** o caso lê o `.sql` (então a mutação no arquivo é vista), exige os dois `UPDATE`, roda-os só na escola do caso e confere quatro materiais. Os três blocos (`IS NOT NULL`, `'pronto'` e o `processado_em` tirado) ficam vermelhos.
6. **Recomendações da 1ª rodada aplicadas:**
   - O isolamento do job conta as leituras do storage: o `aoLerBytes` roda antes da busca da chave (`file-storage.ts:104`), e a mutação de `escola_id` conta uma leitura.
   - No [P] do segundo job parado, a ordem não depende mais de quem lê a linha primeiro.
   - O teto entrou na corrida.
   - Nos envios concorrentes, o armazém e o `job_registro` são conferidos.
   - Recusa com o storage recusando apagar: o aviso de log leva o `materialId`.
7. **Lista do `--faltando`:** 10 linhas, todas com motivo na seção "Mutações".
8. **Execução e proibições:** `extrair-pdf.int.test.ts` passou com 31 de 31 e `material.int.test.ts` com 49 de 49. Não há `.skip` nem provedor pago: o extrator é o `PdfExtractor` local ou um falso.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `apps/api/test/material.int.test.ts:115`, caso do teto na corrida. Ele não garante que a recusa chegue à transação. A conferência da entrada (`exigirEnvioDentroDosTetos`) não trava a escola: se três envios dão commit antes de a guarda do quarto ler, ele é recusado sem objeto guardado, e o caso passa mesmo sem a limpeza do `catch`. A limpeza segue provada pelos casos do duplicado e do storage recusando, por isso não bloqueia. Para o caso provar o que diz, conferir que `guardarBytes` foi chamado cinco vezes.
2. `apps/api/test/material.int.test.ts:146`. O `expect.arrayContaining` sobre as chaves do aviso não recusa chave a mais. Usar o conjunto exato (`['erro', 'evento', 'materialId']`), para o "só pelo id" valer.
3. `apps/worker/test/extrair-pdf.int.test.ts:308`. O limite de 2 s do "preso" só custa quando o caso falha. Subir para uns 10 s tira a dependência da máquina folgada sem custo no caminho verde.
4. `apps/worker/test/extrair-pdf.int.test.ts:658`. O `void montado.encerrar().then(() => bancadaDoCaso.fechar())` deixa o encerramento solto: uma rejeição ali vira erro não tratado em outro caso. Tornar o caso `async` e aguardar o encerramento.
5. `apps/worker/test/extrair-pdf.int.test.ts:483`. A asserção `estado: 'processando'` olha um processador falso que nunca toca o banco, então sempre passa. Ela documenta a lacuna até o "Descartar" da 3.0, não prova código. Virar comentário, ou dizer na tabela que é o estado esperado e não uma prova.
6. `apps/worker/src/processors/extrair-pdf.ts:103`. Nenhum teste chama o processador sem o `sinal`, então o valor padrão do parâmetro não é exercitado. Tornar o `sinal` obrigatório, já que o executor sempre o entrega.
7. `tasks/prd-ingestao-do-material/1_task.md:60`, linha "envio: recusa, teto e corrida". Citar os casos pelo nome, como as outras linhas fazem.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/1_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/test/extrair-pdf.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/material.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/worker/src/processors/extrair-pdf.ts

## revisor-geral · 3ª rodada · APROVADO · 2026-11-11 15:00:01 · `tasks/prd-ingestao-do-material/1_task.md`

VEREDITO: APROVADO

Escopo: respeitado. Nesta rodada só mudaram documentação, um teste e o registro das recomendações, sem código de tarefa futura.

Aderência à Tech Spec: ok.
- **Retenção do PDF.** A linha nova do `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/docs/lgpd.md` (linha ~101) agora bate com a divergência registrada em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/techspec.md:182`:
  - a varredura da 2.0 cuida só do objeto de material `pronto`, `falhou` e excluído;
  - o material `processando` cujo job falhou de vez, ou nunca rodou, sai pelo "Descartar" da 3.0.
- **Log da recusa.** A frase "o log guarda só o id do material", sobre o apagar recusado de um envio recusado, confere com `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.service.ts:150`. A linha grava `materialId` e o resumo do erro, sem dado de pessoa.

Portão local: carimbo válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo).

Bloqueantes: nenhum.

Recomendações:
- **Retenção na Tech Spec.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/tasks/prd-ingestao-do-material/techspec.md:123`, a linha diz "PDF: até a extração, ou 25 h no órfão", que ficou mais curta que o `lgpd.md` e que a linha 182. Basta acrescentar "e, no `processando` cujo job falhou de vez, até o Descartar da 3.0", para quem lê só a tabela de retenção não achar que todo objeto sai em 25 h.
- **Teste do versionamento.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/titular/s3-file-storage.int.test.ts:67`, o `toBeUndefined()` depende de o SeaweedFS devolver o status vazio quando o bucket nunca teve versionamento. Isso só se confirma rodando a suíte de integração, que não aparece no carimbo. Cabe ao `test-engineer` conferir que a suíte rodou e passou.
- **Registro das recomendações.** As recomendações da 2ª rodada estão no `TODO.md` e no `1_task.md`, cada uma com dono, e nada mais a apontar. A condição de pouso (a spec só pousa junto com a 2.0 e a 3.0) fica com o Orquestrador, como o documento já registra.

## test-engineer · 3ª rodada · APROVADO · 2026-11-11 15:00:12 · `tasks/prd-ingestao-do-material/1_task.md`

VEREDITO: APROVADO

Cenários exigidos: os mesmos da rodada 2, já aprovados: caminho feliz do envio e da extração, recusa, teto e corrida, falha do storage, prazo do job, isolamento entre escolas e a migration 0049. Nesta rodada, só o que o diff r2→r3 toca:
- (a) O bucket do PDF do material nunca teve versionamento. O teste agora recusa também o estado `Suspended`, além do `Enabled`.
- (b) A linha nova do material em `docs/lgpd.md` diz duas coisas. Quando o storage recusa apagar o objeto de um envio recusado, o log guarda só o id. E o material `processando` cujo job falhou de vez fica sem prazo automático e sai pelo "Descartar" da 3.0.

Cobertos:
- **(a)** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/packages/core/src/titular/s3-file-storage.int.test.ts:67`. A asserção agora é `Status` `toBeUndefined()`. Ela fica vermelha com `Enabled` e com `Suspended`, e a anterior (`not.toBe('Enabled')`) deixava passar o `Suspended`. A mesma asserção também confere que, depois do apagar, não sobra versão nem marcador de exclusão (linhas 71-72). Rodei `npx vitest run packages/core/src/titular/s3-file-storage.int.test.ts` contra o SeaweedFS do compose de teste: 4 de 4 verdes. Nenhum arquivo de `infra/` liga o versionamento no bucket.
- **(b)** O log que guarda só o id já tem teste: o caso "o envio recusado pela transação, com o storage recusando apagar o objeto..." (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/test/material.int.test.ts:782`). Ele confere o `materialId` e que a chave `material-temporario` não aparece no log, e o código está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/apps/api/src/material/material.service.ts:150`. O caso do `processando` sem prazo é da 3.0, e ela é a dona dele, o que já está registrado no `1_task.md` e no `TODO.md`.
- O resto do diff mexe só em documentos (`TODO.md`, as tabelas "Achados" e "Revisões" do `1_task.md`). Ali estão registradas, com dono, as recomendações da 2ª rodada, incluindo os pequenos de teste que apontei. Não há código de produção novo nem cláusula nova sem bloco de mutação. Também não há `.skip`, teste comentado ou provedor pago.

Bloqueantes: nenhum.

Recomendações:
- `material.int.test.ts:800` usa `expect.arrayContaining`, que não recusa uma chave a mais no aviso de log. Isso já está no `TODO.md`. Repito porque a nova frase do `docs/lgpd.md` ("o log guarda só o id do material") depende dessa asserção, e o conjunto exato (`['erro', 'evento', 'materialId']`) é o que a prova.
- O teste do bucket sem versionamento prova o bucket do compose de teste, não o de produção. Vale uma linha no runbook ou no `infra/` dizendo que o bucket de produção nasce sem versionamento, com conferência no deploy.

## privacy-guardian · 3ª rodada · APROVADO · 2026-11-11 15:00:12 · `tasks/prd-ingestao-do-material/1_task.md`

VEREDITO: APROVADO

A correção exigida na 2ª rodada foi feita pela opção (a). A linha 101 de `docs/lgpd.md` agora diz o que o código faz. Não há bloqueante.

**Como conferi a correção, linha 101 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l1/docs/lgpd.md`**
- A varredura de 25 h agora cobre só o envio que não virou linha e o objeto de material `pronto`, `falhou` ou excluído cujo apagar falhou. É o que dizem `techspec.md:182` e o índice parcial em `packages/core/src/db/schema/material.ts:73`.
- O material `processando` cujo job falhou de vez aparece como "sem prazo automático". Ele sai pelo "Descartar" da 3.0 (`3_task.md:25` e `:49`), e o aviso vem do alerta de job falhou de vez, que existe em `infra/grafana/alertas/job-falhou-de-vez.yaml` com seção em `docs/runbook.md:79`. A escola recebe no dossiê um texto honesto, sem o prazo de 25 h que o código não cumpria.
- A frase nova sobre o log ("o log guarda só o id do material") bate com `apps/api/src/material/material.service.ts:150` e `:194`. Esses logs levam só `materialId` e `summarizeError(...)`, e a chave do objeto leva só ids.
- O `processando` que a janela do deploy cria sem job vem da API antiga. Conferi no `HEAD`: a API antiga não gravava objeto no storage, então esse caso não deixa PDF parado.

**O resto do diff**
- `packages/core/src/titular/s3-file-storage.int.test.ts:66-67`: a asserção ficou mais estrita. Antes exigia `!== 'Enabled'`, agora exige `toBeUndefined()`, o que prova que o bucket nunca teve versionamento. Melhor para o apagar de fato.
- `TODO.md` e `1_task.md` só ganharam pendências e linhas de revisão, sem dado de pessoa.

Campos pessoais tocados: nenhum novo nesta rodada. Só mudou o texto de retenção do PDF em `material`.
Fora da tabela de dados do docs/lgpd.md: nenhum.
Autorização por objeto: ok, sem mudança nesta rodada.
Logs: limpos.
Auditoria: presente, sem mudança nesta rodada.
Envio externo: nenhum nesta rodada.
Seed/fixture: sintético.
Bloqueantes: nenhum.

Recomendações:
- **"Ou nunca rodou", na linha 101 de `docs/lgpd.md`.** A frase vem da redação que eu mesmo sugeri na 2ª rodada, mas não descreve bem esse caso. Um job que nunca rodou fica `aguardando`, e o "Descartar" recusa job `aguardando` (`3_task.md:51`). O alerta desse caso é o `pdf-parado` (3.5), não o de job falhou de vez. Na prática o objeto sai quando o worker volta e o job roda. Sugiro dizer "o de job que nunca rodou fica até o job rodar, com o alerta `pdf-parado`". É o texto da 3.0.
- **O pouso depende da 2.0 e da 3.0.** A linha conta com a varredura da 2.0, inclusive para achar o envio sem linha, e com o "Descartar" da 3.0. A spec não pode pousar só com a 1.0. Isso já está registrado em `1_task.md` como dever do Orquestrador no pouso, e fica aqui como lembrete.
