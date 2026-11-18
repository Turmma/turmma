# Correção — a lista de métricas com `escola_id` da observabilidade não conhece a da classificação (4.0)

**Origem:** esteira run 44215554483 (depois da tarefa 4.0 de `classificacao-bncc`), job `infra 2/3`.
**Subagentes obrigatórios:** `infra-guardian`, `privacy-guardian`, `tenancy-guardian`, `test-engineer`, `revisor-geral`, `conformidade-reviewer`
<!-- Os guardiões vieram no PEDIDO do Orquestrador. `revisor-geral` também pelo pedido. `conformidade-reviewer` é o que o portão local acrescentou à lista. -->

## Sintoma

`infra/test/metricas.int.test.ts` › "permissão: nenhuma série tem rótulo de usuário nem o id do usuário em rótulo algum, e `escola_id`
só aparece nas métricas da lista fechada" cai na linha 234: `expected [ Array(20) ] to deeply equal [ Array(17) ]`. As três séries
a mais são `material_classificacao_espera_seconds_bucket`, `_count` e `_sum`.

## Fora desta correção

Nada: a árvore estava limpa. (O job `verificar`, do commit `3209137c`, não é desta correção.)

## Causa

A 4.0 (`0adb2983`) criou a métrica `material.classificacao.espera` (`METRICS.esperaDaClassificacao`) **com** `escola_id`, e
a pôs de propósito na lista fechada `METRICS_WITH_ESCOLA` (`packages/core/src/telemetry/metrics.ts`) e em
`packages/core/src/telemetry/metrics.test.ts`. Pôs também o nome do Prometheus em `tools/testes/metricas.ts`. Mas a lista
esperada do teste de cardinalidade da observabilidade (`infra/test/metricas.int.test.ts`) ganhou a das 17 séries antigas e não a
nova: o teste do compose só roda na esteira, e o portão da 4.0 não o alcançou. Falha da tarefa 4.0.

**A decisão é pela regra, não pelo número.** A métrica precisa de `escola_id`: a Tech Spec (§7c, "Métrica") a define "por escola", e o
que ela responde é se o lote da noite dá conta do onboarding **de uma escola** de 300 apostilas, o que sem a escola não se
separa de "uma escola grande" contra "falta capacidade". O rótulo é o mesmo que as outras da lista levam e a cardinalidade é
a mesma: uma série por escola e por faixa do histograma, para o piloto de até dez escolas (D25). Não leva usuário, aluno,
material, seção, título nem código (o teste `classificacao.int.test.ts:1163` e a nota do JSDoc já fixam isso). Tirar o rótulo
tiraria o painel `fundacao.json` (`sum by (le, escola_id)`) e o sentido da métrica. Então se **justifica na lista**, não se tira.

## Teste que reproduz

`infra/test/metricas.int.test.ts` › "permissão: nenhuma série tem rótulo de usuário…": vermelho no HEAD (20 contra 17), verde depois
de a lista esperada conhecer a nova.

## Correção

Em `infra/test/metricas.int.test.ts`, a lista esperada ganha `...NOMES_NO_PROMETHEUS.esperaDaClassificacao`, com o comentário de
quem a justifica (classificacao-bncc, tarefa 4.0; Tech Spec §7c). No JSDoc de `METRICS_WITH_ESCOLA` (`metrics.ts`) e no comentário
do teste, a enumeração das métricas da lista passa a citar a espera da classificação. O comportamento da métrica não muda.

## Mutações

**Sem mutação:** o único arquivo de produção alterado, `packages/core/src/telemetry/metrics.ts`, muda só um comentário JSDoc (a enumeração das métricas da lista); nenhuma cláusula nova de código. O resto é o teste `infra/test/metricas.int.test.ts`, cuja prova é o vermelho do HEAD (20 contra 17) que fica verde com a linha da lista nova.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (1ª) | O cenário do compose não roda a classificação; a métrica nova não aparece no Prometheus desse teste, e só `metrics.test.ts:155` e `classificacao.int.test.ts:1163` garantem que ela leva só `escola_id`. Disparar um job de classificação no cenário de infra | Não aplicar: muda o cenário do teste de infra e o escopo da correção, que alinha só a lista esperada; a garantia do rótulo já está nos dois testes que o revisor cita. Fica para a tarefa futura que tocar o cenário do compose (linha no `TODO.md`) |
| infra-guardian, revisor-geral, test-engineer, tenancy-guardian (1ª) | Teste de unidade que compare `METRICS_WITH_ESCOLA` com a lista esperada do teste de infra (ou monte uma a partir da outra), para pegar no portão local a próxima métrica com escola que a esteira só pegaria depois | Não aplicar: é teste novo, não comentário, e muda como a lista é guardada. Vai para `TODO.md` e para a retro da funcionalidade |
| revisor-geral (2ª) | O título do teste `lista fechada: ...` em `packages/core/src/telemetry/metrics.test.ts:135` enumera as métricas e deixa de fora a espera da classificação (4.0); trocar por texto curto, sem lista, como foi feito no JSDoc de `METRICS_WITH_ESCOLA`. Defeito da 4.0, não desta correção | Não aplicar: é mudança em arquivo de `packages/` que a correção não toca (reabriria todos os guardiões), e o teste está certo, porque a lista que ele compara inclui a métrica; o defeito é só o título. Fica para a próxima tarefa que acrescentar métrica com escola e tocar esse teste |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-17 23:30:42 | 2026-11-17 23:30:59 | `privacy-guardian` | 1 | APROVADO | aac2bad3842bdb5fd |
| 2026-11-17 23:30:41 | 2026-11-17 23:31:01 | `infra-guardian` | 1 | APROVADO | acb3e1ac944848fce |
| 2026-11-17 23:30:46 | 2026-11-17 23:31:02 | `conformidade-reviewer` | 1 | APROVADO | aa20a7e153de36216 |
| 2026-11-17 23:30:43 | 2026-11-17 23:31:04 | `tenancy-guardian` | 1 | APROVADO | a1a18d4051921dbff |
| 2026-11-17 23:30:45 | 2026-11-17 23:31:04 | `revisor-geral` | 1 | APROVADO | ab1640eca9343d618 |
| 2026-11-17 23:30:44 | 2026-11-17 23:31:17 | `test-engineer` | 1 | APROVADO | a81c1e918fd0ec9b3 |
| 2026-11-17 23:40:33 | 2026-11-17 23:40:51 | `revisor-geral` | 2 | APROVADO | ab81b26d2ef80a114 |
