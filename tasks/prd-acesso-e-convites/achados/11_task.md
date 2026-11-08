# Achados das revisões — `tasks/prd-acesso-e-convites/11_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-08 19:11:55 · `tasks/prd-acesso-e-convites/11_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. O diff não toca em `Nota`, correção, job, seed, importação nem webhook. Todos com autor humano: não se aplica, porque não há escrita nova.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. A tarefa não cria nenhuma saída de IA. O índice novo `auditoria_por_alvo_idx` é parcial e só acrescenta: cobre seis ações de acesso e convites e não muda como se grava nem como se consulta a auditoria de aprovação de IA. A consulta "o que a IA gerou, quem aprovou e quando" (regra 70, item 6) continua igual.
Supervisão do tutor: ok. A tarefa não mexe no tutor nem nas conversas.
Autonomia declarada e visível: sim. A tarefa não altera agentes nem a governança.
Bloqueantes: nenhum

Recomendações:
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/packages/core/src/titular/leitura-do-titular.ts:423`, o `case t.depois->>'papel'` da `senha_provisoria.gerada` devolve `null` para qualquer papel que não seja `coordenador` ou `professor`. Hoje só existem esses dois, vindos de `PAPEL_DO_ALCANCE` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/src/credencial/senha-provisoria.service.ts:101`. Se aparecer um papel novo, o aluno recebe uma linha sem papel, sem aviso. Vale um teste que prenda o domínio de `PAPEL_DO_ALCANCE` aos valores que o `case` cobre. Essa parte é do `privacy-guardian`, não da regra 70.
- Nenhum ponto da regra 70 ficou exposto. O arquivo de um professor só traz atos sobre ele, sem nome nem id de quem fez, e não cria métrica nem leitura da coordenação sobre o professor (item 8, D45).

`docs/regulacao.md` não foi alterado.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-08 19:12:03 · `tasks/prd-acesso-e-convites/11_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova. A `auditoria` ganhou só o índice parcial `auditoria_por_alvo_idx`, que começa por `escola_id`, segue por `(entidade_id, em)` e é parcial nas seis ações. Ele está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/packages/core/drizzle/0046_auditoria_por_alvo.sql` e em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/packages/core/src/db/schema/auditoria.ts:55`. A tabela já tem `escola_id`, e não precisa de `anoLetivoId`.

Queries verificadas (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/packages/core/src/titular/leitura-do-titular.ts:643-656`):
- **Leitura por alvo das quatro ações do usuário:** o filtro é `t.escola_id = ${escolaId} and t.entidade_id = ${titularId}`.
- **Leitura das duas ações da lista:** filtra `t.escola_id` por fora e `l.escola_id` mais `l.usuario_id = titularId` na subconsulta de `lista_nome`. Só entra linha aprovada, porque só a aprovação grava o `usuario_id`.
- **De onde vem o escopo:** o `escolaId` vem de `requireEscolaId()`, do contexto (linha 498), e não de parâmetro. O `titularId` vem do pedido, um fluxo que já existia e que esta tarefa não mudou.
- **Endpoints e `@Unscoped()`:** nenhum endpoint novo, nenhum `escolaId` vindo do corpo ou da query string, nenhum `@Unscoped()`.
- **Autor:** a saída leva só o papel, nunca o autor, o `antes` nem o `depois`.
- **Camada de rede:** não é tocada.

Teste de isolamento: presente e efetivo. O caso "D85: isolamento" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/test/arquivo-do-titular.int.test.ts:457`) grava direto no banco as seis ações da escola B com o `entidade_id` do aluno da A e com o id da linha da lista dele. Fiz a remoção mental das duas cláusulas:
- Sem o `t.escola_id` da leitura por usuário, as linhas da B casam pelo `entidade_id` e o `toEqual(proprios)` quebra.
- Sem o `t.escola_id` da leitura por lista, as linhas da B com `entidade_id = listaId` da A também entram.

As duas remoções estão declaradas como mutação na tarefa. O caso ainda faz a leitura inversa, no contexto da B, e confere que o dado da A não aparece.

Bloqueantes: nenhum

Recomendações:
- O `l.escola_id = ${escolaId}` da subconsulta de `lista_nome` ficou sem bloco de mutação, justificado pela FK composta `(escola_id, usuario_id)`. A justificativa vale. Ainda assim, se essa FK um dia mudar, nenhum teste avisa. Um comentário no código apontando para a FK deixa a dependência à vista.
- O `else 'coordenação'` da leitura por usuário (linha 647) atribui coordenação a qualquer ação que entre na lista sem um ramo próprio. Não é furo de tenant, mas uma sétima ação acrescentada sem cuidado sairia com o papel errado. Listar as ações uma a uma no `case`, sem `else`, ou com `else null`, fecha isso.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-08 19:12:24 · `tasks/prd-acesso-e-convites/11_task.md`

VEREDITO: APROVADO
Caminho quente tocado: migration
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok
Bloqueantes: nenhum

O que foi conferido:

- **Rate limit, fila, IA, prova e concorrência:** nenhum desses caminhos foi tocado. A tarefa só muda o que se lê ao montar o arquivo do titular (`LeituraDoTitular.montar`, de antes desta tarefa, que roda na fila de exportação e não no request) e acrescenta duas consultas novas, só de leitura. Nada é gravado, então não há disputa de escrita a proteger.
- **Escopo das consultas:** as duas leituras por alvo filtram por `t.escola_id` e usam o índice novo. O teste de isolamento planta no banco uma linha da escola B com o mesmo `entidade_id` e prova que ela fica fora.
- **Índice:** `auditoria_por_alvo_idx` começa pela escola, segue pelo alvo e pela data, e só guarda as seis ações da lista. O teste com 30 alunos × 6 ações × 20 linhas, depois de `analyze`, mostra as duas leituras passando pelo índice.
- **Paginação:** não cabe aqui. O resultado é o arquivo de um único titular, numa lista fechada de seis ações.
- **Migration:** a 0046 só acrescenta. O código anterior não conhece o índice e continua funcionando sem ele. Ela usa `CREATE INDEX` sem `concurrently`, que trava a escrita na `auditoria` enquanto o índice é montado. Isso está dentro da exceção declarada na Tech Spec do F3, seção 7c, que vale enquanto não há staging nem piloto. Hoje o banco só tem dado sintético, e a linha do `TODO.md:227-235` já obriga `concurrently` em toda migration nova a partir do staging.
- **Métrica e alerta:** a mudança não está no caminho quente e não cria alerta.
- **Teste:** nenhum teste chama provedor pago.

Recomendações (não bloqueiam):
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/packages/core/drizzle/0046_auditoria_por_alvo.sql:1`: a `auditoria` recebe gravação a cada ato auditado e é das tabelas que mais crescem. Vale citá-la pelo nome na pendência "antes do staging" do `TODO.md`, junto dos índices da 0025 e da 0026. Também vale lembrar ali que o `migrar` usa o `statement_timeout` da consulta: com volume real, montar esse índice sem `concurrently` pode passar do prazo e derrubar o deploy.
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/packages/core/src/db/schema/auditoria-por-alvo.int.test.ts`: o plano é conferido com a tabela vazia e com `enable_seqscan` e `enable_bitmapscan` desligados, então só prova que o índice pode ser usado, não que o planejador o escolheria. A prova de verdade é o caso com volume em `apps/api/test/arquivo-do-titular.int.test.ts:917`. Vale dizer isso no comentário do teste, para ninguém tomar esse caso como prova suficiente.
3. A lista das seis ações está escrita em três lugares: o schema, a migration e o `in (...)` das consultas em `leitura-do-titular.ts`. O teste do índice confere que a migration tem as seis, mas se alguém tirar uma ação da consulta, ele não percebe. Uma constante compartilhada pelo schema e pela leitura evita que as listas se separem na próxima ação que entrar.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-08 19:12:40 · `tasks/prd-acesso-e-convites/11_task.md`

VEREDITO: APROVADO

A tarefa passa sem bloqueante. O arquivo do aluno agora traz as seis ações feitas sobre ele, só com o papel de quem fez, e nunca o id, o nome, o `antes` ou o `depois` do autor.

**Campos pessoais tocados:** nenhum campo novo foi gravado.
- A migration 0046 só cria o índice parcial `auditoria_por_alvo_idx (escola_id, entidade_id, em)` nas seis ações.
- O `papel` existe só na leitura. Nas quatro ações da planilha ele é fixo, na `.gerada` vem do `depois->>'papel'` e na `.usada` é sempre "aluno".
- O valor do `depois->>'papel'` é gravado pelo próprio sistema, a partir do alcance de quem gerou a senha (`apps/api/src/credencial/senha-provisoria.service.ts:101`). Não sai dado de pessoa nenhuma.

**Fora da tabela de dados do docs/lgpd.md:** nada. O parágrafo do arquivo do titular em `docs/lgpd.md` foi atualizado na mesma tarefa: lista as seis ações, diz "só o papel, nunca o nome nem o id, nem o `antes` e o `depois`, sem as leituras" e explica que o ato sobre um nome da lista só chega depois da aprovação.

**Autorização por objeto:** ok. Este diff não abre rota nova; a leitura roda dentro do job do arquivo, que já existia.
- **Escola:** sai do contexto (`requireEscolaId()`), nunca de argumento.
- **Ações da lista de nomes:** a linha só pertence ao aluno com `lista_nome.usuario_id = titular`. Pelo check `lista_nome_aprovado_sem_nome` do schema, isso só acontece com o nome aprovado. O caso de teste de nome livre e reivindicado confirma.
- **Troca de id:** a linha da escola B gravada com o mesmo `entidade_id` do aluno da A fica fora, nos dois sentidos, nas seis ações.
- **Comportamento:** o caminho de "não encontrado" e "sem permissão" não mudou.

**Logs:** limpos. O diff não acrescenta nenhum log.

**Auditoria:** presente. Não há ação nova que a regra exija auditar. A leitura auditada (`titular.previa_lida`) e a `lista.nome_retirado` ficam fora do arquivo, e há teste para as duas. O arquivo da coordenação continua trazendo a leitura que ela mesma fez.

**Envio externo:** nenhum. A tarefa não chama provedor de IA.

**Seed/fixture:** sintético. São `randomUUID`, "Aluno sintético n" e "Nome livre <marca>".

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Id de aluno no arquivo de quem fez o ato.** Na primeira leitura da auditoria (por autor, perto da linha 416 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/packages/core/src/titular/leitura-do-titular.ts`), o arquivo da coordenadora ainda leva `aluno.transferido` e `usuario.nome_corrigido` com `entidade_id` igual ao id do aluno. As duas ações da lista levam o id da linha da lista, que leva ao aluno.
   - A `.gerada` já fica de fora por esse mesmo motivo (critério 2: o id de outra pessoa não entra), então a regra está sendo aplicada pela metade.
   - Isso não veio deste diff, e o que sai é UUID sem nome. Por isso vai como recomendação, para o `TODO.md`: na leitura por autor, tirar o `entidade_id` ou excluir as seis ações quando o titular não é o alvo.
2. **Lista das seis ações escrita em três lugares:** `auditoria.ts`, a 0046 e as duas leituras em `leitura-do-titular.ts`. Os testes conferem que batem, mas uma constante compartilhada evitaria que divergissem com o tempo. A migration continua precisando do texto literal.
3. **Teste fraco para "nenhuma leitura no arquivo".** O caso de unidade "as leituras por alvo não têm ação de leitura" só procura nomes por regex (`/_lid[oa]s?'|.../`). Quem prova de verdade é o caso de integração "D85: a leitura auditada…". Vale dizer isso no nome do caso de unidade ou removê-lo.
4. **Papel nulo.** A `.gerada` com um `depois->>'papel'` fora de `coordenador` e `professor` sai com `papel` nulo. Hoje isso não acontece, porque `PAPEL_DO_ALCANCE` só tem esses dois valores. Um papel novo no alcance deveria quebrar um teste, em vez de chegar ao aluno como `null`.

**Pergunta de fechamento:** o código responde. O arquivo do aluno agora traz o que ele fez e o que a escola fez sobre ele, sem dizer quem fez (D85), e o bloco `compartilhamento` diz para onde o dado foi.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-08 19:12:46 · `tasks/prd-acesso-e-convites/11_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido

**Bloqueantes:** nenhum.

A tarefa fez as três subtarefas e nada além delas:
- **Índice:** a migration `0046` cria o índice parcial `(escola_id, entidade_id, em)` nas seis ações.
- **Leitura:** são duas leituras novas, uma pelo `entidade_id` do aluno e outra pela linha da lista ligada a ele (`lista_nome.usuario_id`). As duas filtram pela escola por fora, e a da lista filtra de novo dentro da subconsulta.
- **Papel de quem fez:** é fixo, "coordenação", nas quatro ações da F2. Na `.gerada` vem do `depois`, e o valor bate com o que o serviço grava (`PAPEL_DO_ALCANCE`: `coordenador`/`professor`). Na `.usada` é "aluno".
- **Saída:** não sai o autor, nem o `antes`, nem o `depois`, nem as leituras.
- **`.usada`:** sai uma vez só. As duas leituras a trazem, e a junção por `id` em `LeituraDoTitular.montar` (`leitura-do-titular.ts:503-507`) guarda a última, que é a leitura por alvo, a que tem o papel.

A única divergência é o papel "aluno" na `.usada`. A D85 só dá exemplos de papel ("coordenação, professor, rotina") e não fecha a lista. Essa divergência está escrita na `techspec.md` §5, no `cenarios.md` e na `docs/lgpd.md`, e não só no `11_task.md`.

Os arquivos de teste novos e alterados não têm `.skip`, `.only`, `any` nem `TODO`.

**Recomendações (nenhuma bloqueia):**
1. **A lista das seis ações está escrita em cinco lugares** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/packages/core/src/db/schema/auditoria.ts:60`, a migration `0046`, as duas leituras em `leitura-do-titular.ts:427` e `:433`, e o `AS_SEIS` de cada um dos três testes).
   - O comentário em `auditoria.ts:54-56` diz que o `arquivo-do-titular.int.test.ts` "confere as duas". Na prática, cada teste compara contra a própria cópia de `AS_SEIS`, e nenhum compara o `where` do índice com a leitura.
   - Sugestão: exportar uma constante única das seis ações e usá-la no schema, nas leituras e nos testes, ou corrigir o comentário.
2. **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/packages/core/src/titular/leitura-do-titular.ts:423`:** se o `depois.papel` da `.gerada` vier com outro valor, o `case` interno devolve `null` sem aviso. Hoje o schema estrito de `acoes.ts` impede isso. Ainda assim, um `else` explícito, ou um teste que amarre o `case` aos valores possíveis do papel que gera a senha, evita que um papel novo vire `papel: null` no arquivo sem ninguém notar.
3. **A forma das linhas não é a mesma:** as linhas da tabela `auditoria` no arquivo têm `papel` só quando vêm da leitura por alvo, e as dos atos do próprio titular saem sem a chave. Isso é aceitável, mas vale uma linha na descrição do resumo, ou um `papel` também nos atos do próprio titular, para o JSON ficar uniforme para quem o lê.
4. **Linha do `## Mutações` no `11_task.md`:** o texto "--faltando: 1 linhas (19 blocos, 2 motivos)" está confuso: não fica claro se falta alguma linha ou se é só a contagem. Vale reescrever para quem lê na validação.

## test-engineer · 1ª rodada · APROVADO · 2026-11-08 19:13:40 · `tasks/prd-acesso-e-convites/11_task.md`

VEREDITO: APROVADO

Cenários exigidos:
- **Caminho feliz:** cada uma das seis ações aparece no arquivo do alvo, com o papel de quem fez e sem o autor, o `antes` nem o `depois`. As seis saem juntas, e nenhuma outra ação sobre o aluno entra.
- **Bordas reais:**
  - aluno transferido (`aluno.transferido` e `lista.transferida`);
  - nome da lista ainda livre ou reivindicado, que não chega a arquivo nenhum e chega ao do aluno depois de aprovado;
  - autor eliminado (a professora que saiu da escola);
  - `.usada`, que o aluno assina e de que é o alvo, sai uma vez só;
  - `.gerada` por professor e pela coordenação.
- **Permissão:** o ato sobre outro aluno não entra; a leitura auditada da coordenação não entra no arquivo do aluno; a `.gerada` não entra no arquivo de quem a gerou.
- **Isolamento:** uma linha da escola B com o `entidade_id` do aluno da A e com o id da linha da lista dele fica fora do arquivo da A, e o inverso também.
- **Carga (regra 80, item 8):** as duas leituras por alvo usam o índice parcial `auditoria_por_alvo_idx`.
- **Concorrência:** não se aplica. A tarefa só lê, e a escrita das seis ações é das tarefas anteriores.

Cobertos: todas as 9 linhas da tabela "Testes que provam a regra" têm teste citado pelo nome, e todos passam:
- `apps/api/test/arquivo-do-titular.int.test.ts -t "D85"`: 14 casos;
- `packages/core/src/db/schema/auditoria-por-alvo.int.test.ts`: 2 casos;
- `packages/core/src/titular/leitura-do-titular.test.ts`: 4 casos novos, 22 no total com o anterior.

Nenhum item ficou sem teste. Conferi também:
- **Mutações contra o diff:** os 19 blocos alcançam as cláusulas novas de `leitura-do-titular.ts` e da `0046`. Para cada um, o teste citado falha pela asserção certa: o ato do outro aluno ou o da escola B entra, o papel vira `null` ou fica errado, a leitura auditada entra, ou o índice muda de definição e de plano.
- **As duas linhas declaradas sem bloco têm motivo válido.** No `l.escola_id` da subconsulta, a FK composta `lista_nome_usuario_da_escola_fk` junto com o id em UUID impede que haja linha de outra escola com o `usuario_id` do titular. O `.where` do schema só serve ao drizzle-kit.
- **A forma dos dados plantados bate com quem os grava de verdade:**
  - a `entidade`, o `entidade_id` e o `depois.papel` (`coordenador` e `professor`) batem com `packages/core/src/importacao/tipos/alunos.ts:387-427`, `apps/api/src/credencial/senha-provisoria.service.ts:30,101` e `apps/api/src/sessao/login/troca-da-provisoria.service.ts:74`;
  - o papel fixo `coordenação` nas quatro ações da planilha está certo, porque `importacao_planilha` só é permitida à coordenação (`packages/shared/src/permissao/matriz.ts:293`);
  - o check `lista_nome_aprovado_sem_nome` garante que nome não aprovado não tem `usuario_id`.
- **Sem `.skip`, sem provedor de IA, e nenhum mock esconde a regra:** as leituras rodam no Postgres real, e um dos casos passa pelo fluxo inteiro, do pedido ao JSON gravado.

Bloqueantes: nenhum.

Recomendações:
1. `packages/core/src/titular/leitura-do-titular.ts:443`: na `.gerada`, um `depois.papel` fora de `coordenador` ou `professor` sai como papel `null`, sem aviso nenhum. Vale ligar o `case` ao tipo `PapelQueGeraASenhaProvisoria` e ao `PAPEL_DO_ALCANCE`, ou ter um caso que grave a `.gerada` pelo `SenhaProvisoriaService` de verdade. Assim, mudar o valor gravado quebra o arquivo do titular num teste.
2. `apps/api/test/arquivo-do-titular.int.test.ts:53`: o helper `ato()` nunca grava `antes`. A ausência dele só se prova pelas chaves do `toEqual`. Plantar um `antes` com um valor marcado e conferir que ele não aparece no texto do objeto deixaria a prova igual à do `depois`.
3. `apps/api/test/arquivo-do-titular.int.test.ts:113`: o texto proibido inclui o nome da professora, mas não o da coordenação.
4. **Virada de ano letivo:** falta um caso com o aluno aprovado na lista de dois anos letivos, para mostrar que os atos da lista do ano anterior continuam no arquivo. A leitura não filtra por ano e acerta, mas nenhum teste trava isso.
5. `packages/core/src/titular/leitura-do-titular.test.ts:412-414`: o regex de "ação de leitura" é quase decoração. Quem prova de verdade é o caso de integração "D85: a leitura auditada…". Pode sair, ou virar uma comparação com uma lista fechada.
6. `tasks/prd-acesso-e-convites/11_task.md:75`: diz "--faltando: 1 linhas", mas a seção lista dois motivos. Vale acertar o texto.
7. `packages/core/drizzle/0046_auditoria_por_alvo.sql`: é um `CREATE INDEX` sem `CONCURRENTLY` sobre a `auditoria`, que cresce com tudo o que a escola faz. Isso é para o `infra-guardian` (regra 80, item 9), não para os testes.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/test/arquivo-do-titular.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/packages/core/src/db/schema/auditoria-por-alvo.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/packages/core/src/titular/leitura-do-titular.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/packages/core/src/titular/leitura-do-titular.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/packages/core/drizzle/0046_auditoria_por_alvo.sql
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/tasks/prd-acesso-e-convites/11_task.md

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-08 20:06:28 · `tasks/prd-acesso-e-convites/11_task.md`

VEREDITO: APROVADO

Tabelas verificadas: `auditoria`. Nesta rodada só o índice parcial `auditoria_por_alvo_idx` mudou (migration 0046, journal e snapshot). A tabela continua com `escola_id`, não varia por período e não ganhou coluna. `lista_nome` (só na subconsulta) não mudou.

Queries verificadas: as duas leituras por alvo de `LEITURAS_DO_ARQUIVO.auditoria`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/packages/core/src/titular/leitura-do-titular.ts`.
- **Leitura por usuário (linhas 438-439):** o escopo continua o mesmo, `t.escola_id = ${escolaId} and t.entidade_id = ${titularId}`. A escola sai do contexto do pedido, pelo `requireEscolaId`, e não de parâmetro do cliente.
- **Leitura da lista (linhas 445-446):** o escopo também não mudou. Continua o `t.escola_id` de fora mais a subconsulta `l.escola_id = ${escolaId} and l.usuario_id = ${titularId}`.
- **Literais no SQL:** só a lista de ações (`AS_DO_USUARIO`, `AS_DA_LISTA`) e o `case` do papel (`PAPEL_DA_GERACAO`) passaram a ir ao SQL como literal, por `sql.raw`. Todos vêm de constantes de código, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/packages/core/src/auditoria/acoes-por-alvo.ts`, nunca de entrada de fora. O caso de unidade novo confere o formato `^[a-z_]+\.[a-z_]+$`.
- **Correção nº 3 da ordem:** o comentário sobre a FK composta `lista_nome_usuario_da_escola_fk` está no código (linhas 441-443).
- **Endpoints:** nenhum endpoint novo, e nenhum `escolaId` vindo do corpo ou da query string.
- **`@Unscoped()`:** não apareceu nenhum.

Teste de isolamento: presente e efetivo. O caso "D85: isolamento" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/test/arquivo-do-titular.int.test.ts` (linha 914) não mudou. Os dois blocos de mutação que tiram o `t.escola_id`, um em cada leitura, continuam na seção "Mutações" e foram atualizados para o texto novo (`${AS_DA_LISTA}`). Tirada a cláusula, a linha da escola B com o mesmo `entidade_id` entra no arquivo da A e o caso quebra. A lista de referência `AS_SEIS` continua escrita à mão em `leitura-do-titular.test.ts:115`, independente da constante nova. Com isso, a lista da leitura e a do índice ficam presas a uma referência que o código de produção não altera.

Bloqueantes: nenhum.

Recomendações: nenhuma nova. As pendências da 1ª rodada estão no `TODO.md`, entre elas a do `else 'coordenação'`.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-08 20:06:36 · `tasks/prd-acesso-e-convites/11_task.md`

VEREDITO: APROVADO

Esta é a 2ª rodada. Auditei só o diff desde a 1ª (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/.processo/ordens/diff-r1-r2.patch`) e o que ele afeta. A 1ª rodada não deixou correção exigida. As recomendações 1 a 6 da ordem foram aplicadas, e as que ficaram sem aplicar estão no `TODO.md` e no `11_task.md`, como a ordem pedia.

Campos pessoais tocados: nenhum novo. A tarefa continua só lendo a `auditoria` no arquivo do titular.

Fora da tabela de dados do docs/lgpd.md: nada. Não há coluna nova e a 0046 não muda nenhuma coluna.

Autorização por objeto: ok, nada mudou.
- O escopo segue em `t.escola_id = ${escolaId}` nas duas leituras por alvo (`packages/core/src/titular/leitura-do-titular.ts`).
- O `l.escola_id` da subconsulta não ganhou teste de mutação, mas agora tem comentário que aponta para a chave estrangeira composta `lista_nome_usuario_da_escola_fk`. É o que o `tenancy-guardian` pediu.

A saída da leitura não mudou:
- As colunas selecionadas são as mesmas: `id`, `acao`, `entidade`, `entidade_id`, `finalidade`, `em` e `papel`.
- O `case` do papel é montado a partir de `PAPEL_NO_ARQUIVO_DA_GERACAO` e dá o mesmo texto de antes (`when 'coordenador' then 'coordenação' when 'professor' then 'professor'`).
- O filtro de ações das duas leituras traz as mesmas quatro e as mesmas duas ações de antes.
- `sql.raw` só recebe constantes do código. Há um teste que restringe cada ação ao formato `/^[a-z_]+\.[a-z_]+$/`, então não entra texto de fora.

O papel da `.gerada` agora está amarrado ao que a gravação aceita:
- `PAPEL_NO_ARQUIVO_DA_GERACAO` é um `Record<PapelQueGeraASenhaProvisoria, string>`, o mesmo tipo de `PAPEL_DO_ALCANCE` (`apps/api/src/credencial/senha-provisoria.service.ts:30`).
- O `depois.papel` já é validado por `z.enum(PAPEIS_QUE_GERAM_A_SENHA_PROVISORIA)` (`packages/core/src/auditoria/acoes.ts:196`).
- Um papel novo quebra a checagem de tipo e o teste `it.each` novo em `apps/api/test/arquivo-do-titular.int.test.ts`. Não chega mais ao aluno como `null`.

O teste do D85 ficou mais forte:
- Um `antes` marcado (`ANTES_PLANTADO`) é gravado de propósito, e o teste confere que ele não aparece no texto do arquivo.
- O nome da coordenação entrou na lista do que o arquivo não pode levar, ao lado do id dela e do id e do nome da professora.

Migration 0046: continua só aditiva. É um único `CREATE INDEX` parcial, e o diff só reordenou as seis ações no filtro. Não apaga nem altera dado ou coluna.

Logs: limpos. Nenhum log novo.

Auditoria: presente. O teste "D85: a leitura auditada…" continua com bloco de mutação, agora contra `${AS_DO_USUARIO}`. O arquivo do titular não leva ação de leitura.

Envio externo: nenhum.

Seed/fixture: sintético. Os nomes nos testes são gerados com `MARCA` e um UUID (`Coordenadora-${MARCA}-…`), e as linhas novas do `TODO.md` não têm dado de pessoa.

Pergunta de fechamento: a resposta não mudou desde a 1ª rodada. O arquivo do titular traz os atos sobre o aluno e o papel de quem os fez, sem o autor (D85). Os envios externos já vinham da `ExecucaoAgente`, e nada disso foi tocado.

Bloqueantes: nenhum.

Recomendações:
- Fora da minha área, para o `infra-guardian`: o `when` da 0046 mudou no `_journal.json` (de `1794174155616` para `1794176214523`). Um banco local que já aplicou a 0046 antiga pode tentar aplicá-la de novo e falhar com "already exists". O lugar de conferir é o `packages/core/src/db/migrate.ts`. Não afeta dado pessoal.
- A pendência "Id de aluno no arquivo de quem fez o ato" já está no `TODO.md`, com o Arquiteto como dono. Ela continua sendo a de maior peso de LGPD em aberto nesta área e precisa ser decidida antes do piloto.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-08 20:06:46 · `tasks/prd-acesso-e-convites/11_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta rodada. O diff não toca `Nota`, correção, job, seed, importação nem webhook. Todos com autor humano? Não se aplica (nenhum caminho novo).
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhum fluxo de saída de IA mudou. O diff mexe só na leitura da auditoria que monta o arquivo do titular (D85).
Supervisão do tutor: ok. O tutor não foi tocado.
Autonomia declarada e visível: sim. Nada mudou na governança.

O que conferi no diff (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/.processo/ordens/diff-r1-r2.patch`):

- **A saída do arquivo do titular continua a mesma.** As três consultas em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/packages/core/src/titular/leitura-do-titular.ts:426-446` ainda devolvem só `id, acao, entidade, entidade_id, finalidade, em`, e a leitura por alvo devolve também `papel`. Continuam fora o autor (`autor_usuario_id`, `autor_operador`), o `antes` e o `depois`.
- **O papel de quem fez também continua o mesmo.** O `PAPEL_DA_GERACAO` (`leitura-do-titular.ts:85-89`) é montado a partir de `PAPEL_NO_ARQUIVO_DA_GERACAO` = `{ coordenador: 'coordenação', professor: 'professor' }` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/packages/core/src/auditoria/acoes-por-alvo.ts:143`). Ele gera o mesmo texto do `case` literal anterior, na mesma ordem. `.usada` continua `'aluno'`, e o `else` continua `'coordenação'`.
- **Um papel novo não chega mais ao aluno como `null` sem aviso.** O `Record<PapelQueGeraASenhaProvisoria, string>` dá erro de tipo se faltar um papel. O caso de unidade compara as chaves com `PAPEIS_QUE_GERAM_A_SENHA_PROVISORIA` (`packages/shared/src/sessao/senha-provisoria.ts:29`), que é o mesmo tipo do `PAPEL_DO_ALCANCE` em `apps/api/src/credencial/senha-provisoria.service.ts:30`. O `it.each` de integração faz a mesma prova no banco.
- **O `sql.raw` não abre injeção.** `literaisDeSql` recebe só constantes do código, e um teste exige que cada ação siga `^[a-z_]+\.[a-z_]+$`.
- **A prova de que o autor não sai ficou mais forte.** O nome da coordenação e um `antes` marcado no banco agora estão na lista do que o arquivo não pode conter. Antes, o `antes` só era coberto pelas chaves do `toEqual`.
- **Na minha área, a 1ª rodada não teve correção exigida.** A minha recomendação (o `null` no papel da `.gerada`) foi aplicada pelo item 1 da ordem, e está certa.

Bloqueantes: nenhum

Recomendações: nenhuma nova.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-08 20:06:46 · `tasks/prd-acesso-e-convites/11_task.md`

VEREDITO: APROVADO
Caminho quente tocado: migration
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok
Bloqueantes: nenhum

Conferi o diff da 2ª rodada (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/.processo/ordens/diff-r1-r2.patch`) contra a ordem `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/.processo/ordens/11_task-r1.md`. A 1ª rodada não exigiu correção.

- **Migration 0046** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/packages/core/drizzle/0046_auditoria_por_alvo.sql`): continua só aditiva, com um único `CREATE INDEX` parcial nas mesmas seis ações. Só mudou a ordem da lista. Não há `ALTER`, `NOT NULL`, rename nem regravação de tabela. A falta de `concurrently` na `auditoria` está registrada no `TODO.md` como pendência "antes do staging", e cabe na exceção da Tech Spec do F3, seção 7c.
- **Índice e leitura com a mesma lista**: o schema (`packages/core/src/db/schema/auditoria.ts`) e as duas consultas (`packages/core/src/titular/leitura-do-titular.ts`) leem agora a mesma constante (`packages/core/src/auditoria/acoes-por-alvo.ts`). As duas listas da leitura juntas dão as seis do índice, então o índice continua servindo às duas consultas. O `sql.raw` só recebe constantes do código, e há teste que confere o formato de cada ação (`/^[a-z_]+\.[a-z_]+$/`).
- **Teste de plano do índice** (`packages/core/src/db/schema/auditoria-por-alvo.int.test.ts`): passou a usar as mesmas constantes da leitura, então tirar uma ação da consulta ou do índice agora quebra um teste. O comentário diz que o teste só prova que o índice pode ser usado, e aponta o caso com volume de `apps/api/test/arquivo-do-titular.int.test.ts`, com 31 alunos e 3.720 linhas de auditoria, como a prova de que o banco o escolhe.
- **Testes novos**: não chamam provedor pago nem tocam fila, rate limit ou caminho em tempo real.

Recomendações:
- O `when` do `_journal.json` mudou de `1794174155616` para `1794176214523` sem a migration ter entrado na `develop`. Um banco local que aplicou a 0046 antiga vai tentar rodá-la de novo e falhar com "already exists". O portão não sofre com isso, porque com `EDUCA_BANCO_NOVO=1` recria o banco. Vale avisar quem tiver ambiente local com a versão antiga, ou recriar o banco.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-08 20:06:58 · `tasks/prd-acesso-e-convites/11_task.md`

VEREDITO: APROVADO

Escopo: respeitado. O diff só aplica as recomendações da ordem `.processo/ordens/11_task-r1.md`: a constante única, os comentários, os testes e a linha de Mutações. As quatro pendências foram levadas ao `TODO.md` como a ordem mandou. Não há código de tarefa futura.

Aderência à Tech Spec: ok. A lista fechada das seis ações (techspec §122) continua a mesma e o índice parcial também. A constante nova só junta num lugar o texto que estava repetido.
- Ela fica em `packages/core/src/auditoria/acoes-por-alvo.ts`. Do `@educa/shared` importa só o tipo `PapelQueGeraASenhaProvisoria`, que já era exportado. Não cria ciclo nem dependência nova entre pacotes.
- Quem a usa: o schema (`db/schema/auditoria.ts`), a leitura (`titular/leitura-do-titular.ts`) e os testes.
- O comportamento não muda. Os `in (...)` saem com as mesmas ações e o `case` do papel da `.gerada` sai com os mesmos dois ramos. Na migration 0046, só a ordem das seis ações dentro do `in` mudou. O teste de unidade prende a lista às seis e o formato `^[a-z_]+\.[a-z_]+$` antes de ela entrar no `sql.raw`.

Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)").

As seis correções da ordem foram feitas:
1. O papel da `.gerada` agora usa um `Record` tipado por `PapelQueGeraASenhaProvisoria`. Um caso de unidade amarra as chaves desse `Record` a `PAPEIS_QUE_GERAM_A_SENHA_PROVISORIA` e ao texto do `case`, e um `it.each` de integração confere cada papel.
2. A lista das seis ações agora está escrita uma vez só, e o teste do índice usa a mesma constante.
3. Os comentários da FK composta e do alcance do teste do plano foram escritos onde se lê.
4. O `antes` agora é plantado com uma marca, e o nome da coordenação entrou entre os textos proibidos.
5. O caso do regex foi tirado.
6. A linha de abertura de "Mutações" foi reescrita, e os blocos mudaram para a constante: são 20 agora, com o novo bloco do papel `professor` faltando.

Bloqueantes: nenhum.

Recomendações:
- `packages/core/src/db/schema/auditoria.ts:4`: é o primeiro arquivo de `db/schema/*.ts` que importa um módulo de fora do schema, e o `drizzle-kit` carrega esses arquivos (`drizzle.config.ts:8`). Hoje funciona, porque o generate respondeu "No schema changes". Vale uma linha no topo de `acoes-por-alvo.ts` avisando que esse arquivo só pode importar tipo, para não puxar dependência de runtime para o `drizzle-kit`.
- `packages/core/drizzle/meta/_journal.json:330`: o `when` da 0046 mudou depois que ela foi aplicada no banco de desenvolvimento deste andar. O migrador do drizzle aplica de novo toda migration com `when` maior que o último aplicado, e o `CREATE INDEX` sem `IF NOT EXISTS` falha nesse banco. Como a migration ainda não foi commitada, basta recriar o banco local do andar antes do próximo `migrar`. Não afeta a develop.

## test-engineer · 2ª rodada · APROVADO · 2026-11-08 20:07:50 · `tasks/prd-acesso-e-convites/11_task.md`

VEREDITO: APROVADO

Cenários exigidos (rodada 2: o diff desde a 1ª rodada e as seis ordens de `.processo/ordens/11_task-r1.md`):
- **Ordem 1, a `.gerada` com papel desconhecido sai `null`.** É preciso um teste que ligue a lista de papéis que geram a senha provisória ao `case` do SQL.
- **Ordem 2, uma lista única das seis ações.** O schema, a leitura e os testes precisam usar a mesma lista, e mexer nela tem de deixar algum teste vermelho.
- **Ordem 3, comentários.** Um para a dependência da FK composta e outro para o que o teste do plano prova e o que não prova.
- **Ordem 4, `antes` plantado e nome da coordenação.** O `antes` tem de ser gravado com uma marca, e o nome da coordenação tem de entrar nos textos proibidos.
- **Ordem 5, o caso de unidade que era só um regex.** Pode sair, porque o caso de integração "D85: a leitura auditada" prova a regra.
- **Ordem 6, o texto da linha de abertura de "Mutações".**
- **Os blocos de mutação conferidos contra o diff novo.**

Cobertos:
- **Ordem 1.** O caso `it.each(PAPEIS_QUE_GERAM_A_SENHA_PROVISORIA)` "D85: a senha_provisoria.gerada com o papel %s…" está em `apps/api/test/arquivo-do-titular.int.test.ts:893`. Tem um bloco que tira `professor` de `PAPEL_NO_ARQUIVO_DA_GERACAO`. Na execução, os tipos somem e a linha sai com `papel: null`, então o caso fica vermelho.
  - O caso de unidade "o papel de quem gerou a provisória tem uma entrada por papel que gera…" (`packages/core/src/titular/leitura-do-titular.test.ts:157`) liga as chaves da constante à lista compartilhada e ao texto do `case`.
  - O vínculo com `PAPEL_DO_ALCANCE` vem do tipo `Record<AlcanceDaProvisoria, PapelQueGeraASenhaProvisoria>` (`apps/api/src/credencial/senha-provisoria.service.ts:30`) e do `z.enum` da porta única (`packages/core/src/auditoria/acoes.ts:196`). Esse vínculo basta.
- **Ordem 2.** A lista agora fica só em `packages/core/src/auditoria/acoes-por-alvo.ts` e é usada no schema, na leitura e nos dois testes.
  - Os blocos que antes alteravam o `in (...)` de `leitura-do-titular.ts` passaram a alterar a constante, e cada um continua apontando para o caso "D85: <ação> aparece".
  - `auditoria-por-alvo.int.test.ts` confere o `where` da migration 0046 contra a constante.
  - O caso de unidade novo prende a constante às seis ações e ao formato `^[a-z_]+\.[a-z_]+$`. Isso protege o `literaisDeSql`, que monta o texto do SQL com esses valores.
- **Ordem 3.** O comentário da FK está em `leitura-do-titular.ts:309-310` e o do alcance do plano em `auditoria-por-alvo.int.test.ts:34-38`.
- **Ordem 4.** `ANTES_PLANTADO` passa pelo `jsonb_build_object` em todas as chamadas de `ato()`, e `nomeDaCoordenacao` é gravado no usuário. Os dois estão na lista de textos proibidos do objeto. O teste ficou mais forte: se o `select` passasse a levar o `antes`, o texto do arquivo conteria a marca.
- **Ordem 5.** O caso que era só regex saiu. A regra continua provada pelo caso "D85: a leitura auditada…", com o bloco `falha: not.toContain(lida)` reescrito sobre a linha `and t.acao in (${AS_DO_USUARIO})`.
- **Ordem 6.** A linha de abertura de "Mutações" foi reescrita: diz a única linha que a ferramenta lista sem bloco e explica o segundo motivo.
- **Mutações.** Há 20 blocos no documento, o mesmo número que o portão informa.
  - Linhas novas de produção com condição: as constantes estão cobertas por blocos. `literaisDeSql` e o `PAPEL_DA_GERACAO` montado com `Object.entries` não têm condição, e qualquer mudança neles quebra o SQL inteiro.
  - O `.where(` do schema segue sem bloco, com o motivo atualizado: ele usa a mesma constante, e a migration é conferida contra ela.
- **Execução.** Rodei os três arquivos:
  - `npx vitest run packages/core/src/titular/leitura-do-titular.test.ts packages/core/src/db/schema/auditoria-por-alvo.int.test.ts`: 23 passaram.
  - `npx vitest run apps/api/test/arquivo-do-titular.int.test.ts -t "D85"`: 16 passaram.
- **Restrições.** Não há `.skip`, nem mock de código da casa, nem IA envolvida. O diff não traz nenhuma operação nova que possa acontecer duas vezes ao mesmo tempo.

Bloqueantes: nenhum.

Recomendações:
- **Contagem errada na tabela.** `tasks/prd-acesso-e-convites/11_task.md:53` cita "a leitura por alvo da auditoria (D85…)" com "(quatro casos)", mas o describe agora tem cinco: as seis ações nas leituras, a constante, as colunas, o papel fixo e o papel por quem gera. O texto deve dizer "cinco casos".
- **Caso novo fora da tabela.** A linha "`.gerada` por professor e pela coordenação" (`11_task.md:49`) não cita o caso novo "D85: a senha_provisoria.gerada com o papel %s…" nem o caso de unidade "o papel de quem gerou a provisória tem uma entrada por papel que gera…". Ambos provam que nenhuma linha sai sem papel e merecem ser citados ali.
- **Resumo que não bate com o diff.** O resumo da rodada diz "caso de regex de leitura ajustado", mas o caso foi removido, o que a ordem 5 permitia. Isso só pesa para quem valida lendo o resumo.
