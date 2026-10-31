-- As três tabelas do F0 nasceram sem FK porque `escola` só existe desde o F1 (tarefa 1.0). Aqui elas
-- passam a apontar para ela. `NOT VALID` de propósito (regra 80, item 9): a restrição já vale para toda
-- escrita e atualização nova, sem varrer a tabela nem pegar lock longo em `job_registro`, que é a que
-- cresce. O `VALIDATE CONSTRAINT` fica para uma migration de deploy posterior, fora do horário letivo,
-- depois de a consulta de órfãos do TODO.md dar zero.
ALTER TABLE "configuracao_operacional_escola" ADD CONSTRAINT "configuracao_operacional_escola_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "job_registro" ADD CONSTRAINT "job_registro_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "uso_infra_diario" ADD CONSTRAINT "uso_infra_diario_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action NOT VALID;
