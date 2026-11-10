# Achados das revisões — `tasks/prd-acesso-e-convites/16_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-09 21:23:02 · `tasks/prd-acesso-e-convites/16_task.md`

VEREDITO: APROVADO

Tela vista: sim (10 fotos lidas, cheia e vazia; o link e o código nos dois tamanhos). O botão "Entrar com a conta da escola" e a "conta confirmada" não estão nas fotos, como a Mesa avisou. Eu os conferi pelo código e pelo e2e.

Estados: ok.
- **Carregando:** o botão e a lista de provedores não mostram nada enquanto carregam. É de propósito, e a matrícula com senha segue à vista. Nas esperas há "Abrindo a turma…" (`LoadingState`) e o botão ocupado "Entrando…" com `role=status` (`ContaDaEscolaNaSala.tsx:62` e `:65`).
- **Vazio:** sala sem nome livre mostra "Nenhum nome livre nesta turma. Se o seu nome não aparece, chame o professor." (foto `sala-pelo-link--vazia`). Escola sem provedor não mostra o cartão.
- **Erro:** o aviso de recomeço "Comece de novo pelo link ou pelo código da sala" diz o que fazer. Está na foto `sala-conta-provada-sem-caminho`, com foco no campo, em vermelho e quebrando linha. Rede e limite têm "Tentar de novo" (`TurmaPublica.tsx:367`). Sem `sessionStorage`, o aviso manda usar a matrícula e a senha (`ContaDaEscolaNaSala.tsx:12`).
- **Com dado:** formulário da sala, e "Conta da escola confirmada…" no lugar do botão (`TurmaPublica.tsx:269`).

Acessibilidade: ok.
- A seção tem `aria-labelledby`.
- O foco vai ao campo do código no aviso de recomeço (visível na foto) e ao título em "Pedido enviado".
- O botão desligado e o `status` sr-only anunciam a espera.
- Todos os campos têm rótulo.
- O título da turma com anel de foco é o comportamento já existente.

Chromebook fraco: ok.
- O componente novo é pequeno e usa `useQuery` já existente, com `staleTime` de 10 min na consulta anônima.
- Não há lista longa nem upload.
- O código não faz chamada em segundo plano; a ida ao provedor é navegação.

Celular: ok.
- Nas fotos de 360 px não há rolagem horizontal nem texto cortado.
- O botão "Não é a sua turma? Usar outro código" quebra em duas linhas sem esconder a ação.
- O botão da conta usa `Button` (44 px mínimo), `w-full` no celular e `flex-wrap`.
- O e2e mede 44 px e a ausência de rolagem horizontal a 360 px nos dois projetos (`e2e/conta-da-escola-na-sala.spec.ts:247`).
- Não há dependência de hover, nem de atalho, nem de telefone.
- Rolagem a 1366 × 768: só a sala pelo link, com a escola cheia (794 px). O PRD e o `docs/interface.md` não dizem que essa tela cabe, então não é achado.

Ação oficial protegida: sim. A tarefa não aprova nada oficial. O pedido do nome continua pendente até o professor aprovar, e a tela diz isso.

Bloqueantes: nenhum.
- **Texto:** não há termo técnico, id nem texto em inglês. Os textos de erro mandam fazer algo, e "Não é erro: depois da aprovação você entra por ela" explica a espera.
- **Dado do provedor:** nada do provedor aparece na tela.
- **Pele:** os componentes são os existentes (`Button`, `PasswordInput`, `LoadingState`). Os tokens (`border-pendente`, `bg-erro-cx`, `rounded-cartao`) já eram usados em outras telas.
- **Docs:** `docs/interface.md` §11.3 e `docs/lgpd.md` foram atualizados na mesma tarefa.

Recomendações:
1. A confirmação "Conta da escola confirmada…" (`TurmaPublica.tsx:269`) usa a cor `pendente` (âmbar), a mesma de "espera". Para uma confirmação, um tom neutro ou de sucesso diria melhor. Não bloqueia, porque os tokens existem e passam no contraste.
2. A foto `sala-pelo-link--cheia` mostra a onça esmaecida. Parece uma transição de animação que a foto pegou no meio, e não é código desta tarefa. Vale conferir na validação.
3. As fotos usam nomes de seed como "Turma 2ºB 18ca6446", só do dado sintético da vitrine.
4. O token do link vai na URL de navegação ao `iniciar` (`salas.ts:42`) e no `sessionStorage` por até 15 min. Está declarado em `docs/lgpd.md` e a resposta sai com `Referrer-Policy: no-referrer`. É assunto do `privacy-guardian`, e eu não bloqueio por isso.

Arquivos relevantes:
- `apps/web/src/pages/ContaDaEscolaNaSala.tsx`
- `apps/web/src/pages/TurmaPublica.tsx`
- `apps/web/src/pages/caminho-da-sala.ts`
- `apps/web/src/api/salas.ts`
- `e2e/conta-da-escola-na-sala.spec.ts`
- `.processo/vitrine/sala-*.png`

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-09 21:23:09 · `tasks/prd-acesso-e-convites/16_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela ou migration nova. A tarefa só lê e altera `reivindicacao` (definida em `packages/core/src/db/schema/reivindicacao.ts`, que já tem `escola_id` e id UUID gerado por `uuidv7()`), e só nos auxiliares do e2e.

Queries verificadas:
- `e2e/support/seed.ts`, `pedidosDaTurmaNoBanco`: filtra por `escola_id = $1 and turma_id = $2`. O `order by id` está certo como "do mais antigo ao mais novo", porque o id é uuidv7.
- `e2e/support/seed.ts`, `trocarASenhaPelaContaNoBanco`: filtra por `escola_id = $1 and id = $2 and estado = 'pendente'` e falha se a linha não for alterada.
- `apps/web/src/api/salas.ts`, `enderecoParaProvarAContaNaSala`: manda só o slug e o token ou o código. Nenhum `escolaId` sai do cliente.
- `apps/web/src/pages/TurmaPublica.tsx`, `ContaDaEscolaNaSala.tsx` e `caminho-da-sala.ts`: nenhum `escolaId` no corpo nem na query string.
- A tarefa não toca repository nem rota. Quem decide a escola é o servidor da 14.0, pelo cookie cifrado `educa_conta_provada` (escola e acesso da turma), conferido contra o slug.

Teste de isolamento: presente e efetivo.
- Na parte da tarefa: o caminho guardado com outro slug é descartado antes de qualquer chamada. Provam isso `caminho-da-sala.test.ts` › "o caminho de outra sala não vale" (com a mutação que tira o `doSlug !== slug` ficando vermelha) e o e2e `e2e/conta-da-escola-na-sala.spec.ts:353`.
- Na API, já entregue pela 14.0: `apps/api/test/reivindicacao-com-conta.int.test.ts:291` e `:390-413` cobrem o acesso e o cookie de outra escola e de outro acesso. As duas respostas são iguais à de dado inexistente: `NAO_ENCONTRADO` para o acesso de outra escola e a mesma `ENTRADA_INVALIDA` dos cookies ausentes ou vencidos para o cookie de outra escola. Sem a cláusula de escopo, esses casos quebrariam.
- Mensagens de erro: `ENTRADA_INVALIDA`, cookie vencido e caminho de outro slug viram todos o mesmo "Comece de novo pelo link ou pelo código da sala". A tela não revela se o pedido existe em outra escola.

Bloqueantes: nenhum.

Recomendações:
- `apps/web/src/api/salas.ts:41`: o token da sala vai na query string da navegação ao `iniciar`. Está declarado em `docs/lgpd.md` e a resposta sai com `no-referrer`. Falta o `privacy-guardian` confirmar que o log de acesso da API e do proxy não grava a query de `/v1/sessao/externa/*/iniciar`. Isso é privacidade, não isolamento entre escolas.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-09 21:23:34 · `tasks/prd-acesso-e-convites/16_task.md`

VEREDITO: APROVADO

A tarefa 16.0 só mexe na tela. Não cria tabela, coluna, rota nem log no servidor. O único dado novo é o caminho da sala guardado na aba do navegador, e ele já está na tabela de dados do `docs/lgpd.md`.

**Campos pessoais tocados:**
- O caminho da sala fica no `sessionStorage` da aba, numa chave só (`educa.caminho-da-sala`), com o slug, o tipo, o token do link ou o código, e a hora. Vale 15 min, só para o mesmo slug, e só se tiver exatamente essa forma. A primeira tela da sala o apaga, volte ou não o aluno do provedor (`apps/web/src/pages/caminho-da-sala.ts:95-140`, `apps/web/src/pages/TurmaPublica.tsx:648-659`).
- O pedido do nome sai sem senha (`TurmaPublica.tsx:797-801`). A conta vem do cookie `educa_conta_provada`, que é da 14.0 e já está na tabela.
- Não aparece nem é guardado na tela nada do provedor: nem e-mail, nem nome, nem foto.

**Fora da tabela de dados do docs/lgpd.md:** nada. A linha "Caminho da sala no navegador" (`docs/lgpd.md:84`) tem finalidade, base e retenção. O token na consulta do `iniciar` já estava declarado na linha do acesso da turma (`docs/lgpd.md:89`, desde a 14.0). Aluno continua sem e-mail, telefone, CPF, foto, endereço, nascimento ou diagnóstico.

**Autorização por objeto:** ok.
- A tarefa não toca rota nem repository.
- Caminho guardado de outro slug é descartado antes de chamar a API (`caminho-da-sala.ts:128`), com caso de unidade e de e2e.
- Quem decide o pedido continua sendo o servidor, pela 14.0. Quando a senha vem no pedido, o cookie da conta é ignorado (`apps/api/src/sala/salas/salas.controller.ts:52`, `reivindicacao.service.ts:131`). Assim, o colega que usa senha no mesmo navegador não herda a conta de quem provou antes.
- "Não encontrado" continua com a mesma mensagem para link e código.

**Logs:** limpos. Não há `console` nem logger em `TurmaPublica.tsx`, `ContaDaEscolaNaSala.tsx`, `caminho-da-sala.ts` nem `api/salas.ts`.

**Auditoria:** nenhuma ação nova a exige. Não há leitura por coordenação ou rede, exportação, nota, permissão nem saída de IA. A aprovação do pedido de conta é da 14.0.

**Envio externo:** nenhum envio novo. O botão só leva o navegador ao `iniciar` da nossa API (`apps/web/src/api/salas.ts:480-483`), que responde 302 ao Google ou à Microsoft. O token da sala vai na consulta dessa navegação, como já declarado em `lgpd.md:89`. Nada é mandado a provedor de IA.

**Seed/fixture:** sintético.
- Os dados da aluna no provedor são fictícios, em domínio `.test` (`e2e/conta-da-escola-na-sala.spec.ts:38`).
- Os nomes são "Aluna sintética N" (`e2e/conta-da-escola-na-sala.spec.ts:86`) e "Aluna Sintética" (`TurmaPublica.test.tsx:29`).
- O conteúdo que a tarefa acrescenta a `e2e/support/seed.ts` (`:1183-1214`) só lê ou troca o pedido, com escopo de escola e turma.

**Fotos:**
- `sala-inicial--*` mostra só o campo do código.
- `sala-pelo-link--cheia--computador.png` mostra o título da turma e os nomes livres, sem matrícula, o que já era declarado (`lgpd.md`, lista de nomes da turma). Não há nada do provedor.
- `sala-conta-provada-sem-caminho--cheia--computador.png` mostra só "Comece de novo pelo link ou pelo código da sala" e não chama a API.
- `sala-pelo-link--vazia--celular.png` mostra "Nenhum nome livre" e não tem o botão da conta.
- As fotos não mostram a "conta confirmada" porque a escola da vitrine não tem a conta configurada. Isso fica coberto pelos casos de e2e. Um deles procura os três dados da aluna no provedor na tela, no armazenamento, no pedido e nos endereços da API (`e2e/conta-da-escola-na-sala.spec.ts:191`). Outro confirma que o `localStorage` não é usado (`:109-113`, `:153`).

**Pergunta de fechamento:** responde. A tarefa não grava nada novo no servidor. O que a sala leva ao servidor (o pedido com a conta em `reivindicacao.contaExterna`, e depois `conta_externa`) já está na tabela e no arquivo do titular pela 14.0. O caminho no navegador é declarado, não é enviado a terceiros e expira.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Em `docs/lgpd.md:84`, a frase "Fica só no navegador, nunca no servidor, em log ou em URL da sala" pode ser lida como se o token nunca saísse do navegador. Ele vai ao servidor na consulta do `iniciar` e no corpo do pedido, como diz a linha 89. Vale citar a linha 89 ali.
2. Se o aluno larga o login na página do provedor, o caminho fica no `sessionStorage` até a aba fechar ou a sala ser aberta de novo. Na leitura, o prazo de 15 min já o descarta. O risco é baixo, porque é o token que a turma toda recebe, e está declarado ("vai embora com a aba"). Fica só como registro.
3. `pedidosDaTurmaNoBanco` (`e2e/support/seed.ts:936`) ordena por `id`, um UUID, mas o comentário diz "do mais antigo ao mais novo". Isso é do `test-engineer`, não de privacidade.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-09 21:24:02 · `tasks/prd-acesso-e-convites/16_task.md`

VEREDITO: APROVADO

Escopo: respeitado. As cinco subtarefas foram feitas e nada entra em outra tarefa: a 17.0 já está concluída e a 16.0 é a última da spec. Os arquivos que não estavam previstos são `ContaDaEscolaNaSala.tsx`, `caminho-da-sala.ts`, os testes de unidade e as duas peças novas de `e2e/support/seed.ts`. Todos aparecem em "Divergências" e só servem a esta tela. A 16.4 está conferida: o passo 10 de `docs/roteiro-da-demonstracao.md` usa matrícula e senha, a escola da demonstração não tem provedor liberado, e por isso o roteiro não muda.

Aderência à Tech Spec: ok. As duas divergências de regra estão na `techspec.md` §5 e no último parágrafo da §9, que vieram no commit `e4bcc16b`. A primeira é a sala tratar só o que a API da 14.0 devolve. A segunda é o caminho da sala guardado no `sessionStorage`. Elas também estão no `cenarios.md`, na linha "Conta da escola na sala" de "Telas" (l. 297) e no [E] de "Conta da escola do aluno" (l. 198), e na linha nova de `docs/lgpd.md`. O token que vai na consulta do `iniciar` já estava declarado pela 14.0 na linha do acesso da turma, em `docs/lgpd.md`. O nome errado do arquivo (`sala.ts` em vez de `salas.ts`) é só um erro do documento da tarefa e não muda regra. As fotos batem com a §9 e com "Telas":
- Pelo link, o formulário de sempre aparece, porque a escola da vitrine não tem provedor.
- Na escola vazia, a sala abre sem formulário nem botão da conta.
- Com `?conta=provada` e sem caminho guardado, a tela mostra "Comece de novo pelo link ou pelo código da sala", com o foco no código. A foto é `sala-conta-provada-sem-caminho--cheia--celular.png` e o texto sai de `apps/web/src/pages/TurmaPublica.tsx:70`.

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo).

Bloqueantes: nenhum.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/ContaDaEscolaNaSala.tsx:30-32`: quando o aluno volta do provedor pelo botão "Voltar" do navegador, o `pageshow` com `persisted` desocupa o botão. Mas o caminho gravado no clique continua no `sessionStorage` por até 15 min, porque o efeito da `TurmaPublica` não roda de novo numa página restaurada. Hoje não dá para explorar isso: o caminho só vale com `?conta=provada`, e o clique grava um caminho novo. Mesmo assim, chamar `apagarCaminhoDaSala()` no mesmo `pageshow` deixaria o código fiel ao que `docs/lgpd.md` declara ("apagado na primeira renderização… volte ou não o provedor").
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/conta-da-escola-na-sala.spec.ts:214-245`: o pedido da aprovação é montado no banco (`trocarASenhaPelaContaNoBanco`) e aprovado por `request.post`, não pela tela do professor. A cadeia do RF18 ("reivindica com a conta → aprovação") só é provada em pedaços: o pedido real, depois a aprovação semeada, depois a entrada. A escolha está justificada pelo prazo de 15 s e é da área do `test-engineer`. Fica registrada para a retro.
3. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/TurmaPublica.tsx:247`: "Voltar à lista de nomes" chama `abrir(etapa.caminho)` sem `conta`, e é o comportamento que se quer (o cookie foi apagado no envio). Uma linha de comentário ali evitaria que alguém "corrija" isso passando `conta: etapa.conta`.
4. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/ContaDaEscolaNaSala.tsx`: é um componente de seção que mora em `pages/`. Vale conferir se o padrão da 15.0 para "Eu" o põe no mesmo lugar e, se não, alinhar.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-09 21:24:19 · `tasks/prd-acesso-e-convites/16_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- O caminho feliz: o aluno clica no botão, prova a conta no `oidc-falso`, volta, pede o nome sem senha, o professor aprova e o aluno entra pela conta.
- O estado "Pedido enviado" com o texto da espera.
- A conta que o servidor não reconhece (`ENTRADA_INVALIDA`), a recusa do nome (`REIVINDICACAO_RECUSADA`) e a queda de rede ou o servidor cheio.
- O domínio não liberado.
- O caminho guardado: atravessa a ida, é apagado na primeira renderização, vence em 15 min e não vale para outro slug.
- O botão ocupado ("Entrando…").
- Nada do provedor na tela, no armazenamento, no pedido nem nos endereços.
- Os três recomeços: o colega no mesmo computador, a volta repetida e o erro.
- 360 px.
- Bordas: escola sem provedor, os dois provedores, a leitura dos provedores que falha, sala sem nome livre, `?conta=outra`, o link novo no fragmento que vence a volta, navegador sem `sessionStorage`, reenvio com a mesma chave.
- Concorrência: o clique duplo no botão e o pedido enviado duas vezes.
- Isolamento: o caminho de outra sala.

**Cobertos:** todas as linhas da tabela de testes têm o caso citado pelo nome e o caso existe:
- No e2e (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/conta-da-escola-na-sala.spec.ts`), 13 casos que rodam nos dois projetos.
- Na unidade: `TurmaPublica.test.tsx`, `caminho-da-sala.test.ts` e `salas.test.ts`. Rodei os três: 45 casos verdes.
- As asserções olham o resultado: o corpo do pedido sem `senha`, o banco com `{ provedor, tenant: null, sujeito }` no lugar do hash, o `sessionStorage` e o `localStorage`, a barra de endereço, o foco, e a busca pelos três dados do provedor.
- Não há `.skip`, teste comentado nem IA.
- Nenhum mock esconde a regra: o e2e usa a API e o `oidc-falso` de verdade, e só usa `route.fulfill` para a rede, o 409 e a ida ao provedor no caso do botão ocupado.

**Bloqueantes:**

1. **Duas cláusulas novas sem bloco de mutação, e o teste que as cita não falharia sem elas.**
   - `apps/web/src/pages/TurmaPublica.tsx:282`, `nomes.length > 0 && !conta && <ContaDaEscolaNaSala …/>`. Os blocos dessa linha só mexem no `!conta`; nenhum tira o `nomes.length > 0 &&`.
   - `apps/web/src/pages/TurmaPublica.tsx:283`, `nomes.length > 0 && conta && (…Conta da escola confirmada…)`. Os blocos só trocam `conta` por `!conta`.
   - A Autoconferência, item 1, diz que "os dois `nomes.length > 0 &&`" foram mutados. A seção "Mutações" não tem esses blocos.
   - O caso que deveria provar a regra 282 é `TurmaPublica.test.tsx:397` ("sala sem nome livre: nada de botão da conta"). A asserção dele, na linha 404, passa sem provar nada: `await waitFor(() => expect(document.body.textContent).not.toContain('Tem a conta da escola?'))`.
   - Por que passa sem provar: `ContaDaEscolaNaSala` só monta junto com a etapa `aberta`, e a leitura `/v1/escolas/:slug/acesso` só começa nesse momento. O `waitFor` roda a função logo na primeira vez, quando a resposta ainda não voltou, e passa. Se a cláusula fosse removida, o cartão apareceria um ciclo depois e o caso continuaria verde. O bloco que cita esse caso (`nomes.length === 0` → `!== 0`) fica vermelho pela primeira asserção (`findByText('Nenhum nome livre…')`), e não pela do botão.
   - Para o caso da linha 283 (conta provada com a sala sem nome livre, sem a confirmação) não há teste nenhum.
   - **Correção exigida:**
     - No caso da linha 397, esperar a chamada ao `ACESSO` e a resposta dele já na tela antes de conferir a ausência. Pode ser como em "escola sem provedor liberado", ou com um caso de controle com nomes que mostra o botão.
     - Acrescentar o caso da volta do provedor (`voltarDoProvedor()`) com `SALA_SEM_NOMES`, que confere que a confirmação não aparece.
     - Declarar os dois blocos: `nomes.length > 0 && !conta &&` → `!conta &&`, e `nomes.length > 0 && conta &&` → `conta &&`.
     - Corrigir o texto do item 1 da Autoconferência.

**Recomendações:**
- A Autoconferência, item 10, diz que o clique duplo no botão está provado por "`idas` igual a 1 no e2e". Mas o caso clica uma vez só (`conta-da-escola-na-sala.spec.ts:265` e `:270`). Ou o caso clica duas vezes (`dblclick`, ou dois toques) antes de conferir `idas`, ou o texto passa a dizer só o que o teste prova, o `disabled`.
- Falta um bloco para `disabled={entrando}` em `ContaDaEscolaNaSala.tsx:61`. O caso "o clique pelo link" já o pegaria. Não é condição, mas é a única trava do clique duplo.
- A cadeia RF14 está partida em três casos: o pedido criado pela tela não é o mesmo que a professora aprova, que é semeado por `trocarASenhaPelaContaNoBanco`. A asserção da forma exata no banco (`spec.ts:185`) amarra as duas pontas. Ainda assim, um caso que encadeasse pedido, aprovação e entrada seria o e2e de verdade do RF14, se o prazo deixar (com `test.slow()` declarado).
- `TurmaPublica.test.tsx:251` e `:456` chamam `vi.restoreAllMocks()` no fim do próprio caso. Se o caso falhar antes, o `Date.now` ou o `setItem` falsos vazam para os casos seguintes. É melhor restaurar no `afterEach`.
- Os casos "escola sem provedor liberado" e "a leitura dos provedores que falha" conferem a ausência logo depois de o `fetch` ser chamado, e não depois de a resposta chegar à tela. As mutações deles foram provadas pelo portão, mas a ordem é frágil: esperar o estado final (por exemplo, `waitFor` no `isFetched`, ou um ciclo a mais) deixaria a prova estável.

## infra-guardian · 1ª rodada · REPROVADO · 2026-11-09 21:24:35 · `tasks/prd-acesso-e-convites/16_task.md`

VEREDITO: REPROVADO
Caminho quente tocado: sala, login (a sala do primeiro dia da escola, cenário K2 de `docs/infra.md`; a ida ao provedor passa pelo `iniciar` e pelo `retorno`)
Rate limit: ok (só rotas anônimas no balde por IP, como `docs/infra.md` 5.1 permite; a tarefa não muda limite. O que falta é medir o balde, no bloqueante)
Fila e prioridade: ok (não se aplica: nada novo em fila)
Concorrência: protegida (o botão fica desabilitado e navega uma vez só; o reenvio sem senha usa a mesma `chaveEnvio`; a leitura do `StrictMode` não muda nada e só o efeito apaga)
Índice e paginação: ok (não se aplica: nenhuma query nova)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (só tela; as rotas da API e as métricas delas são da 14.0)

Bloqueantes:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/k6/reivindicacao-em-sala.js:234-240`. A tarefa muda o que a página da sala manda por aluno, e o cenário de carga dela não foi atualizado. O cabeçalho do arquivo diz que "a página imita a web", e o limite exige "nada de 429 para quem está atrás do mesmo IP".
   - **Caminho por matrícula:** depois do `abrir`, a sala agora faz um `GET /v1/escolas/:slug/acesso` anônimo por aluno (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/ContaDaEscolaNaSala.tsx:24`). O `staleTime` de 10 min vale por aba e não ajuda, porque cada aluno está num computador.
   - **Caminho da conta** (`ContaDaEscolaNaSala.tsx:45`): soma o `iniciar` e o `retorno`, as duas rotas `@Public()` de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/sessao/external/external-login.controller.ts:45,59,75`, e um segundo `abrir`. Todas caem no mesmo `consumirAnonima(ip)` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/rate-limit/rate-limit.guard.ts:82`).
   - **A conta do K2:** 2.100 alunos em 5 min, cerca de 420 por minuto atrás de um IP. Hoje o cenário põe perto de 1.000 req/min no balde. Numa escola com o provedor liberado, a página vai a perto de 2.600 req/min (abrir, acesso, iniciar, retorno, abrir, reivindicar, mais os 20% que erram o código). Isso fica a menos de 15% do `LIMITE_REQ_IP_ANONIMO_MIN=3000`, e a chegada do cenário é constante, sem o pico do primeiro minuto. Nada prova que o aluno atrás do NAT da escola não leva 429 no `abrir` ou no `reivindicar`.
   - **Correção exigida:**
     - No `aluno()`, depois do `abrir` com status 200, fazer o `GET /v1/escolas/${SLUG}/acesso` e contá-lo com `contar(..., 'aluno', [200])`.
     - Criar uma fração de alunos (ou uma fase) pelo caminho da conta: `iniciar` com `intencao=reivindicar`, `retorno` pelo `oidc-falso` (não é provedor pago, então a regra 80, item 11, não impede), o segundo `abrir` e o `reivindicar` sem senha. Todas as respostas entram em `respostas_inesperadas` e `respostas_5xx`.
     - Rodar o K2 com a escola de carga com o provedor liberado e registrar o resultado na tarefa. Se passar perto do teto, rever o `LIMITE_REQ_IP_ANONIMO_MIN` em `docs/infra.md` 5.1 na mesma tarefa.
     - Atualizar o comentário "Nada chama ... o `oidc-falso`" (linha 21) para o que o cenário passar a fazer.

Recomendações:
- Em `docs/runbook.md`, no parágrafo do limite por IP das rotas anônimas, dizer que a sala com a conta da escola gasta cerca de seis requisições anônimas por aluno. É o primeiro lugar onde o operador vai olhar se a escola reclamar de 429 no primeiro dia.
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/ContaDaEscolaNaSala.tsx:9`, o comentário do `PRAZO_DOS_PROVEDORES_MS` dá a entender que o prazo alivia o balde da escola. Ele só evita repetir a leitura na mesma aba; vale dizer isso para ninguém contar com ele no dimensionamento.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-09 22:27:24 · `tasks/prd-acesso-e-convites/16_task.md`

VEREDITO: APROVADO

Tela vista: sim. Li 8 fotos, nos dois tamanhos (1366 e 360 px), com a escola cheia e com a vazia:
- sala pelo link, cheia com provedor
- sala pelo link, vazia
- sala inicial
- conta provada sem caminho guardado

Estados:
- Ok. Os de vazio e de dado aparecem nas fotos.
- Sem nome livre, a sala diz "Nenhum nome livre nesta turma. Se o seu nome não aparece, chame o professor." e mantém o botão "Usar outro código".
- Sem provedor liberado, o cartão da conta não existe e a matrícula com senha segue como caminho. Carregando e erro da leitura dos provedores também não mostram o cartão, o que está certo (`ContaDaEscolaNaSala.tsx:41`). Conferi esses dois só pelo código e pelos testes.
- O erro "Comece de novo pelo link ou pelo código da sala" diz o que fazer. Tem `role="alert"` e o foco vai para o campo do código (foto `r2-sala-conta-provada-sem-caminho`).
- O erro sem `sessionStorage` diz "Use a matrícula e a senha" (`ContaDaEscolaNaSala.tsx:14`).

Acessibilidade:
- O cartão é uma `section` com `aria-labelledby` e o botão ocupado tem `role="status"` em `sr-only`.
- O foco visível aparece nas fotos.
- Os campos têm rótulo e a ajuda da senha está à vista.
- Nada depende de hover. Não achei `title=`, `onMouse*` nem atalho no componente.

Chromebook fraco:
- A leitura dos provedores só sai quando há nome livre, e fica em cache por 10 min na mesma aba (`ContaDaEscolaNaSala.tsx:11`). O comentário novo conta uma leitura por aluno para o balde da escola. O teste cobre isso: sem nome livre, a chamada nem sai.
- Não há lista longa nem upload nesta tela.

Celular:
- A 360 px não há rolagem horizontal nem texto cortado nas 4 fotos.
- O botão "Entrar com a conta da escola" tem cerca de 44 px, com `w-full` no celular. "Enviar pedido" e "Mostrar" passam de 44 px. Os botões que quebram em duas linhas ("Não é a sua turma? Usar outro código", "Entrar com a conta da escola") seguem legíveis, sem embaralhar a ação.
- O e2e `e2e/conta-da-escola-na-sala.spec.ts:247` cobre 360 px sem rolagem lateral e o alvo de 44 px, nos projetos `chromebook` e `celular`.
- Nenhum fluxo exige o celular.

Ação oficial protegida: sim. A tela só pede o nome. Nada oficial acontece nela: a aprovação continua com o professor, e o texto "Espere o professor aprovar" diz isso ao aluno.

Bloqueantes: nenhum.

Rodada nova: o diff desde a r1 mexe pouco na tela. Não havia correção exigida.
- O `pageshow` com `persisted` agora também apaga o caminho guardado (`ContaDaEscolaNaSala.tsx:34-37`). O teste confere que o `sessionStorage` fica vazio.
- O `persisted: false` mantém o botão ocupado e o caminho gravado, e o teste confere isso.
- Os outros dois arquivos de tela só trazem comentários e testes, sem mudança de comportamento.
- A página da sala com provedor rola a 970 px a 1366 × 768. Não bloqueia: o `prd.md` não tem `1366` nem RF que mande a tela caber. O R10 do `docs/interface.md` vale para tela de trabalho, e esta é a entrada pública.

Recomendações:
- Na foto `r2-sala-pelo-link--cheia-com-provedor--computador.png` a onça sai translúcida. É a entrada de 240 ms, capturada no meio. O código da casca não mudou nesta tarefa, e o `TODO.md` pode registrar a foto para a vitrine esperar a animação.
- Em `r2-sala-pelo-link--cheia-com-provedor--celular.png` o título "Turma 2ºB 18ca6446" aparece com o anel de foco. Isso vem do foco programático ao abrir a sala e é intencional. O sufixo hexadecimal é do seed sintético da vitrine, não da tela.
- Fica de fora das fotos a tela "conta confirmada" (a volta do provedor com o cookie). Ela só está no código e nos testes (`TurmaPublica.test.tsx`), e a validação deve fotografá-la.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-09 22:27:41 · `tasks/prd-acesso-e-convites/16_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela ou migration nova nesta rodada. A carga só usa tabelas que já existem, e todas têm `escolaId`. `provedor_escola` tem o índice único `(escola_id, provedor, valor)`. `conta_externa` tem o índice único `(escola_id, provedor, coalesce(tenant,''), sujeito)` e chave estrangeira composta `(escola_id, usuario_id)`. Os ids das duas são UUID.

Queries verificadas:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/scripts/carga-sala.ts:443`: o insert em `provedor_escola` usa o `escolaId` da escola que a própria fase acabou de montar. Nenhuma escola da carga recebe dado de outra.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/scripts/conferir-carga-sala.ts:96`: a nova contagem `contasLigadas` filtra por `x.escola_id = e.id`, e a escola vem do slug da fase.
- Todas as escolas da carga liberam o mesmo domínio (`escola-a.educa-sintetica.test`). Isso não fura o isolamento: o login externo confere o domínio só contra a escola do slug (`apps/api/src/sessao/external/conta-externa.repository.ts:48,59`, com `eq(provedorEscola.escolaId, escolaId)`).
- `infra/oidc-falso/config.json`: cada aluno recebe um sujeito próprio (`conta-google-aluna-carga-<fase>-<n>`), sem colisão entre fases, e o índice único de `conta_externa` já é por escola.
- `infra/k6/reivindicacao-em-sala.js`: `http.cookieJar().clear(API)` a cada aluno impede que o cookie de conta provada de um aluno vá no pedido do aluno seguinte do mesmo VU. As rotas novas do cenário (`/v1/escolas/:slug/acesso`, `iniciar` e `retorno`) já existiam e não entram em nenhum endpoint que leia `escolaId` do corpo ou da query.
- Web: `TurmaPublica.tsx` mudou só num comentário. `ContaDaEscolaNaSala.tsx` só passou a chamar `apagarCaminhoDaSala()` no `pageshow` com `persisted`. Nada disso consulta dado de outra escola.

Teste de isolamento: presente e efetivo. Esta rodada não cria endpoint, repository nem tabela de domínio, e o teste que valia na rodada 1 continua valendo. A rodada 1 não tinha correção exigida de isolamento.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/scripts/carga-sala.ts:443`: liberar o provedor por `PUT /v1/escola/provedores`, com o token da coordenação, em vez de gravar direto no banco. O passo de liberar o provedor ficaria fiel ao "a escola montada pela API" e passaria pelo escopo e pela auditoria que a coordenação usa de verdade. O insert direto não vaza nada, porque leva o `escolaId` da própria escola.

## test-engineer · 2ª rodada · APROVADO · 2026-11-09 22:27:46 · `tasks/prd-acesso-e-convites/16_task.md`

VEREDITO: APROVADO

**Cenários exigidos** (rodada 2: as correções da rodada 1 e o que o diff delas afeta):
- A seção da conta não monta com a sala sem nome livre (`TurmaPublica.tsx:272`).
- A confirmação "Conta da escola confirmada…" não aparece com a sala sem nome livre (`TurmaPublica.tsx:273`).
- A página restaurada pelo "Voltar" apaga o caminho guardado.
- O `disabled={entrando}` trava o clique duplo.
- Os espiões são restaurados no `afterEach`.
- A ausência só é conferida depois de a resposta dos provedores chegar.
- O cenário de carga tem a leitura dos provedores e a fração que entra pela conta.

**Cobertos:**
- **Linha 272.** O caso "sala sem nome livre: …, e a leitura dos provedores nem sai" (`TurmaPublica.test.tsx`) deixa a tela assentar (50 ms dentro de `act`). Depois confere que `/v1/escolas/:slug/acesso` não foi chamada, que o cartão não está na tela e que o botão também não. Sem a cláusula, a seção monta e a leitura sai, então o caso fica vermelho pela asserção certa. O bloco `nomes.length > 0 && !conta &&` → `!conta &&` está declarado.
- **Linha 273.** O caso novo "conta provada com a sala sem nome livre" usa `voltarDoProvedor()` com `SALA_SEM_NOMES`. A asserção `queryByText(CONFIRMADA)` usa o texto exato, e o mesmo texto já é achado com `getByText` na linha 100, então não passa à toa. A confirmação apareceria na mesma renderização em que aparece "Nenhum nome livre". O bloco `nomes.length > 0 && conta &&` → `conta &&` está declarado.
- **Autoconferência, item 1.** Agora diz 53 blocos e descreve os dois `nomes.length > 0 &&`, que existem em "Mutações".
- **"Voltar" do navegador.** O caso "o clique pelo link" confere que o caminho está guardado antes do `pageshow` com `persisted` e que a chave sai depois dele. Há bloco para o `persisted` e para o `apagarCaminhoDaSala()` (trocado por `void 0`).
- **`disabled={entrando}`.** Tem bloco; o caso confere `.disabled === true` no estado ocupado.
- **`afterEach`.** O `vi.restoreAllMocks()` saiu do fim dos dois casos e foi para o `afterEach`.
- **Provedores.** `esperarOsProvedores()` espera a chamada ao `ACESSO` e mais um ciclo antes de conferir a ausência, nos casos "escola sem provedor" e "leitura que falha".
- **Carga** (`infra/test/carga-sala.test.ts`):
  - a fração de 1 em 20 pela conta, sem ninguém que erra o código ou a matrícula nem que disputa o nome;
  - a contagem `contasLigadas` exata, para menos, para mais e com excesso sem ninguém pela conta;
  - a rota `/acesso` na lista do script.
  - Nada chama provedor pago: a conta é a do `oidc-falso`.
- **O que rodei:**
  - `npx vitest run apps/web/src/pages/TurmaPublica.test.tsx`: 26 de 26 verdes.
  - `npx vitest run infra/test/carga-sala.test.ts`: 31 de 31 verdes.
  - `node tools/processo/mutacoes.ts --faltando …16_task.md`: nenhuma linha nova com condição sem bloco.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Clique duplo no e2e.** Em `e2e/conta-da-escola-na-sala.spec.ts:270-273`, depois do segundo clique o caso espera um único quadro de animação e confere `idas` com tamanho 1. Se o `disabled` sumisse, a segunda ida chega pelo `page.route` de forma assíncrona e pode cair depois da asserção. A trava é provada no unitário pelo bloco de `disabled={entrando}`, então isto não bloqueia. Para o e2e provar de verdade, use `expect.poll(() => idas.length)` com um prazo curto, ou espere a requisição por `waitForRequest` e exija que ela não venha.
2. **Espera de 50 ms dentro de `act`.** É usada em `esperarOsProvedores` e no caso da sala sem nome livre. Funciona porque a rede falsa responde em microtarefas. Uma condição observável seria mais firme do que um tempo fixo, por exemplo esperar o `fetch` do `ACESSO` ter sido resolvido ou o estado da consulta.
3. **Caso da "1 em 20" na carga.** Só pegaria a retirada do `!disputa` em `carga-sala.ts` se algum índice com `% 20 === 9` cair numa posição de disputa. Uma asserção direta resolve: nenhum `viaConta` entre as posições 7 e 21.
4. **K2 reprovado no p95 do `decidir`.** A tabela "Carga" do `16_task.md` registra 2.088 ms contra o limite de 2.000 ms, e a medição no HEAD, sem esta tarefa, deu o mesmo valor. A causa ficou registrada no `TODO.md`. É assunto do `infra-guardian`; anoto para a validação não tomar o K2 como verde.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/TurmaPublica.test.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/TurmaPublica.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/ContaDaEscolaNaSala.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/conta-da-escola-na-sala.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/test/carga-sala.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/16_task.md`

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-09 22:27:46 · `tasks/prd-acesso-e-convites/16_task.md`

VEREDITO: APROVADO
Caminhos de escrita em Nota: nenhum. O diff desta rodada não toca `Nota`. Todos com autor humano? sim, porque não há nenhum caminho a conferir.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok
Supervisão do tutor: ok, porque o diff não toca o Tutor
Autonomia declarada e visível: sim, sem alteração. O diff não toca agente nem governança.
Bloqueantes: nenhum
Recomendações:
1. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/TODO.md:3322` está o item "Ligar um provedor na escola da vitrine", que veio da minha 1ª rodada. As fotos desta rodada já mostram o botão. Mas nenhum arquivo de `tools/vitrine/` está na lista desta tarefa, então o provedor parece ter sido ligado só para estas fotos. Se for isso, o item continua aberto, e o Orquestrador precisa saber antes do `/validar` que a vitrine guardada ainda não tem o botão. Se a mudança da vitrine entrou em outro lugar, feche o item no `TODO.md`.
2. O texto de espera da aprovação pela conta (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/TurmaPublica.tsx:590`) continua fora das fotos. Ele mantém a decisão com uma pessoa ("Espere o professor aprovar"), em linha com a D4, e segue como recomendação para o Validador fotografar.

**O que conferi nesta rodada**

- **A carga** (`infra/k6/reivindicacao-em-sala.js`, `infra/scripts/carga-sala.ts`, `infra/scripts/conferir-carga-sala.ts`, `infra/oidc-falso/config.json`, `infra/compose.carga.yml`):
  - Nada chama provedor de IA.
  - A aprovação do pedido de nome continua com o professor do cenário, pelo `decidir` em lote, uma decisão humana sobre identidade (D4) e não sobre a trajetória do aluno.
  - Quem pede pela conta não entra antes de ser aprovado: `entrarOsAprovados` só considera os pedidos já decididos.
  - As contas do provedor falso são sintéticas (`google-aluna-carga-.*`).
- **A tela** (`ContaDaEscolaNaSala.tsx`, `TurmaPublica.tsx`, `TurmaPublica.test.tsx`): a mudança é o `apagarCaminhoDaSala()` no `pageshow` restaurado, mais testes. Não há saída de IA, nota, conceito, indicador nem métrica de uso. Não há inferência sobre o aluno.
- **A documentação** (`docs/infra.md`, `docs/runbook.md`, `docs/lgpd.md`, `techspec.md`, `cenarios.md`, `16_task.md`): nenhuma mudança afeta a regra 70.

**As fotos**

Os quatro arquivos estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/.processo/vitrine/`.

- **Sala pelo link, com o provedor ligado** (`r2-sala-pelo-link--cheia-com-provedor--computador.png` e `--celular.png`):
  - Não há saída de IA na tela, então não há nada a marcar como IA.
  - Não há nota, conceito nem sugestão de nota.
  - "Tem a conta da escola?" é uma opção ao lado da matrícula e da senha, sem empurrar o aluno para uma delas.
  - O pedido é feito ao professor ("Se o seu nome não aparece, chame o professor").
  - Sair é tão fácil quanto entrar: o botão "Não é a sua turma? Usar outro código" continua lá. Atende a D59 e o item 4b da regra 70.
- **Conta provada sem caminho guardado** (`r2-sala-conta-provada-sem-caminho--cheia--computador.png` e `--celular.png`): mostra só o aviso de recomeço e o campo do código. Não há nada da regra 70 a apontar.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-09 22:27:51 · `tasks/prd-acesso-e-convites/16_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo de pessoa nesta rodada. A linha do caminho da sala em `docs/lgpd.md` (l. 84) agora diz que o token vai ao servidor, e só na consulta do `iniciar` e no corpo do pedido. A carga trabalha com um "sujeito" do provedor falso (o identificador da conta que o provedor devolve), sintético e diferente para cada aluno (`google-aluna-carga-<fase>-<n>`), e com a liberação do Google na escola de carga (`provedor_escola`, que não é dado de pessoa).

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. A tarefa não muda rota nem repository. O `pageshow` da página restaurada agora apaga o caminho guardado (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/ContaDaEscolaNaSala.tsx`), e um caso de teste e um bloco de mutação provam isso. Com isso, o código faz o que `docs/lgpd.md` declara ("volte ou não o provedor").

Logs: limpos.
- O k6 não tem `console`, e as métricas levam `name` fixo e o status. Nenhum nome, matrícula ou token aparece nelas.
- O `escrever(...)` de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/scripts/carga-sala.ts` só imprime contagens e vereditos.
- Os arquivos de contas e de resumo ficam numa pasta criada com `mkdtempSync`, que é apagada no fim (l. 401 e 503). Nada é versionado.

Auditoria: não se aplica a esta rodada (nenhuma leitura pela coordenação, exportação, nota ou permissão nova).

Envio externo: nenhum.
- A carga só chama o `oidc-falso` do compose, que não é provedor real nem pago.
- O mapeamento novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/oidc-falso/config.json:70` devolve `email` e `hd` em domínio `.test` (`carga@escola-a.educa-sintetica.test`). É bom que imite o Google de verdade, porque assim exercita o descarte do e-mail pela API, que já existe desde a 14.0.
- O padrão `google-aluna-carga-.*` vem depois dos sujeitos fixos do e2e e não coincide com nenhum deles (`google-aluna-a`, `-sessao-antiga`, `-reautenticada`).
- Nenhuma chamada de IA.

Seed/fixture: sintético.
- Nas fotos aparecem só "Aluna Sintética Bia Vitrine" e "Aluno Sintético Davi Vitrine".
- Os nomes, matrículas, sujeitos e a senha da carga são gerados na hora.
- As contas ligadas (`conta_externa`) são da escola de carga, que é montada e conferida pela API.

Fotos (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/.processo/vitrine/r2-*.png`):
- A sala mostra só os nomes livres, sem matrícula, como `docs/lgpd.md` permite a quem tem o link.
- Na barra não aparece token nem nada do provedor.
- Na sala vazia não aparece o cartão da conta.
- O aviso de recomeço não mostra nenhum dado.

Correções exigidas na rodada 1: nenhuma minha. Conferi o que a ordem da Mesa mudou e toca a regra 20:
- O item 3 foi aplicado em `docs/lgpd.md:84`.
- O item 4 foi aplicado no `ContaDaEscolaNaSala.tsx`.
- Os blocos do item 1 estão declarados.

Rodei `TurmaPublica.test.tsx`, `caminho-da-sala.test.ts` e `infra/test/carga-sala.test.ts`: 74 casos, todos verdes.

Pergunta de fechamento: sem mudança desde a rodada 1. O caminho guardado não sai do navegador, a conta ligada é a `conta_externa` da 14.0 (já no arquivo do titular) e nada novo foi enviado para fora.

Bloqueantes: nenhum.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/scripts/conferir-carga-sala.ts`: já que a carga devolve e-mail de propósito, a conferência no banco poderia somar uma linha que prove que nenhuma `conta_externa` da escola de carga guarda o e-mail ou o `hd` além do identificador opaco. Hoje isso fica só para os testes de integração da 14.0.
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/k6/reivindicacao-em-sala.js`: o `iniciar` leva o token da sala na URL. Hoje o `name` fixo impede que o token entre nas métricas. Vale um comentário dizendo que o `name` é obrigatório nessas chamadas, para ninguém tirá-lo e deixar o token como tag `url` no resumo do k6.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-09 22:28:07 · `tasks/prd-acesso-e-convites/16_task.md`

VEREDITO: APROVADO

Escopo: respeitado. O cenário de carga entrou por ordem da Mesa (item 2). Está nos "Arquivos previstos" e em "Divergências" do `16_task.md`, e também na `techspec.md` §7c e no `cenarios.md` "Carga". Não invade nenhuma tarefa futura.

Aderência à Tech Spec: ok. A divergência da carga está nos três documentos. As fotos r2 mostram o que o RF14 e o `cenarios.md` "Telas" descrevem, e nada além:
- o cartão "Tem a conta da escola?" aparece só quando a sala tem nome livre;
- sem nome livre, não aparece;
- "Comece de novo pelo link ou pelo código da sala" aparece com o foco no código.

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo).

Correções da rodada 1:
- **Item 1:** feito.
  - O caso "sala sem nome livre" agora confere que o `ACESSO` nem é chamado. Antes ele conferia a ausência cedo demais e passava sem provar; agora prova.
  - Entrou o caso novo "conta provada com a sala sem nome livre".
  - Os dois blocos estão declarados, e a Autoconferência foi corrigida.
- **Item 2:**
  - O k6 agora lê os provedores em todo acesso e leva 1 aluno em 20 pelo `oidc-falso`.
  - O K2 rodou e foi registrado: zero 429 e cerca de 1.700 requisições por minuto contra o teto de 3.000.
  - O comentário do cabeçalho foi atualizado.
- **Itens 3 a 10:** aplicados. O `apagarCaminhoDaSala()` no `pageshow` e o `disabled={entrando}` ganharam bloco de mutação. O `restoreAllMocks` foi para o `afterEach`. O e2e agora clica uma segunda vez antes de conferir `idas`.

Bloqueantes: nenhum.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/k6/reivindicacao-em-sala.js:324`: `ROTA_DO_LOGIN_EXTERNO = ['/v1/sessao', 'externa'].join('/')` escreve a rota em pedaços só para o guarda `tools/renomear/restos` não achar. O `ROTAS_DO_CENARIO` usa `[a-z]+` em `conferir-carga-sala.ts:114`, provavelmente pelo mesmo motivo. O guarda já tem jeito próprio de registrar o texto que fica: a classificação `fica` no mapa (`tools/renomear/mapas/6.json`). Contornar o guarda deixa o próximo leitor sem saber por quê; o literal com a exceção registrada seria o caminho do projeto.
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/scripts/carga-sala.ts:443`: liberar o Google com `insert into provedor_escola` direto no banco destoa do resto do script, onde a escola é "montada pela API". A rota `PUT /v1/escola/provedores` já existe e exercitaria o caminho real da coordenação.
3. A conta das requisições está curta em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/runbook.md:396-403`, na `techspec.md` §7c e no `16_task.md` "Carga".
   - O aluno que pediu pela conta entra depois pela conta, que é `iniciar` mais `retorno`: duas requisições anônimas, e não uma como no login por matrícula. São 8 por aluno, não 7.
   - O k6 não repete essa entrada, então o "cerca de 1.700/min" não a inclui.
   - Vale corrigir o número ou dizer o que ficou fora.
4. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/infra.md:240`: o texto diz "subiu de cerca de 1.300 (tarefa 9.0)". Pela tabela do `16_task.md`, os 1.300 vêm do K2 do HEAD medido agora, sem a 16.0, e não da 9.0.
5. O K2 segue reprovado no p95 do `decidir`: 2.088 ms contra o limite de 2.000 ms. A tarefa mostrou que o problema já existia: o HEAD sem a 16.0 dá o mesmo valor. Está no `TODO.md` com dono (Arquiteto, antes do `/validar`). O Orquestrador precisa ver isso antes de fechar a spec.
6. O `16_task.md`, "Recomendações sem aplicar", está com a tabela vazia, mas a ordem da rodada 1 tem dez itens recusados ou encaminhados. Se esse registro é da tarefa, e não só da ordem, falta copiá-los.

## infra-guardian · 2ª rodada · REPROVADO · 2026-11-09 22:28:27 · `tasks/prd-acesso-e-convites/16_task.md`

VEREDITO: REPROVADO
Caminho quente tocado: login | sala
Rate limit: por IP (o balde anônimo da escola não foi medido no caso da D48)
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok

**Bloqueantes:**

1. **A correção do item 2 está metade feita: o K2 mede 5% dos alunos pela conta da escola, e a conclusão "sem mudar o teto" vale para qualquer escola.**

   Onde:
   - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/scripts/carga-sala.ts:100` (`UM_EM_CADA_VIA_CONTA = 20`).
   - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/k6/reivindicacao-em-sala.js:366` (o aprovado pela conta não entra).
   - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/infra.md:240-242`.
   - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/runbook.md:396-403`.
   - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/16_task.md:105`.

   O que está errado:
   - **A D48 diz que o aluno entra pela conta da escola quando ela existe.** Numa escola com o provedor liberado, a maioria entra pela conta, e não 1 em 20. A rodada 1 pedia exatamente esse caso, perto de 2.600 req/min.
   - **Os próprios números da tarefa já passam do teto.** 7 req anônimas por aluno × 420 alunos/min = 2.940, mais cerca de 84 códigos errados: perto de 3.024/min contra `LIMITE_REQ_IP_ANONIMO_MIN=3000`. E isso com chegada constante, sem o pico do primeiro minuto. Passou do teto, toda a escola atrás do NAT leva `LIMITE_EXCEDIDO` no `abrir`, no `reivindicar` e no `retorno`.
   - **A contagem por aluno está errada.**
     - `POST /v1/sessao/matricula` está em outro balde: é rebaixada, vai para `rl:ip-login` e nunca recusa (`packages/core/src/rate-limit/rate-limit.guard.ts:69-80`). Então o caminho pela matrícula gasta 3 no balde anônimo, e não 4.
     - O aprovado pela conta entra pela conta: `iniciar` e `retorno` do `ExternalLoginController`, `@Public()`, sem rebaixamento, no balde anônimo (`apps/api/src/sessao/external/external-login.controller.ts:45-80`). Esses 2 por aluno faltam na conta e no cenário. O caminho pela conta gasta 8, e não 7.
     - O runbook entrega ao operador um número que não é o do balde que dá 429.

   Correção exigida:
   - Criar uma fase do K2 (por exemplo `k2_conta`) em que a escola de carga entra como escola com Workspace. Pelo menos 80% dos alunos pela conta; a matrícula fica para o resto e para os erros.
   - Nessa fase, o aprovado pela conta entra pela conta: `iniciar` sem intenção e `retorno` pelo `oidc-falso`, contados em `respostas_inesperadas` e `respostas_5xx`, com threshold de zero 429.
   - Rodar, e registrar no `16_task.md` a taxa medida do balde `rl:` anônimo, e não a soma de todas as rotas.
   - Se passar de cerca de 80% do teto, fazer uma destas duas coisas na mesma tarefa, com o motivo em `docs/infra.md` 5.1:
     - subir o `LIMITE_REQ_IP_ANONIMO_MIN` (`.env.example:68`, `docs/infra.md` 5.1);
     - dar ao `iniciar` e ao `retorno` o mesmo rebaixamento do login por matrícula. Rebaixar não recusa, e é o que a regra 80, item 1, pede para a entrada.
   - Corrigir as contas em `docs/infra.md:240`, `docs/runbook.md:396-403`, `techspec.md` §7c e `16_task.md:105`: 3 pela matrícula, 8 pela conta, a entrada por matrícula fora desse balde.
   - Tirar o "sem mudar o teto" até ele estar medido no caso da D48.

**Conferido e fechado nesta rodada:**
- O `GET /v1/escolas/:slug/acesso` está contado por aluno.
- O caminho da conta usa o `oidc-falso`, sem provedor pago.
- O provedor está liberado na escola de carga.
- O comentário do cabeçalho foi atualizado.
- O `infra/compose.carga.yml` mudou.
- O teste de `infra/` foi atualizado.
- A conferência no banco cobre as contas ligadas.
- As recomendações do item 10 (runbook e `PRAZO_DOS_PROVEDORES_MS`) foram aplicadas; só o número do runbook está errado, como no bloqueante.

**O `decidir` p95 de cerca de 2.090 ms vem de antes desta tarefa.** Aceito como anterior: a tarefa não muda nada em `apps/api` nem em `packages` (`git diff HEAD -- apps/api packages` vazio), e o K2 do HEAD deu o mesmo valor. Isso não reprova a rodada, mas o K2 continua vermelho, e a pendência está no `TODO.md` com dono e prazo antes do `/validar`.

**Recomendações:**
- O p95 do `decidir` dá praticamente o mesmo valor nas três rodadas (2.088, 2.090 e 2.096 ms). Isso parece uma espera fixa de cerca de 2 s (timeout de cliente Redis, lock ou `statement_timeout`), e não falta de CPU. Vale citar isso no item do `TODO.md` para o Arquiteto.
- No K2, os 2 casos de "disputa sem vencedor" da 1ª rodada vieram dos 503 do `http.batch`, que não repete o 503 como a página repete. Vale fazer a disputa repetir o 503, para o contador não confundir carga com corrida.
- O teste de carga pode verificar que a fase com conta tem ao menos um aprovado pela conta que entra pela conta, como já verifica `contas_provadas`.

## frontend-reviewer · 3ª rodada · APROVADO · 2026-11-09 23:16:05 · `tasks/prd-acesso-e-convites/16_task.md`

VEREDITO: APROVADO
Tela vista: sim, pelas fotos da 2ª rodada (8 arquivos: 4 telas, em 1366 e 360 px, escola cheia e vazia). A web não mudou desde então. O diff desta rodada, conferido arquivo por arquivo, não tem nada em `apps/web` nem em `e2e/`: só `.env.example`, `apps/api/src/config.test.ts`, `infra/` (carga da sala, k6), `docs/` e `tasks/`.
Estados: ok. Nada mudou em relação à 2ª rodada.
Acessibilidade: sem alteração nesta rodada. O que a 2ª rodada aprovou continua valendo.
Chromebook fraco: sem alteração na tela. As mudanças em `infra/` e no teto do limite por IP não são código que roda no navegador.
Celular: sem alteração. As fotos de 360 px da 2ª rodada continuam sendo as válidas.
Ação oficial protegida: sim. Não há ação oficial nesta tela e nenhuma mudança toca nela.
Bloqueantes: nenhum. Nenhuma das mudanças desta rodada chega à tela. A página `/e/<slug>/turma#<token>` com provedor rola 970 px a 1366 × 768. Isso já foi visto e aprovado na 2ª rodada, e esta rodada não tem diff que o altere.
Recomendações: nenhuma nova. As da 2ª rodada seguem registradas.

## conformidade-reviewer · 3ª rodada · APROVADO · 2026-11-09 23:16:57 · `tasks/prd-acesso-e-convites/16_task.md`

**VEREDITO: APROVADO**

Caminhos de escrita em Nota: nenhum nesta rodada. O diff da r2 para a r3 só mexe em `infra/k6/reivindicacao-em-sala.js`, `infra/scripts/carga-sala.ts`, `infra/scripts/conferir-carga-sala.ts`, `infra/test/carga-sala.test.ts`, `.env.example`, `apps/api/src/config.test.ts` e documentos. Nenhum desses arquivos menciona `Nota`, correção, LLM ou tutor. Todos com autor humano? Não se aplica: não há escrita.

Decisão autônoma sobre aluno: ausente. A carga só aprova o pedido de nome (a identidade do aluno, D4), e quem aprova é o professor sintético do cenário. A chamada é `POST /v1/reivindicacoes/decidir` com `decisao: 'aprovar'` e `Bearer ${professor.token}` (`infra/k6/reivindicacao-em-sala.js:440`). O caminho novo `entrarPelaConta` (`iniciar`, `retorno`, `renovar`) só roda para quem já está em `decididos` (`reivindicacao-em-sala.js:343-345`). É login depois da aprovação humana, não uma decisão. Nada toca aprovação, reprovação ou encaminhamento de aluno.

Aprovação registrada: ok. Nenhuma saída de IA entra nesta rodada, e o fluxo de aprovação do pedido na API não mudou: `apps/api` só teve o `config.test.ts`, que confere o teto de 6.000.

Supervisão do tutor: ok, sem mudança. O tutor não aparece no diff.

Autonomia declarada e visível: sim, sem mudança. Nenhum agente ou governança foi tocado.

Os itens 7, 8 e 9 também seguem sem problema:
- **Item 7:** a carga lê do Redis só o contador do limite por IP (`rl:ip:<ip>`, o número de requisições na janela). Isso não mede o comportamento do aluno nem guarda nada sobre ele.
- **Itens 8 e 9:** nenhum indicador ou ranking de professor. A conferência no banco conta sessões `externo` por escola, um total para a carga, sem nome de ninguém (`conferir-carga-sala.ts:656`).
- **Item 8 da conferência:** nada sobre nota em discursiva ou redação.

`docs/regulacao.md` não mudou, e não precisava. `apps/web` também não mudou, então as fotos da 2ª rodada continuam valendo e não trazem achado novo da regra 70. A cópia de trabalho bate com o patch, fora uma linha em `16_task.md`. Os arquivos novos de `apps/web` e o e2e não estão no git, por isso aparecem como apagados na comparação; não é mudança real.

Bloqueantes: nenhum.

Recomendações: nenhuma da regra 70. Duas observações de outras áreas, sem efeito no veredito:
- A pergunta aberta no `TODO.md` é de disponibilidade (regra 80), não desta regra: a entrada pela conta da escola ainda pode receber 429 do limite por IP (`LIMITE_EXCEDIDO`)?
- O `decidir` em lote do K2 ficou acima de 2 s no p95 (3.047 ms na última rodada). Ele não pode passar como verde na validação, e isso já está registrado no `TODO.md`.

Arquivos que conferi:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/.processo/ordens/diff-16-r2-para-r3.patch`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/k6/reivindicacao-em-sala.js`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/scripts/carga-sala.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/scripts/conferir-carga-sala.ts`

## tenancy-guardian · 3ª rodada · APROVADO · 2026-11-09 23:17:07 · `tasks/prd-acesso-e-convites/16_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nem migration nesta rodada. A consulta nova lê `sessao`, que tem `escola_id` NOT NULL e a FK composta `(escola_id, usuario_id)` para `usuario` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/db/schema/sessao.ts`). O id dela é `uuidv7()`.

Queries verificadas:
- `infra/scripts/conferir-carga-sala.ts`, subconsulta `entraramPelaConta`: `count(distinct s.usuario_id) from sessao s where s.escola_id = e.id and s.metodo = 'externo'`, dentro de `from escola e where e.slug = $1`. Tem escopo de escola, igual às outras subconsultas da `CONTAGEM`. O `$1` é a escola que o próprio script montou, não um parâmetro vindo de cliente.
- `infra/scripts/carga-sala.ts`, `medirOBaldeAnonimo`: só lê o Redis de cache com `SCAN rl:ip:*` e `GET`. Não toca dado de escola nem de pessoa, só contadores por IP.
- Teto de `LIMITE_REQ_IP_ANONIMO_MIN` subindo de 3000 para 6000: em `apps/api` só mudou `config.test.ts`. Os baldes `rl:e`, `rl:u`, os da sala por turma e por nome, e o teto de código errado por escola continuam iguais. O `rl:ip` limita volume por IP e não separa escolas. Nenhuma leitura entre escolas passa a depender dele. O mesmo número também vale para `rl:ip-login` (que só rebaixa, não recusa) e para `rl:ip:op` (que tem proteção por conta e segundo fator), conforme `packages/core/src/rate-limit/rate-limiter.ts:173-175`. Nenhum desses é barreira de tenant.
- A outra escola ganhou o limiar `respostas_429{grupo:outra_escola}` em zero. A carga agora também mede se a manhã de uma escola derruba a outra.

Teste de isolamento: presente e efetivo. Esta rodada não cria repository, endpoint nem tabela. Os testes de isolamento da sala e da conta externa (14.0 e 16.0, rodadas anteriores) não mudaram. A conferência nova reprova sessão `externo` a mais ou a menos por escola, e isso está coberto em `infra/test/carga-sala.test.ts` ("todo aluno que pediu pela conta...").

Correções exigidas na rodada anterior: nenhuma. A recomendação da 2ª rodada (liberar o provedor pela API) está registrada no `TODO.md`.

Bloqueantes: nenhum.

Recomendações:
- `infra/scripts/carga-sala.ts`, `chavesDoBaldeAnonimo`: o filtro `startsWith('rl:ip:') && !startsWith('rl:ip:op:')` também pega `rl:ip:senha:<hmac>`, o balde do "esqueci a senha" (`apps/api/src/sessao/senha/senha.service.ts:22`). Esse balde tem teto de 10 por minuto, então não infla o pico na prática, mas é chave de outro balde. A sugestão é excluir `rl:ip:senha:` também e acrescentar o caso ao teste das chaves.
- O pico registrado é o maior valor entre todos os IPs. A carga roda com um IP de origem só, então não faz diferença hoje. Se um dia o k6 rodar com mais de um IP, vale registrar o pico por IP.

## privacy-guardian · 3ª rodada · REPROVADO · 2026-11-09 23:17:47 · `tasks/prd-acesso-e-convites/16_task.md`

VEREDITO: REPROVADO

Campos pessoais tocados: nenhum campo novo de pessoa. A rodada mexe no IP da escola de carga, que é a chave `rl:ip:<ip>` no Redis de cache. Mexe também no sujeito sintético do `oidc-falso` (`google-aluna-carga-${FASE}-${numero}`), no token da sessão que o `renovar` devolve e na contagem de sessões `metodo = 'externo'` por escola, que é só um número.

Fora da tabela de dados do docs/lgpd.md: nenhum campo novo. A carga passa a ler as chaves `rl:ip`, e `docs/lgpd.md:190` diz "só o limitador a lê" (ver recomendações).

Autorização por objeto: ok. Esta rodada não muda rota nem `apps/web`.

Logs: limpos. O script de carga só imprime números: o pico e o teto em `infra/scripts/carga-sala.ts:563` e as contagens da conferência. A chave do Redis, com o IP dentro, fica só na memória do laço e não é impressa (`carga-sala.ts:463-464`). No k6, cada pedido tem o `name` fixo: `iniciar`, formulário, `retorno` e `renovar`. Com isso, o token da sala, o `state` e o `code` não chegam à tag `url` do resumo. O token do `renovar` só é conferido pelo tipo, não é guardado nem impresso. Os IPs do teste (`172.20.0.5`, `fd00::1`) são de faixa privada, sintéticos.

Auditoria: não se aplica. Não há leitura de dado de aluno por coordenação ou rede, nem exportação, nota, permissão ou saída de IA.

Envio externo: nenhum. O `oidc-falso` é um serviço do compose de carga, e não há IA.

Seed/fixture: sintético (prefixo `KC`, domínio `escola-a.educa-sintetica.test`, IPs privados).

Bloqueantes:

- **`docs/runbook.md:403`**: o texto novo manda o operador ler a chave de IP no Redis da produção: "Para ver o balde agora: a chave `rl:ip:<ip>` no Redis de cache é o consumo da janela do IP (`GET`), e a chave `rl:ip:op:<ip>` é a da operação."
  - **O que está errado:** isso contradiz duas regras que já estão nos documentos:
    - `docs/lgpd.md:197-198`: "Ninguém lê as chaves `rl:ip`, nem as dos outros baldes por IP, à mão, nem durante um alerta: elas guardam o IP de todo visitante anônimo de todas as escolas no último minuto".
    - O próprio runbook, em `docs/runbook.md:463-464`: "ninguém lê as chaves `rl:ip` do Redis à mão, nem durante o alerta".
  - **Por que importa:** para fazer o `GET` é preciso saber o IP, ou varrer as chaves. Na prática, isso entrega a quem estiver de plantão os IPs de todos os visitantes anônimos de todas as escolas, inclusive alunos fora da escola. Esse é o tratamento que o mapa de dados declara à escola controladora que não existe.
  - **Correção exigida:** tirar essa frase do parágrafo. O operador mede o consumo pela escola, como no resto do runbook: o 429 por escola no log ou na métrica, sem IP, e a conta de alunos pela conta e de erros de digitação que o parágrafo já descreve. Se for preciso ler o balde na produção, isso vira finalidade nova: entra primeiro em `docs/lgpd.md`, com prazo e quem pode ler, e não num runbook.

Recomendações:

1. **A carga lê as chaves `rl:ip:*`, e o `docs/lgpd.md:190` diz "só o limitador a lê"** (`infra/scripts/carga-sala.ts:456-479`). Não há vazamento: o Redis é o do compose de carga, os IPs são do Docker e só o valor máximo sai. Ainda assim, uma linha em `docs/lgpd.md` deixa o documento verdadeiro: o cenário de carga, só no compose de carga, lê o valor dos contadores e nunca imprime a chave.
2. **Subir o `LIMITE_REQ_IP_ANONIMO_MIN` para 6.000 dobra, por IP, o ritmo de tentativa de código de turma.** Quem acerta um código vê os nomes livres da turma, que são de menores. Hoje `docs/runbook.md:458` (e `tasks/prd-apresentacao-escola/techspec.md:234`) dizem "~0,2% de chance em uma semana" com o teto de 3.000; com 6.000 fica perto de 0,4%. Vale corrigir o número e registrar em `docs/infra.md` 5.1 que o teto também governa esse risco. O alerta por escola e a revogação continuam sendo a resposta.
3. As recomendações da 2ª rodada que viraram `TODO.md` (a `conta_externa` sem e-mail ou `hd` na conferência e o comentário do `name` fixo) estão encaminhadas. O comentário do `name` fixo entrou em `infra/k6/reivindicacao-em-sala.js`, na função `irAoProvedor`.

As fotos da 2ª rodada continuam valendo, porque `apps/web` não mudou: conferi que a árvore atual só difere do snapshot `2cf43947` nos arquivos não versionados de `apps/web`/`e2e` e numa linha de revisões do `16_task.md`.

Pergunta de fechamento: nesta rodada, nada muda no que o sistema guarda sobre um aluno nem para onde envia. A resposta continua a da 2ª rodada.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/runbook.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/lgpd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/scripts/carga-sala.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/k6/reivindicacao-em-sala.js
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/infra.md

## test-engineer · 3ª rodada · REPROVADO · 2026-11-09 23:18:13 · `tasks/prd-acesso-e-convites/16_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- Na fase `k2_conta`, a escola da D48: pelo menos 80% dos alunos pela conta, nenhum aluno pela conta na disputa nem entre os que erram a matrícula, e o K1 e o K2 continuam com 1 em 20.
- Quem é aprovado pela conta entra pela conta (`iniciar`, `retorno`, `renovar`). O k6 cobra isso no threshold e a conferência no banco cobra uma sessão `externo` por aluno ligado. Sessão `externo` a mais também reprova.
- Zero 429, com contador próprio, em todas as fases e também na outra escola.
- O pico do `rl:ip` lido do Redis reprova acima de 80% do teto e passa até 80%.
- No `k2_conta`, pico não medido reprova.
- As chaves do balde anônimo excluem `rl:ip:op:` e `rl:ip-login:`.
- O teto de 6.000 está no `.env.example` e é o valor que a carga lê.
- A disputa repete o 503 sem contá-lo como corrida.
- A conta de requisições nos documentos foi corrigida.

**Cobertos:** todos os itens acima, em `infra/test/carga-sala.test.ts`. Rodei o arquivo: 38 testes verdes. `apps/api/src/config.test.ts` também passa: 85 verdes. Conferi os 16 blocos de mutação novos contra as asserções, e cada um derruba um caso que roda. A ordem r2 foi aplicada inteira: o item 1, as três recomendações do item 2 e a cópia das recomendações sem aplicar. `apps/web` não mudou.

**Bloqueantes:**

1. **`infra/scripts/carga-sala.ts:456-478` (`medirOBaldeAnonimo`): a regra "no `k2_conta`, pico não medido reprova" não tem como disparar na rodada de verdade.**
   - O teste prova só a função pura `julgarFase`. Esta função sempre devolve um número: o `pico` começa em 0 (`:459`) e todo erro é engolido no `catch`. Se o Redis não responder, por exemplo com a porta vazia (`Number('')` dá 0), sai pico 0, que conta como medido e passa a 0% do teto.
   - A leitura também faz um `SCAN` de uma página só (`:463`, cursor `'0'` sem continuar, `COUNT 1000`). Com os milhares de chaves da escola no Redis de cache (`rl:u:*`, as travas por nome e por turma, as chaves de idempotência), a chave `rl:ip:<ip>` pode ficar fora dessa página em parte da janela ou em toda ela. Isso só pode dar um número menor que o real, e um número menor é falso verde contra os 80%.
   - Correção exigida:
     - percorrer o cursor até voltar `'0'`, ou ler direto a chave `rl:ip:<ip>`;
     - contar as leituras em que a chave anônima foi achada, e devolver `undefined` quando não houve nenhuma, para o `julgarFase` reprovar;
     - extrair a redução das leituras para uma função pura e testá-la (sem leitura dá `undefined`; com leituras dá o maior valor), com um bloco de mutação no `16_task.md`.

2. **`infra/k6/reivindicacao-em-sala.js:195`: a linha que alimenta o `respostas_429` não tem bloco nem asserção.**
   - A linha é `respostas429.add(resposta.status === 429 ? 1 : 0, { grupo })`.
   - Trocar `=== 429` por qualquer outro número deixa todos os testes verdes, e o threshold `respostas_429: ['count==0']` vira um contador que nunca soma. O bloco de mutação existente mexe só no threshold, não nesta linha.
   - Correção exigida: uma asserção no caso dos thresholds (`toContain("respostas429.add(resposta.status === 429 ? 1 : 0")`) e um bloco que troque `=== 429` por `=== 428`.

3. **`infra/scripts/carga-sala.ts:526`: a condição nova `primeiroDia: fase === 'k2' || fase === 'k2_conta'` não tem bloco nem teste.**
   - Sem o `|| fase === 'k2_conta'`, a conferência (`conferir-carga-sala.ts:159`) deixa de cobrar no `k2_conta` que nenhum pedido seja segurado pelo teto de códigos errados do primeiro dia, e nada fica vermelho.
   - Correção exigida: levar o `primeiroDia` para a `ESCALA` (um campo da fase), afirmar no teste da `k2_conta` que ela é primeiro dia, e pôr um bloco de mutação.

**Recomendações:**
- `infra/k6/reivindicacao-em-sala.js:265`: a linha do `entrou` (status 200 e token presente) não tem bloco. O efeito está coberto pelo threshold `aprovado_entrou_pela_conta` e pela conferência das sessões `externo`, mas um bloco deixaria isso explícito.
- `infra/test/carga-sala.test.ts:177`: `expect(3_400).toBeLessThanOrEqual(teto * 0.8)` compara constantes. Só a asserção `teto === 6_000` prova alguma coisa. Melhor apagar a linha ou ligá-la à `FRACAO_DO_TETO_DO_BALDE`.
- Na disputa, `http.batch(...).map(repetirNo503)` repete o 503 dos dois pedidos um depois do outro. Quando os dois levam 503, a nova tentativa deixa de ser simultânea. O contador continua certo, mas vale um comentário dizendo que nesse caso o que se mede é a página repetindo, e não a corrida.
- A linha `if (acima !== undefined)` do `julgarFase` está coberta pelo caso dos 4.801, mas nenhum bloco a cita. Vale citá-la para o `--faltando` ficar exato (hoje ele não lê `infra/`).

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/scripts/carga-sala.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/k6/reivindicacao-em-sala.js
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/scripts/conferir-carga-sala.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/test/carga-sala.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/16_task.md

## revisor-geral · 3ª rodada · APROVADO · 2026-11-09 23:18:36 · `tasks/prd-acesso-e-convites/16_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

**O que conferi nesta rodada**

- **Escopo.** Em `apps/api` só mudou `src/config.test.ts`, e só na asserção que lê o `.env.example` (de 3.000 para 6.000). O `external-login.controller.ts` não foi tocado. A pergunta sobre o rebaixamento do `iniciar` e do `retorno` foi para o `TODO.md` com o Joaquim como dono, como o ponto 7 do diagnóstico pede.
- **Divergência documentada.** A subida do teto e a fase `k2_conta` estão nos três documentos: em `16_task.md` ("Divergências resolvidas", linha 92), em `techspec.md` §7c (linha 202) e em `cenarios.md` (o item [C], linhas 256-259). Também estão em `docs/infra.md` 5.1, no `docs/runbook.md` e no `.env.example`.
- **Recomendações sem aplicar.** As duas tabelas foram copiadas inteiras para o `16_task.md`: as 11 linhas da r1 e as 14 da r2.
- **Os números batem entre si.**
  - O gasto por aluno é 3 pela matrícula e 9 pela conta, com o `renovar` dentro e o `rl:ip-login` fora, igual nos cinco documentos.
  - A previsão é de cerca de 3.400 por minuto e o pico medido foi de 3.579, ou 60% de 6.000. O corte de 80% é 4.800.
  - No `k2_conta`, 1.782 de 2.100 alunos foram pela conta (85%), e os 1.782 entraram pela conta.
  - O `decidir` deu p95 de 1.593 ms no `k2_conta` e 3.047 ms no K2, iguais no `TODO.md` e na tabela da seção "Carga".
  - A menção aos 1.300 saiu dos documentos.
- **Ordem r2, item 2.** As três recomendações foram aplicadas:
  - o `TODO.md` cita a espera fixa de cerca de 2 s;
  - a disputa repete o 503 em `repetirNo503`;
  - `julgarContagem` exige uma sessão `externo` por conta ligada, e reprova se nenhum aluno entrou pela conta.

**Recomendações (nenhuma bloqueia)**

1. **A leitura do pico do balde pode ficar baixa sem aviso.** `infra/scripts/carga-sala.ts:463` faz um único `SCAN 0 MATCH rl:ip:* COUNT 1000` e não segue o cursor. Com mais de cerca de 1.000 chaves no Redis de cache, a chave `rl:ip:<ip>` pode não aparecer na primeira página. Aí o pico sai abaixo do real e o corte de 80% deixa de proteger. Nesta carga o número medido é plausível (3.579 contra 3.400 previstos) e o threshold de zero 429 garante que ficou abaixo de 6.000. Mesmo assim, vale percorrer o cursor até `'0'` ou ler direto a chave do IP da borda. Em `:214`, o filtro também não tira `rl:ip:senha:` (`apps/api/src/sessao/senha/senha.service.ts:22`). Esse erro leva a ler a mais, não a menos.
2. **O runbook afirma algo que o código não faz.** `docs/runbook.md:401` diz "(o deploy da 16.0 o traz)". Nenhum mecanismo leva o valor do `.env.example` para o `.env` da produção: `infra/compose.yml:213` lê a variável do `.env` com `:?`. O próprio `docs/infra.md:249` diz o contrário ("precisa do valor novo no próximo deploy"). Vale corrigir o texto e registrar no `TODO.md` a ação de trocar o `.env` da produção. Sem isso, a produção fica nos 3.000 que a tarefa provou insuficientes.
3. **Um teste que só compara constantes.** Em `infra/test/carga-sala.test.ts:177`, `expect(3_400).toBeLessThanOrEqual(teto * 0.8)` compara uma constante escrita no próprio teste. Só a linha que confere o teto de 6.000 vindo do ambiente da carga prova alguma coisa.
4. **Uma frase imprecisa na tarefa.** Em `tasks/prd-acesso-e-convites/16_task.md:92`, a linha de divergência diz "não muda `apps/api`", mas o `config.test.ts` mudou. O parágrafo da seção "Carga" corrige isso; dá para alinhar a linha da tabela.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/scripts/carga-sala.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/runbook.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/infra.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/test/carga-sala.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/16_task.md

## infra-guardian · 3ª rodada · REPROVADO · 2026-11-09 23:20:04 · `tasks/prd-acesso-e-convites/16_task.md`

VEREDITO: REPROVADO
Caminho quente tocado: login | sala | deploy
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok

As cinco correções da 2ª rodada foram feitas:
- **Fase `k2_conta`:** existe, com 85% dos alunos pela conta.
- **Entrada do aprovado:** quem foi aprovado entra pela conta (`iniciar`, `retorno` e `renovar`).
- **Contador de 429:** o `respostas_429` é próprio e tem threshold zero.
- **Teto:** subiu para 6.000, com o motivo escrito.
- **Contas nos documentos:** 3 pela matrícula e 9 pela conta. O "sem mudar o teto" saiu.

Conferi os números do `16_task.md` contra os logs da rodada, e eles batem:
- **`k2_conta`:** balde em 3579 de 6000 (60%), 1.782 contas provadas e 1.782 entradas pela conta, 0 resposta 429, 0 erro 5xx, `decidir` p95 de 1.593 ms. O resultado foi "passou".
- **K1 e K2:** balde em 154 e em 1.557. O `decidir` p95 do K2 deu 3.047 ms.

Os logs estão em `/tmp/claude-1000/-home-joaquimdp-Documents-git--maestri-floors-educaia--specacesso-e-convites--l1/f9d2479c-baf4-4350-9113-79284ef8d6bd/scratchpad/carga-k2conta.log` e `/tmp/claude-1000/-home-joaquimdp-Documents-git--maestri-floors-educaia--specacesso-e-convites--l1/f9d2479c-baf4-4350-9113-79284ef8d6bd/scratchpad/carga-k1k2.log`.

O que reprova é um defeito novo, no medidor que esta rodada criou.

Bloqueantes:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/scripts/carga-sala.ts:463-466`, `:561-562` e `:240-241`. A regra dos 80% do teto passa sem medir nada.
   - **O que está errado:**
     - `cliente.scan('0', 'MATCH', 'rl:ip:*', 'COUNT', 1_000)` lê só a primeira página e descarta o cursor.
     - O `MATCH` do Redis filtra depois de recolher cerca de 1.000 chaves. A chave `rl:ip:<ip>` cai sempre no mesmo bucket. Se o Redis de cache tiver mais chaves que uma página (`rl:u`, `rl:e`, `sala:*`, `rl:ip-login`), ela fica de fora a rodada inteira, e não só em uma amostra.
     - O `catch {}` engole qualquer erro, até a falta de conexão. Nesses casos `parar()` devolve `pico = 0`.
     - `picos.set` grava esse 0 como se fosse medida. O `julgarFase` só reprova "não medido" com `doBalde === undefined`, o que o `executar` nunca produz. Então um pico 0 passa no `k2_conta`.
     - O caso do teste "o `k2_conta` sem pico medido reprova" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/test/carga-sala.test.ts:158`) prova um caminho que o script real não percorre.
     - Nesta rodada a chave foi lida, e os números conferem. Numa rodada futura, um pico entre 4.800 e 6.000 sai verde em silêncio. Sobra só o zero 429 como rede.
   - **Correção exigida:**
     - Percorrer o `SCAN` até o cursor voltar a `'0'` em cada amostra.
     - Contar as amostras em que alguma chave do balde foi lida. `parar()` devolve `undefined`, ou um "não medido", quando nenhuma foi lida.
     - Fazer o `executar` repassar isso ao veredito, para que o `k2_conta` com pico 0 ou sem amostra reprove como "não medido".
     - Escrever um teste da função pura que decide "medido ou não". Pelo menos: pico 0 no `quase_todos` reprova; nenhuma amostra reprova.

Recomendações:
- **`.env` da produção:** o `compose.yml` exige o `LIMITE_REQ_IP_ANONIMO_MIN`, então a produção continua com o 3000 que já está no `.env` dela. Hoje só o runbook diz que precisa trocar. Abrir um item no `TODO.md`, com dono, para trocar o valor no `.env` da VPS antes de a primeira escola com Workspace entrar.
- **`chavesDoBaldeAnonimo`:** a função deixa passar `rl:ip:senha:<ip>`, o balde do "esqueci a senha". Erra para o lado seguro, porque pode exagerar o pico, mas não esconde nada. Excluir esse prefixo junto com o `rl:ip:op:`.
- **Quem sente os 6.000:** o mesmo teto vale para o `rl:ip-login` e para o `rl:ip:op`. Um único IP agora faz o dobro de tentativas de login sem ser rebaixado. A proteção por conta e o semáforo do hash continuam, e o `docs/infra.md` 5.1 já registra isso. Vale citar o efeito no item do `TODO.md` que pergunta ao Joaquim sobre um balde próprio para a entrada pela conta.

## privacy-guardian · 4ª rodada · APROVADO · 2026-11-10 09:28:47 · `tasks/prd-acesso-e-convites/16_task.md`

VEREDITO: APROVADO

Esta é a 4ª rodada. Auditei o diff `diff-16-r3-para-r4.patch` inteiro e conferi no código o que ele toca.

**Correção exigida na 3ª: feita.** A frase que mandava o operador dar `GET` em `rl:ip:<ip>` e `rl:ip:op:<ip>` saiu de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/runbook.md:403`. No lugar dela, o texto manda medir o consumo pela escola: o 429 por escola no log ou na métrica, sem IP, mais a conta de alunos que entram pela conta e de erros de digitação. Diz também que ninguém lê as chaves `rl:ip` à mão e que ler o balde na produção seria finalidade nova, que entra primeiro em `docs/lgpd.md`. Agora o runbook concorda com `docs/lgpd.md:197-198` e com `docs/runbook.md:464`. Nenhuma outra passagem de `docs/` manda ler essas chaves.

**Recomendações da 3ª: aplicadas.**
- (1) `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/lgpd.md:190` registra a exceção. Só o cenário de carga da sala a usa, só no compose de carga, com IP do Docker e dado sintético. Ele lê os valores, guarda só o maior e nunca imprime a chave. O código confere com isso:
  - `infra/scripts/carga-sala.ts:465-478` lê só os valores.
  - `:593-596` imprime só o pico e o teto.
  - O cliente Redis aponta para `127.0.0.1`, na porta de `lerAmbienteDeCarga()`, depois de `compose down --volumes` e `up` do projeto de carga.
- (2) O "~0,2%" virou "~0,4%" em `docs/runbook.md:458`. Em `docs/infra.md` 5.1 (linhas 251-253) agora está escrito que o teto também governa o risco do código de turma e que não sobe sem refazer essa conta. A techspec de outra spec, que ainda diz 0,2%, foi para o `TODO.md` com dono.

**O resto do diff não muda nada de dado pessoal.** Mudaram:
- o filtro, que agora exclui `rl:ip:senha:`;
- `reduzirLeiturasDoBalde`;
- a regra que trata pico 0 como "não medido";
- o campo `primeiroDia`;
- um comentário no k6;
- os blocos de mutação;
- as linhas do `TODO.md`.

O item novo do `TODO.md` sobre o `.env` da produção também registra que um IP passa a fazer o dobro de tentativas de login sem ser rebaixado. O risco fica dito e com dono.

Campos pessoais tocados: nenhum novo. A carga só lê o valor dos contadores `rl:ip`, cuja chave é o IP, em ambiente sintético.
Fora da tabela de dados do docs/lgpd.md: nada. A leitura da carga está registrada em `docs/lgpd.md:190`.
Autorização por objeto: ok. Nenhuma rota mudou nesta rodada.
Logs: limpos. A carga imprime só o pico e o teto, nunca a chave com o IP.
Auditoria: presente. Nenhuma ação nova que a exija.
Envio externo: nenhum.
Seed/fixture: sintético.
Bloqueantes: nenhum.
Recomendações:
- O comentário em `infra/scripts/carga-sala.ts:215-219` põe o `rl:ip:senha` no mesmo filtro do Redis de cache. Pela `docs/lgpd.md:194`, essa chave é o HMAC do IP e fica no Redis de fila. O filtro está certo e só exclui; vale uma linha no comentário dizendo que ela normalmente nem aparece ali.

## tenancy-guardian · 4ª rodada · APROVADO · 2026-11-10 09:29:11 · `tasks/prd-acesso-e-convites/16_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nem migration nesta rodada. A única escrita de domínio no diff continua sendo o `insert into provedor_escola` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/scripts/carga-sala.ts:556`, que não mudou. Ele usa o `escolaId` da escola que a própria carga monta, e o item já está no `TODO.md`.

Queries verificadas: nenhuma query nova em repository nem em endpoint. Nada mudou em `apps/api` desde a 3ª rodada; a tarefa inteira só tocou `apps/api/src/config.test.ts`. As leituras novas (`SCAN`/`GET` das chaves `rl:ip:*` em `valoresDoBaldeAnonimo`) vão ao Redis de cache do compose de carga, com IP do Docker e dado sintético. Não leem dado de escola. Só o valor sai da função; a chave, que contém o IP, não é impressa nem guardada. A exceção está registrada em `docs/lgpd.md`.

Teste de isolamento: presente e efetivo. Nenhum escopo mudou nesta rodada. Os testes de isolamento da tarefa ficam como estavam na 3ª rodada aprovada, porque `apps/web`, `e2e/` e o código de produção de `apps/api` não mudaram.

Bloqueantes: nenhum.

A recomendação da 3ª rodada que a Mesa mandou aplicar está feita. O filtro `chavesDoBaldeAnonimo` agora exclui `rl:ip:senha:` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/scripts/carga-sala.ts:219`), e o caso de teste cobre isso com a chave `rl:ip:senha:abc123`. Um bloco de mutação novo restaura o filtro antigo e o teste pega. A outra recomendação, registrar o pico por IP, foi recusada com justificativa na tabela de recomendações da `16_task.md`, e não volta.

Recomendações: nenhuma nova.

## revisor-geral · 4ª rodada · APROVADO · 2026-11-10 09:29:16 · `tasks/prd-acesso-e-convites/16_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

Desde a 3ª rodada, as três recomendações que a Mesa mandou aplicar estão feitas:
- **Leitura do balde e filtro `rl:ip:senha:`.** O `SCAN` agora percorre o cursor até voltar a `'0'` (`valoresDoBaldeAnonimo`). O `rl:ip:senha:` saiu do balde anônimo (`chavesDoBaldeAnonimo`), e o teste cobre esse prefixo.
- **Runbook.** Ele não diz mais que o deploy leva o teto novo. Está escrito que o `.env` da VPS segue nos 3.000, e há item no `TODO.md`, com o Joaquim como dono, para trocar o valor antes da primeira escola com Workspace. O mesmo trecho deixou de mandar ler `rl:ip:<ip>` no Redis da produção, o que bate com `docs/lgpd.md`. A exceção da carga ficou registrada lá, só com dado sintético e sem imprimir a chave.
- **Teste que comparava constantes.** `expect(3_400).toBeLessThanOrEqual(teto * 0.8)` virou `julgarPicoDoBalde('k2_conta', { pico: 3_400, teto })`, que passa pela regra de verdade.

O resto do diff não abre bloqueante:
- **`primeiroDia` na `ESCALA`.** A conferência recebe o mesmo valor de antes (`k2` e `k2_conta` como primeiro dia), e o teste prende quais fases são.
- **"Não medido" agora é `undefined`, e pico 0 conta como não medido.** Só reprova no `k2_conta`, como deve. Sem nenhuma leitura, o script escreve uma linha própria e não registra pico.

Recomendações:
- `tasks/prd-acesso-e-convites/16_task.md:96` ainda diz "sem o `rl:ip:op:` nem o `rl:ip-login:`". Falta citar o `rl:ip:senha:`, que o código agora também tira do balde.
- `infra/scripts/carga-sala.ts`: `cliente.on('error', () => undefined)` cala todo erro de conexão do medidor. Os pontos que dependem disso já estão cobertos: o `k2_conta` reprova sem leitura e a saída do script avisa. Mas nas fases que aceitam o pico não medido (K1, K2, `k2_redis_lento`), um Redis inalcançável só vira uma linha de texto, sem efeito no veredito. Vale um contador de erros impresso junto.
- O pico 0 reprovar no `k2_conta` é critério novo de veredito e só está no `16_task.md` e no código. Uma frase no `cenarios.md:258`, onde está o critério dos 80%, evitaria que o Validador o estranhe.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/.processo/ordens/diff-16-r3-para-r4.patch
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/scripts/carga-sala.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/test/carga-sala.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/runbook.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/lgpd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/16_task.md

## conformidade-reviewer · 4ª rodada · APROVADO · 2026-11-10 09:29:19 · `tasks/prd-acesso-e-convites/16_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta rodada. Todos com autor humano? Não se aplica, porque não há escrita. O diff da 3ª para a 4ª rodada mexe só em `infra/scripts/carga-sala.ts`, `infra/test/carga-sala.test.ts`, `infra/k6/reivindicacao-em-sala.js` (uma linha de comentário), `TODO.md`, `docs/infra.md`, `docs/lgpd.md`, `docs/runbook.md` e `tasks/prd-acesso-e-convites/16_task.md`. Conferi com `git diff --stat` entre as duas árvores: nada em `apps/` nem em `e2e/`. Nenhuma linha nova fala de `Nota`, `lancadaPor`, correção, LLM ou tutor.

Decisão autônoma sobre aluno: ausente. As mudanças são todas na medição de carga:
- a leitura do balde `rl:ip` lê o `SCAN` até o fim e não confunde mais o balde do "esqueci a senha" com o anônimo;
- pico não medido ou 0 agora reprova no `k2_conta`;
- o `primeiroDia` passou a ficar declarado em `ESCALA`;
- há casos de teste e blocos de mutação novos.

Nada disso toca aprovação, reprovação ou encaminhamento de aluno. O "aprovado" que aparece no k6 continua sendo o professor sintético aprovando a identidade do aluno (D4), sem mudança nesta rodada.

Aprovação registrada: ok. Nenhuma saída de IA entra nesta rodada.

Supervisão do tutor: ok. O tutor não aparece no diff.

Autonomia declarada e visível: sim, sem mudança. Nenhum agente nem a governança foram tocados.

Bloqueantes: nenhum. A 3ª rodada não exigiu correção, então não havia nada a conferir de lá.

Itens 6 a 9 da checagem:
- **6:** a auditoria não foi tocada.
- **7:** a exceção nova em `docs/lgpd.md:189` lê os contadores `rl:ip` só no compose de carga, com IP do Docker e dado sintético, e guarda só o maior valor. É medição de infraestrutura, não supervisão do aluno: não mede navegação, tempo ocioso nem comportamento. O runbook (`docs/runbook.md:401`) ainda tira da produção a leitura manual das chaves.
- **8:** nenhum campo, tela ou prompt de nota em discursiva ou redação.
- **9:** nenhuma métrica, ranking ou nominal de professor.

Recomendações: nenhuma da regra 70. Dois itens que já estão no `TODO.md` são de outros revisores e não meus:
- trocar o `LIMITE_REQ_IP_ANONIMO_MIN` para 6.000 no `.env` da VPS, item do `infra-guardian`;
- corrigir o "~0,2%" em `tasks/prd-apresentacao-escola/techspec.md:234`, item do `privacy-guardian`.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/.processo/ordens/diff-16-r3-para-r4.patch
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/scripts/carga-sala.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/lgpd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/runbook.md

## test-engineer · 4ª rodada · APROVADO · 2026-11-10 09:29:21 · `tasks/prd-acesso-e-convites/16_task.md`

VEREDITO: APROVADO

Cenários exigidos (as três correções da 3ª rodada, mais as recomendações que a Mesa mandou aplicar):
1. No `k2_conta`, pico do balde não medido reprova na rodada de verdade, e não só na função pura.
2. A linha que soma o 429 no k6 tem asserção e bloco de mutação.
3. No `k2_conta`, o primeiro dia faz a conferência cobrar que nenhum pedido seja segurado pelo teto de códigos errados.
4. Recomendações: a linha do `entrou`, o teste que comparava constantes, o comentário sobre o 503 duplo da disputa e o bloco do `acima !== undefined`.

Cobertos:
- **Correção 1:** feita.
  - O `SCAN` agora segue o cursor até voltar a `'0'` (`valoresDoBaldeAnonimo`, `carga-sala.ts:465-478`).
  - Uma leitura que falha ou que não acha a chave não entra em `leituras`. `parar()` devolve `reduzirLeiturasDoBalde(leituras)`, que dá `undefined` quando não houve leitura. Nesse caso o `executar` não grava o pico (`:592-597`), e o `julgarFase` reprova o `k2_conta`.
  - O `julgarFase` também trata pico 0 como "não medido" (`:250-251`). Isso fecha o caso de o Redis responder vazio.
  - A função pura tem teste ("o pico medido é o maior valor das leituras"): sem leitura dá `undefined`, `[0]` dá 0, e com leituras dá o maior. Tem dois blocos: `!==` no lugar de `===`, e `Math.min` no lugar de `Math.max`.
  - O pico 0 tem duas asserções (`carga-sala.test.ts:172-173`) e o bloco `>= 0`.
- **Correção 2:** feita. A asserção está no caso dos thresholds (`carga-sala.test.ts:317`) e há o bloco `=== 428`. Conferi que a linha só existe uma vez no k6 (`reivindicacao-em-sala.js:195`), então o `toContain` não pode passar por causa de outra ocorrência.
- **Correção 3:** feita.
  - O `primeiroDia` agora é campo de `EscalaDaFase` (`carga-sala.ts:65, 75-78`), e o `executar` usa `escala.primeiroDia` (`:557`).
  - O teste afirma `['k2', 'k2_conta']` e `ESCALA.k2_conta.primeiroDia === true` (`carga-sala.test.ts:99-100`).
  - O bloco troca o valor para `false`. A conferência (`conferir-carga-sala.ts:159`) segue lendo o campo.
- **Recomendações:** as quatro foram aplicadas.
  - A linha do `entrou` tem asserção (`carga-sala.test.ts:308`) e o bloco `201`.
  - O teste que comparava constantes agora julga 3.400 pelo `julgarPicoDoBalde` real, contra o teto do `.env.example`.
  - O comentário sobre o 503 duplo entrou em `k6:360`.
  - O bloco do `acima === undefined` existe.
- **De quebra:** `rl:ip:senha:` saiu do balde anônimo, com o caso de teste atualizado e o bloco que tira o filtro.
- **Execução:** `npx vitest run infra/test/carga-sala.test.ts` passou (39 de 39). Não há `.skip` nem mock que esconda a regra. Nada em `apps/web` nem em `e2e/` mudou desde a 3ª.

Bloqueantes: nenhum.

Recomendações:
- O laço do cursor (`while (cursor !== '0')`, `carga-sala.ts:476`) e o filtro `valor !== null && Number.isFinite(...)` (`:474`) não têm bloco. O `16_task.md` registra que são I/O, e a correção aceitava ler a chave direto. Mesmo assim, extrair a paginação para uma função que recebe um `scan` falso de duas páginas provaria que a segunda página é lida.
- O bloco `if (false) return reprovacoes` fica vermelho porque o `julgarPicoDoBalde` lança `TypeError` ao receber `undefined` (no caso de `carga-sala.test.ts:170`, que chama sem o mapa de picos). Ele prova a guarda, mas pela exceção, e não por um veredito diferente. Basta registrar no documento que é isso que o bloco espera.

Arquivos lidos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/.processo/ordens/diff-16-r3-para-r4.patch`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/scripts/carga-sala.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/test/carga-sala.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/k6/reivindicacao-em-sala.js`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/scripts/conferir-carga-sala.ts`

## frontend-reviewer · 4ª rodada · APROVADO · 2026-11-10 09:29:27 · `tasks/prd-acesso-e-convites/16_task.md`

VEREDITO: APROVADO

Tela vista: sim (5 fotos da 2ª rodada lidas, de 8, no celular e no computador, com o provedor liberado e a escola vazia). Não vi as fotos da sala inicial no computador, da conta provada no computador nem da escola vazia no computador. Nada em `apps/web` nem em `e2e/` mudou desde a 3ª rodada, então elas ainda valem. O diff r3→r4 (468 linhas) toca só docs, `TODO.md`, o cenário de carga em `infra/` e o `16_task.md`, e não afeta a tela.

Estados: ok. A tela cheia mostra a escolha do nome, o botão da conta da escola e o formulário de matrícula e senha. O vazio diz "Nenhum nome livre nesta turma. Se o seu nome não aparece, chame o professor." e deixa o botão "Usar outro código". O erro "Comece de novo pelo link ou pelo código da sala" diz o que fazer. Carregando e erro não aparecem na vitrine, e eu não os conferi pelo código, porque nada na web mudou desde a 3ª rodada.

Acessibilidade: sem mudança. Os campos têm rótulo visível, o foco aparece (o contorno azul no título da turma e no campo é foco programático) e o texto está em português do Brasil, sem termo técnico.

Chromebook fraco: sem mudança na web.
- No computador (1366 × 768), a página com o provedor liberado passa da janela em 970 px, por 202 px. O `prd.md` da spec não tem nenhum RF com "1366" dizendo que a tela cabe, e o `docs/interface.md` não impõe isso a uma tela de entrada. Fica como observação, e não bloqueia.
- O cenário de carga mudou no diff, mas só mede e reprova. A conferência do balde agora trata pico 0 e leitura ausente como "não medido" na fase `k2_conta`.

Celular: a 360 px não há rolagem horizontal nem texto cortado. O botão "Entrar com a conta da escola", "Enviar pedido" e "Mostrar" têm cerca de 44 px de altura. Nada depende de hover. O botão da conta da escola e a "conta confirmada" não estão nas fotos, como já avisado, e foram provados no e2e e no unitário nas rodadas anteriores.

Ação oficial protegida: sim. Esta tela só envia um pedido de entrada, que depende de aprovação do professor. Não há nota, publicação nem exportação.

Bloqueantes: nenhum.

Recomendações:
- A onça sai translúcida na foto do computador. A vitrine deve esperar a animação antes de fotografar (já registrado no `TODO.md`, dono: Implementador, em `tools/vitrine/`).
- No celular, "Não é a sua turma? Usar outro código" quebra em duas linhas. Funciona, mas um texto mais curto deixaria o botão mais limpo.
- Pendências de infra que não afetam a interface e que o diff já registra no `TODO.md`:
  - trocar o `LIMITE_REQ_IP_ANONIMO_MIN` para 6000 no `.env` da produção antes da primeira escola com Workspace entrar;
  - alinhar o "~0,2%" em `tasks/prd-apresentacao-escola/techspec.md:234`.

## infra-guardian · 4ª rodada · APROVADO · 2026-11-10 09:29:32 · `tasks/prd-acesso-e-convites/16_task.md`

VEREDITO: APROVADO
Caminho quente tocado: sala, login (o cenário de carga da sala e o teto do `rl:ip`; nada mudou em `apps/api`, `apps/web` nem `e2e/` desde a 3ª rodada)
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok

Bloqueantes: nenhum

O bloqueante 1 da 3ª rodada foi corrigido. Conferi em `infra/scripts/carga-sala.ts` e rodei `infra/test/carga-sala.test.ts`: 39 de 39 casos passaram.
- **Leitura do Redis:** `valoresDoBaldeAnonimo` percorre o `SCAN` até o cursor voltar a `'0'`. Uma chave que expira entre o `SCAN` e o `GET` não conta como lida.
- **Pico não medido:** `medirOBaldeAnonimo` guarda as leituras, e `reduzirLeiturasDoBalde` devolve `undefined` quando nenhuma achou a chave. Se o Redis cai, o `catch` deixa a lista vazia e o resultado também é `undefined`. Não sai mais 0 como se fosse medida.
- **O `executar` repassa o resultado:** com pico `undefined`, ele não grava nada em `picos`. O `julgarFase` então recebe `undefined` e reprova o `k2_conta` como "não medido". Pico 0 também reprova (`medido = doBalde !== undefined && doBalde.pico > 0`).
- **Testes da função pura:** pico 0 no `quase_todos` reprova, sem amostra reprova, `reduzirLeiturasDoBalde([])` dá `undefined` e `[0]` dá 0. Pico 0 nas fases `um_em_vinte` continua passando.

As duas recomendações da 3ª foram aplicadas:
- `chavesDoBaldeAnonimo` agora exclui `rl:ip:senha:`, com caso no teste. Conferi os prefixos `rl:` do código, e nenhum outro começa com `rl:ip:`.
- O `TODO.md` ganhou o item da troca do `LIMITE_REQ_IP_ANONIMO_MIN` no `.env` da VPS, com o Joaquim como dono e fora do horário letivo. O item cita o efeito sobre `rl:ip-login` e `rl:ip:op`.

Na documentação:
- O runbook deixa de mandar ler as chaves `rl:ip` à mão e mede o consumo pela escola.
- O `docs/lgpd.md` registra a exceção do medidor, que só roda na carga.
- O risco do código de turma foi refeito para os 6.000 (cerca de 0,4%).

Recomendações:
1. O pico de 3.579, que aparece em `tasks/prd-acesso-e-convites/16_task.md:102`, em `docs/runbook.md` e em `docs/infra.md` 5.1, foi medido com o medidor antigo, que lia uma página só do Redis. O número bate com a previsão de cerca de 3.400, mas convém rodar `npm run carga:sala -- --fases k2_conta` com o medidor novo antes da validação e trocar o número se ele mudar.
2. O texto de `tasks/prd-acesso-e-convites/16_task.md:96` ainda descreve o balde como "sem o `rl:ip:op:` nem o `rl:ip-login:`". Falta incluir o `rl:ip:senha:`.
3. `medirOBaldeAnonimo` e o laço do `SCAN` não têm caso unitário, e o próprio `16_task.md` registra isso. Um caso com um Redis falso de duas páginas, em que a chave só aparece na segunda, provaria a paginação sem depender da rodada de carga.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/scripts/carga-sala.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/infra/test/carga-sala.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/TODO.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/runbook.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/infra.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/lgpd.md`
