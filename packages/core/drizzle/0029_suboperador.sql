-- As empresas que recebem dado da escola (F3, tarefa 8.0; Tech Spec do F3, seção 3). Só expande (regra 80, item 9): duas
-- tabelas novas e vazias que o código anterior não conhece, e um check da auditoria que passa a aceitar uma entidade a mais.
--
-- - `suboperador`: sem `escola_id`, a exceção declarada em `docs/modelo-de-dados.md` (a hospedagem atende toda escola).
--   Uma vigente por chave (índice único onde `fim is null`); a chave encerrada pode ser cadastrada de novo. Os checks de
--   formato e de lista fechada repetem por extenso as constantes de `@educa/shared` (o drizzle-kit lê o pacote pelo
--   `dist`); `apps/api/test/suboperador.int.test.ts` (o caso "banco: recusa…") compara a lista de categorias com `CHAVES_DE_CATEGORIA_DO_SUBOPERADOR`.
-- - `suboperador_escola`: a ligação do suboperador de alcance `lista` com cada escola atendida; a chave primária começa
--   pela escola. O índice por `suboperador_id` serve ao encerramento, que fecha as ligações de um suboperador.
-- - `auditoria_escola_ou_operacao_global` no lugar de `auditoria_escola_ou_rede_pelo_operador`: sem escola, a auditoria
--   passa a aceitar, além da rede criada, o suboperador cadastrado ou encerrado, sempre por operador. O novo check é mais
--   largo que o antigo, então toda linha existente o cumpre e o código anterior, que só grava a rede sem escola, segue
--   valendo. Na mesma migration, sem `NOT VALID`: a tabela ainda é pequena e não há staging nem piloto (Tech Spec do F3,
--   seção 7c); a partir do staging, cada check vai em arquivo próprio.
CREATE TABLE "suboperador" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"chave" text NOT NULL,
	"nome" text NOT NULL,
	"finalidade" text NOT NULL,
	"categorias" text[] NOT NULL,
	"pais" text NOT NULL,
	"contrato" text NOT NULL,
	"veda_treinamento" boolean NOT NULL,
	"alcance" text NOT NULL,
	"inicio" timestamp with time zone DEFAULT now() NOT NULL,
	"fim" timestamp with time zone,
	"registrado_por" text NOT NULL,
	CONSTRAINT "suboperador_chave_formato" CHECK ("suboperador"."chave" ~ '^[a-z][a-z0-9_-]{1,39}$'),
	CONSTRAINT "suboperador_nome_tamanho" CHECK (char_length("suboperador"."nome") between 1 and 120),
	CONSTRAINT "suboperador_finalidade_tamanho" CHECK (char_length("suboperador"."finalidade") between 1 and 300),
	CONSTRAINT "suboperador_pais_formato" CHECK ("suboperador"."pais" ~ '^[A-Z]{2}$'),
	CONSTRAINT "suboperador_contrato_formato" CHECK ("suboperador"."contrato" ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,59}$'),
	CONSTRAINT "suboperador_categorias_validas" CHECK (cardinality("suboperador"."categorias") between 1 and 8 and "suboperador"."categorias" <@ array['cadastro', 'conta_de_acesso', 'registro_de_acesso', 'conversa_do_aluno', 'conversa_do_professor', 'trabalho_do_aluno', 'material_da_escola', 'consulta_de_busca']),
	CONSTRAINT "suboperador_alcance_valido" CHECK ("suboperador"."alcance" in ('todas', 'lista')),
	CONSTRAINT "suboperador_vigencia_ordenada" CHECK ("suboperador"."fim" is null or "suboperador"."fim" >= "suboperador"."inicio"),
	CONSTRAINT "suboperador_registrado_por_formato" CHECK ("suboperador"."registrado_por" ~ '^[a-z][a-z0-9-]{1,31}$')
);
--> statement-breakpoint
CREATE TABLE "suboperador_escola" (
	"escola_id" uuid NOT NULL,
	"suboperador_id" uuid NOT NULL,
	"inicio" timestamp with time zone DEFAULT now() NOT NULL,
	"fim" timestamp with time zone,
	CONSTRAINT "suboperador_escola_pk" PRIMARY KEY("escola_id","suboperador_id"),
	CONSTRAINT "suboperador_escola_vigencia_ordenada" CHECK ("suboperador_escola"."fim" is null or "suboperador_escola"."fim" >= "suboperador_escola"."inicio")
);
--> statement-breakpoint
ALTER TABLE "auditoria" DROP CONSTRAINT "auditoria_escola_ou_rede_pelo_operador";--> statement-breakpoint
ALTER TABLE "suboperador_escola" ADD CONSTRAINT "suboperador_escola_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suboperador_escola" ADD CONSTRAINT "suboperador_escola_suboperador_id_suboperador_id_fk" FOREIGN KEY ("suboperador_id") REFERENCES "public"."suboperador"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "suboperador_chave_vigente_idx" ON "suboperador" USING btree ("chave") WHERE "suboperador"."fim" is null;--> statement-breakpoint
CREATE INDEX "suboperador_escola_suboperador_idx" ON "suboperador_escola" USING btree ("suboperador_id");--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_escola_ou_operacao_global" CHECK (escola_id is not null or (autor_operador is not null and entidade in ('rede', 'suboperador')));