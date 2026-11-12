# Achados das revisões — `tasks/prd-ingestao-do-material/3_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-12 15:56:24 · `tasks/prd-ingestao-do-material/3_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. Nenhum dos tipos de job em `JOB_DEFINITIONS` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/packages/shared/src/system/job-definitions.ts`) grava `Nota`, e `estrutura.gravar-planilha` também não toca nota. Reprocessar só põe de volta na fila um job que já existia, com o mesmo `dados`. Não cria caminho de escrita novo. Todos com autor humano? sim, porque não há nenhum.

Decisão autônoma sobre aluno: ausente. Os comandos agem sobre o estado do job e, no PDF, sobre o material (`processando` passa a `falhou`). Nada disso decide sobre trajetória de aluno.

Aprovação registrada: ok. A tarefa não produz saída de IA. Os dois comandos recusam `ia.*` antes de tocar a fila ou a linha (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/ops/jobs-que-falharam.ts`, `PREFIXOS_QUE_A_OPERACAO_NAO_MEXE` e `exigirJobDeEscola`). Assim a operação não reexecuta geração de IA por fora do fluxo de pedido e aprovação. Testes que provam isso:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/ops/jobs-que-falharam.test.ts:85`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/test/ops-jobs.int.test.ts:203` e `:362`

Supervisão do tutor: ok. O tutor não é tocado. `ia.responder-tutor` é recusado pelos dois comandos.

Autonomia declarada e visível: sim, sem mudança. A tarefa não cria nem altera agente.

Auditoria: os novos `job.reprocessado` e `job.descartado` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/packages/core/src/auditoria/acoes.ts`) registram quem fez a ação (`autor_operador`), o job, o tipo de uma lista fechada e o número do chamado. São gravados na mesma transação da ação e nunca guardam `dados`. Não é saída de IA, então o item 6 da regra 70 não se aplica diretamente, mas o rastro da operação fica consultável na auditoria da escola.

Itens 7, 8 e 9 da regra 70 (vigilância, D46/D55, medir o professor): não se aplicam. A tarefa não tem inferência sobre aluno, não tem campo de nota em discursiva ou redação e não tem métrica de professor. A série do alerta `pdf-parado` não leva escola nem pessoa. A tarefa não altera `docs/regulacao.md`, e não houve fotos da tela porque a tarefa não tem tela.

Bloqueantes: nenhum.

Recomendações:
- Hoje nenhum tipo `ia.*` existe em `JOB_DEFINITIONS`, então a recusa por prefixo é uma proteção para quando eles existirem. Vale um comentário em `job-definitions.ts` dizendo que um tipo `ia.*` novo, ao nascer, já fica fora dos comandos de operação. Isso evita que alguém renomeie o prefixo e perca a recusa sem perceber.
- Quando entrar algum job que publique nota ou entrega aprovada, reavaliar o `ops:descartar-job`. Descartar esse job apagaria em silêncio uma aprovação humana já registrada, e esse tipo deveria entrar na lista de recusados.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-12 15:56:27 · `tasks/prd-ingestao-do-material/3_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration. `job_registro` e `material` já têm `escolaId`, e as escritas novas nas duas filtram pela escola.

Queries verificadas:
- `JobsQueFalharamRepository.listar` e `travarFalho` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/operacao/jobs-que-falharam.repository.ts:36` e `:46`): os dois são `@Unscoped` com o motivo escrito. Só o comando de operação, na linha de comando, usa esses dois. Nenhum devolve `dados`: o `travarFalho` tira dele só o `materialId` e descarta o resto.
- `JobOutboxRepository.reabrirFalho` e `descartarFalho` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/packages/core/src/queue/job-outbox.repository.ts:215` e `:228`): filtram pelo id, pela escola do contexto (`jobScopeInContext()`) e por `estado = 'falhou'`.
- `ExtracaoDoMaterialRepository.marcarFalhou` e `marcarObjetoApagado`: filtram por `requireEscolaId()`. A escola no contexto é a da linha do job, lida do banco e não de argumento. Os comandos aceitam só `<id> --chamado <n>` (o `--escola` é recusado), e não há endpoint HTTP.
- `chaveDoTemporario`: monta a chave do objeto com a escola do contexto. O objeto só é apagado depois que o material fechou dentro da escola do job, então um material de outra escola nunca chega ao storage.
- Auditoria (`job.reprocessado` e `job.descartado`): `z.strictObject` com tipo de lista fechada e chamado inteiro positivo, nunca `dados`. Fica gravada na escola do job.
- `NAO_ENCONTRADO` é a mesma resposta para id inexistente e para job fora de `falhou`.
- Id: UUID conferido por `z.uuid()` no `lerPedidoDeJob`.
- Camada de rede: esta tarefa não a toca.

Teste de isolamento: presente e efetivo.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/test/ops-jobs.int.test.ts:313`: um job da escola A aponta para um material da B, e o material e o objeto da B ficam intactos. Se a condição `material.escolaId` sair de `marcarFalhou`, o teste quebra.
- O mesmo arquivo, linhas 402 a 414: com a escola B no contexto, `reabrirFalho` e `descartarFalho` não alcançam o job da A. Se `jobScopeInContext()` sair, o teste quebra.

Eu mesmo rodei os testes, e tudo passou:
- `ops-jobs.int.test.ts`: 37 de 37.
- `repositories-com-escopo`, `architecture`, `jobs-que-falharam.test.ts` e `acoes.test.ts`: 185 de 185.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/test/ops-jobs.int.test.ts:242`: o nome "job de outra escola com o id certo" engana. O caso usa um job `aguardando` da B, e o operador age em qualquer escola, então o que o caso prova é a condição do estado, não o isolamento. Sugiro renomear para "job que não existe e job que não falhou: a mesma resposta".
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/operacao/`: a pasta já soma 7 `@Unscoped`, distribuídos em três arquivos (`painel`, `escola` e `jobs-que-falharam`). Cada arquivo continua com dois ou três, então a regra 10, item 9, não é violada. Vale olhar isso na retro, antes que algum desses arquivos chegue ao terceiro.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-12 15:56:53 · `tasks/prd-ingestao-do-material/3_task.md`

VEREDITO: APROVADO

**Campos pessoais tocados:** nenhum campo novo e nenhuma migration. Os comandos leem do `job_registro` só o id, a escola, o tipo, a fila, o código da falha e a data. O código da falha vem de uma lista fechada (`JobFailureCode`), não é texto livre. Do `dados` sai só o `materialId`, e só dentro do descarte. O comando muda o estado do `material` para `falhou` e apaga o PDF guardado temporariamente no storage. A chave desse objeto leva só ids.

**Fora da tabela de dados do docs/lgpd.md:** nada. A linha do material em `docs/lgpd.md:101` foi atualizada: o objeto de um job que falhou de vez sai pelo `ops:descartar-job`, e o job que nunca rodou é avisado pelo alerta `pdf-parado`. A linha do `job_registro` (`docs/lgpd.md:115`) já cobre os campos que os comandos leem.

**Autorização por objeto:** ok.
- Os dois `@Unscoped` (`apps/api/src/operacao/jobs-que-falharam.repository.ts:36` e `:46`) têm motivo escrito e só fazem leitura. O operador é conferido como ativo na mesma transação, antes de qualquer leitura (`autorDoComando`).
- A escrita (`reabrirFalho`, `descartarFalho` em `packages/core/src/queue/job-outbox.repository.ts:215-235`, e `marcarFalhou`) roda no contexto da escola da própria linha.
- Testei mentalmente trocar o id: um job de outra escola, um job inexistente e um job fora do estado `falhou` recebem todos a mesma resposta, `NAO_ENCONTRADO`.
- Há caso de isolamento com o material da escola B usando o mesmo `materialId` (`apps/api/test/ops-jobs.int.test.ts:313`), e os casos do repository têm a B no contexto (`:402`).

**Logs:** limpos. Os comandos não gravam log, só imprimem no terminal e registram auditoria. A saída é um DTO explícito (`paraSaida` em `apps/api/src/ops/jobs-que-falharam.ts:171`; ids, tipo e chamado nos outros dois comandos). O erro tem texto fixo por código, ou passa pelo `summarizeError` (só nome e pilha filtrada, sem mensagem). O `catch` do storage não deixa a chave vazar. A sentinela gravada no `dados` fica fora da saída, do erro e da auditoria nos três comandos (`ops-jobs.int.test.ts:447`, `:467`).

**Auditoria:** presente. `job.reprocessado` e `job.descartado` (`packages/core/src/auditoria/acoes.ts:718-733`) usam `z.strictObject`, um tipo de lista fechada e o chamado como inteiro positivo, nunca o `dados`. O registro vai para a escola da linha, com `autor_operador` e na mesma transação da mudança. A listagem entre escolas não é auditada, e isso está certo: ela não lê dado de aluno, então a regra 20, item 10, não se aplica.

**Envio externo:** nenhum envio novo. O reprocessar recusa `ia.*` e `titular.*`. Ele aceita `email.enviar-convite`, que reenvia o e-mail a um adulto pelo caminho que já existe, e o worker volta a conferir o estado do convite antes de enviar.

**Seed/fixture:** sintético. O teste usa escolas de bancada, a disciplina "Química" e uma sentinela. O ensaio usa uma escola sintética e um `materialId` sorteado.

**Bloqueantes:** nenhum.

**Recomendações:**
1. A linha do `job_registro` em `docs/lgpd.md:115` ainda diz que a linha "sai pelo `sistema.expurgar-jobs`". Vale acrescentar dois casos. O `ops:descartar-job` apaga a linha `falhou` antes do prazo, com auditoria `job.descartado`. O `ops:reprocessar-job` reinicia o `criado_em`, e com isso o prazo de retenção da linha recomeça a contar.
2. Na seção "Reprocessar ou descartar" de `docs/runbook.md`, vale avisar que reprocessar `email.enviar-convite` manda de novo um e-mail para fora. Assim o operador confere o convite antes, mesmo com o worker recusando convite revogado.
3. O material vai para `falhou` pelo descarte sem uma ação `material.*` na auditoria; só o `job.descartado` (entidade `job`) registra o fato. Uma consulta da coordenação pelo material não mostra quem o fechou. Não é dado pessoal, mas ajudaria a rastrear.

**Pergunta de fechamento:** a tarefa não guarda nem envia nada novo sobre o aluno. O PDF tem destino registrado (`objeto_apagado_em`), e cada ação da operação fica na auditoria da escola. O sistema continua respondendo à secretaria.

## infra-guardian · 1ª rodada · REPROVADO · 2026-11-12 15:57:46 · `tasks/prd-ingestao-do-material/3_task.md`

```
VEREDITO: REPROVADO
Caminho quente tocado: fila
Rate limit: ok
Fila e prioridade: problema
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: faltando
Bloqueantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/infra/scripts/ensaio-alertas.ts:590 (e :547, :650) — O ensaio grava o job `material.extrair-pdf` "sem o worker-pdf de pé", mas nunca para o `worker-pdf`. Rodando pela linha de comando (`npm run ensaio:alertas`), o `servicos: []` faz o `subir` da linha 547 executar `docker compose up` sem nome de serviço, e isso sobe a stack inteira, `worker-pdf` incluído. O runbook manda rodar exatamente assim ("com o ambiente local de pé (`docker compose up`)"). O despachante publica o job (`naoUrgente: false`, sem janela), o `worker-pdf` o pega em segundos e o `lerParaExtrair` não acha o material sorteado: o resultado é `sem_efeito` e o job conclui. A série `job_espera_mais_antiga_s{fila="pdf"}` some antes do `for: 1m`, o `pdf-parado` nunca dispara e o ensaio falha por prazo. O `alertas.int.test.ts` só passa porque o `SERVICOS` dele não inclui o `worker-pdf`. Ou seja, a prova do alerta só funciona num ambiente que não é o documentado.
  Correção exigida: parar o `worker-pdf` antes de gravar o job (`comandoOuFalha(opcoes, 'stop', 'worker-pdf')`, como já é feito com `WORKERS_INTERATIVOS`) e religá-lo na restauração (`subir(opcoes, ['redis-cache', ...WORKERS_INTERATIVOS, 'worker-pdf'])`), depois de remover o job. Também é preciso um caso que prove isso: incluir o `worker-pdf` nos serviços de pé do `alertas.int.test.ts`, ou conferir que o ensaio o para e o religa.
Recomendações:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/docs/runbook.md:850 — a expressão citada omite `job="educa/worker"`. Copiar a do yaml para que o operador consulte o mesmo que a regra avalia.
- Na restauração do ensaio, o job removido de `job_registro` pode continuar publicado no BullMQ da fila `pdf`. Vale conferir que o `worker-pdf`, ao voltar, descarta job sem linha e não segura a vaga da escola sintética.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/operacao/jobs-que-falharam.repository.ts:38` — a listagem usa o `job_registro_finalizados_idx`, que também cobre `concluido`. Para comando de operação com `limit 200` isso basta. Se a lista de falhos crescer, um índice parcial `(concluido_em) where estado = 'falhou'` evita varrer os concluídos.
- A tarefa prevê alteração em `infra/test/alertas.int.test.ts`, mas a prova ficou em `infra/test/alerta-do-pdf-parado.int.test.ts` e `infra/test/alertas.test.ts`. É preciso alinhar a tabela "Arquivos previstos" de `tasks/prd-ingestao-do-material/3_task.md`.
```

Conferi também os pontos abaixo, sem achar problema:

- **Concorrência:** `for update` em `travarFalho`, com `reabrirFalho` e `descartarFalho` condicionados a `estado = 'falhou'` e ao escopo. Há o caso com `Promise.all`, e o reprocesso que esbarra na chave de idempotência dá `CONFLITO`.
- **Fila:** a cópia `failed` sai do BullMQ com a linha travada e o cliente Redis tem prazo por comando. O `criado_em` volta para `now()`.
- **Alerta:** a expressão tem dois termos com `or vector(0)`, `for: 1m` e limiar de 900. O `pdf-parado.yaml` tem runbook e a nota dos 60 GB está em `docs/infra.md`.
- **Testes:** os unitários que a tarefa toca passaram (146 de 146). Os de integração precisam do compose e não foram rodados nesta auditoria.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-12 15:58:11 · `tasks/prd-ingestao-do-material/3_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em `cenarios.md`. A recusa do `sistema.*` e o que fica para a 5.0 estão na `techspec.md` §11 e no `3_task.md`, mas não no `cenarios.md`.
Portão local: carimbo válido

Bloqueantes:

1. **A divergência não chegou ao `cenarios.md`.**
   - Onde: `tasks/prd-ingestao-do-material/cenarios.md:50-54`.
   - O que está errado: a seção "Extração no worker" manda seguir, linha a linha, a tabela "3. Falha" da `onda-3b.md`. A linha "Descartar" dessa tabela (`tasks/prd-reengenharia/onda-3b.md:122`) pede "um caso por tipo: PDF, `sistema.*` e `retencao.*`", ou seja, o `sistema.*` é descartado. A implementação faz o contrário e recusa o `sistema.*` nos dois comandos (`apps/api/src/ops/jobs-que-falharam.ts:72`). A divergência foi registrada na `techspec.md` §11 (linha "3.0") e no `3_task.md`, mas o `cenarios.md` segue pedindo o descarte. As provas novas que a divergência empurrou para a 5.8 também só existem no `5_task.md`: a auditoria do job sem escola com `autor_operador`, e o `falhou` de `material.extrair-pdf` que fica fora do expurgo de 30 dias.
   - Correção exigida:
     - Em "Extração no worker", registrar que os dois comandos recusam o job sem escola até a 5.0, com `JobSemEscolaError`, antes de tocar a linha, a fila e a auditoria.
     - Na seção da licença (5.0), acrescentar os dois cenários da 5.8.

2. **O ensaio não para o `worker-pdf`, e no ambiente local o `pdf-parado` não dispara.**
   - Onde: `infra/scripts/ensaio-alertas.ts:589-590` e `:584`.
   - O que está errado:
     - O ensaio grava um job `material.extrair-pdf` com um `materialId` sorteado e espera o alerta disparar. Ele só para os `WORKERS_INTERATIVOS` (`:584`).
     - Pela linha de comando (`npm run ensaio:alertas`, `servicos: []`), ele roda sobre o compose local. Ali o `worker-pdf` sobe com `docker compose up`, porque não tem profile (`infra/compose.yml:473`).
     - O worker pega o job, não acha o material na escola, e o job "conclui sem efeito" (`techspec.md` §5). A espera da fila `pdf` some e a regra nunca passa do limiar.
     - O ensaio fica esperando o disparo até o prazo. O runbook (`docs/runbook.md`, parágrafo do ensaio) diz "sem o `worker-pdf` de pé", mas o código não garante isso.
     - Em `infra/test/alertas.int.test.ts` o resultado depende da ordem dos arquivos: o `worker-pdf` só está parado se o `alerta-do-pdf-parado.int.test.ts` rodou antes e o parou no `afterAll`.
     - O `alertas.int.test.ts` não foi alterado, então o portão da tarefa não o rodou: o caminho do `pdfParado` no ensaio nunca rodou antes do commit.
   - Correção exigida, uma das duas:
     - parar o `worker-pdf` junto dos interativos e religá-lo na restauração (`:650`);
     - ou gravar o job como `reservado`, com `reservado_ate` distante, como faz `infra/test/alerta-do-pdf-parado.int.test.ts:122-128`.

   Nos dois casos, o runbook precisa descrever o que o ensaio de fato faz.

Recomendações:
- `apps/api/src/ops/descartar-job.ts:52-59`: se o `apagar` der certo e o `marcarObjetoApagado` falhar, o comando diz `objetoApagado: false` com o objeto já fora do storage. Vale separar os dois `try`, ou trocar o nome do campo para dizer que é o registro.
- `apps/api/src/ops/fila-de-jobs.ts:1-2`: há dois `import` de `@educa/core`; dá para juntar em um.
- `docs/runbook.md` ("Extração de PDF parada", "Dispara quando"): a expressão citada não tem o `job="educa/worker"` do yaml. Copiar a expressão exata.
- `docs/infra.md` §3.5: "avisa em 15 min" deixa de fora o `for: 1m` e a medição do despachante. O certo é "em cerca de 16 min".
- `packages/core/src/queue/job-outbox.repository.ts` (`reabrirFalho`): sobrescrever `criado_em` apaga o instante original do job. A auditoria guarda o reprocesso, mas vale uma linha no docblock dizendo que a data de criação original se perde.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/tasks/prd-ingestao-do-material/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/tasks/prd-reengenharia/onda-3b.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/infra/scripts/ensaio-alertas.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/infra/compose.yml
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/infra/test/alerta-do-pdf-parado.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/ops/descartar-job.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/ops/fila-de-jobs.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/ops/jobs-que-falharam.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/docs/runbook.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/docs/infra.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/packages/core/src/queue/job-outbox.repository.ts

## test-engineer · 1ª rodada · REPROVADO · 2026-11-12 15:58:52 · `tasks/prd-ingestao-do-material/3_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:** reprocessar um tipo aceito, até concluir e sem a reconciliação republicar · dois `reprocessar` em `Promise.all` · recusa de `ia.*`, de `titular.*` e de `material.extrair-pdf` · `sistema.*` recusado nos dois comandos · descarte do PDF (material `falhou`, objeto apagado, storage que recusa o apagar, material que já saiu de `processando`) · descarte de `retencao.*` · descarte de job `aguardando`, `publicado` ou `ativo` · `--chamado` 0, negativo e texto · auditoria com o chamado e sem `dados` · isolamento na marcação (o material da B com o id no `dados` do job da A) · listagem sem `dados` · `pdf-parado` em cinco casos: primeiro job, `falhou` terminando, `pronto` terminando, `arquivo_ausente`, worker parado com job há 16 min · `pdf-parado` disparado no `ensaio:alertas`.

**Cobertos:** todas as linhas da tabela têm o caso citado pelo nome, em `apps/api/test/ops-jobs.int.test.ts`, `apps/api/src/ops/jobs-que-falharam.test.ts`, `packages/core/src/auditoria/acoes.test.ts`, `infra/test/alerta-do-pdf-parado.int.test.ts`, `infra/test/alertas.test.ts` e `infra/test/alertas.int.test.ts`.
- **Mutações:** cada cláusula nova com condição tem bloco ou motivo aceitável. Conferi o `for update`, o `if (!reabrirFalho/descartarFalho)`, o `strictObject` e o `enum`, e os motivos se sustentam.
- **Concorrência:** é de verdade. São dois comandos, cada um com o seu banco, em `Promise.all`, e só um reprocessa.
- **Outros pontos:** nenhum `.skip` e nenhum provedor de IA. O mock da fila (`FILA_PROIBIDA`) prova a recusa, não a esconde.
- **Rodados aqui:** os dois testes de unidade (69 casos verdes) e `ops-jobs.int.test.ts` (37 casos verdes).

**Bloqueantes:**

1. **O `ensaio:alertas` não para o `worker-pdf`.** O `alertas.int.test.ts` só passa porque o serviço já está parado por outro motivo.
   - **Onde:** `infra/scripts/ensaio-alertas.ts:589-590` grava o job `material.extrair-pdf` "sem o worker-pdf de pé", mas nada no ensaio para o serviço.
   - **Por que quebra:** o comando real roda com `servicos: []` (linha 760), isto é, `docker compose up` com o ambiente inteiro, e o `worker-pdf` não tem profile (`infra/compose.yml:473`). O runbook manda rodar assim (`docs/runbook.md:1064`). Com o `worker-pdf` de pé, ele pega o job de material sorteado e o encerra (objeto ausente). A espera some, o `pdf-parado` nunca dispara e o ensaio falha em 9 min.
   - **Por que o teste não pega:** em `infra/test/alertas.int.test.ts:32`, o `SERVICOS` não inclui o `worker-pdf` e o `beforeAll` não o para. O teste depende de outro arquivo (`jobs.int.test.ts`, `alerta-do-pdf-parado.int.test.ts`) ter deixado o serviço parado. O docblock (linhas 31 e 359) e o runbook (linha 1088) afirmam uma condição que o código não cria.
   - **Correção exigida:**
     - No ensaio, parar o `worker-pdf` antes de gravar o job, como já se faz com os `WORKERS_INTERATIVOS`, e religá-lo na restauração.
     - Em `alertas.int.test.ts`, pôr o `worker-pdf` no `SERVICOS`, para o caminho feliz provar que o ensaio o para.
     - Conferir na restauração que ele volta `healthy`, como o teste já faz com os workers interativos (linhas 177-179).

**Recomendações:**
- `ops-jobs.int.test.ts:351`: o caso se chama "…com a auditoria da escola", mas `auditoriaDoJob` (linha 108) não seleciona `escola_id`. Vale incluir a coluna e conferir `escolaA` nos dois comandos.
- `ops-jobs.int.test.ts:242`: o caso "job de outra escola com o id certo" usa um job `aguardando` da B. Na prática repete o caso do estado, porque o comando atende todas as escolas. Melhor renomear, ou usar um `falhou` da B e conferir que reprocessa no contexto da B.
- Falta concorrência no `descartar`: dois `descartar`, ou `reprocessar` e `descartar` juntos, em `Promise.all` sobre o mesmo job de PDF. O mecanismo é o mesmo do reprocessar, mas o descarte apaga objeto depois do commit, e o caso sai barato.
- `infra/test/alertas.int.test.ts:138-150`: o `pdfParado` não entra na lista de `duracaoS` nem na conferência de que o disparo veio depois do `for:` inteiro. O ensaio já exige pendência antes do disparo, mas o `for: 1m` fica sem asserção direta.
- `docs/runbook.md:1090` diz que as provas de "não dispara" estão em `infra/test/alertas.int.test.ts`. Elas estão em `infra/test/alerta-do-pdf-parado.int.test.ts`.
- `jobs-que-falharam.repository.ts:38`: com `orderBy(desc(concluidoEm))`, o Postgres põe os `null` primeiro. Linhas antigas sem data passam na frente dos falhos recentes dentro do limite de 200. Considerar `nulls last`.
- `alerta-do-pdf-parado.int.test.ts`: o job "parado" fica `reservado` por um despachante que sumiu, e não `publicado` com o worker fora. O caso real (o worker parado) só fica provado pelo ensaio, mais um motivo para corrigir o bloqueante.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-12 19:34:29 · `tasks/prd-ingestao-do-material/3_task.md`

VEREDITO: APROVADO

Esta rodada cobriu só o diff entre as duas rodadas (`8dabccac..9c2fe06b`). Conferi também que a árvore de trabalho é igual à árvore `9c2fe06b`: nenhum arquivo, versionado ou novo, difere dela. Na 1ª rodada não houve correção exigida.

Campos pessoais tocados: nenhum campo novo. A linha "Registro do job" em `docs/lgpd.md` ganhou duas formas de o operador apagar antes do prazo. `ops:descartar-job` apaga a linha `falhou` e grava `job.descartado`. `ops:reprocessar-job` reinicia o `criado_em`, grava `job.reprocessado`, e o prazo de retenção recomeça quando a linha volta a `concluido` ou `falhou`. A auditoria guarda o tipo, o chamado e o id, nunca o `dados`.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. Os comandos `ops:*` são rotina da nossa equipe, com operador identificado, e não respondem a papel de escola. Os dois casos de recusa respondem igual: o job que não existe e o que existe mas não falhou devolvem o mesmo `NAO_ENCONTRADO`, sem confirmar que o id existe. O nome do caso de teste mudou para dizer isso (`apps/api/test/ops-jobs.int.test.ts:243`).

Logs: limpos. O diff não acrescenta nenhum log. As mensagens do ensaio (`registrar(...)`) são texto fixo, sem dado de pessoa.

Auditoria: presente e mais bem provada.
- `job.reprocessado` e `job.descartado` ficam na escola da linha, porque a gravação roda dentro de `runInContext({ requisicaoId, escolaId })` (`apps/api/src/ops/reprocessar-job.ts:33-36` e `apps/api/src/ops/descartar-job.ts:41-45`).
- O teste agora confere o `escola_id` na auditoria, e há um caso novo para a escola B (`apps/api/test/ops-jobs.int.test.ts:54-59`).
- Há um caso novo de concorrência: dois descartes do mesmo job de PDF ao mesmo tempo terminam com uma auditoria só, o material fechado uma vez e o objeto apagado.
- Há mutações que provam que a auditoria não pode ficar sem escola.

Envio externo: nenhum envio novo de dado de aluno para provedor de IA. O runbook passou a avisar que reprocessar `email.enviar-convite` manda de novo um e-mail para fora da casa, e que o operador confere o convite antes (`docs/runbook.md:146-147`).

Seed/fixture: sintético. O ensaio usa uma escola sintética e um `materialId` sorteado, sem material real. O job sai da tabela na restauração (`infra/scripts/ensaio-alertas.ts:358-361` e `:651`).

Bloqueantes: nenhum.

Recomendações:
- Quando `reabrirFalho` reinicia o `criado_em`, a data em que o job foi criado se perde, e só a auditoria `job.reprocessado` fica como rastro (`packages/core/src/queue/job-outbox.repository.ts:274`). Isso está documentado e não fere a regra. Mesmo assim, vale incluir o histórico de reprocessos da auditoria no arquivo do titular, quando o `dados` do job aponta um pedido do titular ou um material.
- Os dois casos que a 3.0 deixou para a 5.8 (`cenarios.md:392-393`) devem continuar bloqueados até a 5.8 existir. São o job `sistema.*` auditado sem escola e o `falhou` de `material.extrair-pdf` fora do expurgo. Até lá vale a recusa com `JobSemEscolaError`.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/ops/reprocessar-job.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/ops/descartar-job.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/test/ops-jobs.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/docs/lgpd.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/docs/runbook.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/infra/scripts/ensaio-alertas.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/packages/core/src/queue/job-outbox.repository.ts`

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-12 19:34:39 · `tasks/prd-ingestao-do-material/3_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A tarefa só toca jobs de operação, o alerta de PDF parado e o ensaio de alertas. Os tipos de job que o operador pode reprocessar ou descartar estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/packages/shared/src/system/job-definitions.ts:14-25`, e nenhum deles grava `Nota`. O único que importa dado, `estrutura.gravar-planilha`, deixa nota de fora por contrato (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/packages/shared/src/importacao/contratos.ts:12-15`). Os comandos de operação seguem recusando `ia.*` e `titular.*` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/src/ops/jobs-que-falharam.ts:25,68`). Todos com autor humano? Sim, porque não existe caminho.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. A tarefa não gera nenhuma saída de IA que chegue ao aluno. Reprocessar e descartar um job grava auditoria com o operador como autor e o número do chamado. Desde a rodada 1, essa auditoria fica na escola dona do job, e há teste novo que prova isso para a escola B.

Supervisão do tutor: ok, porque a tarefa não mexe no tutor.

Autonomia declarada e visível: sim, sem mudança. A tarefa não altera nenhum agente.

Bloqueantes: nenhum.

O que mudou desde a rodada 1 é todo de operação e infra:
- O ensaio de alertas agora para o `worker-pdf` e o religa na restauração.
- Entrou o filtro `job="educa/worker"` na consulta do alerta.
- A auditoria do job passou a ficar na escola da linha.
- Entraram testes de concorrência no descartar.
- `docs/lgpd.md`, `docs/runbook.md` e `docs/infra.md` ganharam texto novo.
- Mudou um import em `fila-de-jobs.ts`.

Nada disso toca nota, correção, tutor, autonomia de agente, decisão sobre aluno ou indicador de professor. A rodada 1 não exigiu correções, então não há nada pendente para conferir.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/docs/runbook.md:131-132`: o aviso para conferir o convite antes de reprocessar `email.enviar-convite` está bom. Se no futuro aparecer um job de mensagem à família, ele deve entrar na lista de tipos que a operação não mexe (`PREFIXOS_QUE_A_OPERACAO_NAO_MEXE`), em vez de ficar só como aviso no runbook. Reenviar uma mensagem que a escola já aprovou não pode depender de o operador lembrar.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-12 19:34:42 · `tasks/prd-ingestao-do-material/3_task.md`

VEREDITO: APROVADO
Caminho quente tocado: fila
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum. A correção exigida na rodada 1 foi feita:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/infra/scripts/ensaio-alertas.ts:591`: o ensaio agora roda `comandoOuFalha(opcoes, 'stop', 'worker-pdf')` antes de gravar o job (`criarJobDePdfParado`).
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/infra/scripts/ensaio-alertas.ts:654`: a restauração tira o job da tabela antes e depois roda `subir(opcoes, ['redis-cache', ...WORKERS_INTERATIVOS, 'worker-pdf'])`. Se o despachante já tiver publicado o job, o `worker-pdf` que volta o recebe sem linha e o recusa como `job.nao_encontrado`. Esse caso já tem teste em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/worker/test/job-execution.int.test.ts:255`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/infra/test/alertas.int.test.ts:233`: o `SERVICOS` passou a incluir o `worker-pdf`, então o teste roda com o ambiente que o runbook documenta. O teste confere a `duracaoS` do `pdfParado` (60) e verifica que o `worker-pdf` voltou `healthy` depois da restauração.
- O runbook e o comentário do script agora dizem o que o código faz: param o `worker-pdf` e o religam.
- O diff traz ainda um teste de concorrência para dois `ops:descartar-job` em `Promise.all` (só um descarta, há uma auditoria e o material fecha uma vez) e um que confere a auditoria na escola da linha (reprocessar na escola B).

Recomendações:
- A parada do `worker-pdf` (`ensaio-alertas.ts:591`) só é provada pelo estouro do prazo do ensaio (mutação sem bloco, descrita em `3_task.md`). Depois do `stop`, uma asserção explícita de que o serviço está parado (pelo `ps` do compose) faria essa mutação cair por asserção, em segundos e não pelo teto de 600 s.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-12 19:35:05 · `tasks/prd-ingestao-do-material/3_task.md`

**VEREDITO: APROVADO**

**Escopo:** respeitado

**Aderência à Tech Spec:** ok. A divergência do `sistema.*` está registrada nos três lugares: `techspec.md` §11, `3_task.md` ("Divergências resolvidas", linha 96) e agora também em `cenarios.md`.

**Portão local:** carimbo válido. O `conferir` acusou typecheck, lint, segredo, dependências, unidade e alvo para o código atual.

**Bloqueantes:** nenhum.

As duas correções da 1ª rodada foram feitas:

1. **`cenarios.md`**
   - Em "Extração no worker", a linha 54 agora diz que os dois comandos recusam o job sem escola com `JobSemEscolaError`, antes de tocar a linha, a fila e a auditoria. Diz também que isso vale até a 5.0, e cita a `techspec.md` §11 e o `3_task.md`.
   - Na seção "Licença" (5.0), as linhas 121 e 122 trazem os dois cenários da 5.8, cada um com a sua mutação: a auditoria do job sem escola com `autor_operador`, e o `falhou` de `material.extrair-pdf` que fica fora do expurgo de 30 dias.
2. **Ensaio**
   - `infra/scripts/ensaio-alertas.ts:591` para o `worker-pdf` antes de gravar o job, e `:654` o religa na restauração.
   - `infra/test/alertas.int.test.ts` agora sobe o `worker-pdf` (`:233`), confere o disparo do `pdfParado` com `for` de 60 s e confere que o `worker-pdf` está `healthy` depois da restauração. Com isso, o resultado não depende mais da ordem em que os arquivos rodam.
   - O runbook (`docs/runbook.md`, parágrafo do ensaio) descreve o que o código faz: para o `worker-pdf` e o religa na restauração.

As mudanças que vieram junto no diff não abrem problema:
- A auditoria passa a ser gravada na escola da linha, com teste para a escola B.
- Há um teste novo de concorrência para dois `ops:descartar-job` sobre o mesmo job de PDF.
- A correção do PromQL do runbook (`job="educa/worker"`).
- O "cerca de 16 min" em `docs/infra.md`.
- O texto de retenção em `docs/lgpd.md`, que cobre o apagamento antes do prazo pelo operador.

**Recomendações:**
- `tasks/prd-ingestao-do-material/3_task.md`, "Sem bloco, com o motivo": a parada do `worker-pdf` no ensaio ficou sem mutação que caia por asserção. Quando ela falta, o único sinal é o ensaio estourar o prazo. Uma asserção barata depois do `stop` faria esse caso falhar de forma legível: conferir pelo `compose ps` que o serviço não está de pé.
- `docs/runbook.md:153`: o parágrafo do ensaio ficou numa linha só, muito longa, fora da quebra que o resto do arquivo usa. É só formatação.

Arquivos citados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/tasks/prd-ingestao-do-material/cenarios.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/infra/scripts/ensaio-alertas.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/infra/test/alertas.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/docs/runbook.md`

## test-engineer · 2ª rodada · APROVADO · 2026-11-12 19:35:37 · `tasks/prd-ingestao-do-material/3_task.md`

VEREDITO: APROVADO

**Cenários exigidos:** os mesmos da 1ª rodada. Nesta rodada conferi a correção exigida e o que o diff r1-r2 alterou: a ordem do ensaio, os serviços do teste de infra, a auditoria na escola da linha, o descartar concorrente e os blocos de mutação novos.

**Cobertos:**
- **A correção exigida foi feita, nos três pontos:**
  - **O ensaio para o `worker-pdf`.** `infra/scripts/ensaio-alertas.ts:591` roda `comandoOuFalha(opcoes, 'stop', 'worker-pdf')` antes de `criarJobDePdfParado`, e a restauração o religa (`:654`, com `subir(opcoes, ['redis-cache', ...WORKERS_INTERATIVOS, 'worker-pdf'])`).
  - **O teste agora sobe o `worker-pdf`.** `infra/test/alertas.int.test.ts:33` o põe em `SERVICOS`, e o caminho feliz passa `servicos: SERVICOS` (`:103`). Com isso o teste repete o comando real, que sobe a stack inteira, e só passa se o ensaio parar o serviço. Já não depende do estado que outro arquivo deixou.
  - **A restauração confere o `worker-pdf` `healthy`** (`alertas.int.test.ts:181`). O bloco de mutação que tira o `worker-pdf` do `subir` cai por asserção, porque o `ps` do serviço parado sai vazio.
  - **Documentação alinhada.** O docblock, o `docs/runbook.md:1089` e o `pdfParado` em `duracaoS` (60) e na conferência do `for:` acompanham a mudança.
- **Auditoria na escola da linha:** "o job falhou da escola B reprocessa no contexto da B" e o `escola_id` conferido em `job.reprocessado` e `job.descartado`. Os dois blocos de `runInContext({ requisicaoId })` derrubam esses casos pela asserção do `escola_id`.
- **Concorrência real no descartar:** "concorrência: dois descartar sobre o mesmo job de PDF, em Promise.all". Cada `executarOpsDescartarJob` abre o seu banco. O caso confere um 0 e um `NAO_ENCONTRADO`, a linha fora, o material `falhou`, o objeto apagado e uma auditoria só.
- **O renome de "job de outra escola" para "job que não falhou"** está certo, porque o comando de operação é global por desenho. Os dois blocos que citavam o nome antigo foram atualizados.
- `npx vitest run --project integracao apps/api/test/ops-jobs.int.test.ts`: 39 passaram. Não rodei o `alertas.int.test.ts`, que leva cerca de 10 min com o compose.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **A parada do `worker-pdf` só tem prova lenta.** `ensaio-alertas.ts:591` não tem bloco de mutação, e o motivo registrado procede: sem a parada, o teste falha pelo motivo certo, "as regras do ensaio disparadas: prazo de 540 s esgotado", mas só depois do teto de 600 s do portão. Uma prova barata com asserção seria embrulhar o `compose` no teste, guardar a ordem das chamadas e conferir que o `stop worker-pdf` vem antes de o job ser gravado. Outra seria o `ResultadoDoEnsaio` devolver o estado do `worker-pdf` no instante do disparo.
2. **Texto desatualizado:** `tasks/prd-ingestao-do-material/3_task.md:90`, item 12 da autoconferência, ainda diz "`NAO_ENCONTRADO` igual para job inexistente, de outra escola e fora do estado". Depois do renome, o caso prova "inexistente e fora do estado".
3. **A tabela de testes não cita os dois casos novos** (`3_task.md:46` e `:55`). Vale pôr "concorrência: dois descartar sobre o mesmo job de PDF…" na linha de concorrência e "o job falhou da escola B reprocessa no contexto da B…" na de Auditoria. Os dois têm bloco de mutação ou provam cláusula; hoje só a seção "Mutações" os cita.
4. **O nome do caso promete mais do que ele confere.** "…e o material fecha uma vez" (`ops-jobs.int.test.ts:371`) só olha o estado final do material e o número de auditorias. Se a intenção é provar que o segundo comando não toca o material, falta conferir o `atualizado_em` do material ou que o storage recebeu um apagar só. Se não for, basta tirar "fecha uma vez" do nome.
