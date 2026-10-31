CREATE TABLE "uso_infra_diario" (
	"escola_id" uuid NOT NULL,
	"dia" date NOT NULL,
	"requisicoes" bigint DEFAULT 0 NOT NULL,
	"jobs" bigint DEFAULT 0 NOT NULL,
	"bytes_storage" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "uso_infra_diario_escola_id_dia_pk" PRIMARY KEY("escola_id","dia"),
	CONSTRAINT "uso_infra_diario_valores_nao_negativos" CHECK ("uso_infra_diario"."requisicoes" >= 0 and "uso_infra_diario"."jobs" >= 0 and "uso_infra_diario"."bytes_storage" >= 0)
);
