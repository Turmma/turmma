-- A senha provisória do aluno (acesso-e-convites, tarefa 9.0; Tech Spec, seções 3 e 5, "Senha provisória").
-- Só expande (regra 80, item 9): três colunas nulas, que o código anterior não conhece e não lê, um check, uma FK e um
-- índice parcial. Nenhuma linha existente é tocada. Voltar a versão: as colunas podem ficar, sem uso.
-- - `provisoria_hash` (argon2id, nunca a senha) e `provisoria_expira_em` nascem e saem juntas (o check); a validade de 24 h é
--   do código.
-- - `provisoria_gerada_por` por FK composta com a escola, escrita à mão com `SET NULL ("provisoria_gerada_por")` (Postgres 15+),
--   como a `acesso_turma.criado_por` da 0020: o `set null` que o drizzle-kit gera anularia também a `escola_id`, que é
--   `not null`, e a eliminação de quem gerou falharia. A autoria fica na auditoria (`senha_provisoria.gerada`).
-- - O índice parcial `(escola_id, provisoria_expira_em)` é o do expurgo do vencimento (`retencao.expurgar-escola`): começa
--   pela escola (regra 80, item 8) e só tem as linhas que ainda guardam uma provisória.
ALTER TABLE "credencial_matricula" ADD COLUMN "provisoria_hash" text;--> statement-breakpoint
ALTER TABLE "credencial_matricula" ADD COLUMN "provisoria_expira_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "credencial_matricula" ADD COLUMN "provisoria_gerada_por" uuid;--> statement-breakpoint
ALTER TABLE "credencial_matricula" ADD CONSTRAINT "credencial_matricula_provisoria_gerada_por_da_escola_fk" FOREIGN KEY ("escola_id","provisoria_gerada_por") REFERENCES "public"."usuario"("escola_id","id") ON DELETE set null ("provisoria_gerada_por") ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credencial_matricula_provisoria_vence_idx" ON "credencial_matricula" USING btree ("escola_id","provisoria_expira_em") WHERE "credencial_matricula"."provisoria_expira_em" is not null;--> statement-breakpoint
ALTER TABLE "credencial_matricula" ADD CONSTRAINT "credencial_matricula_provisoria_completa" CHECK (("credencial_matricula"."provisoria_hash" is null) = ("credencial_matricula"."provisoria_expira_em" is null));
