# Tarefa 12.0 — Reimportar a grade a substitui sem perder o id, e a grade se lê por turma

**Funcionalidade:** onboarding-por-convite · **Depende de:** 5.0, 11.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

Reimportar a grade substitui as aulas do ano mantendo o id da alocação por (vínculo, dia, início), que a `Aula` da F2b
vai apontar; o vínculo que perdeu as aulas aparece "sai da grade" e só encerra marcado. Coordenação e professor leem a
grade por turma em `GET /v1/grade`.

## Contexto necessário

- `techspec.md` §3 (o parágrafo da `alocacao`), §4 (`GET /v1/grade`: coordenador com `anoLetivoId?`; professor com
  vínculo confirmado, só com id e nome do colega), §5 "Gravar" ("encerra só o marcado"), §7 (DTO)
- `prd.md` RF9, RF16; regra 60 item 8
- `cenarios.md` RF9, "Virada de ano" (grade do planejado), "Isolamento e ano letivo"
- Código: o tipo grade da 11.0; o `GET /v1/calendario` da 5.0 (o `CalendarioController` e o `CalendarioService` são o molde; a grade tem o `GradeController` e o `GradeService` dela, em `apps/api/src/estrutura/grade/`); `apps/api/test/contracts.test.ts`

## Subtarefas

- [x] 12.1 — Reimportação: substitui no ano, mantendo o id por (vínculo, dia, início); "sai da grade" como candidato; encerra só o marcado, pelo `encerrar`
- [x] 12.2 — `GET /v1/grade?turmaId=`: coordenador (com o filtro do planejado); professor com vínculo confirmado na turma, no ano em curso; DTO sem e-mail
- [x] 12.3 — `docs/modelo-de-dados.md` conferido (o id estável que a `Aula` da F2b aponta)
- [x] 12.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/importacao/tipos/grade.ts` | alterado |
| `apps/api/src/estrutura/grade/grade.controller.ts`, `grade.service.ts`, `packages/core/src/importacao/grade.repository.ts` | novo |
| `packages/shared/src/importacao/grade.ts` | alterado |
| `apps/api/test/grade.int.test.ts`, `apps/api/test/contracts.test.ts` | novo; alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| Reimportar mantém o id da alocação | integração | caminho feliz (RF9) |`grade.int.test.ts` › reimportar mantém o id da aula que continua |
| Vínculo da grade sem aula: "sai da grade" | integração | RF9 |`grade.int.test.ts` › o vínculo da grade que perdeu as aulas aparece "sai da grade" na prévia; `grade.test.ts` › o vínculo da grade sem aula é candidato |
| "Sai da grade" encerra só com marca | integração | RF9 |`grade.int.test.ts` › o marcado encerra por `realocacao`, e só ele |
| "Sai da grade" passa pelo `encerrar` e revoga o acesso | integração | RF5 |`grade.int.test.ts` › "sai da grade" passa pelo `encerrar` |
| Vínculo feito à mão sem aula fica, e não é candidato | integração | RF9 |`grade.int.test.ts` › o vínculo feito à mão sem aula fica e não é candidato |
| Grade e calendário do planejado não tocam o ano anterior | integração | ano |`grade.int.test.ts` › a grade e o calendário do planejado não tocam o ano anterior |
| Grade da B, para coordenador e para professor: igual a inexistente | integração | isolamento |`grade.int.test.ts` › a grade da escola B, para a coordenação e para o professor da A |
| Professor só com vínculo pendente ou contestado: grade igual a inexistente | integração | permissão |`grade.int.test.ts` › o professor com vínculo confirmado lê a grade da turma |
| Vínculo encerrado em X e confirmado em Y: grade só de Y | integração | vínculo encerrado e aberto |`grade.int.test.ts` › vínculo encerrado em uma turma e confirmado em outra |
| Sem ano em curso: a grade do coordenador aceita o filtro do planejado | integração | ano |`grade.int.test.ts` › sem ano em curso, a grade do coordenador aceita o filtro do planejado |
| Sem ano em curso: a grade do professor segue o ano em curso | integração | ano |`grade.int.test.ts` › sem ano em curso, a grade do coordenador aceita o filtro do planejado (a do professor, no mesmo caso) |
| `contracts.test.ts`: a grade do professor traz o colega só com id e nome | unidade | DTO |`contracts.test.ts` › F2, 12.0: a grade lida pelo professor recusa o e-mail do colega |
| Auditoria `vinculo.encerrado` da grade, com a origem | integração | RF17 |`grade.int.test.ts` › "sai da grade" passa pelo `encerrar` (a auditoria traz a origem sem nome nem e-mail) |

## Como testar

- Isolamento de leitura: `apps/api/test/estrutura-isolamento.int.test.ts › as listagens da coordenação de A trazem só o que é de A, com as linhas de B existindo`
- Revogação: `apps/api/test/acesso-fim-do-vinculo.int.test.ts › encerrar o último vínculo do professor na turma revoga o acesso que ele gerou, …`
- Comando: `npx vitest run --project integracao apps/api/test/grade.int.test.ts`

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3, o professor com vínculo confirmado numa turma e pendente em outra.

## Plano

**Reimportar (12.1), em `tipos/grade.ts`.** A prévia e o job passam a ver também o que a planilha *não* traz. (a) *Aula que sai*: aula gravada
do ano cuja chave (vínculo, dia, início) nenhuma linha reaproveita; o `aplicar` a apaga (`AlocacaoRepository.apagar`, por id, com escola e ano) e a
que fica mantém o id, pelo upsert que já existe. (b) *Candidato "sai da grade"*: vínculo de professor **aberto** do ano que nenhuma linha reaproveita
e que ou tem aula gravada ou nasceu da grade (`origem = grade`); o vínculo à mão sem aula não é candidato. Com erro em qualquer linha, nenhum
candidato (o gravar recusa a planilha, e o aviso seria falso). O id do candidato é o do vínculo, `acao: 'encerrar'`, rótulo com professor, turma e
disciplina (só a coordenação o vê). (c) *Marca*: o `aplicar` encerra cada vínculo marcado pelo `VinculoRepository.encerrarProfessoresDaGrade`
(a escrita do `encerrar`, por id e num ano que pode ser o planejado, `FOR UPDATE` em ordem de id, motivo `realocacao`), grava `vinculo.encerrado`
com `origem: 'grade'`, e revoga o acesso por `CicloDeVidaRepository.revogarDeQuemSaiu(usuário, turma)` com `acesso_turma.revogado`, como o
`VinculoService.encerrar`. Menos vínculos encerrados que marcados, ou marca que já não é candidato: `DiferencaNaPlanilhaError` (`desatualizada`).
(d) A `assinatura` passa a incluir os ids das aulas que saem e dos candidatos; o `resumo` ganha `aulas_removidas` e `vinculos_encerrados`, só
quando maiores que zero. (e) O `travar` do tipo trava também o usuário e a turma de cada vínculo marcado, antes das contas e na mesma ordem
global (usuários → contas → turmas, num comando por classe, em ordem de id). O vínculo marcado, depois da turma, como o `encerrar` da API.

**Ler (12.2).** Recurso novo `grade: ['ler']` na matriz (coordenador `unidade`, professor `turma_vinculada`, aluno e rede `nunca`) e
`gradeQuerySchema` (`turmaId` obrigatório, `anoLetivoId?`) em `packages/shared/src/importacao/contratos.ts`, onde já moram `aulaDaGradeSchema` e o
`calendarioQuerySchema` (o `shared/importacao/grade.ts` que a tabela de arquivos cita não existe). `GradeRepository` (novo, em
`packages/core/src/importacao/grade.repository.ts`) lê as aulas da turma no ano (só vínculo não encerrado, ordem por dia, início e id) com id e
nome do professor, nunca o e-mail, e diz se o professor da sessão tem vínculo `confirmado` na turma. `GradeService` na API: coordenação com
`anoDeDestino(anoLetivoId)` e turma conferida na escola e no ano; professor só no ano em curso, sem filtro, com vínculo confirmado na turma; o resto
é `NAO_ENCONTRADO`.

**Autoconferência.**
1. Mutações: bloco por cláusula nova, na seção "Mutações" (aula que sai, candidato, `origem`, marca, `travar`, `encerrar`, `revogar`, escopo do `apagar`, escopo e estado de cada leitura).
2. Texto de tela: nenhum (a tela é a 14.0).
3. Segundo dado: professor com vínculo confirmado numa turma e pendente em outra; vínculo da grade e vínculo à mão, os dois sem aula; vínculo com duas aulas, uma que fica e outra que sai; duas escolas com a mesma tripla.
4. Antes da regra: o cenário monta ano em curso e turma da escola, e o teste confere o resultado da leitura (não só o status).
5. Asserções sobre o que o usuário obtém (aulas lidas, estado do vínculo, `acesso_turma.revogado_em`), não sobre o texto do código.
6. Guarda nova: nenhuma. O recurso `grade` entra na matriz e na expectativa, que a comparação já cobre.
7. Comentários: escritos depois do código, com o que ele faz.
8. Divergência: nenhuma de desenho. O `resumo` ganha duas chaves, o que o comentário do contrato prevê ("cada tarefa que grava um tipo acrescenta as dela").
9. Peças reaproveitadas: `encerrarDosAlunos` (9.0) e o `VinculoService.encerrar` como molde; `revogarDeQuemSaiu`; `anoDeDestino`; `CalendarioService` como molde da leitura.
10. Corridas: o vínculo encerrado à mão, ou a aula posta à mão, entre o gravar e o job: a assinatura do passo (2) já não confere e a importação sai `desatualizada`, sem apagar nem encerrar nada; e, no passo (3), o `apagarAulas` e o `encerrarVinculosDeProfessorDaGrade` que acham menos linhas que o plano lançam `DiferencaNaPlanilhaError` (caso de unidade `vínculo marcado que já não está aberto, ou aula que já não existe`). As travas do passo (3) não são só as da 11.0: a tarefa acrescenta ao `travar` o usuário e a turma de cada vínculo marcado, e o `FOR UPDATE` da linha do vínculo no `encerrarProfessoresDaGrade`. Por isso a corrida entra, com `WriteBlockTrigger` em `grade.int.test.ts`: o gerar parado depois do insert contra o job com a marca, o job parado com a turma travada contra o gerar, e o job contra o confirmar do professor no vínculo marcado (sem `40P01`).
11. Isolamento: grade da B para coordenação e professor da A, e a aula da B com a mesma chave não é apagada pela reimportação da A; cada linha da tabela de testes leva o caso na coluna "Caso".
12. Guardiões: tenancy (escopo no repository; `apagar` e `encerrar` com escola e ano), privacy (DTO sem e-mail; auditoria sem nome), infra (travas em ordem global, um comando por classe, lotes de 500). O `achados/indice.md` (11.0): `setWhere` com escola **e** ano; a grade não é medida do professor (regra 70, item 8), por isso a leitura é por turma e não há rota por professor.

## Fora do escopo desta tarefa

A tela da grade (14.0); a `Aula` concreta (F2b).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O contrato da consulta (`gradeQuerySchema`) mora em `importacao/contratos.ts`, e não num `importacao/grade.ts` | o `contratos.ts` já guarda os contratos da grade (a linha e a aula); um arquivo só para a consulta duplicaria a pasta | `techspec.md` §2 (os contratos moram em `packages/shared/src/importacao/`); o "Arquivos previstos" desta tarefa citava um `grade.ts` que não existe |
| Chave nova `aulas_removidas` no `resumo` da importação, e `vinculos_encerrados` só quando houver | a coordenação precisa ver quantas aulas saem; a chave fica fora do resumo quando é zero | `techspec.md` §5 (Grade); `cenarios.md` RF9 |
| Recurso novo `grade` (`ler`) na matriz de permissão: coordenação `unidade`, professor `turma_vinculada` | a leitura da grade é da turma, e não do professor (regra 70, item 8); o `calendario` (5.0) é o molde | `techspec.md` §4 (linha de `GET /v1/grade`: coordenador e professor com vínculo confirmado na turma, que o recurso `grade` de `matriz.ts` e de `matriz.expectativa.ts` implementa) |

## Mutações

--faltando: 5 linhas (55 blocos, 6 motivos)

**Sem bloco (motivo):** (1) `vinculo.repository.ts:301` e `alocacao.repository.ts:62`, os `if (lista.length === 0)`: o `encerrarOsMarcados` e o `apagarAulas` do motor percorrem a lista em lotes e só chamam o método com lista cheia; o atalho só poupa o `inArray([])`. (2) `vinculo.repository.ts:309`, o `if (abertos.length === 0) return []`: sem ele o `update` correria com `inArray` vazio e não mudaria linha nenhuma, e o retorno seria o mesmo `[]`. (3) O termo `eq(vinculo.escolaId)` e o `eq(vinculo.anoLetivoId)` do `update` do `encerrarProfessoresDaGrade` (linha 313): os ids vêm do `select` logo acima, que já filtra escola e ano (o do ano tem bloco ali; o da escola, o item 5), de modo que sem os termos o resultado é o mesmo; ficam como escopo de escrita (regra 10, item 3), e o termo `inArray` tem bloco. (4) `grade.repository.ts:67`, a abertura do `where(` de `professorTemVinculoConfirmadoNaTurma`: os termos de turma, de professor e de estado têm bloco, um a um; o de escola e o de ano não têm, e o `eq(vinculo.papel, 'professor')` (linha 73) também não: a sessão que chega aqui é a do professor (a matriz barra o aluno e a rede antes), o vínculo de aluno só nasce para usuário de papel aluno (`vinculo.repository.ts`, linhas 111 e 268) e o de professor só para usuário de papel professor (linha 134), de modo que sem o termo a resposta é a mesma por todo caminho que o produto abre; fica como escopo do papel (regra 10, item 3). O vínculo já está preso à turma do ano pela FK composta, e o `requireEscolaId` só repete o escopo do repository (regra 10, item 3); o caso do isolamento A×B prova a resposta igual à da turma inexistente. (5) O termo `eq(vinculo.escolaId)` do `select` de `encerrarProfessoresDaGrade`: o ano é de uma escola só, e o termo do ano tem bloco, de modo que sem ele o resultado é o mesmo; fica como escopo de leitura (regra 10, item 3). (6) `grade.ts:406`, o `disciplinaId === null ? undefined : …` do `rotuloDe`: só monta o texto do candidato que a coordenação lê; o caso do rótulo prova o professor, a turma e a disciplina juntos, e o `filter` tira o que não existe.

A aula que a linha confirma deixa de contar como mantida: toda aula gravada sairia do ano.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › a aula gravada que nenhuma linha traz sai do ano
-  const mantidas = new Set(linhas.flatMap(({ gravada }) => (gravada === undefined ? [] : [gravada.id])))
+  const mantidas = new Set<string>()
```

A aula gravada que nenhuma linha traz deixa de sair do ano (o filtro fica ao contrário).

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › a aula gravada que nenhuma linha traz sai do ano
-    aulasQueSaem: dados.aulas.filter(({ id }) => !mantidas.has(id)).map(({ id }) => id),
+    aulasQueSaem: dados.aulas.filter(({ id }) => mantidas.has(id)).map(({ id }) => id),
```

O vínculo que alguma linha reaproveita deixa de contar como citado: ele passa a candidato.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › o vínculo que perdeu todas as aulas é candidato
-  const citados = new Set(linhas.flatMap(({ vinculo }) => (vinculo?.tipo === 'existente' ? [vinculo.id] : [])))
+  const citados = new Set<string>()
```

O vínculo citado por alguma linha passa a candidato a "sai da grade".

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › o vínculo que perdeu todas as aulas é candidato
-  const candidatos = dados.vinculos.filter(({ id, origem }) => !citados.has(id) && (origem === 'grade' || comAula.has(id)))
+  const candidatos = dados.vinculos.filter(({ id, origem }) => (origem === 'grade' || comAula.has(id)))
```

O vínculo da grade que ficou sem aula deixa de ser candidato (só o que tem aula gravada seria).

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › o vínculo da grade sem aula é candidato; o feito à mão sem aula fica
-  const candidatos = dados.vinculos.filter(({ id, origem }) => !citados.has(id) && (origem === 'grade' || comAula.has(id)))
+  const candidatos = dados.vinculos.filter(({ id, origem }) => !citados.has(id) && comAula.has(id))
```

O vínculo feito à mão que tinha aula gravada deixa de ser candidato (só o da grade seria).

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › o vínculo da grade sem aula é candidato; o feito à mão sem aula fica
-  const candidatos = dados.vinculos.filter(({ id, origem }) => !citados.has(id) && (origem === 'grade' || comAula.has(id)))
+  const candidatos = dados.vinculos.filter(({ id, origem }) => !citados.has(id) && origem === 'grade')
```

O candidato deixa de ser oferecido como `encerrar`.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › o vínculo que perdeu todas as aulas é candidato
-    candidatos: candidatos.map((vinculo) => ({ id: vinculo.id, acao: 'encerrar', rotulo: rotuloDe(vinculo) })),
+    candidatos: candidatos.map((vinculo) => ({ id: vinculo.id, acao: 'desligar', rotulo: rotuloDe(vinculo) })),
```

Com linha que a leitura recusou, a prévia passa a oferecer candidato e a contar aula que sai.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › planilha com erro de linha não oferece candidato
-  const { aulasQueSaem, candidatos } = semLeitura === 0 && linhas.every(({ resultado }) => resultado !== 'erro') ? saidasDe(linhas, dados) : { aulasQueSaem: [], candidatos: [] }
+  const { aulasQueSaem, candidatos } = linhas.every(({ resultado }) => resultado !== 'erro') ? saidasDe(linhas, dados) : { aulasQueSaem: [], candidatos: [] }
```

Com erro de classificação (a mesma aula duas vezes), a prévia passa a oferecer candidato e a contar aula que sai.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › planilha com erro de linha não oferece candidato
-  const { aulasQueSaem, candidatos } = semLeitura === 0 && linhas.every(({ resultado }) => resultado !== 'erro') ? saidasDe(linhas, dados) : { aulasQueSaem: [], candidatos: [] }
+  const { aulasQueSaem, candidatos } = semLeitura === 0 && true ? saidasDe(linhas, dados) : { aulasQueSaem: [], candidatos: [] }
```

A prévia deixa de passar à classificação quantas linhas a leitura recusou.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › planilha com erro de linha não oferece candidato
-    const classificacao = classificar(ano.id, validas, await lerDados(repositorio, ano.id), lidas.length - validas.length)
+    const classificacao = classificar(ano.id, validas, await lerDados(repositorio, ano.id), 0)
```

A prévia deixa de devolver os candidatos.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › o vínculo que perdeu todas as aulas é candidato
-    return { linhas, contagens: classificacao.resumo, candidatos: classificacao.candidatos, guardado: validas, assinatura: classificacao.assinatura }
+    return { linhas, contagens: classificacao.resumo, candidatos: [], guardado: validas, assinatura: classificacao.assinatura }
```

O `resumo` passa a trazer `aulas_removidas` também quando nenhuma aula sai.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › escola vazia: toda linha é "novo"
-    ...(aulasQueSaem.length === 0 ? {} : { aulas_removidas: aulasQueSaem.length }),
+    ...{ aulas_removidas: aulasQueSaem.length },
```

O `resumo` passa a trazer `vinculos_encerrados` também quando nenhum vínculo é marcado.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › o plano chama o professor novo pelo convite da planilha
-    resumo: { ...classificacao.resumo, ...(aEncerrar.length === 0 ? {} : { vinculos_encerrados: aEncerrar.length }) },
+    resumo: { ...classificacao.resumo, ...{ vinculos_encerrados: aEncerrar.length } },
```

A assinatura deixa de incluir as aulas que saem do ano.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › a assinatura muda quando entra ou sai uma aula do ano
falha: not.toBe(conferida)
-  const assinatura = createHash('sha256').update(JSON.stringify({ ano: anoLetivoId, linhas: linhas.map(linhaVista), saem: aulasQueSaem, candidatos: candidatos.map(({ id }) => id) })).digest('hex')
+  const assinatura = createHash('sha256').update(JSON.stringify({ ano: anoLetivoId, linhas: linhas.map(linhaVista), candidatos: candidatos.map(({ id }) => id) })).digest('hex')
```

A assinatura deixa de incluir os candidatos a "sai da grade".

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › a assinatura muda quando entra ou sai uma aula do ano
falha: not.toBe(conferida)
-  const assinatura = createHash('sha256').update(JSON.stringify({ ano: anoLetivoId, linhas: linhas.map(linhaVista), saem: aulasQueSaem, candidatos: candidatos.map(({ id }) => id) })).digest('hex')
+  const assinatura = createHash('sha256').update(JSON.stringify({ ano: anoLetivoId, linhas: linhas.map(linhaVista), saem: aulasQueSaem })).digest('hex')
```

A aula que sai do ano deixa de ser apagada, e a diferença deixa de ser conferida.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › a aula gravada que nenhuma linha traz sai do ano
-      if ((await gravacao.apagarAulas(anoLetivoId, classificacao.aulasQueSaem)) !== classificacao.aulasQueSaem.length) throw new DiferencaNaPlanilhaError()
```

A aula que já não existe no passo (3) deixa de ser diferença: a importação seguiria sem as ter apagado.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › vínculo marcado que já não está aberto, ou aula que já não existe
-      if ((await gravacao.apagarAulas(anoLetivoId, classificacao.aulasQueSaem)) !== classificacao.aulasQueSaem.length) throw new DiferencaNaPlanilhaError()
+      await gravacao.apagarAulas(anoLetivoId, classificacao.aulasQueSaem)
```

O vínculo marcado deixa de ser encerrado.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › só o marcado encerra
-      await encerrarOsMarcados(gravacao, tx, anoLetivoId, aEncerrar)
```

O vínculo marcado encerra por `desligamento`, e não por `realocacao`.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › só o marcado encerra
-  const encerrados = await gravacao.encerrarVinculosDeProfessorDaGrade(anoLetivoId, ids, 'realocacao')
+  const encerrados = await gravacao.encerrarVinculosDeProfessorDaGrade(anoLetivoId, ids, 'desligamento')
```

O vínculo marcado que já não está aberto deixa de ser diferença.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › vínculo marcado que já não está aberto, ou aula que já não existe
-  if (encerrados.length !== ids.length) throw new DiferencaNaPlanilhaError()
```

O `vinculo.encerrado` deixa de levar a origem `grade`.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › só o marcado encerra
-    await registro.gravar(tx, 'vinculo.encerrado', { entidadeId: id, antes: { estado: estadoAntes }, depois: { estado: 'encerrado', motivo: 'realocacao', origem: 'grade' } })
+    await registro.gravar(tx, 'vinculo.encerrado', { entidadeId: id, antes: { estado: estadoAntes }, depois: { estado: 'encerrado', motivo: 'realocacao', origem: 'lista' } })
```

O `vinculo.encerrado` deixa de ser registrado.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › só o marcado encerra
-    await registro.gravar(tx, 'vinculo.encerrado', { entidadeId: id, antes: { estado: estadoAntes }, depois: { estado: 'encerrado', motivo: 'realocacao', origem: 'grade' } })
+    await Promise.resolve(tx, 'vinculo.encerrado', { entidadeId: id, antes: { estado: estadoAntes }, depois: { estado: 'encerrado', motivo: 'realocacao', origem: 'grade' } })
```

O acesso que o professor gerou na turma deixa de ser revogado.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › só o marcado encerra
-    for (const revogado of await ciclo.revogarDeQuemSaiu(usuarioId, turmaId)) await registro.gravar(tx, 'acesso_turma.revogado', { entidadeId: revogado.id, depois: { turmaId: revogado.turmaId } })
+    for (const revogado of []) await registro.gravar(tx, 'acesso_turma.revogado', { entidadeId: revogado.id, depois: { turmaId: revogado.turmaId } })
```

O plano deixa de saber das marcas: `vinculos_encerrados` some do `resumo`.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › só o marcado encerra
-    return lido.success ? planoDe(ano.id, classificar(ano.id, lido.data, await lerDados(repositorio, ano.id)), contas, marcas) : undefined
+    return lido.success ? planoDe(ano.id, classificar(ano.id, lido.data, await lerDados(repositorio, ano.id)), contas, { transferir: [], desligar: [], encerrar: [] }) : undefined
```

Sem a forma da grade, o `planejar` deixa de devolver `undefined`.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › o que o gravar guardou sem a forma da grade
-    return lido.success ? planoDe(ano.id, classificar(ano.id, lido.data, await lerDados(repositorio, ano.id)), contas, marcas) : undefined
+    return true ? planoDe(ano.id, classificar(ano.id, lido.data, await lerDados(repositorio, ano.id)), contas, marcas) : undefined
```

A trava passa a pegar o professor e a turma de todo vínculo aberto, marcado ou não.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › a trava trava também o professor e a turma de cada vínculo marcado
-    const aEncerrar = marcados.size === 0 ? [] : (await repositorio.vinculosDeProfessorDoAno(ano.id)).filter(({ id }) => marcados.has(id))
+    const aEncerrar = marcados.size === 0 ? [] : (await repositorio.vinculosDeProfessorDoAno(ano.id)).filter(() => true)
```

A trava deixa de pegar o professor de cada vínculo marcado.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › a trava trava também o professor e a turma de cada vínculo marcado
-    const usuarios = new Set([...professores.filter(({ email }) => email !== null && emails.has(email)).map(({ usuarioId }) => usuarioId), ...aEncerrar.map(({ usuarioId }) => usuarioId)])
+    const usuarios = new Set([...professores.filter(({ email }) => email !== null && emails.has(email)).map(({ usuarioId }) => usuarioId)])
```

A trava deixa de pegar a turma de cada vínculo marcado.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › a trava trava também o professor e a turma de cada vínculo marcado
-    const turmas = new Set([...turmasTocadas(lido.data, await repositorio.turmasDoAno(ano.id)), ...aEncerrar.map(({ turmaId }) => turmaId)])
+    const turmas = new Set([...turmasTocadas(lido.data, await repositorio.turmasDoAno(ano.id))])
```

O encerramento da grade deixa de conferir o ano pedido.

```mutacao
arquivo: packages/core/src/estrutura/vinculo.repository.ts
teste: apps/api/test/grade.int.test.ts › encerrar o "sai da grade" só alcança
falha: encerrar(e.emCurso, [doPlanejado, daOutra, doAluno, jaEncerrado])
-      .where(and(eq(vinculo.escolaId, escolaId), eq(vinculo.anoLetivoId, anoLetivoId), eq(vinculo.papel, 'professor'), ne(vinculo.estado, 'encerrado'), inArray(vinculo.id, [...ids])))
+      .where(and(eq(vinculo.escolaId, escolaId), eq(vinculo.papel, 'professor'), ne(vinculo.estado, 'encerrado'), inArray(vinculo.id, [...ids])))
```

O encerramento da grade passa a alcançar o vínculo de aluno.

```mutacao
arquivo: packages/core/src/estrutura/vinculo.repository.ts
teste: apps/api/test/grade.int.test.ts › encerrar o "sai da grade" só alcança
falha: encerrar(e.emCurso, [doPlanejado, daOutra, doAluno, jaEncerrado])
-      .where(and(eq(vinculo.escolaId, escolaId), eq(vinculo.anoLetivoId, anoLetivoId), eq(vinculo.papel, 'professor'), ne(vinculo.estado, 'encerrado'), inArray(vinculo.id, [...ids])))
+      .where(and(eq(vinculo.escolaId, escolaId), eq(vinculo.anoLetivoId, anoLetivoId), ne(vinculo.estado, 'encerrado'), inArray(vinculo.id, [...ids])))
```

O encerramento da grade passa a alcançar o vínculo que já está encerrado.

```mutacao
arquivo: packages/core/src/estrutura/vinculo.repository.ts
teste: apps/api/test/grade.int.test.ts › encerrar o "sai da grade" só alcança
falha: encerrar(e.emCurso, [doPlanejado, daOutra, doAluno, jaEncerrado])
-      .where(and(eq(vinculo.escolaId, escolaId), eq(vinculo.anoLetivoId, anoLetivoId), eq(vinculo.papel, 'professor'), ne(vinculo.estado, 'encerrado'), inArray(vinculo.id, [...ids])))
+      .where(and(eq(vinculo.escolaId, escolaId), eq(vinculo.anoLetivoId, anoLetivoId), eq(vinculo.papel, 'professor'), inArray(vinculo.id, [...ids])))
```

O encerramento da grade deixa de limitar aos ids marcados: encerraria o ano inteiro.

```mutacao
arquivo: packages/core/src/estrutura/vinculo.repository.ts
teste: apps/api/test/grade.int.test.ts › encerrar o "sai da grade" só alcança
falha: encerrar(e.emCurso, [doPlanejado, daOutra, doAluno, jaEncerrado])
-      .where(and(eq(vinculo.escolaId, escolaId), eq(vinculo.anoLetivoId, anoLetivoId), eq(vinculo.papel, 'professor'), ne(vinculo.estado, 'encerrado'), inArray(vinculo.id, [...ids])))
+      .where(and(eq(vinculo.escolaId, escolaId), eq(vinculo.anoLetivoId, anoLetivoId), eq(vinculo.papel, 'professor'), ne(vinculo.estado, 'encerrado')))
```

A leitura dos vínculos abertos deixa de trazer a origem.

```mutacao
arquivo: packages/core/src/estrutura/vinculo.repository.ts
teste: apps/api/test/grade.int.test.ts › o vínculo da grade que perdeu as aulas aparece
-      .select({ id: vinculo.id, usuarioId: vinculo.usuarioId, turmaId: vinculo.turmaId, disciplinaId: vinculo.disciplinaId, estado: vinculo.estado, origem: vinculo.origem })
+      .select({ id: vinculo.id, usuarioId: vinculo.usuarioId, turmaId: vinculo.turmaId, disciplinaId: vinculo.disciplinaId, estado: vinculo.estado })
```

Apagar aula deixa de conferir o ano pedido.

```mutacao
arquivo: packages/core/src/importacao/alocacao.repository.ts
teste: apps/api/test/grade.int.test.ts › apagar aula só alcança
falha: apagar(e.planejado, [doAnoEmCurso, daOutra])
-      .where(and(eq(alocacao.escolaId, requireEscolaId()), eq(alocacao.anoLetivoId, anoLetivoId), inArray(alocacao.id, [...ids])))
+      .where(and(eq(alocacao.escolaId, requireEscolaId()), inArray(alocacao.id, [...ids])))
```

Apagar aula deixa de limitar aos ids pedidos: apagaria o ano inteiro.

```mutacao
arquivo: packages/core/src/importacao/alocacao.repository.ts
teste: apps/api/test/grade.int.test.ts › apagar aula só alcança
falha: apagar(e.planejado, [doAnoEmCurso, daOutra])
-      .where(and(eq(alocacao.escolaId, requireEscolaId()), eq(alocacao.anoLetivoId, anoLetivoId), inArray(alocacao.id, [...ids])))
+      .where(and(eq(alocacao.escolaId, requireEscolaId()), eq(alocacao.anoLetivoId, anoLetivoId)))
```

A turma deixa de ser conferida no ano pedido.

```mutacao
arquivo: packages/core/src/importacao/grade.repository.ts
teste: apps/api/test/grade.int.test.ts › a leitura da grade só alcança a turma
-      .where(and(eq(turma.escolaId, requireEscolaId()), eq(turma.anoLetivoId, anoLetivoId), eq(turma.id, turmaId)))
+      .where(and(eq(turma.escolaId, requireEscolaId()), eq(turma.id, turmaId)))
```

A turma deixa de ser conferida pelo id: toda turma da escola e do ano "existe".

```mutacao
arquivo: packages/core/src/importacao/grade.repository.ts
teste: apps/api/test/grade.int.test.ts › a grade da escola B, para a coordenação e para o professor da A
-      .where(and(eq(turma.escolaId, requireEscolaId()), eq(turma.anoLetivoId, anoLetivoId), eq(turma.id, turmaId)))
+      .where(and(eq(turma.escolaId, requireEscolaId()), eq(turma.anoLetivoId, anoLetivoId)))
```

As aulas deixam de ser lidas só no ano pedido.

```mutacao
arquivo: packages/core/src/importacao/grade.repository.ts
teste: apps/api/test/grade.int.test.ts › a leitura da grade só alcança a turma
-      .where(and(eq(alocacao.escolaId, escolaId), eq(alocacao.anoLetivoId, anoLetivoId), eq(vinculo.turmaId, turmaId), ne(vinculo.estado, 'encerrado')))
+      .where(and(eq(alocacao.escolaId, escolaId), eq(vinculo.turmaId, turmaId), ne(vinculo.estado, 'encerrado')))
```

As aulas deixam de ser lidas só da turma pedida.

```mutacao
arquivo: packages/core/src/importacao/grade.repository.ts
teste: apps/api/test/grade.int.test.ts › a coordenação lê a grade da turma, por dia e horário
-      .where(and(eq(alocacao.escolaId, escolaId), eq(alocacao.anoLetivoId, anoLetivoId), eq(vinculo.turmaId, turmaId), ne(vinculo.estado, 'encerrado')))
+      .where(and(eq(alocacao.escolaId, escolaId), eq(alocacao.anoLetivoId, anoLetivoId), ne(vinculo.estado, 'encerrado')))
```

A aula de vínculo encerrado passa a aparecer na grade.

```mutacao
arquivo: packages/core/src/importacao/grade.repository.ts
teste: apps/api/test/grade.int.test.ts › a coordenação lê a grade da turma, por dia e horário
-      .where(and(eq(alocacao.escolaId, escolaId), eq(alocacao.anoLetivoId, anoLetivoId), eq(vinculo.turmaId, turmaId), ne(vinculo.estado, 'encerrado')))
+      .where(and(eq(alocacao.escolaId, escolaId), eq(alocacao.anoLetivoId, anoLetivoId), eq(vinculo.turmaId, turmaId)))
```

As aulas deixam de ser ordenadas por dia.

```mutacao
arquivo: packages/core/src/importacao/grade.repository.ts
teste: apps/api/test/grade.int.test.ts › a coordenação lê a grade da turma, por dia e horário
-      .orderBy(asc(alocacao.diaSemana), asc(alocacao.inicio), asc(alocacao.id))
+      .orderBy(asc(alocacao.inicio), asc(alocacao.id))
```

As aulas deixam de ser ordenadas por início.

```mutacao
arquivo: packages/core/src/importacao/grade.repository.ts
teste: apps/api/test/grade.int.test.ts › a coordenação lê a grade da turma, por dia e horário
-      .orderBy(asc(alocacao.diaSemana), asc(alocacao.inicio), asc(alocacao.id))
+      .orderBy(asc(alocacao.diaSemana), asc(alocacao.id))
```

O horário deixa de sair como `HH:MM`.

```mutacao
arquivo: packages/core/src/importacao/grade.repository.ts
teste: apps/api/test/grade.int.test.ts › a coordenação lê a grade da turma, por dia e horário
-const horario = (valor: string): string => valor.slice(0, 5)
+const horario = (valor: string): string => valor
```

O professor passa a ler a grade de turma em que o vínculo dele não é o confirmado (pendente).

```mutacao
arquivo: packages/core/src/importacao/grade.repository.ts
teste: apps/api/test/grade.int.test.ts › o professor com vínculo confirmado lê a grade da turma
-          eq(vinculo.estado, 'confirmado'),
```

O professor passa a ler a grade de qualquer turma em que tenha vínculo confirmado, em vez da pedida.

```mutacao
arquivo: packages/core/src/importacao/grade.repository.ts
teste: apps/api/test/grade.int.test.ts › o professor com vínculo confirmado lê a grade da turma
           eq(vinculo.anoLetivoId, anoLetivoId),
-          eq(vinculo.turmaId, turmaId),
```

O professor passa a ler a grade em que o vínculo confirmado é de outro professor.

```mutacao
arquivo: packages/core/src/importacao/grade.repository.ts
teste: apps/api/test/grade.int.test.ts › o professor com vínculo confirmado lê a grade da turma
-          eq(vinculo.usuarioId, requestSessao().usuarioId),
```

A coordenação cai no ramo do professor: a grade dela responde como a inexistente.

```mutacao
arquivo: apps/api/src/estrutura/grade/grade.service.ts
teste: apps/api/test/grade.int.test.ts › a coordenação lê a grade da turma, por dia e horário
-    if (alcance === 'unidade') {
+    if (false) {
```

O filtro com o ano de outra escola deixa de ser inexistente (o ano indefinido quebra a leitura).

```mutacao
arquivo: apps/api/src/estrutura/grade/grade.service.ts
teste: apps/api/test/grade.int.test.ts › a grade da escola B, para a coordenação e para o professor da A
-      if (ano === undefined || !(await grade.turmaExiste(ano.id, consulta.turmaId))) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+      if (!(await grade.turmaExiste(ano.id, consulta.turmaId))) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

A turma da escola B, lida pela coordenação da A, deixa de ser inexistente.

```mutacao
arquivo: apps/api/src/estrutura/grade/grade.service.ts
teste: apps/api/test/grade.int.test.ts › a grade da escola B, para a coordenação e para o professor da A
-      if (ano === undefined || !(await grade.turmaExiste(ano.id, consulta.turmaId))) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+      if (ano === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

O professor passa a aceitar o filtro de ano.

```mutacao
arquivo: apps/api/src/estrutura/grade/grade.service.ts
teste: apps/api/test/grade.int.test.ts › com ano em curso, o professor com filtro de ano
-    if (alcance !== 'turma_vinculada' || consulta.anoLetivoId !== undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+    if (alcance !== 'turma_vinculada') throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

O professor passa a ler a grade sem ter vínculo confirmado na turma.

```mutacao
arquivo: apps/api/src/estrutura/grade/grade.service.ts
teste: apps/api/test/grade.int.test.ts › o professor com vínculo confirmado lê a grade da turma
-    if (!(await grade.professorTemVinculoConfirmadoNaTurma(anoEmCurso, consulta.turmaId))) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+    if (false && !(await grade.professorTemVinculoConfirmadoNaTurma(anoEmCurso, consulta.turmaId))) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

O encerramento da grade deixa de limitar o `update` aos vínculos que o `select` achou abertos: encerraria o ano inteiro da escola.

```mutacao
arquivo: packages/core/src/estrutura/vinculo.repository.ts
teste: apps/api/test/grade.int.test.ts › encerrar o "sai da grade" só alcança o vínculo de professor aberto da escola e do ano pedidos
falha: expect(await estadoDoVinculo(doAluno)).toBe('confirmado')
-      .where(and(eq(vinculo.escolaId, escolaId), eq(vinculo.anoLetivoId, anoLetivoId), inArray(vinculo.id, abertos.map((aberto) => aberto.id))))
+      .where(and(eq(vinculo.escolaId, escolaId), eq(vinculo.anoLetivoId, anoLetivoId)))
```

O encerramento da grade deixa de travar a linha do vínculo: o confirmar do professor, ainda aberto, não é esperado, e o job leria `pendente`.

```mutacao
arquivo: packages/core/src/estrutura/vinculo.repository.ts
teste: apps/api/test/grade.int.test.ts › o job contra o confirmar do professor no vínculo marcado
       .orderBy(asc(vinculo.id))
-      .for('update')
```

A trava do passo (3) deixa de pegar a turma do vínculo marcado: o job não espera o gerar que está no meio, e o acesso que nasceu fica.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: apps/api/test/grade.int.test.ts › o gerar parado depois do insert: o job com a marca espera a turma
-    const turmas = new Set([...turmasTocadas(lido.data, await repositorio.turmasDoAno(ano.id)), ...aEncerrar.map(({ turmaId }) => turmaId)])
+    const turmas = new Set([...turmasTocadas(lido.data, await repositorio.turmasDoAno(ano.id))])
```

A mesma trava da turma do marcado, vista pelo outro lado da corrida: com o job parado, o gerar não espera a turma e não reconfere o vínculo.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: apps/api/test/grade.int.test.ts › o job parado com a turma travada: o gerar espera
-    const turmas = new Set([...turmasTocadas(lido.data, await repositorio.turmasDoAno(ano.id)), ...aEncerrar.map(({ turmaId }) => turmaId)])
+    const turmas = new Set([...turmasTocadas(lido.data, await repositorio.turmasDoAno(ano.id))])
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (1ª) | A resposta 404 do papel `rede` em `GET /v1/grade` está provada só na matriz; caberia um caso de integração | F14: o caso de integração da rede em `GET /v1/grade` nasce quando a rede tiver sessão. Hoje não há como criar uma (`usuario_papel_valido` só aceita coordenador, professor e aluno); o `nunca` da rede em `grade` está em `matriz.test.ts:141-145` |
| tenancy-guardian (1ª) | `grade.repository.ts:27`, `:54`, `:69`: tirar só o termo `escolaId` não faz teste falhar; registrar na retro que essa camada não tem teste, por desenho | A retro da funcionalidade (`/seguir` fecha com `retro`). Não há teste possível: o esquema prende o ano a uma escola só |
| privacy-guardian (1ª) | Na tela da 14.0, conferir que o `rotulo` do candidato não vai para log nem telemetria do frontend | Tarefa 14.0 (a tela da grade) |
| infra-guardian (1ª) | `encerrarOsMarcados`: `revogarDeQuemSaiu` faz uma consulta por vínculo marcado; fazer em lote se a coordenação marcar dezenas | `TODO.md`: muda código e a chamada compartilha o `CicloDeVidaRepository` com a 9.0 e o `encerrar`; hoje o número de consultas é limitado pelos candidatos |
| infra-guardian (1ª) | A reimportação não está no cenário de carga; a validação confirma que a janela do despachante cobre o tipo `grade` | Validação da funcionalidade (`/validar`): roda em lote, fora do horário letivo |
| infra-guardian (1ª) | Corrida com as duas transações abertas (professor confirma ou contesta durante o passo 3) | Já é o caso (c) do item 1 da ordem: `grade.int.test.ts › o job contra o confirmar do professor no vínculo marcado` |
| revisor-geral (1ª) | `vinculo.repository.ts:295-315` repete `encerrarVinculosDaPessoa` (`ciclo-de-vida.repository.ts:99-117`); juntar num helper se aparecer um terceiro encerramento em lote | `TODO.md`: o revisor só pede quando houver terceiro; mexe em arquivo de outra tarefa |
| conformidade-reviewer (1ª) | A sala é texto livre e pode levar nome de pessoa | Já registrado em `docs/lgpd.md`, linha "Aula da grade", e passa para a tarefa 14.0 (o próprio revisor diz que é "só para a retro") |
| revisor-geral (2ª) | `cenarios.md` não tem cenário para a aula do colega com vínculo `pendente` ou `contestado` que aparece na grade (a `techspec.md` §4 agora diz isso); vale um `[I]` positivo | Tarefa 14.0 (a tela da grade): é ela que mostra o nome do colega e escreve o cenário; a validação confere o RF16 contra ele |
| revisor-geral (2ª) | O `quando` do `WriteBlockTrigger` monta o SQL com o id interpolado; usar parâmetro se o `WriteBlockTrigger` aceitar | `TODO.md`: só teste, e o id é um UUID gerado no próprio caso; depende de `apps/api/test/write-block-trigger.ts`, que é de outra tarefa |
| test-engineer (2ª) | Caso (b): o `acessosVigentes(...) == []` do fim também passaria com a mutação; um comentário diria que quem prova são a espera da trava e o `NAO_ENCONTRADO` | A retro da funcionalidade: só comentário em teste, e as duas linhas que provam estão nos blocos de mutação |
| test-engineer (2ª) | A trava do professor do vínculo marcado no `travar` (`grade.ts:583`) só tem prova de unidade; não há corrida com o `desativar` nem com o aceite do mesmo professor | A retro, ou quando houver caso de produto que dependa disso: o revisor diz que não bloqueia, e a ordem global de travas já é provada pelo espião |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-05 11:27:18 | 2026-11-05 11:27:50 | `conformidade-reviewer` | 1 | APROVADO | a3a2fff9a45f4d919 |
| 2026-11-05 11:27:04 | 2026-11-05 11:27:57 | `tenancy-guardian` | 1 | APROVADO | a33800960ed9f8208 |
| 2026-11-05 11:27:07 | 2026-11-05 11:28:09 | `privacy-guardian` | 1 | APROVADO | a5db32023a3e56014 |
| 2026-11-05 11:27:10 | 2026-11-05 11:28:22 | `infra-guardian` | 1 | APROVADO | a3f52cd3f6163ab59 |
| 2026-11-05 11:27:15 | 2026-11-05 11:28:59 | `revisor-geral` | 1 | APROVADO | aeb6a396cf0a070fd |
| 2026-11-05 11:27:12 | 2026-11-05 11:30:19 | `test-engineer` | 1 | REPROVADO | aad56b6c4df721001 |
| 2026-11-05 11:48:45 | 2026-11-05 11:49:04 | `revisor-geral` | 2 | APROVADO | acbbc92256447aa15 |
| 2026-11-05 11:48:39 | 2026-11-05 11:50:09 | `test-engineer` | 2 | APROVADO | a7e055645533994bb |
