-- O login pela conta Google ou Microsoft da escola (tarefa 13.0): a conta externa ligada a um usuário da escola, só com
-- provedor, tenant e identificador (nunca e-mail, nome ou foto), e os domínios e tenants que a escola liberou. Tabelas
-- novas e vazias: só expande (regra 80, item 9). Os índices únicos começam por escola_id e são os da leitura do login.
CREATE TABLE "conta_externa" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"provedor" text NOT NULL,
	"tenant" text,
	"sujeito" text NOT NULL,
	"ligada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conta_externa_escola_id_unico" UNIQUE("escola_id","id"),
	CONSTRAINT "conta_externa_usuario_unico" UNIQUE("escola_id","usuario_id"),
	CONSTRAINT "conta_externa_provedor_valido" CHECK ("conta_externa"."provedor" in ('google', 'microsoft')),
	CONSTRAINT "conta_externa_tenant_do_provedor" CHECK (("conta_externa"."provedor" = 'google') = ("conta_externa"."tenant" is null)),
	CONSTRAINT "conta_externa_sujeito_formato" CHECK (char_length("conta_externa"."sujeito") between 1 and 255)
);
--> statement-breakpoint
CREATE TABLE "provedor_escola" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"provedor" text NOT NULL,
	"valor" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"removido_em" timestamp with time zone,
	CONSTRAINT "provedor_escola_escola_id_unico" UNIQUE("escola_id","id"),
	CONSTRAINT "provedor_escola_provedor_valido" CHECK ("provedor_escola"."provedor" in ('google', 'microsoft')),
	CONSTRAINT "provedor_escola_valor_formato" CHECK (char_length("provedor_escola"."valor") between 1 and 253 and "provedor_escola"."valor" = lower(btrim("provedor_escola"."valor")))
);
--> statement-breakpoint
ALTER TABLE "conta_externa" ADD CONSTRAINT "conta_externa_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conta_externa" ADD CONSTRAINT "conta_externa_usuario_da_escola_fk" FOREIGN KEY ("escola_id","usuario_id") REFERENCES "public"."usuario"("escola_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provedor_escola" ADD CONSTRAINT "provedor_escola_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conta_externa_identificador_unico" ON "conta_externa" USING btree ("escola_id","provedor",coalesce("tenant", ''),"sujeito");--> statement-breakpoint
CREATE UNIQUE INDEX "provedor_escola_valor_ativo_unico" ON "provedor_escola" USING btree ("escola_id","provedor","valor") WHERE removido_em is null;