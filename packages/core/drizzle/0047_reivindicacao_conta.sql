-- A conta da escola no pedido do nome (acesso-e-convites, tarefa 14.0; Tech Spec, seções 3 e 5, "Conta da escola do aluno").
-- Só expande (regra 80, item 9): uma coluna nula, que o código anterior não conhece e não lê, um índice e a troca de um check.
-- - `conta_externa` (jsonb: provedor, tenant, sujeito) guarda a conta da escola que o aluno provou, no lugar do hash da senha. É só
--   do pedido pendente; a aprovação a leva para a `conta_externa`, e a decisão e o encerramento a apagam.
-- - O check `reivindicacao_segredo_so_pendente` passa a dizer: pendente ⇔ chave e marca presentes e uma de senha ou conta; fora
--   do pendente, as quatro nulas; nunca as duas juntas. Entra `not valid` e é validado em seguida (o padrão da 0042); as linhas
--   de hoje (pendente com hash, o resto sem nada) o satisfazem. O migrador roda a migration numa transação só (`migrate.ts`), então o
--   `validate` e o índice abaixo rodam com o lock que o `add` já pegou: hoje é inofensivo (a `reivindicacao` tem cerca de uma
--   linha por aluno por ano, o deploy é fora do horário letivo e há `lock_timeout`); quando a tabela crescer, o `validate` e o
--   índice vão para um passo próprio.
-- - O índice único parcial `(escola_id, provedor, tenant, sujeito)` onde pendente: a mesma conta não está em dois pedidos
--   pendentes da escola. O `coalesce` do tenant é o mesmo da `conta_externa_identificador_unico` (o Google não tem tenant).
-- Voltar a versão: o código anterior lê `senha_hash` do pendente e não acha o hash do pedido de conta; o runbook encerra, sem
-- decisão, os pedidos de conta pendentes e devolve o nome à lista antes (`docs/runbook.md`).
ALTER TABLE "reivindicacao" ADD COLUMN "conta_externa" jsonb;--> statement-breakpoint
ALTER TABLE "reivindicacao" DROP CONSTRAINT "reivindicacao_segredo_so_pendente";--> statement-breakpoint
ALTER TABLE "reivindicacao" ADD CONSTRAINT "reivindicacao_segredo_so_pendente" CHECK (("reivindicacao"."estado" = 'pendente') = ("reivindicacao"."chave_envio" is not null) and ("reivindicacao"."chave_envio" is not null) = ("reivindicacao"."teve_matricula_errada" is not null) and ("reivindicacao"."estado" = 'pendente') = ("reivindicacao"."senha_hash" is not null or "reivindicacao"."conta_externa" is not null) and ("reivindicacao"."senha_hash" is null or "reivindicacao"."conta_externa" is null)) NOT VALID;--> statement-breakpoint
ALTER TABLE "reivindicacao" VALIDATE CONSTRAINT "reivindicacao_segredo_so_pendente";--> statement-breakpoint
CREATE UNIQUE INDEX "reivindicacao_conta_pendente_unica" ON "reivindicacao" USING btree ("escola_id",("conta_externa"->>'provedor'),coalesce("conta_externa"->>'tenant', ''),("conta_externa"->>'sujeito')) WHERE "reivindicacao"."estado" = 'pendente' and "reivindicacao"."conta_externa" is not null;
