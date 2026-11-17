# Tarefa 12.0 — "Sem habilidade" em Turmas, no aluno e no Analista, e o fluxo inteiro passa no e2e

**Funcionalidade:** classificacao-bncc · **Depende de:** 11.0
**Subagentes obrigatórios:** `conformidade-reviewer`, `privacy-guardian`, `frontend-reviewer`
**Porte:** grande

## Objetivo

As leituras de hoje mostram a questão sem habilidade como "Sem habilidade", com a explicação curta, sem inventar código
nem somá-la a outra habilidade; e um e2e percorre o fluxo da funcionalidade: a coordenação corrige, o professor gera, vê a
corrigida, troca e aplica, e Turmas mostra a trocada.

**Três telas numa tarefa, por exceção declarada:** a mudança é a mesma linha de texto nas três, e o e2e as atravessa.

## Contexto necessário

- `techspec.md` §5 "Geração" (`codigo: null`), §9 (a linha "Turmas, aluno, Analista")
- `prd.md` RF7, RF9; o critério de pronto no `tasks.md`
- `cenarios.md` "Telas" (o texto de "Sem habilidade" e o [E] do fluxo)
- `docs/interface.md` §1.7 (Turmas), §2 (aluno), §3 (Analista)
- `.claude/rules/`: 50, 70 (itens 4d e 7)
- Código: `apps/web/src/areas/professor/turmas/alunos-da-turma.ts` (`textoPorHabilidade`), `TurmaHoje.tsx` ("Acerto por
  habilidade"), `apps/web/src/areas/aluno/como-estou-indo.ts` e `ComoEstouIndo.tsx`,
  `apps/web/src/areas/coordenacao/governanca/Analista.tsx`, `apps/api/src/governanca/analista.command.ts` (`porHabilidade`)

## Subtarefas

- [ ] 12.1 — "Sem habilidade" com "Esta questão não tem habilidade da BNCC associada." em Turmas (Visão Geral e alunos), no aluno e no Analista; o Analista não junta a linha `null` a nenhuma habilidade nem a usa no alerta
- [ ] 12.2 — A Parte A das três telas no `docs/interface.md`
- [ ] 12.3 — O e2e do fluxo, nos projetos `chromebook` e `celular`
- [ ] 12.4 — O `docs/roteiro-da-demonstracao.md` conferido de novo contra `e2e/roteiro-da-demonstracao.spec.ts`
- [ ] 12.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/areas/professor/turmas/alunos-da-turma.ts`, `apps/web/src/areas/professor/turmas/TurmaHoje.tsx`, `apps/web/src/areas/professor/turmas/AlunosDaTurma.test.tsx`, `apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx` | alterado |
| `apps/web/src/areas/aluno/como-estou-indo.ts`, `apps/web/src/areas/aluno/ComoEstouIndo.tsx`, `apps/web/src/areas/aluno/Eu.test.tsx` | alterado |
| `apps/web/src/areas/coordenacao/governanca/Analista.tsx`, `apps/web/src/areas/coordenacao/governanca/Analista.test.tsx`, `apps/api/src/governanca/analista.command.ts`, `apps/api/src/governanca/analista.int.test.ts` | alterado |
| `e2e/classificacao-bncc.spec.ts`, `docs/interface.md`, `docs/roteiro-da-demonstracao.md` | novo e alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| Turmas, `codigo: null` | U | o texto de "Sem habilidade" | |
| aluno, `codigo: null` | U | o mesmo texto | |
| Analista com `codigo: null` | I | não inventa código, não junta, não alerta por ela | |
| Analista, tela | U | "Sem habilidade" | |
| Turmas e aluno | E | `soOPainelDaAbaRola`; `VOCABULARIO_DE_NOTA` | |
| 360 px | E | 44 px no `celular`, axe | |
| uma ação cheia | — | não se aplica: nenhuma ação nova | |
| recomeço: professor A e depois B na mesma aba | E | nada da A | |
| recomeço: troca de turma com a resposta anterior segurada | E | a anterior não aparece | |
| recomeço: mesma entrada; diálogo | — | não se aplicam: leitura sem link, token nem diálogo | |
| fluxo: a coordenação corrige | E | o painel mostra "Corrigida pela coordenação" | |
| fluxo: o professor gera | E | a questão traz a corrigida | |
| fluxo: troca e aplica | E | a trocada fica | |
| fluxo: Turmas | E | mostra a trocada | |
| fluxo: projetos | E | `chromebook` e `celular`, axe; situação dita em texto | |
| roteiro | E | conferido passo a passo | |

## Como testar

- Turmas: `AlunosDaTurma.test.tsx` › "com dado: os alunos em ordem de nome…" (que hoje lê `QUI.EM.04: 2 de 2`); `TurmaHoje.test.tsx` › "com lote aprovado: uma barra por habilidade…"
- Aluno: `Eu.test.tsx` › "as habilidades a rever vêm como a API mandou: código e descrição, na ordem dela"
- Analista: `analista.int.test.ts` › "o alerta é só o de habilidade com acerto baixo, com o número medido, o limiar e hipótese de lista fechada"; `Analista.test.tsx` › "com dado: assinatura do Analista…"
- Fluxo: `e2e/a3-a4-professor.spec.ts` › "aplica, os alunos respondem, ela encerra…" (o molde do fim); `gerarAtividade` (`e2e/support/professor-flow.ts`)
- Comandos: `npx vitest run --project unidade apps/web/src/areas/professor/turmas/`; `node tools/ci/e2e.ts --manter-ambiente e2e/classificacao-bncc.spec.ts`
- Armadilha: o caso que olha "hoje" ou a semana passa no sábado e às 23h59 de domingo (autoconferência 10)
- Telas: `professora`, Turmas › turma › `text=Visão Geral`; `aluno`, `text=Eu`; `coordenacao`, Governança › `text=Analista`

## Autoconferência

As 12 perguntas do modelo, no plano. Na 2: o texto novo já aparece em `e2e/`?

## Fora do escopo desta tarefa

A cobertura (13.0).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar

