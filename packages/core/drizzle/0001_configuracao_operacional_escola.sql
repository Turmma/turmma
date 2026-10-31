CREATE TABLE "configuracao_operacional_escola" (
	"escola_id" uuid PRIMARY KEY NOT NULL,
	"fuso" text,
	"dias_letivos" smallint[],
	"inicio" time,
	"fim" time,
	"limite_req_usuario_min" integer,
	"limite_req_escola_min" integer,
	"vagas" jsonb,
	CONSTRAINT "configuracao_operacional_limite_usuario_positivo" CHECK ("configuracao_operacional_escola"."limite_req_usuario_min" > 0),
	CONSTRAINT "configuracao_operacional_limite_escola_positivo" CHECK ("configuracao_operacional_escola"."limite_req_escola_min" > 0),
	CONSTRAINT "configuracao_operacional_vagas_validas" CHECK ("configuracao_operacional_escola"."vagas" is null or (
        jsonb_typeof("configuracao_operacional_escola"."vagas") = 'object'
        and "configuracao_operacional_escola"."vagas" - 'interativa' - 'normal' - 'lote' = '{}'::jsonb
        and not jsonb_path_exists("configuracao_operacional_escola"."vagas", '$.* ? (@.type() != "number" || @ < 1 || @ != @.floor())')
      )),
	CONSTRAINT "configuracao_operacional_dias_letivos_validos" CHECK ("configuracao_operacional_escola"."dias_letivos" <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[])
);
