-- A licença do material de terceiro (ingestao-do-material, tarefa 5.0; Tech Spec, seções 3 e 11; regra 80, item 9). Só expande, e o código anterior continua gravando:
-- (1) a tabela `licenca_de_material`, nova e vazia (o backfill é da 0053); (2) `material.licenca_id`, nula, com a FK composta e o índice parcial que a contagem de materiais e o
-- expurgo da licença usam; (3) `registrada_por` com `on delete set null ("registrada_por")`, escrito à mão como na 0022: o `set null` que o drizzle-kit gera anularia também a
-- `escola_id`, que é `not null`; (4) o check `auditoria_escola_ou_operacao_global` passa a aceitar sem escola também a entidade `job` (o job de rotina do sistema que a operação
-- reprocessa ou descarta, 3.0 e 5.8), sempre com `autor_operador`. O `DROP` e o `ADD CONSTRAINT` do check seguram `ACCESS EXCLUSIVE` em `auditoria` e o `ADD` varre a tabela debaixo
-- dela, como a 0029: a 0029 já o fez na tabela inteira; o deploy roda fora do horário letivo e o `migrar` corre sob `lock_timeout` de 5 s. Sem `concurrently`, como a Tech Spec do F3, seção 7c.
CREATE TABLE "licenca_de_material" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"licenciante" text NOT NULL,
	"cobertura" text NOT NULL,
	"referencia" text NOT NULL,
	"vigente_desde" date NOT NULL,
	"vigente_ate" date,
	"registrada_por" uuid,
	"registrada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"alterada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "licenca_de_material_escola_id_unico" UNIQUE("escola_id","id"),
	CONSTRAINT "licenca_de_material_licenciante_preenchido" CHECK (char_length(btrim("licenca_de_material"."licenciante")) between 1 and 120),
	CONSTRAINT "licenca_de_material_cobertura_preenchida" CHECK (char_length(btrim("licenca_de_material"."cobertura")) between 1 and 300),
	CONSTRAINT "licenca_de_material_referencia_preenchida" CHECK (char_length(btrim("licenca_de_material"."referencia")) between 1 and 200),
	CONSTRAINT "licenca_de_material_vigencia_valida" CHECK ("licenca_de_material"."vigente_ate" is null or "licenca_de_material"."vigente_ate" >= "licenca_de_material"."vigente_desde")
);
--> statement-breakpoint
ALTER TABLE "auditoria" DROP CONSTRAINT "auditoria_escola_ou_operacao_global";--> statement-breakpoint
ALTER TABLE "material" ADD COLUMN "licenca_id" uuid;--> statement-breakpoint
ALTER TABLE "licenca_de_material" ADD CONSTRAINT "licenca_de_material_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenca_de_material" ADD CONSTRAINT "licenca_de_material_registrada_por_da_escola_fk" FOREIGN KEY ("escola_id","registrada_por") REFERENCES "public"."usuario"("escola_id","id") ON DELETE set null ("registrada_por") ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "licenca_de_material_vigente_ate_idx" ON "licenca_de_material" USING btree ("escola_id","vigente_ate") WHERE "licenca_de_material"."vigente_ate" is not null;--> statement-breakpoint
ALTER TABLE "material" ADD CONSTRAINT "material_licenca_da_escola_fk" FOREIGN KEY ("escola_id","licenca_id") REFERENCES "public"."licenca_de_material"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "material_licenca_idx" ON "material" USING btree ("escola_id","licenca_id") WHERE "material"."licenca_id" is not null;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_escola_ou_operacao_global" CHECK (escola_id is not null or (autor_operador is not null and entidade in ('rede', 'suboperador', 'job')));