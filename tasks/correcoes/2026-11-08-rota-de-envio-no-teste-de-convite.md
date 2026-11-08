# Correção — o teste "não existe rota que crie convite" não conhece a rota de envio que a tarefa 3.0 acrescentou

**Origem:** esteira run 42438684182 em `25cf9ee8` (`gh run view 42438684182 --log-failed`): `apps/api/test/convite.int.test.ts › permissão (RF1) › fora do painel da operação, não existe rota que crie convite…`.
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `test-engineer`
<!-- O PEDIDO do Orquestrador trouxe `tenancy-guardian` e `privacy-guardian`; `conformidade-reviewer` e `infra-guardian` entram porque a Mesa
     conferiu a linha contra os arquivos alterados (`guardioes-por-caminho.ts`: `apps/api/test/convite.int.test.ts` os pede). A correção altera
     1 arquivo fora de tasks/ e não toca `.github/`, `tools/ci/` nem `tools/processo/`: o `revisor-geral` não é obrigatório pelo limite do passo 5. -->
**Sem mutação:** a correção só altera um arquivo de teste (`apps/api/test/convite.int.test.ts`); nenhum código de `apps/*/src` nem de `packages/*/src` muda.

## Sintoma

A esteira ficou vermelha: o caso lista as rotas do Express cujo caminho cita "convite" e compara com uma lista fixa de 8. Recebeu 9; o
diff aponta `+ "POST /v1/professores/convites/enviar"`.

## Fora desta correção

Nada: o pedido veio sem arquivos da tarefa em curso, e a árvore estava limpa.

## Causa

Falha da tarefa 3.0 (`fb888a25`). Ela acrescentou `POST /v1/professores/convites/enviar` (o "Enviar convites" da coordenação) mas não a
lista de `apps/api/test/convite.int.test.ts`. O arquivo é de integração e a 3.0 não o alterou, então o portão dela não o rodou; só a esteira o roda.

A rota **não cria convite para pessoa nova**: `enviarConvitesDeProfessores` (`apps/api/src/sessao/convite/convite-de-professor.service.ts`)
lê os professores da escola da sessão (`professoresParaEnvio`), filtra pela mesma matriz do "refazer" (só `pendente` e `vencido`, com convite
de origem e endereço na conta) e refaz o convite de cada um (`refazerSobATrava`, que revoga o anterior), com o canal `email`. O corpo só pode
trazer `usuarioIds` para restringir; id desconhecido, de outra escola ou de quem não espera é ignorado. A rota é da mesma classe de
`POST /v1/professores/:usuarioId/convite/refazer`, que já está na lista. O defeito é só da lista do teste.

## Teste que reproduz

`apps/api/test/convite.int.test.ts › … fora do painel da operação, não existe rota que crie convite…`: já existia e já cobre o defeito.
Vermelho antes (9 rotas contra 8 esperadas, a mais é `POST /v1/professores/convites/enviar`), verde depois.

## Correção

`'POST /v1/professores/convites/enviar'` entra na lista, na ordem do `sort()`, e o comentário acima dela diz por que a rota está ali (refaz,
não cria). A prova não afrouxa: a asserção continua sendo igualdade exata da lista, de modo que uma rota nova com "convite" no caminho
continua derrubando o caso, e a segunda parte (`POST /v1/convites` e `/criar` respondem 404 ao coordenador) fica como estava.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian (1ª) | "O portão da tarefa 3.0 não rodou `convite.int.test.ts` porque o arquivo não estava entre os alterados. Vale levar à retro que uma tarefa que cria rota com "convite" no caminho deveria rodar esse teste no próprio portão, e não deixar a falha só para a esteira." | TODO.md, item para a retro de acesso-e-convites: mexe em `tools/processo/`, fora de uma correção de um arquivo de teste |
| infra-guardian (1ª) | "Para a retro: um teste de integração que lista as rotas do Express só roda na esteira. Vale fazer o portão da tarefa rodar `convite.int.test.ts` sempre que ela acrescentar rota com "convite" no caminho, para a falha da 3.0 não chegar de novo à esteira." | Mesmo item do TODO.md (mesmo achado do privacy-guardian) |
| test-engineer (1ª) | "Para a retro, o processo: [...] Duas saídas possíveis: levar a lista das rotas com "convite" para um teste de unidade, que o portão roda sempre; ou fazer o portão rodar também `convite.int.test.ts` quando um controller ganha uma rota com "convite" no caminho." | Mesmo item do TODO.md, com as duas saídas; decide a retro |

A recomendação aplicada (tenancy-guardian e test-engineer, 1ª): o comentário acima da lista dizia que o professor "vem da lista da escola, nunca do
corpo"; passou a dizer que o corpo só restringe dentro da escola da sessão e que o id de outra escola ou desconhecido é ignorado.

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-08 03:26:00 | 2026-11-08 03:26:14 | `privacy-guardian` | 1 | APROVADO | a8db61414e60a503d |
| 2026-11-08 03:26:02 | 2026-11-08 03:26:17 | `infra-guardian` | 1 | APROVADO | aa3cd4bdaa5187a39 |
| 2026-11-08 03:26:01 | 2026-11-08 03:26:19 | `conformidade-reviewer` | 1 | APROVADO | a752eac57c99a9099 |
| 2026-11-08 03:25:59 | 2026-11-08 03:26:20 | `tenancy-guardian` | 1 | APROVADO | a76ebb58d86c71825 |
| 2026-11-08 03:26:03 | 2026-11-08 03:26:52 | `test-engineer` | 1 | APROVADO | acefc0d4bc72bdc44 |
