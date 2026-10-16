# Achados das revisões — `tasks/prd-telas-do-aluno-e-primeiro-acesso/1_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-10-16 08:36:43 · `tasks/prd-telas-do-aluno-e-primeiro-acesso/1_task.md`

VEREDITO: APROVADO

Tabelas verificadas: `usuario`, que ganha a coluna `introducao_vista_em` (`packages/nucleo/drizzle/0037_introducao_vista.sql`, `packages/nucleo/src/db/schema/usuario.ts`). Não há tabela nova. A coluna fica no usuário e não no vínculo, então não varia por período e não pede `anoLetivoId`. Os ids continuam UUID.

Queries verificadas:
- `EuRepository.doContexto` e `EuRepository.marcarIntroducaoVista` (`/home/joaquimdp/Documentos/git/.andares-avulsos/educaia--spec-telas-do-aluno/apps/api/src/sessao/eu.repository.ts:358-366`) filtram por `escola_id` e `id` vindos de `identidadeDaRequisicao()`. O método não recebe argumento e não recebe data.
- `ResolucaoDeTenantRepository.introducaoMaisAntigaDaConta` (`/home/joaquimdp/Documentos/git/.andares-avulsos/educaia--spec-telas-do-aluno/apps/api/src/sessao/resolucao-de-tenant.repository.ts:493-500`) é `@SemEscopo` com justificativa escrita, registrada na lista de `resolucao-de-tenant.repository.test.ts`. O `contaId` e o `papel` vêm da linha da sessão, nunca do cliente. A query filtra conta, papel, desativado e eliminação agendada, e devolve só a data.
- `POST /v1/eu/introducao` (`/home/joaquimdp/Documentos/git/.andares-avulsos/educaia--spec-telas-do-aluno/apps/api/src/sessao/eu.controller.ts:281-288`) aceita só corpo vazio e estrito. `escolaId`, `usuarioId` ou data no corpo dão `ENTRADA_INVALIDA`, e o teste prova isso com os três campos.
- O GET grava na linha da sessão o `now()` da própria escrita, nunca o valor de outra escola. Por isso nada da escola A fica guardado na B.
- `LEITURAS_DO_ARQUIVO.usuario` continua filtrando por `escola_id` e `id`, e a versão `coordenacao` não traz a data.
- A matriz põe `concluir_introducao` como `nunca` para a rede. Não há consulta agregada da camada rede nesta tarefa.

Teste de isolamento: presente e efetivo.
- `eu.repository.int.test.ts › isolamento: marcar a introdução grava só a linha do contexto…`: se a cláusula `escola_id` sair, o contexto da escola B com o usuário de A grava a linha de A e devolve uma data, e o teste fica vermelho.
- Nos testes de `introducao.int.test.ts`, tirar `id = <contexto>` faz o colega da mesma escola deixar de ficar nulo, tanto no POST quanto na escrita do GET.
- Também em `introducao.int.test.ts`, tirar o filtro de conta ou de papel em `introducaoMaisAntigaDaConta` faz outra conta ou outro papel emprestar a data. Os testes `outra conta…` e `o mesmo papel…` ficam vermelhos.
- Cada uma dessas cláusulas tem bloco de mutação declarado na tarefa.

Bloqueantes: nenhum.

Recomendações:
- `ResolucaoDeTenantRepository` passa a ter mais um método `@SemEscopo`. O total já passava de três antes desta tarefa, e cada um tem justificativa e teste. Ainda assim, a regra 10, item 9, pede que se reveja o desenho quando chega a três. Vale levar ao `/retro` se a leitura entre escolas da mesma conta deve ir para um repository próprio, separado da resolução de login.
- O GET passa a gravar na primeira leitura em B, sob `@Permite('eu', 'ler')`. Como só grava `now()` na linha da sessão, a escola B fica sabendo, pela própria linha, que a pessoa já tinha visto a introdução em outra escola. Essa informação só sai no arquivo da própria pessoa (versão `completa`), então não é vazamento. Vale uma frase sobre isso na linha do mapa em `docs/lgpd.md`.

## infra-guardian · 1ª rodada · APROVADO · 2026-10-16 08:37:10 · `tasks/prd-telas-do-aluno-e-primeiro-acesso/1_task.md`

VEREDITO: APROVADO

Caminho quente tocado: login (`GET /v1/eu` logo depois do login) e migration

Rate limit: ok. O `POST /v1/eu/introducao` passa pelas guardas globais que já existem, e a `GuardaDeLimite` conta pelo `sub` e pelo `esc` do token (`apps/api/src/app.module.ts:144-150`). A rota nova não tem limite por IP.

Fila e prioridade: ok. Não há nada demorado. O GET faz no máximo uma consulta a mais, e o aluno não faz nenhuma, porque não tem conta. Essa consulta usa `usuario_conta_idx`. A escrita no GET acontece uma vez por linha, só quando a linha está nula e outra escola da conta já tem data.

Concorrência: protegida. A escrita é um `UPDATE ... coalesce(introducao_vista_em, now())` numa instrução só, com trava de linha e filtro por `escola_id` e `id` do contexto (`apps/api/src/sessao/eu.repository.ts:51-57`). Não há o padrão "busca, verifica, grava" sem trava. Os testes com `Promise.all` cobrem dois POST, dois GET e um GET com um POST (`apps/api/test/introducao.int.test.ts:225-248, 301-320`). A falha é provocada por um gatilho no banco que vale só para uma linha, então não atrapalha os testes que rodam em paralelo.

Índice e paginação: ok. A consulta `min()` filtra por `conta_id` e usa o índice parcial `usuario_conta_idx`, sobre poucas linhas por conta. Ela devolve uma linha só, então não precisa de paginação.

Degradação de IA: não se aplica.

Migration: compatível. `packages/nucleo/drizzle/0037_introducao_vista.sql` só acrescenta uma coluna nula, sem valor padrão e sem índice. No Postgres isso é alteração só de metadados, sem reescrever a tabela, e o código anterior ignora a coluna.

Métrica e alerta: ok. A latência e a taxa de erro da rota já são medidas por `http.server.request.duration`. A falha da gravação no GET conta em `eu.introducao_falha`, sem rótulo, e tem painel em `infra/grafana/paineis/fundacao.json`. Não foi criado alerta, e a Tech Spec explica por quê (seção 7c), então não falta runbook. O cenário do k6 (`infra/k6/login-7h30.js`) está a cargo da tarefa 3.0, como diz a Tech Spec. Nenhum teste chama provedor pago.

Bloqueantes: nenhum

Recomendações:
- `/home/joaquimdp/Documentos/git/.andares-avulsos/educaia--spec-telas-do-aluno/tasks/prd-telas-do-aluno-e-primeiro-acesso/techspec.md:150`: falta um ponto final antes de "A gravação do `GET /v1/eu`". A frase nova está colada na anterior.
- `/home/joaquimdp/Documentos/git/.andares-avulsos/educaia--spec-telas-do-aluno/apps/api/src/sessao/eu.service.ts`, em `#gravarSemEmprestar`: o `catch` sem filtro esconde qualquer erro, não só falha do banco, e conta tudo como `eu.introducao_falha`. Seria bom registrar no aviso a classe do erro, só com o código e sem dado de pessoa, para separar falha do Postgres de bug.
- Quando a tarefa 3.0 atualizar o k6, convém incluir uma professora em duas escolas no cenário. Hoje só o aluno exercita o `/v1/eu`, e o aluno nunca entra no caminho da data vinda de outra escola nem na escrita feita pelo GET.

## privacy-guardian · 1ª rodada · APROVADO · 2026-10-16 08:37:21 · `tasks/prd-telas-do-aluno-e-primeiro-acesso/1_task.md`

VEREDITO: APROVADO

**Campos pessoais tocados:** um só, `usuario.introducao_vista_em`, a data em que a pessoa viu a introdução do papel dela. Vale para aluno, professor e coordenação. Ele aparece no `GET /v1/eu`, na resposta do `POST /v1/eu/introducao` e no arquivo do titular (versão `completa`). Nenhum campo proibido para aluno entra.

**Fora da tabela de dados do docs/lgpd.md:** nenhum. A linha nova está em `/home/joaquimdp/Documentos/git/.andares-avulsos/educaia--spec-telas-do-aluno/docs/lgpd.md:103`, com finalidade, base legal (execução de contrato) e retenção. A retenção é a mesma da tabela `usuario`. Conferi que a eliminação apaga a linha de fato (`packages/nucleo/src/ciclo-de-vida/ciclo-de-vida.repository.ts:253`), então a data sai junto.

**Autorização por objeto:** ok. O POST não recebe id. Sem corpo nem id de entrada, não há id para trocar na URL.
- O corpo é vazio e estrito: campo a mais dá `ENTRADA_INVALIDA`, e o teste confirma que nada é gravado.
- A escrita é só na linha da sessão, filtrando por `escola_id` e `id` do contexto (`apps/api/src/sessao/eu.repository.ts:391-399`).
- Há teste para escola trocada (`eu.repository.int.test.ts`), para colega da mesma turma ou escola e para a escrita do GET. Todos têm mutação declarada.
- A leitura sem escopo `introducaoMaisAntigaDaConta` (`apps/api/src/sessao/resolucao-de-tenant.repository.ts:526-533`) usa a conta tirada da linha da sessão, nunca do cliente. Ela filtra por mesmo papel, ativo e sem eliminação agendada, e devolve só uma data.
- A data emprestada de outra escola não é gravada em B: B grava o `now()` da própria escrita, e há mutação que prova isso.
- O aluno não tem conta, então não empresta nem recebe data de ninguém.
- A rede fica em `nunca` na matriz e na expectativa.
- A data não vai para `acessos` nem para a etapa `escolher` do login, e há teste para os dois.

**Logs:** limpos. O aviso `eu.introducao_nao_gravada` não leva nenhum dado (`apps/api/src/sessao/eu.service.ts:428`). O erro do banco é engolido sem ir ao log. O contador `eu.introducao_falha` não tem rótulo, e o teste confirma que os atributos são `{}`.

**Auditoria:** não se aplica. A pessoa marca o próprio dado, e não há leitura pela coordenação ou pela rede, exportação, nota, permissão nem saída de IA.

**Envio externo:** nenhum. A tarefa não envolve IA.

**Seed/fixture:** sintético. As fixtures do e2e e a vitrine usam nomes "sintético" e e-mails `@educa.invalid`. A coluna recebe `now()` ou `null`, nunca um valor vindo de fora.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Em `packages/nucleo/src/titular/leitura-do-titular.ts:94`, a versão `coordenacao` tira a data também do aluno, e a D64 só pede isso para o professor. Essa versão é a que vai ao titular sem conta ativa. Na prática, o aluno desativado que pede acesso pela coordenação não recebe a data, e o pedido de acesso fica um pouco incompleto. Há precedente (`execucao_agente.entrada`) e está declarado em `docs/lgpd.md:103`, por isso não bloqueia. Vale decidir de forma explícita, no `/validar`, se a data do aluno volta à versão `coordenacao`.
2. Em `tasks/prd-telas-do-aluno-e-primeiro-acesso/techspec.md`, §7c, linha "Métrica, alerta, teste de carga": a frase nova foi colada sem ponto ("...das outras A gravação do `GET /v1/eu`..."). É só texto.

## revisor-geral · 1ª rodada · REPROVADO · 2026-10-16 08:38:35 · `tasks/prd-telas-do-aluno-e-primeiro-acesso/1_task.md`

VEREDITO: REPROVADO
Escopo: respeitado. Há uma linha de log que a tarefa deixa explicitamente fora do escopo; ela está no primeiro bloqueante.
Aderência à Tech Spec: divergência em §7, nas linhas "O que vai para log" e "Arquivo do titular".
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)").

Bloqueantes:

1. **Log novo que a Tech Spec não prevê.** Em `/home/joaquimdp/Documentos/git/.andares-avulsos/educaia--spec-telas-do-aluno/apps/api/src/sessao/eu.service.ts:20`, o `#avisar` chama `this.#logger.warn('eu.introducao_nao_gravada')`, e `#gravarSemEmprestar` o usa (linha 71).
   - O que está errado: a `techspec.md` §7 diz "O que vai para log: nenhuma linha nova", e a `1_task.md` põe "log novo" em "Fora do escopo desta tarefa". A linha não leva dado pessoal, mas foi decidida em silêncio. Ela não aparece na tabela de divergências da tarefa, e a frase acrescentada em §7c só fala do contador.
   - Correção exigida: escolha um dos dois caminhos.
     - Tirar o `#logger` e o `#avisar`. O contador `eu.introducao_falha` com o painel já cumpre o que §7c pede. Nesse caso, o bloco de mutação com o contexto `this.#avisar()` em `1_task.md` precisa ser ajustado.
     - Manter o log, registrá-lo em `techspec.md` §7 ("O que vai para log") e acrescentar uma linha na tabela de divergências da `1_task.md`, com o motivo.

2. **A versão `coordenacao` tira a data também do aluno.** Em `/home/joaquimdp/Documentos/git/.andares-avulsos/educaia--spec-telas-do-aluno/packages/nucleo/src/titular/leitura-do-titular.ts:94`, `porVersao(..., ['introducao_vista_em'])` tira a data da versão `coordenacao` para todo titular.
   - O que está errado: a subtarefa 1.5 e a `techspec.md` §7 ("a versão `coordenacao` não a traz para professor (D64)") pedem isso só para o professor. O comentário do teste em `apps/api/test/arquivo-do-titular.int.test.ts` ("nem a do aluno, que viria na mesma versão") mostra que a extensão ao aluno foi uma escolha consciente. Ela está em `docs/lgpd.md:103`, mas não está na Tech Spec nem na tabela de divergências.
   - Por que importa: essa é a versão que chega ao aluno sem conta ativa. Ele deixa de receber um dado dele no pedido de acesso (art. 18).
   - Correção exigida: escolha um dos dois caminhos.
     - Trazer a data do aluno na versão `coordenacao`, como §7 diz, e prender isso no teste.
     - Registrar a extensão em `techspec.md` §7, na linha "Arquivo do titular", e na tabela de divergências da `1_task.md`, com o motivo. Junto, acrescentar `introducao_vista_em` à lista do critério 5 no comentário de `leitura-do-titular.ts:29-32`.

Recomendações:
- `/home/joaquimdp/Documentos/git/.andares-avulsos/educaia--spec-telas-do-aluno/tasks/prd-telas-do-aluno-e-primeiro-acesso/techspec.md:150`: falta o ponto final antes de "A gravação do `GET /v1/eu`".
- `/home/joaquimdp/Documentos/git/.andares-avulsos/educaia--spec-telas-do-aluno/apps/api/test/introducao.int.test.ts`, no teste "B tem ano em curso e A não (e o contrário)": a segunda metade não monta "o contrário". A `outra` não tem ano em nenhuma das duas escolas. Corrija o nome ou monte o caso.
- `/home/joaquimdp/Documentos/git/.andares-avulsos/educaia--spec-telas-do-aluno/apps/api/src/sessao/eu.service.ts:67-73`: o `catch` sem filtro conta qualquer exceção, inclusive bug de código, como falha de gravação no banco.
- As divergências 2 e 3 da tabela citam `techspec.md` §4 como "onde está na spec". A §4 sustenta a regra (`rede: nunca`; `NAO_AUTENTICADO` sem linha), mas não diz como ela é provada. Vale uma frase em §10 para a próxima leitura não estranhar.

## test-engineer · 1ª rodada · REPROVADO · 2026-10-16 08:38:45 · `tasks/prd-telas-do-aluno-e-primeiro-acesso/1_task.md`

VEREDITO: REPROVADO

Cenários exigidos: caminho feliz nos três papéis · POST repetido e virada do ano letivo · permissão (sem sessão, campo no corpo, rede) · isolamento entre escolas na escrita · só a própria linha (dois alunos da mesma turma, dois professores) · escola sem ano em curso e entre anos · professora em duas escolas: empréstimo, `now()` em B e a data mais antiga · a escrita do GET grava só a linha da sessão · vínculo encerrado (RF12) · sem GET no meio · B sem ano em curso · corrida do GET (dois GET juntos, GET junto com POST) · gravação do GET que falha · papel diferente, outra conta e eliminação agendada não emprestam · `coalesce` com data antiga · concorrência de dois POST · arquivo do titular (completa e `coordenacao`) · o `escolher` do login não leva a data · a data não sai em `acessos`.

Cobertos: todos os cenários acima.
- Rodei `apps/api/test/introducao.int.test.ts`: 21 passaram.
- A concorrência é de verdade, com `Promise.all` em dois POST, em dois GET e num GET junto com um POST.
- A falha da gravação vem de um gatilho no Postgres, sem mock do repository, e o contador sai sem rótulo (`[{}]`).
- O isolamento no repository (`eu.repository.int.test.ts`) prova que, no contexto de B, a linha de A não é achada nem alterada.
- O teste do `escolher` (`troca-de-escola.int.test.ts`) usa `toEqual` exato, então pega campo a mais.
- A rede é provada só pela matriz. É divergência declarada e aceitável, porque não existe token de rede.
- Conferi os 20 blocos de mutação. Cada um chega à sua cláusula e fica vermelho pela asserção da regra, com uma exceção: o bloco do `contaId` falha por erro de uuid (ver recomendações).
- Não há `.skip`, teste comentado, nem provedor de IA envolvido.

Bloqueantes:
1. `apps/api/src/sessao/eu.service.ts:38`: a cláusula `emprestada !== null` em `if (propria === null && emprestada !== null)` não tem bloco de mutação. É a cláusula que impede o `GET /v1/eu` de marcar a introdução sozinho. Sem ela, a primeira leitura grava `now()`, devolve a data, e a introdução nunca aparece para ninguém. O bloco "vínculo encerrado" apaga a linha inteira, então não prova esta condição. Os testes atuais pegam a mutação ("caminho feliz" espera nulo antes do POST, e "só a própria linha" espera o `/v1/eu` do colega nulo), mas uma cláusula nova sem bloco é bloqueante por si.
   - Correção: acrescentar na seção "Mutações" de `tasks/prd-telas-do-aluno-e-primeiro-acesso/1_task.md`:
     ```
     arquivo: apps/api/src/sessao/eu.service.ts
     teste: apps/api/test/introducao.int.test.ts › caminho feliz
     -    if (propria === null && emprestada !== null) propria = await this.#gravarSemEmprestar()
     +    if (propria === null) propria = await this.#gravarSemEmprestar()
     ```

Recomendações:
- **Bloco do `contaId`** (`eu.service.ts:63`, teste "caminho feliz"): fica vermelho porque `conta_id = ''` quebra o cast de uuid e dá 500, não porque o aluno passou a emprestar. A cláusula só curto-circuita uma consulta que voltaria vazia de qualquer jeito. Vale reescrever o bloco para algo que mostre comportamento, ou declarar que ele só prova que a rota não quebra.
- **Primeira guarda do POST** (`eu.service.ts:53`, `if (linha === undefined)`): sem bloco, e o teste de unidade não a distingue da segunda. Quando `doContexto` volta `undefined`, o falso de `marcarIntroducaoVista` também volta `undefined`, e a segunda guarda lança o mesmo `NAO_AUTENTICADO`. Se o falso devolver uma `Date` no caso `'doContexto'`, a primeira guarda passa a ser a única que segura o erro, e aí ganha bloco.
- **`no-store` do POST** (`eu.controller.ts:24`): a subtarefa 1.3 pede o cabeçalho, mas nenhum teste o confere. Basta uma linha no "caminho feliz" checando `cache-control` da resposta do POST.
- **Texto da Tech Spec** (`techspec.md` §7c): falta o ponto entre "…na média das outras" e "A gravação do `GET /v1/eu`…".
- **Opção `introducao: 'por_ver'`** nas fábricas do e2e: ainda nenhum teste a usa. Ela fica para as tarefas 9.0 a 11.0, que devem exercitá-la.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-10-16 08:46:53 · `tasks/prd-telas-do-aluno-e-primeiro-acesso/1_task.md`

VEREDITO: APROVADO

Tabelas verificadas: `usuario`, só a coluna `introducao_vista_em`. A rodada 2 não cria tabela nem coluna; o que já estava aprovado na 1ª rodada não muda.

Queries verificadas:
- **Consulta da tabela `usuario` no arquivo do titular** (`/home/joaquimdp/Documentos/git/.andares-avulsos/educaia--spec-telas-do-aluno/packages/nucleo/src/titular/leitura-do-titular.ts:95`). Ela continua filtrada por `t.escola_id = ${escolaId} and t.id = ${titularId}`. O `case when t.papel = 'aluno'` só lê a linha do próprio titular, dentro da escola dele, e não puxa a data de outra escola. Os dois `sql.raw` são texto fixo, sem nada vindo do cliente. A nova regra de versões não toca o escopo: na versão da coordenação vai a data do aluno, e a do professor continua de fora (D64).
- **`EuService.obter` e `#gravarSemEmprestar`** (`/home/joaquimdp/Documentos/git/.andares-avulsos/educaia--spec-telas-do-aluno/apps/api/src/sessao/eu.service.ts`). A mudança tirou o `Logger` e o `avisoEspacado`, e não mexe em escopo. A gravação do `GET` continua escrevendo `now()` na linha da sessão. A data emprestada de outra escola não é copiada para B.
- **Mutação nova `if (propria === null)`**. Ela prova que a gravação só acontece quando existe data emprestada. Não altera o isolamento.

Teste de isolamento: presente e efetivo. O teste de "ano em curso" (`/home/joaquimdp/Documentos/git/.andares-avulsos/educaia--spec-telas-do-aluno/apps/api/test/introducao.int.test.ts:213-228`) agora cobre os dois sentidos entre as escolas A e B. A data emprestada continua chegando só pela conta. Os testes de isolamento da 1ª rodada não mudaram. No arquivo do titular, a versão da coordenação continua provada sem a data do professor (o valor vem nulo e o texto exportado não tem a data). Duas mutações declaradas na tarefa provam essa consulta: tirar o `case` e zerar a data do aluno.

Bloqueantes: nenhum.

Recomendações:
- Antes, na versão da coordenação, a coluna `introducao_vista_em` nem aparecia na linha do professor. Agora ela aparece com valor nulo. Não vaza dado, mas mostra que o campo existe. Se a regra for não expor nem o campo, troque o `case` por uma lista de colunas que mude conforme o papel do titular. Fica para o `/validar`.
- A recomendação de desenho da 1ª rodada continua aberta e está no `/retro`: o método `@SemEscopo` a mais em `ResolucaoDeTenantRepository`.

## infra-guardian · 2ª rodada · APROVADO · 2026-10-16 08:47:08 · `tasks/prd-telas-do-aluno-e-primeiro-acesso/1_task.md`

VEREDITO: APROVADO
Caminho quente tocado: login (`GET /v1/eu` logo depois do login do aluno, às 7h30)
Rate limit: ok (o diff não toca limite)
Fila e prioridade: ok (não se aplica, nada vai para fila)
Concorrência: protegida (a gravação continua com `coalesce` e trava de linha; o diff não mexe nela)
Índice e paginação: ok (nenhuma query nova em tabela que cresce com aluno; o `case when` em `packages/nucleo/src/titular/leitura-do-titular.ts:95` filtra por `escola_id` e `id`, fora do caminho quente)
Degradação de IA: não se aplica
Migration: não se aplica (a 0037 não muda nesta rodada)
Métrica e alerta: ok (o log `eu.introducao_nao_gravada` saiu, e a falha continua contada em `eu.introducao_falha`, com painel em `fundacao.json` e linha em `tools/testes/metricas.ts`; não há alerta novo, então não precisa de runbook)
Bloqueantes: nenhum
Recomendações:
- A nova mutação em `tasks/prd-telas-do-aluno-e-primeiro-acesso/1_task.md` grava em todo GET sem data, mesmo sem data vinda de outra escola. Ela é o que impede uma escrita por login às 7h30. Na validação, confirmar que o teste "caminho feliz" de `apps/api/test/introducao.int.test.ts` fica vermelho com ela pelo motivo certo: uma gravação a mais no banco, e não só a data na resposta.
- O item novo do `TODO.md` (classe do erro no `catch` de `#gravarSemEmprestar`, em `apps/api/src/sessao/eu.service.ts:67`) volta antes do piloto. Hoje só o contador mostra a falha, e ele não separa falha do banco de bug.

Arquivos auditados:
- /home/joaquimdp/Documentos/git/.andares-avulsos/educaia--spec-telas-do-aluno/.processo/ordens/diff-r2.patch
- /home/joaquimdp/Documentos/git/.andares-avulsos/educaia--spec-telas-do-aluno/apps/api/src/sessao/eu.service.ts
- /home/joaquimdp/Documentos/git/.andares-avulsos/educaia--spec-telas-do-aluno/apps/api/src/sessao/eu.controller.ts
- /home/joaquimdp/Documentos/git/.andares-avulsos/educaia--spec-telas-do-aluno/packages/nucleo/src/titular/leitura-do-titular.ts

## privacy-guardian · 2ª rodada · REPROVADO · 2026-10-16 08:47:14 · `tasks/prd-telas-do-aluno-e-primeiro-acesso/1_task.md`

VEREDITO: REPROVADO

Campos pessoais tocados: `usuario.introducao_vista_em`, só a data. Mudou o que vai na versão `coordenacao` do arquivo do titular: agora ela traz a data do aluno.

Fora da tabela de dados do docs/lgpd.md: o campo está na tabela, mas a linha dele ficou errada depois desta rodada (ver o bloqueante).

Autorização por objeto: ok. O diff não abre rota nova. O `POST /v1/eu/introducao` age sobre quem está no token. A consulta do arquivo continua presa a `t.escola_id = ${escolaId}` e `t.id = ${titularId}`.

Logs: limpos. A rodada tirou o `logger.warn('eu.introducao_nao_gravada')` de `apps/api/src/sessao/eu.service.ts`. Sobra o contador sem rótulo `eu.introducao_falha`, sem escola e sem pessoa. A pendência de registrar a classe do erro foi para o `TODO.md` com a condição "só a classe, sem dado de pessoa", o que está correto.

Auditoria: presente onde a regra exige. Marcar a introdução não é leitura de dado alheio nem decisão. O download da versão `coordenacao` já é auditado desde o F3, e esta rodada não mexeu nisso.

Envio externo: nenhum.

Seed/fixture: sintético. O teste novo em `apps/api/test/introducao.int.test.ts` usa a sessão da própria bancada, e o de `arquivo-do-titular.int.test.ts` usa uma data fixa de 2020.

Bloqueantes:
- `/home/joaquimdp/Documentos/git/.andares-avulsos/educaia--spec-telas-do-aluno/docs/lgpd.md:103`, coluna de retenção, diz: "vai no arquivo do titular, exceto na versão `coordenacao` (a data do professor não vai à coordenação, D64)". Lida como está, nenhuma data vai na versão `coordenacao`.
  - O que mudou no código: desde esta rodada, `packages/nucleo/src/titular/leitura-do-titular.ts:95` põe a data do aluno nessa versão (`case when t.papel = 'aluno' then t.introducao_vista_em end`). O teste em `apps/api/test/arquivo-do-titular.int.test.ts:522` prova esse comportamento.
  - O que ficou para trás: a tarefa registrou o desvio em `1_task.md` e na `techspec.md`, mas não na tabela de dados.
  - Por que bloqueia: a tabela é o mapa que responde "para onde o dado do aluno vai" (regra 20, item 1, e a pergunta de fechamento), e hoje ela diz algo diferente do código.
  - Correção exigida: reescrever a linha para dizer que a data vai na versão `completa` para todos. Na versão `coordenacao`, vai a do aluno (dado dele no pedido de acesso, art. 18) e não vai a do professor (D64).

Recomendações:
- Na versão `coordenacao`, o `case` só entrega a data quando `papel = 'aluno'`. Hoje a tabela só tem aluno e professor como titulares de `pedido_titular`, então não há efeito. Se a coordenação passar a ser titular de pedido, a regra precisa ser decidida de propósito, e não ficar como efeito colateral do `case`.
- O resto do diff está certo do lado da privacidade:
  - a resposta do `POST` passa a ser conferida com `cache-control: no-store`;
  - a mutação nova prende a data do aluno na versão `coordenacao`;
  - a mutação do ramo "sem emprestar" do GET foi ajustada;
  - o teste de unidade do ramo "sem linha" foi ajustado.

## revisor-geral · 2ª rodada · REPROVADO · 2026-10-16 08:47:35 · `tasks/prd-telas-do-aluno-e-primeiro-acesso/1_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência no mapa de dados (`docs/lgpd.md`). A §7 da Tech Spec e o código estão alinhados.
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")

Bloqueantes:

1. **O mapa de dados ficou contradizendo o código depois da correção 2.** Em `/home/joaquimdp/Documentos/git/.andares-avulsos/educaia--spec-telas-do-aluno/docs/lgpd.md:103`, a coluna de retenção da linha "Introdução vista" diz: "vai no arquivo do titular, exceto na versão `coordenacao` (a data do professor não vai à coordenação, D64)".
   - O que está errado: a versão `coordenacao` agora traz a data do aluno. Isso está em `packages/nucleo/src/titular/leitura-do-titular.ts:95`, no `case when t.papel = 'aluno'`, e o teste prende isso em `apps/api/test/arquivo-do-titular.int.test.ts:522`. A techspec §7 e a tabela de divergências da `1_task.md` já foram atualizadas. O `docs/lgpd.md` não foi, e continua dizendo que a versão `coordenacao` não traz a data, sem distinguir o papel. Pela regra 20, item 1, essa tabela é a referência do que o sistema guarda e entrega ao titular. Na rodada 1 ela era o único lugar onde a escolha antiga estava escrita, então a correção 2 precisava alcançá-la.
   - Correção exigida: reescrever o trecho para dizer o que o código faz. Por exemplo: "vai no arquivo do titular; na versão `coordenacao`, vai a do aluno (art. 18) e não a do professor (D64)".

Conferência das correções da 1ª rodada:
- Correção 1 feita. O `#logger`, o `#avisar` e os imports deles saíram de `apps/api/src/sessao/eu.service.ts`. O bloco de mutação foi ajustado para usar `this.#naoGravadas.add(1)` como contexto. Não sobrou nenhuma referência a `eu.introducao_nao_gravada`. A recomendação sobre o `catch` foi para o `TODO.md` com motivo.
- Correção 2 feita no código, no teste, na techspec §7, na tabela de divergências e no comentário do critério 5 de `leitura-do-titular.ts:32`. Falta só o `docs/lgpd.md` (bloqueante acima).
- Recomendações da 1ª rodada, todas aplicadas:
  - o ponto final em §7c;
  - o teste "A tem e B não" agora monta o ano em `outra.a`;
  - a frase em §10 ("Matriz e ramos que o HTTP não alcança").

Recomendações:
- Em `packages/nucleo/src/titular/leitura-do-titular.ts:95`, o `case` só traz a data quando o papel é `aluno`. Por isso o titular de papel `coordenacao` também fica sem a data na versão `coordenacao`. A Tech Spec só decide sobre professor e aluno. Vale escrever na §7 o que vale para a coordenação, ou trocar a condição para `t.papel <> 'professor'`, se a intenção for limitar a exclusão ao que a D64 cobre.
- Na versão `coordenacao`, a linha do professor agora leva `introducao_vista_em: null`, quando antes a coluna não vinha (o tenancy-guardian também apontou). Não vaza nada, mas mostra que o campo existe. Isso fica para o `/validar`.

## test-engineer · 2ª rodada · APROVADO · 2026-10-16 08:48:02 · `tasks/prd-telas-do-aluno-e-primeiro-acesso/1_task.md`

VEREDITO: APROVADO

Cenários exigidos:
- Caminho feliz para coordenador, professor e aluno: o GET devolve nulo antes do POST e a data depois, e o POST responde essa data.
- Bordas: segundo POST devolve a primeira data; virada de ano letivo não apaga a data; escola sem ano em curso ou entre dois anos; professora em duas escolas (data emprestada, a mais antiga vence, vínculo encerrado, desativada sem GET no meio, só o mesmo papel empresta, eliminação agendada não empresta); falha de gravação no GET.
- Permissão: sem sessão; corpo com campo; rede recusada pela matriz.
- Isolamento: só a linha da sessão é gravada, outra conta não empresta, a data não sai em `acessos`, e o arquivo do titular separa a versão completa da versão `coordenacao`.
- Concorrência: dois POST em paralelo, e dois GET (ou GET e POST) em paralelo.

Cobertos: todos. `introducao.int.test.ts` e `arquivo-do-titular.int.test.ts` passaram (60 de 60), e `eu.service.test.ts` passou (2 de 2).

Conferência das correções exigidas na 1ª rodada:
1. **Feita.** A cláusula `emprestada !== null` de `/home/joaquimdp/Documentos/git/.andares-avulsos/educaia--spec-telas-do-aluno/apps/api/src/sessao/eu.service.ts:35` agora tem bloco no `1_task.md` (linhas 253-258), apontando para "caminho feliz". Com a mutação, o primeiro GET grava `now()` e o teste fica vermelho já no `toBeNull()` da linha 77. É o motivo certo.

Recomendações da 1ª rodada, conferidas:
- **Bloco do `contaId`: resolvido.** Agora troca para `new Date(0)`, e o caso do aluno falha pela regra, não pelo erro de uuid.
- **Primeira guarda do POST: o teste agora distingue, mas o bloco ainda falta.** Com a leitura sem linha, o repository falso devolve uma data na escrita (linha 24). Sem a guarda da linha 50, o erro sai como `TypeError` em `#emprestada`, sem o código `NAO_AUTENTICADO`. Ou seja, o teste já falharia, só que a linha 50 (e a 31, do GET) continua sem bloco de mutação. Mantenho como recomendação, como na 1ª rodada.
- **`no-store` do POST: resolvido**, com o teste em `introducao.int.test.ts:83-84`.
- **Ponto final no §7c da `techspec.md`: resolvido.**

O que mais entrou neste diff e foi conferido:
- **Arquivo do titular:** a versão `coordenacao` agora traz a data do aluno e não a do professor. A mudança está registrada nos desvios. Os dois blocos de mutação chegam cada um a uma das duas metades: um põe a data do professor e o outro tira a do aluno, e as duas asserções do teste (linhas 81-85 do patch) prendem cada uma.
- **Log retirado do `catch`:** está registrado no `TODO.md`, e o contador continua provado pelo bloco que tira `#naoGravadas.add(1)`.
- **Teste "A tem e B não":** agora cria de fato o ano em curso em `outra.a`. Antes, o cenário inverso não era montado.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documentos/git/.andares-avulsos/educaia--spec-telas-do-aluno/docs/lgpd.md:103` ainda diz "vai no arquivo do titular, exceto na versão `coordenacao`". Isso agora está errado para o aluno, cuja data vai nas duas versões. Ajustar o texto para "a do professor não vai à `coordenacao` (D64); a do aluno vai nas duas (art. 18)". É texto do mapa de dados, assunto também do privacy-guardian.
- Falta um bloco de mutação para cada guarda `linha === undefined` (`eu.service.ts:31` e `:50`). Os testes já pegam a remoção, então o bloco só formaliza a prova no portão.
- Em `introducao.int.test.ts:83`, conferir `bruta.status === 200` antes do cabeçalho, para que um POST que falhe apareça como falha da chamada, e não do `no-store`.

## privacy-guardian · 3ª rodada · APROVADO · 2026-10-16 08:54:10 · `tasks/prd-telas-do-aluno-e-primeiro-acesso/1_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: `usuario.introducao_vista_em`. A coluna guarda só a data em que a pessoa viu a introdução do papel dela, e vale para aluno, professor e coordenação. Esta rodada não mudou código. Só o texto do mapa de dados mudou.

Fora da tabela de dados do docs/lgpd.md: nenhum.

Autorização por objeto: ok. Nada mudou desde a 2ª rodada. A rota só lê e grava a linha da própria sessão, e o teste de isolamento continua no lugar.

Logs: limpos. O log que existia no `catch` saiu na 2ª rodada e está registrado no `TODO.md`. O contador `#naoGravadas` não leva nenhum dado pessoal.

Auditoria: presente onde a regra exige. Ver a introdução não é um dos casos da regra 20, item 10.

Envio externo: nenhum.

Seed/fixture: sintético.

Conferência da correção exigida na 2ª rodada:
- **Feita.** `/home/joaquimdp/Documentos/git/.andares-avulsos/educaia--spec-telas-do-aluno/docs/lgpd.md:103` agora diz: "vai no arquivo do titular, na versão `completa` para todos; na versão `coordenacao`, vai a do aluno (dado dele no pedido de acesso, art. 18) e não a do professor (D64)".
- O texto bate com o código. Em `/home/joaquimdp/Documentos/git/.andares-avulsos/educaia--spec-telas-do-aluno/packages/nucleo/src/titular/leitura-do-titular.ts:95`, a versão `completa` lê `t.introducao_vista_em` sem condição. A versão `coordenacao` usa `case when t.papel = 'aluno' then ... end`, então leva a data do aluno e não a do professor. O comentário das linhas 29 a 32 diz o mesmo.
- Com isso, a pergunta de fechamento tem resposta. A data aparece no arquivo do titular de qualquer papel que pode pedir acesso: aluno e professor, como manda a linha de `pedido_titular`.

Bloqueantes: nenhum.

Recomendações:
1. Em `leitura-do-titular.ts:95`, a condição do `case` está escrita como "papel = aluno", quando a D64 só exclui o professor. Hoje isso não muda nada, porque a tabela só prevê pedido de titular de aluno e de professor. Se um dia a coordenação puder pedir acesso, a data dela ficaria de fora da versão `coordenacao` sem nenhuma decisão por trás. Duas saídas: trocar a condição para `t.papel <> 'professor'`, ou registrar na §7 da Tech Spec o que vale para a coordenação.
2. Na versão `coordenacao`, a linha do professor sai com `introducao_vista_em: null` em vez de não ter o campo. Não vaza dado, mas mostra que o campo existe. Fica para o `/validar`.

## revisor-geral · 3ª rodada · APROVADO · 2026-10-16 08:54:16 · `tasks/prd-telas-do-aluno-e-primeiro-acesso/1_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

A correção exigida na 2ª rodada foi feita. A linha da "Introdução vista" em `/home/joaquimdp/Documentos/git/.andares-avulsos/educaia--spec-telas-do-aluno/docs/lgpd.md:103` agora descreve o que o código faz:
- a versão `completa` traz a data de todos;
- a versão `coordenacao` traz a data do aluno e não a do professor.

O texto bate com o `case when t.papel = 'aluno'` em `/home/joaquimdp/Documentos/git/.andares-avulsos/educaia--spec-telas-do-aluno/packages/nucleo/src/titular/leitura-do-titular.ts:95` e com o comentário do critério 5 do mesmo arquivo (linha 32). A §7 da techspec e a tabela de divergências da `1_task.md` já tinham sido conferidas na 2ª rodada. Desde a rodada anterior, nenhuma linha de código mudou fora dessa.

Recomendações:
- Continua aberta a recomendação da 2ª rodada sobre o titular de papel `coordenacao`. O `case` em `leitura-do-titular.ts:95` também tira dele a data na versão `coordenacao`, e nem a §7 nem o `docs/lgpd.md` dizem o que vale para esse papel. Há dois caminhos: escrever na §7 a regra para a coordenação, ou trocar a condição para `t.papel <> 'professor'` se a exclusão deve cobrir só o que a D64 cobre.
- Também continua aberto: na versão `coordenacao`, a linha do professor leva `introducao_vista_em: null`, quando antes a coluna nem vinha. Isso fica para o `/validar`.
