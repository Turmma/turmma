# Tarefa 2.0 — O `main-worker` confere a reserva sem segurar o principal, com limitador próprio e alerta

**Funcionalidade:** reserva-e-avaliacao · **Depende de:** 1.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`
**Porte:** grande

## Objetivo

O `main-worker` sobe com a reserva configurada: ela passa numa `SoberaniaNaSubida` própria, que não segura o consumo das filas,
confere de novo a cada 5 s enquanto não passa, e publica `ia.provedor_de_reserva.conferido`; o alerta avisa a Operação com 0 por
10 min. A reserva ganha o `TokenLimiter` dela. Sem reserva configurada, nada muda.

## Contexto necessário

- `techspec.md` §5 ("A subida"), §7 (log), §7c ("Métrica e alerta"), §13 (o terceiro risco)
- `prd.md` RF1, §7 (o terceiro caso de borda)
- `cenarios.md` §1: RF1, a primeira e a segunda linhas (sem a parte "com o principal fora", que é da 5.0); RF4, a linha de
  `LLM_RESERVA_TOKENS_POR_MINUTO` (o limitador); "Custo da reserva (RF6) e o alerta da reserva (RF1)", as duas linhas do alerta
- `.claude/rules/80-infra-e-carga.md` (item 10: alerta com runbook)
- Código: `packages/core/src/ia/soberania.ts` (`SoberaniaNaSubida`, o intervalo injetado, o log que se repete a cada 12
  tentativas), `apps/api/src/ia/ia-do-worker.module.ts` (a montagem do principal, o `TokenLimiter`),
  `packages/core/src/telemetry/metrics.ts`, `infra/grafana/alertas/ia-provedor-fora.yaml`

## Subtarefas

- [ ] 2.1 — A segunda `SoberaniaNaSubida`, pela chave da `IA_RESERVA_PROVEDOR_ID`, com as categorias das tarefas aprovadas
  (1.0); não conferida, confere de novo a cada 5 s (intervalo injetado) sem bloquear o ciclo das filas; log
  `ia.provedor_de_reserva.conferencia_recusada` só com ids, códigos e `provedorId`. A conferência liga a porta da `reservaElegivel`
- [ ] 2.2 — O `TokenLimiter` da reserva, com `LLM_RESERVA_TOKENS_POR_MINUTO` e os mesmos baldes por fila, entregue ao gateway
- [ ] 2.3 — `ia.provedor_de_reserva.conferido` (1 ou 0) só com reserva configurada; `infra/grafana/alertas/ia-provedor-de-reserva.yaml`
  com 0 por 10 min e `noDataState = OK`, sem `absent()`; parágrafo no `docs/runbook.md`: encerrar o suboperador, avisar as escolas,
  conferir que o contrato permite serviço usado por menor; o `#provedor-de-ia-fora` diz o que fazer quando é a reserva
- [ ] 2.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/ia/soberania.ts`, `packages/core/src/ia/soberania.test.ts` | alterado |
| `packages/core/src/telemetry/metrics.ts` | alterado |
| `apps/api/src/ia/ia-do-worker.module.ts`, `apps/api/test/fila-de-ia.fixture.ts` | alterado |
| `apps/api/src/ia/reserva-na-subida.int.test.ts` | novo |
| `apps/api/src/ia/fila-de-ia.int.test.ts` | alterado |
| `infra/grafana/alertas/ia-provedor-de-reserva.yaml` | novo |
| `infra/test/alertas.test.ts`, `docs/runbook.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| reserva sem suboperador vigente: o worker sobe e consome as filas, o principal passa, `conferido = 0` | I | RF1 | principal externo conferido ao lado da reserva recusada | |
| `pais_fora_do_brasil`, `treinamento_nao_vedado`, `alcance_nao_e_todas`, suboperador encerrado e reinício: não conferida, o principal segue | I | a conferência inteira | um campo errado por caso | |
| cadastro corrigido sem reiniciar (intervalo injetado): conferida, `conferido` passa a 1 | I | a reconferência | o mesmo processo, sem subir de novo | |
| o ciclo das filas não espera a conferência da reserva | I | sem segurar o principal | a reserva nunca conferida e o consumidor criado | |
| o limitador da reserva usa o contratado dela, com os baldes por fila | I | regra 80.4 | contratados diferentes nos dois | |
| sem reserva configurada, a série não é publicada e o alerta não dispara | I, U | `noDataState = OK` | o worker com o principal só | |
| configurada e recusada: publica 0, e o alerta dispara depois de 10 min | I, U | sem `absent()` | `for: 10m` lido do yaml | |
| o alerta tem o parágrafo do runbook | U | regra 80.10 | `alerta-tem-runbook` | |
| log novo: `ia.provedor_de_reserva.conferencia_recusada` | U | não leva o contrato, a chave nem nome (regra 20, item 9) | a chave e o contrato do suboperador com valores reconhecíveis | |

## Como testar

- Subida do worker: `apps/api/src/ia/soberania-na-subida.int.test.ts` › "externo com o suboperador que cobre tudo: consome" e › "externo com o
  cadastro que não cobre: nenhum consumidor e nenhum batimento; corrigido o cadastro, passa a consumir sozinho" — aqui o inverso:
  o consumidor existe com a reserva recusada
- Reconferência e log: `soberania.test.ts` › "o cadastro que não cobre fica não conferido e o log diz o motivo; consertado o cadastro, a
  instância se confere sozinha, sem reiniciar" e o bloco "o log da instância que espera o cadastro (relógio falso…)"
- Limitador: `fila-de-ia.int.test.ts` usa `FilaDeIa.subirOMainWorker()` e `subirOMainWorker({ semTokensPorMinuto: true })`
- Alerta: `infra/test/alertas.test.ts`, o bloco do `provedorFora` (`noDataState`, `for`, `expressao`); `tools/guardas/alerta-tem-runbook.test.ts`
- `npx vitest run --project integracao apps/api/src/ia/reserva-na-subida.int.test.ts`

## Fora do escopo desta tarefa

Mandar chamada à reserva, e a reserva recusada fora do roteamento (5.0); o balde da reserva no gateway (7.0).

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano antes de codar.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

```mutacao
arquivo:
teste:
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
