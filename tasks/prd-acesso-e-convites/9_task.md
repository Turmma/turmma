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

- [ ] 9.1 — Migration que só expande `credencial_matricula` (`provisoriaHash`, `provisoriaExpiraEm`, `provisoriaGeradaPor` com `set null`, índice parcial do expurgo)
- [ ] 9.2 — A rota em `credencial/`: trava da linha do usuário do aluno, escopo (vínculo confirmado ou coordenação), conta ligada, `CONFLITO` de 10 s; só então as cotas (60/h por usuário, 5/dia por aluno), a senha, as sessões e `senha_provisoria.gerada` com o papel no `depois`
- [ ] 9.3 — O `desativar` anula as três colunas; o alvo novo no `retencao.expurgar-escola`; a métrica de provisórias por escola
- [ ] 9.4 — Testes

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
| `docs/lgpd.md` | alterado |
| `apps/api/test/senha-provisoria.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| coordenação e professor com vínculo confirmado | integração | geram | |
| permissão: pendente, contestado, encerrado, outra turma; `:usuarioId` de professor ou coordenador | integração | 404 igual ao inexistente | |
| isolamento: aluno da escola B | integração | 404 igual | |
| aluno transferido | integração | a turma antiga recebe 404; a nova gera | |
| aluno com pedido pendente | integração | 404 | |
| conta da escola ligada, só ela ou com senha | integração | `ENTRA_PELA_CONTA_DA_ESCOLA`, senha intacta; outra turma: 404 | |
| gerar | integração | senha e provisória anteriores param de valer, sessões caem | |
| resposta | integração | `no-store`; nenhuma leitura devolve a senha | |
| o hash | integração | pelo semáforo do argon2 (espião) | |
| cotas 60/h e 5/dia | integração | 429, contadas depois do escopo | |
| `senha_provisoria.gerada` | integração | aluno alvo, papel no `depois`, sem senha nem nome | |
| escola sem ano em curso | integração | a coordenação gera, o professor recebe 404 | |
| provisória vencida com 23 h e com 25 h | integração | fica; depois três colunas nulas, auditoria fica | |
| isolamento: o alvo no `it.each(CATEGORIAS_DO_EXPURGO)` | integração | a linha da B fica | |
| `desativar` do aluno; eliminar quem gerou | integração | três colunas nulas; a eliminação passa | |
| métrica de provisórias por escola | integração | lida como no `metrics.int.test.ts` | |
| [P] dois "gerar", mesmo autor e autores diferentes | paralelo | um gera, o outro `CONFLITO` sem gastar cota, um `.gerada`; depois de 10 s vale; cai sem a trava | |

## Como testar

- Precedente: `apps/api/test/decisao.int.test.ts` › "I6: o lote misto responde nao_encontrada igual para tudo que quem decide não alcança" (os vínculos pendente, contestado e encerrado)
- Corrida: `apps/api/test/decisao.int.test.ts` › "professor × coordenação aprovando o mesmo pedido: um aluno, uma credencial, uma auditoria"; barreira com `WriteBlockTrigger` e `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`)
- Semáforo: sem precedente do espião; o mais próximo, `apps/api/test/salas-reivindicar.int.test.ts` › "com o teto ocupado por reivindicações da escola A, o login da escola B recebe a vez no rodízio…"
- Expurgo: `apps/worker/test/expurgo-da-escola.int.test.ts:589` e `relogioEm` (linha 68)
- Comando: `npx vitest run --project integracao apps/api/test/senha-provisoria.int.test.ts`

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 4: o 404 do professor de outra turma tem de vir antes do `ENTRA_PELA_CONTA_DA_ESCOLA`, senão o código revela a conta ligada.

## Fora do escopo desta tarefa

O login com a provisória e a troca (10.0); a tela (12.0); o "ligar" em "Eu" (15.0), que usa a mesma trava.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
