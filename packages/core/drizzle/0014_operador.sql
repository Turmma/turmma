-- As seis tabelas da operação Turmma (A0, tarefa 3.0; Tech Spec da A0, seção 3). Só tabelas novas: nada do código
-- anterior as lê, e a migration não mexe em tabela existente (regra 80, item 9). Sem `escola_id`: são da nossa equipe,
-- e não de escola (desvio declarado da regra 10, item 1; Tech Spec, seção 11). Só o `OperadorRepository` as toca.
--
-- O convite tem um pendente por operador (`convite_operador_pendente_unico`), e o operador desativado não guarda
-- dado pessoal (`operador_desativado_sem_dado_pessoal`): as duas regras ficam no banco, e não só no comando.
CREATE TABLE "acesso_operacao" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"operador_id" uuid,
	"evento" text NOT NULL,
	"ip" "inet" NOT NULL,
	"em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "acesso_operacao_evento_valido" CHECK ("acesso_operacao"."evento" in ('entrada', 'entrada_falha', 'saida')),
	CONSTRAINT "acesso_operacao_operador_so_falta_na_falha" CHECK ("acesso_operacao"."operador_id" is not null or "acesso_operacao"."evento" = 'entrada_falha')
);
--> statement-breakpoint
CREATE TABLE "auditoria_operacao" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"autor" text NOT NULL,
	"acao" text NOT NULL,
	"operador_alvo_id" uuid NOT NULL,
	"em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auditoria_operacao_autor_formato" CHECK ("auditoria_operacao"."autor" ~ '^[a-z][a-z0-9-]{1,31}$'),
	CONSTRAINT "auditoria_operacao_acao_valida" CHECK ("auditoria_operacao"."acao" in ('operador.criado', 'operador.desativado', 'operador.mfa_configurado', 'convite_operador.gerado', 'convite_operador.revogado'))
);
--> statement-breakpoint
CREATE TABLE "codigo_recuperacao_operador" (
	"operador_id" uuid NOT NULL,
	"hmac" text NOT NULL,
	CONSTRAINT "codigo_recuperacao_operador_pk" PRIMARY KEY("operador_id","hmac"),
	CONSTRAINT "codigo_recuperacao_operador_hmac_formato" CHECK (char_length("codigo_recuperacao_operador"."hmac") = 43)
);
--> statement-breakpoint
CREATE TABLE "convite_operador" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"operador_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"usado_em" timestamp with time zone,
	"revogado_em" timestamp with time zone,
	CONSTRAINT "convite_operador_token_hash_unico" UNIQUE("token_hash"),
	CONSTRAINT "convite_operador_token_hash_formato" CHECK ("convite_operador"."token_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "operador" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"apelido" text NOT NULL,
	"nome" text,
	"email" "citext",
	"senha_hash" text,
	"mfa_segredo_cifrado" "bytea",
	"mfa_chave_versao" smallint,
	"mfa_versao" integer DEFAULT 0 NOT NULL,
	"mfa_ativado_em" timestamp with time zone,
	"mfa_ultimo_passo" bigint,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"desativado_em" timestamp with time zone,
	CONSTRAINT "operador_apelido_unico" UNIQUE("apelido"),
	CONSTRAINT "operador_email_unico" UNIQUE("email"),
	CONSTRAINT "operador_apelido_formato" CHECK ("operador"."apelido" ~ '^[a-z][a-z0-9-]{1,31}$' and "operador"."apelido" <> 'bootstrap'),
	CONSTRAINT "operador_nome_curto" CHECK ("operador"."nome" is null or char_length("operador"."nome") between 1 and 200),
	CONSTRAINT "operador_email_formato" CHECK (char_length("operador"."email") between 3 and 254 and position('@' in "operador"."email") > 1),
	CONSTRAINT "operador_ativo_com_nome_e_email" CHECK ("operador"."desativado_em" is not null or ("operador"."nome" is not null and "operador"."email" is not null)),
	CONSTRAINT "operador_desativado_sem_dado_pessoal" CHECK ("operador"."desativado_em" is null or ("operador"."nome" is null and "operador"."email" is null and "operador"."senha_hash" is null and "operador"."mfa_segredo_cifrado" is null and "operador"."mfa_chave_versao" is null and "operador"."mfa_ativado_em" is null and "operador"."mfa_ultimo_passo" is null))
);
--> statement-breakpoint
CREATE TABLE "sessao_operador" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"operador_id" uuid NOT NULL,
	"refresh_hash" text NOT NULL,
	"refresh_hash_anterior" text,
	"rotacionado_em" timestamp with time zone,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"ultimo_uso_em" timestamp with time zone DEFAULT now() NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"encerrada_em" timestamp with time zone,
	"motivo" text,
	CONSTRAINT "sessao_operador_refresh_hash_unico" UNIQUE("refresh_hash"),
	CONSTRAINT "sessao_operador_motivo_valido" CHECK ("sessao_operador"."motivo" is null or "sessao_operador"."motivo" in ('saida', 'reuso_de_refresh', 'desativacao')),
	CONSTRAINT "sessao_operador_motivo_so_encerrada" CHECK ("sessao_operador"."motivo" is null or "sessao_operador"."encerrada_em" is not null)
);
--> statement-breakpoint
ALTER TABLE "acesso_operacao" ADD CONSTRAINT "acesso_operacao_operador_id_operador_id_fk" FOREIGN KEY ("operador_id") REFERENCES "public"."operador"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria_operacao" ADD CONSTRAINT "auditoria_operacao_operador_alvo_id_operador_id_fk" FOREIGN KEY ("operador_alvo_id") REFERENCES "public"."operador"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codigo_recuperacao_operador" ADD CONSTRAINT "codigo_recuperacao_operador_operador_id_operador_id_fk" FOREIGN KEY ("operador_id") REFERENCES "public"."operador"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convite_operador" ADD CONSTRAINT "convite_operador_operador_id_operador_id_fk" FOREIGN KEY ("operador_id") REFERENCES "public"."operador"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessao_operador" ADD CONSTRAINT "sessao_operador_operador_id_operador_id_fk" FOREIGN KEY ("operador_id") REFERENCES "public"."operador"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acesso_operacao_em_idx" ON "acesso_operacao" USING btree ("em");--> statement-breakpoint
CREATE INDEX "auditoria_operacao_alvo_em_idx" ON "auditoria_operacao" USING btree ("operador_alvo_id","em");--> statement-breakpoint
CREATE UNIQUE INDEX "convite_operador_pendente_unico" ON "convite_operador" USING btree ("operador_id") WHERE usado_em is null and revogado_em is null;--> statement-breakpoint
CREATE INDEX "sessao_operador_refresh_hash_anterior_idx" ON "sessao_operador" USING btree ("refresh_hash_anterior");--> statement-breakpoint
CREATE INDEX "sessao_operador_aberta_idx" ON "sessao_operador" USING btree ("operador_id") WHERE encerrada_em is null;--> statement-breakpoint
CREATE INDEX "sessao_operador_fim_idx" ON "sessao_operador" USING btree (coalesce("encerrada_em", "expira_em"));