# Tarefa 10.0 — A coordenação desliga o aluno pela planilha, e o aprovado volta na virada do ano

**Funcionalidade:** onboarding-por-convite · **Depende de:** 3.0, 9.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

O aluno aprovado marcado "fora da planilha" é desligado pelo `desativar` (vínculos encerrados, sessões derrubadas); o
não aprovado sai da `lista_nome` e o pedido dele é encerrado. Na planilha do ano planejado, o aluno aprovado do ano
anterior "volta", confirmado na turma nova com o mesmo login.

## Contexto necessário

- `techspec.md` §5 "O job" passo (3) (a ordem global, que o `desativar` e o `eliminar` também seguem), "Gravar"
  ("desligar o aprovado", "o não aprovado apaga a `lista_nome`", "Virada de ano")
- `prd.md` RF4, RF5, RF16, RF17; regra 20 item 18; regra 60 item 5
- `cenarios.md` RF5 (desligamento), "Virada de ano"
- Código: o `desativar` da 3.0; o `fechar('encerrada')` da 9.0; `packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts`

## Subtarefas

- [x] 10.1 — Marca "fora da planilha" do aprovado: `desativar` dentro da transação do passo (3), na ordem global
- [x] 10.2 — Não aprovado: apaga a `lista_nome` depois do `fechar('encerrada')`; auditoria `lista_nome.retirado` sem nome
- [x] 10.3 — Virada: aprovado sem vínculo no ano de destino "volta" (vínculo confirmado, `vinculo.criado`); desativado é erro na linha
- [x] 10.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/importacao/tipos/alunos.ts` | alterado |
| `packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts` | alterado |
| `apps/worker/test/desligamento-pela-planilha.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| Ausente sem marca: segue ativo | integração | RF4 | `o ausente sem marca segue ativo, com a senha, as sessões e os vínculos…` |
| Ausente com marca: desligado | integração | caminho feliz (RF4, RF5) | `o ausente com a marca é desligado pelo `desativar`…` |
| O desligado não entra por matrícula | integração | RF5 | `o desligado não entra por matrícula…` |
| As sessões do desligado caem | integração | regra 20, item 18 | `as sessões do desligado caem, com o motivo `desativacao`…` |
| Nome não aprovado desligado sai da lista, o pedido fica `encerrada`, `lista_nome.retirado` sem nome | integração | RF5 | `o livre e o reivindicado saem da lista, o pedido pendente fica `encerrada`…` |
| [P] Reivindicação parada contra o (3) do desligamento: nunca pendente com o nome nulo | [P] | | `[P] a reivindicação parada no nome livre ausente contra o passo (3) do desligamento…` |
| [P] Desligamento de não aprovado contra a decisão do mesmo pedido: `encerrada` ou decidido; nunca `falhou` pelo check | [P] | | `[P] o desligamento do reivindicado contra a decisão do mesmo pedido…` e `[P] a decisão do pedido com o job parado depois de retirar o nome…` |
| [P] Aluno a desligar desativado à mão entre o (2) e o (3): `desatualizada` | [P] | releitura | `[P] o aluno a desligar desativado à mão entre o passo (2) e o (3)…` |
| [P] O (3) corrigindo o nome e desligando X, com barreira, contra a coordenação desativando e eliminando X: zero `40P01` na requisição; o espião confere a ordem global no job | [P] | ordem global | `[P] o (3) corrigindo o nome de um aluno e desligando outro…` e `o passo (3) trava, nesta ordem…` |
| Virada: aprovado do ano encerrado "volta", com o mesmo login | integração | ano | `o aluno do ano anterior "volta" com o mesmo login…` |
| Na volta, o vínculo do ano encerrado fica intacto | integração | vínculo encerrado e aberto | `na volta, os vínculos dos outros anos ficam intactos…` |
| Virada: aluno desativado na planilha é erro na linha | integração | ano | `o aluno desativado na planilha é erro na linha (`aluno_desativado`)…` |
| Auditoria `usuario.desativado` | integração | RF17 | `a auditoria `usuario.desativado` e `vinculo.encerrado` leva o id do desligado…` |
| Auditoria `vinculo.criado` do aluno que volta | integração | RF17 | `a auditoria da volta: `vinculo.criado` de cada aluno que volta…` |

## Como testar

- Desligar: `apps/api/test/ciclo-de-vida.int.test.ts › caminho feliz (RF5; regra 20, item 18): o aluno desativado tem o hash da senha apagado, a sessão aberta dá 401 na requisição seguinte, e o colega segue entrando`
- Login por matrícula: `apps/api/test/sessao-matricula.int.test.ts › privacidade (regra 20, item 6): slug inexistente, …, aluno desativado e senha errada dão o mesmo status e o mesmo corpo, …`
- Virada: `apps/api/test/virada-do-ano.int.test.ts › caminho feliz: …`
- Espião no SQL e barreira: os da 3.0 (`apps/api/test/ciclo-de-vida.int.test.ts`) e `WriteBlockTrigger`
- Comando: `npx vitest run --project integracao apps/worker/test/desligamento-pela-planilha.int.test.ts`
- Armadilha: nos [P] que dependem do `lock_timeout`, só o estado final

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3, a virada precisa de um ano encerrado com vínculo e de um planejado sem.

## Fora do escopo desta tarefa

A tela das marcas (13.0); a conta da escola do aluno desligado (F2c).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| A volta só existe na planilha do ano **planejado**; no ano em curso a matrícula sem linha segue "já existe". Linha nova de resultado `volta` em `RESULTADOS_DA_LINHA_DA_PLANILHA` | A "virada" do PRD é a do aluno do ano anterior para o ano que vai começar. No ano em curso, quem tem conta e não tem vínculo é caso de transferência ou de correção à mão, e voltá-lo ali reabriria o que a coordenação encerrou | `techspec.md` §5 "Gravar" (Virada de ano); `cenarios.md` RF5 (Virada) |
| A volta também grava a linha `aprovado` na `lista_nome` do ano planejado (só estado e usuário, como a aprovação deixa) | A reimportação seguinte lê a lista para corrigir, transferir ou desligar o aluno no ano; sem a linha ele não seria achado nem desligável na turma nova | `techspec.md` §5 "Gravar"; `docs/lgpd.md` (linha "Lista de nomes da turma") |
| `aluno_desativado` é erro só do aluno desativado **sem** linha no ano, na planilha do ano **planejado**; no ano em curso o desligado que ainda tem a linha `aprovado` não é lido pela reimportação (`alunosParaReimportar` filtra quem está desativado) e a matrícula dele segue "já existe" | O aluno desligado pela marca perde o login (`desativar`) e sai da reimportação; só a virada, que lê a credencial, o acha, e ali é erro de linha em vez de "volta". No ano em curso nada o reabre | `cenarios.md` RF5 (Virada) |
| `lista_nome.retirado` aceita `estado: livre \| reivindicado` e traz só `turmaId` e `estado` (sem nome nem matrícula) | O contrato da 1.0 previa só o nome livre; o reivindicado também sai, com o pedido encerrado antes (o check `reivindicacao_pendente_com_nome`) | `techspec.md` §5 "Gravar"; regra 20, item 10 |
| O `travar` do tipo de importação recebe a `tx` do passo (3) (`tipo.ts` e `motor.ts`) | Para travar os anos dos vínculos do aluno desligado antes dos usuários, na ordem global do `desativar`, ele precisa do repositório da transação | `techspec.md` §5 "O job" passo (3) |
| Arquivos além dos "previstos": `lista.repository.ts` (`daVirada`, `retirarNomes`, `inserirAprovados`), `importacao.repository.ts` (os mesmos, em lotes), `tipo.ts`, `motor.ts`, `acoes.ts`, `contratos.ts`, `alunos.test.ts`; o `ciclo-de-vida.service.ts` **não** mudou | O `desativar` da 3.0 já servia como estava; a escrita em lote da lista e a leitura da virada são de repository (regra 00, item 3) | `techspec.md` §5 "Gravar"; regra 10, item 3 |
| Documentos: `techspec.md` §5 "Gravar" (virada e desligamento), `cenarios.md` ("Virada de ano") e `docs/lgpd.md` (retirada e volta na lista de nomes) | O comportamento novo estava só em tarefa; a spec e o mapa de dados dizem o que a planilha faz com o nome e com o aluno | `techspec.md` §5; `docs/lgpd.md` |

## Mutações

--faltando: 12 linhas (30 blocos, 9 motivos)

**Sem bloco (motivo):** (1) os atalhos de lista vazia dos métodos de `lista.repository.ts` (`matriculas.length === 0` de `daVirada`, `retiradas.length === 0` de `retirarNomes`, `alunos.length === 0` de `inserirAprovados`): o único chamador de cada um (`importacao.repository.ts`) corre os lotes com um `for` que não entra com a lista vazia, e o `inArray` vazio devolve falso; o resultado é o mesmo; (2) o `escolaId` do `where` do `aprovadoNoAno`, o `estado = 'aprovado'` dele e o `papel = 'aluno'` do vínculo e do usuário: o `usuarioId` já prende a uma escola só e a linha com usuário é sempre `aprovado` (check `lista_nome_aprovado_sem_nome`); o filtro fica por escopo explícito (regra 10, item 3) e o isolamento entre escolas é provado pelo bloco da credencial; (3) o `!porChave.has` do `lembrarTurmaNova` (a turma nova da volta e da transferência) e o `turmasLidas ??` do `classificarAgora`: o `Map` guarda a mesma turma por chave, e a releitura das turmas devolve o mesmo; (4) o atalho `desligamentos.aprovados.length === 0 && nomes.length === 0` do `desligar`, o `voltas.length === 0` do `voltar` (`criarVinculosDosAlunos` e `inserirAprovados` não entram no laço com a lista vazia), o `volta !== undefined` (estreitamento de tipo) e o `turmaId === undefined` da invariante do `voltar` (inalcançável: `criados` só traz quem está em `voltas`): sem eles o resultado é o mesmo; (5) a ordenação das listas de ids e de nomes (`sort`): dá a ordem fixa das travas contra impasse entre duas importações, e nenhum teste distingue a ordem de duas travas; e a forma `muda_de_turma && alvo !== undefined`, que é estreitamento de tipo; (6) o `lido.success ? … : undefined` do `planejar`: a leitura do guardado é a da 8.0; (7) o `if (emUso.has(matricula))`: é o ramo "já existe" da 8.0, que só ganhou linhas por dentro (agora em `linhaDeQuemTemConta`), e elas têm bloco; (8) o `if (resultado === 'muda_de_turma') lembrarTurmaNova(…)`: a condição é a da 9.0 (a turma nova da transferência), que o bloco da transferência da 9.0 prova; só mudou de forma, para a complexidade do lint; (9) o `citadas.has(turmaId)` dos nomes ainda não aprovados em `candidatosDe`: o `alunosParaReimportar` já lê esses nomes só das turmas que a planilha cita (`turmasTocadas`), então o filtro é redundante; o do aluno aprovado, que a consulta lê de todas as turmas, tem bloco.

A marca de "desativado" deixa de valer: o aluno desativado volta como qualquer outro, em vez de erro na linha.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/desligamento-pela-planilha.int.test.ts › o aluno desativado na planilha é erro na linha
-  if (doAno?.desativado === true) return { linha, resultado: 'erro', erro: 'aluno_desativado', nome, matricula }
+  if (false) return { linha, resultado: 'erro', erro: 'aluno_desativado', nome, matricula }
```

Quem já tem vínculo aberto no ano passa a "voltar" de novo, em vez de "já existe".

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/desligamento-pela-planilha.int.test.ts › o aluno do ano anterior "volta" com o mesmo login
-  if (doAno === undefined || doAno.comVinculo) return { linha, resultado: 'ja_existe', destino, nome, matricula }
+  if (doAno === undefined) return { linha, resultado: 'ja_existe', destino, nome, matricula }
```

A virada passa a valer também no ano em curso: a matrícula sem linha no ano deixa de ser "já existe".

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/desligamento-pela-planilha.int.test.ts › o aluno desativado na planilha é erro na linha
-  const daVirada = ano.situacao === 'planejado' ? new Map((await repositorio.alunosDaVirada(ano.id, matriculas)).map((aluno) => [aluno.matricula, aluno])) : undefined
+  const daVirada = true ? new Map((await repositorio.alunosDaVirada(ano.id, matriculas)).map((aluno) => [aluno.matricula, aluno])) : undefined
```

A linha "volta" deixa de ser lida pelo gravar: ninguém ganha vínculo.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/desligamento-pela-planilha.int.test.ts › o aluno do ano anterior "volta" com o mesmo login
-  return linhas.flatMap(({ resultado, volta, destino }) => (resultado === 'volta' && volta !== undefined ? [{ usuarioId: volta, turmaId: idDaTurma(destino, turmasNovas) }] : []))
+  return linhas.flatMap(({ resultado, volta, destino }) => (resultado === 'ja_existe' && volta !== undefined ? [{ usuarioId: volta, turmaId: idDaTurma(destino, turmasNovas) }] : []))
```

A contagem `voltam` entra no resumo mesmo quando é zero.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/desligamento-pela-planilha.int.test.ts › o ausente sem marca segue ativo
-  const resumo = { entram: quantas('entra'), ja_existem: quantas('ja_existe'), ...(corrigidos > 0 ? { nomes_corrigidos: corrigidos } : {}), ...(voltam > 0 ? { voltam } : {}), turmas_novas: novas.length }
+  const resumo = { entram: quantas('entra'), ja_existem: quantas('ja_existe'), ...(corrigidos > 0 ? { nomes_corrigidos: corrigidos } : {}), ...{ voltam }, turmas_novas: novas.length }
```

A contagem `desligados` entra no resumo mesmo quando é zero.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/desligamento-pela-planilha.int.test.ts › o ausente sem marca segue ativo
-    ...(desligados > 0 ? { desligados } : {}),
+    ...{ desligados },
```

A contagem `retirados` entra no resumo mesmo quando é zero.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/desligamento-pela-planilha.int.test.ts › o ausente sem marca segue ativo
-    ...(retirados > 0 ? { retirados } : {}),
+    ...{ retirados },
```

A contagem `transferidos` entra no resumo mesmo quando é zero.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/desligamento-pela-planilha.int.test.ts › o ausente sem marca segue ativo
-    ...(transferencias.length > 0 ? { transferidos: transferencias.length } : {}),
+    ...{ transferidos: transferencias.length },
```

O resumo conta como desligado quem tem candidato, marcado ou não.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/desligamento-pela-planilha.int.test.ts › o ausente sem marca segue ativo
-  const aDesligar = classificacao.candidatos.filter(({ acao, id }) => acao === 'desligar' && marcados.has(id))
+  const aDesligar = classificacao.candidatos.filter(({ acao, id }) => acao === 'desligar')
```

A marca sem candidato deixa de ser diferença: a marca do aluno que já não é candidato é ignorada em silêncio.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/desligamento-pela-planilha.int.test.ts › o aluno a desligar desativado à mão entre o passo
-  if (alvos.some((alvo) => alvo === undefined)) throw new DiferencaNaPlanilhaError()
+  if (alvos.length < 0) throw new DiferencaNaPlanilhaError()
```

O aluno aprovado deixa de ser separado do nome da lista: o `desativar` recebe o id de um nome.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/desligamento-pela-planilha.int.test.ts › o ausente com a marca é desligado pelo
-    aprovados: alvos.flatMap((alvo) => (alvo?.tipo === 'usuario' ? [alvo.id] : [])).sort(),
+    aprovados: alvos.flatMap((alvo) => (alvo?.tipo === 'x' ? [alvo.id] : [])).sort(),
```

O nome da lista deixa de ser separado do aprovado: nenhum nome sai da lista.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/desligamento-pela-planilha.int.test.ts › o livre e o reivindicado saem da lista
-    nomes: alvos.flatMap((alvo) => (alvo?.tipo === 'lista' ? [alvo] : [])).sort((a, b) => (a.id < b.id ? -1 : 1)),
+    nomes: alvos.flatMap((alvo) => (alvo?.tipo === 'x' ? [alvo] : [])).sort((a, b) => (a.id < b.id ? -1 : 1)),
```

O pedido pendente do nome que sai deixa de ser encerrado antes do delete.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/desligamento-pela-planilha.int.test.ts › o livre e o reivindicado saem da lista
-  await gravacao.encerrarPedidosDosNomes(desligamentos.nomes.filter(({ estado }) => estado === 'reivindicado').map(({ id }) => id))
+  await gravacao.encerrarPedidosDosNomes([]); void (desligamentos.nomes.filter(({ estado }) => estado === 'reivindicado').map(({ id }) => id))
```

O nome que a mão levou do estado em que a planilha o leu deixa de ser diferença quando o delete não o alcança.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/desligamento-pela-planilha.int.test.ts › o nome livre levado à 8B à mão
-  if (retirados.length !== desligamentos.nomes.length) throw new DiferencaNaPlanilhaError()
+  if (retirados.length > desligamentos.nomes.length) throw new DiferencaNaPlanilhaError()
```

O travar deixa de travar o usuário que volta.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/desligamento-pela-planilha.int.test.ts › o usuário do aluno que volta preso por outra transação
-      ...antes.linhas.flatMap(({ resultado, alvo, volta }) => (resultado === 'nome_corrigido' && alvo?.tipo === 'usuario' ? [alvo.id] : resultado === 'volta' && volta !== undefined ? [volta] : [])),
+      ...antes.linhas.flatMap(({ resultado, alvo, volta }) => (resultado === 'nome_corrigido' && alvo?.tipo === 'usuario' ? [alvo.id] : [])),
```

O travar trava também o aluno ausente que ninguém marcou.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/desligamento-pela-planilha.int.test.ts › trava, nesta ordem, o ano
-    const desligados = antes.candidatos.flatMap(({ acao, id, alvo }) => (acao === 'desligar' && alvo.tipo === 'usuario' && marcadosParaDesligar.has(id) ? [id] : [])).sort()
+    const desligados = antes.candidatos.flatMap(({ acao, id, alvo }) => (acao === 'desligar' && alvo.tipo === 'usuario' ? [id] : [])).sort()
```

O aluno que a planilha traz passa a ser candidato a desligar (aprovado).

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/desligamento-pela-planilha.int.test.ts › a marca de quem a planilha não deixa ausente
-      citadas.has(turmaId) && !matriculasDaPlanilha.has(matricula) ? [{ id: usuarioId, acao: 'desligar', rotulo: rotulo(nome, matricula), turmaId, alvo: { tipo: 'usuario', id: usuarioId, nome, turmaId } }] : [],
+      citadas.has(turmaId) ? [{ id: usuarioId, acao: 'desligar', rotulo: rotulo(nome, matricula), turmaId, alvo: { tipo: 'usuario', id: usuarioId, nome, turmaId } }] : [],
```

O nome que a planilha traz passa a ser candidato a desligar.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/desligamento-pela-planilha.int.test.ts › a marca de quem a planilha não deixa ausente
-      citadas.has(turmaId) && !matriculasDaPlanilha.has(matricula) ? [{ id, acao: 'desligar', rotulo: rotulo(nome, matricula), turmaId, alvo: { tipo: 'lista', id, estado, nome, turmaId } }] : [],
+      citadas.has(turmaId) ? [{ id, acao: 'desligar', rotulo: rotulo(nome, matricula), turmaId, alvo: { tipo: 'lista', id, estado, nome, turmaId } }] : [],
```

A consulta da virada deixa de olhar o ano na linha `aprovado`: quem foi aprovado em qualquer ano some da volta.

```mutacao
arquivo: packages/core/src/estrutura/lista.repository.ts
teste: apps/worker/test/desligamento-pela-planilha.int.test.ts › o aluno do ano anterior "volta" com o mesmo login
-      .where(and(eq(listaNome.escolaId, escolaId), eq(listaNome.anoLetivoId, anoLetivoId), eq(listaNome.estado, 'aprovado'), eq(listaNome.usuarioId, usuario.id)))
+      .where(and(eq(listaNome.escolaId, escolaId), eq(listaNome.estado, 'aprovado'), eq(listaNome.usuarioId, usuario.id)))
```

O vínculo aberto deixa de ser do ano de destino: o do ano em curso conta como "já tem".

```mutacao
arquivo: packages/core/src/estrutura/lista.repository.ts
teste: apps/worker/test/desligamento-pela-planilha.int.test.ts › o aluno do ano anterior "volta" com o mesmo login
-      .where(and(eq(vinculo.escolaId, escolaId), eq(vinculo.anoLetivoId, anoLetivoId), eq(vinculo.usuarioId, usuario.id), eq(vinculo.papel, 'aluno'), ne(vinculo.estado, 'encerrado')))
+      .where(and(eq(vinculo.escolaId, escolaId), eq(vinculo.usuarioId, usuario.id), eq(vinculo.papel, 'aluno'), ne(vinculo.estado, 'encerrado')))
```

A consulta da virada devolve também quem já tem linha `aprovado` no ano.

```mutacao
arquivo: packages/core/src/estrutura/lista.repository.ts
teste: apps/worker/test/desligamento-pela-planilha.int.test.ts › isolamento: a matrícula da escola B na planilha do planejado da A
-      .where(and(eq(credencialMatricula.escolaId, escolaId), inArray(credencialMatricula.matricula, [...matriculas]), eq(usuario.papel, 'aluno'), notExists(aprovadoNoAno)))
+      .where(and(eq(credencialMatricula.escolaId, escolaId), inArray(credencialMatricula.matricula, [...matriculas]), eq(usuario.papel, 'aluno')))
```

A consulta da virada deixa de prender a credencial à escola do contexto.

```mutacao
arquivo: packages/core/src/estrutura/lista.repository.ts
teste: apps/worker/test/desligamento-pela-planilha.int.test.ts › isolamento: a matrícula da escola B na planilha do planejado da A
-      .where(and(eq(credencialMatricula.escolaId, escolaId), inArray(credencialMatricula.matricula, [...matriculas]), eq(usuario.papel, 'aluno'), notExists(aprovadoNoAno)))
+      .where(and(inArray(credencialMatricula.matricula, [...matriculas]), eq(usuario.papel, 'aluno'), notExists(aprovadoNoAno)))
```

O vínculo encerrado no ano de destino passa a impedir a volta: quem reentra vira "já existe".

```mutacao
arquivo: packages/core/src/estrutura/lista.repository.ts
teste: apps/worker/test/desligamento-pela-planilha.int.test.ts › o aluno do ano anterior "volta" com o mesmo login
-      .where(and(eq(vinculo.escolaId, escolaId), eq(vinculo.anoLetivoId, anoLetivoId), eq(vinculo.usuarioId, usuario.id), eq(vinculo.papel, 'aluno'), ne(vinculo.estado, 'encerrado')))
+      .where(and(eq(vinculo.escolaId, escolaId), eq(vinculo.anoLetivoId, anoLetivoId), eq(vinculo.usuarioId, usuario.id), eq(vinculo.papel, 'aluno')))
```

O `delete` de `retirarNomes` deixa de prender a escola: o id de outra escola sai da lista dela.

```mutacao
arquivo: packages/core/src/estrutura/lista.repository.ts
teste: apps/worker/test/desligamento-pela-planilha.int.test.ts › isolamento dos métodos do desligamento
 using (values ${valores}) as v(id, estado_lido, turma_lida_id)
-      where l.escola_id = ${requireEscolaId()} and l.ano_letivo_id = ${anoLetivoId} and l.id = v.id and l.estado = v.estado_lido and l.turma_id = v.turma_lida_id
+      where l.ano_letivo_id = ${anoLetivoId} and l.id = v.id and l.estado = v.estado_lido and l.turma_id = v.turma_lida_id
```

O `delete` de `retirarNomes` deixa de prender o ano: o nome de outro ano sai da lista.

```mutacao
arquivo: packages/core/src/estrutura/lista.repository.ts
teste: apps/worker/test/desligamento-pela-planilha.int.test.ts › isolamento dos métodos do desligamento
 using (values ${valores}) as v(id, estado_lido, turma_lida_id)
-      where l.escola_id = ${requireEscolaId()} and l.ano_letivo_id = ${anoLetivoId} and l.id = v.id and l.estado = v.estado_lido and l.turma_id = v.turma_lida_id
+      where l.escola_id = ${requireEscolaId()} and l.id = v.id and l.estado = v.estado_lido and l.turma_id = v.turma_lida_id
```

O `delete` de `retirarNomes` deixa de conferir o estado que a planilha leu: o nome que a reivindicação tomou sai da lista.

```mutacao
arquivo: packages/core/src/estrutura/lista.repository.ts
teste: apps/worker/test/desligamento-pela-planilha.int.test.ts › a reivindicação parada no nome livre ausente
 using (values ${valores}) as v(id, estado_lido, turma_lida_id)
-      where l.escola_id = ${requireEscolaId()} and l.ano_letivo_id = ${anoLetivoId} and l.id = v.id and l.estado = v.estado_lido and l.turma_id = v.turma_lida_id
+      where l.escola_id = ${requireEscolaId()} and l.ano_letivo_id = ${anoLetivoId} and l.id = v.id and l.turma_id = v.turma_lida_id
```

O `delete` de `retirarNomes` deixa de conferir a turma que a planilha leu: o nome levado à outra turma à mão sai da lista.

```mutacao
arquivo: packages/core/src/estrutura/lista.repository.ts
teste: apps/worker/test/desligamento-pela-planilha.int.test.ts › o nome livre levado à 8B à mão
 using (values ${valores}) as v(id, estado_lido, turma_lida_id)
-      where l.escola_id = ${requireEscolaId()} and l.ano_letivo_id = ${anoLetivoId} and l.id = v.id and l.estado = v.estado_lido and l.turma_id = v.turma_lida_id
+      where l.escola_id = ${requireEscolaId()} and l.ano_letivo_id = ${anoLetivoId} and l.id = v.id and l.estado = v.estado_lido
```

O `desativar` que não acha o aluno (já desativado entre o passo (2) e o (3)) deixa de ser diferença: o erro sobe cru.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › o `NAO_ENCONTRADO` do `desativar`
-      if (erro instanceof DomainException && erro.codigo === ErrorCode.NAO_ENCONTRADO) throw new DiferencaNaPlanilhaError()
+      if (erro instanceof DomainException && erro.codigo === ErrorCode.NAO_ENCONTRADO) throw erro
```

O aluno que volta deixa de entrar na assinatura: a troca do usuário da credencial passa despercebida.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: packages/core/src/importacao/tipos/alunos.test.ts › a assinatura muda com o aluno que volta
-  const vistas = linhas.map(({ linha, resultado, erro, destino, alvo, volta }) => [linha, resultado, erro ?? null, destinoDe(destino), alvoDe(alvo), ...(volta === undefined ? [] : [volta])])
+  const vistas = linhas.map(({ linha, resultado, erro, destino, alvo, volta }) => [linha, resultado, erro ?? null, destinoDe(destino), alvoDe(alvo), ...[]])
```

O `travar` deixa de travar os anos dos vínculos do desligado: a trava só aparece depois, pelo `desativar`, e a ordem global quebra.

```mutacao
arquivo: packages/core/src/importacao/tipos/alunos.ts
teste: apps/worker/test/desligamento-pela-planilha.int.test.ts › trava, nesta ordem, o ano
-    for (const usuarioId of desligados) await ciclo.travarAnosDosVinculos(usuarioId, true)
+    for (const usuarioId of desligados) void usuarioId
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian (1ª e 2ª) | A volta (`daVirada`, `linhaDeQuemTemConta`) olha só `desativadoEm`, e não `eliminacaoAgendadaEm`; a transferência da 9.0 tem a mesma lacuna | `TODO.md` (escrever a entrada agora; é a que importa para a regra 20) |
| infra-guardian (1ª), revisor-geral (1ª) | `travarAnosDosVinculos` por aluno desligado: trava dos anos num comando só, em ordem de id | `TODO.md` (escrever a entrada agora) |
| infra-guardian (1ª e 2ª) | Medir 100 a 300 desligamentos e a virada de 900 alunos (inclui o laço de `vinculo.criado` um por um) contra o alerta de 1 s do passo (3) | Tarefa 16.0: entrada no `TODO.md` apontando a 16.0 (a linha 49 do `16_task.md` cobre só transferências); o Arquiteto leva ao documento |
| conformidade-reviewer (1ª e 2ª) | A tela das marcas deve deixar claro que "volta" e "desligar" são escolha da coordenação | Tarefa 13.0: entrada no `TODO.md` apontando a 13.0 |
| conformidade-reviewer (2ª), test-engineer (2ª) | O nome do teste de `alunos.test.ts:348` ("o aluno da mesma turma do ano anterior vai para a 9ºA") promete mais do que prova: a entrada da virada não traz turma nem série do ano anterior | `TODO.md` (renomear na próxima tarefa que tocar `alunos.test.ts`); um ciclo de revisão só para um nome não vale |
| test-engineer (1ª) | "O desligado não entra por matrícula" prova pelo `doAlunoAtivo`, não pela rota de login | Recusada: o "Como testar" desta tarefa já aponta `apps/api/test/sessao-matricula.int.test.ts` para o login do desativado |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-04 09:33:56 | 2026-11-04 09:34:22 | `revisor-geral` | 2 | APROVADO | abc886dfd787d8b79 |
| 2026-11-04 09:34:01 | 2026-11-04 09:34:23 | `tenancy-guardian` | 2 | APROVADO | a245f43cfa1974030 |
| 2026-11-04 09:34:14 | 2026-11-04 09:34:43 | `conformidade-reviewer` | 2 | APROVADO | aa8b5bc00c648f363 |
| 2026-11-04 09:34:10 | 2026-11-04 09:34:56 | `infra-guardian` | 2 | APROVADO | ad07f13fa3995f432 |
| 2026-11-04 09:33:50 | 2026-11-04 09:34:59 | `test-engineer` | 2 | APROVADO | a9017f275ec46733d |
| 2026-11-04 09:34:05 | 2026-11-04 09:35:02 | `privacy-guardian` | 2 | APROVADO | add1f1c869ccc7965 |
