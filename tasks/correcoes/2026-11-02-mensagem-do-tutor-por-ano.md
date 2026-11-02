# Correção — `mensagemDoTutor` não filtra a mensagem pelo ano letivo em curso

**Origem:** `tasks/correcoes/2026-11-02-mensagem-do-assistente-por-ano.md`, "Fora desta correção" e "Recomendações sem aplicar" (tenancy-guardian, conformidade-reviewer e infra-guardian na 1ª rodada; tenancy-guardian e test-engineer na 2ª). Irmã daquela.
**Subagentes obrigatórios:** `test-engineer`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- Os cinco que o PEDIDO do Orquestrador ditou. A correção leva 2 arquivos fora de tasks/ (o repository e o teste) e não toca
     `.github/`, `tools/ci/` nem `tools/processo/`, então o `revisor-geral` não é obrigatório pelo limite do passo 5. -->

## Sintoma

`ExecucaoDaSessaoRepository.mensagemDoTutor` (`apps/api/src/ia/execucao.repository.ts`) filtra a mensagem por escola, id, autor e aluno,
mas não por `mensagemTutor.anoLetivoId`. As chaves estrangeiras só ligam a mensagem à turma e à execução do ano dela, então nada
mais a prende ao ano em curso. Com o contexto no ano em curso, a resposta do Tutor de um ano anterior do mesmo aluno é achada pelo
id. As outras leituras da classe (`daChave`, `deQuemPediu`, `mensagemDoAssistente`) já filtram por `requireAnoEmCurso()`.

## Fora desta correção

Nada: a árvore estava limpa e nenhum arquivo de tarefa em curso.

## Causa

A cláusula de ano letivo nunca entrou nesta consulta (regra 10, item 2). O teste de isolamento vizinho (`a cláusula de escola das
mensagens vale por si`) só trocava a escola, e nenhum caso punha uma mensagem de outro ano do mesmo aluno na mesma escola. Pré-existente
à X8; apontada pelos guardiões na correção irmã. Nas consultas `limit 1` desse mesmo caso, que pegam os ids das mensagens de B sem filtrar por
ano, a lacuna era do teste: bastava B ganhar mensagem de outro ano para o id escolhido ser o errado.

## Teste que reproduz

`apps/api/src/ia/ia.int.test.ts` › `GET /v1/execucoes/:id` › `a resposta do Tutor é do ano letivo em que foi dada: no ano em curso, a de um ano anterior do mesmo aluno não é achada`.
Vermelho antes da cláusula (a mensagem de 2025 é achada no contexto de 2026), verde depois; no contexto do ano dela, é achada; sem ano no
contexto, `NAO_ENCONTRADO`.

## Correção

O `where` de `mensagemDoTutor` ganhou `eq(mensagemTutor.anoLetivoId, requireAnoEmCurso())`, ao lado da cláusula de escola. Sem ano em
curso no contexto o método lança `NAO_ENCONTRADO` antes de ler, como as outras leituras da classe. A rota `GET /v1/execucoes/:id` não
muda: a sessão sempre traz o ano em curso, e `deQuemPediu` já o exigia antes. No teste de isolamento por escola, as duas consultas
`limit 1` que pegam os ids das mensagens de B passaram a filtrar por `ano_letivo_id = b.anoLetivoId`, para o caso continuar firme se B
ganhar mensagem de outro ano (o caso novo do Tutor põe uma, na escola B).

## Recomendações sem aplicar

Rodada 1: APROVADO por todos (`test-engineer`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`). Nenhum bloqueante.

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (1ª) | `ia.int.test.ts:959`: caso pela rota `GET /v1/execucoes/:id`, com execução forjada do ano em curso cujo `resultado.mensagemId` aponta para a mensagem de 2025, exigindo 404 com o mesmo corpo dos outros casos de recusa | Não aplicar: pede montar execução forjada, bem mais que poucas linhas, e a rota não mudou. O repository, onde mora a cláusula, está provado. Destino: `TODO.md`, junto com o caso irmão do Assistente |
| test-engineer (1ª) | `ia.int.test.ts:962-963`: o caso depende de nenhum outro abrir 2025 na escola B; um ano exclusivo do caso, ou ajudante que crie ou reaproveite o ano anterior, evita o acoplamento | Não aplicar: nada quebra hoje, o revisor aponta o caso futuro, e o comentário do teste já avisa a escolha. Destino: o próximo caso de virada de ano na escola B, que trata o ajudante ao tocar o arquivo (também no `TODO.md`) |
| test-engineer (1ª) | A mesma recomendação 1 para o caso irmão do Assistente (`:928`), para registro na retro | Registrar na retro; entra no mesmo item do `TODO.md` |
| infra-guardian (1ª) | Os dados de 2025 do caso novo ficam na escola B até o fim do `describe`; outro caso que leia `mensagem_tutor` ou `execucao_agente` sem filtrar o ano passa a depender da ordem | Mesmo destino da segunda linha acima |
| privacy-guardian (1ª) | Prova de que o arquivo do titular traz a mensagem do Tutor de um ano encerrado (`apps/api/test/arquivo-do-titular.int.test.ts`); o aluno só lê pela rota a do ano em curso | Não aplicar: caminho que o diff não toca; a cláusula nova não o altera |

## Mutações

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/ia.int.test.ts › a resposta do Tutor é do ano letivo em que foi dada: no ano em curso, a de um ano anterior do mesmo aluno não é achada
-      .where(and(eq(mensagemTutor.escolaId, requireEscolaId()), eq(mensagemTutor.anoLetivoId, requireAnoEmCurso()), eq(mensagemTutor.id, id), eq(mensagemTutor.autor, 'tutor'), eq(mensagemTutor.alunoId, requireUsuarioId())))
+      .where(and(eq(mensagemTutor.escolaId, requireEscolaId()), eq(mensagemTutor.id, id), eq(mensagemTutor.autor, 'tutor'), eq(mensagemTutor.alunoId, requireUsuarioId())))
```

```mutacao
arquivo: apps/api/src/ia/execucao.repository.ts
teste: apps/api/src/ia/ia.int.test.ts › a cláusula de escola das mensagens vale por si: com a pessoa de B e a escola A no contexto, a mensagem de B não é achada
-      .where(and(eq(mensagemTutor.escolaId, requireEscolaId()), eq(mensagemTutor.anoLetivoId, requireAnoEmCurso()), eq(mensagemTutor.id, id), eq(mensagemTutor.autor, 'tutor'), eq(mensagemTutor.alunoId, requireUsuarioId())))
+      .where(and(eq(mensagemTutor.anoLetivoId, requireAnoEmCurso()), eq(mensagemTutor.id, id), eq(mensagemTutor.autor, 'tutor'), eq(mensagemTutor.alunoId, requireUsuarioId())))
```

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-02 00:45:43 | 2026-11-02 00:46:02 | `conformidade-reviewer` | 1 | APROVADO | a898d53f7d43f3357 |
| 2026-11-02 00:45:42 | 2026-11-02 00:46:02 | `privacy-guardian` | 1 | APROVADO | a090797e05b51bdcf |
| 2026-11-02 00:45:44 | 2026-11-02 00:46:06 | `infra-guardian` | 1 | APROVADO | a5564c146bdd9c663 |
| 2026-11-02 00:45:40 | 2026-11-02 00:46:11 | `tenancy-guardian` | 1 | APROVADO | a6f68c81c0f035818 |
| 2026-11-02 10:46:47 | 2026-11-02 10:47:47 | `test-engineer` | 1 | APROVADO | a165bde3eac7678b6 |
