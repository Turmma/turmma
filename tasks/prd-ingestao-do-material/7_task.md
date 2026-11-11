# Tarefa 7.0 — A coordenação envia até 20 PDFs de uma vez, com séries e licença

**Funcionalidade:** ingestao-do-material · **Depende de:** 2.0, 6.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `frontend-reviewer`
**Porte:** grande

## Objetivo

O envio exige séries e, de terceiro, licença vigente, conferidas antes de ler o arquivo e na transação; a tela envia
até 20 PDFs, um por vez.

## Contexto necessário

- `techspec.md` §3, §4, §5 "Envio e edição" (1) e (3), §7c, §9
- `prd.md` RF3, RF14, RF16
- `cenarios.md` "Envio…", "Corridas", "Migração", "Telas"
- `.claude/rules/` 10, 20, 40, 50, 80
- Código: `DialogoDeEnvioDeMaterial.tsx`; `seriesQueryOptions` (`apps/web/src/api/estrutura.ts`); `licencasQueryOptions` (6.0)

## Subtarefas

- [ ] 7.1 — Migration: `material_serie` e o índice da §7c; backfill em lotes com todas as séries da escola
- [ ] 7.2 — `serieIds` (1 a 7, sem repetir) e `licencaId` na ordem da §5 (1); `material.recusado` com as séries
- [ ] 7.3 — Licença reconferida na transação, `for share`; `LICENCA_VENCIDA` na suíte de saídas da 2.0
- [ ] 7.4 — `serieId` no `GET /v1/materiais`; `serieIds` e `licencaId` no contrato
- [ ] 7.5 — Diálogo em lote: séries; licença vigente, relida ao abrir e no foco (R6); até 20; título editável; `aria-live`
- [ ] 7.6 — O 429 com os textos do `cenarios.md`, e a retomada (R6)
- [ ] 7.7 — `docs/interface.md`, `docs/modelo-de-dados.md`; o passo 1 do `docs/roteiro-da-demonstracao.md` conferido contra o spec dele
- [ ] 7.8 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0054_*.sql`, `packages/core/src/db/schema/material.ts`, `packages/shared/src/material/material.ts`, `packages/shared/src/privacidade/classificacao.ts` | novo e alterado |
| `apps/api/src/material/material.controller.ts`, `apps/api/src/material/material.service.ts`, `apps/api/src/material/material.repository.ts`, `apps/api/test/material.int.test.ts`, `apps/api/test/material-envio-orfao.int.test.ts`, `packages/core/src/db/migracao-f4.int.test.ts`, `apps/web/src/areas/coordenacao/material/DialogoDeEnvioDeMaterial.tsx`, `apps/web/src/areas/coordenacao/material/material-envio.ts`, `apps/web/src/areas/coordenacao/material/material-envio.test.ts`, `apps/web/src/areas/coordenacao/material/Material.test.tsx`, `e2e/material.spec.ts`, `e2e/roteiro-da-demonstracao.spec.ts`, `docs/interface.md`, `docs/modelo-de-dados.md`, `docs/roteiro-da-demonstracao.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| duas séries | I | `GET ?serieId` de cada uma traz o material | |
| sem série; `[]`; `[S1, S1]` | I | `ENTRADA_INVALIDA` | |
| série inexistente; da B | I | `NAO_ENCONTRADO` igual, nada lido nem gravado; auditoria sem o id da B | |
| terceiro sem `licencaId` | I | `MATERIAL_SEM_LICENCA` | |
| licença vencida; inexistente; da B | I | recusa antes de ler, `material.recusado` com séries | |
| próprio, sem licença | I | entra | |
| vencida na transação | I | o storage encurta a vigência: objeto e linha apagados | |
| [P] envio parado no `for share`; `PATCH` da licença | P | o `PATCH` espera. Mutação: tirar o `for share` | |
| `serieId` da B | I | igual a inexistente | |
| vínculo encerrado em X, aberto em Y | I | `GET ?serieId` só traz Y | |
| backfill | I | todas as séries; escola sem série fica sem | |
| `licenciante` copiado | I | o código grava o da licença | |
| sem ano letivo | I | o envio funciona | |
| `contracts.test` | U | professor sem licenciante | |
| 21 arquivos | U | o 21º recusado antes | |
| 20, um inválido, um repetido | U | 18 prontos, uma falha, um "já enviado" | |
| título | U | do nome, editável | |
| 429 no meio | U | pendentes e os dois textos | |
| retomada | U | no horário ou pelo botão (R6) | |
| licenças relidas | U | a vencida some (R6) | |
| sem licença vigente | U | o texto e o link | |
| a11y | U | `aria-live`, foco, 44 px | |
| clique duplo | U | um lote só | |
| recomeço: outra pessoa; o mesmo lote; resposta atrasada; falha aberta | E | nada da anterior sobra | |
| três PDFs, um repetido, 300 no seed, rede e CPU lentas | E | fim a fim | |
| 1366 × 768 | E | `paginaNaoRola` | |

## Como testar

- Envio: `apps/api/test/material.int.test.ts` › "na mesma escola é `CONFLITO`…"; `vi.spyOn(PdfExtractor, 'extrair')` para "nada lido"
- Trava: `WriteBlockTrigger`, `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`)
- Tela: `Material.test.tsx` › "o envio com licença…" (l.533), › "sem licença o diálogo diz 'Envio recusado'…" (l.674)
- 429: `apps/api/test/rate-limit.int.test.ts` (l.228)
- Comandos: `npx vitest run --project integracao apps/api/test/material.int.test.ts`; `node tools/ci/e2e.ts --manter-ambiente e2e/material.spec.ts`
- **Telas:** `coordenacao`, `/coordenacao/material` › `text=Enviar material` (vazio, lote no meio, 429, sem licença)

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano.

## Fora do escopo desta tarefa

Edição (8.0), leitura (9.0), `PATCH` (12.0).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar
