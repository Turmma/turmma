# Tarefa 11.0 — Painel "Acompanhar" e o e2e do professor

**Funcionalidade:** avaliacao-e-correcao · **Depende de:** 5.0, 8.0, 9.0, 10.0
**Subagentes obrigatórios:** `privacy-guardian`, `frontend-reviewer`
**Porte:** grande

## Objetivo

No painel da atividade, o professor acompanha a prova por aluno, estende, abre a segunda chamada e encerra sabendo
quantos ainda fazem; o e2e prova a prova online do lado dele, de aplicar a aprovar.

## Contexto necessário

- `techspec.md` §9
- `prd.md` RF4, RF10; §7 (professor encerra antes do fim)
- `cenarios.md` §1 RF5 (encerrar), §4 (Acompanhar, Estender, Segunda chamada, Encerrar, 360 px), §4b
  (`professor-prova.spec.ts`)
- `docs/interface.md` §1.7; `.claude/rules/50`
- `apps/web/src/areas/professor/atividades/AtividadesDaTurma.tsx` e `EncerramentoDaAtividade.tsx`

## Subtarefas

- [ ] 11.1 — "Acompanhar": lê `acompanhamento` a cada 15 s, só à vista; situação em texto, no fuso da escola; dois alunos
  de mesmo nome distinguidos; nunca na tela da sala; cartões a 360 px
- [ ] 11.2 — "Estender" (aluno ou a turma toda, com o efeito antes de confirmar); "Segunda chamada" (convocados por nome,
  janela, duração, tempo adicional, em lista de uma coluna a 360 px)
- [ ] 11.3 — "Encerrar" com "3 alunos ainda estão fazendo…"
- [ ] 11.4 — `docs/interface.md` §1.7
- [ ] 11.5 — Testes e `e2e/professor-prova.spec.ts`

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/areas/professor/atividades/Acompanhamento.tsx` | novo |
| `apps/web/src/areas/professor/atividades/Acompanhamento.test.tsx` | novo |
| `apps/web/src/areas/professor/atividades/Estender.tsx` | novo |
| `apps/web/src/areas/professor/atividades/SegundaChamada.tsx` | novo |
| `apps/web/src/areas/professor/atividades/EncerramentoDaAtividade.tsx` | alterado |
| `apps/web/src/areas/professor/atividades/AtividadesDaTurma.tsx` | alterado |
| `apps/web/src/areas/professor/atividades/api/acompanhamento.ts` | novo |
| `e2e/professor-prova.spec.ts` | novo |
| `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| Estados do Acompanhar | unidade web | carregando, erro com "Tentar de novo", "Não começou", "Fazendo · termina às 10:42", "Enviou", "Tempo esgotado" em texto | | |
| Fuso da escola | unidade web | o horário da escola | o fuso do navegador diferente | |
| Mesmo nome | unidade web | os dois distinguidos | | |
| Estender | unidade web | "Ana termina às 10:52 em vez de 10:42" antes de confirmar | | |
| Segunda chamada | unidade web | os convocados por nome e a janela antes de confirmar | | |
| Encerrar | unidade web | "3 alunos ainda estão fazendo…" | com 0, sem a frase | |
| Recomeço | e2e | a resposta atrasada do acompanhamento anterior não sobrescreve | `page.route` segurando | |
| 360 px e 1366 × 768 | e2e | cartões, sem rolar de lado; `paginaNaoRola` | | |
| `professor-prova.spec.ts` | e2e | aplica com janela e tempo adicional, acompanha, estende; o aluno faz (pela API) e sai da aba uma vez; encerra pelo botão; aprova com "1" na coluna e o aviso; axe | coluna sem o aviso; contagem errada | |

## Como testar

- `apps/web/src/areas/professor/atividades/EncerramentoDaAtividade.test.tsx`
- O aluno pela API: `e2e/support/aluno-api.ts`; o banco: `e2e/support/atividade-db.ts`
- `node tools/ci/e2e.ts --manter-ambiente e2e/professor-prova.spec.ts`
- **Telas:** professora · a turma aberta · `text=Atividades` → a prova → "Acompanhar"; "Estender"; "Segunda chamada"

## Autoconferência

As perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`).

## Fora do escopo desta tarefa

A tela do aluno (12.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
