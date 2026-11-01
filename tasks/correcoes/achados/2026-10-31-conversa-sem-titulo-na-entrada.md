# Achados das revisões — `tasks/correcoes/2026-10-31-conversa-sem-titulo-na-entrada.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-10-31 22:20:03 · `tasks/correcoes/2026-10-31-conversa-sem-titulo-na-entrada.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A correção só mexe no e2e (a espera depois de `page.reload()` e uma recusa simulada de `POST /v1/sessao/renovar`). Não toca schema, repository, job, seed, importação nem webhook de `Nota`. Todos com autor humano? sim, porque nenhum caminho foi criado nem alterado.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. Nenhum fluxo de saída de IA foi tocado, e a exceção D47 não foi estendida a outro agente.

Supervisão do tutor: ok. Em `e2e/aluno-tutor.spec.ts` só mudou o `recarregar` local, que agora chama `esperarATelaDepoisDaRecarga`. Nenhuma asserção do tutor foi removida ou afrouxada. A nova tentativa só dispara quando o botão "Tentar de novo" está fora do `main`, que é a tela da sessão indisponível. Assim ela não esconde erro de tela do tutor nem da atividade, que fica dentro do `main`.

Autonomia declarada e visível: sim, e o que testa isso não perdeu força. No caso `:171` de `e2e/professor-conversa.spec.ts`, as asserções da suspensão do Assistente pela coordenação continuam depois da recarga, sem mudança: o aviso explicativo, a caixa desabilitada, a ausência de alerta no `main` e nenhum código cru. Além disso, o caso agora exige duas renovações (`expect(renovacoes).toBe(2)`), o que prova que a recusa simulada aconteceu de fato.

Itens 6 a 9 (auditoria, vigilância, nota em discursiva e redação, medição do professor): a tarefa não altera nenhum deles. O spec novo, `e2e/recarga-da-sessao.spec.ts`, usa páginas estáticas, sem dado de pessoa, sem nota e sem saída de IA.

Bloqueantes: nenhum.

Recomendações:
- A tarefa deixa fora de propósito um ponto que deveria virar tarefa: hoje o Postgres que não responde no prazo do cliente sai como 500 `ERRO_INTERNO`, e o certo seria 503 `INDISPONIVEL_TENTE_DE_NOVO` (`packages/core/src/db/pool.ts` e `mapPostgresError`). Isso não afeta a regra 70, e o dono é o `infra-guardian`, que já está entre os subagentes obrigatórios.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/correcoes/2026-10-31-conversa-sem-titulo-na-entrada.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/support/casca.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/support/professor/scenario.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/professor-conversa.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/aluno-tutor.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/aluno-atividade.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/recarga-da-sessao.spec.ts

## privacy-guardian · 1ª rodada · APROVADO · 2026-10-31 22:20:04 · `tasks/correcoes/2026-10-31-conversa-sem-titulo-na-entrada.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A mudança mexe só no e2e: a espera depois da recarga e uma recusa simulada da renovação da sessão. Nada muda em schema, DTO, repository, endpoint, log da aplicação, storage ou envio para IA.

Fora da tabela de dados do docs/lgpd.md: nada. Nenhum campo novo.

Autorização por objeto: ok. Nenhuma rota nova nem alterada. O `page.route('**/v1/sessao/renovar')` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/professor-conversa.spec.ts:246` só intercepta a rede do navegador do teste. A sessão e o escopo continuam sendo da API real.

Logs: limpos. O único texto novo que pode sair é a mensagem de erro de `esperarATelaDepoisDaRecarga` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/support/casca.ts:155`). Ela leva o `innerText` do primeiro `alert`, e esse ramo só roda quando a tela é a da sessão `indisponivel`, cujo aviso é genérico ("Não foi possível concluir agora. Tente de novo em instantes."). Não aparece nome, matrícula nem conteúdo.

Auditoria: não se aplica. Nenhuma ação auditável foi criada ou alterada.

Envio externo: nenhum.

Seed/fixture: sintético. O 500 simulado usa `erroDaApi(500, 'ERRO_INTERNO')` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/support/assistente.ts:90`), com corpo tipado e sem stack trace. Fica no formato do contrato de erro (regra 20, item 11). O spec novo `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/recarga-da-sessao.spec.ts` usa só uma página estática com "Início" e o aviso genérico, sem dado de pessoa.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/support/casca.ts:154`: hoje `getByRole('alert').first()` sempre pega o aviso genérico da sessão. Se um dia a tela da sessão `indisponivel` passar a mostrar outro `alert` com conteúdo de tela, esse texto vai parar no log da esteira. Se quiser fechar essa porta, restrinja o seletor ao alerta da tela da sessão, igual ao `:not(main *)` usado no botão.
- A correção registra que um cliente sem resposta do Postgres sai como `ERRO_INTERNO`. Isso não afeta privacidade, porque o corpo continua tipado e sem pilha para o cliente, e a pilha fica só no log interno `http.erro`. Mas, se o Orquestrador transformar isso em tarefa, vale conferir que esse log não carrega parâmetro de consulta com dado de pessoa.

Pergunta de fechamento: esta tarefa não muda o que o sistema guarda sobre um aluno nem para onde envia, então a resposta à secretaria continua a mesma de antes.

## infra-guardian · 1ª rodada · APROVADO · 2026-10-31 22:20:05 · `tasks/correcoes/2026-10-31-conversa-sem-titulo-na-entrada.md`

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

Recomendações:
- O erro de tempo do próprio cliente `pg`, quando o `query_timeout` de 4 s estoura, sai como 500 `ERRO_INTERNO` em vez de 503 `INDISPONIVEL_TENTE_DE_NOVO` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/packages/core/src/db/pool.ts:187`, com o `mapPostgresError` sem tratar esse caso). Às 10h, um Postgres lento conta como erro interno no SLO de 99,5% (D27) e no alerta de 5xx, quando na verdade é sobrecarga e pede repetição. A correção registra isso para o Orquestrador. A recomendação é que vire tarefa própria de `packages/core`, com teste do mapeamento.
- A repetição em `esperarATelaDepoisDaRecarga` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/support/casca.ts:147`) tira da vista com que frequência o Postgres para na esteira. Essa família de falhas já apareceu duas vezes (Redis de fila em 23/10, Postgres agora). Vale registrar na esteira, no mínimo como anotação do Playwright, quando a segunda tentativa foi usada. Assim uma regressão de latência no `POST /v1/sessao/renovar` não fica passando em silêncio.
- A correção mexe só no e2e: nada muda no caminho quente de produção e nenhum teste chama provedor pago. O cenário do teste de carga não precisa mudar.

## revisor-geral · 1ª rodada · APROVADO · 2026-10-31 22:20:26 · `tasks/correcoes/2026-10-31-conversa-sem-titulo-na-entrada.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. A correção mexe só no e2e: `packages/core` e `apps/web` não foram tocados, e as três cópias de `recarregar` agora chamam a função nova. A dúvida sobre o `query_timeout` e o mapa de erro fica registrada para o Orquestrador decidir, sem implementação.

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

Bloqueantes: nenhum

O que conferi no código da web, porque é dele que a espera depende:
- O "Tentar de novo" fora do `main` só pode ser o da sessão. O `EstadoErro` de `Protegida` (`apps/web/src/routes.tsx:98-100`) fica fora da `CascaDaEscola`. O do `/v1/eu` (`AreaDoPapel`, `routes.tsx:128`) fica dentro dela, e portanto dentro do `<main>` de `apps/web/src/pages/Casca.tsx:132`. O filtro `:not(main *)` separa os dois.
- O clique não cria uma corrida com a segunda volta do laço em `e2e/support/casca.ts:150-158`. `abrirSessaoPeloCookie` (`apps/web/src/api/sessao.ts:470`) passa o estado para `abrindo` de forma síncrona, e o `useSyncExternalStore` desmonta o botão no mesmo clique. Assim a segunda volta não encontra o botão antigo e não lança o erro sem motivo.
- Nenhum stub de `e2e/support` responde a `/v1/sessao/renovar`. Por isso o `rota.continue()` de `e2e/professor-conversa.spec.ts:247` não pula nenhum handler anterior, e a conta `renovacoes === 2` é confiável.

Recomendações:
- `e2e/professor-conversa.spec.ts:243-254`: o caso "os quatro estados da conversa…" agora também testa a recarga com a renovação recusada. O motivo está escrito na tarefa: um caso novo passaria dos 15 s que o portão cobra. Mesmo assim, o caso testa duas coisas. Se o caso falhar, a mensagem `'a renovação recusada e a repetição pela tela'` aponta a parte certa; vale manter assim.
- `e2e/support/casca.ts:149`: `denovo` funciona como nome; `tentarDeNovo` deixaria mais claro que se trata do botão.
- O ponto que a própria tarefa deixa em aberto: um cliente do pool sem resposta sai como 500 `ERRO_INTERNO`, e não como 503 `INDISPONIVEL_TENTE_DE_NOVO`. Isso merece uma tarefa própria do `infra-guardian`, em vez de ficar só no texto da correção.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/correcoes/2026-10-31-conversa-sem-titulo-na-entrada.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/support/casca.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/support/professor/scenario.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/professor-conversa.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/recarga-da-sessao.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/aluno-tutor.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/aluno-atividade.spec.ts

## test-engineer · 1ª rodada · REPROVADO · 2026-10-31 22:21:24 · `tasks/correcoes/2026-10-31-conversa-sem-titulo-na-entrada.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
1. Caminho feliz: a recarga chega ao título do `main` sem recusa. As 17 chamadas existentes de `recarregar` cobrem isso.
2. A renovação devolve 500 uma vez depois do `reload` (Postgres da esteira sem responder). A tela da sessão `indisponivel` mostra "Tentar de novo" fora do `main`, a espera clica uma vez e chega à tela.
3. A renovação é recusada de novo. A espera falha com uma mensagem que diz o que a tela mostrava, sem gastar os 20 s.
4. O "Tentar de novo" dentro do `main` é de uma tela, não da sessão, e não conta. Por exemplo o `EstadoErro` do `/v1/eu` em `AreaDoPapel` (`apps/web/src/routes.tsx:128`) ou o da própria conversa (`professor-conversa.spec.ts:185-188`).
5. Permissão e isolamento: não se aplicam. A correção é só e2e, e nenhuma consulta ou escopo mudou.
6. Concorrência: não se aplica. O que se repete é a renovação, e a correção se apoia em a transação ter desfeito e o cookie não ter girado. Isso é desenho da API, que esta correção não altera.

**Cobertos:**
- Cenário 2, na recarga de verdade: `e2e/professor-conversa.spec.ts:243-254`, no caso "os quatro estados da conversa…". O `page.route` devolve 500 `ERRO_INTERNO` só na primeira renovação. A asserção `renovacoes === 2` prova que a segunda renovação veio do clique pela tela, e o que vem depois (o `note` da suspensão e a caixa desligada) prova que a tela chegou. O vermelho antes da correção está documentado (44,3 s e 46,0 s em `scenario.ts:93`, o mesmo ponto do sintoma). Mandar `ERRO_INTERNO` direto pela rede é a única opção num e2e paralelo, e o documento justifica isso.
- Cenário 2, a lógica: `e2e/recarga-da-sessao.spec.ts:27` ("com a tela da sessão indisponível, tenta de novo uma vez e chega ao título"). Se o clique sair, o caso cai na segunda volta e falha.
- Cenário 3: `e2e/recarga-da-sessao.spec.ts:33`. A asserção usa o texto exato, com o número de tentativas e o aviso. Ela fica vermelha se o `throw` sair (a função resolveria) e se `TENTATIVAS_DA_RECARGA` mudar.
- Os dois itens de "Teste que reproduz" têm teste, citados pelo nome.
- Não há `.skip`, `.only` nem teste comentado. Não há IA nem provedor pago. Os imports que saíram (`PRAZO_DA_ENTRADA_MS` em `aluno-tutor.spec.ts` e `scenario.ts`) não têm outro uso, e `aluno-atividade.spec.ts` ainda usa o dele.
- Não há bloco de mutação nem linha "Sem mutação", e está certo assim: nenhum arquivo de `apps/*/src` ou `packages/*/src` mudou, então o RF17 não se aplica.

**Bloqueantes:**
1. `e2e/support/casca.ts:149`: o filtro `.and(page.locator(':not(main *)'))` não tem teste. Ele faz o "Tentar de novo" de dentro do `main` não contar, como o documento afirma na seção Correção. Se o filtro for apagado, os dois casos de `recarga-da-sessao.spec.ts` e o `:171` continuam verdes.
   - **Por que importa:** o `EstadoErro` não tem título (`apps/web/src/components/states/EstadoErro.tsx` só tem o botão). Uma falha do `/v1/eu` ou de uma tela logo depois da recarga deixa "Tentar de novo" dentro do `main` e nenhum título. Sem o filtro, a espera clicaria nesse botão e esconderia a regressão em todas as 17 recargas que agora passam por ela.
   - **Correção exigida:** um terceiro caso estático e rápido em `e2e/recarga-da-sessao.spec.ts`. A página tem `<main>` com um `role="alert"` e um botão "Tentar de novo" que conta os cliques em `window`, e um `setTimeout` de uns 300 ms põe o `<h1>` dentro do `main`. O caso exige que `esperarATelaDepoisDaRecarga` resolva e que a contagem seja 0. Sem o filtro, a primeira volta acha o botão antes do título, clica, e o caso fica vermelho. Ele fica bem abaixo da metade do prazo, sem depender dos 20 s do relógio.

**Recomendações:**
- `e2e/professor-conversa.spec.ts:247-252`: a rota fica instalada até o fim do caso e continua contando. Pode chamar `page.unroute('**/v1/sessao/renovar')` logo depois da asserção da linha 254, ou usar `rota.fallback()` no lugar de `rota.continue()`. Assim um mock de renovação que entrar depois em `simularAssistente` não é contornado sem ninguém ver.
- A asserção `renovacoes === 2` depende de a web não fazer outra renovação em segundo plano entre a recusa e o clique. Hoje está certa. Se a web um dia renovar sozinha, quem lê o caso precisa saber que esse número é exato, e uma linha de comentário resolve.
- O registro de "Fica de fora" (o cliente do pool sem resposta sai como `ERRO_INTERNO` e não como 503 `INDISPONIVEL_TENTE_DE_NOVO`) deve chegar ao Orquestrador como item a decidir pelo `infra-guardian`, e não ficar só neste documento.

Não rodei os testes. Os specs alterados são Playwright, que pede o ambiente do e2e, e eu só rodo `vitest` e `git diff`. Pela regra 40, as durações e o vermelho de antes ficam com o portão da tarefa. A auditoria foi pela leitura do diff, de `apps/web/src/routes.tsx:79-140` e de `apps/web/src/components/states/EstadoErro.tsx`.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/support/casca.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/recarga-da-sessao.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/professor-conversa.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/correcoes/2026-10-31-conversa-sem-titulo-na-entrada.md

## revisor-geral · 2ª rodada · APROVADO · 2026-10-31 22:33:56 · `tasks/correcoes/2026-10-31-conversa-sem-titulo-na-entrada.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

Esta é a 2ª rodada, e não houve correção exigida na 1ª. Conferi o diff da rodada e o que ele afeta:

- **O caso novo em `e2e/recarga-da-sessao.spec.ts` prova o filtro `:not(main *)`.** Sem o filtro, a primeira volta acha o "Tentar de novo" de dentro do `main` antes de o título chegar (aos 300 ms) e clica nele. A conta de cliques fica em 1, e a asserção `toBe(0)` quebra. Com o filtro, o botão de dentro do `main` não conta e a espera aguarda o título. Isso confirma o que o documento diz: apagando o filtro, o caso fica vermelho.
- **O aviso lido em `e2e/support/casca.ts:154` é o certo.** Lê só o `alert` de fora do `main`, que é o que a tela da sessão mostra de verdade. O estado `indisponivel` em `apps/web/src/routes.tsx` monta o `EstadoErro` fora do `main`. O `role="alert"` fica só na mensagem (`apps/web/src/components/states/EstadoErro.tsx:26`), e o botão fica fora do alerta. A página estática do teste reproduz isso.
- **`denovo` virou `tentarDeNovo` em `e2e/support/casca.ts`** nos três usos, sem nenhum resto do nome antigo.
- **Em `e2e/professor-conversa.spec.ts`**, o `page.unroute('**/v1/sessao/renovar')` logo depois da asserção prende a renovação recusada a esta recarga. O comentário sobre o 2 exato diz por que o número muda se a web passar a renovar sozinha.
- **O documento da correção** descreve o caso novo e a troca de nome. As recomendações recusadas ou adiadas estão registradas com o destino de cada uma.

Recomendações:
- `e2e/recarga-da-sessao.spec.ts`: a espera dos 300 ms não é fixa no tempo. Se a página demorar além do prazo da entrada (20 s), o caso falha pelo título, e não pelo clique. É seguro, e só fica a nota.
- `e2e/recarga-da-sessao.spec.ts:16`: o `id="denovo"` da página estática do teste ainda usa o nome antigo. É só cosmético e não afeta a função.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/support/casca.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/recarga-da-sessao.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/professor-conversa.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/correcoes/2026-10-31-conversa-sem-titulo-na-entrada.md

## test-engineer · 2ª rodada · APROVADO · 2026-10-31 22:34:24 · `tasks/correcoes/2026-10-31-conversa-sem-titulo-na-entrada.md`

**VEREDITO: APROVADO**

A correção exigida na 1ª rodada foi feita. O filtro de `e2e/support/casca.ts:149` agora tem um teste que o prova, e não sobrou bloqueante.

**Cenários exigidos:**
1. Recarga com a renovação recusada uma vez: a espera clica em "Tentar de novo" e chega ao título.
2. Recusada duas vezes: falha com um erro que diz o que a tela mostrava, sem esperar os 20 s.
3. O "Tentar de novo" de dentro do `main` não é clicado: é de uma tela, e não da sessão.
4. O caso `:171`, com a recusa na rede e a contagem exata de renovações.
5. As três cópias de `recarregar` passam a chamar a mesma espera.

Permissão e isolamento não se aplicam: a mudança é só do apoio de e2e, sem dado de escola nem rota.

**Cobertos:**
- **Cenário 1:** `e2e/recarga-da-sessao.spec.ts:27`.
- **Cenário 2:** `e2e/recarga-da-sessao.spec.ts:33`.
- **Cenário 3:** `e2e/recarga-da-sessao.spec.ts:38`, o caso novo. Sem o filtro `:not(main *)`, o botão de dentro do `main` entra no `or` antes de o título chegar (300 ms) e é clicado. O caso fica vermelho de um de dois jeitos, e os dois vêm da cláusula. Se o título ainda não chegou, a segunda volta lança "recusou ... 2 vezes". Se já chegou, a espera resolve com `cliques === 1` e a asserção da linha 53 falha. Com o filtro, a espera resolve pelo título e a contagem é 0. Rodei aqui: 6 passaram em 4,2 s, nos projetos `chromebook` e `celular`.
- **Cenário 4:** `e2e/professor-conversa.spec.ts`. O `toBe(2)` agora tem comentário dizendo que o número é exato, e o `page.unroute` vem depois da asserção. As duas recomendações da 1ª rodada foram aplicadas.
- **Cenário 5:** sem mudança desde a rodada aprovada naquela parte.

Não há `.skip`, teste comentado nem mock que esconda a regra. Não há IA nem concorrência nesta correção. Não se aplica bloco de mutação: `e2e/` não é código de produção (RF17). O documento diz que conferiu o vermelho apagando o filtro, e a análise acima confirma.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Filtro do aviso sem teste.** O filtro novo `.and(page.locator(':not(main *)'))` sobre o `alert`, em `e2e/support/casca.ts:154`, não tem caso que o prove. Se for apagado, os três casos continuam verdes, porque no caso `:33` o único `alert` já está fora do `main`. O efeito fica só no texto do erro de diagnóstico, e pela seção Sintoma a tela da sessão `indisponivel` não tem `main`. Por isso não bloqueia. Para cobrir barato: no caso `:33`, pôr um `<main><div role="alert">outro aviso</div></main>` antes do `#sessao` e manter a exigência do texto `AVISO` no erro.
2. **Folga de tempo do caso novo.** O vermelho do caso `:38`, com o filtro apagado, depende de a primeira volta da espera acontecer antes dos 300 ms do `setTimeout`. Isso afeta só a detecção da mutação, não o verde com o código certo, que passa com qualquer carga. Subir para uns 1000 ms dá mais folga sem custo relevante.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/recarga-da-sessao.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/support/casca.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/professor-conversa.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/correcoes/2026-10-31-conversa-sem-titulo-na-entrada.md`
