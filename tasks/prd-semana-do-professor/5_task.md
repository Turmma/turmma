# Tarefa 5.0 — O texto acompanha a reimportação da grade e do calendário

**Funcionalidade:** semana-do-professor · **Depende de:** 4.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `test-engineer`
**Porte:** grande

## Objetivo

Reimportar a grade mantém o texto da aula que continua, leva o texto da que só mudou de horário, apaga o futuro da que saiu
e deixa o passado fora da grade; reimportar o calendário não apaga texto.

## Contexto necessário

- `techspec.md` seção 5 ("Reimportar"), 6 e 7c (a ordem global, corridas 2 e 3); `cenarios.md` "Reimportação da grade" (J1 a J16)
- `prd.md` RF13, RF14
- `packages/core/src/importacao/tipos/grade.ts:512-514`: o passo entra entre `gravarAulas` e `encerrarOsMarcados`
- `packages/core/src/importacao/importacao.repository.ts:236`: o `lock_timeout` de 1 s e o `statement_timeout` de 1,5 s do passo (3)
- `packages/core/src/importacao/motor.ts:41`: o motor repete em `40P01`, `55P03` e `40001`
- `packages/core/src/semana/aula.repository.ts` (4.0): a classe da trava; importe pelo caminho, sem mexer no barril

## Subtarefas

- [x] 5.1 — No passo: a escola do `requireEscolaId()` do job e o ano de destino; a trava consultiva dos vínculos que já existiam e têm aula que sai ou entra, num comando só, na ordem de `hashtext(escolaId‖vinculoId)`; só então a leitura da `aula`
- [x] 5.2 — O pareamento por (vínculo, dia) na ordem de início; o par re-chaveia início e fim em todas as datas, menos onde um fora da grade já ocupa o início novo; a que sai sem par apaga os registros de data ≥ hoje (Brasília)
- [x] 5.3 — Prévia, resumo, assinatura e auditoria do F2 sem mudança
- [x] 5.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/importacao/tipos/grade.ts` | alterado |
| `packages/core/src/semana/texto-acompanha-a-grade.repository.ts` | novo |
| `apps/api/test/semana-reimportacao.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| J1 | integração | a que continua mantém | `J1: a aula que continua mantém o texto…` |
| J2, com o `fim` novo nos re-chaveados | integração | só o horário mudou | `J2: a que muda só o horário…` (o fim novo, a aula que fica no dia, o colega e o PUT no horário novo) |
| J3 | integração | a que sai sem par | `J3: a que sai sem par apaga os registros de hoje em diante…`; `a aula que continua com o fim mudado, ao lado de uma que sai no mesmo dia…` |
| J4 | integração | colisão sem apagar passado | `J4: um registro fora da grade já ocupa o início novo…` (com o registro da colega no início novo) |
| J5 | integração | aula dupla | `J5: aula dupla…` (a grade nasce com a segunda aula primeiro e as linhas novas chegam invertidas) |
| saem duas, entra uma: a primeira re-chaveia, a segunda sai sem par | integração | pareamento desigual | `saem duas e entra uma…`; unidade: `parear` em `texto-acompanha-a-grade.repository.test.ts` |
| aula que muda de dia: o futuro da terça sai, nada vai à quarta | integração | só (vínculo, dia) | `a aula que muda de dia…`; unidade: `dia diferente não é par` e `vínculo diferente não é par` |
| J6 | integração | escola B intacta | `J6: a reimportação da escola A não toca o registro da escola B…` (a escola B real e as linhas plantadas com a escola de B sobre o vínculo de A) |
| J7 | integração | a mesma grade duas vezes | `J7: a mesma grade reimportada duas vezes…` |
| o mesmo job entregue duas vezes (D49) | integração | idempotência | `o mesmo job entregue duas vezes (D49)…` |
| falha injetada em `encerrarOsMarcados`: grade e registros voltam juntos | integração | uma transação | `falha injetada em encerrarOsMarcados…` (gatilho que lança no `update` do vínculo; depois a nova tentativa grava tudo) |
| J8 | integração | "hoje" de Brasília | `J8: às 22h de Brasília…` |
| J9 | integração | sem menção ao registro | `J9: a reimportação que re-chaveia e apaga texto deixa o mesmo resumo…` (a mesma reimportação numa escola sem registro; resumo, prévia e auditoria iguais, e o texto-sentinela ausente) |
| J10 | integração | RF13 | `J10: o feriado novo esconde a aula na Semana…` |
| J11a | integração | job primeiro | `J11a: o job para depois de apagar o futuro…` |
| J11b | integração | gravação primeiro | `J11b: a gravação primeiro…` |
| J12 | integração | fora da grade × re-chaveamento | `J12: o PUT no registro que o job re-chaveia…` |
| J15 | integração | ano planejado | `J15: reimportar a grade do ano planejado…` (e as linhas plantadas com o ano em curso sobre o vínculo do planejado) |
| J16 | integração | sem deadlock com o "sai da grade" | `J16: o vínculo marcado "sai da grade"…` |
| vínculo novo da reimportação não toma trava nem lê a `aula` | integração | o conjunto travado | `só os vínculos que já existiam e têm aula que sai ou entra tomam a trava…` (as travas concedidas com o job parado no fim do passo (3)); `as travas saem na ordem da chave…` |
| 504 aulas mudam de horário e 504 saem (mais de um lote de 500) | integração | os lotes | `mais de um lote: 504 aulas que mudam de horário e 504 que saem…` |
| a classificação entrega ao passo a aula que sai e a que entra (só do vínculo que já existia) | unidade | `mudancaDaGrade` | `o passo do texto recebe a aula que sai e a que entra…`, em `grade.test.ts` |

Linha de log nova, se houver: só ids, sem texto e sem contagem de registros.

## Como testar

- Pausa no job e o outro lado por SQL: `apps/api/test/importacao-alunos.int.test.ts:455-470` (`WriteBlockTrigger`, `esperarNaTrava`, a janela de 1 s)
- Reimportação real e "sai da grade": `apps/api/test/grade.int.test.ts › o marcado encerra por \`realocacao\`, e só ele…`
- Mudança entre o gravar e o job: `apps/api/test/grade.int.test.ts:402`
- Comando: `npx vitest run --project integracao apps/api/test/semana-reimportacao.int.test.ts`
- Armadilhas (retro da F2, grupo C): cada direção é um caso; o `esperarNaTrava` casa a classe própria da trava e `wait_event = 'advisory'` (a do convite também é consultiva); com o job parado dentro do passo, o outro lado vai por SQL, sem `await` lento antes do commit

## Autoconferência

As 12 perguntas do modelo, respondidas no plano. Na 10: J11a, J11b, J12 e J16 com a ordem forçada, um caso por direção.

1. **Mutação de cada cláusula:** seção "Mutações". Cobre o pareamento (a chave do grupo com o vínculo e com o dia, as duas ordenações, o ramo do par e o da sobra, o grupo
   reaproveitado), o conjunto travado (os dois lados, `saem` e `entram`), cada termo do `where` do `update` e do `delete` (a escola, o ano, o vínculo, o dia, o início, o
   "hoje em diante", e as três do `not exists`), os campos do `set`, a chave e a classe da trava, o `order by` da chave, a ordem do passo contra a trava (antes dos comandos) e
   contra o `encerrarOsMarcados` (antes dele), o "hoje" de Brasília, o relógio do motor, os dois termos de `mudancaDaGrade` e os lotes de 500.
2. **Texto na tela:** a tarefa não tem tela.
3. **Segundo dado:** o colega com registro no mesmo dia e início (J2, J3), o colega com registro no início novo (J4), a aula que fica no mesmo dia com outro início (J2, J3), a
   quarta com o mesmo início da segunda que muda (J2), a escola B e o ano planejado com a linha que as FKs não deixam existir, plantada com `session_replication_role = replica`
   (J6, J15), o vínculo novo ao lado dos que já existiam e o que não muda (o conjunto travado).
4. **Checagem anterior:** a reimportação só chega ao passo com a prévia sem erro e a assinatura igual: todo caso grava a planilha pela API e roda o job real, sem atalho; o
   caso que precisa de pausa usa o gatilho do banco de teste e confere a fila de `pg_locks` da trava **daquele** vínculo antes de soltar. J11a e J12 chegam ao PUT que a
   conferência do vínculo deixaria passar (o vínculo é dela, confirmado, e a alocação velha ainda é visível a quem não é o job).
5. **Resultado, não forma:** todo caso lê as linhas de `aula` e de `alocacao` do banco e a resposta do PUT; nenhum lê texto de arquivo. A comparação do J9 é entre duas escolas.
6. **Guarda nova:** não há.
7. **Comentários:** o docblock do repository diz que a leitura da `aula` é a do próprio comando, depois da trava (é): o passo não lê a `aula` para o aplicativo.
   O da classificação diz que `aulasQueSaemGravadas` fica fora da assinatura (fica: a assinatura é a de antes).
8. **Divergência que muda regra:** uma, o "hoje" do passo vir do relógio do job (`ExecucaoOptions.relogio`); está na `techspec.md` §2 e §5 e no `cenarios.md` J8, e o grep de
   `ExecucaoOptions.relogio` acha os três. Não cria trava nem rota.
9. **Peça que já existe:** a classe da trava (`CHAVE_DA_TRAVA_DO_VINCULO_DA_AULA`, importada do `aula.repository.ts` pelo caminho), `diaDeUso`, `systemClock`, o padrão do
   `ImportacaoRepository` que entrega cada escrita à transação por um repository (`AlocacaoRepository`), `WriteBlockTrigger`, `aguardar`, `plantar` do `aulas.int.test.ts`. A
   fixture da reimportação real é a do `grade.int.test.ts`, reescrita menor.
10. **Concorrência:** J11a (a pausa depois do `delete`, o PUT na fila da trava do vínculo, solta), J11b (a transação do teste segura a trava e grava na alocação velha; o job
    espera; o teste confirma), J12 (a pausa depois do `update`), J16 (a trava segura, o insert e o commit do teste logo depois de ver o job esperando, sem erro nos dois lados
    e na primeira tentativa), uma direção por caso. O `esperarNaFilaDaTrava` casa a classe e a chave daquele vínculo em `pg_locks` (`objsubid = 2`, `not granted`).
11. **Isolamento sem a cláusula:** o J6 e o J15 plantam a linha que o `vinculo_id` já separaria, para a escola e o ano serem observáveis; o colega do J2, J3 e J4 faz o mesmo
    com o vínculo. A tabela de testes tem a coluna "Caso" preenchida.
12. **Guardiões:** `tenancy-guardian` (escola, ano e vínculo em todo comando do passo, a escola do job e não a de argumento, a chave da trava com a escola), `privacy-guardian`
    (o texto não vai a log, a auditoria, resumo nem prévia: J9), `infra-guardian` (a ordem global das travas, os 1 s / 1,5 s do passo (3), os comandos em lote, o `EXPLAIN` abaixo), `test-engineer`. O `achados/indice.md` pediu para a 5.0: o `esperandoNaTravaDoVinculo` por chave (feito, `esperandoNaTravaDe`), a professora com duas
    disciplinas na mesma turma (`TODO.md`, ainda aberto: a 5.0 não tem PUT novo) e a `eq(anoLetivo.escolaId…)` de `fimDaAulaGravavel` (a 5.0 não a reaproveita).

    **O plano do `update` e do `delete` do passo** (`EXPLAIN` no banco de teste; o infra-guardian repetiu com `seqscan` e `bitmapscan` desligados): nested loop sobre o `VALUES`,
    e a busca da `aula` desce por índice que começa pelo vínculo, nunca por varredura da tabela: o `aula_semana_idx` (escola, ano, vínculo, data) na medição do Implementador, e o
    `aula_vinculo_data_inicio_unico` (vínculo, data, início) na do infra-guardian, que também atende o `not exists` do `update`. Com o segundo, escola e ano entram como filtro, sem
    índice próprio, e isso não pesa: o vínculo pertence a uma só escola e a um só ano pela FK composta. Nenhum índice novo.

## Fora do escopo desta tarefa

O `PUT` (4.0); as telas.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O "hoje" do passo vem do relógio do job: `ExecucaoOptions.relogio` (padrão o do sistema) entregue no `AmbienteDaGravacao`; o passo chega à transação por `ImportacaoRepository.acompanharOTextoDaAula`, e a classificação entrega `aulasQueSaemGravadas` (fora da assinatura) | o job não tinha relógio, e sem ele o J8 (22h de Brasília) não se prova; a `alocacao` que sai já foi apagada quando o passo roda, e o passo precisa do vínculo, do dia e do início dela | `techspec.md` §2 (linhas de `grade.ts` e do módulo `semana`) e §5, "Reimportar a grade"; `cenarios.md` J8 |

## Mutações

--faltando: nenhuma linha nova de produção com condição fica sem bloco (`node tools/processo/mutacoes.ts --faltando` confere).

O pareamento, em unidade (`parear` é função pura): a chave do grupo sem o dia, sem o vínculo, as duas ordenações, o grupo reaproveitado e o ramo da sobra.

A chave do grupo perde o dia: a que sai na terça passa a ser par da que entra na quarta.

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: packages/core/src/semana/texto-acompanha-a-grade.repository.test.ts › dia diferente não é par
-    const chave = JSON.stringify([vinculoId, diaSemana])
+    const chave = JSON.stringify([vinculoId])
```

A chave do grupo perde o vínculo: o antecessor passa a ser par do substituto.

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: packages/core/src/semana/texto-acompanha-a-grade.repository.test.ts › vínculo diferente não é par
-    const chave = JSON.stringify([vinculoId, diaSemana])
+    const chave = JSON.stringify([diaSemana])
```

As que saem deixam de ser ordenadas por início (a ordem de chegada manda).

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: packages/core/src/semana/texto-acompanha-a-grade.repository.test.ts › aula dupla
-    const velhas = [...saem].sort(porInicio)
+    const velhas = [...saem]
```

As que entram deixam de ser ordenadas por início.

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: packages/core/src/semana/texto-acompanha-a-grade.repository.test.ts › aula dupla
-    const novas = [...entram].sort(porInicio)
+    const novas = [...entram]
```

A comparação por início deixa de comparar (empata sempre).

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: packages/core/src/semana/texto-acompanha-a-grade.repository.test.ts › aula dupla que chega em ordens diferentes
-const porInicio = (a: AulaDaGrade, b: AulaDaGrade): number => (a.inicio < b.inicio ? -1 : a.inicio > b.inicio ? 1 : 0)
+const porInicio = (_a: AulaDaGrade, _b: AulaDaGrade): number => 0
```

Cada aula cai num grupo só dela (o grupo achado não é reaproveitado): a que sai e a que entra nunca se encontram.

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: packages/core/src/semana/texto-acompanha-a-grade.repository.test.ts › uma sai e uma entra
-    const achado = grupos.get(chave) ?? { saem: [], entram: [] }
+    const achado = { saem: [], entram: [] }
```

O ramo da sobra inverte: a que tem par vira sobra, e a que não tem lê o que não existe.

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: packages/core/src/semana/texto-acompanha-a-grade.repository.test.ts › saem duas e entra uma
-      if (nova === undefined) sobras.push({ vinculoId: velha.vinculoId, diaSemana: velha.diaSemana, velho: velha.inicio })
+      if (nova !== undefined) sobras.push({ vinculoId: velha.vinculoId, diaSemana: velha.diaSemana, velho: velha.inicio })
```

O conjunto travado e a trava, em integração.

Sem vínculo mexido o passo deixa de sair antes de travar: a primeira importação (todo vínculo é novo) manda `values` vazio ao SQL.

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › J1:
-    if (vinculos.length === 0) return
```

O conjunto perde os vínculos que só têm aula entrando (o Yuri não toma trava).

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › só os vínculos que já existiam
-    const vinculos = [...new Set([...mudanca.saem, ...mudanca.entram].map(({ vinculoId }) => vinculoId))]
+    const vinculos = [...new Set([...mudanca.saem].map(({ vinculoId }) => vinculoId))]
```

O conjunto perde os vínculos que só têm aula saindo (a Zezé não toma trava).

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › só os vínculos que já existiam
-    const vinculos = [...new Set([...mudanca.saem, ...mudanca.entram].map(({ vinculoId }) => vinculoId))]
+    const vinculos = [...new Set([...mudanca.entram].map(({ vinculoId }) => vinculoId))]
```

O passo não toma a trava do vínculo.

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › J11b:
-    await this.travarVinculos(escolaId, vinculos)
```

O passo toma a trava depois dos comandos que leem e escrevem a `aula`: o registro que a gravação confirmou durante a espera não é visto.

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › J11b:
-    await this.travarVinculos(escolaId, vinculos)
     const { pares, sobras } = parear(mudanca)
     for (let inicio = 0; inicio < pares.length; inicio += TAMANHO_DO_LOTE) await this.rechavear(escolaId, anoLetivoId, pares.slice(inicio, inicio + TAMANHO_DO_LOTE))
     for (let inicio = 0; inicio < sobras.length; inicio += TAMANHO_DO_LOTE) await this.apagarOFuturo(escolaId, anoLetivoId, sobras.slice(inicio, inicio + TAMANHO_DO_LOTE), hoje)
+    await this.travarVinculos(escolaId, vinculos)
```

A classe da trava não é a da gravação.

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › J11b:
-      select pg_advisory_xact_lock(${CHAVE_DA_TRAVA_DO_VINCULO_DA_AULA}, chave)
+      select pg_advisory_xact_lock(${CHAVE_DA_TRAVA_DO_VINCULO_DA_AULA + 1}, chave)
```

A escola sai da chave da trava.

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › J11b:
-        from (select distinct hashtext(${escolaId}::uuid::text || v.id::text) as chave from (values ${valores}) as v(id) order by chave) as ordenadas
+        from (select distinct hashtext(v.id::text) as chave from (values ${valores}) as v(id) order by chave) as ordenadas
```

As travas deixam de sair em ordem de chave.

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › as travas saem na ordem da chave
-        from (select distinct hashtext(${escolaId}::uuid::text || v.id::text) as chave from (values ${valores}) as v(id) order by chave) as ordenadas
+        from (select hashtext(${escolaId}::uuid::text || v.id::text) as chave from (values ${valores}) as v(id)) as ordenadas
```

O `update` do re-chaveamento, termo a termo.

A escola sai do `update` (a linha plantada com a escola de B, no vínculo de A, se move).

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › J6:
        from (values ${valores}) as p(vinculo_id, dia, velho, novo, fim_novo)

-       where a.escola_id = ${escolaId}::uuid
+       where true
```

O ano sai do `update` (a linha plantada com o ano em curso, no vínculo do planejado, se move).

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › J15:
-         and a.ano_letivo_id = ${anoLetivoId}::uuid
         and a.vinculo_id = p.vinculo_id
```

O vínculo sai do `update` (a colega, no mesmo dia e início, se move).

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › J2:
-         and a.vinculo_id = p.vinculo_id
         and extract(isodow from a.data)::int = p.dia
```

O dia da semana sai do `update` (a quarta das 7h30 do mesmo vínculo se move com a segunda).

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › J2:
-         and extract(isodow from a.data)::int = p.dia
         and a.inicio = p.velho
```

O início velho sai do `update` (a aula das 9h do mesmo dia se move).

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › J2:
-         and a.inicio = p.velho
         and not exists (
```

A colisão deixa de ser conferida: o texto fora da grade que ocupa o início novo bate na chave única, e o job falha.

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › J4:
-         and not exists (
-           select 1 from aula as ocupada
-            where ocupada.escola_id = a.escola_id and ocupada.vinculo_id = a.vinculo_id and ocupada.data = a.data and ocupada.inicio = p.novo
-         )
```

A colisão deixa de olhar o vínculo (o registro da colega no início novo impede o da Dani).

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › J4:
-            where ocupada.escola_id = a.escola_id and ocupada.vinculo_id = a.vinculo_id and ocupada.data = a.data and ocupada.inicio = p.novo
+            where ocupada.escola_id = a.escola_id and ocupada.data = a.data and ocupada.inicio = p.novo
```

A colisão deixa de olhar a data (o registro fora da grade de outra data impede o re-chaveamento).

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › J4:
-            where ocupada.escola_id = a.escola_id and ocupada.vinculo_id = a.vinculo_id and ocupada.data = a.data and ocupada.inicio = p.novo
+            where ocupada.escola_id = a.escola_id and ocupada.vinculo_id = a.vinculo_id and ocupada.inicio = p.novo
```

A colisão deixa de olhar o início novo (qualquer outro registro da data impede o re-chaveamento).

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › J2:
-            where ocupada.escola_id = a.escola_id and ocupada.vinculo_id = a.vinculo_id and ocupada.data = a.data and ocupada.inicio = p.novo
+            where ocupada.escola_id = a.escola_id and ocupada.vinculo_id = a.vinculo_id and ocupada.data = a.data
```

O `update` deixa de trazer o início novo.

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › J2:
-         set inicio = p.novo, fim = p.fim_novo
+         set fim = p.fim_novo
```

O `update` deixa de trazer o fim novo.

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › J2:
-         set inicio = p.novo, fim = p.fim_novo
+         set inicio = p.novo
```

O `delete` do futuro, termo a termo.

A escola sai do `delete` (a linha plantada com a escola de B, no vínculo de A, é apagada).

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › J6:
       using (values ${valores}) as s(vinculo_id, dia, velho)

-       where a.escola_id = ${escolaId}::uuid
+       where true
```

O ano sai do `delete` (a linha plantada com o ano em curso, no vínculo do planejado, é apagada).

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › J15:
-         and a.ano_letivo_id = ${anoLetivoId}::uuid
         and a.vinculo_id = s.vinculo_id
```

O vínculo sai do `delete` (o registro da colega na quarta é apagado).

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › J3:
-         and a.vinculo_id = s.vinculo_id
         and extract(isodow from a.data)::int = s.dia
```

O dia da semana sai do `delete` (a segunda das 7h30, que continua, é apagada com a quarta).

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › J3:
-         and extract(isodow from a.data)::int = s.dia
         and a.inicio = s.velho
```

O início velho sai do `delete` (a quarta das 9h, que continua, é apagada).

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › J3:
-         and a.inicio = s.velho
         and a.data >= ${hoje}::date
```

O "hoje em diante" sai do `delete` (o passado também é apagado).

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › J3:
-         and a.data >= ${hoje}::date
```

Hoje deixa de ser apagado (`>` no lugar de `>=`).

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › J3:
-         and a.data >= ${hoje}::date
+         and a.data > ${hoje}::date
```

Os lotes de 500.

O lote do re-chaveamento perde o último par.

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › mais de um lote
-    for (let inicio = 0; inicio < pares.length; inicio += TAMANHO_DO_LOTE) await this.rechavear(escolaId, anoLetivoId, pares.slice(inicio, inicio + TAMANHO_DO_LOTE))
+    for (let inicio = 0; inicio < pares.length; inicio += TAMANHO_DO_LOTE) await this.rechavear(escolaId, anoLetivoId, pares.slice(inicio, inicio + TAMANHO_DO_LOTE - 1))
```

O lote do `delete` perde a última sobra.

```mutacao
arquivo: packages/core/src/semana/texto-acompanha-a-grade.repository.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › mais de um lote
-    for (let inicio = 0; inicio < sobras.length; inicio += TAMANHO_DO_LOTE) await this.apagarOFuturo(escolaId, anoLetivoId, sobras.slice(inicio, inicio + TAMANHO_DO_LOTE), hoje)
+    for (let inicio = 0; inicio < sobras.length; inicio += TAMANHO_DO_LOTE) await this.apagarOFuturo(escolaId, anoLetivoId, sobras.slice(inicio, inicio + TAMANHO_DO_LOTE - 1), hoje)
```

A ligação na grade e no motor.

O "hoje" do passo passa a ser o dia de UTC (às 22h de Brasília já é o dia seguinte).

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › J8:
-      await gravacao.acompanharOTextoDaAula(anoLetivoId, mudancaDaGrade(classificacao), diaDeUso(relogio.agora()))
+      await gravacao.acompanharOTextoDaAula(anoLetivoId, mudancaDaGrade(classificacao), relogio.agora().toISOString().slice(0, 10))
```

O passo roda depois do `encerrarOsMarcados`: o `FOR UPDATE` do vínculo vem antes da trava consultiva, e o insert do teste fecha o ciclo.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › J16:
-      await gravacao.acompanharOTextoDaAula(anoLetivoId, mudancaDaGrade(classificacao), diaDeUso(relogio.agora()))
       await encerrarOsMarcados(gravacao, tx, anoLetivoId, aEncerrar)
+      await gravacao.acompanharOTextoDaAula(anoLetivoId, mudancaDaGrade(classificacao), diaDeUso(relogio.agora()))
```

A aula que só muda de fim ou de sala entra como "entrou" (par da que sai no mesmo dia).

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › a aula que continua com o fim mudado
-    aula === undefined || vinculo?.tipo !== 'existente' || gravada !== undefined ? [] : [{ vinculoId: vinculo.id, diaSemana: aula.dia, inicio: aula.inicio, fim: aula.fim }],
+    aula === undefined || vinculo?.tipo !== 'existente' ? [] : [{ vinculoId: vinculo.id, diaSemana: aula.dia, inicio: aula.inicio, fim: aula.fim }],
```

O vínculo que a planilha cria entra no conjunto (com a chave da tripla no lugar do id, que o SQL recusa como `uuid`).

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › só os vínculos que já existiam
-    aula === undefined || vinculo?.tipo !== 'existente' || gravada !== undefined ? [] : [{ vinculoId: vinculo.id, diaSemana: aula.dia, inicio: aula.inicio, fim: aula.fim }],
+    aula === undefined || vinculo === undefined || gravada !== undefined ? [] : [{ vinculoId: vinculo.tipo === 'existente' ? vinculo.id : vinculo.chave, diaSemana: aula.dia, inicio: aula.inicio, fim: aula.fim }],
```

A classificação deixa de entregar as aulas que saem.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › J3:
-    aulasQueSaemGravadas: queSaem,
+    aulasQueSaemGravadas: [],
```

O motor deixa de entregar o relógio do job (o passo usa o do sistema).

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/api/test/semana-reimportacao.int.test.ts › J3:
-    await comAutora(autor, () => plano.aplicar(gravacao, { tx, ciclo: new CicloDeVidaService(banco), relogio: opcoes.relogio ?? systemClock }))
+    await comAutora(autor, () => plano.aplicar(gravacao, { tx, ciclo: new CicloDeVidaService(banco), relogio: systemClock }))
```

**Sem bloco, com o motivo.** (1) `aula === undefined` de `mudancaDaGrade`: a linha sem `aula` é a de erro, e a planilha com erro não chega ao gravar nem ao job; o termo só estreita o tipo.
(2) O `= systemClock` do `relogio` de `aplicar` (grade.ts) e o `?? systemClock` do motor com `relogio` ausente: o motor sempre entrega o relógio, e o padrão serve a quem chama o `aplicar` sem
o motor (os testes de unidade de outros tipos); o `?? systemClock` do motor é o relógio de produção, e o bloco acima prova que o do job é o lido. (3) O ramo vazio de `classificar`
(`aulasQueSaemGravadas: []` quando há erro de linha): a planilha com erro não grava, e o campo vazio é o do ramo, como `aulasQueSaem: []`. (4) A escola do `not exists` do `update`
(`ocupada.escola_id = a.escola_id`): o `(vinculo_id, data, inicio)` é único e o vínculo só tem registros da própria escola (FK composta); plantado um ocupante de outra escola no
vínculo, o único estoura em vez de a cláusula decidir. (5) `requireEscolaId()` de `acompanhar` e de `acompanharOTextoDaAula`: só dão o escopo aos comandos que a mesma função emite, e cada
comando tem o seu bloco. (6) A transação única (a falha injetada em `encerrarOsMarcados` desfaz grade e registros): o passo usa o `banco` do `ImportacaoRepository`, que é a transação do
passo (3), e trocar por outra conexão exige uma dependência que o repository não tem; o caso `falha injetada em encerrarOsMarcados` prova o efeito.

A planilha com erro de linha passa a calcular as saídas (e entregar `aulasQueSaemGravadas`) mesmo assim.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › planilha com erro de linha não oferece candidato nem conta aula que sai
- const { aulasQueSaem, aulasQueSaemGravadas, candidatos } = semLeitura === 0 && linhas.every(({ resultado }) => resultado !== 'erro') ? saidasDe(linhas, dados) : { aulasQueSaem: [], aulasQueSaemGravadas: [], candidatos: [] }
+ const { aulasQueSaem, aulasQueSaemGravadas, candidatos } = semLeitura === 0 ? saidasDe(linhas, dados) : { aulasQueSaem: [], aulasQueSaemGravadas: [], candidatos: [] }
```

A linha que a leitura recusou deixa de calar as saídas.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › planilha com erro de linha não oferece candidato nem conta aula que sai
- const { aulasQueSaem, aulasQueSaemGravadas, candidatos } = semLeitura === 0 && linhas.every(({ resultado }) => resultado !== 'erro') ? saidasDe(linhas, dados) : { aulasQueSaem: [], aulasQueSaemGravadas: [], candidatos: [] }
+ const { aulasQueSaem, aulasQueSaemGravadas, candidatos } = linhas.every(({ resultado }) => resultado !== 'erro') ? saidasDe(linhas, dados) : { aulasQueSaem: [], aulasQueSaemGravadas: [], candidatos: [] }
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | `texto-acompanha-a-grade.repository.ts`: o `not exists` não filtra `ocupada.ano_letivo_id` | Recusada. O vínculo pertence a um ano só e `(vinculo_id, data, inicio)` é único: nenhum teste consegue ficar vermelho sem a cláusula, e cláusula nova sem bloco em "Mutações" fere a regra 40. O revisor mesmo diz que "não causa dano hoje" |
| infra-guardian (1ª) | Escrever na Tech Spec o teto de vínculos por reimportação (uma trava consultiva por vínculo, todas na mesma transação; `max_locks_per_transaction`) | `TODO.md`, dono Arquiteto: o número é decisão de capacidade, não desta tarefa. Antes do portão da primeira escola de rede pública |
| infra-guardian (1ª) | Classificar o `57014` do passo como falha de trava (hoje o último erro grava `erro_interno`, `apps/worker/src/processors/gravar-planilha.ts:66`) | `TODO.md`, na próxima tarefa ou correção que tocar `gravar-planilha.ts`: muda comportamento em arquivo que a 5.0 não toca |
| conformidade-reviewer (1ª) | Avisar só a professora, na Semana, que o texto das datas futuras de uma aula que saiu da grade foi apagado, sem contagem para a coordenação | `TODO.md`, pergunta de produto ao Arquiteto, antes da tarefa da tela da Semana. É decisão de produto (D45 e D64 limitam o que a coordenação vê), não de revisão |
| test-engineer (1ª) | A janela de 1 s do `lock_timeout` em J11a, J12 e J16 pode dar falha intermitente em máquina carregada | Sem ação: é o padrão prescrito (`importacao-alunos.int.test.ts:455-470`) e, se falhar, o teste fica vermelho, nunca verde por engano. Se aparecer intermitência, abre-se correção |
| test-engineer (1ª) | D49 em sequência: variante com `Promise.all` sobre `rodar` | Recusada: a corrida de verdade do mesmo job está provada no motor (`apps/worker/test/gravar-planilha.int.test.ts:134`); o passo roda dentro dessa mesma transação |
| test-engineer (1ª) | Aula dupla deslocada de um tempo (07:30 e 08:20 viram 08:20 e 09:10): os textos trocam de ordem; não há caso que o declare | Validador: é o comportamento que a Tech Spec §5 manda; ele decide se é o esperado e, se for, pede o caso |
| test-engineer (1ª) | Professora com duas disciplinas na mesma turma: falta caso mostrando que o texto de um vínculo não vai para o outro | Já aberto em `TODO.md` ("semana-do-professor, 4.0, test-engineer, 1ª"); o Implementador acrescenta nele a 5.0, sem linha nova |
| test-engineer (2ª), revisor-geral (2ª) | `semana-reimportacao.int.test.ts:815`: o filtro `daEscola` deixou o vínculo que a reimportação cria (Xuxa na 8º B) fora da conferência de "só os vínculos que já existiam tomam a trava"; devolver a prova direta guardando a lista sem filtro e filtrando depois por `daEscola` mais a chave do vínculo criado, ou filtrar pelo `pid` do job parado | Recusada nesta tarefa: os dois revisores dizem que não há buraco hoje (a `mudancaDaGrade` é calculada antes de o vínculo existir) e que a mutação do bloco de `5_task.md` (a chave da tripla no lugar do id) continua vermelha, porque o SQL recusa a chave como `uuid`. Fica para quem mexer neste caso |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-06 23:28:37 | 2026-11-06 23:29:17 | `tenancy-guardian` | 1 | APROVADO | adea699dfc6eff368 |
| 2026-11-06 23:28:46 | 2026-11-06 23:29:17 | `conformidade-reviewer` | 1 | APROVADO | a74ec01f545b0806d |
| 2026-11-06 23:28:39 | 2026-11-06 23:29:40 | `privacy-guardian` | 1 | APROVADO | a8172bf17784cb8b8 |
| 2026-11-06 23:28:44 | 2026-11-06 23:29:53 | `revisor-geral` | 1 | APROVADO | add8b11b06db13e6c |
| 2026-11-06 23:28:40 | 2026-11-06 23:30:32 | `infra-guardian` | 1 | APROVADO | a1ebb08a64e075785 |
| 2026-11-06 23:28:42 | 2026-11-06 23:32:12 | `test-engineer` | 1 | APROVADO | afc662a1f238e60ef |
| 2026-11-06 23:51:16 | 2026-11-06 23:51:56 | `revisor-geral` | 2 | APROVADO | a38e2be4c68a06e32 |
| 2026-11-06 23:51:06 | 2026-11-06 23:51:58 | `test-engineer` | 2 | APROVADO | a8a21acae32c276fd |
