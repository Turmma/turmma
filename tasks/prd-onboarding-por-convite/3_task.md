# Tarefa 3.0 — Desativar encerra os vínculos e revoga o convite, na ordem global

**Funcionalidade:** onboarding-por-convite · **Depende de:** 1.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

O `desativar` de uma pessoa na escola encerra os vínculos dela (no ano em curso e no planejado) e revoga o convite
aberto (N1 da A1), travando na ordem global que o job da planilha também segue; o `eliminar` segue a mesma ordem.
Professor desativado em março não vê a turma em outubro (regra 20, item 18).

## Contexto necessário

- `techspec.md` §2 (linha `packages/core/src/ciclo-de-vida/`), §5 "O job", passo (3) (a ordem global: importação, ano,
  usuários, contas, turmas por id num comando, pedidos)
- `prd.md` RF5, RF6; `revisao-spec.md` rodada 8, recomendações da rodada 7 (ano em `FOR SHARE` contra o `virarAno` e o
  `virarSala`; o `eliminar` sem ano no contexto)
- Regra 20 item 18; regra 80 item 7
- Código: `packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts` (`desativar`, `eliminar`),
  `ciclo-de-vida.repository.ts` (`travarContraOGerarDoProfessor`); o `encerrar` em
  `packages/core/src/estrutura/vinculo.repository.ts` (da 1.0); `apps/api/src/estrutura/ano-letivo/ano-letivo.repository.ts`
  (`virarSala`)

## Subtarefas

- [x] 3.1 — `desativar` encerra os vínculos da pessoa na escola pelo `encerrar` (que revoga o acesso da turma), com as turmas travadas em ordem de id num comando só (`FOR NO KEY UPDATE … order by id`)
- [x] 3.2 — `desativar` revoga o convite aberto do professor
- [x] 3.3 — Ordem global no `desativar` e no `eliminar`: ano em `FOR SHARE` antes dos usuários e das turmas; o `eliminar` sem ano no contexto trava os anos da escola que tocam
- [x] 3.4 — `docs/lgpd.md`, linha "Acesso da turma": a desativação revoga
- [x] 3.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts`, `ciclo-de-vida.repository.ts` | alterado |
| `packages/core/src/estrutura/vinculo.repository.ts` | alterado |
| `apps/api/test/ciclo-de-vida.int.test.ts`, `apps/api/test/acesso-fim-do-vinculo.int.test.ts` | alterado |
| `docs/lgpd.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| Professor desativado: os vínculos da escola são encerrados e ele não alcança a turma | integração | caminho feliz | caminho feliz (RF5; regra 20, item 18) …; `acesso-fim-do-vinculo` › a desativação do professor revoga o acesso que ele gerou … |
| O `desativar` revoga o convite aberto de usuário ativo (defesa, estado montado no banco); o aceite depois é recusado | integração | N1 da A1 | defesa do N1 da A1: o desativar revoga o convite aberto do professor …; e `o convite já usado e o já revogado ficam como estão …` |
| O acesso da turma gerado por ele é revogado | integração | encerra os vínculos antes | o acesso da turma que o professor gerou é revogado pela desativação …; `acesso-fim-do-vinculo` › o gerar parado depois do insert: a desativação espera a turma …; a desativação parada com a turma travada … |
| Vínculos no ano em curso e no planejado: todos encerrados | integração | ano | ano: os vínculos do ano em curso e os do planejado são todos encerrados …; o aluno desativado também tem o vínculo encerrado … |
| Escola sem ano em curso: o vínculo do planejado é encerrado | integração | ano | ano: escola sem ano em curso, o vínculo do ano planejado é encerrado … |
| Espião no SQL: um único `for no key update … order by id` sobre as turmas | integração | trava num comando só | trava num comando só: um único for no key update com order by id … |
| Espião: a ordem global no `desativar` | integração | ordem | ordem global no desativar: …; o ano em que ela só tem vínculo encerrado … não entra na trava do desativar |
| Espião: a ordem global no `eliminar` | integração | ordem | ordem global no eliminar, sem ano no contexto: … |
| [P] `desativar` contra `virarSala` na mesma turma, com barreira: um espera o outro, zero `40P01` | [P] | ordem global | [P] desativar contra o virarSala na mesma turma, com barreira: … |
| [P] `desativar` contra `virarAno`: nenhum vínculo aberto no ano novo | [P] | ano em `FOR SHARE` | [P] desativar contra o virarAno (encerrar o ano), com barreira: … |
| Desligado na escola A segue entrando e vendo as turmas na B | integração | isolamento (RF16) | isolamento (RF16): a professora desligada na escola A segue entrando … |
| A coordenação de B não desativa a pessoa de A: igual a inexistente | integração | isolamento | isolamento: a coordenação de B não desativa a pessoa de A …; isolamento no repository: … |
| Professor pendente (cadastrado por `POST /v1/professores`): `desativar` dá `NAO_ENCONTRADO` e não toca convite nem vínculo | integração | inativo não ativável | professor pendente, cadastrado por POST /v1/professores: o desativar responde NAO_ENCONTRADO … |
| A — o aceito sem a primeira entrada: `desativar` responde como ao ativo, encerra os vínculos, a lista diz `desativado` e o login com o bilhete não o ativa | integração | alcance do à espera (E11) | `[I] o professor que aceitou com a conta que já tinha senha e não entrou: o desativar responde como ao ativo …` |
| O pendente, o aceito com o convite revogado e o desativado: `NAO_ENCONTRADO`, mesmo com o convite aceito de outra pessoa da escola | integração | condição do à espera | `o pendente, o aceito que teve o convite revogado e o desativado não são "à espera" …` |
| B — [P] `desativar` × aceite, a desativação começa antes: zero `40P01`, `usado_em < desativado_em`, o bilhete não reativa | [P] | `clock_timestamp()` | `[P] desativar × aceite, a desativação começa antes …` |
| C — [P] `desativar` × aceite, a desativação pega o usuário primeiro: `NAO_ENCONTRADO` antes da conta, zero `40P01`, o aceite ativa | [P] | recusa antes do `travarConta` | `[P] desativar × aceite, a desativação pega o usuário primeiro …` |
| D — [P] `desativar` × `ativar` do login do à espera: o usuário termina inativo e sem vínculo aberto | [P] | `desativar` × `ativarPorConvite` | `[P] desativar × ativar do login, para o à espera …` |
| A coordenação de A desativa a pessoa de B com o ano de B travado: `NAO_ENCONTRADO`, sem `55P03` | integração | isolamento (regra 10, item 6) | isolamento: a coordenação de A que desativa a pessoa de B, com o ano de B travado pela virada dele … |
| Log do `desativar`, se houver: só ids | integração | regra 20, item 9 | regra 20, item 9: o ciclo de vida não registra log, só auditoria com ids (não há log); a auditoria leva só ids, no caminho feliz |

## Como testar

- Molde: `apps/api/test/ciclo-de-vida.int.test.ts › caminho feliz (RF5; regra 20, item 18): o aluno desativado tem o hash da senha apagado, …`; revogação: `apps/api/test/acesso-fim-do-vinculo.int.test.ts › encerrar o último vínculo do professor na turma revoga o acesso que ele gerou, …`
- Barreira: `WriteBlockTrigger` e `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`); trava da escola: `segurarTravaDaEscola`, `emOrdemNaTrava` (`apps/api/test/escola-lock.ts`)
- Espião no SQL: **sem precedente** no repositório. O mais próximo é o `vi.spyOn(hash, 'verificar')` de `apps/api/test/sessao-matricula.int.test.ts`; aqui, o espião vai no `query` do pool (`packages/core/src/db/pool.ts`) e confere a ordem dos `for … update/share`
- Comando: `npx vitest run --project integracao apps/api/test/ciclo-de-vida.int.test.ts`
- Armadilha: nos [P] que dependem do `lock_timeout`, confira só o estado final

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3, o professor tem vínculo em duas turmas e em dois anos.

## Fora do escopo desta tarefa

Cancelar o envio por e-mail e anular a senha provisória (F2c); o desligamento pela planilha (6.0 e 10.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O `desativar` alcança o ativo e o à espera da primeira entrada; o inativo não ativável responde `NAO_ENCONTRADO` antes da conta; o convite em aberto num usuário ativo é revogado como defesa | O alcance do `desativar` é o de quem o login ainda ativaria (E11 da A1 preservada): o professor que aceitou com a conta que já tinha senha é inativo mas ativável, e o `convite/revogar` lhe dá `CONFLITO`; o `desativado_em` é `clock_timestamp()`, depois da trava do usuário, e a recusa do inativo vem antes do `travarConta` (a ordem do aceite é conta → usuário). O `usuarioConvidado` só cria ou reaproveita usuário inativo, então nenhuma rota põe convite em aberto num usuário ativo (diagnóstico do Arquiteto, `.processo/ordens/diagnostico-3.md`) | `techspec.md` §2, linha `packages/core/src/ciclo-de-vida/`; `cenarios.md` RF6, os itens do `desativar` (o do convite, dito defesa no nome do teste, o do professor pendente e os três do à espera) |
| O encerramento dos vínculos é por pessoa, em `CicloDeVidaRepository.encerrarVinculosDaPessoa`, e alcança professor e aluno, no ano em curso e no planejado, e não o `VinculoRepository.encerrar` | O `encerrar` é por id, só do vínculo de professor e só do ano em curso (`#escopo`); o acesso da turma sai pelo mesmo `revogarDeQuemSaiu` | `techspec.md` §2, mesma linha; `cenarios.md` RF6, o item do `desativar` |

## Mutações

--faltando: 1 linhas (33 blocos, 6 motivos)

**Sem bloco (motivo):** (1) `ciclo-de-vida.repository.ts:69` e `:76`, os dois `.where(` da trava do ano (o de fora e o do `exists`): três das quatro cláusulas estão cobertas, `eq(anoLetivo.escolaId, …)` pelo caso de isolamento com o ano de B travado, `eq(vinculo.anoLetivoId, anoLetivo.id)`, `eq(vinculo.usuarioId, …)` e o `soAbertos` pelo caso do ano "só encerrado" (os blocos abaixo); a quarta cláusula do `exists`, `eq(vinculo.escolaId, anoLetivo.escolaId)`, não tem bloco: com o `anoLetivoId` e o `usuarioId` já no `exists`, e o ano limitado à escola do contexto, o vínculo casado é sempre da mesma escola do ano, e o banco garante isso em cadeia, pelas duas FKs compostas `vinculo_turma_do_ano_da_escola_fk` (do vínculo à turma) e `turma_ano_letivo_da_escola_fk` (da turma ao ano), então apagá-la não muda nenhuma linha. (2) `:110`, `if (abertos.length === 0) return []`: atalho que poupa o `update` vazio; sem ele o `inArray` com lista vazia vira `false` e nada muda, o resultado é o mesmo. (3) O `eq(vinculo.escolaId, …)` e o `eq(vinculo.usuarioId, …)` do `update` do encerramento (`:115`) também não têm bloco: o `inArray(vinculo.id, ids)` já limita o `update` aos ids que a leitura anterior devolveu, e a leitura filtra pela escola e pelo usuário (tem blocos); as duas cláusulas do `update` ficam como segunda camada.

A trava do ano, o `usuarioId` do `exists`: sem ele, o ano em que só a colega tem vínculo aberto entra na trava.

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › o ano em que ela só tem vínculo encerrado, ou em que só a colega tem vínculo aberto, não entra na trava do desativar; na do eliminar, o ano em que ela tem vínculo encerrado entra
                  eq(vinculo.anoLetivoId, anoLetivo.id),
-                 eq(vinculo.usuarioId, usuarioId),
                  soAbertos ? ne(vinculo.estado, 'encerrado') : undefined,
```

O `soAbertos`: sem ele, o ano em que ela só tem vínculo encerrado entra na trava da desativação.

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › o ano em que ela só tem vínculo encerrado, ou em que só a colega tem vínculo aberto, não entra na trava do desativar; na do eliminar, o ano em que ela tem vínculo encerrado entra
                  eq(vinculo.usuarioId, usuarioId),
-                 soAbertos ? ne(vinculo.estado, 'encerrado') : undefined,
+                 undefined,
```

A leitura dos vínculos abertos, o `ne(estado, 'encerrado')`: sem ele, o vínculo já encerrado por realocação é encerrado de novo e perde o motivo.

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › ano: os vínculos do ano em curso e os do planejado são todos encerrados, em qualquer estado; o que já estava encerrado mantém o motivo e não ganha registro
-     .where(and(eq(vinculo.escolaId, escolaId), eq(vinculo.usuarioId, usuarioId), ne(vinculo.estado, 'encerrado')))
+     .where(and(eq(vinculo.escolaId, escolaId), eq(vinculo.usuarioId, usuarioId)))
      .orderBy(asc(vinculo.id))
```

O `escolaId` da leitura: no contexto de A, acha o vínculo de B.

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › isolamento no repository: no contexto da escola A, encerrar os vínculos e revogar o convite da pessoa de B não alcança nada; no de B, alcança
-     .where(and(eq(vinculo.escolaId, escolaId), eq(vinculo.usuarioId, usuarioId), ne(vinculo.estado, 'encerrado')))
+     .where(and(eq(vinculo.usuarioId, usuarioId), ne(vinculo.estado, 'encerrado')))
      .orderBy(asc(vinculo.id))
```

O `usuarioId` da leitura: sem ele, a desativação encerra o vínculo do colega.

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › caminho feliz de RF5 e da regra 20 item 18: os vínculos do professor desativado na escola são encerrados por desligamento, com a auditoria da coordenação, e o colega de turma segue com o dele
-     .where(and(eq(vinculo.escolaId, escolaId), eq(vinculo.usuarioId, usuarioId), ne(vinculo.estado, 'encerrado')))
+     .where(and(eq(vinculo.escolaId, escolaId), ne(vinculo.estado, 'encerrado')))
      .orderBy(asc(vinculo.id))
```

Os ids do `update`: sem o `inArray`, o vínculo já encerrado por realocação é reescrito.

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › ano: os vínculos do ano em curso e os do planejado são todos encerrados, em qualquer estado; o que já estava encerrado mantém o motivo e não ganha registro
      .set({ estado: 'encerrado', motivoEncerramento: motivo, encerradoEm: sql`now()` })
-     .where(and(eq(vinculo.escolaId, escolaId), eq(vinculo.usuarioId, usuarioId), inArray(vinculo.id, ids)))
+     .where(and(eq(vinculo.escolaId, escolaId), eq(vinculo.usuarioId, usuarioId)))
```

A correlação do `exists` com o ano: sem o `anoLetivoId`, todo ano da escola entra na trava quando a pessoa tem qualquer vínculo aberto, e o planejado trava a desativação.

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › o ano em que ela só tem vínculo encerrado, ou em que só a colega tem vínculo aberto, não entra na trava do desativar; na do eliminar, o ano em que ela tem vínculo encerrado entra
                  eq(vinculo.escolaId, anoLetivo.escolaId),
-                 eq(vinculo.anoLetivoId, anoLetivo.id),
                  eq(vinculo.usuarioId, usuarioId),
```

O `escolaId` da trava do ano: sem ele, a coordenação de A que desativa a pessoa de B trava os anos de B e recebe `55P03`, e não o `NAO_ENCONTRADO` do inexistente.

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › isolamento: a coordenação de A que desativa a pessoa de B, com o ano de B travado pela virada dele, recebe NAO_ENCONTRADO, e não espera nem 55P03
      .where(
        and(
-         eq(anoLetivo.escolaId, requireEscolaId()),
          exists(
```

O convite já usado não se revoga.

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › o convite já usado e o já revogado ficam como estão, e o convite aberto de outra pessoa da escola não é tocado
-     .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.usuarioId, usuarioId), isNull(convite.usadoEm), isNull(convite.revogadoEm)))
+     .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.usuarioId, usuarioId), isNull(convite.revogadoEm)))
```

O convite já revogado não se revoga de novo (a hora não muda).

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › o convite já usado e o já revogado ficam como estão, e o convite aberto de outra pessoa da escola não é tocado
-     .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.usuarioId, usuarioId), isNull(convite.usadoEm), isNull(convite.revogadoEm)))
+     .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.usuarioId, usuarioId), isNull(convite.usadoEm)))
```

O `usuarioId` do convite: sem ele, a desativação revoga o convite aberto da colega.

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › o convite já usado e o já revogado ficam como estão, e o convite aberto de outra pessoa da escola não é tocado
-     .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.usuarioId, usuarioId), isNull(convite.usadoEm), isNull(convite.revogadoEm)))
+     .where(and(eq(convite.escolaId, requireEscolaId()), isNull(convite.usadoEm), isNull(convite.revogadoEm)))
```

O `escolaId` do convite: no contexto de A, revoga o convite de B.

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › isolamento no repository: no contexto da escola A, encerrar os vínculos e revogar o convite da pessoa de B não alcança nada; no de B, alcança
-     .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.usuarioId, usuarioId), isNull(convite.usadoEm), isNull(convite.revogadoEm)))
+     .where(and(eq(convite.usuarioId, usuarioId), isNull(convite.usadoEm), isNull(convite.revogadoEm)))
```

Service, a trava do ano na ordem global: sem ela, o ano não entra antes do usuário.

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › ordem global no desativar: o ano em FOR SHARE, o usuário, a conta, as turmas, e só então o vínculo
      const repositorio = new CicloDeVidaRepository(tx)
-     if (anos !== 'nenhum') await repositorio.travarAnosDosVinculos(usuarioId, anos === 'abertos')
+     if (anos === 'nenhum') await repositorio.travarAnosDosVinculos(usuarioId, anos === 'abertos')
      const alvo = await repositorio.travarUsuario(usuarioId)
```

A eliminação trava todos os anos em que a pessoa tem vínculo, não só os abertos.

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › o ano em que ela só tem vínculo encerrado, ou em que só a colega tem vínculo aberto, não entra na trava do desativar; na do eliminar, o ano em que ela tem vínculo encerrado entra
-     if (anos !== 'nenhum') await repositorio.travarAnosDosVinculos(usuarioId, anos === 'abertos')
+     if (anos !== 'nenhum') await repositorio.travarAnosDosVinculos(usuarioId, true)
```

As turmas dele, num comando só, antes dos vínculos: sem a trava, a desativação não espera o gerar acesso que está no meio e o acesso novo fica vigente.

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts
teste: apps/api/test/acesso-fim-do-vinculo.int.test.ts › o gerar parado depois do insert: a desativação espera a turma e revoga o acesso que acabou de nascer na tarefa 3.0
      // qualquer vínculo (turma → vínculo, a ordem do encerrar, do excluir e da eliminação).
-     await repositorio.travarContraOGerarDoProfessor(usuarioId)
      const desativadoEm = await repositorio.desativar(usuarioId)
```

Os vínculos da pessoa: sem o encerramento, os vínculos seguem abertos.

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › caminho feliz de RF5 e da regra 20 item 18: os vínculos do professor desativado na escola são encerrados por desligamento, com a auditoria da coordenação, e o colega de turma segue com o dele
-     const vinculosEncerrados = await repositorio.encerrarVinculosDaPessoa(usuarioId, 'desligamento')
+     const vinculosEncerrados = [] as Awaited<ReturnType<typeof repositorio.encerrarVinculosDaPessoa>>
      for (const encerrado of vinculosEncerrados) {
```

O motivo do encerramento é o desligamento.

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › caminho feliz de RF5 e da regra 20 item 18: os vínculos do professor desativado na escola são encerrados por desligamento, com a auditoria da coordenação, e o colega de turma segue com o dele
-     const vinculosEncerrados = await repositorio.encerrarVinculosDaPessoa(usuarioId, 'desligamento')
+     const vinculosEncerrados = await repositorio.encerrarVinculosDaPessoa(usuarioId, 'realocacao')
      for (const encerrado of vinculosEncerrados) {
```

O acesso da turma que ele gerou é revogado, com a auditoria.

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts
teste: apps/api/test/acesso-fim-do-vinculo.int.test.ts › a desativação do professor revoga o acesso que ele gerou, com auditoria, e o link e o código deixam de abrir a sala na tarefa 3.0
-     for (const revogado of await repositorio.revogarDeQuemSaiu(usuarioId)) {
-       await registro.gravar(tx, 'acesso_turma.revogado', { entidadeId: revogado.id, depois: { turmaId: revogado.turmaId }, ...autoria })
-     }
      const conviteRevogado = await repositorio.revogarConviteAberto(usuarioId)
```

O convite aberto é revogado e a revogação vai à auditoria.

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › defesa do N1 da A1 com o estado montado no banco: o desativar do usuário ativo com convite aberto o revoga, e o aceite depois é recusado, sem reativá-lo
-     const conviteRevogado = await repositorio.revogarConviteAberto(usuarioId)
+     const conviteRevogado = undefined as Awaited<ReturnType<typeof repositorio.revogarConviteAberto>>
      if (conviteRevogado !== undefined) await registro.gravar(tx, 'convite.revogado', { entidadeId: conviteRevogado.id, depois: { tipo: conviteRevogado.tipo }, ...autoria })
```

## A desativação do à espera da primeira entrada (diagnóstico do Arquiteto)

**Sem bloco (motivo, rodada 3):** (1) `isNotNull(convite.usadoEm)` do `#conviteAceitoAEspera`: o `gte(convite.usadoEm, usuario.desativadoEm)` seguinte já é nulo (falso) quando `usado_em` é nulo, então apagá-la não muda nenhuma linha; ela fica porque a condição é a cópia do `ativarPorConvite`. (2) `eq(convite.escolaId, requireEscolaId())` do mesmo método: a FK composta `convite_usuario_da_escola_fk` (`escola_id`, `usuario_id`) já prende o convite à escola do usuário a que ele pertence, e o `eq(convite.usuarioId, usuario.id)` tem bloco; é a segunda camada da regra 10. (3) O `false` que o `desligarContaExterna` passa a `#naTransacao`: trocá-lo por `true` não muda nenhuma resposta, porque o `desligarContaExterna` recusa o inativo pela linha dele, depois (o `desligarContaExterna` mantém a recusa como está, fora desta tarefa).

O `clock_timestamp()`: com `now()`, o aceite que ativou o usuário enquanto a desativação esperava o ano tem `usado_em` maior que o `desativado_em`, e o bilhete o reativa (caso B).

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › desativar × aceite, a desativação começa antes
-      .set({ desativadoEm: sql`clock_timestamp()` })
+      .set({ desativadoEm: sql`now()` })
```

O `exists` do `update` da desativação: sem ele, o à espera da primeira entrada responde `NAO_ENCONTRADO` (caso A).

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › o professor que aceitou com a conta que já tinha senha e não entrou: o desativar responde como ao ativo
-          or(isNull(usuario.desativadoEm), exists(this.#conviteAceitoAEspera())),
+          isNull(usuario.desativadoEm),
```

O `isNull(desativado_em)` do `update`: sem ele, o usuário ativo não se desativa, só o à espera.

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › caminho feliz de RF5 e da regra 20 item 18: os vínculos do professor desativado na escola são encerrados por desligamento, com a auditoria da coordenação, e o colega de turma segue com o dele
-          or(isNull(usuario.desativadoEm), exists(this.#conviteAceitoAEspera())),
+          exists(this.#conviteAceitoAEspera()),
```

O campo que diz se o usuário está à espera: sem ele (sempre falso), o service recusa o à espera (caso A).

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › o professor que aceitou com a conta que já tinha senha e não entrou: o desativar responde como ao ativo
-        aEsperaDaPrimeiraEntrada: sql<boolean>`${exists(this.#conviteAceitoAEspera())}`,
+        aEsperaDaPrimeiraEntrada: sql<boolean>`false`,
```

O convite revogado não faz o usuário ficar à espera: sem o `isNull(revogado_em)`, o aceito com o convite revogado é desativado.

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › o pendente, o aceito que teve o convite revogado e o desativado não são "à espera": o desativar responde NAO_ENCONTRADO, mesmo com o convite aceito de outra pessoa da escola
-          isNotNull(convite.usadoEm),
-          isNull(convite.revogadoEm),
+          isNotNull(convite.usadoEm),
```

O convite é do usuário: sem o `eq(convite.usuarioId, usuario.id)`, o convite aceito de outra pessoa da escola faz do pendente um à espera.

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › o pendente, o aceito que teve o convite revogado e o desativado não são "à espera": o desativar responde NAO_ENCONTRADO, mesmo com o convite aceito de outra pessoa da escola
-          eq(convite.usuarioId, usuario.id),
           isNotNull(convite.usadoEm),
```

O `gte(usado_em, desativado_em)`: sem ele, o usuário já desativado, com o convite usado e não revogado, ainda é desativado de novo (o segundo `desativar` do caso A).

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › o professor que aceitou com a conta que já tinha senha e não entrou: o desativar responde como ao ativo
           isNull(convite.revogadoEm),
-          gte(convite.usadoEm, usuario.desativadoEm),
```

O inativo que o login não ativaria é recusado antes da conta: recusado depois do `travarConta`, o `desativar` do pendente espera a conta que o aceite segura e o aceite espera o usuário (`40P01`, caso C).

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › desativar × aceite, a desativação pega o usuário primeiro
-      if (recusarInativo && alvo.desativadoEm !== null && !alvo.aEsperaDaPrimeiraEntrada) throw naoEncontrado()
       if (alvo.contaId !== null) await new ContaGlobalRepository(tx).travarConta(alvo.contaId)
+      if (recusarInativo && alvo.desativadoEm !== null && !alvo.aEsperaDaPrimeiraEntrada) throw naoEncontrado()
```

A recusa deixa passar o à espera: sem o `!alvo.aEsperaDaPrimeiraEntrada`, o à espera responde `NAO_ENCONTRADO` (caso A).

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › o professor que aceitou com a conta que já tinha senha e não entrou: o desativar responde como ao ativo
-      if (recusarInativo && alvo.desativadoEm !== null && !alvo.aEsperaDaPrimeiraEntrada) throw naoEncontrado()
+      if (recusarInativo && alvo.desativadoEm !== null) throw naoEncontrado()
```

A recusa só vale para o inativo: sem o `alvo.desativadoEm !== null`, o usuário ativo é recusado.

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › caminho feliz de RF5 e da regra 20 item 18: os vínculos do professor desativado na escola são encerrados por desligamento, com a auditoria da coordenação, e o colega de turma segue com o dele
-      if (recusarInativo && alvo.desativadoEm !== null && !alvo.aEsperaDaPrimeiraEntrada) throw naoEncontrado()
+      if (recusarInativo && !alvo.aEsperaDaPrimeiraEntrada) throw naoEncontrado()
```

A recusa é só da desativação: sem o `recusarInativo`, a eliminação de quem já foi desativado responde `NAO_ENCONTRADO`.

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › eliminar quem já foi desativado, com a conta já limpa, não a limpa de novo
-      if (recusarInativo && alvo.desativadoEm !== null && !alvo.aEsperaDaPrimeiraEntrada) throw naoEncontrado()
+      if (alvo.desativadoEm !== null && !alvo.aEsperaDaPrimeiraEntrada) throw naoEncontrado()
```

A eliminação não recusa o inativo: com `true` no lugar do `false`, eliminar quem já foi desativado responde `NAO_ENCONTRADO`.

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › eliminar quem já foi desativado, com a conta já limpa, não a limpa de novo
-    await this.#naTransacao(usuarioId, transacao, 'todos', false, async (tx, alvo) => {
+    await this.#naTransacao(usuarioId, transacao, 'todos', true, async (tx, alvo) => {
```

A desativação recusa o inativo que o login não ativaria: com `false`, o pendente não é recusado antes da conta (caso C).

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › desativar × aceite, a desativação pega o usuário primeiro
-    await this.#naTransacao(usuarioId, transacao, 'abertos', true, async (tx, alvo) => {
+    await this.#naTransacao(usuarioId, transacao, 'abertos', false, async (tx, alvo) => {
```

O caso D (`desativar` × `ativar` do login): sem o `exists` no `update`, a desativação do à espera responde `NAO_ENCONTRADO` e nunca para no gatilho, que é onde o caso espera (a mutação do caso A, vista pelo D).

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts
teste: apps/api/test/ciclo-de-vida.int.test.ts › desativar × ativar do login, para o à espera
-          or(isNull(usuario.desativadoEm), exists(this.#conviteAceitoAEspera())),
+          isNull(usuario.desativadoEm),
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | `:66`: a cláusula `eq(anoLetivo.escolaId, …)` da trava do ano sem teste próprio | Virou bloqueante do test-engineer na rodada 1 e tem teste desde a rodada 2 (isolamento com o ano de B travado) |
| tenancy-guardian (1ª) | `:110`: o `eq(vinculo.escolaId, …)` do `update` do encerramento sem teste próprio | Recusada: a leitura anterior filtra por escola e o `update` só recebe os ids dela; o motivo escrito em "Mutações" cobre. Um teste que chamasse o `update` sem a leitura exercitaria uma ordem que o código não faz |
| conformidade-reviewer (1ª) | Teste de que nenhum caminho de `desativar` grava `vinculo.encerrado` sem `autor_usuario_id` e sem `autor_operador` | 6.0 (o desligamento pela planilha é o segundo chamador do `desativar` e decide o autor do job) |
| privacy-guardian (1ª) e revisor-geral (1ª) | Marcar em `TODO.md:1019` a parte resolvida pela 3.0 | `TODO.md`: o que sobra aberto é a janela do `criar` e o `40P01` que sai como `ERRO_INTERNO` em outros caminhos; a 3.0 fechou o N1 com o `clock_timestamp()` |
| privacy-guardian (1ª) | Comentário de `vinculo.encerrado` em `packages/core/src/auditoria/acoes.ts:302` citar também a desativação (3.0) | `TODO.md` (item de acabamento da 3.0): `acoes.ts` está fora dos arquivos da tarefa |
| revisor-geral (1ª) e infra-guardian (1ª) | A janela do `criar`: o `VinculoService.criar` não trava o usuário e um vínculo `pendente` nasce para usuário já desativado; caso [I] de `POST /v1/vinculos` para desativado | `TODO.md`, no item de `TODO.md:1019`; `vinculo.service.ts` está fora desta tarefa |
| infra-guardian (1ª) | `encerrarVinculosDaPessoa` filtra por `(escola_id, usuario_id)` sem ano e só o prefixo da escola do `vinculo_usuario_idx` serve; restringir aos anos travados ou anexar o `EXPLAIN` | `TODO.md`: medir com o `EXPLAIN` de uma escola de 900 alunos e cinco anos (regra 80, item 8); muda a forma da query |
| test-engineer (1ª) | `--faltando: 3 linhas (…)` "parece saída da ferramenta colada no documento. Tirar." | Recusada: a linha é a que o `executar-task` manda deixar no começo de "Mutações" (`.claude/skills/executar-task/SKILL.md:90-91`) |
| test-engineer (1ª) | O `FOR UPDATE` da leitura dos vínculos (`:104`) não é provado; [P] de desativar contra o professor confirmando o vínculo | `TODO.md`: [P] novo com barreira, não cabe em poucas linhas |
| test-engineer (1ª) | O [P] contra o `virarSala` só prova um sentido; falta a desativação parada com a virada chegando | `TODO.md`: o mesmo, [P] novo |
| test-engineer (1ª) | O caminho feliz prova "não alcança a turma" pelo 401 do `/eu`; conferir também o 404 numa rota da turma | `TODO.md`: o próprio revisor diz "se for o caso"; o 401 é o que `acesso-fim-do-vinculo` já prova |
| infra-guardian (2ª) | O impacto do bloqueante era limitado (o usuário reativado ficava sem vínculo); dizer na AIA ou no `TODO.md` se a correção atrasasse | Sem efeito: a correção não atrasou, o N1 está fechado pelo `clock_timestamp()` |
| infra-guardian (2ª) | `TODO.md:1019` ainda lista como aberta a parte que a tarefa resolveu | `TODO.md`, mesma linha da quarta acima |
| revisor-geral (2ª) | `3_task.md:27`: a subtarefa 3.1 ainda diz "pelo `encerrar`"; remeter à divergência | Recusada: o plano da tarefa (subtarefas e arquivos previstos) não se reescreve depois; o registro é a tabela "Divergências resolvidas" |
| revisor-geral (2ª) | `3_task.md:38`: a tabela de arquivos previstos ainda lista `vinculo.repository.ts`, que não mudou | Recusada, mesmo motivo: a divergência do encerramento por pessoa explica por que o arquivo não mudou |
| revisor-geral (3ª) e test-engineer (3ª) | O nome do teste da condição do à espera (`ciclo-de-vida.int.test.ts:83`) cita "o desativado", mas o corpo só exercita o pendente e o aceito com convite revogado; o desativado aparece no fim do caso A (`:80`) | `TODO.md` (acabamento da 3.0): renomear é mudança em arquivo de teste e caducaria o test-engineer e o revisor-geral, e o caso A já prova o desativado |
| revisor-geral (3ª) | Quebrar a linha do docblock do `revogarConviteAberto` (`ciclo-de-vida.repository.ts:285`), bem mais longa que as vizinhas | `TODO.md` (acabamento da 3.0): estilo, sem efeito no comportamento; mexer no `.ts` caducaria todos os revisores |
| revisor-geral (3ª) | O `recusarInativo: boolean` posicional entre `anos` e `acao` no `#naTransacao` deixa as chamadas pouco legíveis; usar um objeto `{ anos, recusarInativo }` | `TODO.md` (acabamento da 3.0): refatoração sem mudança de comportamento |
| revisor-geral (3ª) e infra-guardian (3ª) | A desativação do à espera sobrescreve o `desativado_em` (da criação do convite) pela hora da desativação, e o prazo de retenção da rotina `pessoa_desativada` passa a contar daí; registrar no docblock do `desativar` do repository (revisor-geral) ou na linha do usuário de `docs/lgpd.md` (infra-guardian) | `TODO.md` (acabamento da 3.0): é registro de um efeito já provado e desejado; a linha de `docs/lgpd.md` pode ser feita na tarefa que revisar a retenção do usuário |
| tenancy-guardian (2ª), privacy-guardian (2ª) e infra-guardian (3ª) | A condição do à espera (usado, não revogado, `usado_em >= desativado_em`) existe em três lugares (`#conviteAceitoAEspera`, `ativarPorConvite`, `usuarioComConviteAceito`); um teste de guarda que as compare, ou uma origem única em `packages/core` | `TODO.md`: toca `apps/api/src/sessao/convite/convite.repository.ts`, fora desta tarefa; a tarefa da A1 ou da F2c que mexer no convite faz a origem única |
| tenancy-guardian (2ª) | O `eq(convite.escolaId, …)` do `#conviteAceitoAEspera` (`:232`) ficou sem bloco de mutação, com a FK composta `convite_usuario_da_escola_fk` como motivo | Recusada: é segunda camada, com o motivo escrito em "Mutações"; o próprio revisor a chama de aceitável |
| privacy-guardian (2ª) | Confirmar que o pendente com convite revogado entra no `#eliminarPessoasDesativadas` dentro do prazo, para não ficar dado de professor sem finalidade | `TODO.md`: na tarefa do `convite/revogar` ou do expurgo; fora desta tarefa |
| test-engineer (3ª) | O `or(isNull(desativadoEm), exists(#conviteAceitoAEspera()))` inteiro do `update` não tem prova (o service recusa antes); falta o [P] da corrida do convite revogado entre a trava e o `update` | `TODO.md`: [P] novo; o dano de faltar a cláusula é pequeno (desativa quem já perdia o acesso) |
| test-engineer (3ª) | O bloco de mutação do caso D fica vermelho pelo mesmo motivo do caso A; o que o D protege é o `ativarPorConvite` atômico (código da A1) | `TODO.md`: um bloco que troque aquele `update` condicional é código da A1, fora desta tarefa |
| test-engineer (3ª) | O caso C usa um prazo de 5 s com relógio de verdade (`:175`); trocar por espera determinista (`esperarNaTrava`) | `TODO.md` (acabamento da 3.0): o caminho certo termina em milissegundos; mexer no teste caducaria revisores |
| test-engineer (3ª) | No caso B, o comentário da linha 112 ("a desativação não limpa a conta") não tem asserção; conferir que a conta mantém a `senha_hash` | `TODO.md` (acabamento da 3.0): a mutação para `now()` já foi provada pelo portão |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-03 17:46:45 | 2026-11-03 17:47:22 | `tenancy-guardian` | 1 | APROVADO | aa67877241be36c8f |
| 2026-11-03 17:46:52 | 2026-11-03 17:47:29 | `conformidade-reviewer` | 1 | APROVADO | a06b0d67ed4a889d4 |
| 2026-11-03 17:46:47 | 2026-11-03 17:47:42 | `privacy-guardian` | 1 | APROVADO | a28381efb171c2c5d |
| 2026-11-03 17:46:51 | 2026-11-03 17:49:16 | `revisor-geral` | 1 | REPROVADO | a15cb9b6662073614 |
| 2026-11-03 17:46:48 | 2026-11-03 17:49:38 | `infra-guardian` | 1 | REPROVADO | a365a951434fa4927 |
| 2026-11-03 17:46:50 | 2026-11-03 17:50:30 | `test-engineer` | 1 | REPROVADO | a597961cf71a1467a |
| 2026-11-03 18:05:02 | 2026-11-03 18:05:28 | `revisor-geral` | 2 | APROVADO | a6742d970eedb0885 |
| 2026-11-03 18:04:54 | 2026-11-03 18:06:52 | `test-engineer` | 2 | REPROVADO | ab5a62bc6d0fcbbc7 |
| 2026-11-03 18:04:43 | 2026-11-03 18:08:59 | `infra-guardian` | 2 | REPROVADO | a13a5669846009971 |
| 2026-11-03 18:42:30 | 2026-11-03 18:43:02 | `revisor-geral` | 3 | APROVADO | aad4003b55e701eec |
| 2026-11-03 18:42:43 | 2026-11-03 18:43:07 | `conformidade-reviewer` | 2 | APROVADO | a7f26bf9ed90c8bab |
| 2026-11-03 18:42:34 | 2026-11-03 18:43:08 | `tenancy-guardian` | 2 | APROVADO | a9082ececc9819837 |
| 2026-11-03 18:42:39 | 2026-11-03 18:43:17 | `privacy-guardian` | 2 | APROVADO | a5b3331a9864e0d09 |
| 2026-11-03 18:42:18 | 2026-11-03 18:43:38 | `infra-guardian` | 3 | APROVADO | a6fee257909e7fb4f |
| 2026-11-03 18:42:26 | 2026-11-03 18:44:57 | `test-engineer` | 3 | APROVADO | a7161e35ecd7a1885 |
