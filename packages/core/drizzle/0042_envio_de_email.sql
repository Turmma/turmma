-- O envio do convite por e-mail (acesso-e-convites, tarefa 1.0): só colunas e restrições novas no `convite`.
-- Só expande (regra 80, item 9): o código anterior não as conhece e grava o convite copiado como sempre (canal `copiado`, envio nulo,
-- `criado_em` de agora). Voltar a versão: o código anterior ignora as colunas, e elas podem ficar. Os checks nascem `not valid` e são
-- validados em seguida, mas o migrador roda o arquivo numa transação só: a trava exclusiva do `ADD COLUMN` dura até o commit, e o
-- `not valid` não a encurta. Aqui não pesa (a `convite` é pequena); em tabela grande, a validação pede migration própria.
ALTER TABLE "convite" ADD COLUMN "canal" text DEFAULT 'copiado' NOT NULL;--> statement-breakpoint
ALTER TABLE "convite" ADD COLUMN "token_cifrado" bytea;--> statement-breakpoint
ALTER TABLE "convite" ADD COLUMN "destino_cifrado" bytea;--> statement-breakpoint
ALTER TABLE "convite" ADD COLUMN "envio" text;--> statement-breakpoint
ALTER TABLE "convite" ADD COLUMN "envio_reservado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "convite" ADD COLUMN "enviado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "convite" ADD COLUMN "criado_em" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "convite_envio_aberto_idx" ON "convite" USING btree ("escola_id","criado_em") WHERE "convite"."envio" in ('na_fila', 'enviando');--> statement-breakpoint
ALTER TABLE "convite" ADD CONSTRAINT "convite_canal_valido" CHECK ("convite"."canal" in ('copiado', 'email')) NOT VALID;--> statement-breakpoint
ALTER TABLE "convite" ADD CONSTRAINT "convite_envio_valido" CHECK ("convite"."envio" in ('na_fila', 'enviando', 'enviado', 'falhou', 'cancelado')) NOT VALID;--> statement-breakpoint
ALTER TABLE "convite" ADD CONSTRAINT "convite_envio_so_por_email" CHECK (("convite"."canal" = 'email') = ("convite"."envio" is not null)) NOT VALID;--> statement-breakpoint
ALTER TABLE "convite" ADD CONSTRAINT "convite_cifrados_so_no_envio_aberto" CHECK (case when "convite"."envio" in ('na_fila', 'enviando') then "convite"."token_cifrado" is not null and "convite"."destino_cifrado" is not null else "convite"."token_cifrado" is null and "convite"."destino_cifrado" is null end) NOT VALID;--> statement-breakpoint
ALTER TABLE "convite" ADD CONSTRAINT "convite_reserva_so_enviando" CHECK ("convite"."envio_reservado_em" is null or ("convite"."envio" is not null and "convite"."envio" = 'enviando')) NOT VALID;--> statement-breakpoint
ALTER TABLE "convite" VALIDATE CONSTRAINT "convite_canal_valido";--> statement-breakpoint
ALTER TABLE "convite" VALIDATE CONSTRAINT "convite_envio_valido";--> statement-breakpoint
ALTER TABLE "convite" VALIDATE CONSTRAINT "convite_envio_so_por_email";--> statement-breakpoint
ALTER TABLE "convite" VALIDATE CONSTRAINT "convite_cifrados_so_no_envio_aberto";--> statement-breakpoint
ALTER TABLE "convite" VALIDATE CONSTRAINT "convite_reserva_so_enviando";
