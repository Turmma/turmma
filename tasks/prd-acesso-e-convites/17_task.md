# Tarefa 17.0 — A leitura do alvo da senha provisória (API)

**Funcionalidade:** acesso-e-convites · **Depende de:** 9.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `test-engineer`
**Porte:** pequeno

Nasceu da divergência da 12.0 (opção A, escolhida pelo Joaquim em 09/11): é a "12a", numerada 17.0 porque as ferramentas do
processo só leem `N.0`. Vem antes da 12.0.

## Objetivo

`GET /v1/usuarios/:usuarioId/senha-provisoria` devolve à coordenação, ou ao professor com vínculo confirmado na turma do aluno, só
`{ nome, turma, matricula, entraPelaContaDaEscola }` daquele aluno, com o escopo da geração e `no-store`, para a confirmação distinguir dois
alunos de mesmo nome; a leitura pela coordenação fica na auditoria.

## Contexto necessário

- `techspec.md` seções 4 e 5 ("O alvo da provisória", "Arquivo do titular"); `cenarios.md` RF13 (os dois [I] da leitura do alvo) e "Auditoria"
- `prd.md` RF13, RF17; `docs/lgpd.md`, linha "Matrícula"
- `.claude/rules/10` itens 3, 4 e 6; `.claude/rules/20` itens 4 e 10
- `apps/api/src/credencial/senha-provisoria.{controller,service}.ts`, `credencial-matricula.repository.ts` (`#alunoQueAlcanca`, `estadoDaProvisoria`)

## Subtarefas

- [x] 17.1 — O contrato `alvoDaSenhaProvisoriaResponseSchema` (`.strict()`) e a `FINALIDADE_DA_LEITURA_DO_ALVO` em `packages/shared`
- [x] 17.2 — A leitura no repository, pela mesma seleção do alcance, sem trava: nome, turma do vínculo confirmado no ano em curso (nula sem ano), matrícula (nula sem credencial), conta ligada; sem credencial nem conta, nada
- [x] 17.3 — A rota no controller (`senha_provisoria.gerar`, `IdPipe`, `no-store`) e o service: 404 igual ao inexistente; `senha_provisoria.alvo_lido` só para a coordenação, na mesma transação da leitura
- [x] 17.4 — A ação em `acoes.ts`, fora de `ACOES_DO_ARQUIVO_POR_ALVO`, e fora do arquivo de quem assina em `leitura-do-titular.ts` (como a `.gerada`)
- [x] 17.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/shared/src/sessao/senha-provisoria.ts` | alterado |
| `apps/api/src/credencial/senha-provisoria.controller.ts`, `senha-provisoria.service.ts` | alterado |
| `apps/api/src/credencial/credencial-matricula.repository.ts` | alterado |
| `packages/core/src/auditoria/acoes.ts` | alterado |
| `packages/core/src/titular/leitura-do-titular.ts` | alterado |
| `apps/api/test/senha-provisoria.int.test.ts`, `apps/api/test/arquivo-do-titular.int.test.ts` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| quem lê | [I] | coordenação e professor da turma recebem as quatro chaves, e só elas; `no-store` | `apps/api/test/senha-provisoria.int.test.ts` › "a coordenação e o professor da turma recebem só as quatro chaves" (dois homônimos, um colega na outra turma) e › "depois de gerada, a leitura segue sem trazer a senha…"; o contrato `.strict()`: `packages/shared/src/sessao/senha-provisoria.test.ts` › "não aceita chave a mais" |
| escopo | [I] | B pelo contexto da A, outra turma, vínculo pendente/contestado, transferido, desativado, eliminação agendada, professor ou coordenador como alvo, inexistente, id fora do formato: 404 com o mesmo corpo | `apps/api/test/senha-provisoria.int.test.ts` › "escopo: quem não alcança o aluno…" (cada linha da lista: o aluno de B lido pelo contexto da A dá 404, e a coordenação de B o lê) e › "a turma é a do vínculo confirmado: o aluno transferido…" e › "a turma é a do ano em curso…" (o aluno só com vínculo confirmado num ano encerrado: `turma` nula) |
| conta da escola | [I] | só a conta: `matricula` nula e `entraPelaContaDaEscola`; conta e senha: a matrícula e verdadeiro; sem credencial nem conta: 404 | `apps/api/test/senha-provisoria.int.test.ts` › "conta da escola: só a conta dá matrícula nula…" (coordenação e professor; um quarto aluno sem conta fica com `false`) |
| sem ano em curso | [I] | a coordenação lê com `turma` nula; o professor, 404 | `apps/api/test/senha-provisoria.int.test.ts` › "sem ano em curso: a coordenação lê com `turma` nula…" |
| auditoria | [I] | coordenação: um `.alvo_lido` por leitura, aluno como alvo, finalidade fixa, sem nome nem matrícula; professor e 404: nenhum | `apps/api/test/senha-provisoria.int.test.ts` › "auditoria: a coordenação grava um `.alvo_lido` por leitura…" (duas leituras da coordenação, uma do professor, dois 404) |
| sem efeito | [I] | não gasta a cota de 5 por dia por aluno (as cinco gerações do dia ainda valem; a de 60 por hora por quem gera não é provada por este caso, e a linha não a promete mais) e não espera a trava de uma geração em curso | `apps/api/test/senha-provisoria.int.test.ts` › "sem efeito: não gasta cota…" (sete leituras e as cinco gerações do dia, com o semáforo do hash intocado; a leitura com a geração parada no gatilho) |
| arquivo do titular | [I] | a `.alvo_lido` não aparece no arquivo do aluno nem no do coordenador | `apps/api/test/arquivo-do-titular.int.test.ts` › "a senha_provisoria.alvo_lido (a leitura da confirmação pela coordenação…"; a lista fechada: `apps/api/test/architecture.test.ts` › "as ações sobre `usuario` são exatamente estas" |

## Como testar

- Escopo: `apps/api/test/senha-provisoria.int.test.ts` › "professor com vínculo pendente, contestado ou encerrado na turma, e professor de outra turma: 404 igual…" e os vizinhos do bloco "permissão e isolamento" (linhas 232–388): o mesmo arranjo, trocando o `post` por `get`
- Conta da escola: o mesmo arquivo › bloco "conta da escola ligada" (linha 405)
- Sem ano: › "a coordenação gera para o aluno, e o professor recebe 404" (linha 390)
- Trava: `WriteBlockTrigger` e `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`), como no bloco "`CONFLITO` e as cotas"
- Auditoria da leitura: `apps/api/test/importacao-alunos.int.test.ts:330` (consulta da `turma.alunos_lidos`)
- Arquivo: `apps/api/test/arquivo-do-titular.int.test.ts` › "D85: a senha_provisoria.gerada feita pelo professor mostra…" (linha 874)
- Comando: `npx vitest run --project integracao apps/api/test/senha-provisoria.int.test.ts`
- Armadilha desta spec: o 404 do alcance tem de vir antes de qualquer outra diferença (409, corpo), como na 9.0; a migration 0046 mudou depois de aplicada: `EDUCA_BANCO_NOVO=1` antes de migrar

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 6: a mutação que tira a condição do professor do alcance da leitura tem de derrubar um caso.

Respostas do plano (escritas antes do código):

1. **Mutação de cada cláusula:** os blocos de "Mutações", um por cláusula nova (alcance do professor, ano, vínculo `confirmado`, aluno do vínculo, junção da turma, conta ligada, credencial ou conta, o `if` do 404, a gravação só da coordenação, `no-store`, o `not in` do arquivo, a nulidade do contrato).
2. **Texto na tela:** a tarefa não tem tela (a 12.0 é quem a tem).
3. **Segundo dado:** um colega na outra turma criado antes (a turma lida não pode ser a dele); o aluno com vínculo `encerrado` na turma antiga e `confirmado` na nova (o `confirmado` decide); o aluno só com vínculo `confirmado` num ano encerrado (o ano decide: `turma` nula); outro aluno com conta ligada (a conta é do aluno, não da escola).
4. **Checagem anterior que responde antes:** o 404 do alcance vem antes de tudo (o `lerAlvo` é uma seleção só, e o `alcanceDaGeracao` barra o papel sem a célula antes dela); no professor sem ano em curso, o `requireAnoEmCurso` do alcance responde 404, e o caso da coordenação sem ano chega à leitura com `turma` nula.
5. **Resultado, não forma:** os casos comparam o corpo e o status recebidos, e a auditoria é lida do banco; nenhum olha texto de arquivo.
6. **Guarda nova:** não há regra de lint nem teste estrutural novo; a lista fechada de `architecture.test.ts` ganhou a `.alvo_lido` com o motivo escrito.
7. **Comentários:** os docblocks do repository e do service dizem o que o código faz (leitura sem trava, `NAO_ENCONTRADO` igual, gravação só da coordenação); o do controller diz que não gasta cota, e o teste de "sem efeito" prova.
8. **Divergência:** a tarefa não registra divergência da Tech Spec; a decisão da opção A já está em `techspec.md` §5 e em `cenarios.md`.
9. **Peça que já existe:** o alcance é o de `#alunoQueAlcanca`, extraído para `#condicoesDoAlcance` e reaproveitado, sem cópia; a auditoria é o `AuditoriaRecorder`; a rota usa a célula `senha_provisoria.gerar` da matriz.
10. **Concorrência:** a leitura não trava; o caso de "sem efeito" para a geração no gatilho (`WriteBlockTrigger`, a transação segura a linha do aluno) e lê com ela parada.
11. **Isolamento:** o caso de escopo lê o aluno da B pelo contexto da A (coordenação e professor); sem `eq(usuario.escolaId, escolaId)` do alcance, o aluno de B voltaria (a 9.0 já tem o bloco dessa cláusula, e o `lerAlvo` a compartilha). A coluna "Caso" da tabela tem um caso por linha.
12. **Guardiões:** `tenancy-guardian` (escopo no repository, autorização por objeto, 404 igual, UUID): o alcance compartilhado, o caso de B e o de outra turma; `privacy-guardian` (DTO explícito `.strict()`, matrícula só ali e no-store, auditoria da leitura sem nome nem matrícula, nada em log, a linha da `docs/lgpd.md` já escrita): o contrato, o `depois` nulo e a finalidade fixa; o `achados/indice.md` não tem linha que toque a leitura do alvo.

## Fora do escopo desta tarefa

A tela (12.0). Mudar a geração.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

--faltando: 1 linha (24 blocos, 3 motivos). Os blocos foram pensados contra a linha que tiram; o portão aplica, roda o caso e exige vermelho.

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › escopo: quem não alcança o aluno
      isNull(usuario.eliminacaoAgendadaEm),
-      alcance === 'unidade' ? sql`true` : this.#aTurmaEDoProfessor(usuarioId, escolaId),
+      sql`true`,
    )
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › escopo: quem não alcança o aluno
    return and(
-      eq(usuario.escolaId, escolaId),
      eq(usuario.id, usuarioId),
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › escopo: quem não alcança o aluno
      eq(usuario.id, usuarioId),
-      eq(usuario.papel, 'aluno'),
      isNull(usuario.desativadoEm),
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › escopo: quem não alcança o aluno
      eq(usuario.papel, 'aluno'),
-      isNull(usuario.desativadoEm),
      isNull(usuario.eliminacaoAgendadaEm),
      alcance === 'unidade' ? sql`true` : this.#aTurmaEDoProfessor(usuarioId, escolaId),
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › escopo: quem não alcança o aluno
      isNull(usuario.desativadoEm),
-      isNull(usuario.eliminacaoAgendadaEm),
      alcance === 'unidade' ? sql`true` : this.#aTurmaEDoProfessor(usuarioId, escolaId),
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › conta da escola: só a conta dá matrícula nula
      .from(contaExterna)
-      .where(and(eq(contaExterna.escolaId, usuario.escolaId), eq(contaExterna.usuarioId, usuario.id)))
+      .where(eq(contaExterna.escolaId, usuario.escolaId))
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › a turma é a do ano em curso
                .where(
                  and(
                    eq(doAluno.escolaId, escolaId),
-                    eq(doAluno.anoLetivoId, anoLetivoId),
                    eq(doAluno.usuarioId, usuario.id),
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › a coordenação e o professor da turma recebem só as quatro chaves
                    eq(doAluno.anoLetivoId, anoLetivoId),
-                    eq(doAluno.usuarioId, usuario.id),
                    eq(doAluno.papel, 'aluno'),
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › a turma é a do vínculo confirmado
                    eq(doAluno.papel, 'aluno'),
-                    eq(doAluno.estado, 'confirmado'),
                  ),
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › a coordenação e o professor da turma recebem só as quatro chaves
                .from(doAluno)
-                .innerJoin(turma, and(eq(turma.escolaId, doAluno.escolaId), eq(turma.anoLetivoId, doAluno.anoLetivoId), eq(turma.id, doAluno.turmaId)))
+                .innerJoin(turma, and(eq(turma.escolaId, doAluno.escolaId), eq(turma.anoLetivoId, doAluno.anoLetivoId)))
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › a coordenação e o professor da turma recebem só as quatro chaves
      .from(usuario)
-      .leftJoin(credencialMatricula, and(eq(credencialMatricula.escolaId, usuario.escolaId), eq(credencialMatricula.usuarioId, usuario.id)))
+      .leftJoin(credencialMatricula, eq(credencialMatricula.escolaId, usuario.escolaId))
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › conta da escola: só a conta dá matrícula nula
-      .where(and(this.#condicoesDoAlcance(usuarioId, alcance), sql`(${credencialMatricula.id} is not null or exists (${ligada}))`))
+      .where(this.#condicoesDoAlcance(usuarioId, alcance))
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › conta da escola: só a conta dá matrícula nula
-      .where(and(this.#condicoesDoAlcance(usuarioId, alcance), sql`(${credencialMatricula.id} is not null or exists (${ligada}))`))
+      .where(and(this.#condicoesDoAlcance(usuarioId, alcance), sql`exists (${ligada})`))
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › conta da escola: só a conta dá matrícula nula
      .limit(1)
-    if (linha === undefined) return undefined
    return { nome: linha.nome, turma: linha.turma, matricula: linha.matricula, entraPelaContaDaEscola: linha.contaLigada }
```

```mutacao
arquivo: apps/api/src/credencial/senha-provisoria.service.ts
teste: apps/api/test/senha-provisoria.int.test.ts › escopo: quem não alcança o aluno
      const achado = await new CredencialMatriculaRepository(tx).lerAlvo(alunoId, alcance)
-      if (achado === undefined) throw naoEncontrado()
      if (alcance === 'unidade') await registro.gravar(tx, 'senha_provisoria.alvo_lido', { entidadeId: alunoId, finalidade: FINALIDADE_DA_LEITURA_DO_ALVO })
```

```mutacao
arquivo: apps/api/src/credencial/senha-provisoria.service.ts
teste: apps/api/test/senha-provisoria.int.test.ts › auditoria: a coordenação grava
-      if (alcance === 'unidade') await registro.gravar(tx, 'senha_provisoria.alvo_lido', { entidadeId: alunoId, finalidade: FINALIDADE_DA_LEITURA_DO_ALVO })
+      await registro.gravar(tx, 'senha_provisoria.alvo_lido', { entidadeId: alunoId, finalidade: FINALIDADE_DA_LEITURA_DO_ALVO })
      return achado
```

```mutacao
arquivo: apps/api/src/credencial/senha-provisoria.service.ts
teste: apps/api/test/senha-provisoria.int.test.ts › auditoria: a coordenação grava
      if (achado === undefined) throw naoEncontrado()
-      if (alcance === 'unidade') await registro.gravar(tx, 'senha_provisoria.alvo_lido', { entidadeId: alunoId, finalidade: FINALIDADE_DA_LEITURA_DO_ALVO })
      return achado
```

```mutacao
arquivo: apps/api/src/credencial/senha-provisoria.controller.ts
teste: apps/api/test/senha-provisoria.int.test.ts › a coordenação e o professor da turma recebem só as quatro chaves
  @Get(':usuarioId/senha-provisoria')
  @RequirePermissao('senha_provisoria', 'gerar')
-  @Header('Cache-Control', 'no-store')
  alvo(@Param('usuarioId', IdPipe) alunoId: string): Promise<AlvoDaSenhaProvisoriaResponse> {
```

```mutacao
arquivo: packages/core/src/titular/leitura-do-titular.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › a senha_provisoria.alvo_lido
falha: expect(daCoordenacao).not.toContain(lida)
-          where t.escola_id = ${escolaId} and t.autor_usuario_id = ${titularId} and t.acao not in ('senha_provisoria.gerada', 'senha_provisoria.alvo_lido')`,
+          where t.escola_id = ${escolaId} and t.autor_usuario_id = ${titularId} and t.acao not in ('senha_provisoria.gerada')`,
```

```mutacao
arquivo: packages/shared/src/sessao/senha-provisoria.ts
teste: packages/shared/src/sessao/senha-provisoria.test.ts › não aceita chave a mais
    entraPelaContaDaEscola: z.boolean(),
  })
-  .strict()
+  .strip()
```

```mutacao
arquivo: packages/shared/src/sessao/senha-provisoria.ts
teste: apps/api/test/senha-provisoria.int.test.ts › conta da escola: só a conta dá matrícula nula
    turma: z.string().min(1).nullable(),
-    matricula: z.string().min(1).nullable(),
+    matricula: z.string().min(1),
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › professor com vínculo pendente, contestado ou encerrado
-    return this.banco.select({ id: usuario.id }).from(usuario).where(this.#condicoesDoAlcance(usuarioId, alcance)).limit(1)
+    return this.banco.select({ id: usuario.id }).from(usuario).limit(1)
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › o aluno com dois vínculos confirmados no ano em curso
-                .orderBy(asc(turma.nome), asc(turma.id))
                .limit(1)})`,
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › o aluno com dois vínculos confirmados no ano em curso
-                .orderBy(asc(turma.nome), asc(turma.id))
+                .orderBy(asc(turma.id))
```

Linhas novas sem bloco, com o motivo de cada uma:

- `credencial-matricula.repository.ts`, o ramo `anoLetivoId === null ? … : …` do `lerAlvo` (a linha do `? sql<string | null>`null``): só fecha o tipo (`eq` não aceita `null`); sem ano em curso, o `eq(doAluno.anoLetivoId, null)` também devolveria nulo, e a coordenação sem ano já tem o caso (`turma` nula) por outro caminho do mesmo ramo. Nenhuma mutação o deixa vermelho.
- `credencial-matricula.repository.ts`, `eq(contaExterna.escolaId, usuario.escolaId)`, `eq(credencialMatricula.escolaId, usuario.escolaId)`, `eq(doAluno.escolaId, escolaId)` e `eq(doAluno.papel, 'aluno')` do `lerAlvo`: redundantes com o `usuario.id` que as outras cláusulas do mesmo `where` prendem (UUID) e com a FK composta que amarra a conta, a credencial e o vínculo à escola; o escopo de quem lê é o `usuario.escolaId` de `#condicoesDoAlcance`, que tem bloco na 9.0 e o caso "B pelo contexto da A" aqui. Defesa em profundidade (regra 10, item 3).
- `senha-provisoria.controller.ts`, `@RequirePermissao('senha_provisoria', 'gerar')` da rota nova: a matriz (`matriz.test.ts`) e o `permissao-boot-check.test.ts` já o cobrem, e o `alcanceDaGeracao` do service responde 404 ao aluno e à rede (caso "o aluno lendo o colega" do escopo).

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | O caso "B pelo contexto da A" só usa aluno de B com credencial; um segundo só com `conta_externa` cobriria o ramo `exists (ligada)` | Recusada: o escopo desse ramo é o `usuario.escolaId` de `#condicoesDoAlcance`, que tem bloco e o caso de B pelo contexto da A; `eq(contaExterna.escolaId, usuario.escolaId)` já está no documento como defesa em profundidade, com a FK composta que amarra a conta à escola. O RF16 (escopo e 404 igual) é provado pelo caso de B pelo contexto da A e pelo bloco da escola; o ramo da conta ligada só lê dentro do aluno que o escopo já escolheu |
| privacy-guardian (1ª) | O GET não tem limite por usuário e a leitura do professor não é registrada: olhar pela regra 80 ou escrever como risco aceito | Recusada: o `infra-guardian` aprovou citando a guarda global que limita pelo usuário e pela escola do token (`app.module.ts:155-161`); a leitura do professor fora da auditoria é o desenho pedido (o Objetivo do documento: "a leitura pela coordenação fica na auditoria"; regra 20, item 10 pede auditoria na coordenação e na rede) |
| privacy-guardian (1ª) | Falha intermitente em `arquivo-do-titular.int.test.ts:1338` ("Meus dados"… no máximo 50), fora da tarefa, passou nas duas reexecuções | `TODO.md`, uma linha, para o Implementador registrar ao copiar esta tabela |
| test-engineer (1ª) | Os blocos de `9_task.md:109-117` não acham mais o contexto depois da extração de `#condicoesDoAlcance` (`.where(`/`and(` viraram `return and(`) | `TODO.md`: atualizar o contexto dos blocos da 9.0 se algo voltar a aplicá-los; `9_task.md` é de tarefa encerrada e não se edita aqui |
| test-engineer (1ª) | Falta caso de leitura pelo professor que dá duas disciplinas na mesma turma | Recusada: o `exists` da leitura é a mesma `#condicoesDoAlcance` da geração, e a geração já tem o caso (`senha-provisoria.int.test.ts:187`, "o professor com dois vínculos confirmados na mesma turma (duas disciplinas) gera uma vez só"); a leitura chama a mesma função |
| tenancy-guardian (2ª) | A mutação que tira o `orderBy` só falha se o Postgres devolver primeiro o vínculo criado antes; confirmar o vermelho em várias execuções, ou criar os vínculos para a ausência dar vermelho sempre | Já atendida pelo item 1 da ordem da rodada 2 (o mesmo achado do `test-engineer`): o caso tem três turmas e dois blocos |
| privacy-guardian (2ª) | Para o professor, com o aluno em duas turmas no ano, mostrar a turma dele, e não a primeira por nome | `TODO.md`, uma linha: muda o contrato da leitura (a turma passaria a depender de quem lê) e o documento da tarefa pede uma `turma`; "fica para a validação decidir", nas palavras do revisor (dono: Implementador) |
| revisor-geral (2ª) | Citar o caso "o aluno com dois vínculos confirmados…" na tabela de cenários do `17_task.md` | Destino: o Validador, que confere cada RF contra o caso; o caso já está no documento, no bloco de mutação, e a tabela da tarefa é do Implementador mudar só em ordem de revisor que reprovou |
| revisor-geral (2ª) | Registrar no `cenarios.md` e na Tech Spec, numa frase, que com dois vínculos confirmados a leitura mostra a primeira turma por nome | Documentos da spec são do Arquiteto: fica para a validação e a retro da spec (D86); a regra está no código, no teste e no bloco de mutação |
| revisor-geral (3ª) | O título do caso diz "dois vínculos confirmados", mas o caso cria três: trocar por "três vínculos confirmados" (ou "mais de um"), e o seletor do bloco de mutação, que casa pelo prefixo, junto | `TODO.md`: o prefixo "o aluno com dois vínculos confirmados no ano em curso" é o `teste:` dos dois blocos e o portão está verde com ele; mexer no título pede mexer nos dois blocos e nova rodada de dois revisores por um texto (dono: Implementador) |
| revisor-geral (3ª) e test-engineer (3ª) | Incluir `expect(await nomeDaTurma(s.turma)).toBe('2ºB')` entre as premissas do caso, para a dependência de nenhuma turma da fixture ter nome antes de "2ºA" ficar escrita | `TODO.md`, junto com a linha do título (dono: Implementador): a premissa do menor id já falha se a fixture mudar a ordem de criação, e nada hoje depende do nome da `s.turma` para o caso provar o que promete |
| test-engineer (3ª) | O teste não fixa o vermelho do bloco que tira o `orderBy` em todas as execuções (só ficaria verde se o banco percorresse as turmas por um índice de nome, o que o revisor chama de improvável com tabelas tão pequenas) | Recusada: o desenho é o que a rodada 2 exigiu e o próprio revisor aprovou; o segundo bloco (`orderBy(asc(turma.id))`) e a ordem de criação dos vínculos já fecham os dois critérios errados |
| test-engineer (3ª) | Quando a validação decidir mostrar ao professor a turma dele, o caso precisa ganhar a variante com o professor lendo | Já está na linha do privacy-guardian do `TODO.md` (a turma da leitura para o professor), que passou a citar "e o caso da turma ganha a variante do professor" |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-09 12:16:07 | 2026-11-09 12:16:28 | `conformidade-reviewer` | 1 | APROVADO | a3684c2441aaf2226 |
| 2026-11-09 12:15:59 | 2026-11-09 12:16:29 | `tenancy-guardian` | 1 | APROVADO | a35a9281d7b9f8da9 |
| 2026-11-09 12:16:05 | 2026-11-09 12:16:56 | `revisor-geral` | 1 | APROVADO | aaaa787c2d9f297e9 |
| 2026-11-09 12:16:09 | 2026-11-09 12:17:01 | `infra-guardian` | 1 | APROVADO | a28c293652aae331f |
| 2026-11-09 12:16:01 | 2026-11-09 12:18:53 | `privacy-guardian` | 1 | APROVADO | a3b4f5c5e2b75795e |
| 2026-11-09 12:53:37 | 2026-11-09 12:56:24 | `test-engineer` | 1 | REPROVADO | ae03f6a9bbdd7fda1 |
| 2026-11-09 13:11:02 | 2026-11-09 13:11:25 | `tenancy-guardian` | 2 | APROVADO | a9ca777bc87978267 |
| 2026-11-09 13:11:18 | 2026-11-09 13:11:31 | `conformidade-reviewer` | 2 | APROVADO | a9b4067764a8e09c9 |
| 2026-11-09 13:11:07 | 2026-11-09 13:11:31 | `privacy-guardian` | 2 | APROVADO | a605dc35112613c90 |
| 2026-11-09 13:11:23 | 2026-11-09 13:11:34 | `infra-guardian` | 2 | APROVADO | aa548ebf029513072 |
| 2026-11-09 13:11:12 | 2026-11-09 13:11:36 | `revisor-geral` | 2 | APROVADO | a2727e34de4d70f44 |
| 2026-11-09 13:10:57 | 2026-11-09 13:12:34 | `test-engineer` | 2 | REPROVADO | a3f903c5330ce66f1 |
| 2026-11-09 13:29:30 | 2026-11-09 13:29:51 | `revisor-geral` | 3 | APROVADO | a3a338d866b8ac13d |
| 2026-11-09 13:29:25 | 2026-11-09 13:30:07 | `test-engineer` | 3 | APROVADO | abd90a883c635b030 |
