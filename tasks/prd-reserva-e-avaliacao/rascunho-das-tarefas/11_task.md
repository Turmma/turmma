# Tarefa 11.0 — A execução interrompida registra também o provedor de reserva, e a carga prova a queda do principal

**Funcionalidade:** camada-ia · **Depende de:** 10.0
**Subagentes obrigatórios:** `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

Quando a tarefa tem aprovação para o provedor de reserva configurado, a execução interrompida grava duas linhas estimadas,
a do principal e a da reserva, cada uma com os dois tetos da tarefa ao preço do seu modelo: o custo superestima (D14) e o
compartilhamento do aluno cita os dois (LGPD, art. 18, VII). E a fase `reserva` da carga prova que a queda do principal
não deixa aluno sem resposta.

## Contexto necessário

- `techspec.md` §3 ("A estimativa"), §7 (a linha 99 de `docs/lgpd.md`), §7c ("Carga")
- `prd.md` RF3, RF5, §6 (D14), §8
- `cenarios.md` §1 RF5 (as cinco linhas da interrompida), RF6 ("A interrompida grava uma linha por destino…"), §5
- Código: `consumo.ts` › `consumoEstimadoDaInterrompida`, `consumo.repository.ts` › `registrarEstimada`,
  `varredura-de-execucoes.ts` (linha 105), `execucao.processor.ts` › `#aoReentregar` (linha 208), `infra/scripts/carga.ts` (`FaseDoK6`)

## Subtarefas

- [ ] 11.1 — `destinosDaInterrompida(tarefa)`: o principal sempre; a reserva se a tarefa tem entrada para o `provedorId`
  dela, sem comparar o modelo nem a conferência (destino superestimado)
- [ ] 11.2 — `consumoEstimadoDaInterrompida` com os dois tetos ao preço do modelo de cada destino
- [ ] 11.3 — `registrarEstimada` recebe a lista de destinos, injetada na varredura e no processor, na transação de hoje
- [ ] 11.4 — `docs/lgpd.md`, linha 99: o provedor de reserva e a estimativa dele
- [ ] 11.5 — A fase `reserva` do `carga.ts` e o cenário k6 (`IA_FALHA_FALSA` da 10.0); a fase `sala` segue sem reserva
- [ ] 11.6 — Rodar a fase e o controle negativo, e registrar em `docs/runbook.md` ("Quando a carga vale como registro")
- [ ] 11.7 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/ia/consumo.ts`, `packages/core/src/ia/consumo.test.ts`, `packages/core/src/index.ts` | alterado |
| `apps/api/src/ia/consumo.repository.ts`, `apps/api/src/ia/varredura-de-execucoes.ts`, `apps/api/src/ia/execucao.processor.ts`, `apps/api/src/ia/ia-do-worker.module.ts` | alterado |
| `apps/api/src/ia/execucao-interrompida.int.test.ts`, `apps/api/test/arquivo-do-titular.int.test.ts` | alterado |
| `infra/scripts/carga.ts`, `infra/k6/reserva.js`, `infra/test/carga.test.ts` | novo e alterado |
| `docs/lgpd.md`, `docs/runbook.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| varredura (300 s) de tarefa aprovada para a reserva, preços 1.300/5.200 e 2.000/8.000: duas linhas, cada uma com os dois tetos ao seu preço; o compartilhamento lista as duas | I | os dois destinos | |
| o mesmo pela reentrega (`#aoReentregar`) | I | os dois caminhos | |
| aprovação para o provedor da reserva com outro modelo: as duas mesmo assim | U, I | sem comparar o modelo | |
| reserva configurada mas recusada na conferência: as duas mesmo assim | I | a escolha da linha 99 | |
| aprovação para outro `provedorId`: só a do principal; o compartilhamento só o principal | U, I | o provedor | |
| tarefa sem aprovação para a reserva: só a do principal | U, I | não sempre | |
| custo > 0 em cada linha, a da reserva no preço dela; sem a entrada contada | U | D14 | |
| a estimada não leva o aluno fora do freio, como hoje | I | regra 20 | |
| carga, queda por 5xx: zero indisponível, p95 do Tutor até 1 s acima da `sala`, `degrau="provedor_de_reserva"` subindo | carga | RF3 | |
| carga, queda por prazo: indisponível só com o prazo esgotado, sempre `IA_TEMPO_ESGOTADO`, com o número no relatório | carga | §5 | |
| carga, balde cheio no pico: o transbordo vai à reserva, sem indisponível | carga | §5 | |
| controle negativo (`falso-sem-aprovacao`): reprova pelo indisponível, não pela subida; a fase `sala` sem reserva | U, carga | o critério | |

## Como testar

- Varredura: `execucao-interrompida.int.test.ts` › "varredura, limiar: a `rodando` de 301 s é encerrada com a linha estimada…"
- Reentrega: o mesmo arquivo › "worker morto: a reentrega encerra com EXECUCAO_INTERROMPIDA…" (a `cenarios.md` cita
  `fila-de-ia.int.test.ts`; o precedente é este)
- Compartilhamento: `arquivo-do-titular.int.test.ts` › "a linha estimada da execução interrompida (sem `aluno_id`…"
- Carga: `infra/test/carga.test.ts` › "a espera da B acima da base + margem reprova o cenário…"; o roteiro em
  `docs/runbook.md`, "Rodar o cenário de carga"
- `npx vitest run --project integracao apps/api/src/ia/execucao-interrompida.int.test.ts`

## Fora do escopo desta tarefa

O roteamento (10.0); os preços reais (13.0).

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
