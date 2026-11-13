-- Os capítulos lidos do PDF (ingestao-do-material, tarefa 4.0; Tech Spec, seção 3; regra 80, item 9). Só expande: tabela nova e vazia, que o código anterior não conhece e
-- continua funcionando sem ela. Chave de leitura `(escola_id, material_id, ordem)`, FK composta com a escola em cascata: o material expurgado leva os capítulos.
-- Material de antes da F4 não ganha capítulo nenhum: ficam sem capítulo, como o PDF que não tem.
CREATE TABLE "capitulo_do_material" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	"ordem" smallint NOT NULL,
	"numero" integer,
	"titulo" text NOT NULL,
	"pagina_inicial" integer NOT NULL,
	"pagina_final" integer NOT NULL,
	CONSTRAINT "capitulo_do_material_ordem_unica" UNIQUE("escola_id","material_id","ordem"),
	CONSTRAINT "capitulo_do_material_titulo_preenchido" CHECK (char_length("capitulo_do_material"."titulo") between 1 and 200),
	CONSTRAINT "capitulo_do_material_paginas_validas" CHECK ("capitulo_do_material"."pagina_final" >= "capitulo_do_material"."pagina_inicial")
);
--> statement-breakpoint
ALTER TABLE "capitulo_do_material" ADD CONSTRAINT "capitulo_do_material_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capitulo_do_material" ADD CONSTRAINT "capitulo_do_material_da_escola_fk" FOREIGN KEY ("escola_id","material_id") REFERENCES "public"."material"("escola_id","id") ON DELETE cascade ON UPDATE no action;