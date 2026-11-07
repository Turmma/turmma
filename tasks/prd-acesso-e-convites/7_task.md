# Tarefa 7.0 — Posse do e-mail: verificar antes de a conta cruzar escolas (API)

**Funcionalidade:** acesso-e-convites · **Depende de:** 5.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `test-engineer`
**Porte:** grande

## Objetivo

O aceite por e-mail grava `emailVerificadoEm`; a conta com senha e sem verificação que aceita convite copiado de outra escola (o do painel também) recebe `VERIFICACAO_PENDENTE` e um link de verificar, e `POST /v1/conta/verificar` libera o aceite.

## Contexto necessário

- `techspec.md` seções 3 (`conta.emailVerificadoEm`), 5 ("Posse do e-mail", "Auditoria") e 13
- `prd.md` RF12, RF17 e o caso de borda "Conta de link copiado"; `cenarios.md` "Posse do e-mail" e "A1 e F2 que mudam de regra"
- `.claude/rules/20` item 8; `.claude/rules/80` item 7
- `apps/api/src/sessao/convite/convite.service.ts:91` (`aceitar`) e o aceite do painel em `apps/api/src/operacao/`

## Subtarefas

- [ ] 7.1 — Migration `conta.emailVerificadoEm`
- [ ] 7.2 — O aceite: verifica pelo canal `email`; `VERIFICACAO_PENDENTE` e o link (24 h, 3/h por conta) no copiado de outra escola
- [ ] 7.3 — `POST /v1/conta/verificar`; o redefinir também verifica; `conta.email_verificado` por escola
- [ ] 7.4 — Os casos da A1 (`convite.int.test.ts:320`, `:377`, `:447`) e o do RF6 do F2 (`professores.int.test.ts:900`) com a regra nova, e o nome do caso trocado
- [ ] 7.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0044_email_verificado.sql` | novo |
| `packages/core/drizzle/meta/_journal.json` | alterado |
| `packages/core/src/db/schema/conta.ts` | alterado |
| `apps/api/src/sessao/convite/convite.service.ts` | alterado |
| `apps/api/src/sessao/convite/convite.repository.ts` | alterado |
| `apps/api/src/sessao/senha/senha.service.ts` | alterado |
| `apps/api/src/sessao/senha/conta.controller.ts` | novo |
| `packages/shared/src/sessao/convite.ts` | alterado |
| `packages/shared/src/sessao/senha.ts` | alterado |
| `packages/core/src/auditoria/acoes.ts` | alterado |
| `apps/api/test/convite.int.test.ts` | alterado |
| `apps/api/test/professores.int.test.ts` | alterado |
| `apps/api/test/posse-do-email.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| aceite pelo e-mail | integração | grava `emailVerificadoEm` | |
| aceite pelo link copiado | integração | não grava | |
| conta não verificada, convite copiado de outra escola | integração | `VERIFICACAO_PENDENTE` e link de verificar | |
| o mesmo pelo painel | integração | `VERIFICACAO_PENDENTE` | |
| depois de verificar | integração | o aceite segue | |
| senha definida pelo link de uma escola | integração | não abre o convite de outra | |
| quarto aceite na hora | integração | `VERIFICACAO_PENDENTE` e três envios, cada link invalida o anterior | |
| envio do link antigo `na_fila` | integração | `cancelado`, cifrados nulos, não sai | |
| conta nova pelo convite copiado | integração | aceita sem verificação | |
| redefinir pelo "esqueci" | integração | grava `emailVerificadoEm` | |
| token do verificar | integração | depois do `#` | |
| job da conta nascido no aceite | integração | escola nula no job | |
| `conta.email_verificado` pelo verificar, conta nas escolas A e B | integração | um por escola; com a B desativada, só na A | |
| conta da A aceita por e-mail convite da B | integração | o registro sai só na B | |
| usuário desativado entre o link e o verificar | integração | link inválido, sem registro | |
| `convite.int.test.ts:320`, `:377`, `:447` | integração | o copiado passa a exigir o e-mail verificado | |
| RF6 do F2 (segundo vínculo) | integração | exige o verificado, com a regra no nome | |
| [P] dois aceites que pedem verificação: o 1º preso no insert do link | paralelo | os dois `VERIFICACAO_PENDENTE`, um link aberto, nada da outra escola; cai sem o `catch` | |
| [P] verificar com o envio antigo preso na barreira | paralelo | antigo `cancelado` e recusado em `/conta/verificar` | |

## Como testar

- Precedente: `apps/api/test/professores.int.test.ts` › "E10: o aceite na escola B com a conta que já tem usuário em A não cria conta e cria o usuário de B…"; `ActivationScenario` (`apps/api/test/ativacao.fixture.ts`: `convidar`, `aceito`)
- Corrida: `apps/api/test/convite.int.test.ts:302` › "concorrência (regra 80, item 7): dois aceites em paralelo com o mesmo token…"
- Comando: `npx vitest run --project integracao apps/api/test/posse-do-email.int.test.ts apps/api/test/convite.int.test.ts`

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 4: o aceite pode cair no "convite inválido" antes da verificação; confira que o cenário chega nela.

## Fora do escopo desta tarefa

A tela "Verificar" e o aviso no aceite (8.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
