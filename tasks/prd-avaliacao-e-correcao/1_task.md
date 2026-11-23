# Tarefa 1.0 — Migration da prova online; aplicar com janela, duração, embaralhar e tempo adicional; mudar a janela

**Funcionalidade:** avaliacao-e-correcao · **Depende de:** nenhuma
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

O professor aplica a prova e a muda antes do primeiro começo. É o tronco: migration, contratos e matriz da spec inteira.

## Contexto necessário

- `techspec.md` §3, §4 (todas as rotas, para os contratos), §5.1, §6, §7, §11
- `prd.md` RF1 a RF3; §8
- `cenarios.md` §1 (RF1 a RF3), §1b, §2 (expurgo, eliminação, titular), §3 (b) e (k)
- `.claude/rules/20` (tempo adicional é sensível) e `80`

## Subtarefas

- [ ] 1.1 — `packages/core/drizzle/0068_prova_online.sql`, à mão: colunas e tabelas da §3; a `saida_da_aba` **sem `id`
  nem tempo** (PK nas cinco colunas); a linha única do `pulso_da_api`; checks `NOT VALID` e `VALIDATE`; o índice novo
  das abertas antes de derrubar o antigo
- [ ] 1.2 — Schema Drizzle
- [ ] 1.3 — Contratos de **todas** as rotas da §4 (`.strict()`, sem motivo, `chave` só uuid v4) e as ações novas na
  matriz, coordenação e rede em `nunca`
- [ ] 1.4 — As quatro tabelas com aluno em `trabalho_do_aluno` (autor e `chave` em `fora`) e no expurgo; `pulso_da_api` e
  `indisponibilidade` nas exceções do `apps/api/test/architecture.test.ts`
- [ ] 1.5 — `aplicar` com janela (opcional até a 10.0), duração, embaralhar e tempo adicional; o que não cabe na janela
  é `ENTRADA_INVALIDA`; auditoria com quantos têm tempo adicional, sem quem
- [ ] 1.6 — `PATCH …/:id/janela` parcial: `for update`, valida o estado relido; `tempoAdicional` substitui a lista;
  `PROVA_JA_COMECOU` com tentativa iniciada; auditoria `atividade.janela_alterada`
- [ ] 1.7 — Testes

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
| Aplicar com janela, duração e tempo adicional | integração | RF1, RF3; auditoria só com a contagem | nenhum `alunoId` na auditoria | |
| +25%, +50% e +100% sobre 40 min | integração | RF3 | um aluno sem tempo adicional | |
| Janela de 50 min, duração 40, aluno com +50% | integração | `ENTRADA_INVALIDA` | a janela de 60 min passa | |
| Aluno de outra turma, de outra escola, inexistente | integração | a mesma resposta, nada gravado | três ids | |
| Não avaliativa com janela | integração | `ENTRADA_INVALIDA` | a avaliativa passa | |
| PATCH antes e depois de uma tentativa iniciada | integração | RF2 | a mesma aplicação | |
| Corrida (b) janela × começar | integração | `PROVA_JA_COMECOU` pela trava | tentativa inserida no banco | |
| Corrida (k) janela × janela | integração | a segunda relê e é recusada | `WriteBlockTrigger` | |
| Professor de B; sem vínculo; outra disciplina; escola sem ano em curso; aluno e coordenação | integração | `NAO_ENCONTRADO` ou a matriz | ids da B no contexto da A | |
| Colunas da `saida_da_aba` | integração | só as cinco, sem default de uuid | lista exata | |
| Expurgo das quatro tabelas | integração | o ano vencido sai, o em curso fica | dois anos | |
| Eliminar o aluno | integração | as linhas dele saem; as do colega ficam | | |
| Arquivo do titular | integração | pelo `aluno_id`, sem `concedido_por` nem `chave` | | |
| Matriz e contratos | unidade | ações novas, coordenação e rede em `nunca`; `motivo` no corpo recusado | | |

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

O comportamento das outras rotas (2.0 a 9.0): aqui só contratos e tabelas. A tela (10.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
