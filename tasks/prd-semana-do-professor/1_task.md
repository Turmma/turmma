# Tarefa 1.0 — O registro da aula existe, só a professora o alcança, e sai na virada do ano

**Funcionalidade:** semana-do-professor · **Depende de:** nenhuma
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `test-engineer`
**Porte:** grande

## Objetivo

A tabela `aula` existe, presa à escola, ao ano e ao vínculo; só a professora tem célula na matriz; o arquivo do titular a
leva só na versão `completa`; o encerramento do ano a apaga.

## Contexto necessário

- `techspec.md` seções 3, 6, 7 e 11; `cenarios.md` R5, R6, S7
- `prd.md` RF11 e seção 8
- `.claude/rules/20`, itens 10, 15 e 19
- `packages/core/src/db/schema/alocacao.ts`: a FK composta a copiar
- `packages/core/src/estrutura/vinculo.repository.ts:345` (`virarAno`): onde o complemento da contestação já é limpo
- `packages/core/src/titular/leitura-do-titular.ts` (`naVersao`, critério 5) e `troca-de-nome.ts:45`

## Subtarefas

- [ ] 1.1 — `aula.ts` (seção 3) e a migration só de criação, pelo `drizzle-kit`; registro em `database.ts`
- [ ] 1.2 — `matriz.ts`: `aula: ['ler', 'gravar']`, professor `proprio`, os outros `nunca`
- [ ] 1.3 — `classificacao.ts`: chave nova de prazo fixo (a virada), ligação `vinculo_id`, fora da prévia
- [ ] 1.4 — `leitura-do-titular.ts`: só na `completa`, com a linha no comentário do critério 5; `troca-de-nome.ts`: o porquê de ficar fora
- [ ] 1.5 — `virarAno` apaga as linhas de `aula` do ano, na mesma transação
- [ ] 1.6 — `docs/lgpd.md` (a linha "Registro da aula") e `docs/modelo-de-dados.md` (a `Aula` da seção 3)
- [ ] 1.7 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/db/schema/aula.ts`, `packages/core/src/db/schema/aula.int.test.ts` | novo |
| `packages/core/drizzle/0041_*.sql`, `packages/core/drizzle/meta/_journal.json`, `packages/core/drizzle/meta/0041_snapshot.json` | novo e alterado |
| `packages/core/src/db/database.ts`, `packages/core/src/index.ts` | alterado |
| `packages/shared/src/permissao/matriz.ts`, `packages/shared/src/permissao/matriz.test.ts` | alterado |
| `packages/shared/src/privacidade/classificacao.ts` | alterado |
| `packages/core/src/titular/leitura-do-titular.ts`, `packages/core/src/titular/leitura-do-titular.test.ts`, `packages/core/src/titular/troca-de-nome.ts` | alterado |
| `packages/core/src/estrutura/vinculo.repository.ts` | alterado |
| `apps/api/test/virada-do-ano.int.test.ts`, `apps/api/test/arquivo-do-titular.int.test.ts`, `apps/worker/test/eliminar-titular.int.test.ts` | alterado |
| `docs/lgpd.md`, `docs/modelo-de-dados.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| `inicio = fim` e `inicio > fim` recusados (23514) | integração | check | |
| conteúdo só de espaços recusado | integração | check do `btrim` | |
| 501 depois do `btrim` recusado, 500 entra | integração | check do tamanho | |
| `vinculoId` de B com `escolaId` de A recusado (23503) | integração | FK, escola | |
| `vinculoId` de A com outro ano de A recusado (23503) | integração | FK, ano | |
| mesmo (vínculo, data, início) recusado (23505) | integração | único | |
| apagar o vínculo apaga só a `aula` dele | integração | cascata | |
| S7: o `virarAno` apaga as do ano, inclusive a do vínculo encerrado antes | integração | retenção | |
| S7: a `aula` da B continua | integração | isolamento | |
| a `aula` de A no ano `planejado` sobrevive ao encerramento | integração | cláusula do ano | |
| R5: a `coordenacao` não traz a tabela nem a sentinela; a `completa` traz | integração | regra 70, item 8 | |
| R5: a prévia não ganha categoria nem contagem | integração | D64 | |
| R6: `naVersao`, `completa` sim, `coordenacao` não | unidade | critério 5 | |
| R6: `nunca` para coordenação, rede e aluno | unidade | matriz | |
| professor `proprio`, não `escola` | unidade | matriz | |
| sem a `aula` em `classificacao.ts`, a guarda de `leitura-do-titular.test.ts` fica vermelha | unidade | classificação | |
| troca de nome com o nome do aluno no texto: o texto fica intacto | integração | exclusão declarada | |

A cláusula de escola sozinha no `virarAno` não é observável (o ano já separa): diga isso nas Mutações, sem bloco verde.

## Como testar

- Checks, FK e cascata: `packages/core/src/db/schema/f2-planilhas.int.test.ts › o vínculo de outra escola e o de outro ano são recusados pela FK composta com o ano do vínculo` e os irmãos (linhas 125 a 159)
- Virada: `apps/api/test/virada-do-ano.int.test.ts › caminho feliz: …` e o `describe` de isolamento (linha 658)
- Arquivo: `apps/api/test/arquivo-do-titular.int.test.ts:710`, com a sentinela no `conteudo`
- Troca de nome: `apps/worker/test/eliminar-titular.int.test.ts` (linhas 256 a 276)
- Comando: `npx vitest run --project integracao packages/core/src/db/schema/aula.int.test.ts`
- Armadilha da F2 (retro, grupo E): no isolamento, todo id é da B, lido no contexto da A

## Autoconferência

As 12 perguntas do modelo, no plano.

## Fora do escopo desta tarefa

As rotas (2.0, 4.0), o passo da grade (5.0), as telas.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
