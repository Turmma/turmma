# Tarefa 12.0 — O painel do material mostra os capítulos, corrige séries e título e recebe a edição nova

**Funcionalidade:** ingestao-do-material · **Depende de:** 4.0, 8.0, 11.0
**Subagentes obrigatórios:** `tenancy-guardian`, `infra-guardian`, `frontend-reviewer`
**Porte:** grande

## Objetivo

No painel, a coordenação vê os capítulos, corrige séries e título pelo `PATCH`, que espera a edição em andamento, e
envia a edição nova.

## Contexto necessário

- `techspec.md` §4 (`PATCH`), §7c, §9 (Painel), §11 (RF6)
- `prd.md` RF4, RF6 (série), RF10
- `cenarios.md`: as linhas do `PATCH` em "Envio…" e "Corridas"; "Telas"; "Isolamento"
- `.claude/rules/` 10, 40, 50, 80
- Código: `apps/web/src/areas/coordenacao/material/PainelDoMaterial.tsx` e `MATERIAL_PARAM` (`apps/web/src/paths.ts:112`); `apps/api/src/material/material-upload.ts:44` (molde do teto)

## Subtarefas

- [ ] 12.1 — `PATCH /v1/materiais/:id` (`titulo?`, `serieIds?`): a linha `for update`; fora da escola ou excluído, `NAO_ENCONTRADO` antes de `EDICAO_EM_ANDAMENTO` (R6); edição em `processando`, ou a própria, `EDICAO_EM_ANDAMENTO`; `material.atualizado`
- [ ] 12.2 — O teto do `PATCH`: 100 por hora por pessoa e 300 por escola, à parte do envio; 429 com `Retry-After`
- [ ] 12.3 — Painel: capítulos (ou "sem capítulo"); séries e título editáveis, salvar trava durante o envio; "Enviar edição nova", com "a anterior sai da busca quando a nova ficar pronta"
- [ ] 12.4 — Textos: `EDICAO_EM_ANDAMENTO` "Espere a edição em processamento terminar"; `LICENCA_VENCIDA` "Atualize a vigência em Licenças"; 429 do `PATCH` "Muitas alterações por agora. Tente de novo às HH:MM" (R6); 503 "O envio não foi concluído. Tente de novo em instantes."
- [ ] 12.5 — `docs/interface.md`: o painel
- [ ] 12.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/shared/src/material/material.ts`, `packages/core/src/auditoria/acoes.ts`, `apps/api/src/material/material.controller.ts`, `apps/api/src/material/material.service.ts`, `apps/api/src/material/material.repository.ts`, `apps/api/src/material/material-upload.ts`, `apps/web/src/areas/coordenacao/material/PainelDoMaterial.tsx`, `apps/web/src/areas/coordenacao/material/Material.test.tsx`, `apps/web/src/areas/coordenacao/material/api/material.ts`, `e2e/material.spec.ts`, `docs/interface.md` | alterado |
| `apps/api/test/material-patch.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| `PATCH` de título e séries | I | a lista com `serieId` da série tirada deixa de achar; `material.atualizado` | |
| a busca da turma da série tirada | I | deixa de achar | |
| `serieIds` da B | I | `NAO_ENCONTRADO` igual à inexistente; séries intactas | |
| `[]`; repetidas | I | `ENTRADA_INVALIDA` (um caso cada) | |
| material da B `pronto`; da B `processando` | I | `NAO_ENCONTRADO` nos dois, antes de `EDICAO_EM_ANDAMENTO` (R6) | |
| material excluído; substituído | I | `NAO_ENCONTRADO` | |
| com edição em `processando`; a própria edição | I | `EDICAO_EM_ANDAMENTO` | |
| 101º da pessoa; 301º da escola | I | 429 com `Retry-After`, sem gastar o teto de envios | |
| sequência: edição B sobre A, `PATCH` em A recusado, B pronta com as séries de A, `PATCH` em B vale | I | a ordem. Mutação: deixar o `PATCH` passar com edição em andamento | |
| [P] dois `PATCH` do mesmo material | P | termina com as séries do último, sem 500. Mutação: tirar o `for update` | |
| [P] edição parada depois do `guardarBytes`; `PATCH` em A confirma | P | a edição nasce com as séries do `PATCH` | |
| [P] edição com a transação aberta; `PATCH` em A | P | o `PATCH` espera e recebe `EDICAO_EM_ANDAMENTO`. Mutação: tirar o `for update` do `PATCH` | |
| permissão: professor | I | `NAO_ENCONTRADO` | |
| escola sem ano letivo | I | o `PATCH` funciona | |
| painel: capítulos; sem capítulo | U | um caso cada | |
| textos dos quatro erros | U | um caso cada | |
| clique duplo em salvar | U | um `PATCH` só | |
| recomeço: outro material no mesmo painel; o mesmo de novo; resposta atrasada; falha com o painel aberto | E | nada do anterior sobra; o foco e o aviso saem | |
| professor | E | não vê editar nem edição nova | |
| editar séries e enviar edição nova | E | fim a fim | |
| cabe em 1366 × 768 | E | `paginaNaoRola` | |

## Como testar

- Trava: `WriteBlockTrigger` e `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`)
- Teto: `apps/api/test/rate-limit.int.test.ts` › "um usuário acima do próprio limite recebe 429…" (l.228); `apps/api/test/material.int.test.ts` › "a pessoa no teto recebe `LIMITE_EXCEDIDO`…"
- Painel: `apps/web/src/areas/coordenacao/material/Material.test.tsx`, o `montar('/material?material=<id>')`
- e2e: `e2e/material.spec.ts`; `fecharPainel` e `paginaNaoRola` de `e2e/support/coordenacao.ts`
- Comandos: `npx vitest run --project integracao apps/api/test/material-patch.int.test.ts`; `node tools/ci/e2e.ts --manter-ambiente e2e/material.spec.ts`
- **Telas:** `coordenacao`, `/coordenacao/material?material=<id>` (painel com capítulos, sem capítulo, editando séries, `EDICAO_EM_ANDAMENTO`, edição nova enviada)

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano. Na 4: a B em `processando` prova
que `NAO_ENCONTRADO` vem antes.

## Fora do escopo desta tarefa

Habilidade por capítulo (F4b).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar
