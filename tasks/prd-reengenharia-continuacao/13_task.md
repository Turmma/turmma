# Tarefa 13.0 — Uma tela que quebra fora de uma área mostra a falha com o caminho de volta (56.0)

**Funcionalidade:** reengenharia-continuacao · **Depende de:** nenhuma
**Subagentes obrigatórios:** `frontend-reviewer`
**Porte:** pequeno

## Objetivo

Um componente que lança numa rota sem área (entrada, sala pública, troca de senha, sistema) mostra a `Falha` de página
inteira, com texto próprio, em vez da página branca. A `Falha` ganha "Voltar ao início", que leva a `/` (na operação, a
`/operacao`) e limpa a fronteira, ao lado do "Tentar de novo" de hoje.

## Contexto necessário

- `techspec.md` §5 "A web (52.0, 56.0)" (a parte da fronteira), §9
- `prd.md` RF12
- `docs/interface.md`: a tela de falha; `.claude/rules/` 40, 50
- Código: `apps/web/src/components/AreaErrorBoundary.tsx` (`Falha`, l.30; o `Button` que recarrega, l.47; `paginaInteira`,
  l.52; a classe, l.63); `apps/web/src/routes.tsx` (`AppRoutes`, l.190, e o `<Switch>` dele); `apps/web/src/components/drawer-context.ts`;
  `apps/web/src/components/ui/` (o botão secundário)

## Subtarefas

- [x] 13.1 — `AreaErrorBoundary paginaInteira`, com título e texto próprios, em volta do `<Switch>` de `AppRoutes`, sem casca
  e com o `DrawerContext` padrão
- [x] 13.2 — "Voltar ao início" na `Falha`: `<a href="/">` (recarrega a página e limpa a fronteira), secundário, 44 px; na
  operação, `/operacao`. Os dois botões quebram em linha sem cortar texto a 360 px
- [x] 13.3 — `docs/interface.md`: a Parte A da tela de falha
- [x] 13.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/components/AreaErrorBoundary.test.tsx`, `e2e/tela-de-falha.spec.ts` | novo |
| `apps/web/src/components/AreaErrorBoundary.tsx`, `apps/web/src/routes.tsx`, `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| fora de área | U | componente que lança na raiz, um caso por rota sem área (entrada, sala pública, troca de senha, sistema): a `Falha` aparece, sem casca. Mutação: tirar a fronteira do `<Switch>` | `AreaErrorBoundary.test.tsx` › "%s: a Falha de página inteira, com os dois botões, e nenhuma casca" (`it.each`: a entrada, a sala pública, a troca da senha provisória e o estado do sistema) |
| volta | U | o clique em "Voltar ao início" leva a `/`, e a tela sai da `Falha` | `AreaErrorBoundary.test.tsx` › "o "Voltar ao início" é um link comum para a raiz…" (o link e o clique não impedido); a saída da `Falha` é do `e2e/tela-de-falha.spec.ts` › "volta: o "Voltar ao início" leva a / e a tela sai da Falha" |
| operação | U | na `/operacao`, o destino é `/operacao`. Mutação: o destino fixo `/` | `AreaErrorBoundary.test.tsx` › "na operação, o "Voltar ao início" leva ao início da operação"; `e2e/tela-de-falha.spec.ts` › "operação: …" |
| dentro de área | U | a fronteira da área continua a que pega primeiro: a casca fica | `AreaErrorBoundary.test.tsx` › "dentro de uma área, a fronteira da área pega primeiro…" |
| a prova não perde resposta | U | a `Falha` no meio da atividade: a fila de respostas guardada no espelho continua lá depois do "Voltar ao início" | `AreaErrorBoundary.test.tsx` › "a escolha guardada no espelho continua lá depois do "Voltar ao início"" |
| texto | U | sem termo técnico; `VOCABULARIO_DE_NOTA` não casa | `AreaErrorBoundary.test.tsx` › "o texto da falha é em português comum…" |
| 1366 × 768 | E | `paginaNaoRola`, os dois botões visíveis | `e2e/tela-de-falha.spec.ts` › "a medida: 1366 × 768 sem rolar e com os dois botões à vista; 360 px com os botões em linha quebrada, sem corte e com 44 px" |
| 360 px | E | os dois botões sem cortar texto, alvos de 44 px (o `min-height` lido no estilo), sem rolagem horizontal, axe; a 280 px o segundo desce para a linha de baixo sem passar da janela. A falha vem de `page.route` (resposta que quebra o componente), sem gancho no build de produção | `e2e/tela-de-falha.spec.ts` › "a medida: 1366 × 768 …; 360 px …" (o ramo do celular) |
| foco | E | a `Falha` recebe o foco no título | `e2e/tela-de-falha.spec.ts` › "foco: a Falha assume a página com o foco no título…" |

## Como testar

- Fronteira: não há teste de `AreaErrorBoundary`; o mais próximo é `apps/web/src/components/CascaDaEscola.test.tsx` (montagem
  com rotas e `wouter`); lance de dentro de um componente de teste
- Fila de respostas: `apps/web/src/areas/aluno/espelho-da-fila.test.ts` (o espelho que guarda a fila)
- e2e: `e2e/casca-no-celular.spec.ts` como forma do 360 px; `e2e/support/coordenacao.ts` (`paginaNaoRola`)
- Comandos: `npx vitest run --project unidade apps/web/src/components/AreaErrorBoundary.test.tsx`;
  `node tools/ci/e2e.ts --manter-ambiente e2e/tela-de-falha.spec.ts`
- **Telas:** sem papel, `/entrar` com um componente que lança (via `page.route`); `operacao`, `/operacao` idem

## Autoconferência

As 12 perguntas do modelo, no plano. Na 2: `grep -rln 'Voltar ao início' e2e/`. Na 5: a ausência da casca depois de a
`Falha` aparecer.

### Respostas da autoconferência (plano)

1. **Mutação de cada cláusula:** um bloco por cláusula na seção "Mutações": a fronteira de fora (tirá-la, tirar o `paginaInteira`, trocar o
   texto da área pelo da área de fora), o título da aba, o texto sem termo técnico e sem vocabulário de nota (um bloco por negativa, com
   `falha:`), o `voltarPara` da operação, o destino padrão, o `href` fixo, o link que vira botão, e os dois do e2e do celular (a classe do
   botão secundário e o `flex-wrap`). O `RouteSwitch` só moveu o corpo do `<Switch>` (sem linha nova com condição).
2. **Texto na tela:** "Esta tela não abriu", o texto da falha e "Voltar ao início" são novos. `grep -rln 'Voltar ao início' e2e/` acha só o
   `tela-de-falha.spec.ts`, que é o da tarefa; `grep -rln 'Esta tela não abriu' e2e apps docs` acha só os arquivos da tarefa e o `dist/` do
   build. Os outros specs que citam "Tentar de novo" são do `ErrorState`, que não mudou.
3. **Segundo dado:** o caso da operação e o das rotas de fora têm destinos diferentes (`/operacao` e `/`), e a área do professor é o terceiro
   (a falha de dentro, com a casca e o destino `/`): trocar o destino fixo, ou o padrão, deixa um dos três vermelho.
4. **Checagem anterior que responde antes:** a `Falha` só aparece se o componente lança de verdade: o `it.each` confere também que o React
   avisou o console do erro que a fronteira pegou, e a sessão é a de `setupScreen` (aberta), então a `Entrada` não redireciona antes de lançar.
   No e2e, a `Falha` só sai da hora que não formata (`addInitScript` só em `/sistema`) e do chunk que lança (`page.route`), com a resposta da API válida.
5. **Asserção de ausência:** "sem casca" (`navigation`, o nome da pessoa e a ausência de `/v1/eu`) só vale depois de a `Falha` estar na tela
   (`findByRole` do título vem antes); o controle positivo é o caso da área do professor, que mostra a casca (`Camila Souza`) com a falha dentro.
   No e2e, "a tela sai da `Falha`" espera a entrada aparecer antes de contar zero títulos.
6. **Guarda nova:** nenhuma.
7. **Comentários:** o docblock da `Falha` (fecha a gaveta, foco), o da fronteira e o `voltarPara` dizem o que o código faz: o link recarrega a
   página, e é a página nova que limpa o `state` da fronteira.
8. **Divergências:** três linhas abaixo, com a palavra do código (`RouteSwitch`, `voltarPara`, `addInitScript`) na `techspec.md` §5 ("A web") e no
   `cenarios.md` §7. O `prd.md` (RF12) pede "um componente que lança na raiz" e a tela de falha com o caminho de volta, e não diz o contrário.
9. **Peça que já existe:** `SECONDARY_LINK_CLASSES` (o link com a cara do botão secundário), `Button`, `DrawerContext`, `useTabTitle`,
   `fakeNetwork`, `setupScreen`, `paginaNaoRola`, `seriousViolations`. Nada copiado.
10. **Concorrência:** a tarefa não tem operação concorrente nem resposta fora de ordem.
11. **Linha → caso:** coluna "Caso" da tabela preenchida; o isolamento entre escolas não se aplica (só a web, sem repository nem rota).
12. **O que verificar dos guardiões:** `frontend-reviewer` (os quatro estados: a falha tem o texto que diz o que fazer e os dois caminhos de
    volta; 44 px; 360 px; a página não rola a 1366 × 768; foco no título; sem termo técnico). O `achados/indice.md` não tem linha sobre a
    fronteira de erro.

## Fora do escopo desta tarefa

O prazo das chamadas (12.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| `AppRoutes` devolve a fronteira em volta de `<RouteSwitch />`, e o `<Switch>` com as rotas passa a ser o componente `RouteSwitch` (em vez de a fronteira entrar dentro do `AppRoutes`, em volta do `<Switch>`) | O efeito é o mesmo (a fronteira envolve o `<Switch>`); com o `RouteSwitch`, o corpo do `<Switch>` não muda de recuo e o diff leva só a fronteira nova, que é o que a mutação e a revisão leem | `techspec.md` §5, "A web (52.0, 56.0)"; `cenarios.md` §7 |
| O clique em "Voltar ao início" que sai da `Falha` é prova do e2e; o unitário prova o link (`href`, `<a>`, clique não impedido) | O link recarrega a página, e o `jsdom` não navega: a "tela sai da `Falha`" só existe no navegador (`e2e/tela-de-falha.spec.ts` › volta) | `techspec.md` §5, "A web (52.0, 56.0)"; `cenarios.md` §7 |
| A quebra em linha dos dois botões se prova a 280 px (celular dobrável fechado), e não a 360 px; os 44 px se leem no `min-height` do estilo, e não só na altura da caixa. Os critérios de 360 px (sem corte, sem rolagem horizontal, alvo de 44 px) seguem lidos lá | O portão achou as duas mutações do celular verdes. O link sem a classe herda os 48 px do irmão pelo `stretch`, então a altura medida não prova o alvo; e o caso de 360 px não lê a posição do segundo botão (a 360 px os dois já quebram: 173 e 181 px, mais o vão de 12 px, passam dos 328 px), então a mutação do `flex-wrap` não cai nele, e a 280 px cai. A conta de "290 px em 328" da primeira versão desta linha saiu de uma sonda com o link sem a classe, e foi trocada pela medida do código real | `techspec.md` §5, "A web (52.0, 56.0)"; `cenarios.md` §7 |
| A falha do e2e vem do estado do sistema (`/sistema`, com o `Intl` do navegador lançando só ali, por `addInitScript`, e a resposta válida por `page.route`) e da operação (o chunk trocado por um módulo que lança), e não de `/entrar` com resposta que quebra o componente | O esquema da resposta valida tudo (data e enum), então nenhuma resposta válida faz uma tela da entrada lançar; o gancho fica no teste, e não no build de produção | `cenarios.md` §7 (o [E] da `Falha` fora de área) |

## Mutações

--faltando: 0 linhas (11 blocos, 0 motivos). Cada bloco tira uma cláusula do diff e aponta o caso que cai com ela. As negativas do texto
(`not.toMatch(VOCABULARIO_DE_NOTA)` e `not.toMatch(TERMO_TECNICO)`) levam o `falha:`; os dois do celular levam `projeto: celular` e rodam no e2e.
O `RouteSwitch` só moveu o corpo do `<Switch>`, e a `Falha` por dentro (o foco, o título da aba, a gaveta) é a de antes.
A ausência de "Operação Turmma" depois da volta (`e2e/tela-de-falha.spec.ts` › operação, a ordem da 1ª rodada) é asserção de teste: não há
cláusula de produção a mutar, e ela só vale depois de a entrada aparecer (a `Falha` é a página inteira, e some com a página nova).

**`AppRoutes`: a fronteira de fora em volta das rotas (sem ela, o componente que lança derruba a página)**

```mutacao
arquivo: apps/web/src/routes.tsx
teste: apps/web/src/components/AreaErrorBoundary.test.tsx › a entrada: a Falha de página inteira, com os dois botões, e nenhuma casca
  return (
-    <AreaErrorBoundary {...FALHA_FORA_DE_AREA} paginaInteira>
-      <RouteSwitch />
-    </AreaErrorBoundary>
+    <RouteSwitch />
  )
```

**`AppRoutes`: a fronteira de fora é de página inteira, sem casca**

```mutacao
arquivo: apps/web/src/routes.tsx
teste: apps/web/src/components/AreaErrorBoundary.test.tsx › a entrada: a Falha de página inteira, com os dois botões, e nenhuma casca
-    <AreaErrorBoundary {...FALHA_FORA_DE_AREA} paginaInteira>
+    <AreaErrorBoundary {...FALHA_FORA_DE_AREA} paginaInteira={false}>
      <RouteSwitch />
```

**`AppRoutes`: a fronteira de fora leva o texto próprio, e não o da área**

```mutacao
arquivo: apps/web/src/routes.tsx
teste: apps/web/src/components/AreaErrorBoundary.test.tsx › a entrada: a Falha de página inteira, com os dois botões, e nenhuma casca
-    <AreaErrorBoundary {...FALHA_FORA_DE_AREA} paginaInteira>
+    <AreaErrorBoundary {...FALHA_DA_AREA} paginaInteira>
      <RouteSwitch />
```

**`FALHA_FORA_DE_AREA`: o título da aba**

```mutacao
arquivo: apps/web/src/routes.tsx
teste: apps/web/src/components/AreaErrorBoundary.test.tsx › a entrada: a Falha de página inteira, com os dois botões, e nenhuma casca
-  tituloDaAba: tituloDaEscola('Esta tela não abriu'),
+  tituloDaAba: tituloDaEscola('Não foi possível carregar'),
   titulo: 'Esta tela não abriu',
```

**`FALHA_FORA_DE_AREA`: o texto não usa o vocabulário de nota**

```mutacao
arquivo: apps/web/src/routes.tsx
teste: apps/web/src/components/AreaErrorBoundary.test.tsx › o texto da falha é em português comum: sem termo técnico e sem o vocabulário de nota
falha: not.toMatch(VOCABULARIO_DE_NOTA)
   titulo: 'Esta tela não abriu',
-  texto: 'Algo saiu do esperado ao mostrar esta tela. Tente de novo ou volte ao início.',
+  texto: 'A nota não apareceu nesta tela. Tente de novo ou volte ao início.',
```

**`FALHA_FORA_DE_AREA`: o texto não tem termo técnico**

```mutacao
arquivo: apps/web/src/routes.tsx
teste: apps/web/src/components/AreaErrorBoundary.test.tsx › o texto da falha é em português comum: sem termo técnico e sem o vocabulário de nota
falha: not.toMatch(TERMO_TECNICO)
   titulo: 'Esta tela não abriu',
-  texto: 'Algo saiu do esperado ao mostrar esta tela. Tente de novo ou volte ao início.',
+  texto: 'Erro 500 ao mostrar esta tela. Tente de novo ou volte ao início.',
```

**A operação leva o "Voltar ao início" a `/operacao`**

```mutacao
arquivo: apps/web/src/routes.tsx
teste: apps/web/src/components/AreaErrorBoundary.test.tsx › na operação, o "Voltar ao início" leva ao início da operação
           paginaInteira
-          voltarPara={BASE_DA_OPERACAO}
         >
```

**`Falha`: o destino de quem não diz é a raiz da escola**

```mutacao
arquivo: apps/web/src/components/AreaErrorBoundary.tsx
teste: apps/web/src/components/AreaErrorBoundary.test.tsx › o "Voltar ao início" é um link comum para a raiz: o clique não é impedido, e a página nova limpa a fronteira
-function Falha({ tituloDaAba, titulo, texto, paginaInteira = false, voltarPara = ROUTES.inicio }: PropsDaFalha) {
+function Falha({ tituloDaAba, titulo, texto, paginaInteira = false, voltarPara = '/operacao' }: PropsDaFalha) {
```

**`Falha`: o link vai ao destino que a fronteira disse (a operação), e não a um fixo**

```mutacao
arquivo: apps/web/src/components/AreaErrorBoundary.tsx
teste: apps/web/src/components/AreaErrorBoundary.test.tsx › na operação, o "Voltar ao início" leva ao início da operação
-        <a href={voltarPara} className={SECONDARY_LINK_CLASSES}>
+        <a href="/" className={SECONDARY_LINK_CLASSES}>
           Voltar ao início
```

**`Falha`: o "Voltar ao início" é um link, e a página nova limpa a fronteira (e não um botão que só muda de rota)**

```mutacao
arquivo: apps/web/src/components/AreaErrorBoundary.tsx
teste: apps/web/src/components/AreaErrorBoundary.test.tsx › o "Voltar ao início" é um link comum para a raiz: o clique não é impedido, e a página nova limpa a fronteira
-        <a href={voltarPara} className={SECONDARY_LINK_CLASSES}>
+        <button type="button" className={SECONDARY_LINK_CLASSES}>
           Voltar ao início
-        </a>
+        </button>
```

**`Falha`: o link leva o contorno e os 44 px do botão secundário**

```mutacao
arquivo: apps/web/src/components/AreaErrorBoundary.tsx
teste: e2e/tela-de-falha.spec.ts › a medida: 1366 × 768 sem rolar e com os dois botões à vista; 360 px com os botões em linha quebrada, sem corte e com 44 px
projeto: celular
-        <a href={voltarPara} className={SECONDARY_LINK_CLASSES}>
+        <a href={voltarPara}>
           Voltar ao início
```

**`Falha`: os dois botões quebram em linha (sem o `flex-wrap`, a 280 px o segundo passa da janela)**

```mutacao
arquivo: apps/web/src/components/AreaErrorBoundary.tsx
teste: e2e/tela-de-falha.spec.ts › a medida: 1366 × 768 sem rolar e com os dois botões à vista; 360 px com os botões em linha quebrada, sem corte e com 44 px
projeto: celular
-      <div className="flex flex-wrap gap-3 self-start">
+      <div className="flex gap-3 self-start">
         <Button onClick={() => window.location.reload()}>Tentar de novo</Button>
```

## Recomendações sem aplicar

Da rodada 1 (`.processo/ordens/13_task-r1.md`):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| frontend-reviewer (1ª) | Centralizar a falha de página inteira na vertical, ou pôr o logotipo da Turmma no topo (`AreaErrorBoundary.tsx:63`) | Recusada nesta tarefa: muda a aparência da tela de falha, que o RF12 e a `techspec.md` §5 definem sem logotipo nem alinhamento vertical; vai para `TODO.md` |
| frontend-reviewer (1ª) | A falha dentro de uma área, com a casca de pé, só tem prova unitária; vale uma foto | Validador: fotografar a falha dentro de uma área no fim da spec, junto das telas dos RFs |
| infra-guardian (1ª) | Caso de e2e que recarrega a página de verdade e confere que a fila de respostas é reenviada depois | `TODO.md`: e2e de atividade com a `Falha` no meio, junto do espelho da fila (a tarefa que mexer em `espelho-da-fila.ts`); é caso novo de e2e, mais que poucas linhas |
| infra-guardian (1ª) | A tela de falha não registra no servidor que uma tela quebrou | `TODO.md`: observabilidade da web (com runbook se ganhar alerta); é endpoint e contrato novos, fora do RF12 |
| privacy-guardian (1ª) | Conferir que sair da sessão limpa o espelho da fila no `sessionStorage` (computador da escola com vários alunos, D43) | `TODO.md`: conferir no fim da sessão do aluno; não é desta tarefa, que não mexe em sessão nem no espelho |
| revisor-geral (1ª) e test-engineer (1ª) | O caso "a escolha guardada no espelho continua lá…" prova pouco: o `jsdom` não navega e a fronteira é montada solta | O mesmo destino da linha do `infra-guardian` (e2e que recarrega de verdade); a tarefa já registra que a prova no navegador é do e2e (divergência 2); fica para o Validador conferir |
| test-engineer (1ª) | O `it.each` cobre 4 das rotas sem área; as outras (mfa, convite, esqueci a senha, redefinir, verificar, escolher a escola, não encontrada) ficam de fora | Retrospectiva da spec: a fronteira envolve o `<Switch>` inteiro e a mutação que a tira já fica vermelha; sem caso por rota |

Da rodada 2 (`.processo/ordens/13_task-r2.md`):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (2ª) | A asserção nova de `e2e/tela-de-falha.spec.ts:118` repete a da l. 116 ("Entrar na operação" visível já diz que a falha saiu) | Mantida: deixa a intenção explícita, e aprovou quem a leu; sem custo |
| test-engineer (2ª) | A nota de `docs/interface.md` seção 6 (a volta da própria `/entrar` reaparece a falha) não tem teste | Sem teste: é descrição de comportamento, não promessa; se virar promessa, entra caso |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-15 20:05:30 | 2026-11-15 20:05:41 | `tenancy-guardian` | 1 | APROVADO | a3b14fb479945d03a |
| 2026-11-15 20:05:21 | 2026-11-15 20:05:47 | `frontend-reviewer` | 1 | APROVADO | ae6d640d34457d330 |
| 2026-11-15 20:05:38 | 2026-11-15 20:05:59 | `infra-guardian` | 1 | APROVADO | afa5c0daef5c93d36 |
| 2026-11-15 20:05:32 | 2026-11-15 20:06:01 | `privacy-guardian` | 1 | APROVADO | ad65b75a6b41bb233 |
| 2026-11-15 20:05:35 | 2026-11-15 20:06:03 | `conformidade-reviewer` | 1 | APROVADO | a4b6386ebf33931e5 |
| 2026-11-15 20:05:27 | 2026-11-15 20:06:18 | `revisor-geral` | 1 | APROVADO | a90b4d318bc811a67 |
| 2026-11-15 20:05:24 | 2026-11-15 20:06:29 | `test-engineer` | 1 | APROVADO | a4df105cf28af1dad |
| 2026-11-15 20:20:14 | 2026-11-15 20:20:44 | `test-engineer` | 2 | APROVADO | aec9983835ff4150d |
| 2026-11-15 20:20:32 | 2026-11-15 20:21:05 | `revisor-geral` | 2 | APROVADO | ab8445fd62d46f053 |
