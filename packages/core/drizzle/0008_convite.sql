-- O convite do primeiro coordenador (tarefa 7.0): só o SHA-256 do token, de uso único, com expiração e revogação, preso
-- à escola e ao usuário dela por FK composta. Tabela nova e vazia: só expande (regra 80, item 9).
CREATE TABLE "convite" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"tipo" text NOT NULL,
	"usuario_id" uuid NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"usado_em" timestamp with time zone,
	"revogado_em" timestamp with time zone,
	CONSTRAINT "convite_token_hash_unico" UNIQUE("token_hash"),
	CONSTRAINT "convite_escola_id_unico" UNIQUE("escola_id","id"),
	CONSTRAINT "convite_tipo_valido" CHECK ("convite"."tipo" in ('coordenador')),
	CONSTRAINT "convite_token_hash_formato" CHECK ("convite"."token_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "convite" ADD CONSTRAINT "convite_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convite" ADD CONSTRAINT "convite_usuario_da_escola_fk" FOREIGN KEY ("escola_id","usuario_id") REFERENCES "public"."usuario"("escola_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "convite_escola_usuario_idx" ON "convite" USING btree ("escola_id","usuario_id");