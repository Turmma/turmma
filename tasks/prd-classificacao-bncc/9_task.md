# Tarefa 9.0 — A contração da F4: o check titularidade e licença vale, e os checks e o código de `material.licenciante` saem

**Funcionalidade:** classificacao-bncc · **Depende de:** 7.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

O que a F4 deixou para contrair: o backfill de séries e licenças roda de novo para o que entrou na janela, o banco passa a
exigir que todo material de terceiro tenha licença (e só ele), e o código deixa de ler e gravar `material.licenciante`,
que sai do schema Drizzle; a coluna fica no banco até o deploy seguinte (`DROP COLUMN` no `TODO.md`).

## Contexto necessário

- `techspec.md` §3 "Migrations", item (3); §11
- `abertura.md`, item 4; a Tech Spec da F4, §3 (`tasks/prd-ingestao-do-material/techspec.md`, a frase "A contração é da F4b")
- `cenarios.md` "Contração da F4 (migration 3)"
- `.claude/rules/`: 10, 20 (item 1: `licenciante` pode ser pessoa), 80 (item 9)
- Código: `packages/core/src/db/schema/material.ts` (os checks `material_licenciante_*`), `packages/core/drizzle/0053_licenca_de_material_backfill.sql`
  e `0055_material_serie_backfill.sql`, `apps/api/src/material/material.service.ts` e `material.repository.ts` (onde
  `licenciante` é lido e gravado), `packages/core/src/titular/leitura-do-titular.ts`

## Subtarefas

- [ ] 9.1 — Migration: o backfill de séries e licenças de novo, idempotente, por escola
- [ ] 9.2 — O check `(titularidade = 'terceiro_com_licenca') = (licenca_id is not null)` com `NOT VALID` e `VALIDATE`; saem `material_licenciante_so_de_terceiro` e `material_licenciante_preenchido`
- [ ] 9.3 — O código: o licenciante que a API devolve vem da licença (`licenca_de_material`), nunca de `material.licenciante`; a coluna sai do schema Drizzle; worker, varredura, titular e fixtures acompanham
- [ ] 9.4 — `DROP COLUMN material.licenciante` no `TODO.md`, para o deploy seguinte; `docs/modelo-de-dados.md`
- [ ] 9.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0063_*.sql`, `packages/core/drizzle/meta/_journal.json`, `packages/core/src/db/schema/material.ts` | novo e alterado |
| `apps/api/src/material/material.service.ts`, `apps/api/src/material/material.repository.ts`, `apps/api/src/material/licenca.repository.ts` | alterado |
| `packages/core/src/titular/leitura-do-titular.ts`, `packages/core/src/material/varredura.repository.ts`, `apps/worker/src/processors/extrair-pdf.ts` | alterado |
| `apps/api/test/material.fixture.ts`, `apps/api/test/leitura-por-serie.fixture.ts`, `apps/api/test/licenca.int.test.ts`, `apps/api/test/material.int.test.ts` | alterado |
| `packages/core/src/db/contracao-da-f4.int.test.ts`, `docs/modelo-de-dados.md`, `TODO.md` | novo e alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| backfill duas vezes | I | o mesmo resultado | |
| terceiro sem licença criado na janela | I | corrigido antes do `VALIDATE` | |
| backfill | I | não cruza escola: material da B só com licença da B | |
| check: terceiro sem licença | I | recusado. Mutação: um lado da igualdade | |
| check: próprio com licença | I | recusado. Mutação: o outro lado | |
| envio de terceiro | I | funciona sem os checks de `licenciante` | |
| o código não lê a coluna | I | com a coluna renomeada no teste, o envio e a leitura passam | |
| a resposta | I | o licenciante vem da licença, só à coordenação | |
| a versão anterior do código | I | segue escrevendo com o schema novo (regra 80, item 9) | |

## Como testar

- Check e `VALIDATE`: `packages/core/src/db/migracao-fila-ferramenta.int.test.ts` › "só expande: a linha de antes segue lá e o que o código anterior gravava continua aceito" e "os dois checks terminam validados…"
- Backfill: `packages/core/src/db/migracao-f4.int.test.ts` › "mais de um lote de 5.000: as 5.100 linhas da escola C apontam a mesma licença, e nenhuma ficou sem"
- Versão anterior: `packages/core/src/db/volta-da-f4.int.test.ts` (o schema congelado em `packages/core/src/db/test/schema-antes-da-f4.ts`)
- Licença: `apps/api/test/licenca.int.test.ts`; `grep -rn "licenciante" apps packages e2e` antes e depois, cada ocorrência de `material.licenciante` trocada ou justificada no plano
- Comando: `npx vitest run --project integracao packages/core/src/db/contracao-da-f4.int.test.ts`
- Armadilha: a FK nova no catálogo do MVP (`mvp-tables.int.test.ts`) quebrou a esteira duas vezes na F4: rode-o

## Autoconferência

As 12 perguntas do modelo, no plano. Na 8: a busca pelo nome da coluna em `docs/` também (`lgpd.md`, `modelo-de-dados.md`).

## Fora do escopo desta tarefa

O `DROP COLUMN` (deploy seguinte, `TODO.md`); qualquer tela (a resposta da API não muda de forma).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar

