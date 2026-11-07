# Tarefa 11.0 — O arquivo do titular traz os atos sobre ele (D85)

**Funcionalidade:** acesso-e-convites · **Depende de:** 10.0
**Subagentes obrigatórios:** `privacy-guardian`, `tenancy-guardian`, `infra-guardian`, `test-engineer`
**Porte:** grande

## Objetivo

O arquivo do titular do aluno traz, numa lista fechada, as seis ações sobre ele (`aluno.transferido`, `lista.transferida`, `usuario.nome_corrigido`, `lista.nome_corrigido`, `senha_provisoria.gerada`, `.usada`), com ação, entidade, finalidade, data e o papel de quem fez, e nunca o autor, o `antes`, o `depois` nem as leituras.

## Contexto necessário

- `techspec.md` seções 3 (o índice da auditoria) e 5 ("Arquivo do titular")
- `prd.md` RF17; `cenarios.md` "Arquivo do titular (D85)"
- `docs/decisoes.md` D85; `.claude/rules/20` itens 10 e 19
- `packages/core/src/titular/leitura-do-titular.ts` (`LEITURAS_DO_ARQUIVO`, `COLUNAS_FORA_DO_ARQUIVO`) e a migration `0034` (o índice parcial de modelo)

## Subtarefas

- [ ] 11.1 — Migration do índice parcial `auditoria (escolaId, entidadeId, em)` nas seis ações
- [ ] 11.2 — A leitura por alvo: o papel fixo por ação nas quatro da F2, do `depois` na `.gerada`; o `lista_nome` só aprovado, pelo `alunoId` da decisão
- [ ] 11.3 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0046_auditoria_por_alvo.sql` | novo |
| `packages/core/drizzle/meta/_journal.json` | alterado |
| `packages/core/src/db/schema/auditoria.ts` | alterado |
| `packages/core/src/titular/leitura-do-titular.ts` | alterado |
| `packages/core/src/titular/leitura-do-titular.test.ts` | alterado |
| `apps/api/test/arquivo-do-titular.int.test.ts` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| cada uma das seis ações | integração | no arquivo do alvo, não no de outro aluno, com o papel, sem id nem nome do autor, sem `antes` nem `depois` | |
| `lista.nome_corrigido` e `lista.transferida` de nome não aprovado | integração | em arquivo nenhum; aprovado, no do aluno | |
| autor das quatro da F2 eliminado | integração | o papel continua | |
| `.usada` | integração | aparece uma vez | |
| `.gerada` por professor e pela coordenação | integração | "professor" e "coordenação" | |
| isolamento: linha da B com o `entidade_id` do aluno da A | integração | fora do arquivo da A | |
| leitura auditada (a coordenação abriu) | integração | não entra | |
| [U] a forma da leitura | unidade | nenhuma coluna de `COLUNAS_FORA_DO_ARQUIVO` | |

## Como testar

- Precedente: `apps/api/test/arquivo-do-titular.int.test.ts` › "o aluno: cada tabela que ele tem aparece, e a linha de outro aluno e a de outra escola não" e "o arquivo do aluno não leva o id da coordenação nem a leitura que ela fez do titular, nas duas versões"
- Unidade: `packages/core/src/titular/leitura-do-titular.test.ts` (describe "LEITURAS_DO_ARQUIVO: a forma das leituras")
- Comando: `npx vitest run --project integracao apps/api/test/arquivo-do-titular.int.test.ts -t "D85"`

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 5: plante a linha da B direto no banco, com o mesmo `entidade_id`.

## Fora do escopo desta tarefa

Os atos de outras ações, fora da lista fechada.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
