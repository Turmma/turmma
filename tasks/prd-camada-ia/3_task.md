# Tarefa 3.0 — A Operação define o orçamento de IA da escola e da rede, com auditoria

**Funcionalidade:** camada-ia · **Depende de:** 2.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`
**Porte:** grande

## Objetivo

O operador grava o valor por aluno e o teto de segurança de uma escola ou de uma rede; cada mudança efetiva vai à auditoria.

## Contexto necessário

- `techspec.md` §4 (as duas linhas `PUT` e as `GET` estendidas), §5 ("O `PUT`"), §6, §7 (auditoria), §7c ("Corridas")
- `prd.md` RF7, §8
- `cenarios.md` §1 RF7 (todas), §2 ("`PUT` da escola", "`PUT` da rede", "Operação", "Exceções declaradas"), §3 (as quatro primeiras)

- Código: `apps/api/src/operacao/painel/painel.service.ts` (`naEscola`, `runInContext`), `painel.controller.ts`,
  `apps/api/src/operacao/escola/escola.repository.ts` (o `@Unscoped` da rede), `packages/core/src/auditoria/acoes.ts`,
  `packages/shared/src/operacao/painel.ts`, `apps/api/test/registered-routes.ts` (`ROTAS_DO_PAINEL`)

## Subtarefas

- [ ] 3.1 — `PUT /v1/operacao/escolas/:id/orcamento-ia`, no contexto da escola `:id`; `PUT /v1/operacao/redes/:id/orcamento-ia`
  pelo `OrcamentoDaRedeRepository`, com um único `@Unscoped` ("acima do tenant"); entrada em centavos, saída em micros
- [ ] 3.2 — Uma transação: `insert … on conflict do nothing`, `select … for update`, `antes`, gravação, auditoria só se `antes ≠ depois`
- [ ] 3.3 — `escola.orcamento_ia_alterado` e `rede.orcamento_ia_alterado` em `acoes.ts`, fora da leitura da coordenação
- [ ] 3.4 — `redes()` e `escolas()` do `PainelRepository` com o orçamento próprio e o vigente; `escolasQueUsamOValorDaRede` conta valor ou teto vindo da rede
- [ ] 3.5 — As rotas em `ROTAS_DO_PAINEL`
- [ ] 3.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/operacao/painel/painel.controller.ts`, `apps/api/src/operacao/painel/painel.service.ts`, `apps/api/src/operacao/painel/painel.repository.ts` | alterado |
| `apps/api/src/operacao/painel/orcamento-da-rede.repository.ts` | novo |
| `packages/shared/src/operacao/painel.ts`, `packages/shared/src/operacao/painel.test.ts` | alterado |
| `packages/core/src/auditoria/acoes.ts` | alterado |
| `apps/api/test/painel-escrita.int.test.ts`, `apps/api/test/painel-leitura.int.test.ts`, `apps/api/test/registered-routes.ts`, `apps/api/test/architecture.test.ts` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| `PUT` da escola: auditoria com `antes`, `depois` e o operador | I | RF7 | |
| o mesmo `PUT` de novo: nenhuma auditoria nova (escola e rede) | I | só se mudou | |
| `PUT` da rede: auditoria com `escola_id` nulo | I | a ação da rede | |
| contagem: valor próprio e teto da rede conta; teto próprio e valor da rede conta; os dois próprios não; escola da rede 2 não conta na 1 | I | `escolasQueUsamOValorDaRede` | |
| `GET /redes` e `/escolas`: o orçamento próprio e o vigente | I | RF11 | |
| 0, R$ 100,01, 99, 1001 recusam; R$ 0,01, R$ 100,00, 100, 1000 passam; nulo volta à rede | I, U | os limites | |
| 500 centavos: 5.000.000 micros | U | o fator | |
| escola sem ano `em_curso`: grava, audita e devolve o vigente | I | o contexto sem ano | |
| id de escola e de rede inexistente: `NAO_ENCONTRADO`, com o corpo da rota inexistente | I | regra 10.6 | |
| 429 no `PUT` | I | o limitador | |
| corrida, a escola sem linha: dois `PUT` de valores diferentes, o primeiro segurado; vale o segundo, duas auditorias, o `antes` da segunda é o `depois` da primeira, nenhum 500 | I | `for update` e `on conflict` | |
| corrida: dois `PUT` da escola com o mesmo valor, uma auditoria | I | `antes` na trava | |
| corrida: o mesmo para a rede, valores diferentes e iguais | I | a trava da rede | |
| isolamento: o `PUT` em A não muda B; na rede 1, não muda a rede 2 | I | o `where` | |
| coordenação, professor e aluno nas rotas novas: 404 com o corpo do inexistente | I | `ROTAS_DO_PAINEL` | |
| `OrcamentoDaRedeRepository` com exatamente um `@Unscoped` | arquitetura | a exceção | |
| a coordenação não lê `escola.orcamento_ia_alterado` | I | RF12 | |

## Como testar

- Corrida: `apps/api/test/painel-escrita.int.test.ts` › "POST /redes: o segundo espera o primeiro no índice do id…";
  `WriteBlockTrigger` e `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`)
- Inexistente: `painel-escrita.int.test.ts` › "E5: rede inexistente é NAO_ENCONTRADO, sem escola nem auditoria"
- Varredura de 404: `apps/api/test/operacao-isolamento.int.test.ts` › "sessão de coordenador, professor e aluno… toda rota
  @RotaDeOperacao responde igual a rota inexistente"
- Exceção declarada: `apps/api/test/architecture.test.ts` (o I1)
- Fixture: `apps/api/test/painel.fixture.ts`
- `npx vitest run --project integracao apps/api/test/painel-escrita.int.test.ts`

## Fora do escopo desta tarefa

O diálogo (7.0); a leitura do uso (5.0).

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
| `tenancy-guardian`, rodada 3 | gravar a rede no `EscolaRepository` | recusada: a rede fica no `OrcamentoDaRedeRepository` (Tech Spec §6) |
