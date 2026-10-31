-- A estrutura da escola (tarefa 8.0): série do recorte (D43) com check, disciplina e turma do ano letivo, cada uma
-- presa à escola por FK composta, e o ano letivo único por número na escola. Tabelas novas e vazias, e `ano_letivo`
-- tem uma linha por escola e ano: só expande (regra 80, item 9).
CREATE TABLE "disciplina" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"area" text,
	CONSTRAINT "disciplina_escola_id_unico" UNIQUE("escola_id","id"),
	CONSTRAINT "disciplina_nome_preenchido" CHECK (char_length(btrim("disciplina"."nome")) between 1 and 80),
	CONSTRAINT "disciplina_area_valida" CHECK ("disciplina"."area" is null or "disciplina"."area" in ('linguagens', 'matematica', 'ciencias_da_natureza', 'ciencias_humanas', 'ensino_religioso'))
);
--> statement-breakpoint
CREATE TABLE "serie" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"etapa" text NOT NULL,
	"ano" smallint NOT NULL,
	CONSTRAINT "serie_escola_id_unico" UNIQUE("escola_id","id"),
	CONSTRAINT "serie_escola_etapa_ano_unico" UNIQUE("escola_id","etapa","ano"),
	CONSTRAINT "serie_no_recorte" CHECK (("serie"."etapa" = 'ef_anos_finais' and "serie"."ano" between 6 and 9) or ("serie"."etapa" = 'em' and "serie"."ano" between 1 and 3))
);
--> statement-breakpoint
CREATE TABLE "turma" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"ano_letivo_id" uuid NOT NULL,
	"serie_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"turno" text,
	CONSTRAINT "turma_escola_id_unico" UNIQUE("escola_id","id"),
	CONSTRAINT "turma_escola_ano_id_unico" UNIQUE("escola_id","ano_letivo_id","id"),
	CONSTRAINT "turma_nome_preenchido" CHECK (char_length(btrim("turma"."nome")) between 1 and 40),
	CONSTRAINT "turma_turno_valido" CHECK ("turma"."turno" is null or "turma"."turno" in ('manha', 'tarde', 'noite', 'integral'))
);
--> statement-breakpoint
ALTER TABLE "disciplina" ADD CONSTRAINT "disciplina_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serie" ADD CONSTRAINT "serie_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turma" ADD CONSTRAINT "turma_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turma" ADD CONSTRAINT "turma_ano_letivo_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id") REFERENCES "public"."ano_letivo"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turma" ADD CONSTRAINT "turma_serie_da_escola_fk" FOREIGN KEY ("escola_id","serie_id") REFERENCES "public"."serie"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "disciplina_nome_na_escola_unico" ON "disciplina" USING btree ("escola_id",lower("nome"));--> statement-breakpoint
CREATE UNIQUE INDEX "turma_nome_no_ano_unico" ON "turma" USING btree ("escola_id","ano_letivo_id",lower("nome"));--> statement-breakpoint
ALTER TABLE "ano_letivo" ADD CONSTRAINT "ano_letivo_escola_ano_unico" UNIQUE("escola_id","ano");