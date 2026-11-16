# Achados das revisões — `tasks/prd-reengenharia-continuacao/14_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-15 21:26:55 · `tasks/prd-reengenharia-continuacao/14_task.md`

VEREDITO: APROVADO

Tela vista: não. O prompt traz as fotos como indisponíveis, porque a vitrine não força o 503 e a coordenação dela tem uma escola só. Revisei pelo código, pelo diff e pelo e2e, que cobre os três casos a 1366 × 768 e a 360 px. Não tentei a vitrine de novo. Rodei os testes de unidade `espera-do-indisponivel.test.ts` e `SeletorDeEscola.test.tsx`: 23 passam. O e2e não rodei, li o código dele. A tela será vista na validação.

Estados: ok.
- Carregando: botão em "Entrando…", e "Abrindo …" na linha do seletor.
- Erro: o `ErrorState` no segundo 503 ou com `Retry-After` acima de 10 s. A mensagem sai do catálogo: "O sistema está indisponível no momento. Tente de novo em instantes." Os outros erros seguem com a mensagem de sempre.
- Vazio e com dado: não mudam nesta tarefa.

Acessibilidade: ok.
- `role="status"` já existe antes do texto, então a mudança é anunciada.
- A contagem fica em `aria-hidden`, e o leitor de tela ouve só "Tentando de novo em instantes".
- O foco volta ao botão da escola ou do "Entrar" depois da falha, e o `Mfa` só o move se o foco foi parar no `body`.
- O campo mantém o rótulo.
- O `ErrorState` fica separado do `role="alert"`, e `Button` tem `type="button"` por padrão, então "Tentar de novo" não envia o formulário do `Mfa`.
- O e2e roda o axe nos três casos.

Chromebook fraco: sem impacto. A espera é um `setInterval` de 1 s, sem laço. O piso de 1 s (`ESPERA_MINIMA_NO_503_MS`) e o limite de uma espera por tentativa evitam que a escola inteira martele a rota às 7h30.

Celular: ok pelo código e pelo e2e.
- O e2e mede `paginaNaoRola`, 44 px na ação principal e axe nos dois projetos.
- A lista de escolas é a que já existia e não mudou.
- Não há hover nem atalho.
- O aviso e a falha do seletor foram movidos para logo abaixo do botão da escola, antes da lista. Assim ficam à vista na lateral que rola, e o e2e confirma com `toBeInViewport`.
- Nenhum fluxo exige o celular.

Ação oficial protegida: sim. Nenhuma ação oficial foi criada ou alterada. A repetição só sai para a mesma pessoa e o mesmo desafio, e a resposta atrasada é descartada (`DESCARTADA`, `aindaVale`). A pessoa seguinte do computador não herda o código nem a escolha de quem saiu.

Bloqueantes: nenhum.

Recomendações:
1. `apps/web/src/components/SeletorDeEscola.tsx:187`: a lateral tem 256 px e o `ErrorState` ganha `p-4` e borda de 2 px dentro dela. Como o e2e só mede `paginaNaoRola`, vale conferir na validação, a 360 px, se a mensagem e o botão "Tentar de novo" não ficam apertados.
2. `apps/web/src/pages/espera-do-indisponivel.ts`: o `AvisoDaEspera` mora num `.ts` com `createElement`. A justificativa (complexidade do lint e nenhuma peça nova no catálogo) está registrada na tarefa. Se a peça ganhar um quarto uso, migrar para `.tsx`.
3. Na validação, olhar com os próprios olhos `/entrar` no segundo fator e na escolha de escola com o aviso visível, a 360 px e a 1366 px. Aqui só o e2e as mediu.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/pages/espera-do-indisponivel.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/pages/Mfa.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/pages/EscolherEscola.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/components/SeletorDeEscola.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/entrar-na-escola.spec.ts`

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-15 21:27:24 · `tasks/prd-reengenharia-continuacao/14_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A tarefa muda só o código de erro do desafio quando o Redis está fora (401 passa a 503 `INDISPONIVEL_TENTE_DE_NOVO` com `Retry-After`) e a espera única na web. Não há migration, coluna nova nem DTO de saída novo.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/sessao/troca-de-escola/troca-de-escola.service.ts` o `conferirLivre` roda antes de `#destinoDaConta`. Por isso, com o Redis fora, o `usuarioId` de outra conta, o inexistente e o da própria escolha recebem o mesmo 503, com o mesmo corpo tirando o `requisicaoId`. Isso não confirma que o registro existe (regra 10, item 6). O teste está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/test/troca-de-escola.int.test.ts:716-755`, e a mutação que tira o `conferirLivre` derruba esse caso. Com o Redis no ar, o caminho não mudou.

Logs: limpos. A linha `login.desafio_sem_redis` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/credencial/challenge.ts:151`) leva só o evento, e no máximo uma vez a cada 30 s. O teste conta uma linha para sete recusas, e o caso de privacidade no fim do `mfa.int.test.ts` confere que nenhum segredo vai para o log. O novo 503 passa pelo ramo `>= 500` do `AllExceptionsFilter`, que registra só `summarizeError` (tipo e pilha, sem mensagem e sem corpo da requisição). O corpo devolvido ao cliente é o envelope tipado com a mensagem do catálogo, sem pilha.

Auditoria: não se aplica. A tarefa não tem leitura de dado de aluno, exportação, nota, permissão nem aprovação de saída de IA.

Envio externo: nenhum.

Seed/fixture: sintético. O e2e usa `pessoa-sintetica@escola.invalid`, "Colégio Sintético A"/"Escola Sintética B", UUIDs fixos e `criarEquipeComSenha`. Os testes unitários usam nomes de escola genéricos.

Outras conferências:
- Web: o código do segundo fator e o desafio ficam só na memória do fechamento da tentativa, por no máximo 10 s, e nada vai para `localStorage` nem para a URL. A repetição é descartada se o desafio da aba muda ou se a pessoa do seletor muda (`aindaVale`). Assim, a pessoa seguinte no mesmo computador da escola não herda o código nem a escolha de quem saiu, e há teste disso em `espera-do-indisponivel.test.ts` e `SeletorDeEscola.test.tsx`.
- O `ErrorState` mostra só a mensagem do catálogo, sem `requisicaoId`, status ou texto da API.
- Fotos da tela: não vieram (a vitrine não força o 503). Pelo código e pelo e2e, a tela mostra só o nome da escola e da rede e o papel da própria pessoa, que já apareciam antes. Nenhum dado de aluno aparece.

Pergunta de fechamento: a tarefa não muda o que se guarda de um aluno nem para onde vai. O arquivo do titular continua respondendo como antes.

Bloqueantes: nenhum.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/components/SeletorDeEscola.tsx:99-104`: `falha` e `ultimaTroca` não são limpas quando `usuarioAtual` muda. O "Tentar de novo" do `ErrorState` que sobrou poderia mandar o `usuarioId` da pessoa anterior com a sessão da nova. A API já recusa com 404, porque a troca é presa à conta, então não há vazamento. Mesmo assim vale limpar os dois estados quando a pessoa muda, para não depender só da defesa do servidor. O mesmo vale para `ultima` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/pages/EscolherEscola.tsx:120` quando o desafio da aba muda.
2. O comentário de `ChallengeConsumer` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/credencial/challenge.ts:145` ainda diz "o coordenador que cai de volta ao login". Desde esta tarefa, a pessoa não volta mais ao login. Só o texto está desatualizado.

## infra-guardian · 1ª rodada · REPROVADO · 2026-11-15 21:27:46 · `tasks/prd-reengenharia-continuacao/14_task.md`

VEREDITO: REPROVADO
Caminho quente tocado: login
Rate limit: ok (o 503 vem de `conferirLivre`, antes da reserva do `LoginLockout`, e nenhum código é conferido com o Redis fora)
Fila e prioridade: ok (a tarefa não mexe em fila)
Concorrência: corrida em `apps/api/src/sessao/mfa/mfa.service.ts:156`
Índice e paginação: ok (não há query nova)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (`proporcaoDoSeguro` e `login.desafio_sem_redis` continuam; o runbook do "Seguro de limite ativo" foi atualizado)

Bloqueantes:

1. **`apps/api/src/sessao/mfa/mfa.service.ts:156`, junto com `apps/web/src/pages/Mfa.tsx:83-86`.** A tarefa promete que "nenhuma tentativa é gasta", e há um caminho em que isso falha.
   - **Como acontece:** o Redis responde ao `conferirLivre` e cai, ou passa dos 100 ms do `LOGIN_REDIS_PRAZO_MS`, no `consumir` de `#depoisDoCodigoCerto`. Nesse ponto o código certo já foi gasto: `avancarPassoDoMfa` gravou o passo, ou `usarCodigoDeRecuperacao` queimou o código de recuperação.
   - **O que a API devolve:** com esta tarefa, o `#semRedis` devolve 503 `INDISPONIVEL_TENTE_DE_NOVO` com `Retry-After: 5`. A reserva é desfeita nas linhas 121-122.
   - **O que a web faz:** `espera.executar(() => entrarComSegundoFator(pedido))` repete o mesmo `pedido` 5 s depois, com o mesmo código.
   - **O resultado:** com o Redis de volta, o servidor confere esse código, o passo já usado é recusado, a recusa entra no contador do `LoginLockout`, grava `login_falho`, e a tela diz "código incorreto" para um código certo. Com o código de recuperação, ele fica queimado sem a pessoa entrar.
   - **A contradição com o próprio código:** o comentário de `#depoisDoCodigoCerto` diz que nesse caso a pessoa "repete com o código seguinte do app". A repetição automática nova manda o mesmo código.
   - **Por que pesa às 7h30:** o runbook descreve exatamente o Redis travado acima de 100 ms. Num pico de latência, uma das duas idas ao Redis do mesmo pedido pode falhar e a outra não.
   - **Nenhum teste cobre isto:** os casos de 54.0 só derrubam o Redis antes do `conferirLivre`. O dublê atua em `exists`, nunca em `set`.
   - **Correção exigida:** o 503 que vem depois do código certo não pode levar a web a repetir o mesmo fator. Uma saída é a API não devolver `INDISPONIVEL_TENTE_DE_NOVO` com `Retry-After` quando o `consumir` falha depois do código conferido. Ela pode responder com uma recusa própria, que a tela mostre como "digite o próximo código", sem espera automática. A outra é desfazer o passo e o código de recuperação antes de o 503 subir. Escolha uma.
   - **Teste exigido:** em `apps/api/test/mfa.int.test.ts`, um caso de integração com `vi.spyOn(cliente, 'set')` lançando o `ReplyError` do `ioredis`, com o código certo. Ele prova que a repetição com o mesmo pedido não recebe "código incorreto" e não aumenta o contador do `LoginLockout`. Para o código de recuperação, prova que ele não é queimado sem entrar. Se a correção for só na web, o teste vai em `espera-do-indisponivel.test.ts`.
   - **Mutação:** um bloco na seção "Mutações" que tire a correção e aponte esse caso.

Recomendações:
- O `Retry-After` do desafio é sempre 5 s (`DEFAULT_RETRY_AFTER_SECONDS`, em `packages/core/src/error/domain.exception.ts:64`). Com a escola inteira caindo junto, todo mundo repete no mesmo segundo. Sortear o valor, como já faz `apps/api/src/credencial/senha/hash-bulkhead.ts:314` (2 a 6 s), espalha a única repetição. Com o Redis desconectado a recusa é barata, mas com o Redis travado cada repetição ainda espera até 100 ms.
- O caso de 54.0 em `apps/api/test/troca-de-escola.int.test.ts` poderia ter a mesma variante do "conectado e recusando" (`ReplyError` em `exists`) que o de MFA ganhou. Hoje a troca só é provada com o Redis parado.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/sessao/mfa/mfa.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/pages/Mfa.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/pages/espera-do-indisponivel.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/credencial/challenge.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/test/mfa.int.test.ts

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-15 21:28:03 · `tasks/prd-reengenharia-continuacao/14_task.md`

**VEREDITO: REPROVADO**

- **Escopo:** respeitado. As subtarefas 14.1 a 14.4 estão feitas. Os dois arquivos fora da lista prevista (`challenge.int.test.ts` e `e2e/support/casca.ts`) estão justificados e registrados.
- **Aderência à Tech Spec:** ok. As divergências (o runbook, a peça `AvisoDaEspera` em `.ts`, o piso de 1 s, o e2e com login falso) estão na `techspec.md` §5 e no `cenarios.md` §7.
- **Portão local:** carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo).

**Bloqueantes:**

1. `apps/web/src/pages/espera-do-indisponivel.ts:122`: o erro da repetição sobe mesmo quando a tentativa já foi descartada.
   - **O que está errado:** a linha é `const valor = await acao()`. Só o sucesso da repetição confere `valendo()` (l.123). Se a repetição falhar depois que a tela saiu ou que outra chamada começou, o erro sobe para quem chamou. Isso contradiz o contrato do próprio `executar` (l.61-63: devolve `DESCARTADA` "ao voltar de qualquer pedido") e o cenário de recomeço da tarefa, "a resposta atrasada da tentativa anterior não muda a tela". A primeira tentativa já está protegida, porque o erro é capturado e conferido nas l.98-104. A repetição não está.
   - **Onde isso pesa:** em `Mfa.tsx:93-105` o erro tem efeito colateral. Um `CONTA_SEGURADA` (o quinto código errado, já com o Redis de volta) ou um `NAO_ENCONTRADO` atrasado chama `esquecerDesafio()`, `definirAvisoDaEntrada(...)` e `navegar(ROUTES.entrar, { replace: true })` depois que a tela saiu. Isso apaga o desafio de quem entrou depois na mesma aba e leva essa pessoa à entrada com o aviso da anterior. É exatamente a corrida que a tarefa diz ter fechado.
   - **Correção exigida:**
     - Na repetição, capturar o erro como na primeira tentativa e devolver `DESCARTADA` quando `!valendo()`, tanto no sucesso quanto no erro.
     - Acrescentar a `espera-do-indisponivel.test.ts` o caso "a resposta atrasada da repetição, com erro, com a tela já fora": segurar a repetição, desmontar, guardar o desafio da pessoa B e liberar um `CONTA_SEGURADA`. O teste confere que o desafio de B continua na aba e que a localização não mudou.
     - Declarar a mutação correspondente no `14_task.md`.

**Recomendações:**

- `docs/runbook.md:207-208` (causa 4): a frase "401 no login lá é o cenário medindo o que deve medir", no cenário de carga, ficou no mesmo parágrafo que agora diz 503 para o desafio. Vale conferir se o `carga:login` passa pelo segundo fator ou pela escolha. Se passar, troque por 503. Se não passar, deixe claro que o 401 é do login por senha ou matrícula.
- A tela de ativação do segundo fator (`configurar_mfa`) também passa a receber o 503, porque `#desafioLivre` vale para ela. Ela mostra o texto do catálogo, sem espera. O `casca.ts` já trata isso, mas o `docs/interface.md` não menciona a ativação. Uma linha resolveria, ou fica registrado que ela fica de fora de propósito.
- `SeletorDeEscola` usa a troca pelo token (`trocar`), que não passa pelo `ChallengeConsumer`. O 503 do seletor não vem do Redis do desafio. O comentário em `SeletorDeEscola.tsx:88` ("503 que não é da pessoa") está correto, mas `docs/interface.md:1921` e o título da tarefa dão a entender que a causa é a mesma. Vale dizer de onde o 503 da troca pode vir.
- `apps/web/src/components/SeletorDeEscola.tsx:7` importa de `../pages/espera-do-indisponivel`. Um componente que depende de `pages/` inverte a direção usual. Um lugar neutro, como `api/` ou `components/states/`, seria mais natural.
- `espera-do-indisponivel.ts:117-118`: o `pararContagem()` do `finally` de uma chamada invalidada também limpa a contagem de uma chamada nova. Hoje isso está coberto pelo botão desabilitado. Vale conferir `valendo()` antes de parar, para não depender dessa invariante da tela.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/pages/espera-do-indisponivel.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/pages/Mfa.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/pages/espera-do-indisponivel.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/docs/runbook.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/prd-reengenharia-continuacao/14_task.md

## test-engineer · 1ª rodada · REPROVADO · 2026-11-15 21:29:31 · `tasks/prd-reengenharia-continuacao/14_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Caminho feliz:** com o Redis fora, o segundo fator e a escolha de escola respondem 503 com `Retry-After`, e quando o Redis volta o mesmo desafio entra.
- **Bordas:**
  - nenhuma tentativa gasta, com seis códigos errados e depois o certo;
  - Redis conectado que recusa o comando;
  - limite de 10 s, `Retry-After` ausente e `Retry-After: 0`;
  - segundo 503 vai ao `ErrorState`;
  - a segunda pessoa na mesma aba;
  - o desafio que muda durante a espera;
  - a tela que sai durante a espera;
  - a resposta atrasada da primeira tentativa e da repetição.
- **Permissão:** uma conta não escolhe usuário de outra conta.
- **Isolamento:** o usuário de outra escola recebe a mesma resposta que o id inexistente, com o Redis fora.
- **Concorrência:** clique duplo e reenvio durante a espera.
- **Tela:** e2e a 1366 × 768 e a 360 px.
- **Log:** o aviso sai uma vez, sem segredo.

**Cobertos:** todas as linhas da tabela têm o teste citado pelo nome, e conferi cada uma:
- **`apps/api/test/mfa.int.test.ts`:** os dois casos "falha (54.0)". As asserções olham o 503, o `Retry-After`, o `proporcaoDoSeguro` do `LoginLockout` em 0, o passo no banco, as sessões e o aviso que sai uma vez. O mesmo desafio entra depois.
- **`apps/api/test/troca-de-escola.int.test.ts`:** o caso "falha (54.0)". A própria escola, a de outra conta e o inexistente dão corpos iguais, nenhuma sessão é gravada e a escolha entra quando o Redis volta.
- **`challenge.int.test.ts` e `password-attack.int.test.ts`:** atualizados para o 503.
- **`apps/web/src/pages/espera-do-indisponivel.test.ts`:** 15 casos.
- **`apps/web/src/components/SeletorDeEscola.test.tsx`:** 4 casos novos.
- **`e2e/entrar-na-escola.spec.ts`:** 3 casos.

Rodei `npx vitest run` nos dois arquivos da web: 23 de 23 passaram.

As mutações batem com o `git diff`. Conferi que cada bloco chega à sua cláusula:
- Sem `conferirLivre` no segundo fator, a reserva vai para o seguro em memória e o quinto código vira `CONTA_SEGURADA`.
- Sem `conferirLivre` na troca, o usuário de outra conta dá 404.
- O `#semRedis` com o 401 de antes quebra o caso do segundo fator.

Os blocos da web derrubam os casos que citam.

Também não há `.skip`, `.only` nem teste comentado. Nenhum teste chama provedor de IA. O dublê do comando recusado é o `ReplyError` do `ioredis` de verdade, sobre o cliente conectado, e não esconde a regra. O clique duplo fica barrado pelo `entrando`, e durante a espera os botões ficam desabilitados.

**Bloqueantes:**

1. **O e2e corre contra uma janela de 2 s de relógio real e só passa com a máquina folgada.**
   - **Onde:**
     - `e2e/entrar-na-escola.spec.ts:611-615` (segundo fator);
     - `e2e/entrar-na-escola.spec.ts:640-645` (escolha);
     - `e2e/entrar-na-escola.spec.ts:672-677` (seletor).
   - **O que está errado:**
     - O aviso existe só nos 2 s do `Retry-After` (`ESPERA_S = 2`). Depois deles, `pararContagem` o tira e a repetição sai.
     - As asserções do estado de espera rodam todas dentro dessa janela: `toBeVisible(aviso)`, `toBeDisabled`, `expect(pedidos).toBe(1)` e `toBeInViewport`.
     - Uma parada de uns 2 s no runner deixa o caso vermelho sem defeito no código, por exemplo com `pedidos` já em 2 ou o botão de novo habilitado.
     - O `medir` dessa fase (`paginaNaoRola`, a altura de 44 px, o axe) também não garante que mede a tela com o aviso: o axe sob CPU ×4 pode passar dos 2 s.
     - Por isso a linha da tabela "1366 × 768 e 360 px: `/entrar` e o seletor com o aviso" fica sem prova determinística.
   - **Correção exigida:** congelar o relógio da página com `page.clock` do Playwright.
     - Antes do `goto`, chamar `page.clock.install()`.
     - Com o aviso à vista, fazer as asserções e o `medir` com o relógio parado.
     - Depois, `page.clock.runFor(ESPERA_S * 1_000)` para soltar a repetição e conferir `pedidos === 2` e o `ErrorState`.
     - Isso também tira os 2 s reais de cada caso do prazo do e2e.

**Recomendações:**

1. **A resposta atrasada ainda grava o token de quem saiu (já existia antes, não foi esta tarefa que criou).** A tela não navega, mas `guardarEtapa`, em `apps/web/src/api/sessao.ts:577`, chama `guardarToken` antes de o `executar` devolver `DESCARTADA`. Então a resposta atrasada da pessoa A deixa a sessão de A na memória da aba em que B está.
   - Os casos "recomeço: a resposta atrasada…" (`espera-do-indisponivel.test.ts:275` e `:290`) só olham a tela.
   - Vale passar isso ao `privacy-guardian` e registrar no `TODO.md`, ou acrescentar a asserção sobre o estado da sessão.
2. **Nenhum teste de integração mostra o seletor recebendo esse 503 por causa do Redis.** A troca pelo token (`trocar`, em `troca-de-escola.service.ts:52`) não passa pelo `ChallengeConsumer`, então o Redis de fila fora não produz esse 503 no seletor. A espera do seletor trata qualquer `INDISPONIVEL_TENTE_DE_NOVO`. Vale escrever de onde esse 503 vem para o seletor, ou dizer que a espera é genérica.
3. **Falta provar que o 503 não confirma desafio inválido.** No caso do Redis fora, falta uma asserção de que um desafio forjado ou vencido continua dando 401, e não 503. O `verifyChallenge` vem antes, mas nenhum teste segura essa ordem com o Redis parado.
4. **`proporcaoDoSeguro` do `LoginLockout` em 0 (`mfa.int.test.ts`) depende de uma janela de 30 s compartilhada pelo arquivo.** Hoje passa porque nenhum caso anterior usa o seguro. Vale um comentário dizendo isso, ou ler a diferença de antes para depois.
5. **O ajudante `linha(nome)` de `SeletorDeEscola.test.tsx:66` é obscuro.** Ele escolhe o índice por `nome.test('Colégio')`. Um `getByRole('button', { name })` dentro da lista seria mais legível.

Arquivos citados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/entrar-na-escola.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/pages/espera-do-indisponivel.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/api/sessao.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/sessao/troca-de-escola/troca-de-escola.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/test/mfa.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/components/SeletorDeEscola.test.tsx`

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-15 22:30:00 · `tasks/prd-reengenharia-continuacao/14_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nem migration no diff da 2ª rodada. Na 1ª rodada não havia nada a corrigir.

Queries verificadas: houve uma mudança, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/sessao/mfa/mfa.service.ts:159-164`. Agora, quando o Redis recusa o `consumir.consumir(verificado)` com `INDISPONIVEL_TENTE_DE_NOVO`, a API responde `TEMPO_ESGOTADO`. O escopo continua igual:
- `usuariosAtivosDaConta(contaId)` usa o `contaId` do desafio, que o servidor assina e confere.
- `destinoUsuarioId` só vale se estiver entre os usuários ativos da própria conta (`:137-138`).
- Nenhum `escolaId` nem `usuarioId` vem do corpo ou da query para decidir o que se lê.
- `troca-de-escola.service.ts` não aparece no diff desde a rodada aprovada.
- `SeletorDeEscola.tsx`, `EscolherEscola.tsx` e `espera-do-indisponivel.ts` só mudaram estado de tela. A falha e o "Tentar de novo" agora ficam presos à pessoa ou ao desafio de quando o pedido saiu, e a resposta atrasada de quem já saiu da tela não sobe mais. Isso reduz a chance de a pessoa seguinte no mesmo computador herdar o que era da anterior. Não abre caminho novo.

Teste de isolamento: presente e efetivo. Não há cláusula de tenant nova a provar. A garantia que importa nesta mudança é que o 503 novo não confirme se um desafio existe, e ela está testada:
- `apps/api/test/mfa.int.test.ts:73`: com o Redis fora, o desafio forjado continua 401.
- `apps/api/test/troca-de-escola.int.test.ts:169-171`: o mesmo para a escolha de escola.
- `apps/api/test/mfa.int.test.ts:107-122`: o desafio já usado continua 401 e não vira o `TEMPO_ESGOTADO` da queda.

Se a conferência do desafio passasse a vir depois do mapeamento do erro, esses três casos quebrariam. O `TEMPO_ESGOTADO` só aparece depois de o desafio e o código certo serem conferidos, então não serve para descobrir se uma conta ou escola existe.

Bloqueantes: nenhum

Recomendações: nenhuma pelo lado do isolamento. As três entradas que a tarefa acrescentou ao `TODO.md` são de infra, de organização e de sessão no cliente, e não tocam o escopo de tenant.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-15 22:30:07 · `tasks/prd-reengenharia-continuacao/14_task.md`

VEREDITO: APROVADO

Tela vista: não. A prompt informa que as fotos estão indisponíveis: a vitrine não força o 503 do desafio, e a coordenação dela tem uma escola só, sem seletor. Revisei pelo código, pelo diff da 2ª rodada e pelo e2e `e2e/entrar-na-escola.spec.ts`. A tela será vista na validação.

Estados: ok.
- Os estados carregando, erro e com dado seguem como na rodada anterior.
- A queda do Redis aparece como aviso de espera em `role="status"` e depois como `ErrorState` com "Tentar de novo".
- O novo caso `TEMPO_ESGOTADO` no segundo fator aparece como mensagem no `<p role="alert">` do campo, sem botão de repetir. Isso é intencional: repetir o mesmo código gasto só daria "código incorreto".

Acessibilidade: ok.
- O aviso novo (`Mfa.tsx:31-35`) vai no mesmo `role="alert"` já existente.
- O foco volta ao botão da escola em `EscolherEscola` (o efeito usa agora `ultima.usuarioId`).
- O e2e mantém o axe, e o relógio parado só atua durante a medição.
- `SeletorDeEscola.test.tsx` passou a achar a linha pelo nome acessível (`within(...).getByRole('button', { name })`), o que reforça o teste.

Chromebook fraco: sem alteração relevante. A espera é única, de no máximo 10 s, e a repetição só sai se a tela e a pessoa ainda são as mesmas. O `Retry-After` fixo em 5 s já está registrado no TODO.

Celular: o e2e continua medindo a 360 px sem rolagem lateral e o botão a 44 px nos três casos (segundo fator, escolha de escola e seletor). O relógio da página fica parado só durante a medição, e o `ESPERA_S` passou a 10 s para o axe sobrar. Não há mudança de layout no diff.

Ação oficial protegida: sim. Nada nesta tarefa cria ação oficial. A mudança em `mfa.service.ts:156-162` não abre sessão quando o `consumir` falha, e os testes provam isso: `sessoesDaConta` fica em 0, o código gasto não volta e o código seguinte entra.

Português:
- O texto novo (`messages.ts`, `AVISO_DO_CODIGO_GASTO_SEM_ENTRAR`) diz o que aconteceu e o que fazer: "O código estava certo, mas o sistema não conseguiu terminar a entrada. Esse código já foi usado: digite o próximo código do aplicativo, ou outro código de recuperação."
- Sem jargão e sem código de erro na tela.

Bloqueantes: nenhum.

Correções da rodada anterior, conferidas no diff:
- A falha e o "Tentar de novo" do `SeletorDeEscola` agora são da pessoa de quando a troca saiu (`SeletorDeEscola.tsx:284,301,311`).
- A falha e o "Tentar de novo" de `EscolherEscola` agora são do desafio de quando a escolha saiu, conferido também no clique (`EscolherEscola.tsx:359-364`).
- Há testes que provam cada caso, inclusive o de a pessoa original voltar à aba.
- Em `espera-do-indisponivel.ts`, o erro da repetição atrasada não sobe depois que a tela saiu, e a contagem da chamada nova não é parada pela antiga. Ambos têm teste.

Recomendações:
- `apps/web/src/pages/Mfa.tsx:33` trata todo `TEMPO_ESGOTADO` da tela da entrada como "código gasto". A API também usa esse código no `statement_timeout` do banco (por exemplo `convite.service.ts:100`). Se essa rota um dia passar a devolvê-lo antes de o código ser gasto, o texto afirmaria algo que não aconteceu. Hoje o conselho de digitar o próximo código ainda funciona. Vale um código de erro próprio quando houver uma terceira causa.
- O `Retry-After` fixo em 5 s, a localização de `AvisoDaEspera` e `useEsperaDoIndisponivel` (em `pages/`, importados por `components/SeletorDeEscola.tsx`) e a gravação do token da resposta atrasada em `guardarEtapa` já estão no `TODO.md`. Concordo com os três apontamentos.
- A fala do runbook sobre o 401 do login por senha na carga local foi corrigida. Vale conferir na validação se o `docs/interface.md` 10.2 diz onde mora o `AvisoDaEspera`. O trecho "Nenhuma peça nova (o `AvisoDaEspera` mora em …)" ficou colado ao parágrafo seguinte, o que pode confundir quem lê.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/pages/Mfa.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/pages/EscolherEscola.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/components/SeletorDeEscola.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/pages/espera-do-indisponivel.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/sessao/mfa/mfa.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/packages/shared/src/errors/messages.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/entrar-na-escola.spec.ts`

## revisor-geral · 2ª rodada · REPROVADO · 2026-11-15 22:30:42 · `tasks/prd-reengenharia-continuacao/14_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. O `TEMPO_ESGOTADO` que o `consumir` devolve depois do código certo, o texto próprio dessa falha e a espera do seletor, que serve a qualquer 503 que pede para esperar, estão na `techspec.md` §5, no `cenarios.md` §7 e na seção de divergências do `14_task.md`.
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

**A correção exigida na 1ª rodada foi feita.** O erro da repetição passa por `tentar` e volta como `DESCARTADA` quando `!valendo()` (`espera-do-indisponivel.ts:132-135`). O teste "recomeço: a resposta atrasada da repetição, com erro e com a tela já fora…" segura a repetição, desmonta, guarda o desafio de B e libera um `CONTA_SEGURADA`. Ele confere o desafio de B e a localização. A mutação está declarada em `14_task.md:294-302`. As recomendações que a ordem mandou aplicar também estão feitas: `valendo()` antes de `pararContagem()` no `finally`, a frase do runbook sobre o 401 e as duas notas no `docs/interface.md`.

Bloqueantes:

1. **`apps/web/src/pages/Mfa.tsx:33`: a tela afirma "O código estava certo" também quando a resposta nem chegou.**
   - **O problema:** `mensagemDaFalhaDoCodigo` troca todo `ApiError` com código `TEMPO_ESGOTADO` por `AVISO_DO_CODIGO_GASTO_SEM_ENTRAR`. Mas esse código também aparece quando o prazo de 20 s estoura no navegador. O `entrarComSegundoFator` chama `enviarEtapa`, que chama `apiRequest` sem `tipo`, então cai no prazo `leitura` de `comPrazo` e sai `ApiError(TEMPO_ESGOTADO, undefined, 'cliente')`.
   - **Por que pesa:** nesse caso a web não sabe se o código foi conferido, se estava errado ou se a sessão chegou a abrir. Mesmo assim a tela diz à pessoa que o código estava certo e que já foi usado. Às 7h30, com a API lenta, isso é plausível.
   - **O projeto já distingue os dois casos:** `estourouNoCliente` (`apps/web/src/api/client.ts:26`) existe para isso, e o comentário de `ApiError` (l.10-12) avisa que o `TEMPO_ESGOTADO` do cliente é "a resposta que não chegou, com a gravação em dúvida". A nota das mutações (`14_task.md:118`) diz que o termo `falha instanceof ApiError` só estreita o tipo, e não considerou a `origem`.
   - **Correção exigida:**
     - Mostrar o aviso só quando o `TEMPO_ESGOTADO` veio da API, com `... && !estourouNoCliente(falha)`. O estouro do cliente segue com o texto geral de `mensagemDoSegundoFator`.
     - Acrescentar a `espera-do-indisponivel.test.ts` um caso com a resposta do segundo fator segurada até o prazo do cliente. A tela deve mostrar `MENSAGENS_DE_ERRO.TEMPO_ESGOTADO` e não `AVISO_DO_CODIGO_GASTO_SEM_ENTRAR`.
     - Declarar no `14_task.md` a mutação que tira o `!estourouNoCliente(falha)`, apontando esse caso.

Recomendações:
- `14_task.md:284-302`: os dois blocos de mutação são o mesmo diff, um para o teste do sucesso e outro para o do erro. Basta um bloco que cite os dois testes, ou uma linha dizendo que a mesma cláusula cobre os dois.
- `apps/web/src/pages/EscolherEscola.tsx:359-363`: `dePessoaDeAgora` e `tentarDeNovo` repetem a mesma comparação. Uma função `daPessoaDeAgora()` usada nos dois lugares deixa a regra em um ponto só.
- `SeletorDeEscola.tsx`: a `falha` da pessoa A continua no estado depois que B entra. Se A voltar à aba, o `ErrorState` antigo reaparece. Não é furo, porque a troca fica presa à conta, mas limpar a `falha` quando `usuarioAtual` muda é mais simples que esconder.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/pages/Mfa.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/api/client.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/pages/espera-do-indisponivel.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/pages/espera-do-indisponivel.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/prd-reengenharia-continuacao/14_task.md

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-15 22:30:51 · `tasks/prd-reengenharia-continuacao/14_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. O diff só muda estado de tela que fica em memória. `ultimaTroca` passa a guardar `{ acesso, usuario }` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/components/SeletorDeEscola.tsx:285`, e `ultima` passa a guardar `{ usuarioId, desafio }` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/pages/EscolherEscola.tsx:51`. Os dois ficam em `useState`. Nada vai para `localStorage`, `sessionStorage` ou URL, então a regra 50, item 7, continua cumprida. O texto novo `AVISO_DO_CODIGO_GASTO_SEM_ENTRAR` (`packages/shared/src/errors/messages.ts:887`) é fixo e não traz nenhum dado da pessoa.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok.
- Com o Redis de fila fora, o desafio forjado continua recebendo 401. Dois testes provam isso: `apps/api/test/mfa.int.test.ts:73` e `apps/api/test/troca-de-escola.int.test.ts:169`. Ou seja, o 503 só sai para um desafio de assinatura válida e não confirma que um desafio existe.
- O `TEMPO_ESGOTADO` novo (`apps/api/src/sessao/mfa/mfa.service.ts:161-164`) só aparece depois de um desafio válido e de um código certo. Esse código já foi gasto, então quem tenta adivinhar códigos não ganha pista nenhuma. O código errado continua indo para o contador da conta.
- O desafio que outro pedido já gastou continua 401 e não vira `TEMPO_ESGOTADO`. A prova está em `mfa.int.test.ts:107`.

Logs: limpos.
- O `consumir` que falha só gera a linha `login.desafio_sem_redis` que já existia, sem nada da pessoa.
- O caso "privacidade" de `mfa.int.test.ts` roda depois dos três casos novos do mesmo arquivo e confere o log inteiro em busca de código, código de recuperação, desafio e e-mail.
- `DomainException(TEMPO_ESGOTADO, undefined, …)` não leva dado no corpo da resposta.

Auditoria: nada mudou. Nenhuma sessão abre no `TEMPO_ESGOTADO` (`mfa.int.test.ts:96`, `:118`, `:133`). A ativação do convite antes do `consumir` já acontecia assim antes desta rodada e já tinha auditoria.

Envio externo: nenhum.

Seed/fixture: sintético. São `pessoa-sintetica@escola.invalid` e "Escola Sintética B" no e2e, mais as escolas da bancada.

Correções exigidas na 1ª rodada:
- **"Limpar `falha` e `ultimaTroca` (seletor) e `ultima` (escolha) quando a pessoa ou o desafio muda": feito.** A falha deixou de ser apagada e passou a ficar presa a quem a causou.
  - No seletor, ela só aparece se `ultimaTroca.usuario === usuarioAtual` (`SeletorDeEscola.tsx:302` e `:312`). O "Tentar de novo" só fica na tela nesse mesmo caso.
  - Na escolha, ela só aparece se o desafio é o da aba (`EscolherEscola.tsx:360` e `:375`). O `tentarDeNovo` confere o desafio de novo no clique (`:363`), porque o desafio pode mudar sem a tela ser redesenhada.
  - Testes que provam: `SeletorDeEscola.test.tsx:174` e `:236`, e `espera-do-indisponivel.test.ts:517`, `:536` e `:572`.
- **Comentário de `ChallengeConsumer`: feito** (`apps/api/src/credencial/challenge.ts:145`).

Mudança que reduz um risco de vazamento: antes, se a repetição terminava com erro depois de a tela já ter saído, esse erro subia para a tela. Um `CONTA_SEGURADA` atrasado da pessoa A podia então apagar o desafio da pessoa B, que já estava no mesmo computador. Agora o erro também vira `DESCARTADA` (`apps/web/src/pages/espera-do-indisponivel.ts:637-640`), e o teste em `espera-do-indisponivel.test.ts:460` prova isso.

Bloqueantes: nenhum.

Recomendações:
- **Reforço do item do `TODO.md` que me cita.** `guardarEtapa` (`apps/web/src/api/sessao.ts:574-585`) grava a resposta atrasada antes de o hook devolver `DESCARTADA`. Se a repetição do segundo fator da pessoa A já estava no ar quando A saiu e B chegou, uma resposta `pronta` coloca o token de A na memória da aba de B. Isso já existia antes desta tarefa: a primeira tentativa no ar tem a mesma janela, e a repetição só sai se a tela ainda vale. A janela é curta. Mesmo assim, é exatamente o computador compartilhado que a D43 descreve. Peço que a próxima tarefa que tocar `sessao.ts` passe a geração ou o desafio de origem para `enviarEtapa`, e que só grave a etapa se o desafio guardado ainda for o que foi enviado. Peço também um teste de recomeço com a resposta `pronta` atrasada.
- Vale guardar uma linha na Tech Spec §5 dizendo que, no `TEMPO_ESGOTADO`, o código de convite já pode ter sido ativado antes do `consumir` que falhou. A ativação continua idempotente e auditada, mas quem ler o arquivo do titular verá a ativação sem sessão aberta.

Pergunta de fechamento: esta rodada não muda o que o sistema guarda sobre o aluno nem para onde ele é enviado. A resposta à secretaria continua sendo a mesma de `arquivo-do-titular`, como estava na 1ª rodada.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-15 22:31:12 · `tasks/prd-reengenharia-continuacao/14_task.md`

VEREDITO: APROVADO
Caminho quente tocado: login
Rate limit: ok. O limite é por conta (`LoginLockout`). A recusa nova passa pelo `catch` de `mfa.service.ts:121-124`, que desfaz a reserva (`contador.desfazer`).
Fila e prioridade: ok. A tarefa não mexe em fila.
Concorrência: protegida. O 503 que vem depois do código certo agora é `TEMPO_ESGOTADO` (`mfa.service.ts:159-164`), e a web não o repete sozinha (`ehIndisponivel` só aceita `INDISPONIVEL_TENTE_DE_NOVO`). O `SET NX` que acha a marca já gravada segue 401.
Índice e paginação: ok. Não há query nova.
Degradação de IA: não se aplica.
Migration: não se aplica.
Métrica e alerta: ok. A falha do `consumir` ainda passa por `#semRedis`, então conta em `proporcaoDoSeguro` e gera o `login.desafio_sem_redis`, e o alerta "Seguro de limite ativo" continua vendo a queda.
Bloqueantes: nenhum.

Correção exigida na 1ª rodada, conferida:
- **API:** foi escolhida a saída da recusa própria. O `INDISPONIVEL_TENTE_DE_NOVO` do `consumir` sai como `TEMPO_ESGOTADO`, que a web não repete sozinha.
- **Tela:** `Mfa.tsx` mostra `AVISO_DO_CODIGO_GASTO_SEM_ENTRAR`, mantém o desafio e não oferece "Tentar de novo".
- **Teste de integração:** em `mfa.int.test.ts`, o `vi.spyOn(cliente, 'set')` lança o `ReplyError`, com o código do app e com o código de recuperação. O teste prova o 503 `TEMPO_ESGOTADO`, nenhuma sessão aberta, o código gasto e o seguinte entrando. Prova também que o desafio já marcado segue 401.
- **Teste da web:** em `espera-do-indisponivel.test.ts`, um pedido só, sem espera e sem botão.
- **Mutações:** os dois blocos novos estão no `14_task.md`.
- **Código de recuperação:** ele fica queimado sem a pessoa entrar. O teste exigido pedia o contrário, mas isso vale para a outra saída (desfazer o passo antes do 503). Na saída escolhida a perda é consequência dela, a tela manda usar outro código, e está documentada na `techspec.md` §5. Aceito.
- **Recomendação aplicada:** a variante "conectado e recusando" (`ReplyError` em `exists`) entrou em `troca-de-escola.int.test.ts`.

Rodei os testes de unidade de `espera-do-indisponivel.test.ts`, `SeletorDeEscola.test.tsx` e `messages.test.ts`: 50 passam. Os de integração (`mfa.int.test.ts` e `troca-de-escola.int.test.ts`) não rodei. A pilha de teste de outro andar (`educa-teste-2`) está no ar, e o caso que para o `redis-fila` poderia derrubá-la. Os dois foram revisados só pela leitura do código.

Recomendações:
1. No caso novo de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/test/mfa.int.test.ts`, conferir que o contador do `LoginLockout` não mudou depois do `TEMPO_ESGOTADO`. Ninguém confere isso hoje nesse caso. O `desfazer` do `catch` só é provado de forma indireta, por `apps/api/test/ativacao-under-lock.int.test.ts` (bloco e).
2. Há casos em que o aviso "digite o próximo código" não ajuda:
   - O `set` estoura o prazo de 100 ms depois de o Redis já ter gravado a marca.
   - O `TEMPO_ESGOTADO` vem do `concluir`, que roda depois do `consumir`.

   Nos dois, o desafio já está marcado como usado. O próximo código recebe 401 no `conferirLivre`, sem gastar tentativa, mas a tela diz "código incorreto". Vale considerar, numa próxima tarefa, mandar a pessoa à entrada quando o mesmo desafio volta 401 logo depois do `TEMPO_ESGOTADO`.
3. A causa 4 do "Seguro de limite ativo" em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/docs/runbook.md` não cita esse `TEMPO_ESGOTADO`. Com o Redis instável, quem opera vai ver `http.erro` 503 com esse código no log. Uma linha resolve.
4. Continua no `TODO.md`, como já registrado: sortear o `Retry-After` do desafio.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/sessao/mfa/mfa.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/test/mfa.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/pages/Mfa.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/pages/espera-do-indisponivel.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/test/troca-de-escola.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/prd-reengenharia-continuacao/14_task.md

## test-engineer · 2ª rodada · APROVADO · 2026-11-15 22:31:49 · `tasks/prd-reengenharia-continuacao/14_task.md`

VEREDITO: APROVADO

**Cenários exigidos**
- **Caminho feliz:** com o Redis fora, o segundo fator e a escolha de escola dão 503 com `Retry-After`, e o mesmo desafio entra quando o Redis volta.
- **Bordas:**
  - o Redis cai depois do código certo, com o código do app e com o de recuperação;
  - o desafio já marcado, que continua 401;
  - o Redis conectado que recusa o comando, também na escolha;
  - limite de 10 s, segundo 503 e a segunda pessoa na mesma aba;
  - o erro atrasado da repetição, com a tela já fora;
  - a chamada trocada que não pode parar a contagem da nova;
  - a falha que é só de quem trocou: o seletor e a escolha com o desafio trocado, com e sem redesenho.
- **Permissão:** o desafio forjado continua 401 com o Redis fora, e uma conta não escolhe usuário de outra conta.
- **Isolamento:** o usuário de outra escola e o id inexistente recebem o mesmo corpo com o Redis fora.
- **Concorrência:** clique duplo e reenvio durante a espera.
- **Tela:** e2e a 1366 × 768 e a 360 px, com relógio determinístico.

**Cobertos**
- **A correção exigida (e2e):** feita, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/entrar-na-escola.spec.ts:303-433`.
  - O teste chama `page.clock.install()` antes do `goto` e para o relógio (`pararORelogio`) antes do clique.
  - Todas as asserções do estado de espera rodam com o relógio parado: aviso visível, `toBeDisabled`, `pedidos === 1`, `toBeInViewport`. A geometria do `medir` também.
  - `soltarAEspera` (`runFor`) solta a repetição, e só então o teste confere `pedidos === 2` e o `ErrorState`.
  - Nenhuma asserção depende mais de uma janela de relógio real.
  - Desvio justificado no comentário: o axe roda com o relógio solto, porque usa `setTimeout`, e por isso `ESPERA_S` subiu para 10.
- **As quatro recomendações que a ordem mandou aplicar:**
  - o desafio forjado é 401 nos dois arquivos de integração;
  - `proporcaoDoSeguro` agora é comparado com o valor de antes da queda, sem depender da janela de 30 s;
  - o ajudante `linha(nome)` passou a usar `within(...).getByRole('button', { name })`;
  - `docs/interface.md` diz de onde vem o 503 do seletor.
- **Testes das cláusulas novas:** cada uma tem teste que olha o resultado, e um bloco de mutação que chega à cláusula pelo motivo certo.
  - `MfaService.consumir`, quando o Redis recusa:
    - o teste espera 503 `TEMPO_ESGOTADO` e nenhum cookie;
    - o passo fica gravado no banco, e isso não acontece à toa: o caso anterior prova que `comMfaAtivo` deixa o passo nulo;
    - o mesmo código, num desafio novo, dá 401, e o código seguinte entra;
    - a mutação que tira o `catch` cai no código de erro.
  - O desafio já marcado (`set` devolvendo `null`) continua 401, e a mutação que generaliza o `if` derruba esse caso.
  - O código de recuperação usado fica queimado, e o outro entra.
  - Repetição com erro e tela fora: `CONTA_SEGURADA` atrasado, o desafio de B continua na aba e a localização não muda.
  - `if (valendo()) pararContagem()`: o caso com `renderHook` e espera controlada cobre.
  - `daPessoaDeAgora` e `dePessoaDeAgora`: há caso com redesenho, e para o clique sem redesenho a mutação `if (true)` chega a um terceiro pedido.
  - O aviso do código gasto: o teste confere o texto exato, que nada se repete em 60 s e que "Tentar de novo" não aparece.
- **Tabela de testes:** as linhas novas da tabela citam os casos pelo nome, e cada caso citado existe.
- **Sem `.skip` e sem provedor de IA:** não há `.skip` nem teste comentado, e nenhum teste chama provedor de IA. O mock de `set` e `exists` usa o `ReplyError` real do `ioredis` e não esconde a regra.
- **O que rodei:**
  - **Rodei:** `npx vitest run` em `espera-do-indisponivel.test.ts`, `SeletorDeEscola.test.tsx` e `messages.test.ts`: 50 de 50 passaram.
  - **Não rodei:** a integração, porque ela para o `redis-fila`, que é compartilhado com os outros revisores.

**Bloqueantes:** nenhum.

**Recomendações**
1. **O aviso novo pode dizer algo falso.** Arquivos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/pages/Mfa.tsx` (`mensagemDaFalhaDoCodigo`) e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/packages/shared/src/errors/messages.ts` (`AVISO_DO_CODIGO_GASTO_SEM_ENTRAR`).
   - **O problema:** a tela escolhe o aviso só pelo código `TEMPO_ESGOTADO`, e esse código não vem só desse caminho. O `statement_timeout` do Postgres chega como `57014` e vira `TEMPO_ESGOTADO` (`map-postgres-error.ts:10`).
   - **Onde acontece:** pode acontecer antes da conferência do código, em `mfaDaConta` ou na gravação do passo em `#fatorConfere` (`mfa.service.ts:101-109`). Um código **errado**, com o banco travado às 7h30, mostraria "O código estava certo…".
   - **O impacto é pequeno:** a ação sugerida, digitar o código seguinte, continua certa.
   - **A correção sugerida:** reescrever o texto sem afirmar que o código estava certo ("Não foi possível terminar a entrada. Digite o próximo código…"), ou usar um código de erro próprio.
   - **O teste a acrescentar:** um `TEMPO_ESGOTADO` vindo antes da conferência.
2. **O axe da tela com o aviso ainda tem uma folga de relógio real.** Em `medir`, o relógio volta a andar antes do axe. Se o axe passar de 10 s, a repetição sai durante ele.
   - **O caso não fica vermelho:** as asserções seguintes passam, e o `ErrorState` é medido de novo depois.
   - **O que se perde:** a medida do axe com o aviso à vista, sem ninguém ver.
   - **O que fazer:** registrar essa limitação no comentário de `medir`, ou rodar o axe só sobre a região do aviso.
3. **Dois blocos de mutação iguais.** Os blocos "o sucesso" e "o erro atrasado da repetição" tiram a mesma linha e apontam casos diferentes. Valem as duas provas, mas o título do primeiro poderia dizer que é a mesma mutação.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/entrar-na-escola.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/sessao/mfa/mfa.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/test/mfa.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/pages/Mfa.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/packages/shared/src/errors/messages.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/prd-reengenharia-continuacao/14_task.md

## frontend-reviewer · 3ª rodada · APROVADO · 2026-11-15 22:51:59 · `tasks/prd-reengenharia-continuacao/14_task.md`

VEREDITO: APROVADO
Tela vista: não. A vitrine não força o 503 do desafio e a coordenação dela tem uma escola só, sem seletor. A revisão da rodada 3 foi pelo código e pelo teste do segundo fator (`espera-do-indisponivel.test.ts`). Não rodei nenhum teste nesta rodada; a leitura confere o diff e o que ele toca. A tela será vista na validação.
Estados: ok. O diff só muda texto e a escolha entre duas mensagens de erro. Carregando, "Entrando…" e erro com "Tentar de novo" ficam como na rodada aprovada.
Acessibilidade: ok. A falha continua em `role="alert"`. O estouro do prazo no navegador não oferece "Tentar de novo", e o teste novo confere isso.
Chromebook fraco: sem mudança.
Celular: sem mudança de layout. Só o texto da mensagem mudou.
Ação oficial protegida: não se aplica a esta rodada. O diff não toca ação oficial.

Bloqueantes: nenhum.

Conferi o diff `.processo/ordens/diff-14-r3-codigo.patch`:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/pages/Mfa.tsx:50-54`: o texto do código gasto só aparece quando o `TEMPO_ESGOTADO` vem da API. Quando o prazo estoura no navegador, usa `estourouNoCliente` (`apps/web/src/api/client.ts:26`) e cai no texto geral: "A operação demorou mais que o esperado. Tente de novo em instantes." Isso evita dizer ao usuário que o código foi gasto quando a web não sabe.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/packages/shared/src/errors/messages.ts:135-137`: o texto novo está em português claro e diz o que fazer. Sem termo técnico, e sem afirmar que o código estava certo. O conselho "digite o próximo código" serve para os dois casos.
- `apps/web/src/pages/EscolherEscola.tsx:88-94`: `daPessoaDeAgora()` só trocou uma constante por função. O comportamento é o mesmo e não é mais calculado de forma defasada no clique.
- `e2e/support/casca.ts:320` importa a constante, então acompanha o texto novo. Não achei no código nenhuma outra cópia do texto antigo.

Recomendações:
- Hoje o texto "pode já ter sido usado" cobre dois casos. Se a validação ou o uso real mostrarem confusão, vale pensar num texto curto só para o 503 de antes da conferência.
- `espera-do-indisponivel.test.ts` mexe no `fetch` com `vi.stubGlobal`. Confirme que o `afterEach` do arquivo chama `vi.unstubAllGlobals()`, para não vazar para os outros testes.

## infra-guardian · 3ª rodada · APROVADO · 2026-11-15 22:52:19 · `tasks/prd-reengenharia-continuacao/14_task.md`

VEREDITO: APROVADO
Caminho quente tocado: login (só a web e o texto da tela do segundo fator; a API não mudou desde a 2ª rodada)
Rate limit: ok (sem mudança nesta rodada)
Fila e prioridade: ok (não se aplica ao diff)
Concorrência: protegida. O estouro do prazo no navegador não repete sozinho e não mostra "Tentar de novo". O teste prova isso: `fetch` chamado uma vez só e nenhum botão. Assim, sessenta turmas atrás do mesmo IP não ganham uma rajada extra às 10h. No `EscolherEscola.tsx`, o desafio continua conferido na hora do clique, e não só quando a tela é desenhada.
Índice e paginação: ok (não se aplica)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (sem código novo de servidor)
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/pages/Mfa.tsx:37`: quando o prazo estoura no navegador, a tela mostra o texto geral do `TEMPO_ESGOTADO`, que diz "Tente de novo em instantes". Se o servidor já conferiu e gastou o código, a pessoa repete o mesmo código, recebe "código inválido" e só então digita o próximo. Com isso, uma tentativa a mais pode entrar na conta de tentativas do segundo fator. Não bloqueia, porque o reenvio é manual e é um só. Para a retro: avaliar se o estouro no cliente também deve sugerir o próximo código do aplicativo, já que o conselho do `AVISO_DO_CODIGO_GASTO_SEM_ENTRAR` vale nos dois casos.

## revisor-geral · 3ª rodada · APROVADO · 2026-11-15 22:52:26 · `tasks/prd-reengenharia-continuacao/14_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. A §5 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/prd-reengenharia-continuacao/techspec.md` (linhas 164 a 168) já registra três pontos: o texto que não afirma que o código estava certo, o estouro do prazo no navegador com o texto geral e o convite que pode ficar ativado quando o `consumir` falha. As linhas novas de divergência no `14_task.md` apontam para ela.
Portão local: carimbo válido (`typecheck, lint, segredo, dependencias, unidade, alvo`)
Bloqueantes: nenhum.

A correção exigida na 2ª rodada foi feita:
- **A condição nova:** `apps/web/src/pages/Mfa.tsx:37` só devolve `AVISO_DO_CODIGO_GASTO_SEM_ENTRAR` quando a condição tem `&& !estourouNoCliente(falha)`. O estouro no navegador vai para `mensagemDoSegundoFator`.
- **O caso novo:** `apps/web/src/pages/espera-do-indisponivel.test.ts:289` faz o `fetch` ficar sem resposta até o prazo `leitura` abortar a chamada. O caso confere `MENSAGENS_DE_ERRO.TEMPO_ESGOTADO` no `role="alert"` e confere que o botão "Tentar de novo" não aparece. O stub do `fetch` é desfeito pelo `afterEach` do `render-screen.tsx`.
- **A mutação declarada:** o `14_task.md` tem o bloco que tira o `!estourouNoCliente(falha)`. Ele aponta esse caso e usa `falha: toBe(MENSAGENS_DE_ERRO.TEMPO_ESGOTADO)`. O bloco anterior, do `TEMPO_ESGOTADO` vindo da API, foi atualizado para a linha nova.
- **O texto do aviso:** em `packages/shared/src/errors/messages.ts:108` o aviso deixou de dizer "O código estava certo". O `messages.test.ts` prova isso com `not.toMatch(/estava certo/)`. O e2e (`e2e/support/casca.ts:320`) importa a mesma constante, então não fica com o texto antigo.
- **As duas recomendações da 2ª rodada:**
  - Os blocos de mutação da repetição atrasada viraram um só.
  - A comparação do desafio em `EscolherEscola.tsx` passou a ser uma função só, `daPessoaDeAgora()`, chamada no clique e no desenho da tela. Os blocos de mutação dela foram atualizados.

Recomendações:
- **`cenarios.md` sem o caso novo:** o §7 (linhas 203 e 204) ainda não traz o [U] do prazo estourado no navegador na tela do segundo fator, nem o texto da tela no `TEMPO_ESGOTADO` vindo da API. O [U] da linha 182, da tarefa 12.0, cobre só a marca `origem: 'cliente'`. Quando o arquivo for editado de novo, convém acrescentar o caso para que o Validador o encontre.
- **"Tentar de novo" depois do estouro:** quando o prazo estoura no navegador, o texto geral do `TEMPO_ESGOTADO` pode levar a pessoa a mandar o mesmo código. Se a API tiver gasto o código, a resposta será "código incorreto". É o mesmo desenho que o `TODO.md` já registra (infra-guardian, 2ª rodada: mandar à entrada quando o mesmo desafio volta 401 depois de um `TEMPO_ESGOTADO`). Vale cobrir os dois casos de origem do `TEMPO_ESGOTADO` na tarefa que pegar esse item.

## privacy-guardian · 3ª rodada · APROVADO · 2026-11-15 22:52:33 · `tasks/prd-reengenharia-continuacao/14_task.md`

VEREDITO: APROVADO

**Rodada:** 3ª. Auditei só o diff 8f85f807 → 4b956706, porque a rodada anterior não exigiu correções. A API não mudou. O código mudou em quatro arquivos: `Mfa.tsx`, `EscolherEscola.tsx`, `messages.ts` e os testes deles.

**Campos pessoais tocados:** nenhum. As mudanças são texto de tela, um ramo de tratamento de erro e uma checagem que antes era uma constante e agora é uma função.

**Fora da tabela de dados do docs/lgpd.md:** nada.

**Autorização por objeto:** ok. A API não mudou. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/pages/EscolherEscola.tsx`, a constante `dePessoaDeAgora` virou a função `daPessoaDeAgora()`. A regra continua a mesma: a falha de outra pessoa não aparece, e o "Tentar de novo" só reenvia a escolha se o desafio ainda for o da pessoa que está na tela. Agora a mesma função é usada no desenho da tela e no clique, então não há divergência entre os dois.

**Logs:** limpos. Os arquivos alterados não têm `console.*` nem logger.

**Auditoria:** a mudança não toca nenhuma ação que a regra obriga a auditar.

**Envio externo:** nenhum.

**Seed/fixture:** sintético. O teste novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/pages/espera-do-indisponivel.test.ts` usa o identificador `desafio-da-pessoa-a` e um `fetch` falso que nunca responde.

**Exposição da tela:**
- O novo texto de `AVISO_DO_CODIGO_GASTO_SEM_ENTRAR`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/packages/shared/src/errors/messages.ts:108`, não diz mais que o código estava certo. Com isso, o sistema deixa de confirmar à pessoa que errou o código que ele era válido, o que antes servia de pista para quem tenta adivinhar códigos.
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/pages/Mfa.tsx:37`, `estourouNoCliente` faz o prazo esgotado no navegador mostrar o texto geral do `TEMPO_ESGOTADO`. Nenhum dos dois textos traz dado de pessoa nem stack trace.

**Fotos da tela:** indisponíveis. O texto que aparece na tela está provado pelo teste novo (`toBe(MENSAGENS_DE_ERRO.TEMPO_ESGOTADO)`) e pelo `messages.test.ts`, que garante que o aviso não contém "estava certo".

**Pergunta de fechamento:** a resposta não muda. O diff não guarda nem envia nada novo sobre aluno.

**Bloqueantes:** nenhum.

**Recomendações:**
- O item que já está no `TODO.md` continua valendo: a resposta atrasada ainda grava o token de quem já saiu (`guardarEtapa` em `apps/web/src/api/sessao.ts`). O problema já existia antes desta tarefa e não é desta rodada, mas deve ser auditado como bloqueante na próxima tarefa que mexer em `sessao.ts`.

## test-engineer · 3ª rodada · APROVADO · 2026-11-15 22:52:35 · `tasks/prd-reengenharia-continuacao/14_task.md`

VEREDITO: APROVADO

Cenários exigidos (as mudanças desta rodada):
- O `TEMPO_ESGOTADO` que vem da API depois do código certo continua mostrando o aviso do código gasto.
- O estouro do prazo no navegador (a resposta não chegou) mostra o texto geral do `TEMPO_ESGOTADO`, sem o aviso do código gasto e sem repetir o pedido.
- O aviso do código gasto não diz mais que o código estava certo, porque o mesmo `TEMPO_ESGOTADO` também vem do `statement_timeout`, antes de o código ser conferido.
- A falha de outra pessoa não aparece em `EscolherEscola`, e o "Tentar de novo" confere o desafio na hora do clique. O desafio agora é lido num ponto só.

Cobertos:
- **Prazo estourado no navegador:** o teste novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/pages/espera-do-indisponivel.test.ts:289` deixa o `fetch` sem resposta até o prazo abortar a chamada. Ele confere três coisas: o texto da tela é exatamente `MENSAGENS_DE_ERRO.TEMPO_ESGOTADO`, o `fetch` foi chamado uma vez só e não aparece o botão "Tentar de novo".
  - Se o termo `!estourouNoCliente(falha)` sair, a tela mostra o aviso do código gasto e o `toBe` falha. Esse aviso é diferente do texto geral, e `messages.test.ts:112` garante isso.
  - O bloco novo em "Mutações" bate com o código de `Mfa.tsx:37`.
- **Os dois casos de `TEMPO_ESGOTADO` ficaram separados:** o termo novo não esconde o caso que vem da API, que segue testado em `espera-do-indisponivel.test.ts:277`.
- **Texto novo do aviso:** `messages.test.ts:111-118` confere `toContain('pode já ter sido usado')`, `not.toMatch(/estava certo/)` e `toContain('próximo código')`.
  - O nome antigo do teste, citado na tabela do `14_task.md`, foi trocado pelo nome atual.
  - Nenhum teste, e2e ou documento ficou com o texto antigo. O e2e (`e2e/support/casca.ts:320`) usa a constante, e não o texto.
- **`EscolherEscola`:** trocar a variável pela função `daPessoaDeAgora()` não muda o que a tela faz. Os dois blocos de mutação desse arquivo foram ajustados à linha nova e citam testes que existem.
- **Bloco único da repetição atrasada:** o teste citado, "recomeço: a resposta atrasada da repetição, com", é o começo do nome de dois testes que existem (linhas 308 e 323). A mutação tira uma linha da qual os dois dependem.
- Rodei `espera-do-indisponivel.test.ts` e `messages.test.ts`: 44 testes passaram. Não há `.skip` e nenhum mock esconde a regra. O "fetch pendurado" imita o navegador e deixa o caminho real do `comPrazo` acontecer.

Bloqueantes: nenhum.

Recomendações:
- Agora um bloco só prova os dois testes da repetição atrasada (o de sucesso e o de erro). Esse bloco fica vermelho se qualquer um dos dois quebrar. Por isso não prova mais, isoladamente, que cada teste chega à linha `if (!valendo()) return DESCARTADA`. A 2ª rodada já tinha provado cada um em separado, e a linha é a mesma, então não bloqueia. Vale para a retro, se o processo quiser um bloco por teste quando dois testes cobrem a mesma linha.
- `packages/shared/dist/errors/messages.d.ts` ainda tem o texto antigo. É saída de build e a próxima build a regenera. Só confirme que essa pasta não está no git.
