# Tarefa 4.0 — Embaralhamento por aluno, mantido na retomada, corrigido pela ordem original

**Funcionalidade:** avaliacao-e-correcao · **Depende de:** 3.0
**Subagentes obrigatórios:** `tenancy-guardian`, `conformidade-reviewer`
**Porte:** pequeno

## Objetivo

Com "embaralhar" ligado, cada aluno recebe questões e alternativas numa ordem própria, a mesma na retomada, e a correção,
o relatório e o diagnóstico continuam pela ordem original.

## Contexto necessário

- `techspec.md` §1, §5.3 (o sorteador injetável), §4 (`prova` na ordem dele)
- `prd.md` RF8
- `cenarios.md` §1 RF8, §3 (a)
- `apps/api/src/atividade/minha-atividade/minha-atividade.service.ts` (o `comecar` da 3.0)
- `apps/api/src/atividade/correcao/correcao-de-objetiva.ts`: a correção pelo número da questão e da alternativa

## Subtarefas

- [ ] 4.1 — Sorteador injetável (`crypto.randomInt` em produção); `ordem` gravada no `comecar`, só na primeira; nula sem
  embaralhar; só alternativas mantém as questões na ordem original
- [ ] 4.2 — `prova` devolve na ordem do aluno, com o número original de questão e alternativa
- [ ] 4.3 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/atividade/minha-atividade/minha-atividade.service.ts` | alterado |
| `apps/api/src/atividade/minha-atividade/ordem-da-prova.ts` | novo |
| `apps/api/src/atividade/minha-atividade/ordem-da-prova.test.ts` | novo |
| `apps/api/src/atividade/embaralhamento.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| Sorteio fixo, dois alunos | integração | ordens diferentes e conhecidas; a certa pelo índice original acerta nos dois | sequência injetada | |
| Desempenho por habilidade com a ordem embaralhada | integração | igual ao da ordem original | as duas habilidades do fixture | |
| Só alternativas | integração | questões na ordem original | as alternativas mudam | |
| Sem embaralhar | integração | `ordem` nula, ordem original | | |
| Retomada | integração | a segunda leitura traz a mesma ordem | sorteador que daria outra | |
| Começar × começar com embaralhar | integração | uma `ordem` | a segunda chamada não sorteia de novo | |

## Como testar

- Correção e diagnóstico: `apps/api/test/atividade.fixture.ts` (`GABARITO_DE_TESTE`, `HABILIDADE_DAS_TRES_PRIMEIRAS`,
  `aprovarOLote`); a leitura do desempenho de `apps/api/src/atividade/desempenho/`
- `npx vitest run --project integracao apps/api/src/atividade/embaralhamento.int.test.ts`
- Armadilha: o teste não depende do acaso; o sorteador é injetado com sequência fixa

## Autoconferência

As perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`).

## Fora do escopo desta tarefa

A tela (12.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
