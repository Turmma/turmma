# Tarefa 5.0 — O professor estende o tempo e acompanha quem está fazendo

**Funcionalidade:** avaliacao-e-correcao · **Depende de:** 2.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

O professor estende o tempo de um aluno ou da turma, inclusive além da janela, com dois cliques valendo uma extensão, e
lê por aluno quem não começou, quem está fazendo e até quando, e quem enviou.

## Contexto necessário

- `techspec.md` §4 (`extensoes`, `acompanhamento`), §5.1, §5.4, §5.6 (`estender` toma a aplicação `for share`), §6, §7
- `prd.md` RF4
- `cenarios.md` §1 RF4, §1b (as linhas do professor), §3 (d)
- `revisao-spec.md`: o acompanhamento numa consulta só, sem chamar `limiteDaTentativa` 35 vezes a cada 15 s
- `apps/api/src/atividade/atividade-aplicada/` e a `limiteDaTentativa` da 2.0

## Subtarefas

- [ ] 5.1 — `POST …/:id/extensoes`: `for share` na aplicação, aberta; aluno da turma; minutos de 1 a 120; chave única por
  aplicação (o 23505 devolve o gravado); auditoria `atividade.tempo_estendido` sem minutos por aluno
- [ ] 5.2 — `GET …/:id/acompanhamento`: por aluno, id, nome, situação e `limiteEm`, **sem saídas**, numa consulta
- [ ] 5.3 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.controller.ts` | alterado |
| `apps/api/src/atividade/atividade-aplicada/extensao.service.ts` | novo |
| `apps/api/src/atividade/atividade-aplicada/acompanhamento.repository.ts` | novo |
| `apps/api/src/atividade/atividade.module.ts` | alterado |
| `apps/api/src/atividade/extensao.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| Estender 10 min só para A | integração | A grava depois do limite antigo; B recebe `TEMPO_ESGOTADO` | dois alunos | |
| Estender a turma | integração | todos andam, e o fim efetivo da janela também | o aluno sem tentativa começa depois e tem `limiteEm` = `fecha_em` + extensão | |
| 0 e 121 minutos; prova encerrada | integração | `ENTRADA_INVALIDA`; `ATIVIDADE_ENCERRADA` | 1 e 120 passam | |
| Aluno de outra turma, de outra escola, inexistente | integração | a mesma resposta, nada gravado | três ids | |
| Mesma chave em outra aplicação | integração | outra extensão | a chave é por aplicação | |
| Corrida (d) | integração | uma linha, um limite; a segunda devolve o gravado; chave nova grava outra | a primeira segurada com `WriteBlockTrigger` | |
| Acompanhamento | integração | as quatro situações, com `limiteEm` com extensão e indisponibilidade | um aluno em cada | |
| Acompanhamento sem saídas | unidade | o contrato não tem `saidas` | `apps/api/test/contracts.test.ts` | |
| Auditoria | integração | sem minutos nem percentual por aluno | 17 min a um aluno: nem `17` nem `alunoId` no detalhe | |
| Estender × encerrar | integração | o encerrar segurado; a extensão espera e recebe `ATIVIDADE_ENCERRADA`, sem linha | sem `for share`, grava | |
| Repository do acompanhamento e da extensão chamado direto: contexto da A com ids da B; ano anterior | integração | vazio | sem passar pela rota | |
| Professor de B, sem vínculo, outra disciplina; vínculo encerrado em X e aberto em Y; aluno e coordenação | integração | `NAO_ENCONTRADO` ou a matriz | ids da B no contexto da A | |
| Escola sem ano em curso | integração | `NAO_ENCONTRADO` no `:id` | | |
| Consulta do acompanhamento | integração | `EXPLAIN` pelo índice | o `.toSQL()` do repository | |

## Como testar

- Isolamento: `apps/api/src/atividade/atividade-isolamento.int.test.ts › encerrar, ler a correção, abrir destaque e
  aprovar o lote, por quem não é a professora…`
- Idempotência por chave: `apps/api/test/painel-escrita.int.test.ts › E2: o mesmo pedido duas vezes, ao mesmo tempo…`
- `EXPLAIN`: `apps/api/test/semana-itens.int.test.ts` (`consultasDosItens`)
- `npx vitest run --project integracao apps/api/src/atividade/extensao.int.test.ts`

## Autoconferência

As perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`).

## Fora do escopo desta tarefa

A tela (11.0); a corrida estender × rotina (6.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
