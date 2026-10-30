# Achados das revisões — `tasks/correcoes/2026-10-30-tela-de-entrar.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-10-30 19:15:39 · `tasks/correcoes/2026-10-30-tela-de-entrar.md`

VEREDITO: APROVADO
Tela vista: sim (4 fotos lidas: `/entrar` a 1366 e a 360, tema claro e escuro). A tela é pública, então a escola cheia e a vazia são a mesma. O código da árvore confere com as fotos.
Estados: ok. A mudança é só de posição da pinta decorativa. Carregando, erro e vazio dos formulários não foram tocados e não entram nesta correção.
Acessibilidade: sem mudança. A pinta segue com `alt=""` e `pointer-events-none`. Rótulos, foco e contraste dos campos não foram alterados. Na foto, os rótulos E-mail e Senha estão visíveis e o contraste é bom nos dois temas.
Chromebook fraco: sem impacto. É a mesma imagem SVG da marca, parada, sem animação nem imagem nova.
Celular: ok. A 360 px a pinta grande não aparece (`hidden lg:block`), e a foto mostra a tela sem rolagem de lado e sem corte. O botão Entrar tem altura de uns 44 px. Os dois projetos Playwright cobrem o caso novo, e o `larguraExcedente` é conferido a 1366 e a 1024 px.
Ação oficial protegida: não se aplica. A tela é de entrada e nada oficial mudou.

Verificação visual a 1366, nos dois temas:
- A pinta ficou no meio do painel, nos dois eixos (visível de uns 189 a 508 px na horizontal e de 223 a 530 na vertical, com o centro do painel em 341 × 384).
- Ela está na mesma altura do cartão do formulário e não encosta na marca nem na borda do painel.
- Segue parada e apagada, no claro e no escuro.
- Não há texto novo, termo técnico nem cor fora da paleta.
- A página cabe em 768 px, sem rolagem vertical.

Bloqueantes: nenhum.
- `apps/web/src/componentes/CascaPublica.tsx:30-37`: `inset-0 m-auto size-96`, sem `transform`, centra a pinta. Os atributos `width` e `height` ficaram coerentes com 384 px.
- `docs/interface.md` 11.3 foi atualizado, com a regra de que a pinta não vira onça nem ganha movimento (9.6 e 9.7).
- `e2e/casca-publica.spec.ts:110-133` mede o centro contra o painel e contra o cartão, com 2 px de folga, e o respiro de 40 px dos quatro lados, a 1366 e a 1024 px. Roda para as duas telas de `TELAS`, e as duas mutações do arquivo da tarefa quebram esse teste.

Recomendações:
- A pinta é posicionada só por `inset-0 m-auto` dentro do painel, e na DOM vem depois da marca. Em janela muito baixa (menos de uns 500 px de altura num computador), ela pode passar por cima da marca. É um caso raro e a pinta tem só 15% de opacidade, então não bloqueia. Se quiser cobrir, o e2e pode medir também a altura mínima.
- As fotos "antes" e "depois" citadas na tarefa ficam em `/tmp/.../scratchpad/`, que é efêmero. Se a retro for usar, convém copiá-las para `.processo/`.

## infra-guardian · 1ª rodada · APROVADO · 2026-10-30 19:15:40 · `tasks/correcoes/2026-10-30-tela-de-entrar.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum. A tela `/entrar` é a porta do login, mas a mudança é só de CSS e de tamanho de uma imagem. O `turmma-pinta.svg` é o mesmo arquivo de antes e já fica em cache. Não há chamada nova à API, nem novo trabalho por request.
Rate limit: ok. O fluxo de autenticação e os limites dele não mudaram.
Fila e prioridade: ok. A tarefa não cria job nem usa fila.
Concorrência: protegida. A correção não grava nada nem altera estado.
Índice e paginação: ok. Não há query nova.
Degradação de IA: não se aplica.
Migration: não se aplica.
Métrica e alerta: ok. A tarefa não traz código novo de backend nem alerta novo.
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/e2e/casca-publica.spec.ts`: os casos novos levam cerca de 6 s cada, porque fazem duas larguras e dois `goto` por endereço, contra o prazo de 15 s do portão. Na esteira com a máquina carregada isso pode chegar perto do limite, que é o problema de e2e perto do prazo já visto antes. Vale acompanhar o tempo desses casos na próxima rodada da esteira.

## test-engineer · 1ª rodada · APROVADO · 2026-10-30 19:15:57 · `tasks/correcoes/2026-10-30-tela-de-entrar.md`

VEREDITO: APROVADO

**Cenários exigidos:** a correção só muda onde fica uma imagem decorativa na `CascaPublica`. Não lê nem grava dado, não tem papel e não tem escola, então os casos de permissão, isolamento e concorrência não se aplicam.
- Caminho feliz: a 1366 e a 1024 px, a pinta fica no centro do painel nos dois eixos e na altura do centro do cartão.
- Borda 1: o painel mais estreito, 512 px com a janela a 1024. A pinta precisa caber com respiro e sem rolagem de lado.
- Borda 2: a mesma casca com outro conteúdo (`/mfa`), porque a casca é uma só para entrada, endereço da escola, convite, segundo fator e turma pública.
- Regressão: abaixo de 1024 px (a 1023 e a 360) a tela continua empilhada e sem a pinta grande, e a pinta continua parada e apagada.

**Cobertos:**
- Caminho feliz e as duas bordas: o caso novo `e2e/casca-publica.spec.ts:111` roda para `/entrar` e `/mfa`, nas duas larguras. Ele confere de fato o resultado, e não só que a tela abriu:
  - o centro da pinta contra o centro do painel na horizontal e na vertical, com 2 px de folga;
  - o centro da pinta contra o centro do cartão;
  - 40 px de respiro em cada um dos quatro lados;
  - largura excedente igual a 0, ou seja, sem rolagem de lado.
- Regressão: os casos que já existiam continuam no arquivo sem mudança, o de empilhar (linha 66) e o de "parada e apagada" (linha 87).
- O teste citado em "Teste que reproduz" é o mesmo da linha 111.
- Mutações, conferidas contra o `git diff`. A correção muda uma linha, a `className` do `<img>` em `CascaPublica.tsx:35`, e as duas mutações cobrem essa linha:
  - (1) Voltar para `right-10 bottom-10` reprova na conferência do centro na horizontal.
  - (2) Trocar para `size-[32rem]` mantém a pinta centrada a 1366, mas a 1024 o painel tem 512 px e o respiro vira 0. O caso fica vermelho pelo motivo certo, a falta de respiro, e por isso a conferência dos 40 px tem uma mutação que a sustenta.
  - Tirar só o `m-auto` ou só o `inset-0` joga a pinta para o canto de cima à esquerda, e a conferência do centro também pega.
  - A troca de `width`/`height` de 320 para 384 não é regra: é só a reserva de espaço antes de o CSS carregar.
- Não há `.skip`, teste comentado, mock nem IA envolvida.
- A foto `entrar-light-pc.png` bate com o que o teste mede: a pinta está no centro do painel e na linha do cartão.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Há uma afirmação que nenhum teste prova. O comentário em `apps/web/src/componentes/CascaPublica.tsx:19-20` diz "a marca, no alto, não a alcança". O teste só mede 40 px da borda do painel, não a distância até o `banner`. Pela conta, numa janela de 1024 × 500 o topo da pinta fica em cerca de 58 px e o `header` termina em cerca de 110 px, então os dois se sobreporiam. Vale acrescentar ao caso da linha 111 uma conferência de que a caixa da pinta começa abaixo da caixa do `banner`, ou tirar a afirmação do comentário.
2. As alturas medidas são só de 768, mas um Chromebook de 1366 × 768 mostra perto de 650 px de altura útil por causa da barra do navegador. Um caso a 1366 × 650 se aproxima mais da máquina de referência da regra 50.
3. Os dois blocos de mutação citam o teste por um trecho do nome ("a pinta do painel está no centro dele"). O portão já provou que o trecho casa, mas citar o nome inteiro, com o prefixo `${endereco}:`, deixa mais fácil achar o teste.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/CascaPublica.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/e2e/casca-publica.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/tasks/correcoes/2026-10-30-tela-de-entrar.md`

## frontend-reviewer · 2ª rodada · APROVADO · 2026-10-30 19:33:17 · `tasks/correcoes/2026-10-30-tela-de-entrar.md`

VEREDITO: APROVADO
Tela vista: sim (8 fotos lidas: `/entrar` a 1366×768, 1366×650, 1024×500 e 360×800, nos temas claro e escuro). A tela é pública e não tem sessão, então a escola cheia e a vazia são a mesma. Fotografei só `/entrar`; `/mfa` e as demais telas públicas herdam a mesma casca e foram vistas pelo código.
Estados: ok. A casca não tem estado próprio. Carregando e erro do formulário não mudaram nesta rodada e pertencem às telas que usam a casca.
Acessibilidade: sem mudança. Os dois campos têm rótulo visível, o botão tem texto "ENTRAR" e o contraste está legível nos dois temas. A pinta do painel é decorativa (`alt=""`, `pointer-events-none`), e a marca segue no `banner`.
Chromebook fraco: a 1366×768 a página não rola, que é o que a R10 de `docs/interface.md` exige da tela de trabalho. A página mede 650 px a 1366×650 e não rola. A 1024×500 ela mede 640 px e rola de propósito. O cartão aparece inteiro até o botão, e a pinta fica abaixo da marca. O custo é uma classe CSS (`lg:min-h-[40rem]`), sem imagem nova e sem animação.
Celular: 360×800 sem rolagem de lado e sem corte. A marca fica no topo e o cartão empilha. A classe nova é `lg:`, então o celular não muda. Os dois campos e o botão passam de 44 px de altura, e a ação principal ocupa a largura toda.
Ação oficial protegida: não se aplica. É tela de entrada, sem ação oficial.

Verificação das correções da rodada anterior:
- **Afirmação "a marca, no alto, não a alcança":** ficou provada, e não retirada.
  - O painel ganhou altura mínima de 40 rem (`apps/web/src/componentes/CascaPublica.tsx:21`).
  - O caso e2e mede a pinta abaixo da marca nas quatro janelas (`e2e/casca-publica.spec.ts:87`).
  - As fotos 1366×650 e 1024×500 mostram a pinta separada da marca, sem sobreposição.
- **Nome inteiro do teste nas mutações:** feito no documento da tarefa, nas três mutações.
- **Contradições com `docs/interface.md`:** o item 11.3 foi atualizado e bate com o código. A pele (paleta, onça e logotipo) não mudou.
- **Fotos "antes" e "depois":** a recusa de copiá-las para `.processo/` é razoável. As fotos desta rodada já estão em `.processo/vitrine/`.

Bloqueantes: nenhum.

Recomendações:
- A 1024×500 o painel é mais alto que a janela, então o botão "Entrar" fica a poucos pixels da borda inferior e quem não sabe que a página rola pode achar que o formulário termina ali. É uma janela rara, e o custo vale o ganho, então não bloqueia. Se algum dia virar queixa, a saída é `lg:min-h-[40rem]` valer só acima de uma altura de janela.
- Acompanhar o tempo do caso novo na esteira da `develop`. O documento diz 3,6 a 4,1 s por caso, contra o portão de 15 s.

## test-engineer · 2ª rodada · APROVADO · 2026-10-30 19:33:31 · `tasks/correcoes/2026-10-30-tela-de-entrar.md`

VEREDITO: APROVADO

Cenários exigidos (rodada 2, sobre o diff r1→r2 e as duas recomendações aplicadas):
- Caminho feliz: a pinta fica no centro do painel e na altura do centro do cartão, a 1366 × 768 e a 1024 × 768.
- Borda 1: o Chromebook de referência com a barra do navegador (1366 × 650). A pinta continua no centro e abaixo da marca.
- Borda 2: uma janela de computador mais baixa que o painel (1024 × 500). A pinta não passa por cima da marca, porque o `lg:min-h-[40rem]` segura a altura.
- Borda 3: abaixo de 1024 px o layout empilha e não muda, porque a classe nova só vale de `lg` para cima.
- O caso de permissão e o de isolamento não se aplicam: é uma tela pública, sem sessão e sem dado de escola.
- Concorrência também não se aplica, porque a mudança é só de layout.

Cobertos:
- **O caminho feliz e as bordas 1 e 2** estão no caso `/entrar: a pinta do painel está no centro dele, na altura do centro do cartão, com respiro dos quatro lados e abaixo da marca, mesmo em janela baixa`, e no mesmo caso para `/mfa`, em `e2e/casca-publica.spec.ts:111-138`. Ele mede as quatro janelas. A conferência nova (`dela.y >= marca.y + marca.height`, linha 135) prova a frase "abaixo da marca" que na rodada 1 estava sem teste.
- **A borda 3** continua coberta pelo caso de 1023 e 360 px (`casca-publica.spec.ts:66-84`), que não mudou.
- **A mutação 3 falha pelo motivo certo.** Ela tira o `lg:min-h-[40rem]`. Sem ele, a 1024 × 500 o painel mede 500 px e o topo da pinta fica a 58 px. O centro, a altura do cartão e o respiro de 40 px continuam passando (58 ≥ 40). Só a cláusula nova cai, porque a marca termina a 108 px. Isso bate com o vermelho que o documento registra.
- **Isso vale com o cartão de `/entrar`.** A foto `entrar-r2-light-pc500.png` mostra um cartão de uns 400 px, que não estica a linha da grade. Mesmo que esticasse até perto de 560 px, o topo da pinta ficaria acima de 108 px e o teste continuaria vermelho.
- **As três mutações citam o nome inteiro do caso**, como a rodada 1 pediu.
- **Sem desligar nada:** não há `.skip`, teste comentado nem mock. É um e2e real, e sem IA.
- **As medidas funcionam com a página rolando.** As caixas são lidas logo depois de trocar o tamanho da janela, ainda no topo da página. Como as conferências comparam diferenças entre caixas da mesma rolagem, elas continuam valendo a 1024 × 500, onde a página rola.

Bloqueantes: nenhum.

Recomendações (nenhuma bloqueia):
1. **Nada prende o `lg:` da altura mínima.** Se alguém trocar `lg:min-h-[40rem]` por `min-h-[40rem]`, o painel empilhado passa a ter 640 px no celular e na janela de 1023 px, empurrando o formulário para baixo da dobra, e nenhum teste fica vermelho. O caso de 1023 e 360 px (`casca-publica.spec.ts:66-84`) poderia exigir que o painel empilhado tenha só a altura da marca, por exemplo `lateral.height` menor que 120 px. Junto viria uma quarta mutação no documento.
2. **A rolagem vertical não é medida.** O documento e o comentário dizem que a página rola de propósito a 1024 × 500, mas o caso não mede isso. Uma conferência de `document.documentElement.scrollHeight >= 640` nessa janela tornaria a frase verificável. É opcional, porque a altura do painel já é provada de forma indireta pela pinta abaixo da marca.
3. **Acompanhar o tempo do e2e na esteira.** O caso caiu de cerca de 11 s para 3,6 a 4,1 s ao abrir a página uma vez só. É longe dos 15 s do portão; fica a recomendação do `infra-guardian` da rodada 1, que o documento já registra.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/e2e/casca-publica.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/CascaPublica.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/tasks/correcoes/2026-10-30-tela-de-entrar.md

## infra-guardian · 2ª rodada · APROVADO · 2026-10-30 19:33:36 · `tasks/correcoes/2026-10-30-tela-de-entrar.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum. Mudou só o CSS da tela pública `/entrar` (e da casca que outras telas usam). Não mudou API, fila, IA, sessão nem banco.
Rate limit: ok. O login não foi tocado.
Fila e prioridade: ok, não se aplica.
Concorrência: protegida, porque não há escrita nesta tarefa.
Índice e paginação: ok, não há query nova.
Degradação de IA: não se aplica.
Migration: não se aplica.
Métrica e alerta: ok. Nada novo no caminho quente.
Bloqueantes: nenhum.
Recomendações:
- A minha recomendação da rodada 1, de acompanhar quanto tempo os casos novos do e2e levam, está cumprida nesta árvore. O caso abre a página uma vez e só troca o tamanho da janela. Cada caso agora leva de 3,6 a 4,1 s, contra uns 6 s antes, bem abaixo dos 15 s do portão. Esse tempo está registrado em "Teste que reproduz" em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/tasks/correcoes/2026-10-30-tela-de-entrar.md`. A linha "sem aplicar" que deixa isso para a esteira da `develop` pode continuar como está.

Arquivos auditados nesta rodada (diff r1→r2):
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/CascaPublica.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/e2e/casca-publica.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/docs/interface.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/tasks/correcoes/2026-10-30-tela-de-entrar.md`
