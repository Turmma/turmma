-- O envio de material em andamento (ingestao-do-material, tarefa 2.0; Tech Spec, seções 3 e 5; onda 3b, 3. Falha; regra 80, item 9). Só expande: tabela nova e
-- vazia, que o código anterior não conhece e continua funcionando sem ela. A linha nasce antes do `guardarBytes` e sai na transação do envio; a varredura horária
-- apaga o objeto e a linha de mais de 1 h. Sem FK para `material` (o material ainda não existe quando a linha nasce), com FK da escola. Índice por `criado_em`:
-- a varredura é rotina nossa, entre escolas.
CREATE TABLE "envio_de_material" (
	"escola_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "envio_de_material_pk" PRIMARY KEY("escola_id","material_id")
);
--> statement-breakpoint
ALTER TABLE "envio_de_material" ADD CONSTRAINT "envio_de_material_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "envio_de_material_criado_em_idx" ON "envio_de_material" USING btree ("criado_em");