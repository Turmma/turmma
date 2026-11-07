# Tarefa 3.0 — Os itens do dia entram na semana (RF7)

**Funcionalidade:** semana-do-professor · **Depende de:** 2.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `test-engineer`
**Porte:** grande

## Objetivo

Cada dia do `GET /v1/semana` traz, para cada (turma, disciplina) dos vínculos confirmados da professora, a atividade
aplicada, a encerrada e a correção do Assistente com o estado de hoje, sem nota, acerto nem nome de aluno.

## Contexto necessário

- `techspec.md` seção 5 ("Ler", passo 5), 7, 7b e 7c (o `EXPLAIN`); `cenarios.md` S9, S10, R2 e a linha do `EXPLAIN`
- `prd.md` RF7 e o caso de borda "Feriado no dia da prova"
- `.claude/rules/70`, itens 7 a 9
- `packages/core/src/db/schema/atividade-aplicada.ts:63` (`atividade_aplicada_turma_idx`) e `entrega.ts:89` (`entrega_turma_idx`)
- O contrato `itens[]` e os rótulos já estão em `packages/shared/src/semana/` (2.0): esta tarefa não toca `packages/shared`

## Subtarefas

- [x] 3.1 — A consulta dos itens no `SemanaRepository`: `atividade_aplicada` cujo `artefato` tem (turma, disciplina) de um vínculo, aplicada ou encerrada na semana, e a `entrega` `lote_de_correcao` dela criada na semana, com o estado de hoje; escopo do contexto
- [x] 3.2 — A montagem põe cada item no dia, no `FUSO_DO_USO`, mesmo em feriado
- [x] 3.3 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/semana/semana.repository.ts` | alterado |
| `apps/api/src/semana/semana.service.ts`, `apps/api/src/semana/montar-dias.ts`, `apps/api/src/semana/montar-dias.test.ts` | alterado |
| `apps/api/test/semana-itens.int.test.ts` | novo |
| `packages/core/src/semana/index.ts`, `packages/core/src/index.ts` | alterado (a exportação de `ItemDaSemana`) |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| S9: aplicada na quarta aparece na quarta da turma e disciplina | integração | RF7 | `apps/api/test/semana-itens.int.test.ts` › S9: a atividade aplicada na quarta aparece |
| S9: a do colega de outra disciplina na mesma turma não aparece | integração | disciplina | `apps/api/test/semana-itens.int.test.ts` › S9: a atividade de Química do 2ºB não aparece para a professora de Física (a deFisica, com os três itens: aplicada, encerrada e correção) |
| S9: a professora com as duas disciplinas confirmadas na turma vê as duas atividades, uma vez cada | integração | `exists` e não `join` | `apps/api/test/semana-itens.int.test.ts` › S9: a professora com Química e Física confirmadas no 2ºB vê as duas atividades |
| S9: a correção nos três estados | integração | estado | `apps/api/test/semana-itens.int.test.ts` › S9: a correção aparece nos três estados |
| S9: o item não traz nota, acerto, nome de aluno nem autor (chaves exatas) | integração | DTO | `apps/api/test/semana-itens.int.test.ts` › S9: o item traz só as chaves do contrato (as chaves de cada tipo e o texto dos itens) |
| S10: feriado no dia da prova, a aula sai e o item fica | integração | borda | `apps/api/test/semana-itens.int.test.ts` › S10: o feriado no dia da prova (a quinta, sem feriado, mantém aula e item) |
| aplicada no domingo às 22h de Brasília fica no domingo | integração | fuso | `apps/api/test/semana-itens.int.test.ts` › a atividade aplicada no domingo às 22h de Brasília |
| aplicada fora da semana não aparece | integração | período | `apps/api/test/semana-itens.int.test.ts` › a atividade aplicada fora da semana não aparece (domingo 23h59 anterior e segunda 0h seguinte fora; segunda 0h e domingo 23h59 dentro) |
| `lote_de_correcao` criado fora da semana não aparece | integração | período | `apps/api/test/semana-itens.int.test.ts` › o lote de correção criado fora da semana não aparece |
| entrega de outro tipo na mesma turma não aparece | integração | tipo | `apps/api/test/semana-itens.int.test.ts` › a entrega de outro tipo (a versão adaptada) na mesma turma |
| aplicada numa semana e encerrada noutra: um item em cada | integração | os dois tipos | `apps/api/test/semana-itens.int.test.ts` › a atividade aplicada numa semana e encerrada noutra |
| correção aprovada depois da semana mostra `aprovada` | integração | estado de hoje | `apps/api/test/semana-itens.int.test.ts` › a correção aprovada depois da semana mostra o estado de hoje |
| turma e disciplina de vínculo `pendente` não trazem itens | integração | só confirmado | `apps/api/test/semana-itens.int.test.ts` › S9: a atividade de Química do 2ºB não aparece para a professora de Física (a `comPendente`: Física confirmada e Química pendente na mesma turma) |
| `estado` só no tipo `correcao` | unidade | contrato | `apps/api/src/semana/montar-dias.test.ts` › o `estado` só vai na correção |
| `titulo` e rótulos sem palavra de `VOCABULARIO_DE_NOTA` | integração | regra 70 | `apps/api/test/semana-itens.int.test.ts` › S9: o item traz só as chaves do contrato (a expressão copiada, sobre o rótulo de cada tipo, que é quem prova a regra 70; o título é o que o teste escolheu e só entra como conferência) |
| R2, itens: professora nas duas escolas, atividade aplicada em B, nada com o token de A | integração | isolamento | `apps/api/test/semana-itens.int.test.ts` › R2: a professora nas duas escolas (pela rota, e pelo repository com o contexto da A e os ids da B) |
| `EXPLAIN` usa `atividade_aplicada_turma_idx` e `entrega_turma_idx` | integração | regra 80, item 8 | `apps/api/test/semana-itens.int.test.ts` › o `EXPLAIN` das três consultas (o índice da atividade aplicada é o `atividade_aplicada_escola_ano_turma_id_unico`: ver a divergência 1) |

## Como testar

- Atividade aplicada, encerrada e lote: `apps/api/test/atividade.fixture.ts` (`criarAtividade`, `aplicarAtividade`, `encerrarAtividade`, `aprovarOLote`)
- `EXPLAIN`: o padrão de `apps/api/test/arquivo-do-titular.int.test.ts:1373` (`explain (format json)`), procurando o nome do índice no plano
- Isolamento: todo id da B, lido no contexto da A (retro da F2, grupo E)
- Relógio às 22h: o mesmo relógio injetável da 2.0
- `VOCABULARIO_DE_NOTA` está em `e2e/support/professor/scenario.ts:17`: copie a expressão no teste de integração, sem importar do e2e
- Comando: `npx vitest run --project integracao apps/api/test/semana-itens.int.test.ts`

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3: a mesma turma com duas disciplinas, e a professora com vínculo pendente noutra.

## Fora do escopo desta tarefa

A tela dos itens (8.0); o `PUT` (4.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| A turma do item é a da **aplicação** (`atividade_aplicada.turma_id`) e a disciplina, a do **artefato**, e as duas têm de ser as de um mesmo vínculo `confirmado` de professor da sessão (um `exists`, e não uma lista de turmas) | a Tech Spec dizia "o `artefato` tem (turma, disciplina) de um vínculo", mas o artefato não tem turma: a turma é da aplicação, como em `AtividadeAplicadaRepository`; e a professora que dá duas disciplinas na turma não pode ver a atividade da colega | `techspec.md` §5, "Ler", passo 5; `cenarios.md` S9 |
| O dia de cada item é o do instante em `FUSO_DO_USO` (a aplicada às 22h de domingo em Brasília é de domingo); o item cai no dia dele também em `feriado` e `recesso`, e o dia que a semana não traz não mostra item; a ordem no dia é aplicada, encerrada e correção, depois o título e, no empate, a atividade | a Tech Spec não dizia o fuso do corte, nem a ordem, e o caso de borda "feriado no dia da prova" pede que o item fique | `techspec.md` §5, "Ler", fim do passo 5; `cenarios.md` S9 e S10 |
| O `EXPLAIN` da atividade aplicada desce pelo `atividade_aplicada_escola_ano_turma_id_unico`, e não pelo `atividade_aplicada_turma_idx` | os dois começam pela escola e pela turma, e o planejador prefere o único; o que a regra 80, item 8, pede é um índice que comece pelo escopo, e os dois cumprem. O teste desliga o `seqscan` e o `bitmapscan` (como `arquivo-do-titular.int.test.ts`): ele prova que há um caminho pelo índice com a escola e a turma, e não que o planejador o escolhe com a configuração padrão e as estatísticas reais | `techspec.md` §7c, linha "Carga na manhã de segunda"; `cenarios.md`, linha do `EXPLAIN` |
| `ItemDaSemana` (o item com o `data`, que só serve para achar o dia) é exportado por `packages/core/src/semana/index.ts` e `packages/core/src/index.ts` | a montagem, em `apps/api`, tipa a entrada com ele; o repository só pode ser importado pelo pacote | `techspec.md` §2, linha de `packages/core/src/semana/` |

## Mutações

--faltando: 0 linhas (22 blocos, 2 motivos: o vínculo por escola e ano, e o tipo da entrega)

**Sem bloco, com o motivo.** O `eq(vinculo.escolaId, linha.escolaId)` e o `eq(vinculo.anoLetivoId, linha.anoLetivoId)` de `#daProfessora` repetem o que a
turma já diz (a turma é de uma escola e de um ano, e o vínculo só alcança a turma pelo `turmaId`): tirados, o
`semana-itens.int.test.ts` fica verde, e nenhum dado separa as duas respostas. A escola e o ano da **linha** têm bloco, no `where` de quem chama. O `eq(entrega.tipo, 'lote_de_correcao')` também fica sem bloco: o `check` `entrega_alvo_do_tipo`
(`entrega.ts`) obriga a `versao_adaptada` a ter `atividade_aplicada_id` nulo, e o `inner join` com `atividade_aplicada` já a deixa de fora; tirada a cláusula,
o caso da versão adaptada continua verde (mutação rodada), porque nenhum dado válido a separa do lote. O caso fica como prova de que ela não aparece.

O dia do item vem do fuso da escola: sem o `at time zone`, a atividade das 22h de domingo em Brasília cai na segunda.

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana-itens.int.test.ts › a atividade aplicada no domingo às 22h de Brasília
-const diaNoFuso = (instante: AnyColumn): SQL<string> => sql<string>`to_char(${instante} at time zone ${sql.raw(`'${FUSO_DO_USO}'`)}, 'YYYY-MM-DD')`
+const diaNoFuso = (instante: AnyColumn): SQL<string> => sql<string>`to_char(${instante}, 'YYYY-MM-DD')`
```

A semana começa na segunda: o domingo 23h59 anterior fica de fora.

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana-itens.int.test.ts › a atividade aplicada fora da semana não aparece
-and(gte(diaNoFuso(instante), segunda), lte(diaNoFuso(instante), domingo))
+and(lte(diaNoFuso(instante), domingo))
```

E termina no domingo: a segunda 0h seguinte fica de fora.

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana-itens.int.test.ts › a atividade aplicada fora da semana não aparece
-and(gte(diaNoFuso(instante), segunda), lte(diaNoFuso(instante), domingo))
+and(gte(diaNoFuso(instante), segunda))
```

O vínculo da professora na turma da linha: sem a turma, a colega de Química do 2ºC vê a atividade do 2ºB.

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana-itens.int.test.ts › S9: a atividade de Química do 2ºB não aparece para a professora de Física
falha: for (const sessao of [a.deFisica, a.colega, comPendente, comPapelDeAluno])
        .where(
          and(
            eq(vinculo.escolaId, linha.escolaId),
            eq(vinculo.anoLetivoId, linha.anoLetivoId),
-           eq(vinculo.turmaId, linha.turmaId),
            eq(vinculo.disciplinaId, disciplinaId),
```

E na disciplina: sem ela, a professora de Física do 2ºB vê a Química da colega.

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana-itens.int.test.ts › S9: a atividade de Química do 2ºB não aparece para a professora de Física
falha: for (const sessao of [a.deFisica, a.colega, comPendente, comPapelDeAluno])
            eq(vinculo.turmaId, linha.turmaId),
-           eq(vinculo.disciplinaId, disciplinaId),
            eq(vinculo.usuarioId, requestSessao().usuarioId),
```

E na pessoa: o vínculo é o da sessão, e não o de qualquer professor da turma.

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana-itens.int.test.ts › S9: a atividade de Química do 2ºB não aparece para a professora de Física
falha: for (const sessao of [a.deFisica, a.colega, comPendente, comPapelDeAluno])
            eq(vinculo.disciplinaId, disciplinaId),
-           eq(vinculo.usuarioId, requestSessao().usuarioId),
            eq(vinculo.papel, 'professor'),
```

E no papel: o vínculo de aluno em Química no mesmo usuário não dá a atividade.

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana-itens.int.test.ts › S9: a atividade de Química do 2ºB não aparece para a professora de Física
falha: for (const sessao of [a.deFisica, a.colega, comPendente, comPapelDeAluno])
            eq(vinculo.disciplinaId, disciplinaId),
            eq(vinculo.usuarioId, requestSessao().usuarioId),
-           eq(vinculo.papel, 'professor'),
            eq(vinculo.estado, 'confirmado'),
```

E no estado: o vínculo `pendente` em Química não dá a atividade.

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana-itens.int.test.ts › S9: a atividade de Química do 2ºB não aparece para a professora de Física
falha: for (const sessao of [a.deFisica, a.colega, comPendente, comPapelDeAluno])
            eq(vinculo.disciplinaId, disciplinaId),
            eq(vinculo.usuarioId, requestSessao().usuarioId),
            eq(vinculo.papel, 'professor'),
-           eq(vinculo.estado, 'confirmado'),
          ),
```

A escola do contexto, na atividade aplicada: o contexto da A com a professora e o ano da B.

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana-itens.int.test.ts › R2: a professora nas duas escolas
        .where(
          and(
-           eq(atividadeAplicada.escolaId, escolaId),
            eq(atividadeAplicada.anoLetivoId, anoLetivoId),
            naSemana(instante, segunda, domingo),
```

O ano do contexto, na atividade aplicada.

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana-itens.int.test.ts › R2: a professora nas duas escolas
            eq(atividadeAplicada.escolaId, escolaId),
-           eq(atividadeAplicada.anoLetivoId, anoLetivoId),
            naSemana(instante, segunda, domingo),
```

A escola do contexto, na entrega.

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana-itens.int.test.ts › R2: a professora nas duas escolas
      .where(
        and(
-         eq(entrega.escolaId, escolaId),
          eq(entrega.anoLetivoId, anoLetivoId),
          eq(entrega.tipo, 'lote_de_correcao'),
```

O ano do contexto, na entrega.

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana-itens.int.test.ts › R2: a professora nas duas escolas
          eq(entrega.escolaId, escolaId),
-         eq(entrega.anoLetivoId, anoLetivoId),
          eq(entrega.tipo, 'lote_de_correcao'),
```

O período da correção é o da criação do lote.

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana-itens.int.test.ts › o lote de correção criado fora da semana não aparece
          eq(entrega.tipo, 'lote_de_correcao'),
-         naSemana(entrega.criadaEm, segunda, domingo),
          this.#daProfessora(entrega, artefato.disciplinaId),
```

O service entrega os itens à montagem.

```mutacao
arquivo: apps/api/src/semana/semana.service.ts
teste: apps/api/test/semana-itens.int.test.ts › S9: a atividade aplicada na quarta aparece
-    const dias = montarDias({ segunda: consulta.segunda, ano, hoje, vinculos, alocacoes, eventos, registros, itens })
+    const dias = montarDias({ segunda: consulta.segunda, ano, hoje, vinculos, alocacoes, eventos, registros, itens: [] })
```

Cada item cai no dia dele.

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/src/semana/montar-dias.test.ts › cada item cai no dia dele
-dias.push({ data, eventos: eventos.map(({ tipo, descricao }) => ({ tipo, descricao })), aulas: semAula ? [] : candidatas.sort(naOrdemDoDia).map(comoAula), itens: entrada.itens.filter((item) => item.data === data).sort(naOrdemDosItens).map(comoItem) })
+dias.push({ data, eventos: eventos.map(({ tipo, descricao }) => ({ tipo, descricao })), aulas: semAula ? [] : candidatas.sort(naOrdemDoDia).map(comoAula), itens: entrada.itens.sort(naOrdemDosItens).map(comoItem) })
```

O item do dia de feriado fica, e a aula sai: a mutação tira o item do dia sem aula.

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/src/semana/montar-dias.test.ts › S10: o dia de feriado e o de recesso perdem a aula e mantêm o item
-dias.push({ data, eventos: eventos.map(({ tipo, descricao }) => ({ tipo, descricao })), aulas: semAula ? [] : candidatas.sort(naOrdemDoDia).map(comoAula), itens: entrada.itens.filter((item) => item.data === data).sort(naOrdemDosItens).map(comoItem) })
+dias.push({ data, eventos: eventos.map(({ tipo, descricao }) => ({ tipo, descricao })), aulas: semAula ? [] : candidatas.sort(naOrdemDoDia).map(comoAula), itens: semAula ? [] : entrada.itens.filter((item) => item.data === data).sort(naOrdemDosItens).map(comoItem) })
```

A aula do dia de feriado continua saindo.

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/src/semana/montar-dias.test.ts › S10: o dia de feriado e o de recesso perdem a aula e mantêm o item
-dias.push({ data, eventos: eventos.map(({ tipo, descricao }) => ({ tipo, descricao })), aulas: semAula ? [] : candidatas.sort(naOrdemDoDia).map(comoAula), itens: entrada.itens.filter((item) => item.data === data).sort(naOrdemDosItens).map(comoItem) })
+dias.push({ data, eventos: eventos.map(({ tipo, descricao }) => ({ tipo, descricao })), aulas: candidatas.sort(naOrdemDoDia).map(comoAula), itens: entrada.itens.filter((item) => item.data === data).sort(naOrdemDosItens).map(comoItem) })
```

A ordem do dia: o tipo sai da comparação.

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/src/semana/montar-dias.test.ts › a ordem do dia é aplicada
-  ORDEM_DOS_ITENS[a.tipo] - ORDEM_DOS_ITENS[b.tipo] || a.titulo.localeCompare(b.titulo) || a.atividadeAplicadaId.localeCompare(b.atividadeAplicadaId)
+  a.titulo.localeCompare(b.titulo) || a.atividadeAplicadaId.localeCompare(b.atividadeAplicadaId)
```

A ordem do dia: o título sai da comparação.

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/src/semana/montar-dias.test.ts › a ordem do dia é aplicada
-  ORDEM_DOS_ITENS[a.tipo] - ORDEM_DOS_ITENS[b.tipo] || a.titulo.localeCompare(b.titulo) || a.atividadeAplicadaId.localeCompare(b.atividadeAplicadaId)
+  ORDEM_DOS_ITENS[a.tipo] - ORDEM_DOS_ITENS[b.tipo] || a.atividadeAplicadaId.localeCompare(b.atividadeAplicadaId)
```

A ordem do dia: a atividade desempata.

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/src/semana/montar-dias.test.ts › a ordem do dia é aplicada
-  ORDEM_DOS_ITENS[a.tipo] - ORDEM_DOS_ITENS[b.tipo] || a.titulo.localeCompare(b.titulo) || a.atividadeAplicadaId.localeCompare(b.atividadeAplicadaId)
+  ORDEM_DOS_ITENS[a.tipo] - ORDEM_DOS_ITENS[b.tipo] || a.titulo.localeCompare(b.titulo)
```

O `estado` só vai na correção.

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/src/semana/montar-dias.test.ts › o `estado` só vai na correção
-  tipo === 'correcao' && estado !== undefined ? { tipo, turmaId, disciplinaId, atividadeAplicadaId, titulo, estado } : { tipo, turmaId, disciplinaId, atividadeAplicadaId, titulo }
+  estado !== undefined ? { tipo, turmaId, disciplinaId, atividadeAplicadaId, titulo, estado } : { tipo, turmaId, disciplinaId, atividadeAplicadaId, titulo }
```

E a correção sem estado não ganha a chave `estado: undefined`.

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/src/semana/montar-dias.test.ts › o `estado` só vai na correção
-  tipo === 'correcao' && estado !== undefined ? { tipo, turmaId, disciplinaId, atividadeAplicadaId, titulo, estado } : { tipo, turmaId, disciplinaId, atividadeAplicadaId, titulo }
+  tipo === 'correcao' ? { tipo, turmaId, disciplinaId, atividadeAplicadaId, titulo, estado } : { tipo, turmaId, disciplinaId, atividadeAplicadaId, titulo }
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (2ª) | A linha nova da tabela de testes do `3_task.md` (linha 41) justifica o caso por "`exists` e não `join`", mas o caso não separa as duas formas: um `join` pela turma e pela disciplina também devolveria cada atividade uma vez. Trocar a coluna para "duas disciplinas, uma vez cada", ou registrar na retro | Retro: a diferença entre `exists` e `join` não tem dado que a mostre; o caso prova o lado positivo (a condição da disciplina não derruba a segunda disciplina legítima, e não há duplicata) |
| revisor-geral (2ª) | `semana.repository.ts`: a primeira linha do JSDoc de `consultasDosItens` ficou bem mais longa que as outras do bloco; quebrar no comprimento das vizinhas | `TODO.md`, para a próxima tarefa que tocar `semana.repository.ts` (cosmético: mexer agora caduca o `revisor-geral` e as seis aprovações valem para a árvore de hoje) |
| tenancy-guardian (1ª) | `#daProfessora`: as cláusulas `vinculo.escolaId` e `vinculo.anoLetivoId` comparam com a linha, e não com o contexto | Tentado e desfeito nesta ordem (item 1): comparar com o contexto torna as cláusulas de escola e de ano do `where` de quem chama redundantes com as de dentro, e as quatro mutações delas (R2) deixam de ficar vermelhas, porque cada par se cobre. Com a linha, a comparação de dentro é a redundante (motivo em "Mutações") e a de fora tem o seu bloco |
| tenancy-guardian (1ª) | `itensDaSemana` e `consultasDosItens` recebem o `anoLetivoId` por argumento; ler o ano de `currentContext()` ou recusar ano diferente do contexto | `TODO.md`: muda a assinatura dos métodos da 2.0 e da 3.0 e do `semana.service.ts`, e a origem do ano hoje é segura (`anoEmCurso()` lê o contexto) e o R2 prova que ano trocado volta vazio |
| test-engineer (1ª) | Lote rejeitado e lote novo da mesma atividade na mesma semana saem como duas correções de mesmo título e mesmo `atividadeAplicadaId` | Tarefa 8.0 (a tela dos itens): o que a professora vê quando há duas correções é decisão de produto da tela; o caso entra lá, com o esperado definido |
| infra-guardian (1ª) | `naSemana`/`diaNoFuso` aplica `to_char(... at time zone ...)` em cada linha; filtrar por instante e deixar o `to_char` só no `select` | `TODO.md`: reescreve o filtro e os blocos de "Mutações" de período e fuso, sem ganho hoje (centenas de linhas por turma no ano) |
| revisor-geral (1ª) | `sql.raw` no fuso (`semana.repository.ts:67`): passar `FUSO_DO_USO` como parâmetro | `TODO.md`, junto com o item anterior: mexe na mesma linha, `diaNoFuso`, e hoje o `raw` só recebe a constante `FUSO_DO_USO` |
| infra-guardian (1ª) | O cenário de carga `rajada` não inclui a abertura da Semana às 7h30 | Tarefa 8.0: a tela traz a leitura inteira à carga |
| privacy-guardian (1ª) | O comentário de `aula` em `packages/shared/src/permissao/matriz.ts:109-113` diz alcance `proprio`; anotar que os itens seguem `turma_vinculada` | `TODO.md`, para a próxima tarefa que tocar `matriz.ts`: esta tarefa não toca `packages/shared` (seção "Contexto necessário") |
| privacy-guardian (1ª) | O título do item é texto livre da professora (até 160 caracteres) e pode trazer nome de aluno | Retro: a regra de "título sem dado de aluno" é do conteúdo da ferramenta, não desta leitura |
| conformidade-reviewer (1ª) | O item "Correção do Assistente · Para revisar" deve levar à tela de revisão do lote (D33, D56), sem botão de aprovar na Semana | Tarefa 8.0 (a tela) |
| conformidade-reviewer (1ª) | Na revisão com fotos da 8.0: selo de IA no item de correção e nenhum total de correções pendentes que funcione como meta (D64) | Tarefa 8.0 (a tela) |
| conformidade-reviewer (1ª) | Se entrar na Semana uma `entrega` de outra função (devolutiva formativa de discursiva, D46), o `eq(entrega.tipo, 'lote_de_correcao')` vira a única barreira e precisa de teste próprio | `TODO.md`: vale quando outra função de entrega entrar na Semana; hoje o `check` `entrega_funcao_do_tipo` e o `inner join` já a deixam de fora |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-06 20:42:12 | 2026-11-06 20:42:44 | `tenancy-guardian` | 1 | APROVADO | af6414713fc7a6234 |
| 2026-11-06 20:42:15 | 2026-11-06 20:42:53 | `conformidade-reviewer` | 1 | APROVADO | acd596724c3fc73a4 |
| 2026-11-06 20:42:13 | 2026-11-06 20:43:09 | `privacy-guardian` | 1 | APROVADO | a1b7ae4e915739d35 |
| 2026-11-06 20:42:19 | 2026-11-06 20:43:10 | `infra-guardian` | 1 | APROVADO | ada87d0c071c11cec |
| 2026-11-06 20:42:18 | 2026-11-06 20:43:11 | `revisor-geral` | 1 | APROVADO | a6790263ec0205f46 |
| 2026-11-06 20:42:16 | 2026-11-06 20:44:26 | `test-engineer` | 1 | APROVADO | a7f272adb9d461392 |
| 2026-11-06 21:18:52 | 2026-11-06 21:19:24 | `revisor-geral` | 2 | APROVADO | a9115bd7626cd0228 |
| 2026-11-06 21:18:45 | 2026-11-06 21:19:27 | `test-engineer` | 2 | APROVADO | a6f1e1bbb51d64302 |
