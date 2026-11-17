# Tarefa 1.0 — A tabela da BNCC existe, carregada do `bncc-dados`, e a disciplina tem o componente

**Funcionalidade:** classificacao-bncc · **Depende de:** nenhuma
**Subagentes obrigatórios:** `tenancy-guardian`, `infra-guardian`, `frontend-reviewer`, `domain-researcher`
**Porte:** grande

## Objetivo

A tabela pública `habilidade_bncc` tem as habilidades dos anos finais e do EM, `COMPONENTES_BNCC` dá as candidatas, e
cada disciplina tem o componente: pelo nome na migration e na criação, e pela coordenação na Estrutura.

## Contexto necessário

- `techspec.md` §3, §4 (`PATCH /v1/disciplinas/:id`), §9 (Estrutura), §12
- `prd.md` RF1
- `cenarios.md` "Tabela BNCC e componente"
- `.claude/rules/`: 10 (item 1), 50, 80
- Código: `packages/shared/src/importacao/normalizador.ts` (`chaveDaDisciplina`);
  `packages/core/src/estrutura/disciplina.repository.ts` (`criar`, `renomear`);
  `apps/web/src/areas/coordenacao/estrutura/AnoEDisciplinas.tsx`

## Subtarefas

- [ ] 1.1 — Migration: `habilidade_bncc` com o check do código e a carga (§3 "Carga"), `on conflict (codigo) do update`, sem Computação
- [ ] 1.2 — Conferir 30 habilidades e as contagens contra o PDF homologado, com o hash no cabeçalho do JSON (o PDF vence)
- [ ] 1.3 — `COMPONENTES_BNCC` e as candidatas por série e componente em `packages/shared` (§3 "Componentes")
- [ ] 1.4 — `disciplina.componente_bncc` com o check; a migration e o `criar` casam pelo nome; renomear não muda
- [ ] 1.5 — `PATCH /v1/disciplinas/:id` com `componenteBncc` (nulo apaga) e `disciplina.componente_alterado` (antes e depois); sem agendar (6.0)
- [ ] 1.6 — A Estrutura mostra e define o componente, com "Sem componente"; a Parte A da Estrutura no `docs/interface.md` (§3)
- [ ] 1.7 — `docs/modelo-de-dados.md`, item 1 das Regras transversais, com `` `HabilidadeBncc` ``; a D65 (Computação) no `TODO.md`
- [ ] 1.8 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0059_*.sql`, `packages/core/src/db/schema/habilidade-bncc.ts`, `packages/core/src/db/bncc/dados-2026.08.json`, `packages/core/src/db/habilidade-bncc.int.test.ts`, `packages/shared/src/bncc/componentes.ts`, `packages/shared/src/bncc/componentes.test.ts` | novo |
| `packages/core/drizzle/meta/_journal.json`, `packages/shared/src/index.ts`, `packages/core/src/db/schema/disciplina.ts`, `packages/core/src/estrutura/disciplina.repository.ts`, `packages/shared/src/estrutura/disciplina.ts`, `apps/api/src/estrutura/disciplina/disciplina.service.ts`, `packages/core/src/auditoria/acoes.ts`, `apps/web/src/areas/coordenacao/estrutura/AnoEDisciplinas.tsx`, `apps/web/src/api/estrutura.ts`, `apps/web/src/areas/coordenacao/estrutura/Estrutura.test.tsx`, `apps/api/test/estrutura.int.test.ts`, `e2e/estrutura.spec.ts`, `docs/modelo-de-dados.md`, `docs/interface.md`, `TODO.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| carga duas vezes; descrição mudada | I | mesma contagem, 183 no EM; atualiza | |
| JSON com um código a menos | I | o código fica. Mutação: `delete` antes do `insert` | |
| toda linha; Computação | I | `versao` e `localizador`; a carga barra `EF06CO01`, o check o aceita | |
| check: `EF03CI03B`, `EF15AR01`, `EM13CNT3010`, `EF07LP01A` | I | recusados, um caso cada | |
| exceção pública; JSON contra o hash | U | `HabilidadeBncc` no item 1; editar uma descrição deixa vermelho | |
| candidatas: `EF69LP01`; `EF67EF` e `EF89EF`; `EM13CNT301`; LP no EM; Arte, EF e ER; 9º EF com 1º EM | U | uma linha do `cenarios.md` por caso | |
| migration do componente: "Química", "QUIMICA", " química "; "Português"; "Projeto de Vida", "Robótica"; disciplina da B | I | casa, nulo, não muda | |
| criada depois e renomeada | I | nasce com o componente; renomear mantém. Mutação: tirar o casamento do `criar` | |
| `PATCH` | I | `disciplina.componente_alterado` antes e depois | |
| `PATCH` com `null`; inexistente; check do banco | I | apaga; `ENTRADA_INVALIDA`; recusado | |
| `PATCH` da B no contexto da A | I | `NAO_ENCONTRADO`. Mutação: tirar `escola_id` | |
| professor no `PATCH`; `PATCH` | I | recusado; nenhuma `execucao_agente` | |
| Estrutura: carregando, erro ao salvar, com componente, "Sem componente" | U | um caso cada | |
| 1366 × 768; uma ação cheia; vocabulário | E | `paginaNaoRola`; `VOCABULARIO_DE_NOTA` | |
| 360 px | E | sem rolagem lateral, 44 px, axe | |
| recomeço: segunda pessoa; mesma disciplina reaberta; `PATCH` segurado com troca de disciplina; falha e nova tentativa | E | um caso cada; o erro sai e o foco volta | |

## Como testar

- Check: `packages/core/src/db/migracao-fila-ferramenta.int.test.ts` › "os dois checks terminam validados…"; carga idempotente: `migracao-f4.int.test.ts` › "a escola sem série deixa o material sem linha, e rodar o backfill de novo não duplica nada"
- Exceção: `apps/api/test/architecture.test.ts` › "o item 1 das Regras transversais do docs/modelo-de-dados.md nomeia cada uma"
- `PATCH`: `apps/api/test/estrutura.int.test.ts` › "renomear: a resposta e a listagem trazem o nome novo…" (compara o objeto inteiro: o campo novo muda o esperado)
- Casamento: `packages/shared/src/importacao/normalizador.test.ts` › "\"Química\", \"  QUIMICA \" e \"química\" são a mesma disciplina"
- e2e: `e2e/estrutura.spec.ts` › "o nome repetido fica no campo…"; `paginaNaoRola` (`e2e/support/coordenacao.ts`)
- `npx vitest run --project integracao apps/api/test/estrutura.int.test.ts`; `node tools/ci/e2e.ts --manter-ambiente e2e/estrutura.spec.ts`
- Armadilha: disciplina não tem auditoria hoje; o recorder vem de `apps/api/src/estrutura/ano-letivo/ano-letivo.service.ts`
- Telas: `coordenacao`, `/coordenacao/estrutura`, `text=Disciplinas` (o editar da linha)

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3: uma disciplina que casa e outra que não.

## Fora do escopo desta tarefa

Seções (2.0); o job do `PATCH` (6.0).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar

