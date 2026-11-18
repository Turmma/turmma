# Tarefa 6.0 — A mudança de componente ou de séries limpa e reagenda a classificação

**Funcionalidade:** classificacao-bncc · **Depende de:** 5.0
**Subagentes obrigatórios:** `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian`
**Porte:** grande

## Objetivo

O `PATCH` do componente da disciplina (1.0) e o de séries do material (F4) só enfileiram o job de agendar; ele lê o
recorte atual, limpa as seções não corrigidas (sem execução, sem `origem: 'ia'`, `falhas_seguidas` zerada) e, com
componente e a função ativa, agenda de novo. O `preparar` sem candidatas limpa só a própria seção.

## Contexto necessário

- `techspec.md` §5 "Agendar" (b), "Suspensão", "Classificação" (candidatas no `preparar`); §7c
- `prd.md` RF5, RF19
- `cenarios.md` "Seções e agendamento" (recorte, componente apagado, suspensa, sem candidatas); P9, P10a, P10b, P11
- `.claude/rules/`: 10, 70, 80
- Código: `apps/api/src/material/material.service.ts` (`atualizar`, com a auditoria `material.atualizado`),
  `apps/api/src/estrutura/disciplina/disciplina.service.ts` (o `PATCH` da 1.0), `apps/api/src/material/agendar-classificacao.ts`
  e `classificar-secoes.command.ts` (5.0 e 4.0)

## Subtarefas

- [x] 6.1 — Os dois `PATCH` enfileiram `material.agendar-classificacao` (do material, ou de cada material da disciplina), com a chave do registro de auditoria do `PATCH`, sem criar execução na transação da requisição
- [x] 6.2 — O job decide pelo recorte atual, não pelo conteúdo do `PATCH`; limpa como a §5 "Agendar" (b); a corrigida fica; suspensa ou sem componente: limpa e não agenda
- [x] 6.3 — O `preparar` sem candidatas conclui sem modelo e limpa as seções com `execucao_id = :esta` (P11)
- [x] 6.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/material/agendar-classificacao.ts`, `apps/api/src/material/secoes.repository.ts`, `apps/api/src/material/classificar-secoes.command.ts` | alterado |
| `apps/api/src/material/material.service.ts`, `apps/api/src/estrutura/disciplina/disciplina.service.ts`, `apps/api/src/estrutura/estrutura.module.ts` | alterado |
| `apps/api/src/material/recorte.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| `PATCH` de séries do 6º para o 9º | I | execução nova com as candidatas do 9º | `recorte.int.test.ts` › séries do 6º para o 9º… |
| `PATCH` do componente | I | execução nova | `recorte.int.test.ts` › componente da disciplina… |
| mudança de recorte | I | a corrigida fica; zera `falhas_seguidas`. Mutação: sem zerar | `recorte.int.test.ts` › a seção corrigida fica… |
| o `PATCH` só enfileira | I | nenhuma execução na transação. Mutação: o `PATCH` com a regra da rotina | `recorte.int.test.ts` › séries do 6º para o 9º… (o `PATCH` já respondeu e `execucao_agente` não mudou) |
| `PATCH` durante uma `rodando` | I | a antiga sem efeito, a seção com a nova | `recorte.int.test.ts` › `PATCH` durante uma execução `rodando`… |
| `PATCH` de séries com a seção `aguardando` | I | a execução recebe as do 9º. Mutação: gravar as candidatas no agendar | `recorte.int.test.ts` › `PATCH` de séries com a seção `aguardando`… |
| componente apagado | I | nenhuma execução nova. Mutação: o job com a regra do recorte | `recorte.int.test.ts` › componente apagado: nenhuma execução nova… |
| componente apagado | I | as não corrigidas `nao_agendada`, sem `origem: 'ia'`; a corrigida fica | `recorte.int.test.ts` › componente apagado: nenhuma execução nova… (as mesmas asserções) |
| dois `PATCH` seguidos | I | vale o recorte do segundo | `recorte.int.test.ts` › dois `PATCH` seguidos… |
| job do componente apagado entregue depois de ele voltar | I | agenda pelo atual. Mutação: decidir pelo conteúdo do `PATCH` | `recorte.int.test.ts` › o job do componente apagado, entregue depois de ele voltar… |
| suspensa: `PATCH` que apaga; que troca | I | limpa e não agenda. Mutação: sair antes da limpeza | `recorte.int.test.ts` › função suspensa… |
| suspensa e retomada | I | a rotina agenda pelo componente novo | `recorte.int.test.ts` › função suspensa… (a segunda metade do caso) |
| `PATCH` de séries sem componente | I | limpa, sem execução | `recorte.int.test.ts` › `PATCH` de séries numa disciplina sem componente… |
| `preparar` sem candidatas | I | sem modelo nem consumo; `nao_agendada`; `falhas_seguidas` de 2 a 0. Mutação: chamar com a lista vazia | `recorte.int.test.ts` › sem candidatas: conclui sem modelo… |
| laço do job com mais de 500 | I | um lote por transação | `recorte.int.test.ts` › mais seções que o lote… |
| job da A | I | não limpa seção da B. Mutação: tirar `escola_id` | `recorte.int.test.ts` › o job da escola A com o id do material… |
| P9, rotina × `PATCH` | P | uma execução | `recorte.int.test.ts` › P9, rotina × `PATCH`… |
| P10a | P | a limpeza espera e apaga os recém-gravados. Mutação: apagar antes da trava | `recorte.int.test.ts` › P10a, a limpeza × o `concluir`… |
| P10b | P | o `concluir` não grava | `recorte.int.test.ts` › P10b, a limpeza × o `concluir`… |
| P11 | P | a execução nova não fica órfã. Mutação: tirar `execucao_id = :esta` da limpeza | `recorte.int.test.ts` › [P] o job agenda pelo componente definido de novo… |
| log do job | U | sem título, texto nem código | `recorte.int.test.ts` › mais seções que o lote… (o log só tem ids e contagens; o caso é de integração, o log lido do processador) |

## Como testar

- `PATCH` de séries: `apps/api/test/material-patch.int.test.ts` › "título e séries: a resposta traz o material alterado…"; ordem forçada: "[P] dois PATCH do mesmo material, o primeiro preso depois de gravar as séries…"
- Travas: `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`); no job parado num passo de `lock_timeout` curto, o outro lado vai por SQL (autoconferência 10, c)
- Execução e seções semeadas: os helpers que a 4.0 e a 5.0 deixaram em `apps/api/src/material/`
- `npx vitest run --project integracao apps/api/src/material/recorte.int.test.ts`

## Autoconferência

As 12 perguntas do modelo, no plano. Na 10: P10a e P10b são duas direções, dois casos.

## Fora do escopo desta tarefa

Reclassificar e D76 (7.0); a cobertura (13.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O job que refaz o recorte é o mesmo tipo `material.agendar-classificacao` da rotina, com `materialId` ou `disciplinaId` nos dados (os dois juntos são `DADOS_INVALIDOS`); sem dados é o da rotina. O processador é `apps/worker/src/processors/agendar-classificacao.ts` e a limpeza (`limparDoRecorte`) mora no `AgendamentoDaClassificacaoRepository`, no `core` | A tabela de arquivos previstos citava `apps/api/src/material/agendar-classificacao.ts`, que não existe: a 5.0 já pôs o agendamento no `core` e o processador no worker (a guarda `app-nao-importa-app` impede o worker de importar a API). O `PATCH` leva só o id do alvo, e o job lê o recorte do banco na hora de rodar | `techspec.md` §5 ("Agendar" (b)); `cenarios.md` ("Seções e agendamento", `PATCH` de séries e de componente) |
| A chave do job do `PATCH` é um UUID novo, gravado na mesma transação da auditoria, e não o id da linha de auditoria | `AuditoriaRecorder.gravar` devolve `void`, e a porta única da auditoria não é tocada só para isso. O UUID novo faz o mesmo: um job por `PATCH`, nascido ou desfeito junto com a auditoria, e dois `PATCH` seguidos são dois jobs (vale o recorte do segundo) | `techspec.md` §5 ("Agendar" (b)); `cenarios.md` ("dois `PATCH` seguidos com o primeiro job ainda na fila") |
| O `PATCH` de séries só enfileira o job quando o conjunto de séries muda (e o de componente, quando o componente muda); o mesmo conjunto, só o título ou só o nome não enfileiram nada | Limpar e reagendar com o mesmo recorte jogaria fora, e pagaria de novo, a classificação inteira do material por um `PATCH` que não mudou nada | `techspec.md` §5 ("Agendar" (b)); `recorte.int.test.ts` › só o título, as mesmas séries… |
| `SecoesRepository.limparDaExecucao` (4.0) passa a ser um `update … returning` com `execucao_id = :esta`, e só apaga o código da IA das seções que o `update` devolveu (antes lia as seções e depois agia) | Entre ler e limpar, o job da mudança de recorte pode levar a seção a uma execução nova; o `update` único fecha a janela, e a limpeza do `preparar` sem candidatas (P11) deixa a execução nova com a seção | `techspec.md` §5 ("Agendar" (b), "…limpa as seções com `execucao_id = :esta`"); `cenarios.md` (P11) |

## Mutações

`--faltando: 0 linhas (39 blocos, 6 motivos)`. Os blocos foram escritos a partir do código desta árvore, e a ferramenta do portão os corre. Os dois do P10 e do P11 da tabela de corridas que o documento pede e que não têm bloco (P9 e P10b) são código da 4.0 e da 5.0, que esta tarefa não altera: o `execucao_id = :esta` do `concluir` e o `is not distinct from` do `agendar` já têm bloco nos documentos delas. As mutações "gravar as candidatas no agendar" e "decidir pelo conteúdo do `PATCH`" da tabela não têm linha de código a mutar: o job não lê o conteúdo do `PATCH` (ele só leva o id do alvo) e o `agendar` não grava candidata; os casos "ao rodar, a execução recebe as candidatas do 9º" e "o job do componente apagado entregue depois de ele voltar" provam as duas escolhas pelo resultado.

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/src/material/recorte.int.test.ts › só o título, as mesmas séries
-    if (pedidas === undefined || pedidas.toSorted().join() === antes.toSorted().join()) return
+    if (pedidas.toSorted().join() === antes.toSorted().join()) return
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/src/material/recorte.int.test.ts › só o título, as mesmas séries
falha: toEqual([])
-    if (pedidas === undefined || pedidas.toSorted().join() === antes.toSorted().join()) return
+    if (pedidas === undefined) return
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/src/material/recorte.int.test.ts › séries do 6º para o 9º
-    await this.dependencias.enfileirador.enfileirarUmaVez(tx, TIPO_AGENDAR_CLASSIFICACAO, { materialId }, randomUUID())
+    await (async () => { const { AgendamentoDaClassificacaoRepository: Repo } = await import('@educa/core'); const repo = new Repo(tx); const { limpas } = await repo.limparDoRecorte({ materialId }, 500); await repo.agendar(await repo.proximasSecoes(500, { secaoIds: limpas }), this.dependencias.enfileirador) })()
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/src/material/recorte.int.test.ts › séries do 6º para o 9º
-    await this.dependencias.enfileirador.enfileirarUmaVez(tx, TIPO_AGENDAR_CLASSIFICACAO, { materialId }, randomUUID())
```

```mutacao
arquivo: apps/api/src/estrutura/disciplina/disciplina.service.ts
teste: apps/api/src/material/recorte.int.test.ts › componente da disciplina
-        await this.enfileirador.enfileirarUmaVez(tx, TIPO_AGENDAR_CLASSIFICACAO, { disciplinaId: atual.id }, randomUUID())
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/recorte.int.test.ts › `limparDoRecorte` de um material só com seção corrigida
-    if (ids.length === 0) return { limpas: [], ultima }
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/recorte.int.test.ts › `limparDaExecucao` de uma execução que nenhuma seção tem
-    if (limpas.length === 0) return 0
```

```mutacao
arquivo: packages/shared/src/system/job-definitions.ts
teste: apps/api/src/material/recorte.int.test.ts › séries do 6º para o 9º
-const agendamentoDaClassificacaoSchema = z.strictObject({ materialId: z.uuid().optional(), disciplinaId: z.uuid().optional() })
+const agendamentoDaClassificacaoSchema = z.strictObject({})
```

```mutacao
arquivo: apps/worker/src/processors/agendar-classificacao.ts
teste: apps/api/src/material/recorte.int.test.ts › componente da disciplina
-  if (dados.materialId !== undefined && dados.disciplinaId !== undefined) throw new JobFailureError(JobFailureCode.DADOS_INVALIDOS, true)
+  if (dados.disciplinaId !== undefined) throw new JobFailureError(JobFailureCode.DADOS_INVALIDOS, true)
```

```mutacao
arquivo: apps/worker/src/processors/agendar-classificacao.ts
teste: apps/api/src/material/recorte.int.test.ts › séries do 6º para o 9º
-  if (dados.materialId !== undefined && dados.disciplinaId !== undefined) throw new JobFailureError(JobFailureCode.DADOS_INVALIDOS, true)
+  if (dados.materialId !== undefined) throw new JobFailureError(JobFailureCode.DADOS_INVALIDOS, true)
```

```mutacao
arquivo: apps/worker/src/processors/agendar-classificacao.ts
teste: apps/api/src/material/recorte.int.test.ts › `materialId` e `disciplinaId` juntos
-  if (dados.materialId !== undefined && dados.disciplinaId !== undefined) throw new JobFailureError(JobFailureCode.DADOS_INVALIDOS, true)
```

```mutacao
arquivo: apps/worker/src/processors/agendar-classificacao.ts
teste: apps/api/src/material/recorte.int.test.ts › séries do 6º para o 9º
-  if (dados.materialId !== undefined) return { materialId: dados.materialId }
+  if (false) return { materialId: dados.materialId as string }
```

```mutacao
arquivo: apps/worker/src/processors/agendar-classificacao.ts
teste: apps/api/src/material/recorte.int.test.ts › componente da disciplina
-  if (dados.disciplinaId !== undefined) return { disciplinaId: dados.disciplinaId }
+  if (false) return { disciplinaId: dados.disciplinaId as string }
```

```mutacao
arquivo: apps/worker/src/processors/agendar-classificacao.ts
teste: apps/api/src/material/recorte.int.test.ts › séries do 6º para o 9º
-    if (alvo !== undefined) return refazOsRecortes({ banco, enfileirador, logger, lote }, alvo, sinal)
```

```mutacao
arquivo: apps/worker/src/processors/agendar-classificacao.ts
teste: apps/api/src/material/recorte.int.test.ts › com o sinal abortado
   let estado: 'fim' | 'sinal' = 'fim'
   for (;;) {
-    if (sinal.aborted) {
-      estado = 'sinal'
-      break
-    }
     const feito = await banco.transaction(async (tx) => {
```

```mutacao
arquivo: apps/worker/src/processors/agendar-classificacao.ts
teste: apps/api/src/material/recorte.int.test.ts › séries do 6º para o 9º
-    if (feito === undefined) break
```

```mutacao
arquivo: apps/worker/src/processors/agendar-classificacao.ts
teste: apps/api/src/material/recorte.int.test.ts › função suspensa
-      if (!(await repositorio.funcaoEstaAtiva())) return { ultima, limpas: limpas.length, agendado: { execucoes: 0, secoes: 0 } }
```

```mutacao
arquivo: apps/worker/src/processors/agendar-classificacao.ts
teste: apps/api/src/material/recorte.int.test.ts › função suspensa
       const repositorio = new AgendamentoDaClassificacaoRepository(tx)
-      const { limpas, ultima } = await repositorio.limparDoRecorte(alvo, lote, cursor)
+      if (!(await repositorio.funcaoEstaAtiva())) return undefined
+      const { limpas, ultima } = await repositorio.limparDoRecorte(alvo, lote, cursor)
       if (ultima === undefined) return undefined
```

```mutacao
arquivo: apps/worker/src/processors/agendar-classificacao.ts
teste: apps/api/src/material/recorte.int.test.ts › mais seções que o lote
-  logger.info({ evento: 'classificacao.recorte_refeito', escolaId, tipo: 'materialId' in alvo ? 'material' : 'disciplina', estado, lotesTotal, limpasTotal, execucoesTotal, secoesTotal })
+  logger.info({ evento: 'classificacao.recorte_refeito', escolaId, tipo: false ? 'material' : 'disciplina', estado, lotesTotal, limpasTotal, execucoesTotal, secoesTotal })
```

```mutacao
arquivo: apps/worker/src/processors/agendar-classificacao.ts
teste: apps/api/src/material/recorte.int.test.ts › componente da disciplina
-  logger.info({ evento: 'classificacao.recorte_refeito', escolaId, tipo: 'materialId' in alvo ? 'material' : 'disciplina', estado, lotesTotal, limpasTotal, execucoesTotal, secoesTotal })
+  logger.info({ evento: 'classificacao.recorte_refeito', escolaId, tipo: true ? 'material' : 'disciplina', estado, lotesTotal, limpasTotal, execucoesTotal, secoesTotal })
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/recorte.int.test.ts › séries do 6º para o 9º
-          filtro.secaoIds === undefined ? undefined : inArray(secaoDoMaterial.id, [...filtro.secaoIds]),
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/recorte.int.test.ts › séries do 6º para o 9º
-    const doAlvo = 'materialId' in alvo ? eq(secaoDoMaterial.materialId, alvo.materialId) : eq(material.disciplinaId, alvo.disciplinaId)
+    const doAlvo = 'materialId' in alvo ? sql`true` : eq(material.disciplinaId, alvo.disciplinaId)
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/recorte.int.test.ts › componente da disciplina
-    const doAlvo = 'materialId' in alvo ? eq(secaoDoMaterial.materialId, alvo.materialId) : eq(material.disciplinaId, alvo.disciplinaId)
+    const doAlvo = 'materialId' in alvo ? eq(secaoDoMaterial.materialId, alvo.materialId) : sql`true`
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/recorte.int.test.ts › o job da escola A com o id do material
-      .where(and(eq(secaoDoMaterial.escolaId, escolaId), isNull(secaoDoMaterial.corrigidaEm), doAlvo, depoisDe === undefined ? undefined : gt(secaoDoMaterial.id, depoisDe)))
+      .where(and(isNull(secaoDoMaterial.corrigidaEm), doAlvo, depoisDe === undefined ? undefined : gt(secaoDoMaterial.id, depoisDe)))
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/recorte.int.test.ts › a seção corrigida fica
-      .where(and(eq(secaoDoMaterial.escolaId, escolaId), isNull(secaoDoMaterial.corrigidaEm), doAlvo, depoisDe === undefined ? undefined : gt(secaoDoMaterial.id, depoisDe)))
+      .where(and(eq(secaoDoMaterial.escolaId, escolaId), doAlvo, depoisDe === undefined ? undefined : gt(secaoDoMaterial.id, depoisDe)))
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/recorte.int.test.ts › séries do 6º para o 9º
-      .where(and(eq(secaoDoMaterial.escolaId, escolaId), isNull(secaoDoMaterial.corrigidaEm), doAlvo, depoisDe === undefined ? undefined : gt(secaoDoMaterial.id, depoisDe)))
+      .where(and(eq(secaoDoMaterial.escolaId, escolaId), isNull(secaoDoMaterial.corrigidaEm), depoisDe === undefined ? undefined : gt(secaoDoMaterial.id, depoisDe)))
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/recorte.int.test.ts › P10a
       .limit(limite)
-      .for('update', { of: secaoDoMaterial })
     const ultima = travadas.at(-1)?.id
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/recorte.int.test.ts › séries do 6º para o 9º
-    await this.tx.delete(habilidadeDaSecao).where(and(eq(habilidadeDaSecao.escolaId, escolaId), inArray(habilidadeDaSecao.secaoId, ids), eq(habilidadeDaSecao.origem, 'ia')))
+    await this.tx.delete(habilidadeDaSecao).where(and(eq(habilidadeDaSecao.escolaId, escolaId), eq(habilidadeDaSecao.origem, 'ia')))
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/recorte.int.test.ts › a seção corrigida fica
       .update(secaoDoMaterial)
-      .set({ execucaoId: null, falhasSeguidas: 0, classificadaEm: null })
+      .set({ execucaoId: null, classificadaEm: null })
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/recorte.int.test.ts › a seção corrigida fica
       .update(secaoDoMaterial)
-      .set({ execucaoId: null, falhasSeguidas: 0, classificadaEm: null })
+      .set({ execucaoId: null, falhasSeguidas: 0 })
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/recorte.int.test.ts › séries do 6º para o 9º
       .update(secaoDoMaterial)
-      .set({ execucaoId: null, falhasSeguidas: 0, classificadaEm: null })
+      .set({ falhasSeguidas: 0, classificadaEm: null })
```

```mutacao
arquivo: packages/core/src/material/agendamento-da-classificacao.repository.ts
teste: apps/api/src/material/recorte.int.test.ts › séries do 6º para o 9º
-      .where(and(eq(secaoDoMaterial.escolaId, escolaId), inArray(secaoDoMaterial.id, ids)))
+      .where(and(eq(secaoDoMaterial.escolaId, escolaId)))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › o repository, no contexto da A
-      .where(and(eq(secaoDoMaterial.escolaId, escolaId), eq(secaoDoMaterial.execucaoId, execucaoId), isNull(secaoDoMaterial.corrigidaEm), soAsSecoes === undefined ? undefined : inArray(secaoDoMaterial.id, [...soAsSecoes])))
+      .where(and(eq(secaoDoMaterial.execucaoId, execucaoId), isNull(secaoDoMaterial.corrigidaEm), soAsSecoes === undefined ? undefined : inArray(secaoDoMaterial.id, [...soAsSecoes])))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › `limparDaExecucao` limpa só
-      .where(and(eq(secaoDoMaterial.escolaId, escolaId), eq(secaoDoMaterial.execucaoId, execucaoId), isNull(secaoDoMaterial.corrigidaEm), soAsSecoes === undefined ? undefined : inArray(secaoDoMaterial.id, [...soAsSecoes])))
+      .where(and(eq(secaoDoMaterial.escolaId, escolaId), isNull(secaoDoMaterial.corrigidaEm), soAsSecoes === undefined ? undefined : inArray(secaoDoMaterial.id, [...soAsSecoes])))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/recorte.int.test.ts › o job agenda pelo componente definido de novo
-      .where(and(eq(secaoDoMaterial.escolaId, escolaId), eq(secaoDoMaterial.execucaoId, execucaoId), isNull(secaoDoMaterial.corrigidaEm), soAsSecoes === undefined ? undefined : inArray(secaoDoMaterial.id, [...soAsSecoes])))
+      .where(and(eq(secaoDoMaterial.escolaId, escolaId), isNull(secaoDoMaterial.corrigidaEm), soAsSecoes === undefined ? undefined : inArray(secaoDoMaterial.id, [...soAsSecoes])))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › `limparDaExecucao` limpa só
-      .where(and(eq(secaoDoMaterial.escolaId, escolaId), eq(secaoDoMaterial.execucaoId, execucaoId), isNull(secaoDoMaterial.corrigidaEm), soAsSecoes === undefined ? undefined : inArray(secaoDoMaterial.id, [...soAsSecoes])))
+      .where(and(eq(secaoDoMaterial.escolaId, escolaId), eq(secaoDoMaterial.execucaoId, execucaoId), soAsSecoes === undefined ? undefined : inArray(secaoDoMaterial.id, [...soAsSecoes])))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › a seção de material sem série não vai ao modelo
-      .where(and(eq(secaoDoMaterial.escolaId, escolaId), eq(secaoDoMaterial.execucaoId, execucaoId), isNull(secaoDoMaterial.corrigidaEm), soAsSecoes === undefined ? undefined : inArray(secaoDoMaterial.id, [...soAsSecoes])))
+      .where(and(eq(secaoDoMaterial.escolaId, escolaId), eq(secaoDoMaterial.execucaoId, execucaoId), isNull(secaoDoMaterial.corrigidaEm)))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › `limparDaExecucao` limpa só
-    await this.banco.delete(habilidadeDaSecao).where(and(eq(habilidadeDaSecao.escolaId, escolaId), inArray(habilidadeDaSecao.secaoId, limpas.map((secao) => secao.id)), eq(habilidadeDaSecao.origem, 'ia')))
+    await this.banco.delete(habilidadeDaSecao).where(and(eq(habilidadeDaSecao.escolaId, escolaId), eq(habilidadeDaSecao.origem, 'ia')))
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/src/material/classificacao.int.test.ts › `limparDaExecucao` limpa só
-    await this.banco.delete(habilidadeDaSecao).where(and(eq(habilidadeDaSecao.escolaId, escolaId), inArray(habilidadeDaSecao.secaoId, limpas.map((secao) => secao.id)), eq(habilidadeDaSecao.origem, 'ia')))
+    await this.banco.delete(habilidadeDaSecao).where(and(eq(habilidadeDaSecao.escolaId, escolaId), inArray(habilidadeDaSecao.secaoId, limpas.map((secao) => secao.id))))
```

Sem bloco (cada linha com o porquê):

- `packages/core/src/material/agendamento-da-classificacao.repository.ts:136`, `eq(material.escolaId, secaoDoMaterial.escolaId)`: é a chave composta da junção, que as FKs compostas já garantem (a seção só aponta para material da própria escola); a junção sem ela devolve a mesma linha
- `packages/core/src/material/agendamento-da-classificacao.repository.ts:136`, `eq(material.id, secaoDoMaterial.materialId)`: é a chave composta da junção, que as FKs compostas já garantem; sem ela a junção seria um produto cartesiano, que o `limit` e o `for update of` não deixariam passar despercebido em nenhum caso, mas nenhum caso a distingue da correta
- `packages/core/src/material/agendamento-da-classificacao.repository.ts:137`, `depoisDe === undefined ? undefined : gt(secaoDoMaterial.id, depoisDe)`: é o cursor do laço; sem ele o laço releria sempre as mesmas seções (nenhuma sai do conjunto não corrigido) e nunca terminaria, e o caso "mais seções que o lote" só falharia pelo prazo do teste, e não por uma asserção, o que a ferramenta recusa como mutação; o caso passa por ele com 3 lotes
- `packages/core/src/material/agendamento-da-classificacao.repository.ts:144`, `eq(habilidadeDaSecao.escolaId, escolaId)`: é a defesa em profundidade da regra 10, item 3: o `delete` só age sobre os ids que o `select ... for update` com escola devolveu (o caso do job da A com o id da B prova o conjunto), e nenhum caso distingue a cláusula
- `packages/core/src/material/agendamento-da-classificacao.repository.ts:144`, `eq(habilidadeDaSecao.origem, 'ia')`: o código da coordenação só existe em seção corrigida (a correção grava `corrigida_em`), que o `select` já deixou fora; a cláusula é a defesa de que a limpeza nunca apaga código de pessoa, e nenhum estado real a distingue
- `packages/core/src/material/agendamento-da-classificacao.repository.ts:148`, `eq(secaoDoMaterial.escolaId, escolaId)`: é a defesa em profundidade da regra 10, item 3: o `update` só age sobre os ids que o `select ... for update` com escola devolveu, e nenhum caso distingue a cláusula
- `apps/api/src/material/secoes.repository.ts:185`, `eq(habilidadeDaSecao.escolaId, escolaId)`: é a defesa em profundidade da regra 10, item 3: o `delete` só age sobre os ids que o `update ... returning` com escola devolveu, e nenhum caso distingue a cláusula

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª) | Possível deadlock entre `limparDoRecorte` (trava em ordem de id) e o `concluir` da 4.0 (grava na ordem da resposta do modelo): "Quando a 7.0 puser o `for update` da seção, vale travar em ordem de id ali também." | Tarefa 7.0, que mexe no `for update` da seção; é código da 4.0, fora desta tarefa |
| infra-guardian (1ª) | Job novo lido por worker antigo no deploy (`DADOS_INVALIDOS`, sem nova tentativa): registrar no runbook que API e worker sobem juntos e fora do horário letivo | `TODO.md` (`docs/runbook.md` não é arquivo desta tarefa; a regra 80, item 9, já manda o deploy fora do horário letivo) |
| revisor-geral (1ª) | O caminho da mudança de recorte não tem o teto de execuções da noite | Recusada: a Tech Spec §5 "Agendar" (b) não exige o teto e o comentário de `refazOsRecortes` registra a razão. O custo entra no texto da Tech Spec pelo item 12 |
| privacy-guardian (1ª) | Registrar em `docs/lgpd.md`, na linha do código BNCC por seção (`habilidade_da_secao`), que a mudança de recorte apaga o código da IA | `TODO.md`: `docs/lgpd.md` não é arquivo desta tarefa, e o revisor diz que não é dado pessoal nem bloqueia |
| conformidade-reviewer (1ª) | Caso de corrida entre a correção da coordenação e `limparDoRecorte`, quando a correção existir | Tarefa 7.0, que cria a correção pela API |
| test-engineer (1ª) | Dois jobs de recorte do mesmo material em paralelo (lote com 2 vagas por escola, entrega ao menos uma vez, D49), conferindo uma execução viva por seção | `TODO.md` |
| test-engineer (1ª) | `PATCH` de séries num material `processando` ou já excluído | `TODO.md` |
| test-engineer (1ª) | Isolamento (`recorte.int.test.ts`, "o job da escola A com o id…"): o vermelho vem do `statement_timeout` de 20 s, lento; usar `lock_timeout` curto | Recusada: o portão provou a mutação (vermelho de um caso que rodou), e o revisor mesmo diz "funciona"; sem ganho de cobertura |
| conformidade-reviewer (2ª), revisor-geral (2ª) | O caso "sem candidatas" perdeu `consumosDa(pendente) === 0`, e a Tech Spec (P11, §8) e o comentário de `refazOsRecortes` ainda dizem "sem consumo": apontar o teste da 4.0 que cobre o consumo zero | Já coberta: `apps/api/src/material/classificacao.int.test.ts:348` prova "sem modelo e sem consumo" pela execução real. Sem mudança nesta tarefa |
| infra-guardian (2ª) | O caso futuro dos dois jobs de recorte em paralelo deve conferir também que nenhuma execução órfã chega a consumir token | `TODO.md`: acrescentado ao item dos dois jobs em paralelo |
| infra-guardian (2ª) | O registro no runbook de que API e worker sobem juntos tem de estar escrito antes do primeiro deploy da funcionalidade | `TODO.md`: item já registrado; o Orquestrador confere antes do pouso |
| revisor-geral (2ª), test-engineer (2ª) | O helper `escritasDe` (Proxy sobre `delete` e `update` do Drizzle) depende de nomes internos da biblioteca: contar no banco antes e depois, ou comentar a dependência | `TODO.md` (reforço de teste; dono: Implementador, a próxima tarefa que tocar `recorte.int.test.ts`) |
| test-engineer (2ª) | "O `PATCH` de disciplina que falha depois de validar…": o 409 do nome sai antes do código que enfileira, então o caso não prova o desfazer da transação | `TODO.md` (dono: Implementador, a próxima tarefa que tocar `recorte.int.test.ts`) |
| privacy-guardian (2ª) | Levar o parágrafo novo da Tech Spec §8 (sem histórico do descartado) à linha de `habilidade_da_secao` em `docs/lgpd.md` | `TODO.md`: junto do item já registrado |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-18 09:05:59 | 2026-11-18 09:06:40 | `tenancy-guardian` | 1 | APROVADO | a6b0cf6e361723d6b |
| 2026-11-18 09:06:09 | 2026-11-18 09:06:45 | `privacy-guardian` | 1 | APROVADO | ad4b4147d85b6aa6d |
| 2026-11-18 09:06:01 | 2026-11-18 09:06:55 | `conformidade-reviewer` | 1 | APROVADO | a8bf3cc7e7aa0f40a |
| 2026-11-18 09:06:07 | 2026-11-18 09:07:09 | `revisor-geral` | 1 | APROVADO | ae089734f44019d4a |
| 2026-11-18 09:06:03 | 2026-11-18 09:07:32 | `infra-guardian` | 1 | APROVADO | a2cb902e926520d87 |
| 2026-11-18 09:06:05 | 2026-11-18 09:09:57 | `test-engineer` | 1 | REPROVADO | affa63bec4456fced |
| 2026-11-18 09:39:32 | 2026-11-18 09:39:49 | `tenancy-guardian` | 2 | APROVADO | ad5d1a540356b91ea |
| 2026-11-18 09:39:37 | 2026-11-18 09:39:58 | `conformidade-reviewer` | 2 | APROVADO | a43673d5b6ebfe6c2 |
| 2026-11-18 09:39:42 | 2026-11-18 09:40:11 | `infra-guardian` | 2 | APROVADO | a916c7926fe78b90c |
| 2026-11-18 09:39:53 | 2026-11-18 09:40:19 | `revisor-geral` | 2 | APROVADO | a376462e922edb067 |
| 2026-11-18 09:39:58 | 2026-11-18 09:40:21 | `privacy-guardian` | 2 | APROVADO | a31c7648c05e406a5 |
| 2026-11-18 09:39:48 | 2026-11-18 09:40:55 | `test-engineer` | 2 | APROVADO | ad25f96cbfe4a1833 |
