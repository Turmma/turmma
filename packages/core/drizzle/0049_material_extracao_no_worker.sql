-- A extração do PDF no worker (ingestao-do-material, tarefa 1.0; Tech Spec, seções 3 e 7c; onda 3b, 45.0; regra 80, item 9). Só expande, e o código
-- anterior continua gravando: (1) `material.processado_em` e `material.objeto_apagado_em`, nulas; (2) o índice parcial que a varredura do objeto usa (2.0);
-- (3) os checks da fila e das vagas passam a aceitar `pdf`; (4) o material de antes da F4 nunca teve objeto no storage: `objeto_apagado_em = enviado_em`
-- o tira da varredura; (5) o material que a API anterior deixou `processando` não tem job nem objeto e nunca sairia desse estado (a extração agora é do
-- worker, e o job só nasce no envio): vira `falhou`/`extracao_falhou`, pode ser enviado de novo e deixa de contar no teto de materiais em leitura da escola.
-- O `NOT VALID` seguido de `VALIDATE` não alivia a trava: o `migrar` aplica tudo numa transação, e o `DROP` e o `ADD CONSTRAINT` seguram `ACCESS EXCLUSIVE`
-- em `job_registro` e em `configuracao_operacional_escola` até o commit, com o `VALIDATE` varrendo a tabela debaixo dela. É seguro hoje (o expurgo mantém
-- `job_registro` pequena, a outra tem uma linha por escola, e o deploy roda fora do horário letivo; a 0042 e a 0047 fazem igual). Quando houver staging
-- ou piloto, o `VALIDATE` vai para uma migration à parte. O `migrar` corre sob `lock_timeout` de 5 s. Sem `concurrently`, como a Tech Spec do F3, seção 7c.
ALTER TABLE "material" ADD COLUMN "processado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "material" ADD COLUMN "objeto_apagado_em" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "material_objeto_a_apagar_idx" ON "material" USING btree ("processado_em","excluido_em") WHERE "material"."objeto_apagado_em" is null;--> statement-breakpoint
UPDATE "material" SET "objeto_apagado_em" = "enviado_em" WHERE "objeto_apagado_em" IS NULL;--> statement-breakpoint
UPDATE "material" SET "estado" = 'falhou', "falha" = 'extracao_falhou', "processado_em" = now() WHERE "estado" = 'processando';--> statement-breakpoint
ALTER TABLE "configuracao_operacional_escola" DROP CONSTRAINT "configuracao_operacional_vagas_validas";--> statement-breakpoint
ALTER TABLE "configuracao_operacional_escola" ADD CONSTRAINT "configuracao_operacional_vagas_validas" CHECK ("configuracao_operacional_escola"."vagas" is null or (
        jsonb_typeof("configuracao_operacional_escola"."vagas") = 'object'
        and "configuracao_operacional_escola"."vagas" - 'interativa' - 'normal' - 'lote' - 'pdf' = '{}'::jsonb
        and not jsonb_path_exists("configuracao_operacional_escola"."vagas", '$.* ? (@.type() != "number" || @ < 1 || @ != @.floor())')
      )) NOT VALID;--> statement-breakpoint
ALTER TABLE "configuracao_operacional_escola" VALIDATE CONSTRAINT "configuracao_operacional_vagas_validas";--> statement-breakpoint
ALTER TABLE "job_registro" DROP CONSTRAINT "job_registro_fila_valida";--> statement-breakpoint
ALTER TABLE "job_registro" ADD CONSTRAINT "job_registro_fila_valida" CHECK (fila in ('interativa', 'normal', 'lote', 'pdf')) NOT VALID;--> statement-breakpoint
ALTER TABLE "job_registro" VALIDATE CONSTRAINT "job_registro_fila_valida";
