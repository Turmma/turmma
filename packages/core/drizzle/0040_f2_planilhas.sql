-- O banco do F2 (tarefa 2.0): as tabelas das planilhas, a chave da turma e a origem do vínculo.
-- Só expande (regra 80, item 9): tabela e coluna novas, nenhuma apagada nem renomeada. O código anterior não conhece a `turma.chave`
-- (a ignora) e o `vinculo.origem` nasce `coordenacao` nas linhas que já existem. Voltar a versão: `docs/runbook.md`, "Voltar o código
-- depois da chave da turma".
-- A FK de `importacao_planilha.criado_por` anula só o autor (`on delete set null ("criado_por")`, à mão, como na `lista_nome`): o `set null`
-- inteiro anularia também a escola.
CREATE TABLE "alocacao" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"ano_letivo_id" uuid NOT NULL,
	"vinculo_id" uuid NOT NULL,
	"dia_semana" smallint NOT NULL,
	"inicio" time NOT NULL,
	"fim" time NOT NULL,
	"sala" text,
	CONSTRAINT "alocacao_vinculo_dia_inicio_unico" UNIQUE("vinculo_id","dia_semana","inicio"),
	CONSTRAINT "alocacao_dia_da_semana_valido" CHECK ("alocacao"."dia_semana" between 1 and 7),
	CONSTRAINT "alocacao_horario_valido" CHECK ("alocacao"."inicio" < "alocacao"."fim")
);
--> statement-breakpoint
CREATE TABLE "evento_calendario" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"ano_letivo_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"inicio" date NOT NULL,
	"fim" date NOT NULL,
	"descricao" text NOT NULL,
	CONSTRAINT "evento_calendario_tipo_valido" CHECK ("evento_calendario"."tipo" in ('feriado', 'recesso', 'evento')),
	CONSTRAINT "evento_calendario_periodo_valido" CHECK ("evento_calendario"."inicio" <= "evento_calendario"."fim"),
	CONSTRAINT "evento_calendario_descricao_preenchida" CHECK (char_length(btrim("evento_calendario"."descricao")) between 1 and 120)
);
--> statement-breakpoint
CREATE TABLE "importacao_planilha" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"ano_letivo_id" uuid,
	"tipo" text NOT NULL,
	"estado" text DEFAULT 'na_fila' NOT NULL,
	"linhas" jsonb,
	"marcas" jsonb,
	"assinatura" text NOT NULL,
	"resumo" jsonb,
	"erro" text,
	"criado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"concluida_em" timestamp with time zone,
	CONSTRAINT "importacao_planilha_escola_id_unico" UNIQUE("escola_id","id"),
	CONSTRAINT "importacao_planilha_tipo_valido" CHECK ("importacao_planilha"."tipo" in ('alunos', 'professores', 'grade', 'calendario')),
	CONSTRAINT "importacao_planilha_estado_valido" CHECK ("importacao_planilha"."estado" in ('na_fila', 'concluida', 'desatualizada', 'falhou')),
	CONSTRAINT "importacao_planilha_erro_valido" CHECK ("importacao_planilha"."erro" is null or "importacao_planilha"."erro" in ('expirou', 'trava_esgotada', 'erro_interno')),
	CONSTRAINT "importacao_planilha_ano_ou_professores" CHECK ("importacao_planilha"."ano_letivo_id" is not null or "importacao_planilha"."tipo" = 'professores')
);
--> statement-breakpoint
ALTER TABLE "turma" ADD COLUMN "chave" text;--> statement-breakpoint
ALTER TABLE "vinculo" ADD COLUMN "origem" text DEFAULT 'coordenacao' NOT NULL;--> statement-breakpoint
ALTER TABLE "vinculo" ADD CONSTRAINT "vinculo_escola_ano_id_unico" UNIQUE("escola_id","ano_letivo_id","id");--> statement-breakpoint
ALTER TABLE "alocacao" ADD CONSTRAINT "alocacao_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alocacao" ADD CONSTRAINT "alocacao_vinculo_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","vinculo_id") REFERENCES "public"."vinculo"("escola_id","ano_letivo_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_calendario" ADD CONSTRAINT "evento_calendario_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_calendario" ADD CONSTRAINT "evento_calendario_ano_letivo_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id") REFERENCES "public"."ano_letivo"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "importacao_planilha" ADD CONSTRAINT "importacao_planilha_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "importacao_planilha" ADD CONSTRAINT "importacao_planilha_ano_letivo_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id") REFERENCES "public"."ano_letivo"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "importacao_planilha" ADD CONSTRAINT "importacao_planilha_criado_por_da_escola_fk" FOREIGN KEY ("escola_id","criado_por") REFERENCES "public"."usuario"("escola_id","id") ON DELETE set null ("criado_por") ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alocacao_ano_idx" ON "alocacao" USING btree ("escola_id","ano_letivo_id");--> statement-breakpoint
CREATE INDEX "evento_calendario_ano_idx" ON "evento_calendario" USING btree ("escola_id","ano_letivo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "importacao_planilha_uma_na_fila_por_escola" ON "importacao_planilha" USING btree ("escola_id") WHERE "importacao_planilha"."estado" = 'na_fila';--> statement-breakpoint
CREATE INDEX "importacao_planilha_na_fila_idx" ON "importacao_planilha" USING btree ("criado_em") WHERE "importacao_planilha"."estado" = 'na_fila';--> statement-breakpoint
-- A chave das turmas que já existem, só onde é única no ano (Tech Spec, seção 3): duas turmas de mesma chave no ano ("8ºA" e "8A")
-- ficam as duas sem chave, e a prévia as acusa como erro. É a mesma conta de `chaveDaTurma` (`packages/shared/src/importacao/normalizador.ts`):
-- tira o acento e a caixa, e o que sobra é um dígito, o ordinal e a palavra "ano" opcionais e uma letra.
WITH calculada AS (
	SELECT "id", "escola_id", "ano_letivo_id",
		regexp_match(lower(translate(btrim("nome"), 'áàâãäÁÀÂÃÄéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇ', 'aaaaaaaaaaeeeeeeeeiiiiiiiioooooooooouuuuuuuucc')), '^(\d)\s*[ºo°ª]?\s*(ano)?\s*([a-z])$') AS "achado"
	FROM "turma"
), com_chave AS (
	SELECT "id", "escola_id", "ano_letivo_id", "achado"[1] || "achado"[3] AS "chave"
	FROM calculada
	WHERE "achado" IS NOT NULL
), unica AS (
	SELECT "id", "chave"
	FROM (SELECT "id", "chave", count(*) OVER (PARTITION BY "escola_id", "ano_letivo_id", "chave") AS "total" FROM com_chave) contada
	WHERE "total" = 1
)
UPDATE "turma" SET "chave" = unica."chave" FROM unica WHERE "turma"."id" = unica."id";--> statement-breakpoint
CREATE UNIQUE INDEX "turma_chave_no_ano_unica" ON "turma" USING btree ("escola_id","ano_letivo_id","chave") WHERE "turma"."chave" is not null;--> statement-breakpoint
ALTER TABLE "vinculo" ADD CONSTRAINT "vinculo_origem_valida" CHECK ("vinculo"."origem" in ('coordenacao', 'grade', 'lista'));