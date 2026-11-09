# Achados das revisões — `tasks/prd-acesso-e-convites/14_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-08 22:55:43 · `tasks/prd-acesso-e-convites/14_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa 14.0 não grava em `Nota`, não cria caminho novo até ela, não tem job, seed nem importação que chegue a nota, e não chama provedor de IA. Todos com autor humano? Não se aplica, porque não há escrita.

Decisão autônoma sobre aluno: ausente.
- O aluno com a conta da escola só nasce quando uma pessoa aprova o pedido (D4). A ligação da conta (`#ligarConta`) roda dentro da mesma transação da aprovação, com quem decide em `decididaPor` e a auditoria `conta_externa.ligada` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sala/decisao/decisao.service.ts:56-60` e `:151`).
- O encerramento na transferência e na virada do ano (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/estrutura/decisao.repository.ts:179-186`) só fecha o pedido e apaga a conta. Não grava decisão nem cria aluno.
- O procedimento novo do runbook (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/runbook.md`, seção "Voltar o código com pedidos de conta da escola pendentes") também só encerra, sem decisão, e proíbe aprovar o pedido à mão.

Aprovação registrada: ok. Não há saída de IA nesta tarefa. A aprovação de identidade que já existia continua com autor, data e possibilidade de recusar, e recusar também apaga a conta guardada.

Supervisão do tutor: ok. A tarefa não toca no tutor.

Autonomia declarada e visível: sim. A tarefa não cria nem muda agente, e a declaração de autonomia já existente segue como estava.

Os outros pontos da lista:
- **Auditoria:** a tarefa não tem item de IA para a auditoria responder.
- **Vigilância:** não há nenhuma. O cookie e a coluna guardam só provedor, tenant e o identificador opaco da conta, sem e-mail, nome ou foto, e não há métrica sobre pessoa.
- **Discursiva e redação (D46, D55):** nada na tarefa sugere nota.
- **Medição do professor (D45):** nada na tarefa mede o professor.

Bloqueantes: nenhum.

Recomendações:
- O SQL de volta de versão no `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/runbook.md` encerra os pedidos e devolve o nome à lista sem deixar registro consultável de quem fez isso, só a contagem anotada no `TODO.md`. Não é falha da regra 70, porque encerrar não é decidir sobre o aluno. Vale o `privacy-guardian` avaliar se o procedimento deveria gravar um registro de auditoria por pedido encerrado, como faz o `lista.transferida`.
- O comentário da migration `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/drizzle/0047_reivindicacao_conta.sql:9-10` ainda diz que o runbook "manda recusar" os pedidos de conta. O runbook e a divergência registrada na tarefa dizem "encerrar, sem decisão". A autoconferência da tarefa (item 7) diz que esse texto foi corrigido, mas no arquivo ele continua como estava. Vale alinhar o texto para ninguém, numa volta de versão, gravar uma recusa sem decisão de pessoa.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-08 22:55:52 · `tasks/prd-acesso-e-convites/14_task.md`

VEREDITO: APROVADO

**Tabelas verificadas:**
- Nenhuma tabela nova.
- `reivindicacao` ganha a coluna `conta_externa` (jsonb). A tabela já tem `escola_id`, e o recorte por período continua vindo pela turma, como antes.
- O índice único parcial novo `reivindicacao_conta_pendente_unica` começa por `escola_id` (`packages/core/drizzle/0047_reivindicacao_conta.sql`, `packages/core/src/db/schema/reivindicacao.ts:90-92`).
- `conta_externa` não mudou. O `conta_externa_identificador_unico` já é por escola, então a mesma conta ligada na B não bloqueia nem aparece na A.
- Nenhum id novo: os que existem continuam UUID.

**Queries verificadas:**
- `ReivindicacaoRepository.inserirPendente`: escola e ano do contexto. A coluna nova não muda o escopo.
- `DecisaoRepository.travarPendente`: o mesmo `#noAlcance` e o `for update` de antes, agora lendo também `contaExterna`.
- `DecisaoRepository.fechar`: no `encerrada` e no decidido, filtra por `requireEscolaId()` e anula `contaExterna`.
- `ContaExternalRepository.ligar`, `ligacao`, `dominioLiberado` e `provedorLiberado`: todos com `requireEscolaId()`.
- `CredencialMatriculaRepository.criar`: escola do contexto.
- `SalaDoLoginPelaSala.achar`: usa o `AcessoDaSala.naSala`, que resolve link ou código dentro da escola do slug e do ano em curso, com o limite de código errado que já existia.
- `ExternalLoginService.iniciar`: confere `sala.escolaId !== escolaId` e responde NAO_ENCONTRADO.
- `ExternalLoginService.#decidir`: roda dentro do `naEscolaSemUsuario` com a escola do cookie `educa_oidc`, que o servidor cifrou.
- `contaDoPedido` (`apps/api/src/sala/reivindicacao/reivindicacao.service.ts:151-153`): a escola e o acesso do cookie são comparados com os do acesso vigente que o servidor achou. A escola do pedido sai do acesso, nunca do cookie nem do corpo.
- Nenhum endpoint usa `escolaId` vindo do cliente:
  - o corpo de `salas/reivindicar` continua estrito;
  - na query do `iniciar`, campo a mais é ignorado e não chega a nenhuma decisão;
  - o cookie é AES-256-GCM com dado autenticado próprio, gravado só pelo servidor.
- Nenhum `@Unscoped()` novo.
- Nenhuma consulta da camada rede foi tocada.

**Teste de isolamento:** presente e efetivo. Os casos estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/reivindicacao-com-conta.int.test.ts`, e cada um falharia sem a cláusula que testa:
- **Cookie (linhas 355-393):** os casos "de outra escola, com o acesso da A" e "de outro acesso da mesma escola" mudam um termo só cada um. Sem `provada.escolaId !== escolaId` ou sem `provada.acessoId !== acessoId`, o pedido seria gravado e o caso ficaria vermelho. As mutações #3 a #5 da tarefa cobrem isso.
- **Início (linhas 246-269):** usa o token e o código reais da B sob o slug da A, e confere 404, nenhum cookie e nenhuma ida ao provedor.
- **Serviço (linhas 271-279):** sem `sala.escolaId !== escolaId`, o acesso da B iria ao provedor, e o caso cai (mutação #20).
- **Mensagens de erro:** não revelam existência.
  - O cookie que não vale dá a mesma ENTRADA_INVALIDA para ausente, vencido, adulterado, de outra escola e de outro acesso.
  - O slug, token ou código de outra escola dá o mesmo 404 do inexistente.
  - O CONFLITO da aprovação não traz id nem nome (o caso confere o corpo da resposta, linhas 505-530) e só acontece com ligação da mesma escola, porque o índice é por escola.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `apps/api/src/sessao/external/external-login.controller.ts:383`: o `sala.achar` roda antes de conferir se o provedor está ligado e liberado na escola. Um código errado sob um slug cuja escola não oferece o provedor ainda conta no limite de código errado da escola. Não vaza nada, mas inverter a ordem (provedor primeiro, sala depois) poupa o limite.
2. `apps/api/src/sala/sala.module.ts:247`: o `SalaModule` passou a ser `global: true` só para entregar `SALA_PARA_A_CONTA`. Hoje ele exporta só essa porta. Vale um teste estrutural ou um comentário que impeça exportar repository da sala por esse caminho global no futuro.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-08 22:56:47 · `tasks/prd-acesso-e-convites/14_task.md`

VEREDITO: APROVADO

**Campos pessoais tocados:**
- `reivindicacao.contaExterna` (jsonb). Guarda só `{ provedor, tenant, sujeito }`, montado em `contaDoPedido` (`apps/api/src/sala/reivindicacao/reivindicacao.service.ts:151-154`). O conteúdo nunca vem do corpo da requisição.
- O cookie `educa_conta_provada`. Leva escola, acesso e o identificador opaco da conta, cifrado em AES-GCM com dado autenticado próprio, `HttpOnly`, `SameSite=Lax`, `Path=/v1/salas`, válido por 15 minutos.
- `credencial_matricula.senhaHash`, que agora aceita nulo.
- A ligação em `conta_externa`, criada na aprovação.
- Nenhum campo proibido para aluno entra. O teste "o banco não guarda e-mail, nome nem foto do provedor" confere isso no banco, na auditoria e no log.

**Fora da tabela de dados do docs/lgpd.md:** nenhum. As linhas da conta da escola no pedido e do cookie já existiam. A da Reivindicação passou a citar a conta da escola, com a retenção ("apagada na decisão ou no encerramento").

**Autorização por objeto:** ok.
- **Cookie no pedido:** escola e acesso do cookie são conferidos contra o acesso vigente que o `AcessoDaSala` achou (`reivindicacao.service.ts:152`). Os testes cobrem cookie de outra escola e cookie de outro acesso.
- **`iniciar`:** a escola da sala tem de ser a do slug, e o serviço confere isso de novo (`external-login.service.ts`, no `iniciar`).
- **Aprovação:** passa pelo `travarPendente`, que já prende o pedido ao alcance de quem decide.
- **`ligar`:** usa `requireEscolaId()`.

**Respostas iguais:** todo cookie que não vale dá a mesma `ENTRADA_INVALIDA`: ausente, vencido, adulterado, de outra chave, do `educa_oidc`, de outra escola ou de outro acesso. Slug, token ou código que não valem dão o mesmo `NAO_ENCONTRADO`. A conta já ligada a outro aluno dá `CONFLITO` sem nome nem id.

**Logs:** limpos. O código novo não tem nenhum `logger`. O teste confere que o sujeito e os dados do provedor não aparecem no log. Os rótulos novos de métrica (`conta_provada`, `conta_invalida`) não levam escola nem pessoa.

**Token na URL:** o Caddy exclui o log de acesso, o de erro e o do proxy, e a telemetria só exporta métricas. Por isso o token ou o código na query do `iniciar` não vai para log.

**Auditoria:** presente.
- `conta_externa.ligada` é gravada na aprovação, na mesma transação, com `usuarioId` e `provedor`, sem o sujeito (`apps/api/src/sala/decisao/decisao.service.ts:49`).
- `reivindicacao.decidida` continua como antes.

**Envio externo:** nenhum dado de aluno sai. O `iniciar` faz um 302 ao provedor OIDC da própria escola, sem `Referer`. Não há IA nesta tarefa, então `ExecucaoAgente` não se aplica.

**Seed/fixture:** sintético. Os testes usam `escola-a.educa-sintetica.test` e UUIDs fixos.

**Ciclo de vida:**
- `contaExterna` é anulada na decisão e no `fechar('encerrada')`, ou seja, na transferência, na virada do ano e na retirada da lista.
- O check do banco obriga as quatro colunas nulas fora do pendente e proíbe senha e conta juntas.
- `reivindicacao.conta_externa` está em `COLUNAS_FORA_DO_ARQUIVO` e em `LEITURAS_DO_ARQUIVO`.

**Pergunta de fechamento:** o código responde. Depois da aprovação, a ligação aparece no arquivo do titular como `conta_externa` (id e provedor) e como o ato `conta_externa.ligada`. Antes da aprovação ainda não existe titular-usuário, e a conta some quando o pedido é decidido ou encerrado. Nada vai a terceiro.

Rodei os testes de unidade do cookie e de `packages/shared/src/privacidade`: 41 de 41 verdes. Os testes de integração precisam de banco e não foram rodados nesta auditoria.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/drizzle/0047_reivindicacao_conta.sql:10-11`: o comentário ainda diz "o runbook manda recusar os pedidos de conta pendentes". O runbook e a techspec dizem "encerra, sem decisão". A autoconferência, item 7, afirma que isso foi corrigido, e não foi. Recusar à mão gravaria uma decisão sem autor humano. Trocar para "encerrar, sem decisão".
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/auditoria/acoes.ts:124`: a descrição de `conta_externa.ligada` fala só do professor no primeiro login. Acrescentar a ligação do aluno pela aprovação do pedido, feita por quem aprova.
3. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sala/salas/salas.controller.ts:20` diz que token e código nunca vão na URL. O `iniciar` com `intencao=reivindicar` agora os leva na query de um GET. Isso não aparece em log, porque o Caddy exclui o acesso, mas fica no histórico do navegador do computador da escola. Registrar isso em `docs/lgpd.md`, na linha do acesso da turma, e ajustar o comentário.
4. O professor com domínio liberado e ainda sem ligação, entrando com `intencao=reivindicar`, vira "conta provada" e pode pedir um nome de aluno. A aprovação humana segura isso, mas vale um caso de teste ou uma nota na spec dizendo que esse caminho é aceito.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-08 22:57:01 · `tasks/prd-acesso-e-convites/14_task.md`

VEREDITO: APROVADO
Caminho quente tocado: login | sala | migration
Rate limit: ok
Fila e prioridade: ok (a tarefa não usa fila)
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok
Bloqueantes: nenhum

O que confirmei antes de aprovar:
- **Rate limit:** o `iniciar` com `codigo` passa pelo limite de código errado por escola, o mesmo do `salas/abrir`, via `SalaDoLoginPelaSala`. O pedido sem senha continua passando pelos contadores de nome, turma e escola do `antesDoHash`.
- **Cookie que não vale:** é conferido antes dos contadores e não gasta o limite do nome. Não dá para forjar, porque é AES-GCM com dado autenticado próprio.
- **Duas instâncias:** a chave do `educa_conta_provada` sai de `LOGIN_EXTERNO_CHAVE_COOKIE`, que é obrigatória quando há provedor ligado. Todas as instâncias usam a mesma chave, e nada fica em memória do processo.
- **Mesma conta em dois pedidos:** o índice único parcial começa por `escola_id`. O 23505 cai em `VOLTA_E_RELE` e vira recusa, nunca 5xx. Há teste com `Promise.all`.
- **Clique duplo em aprovar:** é resolvido pelo `travarPendente` com `for update` e pelo `ligar` com `onConflictDoNothing`. O teste paralelo confere pelo efeito: uma `conta_externa`, uma credencial, uma auditoria.
- **Migration:** só expande. `credencial_matricula.senha_hash` já aceitava nulo. O código anterior continua rodando sobre o schema novo. A volta de versão tem procedimento no runbook, que deixa a `lista_nome` dentro dos checks dela.
- **Métricas:** entraram os rótulos `conta_provada` e `conta_invalida` nos contadores que já existiam, com a descrição atualizada em `metrics.ts` e no painel. Não há alerta novo.

Recomendações:
1. **Comentário da migration diz o contrário do runbook.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/drizzle/0047_reivindicacao_conta.sql:10-11` ainda diz "o runbook manda recusar os pedidos de conta pendentes". O runbook e a techspec dizem "encerra, sem decisão". A autoconferência, item 7, afirma que isso foi corrigido, mas não foi. Quem fizer a volta de versão lendo a migration recusaria pedidos, gravando uma decisão que ninguém tomou.
2. **O `not valid` + `validate` não alivia o lock como o comentário promete.** O comentário em `0047_reivindicacao_conta.sql:6-7` diz que o `add` não varre a tabela sob o lock forte. Só que o migrador roda tudo numa transação (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/db/migrate.ts:72`). Então o `VALIDATE` roda com o `ACCESS EXCLUSIVE` que o `ADD` pegou, e o `CREATE UNIQUE INDEX` também trava a tabela. Hoje é inofensivo: a `reivindicacao` tem cerca de uma linha por aluno por ano, o deploy é fora do horário e há `lock_timeout`. Vale corrigir o comentário (o padrão já vem da 0042) e, quando a tabela crescer, separar o `validate` e o índice em passo próprio.
3. **Um conflito trava o resto do lote de aprovação.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sala/decisao/decisao.service.ts:118`, o `CONFLITO` sai do laço de `decidir`. Os ids depois do conflitante não são decididos, e a cada "aprovar todos" o professor esbarra no mesmo pedido até recusá-lo. A spec manda `CONFLITO`, então não reprovo. O cenário é raro: a mesma conta provada em dois navegadores e um nome aprovado dentro dos 15 minutos. Sugestões:
   - devolver um resultado por id (por exemplo `conflito`) em vez de interromper o lote;
   - ou recusar já no pedido a conta que já está ligada.
4. **Carga:** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/k6/reivindicacao-em-sala.js` cobre só o pedido com senha. O caminho da conta é mais leve, porque não calcula argon2, e a techspec não pede um cenário de carga para ele. Ainda assim, vale incluir uma fração de pedidos sem senha com o `oidc-falso`, para medir a ida e volta ao provedor com a turma inteira ao mesmo tempo.
5. **Trabalho antes de saber se o provedor está ligado.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sessao/external/external-login.controller.ts:305` chama `sala.achar` antes de conferir se o provedor está ligado e liberado. Com provedor desligado, a rota anônima ainda faz a busca no banco e gasta tentativa do limite de código. Conferir o provedor antes, ou mover o `achar` para dentro do service, evita isso.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-08 22:57:26 · `tasks/prd-acesso-e-convites/14_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em `packages/core/drizzle/0047_reivindicacao_conta.sql`. O comentário sobre a volta de versão contradiz a `techspec.md` §3 e o runbook. As divergências de código estão registradas na techspec §3 e §5 e no `cenarios.md`: a porta `SALA_PARA_A_CONTA`, o `conta=provada`, a `ENTRADA_INVALIDA` e o runbook que encerra o pedido.
Portão local: carimbo válido

Bloqueantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/drizzle/0047_reivindicacao_conta.sql:10-11`
  - **O que está errado:** o comentário diz "o runbook manda **recusar** os pedidos de conta pendentes antes". A techspec §3 (linha 47) e `docs/runbook.md` dizem outra coisa: os pedidos são **encerrados, sem decisão**, e o nome volta à lista. A própria tarefa justifica a troca: recusar gravaria `decididaPor` e `decididaEm` sem decisão de ninguém.
  - **Por que bloqueia:** a pergunta 7 da autoconferência (`14_task.md:82`) afirma que esse comentário "agora diz 'encerra, sem decisão', como o runbook". Não diz. A migration não se edita depois de pousar, e quem fizer o rollback lendo a migration faria o que a spec recusou.
  - **Correção exigida:** reescrever o trecho como "o runbook encerra, sem decisão, os pedidos de conta pendentes e devolve o nome à lista (`docs/runbook.md`)". Depois, renovar o carimbo do portão.

Recomendações:
- `infra/grafana/paineis/fundacao.json:950`: a descrição do painel de `login_externo_total` ainda lista só `entrou`, `recusado` e `provedor`. Falta o resultado novo `conta_provada`, que o `metrics.ts` já descreve. A pergunta 12 da autoconferência diz que o painel foi atualizado, mas só o de `sala.reivindicacao` foi.
- `apps/api/src/sala/sala.module.ts:52`: o `SalaModule` virou `global: true` só para entregar `SALA_PARA_A_CONTA` ao controller do `sessao`. Funciona, porque só o `app.module.ts` monta os dois. Mesmo assim, um segundo módulo global cria acoplamento implícito. Vale registrar em `docs/arquitetura.md` ou usar `forwardRef` com import explícito.
- `apps/api/src/sessao/index.ts:13`: o barril passou a exportar `ExternalLoginService` só para o `api.app.get(...)` do teste de integração. Dá para buscar pelo token de classe interno sem abrir a API do módulo.
- No `externa/iniciar` com `intencao=reivindicar`, o token do link da sala vai na query de um GET de navegação, quando a página o guarda no fragmento. A borda não grava log de acesso (`infra/Caddyfile:15-18`), mas a URL pode ficar no histórico do navegador, na cadeia do 302. Fica com o `privacy-guardian`, e talvez valha uma linha em `docs/lgpd.md` na linha do "Acesso da turma".

## test-engineer · 1ª rodada · REPROVADO · 2026-11-08 22:59:15 · `tasks/prd-acesso-e-convites/14_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:** caminho feliz pelo link e pelo código · domínio não liberado e conta pessoal · cookie vencido, adulterado, de outra chave, do `educa_oidc`, de outra escola e de outro acesso · cookie apagado ao gravar e no reenvio, e que não serve a um segundo pedido · com senha, o cookie não é lido · pedido de conta sem hash e fora do teto de hashes · pedido pendente não entra pela conta · aprovar liga e recusar descarta · CONFLITO com a conta já ligada a outro aluno · banco sem e-mail, nome nem foto · ano sem curso · transferência e virada do ano · o check no banco e as linhas de antes da migration · aluno desativado · auditoria `conta_externa.ligada` · [P] mesma conta em dois pedidos · [P] clique duplo em aprovar · isolamento do `iniciar` (token e código da B sob o slug da A, e a conferência dentro do serviço) · **limite de código errado no `iniciar` com `intencao=reivindicar`** (o `techspec.md` §5 o escreve: "com o limite de código errado por escola do `salas/abrir`").

**Cobertos:** todos os itens acima, menos o último em negrito. As 15 linhas da tabela de testes têm um caso cada, com o nome que a tabela cita. Os dois [P] rodam de verdade em paralelo, com `Promise.all`, e conferem o efeito no banco: uma `conta_externa`, uma credencial e um registro de auditoria. As asserções olham o banco, os cabeçalhos `Set-Cookie`, as métricas e o `/v1/eu`, e não só o status da resposta. Os 26 blocos de mutação cobrem cada linha com condição do diff; as 6 linhas sem bloco têm motivo aceitável. Não há `.skip`, mock que esconda a regra nem provedor pago: o espião no `PasswordHasher.gerar` só observa, e o login usa o `oidc-falso` do compose.

Rodei os testes, todos verdes:
- `reivindicacao-com-conta.int.test.ts`: 23 de 23.
- `cookie-oidc.test.ts`: 17 de 17.
- Os vizinhos que o portão não roda, porque a tarefa não os alterou, também passaram: `salas-reivindicar`, `decisao` e `external-login` (81 de 81); `salas.test`, `classificacao.test`, `leitura-do-titular.test` e `architecture.test` (94 de 94).

**Bloqueantes:**

1. **O limite de código errado no `iniciar` não tem teste.**
   - **Onde:** `apps/api/src/sala/salas/sala-para-a-conta.ts:18` e `apps/api/src/sala/sala.module.ts:256-261`.
   - **O que está errado:** o `GET /v1/sessao/externa/:provedor/iniciar?intencao=reivindicar&codigo=` é uma porta nova e anônima para resolver código de sala. A única defesa contra adivinhar códigos é o `SalaRateLimits` passado como `guarda` ao `AcessoDaSala.naSala`. Ela está no `techspec.md` §5, no comentário da classe ("o código na URL de um GET anônimo não é um jeito de adivinhar códigos sem a espera que o `salas/abrir` impõe") e na autoconferência, item 8. Mas nenhum caso a prova: `grep` de `intencao` e de `SalaDoLoginPelaSala` nos testes só acha o `reivindicacao-com-conta.int.test.ts`, e nele não há código errado contado. Se o `limites` da fábrica for trocado por uma guarda que não faz nada, os 40 testes ficam verdes.
   - **Correção exigida:**
     - Um caso de integração em que N códigos errados pelo `iniciar` com `intencao=reivindicar` aumentam em N o contador de código errado da escola. A fixture já lê esse contador (`sala.contadores(s, s.turma).escola`).
     - No mesmo caso, o código certo continua indo ao provedor.
     - A linha correspondente na tabela de testes.
     - Um bloco `mutacao` sobre a fiação, por exemplo `new SalaDoLoginPelaSala(acessoDaSala, config.chaveCodigo, { antesDaBusca: async () => {}, codigoErrado: async () => {} })`, que precisa ficar vermelho nesse caso.

**Recomendações:**

- **Comentário da migration contradiz o runbook.** `packages/core/drizzle/0047_reivindicacao_conta.sql:10-11` ainda diz que "o runbook manda **recusar** os pedidos de conta pendentes". O runbook, o techspec §3 e a divergência resolvida dizem **encerrar, sem decisão**. A autoconferência, item 7, afirma que esse comentário já foi corrigido, e não foi.
- **"O cookie não serve a um segundo pedido" só está provado com o primeiro ainda pendente.** O servidor não invalida o cookie, só pede ao navegador que o apague. Depois que o primeiro pedido é aprovado ou recusado, o mesmo valor de cookie, dentro dos 15 minutos, abre outro pedido em outro nome. Se o primeiro foi aprovado, esse segundo pedido prende o nome até dar CONFLITO na aprovação. O `reivindicar` também não confere se a conta já está ligada na escola. Duas saídas:
  - recusar no pedido a conta que já tem `conta_externa` na escola, com um caso "cookie reaproveitado depois da aprovação";
  - ou restringir o texto do `cenarios.md` ao pedido pendente.
- **Lote com um pedido em conflito.** O CONFLITO lançado dentro do `#decidirUm` (`decisao.service.ts:117`) interrompe o laço do `decidir`. Os ids anteriores ficam decididos, os seguintes não são processados, e a resposta é 409 sem dizer quais foram decididos. Falta um caso de lote `[ok, conflito, ok]` que fixe esse comportamento para a tela da 16.0.
- **Reenvio sem cookie, depois que o primeiro envio já apagou o cookie** (clique duplo ou queda de rede). Hoje responde `enviado`, porque o `chaveGravada` vem antes do `contaDoPedido`. Nenhum caso prova isso, e inverter as duas linhas mostraria ao aluno um "prove a conta de novo" sobre um pedido que já foi gravado.
- **Transferência pelo caminho real.** O caso da transferência chama `DecisaoRepository.fechar` direto, não o job da planilha. Ele prova a anulação graças ao check do banco, mas o caminho real seria mais fiel ao cenário.
- **Texto da tarefa que não bate com os testes:**
  - A autoconferência, item 4, diz que o caso de isolamento "confere que o `oidc-falso` não foi chamado". O caso confere 404, sem `Location` e sem cookie, o que basta, mas não faz o que o texto diz.
  - A tabela diz "6 casos" no `cookie-oidc.test.ts`; são 7.

**Arquivos citados:**
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sala/salas/sala-para-a-conta.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sala/sala.module.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sala/decisao/decisao.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/reivindicacao-com-conta.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/drizzle/0047_reivindicacao_conta.sql
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/14_task.md

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-08 23:22:56 · `tasks/prd-acesso-e-convites/14_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nesta rodada. Em `reivindicacao` (migration `0047`) mudou só o comentário. A coluna `conta_externa`, o check e o índice parcial `(escola_id, provedor, tenant, sujeito)` não mudaram desde a 1ª rodada.

Queries verificadas: nenhuma query nem repository mudou. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sala/sala.module.ts` mudou só o comentário. O módulo continua exportando apenas `SALA_PARA_A_CONTA`, e a regra está escrita em `docs/arquitetura.md`. Em `salas.controller.ts`, `acoes.ts`, `fundacao.json` e `docs/lgpd.md` só mudou texto. Nenhum `escolaId` passou a vir do corpo ou da query. Conferi que os arquivos não rastreados (o teste, a `0047` e as duas `sala-para-a-conta.ts`) são iguais aos do `cb06f9bf`.

Teste de isolamento: presente e efetivo. O caso que já existia continua lá: o token da escola B sob o slug da A dá 404, sem `Location` e sem cookie. Os três casos novos em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/reivindicacao-com-conta.int.test.ts` não enfraquecem o isolamento:
- **Código errado pelo `iniciar`:** soma no contador da escola A e deixa o da escola B como estava (`toEqual(antesDeB)`).
- **Lote `[ok, conflito, ok]`:** o 409 não traz nenhum id na resposta.
- **Reenvio sem cookie:** responde `enviado` sem abrir um segundo pedido.

Bloqueantes: nenhum.

Correções exigidas na rodada anterior: nenhuma, então não havia o que conferir.

Recomendações:
- Agora está escrito que o token do link ou o código vai na query do GET `iniciar` e fica no histórico do navegador do computador da escola enquanto o acesso valer, até 30 dias. Não é vazamento entre escolas, mas é a mesma exposição do `wa.me`. Na 15.0, vale avaliar se a tela pode manter o token fora da URL, por exemplo com um POST que redireciona.
- A recomendação da 1ª rodada continua em aberto e já está no `TODO.md`: no `external-login.controller.ts:68`, conferir o provedor antes do `sala.achar`.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-08 23:23:08 · `tasks/prd-acesso-e-convites/14_task.md`

VEREDITO: APROVADO
Caminho quente tocado: login | sala | migration
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/drizzle/0047_reivindicacao_conta.sql:6-10`: o comentário já admite que o `VALIDATE` e o `CREATE UNIQUE INDEX` rodam na mesma transação do `ADD`, com o lock que ele pegou. Hoje a tabela é pequena e há `lock_timeout` (`packages/core/src/db/migrate.ts:54`). Quando a `reivindicacao` crescer, separar os dois em passo próprio, com o índice `CONCURRENTLY`. A observação fica registrada para a retro.
- O teste novo "o lote [ok, conflito, ok]" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/reivindicacao-com-conta.int.test.ts`) prova o comportamento de hoje: o `CONFLITO` deixa o lote decidido pela metade, e o 409 não diz quais ids passaram. Quem decide o contrato por id é a 16.0, como já está anotado em `14_task.md`. Aqui é só registro de que o comportamento ficou fixado em teste.
- Continua valendo a recomendação da 1ª rodada sobre o cenário de carga dos pedidos sem senha em `infra/k6/reivindicacao-em-sala.js`, já levada ao `TODO.md`.

Nesta rodada conferi o diff entre `e31b6573` e `cb06f9bf`. A rodada anterior não exigiu correções. O diff tem três tipos de mudança:
- **Comentários e documentos:** a migration, o painel, `acoes.ts`, `salas.controller.ts`, `sala.module.ts`, `docs/lgpd.md` e `docs/arquitetura.md`. Nenhum altera comportamento. O corpo SQL da 0047 não mudou.
- **Três casos de teste novos:**
  - O código errado pelo `iniciar` passa a contar no limite de código errado da escola, e não só no do IP.
  - O reenvio sem cookie é idempotente: não cria pedido duplicado.
  - O caso do lote com conflito.
- **Texto de `14_task.md`.**

Nenhum teste novo chama provedor pago: o login usa o `oidc-falso`.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-08 23:23:14 · `tasks/prd-acesso-e-convites/14_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A rodada não toca em `Nota`. Procurei `lancadaPor` e `nota` em `apps/api/src/sala` e `apps/api/src/sessao/external` e não achei nada. Todos com autor humano? Sim, porque não há nenhum caminho.

Decisão autônoma sobre aluno: ausente. O caso novo do lote `[ok, conflito, ok]` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/reivindicacao-com-conta.int.test.ts`, linhas 567 a 589 do commit auditado) só fixa como um lote se comporta quando o professor o aprova:
- O primeiro pedido fica decidido, e foi decisão humana.
- O conflito interrompe o lote com 409.
- O segundo e o terceiro continuam pendentes.

Nada é aprovado sem alguém confirmar. O teste de reenvio sem cookie e o do código errado pelo `iniciar` tratam de limite e de reenvio. Nenhum dos dois decide nada sobre a trajetória do aluno.

Aprovação registrada: ok. O comentário novo de `conta_externa.ligada` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/auditoria/acoes.ts:125-127`) diz que o autor é quem aprovou (professor ou coordenação), na mesma transação que cria o aluno. Isso está de acordo com o D4 e com o item 6 da regra 70. Nenhuma saída de IA aparece nesta rodada.

Supervisão do tutor: ok. A rodada não toca no tutor.

Autonomia declarada e visível: sim. A rodada não toca em agente nem em governança.

Bloqueantes: nenhum.

Recomendações:
- A tela da 16.0 tem um ponto a cuidar. Quando o lote para no `CONFLITO`, o professor não pode concluir que nada foi aprovado: o primeiro pedido já fica aprovado e a resposta 409 não diz quem ficou. A tela precisa reler os pedidos e mostrar o estado real de cada um. A decisão de mudar o contrato do lote já está encaminhada ao Arquiteto, na tabela de recomendações da `14_task.md`.
- Continua a recomendação da 1ª rodada, já registrada no `TODO.md`: o SQL de volta de versão do runbook encerra pedidos sem gravar auditoria por pedido. Não bloqueia, porque encerrar não é decidir sobre o aluno.

Escopo conferido:
- Li o diff `e31b6573..cb06f9bf`, que muda 9 arquivos: comentários, documentação, três casos de teste e o texto da tarefa.
- No `sala.module.ts`, no teste e na migration 0047, a cópia de trabalho é idêntica ao `cb06f9bf`. Na `14_task.md`, a cópia de trabalho tem uma linha a mais que o commit.
- Não houve correção exigida a conferir.
- Nenhum item da regra 70 muda com esta rodada: nota, discursiva e redação, tutor, autonomia, supervisão e indicador de professor ficam como estavam.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-08 23:23:26 · `tasks/prd-acesso-e-convites/14_task.md`

VEREDITO: APROVADO

**Rodada 2.** A rodada 1 não exigiu nenhuma correção. Auditei o diff `e31b6573..cb06f9bf`, que mexe em 9 arquivos, e o que ele afeta. Os arquivos versionados e os novos na pasta de trabalho estão iguais aos do snapshot `cb06f9bf`.

**Campos pessoais tocados:** nenhum campo novo nesta rodada. A migration 0047 só mudou o comentário. As colunas e o check são os mesmos da rodada 1.

**Fora da tabela de dados do `docs/lgpd.md`:** nada. A linha "Acesso da turma" agora registra que, quando o aluno começa o login pela conta da escola, o token ou o código vão na consulta de um GET ao `iniciar`, com intenção de reivindicar. Conferi as duas afirmações dessa linha:
- `infra/Caddyfile` exclui `http.log.access`, `http.log.error` e `http.handlers.reverse_proxy`, então a borda não grava a URL.
- Em `apps/api/src` e em `packages/core/src` nada lê `req.url` ou `originalUrl`, e não há instrumentação HTTP que guarde a query.

O que sobra é o endereço no histórico do navegador do computador da escola, e a linha diz isso.

**Autorização por objeto:** ok.
- O caso novo do código errado pelo `iniciar` (`apps/api/test/reivindicacao-com-conta.int.test.ts:272`) confere 404 sem `Location` e sem cookie. A resposta é igual à do slug que não existe, e o contador da escola B não muda.
- Os comentários de `sala.module.ts:51` e de `docs/arquitetura.md:109` limitam o que o `SalaModule` global exporta à porta `SALA_PARA_A_CONTA`. Repository, service e contador da sala ficam fora desse caminho.

**Exposição:**
- O 409 do lote `[ok, conflito, ok]` (`reivindicacao-com-conta.int.test.ts:567`) mostra que o corpo não traz nenhum dos ids do pedido. Não confirma quem ficou decidido.
- O reenvio sem cookie (`:363`) só responde "enviado" quando a chave de envio, sorteada pelo navegador, já está gravada. Não cria um segundo pedido. Um nome diferente sem cookie recebe 400 e nenhum pedido é criado.

**Logs:** limpos. O diff não acrescenta nenhuma linha de log.

**Auditoria:** presente. O comentário de `conta_externa.ligada` (`packages/core/src/auditoria/acoes.ts:125`) agora inclui a aprovação do aluno, com quem aprovou como autor, e diz que o registro nunca leva o e-mail nem o identificador da conta externa. O comportamento não mudou desde a rodada 1.

**Envio externo:** nenhum novo. A descrição do painel `fundacao.json` só ganhou o resultado `conta_provada` da métrica, sem pessoa.

**Seed/fixture:** sintético. A matrícula é `RA${randomUUID()}`, a conta usa a constante sintética `SUJEITO_DA_ALUNA`, e o código errado vem de `sortearCodigoDaTurma()`.

**Bloqueantes:** nenhum.

**Recomendações:**
1. O token da sala fica no histórico do navegador, num computador compartilhado, por até 30 dias. Está documentado e não bloqueia. Ainda assim, numa tarefa futura vale fazer o início do login por POST de formulário em vez de GET, o que tira o token do histórico. A borda continua sem log, e o 302 até o provedor funciona do mesmo jeito.
2. A tabela de recomendações em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/14_task.md` manda sete itens para o `TODO.md`. Um deles é o meu da rodada 1: o professor sem ligação que entra com intenção de reivindicar vira "conta provada". O `TODO.md` não mudou nesta pasta de trabalho, então esses itens ainda não estão lá. Eles precisam entrar antes do pouso, ou a tabela deve apontar o destino real.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/lgpd.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/reivindicacao-com-conta.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sala/sala.module.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/Caddyfile`

## revisor-geral · 2ª rodada · APROVADO · 2026-11-08 23:23:28 · `tasks/prd-acesso-e-convites/14_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (`portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)`)
Bloqueantes: nenhum

A correção exigida na 1ª rodada foi feita. Em `packages/core/drizzle/0047_reivindicacao_conta.sql:13-14`, o comentário agora diz que o runbook "encerra, sem decisão, os pedidos de conta pendentes e devolve o nome à lista antes". É o que dizem a techspec §3 e `docs/runbook.md:855-860`, onde o SQL grava `estado = 'encerrada'` sem `decidida*`. A pergunta 7 da autoconferência (`14_task.md`) passou a ser verdadeira. O carimbo do portão foi renovado e vale para a árvore atual.

Conferi o que mudou além disso nesta rodada:
- **Token ou código na query do `iniciar`:** já estava previsto na techspec (linha 133, "com o `token` do link ou o `codigo` da sala na query"). Não é divergência nova. O que `docs/lgpd.md` e o comentário de `apps/api/src/sala/salas/salas.controller.ts:23-27` afirmam bate com `infra/Caddyfile:9-18`, que não grava log de acesso.
- **Comentário de `sala.module.ts`:** confere com `docs/arquitetura.md`. O módulo global exporta só `SALA_PARA_A_CONTA`.
- **Três casos novos em `apps/api/test/reivindicacao-com-conta.int.test.ts`:** cobrem o contador de código errado pelo `iniciar`, o reenvio sem cookie e o lote `[ok, conflito, ok]`. O teste do lote registra o comportamento de hoje (o `CONFLITO` para o lote), e é o que a techspec e o `cenarios.md:165-171` pedem. Mudar isso fica para a 16.0, com o Arquiteto, como está registrado.
- **Comentário de `acoes.ts`, descrição do painel `fundacao.json` e nota de lock na migration:** só texto, e o texto confere com o código.

Recomendações:
- `packages/core/drizzle/0047_reivindicacao_conta.sql:7-10`: a nota diz que o `validate` e o índice "vão para um passo próprio quando a tabela crescer". Isso merece um item no `TODO.md` com o gatilho (tamanho da tabela), senão se perde.
- As recomendações da 1ª rodada que foram para o `TODO.md` (o barril `sessao/index.ts` exportando `ExternalLoginService` para teste, a ordem provedor/`sala.achar` no `iniciar`, o cookie reaproveitado depois da aprovação) precisam ser fechadas antes da 15.0, como o próprio `14_task.md` registra.

## test-engineer · 2ª rodada · APROVADO · 2026-11-08 23:23:53 · `tasks/prd-acesso-e-convites/14_task.md`

VEREDITO: APROVADO

Cenários exigidos: só a correção exigida na 1ª rodada. É o limite de código errado no `GET /v1/sessao/externa/:provedor/iniciar?intencao=reivindicar&codigo=`. São três provas: N códigos errados somam N no contador da escola, o código certo continua indo ao provedor, e há uma linha na tabela de testes mais um bloco `mutacao` sobre a fiação do `SalaDoLoginPelaSala`. Também auditei os dois casos novos que vieram junto: o lote `[ok, conflito, ok]` e o reenvio sem cookie.

Cobertos:
- **Correção 1, feita.** O caso está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/test/reivindicacao-com-conta.int.test.ts:272-289`.
  - Três códigos errados pelo `iniciar` dão 404 sem `Location` e sem cookie, e somam exatamente 3 no `sala.contadores(a, a.turma).escola`, que é o contador real no Redis.
  - O código certo dá 302 e não soma nada.
  - O token inexistente e o slug inexistente também não somam.
  - O contador da escola B fica igual.
  - O bloco `mutacao` troca o `limites` por uma guarda que não faz nada, em `sala.module.ts`. Com ela, o `codigoErrado` de `acesso-da-sala.ts:56` não incrementa, o contador fica em 0 e o caso cai na linha 280. Ele fica vermelho pelo motivo certo, porque o teto é de 1.000 (`sala-rate-limits.ts:10`) e três tentativas não chegam ao bloqueio.
  - A linha está na tabela de testes do `14_task.md`, com o nome do caso.
- **Reenvio sem cookie** (linhas 363-376). A mutação tira o `chaveGravada` de `reivindicacao.service.ts:129`, que é a primeira checagem antes de `contaDoPedido` (linha 131). Sem ela, o reenvio sem cookie vira `ENTRADA_INVALIDA` e o caso cai na linha 80. A asserção olha o resultado: a resposta `ENVIADO`, o cookie apagado, um pedido só, e o outro nome recebendo 400 sem pedido criado.
- **Lote `[ok, conflito, ok]`** (linhas 567-589). Fixa o comportamento de hoje: 409 com `CONFLITO` e sem nenhum id na resposta, o primeiro pedido `aprovada` com o nome `aprovado`, o segundo e o terceiro `pendente`, e o terceiro nome ainda `reivindicado`. Está na tabela de testes.
- A contagem passou de 26 para 28 blocos, com os mesmos 6 motivos de linha sem bloco. A conta bate com os dois blocos novos.
- Rodei `npx vitest run apps/api/test/reivindicacao-com-conta.int.test.ts`: 26 casos verdes.
- Não há `.skip`, `.only` nem `.todo` nesse arquivo nem no `cookie-oidc.test.ts`.
- O resto do diff é texto: comentários da 0047, do `acoes.ts`, do `salas.controller.ts` e do `sala.module.ts`, a descrição do `fundacao.json`, o `docs/lgpd.md` e o `docs/arquitetura.md`. Nenhum desses arquivos traz cláusula nova que precise de bloco.

Bloqueantes: nenhum.

Recomendações:
- `reivindicacao-com-conta.int.test.ts:282`: para o código certo, o caso só olha o `status` 302. Conferir também que o `Location` aponta para o `oidc-falso` (o authorize) fecharia a frase "segue ao provedor" do nome do caso. Hoje um 302 para outro destino passaria.
- `reivindicacao-com-conta.int.test.ts:277`: o `sortearCodigoDaTurma()` pode, por acaso, sortear o código vigente da A. A chance é desprezível, mas excluir `a.codigo` no laço deixa o caso determinístico.
- O caso do lote depende da ordem em que o `decidir` percorre os ids. Se a ordem do lote fizer parte do contrato, vale um comentário no teste dizendo isso, para a tarefa 16.0 não mudá-la sem perceber (está ligado ao item do `CONFLITO` já registrado para a 16.0).
