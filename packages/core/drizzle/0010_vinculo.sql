-- O vínculo pessoa × turma × disciplina do ano letivo (tarefa 9.0): nasce pendente pela escola, e só o confirmado dá
-- acesso. FK composta pela escola e pelo ano da turma, índice único parcial fora do encerrado (a disciplina ausente conta
-- como uma só) e índices que começam pelo escopo. Tabela nova e vazia: só expande (regra 80, item 9).
CREATE TABLE "vinculo" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"ano_letivo_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"turma_id" uuid NOT NULL,
	"disciplina_id" uuid,
	"papel" text NOT NULL,
	"estado" text DEFAULT 'pendente' NOT NULL,
	"contestacao" text,
	"complemento" varchar(140),
	"motivo_encerramento" text,
	"criado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"decidido_em" timestamp with time zone,
	"encerrado_em" timestamp with time zone,
	CONSTRAINT "vinculo_escola_id_unico" UNIQUE("escola_id","id"),
	CONSTRAINT "vinculo_papel_valido" CHECK ("vinculo"."papel" in ('professor', 'aluno')),
	CONSTRAINT "vinculo_estado_valido" CHECK ("vinculo"."estado" in ('pendente', 'confirmado', 'contestado', 'encerrado')),
	CONSTRAINT "vinculo_contestacao_valida" CHECK ("vinculo"."contestacao" is null or "vinculo"."contestacao" in ('nao_leciono', 'turma_errada', 'disciplina_errada', 'outro')),
	CONSTRAINT "vinculo_contestado_tem_codigo" CHECK ("vinculo"."estado" <> 'contestado' or "vinculo"."contestacao" is not null),
	CONSTRAINT "vinculo_complemento_so_com_codigo" CHECK ("vinculo"."complemento" is null or "vinculo"."contestacao" is not null),
	CONSTRAINT "vinculo_complemento_preenchido" CHECK ("vinculo"."complemento" is null or char_length(btrim("vinculo"."complemento")) between 1 and 140),
	CONSTRAINT "vinculo_motivo_encerramento_valido" CHECK ("vinculo"."motivo_encerramento" is null or "vinculo"."motivo_encerramento" in ('fim_do_ano', 'desligamento', 'realocacao')),
	CONSTRAINT "vinculo_encerrado_tem_motivo" CHECK (("vinculo"."estado" = 'encerrado') = ("vinculo"."motivo_encerramento" is not null and "vinculo"."encerrado_em" is not null))
);
--> statement-breakpoint
ALTER TABLE "vinculo" ADD CONSTRAINT "vinculo_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculo" ADD CONSTRAINT "vinculo_turma_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","turma_id") REFERENCES "public"."turma"("escola_id","ano_letivo_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculo" ADD CONSTRAINT "vinculo_usuario_da_escola_fk" FOREIGN KEY ("escola_id","usuario_id") REFERENCES "public"."usuario"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculo" ADD CONSTRAINT "vinculo_disciplina_da_escola_fk" FOREIGN KEY ("escola_id","disciplina_id") REFERENCES "public"."disciplina"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vinculo" ADD CONSTRAINT "vinculo_criado_por_da_escola_fk" FOREIGN KEY ("escola_id","criado_por") REFERENCES "public"."usuario"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vinculo_ativo_unico" ON "vinculo" USING btree ("escola_id","ano_letivo_id","usuario_id","turma_id",coalesce("disciplina_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "vinculo"."estado" <> 'encerrado';--> statement-breakpoint
CREATE INDEX "vinculo_usuario_idx" ON "vinculo" USING btree ("escola_id","ano_letivo_id","usuario_id","estado");--> statement-breakpoint
CREATE INDEX "vinculo_turma_idx" ON "vinculo" USING btree ("escola_id","ano_letivo_id","turma_id","estado");