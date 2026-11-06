# Tarefa 11.0 — Gravar a grade gera a alocação e os vínculos que o professor confirma

**Funcionalidade:** onboarding-por-convite · **Depende de:** 6.0, 7.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

A planilha de grade (turma, disciplina, professor, dia, início, fim, sala) grava a `alocacao` e, para cada turma ×
disciplina × professor sem vínculo, um vínculo pendente (`origem = grade`) que o professor confirma ou contesta (A1).
Turma, disciplina e professor inexistentes nascem ao gravar; conflito de horário é aviso.

## Contexto necessário

- `techspec.md` §3 (`alocacao`, `vinculo.origem`), §5 "Gravar" ("Grade": reaproveita o vínculo aberto ou cria um
  pendente; o do ano planejado só se confirma em curso), "O job" passo (1) (o professor novo)
- `prd.md` RF7, RF8; PRD §7 ("Professor discorda", "Grade com professor não convidado", "ano planejado")
- `cenarios.md` "RF7 e RF8"; regra 60 itens 8 e 8a
- Arquivo do titular (regra 20, item 19; `docs/lgpd.md`, linha da aula da grade: o titular é o professor): a 2.0 deixou a `alocacao` fora
  dele (`packages/shared/src/privacidade/classificacao.ts`, comentário da `alocacao`); esta tarefa, que a grava, põe no arquivo do
  professor a leitura das aulas dele pelo vínculo (dia, horário e sala), com o caso em `apps/api/test/arquivo-do-titular.int.test.ts`
- Código: os tipos professores (6.0) e alunos (7.0, a turma nova); `packages/core/src/estrutura/vinculo.repository.ts`;
  `apps/api/test/vinculo.int.test.ts`

## Subtarefas

- [x] 11.1 — Tipo grade: classificação (horário impossível é erro; linha sem professor é erro; professor em duas turmas e turma com duas aulas no mesmo horário são aviso; turma, disciplina e professor "novo")
- [x] 11.2 — Gravar: `alocacao`; vínculo pendente `origem = grade`, ou o vínculo aberto reaproveitado; o encerrado não reabre; o contestado não volta
- [x] 11.3 — O vínculo pendente do ano planejado só se confirma com o ano em curso
- [x] 11.4 — Passo (3): vínculos e professores relidos; `vinculo_ativo_unico` violado: `desatualizada` na mesma execução
- [x] 11.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/importacao/tipos/grade.ts` | novo |
| `packages/core/src/importacao/motor.ts`, `index.ts` | alterado |
| `packages/core/src/estrutura/vinculo.repository.ts` | alterado |
| `apps/api/src/estrutura/vinculo/vinculo.service.ts` | alterado |
| `apps/worker/test/gravar-planilha-grade.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| Tripla sem vínculo vira vínculo pendente com `origem = grade` | integração | caminho feliz (RF8) | `gravar-planilha-grade.int.test.ts › tripla sem vínculo vira um vínculo pendente …` |
| Professor em duas turmas no mesmo horário: aviso, e grava | integração | RF7 | `gravar-planilha-grade.int.test.ts › professor em duas turmas no mesmo horário: aviso …` (a prévia mostra o aviso nas duas linhas, e as duas aulas gravam) |
| Turma com duas aulas no mesmo horário: aviso, e grava | integração | RF7 | `gravar-planilha-grade.int.test.ts › turma com duas aulas no mesmo horário: aviso …` (a prévia e o gravar) |
| Aula das 9h às 8h: erro | integração | RF7 | `gravar-planilha-grade.int.test.ts › aula das 9h às 8h é erro na prévia …` (e o gravar a recusa com `ENTRADA_INVALIDA`, sem importação) |
| Linha sem professor: erro | integração | | `gravar-planilha-grade.int.test.ts › linha sem professor é erro na prévia …` (e o gravar a recusa) |
| Professor com duas disciplinas na turma: dois vínculos pendentes | integração | borda | `gravar-planilha-grade.int.test.ts › o professor com duas disciplinas …` (um vínculo por disciplina, e cada aula no seu) |
| Disciplina e professor inexistentes: "novo" na prévia, e nascem ao gravar | integração | RF7 | `gravar-planilha-grade.int.test.ts › turma, disciplina e professor que a escola não tem …` (a turma na série do nome, o professor `pendente` com convite) e `… › o professor `desativado` volta pela grade …` |
| Antes de confirmar, o professor não alcança a turma | integração | RF8 | `gravar-planilha-grade.int.test.ts › antes de confirmar, o professor não alcança a turma …` (o `TurmaRepository.aberta` com `turma_vinculada`, antes e depois do `decidir`) |
| Vínculo confirmado não muda | integração | RF8 | `… › o vínculo confirmado não muda …` |
| Vínculo feito à mão com a mesma tripla é reaproveitado, sem pendente duplicado | integração | | `… › o vínculo feito à mão com a mesma tripla é reaproveitado …` (continua de `origem = coordenacao`) |
| Vínculo encerrado com a mesma tripla não reabre: nasce um pendente | integração | vínculo encerrado e aberto | `… › o vínculo encerrado com a mesma tripla não reabre …` e `… › a mesma tripla com um vínculo encerrado e outro aberto …` (a aula vai para o aberto, e nenhum nasce) |
| Reimportar não reabre o contestado | integração | borda do PRD | `… › reimportar não reabre o contestado …` |
| Vínculo pendente do planejado: o professor não o vê nem confirma; com o ano em curso, confirma | integração | ano | `… › o ano planejado: o vínculo pendente dele o professor não vê nem confirma …` (as aulas do ano em curso não mudam) e `… › a planilha da grade não toca o ano em curso quando o destino é o planejado …` |
| [P] Vínculo reaproveitado encerrado à mão entre o (2) e o (3): `desatualizada`, nenhuma alocação em vínculo encerrado | [P] | releitura | `… › [P] o vínculo reaproveitado encerrado à mão entre o passo (2) e o (3) …` |
| [P] Vínculo à mão com a mesma tripla criado entre o (2) e o (3): `desatualizada` na mesma execução | [P] | tentativa 1 | `… › [P] vínculo à mão com a mesma tripla criado entre o passo (2) e o (3) …` |
| [P] Professor da grade desativado entre o (2) e o (3): `desatualizada` | [P] | | `… › [P] o professor da grade desativado entre o passo (2) e o (3) …` |
| [P] T1 e T2 contra o `desativar` do professor das duas: zero `40P01`; o espião vê um único `order by id` | [P] | ordem | `… › o passo (3) trava as turmas que a grade toca num único `for no key update` …` (o espião) e `… › [P] T1 e T2 contra o `desativar` do professor das duas …` (a barreira no `alocacao`, o `desativar` do `CicloDeVidaService` e zero erro) |
| Falha no segundo lote de 1.200 linhas: zero turmas e vínculos; a conta solta perde o e-mail no `sistema.expurgar-acesso` | integração | | `… › falha no segundo lote de 1.200 linhas …` (um gatilho de teste na aula 701; o expurgo é o `limparLoteDeContasSemUso`, a rotina do `sistema.expurgar-acesso`) |
| Professor sobe a grade: recusado | integração | permissão | `apps/api/test/importacao.int.test.ts › o professor, o aluno e o tipo que não existe …` (a prévia e o gravar da grade respondem `NAO_ENCONTRADO`) |
| Auditoria `vinculo.criado` da grade, com a origem | integração | RF17 | `… › tripla sem vínculo vira um vínculo pendente …` (a coordenação como autora, `origem: 'grade'`, sem nome nem e-mail) |
| Isolamento no repository: no contexto da escola A, o ano, as aulas, os vínculos e as disciplinas da B não são lidos | integração | regra 10, item 5 | `gravar-planilha-grade.int.test.ts › isolamento no repository …` (e a aula de um ano não é lida pelo id de outro) |
| Isolamento na grade: o professor de outra escola com o mesmo e-mail não recebe vínculo nem aula | integração | regra 10 | `… › isolamento: o professor de outra escola com o mesmo e-mail …` |
| Job executado duas vezes: grava uma vez | integração | regra 80, item 7 | `… › o job executado duas vezes grava uma vez …` |
| Reimportar: a aula que já existe muda de fim e de sala e mantém o id; a igual é "já existe" | integração | RF7 | `… › a aula que já existe muda de fim e de sala …` |
| Trava do convite da escola na mão de outra operação: o passo (3) espera, estoura o `lock_timeout` e volta | integração | ordem global | `… › a trava do convite da escola …` |
| [P] Conta do professor novo limpa entre o (1) e o (3): a tentativa volta sem gravar, e a nova refaz o (1) | [P] | releitura | `… › [P] o expurgo de acesso limpa a conta do professor novo …` |
| Classificação sem banco: a prévia, os avisos, os estados do professor, a assinatura e a trava | unidade | RF7 | `packages/core/src/importacao/tipos/grade.test.ts` |
| O arquivo do titular leva as aulas do professor (dia, horário e sala), e não as do colega | integração | regra 20, item 19 | `apps/api/test/arquivo-do-titular.int.test.ts › … alocacao` |

## Como testar

- Vínculo e confirmação: `apps/api/test/vinculo.int.test.ts` (confirmar e contestar da A1); escopo do professor: `apps/api/test/acesso-da-turma.int.test.ts`
- Job: o molde de `apps/worker/test/gravar-planilha.int.test.ts` (4.0); barreira: `WriteBlockTrigger`; espião: o da 3.0
- Comando: `npx vitest run --project integracao apps/worker/test/gravar-planilha-grade.int.test.ts`
- Armadilha (rodada 8): o único violado se prova com o processor chamado uma vez

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3, a mesma tripla com um vínculo encerrado e outro aberto.

## Fora do escopo desta tarefa

Reimportar a grade e ler a grade (12.0); o convite por e-mail do professor novo (F2c).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

--faltando: 17 linhas (103 blocos, 14 motivos)

**Sem bloco (motivo):** (1) `vinculo.repository.ts:296` e `alocacao.repository.ts:45`, os `if (lista.length === 0) return`: o `criarVinculosDeProfessorDaGrade` e o `gravarAulas` percorrem a lista em lotes e nunca chamam o método com lista vazia; o atalho só poupa o `values([])`, que o Drizzle recusa. (2) `grade.ts:50`, o regex do `horarioDaAulaSchema`: o horário guardado sai do `lerHorario`, que já devolve `HH:MM` válido; o schema só dá a forma ao que o job relê, e o caso da linha guardada sem forma (`o que o gravar guardou sem a forma da grade`) prova a recusa do que não é a aula. (3) Os `?? ''` de `campos[...]` (`campoDe`): o `campos` vem do `lerTabela` com todas as colunas do cabeçalho; o `?? ''` é só o tipo do índice (a coluna opcional, a sala, vem como texto vazio). (4) Os `?? []` de `Map.get` (em `destinoDaTurma`, `destinoDaDisciplina`, `avisosDe`, `indexar` e na trava das turmas): são o valor inicial do agrupamento; sem ele o spread de `undefined` quebra toda prévia, e qualquer caso que passe por ali o vê. (5) Os `professor.email === null ? [] : […]` (em `indexar`, no `travar` e na leitura dos professores do `gravar`): sem eles a chave `null` entra no mapa e nenhum e-mail lido a acha; o resultado é o mesmo (a mesma razão do `professores.ts`, 6.0). (6) O `!mapa.has(chave)` do `guardarSeNovo` tem bloco pelos nomes da turma e da disciplina; para o vínculo, o valor guardado depende só da chave (que já leva turma, disciplina e e-mail), e a primeira linha ou a última dá o mesmo vínculo. (7) O `sort` das chaves (`emOrdemDe`) e o dos e-mails (`professoresNovos`): ordem estável de criação (turma, disciplina, convite), sem efeito no que a coordenação vê nem no que se grava. (8) O `id === undefined` do `idDe`: guarda de tipo; as quatro tabelas se enchem das mesmas listas que o plano percorre, e nenhum caso chega ali. (9) O `resultado === 'ja_existe'` do `flatMap` do `aplicar` e os `aula === undefined || vinculo === undefined`: a aula igual escreveria os mesmos valores no `upsert`, e os dois `undefined` só estreitam o tipo (a linha com erro não chega ao plano, porque o gravar a recusou). (10) O termo `eq(vinculo.papel, 'professor')` do `professoresAbertosDoAno` não tem bloco: a chave do mapa é (professor, turma, disciplina) e o vínculo de aluno tem outro usuário e disciplina nula, de modo que sem o termo o resultado é o mesmo; ele fica porque a leitura traz só o que a grade usa (regra 20, o mínimo). (11) O termo `eq(vinculo.anoLetivoId, anoLetivoId)` do `professoresAbertosDoAno`: a FK `vinculo_turma_do_ano_da_escola_fk` amarra a turma ao ano do vínculo, e a grade casa o vínculo pela turma do ano de destino, de modo que sem o termo o resultado é o mesmo; ele fica por ser o escopo do ano (regra 10, item 2). (12) Os termos `t.escola_id`, `v.escola_id` e `v.papel = 'professor'` da leitura da `alocacao` em `leitura-do-titular.ts`: a `alocacao` e o vínculo só ligam por FK composta com a escola, o `titularId` é de uma escola só e a grade só põe aula em vínculo de professor, de modo que sem eles o resultado é o mesmo; ficam como escopo de leitura (regra 10, item 3; o termo do `usuario_id` tem bloco). (14) O `temControle(turma)` do `lerOndeEh`: o nome da turma com caractere de controle não casa com o `FORMATO_DA_TURMA` (`^(\d)\s*[ºo°ª]?\s*(ano)?\s*([a-z])$`), não acha turma da escola e não tem série, e o `destinoDaTurma` devolve o mesmo `turma_invalida`; sem o termo o resultado é o mesmo, e o caso de controle na turma (`caractere de controle na turma`) prova o código. Os outros três (disciplina, nome e sala) têm bloco. (13) O [P] contra o `desativar` (`T1 e T2`) prova o que o job e o `desativar` fazem juntos, com o vínculo da professora já na turma de id maior; a ordem em que o job trava as turmas (uma consulta, `order by id`) é provada pelo espião do passo (3), e o `desativar` espera na trava do usuário antes de qualquer turma: por isso o caso passaria até com as turmas travadas em ordem inversa, e a ordem das turmas fica com o espião.

O professor `desativado` deixa de ser chamado de volta pela grade.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › o professor da escola é o do e-mail
-const ESTADOS_QUE_VOLTAM: ReadonlySet<EstadoDoProfessor> = new Set(['revogado', 'desativado'])
+const ESTADOS_QUE_VOLTAM: ReadonlySet<EstadoDoProfessor> = new Set(['revogado'])
```

O professor de convite `revogado` deixa de ser chamado de volta pela grade.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › o professor da escola é o do e-mail
-const ESTADOS_QUE_VOLTAM: ReadonlySet<EstadoDoProfessor> = new Set(['revogado', 'desativado'])
+const ESTADOS_QUE_VOLTAM: ReadonlySet<EstadoDoProfessor> = new Set(['desativado'])
```

O professor de convite `vencido` passa a receber o vínculo, em vez de erro na linha.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › o professor da escola é o do e-mail
-  return ESTADOS_ALOCAVEIS.has(existente.estado) ? { tipo: 'existente', usuarioId: existente.usuarioId, estado: existente.estado } : 'professor_com_convite_vencido'
+  return true ? { tipo: 'existente', usuarioId: existente.usuarioId, estado: existente.estado } : 'professor_com_convite_vencido'
```

O e-mail sem professor na escola deixa de ser "novo".

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › o professor da escola é o do e-mail
-  if (existente === undefined) return { tipo: 'novo', email, nome, usuarioId: null, estado: null }
+  if (existente === null) return { tipo: 'novo', email, nome, usuarioId: null, estado: null }
```

A mesma aula duas vezes deixa de ser erro na segunda.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › a mesma aula duas vezes
-    if (vistas.has(chaveDaAula)) return { linha, resultado: 'erro', erro: 'aula_repetida' }
+    if (false && vistas.has(chaveDaAula)) return { linha, resultado: 'erro', erro: 'aula_repetida' }
```

A aula só com outra sala deixa de ser "entra": a planilha igual no fim e diferente na sala é "já existe".

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › a aula igual no fim e diferente só na sala
-    const igual = gravada !== undefined && gravada.fim === aula.fim && gravada.sala === aula.sala
+    const igual = gravada !== undefined && gravada.fim === aula.fim 
```

O vínculo aberto da tripla deixa de ser achado: toda tripla ganha um vínculo novo.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › o vínculo aberto da tripla é reaproveitado
-  const existe = turma.tipo === 'existente' && disciplina.tipo === 'existente' && usuarioId !== null
+  const existe = turma.tipo === 'existente' && disciplina.tipo === 'existente' && false
```

A aula gravada deixa de ser achada: a aula igual não é mais "já existe".

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › o vínculo aberto da tripla é reaproveitado
-  const gravada = vinculo.tipo === 'existente' ? indices.aulasGravadas.get(JSON.stringify([vinculo.id, aula.dia, aula.inicio])) : undefined
+  const gravada = undefined
```

A aula que traz disciplina nova deixa de ser "novo".

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › a disciplina que a escola não tem, sozinha
-const trazAlgoNovo = ({ turma, disciplina, professor }: Destinos): boolean => turma.tipo === 'nova' || disciplina.tipo === 'nova' || professor.tipo === 'novo'
+const trazAlgoNovo = ({ turma, disciplina, professor }: Destinos): boolean => turma.tipo === 'nova' || professor.tipo === 'novo'
```

O professor em duas turmas no mesmo horário passa a avisar também na mesma turma.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › o mesmo professor em duas disciplinas da mesma turma
-  cruzar(doProfessor, 'professor_em_duas_turmas', (a, b) => a.turma !== undefined && b.turma !== undefined && refDaTurma(a.turma) !== refDaTurma(b.turma))
+  cruzar(doProfessor, 'professor_em_duas_turmas', (a, b) => a.turma !== undefined && b.turma !== undefined && true)
```

Terminar às 9h e começar às 9h passa a ser o mesmo horário.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › professor em duas turmas no mesmo horário
-const sobrepoe = (a: AulaLida, b: AulaLida): boolean => a.inicio < b.fim && b.inicio < a.fim
+const sobrepoe = (a: AulaLida, b: AulaLida): boolean => a.inicio <= b.fim && b.inicio <= a.fim
```

O par que não se sobrepõe passa a avisar.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › professor em duas turmas no mesmo horário
-          if (a.aula === undefined || b.aula === undefined || !sobrepoe(a.aula, b.aula) || !valeParaOPar(a, b)) continue
+          if (a.aula === undefined || b.aula === undefined || !valeParaOPar(a, b)) continue
```

O aviso do professor deixa de vir antes do da turma.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › turma com duas aulas no mesmo horário
-          for (const { linha } of [a, b]) if (!avisos.has(linha)) avisos.set(linha, aviso)
+          for (const { linha } of [a, b]) avisos.set(linha, aviso)
```

A linha com erro deixa de ser pulada ao cruzar os avisos.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › a turma sem série no nome é erro
-    if (linha.aula === undefined || linha.turma === undefined) continue
+    
```

O primeiro professor novo deixa de dar o nome: a última linha dele vence.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › o plano chama o professor novo pelo convite da planilha
-    if (professor.tipo === 'novo') guardarSeNovo(professores, professor.email, { email: professor.email, nome: professor.nome })
+    if (professor.tipo === 'novo') professores.set(professor.email, { email: professor.email, nome: professor.nome })
```

A aula que muda de fim ou de sala deixa de contar em `aulas`.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: apps/worker/test/gravar-planilha-grade.int.test.ts › a aula que já existe muda de fim e de sala
-    aulas: linhas.filter(({ resultado }) => resultado === 'novo' || resultado === 'entra').length,
+    aulas: linhas.filter(({ resultado }) => resultado === 'novo' ).length,
```

A aula gravada deixa de entrar na assinatura: a coordenação não vê a mudança do fim ou da sala.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › a assinatura muda quando só o estado do professor
-    gravada === undefined ? null : [gravada.id, gravada.fim, gravada.sala],
+    null,
```

O vínculo da linha deixa de entrar na assinatura.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › a assinatura muda com o que a coordenação viu
-    vinculo === undefined ? null : vinculo.tipo === 'existente' ? [vinculo.id, vinculo.estado] : vinculo.chave,
+    null,
```

O estado do professor deixa de entrar na assinatura.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › a assinatura muda quando só o estado do professor
-    professor === undefined ? null : [professor.tipo, professor.usuarioId, professor.estado],
+    null,
```

A turma da linha deixa de entrar na assinatura.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › a assinatura muda quando só o estado do professor
-    turma === undefined ? null : refDaTurma(turma),
+    null,
```

A disciplina da linha deixa de entrar na assinatura.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › a assinatura muda quando só o estado do professor
-    disciplina === undefined ? null : refDaDisciplina(disciplina),
+    null,
```

A linha com erro deixa de mostrar o erro na prévia.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › aponta o primeiro erro de cada linha
-  if (erro !== undefined) return { linha, resultado: 'erro', erro }
+  
```

A linha com aviso deixa de levá-lo à prévia.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › professor em duas turmas no mesmo horário
-  return { linha, resultado, ...(aviso === undefined ? {} : { aviso }) }
+  return { linha, resultado,  }
```

A turma ambígua deixa de ser erro.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › a turma sem série no nome é erro
-  if (achadas.length > 1) return 'turma_ambigua'
+  if (achadas.length > 5) return 'turma_ambigua'
```

A turma que a escola já tem deixa de ser achada: toda turma é nova.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › o vínculo aberto da tripla é reaproveitado
-  if (unica !== undefined) return { tipo: 'existente', turmaId: unica.id }
+  if (unica === null) return { tipo: 'existente', turmaId: unica.id }
```

A turma fora do recorte (4º ano) deixa de ser erro.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › a turma sem série no nome é erro
-  return serie === null ? 'turma_invalida' : { tipo: 'nova', chave: indice, serie, nome }
+  return false ? 'turma_invalida' : { tipo: 'nova', chave: indice, serie, nome }
```

A disciplina ambígua deixa de ser erro.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › são a mesma disciplina da escola
-  if (achadas.length > 1) return 'disciplina_ambigua'
+  if (achadas.length > 5) return 'disciplina_ambigua'
```

A disciplina da escola deixa de ser achada: toda disciplina é nova.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › escola vazia: toda linha
-  return unica === undefined ? { tipo: 'nova', chave, nome } : { tipo: 'existente', id: unica.id }
+  return unica === null ? { tipo: 'nova', chave, nome } : { tipo: 'existente', id: unica.id }
```

O erro da turma deixa de parar a linha.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › a turma sem série no nome é erro
-  if (typeof turma === 'string') return turma
+  
```

O erro da disciplina deixa de parar a linha.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › são a mesma disciplina da escola
-  if (typeof disciplina === 'string') return disciplina
+  
```

O erro do professor deixa de parar a linha.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › o professor da escola é o do e-mail
  const professor = destinoDoProfessor(aula, indices.professoresPorEmail)
-  if (typeof professor === 'string') return professor
+  
```

A linha com erro deixa de ser pulada ao somar o que nasce.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › a turma sem série no nome é erro
-    if (!resolvida(linha)) continue
+    
```

A linha deixa de acusar `turma_vazia`.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › aponta o primeiro erro de cada linha
-  if (turma === '') return 'turma_vazia'
+  
```

A linha deixa de acusar `turma_invalida`.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › aponta o primeiro erro de cada linha
-  if (turma.length > 40 || temControle(turma)) return 'turma_invalida'
+  
```

A linha deixa de acusar `disciplina_vazia`.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › aponta o primeiro erro de cada linha
-  if (disciplina === '') return 'disciplina_vazia'
+  
```

A linha deixa de acusar `disciplina_invalida`.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › aponta o primeiro erro de cada linha
-  if (disciplina.length > 80 || temControle(disciplina)) return 'disciplina_invalida'
+  
```

O erro do professor deixa de parar a leitura da linha.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › aponta o primeiro erro de cada linha
  const professor = lerProfessor(campos)
-  if (typeof professor === 'string') return professor
+  
```

A linha deixa de acusar `dia_invalido`.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › aponta o primeiro erro de cada linha
-  if (dia === null) return 'dia_invalido'
+  
```

A linha deixa de acusar `horario_invalido`.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › aponta o primeiro erro de cada linha
-  if (inicio === null || fim === null) return 'horario_invalido'
+  
```

A linha deixa de acusar `fim_antes_do_inicio`.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › aponta o primeiro erro de cada linha
-  return inicio >= fim ? 'fim_antes_do_inicio' : { dia, inicio, fim }
+  return { dia, inicio, fim }
```

A linha deixa de acusar `sala_longa`.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › aponta o primeiro erro de cada linha
-  if (sala.length > TAMANHO_MAXIMO_DA_SALA_DA_AULA || temControle(sala)) return 'sala_longa'
+  
```

A linha deixa de acusar `sem_professor`.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › aponta o primeiro erro de cada linha
-  if (nome === '' && digitado === '') return 'sem_professor'
+  
```

A linha deixa de acusar `nome_vazio`.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › aponta o primeiro erro de cada linha
-  if (nome === '') return 'nome_vazio'
+  
```

A linha deixa de acusar `nome_invalido`.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › aponta o primeiro erro de cada linha
-  if (nome.length > TAMANHO_MAXIMO_NOME_DIGITADO || temControle(nome)) return 'nome_invalido'
+  
```

O e-mail inválido deixa de ser erro.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › aponta o primeiro erro de cada linha
-  return email.success ? { nome, email: email.data } : 'email_invalido'
+  return true ? { nome, email: email.data } : 'email_invalido'
```

A linha incompleta deixa de ser erro.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › aponta o primeiro erro de cada linha
-    const lidas = tabela.linhas.map(({ linha, campos }) => ({ linha, lido: campos === null ? ('linha_incompleta' as const) : lerLinha(linha, campos) }))
+    const lidas = tabela.linhas.map(({ linha, campos }) => ({ linha, lido: false ? ('linha_incompleta' as const) : lerLinha(linha, campos) }))
```

O dia fora de 1 a 7 passa a valer.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › aponta o primeiro erro de cada linha
-  return /^[1-7]$/.test(limpo) ? Number(limpo) : (DIAS_PELO_NOME.get(limpo) ?? null)
+  return /^[1-9]$/.test(limpo) ? Number(limpo) : (DIAS_PELO_NOME.get(limpo) ?? null)
```

O dia por extenso com "-feira" deixa de ser lido.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › aceita o dia pelo número ou pelo nome
-  const limpo = normalizarTexto(texto).replace(/[\s-]?feira$/, '')
+  const limpo = normalizarTexto(texto).replace(/$^/, '')
```

O horário em "8h50" deixa de ser lido.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › em quatro grafias
-  const achado = /^(\d{1,2})(?:h(\d{2})?|:(\d{2})(?::\d{2})?)$/.exec(normalizarTexto(texto))
+  const achado = /^(\d{1,2})(?::(\d{2})(?::\d{2})?)$/.exec(normalizarTexto(texto))
```

O texto que não é horário deixa de ser rejeitado.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › aponta o primeiro erro de cada linha
-  if (achado === null) return null
+  
```

A hora 25 passa a valer.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › aponta o primeiro erro de cada linha
-  return hora > 23 || minuto > 59 ? null : `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`
+  return hora > 99 || minuto > 59 ? null : `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`
```

O minuto 60 passa a valer.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › aponta o primeiro erro de cada linha
-  return hora > 23 || minuto > 59 ? null : `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`
+  return hora > 23 || minuto > 99 ? null : `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`
```

O professor novo sem a conta do passo (1) deixa de falhar.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › professor novo sem a conta do passo
-        if (contaId === undefined) throw new ContaDaPlanilhaPerdidaError()
+        
```

O convite que não se faz deixa de fechar a importação `desatualizada`.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › professor novo sem a conta do passo
-        if (!(await convidarProfessorDaPlanilha(tx, { contaId, nome: novo.nome }))) throw new DiferencaNaPlanilhaError()
+        
```

O vínculo é criado na turma que nasce, mesmo quando a turma já existe.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: apps/worker/test/gravar-planilha-grade.int.test.ts › antes de confirmar, o professor não alcança a turma
-        turmaId: turma.tipo === 'existente' ? turma.turmaId : idDe(turmas.get(turma.chave)),
+        turmaId: false ? turma.turmaId : idDe(turmas.get(turma.chave)),
```

O vínculo é criado na disciplina que nasce, mesmo quando a disciplina já existe.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: apps/worker/test/gravar-planilha-grade.int.test.ts › antes de confirmar, o professor não alcança a turma
-        disciplinaId: disciplina.tipo === 'existente' ? disciplina.id : idDe(disciplinas.get(disciplina.chave)),
+        disciplinaId: false ? disciplina.id : idDe(disciplinas.get(disciplina.chave)),
```

A aula do vínculo aberto vai para um vínculo novo.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: apps/worker/test/gravar-planilha-grade.int.test.ts › o vínculo confirmado não muda
-        return [{ vinculoId: vinculo.tipo === 'existente' ? vinculo.id : idDe(idDoVinculoNovo.get(vinculo.chave)), diaSemana: aula.dia, inicio: aula.inicio, fim: aula.fim, sala: aula.sala }]
+        return [{ vinculoId: false ? vinculo.id : idDe(idDoVinculoNovo.get(vinculo.chave)), diaSemana: aula.dia, inicio: aula.inicio, fim: aula.fim, sala: aula.sala }]
```

A linha com erro de texto entra no que a prévia classifica.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › aponta o primeiro erro de cada linha
-    const validas = lidas.flatMap(({ lido }) => (typeof lido === 'string' ? [] : [lido]))
+    const validas = lidas.flatMap(({ lido }) => [lido])
```

A prévia deixa de mostrar os erros de leitura do texto.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › aponta o primeiro erro de cada linha
-    const dosErros = lidas.flatMap(({ linha, lido }): PreviaDaPlanilhaRow[] => (typeof lido === 'string' ? [{ linha, resultado: 'erro', erro: lido }] : []))
+    const dosErros = lidas.flatMap(({ linha, lido }): PreviaDaPlanilhaRow[] => (typeof lido === 'string' ? [] : []))
```

A grade guardada sem a forma deixa de ser recusada na lista dos e-mails.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › só os professores que a escola ainda não tem
-    if (!lido.success) return undefined
+    
```

A grade guardada sem a forma deixa de ser recusada na trava.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › o que o gravar guardou sem a forma da grade
-    if (!lido.success) return
+    
     const emails = new Set(lido.data.map(({ email }) => email))
```

A grade guardada sem a forma deixa de ser recusada no plano.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › o que o gravar guardou sem a forma da grade
-    return lido.success ? planoDe(ano.id, classificar(ano.id, lido.data, await lerDados(repositorio, ano.id)), contas) : undefined
+    return true ? planoDe(ano.id, classificar(ano.id, lido.data, await lerDados(repositorio, ano.id)), contas) : undefined
```

O professor que a escola já tem (nem novo nem chamado de volta) passa a pedir conta no passo (1).

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › só os professores que a escola ainda não tem
-      return estado === undefined || ESTADOS_QUE_VOLTAM.has(estado)
+      return ESTADOS_QUE_VOLTAM.has(estado)
```

A trava passa a pegar todos os professores da escola, não só os que as linhas citam.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › a trava trava os professores que as linhas citam
-    await repositorio.travarUsuarios(professores.filter(({ email }) => email !== null && emails.has(email)).map(({ usuarioId }) => usuarioId))
+    await repositorio.travarUsuarios(professores.filter(({ email }) => email !== null ).map(({ usuarioId }) => usuarioId))
```

A trava das contas é chamada mesmo sem professor novo.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › a trava trava os professores que as linhas citam
-    if (contas.size > 0 && !(await travarContas(contas))) throw new ContaDaPlanilhaPerdidaError()
+    if ( !(await travarContas(contas))) throw new ContaDaPlanilhaPerdidaError()
```

A conta perdida deixa de falhar a trava.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › conta que perdeu o e-mail entre o passo
-    if (contas.size > 0 && !(await travarContas(contas))) throw new ContaDaPlanilhaPerdidaError()
+    if (contas.size > 0 && false) throw new ContaDaPlanilhaPerdidaError()
```

O tipo de um ano sem professor a cadastrar (o calendário e os alunos) deixa de dispensar a conta do passo (1).

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/worker/test/gravar-planilha.int.test.ts › o job conclui
-  if (tipo.usaAno && tipo.emailsDasContas === undefined) return new Map()
+  
```

A grade passa a pedir os e-mails ao tipo como se fosse a planilha de professores.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/worker/test/gravar-planilha-grade.int.test.ts › tripla sem vínculo vira um vínculo pendente
-  const emails = tipo.usaAno ? await tipo.emailsDasContas?.(repositorio, linhas) : tipo.emailsDasContas(linhas)
+  const emails = false ? await tipo.emailsDasContas?.(repositorio, linhas) : tipo.emailsDasContas(linhas)
```

O motor deixa de recusar o tipo que cadastra professor sem o achar-ou-criar conta do worker.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/worker/test/gravar-planilha-professores.int.test.ts › o motor sem o achar-ou-criar conta do worker
-  if (achar === undefined || travar === undefined) throw new InvariantException('a planilha que cadastra professor precisa do achar-ou-criar conta e da trava das contas do worker')
+  if (false) throw new InvariantException('a planilha que cadastra professor precisa do achar-ou-criar conta e da trava das contas do worker')
```

A grade deixa de pegar a trava do convite da escola antes do ano.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/worker/test/gravar-planilha-grade.int.test.ts › trava as turmas que a grade toca
-  if (tipo.cadastraProfessores === true) await gravacao.travarConviteDaEscola()
+  if (false) await gravacao.travarConviteDaEscola()
```

A trava das contas entregue à grade deixa de conferir o e-mail: a conta perdida passa.

```mutacao
arquivo: packages/core/src/importacao/motor.ts
teste: apps/worker/test/gravar-planilha-grade.int.test.ts › o expurgo de acesso limpa a conta do professor novo
-  await tipo.travar?.(gravacao, ano, linhas, marcas, { contas, travarContas: (daVez) => (travarContas === undefined ? Promise.resolve(true) : travarContas(tx, daVez)) })
+  await tipo.travar?.(gravacao, ano, linhas, marcas, { contas, travarContas: (daVez) => (true ? Promise.resolve(true) : travarContas(tx, daVez)) })
```

A série que a escola já tem deixa de ser reaproveitada ao criar a turma nova.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/gravar-planilha-grade.int.test.ts › turma, disciplina e professor que a escola não tem
-    const serieId = series.get(chaveDaSerie) ?? (await gravacao.criarSerie(pedidoDaSerie(nova.serie)))
+    const serieId = (await gravacao.criarSerie(pedidoDaSerie(nova.serie)))
```

A disciplina de outra escola passa a ser lida como da escola.

```mutacao
arquivo: packages/core/src/estrutura/disciplina.repository.ts
teste: apps/worker/test/gravar-planilha-grade.int.test.ts › isolamento no repository
-      .where(eq(disciplina.escolaId, requireEscolaId()))
+      .where(undefined)
```

O vínculo de outra escola passa a ser lido como da escola.

```mutacao
arquivo: packages/core/src/estrutura/vinculo.repository.ts
teste: apps/worker/test/gravar-planilha-grade.int.test.ts › isolamento no repository
-      .where(and(eq(vinculo.escolaId, requireEscolaId()), eq(vinculo.anoLetivoId, anoLetivoId), eq(vinculo.papel, 'professor'), ne(vinculo.estado, 'encerrado')))
+      .where(and(eq(vinculo.anoLetivoId, anoLetivoId), eq(vinculo.papel, 'professor'), ne(vinculo.estado, 'encerrado')))
```

O vínculo encerrado passa a ser reaproveitado, e a aula cai nele.

```mutacao
arquivo: packages/core/src/estrutura/vinculo.repository.ts
teste: apps/worker/test/gravar-planilha-grade.int.test.ts › o vínculo encerrado com a mesma tripla não reabre
-      .where(and(eq(vinculo.escolaId, requireEscolaId()), eq(vinculo.anoLetivoId, anoLetivoId), eq(vinculo.papel, 'professor'), ne(vinculo.estado, 'encerrado')))
+      .where(and(eq(vinculo.escolaId, requireEscolaId()), eq(vinculo.anoLetivoId, anoLetivoId), eq(vinculo.papel, 'professor')))
```

A aula de outra escola passa a ser lida como da escola.

```mutacao
arquivo: packages/core/src/importacao/alocacao.repository.ts
teste: apps/worker/test/gravar-planilha-grade.int.test.ts › isolamento no repository
-      .where(and(eq(alocacao.escolaId, requireEscolaId()), eq(alocacao.anoLetivoId, anoLetivoId)))
+      .where(and(eq(alocacao.anoLetivoId, anoLetivoId)))
```

A aula de outro ano passa a ser lida como do ano.

```mutacao
arquivo: packages/core/src/importacao/alocacao.repository.ts
teste: apps/worker/test/gravar-planilha-grade.int.test.ts › isolamento no repository
-      .where(and(eq(alocacao.escolaId, requireEscolaId()), eq(alocacao.anoLetivoId, anoLetivoId)))
+      .where(and(eq(alocacao.escolaId, requireEscolaId())))
```

O vínculo aberto achado deixa de ser usado: toda tripla ganha um vínculo novo.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › o vínculo aberto da tripla é reaproveitado
-  return aberto === undefined ? { tipo: 'novo', chave: chaveDaTripla(turma, disciplina, email) } : { tipo: 'existente', id: aberto.id, estado: aberto.estado }
+  return true ? { tipo: 'novo', chave: chaveDaTripla(turma, disciplina, email) } : { tipo: 'existente', id: aberto.id, estado: aberto.estado }
```

A aula do mesmo dia deixa de se distinguir pelo início: duas aulas da tripla viram "repetida".

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › a mesma aula duas vezes
-    const chaveDaAula = JSON.stringify([vinculo.tipo === 'existente' ? vinculo.id : vinculo.chave, aula.dia, aula.inicio])
+    const chaveDaAula = JSON.stringify([vinculo.tipo === 'existente' ? vinculo.id : vinculo.chave, aula.dia])
```

A aula igual à gravada deixa de ser "já existe".

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: apps/worker/test/gravar-planilha-grade.int.test.ts › a aula que já existe muda de fim e de sala
-  const resultado = trazAlgoNovo(destinos) ? 'novo' : igual ? 'ja_existe' : 'entra'
+  const resultado = trazAlgoNovo(destinos) ? 'novo' : false ? 'ja_existe' : 'entra'
```

A aula gravada deixa de ir na classificação da linha.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › a assinatura muda quando só o estado do professor
-  return gravada === undefined ? { resultado } : { resultado, gravada }
+  return { resultado }
```

O aviso deixa de ir da sobreposição para a linha.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › professor em duas turmas no mesmo horário
-    return aviso === undefined ? linha : { ...linha, aviso }
+    return true ? linha : { ...linha, aviso }
```

A turma que nasce deixa de levar o nome da primeira linha.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › levam o nome da primeira linha
-    if (turma.tipo === 'nova') guardarSeNovo(turmas, turma.chave, { chave: turma.chave, nome: turma.nome, serie: turma.serie })
+    if (turma.tipo === 'nova') turmas.set(turma.chave, { chave: turma.chave, nome: turma.nome, serie: turma.serie })
```

A disciplina que nasce deixa de levar o nome da primeira linha.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › levam o nome da primeira linha
-    if (disciplina.tipo === 'nova') guardarSeNovo(disciplinas, disciplina.chave, { chave: disciplina.chave, nome: disciplina.nome })
+    if (disciplina.tipo === 'nova') disciplinas.set(disciplina.chave, { chave: disciplina.chave, nome: disciplina.nome })
```

A turma que a escola já tem deixa de contar por id ao comparar as turmas do professor.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › professor em duas turmas no mesmo horário
-const refDaTurma = (destino: DestinoDaTurma): string => (destino.tipo === 'existente' ? destino.turmaId : `nova:${destino.chave}`)
+const refDaTurma = (destino: DestinoDaTurma): string => (false ? destino.turmaId : `nova:${destino.chave}`)
```

A disciplina que a escola já tem deixa de contar por id na tripla: as duas disciplinas do professor viram um vínculo só.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: apps/worker/test/gravar-planilha-grade.int.test.ts › o professor com duas disciplinas
-const refDaDisciplina = (destino: DestinoDaDisciplina): string => (destino.tipo === 'existente' ? destino.id : `nova:${destino.chave}`)
+const refDaDisciplina = (destino: DestinoDaDisciplina): string => (false ? destino.id : `nova:${destino.chave}`)
```

A aula sem sala deixa de guardar nulo.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: apps/worker/test/gravar-planilha-grade.int.test.ts › tripla sem vínculo vira um vínculo pendente
-  return { linha, ...onde, nome: professor.nome, email: professor.email, ...quando, sala: sala === '' ? null : sala }
+  return { linha, ...onde, nome: professor.nome, email: professor.email, ...quando, sala: sala }
```

O horário em "8h" sem minutos deixa de valer.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › em quatro grafias
-  const [hora, minuto] = [Number(achado[1]), Number(achado[2] ?? achado[3] ?? '0')]
+  const [hora, minuto] = [Number(achado[1]), Number(achado[2] ?? achado[3])]
```

O espaço repetido dentro do nome deixa de ser reduzido a um.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › o e-mail do banco nunca vai
-const compactar = (texto: string): string => texto.replace(/\s+/g, ' ').trim()
+const compactar = (texto: string): string => texto.trim()
```

O professor chamado de volta perde o vínculo aberto que tinha.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › o professor chamado de volta
-  if (ESTADOS_QUE_VOLTAM.has(existente.estado)) return { tipo: 'novo', email, nome, usuarioId: existente.usuarioId, estado: existente.estado }
+  if (ESTADOS_QUE_VOLTAM.has(existente.estado)) return { tipo: 'novo', email, nome, usuarioId: null, estado: existente.estado }
```

A aula do colega entra no arquivo do professor: a leitura liga a `alocacao` a qualquer vínculo da escola.

```mutacao
arquivo: packages/core/src/titular/leitura-do-titular.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › o professor: cada tabela que ele tem aparece
falha: expect(texto).not.toContain(doColega.textos['alocacao.sala'])
-          where t.escola_id = ${escolaId} and t.vinculo_id in (select v.id from vinculo v where v.escola_id = ${escolaId} and v.usuario_id = ${titularId} and v.papel = 'professor')`,
+          where t.escola_id = ${escolaId} and t.vinculo_id in (select v.id from vinculo v where v.escola_id = ${escolaId} and v.papel = 'professor')`,
```

A `alocacao` deixa de entrar no arquivo do titular.

```mutacao
arquivo: packages/shared/src/privacidade/classificacao.ts
teste: packages/core/src/titular/leitura-do-titular.test.ts › entra no arquivo do professor pelo vínculo dele
-  alocacao: { classe: 'categoria', categorias: ['vinculo_encerrado'], arquivo: { entra: true, ligacao: ['vinculo_id'] } },
+  alocacao: { classe: 'categoria', categorias: ['vinculo_encerrado'], arquivo: FORA },
```

A turma ou a disciplina com erro para a leitura da linha na hora, e o professor deixa de ser lido.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › aponta o primeiro erro de cada linha
-  if (typeof onde === 'string') return onde
+  
```

O dia ou o horário com erro deixa de parar a leitura da linha.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › aponta o primeiro erro de cada linha
-  if (typeof quando === 'string') return quando
+  
```

A linha com turma, disciplina ou professor sem destino deixa de sair como erro.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › a turma sem série no nome é erro
-  if (typeof destinos === 'string') return { linha, resultado: 'erro', erro: destinos }
+  
```

O vínculo aberto da tripla deixa de ser procurado.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › o vínculo aberto da tripla é reaproveitado
-  const aberto = existe ? indices.vinculosAbertos.get(JSON.stringify([usuarioId, turma.turmaId, disciplina.id])) : undefined
+  const aberto = undefined
```

O que nasce passa a levar o dado da última linha que o pede, e não o da primeira.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › levam o nome da primeira linha
-  if (!mapa.has(chave)) mapa.set(chave, valor)
+  mapa.set(chave, valor)
```

O vínculo que já existe passa a ser contado como vínculo a criar.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › o vínculo aberto da tripla é reaproveitado
-    if (vinculo.tipo === 'novo') guardarSeNovo(vinculos, vinculo.chave, { chave: vinculo.chave, turma, disciplina, email: aula.email })
+    guardarSeNovo(vinculos, vinculo.chave, { chave: vinculo.chave, turma, disciplina, email: aula.email })
```

A linha com erro passa a ser lida como se tivesse turma, disciplina e vínculo.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › a turma sem série no nome é erro
-  linha.aula !== undefined && linha.turma !== undefined && linha.disciplina !== undefined && linha.professor !== undefined && linha.vinculo !== undefined
+  true
```

A aula de outra escola, na mesma chave (vínculo, dia, início), passa a mudar de fim e de sala pelo upsert da escola A.

```mutacao
arquivo: packages/core/src/importacao/alocacao.repository.ts
teste: apps/worker/test/gravar-planilha-grade.int.test.ts › isolamento no upsert da
-      .onConflictDoUpdate({ target: [alocacao.vinculoId, alocacao.diaSemana, alocacao.inicio], set: { fim: sql`excluded.fim`, sala: sql`excluded.sala` }, setWhere: eq(alocacao.escolaId, escolaId) })
+      .onConflictDoUpdate({ target: [alocacao.vinculoId, alocacao.diaSemana, alocacao.inicio], set: { fim: sql`excluded.fim`, sala: sql`excluded.sala` } })
```

A disciplina com caractere de controle deixa de ser recusada.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › caractere de controle na turma
-  if (disciplina.length > 80 || temControle(disciplina)) return 'disciplina_invalida'
+  if (disciplina.length > 80) return 'disciplina_invalida'
```

O nome do professor com caractere de controle deixa de ser recusado.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › caractere de controle na turma
-  if (nome.length > TAMANHO_MAXIMO_NOME_DIGITADO || temControle(nome)) return 'nome_invalido'
+  if (nome.length > TAMANHO_MAXIMO_NOME_DIGITADO) return 'nome_invalido'
```

A sala com caractere de controle deixa de ser recusada.

```mutacao
arquivo: packages/core/src/importacao/tipos/grade.ts
teste: packages/core/src/importacao/tipos/grade.test.ts › caractere de controle na turma
-  if (sala.length > TAMANHO_MAXIMO_DA_SALA_DA_AULA || temControle(sala)) return 'sala_longa'
+  if (sala.length > TAMANHO_MAXIMO_DA_SALA_DA_AULA) return 'sala_longa'
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian (1ª) | `check` de tamanho da `sala` no banco (`alocacao.ts`) | `TODO.md`: exige migration, e hoje só a planilha grava a aula; vira tarefa se a F2b gravar aula à mão |
| privacy-guardian (1ª) | O modelo da planilha de grade pedir para não escrever nome na sala | Tarefa 14.0 (`modelos-de-planilha.ts`), que entrega os modelos |
| infra-guardian (1ª) | O [C] da 16.0 incluir uma grade de 3.000 linhas, com dezenas de professores novos e centenas de vínculos, medindo o passo (3) contra 1 s e a espera de trava contra o p95 de 300 ms | Tarefa 16.0 (`cenarios.md`, cenário [C]); o Arquiteto/Implementador da 16.0 a leem ao montar o cenário |
| infra-guardian (1ª) | Auditoria do `vinculo.criado` em insert de lote (`grade.ts`, `registro.gravar` por vínculo) | Só se a medida da 16.0 passar de 1 s, como o próprio revisor condiciona; mesmo padrão do `alunos.ts` |
| infra-guardian (1ª) | `push` no array do mapa em vez de copiar o grupo em `avisosDe` (`grade.ts`) | Recusada por ora: com o teto de 3.000 linhas o custo é pequeno (palavras do revisor), e o `?? []` está justificado no item (4) de "Sem bloco"; a 16.0 mede a prévia |
| conformidade-reviewer (1ª) | A grade não ser mostrada à coordenação como medida do professor (carga, aulas dadas, cumprimento de horário) | Tech Spec da F2b (Arquiteto), antes do código da "semana do professor"; D45 e regra 70, item 8 |
| revisor-geral (1ª) | Escrever na Tech Spec §5 que o tipo que cadastra professor, a grade incluída, pega a trava do convite da escola | Arquiteto: `techspec.md` não é arquivo do Implementador |
| revisor-geral (1ª) | Registrar o convite `vencido` como erro de linha (`professor_com_convite_vencido`) no `cenarios.md` e na §5 | Arquiteto, e a 15.0, que traduz o código em frase |
| revisor-geral (1ª) | `ESTADOS_QUE_VOLTAM` (`grade.ts`) repete `ESTADOS_QUE_ENTRAM` (`professores.ts`): uma constante só | `TODO.md`: `professores.ts` não é arquivo desta tarefa; refatoração a fazer junto com a próxima que o toca |
| revisor-geral (1ª) | `compactar` (`grade.ts`) repete o `nomeDaTurma` de `alunos.ts` | `TODO.md`: unificar muda dois tipos já aprovados, sem ganho de comportamento |
| tenancy-guardian (2ª) | `eq(alocacao.anoLetivoId, anoLetivoId)` também no `setWhere` do upsert (`alocacao.repository.ts`) | `TODO.md`, junto do índice único com `escola_id` (abaixo): o motor já impede o vínculo de outro ano, e a regra 10, item 2, vale como segunda camada numa migration futura |
| revisor-geral (2ª) | O índice único da `alocacao` (vínculo, dia, início) levar `escola_id`, para o banco ser a segunda proteção | `TODO.md`, com o `check` de tamanho da `sala` que já está lá; exige migration, fora da 11.0 |
| infra-guardian (2ª) | Uma linha no comentário do `setWhere` dizendo que o caminho só existe com id forjado, para ninguém o tomar por defesa principal; o conflito trava a linha da outra escola mesmo com o `WHERE` falso | Tarefa 12.0, que toca o `alocacao.repository.ts` ao apagar a aula que a planilha não traz |
| revisor-geral (2ª) | Quebrar a linha longa que entrou no comentário do `gravar` (`alocacao.repository.ts:41`) | Tarefa 12.0, pelo mesmo motivo; só formato de comentário |
| infra-guardian (2ª) | O teste da execução dupla mede `importacao.job` por diferença: se o `describe` passar a rodar em paralelo, filtrar o contador pela escola ou pelo id | `TODO.md`: hoje os casos rodam em sequência (palavras do revisor), sem efeito agora |
| revisor-geral (2ª), test-engineer (2ª) | Renumerar "Sem bloco (motivo)" no `11_task.md` (o (14) vem antes do (13)) | Recusada por ora: troca só o rótulo, sem efeito em comportamento, e nenhum revisor reprovou nesta rodada |
| test-engineer (2ª) | No caso do ano planejado, afirmar junto que o vínculo de 2026 da professora está na lista, para o `not.toContain` não passar com lista vazia | Recusada por ora: o revisor mesmo diz que o `688-689` confere o mesmo caminho depois da virada; só teste, sem bloqueio |
| privacy-guardian (2ª) | O `check` de tamanho da `sala` virar tarefa antes de a F2b gravar aula à mão | `TODO.md` (já está lá desde a rodada 1) |
| privacy-guardian (2ª) | A `cause` do erro do Drizzle nunca chegar ao corpo da resposta nem ao log sem o `summarizeError` | Nenhuma ação: o revisor registra que hoje não chega; a regra 20, item 9, e o guarda de log já o cobrem |
| conformidade-reviewer (2ª) | A grade não ser mostrada à coordenação como medida do professor (mantida da 1ª rodada) | Tech Spec da F2b (Arquiteto), como na tabela da rodada 1; D45 e regra 70, item 8 |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-04 06:16:46 | 2026-11-04 06:17:26 | `conformidade-reviewer` | 1 | APROVADO | ab88a6d3154e1548f |
| 2026-11-04 06:16:34 | 2026-11-04 06:17:37 | `tenancy-guardian` | 1 | APROVADO | ad06469c89db78416 |
| 2026-11-04 06:16:37 | 2026-11-04 06:18:13 | `privacy-guardian` | 1 | APROVADO | a1576ec1a72ac30b6 |
| 2026-11-04 06:16:39 | 2026-11-04 06:18:41 | `infra-guardian` | 1 | APROVADO | a912eb67a72650068 |
| 2026-11-04 06:16:44 | 2026-11-04 06:18:51 | `revisor-geral` | 1 | APROVADO | a39561e8aab822bd0 |
| 2026-11-04 06:16:42 | 2026-11-04 06:21:09 | `test-engineer` | 1 | REPROVADO | a3730120055272969 |
| 2026-11-04 06:37:20 | 2026-11-04 06:37:46 | `tenancy-guardian` | 2 | APROVADO | a549e913e12321ad6 |
| 2026-11-04 06:37:31 | 2026-11-04 06:37:56 | `infra-guardian` | 2 | APROVADO | abe3e2019be8e43be |
| 2026-11-04 06:37:26 | 2026-11-04 06:38:04 | `privacy-guardian` | 2 | APROVADO | a36aed81427e26bb4 |
| 2026-11-04 06:37:50 | 2026-11-04 06:38:11 | `conformidade-reviewer` | 2 | APROVADO | a812b5bd70e9b42ff |
| 2026-11-04 06:37:45 | 2026-11-04 06:38:13 | `revisor-geral` | 2 | APROVADO | a6dc9c9a574031645 |
| 2026-11-04 06:37:39 | 2026-11-04 06:38:30 | `test-engineer` | 2 | APROVADO | ada0d50e6efc1b9f4 |
