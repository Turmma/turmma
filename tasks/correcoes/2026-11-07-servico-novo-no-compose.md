# Correção — o teste do compose não conhece o serviço `mailpit` que a tarefa 1.0 acrescentou

**Origem:** esteira run 42425078992 em `933177ce` (`gh run view 42425078992 --log-failed`): `tools/ci/compose.int.test.ts › ambiente do compose › nenhum serviço declara logging`.
**Subagentes obrigatórios:** `infra-guardian`, `test-engineer`, `revisor-geral`
<!-- Os guardiões vieram no PEDIDO do Orquestrador. O revisor-geral entra porque a correção toca tools/ci/. -->

## Sintoma

A esteira ficou vermelha: o caso lista os serviços do `docker compose config` pelo nome e compara com a lista fixa.
A saída da esteira diz `expected [ 'api-1', 'api-2', 'borda', …(17) ] to deeply equal [ … …(16) ]` (o que o vitest abrevia
é o que vem depois dos três primeiros nomes, então são 20 recebidos contra 19 esperados), e o diff aponta `+ "mailpit"`.

## Fora desta correção

Nada: o pedido veio sem arquivos da tarefa em curso, e a árvore estava limpa.

## Causa

A tarefa 1.0 (`dcdf4423`, a porta de e-mail) acrescentou o serviço `mailpit` a `infra/compose.yml` (o servidor de e-mail do
desenvolvimento e do teste, com o teto de CPU em `infra/compose.carga.yml` e as portas em `infra/teste.env` e `infra/carga.env`),
mas não a lista de nomes de `tools/ci/compose.int.test.ts`. O caso é de integração (precisa do `docker compose config`), e o
portão da 1.0 não roda esse arquivo; só a esteira o roda.

## Teste que reproduz

`tools/ci/compose.int.test.ts › ambiente do compose › nenhum serviço declara logging…`: já existia e já cobre o defeito, que é
a lista de nomes desatualizada. Vermelho antes (a lista sem `mailpit`), verde depois (a lista com ele). O laço de cima do
mesmo caso, que proíbe `logging` em cada serviço, passa a valer também para o `mailpit`.

## Correção

`mailpit` entra na lista de nomes do caso (entre `despachante-2` e `migrar`, na ordem do `sort()`), e o comentário que diz
"Os 19 pelo nome" passa a dizer 20. A conta do comentário seguinte ("deixaria dezessete sem checar", que era 19 menos 2)
passa a dizer "dezoito", como a rodada 1 exigiu.

## Sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (1ª) e test-engineer (1ª) | "serviço novo no compose deveria fazer o portão rodar `tools/ci/compose.int.test.ts`" (quando o diff toca `infra/compose*.yml`) | Retro da spec. Muda o portão (`tools/processo/`), fora desta correção, e muda comportamento do processo, não cabe em poucas linhas. A correção só conserta a lista. |
| revisor-geral (1ª) | `SERVICOS_INFRA` em `tools/ci/compose.ts:133` não inclui o `mailpit` | Não aplicar: ele mesmo diz que está certo hoje (nenhuma suíte de integração sobe o serviço; a porta de e-mail usa o adaptador falso). Entra na tarefa futura da spec que testar envio de verdade pelo `mailpit` na esteira. |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-07 21:51:56 | 2026-11-07 21:52:18 | `revisor-geral` | 1 | APROVADO | a796e670552d92f95 |
| 2026-11-07 21:51:55 | 2026-11-07 21:52:28 | `infra-guardian` | 1 | APROVADO | ab51705f060ce2132 |
| 2026-11-07 21:51:55 | 2026-11-07 21:52:42 | `test-engineer` | 1 | APROVADO | a64023409b7822b7c |
| 2026-11-07 21:58:51 | 2026-11-07 21:59:06 | `revisor-geral` | 2 | APROVADO | a9b0c3a00b951ac90 |
