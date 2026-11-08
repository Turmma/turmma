# Achados das revisões — `tasks/prd-acesso-e-convites/6_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-08 18:31:55 · `tasks/prd-acesso-e-convites/6_task.md`

VEREDITO: APROVADO
Tela vista: sim (12 fotos lidas, cheia e vazia: `/entrar`, `/esqueci` e `/redefinir`, em 1366 e 360 px). Não fotografei o estado "enviado" do Esqueci, o aviso "Senha trocada" na entrada, a senha recusada nem a falha de rede. Conferi esses quatro pelo código e pelo e2e.
Estados: ok.
- **Carregando:** "Enviando…" e "Salvando…" no botão, que fica desligado, com o mesmo texto num `status` para o leitor de tela (`EsqueciASenha.tsx:90`, `RedefinirSenha.tsx:130`).
- **Vazio:** o formulário, com a linha do aluno e a regra da senha à vista.
- **Erro:** o link que não vale diz o que fazer. A senha recusada mostra a regra no campo e leva o foco até ele. A falha de rede usa o `ErrorState` com "Tentar de novo".
- **Com dado:** a frase única de confirmação, que não repete o e-mail e toma o foco. Depois de trocar a senha, a tela volta à entrada sem abrir sessão.

Acessibilidade: ok.
- Os campos têm rótulo visível. O foco aparece no campo "Senha nova" na foto.
- "Mostrar" usa `aria-pressed`, e o campo tem `autocomplete="new-password"`.
- Os avisos usam `role="alert"` e `role="status"`.
- O e2e roda a checagem de violações graves a 360 px (`e2e/esqueci-a-senha.spec.ts:448`).

Chromebook fraco: sem impacto. São três telas de formulário de um campo, sem lista, sem imagem de upload e sem consulta ao TanStack Query. O e-mail não vai em chave de cache.

Celular: ok. Nas fotos de 360 px não há rolagem horizontal nem corte. O "Entrar", o "Enviar o link" e o "Definir a senha" têm cerca de 44 px, e "Esqueci a senha", "Voltar para Entrar" e "Mostrar" têm cerca de 44 px também. Nada depende de hover. A lista "Rolam a 1366 × 768" está vazia, então todas as telas cabem na janela. O e2e a 360 px cobre os quatro casos (`e2e/esqueci-a-senha.spec.ts:427-470`).

Ação oficial protegida: sim. Não há ação oficial nestas telas. Trocar a senha não abre sessão, e o segundo fator continua exigido.

Bloqueantes: nenhum.

Recomendações:
- Na entrada, o "Esqueci a senha" tem a mesma aparência de botão que o "Entrar". Funciona e segue o `docs/interface.md`, mas um link de texto mais discreto deixaria a ação principal mais clara. É só gosto.
- A frase "Ele vale 1 hora." bate com `VALIDADE_DO_LINK_DE_REDEFINIR_MS` (`apps/api/src/sessao/senha/senha.service.ts:20`). Se o prazo mudar, a frase da tela (`EsqueciASenha.tsx:13`) precisa mudar junto. Valeria derivar o texto de uma constante em `@educa/shared`.
- O texto "Aluno: peça a senha provisória ao professor." aparece como segundo parágrafo, separado do primeiro. Fica claro nas fotos, e não é problema.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-08 18:31:56 · `tasks/prd-acesso-e-convites/6_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. O diff tem a tela "Esqueci a senha", a tela "Redefinir" e o link novo na entrada da equipe, nada mais. Não toca `Nota`, correção nem jobs. Todos com autor humano? Não se aplica: a tarefa não abre caminho de escrita em `Nota`.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. A tarefa não tem saída de IA. `apps/web/src/api/senha.ts` só chama `/v1/senha/esqueci` e `/v1/senha/redefinir`, e nenhuma das duas passa pela porta de IA.

Supervisão do tutor: ok. A tarefa não toca o tutor.

Autonomia declarada e visível: sim. A tarefa não muda nenhum agente nem a tela de governança, e não declara nem altera nível de autonomia.

Bloqueantes: nenhum.

O que as fotos mostram:
- **Em `/esqueci` (`coordenacao--esqueci--computador.png` e `coordenacao--esqueci--celular.png`):**
  - não há saída de IA, nota, conceito nem sugestão de nota;
  - nada induz uso;
  - "Voltar para Entrar" aparece sempre, o que atende a regra 70, item 4b.
  - A linha "Aluno: peça a senha provisória ao professor." manda o aluno a um humano. Não há fluxo automático para ele. A linha está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/EsqueciASenha.tsx`.
- **Em `/redefinir`, sem token e com o formulário (`coordenacao--redefinir--*.png` e `vazia--coordenacao--redefinir--*.png`):**
  - o aviso de link vencido leva a saída "Esqueci a senha";
  - não há login automático;
  - não há conteúdo de IA.
- **A onça nas fotos** é a ilustração da marca na casca pública, presa ao traço do mockup por teste (D80). Não fala como agente e não se apresenta como pessoa, então não há conflito com o item 4a nem com a D58.

Recomendações: nenhuma da regra 70. A qualidade visual fica com o `frontend-reviewer`, e o fluxo de token e o e-mail ficam com o `privacy-guardian` e o `tenancy-guardian`.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-08 18:31:57 · `tasks/prd-acesso-e-convites/6_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela ou migration nova. A tarefa só altera telas; `git status` não mostra mudança em `apps/api` nem em `packages`.

Queries verificadas: nenhuma query nem repository novo. O cliente `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/api/senha.ts` chama os dois endpoints da 5.0, `POST /v1/senha/esqueci` e `POST /v1/senha/redefinir`, mandando no corpo só `{ email }` e `{ token, senha }`. Nenhum `escolaId` vai no corpo nem na query string. O token sai do fragmento `#` e é limpo da barra antes da chamada, também quando o link é colado de novo.

Teste de isolamento: não se aplica, porque não há módulo, repository nem endpoint novo. A camada de tela que toca a regra 10, item 6, está coberta:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/esqueci-a-senha.spec.ts:147`: a mesma frase para quem tem conta e para quem não tem, sem repetir o e-mail.
- `esqueci-a-senha.spec.ts:282` e `:259`: link inventado, sem token ou já usado dão o mesmo aviso.

A tela trata `NAO_ENCONTRADO` com uma mensagem única para link vencido, usado, substituído ou inexistente (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/RedefinirSenha.tsx`). Por isso a resposta não confirma se a conta ou o token existe.

Bloqueantes: nenhum.

Recomendações:
- `e2e/esqueci-a-senha.spec.ts:150`: este caso simula a resposta com `page.route`, então só prova a tela. Que a API responde 202 igual com e sem conta tem de estar provado no teste de integração da 5.0. Vale conferir na validação que esse caso existe lá e falha se a resposta mudar conforme a conta existe.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-08 18:32:11 · `tasks/prd-acesso-e-convites/6_task.md`

VEREDITO: APROVADO
Caminho quente tocado: login (só a tela: o link "Esqueci a senha" na entrada da equipe e duas telas novas sem login; a API é da tarefa 5.0)
Rate limit: ok. Esta tarefa não cria limite. A tela só consome o que a 5.0 já tem: o balde `rl:ip:senha` e o de 3 por hora por e-mail. Os dois descartam o pedido sem link e nunca respondem 429. Nenhum bloqueio novo só por IP.
Fila e prioridade: ok (não se aplica, o envio do e-mail fica na 5.0)
Concorrência: protegida. No cliente, `noAr` (useRef) segura o clique duplo antes de o botão desligar, nas duas telas. A resposta que chega atrasada de um link anterior é descartada por `vezAtual() !== vez` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/RedefinirSenha.tsx`. Que o token seja usado uma vez só é garantia da API (5.0), e o e2e prova que o link já usado não vale de novo.
Índice e paginação: ok (não se aplica, sem query nova)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok. Não há código novo de servidor. As telas fazem uma chamada por ação, sem polling e sem tentativa automática: o "Tentar de novo" só roda quando a pessoa clica.
Bloqueantes: nenhum
Recomendações:
- O comentário de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/EsqueciASenha.tsx:20` fala em "o limite do IP da escola". Os baldes do "esqueci" nunca respondem 429. O que pode chegar à tela é o 429 do limite geral por IP das rotas anônimas, que o comentário do `senha.controller.ts` cita. Vale escrever esse nome, para ninguém achar depois que o balde `rl:ip:senha` aparece na tela.
- Para a retro, sem relação com o diff desta tarefa: o balde de 10 pedidos por minuto por IP da 5.0 descarta sem aviso o excedente de toda a equipe da escola, que sai pelo mesmo IP. Num dia de formação em que muitos professores pedem o link juntos, alguns não recebem o e-mail e a tela diz a mesma frase. A proteção de verdade é a de 3 por hora por e-mail. Vale medir se esse descarte acontece.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-08 18:32:22 · `tasks/prd-acesso-e-convites/6_task.md`

VEREDITO: APROVADO

Esta tarefa só mexe no frontend e não cria campo nem migration. Os dados pessoais que ela toca já têm finalidade e retenção no `docs/lgpd.md`, e as quatro telas não mostram dado de nenhuma pessoa.

Campos pessoais tocados: o e-mail da equipe (professor e coordenador), digitado no "Esqueci" e mandado no corpo de `POST /v1/senha/esqueci`. O token do link e a senha nova, mandados no corpo de `POST /v1/senha/redefinir`. Nenhum campo de aluno.

Fora da tabela de dados do docs/lgpd.md: nada. O `link_da_conta` está na linha 79, o e-mail enviado ao provedor de e-mail na linha 78 e os contadores do "esqueci" na linha 89, todos vindos da 5.0.

Autorização por objeto: não se aplica. As duas telas são anônimas e a posse do token é a única credencial. Sobre não confirmar existência:
- O "Esqueci" mostra a mesma frase para quem tem conta e para quem não tem, sem repetir o e-mail (`apps/web/src/pages/EsqueciASenha.tsx:36` e `:82-95`).
- No "Redefinir", link vencido, usado, inventado ou sem token dão o mesmo `LinkQueNaoVale` (`apps/web/src/pages/RedefinirSenha.tsx:41`, `:90-92`, `:104`).
- O e2e cobre os dois casos.

Token e URL:
- O token só vive no fragmento `#`, que o navegador não manda ao servidor nem no Referer.
- Ele sai da barra por `clearFragment` com `replaceState` antes de qualquer chamada, e de novo a cada link colado na aba (`RedefinirSenha.tsx:174-176`).
- Na API ele vai no corpo (`apps/web/src/api/senha.ts:22`), e o e-mail também vai no corpo, nunca na URL (`senha.ts:13`).
- O e-mail não passa pelo TanStack Query, então nenhuma chave de cache carrega o e-mail.
- O e2e confirma que a barra fica sem token (`e2e/esqueci-a-senha.spec.ts:238`, `:364`, `:372`).

Sessão: a troca de senha não abre login automático. O e2e confere que a tela volta à entrada sem "Sair" (`e2e/esqueci-a-senha.spec.ts:243-245`), e assim o segundo fator da coordenação continua sendo pedido. A senha é apagada da memória da tela assim que a troca dá certo e quando o link não vale.

Logs: limpos. Não há `console` nem envio para telemetria nos arquivos novos ou alterados.

Erros: o `ErrorState` mostra o texto do catálogo pelo código do erro, sem stack trace e sem dado.

Auditoria: não se aplica a esta tarefa. Redefinir a própria senha não está entre as ações que a regra 20, item 10, manda auditar, e o backend é da 5.0.

Envio externo: nenhum nesta tarefa. O e-mail da redefinição sai pelo worker da 5.0, que já está no mapa de dados (linha 78).

Seed/fixture: sintético. O e2e usa `criarEquipeComSenha` (nomes "sintética" com um UUID), endereços `@educa.invalid`, o Mailpit local e tokens inventados (`'A'.repeat(43)`).

Fotos da tela:
- `coordenacao--entrar--computador.png`: só o formulário e o link "Esqueci a senha".
- `coordenacao--esqueci--celular.png`: o campo vazio e a linha do aluno.
- `coordenacao--redefinir--computador.png`: o aviso único do link que não vale.
- `vazia--coordenacao--redefinir--celular.png`: o formulário com a regra da senha.
- As outras quatro fotos não abri.

Nenhuma das quatro que abri mostra nome, e-mail, matrícula ou conteúdo.

Pergunta de fechamento: a resposta não piora. Esta tarefa não guarda nada novo, e o que o fluxo guarda está mapeado, com retenção e expurgo pelo `sistema.expurgar-acesso`.

Bloqueantes: nenhum.

Recomendações:
1. `apps/web/src/pages/url-fragment.ts:22` limita o token do link de senha por `TAMANHO_MAXIMO_TOKEN_DE_CONVITE`. Funciona, mas o nome engana: vale um teto genérico de token de link, ou um próprio para o link de senha, em `packages/shared`.
2. O caso "enviado: a mesma frase..." simula o 202 (`e2e/esqueci-a-senha.spec.ts:151`), então a prova de que conta existente e inexistente recebem a mesma resposta é o teste de integração da 5.0. Vale citá-lo na tabela de testes da `tasks/prd-acesso-e-convites/6_task.md` para quem valida não achar que o e2e prova isso.
3. Na falha de rede do "Redefinir", a senha digitada fica no campo para o "Tentar de novo", como pede a spec. Não é furo, porque é só estado em memória de tela anônima, mas convém registrar na retro que foi uma escolha.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/api/senha.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/EsqueciASenha.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/RedefinirSenha.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/Entrar.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/paths.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/routes.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/esqueci-a-senha.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/interface.md`

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-08 18:32:46 · `tasks/prd-acesso-e-convites/6_task.md`

**VEREDITO: REPROVADO**

Escopo: respeitado
Aderência à Tech Spec: ok. As telas mostram os textos da tabela "Telas" do `cenarios.md`, e o `docs/interface.md` foi atualizado. Não há divergência sem registro.
Portão local: carimbo válido (`portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)`)

**Bloqueantes:**

1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/api/senha.ts:12-13` e `:21-22`. O corpo das duas chamadas é escrito à mão, `{ email }` e `{ token, senha }`, sem nenhuma ligação com o contrato que a 5.0 já publicou em `packages/shared/src/sessao/senha.ts` (`EsqueciSenhaRequest`, `RedefinirSenhaRequest`).
   - Como o `corpo` de `apiRequest` é `unknown` (`apps/web/src/api/client.ts:32`), o compilador não confere nada. Se o schema renomear `senha` ou acrescentar um campo, a web compila e só quebra na hora de usar. É o caso que a regra 00, item 6, e a regra 50, item 4, existem para impedir.
   - Também é um segundo jeito de fazer: `sessao.ts` (`entrarPorEmail(pedido: LoginEmailRequest)`, `entrarComSegundoFator(pedido: MfaRequest)`) e `convite.ts` (`AceitarConviteRequest`) já tipam o pedido pelo shared.
   - **Correção exigida:** importar `type EsqueciSenhaRequest` e `type RedefinirSenhaRequest` de `@educa/shared` e prender o corpo a eles. Pode ser pela assinatura (`pedirLinkDeSenha(pedido: EsqueciSenhaRequest)`, `redefinirSenha(pedido: RedefinirSenhaRequest)`) ou com `satisfies` no literal.

**Recomendações:**

- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/EsqueciASenha.tsx:20`: o comentário diz que o erro inclui "o limite do IP da escola". Pelo `cenarios.md` (tabela de limites, linha "Esqueci"), o limite responde "202 sem envio, nunca 429", então a tela nunca mostra esse erro. Tirar o trecho para o comentário não contradizer a spec.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/Entrar.tsx`: tirar os avisos para `AvisosDaEntrada` não estava pedido. É inofensivo e as mutações cobrem, mas não é a tarefa.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/6_task.md`: a mutação de `avisoDaEntrada() !== undefined` em `Entrar.tsx` está presa ao caso `botão ocupado: "Salvando…"`. O caso que prova esse aviso pelo nome é `esqueci → e-mail → senha nova: volta à entrada com o aviso…`, e apontar para ele facilita a leitura.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/url-fragment.ts`: o teto do token, `TAMANHO_MAXIMO_TOKEN_DE_CONVITE`, vale agora também para o link de redefinir e o de verificar. Um nome genérico no shared, como `TAMANHO_MAXIMO_TOKEN_DE_LINK`, deixaria isso claro. Fica para quando alguém mexer no shared.

**Fotos:** as oito batem com o RF12 e com a tabela "Telas":

- O link "Esqueci a senha" aparece só na entrada da equipe.
- O "Esqueci" mostra a linha "Aluno: peça a senha provisória ao professor."
- O aviso do link que não vale leva de volta ao "Esqueci a senha".
- O "Redefinir" mostra a regra à vista e o "Mostrar".

Não vi nada nelas fora do que a tarefa pede.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-08 18:33:33 · `tasks/prd-acesso-e-convites/6_task.md`

VEREDITO: REPROVADO

**Cenários exigidos** (tabela da 6_task.md e `cenarios.md`, "Telas", Esqueci e Redefinir, e "E2E (RF18)"):
- **Caminho feliz:** o pedido do link, o e-mail pelo Mailpit, a senha nova e a volta à entrada com "Senha trocada. Entre com a nova", sem login automático.
- **Entrada:** o link na entrada da equipe; o "Esqueci" inicial, com a linha do aluno; o "Esqueci" enviado, com a mesma frase para todos e sem repetir o e-mail.
- **Estados das duas telas:** botão ocupado; rede fora do ar com "Tentar de novo".
- **Redefinir:** a tela inicial (regra à vista, "Mostrar", `new-password`); o link vencido, usado ou inventado; o endereço sem token; a senha recusada.
- **Recomeço:** o mesmo link colado de novo, a resposta atrasada e a falha de rede. O caso da segunda pessoa não se aplica, porque as telas são anônimas.
- **Celular:** 360 px nas quatro telas.
- **Concorrência:** clique duplo no envio das duas telas.
- **Permissão:** a entrada do aluno não leva o link.
- **Isolamento:** não se aplica, porque as telas não têm escopo de escola. O isolamento da API está na 5.0.

**Cobertos:** cada linha da tabela cita um caso que existe em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/esqueci-a-senha.spec.ts`. Conferi os nomes um a um, também os itens juntados por ponto e vírgula.
- **Mutações:** as 32 batem com as cláusulas do diff, inclusive o `AvisosDaEntrada` que saiu do corpo do `Entrar`. Cada bloco cita um caso que chega à cláusula: o `key={vez}`, o `vezAtual() !== vez`, o `definirToken` (provado pela lista `[TOKEN_QUE_NUNCA_EXISTIU, TOKEN_B]`), o `noAr` e os dois lados do `if (!deNovo)`. As duas linhas sem bloco (`definirSenha('')`) não são condição e têm o motivo escrito.
- **Concorrência:** o clique duplo é provado de verdade, com o `requestSubmit` enquanto o primeiro envio está preso na porta e a contagem de pedidos igual a 1.
- **Resto:** não há `.skip`, nem teste comentado, nem IA. Os mocks com `page.route` só simulam a rede fora do ar ou a resposta atrasada, e não escondem regra da tela. Não rodei o e2e: precisa do ambiente do compose, e o portão já aplicou as mutações.

**Bloqueantes:**
1. **`e2e/esqueci-a-senha.spec.ts:245`: a asserção sempre passa** (regra 40, item 5). O caso diz no nome "sem login automático e sem sessão aberta", e prova "sem sessão" com `expect(page.getByRole('button', { name: 'Sair' })).toHaveCount(0)` em `/entrar`. Essa tela usa a `CascaPublica`, que nunca tem "Sair": o próprio arquivo diz "Nenhuma delas tem 'Sair'" (`apps/web/src/components/CascaPublica.tsx:62`). Mesmo com uma sessão aberta, a asserção fica verde.
   - **Correção exigida, uma das duas:**
     - provar a falta de sessão de verdade. Por exemplo: depois de cair em `/entrar`, abrir com `page.goto` uma rota da área do professor e esperar a volta a `/entrar`; ou pedir a renovação da sessão pelo `page.request`, com os cookies da aba, e esperar a recusa;
     - ou tirar a asserção e o "sem sessão aberta" do nome. Nesse caso, o "sem login automático" fica provado só pela URL e pelo aviso.

**Recomendações** (não bloqueiam):
- **`e2e/esqueci-a-senha.spec.ts:218, 228, 248, 259`:** os quatro casos pedem um link de verdade, nos dois projetos. São 8 pedidos contra o balde `rl:ip:senha`, de 10 por minuto. Quem roda o arquivo duas vezes no mesmo minuto, com `--manter-ambiente`, recebe 202 sem e-mail, e o `linkDoEmail` estoura o prazo. Vale registrar o teto num comentário, ou dar a esses casos um IP próprio (como o `ipSorteado()` da integração, se o caminho do e2e respeitar o `X-Forwarded-For`).
- **`RedefinirSenha.tsx:81`:** o `definirFalha(undefined)` depois da resposta não tem caso. Exemplo: depois de "Tentar de novo", a API recusa a senha (`ENTRADA_INVALIDA`), e o aviso de rede deveria sair junto com a regra no campo. Não é condição, então não falta bloco, mas um caso o prenderia.
- **A entrada do aluno não leva "Esqueci a senha":** está escrito no `docs/interface.md`, mas nenhum e2e prova. Uma linha no caso de `/entrar/<escola>` cobriria.
- **O link vencido:** o e2e cobre o usado e o inventado. O vencido cai no mesmo `NAO_ENCONTRADO` e está provado na API (`apps/api/test/senha-esqueci.int.test.ts:281`). Basta citar isso na linha da tabela.
- **"o link continua na tela" (`:297`):** com um token inventado, o caso prova só que o formulário fica. Que o token verdadeiro continua valendo depois de uma senha recusada é prova da API (`:588`), e vale citá-la na linha.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-08 19:57:10 · `tasks/prd-acesso-e-convites/6_task.md`

VEREDITO: APROVADO
Tela vista: sim (12 fotos lidas: /entrar, /esqueci e /redefinir, no computador e no celular, na escola cheia e na vazia). Não fotografei diálogo nem aba, porque as três telas não têm nenhum.
Estados: ok. Carregando é o "Enviando…" e o "Salvando…" no botão. Vazio é o formulário, que convida e traz a linha "Aluno: peça a senha provisória ao professor". Erro tem o aviso do que fazer, com "Tentar de novo" (rede ou 429), e o link vencido tem o aviso "Este link não vale mais. Peça outro em Esqueci a senha." com o botão para pedir outro. Com dado é a frase única de confirmação. Carregando e erro não aparecem na vitrine. Confiei no que o diff e o e2e declaram para esses dois.
Acessibilidade: ok. Os campos têm rótulo. O "(obrigatório)" e a regra dos 12 caracteres aparecem no campo da senha nova. Na foto, o foco visível está no campo de senha. O aviso de erro tem contraste suficiente. O e2e roda `seriousViolations`, e o diff não mexe nisso.
Chromebook fraco: sem impacto. Há só um formulário, sem lista e sem imagem enviada. O diff só troca a assinatura das chamadas de API.
Celular: ok a 360 px. Não vi rolagem horizontal nem texto cortado nas seis fotos. Os botões principais ("Entrar", "Enviar o link", "Definir a senha") medem cerca de 44 a 48 px de altura. Os secundários ("Esqueci a senha", "Voltar para entrar", "Mostrar") ficam bem acima de 24 px. Nada depende de hover.
Ação oficial protegida: sim. Nenhuma das telas faz ação oficial. A redefinição não abre sessão, e a coordenação continua passando pelo segundo fator na entrada.
Bloqueantes: nenhum.
- Rolagem: nenhuma tela passa da janela a 1366 × 768.
- Pele: está dentro de `docs/interface.md`, com onça, logotipo, paleta laranja e botões secundários no padrão.
- Texto: tudo em português, sem termo técnico nem texto em inglês.
- Correção da rodada: o diff é só tipagem do contrato (`EsqueciSenhaRequest` e `RedefinirSenhaRequest`, que existem em `@educa/shared`), um comentário e o e2e. Os dois pontos de chamada, `EsqueciASenha.tsx:45` e `RedefinirSenha.tsx:72`, foram atualizados, e não restou nenhum uso antigo. A foto confirma que não houve mudança visual.
- E2e: o caso novo prova que `/e/<slug>` não leva "Esqueci a senha". A foto de `/entrar` mostra o link só na entrada da equipe, como pede `docs/interface.md`. A prova de "sem sessão" agora é `page.goto('/professor/turmas')` voltar a `/entrar`, que é mais forte que olhar o botão "Sair".

Recomendações:
- Em `apps/web/src/api/senha.ts` (comentário de `pedirLinkDeSenha`), a linha ficou comprida, bem acima de 130 colunas. Vale reformatar.
- Em `/redefinir` sem token, o "Esqueci a senha" é o único caminho. É suficiente, mas um "Voltar para entrar" ao lado ajudaria quem chegou por engano.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-08 19:57:28 · `tasks/prd-acesso-e-convites/6_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

A correção exigida na rodada 1 foi feita. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/api/senha.ts:1,13,22`, o arquivo agora importa `EsqueciSenhaRequest` e `RedefinirSenhaRequest` de `@educa/shared`. Esses dois tipos vêm direto de `packages/shared/src/sessao/senha.ts`. As funções `pedirLinkDeSenha` e `redefinirSenha` recebem o pedido já com esse tipo e mandam como corpo da chamada. O carimbo do portão confirma que o typecheck passou. As duas telas (`EsqueciASenha.tsx:45` e `RedefinirSenha.tsx:72`) chamam as funções do jeito novo.

O restante do diff está dentro do escopo:
- **Caso novo no e2e:** a entrada do aluno não mostra o link "Esqueci a senha", conforme `docs/interface.md:1958-1959`. O caso tem mutação própria em `EntrarNaEscola.tsx`.
- **Teste de "sem sessão" mais forte:** antes ele só conferia que o botão "Sair" não aparecia. Agora abre `/professor/turmas` e confere a volta para `/entrar`.
- **Tabela de testes do `6_task.md`:** cita as provas da API da 5.0 para os casos que o e2e não cobre (link vencido, link substituído, senha recusada com link verdadeiro).

Não houve divergência nova em relação à Tech Spec nem ao `cenarios.md`. As fotos `coordenacao--esqueci--celular.png` e `vazia--coordenacao--redefinir--computador.png` batem com a linha "Esqueci/Redefinir" de `cenarios.md:260-261`, com o vocabulário certo e nada além do que a tarefa pede.

Recomendações:
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/api/senha.ts:10` e `:19`, duas linhas do comentário ficaram bem acima da largura das outras depois da edição. Vale quebrar no mesmo ponto que o resto do bloco.
- No mesmo comentário, "(regra 50, item 4)" serve de justificativa para usar o tipo do `@educa/shared`. Quem pede contrato em `packages/shared` é a regra 00. Vale conferir a citação.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-08 19:57:40 · `tasks/prd-acesso-e-convites/6_task.md`

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

O que a rodada 2 mudou não afeta a carga:
- **`apps/web/src/api/senha.ts`**: o corpo de `pedirLinkDeSenha` e de `redefinirSenha` agora usa os tipos `EsqueciSenhaRequest` e `RedefinirSenhaRequest`, de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/shared/src/sessao/senha.ts`. O payload continua `{ email }` e `{ token, senha }`. Não há chamada a mais, a API não muda e o "esqueci" não passa a responder 429.
- **`EsqueciASenha.tsx`** e **`RedefinirSenha.tsx`**: só a forma da chamada mudou. O comentário do "Esqueci" agora diz o que o código faz: o 429 vem do limite geral por IP das rotas anônimas, e os baldes do "esqueci" respondem 202 sem envio.
- **`e2e/esqueci-a-senha.spec.ts`**: o caso novo, da entrada do aluno, não gasta o balde `rl:ip:senha` e não chama provedor pago. A troca da checagem de "Sair" por `page.goto('/professor/turmas')`, que volta a `/entrar`, prova melhor que a sessão não abriu.

A rodada anterior não exigiu correção, então não há correção a conferir.

Recomendações:
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/esqueci-a-senha.spec.ts`, o bloco "Redefinir" gasta 8 dos 10 pedidos por minuto do balde `rl:ip:senha`, e o IP do compose de teste é compartilhado. O comentário explica isso, mas um caso real a mais, ou uma segunda execução no mesmo minuto com `--manter-ambiente`, faz o teste falhar por tempo, sem dizer por quê. Vale zerar o balde no seed do e2e, ou deixar o limite configurável no ambiente de teste, sem mexer no valor de produção.

## test-engineer · 2ª rodada · APROVADO · 2026-11-08 19:57:41 · `tasks/prd-acesso-e-convites/6_task.md`

VEREDITO: APROVADO

**Cenários exigidos:** o caminho completo de "esqueci a senha" até a senha nova pelo Mailpit, sem entrar sozinho e sem sessão aberta. Depois, a senha nova entrando, e o link que não vale mais (vencido, usado, substituído ou inventado), com a mesma tela para todos. Do lado da tela: a mesma frase de "enviado" para quem tem conta e para quem não tem, a senha recusada com o link continuando na tela, e os estados de botão ocupado e de queda de rede com "Tentar de novo". Na redefinição, o recomeço com o mesmo link colado de novo e com a resposta atrasada. Na permissão, a entrada do aluno não oferece "Esqueci", porque o aluno não tem e-mail. Na carga, o balde de 10 pedidos por minuto do IP da escola.

**Cobertos:**
- **Correção 1, feita.** A linha antiga que procurava "Sair" saiu. Em `e2e/esqueci-a-senha.spec.ts:260-261` o teste agora abre `/professor/turmas` pelo endereço e espera voltar a `/entrar`. A volta acontece porque a página recarrega inteira, a guarda `Protegida` (`apps/web/src/routes.tsx:85` e `:96`) tenta renovar a sessão pelo cookie, e só sem sessão manda de volta à entrada. Se a redefinição tivesse aberto uma sessão, a renovação daria certo, o endereço ficaria em `/professor/turmas` e a asserção ficaria vermelha. Então ela agora prova "sem sessão aberta", como diz o nome do caso.
- **Caso novo da entrada do aluno** (`e2e/esqueci-a-senha.spec.ts:147-154`). Ele espera a tela montar, com o nome da escola e o campo "Matrícula", antes de conferir que o link não existe, então não passa só porque a tela ainda não carregou. A 33ª mutação acrescenta o link ao formulário de `apps/web/src/pages/EntrarNaEscola.tsx`. O trecho que ela procura (`{entrando ? 'Entrando…' : ''}`, `</span>`, `</form>`, linhas 157-159) existe no arquivo, e o motivo esperado da falha é a asserção `toHaveCount(0)`. É o motivo certo.
- **Mutação do aviso de `Entrar.tsx`.** Antes ela apontava para "botão ocupado: Salvando…", que não chega até esse aviso. Agora aponta para `esqueci → e-mail → senha nova`, que confere o texto do aviso na entrada. O vermelho passa a vir do motivo certo.
- **Tabela de testes da tarefa.** Cada linha cita o seu teste pelo nome. As provas que o e2e não alcança (o 202 igual com e sem conta, o link vencido e o substituído, o link que continua valendo depois da recusa) citam os casos de `apps/api/test/senha-esqueci.int.test.ts` pelo nome.
- **Comentário do teto do balde.** Confere com o código: são quatro casos que pedem um link de verdade, um pela tela e três pela API, nos dois projetos. Isso dá 8 pedidos contra o balde de 10 por minuto.
- **Tipos vindos do `@educa/shared`** em `apps/web/src/api/senha.ts`. A mudança não tem efeito sobre os testes: os corpos enviados à API são os mesmos de antes.
- Nada desligado nos testes: sem `.skip`, sem teste comentado, e nenhuma simulação esconde a regra. O `page.route` só aparece nos casos de tela, e as provas da API estão citadas.

**Bloqueantes:** nenhum.

**Recomendações:**
- `e2e/esqueci-a-senha.spec.ts:96` e `:153` usam o heading com o nome da escola para saber que a tela montou. Se a `CascaPublica` deixar um dia de expor o título como heading, o caso fica vermelho pelo motivo errado, e o portão recusa a mutação. Não bloqueia: hoje o motivo esperado da falha está declarado e o portão já o conferiu.

Não rodei nenhum teste nesta rodada. Li só o diff entre as duas rodadas e o código que ele toca.
