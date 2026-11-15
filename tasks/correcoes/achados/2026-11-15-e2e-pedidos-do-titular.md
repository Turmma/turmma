# Achados das revisões — `tasks/correcoes/2026-11-15-e2e-pedidos-do-titular.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-15 16:52:48 · `tasks/correcoes/2026-11-15-e2e-pedidos-do-titular.md`

VEREDITO: APROVADO
Tela vista: sim (8 fotos lidas, computador e celular, escola cheia e vazia, do Painel e de Registros › Pedidos).
Estados: ok. A mudança é só de e2e, e o produto não mudou. Com dado, vazio e carregando estão no código existente. O fallback do Suspense é `LoadingState` (`apps/web/src/components/states/LoadingState.tsx:15`), um `<p role="status">Carregando…</p>`. O seletor novo de `esperarATela` (`main` > `status` com texto `^Carregando`) casa com ele. Erro e carregando não aparecem na vitrine e não foram alterados.
Acessibilidade: sem alteração no produto. Nas fotos, o foco de aba e botão está legível, os rótulos são visíveis e o texto está em português.
Chromebook fraco: a correção existe por causa da rede do navegador sob throttling. A recarga é uma só, com o mesmo prazo de 20 s, e aparece como anotação do caso e como `::warning` na esteira. A trava não fica escondida.
Celular: as fotos a 360 px não têm rolagem horizontal nem corte. As ações principais (Registrar pedido, Ver em Registros) e as abas passam de 44 px de altura. A barra inferior sobre o card "Rejeitado" na foto comprida do Painel é efeito da captura de página inteira com barra fixa. Não é defeito.
Ação oficial protegida: sim (nada de ação oficial foi tocado).
Bloqueantes: nenhum.

Fotos e rolagem:
- Tela vazia convida: "Nenhum pedido registrado" diz o que fazer.
- "Tudo em dia" no Painel vazio e "Nenhuma função da IA trabalhou neste mês." também orientam.
- A linha "Rolam a 1366 × 768" vem como nenhuma, então não há RF de tela que caiba.
- Nenhum termo técnico, id ou texto em inglês aparece. A pele está na paleta da D80.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/support/profiles.ts` (`esperarATela`): `page.goto(url)` na recarga usa o `goto` já embrulhado por `gotoComNovaTentativa`, então a segunda carga ganha a trava do `goto` por baixo. Isso é aceitável. O tempo total de uma falha pode chegar a 20 s + recarga + 20 s e deve caber nos 90 s do caso, mas vale conferir na esteira.
- Nas fotos de celular, o topo mostra "Colégio s…" truncado ao lado de Sino e Sair. Não é desta tarefa e não bloqueia. Vale registrar para a validação: o nome da escola some no celular.
- A ligação de `irPelaCoordenacao` ao `esperarATela` não tem caso próprio. A correção declara isso, e a recomendação é só manter à vista o aviso `primeira-carga-travou` na esteira.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-15 16:52:51 · `tasks/correcoes/2026-11-15-e2e-pedidos-do-titular.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok (não se aplica, a tarefa não muda código de `apps/` nem de `packages/`)
Fila e prioridade: ok (não se aplica)
Concorrência: protegida (não se aplica, não há escrita nova)
Índice e paginação: ok (não se aplica, não há query nova)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (não há código novo no caminho quente; a recarga do e2e deixa a anotação `primeira-carga-travou` e a linha `::warning` na esteira)
Bloqueantes: nenhum
Recomendações:
- A correção só torna o e2e tolerante à falha. A tela em produção continua sem saída. Quando um pedaço `tela-coordenacao-*.js` ou uma leitura de `/v1/...` não volta, a tela fica em "Carregando…" para sempre, sem aviso e sem botão de tentar de novo. Numa escola com rede ruim às 10h de segunda, é isso que um Chromebook mostra. Vale abrir uma tarefa de produto para dar prazo à importação dos pedaços, com a mensagem de "tente de novo" e a recarga, e prazo também às consultas da tela no TanStack Query. Assim o "Carregando…" eterno vira erro tipado e recuperável.
- `esperarATela` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/support/profiles.ts` pode esconder uma regressão de tempo de carga: a segunda carga vem com o cache cheio. A tarefa mitiga isso com o `::warning`, mas nada conta essas ocorrências. Vale um passo na esteira, ou uma linha no runbook, que some os `primeira-carga-travou` de cada execução e acenda quando o número passar de um limite combinado. Hoje "ocorrência que se repete é regressão" depende de alguém ler os avisos.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/support/coordenacao.ts`: a ligação de `irPelaCoordenacao` com a recarga não tem caso próprio, e a tarefa admite isso. Fica registrado para a retro.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-15 16:52:52 · `tasks/correcoes/2026-11-15-e2e-pedidos-do-titular.md`

VEREDITO: APROVADO

A correção mexe só no e2e. Nada em `apps/` nem em `packages/` muda, e o produto não ganha campo, rota, log nem envio novo.

Campos pessoais tocados: nenhum.
Fora da tabela de dados do docs/lgpd.md: nada.
Autorização por objeto: ok. Nenhuma rota foi alterada; a correção só muda como os testes do e2e esperam a tela carregar.
Logs: limpos. A anotação `primeira-carga-travou` e a linha `::warning` (`e2e/support/profiles.ts`, `descricaoDaTelaTravada` e `registrar`) levam só o caminho da página, sem `?` nem `#`, o prazo, o nome do projeto e o arquivo e a linha do caso. Como o caminho é tirado com `new URL(alvo).pathname`, um token na query não chega ao aviso, e isso importa porque o repositório é público e o aviso aparece nas anotações do GitHub. No uso de hoje o caminho é `/coordenacao/painel` ou uma tela da coordenação aberta pelo `irPelaCoordenacao`. Se tiver algum id, é um UUID de dado sintético.
Auditoria: presente, e nada muda. A recarga refaz a leitura da tela pela API real, então uma leitura auditada pode ficar registrada duas vezes na auditoria. Isso é mais registro, não menos: a recarga não pula nenhum registro.
Envio externo: nenhum.
Seed/fixture: sintético. As telas servidas pela rota em `e2e/guardas.spec.ts` (linhas novas, a partir da 274) são HTML fixo sem dado de pessoa. As fotos mostram "Colégio sintético da vitrine cheia 4032136b" e "Coordenadora sintética 9fca3ba9".

Fotos da tela: o Painel da escola cheia (`coordenacao--coordenacao-painel--computador.png`) mostra só números da escola toda: gerado, aprovado, esperando, rejeitado e o consumo. Não aparece nome de aluno, nota nem conversa, e o texto avisa que a lista de nomes não é lida no Painel. Os Pedidos (`coordenacao--coordenacao-privacidade-pedidos--computador.png` e `vazia--coordenacao--coordenacao-privacidade-pedidos--celular.png`) mostram o estado vazio, sem dado de titular. O que aparece bate com o que a regra 20 pede para a coordenação.

Pergunta de fechamento: a correção não muda o que o sistema guarda nem para onde envia. A resposta continua com o arquivo do titular (`apps/api/test/arquivo-do-titular.int.test.ts`), sem alteração.

Bloqueantes: nenhum.

Recomendações:
- Na próxima vez que mexer em `descricaoDaTelaTravada` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/support/profiles.ts`), vale um comentário dizendo que tirar a query é de propósito, por privacidade e porque o repositório é público, não só por estética. Assim ninguém troca `pathname` por `href` mais tarde.
- Hoje um caso do e2e que conte leituras na auditoria com número exato quebraria depois de uma recarga. Ele ficaria vermelho, sem esconder nada, então não é risco de privacidade. Só registro para o `test-engineer` saber, caso o `::warning` apareça junto com uma falha de contagem.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/support/profiles.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/support/casca.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/support/coordenacao.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/guardas.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/correcoes/2026-11-15-e2e-pedidos-do-titular.md`

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-15 16:52:52 · `tasks/correcoes/2026-11-15-e2e-pedidos-do-titular.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. O diff só mexe no código de apoio dos testes de navegador (`e2e/support/profiles.ts`, `e2e/support/casca.ts`, `e2e/support/coordenacao.ts`) e acrescenta dois casos em `e2e/guardas.spec.ts`. Nenhum desses arquivos grava, prepara dados nem importa `Nota`. Todos com autor humano? sim (nenhum caminho novo)
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhum fluxo de saída de IA foi tocado. A recarga nova (`esperarATela`, em `e2e/support/profiles.ts`) abre `about:blank` e volta ao endereço com GET, só para esperar. Não clica em aprovar e não repete pedido de escrita, então não pode registrar uma aprovação duas vezes nem gerar aprovação que ninguém fez.
Supervisão do tutor: ok. O tutor não foi tocado.
Autonomia declarada e visível: sim. Nada mudou aqui. No Painel da escola cheia, o bloco "A IA nesta escola" mostra Gerado por IA 7, Aprovado por gente 3, Esperando o professor 1 e Rejeitado 0 ("O professor recusou, com justificativa"), com "Ver em Registros". Isso responde ao item 6 da regra: o que a IA gerou, quem aprovou e quando.
Bloqueantes: nenhum

O que vi nas fotos (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/.processo/vitrine/`):
- **Telas e regra 70:** a tarefa não muda o produto, e as quatro fotos que li (Painel e Pedidos, escola cheia no computador e escola vazia no celular) não mostram nada contra a regra 70.
- **Nota:** nenhuma nota, conceito ou sugestão de nota aparece. Os textos falam só em "correções que um professor aprovou" e em "Só valem depois da decisão dele".
- **Professor:** não há indicador nominal de professor nem ranking.
- **Aluno:** não há nada que leia comportamento do aluno.
- **Saída:** "Sair" está à vista nas duas larguras, então não há nada que dificulte sair.

Recomendações:
- Esta tarefa não mexeu em nada da regra 70, e o conjunto completo de revisores só veio porque a pasta `e2e/` exige todos (`tools/processo/guardioes-por-caminho.ts`). Fica para a retro avaliar se tarefa que só altera o código de apoio de `e2e/support/` precisa mesmo do `conformidade-reviewer`.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-15 16:53:31 · `tasks/correcoes/2026-11-15-e2e-pedidos-do-titular.md`

VEREDITO: REPROVADO

Escopo: respeitado. Só o e2e muda, e o produto fica como estava. As fotos mostram as telas do jeito que já eram, e é o esperado, porque nenhum arquivo de `apps/` mudou.

Aderência à Tech Spec: ok. É uma correção de e2e e não toca arquitetura.

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo).

Bloqueantes:

1. **A mudança quebra o `roteiro-da-demonstracao.spec.ts` nos dois projetos.** O portão não viu porque só rodou o `guardas.spec.ts`.
   - Onde está o erro: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/support/profiles.ts:166`. O `esperarATela` lança `'a página não veio do \`test\` de profiles.ts…'` quando `travasDaTela` não tem a página.
   - Por que só o `page` do fixture escapa: o `travasDaTela.set` só existe no fixture `page` (profiles.ts:207). Página aberta por `browser.newContext().newPage()` não entra no mapa. O próprio comentário de `gotoComNovaTentativa` (profiles.ts:124) diz que essas páginas "navegam como antes".
   - Como quebra: em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/roteiro-da-demonstracao.spec.ts:168`, a coordenação é `outroNavegador(browser)`. Na linha 186 ela chama `passarPelaIntroducaoDaCoordenacao(coordenacao, …)`, que chama `esperarPainel` (casca.ts:599), que agora passa pelo `esperarATela`. O caso lança ali. Depois disso vêm `irPelaCoordenacao(coordenacao, 'Professores' | 'Material' | 'Agentes', …)` nas linhas 237, 340 e 624, que caem pelo mesmo caminho em `activateQuandoAparecer`. Antes desta correção, `esperarPainel` e `activate` funcionavam com qualquer `Page`.
   - O documento da correção trata a falha como suposição aceita, no item (3) do JSDoc. Também diz que a prova da ligação são "os 139 usos do e2e", mas esses usos não rodaram.
   - Correção exigida:
     - Quando a página não tem a trava registrada, o `esperarATela` espera como antes, com o mesmo prazo (`STUCK_SCREEN_TIMEOUT_MS`) e sem recarga, como o `goto` já faz. A outra saída é registrar a trava também nas páginas de `outroNavegador`. Em qualquer dos dois caminhos, retire a suposição (3) do JSDoc.
     - Acrescente em `e2e/guardas.spec.ts` um caso com uma página de `browser.newContext()` que passe por `esperarPainel` sem lançar.
     - Rode o `roteiro-da-demonstracao.spec.ts` nos dois projetos antes do novo carimbo.

Recomendações:
- O `activateQuandoAparecer` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/support/coordenacao.ts:72`) reduz de 90 s para 20 s a espera de aba, seletor ou link que demora sem estar em "Carregando…". Antes o clique esperava o prazo do caso inteiro. Isso muda o comportamento e não está escrito na seção "Correção". Ou se escreve, ou se confirma na esteira que nenhum caso dependia da folga.
- A constante `STUCK_SCREEN_TIMEOUT_MS` tem nome em inglês no meio de nomes em português do mesmo arquivo (`PRAZO_DA_NAVEGACAO_MS`, `prazoDaTelaMs`). `PRAZO_DA_TELA_MS` seguiria o padrão dele.
- O JSDoc do `esperarATela` repete quase inteiro o raciocínio do `gotoComNovaTentativa`. Dá para remeter a ele e encurtar.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-15 16:54:53 · `tasks/correcoes/2026-11-15-e2e-pedidos-do-titular.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
1. Caminho feliz: o Painel preso em "Carregando…" é recarregado uma vez, abre, e a ocorrência fica anotada e avisada na esteira.
2. Borda: a espera falha com outra tela (sem "Carregando…"). Reprova na primeira, sem recarga e sem anotação.
3. Borda: a tela trava de novo depois da recarga. Reprova com o erro da espera depois de uma recarga só.
4. Borda: a página não veio da fixture `test` de `profiles.ts` (`browser.newContext().newPage()`, o "outro navegador" da segunda pessoa) e passa por `esperarPainel` ou `irPelaCoordenacao`.
5. A ligação de `irPelaCoordenacao` (aba, seletor e link) à recarga, que é o remédio da falha do `:209`.
6. A descrição do aviso leva só o caminho, sem `?` nem `#`.
7. Permissão e isolamento: não se aplicam, porque só muda o suporte do e2e e o produto fica igual.

**Cobertos:** os cenários 1, 2 e 3, nos dois projetos (`guardas.spec.ts:304` e `:327`). Rodei os quatro casos e passaram em 8,5 s. As oito mutações declaradas batem com as linhas novas de `profiles.ts` e `casca.ts`. O cenário 6 está coberto em parte: a igualdade exata da descrição no caso 1 pega a troca de `pathname` pela URL inteira.

**Bloqueantes:**

1. **A correção quebra dois e2e que hoje passam.** Em `e2e/support/profiles.ts:166`, `esperarATela` lança `a página não veio do \`test\` de profiles.ts` quando a página não está em `travasDaTela`. Esse mapa só recebe a página da fixture (`profiles.ts:202`). Só que `esperarPainel` e `irPelaCoordenacao` também recebem páginas abertas com `browser.newContext().newPage()`:
   - `e2e/roteiro-da-demonstracao.spec.ts:168` cria `coordenacao` com `outroNavegador`. Em `:186`, `passarPelaIntroducaoDaCoordenacao(coordenacao, …)` chama `esperarPainel` (`casca.ts:599`) e lança na hora. O mesmo acontece em `:237` (Professores, aba), `:340` (Material, aba) e `:624` (Agentes, link). O roteiro da demonstração cai inteiro.
   - `e2e/incidentes.spec.ts:336` cria `naOutra` com `outroNavegador` (`:95-108`). Em `:352`, `abrirAAba(naOutra)` chama `irPelaCoordenacao(…, 'Incidentes')`, que tem aba e seletor, e lança. O caso caído é "duas coordenadoras: quem chega depois da confirmação da outra confirma sem erro… a faixa da outra some ao abrir a aba" (`:328`).
   
   O portão desta correção só roda `guardas.spec.ts`, então isso só aparece na esteira, como uma nova falha vermelha. O documento chega a assumir esse comportamento ("de outra forma, falha, em vez de seguir sem recarga"), mas não conferiu quem chama.
   
   **Correção exigida:**
   - Dar a recarga a toda página do teste, e não só à da fixture. Por exemplo: registrar `travasDaTela` também nas páginas criadas pelo `browser` e pelo `context` do `test` (estender `context` ou `browser`), ou montar a trava dentro de `esperarATela` a partir de `test.info()` quando faltar.
   - Escrever em `guardas.spec.ts` o caso "página de `browser.newContext().newPage()` com o Painel servido pela rota em Carregando… é recarregada e abre", com um bloco de mutação sobre a cláusula nova.
   - Rodar `roteiro-da-demonstracao.spec.ts` e `incidentes.spec.ts:328` nos dois projetos e registrar no documento.

2. **A cláusula nova que conserta o `:209` não tem bloco nem teste.** Os pontos sem bloco são `e2e/support/coordenacao.ts:72-75` (`activateQuandoAparecer`) e as três trocas em `:88`, `:93` e `:96`. Se alguém trocar `activateQuandoAparecer` de volta por `activate`, nenhum teste fica vermelho. O próprio documento reconhece isso (item 2 de "O que a correção não prova"), e a prova que ele cita foi um caso descartável, apagado.
   
   A justificativa de que "a casca real não cabe na rota" vale para `irPelaCoordenacao` inteiro, mas não para a ligação. `activateQuandoAparecer` pode ser exportada e testada com a mesma rota: um `main` em "Carregando…" na primeira carga e uma `tab` na segunda. O caso confere que houve uma recarga, que o clique aconteceu e que há uma anotação.
   
   **Correção exigida:** esse caso em `guardas.spec.ts`, mais um bloco `mutacao` sobre `coordenacao.ts` que troque `activateQuandoAparecer` por `activate`.

**Recomendações:**
- **O filtro `/^Carregando/` não está provado** (`profiles.ts:170`). A tela da primeira parte do caso 2 não tem nenhum `status`, então tirar o `.filter` passa verde. Trocar `TELA_SEM_PAINEL` por uma tela com `<p role="status">Não foi possível carregar</p>` faria a falha de outra natureza distinguir status de erro de "Carregando…".
- **A retirada de `?` e `#` em `descricaoDaTelaTravada` não tem caso** (`profiles.ts:145`). Um teste de unidade direto, com `http://x/coordenacao/painel?token=a#b`, provaria que nada da query vai para a linha `::warning`, que é pública na esteira.
- **Aviso não conferido na segunda trava:** a segunda parte do caso 2 não confere `avisosGuardados` (devia ter uma linha).
- **Prazo do clique ficou mais curto:** o clique da aba passa de "até o fim do caso" para 20 s + 20 s quando a tela trava. Nas telas lentas sem "Carregando…" o caso agora cai em 20 s, com um erro mais claro. Vale dizer isso no documento, para quem ler a esteira não tomar por regressão.
- **Mudança em `e2e/support/` só roda o spec alterado no portão:** esta tarefa mostra o custo disso. Vale levar para a retro a ideia de rodar, no portão, os specs que importam o arquivo de suporte alterado (ou ao menos os que usam a função mudada).

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/support/profiles.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/support/coordenacao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/support/casca.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/guardas.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/roteiro-da-demonstracao.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/incidentes.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/correcoes/2026-11-15-e2e-pedidos-do-titular.md

## revisor-geral · 2ª rodada · APROVADO · 2026-11-15 17:25:25 · `tasks/correcoes/2026-11-15-e2e-pedidos-do-titular.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. A correção mexe só no e2e, como o documento declara, e o produto não muda.
Portão local: carimbo válido. A conferência devolveu "portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)".
Bloqueantes: nenhum

As correções exigidas na 1ª rodada estão feitas:
- **Página sem a trava registrada:** em `e2e/support/profiles.ts:167-190`, a trava agora pertence ao caso. Fica guardada por `TestInfo` na fixture automática `travaDoCaso` e é lida com `base.info()`. Fora de um caso, `esperarATela` espera `PRAZO_DA_ESPERA_DA_TELA_MS`, sem recarga e sem lançar erro. O erro "a página não veio do `test`…" saiu da espera. Ainda existe em `profiles.ts:246`, mas lá é da `loadUnthrottled`, e está certo.
- **Suposição (3):** saiu do JSDoc (`profiles.ts:157-166`).
- **Caso com `browser.newContext()`:** está em `e2e/guardas.spec.ts:352-371`. Passa por `esperarPainel` e por `activateQuandoAparecer`, com duas recargas, duas anotações e dois avisos. A mutação `auto: true` → `auto: false` está declarada.
- **Roteiro da demonstração:** o documento registra o `roteiro-da-demonstracao.spec.ts` e o `incidentes.spec.ts:328` verdes nos dois projetos, 4 de 4 (seção "Provas da rodada 2").
- **As três recomendações que a Mesa mandou aplicar:**
  - O prazo de 20 s no clique da aba está escrito no documento (linha 56).
  - A constante virou `PRAZO_DA_ESPERA_DA_TELA_MS`, e nenhum resto de `STUCK_SCREEN_TIMEOUT_MS` ficou na árvore.
  - O JSDoc foi encurtado e remete ao `gotoComNovaTentativa`.

Recomendações:
- `tasks/correcoes/2026-11-15-e2e-pedidos-do-titular.md:137-163`: os quatro blocos `mutacao` novos estão dentro da seção "Revisões", que o hook preenche e que diz "Não edite à mão". O lugar deles é a seção "Mutações" (linha 63).
- `e2e/support/profiles.ts:169`: o caminho sem trava, que espera sem recarga, não tem caso que o prove. Pela guarda de `tools/ci/playwright.test.ts`, todo spec usa o `test` deste arquivo, então esse caminho só roda em hook `beforeAll`. Se for só defesa, vale escrever isso numa linha. Se não for, vale um caso. A cobertura é assunto do `test-engineer`.
- `e2e/support/profiles.ts:200`: `travaDoCaso` passa a aparecer como fixture no tipo do `test` de todos os specs, embora seja interno. Se o Playwright permitir, vale uma fixture com nome que deixe claro que é interna, ou um tipo separado das `ProfileOptions` expostas.
- `esperarATela` (`profiles.ts`) e `esperarATelaDepoisDaRecarga` (`casca.ts:147`) têm nomes quase iguais e fazem coisas diferentes. Quem chega ao código confunde as duas. Fica para quem mexer na próxima.

Arquivos lidos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/support/profiles.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/guardas.spec.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/support/coordenacao.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/support/casca.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/correcoes/2026-11-15-e2e-pedidos-do-titular.md`.

## test-engineer · 2ª rodada · APROVADO · 2026-11-15 17:26:27 · `tasks/correcoes/2026-11-15-e2e-pedidos-do-titular.md`

VEREDITO: APROVADO

**Cenários exigidos:**
1. A tela presa em "Carregando…" é recarregada uma vez, abre, fica anotada e avisa a esteira.
2. Uma falha de outra natureza, como uma tela com `status` que não é "Carregando…", reprova sem recarga.
3. Uma segunda trava reprova depois de uma recarga só.
4. A página de `browser.newContext()` também ganha a recarga. Era a correção 1.
5. `activateQuandoAparecer` espera, recarrega e clica. Era a correção 2.
6. A descrição que vai para a esteira não leva query nem fragmento, porque o repositório é público.
7. Os specs que já usavam outro navegador não podem quebrar: `roteiro-da-demonstracao` e `incidentes:328`.

**Cobertos:**
- **Correção 1, feita.** A trava agora vale para o caso inteiro, e não só para a página da fixture: a fixture automática `travaDoCaso` guarda o prazo e o registro por caso (`e2e/support/profiles.ts:205-217`).
  - O caso 3, `a página de um contexto novo do navegador também ganha a recarga…` (`e2e/guardas.spec.ts:352`), usa `browser.newContext().newPage()`, recarrega a tela presa e o Painel abre.
  - O bloco `{ auto: true }` → `{ auto: false }` derruba o caso 3: sem a fixture, a espera não recarrega.
  - O documento registra `roteiro-da-demonstracao.spec.ts` e `incidentes.spec.ts:328` nos dois projetos, 4 de 4 verdes.
  - Não sobrou `travasDaTela` nem `STUCK_SCREEN_TIMEOUT_MS` em `e2e/` nem em `tools/`.
  - Nenhuma outra extensão de `test` existe (`.extend` só em `profiles.ts:200`), e não há `beforeAll` nem `globalSetup`. Toda chamada roda dentro de um caso que tem a trava.
- **Correção 2, feita.** `activateQuandoAparecer` está exportada (`e2e/support/coordenacao.ts:72`). O caso 3 confere três coisas: a recarga na espera da aba (3 pedidos), o clique (`aria-selected` = `true`) e as duas anotações com as duas linhas `::warning`. O bloco sobre `coordenacao.ts` tira a linha do `esperarATela`. Assim o clique espera uma aba que nunca aparece e o caso estoura o prazo. É o efeito da troca por `activate` que eu tinha pedido.
- **Cenário 2 ficou mais forte.** A tela trocou para `TELA_COM_ERRO`, que tem um `status`. O bloco que tira o filtro `/^Carregando/` agora fica vermelho em `expect(outraTela()).toBe(1)`. O bloco antigo, que remove o `if … count() === 0`, continua alcançando a cláusula com essa tela.
- **Privacidade da descrição:** a asserção está em `guardas.spec.ts:328`, e o bloco que troca `pathname` por `alvo` a derruba.
- **Mutações antigas:** os dois blocos com recuo novo (anotação e linha `::warning`) acompanham o código atual, e os demais seguem iguais.
- Os três casos estão citados pelo nome em "Teste que reproduz" e existem no spec. Não há `.skip`, teste comentado nem mock que esconda a regra. A tarefa não envolve IA nem concorrência.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Ramo sem teste e sem bloco.** `e2e/support/profiles.ts:169`, com o `try/catch` de `travaDoCasoAtual` (`:184-190`), é a saída de quando não há caso: `if (trava === undefined) return esperar(PRAZO_DA_ESPERA_DA_TELA_MS)`.
   - Hoje nenhuma chamada chega a esse ramo, e trocá-lo por um `throw` não derruba teste nenhum.
   - Ele também troca o "falha alto" da rodada 1 (o mesmo padrão de `loadUnthrottled`) por uma perda silenciosa da recarga. Hoje só o bloco `auto: false` protege contra isso.
   - Sugestão: tirar o ramo e lançar um erro claro, ou cobri-lo com um teste de unidade que chame `esperarATela` fora de um caso e confira o prazo de 20 s.
2. **Chamadas sem prova própria.** As três trocas de `activate` por `activateQuandoAparecer` em `irPelaCoordenacao` (`e2e/support/coordenacao.ts:88`, `:93`, `:96`) ainda não têm teste: voltar qualquer uma para `activate` não derruba caso nenhum. O documento declara isso em "O que a correção não prova", item 2. Uma página servida pela rota com a navegação `Seções` mínima e a aba permitiria testar `irPelaCoordenacao` de ponta a ponta.
3. **Blocos fora do lugar.** Os quatro blocos novos ficaram depois da tabela de "## Revisões", nas linhas 137-163 de `tasks/correcoes/2026-11-15-e2e-pedidos-do-titular.md`. O portão lê todos, porque o `lerMutacoes` procura o padrão no arquivo inteiro. Mas quem lê o documento, e a leitura do `--faltando` que olha só a seção (`mutacoes.ts:1369`), não os acha em "## Mutações". Vale levá-los para dentro dessa seção.

Arquivos lidos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/correcoes/2026-11-15-e2e-pedidos-do-titular.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/guardas.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/support/profiles.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/support/coordenacao.ts`
