# Tarefa 2.0 — O orçamento de IA existe no banco e na conta: colunas, retrato do mês e a leitura por escola

**Funcionalidade:** camada-ia · **Depende de:** 1.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

O orçamento do mês da escola (valor por aluno × alunos ativos, com o teto) sai de uma função pura e de um repository só,
com escopo, que a API, o lote e a medida usam.

## Contexto necessário

- `techspec.md` §2, §3, §4 (`situacao`, `aviso`), §5 ("Alunos ativos"), §6, §7
- `prd.md` RF7, RF8, §7 (os quatro casos do orçamento), §8
- `cenarios.md` §1 RF7 (precedência), RF8 (todas), §2 (as quatro primeiras linhas e "Exceções declaradas")

- Código: `packages/core/drizzle/0064_indice_da_classificacao_atrasada.sql` (índice à parte), `painel.repository.ts` ›
  `escolas()` (a contagem de alunos, que vira o trecho comum), `packages/core/src/material/classificacao-atrasada.repository.ts`

## Subtarefas

- [ ] 2.1 — Migration de expansão: as duas colunas em `configuracao_operacional_escola` e em `rede`, com os checks;
  `orcamento_ia_do_mes` com `pk (escola_id, mes)`; `consumo_ia.pelo_provedor_de_reserva`
- [ ] 2.2 — Migration própria do `consumo_ia_mes_idx`, sem `concurrently`, `lock_timeout` de 5 s; `consumo_ia_funcao_idx`, se o `EXPLAIN` o mostrar redundante, sai nela (`infra-guardian`, rodada 2)
- [ ] 2.3 — `packages/shared/src/governanca/orcamento-de-ia.ts`: a precedência coluna a coluna, o teto padrão de 200%, a
  porcentagem, `situacao` e `aviso`; o mês e o "hoje" de São Paulo
- [ ] 2.4 — `packages/core/src/ia/orcamento-do-mes.repository.ts`: soma do mês, alunos ativos (o trecho da aba Escolas,
  exportado para o `uso()` da 5.0), configuração, rede, leitura e regravação do retrato; o "agora" entra como parâmetro
- [ ] 2.5 — Docs: glossário ("Orçamento de IA" sem corte, os três termos novos), modelo de dados (por que o retrato não
  tem `anoLetivoId`), a linha do orçamento em `docs/lgpd.md`, `classificacao.ts` (`sem_pessoa`)
- [ ] 2.6 — `IA_ORCAMENTO_ESGOTADO` em `packages/shared/src/errors/`, para a 4.0 não tocar o `shared`
- [ ] 2.7 — `docs/runbook.md`, "Voltar o código depois da camada-ia 2.0"
- [ ] 2.8 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0066_orcamento_de_ia.sql`, `packages/core/drizzle/0067_indice_do_consumo_do_mes.sql`, `packages/core/drizzle/meta/_journal.json` | novo e alterado |
| `packages/core/src/db/schema/configuracao-operacional-escola.ts`, `packages/core/src/db/schema/rede.ts`, `packages/core/src/db/schema/consumo-ia.ts`, `packages/core/src/db/schema/orcamento-ia-do-mes.ts` | novo e alterado |
| `packages/shared/src/governanca/orcamento-de-ia.ts`, `packages/shared/src/governanca/orcamento-de-ia.test.ts`, `packages/shared/src/index.ts`, `packages/shared/src/privacidade/classificacao.ts` | novo e alterado |
| `packages/shared/src/errors/error-code.ts`, `packages/shared/src/errors/messages.ts` | alterado |
| `packages/core/src/ia/orcamento-do-mes.repository.ts`, `packages/core/src/ia/orcamento-do-mes.repository.int.test.ts`, `packages/core/src/index.ts` | novo e alterado |
| `apps/api/test/architecture.test.ts` | alterado |
| `docs/glossario.md`, `docs/modelo-de-dados.md`, `docs/lgpd.md`, `docs/runbook.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| escola sem valor, rede R$ 5: vale a rede, `origemDoValor = rede`; escola com R$ 3: vale 3 | U | precedência | |
| escola com teto próprio e sem valor: valor da rede, teto da escola | U | coluna a coluna | |
| 100 alunos, R$ 5, R$ 400: 80% | U | a conta | |
| a chamada de 31/03 23h30 (UTC-3) conta em março; a de 23h30 conta no "hoje" certo (relógio falso) | I | mês e dia de São Paulo | |
| duas vigências no mês: a soma usa o custo gravado de cada linha | I | sem recalcular na leitura | |
| vínculo encerrado não conta; o que chegou hoje conta | I | alunos ativos | |
| vínculo não encerrado do ano anterior não conta; sem ano `em_curso`, zero | I | ano em curso | |
| aluno em duas turmas: uma vez | I | `distinct` | |
| retrato: regravar não duplica; o fechado guarda o último, mesmo com o valor mudado | I | retrato | |
| isolamento: soma, alunos ativos, configuração (variante 1) e rede (variante 2), conferindo A e B | I | as quatro cláusulas | |
| `OrcamentoDoMesRepository` sem `@Unscoped` | arquitetura | exceção declarada | |
| `EXPLAIN (ANALYZE, BUFFERS)` da soma do mês, num ano da maior escola | I | o índice | |
| a `0067` tem `lock_timeout` e nenhum `concurrently` | U | a migration do índice | |
| os checks (valor > 0, teto 100 a 1000) | I | restrição | |

## Como testar

- Isolamento com A e B: `apps/worker/test/importacao-gauge.int.test.ts` › "a importação de B não aparece na série de A…"
- `EXPLAIN`: `apps/api/test/semana-itens.int.test.ts` (`consultasDosItens`)
- Migration com check: `packages/core/src/db/migracao-classificacao.int.test.ts`
- `npx vitest run --project integracao packages/core/src/ia/orcamento-do-mes.repository.int.test.ts`

## Fora do escopo desta tarefa

As rotas (3.0, 5.0, 6.0), o teto do lote e a medida (4.0).

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
