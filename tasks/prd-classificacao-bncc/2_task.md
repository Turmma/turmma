# Tarefa 2.0 — O material ganha seções na extração, os prontos de antes também, e a edição nova herda a correção

**Funcionalidade:** classificacao-bncc · **Depende de:** 1.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

Cada material `pronto` tem seções (por capítulo, ou blocos de 10 páginas), da extração ou, para os de antes, da
migration; a seção da edição nova com o capítulo de mesmo número e título de uma seção corrigida
herda as habilidades e a marca. Nada é agendado ainda.

## Contexto necessário

- `techspec.md` §3, §5 "Seções" e "Edição nova", §6, §7, §7c (índices)
- `prd.md` RF5, RF6
- `cenarios.md` "Seções e agendamento" (seção, migration 2, edição nova), "Dado pessoal"
- `.claude/rules/`: 10, 20, 80
- Código: `apps/worker/src/processors/extrair-pdf.ts` (a transação, `gravarCapitulos`, `substituirAAnterior`);
  `packages/core/src/material/extracao.repository.ts`; `packages/core/drizzle/0055_material_serie_backfill.sql` (lote com `LOOP`)

## Subtarefas

- [ ] 2.1 — Migration: `secao_do_material` (`id uuid default uuidv7()`, `falhas_seguidas not null default 0`, as FKs compostas), `habilidade_da_secao`, `unique (escola_id, id)` em `capitulo_do_material`, os três índices da §7c; `lock_timeout`
- [ ] 2.2 — Na transação da extração, depois dos capítulos e só para quem fez a transição: uma seção por capítulo, ou por bloco de 10 páginas; páginas antes do capítulo 1 sem seção
- [ ] 2.3 — Migration (2): seções dos `pronto` não excluídos, em lotes de 1.000, sem execução, idempotente
- [ ] 2.4 — Edição nova: herda habilidades e `corrigida_em` (sem `corrigida_por`) pelo capítulo de mesmo número e título sem acento nem caixa, com `material.classificacao_herdada` (autor `rotina`: o check `auditoria_rotina_so_nas_acoes` ganha a ação)
- [ ] 2.5 — `docs/lgpd.md` (`corrigida_por`), `docs/modelo-de-dados.md`; `corrigida_por` em `fora` no arquivo do titular e na classificação
- [ ] 2.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0060_*.sql`, `packages/core/drizzle/0061_*.sql`, `packages/core/src/material/secoes.ts`, `packages/core/src/material/secoes.test.ts`, `packages/core/src/db/migracao-f4b.int.test.ts` | novo |
| `packages/core/drizzle/meta/_journal.json`, `packages/core/src/db/schema/material.ts`, `packages/core/src/material/extracao.repository.ts`, `packages/core/src/material/index.ts`, `apps/worker/src/processors/extrair-pdf.ts`, `apps/worker/test/extrair-pdf.int.test.ts`, `apps/api/test/material-edicao.int.test.ts`, `packages/core/src/auditoria/acoes.ts`, `packages/core/src/titular/leitura-do-titular.ts`, `packages/shared/src/privacidade/classificacao.ts`, `apps/api/test/arquivo-do-titular.int.test.ts`, `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts`, `docs/lgpd.md`, `docs/modelo-de-dados.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| material com capítulos | I | uma seção por capítulo | |
| sem capítulo, 25 páginas | I | 1–10, 11–20, 21–25 | |
| páginas antes do capítulo 1 | I | sem seção | |
| dois jobs da mesma extração em `Promise.all` | P | seções uma vez | |
| ordem duplicada | I | o `unique (escola_id, material_id, ordem)` recusa | |
| seção da A com capítulo da B | I | a FK composta recusa | |
| código fora de `habilidade_bncc` | I | recusado | |
| migration (2): `pronto` da A e da B, mais que o lote (injetável), duas vezes | I | todos ganham, sem duplicar | |
| migration (2): excluído; `processando` | I | ficam fora, um caso cada | |
| herança: mesmo número e título, sem acento nem caixa | I | herda as habilidades e `corrigida_em`, `corrigida_por` nulo; `material.classificacao_herdada`, no catálogo sem título. Mutação: tirar a herança | |
| mesmo número, título diferente; mesmo título, número diferente | I | não herda. Mutação: tirar cada termo | |
| anterior só com `origem: 'ia'` | I | não herda | |
| anterior da B com o capítulo corrigido | I | a da A não herda. Mutação: tirar `escola_id` da busca | |
| eliminado o coordenador | I | `corrigida_por` nulo, `corrigida_em` fica | |
| `corrigida_por` no arquivo do titular | I | em `fora` | |
| isolamento do repository de seção | I | material da B no contexto da A: nada. Mutação: tirar `escola_id` | |
| log da extração | I | só ids e contagens | |

## Como testar

- Extração: `apps/worker/test/extrair-pdf.int.test.ts` › "[I] caminho feliz com marcador…" e "[P] dois jobs da mesma extração em `Promise.all`, os dois com os bytes na mão…"
- Edição: `apps/api/test/material-edicao.int.test.ts` › "[P] dois jobs da mesma edição…"; a seção corrigida da anterior entra por SQL
- Backfill: `packages/core/src/db/migracao-f4.int.test.ts` › "mais de um lote de 5.000…" e "a escola sem série deixa o material sem linha, e rodar o backfill de novo não duplica nada"
- Titular: `apps/api/test/arquivo-do-titular.int.test.ts` › "a licença entra no arquivo de quem a registrou…"
- Catálogo do MVP: `mvp-tables.int.test.ts` › "pelo catálogo: toda FK…" quebra com FK nova (grupo E da retro da F4): rode-o
- `npx vitest run --project integracao apps/worker/test/extrair-pdf.int.test.ts`
- Armadilha: os workers do compose de pé disputam a extração (retro da F4, F)

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3: um capítulo que casa e um que só casa o número.

## Fora do escopo desta tarefa

Execuções e jobs (5.0); a leitura na API (7.0).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar

