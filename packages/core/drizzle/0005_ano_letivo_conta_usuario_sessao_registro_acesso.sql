-- citext: o e-mail da conta é único sem diferença de caixa. Tabelas novas e vazias: o deploy do F1 aplica tudo numa
-- transação só, e a única trava em tabela existente é a da FK nova da auditoria (Tech Spec, seção 3).
CREATE EXTENSION IF NOT EXISTS citext;
--> statement-breakpoint
CREATE TABLE "ano_letivo" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"ano" smallint NOT NULL,
	"inicio" date NOT NULL,
	"fim" date NOT NULL,
	"situacao" text DEFAULT 'planejado' NOT NULL,
	CONSTRAINT "ano_letivo_escola_id_unico" UNIQUE("escola_id","id"),
	CONSTRAINT "ano_letivo_situacao_valida" CHECK ("ano_letivo"."situacao" in ('planejado', 'em_curso', 'encerrado')),
	CONSTRAINT "ano_letivo_ano_valido" CHECK ("ano_letivo"."ano" between 2000 and 2100),
	CONSTRAINT "ano_letivo_periodo_valido" CHECK ("ano_letivo"."fim" > "ano_letivo"."inicio")
);
--> statement-breakpoint
CREATE TABLE "conta" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"email" "citext" NOT NULL,
	"senha_hash" text,
	"mfa_segredo_cifrado" "bytea",
	"mfa_chave_versao" smallint,
	"mfa_ativado_em" timestamp with time zone,
	"mfa_ultimo_passo" bigint,
	CONSTRAINT "conta_email_unico" UNIQUE("email"),
	CONSTRAINT "conta_email_formato" CHECK (char_length("conta"."email") between 3 and 254 and position('@' in "conta"."email") > 1)
);
--> statement-breakpoint
CREATE TABLE "registro_acesso" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid,
	"usuario_id" uuid,
	"evento" text NOT NULL,
	"ip" "inet" NOT NULL,
	"em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registro_acesso_evento_valido" CHECK ("registro_acesso"."evento" in ('login', 'login_falho', 'renovacao', 'saida')),
	CONSTRAINT "registro_acesso_escola_so_falta_na_falha_sem_usuario" CHECK (escola_id is not null or (evento = 'login_falho' and usuario_id is null))
);
--> statement-breakpoint
CREATE TABLE "sessao" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"conta_id" uuid,
	"usuario_id" uuid NOT NULL,
	"metodo" text NOT NULL,
	"familia" uuid NOT NULL,
	"refresh_hash" text NOT NULL,
	"refresh_hash_anterior" text,
	"atual_apresentado" boolean DEFAULT false NOT NULL,
	"rotacionado_em" timestamp with time zone,
	"ultimo_uso_em" timestamp with time zone DEFAULT now() NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"encerrada_em" timestamp with time zone,
	"motivo" text,
	CONSTRAINT "sessao_refresh_hash_unico" UNIQUE("refresh_hash"),
	CONSTRAINT "sessao_escola_id_unico" UNIQUE("escola_id","id"),
	CONSTRAINT "sessao_metodo_valido" CHECK ("sessao"."metodo" in ('email', 'matricula', 'externo')),
	CONSTRAINT "sessao_motivo_valido" CHECK ("sessao"."motivo" is null or "sessao"."motivo" in ('saida', 'troca_de_escola', 'reuso_de_refresh', 'desativacao')),
	CONSTRAINT "sessao_motivo_so_encerrada" CHECK ("sessao"."motivo" is null or "sessao"."encerrada_em" is not null)
);
--> statement-breakpoint
CREATE TABLE "usuario" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"conta_id" uuid,
	"papel" text NOT NULL,
	"nome" text NOT NULL,
	"desativado_em" timestamp with time zone,
	CONSTRAINT "usuario_escola_id_unico" UNIQUE("escola_id","id"),
	CONSTRAINT "usuario_escola_conta_papel_unico" UNIQUE("escola_id","conta_id","papel"),
	CONSTRAINT "usuario_papel_valido" CHECK ("usuario"."papel" in ('coordenador', 'professor', 'aluno')),
	CONSTRAINT "usuario_conta_so_falta_para_aluno" CHECK ("usuario"."conta_id" is not null or "usuario"."papel" = 'aluno'),
	CONSTRAINT "usuario_nome_preenchido" CHECK (char_length(btrim("usuario"."nome")) between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE "ano_letivo" ADD CONSTRAINT "ano_letivo_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registro_acesso" ADD CONSTRAINT "registro_acesso_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_conta_id_conta_id_fk" FOREIGN KEY ("conta_id") REFERENCES "public"."conta"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_usuario_da_escola_fk" FOREIGN KEY ("escola_id","usuario_id") REFERENCES "public"."usuario"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_conta_id_conta_id_fk" FOREIGN KEY ("conta_id") REFERENCES "public"."conta"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ano_letivo_um_em_curso_por_escola" ON "ano_letivo" USING btree ("escola_id") WHERE situacao = 'em_curso';--> statement-breakpoint
CREATE INDEX "registro_acesso_escola_em_idx" ON "registro_acesso" USING btree ("escola_id","em");--> statement-breakpoint
CREATE INDEX "sessao_refresh_hash_anterior_idx" ON "sessao" USING btree ("refresh_hash_anterior");--> statement-breakpoint
CREATE INDEX "sessao_escola_usuario_idx" ON "sessao" USING btree ("escola_id","usuario_id");--> statement-breakpoint
CREATE INDEX "usuario_conta_idx" ON "usuario" USING btree ("conta_id") WHERE conta_id is not null;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_autor_da_escola_fk" FOREIGN KEY ("escola_id","autor_usuario_id") REFERENCES "public"."usuario"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- A atividade (`ultimo_uso_em`) e a renovação atualizam a sessão sem mexer em coluna indexada: com folga na página, a
-- atualização fica HOT. O drizzle-kit não declara parâmetro de armazenamento, por isso fica só aqui.
ALTER TABLE "sessao" SET (fillfactor = 70);
