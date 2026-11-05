# Tarefa 16.0 — A escola inteira entra de uma vez, provada de ponta a ponta e sob carga

**Funcionalidade:** onboarding-por-convite · **Depende de:** 14.0, 15.0
**Subagentes obrigatórios:** `infra-guardian`, `frontend-reviewer`
**Porte:** grande

## Objetivo

O e2e do RF18 prova a escola entrando só pela tela, em `chromebook` e `celular`, e o cenário de carga prova que a prévia,
o gravar e o job de 3.000 linhas não derrubam o login, o gerar acesso nem a decisão das 7h30.

## Contexto necessário

- `techspec.md` §7c (Tempo; Métrica e alerta), §10, §13 (o passo (3) contra o gerar acesso das 7h30: falhando o [C], a
  spec volta à revisão)
- `prd.md` RF1, RF15, RF18; §11 (RF15: o teto é 2 s, não 10 s)
- `cenarios.md` E2E; RF2 (os dois [C])
- Regra 40 ("Os fluxos que exigem E2E": onboarding completo, planilha suja); regra 80 itens 1, 10 e 11
- Código: `e2e/escola-montada.spec.ts` (W1); `infra/k6/login-7h30.js`, `infra/scripts/carga-login.ts`,
  `infra/compose.carga.yml`; `docs/roteiro-da-demonstracao.md`

## Subtarefas

- [ ] 16.1 — `e2e/escola-por-planilha.spec.ts`: escola vazia → quatro planilhas (a de alunos suja) → o professor aceita o convite copiado e confirma o que a grade definiu → um aluno reivindica com matrícula → aprovação; casos com seed compartilhado
- [ ] 16.2 — O modelo servido pela tela, preenchido, entra sem erro
- [ ] 16.3 — Cenário k6 `importacao-7h30.js`: prévia e gravar com 3.000 linhas junto da rajada de login; job com transferências contra o gerar acesso e a decisão nessas turmas; job com desligamentos e com a virada; job de professores contra o login deles
- [ ] 16.4 — `docs/roteiro-da-demonstracao.md` conferido passo a passo contra `e2e/roteiro-da-demonstracao.spec.ts` (a lista da turma mudou de contrato na 8.0 e de tela na 13.0)
- [ ] 16.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `e2e/escola-por-planilha.spec.ts`, `e2e/support/planilhas.ts` | novo |
| `infra/k6/importacao-7h30.js`, `infra/scripts/carga-importacao.ts`, `infra/test/carga-importacao.test.ts` | novo |
| `docs/roteiro-da-demonstracao.md`, `e2e/roteiro-da-demonstracao.spec.ts` | alterado, se o roteiro mudou |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| Escola vazia recebe as quatro planilhas, com a de alunos suja (erro, corrige, grava) | e2e | RF18, RF2 | |
| O professor aceita o convite copiado | e2e | RF18 | |
| O professor confirma o vínculo que a grade definiu, e antes disso não alcança a turma | e2e | RF18, RF8 | |
| Um aluno reivindica com matrícula, o professor aprova, e o aluno entra e vê só a turma dele | e2e | RF18 | |
| O fluxo passa em `chromebook` e em `celular`, com axe | e2e | RF18 | |
| O modelo servido pela tela, preenchido, entra sem erro | e2e | RF1 | |
| Prévia e gravar com 3.000 linhas e a rajada de login: p95 até 2 s | carga | RF15 | |
| Job de 3.000 linhas com transferências contra o gerar acesso e a decisão: zero 503, espera de trava com p95 abaixo de 300 ms, passo (3) abaixo de 1 s | carga | §13 | |
| Job de 100 a 300 desligamentos e a virada de 900 alunos (`vinculo.criado` um por um): passo (3) abaixo de 1 s; teto nas marcas ou comandos em grupo só se passar | carga | §7c (10.0) | |
| Job de professores contra o login deles: zero 503 no login | carga | §7c | |
| O cenário de carga tem as contas e as linhas que diz ter (modo seco) | unidade | o cenário não mente | |
| O teste de carga não chama provedor pago | unidade | regra 80, item 11 | |

## Como testar

- E2E: `e2e/escola-montada.spec.ts › W1: da escola vazia à aluna aprovada, só pela tela — …`; a planilha suja: o spec da 13.0
- Carga: `infra/k6/login-7h30.js` (os cenários `rajada_primeiro_minuto` e `rajada_resto`); o modo seco: `infra/test/carga-login.test.ts › as contas do cenário "login às 7h30" › a rajada tem as 2.100 contas das três escolas, …`
- Comandos: `node tools/ci/e2e.ts --manter-ambiente e2e/escola-por-planilha.spec.ts`; a carga, pelo `docs/runbook.md` (`infra/compose.carga.yml`), com `flock /tmp/educa-carga.lock`
- Armadilha: o e2e perto de 2/3 do prazo vira dívida da `develop` (X8); divida em casos com seed compartilhado desde o começo
- **Telas:** as das 13.0, 14.0 e 15.0, em sequência; `professora` no aceite e na confirmação; `aluno` na reivindicação

## Autoconferência

As 12 perguntas do modelo, no plano. Na 4, o [C] precisa chegar ao passo (3): a planilha tem transferências nas turmas onde o gerar acesso roda.

## Fora do escopo desta tarefa

O e2e de e-mail, senha e conta da escola (F2c).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
