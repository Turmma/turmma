# Tarefa 14.0 — A conta da escola no pedido do nome (API)

**Funcionalidade:** acesso-e-convites · **Depende de:** nenhuma
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `test-engineer`
**Porte:** grande

## Objetivo

Na sala, o aluno prova a conta da escola (`intencao=reivindicar`), o pedido do nome guarda a conta no lugar da senha, e aprovar cria o aluno ligado a ela; antes da aprovação, a conta não entra; transferência e virada encerram o pedido sem a conta.

## Contexto necessário

- `techspec.md` seções 3 (`reivindicacao`, o check), 4, 5 ("Conta da escola do aluno") e 7
- `prd.md` RF14, RF16, RF17; `cenarios.md` RF14, "Corridas" (mesma conta, aprovar com conta ligada)
- `.claude/rules/20` item 2; `.claude/rules/10` item 6
- `apps/api/src/sessao/external/` (`external-login.service.ts`, `cookie-oidc.ts`), `apps/api/src/sala/reivindicacao/`, `apps/api/src/sala/decisao/decisao.service.ts`, o `travarPendente` e o `fechar('encerrada')` do F2

## Subtarefas

- [ ] 14.1 — Migration `reivindicacao.contaExterna`, o único parcial e o check novo (`not valid` + `validate`)
- [ ] 14.2 — `intencao=reivindicar` no `externa/iniciar` (o acesso na `TenantResolutionRepository`) e o cookie `educa_conta_provada`
- [ ] 14.3 — O pedido com a conta; aprovar cria o usuário sem senha e a `conta_externa`, com `CONFLITO` que desfaz; `conta_externa.ligada`
- [ ] 14.4 — O `fechar('encerrada')` anula a `contaExterna`; `contaExterna` em `COLUNAS_FORA_DO_ARQUIVO`; `docs/lgpd.md` (o cookie); o runbook recusa os pedidos de conta na volta de versão
- [ ] 14.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0047_reivindicacao_conta.sql` | novo |
| `packages/core/drizzle/meta/_journal.json` | alterado |
| `packages/core/src/db/schema/reivindicacao.ts` | alterado |
| `apps/api/src/sessao/external/external-login.service.ts` | alterado |
| `apps/api/src/sessao/external/cookie-oidc.ts` | alterado |
| `apps/api/src/sessao/tenant/tenant-resolution.repository.ts` | alterado |
| `apps/api/src/sala/reivindicacao/reivindicacao.service.ts` | alterado |
| `apps/api/src/sala/reivindicacao/reivindicacao.repository.ts` | alterado |
| `apps/api/src/sala/decisao/decisao.service.ts` | alterado |
| `packages/core/src/titular/leitura-do-titular.ts` | alterado |
| `docs/lgpd.md` | alterado |
| `docs/runbook.md` | alterado |
| `apps/api/test/reivindicacao-com-conta.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| domínio não liberado, cookie vencido | integração | recusado | |
| isolamento: cookie da sala da A num pedido da B, ou de outro acesso | integração | a resposta do cookie inválido | |
| isolamento: token da sala da B sob o slug da A | integração | recusado já no início | |
| o cookie | integração | apagado ao gravar; não serve a um segundo | |
| pedido pendente | integração | o login pela conta é credencial inválida | |
| aprovar | integração | liga, o aluno entra pela conta, `contaExterna` nula; recusar também a anula | |
| aprovar com a conta já ligada a outro aluno | integração | `CONFLITO` sem nome nem id, nenhum usuário, pedido pendente | |
| o banco | integração | sem e-mail nem foto do provedor, coluna a coluna | |
| ano sem curso | integração | responde como hoje, sem pedido | |
| transferência no job e virada do ano | integração | `contaExterna` nula, sem `decididaEm`, `decididaPor` nem `decididaComo` | |
| o check, direto no banco | integração | recusa senha e conta juntas, nenhuma das duas, e decidido com `contaExterna` | |
| aluno desligado pela planilha | integração | não entra pela conta ligada | |
| `conta_externa.ligada` | integração | um registro na aprovação | |
| [P] mesma conta em dois pedidos | paralelo | o segundo recusado | |
| [P] clique duplo em aprovar | paralelo | uma `conta_externa` | |

## Como testar

- Precedente: `apps/api/test/salas-reivindicar.int.test.ts` › "o check do pedido: hash, chave e teve_matricula_errada só no pendente…" e "I4: o código e o token vigentes de B com o slug de A não reivindicam nada…"
- OIDC: `apps/api/test/external-login.int.test.ts` › "borda (RF10): a aluna de A com domínio válido e sem ligação é recusada…", contra o `oidc-falso` do compose; cookie em `apps/api/src/sessao/external/cookie-oidc.test.ts`
- Aprovação: `apps/api/test/decisao.int.test.ts` › "E18: as escritas da aprovação…" e, para o [P], "professor × coordenação aprovando o mesmo pedido…"
- Comando: `npx vitest run --project integracao apps/api/test/reivindicacao-com-conta.int.test.ts`

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 6: o check novo valida as linhas que já existem; teste com uma linha antiga plantada antes da migration.

## Fora do escopo desta tarefa

O "ligar" em "Eu" (15.0); as telas (15.0 e 16.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
