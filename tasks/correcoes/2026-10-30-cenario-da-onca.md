# Correção — a onça da marca sozinha no painel parece solta: ganha um canto de sala de aula

**Origem:** uso (pedido do Joaquim; D80 revista às 21:45 de 30/10/2026, `a4d615cb` na `develop`; texto em `docs/decisoes.md`, fim da D80, e em `docs/interface.md` 9.6, 9.7 "O cenário da onça da marca", 10.4 e 11.3)
**Subagentes obrigatórios:** `frontend-reviewer`, `conformidade-reviewer`, `infra-guardian`, `tenancy-guardian`, `privacy-guardian`, `revisor-geral`
<!-- Quem dita os guardiões é o Orquestrador, no pedido. test-engineer é obrigatório em toda correção. `revisor-geral` entra porque a correção
     altera mais de 5 arquivos fora de `tasks/`. -->

## Sintoma

Depois da correção `2026-10-30-onca-na-entrada`, o painel da casca pública (`/entrar` e as telas irmãs) tem a onça da marca de 160 px
sozinha no meio de um painel vazio. O Joaquim a achou solta e delegou o desenho, com a condição de ele conferir pela foto: um cantinho
de sala de aula (lousa, livros), com a onça maior, de 240 px.

## Fora desta correção

Nada.

## Causa

Não é defeito de código, é decisão de produto nova (D80 revista às 21:45). O que faltava era uma peça que pusesse a `OncaDaMarca` sobre
um cenário de 432 × 300 px, e o tamanho 240 na `OncaDaMarca` e no desenho.

## Teste que reproduz

- `apps/web/src/componentes/ui/onca/CenaDaOnca.test.tsx` (novo): a figura é `aria-hidden`, tem 432 × 300 e `max-w-full`; o SVG não tem
  texto, título, descrição, papel, nome acessível, animação, filtro, degradê nem recorte; nenhum elemento tem `style`; toda classe de
  cor está na tabela da 9.7, lida do documento, sem hex e sem token que inverta entre os temas; os três livros só usam roxo, turquesa
  e rosa; a lousa só tem triângulo, círculo e linha ondulada, dentro do quadro de x 0–168; até 40 nós e 3 kB; a onça tem 240 px, pose
  `acenando`, sem `data-onca`, legenda nem selo, e vem por cima do cenário.
- `apps/web/src/componentes/ui/ia/avatar-so-nas-duas-pecas.test.ts`: a `CenaDaOnca` só é importada pela `CascaPublica`, por `import()`
  tardio; a `OncaDaMarca` só pela `CascaPublica` e pelo cenário; o import estático da pasta na casca continua reprovado.
- `apps/web/src/componentes/ui/onca/movimento-da-onca.test.tsx`: o `Onca.css` continua com as três animações, uma volta cada, e nenhuma
  regra com `transition` (o cenário não tem CSS próprio; o SVG dele, sem animação, quem mede é o e2e com `getAnimations`); só a onça se mexe.
- `apps/web/src/componentes/CascaPublica.test.tsx`, `CascaPublica.sem-onca.test.tsx` e `CascaPublica.sem-cenario.test.tsx` (novo): o
  painel monta a `CenaDaOnca` e não mais a onça solta de 160 px; se o pedaço do cenário e o da onça falharem, ou só o do cenário
  (a onça de 88 px carrega), a caixa de 432 × 300 fica vazia e o formulário continua.
- `apps/web/nome-dos-chunks.test.ts`: a `CenaDaOnca` é peça (`pecas-*`), fora do primeiro carregamento, no build de verdade, e nenhum
  pedaço de nome novo nasce.
- `e2e/casca-publica.spec.ts`: 1366 × 768, 1366 × 650, 1024 × 768 e 1024 × 500; a onça tem `svg width=240`; o cenário tem até 432 px
  e 40 px de respiro de cada lado, topo abaixo da marca, base dentro do painel, sem rolagem de lado; o giz fica longe da pata que acena;
  a lousa tem contraste de 3:1 contra o painel nos dois temas; com `reducedMotion` nada se move; a 1023 e a 360 px o cenário some.
  Sem mudança: os textos de `entrar.spec.ts` e `entrar-na-escola.spec.ts`, e o `fidelidade-ao-mockup.test.tsx`.

## Correção

1. **Peça nova, `ui/onca/CenaDaOnca.tsx`.** Uma `figure` `aria-hidden`, com `data-cena-da-onca`, de 432 × 300 (`w-108 h-75`,
   `max-w-full`). O cenário é um SVG inline de 432 × 300, e a onça (`OncaDaMarca`, `tamanho={240}`, animada) vem por cima, no quadro de x
   184–424 e y 0–240. À esquerda a lousa (x 0–168, y 40–200, com moldura e calha, e giz branco: triângulo, círculo e linha ondulada);
   sob ela, o vaso com planta (x 40–100); o lápis deitado no chão entre o vaso e a pilha; à direita, a pilha de três livros de 22 px
   (rosa, turquesa e roxo), com o topo em y 222, onde cai a sombra da onça; e a segunda sombra `onca-chao` no chão sob a pilha
   (y 288–300). 27 nós e 1,9 kB. Só classes `fill-*` e `stroke-*` de tokens da tabela da 9.7.
2. **`TamanhoDaOnca` e `TamanhoDaOncaDaMarca` ganham o `240`**, sem tocar no traço.
3. **`CascaPublica.tsx`.** De 1024 px para cima o painel mostra a `CenaDaOnca`, por `lazy()` com o mesmo `.catch` do `SemOnca`, numa caixa
   reservada `data-cena-da-onca-caixa` (432 × 300, `max-w-full`, centrada por `inset-0 m-auto`). O painel ganha `lg:min-h-[34rem]`.
   No celular continua a `OncaDaMarca` de 88 px, parada, sem cenário. Nenhum texto novo.
4. **O respiro a 1024 px.** O painel tem 510 px úteis ali (a borda de 2 px come dois), e um cenário de 432 px centrado deixaria 39 px do
   lado esquerdo, e não os 40 do plano. A caixa ganha `lg:max-w-[calc(100%-5rem)]`: a 1024 px ela tem 430 px, a 1366 px continua com 432,
   e o `max-w-full` fica para o que está abaixo de `lg`. A figura de dentro continua `w-108 max-w-full`.
5. **`nome-dos-chunks.ts`.** `ui/onca/CenaDaOnca` entra em `PECAS_FORA_DA_ENTRADA`: o pedaço dela é `pecas-CenaDaOnca-*`, e não um `parte-*`
   que o teto do primeiro carregamento mediria.

Sem laço e sem reação: o cenário não tem `animation` nem `transition`; só a onça entra (240 ms) e acena, uma vez, e os dois param com
`prefers-reduced-motion`.

## Fotos

Em `.processo/fotos-tela-de-entrar/` (fora do git), tiradas por mim, no ambiente do e2e, depois da onça terminar de acenar: `/entrar` a
1366 × 768, 1024 × 768 e 1366 × 650, em claro e em escuro (`entrar-<janela>-<tema>.png`); o zoom do cenário em claro e em escuro
(`cenario-zoom-<tema>.png`); `/entrar` a 360 × 800 (`entrar-360x800-claro.png`), onde o celular não mudou (onça de 88 px, parada,
sem cenário); e a entrada do aluno a 1366 em claro (`entrada-do-aluno-1366x768-claro.png`). O lápis ganhou a ponta afilada (a ponta
branca sumia no papel claro) e as páginas dos livros ficaram mais baixas, para a sombra da onça não deixar uma faixa cinza larga no
livro de cima. Peças: 35,01 kB de 40; primeiro carregamento: 92,4 kB de 150.

**O que a rodada 1 mudou.** (1) O caso do quadro da onça lê o `left-N` da classe e a largura do desenho, e afirma 184 e 424 (a conta
antiga comparava duas constantes). (2) O caso da lousa soma os deslocamentos da onda e afirma que o fim dela cabe em x 168, e lê a
moldura `[data-lousa]` (x 0, largura 168). (3) `CascaPublica.sem-cenario.test.tsx`: só o pedaço do cenário falha. (4) O nome do caso do
movimento diz o que ele lê. (5) A moldura da lousa ganhou `data-lousa`, e o e2e a acha por ele, e não por `> svg > g` e `.first()`.
(6) O comentário da `CascaPublica` foi repartido em linhas curtas.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| frontend-reviewer (1ª) | Em escuro, a ponta branca do lápis e a sombra do chão são discretas | Recusada: as cores são as da tabela da 9.7 (`docs/interface.md`), que o próprio revisor diz estar cumprida ("é só gosto"); mudar cor é decisão de produto, e a foto passa pelo Joaquim |
| infra-guardian (1ª) | Conferir que o servidor estático manda `Cache-Control: immutable` nos `pecas-*` com hash | `TODO.md`: é conferência de deploy (`infra/`), fora dos arquivos desta correção; o revisor não a verificou |
| infra-guardian (1ª) | As peças estão em 35,01 kB de um teto de 40: registrar no `TODO.md` | `TODO.md`: uma linha, antes da próxima peça da casca |
| conformidade-reviewer (1ª), revisor-geral (1ª) | Tirar o `160` de `TamanhoDaOncaDaMarca` e passar `OncaDaMarca.test.tsx:70` para 240 e 88 | `TODO.md`, na tarefa que tocar `OncaDaMarca`: o teste não é tocado por esta correção, e cinco casos dele (linhas 27, 56, 83, 96 e 108) renderizam `tamanho={160}`, o que sai do "poucas linhas" |
| revisor-geral (1ª) | `docs/interface.md:1237` ainda diz "a de 160 px, escondida só pelo CSS" | Do Arquiteto, `TODO.md`: é texto do documento de interface, e esta ordem não edita documento |
| conformidade-reviewer (1ª) | No celular, a onça de 88 px está na pose `acenando` com o rastro desenhado, mesmo parada | Sem ação: o revisor escreveu que não fere a regra 70, "só o registro"; o `frontend-reviewer` viu a foto do celular e aprovou |
| revisor-geral (1ª) | A ponta branca do lápis some sobre o `papel` no tema claro | Sem ação: o revisor diz que não é defeito e que o assunto é do `frontend-reviewer`, que aprovou; o lápis já ganhou a ponta afilada na correção |

**Da rodada 2** (`.processo/ordens/2026-10-30-cenario-da-onca-r2.md`: todos aprovaram, nada a corrigir):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| frontend-reviewer (2ª) | `CascaPublica.tsx:71-75`: no celular a caixa está `hidden`, mas o `lazy` ainda baixa o pedaço `CenaDaOnca`; condicionar o `import()` a `matchMedia('(min-width: 1024px)')` | `TODO.md`: muda comportamento (decide quando baixar o pedaço) e o contrato dos testes da casca; o pedaço é de 35 kB no total das peças e fica fora do primeiro carregamento. A `interface.md` 11.3 diz que no celular não há cenário na tela, e a tela cumpre |
| frontend-reviewer (2ª) | Comentário dizendo que `data-lousa` e `data-livro` são ganchos só do teste | Sem ação: é um comentário num componente que já tem o seu de cabeçalho; vale na próxima mexida em `CenaDaOnca.tsx` |
| infra-guardian (2ª) | `CenaDaOnca.test.tsx:86`: a regex da onda está densa; um auxiliar com nome ou comentário com o `d` de exemplo | Sem ação agora, junto da recomendação do revisor-geral (2ª) abaixo: mesma linha de teste, na próxima mexida no arquivo |
| revisor-geral (2ª) | `CenaDaOnca.test.tsx:118`: extrair `deslocamentosEmX(caminho)` | Igual ao item acima: mexida futura no arquivo |
| revisor-geral (2ª) | O bloco de mutação do `.catch` de `CascaPublica.tsx` aparece duas vezes, um para `sem-onca` e outro para `sem-cenario` | Sem ação: o revisor diz que "não está errado"; são dois blocos porque são dois testes que o provam |
| privacy-guardian (2ª) | O campo "E-mail" de `/entrar` existia antes: conferir, numa tarefa própria, que o fluxo do aluno não pede e-mail (regra 20, item 2; D48) | `TODO.md`: fora do diff e da correção; nenhum campo foi criado aqui |
| test-engineer (2ª) | `CascaPublica.sem-cenario.test.tsx:47`: o `childElementCount` roda antes do `waitFor` e passaria mesmo sem o import ter falhado; mover para depois do `waitFor` | `TODO.md`: o revisor aprovou, e a prova de que o import falhou está no `waitFor` da onça de 88 px e no bloco de mutação do `.catch` |
| test-engineer (2ª) | `CenaDaOnca.test.tsx:118-120`: usar `x + width` lido do `[data-lousa]` como limite das marcas, em vez do literal 168 | Mexida futura no arquivo; hoje o literal e a moldura são conferidos os dois contra 168 |

## Mutações

```mutacao
arquivo: apps/web/src/componentes/CascaPublica.tsx
teste: apps/web/src/componentes/CascaPublica.test.tsx › o painel é `papel`, com a borda `borda`, em toda largura: o `laranja-claro` esconderia os pés da onça, que têm o mesmo creme
-<div data-painel-publico="" className="relative border-b-2 border-borda bg-papel lg:min-h-[34rem] lg:border-r-2 lg:border-b-0">
+<div data-painel-publico="" className="relative border-b-2 border-borda bg-papel lg:border-r-2 lg:border-b-0">
```

```mutacao
arquivo: apps/web/src/componentes/CascaPublica.tsx
teste: apps/web/src/componentes/CascaPublica.test.tsx › o cenário e a onça chegam depois da primeira pintura: o cenário de 432 × 300 px no painel, com a onça de 240 px, e a de 88 px acima do formulário, sem nome nem selo
-<div data-cena-da-onca-caixa="" className="pointer-events-none absolute inset-0 m-auto hidden h-75 w-108 max-w-full select-none lg:block lg:max-w-[calc(100%-5rem)]">
+<div data-cena-da-onca-caixa="" className="pointer-events-none absolute inset-0 m-auto hidden h-75 w-108 max-w-full select-none lg:block">
```

```mutacao
arquivo: apps/web/src/componentes/CascaPublica.tsx
teste: apps/web/src/componentes/CascaPublica.sem-onca.test.tsx › o formulário continua na tela, e a caixa de 432 × 300 e a de 88 px ficam no lugar, vazias
  import('./ui/onca/CenaDaOnca')
    .then(({ CenaDaOnca: peca }) => ({ default: peca }))
-    .catch(() => SEM_ONCA),
```

```mutacao
arquivo: apps/web/src/componentes/CascaPublica.tsx
teste: apps/web/src/componentes/CascaPublica.test.tsx › o cenário e a onça chegam depois da primeira pintura: o cenário de 432 × 300 px no painel, com a onça de 240 px, e a de 88 px acima do formulário, sem nome nem selo
-<CenaDaOnca />
+<OncaDaMarca tamanho={88} />
```

```mutacao
arquivo: apps/web/nome-dos-chunks.ts
teste: apps/web/nome-dos-chunks.test.ts › o desenho da onça, a onça da marca e o cenário dela estão fora da entrada: a casca pública só os baixa por import tardio
  'ui/onca/CabecaOnca',
-  'ui/onca/CenaDaOnca',
  'ui/onca/DesenhoDaOnca',
```

```mutacao
arquivo: apps/web/src/componentes/ui/onca/CenaDaOnca.tsx
teste: apps/web/src/componentes/ui/onca/CenaDaOnca.test.tsx › a figura é escondida da leitura de tela, tem 432 × 300 e cabe no painel
-<figure data-cena-da-onca="" aria-hidden="true" className="relative m-0 h-75 w-108 max-w-full select-none">
+<figure data-cena-da-onca="" className="relative m-0 h-75 w-108 max-w-full select-none">
```

```mutacao
arquivo: apps/web/src/componentes/ui/onca/CenaDaOnca.tsx
teste: apps/web/src/componentes/ui/onca/CenaDaOnca.test.tsx › a figura é escondida da leitura de tela, tem 432 × 300 e cabe no painel
-<figure data-cena-da-onca="" aria-hidden="true" className="relative m-0 h-75 w-108 max-w-full select-none">
+<figure data-cena-da-onca="" aria-hidden="true" className="relative m-0 h-75 w-108 select-none">
```

```mutacao
arquivo: apps/web/src/componentes/ui/onca/CenaDaOnca.tsx
teste: apps/web/src/componentes/ui/onca/CenaDaOnca.test.tsx › os livros são três e só usam roxo, turquesa e rosa: nunca o trio dos agentes nem cor de estado
-<rect x={232} y={222} width={144} height={22} rx={5} data-livro="" className="fill-roxo-degrau" />
+<rect x={232} y={222} width={144} height={22} rx={5} data-livro="" className="fill-azul-degrau" />
```

```mutacao
arquivo: apps/web/src/componentes/ui/onca/CenaDaOnca.tsx
teste: apps/web/src/componentes/ui/onca/CenaDaOnca.test.tsx › a cor é só classe de preenchimento e de traço de token da tabela da 9.7: nenhum hex, nenhum token que inverte entre os temas
-<rect x={208} y={288} width={192} height={12} rx={6} className="fill-onca-chao" />
+<rect x={208} y={288} width={192} height={12} rx={6} fill="#afafaf" />
```

```mutacao
arquivo: apps/web/src/componentes/ui/onca/CenaDaOnca.tsx
teste: apps/web/src/componentes/ui/onca/CenaDaOnca.test.tsx › a lousa só tem triângulo, círculo e linha ondulada em giz: nenhum glifo, e todas as marcas ficam dentro do quadro de x 0–168
-<circle cx={118} cy={92} r={20} />
+<circle cx={118} cy={92} r={60} />
```

```mutacao
arquivo: apps/web/src/componentes/ui/onca/CenaDaOnca.tsx
teste: apps/web/src/componentes/ui/onca/CenaDaOnca.test.tsx › a onça tem 240 px, na pose `acenando`, sem `data-onca`, legenda nem selo, e está depois do cenário
-<OncaDaMarca tamanho={240} />
+<OncaDaMarca tamanho={160} />
```

```mutacao
arquivo: apps/web/src/componentes/ui/onca/CenaDaOnca.tsx
teste: apps/web/src/componentes/ui/onca/CenaDaOnca.test.tsx › o quadro da onça é o de x 184–424 e y 0–240, de frente para quem chega
-<div className="pointer-events-none absolute left-46 top-0">
+<div className="pointer-events-none absolute left-40 top-0">
```

```mutacao
arquivo: apps/web/src/componentes/ui/onca/CenaDaOnca.tsx
teste: apps/web/src/componentes/ui/onca/CenaDaOnca.test.tsx › pesa pouco: até 40 nós e 3 kB
-<rect x={208} y={288} width={192} height={12} rx={6} className="fill-onca-chao" />
+<rect x={208} y={288} width={192} height={12} rx={6} className="fill-onca-chao" /><g>{Array.from({ length: 14 }, (_, i) => <rect key={i} x={0} y={0} width={1} height={1} className="fill-white" />)}</g>
```

```mutacao
arquivo: apps/web/src/componentes/ui/onca/CenaDaOnca.tsx
teste: apps/web/src/componentes/ui/onca/CenaDaOnca.test.tsx › a lousa só tem triângulo, círculo e linha ondulada em giz: nenhum glifo, e todas as marcas ficam dentro do quadro de x 0–168
-<path d="M24 152q14-18 28 0t28 0t28 0t28 0" />
+<path d="M24 152q14-18 28 0t28 0t28 0t80 0" />
```

```mutacao
arquivo: apps/web/src/componentes/ui/onca/CenaDaOnca.tsx
teste: apps/web/src/componentes/ui/onca/CenaDaOnca.test.tsx › a lousa só tem triângulo, círculo e linha ondulada em giz: nenhum glifo, e todas as marcas ficam dentro do quadro de x 0–168
-<rect data-lousa="" x={0} y={40} width={168} height={160} rx={10} />
+<rect data-lousa="" x={0} y={40} width={190} height={160} rx={10} />
```

```mutacao
arquivo: apps/web/src/componentes/CascaPublica.tsx
teste: apps/web/src/componentes/CascaPublica.sem-cenario.test.tsx › o formulário continua, a caixa do cenário fica vazia e a onça de 88 px chega do pedaço dela
  import('./ui/onca/CenaDaOnca')
    .then(({ CenaDaOnca: peca }) => ({ default: peca }))
-    .catch(() => SEM_ONCA),
```

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-30 20:02:36 | 2026-10-30 20:03:07 | `frontend-reviewer` | 1 | APROVADO | a7e1d3d4c2af08ffb |
| 2026-10-30 20:02:44 | 2026-10-30 20:03:11 | `infra-guardian` | 1 | APROVADO | a9ff599f6980020b6 |
| 2026-10-30 20:02:40 | 2026-10-30 20:03:12 | `conformidade-reviewer` | 1 | APROVADO | aa0854187070507c3 |
| 2026-10-30 20:02:49 | 2026-10-30 20:03:20 | `tenancy-guardian` | 1 | APROVADO | a185d4597ada4fe8a |
| 2026-10-30 20:02:53 | 2026-10-30 20:03:35 | `privacy-guardian` | 1 | APROVADO | ae0dc7afc763027e9 |
| 2026-10-30 20:02:58 | 2026-10-30 20:04:14 | `revisor-geral` | 1 | APROVADO | a0d69b2684b4e7f53 |
| 2026-10-30 20:03:02 | 2026-10-30 20:04:43 | `test-engineer` | 1 | REPROVADO | a75a5678a6e509b59 |
| 2026-10-30 20:12:50 | 2026-10-30 20:13:12 | `frontend-reviewer` | 2 | APROVADO | a58c5fe832ca4cc57 |
| 2026-10-30 20:12:56 | 2026-10-30 20:13:16 | `conformidade-reviewer` | 2 | APROVADO | a22af9b2f79391e0b |
| 2026-10-30 20:13:03 | 2026-10-30 20:13:19 | `infra-guardian` | 2 | APROVADO | a4f5c0bdbaa29d2e8 |
| 2026-10-30 20:13:09 | 2026-10-30 20:13:25 | `tenancy-guardian` | 2 | APROVADO | a52663fdecb36e493 |
| 2026-10-30 20:13:15 | 2026-10-30 20:13:35 | `privacy-guardian` | 2 | APROVADO | a2af42cb5d472e54f |
| 2026-10-30 20:13:23 | 2026-10-30 20:13:55 | `revisor-geral` | 2 | APROVADO | a3393dae2ecb11fea |
| 2026-10-30 20:13:32 | 2026-10-30 20:14:10 | `test-engineer` | 2 | APROVADO | aa6b3e40010d5232a |
