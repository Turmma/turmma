-- A lista de nomes da turma (A1, tarefa 2.0; Tech Spec da A1, seção 3): o nome e a matrícula que a coordenação sobe e o
-- aluno reivindica. Tabela nova e vazia: só expande (regra 80, item 9), e o código anterior não a conhece.
--
-- - `lista_nome_aprovado_sem_nome`: aprovado ⇔ usuario_id ⇔ nome e matrícula nulos (o aprovado guarda só o estado e
--   o usuário; nome e matrícula passam ao `usuario` e à `credencial_matricula`, `docs/lgpd.md`).
-- - A turma, o usuário e o autor por FK composta com a escola. A da turma e a do usuário, sem ação: a turma com nome na
--   lista não se exclui (`CONFLITO`), e a eliminação do aluno apaga a linha dele antes (10.0). A do autor, escrita à mão
--   com `SET NULL ("criado_por")` (Postgres 15+): o `set null` que o drizzle-kit gera anularia também a `escola_id`, que
--   é `not null`. A eliminação de quem subiu a lista não apaga a lista, e a autoria fica na auditoria (`lista.gravada`).
-- - A matrícula é única na escola e no ano (regra 60, item 6), com `btrim`: é o alvo do `on conflict do nothing` da
--   gravação (C8). O aprovado, sem matrícula, não colide.
-- - O índice da turma começa pelo escopo (regra 80, item 8).
CREATE TABLE "lista_nome" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"ano_letivo_id" uuid NOT NULL,
	"turma_id" uuid NOT NULL,
	"nome" text,
	"matricula" text,
	"estado" text DEFAULT 'livre' NOT NULL,
	"usuario_id" uuid,
	"criado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lista_nome_escola_id_unico" UNIQUE("escola_id","id"),
	CONSTRAINT "lista_nome_estado_valido" CHECK ("lista_nome"."estado" in ('livre', 'reivindicado', 'aprovado')),
	CONSTRAINT "lista_nome_aprovado_sem_nome" CHECK (("lista_nome"."estado" = 'aprovado') = ("lista_nome"."usuario_id" is not null) and ("lista_nome"."usuario_id" is not null) = ("lista_nome"."nome" is null) and ("lista_nome"."nome" is null) = ("lista_nome"."matricula" is null)),
	CONSTRAINT "lista_nome_nome_formato" CHECK ("lista_nome"."nome" is null or (char_length("lista_nome"."nome") between 1 and 200 and "lista_nome"."nome" = btrim("lista_nome"."nome"))),
	CONSTRAINT "lista_nome_matricula_formato" CHECK ("lista_nome"."matricula" is null or (char_length("lista_nome"."matricula") between 1 and 40 and "lista_nome"."matricula" = btrim("lista_nome"."matricula")))
);
--> statement-breakpoint
ALTER TABLE "lista_nome" ADD CONSTRAINT "lista_nome_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lista_nome" ADD CONSTRAINT "lista_nome_turma_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","turma_id") REFERENCES "public"."turma"("escola_id","ano_letivo_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lista_nome" ADD CONSTRAINT "lista_nome_usuario_da_escola_fk" FOREIGN KEY ("escola_id","usuario_id") REFERENCES "public"."usuario"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lista_nome" ADD CONSTRAINT "lista_nome_criado_por_da_escola_fk" FOREIGN KEY ("escola_id","criado_por") REFERENCES "public"."usuario"("escola_id","id") ON DELETE SET NULL ("criado_por") ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lista_nome_matricula_no_ano_unica" ON "lista_nome" USING btree ("escola_id","ano_letivo_id",btrim("matricula"));--> statement-breakpoint
CREATE INDEX "lista_nome_turma_idx" ON "lista_nome" USING btree ("escola_id","ano_letivo_id","turma_id","estado");