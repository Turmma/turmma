# Tarefa 8.0 — A execução interrompida grava a estimada de cada destino, com custo

**Funcionalidade:** reserva-e-avaliacao · **Depende de:** 5.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
**Porte:** grande

## Objetivo

A execução interrompida (worker morto, encerrada pela varredura ou pela reentrega) passa a gravar custo: os dois tetos da tarefa
ao preço do modelo de cada destino, uma linha para o principal e outra para o provedor de reserva quando a tarefa tem aprovação
para o provedor dele. O custo superestima (D14) e o compartilhamento do aluno cita os dois (LGPD, art. 18, VII). Até aqui a
interrompida grava sem custo (`consumoEstimadoDaInterrompida`, abertura, passo 4).

## Contexto necessário

- `techspec.md` §3 ("A estimativa", `pelo_provedor_de_reserva`), §7
- `prd.md` RF5, RF6 (a interrompida), §6 (D14)
- `cenarios.md` §1: RF5, da linha "Interrompida pela **varredura**…" até "Interrompida de tarefa sem aprovação…" (sete linhas, a da
  Operação incluída); RF6, "A interrompida grava uma linha por destino…"
- Código: `packages/core/src/ia/consumo.ts` (`consumoEstimadoDaInterrompida`, `DestinoDoAdaptador`), `apps/api/src/ia/consumo.repository.ts`
  (`registrarEstimada`), `varredura-de-execucoes.ts` (linha 105), `execucao.processor.ts` (linha 209, `#aoReentregar`),
  `apps/api/src/ia/ia-do-worker.module.ts` (`DESTINO_DO_ADAPTADOR`, de onde vem o `destino`; a §2 diz `worker.module.ts`, que não
  existe), `llm-gateway.ts` › `destinoDoAdaptador`

## Subtarefas

- [ ] 8.1 — `destinosDaInterrompida(tarefa)`: o principal sempre; a reserva configurada se a tarefa tem entrada em
  `MODELOS_APROVADOS` para o `provedorId` dela, sem comparar o modelo nem a conferência (destino superestimado)
- [ ] 8.2 — `consumoEstimadoDaInterrompida` com os dois tetos ao preço do modelo de cada destino; `pelo_provedor_de_reserva`
  falsa nas duas; sai o `custoMicros: 0` e o comentário que aponta "a tarefa 11.0 da camada-ia"
- [ ] 8.3 — `registrarEstimada(execucao, destinos, precos)`, com a tabela de preços por porta, injetada na varredura e no
  processor; as linhas do mesmo `InterrompidaEncerrada`, na escola do `returning`, na transação do encerramento, sem `@Unscoped` novo
- [ ] 8.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/ia/consumo.ts`, `packages/core/src/ia/consumo.test.ts`, `packages/core/src/index.ts` | alterado |
| `apps/api/src/ia/consumo.repository.ts`, `apps/api/src/ia/varredura-de-execucoes.ts`, `apps/api/src/ia/execucao.processor.ts` | alterado |
| `apps/api/src/ia/ia-do-worker.module.ts` | alterado |
| `apps/api/src/ia/execucao-interrompida.int.test.ts`, `apps/api/test/arquivo-do-titular.int.test.ts`, `apps/api/test/painel-leitura.int.test.ts` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| varredura (300 s), tarefa aprovada para a reserva, preços 1.300/5.200 e 2.000/8.000: duas linhas, cada uma com os dois tetos ao seu preço; o compartilhamento lista as duas | I | os dois destinos | preços diferentes | |
| o mesmo pela reentrega (`#aoReentregar`) | I | os dois caminhos | a varredura desligada no caso | |
| as duas com `pelo_provedor_de_reserva = false`, a da reserva com o provedor dela | I | a coluna | — | |
| duas varreduras em `Promise.all`: exatamente duas linhas | I | concorrência | duas réplicas na trava | |
| a gravação da linha da reserva falha: desfaz as duas e o encerramento | I | a transação | a falha só na segunda linha | |
| duas escolas: cada par na escola da sua execução | I | regra 10 | a 1ª execução do lote é da outra escola | |
| aprovação para o provedor da reserva com outro modelo: as duas; o compartilhamento lista as duas | U, I | sem comparar o modelo | o modelo diferente | |
| reserva configurada e recusada na conferência: as duas | I | a escolha da linha 99 | conferência recusada | |
| aprovação para outro `provedorId`: só a do principal; o compartilhamento só o principal | U, I | o provedor | o mesmo modelo, outro provedor | |
| tarefa sem aprovação: só a do principal | U, I | não sempre | a reserva configurada e conferida | |
| custo > 0 em cada linha, a da reserva no preço dela; sem a entrada contada | U | D14 | preços diferentes | |
| a Operação: uma interrompida com reserva e uma desviada de verdade, na mesma escola: `chamadasPeloProvedorDeReserva = 1` | I | contam as enviadas | as duas na mesma escola | |
| a estimada não leva o aluno fora do freio, como hoje | I | regra 20 | — | |

## Como testar

- Varredura: `execucao-interrompida.int.test.ts` › "varredura, limiar: a `rodando` de 301 s é encerrada com a linha estimada, e a de 299 s fica"
- Reentrega: › "worker morto: a reentrega encerra com EXECUCAO_INTERROMPIDA, sem modelo, e deixa uma linha estimada"
- Falha, réplicas e isolamento: › "a gravação falha: o encerramento se desfaz…", › "varredura, duas réplicas: o encerramento e a linha saem
  uma vez só…" e › "isolamento, reentrega: o job da A com o `execucaoId` da B…"
- Freio: › "fora do freio: a linha estimada não leva o aluno…"
- Compartilhamento: `arquivo-do-titular.int.test.ts` › "a linha estimada da execução interrompida (sem `aluno_id`…"
- Operação: `painel-leitura.int.test.ts` › "`chamadasPeloProvedorDeReserva` conta linhas e `execucoes` conta execuções…"
- Concorrência: `WriteBlockTrigger` e `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`)
- `npx vitest run --project integracao apps/api/src/ia/execucao-interrompida.int.test.ts`
- Armadilha: a `cenarios.md` cita `fila-de-ia.int.test.ts` para a reentrega; o precedente é o `execucao-interrompida`

## Fora do escopo desta tarefa

O roteamento (4.0 a 7.0); os preços reais (14.0).

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
