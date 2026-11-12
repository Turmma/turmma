# Tarefa 5.0 — A licença é registrada uma vez, com vigência, retenção e arquivo do titular

**Funcionalidade:** ingestao-do-material · **Depende de:** 1.0, 3.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

A coordenação registra, lista e altera a licença, com situação e contagem de materiais; os materiais de antes a ganham
pelo backfill; ela tem retenção e entra no arquivo do titular.

## Contexto necessário

- `techspec.md` §3, §4 (`/v1/licencas`), §6, §7
- `prd.md` RF16, RF17, RF20
- `cenarios.md` "Licença", "Migração", "Permissão…", "Isolamento"
- `.claude/rules/` 10, 20, 40, 80
- Código: `packages/core/src/retencao/expurgo-da-escola.repository.ts`
  (`ALVOS_DO_EXPURGO_DA_ESCOLA`, l.45); `packages/shared/src/privacidade/classificacao.ts`; `packages/core/src/titular/`

## Subtarefas

- [ ] 5.1 — Migration (1): `licenca_de_material` e `material.licenca_id`, e o índice; (2) o backfill da §3, em lotes com `lock_timeout`
- [ ] 5.2 — `GET /v1/licencas` (página, com `materiais` e `situacao`: `vigente`, `vence_em_30_dias`, `vencida`, `futura`, pelo `Clock` de São Paulo), `POST`, `PATCH /:id` (`for update`); sem exclusão; só coordenação, na matriz
- [ ] 5.3 — `licenca.registrada` e `licenca.alterada` com ids e vigência, sem texto livre
- [ ] 5.4 — Retenção em `material_excluido`, contada de `vigente_ate`, só sem linha de `material` que a cite (inclusive excluída), depois do passo do material; sem fim, não sai; `registrada_por` nulo na eliminação do coordenador
- [ ] 5.5 — Classificação da tabela; arquivo do titular do coordenador que registrou (`licenciante` e `referencia` em `fora`)
- [ ] 5.6 — Documentos: `docs/lgpd.md` (a licença, e "sem fim fica até a coordenação encerrar", R6); `docs/modelo-de-dados.md`; `docs/regulacao.md` §5 apontando a licença (R6)
- [ ] 5.7 — Testes
- [ ] 5.8 — O que a 3.0 deixou (`techspec.md` §11, linha "3.0"): na migration (1), o check `auditoria_escola_ou_operacao_global` aceita sem escola também `entidade = 'job'`, e `ENTIDADES_DE_AUDITORIA_SEM_ESCOLA` ganha `job`; `ops:reprocessar-job` e `ops:descartar-job` perdem a recusa do job sem escola e auditam o `sistema.*` sem escola, com `autor_operador`; o expurgo de jobs (`expurgo-de-jobs.repository.ts`) deixa o `falhou` de `material.extrair-pdf` como deixa o de `titular.*`, e o prazo `tarefa_em_segundo_plano` (`packages/shared/src/privacidade/retencao.ts`) e a linha de `job_registro` do `docs/lgpd.md` dizem isso

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0052_*.sql`, `0053_*.sql`, `packages/core/src/db/schema/material.ts`, `apps/api/src/material/licenca.controller.ts`, `apps/api/src/material/licenca.service.ts`, `apps/api/src/material/licenca.repository.ts`, `apps/api/src/material/material.module.ts`, `packages/shared/src/material/licenca.ts`, `packages/shared/src/index.ts` | novo e alterado |
| `packages/shared/src/permissao/matriz.ts`, `packages/shared/src/privacidade/classificacao.ts`, `packages/core/src/auditoria/acoes.ts`, `packages/core/src/retencao/expurgo-da-escola.repository.ts`, `packages/core/src/titular/`, `docs/lgpd.md`, `docs/modelo-de-dados.md`, `docs/regulacao.md` | alterado |
| `apps/api/test/licenca.int.test.ts`, `packages/core/src/db/migracao-f4.int.test.ts` | novo |
| `packages/core/src/db/schema/auditoria.ts`, `packages/core/src/auditoria/auditoria-recorder.ts`, `packages/core/src/retencao/expurgo-de-jobs.repository.ts`, `packages/shared/src/privacidade/retencao.ts`, `apps/api/src/operacao/jobs-que-falharam.repository.ts`, `apps/api/src/ops/reprocessar-job.ts`, `apps/api/src/ops/descartar-job.ts`, `apps/api/test/ops-jobs.int.test.ts` | alterado (5.8) |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| caminho feliz | I | registrada, listada, alterada | |
| situação, uma de cada | I | `vigente`, `vence_em_30_dias`, `vencida`, `futura`, cada termo com o relógio falso | |
| contagem de materiais | I | `materiais` conta os da licença, não os de outra | |
| (5.8) reprocessar e descartar `sistema.*` | I | auditados sem escola, com `autor_operador`; o de escola segue com a escola da linha. Mutação: tirar `job` de `ENTIDADES_DE_AUDITORIA_SEM_ESCOLA` | |
| (5.8) o `falhou` de `material.extrair-pdf` com 31 dias | I | fica no expurgo; o de outro tipo sai. Mutação: tirar a exceção do SQL | |
| `vigente_ate` antes de `vigente_desde`; textos fora do tamanho | I | `ENTRADA_INVALIDA` | |
| [P] dois `PATCH` da mesma licença | P | a auditoria tem dois "antes" diferentes. Mutação: tirar o `for update` | |
| auditoria | I | sem licenciante, cobertura nem referência (sentinela) | |
| retenção: vencida sem material, além do prazo | I | sai | |
| retenção: com material vivo; sem fim; da escola B | I | fica (um caso cada) | |
| retenção segurada por `mensagem_tutor` | I | material excluído citado segura a licença, a categoria termina `concluida`; quando a conversa sai, os dois saem. Mutação: tirar o `not exists` | |
| eliminação do coordenador | I | `registrada_por` nulo | |
| arquivo do titular | I | a licença no do coordenador que registrou, com `licenciante` e `referencia` em `fora` | |
| backfill | I | mesmo licenciante duas vezes: uma licença; na B, outra; `vigente_desde` no mais antigo; só excluídos: fim na última exclusão | |
| permissão: professor, aluno | I | `PERMISSAO_NEGADA` na coleção, `NAO_ENCONTRADO` no objeto | |
| escola sem ano letivo | I | a coordenação usa as três rotas | |
| isolamento | I | `GET` e `PATCH` da licença da B: `NAO_ENCONTRADO`; a lista da A sem as da B e sem contar material da B | |
| `contracts.test` | U | DTO sem campo proibido | |
| `CLASSIFICACAO_DAS_TABELAS` | U | confere com a migration | |

## Como testar

- Rota e permissão: `apps/api/test/material.int.test.ts`, os casos de permissão e de isolamento; `apps/api/test/material-isolamento.int.test.ts`
- Trava: `WriteBlockTrigger` (`apps/api/test/write-block-trigger.ts`), como `apps/api/test/incidente.int.test.ts` › "RF9, concorrência: duas confirmações ao mesmo tempo…"
- Retenção: `apps/worker/test/expurgo-da-escola.int.test.ts` › "%s: um dia antes do prazo a linha fica, um dia depois sai…" (l.591); `packages/core/src/retencao/expurgo-da-escola.test.ts` › "toda categoria tem ao menos um alvo…"
- Titular: `packages/core/src/titular/leitura-do-titular.test.ts` › "cada coluna de ligação…"; arquitetura: `apps/api/test/architecture.test.ts` › "a CLASSIFICACAO_DAS_TABELAS confere…" (l.1245)
- Backfill: `packages/core/src/db/migracao-f2.int.test.ts` › "só expande…" (l.160), com `pastaAteA0039` e `migrate`
- Comando: `npx vitest run --project integracao apps/api/test/licenca.int.test.ts`

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano. Na 1: cada termo da
`situacao` e o `not exists` da retenção são blocos. Na 3: a escola B com o mesmo licenciante é o segundo dado do backfill.

## Fora do escopo desta tarefa

A tela (6.0); o envio com `licencaId` e o filtro da leitura (7.0, 9.0).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar
