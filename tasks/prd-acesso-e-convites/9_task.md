# Tarefa 9.0 — Gerar a senha provisória (API)

**Funcionalidade:** acesso-e-convites · **Depende de:** nenhuma
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `test-engineer`
**Porte:** grande

## Objetivo

`POST /v1/usuarios/:usuarioId/senha-provisoria` dá à coordenação ou ao professor da turma uma senha de 24 h para o aluno aprovado, que derruba a senha e as sessões dele; com a conta da escola ligada, `ENTRA_PELA_CONTA_DA_ESCOLA`; o expurgo e o `desativar` anulam a provisória.

## Contexto necessário

- `techspec.md` seções 3, 4, 5 ("Senha provisória", "Auditoria") e 7c; `prd.md` RF13, RF16, RF17 e §7; `cenarios.md` RF13, "Corridas", "Limites"
- `.claude/rules/10` itens 3, 4 e 6; `.claude/rules/80` itens 1 e 7
- `credencial-matricula.repository.ts`, `password-hasher.ts` (o semáforo); `ciclo-de-vida.repository.ts` (`desativar`)

## Subtarefas

- [x] 9.1 — Migration que só expande `credencial_matricula` (`provisoriaHash`, `provisoriaExpiraEm`, `provisoriaGeradaPor` com `set null`, índice parcial do expurgo)
- [x] 9.2 — A rota em `credencial/`: trava da linha do usuário do aluno, escopo (vínculo confirmado ou coordenação), conta ligada, `CONFLITO` de 10 s; só então as cotas (60/h por usuário, 5/dia por aluno), a senha, as sessões e `senha_provisoria.gerada` com o papel no `depois`
- [x] 9.3 — O `desativar` anula as três colunas; o alvo novo no `retencao.expurgar-escola`; a métrica de provisórias por escola
- [x] 9.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0045_senha_provisoria.sql` | novo |
| `packages/core/drizzle/meta/_journal.json` | alterado |
| `packages/core/src/db/schema/credencial-matricula.ts` | alterado |
| `packages/shared/src/sessao/senha-provisoria.ts` | novo |
| `apps/api/src/credencial/senha-provisoria.controller.ts` | novo |
| `apps/api/src/credencial/senha-provisoria.service.ts` | novo |
| `apps/api/src/credencial/credencial-matricula.repository.ts` | alterado |
| `packages/core/src/auditoria/acoes.ts` | alterado |
| `packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts` | alterado |
| `packages/core/src/retencao/expurgo-da-escola.repository.ts` | alterado |
| `packages/core/src/telemetry/metrics.ts` | alterado |
| `apps/api/test/senha-provisoria.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| coordenação e professor com vínculo confirmado | integração | geram |apps/api/test/senha-provisoria.int.test.ts › a coordenação gera: a resposta traz a senha em dois grupos; o professor com vínculo confirmado na turma do aluno gera; o professor com dois vínculos confirmados |
| permissão: pendente, contestado, encerrado, outra turma; `:usuarioId` de professor ou coordenador | integração | 404 igual ao inexistente |apps/api/test/senha-provisoria.int.test.ts › professor com vínculo pendente, contestado ou encerrado; de professor ou de coordenador da mesma escola; vínculo confirmado de aluno e professor numa turma de um ano encerrado; o aluno e quem não está logado; a id fora do formato |
| isolamento: aluno da escola B | integração | 404 igual |apps/api/test/senha-provisoria.int.test.ts › isolamento: a coordenação e o professor da escola A |
| aluno transferido | integração | a turma antiga recebe 404; a nova gera |apps/api/test/senha-provisoria.int.test.ts › aluno transferido: o professor da turma antiga |
| aluno com pedido pendente | integração | 404 |apps/api/test/senha-provisoria.int.test.ts › aluno com pedido de reivindicação pendente |
| conta da escola ligada, só ela ou com senha | integração | `ENTRA_PELA_CONTA_DA_ESCOLA`, senha intacta; outra turma: 404 |apps/api/test/senha-provisoria.int.test.ts › aluno só com a conta ligada; o professor de outra turma recebe 404, e não 409; o 409 da conta ligada não gasta cota |
| gerar | integração | senha e provisória anteriores param de valer, sessões caem |apps/api/test/senha-provisoria.int.test.ts › gerar derruba a senha, a provisória anterior; a sessão de outro aluno da escola não cai |
| resposta | integração | `no-store`; nenhuma leitura devolve a senha |apps/api/test/senha-provisoria.int.test.ts › a coordenação gera: a resposta traz a senha em dois grupos (o `no-store`); a senha não aparece na lista de alunos da turma |
| o hash | integração | pelo semáforo do argon2 (espião), fora da transação, com a linha do aluno livre |apps/api/test/senha-provisoria.int.test.ts › o hash passa pelo semáforo do argon2; o hash espera o semáforo fora da transação, com a linha do aluno destravada |
| cotas 60/h e 5/dia | integração | 429, contadas depois do escopo e do hash; o 503 não gasta |apps/api/test/senha-provisoria.int.test.ts › 5 por dia por aluno; 60 por hora por quem gera; as cotas contam só depois do escopo; uma provisória não usada de menos de 10 s; o 503 do semáforo não gasta cota |
| `senha_provisoria.gerada` | integração | aluno alvo, papel no `depois`, sem senha nem nome |apps/api/test/senha-provisoria.int.test.ts › `senha_provisoria.gerada` tem o aluno como alvo |
| escola sem ano em curso | integração | a coordenação gera, o professor recebe 404 |apps/api/test/senha-provisoria.int.test.ts › a coordenação gera para o aluno, e o professor recebe 404 |
| provisória vencida com 23 h e com 25 h | integração | fica; depois três colunas nulas, auditoria fica |apps/worker/test/expurgo-da-escola.int.test.ts › senha provisória vencida › relógio falso: a que vence daqui a 1 h; borda: a que vence exatamente agora fica; a contagem vai ao log como |
| isolamento: o alvo próprio do expurgo (fora do `it.each(CATEGORIAS_DO_EXPURGO)`, como a "importação parada") | integração | a linha da B fica |apps/worker/test/expurgo-da-escola.int.test.ts › senha provisória vencida › relógio falso (a da escola B, com a mesma idade, fica); o alvo é próprio, fora do `it.each`, como a "importação parada" e o "envio parado" (`cenarios.md`) |
| `desativar` do aluno; eliminar quem gerou | integração | três colunas nulas; a eliminação passa |apps/api/test/senha-provisoria.int.test.ts › o `desativar` do aluno anula a senha e as três colunas; o `desativar` anula também a provisória do aluno que ainda tem a senha; eliminar quem gerou passa |
| métrica de provisórias por escola | integração | lida como no `metrics.int.test.ts` |apps/api/test/senha-provisoria.int.test.ts › cada geração soma um na série da escola; `packages/core/src/telemetry/metrics.test.ts` e `infra/test/painel.test.ts` (o painel) |
| a senha sorteada | unidade | oito caracteres do alfabeto de 31 sem 0, 1, I, L e O; um sorteio por posição sobre o alfabeto inteiro | apps/api/src/credencial/senha-provisoria.test.ts › o alfabeto tem 31 caracteres; pede um sorteio por posição; a senha sorteada de verdade |
| [P] dois "gerar", mesmo autor e autores diferentes | paralelo | um gera, o outro `CONFLITO` sem gastar cota, um `.gerada`; depois de 10 s vale; cai sem a trava |apps/api/test/senha-provisoria.int.test.ts › [P] dois "gerar" ao mesmo tempo (`mesmo autor`, `autores diferentes`); apps/worker/test/expurgo-da-escola.int.test.ts › com a credencial travada por outra conexão |

## Como testar

- Precedente: `apps/api/test/decisao.int.test.ts` › "I6: o lote misto responde nao_encontrada igual para tudo que quem decide não alcança" (os vínculos pendente, contestado e encerrado)
- Corrida: `apps/api/test/decisao.int.test.ts` › "professor × coordenação aprovando o mesmo pedido: um aluno, uma credencial, uma auditoria"; barreira com `WriteBlockTrigger` e `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`)
- Semáforo: sem precedente do espião; o mais próximo, `apps/api/test/salas-reivindicar.int.test.ts` › "com o teto ocupado por reivindicações da escola A, o login da escola B recebe a vez no rodízio…"
- Expurgo: `apps/worker/test/expurgo-da-escola.int.test.ts:589` e `relogioEm` (linha 68)
- Comando: `npx vitest run --project integracao apps/api/test/senha-provisoria.int.test.ts`

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 4: o 404 do professor de outra turma tem de vir antes do `ENTRA_PELA_CONTA_DA_ESCOLA`, senão o código revela a conta ligada.

**Respostas (plano, antes de codar):**

1. **Mutação de cada cláusula:** a seção "Mutações" tem bloco para cada filtro do `travarAlunoParaProvisoria` (escola, papel, `desativadoEm`, `eliminacaoAgendadaEm`, o ramo do professor, a trava, e em `#aTurmaEDoProfessor` o aluno, o ano, os dois `confirmado` e o professor da sessão), a janela do `CONFLITO`, o `contaLigada`, o `temCredencial`, as duas cotas e a ordem delas, o `>`, o `Retry-After`, o semáforo, as sessões, a auditoria e o papel, a métrica, o `no-store`, a gravação por aluno, o `senhaHash: null`, o `desativar` (o `or`, as três colunas), o expurgo (corte, escola, `skip locked`, a chamada no processor) e a regex do contrato da resposta. As linhas sem bloco estão no fim da seção, com o motivo de cada uma.
2. **Texto na tela:** nenhum. A tarefa é só API; a tela é a 12.0. A mensagem nova (`ENTRA_PELA_CONTA_DA_ESCOLA`) é do catálogo compartilhado e a tela a mostra na 12.0.
3. **Segundo dado que torna a cláusula observável:** um colega na outra turma (o filtro por aluno), um ano encerrado com vínculo confirmado dos dois (o filtro de ano), o professor e o coordenador com linha de credencial (o filtro de papel), um aluno sem conta ligada na escola que tem outros ligados (o `where` da conta), outro aluno com credencial na escola (a gravação por aluno), a escola B com a mesma idade de provisória (o expurgo), um aluno só com a conta, outro com conta e senha.
4. **Checagem anterior que responde antes da regra:** o escopo responde `NAO_ENCONTRADO` antes da conta ligada, do `CONFLITO` e das cotas; os testes de 409 e de 429 usam sempre quem alcança o aluno, e o do professor de outra turma confere que o 404 vem no lugar do 409. O `CONFLITO` vem antes das cotas, e o teste das cinco gerações depois de três conflitos prova que ele não gasta ponto.
5. **A asserção olha o resultado:** a linha de `credencial_matricula` (os quatro estados), as sessões abertas, a auditoria por aluno, o hash conferido com o `argon2.verify`, o cabeçalho `no-store` e o `Retry-After`; nenhum teste olha texto de arquivo.
6. **Guarda nova:** nenhuma. As listas fechadas que a nova peça entra (`architecture.test.ts`: ações de `usuario` e classificação das colunas; `contracts.test.ts`; `painel.test.ts`; `classificacao.ts`) ganharam os nomes novos.
7. **Comentário que afirma o que o código não faz:** relidos o docblock do `SenhaProvisoriaService` (a ordem dos cinco passos), do `travarAlunoParaProvisoria`, do `estadoDaProvisoria`, do `apagarSenhaDaMatricula` e do `anularProvisoriasVencidas` contra o código e a Tech Spec §5.
8. **Divergência:** duas, na tabela abaixo.
9. **Peça que já existe:** `PasswordHasher` e `HashBulkhead` (o semáforo), `WindowCounter` e `insuranceLimit`, `AuditoriaRecorder`, `CicloDeVidaRepository.encerrarSessoesDoUsuario`, `alcanceDe` e `@RequirePermissao`, `WriteBlockTrigger` e `esperarNaTrava`, `MedidorDeTeste`. Peça nova: as três colunas, a ação `senha_provisoria.gerada`, o recurso `senha_provisoria` da matriz, o código `ENTRA_PELA_CONTA_DA_ESCOLA`, os três métodos do repository, o service, o controller, o alvo do expurgo e a métrica.
10. **Paralelo:** dois "gerar" do mesmo aluno (mesmo autor; coordenação e professor), o primeiro preso na gravação da credencial: o segundo passa pela conferência sem trava, faz o hash, espera a trava da linha do usuário na transação curta, vê a provisória e responde `CONFLITO` sem gastar cota; e o expurgo contra a credencial travada por outra conexão (`skip locked`).
11. **Isolamento e coluna "Caso":** o aluno da escola B responde 404 igual ao inexistente para a coordenação e para o professor da A, a credencial de B não muda; o expurgo da A não toca a linha da B; a coluna "Caso" acima tem o caso de cada linha.
12. **Guardiões:** `tenancy-guardian` (escopo no repository, 404 igual, a trava, o expurgo por escola), `privacy-guardian` (a senha só na resposta com `no-store`, só o hash no banco, nada em log, auditoria e métrica; as colunas no mapa de dados e fora do arquivo do titular; `senha_provisoria.gerada` fora do arquivo de quem a assina), `infra-guardian` (o hash pelo semáforo e fora da transação, o 503 que não gasta cota, as cotas depois do escopo e do hash, as janelas de 1 h e de 24 h, a migration que só expande, o índice parcial que começa pela escola, a trava) e `test-engineer` (mutações, paralelos, coluna "Caso").

## Fora do escopo desta tarefa

O login com a provisória e a troca (10.0); a tela (12.0); o "ligar" em "Eu" (15.0), que usa a mesma trava.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| `senha_provisoria.gerada` fica fora do arquivo de quem a assina: a leitura da auditoria do autor (`LEITURAS_DO_ARQUIVO.auditoria`) passa a excluir essa ação | A coordenação **e o professor** a assinam, e o `entidade_id` dela é o do aluno: o arquivo do professor traria o id de outra pessoa (regra 20; o teste de arquitetura das ações de `usuario` existe para isso). Ao aluno ela chega, sem o autor, pela leitura por alvo da 11.0 (D85) | `techspec.md` §5 "Arquivo do titular (D85)" (a leitura por alvo é a 11.0); `cenarios.md` "Arquivo do titular (D85)" |
| A janela de 10 s do `CONFLITO` se mede pela validade gravada menos 24 h, sem coluna de data de geração; o motivo da sessão derrubada é o `senha_redefinida` que já existe | A tarefa só expande as três colunas que a Tech Spec nomeia; a hora da geração é `provisoria_expira_em − 24 h` (relógio do banco), e um motivo novo de sessão pediria outra migration | `techspec.md` §3 e §5 "Senha provisória" (detalhe de implementação: só a Tech Spec) |

## Mutações

--faltando: 7 linhas (58 blocos, 7 motivos). Cada bloco foi aplicado e rodado antes do pedido (executor local sobre o mesmo `comandoDoTeste` do portão): todos ficaram vermelhos num caso que rodou e falhou, e o `falha:` de cada negativa caiu na linha dela.

Cada bloco foi pensado contra a linha que ele tira; o portão aplica, roda o caso e exige vermelho.

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › de professor ou de coordenador da mesma escola
       .where(
         and(
           eq(usuario.escolaId, escolaId),
           eq(usuario.id, usuarioId),
-          eq(usuario.papel, 'aluno'),
           isNull(usuario.desativadoEm),
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › aluno desativado, ou com a eliminação agendada
           eq(usuario.papel, 'aluno'),
-          isNull(usuario.desativadoEm),
           isNull(usuario.eliminacaoAgendadaEm),
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › aluno desativado, ou com a eliminação agendada
           isNull(usuario.desativadoEm),
-          isNull(usuario.eliminacaoAgendadaEm),
           alcance === 'unidade' ? sql`true` : this.#aTurmaEDoProfessor(usuarioId, escolaId),
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › professor com vínculo pendente, contestado ou encerrado
-          alcance === 'unidade' ? sql`true` : this.#aTurmaEDoProfessor(usuarioId, escolaId),
+          sql`true`,
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › mesmo autor: um gera
-    const [travado] = await this.#alunoQueAlcanca(usuarioId, alcance).for('no key update')
+    const [travado] = await this.#alunoQueAlcanca(usuarioId, alcance)
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › vínculo confirmado de aluno e professor numa turma de um ano encerrado
         .where(
           and(
             eq(doAluno.escolaId, escolaId),
-            eq(doAluno.anoLetivoId, anoLetivoId),
             eq(doAluno.usuarioId, alunoId),
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › professor com vínculo pendente, contestado ou encerrado
             eq(doAluno.anoLetivoId, anoLetivoId),
-            eq(doAluno.usuarioId, alunoId),
             eq(doAluno.papel, 'aluno'),
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › aluno transferido: o professor da turma antiga
             eq(doAluno.papel, 'aluno'),
-            eq(doAluno.estado, 'confirmado'),
             eq(doProfessor.usuarioId, professorId),
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › professor com vínculo pendente, contestado ou encerrado
             eq(doAluno.estado, 'confirmado'),
-            eq(doProfessor.usuarioId, professorId),
             eq(doProfessor.papel, 'professor'),
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › professor com vínculo pendente, contestado ou encerrado
             eq(doProfessor.papel, 'professor'),
-            eq(doProfessor.estado, 'confirmado'),
           ),
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › uma provisória não usada de menos de 10 s
-        recente: sql<boolean>`coalesce(${credencialMatricula.provisoriaExpiraEm} > clock_timestamp() + make_interval(hours => ${VALIDADE_DA_SENHA_PROVISORIA_HORAS}) - make_interval(secs => ${JANELA_DO_CONFLITO_DA_SENHA_PROVISORIA_SEGUNDOS}), false)`,
+        recente: sql<boolean>`coalesce(${credencialMatricula.provisoriaExpiraEm} > clock_timestamp() + make_interval(hours => ${VALIDADE_DA_SENHA_PROVISORIA_HORAS}), false)`,
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › a coordenação gera: a resposta traz a senha em dois grupos
-        recente: sql<boolean>`coalesce(${credencialMatricula.provisoriaExpiraEm} > clock_timestamp() + make_interval(hours => ${VALIDADE_DA_SENHA_PROVISORIA_HORAS}) - make_interval(secs => ${JANELA_DO_CONFLITO_DA_SENHA_PROVISORIA_SEGUNDOS}), false)`,
+        recente: sql<boolean>`coalesce(${credencialMatricula.provisoriaExpiraEm} > clock_timestamp() + make_interval(hours => ${VALIDADE_DA_SENHA_PROVISORIA_HORAS}) - make_interval(secs => ${JANELA_DO_CONFLITO_DA_SENHA_PROVISORIA_SEGUNDOS}), true)`,
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › aluno só com a conta ligada
-      .where(and(eq(contaExterna.escolaId, escolaId), eq(contaExterna.usuarioId, usuarioId)))
+      .where(and(eq(contaExterna.escolaId, escolaId)))
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › a sessão de outro aluno da escola não cai
-      .where(and(eq(credencialMatricula.escolaId, requireEscolaId()), eq(credencialMatricula.usuarioId, usuarioId)))
+      .where(and(eq(credencialMatricula.escolaId, requireEscolaId())))
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › gerar derruba a senha, a provisória anterior
       .set({
-        senhaHash: null,
         provisoriaHash: hash,
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › a coordenação gera: a resposta traz a senha em dois grupos
         provisoriaExpiraEm: sql`clock_timestamp() + make_interval(hours => ${VALIDADE_DA_SENHA_PROVISORIA_HORAS})`,
-        provisoriaGeradaPor: geradaPor,
       })
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › a coordenação gera: a resposta traz a senha em dois grupos
-        provisoriaExpiraEm: sql`clock_timestamp() + make_interval(hours => ${VALIDADE_DA_SENHA_PROVISORIA_HORAS})`,
+        provisoriaExpiraEm: sql`clock_timestamp() + make_interval(hours => 1)`,
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › professor com vínculo pendente, contestado ou encerrado
-          and(eq(doProfessor.escolaId, doAluno.escolaId), eq(doProfessor.anoLetivoId, doAluno.anoLetivoId), eq(doProfessor.turmaId, doAluno.turmaId)),
+          and(eq(doProfessor.escolaId, doAluno.escolaId), eq(doProfessor.anoLetivoId, doAluno.anoLetivoId)),
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › de professor ou de coordenador da mesma escola
           eq(usuario.escolaId, escolaId),
-          eq(usuario.id, usuarioId),
           eq(usuario.papel, 'aluno'),
```

```mutacao
arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › aluno aprovado sem credencial por matrícula
falha: not.toHaveBeenCalled()
-      .where(and(eq(credencialMatricula.escolaId, escolaId), eq(credencialMatricula.usuarioId, usuarioId)))
+      .where(and(eq(credencialMatricula.escolaId, escolaId)))
```

```mutacao
arquivo: apps/api/src/credencial/senha-provisoria.service.ts
teste: apps/api/test/senha-provisoria.int.test.ts › o professor de outra turma recebe 404, e não 409
-    const alcancou = travar ? await credenciais.travarAlunoParaProvisoria(alunoId, alcance) : await credenciais.alcancaAluno(alunoId, alcance)
+    const alcancou = travar ? await credenciais.travarAlunoParaProvisoria(alunoId, alcance) : await credenciais.alcancaAluno(alunoId, 'unidade')
```

```mutacao
arquivo: apps/api/src/credencial/senha-provisoria.service.ts
teste: apps/api/test/senha-provisoria.int.test.ts › mesmo autor: um gera
-    const alcancou = travar ? await credenciais.travarAlunoParaProvisoria(alunoId, alcance) : await credenciais.alcancaAluno(alunoId, alcance)
+    const alcancou = await credenciais.alcancaAluno(alunoId, alcance)
```

```mutacao
arquivo: apps/api/src/credencial/senha-provisoria.service.ts
teste: apps/api/test/senha-provisoria.int.test.ts › professor com vínculo pendente, contestado ou encerrado
-    if (!alcancou) throw naoEncontrado()
     const estado = await credenciais.estadoDaProvisoria(alunoId)
```

```mutacao
arquivo: apps/api/src/credencial/senha-provisoria.service.ts
teste: apps/api/test/senha-provisoria.int.test.ts › aluno só com a conta ligada
-    if (estado.contaLigada) throw new DomainException(ErrorCode.ENTRA_PELA_CONTA_DA_ESCOLA)
     if (!estado.temCredencial) throw naoEncontrado()
```

```mutacao
arquivo: apps/api/src/credencial/senha-provisoria.service.ts
teste: apps/api/test/senha-provisoria.int.test.ts › aluno aprovado sem credencial por matrícula
falha: not.toHaveBeenCalled()
-    if (!estado.temCredencial) throw naoEncontrado()
     if (estado.recente) throw new DomainException(ErrorCode.CONFLITO)
```

```mutacao
arquivo: apps/api/src/credencial/senha-provisoria.service.ts
teste: apps/api/test/senha-provisoria.int.test.ts › uma provisória não usada de menos de 10 s
-    if (estado.recente) throw new DomainException(ErrorCode.CONFLITO)
   }
```

```mutacao
arquivo: apps/api/src/credencial/senha-provisoria.service.ts
teste: apps/api/test/senha-provisoria.int.test.ts › 5 por dia por aluno
       await this.#conferir(credenciais, alunoId, alcance, true)
-      await this.#gastarAsCotas(quemGera, alunoId)
       const gravada = await credenciais.gravarProvisoria(alunoId, senhaHash, quemGera)
```

```mutacao
arquivo: apps/api/src/credencial/senha-provisoria.service.ts
teste: apps/api/test/senha-provisoria.int.test.ts › as cotas contam só depois do escopo
     const alcance = alcanceDaGeracao(papel)
-    await this.#conferir(new CredencialMatriculaRepository(banco), alunoId, alcance, false)
+    await this.#gastarAsCotas(quemGera, alunoId)
+    await this.#conferir(new CredencialMatriculaRepository(banco), alunoId, alcance, false)
```

```mutacao
arquivo: apps/api/src/credencial/senha-provisoria.service.ts
teste: apps/api/test/senha-provisoria.int.test.ts › o 503 do semáforo não gasta cota
-    const senha = sortearSenhaProvisoria(this.#sortear)
+    await this.#gastarAsCotas(quemGera, alunoId)
+    const senha = sortearSenhaProvisoria(this.#sortear)
```

```mutacao
arquivo: apps/api/src/credencial/senha-provisoria.service.ts
teste: apps/api/test/senha-provisoria.int.test.ts › mesmo autor: um gera
-      await this.#conferir(credenciais, alunoId, alcance, true)
-      await this.#gastarAsCotas(quemGera, alunoId)
+      await this.#gastarAsCotas(quemGera, alunoId)
+      await this.#conferir(credenciais, alunoId, alcance, true)
```

```mutacao
arquivo: apps/api/src/credencial/senha-provisoria.service.ts
teste: apps/api/test/senha-provisoria.int.test.ts › o hash passa pelo semáforo do argon2
falha: not.toHaveBeenCalled()
     const alcance = alcanceDaGeracao(papel)
-    await this.#conferir(new CredencialMatriculaRepository(banco), alunoId, alcance, false)
     const senha = sortearSenhaProvisoria(this.#sortear)
```

```mutacao
arquivo: apps/api/src/credencial/senha-provisoria.service.ts
teste: apps/api/test/senha-provisoria.int.test.ts › o hash espera o semáforo fora da transação
falha: expect(travas).toEqual([null])
     const senha = sortearSenhaProvisoria(this.#sortear)
-    const senhaHash = await semaforo.executar(escolaBucket(escolaId), () => hash.gerar(senha))
     const resposta = await banco.transaction(async (tx) => {
       const credenciais = new CredencialMatriculaRepository(tx)
       await this.#conferir(credenciais, alunoId, alcance, true)
+      const senhaHash = await semaforo.executar(escolaBucket(escolaId), () => hash.gerar(senha))
       await this.#gastarAsCotas(quemGera, alunoId)
```

```mutacao
arquivo: apps/api/src/credencial/senha-provisoria.service.ts
teste: apps/api/test/senha-provisoria.int.test.ts › o hash passa pelo semáforo do argon2
-      const senhaHash = await semaforo.executar(escolaBucket(escolaId), () => hash.gerar(senha))
+      const senhaHash = await hash.gerar(senha)
```

```mutacao
arquivo: apps/api/src/credencial/senha-provisoria.service.ts
teste: apps/api/test/senha-provisoria.int.test.ts › gerar derruba a senha, a provisória anterior
-      await new CicloDeVidaRepository(tx).encerrarSessoesDoUsuario(alunoId, 'senha_redefinida')
       await registro.gravar(tx, 'senha_provisoria.gerada', { entidadeId: alunoId, depois: { papel: PAPEL_DO_ALCANCE[alcance] } })
```

```mutacao
arquivo: apps/api/src/credencial/senha-provisoria.service.ts
teste: apps/api/test/senha-provisoria.int.test.ts › tem o aluno como alvo, quem gerou como autor
-      await registro.gravar(tx, 'senha_provisoria.gerada', { entidadeId: alunoId, depois: { papel: PAPEL_DO_ALCANCE[alcance] } })
       return senhaProvisoriaResponseSchema.parse({ senha: formatarSenhaProvisoria(senha), expiraEm: gravada.expiraEm.toISOString() })
```

```mutacao
arquivo: apps/api/src/credencial/senha-provisoria.service.ts
teste: apps/api/test/senha-provisoria.int.test.ts › o professor com vínculo confirmado na turma do aluno gera
-      await registro.gravar(tx, 'senha_provisoria.gerada', { entidadeId: alunoId, depois: { papel: PAPEL_DO_ALCANCE[alcance] } })
+      await registro.gravar(tx, 'senha_provisoria.gerada', { entidadeId: alunoId, depois: { papel: 'coordenador' } })
```

```mutacao
arquivo: apps/api/src/credencial/senha-provisoria.service.ts
teste: apps/api/test/senha-provisoria.int.test.ts › cada geração soma um na série da escola
-    this.#geradas.add(1, { [ROTULO_ESCOLA]: escolaId })
     return resposta
```

```mutacao
arquivo: apps/api/src/credencial/senha-provisoria.service.ts
teste: apps/api/test/senha-provisoria.int.test.ts › 5 por dia por aluno
       [porHora, PREFIXO_DAS_PROVISORIAS_POR_USUARIO, quemGera, LIMITE_DE_PROVISORIAS_POR_HORA_E_USUARIO],
-      [porDia, PREFIXO_DAS_PROVISORIAS_POR_ALUNO, alunoId, LIMITE_DE_PROVISORIAS_POR_DIA_E_ALUNO],
     ] as const) {
```

```mutacao
arquivo: apps/api/src/credencial/senha-provisoria.service.ts
teste: apps/api/test/senha-provisoria.int.test.ts › 60 por hora por quem gera
     for (const [janela, prefixo, identificador, limite] of [
-      [porHora, PREFIXO_DAS_PROVISORIAS_POR_USUARIO, quemGera, LIMITE_DE_PROVISORIAS_POR_HORA_E_USUARIO],
       [porDia, PREFIXO_DAS_PROVISORIAS_POR_ALUNO, alunoId, LIMITE_DE_PROVISORIAS_POR_DIA_E_ALUNO],
```

```mutacao
arquivo: apps/api/src/credencial/senha-provisoria.service.ts
teste: apps/api/test/senha-provisoria.int.test.ts › 5 por dia por aluno
-      if (valor > (doSeguro ? insuranceLimit(limite, instancias) : limite)) {
+      if (valor >= (doSeguro ? insuranceLimit(limite, instancias) : limite)) {
```

```mutacao
arquivo: apps/api/src/credencial/senha-provisoria.service.ts
teste: apps/api/test/senha-provisoria.int.test.ts › 5 por dia por aluno
-        throw new DomainException(ErrorCode.LIMITE_EXCEDIDO, undefined, Math.max(1, Math.ceil((await janela.restanteMs(chave)) / 1_000)))
+        throw new DomainException(ErrorCode.LIMITE_EXCEDIDO, undefined, 0)
```

```mutacao
arquivo: apps/api/src/credencial/senha-provisoria.controller.ts
teste: apps/api/test/senha-provisoria.int.test.ts › a coordenação gera: a resposta traz a senha em dois grupos
   @HttpCode(HttpStatus.OK)
-  @Header('Cache-Control', 'no-store')
   gerar(@Param('usuarioId', IdPipe) alunoId: string): Promise<SenhaProvisoriaResponse> {
```

```mutacao
arquivo: apps/api/src/credencial/senha-provisoria.controller.ts
teste: apps/api/test/senha-provisoria.int.test.ts › a coordenação gera: a resposta traz a senha em dois grupos
   @RequirePermissao('senha_provisoria', 'gerar')
-  @HttpCode(HttpStatus.OK)
   @Header('Cache-Control', 'no-store')
```

```mutacao
arquivo: apps/api/src/sessao/sessao.module.ts
teste: apps/api/test/senha-provisoria.int.test.ts › cada geração soma um na série da escola
               instancias: opcoes.instancias,
-              medidor: opcoes.medidor ?? globalMeter(),
+              medidor: globalMeter(),
             }),
           inject: [DB, PasswordHasher, HashBulkhead, REDIS_LOGIN_CLIENT],
```

```mutacao
arquivo: apps/api/src/sessao/sessao.module.ts
teste: apps/api/test/senha-provisoria.int.test.ts › 60 por hora por quem gera
  // As cotas da provisória (60 por hora por quem gera, 5 por dia por aluno) contam em janelas de 1 h e de 24 h, com a mesma chave de HMAC do contador de tentativas: o Redis nunca vê o id.
-porHora: new WindowCounter(cliente, opcoes.login.chaveContador, { janelaMs: 60 * 60 * 1000, avisarSeguro: avisar }),
+porHora: new WindowCounter(cliente, opcoes.login.chaveContador, { janelaMs: 24 * 60 * 60 * 1000, avisarSeguro: avisar }),
```

```mutacao
arquivo: apps/api/src/sessao/sessao.module.ts
teste: apps/api/test/senha-provisoria.int.test.ts › 5 por dia por aluno
  porHora: new WindowCounter(cliente, opcoes.login.chaveContador, { janelaMs: 60 * 60 * 1000, avisarSeguro: avisar }),
-porDia: new WindowCounter(cliente, opcoes.login.chaveContador, { janelaMs: 24 * 60 * 60 * 1000, avisarSeguro: avisar }),
+porDia: new WindowCounter(cliente, opcoes.login.chaveContador, { janelaMs: 60 * 60 * 1000, avisarSeguro: avisar }),
```

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › do aluno anula a senha e as três colunas
       .where(
         and(
           eq(credencialMatricula.escolaId, requireEscolaId()),
           eq(credencialMatricula.usuarioId, usuarioId),
-          or(isNotNull(credencialMatricula.senhaHash), isNotNull(credencialMatricula.provisoriaHash)),
+          isNotNull(credencialMatricula.senhaHash),
```

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › do aluno anula a senha e as três colunas
-      .set({ senhaHash: null, provisoriaHash: null, provisoriaExpiraEm: null, provisoriaGeradaPor: null })
+      .set({ senhaHash: null, provisoriaExpiraEm: null, provisoriaGeradaPor: null })
```

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › do aluno anula a senha e as três colunas
-      .set({ senhaHash: null, provisoriaHash: null, provisoriaExpiraEm: null, provisoriaGeradaPor: null })
+      .set({ senhaHash: null, provisoriaHash: null, provisoriaExpiraEm: null })
```

```mutacao
arquivo: packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts
teste: apps/api/test/senha-provisoria.int.test.ts › do aluno anula a senha e as três colunas
-      .set({ senhaHash: null, provisoriaHash: null, provisoriaExpiraEm: null, provisoriaGeradaPor: null })
+      .set({ senhaHash: null, provisoriaHash: null, provisoriaGeradaPor: null })
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › relógio falso: a que vence daqui a 1 h
-      where escola_id = ${escolaId} and provisoria_expira_em < ${agora.toISOString()}::timestamptz and id = any(array(
+      where escola_id = ${escolaId} and id = any(array(
         select id from credencial_matricula
-        where escola_id = ${escolaId} and provisoria_expira_em < ${agora.toISOString()}::timestamptz
+        where escola_id = ${escolaId}
         order by provisoria_expira_em
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › borda: a que vence exatamente agora fica
-      where escola_id = ${escolaId} and provisoria_expira_em < ${agora.toISOString()}::timestamptz and id = any(array(
+      where escola_id = ${escolaId} and provisoria_expira_em <= ${agora.toISOString()}::timestamptz and id = any(array(
         select id from credencial_matricula
-        where escola_id = ${escolaId} and provisoria_expira_em < ${agora.toISOString()}::timestamptz
+        where escola_id = ${escolaId} and provisoria_expira_em <= ${agora.toISOString()}::timestamptz
         order by provisoria_expira_em
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › relógio falso: a que vence daqui a 1 h
-      where escola_id = ${escolaId} and provisoria_expira_em < ${agora.toISOString()}::timestamptz and id = any(array(
+      where provisoria_expira_em < ${agora.toISOString()}::timestamptz and id = any(array(
         select id from credencial_matricula
-        where escola_id = ${escolaId} and provisoria_expira_em < ${agora.toISOString()}::timestamptz
+        where provisoria_expira_em < ${agora.toISOString()}::timestamptz
         order by provisoria_expira_em
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › com a credencial travada por outra conexão
         order by provisoria_expira_em
-        for update skip locked
       ))
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-da-escola.repository.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › relógio falso: a que vence daqui a 1 h
-      set provisoria_hash = null, provisoria_expira_em = null, provisoria_gerada_por = null
+      set provisoria_hash = null, provisoria_expira_em = null
```

```mutacao
arquivo: apps/worker/src/processors/expurgar-escola.ts
teste: apps/worker/test/expurgo-da-escola.int.test.ts › a contagem vai ao log como
-    const provisoriasAnuladasTotal = await repositorio.anularProvisoriasVencidas(agora)
+    const provisoriasAnuladasTotal = 0
```

```mutacao
arquivo: packages/core/src/titular/leitura-do-titular.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › o ato do professor sobre outro aluno entra sem o dado do aluno
falha: not.toContain(String(valor))
-          where t.escola_id = ${escolaId} and t.autor_usuario_id = ${titularId} and t.acao <> 'senha_provisoria.gerada'`,
+          where t.escola_id = ${escolaId} and t.autor_usuario_id = ${titularId}`,
```

```mutacao
arquivo: packages/shared/src/sessao/senha-provisoria.ts
teste: apps/api/test/senha-provisoria.int.test.ts › a coordenação gera: a resposta traz a senha em dois grupos
-  senha: z.string().regex(/^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/),
+  senha: z.string().regex(/^[2-9]{4}-[2-9]{4}$/),
```

Linhas novas sem bloco, com o motivo de cada uma:

- `credencial-matricula.repository.ts`, `eq(usuario.escolaId, escolaId)` da seleção do aluno (a leitura sem trava e a trava): o `estadoDaProvisoria` do passo seguinte também filtra pela escola, e o aluno de outra escola responde 404 por ele. Com a conferência repetida na transação, nenhum caso fica vermelho só por esse filtro (a trava de uma linha alheia só duraria o instante da transação, sem vazar dado). O teste de isolamento prova o 404 igual e a credencial de B intacta. Fica pela regra 10, item 3.
- `credencial-matricula.repository.ts`, no `exists` do professor: `eq(doAluno.escolaId, escolaId)`, `eq(doAluno.papel, 'aluno')`, `eq(doProfessor.papel, 'professor')` e, no `innerJoin`, `eq(doProfessor.escolaId, doAluno.escolaId)` e `eq(doProfessor.anoLetivoId, doAluno.anoLetivoId)`: redundantes com a FK composta do `vínculo` (a escola) e com `eq(doAluno.anoLetivoId, anoLetivoId)` mais `eq(doProfessor.usuarioId, professorId)`, que têm bloco; o professor da sessão só tem vínculo de papel `professor`. Tirar um deles não muda nenhum resultado. Ficam por defesa em profundidade (regra 10, item 3). O que decide (`doProfessor.turmaId`, o aluno, o ano, os dois `confirmado`, o professor da sessão) tem bloco.
- `credencial-matricula.repository.ts`, o `escolaId` do `where` do `estadoDaProvisoria` da conta (o `usuarioId` já saiu de uma linha com escopo, e o id é UUID), o `?? false` do `recente` (só cobre o aluno sem credencial, que o `temCredencial` recusa), o `escolaId` do `where` de `gravarProvisoria` (`requireEscolaId()`, a mesma razão: o `usuarioId` vem da linha já conferida com escopo e o `unique (escola_id, usuario_id)` da tabela deixa uma linha só) e `gravada?.expiraEm == null` do `returning`.
- `senha-provisoria.service.ts`, `dependencias.sortear ?? randomInt` (o padrão de produção; o teste de unidade passa o sorteio), `if (gravada === undefined) throw naoEncontrado()` (inalcançável depois da conferência com a linha travada; só fecha o tipo), o `doSeguro ? insuranceLimit(...)` (o seguro em memória do `WindowCounter` tem os testes dele) e o `throw naoEncontrado()` de `alcanceDaGeracao` (a guarda de permissão já barrou os outros papéis).
- `senha-provisoria.controller.ts`, `@RequirePermissao('senha_provisoria', 'gerar')`: a matriz (`matriz.test.ts`), o `permissao-boot-check.test.ts` (toda rota tem a permissão declarada) e o `alcanceDaGeracao` do service (o aluno e a rede respondem 404, caso `o aluno e quem não está logado`) já o cobrem.
- `expurgo-da-escola.repository.ts`: a condição de vencimento repetida de propósito no `update` externo e no `select` interno (o bloco do corte tira as duas; cada uma sozinha é equivalente, como o docblock diz), e `resultado.rowCount ?? 0`.
- `credencial-matricula.ts` (schema), o `where` do índice parcial: o índice não muda resultado, só o plano; é o da leitura do expurgo, que começa pela escola (regra 80, item 8).

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | O `repository` derivar o `alcance` sozinho (`alcanceDe(requestSessao().papel, …)`) em vez de recebê-lo do service | `TODO.md`. Muda a assinatura de `travarAlunoParaProvisoria` e dos seus testes, o que é contrato do repository; hoje o service já o tira do token pela matriz (`alcanceDaGeracao`) e o tenancy-guardian aprovou. Cabe uma tarefa própria, junto do "ligar" da 15.0, que usa a mesma trava |
| privacy-guardian (1ª) | A spec não deve pousar sem a 11.0 (o arquivo do titular do aluno só traz `senha_provisoria.gerada` pela leitura por alvo) | Já é a tarefa 11.0 (`11_task.md`, subtarefa 11.2); o Validador confere no fim da spec |
| privacy-guardian (1ª) | A exclusão `t.acao <> 'senha_provisoria.gerada'` (`leitura-do-titular.ts:413`) tira do arquivo do professor o próprio ato dele, não só o id do aluno; alternativa: manter a linha com `entidade_id` nulo | Divergência já registrada em "Divergências resolvidas" e na Tech Spec §5; levar à validação (Validador). Mudar isso é decisão de arquivo do titular (regra 20, item 19), não detalhe da 9.0 |
| privacy-guardian (1ª) | `provisoria_expira_em` fora do arquivo do aluno (`leitura-do-titular.ts:122`) | Tarefa 11.0, subtarefa 11.2 (a leitura por alvo do aluno) |
| infra-guardian (1ª) | Rótulo `resultado` (gerada, conflito, limite, indisponivel) na métrica `senha_provisoria.gerada` | `TODO.md`. Muda o contrato da métrica (nome de série, painel e `metricas.int.test.ts`); com o item 1 o 503 deixa de gastar cota, e a rajada continua visível no histograma HTTP |
| infra-guardian (1ª) | Limite de linhas por noite em `anularProvisoriasVencidas`, com o `lote` dos irmãos | `TODO.md`. Muda comportamento do expurgo; o volume é uma linha por aluno com provisória vencida, e o `skip locked` já isola as escolas |
| infra-guardian (1ª) | O cenário [C] da rajada incluir também a geração, não só o login com a provisória | Tarefa 10.0, subtarefa 10.4 (`infra/scripts/carga-login.ts`); o Arquiteto/Orquestrador acrescenta a linha ao `10_task.md`, que não é desta tarefa |
| revisor-geral (1ª) | O hash espera o semáforo com a transação aberta (`senha-provisoria.service.ts:83`) | Mesmo achado do item 1, que o atende |
| tenancy-guardian (2ª) | O docblock de `estadoDaProvisoria` (`credencial-matricula.repository.ts:138-143`) diz "o aluno que acabou de ser travado" e "Só chamar depois de `travarAlunoParaProvisoria`", e agora também é chamado depois de `alcancaAluno`, sem trava | `TODO.md` |
| tenancy-guardian (2ª) | O `repository` derivar o `alcance` do token | Já está na tabela da rodada 1 (`TODO.md`) |
| privacy-guardian (2ª) | Voltar as leituras do aluno (`/v1/eu`, `/v1/minha-turma`) ao teste da senha, com `200` | Recusada: a geração derruba as sessões do aluno, e essas leituras respondiam 401 e passavam no vazio (test-engineer, 1ª, item 4 da ordem anterior). O revisor-geral (2ª) confirmou a saída. A cobertura do que o aluno lê depois de entrar com a provisória é da 10.0 |
| privacy-guardian (2ª), infra-guardian (2ª), test-engineer (2ª) | A 10.0 normalizar o que o aluno digita (hífen, espaço, minúsculas) antes de conferir, e isso ficar escrito no `10_task.md` | Tarefa 10.0: o Arquiteto/Orquestrador escreve a linha no `10_task.md`, que não é desta tarefa |
| privacy-guardian (2ª) | Leitura por alvo do arquivo do titular e `provisoria_expira_em` no arquivo do aluno | Tarefa 11.0, subtarefa 11.2 (já na tabela da rodada 1) |
| infra-guardian (2ª) | O teste do 503 conferir também que o contador de quem gera (60 por hora) continua zerado, ou chegar ao 429 da hora depois das recusas | `TODO.md` |
| infra-guardian (2ª) | Ler as cotas sem gastar (um `GET` no contador) antes do hash, para o 429 não custar um hash de argon2 às 7h30 | `TODO.md`. Muda a ordem e o comportamento do 429 que a Tech Spec §5 descreve |
| revisor-geral (2ª) | O parâmetro booleano `travar` de `#conferir` (`senha-provisoria.service.ts:121`) escolhe entre dois métodos do repository; passar a função de alcance, ou dois chamadores explícitos | `TODO.md` |
| revisor-geral (2ª) | `ENTRA_PELA_CONTA_DA_ESCOLA` mudou de lugar em `messages.ts` "sem motivo" | Mantida: o motivo é a ordem de `error-code.ts`, onde `VERIFICACAO_PENDENTE` vem antes (recomendação do revisor-geral, 1ª, item 12 da ordem anterior) |
| revisor-geral (2ª) | As linhas de destino `TODO.md` desta tabela não estão no `TODO.md` | As linhas dos destinos `TODO.md` das duas ordens entram no `TODO.md` no commit da tarefa (`task-template.md`, "Recomendações sem aplicar"). Quem as escreve é o Implementador, depois das rodadas |
| test-engineer (3ª), revisor-geral (3ª) | O caso "o hash espera o semáforo fora da transação, com a linha do aluno destravada" prova que a linha está livre (`for no key update nowait`), não que nenhuma conexão do pool está presa: uma transação aberta sem trava antes do hash passaria. Cobrir contando, dentro do espião, as conexões da API em `idle in transaction` em `pg_stat_activity` | `TODO.md`. Hoje a única trava da transação curta é a do `travarAlunoParaProvisoria`, e a mutação registrada (o hash dentro da transação, depois da trava) fica vermelha. Mexer no teste de novo caducaria os outros revisores |
| test-engineer (3ª) | O docblock de `estadoDaProvisoria` (`credencial-matricula.repository.ts:138-143`) diz que só se chama depois da trava | Já está na tabela da rodada 2 (`TODO.md`) |
## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-08 09:08:52 | 2026-11-08 09:09:36 | `conformidade-reviewer` | 1 | APROVADO | a20f688e3900e5d7f |
| 2026-11-08 09:08:30 | 2026-11-08 09:09:39 | `tenancy-guardian` | 1 | APROVADO | a0ea61119400b8a43 |
| 2026-11-08 09:08:35 | 2026-11-08 09:10:14 | `privacy-guardian` | 1 | APROVADO | ac160bd7c6059d9e5 |
| 2026-11-08 09:08:48 | 2026-11-08 09:10:55 | `revisor-geral` | 1 | REPROVADO | ad1f57419e52d17c8 |
| 2026-11-08 09:08:39 | 2026-11-08 09:11:37 | `infra-guardian` | 1 | REPROVADO | aee5e8489e53917d6 |
| 2026-11-08 09:08:44 | 2026-11-08 09:11:54 | `test-engineer` | 1 | REPROVADO | a4c53b88179e8b03a |
| 2026-11-08 10:25:40 | 2026-11-08 10:26:04 | `conformidade-reviewer` | 2 | APROVADO | a29d232e58c06f9f5 |
| 2026-11-08 10:25:25 | 2026-11-08 10:26:08 | `tenancy-guardian` | 2 | APROVADO | a96a68d1280c6ae91 |
| 2026-11-08 10:25:33 | 2026-11-08 10:26:08 | `privacy-guardian` | 2 | APROVADO | af22845d4b9343293 |
| 2026-11-08 10:25:48 | 2026-11-08 10:26:37 | `infra-guardian` | 2 | APROVADO | acccdb6c78f7b7225 |
| 2026-11-08 10:26:10 | 2026-11-08 10:27:26 | `revisor-geral` | 2 | APROVADO | a6c522207f4a1f1a6 |
| 2026-11-08 10:26:02 | 2026-11-08 10:28:04 | `test-engineer` | 2 | REPROVADO | a21bfc382bedf27d6 |
| 2026-11-08 10:55:51 | 2026-11-08 10:56:26 | `revisor-geral` | 3 | APROVADO | a1189041a413ade82 |
| 2026-11-08 10:55:44 | 2026-11-08 10:56:51 | `test-engineer` | 3 | APROVADO | a1238de0995cc55b7 |
