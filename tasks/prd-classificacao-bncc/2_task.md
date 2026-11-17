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

- [x] 2.1 — Migration: `secao_do_material` (`id uuid default uuidv7()`, `falhas_seguidas not null default 0`, as FKs compostas), `habilidade_da_secao`, `unique (escola_id, id)` em `capitulo_do_material`, os três índices da §7c; `lock_timeout`
- [x] 2.2 — Na transação da extração, depois dos capítulos e só para quem fez a transição: uma seção por capítulo, ou por bloco de 10 páginas; páginas antes do capítulo 1 sem seção
- [x] 2.3 — Migration (2): seções dos `pronto` não excluídos, em lotes de 1.000, sem execução, idempotente
- [x] 2.4 — Edição nova: herda habilidades e `corrigida_em` (sem `corrigida_por`) pelo capítulo de mesmo número e título sem acento nem caixa, com `material.classificacao_herdada` (autor `rotina`: o check `auditoria_rotina_so_nas_acoes` ganha a ação)
- [x] 2.5 — `docs/lgpd.md` (`corrigida_por`), `docs/modelo-de-dados.md`; `corrigida_por` em `fora` no arquivo do titular e na classificação
- [x] 2.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0060_*.sql`, `packages/core/drizzle/0061_*.sql`, `packages/core/src/material/secoes.ts`, `packages/core/src/material/secoes.test.ts`, `packages/core/src/db/migracao-f4b.int.test.ts` | novo |
| `packages/core/drizzle/meta/_journal.json`, `packages/core/src/db/schema/material.ts`, `packages/core/src/material/extracao.repository.ts`, `packages/core/src/material/index.ts`, `apps/worker/src/processors/extrair-pdf.ts`, `apps/worker/test/extrair-pdf.int.test.ts`, `apps/api/test/material-edicao.int.test.ts`, `packages/core/src/auditoria/acoes.ts`, `packages/core/src/titular/leitura-do-titular.ts`, `packages/shared/src/privacidade/classificacao.ts`, `apps/api/test/arquivo-do-titular.int.test.ts`, `packages/core/src/auditoria/auditoria.int.test.ts`, `packages/core/src/titular/leitura-do-titular.test.ts`, `apps/worker/test/expurgo-da-escola.int.test.ts`, `tools/guardas/tabelas-do-nucleo.mjs`, `docs/lgpd.md`, `docs/modelo-de-dados.md`, `docs/runbook.md` | alterado |
| `packages/core/src/db/volta-da-2-0.int.test.ts` | novo (a volta do código, com o bloco do `docs/runbook.md`) |
| `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts` | só rodar: o "pelo catálogo" passa sem mudança |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| material com capítulos | I | uma seção por capítulo | `extrair-pdf.int.test.ts` › material com capítulos: uma seção por capítulo, na escola do material, na ordem… (e `secoes.test.ts` › uma seção por capítulo, na ordem dele) |
| sem capítulo, 25 páginas | I | 1–10, 11–20, 21–25 | `extrair-pdf.int.test.ts` › sem capítulo, 25 páginas: 1–10, 11–20 e 21–25…; `secoes.test.ts` › sem capítulo, 25 páginas… |
| páginas antes do capítulo 1 | I | sem seção | `extrair-pdf.int.test.ts` › páginas antes do capítulo 1: sem seção…; `secoes.test.ts` › as páginas antes do primeiro capítulo não têm seção… |
| dois jobs da mesma extração em `Promise.all` | P | seções uma vez | `extrair-pdf.int.test.ts` › [P] dois jobs da mesma extração em `Promise.all`, os dois com os bytes na mão: as seções entram uma vez; › o job repetido depois de `pronto` não grava seção a mais |
| ordem duplicada | I | o `unique (escola_id, material_id, ordem)` recusa | `extrair-pdf.int.test.ts` › a ordem duplicada é recusada pelo `unique (escola_id, material_id, ordem)`; `migracao-f4b.int.test.ts` › o check recusa %s (a linha "ordem repetida no material") |
| seção da A com capítulo da B | I | a FK composta recusa | `extrair-pdf.int.test.ts` › a seção da escola A não aponta o capítulo nem o material da B…; `migracao-f4b.int.test.ts` › a seção da A não aponta o capítulo nem o material da B… |
| código fora de `habilidade_bncc` | I | recusado | `extrair-pdf.int.test.ts` › código fora de `habilidade_bncc`…; `migracao-f4b.int.test.ts` › a habilidade da seção: código fora da BNCC, origem fora de `ia` e `coordenacao`… |
| migration (2): `pronto` da A e da B, mais que o lote (injetável), duas vezes | I | todos ganham, sem duplicar | `migracao-f4b.int.test.ts` › cada `pronto` não excluído ganha as seções…; › o material da B ganha as dele…; › o lote menor que o número de materiais (3, com 13 a migrar) e a segunda rodada…; › só expande… |
| migration (2): excluído; `processando` | I | ficam fora, um caso cada | `migracao-f4b.int.test.ts` › o excluído e o `processando` ficam sem seção, um caso cada, e o `falhou` também |
| herança: mesmo número e título, sem acento nem caixa | I | herda as habilidades e `corrigida_em`, `corrigida_por` nulo; `material.classificacao_herdada`, no catálogo sem título. Mutação: tirar a herança | `material-edicao.int.test.ts` › o capítulo de mesmo número e título, sem acento nem caixa…; › `material.classificacao_herdada` na auditoria da edição nova…; › as habilidades herdadas guardam a origem que tinham… |
| mesmo número, título diferente; mesmo título, número diferente | I | não herda. Mutação: tirar cada termo | `material-edicao.int.test.ts` › mesmo número com título diferente, e mesmo título com número diferente…; `secoes.test.ts` › o número e o título juntos… |
| anterior só com `origem: 'ia'` | I | não herda | `material-edicao.int.test.ts` › a anterior só com habilidade de `origem: ia`…; › a edição de PDF sem capítulo não herda… |
| anterior da B com o capítulo corrigido | I | a da A não herda. Mutação: tirar `escola_id` da busca | `material-edicao.int.test.ts` › a correção da B não é herdada pela A…; › a mesma chamada, no contexto da B, acha a correção da B…; › a correção de outro material da mesma escola não é herdada… |
| eliminado o coordenador | I | `corrigida_por` nulo, `corrigida_em` fica | `migracao-f4b.int.test.ts` › o `corrigida_por` vira nulo com a eliminação da pessoa…; › o `corrigida_por` sem `corrigida_em` é recusado… |
| `corrigida_por` no arquivo do titular | I | em `fora` | `arquivo-do-titular.int.test.ts` › `corrigida_por` fica em `fora`…; `leitura-do-titular.test.ts` › a seção do material… |
| isolamento do repository de seção | I | material da B no contexto da A: nada. Mutação: tirar `escola_id` | `extrair-pdf.int.test.ts` › o repository: `gravarSecoes` com o material da B no contexto da A…; `material-edicao.int.test.ts` › a leitura dos capítulos das seções, no contexto da A, com o material da B…; › a seção da B, com a anterior da A, no contexto da A… |
| volta do código: o bloco `roll-forward` do runbook | I | o `pronto` sem seção ganha a de `planejarSecoes`; rodar de novo não duplica nem toca a existente | `volta-da-2-0.int.test.ts` › o `pronto` não excluído sem seção ganha…; › rodar de novo não duplica…; › o material que o código anterior fecha como `pronto` depois… |
| log da extração | I | só ids e contagens | `extrair-pdf.int.test.ts` › o log da extração leva só ids e contagens das seções… |

## Como testar

- Extração: `apps/worker/test/extrair-pdf.int.test.ts` › "[I] caminho feliz com marcador…" e "[P] dois jobs da mesma extração em `Promise.all`, os dois com os bytes na mão…"
- Edição: `apps/api/test/material-edicao.int.test.ts` › "[P] dois jobs da mesma edição…"; a seção corrigida da anterior entra por SQL
- Backfill: `packages/core/src/db/migracao-f4b.int.test.ts` › "o lote menor que o número de materiais (3, com 13 a migrar) e a segunda rodada dão o mesmo resultado, sem duplicar"; a volta do código: `packages/core/src/db/volta-da-2-0.int.test.ts`
- Titular: `apps/api/test/arquivo-do-titular.int.test.ts` › "a licença entra no arquivo de quem a registrou…"
- Catálogo do MVP: `mvp-tables.int.test.ts` › "pelo catálogo: toda FK…" quebra com FK nova (grupo E da retro da F4): rode-o
- `npx vitest run --project integracao apps/worker/test/extrair-pdf.int.test.ts`
- Armadilha: os workers do compose de pé disputam a extração (retro da F4, F)

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3: um capítulo que casa e um que só casa o número.

## Fora do escopo desta tarefa

Execuções e jobs (5.0); a leitura na API (7.0).

## Plano (Implementador)

**Arquivos:** os da tabela "Arquivos previstos", mais `packages/shared/src/index.ts` e `packages/shared/src/material/material.ts` (`ORIGENS_DA_HABILIDADE_DA_SECAO`), `packages/core/src/index.ts`, `packages/core/src/db/schema/auditoria.ts` (o check espelha a migration), `packages/core/drizzle/meta/0060_snapshot.json` e `0061_snapshot.json`, `apps/worker/test/expurgo-da-escola.int.test.ts` (a lista fechada das FKs que apontam para `execucao_agente` passa de sete a oito), `packages/core/src/auditoria/auditoria.int.test.ts` (a ação nova entra nos casos do autor `rotina`), `tasks/prd-classificacao-bncc/techspec.md` e `cenarios.md` (as divergências abaixo).

**Interfaces:** `planejarSecoes`, `chaveDoTituloDoCapitulo`, `chaveDoCapituloEntreEdicoes` e `CapituloGravado` (`secoes.ts`, puros); `ExtracaoDoMaterialRepository.gravarCapitulos` (agora devolve os capítulos gravados, com id), `gravarSecoes(materialId, paginas, capitulos)`, `capitulosDasSecoes(materialId, soCorrigidas)` (a leitura das duas edições) e `herdarClassificacao(novaId, antigaId)` (as duas devolvem a contagem; a da herança é a das linhas que o `update` alterou); ação de auditoria `material.classificacao_herdada` (`depois: { herdadoDe, secoes }`, autor `rotina`); entradas `secao_do_material` (arquivo do titular, com `corrigida_por` em `fora`) e `habilidade_da_secao` na classificação; `secaoDoMaterial`, `habilidadeDaSecao` e `ORIGENS_DA_HABILIDADE_DA_SECAO`.

**Testes:** a tabela acima, com o caso de cada linha na coluna "Caso".

### Autoconferência

1. **Mutações:** a seção "Mutações" abaixo, um bloco por cláusula do diff (repository, `secoes.ts`, o worker, o arquivo do titular, a classificação e, na migration, cada check, unique, FK com ação, índice e o laço do backfill), conferidos um a um antes do portão. O que o `--faltando` listava e nenhum teste vê leva a meia linha do motivo (a junção pelo `id`, que é chave primária, a escola repetida em `update` e `insert` que só protege o índice, o `NOT EXISTS` que derrubaria a própria migration).
2. **Texto na tela:** nenhum. A tarefa não tem tela, e a leitura na API é da 7.0.
3. **Segundo dado:** o capítulo que casa (mesmo número e título, com acento, caixa e espaço trocados) e os que só casam um termo (o número com outro título, o título com outro número, o sem número), na mesma anterior; e a anterior da B com o capítulo corrigido, igual ao da A, que é o que deixa a escola tirada da busca vermelha.
4. **Checagem anterior:** a herança só roda depois de `marcarPronto` ter achado a linha (a reentrega e o excluído não passam por ela), e é o caso `[P]` (dois jobs) e o do excluído durante a extração que provam isso; nenhuma rota nova.
5. **Asserção:** olha as linhas do banco (seção, habilidade, auditoria), não o texto do código; as de ausência (sem seção, sem marca, sem `material.classificacao_herdada`) vêm depois do envio que a produziria, na mesma cena em que o caso positivo prova que o código roda.
6. **Guarda nova:** nenhuma. Os testes estruturais (`architecture.test.ts`, `mvp-tables.int.test.ts`, o do arquivo do titular) leem as tabelas novas e cobram classificação, escopo e `fora`.
7. **Comentários e docs:** os docblocks dizem o que o código faz (a 2.0 não agenda: a seção nasce `nao_agendada`). `docs/lgpd.md` e `docs/modelo-de-dados.md` vêm da árvore, e as migrations dizem por que o lote não limita o tempo de trava.
8. **Divergências:** a tabela abaixo; a da FK da execução, a do check do `corrigida_por` e a do capítulo sem número entraram na `techspec.md` §3 e §5 e no `cenarios.md` (um `[I]` cada); o `prd.md` não diz o contrário (RF5 e RF6 falam em seção e herança, sem a ação da FK).
9. **Peça que já existe:** `gravarCapitulos`/`marcarPronto` e a transação da extração, `substituirAAnterior`, `AuditoriaRecorder` (o `registro`), o padrão `DO $$ … LOOP` da `0055`, `LeituraDoTitular` (`colunas` e `fora`), `CLASSIFICACAO_DAS_TABELAS`.
10. **Corrida:** dois jobs da mesma extração em `Promise.all` gravam as seções uma vez (a seção só entra depois do `marcarPronto` que um só vence), e o backfill duas vezes, com lote menor que o número de materiais, não duplica (`NOT EXISTS` mais `unique (escola_id, material_id, ordem)`).
11. **Isolamento:** o repository da herança lê e escreve com o `escola_id` do contexto, e o caso da B (a anterior da B lida no contexto da A, e a seção da B com a anterior da A) fica vermelho se o escopo sai; a mesma chamada no contexto da B acha a correção, para provar que o repository não é um que nunca herda. A coluna "Caso" está preenchida.
12. **Guardiões:** `tenancy-guardian` (escopo, FKs compostas, `unique (escola_id, id)`), `privacy-guardian` (`corrigida_por`, a auditoria sem título, o arquivo do titular), `infra-guardian` (migration expand-only com `lock_timeout`, backfill em lote, idempotente, índices pela escola); `test-engineer` e `revisor-geral` entram pela Mesa. Não há `achados/` ainda.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| `secao_do_material.execucao_id` leva `on delete set null ("execucao_id")` | A Tech Spec dizia só "FK `(escola_id, execucao_id)`". Sem ação, o expurgo de `execucao_agente` travaria na seção que cita a execução (as FKs que apontam para ela passam de sete a oito), e a classificação apagada deve voltar a `nao_agendada`, não impedir o expurgo | `techspec.md` §3 (a frase nova na seção), `cenarios.md` "Seções e agendamento" (o `[I]` da execução expurgada), `docs/modelo-de-dados.md` (`SecaoDoMaterial`), `migracao-f4b.int.test.ts` › a execução expurgada anula só o `execucao_id`…; `expurgo-da-escola.int.test.ts` › o que fica: a execução, as oito FKs… |
| `corrigida_por` só existe com `corrigida_em` (check novo) | Sem o check, a autoria poderia existir sem a marca da correção, e a eliminação da pessoa (que anula `corrigida_por`) e a marca (`corrigida_em`) deixariam de dizer a mesma coisa | `techspec.md` §3 (a frase nova), `cenarios.md` "Seções e agendamento" (o `[I]` do check), `migracao-f4b.int.test.ts` › o `corrigida_por` sem `corrigida_em` é recusado… |
| Capítulo sem número não casa entre as edições; a seção de bloco de páginas não herda; a anterior só classificada pela IA não conta | A Tech Spec dizia "mesmo número e título" sem dizer o que fazer quando o número é nulo (o título sozinho casaria "Soluções" com "Soluções" de outro lugar) | `techspec.md` §5 "Edição nova" (a frase nova), `cenarios.md` "Seções e agendamento" (o caso `[I]` novo), `material-edicao.int.test.ts` › mesmo número com título diferente… |

## Mutações

--faltando: 39 linhas (57 blocos, 9 motivos)

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/api/test/material-edicao.int.test.ts › dois capítulos da anterior com o mesmo número
-      if (!daAnterior.has(chave)) daAnterior.set(chave, id)
+      daAnterior.set(chave, id)
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/api/test/material-edicao.int.test.ts › mesmo número com título diferente
falha: .toBeNull()
-      const antiga = chave === null ? undefined : daAnterior.get(chave)
+      const antiga = daAnterior.get(chave)
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/api/test/material-edicao.int.test.ts › mesmo número com título diferente
-      if (antiga !== undefined) pares.push({ nova: id, antiga })
+      pares.push({ nova: id, antiga: antiga ?? '' })
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/api/test/material-edicao.int.test.ts › a anterior só com habilidade de `origem: ia`
-    if (pares.length === 0) return 0
+    
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/api/test/material-edicao.int.test.ts › o capítulo de mesmo número e título
-      update secao_do_material set corrigida_em = anterior.corrigida_em
+      update secao_do_material set corrigida_em = now()
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/api/test/material-edicao.int.test.ts › as habilidades herdadas guardam a origem
-      select ${escolaId}, v.nova, h.codigo, h.origem
+      select ${escolaId}, v.nova, h.codigo, 'coordenacao'
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › sem capítulo, 25 páginas
-    if (capitulos.length === 0) return []
+    
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › o repository: `gravarSecoes` com o material da B
-    if (planejadas.length === 0) return 0
+    
```

```mutacao
arquivo: packages/core/src/material/secoes.ts
teste: packages/core/src/material/secoes.test.ts › uma seção por capítulo, na ordem dele
-  if (capitulos.length > 0) return capitulos.map(({ id, ordem, paginaInicial, paginaFinal }) => ({ capituloId: id, ordem, paginaInicial, paginaFinal }))
+  if (false) return capitulos.map(({ id, ordem, paginaInicial, paginaFinal }) => ({ capituloId: id, ordem, paginaInicial, paginaFinal }))
```

```mutacao
arquivo: packages/core/src/material/secoes.ts
teste: packages/core/src/material/secoes.test.ts › o título sem acento
-  return titulo.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
+  return titulo.normalize('NFD').toLowerCase().replace(/\s+/g, ' ').trim()
```

```mutacao
arquivo: packages/core/src/material/secoes.ts
teste: packages/core/src/material/secoes.test.ts › o título sem acento
-  return titulo.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
+  return titulo.normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim()
```

```mutacao
arquivo: packages/core/src/material/secoes.ts
teste: packages/core/src/material/secoes.test.ts › o título sem acento
-  return titulo.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
+  return titulo.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
```

```mutacao
arquivo: packages/core/src/material/secoes.ts
teste: packages/core/src/material/secoes.test.ts › o capítulo sem número não tem chave
-  return numero === null ? null : `${String(numero)}|${chaveDoTituloDoCapitulo(titulo)}`
+  return `${String(numero)}|${chaveDoTituloDoCapitulo(titulo)}`
```

```mutacao
arquivo: packages/core/src/material/secoes.ts
teste: packages/core/src/material/secoes.test.ts › sem capítulo, 25 páginas
-    blocos.push({ capituloId: null, ordem: blocos.length + 1, paginaInicial: inicio, paginaFinal: Math.min(inicio + PAGINAS_POR_BLOCO_DE_SECAO - 1, paginas) })
+    blocos.push({ capituloId: null, ordem: blocos.length + 1, paginaInicial: inicio, paginaFinal: inicio + PAGINAS_POR_BLOCO_DE_SECAO - 1 })
```

```mutacao
arquivo: apps/worker/src/processors/extrair-pdf.ts
teste: apps/api/test/material-edicao.int.test.ts › a anterior só com habilidade de `origem: ia`
-  if (herdadas > 0) await registro.gravar(tx, 'material.classificacao_herdada', { entidadeId: novaId, depois: { herdadoDe: antigaId, secoes: herdadas }, autorOperador: 'rotina' })
+  await registro.gravar(tx, 'material.classificacao_herdada', { entidadeId: novaId, depois: { herdadoDe: antigaId, secoes: herdadas }, autorOperador: 'rotina' })
```

```mutacao
arquivo: apps/worker/src/processors/extrair-pdf.ts
teste: apps/api/test/material-edicao.int.test.ts › o capítulo de mesmo número e título
-  return { secoesTotal, secoesHerdadasTotal: await herdarAClassificacao(tx, materialId, substituiId) }
+  return { secoesTotal, secoesHerdadasTotal: 0 }
```

```mutacao
arquivo: apps/worker/src/processors/extrair-pdf.ts
teste: apps/api/test/material-edicao.int.test.ts › o capítulo de mesmo número e título
-        return gravarSecoesEFecharAEdicao(tx, materialId, resultado.paginas, capitulos, material.substituiId)
+        return gravarSecoesEFecharAEdicao(tx, materialId, resultado.paginas, capitulos, null)
```

```mutacao
arquivo: apps/worker/src/processors/extrair-pdf.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › material com capítulos: uma seção por capítulo
-  const secoesTotal = await new ExtracaoDoMaterialRepository(tx).gravarSecoes(materialId, paginas, capitulos)
+  const secoesTotal = 0
```

```mutacao
arquivo: apps/worker/src/processors/extrair-pdf.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › excluído enquanto o PDF é extraído
-      if (gravou === undefined) return 'sem_efeito'
+      
```

```mutacao
arquivo: apps/worker/src/processors/extrair-pdf.ts
teste: apps/worker/test/extrair-pdf.int.test.ts › excluído enquanto o PDF é extraído
-        if (disciplinaId === undefined) return undefined
+        
```

```mutacao
arquivo: packages/core/src/titular/leitura-do-titular.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › `corrigida_por` fica em `fora`
-          where t.escola_id = ${escolaId} and t.corrigida_por = ${titularId}`,
+          where t.escola_id = ${escolaId}`,
```

```mutacao
arquivo: packages/shared/src/privacidade/classificacao.ts
teste: packages/core/src/titular/leitura-do-titular.test.ts › a seção do material
-  secao_do_material: categoria(['material_excluido'], 'corrigida_por'),
+  secao_do_material: SEM_PESSOA,
```

```mutacao
arquivo: packages/core/drizzle/0060_secao_do_material.sql
teste: packages/core/src/db/migracao-f4b.int.test.ts › o check recusa página final antes da inicial
-	CONSTRAINT "secao_do_material_paginas_validas" CHECK ("secao_do_material"."pagina_inicial" >= 1 and "secao_do_material"."pagina_final" >= "secao_do_material"."pagina_inicial"),
+	CONSTRAINT "secao_do_material_paginas_validas" CHECK ("secao_do_material"."pagina_inicial" >= 1),
```

```mutacao
arquivo: packages/core/drizzle/0060_secao_do_material.sql
teste: packages/core/src/db/migracao-f4b.int.test.ts › o check recusa página inicial zero
-	CONSTRAINT "secao_do_material_paginas_validas" CHECK ("secao_do_material"."pagina_inicial" >= 1 and "secao_do_material"."pagina_final" >= "secao_do_material"."pagina_inicial"),
+	CONSTRAINT "secao_do_material_paginas_validas" CHECK ("secao_do_material"."pagina_final" >= "secao_do_material"."pagina_inicial"),
```

```mutacao
arquivo: packages/core/drizzle/0060_secao_do_material.sql
teste: packages/core/src/db/migracao-f4b.int.test.ts › o check recusa ordem zero
-	CONSTRAINT "secao_do_material_ordem_valida" CHECK ("secao_do_material"."ordem" >= 1),
+	CONSTRAINT "secao_do_material_ordem_valida" CHECK (true),
```

```mutacao
arquivo: packages/core/drizzle/0060_secao_do_material.sql
teste: packages/core/src/db/migracao-f4b.int.test.ts › o check recusa falhas seguidas negativas
-	CONSTRAINT "secao_do_material_falhas_validas" CHECK ("secao_do_material"."falhas_seguidas" >= 0),
+	CONSTRAINT "secao_do_material_falhas_validas" CHECK (true),
```

```mutacao
arquivo: packages/core/drizzle/0060_secao_do_material.sql
teste: packages/core/src/db/migracao-f4b.int.test.ts › o check recusa ordem repetida
-	CONSTRAINT "secao_do_material_ordem_unica" UNIQUE("escola_id","material_id","ordem"),
```

```mutacao
arquivo: packages/core/drizzle/0060_secao_do_material.sql
teste: packages/core/src/db/migracao-f4b.int.test.ts › o `corrigida_por` sem `corrigida_em` é recusado
-	CONSTRAINT "secao_do_material_corrigida_por_so_na_corrigida" CHECK ("secao_do_material"."corrigida_por" is null or "secao_do_material"."corrigida_em" is not null)
+	CONSTRAINT "secao_do_material_corrigida_por_so_na_corrigida" CHECK (true)
```

```mutacao
arquivo: packages/core/drizzle/0060_secao_do_material.sql
teste: packages/core/src/db/migracao-f4b.int.test.ts › a habilidade da seção: código fora
-	CONSTRAINT "habilidade_da_secao_origem_valida" CHECK ("habilidade_da_secao"."origem" in ('ia', 'coordenacao'))
+	CONSTRAINT "habilidade_da_secao_origem_valida" CHECK (true)
```

```mutacao
arquivo: packages/core/drizzle/0060_secao_do_material.sql
teste: packages/core/src/db/migracao-f4b.int.test.ts › a habilidade da seção: código fora
-ALTER TABLE "habilidade_da_secao" ADD CONSTRAINT "habilidade_da_secao_codigo_habilidade_bncc_codigo_fk" FOREIGN KEY ("codigo") REFERENCES "public"."habilidade_bncc"("codigo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0060_secao_do_material.sql
teste: packages/core/src/db/migracao-f4b.int.test.ts › a habilidade da seção: código fora
-	CONSTRAINT "habilidade_da_secao_pk" PRIMARY KEY("escola_id","secao_id","codigo"),
+	CONSTRAINT "habilidade_da_secao_pk" PRIMARY KEY("escola_id","secao_id"),
```

```mutacao
arquivo: packages/core/drizzle/0060_secao_do_material.sql
teste: packages/core/src/db/migracao-f4b.int.test.ts › apagar o material leva as seções
-ALTER TABLE "secao_do_material" ADD CONSTRAINT "secao_do_material_da_escola_fk" FOREIGN KEY ("escola_id","material_id") REFERENCES "public"."material"("escola_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
+ALTER TABLE "secao_do_material" ADD CONSTRAINT "secao_do_material_da_escola_fk" FOREIGN KEY ("escola_id","material_id") REFERENCES "public"."material"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0060_secao_do_material.sql
teste: packages/core/src/db/migracao-f4b.int.test.ts › apagar o material leva as seções
-ALTER TABLE "habilidade_da_secao" ADD CONSTRAINT "habilidade_da_secao_da_escola_fk" FOREIGN KEY ("escola_id","secao_id") REFERENCES "public"."secao_do_material"("escola_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
+ALTER TABLE "habilidade_da_secao" ADD CONSTRAINT "habilidade_da_secao_da_escola_fk" FOREIGN KEY ("escola_id","secao_id") REFERENCES "public"."secao_do_material"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0060_secao_do_material.sql
teste: packages/core/src/db/migracao-f4b.int.test.ts › a seção da A não aponta o capítulo nem o material da B
-ALTER TABLE "secao_do_material" ADD CONSTRAINT "secao_do_material_capitulo_da_escola_fk" FOREIGN KEY ("escola_id","capitulo_id") REFERENCES "public"."capitulo_do_material"("escola_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0060_secao_do_material.sql
teste: packages/core/src/db/migracao-f4b.int.test.ts › a seção da A não aponta o capítulo nem o material da B
-ALTER TABLE "secao_do_material" ADD CONSTRAINT "secao_do_material_da_escola_fk" FOREIGN KEY ("escola_id","material_id") REFERENCES "public"."material"("escola_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0060_secao_do_material.sql
teste: packages/core/src/db/migracao-f4b.int.test.ts › a execução expurgada anula só o `execucao_id`
-ALTER TABLE "secao_do_material" ADD CONSTRAINT "secao_do_material_execucao_da_escola_fk" FOREIGN KEY ("escola_id","execucao_id") REFERENCES "public"."execucao_agente"("escola_id","id") ON DELETE set null ("execucao_id") ON UPDATE no action;--> statement-breakpoint
+ALTER TABLE "secao_do_material" ADD CONSTRAINT "secao_do_material_execucao_da_escola_fk" FOREIGN KEY ("escola_id","execucao_id") REFERENCES "public"."execucao_agente"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0060_secao_do_material.sql
teste: packages/core/src/db/migracao-f4b.int.test.ts › o `corrigida_por` vira nulo com a eliminação da pessoa
-ALTER TABLE "secao_do_material" ADD CONSTRAINT "secao_do_material_corrigida_por_da_escola_fk" FOREIGN KEY ("escola_id","corrigida_por") REFERENCES "public"."usuario"("escola_id","id") ON DELETE set null ("corrigida_por") ON UPDATE no action;--> statement-breakpoint
+ALTER TABLE "secao_do_material" ADD CONSTRAINT "secao_do_material_corrigida_por_da_escola_fk" FOREIGN KEY ("escola_id","corrigida_por") REFERENCES "public"."usuario"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0060_secao_do_material.sql
teste: packages/core/src/db/migracao-f4b.int.test.ts › os três índices começam pela escola
-CREATE INDEX "secao_do_material_pagina_idx" ON "secao_do_material" USING btree ("escola_id","material_id","pagina_inicial");--> statement-breakpoint
+CREATE INDEX "secao_do_material_pagina_idx" ON "secao_do_material" USING btree ("material_id","pagina_inicial");--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0060_secao_do_material.sql
teste: packages/core/src/db/migracao-f4b.int.test.ts › os três índices começam pela escola
-CREATE INDEX "secao_do_material_execucao_idx" ON "secao_do_material" USING btree ("escola_id","execucao_id") WHERE "secao_do_material"."execucao_id" is not null;--> statement-breakpoint
+CREATE INDEX "secao_do_material_execucao_idx" ON "secao_do_material" USING btree ("execucao_id") WHERE "secao_do_material"."execucao_id" is not null;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0060_secao_do_material.sql
teste: packages/core/src/db/migracao-f4b.int.test.ts › os três índices começam pela escola
-CREATE INDEX "secao_do_material_execucao_idx" ON "secao_do_material" USING btree ("escola_id","execucao_id") WHERE "secao_do_material"."execucao_id" is not null;--> statement-breakpoint
+CREATE INDEX "secao_do_material_execucao_idx" ON "secao_do_material" USING btree ("escola_id","execucao_id");--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0060_secao_do_material.sql
teste: packages/core/src/db/migracao-f4b.int.test.ts › os três índices começam pela escola
-CREATE INDEX "habilidade_da_secao_codigo_idx" ON "habilidade_da_secao" USING btree ("escola_id","codigo");--> statement-breakpoint
+CREATE INDEX "habilidade_da_secao_codigo_idx" ON "habilidade_da_secao" USING btree ("codigo");--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0060_secao_do_material.sql
teste: packages/core/src/db/migracao-f4b.int.test.ts › o check da auditoria aceita a herança
-ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_rotina_so_nas_acoes" CHECK (autor_operador is distinct from 'rotina' or acao in ('usuario.eliminado', 'acesso_turma.revogado', 'titular.nome_trocado', 'pedido.concluido', 'material.substituido', 'material.classificacao_herdada')) NOT VALID;--> statement-breakpoint
+ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_rotina_so_nas_acoes" CHECK (autor_operador is distinct from 'rotina' or acao in ('usuario.eliminado', 'acesso_turma.revogado', 'titular.nome_trocado', 'pedido.concluido', 'material.substituido')) NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0061_secao_do_material_backfill.sql
teste: packages/core/src/db/migracao-f4b.int.test.ts › o excluído e o `processando`
falha: dados.materiais['aExcluido'])).toEqual([])
-				AND "material"."excluido_em" IS NULL
```

```mutacao
arquivo: packages/core/drizzle/0061_secao_do_material_backfill.sql
teste: packages/core/src/db/migracao-f4b.int.test.ts › o excluído e o `processando`
falha: dados.materiais['aProcessando'])).toEqual([])
-			WHERE "material"."estado" = 'pronto'
+			WHERE true
```

```mutacao
arquivo: packages/core/drizzle/0061_secao_do_material_backfill.sql
teste: packages/core/src/db/migracao-f4b.int.test.ts › o lote menor que o número de materiais
-		EXIT WHEN linhas = 0;
+		EXIT;
```

```mutacao
arquivo: packages/core/drizzle/0061_secao_do_material_backfill.sql
teste: packages/core/src/db/migracao-f4b.int.test.ts › cada `pronto` não excluído ganha as seções
-		CROSS JOIN LATERAL generate_series(1, ("lote"."paginas" + 9) / 10) AS "bloco"("n")
+		CROSS JOIN LATERAL generate_series(1, ("lote"."paginas" + 0) / 10) AS "bloco"("n")
```

```mutacao
arquivo: packages/core/drizzle/0061_secao_do_material_backfill.sql
teste: packages/core/src/db/migracao-f4b.int.test.ts › cada `pronto` não excluído ganha as seções
-		SELECT "lote"."escola_id", "lote"."id", NULL::uuid, "bloco"."n"::smallint, ("bloco"."n" - 1) * 10 + 1, least("bloco"."n" * 10, "lote"."paginas")
+		SELECT "lote"."escola_id", "lote"."id", NULL::uuid, "bloco"."n"::smallint, ("bloco"."n" - 1) * 10 + 1, "bloco"."n" * 10
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/api/test/material-edicao.int.test.ts › o capítulo de mesmo número e título
       update secao_do_material set corrigida_em = anterior.corrigida_em
-      from (values ${valores}) as v(nova, antiga)
+      from (values ${valores}) as v(antiga, nova)
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/api/test/material-edicao.int.test.ts › o capítulo de mesmo número e título
       select ${escolaId}, v.nova, h.codigo, h.origem
-      from (values ${valores}) as v(nova, antiga)
+      from (values ${valores}) as v(antiga, nova)
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/api/test/material-edicao.int.test.ts › o capítulo de mesmo número e título
-      join secao_do_material anterior on anterior.escola_id = ${escolaId} and anterior.id = v.antiga
+      join secao_do_material anterior on anterior.escola_id = ${escolaId} and anterior.id = v.nova
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/api/test/material-edicao.int.test.ts › o capítulo de mesmo número e título
-      where secao_do_material.escola_id = ${escolaId} and secao_do_material.id = v.nova`)
+      where secao_do_material.escola_id = ${escolaId} and secao_do_material.id = v.antiga`)
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/api/test/material-edicao.int.test.ts › o capítulo de mesmo número e título
-      insert into habilidade_da_secao (escola_id, secao_id, codigo, origem)
+      insert into habilidade_da_secao (escola_id, secao_id, origem, codigo)
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/api/test/material-edicao.int.test.ts › o capítulo de mesmo número e título
-      join habilidade_da_secao h on h.escola_id = ${escolaId} and h.secao_id = v.antiga`)
+      join habilidade_da_secao h on h.escola_id = ${escolaId} and h.secao_id = v.nova`)
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/api/test/material-edicao.int.test.ts › a leitura dos capítulos das seções
-      .where(and(eq(secaoDoMaterial.escolaId, escolaId), eq(secaoDoMaterial.materialId, materialId), soCorrigidas ? isNotNull(secaoDoMaterial.corrigidaEm) : undefined))
+      .where(and(eq(secaoDoMaterial.materialId, materialId), soCorrigidas ? isNotNull(secaoDoMaterial.corrigidaEm) : undefined))
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/api/test/material-edicao.int.test.ts › a correção de outro material da mesma escola
-      .where(and(eq(secaoDoMaterial.escolaId, escolaId), eq(secaoDoMaterial.materialId, materialId), soCorrigidas ? isNotNull(secaoDoMaterial.corrigidaEm) : undefined))
+      .where(and(eq(secaoDoMaterial.escolaId, escolaId), soCorrigidas ? isNotNull(secaoDoMaterial.corrigidaEm) : undefined))
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/api/test/material-edicao.int.test.ts › a anterior só com habilidade de `origem: ia`
falha: habilidadesDe(escolaId, primeira?.id ?? '')).toEqual([])
-      .where(and(eq(secaoDoMaterial.escolaId, escolaId), eq(secaoDoMaterial.materialId, materialId), soCorrigidas ? isNotNull(secaoDoMaterial.corrigidaEm) : undefined))
+      .where(and(eq(secaoDoMaterial.escolaId, escolaId), eq(secaoDoMaterial.materialId, materialId), undefined))
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/api/test/material-edicao.int.test.ts › o capítulo de mesmo número e título
-      .innerJoin(capituloDoMaterial, and(eq(capituloDoMaterial.escolaId, secaoDoMaterial.escolaId), eq(capituloDoMaterial.id, secaoDoMaterial.capituloId)))
+      .innerJoin(capituloDoMaterial, and(eq(capituloDoMaterial.escolaId, secaoDoMaterial.escolaId)))
```

Sem mutação que um teste veja (cada motivo, a meia linha):

- `if (substituiId === null) return { secoesTotal, secoesHerdadasTotal: 0 }`: o material comum (sem edição) faria as duas chamadas com `null`, e nenhuma acha linha (`substituirAAnterior` não marca nada e a herança lê `= null`, que não casa com id): o `if` só poupa a ida ao banco, e o resultado é o mesmo.
- `eq(capituloDoMaterial.escolaId, secaoDoMaterial.escolaId)`: o `id` do capítulo é a chave primária e a FK composta da seção já o prende à mesma escola; o termo só põe a escola na junção, e a seção que a lê é a da escola do contexto, no `where` logo abaixo, que o caso da B prova.
- `anterior.escola_id = ${escolaId}`, `secao_do_material.escola_id = ${escolaId}` e `h.escola_id = ${escolaId}` (o `join`, o `update` e o `insert` da herança): o `id` da seção é UUID e `pares` só leva ids lidos, na mesma chamada, pelas duas consultas que filtram a escola (provadas pelo caso da B); a escola repetida é a defesa em profundidade da regra 10 e, no `h.escola_id`, o prefixo do índice da chave `(escola_id, secao_id, codigo)` (regra 80, item 8). Tirar qualquer uma não muda resultado.
- `t.escola_id = ${escolaId}` (a linha do arquivo do titular, junto do filtro `t.corrigida_por = ${titularId}` que o bloco muta): a FK composta `(escola_id, corrigida_por)` já prende a seção ao usuário da mesma escola, então o `corrigida_por` do titular só alcança seção da escola dele; o termo é a regra 10 repetida, e o caso do arquivo diz que quem garante a outra escola é a FK.
- `atualizadas.rowCount ?? 0` (o retorno da herança): hoje é igual ao número de pares, porque as leituras filtram a escola como o `update`; o `?? 0` é o tipo (`rowCount` é `number | null`). A contagem é a do `update` para que a auditoria nunca afirme herança que não aconteceu.
- O `schema/material.ts` (os quatro checks da seção, o do `origem` da habilidade e o índice parcial) e o `schema/auditoria.ts` (o check das seis ações): o schema TypeScript é o espelho de `0060_secao_do_material.sql`, que é o que o banco roda e que os blocos `.sql` acima mutam, um por check, unique, FK com ação e índice; a leitura do Drizzle usa as colunas, e os checks só entram na geração da migration seguinte.
- `ALTER TABLE "capitulo_do_material" ADD CONSTRAINT "capitulo_do_material_escola_id_unico"`, `"secao_do_material_escola_id_unico"` e `AND NOT EXISTS (SELECT 1 FROM "secao_do_material" …)` (da `0061`): sem o primeiro e o segundo, as FKs compostas que apontam para eles não nascem e a `0060` inteira falha ao migrar; sem o `NOT EXISTS`, o segundo lote repete o primeiro e a `unique (escola_id, material_id, ordem)` derruba a `0061` no `beforeAll` do teste. Nos três casos o teste fica sem caso que rode, e a ferramenta recusa o vermelho de carga.
- `ON "capitulo_do_material"."escola_id" = "lote"."escola_id"` (a junção da `0061`): o `material_id` é UUID de chave primária; a escola na junção só cobre o índice do capítulo.
- `LIMIT lote` e `ORDER BY "material"."id"` (da `0061`): o tamanho do lote só muda quantos laços o `DO` dá, não o resultado: é o `EXIT WHEN linhas = 0`, mutado acima com o lote de 3 e 13 materiais, que prova que há mais de um laço.

## Recomendações sem aplicar

Da rodada 1 (`.processo/ordens/2_task-r1.md`) e da 2ª (`.processo/ordens/2_task-r2.md`, só recomendações; as últimas dez linhas). Os itens 1 a 10 da ordem foram aplicados; o item 3 (`revisor-geral` e `infra-guardian`) foi atendido pelo caminho (a): a seção do runbook, o bloco `volta-da-2-0: roll-forward` e o `volta-da-2-0.int.test.ts`. Viraram linha no `TODO.md` a 5ª, a 6ª, a 7ª e a 9ª; a 4ª foi para a 3.0, a 2ª e a 3ª para a 7.0 e a 3.0, e o resto não muda nada aqui.

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | As cláusulas `escola_id` repetidas no `update` e no `insert` da herança ficam sem teste que as prove sozinhas | Já está em "Sem mutação que um teste veja" (defesa em profundidade, regra 10); registrada para a retro |
| conformidade-reviewer (1ª) | A leitura da classificação (7.0) deve dizer "herdada da edição anterior", juntando `material.classificacao_herdada` | Tarefa 7.0 (a leitura na API é dela, segundo o "Fora do escopo" desta tarefa) |
| conformidade-reviewer (1ª) | O `fazSozinha` de `classificacao_do_material` deve dizer que a correção passa sozinha à edição nova quando número e título são iguais | Tarefa 3.0 (onde nasce a função, segundo a própria recomendação) |
| conformidade-reviewer (1ª) | A revisão da AIA `docs/aia/diagnostico-por-habilidade.md` deve registrar a herança como risco e o caminho de contestação | Tarefa 3.0 (revisão da AIA, segundo a própria recomendação) |
| privacy-guardian (1ª) | Caso de teste que passe pelo `CicloDeVidaService.eliminar`, e não por `delete from usuario` (`migracao-f4b.int.test.ts:301`) | `TODO.md`: é teste novo de caminho que a tarefa não toca; a FK `set null` já está provada pelo caso atual |
| infra-guardian (1ª) | Comentário do `0060` sobre o custo real do `VALIDATE` com `ACCESS EXCLUSIVE` em `auditoria` (ou `VALIDATE` em migration à parte) | `TODO.md`: o próprio revisor diz que não bloqueia (precedente das `0036` e `0056`, deploy fora do horário letivo); mexer na migration caduca todos os revisores |
| infra-guardian (1ª) | Índice parcial `(escola_id, corrigida_por) where corrigida_por is not null` | `TODO.md`: o revisor diz "se a tabela crescer além disso"; é schema novo |
| infra-guardian (1ª) | Herança lê a anterior sem trava; correção da 7.0 ao mesmo tempo fica fora | Tarefa 7.0: vira cenário quando a correção existir (a 2.0 não grava correção) |
| test-engineer (1ª) | `[P]` de dois jobs da mesma edição com a anterior corrigida (a PK `habilidade_da_secao_pk` estouraria com herança em dobro) | `TODO.md`: o `[P]` atual já prova o `marcarPronto` único que protege a herança; caso novo é teste inteiro, não poucas linhas |
| revisor-geral (1ª) | Material que fica `pronto` entre a migration e o código novo nunca ganha seção | Entrou na ordem como o item 3 (mesmo achado do `infra-guardian`) |
| privacy-guardian (2ª) | O cenário do `0061` e da volta da 2.0 segue em aberto no `TODO.md`; o passo do plantão está no runbook e testado | Já registrado no `TODO.md` (o revisor o cita), segue para a validação |
| privacy-guardian (2ª) | Quando a 7.0 gravar `corrigida_por`, o caso pelo `CicloDeVidaService.eliminar` deve provar também que a seção some do arquivo do titular eliminado | Tarefa 7.0, junto do caso que já está no `TODO.md` |
| conformidade-reviewer (2ª) | A 7.0 deve distinguir a seção corrigida pela coordenação da herdada pela rotina (as duas têm `corrigida_em` e `origem: 'coordenacao'`) | Tarefa 7.0 (mesmo destino da recomendação da 1ª rodada) |
| revisor-geral (2ª) | `cenarios.md:77-78`: o `[I]` da volta do código é o único dos novos sem "Mutação" (sugestão: tirar o `not exists`) | `TODO.md`: texto de cenário em documento; o caso de "rodar de novo" já prova a idempotência |
| revisor-geral (2ª) | Uma linha no runbook dizendo por que o bloco `volta-da-2-0` é um `INSERT` só, sem os lotes de 1.000 da `0061` | `TODO.md`: texto do runbook |
| revisor-geral (2ª) | Docblock de `capitulosDasSecoes` dizendo que é leitura interna da herança | Tarefa 7.0: decide se a leitura passa a ser de todos; hoje só a herança e um teste a usam |
| infra-guardian (2ª) | Abrir o bloco do runbook com `SET LOCAL lock_timeout = '5s';`, como a `0061` | `TODO.md`: texto do runbook, que o teste lê e executa; mexer no bloco pede teste junto |
| infra-guardian (2ª) | Deixar explícita no runbook a ordem dos passos (subir o código novo, esperar o `worker-pdf` antigo, rodar o bloco, reabrir o envio) | `TODO.md`: texto do runbook |
| test-engineer (2ª) | `volta-da-2-0.int.test.ts:237-238`: dar `capitulos: 2` ao `excluido` e ao `processando` para provar também a parte por capítulo do bloco | `TODO.md`: o filtro na `0061` já está provado em `migracao-f4b.int.test.ts`; o `tools/processo/mutacoes.ts` não cobra `docs/` |
| test-engineer (2ª) | `volta-da-2-0.int.test.ts:316`: comparar `corrigida_em` por `getTime()` com `Date.parse(...)`, e não por `toISOString()` | `TODO.md`: funciona hoje; robustez de teste |


## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-17 14:26:39 | 2026-11-17 14:27:32 | `tenancy-guardian` | 1 | APROVADO | aa1051d820a142079 |
| 2026-11-17 14:26:58 | 2026-11-17 14:27:50 | `conformidade-reviewer` | 1 | APROVADO | a24ad03d886c546ec |
| 2026-11-17 14:26:43 | 2026-11-17 14:28:05 | `privacy-guardian` | 1 | APROVADO | a3252bb3ed1d87800 |
| 2026-11-17 14:26:54 | 2026-11-17 14:28:36 | `revisor-geral` | 1 | REPROVADO | adeb5dd3f81bbd2f6 |
| 2026-11-17 14:26:46 | 2026-11-17 14:29:04 | `infra-guardian` | 1 | REPROVADO | ab88fe1e4fe04a6ac |
| 2026-11-17 14:26:50 | 2026-11-17 14:29:55 | `test-engineer` | 1 | APROVADO | a5d9f71e320facefa |
| 2026-11-17 15:11:13 | 2026-11-17 15:11:39 | `tenancy-guardian` | 2 | APROVADO | ac4e347f3db9e691b |
| 2026-11-17 15:11:19 | 2026-11-17 15:11:46 | `privacy-guardian` | 2 | APROVADO | adb750a0827c11eb9 |
| 2026-11-17 15:11:44 | 2026-11-17 15:12:07 | `conformidade-reviewer` | 2 | APROVADO | a1c77564cbfb4b518 |
| 2026-11-17 15:11:39 | 2026-11-17 15:12:27 | `revisor-geral` | 2 | APROVADO | accb745cf54fe97e4 |
| 2026-11-17 15:11:27 | 2026-11-17 15:12:30 | `infra-guardian` | 2 | APROVADO | a44b789712e0a89cb |
| 2026-11-17 15:11:33 | 2026-11-17 15:12:42 | `test-engineer` | 2 | APROVADO | a1e33e3e324f009d6 |
