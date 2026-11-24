# Correção — o `EXPLAIN` dos itens da Semana não aceita o índice único novo da atividade aplicada

**Origem:** esteira run 45287313249 (em `8778bdd`, tarefa 1.0 da avaliação e correção), job "integração 3/3".
**Subagentes obrigatórios:** `infra-guardian`, `tenancy-guardian`, `test-engineer`, `revisor-geral`, `privacy-guardian`, `conformidade-reviewer`
<!-- Os quatro primeiros vieram no PEDIDO do Orquestrador; `privacy-guardian` e `conformidade-reviewer` entram porque
     `portao-local.ts revisores` os lista como obrigatórios do caminho. -->

## Sintoma

`apps/api/test/semana-itens.int.test.ts` › "o `EXPLAIN` das três consultas dos itens desce pela turma, pelo índice da atividade
aplicada e pelo da entrega" falha na linha 399 (`expect(doIndice, resumo).toBeDefined()`): na consulta `aplicadas` o plano usa
`Index Scan atividade_aplicada atividade_aplicada_escola_ano_turma_artefato_id_unico`, nome que a lista do teste não traz.

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

A migration 0068 da tarefa 1.0 (`cb79a2c`) criou a restrição única `atividade_aplicada_escola_ano_turma_artefato_id_unico`, em
`(escola_id, ano_letivo_id, turma_id, artefato_id, id)`. Com o `seqscan` e o `bitmapscan` desligados, o planejador passou a
preferi-la ao `atividade_aplicada_escola_ano_turma_id_unico`, e o teste só aceitava `atividade_aplicada_turma_idx` e esse último.
A consulta não mudou e continua entrando pela escola, pelo ano e pela turma: a condição do índice novo traz
`escola_id`, `ano_letivo_id` e `turma_id`, como o resto da asserção exige. O que ficou desatualizado foi a lista de nomes que o
teste aceita. Falha da tarefa 1.0, vista só na esteira (a 1.0 não altera `semana-itens.int.test.ts`, que o portão dela não rodou).

## Teste que reproduz

`apps/api/test/semana-itens.int.test.ts` › o `EXPLAIN` das três consultas dos itens…: vermelho no HEAD, rodado isolado com
`npx vitest run --project integracao apps/api/test/semana-itens.int.test.ts -t "EXPLAIN"` (mesma mensagem da esteira); verde
depois, três execuções seguidas do arquivo inteiro (15 casos).

## Correção

Uma constante `indicesDaAplicada` com os três índices que começam pela escola e pela turma (`atividade_aplicada_turma_idx`, o
único `(escola, ano, turma, id)` e o novo `(escola, ano, turma, artefato, id)`), usada nas consultas `aplicadas` e `encerradas`.
A exigência não baixou: a condição do índice continua a citar `escola_id` antes de `turma_id`, e nenhum `Seq Scan` na tabela
continua sendo aceito. Só o teste mudou; nenhuma consulta nem índice de produção.

## Mutações

**Sem mutação:** o diff altera só `apps/api/test/semana-itens.int.test.ts`, teste de integração, e nenhum arquivo de `apps/*/src`
nem de `packages/*/src`.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | A regex `/escola_id.*turma_id/` não exige `ano_letivo_id`; trocar por `/escola_id.*ano_letivo_id.*turma_id/` | Não aplicar: o índice da `entrega` (`entrega_turma_idx`, `escola_id, turma_id, estado, id`, em `packages/core/src/db/schema/entrega.ts`) não tem `ano_letivo_id`, e a mesma regex vale para as três consultas. Exigiria regex por tabela, mais que a correção. A lacuna é anterior a esta correção. Destino: `TODO.md` |
| infra-guardian (1ª), test-engineer (1ª) | Trocar a lista fixa de nomes por uma regra: aceitar qualquer índice da tabela cuja condição traga `escola_id` e `turma_id` | Não aplicar: muda o desenho da asserção (o que o teste aceita), não só a lista, e a correção é a mínima que desfaz a falha da esteira. A validação pode decidir. Destino: `TODO.md` |
| revisor-geral (1ª), privacy-guardian (1ª), test-engineer (1ª), infra-guardian (1ª) | Migration que cria índice em tabela consultada por teste de `EXPLAIN` deveria puxar esses testes para o portão da tarefa | Não é desta correção (lacuna de processo, não de código). Destino: retro da spec |
| conformidade-reviewer (1ª) | O portão distinguir mudança só de teste de desempenho, que não toca nota, correção, tutor, autonomia nem indicador, para não chamar o `conformidade-reviewer` | Não é desta correção (regra de `tools/processo/guardioes-por-caminho.ts`). Destino: retro da spec |
| revisor-geral (3ª) | `semana-itens.int.test.ts:382`: "os dois únicos com o ano entre elas" pode ser lido como "os dois únicos índices que têm o ano"; escrever pelos nomes ("as duas restrições `..._unico` têm o ano entre a escola e a turma") | Recusada: a recomendação é de redação de um comentário que já está correto (conferido pelo `revisor-geral` contra o schema e as migrations); as recomendações entram em ordem uma vez por documento, e esta veio de revisor que aprovou, depois da primeira ordem. Aplicá-la caducaria o `revisor-geral` de novo por uma ambiguidade de leitura |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-23 22:48:27 | 2026-11-23 22:48:41 | `tenancy-guardian` | 1 | APROVADO | a0c31fec04c6db43f |
| 2026-11-23 22:48:27 | 2026-11-23 22:48:41 | `infra-guardian` | 1 | APROVADO | a6ff2ef6a50e1caee |
| 2026-11-23 22:48:29 | 2026-11-23 22:48:44 | `revisor-geral` | 1 | APROVADO | a7867fbad2294146f |
| 2026-11-23 22:48:31 | 2026-11-23 22:48:45 | `conformidade-reviewer` | 1 | APROVADO | a696ace5b038579c1 |
| 2026-11-23 22:48:30 | 2026-11-23 22:48:45 | `privacy-guardian` | 1 | APROVADO | a37b9df89f6396aca |
| 2026-11-23 22:48:28 | 2026-11-23 22:49:07 | `test-engineer` | 1 | APROVADO | a58fe157aa9505e3d |
| 2026-11-23 22:58:30 | 2026-11-23 22:58:53 | `revisor-geral` | 2 | REPROVADO | ab58729c32682b7a1 |
| 2026-11-23 23:10:08 | 2026-11-23 23:10:24 | `revisor-geral` | 3 | APROVADO | a11d4a01c745afa8c |
