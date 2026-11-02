# Achados das revisões — `tasks/correcoes/2026-10-30-cenario-da-onca.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-10-30 20:03:07 · `tasks/correcoes/2026-10-30-cenario-da-onca.md`

VEREDITO: APROVADO
Tela vista: sim (12 fotos lidas: 4 da Mesa, claro e escuro, a 1366 e a 360; mais 8 do Implementador, entre elas o zoom do cenário a 1024 e a 1366 × 650. É a casca pública, sem papel, então não há escola cheia nem vazia.)
Estados: ok. Carregando mostra a caixa de 432 × 300 reservada, com `fallback={null}`, e a página não pula. Erro (o pedaço não baixa) cai em `SemOnca` e o formulário continua (`apps/web/src/componentes/CascaPublica.tsx:17-31`, testado em `CascaPublica.sem-onca.test.tsx`). Vazio e "com dado" não se aplicam a uma tela de entrada.
Acessibilidade: ok. A `figure` é `aria-hidden`. O SVG não tem texto, título nem papel, e não recebe foco. O formulário mantém rótulos "E-mail" e "Senha" visíveis. Nada se mexe além da onça, que acena uma vez e para com `prefers-reduced-motion`. O contraste da lousa contra o painel (3:1, nos dois temas) está no e2e, que não rodei.
Chromebook fraco: ok. O cenário é um SVG de 27 nós e 1,9 kB, sem filtro nem degradê. Vai no pedaço `pecas-*`, fora do primeiro carregamento (92,4 kB de 150, segundo o documento da tarefa). Entra por `import()` tardio. A 1366 × 768 a página não rola (a lista `Rolam` veio vazia). A 1366 × 650 e a 1024 × 768 o cenário cabe e não toca a marca (fotos extras).
Celular: ok. A 360 px não há cenário. A onça de 88 px fica parada acima do formulário, sem rolagem horizontal. Os campos têm cerca de 46 px e o botão "Entrar" cerca de 48 px, acima dos 44 px exigidos. Nada depende de hover. O fluxo não exige celular.
Ação oficial protegida: sim (não se aplica; a tela é só de entrada e o desenho é decoração).
Bloqueantes: nenhum.

Conferências feitas:
- **Tabela da 9.7:** todas as cores do cenário usam token da tabela (`apps/web/src/componentes/ui/onca/CenaDaOnca.tsx:26-56`). `onca-chao` inverte entre os temas, mas está na tabela do documento e vale como exceção.
- **Texto e IA:** a lousa só tem triângulo, círculo e linha ondulada. Nenhum texto novo vaza na tela, e o desenho não tem selo, porque não é saída de agente (regra 70, item 4a).
- **Medidas:** `w-108`, `h-75` e `left-46` dão 432, 300 e 184 px na escala padrão do Tailwind.
- **Tela contra o código:** a foto do computador (1366) bate com o código da árvore.
- **Testes:** `vitest run` nas pastas da onça, da `CascaPublica`, em `avatar-so-nas-duas-pecas.test.ts` e `estilos.test.ts`: 10 arquivos, 140 testes passando. Não rodei o e2e nem o build.

Recomendações:
- O comentário de `apps/web/src/componentes/CascaPublica.tsx` explica o `lg:max-w-[calc(100%-5rem)]` em um parágrafo muito longo. Vale quebrar em duas linhas na próxima mexida.
- Em escuro, a ponta branca do lápis e a sombra do chão são discretas. Está dentro da tabela, então é só gosto.

## infra-guardian · 1ª rodada · APROVADO · 2026-10-30 20:03:11 · `tasks/correcoes/2026-10-30-cenario-da-onca.md`

VEREDITO: APROVADO
Caminho quente tocado: login (só a casca pública do `/entrar` no front; nada mudou na API, no worker, no realtime nem no banco)
Rate limit: ok (a mudança não toca a borda nem a autenticação)
Fila e prioridade: ok (não se aplica, a mudança não cria job)
Concorrência: protegida (não há escrita: o cenário é um SVG estático, sem estado nem efeito)
Índice e paginação: ok (não se aplica, a mudança não tem query)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (não se aplica, nenhum código novo de servidor)
Bloqueantes: nenhum
Recomendações:
- Às 7h30, com 400 alunos atrás do mesmo IP, a carga nova é só um pedaço estático `pecas-CenaDaOnca-*`, baixado por `import()` depois da casca pintada. Se esse pedaço falhar, o `.catch(() => SEM_ONCA)` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/CascaPublica.tsx` deixa a caixa vazia e o formulário continua. Vale conferir que o servidor estático manda `Cache-Control: immutable` para os `pecas-*` com hash: assim a turma inteira baixa o pedaço uma vez por máquina, e não a cada login. Isso não foi verificado nesta tarefa.
- As peças estão em 35,01 kB de um teto de 40. O que sobra para a próxima peça da casca é pouco, e convém registrar isso no `TODO.md` antes que outra correção estoure o teto no meio do caminho.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-10-30 20:03:12 · `tasks/correcoes/2026-10-30-cenario-da-onca.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A correção só mexe na apresentação da casca pública e no build do web. Não toca em API, worker, seed, importação nem banco. Todos com autor humano? Não se aplica, porque nenhum caminho foi criado nem alterado.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhum agente produz nada nesta tela, e a cena é enfeite da marca.
Supervisão do tutor: ok. A correção não toca no tutor.
Autonomia declarada e visível: não muda nada. Nenhum agente foi tocado, e a tela de governança continua como estava.
Bloqueantes: nenhum

O que conferi pela regra 70:

- **A onça não é agente nem pessoa (item 4a).** É a figura da marca, sem nome, sem legenda e sem selo "IA". A figura é `aria-hidden` e não tem `data-onca`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/ui/onca/CenaDaOnca.tsx:25` e `OncaDaMarca.tsx:30`. Como ela não entrega saída de IA, não cabe o rótulo de IA. Nas quatro fotos (`aluno--entrar--computador.png`, `aluno--entrar--celular.png`, `escuro--aluno--entrar--computador.png` e `escuro--aluno--entrar--celular.png`) nada se apresenta como pessoa nem simula vínculo afetivo.
- **Nada de nota, conceito ou correção (D55).** A lousa só tem triângulo, círculo e linha ondulada, sem texto, glifo, número, visto ou X. Isso aparece nas fotos e em `CenaDaOnca.tsx:36-40`, e o `CenaDaOnca.test.tsx` cobre o caso. A onça não ensina nem aponta para a lousa.
- **Nada induz uso nem atrapalha sair (D59, item 4b).** O cenário não tem `animation` nem `transition`. A onça entra e acena uma vez, e para com "reduzir movimento". Isso é provado em `movimento-da-onca.test.tsx` (bloco novo no fim do arquivo) e no e2e com `reducedMotion`. A correção não adiciona texto, chamada para ação nem passo extra antes do formulário.
- **Supervisão sem vigilância (itens 7 e 8).** A correção não cria medição, indicador nem leitura de comportamento.

Recomendações (não bloqueiam):
1. O `160` sobrou em `TamanhoDaOncaDaMarca` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/ui/onca/OncaDaMarca.tsx:4`), mas nenhuma tela usa mais esse tamanho. Só os testes do `OncaDaMarca.test.tsx` usam. Vale estreitar o tipo para `88 | 240` numa próxima.
2. O título do teste em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/ui/onca/OncaDaMarca.test.tsx:70` ainda diz "160 no painel". Agora o painel usa 240, dentro do cenário, e o título deve dizer isso.
3. No celular, a onça de 88 px está na pose `acenando` com as linhas do aceno desenhadas, mesmo parada. Isso não fere a regra 70. Fica só o registro para o `frontend-reviewer`, se a pose parada com o rastro do movimento parecer estranha.

## revisor-geral · 1ª rodada · APROVADO · 2026-10-30 20:04:14 · `tasks/correcoes/2026-10-30-cenario-da-onca.md`

VEREDITO: APROVADO

Escopo: respeitado. Fez as cinco partes da correção, todas registradas em `tasks/correcoes/2026-10-30-cenario-da-onca.md`, e nada além delas. O celular continua igual, com a onça de 88 px parada e sem cenário, e nenhum texto mudou.

Aderência à Tech Spec: ok. O código segue o `docs/interface.md` nas seções 9.6, 9.7 ("O cenário da onça da marca", com a tabela de tokens), 10.4 e 11.3. Duas escolhas que poderiam parecer divergência já estão escritas lá:
- A largura `lg:max-w-[calc(100%-5rem)]` sai dos "40 px de respiro também a 1024 px" da 11.3.
- O `white` do giz e das páginas está na tabela da 9.7, e por isso a `CenaDaOnca` entrou em `ARQUIVOS_COM_BRANCO_FIXO` no `estilos.test.ts`.

As fotos batem com a 9.7. A lousa fica ao lado da onça, sem texto, só com triângulo, círculo e onda. Os três livros são roxo, turquesa e rosa, e a sombra do livro de cima aparece nos dois temas. Nada vai na pata da onça, e a figura não tem legenda. No celular, nos dois temas, não há cenário.

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo).

Bloqueantes: nenhum.

Recomendações:
1. **O tamanho 160 sobrou.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/ui/onca/OncaDaMarca.tsx:4` ainda aceita `88 | 160 | 240`, mas só a casca usa a onça da marca, com 88 e 240. O 160 só continua lá porque `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/ui/onca/OncaDaMarca.test.tsx:70-71` ainda testa "160 no painel, 88 acima do formulário", o que não é mais verdade. Convém tirar o 160 do tipo e passar o teste para 240 e 88.
2. **Uma frase velha na 9.7.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/docs/interface.md:1237` ainda diz "onde a de 160 px, escondida só pelo CSS, também é montada". Hoje a onça escondida a 360 px é a de 240 px, dentro do cenário. Convém trocar o 160 por "a do cenário, de 240 px" para a seção não se contradizer.
3. **A ponta do lápis some no tema claro.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/.processo/vitrine/aluno--entrar--computador.png`, a ponta branca quase desaparece sobre o `papel`. Ela vem de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/ui/onca/CenaDaOnca.tsx:45` e segue a tabela da 9.7, então não é defeito. A legibilidade é assunto do `frontend-reviewer`.

## test-engineer · 1ª rodada · REPROVADO · 2026-10-30 20:04:43 · `tasks/correcoes/2026-10-30-cenario-da-onca.md`

VEREDITO: REPROVADO

Cenários exigidos:
- Caminho feliz: de 1024 px para cima, o painel mostra o cenário de 432 × 300 com a onça de 240 px acenando, no centro, abaixo da marca, com 40 px de respiro dos lados.
- Bordas reais deste recorte:
  - a 1024 px o painel tem 510 px úteis, e a caixa não pode perder os 40 px de respiro;
  - janela baixa (1366 × 650 e 1024 × 500), em que o cenário não pode encostar na marca;
  - a rede da escola às 7h30 não entrega o pedaço do cenário ou o da onça, e o formulário tem de continuar;
  - "reduzir movimento" ligado;
  - tema escuro: a lousa precisa de contraste e nenhum token pode inverter;
  - abaixo de 1024 px e a 360 px o cenário some, e fica a onça de 88 px parada.
- Permissão: o cenário só pode ser importado pela `CascaPublica`, por import tardio (lista fechada), sem nome, selo nem texto de IA (regra 70, item 4a).
- Isolamento: não se aplica. É tela pública, sem dado de escola nem de pessoa.
- Concorrência e IA: não se aplicam. Não há escrita, job nem chamada a provedor.

Cobertos:
- Cada linha da seção "Teste que reproduz" tem o seu teste, e conferi item por item, inclusive os que estavam juntos por ponto e vírgula:
  - `CenaDaOnca.test.tsx` tem os 9 casos;
  - `avatar-so-nas-duas-pecas.test.ts` ganhou um caso novo e a lista da entrada foi atualizada;
  - `movimento-da-onca.test.tsx` tem dois casos, e "reduzir movimento" é testado de verdade com `reduzirMovimento(true)`;
  - `CascaPublica.test.tsx` cobre a caixa, a onça de 240, a ausência da de 160 e o `min-h`;
  - `CascaPublica.sem-onca.test.tsx` cobre as duas caixas vazias e o formulário na tela;
  - `nome-dos-chunks.test.ts` tem a unidade e o build de verdade;
  - no e2e: as quatro janelas, `width=240`, até 432 px com 40 px de respiro, topo abaixo da marca, base dentro do painel, sem rolagem de lado, o giz longe de `pata-d` e de `movimento`, o contraste de 3:1 nos dois temas, `reducedMotion`, e o cenário escondido a 1023 e a 360 px.
- Os 12 blocos de mutação batem com as cláusulas novas do `git diff`. Cada um chega à cláusula pelo motivo certo:
  - o hex falha na checagem de `fill` igual a `none`;
  - `r=60` dá 180, acima de 168;
  - os 14 rects a mais levam a 42 nós, acima de 40;
  - `left-40` falha no `arrayContaining`;
  - o `.catch` removido faz a renderização falhar dentro do Suspense, que não tem fronteira de erro.
- As cláusulas de tipo (`TamanhoDaOnca`, `TamanhoDaOncaDaMarca`) não pedem bloco.
- Não há `.skip`, teste comentado nem chamada de IA. O mock de `sem-onca` simula a falha do import, que é exatamente a regra testada, e não a esconde.
- Rodei os testes de unidade:
  - `CenaDaOnca`, `CascaPublica`, `CascaPublica.sem-onca`, `avatar-so-nas-duas-pecas`, `movimento-da-onca` e `estilos`: 84 de 84 passaram;
  - `nome-dos-chunks.test.ts`, com o build de verdade: 31 de 31 passaram.
- O e2e eu não rodei.

Bloqueantes:
1. `apps/web/src/componentes/ui/onca/CenaDaOnca.test.tsx:152`: `expect(46 * 4 + 240).toBe(424)` compara duas constantes e sempre passa. A regra 40, item 5, proíbe asserção assim. E a metade direita do quadro que o caso diz provar ("x 184–424", dentro dos 432 da figura) acaba sem prova: a linha não lê nada do componente.
   - Correção exigida: tirar o número da classe da caixa, algo como `Number(/\bleft-(\d+)\b/.exec(classe)[1]) * 4`, somar o `width` do `svg` da onça e afirmar que dá até 432 (e 184 à esquerda). Ou então apagar a linha e deixar a prova da borda direita para o e2e, que já mede `oncaDesenhada.x + oncaDesenhada.width` contra a caixa (`e2e/casca-publica.spec.ts:192`).

Recomendações:
- `CenaDaOnca.test.tsx:102-117`: o caso diz "todas as marcas ficam dentro do quadro de x 0–168", mas só confere o x do triângulo e o do círculo. A onda é relativa e não é medida: trocar `t28 0` por `t80 0` passaria. O e2e do giz contra a pata cobre a regra que importa, mas o caso de unidade promete mais do que prova. Vale somar os deslocamentos da onda e afirmar que o fim dela fica até 168.
- `CascaPublica.sem-onca.test.tsx:12-17`: os dois imports falham juntos. Falta o caso em que só o pedaço do cenário falha e a onça de 88 px carrega, o que pode acontecer se o pedaço do cenário for o único a cair na rede da escola.
- `movimento-da-onca.test.tsx:417-425`: a primeira parte só lê o `Onca.css`. Se o cenário ganhar um CSS próprio, ela não vê. Hoje quem pega isso é o e2e, com o `getAnimations` no SVG do cenário, e o nome do caso poderia dizer isso.
- `e2e/casca-publica.spec.ts:194` e `:211`: a moldura da lousa é localizada por `> svg > g` e `.first()`, a primeira `g` do SVG, que hoje é a da moldura, da calha e do vaso. Um `data-lousa` na `g` deixaria o seletor estável se a ordem mudar.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/tasks/correcoes/2026-10-30-cenario-da-onca.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/ui/onca/CenaDaOnca.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/ui/onca/CenaDaOnca.test.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/e2e/casca-publica.spec.ts

## frontend-reviewer · 2ª rodada · APROVADO · 2026-10-30 20:13:12 · `tasks/correcoes/2026-10-30-cenario-da-onca.md`

VEREDITO: APROVADO
Tela vista: sim (4 fotos lidas: /entrar a 1366 e a 360 px, no claro e no escuro. A casca pública não tem versão "vazia": é um formulário, sem dado).
Estados: ok. Carregando e erro foram conferidos pelo código, não pela foto. O `fallback={null}` com as caixas já no tamanho final evita que a página pule. Se o pedaço do cenário ou o da onça não carrega, `SEM_ONCA` deixa a caixa vazia e o formulário continua. O caso novo `CascaPublica.sem-cenario.test.tsx` prova que só o cenário falha e a onça de 88 px aparece. Vazio e "com dado" não se aplicam: é uma casca, sem dado de servidor.
Acessibilidade: ok.
- A `figure` do cenário é `aria-hidden`.
- O SVG tem `focusable="false"` e não tem `text`, `title` nem `role`.
- O cenário não é saída de agente, e a regra 70 item 4a não se aplica.
- O `h1`, os rótulos "E-mail" e "Senha" e o botão estão visíveis e legíveis nas fotos, no claro e no escuro.
- O contraste do texto e das bordas dos campos parece adequado. O `contraste.test.ts` segue valendo para os tokens.
Chromebook fraco: ok.
- O cenário é um SVG estático, sem filtro, degradê nem animação própria.
- Ele chega por `import()` tardio e não entra no primeiro carregamento.
- As caixas têm tamanho fixo, então não há salto de layout.
Celular: ok.
- A 360 px não há rolagem horizontal nem corte. A onça de 88 px, parada, fica acima do formulário.
- A ação principal ("ENTRAR") passa de 44 px de altura na foto.
- O cenário fica escondido (`hidden lg:block`).
- Nada depende de hover.
- Os pedaços lazy vêm do `e2e/casca-publica.spec.ts` e do `casca-no-celular`.
Ação oficial protegida: não se aplica, não há ação oficial nesta tela. A tela de entrada só autentica.
Aderência à pele (`docs/interface.md`):
- Os tokens `*-degrau` e `onca-chao` aparecem como classes `fill-*` e `stroke-*`, sem cor solta.
- O tema escuro mantém o cenário legível, e o chão da onça acompanha o tema.
- A lousa, o vaso e o lápis não colidem com a onça, que acena à direita da lousa.
- Não aparece texto em inglês, id nem chave de tradução.

Bloqueantes: nenhum.

O que mudou desde a 1ª rodada, conferido no diff:
- `CenaDaOnca.tsx:28` ganhou `data-lousa=""` na moldura da lousa. É um atributo inerte, sem efeito visual nem de acessibilidade.
- O e2e agora seleciona a lousa por `[data-lousa]`, e não por `> svg > g`, que quebrava à toa.
- O teste novo mede o fim da onda e a moldura (x 0 a 168). A conta de `left-46 + 240 = 424` agora lê a classe e a largura reais, em vez de repetir número fixo.
- `CascaPublica.sem-cenario.test.tsx` é novo e cobre a falha parcial do cenário.
- O comentário longo de `CascaPublica.tsx` foi quebrado, como a 1ª rodada recomendou.
- Nenhuma correção exigida ficou pendente: a 1ª rodada não exigiu nenhuma.

Recomendações:
1. `CascaPublica.tsx:71-75`: no celular a caixa do cenário está `hidden`, mas o `lazy` dentro do `Suspense` ainda monta o componente e baixa o pedaço `CenaDaOnca` na rede móvel e na do Chromebook. O arquivo é pequeno. Mesmo assim, o doc diz "no celular não há cenário", e a regra 50 item 1 pede bundle enxuto. Se der, condicione o `import()` a `matchMedia('(min-width: 1024px)')`.
2. `data-lousa` e `data-livro` são ganchos de teste dentro do componente de produção. Não é problema, mas vale deixar um comentário dizendo que são só para o e2e.

Arquivos principais:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/ui/onca/CenaDaOnca.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/CascaPublica.tsx`

## infra-guardian · 2ª rodada · APROVADO · 2026-10-30 20:13:19 · `tasks/correcoes/2026-10-30-cenario-da-onca.md`

```
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
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/ui/onca/CenaDaOnca.test.tsx:86 — a regex que lê os deslocamentos da onda ficou densa (troca de sinal sem espaço, índice que muda conforme o comando). Um auxiliar com nome, ou um comentário com o `d` de exemplo, deixa o teste mais fácil de manter quando a onda mudar.
```

Nesta rodada só conferi o diff de /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/.processo/ordens/diff-cenario-r1-r2.txt. A rodada 1 não exigiu correção, então não havia nada para conferir.

O diff fica todo no front-end e não muda nada que a manhã de segunda sinta:
- **CenaDaOnca.tsx:** só ganhou o atributo `data-lousa`, sem efeito na tela.
- **CascaPublica.tsx:** só o comentário mudou.
- **Testes:** o resto do diff são testes (vitest e e2e).
- **Rede e estado:** busquei no cenário e na casca e não há `fetch`, `useQuery`, `WebSocket`, timer nem storage.
- **Outras partes:** nada em `apps/api`, `apps/worker`, `packages` ou `infra` foi alterado.

O arquivo novo `CascaPublica.sem-cenario.test.tsx` simula o pedaço do cenário falhando sozinho, como numa rede de escola instável. O teste confirma que o formulário continua, que a caixa do cenário fica vazia sem a página pular e que a onça de 88 px ainda aparece.

## privacy-guardian · 2ª rodada · APROVADO · 2026-10-30 20:13:35 · `tasks/correcoes/2026-10-30-cenario-da-onca.md`

**VEREDITO: APROVADO**

Rodada 2. Auditei só o diff de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/.processo/ordens/diff-cenario-r1-r2.txt` e as quatro fotos refeitas. A rodada 1 não deixou correção exigida, então não havia correção a conferir.

- **Campos pessoais tocados:** nenhum. O diff só mexe em ilustração (um atributo `data-lousa=""` num `<rect>` do SVG), em comentário, em testes de geometria e no seletor do e2e.
- **Fora da tabela de dados do docs/lgpd.md:** nada. Nenhum campo, migration, DTO ou rota foi criado ou alterado.
- **Autorização por objeto:** não se aplica. É a casca pública, sem papel, e não há endpoint no diff.
- **Logs:** limpos. O diff não tem nenhuma chamada de logger.
- **Auditoria:** não se aplica. Não há leitura de dado de aluno, exportação, nota, permissão nem saída de IA.
- **Envio externo:** nenhum. Não há chamada a provedor nem rede.
- **Seed/fixture:** sintético. O teste novo `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/CascaPublica.sem-cenario.test.tsx` só renderiza um formulário vazio com o rótulo "E-mail". Não tem nome, matrícula nem valor de pessoa.
- **Fotos** (`aluno--entrar--computador.png`, `aluno--entrar--celular.png`, `escuro--aluno--entrar--computador.png`, `escuro--aluno--entrar--celular.png`): mostram a marca, o cenário da onça (lousa com formas geométricas, vaso, lápis, livros), o título "Entrar" e os campos E-mail e Senha vazios. Não aparece nenhum nome, matrícula, turma ou conteúdo de pessoa, nem no claro nem no escuro, nem no computador nem no celular. A onça é ilustração da marca e não representa nenhum titular.
- **Pergunta de fechamento:** este diff não grava nem envia nada sobre aluno, então não muda a resposta que o sistema já dava à secretaria.

**Bloqueantes:** nenhum.

**Recomendações:**
- O campo "E-mail" da tela /entrar já existia antes desta tarefa. Pela regra 20, item 2, aluno não tem e-mail, e pela D48 ele entra pela conta da escola ou por matrícula. Se a mesma tela /entrar for o caminho do aluno no piloto, convém conferir numa tarefa própria que o texto e o fluxo do aluno não pedem e-mail. Não bloqueia: fica fora do diff e nenhum campo foi criado aqui.

## revisor-geral · 2ª rodada · APROVADO · 2026-10-30 20:13:55 · `tasks/correcoes/2026-10-30-cenario-da-onca.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

Na rodada anterior não exigi nenhuma correção. O diff desta rodada só ajusta testes, acrescenta o atributo `data-lousa` em `CenaDaOnca.tsx:28` e reparte o comentário em `CascaPublica.tsx:37-43`. O código de produção não mudou de comportamento, e o escopo não foi além do que o documento pede. A seção "O que a rodada 1 mudou" do documento lista os seis itens, e os seis estão no diff.

- **`[data-lousa]`:** o atributo existe em `CenaDaOnca.tsx` e é usado em `CenaDaOnca.test.tsx:122` e nos dois pontos de `e2e/casca-publica.spec.ts` (146 e 155). Ele substitui o antigo `> svg > g` com `.first()`, que dependia da ordem dos elementos.
- **Conta da onda:** o caso em `CenaDaOnca.test.tsx:116-120` calcula certo com o traço atual, `M24 152q14-18 28 0t28 0t28 0t28 0`. São 24 + 4 × 28 + 2 = 138, que cabe em 168. A mutação declarada, que troca o último 28 por 80, chegaria a 190 e deixaria o caso vermelho.
- **Posição da onça:** o caso em `CenaDaOnca.test.tsx:155-167` agora lê o `left-N` da classe e a largura do SVG. Antes comparava duas constantes.
- **Arquivo novo `CascaPublica.sem-cenario.test.tsx`:** cobre o caso em que só o pedaço do cenário falha. O motivo de ser um arquivo separado está escrito nele: o `vi.mock` vale para o arquivo inteiro.

**Fotos:** a tela entrega o que a 9.7 e a 11.3 descrevem.
- `aluno--entrar--computador.png` e `escuro--aluno--entrar--computador.png` mostram a lousa com triângulo, círculo e onda, o vaso, o lápis, os três livros (roxo, turquesa e rosa) e a onça de 240 px por cima. O cenário fica centrado no painel e nenhum texto novo aparece.
- `aluno--entrar--celular.png` e `escuro--aluno--entrar--celular.png` mostram só a onça de 88 px, sem cenário.

Recomendações:
- `CenaDaOnca.test.tsx:118` faz numa linha só a leitura do caminho da onda (regex, `split` com lookahead e escolha de índice por comando), e fica difícil de ler. Uma função pequena com nome, como `deslocamentosEmX(caminho)`, tornaria o caso legível sem mudar o que ele prova.
- O bloco de mutação de `CascaPublica.tsx` que remove o `.catch` do `CenaDaOnca` aparece duas vezes no documento: uma aponta para `sem-onca` e a outra, abaixo da tabela de Revisões, para `sem-cenario`. É redundante, mas não está errado. A recomendação é só manter os blocos novos acima da tabela, que é preenchida pelo hook.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/tasks/correcoes/2026-10-30-cenario-da-onca.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/CascaPublica.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/apps/web/src/componentes/ui/onca/CenaDaOnca.test.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-10-30-tela-de-entrar/.processo/ordens/diff-cenario-r1-r2.txt`

## test-engineer · 2ª rodada · APROVADO · 2026-10-30 20:14:10 · `tasks/correcoes/2026-10-30-cenario-da-onca.md`

VEREDITO: APROVADO

**Correção exigida na 1ª rodada:** feita.
- `apps/web/src/componentes/ui/onca/CenaDaOnca.test.tsx:104-108`: o teste agora lê o `left-N` da classe da caixa e multiplica por 4, lê o `width` do `svg` da onça e o `width` do `svg` do cenário (`:scope > svg`). Ele afirma que a onça começa em 184, termina em 424 e não passa da largura da figura. A conta entre duas constantes saiu.
- As mutações `left-46` → `left-40` e `tamanho={240}` → `{160}` derrubam o teste pelo motivo certo: 160 ≠ 184 e 400 ≠ 424.

Rodei os cinco arquivos afetados (`CenaDaOnca.test.tsx`, `CascaPublica.sem-cenario.test.tsx`, `CascaPublica.sem-onca.test.tsx`, `CascaPublica.test.tsx`, `movimento-da-onca.test.tsx`): 31 testes passaram. O e2e não rodei.

**Cenários exigidos:**
- Caminho feliz: o painel monta a `CenaDaOnca` com a onça de 240 px por cima.
- Borda, rede da escola às 7h30: os dois pedaços falham juntos, ou só o do cenário falha e a onça de 88 px carrega. Nos dois casos o formulário continua e a caixa de 432 × 300 fica vazia.
- Borda, 1024 px: o painel tem 510 px úteis e o respiro de 40 px continua dos dois lados.
- Borda, celular a 360 px: o cenário some e a onça de 88 px fica parada.
- Borda, `reducedMotion`: nada se move.
- O giz fica dentro do quadro da lousa e longe da pata que acena.
- O peso do cenário fica fora do primeiro carregamento.
- Permissão e isolamento: não se aplicam, porque a tela é pública, sem sessão e sem dado de escola.

**Cobertos (diff desta rodada):**
- **A onda:** o caso da lousa (`CenaDaOnca.test.tsx:115-118`) soma os deslocamentos relativos da onda. A mutação `t80 0` leva o fim a 188 + 2 e o caso cai.
- **A moldura:** o caso lê `[data-lousa]` e afirma x 0 e largura 168. A mutação para `width={190}` derruba o caso.
- **Só o cenário falha:** o arquivo novo `CascaPublica.sem-cenario.test.tsx` cobre esse caso. Ele tem um bloco de mutação próprio (remover o `.catch` do `lazy` do cenário), e a afirmação de que a onça de 88 px chega prova que só um pedaço falhou.
- **Tabela de testes:** o documento cita cada caso pelo nome, inclusive o arquivo novo.
- **Mutações:** toda cláusula nova do diff tem o seu bloco.
- **O resto:** nenhum `.skip` e nenhum teste comentado. O único `vi.mock` simula a falha de rede, que é justamente a regra testada, e não a esconde. Nada de IA e nada de concorrência nesta tarefa.

Bloqueantes: nenhum.

Recomendações:
1. `apps/web/src/componentes/CascaPublica.sem-cenario.test.tsx:47`: o `expect(caixa.childElementCount).toBe(0)` roda depois de 5 voltas fixas de microtarefa. O `fallback` também é vazio, então essa linha passaria mesmo que o import ainda não tivesse falhado. Hoje quem prova a falha tratada é a ausência de exceção mais o `waitFor` da onça de 88 px. Vale mover a contagem de filhos da caixa para depois do `waitFor` da linha 50.
2. `apps/web/src/componentes/ui/onca/CenaDaOnca.test.tsx:118-120`: o limite 168 do giz aparece como literal e a moldura é conferida à parte contra o mesmo 168. Daria para usar `x + width` lido do `[data-lousa]` como limite das marcas: o teste ficaria com uma fonte só.
