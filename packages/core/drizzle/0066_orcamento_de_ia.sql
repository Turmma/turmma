-- O orçamento de IA no banco (camada-ia, tarefa 2.0; Tech Spec, seção 3; D39, D41; regra 80, item 9). Só expande: o código anterior ignora as colunas e a tabela, e nenhuma linha muda.
-- 1. `configuracao_operacional_escola` e `rede` ganham o valor de IA por aluno (micros, > 0) e o teto de segurança (100 a 1000), nulos: nulo vale o da rede e, sem ele, o padrão do código (200%).
-- 2. `orcamento_ia_do_mes`: o retrato do mês, com `pk (escola_id, mes)`, sem `ano_letivo_id` (série no tempo).
-- 3. `consumo_ia.pelo_provedor_de_reserva boolean not null default false`: o `default` constante não reescreve a tabela (Postgres 11 em diante), e as linhas de antes ficam falsas.
-- As tabelas de configuração e de rede têm uma linha por escola e por rede: os checks varrem poucas linhas. O `lock_timeout` de 5 s desfaz a transação do `migrar` se a trava não vier (deploy fora do horário letivo). O índice do mês
-- do consumo, que lê a tabela grande, é a migration seguinte, à parte (`0067`).
SET LOCAL lock_timeout = '5s';--> statement-breakpoint
CREATE TABLE "orcamento_ia_do_mes" (
	"escola_id" uuid NOT NULL,
	"mes" date NOT NULL,
	"alunos_ativos" integer NOT NULL,
	"valor_por_aluno_micros" bigint,
	"teto_percentual" smallint NOT NULL,
	"origem_do_valor" text NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orcamento_ia_do_mes_escola_id_mes_pk" PRIMARY KEY("escola_id","mes"),
	CONSTRAINT "orcamento_ia_do_mes_mes_e_dia_1" CHECK (extract(day from "orcamento_ia_do_mes"."mes") = 1),
	CONSTRAINT "orcamento_ia_do_mes_alunos_nao_negativo" CHECK ("orcamento_ia_do_mes"."alunos_ativos" >= 0),
	CONSTRAINT "orcamento_ia_do_mes_valor_positivo" CHECK ("orcamento_ia_do_mes"."valor_por_aluno_micros" > 0),
	CONSTRAINT "orcamento_ia_do_mes_teto_valido" CHECK ("orcamento_ia_do_mes"."teto_percentual" between 100 and 1000),
	CONSTRAINT "orcamento_ia_do_mes_origem_valida" CHECK ("orcamento_ia_do_mes"."origem_do_valor" in ('escola', 'rede', 'nenhuma')),
	CONSTRAINT "orcamento_ia_do_mes_origem_diz_o_valor" CHECK (("orcamento_ia_do_mes"."origem_do_valor" = 'nenhuma') = ("orcamento_ia_do_mes"."valor_por_aluno_micros" is null))
);
--> statement-breakpoint
ALTER TABLE "configuracao_operacional_escola" ADD COLUMN "ia_valor_por_aluno_micros" bigint;--> statement-breakpoint
ALTER TABLE "configuracao_operacional_escola" ADD COLUMN "ia_teto_de_seguranca_percentual" smallint;--> statement-breakpoint
ALTER TABLE "consumo_ia" ADD COLUMN "pelo_provedor_de_reserva" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "rede" ADD COLUMN "ia_valor_por_aluno_micros" bigint;--> statement-breakpoint
ALTER TABLE "rede" ADD COLUMN "ia_teto_de_seguranca_percentual" smallint;--> statement-breakpoint
ALTER TABLE "orcamento_ia_do_mes" ADD CONSTRAINT "orcamento_ia_do_mes_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "configuracao_operacional_escola" ADD CONSTRAINT "configuracao_operacional_ia_valor_positivo" CHECK ("configuracao_operacional_escola"."ia_valor_por_aluno_micros" > 0);--> statement-breakpoint
ALTER TABLE "configuracao_operacional_escola" ADD CONSTRAINT "configuracao_operacional_ia_teto_valido" CHECK ("configuracao_operacional_escola"."ia_teto_de_seguranca_percentual" between 100 and 1000);--> statement-breakpoint
ALTER TABLE "rede" ADD CONSTRAINT "rede_ia_valor_positivo" CHECK ("rede"."ia_valor_por_aluno_micros" > 0);--> statement-breakpoint
ALTER TABLE "rede" ADD CONSTRAINT "rede_ia_teto_valido" CHECK ("rede"."ia_teto_de_seguranca_percentual" between 100 and 1000);