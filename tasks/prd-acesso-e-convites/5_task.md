# Tarefa 5.0 — O link da conta e o "esqueci a senha" (API e worker)

**Funcionalidade:** acesso-e-convites · **Depende de:** 2.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `test-engineer`
**Porte:** grande

## Objetivo

`POST /v1/senha/esqueci` responde 202 igual, e a conta ativa recebe um link de 1 h; `POST /v1/senha/redefinir` troca a senha, derruba as sessões e grava `senha.redefinida` em cada escola com usuário ativo da conta.

## Contexto necessário

- `techspec.md` seções 3, 5 ("E-mail", "Esqueci", "Auditoria"), 6 e 11; `prd.md` RF12, RF17; `cenarios.md` RF12, "Limites", "Corridas"
- `.claude/rules/10` itens 1 e 9; `.claude/rules/80` item 1
- `job-outbox.repository.ts:74-78`; `tenant-resolution.repository.ts` (como o `codigo_recuperacao`); `expurgo-de-acesso.repository.ts`

## Subtarefas

- [ ] 5.1 — Migration `link_da_conta` e a exceção no `docs/modelo-de-dados.md`
- [ ] 5.2 — `SISTEMA_DA_REQUISICAO` no `JobOutboxRepository.inserir`; `sistema.enviar-email-da-conta`, escola nula, no `EnvioRepository`
- [ ] 5.3 — `cerca-envio` em `camadas.cjs` e a zona no `architecture.test.ts`, com as fixtures
- [ ] 5.4 — As rotas: `rl:ip:senha`, 3/h pelo HMAC do e-mail, piso de 400 ms, link novo cancela o antigo; `senha.redefinida` por escola
- [ ] 5.5 — O expurgo de acesso (30 dias; `falhou` de 24 h, `@Unscoped` próprio)
- [ ] 5.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0043_link_da_conta.sql` | novo |
| `packages/core/drizzle/meta/_journal.json` | alterado |
| `packages/core/src/db/schema/link-da-conta.ts` | novo |
| `packages/core/src/queue/job-outbox.repository.ts` | alterado |
| `packages/core/src/email/envio.repository.ts` | alterado |
| `apps/worker/src/processors/enviar-email.ts` | alterado |
| `packages/shared/src/system/job-definitions.ts` | alterado |
| `packages/shared/src/sessao/senha.ts` | novo |
| `apps/api/src/sessao/senha/` | novo |
| `apps/api/src/sessao/tenant/tenant-resolution.repository.ts` | alterado |
| `apps/api/src/sessao/sessao.module.ts` | alterado |
| `packages/core/src/retencao/expurgo-de-acesso.repository.ts` | alterado |
| `packages/core/src/auditoria/acoes.ts` | alterado |
| `tools/guardas/camadas.cjs` | alterado |
| `tools/guardas/camadas.test.ts` | alterado |
| `apps/api/test/architecture.test.ts` | alterado |
| `docs/modelo-de-dados.md` | alterado |
| `apps/api/test/senha-esqueci.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| e-mail com e sem conta | integração | resposta igual, piso de 400 ms; log só com ids | |
| link | integração | vence em 1 h, não serve duas vezes, token depois do `#` | |
| redefinir | integração | derruba as sessões; o MFA segue | |
| conta desligada; quarto pedido na hora | integração | 202 sem link; 202 e três envios | |
| balde `rl:ip:senha` cheio | integração | 202 sem envio, nunca 429; o login do mesmo IP segue | |
| token inválido | integração | não ocupa o semáforo do argon2 (espião) | |
| envio do link: 23 h, mais de 24 h, 4xx sempre; `link_da_conta` usado ou vencido | integração | fica; `falhou`, cifrados nulos; sai em 30 dias | |
| job da conta | integração | escola nula, lê pelo id do job, ocupa e solta a `vaga:normal:sistema` ao adiar | |
| outro `sistema.*` pedido por requisição | integração | recusado, sem `rotinaDoSistema` | |
| `EMAIL_POR_MINUTO` com os convites enchendo a metade deles | integração | o link sai no minuto; um convite a mais adia | |
| `senha.redefinida`, conta em A e B | integração | um em cada, autor e alvo o usuário dela, nada da B no da A; B desativado: só na A | |
| usuário desativado entre o link e o redefinir | integração | link inválido, sem registro, nunca 500 | |
| `cerca-envio`: vizinho, reexportação, `import()`; sem o alvo | unidade | quem contorna é acusado; sem o alvo, reprova | |
| [P] "esqueci" com o envio antigo na barreira | paralelo | antigo `cancelado`, token recusado, 202 no piso | |
| [P] dois "esqueci", o 1º preso no insert | paralelo | um link aberto, dois 202; cai sem o piso no `catch` | |
| [P] dois "redefinir" | paralelo | um troca; cai sem `usado_em is null` | |

## Como testar

- Guarda: `tools/guardas/camadas.test.ts` › "%s reprova só o que a fixture marca"; fixtures em `tools/guardas/__fixtures__/camadas/`
- Zona: `apps/api/test/architecture.test.ts`, os casos das classes cercadas
- Expurgo: `apps/worker/test/expurgo-de-acesso.int.test.ts` › "borda: nos limites de cada prazo…"
- IP: `apps/api/test/password-attack.int.test.ts`; `ipSorteado` e `doIp` (`apps/api/test/operador-mfa.fixture.ts`)
- Semáforo: sem precedente do espião; o mais próximo, `apps/api/test/login-bulkhead.int.test.ts`
- Comando: `npx vitest run --project integracao apps/api/test/senha-esqueci.int.test.ts`

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 6: a `cerca-envio` tem uma fixture por forma de contornar. Na 3: conta em duas escolas, senão o registro por escola passa com um só.

## Fora do escopo desta tarefa

As telas (6.0); a verificação do e-mail (7.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
