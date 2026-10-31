-- O pedido de reivindicação (A1, tarefa 6.0; Tech Spec da A1, seção 3): o aluno pede, pela página pública da sala, o
-- nome da lista que é dele, com a matrícula e a senha que criou, e uma pessoa decide (8.0). Tabela nova e vazia: só
-- expande (regra 80, item 9), e o código anterior não a conhece.
--
-- - `reivindicacao_segredo_so_pendente`: o hash da senha, a chave de envio e o `teve_matricula_errada` existem só no
--   pendente, e o pendente tem os três (`docs/lgpd.md`: apagados na decisão ou no encerramento).
-- - `reivindicacao_pendente_com_nome`: o pendente sempre aponta para o nome. Apagar o nome de um pendente (o `set null`
--   da FK) falha: quem fecha o ano ou elimina o aluno fecha ou apaga o pedido antes, e nenhum hash fica sem nome.
-- - O nome por FK composta com a escola, escrita à mão com `SET NULL ("lista_nome_id")` (Postgres 15+): o `set null`
--   que o drizzle-kit gera anularia também a `escola_id`, que é `not null`. O nome que sai da lista deixa o pedido
--   decidido sem nome; o de outra escola, ou inexistente, é recusado pela FK no `insert`.
-- - A turma por FK composta com a escola e o ano, sem ação: a turma com pedido não se exclui (`CONFLITO`).
-- - Quem decidiu por FK composta com a escola, escrita à mão com `SET NULL ("decidida_por")`, pelo mesmo motivo: a
--   eliminação do professor não apaga o pedido, e a autoria fica na auditoria.
-- - A chave de envio é única na escola, e há um pendente por nome (índices únicos parciais): o reenvio e a corrida no
--   mesmo nome caem no 23505, e quem grava relê a chave, sem ler o nome da restrição (Tech Spec, seção 5). A chave vem
--   antes na ordem dos índices; o C2 (c) do teste recria o índice dela depois do outro, e o resultado é o mesmo.
-- - Os índices começam pelo escopo (regra 80, item 8): o da turma, para os pedidos (8.0); o do nome, para o `set null`
--   da FK achar os pedidos do nome que sai sem varrer os da escola.
CREATE TABLE "reivindicacao" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"ano_letivo_id" uuid NOT NULL,
	"turma_id" uuid NOT NULL,
	"lista_nome_id" uuid,
	"chave_envio" uuid,
	"senha_hash" text,
	"teve_matricula_errada" boolean,
	"estado" text DEFAULT 'pendente' NOT NULL,
	"solicitada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"decidida_em" timestamp with time zone,
	"decidida_por" uuid,
	"decidida_como" text,
	CONSTRAINT "reivindicacao_escola_id_unico" UNIQUE("escola_id","id"),
	CONSTRAINT "reivindicacao_estado_valido" CHECK ("reivindicacao"."estado" in ('pendente', 'aprovada', 'recusada', 'encerrada')),
	CONSTRAINT "reivindicacao_pendente_com_nome" CHECK ("reivindicacao"."estado" <> 'pendente' or "reivindicacao"."lista_nome_id" is not null),
	CONSTRAINT "reivindicacao_decidida_como_valida" CHECK ("reivindicacao"."decidida_como" is null or "reivindicacao"."decidida_como" in ('professor', 'coordenacao')),
	CONSTRAINT "reivindicacao_segredo_so_pendente" CHECK (("reivindicacao"."estado" = 'pendente') = ("reivindicacao"."senha_hash" is not null) and ("reivindicacao"."senha_hash" is not null) = ("reivindicacao"."chave_envio" is not null) and ("reivindicacao"."chave_envio" is not null) = ("reivindicacao"."teve_matricula_errada" is not null))
);
--> statement-breakpoint
ALTER TABLE "reivindicacao" ADD CONSTRAINT "reivindicacao_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reivindicacao" ADD CONSTRAINT "reivindicacao_turma_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","turma_id") REFERENCES "public"."turma"("escola_id","ano_letivo_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reivindicacao" ADD CONSTRAINT "reivindicacao_nome_da_escola_fk" FOREIGN KEY ("escola_id","lista_nome_id") REFERENCES "public"."lista_nome"("escola_id","id") ON DELETE SET NULL ("lista_nome_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reivindicacao" ADD CONSTRAINT "reivindicacao_decidida_por_da_escola_fk" FOREIGN KEY ("escola_id","decidida_por") REFERENCES "public"."usuario"("escola_id","id") ON DELETE SET NULL ("decidida_por") ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reivindicacao_chave_na_escola_unica" ON "reivindicacao" USING btree ("escola_id","chave_envio") WHERE "reivindicacao"."chave_envio" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "reivindicacao_pendente_por_nome" ON "reivindicacao" USING btree ("escola_id","lista_nome_id") WHERE "reivindicacao"."estado" = 'pendente';--> statement-breakpoint
CREATE INDEX "reivindicacao_turma_idx" ON "reivindicacao" USING btree ("escola_id","turma_id","estado","solicitada_em");--> statement-breakpoint
CREATE INDEX "reivindicacao_nome_idx" ON "reivindicacao" USING btree ("escola_id","lista_nome_id");