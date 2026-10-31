-- O arquivo do titular (F3, tarefa 13.0; Tech Spec do F3, seção 3). Só expande (regra 80, item 9): uma tabela nova e vazia, três
-- índices e uma restrição única que o código anterior não conhece nem viola.
--
-- - `arquivo_titular`: onde o JSON do pedido de acesso ou de portabilidade está no storage privado, e até quando. **Nenhum
--   dado do titular passa por aqui**: só a chave do objeto (que nunca sai pela API), o tamanho e as datas. O check
--   `arquivo_titular_chave_da_escola` amarra a chave à escola, ao pedido e à versão, para uma linha não apontar para o
--   objeto de outra escola. Único `(escola_id, pedido_id, versao)`: dois jobs do mesmo pedido gravam a mesma linha.
-- - `pedido_titular_da_escola_unico`: o apoio da FK composta do arquivo (regra 10). A tabela é nova e pequena (pedidos de
--   privacidade): o índice único se monta na hora, sem `concurrently` enquanto não há staging nem piloto (Tech Spec, seção 7c).
-- - `consumo_ia_execucao_idx`: o ramo da execução do rastro do compartilhamento (12.0) e a contagem do texto do modelo da
--   prévia (11.0) descem por ele, e não leem o consumo da escola inteira. Parcial: `execucao_id` é nulo na chamada sem execução.
-- - `auditoria_escola_autor_idx`: o arquivo lê a auditoria em que o titular é o autor, pela escola e pela pessoa. Sem ele a
--   leitura percorre a auditoria da escola inteira, que cresce com tudo o que se faz. Parcial: o autor é nulo na operação.
CREATE TABLE "arquivo_titular" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"pedido_id" uuid NOT NULL,
	"versao" text NOT NULL,
	"chave_objeto" text NOT NULL,
	"bytes" integer NOT NULL,
	"pronto_em" timestamp with time zone NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"apagado_em" timestamp with time zone,
	CONSTRAINT "arquivo_titular_pedido_versao_unico" UNIQUE("escola_id","pedido_id","versao"),
	CONSTRAINT "arquivo_titular_versao_valida" CHECK ("arquivo_titular"."versao" in ('completa', 'coordenacao')),
	CONSTRAINT "arquivo_titular_chave_da_escola" CHECK ("arquivo_titular"."chave_objeto" = 'titular/' || "arquivo_titular"."escola_id"::text || '/' || "arquivo_titular"."pedido_id"::text || '/' || "arquivo_titular"."versao" || '.json'),
	CONSTRAINT "arquivo_titular_bytes_nao_negativos" CHECK ("arquivo_titular"."bytes" >= 0),
	CONSTRAINT "arquivo_titular_expira_depois_de_pronto" CHECK ("arquivo_titular"."expira_em" > "arquivo_titular"."pronto_em")
);
--> statement-breakpoint
ALTER TABLE "arquivo_titular" ADD CONSTRAINT "arquivo_titular_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- A restrição única nasce antes da FK composta que a referencia (o drizzle-kit a emite por último).
ALTER TABLE "pedido_titular" ADD CONSTRAINT "pedido_titular_da_escola_unico" UNIQUE("escola_id","id");--> statement-breakpoint
ALTER TABLE "arquivo_titular" ADD CONSTRAINT "arquivo_titular_pedido_da_escola_fk" FOREIGN KEY ("escola_id","pedido_id") REFERENCES "public"."pedido_titular"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "arquivo_titular_escola_expira_idx" ON "arquivo_titular" USING btree ("escola_id","expira_em");--> statement-breakpoint
CREATE INDEX "auditoria_escola_autor_idx" ON "auditoria" USING btree ("escola_id","autor_usuario_id","em") WHERE "auditoria"."autor_usuario_id" is not null;--> statement-breakpoint
CREATE INDEX "consumo_ia_execucao_idx" ON "consumo_ia" USING btree ("escola_id","execucao_id") WHERE "consumo_ia"."execucao_id" is not null;
