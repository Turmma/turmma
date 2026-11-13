-- As séries do material (ingestao-do-material, tarefa 7.0; Tech Spec, seções 3 e 7c; regra 80, item 9). Só expande, e o código anterior continua gravando: a tabela `material_serie` é nova e vazia (o
-- backfill é da 0055), com a chave `(escola_id, material_id, serie_id)`, a FK composta com a escola nas duas pontas (a do material em cascata, a da série sem ação) e o índice
-- `(escola_id, serie_id, material_id)` que o filtro por série lê. Tabela nova: nenhuma instrução toca linha que já existe. As duas FKs, porém, pedem trava `SHARE ROW EXCLUSIVE` em `material` e em `serie` (escrita nelas espera), e o `migrar` roda todas as migrations numa transação só: a trava dura até o fim da 0055. É curta (essas tabelas têm dezenas de linhas por escola) e o deploy roda fora do horário letivo.
CREATE TABLE "material_serie" (
	"escola_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	"serie_id" uuid NOT NULL,
	CONSTRAINT "material_serie_pk" PRIMARY KEY("escola_id","material_id","serie_id")
);
--> statement-breakpoint
ALTER TABLE "material_serie" ADD CONSTRAINT "material_serie_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_serie" ADD CONSTRAINT "material_serie_material_da_escola_fk" FOREIGN KEY ("escola_id","material_id") REFERENCES "public"."material"("escola_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_serie" ADD CONSTRAINT "material_serie_serie_da_escola_fk" FOREIGN KEY ("escola_id","serie_id") REFERENCES "public"."serie"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "material_serie_serie_idx" ON "material_serie" USING btree ("escola_id","serie_id","material_id");