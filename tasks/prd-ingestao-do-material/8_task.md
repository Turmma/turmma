# Tarefa 8.0 — A edição nova substitui a anterior só quando fica pronta

**Funcionalidade:** ingestao-do-material · **Depende de:** 7.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

A edição nova sobre um material `pronto` herda disciplina, séries, titularidade e licença; a anterior segue na busca
até a nova ficar pronta, e sai na transação da extração.

## Contexto necessário

- `techspec.md` §3, §4 (`POST /:id/edicoes`), §5 "Envio e edição" (3) e "Extração", §6, §7
- `prd.md` RF10, RF11, RF20
- `cenarios.md` "Edição nova", "Corridas", "Migração", "Isolamento"
- `.claude/rules/` 10, 20, 40, 80
- Código: `apps/api/src/material/material.service.ts` (o envio; `varrerParados`, l.224, que o código anterior roda)

## Subtarefas

- [ ] 8.1 — Migration: `edicao`, `substitui_id`, `substituido_por` (§3) e o índice parcial `material_uma_edicao_em_andamento`
- [ ] 8.2 — `POST /v1/materiais/:id/edicoes` na ordem da §5 (o alvo antes de tudo; na transação, `for update` e a herança lida ali); `material.edicao_enviada`
- [ ] 8.3 — Na extração, com `substitui_id`: o `update … where escola_id and id = :antiga and excluido_em is null`, trechos da antiga apagados, `material.substituido`
- [ ] 8.4 — `EDICAO_EM_ANDAMENTO` e o `CONFLITO` da edição na suíte de saídas da 2.0
- [ ] 8.5 — `docs/runbook.md` "Voltar o código depois da F4": a ordem, o que fica (jobs `pdf`, `processando`, `envio_de_material`), como limpar, e o que o `varrerParados` antigo faz com eles (R6); `docs/modelo-de-dados.md`
- [ ] 8.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0056_*.sql`, `packages/core/src/db/schema/material.ts` | novo e alterado |
| `packages/core/src/material/extracao.repository.ts`, `apps/worker/src/processors/extrair-pdf.ts`, `packages/shared/src/material/material.ts`, `packages/core/src/auditoria/acoes.ts`, `apps/api/src/material/material.controller.ts`, `apps/api/src/material/material.service.ts`, `apps/api/src/material/material.repository.ts`, `docs/runbook.md`, `docs/modelo-de-dados.md` | alterado |
| `apps/api/test/material-edicao.int.test.ts`, `packages/core/src/db/volta-da-f4.int.test.ts`, `packages/core/src/db/test/schema-antes-da-f4.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| antes de a nova ficar pronta | I | a busca devolve a antiga | |
| depois | I | só a nova | |
| nova com falha | I | a antiga segue | |
| herança | I | disciplina, séries, titularidade e licença; nas mesmas séries | |
| alvo `processando` | I | `EDICAO_EM_ANDAMENTO` | |
| alvo excluído; substituído | I | `NAO_ENCONTRADO` (um caso cada) | |
| licença vencida | I | `LICENCA_VENCIDA` antes de ler o arquivo | |
| arquivo igual ao da edição atual | I | `CONFLITO`, objeto e linha apagados | |
| isolamento | I | alvo da B `pronto`, `processando` e com licença vencida: `NAO_ENCONTRADO` igual ao inexistente, nenhum byte lido (um caso cada) | |
| [P] duas edições, a primeira presa antes do commit | P | a segunda: `EDICAO_EM_ANDAMENTO`. Mutação: tirar o índice parcial **e** a checagem sob a trava | |
| [P] edição C enquanto a substituição de B (sobre A) está presa | P | C espera o `for update` e recebe `NAO_ENCONTRADO`. Mutação: tirar o `for update` | |
| [P] exclusão da nova parada entre `lerParaExtrair` e a transição | P | a antiga fica, a nova sem trechos. Mutação: tirar `excluido_em is null` da transição | |
| [P] exclusão da antiga antes do `update … substituido_por` | P | o `excluido_em` dela não muda, sem `material.substituido`. Mutação: tirar `excluido_em is null` do update | |
| [P] dois jobs da mesma edição | P | `material.substituido` uma vez. Mutação: a transição depois da substituição | |
| [P] edição parada depois do `guardarBytes`; mudar as séries de A por SQL | P | a edição nasce com as séries novas. Mutação: herdar do passo 1 | |
| volta do código | I | depois do passo do runbook, as linhas da F4 passam pelo `listaDeMateriaisResponseSchema` da cópia congelada (nenhum valor novo de `falha`, `licenciante` preenchido). Mutação: gravar um valor novo de `falha` (R6) | |
| permissão: professor | I | `POST /:id/edicoes` dá `NAO_ENCONTRADO` | |
| escola sem ano letivo | I | a edição funciona | |
| auditoria | I | `material.edicao_enviada` e `.substituido` sem título nem arquivo | |

## Como testar

- Envio: `apps/api/test/material.int.test.ts` › "na mesma escola é `CONFLITO`…"
- Trava: `WriteBlockTrigger` e `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`); o extrator falso numa barreira para os [P] do job
- Processador: o `rodar(escolaId, processador)` de `apps/worker/test/expurgo-da-escola.int.test.ts`
- Volta: `packages/core/src/db/migracao-f2.int.test.ts` › "só expande…" (l.160), com `migrate` (`packages/core/src/db/migrate.ts:76`)
- Comando: `npx vitest run --project integracao apps/api/test/material-edicao.int.test.ts`
- Armadilha: sem `PATCH` ainda, a corrida da herança muda as séries por SQL

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano.

## Fora do escopo desta tarefa

As `fontes` (10.0); o filtro de série na leitura (9.0); o botão no painel (12.0).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar
