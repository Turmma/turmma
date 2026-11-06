# Tarefa 8.0 — Os itens do dia na Semana e "Ver a semana desta turma"

**Funcionalidade:** semana-do-professor · **Depende de:** 3.0, 6.0
**Subagentes obrigatórios:** `frontend-reviewer`, `conformidade-reviewer`, `test-engineer`
**Porte:** pequeno

## Objetivo

Cada dia da Semana mostra o que aconteceu em cada turma e disciplina da professora (atividade aplicada, encerrada, correção
com o estado), cada item levando ao lugar dele; o Hoje da turma aberta ganha "Ver a semana desta turma".

## Contexto necessário

- `techspec.md` seção 9 ("Itens") e 7b; `cenarios.md` T5, T6
- `prd.md` RF4 e RF7
- `docs/interface.md` 1.8 (6.0): medidas e textos; não edite
- `.claude/rules/70`, item 7: nada de nota, acerto ou nome de aluno no item
- Os rótulos estão em `packages/shared/src/semana/` (2.0); esta tarefa não toca `packages/shared`
- `apps/web/src/paths.ts:64` (`caminhoDaCorrecaoDoProfessor`) e a aba `?aba=atividades&atividade=<id>` da turma aberta (`Turma.test.tsx:104`)
- `apps/web/src/areas/professor/turmas/TurmaHoje.tsx`

## Subtarefas

- [ ] 8.1 — `ItensDoDia` embaixo das aulas do dia, com os rótulos de `packages/shared`, filtrados pelo `?turma=`
- [ ] 8.2 — O item da atividade leva ao painel da atividade na turma; o da correção, à revisão (o endereço do sino)
- [ ] 8.3 — "Ver a semana desta turma" no `TurmaHoje`, para `?ver=semana&turma=<turmaId>.<disciplinaId>`
- [ ] 8.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/areas/professor/turmas/semana/ItensDoDia.tsx`, `apps/web/src/areas/professor/turmas/semana/ItensDoDia.test.tsx` | novo |
| `apps/web/src/areas/professor/turmas/semana/DiaDaSemana.tsx` | alterado |
| `apps/web/src/areas/professor/turmas/TurmaHoje.tsx`, `apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx` | alterado |
| `e2e/professor-semana-itens.spec.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| T6: o item da atividade abre o painel da atividade na turma certa | e2e | RF7 | |
| T6: o item da correção abre a revisão | e2e | RF7 | |
| T5: "Ver a semana desta turma" leva à Semana só com a turma | e2e | RF4 | |
| turma aberta com duas disciplinas da professora: o link leva a da turma aberta | e2e | disciplina | |
| os rótulos vêm da tabela de `packages/shared`, sem texto local | unidade | uma fonte | |
| nenhuma palavra de `VOCABULARIO_DE_NOTA` nem nome de aluno nos itens | e2e | regra 70, item 7 | |
| com `?turma=`, os itens de outra turma ou disciplina somem | e2e | filtro | |
| item é link com nome acessível (tipo, título, estado) e alvo de 24 × 24 | e2e | acessibilidade | |
| o link do item clicado duas vezes abre o painel uma vez | e2e | mesma entrada | |
| cabe a 1366 × 768 com itens: `soOPainelDaAbaRola` | e2e | RF22 | |
| 360 px com itens, sem rolagem horizontal | e2e (`celular`) | D51 | |

Recomeço: a segunda pessoa, a resposta atrasada e a falha vêm do mesmo `GET` e já estão provadas na 6.0; diga isso em meia
linha no plano.

## Como testar

- Atividade e lote de verdade: `criarAtividadeNoBanco` (`e2e/support/atividade-db.ts:47`)
- O caminho para a correção: `e2e/professor-turma-aberta.spec.ts › com lote aprovado, Atividades mostra a atividade encerrada e o caminho para a correção`
- Vocabulário e altura: `VOCABULARIO_DE_NOTA` e `soOPainelDaAbaRola` (`e2e/support/professor/scenario.ts`)
- Unidade do Hoje: `apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx`
- Comando: `node tools/ci/e2e.ts --manter-ambiente e2e/professor-semana-itens.spec.ts`
- Telas: `professora`, `/professor/turmas?ver=semana` com itens; `/professor/turmas/<id>` (Hoje) com o link

## Autoconferência

As 12 perguntas do modelo, no plano. Na 2: "Ver a semana desta turma" é texto novo; procure os specs do Hoje que contam links.

## Fora do escopo desta tarefa

A leitura dos itens (3.0); o painel da aula (7.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
