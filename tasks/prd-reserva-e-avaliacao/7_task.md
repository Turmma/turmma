# Tarefa 7.0 — Sem vaga no principal, a chamada vai ao menor e depois à reserva, no balde dela

**Funcionalidade:** reserva-e-avaliacao · **Depende de:** 6.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`
**Porte:** grande

## Objetivo

Sem vaga no principal (balde cheio ou `limite`, da 3.0), depois da espera e do modelo menor quando a tarefa o tem, a chamada vai à
reserva elegível, no balde `provedor:modelo` dela; sem vaga ali, `IA_INDISPONIVEL`/`sem_vaga`. O Tutor e a classificação vão
direto da espera à reserva, sem o menor. O uso do teto passa a ser por `provedor:modelo`.

## Contexto necessário

- `techspec.md` §5 ("A chamada" (1); "O destino por chamada": `usosDoTeto`), §7c
- `prd.md` RF2, RF3 (o limite), `.claude/rules/80-infra-e-carga.md` item 4
- `cenarios.md` §1: RF2 ("O mesmo com o principal **sem vaga**…"); RF4 (o controle positivo pelo sem vaga; a reserva falsa: as duas
  séries de `ia.tokens.uso_do_teto`); RF3 ("Com modelo menor disponível…", "O 429 que sobra da repetição…" até a reserva, "O mesmo
  no Tutor e na classificação…", "O 4xx rejeitado…" com o menor e a reserva, "Sem vaga no principal: o provedor de reserva usa o
  balde dele…")
- `revisao-spec.md`, rodada 8, "O que vai para as tarefas": o alerta de tokens por `provedor` e `modelo`; `docs/infra.md` 5.4
- Código: `llm-gateway.ts` (`reservarVaga`, `chaveDoBalde`, `anotarUsoDoTeto`, `usosDoTeto`, `descer`), `token-limiter.ts`,
  `infra/grafana/alertas/ia-tokens-acima-do-teto.yaml`

## Subtarefas

- [ ] 7.1 — O ramo sem vaga (§5 (1)): espera, menor (se a tarefa o tem), reserva elegível no limitador dela (2.0); a mesma função
  de elegibilidade da queda
- [ ] 7.2 — `usosDoTeto` e `ia.tokens.uso_do_teto` por `provedor:modelo`
- [ ] 7.3 — `ia-tokens-acima-do-teto.yaml` agrupado por `provedor` e `modelo`; `docs/infra.md` 5.4 diz se a reserva de mesmo
  provedor divide o contratado
- [ ] 7.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/ia/llm-gateway.ts`, `packages/core/src/ia/llm-gateway.test.ts` | alterado |
| `infra/grafana/alertas/ia-tokens-acima-do-teto.yaml`, `infra/test/alertas.test.ts` | alterado |
| `docs/infra.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| sem vaga, com menor disponível e reserva elegível: vai ao menor, não à reserva | U | regra 80.4 | a reserva elegível presente | |
| sem vaga no principal e no menor: à reserva, no balde dela; o degrau soma | U | o ramo 1 | o balde da reserva vazio, o do principal cheio | |
| o 429 que sobra, com o menor também sem vaga: linhas na ordem, a estimada do principal, a do menor e a da reserva | U | o `limite` até a reserva | a ordem das três | |
| Tutor e classificação, com `modelosMenores` do `rapido` configurado: o `limite` vai direto à reserva aprovada | U | D36 | o menor configurado e não chamado | |
| sem vaga também na reserva: `IA_INDISPONIVEL`, `sem_vaga` | U | balde próprio | só o balde da reserva cheio decide: com ele vazio, o mesmo caso atende | |
| aprovação só da geração, principal sem vaga, sem menor: a geração vai à reserva; o Tutor termina `sem_vaga` sem chamá-la | U | a elegibilidade nos dois ramos | as duas tarefas | |
| Tutor aprovado no `rapido` da reserva, sem vaga: a reserva atende sem passar pelo menor | U | RF4 positivo | `modelosMenores` configurado para o `rapido` | |
| reserva falsa com o mesmo modelo do principal falso: `ia.tokens.uso_do_teto` em duas séries | U | por `provedor:modelo` | o mesmo modelo nos dois | |
| o alerta de tokens agrupa por `provedor` e `modelo` | U | a X6 | a `expressao` lida do yaml | |

## Como testar

- `llm-gateway.test.ts` › "degrau 2: passados os 8 s sem vaga, vai ao modelo menor do perfil…" e › "degrau 3: sem vaga no principal nem no
  menor, termina IA_INDISPONIVEL aos 8 s…" (o balde falso e o relógio): acrescente o limitador da reserva
- `llm-gateway.test.ts` › "sem modelo menor configurado para o perfil, o degrau é pulado e a métrica dele não muda"
- Balde: `token-limiter.test.ts` › "o balde é de cada provedor:modelo: o menor tem o seu"
- Alerta: `infra/test/alertas.test.ts`, o bloco do `provedorFora` (`expressao`), para o de tokens
- `npx vitest run --project unidade packages/core/src/ia/llm-gateway.test.ts`
- Armadilha: o `usosDoTeto` de hoje é por modelo; os dois falsos têm o mesmo modelo, e é esse o caso que distingue

## Fora do escopo desta tarefa

A carga (9.0).

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
