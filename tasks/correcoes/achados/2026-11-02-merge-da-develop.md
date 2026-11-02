# Achados das revisões — `tasks/correcoes/2026-11-02-merge-da-develop.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-02 19:25:29 · `tasks/correcoes/2026-11-02-merge-da-develop.md`

VEREDITO: APROVADO

Tela vista: sim (8 fotos lidas: `/entrar` e `/mfa`, no computador e no celular, na escola cheia e na vazia). As duas escolas saem idênticas, o que é esperado, porque são telas públicas, sem dado.

Estados:
- **Carregando:** a onça e o cenário chegam por `import()` com `fallback={null}`, em caixas que já têm o tamanho final, então a página não pula (`apps/web/src/components/CascaPublica.tsx`).
- **Erro:** se o pedaço da onça não carregar, `.catch(() => SEM_ONCA)` mantém o formulário de pé, sem a figura. A tela do segundo fator, sem sessão, mostra uma mensagem que diz o que fazer ("entre de novo com o seu e-mail e a sua senha") e um botão "Ir para a entrada".
- **Vazio e com dado:** não se aplicam a essas telas. Não há lista nem dado.
- Pelo código e pelo e2e, não pela foto. O código é o da `develop` com os nomes da spec.

Acessibilidade:
- **Rótulos e foco:** os campos "E-mail" e "Senha" têm rótulo visível, e o `main` e o `h1` do título estão na casca.
- **Onça:** a figura é `aria-hidden` e sem nome acessível, de propósito (regra 70, item 4a: nenhum agente produziu nada na entrada).
- **Contraste:** o texto do botão sobre o laranja se lê bem nas fotos.
- **axe:** o e2e `casca-publica.spec.ts:308` roda o axe a 1366 e a 360 px.
- **Movimento:** o aceno é uma vez só, sem laço, e para com "reduzir movimento" (D59).

Chromebook fraco:
- O cenário e a onça saem do primeiro carregamento (pedaço `pecas-*`).
- A tela cabe nos 768 px de altura (a lista `Rolam` veio vazia).
- Não há lista longa nem upload nessas telas.

Celular:
- **360 px:** sem rolagem horizontal e sem texto cortado.
- **Alvos:** o botão "Entrar" e o "Ir para a entrada" medem cerca de 44 px de altura nas fotos, e os campos cerca de 46 px.
- **Sem hover:** nada depende de hover nem de atalho.
- **e2e:** `e2e/casca-publica.spec.ts` mede `horizontalOverflow` a 360 e 1023 px (linhas 79 a 106 e 288 a 292). A conferência é só de leitura. Não rodei o projeto `celular` do Playwright.

Ação oficial protegida: sim. Não há ação oficial nessas telas.

Bloqueantes: nenhum.
- Não sobrou marcador de conflito nem arquivo em conflito (`git diff --cached --diff-filter=U` vazio).
- A casca importa `Logo` de `./ui/Logo`, o nome novo do rename, e a pasta antiga `componentes/` não aparece mais em `CascaPublica.tsx`, em `ui/onca/` nem em `e2e/casca-publica.spec.ts`.
- Os apoios do e2e foram renomeados (`horizontalOverflow`, `seriousViolations`).
- Na foto, nenhum termo técnico, texto em inglês, chave de tradução ou id aparece. A paleta e a tipografia são as do `docs/interface.md` 11.3: painel `papel`, cartão com borda, botão laranja.
- O texto das telas não mudou em relação à `develop`, que é o que o merge deveria entregar. A foto bate com o código da árvore.

Recomendações:
- **Quebra de linha:** a mensagem do segundo fator quebra "e-" / "mail" a 1366 px (`professora--mfa--computador.png`). Um hífen não separável (`e‑mail`) ou `text-wrap: pretty` evita a quebra feia. Não bloqueia.
- **Título "Segundo fator":** é um termo um pouco técnico para a tela de quem foi mandado de volta sem sessão. "Confirmação de entrada" seria mais claro. Não é achado, porque o texto vem da `develop` e o rename não o toca (RF7).
- **Verificação de ordem:** vale conferir, na hora do pouso, que `tools/renomear/restos` continua limpo e que os 12 arquivos de teste da web tocados passam. A tarefa diz que passam; não reexecutei.

Arquivos revisados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/components/CascaPublica.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/casca-publica.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/correcoes/2026-11-02-merge-da-develop.md`

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-02 19:25:38 · `tasks/correcoes/2026-11-02-merge-da-develop.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. O merge da `origin/develop` (5eb334c2) traz só a onça da marca, o cenário dela na casca pública (`/entrar`, convite, segundo fator, página da turma), o nome dos pedaços do build, testes, e2e e documentos. A correção da spec só troca nomes. Não há campo, migration, repository, endpoint nem DTO no diff.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: não se aplica. Não há rota nem objeto novo na API. A `CascaPublica` aparece antes de haver sessão e não mostra dado de pessoa nenhuma.

Logs: limpos. O diff não acrescenta `console`, `logger`, `fetch` nem acesso a `localStorage`, `sessionStorage` ou cookie. A lembrança de "já acenou" em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/components/ui/onca/movimento-da-onca.ts` passou de uma variável única para uma por dono (`agente` e `marca`). Ela fica só na memória da página e guarda um booleano, sem nada que identifique alguém.

Auditoria: não se aplica. Não há leitura de dado de aluno, exportação, nota, permissão nem saída de IA. A onça da marca não é saída de agente: a `figure` é `aria-hidden`, sem nome de função nem selo, e usa `data-onca-da-marca` em vez de `data-onca`, que é da onça assinada por agente. Esse cuidado é da regra 70, item 4a, e não da 20.

Envio externo: nenhum. O `import()` tardio de `OncaDaMarca` e `CenaDaOnca` busca código do próprio bundle e não leva dado.

Seed/fixture: sintético. O `e2e/casca-publica.spec.ts` só abre `/entrar` e mede o layout, sem nome, e-mail ou credencial. Os testes de unidade só renderizam o SVG.

Bloqueantes: nenhum.

Recomendações: nenhuma da regra 20.

Pergunta de fechamento: o diff não cria nenhum dado novo sobre aluno nem envio novo para fora do sistema. Por isso a resposta à secretaria de educação é a mesma de antes deste merge.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-02 19:25:43 · `tasks/correcoes/2026-11-02-merge-da-develop.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum. É só front-end: a casca da tela de entrar ganhou a onça, que chega por `import()` como arquivo estático, sem chamar a API.
Rate limit: ok. A tarefa não cria rota nem limitador.
Fila e prioridade: ok. Nenhum job.
Concorrência: protegida. Não há gravação, transação nem estado de servidor.
Índice e paginação: ok. Nenhuma query.
Degradação de IA: não se aplica.
Migration: não se aplica.
Métrica e alerta: ok. A tarefa não põe código no caminho quente nem cria alerta.
Bloqueantes: nenhum.
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/components/CascaPublica.tsx`: o `.catch(() => SEM_ONCA)` não mostra que o pedaço da onça falhou na rede da escola. Se a falha se repetir às 7h30, ninguém fica sabendo. Vale contar essa falha na telemetria do front, quando ela existir. Não bloqueia: a página continua funcionando sem a onça.
- O teto do primeiro carregamento da entrada é o que mantém a tela de entrar leve no Chromebook com a rede da escola cheia. Hoje ele é provado só pelo teste do build (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/chunk-names.ts`, que põe `OncaDaMarca` e `CenaDaOnca` em `pecas-*`). Vale citar esse teto em `docs/infra.md` seção 3, junto do modelo de carga.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-02 19:26:14 · `tasks/correcoes/2026-11-02-merge-da-develop.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. O merge só traz a onça da marca, o cenário dela e a casca pública. Não toca em backend, em `Nota`, em correção, em seed nem em job. Todos com autor humano: não se aplica.
Decisão autônoma sobre aluno: ausente.
Aprovação registrada: ok. Nenhuma saída de IA nova. A onça da marca não é saída de agente: não tem nome, legenda, selo nem fala, e é `aria-hidden`. A D80 revista em 30/10/2026 aceita isso desde que a onça fique presa ao painel da casca pública.
Supervisão do tutor: ok, porque o merge não toca no tutor.
Autonomia declarada e visível: sim, sem mudança. A governança e os níveis dos agentes ficam fora do diff.

**O que conferi**

- **A spec só trocou nomes ao resolver o merge.** Em `docs/decisoes.md` a spec não mudou nada em relação à `origin/develop`. Em `e2e/casca-publica.spec.ts` só mudaram os ajudantes `larguraExcedente` → `horizontalOverflow`, `violacoesGraves` → `seriousViolations` e os caminhos de `support/`. Em `CascaPublica.tsx` só `Marca` → `Logo`. Em `CLAUDE.md` só `componentes/` → `components/`.
- **A onça dos agentes continua assinada (regra 70, item 4a).** Em `apps/web/src/components/ui/onca/Onca.tsx:31-40`, a `figcaption` ainda traz o nome da função e o `AIBadge`. O import foi trocado direito para `../ai/AgentSignature`. As antigas `componentes/` e `ui/ia/` não existem mais na árvore nem no índice.
- **O teste que fecha a lista de quem pode usar a onça está com os caminhos novos.** É o `apps/web/src/components/ui/ai/avatar-so-nas-duas-pecas.test.ts`, com `AgentAvatar`, `AgentSignature`, `gallery/` e `QUEM_IMPORTA_A_ONCA_DA_MARCA`. Por ele, só a `CascaPublica` importa a `OncaDaMarca` e o `CenaDaOnca`, e só por `import()` tardio. O desenho cru só é importado pela `Onca` e pela `OncaDaMarca`. A onça da marca não chega a `areas/`, a `gallery/` nem a `operacao/`. A troca de nomes não abriu nenhuma brecha nessa lista.
- **Nada induz uso (D59).** `e2e/casca-publica.spec.ts` prova três coisas. A onça só entra e acena, uma vez cada, sem `infinite`. O cenário não tem animação nem transição. Com "reduzir movimento", nada se mexe. Em `movimento-da-onca.ts`, cada dono tem a sua marca de "já acenou", e ela continua presa à sessão da página, sem laço.
- **O cenário não sugere nota nem aula (D55, D58).** `CenaDaOnca.tsx` não tem `text`, `title`, `aria-label` nem algarismo ou sinal de certo e errado. A lousa só tem triângulo, círculo e linha ondulada. A onça não segura nada e não aponta para a lousa.
- **Nada de vigilância.** O cenário não reage a cursor nem a digitação, e nada mede o comportamento de quem entra.

Não vi as fotos da tela porque o pedido não trouxe nenhuma. A conclusão vem só do código e dos testes.

Bloqueantes: nenhum.

Recomendações:
- Seis comentários de código ainda apontam para o caminho antigo `ia/avatar-so-nas-duas-pecas.test.ts`, que agora é `ai/…`. Estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/components/ui/onca/Onca.tsx:25`, `.../ui/onca/OncaDaMarca.tsx:25`, `.../ui/onca/CenaDaOnca.tsx:17`, `.../components/CascaPublica.test.tsx:76`, `.../ui/Comemoracao.tsx:19` e `.../ui/ai/AgentAvatar.tsx:52`. Os dois últimos já estavam assim no HEAD da spec. É só documentação e não muda o que o teste protege, mas quem procurar o teste pelo comentário não vai achar.
- Os títulos de `it` no teste de quem pode importar a onça ainda dizem `AvatarAgente` e `AssinaturaIA`. A RF7 manda mantê-los, e isso está certo. Vale anotar na retro que o título e o código passaram a usar nomes diferentes para a mesma peça.

## test-engineer · 1ª rodada · APROVADO · 2026-11-02 19:26:58 · `tasks/correcoes/2026-11-02-merge-da-develop.md`

VEREDITO: APROVADO

Cenários exigidos (para um merge da `develop` que só troca nomes, sem cláusula nova):
- Todo caso e toda asserção que a `develop` trouxe (onça da marca, cenário, `CascaPublica`, nomes dos chunks, guarda de cor, e2e da casca) chega com o mesmo sentido. Só pode mudar o nome ou o caminho renomeado (RF7).
- A contagem de casos fica igual à da `develop`.
- O `restos` fica limpo: nenhum nome antigo voltou pela `develop`.
- Os testes da web que o merge tocou passam.
- O merge não acrescenta código de produto com regra nova sem bloco de mutação. A tarefa declara "Sem mutação" com o motivo, que é o RF17.
- Permissão e isolamento: não se aplicam. É front público, sem dado de escola nem de pessoa.

Cobertos:
- **Contra `origin/develop`, a diferença é só de nome.** Comparei arquivo por arquivo, com detecção de renomeação.
  - Sete arquivos chegaram 100% iguais: `CascaPublica.test.tsx`, `.sem-cenario`, `.sem-onca`, `CenaDaOnca.tsx` e `.test.tsx`, `DesenhoDaOnca.tsx`, `OncaDaMarca.tsx`.
  - Nos outros, a diferença é só de nome: `CascaPublica.tsx` (`Marca` → `Logo`), `Onca.tsx` (`SeloIA` → `AIBadge`), `OncaDaMarca.test.tsx` (`stripSvgIds`, `codeWithoutCommentsOrText`), `estilos.test.ts` (caminhos), `e2e/casca-publica.spec.ts` (`horizontalOverflow`, `seriousViolations`, `support/`).
  - Em `avatar-so-nas-duas-pecas.test.ts` e `chunk-names.test.ts`, os blocos novos são linha por linha os da `develop`, com o caminho e o nome da spec.
- **Contagem de linhas igual.** A `develop` mudou 77 e 39 linhas nos dois arquivos de chunks, e o merge muda as mesmas 77 e 39. No `avatar-so-nas-duas-pecas.test.ts` são 90 contra 92, e a diferença é o título explicado na primeira recomendação.
- **Mesmo número de casos.** São os mesmos 3 `it` novos e o mesmo título trocado da `develop` (a pose `comemorando`). Nenhum caso entrou nem saiu.
- **Os testes passam.** `npx vitest run` sobre o `avatar-so-nas-duas-pecas`, o `estilos`, a pasta `ui/onca` e os três arquivos de teste da `CascaPublica` deu 11 arquivos e 141 casos verdes. O `chunk-names.test.ts`, com o build de verdade, deu 31 verdes. Somam os 172 casos que o documento declara.
- **O `restos` está limpo.** `node tools/renomear/restos.ts` devolveu `restos: limpo. 11 mapas, nenhum nome antigo sobrou.`
- **Mutações.** A prova dos blocos `mutacao` está nos três documentos da `develop` que vêm no merge. Esta correção só troca nome, e o "Sem mutação" está com o motivo escrito.
- Nenhum `.skip`, teste comentado, mock novo ou chamada de IA no diff.
- Não rodei o e2e: ele precisa da stack de pé, e o portão o roda.

Bloqueantes: nenhum.

Recomendações:
1. **Título de `it` trocado sem declarar.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/components/ui/ai/avatar-so-nas-duas-pecas.test.ts:80`, o título passou de `` `componentes/ui/onca/` só é importado… `` (como está no HEAD da spec) para `` `components/ui/onca/` … ``.
   - A `develop` não mexeu nesse título, e o item 3 do documento não declara a troca.
   - O mesmo documento diz que, no `chunk-names.test.ts`, o título com `componentes/ui/ia/…` "fica, como no HEAD". Os dois arquivos ficaram tratados de jeitos diferentes.
   - Pede uma de duas coisas: voltar o título ao do HEAD, ou declarar a troca no item 3. A troca de caminho citado é a que o RF7 permite.
2. **A prova do e2e.** Para a validação, vale anotar no documento que a `casca-publica.spec.ts` só foi conferida por `tsc`, e que a prova dela fica com o portão e a esteira (o diff dela contra a `develop` é só de nome).

Arquivos citados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/correcoes/2026-11-02-merge-da-develop.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/components/ui/ai/avatar-so-nas-duas-pecas.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/chunk-names.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/casca-publica.spec.ts`

## revisor-geral · 1ª rodada · APROVADO · 2026-11-02 19:28:03 · `tasks/correcoes/2026-11-02-merge-da-develop.md`

VEREDITO: APROVADO

Escopo: respeitado. O diff é o merge da `origin/develop` (5eb334c2) com os conflitos resolvidos e os nomes trocados, e nada além disso. Comparei a versão da `develop` com a da árvore em todos os arquivos de código do merge: `CascaPublica*.tsx`, os arquivos de `ui/onca/`, `chunk-names.ts`, `estilos.test.ts`, `avatar-so-nas-duas-pecas.test.ts` e `e2e/casca-publica.spec.ts`. Nesses arquivos, a árvore só difere da `develop` em nome (`Marca` → `Logo`, `SeloIA` → `AIBadge`, os ajudantes de fixture, os caminhos `componentes/` → `components/`, `larguraExcedente`/`violacoesGraves`). Nenhuma regra, prop ou caso de teste mudou.

Aderência à Tech Spec: ok. O processo segue a §5, "O `reaplicar`": `reaplicar`, depois `conferir` e `restos`. Rodei o `restos` sobre a árvore atual e ele saiu limpo ("11 mapas, nenhum nome antigo sobrou"). A justificativa para a onça ficar em português se sustenta:
- PRD §3 ("A onça também fica, porque é a marca");
- RF5 ("menos a onça");
- `inventario-web-e2e.md:541`, que isenta `componentes/ui/onca/` inteira;
- `inventario-web-e2e.md:554`, que mantém `PropsDo…` de peça fora do kit e o `useAcenarNaPrimeiraVez`.

As fotos mostram em `/entrar` e `/mfa` o que a `develop` já entrega: o cenário a 1366 px e a onça de 88 px parada no celular. Não há texto novo nem peça fora do que as três correções da `develop` descrevem.

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo).

Bloqueantes: nenhum.

Recomendações:
1. **`conferir` no merge (Tech Spec §5, parágrafo "O `reaplicar`"):** a Tech Spec manda rodar o `conferir` depois do `reaplicar`. Com o merge ainda sem commit, porém, o `conferir` compara contra o `HEAD` e lista os 1101 acréscimos da `develop`, então não fica verde. O documento da tarefa (`tasks/correcoes/2026-11-02-merge-da-develop.md:62-64`) troca essa prova pelo `restos`, pelo `tsc`, pelo eslint e pelos testes, mas a troca só está escrita nele. Vale o Arquiteto registrar essa limitação e a prova que vale no merge na §5, porque a próxima volta da `develop` antes do pouso vai encontrar o mesmo vermelho. Desta vez, a comparação arquivo a arquivo entre `develop` e árvore descrita no Escopo cobriu o que o `conferir` provaria.
2. **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/TODO.md:2484`:** a linha veio da `develop` e ainda cita `nome-dos-chunks.ts`, que agora é `apps/web/chunk-names.ts`. A spec trocou a linha equivalente em `TODO.md:1794`. O `restos` não pegou esta porque ela cita só o nome do arquivo, sem o caminho `apps/web/`. O `TODO.md` não entra no RF9 nem no RF10; é uma troca de uma linha.
3. **Descrição da resolução:** o passo 1 do documento diz que o `chunk-names.ts` "fica com a lista da spec mais `ui/onca/OncaDaMarca`". A lista também ganhou `ui/onca/CenaDaOnca` e `ui/onca/DesenhoDaOnca`, como na `develop`. Isso está certo; só a frase está incompleta.

## test-engineer · 2ª rodada · APROVADO · 2026-11-02 19:36:28 · `tasks/correcoes/2026-11-02-merge-da-develop.md`

VEREDITO: APROVADO

**Cenários exigidos:** esta é uma rodada nova sobre um merge da `develop` que só troca nomes. Conferi três coisas: que as duas correções pedidas na rodada 1 foram feitas, que o diff desde a rodada aprovada (`163bfcef` → `b567d647`) não muda nenhuma asserção nem deixa cláusula sem bloco, e que os testes tocados continuam verdes.

**Cobertos:**
- **Recomendação 1, o título do `it`.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/components/ui/ai/avatar-so-nas-duas-pecas.test.ts:80` o título voltou a `` `componentes/ui/onca/` só é importado pelo `AvatarAgente`… ``, idêntico ao `HEAD:apps/web/src/components/ui/ai/avatar-so-nas-duas-pecas.test.ts`. O documento registra isso no item 4, junto com o título do `chunk-names.test.ts`, que também fica.
- **Recomendação 2, o e2e.** O documento agora diz que `e2e/casca-publica.spec.ts` só passou por `tsc` e eslint antes do portão. A prova dele é o portão (30 casos) e a esteira do push.
- **O resto do diff em `apps/`** é só comentário: `ia/avatar-so-…` virou `ai/avatar-so-…` em `CascaPublica.test.tsx`, `CenaDaOnca.tsx`, `Onca.tsx` e `OncaDaMarca.tsx`. Nenhuma asserção, condição ou código de produto mudou, então não há cláusula nova nem bloco de mutação faltando. A seção "Mutações" continua certa: o código novo é o da `develop`, e a prova dele está nos blocos das três correções de 30/10 que vêm no merge.
- **A árvore atual é a auditada.** `git diff --stat b567d647 -- apps e2e packages tools` não mostra nada.
- **Os testes passam.** `npx vitest run src/components/ui/ai/avatar-so-nas-duas-pecas.test.ts src/components/CascaPublica.test.tsx` deu 2 arquivos e 19 casos verdes.
- **Nada escondido.** Não há `.skip`, teste comentado nem mock novo, e nada toca IA, dado de escola ou concorrência.

**Bloqueantes:** nenhum.

**Recomendações:**
- O título do `it` (`componentes/…`, `AvatarAgente`) e o código (`components/…`, `AgentAvatar`) agora usam nomes diferentes para a mesma peça. Isso já está na tabela "Recomendações sem aplicar" como item para a retro. Quando o RF7 permitir, vale alinhar os dois.
- O `TODO.md` recebeu as quatro linhas que a tabela promete (os comentários de `Comemoracao.tsx` e `AgentAvatar.tsx`, o "e-mail" partido a 1366 px, a telemetria da carga da onça e o `docs/infra.md` seção 3). Nada a acrescentar.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-02 19:36:37 · `tasks/correcoes/2026-11-02-merge-da-develop.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum
Recomendações:
- Das três recomendações da rodada 1, duas foram feitas e uma foi encaminhada:
  - A linha do `TODO.md` agora cita `chunk-names.ts` no lugar de `nome-dos-chunks.ts`.
  - O item 1 do documento agora lista as três peças da onça que entram no `chunk-names.ts`: `CenaDaOnca`, `DesenhoDaOnca` e `OncaDaMarca`.
  - A nota sobre o `conferir` na Tech Spec §5 foi para a tabela "Recomendações sem aplicar", com destino retro e Arquiteto. A Tech Spec não é arquivo desta correção, então o destino é aceitável.
- `apps/web/src/components/ui/ai/avatar-so-nas-duas-pecas.test.ts:80`: o título do `it` voltou de `components/ui/onca/` para `componentes/ui/onca/`. A rodada 1 tinha trocado esse texto, o que contrariava a regra que manda não mexer no texto dos testes (RF7). O título agora bate com o HEAD da spec (linha 53) e com a `origin/develop`. O item 4 do documento registra isso. Fica, porém, um título de teste com um caminho que não existe mais na árvore. Inclua esse título no item que já está pedido para a retro, sobre o título do `it` e o código usarem nomes diferentes para a mesma peça.
- Os comentários de `apps/web/src/components/ui/Comemoracao.tsx:19` e `apps/web/src/components/ui/ai/AgentAvatar.tsx:52` ainda citam `ia/avatar-so-nas-duas-pecas.test.ts`. Ficaram no `TODO.md`, o que está correto, porque já estavam assim antes do merge e esta correção não toca esses arquivos.
- Depois da árvore b567d64, o índice só perdeu o `tasks/correcoes/achados/2026-11-02-merge-da-develop.md`, que agora está fora do índice (aparece como `??`). Vem do processo e não muda o código. Confira se ele entra no commit junto com o `indice.md`, que já cita esse arquivo.
