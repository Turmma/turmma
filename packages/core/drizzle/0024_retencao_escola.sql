-- O ajuste de retenção da escola (F3, tarefa 2.0; Tech Spec do F3, seção 3): uma linha por escola e categoria, só quando
-- a operação ajustou pelo `ops:retencao`; sem linha, vale o padrão do catálogo em código (`CATEGORIAS_DE_RETENCAO`).
-- Tabela nova e vazia: só expande (regra 80, item 9), e o código anterior não a conhece.
--
-- - `retencao_escola_categoria_valida`: as doze categorias do catálogo, por extenso; o teste da migration compara com
--   `CHAVES_DE_RETENCAO`. Os prazos fixos não se ajustam e não têm linha.
-- - `retencao_escola_meses_validos`: rede de segurança. O piso, o teto e as travas de cada categoria são do comando.
-- - `referencia_contrato`: o número do contrato ou do aditivo, inteiro positivo, que vai também para a auditoria.
-- - `alterada_por`: o apelido do operador, com a mesma expressão de `FORMATO_OPERADOR`.
-- - Sem índice além da chave primária: a leitura é sempre a escola inteira, pela chave (`escola_id`, `categoria`).
CREATE TABLE "retencao_escola" (
	"escola_id" uuid NOT NULL,
	"categoria" text NOT NULL,
	"meses" smallint NOT NULL,
	"referencia_contrato" integer NOT NULL,
	"alterada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"alterada_por" text NOT NULL,
	CONSTRAINT "retencao_escola_pk" PRIMARY KEY("escola_id","categoria"),
	CONSTRAINT "retencao_escola_categoria_valida" CHECK ("retencao_escola"."categoria" in ('conversa_tutor', 'sinal_tutor', 'conversa_professor', 'execucao_agente', 'texto_do_modelo', 'consumo_por_aluno', 'trabalho_do_aluno', 'reivindicacao_decidida', 'autoria_de_artefato', 'material_excluido', 'vinculo_encerrado', 'pessoa_desativada')),
	CONSTRAINT "retencao_escola_meses_validos" CHECK ("retencao_escola"."meses" between 1 and 60),
	CONSTRAINT "retencao_escola_referencia_positiva" CHECK ("retencao_escola"."referencia_contrato" > 0),
	CONSTRAINT "retencao_escola_alterada_por_formato" CHECK ("retencao_escola"."alterada_por" ~ '^[a-z][a-z0-9-]{1,31}$')
);
--> statement-breakpoint
ALTER TABLE "retencao_escola" ADD CONSTRAINT "retencao_escola_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;