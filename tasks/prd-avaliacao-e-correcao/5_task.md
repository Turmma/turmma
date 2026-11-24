# Tarefa 5.0 — O professor estende o tempo e acompanha quem está fazendo

**Funcionalidade:** avaliacao-e-correcao · **Depende de:** 2.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `test-engineer`, `revisor-geral`, `conformidade-reviewer`
**Porte:** grande

## Objetivo

O professor estende o tempo de um aluno ou da turma, inclusive além da janela, com dois cliques valendo uma extensão, e
lê por aluno quem não começou, quem está fazendo e até quando, e quem enviou.

## Contexto necessário

- `techspec.md` §4 (`extensoes`, `acompanhamento`), §5.1, §5.4, §5.6 (`estender` toma a aplicação `for share`), §6, §7
- `prd.md` RF4
- `cenarios.md` §1 RF4, §1b (as linhas do professor), §3 (d)
- `revisao-spec.md`: o acompanhamento numa consulta só, sem chamar `limiteDaTentativa` 35 vezes a cada 15 s
- `apps/api/src/atividade/atividade-aplicada/` e a `limiteDaTentativa` da 2.0

## Subtarefas

- [x] 5.1 — `POST …/:id/extensoes`: `for share` na aplicação, aberta; aluno da turma; minutos de 1 a 120; chave única por
  aplicação (o 23505 devolve o gravado); auditoria `atividade.tempo_estendido` sem minutos por aluno
- [x] 5.2 — `GET …/:id/acompanhamento`: por aluno, id, nome, situação e `limiteEm`, **sem saídas**, numa consulta
- [x] 5.3 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.controller.ts` | alterado |
| `apps/api/src/atividade/atividade-aplicada/extensao.service.ts` | novo |
| `apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts` | novo |
| `apps/api/src/atividade/atividade.module.ts` | alterado |
| `apps/api/src/atividade/extensao.int.test.ts` | novo |
| `packages/core/src/auditoria/acoes.ts` | alterado (a ação `atividade.tempo_estendido`, só com o escopo) |
| `packages/core/src/auditoria/acoes.test.ts` | alterado |
| `apps/api/test/contracts.test.ts` | alterado (o contrato do acompanhamento, sem saídas) |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| Estender 10 min só para A | integração | o `limiteEm` do acompanhamento de A anda 10 min e o de B, não; o PUT que grava ou recusa é da 3.0 (divergência registrada) | dois alunos | `extensao.int.test.ts › 10 min só para a Ana` |
| Estender a turma | integração | todos andam; o aluno sem tentativa, que começa depois, tem `limiteEm` = `fecha_em` + extensão; a linha gravada é a da turma (aluno nulo). O fim efetivo da janela é da rotina (6.0) | o aluno sem tentativa começa depois | `extensao.int.test.ts › a turma toda: todos andam` |
| 0 e 121 minutos; prova encerrada | integração | `ENTRADA_INVALIDA`, também com a chave a mais (`motivo`); `ATIVIDADE_ENCERRADA` sem linha | 1 e 120 passam | `extensao.int.test.ts › 0 e 121 minutos` |
| Aluno de outra turma, de outra escola, inexistente | integração | a mesma resposta, nada gravado, nenhuma auditoria; também o pendente e o desativado | cinco ids | `extensao.int.test.ts › o aluno de outra turma, de outra escola, o inexistente` |
| Mesma chave em outra aplicação | integração | outra extensão; na mesma aplicação, a mesma chave devolve o gravado, sem outra linha nem outra auditoria; a chave nova grava outra | a chave é por aplicação | `extensao.int.test.ts › a mesma chave de novo devolve o gravado` |
| Corrida (d) | integração | uma linha, um limite, uma auditoria; a segunda devolve o gravado; chave nova grava outra | a primeira segurada com `WriteBlockTrigger` | `extensao.int.test.ts › estender × estender` |
| Acompanhamento | integração | as quatro situações, com `limiteEm` com extensão e indisponibilidade (a de antes de começar não conta); tentativa sem limite; só os alunos da turma, na ordem do nome; a prova encerrada (`enviou`, `tempo_esgotado`, `envio = 'limite'`); a turma de alunos desativados devolve a lista vazia | um aluno em cada, e a Ana com tentativa enviada em outra prova | `extensao.int.test.ts › quem não começou, quem faz`; `› a prova encerrada pelo professor`; `› a turma cujo único aluno foi desativado` |
| Acompanhamento sem saídas | unidade | o contrato não tem `saidas` nem percentual, e o aluno é estrito | `apps/api/test/contracts.test.ts` | `contracts.test.ts › avaliacao-e-correcao 5.0` |
| Auditoria | integração | sem minutos nem percentual por aluno | 17 min a um aluno: nem `17` nem `alunoId` no detalhe; a da turma, nem `23` | `extensao.int.test.ts › a auditoria diz só o escopo`; `acoes.test.ts › avaliacao-e-correcao 5.0` |
| Estender × encerrar | integração | o encerrar segurado; a extensão espera e recebe `ATIVIDADE_ENCERRADA`, sem linha; e a extensão numa prova não espera o encerramento de outra | sem `for share`, grava; com a trava sem o id, espera a vizinha | `extensao.int.test.ts › estender × encerrar`; `› estender numa prova não espera o encerramento de outra` |
| Repository do acompanhamento e da extensão chamado direto: contexto da A com ids da B; ano anterior | integração | vazio (e a gravação com a escola ou o ano trocados não passa pela FK); no contexto da dona, acha | sem passar pela rota; o professor da A com a escola da B no contexto | `extensao.int.test.ts › nos repositories, o id certo` |
| Professor de B, sem vínculo, outra disciplina; vínculo encerrado em X e aberto em Y; aluno e coordenação | integração | `NAO_ENCONTRADO` igual ao do inexistente, nas duas rotas, nada gravado | ids da B no contexto da A | `extensao.int.test.ts › estender e acompanhar, por quem não é o professor` |
| Aluno transferido (vínculo `encerrado`), dois alunos com o mesmo nome, a mesma `chave` com outro corpo | integração | o transferido é `ENTRADA_INVALIDA` ao estender e não está no acompanhamento, mesmo com tentativa em andamento; os gêmeos saem na ordem do id, a mesma a cada leitura; a mesma `chave` com outro aluno e outros minutos devolve o gravado (200), sem linha nem auditoria nova | seis ids; três leituras seguidas | `extensao.int.test.ts › o aluno de outra turma, de outra escola, o inexistente`; `› quem não começou, quem faz`; `› dois alunos com o mesmo nome`; `› a mesma chave de novo devolve o gravado` |
| Escola sem ano em curso | integração | `NAO_ENCONTRADO` no `:id` | | `extensao.int.test.ts › a escola sem ano em curso` |
| Consulta do acompanhamento | integração | `EXPLAIN` pelos índices; uma ida ao banco para a lista inteira; as extensões e as quedas só da aplicação; o pulso, e nulo sem a linha | o `.toSQL()` do repository; a outra prova da turma criada antes, com tentativa dos mesmos alunos | `extensao.int.test.ts › o `EXPLAIN` da consulta`; `› lê numa consulta só`; `› sem a linha do pulso` |
| Cabeçalho e id malformado | integração | `no-store` nas duas rotas; o id que não é uuid responde como o inexistente | | `extensao.int.test.ts › não se guardam em cache` |

## Como testar

- Isolamento: `apps/api/src/atividade/atividade-isolamento.int.test.ts › encerrar, ler a correção, abrir destaque e
  aprovar o lote, por quem não é a professora…`
- Idempotência por chave: `apps/api/test/painel-escrita.int.test.ts › E2: o mesmo pedido duas vezes, ao mesmo tempo…`
- `EXPLAIN`: `apps/api/test/semana-itens.int.test.ts` (`consultasDosItens`)
- `npx vitest run --project integracao apps/api/src/atividade/extensao.int.test.ts`

## Autoconferência

As doze perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas antes de codar.

1. **Mutação de cada cláusula:** a seção "Mutações" tem um bloco por cláusula do diff (escopo do alcance, as junções do acompanhamento, as ramificações da situação, a trava `for share`, o `on conflict`, a auditoria) e o motivo das que são equivalentes. As cláusulas que o `--faltando` não vê (o ternário do limite, o `?? null`, a trava sem condição) entraram à mão.
2. **Texto na tela:** a tarefa não escreve texto de tela (a 11.0 é a tela).
3. **O que distingue:** a Ana tem tentativa enviada em **outra** prova da turma, criada antes (a junção sem a aplicação a leria); o aluno desativado, o pendente e o do 2ºC estão na turma; a extensão da outra prova tem 9 min e a desta, 5; a queda de antes de começar fica de fora do limite; o repository é chamado com a escola da B e a professora da A (a cláusula da escola sozinha a separa do vínculo).
4. **Checagem anterior que responde antes:** o ano em curso (`requireAnoEmCurso`) e o vínculo respondem `NAO_ENCONTRADO` antes do resto, por isso as recusas de `ENTRADA_INVALIDA` e `ATIVIDADE_ENCERRADA` são provadas com a professora da turma certa. O pulso da API de teste não bate: o teste o deixa fresco antes de cada leitura, senão o limite contaria a lacuna aberta desde o último pulso (o primeiro vermelho desta tarefa).
5. **A asserção olha o resultado:** o limite se compara com o `limite_base_em` lido do banco, em milissegundos, e a lista pelo contrato (`acompanhamentoResponseSchema`); a ausência de `17`, do aluno e de `minutos` na auditoria é lida do detalhe gravado; o `EXPLAIN` roda o `.toSQL()` do repository.
6. **Guarda nova:** nenhuma.
7. **Comentário que afirma o que o código não faz:** conferido nos três arquivos novos; o aviso de "mesma chave devolve o gravado" vale para o `on conflict do nothing`, que é como o 23505 da Tech Spec é tratado aqui (a segunda inserção espera a primeira e não falha).
8. **Divergência:** as duas estão na tabela e na Tech Spec (§4) e no `cenarios.md` (RF4, linha 1); o PRD não diz o contrário (RF4 só pede "estende o tempo de um aluno ou da turma").
9. **Peça que já existe:** `alunosDaTurmaEntre` (confere o aluno da turma), `comVinculoConfirmadoDoProfessor` e `disciplinaDoArtefato` (o alcance), `limiteDaTentativa` (a 2.0), `AuditoriaRecorder`, `WriteBlockTrigger` e `esperarNaTrava`.
10. **Corridas:** (d) com a ordem forçada (a primeira parada no gatilho, a segunda na fila da trava, as duas esperadas por `esperarNaTrava(…, 2)`); estender × encerrar com o encerramento segurado; e a extensão numa prova que não espera o encerramento de outra. A corrida com a rotina (j) é da 6.0.
11. **Isolamento e coluna "Caso":** o caso do repository usa a escola da B e a professora da A, e o ano trocado com o vínculo dela no ano anterior; cada linha da tabela de testes tem o caso na última coluna.
12. **Guardiões:** `tenancy-guardian` (alcance, `for share`, FK composta), `privacy-guardian` (auditoria sem minutos nem aluno, DTO sem saídas), `infra-guardian` (consulta única, índices, `for share`); o `achados/indice.md` não trouxe nada de rodada anterior da 5.0.

## Fora do escopo desta tarefa

A tela (11.0); a corrida estender × rotina (6.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec |
|---|---|---|
| O PUT que devolve `TEMPO_ESGOTADO` é da 3.0, que corre em outra linha e não está nesta árvore: a linha "Estender 10 min só para A" prova o efeito pelo `limiteEm` do acompanhamento (a mesma `limiteDaTentativa` que o PUT lerá), e o `TEMPO_ESGOTADO` de B no PUT fica com a 3.0 | a 5.0 depende só da 2.0; sem o `comecar` e o PUT novo, a tentativa nasce por SQL | `cenarios.md` §1 RF4, linha "Estender 10 min só para A" |
| A regra de cada uma das quatro situações do acompanhamento, o `limiteEm` só em `fazendo`, o 200 também no pedido repetido e a auditoria `atividade.tempo_estendido` só com o escopo | a Tech Spec dava o nome das quatro situações e a lista dos campos, sem a regra de cada uma, e a auditoria sem o detalhe | `techspec.md` §4, parágrafo do acompanhamento; `cenarios.md` §1 RF4, linha "Acompanhamento" |

## Mutações

`--faltando`: 0 linhas (48 blocos, 10 motivos): `node tools/processo/mutacoes.ts --faltando` confere.

Cada bloco aplica a mutação, roda o caso citado (o `-t` do vitest é regex: nomes sem parênteses) e exige vermelho. Todos os casos de integração criam a própria escola, e por isso nenhum depende de outro ter rodado antes. Os casos de 'quem não começou, quem faz' e 'lê numa consulta só' criam **antes** uma outra prova da turma, com tentativa dos mesmos alunos: o que a junção ou o `where` deixasse passar da vizinha seria lido primeiro.

**Sem bloco, com o motivo (cláusula equivalente ou coberta por outra peça):**

- `eq(vinculo.escolaId, atividadeAplicada.escolaId)` e `eq(vinculo.anoLetivoId, atividadeAplicada.anoLetivoId)` na junção do vínculo: o vínculo é achado pela turma **da aplicação** (`eq(vinculo.turmaId, atividadeAplicada.turmaId)`, com bloco), e a turma é uuid, com FK composta para a escola e o ano; tirar um dos dois não muda nenhuma linha. Ficam por serem a cláusula de escopo da regra 10, item 3 (a escola e o ano do contexto estão no `where`, com bloco).
- `extensao_de_tempo.escola_id = atividade_aplicada.escola_id` na subconsulta das extensões: o `atividade_aplicada_id` (uuid) já amarra a mesma aplicação, e a FK composta da extensão obriga a escola dela a ser a da aplicação; tirar o termo não muda nenhuma linha. Fica por ser o escopo da regra 10, item 3, e abrir o índice pela escola.
- `eq(usuario.escolaId, vinculo.escolaId)` na junção do usuário: `usuario.id` é uuid, e o termo `eq(usuario.id, vinculo.usuarioId)` (com bloco) já amarra a mesma linha.
- `eq(tentativaAtividade.escolaId, atividadeAplicada.escolaId)` e `eq(tentativaAtividade.anoLetivoId, atividadeAplicada.anoLetivoId)`: a tentativa é achada pela aplicação (`eq(tentativaAtividade.atividadeAplicadaId, atividadeAplicada.id)`, com bloco), que é uuid com FK composta para a escola e o ano; o termo existe para o índice único (`tentativa_atividade_uma_por_aluno`), que começa por eles, e o `EXPLAIN` do teste o confere.
- `linha.alunoId === null` no `read`: o aluno nulo vem sempre com o nome nulo (a turma sem aluno devolve uma linha só, com os dois nulos), e `linha.nome === null` (com bloco) decide sozinho; o primeiro termo existe para o compilador estreitar o tipo.
- `? null` do ramo da tentativa ausente em `#read` (o `limite` do aluno que não começou): `situacaoDoAluno` devolve `nao_comecou` antes de olhar o limite, e o `limiteEm` só sai em `fazendo`; o ramo só evita ler uma tentativa que não existe, e o resultado é o mesmo com qualquer valor. O outro ramo (`limiteDaTentativa`) tem bloco.
- `z.strictObject` → `z.object` em `atividade.tempo_estendido` (`acoes.ts`): o mapa se valida ao carregar (`exigirMapaDeAcoesValido`, `InvalidAuditoriaMapError`), e o objeto que não é estrito derruba o módulo inteiro, erro de carga que o portão recusa como prova de cláusula. A cláusula tem a guarda estrutural no carregamento e o caso (`os minutos não entram`, `o aluno não entra`) no `acoes.test.ts`; o bloco do enum prova a lista de escopos.
- `@RequirePermissao('atividade_aplicada', 'estender')` e `'acompanhar'`: tirá-los derruba o boot da API (`PermissaoBootCheck` recusa rota sem permissão, `apps/api/test/permissao-boot-check.test.ts`), não um caso; o mutante cai em erro de carga, que o portão recusa.
- `@Body(new ZodValidationPipe(estenderTempoRequestSchema))`: o contrato é da 1.0, com os casos dele em `packages/shared`; aqui o caso `0 e 121 minutos` o exerce pela rota (e os blocos de `situacao` e de escopo não dependem dele).
- `AcompanhamentoRepository` e `ExtensaoRepository`, `constructor(private readonly banco …)` e as injeções do módulo (`inject: [DB]`): fiação sem condição; sem o banco, nenhum caso roda (erro de carga).

### Alcance do professor (as três cláusulas, as duas leituras e a trava)

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › nos repositories, o id certo
falha: toBeUndefined()
 return and(
-eq(atividadeAplicada.escolaId, requireEscolaId()),
 eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()),
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › nos repositories, o id certo
falha: toBeUndefined()
 eq(atividadeAplicada.escolaId, requireEscolaId()),
-eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()),
 comVinculoConfirmadoDoProfessor(banco, atividadeAplicada, disciplinaDoArtefato(banco, atividadeAplicada)),
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › estender e acompanhar, por quem não é o professor
 eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()),
-comVinculoConfirmadoDoProfessor(banco, atividadeAplicada, disciplinaDoArtefato(banco, atividadeAplicada)),
 )
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › estender e acompanhar, por quem não é o professor
 eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()),
-comVinculoConfirmadoDoProfessor(banco, atividadeAplicada, disciplinaDoArtefato(banco, atividadeAplicada)),
+comVinculoConfirmadoDoProfessor(banco, atividadeAplicada, sql`"vinculo"."disciplina_id"`),
 )
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › estender e acompanhar, por quem não é o professor
-.where(and(noAlcanceDoProfessor(this.banco), eq(atividadeAplicada.id, atividadeAplicadaId)))
+.where(and(eq(atividadeAplicada.id, atividadeAplicadaId)))
 .orderBy(asc(usuario.nome), asc(vinculo.usuarioId))
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › quem não começou, quem faz
-.where(and(noAlcanceDoProfessor(this.banco), eq(atividadeAplicada.id, atividadeAplicadaId)))
+.where(and(noAlcanceDoProfessor(this.banco)))
 .orderBy(asc(usuario.nome), asc(vinculo.usuarioId))
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › estender e acompanhar, por quem não é o professor
-.where(and(noAlcanceDoProfessor(this.banco), eq(atividadeAplicada.id, atividadeAplicadaId)))
+.where(and(eq(atividadeAplicada.id, atividadeAplicadaId)))
 .for('share', { of: atividadeAplicada })
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › estender numa prova não espera o encerramento de outra
falha: toEqual([200, 200])
-.where(and(noAlcanceDoProfessor(this.banco), eq(atividadeAplicada.id, atividadeAplicadaId)))
+.where(and(noAlcanceDoProfessor(this.banco)))
 .for('share', { of: atividadeAplicada })
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › estender e acompanhar, por quem não é o professor
 const [primeira] = linhas
-if (primeira === undefined) return undefined
+if (primeira === undefined) return { atividadeAplicadaId, estado: 'aberta', agora: new Date(), alunos: [] }
 const alunos: AlunoDoAcompanhamento[] = []
```

### A consulta: as junções, as leituras e o pulso

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › quem não começou, quem faz
 eq(vinculo.anoLetivoId, atividadeAplicada.anoLetivoId),
-eq(vinculo.turmaId, atividadeAplicada.turmaId),
 eq(vinculo.papel, 'aluno'),
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › quem não começou, quem faz
 eq(vinculo.turmaId, atividadeAplicada.turmaId),
-eq(vinculo.papel, 'aluno'),
 eq(vinculo.estado, 'confirmado'),
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › quem não começou, quem faz
 eq(vinculo.papel, 'aluno'),
-eq(vinculo.estado, 'confirmado'),
 ),
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › quem não começou, quem faz
-.leftJoin(usuario, and(eq(usuario.escolaId, vinculo.escolaId), eq(usuario.id, vinculo.usuarioId), isNull(usuario.desativadoEm)))
+.leftJoin(usuario, and(eq(usuario.escolaId, vinculo.escolaId), isNull(usuario.desativadoEm)))
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › quem não começou, quem faz
-.leftJoin(usuario, and(eq(usuario.escolaId, vinculo.escolaId), eq(usuario.id, vinculo.usuarioId), isNull(usuario.desativadoEm)))
+.leftJoin(usuario, and(eq(usuario.escolaId, vinculo.escolaId), eq(usuario.id, vinculo.usuarioId)))
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › quem não começou, quem faz
 eq(tentativaAtividade.anoLetivoId, atividadeAplicada.anoLetivoId),
-eq(tentativaAtividade.atividadeAplicadaId, atividadeAplicada.id),
 eq(tentativaAtividade.alunoId, vinculo.usuarioId),
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › quem não começou, quem faz
 eq(tentativaAtividade.atividadeAplicadaId, atividadeAplicada.id),
-eq(tentativaAtividade.alunoId, vinculo.usuarioId),
 ),
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › lê numa consulta só
falha: not.toBeNull()
-ultimoPulso: sql`(select ${pulsoDaApi.ultimoEm} from ${pulsoDaApi} limit 1)`.mapWith(pulsoDaApi.ultimoEm),
+ultimoPulso: sql`(select ${pulsoDaApi.ultimoEm} from ${pulsoDaApi} where false limit 1)`.mapWith(pulsoDaApi.ultimoEm),
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › quem não começou, quem faz
-if (linha.alunoId === null || linha.nome === null) continue
+if (linha.alunoId === null) continue
 alunos.push({
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › quem não começou, quem faz
-tentativa: linha.iniciadaEm === null ? null : { iniciadaEm: linha.iniciadaEm, enviadaEm: linha.enviadaEm, envio: linha.envio, limiteBase: linha.limiteBase },
+tentativa: null,
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › lê numa consulta só
falha: not.toBeNull()
-pulso: linha.ultimoPulso === null ? null : { ultimoEm: linha.ultimoPulso, agora: linha.agora },
+pulso: null,
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › sem a linha do pulso
-pulso: linha.ultimoPulso === null ? null : { ultimoEm: linha.ultimoPulso, agora: linha.agora },
+pulso: linha.ultimoPulso === null ? { ultimoEm: new Date(0), agora: linha.agora } : { ultimoEm: linha.ultimoPulso, agora: linha.agora },
```

### A extensão: a trava, a chave e o autor

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › estender × encerrar
falha: esperarNaTrava(bancada.pool, '%atividade_aplicada%for share%')
 .where(and(noAlcanceDoProfessor(this.banco), eq(atividadeAplicada.id, atividadeAplicadaId)))
-.for('share', { of: atividadeAplicada })
 return linha
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › a turma toda: todos andam
-alunoId: extensao.alunoId?.toLowerCase() ?? null,
+alunoId: extensao.alunoId?.toLowerCase() ?? '00000000-0000-0000-0000-000000000000',
 minutos: extensao.minutos,
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › estender × estender
-.onConflictDoNothing({ target: [extensaoDeTempo.escolaId, extensaoDeTempo.atividadeAplicadaId, extensaoDeTempo.chave] })
 .returning({ id: extensaoDeTempo.id })
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › a mesma chave de novo devolve o gravado
-return gravadas.length > 0
+return true
```

### O serviço: as recusas, a auditoria e a situação

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/extensao.service.ts
teste: apps/api/src/atividade/extensao.int.test.ts › 10 min só para a Ana
-if (travada === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+if (travada !== undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
 if (travada.estado !== 'aberta') throw new DomainException(ErrorCode.ATIVIDADE_ENCERRADA)
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/extensao.service.ts
teste: apps/api/src/atividade/extensao.int.test.ts › 0 e 121 minutos
-if (travada.estado !== 'aberta') throw new DomainException(ErrorCode.ATIVIDADE_ENCERRADA)
+if (travada.estado === 'aberta') throw new DomainException(ErrorCode.ATIVIDADE_ENCERRADA)
 if (pedido.alunoId !== undefined) {
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/extensao.service.ts
teste: apps/api/src/atividade/extensao.int.test.ts › o aluno de outra turma, de outra escola, o inexistente
-if (pedido.alunoId !== undefined) {
+if (false) {
 const daTurma = await new AtividadeAplicadaRepository(tx).alunosDaTurmaEntre(travada.turmaId, [pedido.alunoId.toLowerCase()])
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/extensao.service.ts
teste: apps/api/src/atividade/extensao.int.test.ts › o aluno de outra turma, de outra escola, o inexistente
 const daTurma = await new AtividadeAplicadaRepository(tx).alunosDaTurmaEntre(travada.turmaId, [pedido.alunoId.toLowerCase()])
-if (!daTurma.has(pedido.alunoId.toLowerCase())) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
 }
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/extensao.service.ts
teste: apps/api/src/atividade/extensao.int.test.ts › a mesma chave de novo devolve o gravado
-if (gravou) await registro.save(tx, 'atividade.tempo_estendido', { entidadeId: atividadeAplicadaId, depois: { escopo: pedido.alunoId === undefined ? 'turma' : 'aluno' } })
+await registro.save(tx, 'atividade.tempo_estendido', { entidadeId: atividadeAplicadaId, depois: { escopo: pedido.alunoId === undefined ? 'turma' : 'aluno' } })
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/extensao.service.ts
teste: apps/api/src/atividade/extensao.int.test.ts › a auditoria diz só o escopo
-if (gravou) await registro.save(tx, 'atividade.tempo_estendido', { entidadeId: atividadeAplicadaId, depois: { escopo: pedido.alunoId === undefined ? 'turma' : 'aluno' } })
+if (gravou) await registro.save(tx, 'atividade.tempo_estendido', { entidadeId: atividadeAplicadaId, depois: { escopo: pedido.alunoId === undefined ? 'aluno' : 'turma' } })
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/extensao.service.ts
teste: apps/api/src/atividade/extensao.int.test.ts › 10 min só para a Ana
-if (leitura === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+if (leitura !== undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
 const alunos = leitura.alunos.map((aluno) => {
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/extensao.service.ts
teste: apps/api/src/atividade/extensao.int.test.ts › 10 min só para a Ana
 aluno.tentativa === null
 ? null
-: limiteDaTentativa({ alunoId: aluno.alunoId, iniciadaEm: aluno.tentativa.iniciadaEm, limiteBase: aluno.tentativa.limiteBase, extensoes: aluno.extensoes, indisponibilidades: aluno.indisponibilidades, pulso: aluno.pulso })
+: null
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/extensao.service.ts
teste: apps/api/src/atividade/extensao.int.test.ts › quem não começou, quem faz
-return { alunoId: aluno.alunoId, nome: aluno.nome, situacao, limiteEm: situacao === 'fazendo' ? (limite?.toISOString() ?? null) : null }
+return { alunoId: aluno.alunoId, nome: aluno.nome, situacao, limiteEm: limite?.toISOString() ?? null }
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/extensao.service.ts
teste: apps/api/src/atividade/extensao.int.test.ts › a prova encerrada pelo professor
-return { alunoId: aluno.alunoId, nome: aluno.nome, situacao, limiteEm: situacao === 'fazendo' ? (limite?.toISOString() ?? null) : null }
+return { alunoId: aluno.alunoId, nome: aluno.nome, situacao, limiteEm: limite?.toISOString() ?? null }
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/extensao.service.ts
teste: apps/api/src/atividade/extensao.int.test.ts › quem não começou, quem faz
-return { alunoId: aluno.alunoId, nome: aluno.nome, situacao, limiteEm: situacao === 'fazendo' ? (limite?.toISOString() ?? null) : null }
+return { alunoId: aluno.alunoId, nome: aluno.nome, situacao, limiteEm: situacao === 'fazendo' ? (limite?.toISOString() ?? '1970-01-01T00:00:00.000Z') : null }
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/extensao.service.ts
teste: apps/api/src/atividade/extensao.int.test.ts › quem não começou, quem faz
-if (tentativa === null) return 'nao_comecou'
+if (tentativa === null) return 'fazendo'
 if (tentativa.enviadaEm !== null) return tentativa.envio === 'limite' ? 'tempo_esgotado' : 'enviou'
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/extensao.service.ts
teste: apps/api/src/atividade/extensao.int.test.ts › quem não começou, quem faz
 if (tentativa === null) return 'nao_comecou'
-if (tentativa.enviadaEm !== null) return tentativa.envio === 'limite' ? 'tempo_esgotado' : 'enviou'
+if (tentativa.enviadaEm === null) return tentativa.envio === 'limite' ? 'tempo_esgotado' : 'enviou'
 if (limite !== null && leitura.agora.getTime() > limite.getTime()) return 'tempo_esgotado'
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/extensao.service.ts
teste: apps/api/src/atividade/extensao.int.test.ts › a prova encerrada pelo professor
-if (tentativa.enviadaEm !== null) return tentativa.envio === 'limite' ? 'tempo_esgotado' : 'enviou'
+if (tentativa.enviadaEm !== null) return 'enviou'
 if (limite !== null && leitura.agora.getTime() > limite.getTime()) return 'tempo_esgotado'
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/extensao.service.ts
teste: apps/api/src/atividade/extensao.int.test.ts › quem não começou, quem faz
-if (limite !== null && leitura.agora.getTime() > limite.getTime()) return 'tempo_esgotado'
+if (limite === null || leitura.agora.getTime() > limite.getTime()) return 'tempo_esgotado'
 return leitura.estado === 'encerrada' ? 'enviou' : 'fazendo'
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/extensao.service.ts
teste: apps/api/src/atividade/extensao.int.test.ts › quem não começou, quem faz
-if (limite !== null && leitura.agora.getTime() > limite.getTime()) return 'tempo_esgotado'
+if (limite !== null && leitura.agora.getTime() < limite.getTime()) return 'tempo_esgotado'
 return leitura.estado === 'encerrada' ? 'enviou' : 'fazendo'
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/extensao.service.ts
teste: apps/api/src/atividade/extensao.int.test.ts › a prova encerrada pelo professor
-return leitura.estado === 'encerrada' ? 'enviou' : 'fazendo'
+return 'fazendo'
 }
```

### As rotas

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.controller.ts
teste: apps/api/src/atividade/extensao.int.test.ts › não se guardam em cache
 @RequirePermissao('atividade_aplicada', 'estender')
-@HttpCode(HttpStatus.OK)
 @Header('Cache-Control', 'no-store')
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.controller.ts
teste: apps/api/src/atividade/extensao.int.test.ts › não se guardam em cache
 @HttpCode(HttpStatus.OK)
-@Header('Cache-Control', 'no-store')
 estender(@Param('id', IdPipe) atividadeAplicadaId: string, @Body(new ZodValidationPipe(estenderTempoRequestSchema)) pedido: EstenderTempoRequest): Promise<AcompanhamentoResponse> {
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.controller.ts
teste: apps/api/src/atividade/extensao.int.test.ts › não se guardam em cache
 @RequirePermissao('atividade_aplicada', 'acompanhar')
-@Header('Cache-Control', 'no-store')
 acompanhar(@Param('id', IdPipe) atividadeAplicadaId: string): Promise<AcompanhamentoResponse> {
```

```mutacao
arquivo: packages/core/src/auditoria/acoes.ts
teste: packages/core/src/auditoria/acoes.test.ts › avaliacao-e-correcao 5.0
falha: safeParse({ escopo }).success, escopo
-depois: z.strictObject({ escopo: z.enum(['aluno', 'turma']) }),
+depois: z.strictObject({ escopo: z.enum(['aluno']) }),
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › lê numa consulta só
-extensoes: sql<ExtensaoLida[]>`(select coalesce(jsonb_agg(jsonb_build_object('alunoId', ${extensaoDeTempo.alunoId}, 'minutos', ${extensaoDeTempo.minutos})), '[]'::jsonb) from ${extensaoDeTempo} where ${extensaoDeTempo.escolaId} = ${atividadeAplicada.escolaId} and ${extensaoDeTempo.atividadeAplicadaId} = ${atividadeAplicada.id})`,
+extensoes: sql<ExtensaoLida[]>`(select coalesce(jsonb_agg(jsonb_build_object('alunoId', ${extensaoDeTempo.alunoId}, 'minutos', ${extensaoDeTempo.minutos})), '[]'::jsonb) from ${extensaoDeTempo} where ${extensaoDeTempo.escolaId} = ${atividadeAplicada.escolaId})`,
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts
teste: apps/api/src/atividade/extensao.int.test.ts › lê numa consulta só
-indisponibilidades: sql<IndisponibilidadeLida[]>`(select coalesce(jsonb_agg(jsonb_build_object('inicio', i.inicio, 'fim', i.fim)), '[]'::jsonb) from indisponibilidade i where i.fim > ${tentativaAtividade.iniciadaEm})`,
+indisponibilidades: sql<IndisponibilidadeLida[]>`(select coalesce(jsonb_agg(jsonb_build_object('inicio', i.inicio, 'fim', i.fim)), '[]'::jsonb) from indisponibilidade i)`,
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | Caso no repository com o contexto da A e uma aplicação criada na B | Recusada: a rota (`b.professora`, `extensao.int.test.ts`) e a FK composta já cobrem, como o próprio revisor diz |
| tenancy-guardian (1ª) | `extensao_de_tempo.concedidaPor` sem FK (escola, usuário) | `TODO.md`: é schema da 1.0, já pousado; o valor vem só da sessão |
| privacy-guardian (1ª) | A extensão da turma (aluno nulo) não entra no arquivo do titular de cada aluno (`leitura-do-titular.ts:345`) | `TODO.md`, para a validação e a retro; o arquivo do titular não é desta tarefa |
| privacy-guardian (1ª), infra-guardian (1ª) | A mesma `chave` com outro aluno ou outros minutos devolve em silêncio o gravado; recusar o corpo diferente | `TODO.md`, para o Arquiteto decidir: muda o contrato da Tech Spec §4 (200 no pedido repetido). O caso do item 10 fixa o de hoje |
| privacy-guardian (1ª) | A tela da 11.0 gera chave nova a cada abertura do diálogo | Tarefa 11.0: linha acrescentada ao "Contexto necessário" de `11_task.md` |
| conformidade-reviewer (1ª) | 11.0: o acompanhamento só mostra a situação e o "termina às", sem "parado há X min" (regra 70, item 7) | Tarefa 11.0: idem, em `11_task.md` |
| conformidade-reviewer (1ª) | 11.0: `tempo_esgotado` sem texto que sugira falta ou consequência | Tarefa 11.0: idem |
| conformidade-reviewer (1ª) | Escrever na AIA ou no dossiê que "quem deu tempo a quem" só se responde pela linha da extensão, e não pela auditoria | `TODO.md`: AIA e dossiê da avaliação online |
| infra-guardian (1ª) | Ler as extensões uma vez só (CTE ou `lateral`) em vez de uma subconsulta por aluno | `TODO.md`: cerca de 35 buscas por índice em tabela pequena; muda a consulta e os blocos de mutação, e o revisor aprovou |
| infra-guardian (1ª) | `clock_timestamp()` na releitura dentro da transação | `TODO.md`: o efeito é pequeno, segundo o revisor, e muda comportamento |
| revisor-geral (1ª) | `noAlcanceDoProfessor` é cópia de `AtividadeAplicadaRepository.#noAlcance`: exportar uma só | `TODO.md`: exige alterar `atividade-aplicada.repository.ts`, que não está nos "Arquivos previstos" |
| revisor-geral (1ª) | `ExtensaoRepository` em `extensao.repository.ts` próprio | `TODO.md`: moveria a classe e mudaria o `arquivo:` de vários blocos de "Mutações" e a tabela de arquivos previstos |
| test-engineer (1ª) | Fronteira do `>` do tempo esgotado, no instante exato do limite | Tarefa 3.0: o PUT é dela, e o `>` precisa concordar com ele |
| test-engineer (1ª) | A normalização para minúsculas do `alunoId` e da `chave` sem caso com UUID em maiúsculas | `TODO.md` |
| test-engineer (1ª) | Confirmar que a 6.0 cobre a extensão da turma no fim efetivo da janela | Tarefa 6.0: linha acrescentada ao "Contexto necessário" de `6_task.md` |
| test-engineer (1ª) | Duas extensões de chaves diferentes em paralelo | `TODO.md` |
| revisor-geral (2ª) | A `techspec.md` §4 ganhou duas frases que nenhuma linha do `cenarios.md` nomeia (a mesma `chave` com outro corpo devolve o gravado; o pedido repetido depois do encerramento recebe `ATIVIDADE_ENCERRADA`) e que a linha "A regra de cada uma das quatro situações…" de "Divergências resolvidas" não cita: acrescentá-las ao bloco RF4 do `cenarios.md` e à linha 95; a segunda não tem caso próprio | `TODO.md`: a segunda frase é a de comportamento sem caso; entra com a decisão do Arquiteto sobre a chave com outro corpo (item da rodada 1) |
| revisor-geral (2ª) | O comentário de `extensao.int.test.ts:84` aponta o `TODO.md` como "decisão do Arquiteto": quando ela vier, o caso e a frase da Tech Spec mudam juntos | `TODO.md`: o mesmo item da chave com outro corpo, da rodada 1 (a nota fica ali) |
| test-engineer (2ª) | O caso "dois alunos com o mesmo nome" não prova o desempate `asc(vinculo.usuarioId)`: os gêmeos nascem em sequência, e a ordem física já coincide com a do id; inverter a ordem física e acrescentar o bloco de mutação | `TODO.md`, para a validação: não há cláusula com condição |
| test-engineer (2ª) | Os casos de corrida com a vizinha e com o encerramento dependem do `statement_timeout` de 2 s da API; o comentário não diz quem derruba o encerramento | `TODO.md` |
| test-engineer (2ª) | No caso de outro corpo, conferir também que a Bia segue sem extensão | `TODO.md` |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-24 00:16:54 | 2026-11-24 00:17:50 | `tenancy-guardian` | 1 | APROVADO | a03c536e122d3861d |
| 2026-11-24 00:17:04 | 2026-11-24 00:17:54 | `conformidade-reviewer` | 1 | APROVADO | aeb4b83e12e6f48f7 |
| 2026-11-24 00:16:56 | 2026-11-24 00:18:17 | `privacy-guardian` | 1 | APROVADO | aec6a70074a7dc47b |
| 2026-11-24 00:17:02 | 2026-11-24 00:18:55 | `revisor-geral` | 1 | REPROVADO | ac64ea827bf5159dc |
| 2026-11-24 00:16:58 | 2026-11-24 00:19:00 | `infra-guardian` | 1 | APROVADO | a8d938ee7ae3520de |
| 2026-11-24 00:17:00 | 2026-11-24 00:22:36 | `test-engineer` | 1 | REPROVADO | ab0fdd7c3871d0b3f |
| 2026-11-24 01:38:22 | 2026-11-24 01:39:09 | `revisor-geral` | 2 | APROVADO | a2478405676f1fde9 |
| 2026-11-24 01:38:14 | 2026-11-24 01:41:46 | `test-engineer` | 2 | APROVADO | a5d67f41f6905c759 |
