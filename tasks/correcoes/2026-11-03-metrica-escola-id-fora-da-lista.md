# Correção — a métrica `importacao_minutos_na_fila` aparece com `escola_id` e o teste da lista fechada da infra não a conhece

**Origem:** esteira run 41753649636 (job `infra`, `npm run ci:infra`), em `infra/test/metricas.int.test.ts`.
**Subagentes obrigatórios:** `infra-guardian`, `privacy-guardian`, `test-engineer`, `revisor-geral`
<!-- Quem dita os guardiões é o Orquestrador, no pedido. `revisor-geral` já vem no pedido. -->

## Sintoma

O teste "permissão: nenhuma série tem rótulo de usuário nem o id do usuário em rótulo algum, e `escola_id` só aparece nas métricas da
lista fechada" falha na esteira com `AssertionError: expected [ Array(14) ] to deeply equal [ Array(13) ]`: a diferença é
`importacao_minutos_na_fila`.

## Fora desta correção

nada

## Causa

A tarefa 5.0 do onboarding criou a métrica `importacao.minutos_na_fila` por escola e a pôs em `METRICS_WITH_ESCOLA`
(`packages/core/src/telemetry/metrics.ts`), com o teste de lista fechada do `core` (`metrics.test.ts`) atualizado. A segunda cópia da
lista, a de nomes do Prometheus em `infra/test/metricas.int.test.ts`, ficou de fora: ela monta `admitidas` a partir de
`METRICS_WITH_ESCOLA` (14 nomes) e compara com uma enumeração escrita à mão (13 nomes). Integração e infra não rodam no portão da tarefa
(D79), e foi a esteira que a achou.

A decisão que o pedido manda tomar (a métrica entra na lista ou perde o rótulo) está tomada por quem a criou, e esta correção a confirma:
**entra.** Cardinalidade: uma série por escola, só enquanto há importação `na_fila`, como `eliminacao_horas_vencida` e
`arquivo_horas_em_preparacao`. Privacidade: a série traz a escola e um número de minutos; nenhum id de importação, autor, nome ou
linha da planilha (`apps/worker/src/importacao-gauge.ts`). Sem o `escola_id`, o alerta "Importação de planilha parada na fila" não diria
qual escola tem a importação parada (`infra/grafana/alertas/importacao-parada.yaml`, `runbook.md`, Tech Spec do onboarding, seção 7c).

## Teste que reproduz

`infra/test/metricas.int.test.ts › permissão: nenhuma série tem rótulo de usuário … e `escola_id` só aparece nas métricas da lista fechada`
Vermelho com `npm run ci:infra` antes da correção, como na esteira (o caso caiu em `metricas.int.test.ts`, 1 de 6; interrompi a corrida
ali, porque o resto da suíte não é desta correção). Verde depois, isolado: `npx vitest run --project infra infra/test/metricas.int.test.ts`,
6 de 6.

## Correção

`infra/test/metricas.int.test.ts`: a enumeração esperada ganha `NOMES_NO_PROMETHEUS.minutosDaImportacaoNaFila`, e o comentário do
caso passa a citar os minutos da importação na fila. O título não lista as métricas (ordem da rodada 1): termina em "… e `escola_id` só
aparece nas métricas da lista fechada", e a lista nominal fica só no comentário. `tools/testes/metricas.ts` já tem o nome (`minutosDaImportacaoNaFila`). Os documentos
que citam a métrica (`docs/runbook.md`, Tech Spec do onboarding) já a descrevem com o `escola_id`; nenhum cita a lista fechada.

## Mutações

--faltando: 0 linhas (0 blocos, 0 motivos)

Sem bloco: a correção só acrescenta um nome à enumeração esperada de um teste; não há cláusula de código de produto a mutilar.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (1ª) | Caso que deixe uma importação parada em `na_fila` e veja a série `importacao_minutos_na_fila` no Prometheus com o `escola_id` certo (o caso atual só confere que a métrica não vaza) | `TODO.md`: cobertura extra, fora desta correção (que só alinha a segunda cópia da lista); exige subir o gauge no cenário de infra |
| privacy-guardian (1ª); test-engineer (1ª); revisor-geral (1ª) | Avisar, junto da lista, que cada métrica nova com escola muda `METRICS_WITH_ESCOLA`, `metrics.test.ts` e `infra/test/metricas.int.test.ts` (comentário em `packages/core/src/telemetry/metrics.ts` ou linha no `docs/guia-do-desenvolvedor.md`); e, no revisor-geral, montar a lista esperada a partir de `METRICS_WITH_ESCOLA` e `NOMES_NO_PROMETHEUS` | `TODO.md`: toca arquivos que esta correção não toca (`metrics.ts`, guia). O privacy-guardian lembra que a duplicação à mão é desejável, porque obriga a olhar a cardinalidade; montar a lista só pelo código a desfaria. Decisão para quem tocar esses arquivos |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-04 00:08:31 | 2026-11-04 00:08:47 | `infra-guardian` | 1 | APROVADO | a436c14fbed7d3877 |
| 2026-11-04 00:08:34 | 2026-11-04 00:08:49 | `revisor-geral` | 1 | APROVADO | aa6b869c10f634e08 |
| 2026-11-04 00:08:32 | 2026-11-04 00:08:52 | `privacy-guardian` | 1 | APROVADO | ace6e7d47ecc86828 |
| 2026-11-04 00:08:33 | 2026-11-04 00:10:51 | `test-engineer` | 1 | APROVADO | a53bfccc7a7c1e612 |
| 2026-11-04 00:18:56 | 2026-11-04 00:19:11 | `test-engineer` | 2 | APROVADO | aa840d0e7b7a961f5 |
| 2026-11-04 00:18:59 | 2026-11-04 00:19:14 | `revisor-geral` | 2 | APROVADO | a98f535a7b93bc49a |
