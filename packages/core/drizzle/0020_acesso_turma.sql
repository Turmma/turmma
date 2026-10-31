-- O acesso da turma (A1, tarefa 4.0; Tech Spec da A1, seção 3): o link da sala e o código da turma que o professor gera.
-- Guarda só o SHA-256 do token e o HMAC do código (chave própria, `SALA_CHAVE_CODIGO`). Tabela nova e vazia: só expande
-- (regra 80, item 9), e o código anterior não a conhece.
--
-- - A turma por FK composta com a escola e o ano, `ON DELETE cascade`: a exclusão da turma confere antes que não há
--   acesso vigente (`CONFLITO`), e o revogado ou vencido sai com ela.
-- - O autor por FK composta com a escola, escrita à mão com `SET NULL ("criado_por")` (Postgres 15+): o `set null` que o
--   drizzle-kit gera anularia também a `escola_id`, que é `not null`. A autoria fica na auditoria.
-- - Um acesso não revogado por turma, e o código único entre os não revogados da escola (índices únicos parciais): o
--   gerar concorrente sai `CONFLITO` (C5), e a colisão do sorteio sorteia de novo num savepoint (C6).
-- - O token é único no sistema: o link não diz a escola.
-- - Os índices começam pelo escopo (regra 80, item 8), fora o do token, que é a busca pelo link.
CREATE TABLE "acesso_turma" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"ano_letivo_id" uuid NOT NULL,
	"turma_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"codigo_hmac" text NOT NULL,
	"validade_dias" integer NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"revogado_em" timestamp with time zone,
	"criado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "acesso_turma_escola_id_unico" UNIQUE("escola_id","id"),
	CONSTRAINT "acesso_turma_validade_valida" CHECK ("acesso_turma"."validade_dias" in (1, 7, 30))
);
--> statement-breakpoint
ALTER TABLE "acesso_turma" ADD CONSTRAINT "acesso_turma_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acesso_turma" ADD CONSTRAINT "acesso_turma_turma_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","turma_id") REFERENCES "public"."turma"("escola_id","ano_letivo_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acesso_turma" ADD CONSTRAINT "acesso_turma_criado_por_da_escola_fk" FOREIGN KEY ("escola_id","criado_por") REFERENCES "public"."usuario"("escola_id","id") ON DELETE SET NULL ("criado_por") ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "acesso_turma_token_hash_unico" ON "acesso_turma" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "acesso_turma_um_por_turma" ON "acesso_turma" USING btree ("escola_id","turma_id") WHERE "acesso_turma"."revogado_em" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "acesso_turma_codigo_na_escola_unico" ON "acesso_turma" USING btree ("escola_id","codigo_hmac") WHERE "acesso_turma"."revogado_em" is null;