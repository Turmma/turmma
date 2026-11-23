# Tarefa 1.0 — Migration da prova online; aplicar com janela, duração, embaralhar e tempo adicional; mudar a janela

**Funcionalidade:** avaliacao-e-correcao · **Depende de:** nenhuma
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

O professor aplica a prova e a muda antes do primeiro começo.

## Contexto necessário

- `techspec.md` §3, §4 (todas as rotas, para os contratos), §5.1, §6, §7, §11
- `prd.md` RF1 a RF3; §8
- `cenarios.md` §1 (RF1 a RF3), §1b, §2 (expurgo, eliminação, titular), §3 (b) e (k)
- `.claude/rules/20` (tempo adicional é sensível) e `80`

## Subtarefas

- [ ] 1.1 — Migration `0068_prova_online.sql` à mão e schema (§3; `saida_da_aba` **sem `id` nem tempo**)
- [ ] 1.2 — Contratos de **todas** as rotas da §4 e a matriz
- [ ] 1.3 — Classificação, expurgo e as exceções do `architecture.test.ts` (§3, §11)
- [ ] 1.4 — `aplicar` com janela (opcional até a 10.0), duração, embaralhar e tempo adicional (§5.1)
- [ ] 1.5 — `PATCH …/:id/janela` parcial, com `for update` e o estado relido (§5.1)
- [ ] 1.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0068_prova_online.sql` e `meta/_journal.json` | novo, alterado |
| `packages/core/src/db/schema/atividade-aplicada.ts`, `tentativa-atividade.ts` | alterado |
| `packages/core/src/db/schema/prova-online.ts` | novo |
| `packages/core/src/index.ts` | alterado |
| `packages/core/src/retencao/expurgo-da-escola.repository.ts` | alterado |
| `packages/shared/src/atividade/atividade-aplicada.ts`, `prova.ts` | alterado |
| `packages/shared/src/index.ts` | alterado |
| `packages/shared/src/permissao/matriz.ts`, `privacidade/classificacao.ts` | alterado |
| `apps/api/src/atividade/atividade-aplicada/` (controller, service, repository) | alterado |
| `apps/api/test/architecture.test.ts`, `atividade.fixture.ts` | alterado |
| `apps/api/src/atividade/prova-online.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| Aplicar com +25%, +50% e +100% sobre 40 min | integração | RF1, RF3: as três linhas; auditoria só com a contagem | colega sem linha; nenhum `alunoId` na auditoria | |
| Janela de 50 min, duração 40, aluno com +50% | integração | `ENTRADA_INVALIDA` no campo da janela, no aplicar e no PATCH | a janela de 60 min passa | |
| Aluno de outra turma, de outra escola, inexistente, no aplicar e no PATCH | integração | a mesma resposta, nada gravado | três ids | |
| Não avaliativa com janela | integração | `ENTRADA_INVALIDA` | a avaliativa passa | |
| PATCH (só janela; só `tempoAdicional`) antes e depois de uma tentativa | integração | RF2: grava e audita sem `alunoId`; depois, `PROVA_JA_COMECOU` e a aplicação igual | os dois campos, na mesma aplicação | |
| Corrida (b) janela × começar | integração | `PROVA_JA_COMECOU` pela trava | sem `comecar` ainda: por SQL, `for share` e o insert da tentativa numa transação segurada | |
| Corrida (k) janela × janela | integração | a segunda relê e é recusada | PATCH só da janela (50 min) segurado; o outro só +50% sobre 40 | |
| Professor de B; sem vínculo; outra disciplina; vínculo encerrado em X e aberto em Y; escola sem ano em curso; aluno e coordenação | integração | `NAO_ENCONTRADO` ou a matriz | ids da B no contexto da A | |
| Colunas da `saida_da_aba` | integração | só as cinco, sem default de uuid | lista exata | |
| Expurgo das quatro tabelas | integração | o ano vencido sai, o em curso fica | dois anos; a extensão da turma (aluno nulo) sai | |
| Repository chamado direto: contexto da A com ids da B; contexto da A no ano anterior | integração | vazio | sem passar pela rota | |
| Eliminar o aluno | integração | as linhas dele saem; as do colega ficam | | |
| Arquivo do titular | integração | pelo `aluno_id`, sem `concedido_por` nem `chave` | o arquivo do professor que concedeu não traz o adicional | |
| Matriz e contratos | unidade | ações novas, coordenação e rede em `nunca`; `motivo` e `chave` v7 recusados | | |

## Como testar

- `apps/api/src/atividade/atividade.int.test.ts › a professora aplica a atividade objetiva à turma dela…`, com
  `aplicarAtividade` (`apps/api/test/atividade.fixture.ts`) ganhando janela e tempo adicional opcionais
- `atividade-isolamento.int.test.ts › aplicar exige vínculo confirmado…`
- Corridas: `WriteBlockTrigger` (`apps/api/test/write-block-trigger.ts`)
- Schema: `mvp-tables.int.test.ts › pelo catálogo: toda FK…`; expurgo: `apps/worker/test/expurgo-da-escola.int.test.ts`;
  titular: `arquivo-do-titular.int.test.ts › o aluno: cada tabela que ele tem aparece…`; eliminação: `ciclo-de-vida.int.test.ts`
- `npx vitest run --project integracao apps/api/src/atividade/prova-online.int.test.ts`
- Armadilha: a migration leva o próximo número livre

## Autoconferência

As perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`).

## Fora do escopo desta tarefa

As outras rotas (2.0 a 9.0) e a tela (10.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
