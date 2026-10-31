-- O incidente de segurança e a seção de cada escola afetada (F3, tarefa 9.0; Tech Spec do F3, seção 3). Só expande (regra 80, item
-- 9): duas tabelas novas e vazias que o código anterior não conhece.
--
-- - `incidente`: da operação, sem `escola_id` (a exceção declarada em `docs/modelo-de-dados.md`): quando a Turmma soube e quem da
--   equipe registrou. `conhecido_em` não passa do `registrado_em`. Retenção: 5 anos do registro, pelo `sistema.expurgar-acesso`.
-- - `incidente_escola`: a seção de cada escola, com os números e os textos dela e a confirmação de recebimento. O `id` é o que a
--   escola vê (o `incidente_id` é compartilhado entre as afetadas). Apagada em cascata com o incidente. Os checks de formato e de
--   lista fechada repetem por extenso as constantes de `@educa/shared` (o drizzle-kit lê o pacote pelo `dist`);
--   `apps/api/test/incidente.int.test.ts` (o caso "banco: recusa…") compara a lista de categorias com a constante.
-- - `confirmado_por` por FK composta com a escola, `on delete set null ("confirmado_por")` (escrito à mão, como na 0021): o `set null`
--   inteiro anularia também a escola, que é `not null`. A eliminação de quem confirmou não apaga a seção, e a data fica.
-- - Índices sem `concurrently`: tabelas novas e vazias, sem staging nem piloto (seção 7c).
CREATE TABLE "incidente" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"conhecido_em" timestamp with time zone NOT NULL,
	"registrado_por" text NOT NULL,
	"registrado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "incidente_conhecido_antes_do_registro" CHECK ("incidente"."conhecido_em" <= "incidente"."registrado_em"),
	CONSTRAINT "incidente_registrado_por_formato" CHECK ("incidente"."registrado_por" ~ '^[a-z][a-z0-9-]{1,31}$')
);
--> statement-breakpoint
CREATE TABLE "incidente_escola" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"incidente_id" uuid NOT NULL,
	"escola_id" uuid NOT NULL,
	"circunstancias" text NOT NULL,
	"categorias" text[] NOT NULL,
	"titulares_estimados" integer NOT NULL,
	"risco" text NOT NULL,
	"contencao" text NOT NULL,
	"correcao" text NOT NULL,
	"avisado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmado_em" timestamp with time zone,
	"confirmado_por" uuid,
	CONSTRAINT "incidente_escola_da_escola_unico" UNIQUE("escola_id","incidente_id"),
	CONSTRAINT "incidente_escola_circunstancias_tamanho" CHECK (char_length("incidente_escola"."circunstancias") between 1 and 1000),
	CONSTRAINT "incidente_escola_contencao_tamanho" CHECK (char_length("incidente_escola"."contencao") between 1 and 1000),
	CONSTRAINT "incidente_escola_correcao_tamanho" CHECK (char_length("incidente_escola"."correcao") between 1 and 1000),
	CONSTRAINT "incidente_escola_titulares_estimados_validos" CHECK ("incidente_escola"."titulares_estimados" between 0 and 100000000),
	CONSTRAINT "incidente_escola_risco_valido" CHECK ("incidente_escola"."risco" in ('baixo', 'relevante', 'alto')),
	CONSTRAINT "incidente_escola_categorias_validas" CHECK (cardinality("incidente_escola"."categorias") between 1 and 8 and "incidente_escola"."categorias" <@ array['cadastro', 'conta_de_acesso', 'registro_de_acesso', 'conversa_do_aluno', 'conversa_do_professor', 'trabalho_do_aluno', 'material_da_escola', 'consulta_de_busca']),
	CONSTRAINT "incidente_escola_confirmado_por_so_no_confirmado" CHECK ("incidente_escola"."confirmado_por" is null or "incidente_escola"."confirmado_em" is not null)
);
--> statement-breakpoint
ALTER TABLE "incidente_escola" ADD CONSTRAINT "incidente_escola_incidente_id_incidente_id_fk" FOREIGN KEY ("incidente_id") REFERENCES "public"."incidente"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidente_escola" ADD CONSTRAINT "incidente_escola_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidente_escola" ADD CONSTRAINT "incidente_escola_confirmado_por_da_escola_fk" FOREIGN KEY ("escola_id","confirmado_por") REFERENCES "public"."usuario"("escola_id","id") ON DELETE set null ("confirmado_por") ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "incidente_escola_pendente_idx" ON "incidente_escola" USING btree ("escola_id","incidente_id") WHERE "incidente_escola"."confirmado_em" is null;--> statement-breakpoint
CREATE INDEX "incidente_escola_incidente_idx" ON "incidente_escola" USING btree ("incidente_id");