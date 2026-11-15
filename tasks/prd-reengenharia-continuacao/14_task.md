# Tarefa 14.0 — Com o Redis fora, o segundo fator e a escolha de escola pedem para tentar de novo, sem gastar tentativa (54.0)

**Funcionalidade:** reengenharia-continuacao · **Depende de:** nenhuma
**Subagentes obrigatórios:** `infra-guardian`, `tenancy-guardian`, `frontend-reviewer`
**Porte:** grande

## Objetivo

Com o Redis de fila fora, o desafio da escola responde `503 INDISPONIVEL_TENTE_DE_NOVO` com `Retry-After` (hoje, `401
NAO_AUTENTICADO`), e nenhuma tentativa é gasta: `conferirLivre` vem antes de qualquer reserva. A web espera o `Retry-After`
uma vez, até 10 s, com o botão desabilitado e um aviso em `role="status"`; acima disso, ou num segundo `503`, mostra o
`ErrorState`. O seletor mantém a escola escolhida.

## Contexto necessário

- `techspec.md` §4 (última frase), §5 "O Redis fora (54.0)"
- `prd.md` RF13; §7 ("O Redis cai às 7h30…")
- `tasks/prd-reengenharia/onda-3c.md` "RF22 — N3 (54.0)"
- `.claude/rules/` 10 (item 6), 40, 50, 80 (itens 1, 5)
- Código: `apps/api/src/credencial/challenge.ts` (`conferirLivre` l.168, `consumir`, `#semRedis` l.195); o igual do
  operador, `apps/api/src/operacao/operador-challenge.ts` (l.119 e `#semRedis` l.144, com `DEFAULT_RETRY_AFTER_SECONDS`);
  os chamadores `apps/api/src/sessao/mfa/mfa.service.ts` e `apps/api/src/sessao/troca-de-escola/troca-de-escola.service.ts`;
  na web, `ApiError.esperaSegundos` (`apps/web/src/api/client.ts:13`, já lido), `apps/web/src/pages/Mfa.tsx`,
  `apps/web/src/pages/EscolherEscola.tsx`, `apps/web/src/components/SeletorDeEscola.tsx`

## Subtarefas

- [ ] 14.1 — `#semRedis` devolve `INDISPONIVEL_TENTE_DE_NOVO` com `Retry-After`, como o do operador; nos dois serviços,
  `conferirLivre` antes de qualquer reserva do `LoginLockout`
- [ ] 14.2 — Na web, uma espera única pelo `Retry-After` (até 10 s) no segundo fator, na escolha de escola da entrada e no
  seletor: botão desabilitado, "Tentando de novo em instantes" em `role="status"` (a contagem `aria-hidden`); segundo `503`
  ou `Retry-After` acima de 10 s: `ErrorState`, sem nova espera
- [ ] 14.3 — `docs/interface.md`: o aviso na entrada e no seletor (o `docs/runbook.md` não cita o 401 do desafio; se a busca achar, é divergência)
- [ ] 14.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/pages/espera-do-indisponivel.ts`, `apps/web/src/pages/espera-do-indisponivel.test.ts` | novo |
| `apps/api/src/credencial/challenge.ts`, `apps/api/src/sessao/mfa/mfa.service.ts`, `apps/api/src/sessao/troca-de-escola/troca-de-escola.service.ts`, `apps/api/test/mfa.int.test.ts`, `apps/api/test/troca-de-escola.int.test.ts`, `apps/api/test/password-attack.int.test.ts`, `apps/web/src/pages/Mfa.tsx`, `apps/web/src/pages/EscolherEscola.tsx`, `apps/web/src/components/SeletorDeEscola.tsx`, `apps/web/src/components/SeletorDeEscola.test.tsx`, `e2e/entrar-na-escola.spec.ts`, `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| segundo fator, Redis fora | I | `503 INDISPONIVEL_TENTE_DE_NOVO` com `Retry-After`; o contador do `insuranceLimiter` do `LoginLockout` sem tentativa gasta. Mutação: reservar antes de `conferirLivre` | |
| escolha de escola, Redis fora | I | o mesmo, na troca de escola | |
| Redis de volta | I | a tentativa seguinte entra de fato (sessão emitida, escola escolhida) | |
| Redis que recusa o comando | I | conectado e recusando: o mesmo 503 | |
| isolamento | I | o desafio de outra escola, com o Redis fora: a mesma resposta do inexistente, sem confirmar que existe | |
| espera única | U | `Retry-After: 3`: botão desabilitado, `role="status"` com "Tentando de novo em instantes", uma nova tentativa | |
| segundo 503 | U | `ErrorState`, sem nova espera | |
| o limite de 10 s | U | `Retry-After: 10` espera; `Retry-After: 11` vai direto ao `ErrorState` | |
| o seletor | U | a escola escolhida continua marcada durante a espera e depois | |
| recomeço | U | a segunda pessoa na mesma aba não herda o aviso; a mesma entrada de novo começa sem espera; a resposta atrasada da tentativa anterior não muda a tela; a falha tira o aviso e o foco volta ao botão | |
| 1366 × 768 e 360 px | E | `/entrar` e o seletor com o aviso: `paginaNaoRola`; sem rolagem horizontal, 44 px, axe. O 503 vem de `page.route` | |
| log | I | o aviso do Redis fora sai uma vez, sem matrícula, e-mail nem desafio | |

## Como testar

- API: `apps/api/src/operacao/operador-challenge.test.ts` › "Redis desconectado e Redis que recusa o comando: 503 com
  Retry-After, e o aviso `operacao.desafio_sem_redis` sai uma vez só…"; o caso que muda: `apps/api/test/mfa.int.test.ts` ›
  "falha: com o Redis de fila fora, o desafio de mfa é recusado com NAO_AUTENTICADO…" (l.754); o seguro:
  `apps/api/test/password-attack.int.test.ts` (l.575)
- Web: a espera do operador em `apps/web/src/operacao/api/sessao.ts` (l.46 e l.375) e `apps/web/src/pages/retry-with-backoff.ts`
  (`esperaDoReenvio`)
- Comandos: `npx vitest run --project integracao apps/api/test/mfa.int.test.ts`; `node tools/ci/e2e.ts --manter-ambiente e2e/entrar-na-escola.spec.ts`
- **Telas:** sem papel, `/entrar` no segundo fator e na escolha de escola com o 503; `coordenacao`, o seletor de escola aberto

## Autoconferência

As 12 perguntas do modelo, no plano. Na 4: o caso do Redis fora para o Redis de fato, e o dublê lança o erro do `ioredis`.
Na 2: `grep -rln 'Tentando de novo' e2e/`.

## Fora do escopo desta tarefa

O prazo das chamadas (12.0).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar
