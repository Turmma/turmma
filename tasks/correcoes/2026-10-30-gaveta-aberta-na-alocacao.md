# Correção — O ajudante de navegação do e2e abre a gaveta antes de a sessão chegar e depois toca na barra de baixo, que a gaveta cobre

**Origem:** esteira run 41006276434 (spec/nomes-de-mercado, job e2e 5/8)
**Subagentes obrigatórios:** `frontend-reviewer`, `infra-guardian`, `privacy-guardian`, `tenancy-guardian`, `conformidade-reviewer`
<!-- test-engineer é obrigatório em toda correção. -->

## Sintoma

`e2e/alocacao.spec.ts:85` [celular] cai nas duas tentativas, no `page.reload()` seguido de `irPelaCoordenacao(page, 'Turmas', hasTouch)`
(linha 125): `locator.tap` estoura os 90 s porque o `dialog` "Menu" da gaveta está aberto e intercepta o toque no link "Escola" da
`navigation "Seções"` (`<dialog open aria-label="Menu"> subtree intercepts pointer events`). Os outros casos do mesmo arquivo passam.

## Fora desta correção

nada

## Causa

Não é o produto: é a corrida do ajudante `irPelaNavegacao` (`e2e/__fixtures__/casca.ts`) contra o `/v1/eu`, que a correção
`2026-10-30-introducao-da-coordenacao-no-celular` (ad085a79) deixou à mostra. Depois do `page.reload()` a barra do topo, com o botão
do menu, já está na tela e os itens da navegação ainda não: a casca só os desenha com a sessão (`itens = dados === undefined ? [] : NAVEGACAO[papel]`).
O ajudante olha `Seções`, não a vê, e abre a gaveta (`abrirNavegacao`). Quando o `/v1/eu` volta, a coordenação passa a ter a barra de
baixo (X2, quatro lugares) e a gaveta, aberta, fica por cima dela, como um `dialog` modal deve ficar. Antes de ad085a79 a passagem de
"ninguém" para "alguém" fechava a gaveta sem querer, e isso escondia a corrida: o toque seguinte já achava a barra livre. Agora a gaveta
fica, o toque cai no fundo dela e o teste vence o prazo. A suspeita do pedido estava certa quanto à data; o que muda é o endereço: o
comportamento da casca da correção anterior é o certo (a pessoa que toca no menu não vê o menu sumir), e o defeito é do ajudante, que
decidia abrir a gaveta sem saber ainda se a sessão tinha chegado.

## Teste que reproduz

`e2e/casca-no-celular.spec.ts › o ajudante de navegação espera a sessão depois do recarregamento: com o /v1/eu atrasado, a gaveta não fica aberta por cima da barra de baixo`.
Uma professora entra, o `/v1/eu` é segurado por 3 s depois do `page.reload()`, e o ajudante vai a "Criados". A corrida é a da casca, a mesma
da coordenação da esteira (a barra de baixo só aparece com a sessão), e a professora entra numa tela só, o que cabe na metade do prazo do portão.
Vermelho antes (o toque é interceptado pela gaveta), verde depois.

## Correção

`irPelaNavegacao` só decide abrir a gaveta depois de a sessão chegar: quando `Seções` não está à vista e a casca está na largura do
celular, espera o nome da escola na barra do topo (que só aparece com o `/v1/eu`) e olha `Seções` de novo. Só se ela continuar fora
de vista é que abre a gaveta. Nenhuma linha de `apps/` muda.

Da rodada 1 (ordem `.processo/ordens/2026-10-30-gaveta-aberta-na-alocacao-r1.md`): o atraso do `/v1/eu` no caso novo subiu de 1,5 para 3 s,
para o vermelho sem a correção não depender de um runner folgado (a ordem sugeria 4 a 5 s, mas o caso é novo, o portão cobra dele metade dos 30 s e
com 4,5 s ele levou 17,7 e 20,9 s; com 3 s e a professora sem turma, que entra numa tela só, ele leva 12 a 13 s); os dois comentários sobre a sessão e a gaveta viraram um, no
`esperarASessaoNaBarraDoTopo`; e o `page.setDefaultTimeout` do caso ganhou a linha que avisa que vale só para aquela página.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª), privacy-guardian (1ª), frontend-reviewer (1ª), test-engineer (1ª) | O `esperarASessaoNaBarraDoTopo` acha o nome da escola por `getByRole('banner').locator('p').first()`, posicional; trocar por um alvo com rótulo próprio (`data-testid` ou nome acessível) | `TODO.md`. O alvo estável é um atributo em `apps/web/src/componentes/CascaDaEscola.tsx`, e esta correção não mexe em `apps/` (nem pede os revisores de tela e dado para isso). O frontend-reviewer conferiu que hoje há um só `<p>` no `banner` (`CascaDaEscola.tsx:339`) |
| test-engineer (1ª) | O segundo `if (!(await secoes(...).isVisible()))` de `irPelaNavegacao` não tem bloco de mutação próprio | Recusada: o próprio revisor diz que o RF17 não exige o bloco em `__fixtures__/` e que trocar por `abrirNavegacao` incondicional já deixa o teste vermelho (coberto de fato) |
| test-engineer (1ª) | Confirmar que `e2e/alocacao.spec.ts:85` [celular], o sintoma original, ficou verde na esteira, e não só o caso novo | Não é do Implementador: confere o Orquestrador no veredito da esteira da spec depois do push. O portão da tarefa só roda os specs que a árvore alterou |

## Mutações

```mutacao
arquivo: e2e/__fixtures__/casca.ts
teste: e2e/casca-no-celular.spec.ts › o ajudante de navegação espera a sessão depois do recarregamento: com o /v1/eu atrasado, a gaveta não fica aberta por cima da barra de baixo
projeto: celular
  if (!(await secoes(page).first().isVisible())) {
-    if (naGaveta(page)) await esperarASessaoNaBarraDoTopo(page)
+    if (naGaveta(page)) await Promise.resolve()
```

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-30 06:42:50 | 2026-10-30 06:43:00 | `tenancy-guardian` | 1 | APROVADO | a03a77c84bcaf4422 |
| 2026-10-30 06:42:48 | 2026-10-30 06:43:01 | `infra-guardian` | 1 | APROVADO | af0f54f9a1229f65b |
| 2026-10-30 06:42:49 | 2026-10-30 06:43:02 | `privacy-guardian` | 1 | APROVADO | ac54c940079c384fc |
| 2026-10-30 06:42:47 | 2026-10-30 06:43:07 | `frontend-reviewer` | 1 | APROVADO | a52d6c9802756f919 |
| 2026-10-30 06:42:51 | 2026-10-30 06:43:07 | `conformidade-reviewer` | 1 | APROVADO | abfc10ea272dd6add |
| 2026-10-30 06:42:52 | 2026-10-30 06:44:05 | `test-engineer` | 1 | APROVADO | ac7a2e0257bfbfc9b |
| 2026-10-30 07:02:41 | 2026-10-30 07:03:56 | `test-engineer` | 2 | APROVADO | a402dee15c03c4eff |
