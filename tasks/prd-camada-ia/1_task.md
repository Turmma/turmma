# Tarefa 1.0 — Toda chamada ao modelo grava o seu custo, pelo preço vigente, numa linha só dela

**Funcionalidade:** camada-ia · **Depende de:** nenhuma
**Subagentes obrigatórios:** `privacy-guardian`, `infra-guardian`, `llm-integrator`
**Porte:** grande

## Objetivo

Cada chamada enviada ao adaptador grava a sua linha em `consumo_ia`, com custo em micros pelo preço vigente (hoje é
sempre zero, numa linha por execução); a Governança passa a contar execuções, não linhas.

## Contexto necessário

- `techspec.md` §1, §2 (`packages/core/src/ia/`), §3 ("Uma linha por chamada enviada", "A estimativa", primeira frase),
  §5 ("A subida": modelo sem preço), §7c ("Volta do código")
- `prd.md` RF5, RF6, §6 (D14), §7 ("Preço sobe no meio do mês")
- `cenarios.md` §1: RF5 (as três primeiras linhas e a da Governança), RF6 (as quatro primeiras)
- `.claude/rules/30-camada-ia.md` (item 4), `80-infra-e-carga.md`
- Código: `consumo.ts` (`PRECO_DOS_MODELOS`), `llm-gateway.ts` (`chamarAteValer`, o registro, `exigirPrecoDosModelosMenores`),
  `apps/api/src/ia/consumo.repository.ts`, `apps/api/src/governanca/governanca.repository.ts`

## Subtarefas

- [ ] 1.1 — `PRECO_DOS_MODELOS` com chave `provedor:modelo`, uma lista de vigências (`vigenteDesde`, `fonte`, entrada e saída
  em micros por mil tokens); `custoDaChamada(tokens, preço)` com `ceil`; o preço é o da vigência no instante da chamada
- [ ] 1.2 — O gateway grava uma linha por chamada enviada (`tentativas = 1`): a saída inválida grava `falhou`/`IA_SAIDA_INVALIDA`,
  `entrada` e `saida` só na última; a troca para o menor leva o modelo e o preço de cada um; a chamada que saiu sem uso
  (prazo, conexão, servidor) grava a entrada contada e a saída no teto da tarefa; a que não saiu não grava
- [ ] 1.3 — Fora de `local`, com `openai_compat`, a subida recusa modelo do principal sem preço, citando a variável
- [ ] 1.4 — A Governança conta `count(distinct execucao_id)`
- [ ] 1.5 — `docs/runbook.md`, "Voltar o código depois da camada-ia 1.0": a anterior conta linhas como execuções; a web
  antiga com a API nova cai no `ErrorState` (vale também para a 6.0)
- [ ] 1.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/ia/consumo.ts`, `packages/core/src/ia/consumo.test.ts` | alterado |
| `packages/core/src/ia/llm-gateway.ts`, `packages/core/src/ia/llm-gateway.test.ts` | alterado |
| `packages/core/src/config/llm-config.ts`, `packages/core/src/config/llm-config.test.ts` | alterado |
| `packages/core/src/index.ts` | alterado |
| `apps/api/src/ia/consumo.repository.ts`, `apps/api/src/ia/ia.int.test.ts` | alterado |
| `apps/api/src/governanca/governanca.repository.ts`, `apps/api/src/governanca/governanca.int.test.ts` | alterado |
| `docs/runbook.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| 3.000 + 250 tokens a 1.300 e 5.200 micros por mil: 5.200 | U | a conta | |
| 1.001 + 1 tokens: para cima | U | `ceil` | |
| duas vigências do mesmo modelo: cada chamada no seu preço; a linha antiga não muda | U, I | preço novo só nas seguintes | |
| o mesmo modelo em dois provedores, a preços diferentes | U | a chave `provedor:modelo` | |
| primeira saída inválida, segunda válida: duas linhas, cada uma com os seus tokens e custo | I | uma linha por chamada | |
| `entrada` e `saida` só na segunda linha | I | regra 20 | |
| troca para o menor: duas linhas, modelo e preço de cada um | I | o modelo que atendeu | |
| prazo esgotado depois do envio: a linha tem entrada contada, saída no teto, custo > 0 | I | D14 | |
| disjuntor aberto: nenhuma linha | U | só o que saiu | |
| principal inválido duas vezes: duas linhas | U | o limite | |
| `AMBIENTE=producao`, `openai_compat`, modelo sem preço: a subida recusa citando a variável | U | modelo sem preço não sobe | |
| Governança com uma execução de duas linhas: `execucoes = 1` | I | `count(distinct)` | |


## Como testar

- Conta: `packages/core/src/ia/consumo.test.ts` › "os dois do adaptador falso custam zero; modelo que não está na tabela não
  tem preço" (a forma de montar a tabela)
- Linhas por chamada: `packages/core/src/ia/llm-gateway.test.ts` › "degrau 2: passados os 8 s sem vaga, vai ao modelo menor
  do perfil…" (o menor e o consumo); `ScriptedAdapter` (`packages/core/src/ia/__fixtures__/scripted-adapter.ts`) para a
  inválida e o prazo
- Subida: `packages/core/src/config/llm-config.test.ts` › "em produção o adaptador falso é recusado…"
- Governança: `apps/api/src/governanca/governanca.int.test.ts` › "o mês sem consumo responde zerado…"
- `npx vitest run --project unidade packages/core/src/ia/` e `npx vitest run --project integracao apps/api/src/ia/ia.int.test.ts`


## Fora do escopo desta tarefa

A coluna `pelo_provedor_de_reserva` (2.0); o provedor de reserva (9.0 a 11.0); a estimada da interrompida com dois destinos (11.0).

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
