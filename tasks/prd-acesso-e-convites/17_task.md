# Tarefa 17.0 — A leitura do alvo da senha provisória (API)

**Funcionalidade:** acesso-e-convites · **Depende de:** 9.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `test-engineer`
**Porte:** pequeno

Nasceu da divergência da 12.0 (opção A, escolhida pelo Joaquim em 09/11): é a "12a", numerada 17.0 porque as ferramentas do
processo só leem `N.0`. Vem antes da 12.0.

## Objetivo

`GET /v1/usuarios/:usuarioId/senha-provisoria` devolve à coordenação, ou ao professor com vínculo confirmado na turma do aluno, só
`{ nome, turma, matricula, entraPelaContaDaEscola }` daquele aluno, com o escopo da geração e `no-store`, para a confirmação distinguir dois
alunos de mesmo nome; a leitura pela coordenação fica na auditoria.

## Contexto necessário

- `techspec.md` seções 4 e 5 ("O alvo da provisória", "Arquivo do titular"); `cenarios.md` RF13 (os dois [I] da leitura do alvo) e "Auditoria"
- `prd.md` RF13, RF17; `docs/lgpd.md`, linha "Matrícula"
- `.claude/rules/10` itens 3, 4 e 6; `.claude/rules/20` itens 4 e 10
- `apps/api/src/credencial/senha-provisoria.{controller,service}.ts`, `credencial-matricula.repository.ts` (`#alunoQueAlcanca`, `estadoDaProvisoria`)

## Subtarefas

- [ ] 17.1 — O contrato `alvoDaSenhaProvisoriaResponseSchema` (`.strict()`) e a `FINALIDADE_DA_LEITURA_DO_ALVO` em `packages/shared`
- [ ] 17.2 — A leitura no repository, pela mesma seleção do alcance, sem trava: nome, turma do vínculo confirmado no ano em curso (nula sem ano), matrícula (nula sem credencial), conta ligada; sem credencial nem conta, nada
- [ ] 17.3 — A rota no controller (`senha_provisoria.gerar`, `IdPipe`, `no-store`) e o service: 404 igual ao inexistente; `senha_provisoria.alvo_lido` só para a coordenação, na mesma transação da leitura
- [ ] 17.4 — A ação em `acoes.ts`, fora de `ACOES_DO_ARQUIVO_POR_ALVO`, e fora do arquivo de quem assina em `leitura-do-titular.ts` (como a `.gerada`)
- [ ] 17.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/shared/src/sessao/senha-provisoria.ts` | alterado |
| `apps/api/src/credencial/senha-provisoria.controller.ts`, `senha-provisoria.service.ts` | alterado |
| `apps/api/src/credencial/credencial-matricula.repository.ts` | alterado |
| `packages/core/src/auditoria/acoes.ts` | alterado |
| `packages/core/src/titular/leitura-do-titular.ts` | alterado |
| `apps/api/test/senha-provisoria.int.test.ts`, `apps/api/test/arquivo-do-titular.int.test.ts` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| quem lê | [I] | coordenação e professor da turma recebem as quatro chaves, e só elas; `no-store` | |
| escopo | [I] | B pelo contexto da A, outra turma, vínculo pendente/contestado, transferido, desativado, eliminação agendada, professor ou coordenador como alvo, inexistente, id fora do formato: 404 com o mesmo corpo | |
| conta da escola | [I] | só a conta: `matricula` nula e `entraPelaContaDaEscola`; conta e senha: a matrícula e verdadeiro; sem credencial nem conta: 404 | |
| sem ano em curso | [I] | a coordenação lê com `turma` nula; o professor, 404 | |
| auditoria | [I] | coordenação: um `.alvo_lido` por leitura, aluno como alvo, finalidade fixa, sem nome nem matrícula; professor e 404: nenhum | |
| sem efeito | [I] | não gasta cota (a geração seguinte ainda tem as 60/h) e não espera a trava de uma geração em curso | |
| arquivo do titular | [I] | a `.alvo_lido` não aparece no arquivo do aluno nem no do coordenador | |

## Como testar

- Escopo: `apps/api/test/senha-provisoria.int.test.ts` › "professor com vínculo pendente, contestado ou encerrado na turma, e professor de outra turma: 404 igual…" e os vizinhos do bloco "permissão e isolamento" (linhas 232–388): o mesmo arranjo, trocando o `post` por `get`
- Conta da escola: o mesmo arquivo › bloco "conta da escola ligada" (linha 405)
- Sem ano: › "a coordenação gera para o aluno, e o professor recebe 404" (linha 390)
- Trava: `WriteBlockTrigger` e `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`), como no bloco "`CONFLITO` e as cotas"
- Auditoria da leitura: `apps/api/test/importacao-alunos.int.test.ts:330` (consulta da `turma.alunos_lidos`)
- Arquivo: `apps/api/test/arquivo-do-titular.int.test.ts` › "D85: a senha_provisoria.gerada feita pelo professor mostra…" (linha 874)
- Comando: `npx vitest run --project integracao apps/api/test/senha-provisoria.int.test.ts`
- Armadilha desta spec: o 404 do alcance tem de vir antes de qualquer outra diferença (409, corpo), como na 9.0; a migration 0046 mudou depois de aplicada: `EDUCA_BANCO_NOVO=1` antes de migrar

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 6: a mutação que tira a condição do professor do alcance da leitura tem de derrubar um caso.

## Fora do escopo desta tarefa

A tela (12.0). Mudar a geração.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
