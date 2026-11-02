# Correção — a pinta grande do painel da tela de entrada dá lugar à onça da marca, acenando

**Origem:** uso (D80 revista em 30/10/2026, à noite, `fd44fd75` na `develop`; plano em `docs/decisoes.md`, fim da D80, e em `docs/interface.md` 9.6, 9.7, 10.4 e 11.3)
**Subagentes obrigatórios:** `frontend-reviewer`, `conformidade-reviewer`, `infra-guardian`, `tenancy-guardian`, `privacy-guardian`, `revisor-geral`
<!-- Quem dita os guardiões é o Orquestrador, no pedido. test-engineer é obrigatório em toda correção. -->

## Sintoma

A tela de entrada (`CascaPublica`, 11.3) tem, no painel da esquerda, uma pinta grande e apagada (`turmma-pinta.svg`, 384 px a 15%).
O Joaquim achou a entrada "depressiva" e delegou a saída: a onça da marca, de corpo inteiro e acenando uma vez, no lugar da
pinta. Hoje a `Onca` não serve: ela exige `agente` e desenha o nome da função e o selo "IA" na legenda, e na entrada nenhum
agente produziu nada (regra 70, item 4a; 9.7).

## Fora desta correção

Nada. (A correção `2026-10-30-tela-de-entrar`, a pinta no centro, é a base: esta tira a pinta que ela centrou.)

## Causa

Não é defeito de código, é decisão de produto nova (D80 revista). O que faltava no código era uma peça que desenhasse a onça **sem**
legenda, nome nem selo: o desenho estava dentro da `Onca`, colado à `figcaption`.

## Teste que reproduz

- `apps/web/src/componentes/ui/onca/OncaDaMarca.test.tsx`: a figura da onça da marca não tem `figcaption`, `data-onca-assinatura`
  nem `data-selo-ia`, é `aria-hidden`, a pose é `acenando` e nenhuma animação tem `infinite`.
- `apps/web/src/componentes/ui/ia/avatar-so-nas-duas-pecas.test.ts`: só a `CascaPublica` importa a `OncaDaMarca`, e só por `import()`.
- `apps/web/src/componentes/CascaPublica.test.tsx`: o painel não tem mais a pinta, tem a onça da marca (as duas caixas e as duas figuras), e a onça escondida não gasta o aceno da introdução. Que o import é tardio, e só da `CascaPublica`, quem prova é o `avatar-so-nas-duas-pecas.test.ts`.
- `apps/web/src/componentes/CascaPublica.sem-onca.test.tsx`: com o pedaço da onça que não carrega, o formulário continua e as caixas ficam no lugar.
- `e2e/casca-publica.spec.ts`: a onça no painel a 1366 e a 1024, a de 88 px acima do formulário a 360, e nenhuma animação com
  `reducedMotion: 'reduce'`.

## Correção

A decisão é do produto (D80 revista), e o que faltava no código era uma onça **sem assinatura**. Em quatro passos:

1. **O desenho saiu da `Onca`.** `Onca.tsx` tinha o `svg` colado à `figcaption` (nome da função e selo "IA"). O `svg`, as quatro poses
   e o movimento foram para `ui/onca/DesenhoDaOnca.tsx`, sem mudar uma linha do traço (o `fidelidade-ao-mockup.test.tsx` e o
   `Onca.test.tsx` passam sem edição). A `Onca` ficou com a `figure`, o nome da função e o selo, e continua exigindo `agente`;
   ela reexporta `POSES`, `Pose` e `TamanhoDaOnca`, e quem a importava não muda.
2. **Peça nova, `ui/onca/OncaDaMarca.tsx`.** Pose `acenando` fixa (não é prop), tamanho `88 | 160`, prop `animada`. A `figure` é
   `aria-hidden`, sem `figcaption`, sem `data-onca-assinatura`, sem selo e sem nome acessível. Não há segundo traço.
3. **`CascaPublica.tsx`.** Sai o `<img turmma-pinta.svg>` do painel. De 1024 px para cima o painel fica em `bg-papel` com a
   borda de 2 px em `border-borda` (ver a troca abaixo), e a onça de 160 px, animada, fica no centro (`inset-0 m-auto`). Abaixo,
   a faixa continua em `papel` só com a marca, e a onça de 88 px, parada, vai sobre `fundo` entre o painel e o formulário (`lg:hidden`).
   Import por `React.lazy` + `Suspense` com `fallback` vazio; as duas caixas já têm o tamanho (`size-40`, `size-22`), e a página
   não pula. Saiu também o `lg:min-h-[40rem]` do painel: ele existia para a pinta de 384 px não passar por cima da marca, e a
   onça de 160 px começa a uns 170 px do topo mesmo a 1024 × 500. Nenhum texto novo (RF20 da X1).
4. **O nome do pedaço.** `nomeDoChunk` só dava `pecas-*` ao pedaço **sem fachada**; a `OncaDaMarca`, alvo de um `import()`, saía
   como `parte-OncaDaMarca-*`, que o teto do primeiro carregamento mede. Agora a fachada que é peça e só tem peças também é
   `pecas-*`, e `DesenhoDaOnca` e `OncaDaMarca` entram em `PECAS_FORA_DA_ENTRADA`. O primeiro carregamento continua abaixo de 150 kB e
   não nasce pedaço com outro nome.

Sem laço: nada de piscar, respirar ou balançar o rabo. O movimento é o que já existia (entrar em 240 ms e acenar uma vez por
sessão da página), e os dois param com `prefers-reduced-motion`. **A foto do tema claro decidiu a cor do painel.** Com o painel em `laranja-claro`
(`#FDEBDD`), a onça de 160 px a 1366 × 768 ficou sem o pé direito (creme `#FDEBDD` sobre o mesmo `#FDEBDD`: o pixel no lugar do pé
mede `253, 235, 221`, igual ao fundo) e com o esquerdo só pela sombra do chão. É a condição que o plano escreveu, e a saída também:
o painel ficou em `bg-papel` com `border-borda`, sem cor nova e sem mexer na onça, e a troca está registrada na 11.3. No tema
escuro os pés aparecem nos dois fundos.

**O que a rodada 1 mudou.** (1) **Falha do carregamento:** o `lazy` da onça leva um `.catch` que devolve uma peça que não
desenha nada (`SemOnca`); sem ele, o `import()` que rejeita (rede de escola às 7h30) subia sem fronteira de erro e desmontava a
entrada, o convite, o segundo fator e a página da turma, que usam esta casca. (2) **Mutação do nome do pedaço:** os dois blocos de
`nome-dos-chunks.ts`, que o `--faltando` não varre porque o arquivo mora na raiz de `apps/web/`. (3) **O aceno:** a onça de 160 px,
escondida pelo CSS a 360 px, também é montada e gastava o "já acenou" da página, e a entrada leva à introdução sem recarregar, então a
onça da introdução ficava sem acenar. Decidido e escrito na 9.7: **o aceno da marca é dela**, com memória separada (`DonoDoAceno`,
`movimento-da-onca.ts`); a onça escondida só gasta o da marca. (4) **Acabamento:** o `aria-hidden` ficou só na `figure` da onça; o
ponto final do comentário; `data-onca` saiu da onça da marca (só `data-onca-da-marca`), para nenhuma conta de "onça de agente" a contar.

**Cobertura.** `OncaDaMarca.test.tsx` (a figura sem assinatura e sem nome, `aria-hidden`, pose, mesmo traço da `Onca`, sem laço),
`CascaPublica.test.tsx` (sem a pinta, painel e caixas, as duas onças), `ia/avatar-so-nas-duas-pecas.test.ts` (só a `CascaPublica`
importa a `OncaDaMarca`, e só por `import()`; o desenho cru só a `Onca` e ela), `nome-dos-chunks.test.ts` (a onça cai em `pecas-*`,
fora do primeiro carregamento) e `e2e/casca-publica.spec.ts` (posição, 1366 e 1024, 88 px a 360, uma volta só, `reducedMotion`).

## Mutações

O código movido para o `DesenhoDaOnca` conta como linha nova; cada cláusula dele leva o bloco e o caso que a cobre.

```mutacao
arquivo: apps/web/src/componentes/ui/onca/DesenhoDaOnca.tsx
teste: apps/web/src/componentes/ui/onca/OncaDaMarca.test.tsx › animada, entra e acena; parada, nenhum dos dois
-return ['onca', animada ? 'onca-animada' : '', 'block shrink-0 overflow-visible'].filter(Boolean).join(' ')
+return ['onca', 'onca-animada', 'block shrink-0 overflow-visible'].filter(Boolean).join(' ')
```

```mutacao
arquivo: apps/web/src/componentes/ui/onca/DesenhoDaOnca.tsx
teste: apps/web/src/componentes/ui/onca/OncaDaMarca.test.tsx › animada, entra e acena; parada, nenhum dos dois
-if (!animada) return undefined
```

```mutacao
arquivo: apps/web/src/componentes/ui/onca/DesenhoDaOnca.tsx
teste: apps/web/src/componentes/ui/onca/movimento-da-onca.test.tsx › animada, que é o padrão: o corpo entra, e a comemorando salta em vez de entrar
-return pose === 'comemorando' ? 'onca-comemora' : 'onca-entra'
+return 'onca-entra'
```

```mutacao
arquivo: apps/web/src/componentes/ui/onca/DesenhoDaOnca.tsx
teste: apps/web/src/componentes/ui/onca/fidelidade-ao-mockup.test.tsx › os ombros das patas são os do mockup
-const ombro = lado === 'e' ? OMBRO_E : OMBRO_D
+const ombro = OMBRO_D
```

```mutacao
arquivo: apps/web/src/componentes/ui/onca/DesenhoDaOnca.tsx
teste: apps/web/src/componentes/ui/onca/fidelidade-ao-mockup.test.tsx › apontando estica o braço de 54 para 64 e mostra o lado de trás do corpo em 3/4
-const altura = longa === true ? 64 : 54
+const altura = 54
```

```mutacao
arquivo: apps/web/src/componentes/ui/onca/DesenhoDaOnca.tsx
teste: apps/web/src/componentes/ui/onca/fidelidade-ao-mockup.test.tsx › a mão é o punho, círculo da cor da pata com a almofada creme, quando o braço sai da silhueta, e creme quando cai no corpo
-{mao === 'creme' && <circle cx={ombro.x} cy={160 + altura - 12} r={14} fill={ONCA.creme} />}
```

```mutacao
arquivo: apps/web/src/componentes/ui/onca/DesenhoDaOnca.tsx
teste: apps/web/src/componentes/ui/onca/fidelidade-ao-mockup.test.tsx › a mão é o punho, círculo da cor da pata com a almofada creme, quando o braço sai da silhueta, e creme quando cai no corpo
-{mao === 'punho' && (
+{mao === 'punho' && false && (
```

```mutacao
arquivo: apps/web/src/componentes/ui/onca/DesenhoDaOnca.tsx
teste: apps/web/src/componentes/ui/onca/movimento-da-onca.test.tsx › uma pose que não acena não gasta o aceno da sessão: depois da apontando e da parada, a acenando ainda acena
-const acena = useAcenarNaPrimeiraVez(animada && pose === 'acenando', aceno)
+const acena = useAcenarNaPrimeiraVez(animada, aceno)
```

```mutacao
arquivo: apps/web/src/componentes/ui/onca/DesenhoDaOnca.tsx
teste: apps/web/src/componentes/ui/onca/fidelidade-ao-mockup.test.tsx › apontando estica o braço de 54 para 64 e mostra o lado de trás do corpo em 3/4
-{c.ladoDeTras === true && <DesenhoDoLadoDeTras clip={clip} />}
+{true && <DesenhoDoLadoDeTras clip={clip} />}
```

```mutacao
arquivo: apps/web/src/componentes/ui/onca/DesenhoDaOnca.tsx
teste: apps/web/src/componentes/ui/onca/OncaDaMarca.test.tsx › animada, entra e acena; parada, nenhum dos dois
-<DesenhoDaPata lado="d" transform={c.pataD} longa={c.pataLonga} mao={c.maoD} classe={acena && pose === 'acenando' ? 'onca-acena' : undefined} />
+<DesenhoDaPata lado="d" transform={c.pataD} longa={c.pataLonga} mao={c.maoD} classe={pose === 'acenando' ? 'onca-acena' : undefined} />
```

```mutacao
arquivo: apps/web/src/componentes/ui/onca/DesenhoDaOnca.tsx
teste: apps/web/src/componentes/ui/onca/movimento-da-onca.test.tsx › os três pontos do `pensando` ficam parados: existem só nessa pose e não levam classe nenhuma
-{c.balao === true && <DesenhoDoBalao />}
+{true && <DesenhoDoBalao />}
```

```mutacao
arquivo: apps/web/src/componentes/ui/onca/DesenhoDaOnca.tsx
teste: apps/web/src/componentes/ui/onca/Onca.test.tsx › só a acenando leva as duas linhas ao lado da pata, e elas são traço parado
-{c.linhasDoAceno === true && <DesenhoDasLinhasDoAceno />}
+{true && <DesenhoDasLinhasDoAceno />}
```

```mutacao
arquivo: apps/web/src/componentes/ui/onca/movimento-da-onca.ts
teste: apps/web/src/componentes/ui/onca/movimento-da-onca.test.tsx › o aceno da marca e o do agente são memórias separadas
-const [acena] = useState(() => acenando && !reduzMovimento() && !jaAcenou[dono])
+const [acena] = useState(() => acenando && !reduzMovimento() && !jaAcenou.agente)
```

```mutacao
arquivo: apps/web/src/componentes/ui/onca/movimento-da-onca.ts
teste: apps/web/src/componentes/ui/onca/movimento-da-onca.test.tsx › o aceno da marca e o do agente são memórias separadas
-if (acena) jaAcenou[dono] = true
+if (acena) jaAcenou.agente = true
```

```mutacao
arquivo: apps/web/src/componentes/ui/onca/OncaDaMarca.tsx
teste: apps/web/src/componentes/CascaPublica.test.tsx › a onça da marca, mesmo a escondida pelo CSS a 360 px
-<DesenhoDaOnca pose="acenando" tamanho={tamanho} animada={animada} aceno="marca" />
+<DesenhoDaOnca pose="acenando" tamanho={tamanho} animada={animada} aceno="agente" />
```

```mutacao
arquivo: apps/web/src/componentes/CascaPublica.tsx
teste: apps/web/src/componentes/CascaPublica.sem-onca.test.tsx › o formulário continua na tela, e as duas caixas ficam no lugar, vazias
-.catch(() => SEM_ONCA),
```

```mutacao
arquivo: apps/web/nome-dos-chunks.ts
teste: apps/web/nome-dos-chunks.test.ts › o pedaço com fachada que é peça e só tem peças é pecas-
-if (ehPecaForaDaEntrada(fachada) && soTemPecas(modulos ?? [fachada])) return 'assets/pecas-[name]-[hash].js'
```

```mutacao
arquivo: apps/web/nome-dos-chunks.ts
teste: apps/web/nome-dos-chunks.test.ts › o pedaço com fachada que é peça e só tem peças é pecas-
-if (ehPecaForaDaEntrada(fachada) && soTemPecas(modulos ?? [fachada])) return 'assets/pecas-[name]-[hash].js'
+if (ehPecaForaDaEntrada(fachada) && true) return 'assets/pecas-[name]-[hash].js'
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| frontend-reviewer (1ª) | "o pé direito da onça é creme sobre `papel` e se lê pouco… pode escurecer só a sombra do chão ou o contorno do pé, num ajuste à parte e sem segundo traço" | Recusada: o revisor a chama de legível e de ajuste à parte, e mexer no traço fere `fidelidade-ao-mockup.test.tsx`; a troca para `papel` já foi o ajuste que a foto pediu (11.3) |
| infra-guardian (1ª) | `Cache-Control` longo e `immutable` para `assets/*-[hash].js` no servidor da web (`infra/Caddyfile` não o define) | `TODO.md`: `infra/` não é arquivo desta correção, e a conferência de onde a web é servida é trabalho próprio |
| infra-guardian (1ª) | as duas onças montadas, uma escondida só por CSS | Resolvida pelo item 3: a escondida só gasta o aceno da marca, e a introdução ainda acena |
| conformidade-reviewer (1ª) | o teste de `CascaPublica` confere o especificador exato `'./ui/onca/OncaDaMarca'` | Sem ação: o revisor diz que reprovar na mudança de pasta "é certo" e só pede que se lembre de que a lista `QUEM_IMPORTA_A_ONCA_DA_MARCA` se mexe com parecer |
| conformidade-reviewer (1ª) | uma linha na AIA ou no dossiê dizendo que a mascote da marca não é agente nem saída de IA | `TODO.md`: `docs/aia/` e `docs/conformidade-mec.md` não são arquivos desta correção |
| test-engineer (1ª) | levar à retro o ponto cego de `mutacoes.ts --faltando` (os `.ts` da raiz de `apps/web/` ficam fora da varredura) | Retro desta correção e `TODO.md` |
| test-engineer (1ª) | e2e de "reduzir movimento" também a 360 px | Recusada: `e2e/casca-publica.spec.ts` já avisa na linha 152 que "quatro `goto` levavam 11 s, perto dos 15 s do portão", e o unitário já prova que a de 88 px não leva `onca-animada`; o revisor diz que não bloqueia |
| revisor-geral (1ª) | a D80 revista em `docs/decisoes.md` ainda descreve o painel em `laranja-claro` | `TODO.md`: revisão de decisão se escreve pela skill `registrar-decisao`, e `docs/decisoes.md` não é arquivo desta correção |
| revisor-geral (1ª) | mutação para `ehPecaForaDaEntrada(fachada) && soTemPecas(...)` | Resolvida pelo item 2: dois blocos em "Mutações" |
| revisor-geral (1ª) | encurtar o comentário de cabeçalho da `CascaPublica` (linhas 11-34), que repete a 11.3 | Recusada: reescrever o comentário não é barato nem muda nada, e o item 3 e o 4b já mexem nele; fica para quando o texto da 11.3 estabilizar |
| infra-guardian (2ª) | tentar o `import()` uma segunda vez antes de cair no `SemOnca` (o `lazy` guarda a falha da primeira tentativa) | Recusada: o revisor a chama de aceitável porque a onça é enfeite, e a nova tentativa muda comportamento |
| infra-guardian (2ª) | registrar um evento sem dado pessoal quando a onça não carrega (por exemplo `casca.onca.falhou`) | `TODO.md`: depende de a web já ter um canal de erro do front, e criar um é trabalho próprio |
| infra-guardian (2ª), frontend-reviewer (2ª), conformidade-reviewer (2ª) | `Cache-Control` longo e `immutable` para `assets/*-[hash].js`; linha na AIA e no dossiê sobre a mascote; D80 revista ainda em `laranja-claro`; e2e de "reduzir movimento" a 360 px | Já têm destino na tabela da rodada 1 (`TODO.md` e recusa com motivo) |
| conformidade-reviewer (2ª) | nenhum teste ou guarda impede que um componente fora da casca volte a pôr `data-onca` na onça da marca | `TODO.md`: guarda própria, fora desta correção; hoje só `OncaDaMarca.test.tsx:45` prova a ausência, e a lista fechada de `avatar-so-nas-duas-pecas.test.ts` já limita quem importa a peça |
| revisor-geral (2ª) | juntar os dois blocos JSDoc seguidos de `movimento-da-onca.ts` (o primeiro ficou solto no tipo) | `TODO.md`: acabamento de comentário; entra quando outra tarefa tocar o arquivo |
| revisor-geral (2ª) | `docs/interface.md:1172` ainda diz "na primeira vez desde que a página abriu"; remeter à linha 1235 | `TODO.md`: entra na próxima revisão da 9.7 |
| revisor-geral (2ª), test-engineer (2ª) | a mensagem `'a marca gasta já foi para o agente'` em `OncaDaMarca.test.tsx` não diz o que confere | `TODO.md`: acabamento de mensagem de teste |
| revisor-geral (2ª) | a onça de 160 px continua montada no celular e gasta o aceno da marca sem ninguém ver; se a janela passar de 1024 px depois, a que aparece não acena | `TODO.md`: sem efeito hoje (o revisor diz que não faz diferença) e registrado caso a marca passe a acenar também no celular |
| test-engineer (2ª) | e2e com `page.route('**/assets/pecas-*OncaDaMarca*.js', r => r.abort())` em `/entrar`, para provar a falha no navegador com o nome real do pedaço | `TODO.md`: cobertura extra, o unitário já prova a regra (o revisor o diz); `e2e/casca-publica.spec.ts` já está perto do prazo |
| test-engineer (2ª) | com o bloco que apaga o `.catch`, `SEM_ONCA` fica sem uso e um `noUnusedLocals` o acusaria | Sem ação: o revisor diz que não muda o resultado da mutação, e o portão local já a passou vermelha |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-30 20:14:03 | 2026-10-30 20:14:17 | `tenancy-guardian` | 1 | APROVADO | ae0ec02e3165d967f |
| 2026-10-30 20:13:51 | 2026-10-30 20:14:25 | `frontend-reviewer` | 1 | APROVADO | a093d3661eba62cf9 |
| 2026-10-30 20:13:59 | 2026-10-30 20:14:35 | `infra-guardian` | 1 | APROVADO | adafd0fd1aae1bfea |
| 2026-10-30 20:14:07 | 2026-10-30 20:14:39 | `privacy-guardian` | 1 | APROVADO | a08e7fd7de5d2d560 |
| 2026-10-30 20:13:55 | 2026-10-30 20:14:43 | `conformidade-reviewer` | 1 | APROVADO | acdacb6edc6bb4199 |
| 2026-10-30 20:13:47 | 2026-10-30 20:15:48 | `test-engineer` | 1 | REPROVADO | a7a3ee6696fdcd2e1 |
| 2026-10-30 20:14:11 | 2026-10-30 20:16:13 | `revisor-geral` | 1 | REPROVADO | a03b6b2cc2e27bc5b |
| 2026-10-30 20:35:13 | 2026-10-30 20:35:34 | `frontend-reviewer` | 2 | APROVADO | abadebf695294fdf2 |
| 2026-10-30 20:35:26 | 2026-10-30 20:35:42 | `infra-guardian` | 2 | APROVADO | ad571bc12d90f0ce1 |
| 2026-10-30 20:35:32 | 2026-10-30 20:35:46 | `tenancy-guardian` | 2 | APROVADO | a6c1915fec6df64fb |
| 2026-10-30 20:35:19 | 2026-10-30 20:35:50 | `conformidade-reviewer` | 2 | APROVADO | a25821e6a311fc172 |
| 2026-10-30 20:35:07 | 2026-10-30 20:35:57 | `revisor-geral` | 2 | APROVADO | aa046e9482feca67b |
| 2026-10-30 20:35:39 | 2026-10-30 20:36:00 | `privacy-guardian` | 2 | APROVADO | a3430868d38bf4480 |
| 2026-10-30 20:34:57 | 2026-10-30 20:36:04 | `test-engineer` | 2 | APROVADO | a7d73114788b216cd |
