-- O pedido do titular à escola (F3, tarefa 11.0; Tech Spec do F3, seção 3). Só expande (regra 80, item 9): uma tabela
-- nova e vazia que o código anterior não conhece.
--
-- - `pedido_titular`: id, tipo, quem pediu, datas, estado, autor e a foto do compartilhamento. **Sem nome, sem
--   matrícula e sem texto**: o nome do titular vive no `usuario`, e a lista e o detalhe o trazem só enquanto ele
--   existe. Retenção: vigência + 5 anos, no fim de contrato (F12), como a auditoria (`docs/lgpd.md`).
-- - `titular_id` e `registrado_por` **sem FK**, como o autor da auditoria (0013): a eliminação da pessoa apaga o
--   `usuario` e o pedido fica, com os ids. Os dois gatilhos de inserção reaproveitam o `exigir_usuario_da_escola` dela,
--   que mantém o que a FK garantia na escrita: usuário da escola do registro, com a linha travada até o commit.
-- - `escola_id` e `titular_id` **imutáveis**, pelo gatilho `pedido_titular_imutavel` (sem precedente no repositório):
--   o `update` que troca um dos dois é recusado como um check (23514), porque redirecionar o pedido mudaria de quem é
--   o atendimento. Os checks de lista fechada e de data repetem por extenso as constantes de `@educa/shared` (o
--   drizzle-kit lê o pacote pelo `dist`).
-- - Único `(escola_id, chave_envio)`: a chave do navegador decide a corrida do `POST pedidos` (`insert … on conflict
--   do nothing`). Índices começando pelo escopo (regra 80, item 8): `(escola_id, id)` para a página de pedidos,
--   `(escola_id, titular_id)` para os pedidos da pessoa, e o parcial dos agendados para o job da eliminação (15.0).
CREATE TABLE "pedido_titular" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"titular_id" uuid NOT NULL,
	"papel_titular" text NOT NULL,
	"tipo" text NOT NULL,
	"solicitante" text NOT NULL,
	"chegou_em" date NOT NULL,
	"estado" text NOT NULL,
	"eliminar_em" timestamp with time zone,
	"eliminacao_enfileirada_em" timestamp with time zone,
	"compartilhamento" jsonb NOT NULL,
	"nome_trocado" boolean,
	"homonimo" boolean,
	"registrado_por" uuid NOT NULL,
	"registrado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"concluido_em" timestamp with time zone,
	"concluido_por" uuid,
	"cancelado_em" timestamp with time zone,
	"cancelado_por" uuid,
	"chave_envio" uuid NOT NULL,
	CONSTRAINT "pedido_titular_chave_envio_unico" UNIQUE("escola_id","chave_envio"),
	CONSTRAINT "pedido_titular_papel_valido" CHECK ("pedido_titular"."papel_titular" in ('aluno', 'professor')),
	CONSTRAINT "pedido_titular_tipo_valido" CHECK ("pedido_titular"."tipo" in ('acesso', 'portabilidade', 'compartilhamento', 'correcao', 'eliminacao')),
	CONSTRAINT "pedido_titular_solicitante_valido" CHECK ("pedido_titular"."solicitante" in ('titular', 'responsavel_legal')),
	CONSTRAINT "pedido_titular_estado_valido" CHECK ("pedido_titular"."estado" in ('recebido', 'em_preparacao', 'pronto', 'agendado', 'concluido', 'cancelado')),
	CONSTRAINT "pedido_titular_chegou_em_nao_futura" CHECK ("pedido_titular"."chegou_em" <= current_date),
	CONSTRAINT "pedido_titular_concluido_so_com_data" CHECK (("pedido_titular"."concluido_em" is null) = ("pedido_titular"."concluido_por" is null)),
	CONSTRAINT "pedido_titular_cancelado_so_com_data" CHECK (("pedido_titular"."cancelado_em" is null) = ("pedido_titular"."cancelado_por" is null)),
	CONSTRAINT "pedido_titular_enfileirado_so_agendado" CHECK ("pedido_titular"."eliminacao_enfileirada_em" is null or "pedido_titular"."eliminar_em" is not null)
);
--> statement-breakpoint
ALTER TABLE "pedido_titular" ADD CONSTRAINT "pedido_titular_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pedido_titular_escola_id_idx" ON "pedido_titular" USING btree ("escola_id","id");--> statement-breakpoint
CREATE INDEX "pedido_titular_escola_titular_idx" ON "pedido_titular" USING btree ("escola_id","titular_id");--> statement-breakpoint
CREATE INDEX "pedido_titular_agendado_idx" ON "pedido_titular" USING btree ("escola_id","eliminar_em") WHERE estado = 'agendado';--> statement-breakpoint
-- O titular e quem registrou são usuário da escola do pedido, conferidos na inserção pelo `exigir_usuario_da_escola`
-- da 0013 (o `registrado_por` também numa troca dele, que é permitida): o erro é o da FK, com o nome da restrição.
CREATE CONSTRAINT TRIGGER "pedido_titular_titular_da_escola" AFTER INSERT ON "pedido_titular"
  FOR EACH ROW EXECUTE FUNCTION "exigir_usuario_da_escola"('titular_id', 'pedido_titular_titular_da_escola_fk');--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "pedido_titular_registrado_por_da_escola" AFTER INSERT OR UPDATE OF "registrado_por" ON "pedido_titular"
  FOR EACH ROW EXECUTE FUNCTION "exigir_usuario_da_escola"('registrado_por', 'pedido_titular_registrado_por_da_escola_fk');--> statement-breakpoint
-- A escola e o titular do pedido não mudam: o `update` que trocar um dos dois é recusado como um check (23514), com
-- o nome da restrição, antes de qualquer escrita. Os outros campos (estado, datas, marcas e a foto) mudam normalmente.
CREATE FUNCTION "exigir_pedido_titular_imutavel"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."escola_id" <> OLD."escola_id" OR NEW."titular_id" <> OLD."titular_id" THEN
    RAISE EXCEPTION 'a escola e o titular do pedido não mudam' USING ERRCODE = 'check_violation', CONSTRAINT = 'pedido_titular_imutavel', TABLE = TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "pedido_titular_imutavel" BEFORE UPDATE ON "pedido_titular" FOR EACH ROW EXECUTE FUNCTION "exigir_pedido_titular_imutavel"();
