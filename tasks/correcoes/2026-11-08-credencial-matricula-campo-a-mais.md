# Correção — `credencial-matricula.repository.int.test.ts` espera 3 campos e o repository devolve 4

**Origem:** esteira run 42525745629 (integração) em `1bda038`.
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `test-engineer`, `revisor-geral`
<!-- Os quatro primeiros guardiões vieram no PEDIDO do Orquestrador; `conformidade-reviewer` e `infra-guardian` foram acrescentados a pedido da Mesa: todo arquivo de `apps/`,
     testes inclusive, pede os quatro guardiões (`tools/processo/guardioes-por-caminho.ts`). -->

## Sintoma

Dois casos de `apps/api/src/credencial/credencial-matricula.repository.int.test.ts` caem com `expected { …(4) } to deeply equal { …(3) }`:
'isolamento: com contexto forjado (escola A)…' e 'eliminação agendada (14.0)…'.

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

A tarefa 10.0 (`cf6f86ff`) acrescentou `provisoriaExpiraEm` ao `CredencialDoAluno` que `doAlunoAtivo` devolve (o vencimento da provisória, `null` quando o hash
é o da senha do aluno). O teste do repository compara com `toEqual` e continuou esperando só `usuarioId`, `senhaHash` e `suspenso`. O portão da 10.0 rodou os
testes que a árvore alterou e este arquivo não estava entre eles: falha da tarefa 10.0, vista só na esteira.

## Teste que reproduz

O próprio `apps/api/src/credencial/credencial-matricula.repository.int.test.ts`: os dois casos acima ficam vermelhos no HEAD. A correção os atualiza para o
contrato de hoje (`provisoriaExpiraEm: null` nos três `toEqual`), sem enfraquecer a asserção.

## Correção

Os três `toEqual` de `doAlunoAtivo` ganham `provisoriaExpiraEm: null`. Nenhum código de produção muda. Por recomendação da rodada 1, um caso novo (`provisória (10.0)…`) prova os dois ramos que o `case when` da provisória cria: vigente (hash e vencimento em texto) e vencida (`null` nos dois).

## Mutações

--faltando: 0 linhas (0 blocos, 0 motivos)

**Sem mutação:** a correção só altera um arquivo de teste (`*.int.test.ts`); nenhum código de produção muda e nenhuma cláusula nova entra.

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-08 20:36:50 | 2026-11-08 20:37:03 | `conformidade-reviewer` | 1 | APROVADO | afddcf6d6461731da |
| 2026-11-08 20:36:50 | 2026-11-08 20:37:03 | `infra-guardian` | 1 | APROVADO | a64f99b173c231e83 |
| 2026-11-08 20:36:48 | 2026-11-08 20:37:03 | `tenancy-guardian` | 1 | APROVADO | a352e1ff5edc2f1f8 |
| 2026-11-08 20:36:49 | 2026-11-08 20:37:05 | `privacy-guardian` | 1 | APROVADO | a0d4c35d4f7a81f35 |
| 2026-11-08 20:36:52 | 2026-11-08 20:37:09 | `revisor-geral` | 1 | APROVADO | a7f728833b911567a |
| 2026-11-08 20:36:51 | 2026-11-08 20:37:24 | `test-engineer` | 1 | APROVADO | a47885a86478108c7 |

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (1ª), test-engineer (1ª) | "mudar o contrato de um repository deveria arrastar para o portão os `*.int.test.ts` vizinhos" (o portão da 10.0 só rodou os testes de integração que o diff alterou) | `TODO.md`, e retro da acesso-e-convites. Muda `tools/processo/portao-local.ts` (comportamento do portão) e sai do escopo de uma correção de teste |
| tenancy-guardian (1ª) | caso de provisória vigente com contexto forjado da escola A (provisória de aluno de B dá `undefined`), "se esse isolamento ainda não estiver nos testes da tarefa 10.0" | Recusada: o `doAlunoAtivo` tem um `where` só, com `eq(credencialMatricula.escolaId, escolaId)`, para a senha e para a provisória (o `case` vem depois do filtro), e o caso de isolamento que já existe prova essa cláusula (o próprio tenancy-guardian confirmou que sem ela o `toBeUndefined()` fica vermelho). O `paraATroca` e o `trocarProvisoria` são da 10.0 e não estão em revisão aqui |
| 2026-11-08 20:48:58 | 2026-11-08 20:49:11 | `revisor-geral` | 2 | APROVADO | ad5fc76e64ed5f34f |
| 2026-11-08 20:48:49 | 2026-11-08 20:49:35 | `test-engineer` | 2 | APROVADO | a67b84a85495503bc |
| test-engineer (2ª) | Gerar a provisória vigente do caso novo pelo `gravarProvisoria` (`credencial-matricula.repository.ts:259`) em vez do `update` direto, para o caso perceber se o método deixar de apagar `senha_hash`; a vencida segue com o `update`, porque o método fixa o vencimento sozinho | `TODO.md` (tarefa 10.0 / retro da acesso-e-convites). Ele mesmo diz: "A correção cabe à tarefa 10.0, não a esta" |
| test-engineer (2ª), revisor-geral (2ª) | Caso do aluno com senha própria e provisória vigente ao mesmo tempo: "a provisória não entra quando o aluno tem senha" (`credencial-matricula.repository.ts:89`) | `TODO.md` (tarefa 10.0 / retro da acesso-e-convites). Estado que `gravarProvisoria` não produz; cobertura a mais, os dois dizem que não bloqueia |
