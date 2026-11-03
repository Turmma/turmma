# Tarefa 3.0 — Desativar encerra os vínculos e revoga o convite, na ordem global

**Funcionalidade:** onboarding-por-convite · **Depende de:** 1.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

O `desativar` de uma pessoa na escola encerra os vínculos dela (no ano em curso e no planejado) e revoga o convite
aberto (N1 da A1), travando na ordem global que o job da planilha também segue; o `eliminar` segue a mesma ordem.
Professor desativado em março não vê a turma em outubro (regra 20, item 18).

## Contexto necessário

- `techspec.md` §2 (linha `packages/core/src/ciclo-de-vida/`), §5 "O job", passo (3) (a ordem global: importação, ano,
  usuários, contas, turmas por id num comando, pedidos)
- `prd.md` RF5, RF6; `revisao-spec.md` rodada 8, recomendações da rodada 7 (ano em `FOR SHARE` contra o `virarAno` e o
  `virarSala`; o `eliminar` sem ano no contexto)
- Regra 20 item 18; regra 80 item 7
- Código: `packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts` (`desativar`, `eliminar`),
  `ciclo-de-vida.repository.ts` (`travarContraOGerarDoProfessor`); o `encerrar` em
  `packages/core/src/estrutura/vinculo.repository.ts` (da 1.0); `apps/api/src/estrutura/ano-letivo/ano-letivo.repository.ts`
  (`virarSala`)

## Subtarefas

- [ ] 3.1 — `desativar` encerra os vínculos da pessoa na escola pelo `encerrar` (que revoga o acesso da turma), com as turmas travadas em ordem de id num comando só (`FOR NO KEY UPDATE … order by id`)
- [ ] 3.2 — `desativar` revoga o convite aberto do professor
- [ ] 3.3 — Ordem global no `desativar` e no `eliminar`: ano em `FOR SHARE` antes dos usuários e das turmas; o `eliminar` sem ano no contexto trava os anos da escola que tocam
- [ ] 3.4 — `docs/lgpd.md`, linha "Acesso da turma": a desativação revoga
- [ ] 3.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts`, `ciclo-de-vida.repository.ts` | alterado |
| `packages/core/src/estrutura/vinculo.repository.ts` | alterado |
| `apps/api/test/ciclo-de-vida.int.test.ts`, `apps/api/test/acesso-fim-do-vinculo.int.test.ts` | alterado |
| `docs/lgpd.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| Professor desativado: os vínculos da escola são encerrados e ele não alcança a turma | integração | caminho feliz | |
| O `desativar` revoga o convite aberto; o aceite depois é recusado | integração | N1 da A1 | |
| O acesso da turma gerado por ele é revogado | integração | passa pelo `encerrar` | |
| Vínculos no ano em curso e no planejado: todos encerrados | integração | ano | |
| Escola sem ano em curso: o vínculo do planejado é encerrado | integração | ano | |
| Espião no SQL: um único `for no key update … order by id` sobre as turmas | integração | trava num comando só | |
| Espião: a ordem global no `desativar` | integração | ordem | |
| Espião: a ordem global no `eliminar` | integração | ordem | |
| [P] `desativar` contra `virarSala` na mesma turma, com barreira: um espera o outro, zero `40P01` | [P] | ordem global | |
| [P] `desativar` contra `virarAno`: nenhum vínculo aberto no ano novo | [P] | ano em `FOR SHARE` | |
| Desligado na escola A segue entrando e vendo as turmas na B | integração | isolamento (RF16) | |
| A coordenação de B não desativa a pessoa de A: igual a inexistente | integração | isolamento | |
| Log do `desativar`, se houver: só ids | integração | regra 20, item 9 | |

## Como testar

- Molde: `apps/api/test/ciclo-de-vida.int.test.ts › caminho feliz (RF5; regra 20, item 18): o aluno desativado tem o hash da senha apagado, …`; revogação: `apps/api/test/acesso-fim-do-vinculo.int.test.ts › encerrar o último vínculo do professor na turma revoga o acesso que ele gerou, …`
- Barreira: `WriteBlockTrigger` e `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`); trava da escola: `segurarTravaDaEscola`, `emOrdemNaTrava` (`apps/api/test/escola-lock.ts`)
- Espião no SQL: **sem precedente** no repositório. O mais próximo é o `vi.spyOn(hash, 'verificar')` de `apps/api/test/sessao-matricula.int.test.ts`; aqui, o espião vai no `query` do pool (`packages/core/src/db/pool.ts`) e confere a ordem dos `for … update/share`
- Comando: `npx vitest run --project integracao apps/api/test/ciclo-de-vida.int.test.ts`
- Armadilha: nos [P] que dependem do `lock_timeout`, confira só o estado final

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3, o professor tem vínculo em duas turmas e em dois anos.

## Fora do escopo desta tarefa

Cancelar o envio por e-mail e anular a senha provisória (F2c); o desligamento pela planilha (6.0 e 10.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
