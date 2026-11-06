# Achados das revisões — `tasks/correcoes/2026-11-06-despachante-sem-prazo-sob-carga.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-06 08:16:11 · `tasks/correcoes/2026-11-06-despachante-sem-prazo-sob-carga.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A mudança mexe só em quatro arquivos de teste da fila (`job_registro`, com `escola_id`, `fila`, `prioridade`, `tipo`, `nao_urgente` e `dados` = `{rotulo}`). Nenhum campo de aluno, professor ou responsável é criado, lido ou exposto. O código de produção não muda.

Fora da tabela de dados do docs/lgpd.md: nada, porque não entra campo novo nem migration.

Autorização por objeto: não se aplica. Não há rota, DTO nem endpoint novo. A medição continua por `reservarDaEscola`, `publicadosEntre`, `medirPendentes` e `medirFalhos`, dentro de `runInContext` com o `escolaId` do contexto, como antes.

Logs: limpos. O novo `#comPrazoDaPreparacao` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/queue.fixture.ts` não registra nada. Ele não registra o texto da instrução, os valores, o plano nem as linhas devolvidas. O erro sobe sem nada acrescentado.

Auditoria: não se aplica. A mudança não tem nenhuma das ações que a regra 20, item 10, exige auditar: leitura de dado de aluno pela coordenação ou pela rede, exportação, alteração de nota ou de permissão, aprovação de saída de IA.

Envio externo: nenhum. A mudança não usa provedor de IA nem serviço terceiro. Tudo fica no Postgres e no Redis do próprio teste.

Seed/fixture: sintético. As escolas e redes vêm de `criarEscola` e `criarRede`, com os nomes "Escola sintética da fila" e "Rede sintética da fila" e UUID aleatório. Os jobs têm `tipo` `'sintetico'` e um rótulo de teste. O `explicar` roda numa transação sempre desfeita, então o `EXPLAIN ANALYZE` de uma escrita não deixa efeito no banco do teste.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/queue.fixture.ts`: o `explicar` monta a instrução juntando o texto recebido (`explain ... ${texto}`), e o `set local statement_timeout` monta o prazo a partir de uma constante. Hoje é seguro, porque o texto vem do repository e o prazo é constante. Vale um comentário dizendo que o `explicar` só aceita instrução capturada do repository, nunca texto montado com dado de fora. Assim ninguém o reaproveita em outro teste com valor juntado no texto em vez de passado como parâmetro.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-06 08:16:12 · `tasks/correcoes/2026-11-06-despachante-sem-prazo-sob-carga.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration. `job_registro` e `configuracao_operacional_escola` são usadas como já eram; `job_registro` tem `escola_id` com FK.

Queries verificadas:
- **Repository de produção:** `DispatchRepository.reservarDaEscola` em `packages/core/src/queue/dispatch.repository.ts` não mudou. O caso de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/despachante/test/janela.int.test.ts` continua chamando a reserva dentro de `runInContext({ escolaId: ESCOLA_A })`, ou seja, com o escopo vindo do contexto e não de parâmetro.
- **Funções de teste da fixture:** `semear` e `explicar` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/queue.fixture.ts` só preparam dado e tiram plano. Ficam em arquivo de teste e não são um caminho de leitura do produto.
- **`explicar`:** o `EXPLAIN ANALYZE` executa de verdade a instrução de reserva, que é um `UPDATE`. Ele roda numa transação que termina sempre em `rollback`, então não deixa efeito entre arquivos.
- **Endpoints:** nenhum endpoint foi alterado e nenhuma entrada aceita `escolaId` do cliente.
- **Camada rede:** nada nesta tarefa toca consulta agregada.
- **`@Unscoped()`:** nenhum novo.

Teste de isolamento: não se aplica a esta tarefa, porque ela não cria módulo, repository nem endpoint. Os casos de escopo por escola do despachante não foram tocados. O caso alterado ainda prova o que provava: se a reserva sair do índice parcial dos urgentes, a asserção sobre o índice falha, como mostra a mutação registrada na tarefa.

Bloqueantes: nenhum.

Recomendações:
- Em `apps/despachante/test/queue-gauge.int.test.ts:175` e `:279`, os dois `EXPLAIN` passaram de `analyze` sem transação para `analyze, buffers` numa transação desfeita. O efeito é neutro, porque as instruções são `SELECT`, mas vale uma linha na tarefa dizendo que essa mudança de forma é intencional.

## infra-guardian · 1ª rodada · REPROVADO · 2026-11-06 08:16:31 · `tasks/correcoes/2026-11-06-despachante-sem-prazo-sob-carga.md`

VEREDITO: REPROVADO
Caminho quente tocado: fila (só os testes e a fixture; o código de produção não muda)
Rate limit: não se aplica
Fila e prioridade: ok
Concorrência: protegida (a tarefa não muda nenhum caminho de concorrência)
Índice e paginação: ok (os três `EXPLAIN` continuam exigindo `job_registro_pendentes_urgentes_idx`, `job_registro_falhos_idx` e `job_registro_pkey`, e a instrução medida continua indo pelo pool de 2 s)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (não há código de produção nem alerta novo)

Bloqueantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/queue.fixture.ts:347`: o `semear` agora devolve as linhas (`Promise<Row[]>`). O documento diz que "quem ignorava o retorno não muda", mas um teste usa o retorno: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/queue-fixtures.int.test.ts:19` espera `bancada.semear('select pg_sleep(4.5)')` com `.resolves.toBeUndefined()`. Rodei esse arquivo sozinho e ele falha: `AssertionError: expected [ { pg_sleep: '' } ] to be undefined`. É justamente o teste que prova que a preparação passa dos 2 s do pool e que o pool normal continua cortando em 2 s, ou seja, a base desta correção. O portão local não pega a falha porque só roda o que a árvore alterou, e esse arquivo não foi alterado. Ela apareceria na esteira da spec. Uma das duas correções é exigida:
  - ajustar a asserção para o novo contrato, por exemplo `.resolves.toEqual([{ pg_sleep: '' }])`, e incluir o arquivo na lista da correção;
  - ou manter `semear` com retorno `Promise<void>` e criar um método separado para a preparação que devolve linhas.

  Na primeira opção, a tarefa passa a ter 5 arquivos fora de `tasks/`. O documento cita "abaixo do limite de 5", então é preciso confirmar se 5 ainda cabe.

Recomendações:
- `explicar` (`queue.fixture.ts:357`) não tem teste próprio que prove os 60 s nem que a transação é desfeita. Um caso em `queue-fixtures.int.test.ts` resolveria: um `explain` de uma escrita que passe de 2 s, e depois a conferência de que a linha não mudou.
- `queue-gauge.int.test.ts:175` e `:279` passaram a pedir `BUFFERS` no `EXPLAIN`. Não muda o que é verificado, mas vale registrar no documento.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-06 08:16:34 · `tasks/correcoes/2026-11-06-despachante-sem-prazo-sob-carga.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. A correção mexe só em teste e na fixture, e o código de produção não muda.
Portão local: o carimbo é válido (typecheck, lint, segredo, dependências, unidade, alvo). Ele não cobre o arquivo que quebrou, porque o portão roda só os testes de integração que a árvore alterou.

Bloqueantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/queue.fixture.ts:347`: o `semear` deixou de devolver `void` e agora devolve as linhas. Com isso quebra o teste da própria bancada, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/queue-fixtures.int.test.ts:19`, que espera:
  ```ts
  await expect(bancada.semear('select pg_sleep(4.5)')).resolves.toBeUndefined()
  ```
  Rodei esse arquivo sozinho e ele ficou vermelho: `AssertionError: expected [ { pg_sleep: '' } ] to be undefined`. Como a correção não alterou esse arquivo, o portão da tarefa não o rodou, e ele cairia na esteira da spec. Isso também desmente a frase do documento "quem ignorava o retorno não muda" (linha 46 da correção).
  O que precisa mudar:
  - Ajustar a asserção para o novo contrato, por exemplo `.resolves.toEqual([{ pg_sleep: '' }])` ou `.resolves.toHaveLength(1)`. Ela tem de continuar provando que a instrução passou dos 4 s do cliente e dos 2 s do servidor.
  - Acrescentar esse arquivo à lista da correção. Com ele, a correção passa a ter 5 arquivos fora de `tasks/`. É preciso conferir se isso ainda fica dentro do limite citado no comentário da linha 5 e corrigir o texto, que hoje fala em 4 arquivos "abaixo do limite de 5".
  - Corrigir a frase da linha 46.
  - Gerar o carimbo de novo com `node tools/processo/portao-local.ts --tarefa tasks/correcoes/2026-11-06-despachante-sem-prazo-sob-carga.md`.

Recomendações:
- Fora o próprio caso, nada prova que o `explicar` passa do prazo de 2 s e desfaz a transação. Vale acrescentar ao `queue-fixtures.int.test.ts`, que já vai ser alterado, um caso curto: `explicar` sobre um `insert` não deixa linha no banco e passa do prazo de 2 s do pool. A cobertura em si é decisão do `test-engineer`.
- O tipo padrão `Record<string, never>` no `semear<Row>` (`queue.fixture.ts:347`) não descreve o que volta quando ninguém informa o tipo. `Record<string, unknown>` diz isso com mais clareza.
- Os dois `EXPLAIN` da `queue-gauge` passaram a usar `buffers`, que eles não pediam antes. A mudança não faz mal, mas não está registrada no documento.

## conformidade-reviewer · 1ª rodada · REPROVADO · 2026-11-06 08:16:36 · `tasks/correcoes/2026-11-06-despachante-sem-prazo-sob-carga.md`

VEREDITO: REPROVADO

O motivo da reprovação não é a regra 70: nenhum item dela é afetado. É um teste que esta correção deixa vermelho. Rodei o teste e ele falhou, então o bloqueio é por bug.

Caminhos de escrita em Nota: nenhum novo nesta tarefa — todos com autor humano? sim. O diff só mexe em arquivos de teste do despachante e na fixture de fila. As únicas escritas são em `job_registro`, com tipo `'sintetico'`. O `semear` já existia e nenhum chamador escreve em `nota`. O `explicar` roda numa transação sempre desfeita.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok (nenhum fluxo de saída de IA foi tocado)
Supervisão do tutor: ok (não foi tocada)
Autonomia declarada e visível: sim (não foi tocada; `docs/regulacao.md` e a regra 70 não mudaram)

Bloqueantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/queue.fixture.ts:347`: o `semear` agora devolve `Promise<Row[]>`, e não mais `Promise<void>`. Isso quebra o teste da própria fixture, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/queue-fixtures.int.test.ts:19`, que espera `bancada.semear('select pg_sleep(4.5)')` com `.resolves.toBeUndefined()`. Rodei esse arquivo e ele falhou:
  ```
  AssertionError: expected [ { pg_sleep: '' } ] to be undefined
   ❯ apps/worker/test/queue-fixtures.int.test.ts:19:57
  ```
  A tarefa diz que "quem ignorava o retorno não muda", mas esse caso não ignorava o retorno, e ele fica fora da lista de arquivos alterados. A suíte `integracao` fica vermelha de um jeito determinístico. Isso é pior que a intermitência que a correção resolve.
  Correção exigida: trocar a asserção da linha 19 por uma que prove a regra do caso, que é passar dos prazos do pool sem ser cortado. Por exemplo, `.resolves.toEqual([{ pg_sleep: '' }])` ou `.resolves.toBeDefined()`. Depois disso, `queue-fixtures.int.test.ts` entra nos arquivos alterados da tarefa. São 5 arquivos fora de `tasks/`, ainda no limite. Por fim, rodar `npx vitest run --project integracao apps/worker/test/queue-fixtures.int.test.ts` e os três arquivos do despachante.

Recomendações:
- Vale incluir no texto da tarefa uma linha que diga que, com a assinatura nova, o `queue-fixtures.int.test.ts` foi conferido. A busca por chamadores do `semear` deixou esse arquivo passar.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-06 08:17:04 · `tasks/correcoes/2026-11-06-despachante-sem-prazo-sob-carga.md`

VEREDITO: REPROVADO

Cenários exigidos:
- O caso do plano dos urgentes (`janela`) passa quando a tabela compartilhada está ocupada (ANALYZE de outro arquivo ou autovacuum segurando o lock) e continua caindo quando o repository deixa de usar o índice parcial.
- Os planos do `slots` e da `queue-gauge` continuam provando o índice usado e o limite de linhas descartadas, agora pelo `explicar`.
- O que cada caso mede continua no pool de 2 s de produção (`reservarDaEscola`, `publicadosEntre`, `medirPendentes`, `medirFalhos`).
- Todos os testes que já usavam a fixture continuam passando depois que o `semear` mudou de assinatura.

Cobertos:
- O bloco de mutação (`not (nao_urgente is true)`) mostra que o caso da `janela` continua guardando a regra e que o `explicar` lê o plano de verdade.
- Rodei os três arquivos alterados: `janela`, `slots` e `queue-gauge`, 41 de 41 verdes.
- Os limites de tempo que medem uma promessa do produto (`slots` com menos de 2 s e menos de 1,5 s, `redis-down`, `redis-ready`, `outbox-sweeper`) ficaram no pool normal, de propósito e com o motivo escrito no documento. Está correto.
- Não há `.skip`, teste comentado nem mock escondendo a regra. Nada toca provedor de IA.

Bloqueantes:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/queue-fixtures.int.test.ts:19`. A correção quebra o teste da própria fixture, que não foi tocado e por isso o portão da tarefa não roda. Ele ainda espera `await expect(bancada.semear('select pg_sleep(4.5)')).resolves.toBeUndefined()`. Desde que o `semear` passou a devolver as linhas (`queue.fixture.ts:347`), o retorno é `[{ pg_sleep: '' }]`. Rodei o arquivo e ele falhou: `AssertionError: expected [ { pg_sleep: '' } ] to be undefined`. O vermelho só apareceria na esteira, uma tarefa depois. A frase do documento "quem ignorava o retorno não muda" é falsa para esse chamador.
   Correção exigida:
   - Trocar a asserção por uma que leia o resultado, por exemplo `.resolves.toEqual([{ pg_sleep: '' }])`.
   - Pôr esse arquivo na correção e no documento, e conferir se o quinto arquivo fora de `tasks/` ainda cabe no limite citado no comentário do topo, que hoje diz "4 fora de `tasks/`, abaixo do limite de 5".

Recomendações:
- O `explicar` (`queue.fixture.ts:357`) não tem teste próprio. O `semear` tem o seu, que prova os 60 s nos dois lados. Na mesma correção do teste da fixture, vale acrescentar dois casos:
  - o `explicar` passa dos 2 s do pool, por exemplo com `bancada.explicar('select pg_sleep(4.5)')`;
  - ele não deixa efeito, por exemplo com o `explicar` de um `update` seguido de uma releitura que mostra a linha sem mudança.

  Hoje o rollback só é garantido por leitura do código. Antes desta correção, o EXPLAIN ANALYZE da `queue-gauge` e do `slots` rodava sem transação, então o comportamento agora é mais seguro, mas nada o prende.
- `queue-gauge.int.test.ts:175` e `:279` passaram de `explain (analyze, format json)` para `explain (analyze, buffers, ...)`. É inofensivo, mas convém registrar no documento que a forma do EXPLAIN mudou nesses dois casos.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-06 08:25:35 · `tasks/correcoes/2026-11-06-despachante-sem-prazo-sob-carga.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. É uma correção só de arquivos de teste e não muda código de produção.

Portão local: carimbo válido. O `conferir` passou com typecheck, lint, segredo, dependencias, unidade e alvo.

Bloqueantes: nenhum.

Todas as correções exigidas na 1ª rodada foram feitas:
- **Asserção do teste da bancada:** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/queue-fixtures.int.test.ts:20` agora espera `.resolves.toEqual([{ pg_sleep: '' }])`, o que segue o novo contrato do `semear`. O caso continua provando duas coisas: o pool normal corta em 2 s (linha 18, `57014`), e a instrução de 4,5 s passa pelo `semear`.
- **Arquivo na lista da correção:** `queue-fixtures.int.test.ts` entrou na lista, na linha 50 do documento. O comentário da linha 5 agora conta 5 arquivos fora de `tasks/`. Conferi o limite: tanto `.claude/skills/corrigir/SKILL.md:91` quanto `.claude/skills/revisar-tarefa/SKILL.md:27` dizem "mais de 5", então 5 arquivos ainda cabem, como o texto afirma.
- **Frase da linha 46:** foi corrigida e agora registra a exceção do teste da própria fixture.
- **Carimbo:** foi gerado de novo e vale para a árvore atual.

O que mais mudou nesta rodada:
- **Dois casos novos para o `explicar` (linhas 23 a 41).** O primeiro prova que o prazo de 60 s vale nos dois lados. O segundo prova o rollback: roda um `update` de verdade, o plano devolvido é `ModifyTable` e a linha relida continua `aguardando`. Cada caso tem a sua mutação declarada (`'rollback'` trocado por `'commit'`, e a remoção do `set local statement_timeout`), e as duas atingem a cláusula certa.
- **Linha que o teste cria:** ela é apagada no `finally`, então nenhum outro teste herda essa linha.
- **Padrão do `semear`:** agora é `Record<string, unknown>`. O comentário do `explicar` passou a avisar que o texto entra na instrução por junção.

Recomendações:
- **Contagem de estabilidade desatualizada:** a linha 55 do documento ainda diz "os três arquivos inteiros, 41 casos verdes". Isso foi medido antes de `queue-fixtures.int.test.ts` entrar na correção, que agora tem quatro arquivos de teste e dois casos a mais. Convém atualizar o número ou dizer a que rodada ele se refere.
- **Estado inicial no caso do `update`:** o caso confia que `enfileirar(..., { fila: 'lote' })` cria a linha em `aguardando`. Ler o estado antes do `explicar` deixaria o teste mais claro: se o padrão da fixture mudar, ele ainda mostraria que nada mudou, sem depender desse padrão.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-06 08:26:11 · `tasks/correcoes/2026-11-06-despachante-sem-prazo-sob-carga.md`

VEREDITO: APROVADO
Caminho quente tocado: fila (só a bancada de teste do despachante e do worker; o código de produção não muda)
Rate limit: ok (não muda nesta tarefa)
Fila e prioridade: ok
Concorrência: protegida (não muda nesta tarefa)
Índice e paginação: ok. Os EXPLAIN da `janela`, da `slots` e da `queue-gauge` continuam conferindo o índice parcial pelo `explicar`. O que os testes medem segue pelo pool com os 2 s de produção.
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (a medição da `queue-gauge` continua pelo pool normal)
Bloqueantes: nenhum

A correção exigida na 1ª rodada foi feita, pela primeira das duas opções:
- `apps/worker/test/queue-fixtures.int.test.ts:20` agora espera `.resolves.toEqual([{ pg_sleep: '' }])`, e o arquivo entrou na lista da correção.
- Rodei o arquivo sozinho e passaram os 3 casos: o do `semear` e os dois novos do `explicar` (passa dos prazos, e o `update` explicado é desfeito, com a linha ainda `aguardando`).
- `tsc` sem erro no worker e no despachante. O `include` do worker cobre `test/`, então a troca do tipo padrão do `semear` para `Record<string, unknown>` foi checada.
- Nenhum outro chamador de `bancada.semear` usa o retorno. Os `semear` de `expurgo-da-escola.int.test.ts` são funções do próprio arquivo, não a fixture.
- 5 arquivos fora de `tasks/` ainda cabem: a regra das skills `corrigir` e `revisar-tarefa` vale para "mais de 5", e o `revisor-geral` já está marcado.

Recomendações:
- `apps/worker/test/queue-fixtures.int.test.ts:31`: o caso do `explicar` com `update` apaga o job no `finally`, mas deixa no banco de teste a rede e a escola sintéticas criadas por `bancada.escola()`. É o mesmo padrão dos outros testes da bancada, então não bloqueia. Fica registrado para a retro, caso a tabela de escolas do banco de teste cresça a ponto de pesar.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/queue.fixture.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/worker/test/queue-fixtures.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/correcoes/2026-11-06-despachante-sem-prazo-sob-carga.md

## test-engineer · 2ª rodada · APROVADO · 2026-11-06 08:26:17 · `tasks/correcoes/2026-11-06-despachante-sem-prazo-sob-carga.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- O caso de volume da `janela` não cai pelo prazo de 2 s do pool quando prepara os dados e tira o plano, e continua provando que a reserva dos urgentes desce pelo índice parcial.
- O `semear` passa dos dois prazos (2 s no servidor, 2 s + 2 s no cliente), e o pool normal continua cortando em 2 s.
- O `explicar` passa dos mesmos prazos e devolve o nó raiz do plano.
- O `explicar` de uma escrita não deixa efeito.
- Quem já chamava o `semear` não quebra com o novo retorno.
- Isolamento e permissão não se aplicam: a mudança é só em arquivos de teste, e o código de produção fica igual.

**Cobertos:**
- **Correção exigida 1, feita.** `apps/worker/test/queue-fixtures.int.test.ts:20` agora lê o retorno com `.resolves.toEqual([{ pg_sleep: '' }])`. Rodei `npx vitest run apps/worker/test/queue-fixtures.int.test.ts` e passaram 3 de 3, em 16,5 s.
- **Documento atualizado.** O arquivo entrou em "Correção". O comentário do topo diz agora "5 fora de `tasks/`" e explica que o limite do `revisor-geral` é "mais de 5". O documento também reconhece que a frase "quem ignorava o retorno não muda" tinha exceção.
- **Outros chamadores do `bancada.semear`.** Conferi todos com grep: `queue-gauge`, `slots`, `janela` e `expurgo-da-escola` usam só `await`, sem ler o retorno. A troca do tipo padrão para `Record<string, unknown>` não muda nada para eles.
- **`explicar` passa dos 4 s** (`queue-fixtures.int.test.ts:23-27`). Mostra primeiro o corte do pool normal (57014) e depois o nó `Result`. A mutação 3 tira o `set local statement_timeout` (`queue.fixture.ts:370`). Com isso o `pg_sleep(4.5)` morre nos 2 s do servidor, a promessa é rejeitada e o `.resolves` cai. É vermelho pelo motivo certo: o prazo do cliente segue em 65 s, então quem corta é o servidor.
- **`explicar` de uma escrita** (`queue-fixtures.int.test.ts:29-41`). Confere o plano `ModifyTable` e relê a linha ainda `aguardando`. A mutação 2 troca `'rollback'` por `'commit'` em `queue.fixture.ts:361`. Com isso a linha fica `concluido` e a asserção da linha 37 cai, que é a cláusula certa. O `finally` apaga a linha criada.
- **Sem interferência de outros arquivos.** O teste da escrita só funciona se nenhum despachante reservar o job no meio. Na integração `fileParallelism` é `false` (`vitest.config.ts:22`), e este arquivo não monta despachante. O risco de outro arquivo reservar ou apagar o job no meio do teste não existe.
- **Recomendações da 1ª rodada aplicadas.** Os dois casos do `explicar` existem. A troca para `(analyze, buffers, format json)` numa transação desfeita, na `queue-gauge`, está registrada no documento (linha 49). O comentário do `explicar` (`queue.fixture.ts:357-358`) registra que ele só recebe a instrução que o repository mandou, com os valores à parte.
- **Mutações.** Os três blocos casam com as cláusulas do diff: o predicado do repository, o rollback do `explicar` e o prazo de 60 s. Nenhum `.skip`, nenhum teste comentado, nenhum mock de coisa nossa e nenhuma chamada de provedor pago.

**Bloqueantes:** nenhum.

**Recomendações:**
- `tasks/correcoes/2026-11-06-despachante-sem-prazo-sob-carga.md:55`: a linha "Estabilidade" ainda fala em "os três arquivos inteiros, 41 casos verdes". Vale incluir o `queue-fixtures.int.test.ts`, que agora tem 3 casos, ou dizer que a contagem é só a dos três arquivos do despachante.
- `apps/worker/test/queue-fixtures.int.test.ts:34`: o caso poderia conferir que a linha está `aguardando` antes do `explicar`. Hoje a prova se apoia no que o `enfileirar` faz por padrão. Não bloqueia, porque a asserção final já exige `aguardando`.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-06 08:26:35 · `tasks/correcoes/2026-11-06-despachante-sem-prazo-sob-carga.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. O diff mexe só nos testes da fila de jobs. O único `update` novo é o do caso `explicar` em `apps/worker/test/queue-fixtures.int.test.ts:25`, que grava em `job_registro` dentro de uma transação desfeita, e o caso confere em seguida que a linha seguiu `aguardando`. Todos com autor humano? Não se aplica, porque nenhum caminho toca `Nota`.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Esta tarefa não traz saída de IA.
Supervisão do tutor: ok. Esta tarefa não mexe no tutor.
Autonomia declarada e visível: sim, sem mudança.
Bloqueantes: nenhum.

A correção exigida na 1ª rodada foi feita:
- `apps/worker/test/queue-fixtures.int.test.ts:20` agora espera `.resolves.toEqual([{ pg_sleep: '' }])`. O caso continua provando que o `semear` passa dos prazos do pool e que o pool normal ainda corta em 2 s (linha 18).
- O `queue-fixtures.int.test.ts` entrou na lista de arquivos alterados. São 5 fora de `tasks/`, e o comentário da tarefa explica a contagem.
- Rodei `npx vitest run --project integracao` nos quatro arquivos (`queue-fixtures` e os três do despachante): 4 arquivos e 44 testes passaram.
- O tipo padrão do `semear` passou de `Record<string, never>` para `Record<string, unknown>`. Rodei `tsc --noEmit` no worker e no despachante, e os dois passaram sem erro. O único outro lugar que chama `semear` é `apps/worker/test/expurgo-da-escola.int.test.ts:937`, e ele ignora o retorno.

Recomendações:
- O comentário novo do `explicar` (`apps/worker/test/queue.fixture.ts:356-357`) lembra que o texto entra por junção. Como é uma fixture de teste, fica por disciplina. Se o `explicar` passar a ser usado fora dos testes de plano, vale uma trava simples, como recusar texto que tenha `;`.
