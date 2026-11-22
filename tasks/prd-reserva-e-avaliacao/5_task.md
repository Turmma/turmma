# Tarefa 5.0 — A chamada da reserva chega ao banco e ao compartilhamento do aluno, e o worker só a chama conferida

**Funcionalidade:** reserva-e-avaliacao · **Depende de:** 2.0, 4.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`
**Porte:** grande

## Objetivo

No `main-worker` montado de verdade: a linha da chamada da reserva é gravada com o provedor dela e `pelo_provedor_de_reserva`
verdadeira; o compartilhamento do aluno lista os dois suboperadores; e a reserva recusada na conferência (2.0) não recebe
chamada, até ser corrigida sem reiniciar. Fecha a pendência da linha 99 de `docs/lgpd.md` (`TODO.md`).

## Contexto necessário

- `techspec.md` §3, §5 ("A bancada"), §7 (a linha 99)
- `prd.md` RF1, RF5, §8
- `cenarios.md` §1: RF1 (a parte "com o principal fora, a chamada termina `IA_INDISPONIVEL` sem chamar a reserva" e "O cadastro
  corrigido, sem reiniciar…"); RF3 ("A reserva é tentada uma vez…", a parte do lote em `fila-de-ia.int.test.ts`); RF5 ("O mesmo caso
  misto pela bancada do gateway real…")
- `TODO.md`: as linhas "(camada-ia, 2.0, privacy-guardian…) `pelo_provedor_de_reserva` na linha 99…" e "(camada-ia, validação…)
  `docs/mvp-contratos.md:213`"
- Código: `apps/api/src/ia/consumo.repository.ts`, `apps/api/test/fila-de-ia.fixture.ts` (`comModelo` troca o gateway inteiro:
  aqui não serve), `apps/api/src/ia/reserva-na-subida.int.test.ts` (2.0), `packages/core/src/titular/leitura-do-titular.ts`

## Subtarefas

- [ ] 5.1 — O `ConsumoRepository` grava `pelo_provedor_de_reserva`
- [ ] 5.2 — A bancada de `fila-de-ia.fixture.ts` monta o gateway real com dois `ScriptedAdapter` de envio externo, cada um com
  `provedorId` e suboperador próprios
- [ ] 5.3 — `docs/lgpd.md` linha 99 (§7); "enviadas" nos comentários de `consumo.ts`, `consumo-ia.ts` e `leitura-do-titular.ts`;
  "saída de reserva" no `docs/glossario.md`; `docs/mvp-contratos.md:213`; as duas linhas do `TODO.md` marcadas
- [ ] 5.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/ia/consumo.repository.ts`, `apps/api/test/fila-de-ia.fixture.ts` | alterado |
| `apps/api/src/ia/fila-de-ia.int.test.ts`, `apps/api/src/ia/reserva-na-subida.int.test.ts`, `apps/api/test/arquivo-do-titular.int.test.ts` | alterado |
| `packages/core/src/ia/consumo.ts`, `packages/core/src/db/schema/consumo-ia.ts`, `packages/core/src/titular/leitura-do-titular.ts` | alterado |
| `docs/lgpd.md`, `docs/glossario.md`, `docs/mvp-contratos.md`, `TODO.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| prazo no principal, reserva atende, pela bancada: duas linhas no banco, o `provedor` de cada uma e `pelo_provedor_de_reserva` `false` e `true` | I | a coluna gravada | dois `provedorId` | |
| o mesmo caso: o compartilhamento do aluno lista os dois suboperadores | I | LGPD art. 18, VII | dois suboperadores | |
| a chamada só pela reserva: o compartilhamento lista só o dela | I | o provedor de cada linha | o principal sem linha | |
| reserva recusada na conferência e principal fora: `IA_INDISPONIVEL` sem chamá-la | I | RF1 no roteamento | contador na reserva | |
| o cadastro corrigido sem reiniciar: a chamada seguinte, com o principal fora, vai à reserva | I | a reconferência | o mesmo worker | |
| principal e reserva fora no lote: `JobAdiadoError(provedor)`, uma chamada à reserva | I | sem laço | contador de chamadas no principal e na reserva | |
| isolamento: a linha da reserva da escola B fica fora do arquivo do aluno da A | I | regra 10 | duas escolas com a mesma reserva | |

## Como testar

- Compartilhamento: `apps/api/test/arquivo-do-titular.int.test.ts` › "a linha estimada da execução interrompida (sem `aluno_id`, ligada
  pela execução que o aluno pediu) entra no arquivo dele, com o provedor, e a do colega da turma não" e › "D85: isolamento: a linha da escola B…"
- Subida e conferência: `reserva-na-subida.int.test.ts` (2.0); `soberania-na-subida.int.test.ts` › "externo com o cadastro que não cobre…
  corrigido o cadastro, passa a consumir sozinho"
- Lote: `fila-de-ia.int.test.ts` › "o provedor indisponível numa ferramenta, que não é do lote, não adia…" (o par do lote)
- `npx vitest run --project integracao apps/api/test/arquivo-do-titular.int.test.ts apps/api/src/ia/reserva-na-subida.int.test.ts`
- Armadilha: a bancada é o único lugar que monta o gateway (`tools/guardas/executor-so-na-bancada.test.ts`); não monte outro no teste

## Fora do escopo desta tarefa

A interrompida e a contagem da Operação (8.0).

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
