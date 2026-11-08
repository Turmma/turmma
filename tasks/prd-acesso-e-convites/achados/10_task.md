# Achados das revisões — `tasks/prd-acesso-e-convites/10_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-08 15:49:31 · `tasks/prd-acesso-e-convites/10_task.md`

VEREDITO: APROVADO
Tabelas verificadas: nenhuma tabela nova e nenhuma migration. `credencial_matricula` e `auditoria` já existiam e têm `escola_id`. Credencial e auditoria não variam por período, então `anoLetivoId` não se aplica. O teste "escola sem ano em curso" confirma que o fluxo não depende do ano letivo.
Queries verificadas:
- `CredencialMatriculaRepository.doAlunoAtivo`: o escopo vem de `requireEscolaId()`. Os novos `case when` da provisória vigente estão dentro do mesmo `where` de escola.
- `CredencialMatriculaRepository.paraATroca`: `requireEscolaId()`, mais `usuarioId`, papel `aluno` e `desativadoEm is null`. O join com `usuario` também passa por `escolaId`.
- `CredencialMatriculaRepository.trocarProvisoria`: `update` com `requireEscolaId()`, `usuarioId`, o vencimento do bilhete e a vigência.
- `AuditoriaRepository.provisoriasAnterioresDoAluno`: `requireEscolaId()`, `entidadeId` e a ação. Sem `@Unscoped`, e a porta única confere isso.
- `TrocaDaProvisoria.trocar` e `trocas`: escola e aluno vêm só do bilhete assinado. Rodam em `naEscolaSemUsuario({ escolaId })` com a escola do bilhete.
- O corpo de `trocar-senha` é `strict` e só aceita `senha`, então nenhum `escolaId` vindo do cliente decide leitura. Um bilhete na query não é aceito.
- Os claims do bilhete são `z.uuid()`.
- Toda falha responde `NAO_AUTENTICADO`: aluno de outra escola, aluno inexistente, provisória substituída ou vencida, aluno desativado, quem não é aluno e bilhete inválido.
- A camada de rede não é tocada. Nenhum `@Unscoped()` novo.

Teste de isolamento: presente e efetivo. Está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/troca-da-provisoria.int.test.ts`:
- Linhas 624 a 649: no contexto da escola A, usa os ids e a validade da B. Se a cláusula `escolaId` sair de `paraATroca`, de `trocarProvisoria` ou de `provisoriasAnterioresDoAluno`, a respectiva asserção (`toBeUndefined`, `toBe(false)`, `toEqual([])`) quebra. Fecha com um controle positivo no contexto da B.
- Linhas 684 a 695: um bilhete assinado com a escola A e o aluno da B dá 401 nas duas rotas.
- Linhas 278 a 292: a mesma matrícula em A e em B, e a provisória da A não abre a conta da B.
- Linha 670: sem escola no contexto, a leitura da auditoria é recusada com `InvariantException`.
- Os blocos de mutação de `10_task.md` cobrem a retirada de cada uma dessas cláusulas.

Bloqueantes: nenhum.
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/credencial/credencial-matricula.repository.ts:785`: `trocarProvisoria` confia que o `paraATroca` anterior já conferiu papel `aluno` e `desativadoEm is null`. Um `exists` com essas condições no próprio `update` fecharia a janela entre a leitura e a gravação, por defesa em profundidade. O escopo de escola já está garantido ali.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/auditoria/auditoria.repository.ts:1188`: a leitura usa o índice por escola até a 11.1 criar o índice parcial por alvo. Convém conferir na 11.1 que o plano da consulta passa a usar o índice novo.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-08 15:49:33 · `tasks/prd-acesso-e-convites/10_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa 10.0 não grava, não lê e não toca `Nota`, `Correcao` ou `lancadaPor` em caminho nenhum: API, seed de carga, k6 e importação ficam de fora. Todos com autor humano? Não se aplica, porque não há escrita.

Decisão autônoma sobre aluno: ausente. A tarefa troca a senha provisória do aluno, e quem faz a troca é ele mesmo, com o bilhete. Não há aprovação, reprovação nem encaminhamento.

Aprovação registrada: ok. Nenhuma saída de IA entra na tarefa. A gravação em `senha_provisoria.usada` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/login/troca-da-provisoria.service.ts:74`) é ato da própria pessoa, não aprovação de IA. Ela vai na mesma transação do `update` condicionado e não traz conteúdo.

Supervisão do tutor: ok. O tutor não é tocado.

Autonomia declarada e visível: sim. A tarefa não muda nenhuma declaração de agente.

Bloqueantes: nenhum.

Recomendações:
- A listagem `/trocas` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/auditoria/auditoria.repository.ts:68`) mostra ao aluno o papel de quem gerou cada provisória, sem nome. Isso segue a D85 e não é medição de professor (item 9). Mesmo assim, se um dia a coordenação puder ver por professor quantas provisórias cada um gerou, isso deve passar de novo pelo item 8 e pela D64. Hoje nada disso existe.
- O seed de carga (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/infra/scripts/carga-login.ts:575`) escreve direto em `credencial_matricula` e `conta_externa`, sem passar por repository. O dado é sintético e não é tabela de nota, então isso não pesa na regra 70. Fica só como registro para o `tenancy-guardian` e o `privacy-guardian`, que têm a palavra sobre isso.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-08 15:50:18 · `tasks/prd-acesso-e-convites/10_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

Bloqueantes: nenhum

As cinco subtarefas estão feitas: o bilhete, a etapa `trocar_senha`, as rotas `trocar-senha` e `/trocas`, a carga e os testes. Não há nada de 11.0 nem de 13.0. O [C] na fase `professores` e o cenário `redefinir` estão registrados na `techspec.md` §7c ("Onde roda o [C]") e no `cenarios.md` "Carga". As três divergências do `10_task.md` também estão na §5 e no `cenarios.md` RF13: a digitação normalizada da provisória, o contador compartilhado e a leitura de 60 registros até a 11.1. Nenhuma divergência ficou só no documento da tarefa.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tasks/prd-acesso-e-convites/tasks.md:71-75`: a 10.0 está marcada `[x]`, mas as subtarefas 10.1 a 10.5 seguem `[ ]`. O `10_task.md` as marca como feitas, e na 9.0 elas foram marcadas. Além disso, a 10.4 do `tasks.md` cita só `carga-login.ts`, sem a fase `professores` que a tarefa ampliou.
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tasks/prd-acesso-e-convites/techspec.md:118-119`: a §5 tem duas diferenças em relação ao código.
   - Ela diz "lista as 10 provisórias mais recentes", mas o código lista as 10 anteriores à atual, como pedem a §4 e o RF13.
   - Ela escreve `provisoria_expira_em > now()`, mas o código usa `clock_timestamp()`. A escolha está explicada só no `10_task.md`.
   Vale alinhar o texto da §5 com o código.
3. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/login/matricula.service.ts:168-170`: o `#chave` virou um repasse de uma linha para `chaveDaTentativa`. Dá para chamar a função direto.
4. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/login/troca-da-provisoria.service.ts:61-67,104-112`: este arquivo repete à mão o que o `PasswordVerifier` já faz: a reserva dentro do semáforo, o `contaSegurada` e o `falhou` a partir de `esperaSeFalharMs`. A diferença é que aqui o hash é gerado (`gerar`), e não conferido (`verificar`). Hoje está correto, mas há dois lugares para manter a mesma regra do contador. Um ajudante comum para "reservar, decidir e responder segurada ou inválida" evita que os dois se desencontrem.
5. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/auditoria/auditoria.repository.ts:527-528`: o `geracoes.indexOf(geracao) - 1` dentro do `map` funciona, mas o índice que o `map` já passa é mais claro, e evita a busca linear a cada item.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-08 15:51:08 · `tasks/prd-acesso-e-convites/10_task.md`

VEREDITO: APROVADO

**Campos pessoais tocados:**
- Nenhum campo novo e nenhuma migration.
- A tarefa lê `credencial_matricula.provisoria_hash` e `provisoria_expira_em` e anula `provisoria_gerada_por`. Essas colunas vêm da 9.0.
- Grava o registro de auditoria `senha_provisoria.usada`, com o aluno como autor e como alvo, e `antes`, `depois` e `finalidade` nulos.
- O bilhete (JWT de 10 min) leva só `escola_id`, `usuario_id` e `provisoria_expira_em`. Não leva hash, senha, matrícula nem nome.
- `/trocas` devolve só `geradaEm`, `papel` e `usada`, sem o autor (D85).

**Fora da tabela de dados do docs/lgpd.md:** nada. A linha 81 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/docs/lgpd.md` já cobre a provisória e `senha_provisoria.gerada` e `.usada`, com finalidade, base legal e retenção (vigência + 5 anos). O bilhete não é guardado em lugar nenhum.

**Autorização por objeto:** ok.
- A escola e o aluno vêm só do bilhete assinado, nunca do corpo nem da URL. Rodam em `naEscolaSemUsuario`, e o repository aplica `requireEscolaId()` em `paraATroca`, `trocarProvisoria` e `provisoriasAnterioresDoAluno`.
- O teste de trocar a escola no contexto, mantendo os ids da B, dá zero linhas, e o controle no contexto da B alcança.
- Os casos que podem acontecer, isto é, bilhete com a escola de outro, provisória substituída, provisória vencida, aluno desativado, eliminação agendada e quem não é aluno, respondem 401 `NAO_AUTENTICADO`, igual ao aluno inexistente.
- No login, matrícula inexistente, aluno só com a conta da escola e senha errada dão a mesma resposta. O espião confirma a sequência `fixo, fixo, guardado`.
- O 400 do `ZodValidationPipe` sai só com o código e não repete a senha.

**Logs:** limpos. Os arquivos novos e alterados não têm nenhum `logger` nem `console`.

**Auditoria:** presente. `senha_provisoria.usada` é gravado na mesma transação do `update` condicionado. Pelo teste, há um registro só, sem senha nem hash. A ação entrou em `A_PROPRIA_PESSOA` no `architecture.test.ts`. A leitura de `/trocas` é do próprio aluno e por isso não exige auditoria.

**Envio externo:** nenhum.

**Seed/fixture:** sintético.
- `carga-login.ts` e `carga-importacao.ts` usam escolas "Escola sintética", matrículas sintéticas, sujeito `carga-<uuid>`, e-mail `.invalid` e senhas sorteadas por execução, gravadas na pasta temporária.
- O teste de integração usa os montadores sintéticos.

**Bloqueantes:** nenhum.

**Recomendações:**
1. A pergunta de fechamento hoje é respondida em parte. `senha_provisoria.usada` já entra no arquivo do titular, porque o aluno é o autor. `senha_provisoria.gerada` fica de fora (`packages/core/src/titular/leitura-do-titular.ts:414`) até a 11.0 trazer a leitura por alvo, e a lgpd.md:81 já promete esse item. A 11.0 precisa fechar isso com um caso que mostre `.gerada` e `.usada` no arquivo do aluno.
2. `/trocas` pode ser lida quantas vezes se quiser nos 10 minutos do bilhete. O bilhete só sai a quem digitou a provisória certa e morre na troca, então o risco é baixo. Vale lembrar do limite por usuário dessa rota quando a 13.0 ligar a tela.

Rodei `bilhete-da-troca.test.ts`, `senha-provisoria.test.ts` e `porta-unica.test.ts` (16 testes) e `troca-da-provisoria.int.test.ts` (29 testes), e todos passaram.

Os arquivos principais:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/login/troca-da-provisoria.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/credencial/bilhete-da-troca.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/credencial/credencial-matricula.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/auditoria/auditoria.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/troca-da-provisoria.int.test.ts`

## infra-guardian · 1ª rodada · APROVADO · 2026-11-08 15:51:30 · `tasks/prd-acesso-e-convites/10_task.md`

```
VEREDITO: APROVADO
Caminho quente tocado: login
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
```

Não há bloqueantes. Ficam quatro recomendações, todas para a validação e a retro.

1. **`/trocas` lê a auditoria inteira da escola até a 11.1 entrar. Condição de pouso.**
   - Onde: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/auditoria/auditoria.repository.ts:73-75`.
   - O texto da tarefa diz que "a leitura é pequena", mas o `limit 60` só limita o que volta, não o que é lido. Como o aluno quase nunca tem 60 registros de `gerada` ou `usada`, o banco percorre todos os registros da escola até o fim, filtrando por `entidade_id`. O índice `auditoria_escola_em_idx (escola_id, em)` não ajuda nesse filtro.
   - `EXPLAIN ANALYZE` feito numa tabela temporária com 300 mil linhas de uma escola: o banco leu tudo, descartou 300.000 linhas pelo filtro e levou 76 ms. O custo cresce junto com a auditoria, que fica guardada pela vigência mais 5 anos. E um bilhete válido permite chamar `/trocas` até 3.000 vezes por minuto do mesmo IP.
   - O desvio está registrado na Tech Spec §5, e o índice parcial `(escolaId, entidadeId, em)` é a 11.1 desta mesma spec. Por isso não bloqueia agora. A spec não pousa sem a 11.1, e na auditoria da 11.1 o `EXPLAIN` desta consulta tem de mostrar o índice parcial em uso. O filtro `acao in ('senha_provisoria.gerada','senha_provisoria.usada')` precisa estar contido no predicado do índice, que cobre as seis ações.

2. **A rajada de carga não chama `/trocas`.**
   - Onde: `infra/k6/login-7h30.js`. O roteiro troca a senha, mas não lê a lista.
   - Quando a 13.0 ligar a tela, inclua o `GET /v1/sessao/matricula/trocas` no fluxo da provisória, de preferência já com a 11.1. Assim a leitura fica medida sob carga.

3. **As duas rotas novas contam no balde anônimo comum por IP, com teto de 3.000 por minuto.**
   - Onde: `apps/api/src/sessao/login/matricula.controller.ts:55`.
   - O login conta num balde próprio, que não recusa por IP (`rl:ip-login`). Já `trocar-senha` e `/trocas` caem no `rl:ip`, junto com a página de acesso da escola. Um script atrás do NAT da escola que esgote esse balde deixa a turma parada entre o login e a troca.
   - Não é regressão: a página de acesso já sofre o mesmo, o teto foi aceito como precedente (achado da 13 na identidade) e o `trocar-senha` também conta no contador da conta.
   - Vale avaliar contar as duas rotas também por `usuario_id` do bilhete, ou dar a `trocar-senha` o mesmo tratamento do login, que só rebaixa e não recusa.

4. **A troca não confere de novo se o aluno foi desativado ou teve a eliminação agendada.**
   - Onde: `apps/api/src/credencial/credencial-matricula.repository.ts`, no `update` de `trocarProvisoria`. A checagem fica em `paraATroca`, antes do hash.
   - O risco é pequeno: o `desativar` anula a provisória, então o `update` grava zero linhas, e a guarda de sessão lê `desativadoEm` e `eliminacaoAgendadaEm` a cada requisição.
   - Para fechar no banco, junte `exists (usuario ativo, sem eliminação agendada)` ao `where` do `update`.

O que ficou de pé:
- **Concorrência:** a troca é um `update` que só grava se a provisória ainda é a do bilhete e ainda vale, na mesma transação que grava o `.usada`. Há teste [P] com trava real no banco: um 200 e um 401.
- **Contador da conta:** é o mesmo do login (escola mais matrícula), guardado no Redis.
- **Hash:** passa pelo semáforo do argon2 por escola, e o 503 de quem esperou demais não conta como tentativa.
- **Duas instâncias:** nada fica em memória da instância.
- **Carga:** a rajada exige zero 429 e zero 503 por grupo, já com as 60 provisórias e as 30 contas só da escola.
- **Métrica:** as rotas novas são medidas pela métrica HTTP de toda rota (`http.server.request.duration`), e a tarefa não cria alerta novo.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-08 15:52:37 · `tasks/prd-acesso-e-convites/10_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Caminho feliz:** o login com a provisória devolve o bilhete; a troca grava a senha nova, anula as três colunas e abre a sessão com `no-store`; a lista `/trocas` traz as anteriores.
- **Bordas:**
  - a provisória como a tela a mostra (com hífen, em minúsculas, com espaços);
  - vencimento em 24 h (23 h59 entra, 24 h01 não);
  - a senha do aluno vale sozinha;
  - bilhete de provisória substituída;
  - bilhete emitido antes do vencimento e usado depois;
  - aluno desativado, eliminação agendada, credencial de quem não é aluno;
  - autor da geração eliminado;
  - 12 anteriores, 70 registros de outra ação, uso anterior à geração;
  - escola sem ano em curso;
  - matrícula igual em A e B.
- **Permissão:** sem bilhete, bilhete na query, token de acesso usado como bilhete, desafio e bilhete de convite usados como bilhete, `typ` e `aud` testados um de cada vez.
- **Isolamento:** o contexto da A com os ids da B no repository, o bilhete da A com o aluno da B, `requireEscolaId`.
- **Privacidade:** matrícula inexistente, aluno só com conta da escola e senha errada dão a mesma resposta, com espião no hash.
- **Contador (regra 80, item 1):** a troca usa o mesmo contador do login, a troca certa o zera, e o dispositivo `conhecido` não é segurado.
- **[P]:** duas trocas com o mesmo bilhete, em paralelo de verdade.
- **[C]:** a fase `professores` com a rajada e o redefinir.
- **Regra 80:** o hash da senha nova passa pelo semáforo do argon2, e o 503 não conta como falha.

**Cobertos:** todos os itens da tabela "Testes que provam a regra" têm o teste citado pelo nome e existem.
- `npx vitest run` passou: 29/29 em `apps/api/test/troca-da-provisoria.int.test.ts` e 9/9 nos dois arquivos de unidade.
- O [P] usa `WriteBlockTrigger` com `esperarNaTrava(…, 2)`: as duas trocas estão no `update` ao mesmo tempo.
- O isolamento troca a escola do contexto e tem o controle no contexto da B.
- As asserções olham o banco, o `argon2.verify`, as sessões, a auditoria e os cabeçalhos.
- Não há `.skip`, nem provedor de IA, nem mock que esconda a regra. Os espiões medem chamadas, não tempo.

**Bloqueantes:**

1. **`apps/api/src/sessao/login/troca-da-provisoria.service.ts:61`: a troca passa pelo semáforo, e isso não tem teste nem bloco de mutação.** O `semaforo.executar(escolaBucket(escolaId), …)` põe o hash da senha nova no semáforo do argon2 e conta a tentativa depois da vez. O docblock (linhas 41-42) afirma "o 503 de quem esperou demais não conta" (regra 80), e a Autoconferência, item 12, cita "o hash pelo semáforo, o 503 que não conta". Se o código chamasse a tarefa direto, sem o semáforo, todos os testes continuariam verdes.
   - Correção: copiar o padrão de `apps/api/test/senha-provisoria.int.test.ts:362` e `:583`.
   - (a) Um espião em `HashBulkhead.executar` durante uma troca que vale: uma chamada, com o balde da escola do bilhete.
   - (b) `mockRejectedValue(new DomainException(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO))` numa troca: responde 503, e depois são precisas cinco falhas inteiras para dar 429 (o 503 não contou).
   - Mais um bloco ` ```mutacao ` para cada uma: tirar o `semaforo.executar`, e chamar `contador.reservar` antes da vez.

2. **`apps/api/src/credencial/credencial-matricula.repository.ts:85`: as duas condições de `provisoriaVale` em `paraATroca` não têm bloco.** São a igualdade `provisoria_expira_em = doBilhete` e o `PROVISORIA_VIGENTE`. A Autoconferência, item 1, fala em "os quatro termos do where", mas esses são do `where`. As duas condições que decidem se o bilhete vale ficaram sem bloco, e cláusula nova sem bloco é bloqueante por si.
   - Pela leitura do código, os testes que já existem pegam as duas: "bilhete de uma provisória que outra geração substituiu" (o espião em `gerar`) e "borda: bilhete emitido 5 min antes…", linha 383 (`trocas` com 401).
   - Correção: dois blocos ` ```mutacao `, um que tira cada condição.
   - Na mesma linha de raciocínio, `:113` (`gravadas.length === 1`) também não tem bloco. Ponha um, com o teste "repository: a troca só grava a provisória do bilhete…".

3. **`apps/api/src/credencial/bilhete-da-troca.ts:57-58`: o `typ` e o `audience` do `jwtVerify` não têm bloco.** São o centro da 10.1: `typ` e `aud` próprios, provados um de cada vez. O teste existe ("permissão: o `typ` do bilhete com a `aud` do desafio…") e ficaria vermelho, mas a seção "Mutações" não traz a mutação.
   - Correção: um bloco que tira `typ: TIPO_DO_BILHETE_DA_TROCA` e outro que tira `audience: AUDIENCIA_DO_BILHETE_DA_TROCA`, os dois com esse teste.
   - Para `issuer` e `requiredClaims` (linhas 59-60): um bloco, ou a linha com o motivo na lista do fim da seção.

**Recomendações:**
- O nome do teste "permissão: sem o bilhete, com o bilhete só na query, ou com bilhete de outro tipo" (`troca-da-provisoria.int.test.ts:355`) promete "bilhete de outro tipo", mas o corpo só manda `'nao-e-um-jwt'`. Mande o desafio de login e o bilhete do convite para as duas rotas, ou tire a expressão do nome.
- O [P] do `cenarios.md`, linha 140, cita "bilhete de provisória já substituída" e hoje só tem prova em sequência, no repository. Uma corrida de verdade fortaleceria: gerar e trocar ao mesmo tempo, com barreira entre o `paraATroca` e o `update`.
- "O `.usada` vai na mesma transação da troca" (Tech Spec §5) não tem prova. Se a gravação da auditoria fosse para depois do `commit`, nenhum teste ficaria vermelho. Faltam um teste e um bloco: um gatilho que recusa o insert em `auditoria` e a senha que não muda.
- A ordem do login: o `ACESSO_SUSPENSO` vem antes da emissão do bilhete. Hoje é a ordem das linhas que garante isso. Um caso de login com a provisória e a eliminação agendada (sem bilhete, `ACESSO_SUSPENSO`) a fixaria.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-08 17:52:34 · `tasks/prd-acesso-e-convites/10_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration nesta tarefa. Foram lidas `credencial_matricula`, `usuario` e `auditoria`, e as três têm `escolaId`. Nenhuma delas varia por período: a credencial é da escola e não do ano, e há teste da escola sem ano em curso. Todos os ids são UUID.

Queries verificadas:
- `CredencialMatriculaRepository.trocarProvisoria`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/credencial/credencial-matricula.repository.ts:120-149`. A escola vem de `requireEscolaId()`. O `exists` novo prende o usuário à escola e ao id da própria linha da credencial, e a linha já está limitada à escola do contexto. Ele não abre caminho para outra escola.
- `paraATroca` e `doAlunoAtivo`, no mesmo arquivo, nas linhas 70-113: inalteradas. A escola vem do contexto e o join exige escola e id juntos.
- `AuditoriaRepository.provisoriasAnterioresDoAluno`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/auditoria/auditoria.repository.ts:68-88`. Mudou só a forma de achar a geração seguinte (`geracoes[indice]`, que dá o mesmo resultado que antes). O filtro `requireEscolaId()` + `entidadeId` + ação continua.
- `TrocaDaProvisoria.trocar` e `trocas`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/login/troca-da-provisoria.service.ts`. A escola e o aluno vêm só do bilhete assinado, dentro de `naEscolaSemUsuario`. O controller lê só o `Authorization`. Nenhum `escolaId` vem do corpo nem da query.
- `matricula.service.ts`: a suspensão é conferida antes de o bilhete ser emitido (linha 131). O resto da mudança só troca o nome do ajudante da chave.

Teste de isolamento: presente e efetivo.
- O caso "isolamento › com o contexto da escola A…", em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/troca-da-provisoria.int.test.ts:701-726`, cobre o filtro de escola. Sem `eq(credencialMatricula.escolaId, …)` no `update`, a troca da B feita no contexto da A gravaria e devolveria `true`. Isso acontece porque o `exists` acompanha a escola da própria linha, onde o aluno da B está ativo. O teste quebra na linha 719.
- O caso novo "repository: a troca não grava se o aluno foi desativado…" cobre o `exists` novo. Ele cria outro aluno ativo na escola, então tirar o filtro por aluno também quebra o teste.

Erro sem revelar existência: aluno de outra escola, aluno desativado, aluno que não é aluno, provisória substituída ou vencida e aluno com eliminação agendada na troca recebem a mesma resposta, `NAO_AUTENTICADO`. O `ACESSO_SUSPENSO` só aparece no login, e só com a senha certa, como já era antes.

Camada rede: não é tocada. `@Unscoped()`: nenhum.

Bloqueantes: nenhum.

Recomendações:
- No `exists` de `trocarProvisoria` (`credencial-matricula.repository.ts:137`), a escola pode ser presa também a `requireEscolaId()` em vez de só à coluna da linha externa. Não muda nenhum resultado hoje, mas deixa o escopo legível na própria subconsulta, como a regra 10, item 3, pede.
- Continua valendo o que ficou da 1ª rodada: conferir na 11.1 que `provisoriasAnterioresDoAluno` passa a usar o índice parcial por alvo.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-08 17:52:35 · `tasks/prd-acesso-e-convites/10_task.md`

VEREDITO: APROVADO

Esta rodada conferiu o diff desde a 1ª (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/.processo/ordens/diff-10_task-r2.txt`) e releu o código atual da tarefa pela regra 20. A 1ª rodada não exigiu correção, e nada do que mudou abre furo novo.

Campos pessoais tocados: nenhum campo novo. A tarefa usa `credencial_matricula` (o hash e a validade da provisória, quem a gerou) e `usuario` (desativação e eliminação agendada) só para filtrar.

Fora da tabela de dados do docs/lgpd.md: nada. A senha provisória e os registros `.gerada` e `.usada` estão em `docs/lgpd.md:81`, com finalidade e retenção.

Autorização por objeto: ok.
- **Escola e aluno:** vêm do bilhete assinado, nunca do corpo nem da URL.
- **O `update` da troca agora confere o aluno** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/credencial/credencial-matricula.repository.ts:131-144`). Ele exige, no próprio `update`, que a pessoa seja aluno, esteja ativa e não tenha eliminação agendada. Isso fecha a janela entre a leitura (`paraATroca`) e a gravação. O caso "repository: a troca não grava se o aluno foi desativado…" prova os três motivos de recusa, com outro aluno ativo na mesma escola. Assim, o teste quebraria se a ligação ao aluno certo caísse.
- **Respostas iguais:** "não encontrado" e "sem permissão" continuam dando o mesmo `NAO_AUTENTICADO`.
- **Aluno com eliminação agendada:** com a provisória certa, ele recebe `ACESSO_SUSPENSO` sem bilhete, sem cookie e sem sessão. Novo teste em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/troca-da-provisoria.int.test.ts:211`.

Logs: limpos. Nenhum `logger` ou `console` nos arquivos alterados, e o docblock do service diz que senha, bilhete e matrícula não vão a log.

Auditoria: presente.
- O `senha_provisoria.usada` tem o aluno como autor, não leva senha e vai na mesma transação da troca.
- Agora isso tem prova: um gatilho recusa o registro, e o teste confere que a senha não muda e nenhuma sessão nasce (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/troca-da-provisoria.int.test.ts:351`).
- A correção do índice em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/auditoria/auditoria.repository.ts:79-80` não muda o que a lista expõe. `/trocas` continua devolvendo só a data, o papel de quem gerou e se foi usada, sem o autor (D85), por um schema `strict`.

Envio externo: nenhum. Não há IA nesta tarefa.

Seed/fixture: sintético. Os testes e os roteiros de carga usam UUIDs e matrículas geradas.

Pergunta de fechamento: responde. Os registros `.gerada` e `.usada` ficam na auditoria do aluno, com retenção declarada. A entrada deles no arquivo do titular é trabalho da 11.0, já previsto.

Bloqueantes: nenhum.

Recomendações:
- Mantenho da 1ª rodada: a 11.0/11.2 precisa de um caso que mostre `.gerada` e `.usada` no arquivo do titular do aluno, como `docs/lgpd.md:81` promete.
- Mantenho da 1ª rodada: quando a 13.0 ligar a tela, `/trocas` precisa de limite por usuário, porque pode ser lida várias vezes nos 10 min do bilhete.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-08 17:52:36 · `tasks/prd-acesso-e-convites/10_task.md`

VEREDITO: APROVADO
Caminho quente tocado: login
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum

Esta rodada conferiu o diff `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/.processo/ordens/diff-10_task-r2.txt` e reler os pontos do caminho quente na árvore atual.

- **Rate limit.** `trocar-senha` conta no mesmo contador da conta que o login, com a chave escola mais matrícula (`chaveDaTentativa`). Um teste novo prova que o 503 do semáforo cheio não conta como tentativa: depois de seis recusas por 503, ainda são precisas cinco falhas para segurar a conta.
- **Hash.** O hash do argon2 corre dentro do `HashBulkhead`, no balde da escola do bilhete, e há teste para isso. A recusa de aluno com eliminação agendada vem antes do hash e antes do `update`; o teste confere que nenhum dos dois é chamado.
- **Concorrência.** A troca é um `update` condicionado, sem ler antes de gravar. Ele confere a provisória do bilhete, a validade por `clock_timestamp()` e agora também, no próprio `update` (`exists`), se o aluno ainda é aluno, está ativo e não tem eliminação agendada. Isso fecha a janela entre o `paraATroca` e a gravação. A condição usa o índice único de `usuario` por escola e id, então não pesa. O `senha_provisoria.usada` grava na mesma transação da troca, e um teste com gatilho prova que, se ele falha, a troca é desfeita e a mesma troca vale depois. Continua o teste [P] de duas trocas com o mesmo bilhete.
- **Índice.** O `update` usa o índice único `credencial_matricula_usuario_unico` (escola, usuário). A leitura de `/trocas` tem dois limites: 60 registros lidos e 10 devolvidos.
- **Login de matrícula.** A mudança em `matricula.service.ts` só tira um método auxiliar. A recusa por eliminação agendada vem antes de emitir o bilhete, e há teste para isso.

Recomendações:
- **Índice de `/trocas` (vem da 1ª rodada).** `/trocas` lê `auditoria` pelo índice da escola até a tarefa 11.1 criar o índice parcial por alvo. No pouso, o `EXPLAIN` de `provisoriasAnterioresDoAluno` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/auditoria/auditoria.repository.ts` precisa mostrar o uso desse índice parcial.
- **Limite por usuário (vem da 1ª rodada).** `trocar-senha` e `/trocas` só passam pelo balde anônimo por IP (`rl:ip`). Vale contar também pelo `usuario_id` do bilhete quando a 13.0 ligar a tela. Já está no `TODO.md`.
- **Teste de carga (vem da 1ª rodada).** Incluir `GET /v1/sessao/matricula/trocas` na rajada do `infra/k6/login-7h30.js` quando a 13.0 ligar a tela.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-08 17:53:03 · `tasks/prd-acesso-e-convites/10_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. Esta tarefa não grava em `Nota`. Ela troca a senha provisória do aluno, mexe em `credencial_matricula`, na auditoria (`senha_provisoria.usada`) e no roteiro de carga. Procurei nos arquivos alterados e no diff da rodada 2 por `nota`, `lancadaPor`, LLM, tutor, agente, ranking, indicador e inferência emocional, e não há nada disso. Todos com autor humano? Não se aplica (n/a), porque não há caminho de escrita em Nota.
Decisão autônoma sobre aluno: ausente. Recusar a troca de senha de um aluno desativado, com eliminação agendada ou que não é aluno é uma regra de acesso, não uma decisão sobre a trajetória dele.
Aprovação registrada: ok. Nenhuma saída de IA é produzida nesta tarefa.
Supervisão do tutor: ok. A tarefa não toca no tutor.
Autonomia declarada e visível: sim, sem mudança. A tarefa não altera nenhum agente nem a governança.

Bloqueantes: nenhum.

Conferência da rodada 2. A rodada 1 não exigiu correção; ela caducou só porque o código mudou depois. O que mudou desde então:
- **Repository da troca** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/credencial/credencial-matricula.repository.ts:130-144`): a gravação da senha nova agora só acontece se, no mesmo instante, a pessoa ainda for aluno ativo e sem eliminação agendada. É controle de acesso, não toca na regra 70, e o teste "repository: a troca não grava se o aluno foi desativado…" prova os casos.
- **Login de matrícula** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/login/matricula.service.ts`): só um método privado foi trocado pela função que ele chamava. Não muda o comportamento.
- **Lista das provisórias anteriores** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/auditoria/auditoria.repository.ts:79-80`): a geração seguinte passou a ser achada pela posição na lista, e não mais procurando o item. O resultado é o mesmo e fica certo mesmo com dois registros repetidos. A lista continua mostrando só o papel de quem gerou, nunca o nome (D85).
- **Testes novos** em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/troca-da-provisoria.int.test.ts` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/credencial/bilhete-da-troca.test.ts`: provam que a troca e o registro `.usada` vão na mesma transação, o semáforo do hash, o aluno suspenso no login e a recusa de bilhete de outro emissor ou sem validade. Reforçam a auditoria e o isolamento, sem tocar na regra 70.
- **Documentos** (`techspec.md` §5, `tasks.md`, `10_task.md`): passam a dizer o que o código faz e não introduzem nada que a regra 70 vede.

Releitura da tarefa inteira pela regra 70:
- **Itens 1 e 2a:** a tarefa não toca em nota nem em discursiva ou redação.
- **Item 6, auditoria:** o `senha_provisoria.usada` é gravado com o aluno como autor e sem senha (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/auditoria/acoes.ts:199-209`).
- **Item 7, supervisão sem vigilância:** a tarefa não mede tempo, navegação nem comportamento do aluno.
- **Itens 8 e 9, medir o professor:** a tarefa não cria nenhuma métrica ou lista de professor visível à coordenação. A lista das provisórias anteriores vai só ao próprio aluno, com o papel de quem gerou e sem o autor.
- **Item 4b, sair não é mais difícil que entrar:** a tarefa é só API e não tem tela; a troca é um único pedido.

Não houve fotos da tela: a tela é da tarefa 13.0.

Recomendações:
- Mantenho o aviso da rodada 1: se uma tela futura deixar a coordenação ver, por professor, quantas provisórias cada um gerou, ela passa pelo item 8 da regra 70 e pela D64. Hoje nada disso existe.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-08 17:53:04 · `tasks/prd-acesso-e-convites/10_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. A §5 da `techspec.md` agora descreve o que o código faz. `/trocas` lista as 10 provisórias anteriores à que o aluno acabou de usar. O `update` compara com `clock_timestamp()` e confere o aluno ativo com um `exists`, prova de que ele ainda é aluno, não foi desativado e não tem eliminação agendada. O `cenarios.md`, nas linhas 128 e 129 ("com 12 anteriores, traz as 10 mais recentes"), continua batendo com o código. A nova linha em "Divergências resolvidas" (`10_task.md:112`) só ajusta o texto da Tech Spec ao código. Não muda nenhum cenário.

Portão local: carimbo válido para o código atual (typecheck, lint, segredo, dependências, unidade, alvo).

Bloqueantes: nenhum.

O diff desta rodada, conferido:
- **Recomendações da rodada 1:**
  - O `#chave` saiu de `matricula.service.ts`, que agora chama `chaveDaTentativa` direto.
  - O `geracoes.indexOf` virou `geracoes[indice]` em `auditoria.repository.ts`. Com o `slice(1, …)`, o item `indice` do `map` é `geracoes[indice + 1]`, então `geracoes[indice]` é mesmo a geração seguinte, a mais nova.
  - O `tasks.md` tem as subtarefas da 10.0 marcadas.
  - A §5 da `techspec.md` foi corrigida.
- **Repository:** em `credencial-matricula.repository.ts:131-144`, o `exists` no `update` fecha a janela entre o `paraATroca` e a gravação. Ele cruza a escola e o id da própria linha da credencial, e o `requireEscolaId()` continua no `where` de fora. O docblock da linha 118 diz o que o código faz.
- **Testes novos:** cobrem o semáforo com o balde da escola do bilhete, o 503 que não conta como tentativa e o `.usada` na mesma transação, provado com um gatilho que recusa o registro. Cobrem também o login de aluno com eliminação agendada, que dá `ACESSO_SUSPENSO` antes do bilhete, e o `exists` linha a linha, com outro aluno ativo na mesma escola. No `bilhete-da-troca.test.ts`, entram o emissor trocado e o bilhete sem `exp`. Não há `.skip`, `any` nem `TODO` nos arquivos da tarefa.
- **Ordem no login:** em `matricula.service.ts`, o `suspenso` é conferido antes da etapa `trocar_senha`, que é o que o caso novo prova.

Recomendações:
- `10_task.md:112-113`: há uma linha em branco sobrando antes de "## Mutações". A coluna "Onde está na spec" da linha nova cita só a `techspec.md`. Para quem ler depois, vale dizer que o `cenarios.md` não precisou mudar.
- O teste do gatilho em `apps/api/test/troca-da-provisoria.int.test.ts` põe o `escolaId` direto no texto do `create trigger`. O id vem da fixture, então o risco é nulo, mas um comentário dizendo de onde ele vem evita que o padrão seja copiado para outro lugar.

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tasks/prd-acesso-e-convites/10_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/login/troca-da-provisoria.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/credencial/credencial-matricula.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/login/matricula.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/auditoria/auditoria.repository.ts

## test-engineer · 2ª rodada · APROVADO · 2026-11-08 17:54:26 · `tasks/prd-acesso-e-convites/10_task.md`

VEREDITO: APROVADO

Cenários exigidos: os três bloqueantes da 1ª rodada, cada um com teste e bloco de mutação. Também conferi as recomendações que a Mesa mandou aplicar e reli a tarefa inteira na árvore de agora:
- **Caminho feliz:** o login com a provisória devolve o bilhete; a troca grava a senha nova e abre a sessão; `/trocas` lista as anteriores.
- **Bordas:** bilhete de uma provisória substituída ou vencida; provisória digitada com hífen, minúsculas ou espaços; vencimento em 24 h; aluno desativado, com eliminação agendada ou que não é aluno; escola sem ano em curso.
- **Permissão:** `typ`, `aud`, `iss` e `exp` do bilhete; desafio, bilhete de convite e token de acesso trocados entre si; bilhete fora do `Authorization`.
- **Isolamento:** contexto da escola A com os ids da escola B; bilhete com a escola de outro aluno; mesma matrícula em A e B.
- **Concorrência:** duas trocas com o mesmo bilhete em paralelo de verdade (`WriteBlockTrigger` + `esperarNaTrava`).
- **Carga:** a fase `professores` com a rajada ao lado.

Cobertos:
1. **Semáforo** (`troca-da-provisoria.service.ts:61`), feito.
   - "o hash da senha nova passa pelo semáforo do argon2…" (`troca-da-provisoria.int.test.ts:547`): um espião no `HashBulkhead` que vem da injeção de dependências; confere uma chamada só, com `escolaBucket(s.escolaId)`.
   - "o 503 de quem esperou demais…" (`:558`): `mockRejectedValue(new DomainException(INDISPONIVEL_TENTE_DE_NOVO))`, seis respostas 503 com o código certo; depois do `mockRestore`, quatro 401 e a quinta é 429 `CONTA_SEGURADA`.
   - Dois blocos de mutação (`10_task.md:657-675`): um troca o semáforo por um que só repassa, o outro reserva antes da vez. Os dois chegam à cláusula. Não depende de a máquina estar folgada, porque o 503 é simulado.
2. **Repository**, feito.
   - `paraATroca`: um bloco tira a igualdade (cai em `gerarHash` não chamado, no caso do bilhete de provisória substituída) e outro tira o `PROVISORIA_VIGENTE` (cai em `/trocas` 401, na borda dos 5 min) (`10_task.md:700-714`).
   - `gravadas.length === 1 → true`: cai no teste "repository: a troca só grava a provisória do bilhete" (`:716-722`).
   - O `exists` novo no `update` tem quatro blocos: aluno, papel, desativação e eliminação agendada. O teste `:747` cria outro aluno ativo na mesma escola, e é isso que faz o bloco do `usuario.id` ficar vermelho.
   - O `eq(usuario.escolaId, …)` ficou sem bloco, com motivo: é redundante com a chave estrangeira composta. Aceito.
3. **Bilhete**, feito. Há um bloco para `typ`, um para `audience`, um para `issuer` e um para `requiredClaims` (`10_task.md:759-789`). O teste novo "assinado por nós mas de outro emissor, ou sem `exp`" (`bilhete-da-troca.test.ts:76`) cobre os dois últimos.
4. **Recomendações aplicadas:**
   - Teste renomeado para "com texto que não é bilhete". A tabela agora aponta onde cada token alheio está provado.
   - Login suspenso antes do bilhete: teste `:211` e bloco `matricula.service.ts:131`.
   - `.usada` na mesma transação: teste `:351`, com um gatilho só para a escola do teste e restauração no `finally`; o bloco tira o registro da transação.
   - Os espiões novos no teste `:452` provam que a recusa vem antes do hash e do `update`.
5. **Tabela de testes:** cada linha da tabela, inclusive as quatro novas, tem o teste citado pelo nome, e todos existem.
6. **O que rodei:** a unidade (2 arquivos, 10 testes) e a integração (34 testes) estão verdes. O `mutacoes.ts --faltando` lista só duas linhas, e as duas têm motivo escrito na seção. Não há `.skip`, `.only` nem teste comentado. O `afterEach` chama `vi.restoreAllMocks()`, então nenhum espião vaza para o teste seguinte.

Bloqueantes: nenhum.

Recomendações:
- `apps/api/test/troca-da-provisoria.int.test.ts:361`: o `toBeGreaterThanOrEqual(500)` aceita qualquer 5xx. É mais firme cobrar 500 com o código de erro tipado e sem stack no corpo (regra 20, item 11).
- `apps/api/test/troca-da-provisoria.int.test.ts:156-158`: o `create trigger` em `auditoria` pega trava na tabela compartilhada. Hoje é breve, mas outros arquivos de integração que inserem auditoria em paralelo esperam por ela. Se aparecer oscilação na esteira, vale isolar o teste num arquivo próprio.
- A corrida de verdade entre gerar e trocar continua no `TODO.md`, como registrado. Hoje o `exists` no `update` fecha a janela do aluno desativado ou suspenso, e a igualdade do vencimento fecha a da provisória substituída. A prova em paralelo seria reforço, não lacuna.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/sessao/login/troca-da-provisoria.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/credencial/credencial-matricula.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/credencial/bilhete-da-troca.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/test/troca-da-provisoria.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/apps/api/src/credencial/bilhete-da-troca.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tasks/prd-acesso-e-convites/10_task.md
