# Tarefa 9.0 — Segunda chamada para quem não enviou, com lote próprio

**Funcionalidade:** avaliacao-e-correcao · **Depende de:** 5.0, 8.0
**Subagentes obrigatórios:** `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian`, `privacy-guardian`, `test-engineer`, `revisor-geral`
**Porte:** grande

## Objetivo

Com a prova original encerrada, o professor reabre para quem não a enviou, com janela nova; só o convocado vê e faz, e
as tentativas formam um lote próprio, sem mudar o da original.

## Contexto necessário

- `techspec.md` §3 (`segunda_chamada_de`, `convocado_da_segunda_chamada`, os índices), §4, §5.1, §5.9, §6
- `prd.md` RF10; §7 (aluno faltou)
- `cenarios.md` §1 RF10, §1b (convocado transferido), §3 (h)
- `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts`: as checagens do `aplicar` (objetiva, versão
  adaptada aprovada)

## Subtarefas

- [x] 9.1 — `POST …/:id/segunda-chamada`: original encerrada; alunos da turma atual sem tentativa enviada nem vencida;
  segunda chamada de segunda chamada recusada; as checagens do aplicar; janela, duração, tempo adicional que cabe;
  auditoria `atividade.segunda_chamada_aplicada`
- [x] 9.2 — `minhas-atividades` e o alcance da 3.0 pelos convocados
- [x] 9.3 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.controller.ts` | alterado |
| `apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts` | novo |
| `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts` | alterado |
| `apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts` | alterado |
| `apps/api/src/atividade/atividade.module.ts` | alterado |
| `apps/api/src/atividade/segunda-chamada.int.test.ts` | novo |
| `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts` | alterado (a conferência do artefato sai para uma função, que o aplicar e a segunda chamada usam) |
| `packages/core/src/auditoria/acoes.ts` e `acoes.test.ts` | alterados (a ação `atividade.segunda_chamada_aplicada`) |
| `apps/api/test/atividade.fixture.ts` | alterado (`segundaChamada` nas rotas da atividade) |
| `apps/api/src/atividade/prova-online-aluno.int.test.ts` | alterado (a espera do `for share` do `comecar` se acha pelo começo da consulta, que ficou maior) |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| Original aberta | integração | `ENTRADA_INVALIDA` | encerrada passa | `apps/api/src/atividade/segunda-chamada.int.test.ts › a original aberta é ENTRADA_INVALIDA`; a que não é avaliativa: `› a original que não é avaliativa` |
| Janela de 50 min, duração 40, convocado com +50% | integração | `ENTRADA_INVALIDA` | 60 min passa | `apps/api/src/atividade/segunda-chamada.int.test.ts › janela de 50 min com duração 40` |
| Aluno que enviou; que venceu sem enviar | integração | `ENTRADA_INVALIDA` | o que faltou passa | `apps/api/src/atividade/segunda-chamada.int.test.ts › quem enviou e quem venceu sem enviar` |
| Quem enviou uma segunda chamada, já encerrada, e é convocado de novo | integração | `ENTRADA_INVALIDA`, nada gravado | quem foi convocado e não enviou passa | `apps/api/src/atividade/segunda-chamada.int.test.ts › quem enviou uma segunda chamada, já encerrada` |
| Segunda chamada de segunda chamada | integração | `ENTRADA_INVALIDA` | | `apps/api/src/atividade/segunda-chamada.int.test.ts › segunda chamada de segunda chamada` |
| Artefato que não é objetiva; versão adaptada não aprovada | integração | as recusas do aplicar | | `apps/api/src/atividade/segunda-chamada.int.test.ts › artefato que deixou de ser objetiva`; no aplicar: `apps/api/src/atividade/atividade.int.test.ts › só atividade objetiva se aplica` |
| Aluno de outra turma, de outra escola, inexistente | integração | a mesma resposta, nada gravado | | `apps/api/src/atividade/segunda-chamada.int.test.ts › aluno de outra turma, de outra escola` |
| Convocado vê e começa | integração | aparece em `minhas-atividades` e `comecar` cria a tentativa | | `apps/api/src/atividade/segunda-chamada.int.test.ts › o convocado vê a segunda chamada na lista` |
| Não convocado | integração | não vê; `NAO_ENCONTRADO` em `comecar`, `prova`, `tempo`, PUT e saídas; fora da janela, nunca `PROVA_FORA_DA_JANELA` | o convocado recebe `PROVA_FORA_DA_JANELA` | `apps/api/src/atividade/segunda-chamada.int.test.ts › o não convocado não vê na lista` (a lista, `comecar`, `prova`, `tempo`, PUT, enviar, saída e diagnóstico, dentro e fora da janela) |
| Convocado transferido antes | integração | não começa | vínculo encerrado | `apps/api/src/atividade/segunda-chamada.int.test.ts › o convocado transferido antes` |
| Lote próprio com a original **aprovada** | integração | a segunda chamada encerra com lote pendente próprio; o da original não muda | | `apps/api/src/atividade/segunda-chamada.int.test.ts › com o lote da original aprovado` |
| Corrida (h) | integração | `CONFLITO` na segunda | `WriteBlockTrigger` na aplicação | `apps/api/src/atividade/segunda-chamada.int.test.ts › segunda chamada dupla`; a sequencial: `› a segunda aberta é CONFLITO` |
| Professor de B; sem vínculo; outra disciplina; vínculo encerrado em X; aluno pela matriz | integração | `NAO_ENCONTRADO` ou a matriz | ids da B no contexto da A; o repository de convocados vazio | `apps/api/src/atividade/segunda-chamada.int.test.ts › quem não é a professora daquela turma` (HTTP); `› nos repositories` (o repository, escola e ano trocados, e o do aluno com o colega não convocado); `› a escola sem ano em curso` |
| Auditoria | integração | sem percentual por aluno | | `apps/api/src/atividade/segunda-chamada.int.test.ts › leva a original, a turma e só as contagens`; o esquema: `packages/core/src/auditoria/acoes.test.ts › avaliacao-e-correcao 9.0` |

## Como testar

- Aplicar e encerrar: `aplicarAtividade`, `encerrarAtividade`, `aprovarOLote` (`apps/api/test/atividade.fixture.ts`)
- Recusas do aplicar: `apps/api/src/atividade/atividade.int.test.ts › a versão adaptada pendente e a rejeitada não
  chegam à turma…`
- `npx vitest run --project integracao apps/api/src/atividade/segunda-chamada.int.test.ts`

## Autoconferência

As doze perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas antes de codar e conferidas no fim.

1. **Mutação de cada cláusula:** um bloco por cláusula na seção "Mutações" (`--faltando` vazio): o alcance da original e os três termos da conferência (`encerrada`, `avaliativa`, `segunda_chamada_de`), os dois termos de quem pode ser convocado (da turma, não enviou), os cinco termos do `quemEnviou`, o que a segunda chamada grava (janela, duração, embaralhamento, `segunda_chamada_de`, convocados, tempo adicional, auditoria), a conferência do artefato (três termos) e, do aluno, o `or`, o `isNull`, o ramo `exists` e os dois termos de dentro. Sem bloco, com motivo: a FK composta da turma e do artefato, o termo da escola do `exists`, o `alvo === undefined` (o mesmo vínculo da original) e a barreira do banco da corrida (h).
2. **O texto na tela:** a tarefa não tem tela (a 11.0 é a do professor, a 12.0 a do aluno).
3. **O segundo dado que torna a cláusula observável:** Dani enviou a segunda chamada de **outra** prova (o termo da aplicação no `quemEnviou`); Edu é convocado de **outra** segunda chamada (o termo da aplicação do `exists`) e o colega Dani é o convocado da mesma (o termo do aluno); Bia sem envio e Caio vencido (o `enviada_em`); Ana e Caio na lista e Bia fora dela (o `inArray`); o aluno do 2ºC, o da B, o inexistente, o pendente, o desativado e o transferido (o termo da turma).
4. **Checagem anterior que responde antes:** a original é conferida (`estado`, `avaliativa`, `segunda_chamada_de`) antes de o artefato ser travado, e a conferência do artefato (`conferirArtefatoParaAplicar`) vem antes das dos alunos, e o caso do artefato usa um convocável (Dani), então o `ENTRADA_INVALIDA` dele não é o dos alunos; a original aberta, a que não é avaliativa e a segunda de segunda têm cada uma o caso com os outros dois termos verdadeiros. O `NAO_ENCONTRADO` de quem não é da turma vem do alcance (`originalDaSegundaChamada`), com a professora que passa por ele em outra turma: o caso do repository confere o alcance sem a conferência do artefato, que tem o mesmo escopo.
5. **A asserção olha o resultado:** o que o aluno recebe (a lista, a prova, a duração com o tempo adicional, o que se grava no banco) e as linhas gravadas por SQL; as ausências (`not.toContain`, contagem zero) vêm depois da resposta que poderia trazer o que elas negam (a lista do não convocado lida depois de a segunda chamada existir e de o convocado a ver).
6. **Guarda nova:** nenhuma regra de lint, teste estrutural nem trava de pasta; a ação de auditoria nova entra no esquema (`acoes.ts`) e no teste de `acoes.test.ts`.
7. **Comentários e docblocks:** conferidos contra o código ao fim: o do `SegundaChamadaService`, o de `originalDaSegundaChamada` (sem trava porque `encerrada` não volta a `aberta`), o de `quemEnviou` (o envio é o da original ou de qualquer segunda chamada dela; o encerramento grava `enviada_em` = limite na vencida; a cortada fica sem), o do alcance do aluno e o do `embaralhar` (o texto do teste da trava `for share` mudou com a consulta).
8. **Divergência:** duas linhas (a original avaliativa e o embaralhamento herdado), as duas já na `techspec.md` §5.9 e no `cenarios.md` §1 RF10; o `prd.md` RF10 não diz o contrário.
9. **Peça que já existe:** `artefatoParaAplicar`, `alunosDaTurmaEntre`, `create`, `saveTempoAdicional`, `porId` e `paraATela`, importados; a conferência do artefato saiu do `aplicar` para `conferirArtefatoParaAplicar`, e o `aplicar` a chama. Nada copiado.
10. **Em paralelo:** a corrida (h), com `WriteBlockTrigger` no `insert` da aplicação e `esperarNaTrava` na espera do artefato (a segunda chamada também trava o artefato `for update`, como o aplicar, e é nele que a segunda espera); o resultado é um 201, um `CONFLITO` e nada gravado da segunda. A barreira é o índice parcial da 1.0.
11. **Isolamento sem a cláusula:** o repository com a escola trocada, o ano trocado e a escola da B com a professora da A, no `originalDaSegundaChamada`, no `quemEnviou` e no `saveConvocados`; e o do aluno, com o colega não convocado, a escola trocada e o ano trocado. Cada linha da tabela de testes tem o caso na coluna "Caso".
12. **"O que verificar" dos guardiões:** `tenancy-guardian` (a seção acima e o item 11), `conformidade-reviewer` (a segunda chamada só cria aplicação e lote pendente; nenhuma nota, nenhuma saída de IA; a saída da aba não entra), `infra-guardian` (a ordem das travas é a do aplicar, o `for update` do artefato; o `for share` da aplicação do aluno segue; nenhuma consulta nova no caminho quente fora o `exists` por `escola_id` e `atividade_aplicada_id`, que a chave única `(escola_id, atividade_aplicada_id, aluno_id)` cobre). O `achados/indice.md` foi lido: a 5.0 e a 6.0 pediram a ordem forçada, a mutação por termo e o `EXPLAIN` por consulta nova (ver "Recomendações").

## Fora do escopo desta tarefa

A tela (11.0); a trava do Tutor do convocado (7.0); o encerramento sozinho (6.0, sem mudança).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec |
|---|---|---|
| A original da segunda chamada precisa ser **avaliativa** e não ser ela mesma uma segunda chamada (`ENTRADA_INVALIDA`) | sem a primeira, o `INSERT` bateria no check `atividade_aplicada_prova_so_na_avaliativa` e responderia 500; sem a segunda, a segunda de segunda seria aceita | `techspec.md` §5.9; `cenarios.md` §1 RF10 (as duas linhas de RF10 sobre encadear e sobre a original que não é avaliativa) |
| A segunda chamada **herda o embaralhamento** da original | o corpo da rota (`segundaChamadaRequestSchema`) não traz o embaralhamento, e a prova é a mesma | `techspec.md` §5.9; `cenarios.md` §1 RF10 (a linha "herda o embaralhamento") |

## Mutações

--faltando: 0 linhas (41 blocos, 8 motivos)

Os blocos citam o arquivo `apps/api/src/atividade/segunda-chamada.int.test.ts` pelo nome curto do caso (o `-t` do Vitest é regex: nomes sem parênteses).

### O alcance da segunda chamada (a professora)

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › nos repositories
 .from(atividadeAplicada)
-.where(and(this.#noAlcance(), eq(atividadeAplicada.id, id)))
+.where(and(eq(atividadeAplicada.id, id)))
 if (linha === undefined) return undefined
 const { embaralharQuestoes, embaralharAlternativas, ...resto } = linha
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › nos repositories
 .from(atividadeAplicada)
-.where(and(this.#noAlcance(), eq(atividadeAplicada.id, id)))
+.where(and(this.#noAlcance()))
 if (linha === undefined) return undefined
 const { embaralharQuestoes, embaralharAlternativas, ...resto } = linha
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › quem não é a professora daquela turma
 .where(and(this.#noAlcance(), eq(atividadeAplicada.id, id)))
-if (linha === undefined) return undefined
 const { embaralharQuestoes, embaralharAlternativas, ...resto } = linha
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › quem não é a professora daquela turma
 const original = await aplicacoes.originalDaSegundaChamada(originalId)
-if (original === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
 // A original é conferida antes de travar o artefato: o pedido que vai ser recusado não trava nada.
```

### Quem pode reabrir

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › a original aberta é ENTRADA_INVALIDA
 // A original é conferida antes de travar o artefato: o pedido que vai ser recusado não trava nada.
-if (original.estado !== 'encerrada' || !original.avaliativa || original.segundaChamadaDe !== null) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
+if (!original.avaliativa || original.segundaChamadaDe !== null) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
 // Na mesma ordem do aplicar: o artefato é travado (`for update`) antes de a aplicação nascer.
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › a original que não é avaliativa
 // A original é conferida antes de travar o artefato: o pedido que vai ser recusado não trava nada.
-if (original.estado !== 'encerrada' || !original.avaliativa || original.segundaChamadaDe !== null) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
+if (original.estado !== 'encerrada' || original.segundaChamadaDe !== null) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
 // Na mesma ordem do aplicar: o artefato é travado (`for update`) antes de a aplicação nascer.
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › segunda chamada de segunda chamada
 // A original é conferida antes de travar o artefato: o pedido que vai ser recusado não trava nada.
-if (original.estado !== 'encerrada' || !original.avaliativa || original.segundaChamadaDe !== null) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
+if (original.estado !== 'encerrada' || !original.avaliativa) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
 // Na mesma ordem do aplicar: o artefato é travado (`for update`) antes de a aplicação nascer.
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › artefato que deixou de ser objetiva
 if (alvo === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
-conferirArtefatoParaAplicar(alvo)
 const convocados = pedido.alunoIds.map((alunoId) => alunoId.toLowerCase())
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › artefato que deixou de ser objetiva
 export function conferirArtefatoParaAplicar(alvo: ArtefatoParaAplicar): void {
-if (alvo.tipo !== 'atividade_objetiva') throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
 if (alvo.versaoAdaptada && alvo.entregaEstado !== 'aprovada') throw new DomainException(ErrorCode.VERSAO_ADAPTADA_NAO_APROVADA)
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › artefato que deixou de ser objetiva
 if (alvo.tipo !== 'atividade_objetiva') throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
-if (alvo.versaoAdaptada && alvo.entregaEstado !== 'aprovada') throw new DomainException(ErrorCode.VERSAO_ADAPTADA_NAO_APROVADA)
+if (alvo.entregaEstado !== 'aprovada') throw new DomainException(ErrorCode.VERSAO_ADAPTADA_NAO_APROVADA)
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › artefato que deixou de ser objetiva
 if (alvo.tipo !== 'atividade_objetiva') throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
-if (alvo.versaoAdaptada && alvo.entregaEstado !== 'aprovada') throw new DomainException(ErrorCode.VERSAO_ADAPTADA_NAO_APROVADA)
+if (alvo.versaoAdaptada) throw new DomainException(ErrorCode.VERSAO_ADAPTADA_NAO_APROVADA)
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
teste: apps/api/src/atividade/atividade.int.test.ts › só atividade objetiva se aplica
 if (alvo === undefined || !(await aplicacoes.canAplicarNaTurma(turmaId, alvo.disciplinaId))) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
-conferirArtefatoParaAplicar(alvo)
 // O aluno do tempo adicional é da turma: o de outra turma, de outra escola e o inexistente respondem igual, e nada se grava.
```

### Quem é convocado

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › quem enviou e quem venceu sem enviar
 conferirArtefatoParaAplicar(alvo)
-const convocados = pedido.alunoIds.map((alunoId) => alunoId.toLowerCase())
+const convocados = pedido.alunoIds
 const daTurma = await aplicacoes.alunosDaTurmaEntre(original.turmaId, convocados)
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › aluno de outra turma, de outra escola
 const jaEnviaram = await aplicacoes.quemEnviou(original.id, convocados)
-if (convocados.some((alunoId) => !daTurma.has(alunoId) || jaEnviaram.has(alunoId))) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
+if (convocados.some((alunoId) => jaEnviaram.has(alunoId))) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
 const id = await aplicacoes.create({
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › quem enviou e quem venceu sem enviar
 const jaEnviaram = await aplicacoes.quemEnviou(original.id, convocados)
-if (convocados.some((alunoId) => !daTurma.has(alunoId) || jaEnviaram.has(alunoId))) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
+if (convocados.some((alunoId) => !daTurma.has(alunoId))) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
 const id = await aplicacoes.create({
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › nos repositories
 .where(
 and(
-eq(tentativaAtividade.escolaId, requireEscolaId()),
 eq(tentativaAtividade.anoLetivoId, requireAnoEmCurso()),
 or(eq(atividadeAplicada.id, originalId), eq(atividadeAplicada.segundaChamadaDe, originalId)),
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › nos repositories
 eq(tentativaAtividade.escolaId, requireEscolaId()),
-eq(tentativaAtividade.anoLetivoId, requireAnoEmCurso()),
 or(eq(atividadeAplicada.id, originalId), eq(atividadeAplicada.segundaChamadaDe, originalId)),
 inArray(tentativaAtividade.alunoId, [...alunoIds]),
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › quem enviou e quem venceu sem enviar
 eq(tentativaAtividade.anoLetivoId, requireAnoEmCurso()),
-or(eq(atividadeAplicada.id, originalId), eq(atividadeAplicada.segundaChamadaDe, originalId)),
+or(eq(atividadeAplicada.segundaChamadaDe, originalId)),
 inArray(tentativaAtividade.alunoId, [...alunoIds]),
 isNotNull(tentativaAtividade.enviadaEm),
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › quem enviou uma segunda chamada, já encerrada
 eq(tentativaAtividade.anoLetivoId, requireAnoEmCurso()),
-or(eq(atividadeAplicada.id, originalId), eq(atividadeAplicada.segundaChamadaDe, originalId)),
+or(eq(atividadeAplicada.id, originalId)),
 inArray(tentativaAtividade.alunoId, [...alunoIds]),
 isNotNull(tentativaAtividade.enviadaEm),
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › nos repositories
 or(eq(atividadeAplicada.id, originalId), eq(atividadeAplicada.segundaChamadaDe, originalId)),
-inArray(tentativaAtividade.alunoId, [...alunoIds]),
 isNotNull(tentativaAtividade.enviadaEm),
 ),
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › quem enviou e quem venceu sem enviar
 inArray(tentativaAtividade.alunoId, [...alunoIds]),
-isNotNull(tentativaAtividade.enviadaEm),
 ),
 )
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › quem enviou e quem venceu sem enviar
 .from(tentativaAtividade)
-.innerJoin(atividadeAplicada, and(eq(atividadeAplicada.escolaId, tentativaAtividade.escolaId), eq(atividadeAplicada.id, tentativaAtividade.atividadeAplicadaId)))
+.innerJoin(atividadeAplicada, and(eq(atividadeAplicada.escolaId, tentativaAtividade.escolaId)))
 .where(
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › nos repositories
 async saveConvocados(atividadeAplicadaId: string, alunoIds: readonly string[]): Promise<void> {
-if (alunoIds.length === 0) return
 await this.banco.insert(convocadoDaSegundaChamada).values(alunoIds.map((alunoId) => ({ escolaId: requireEscolaId(), anoLetivoId: requireAnoEmCurso(), atividadeAplicadaId, alunoId })))
```

### O que a segunda chamada grava

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › a original aberta é ENTRADA_INVALIDA
 embaralharAlternativas: nova.embaralhar.alternativas,
-segundaChamadaDe: nova.segundaChamadaDe ?? null,
+segundaChamadaDe: null,
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › o convocado vê a segunda chamada na lista
 avaliativa: true,
-janela: pedido.janela,
+janela: undefined,
 duracaoMin: pedido.duracaoMin,
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › o convocado vê a segunda chamada na lista
 janela: pedido.janela,
-duracaoMin: pedido.duracaoMin,
+duracaoMin: undefined,
 embaralhar: original.embaralhar,
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › o convocado vê a segunda chamada na lista
 duracaoMin: pedido.duracaoMin,
-embaralhar: original.embaralhar,
+embaralhar: { questoes: false, alternativas: false },
 segundaChamadaDe: original.id,
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › a original aberta é ENTRADA_INVALIDA
 embaralhar: original.embaralhar,
-segundaChamadaDe: original.id,
 })
 await aplicacoes.saveConvocados(id, convocados)
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › o convocado vê a segunda chamada na lista
 artefatoId: original.artefatoId,
-avaliativa: true,
+avaliativa: false,
 janela: pedido.janela,
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › o convocado vê a segunda chamada na lista
 })
-await aplicacoes.saveConvocados(id, convocados)
 await aplicacoes.saveTempoAdicional(id, pedido.tempoAdicional)
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › o convocado vê a segunda chamada na lista
 await aplicacoes.saveConvocados(id, convocados)
-await aplicacoes.saveTempoAdicional(id, pedido.tempoAdicional)
 await registro.save(tx, 'atividade.segunda_chamada_aplicada', {
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › leva a original, a turma e só as contagens
 await aplicacoes.saveTempoAdicional(id, pedido.tempoAdicional)
-await registro.save(tx, 'atividade.segunda_chamada_aplicada', {
-entidadeId: id,
-depois: { segundaChamadaDe: original.id, turmaId: original.turmaId, convocados: convocados.length, comTempoAdicional: pedido.tempoAdicional.length },
-})
 const lida = await aplicacoes.porId(id)
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › leva a original, a turma e só as contagens
 entidadeId: id,
-depois: { segundaChamadaDe: original.id, turmaId: original.turmaId, convocados: convocados.length, comTempoAdicional: pedido.tempoAdicional.length },
+depois: { segundaChamadaDe: original.id, turmaId: original.turmaId, convocados: 1, comTempoAdicional: pedido.tempoAdicional.length },
 })
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › leva a original, a turma e só as contagens
 entidadeId: id,
-depois: { segundaChamadaDe: original.id, turmaId: original.turmaId, convocados: convocados.length, comTempoAdicional: pedido.tempoAdicional.length },
+depois: { segundaChamadaDe: original.id, turmaId: original.turmaId, convocados: convocados.length, comTempoAdicional: 0 },
 })
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › a original aberta é ENTRADA_INVALIDA
 const lida = await aplicacoes.porId(id)
-if (lida === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+if (lida !== undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
 return lida
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.controller.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › a original aberta é ENTRADA_INVALIDA
 @RequirePermissao('atividade_aplicada', 'segunda_chamada')
-segundaChamada(@Param('id', IdPipe) atividadeAplicadaId: string, @Body(new ZodValidationPipe(segundaChamadaRequestSchema)) pedido: SegundaChamadaRequest): Promise<AtividadeAplicadaResponse> {
+segundaChamada(@Param('id', IdPipe) atividadeAplicadaId: string, @Body(new ZodValidationPipe(estenderTempoRequestSchema)) pedido: SegundaChamadaRequest): Promise<AtividadeAplicadaResponse> {
 return this.segundasChamadas.aplicar(atividadeAplicadaId, pedido)
```

### O alcance do aluno

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › o convocado vê a segunda chamada na lista
 eq(atividadeAplicada.anoLetivoId, requireAnoEmCurso()),
-or(
+and(
 isNull(atividadeAplicada.segundaChamadaDe),
 exists(
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › o convocado vê a segunda chamada na lista
 or(
-isNull(atividadeAplicada.segundaChamadaDe),
 exists(
 this.banco
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › o convocado vê a segunda chamada na lista
 isNull(atividadeAplicada.segundaChamadaDe),
-exists(
-this.banco
-.select({ um: convocadoDaSegundaChamada.id })
-.from(convocadoDaSegundaChamada)
-.where(
-and(
-eq(convocadoDaSegundaChamada.escolaId, atividadeAplicada.escolaId),
-eq(convocadoDaSegundaChamada.atividadeAplicadaId, atividadeAplicada.id),
-eq(convocadoDaSegundaChamada.alunoId, usuarioId),
-),
-),
-),
 ),
 exists(
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › o não convocado não vê na lista
 eq(convocadoDaSegundaChamada.escolaId, atividadeAplicada.escolaId),
-eq(convocadoDaSegundaChamada.atividadeAplicadaId, atividadeAplicada.id),
 eq(convocadoDaSegundaChamada.alunoId, usuarioId),
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts
teste: apps/api/src/atividade/segunda-chamada.int.test.ts › o não convocado não vê na lista
 eq(convocadoDaSegundaChamada.atividadeAplicadaId, atividadeAplicada.id),
-eq(convocadoDaSegundaChamada.alunoId, usuarioId),
 ),
 ),
```

**Sem bloco, com o motivo (cláusula equivalente ou coberta por outra peça):**

- `alvo === undefined` (`segunda-chamada.service.ts`): o alcance da original (`originalDaSegundaChamada`) e o do artefato (`artefatoParaAplicar`) pedem o mesmo vínculo da professora na turma e na disciplina; só uma corrida de vínculo encerrado entre as duas leituras chega a ele, e tirar a linha deixaria um `TypeError` (500) no lugar do `NAO_ENCONTRADO` que a corrida pediria.
- `exists(` do alcance do aluno (`minha-atividade.repository.ts`): o ramo do convocado inteiro tem bloco (sai o `exists(…)` e fica o `isNull`), e os três termos de dentro, um cada, menos o da escola, abaixo.
- `turmaId: original.turmaId` e `artefatoId: original.artefatoId` do `create`: a FK composta `atividade_aplicada_segunda_chamada_da_original_fk` (escola, ano, turma, artefato e a original) recusa a segunda chamada com outra turma ou outro artefato, e o `NOT NULL` recusa a falta.
- `eq(atividadeAplicada.escolaId, tentativaAtividade.escolaId)` (a junção do `quemEnviou`): o termo do id da aplicação é um uuid único, e o `where` já prende a escola da tentativa; tirar ou pôr o termo não muda uma linha.
- `eq(convocadoDaSegundaChamada.escolaId, atividadeAplicada.escolaId)`: o termo do id da aplicação (com bloco) é um uuid único, e a consulta de fora já prende a escola do contexto; tirá-lo não muda uma linha.
- `escolaId: requireEscolaId(), anoLetivoId: requireAnoEmCurso()` do `values` de `saveConvocados`: não há condição a mutar sem quebrar o `NOT NULL`; o caso `nos repositories` prova a recusa com a escola e com o ano trocados (a FK composta com a aplicação).
- `@RequirePermissao('atividade_aplicada', 'segunda_chamada')` e o `inject: [DB]` do `SegundaChamadaService`: tirá-los derruba o boot da API (`PermissaoBootCheck`, e o Nest sem a dependência), não um caso; o mutante cai em erro de carga, que o portão recusa.
- **A segunda aberta por original (`CONFLITO`) e a corrida (h):** a barreira é o índice único parcial `atividade_aplicada_segunda_chamada_aberta_unica`, do banco, e o bloco que o tira mora na 1.0 (`prova-online.int.test.ts` de `packages/core`, que constrói o próprio banco pelas migrations). O caso `segunda chamada dupla` prova que as duas chamadas em paralelo terminam em um 201 e um `CONFLITO`, com a segunda parada na fila da trava (`esperarNaTrava`), e que nada fica gravado da segunda.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | Conferir no serviço que cada `tempoAdicional[].alunoId` está entre os convocados | Recusada: o `superRefine` de `segundaChamadaRequestSchema` (`packages/shared/src/atividade/atividade-aplicada.ts`) recusa o tempo adicional de quem não é convocado antes de o serviço rodar, e o corpo da rota passa por ele; a cláusula não teria caso que a alcançasse pelo HTTP, nem bloco de mutação que não fosse equivalente |
| tenancy-guardian (1ª) | O `exists` do convocado em `minha-atividade.repository.ts` prende a escola, mas não o ano | Recusada: o mesmo motivo da linha "Sem bloco" do `eq(convocadoDaSegundaChamada.escolaId, …)`: o id da aplicação é único e a consulta de fora já prende escola e ano; tirar ou pôr o termo não muda uma linha |
| conformidade-reviewer (1ª) | Falta o caso em que a rotina da 6.0 encerra uma segunda chamada vencida e o lote nasce `pendente`, separado da original | `TODO.md`: o caminho do lote é o mesmo e genérico por aplicação (o revisor aprovou); a bancada é a do encerramento por relógio da 6.0 |
| conformidade-reviewer (1ª) | Na tela, a segunda chamada precisa aparecer com aprovação de lote separada da original | Tarefa 11.0 (a tela da professora, "abre a segunda chamada"); a 9.0 não tem tela |
| infra-guardian (1ª) | Rodar `npm run carga:prova` para ver que o p95 do fluxo normal não mudou | A esteira (D52: a integração da infra fica fora do portão de toda tarefa) |
| infra-guardian (1ª) | Anexar o `EXPLAIN` da consulta da `prova` e do PUT com o alcance novo | `TODO.md`: exige expor a consulta só para o `.toSQL()`, como a recomendação equivalente da 7.0; a chave única `(escola_id, atividade_aplicada_id, aluno_id)` cobre o `exists`, segundo o infra-guardian |
| infra-guardian (1ª), revisor-geral (1ª), test-engineer (1ª) | A autoconferência (item 12) remete à tabela "Recomendações sem aplicar", que está vazia | Atendida: esta tabela é copiada para ela |
| privacy-guardian (1ª) | Registrar na AIA ou no dossiê por que a auditoria nova não leva o id do aluno e não aparece no arquivo do titular | `TODO.md`: a AIA da correção de objetiva não é arquivo da tarefa; o ato chega ao titular pela linha do convocado |
| revisor-geral (1ª) | `GET …/:id/acompanhamento` lista a turma inteira; numa segunda chamada, quem não foi convocado aparece como `nao_comecou` | Tarefa 11.0 (a tela que mostra a lista); decidir lá se contém só os convocados |
| test-engineer (1ª) | Falta a professora com duas disciplinas na mesma turma tentando reabrir pela disciplina errada | `TODO.md`: o caso `a.deFisica` já prova o termo da disciplina do vínculo, e a mesma pessoa com duas é só outra sessão |
| test-engineer (1ª) | Falta o aluno que entrou na turma depois da original: sem tentativa e convocável | `TODO.md`: a regra "turma atual" é a do `alunosDaTurmaEntre`, e o transferido, o pendente e o do 2ºC já provam o termo da turma |
| revisor-geral (2ª), conformidade-reviewer (2ª), privacy-guardian (2ª) | O docblock de `SegundaChamadaService` (`segunda-chamada.service.ts:14`, "Quem é convocado") ainda diz "não enviou a original"; a regra agora é "não enviou a original nem nenhuma segunda chamada dela" | `TODO.md`: é comentário, e mexer nele depois da aprovação caduca o `revisor-geral` e custa uma rodada só por isso. Fica errado até lá, e a §5.9 e o docblock do `quemEnviou` já dizem a regra certa |
| privacy-guardian (2ª), tenancy-guardian (2ª) | O docblock de `saveConvocados` (`atividade-aplicada.repository.ts:414`) diz "não enviou a original" | `TODO.md`, junto com a linha acima (os dois comentários se acertam de uma vez) |
| revisor-geral (2ª) | O item 1 da autoconferência da tarefa fala em "os cinco termos do `quemEnviou`", e a consulta ganhou a junção e o `or` | `TODO.md`, junto com as linhas acima: é texto do documento da tarefa, e o bloco de mutação de cada termo está certo |
| infra-guardian (2ª) | Corrida estreita no `quemEnviou`: a professora abre uma segunda chamada enquanto a anterior ainda está aberta e sendo encerrada; a leitura não tem trava e pode convocar duas vezes o aluno que vence sem enviar. Dois caminhos: `for update` na segunda chamada aberta da original antes do `quemEnviou`, ou refazer o `quemEnviou` depois do `insert`; junto, um caso com `WriteBlockTrigger` no `update` do encerramento | `TODO.md`: muda comportamento e a ordem das travas (não é recomendação barata), e só acontece com as duas ações da professora disparadas juntas; o revisor a deixou como recomendação, não bloqueante |
| test-engineer (2ª) | A frase nova de `segunda-chamada.service.ts:59` ("o pedido que vai ser recusado não trava nada") não tem caso que a prove; voltar a ordem antiga deixaria a suíte verde. Ou entra um teste de espera na trava do artefato, ou o comentário diz só a ordem | `TODO.md`, na mesma linha do comentário do `quemEnviou` acima: as duas decisões (o teste de espera e a corrida) pedem o `esperarNaTrava` |
| test-engineer (2ª) | Em `'a leitura sem trava'`, conferir também o `id`, se a leitura o devolver | `TODO.md`: o caso confere `estado` e `avaliativa` e a lista e a prova conferem o id; é só arquivo de teste, e fica para a próxima vez que o arquivo for aberto |
| conformidade-reviewer (2ª) | Registrar para a validação que o "quem abriu" de cada convocado se lê pela aplicação (`aplicada_por`, `aplicada_em`) e pela auditoria, não pela linha do convocado | Nota ao Validador: o `docs/lgpd.md` já diz isso na linha 59, depois do item 6 da ordem da rodada 1 |
| infra-guardian (2ª) | O `quemEnviou` com junção e `or` roda só quando a professora abre a segunda chamada, e não precisa de `EXPLAIN`; o `EXPLAIN` da `prova` e do PUT segue no `TODO.md` | Sem ação: é constatação do revisor; o `EXPLAIN` já está registrado no `TODO.md` desde a rodada 1 |
| test-engineer (2ª) | Os casos da rotina da 6.0, da professora com duas disciplinas e do aluno que entrou na turma depois estão no `TODO.md` | Sem ação: já registrados desde a rodada 1 |
| privacy-guardian (2ª) | A recomendação da AIA da correção de objetiva (por que a auditoria nova não leva o id do aluno) segue aberta | Sem ação: já registrada no `TODO.md` desde a rodada 1 |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-28 01:19:34 | 2026-11-28 01:20:32 | `tenancy-guardian` | 1 | APROVADO | aca7316cc60e86c9a |
| 2026-11-28 01:19:37 | 2026-11-28 01:20:37 | `conformidade-reviewer` | 1 | APROVADO | a7346091175ff383f |
| 2026-11-28 01:19:39 | 2026-11-28 01:20:45 | `infra-guardian` | 1 | APROVADO | a4cc9fc46dca26c7a |
| 2026-11-28 01:19:41 | 2026-11-28 01:21:03 | `privacy-guardian` | 1 | APROVADO | a040ac640cda64eb1 |
| 2026-11-28 01:19:46 | 2026-11-28 01:21:31 | `revisor-geral` | 1 | REPROVADO | a8a96b36b87582510 |
| 2026-11-28 01:19:44 | 2026-11-28 01:22:18 | `test-engineer` | 1 | REPROVADO | a692789090426d641 |
| 2026-11-28 01:41:18 | 2026-11-28 01:41:50 | `revisor-geral` | 2 | APROVADO | a9c7966e3f5ad38af |
| 2026-11-28 01:41:29 | 2026-11-28 01:41:50 | `tenancy-guardian` | 2 | APROVADO | aac7e31be13c638ac |
| 2026-11-28 01:41:33 | 2026-11-28 01:41:56 | `conformidade-reviewer` | 2 | APROVADO | a7274ebaa9dfc5837 |
| 2026-11-28 01:41:42 | 2026-11-28 01:42:12 | `privacy-guardian` | 2 | APROVADO | ad03e42cd8ed7efa9 |
| 2026-11-28 01:41:37 | 2026-11-28 01:42:12 | `infra-guardian` | 2 | APROVADO | aacfb129fcc0c58c7 |
| 2026-11-28 01:41:24 | 2026-11-28 01:42:47 | `test-engineer` | 2 | APROVADO | a36e1a8a55f8e57e3 |
