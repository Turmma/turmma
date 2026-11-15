# Tarefa 9.0 — A professora vê quantas perguntas o Tutor não respondeu hoje, sem o texto

**Funcionalidade:** reengenharia-continuacao · **Depende de:** 8.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `frontend-reviewer`
**Porte:** grande

## Objetivo

O `GET /v1/tutor/uso` ganha, por aluno, `semRespostaHoje`: as perguntas de hoje terminadas num código de `PASSAGEIROS`,
sem mensagem fixa, no recorte das `ultimasTrocas`, sem texto. Na aba do Tutor da turma, a linha diz "N perguntas que o
Tutor não respondeu hoje", neutra e separada do freio (D8, D47).

## Contexto necessário

- `techspec.md` §2 (linha `supervisao.repository.ts`), §4, §5 "A pergunta sem resposta (RF5)", §7b
- `prd.md` RF5; §8b; regras 10, 20 (4, 14), 40, 50, 70 (4, 7)
- Código: `apps/api/src/tutor/supervisao.repository.ts` (`ultimasTrocas` l.220, `FUSO_DO_USO` l.267);
  `apps/api/src/tutor/supervisao.service.ts`; `packages/shared/src/tutor/uso.ts` (`trocasHoje` l.39);
  `packages/shared/src/tutor/passageiros.ts` (4.0); `apps/web/src/areas/professor/turmas/TurmaHoje.tsx` (o uso com `?ver=tutor`);
  `docs/lgpd.md:52` ("Uso do Tutor por aluno"); `docs/aia/tutor.md` (N21)

## Subtarefas

- [ ] 9.1 — `semRespostaHoje` no repository (§5); a última pergunta passa a incluí-las
- [ ] 9.2 — `semRespostaHoje` no `usoDoTutorSchema` de `shared`, e no DTO de saída
- [ ] 9.3 — A linha do aluno em `TurmaHoje.tsx`; com 0, nada
- [ ] 9.4 — `docs/lgpd.md:52` e a N21 da AIA dizem que a professora vê a contagem, sem texto; `docs/interface.md`, a aba do
  Tutor na turma
- [ ] 9.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/tutor/sem-resposta.int.test.ts` | novo |
| `apps/api/src/tutor/supervisao.repository.ts`, `apps/api/src/tutor/supervisao.service.ts`, `packages/shared/src/tutor/uso.ts`, `apps/web/src/areas/professor/turmas/TurmaHoje.tsx`, `apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx`, `e2e/a3-a4-professor.spec.ts`, `apps/api/test/contracts.test.ts`, `docs/lgpd.md`, `docs/aia/tutor.md`, `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| contagem | I | duas cortadas e uma respondida: `semRespostaHoje` 2, `trocasHoje` 1, sem texto no DTO; o aluno só com cortada aparece. Mutação: manter o filtro de `falhou` | |
| os outros passageiros | I | um de cada: `EXECUCAO_INTERROMPIDA`, `IA_TEMPO_ESGOTADO`, `IA_SAIDA_INVALIDA`, `PEDIDO_ACIMA_DO_TETO`, a recusa da D62. Mutações: contar só o corte; só `IA_INDISPONIVEL` | |
| a lista inteira | I | parametrizado sobre `PASSAGEIROS` importada, sem filtro: cada código, inclusive `ERRO_INTERNO` e `IA_ENTRADA_INVALIDA`, dá +1. Mutação: lista copiada no repository | |
| o dia | I | "agora" às 10h de Brasília; cortada ontem às 23h50: não conta. Mutações: sem o filtro de dia; o dia em UTC | |
| não contam | I | S12, `FUNCAO_SUSPENSA`, `NAO_ENCONTRADO` e a que recebeu a mensagem fixa. Mutação: contar todo `falhou` | |
| o recorte | I | outra disciplina, outra turma, ano anterior: não aparece; duas disciplinas na turma: as duas. Mutação: tirar o recorte | |
| aluno transferido hoje | I | a pergunta cortada na turma antiga não aparece na nova | |
| reenviada | I | a cortada conta, a reenviada e respondida entra em `trocasHoje` | |
| isolamento | I | a cortada de um aluno da B, com a professora da A: não aparece; o `GET` da B igual ao inexistente | |
| contrato | U | `contracts.test.ts`: o DTO só com os campos declarados | |
| a linha | U | "2 perguntas que o Tutor não respondeu hoje", neutra, separada do "X de Y"; com 0, nada | |
| 1366 × 768 e 360 px | E | a aba do Tutor da turma com a linha: `soOPainelDaAbaRola` a 1366; sem rolagem horizontal, 44 px, axe a 360; `VOCABULARIO_DE_NOTA`. O uso vem de `page.route` | |

## Como testar

- Uso: `apps/api/src/tutor/tutor.int.test.ts` › "a professora vê quem usou, em ordem de nome, com as trocas do dia e a última
  referência…" (l.786); recorte: › "a professora com Química e Física na mesma turma vê os sinais e o uso das duas…" (l.1033)
  e › "a professora com vínculo confirmado na turma do ano anterior não lê…" (l.1015)
- Isolamento: › "sinais e uso: a professora de outra turma, a de outra escola, a coordenação e o aluno recebem a resposta do
  inexistente" (l.887)
- As falhas se semeiam pelo caminho real (a bancada da 5.0), salvo a lista parametrizada
- Tela: `TurmaHoje.test.tsx` › "sem `?ver=tutor` só a leitura dos sinais é do Tutor…" (l.446); `e2e/support/professor/scenario.ts`
  (`soOPainelDaAbaRola`, `VOCABULARIO_DE_NOTA`)
- Comando: `npx vitest run --project integracao apps/api/src/tutor/sem-resposta.int.test.ts`
- **Telas:** `professora`, a turma com `?ver=tutor`, um aluno com 2 sem resposta e outro com 0

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3: aluno com pergunta em cada código e em cada estado. Na 5: o "com 0, nada" espera
a resposta do uso. Na 10: o caso do dia passa às 23h59 e no domingo.

## Fora do escopo desta tarefa

O freio do dia e o `trocasHoje` (não mudam).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar
