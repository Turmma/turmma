-- O registro da aula (F2b, tarefa 1.0): uma tabela nova, só de criação. Sem FK para a `alocacao`: o texto sobrevive à reimportação da grade.
-- Só expande (regra 80, item 9): o código anterior não a conhece. Voltar a versão: o código anterior ignora a tabela, e ela pode ficar.
CREATE TABLE "aula" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"ano_letivo_id" uuid NOT NULL,
	"vinculo_id" uuid NOT NULL,
	"data" date NOT NULL,
	"inicio" time NOT NULL,
	"fim" time NOT NULL,
	"conteudo" text NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "aula_vinculo_data_inicio_unico" UNIQUE("vinculo_id","data","inicio"),
	CONSTRAINT "aula_horario_valido" CHECK ("aula"."inicio" < "aula"."fim"),
	CONSTRAINT "aula_conteudo_preenchido" CHECK (char_length(btrim("aula"."conteudo")) between 1 and 500)
);
--> statement-breakpoint
ALTER TABLE "aula" ADD CONSTRAINT "aula_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aula" ADD CONSTRAINT "aula_vinculo_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","vinculo_id") REFERENCES "public"."vinculo"("escola_id","ano_letivo_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aula_semana_idx" ON "aula" USING btree ("escola_id","ano_letivo_id","vinculo_id","data");