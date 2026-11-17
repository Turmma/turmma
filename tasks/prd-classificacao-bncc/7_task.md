# Tarefa 7.0 — A coordenação lê, corrige e manda reclassificar pela API, e a operação reclassifica uma escola (D76)

**Funcionalidade:** classificacao-bncc · **Depende de:** 6.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

O `GET /v1/materiais/:id` traz as seções com a situação e as habilidades; a coordenação corrige (a correção é final e
vence a IA) e pede a reclassificação; `GET /v1/habilidades-bncc` dá as candidatas; e a operação reclassifica uma escola,
com chamado.

## Contexto necessário

- `techspec.md` §4; §5 "Reclassificar", "Correção", "Suspensão"; §7; §7c "Estados da seção"
- `prd.md` RF6, RF12, RF20
- `cenarios.md` "Correção e reclassificação", "Permissão e isolamento", "Dado pessoal"; P1b, P2, P3, P5, P9
- `.claude/rules/`: 10, 20, 70 (item 6), 80 (item 1)
- Código: `apps/api/src/material/material.controller.ts` e `material.service.ts` (`exigirAtualizacaoDentroDosTetos`),
  `apps/api/src/ops/reprocessar-job.ts` (comando com chamado)

## Subtarefas

- [ ] 7.1 — `secoes[]` e `classificacaoSuspensa` no `GET /:id` (§4), com a `situacao` da §7c; DTO sem `corrigida_por` nem `execucao_id`
- [ ] 7.2 — `GET /v1/habilidades-bncc` (§4)
- [ ] 7.3 — O `PUT` da correção (§5 "Correção", `material.classificacao_corrigida`); o `concluir` da 4.0 ganha o `for update` na seção (P1b)
- [ ] 7.4 — `POST …/reclassificar` e o comando `reclassificar-escola` (§5 "Reclassificar", "Suspensão")
- [ ] 7.5 — Os tetos (§4) e as ações no catálogo
- [ ] 7.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/shared/src/material/material.ts`, `packages/shared/src/index.ts`, `apps/api/src/material/material.controller.ts`, `apps/api/src/material/material.service.ts`, `apps/api/src/material/material.repository.ts`, `apps/api/src/material/secoes.repository.ts`, `apps/api/src/material/classificar-secoes.command.ts`, `apps/api/src/material/material.module.ts`, `packages/core/src/auditoria/acoes.ts`, `packages/shared/src/permissao/matriz.ts`, `apps/api/test/contracts.test.ts`, `package.json` | alterado |
| `packages/shared/src/material/habilidades-bncc.ts`, `apps/api/src/material/habilidades-bncc.controller.ts`, `apps/api/src/ops/reclassificar-escola.ts`, `apps/api/src/ops/reclassificar-escola.test.ts`, `apps/api/test/classificacao-da-coordenacao.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| `GET`, uma seção em cada estado | I | as cinco `situacao`; `corrigida` vence | |
| `GET` suspensa; contrato | I | `classificacaoSuspensa`; sem `corrigida_por` nem `execucao_id` | |
| reclassificar; D76 | I | não tocam a correção, um caso cada | |
| correção, com 0 a 5 | I | final; `classificacao_corrigida` antes e depois, sem título | |
| coordenador eliminado | I | `corrigida` segue `true`; reclassificar mantém. Mutação: a marca em `corrigida_por` | |
| `PUT`: 6; repetido; sufixo estadual; fora do recorte | I | `ENTRADA_INVALIDA`, um caso cada | |
| não `pronto`; sem componente; reclassificar suspenso | I | `CONFLITO`; `FUNCAO_SUSPENSA` | |
| `secaoId` de outro material; de material excluído | I | `NAO_ENCONTRADO` | |
| `PUT /materiais/A/secoes/<da B>` | I | `NAO_ENCONTRADO`. Mutação: tirar `escola_id` | |
| código fora do recorte em material da B | I | `NAO_ENCONTRADO`, não `ENTRADA_INVALIDA` | |
| 301º e 901º `PUT`; 101º e 301º reclassificar | I | 429 com `Retry-After`; o do colega não conta | |
| reclassificar, storage vazio | I | texto dos `trecho`; quantas e preservadas; `material.reclassificado`; `daRotina` | |
| reclassificar; D76 | I | zeram `falhas_seguidas`. Mutação: sem zerar | |
| D76 | I | sem chamado ou suspensa, recusado; `escola.reclassificada`, só a escola dada, sem texto; lotes de 500 até o sinal | |
| habilidades sem componente | I | `semComponente` | |
| habilidades: `materialId` da B; sem vínculo; `artefatoId` da B; de colega | I | `NAO_ENCONTRADO` igual ao inexistente, um caso cada | |
| professor no `PUT` e no reclassificar; aluno no material e nas habilidades; rede | I | recusados, um caso cada | |
| `GET` e reclassificar, material da B | I | `NAO_ENCONTRADO`. Mutação: tirar `escola_id` | |
| P1b | P | a correção espera; o "antes" são os da IA. Mutação: tirar o `for update` do `concluir` | |
| P2 | P | fica X. Mutação: tirar `execucao_id = :esta` | |
| P3 | P | não cria para a `aguardando`. Mutação: tirar o filtro de `pendente` | |
| P5 | P | duas auditorias em cadeia. Mutação: tirar o `for update` | |
| P9, rotina × reclassificar | P | uma execução | |
| catálogo: as três ações | U | sem título nem texto | |

## Como testar

- `GET`: `apps/api/test/material.int.test.ts` › "o PDF com marcador termina `pronto` e devolve os capítulos em `GET /:id`…"
- Tetos: `material-patch.int.test.ts` › "a pessoa no teto recebe 429 com `Retry-After`…" e "a escola no teto segura quem ainda não passou do próprio…"
- Contrato: `contracts.test.ts` › "ingestao-do-material 4.0…"
- D76: `apps/api/src/ops/jobs-que-falharam.test.ts` › "%s: InvalidArgumentError citando só a opção"; `apps/api/test/ops-jobs.int.test.ts` › "um tipo aceito: a cópia failed sai…"
- `npx vitest run --project integracao apps/api/test/classificacao-da-coordenacao.int.test.ts`

## Autoconferência

As 12 perguntas do modelo, no plano. Na 4: um caso que chega a cada degrau da ordem da §4.

## Fora do escopo desta tarefa

A tela (8.0); a troca (11.0).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar

