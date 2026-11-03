# Tarefa 14.0 — Escola ganha a aba Grade e calendário

**Funcionalidade:** onboarding-por-convite · **Depende de:** 12.0, 13.0
**Subagentes obrigatórios:** `frontend-reviewer`
**Porte:** grande

## Objetivo

Escola ganha a quarta aba, **Grade e calendário**, ao lado de Turmas, Professores e Material: os modelos das quatro
planilhas para baixar, a importação da grade e do calendário pelo `ImportarPlanilha`, a grade por turma (dias ×
horários) e o calendário do ano em curso, com o planejado à escolha.

## Contexto necessário

- `techspec.md` §9 (a aba nova em `Escola.tsx`; a grade, tabela com cabeçalhos, rola no cartão a 360 px), §4 (`GET
  /v1/grade`, `GET /v1/calendario`, o filtro `anoLetivoId`)
- `prd.md` RF1, RF7, RF9, RF10
- `cenarios.md` E2E ("O modelo servido pela tela, preenchido, entra sem erro")
- `docs/interface.md` §3 (Escola: "Grade horária e calendário entram pelo menu de Escola, com o F2"); D73 (o item só
  aparece com a fase dele)
- Código: `apps/web/src/areas/coordenacao/Escola.tsx`, `routes.tsx`; `apps/web/src/paths.ts` (`COORDENACAO_ROUTES`);
  `apps/web/src/areas/navigation.ts` (`tambemEm`); o `ImportarPlanilha` da 13.0; os cabeçalhos em
  `packages/shared/src/importacao/`

## Subtarefas

- [ ] 14.1 — Rota e aba: `COORDENACAO_ROUTES.grade`, a aba em `Escola.tsx`, o lugar Escola aceso por `tambemEm`
- [ ] 14.2 — Modelos para baixar, gerados dos cabeçalhos de `packages/shared`
- [ ] 14.3 — Importar grade (avisos de horário) e calendário (o que entra e o que sai)
- [ ] 14.4 — Grade por turma: tabela com cabeçalhos, troca de turma; calendário do ano, com o seletor do planejado
- [ ] 14.5 — `docs/interface.md` §3 (a aba nova); `docs/roteiro-da-demonstracao.md` conferido contra `e2e/roteiro-da-demonstracao.spec.ts`, se a aba mexer no que ele percorre
- [ ] 14.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx`, `modelos-de-planilha.ts`, `api/grade.ts` | novo |
| `apps/web/src/areas/coordenacao/Escola.tsx`, `routes.tsx` | alterado |
| `apps/web/src/paths.ts`, `apps/web/src/areas/navigation.ts` | alterado |
| `e2e/grade-e-calendario.spec.ts` | novo |
| `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| A aba fica ao lado de Turmas, Professores e Material, e acende Escola | e2e | RF1 | |
| Os modelos baixados têm os cabeçalhos de `packages/shared` | unidade | RF1 | |
| Importar a grade mostra os avisos de horário e grava | e2e | RF7 | |
| Importar o calendário mostra o que entra e o que sai | e2e | RF10 | |
| Grade por turma em tabela com cabeçalhos de dias × horários | e2e | RF1 | |
| A grade rola dentro do cartão a 360 px | e2e | §9 | |
| O calendário do ano em curso, com o seletor do planejado | e2e | RF1, RF16 | |
| Carregando | e2e | estados | |
| Erro com "Tentar de novo" | e2e | estados | |
| Vazio com "Baixar modelo" | e2e | estados | |
| Com dado | e2e | estados | |
| Recomeço: troca de turma com a resposta anterior atrasada: vale a última | e2e | | |
| Recomeço: a segunda pessoa na mesma aba | e2e | | |
| Recomeço: o mesmo arquivo de novo | e2e | | |
| Recomeço: falha com o diálogo de importação aberto | e2e | | |
| 360 px sem rolagem horizontal | e2e | | |
| Cabe em 1366 × 768 sem a página rolar (`paginaNaoRola`) | e2e | | |
| Alvos de 44 e 24 px | e2e | | |
| axe | e2e | | |
| Uma ação cheia por tela | e2e | | |

## Como testar

- Aba de Escola: `e2e/estrutura.spec.ts › uma tabela por série, a marca "Sem professor" e o filtro no endereço, a linha inteira abre a lista da turma, e a página não rola` (`entrarComoCoordenacaoNaMesmaAba`, `abrirEstrutura` de `e2e/support/casca.ts`; `paginaNaoRola`, `irPelaCoordenacao` de `e2e/support/coordenacao.ts`)
- Importação: o spec da 13.0 (`e2e/importar-alunos.spec.ts`)
- Resposta atrasada: `page.route` segurando o `GET /v1/grade` da turma anterior
- Comando: `node tools/ci/e2e.ts --manter-ambiente e2e/grade-e-calendario.spec.ts`
- **Telas:** `coordenacao`, `/coordenacao/grade` (o endereço novo), `text=Grade e calendário` → grade de uma turma; → calendário; → importar grade com aviso; vazio; sem mockup

## Autoconferência

As 12 perguntas do modelo, no plano. Na 2, "Grade e calendário" ainda não aparece em `e2e/`; confira os specs que contam as abas de Escola (`toHaveCount`).

## Fora do escopo desta tarefa

A visão Semana do professor (F2b).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
