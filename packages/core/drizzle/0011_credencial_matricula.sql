-- A credencial do aluno por matrícula e senha (tarefa 11.0): única por escola, nunca no sistema, com FK composta para o
-- usuário da mesma escola e o hash argon2id (nulo quando a escola desativa o aluno). Tabela nova e vazia: só expande
-- (regra 80, item 9); o unique (escola_id, matricula) é o índice da leitura do login.
CREATE TABLE "credencial_matricula" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"matricula" text NOT NULL,
	"senha_hash" text,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credencial_matricula_escola_id_unico" UNIQUE("escola_id","id"),
	CONSTRAINT "credencial_matricula_matricula_unica" UNIQUE("escola_id","matricula"),
	CONSTRAINT "credencial_matricula_usuario_unico" UNIQUE("escola_id","usuario_id"),
	CONSTRAINT "credencial_matricula_formato" CHECK (char_length("credencial_matricula"."matricula") between 1 and 40 and "credencial_matricula"."matricula" = btrim("credencial_matricula"."matricula"))
);
--> statement-breakpoint
ALTER TABLE "credencial_matricula" ADD CONSTRAINT "credencial_matricula_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credencial_matricula" ADD CONSTRAINT "credencial_matricula_usuario_da_escola_fk" FOREIGN KEY ("escola_id","usuario_id") REFERENCES "public"."usuario"("escola_id","id") ON DELETE cascade ON UPDATE no action;