# Tarefa 6.0 — A repetição com a reserva: no máximo quatro chamadas, dentro do prazo da execução

**Funcionalidade:** reserva-e-avaliacao · **Depende de:** 4.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`
**Porte:** grande

## Objetivo

A execução faz no máximo quatro chamadas, duas por destino, com um contador para o principal e outro para a reserva. A queda
na repetição do principal também vai à reserva, com o pedido sem a correção do principal; duas inválidas na reserva passam pela
saída de reserva da tarefa (`reservaQuandoInvalida`); e a quarta chamada que estoura o prazo termina `IA_TEMPO_ESGOTADO` tipado,
sem mudar `PRAZO_DA_EXECUCAO_MS`.

## Contexto necessário

- `techspec.md` §5 ("A chamada" (3) e (4), o contador), §7c ("Caminho quente")
- `prd.md` RF3
- `cenarios.md` §1 RF3: "O prazo, no molde de `prazo-com-tokens.int.test.ts`…", "No máximo quatro chamadas…", "Quatro e para…",
  "Duas inválidas na reserva de tarefa com `reservaQuandoInvalida`…"
- `docs/glossario.md`: "saída de reserva" (a 5.0 escreve), o outro sentido de "reserva"
- Código: `llm-gateway.ts` (`TENTATIVAS_MAXIMAS`, a repetição com `RepairHint`, `reservaQuandoInvalida`), `prazo-da-execucao.ts` e o
  comentário dele, `apps/api/src/ia/prazo-com-tokens.int.test.ts` (o relógio falso)

## Subtarefas

- [ ] 6.1 — O contador por destino (principal, reserva), e não por `provedorId`: principal e reserva do mesmo provedor com modelos
  diferentes contam em separado; quatro no máximo
- [ ] 6.2 — A queda na repetição do principal (a primeira inválida, a segunda com 5xx) vai à reserva, com o pedido original, sem a
  correção do principal; a inválida da reserva repete na reserva
- [ ] 6.3 — Duas inválidas na reserva: a `reservaQuandoInvalida` da tarefa com os `problemas` da última chamada da reserva
- [ ] 6.4 — O prazo: a reserva usa o que sobra do prazo da execução; o comentário de `prazo-da-execucao.ts` e `docs/infra.md` (o
  prazo com quatro chamadas)
- [ ] 6.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/ia/llm-gateway.ts`, `packages/core/src/ia/llm-gateway.test.ts` | alterado |
| `packages/core/src/ia/prazo-da-execucao.ts`, `packages/core/src/ia/prazo-da-execucao.test.ts` | alterado |
| `apps/api/src/ia/prazo-com-tokens.int.test.ts` | alterado |
| `docs/infra.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| principal inválido duas vezes: não vai à reserva; `IA_SAIDA_INVALIDA` | U | inválida não é queda | reserva elegível presente | |
| principal com 5xx, reserva inválida duas vezes: três linhas (a estimada do principal e as duas da reserva) | U | o contador da reserva | contagem exata de linhas | |
| principal inválido e depois 5xx, reserva inválida duas vezes, tarefa sem `reservaQuandoInvalida`: exatamente quatro linhas; a 1ª da reserva sem a correção do principal | U | quatro e para | o `RepairHint` lido na chamada da reserva | |
| o mesmo com principal e reserva de mesmo `provedorId` e modelos diferentes: quatro linhas | U | contador por destino | a chave do contador não é o `provedorId` | |
| duas inválidas na reserva de tarefa com `reservaQuandoInvalida`: a saída de reserva vale, com os `problemas` da última da reserva | U | a saída de reserva depois da queda | problemas diferentes no principal e na reserva | |
| a quarta chamada estoura: `IA_TEMPO_ESGOTADO` tipado, execução `falhou`, `fimEm` no prazo do perfil (140.000 no `padrao`, 60.000 no `rapido`) | I | §7c | relógio falso, os dois perfis | |
| `PRAZO_DA_EXECUCAO_MS` segue abaixo do job menos a folga | U | o prazo não muda | o teste da constante de hoje | |

## Como testar

- O prazo: `prazo-com-tokens.int.test.ts` › "a 2.ª reserva: a 1.ª resposta inválida aos 135 s e sem vaga para a 2.ª termina aos 140 s com
  IA_TEMPO_ESGOTADO, e não aos 143 s" (o relógio falso e o `fimEm`); aqui com a reserva pendurada na quarta. A "reserva" do nome
  desse caso é a reserva de tokens, não o provedor
- A constante: `prazo-da-execucao.test.ts` › "todo perfil tem prazo, e ele é menor que o `prazoMs` do job `ia.executar` menos a folga…"
- A repetição: os casos de saída inválida de `llm-gateway.test.ts` (`grep -n "IA_SAIDA_INVALIDA" packages/core/src/ia/llm-gateway.test.ts`),
  com dois `ScriptedAdapter` de `provedorId` distintos
- `npx vitest run --project unidade packages/core/src/ia/llm-gateway.test.ts`
- Armadilha: "reserva" no código de hoje é também a vaga de tokens (`ReservaDeTokens`) e a saída de reserva da tarefa; nomeie o
  contador pelo destino (`principal` | `provedorDeReserva`)

## Fora do escopo desta tarefa

O ramo sem vaga (7.0); a interrompida (8.0).

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
