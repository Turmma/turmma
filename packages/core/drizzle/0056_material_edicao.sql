-- A edição nova do material (ingestao-do-material, tarefa 8.0; Tech Spec, seções 3, 5 e 11; regra 80, item 9). Só expande, e o código anterior continua gravando: (1) as colunas `edicao`,
-- `substitui_id` e `substituido_por` em `material`, nulas (o código anterior não as conhece e o material de antes nunca teve edição); (2) as duas FKs compostas com a escola, ambas para o próprio
-- `material`, com `on delete set null ("substitui_id")` e `("substituido_por")` escrito à mão, como a 0022: o `set null` que o drizzle-kit gera anularia também a `escola_id`, que é `not null`, e
-- sem a ação o expurgo do material excluído travaria na edição que o citasse; (3) o índice único parcial `material_uma_edicao_em_andamento`, uma edição `processando` por alvo; (4) o check do
-- rótulo; (5) o check `auditoria_rotina_so_nas_acoes` ganha `material.substituido`, a ação que a extração grava no worker, sem pessoa, assinada pela rotina (`NOT VALID` e `VALIDATE`, como a 0036:
-- só afrouxa o check antigo). Nenhuma instrução reescreve linha; o índice e os checks de `material` varrem uma tabela de dezenas de linhas por escola, e o `migrar` roda sob `lock_timeout` de 5 s,
-- fora do horário letivo. Sem `concurrently`, como a Tech Spec do F3, seção 7c.
ALTER TABLE "material" ADD COLUMN "edicao" text;--> statement-breakpoint
ALTER TABLE "material" ADD COLUMN "substitui_id" uuid;--> statement-breakpoint
ALTER TABLE "material" ADD COLUMN "substituido_por" uuid;--> statement-breakpoint
ALTER TABLE "material" ADD CONSTRAINT "material_substitui_da_escola_fk" FOREIGN KEY ("escola_id","substitui_id") REFERENCES "public"."material"("escola_id","id") ON DELETE set null ("substitui_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material" ADD CONSTRAINT "material_substituido_por_da_escola_fk" FOREIGN KEY ("escola_id","substituido_por") REFERENCES "public"."material"("escola_id","id") ON DELETE set null ("substituido_por") ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "material_uma_edicao_em_andamento" ON "material" USING btree ("escola_id","substitui_id") WHERE "material"."estado" = 'processando' and "material"."excluido_em" is null;--> statement-breakpoint
ALTER TABLE "material" ADD CONSTRAINT "material_edicao_preenchida" CHECK ("material"."edicao" is null or char_length(btrim("material"."edicao")) between 1 and 60);--> statement-breakpoint
ALTER TABLE "auditoria" DROP CONSTRAINT "auditoria_rotina_so_nas_acoes";--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_rotina_so_nas_acoes" CHECK (autor_operador is distinct from 'rotina' or acao in ('usuario.eliminado', 'acesso_turma.revogado', 'titular.nome_trocado', 'pedido.concluido', 'material.substituido')) NOT VALID;--> statement-breakpoint
ALTER TABLE "auditoria" VALIDATE CONSTRAINT "auditoria_rotina_so_nas_acoes";
