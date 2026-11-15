-- A fila `ferramenta` (reengenharia-continuacao, tarefa 3.0; Tech Spec, seções 3 e 5 "A fila"; onda 3a, 47.0; regra 80, itens 2, 3 e 9). Só expande, e o código anterior
-- continua gravando: os checks da fila de `job_registro` e das vagas por escola passam a aceitar `ferramenta`, e nenhuma coluna, linha ou índice muda. O código
-- anterior não conhece a fila e nunca a grava; quem a grava é o `ia.executar` (5.0), depois desta migration.
-- O `NOT VALID` seguido de `VALIDATE` não alivia a trava: o `migrar` aplica tudo numa transação, e o `DROP` e o `ADD CONSTRAINT` seguram `ACCESS EXCLUSIVE`
-- em `job_registro` e em `configuracao_operacional_escola` até o commit, com o `VALIDATE` varrendo a tabela debaixo dela. É seguro hoje (o expurgo mantém
-- `job_registro` pequena, a outra tem uma linha por escola, e o deploy roda fora do horário letivo; a 0042, a 0047 e a 0049 fazem igual). Quando houver staging
-- ou piloto, o `VALIDATE` vai para uma migration à parte. O `migrar` corre sob `lock_timeout` de 5 s. Sem `concurrently`, como a Tech Spec do F3, seção 7c.
ALTER TABLE "configuracao_operacional_escola" DROP CONSTRAINT "configuracao_operacional_vagas_validas";--> statement-breakpoint
ALTER TABLE "configuracao_operacional_escola" ADD CONSTRAINT "configuracao_operacional_vagas_validas" CHECK ("configuracao_operacional_escola"."vagas" is null or (
        jsonb_typeof("configuracao_operacional_escola"."vagas") = 'object'
        and "configuracao_operacional_escola"."vagas" - 'interativa' - 'ferramenta' - 'normal' - 'lote' - 'pdf' = '{}'::jsonb
        and not jsonb_path_exists("configuracao_operacional_escola"."vagas", '$.* ? (@.type() != "number" || @ < 1 || @ != @.floor())')
      )) NOT VALID;--> statement-breakpoint
ALTER TABLE "configuracao_operacional_escola" VALIDATE CONSTRAINT "configuracao_operacional_vagas_validas";--> statement-breakpoint
ALTER TABLE "job_registro" DROP CONSTRAINT "job_registro_fila_valida";--> statement-breakpoint
ALTER TABLE "job_registro" ADD CONSTRAINT "job_registro_fila_valida" CHECK (fila in ('interativa', 'ferramenta', 'normal', 'lote', 'pdf')) NOT VALID;--> statement-breakpoint
ALTER TABLE "job_registro" VALIDATE CONSTRAINT "job_registro_fila_valida";
