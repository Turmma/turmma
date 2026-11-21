# Tarefa 10.0 — Com o principal caído ou sem vaga, a chamada vai ao provedor de reserva

**Funcionalidade:** camada-ia · **Depende de:** 9.0
**Subagentes obrigatórios:** `privacy-guardian`, `infra-guardian`, `llm-integrator`
**Porte:** grande

## Objetivo

O gateway leva a chamada à reserva elegível na queda do principal e na falta de vaga (depois da espera e do menor),
dentro do prazo, com quatro chamadas no máximo, e a linha de consumo diz quem atendeu. A carga é da 11.0.

## Contexto necessário

- `techspec.md` §5 ("A chamada"), §3 (`pelo_provedor_de_reserva`), §7 (log), §7c ("Dependência fora")
- `prd.md` RF2 a RF5, §7 (os dois primeiros casos)
- `cenarios.md` §1: as linhas de `llm-gateway.test.ts` (RF2 a RF4), RF1 (o roteamento), RF5 (prazo e compartilhamento)
- Código: `llm-gateway.ts` (`reservarVaga`, `chamarAteValer`), `resilient-adapter.ts`, `fake-adapter.ts`,
  `infra/grafana/alertas/ia-provedor-fora.yaml`

## Subtarefas

- [ ] 10.1 — Ramo da queda: disjuntor aberto, `IA_INDISPONIVEL` de servidor ou conexão, `IA_TEMPO_ESGOTADO` com o sinal
  vivo → a reserva elegível, uma vez; o 429 que sobra vale como sem vaga
- [ ] 10.2 — Ramo sem vaga: depois da espera e do menor, o balde `provedor:modelo` da reserva; o Tutor nunca vai ao menor (D36)
- [ ] 10.3 — Uma elegibilidade nos dois ramos (a da 9.0); a repetição fica no provedor que respondeu; quatro chamadas no máximo
- [ ] 10.4 — A linha com `provedor` da reserva e `pelo_provedor_de_reserva`; `ia.degradacao{degrau="provedor_de_reserva"}`;
  log `ia.geracao.provedor_de_reserva` só com ids e `provedorId`
- [ ] 10.5 — `IA_FALHA_FALSA=principal:5xx|prazo` no `FakeAdapter`; a subida em produção a recusa
- [ ] 10.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/ia/llm-gateway.ts`, `packages/core/src/ia/llm-gateway.test.ts`, `packages/core/src/ia/tasks/turno-do-tutor.test.ts` | alterado |
| `packages/core/src/ia/fake-adapter.ts`, `packages/core/src/ia/fake-adapter.test.ts` | alterado |
| `packages/core/src/config/llm-config.ts`, `packages/core/src/config/llm-config.test.ts` | alterado |
| `apps/api/src/ia/consumo.repository.ts`, `apps/api/src/ia/ia.int.test.ts`, `apps/api/src/ia/fila-de-ia.int.test.ts`, `apps/api/src/ia/reserva-na-subida.int.test.ts` | alterado |
| `apps/api/test/arquivo-do-titular.int.test.ts` | alterado |
| `infra/test/alertas.test.ts` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| disjuntor aberto, 5xx e conexão: à reserva; métrica +1 | U | o que é queda | |
| prazo com o sinal vivo: à reserva; com o sinal abortado: não | U | o prazo da execução | |
| sem vaga: o menor antes da reserva, também no 429 que sobra | U | regra 80.4 | |
| o balde da reserva é o dela; sem vaga ali: `IA_INDISPONIVEL`/`sem_vaga` | U | balde próprio | |
| principal e reserva fora: uma chamada à reserva; interativo indisponível; lote `JobAdiadoError(provedor)` | U, I | sem laço | |
| principal inválido duas vezes: não vai à reserva; 5xx e reserva inválida duas vezes: três linhas | U | quatro no máximo | |
| o 429 que sobra conta no principal: nunca uma quinta | U | o limite | |
| a inválida da reserva repete na reserva (a segunda com o `provedorId` dela) | U | o provedor que respondeu | |
| aprovação só para a geração, principal fora e sem vaga: a geração vai, o Tutor não, a D36 igual | U | por tarefa, nos dois ramos | |
| Tutor com o modelo da reserva trocado; `classificar_secoes` idem; outro `provedorId`: indisponível sem chamar | U | provedor e modelo | |
| reserva recusada na conferência e principal fora: `IA_INDISPONIVEL` sem chamá-la; corrigida sem reiniciar, a seguinte vai a ela | I | RF1 no roteamento | |
| `falso-reserva` com balde, rótulo e disjuntor seus | U | identidade | |
| prazo no principal, reserva atende: a do principal com a estimativa ao preço dele, custo > 0, `pelo_provedor_de_reserva = false`; a da reserva com o uso real e `true` | I | RF5 | |
| o compartilhamento do aluno lista o suboperador da reserva | I | LGPD art. 18, VII | |
| `IA_FALHA_FALSA` só no `FakeAdapter`; em produção recusa a subida | U | o falso fora de produção | |
| "Provedor de IA fora" por `provedor`; o "degrau 3" sem reserva igual | U | a X6 | |

## Como testar

- Degradação: `llm-gateway.test.ts` › "degrau 2: passados os 8 s sem vaga…" e › "degrau 3: sem vaga no principal nem no
  menor…" (o balde falso e o relógio)
- Compartilhamento: `arquivo-do-titular.int.test.ts` › "a linha estimada da execução interrompida…"
- `npx vitest run --project unidade packages/core/src/ia/llm-gateway.test.ts`

## Fora do escopo desta tarefa

A interrompida e a carga (11.0).

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
