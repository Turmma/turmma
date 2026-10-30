# Achados das revisões — `tasks/correcoes/2026-10-30-onca-na-entrada.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-10-30 20:14:25 · `tasks/correcoes/2026-10-30-onca-na-entrada.md`

VEREDITO: APROVADO
Tela vista: sim (4 fotos lidas: `/entrar` em tema claro e escuro, a 1366 e a 360. A tela é pública, então cheia e vazia são a mesma.)
Estados: ok. A tela não busca dado. O carregamento da onça é um `Suspense` com `fallback` vazio dentro de caixas que já têm o tamanho (`size-40`, `size-22`), então a página não pula. Não há estado de vazio ou erro novo. Não mudou nenhum texto nem fluxo de erro do formulário.
Acessibilidade:
- A onça é decorativa e fica `aria-hidden`, sem `figcaption`, sem selo e sem nome acessível (`apps/web/src/componentes/ui/onca/OncaDaMarca.tsx:25`).
- O `banner`, o `main` e o `h1` seguem como eram.
- Os campos têm rótulo e o foco não foi tocado.
- Contraste ok nos dois temas.
- Com `prefers-reduced-motion` a onça aparece inteira e parada. O e2e cobre isso.

Chromebook fraco:
- A onça é um SVG vetorial, sem imagem pesada, e entra por `import()` tardio (`CascaPublica.tsx:10`).
- `nome-dos-chunks.ts` põe a peça em `pecas-*`, fora do teto do primeiro carregamento.
- A pinta de 384 px saiu.
- O movimento tem duas animações de uma volta só, sem laço.

Celular:
- A 360 px não há rolagem de lado nem corte (foto e e2e).
- A onça de 88 px fica parada, centrada, entre a faixa e o formulário.
- Os campos têm cerca de 46 px e o botão principal cerca de 48 px, acima de 44.
- Nada depende de hover.

Ação oficial protegida: sim, não se aplica. A tela só faz login e não tem ação oficial.

Bloqueantes: nenhum.
- Nenhuma foto mostra texto cortado, sobreposto ou em inglês, nem id ou termo técnico.
- Nenhuma tela rola a 1366 × 768, e nenhuma regra do PRD exige que a tela caiba.
- A onça está sem selo "IA", e isso está certo: ela não é saída de agente (regra 70, item 4a). É a marca, `aria-hidden`.
- A troca do painel para `papel` com `border-borda` usa só tokens existentes e está registrada em `docs/interface.md` 11.3. A foto confirma que os pés aparecem, nos dois temas.
- Rodei os testes de `CascaPublica`, `ui/onca`, `nome-dos-chunks` e `avatar-so-nas-duas-pecas`: 8 arquivos, 114 testes, todos passaram. Não rodei o e2e. Li o diff dele e cobre posição a 1366 e 1024, a onça de 88 px a 360, uma volta só e `reducedMotion`.

Recomendações:
- Nas fotos do tema claro, o pé direito da onça é creme sobre `papel` e se lê pouco. É legível, então não bloqueia. Se o Joaquim quiser mais presença, pode escurecer só a sombra do chão ou o contorno do pé, num ajuste à parte e sem segundo traço.
- Em `CascaPublica.tsx`, o comentário de doc tem um item de lista que termina sem ponto (`A onça fica **fora** dele`). É só acabamento.

Fotos lidas, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/.processo/vitrine/`:
- `entrar-onca-light-pc.png`
- `entrar-onca-light-cel.png`
- `entrar-onca-dark-pc.png`
- `entrar-onca-dark-cel.png`

## infra-guardian · 1ª rodada · APROVADO · 2026-10-30 20:14:35 · `tasks/correcoes/2026-10-30-onca-na-entrada.md`

VEREDITO: APROVADO
Caminho quente tocado: login (só a tela pública `/entrar`, no frontend; nada mudou em API, worker, realtime, fila nem banco)
Rate limit: ok (a proteção de login não mudou; a tarefa não acrescenta nenhum endpoint)
Fila e prioridade: ok (não se aplica, a tarefa não cria job)
Concorrência: protegida (não há escrita; o "já acenou" fica na memória da página, no navegador, não no servidor, e por isso não muda nada com duas instâncias)
Índice e paginação: ok (não se aplica, a tarefa não tem query)
Degradação de IA: não se aplica (a onça da marca não chama modelo)
Migration: não se aplica
Métrica e alerta: ok (não há código novo no servidor; nenhum alerta novo)
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/CascaPublica.tsx`: o `import()` da `OncaDaMarca` faz `/entrar` baixar mais um arquivo (`pecas-OncaDaMarca-*.js`). Às 7h30, com a escola inteira atrás de um IP, isso aguenta, desde que o servidor da web estática mande `Cache-Control` longo e `immutable` para `assets/*-[hash].js`. O `infra/Caddyfile` não define isso; o único `Cache-Control` dele é o `no-store` da resposta de erro. Vale conferir onde a web é servida, e registrar o cabeçalho no TODO se ainda faltar.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/CascaPublica.tsx`: as duas onças, a de 160 px e a de 88 px, são montadas juntas e uma delas só fica escondida pelo CSS (`hidden`/`lg:hidden`). O arquivo é um só, então a rede não sente. Em Chromebook fraco é um desenho a mais montado à toa. A recomendação é só de custo de renderização, não de carga no servidor.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-10-30 20:14:43 · `tasks/correcoes/2026-10-30-onca-na-entrada.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta correção. O diff só mexe em web, teste, e2e e `docs/interface.md`, e não toca `Nota`, a API nem o banco. Todos com autor humano? Sim, nada mudou.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. A tela de entrada não tem saída de IA, e nenhum agente produz nada ali. A onça da marca não é saída de agente, então não cai no item 3 nem pega para si a exceção do tutor (D47).

Supervisão do tutor: ok. O tutor não é tocado.

Autonomia declarada e visível: sim, sem mudança. A governança e os agentes ficam fora desta correção.

Bloqueantes: nenhum.

O que conferi contra a regra 70, item 4a (D58), item 4b (D59), e a D80 revista em 30/10/2026 (`docs/decisoes.md:1526-1545`, `docs/interface.md:1227-1233`):

- **A marca não se passa por agente.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/ui/onca/OncaDaMarca.tsx:26` desenha uma `figure` `aria-hidden`, sem `figcaption`, sem nome de função, sem selo "IA" e sem texto ao lado. A pose `acenando` é fixa e não é prop. A `Onca` assinada continua exigindo `agente`. Quem prova é `OncaDaMarca.test.tsx` (linhas 26-31, e 64-65 para o contraste com a `Onca`).
- **Lugar fechado.** Pelo teste `avatar-so-nas-duas-pecas.test.ts`, só a `CascaPublica` importa a `OncaDaMarca`, e só por `import()`. O mesmo teste barra `areas/`, galeria e operação. O desenho sem a figura (`DesenhoDaOnca`) só entra pela `Onca` e pela `OncaDaMarca`. A brecha que eu temia, a onça sem nome virando avatar de agente em outra tela, fica fechada por teste.
- **Nada induz uso (D59).** Ela entra em 240 ms e acena uma vez, sem laço. No celular fica parada, e com "reduzir movimento" nada se mexe (`Onca.css:41`). `OncaDaMarca.test.tsx:91-99` prova que não há `infinite`, temporizador nem `animate`. O CSS só tem animações de uma volta (linhas 17, 24 e 31). Sair não ficou mais difícil: a tela não ganhou texto nem passo novo (RF20).
- **Fotos** (`entrar-onca-light-pc.png`, `entrar-onca-dark-pc.png`, `entrar-onca-light-cel.png`, `entrar-onca-dark-cel.png`): a onça aparece sem fala, balão, nome ou selo, e nenhuma frase é atribuída a ela. O "Turmma" da marca fica no topo e o formulário segue o mesmo. Não há saída de IA, nota, conceito ou sugestão de nota. As quatro batem com `CascaPublica.tsx:41-53`.
- **Painel em `papel`, e não `laranja-claro`.** A troca segue a condição que a própria D80 revista escreveu, e o registro está em `docs/interface.md:1805-1812`. É assunto do `frontend-reviewer`; para a regra 70 não muda nada.
- **Itens 7, 8 e 9** (supervisão não é vigilância, medir o professor, recusar a ferramenta): a tela é pública e sem sessão, e não coleta, mede nem infere nada.

Recomendações (não bloqueiam):

1. A `OncaDaMarca` também carrega `data-onca=""` (`OncaDaMarca.tsx:26`), o mesmo atributo da onça assinada. Hoje nada conta `[data-onca]` como produção de agente. Se um seletor ou teste futuro fizer essa conta, a onça da marca entra junto. Vale deixar só `data-onca-da-marca`, ou escrever em `interface.md` 9.7 que `data-onca` quer dizer "desenho" e não "agente".
2. No caso da `CascaPublica`, o teste confere o especificador exato `'./ui/onca/OncaDaMarca'`. Se a casca um dia mudar de pasta, o teste reprova, o que é certo. Basta lembrar que a lista `QUEM_IMPORTA_A_ONCA_DA_MARCA` só se mexe com parecer.
3. Uma linha na AIA ou no dossiê dizendo que a mascote da marca não é agente nem saída de IA. Ajuda a responder a pergunta da escola na compra ("essa onça é a IA?") apontando para um documento.

## test-engineer · 1ª rodada · REPROVADO · 2026-10-30 20:15:48 · `tasks/correcoes/2026-10-30-onca-na-entrada.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- Caminho feliz: a 1366 e a 1024 a onça de 160 px fica no centro do painel e acena uma vez. A 1023 e a 360 a onça de 88 px fica parada acima do formulário.
- Borda: janela baixa de computador (1024 × 500), em que a onça precisa ficar abaixo da marca sem altura mínima.
- Borda: as duas onças montadas ao mesmo tempo (a de baixo só escondida com `lg:hidden`), e o aceno precisa acontecer uma vez só.
- Borda: "reduzir movimento".
- Borda: tema escuro e painel em `papel`.
- Borda: o pedaço da onça que não chega (rede da escola instável, ou deploy que troca o hash do arquivo com a tela aberta), e o formulário de entrada precisa continuar de pé.
- Conformidade (regra 70, item 4a): a onça da marca não tem nome de função, selo nem nome acessível. A `Onca` continua exigindo `agente`.
- Peso: a onça fica fora do primeiro carregamento, num pedaço `pecas-*`, e só a `CascaPublica` a importa, só por `import()`.
- Permissão, isolamento e concorrência: não se aplicam. É uma página pública, estática, sem sessão, sem dado de escola e sem escrita.

**Cobertos:**
- Os quatro itens de "Teste que reproduz" têm teste citável:
  - `OncaDaMarca.test.tsx`, nos casos de assinatura, pose, mesmo traço e `infinite`.
  - `avatar-so-nas-duas-pecas.test.ts`, no caso "a onça da marca só é importada pela `CascaPublica`…". O laço da entrada inclui `componentes/CascaPublica.tsx` e separa o import estático do `import()`.
  - `CascaPublica.test.tsx`, nos casos "a pinta grande saiu…", "o painel é `papel`…" e "a onça da marca chega depois…".
  - `e2e/casca-publica.spec.ts`: 1366 e 1024, 1023 e 360, a posição a 1366×650 e a 1024×500, `reducedMotion: 'reduce'`, borda e fundo nos dois temas, axe.
- O build de verdade (`nome-dos-chunks.test.ts`) prova o `pecas-*`, que a entrada não importa a onça e que o teto continua respeitado.
- Os e2e de animação não dependem de tempo. As animações usam `both` (`Onca.css:17,24`), então continuam em `getAnimations()` depois de terminar. O `expect.poll` e o "parada = 0 animações" não dependem de a máquina estar folgada.
- Os 12 blocos de mutação do `DesenhoDaOnca` apontam para casos que existem e que chegam à cláusula. Por exemplo, a mutação de `acena && …` deixa a onça parada com `.onca-acena`, e o caso exige 0.
- `npx vitest run` nos 7 arquivos de onça, casca e avatar: 84 de 84 verdes.
- Nenhum `.skip`, nenhum teste comentado, nenhum mock que esconda a regra. Não há IA nem chamada a provedor.

**Bloqueantes:**

1. **Se o pedaço da onça não carregar, a tela de entrada fica em branco, e nenhum teste cobre isso.**
   - **Onde:** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/CascaPublica.tsx:239` (e o `Suspense` das linhas 296 a 305).
   - **O que está errado:** o `lazy(() => import('./ui/onca/OncaDaMarca')…)` não trata falha. A rota `/entrar` não tem fronteira de erro em volta (`rotas.tsx:189`, ao contrário das áreas, linhas 134, 192 e 212), e `main.tsx` não tem fronteira na raiz. Se a promessa rejeitar, o erro sobe sem ninguém pegar, e o React desmonta a árvore inteira. Uma figura decorativa derruba o formulário de login, e também o do convite, o do segundo fator e o da página da turma, que usam a mesma casca. É exatamente o cenário de rede de escola instável às 7h30 (regras 50 e 80).
   - **Correção exigida:**
     - Fazer a falha não derrubar a página: um `.catch(() => ({ default: () => null }))` na fábrica do `lazy`, ou uma fronteira local que não desenha nada.
     - Um teste que prove: e2e com `page.route('**/assets/pecas-*OncaDaMarca*.js', (r) => r.abort())`, verificando que o `h1` "Entrar" e os campos continuam visíveis e que as caixas de 160 e 88 px seguem no lugar. Ou um caso no `CascaPublica.test.tsx` com o módulo rejeitando.
     - Um bloco de mutação que tire o tratamento e deixe esse teste vermelho.

2. **Cláusula nova sem bloco de mutação.**
   - **Onde:** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/nome-dos-chunks.ts:119`, a linha `if (ehPecaForaDaEntrada(fachada) && soTemPecas(modulos ?? [fachada])) return 'assets/pecas-[name]-[hash].js'`.
   - **O que está errado:** a condição é nova e decide o nome do pedaço da onça, que o teto do primeiro carregamento mede. A seção "Mutações" só tem blocos do `DesenhoDaOnca`. O `--faltando` disse "nenhuma linha sem bloco" porque não varre os arquivos da raiz de `apps/web/`, que ficam fora de `src/` e de `tools/`. O teste que pegaria a mutação já existe: o caso "o pedaço com fachada que é peça e só tem peças é pecas-<nome>…".
   - **Correção exigida:** dois blocos citando esse caso:
     - um que apaga a linha 119 (a linha 12 do teste esperaria `pecas-*` e receberia `parte-*`);
     - um que troca `soTemPecas(modulos ?? [fachada])` por `true` (a linha 15 do teste esperaria `parte-*`).

**Recomendações:**
- Levar à retro o ponto cego do `tools/processo/mutacoes.ts --faltando`: os `.ts` da raiz de `apps/web/` (`nome-dos-chunks.ts`, o config do Vite) ficam fora da varredura, e foi assim que a cláusula do bloqueante 2 passou sem bloco.
- O e2e de "reduzir movimento" mede só a 1366. Um caso a 360 deixaria explícito que a de 88 px também aparece inteira. O teste unitário já prova que ela não leva `onca-animada`, então isso não bloqueia.
- O texto de "Teste que reproduz" diz, sobre o `CascaPublica.test.tsx`, "o import é tardio", mas quem prova isso é o `avatar-so-nas-duas-pecas.test.ts`, como o próprio teste comenta. Vale corrigir a frase no documento para a validação não procurar a prova no arquivo errado.

## revisor-geral · 1ª rodada · REPROVADO · 2026-10-30 20:16:13 · `tasks/correcoes/2026-10-30-onca-na-entrada.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. O painel passou a `papel` porque a foto mostrou os pés da onça sumindo no `laranja-claro`. A D80 revista já previa essa saída, e a troca está registrada em `docs/interface.md` 11.3.
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

Bloqueantes:

- **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/CascaPublica.tsx:42-46`**: no celular, uma onça que ninguém vê gasta o aceno da página.
  - **O que está errado:** a onça de 160 px fica numa caixa `hidden … lg:block`. O `hidden` só esconde pelo CSS: o React monta a `OncaDaMarca tamanho={160}` com `animada` em toda largura, também a 360 px. Na montagem ela chama `useAcenarNaPrimeiraVez(true)` (`DesenhoDaOnca.tsx:220`), e o efeito marca `jaAcenou = true` (`movimento-da-onca.ts:35-41`).
  - **A consequência:** a entrada é navegação dentro da página (`Entrar.tsx` usa o `navegar` do wouter, sem recarregar). Quem entra pelo celular chega à introdução do papel sem o aceno, porque uma onça invisível já o gastou. É a `Onca pose="acenando"` de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/introducao/IntroducaoDoPapel.tsx:67`.
  - **No computador** acontece o mesmo com a onça visível: a da entrada acena e a da introdução não acena mais. O movimento "entrar e acenar, uma vez" da introdução (tabela da 9.7, linha "Acenando · apontando · pensando") deixa de acontecer no fluxo real de primeiro acesso.
  - **Onde falta registro:** nem o documento da tarefa, nem a 9.7, nem os testes tratam dessa interação.
  - **Correção exigida:**
    - (a) A onça escondida não pode gastar o aceno. Ou ela não monta abaixo de 1024 px, ou a animação liga só quando está visível.
    - (b) Decidir e escrever na 9.7 (e no documento da tarefa) se o aceno da onça da marca gasta o da introdução. Se não deve gastar, a marca precisa de uma marca de "já acenou" separada.
    - (c) Um teste que prove o que foi decidido: montar a `CascaPublica` (a 360 px no e2e, ou com a caixa escondida) e depois a `IntroducaoDoPapel` na mesma página, e conferir o aceno.

Recomendações:

- `CascaPublica.tsx:42` e `:48` repetem o `aria-hidden` no `div` e na `figure` da `OncaDaMarca`. Um só basta, e o da peça já está garantido por teste.
- O texto da D80 revista em `docs/decisoes.md` (linhas 1534 e seguintes) ainda descreve o painel em `laranja-claro`, com a volta a `papel` como condição. Vale uma linha dizendo que a condição aconteceu (30/10, foto do tema claro), para quem ler só a decisão.
- A condição nova `ehPecaForaDaEntrada(fachada) && soTemPecas(...)` em `apps/web/nome-dos-chunks.ts` não tem bloco de mutação. Fica fora de `apps/*/src`, então não é exigido, mas o teste existe e a mutação sairia de graça.
- O comentário de cabeçalho da `CascaPublica` (linhas 11-34) repete quase tudo da 11.3. Encurtar para o que não está no documento deixa o componente mais fácil de ler.

Fotos (`entrar-onca-*.png`): a tela entrega o que a 11.3 descreve. A onça aparece sem legenda, sem selo e sem texto novo, e a 360 px não há rolagem de lado. Nada nas fotos foge do que a tarefa pediu.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-10-30 20:35:34 · `tasks/correcoes/2026-10-30-onca-na-entrada.md`

VEREDITO: APROVADO
Tela vista: sim (4 fotos lidas: 1366 e 360 px, tema claro e escuro). A `/entrar` é pública, então "cheia" e "vazia" são a mesma tela.
Estados: ok. Carregando: o `Suspense` tem `fallback={null}`, e as caixas de 160 e 88 px já guardam o tamanho, então a página não pula. Erro: o `.catch` do `lazy` devolve `SemOnca`, que não desenha nada, e o formulário continua (`CascaPublica.tsx:11-25`, `CascaPublica.sem-onca.test.tsx`). Os estados do formulário não mudaram nesta rodada. Vazio e com dado não se aplicam à tela.
Acessibilidade: ok. Nesta rodada, o `aria-hidden` saiu das duas caixas e ficou só na `figure` da `OncaDaMarca`. Caixa vazia sem figura não é lida por leitor de tela, e o teste de falha cobre esse caso. Os rótulos "E-mail" e "Senha" aparecem sobre os campos. Há um `main`, um `banner` e um `h1`. O contraste é legível nos dois temas.
Chromebook fraco: ok. A onça continua em `import()` tardio, fora do primeiro carregamento. O desenho é o mesmo de antes, sem laço. Se o pedaço não carregar, a entrada não cai.
Celular: ok.
- A 360 px não há rolagem horizontal, e a página tem 800 px de altura.
- A onça de 88 px fica acima do formulário e os campos ocupam a largura toda.
- O botão ENTRAR tem cerca de 48 px de altura, acima dos 44 px exigidos para a ação principal.
- Nada depende de hover.
- Nenhuma tela rola a 1366 × 768, e nenhum RF de "cabe na tela" é violado.

Ação oficial protegida: sim. Esta tela só faz login e não há ação oficial nela. A onça da marca continua sem nome, selo ou texto acessível, e `data-onca` saiu dela, então nenhuma conta de "onça de agente" a conta (regra 70, item 4a). Nada de IA aparece sem a marca de IA.

Bloqueantes: nenhum. Conferi o diff da rodada 1 para a 2:
- **Falha do carregamento:** o `.catch` com `SemOnca` está feito e tem teste e mutação.
- **Aceno da marca separado do aceno do agente:** `DonoDoAceno` está em `movimento-da-onca.ts:20-29` e é passado por `DesenhoDaOnca` (`:222`), `Onca` (`aceno="agente"`) e `OncaDaMarca` (`aceno="marca"`). Esse é o único chamador de `useAcenarNaPrimeiraVez`, então a onça escondida a 360 px não gasta mais o aceno da introdução. Há testes nos dois sentidos e mutações registradas.
- **Mutações do `nome-dos-chunks.ts`:** estão registradas em `tasks/correcoes/2026-10-30-onca-na-entrada.md`.
- **Acabamento:** o `aria-hidden` e o ponto final foram ajustados, e `docs/interface.md` (9.7) foi atualizado.

Nas fotos não vi texto cortado, texto em inglês ou termo técnico, e a paleta e a fonte seguem `docs/interface.md`. O painel esquerdo ficou em `bg-papel`, com a onça no centro e os pés visíveis nos dois temas.

Recomendações:
- `tasks/correcoes/2026-10-30-onca-na-entrada.md` registra o `Cache-Control` longo para `assets/*-[hash].js`, a linha na AIA e no dossiê dizendo que a mascote não é agente, e a D80 revista ainda descrevendo o painel em `laranja-claro`. Os três ficam para o `TODO.md` e a retro.
- A tabela "Recomendações sem aplicar" da tarefa lista dois revisores como REPROVADO na 1ª rodada, `test-engineer` e `revisor-geral`. As correções deles aparecem neste diff. Quem fecha a rodada 2 deles é a Mesa, não eu.
- O e2e de "reduzir movimento" a 360 px continua sem cobertura. O unitário já prova que a onça de 88 px não leva `onca-animada`, então isso não bloqueia.

## infra-guardian · 2ª rodada · APROVADO · 2026-10-30 20:35:42 · `tasks/correcoes/2026-10-30-onca-na-entrada.md`

VEREDITO: APROVADO
Caminho quente tocado: login (só a casca pública do `/entrar` no front; nada de API, fila, banco ou IA)
Rate limit: ok (não mudou nada no limite de requisições: não há endpoint, guard nem middleware novo)
Fila e prioridade: ok (nenhum job criado ou alterado)
Concorrência: protegida (só tem estado no navegador. O `jaAcenou` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/ui/onca/movimento-da-onca.ts:319` é por aba, e não há nada compartilhado entre instâncias do servidor)
Índice e paginação: ok (nenhuma query)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (nenhum código novo de servidor no caminho quente)
Bloqueantes: nenhum

Esta rodada conferiu só o diff desde a 1ª rodada aprovada. Não havia correção exigida a conferir. O ponto que pesa às 10h está atendido. Se a rede da escola falhar e o pedaço da onça não carregar, a entrada não cai. O `.catch(() => SEM_ONCA)` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/CascaPublica.tsx:114` evita isso. O teste `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/CascaPublica.sem-onca.test.tsx` prova que o formulário continua e as caixas ficam vazias, e há uma mutação registrada para ele.

Recomendações:
- O `lazy` do React guarda o resultado da primeira tentativa. Com o `.catch` em `CascaPublica.tsx:111-115`, uma falha passageira do `import()` deixa a onça sumida até recarregar a página. É aceitável porque a onça é enfeite. Se quiserem que ela volte quando a rede voltar, dá para tentar o `import()` uma segunda vez antes de cair no `SemOnca`. Não bloqueia.
- A falha de carregamento da onça é engolida em silêncio. Se a web já manda erros do front para algum lugar, vale registrar ali um evento sem dado pessoal, por exemplo `casca.onca.falhou`. Assim a quantidade de pedaços que não carregam nas escolas aparece, e isso também indica a qualidade da rede delas.
- Continua valendo a recomendação da 1ª rodada sobre `Cache-Control` `immutable` para `assets/*-[hash].js`. Ela já está registrada no `TODO.md`.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-10-30 20:35:50 · `tasks/correcoes/2026-10-30-onca-na-entrada.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta rodada. O diff mexe só na casca pública, na onça da marca, na memória do aceno, em `nome-dos-chunks.ts` e na documentação. Todos com autor humano? Não se aplica: nenhum caminho foi criado ou alterado.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. A onça da marca não é saída de IA: nenhum agente produz nada em /entrar. A exceção do tutor (D47) não aparece em lugar nenhum.

Supervisão do tutor: ok. O diff não toca o tutor.

Autonomia declarada e visível: sim, sem alteração. Nenhum agente novo, nenhum nível mexido.

**O que conferi no diff**
- **Item 4a, a marca não se passa por agente.** `OncaDaMarca.tsx` deixou de levar `data-onca` e ficou só com `data-onca-da-marca`, com a `figure` ainda em `aria-hidden="true"`. Busquei os seletores `[data-onca]` no repositório: todos esperam uma onça assinada, nas introduções, na comemoração e nos artefatos criados. Nenhum deles conta a onça da marca. O e2e da casca já seleciona pelo atributo novo (`e2e/casca-publica.spec.ts:24` e `:27`) e continua conferindo que ela é `aria-hidden`, sem `figcaption`, sem selo e sem texto (`:115-117`). O `aria-hidden` saiu das duas caixas em `CascaPublica.tsx:62` e `:68`, mas a figura dentro delas segue escondida do leitor de tela, e no caso sem onça a caixa fica vazia. Nada fica exposto.
- **Item 4b e D59, nada induz uso.** Com a memória separada em `movimento-da-onca.ts:317-345`, há no máximo um aceno da marca e um do agente por página. Continua sem laço, e os dois param com "reduzir movimento" (`reduzMovimento()` na leitura inicial). O teste novo em `movimento-da-onca.test.tsx` cobre as duas ordens e mostra que limpar a memória zera as duas.
- **A falha de carregamento** (`CascaPublica.tsx:111-125`, `SemOnca`) não toca nada da regra 70. Ela evita que a entrada caia quando o pedaço da onça não carrega, e `CascaPublica.sem-onca.test.tsx` prova isso.

**Fotos** (`entrar-onca-r2-light-pc.png`, `entrar-onca-r2-light-cel.png`, `entrar-onca-r2-dark-pc.png`, `entrar-onca-r2-dark-cel.png`)
- A onça aparece sem nome de função, sem selo "IA" e sem texto ao lado, nos dois temas e nas duas larguras. Como ela não é agente, a falta de rótulo de IA está certa.
- Não há nota, conceito ou sugestão de nota na tela.
- Não há nada que induza uso: nenhuma contagem, sequência de dias ou recompensa. A saída da tela também não fica mais difícil.

Bloqueantes: nenhum.

Recomendações:
- A da 1ª rodada continua valendo, e está no `TODO.md` segundo `tasks/correcoes/2026-10-30-onca-na-entrada.md:457`: uma linha na AIA ou no dossiê de conformidade dizendo que a mascote da marca não é agente nem saída de IA. A troca para `data-onca-da-marca` deixa essa linha mais fácil de escrever com precisão.
- Hoje nenhum teste ou guarda impede que um componente fora da casca volte a pôr `data-onca` na onça da marca. Só `OncaDaMarca.test.tsx:45` prova a ausência, e só nessa peça. Não bloqueia: a lista fechada de `avatar-so-nas-duas-pecas.test.ts` já limita quem pode importar a peça.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/ui/onca/OncaDaMarca.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/ui/onca/movimento-da-onca.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/CascaPublica.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/CascaPublica.sem-onca.test.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/e2e/casca-publica.spec.ts

## revisor-geral · 2ª rodada · APROVADO · 2026-10-30 20:35:57 · `tasks/correcoes/2026-10-30-onca-na-entrada.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. A 9.7 em `docs/interface.md:1235-1238` e o documento da tarefa (linhas 61-68) registram a decisão nova: o aceno da marca tem memória própria.

Portão local: carimbo válido (`portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)`)

Bloqueantes: nenhum.

As três partes da correção exigida na 1ª rodada estão resolvidas:
- **(a) A onça escondida não gasta mais o aceno da introdução.** Agora cada onça tem a sua memória de "já acenou": `DonoDoAceno` e `jaAcenou: Record<DonoDoAceno, boolean>`, em `apps/web/src/componentes/ui/onca/movimento-da-onca.ts:21-23`. A `OncaDaMarca` passa `aceno="marca"` e a `Onca` passa `aceno="agente"`. A onça de 160 px, escondida pelo CSS no celular, só gasta o aceno da marca. A de 88 px, a única que aparece no celular, já é parada (`animada={false}`), então ninguém perde aceno nenhum.
- **(b) A decisão está escrita** na 9.7 e no documento da tarefa.
- **(c) Há teste que prova a decisão.** Em `apps/web/src/componentes/CascaPublica.test.tsx:104-112`, a casca é montada com as duas onças da marca (no jsdom o `hidden` não esconde nada), a de 160 px acena, e depois a `Onca acenando` montada na mesma página ainda acena. Se a `OncaDaMarca` passasse a usar `aceno="agente"`, o teste quebraria, e essa mutação está declarada. `movimento-da-onca.test.tsx` e `OncaDaMarca.test.tsx` cobrem as duas ordens e o `esquecerQueAcenou`.

O resto do diff confere:
- **`data-onca` saiu da onça da marca.** Procurei em `e2e/` e `apps/web/src`: nenhum seletor `[data-onca]` contava a onça da marca, e `e2e/casca-publica.spec.ts` não usa esse atributo.
- **`.catch(() => SEM_ONCA)`.** Se o pedaço da onça não carregar, a casca fica sem ela e o formulário continua. Isso está registrado na tarefa e na 9.7, e coberto por `CascaPublica.sem-onca.test.tsx`.
- **Fotos.** Em `entrar-onca-r2-light-pc.png` e `entrar-onca-r2-dark-pc.png` a onça aparece no centro do painel, sem legenda, sem selo e sem texto novo. Em `entrar-onca-r2-light-cel.png` aparece a de 88 px acima do formulário. Não há nada além do que a tarefa pede.

Recomendações:
- `apps/web/src/componentes/ui/onca/movimento-da-onca.ts:9-20`: há dois blocos JSDoc seguidos. O primeiro (o "já acenou" na memória da página) ficou solto, preso ao tipo e não à constante `jaAcenou`. Juntar os dois num bloco só, sobre a `const`.
- `docs/interface.md:1172`: o texto ainda diz "na primeira vez desde que a página abriu", sem dizer que agora é uma vez para cada dono. A linha 1235 explica, mas o parágrafo do movimento poderia remeter a ela.
- `apps/web/src/componentes/ui/onca/OncaDaMarca.test.tsx` (último caso): a mensagem `'a marca gasta já foi para o agente'` não diz o que ela confere, que é "o aceno da marca já foi gasto". Vale reescrever.
- A onça de 160 px continua montada no celular e gasta o aceno da marca sem ninguém ver. Se a janela passar de 1024 px depois, a onça que aparece não acena. Não faz diferença hoje; fica registrado caso a marca passe a acenar também no celular.

## test-engineer · 2ª rodada · APROVADO · 2026-10-30 20:36:04 · `tasks/correcoes/2026-10-30-onca-na-entrada.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- (1) O pedaço da onça não carrega. A entrada, o convite, o segundo fator e a página da turma continuam com o formulário, e as caixas de 160 e 88 px ficam no lugar.
- (2) O nome do pedaço com fachada que é peça e só tem peças: ele é `pecas-*`, e volta a `parte-*` quando entra um módulo que não é peça ou quando a fachada não é peça.
- (3) Novo na rodada: o aceno da marca e o do agente são memórias separadas, nas duas ordens. A onça de 160 px, escondida pelo CSS a 360 px, não gasta o aceno da introdução.
- (4) `data-onca` saiu da onça da marca.

**Cobertos:**
- (1) `apps/web/src/componentes/CascaPublica.sem-onca.test.tsx`, caso "o formulário continua na tela, e as duas caixas ficam no lugar, vazias". O `vi.mock` lança erro no carregamento, e o `import()` rejeita como numa rede que cai. O teste verifica o `h1` "Entrar", o campo, o botão e a marca no `banner`. Verifica também que as caixas `size-40` e `size-22` estão lá, vazias, sem nenhuma figura nem `svg` dentro. O bloco de mutação que apaga o `.catch(() => SEM_ONCA)` aponta para esse caso. Sem o `.catch`, a rejeição sobe sem fronteira de erro e a árvore é desmontada, então o teste fica vermelho pelo motivo certo. A correção exigida aceitava e2e ou unitário, e o unitário atende.
- (2) Os dois blocos de `apps/web/nome-dos-chunks.ts` citam o caso "o pedaço com fachada que é peça e só tem peças é pecas-…":
  - o bloco que apaga a linha deixa vermelha a 1ª asserção, que espera `pecas-*` e recebe `parte-*`;
  - o bloco que troca a condição por `true` deixa vermelha a 3ª asserção, que espera `parte-*` e recebe `pecas-*`.
- (3) Quatro testes cobrem o aceno:
  - `movimento-da-onca.test.tsx`, caso "o aceno da marca e o do agente são memórias separadas", nas duas ordens e com o `esquecerQueAcenou` zerando as duas;
  - `OncaDaMarca.test.tsx`, caso "o aceno da marca não gasta o da onça do agente, nem o contrário";
  - `CascaPublica.test.tsx`, caso "a onça da marca, mesmo a escondida pelo CSS a 360 px, não gasta o aceno da introdução".

  Há três blocos de mutação, cada um com um mutante distinto: ler sempre `jaAcenou.agente`, gravar sempre `jaAcenou.agente`, e passar `aceno="agente"` na `OncaDaMarca`. Conferi que cada mutante deixa vermelha a asserção que o bloco cita.
- (4) `OncaDaMarca.test.tsx:43-45` verifica que a onça da marca não tem `[data-onca]`. Procurei `[data-onca]` no repositório: só telas de dentro da sessão o usam. Nenhum seletor da casca pública dependia dele, e o `e2e/casca-publica.spec.ts` usa `[data-onca-da-marca]`.

Rodei os seis arquivos afetados com `npx vitest run`: 71 testes, todos passando. Não há `.skip`, teste comentado nem chamada de provedor de IA. Não há operação concorrente nesta tarefa. A tabela de testes do documento da tarefa lista os dois arquivos novos ou alterados, e cada um tem o seu caso.

**Bloqueantes:** nenhum.

**Recomendações:**
- Um e2e com `page.route('**/assets/pecas-*OncaDaMarca*.js', r => r.abort())` em `/entrar` provaria a falha no navegador de verdade, com o nome real do pedaço. Seria cobertura extra: o unitário já prova a regra.
- `CascaPublica.tsx`: com o bloco que apaga o `.catch`, o `SEM_ONCA` fica sem uso. O mutante continua válido para o Vitest, mas um `tsc` com `noUnusedLocals` no portão o acusaria. Isso não muda o resultado da mutação.
- `OncaDaMarca.test.tsx:238`: a mensagem "a marca gasta já foi para o agente" se entende mal. Ela descreve que o aceno da marca já foi gasto naquela página, mais do que algo indo para o agente.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/CascaPublica.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/CascaPublica.sem-onca.test.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/CascaPublica.test.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/nome-dos-chunks.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/nome-dos-chunks.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/ui/onca/movimento-da-onca.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/ui/onca/OncaDaMarca.test.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/tasks/correcoes/2026-10-30-onca-na-entrada.md
