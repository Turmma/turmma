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

- [x] 8.1 — Migration: `edicao`, `substitui_id`, `substituido_por` (§3) e o índice parcial `material_uma_edicao_em_andamento`
- [x] 8.2 — `POST /v1/materiais/:id/edicoes` na ordem da §5 (o alvo antes de tudo; na transação, `for update` e a herança lida ali); `material.edicao_enviada`
- [x] 8.3 — Na extração, com `substitui_id`: o `update … where escola_id and id = :antiga and excluido_em is null`, trechos da antiga apagados, `material.substituido`
- [x] 8.4 — `EDICAO_EM_ANDAMENTO` e o `CONFLITO` da edição na suíte de saídas da 2.0
- [x] 8.5 — `docs/runbook.md` "Voltar o código depois da F4": a ordem, o que fica (jobs `pdf`, `processando`, `envio_de_material`), como limpar, e o que o `varrerParados` antigo faz com eles (R6); `docs/modelo-de-dados.md`
- [x] 8.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0056_*.sql`, `packages/core/src/db/schema/material.ts` | novo e alterado |
| `packages/core/src/material/extracao.repository.ts`, `apps/worker/src/processors/extrair-pdf.ts`, `packages/shared/src/material/material.ts`, `packages/core/src/auditoria/acoes.ts`, `apps/api/src/material/material.controller.ts`, `apps/api/src/material/material.service.ts`, `apps/api/src/material/material.repository.ts`, `docs/runbook.md`, `docs/modelo-de-dados.md` | alterado |
| `apps/api/test/material-edicao.int.test.ts`, `packages/core/src/db/volta-da-f4.int.test.ts`, `packages/core/src/db/test/schema-antes-da-f4.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| antes de a nova ficar pronta | I | a busca devolve a antiga | `material-edicao.int.test.ts` › "201 `processando` com o rótulo e a referência; a busca devolve a anterior antes, e só a nova depois…" |
| depois | I | só a nova | `material-edicao.int.test.ts` › o mesmo caso, depois de `esperarExtracao` |
| nova com falha | I | a antiga segue | `material-edicao.int.test.ts` › "a nova com falha na leitura: a anterior segue pronta, na busca e com os trechos…" |
| herança | I | disciplina, séries, titularidade e licença; nas mesmas séries; o `licenciante` é o da licença, lido no envio (é o "licenciante preenchido" que a volta do código pede) | `material-edicao.int.test.ts` › "a edição herda disciplina, séries, titularidade e licença do alvo…"; "o título do pedido vale no lugar do herdado"; "o pedido não escolhe o que é herdado…" |
| alvo `processando` | I | `EDICAO_EM_ANDAMENTO` | `material-edicao.int.test.ts` › "alvo `processando`: `EDICAO_EM_ANDAMENTO`…" |
| alvo excluído; substituído | I | `NAO_ENCONTRADO` (um caso cada) | `material-edicao.int.test.ts` › "alvo $caso: `NAO_ENCONTRADO`, igual ao inexistente…" (excluído, já substituído e que falhou) |
| licença vencida | I | `LICENCA_VENCIDA` antes de ler o arquivo | `material-edicao.int.test.ts` › "licença do alvo vencida: `LICENCA_VENCIDA` antes de ler o arquivo…"; "a licença que vence depois da conferência da entrada e antes do commit…" |
| arquivo igual ao da edição atual | I | `CONFLITO`, objeto e linha apagados | `material-edicao.int.test.ts` › "arquivo igual ao da edição atual: `CONFLITO`…"; `material-envio-orfao.int.test.ts` › "a edição com o arquivo do alvo, `CONFLITO` depois do `guardarBytes`…" e as duas da segunda edição (8.4) |
| isolamento | I | alvo da B `pronto`, `processando` e com licença vencida: `NAO_ENCONTRADO` igual ao inexistente, nenhum byte lido (um caso cada) | `material-edicao.int.test.ts` › "alvo da outra escola %s: `NAO_ENCONTRADO` igual ao inexistente, nenhum byte lido…" (três casos); "o repository, no contexto da escola A, não trava nem lê o alvo da B…" |
| [P] duas edições, a primeira presa antes do commit | P | a segunda: `EDICAO_EM_ANDAMENTO`. Mutação: tirar o índice parcial **e** a checagem sob a trava | `material-edicao.int.test.ts` › "[P] duas edições sobre o mesmo alvo, a primeira presa antes do commit…"; "[P] o índice parcial responde sozinho quando a checagem sob a trava deixa passar…"; "[P] o índice parcial, no banco…" |
| [P] edição C enquanto a substituição de B (sobre A) está presa | P | C espera o `for update` e recebe `NAO_ENCONTRADO`. Mutação: tirar o `for update` de `travarAlvoDaEdicao` (bloco em "Mutações"): sem a trava, C não espera; lê A ainda `pronto`, porque a atualização de B não foi confirmada, acha B `processando` sobre A e receberia `EDICAO_EM_ANDAMENTO` (409) no lugar de 404; o vermelho chega antes, em `esperarNaTrava(… '%for update%')`, que nunca acha C esperando | `material-edicao.int.test.ts` › "[P] edição C sobre A enquanto a substituição de B (também sobre A) está presa…" |
| [P] exclusão da nova parada entre `lerParaExtrair` e a transição | P | a antiga fica, a nova sem trechos. Mutação: tirar `excluido_em is null` da transição | `material-edicao.int.test.ts` › "[P] a nova excluída depois de lida e antes da transição…" |
| [P] exclusão da antiga antes do `update … substituido_por` | P | o `excluido_em` dela não muda, sem `material.substituido`. Mutação: tirar `excluido_em is null` do update | `material-edicao.int.test.ts` › "[P] o alvo excluído antes de a substituição o atualizar…" |
| [P] dois jobs da mesma edição | P | `material.substituido` uma vez. Mutação: a transição depois da substituição | `material-edicao.int.test.ts` › "[P] dois jobs da mesma edição…" |
| [P] edição parada depois do `guardarBytes`; mudar as séries de A por SQL | P | a edição nasce com as séries novas. Mutação: herdar do passo 1, as séries lidas por `enviarEdicao` antes de guardar o arquivo (bloco em "Mutações") | `material-edicao.int.test.ts` › "[P] a edição parada depois de guardar o arquivo, com as séries do alvo mudadas por SQL…" |
| volta do código | I | o bloco 1 do runbook fecha o `processando` como `falhou` com `extracao_falhou` e `processado_em`, e conclui os jobs `pdf`; depois dele, as linhas da F4 passam pelo `listaDeMateriaisResponseSchema` da cópia congelada (nenhum valor novo de `falha`, nada `processando`); o bloco 1 com outro código de `falha` é recusado pelo banco (R6: o próprio caso adultera o bloco); o bloco 2 conserta o que o código anterior gravou. O `licenciante` preenchido não é deste teste: está na linha "herança" | `volta-da-f4.int.test.ts` › "o bloco 1 fecha o que está `processando`…"; "depois do bloco 1, as linhas da F4 passam pela lista de materiais de antes da F4…"; "um `falha` novo no lugar de `extracao_falhou` no bloco 1 é recusado pelo banco…"; "o bloco 2, no roll-forward…" |
| permissão: professor | I | `POST /:id/edicoes` dá `NAO_ENCONTRADO` | `material-edicao.int.test.ts` › "o professor da disciplina não edita material: `NAO_ENCONTRADO`, nada lido" |
| permissão: aluno | I | `POST /:id/edicoes` dá `NAO_ENCONTRADO`, nada lido | `material-edicao.int.test.ts` › "o aluno não edita material: `NAO_ENCONTRADO`, nada lido" |
| edição `processando` excluída | I | a coordenação a exclui e manda outra: 201, e a que sobrou substitui o alvo (a excluída não tranca o lugar) | `material-edicao.int.test.ts` › "a edição `processando` que a coordenação exclui libera o lugar…" |
| material sem série | I | a edição é 201 e nasce sem série; com a licença vencida, `LICENCA_VENCIDA` e `material.recusado` com `serieIds` vazio | `material-edicao.int.test.ts` › "o material sem série (o de antes da F4 numa escola sem série)…" |
| isolamento no repository | I | no contexto da A, `edicaoEmAndamentoSobre`, `travarAlvoDaEdicao` e `substituirAnterior` não alcançam o alvo da B (que tem edição `processando`) | `material-edicao.int.test.ts` › "o repository, no contexto da escola A, não trava nem lê o alvo da B…"; "a substituição, no contexto da escola A, não alcança o alvo da B…" |
| escola sem ano letivo | I | a edição funciona | `material-edicao.int.test.ts` › "escola sem ano letivo em curso: a edição funciona" |
| auditoria | I | `material.edicao_enviada` e `.substituido` sem título nem arquivo | `material-edicao.int.test.ts` › "`material.edicao_enviada` e `material.substituido` guardam ids e o que foi herdado, sem título, rótulo nem arquivo" |

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

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| `material.substituido` é gravado pelo job de extração, que não tem pessoa no contexto: o autor é `rotina` (`autor_operador`), e o check `auditoria_rotina_so_nas_acoes` passa a aceitar a ação (migration 0056: `DROP`, `ADD ... NOT VALID`, `VALIDATE`, como a 0029) | A spec manda gravar `material.substituido` "na transação da extração" sem dizer quem é o autor. O `AuditoriaRecorder` exige usuário ou `autorOperador`, e o `rotina` já é o autor das outras quatro ações do worker | `techspec.md` §5 "Extração" e §11, linha 8.0 |
| `material.recusado` passa a aceitar de **zero** a sete séries (era de uma a sete) | A edição recusada por licença vencida grava as séries do alvo, e o alvo de uma escola sem série (o material de antes da F4 numa escola sem série) não tem nenhuma | `techspec.md` §3 e §11, linha 8.0; `cenarios.md` "Edição nova" |
| O alvo `falhou` responde `NAO_ENCONTRADO` | A spec diz `EDICAO_EM_ANDAMENTO` para o `processando` e `NAO_ENCONTRADO` para o excluído e o substituído, e cala sobre o `falhou`: material que não ficou pronto não tem edição (só o envio novo), e responder como o que não existe não confirma nada | `techspec.md` §5 "Envio e edição" (3) e §11, linha 8.0 |
| `material` ganha `edicao` e `substitui` no contrato de saída (`materialSchema`) | A tela da 12.0 precisa do rótulo e da ligação para mostrar a edição; as duas são nulas no material comum, e o contrato é estrito, então entram agora (as sete fixtures de web e e2e ganharam os dois campos) | `techspec.md` §4 e §11, linha 8.0 |
| O catálogo de `mvp-tables.int.test.ts` exclui `material.substituido_por` das colunas `_por` de pessoa, e lista `material.edicao` entre os textos livres | `substituido_por` é id de material (FK composta para `material`), e só o nome termina em `_por`; `edicao` é o rótulo de até 60 caracteres, preso por check, e não é sobre pessoa | `techspec.md` §11, linha 8.0 |
| O `docs/runbook.md` traz dois blocos de SQL lidos pelo teste (`volta-da-f4.int.test.ts`): o 1, que fecha os `processando` **com** `processado_em` antes de o código anterior subir, e o 2, do roll-forward | O `varrerParados` anterior fecha o `processando` sem gravar `processado_em`, e a varredura de objetos (`objetosQueSobraram`) só olha o material com `processado_em` ou excluído: sem o bloco 1, o PDF desse material ficaria no storage sem ninguém que o apagasse (R6) | `techspec.md` §3 "Migrations" e §11, linha 8.0 |

## Mutações

--faltando: 1 linha (37 blocos, 1 motivo)

Um bloco por cláusula do que a tarefa acrescenta, na ordem dos arquivos: o escopo e as cláusulas dos quatro métodos novos do repository (`alvoDaEdicao`, `travarAlvoDaEdicao`, `edicaoEmAndamentoSobre`, `seriesDoMaterial`), a ordem do `enviarEdicao` (o alvo que não existe, o `processando`, o que não está `pronto`, a licença do alvo, o arquivo), a transação (`for update` com a linha que sumiu, a checagem da edição em andamento, a licença lida `for share`, o título, o rótulo, o `licenciante` da licença, as séries herdadas), o mapa do `23505` para `EDICAO_EM_ANDAMENTO`, a extração (o `if` da edição, o `update` do antigo sem o `excluido_em is null`, os trechos dele) e a transição `marcarPronto` sem o `excluido_em is null`. As linhas de código do **envio** que a refatoração moveu (`#gravarEnvio`) são as da 2.0 e da 7.0, e os testes e as mutações delas seguem em `material.int.test.ts` e `material-envio-orfao.int.test.ts`.

A linha que o `--faltando` lista tem motivo: o `.where(` do `uniqueIndex('material_uma_edicao_em_andamento')` em `packages/core/src/db/schema/material.ts` é o espelho TypeScript do índice, que o drizzle-kit usa para gerar o snapshot: o índice que o banco tem vem do SQL da `0056_material_edicao.sql`, que o banco de teste já aplicou antes de qualquer teste rodar, e a mutação de um arquivo de schema não muda o banco. Quem prova o índice é o caso "[P] o índice parcial, no banco" (duas linhas `processando` sobre o mesmo alvo violam `material_uma_edicao_em_andamento`; uma excluída ou `falhou`, e outro alvo, não), e quem prova que o envio o respeita é o caso em que a checagem sob a trava deixa passar e a segunda edição cai nele.

Três mutações que a tabela de testes cita não são blocos, porque sozinhas não deixam nenhum teste vermelho (as proteções são duas, uma na frente da outra, e o teste prova o resultado das duas juntas): tirar **só** o índice parcial (a checagem sob a trava recusa antes; a prova é o `inserir` chamado uma vez só no caso das duas edições, e o bloco da linha 279 tira a checagem e deixa o índice), tirar **só** a checagem (o bloco que a tira fica vermelho por esse `inserir`, e o do `23505` prova o índice), e a "transição depois da substituição" dos dois jobs (o segundo job é barrado duas vezes: `marcarPronto` não acha mais a linha `processando`, e o `update` do antigo não acha mais a linha sem `excluido_em`; a mutação de `marcarPronto` que o teste dos dois jobs pegaria deixa o segundo job passar até o `update`, onde a segunda barreira o para, e por isso o caso dos dois jobs prova o resultado, e as duas cláusulas têm cada uma o bloco do caso que a distingue: `marcarPronto` no da nova excluída, e o `update` no do alvo excluído).

Três cláusulas não têm bloco porque não têm como morrer: o `eq(material.estado, 'pronto')` de `travarAlvoDaEdicao` (um material `pronto` nunca volta a `processando`: entre o `alvoDaEdicao` do passo 1, que já exige `pronto`, e o `for update` o estado não muda, e o que muda, a exclusão, tem a cláusula `excluido_em is null` e o seu bloco); o `arquivo.size === 0` de `enviarEdicao` (o buffer vazio já falha em `temAssinaturaDePdf`, que está na mesma condição, e o caso do arquivo vazio prova a recusa); e o `eq(trecho.escolaId, escolaId)` do `delete` dos trechos em `substituirAnterior` (o `delete` só roda depois do `update` com escopo de escola, que tem o seu bloco, e o `antigaId` já foi achado na escola do contexto: nenhuma linha de outra escola chega ali).

O bloco "herdar do passo 1" troca o `seriesDoMaterial` do `MaterialRepository` por uma função que devolve `seriesDoAlvo`, as séries lidas no passo 1, antes de guardar o arquivo. A troca vale só durante a chamada de `#gravarEdicao`, e o `finally` devolve a original. Passar `seriesDoAlvo` como argumento seria mais fiel, mas exige mudar a chamada em `enviarEdicao` e a leitura `const herdadas = …` em `#gravarEdicao`, e há uma linha em branco entre as duas. O bloco é um trecho contíguo e não atravessa linha em branco (`lerMutacoes` e `aplicarMutacao`, em `tools/processo/mutacoes.ts`). Como o repository nasce dentro de `#gravarEdicao`, a linha da chamada só o alcança pelo protótipo.

O bloco que tira o `.for('update')` de `travarAlvoDaEdicao` fica vermelho em `esperarNaTrava`, porque C não para na trava. Se o teste não esperasse, a resposta seria 409 `EDICAO_EM_ANDAMENTO` e não 404: C leria A ainda `pronto` e veria B `processando` sobre ele (`#gravarEdicao`, `material.service.ts:276-279`).

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/material-edicao.int.test.ts
       .select(colunasDoAlvo)
       .from(material)
-      .where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), isNull(material.excluidoEm)))
+      .where(and(eq(material.id, id), isNull(material.excluidoEm)))
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/material-edicao.int.test.ts
-      .where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), eq(material.estado, 'pronto'), isNull(material.excluidoEm)))
+      .where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), eq(material.estado, 'pronto')))
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/material-edicao.int.test.ts
-      .where(and(eq(material.escolaId, requireEscolaId()), eq(material.substituiId, alvoId), eq(material.estado, 'processando'), isNull(material.excluidoEm)))
+      .where(and(eq(material.escolaId, requireEscolaId()), eq(material.substituiId, alvoId), isNull(material.excluidoEm)))
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/material-edicao.int.test.ts
-      .where(and(eq(materialSerie.escolaId, requireEscolaId()), eq(materialSerie.materialId, materialId)))
+      .where(and(eq(materialSerie.materialId, materialId)))
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/material-edicao.int.test.ts › edição C sobre A enquanto a substituição de B
       .where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), eq(material.estado, 'pronto'), isNull(material.excluidoEm)))
-      .for('update')
+      .limit(1)
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/material-edicao.int.test.ts › alvo excluído
       .from(material)
-      .where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), isNull(material.excluidoEm)))
+      .where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id)))
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/material-edicao.int.test.ts › o repository, no contexto da escola A, não trava nem lê o alvo da B
-      .where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), eq(material.estado, 'pronto'), isNull(material.excluidoEm)))
+      .where(and(eq(material.id, id), eq(material.estado, 'pronto'), isNull(material.excluidoEm)))
       .for('update')
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/material-edicao.int.test.ts › a edição `processando` que a coordenação exclui libera o lugar
       .from(material)
-      .where(and(eq(material.escolaId, requireEscolaId()), eq(material.substituiId, alvoId), eq(material.estado, 'processando'), isNull(material.excluidoEm)))
+      .where(and(eq(material.escolaId, requireEscolaId()), eq(material.substituiId, alvoId), eq(material.estado, 'processando')))
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/material-edicao.int.test.ts › o repository, no contexto da escola A, não trava nem lê o alvo da B
       .from(material)
-      .where(and(eq(material.escolaId, requireEscolaId()), eq(material.substituiId, alvoId), eq(material.estado, 'processando'), isNull(material.excluidoEm)))
+      .where(and(eq(material.substituiId, alvoId), eq(material.estado, 'processando'), isNull(material.excluidoEm)))
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-edicao.int.test.ts
-    if (alvo === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+    if (alvo === null) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
     if (alvo.estado === 'processando') throw new DomainException(ErrorCode.EDICAO_EM_ANDAMENTO)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-edicao.int.test.ts
-    if (alvo.estado === 'processando') throw new DomainException(ErrorCode.EDICAO_EM_ANDAMENTO)
+    if (alvo.estado === 'processandox') throw new DomainException(ErrorCode.EDICAO_EM_ANDAMENTO)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-edicao.int.test.ts
-    if (alvo.estado !== 'pronto') throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+    if (false) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-edicao.int.test.ts
-    if (alvo.licencaId !== null) await this.#exigirLicencaVigente(declarado, alvo.disciplinaId, seriesDoAlvo, alvo.licencaId)
+    if (false) await this.#exigirLicencaVigente(declarado, alvo.disciplinaId, seriesDoAlvo, alvo.licencaId)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-edicao.int.test.ts
-    if (!ehArquivoRecebido(arquivo) || arquivo.size === 0 || !temAssinaturaDePdf(arquivo.buffer)) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
+    if (arquivo.size === 0 || !temAssinaturaDePdf(arquivo.buffer)) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
     const bytes = arquivo.buffer
     const sha256 = createHash('sha256').update(bytes).digest('hex')
     const gravado = await this.#gravarEnvio(
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-edicao.int.test.ts
-    if (!ehArquivoRecebido(arquivo) || arquivo.size === 0 || !temAssinaturaDePdf(arquivo.buffer)) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
+    if (!ehArquivoRecebido(arquivo) || arquivo.size === 0 ) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
     const bytes = arquivo.buffer
     const sha256 = createHash('sha256').update(bytes).digest('hex')
     const gravado = await this.#gravarEnvio(
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-edicao.int.test.ts
-    if (alvo === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+    if (alvo === null) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
     if (await materiais.edicaoEmAndamentoSobre(alvo.id)) throw new DomainException(ErrorCode.EDICAO_EM_ANDAMENTO)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-edicao.int.test.ts
-    if (await materiais.edicaoEmAndamentoSobre(alvo.id)) throw new DomainException(ErrorCode.EDICAO_EM_ANDAMENTO)
+    if (false) throw new DomainException(ErrorCode.EDICAO_EM_ANDAMENTO)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-edicao.int.test.ts
-    const vigente = await this.#licencaTravada(tx, alvo.licencaId ?? undefined)
+    const vigente = await this.#licencaTravada(tx, undefined)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-edicao.int.test.ts
-      titulo: pedido.titulo ?? alvo.titulo,
+      titulo: alvo.titulo,
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-edicao.int.test.ts
-      titulo: pedido.titulo ?? alvo.titulo,
+      titulo: pedido.titulo ?? 'Sem título',
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-edicao.int.test.ts
-      licenciante: vigente?.licenciante ?? alvo.licenciante,
+      licenciante: alvo.licenciante,
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-edicao.int.test.ts
-      edicao: pedido.edicao ?? null,
+      edicao: pedido.edicao ?? 'sem rótulo',
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-edicao.int.test.ts
-      edicao: pedido.edicao ?? null,
+      edicao: null,
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-edicao.int.test.ts
-    if (herdadas.length > 0) await materiais.gravarSeries(nova.id, herdadas)
+    if (false) await materiais.gravarSeries(nova.id, herdadas)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-edicao.int.test.ts
-    if (licencaId === undefined) return undefined
+    if (true) return undefined
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-envio-orfao.int.test.ts › a licença que some do banco depois da conferência da entrada
-    if (vigente === undefined || !licencaValeEm(this.#hoje(), vigente)) throw new LicencaDeixouDeValerNoEnvio()
+    if (!licencaValeEm(this.#hoje(), vigente)) throw new LicencaDeixouDeValerNoEnvio()
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-edicao.int.test.ts
-    if (vigente === undefined || !licencaValeEm(this.#hoje(), vigente)) throw new LicencaDeixouDeValerNoEnvio()
+    if (vigente === undefined) throw new LicencaDeixouDeValerNoEnvio()
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-edicao.int.test.ts
-        if (doBanco?.code === VIOLACAO_DE_UNICO && doBanco.constraint === INDICE_DA_EDICAO_EM_ANDAMENTO) throw new DomainException(ErrorCode.EDICAO_EM_ANDAMENTO)
+        if (false) throw new DomainException(ErrorCode.EDICAO_EM_ANDAMENTO)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-edicao.int.test.ts › o material sem série
-    if (herdadas.length > 0) await materiais.gravarSeries(nova.id, herdadas)
+    if (true) await materiais.gravarSeries(nova.id, herdadas)
     await registro.gravar(tx, 'material.edicao_enviada', {
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-edicao.int.test.ts › a edição parada depois de guardar o arquivo
falha: expect(resposta.corpo['serieIds']).toEqual([outraSerie])
-      (tx, id) => this.#gravarEdicao(tx, id, alvo.id, pedido, { sha256, tamanhoBytes: bytes.byteLength }),
+      (tx, id) => { const lida = MaterialRepository.prototype.seriesDoMaterial; MaterialRepository.prototype.seriesDoMaterial = async () => seriesDoAlvo; return this.#gravarEdicao(tx, id, alvo.id, pedido, { sha256, tamanhoBytes: bytes.byteLength }).finally(() => { MaterialRepository.prototype.seriesDoMaterial = lida }) },
       () => this.#registrarRecusa(declarado, alvo.disciplinaId, seriesDoAlvo, 'licenca_vencida'),
```

```mutacao
arquivo: apps/worker/src/processors/extrair-pdf.ts
teste: apps/api/test/material-edicao.int.test.ts
-  if (!(await new ExtracaoDoMaterialRepository(tx).substituirAnterior(novaId, antigaId))) return
+  await new ExtracaoDoMaterialRepository(tx).substituirAnterior(novaId, antigaId)
```

```mutacao
arquivo: apps/worker/src/processors/extrair-pdf.ts
teste: apps/api/test/material-edicao.int.test.ts
-        if (material.substituiId !== null) await substituirAAnterior(tx, materialId, material.substituiId)
+        if (false) await substituirAAnterior(tx, materialId, material.substituiId)
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/api/test/material-edicao.int.test.ts
-      .where(and(eq(material.escolaId, escolaId), eq(material.id, antigaId), isNull(material.excluidoEm)))
+      .where(and(eq(material.escolaId, escolaId), eq(material.id, antigaId)))
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/api/test/material-edicao.int.test.ts
-    if (substituidas.length === 0) return false
+    if (false) return false
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/api/test/material-edicao.int.test.ts
-    await this.banco.delete(trecho).where(and(eq(trecho.escolaId, escolaId), eq(trecho.materialId, antigaId)))
+    await this.banco.delete(trecho).where(and(eq(trecho.escolaId, escolaId)))
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/api/test/material-edicao.int.test.ts › a nova excluída depois de lida e antes da transição
 .set({ estado: 'pronto', paginas, processadoEm: sql`now()` })
-.where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), eq(material.estado, 'processando'), isNull(material.excluidoEm)))
+.where(and(eq(material.escolaId, requireEscolaId()), eq(material.id, id), eq(material.estado, 'processando')))
 .returning({ disciplinaId: material.disciplinaId })
```

```mutacao
arquivo: packages/core/src/material/extracao.repository.ts
teste: apps/api/test/material-edicao.int.test.ts › a substituição, no contexto da escola A, não alcança o alvo da B
       .set({ excluidoEm: sql`now()`, substituidoPor: novaId })
-      .where(and(eq(material.escolaId, escolaId), eq(material.id, antigaId), isNull(material.excluidoEm)))
+      .where(and(eq(material.id, antigaId), isNull(material.excluidoEm)))
       .returning({ id: material.id })
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| conformidade-reviewer (1ª) | Na tela, deixar claro que a troca pela edição nova acontece quando a leitura do PDF termina, e não no envio | tarefa 12.0, que faz o botão e a tela da edição; o próprio revisor diz que não é exigência desta tarefa |
| privacy-guardian (1ª) | Anotar em `troca-de-nome.ts`, na lista do que "fica de fora, de propósito", que `edicao` entra junto se `material.titulo` entrar na troca de nome | `TODO.md`: o arquivo não é da tarefa e nenhum comportamento muda hoje |
| privacy-guardian (1ª) | A 12.0 deve conferir que a tela não mostra o título do material substituído a quem não o alcança mais (`substitui` sai na leitura do professor) | tarefa 12.0 |
| infra-guardian (1ª) | Registrar quanto tempo o `VALIDATE` do check de `auditoria` leva com a auditoria de dez escolas, contra `MIGRAR_TIMEOUT_CONSULTA_MS`, ou separar o check numa migration própria | `TODO.md`: mesmo padrão da 0036, roda fora do horário letivo, e separar a migration muda o desenho da 0056 |
| infra-guardian (1ª) | Aba com o bundle antigo recusa a lista inteira por causa de `edicao` e `substitui` (`materialSchema` é `strictObject`) | retro da funcionalidade; é decisão de contrato do cliente, não desta tarefa |
| infra-guardian (1ª) | Métrica própria de latência e erro de `POST /v1/materiais/:id/edicoes` | `TODO.md`, junto com a do envio da 7.0, se o painel de operação passar a acompanhar a ingestão |
| revisor-geral (1ª) | `material.edicao_enviada` não registra `licencaId` nem `serieIds`, e a 7.0 deixou isso para a 8.0 | `TODO.md`: mudaria o contrato da auditoria (`acoes.ts`), e o `privacy-guardian` da 8.0 aprovou o conteúdo atual sem exigir |
| tenancy-guardian (2ª) | No teste da substituição na escola A, confirmar que a A tem material próprio, para o `false` não vir de escola vazia | Recusada: o revisor diz que é cobertura extra e que "a mutação já deixa o teste vermelho"; o bloco da cláusula `escolaId` de `substituirAnterior` prova isso hoje |
| test-engineer (3ª) | No texto de "Mutações", `material.service.ts:276-279` é número de linha: citar só a 279 ou o nome `edicaoEmAndamentoSobre` | Recusada: referência de linha em texto de documento de tarefa que fecha neste commit; nenhum teste nem regra depende dela |
| revisor-geral (3ª) | A mesma referência `material.service.ts:276-279`: apontar pelo nome | Recusada, pelo mesmo motivo (dois revisores, um achado) |
| revisor-geral (3ª) | O bloco "herdar do passo 1" troca o protótipo do repository: se o service passar a receber o repository por injeção, trocar pela versão por argumento | Retro da funcionalidade: hoje o repository nasce dentro de `#gravarEdicao`, e o texto de "Mutações" já explica o porquê |
| test-engineer (1ª) | Expurgo da edição substituída: o `on delete set null` da 0056 não tem teste de que o expurgo não trava na FK nova | tarefa 10.0: é o cenário "Expurgo" do `cenarios.md`, "Edição nova" |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-13 14:26:38 | 2026-11-13 14:27:38 | `tenancy-guardian` | 1 | APROVADO | ad9cf0d7cfe725711 |
| 2026-11-13 14:27:00 | 2026-11-13 14:27:48 | `conformidade-reviewer` | 1 | APROVADO | ab5a94f788dabc2fd |
| 2026-11-13 14:26:43 | 2026-11-13 14:27:50 | `privacy-guardian` | 1 | APROVADO | a33f72356a52b80d9 |
| 2026-11-13 14:26:48 | 2026-11-13 14:28:48 | `infra-guardian` | 1 | APROVADO | af56c62ae013d9fbe |
| 2026-11-13 14:26:55 | 2026-11-13 14:29:12 | `revisor-geral` | 1 | APROVADO | ad60c9d9823dade2f |
| 2026-11-13 14:26:53 | 2026-11-13 14:30:14 | `test-engineer` | 1 | REPROVADO | a65500f771ec9316e |
| 2026-11-13 15:03:33 | 2026-11-13 15:03:57 | `tenancy-guardian` | 2 | APROVADO | a039634582231eb45 |
| 2026-11-13 15:03:42 | 2026-11-13 15:04:03 | `privacy-guardian` | 2 | APROVADO | ae725bb61b8b7e297 |
| 2026-11-13 15:03:48 | 2026-11-13 15:04:09 | `infra-guardian` | 2 | APROVADO | aea0b3b4cfb586ba0 |
| 2026-11-13 15:04:07 | 2026-11-13 15:04:23 | `conformidade-reviewer` | 2 | APROVADO | aa4c2d14ce0f7b5b1 |
| 2026-11-13 15:03:58 | 2026-11-13 15:04:44 | `revisor-geral` | 2 | APROVADO | ae0d9f8dd59440c68 |
| 2026-11-13 15:03:24 | 2026-11-13 15:06:01 | `test-engineer` | 2 | REPROVADO | a624cc26259176627 |
| 2026-11-13 15:44:34 | 2026-11-13 15:45:04 | `test-engineer` | 3 | APROVADO | a409dbda0d40c8df3 |
| 2026-11-13 15:44:40 | 2026-11-13 15:45:05 | `revisor-geral` | 3 | APROVADO | ad39eef2c63f93bbb |
