# Tarefa 11.0 — O resumo no topo da aba Material

**Funcionalidade:** ingestao-do-material · **Depende de:** 7.0
**Subagentes obrigatórios:** `tenancy-guardian`, `frontend-reviewer`
**Porte:** pequeno

## Objetivo

No topo da aba Material, a coordenação vê, por disciplina e série, quantos materiais estão prontos, processando e com
falha, quantos envios foram recusados em 30 dias, e quantos estão sem série.

## Contexto necessário

- `techspec.md` §4 (`GET /v1/materiais/resumo`), §7 (resumo só da coordenação), §7b (resumo sem pessoa), §7c (o índice da auditoria), §9 (Material), §13
- `prd.md` RF18, RF20
- `cenarios.md` "Resumo", "Telas" (Resumo, lista), "Permissão…", "Isolamento"
- `.claude/rules/`: 10, 40, 50, 70 (item 9), 80 (índice sem `concurrently`, exceção da 0034)
- Código: `apps/api/src/material/material.controller.ts`, `apps/api/src/material/material.repository.ts`; `apps/web/src/areas/coordenacao/material/Material.tsx`, `apps/web/src/areas/coordenacao/material/materiais-da-escola.ts`

## Subtarefas

- [ ] 11.1 — Migration: índice `auditoria (escola_id, em) where acao = 'material.recusado'`
- [ ] 11.2 — `GET /v1/materiais/resumo`: por disciplina e série, `pronto`, `processando`, `falhou`, `recusados30Dias` (`MATERIAL_SEM_LICENCA` e `LICENCA_VENCIDA`), e `semSerie`; excluído e substituído não contam; só coordenação
- [ ] 11.3 — O resumo na tela: lista a 360 px, tabela no Chromebook; o aviso "séries atribuídas na migração"; os quatro estados; a lista de materiais com "Mostrar mais"
- [ ] 11.4 — `docs/interface.md`: a aba Material com o resumo
- [ ] 11.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0057_*.sql`, `apps/api/test/material-resumo.int.test.ts`, `apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx`, `apps/web/src/areas/coordenacao/material/ResumoDoMaterial.test.tsx`, `apps/web/src/areas/coordenacao/material/api/resumo.ts` | novo |
| `packages/shared/src/material/material.ts`, `packages/shared/src/permissao/matriz.ts`, `apps/api/src/material/material.controller.ts`, `apps/api/src/material/material.service.ts`, `apps/api/src/material/material.repository.ts`, `apps/web/src/areas/coordenacao/material/Material.tsx`, `apps/web/src/areas/coordenacao/material/Material.test.tsx`, `e2e/material.spec.ts`, `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| material com duas séries | I | conta nas duas | |
| excluído; substituído | I | não contam (um caso cada) | |
| `semSerie` | I | conta | |
| recusa de 29 dias; de 31 | I | conta; não conta, pelo mesmo `Clock` | |
| motivos | I | `MATERIAL_SEM_LICENCA` e `LICENCA_VENCIDA` contam; outro motivo não | |
| por disciplina e série | I | a recusa cai na série que ela conferiu | |
| isolamento | I | o resumo da A sem material nem recusa da B. Mutação: tirar o `escola_id` | |
| permissão: professor, aluno | I | recusado | |
| escola sem ano letivo | I | a coordenação vê | |
| estados do resumo | U | carregando, erro, vazio, com dado; o vazio só com a leitura terminada | |
| 360 px e Chromebook | U | lista e tabela | |
| aviso da migração | U | aparece com `semSerie` ou com séries do backfill | |
| lista: estados e "Mostrar mais" | U | um caso cada | |
| professor | E | não vê o resumo | |
| recomeço: segunda pessoa na aba | E | o resumo da anterior sai | |
| cabe em 1366 × 768 | E | `paginaNaoRola` | |

## Como testar

- Tela: `apps/web/src/areas/coordenacao/material/Material.test.tsx`, o `montar('/material')`; `materiais-da-escola.test.ts` › "o envio recusado é falha e vem na frente de tudo…"
- Rota: `apps/api/test/material.int.test.ts`, os casos de permissão; auditoria gravada como em `apps/api/test/importacao-alunos.int.test.ts:330`
- e2e: `e2e/material.spec.ts` › "a coordenação sobe o PDF de demonstração…"; `paginaNaoRola` e `linhasDaTabela` de `e2e/support/coordenacao.ts`
- Comandos: `npx vitest run --project integracao apps/api/test/material-resumo.int.test.ts`; `node tools/ci/e2e.ts --manter-ambiente e2e/material.spec.ts`
- Armadilha: 29 e 31 dias pelo mesmo `Clock`; o `EXPLAIN` do índice parcial no plano
- **Telas:** `coordenacao`, `/coordenacao/material` (resumo vazio, com dado, com `semSerie`; a 360 px)

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano. Na 1: cada motivo
da lista e cada estado que não conta são blocos. Na 3: a recusa de outro motivo é o segundo dado.

## Fora do escopo desta tarefa

O painel do material (12.0); cobertura por habilidade (F4b).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar
