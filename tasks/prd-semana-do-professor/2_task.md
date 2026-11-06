# Tarefa 2.0 — A professora vê a semana dela (`GET /v1/semana`)

**Funcionalidade:** semana-do-professor · **Depende de:** 1.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `test-engineer`
**Porte:** grande

## Objetivo

`GET /v1/semana?segunda=` devolve as aulas da professora na escola do token e no ano em curso, com feriado e recesso fora,
os registros e o fora da grade passado; `itens` vazio até a 3.0.

## Contexto necessário

- `techspec.md` seções 4, 5 ("Ler"), 6, 7; `cenarios.md` "Leitura", R2, R3, R4, R7; `prd.md` RF1 a RF4, RF9, RF10, RF12
- `packages/core/src/importacao/grade.repository.ts` e `calendario.repository.ts`: consultas com escopo
- `apps/api/src/app.module.ts:64` (`relogioDaPrivacidade`): o jeito de injetar relógio para o S13

## Subtarefas

- [x] 2.1 — `packages/shared/src/semana/`: contrato estrito das duas rotas (seção 4), `TAMANHO_MAXIMO_DO_TEXTO_DA_AULA = 500` e a tabela de rótulos dos tipos e estados dos itens
- [x] 2.2 — `SemanaRepository`: as quatro primeiras consultas da seção 5, "Ler"
- [x] 2.3 — A montagem dos dias, função pura no `apps/api/src/semana/`, no `FUSO_DO_USO`; sem ano em curso, `ano: null` e nenhum dia
- [x] 2.4 — Controller, service, módulo e relógio injetável
- [x] 2.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/shared/src/semana/semana.ts`, `packages/shared/src/semana/semana.test.ts` | novo |
| `packages/shared/src/index.ts` | alterado |
| `packages/core/src/semana/semana.repository.ts`, `packages/core/src/semana/index.ts` | novo |
| `packages/core/src/index.ts` | alterado |
| `apps/api/src/semana/semana.module.ts`, `apps/api/src/semana/semana.controller.ts`, `apps/api/src/semana/semana.service.ts`, `apps/api/src/semana/montar-dias.ts`, `apps/api/src/semana/montar-dias.test.ts` | novo |
| `apps/api/src/app.module.ts` | alterado |
| `apps/api/test/semana.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| S1 | integração | só `confirmado` gera aula | `apps/api/test/semana.int.test.ts` › S1 |
| S2 | integração | fim de semana; ordem | `apps/api/test/semana.int.test.ts` › S2 (o dia e a ordem do horário); `apps/api/src/semana/montar-dias.test.ts` › S2 e › a ordem do dia |
| S3 | integração | feriado tira, evento não | `apps/api/test/semana.int.test.ts` › S3 |
| S4 | integração | recesso por cruzamento | `apps/api/test/semana.int.test.ts` › S4 |
| evento que termina no domingo anterior, e o que começa na segunda seguinte, não entram | integração | as duas metades do cruzamento | `apps/api/test/semana.int.test.ts` › o cruzamento tem as duas metades (1ª asserção: o que acaba na segunda e o que começa no domingo; 2ª: o que acabou no domingo anterior e o que começa na segunda seguinte) |
| S5 | integração | só os dias do ano | `apps/api/test/semana.int.test.ts` › S5 |
| S6, parte do `GET` | integração | `ano: null` | `apps/api/test/semana.int.test.ts` › S6, o GET |
| S7, parte do `GET`; registro do ano anterior inserido direto não volta | integração | filtro, não o `delete` | `apps/api/test/semana.int.test.ts` › S7, o GET |
| vínculo confirmado no ano anterior, com alocação e registro, não gera aula | integração | o ano | `apps/api/test/semana.int.test.ts` › o vínculo confirmado do ano anterior |
| aula de colega confirmado da mesma turma não aparece | integração | o `usuarioId` | `apps/api/test/semana.int.test.ts` › S12 (a aula do colega e o texto dele) |
| S8 | integração | vínculo encerrado | `apps/api/test/semana.int.test.ts` › S8 |
| S11 | integração | duas disciplinas | `apps/api/test/semana.int.test.ts` › S11 |
| S12 | integração | turma sem professor | `apps/api/test/semana.int.test.ts` › S12 (a turma sem professor) |
| S13 | integração | `hoje` e `agora` em Brasília | `apps/api/test/semana.int.test.ts` › S13 |
| S14, servidor | unidade | a montagem, com o fora da grade de hoje e futuro fora | `apps/api/src/semana/montar-dias.test.ts` › S14 (o fora da grade, o dia de hoje, o futuro) e › S14: o registro passado fora da grade num sábado |
| S15 | unidade | rótulos numa tabela só | `packages/shared/src/semana/semana.test.ts` › S15 |
| S16, parte do `GET` | integração | aula dupla | `apps/api/test/semana.int.test.ts` › S16, o GET |
| `gradeImportada` false em A, B com grade (S17) | integração | o valor por rota; o escopo da cláusula é provado pelo caso do repository (`o repository só devolve a escola do contexto`), não por este | `apps/api/test/semana.int.test.ts` › `gradeImportada` e `calendarioImportado` são da escola do token (1ª asserção: a escola sem grade, com a B completa); › `gradeImportada` olha a escola e não a professora (2ª metade: a professora sem aula, numa escola com grade, vê `true` e a semana vazia) |
| `calendarioImportado` false em A, B com calendário; as aulas de A aparecem | integração | escopo, pela rota (o feriado e o evento da B não tiram nem aparecem na A) | `apps/api/test/semana.int.test.ts` › o `calendarioImportado` e as aulas da A seguem a A |
| `ano` é o de A, B com outras datas | integração | o valor por rota (a B nem tem ano em curso); o escopo do ano é provado pelo caso `o repository do ano em curso`, não por este | `apps/api/test/semana.int.test.ts` › o `ano` é o da escola do token |
| G7 e, pela rota, `segunda` que não é segunda e campo a mais: `ENTRADA_INVALIDA` | unidade e integração | contrato estrito | `packages/shared/src/semana/semana.test.ts` › G7: a consulta (e o corpo); `apps/api/test/semana.int.test.ts` › G7, pela rota |
| chaves exatas da aula, sem e-mail, nome de professor nem `atualizadoEm` | integração | DTO | `apps/api/test/semana.int.test.ts` › o DTO |
| R2, aulas e registros | integração | duas escolas | `apps/api/test/semana.int.test.ts` › R2 |
| R3 | integração | eventos da B | `apps/api/test/semana.int.test.ts` › o `calendarioImportado` e as aulas da A seguem a A (R3) |
| R4, parte do `GET` | integração | substituto e antecessor | `apps/api/test/semana.int.test.ts` › R4 |
| R7, parte do `GET` | integração | coordenação e aluno recusados | `apps/api/test/semana.int.test.ts` › R7 |

O filtro de ano dos registros e o `papel = professor` não ficam vermelhos com dado nenhum: registre a redundância nas
Mutações, sem bloco verde.

## Como testar

- Leitura do professor com vínculos em estados: `apps/api/test/calendario.int.test.ts › professor sem vínculo confirmado (pendente, encerrado, só no ano planejado ou nenhum)…`
- Isolamento de repository: `apps/api/test/calendario.int.test.ts:152`
- Grade: `executarPlanilha`, como em `apps/api/test/grade.int.test.ts` (o R4 pela reimportação real)
- Relógio: como `relogio` em `apps/api/test/arquivo-do-titular.int.test.ts:71`
- Comando: `npx vitest run --project integracao apps/api/test/semana.int.test.ts`
- Armadilha (retro da F2, grupo E): todo id do caso de isolamento é da B

## Autoconferência

As 12 perguntas do modelo, respondidas no plano (`achados/indice.md` já tem a 1.0: as recomendações dela para a 2.0 estão em "Recomendações sem aplicar" da `1_task.md`).

1. **Mutação de cada cláusula:** seção "Mutações". Cobre cada termo das condições de `montar-dias.ts` (os dias do ano, o cruzamento do evento, o
   feriado e o recesso contra o evento, o dia da semana e o vínculo da alocação e do registro, o `hoje`, a alocação do mesmo vínculo e do mesmo
   início, o fim de semana, o `??` do texto, a chave do texto, as três chaves da ordem), cada cláusula de `where` do repository (escola, ano,
   vínculos pedidos, estado, professora da sessão, os dois limites da semana, os dois da grade e do calendário importados), os dois `if` de lista
   vazia, o `if` do ano ausente, o relógio injetado no `AppModule`, o `?? null` do ano, o formato `HH:MM` e o rótulo do item.
2. **Texto na tela:** a tarefa não tem tela.
3. **Segundo dado:** o vínculo em cada estado (S1), a colega confirmada na mesma turma (S12 e o caso do repository), o ano planejado com evento e
   alocação (o repository lê só o do ano), o registro da semana anterior, da seguinte, do domingo e da segunda (os limites), o evento que acaba na
   segunda e o que começa no domingo (os dois lados do cruzamento), a escola B com calendário, grade e registro (R2, R3).
4. **Checagem anterior:** nenhuma rota usa `requireAnoEmCurso()`; o `GET` responde 200 com `ano: null` (S6) em vez de `NAO_ENCONTRADO`. A recusa da
   coordenação e do aluno vem da matriz antes do controller (R7). O `segunda` inválido cai no pipe antes do service (G7).
5. **Resultado, não forma:** todo caso lê o corpo da resposta (datas, aulas, texto); nenhum lê texto de arquivo. O DTO compara as chaves exatas.
6. **Guarda nova:** não há guarda nova. As existentes (`repositories-com-escopo`, `tabela-so-no-repository`, `erro-tipado`, o boot da permissão) rodam no portão.
7. **Comentários:** o docblock do repository diz que nenhum método recebe escola nem usuário, e é verdade; o `anoEmCurso` lê o ano do contexto e confere
   escola e situação. O docblock do `montar-dias.ts` diz que os itens entram na 3.0: o campo vai vazio, e o teste `os itens do dia vão vazios` o prende.
8. **Divergência que muda regra:** duas linhas, ambas de definição (o que é `gradeImportada`/`calendarioImportado`, e o glossário). Estão na
   `techspec.md` §5 e no `cenarios.md` S17, e o grep da palavra do código acha as duas.
9. **Peça que já existe:** o contrato segue o `gradeQuerySchema`; o repository, o `GradeRepository` e o `CalendarioRepository`; o relógio, o
   `relogioDaPrivacidade`; o fuso, `FUSO_DO_USO` e `diaDeUso` do `core`. A hora `HH:MM` é a única peça nova (não havia no `core`) e fica no service.
10. **Concorrência:** a tarefa só lê, sem trava nem transação. A gravação, a trava consultiva e a corrida com a virada são da 4.0 e da 5.0.
11. **Isolamento sem a cláusula:** o caso `o repository só devolve a escola do contexto` passa só ids da B no contexto da A (ano, vínculo), e o
    contexto da B confere o `calendarioImportado` do ano planejado dela. A tabela de testes tem a coluna "Caso" preenchida.
12. **Guardiões:** `tenancy-guardian` (escola e ano em todo `where`, professora da sessão, id da B no contexto da A, a mesma resposta para colega,
    antecessor e outra escola), `privacy-guardian` (o texto só sai para a dona do vínculo, sem e-mail nem nome, nunca em log), `test-engineer`.

## Fora do escopo desta tarefa

Itens (3.0), `PUT` (4.0), telas.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| `gradeImportada` é "a escola tem alguma alocação no ano em curso" e `calendarioImportado`, "a escola tem algum evento no ano em curso" (da escola, não da professora); `agora` é `HH:MM`; `dias` traz só os dias do ano, com sábado e domingo só quando a grade (ou um registro passado) tem aula neles | a Tech Spec lista os campos e não os define; o RF12 precisa distinguir "a coordenação não importou a grade" de "sem aulas nesta semana" | `techspec.md` §5, "Ler", último parágrafo; `cenarios.md` S17 (e S2, S13 para o fim de semana e o `agora`) |
| `docs/glossario.md` ganha "Semana (do professor)" e "Fora da grade" | nomes novos no código (`foraDaGrade`, `SemanaRepository`) pedem o vocabulário (regra 60, item 1) | `techspec.md` §2, última linha da tabela (`docs/glossario.md`) |

## Mutações

**Sem bloco, com o motivo.** (1) O `if (typeof anoLetivoId !== 'string') return null` de `anoEmCurso` serve ao tipo (`string | null | undefined`): sem
ele, a consulta com `null` não acha linha e devolve o mesmo `null` (mutação rodada, ficou verde). (2) As guardas de lista vazia de
`alocacoesDosVinculos` e `registrosDosVinculos` saíram: o `inArray` do Drizzle com lista vazia vira `false`, e a professora sem vínculo é o caso
`gradeImportada olha a escola e não a professora`. (3) O filtro de ano dos registros e dos vínculos não fica vermelho por rota com dado nenhum (o
vínculo do ano anterior já sai pelo ano do vínculo e pelo da alocação); os blocos deles chamam o repository com o ano trocado, que é o que a camada
própria promete. (4) A chave de desempate por `id` da ordem do dia não existe: duas aulas da mesma professora na mesma turma, disciplina e hora não
cabem no mesmo vínculo (`vinculo_ativo_unico`). A escola e o papel de `vinculosDaProfessora` **têm** bloco: o contexto da escola A com o usuário e o ano
da B (a FK `vinculo_usuario_da_escola_fk` só prende o vínculo à escola do usuário, e não o contexto à dele), e o vínculo `aluno` com disciplina inserido
direto no mesmo usuário (o `vinculo_papel_valido` não compara o papel do vínculo com o do usuário).

--faltando: 1 linhas (58 blocos, 1 motivo: o `typeof` de `anoEmCurso`, item 1 acima)

O relógio injetado: sem ele, `hoje` e `agora` são os da máquina.

```mutacao
arquivo: apps/api/src/app.module.ts
teste: apps/api/test/semana.int.test.ts › S13
-        SemanaModule.forRoot(opcoes.relogioDaSemana === undefined ? {} : { relogio: opcoes.relogioDaSemana }),
+        SemanaModule.forRoot(),
```

Domingo: o `getUTCDay` 0 deixa de virar 7.

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/src/semana/montar-dias.test.ts › aritmética de calendário
falha: diaDaSemanaDe('2026-11-08')).toBe(7)
-  return dom0 === 0 ? 7 : dom0
+  return dom0
```

Ordem do dia: o horário sai da comparação.

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/src/semana/montar-dias.test.ts › a ordem do dia
-  a.inicio.localeCompare(b.inicio) || a.vinculo.turma.localeCompare(b.vinculo.turma) || a.vinculo.disciplina.localeCompare(b.vinculo.disciplina)
+  a.vinculo.turma.localeCompare(b.vinculo.turma) || a.vinculo.disciplina.localeCompare(b.vinculo.disciplina)
```

Ordem do dia: a turma sai da comparação.

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/src/semana/montar-dias.test.ts › a ordem do dia
-  a.inicio.localeCompare(b.inicio) || a.vinculo.turma.localeCompare(b.vinculo.turma) || a.vinculo.disciplina.localeCompare(b.vinculo.disciplina)
+  a.inicio.localeCompare(b.inicio) || a.vinculo.disciplina.localeCompare(b.vinculo.disciplina)
```

Ordem do dia: a disciplina sai da comparação.

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/src/semana/montar-dias.test.ts › a ordem do dia
-  a.inicio.localeCompare(b.inicio) || a.vinculo.turma.localeCompare(b.vinculo.turma) || a.vinculo.disciplina.localeCompare(b.vinculo.disciplina)
+  a.inicio.localeCompare(b.inicio) || a.vinculo.turma.localeCompare(b.vinculo.turma)
```

Os dias do ano: o fim sai (os dias depois do ano passam a aparecer).

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/src/semana/montar-dias.test.ts › S5
-    if (data < entrada.ano.inicio || data > entrada.ano.fim) continue
+    if (data < entrada.ano.inicio) continue
```

Os dias do ano: o início sai (os dias antes do ano passam a aparecer).

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/test/semana.int.test.ts › S5: a semana que atravessa
falha: '2026-01-26')).dias
-    if (data < entrada.ano.inicio || data > entrada.ano.fim) continue
+    if (data > entrada.ano.fim) continue
```

Evento do dia: o início do evento sai (o evento de amanhã vale hoje).

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/src/semana/montar-dias.test.ts › S3
-    const eventos = entrada.eventos.filter((evento) => evento.inicio <= data && data <= evento.fim)
+    const eventos = entrada.eventos.filter((evento) => data <= evento.fim)
```

Evento do dia: o fim do evento sai (o evento de ontem vale hoje).

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/src/semana/montar-dias.test.ts › S3
-    const eventos = entrada.eventos.filter((evento) => evento.inicio <= data && data <= evento.fim)
+    const eventos = entrada.eventos.filter((evento) => evento.inicio <= data)
```

A aula da grade: o dia da semana sai (toda alocação vale todo dia).

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/src/semana/montar-dias.test.ts › S2
-      return vinculo !== undefined && alocacao.diaSemana === diaDaSemana ? [{ vinculo, alocacao }] : []
+      return vinculo !== undefined ? [{ vinculo, alocacao }] : []
```

A aula da grade: o vínculo deixa de ser conferido (a alocação de outro vínculo vira aula).

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/src/semana/montar-dias.test.ts › a alocação de um vínculo que não é da professora
falha: expect(dias.flatMap((dia) => dia.aulas)).toEqual([])
-      return vinculo !== undefined && alocacao.diaSemana === diaDaSemana ? [{ vinculo, alocacao }] : []
+      return alocacao.diaSemana === diaDaSemana ? [{ vinculo: vinculo ?? entrada.vinculos[0], alocacao }] : []
```

O registro do dia: a data sai (o registro de outro dia vale todo dia).

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/src/semana/montar-dias.test.ts › S14: o fora da grade passado
-      return vinculo !== undefined && registro.data === data ? [{ vinculo, registro }] : []
+      return vinculo !== undefined ? [{ vinculo, registro }] : []
```

O registro do dia: o vínculo deixa de ser conferido.

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/src/semana/montar-dias.test.ts › feriado esconde também o registro fora da grade
falha: expect(dias.flatMap((dia) => dia.aulas)).toEqual([])
-      return vinculo !== undefined && registro.data === data ? [{ vinculo, registro }] : []
+      return registro.data === data ? [{ vinculo: vinculo ?? entrada.vinculos[0], registro }] : []
```

Fora da grade: hoje passa a contar como passado.

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/src/semana/montar-dias.test.ts › S14: o fora da grade passado
falha: expect(aulasDe('2026-11-04')).toEqual([])
-      ({ registro }) => registro.data < entrada.hoje && !daGrade.some(({ alocacao }) => alocacao.vinculoId === registro.vinculoId && alocacao.inicio === registro.inicio),
+      ({ registro }) => registro.data <= entrada.hoje && !daGrade.some(({ alocacao }) => alocacao.vinculoId === registro.vinculoId && alocacao.inicio === registro.inicio),
```

Fora da grade: o futuro passa a contar como passado.

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/src/semana/montar-dias.test.ts › S14: o fora da grade passado
-      ({ registro }) => registro.data < entrada.hoje && !daGrade.some(({ alocacao }) => alocacao.vinculoId === registro.vinculoId && alocacao.inicio === registro.inicio),
+      ({ registro }) => !daGrade.some(({ alocacao }) => alocacao.vinculoId === registro.vinculoId && alocacao.inicio === registro.inicio),
```

Fora da grade: o registro que tem alocação também vira fora da grade (duplica a aula).

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/src/semana/montar-dias.test.ts › S14: o registro com alocação do mesmo início
-      ({ registro }) => registro.data < entrada.hoje && !daGrade.some(({ alocacao }) => alocacao.vinculoId === registro.vinculoId && alocacao.inicio === registro.inicio),
+      ({ registro }) => registro.data < entrada.hoje,
```

Fora da grade: a alocação de outro vínculo no mesmo horário esconde o registro.

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/src/semana/montar-dias.test.ts › S14: o registro passado fora da grade não some
-      ({ registro }) => registro.data < entrada.hoje && !daGrade.some(({ alocacao }) => alocacao.vinculoId === registro.vinculoId && alocacao.inicio === registro.inicio),
+      ({ registro }) => registro.data < entrada.hoje && !daGrade.some(({ alocacao }) => alocacao.inicio === registro.inicio),
```

Fora da grade: qualquer alocação do mesmo vínculo no dia esconde o registro.

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/src/semana/montar-dias.test.ts › S14: o registro passado fora da grade não some
-      ({ registro }) => registro.data < entrada.hoje && !daGrade.some(({ alocacao }) => alocacao.vinculoId === registro.vinculoId && alocacao.inicio === registro.inicio),
+      ({ registro }) => registro.data < entrada.hoje && !daGrade.some(({ alocacao }) => alocacao.vinculoId === registro.vinculoId),
```

Fim de semana: todo dia sem aula some (a segunda sem aula também).

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/src/semana/montar-dias.test.ts › S2
-    if (diaDaSemana > 5 && daGrade.length === 0 && foraDaGrade.length === 0) continue
+    if (daGrade.length === 0 && foraDaGrade.length === 0) continue
```

Fim de semana: a aula da grade deixa de abrir o sábado.

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/src/semana/montar-dias.test.ts › S2
-    if (diaDaSemana > 5 && daGrade.length === 0 && foraDaGrade.length === 0) continue
+    if (diaDaSemana > 5 && foraDaGrade.length === 0) continue
```

Fim de semana: o registro passado fora da grade deixa de abrir o sábado.

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/src/semana/montar-dias.test.ts › S14: o registro passado fora da grade num sábado
-    if (diaDaSemana > 5 && daGrade.length === 0 && foraDaGrade.length === 0) continue
+    if (diaDaSemana > 5 && daGrade.length === 0) continue
```

O recesso deixa de tirar a aula.

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/test/semana.int.test.ts › S4
falha: lida.dias.flatMap((dia) => dia.aulas)
-    const semAula = eventos.some((evento) => evento.tipo === 'feriado' || evento.tipo === 'recesso')
+    const semAula = eventos.some((evento) => evento.tipo === 'feriado')
```

O feriado deixa de tirar a aula.

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/test/semana.int.test.ts › S3
falha: expect(aulasDe(lida, '2026-11-03')).toEqual([])
-    const semAula = eventos.some((evento) => evento.tipo === 'feriado' || evento.tipo === 'recesso')
+    const semAula = eventos.some((evento) => evento.tipo === 'recesso')
```

Qualquer evento passa a tirar a aula (o Conselho de classe também).

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/test/semana.int.test.ts › S3
falha: aulasDe(lida, '2026-11-04')).toHaveLength(1)
-    const semAula = eventos.some((evento) => evento.tipo === 'feriado' || evento.tipo === 'recesso')
+    const semAula = eventos.length > 0
```

O dia de feriado ou recesso mostra a aula do mesmo jeito.

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/test/semana.int.test.ts › S3
falha: expect(aulasDe(lida, '2026-11-03')).toEqual([])
-    dias.push({ data, eventos: eventos.map(({ tipo, descricao }) => ({ tipo, descricao })), aulas: semAula ? [] : candidatas.sort(naOrdemDoDia).map(comoAula), itens: [] })
+    dias.push({ data, eventos: eventos.map(({ tipo, descricao }) => ({ tipo, descricao })), aulas: candidatas.sort(naOrdemDoDia).map(comoAula), itens: [] })
```

O texto da aula sem registro deixa de ser `null`.

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/src/semana/montar-dias.test.ts › S14: o registro com alocação do mesmo início
-        texto: textos.get(chaveDaAula(alocacao.vinculoId, alocacao.inicio)) ?? null,
+        texto: textos.get(chaveDaAula(alocacao.vinculoId, alocacao.inicio)) ?? '',
```

Sem ano em curso, a leitura segue e quebra: o `ano: null` sai.

```mutacao
arquivo: apps/api/src/semana/semana.service.ts
teste: apps/api/test/semana.int.test.ts › S6
-    if (ano === null) return semanaResponseSchema.parse({ ano: null, hoje, agora, gradeImportada: false, calendarioImportado: false, dias: [] })
```

O ano em curso: o ano do contexto passa a valer qualquer que seja a situação dele.

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana.int.test.ts › o repository do ano em curso
-      .where(and(eq(anoLetivo.escolaId, requireEscolaId()), eq(anoLetivo.id, anoLetivoId), eq(anoLetivo.situacao, 'em_curso')))
+      .where(and(eq(anoLetivo.escolaId, requireEscolaId()), eq(anoLetivo.id, anoLetivoId)))
```

O ano em curso: a escola do contexto sai (o ano da B, no contexto da A, é achado).

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana.int.test.ts › o repository do ano em curso
-      .where(and(eq(anoLetivo.escolaId, requireEscolaId()), eq(anoLetivo.id, anoLetivoId), eq(anoLetivo.situacao, 'em_curso')))
+      .where(and(eq(anoLetivo.id, anoLetivoId), eq(anoLetivo.situacao, 'em_curso')))
```

O ano em curso: o ano que não existe deixa de dar `null`.

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana.int.test.ts › o repository do ano em curso
falha: expect(await anoDo(b.emCurso)).toBeNull()
-    return achado ?? null
+    return achado ?? undefined
```

O texto de uma disciplina vale para a outra (a chave perde o vínculo).

```mutacao
arquivo: apps/api/src/semana/montar-dias.ts
teste: apps/api/test/semana.int.test.ts › S11
-const chaveDaAula = (vinculoId: string, inicio: string): string => `${vinculoId}|${inicio}`
+const chaveDaAula = (_vinculoId: string, inicio: string): string => inicio
```

Vínculos da professora: o ano sai.

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana.int.test.ts › o repository lê só o que é do ano
falha: r.vinculosDaProfessora(a.planejado)
      .where(
        and(
           eq(vinculo.escolaId, requireEscolaId()),
-          eq(vinculo.anoLetivoId, anoLetivoId),
           eq(vinculo.usuarioId, requestSessao().usuarioId),
```

Vínculos da professora: a professora da sessão sai (a colega confirmada entra).

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana.int.test.ts › o vínculo de professora que o repository acha
falha: toEqual([dela.vinculoId])
           eq(vinculo.anoLetivoId, anoLetivoId),
-          eq(vinculo.usuarioId, requestSessao().usuarioId),
           eq(vinculo.papel, 'professor'),
```

Vínculos da professora: o estado `confirmado` sai (o encerrado, o pendente e o contestado dão aula).

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana.int.test.ts › S1
falha: toEqual([['7º A', 'Matemática', '07:30', '08:20']])
           eq(vinculo.papel, 'professor'),
-          eq(vinculo.estado, 'confirmado'),
         ),
```

Eventos da semana: a escola sai (o ano da B, no contexto da A, traz o evento da B).

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana.int.test.ts › o repository só devolve a escola do contexto
falha: r.eventosDaSemana(b.emCurso
      .where(
        and(
-          eq(eventoCalendario.escolaId, requireEscolaId()),
           eq(eventoCalendario.anoLetivoId, anoLetivoId),
           gte(eventoCalendario.fim, segunda),
           lte(eventoCalendario.inicio, domingo),
```

Eventos da semana: o ano sai (o evento do ano planejado entra).

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana.int.test.ts › o repository lê só o que é do ano
falha: r.eventosDaSemana(a.emCurso, SEGUNDA, domingo)
      .where(
        and(
           eq(eventoCalendario.escolaId, requireEscolaId()),
-          eq(eventoCalendario.anoLetivoId, anoLetivoId),
           gte(eventoCalendario.fim, segunda),
           lte(eventoCalendario.inicio, domingo),
```

Eventos da semana: o que acaba na segunda deixa de entrar (`≥` vira `>`).

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana.int.test.ts › o repository lê só o que é do ano
falha: r.eventosDaSemana(a.emCurso, SEGUNDA, domingo)
      .where(
        and(
           eq(eventoCalendario.escolaId, requireEscolaId()),
           eq(eventoCalendario.anoLetivoId, anoLetivoId),
-          gte(eventoCalendario.fim, segunda),
+          gt(eventoCalendario.fim, segunda),
           lte(eventoCalendario.inicio, domingo),
```

Eventos da semana: o que começa no domingo deixa de entrar (`≤` vira `<`).

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana.int.test.ts › o repository lê só o que é do ano
falha: r.eventosDaSemana(a.emCurso, SEGUNDA, domingo)
      .where(
        and(
           eq(eventoCalendario.escolaId, requireEscolaId()),
           eq(eventoCalendario.anoLetivoId, anoLetivoId),
           gte(eventoCalendario.fim, segunda),
-          lte(eventoCalendario.inicio, domingo),
+          lt(eventoCalendario.inicio, domingo),
```

Eventos da semana: o fim mínimo sai (o que acabou antes entra).

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana.int.test.ts › o repository lê só o que é do ano
falha: r.eventosDaSemana(a.emCurso, SEGUNDA, domingo)
      .where(
        and(
           eq(eventoCalendario.escolaId, requireEscolaId()),
           eq(eventoCalendario.anoLetivoId, anoLetivoId),
-          gte(eventoCalendario.fim, segunda),
           lte(eventoCalendario.inicio, domingo),
```

Eventos da semana: o início máximo sai (o que começa depois entra).

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana.int.test.ts › o repository lê só o que é do ano
falha: r.eventosDaSemana(a.emCurso, SEGUNDA, domingo)
      .where(
        and(
           eq(eventoCalendario.escolaId, requireEscolaId()),
           eq(eventoCalendario.anoLetivoId, anoLetivoId),
           gte(eventoCalendario.fim, segunda),
-          lte(eventoCalendario.inicio, domingo),
```

Alocações: a escola sai.

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana.int.test.ts › o repository só devolve a escola do contexto
falha: r.alocacoesDosVinculos(b.emCurso, [daB.vinculoId])
-     .where(and(eq(alocacao.escolaId, requireEscolaId()), eq(alocacao.anoLetivoId, anoLetivoId), inArray(alocacao.vinculoId, [...vinculoIds])))
+      .where(and(eq(alocacao.anoLetivoId, anoLetivoId), inArray(alocacao.vinculoId, [...vinculoIds])))
```

Alocações: o ano sai.

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana.int.test.ts › o repository lê só o que é do ano
falha: r.alocacoesDosVinculos(a.planejado
-     .where(and(eq(alocacao.escolaId, requireEscolaId()), eq(alocacao.anoLetivoId, anoLetivoId), inArray(alocacao.vinculoId, [...vinculoIds])))
+      .where(and(eq(alocacao.escolaId, requireEscolaId()), inArray(alocacao.vinculoId, [...vinculoIds])))
```

Alocações: os vínculos pedidos saem (a colega entra).

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana.int.test.ts › o repository lê só o que é do ano
falha: r.alocacoesDosVinculos(a.emCurso, [dela.vinculoId])
-     .where(and(eq(alocacao.escolaId, requireEscolaId()), eq(alocacao.anoLetivoId, anoLetivoId), inArray(alocacao.vinculoId, [...vinculoIds])))
+      .where(and(eq(alocacao.escolaId, requireEscolaId()), eq(alocacao.anoLetivoId, anoLetivoId)))
```

Registros: a escola sai.

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana.int.test.ts › o repository só devolve a escola do contexto
falha: r.registrosDosVinculos(b.emCurso, [daB.vinculoId]
      .where(
        and(
-         eq(aula.escolaId, requireEscolaId()),
          eq(aula.anoLetivoId, anoLetivoId),
          inArray(aula.vinculoId, [...vinculoIds]),
          gte(aula.data, segunda),
          lte(aula.data, domingo),
```

Registros: o ano sai (o registro pedido com outro ano é achado).

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana.int.test.ts › o repository lê só o que é do ano
falha: r.registrosDosVinculos(a.planejado
      .where(
        and(
          eq(aula.escolaId, requireEscolaId()),
-         eq(aula.anoLetivoId, anoLetivoId),
          inArray(aula.vinculoId, [...vinculoIds]),
          gte(aula.data, segunda),
          lte(aula.data, domingo),
```

Registros: os vínculos pedidos saem (o registro da colega entra).

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana.int.test.ts › o repository lê só o que é do ano
falha: r.registrosDosVinculos(a.emCurso, [dela.vinculoId]
      .where(
        and(
          eq(aula.escolaId, requireEscolaId()),
          eq(aula.anoLetivoId, anoLetivoId),
-         inArray(aula.vinculoId, [...vinculoIds]),
          gte(aula.data, segunda),
          lte(aula.data, domingo),
```

Registros: o da segunda deixa de entrar (`≥` vira `>`).

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana.int.test.ts › o repository lê só o que é do ano
falha: r.registrosDosVinculos(a.emCurso, [dela.vinculoId]
      .where(
        and(
          eq(aula.escolaId, requireEscolaId()),
          eq(aula.anoLetivoId, anoLetivoId),
          inArray(aula.vinculoId, [...vinculoIds]),
-         gte(aula.data, segunda),
+          gt(aula.data, segunda),
          lte(aula.data, domingo),
```

Registros: o do domingo deixa de entrar (`≤` vira `<`).

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana.int.test.ts › o repository lê só o que é do ano
falha: r.registrosDosVinculos(a.emCurso, [dela.vinculoId]
      .where(
        and(
          eq(aula.escolaId, requireEscolaId()),
          eq(aula.anoLetivoId, anoLetivoId),
          inArray(aula.vinculoId, [...vinculoIds]),
          gte(aula.data, segunda),
-         lte(aula.data, domingo),
+          lt(aula.data, domingo),
```

Registros: o piso da semana sai (o do domingo anterior entra).

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana.int.test.ts › o repository lê só o que é do ano
falha: r.registrosDosVinculos(a.emCurso, [dela.vinculoId]
      .where(
        and(
          eq(aula.escolaId, requireEscolaId()),
          eq(aula.anoLetivoId, anoLetivoId),
          inArray(aula.vinculoId, [...vinculoIds]),
-         gte(aula.data, segunda),
          lte(aula.data, domingo),
```

Registros: o teto da semana sai (o da segunda seguinte entra).

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana.int.test.ts › o repository lê só o que é do ano
falha: r.registrosDosVinculos(a.emCurso, [dela.vinculoId]
      .where(
        and(
          eq(aula.escolaId, requireEscolaId()),
          eq(aula.anoLetivoId, anoLetivoId),
          inArray(aula.vinculoId, [...vinculoIds]),
          gte(aula.data, segunda),
-         lte(aula.data, domingo),
```

Grade importada: a escola sai.

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana.int.test.ts › o repository só devolve a escola do contexto
falha: r.gradeImportada(b.emCurso)
-     .where(and(eq(alocacao.escolaId, requireEscolaId()), eq(alocacao.anoLetivoId, anoLetivoId)))
+      .where(eq(alocacao.anoLetivoId, anoLetivoId))
```

Grade importada: o ano sai.

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana.int.test.ts › o repository lê só o que é do ano
falha: r.gradeImportada(a.planejado)
-     .where(and(eq(alocacao.escolaId, requireEscolaId()), eq(alocacao.anoLetivoId, anoLetivoId)))
+      .where(eq(alocacao.escolaId, requireEscolaId()))
```

Calendário importado: a escola sai.

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana.int.test.ts › o repository só devolve a escola do contexto
falha: r.calendarioImportado(b.emCurso)
-     .where(and(eq(eventoCalendario.escolaId, requireEscolaId()), eq(eventoCalendario.anoLetivoId, anoLetivoId)))
+      .where(eq(eventoCalendario.anoLetivoId, anoLetivoId))
```

Calendário importado: o ano sai.

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana.int.test.ts › o repository só devolve a escola do contexto
falha: r.calendarioImportado(b.planejado)
-     .where(and(eq(eventoCalendario.escolaId, requireEscolaId()), eq(eventoCalendario.anoLetivoId, anoLetivoId)))
+      .where(eq(eventoCalendario.escolaId, requireEscolaId()))
```

O horário: o formato `HH:MM` deixa de ser exigido.

```mutacao
arquivo: packages/shared/src/semana/semana.ts
teste: packages/shared/src/semana/semana.test.ts › G7: o corpo da gravação
falha: inicio: '7h30'
-const horario = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
+const horario = z.string()
```

O rótulo do item: a correção perde o estado de hoje.

```mutacao
arquivo: packages/shared/src/semana/semana.ts
teste: packages/shared/src/semana/semana.test.ts › S15
-  return item.estado === undefined ? tipo : `${tipo} · ${ROTULOS_DA_SEMANA.estado[item.estado]}`
+  return tipo
```

Vínculos da professora: a escola do contexto sai (a professora da B, no contexto da A, acha o vínculo da B).

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana.int.test.ts › o repository só devolve a escola do contexto
falha: runInContext(contextoDaBNaA, () =>
      .where(
        and(
-          eq(vinculo.escolaId, requireEscolaId()),
           eq(vinculo.anoLetivoId, anoLetivoId),
```

Vínculos da professora: o papel `professor` sai (o vínculo `aluno` com disciplina, no mesmo usuário, vira aula).

```mutacao
arquivo: packages/core/src/semana/semana.repository.ts
teste: apps/api/test/semana.int.test.ts › o vínculo de professora que o repository acha
falha: toEqual([dela.vinculoId])
           eq(vinculo.usuarioId, requestSessao().usuarioId),
-          eq(vinculo.papel, 'professor'),
           eq(vinculo.estado, 'confirmado'),
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| `tenancy-guardian` (1ª) | `semana.repository.ts:73`: a mutação do `typeof` ficou verde e está registrada como motivo; "não precisa de ação, mas fica na retro como cláusula que nenhum teste prova" | Sem ação: já está no motivo (1) das Mutações. Fica para a retro da funcionalidade |
| `conformidade-reviewer` (1ª) | Na 3.0, o rótulo `correcao: 'Correção do Assistente'` precisa aparecer na tela com o selo de saída de IA (D58); quem clica chega à revisão do lote (D56), e não a uma nota | Tarefa 3.0 (consulta dos itens) e tarefa 8.0 (a tela dos itens): o selo é de tela, e a tela dos itens é da 8.0 |
| `conformidade-reviewer` (1ª) | Na 3.0 e na 4.0, "Falta preencher" e a existência do texto da aula não podem virar indicador nem contagem visível à coordenação, nem agregado por professor (D45, D64); caso de teste quando a tela entrar | Tarefas 3.0 e 4.0, como o revisor apontou; a linha "Falta preencher" da 6.0 (S14 e T11: "token neutro, sem total") já leva o teste da tela |
| `conformidade-reviewer` (1ª) | Na 3.0, a consulta dos itens lê só o `estado` da entrega, nunca resultado, acerto ou pontuação do lote | Tarefa 3.0, que escreve essa consulta |
| `privacy-guardian` (1ª) | A sala (texto livre de até 40 caracteres) chega à Semana da professora; quando a tela existir, o mesmo aviso da tela de grade (não escrever nome de pessoa), ou o registro de que o risco é aceito | Tarefa 6.0 (a tela da Semana, onde a sala aparece): não há tela nesta tarefa |
| `privacy-guardian` (1ª) | Na tela da 4.0 e no `PUT`, manter o aviso "não escreva nome de aluno" ao lado do campo de texto, como o `docs/lgpd.md` linha 75 promete | Tarefa 4.0 (o `PUT`) e tarefa 7.0 (o painel da aula, onde está o campo): esta tarefa não tem campo |
| `infra-guardian` (1ª) | Incluir `GET /v1/semana` como passo do professor no cenário de carga das 7h30 (`infra/scripts/carga-login.ts` ou o cenário `rajada`) | `TODO.md`: o script de carga não é arquivo desta tarefa, e a rota só tem tela com a 6.0 |
| `infra-guardian` (1ª) | `alocacoesDosVinculos` filtra `vinculo_id` em cima do `alocacao_ano_idx (escola, ano)`; se o `EXPLAIN` no staging mostrar varredura da escola toda, um índice `(escola_id, ano_letivo_id, vinculo_id)` resolve | `TODO.md`: o revisor condiciona a um `EXPLAIN` no staging que ainda não existe; índice novo é migration, fora do que esta tarefa toca |
| `revisor-geral` (1ª) | `semana.repository.ts:14`: o `horario = (valor) => valor.slice(0, 5)` é a terceira cópia (já existe em `grade.repository.ts:12` e `alocacao.repository.ts:19`); uma função comum no `core` resolveria, e o nome colide com o `horario` de `packages/shared/src/semana/semana.ts:13` | `TODO.md`: mexe em `grade.repository.ts` e `alocacao.repository.ts`, que a tarefa não toca |
| `revisor-geral` (1ª) | `semana.service.ts:5-10`: `horaDeUso` faz par com o `diaDeUso` do `core` (`usage-day.ts`) e ficaria melhor lá | `TODO.md`: mexe em `usage-day.ts`, que a tarefa não toca; entra junto com o item anterior |
| `revisor-geral` (1ª) | `montar-dias.ts:97`: o `push` do dia faz quatro coisas numa linha só; separar em duas ou três linhas deixaria a regra "feriado tira a aula" mais fácil de ler | Recusada: só legibilidade, e os blocos de Mutações de `montar-dias.ts` copiam o trecho dessa linha (o `semAula ? [] : …`); reescrever a linha obriga a refazer os blocos sem mudar comportamento nenhum |
| `privacy-guardian` (1ª) | Incluir a sessão de rede no laço do R7 | Não aplicável: não existe sessão de rede (`PAPEIS_DE_USUARIO` é coordenador, professor e aluno; o `--papel rede` da sessão sintética é recusado como desconhecido), então a rota não tem como ser chamada com esse token. A recusa da rede é provada pela matriz: `packages/shared/src/permissao/matriz.test.ts` (`aula` é `nunca` para a rede). A Mesa decide se isto basta |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-06 15:49:27 | 2026-11-06 15:49:58 | `tenancy-guardian` | 1 | APROVADO | a76b0ed0db9028b57 |
| 2026-11-06 15:49:33 | 2026-11-06 15:50:10 | `conformidade-reviewer` | 1 | APROVADO | a37ff8d41253190a1 |
| 2026-11-06 15:49:29 | 2026-11-06 15:50:16 | `privacy-guardian` | 1 | APROVADO | a81fce63471ef40e8 |
| 2026-11-06 15:49:34 | 2026-11-06 15:50:20 | `infra-guardian` | 1 | APROVADO | abe61095314213e5e |
| 2026-11-06 15:49:31 | 2026-11-06 15:50:32 | `revisor-geral` | 1 | APROVADO | aab3383d73e20639b |
| 2026-11-06 15:49:30 | 2026-11-06 15:51:54 | `test-engineer` | 1 | APROVADO | a2afe906570e58efa |
| 2026-11-06 16:04:57 | 2026-11-06 16:05:17 | `tenancy-guardian` | 2 | APROVADO | a3402b18280a4aa96 |
| 2026-11-06 16:05:02 | 2026-11-06 16:05:22 | `privacy-guardian` | 2 | APROVADO | a98634ce62dc98d05 |
| 2026-11-06 16:05:16 | 2026-11-06 16:05:35 | `conformidade-reviewer` | 2 | APROVADO | af5ea437a64b7d387 |
| 2026-11-06 16:05:11 | 2026-11-06 16:05:36 | `revisor-geral` | 2 | APROVADO | af5adc3f5e1d80a37 |
| 2026-11-06 16:05:21 | 2026-11-06 16:05:42 | `infra-guardian` | 2 | APROVADO | ad05339e0610c6c10 |
| 2026-11-06 16:05:07 | 2026-11-06 16:05:49 | `test-engineer` | 2 | APROVADO | acf303cf9228c6275 |
