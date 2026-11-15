# Achados das revisões — `tasks/prd-reengenharia-continuacao/3_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-15 14:16:59 · `tasks/prd-reengenharia-continuacao/3_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova. A migration `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/packages/core/drizzle/0058_fila_ferramenta.sql` só amplia dois checks. Um é `configuracao_operacional_vagas_validas`, em `configuracao_operacional_escola`, que tem uma linha por `escola_id`. O outro é `job_registro_fila_valida`, em `job_registro`, onde continuam valendo `job_registro_escola_ou_sistema` e `job_registro_chave_so_com_escola`. O schema TypeScript diz o mesmo que a migration: `configuracao-operacional-escola.ts` e `job-registro.ts` listam as mesmas cinco filas.

Queries verificadas:
- **Vaga por escola.** `EscolaConcurrencyLimiter.chave` monta a chave como `vaga:{fila}:{escolaId}`, então a `ferramenta` tem uma chave separada para cada escola.
- **Vagas configuradas.** `resolverVagas` percorre `QUEUE_NAMES` e lê `vagas` da linha da própria escola, sem nada vindo do cliente.
- **Executor movido.** O `JobExecutor` foi para `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/packages/core/src/jobs/job-executor.ts`. Comparei com o arquivo antigo do worker e só as importações mudaram. O `runInContext` e o escopo pela escola do job estão iguais.
- **Endpoints.** Nenhum controller nem repository de domínio foi alterado. Nenhum endpoint recebe `escolaId`, nenhum `@Unscoped()` novo e nenhuma consulta da camada de rede.

Teste de isolamento: presente e efetivo. Os testes estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/despachante/test/slots.int.test.ts`. Para cada um, tirei mentalmente a cláusula de escopo e o teste quebra:
- **"A sem vaga de ferramenta não atrasa B".** Se a chave perder a escola, as 4 vagas tomadas pela A seguram a B, e o `aguardarEstado(daEscolaB, 'concluido', 3_000)` falha.
- **"a ferramenta tem vaga própria".** Se a chave perder a fila, o Tutor da A não começa com as 4 ferramentas dela rodando.
- **"vagas.ferramenta=2 vale só para aquela escola".** Se a configuração da A vazar para as outras escolas, o máximo de B e C deixa de ser 4.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/packages/core/src/jobs/job-executor.test.ts:1` importa `currentContext`, `createLogger` e `JobToRun` de `@educa/core` de dentro do próprio `core`. Convém importar pelo caminho relativo, como o `job-executor.ts` já faz, para não depender de o pacote resolver a si mesmo.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/worker/src/composition.ts:1` e `slots.int.test.ts:2` juntaram a importação de várias linhas numa linha só. Isso fica difícil de revisar e faz o diff crescer sem necessidade. Vale voltar ao formato do formatter.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-15 14:17:23 · `tasks/prd-reengenharia-continuacao/3_task.md`

VEREDITO: APROVADO

A tarefa 3.0 é infraestrutura de fila. Ela não cria campo de pessoa, rota, DTO, arquivo nem envio externo, e não muda nenhum log.

Campos pessoais tocados: nenhum. A migration `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/packages/core/drizzle/0058_fila_ferramenta.sql` só amplia dois checks: o `job_registro_fila_valida` e o `configuracao_operacional_vagas_validas`, com a `ferramenta` em cada um. Não entra coluna, linha nem índice. O `vagas` é configuração da escola, não dado de pessoa.

Fora da tabela de dados do docs/lgpd.md: nada. O `job_registro` já está no mapa (`docs/lgpd.md:116`): o `dados` leva só ids e parâmetro técnico, com a retenção definida. A fila nova é só mais um valor de `fila`.

Autorização por objeto: ok. A tarefa não tem endpoint. O `JobExecutor` mudou de pasta com `git mv` e 97% de similaridade, e só os imports mudaram. Ele continua procurando a linha pelo repository, com o escopo da escola do contexto, e job de outra escola dá o mesmo `nao_encontrado` que job inexistente.

Logs: limpos. As chamadas de log em `packages/core/src/jobs/job-executor.ts` (linhas 226 a 485) levam só `evento`, `jobId`, `tentativa`, `codigo`, `prazoMs` e `summarizeError`. Nos 11 processadores do worker, a mudança é só de import. Na regra do alerta (`infra/grafana/alertas/job-interativo-esperando.yaml`), o resumo leva `fila` e `escola_id`, que é UUID, e nenhum dado de pessoa.

Auditoria: não se aplica. Nenhuma ação desta tarefa está entre as que a regra 20, item 10, manda auditar.

Envio externo: nenhum. O `ia.executar` e o `worker-ia` ficaram para a tarefa 5.0.

Seed/fixture: sintético. A migration nova é testada com "Rede da migração da ferramenta", "Escola da ferramenta", slug `ferramenta-a` e `dados` `'{}'`. Os testes e fixtures do worker e do despachante só mudaram imports e os mapas `Record<QueueName, …>`.

Pergunta de fechamento: a resposta não muda com esta tarefa. Nada novo se guarda sobre o aluno e nada novo sai do sistema. O arquivo do titular e o mapa de dados continuam valendo como estavam.

Bloqueantes: nenhum.

Recomendações:
- **Para a 5.0:** o job `ia.executar` vai rodar na fila `ferramenta` e precisa manter o `dados` do `job_registro` só com ids, como o `docs/lgpd.md:116` promete. O prompt, o texto do professor e o trecho do aluno ficam no registro da execução (`ExecucaoAgente`), não no payload do job. Hoje nenhum teste estrutural garante isso para o tipo novo. Vale um caso que recuse campo de texto livre no esquema estrito do tipo, em `JOB_DEFINITIONS`.
- **Para a 5.0:** a cópia `failed` que o BullMQ guarda no Redis da fila `ferramenta` deve continuar só com o código da falha, sem a mensagem do provedor de IA. O `QueueFacingError` já faz isso no executor, mas vale um caso que prove com um erro do adaptador de IA.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-15 14:17:26 · `tasks/prd-reengenharia-continuacao/3_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum novo e nenhum alterado. Os processadores do worker (`consolidar-uso`, `eliminar-titular`, `enviar-email`, `expurgar-*`, `extrair-pdf`, `gravar-planilha`, `montar-arquivo`, `synthetic`, `varrer-envios`) só tiveram os imports trocados. Nenhum deles grava em `Nota`, e o `grep` por `lancadaPor`/`nota` no worker, no despachante e em `packages/core/src/jobs` volta vazio. Todos com autor humano? sim, e a tarefa não abre caminho novo.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhuma saída de IA nasce nesta tarefa. A fila `ferramenta` existe, mas ainda não tem processador nem réplica que a consuma; isso só chega com o `ia.executar` e o `worker-ia`, na 5.0.
Supervisão do tutor: ok. A `interativa` vai de 5 para 10 vagas e ganha uma vaga separada da ferramenta. Isso não muda nada do que o professor vê.
Autonomia declarada e visível: sim. Nada nesta tarefa mexe nisso; governança e agentes não aparecem no diff.

O que conferi:
- O executor mudou de lugar sem mudar de lógica. Comparei `git show HEAD:apps/worker/src/job-executor.ts` com `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/packages/core/src/jobs/job-executor.ts`, e a única diferença é o bloco de imports.
- A migration `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/packages/core/drizzle/0058_fila_ferramenta.sql` só amplia dois checks (`job_registro_fila_valida` e `configuracao_operacional_vagas_validas`). Não cria coluna nem campo de nota, conceito ou devolutiva, e não toca discursiva nem redação (D55).
- Não encontrei nada de supervisão de comportamento do aluno nem de métrica de professor. O alerta `job-interativo-esperando` mede a espera da fila por escola (`fila`, `escola_id`), não pessoas.
- `docs/regulacao.md` não mudou. A tarefa não tem tela, então não havia fotos a ler.

Bloqueantes: nenhum

Recomendações:
- Para a 5.0, quando o `ia.executar` passar a consumir a `ferramenta`: o que ela gera chega ao aluno como material, atividade ou adaptação, então precisa nascer pendente e ter aprovação registrada (regra 70, item 3). A fila não herda a exceção do tutor (D47). Peça um teste de integração que prove o estado pendente pela fila, não só pela rota síncrona.
- Também na 5.0: hoje a `ferramenta` leva só a proposta e o artefato. Se algum job de discursiva ou redação um dia entrar nessa fila, ele não pode gerar nada sobre o texto do aluno (D55). Vale uma guarda que recuse esses tipos na `ferramenta`.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-15 14:17:59 · `tasks/prd-reengenharia-continuacao/3_task.md`

VEREDITO: APROVADO

Caminho quente tocado: fila | migration

Rate limit: ok (a tarefa não mexe em limite de requisição; a vaga continua por escola e por fila, `vaga:{fila}:{escola}`)

Fila e prioridade: ok. A `ferramenta` fica entre a `interativa` e a `normal`, com vaga própria de 4 por escola, e a `interativa` sobe para 10. A conta 10 escolas × 10 vagas = 100 cabe nos 2 × 50 do pool interativo. Uma escola cabe numa réplica só. Nenhuma tarefa em lote foi para fila interativa. Nenhum tipo de job declara `fila: 'ferramenta'` antes da 5.0, então nenhum job fica sem consumidor.

Concorrência: protegida. O limitador é o ZSET em Lua, o mesmo de antes. Os testes em `apps/despachante/test/slots.int.test.ts` provam três coisas: a 5.ª ferramenta da escola A espera, o Tutor da A começa na hora e a escola B não é atrasada.

Índice e paginação: ok. Não há query nova. A varredura usa `order by prioridade, criado_em, id` com cursor, e o índice continua o de sempre.

Degradação de IA: não se aplica

Migration: compatível. A 0058 só expande: `DROP`, `ADD ... NOT VALID` e `VALIDATE` nos dois checks, sem coluna nova e sem rename. O teste `packages/core/src/db/migracao-fila-ferramenta.int.test.ts` parte do banco migrado até a 0057, com dado já gravado.

Métrica e alerta: ok. A métrica `job_espera_mais_antiga_s` vem do banco e já é separada por fila. O alerta passou a olhar `fila=~"interativa|ferramenta"`, e o runbook em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/docs/runbook.md` foi atualizado para as duas filas. O teste de integração `infra/test/alertas.int.test.ts` prova que a 20 s a regra não fica pendente e que acima de 30 s ela fica pendente e dispara.

Bloqueantes: nenhum

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/packages/core/src/queue/job-outbox.ts:7`: mudar a numeração da `QUEUE_PRIORITY` não atualiza os jobs que já estão esperando no `job_registro` no momento do deploy. Um `lote` antigo (3) empata com o `normal` novo (3), e um `pdf` antigo (4) empata com o `lote` novo (4). Afeta só a ordem da varredura e só até essas linhas terminarem. Vale registrar isso em "Divergências" da `3_task.md`, ou incluir um `UPDATE job_registro SET prioridade = ... WHERE estado NOT IN ('concluido','falhou')` na própria 0058.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/packages/core/drizzle/0058_fila_ferramenta.sql`: o `VALIDATE` roda dentro da mesma transação, ainda com `ACCESS EXCLUSIVE` em `job_registro`. A partir da 5.0, cada turno do Tutor vira uma linha nessa tabela, que vai crescer bem mais. A migration que vier depois da 5.0 e mexer num check dessa tabela deve separar o `VALIDATE` numa migration própria. O cabeçalho já promete isso; vale abrir um item no `TODO.md` para não depender de alguém lembrar.
- O compose exige `VAGAS_ESCOLA_FERRAMENTA` com `:?`, então o serviço não sobe sem ela. O `.env` da VPS de produção (D82) precisa da variável antes do primeiro deploy com esta tarefa, e o runbook não tem um passo de "variável nova no ambiente de produção". Vale acrescentar esse passo.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/docs/runbook.md`, causa provável 1: os comandos de diagnóstico citam só `worker-interativo-*`. Quando o `worker-ia` existir (5.0), o alerta disparado na fila `ferramenta` vai precisar do `ps` e do `logs` desse serviço. Fica para a 5.0 atualizar.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-15 14:18:08 · `tasks/prd-reengenharia-continuacao/3_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

O que conferi:
- **Escopo.** As seis subtarefas foram feitas. Nada da 5.0 entrou: não há `ia.executar` em `JOB_DEFINITIONS`, nem `worker-ia`, nem `WORKER_POOL_FERRAMENTA` no compose.
- **Executor no `core`.** Foi movido com `git mv`, com similaridade de 97 a 99%, e só os imports mudaram. O lugar antigo não reexporta nada. O `grep` do caminho antigo só acha `tools/processo/revisoes.test.ts:95,928` e os mapas da X8, e a tarefa justifica cada linha.
- **Divergências.** As quatro estão na `techspec.md` §5 "A fila" e no `cenarios.md` §6: a prioridade renumerada, o `bullmq` no `core`, a ausência de `WORKER_POOL_FERRAMENTA` e as constantes de `infra/scripts`. Os 20 de pool por réplica citados no `docs/infra.md` vêm do `onda-3a.md`, linha 60.
- **Migration 0058.** Segue o molde da 0049. O schema TypeScript e o `prioridade-das-filas.test.ts` dizem o mesmo que o SQL.
- **Prioridade renumerada.** O `job_registro.prioridade` só ordena a varredura (`dispatch.repository.ts:330`). Uma linha pendente com o número antigo na hora do deploy só sai fora de ordem por pouco tempo, e o deploy é fora do horário letivo. Não é bug.

Recomendações:
1. **Imports juntados numa linha só.** Cerca de 20 arquivos trocaram o import de várias linhas por uma única linha de mais de 300 caracteres. Isso não era necessário: bastava acrescentar os nomes novos. Fica pior de ler e o diff fica mais barulhento. Exemplos:
   - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/worker/src/composition.ts:1`
   - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/worker/src/processors/enviar-email.ts:1`
   - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/worker/test/queue.fixture.ts:1`
   - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/despachante/test/slots.int.test.ts:2`

   Vale voltar ao formato de várias linhas que o resto do repositório usa.
2. **Testes com a prioridade antiga escrita à mão.** Alguns testes gravam a prioridade do jeito antigo, e esses números agora pertencem a outra fila:
   - `'lote', 3` em `apps/despachante/test/queue-gauge.int.test.ts:145,154,184,258` e em `apps/worker/test/expurgo.int.test.ts:80,206`; o 3 agora é o da `normal`.
   - `'normal', 2` em `packages/core/src/db/migrate.int.test.ts:94,180`; o 2 agora é o da `ferramenta`.

   Nenhuma asserção depende disso hoje, mas o dado de teste mente. Use `QUEUE_PRIORITY.<fila>`, como a tarefa já fez no `synthetic-jobs.int.test.ts`.
3. **Causa 1 do runbook.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/docs/runbook.md:55`, a frase tem dois parênteses seguidos ("(na fila `ferramenta`, … 5.0) (sem `healthy` no `ps`)"). Fica mais claro separar a `ferramenta` em frase própria ou numa causa própria.
4. **Import com estilo diferente.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/worker/test/job-execution.fixture.ts:1`, `import { type JobExecution }` só traz um tipo, então pede `import type { JobExecution }`, como era antes.
5. **Frases com prazo de validade.** O `docs/arquitetura.md` e o `docs/infra.md` dizem que "nenhuma réplica atende a `ferramenta` antes do `worker-ia`, na 5.0". Isso deixa de ser verdade na 5.0, então essa tarefa precisa reescrever as duas frases.

## test-engineer · 1ª rodada · APROVADO · 2026-11-15 14:19:16 · `tasks/prd-reengenharia-continuacao/3_task.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:** uma `ferramenta` nova começa na hora com 1.000 `normal` na fila.
- **Vaga própria:** a escola A, com 4 ferramentas rodando, espera na 5.ª, e o Tutor da A começa na hora.
- **Isolamento:** com as 4 vagas da `ferramenta` da A tomadas, a `ferramenta` da B começa na hora.
- **Borda de configuração:** `vagas.ferramenta = 2` vale só para a A; a B (sem linha) e a C (`vagas` nula) usam 4.
- **Borda de ambiente:** `0`, `-2`, `1.5` e `duas` derrubam a subida do despachante e do worker, nas duas variáveis.
- **Prioridade:** a `ferramenta` fica entre a `interativa` e a `normal`, em `QUEUE_NAMES`, em `QUEUE_PRIORITY` e na ordem em que o relay serve as filas.
- **Pool:** o da `ferramenta` tem o lock e o stalled da `interativa`.
- **Migration:** só expande; os dois checks aceitam `ferramenta`, recusam fila desconhecida, zero, fração e texto, e terminam validados; antes da 0058 o banco recusa `ferramenta`.
- **Alerta:** a 20 s não fica pendente; passando de 30 s fica pendente e depois dispara; sem o job volta a normal.
- **Concorrência:** 5 jobs simultâneos disputando 4 vagas, com despachante e worker de verdade.
- **Executor:** os testes de hoje passam no lugar novo, e o caminho antigo sumiu.

**Cobertos:** todos. Conferi cada linha da tabela de testes contra o arquivo e o nome citado, e todos existem. Os 10 arquivos de unidade da tarefa rodam verdes (240 casos). Os de integração e de infra não rodei; vale o portão, mais o `mvp-tables` e o `compose.int` que você rodou à mão.

Conferi os 23 blocos contra o `git diff`:
- Cada cláusula nova tem bloco, e cada bloco cai num teste que chega à cláusula. Os dois blocos de `QUEUE_NAMES` ficam vermelhos por asserção: no `slots.int`, o despachante deixa de servir a `ferramenta` e a contagem de 4 iniciados não chega. Não é erro de carga.
- O `job-executor.ts` e o `job-executor.test.ts` foram mesmo movidos com `git mv` (similaridade de 97% e 99%). Só os imports mudaram, mais o `ferramenta: 4` no objeto de vagas do teste, o que confirma a justificativa das 29 linhas sem bloco.
- Nenhum `.skip`, `.only`, `any` ou teste comentado no diff.
- Nenhum mock esconde a regra: as vagas são provadas com Redis, Postgres, despachante e worker de verdade.
- Nenhuma chamada de IA.
- Nada importa do caminho antigo; o que sobra no `grep` está justificado no documento.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **`infra/test/alertas.int.test.ts:305`:** o caso da `ferramenta esperando` depende de nenhuma réplica atender a fila. Quando o `worker-ia` nascer, na 5.0, o job vai ser consumido e o caso quebra. A 5.0 precisa segurar o job, por exemplo tomando as 4 vagas da escola antes. Vale registrar na tarefa 5.0.
2. **`tools/ci/ambiente.test.ts:150`:** a conta de "dez escolas cabem nos pools" deixa a `FERRAMENTA` de fora sem dizer. A 5.0, ao criar o `WORKER_POOL_FERRAMENTA`, precisa pôr a fila na lista, ou escrever o motivo de ficar fora.
3. **`apps/despachante/test/slots.int.test.ts:200-221`** (caminho feliz da `ferramenta`):
   - O caso prova que a `ferramenta` tem fila e pool próprios no BullMQ, e não a `QUEUE_PRIORITY`. Os `normal` já estão publicados, então a ferramenta seria publicada na hora mesmo com outra prioridade.
   - Ele fica na linha "prioridade" da tabela; o nome pode enganar quem ler depois. A prioridade em si está provada pelo `prioridade-das-filas.test.ts` e pelo `outbox-relay.test.ts`.
   - O prazo de 2 s medido no relógio da máquina (l.217) repete o padrão do caso da `interativa` (l.171). Não é novo, mas é o tipo de prazo que pode falhar com a máquina carregada.
4. **Concorrência:** não há caso com dois despachantes disputando a vaga da `ferramenta`. O limitador é o mesmo de todas as filas e já está provado com dois despachantes no lote, então é cobertura extra, não lacuna da regra.
5. **Valores esperados lidos da constante:** em `apps/worker/test/job-execution.int.test.ts:316-329`, `expurgo-da-escola.int.test.ts:1362,1407,1435` e `apps/api/test/synthetic-jobs.int.test.ts:95,111-113`, o número esperado passou a vir da própria `QUEUE_PRIORITY.*`. Esses casos não fixam mais o número, só a fila. A ordem continua guardada pelo `prioridade-das-filas.test.ts`, então não há furo.
6. **Para o `infra-guardian`, sem teste a exigir:** os jobs já gravados antes do deploy mantêm a prioridade antiga (`normal` 2, `lote` 3, `pdf` 4). Durante a transição, a varredura e a reconciliação (`dispatch.repository.ts:325`, ordem por `prioridade`) misturam as duas numerações. A janela é curta e só afeta a ordem dessas rotinas; cabe a ele avaliar.

Arquivos principais auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/prd-reengenharia-continuacao/3_task.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/despachante/test/slots.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/packages/core/src/db/migracao-fila-ferramenta.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/packages/core/src/queue/prioridade-das-filas.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/infra/test/alertas.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tools/ci/ambiente.test.ts`

## infra-guardian · 2ª rodada · APROVADO · 2026-11-15 15:11:33 · `tasks/prd-reengenharia-continuacao/3_task.md`

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
- Abrir no `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/TODO.md` um item para pôr `VAGAS_ESCOLA_FERRAMENTA=4` no `.env` da VPS, com dono Joaquim e antes do primeiro deploy com a fila `ferramenta`. O caso dos 6.000 do login tem item no TODO, e este passo hoje só está no runbook, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/docs/runbook.md:74-77`. Sem a variável, o `:?` do `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/infra/compose.yml:335,389,460,496` faz o deploy automático pela `main` parar. A falha é segura, porque os containers antigos continuam de pé, mas a versão nova não entra até alguém trocar o `.env` à mão.

Não havia correção exigida da 1ª rodada. O diff desta rodada mexe em três coisas:
- **Imports:** só o formato mudou, em várias linhas. Nenhum símbolo saiu, e em `expurgo-da-escola.int.test.ts` o `QUEUE_PRIORITY` só mudou de posição na lista.
- **Documentação:** o runbook, o `3_task.md` e o TODO. O que dizem bate com o `.env.example` (interativa 10, ferramenta 4) e com o `infra/compose.yml`. O empate de prioridade entre as linhas antigas e as novas durante o deploy está registrado como efeito conhecido e afeta só a ordem da varredura e da reconciliação.
- **Comportamento em execução:** nada mudou.

## test-engineer · 2ª rodada · APROVADO · 2026-11-15 15:11:59 · `tasks/prd-reengenharia-continuacao/3_task.md`

VEREDITO: APROVADO

Cenários exigidos: os mesmos da 1ª rodada (prioridade da fila `ferramenta` entre `interativa` e `normal`, fila e pool próprios, vagas por escola em `VAGAS_ESCOLA_FERRAMENTA`, os checks da migration 0058, o executor movido para `packages/core`, e o alerta da espera na `ferramenta`). Esta rodada não acrescenta regra nem cenário.

Cobertos: todos, como na 1ª rodada. Li o diff inteiro desde a rodada anterior (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/.processo/ordens/diff-3-r2.patch`). Ele só muda forma e documentação:
- **Imports reformatados** em 15 arquivos (cada nome numa linha, sem mudar o conjunto) e `import type` em `job-execution.fixture.ts`. Em `apps/worker/test/expurgo-da-escola.int.test.ts` o `QUEUE_PRIORITY` foi para o fim da lista, mas o import ainda traz os mesmos nomes. Nenhuma asserção, cenário ou dado de teste mudou.
- **`docs/runbook.md`**: a causa 1 ficou mais clara, e entrou um passo novo, "Variável nova no ambiente de produção", sobre a `VAGAS_ESCOLA_FERRAMENTA`.
- **`TODO.md`**: dois itens novos.
- **`3_task.md`**: o efeito do deploy sobre as linhas antigas de `job_registro` entrou em "Divergências resolvidas", e entraram a tabela "Recomendações sem aplicar" e a seção "Revisões".

Nenhuma cláusula nova sem bloco de mutação, nenhum `.skip`, nenhum mock novo, e a seção "Mutações" e a tabela "Testes que provam" não mudaram. Não havia correção exigida a conferir.

Bloqueantes: nenhum.

Recomendações:
- `3_task.md`, "Recomendações sem aplicar": cinco linhas mandam o trabalho para a tarefa 5.0, mas `tasks/prd-reengenharia-continuacao/5_task.md` não cita nenhuma delas. A busca por `alertas.int.test`, `ambiente.test` e `WORKER_POOL_FERRAMENTA` não encontrou nada lá. As cinco são estas:
  - O caso `infra/test/alertas.int.test.ts:305` ("a ferramenta esperando") quebra quando o `worker-ia` passar a atender a fila.
  - A conta "dez escolas cabem nos pools" em `tools/ci/ambiente.test.ts:150` deixa a `ferramenta` de fora.
  - Faltam três casos: o `dados` do `ia.executar` só com ids, o estado pendente via fila e a guarda de D55 (discursiva e redação) na `ferramenta`.

  A correção é registrar essas linhas na própria `5_task.md`, numa seção de pendências herdadas, para que a 5.0 as tenha como cenário exigido. Se ficarem só na tabela da 3.0, nada garante que voltem.
- As duas recusas com motivo (o prazo de 2 s em `apps/despachante/test/slots.int.test.ts:200-221` e o caso de dois despachantes na `ferramenta`) estão bem justificadas. Ficam registradas para a retro.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-15 15:12:15 · `tasks/prd-reengenharia-continuacao/3_task.md`

VEREDITO: APROVADO

Rodada 2. Revisei só o diff `3ab0c31e..c56da0b9`. A rodada 1 não exigiu correção, então não havia correção a conferir.

**O que mudou nesta rodada:**
- **Imports:** foram quebrados em várias linhas em 15 arquivos do worker e do despachante. Nos arquivos de produção, os nomes importados são os mesmos de antes. Em `apps/worker/test/expurgo-da-escola.int.test.ts` só a posição do `QUEUE_PRIORITY` mudou. Em `apps/worker/test/job-execution.fixture.ts` o import virou `import type`. Nada disso muda o que o código faz.
- **`docs/runbook.md`:** a nota sobre o `worker-ia` saiu da causa 1 e virou uma linha à parte. Entrou também um parágrafo sobre `VAGAS_ESCOLA_FERRAMENTA` no `.env` da VPS. É só configuração de operação, sem dado pessoal. A variável existe em `.env.example:173` e em `infra/compose.yml:335, 389, 460, 496`.
- **`TODO.md`:** dois itens de infra e de teste, citando arquivo e número de linha. Não há dado pessoal neles.
- **`tasks/prd-reengenharia-continuacao/3_task.md`:**
  - A tabela de divergências ganhou uma explicação do efeito no deploy: as linhas antigas da fila ficam com a prioridade antiga até terminarem.
  - Entrou a tabela "Recomendações sem aplicar".
  - Minhas duas recomendações da rodada 1 foram para a tarefa 5.0, que é onde o tipo `ia.executar` e o adaptador passam a existir:
    - o `dados` do job da `ferramenta` levar só identificadores;
    - a cópia `failed` no Redis levar só o código da falha.

**Respostas do checklist:**
- **Campos pessoais tocados:** nenhum.
- **Fora da tabela de dados do docs/lgpd.md:** nada.
- **Autorização por objeto:** ok. O diff não traz rota, repository nem query.
- **Logs:** limpos. Nenhuma chamada de log foi acrescentada ou alterada.
- **Auditoria:** presente. Nenhuma ação deste diff exige registro de auditoria.
- **Envio externo:** nenhum. A fila `ferramenta` ainda não tem quem a consuma, e o envio ao provedor de IA começa na 5.0.
- **Seed/fixture:** sintético. A única mudança em fixture é o `import type` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/worker/test/job-execution.fixture.ts`.

**Bloqueantes:** nenhum.

**Recomendações:**
- Na 5.0, conferir que as duas recomendações minhas encaminhadas para lá viraram teste: `dados` de `ia.executar` só com identificadores, recusado no esquema estrito de `JOB_DEFINITIONS`, e cópia `failed` da `ferramenta` sem a mensagem do provedor. Eu reprovo a 5.0 se ela sair sem esses dois testes.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-15 15:12:22 · `tasks/prd-reengenharia-continuacao/3_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

Nesta rodada li o diff desde a 1ª, de `3ab0c31` a `c56da0b`, e o que ele afeta. A 1ª rodada não pediu correção. O que entrou depois dela:

- **Imports de várias linhas, nos 15 arquivos do worker e do despachante.** Só mudou a forma. Nenhum nome entrou nem saiu. Em `apps/worker/test/expurgo-da-escola.int.test.ts` o `QUEUE_PRIORITY` apenas trocou de lugar na lista.
- **`apps/worker/test/job-execution.fixture.ts:1`.** Agora usa `import type`, o que está certo, porque só importa tipo.
- **`docs/runbook.md`, causa 1, e o passo novo da variável de produção.** Bate com o `infra/compose.yml`, que lê `VAGAS_ESCOLA_FERRAMENTA` com `:?` nos quatro serviços (linhas 335, 389, 460 e 496), e com o `.env.example` (`INTERATIVA=10`, `FERRAMENTA=4`). O aviso de que o `.env` da VPS não muda no deploy repete o caso já registrado do `LIMITE_REQ_IP_ANONIMO_MIN`.
- **`TODO.md`.** Os dois itens novos (o `VALIDATE` separado e a prioridade escrita à mão nos três testes) têm origem, revisor, rodada e dono, como os outros itens.
- **`3_task.md`, "Divergências resolvidas".** A linha da renumeração ganhou o efeito conhecido no deploy: as linhas antigas de `job_registro` empatam na prioridade. Isso não é divergência nova. A `techspec.md` §5 "A fila" (l.71-73) nunca prometeu reescrever a `prioridade` das linhas que já existem, e a renumeração em si já está na §5 e no `cenarios.md` §6 (l.173).
- **`3_task.md`, "Recomendações sem aplicar".** Cada recomendação tem destino ou motivo de recusa. As que vão para a 5.0 dependem do `worker-ia` e do `ia.executar`, que são escopo dela. As duas recusadas citam a prova que já existe.

Recomendações:
- O empate de prioridade entre as linhas antigas e as novas, até elas terminarem, só está escrito no `3_task.md`. Uma frase na `techspec.md` §5 "A fila", ou no passo de deploy do `docs/runbook.md` (por volta da l.74), deixa isso registrado para quem fizer o deploy, sem depender de achar o documento da tarefa.
- Duas recomendações vão para a tarefa 5.0: atualizar a causa 1 do runbook e reescrever as frases da `docs/arquitetura.md` e da `docs/infra.md` sobre a `ferramenta` sem réplica. Elas só valem se forem anotadas no `5_task.md`. Confira isso antes de a 5.0 começar.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/prd-reengenharia-continuacao/3_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/docs/runbook.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/TODO.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/prd-reengenharia-continuacao/techspec.md

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-15 15:12:24 · `tasks/prd-reengenharia-continuacao/3_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta rodada. O diff não toca `Nota`, correção nem lançamento. Todos com autor humano? sim, porque nada mudou desde a 1ª rodada aprovada.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nada nesta rodada produz saída de IA. A fila `ferramenta` só passa a ter quem a consuma na 5.0, com o `worker-ia`.
Supervisão do tutor: ok. O tutor não foi tocado.
Autonomia declarada e visível: sim. A governança e os agentes não foram tocados.
Bloqueantes: nenhum

**O que esta rodada mudou** (arquivo: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/.processo/ordens/diff-3-r2.patch`; ignorei `achados/`, que vem do hook):
- **Imports em várias linhas, em 15 arquivos.** Só mudou a forma de escrever. Nenhum símbolo entrou ou saiu. Em `expurgo-da-escola.int.test.ts`, o `QUEUE_PRIORITY` só trocou de posição na lista. Em `job-execution.fixture.ts`, o import virou `import type`.
- **`docs/runbook.md`.** A causa 1 foi reescrita. Entrou um parágrafo novo sobre a variável `VAGAS_ESCOLA_FERRAMENTA` no `.env` da VPS. É assunto de operação, fora da regra 70.
- **`tasks/prd-reengenharia-continuacao/3_task.md`.** A divergência da `QUEUE_PRIORITY` agora registra o efeito no deploy. Entrou também a tabela "Recomendações sem aplicar".
- **`TODO.md`.** Duas linhas novas: o `VALIDATE` da `0058` e a prioridade antiga escrita à mão em três testes. Nenhuma delas toca a regra 70.

**Correções exigidas na 1ª rodada:** não havia.

**Minhas duas recomendações da 1ª rodada** foram mandadas para a tarefa 5.0, com destino escrito na tabela de `3_task.md`:
- Teste de integração provando que o que a `ferramenta` gera nasce pendente (regra 70, item 3).
- Guarda que recuse job de discursiva ou redação na fila `ferramenta` (D55).

O destino está certo, porque é a 5.0 que cria o `ia.executar` e o `worker-ia`. Quando a 5.0 for auditada, as duas passam a ser bloqueantes se faltarem: lá elas deixam de ser cobertura extra e viram a prova da regra.

Recomendações: nenhuma nova.
