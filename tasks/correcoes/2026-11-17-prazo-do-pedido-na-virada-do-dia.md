# Correção — o e2e do prazo do pedido calcula o dia de hoje em outro instante que a tela e o banco, e na virada da meia-noite de São Paulo os três discordam

**Origem:** esteira run 44004811034 (e2e de 4/11, 03:00 UTC = meia-noite em Brasília); `e2e/pedido-do-titular.spec.ts:120` `[chromebook]`: esperava `Faltam 4 dias, até 21/11/2026` e a tela deu `Faltam 3 dias, até 20/11/2026`
**Subagentes obrigatórios:** `privacy-guardian`, `test-engineer`, `revisor-geral`, `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian`

## Sintoma

```
esperava: "Faltam 4 dias, até 21/11/2026"
recebeu:  "Faltam 3 dias, até 20/11/2026"
 ❯ e2e/pedido-do-titular.spec.ts:139
```

O caso passa o dia inteiro e cai só na corrida que cruza a meia-noite de São Paulo. O mesmo padrão está em `e2e/pedido-do-titular.spec.ts` (linhas 139, 155 e 466) e em `e2e/pedidos-do-titular.spec.ts` (linhas 662 a 664, 692, 764 e 767).

## Fora desta correção

nada

## Causa

É o teste. Três relógios entram na conta do prazo e o teste os supõe no mesmo dia:

1. o **banco** grava `chegou_em` no instante da semeadura (`(now() at time zone 'America/Sao_Paulo')::date - chegouHaDias`, em `e2e/support/seed.ts`);
2. a **tela** conta `Faltam N` a partir do dia em que é lida (`hojeEmSaoPaulo()`, no navegador);
3. o **teste** monta o texto esperado com `somarDiasAHoje(4)`, que lê o dia no instante da asserção.

O vencimento (`chegou_em + 15`) é fixo desde a semeadura, mas `Faltam N` anda um dia na meia-noite. Na corrida de 4/11 a semeadura caiu antes da meia-noite (vencimento 20/11) e a leitura da tela e a conta do teste caíram depois: a tela, no dia 17, disse `Faltam 3`, e o teste, que soma ao dia de depois da virada, esperou `até 21/11`. O código de produção está certo: a conta da tela é a do dia em que ela é lida, e o vencimento não muda.

## Teste que reproduz

`tools/ci/prazo-do-pedido-no-e2e.test.ts` (o vitest ignora `e2e/**`, e o ajudante é puro). Dois casos, `aceita a leitura do mesmo dia e a da virada, com o mesmo vencimento` e `recusa a combinação que a conta antiga esperava depois da virada: o vencimento não anda com o relógio`: a semeadura é `2026-11-03`; o primeiro exige que o texto esperado aceite a tela lida no mesmo dia (`Faltam 4 dias, até 07/11/2026`) e na virada (`Faltam 3 dias, até 07/11/2026`); o segundo, que recuse a combinação da esteira (`Faltam 4 dias, até 08/11/2026`, a da conta antiga, com o vencimento andando). Vermelho antes: o ajudante primeiro nasceu com a conta antiga (o dia de hoje no instante da asserção), e 3 dos 5 casos caíram (a corrida de 17/11 do e2e não se reproduz de forma determinística: depende da meia-noite).

## Correção

Só código de teste muda; nenhum arquivo de `apps/*/src` nem de `packages/*/src`:

- `e2e/support/prazo-do-pedido.ts` (novo, sem importar o Playwright): `prazoNaTela(diaDaSemeadura, chegouHaDias)` devolve a expressão que casa o texto do prazo como a tela o escreve, aceitando o dia da semeadura e o seguinte como o dia da leitura; o vencimento sai da semeadura, que é fixo. `diaCurto` e `somarDias` moram aqui (`diaCurto` saiu de `e2e/support/pedidos-do-titular.ts`, junto com `somarDiasAHoje`, que ficou sem uso);
- `e2e/support/seed.ts`: o dia da semeadura sai do mesmo relógio que grava a chegada. `diaDeHojeNoBanco()` lê o dia de São Paulo **uma vez**, o caso o passa (`diaDaSemeadura`) a `criarPedidoDoTitularNoBanco`, `criarPedidosDoTitularNoBanco` e `criarPedidoDeTitularEliminadoNoBanco`, e o INSERT parte dele (`coalesce($n::date, now() …)`; sem o parâmetro, vale o `now()` de antes, para os outros casos). Assim a `chegou_em` de todos os pedidos do caso é de um dia só e não depende de a meia-noite cair entre dois INSERTs nem entre o Node e o Postgres;
- `e2e/pedido-do-titular.spec.ts` e `e2e/pedidos-do-titular.spec.ts`: o caso lê `diaDeHojeNoBanco()` antes de semear e o passa à semeadura, e as asserções de prazo usam `prazoNaTela`; o dia de "ontem" da lista parte do mesmo dia (`somarDias`). O caso do registro pela tela (`Faltam 15 dias`) lê de volta a `chegou_em` que o banco guardou (`unicoPedidoNoBanco`) e confere `prazoNaTela(chegouEm, 0)`.
- O ajudante diz no cabeçalho que espelha `textos-do-pedido.ts` (a constante de 15 dias, `dias` e `textoDoPrazo`), para quem mudar o prazo ou o texto lá saber que muda aqui.

## Mutações

--faltando: 0 linhas (0 blocos, 0 motivos)

## Recomendações sem aplicar

Da 1ª rodada da Mesa (ordem `.processo/ordens/2026-11-17-prazo-do-pedido-na-virada-do-dia-r1.md`):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (1ª) | "A tolerância ficou maior do que precisa. `prazoNaTela` aceita `N` e `N-1` dias sempre […]. Sugestão: ler `hoje()` também depois da asserção e aceitar a leitura do dia seguinte só quando o dia de fato mudou." | `TODO.md` (o Implementador acrescenta a linha). Muda o desenho do ajudante e dos casos (duas leituras do relógio por asserção), e não cabe em poucas linhas; a contagem exata da tela já é provada pela unidade `textos-do-pedido.test.ts`, que o próprio revisor cita. O RF da correção é só a virada da meia-noite. |

Da 2ª rodada (`.processo/ordens/2026-11-17-prazo-do-pedido-na-virada-do-dia-r2.md`):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (2ª), test-engineer (2ª) | `e2e/support/seed.ts:1428`: "se a consulta não trouxer linha, `diaDeHojeNoBanco` devolve `''` sem avisar […] É melhor lançar o erro ali mesmo, como faz `unicoPedidoNoBanco`." (test-engineer: "É só robustez: na prática a consulta sempre devolve uma linha.") | `TODO.md`. Aplicar caducaria as duas aprovações desta rodada por uma consulta que sempre devolve linha. |
| test-engineer (2ª) | Outros pontos dos e2e leem o dia pelo `hoje()` do Node, com a mesma corrida da meia-noite, mas fora do prazo: o dia no diálogo de confirmação (`e2e/pedidos-do-titular.spec.ts:99`), o `max` e o preenchimento do campo de data (`:154`, `:168`, `:201`), o nome do arquivo baixado (`e2e/pedido-do-titular.spec.ts:694`, `:701`). | `TODO.md`, no mesmo molde, se algum falhar na esteira. Fora do escopo do documento (o prazo do pedido). |
| revisor-geral (2ª) | A tela conta o prazo pelo relógio do navegador e o dia da semeadura vem do relógio do banco; só vale enquanto os dois rodam na mesma máquina (a tolerância de um dia cobre a diferença). "Fora da correção, só para registro." | Recusada como mudança: é aviso de premissa, sem defeito hoje; fica na linha do `TODO.md` acima, sobre a esteira. |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-17 00:38:10 | 2026-11-17 00:38:22 | `tenancy-guardian` | 1 | APROVADO | a537557c01bad3bbb |
| 2026-11-17 00:38:06 | 2026-11-17 00:38:26 | `privacy-guardian` | 1 | APROVADO | a221f154c1f693ca6 |
| 2026-11-17 00:38:12 | 2026-11-17 00:38:34 | `conformidade-reviewer` | 1 | APROVADO | ad11149e7093ba038 |
| 2026-11-17 00:38:13 | 2026-11-17 00:38:37 | `infra-guardian` | 1 | APROVADO | a7435a18dd084e081 |
| 2026-11-17 00:38:09 | 2026-11-17 00:38:48 | `revisor-geral` | 1 | APROVADO | a68a314bafef4e2de |
| 2026-11-17 00:38:08 | 2026-11-17 00:39:39 | `test-engineer` | 1 | REPROVADO | aa21bb24cf32230fd |
| 2026-11-17 00:58:57 | 2026-11-17 00:59:26 | `revisor-geral` | 2 | APROVADO | ae8c73cd36981ec79 |
| 2026-11-17 00:58:51 | 2026-11-17 00:59:34 | `test-engineer` | 2 | APROVADO | a5c3ee87e9d258d0a |
