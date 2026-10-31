-- O instante em que a escola passou a existir (F3, correção da 8.0; Tech Spec do F3, seção 6, "A vigência nunca é anterior à
-- escola"). Só expande (regra 80, item 9): o código anterior insere a escola sem a coluna e recebe o padrão.
--
-- A vigência de um suboperador de alcance `todas` não tem ligação com a escola, e a aba "Empresas que recebem dados" mostrava
-- como recebida por ela a empresa que já tinha saído antes de a escola existir. A coluna é o que o repositório compara.
--
-- O `update` preenche as escolas que já existem com o `em` mais antigo da auditoria `escola.criada` de cada uma (o índice
-- `auditoria_escola_em_idx` começa pela escola). A escola sem essa linha fica com o instante desta migration: só acontece em
-- banco local, porque ainda não há staging nem piloto.
ALTER TABLE "escola" ADD COLUMN "criada_em" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "escola" SET "criada_em" = coalesce(
	(SELECT min("auditoria"."em") FROM "auditoria" WHERE "auditoria"."escola_id" = "escola"."id" AND "auditoria"."acao" = 'escola.criada'),
	"criada_em"
);
