# Correção — o escopo de escola de `GradeRepository.aulasDaTurma` não tem teste que o pegue

**Origem:** `tasks/prd-onboarding-por-convite/validacao.md` §4, crítico 2 (validação REPROVADA, RF16 PARCIAL).
**Subagentes obrigatórios:** `revisor-geral`, `test-engineer`, `tenancy-guardian`
<!-- Os guardiões vieram no PEDIDO do Orquestrador, que incluiu o `revisor-geral` na retomada (a correção leva 1 arquivo fora de tasks/,
     o teste, e não passa do limite do passo 5 sozinha; ele vale porque o pedido o dita). -->

## Sintoma

Tirada a cláusula `eq(alocacao.escolaId, escolaId)` de `GradeRepository.aulasDaTurma`
(`packages/core/src/importacao/grade.repository.ts:54`), os 73 casos de `grade.int.test.ts`, `gravar-planilha-grade.int.test.ts`
e `operacao-isolamento.int.test.ts` seguem verdes. A mutação 1 da validação sobreviveu.

## Fora desta correção

Nada: a árvore estava limpa (`Arquivos da tarefa em curso: nenhum`). O crítico 1 (`desligamento-pela-planilha.int.test.ts:452`) e o menor do
`motor.ts:95` da mesma validação não são desta correção: o pedido é só o crítico 2.

## Causa

O caso `a leitura da grade só alcança a turma da escola do contexto e do ano pedido…` (`grade.int.test.ts:608`) lia a turma da B com o
**ano da A** (`aulasDaTurma(e.emCurso, outra.t8a)`). A aula da B é de um ano que a A não tem, então o filtro
`eq(alocacao.anoLetivoId, anoLetivoId)` já a escondia, e a cláusula de escola ficava sem o que provar. Os `innerJoin` com `vinculo` e
`usuario` também não ajudam: casam por `vinculo.escolaId = alocacao.escolaId`, isto é, dentro da escola da própria aula. O único contexto em
que só o `escolaId` separa as duas escolas é o ano **e** a turma da B lidos com a sessão da A. Regra 10, item 5: tirada a cláusula, o teste
tem de quebrar.

## Teste que reproduz

`apps/api/test/grade.int.test.ts › a leitura da grade só alcança a turma da escola do contexto e do ano pedido: a turma de outra escola ou de
outro ano não existe, e não devolve aula`. Passou a ler `aulasDaTurma(outra.e.emCurso, outra.t8a)` (ano e turma da B, contexto da A) e
`turmaExiste(outra.e.emCurso, outra.t8a)`; os casos antigos (ano da A com turma da B, ano planejado) ficam.

Antes da correção do teste, o caso estava verde com a cláusula tirada (a sobrevivência da validação). Com o caso novo e a cláusula tirada,
rodado isolado, ele fica **vermelho em `grade.int.test.ts:621`** (`aulasDaTurma(outra.e.emCurso, outra.t8a)` devolve as duas aulas da 8ºA da B
em vez de `[]`); com a cláusula no lugar, verde. O arquivo de produção foi restaurado por `git checkout --` e não está no diff.

## Correção

Só teste: o caso acima ganha a leitura com o ano e a turma da B no contexto da A e a mesma checagem em `turmaExiste`, com o comentário do
porquê. Nenhum código de produção muda: o repository já está certo, o que faltava era a prova.

## Mutações

--faltando: 0 linhas (0 blocos, 0 motivos)

A correção não acrescenta linha de produção. A mutação é a da validação, declarada para o portão repeti-la:

```mutacao
arquivo: packages/core/src/importacao/grade.repository.ts
teste: apps/api/test/grade.int.test.ts › a leitura da grade só alcança a turma da escola do contexto e do ano pedido: a turma de outra escola ou de outro ano não existe, e não devolve aula
falha: aulasDaTurma(outra.e.emCurso, outra.t8a))).toEqual([])
-      .where(and(eq(alocacao.escolaId, escolaId), eq(alocacao.anoLetivoId, anoLetivoId), eq(vinculo.turmaId, turmaId), ne(vinculo.estado, 'encerrado')))
+      .where(and(eq(alocacao.anoLetivoId, anoLetivoId), eq(vinculo.turmaId, turmaId), ne(vinculo.estado, 'encerrado')))
```

A segunda cláusula é a de `turmaExiste` (ordem da Mesa 2, rodada 1): o mesmo caso a prova, na leitura com o ano e a turma da B.

```mutacao
arquivo: packages/core/src/importacao/grade.repository.ts
teste: apps/api/test/grade.int.test.ts › a leitura da grade só alcança a turma da escola do contexto e do ano pedido: a turma de outra escola ou de outro ano não existe, e não devolve aula
falha: turmaExiste(outra.e.emCurso, outra.t8a))).toBe(false)
-      .where(and(eq(turma.escolaId, requireEscolaId()), eq(turma.anoLetivoId, anoLetivoId), eq(turma.id, turmaId)))
+      .where(and(eq(turma.anoLetivoId, anoLetivoId), eq(turma.id, turmaId)))
```

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-06 06:09:04 | 2026-11-06 06:09:18 | `conformidade-reviewer` | 1 | APROVADO | aa84e1dbf6f8a0062 |
| 2026-11-06 06:09:01 | 2026-11-06 06:09:22 | `revisor-geral` | 1 | APROVADO | a5e6b2d8bc3ddf14a |
| 2026-11-06 06:09:04 | 2026-11-06 06:09:23 | `privacy-guardian` | 1 | APROVADO | ab0c1455cbef9d1d5 |
| 2026-11-06 06:09:08 | 2026-11-06 06:09:23 | `infra-guardian` | 1 | APROVADO | ac3346d701175925e |
| 2026-11-06 06:09:03 | 2026-11-06 06:09:25 | `tenancy-guardian` | 1 | APROVADO | a744dff2c6ceb0ac8 |
| 2026-11-06 06:09:02 | 2026-11-06 06:09:45 | `test-engineer` | 1 | APROVADO | a0eb0bd56d27ed3d3 |
| 2026-11-06 06:16:11 | 2026-11-06 06:16:25 | `revisor-geral` | 2 | APROVADO | a7e72a4b5923b66fd |
| 2026-11-06 06:16:18 | 2026-11-06 06:16:53 | `test-engineer` | 2 | APROVADO | ade255e3abfa4cd47 |
