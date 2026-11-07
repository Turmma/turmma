# Tarefa 4.0 — A professora grava o que vai dar (`PUT /v1/aulas`)

**Funcionalidade:** semana-do-professor · **Depende de:** 2.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `test-engineer`
**Porte:** grande

## Objetivo

`PUT /v1/aulas` grava, corrige e apaga o texto da aula dela, travando o ano e depois o vínculo; o que não é dela responde
como o inexistente.

## Contexto necessário

- `techspec.md` seções 4, 5 ("Gravar"), 6, 7 e 7c (a ordem global e as corridas 1 e 4); `cenarios.md` "Gravação", R1, R1b, R4, R7, S6, S16, J13, J14
- `prd.md` RF5, RF10, RF11, RF15
- `packages/core/src/estrutura/turma.repository.ts` (`travarAnoEmCurso`)
- `packages/core/src/convite/convite-da-escola.repository.ts:18`: a classe de trava em duas chaves; a nova é outra (procure `7_000_00` para não repetir)
- `packages/core/src/ciclo-de-vida/conta-global.repository.ts:122`: só o `throw` de `INDISPONIVEL_TENTE_DE_NOVO` depois de três tentativas; a tradução do `55P03` desta tarefa é a de `apps/api/src/semana/aulas.service.ts` (`TRAVA_NAO_DISPONIVEL`)
- A conferência do vínculo **lê sem trava de linha**: nunca `VinculoRepository.travar` (abre o ciclo com `encerrarOsMarcados`)

## Subtarefas

- [x] 4.1 — `AulaRepository.gravar`: `lock_timeout` de 2 s; (1) `travarAnoEmCurso()`; (2) o vínculo é dela, `confirmado`, da escola e do ano do contexto; (3) `pg_advisory_xact_lock(<classe>, hashtext(escolaId‖vinculoId))`; (4) a data no ano, sem feriado nem recesso, com alocação ou registro **passado**; upsert com `setWhere` da escola; vazio apaga
- [x] 4.2 — A classe da trava exportada para a 5.0; controller e service no módulo `semana`
- [x] 4.3 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/semana/aula.repository.ts` | novo |
| `packages/core/src/semana/index.ts`, `packages/core/src/index.ts` | alterado |
| `apps/api/src/semana/aulas.controller.ts`, `apps/api/src/semana/aulas.service.ts` | novo |
| `apps/api/src/semana/semana.module.ts` | alterado |
| `apps/api/test/aulas.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| G1, uma linha por cláusula | integração | `NAO_ENCONTRADO`, nada gravado | `G1: cada cláusula dá NAO_ENCONTRADO e não grava` (13 casos: feriado, recesso, depois e antes do ano, ano planejado, início sem alocação, dia sem alocação, futura sem alocação, registro da colega, outro início, feriado sobre o registro passado); `o que não tira a aula` (o evento comum, o feriado de B, o do ano planejado e os vizinhos) |
| G1: data futura e de hoje, sem alocação, com registro gravado direto | integração | o "passado" | `data futura sem alocação, num dia útil sem evento, com registro gravado direto` e `a data de hoje sem alocação, com registro gravado direto`; `G1: a aula de hoje, com alocação, grava` |
| G2 | integração | o fora da grade se corrige | `G2: o registro passado que saiu da grade se corrige` |
| G3 | integração | vazio apaga; 500 grava; 501 recusa | `G3: texto vazio e texto só de espaços apagam…` |
| `"  abc  "` grava `"abc"`; 500 com espaços nas pontas grava | integração | aparar antes de medir | `o texto é aparado antes de medir` |
| vazio sem registro: `texto: null`, sem linha | integração | apagar idempotente | `texto vazio numa aula sem registro` |
| o segundo `PUT` muda `conteudo` e `atualizadoEm`; o `fim` é o da alocação | integração | upsert | `grava o texto da aula da grade` |
| no fora da grade, o `fim` gravado fica | integração | upsert | `G2` (o `fim` de 09:20 fica) |
| G4 | integração | ano anterior | `G4: o vínculo confirmado da mesma professora no ano anterior…` |
| G5 | integração | log sem texto, sem auditoria | `G5: o log do PUT não traz o texto…` |
| G6, `Promise.all`, as duas com sucesso, uma linha | integração | RF15 | `G6: duas gravações da mesma aula ao mesmo tempo…` |
| campo a mais, data inexistente e `inicio` mal formado: `ENTRADA_INVALIDA` | integração | contrato estrito | `o contrato é estrito` |
| R1 | integração | a mesma resposta | `R1: vínculo de outra escola, de colega, pendente, contestado, encerrado, de papel aluno e id inexistente…` (a resposta inteira, com a mensagem, é a mesma nos sete) |
| o vínculo da própria professora na escola B, com o token de A | integração | a cláusula da escola | `o vínculo da própria professora na escola B, com o token de A`; a cláusula sozinha, com a linha que as FKs não deixam existir: `a cláusula de escola e de ano do vínculo, da alocação e do registro` |
| R1b (a) colega de A, trava presa: `NAO_ENCONTRADO` na hora | integração | confere, depois trava | `R1b (a)` |
| R1b (b) `(escolaA‖vinculoB)` presa: a mesma resposta na hora | integração | chave composta | `R1b (b)` (e a gravação da própria B, com a chave só do vínculo presa, não espera) |
| R4, parte do `PUT` | integração | antecessor | `R4, o PUT` |
| R7, parte do `PUT` | integração | coordenação e aluno | `R7, o PUT` |
| S6, parte do `PUT` | integração | sem ano em curso | `S6, o PUT` |
| S16, parte do `PUT` | integração | aula dupla | `S16, o PUT`; `apagar uma aula não apaga outra` |
| J13: na fila da trava, `INDISPONIVEL_TENTE_DE_NOVO` | integração | `lock_timeout` | `J13` |
| J14: pausa da virada, `PUT` na fila do ano, `NAO_ENCONTRADO`, nada no ano encerrado | integração | trava do ano | `J14: a virada pausada depois de apagar a aula…`; `o ano que deixa de estar em curso enquanto o PUT espera o for share` |

O `setWhere` da escola no `on conflict` é inalcançável com a FK composta: prove-o, ou registre a redundância na seção 11
da Tech Spec antes da Mesa.

**O `setWhere`, provado, e não registrado:** `o setWhere da escola no on conflict é inalcançável` mostra que o banco recusa (`23503`) a aula de uma
escola sobre o vínculo de outra; e `a cláusula de escola e de ano do vínculo, da alocação e do registro` planta, com `session_replication_role =
replica`, a linha da escola B sobre o vínculo dela, e mostra que o `setWhere` não a sobrescreve (mutação própria, em "Mutações").

## Como testar

- J14: `apps/api/test/virada-do-ano.int.test.ts › concorrência: o professor contesta com texto no mesmo instante em que o ano é encerrado…`, com `WriteBlockTrigger` e `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`)
- G6: `apps/api/test/virada-do-ano.int.test.ts › clique duplo: dois \`encerrar\` em paralelo…`
- Trava presa e `lock_timeout`: `apps/api/test/acesso-fim-do-vinculo.int.test.ts:334`
- Log capturado: as `linhasDeLog` de `subirApi` (`apps/api/test/test-api.ts:26`)
- Comando: `npx vitest run --project integracao apps/api/test/aulas.int.test.ts`
- Armadilha (retro da F2, grupo C): a direção é a que o cenário nomeia, e o `esperarNaTrava` casa só o lado esperado

## Autoconferência

As 12 perguntas do modelo, respondidas no plano. Na 4: o R1b (a) chega na trava só se a conferência falhar depois dela (o `PUT` do teste usa o
`vinculoId` do colega, que existe, é da mesma escola e tem alocação, e é a ordem do service que o faz responder antes da trava: a mutação que troca as
duas linhas deixa o caso vermelho).

1. **Mutação de cada cláusula:** seção "Mutações". Cobre os seis termos da conferência do vínculo, a chave e o comando da trava, o `lock_timeout` e o
   `statement_timeout`, as cinco consultas de `fimDaAulaGravavel` (o ano com seus três termos, o evento com seus cinco, a alocação com seus cinco, o registro
   passado com seus seis e o "passado" com o `<`), o upsert (os três campos do `set` e o `setWhere`), o apagar (os cinco termos), cada `if` do service,
   a tradução do `55P03` (a condição e o `throw erro`), a resposta `null`, o relógio do módulo e o pipe do controller.
2. **Texto na tela:** a tarefa não tem tela.
3. **Segundo dado:** a colega com alocação em todo dia da semana, às 7h30, 9h e 10h, e registro passado no dia e início que a professora tenta gravar;
   dois registros passados dela em outra data e em outro início; o feriado da escola B, o do ano planejado, o evento comum, o do domingo anterior e o recesso
   que começa na terça; o ano planejado cobrindo uma data (2027-03-01); o vínculo de aluno e o de cada estado; e, com a linha que as FKs não deixam existir,
   a alocação e o registro de B e do ano planejado sobre o vínculo dela.
4. **Checagem anterior:** a rota não cai antes em `requireAnoEmCurso()` nos casos de G1 (o ano está em curso); só o S6 cai nele, de propósito. O `if` do ano
   (`travarAnoEmCurso`) responde antes da conferência do vínculo, e por isso o caso `o ano que deixa de estar em curso` deixa o vínculo e a alocação de pé:
   só o `for share` pode recusar. A recusa da matriz (R7) vem antes do controller.
5. **Resultado, não forma:** todo caso lê a resposta e as linhas de `aula` do banco; nenhum lê texto de arquivo.
6. **Guarda nova:** não há.
7. **Comentários:** o docblock do repository diz que nenhum método recebe escola, ano nem usuário, e é verdade; `hoje` é o dia do relógio, e não escopo. O
   comentário do `gravar` diz que o `setWhere` não é alcançável por dado consistente, e o caso o prova pelo banco e mostra a camada com a linha plantada.
8. **Divergência que muda regra:** uma, o `statement_timeout` local de 3 s; está na `techspec.md` §5 ("Gravar") e §7c e no `cenarios.md` J13, e o grep
   de `statement_timeout` acha as três.
9. **Peça que já existe:** `TurmaRepository.travarAnoEmCurso`, `diaDeUso`, `postgresErrorIn`, `DEFAULT_RETRY_AFTER_SECONDS`, o contrato `gravarAulaRequestSchema`
   (da 1.0), `WriteBlockTrigger` e `esperarNaTrava`. A constante da classe da trava (7_000_004) é nova, e o `grep 7_000_00` achou as três em uso.
10. **Concorrência:** G6 em `Promise.all`; J14 e `o ano que deixa de estar em curso` com a ordem forçada (o gatilho de parada na `aula`, ou a transação do
    teste que muda o ano, e `esperarNaTrava` casando o `for share` do ano, o lado esperado); J13 e R1b com a trava presa por uma transação do teste, e a
    espera conferida em `pg_locks` (`granted = false` na classe da gravação).
11. **Isolamento sem a cláusula:** o `R1` usa só ids de outra escola e do colega; o caso `o vínculo da própria professora na escola B` usa o vínculo da B com o
    token da A; as cláusulas de escola e de ano que as FKs tornam redundantes têm a linha plantada. A tabela de testes tem a coluna "Caso" preenchida.
12. **Guardiões:** `tenancy-guardian` (escola e ano em todo `where`, professora da sessão, a mesma resposta para colega, B, antecessor e id inexistente, a
    trava com a escola na chave), `privacy-guardian` (o texto não vai a log nem a auditoria, e o DTO de saída é o do contrato), `infra-guardian` (a ordem
    global das travas, `lock_timeout`, `statement_timeout`, a corrida com a virada), `test-engineer`. O `achados/indice.md` da 2.0 não pediu nada para a 4.0.

## Fora do escopo desta tarefa

Passo da grade (5.0), painel (7.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| A transação da gravação eleva o próprio `statement_timeout` para 3 s, além do `lock_timeout` de 2 s | o `statement_timeout` da API (`BANCO_TIMEOUT_CONSULTA_MS`, 2 s) é o mesmo prazo e começa antes: a espera da trava é um comando só e é cortada com `57014` (`TEMPO_ESGOTADO`), e o `INDISPONIVEL_TENTE_DE_NOVO` do J13 nunca sairia | `techspec.md` §5, "Gravar", e §7c, "Corridas de concorrência"; `cenarios.md` J13 |

## Mutações

A trava de espera: sai o `lock_timeout` de 2 s, e só o `statement_timeout` de 3 s corta a espera (`TEMPO_ESGOTADO`).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › J13
-      sql`select set_config('lock_timeout', ${String(ESPERA_MAXIMA_DA_GRAVACAO_MS)}, true), set_config('statement_timeout', ${String(PRAZO_DA_GRAVACAO_MS)}, true)`,
+      sql`select set_config('statement_timeout', ${String(PRAZO_DA_GRAVACAO_MS)}, true)`,
```

O `statement_timeout` da transação: sai, e o da API (2 s) corta a espera antes do `lock_timeout`.

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › J13
-      sql`select set_config('lock_timeout', ${String(ESPERA_MAXIMA_DA_GRAVACAO_MS)}, true), set_config('statement_timeout', ${String(PRAZO_DA_GRAVACAO_MS)}, true)`,
+      sql`select set_config('lock_timeout', ${String(ESPERA_MAXIMA_DA_GRAVACAO_MS)}, true)`,
```

O service deixa de limitar a espera: sem `lock_timeout` nem `statement_timeout` próprio.

```mutacao
arquivo: apps/api/src/semana/aulas.service.ts
teste: apps/api/test/aulas.int.test.ts › J13
-        await aulas.limitarEspera()
```

O vínculo da professora: a escola sai da conferência (o vínculo da escola B, com o usuário e o ano do token, vale).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › a cláusula de escola e de ano do vínculo
      .where(
        and(
-          eq(vinculo.escolaId, requireEscolaId()),
```

O vínculo da professora: o ano sai da conferência (o vínculo do ano planejado vale).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › a cláusula de escola e de ano do vínculo
-          eq(vinculo.anoLetivoId, requireAnoEmCurso()),
```

O vínculo da professora: o id sai (o vínculo confirmado dela serve de chave para o pendente, que tem alocação).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › R1:
-          eq(vinculo.id, vinculoId),
```

O vínculo da professora: a professora da sessão sai (o vínculo da colega vale).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › R1:
-          eq(vinculo.usuarioId, requestSessao().usuarioId),
```

O vínculo da professora: o papel sai (o vínculo de aluno do mesmo usuário vale).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › R1:
-          eq(vinculo.papel, 'professor'),
```

O vínculo da professora: o estado sai (o pendente, o contestado e o encerrado valem).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › R1:
-          eq(vinculo.estado, 'confirmado'),
```

O vínculo da professora: a resposta passa a ser sempre `true`.

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › R1:
-    return achado !== undefined
+    return true
```

A trava do vínculo: o comando que a pega deixa de pegá-la.

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › J13
-      sql`select pg_advisory_xact_lock(${CHAVE_DA_TRAVA_DO_VINCULO_DA_AULA}, hashtext(${requireEscolaId()}::uuid::text || ${vinculoId}::uuid::text))`,
+      sql`select 1`,
```

A chave da trava: a escola sai dela (a presa só pelo vínculo faz a gravação da B esperar).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › R1b
-      sql`select pg_advisory_xact_lock(${CHAVE_DA_TRAVA_DO_VINCULO_DA_AULA}, hashtext(${requireEscolaId()}::uuid::text || ${vinculoId}::uuid::text))`,
+      sql`select pg_advisory_xact_lock(${CHAVE_DA_TRAVA_DO_VINCULO_DA_AULA}, hashtext(${vinculoId}::uuid::text))`,
```

O service deixa de pegar a trava do vínculo.

```mutacao
arquivo: apps/api/src/semana/aulas.service.ts
teste: apps/api/test/aulas.int.test.ts › J13
-        await aulas.travarVinculo(vinculoId)
```

A ordem "confere, depois trava": a trava vem antes da conferência (a colega espera a trava do dono).

```mutacao
arquivo: apps/api/src/semana/aulas.service.ts
teste: apps/api/test/aulas.int.test.ts › R1b \(a\)
-        if (!(await aulas.vinculoDaProfessora(vinculoId))) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
-        await aulas.travarVinculo(vinculoId)
+        await aulas.travarVinculo(vinculoId)
+        if (!(await aulas.vinculoDaProfessora(vinculoId))) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

O service deixa de conferir o vínculo.

```mutacao
arquivo: apps/api/src/semana/aulas.service.ts
teste: apps/api/test/aulas.int.test.ts › R1:
-        if (!(await aulas.vinculoDaProfessora(vinculoId))) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

O `for share` do ano sai do service: a gravação não espera a virada (J14).

```mutacao
arquivo: apps/api/src/semana/aulas.service.ts
teste: apps/api/test/aulas.int.test.ts › J14:
-        if (!(await new TurmaRepository(tx).travarAnoEmCurso())) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

O `if` do ano trava, mas não recusa o ano que deixou de estar em curso.

```mutacao
arquivo: apps/api/src/semana/aulas.service.ts
teste: apps/api/test/aulas.int.test.ts › o ano que deixa de estar em curso
-        if (!(await new TurmaRepository(tx).travarAnoEmCurso())) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+        await new TurmaRepository(tx).travarAnoEmCurso()
```

O ano da aula: o id do ano em curso sai (o ano planejado, que cobre a data, vale).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › data no ano planejado
-      .where(and(eq(anoLetivo.escolaId, escolaId), eq(anoLetivo.id, anoLetivoId), lte(anoLetivo.inicio, data), gte(anoLetivo.fim, data)))
+      .where(and(eq(anoLetivo.escolaId, escolaId), lte(anoLetivo.inicio, data), gte(anoLetivo.fim, data)))
```

O ano da aula: o início do ano sai (a data antes do ano vale).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › data antes do início do ano
-      .where(and(eq(anoLetivo.escolaId, escolaId), eq(anoLetivo.id, anoLetivoId), lte(anoLetivo.inicio, data), gte(anoLetivo.fim, data)))
+      .where(and(eq(anoLetivo.escolaId, escolaId), eq(anoLetivo.id, anoLetivoId), gte(anoLetivo.fim, data)))
```

O ano da aula: o fim do ano sai (a data depois do ano vale).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › data depois do fim do ano
-      .where(and(eq(anoLetivo.escolaId, escolaId), eq(anoLetivo.id, anoLetivoId), lte(anoLetivo.inicio, data), gte(anoLetivo.fim, data)))
+      .where(and(eq(anoLetivo.escolaId, escolaId), eq(anoLetivo.id, anoLetivoId), lte(anoLetivo.inicio, data)))
```

A data fora do ano deixa de recusar.

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › data depois do fim do ano
-    if (noAno === undefined) return undefined
```

O feriado e o recesso: a escola sai (o feriado da escola B, plantado sobre o ano da A com `session_replication_role = replica`, que a FK composta não deixa existir, tira a aula da A).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › a cláusula de escola e de ano do vínculo
      .where(
        and(
-          eq(eventoCalendario.escolaId, escolaId),
```

O feriado e o recesso: o ano sai (o feriado do ano planejado tira a aula do ano em curso).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › o que não tira a aula
-          eq(eventoCalendario.anoLetivoId, anoLetivoId),
```

O feriado e o recesso: o tipo sai (o evento comum, "Conselho de classe", também tira a aula).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › o que não tira a aula
-          inArray(eventoCalendario.tipo, ['feriado', 'recesso']),
```

O feriado e o recesso: o recesso sai da lista.

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › data em recesso
-          inArray(eventoCalendario.tipo, ['feriado', 'recesso']),
+          inArray(eventoCalendario.tipo, ['feriado']),
```

O feriado e o recesso: o feriado sai da lista.

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › data em feriado
-          inArray(eventoCalendario.tipo, ['feriado', 'recesso']),
+          inArray(eventoCalendario.tipo, ['recesso']),
```

O período do evento: o início sai (o recesso que começa depois do dia tira a aula).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › o que não tira a aula
-          lte(eventoCalendario.inicio, data),
```

O período do evento: o fim sai (o feriado que acabou antes do dia tira a aula).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › o que não tira a aula
-          gte(eventoCalendario.fim, data),
```

O dia com feriado ou recesso deixa de recusar.

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › data em feriado
-    if (semAula !== undefined) return undefined
```

A alocação: a escola sai (a alocação plantada da escola B vale).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › a cláusula de escola e de ano do vínculo
      .where(
        and(
-          eq(alocacao.escolaId, escolaId),
```

A alocação: o ano sai (a alocação plantada do ano planejado vale).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › a cláusula de escola e de ano do vínculo
-          eq(alocacao.anoLetivoId, anoLetivoId),
```

A alocação: o vínculo sai (a alocação da colega, no mesmo dia e início, vale).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › dia da semana sem alocação do vínculo
-          eq(alocacao.vinculoId, vinculoId),
```

A alocação: o dia da semana sai (a alocação de outro dia do mesmo vínculo vale).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › dia da semana sem alocação do vínculo
-          eq(alocacao.diaSemana, sql`extract(isodow from ${data}::date)::int`),
```

A alocação: o início sai (a alocação de outro horário do mesmo dia vale).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › início que não é de alocação
-          eq(alocacao.inicio, inicio),
```

A aula da grade deixa de valer sozinha: o `fim` dela não sai, e a aula nova cai no registro passado.

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › grava o texto da aula da grade
-    if (naGrade !== undefined) return naGrade.fim
```

O registro passado: a escola sai (o registro plantado da escola B vale).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › a cláusula de escola e de ano do vínculo
      .where(
        and(
-          eq(aula.escolaId, escolaId),
```

O registro passado: o ano sai (o registro plantado do ano planejado vale).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › a cláusula de escola e de ano do vínculo
-          eq(aula.anoLetivoId, anoLetivoId),
```

O registro passado: o vínculo sai (o registro da colega, no mesmo dia e início, vale).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › o registro passado da colega
          eq(aula.anoLetivoId, anoLetivoId),
-          eq(aula.vinculoId, vinculoId),
```

O registro passado: a data sai (o registro dela em outra data, no mesmo início, vale).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › data futura sem alocação
          eq(aula.vinculoId, vinculoId),
-          eq(aula.data, data),
```

O registro passado: o início sai (o registro dela em outro início, na mesma data, vale).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › o registro passado dela em outro início
-          eq(aula.inicio, inicio),
```

O "passado": o registro de data futura sem alocação vale.

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › o "passado" é a cláusula
-          sql`${aula.data} < ${hoje}::date`,
```

O "passado": hoje passa a ser passado (`<` vira `<=`).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › hoje não é passado
-          sql`${aula.data} < ${hoje}::date`,
+          sql`${aula.data} <= ${hoje}::date`,
```

O relógio injetado: o service do módulo não recebe o relógio, e `hoje` é o da máquina.

```mutacao
arquivo: apps/api/src/semana/semana.module.ts
teste: apps/api/test/aulas.int.test.ts › hoje não é passado
-          useFactory: (banco: Database) => new AulasService(banco, opcoes.relogio),
+          useFactory: (banco: Database) => new AulasService(banco),
```

A aula sem `fim` não grava: o `if` que recusa a aula fora da regra sai.

```mutacao
arquivo: apps/api/src/semana/aulas.service.ts
teste: apps/api/test/aulas.int.test.ts › data em feriado
-        if (fim === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

O texto vazio deixa de apagar: vai para o upsert.

```mutacao
arquivo: apps/api/src/semana/aulas.service.ts
teste: apps/api/test/aulas.int.test.ts › G3:
-        if (texto === '') await aulas.apagar(vinculoId, data, inicio)
+        if (texto === null) await aulas.apagar(vinculoId, data, inicio)
```

O upsert: o texto sai do `set` (a segunda gravação não muda o texto).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › grava o texto da aula da grade
-        set: { conteudo: texto, fim, atualizadoEm: sql`now()` },
+        set: { fim, atualizadoEm: sql`now()` },
```

O upsert: o `fim` sai do `set` (a cópia velha do `fim` não volta ao da alocação).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › grava o texto da aula da grade
-        set: { conteudo: texto, fim, atualizadoEm: sql`now()` },
+        set: { conteudo: texto, atualizadoEm: sql`now()` },
```

O upsert: o `atualizadoEm` sai do `set`.

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › grava o texto da aula da grade
-        set: { conteudo: texto, fim, atualizadoEm: sql`now()` },
+        set: { conteudo: texto, fim },
```

O upsert: o `setWhere` da escola sai (o registro plantado da escola B é sobrescrito).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › a cláusula de escola e de ano do vínculo
-        setWhere: eq(aula.escolaId, escolaId),
```

O apagar: a escola sai (o registro plantado da escola B é apagado).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › a cláusula de escola e de ano do vínculo
-      .where(and(eq(aula.escolaId, requireEscolaId()), eq(aula.anoLetivoId, requireAnoEmCurso()), eq(aula.vinculoId, vinculoId), eq(aula.data, data), eq(aula.inicio, inicio)))
+      .where(and(eq(aula.anoLetivoId, requireAnoEmCurso()), eq(aula.vinculoId, vinculoId), eq(aula.data, data), eq(aula.inicio, inicio)))
```

O apagar: o ano sai (o registro plantado do ano planejado é apagado).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › a cláusula de escola e de ano do vínculo
-      .where(and(eq(aula.escolaId, requireEscolaId()), eq(aula.anoLetivoId, requireAnoEmCurso()), eq(aula.vinculoId, vinculoId), eq(aula.data, data), eq(aula.inicio, inicio)))
+      .where(and(eq(aula.escolaId, requireEscolaId()), eq(aula.vinculoId, vinculoId), eq(aula.data, data), eq(aula.inicio, inicio)))
```

O apagar: o vínculo sai (apaga também a aula da colega no mesmo dia e início).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › apagar uma aula não apaga outra
-      .where(and(eq(aula.escolaId, requireEscolaId()), eq(aula.anoLetivoId, requireAnoEmCurso()), eq(aula.vinculoId, vinculoId), eq(aula.data, data), eq(aula.inicio, inicio)))
+      .where(and(eq(aula.escolaId, requireEscolaId()), eq(aula.anoLetivoId, requireAnoEmCurso()), eq(aula.data, data), eq(aula.inicio, inicio)))
```

O apagar: a data sai (apaga a mesma aula de todas as datas).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › apagar uma aula não apaga outra
-      .where(and(eq(aula.escolaId, requireEscolaId()), eq(aula.anoLetivoId, requireAnoEmCurso()), eq(aula.vinculoId, vinculoId), eq(aula.data, data), eq(aula.inicio, inicio)))
+      .where(and(eq(aula.escolaId, requireEscolaId()), eq(aula.anoLetivoId, requireAnoEmCurso()), eq(aula.vinculoId, vinculoId), eq(aula.inicio, inicio)))
```

O apagar: o início sai (apaga também a outra aula do dia).

```mutacao
arquivo: packages/core/src/semana/aula.repository.ts
teste: apps/api/test/aulas.int.test.ts › apagar uma aula não apaga outra
-      .where(and(eq(aula.escolaId, requireEscolaId()), eq(aula.anoLetivoId, requireAnoEmCurso()), eq(aula.vinculoId, vinculoId), eq(aula.data, data), eq(aula.inicio, inicio)))
+      .where(and(eq(aula.escolaId, requireEscolaId()), eq(aula.anoLetivoId, requireAnoEmCurso()), eq(aula.vinculoId, vinculoId), eq(aula.data, data)))
```

A tradução do `55P03`: a condição vira o contrário (toda recusa vira `INDISPONIVEL_TENTE_DE_NOVO`).

```mutacao
arquivo: apps/api/src/semana/aulas.service.ts
teste: apps/api/test/aulas.int.test.ts › data em feriado
-      if (postgresErrorIn(erro)?.code === TRAVA_NAO_DISPONIVEL) throw new DomainException(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, undefined, DEFAULT_RETRY_AFTER_SECONDS)
+      if (postgresErrorIn(erro)?.code !== TRAVA_NAO_DISPONIVEL) throw new DomainException(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, undefined, DEFAULT_RETRY_AFTER_SECONDS)
```

A tradução do `55P03`: sai (a espera vence em `TEMPO_ESGOTADO` ou erro cru).

```mutacao
arquivo: apps/api/src/semana/aulas.service.ts
teste: apps/api/test/aulas.int.test.ts › J13
-      if (postgresErrorIn(erro)?.code === TRAVA_NAO_DISPONIVEL) throw new DomainException(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, undefined, DEFAULT_RETRY_AFTER_SECONDS)
```

O erro que não é da trava volta a sair: o `throw erro` sai (a recusa é engolida e a rota responde 200).

```mutacao
arquivo: apps/api/src/semana/aulas.service.ts
teste: apps/api/test/aulas.int.test.ts › data em feriado
-      throw erro
```

A resposta do texto vazio: `texto: null` vira o texto vazio.

```mutacao
arquivo: apps/api/src/semana/aulas.service.ts
teste: apps/api/test/aulas.int.test.ts › G3:
-    return gravarAulaResponseSchema.parse({ vinculoId, data, inicio, texto: texto === '' ? null : texto })
+    return gravarAulaResponseSchema.parse({ vinculoId, data, inicio, texto })
```

O contrato do corpo: o controller deixa de validar com o contrato estrito.

```mutacao
arquivo: apps/api/src/semana/aulas.controller.ts
teste: apps/api/test/aulas.int.test.ts › o contrato é estrito
-  gravar(@Body(new ZodValidationPipe(gravarAulaRequestSchema)) corpo: GravarAulaRequest): Promise<GravarAulaResponse> {
+  gravar(@Body() corpo: GravarAulaRequest): Promise<GravarAulaResponse> {
```

**Sem bloco, com o motivo.** (1) `@RequirePermissao('aula', 'gravar')` do controller: a linha da matriz de `aula.gravar` é igual à de `aula.ler`, e tirar o decorador derruba o boot (a guarda de rota sem permissão), que é erro de carga e não um caso vermelho; a recusa da coordenação e do aluno é o R7, que passa pela matriz. (2) A escola da consulta do ano em `fimDaAulaGravavel` (`eq(anoLetivo.escolaId, escolaId)`): o id do ano é chave primária global, e o ano do contexto já é o da escola; a cláusula repete a regra 10, item 3, como no `anoEmCurso` da 2.0. (3) A constante `CHAVE_DA_TRAVA_DO_VINCULO_DA_AULA` (7_000_004): é o nome da classe, e o teste a importa; a prova de que não repete outra é o `grep 7_000_00` do documento. (4) As linhas de `requireEscolaId()` de `limitarEspera`, `gravar` e `fimDaAulaGravavel` só dão o escopo às consultas que a mesma função faz, e cada consulta tem o seu bloco acima. (5) O `.limit(1)` das conferências: só corta a leitura, e o `[achado]` é o mesmo com ou sem ele.

--faltando: 0 linhas (0 blocos, 5 motivos)

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | Conferir a contagem de linhas afetadas no upsert e responder `NAO_ENCONTRADO` se for zero | Recusada: muda comportamento, e a situação é inalcançável (a FK composta recusa a linha, provado em `o setWhere da escola no on conflict é inalcançável…`). O comentário do `gravar` registra o limite |
| tenancy-guardian (1ª) | `eq(anoLetivo.escolaId, escolaId)` em `fimDaAulaGravavel` sem mutação; plantar ano de outra escola com o mesmo id se a 5.0 reaproveitar | Tarefa 5.0, se ela reaproveitar `fimDaAulaGravavel`. A tarefa 4.0 já escreve o motivo da ausência da mutação, e o revisor diz "pode ficar como está" |
| conformidade-reviewer (1ª) | Na 7.0, a ausência de texto da aula não vira contagem, lista nominal nem alerta por professor para a coordenação | Tarefa 7.0 (painel): RF e Tech Spec já dizem "nenhuma contagem" e "selo por aula, sem total" (regra 70, itens 8 e 9) |
| conformidade-reviewer (1ª) | Se um agente ler o texto da aula, a leitura passa pela porta de IA e declara a autonomia em governança | Tarefa que criar essa leitura; esta não faz |
| privacy-guardian (1ª) | Comentário no schema: `trim()` do JS apara mais que o `btrim` da checagem `aula_conteudo_preenchido` | `TODO.md`: o schema é da 1.0 e esta tarefa não o toca |
| privacy-guardian (1ª) | Tela da 7.0: a orientação de não escrever nome de aluno junto do campo de texto | Tarefa 7.0 (tela); o `frontend-reviewer` e o `privacy-guardian` conferem nas fotos |
| infra-guardian (1ª) | Salvamento automático da tela com debounce e sem dois `PUT` simultâneos da mesma aula | Tarefa 7.0 (tela) |
| infra-guardian (1ª) | Derivar o `statement_timeout` de `BANCO_TIMEOUT_CONSULTA_MS` | Recusada: a Tech Spec §5 e §7c fixa os 3 s, e a divergência está registrada nos três lugares; derivar muda o contrato de tempo |
| infra-guardian (1ª) | Runbook: virada do ano em horário de aula gera onda de `INDISPONIVEL_TENTE_DE_NOVO` na Semana | `TODO.md`: `docs/runbook.md` não é desta tarefa; o dono é o Arquiteto, na retro |
| revisor-geral (1ª) | Constante compartilhada do `55P03` em `packages/core/src/db` (a quarta cópia local) | `TODO.md`: toca `migrate.ts`, `motor.ts` e `importacao.repository.ts`, fora dos arquivos da tarefa |
| test-engineer (1ª) | R4 com a rota de confirmar em vez de `update` direto | Recusada: o caso prova a regra do `PUT`; a rota de confirmar é de outro módulo e acrescentaria dependência sem provar nada a mais aqui |
| test-engineer (1ª) | Caso da professora com duas disciplinas na mesma turma (dois vínculos confirmados) | `TODO.md`: "se for barato" exige fixture nova (segundo vínculo na mesma turma); a chave `vinculo_id` já é provada pela colega e pelos vínculos dos outros estados. Tarefa 5.0, que mexe em mais de um vínculo por professora, é o lugar natural |
| test-engineer (2ª) | Segundo bloco da mutação do estado `confirmado`, citando `R4, o PUT`, para mostrar que é a única barreira do antecessor | Recusada: o bloco existente cita `R1`, que já mata a mutação do estado; o revisor diz "melhora a cobertura, mas não bloqueia" |
| test-engineer (2ª), tenancy-guardian (2ª), infra-guardian (2ª) | `esperandoNaTravaDoVinculo` conta o banco inteiro e depende de `fileParallelism: false`; filtrar pelo `objid` do caso | Recusada como destino "tarefa 5.0": o `objid` não está no `TODO.md` nem no `5_task.md`; o ajuste fica só no comentário de `esperandoNaTravaDoVinculo` em `apps/api/test/aulas.int.test.ts`, no arquivo que a 5.0 vai estender, e ele já registra a dependência (item 7 da ordem da rodada 1) |
| infra-guardian (2ª) | As datas fixas (`2026-11-02`, `2026-11-09`) viram passado com o tempo; confirmar que a regra usa um `Clock` fixo | Recusada: o teste fixa o relógio da API em 2026-11-04, como o `tenancy-guardian` e o `test-engineer` (2ª) conferiram |
| conformidade-reviewer (2ª) | A 7.0 não pode contar a falta de texto; a leitura do texto por agente passa pela porta de IA | Repetida da 1ª rodada, já na tabela (tarefa 7.0 e a tarefa que criar a leitura) |
| privacy-guardian (2ª) | A orientação de não escrever nome de aluno ao lado do campo de texto | Repetida da 1ª rodada, já na tabela (tarefa 7.0) |
| revisor-geral (3ª) | `4_task.md`: "aparta" no lugar de "apara" na linha do `trim()` contra o `btrim` | Aplicada: é grafia numa linha do próprio documento, sem código, e não pede rodada |
| revisor-geral (3ª) | Conferir que o `5_task.md` cita o filtro pelo `objid` do caso no `esperandoNaTravaDoVinculo` | Recusada como destino "tarefa 5.0": o `objid` não está no `TODO.md` nem no `5_task.md` (conferido), e o ajuste fica só no comentário de `esperandoNaTravaDoVinculo` em `apps/api/test/aulas.int.test.ts`, no arquivo que a 5.0 vai estender |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-06 21:12:02 | 2026-11-06 21:12:30 | `tenancy-guardian` | 1 | APROVADO | ad956da3e08833ac8 |
| 2026-11-06 21:12:09 | 2026-11-06 21:12:35 | `conformidade-reviewer` | 1 | APROVADO | a0f587e163150e4c5 |
| 2026-11-06 21:12:03 | 2026-11-06 21:13:02 | `privacy-guardian` | 1 | APROVADO | a863b41da4b475fc2 |
| 2026-11-06 21:12:08 | 2026-11-06 21:13:09 | `revisor-geral` | 1 | APROVADO | a477abc2a024fbcc2 |
| 2026-11-06 21:12:05 | 2026-11-06 21:13:19 | `infra-guardian` | 1 | APROVADO | a7bbdd1ee0c612394 |
| 2026-11-06 21:12:06 | 2026-11-06 21:15:39 | `test-engineer` | 1 | APROVADO | a9e5276dad58611f7 |
| 2026-11-06 21:34:12 | 2026-11-06 21:34:38 | `privacy-guardian` | 2 | APROVADO | ae78a0e3ed43328e8 |
| 2026-11-06 21:34:06 | 2026-11-06 21:34:46 | `tenancy-guardian` | 2 | APROVADO | ac16852ea8c3ebe9b |
| 2026-11-06 21:34:37 | 2026-11-06 21:34:59 | `conformidade-reviewer` | 2 | APROVADO | ae717d4e748d7a9b9 |
| 2026-11-06 21:34:18 | 2026-11-06 21:35:18 | `infra-guardian` | 2 | APROVADO | a95808213816461d4 |
| 2026-11-06 21:34:31 | 2026-11-06 21:35:19 | `revisor-geral` | 2 | REPROVADO | a95b0f1bf9a83399b |
| 2026-11-06 21:34:24 | 2026-11-06 21:35:28 | `test-engineer` | 2 | APROVADO | a6ac34f14c77d2fac |
| 2026-11-06 21:56:32 | 2026-11-06 21:56:48 | `revisor-geral` | 3 | APROVADO | a292e8524c74cd1ae |
