-- O link que a conta global recebe por e-mail: o do "esqueci a senha" (acesso-e-convites, tarefa 5.0; Tech Spec, seções 3 e 5).
-- Só expande (regra 80, item 9): tabela nova, que o código anterior não conhece, e o `sessao_motivo_valido` ganha `senha_redefinida`,
-- o motivo com que o "redefinir" encerra as sessões da conta. Alargar o check é compatível com o código anterior, que só grava os
-- motivos de antes, e nenhuma linha existente viola o que entra. Voltar a versão: a tabela pode ficar, vazia de uso.
--
-- - `link_da_conta` não tem `escola_id`: é da conta, que é global (regra 10, itens 1 e 9; `docs/modelo-de-dados.md`).
-- - `link_da_conta_aberto_unico`: um link aberto (nem usado nem substituído) por conta e finalidade. O "esqueci" cancela o anterior
--   antes de gravar o novo, e dois pedidos ao mesmo tempo deixam um só.
-- - `link_da_conta_cifrados_so_no_envio_aberto`, escrito com `case when` como o do `convite`: um `or` deixaria passar cifrado fora do envio aberto.
-- - `link_da_conta_fim_idx`: o `order by` do expurgo de 30 dias depois do uso ou do vencimento.
-- A tabela nasce vazia: nenhum `not valid` é preciso.
CREATE TABLE "link_da_conta" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"conta_id" uuid NOT NULL,
	"finalidade" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_cifrado" "bytea",
	"destino_cifrado" "bytea",
	"expira_em" timestamp with time zone NOT NULL,
	"usado_em" timestamp with time zone,
	"envio" text NOT NULL,
	"envio_reservado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "link_da_conta_token_hash_unico" UNIQUE("token_hash"),
	CONSTRAINT "link_da_conta_finalidade_valida" CHECK ("link_da_conta"."finalidade" in ('redefinir', 'verificar')),
	CONSTRAINT "link_da_conta_token_hash_formato" CHECK ("link_da_conta"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "link_da_conta_envio_valido" CHECK ("link_da_conta"."envio" in ('na_fila', 'enviando', 'enviado', 'falhou', 'cancelado')),
	CONSTRAINT "link_da_conta_cifrados_so_no_envio_aberto" CHECK (case when "link_da_conta"."envio" in ('na_fila', 'enviando') then "link_da_conta"."token_cifrado" is not null and "link_da_conta"."destino_cifrado" is not null else "link_da_conta"."token_cifrado" is null and "link_da_conta"."destino_cifrado" is null end),
	CONSTRAINT "link_da_conta_reserva_so_enviando" CHECK ("link_da_conta"."envio_reservado_em" is null or "link_da_conta"."envio" = 'enviando')
);
--> statement-breakpoint
ALTER TABLE "sessao" DROP CONSTRAINT "sessao_motivo_valido";--> statement-breakpoint
ALTER TABLE "link_da_conta" ADD CONSTRAINT "link_da_conta_conta_id_conta_id_fk" FOREIGN KEY ("conta_id") REFERENCES "public"."conta"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "link_da_conta_aberto_unico" ON "link_da_conta" USING btree ("conta_id","finalidade") WHERE "link_da_conta"."usado_em" is null;--> statement-breakpoint
CREATE INDEX "link_da_conta_fim_idx" ON "link_da_conta" USING btree (coalesce("usado_em", "expira_em"));--> statement-breakpoint
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_motivo_valido" CHECK ("sessao"."motivo" is null or "sessao"."motivo" in ('saida', 'troca_de_escola', 'reuso_de_refresh', 'desativacao', 'mfa_redefinido', 'conta_limpa', 'eliminacao_agendada', 'senha_redefinida'));