# Tarefa 10.0 — Tela de aplicar a prova; a API passa a exigir a janela

**Funcionalidade:** avaliacao-e-correcao · **Depende de:** 1.0
**Subagentes obrigatórios:** `privacy-guardian`, `frontend-reviewer`
**Porte:** grande

## Objetivo

Ao aplicar como avaliativa, o professor define janela, duração, embaralhar e tempo adicional por aluno, vê o resumo
antes de confirmar, e muda a janela antes do primeiro começo; a API passa a recusar avaliativa nova sem janela.

## Contexto necessário

- `techspec.md` §3 (a janela obrigatória na API), §5.1, §9
- `prd.md` RF1, RF2, RF3
- `cenarios.md` §1 (RF1, avaliativa sem janela; RF3), §4 (Aplicar, Mudar janela, 360 px)
- `.claude/rules/50`; `docs/interface.md` §1.7 (a turma aberta) e §10 (as peças)
- `apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx`
- `docs/roteiro-da-demonstracao.md` passo 220 e `e2e/roteiro-da-demonstracao.spec.ts` (perto da linha 470)

## Subtarefas

- [ ] 10.1 — Os campos com "avaliativa", cada um com rótulo e erro (`FormField`); o tempo adicional por aluno em lista
  de uma coluna a 360 px, sem motivo; o erro do tempo que não cabe com o texto da §4
- [ ] 10.2 — O resumo antes de confirmar; "Mudar janela" no painel da atividade, com resumo, só antes do primeiro início
- [ ] 10.3 — A API: avaliativa nova sem janela é `ENTRADA_INVALIDA`; fixtures de teste e de e2e que aplicam avaliativa
  passam a mandar janela
- [ ] 10.4 — Roteiro da demonstração (passo 220) e `e2e/roteiro-da-demonstracao.spec.ts`; `docs/interface.md` §1.7
- [ ] 10.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx` | alterado |
| `apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx` | novo |
| `apps/web/src/areas/professor/atividades/MudarJanela.tsx` | novo |
| `apps/web/src/areas/professor/atividades/api/atividades.ts` | alterado |
| `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts` | alterado |
| `apps/api/test/atividade.fixture.ts` | alterado |
| `e2e/support/atividade-db.ts` | alterado |
| `e2e/professor-turma-atividades.spec.ts` | alterado |
| `e2e/roteiro-da-demonstracao.spec.ts` | alterado |
| `docs/roteiro-da-demonstracao.md` | alterado |
| `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| Avaliativa nova sem janela | integração | `ENTRADA_INVALIDA` | a não avaliativa sem janela passa; a antiga segue | |
| Resumo | unidade web | "7ºA · abre 24/11 às 10:00 · fecha às 11:40 · 40 min · 2 alunos com tempo adicional" | | |
| Tempo que não cabe | unidade web | o texto da §4, no campo | | |
| Sem campo de motivo | unidade web | nenhum campo além dos da §4 | | |
| Mudar janela | unidade web | aparece só antes do primeiro início; o resumo antes | com alguém começado, some | |
| Estados | e2e | carregando, erro com "Tentar de novo", com dado | | |
| 360 px, sem rolar de lado; cabe a 1366 × 768 | e2e `celular` e `chromebook` | `paginaNaoRola` | | |
| Roteiro | e2e | o passo de aplicar como avaliativa com a janela | | |
| Rótulos e axe | e2e | sem violação | | |

## Como testar

- `apps/web/src/areas/professor/atividades/AtividadesDaTurma.test.tsx` e o e2e `e2e/professor-turma-atividades.spec.ts`
- `paginaNaoRola` de `e2e/support/coordenacao.ts`
- `node tools/ci/e2e.ts --manter-ambiente e2e/professor-turma-atividades.spec.ts`
- **Telas:** professora · `/professor/turmas/…` (a turma aberta) · `text=Atividades` → "Aplicar à turma" → "É avaliativa"

## Autoconferência

As perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`). A 2: procure "Aplicar à turma" em `e2e/`.

## Fora do escopo desta tarefa

O painel "Acompanhar" (11.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
