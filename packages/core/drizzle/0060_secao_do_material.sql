-- As seções do material (classificacao-bncc, tarefa 2.0; Tech Spec, seção 3 e "Migrations", passo 1; regra 80, item 9). Só expande, e o código anterior continua gravando: (1) `unique (escola_id, id)` no
-- `capitulo_do_material`, o alvo da FK composta da seção (a tabela tem linhas só dos materiais já lidos, dezenas por escola); (2) `secao_do_material` e `habilidade_da_secao`, novas e vazias: quem as enche é
-- a extração nova e a migration seguinte, e o código anterior não as conhece; (3) os três índices da seção 7c, todos começando pela escola; (4) o check `auditoria_rotina_so_nas_acoes` ganha
-- `material.classificacao_herdada`, a ação que a extração da edição nova grava no worker, sem pessoa, assinada pela rotina (`NOT VALID` e `VALIDATE`, como a 0056: só afrouxa o check antigo).
--
-- As FKs compostas levam a escola nas duas pontas. `on delete set null ("execucao_id")` e `("corrigida_por")` são escritos à mão, como a 0022: o `set null` que o drizzle-kit gera anularia também a
-- `escola_id`, que é `not null`. A execução da classificação sai no expurgo de `execucao_agente`, e a seção que a citava volta a ficar sem execução em vez de travá-lo; a eliminação da coordenação que
-- corrigiu anula só a autoria, e a marca da correção (`corrigida_em`) fica. O `ADD CONSTRAINT UNIQUE` do capítulo vem antes da FK que o usa (o drizzle-kit o põe no fim). Sem `concurrently`, como a Tech Spec
-- do F3, seção 7c: o `migrar` roda numa transação só, o deploy é fora do horário letivo, e a tabela de capítulos é pequena.
SET LOCAL lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "capitulo_do_material" ADD CONSTRAINT "capitulo_do_material_escola_id_unico" UNIQUE("escola_id","id");--> statement-breakpoint
CREATE TABLE "secao_do_material" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	"capitulo_id" uuid,
	"ordem" smallint NOT NULL,
	"pagina_inicial" integer NOT NULL,
	"pagina_final" integer NOT NULL,
	"execucao_id" uuid,
	"falhas_seguidas" smallint DEFAULT 0 NOT NULL,
	"classificada_em" timestamp with time zone,
	"corrigida_em" timestamp with time zone,
	"corrigida_por" uuid,
	CONSTRAINT "secao_do_material_escola_id_unico" UNIQUE("escola_id","id"),
	CONSTRAINT "secao_do_material_ordem_unica" UNIQUE("escola_id","material_id","ordem"),
	CONSTRAINT "secao_do_material_paginas_validas" CHECK ("secao_do_material"."pagina_inicial" >= 1 and "secao_do_material"."pagina_final" >= "secao_do_material"."pagina_inicial"),
	CONSTRAINT "secao_do_material_ordem_valida" CHECK ("secao_do_material"."ordem" >= 1),
	CONSTRAINT "secao_do_material_falhas_validas" CHECK ("secao_do_material"."falhas_seguidas" >= 0),
	CONSTRAINT "secao_do_material_corrigida_por_so_na_corrigida" CHECK ("secao_do_material"."corrigida_por" is null or "secao_do_material"."corrigida_em" is not null)
);
--> statement-breakpoint
CREATE TABLE "habilidade_da_secao" (
	"escola_id" uuid NOT NULL,
	"secao_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"origem" text NOT NULL,
	CONSTRAINT "habilidade_da_secao_pk" PRIMARY KEY("escola_id","secao_id","codigo"),
	CONSTRAINT "habilidade_da_secao_origem_valida" CHECK ("habilidade_da_secao"."origem" in ('ia', 'coordenacao'))
);
--> statement-breakpoint
ALTER TABLE "secao_do_material" ADD CONSTRAINT "secao_do_material_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secao_do_material" ADD CONSTRAINT "secao_do_material_da_escola_fk" FOREIGN KEY ("escola_id","material_id") REFERENCES "public"."material"("escola_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secao_do_material" ADD CONSTRAINT "secao_do_material_capitulo_da_escola_fk" FOREIGN KEY ("escola_id","capitulo_id") REFERENCES "public"."capitulo_do_material"("escola_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secao_do_material" ADD CONSTRAINT "secao_do_material_execucao_da_escola_fk" FOREIGN KEY ("escola_id","execucao_id") REFERENCES "public"."execucao_agente"("escola_id","id") ON DELETE set null ("execucao_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secao_do_material" ADD CONSTRAINT "secao_do_material_corrigida_por_da_escola_fk" FOREIGN KEY ("escola_id","corrigida_por") REFERENCES "public"."usuario"("escola_id","id") ON DELETE set null ("corrigida_por") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habilidade_da_secao" ADD CONSTRAINT "habilidade_da_secao_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habilidade_da_secao" ADD CONSTRAINT "habilidade_da_secao_codigo_habilidade_bncc_codigo_fk" FOREIGN KEY ("codigo") REFERENCES "public"."habilidade_bncc"("codigo") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habilidade_da_secao" ADD CONSTRAINT "habilidade_da_secao_da_escola_fk" FOREIGN KEY ("escola_id","secao_id") REFERENCES "public"."secao_do_material"("escola_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "secao_do_material_pagina_idx" ON "secao_do_material" USING btree ("escola_id","material_id","pagina_inicial");--> statement-breakpoint
CREATE INDEX "secao_do_material_execucao_idx" ON "secao_do_material" USING btree ("escola_id","execucao_id") WHERE "secao_do_material"."execucao_id" is not null;--> statement-breakpoint
CREATE INDEX "habilidade_da_secao_codigo_idx" ON "habilidade_da_secao" USING btree ("escola_id","codigo");--> statement-breakpoint
ALTER TABLE "auditoria" DROP CONSTRAINT "auditoria_rotina_so_nas_acoes";--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_rotina_so_nas_acoes" CHECK (autor_operador is distinct from 'rotina' or acao in ('usuario.eliminado', 'acesso_turma.revogado', 'titular.nome_trocado', 'pedido.concluido', 'material.substituido', 'material.classificacao_herdada')) NOT VALID;--> statement-breakpoint
ALTER TABLE "auditoria" VALIDATE CONSTRAINT "auditoria_rotina_so_nas_acoes";
