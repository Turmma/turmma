-- A prova online (avaliacao-e-correcao, tarefa 1.0; Tech Spec, seção 3; regra 80, item 9). Só expande: o código anterior ignora as colunas e as tabelas, e nenhuma coluna sai.
-- 1. `atividade_aplicada` ganha a janela (`abre_em`, `fecha_em`), a duração, o embaralhamento e `segunda_chamada_de`; `tentativa_atividade`, o limite base, a ordem do aluno, a contagem de saídas da aba e como foi enviada.
--    As colunas novas são nulas ou têm `default` constante (não reescrevem a tabela), e as linhas de antes ficam como estavam: a avaliativa antiga segue sem janela, sem backfill.
-- 2. Os checks novos em tabela existente entram `NOT VALID` e são validados em seguida. Aqui a validação **não** deixa a escrita passar: o `migrar` roda tudo numa transação só, e o `ADD CONSTRAINT … NOT VALID` já tomou a trava (`ACCESS EXCLUSIVE`, ou `SHARE ROW EXCLUSIVE` na chave estrangeira) que dura até o fim dela, então o `VALIDATE` percorre a tabela com a escrita parada. Com o volume sintético de hoje cabe; a partir do staging, o `VALIDATE` vai para arquivo próprio (`TODO.md`).
-- 3. O índice das abertas passa a deixar a segunda chamada de fora (a original e ela convivem): o novo é criado antes de derrubar o antigo, com outro nome, e depois recebe o nome do antigo; outro índice garante uma segunda chamada
--    aberta por original, e um terceiro, `(fecha_em)` das provas abertas, é o que a rotina que encerra a prova vencida varre. Sem `concurrently`, a exceção da 0034, da 0057, da 0064 e da 0067 (o `migrar` roda tudo numa transação só):
--    a tabela ainda não tem volume, o deploy roda fora do horário letivo, e o `lock_timeout` de 5 s desfaz a transação se a trava não vier (`TODO.md`, a lista das migrations sem `concurrently`).
-- 4. Seis tabelas novas. As de aluno (`saida_da_aba`, `tempo_adicional`, `extensao_de_tempo`, `convocado_da_segunda_chamada`) têm `escola_id` e `ano_letivo_id`, FK composta, `on delete cascade` do aluno, e o autor conferido pelo gatilho
--    `exigir_equipe_da_escola` (0023). A `saida_da_aba` não tem `id` nem horário, e a chave é uuid v4 (o v7 traz o instante). `pulso_da_api` e `indisponibilidade` são fato global, sem `escola_id` (exceção do item 1 de `docs/modelo-de-dados.md`).
SET LOCAL lock_timeout = '5s';--> statement-breakpoint
CREATE TABLE "convocado_da_segunda_chamada" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"ano_letivo_id" uuid NOT NULL,
	"atividade_aplicada_id" uuid NOT NULL,
	"aluno_id" uuid NOT NULL,
	CONSTRAINT "convocado_da_segunda_chamada_um_por_aluno" UNIQUE("escola_id","atividade_aplicada_id","aluno_id")
);
--> statement-breakpoint
CREATE TABLE "extensao_de_tempo" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"ano_letivo_id" uuid NOT NULL,
	"atividade_aplicada_id" uuid NOT NULL,
	"aluno_id" uuid,
	"minutos" smallint NOT NULL,
	"concedida_por" uuid NOT NULL,
	"concedida_em" timestamp with time zone DEFAULT now() NOT NULL,
	"chave" uuid NOT NULL,
	CONSTRAINT "extensao_de_tempo_chave_por_aplicacao" UNIQUE("escola_id","atividade_aplicada_id","chave"),
	CONSTRAINT "extensao_de_tempo_minutos_validos" CHECK ("extensao_de_tempo"."minutos" between 1 and 120)
);
--> statement-breakpoint
CREATE TABLE "indisponibilidade" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"inicio" timestamp with time zone NOT NULL,
	"fim" timestamp with time zone NOT NULL,
	CONSTRAINT "indisponibilidade_ordenada" CHECK ("indisponibilidade"."inicio" < "indisponibilidade"."fim")
);
--> statement-breakpoint
CREATE TABLE "pulso_da_api" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"ultimo_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saida_da_aba" (
	"escola_id" uuid NOT NULL,
	"ano_letivo_id" uuid NOT NULL,
	"atividade_aplicada_id" uuid NOT NULL,
	"aluno_id" uuid NOT NULL,
	"chave" uuid NOT NULL,
	CONSTRAINT "saida_da_aba_pk" PRIMARY KEY("escola_id","ano_letivo_id","atividade_aplicada_id","aluno_id","chave"),
	CONSTRAINT "saida_da_aba_chave_v4" CHECK (substring("saida_da_aba"."chave"::text from 15 for 1) = '4')
);
--> statement-breakpoint
CREATE TABLE "tempo_adicional" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"ano_letivo_id" uuid NOT NULL,
	"atividade_aplicada_id" uuid NOT NULL,
	"aluno_id" uuid NOT NULL,
	"percentual" smallint NOT NULL,
	"concedido_por" uuid NOT NULL,
	"concedido_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tempo_adicional_um_por_aluno" UNIQUE("escola_id","atividade_aplicada_id","aluno_id"),
	CONSTRAINT "tempo_adicional_percentual_valido" CHECK ("tempo_adicional"."percentual" in (25, 50, 100))
);
--> statement-breakpoint
ALTER TABLE "atividade_aplicada" ADD COLUMN "abre_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "atividade_aplicada" ADD COLUMN "fecha_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "atividade_aplicada" ADD COLUMN "duracao_min" smallint;--> statement-breakpoint
ALTER TABLE "atividade_aplicada" ADD COLUMN "embaralhar_questoes" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "atividade_aplicada" ADD COLUMN "embaralhar_alternativas" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "atividade_aplicada" ADD COLUMN "segunda_chamada_de" uuid;--> statement-breakpoint
ALTER TABLE "tentativa_atividade" ADD COLUMN "limite_base_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tentativa_atividade" ADD COLUMN "ordem" jsonb;--> statement-breakpoint
ALTER TABLE "tentativa_atividade" ADD COLUMN "saidas_da_aba" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tentativa_atividade" ADD COLUMN "envio" text;--> statement-breakpoint
ALTER TABLE "convocado_da_segunda_chamada" ADD CONSTRAINT "convocado_da_segunda_chamada_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convocado_da_segunda_chamada" ADD CONSTRAINT "convocado_da_segunda_chamada_aplicacao_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","atividade_aplicada_id") REFERENCES "public"."atividade_aplicada"("escola_id","ano_letivo_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "convocado_da_segunda_chamada" ADD CONSTRAINT "convocado_da_segunda_chamada_aluno_da_escola_fk" FOREIGN KEY ("escola_id","aluno_id") REFERENCES "public"."usuario"("escola_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extensao_de_tempo" ADD CONSTRAINT "extensao_de_tempo_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extensao_de_tempo" ADD CONSTRAINT "extensao_de_tempo_aplicacao_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","atividade_aplicada_id") REFERENCES "public"."atividade_aplicada"("escola_id","ano_letivo_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extensao_de_tempo" ADD CONSTRAINT "extensao_de_tempo_aluno_da_escola_fk" FOREIGN KEY ("escola_id","aluno_id") REFERENCES "public"."usuario"("escola_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saida_da_aba" ADD CONSTRAINT "saida_da_aba_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saida_da_aba" ADD CONSTRAINT "saida_da_aba_tentativa_fk" FOREIGN KEY ("escola_id","ano_letivo_id","atividade_aplicada_id","aluno_id") REFERENCES "public"."tentativa_atividade"("escola_id","ano_letivo_id","atividade_aplicada_id","aluno_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tempo_adicional" ADD CONSTRAINT "tempo_adicional_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tempo_adicional" ADD CONSTRAINT "tempo_adicional_aplicacao_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","atividade_aplicada_id") REFERENCES "public"."atividade_aplicada"("escola_id","ano_letivo_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tempo_adicional" ADD CONSTRAINT "tempo_adicional_aluno_da_escola_fk" FOREIGN KEY ("escola_id","aluno_id") REFERENCES "public"."usuario"("escola_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "convocado_da_segunda_chamada_aluno_idx" ON "convocado_da_segunda_chamada" USING btree ("escola_id","aluno_id");--> statement-breakpoint
CREATE INDEX "extensao_de_tempo_aluno_idx" ON "extensao_de_tempo" USING btree ("escola_id","aluno_id");--> statement-breakpoint
CREATE INDEX "indisponibilidade_fim_idx" ON "indisponibilidade" USING btree ("fim");--> statement-breakpoint
CREATE UNIQUE INDEX "pulso_da_api_linha_unica" ON "pulso_da_api" USING btree ((true));--> statement-breakpoint
CREATE INDEX "tempo_adicional_aluno_idx" ON "tempo_adicional" USING btree ("escola_id","aluno_id");--> statement-breakpoint
-- A chave que a FK abaixo referencia tem de existir antes dela.
ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_escola_ano_turma_artefato_id_unico" UNIQUE("escola_id","ano_letivo_id","turma_id","artefato_id","id");--> statement-breakpoint
ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_segunda_chamada_da_original_fk" FOREIGN KEY ("escola_id","ano_letivo_id","turma_id","artefato_id","segunda_chamada_de") REFERENCES "public"."atividade_aplicada"("escola_id","ano_letivo_id","turma_id","artefato_id","id") ON DELETE no action ON UPDATE no action NOT VALID;--> statement-breakpoint
CREATE UNIQUE INDEX "atividade_aplicada_segunda_chamada_aberta_unica" ON "atividade_aplicada" USING btree ("escola_id","segunda_chamada_de") WHERE "atividade_aplicada"."estado" = 'aberta' and "atividade_aplicada"."segunda_chamada_de" is not null;--> statement-breakpoint
CREATE INDEX "atividade_aplicada_prova_aberta_idx" ON "atividade_aplicada" USING btree ("fecha_em") WHERE "atividade_aplicada"."avaliativa" and "atividade_aplicada"."estado" = 'aberta' and "atividade_aplicada"."fecha_em" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "atividade_aplicada_aberta_unica_nova" ON "atividade_aplicada" USING btree ("escola_id","turma_id","artefato_id") WHERE "atividade_aplicada"."estado" = 'aberta' and "atividade_aplicada"."segunda_chamada_de" is null;--> statement-breakpoint
DROP INDEX "atividade_aplicada_aberta_unica";--> statement-breakpoint
ALTER INDEX "atividade_aplicada_aberta_unica_nova" RENAME TO "atividade_aplicada_aberta_unica";--> statement-breakpoint
ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_janela_inteira" CHECK (("atividade_aplicada"."abre_em" is null) = ("atividade_aplicada"."fecha_em" is null)) NOT VALID;--> statement-breakpoint
ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_janela_ordenada" CHECK ("atividade_aplicada"."abre_em" is null or "atividade_aplicada"."abre_em" < "atividade_aplicada"."fecha_em") NOT VALID;--> statement-breakpoint
ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_duracao_valida" CHECK ("atividade_aplicada"."duracao_min" is null or ("atividade_aplicada"."duracao_min" between 5 and 300 and "atividade_aplicada"."abre_em" is not null)) NOT VALID;--> statement-breakpoint
ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_prova_so_na_avaliativa" CHECK ("atividade_aplicada"."avaliativa" or ("atividade_aplicada"."abre_em" is null and "atividade_aplicada"."duracao_min" is null and not "atividade_aplicada"."embaralhar_questoes" and not "atividade_aplicada"."embaralhar_alternativas" and "atividade_aplicada"."segunda_chamada_de" is null)) NOT VALID;--> statement-breakpoint
ALTER TABLE "tentativa_atividade" ADD CONSTRAINT "tentativa_atividade_envio_valido" CHECK ("tentativa_atividade"."envio" is null or ("tentativa_atividade"."envio" in ('aluno', 'limite', 'encerramento') and "tentativa_atividade"."enviada_em" is not null)) NOT VALID;--> statement-breakpoint
ALTER TABLE "tentativa_atividade" ADD CONSTRAINT "tentativa_atividade_saidas_nao_negativas" CHECK ("tentativa_atividade"."saidas_da_aba" >= 0) NOT VALID;--> statement-breakpoint
ALTER TABLE "atividade_aplicada" VALIDATE CONSTRAINT "atividade_aplicada_segunda_chamada_da_original_fk";--> statement-breakpoint
ALTER TABLE "atividade_aplicada" VALIDATE CONSTRAINT "atividade_aplicada_janela_inteira";--> statement-breakpoint
ALTER TABLE "atividade_aplicada" VALIDATE CONSTRAINT "atividade_aplicada_janela_ordenada";--> statement-breakpoint
ALTER TABLE "atividade_aplicada" VALIDATE CONSTRAINT "atividade_aplicada_duracao_valida";--> statement-breakpoint
ALTER TABLE "atividade_aplicada" VALIDATE CONSTRAINT "atividade_aplicada_prova_so_na_avaliativa";--> statement-breakpoint
ALTER TABLE "tentativa_atividade" VALIDATE CONSTRAINT "tentativa_atividade_envio_valido";--> statement-breakpoint
ALTER TABLE "tentativa_atividade" VALIDATE CONSTRAINT "tentativa_atividade_saidas_nao_negativas";--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "tempo_adicional_concedido_por_da_equipe" AFTER INSERT OR UPDATE OF "escola_id", "concedido_por" ON "tempo_adicional"
  FOR EACH ROW EXECUTE FUNCTION "exigir_equipe_da_escola"('concedido_por', 'tempo_adicional_concedido_por_da_escola_fk');--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "extensao_de_tempo_concedida_por_da_equipe" AFTER INSERT OR UPDATE OF "escola_id", "concedida_por" ON "extensao_de_tempo"
  FOR EACH ROW EXECUTE FUNCTION "exigir_equipe_da_escola"('concedida_por', 'extensao_de_tempo_concedida_por_da_escola_fk');--> statement-breakpoint
INSERT INTO "pulso_da_api" ("ultimo_em") VALUES (now());
