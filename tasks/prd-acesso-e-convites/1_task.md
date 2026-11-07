# Tarefa 1.0 — A porta de e-mail e o envio do convite pelo worker

**Funcionalidade:** acesso-e-convites · **Depende de:** nenhuma
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `test-engineer`
**Porte:** grande

## Objetivo

Um convite com envio `na_fila` sai uma vez por e-mail pelo `email.enviar-convite`, ou termina `cancelado` ou `falhou`; os cifrados somem fora de `na_fila` e `enviando`. Sem rota que enfileire (3.0) nem limite por minuto (2.0).

## Contexto necessário

- `techspec.md` seções 2, 3, 5 ("E-mail"), 6 e 7; `prd.md` RF11, RF16; `cenarios.md` RF11
- `.claude/rules/80` itens 3, 7 e 9; `.claude/rules/20` itens 9 e 12
- `secret-cipher.ts`; `revogarConviteAberto` (a defesa); `llm-config.ts` (a trava de configuração)

## Subtarefas

- [ ] 1.1 — Migration que só expande `convite` (`canal`, cifrados, `envio`, `envioReservadoEm`, `enviadoEm`) e o check dos cifrados
- [ ] 1.2 — `SecretCipher` em `packages/core/src/cripto/`, com cada chamador trocado
- [ ] 1.3 — `EmailSender`, `SmtpEmailSender`, `FakeEmailSender` com barreira e a trava de configuração; Mailpit no compose em `127.0.0.1`
- [ ] 1.4 — `EnvioRepository` e `enviar-email.ts`: reserva, envio fora da transação (10 s), `enviado` só com a minha reserva, 4xx/5xx
- [ ] 1.5 — `cancelado` na revogação, no refazer e na defesa do `desativar`; o expurgo de 24 h
- [ ] 1.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0042_envio_de_email.sql` | novo |
| `packages/core/drizzle/meta/_journal.json` | alterado |
| `packages/core/src/db/schema/convite.ts` | alterado |
| `packages/core/src/cripto/secret-cipher.ts` | movido |
| `apps/api/src/credencial/secret-cipher.ts` | removido |
| `packages/core/src/email/` | novo |
| `packages/core/package.json` | alterado |
| `packages/shared/src/system/job-definitions.ts` | alterado |
| `apps/worker/src/processors/enviar-email.ts` | novo |
| `apps/worker/src/composition.ts` | alterado |
| `packages/core/src/convite/convite-da-escola.repository.ts` | alterado |
| `packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts` | alterado |
| `packages/core/src/retencao/expurgo-da-escola.repository.ts` | alterado |
| `infra/compose.yml` | alterado |
| `apps/worker/test/enviar-email.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| corpo capturado pelo falso | integração | escola e link com o token depois do `#`; nenhum nome da lista | |
| [U] fora do local: sem `EMAIL_PROVEDOR_ID`, sem TLS, com o host do Mailpit | unidade | cada um recusa a partida | |
| revogado ou refeito entre a fila e o envio | integração | `cancelado`, zero envios; só o último link vale | |
| SMTP 5xx | integração | `falhou`, sem nova tentativa | |
| SMTP 4xx; em toda tentativa | integração | volta a `na_fila` e termina `enviado`; sempre 4xx: `falhou` | |
| 4xx com revogação entre as tentativas | integração | `cancelado`, sem 2º envio | |
| expurgo com 23 h e com mais de 24 h | integração | ficam; depois `falhou`, cifrados nulos | |
| isolamento: o alvo no `it.each(CATEGORIAS_DO_EXPURGO)` | integração | a linha da B com a mesma idade fica | |
| `enviado`, `falhou`, `cancelado` | integração | cifrados nulos | |
| log do worker capturado | integração | sem token, e-mail nem resposta do SMTP | |
| reserva morta há mais de 2 min | integração | retomada, um envio | |
| [P] duas execuções, a 1ª na barreira do falso | paralelo | um envio; cai sem `envio = 'na_fila'` na reserva | |
| [P] revogação com o job na barreira | paralelo | responde na hora, `cancelado`, link recusado; cai sem `envioReservadoEm = :minha` | |
| defesa do `desativar` (convite aberto plantado), `na_fila` e `enviando` | integração | `cancelado`, zero envios | |
| permissão: professor pendente com envio `na_fila` | integração | `desativar` dá `NAO_ENCONTRADO`, envio intacto | |
| isolamento: convite da B num job da A; payload adulterado; job repetido após `enviado` | integração | nada enviado; vale a escola do registro; um envio | |

## Como testar

- Job: `apps/worker/test/job-execution.int.test.ts` › "job da fila com a escola A, ou sem escola, apontando para a linha da B não roda…"; `QueueFixtures`
- Configuração: `packages/core/src/config/llm-config.test.ts:112` › "fora da nossa rede, o provedor precisa de id…"
- Expurgo: `apps/worker/test/expurgo-da-escola.int.test.ts:589` (`it.each`) e `relogioEm` (linha 68)
- Revogação: `apps/api/test/professores.int.test.ts` › "E8: cadastrar devolve o link uma vez…"; `WriteBlockTrigger`
- Comando: `npx vitest run --project integracao apps/worker/test/enviar-email.int.test.ts`; `npx vitest run --project unidade packages/core/src/email/`

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 4: o pendente cai no `NAO_ENCONTRADO` antes da defesa; a defesa se prova com o convite aberto num usuário ativo.

## Fora do escopo desta tarefa

O `EMAIL_POR_MINUTO` e a saída de adiar (2.0); a rota "Enviar" (3.0); o link da conta (5.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
