# Tarefa 10.0 — O chip e o PDF do artefato dizem título, edição e "edição anterior"

**Funcionalidade:** ingestao-do-material · **Depende de:** 9.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `frontend-reviewer`
**Porte:** pequeno

## Objetivo

O artefato gerado antes da troca de edição, ou da licença vencer, continua citando o material que usou, com título,
edição e "edição anterior"; depois do expurgo da linha, a fonte vira "material da escola".

## Contexto necessário

- `techspec.md` §4 (`GET /v1/artefatos/:id` com `fontes`), §7 (autorização por objeto, DTO), §9 (Chip e PDF), §11 (RF11)
- `prd.md` RF11, RF17
- `cenarios.md` "Edição nova" (as `fontes`, o expurgo), "Licença" (o rascunho), "Telas" (Chip e PDF)
- `.claude/rules/`: 10, 20 (item 4), 40, 50
- Código: `apps/api/src/artefato/artefato.repository.ts`, `apps/api/src/artefato/pdf-do-artefato.ts`; `apps/web/src/components/ui/ai/CitationChip.tsx`;
  `apps/web/src/areas/professor/artefatos/Artefato.tsx`, `apps/web/src/areas/professor/artefatos/ExportarPdf.tsx`, `apps/web/src/areas/professor/artefatos/api/titulos-dos-materiais.ts`

## Subtarefas

- [ ] 10.1 — `fontes` no `GET /v1/artefatos/:id`: título, edição e `substituido`, só do artefato alcançado; sem a linha, "material da escola"
- [ ] 10.2 — O chip e o PDF do artefato leem as `fontes` (o `titulos-dos-materiais.ts` sai ou passa a usá-las)
- [ ] 10.3 — `docs/interface.md`: o chip com "edição anterior"
- [ ] 10.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/artefato/artefato.repository.ts`, `apps/api/src/artefato/artefato.service.ts`, `apps/api/src/artefato/pdf-do-artefato.ts`, `packages/shared/src/assistente/artefato.ts`, `apps/api/src/artefato/artefato.int.test.ts`, `apps/web/src/components/ui/ai/CitationChip.tsx`, `apps/web/src/components/ui/ai/pecas-revestidas.test.tsx`, `apps/web/src/areas/professor/artefatos/Artefato.tsx`, `apps/web/src/areas/professor/artefatos/ExportarPdf.tsx`, `apps/web/src/areas/professor/artefatos/api/titulos-dos-materiais.ts`, `docs/interface.md` | alterado |
| `e2e/artefato-fontes.spec.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| caminho feliz | I | `fontes` com título e edição | |
| artefato antigo, edição substituída | I | `substituido` verdadeiro, título e edição da antiga | |
| rascunho com licença vencida | I | as `fontes` seguem; geração nova não usa o material | |
| expurgo da linha | I | "material da escola" | |
| isolamento | I | artefato da B no contexto A: `NAO_ENCONTRADO`; `fontes` sem título da B | |
| permissão: outro professor | I | `NAO_ENCONTRADO` | |
| vínculo encerrado em X, aberto em Y | I | as `fontes` só de artefato alcançado | |
| `contracts.test` | U | `fontes` sem hash, chave, quem enviou nem licenciante | |
| chip: carregando; título e edição; "edição anterior"; "material da escola"; sem `fontes`; erro | U | um caso cada | |
| PDF do artefato | U | o rodapé com título, edição e "edição anterior" | |
| recomeço: outro artefato na mesma aba; o mesmo de novo; resposta atrasada | E | o chip não mostra a fonte do anterior | |
| nova edição, e o artefato antigo com "edição anterior" | E | fim a fim | |
| cabe em 1366 × 768 | E | `paginaNaoRola` | |

## Como testar

- Rota: `apps/api/src/artefato/artefato.int.test.ts` › "o artefato de A não é lido, renomeado, exportado nem adaptado…" (l.228)
- Chip: `apps/web/src/components/ui/ai/pecas-revestidas.test.tsx` › "ChipFonte"
- `titulos-dos-materiais.ts` não tem teste: o caso nasce aqui
- e2e: `e2e/support/coordenacao.ts` (`irPelaCoordenacao`) para a nova edição, e a rota do professor para o artefato
- Comandos: `npx vitest run --project integracao apps/api/src/artefato/artefato.int.test.ts`; `node tools/ci/e2e.ts --manter-ambiente e2e/artefato-fontes.spec.ts`
- Armadilha: o estado "edição anterior" só depois da resposta do `GET`; a resposta atrasada segurada com `page.route`
- **Telas:** `professora`, `/professor/artefatos/:artefatoId` (o chip com edição, com "edição anterior", com "material da escola"); o PDF exportado

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano. Na 3: o artefato da A
e o da B com o mesmo material de nome igual. Na 5: o chip comparado pelo texto que o professor lê.

## Fora do escopo desta tarefa

Página e trecho da citação (já existem).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar
