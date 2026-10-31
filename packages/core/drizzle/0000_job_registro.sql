CREATE TABLE "job_registro" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid,
	"fila" text NOT NULL,
	"prioridade" smallint NOT NULL,
	"tipo" text NOT NULL,
	"dados" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"nao_urgente" boolean DEFAULT false NOT NULL,
	"estado" text DEFAULT 'aguardando' NOT NULL,
	"requisicao_id" uuid,
	"reservado_ate" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"iniciado_em" timestamp with time zone,
	"concluido_em" timestamp with time zone,
	"codigo_falha" text,
	CONSTRAINT "job_registro_escola_ou_sistema" CHECK (escola_id is not null or tipo like 'sistema.%'),
	CONSTRAINT "job_registro_estado_valido" CHECK (estado in ('aguardando', 'reservado', 'publicado', 'ativo', 'concluido', 'falhou')),
	CONSTRAINT "job_registro_fila_valida" CHECK (fila in ('interativa', 'normal', 'lote'))
);
--> statement-breakpoint
CREATE INDEX "job_registro_pendentes_idx" ON "job_registro" USING btree ("fila","escola_id","criado_em") WHERE estado not in ('concluido', 'falhou');--> statement-breakpoint
CREATE INDEX "job_registro_finalizados_idx" ON "job_registro" USING btree ("concluido_em") WHERE estado in ('concluido', 'falhou');