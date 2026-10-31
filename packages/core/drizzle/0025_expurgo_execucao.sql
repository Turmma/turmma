-- O expurgo noturno da escola (F3, tarefa 3.0; Tech Spec do F3, seções 3, 5 e 7c). Só expande (regra 80, item 9): uma
-- tabela nova e vazia, uma coluna nula e índices; o código anterior não conhece nenhum deles.
--
-- - `expurgo_execucao`: uma linha por categoria percorrida em cada execução, só com a escola, a categoria, a contagem,
--   se terminou e quando. `categoria` com as doze do catálogo, por extenso, como `retencao_escola`.
-- - `job_registro.chave_idempotencia`: o "uma vez só" do `Enfileirador.enfileirarUmaVez`. O único parcial vale só entre
--   os jobs não finalizados (o mesmo predicado do `on conflict`), e o check recusa a chave em job sem escola. A coluna
--   nasce nula em toda linha: o check passa sem reescrever a tabela, que o expurgo de jobs mantém em 7 dias.
-- - `(escola_id, <data>)` em `mensagem_tutor`, `sinal_tutor` e `mensagem_agente`: o lote do expurgo desce do escopo à
--   idade. Sem `concurrently` enquanto não há staging nem piloto (Tech Spec do F3, seção 7c).
CREATE TABLE "expurgo_execucao" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"categoria" text NOT NULL,
	"linhas" integer NOT NULL,
	"concluida" boolean NOT NULL,
	"em" timestamp with time zone NOT NULL,
	CONSTRAINT "expurgo_execucao_categoria_valida" CHECK ("expurgo_execucao"."categoria" in ('conversa_tutor', 'sinal_tutor', 'conversa_professor', 'execucao_agente', 'texto_do_modelo', 'consumo_por_aluno', 'trabalho_do_aluno', 'reivindicacao_decidida', 'autoria_de_artefato', 'material_excluido', 'vinculo_encerrado', 'pessoa_desativada')),
	CONSTRAINT "expurgo_execucao_linhas_nao_negativas" CHECK ("expurgo_execucao"."linhas" >= 0)
);
--> statement-breakpoint
ALTER TABLE "job_registro" ADD COLUMN "chave_idempotencia" text;--> statement-breakpoint
ALTER TABLE "expurgo_execucao" ADD CONSTRAINT "expurgo_execucao_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expurgo_execucao_escola_em_idx" ON "expurgo_execucao" USING btree ("escola_id","em");--> statement-breakpoint
CREATE UNIQUE INDEX "job_registro_chave_idempotencia_unica" ON "job_registro" USING btree ("escola_id","tipo","chave_idempotencia") WHERE chave_idempotencia is not null and estado not in ('concluido', 'falhou');--> statement-breakpoint
CREATE INDEX "mensagem_agente_criada_em_idx" ON "mensagem_agente" USING btree ("escola_id","criada_em");--> statement-breakpoint
CREATE INDEX "mensagem_tutor_criada_em_idx" ON "mensagem_tutor" USING btree ("escola_id","criada_em");--> statement-breakpoint
CREATE INDEX "sinal_tutor_criado_em_idx" ON "sinal_tutor" USING btree ("escola_id","criado_em");--> statement-breakpoint
ALTER TABLE "job_registro" ADD CONSTRAINT "job_registro_chave_so_com_escola" CHECK (chave_idempotencia is null or escola_id is not null);