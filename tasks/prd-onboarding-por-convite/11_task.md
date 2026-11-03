# Tarefa 11.0 — Gravar a grade gera a alocação e os vínculos que o professor confirma

**Funcionalidade:** onboarding-por-convite · **Depende de:** 6.0, 7.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

A planilha de grade (turma, disciplina, professor, dia, início, fim, sala) grava a `alocacao` e, para cada turma ×
disciplina × professor sem vínculo, um vínculo pendente (`origem = grade`) que o professor confirma ou contesta (A1).
Turma, disciplina e professor inexistentes nascem ao gravar; conflito de horário é aviso.

## Contexto necessário

- `techspec.md` §3 (`alocacao`, `vinculo.origem`), §5 "Gravar" ("Grade": reaproveita o vínculo aberto ou cria um
  pendente; o do ano planejado só se confirma em curso), "O job" passo (1) (o professor novo)
- `prd.md` RF7, RF8; PRD §7 ("Professor discorda", "Grade com professor não convidado", "ano planejado")
- `cenarios.md` "RF7 e RF8"; regra 60 itens 8 e 8a
- Arquivo do titular (regra 20, item 19; `docs/lgpd.md`, linha da aula da grade: o titular é o professor): a 2.0 deixou a `alocacao` fora
  dele (`packages/shared/src/privacidade/classificacao.ts`, comentário da `alocacao`); esta tarefa, que a grava, põe no arquivo do
  professor a leitura das aulas dele pelo vínculo (dia, horário e sala), com o caso em `apps/api/test/arquivo-do-titular.int.test.ts`
- Código: os tipos professores (6.0) e alunos (7.0, a turma nova); `packages/core/src/estrutura/vinculo.repository.ts`;
  `apps/api/test/vinculo.int.test.ts`

## Subtarefas

- [ ] 11.1 — Tipo grade: classificação (horário impossível é erro; linha sem professor é erro; professor em duas turmas e turma com duas aulas no mesmo horário são aviso; turma, disciplina e professor "novo")
- [ ] 11.2 — Gravar: `alocacao`; vínculo pendente `origem = grade`, ou o vínculo aberto reaproveitado; o encerrado não reabre; o contestado não volta
- [ ] 11.3 — O vínculo pendente do ano planejado só se confirma com o ano em curso
- [ ] 11.4 — Passo (3): vínculos e professores relidos; `vinculo_ativo_unico` violado: `desatualizada` na mesma execução
- [ ] 11.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/importacao/tipos/grade.ts` | novo |
| `packages/core/src/importacao/motor.ts`, `index.ts` | alterado |
| `packages/core/src/estrutura/vinculo.repository.ts` | alterado |
| `apps/api/src/estrutura/vinculo/vinculo.service.ts` | alterado |
| `apps/worker/test/gravar-planilha-grade.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| Tripla sem vínculo vira vínculo pendente com `origem = grade` | integração | caminho feliz (RF8) | |
| Professor em duas turmas no mesmo horário: aviso, e grava | integração | RF7 | |
| Turma com duas aulas no mesmo horário: aviso, e grava | integração | RF7 | |
| Aula das 9h às 8h: erro | integração | RF7 | |
| Linha sem professor: erro | integração | | |
| Professor com duas disciplinas na turma: dois vínculos pendentes | integração | borda | |
| Disciplina e professor inexistentes: "novo" na prévia, e nascem ao gravar | integração | RF7 | |
| Antes de confirmar, o professor não alcança a turma | integração | RF8 | |
| Vínculo confirmado não muda | integração | RF8 | |
| Vínculo feito à mão com a mesma tripla é reaproveitado, sem pendente duplicado | integração | | |
| Vínculo encerrado com a mesma tripla não reabre: nasce um pendente | integração | vínculo encerrado e aberto | |
| Reimportar não reabre o contestado | integração | borda do PRD | |
| Vínculo pendente do planejado: o professor não o vê nem confirma; com o ano em curso, confirma | integração | ano | |
| [P] Vínculo reaproveitado encerrado à mão entre o (2) e o (3): `desatualizada`, nenhuma alocação em vínculo encerrado | [P] | releitura | |
| [P] Vínculo à mão com a mesma tripla criado entre o (2) e o (3): `desatualizada` na mesma execução | [P] | tentativa 1 | |
| [P] Professor da grade desativado entre o (2) e o (3): `desatualizada` | [P] | | |
| [P] T1 e T2 contra o `desativar` do professor das duas: zero `40P01`; o espião vê um único `order by id` | [P] | ordem | |
| Falha no segundo lote de 1.200 linhas: zero turmas e vínculos; a conta solta perde o e-mail no `sistema.expurgar-acesso` | integração | | |
| Professor sobe a grade: recusado | integração | permissão | |
| Auditoria `vinculo.criado` da grade, com a origem | integração | RF17 | |

## Como testar

- Vínculo e confirmação: `apps/api/test/vinculo.int.test.ts` (confirmar e contestar da A1); escopo do professor: `apps/api/test/acesso-da-turma.int.test.ts`
- Job: o molde de `apps/worker/test/gravar-planilha.int.test.ts` (4.0); barreira: `WriteBlockTrigger`; espião: o da 3.0
- Comando: `npx vitest run --project integracao apps/worker/test/gravar-planilha-grade.int.test.ts`
- Armadilha (rodada 8): o único violado se prova com o processor chamado uma vez

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3, a mesma tripla com um vínculo encerrado e outro aberto.

## Fora do escopo desta tarefa

Reimportar a grade e ler a grade (12.0); o convite por e-mail do professor novo (F2c).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
