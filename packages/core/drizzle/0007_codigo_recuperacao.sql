-- Os códigos de recuperação do MFA (tarefa 6.0): só o HMAC, de uso único, presos à conta global. Tabela nova e vazia:
-- só expande (regra 80, item 9).
CREATE TABLE "codigo_recuperacao" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"conta_id" uuid NOT NULL,
	"hmac" text NOT NULL,
	"usado_em" timestamp with time zone,
	CONSTRAINT "codigo_recuperacao_conta_hmac_unico" UNIQUE("conta_id","hmac"),
	CONSTRAINT "codigo_recuperacao_hmac_formato" CHECK (char_length("codigo_recuperacao"."hmac") = 43)
);
--> statement-breakpoint
ALTER TABLE "codigo_recuperacao" ADD CONSTRAINT "codigo_recuperacao_conta_id_conta_id_fk" FOREIGN KEY ("conta_id") REFERENCES "public"."conta"("id") ON DELETE cascade ON UPDATE no action;