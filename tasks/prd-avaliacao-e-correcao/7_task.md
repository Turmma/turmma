# Tarefa 7.0 — Tutor travado por aluno até o fim da janela ou o limite dele

**Funcionalidade:** avaliacao-e-correcao · **Depende de:** 2.0
**Subagentes obrigatórios:** `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian`
**Porte:** grande

## Objetivo

O Tutor trava para cada aluno do `abre_em` até o fim da janela (com as extensões da turma) ou o limite dele, o que vier
depois; prova de amanhã não trava; a segunda chamada trava só o convocado.

## Contexto necessário

- `techspec.md` §5.4, §5.10, §7
- `prd.md` §6 ("Prova aberta trava o Tutor"); decisão do Joaquim na Tech Spec ("só na janela")
- `cenarios.md` §2 (as linhas do Tutor, a memória do Tutor), §1 RF6 (a lacuna aberta no Tutor)
- `revisao-spec.md` rodada 4: na lacuna aberta, o limite original é o `fecha_em` e já passou
- `apps/api/src/tutor/tutor.repository.ts` (`avaliativaAberta`) e `TUTOR_PAUSADO_EM_AVALIACAO`
- `.claude/rules/70` itens 4 e 4c; `30` item 10

## Subtarefas

- [ ] 7.1 — `avaliativaAberta(turmaId)` vira por aluno: pela janela efetiva da turma ou pelo limite dele
  (`limiteDaTentativa`); sem janela, como hoje; o convocado da segunda chamada pela tabela de convocados
- [ ] 7.2 — A consulta pelo índice `(escola_id, turma_id)`, com a latência medida (roda a cada turno)
- [ ] 7.3 — A memória do Tutor não seleciona tempo adicional, saídas nem limite
- [ ] 7.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/tutor/tutor.repository.ts` | alterado |
| `apps/api/src/tutor/tutor.service.ts` | alterado |
| `apps/api/src/tutor/tutor-trava-da-prova.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| Prova de amanhã | integração | não trava | `abre_em` no futuro | |
| Dentro da janela | integração | trava a turma, só ela | a outra turma da escola | |
| Depois do fim efetivo | integração | destrava | a aplicação segue `aberta` (a rotina não rodou) | |
| Aluno estendido além do `fecha_em` | integração | segue travado até o limite dele; o colega destrava | trava só pelo `fecha_em` fica vermelho | |
| Indisponibilidade fechada empurrando o limite além do `fecha_em` | integração | segue travado | a mesma cena sem a indisponibilidade destrava | |
| Lacuna aberta montada à mão | integração | segue travado além do limite original (= `fecha_em`, já passado) | tique parado e relógio da recusa injetado ainda fresco; sem a lacuna, destrava | |
| Segunda chamada aberta | integração | trava o convocado, não o colega | convocado semeado no banco | |
| Memória do Tutor | integração | sem tempo adicional, saídas nem limite | aluno com +50%, 7 saídas e extensão; o prompt capturado no adaptador falso não traz nenhum | |
| Avaliativa sem janela | integração | trava enquanto aberta; encerrada, destrava | `abre_em` nulo semeado no banco | |
| Extensão da turma, aluno sem tentativa | integração | travado até `fecha_em` + extensão | sem a extensão, destrava | |
| Repository no contexto da A com turma e aluno da B, prova da B na janela | integração | não trava | a B travada no contexto dela | |
| Latência da trava | integração | `EXPLAIN` pelo índice | o `.toSQL()` | |

## Como testar

- Trava: `apps/api/src/tutor/tutor.int.test.ts › trava o Tutor para os alunos da turma, e só para ela; encerrada,
  destrava` e `› abre entre o 202 e a execução…`
- Convocado e tentativa semeados direto no banco (a 9.0 faz a rota)
- `npx vitest run --project integracao apps/api/src/tutor/tutor-trava-da-prova.int.test.ts`

## Autoconferência

As perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`).

## Fora do escopo desta tarefa

A rota da segunda chamada (9.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
