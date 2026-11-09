# Achados das revisões — `tasks/prd-acesso-e-convites/8_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-08 22:46:34 · `tasks/prd-acesso-e-convites/8_task.md`

VEREDITO: APROVADO
Tela vista: sim (6 fotos lidas: Verificar sem token e Verificar com link inventado, cada uma no computador e no celular, mais o `/convite` sem token no computador e no celular). As telas são anônimas, então não há versão cheia e vazia. "Confirmando…", "E-mail confirmado" e o aviso `pendente` do aceite não têm foto e foram conferidos pelo código e pelo e2e.
Estados: ok
- Carregando é o `LoadingState` "Confirmando…" (`VerificarEmail.tsx:50-56`).
- Erro é o link que não vale, com o botão "Abrir o convite". A falha de rede usa o `ErrorState` com "Tentar de novo" (`VerificarEmail.tsx:58-64`).
- Com dado é "E-mail confirmado", com o foco no `role="status"` e o botão "Continuar" (`VerificarEmail.tsx:66-78`).
- Vazio não existe, porque a tela nasce confirmando. Sem token, ela cai no estado de link que não vale.

Acessibilidade: ok
- Os avisos usam `role="alert"` e `role="status"`.
- O foco vai para o resultado quando o "Confirmando…" sai.
- O aviso `pendente` usa tokens da paleta (`--color-pendente` e `--color-pendente-cx`) que já existem, inclusive no tema escuro.
- O e2e roda `seriousViolations` e `horizontalOverflow` em `e2e/verificar-email.spec.ts:349-382`.

Chromebook fraco: ok
- A tela é leve: sem lista, sem imagem e sem upload.
- O pedido é feito uma vez só, protegido contra o segundo disparo do `StrictMode` e contra o mesmo link colado de novo, porque o link é de uso único.

Celular: ok
- As fotos em 360 px não mostram rolagem horizontal nem texto cortado.
- Nas fotos, "Abrir o convite" e "Entrar" têm cerca de 46 px de altura.
- "Continuar" tem `w-full` e está no e2e com o mínimo de 44 px (`esperarAlvo`, linha 351).
- O e2e cobre os projetos `chromebook` e `celular` e usa `tap()` quando o aparelho é de toque.
- Nada depende de hover ou de atalho.
- O fluxo não exige celular: o link chega por e-mail e abre em qualquer navegador.

Ação oficial protegida: sim (não se aplica). A verificação não aceita o convite nem abre sessão, e a pessoa volta ao convite e aceita de novo.

Bloqueantes: nenhum

Recomendações:
- O `/convite` sem token (`coordenacao--convite--*.png`) não foi alterado nesta tarefa e está correto.
- `Convite.tsx:22-23` mantém duas constantes de classe para os avisos. Se uma terceira tela precisar do aviso `pendente`, vale tirar o aviso para um componente comum, e hoje isso não pede mudança.
- A foto do link inventado é idêntica à de "sem token". É o comportamento pedido (a API responde igual, regra 10 item 6), mas a vitrine não distingue os dois casos.
- A mensagem de falha de rede ("Tentar de novo") não tem foto. A vitrine não fotografa erro, então ela foi conferida só pelo código e pelo e2e. Na validação, vale olhar uma vez com a rede derrubada.
- Não rodei o e2e nem os testes unitários, só li o código e as fotos.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-08 22:46:49 · `tasks/prd-acesso-e-convites/8_task.md`

VEREDITO: APROVADO
Tabelas verificadas: nenhuma tabela nova e nenhuma migration nesta tarefa. A tarefa só mexe na web, no e2e e na documentação. `e2e/support/seed.ts` faz um `update conta set email_verificado_em = null where id = $1`, que é helper de teste, roda direto no banco e grava pelo id UUID da conta.
Queries verificadas: nenhum repository e nenhuma query de produção nova. Revisei as chamadas da web:
- `apps/web/src/api/senha.ts` (`verificarConta`): o corpo é só `{ token }`.
- `apps/web/src/pages/Convite.tsx`: o aceite não mudou de contrato, só o desenho do aviso de `VERIFICACAO_PENDENTE`.
- `apps/web/src/pages/VerificarEmail.tsx`: o token sai do fragmento `#` e vai no corpo.

Nenhuma delas envia `escolaId` no corpo ou na query. A tela nova é anônima e não lê nada de escola.
Teste de isolamento: não se aplica. A tarefa não cria repository, endpoint nem consulta com escopo. O `POST /v1/conta/verificar` e o 409 do aceite são da tarefa 7.0. Quanto à mensagem de erro, a tela trata vencido, usado e inventado com o mesmo texto: o `NAO_ENCONTRADO` sempre vira `LINK_DE_VERIFICAR_QUE_NAO_VALE`. O e2e `e2e/verificar-email.spec.ts` cobre os casos inventado e usado, e mostram o mesmo aviso.
Bloqueantes: nenhum
Recomendações:
- `apps/web/src/pages/VerificarEmail.tsx:278`: hoje só `NAO_ENCONTRADO` vira "link que não vale", e qualquer outro código cai no `ErrorState` genérico. Se a API um dia responder com códigos diferentes para token vencido, usado ou de formato inválido, a tela passa a distinguir esses casos. Vale ter um teste de contrato no backend fixando que todos chegam em `NAO_ENCONTRADO`, para a tela não depender só do comentário.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-08 22:47:07 · `tasks/prd-acesso-e-convites/8_task.md`

VEREDITO: APROVADO

A tarefa 8.0 mexe só na interface: a tela nova "Verificar", o aviso do aceite com `VERIFICACAO_PENDENTE`, a rota, a chamada da API, a documentação e os testes. Não há migration, repository, endpoint, log no servidor nem envio externo. Ela não cria dado pessoal novo nem abre caminho por onde algum saia.

Campos pessoais tocados: nenhum campo novo. Só o e2e escreve em `conta.email_verificado_em`, coluna da tarefa 7.0, pelo `desfazerAPosseDoEmail` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/e2e/support/seed.ts:172`. A consulta dele é parametrizada e só roda no banco de teste.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: não se aplica nesta tarefa, porque não há rota nova na API (o `POST /v1/conta/verificar` é da 7.0). Na tela, link vencido, usado, inventado e sem token caem todos no mesmo estado, com o mesmo texto (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/web/src/pages/VerificarEmail.tsx:547` e `:677`). Ela não confirma se um token existe.

Logs: limpos. Não há `console`, `localStorage` nem `sessionStorage` em `VerificarEmail.tsx`, `Convite.tsx` ou `api/senha.ts`.

Auditoria: não se aplica. A tela não lê dado de aluno, não exporta, não mexe em nota nem em permissão e não aprova saída de IA.

Envio externo: nenhum. O token sai do fragmento `#` e da barra com `clearFragment` antes de qualquer chamada (`VerificarEmail.tsx:662`). Ele segue só no corpo do POST e fica apenas na memória da tela, nunca na URL nem em armazenamento.

Seed/fixture: sintético. Os nomes são "Professora sintética …" e os e-mails usam o domínio `@educa.invalid` (`e2e/support/seed.ts:94-95`, `:720-721`). O teste de unidade usa tokens inventados (`'A'.repeat(43)`).

Fotos da tela (as seis em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/.processo/vitrine/`):
- `verificar-sem-token--computador.png`, `verificar-sem-token--celular.png`, `verificar-link-inventado--computador.png` e `verificar-link-inventado--celular.png` mostram o mesmo aviso nos dois casos e não exibem nome, e-mail nem escola.
- `coordenacao--convite--computador.png` e `coordenacao--convite--celular.png` mostram o convite sem token, sem nome de escola.
- O texto do aviso pendente (`packages/shared/src/errors/messages.ts:42`) fala em "seu e-mail" sem mostrar o endereço. Esse estado não tem foto, e eu o conferi pelo código e pelo e2e.

Pergunta de fechamento: a tarefa não muda o que o sistema guarda nem para onde envia. A resposta continua a mesma das tarefas 7.0 e 11.0 (o arquivo do titular).

Bloqueantes: nenhum.

Recomendações:
- A resposta `VERIFICACAO_PENDENTE` da API (tarefa 7.0) diz a quem tem o convite copiado que aquela conta tem senha e ainda não provou o e-mail. Esta tarefa só a mostra na tela. Vale registrar a questão na próxima revisão da 7.0 ou na retro, para decidir de propósito se essa diferença de resposta é aceitável.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-08 22:47:13 · `tasks/prd-acesso-e-convites/8_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum

O diff da 8.0 mexe só na web, no e2e e no seed de teste. Não cria rota, query, job nem migration. O backend de `POST /v1/conta/verificar` e do `VERIFICACAO_PENDENTE` veio da 7.0, ficou fora deste diff e não foi reauditado.

O que aguenta às 10h com várias turmas atrás do IP da escola:
- **Tela "Verificar":** o pedido sai uma vez só. A guarda `pedidoFeito` segura a segunda execução do `StrictMode`, e `tokenGasto` impede que o mesmo link colado de novo dispare outro pedido. A tela não repete o pedido sozinha: "Tentar de novo" é manual, e ao ser clicado já tira o botão da tela. A resposta atrasada de um link anterior é descartada (`vezDoLink`).
- **Gasto do link:** o uso único é resolvido no banco, dentro de uma transação, por `usarLinkPorHash` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/src/sessao/senha/senha.service.ts:203`), e não por "busca, verifica, grava" no cliente.
- **Aviso no aceite:** o botão continua livre depois do `VERIFICACAO_PENDENTE`. Reaceitar não inunda o e-mail, porque o envio de link tem teto de 3 por hora por conta (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/src/sessao/convite/convite.service.ts:163`).
- **Testes:** nenhum chama provedor pago. O e2e usa o Mailpit, e o teste de unidade usa `fakeNetwork`.

Recomendações:
- **Fora deste diff (7.0):** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/src/sessao/senha/conta.controller.ts:7` limita a rota só pelo IP da rota anônima. O volume é baixo, porque a rota só serve quem aceita convite copiado. Mesmo assim, é bom registrar no `achados/indice.md` que não existe limite pelo hash do token, para a próxima rodada do `infra-guardian` sobre a 7.0 conferir se o teto por IP fica acima do pico de uma escola inteira.
- **Na 8.0:** dois cliques no "Tentar de novo" dentro do mesmo quadro de renderização podem somar duas tentativas e mandar dois pedidos. O backend já protege, então isso não bloqueia. Mesmo assim, uma guarda de `etapa.nome !== 'falhou'` dentro de `tentarDeNovo` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/web/src/pages/VerificarEmail.tsx`) fecharia o caso no cliente.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-08 22:47:33 · `tasks/prd-acesso-e-convites/8_task.md`

VEREDITO: APROVADO

Escopo: respeitado. A tarefa entrega 8.1 a 8.5 e não toca a API (7.0), nem tela de outra tarefa.

Aderência à Tech Spec: ok. Os textos de "Verificar" e do aceite com `VERIFICACAO_PENDENTE` batem com a seção "Telas" do `cenarios.md`. O aviso do aceite usa o texto do `@educa/shared`, e o pedido usa o tipo `VerificarContaRequest`. O token é lido do `#`, sai da barra antes da chamada e vai no corpo. A tela não abre sessão nem aceita o convite.

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade e alvo, conferidos na árvore atual).

Bloqueantes: nenhum.

Recomendações:

1. **"Continuar" leva a uma tela de erro.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/web/src/pages/VerificarEmail.tsx:73`, o botão vai para `/convite` sem token. Pela foto `coordenacao--convite--celular.png`, essa tela diz "O endereço do convite está incompleto… ou peça um convite novo". Quem acabou de confirmar o e-mail lê isso como erro, e ainda é orientado a pedir um convite novo, o que não precisa: o convite continua valendo.
   - O `cenarios.md` diz "Continuar para o convite", e a leitura "rota `/convite` sem token" é defensável, porque o token do convite só existe na aba que o abriu.
   - Mesmo assim, vale ajustar o texto do "E-mail confirmado" para algo como "volte à aba do convite, ou abra o link do convite de novo", ou mostrar a `/convite` sem token com um texto próprio para quem vem do "Verificar".
   - O e2e (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/e2e/verificar-email.spec.ts:159`) só confere a URL e não o que a pessoa lê ao chegar.
   - O `docs/interface.md` já registra o destino `/convite`. O `cenarios.md` e a `techspec.md` não registram, e a autoconferência (item 8) diz que não há divergência.
2. **Um segundo jeito de ler a cor da paleta.** O `corDaPaleta` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/e2e/verificar-email.spec.ts:106`) repete o ajudante que já existe em `e2e/support/checks.ts`. O motivo está escrito: o nome do ajudante está nas exceções da renomeação. Vale anotar no `TODO.md` para juntar os dois quando a renomeação fechar.
3. **Faltam um token real e um sem formato.** O e2e "link vencido, usado ou inventado" usa só o token inventado de 43 caracteres. O link usado é provado à parte, no caso do Mailpit, então a cobertura está completa. Um caso extra com token fora do formato, que a API recusa antes do banco, mostraria que a tela trata as duas recusas do mesmo jeito.

## test-engineer · 1ª rodada · APROVADO · 2026-11-08 22:47:55 · `tasks/prd-acesso-e-convites/8_task.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:** o aceite de um convite copiado devolve `VERIFICACAO_PENDENTE`, o link chega ao Mailpit, "E-mail confirmado" aparece, "Continuar" leva a `/convite` e o novo aceite segue.
- **Casos de borda:**
  - link inventado, link já usado e endereço sem token;
  - fragmento quebrado (`%` solto);
  - falha de rede com "Tentar de novo";
  - a cor do aviso no aceite: `pendente` para a verificação pendente e vermelho para outra falha.
- **Recomeço:**
  - o mesmo link colado depois de uma falha e depois de confirmar;
  - outro link colado com o pedido no ar;
  - a resposta atrasada que dá certo e a que falha.
- **Concorrência:** o pedido de uso único repetido pelo `StrictMode`, e o mesmo link colado com o pedido no ar.
- **Permissão e isolamento:** não se aplicam. A tela é anônima e a tarefa não cria repository nem consulta (a API é da 7.0).
- **360 px:** os quatro estados, com alvo de 44 px na ação principal e de 24 px no resto.

**Cobertos:** todas as linhas da tabela têm caso com o nome citado.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/e2e/verificar-email.spec.ts` tem 15 casos. Cada item juntado por "e" na coluna "Caso" tem um caso próprio: "link usado", "aceite com outra falha", "link colado sem token", "falha de rede" e os quatro de 360 px.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/web/src/pages/VerificarEmail.test.tsx` cobre o `StrictMode` e a falha atrasada. Rodei o arquivo: 2 de 2 passaram.
- Rodei `mutacoes.ts --faltando`: nenhuma linha nova com condição fica sem bloco.
- Conferi os 32 blocos contra o código. Cada um cai numa asserção do cenário dele, pelo motivo certo:
  - **Vez e token:** tirar `vezDoLink++` ou `definirVez` faz a chave `0:0` se repetir. O pedido do link B não sai, e a tela fica em "Confirmando…".
  - **Token gasto:** tirar o `tokenGasto = undefined` da falha prende o mesmo link colado de novo.
  - **Link sem token:** com `&& false` na guarda do token, a página manda o pedido sem token, e o caso cobra 0 pedidos.
- O termo `instanceof ApiError &&` não tem bloco, e o motivo escrito confere: tirá-lo não muda nada, porque quem não é `ApiError` não tem `.codigo` e a comparação dá falso do mesmo jeito.
- **Outros pontos conferidos:**
  - não há `.skip`, nem teste comentado, nem mock que esconda a regra;
  - a rede falsa da unidade estoura no segundo pedido;
  - o e2e usa a API real para o link inventado, o link usado e o aceite;
  - não há IA nesta tarefa.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `e2e/verificar-email.spec.ts:204`: o título fala em "vencido", mas nenhum caso abre na tela um link realmente vencido. Ou o título perde a palavra, ou entra um caso com o token vencido pelo seed. A igualdade da resposta da API já foi provada na 7.0.
2. `e2e/verificar-email.spec.ts:139-141`: o caso afirma "o convite não é gasto" só pelo botão habilitado. A prova real é o novo aceite no caso seguinte (`:162-166`). Uma consulta do `usado_em` pelo seed deixaria o próprio caso provar o que diz.
3. `e2e/verificar-email.spec.ts:128,145,169`: o `test.slow()` dos três casos com Mailpit não vale no portão, porque o caso é novo e é medido contra 15 s. O comentário da linha 148 mostra que o aceite e a verificação juntos já passavam do prazo. Na esteira valem os 90 s. Convém registrar a folga medida, para o aperto não aparecer depois em lote.
4. `docs/roteiro-da-demonstracao.md:147`: "quando a tarefa 8.0 fechar a spec" fala de outra spec (a da Semana, F2b) e fica ambíguo ao lado do texto novo desta 8.0. Vale dizer de qual spec é.
