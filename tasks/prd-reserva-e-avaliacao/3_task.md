# Tarefa 3.0 — A causa da falha atravessa o `ResilientAdapter`: o 429 que sobra é falta de vaga, o 4xx não é queda

**Funcionalidade:** reserva-e-avaliacao · **Depende de:** 1.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`
**Porte:** grande

## Objetivo

O `traduzir` do `ResilientAdapter` deixa de apagar a classificação do `ProviderError`: o `LLMError` ganha os motivos `limite`
(o 429 que sobrou da repetição) e `rejeitada` (outro 4xx), fora de `semEnvio`. No gateway, o `limite` desce o degrau do modelo
menor, como o balde cheio; a `rejeitada` termina sem degrau. A linha da chamada que saiu e voltou com 429 ou conexão recusada
leva a estimativa (D14) e o provedor dela. Sem reserva ainda: o degrau dela é da 7.0.

## Contexto necessário

- `techspec.md` §5 ("A causa da falha"; "A chamada", o ramo 1 até o menor)
- `prd.md` RF3 (a parte do limite), §6 (D14)
- `cenarios.md` §1 RF3: "O 429 que sobra da repetição…" (só até o menor), "O 4xx rejeitado (401…)" (sem a reserva, que a 4.0
  acrescenta), "O 429 que sobra e a conexão recusada gravam a estimativa…"
- `TODO.md`, linha "(camada-ia, validação, 22/11/2026) `tasks/prd-camada-ia/1_task.md:410`": esta tarefa a fecha
- Código: `packages/core/src/ia/errors.ts` (`MotivoDaIndisponibilidade`, `semEnvio`), `resilient-adapter.ts` (`traduzir`, a repetição
  do 429 e o `Retry-After`), `llm-gateway.ts` (o degrau do menor, `chamadaSemUso`), `__fixtures__/fake-llama-server.ts`

## Subtarefas

- [ ] 3.1 — `limite` e `rejeitada` em `MotivoDaIndisponibilidade`, fora de `semEnvio`; o `traduzir` os preserva; sem motivo
  continuam o 5xx e a conexão. Confira cada leitor de `motivo` e de `semEnvio` (`grep -rn "semEnvio\|\.motivo" packages apps`)
- [ ] 3.2 — No gateway, o `limite` desce ao modelo menor (a tarefa que o tem; o Tutor e a classificação não, D36), e sem menor
  termina `IA_INDISPONIVEL` como o balde cheio; a `rejeitada` termina `IA_INDISPONIVEL` sem degrau
- [ ] 3.3 — A linha do 429 que sobra e da conexão recusada: entrada contada, saída no teto, o provedor; o comentário de
  `errors.ts` e o de `consumo.ts` com a regra
- [ ] 3.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/ia/errors.ts` | alterado |
| `packages/core/src/ia/resilient-adapter.ts`, `packages/core/src/ia/resilient-adapter.test.ts` | alterado |
| `packages/core/src/ia/llm-gateway.ts`, `packages/core/src/ia/llm-gateway.test.ts` | alterado |
| `TODO.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| o 429 que sobra, sem `Retry-After`, pelo `ResilientAdapter` real: `LLMError` com `limite`, `semEnvio` falso | U | o `traduzir` | adaptador interno que lança `ProviderError` de verdade | |
| o mesmo com `Retry-After` além do prazo: `limite`, com a espera sugerida | U | as duas formas do 429 | a espera que vai a quem chamou | |
| 401 e 403: `rejeitada`; 500 e conexão: sem motivo | U | a classificação | um código por caso | |
| `limite` no principal, tarefa com menor: vai ao menor; as linhas, na ordem: a estimada do principal (`envio_externo`, o provedor) e a do menor | U | regra 80.4 | a ordem das duas linhas | |
| `limite` no Tutor e na classificação, com `modelosMenores` configurado para o `rapido`: não vai ao menor; `IA_INDISPONIVEL` | U | D36 | o menor configurado e não usado | |
| `rejeitada` no principal, com menor disponível: não vai ao menor; termina `IA_INDISPONIVEL` | U | não é falta de vaga | o menor disponível | |
| a linha do 429 e a da conexão recusada: entrada contada, saída no teto, custo > 0, o provedor | U | D14 | preço diferente de zero injetado | |
| a variante sem reserva do "degrau 3" segue igual à da X6 | U | sem regressão | — | |

## Como testar

- O 429: `resilient-adapter.test.ts` › "429 duas vezes: nunca uma terceira, e o erro é o de indisponível" e › "429 com Retry-After além do
  prazo: nenhuma repetição, e a espera sugerida vai para quem chamou" — acrescente a asserção do `motivo`
- O degrau: `llm-gateway.test.ts` › "degrau 2: passados os 8 s sem vaga, vai ao modelo menor do perfil…" (o balde falso e o relógio);
  aqui a falta de vaga vem do 429, com o `ResilientAdapter` real sobre um adaptador que lança `ProviderError`
- O motivo vazio: `llm-gateway.test.ts` › "o provedor que falhou depois de a chamada sair não é `semEnvio`: o motivo fica vazio e a linha de
  consumo registra a falha"
- O servidor falso: `__fixtures__/fake-llama-server.ts`, como em `openai-compat-adapter.test.ts`
- `npx vitest run --project unidade packages/core/src/ia/resilient-adapter.test.ts packages/core/src/ia/llm-gateway.test.ts`
- Armadilha: `limite` em `semEnvio` apaga a linha do principal; a mutação "limite em semEnvio" tem de ficar vermelha

## Fora do escopo desta tarefa

A reserva depois do menor (7.0); a `rejeitada` com reserva elegível (4.0).

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
