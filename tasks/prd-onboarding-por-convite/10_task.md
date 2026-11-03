# Tarefa 10.0 — A coordenação desliga o aluno pela planilha, e o aprovado volta na virada do ano

**Funcionalidade:** onboarding-por-convite · **Depende de:** 3.0, 9.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

O aluno aprovado marcado "fora da planilha" é desligado pelo `desativar` (vínculos encerrados, sessões derrubadas); o
não aprovado sai da `lista_nome` e o pedido dele é encerrado. Na planilha do ano planejado, o aluno aprovado do ano
anterior "volta", confirmado na turma nova com o mesmo login.

## Contexto necessário

- `techspec.md` §5 "O job" passo (3) (a ordem global, que o `desativar` e o `eliminar` também seguem), "Gravar"
  ("desligar o aprovado", "o não aprovado apaga a `lista_nome`", "Virada de ano")
- `prd.md` RF4, RF5, RF16, RF17; regra 20 item 18; regra 60 item 5
- `cenarios.md` RF5 (desligamento), "Virada de ano"
- Código: o `desativar` da 3.0; o `fechar('encerrada')` da 9.0; `packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts`

## Subtarefas

- [ ] 10.1 — Marca "fora da planilha" do aprovado: `desativar` dentro da transação do passo (3), na ordem global
- [ ] 10.2 — Não aprovado: apaga a `lista_nome` depois do `fechar('encerrada')`; auditoria `lista_nome.retirado` sem nome
- [ ] 10.3 — Virada: aprovado sem vínculo no ano de destino "volta" (vínculo confirmado, `vinculo.criado`); desativado é erro na linha
- [ ] 10.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/importacao/tipos/alunos.ts` | alterado |
| `packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts` | alterado |
| `apps/worker/test/desligamento-pela-planilha.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| Ausente sem marca: segue ativo | integração | RF4 | |
| Ausente com marca: desligado | integração | caminho feliz (RF4, RF5) | |
| O desligado não entra por matrícula | integração | RF5 | |
| As sessões do desligado caem | integração | regra 20, item 18 | |
| Nome não aprovado desligado sai da lista, o pedido fica `encerrada`, `lista_nome.retirado` sem nome | integração | RF5 | |
| [P] Reivindicação parada contra o (3) do desligamento: nunca pendente com o nome nulo | [P] | | |
| [P] Desligamento de não aprovado contra a decisão do mesmo pedido: `encerrada` ou decidido; nunca `falhou` pelo check | [P] | | |
| [P] Aluno a desligar desativado à mão entre o (2) e o (3): `desatualizada` | [P] | releitura | |
| [P] O (3) corrigindo o nome e desligando X, com barreira, contra a coordenação desativando e eliminando X: zero `40P01` na requisição; o espião confere a ordem global no job | [P] | ordem global | |
| Virada: aprovado do ano encerrado "volta", com o mesmo login | integração | ano | |
| Na volta, o vínculo do ano encerrado fica intacto | integração | vínculo encerrado e aberto | |
| Virada: aluno desativado na planilha é erro na linha | integração | ano | |
| Auditoria `usuario.desativado` | integração | RF17 | |
| Auditoria `vinculo.criado` do aluno que volta | integração | RF17 | |

## Como testar

- Desligar: `apps/api/test/ciclo-de-vida.int.test.ts › caminho feliz (RF5; regra 20, item 18): o aluno desativado tem o hash da senha apagado, a sessão aberta dá 401 na requisição seguinte, e o colega segue entrando`
- Login por matrícula: `apps/api/test/sessao-matricula.int.test.ts › privacidade (regra 20, item 6): slug inexistente, …, aluno desativado e senha errada dão o mesmo status e o mesmo corpo, …`
- Virada: `apps/api/test/virada-do-ano.int.test.ts › caminho feliz: …`
- Espião no SQL e barreira: os da 3.0 (`apps/api/test/ciclo-de-vida.int.test.ts`) e `WriteBlockTrigger`
- Comando: `npx vitest run --project integracao apps/worker/test/desligamento-pela-planilha.int.test.ts`
- Armadilha: nos [P] que dependem do `lock_timeout`, só o estado final

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3, a virada precisa de um ano encerrado com vínculo e de um planejado sem.

## Fora do escopo desta tarefa

A tela das marcas (13.0); a conta da escola do aluno desligado (F2c).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
