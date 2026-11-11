# Tarefa 4.0 — Os capítulos lidos do PDF chegam no `GET /v1/materiais/:id`

**Funcionalidade:** ingestao-do-material · **Depende de:** 1.0
**Subagentes obrigatórios:** `tenancy-guardian`
**Porte:** pequeno

## Objetivo

A extração grava o capítulo (número, título, páginas) de cada parte do PDF, lido do marcador de primeiro nível ou da
linha "Capítulo N" no topo da página, e o `GET /v1/materiais/:id` os devolve; sem capítulo, o material fica `pronto`.

## Contexto necessário

- `techspec.md` §3 (`capitulo_do_material`), §4 (`GET /:id` com `capitulos`), §5 "Capítulos", §12 (a premissa do `getOutline()`)
- `prd.md` RF4
- `cenarios.md` "Extração no worker e capítulos": as linhas do `ChapterReader` e da amostra fixa
- `.claude/rules/`: 10, 40, 60
- Código: o processador `apps/worker/src/processors/extrair-pdf.ts` e o `PdfExtractor` em `packages/core/src/material/`
  (da 1.0); `tools/demonstracao` (onde nascem os PDFs sintéticos)

## Subtarefas

- [ ] 4.1 — Migration: `capitulo_do_material`, com a FK composta em cascata e os checks da §3; `docs/modelo-de-dados.md`
- [ ] 4.2 — `ChapterReader` em `packages/core/src/material/`: o marcador de primeiro nível pelo `getOutline()`, um por página; sem marcador, a linha `^(cap[ií]tulo|unidade|m[óo]dulo)\s+(\d+)` no topo quando o número muda, fora do sumário; erro dá zero capítulos
- [ ] 4.3 — Gravar na transação da extração, depois da transição; a amostra sintética em `tools/demonstracao`
- [ ] 4.4 — `capitulos` no contrato de `GET /v1/materiais/:id` (`packages/shared/src/material/material.ts`), DTO explícito
- [ ] 4.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0051_*.sql`, `packages/core/src/db/schema/material.ts`, `packages/core/src/material/chapter-reader.ts`, `packages/core/src/material/chapter-reader.test.ts`, `packages/core/src/material/extracao.repository.ts`, `packages/core/src/material/index.ts` | novo e alterado |
| `apps/worker/src/processors/extrair-pdf.ts`, `packages/shared/src/material/material.ts`, `packages/shared/src/privacidade/classificacao.ts`, `apps/api/src/material/material.repository.ts`, `apps/api/src/material/material.service.ts`, `docs/modelo-de-dados.md` | alterado |
| `tools/demonstracao/` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| caminho feliz com marcador | I | capítulos gravados e devolvidos em `GET /:id` | |
| PDF sem capítulo | I | `pronto`, com zero capítulos | |
| marcador de primeiro nível | U | vira capítulo; o de segundo nível não | |
| dois marcadores na mesma página | U | fica o primeiro | |
| marcadores fora de ordem | U | ordenados | |
| título vazio | U | "Capítulo N" | |
| título de 300 caracteres | U | cortado em 200 | |
| número acima de int | U | nulo | |
| linha "Capítulo 3" | U | só cria capítulo quando o número muda (cabeçalho corrido não cria um por página) | |
| sumário com três casamentos | U | a página é ignorada | |
| erro do leitor | U | zero capítulos, sem falhar | |
| amostra fixa com o pdfjs de verdade | U | marcador, destino nomeado, linha, cabeçalho corrido, sumário e nada: 100% das páginas no capítulo certo | |
| [P] dois jobs da mesma extração | P | capítulos uma vez. Mutação: gravar antes da transição | |
| expurgo | I | o material expurgado leva os capítulos (cascata) | |
| isolamento | I | `GET /:id` da B no contexto A: `NAO_ENCONTRADO`, sem capítulo | |
| permissão: aluno | I | recusado | |
| `contracts.test` | U | `capitulos` sem campo proibido | |

## Como testar

- Extrator: `apps/api/src/material/pdf-extraction.test.ts` › "o material de demonstração vira seis trechos, um por página…" (já movido na 1.0): o mesmo arranjo com o pdfjs de verdade
- Leitor: unidade pura, com o `getOutline()` falso para as bordas e o PDF sintético para a amostra
- Rota: `apps/api/test/material.int.test.ts`, os casos de `GET /:id`
- Comandos: `npx vitest run --project unidade packages/core/src/material/chapter-reader.test.ts`; `npx vitest run --project integracao apps/worker/test/extrair-pdf.int.test.ts`
- Armadilha: o regex e o "quando o número muda" são cláusulas, cada uma com bloco; a premissa da §12 só se prova com a amostra

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano. Na 3: o cabeçalho
corrido é o segundo dado da linha "Capítulo N". Na 9: o `PdfExtractor` já lê o documento; o leitor reaproveita a
abertura.

## Fora do escopo desta tarefa

A tela do painel (12.0); habilidade por capítulo (F4b).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar
