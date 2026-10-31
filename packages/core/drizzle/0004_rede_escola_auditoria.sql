CREATE TABLE "auditoria" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid,
	"autor_usuario_id" uuid,
	"autor_operador" text,
	"acao" text NOT NULL,
	"entidade" text NOT NULL,
	"entidade_id" uuid NOT NULL,
	"antes" jsonb,
	"depois" jsonb,
	"finalidade" text,
	"requisicao_id" uuid NOT NULL,
	"em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auditoria_escola_ou_rede_pelo_operador" CHECK (escola_id is not null or (autor_operador is not null and entidade = 'rede')),
	CONSTRAINT "auditoria_um_autor" CHECK ((autor_usuario_id is not null) <> (autor_operador is not null)),
	CONSTRAINT "auditoria_operador_formato" CHECK (autor_operador is null or autor_operador ~ '^[a-z][a-z0-9-]{1,31}$'),
	CONSTRAINT "auditoria_finalidade_curta" CHECK (finalidade is null or char_length(finalidade) between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "escola" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"rede_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"slug" text NOT NULL,
	"inatividade_aluno_min" integer DEFAULT 30 NOT NULL,
	"inatividade_equipe_min" integer DEFAULT 120 NOT NULL,
	CONSTRAINT "escola_slug_unique" UNIQUE("slug"),
	CONSTRAINT "escola_slug_formato" CHECK ("escola"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length("escola"."slug") <= 63),
	CONSTRAINT "escola_nome_preenchido" CHECK (char_length(btrim("escola"."nome")) between 1 and 200),
	CONSTRAINT "escola_inatividade_aluno_positiva" CHECK ("escola"."inatividade_aluno_min" > 0),
	CONSTRAINT "escola_inatividade_equipe_positiva" CHECK ("escola"."inatividade_equipe_min" > 0)
);
--> statement-breakpoint
CREATE TABLE "rede" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"nome" text NOT NULL,
	"tipo" text NOT NULL,
	"ips_saida" "inet"[] DEFAULT '{}'::inet[] NOT NULL,
	CONSTRAINT "rede_tipo_valido" CHECK ("rede"."tipo" in ('prefeitura', 'grupo', 'independente')),
	CONSTRAINT "rede_nome_preenchido" CHECK (char_length(btrim("rede"."nome")) between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escola" ADD CONSTRAINT "escola_rede_id_rede_id_fk" FOREIGN KEY ("rede_id") REFERENCES "public"."rede"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auditoria_escola_em_idx" ON "auditoria" USING btree ("escola_id","em");