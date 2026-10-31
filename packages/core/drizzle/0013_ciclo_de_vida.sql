-- O ciclo de vida da conta e o expurgo do acesso (tarefa 17.0). No deploy do F1 inteiro, as tabelas destas instruções
-- nascem vazias na mesma transação (Tech Spec, seção 3, "Migrations"): o índice e o check novos não esperam dado. Só
-- expande ou afrouxa: o código anterior continua gravando o que gravava (regra 80, item 9).
--
-- A redefinição do MFA (17.4) e a limpeza da conta (17.1) encerram as sessões da conta com motivo próprio.
ALTER TABLE "sessao" DROP CONSTRAINT "sessao_motivo_valido";--> statement-breakpoint
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_motivo_valido" CHECK ("sessao"."motivo" is null or "sessao"."motivo" in ('saida', 'troca_de_escola', 'reuso_de_refresh', 'desativacao', 'mfa_redefinido', 'conta_limpa'));--> statement-breakpoint
-- A conta limpa, sem usuário ativo em escola nenhuma, perde o e-mail e fica só com o id que os usuários desativados
-- dela ainda apontam (17.1).
ALTER TABLE "conta" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
-- O expurgo de 6 meses do registro de acesso e o de 30 dias da sessão descem por aqui (17.2).
CREATE INDEX "registro_acesso_em_idx" ON "registro_acesso" USING btree ("em");--> statement-breakpoint
CREATE INDEX "sessao_fim_idx" ON "sessao" USING btree (coalesce("encerrada_em", "expira_em"));--> statement-breakpoint
-- Encerrar as sessões abertas de uma conta em todas as escolas (a redefinição do MFA e a limpeza da conta) desce por
-- aqui, sem varrer a tabela: só as abertas e só as que têm conta (17.0).
CREATE INDEX "sessao_conta_aberta_idx" ON "sessao" USING btree ("conta_id") WHERE conta_id is not null and encerrada_em is null;--> statement-breakpoint
-- O autor da auditoria e do vínculo deixa de ser FK e passa a ser conferido na gravação (17.1). A eliminação pedida
-- pela escola apaga o usuário, e a auditoria fica pela retenção legal com o id de quem fez; o vínculo de outra pessoa
-- que ele criou também fica. A FK barraria a eliminação, e o `set null` apagaria o autor que a auditoria precisa
-- mostrar. O gatilho mantém o que a FK garantia na escrita: o autor existe e é usuário da mesma escola do registro, e
-- a linha dele fica travada (`for key share`, como a FK faz) até o commit de quem grava. O erro é o mesmo da FK, com o
-- mesmo nome de restrição, e não leva valor nenhum. É gatilho de restrição `after`, como a FK: os checks da tabela
-- (um autor e só um, escola nula só na rede) respondem antes dele, e escola ou autor nulo não é conferido (a FK
-- composta é `match simple`).
CREATE FUNCTION "exigir_usuario_da_escola"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  autor uuid := (to_jsonb(NEW) ->> TG_ARGV[0])::uuid;
BEGIN
  IF autor IS NULL OR NEW."escola_id" IS NULL THEN
    RETURN NULL;
  END IF;
  PERFORM 1 FROM "usuario" WHERE "escola_id" = NEW."escola_id" AND "id" = autor FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'o autor não é usuário da escola do registro' USING ERRCODE = 'foreign_key_violation', CONSTRAINT = TG_ARGV[1], TABLE = TG_TABLE_NAME;
  END IF;
  RETURN NULL;
END
$$;--> statement-breakpoint
ALTER TABLE "auditoria" DROP CONSTRAINT "auditoria_autor_da_escola_fk";--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "auditoria_autor_da_escola" AFTER INSERT OR UPDATE OF "escola_id", "autor_usuario_id" ON "auditoria"
  FOR EACH ROW EXECUTE FUNCTION "exigir_usuario_da_escola"('autor_usuario_id', 'auditoria_autor_da_escola_fk');--> statement-breakpoint
ALTER TABLE "vinculo" DROP CONSTRAINT "vinculo_criado_por_da_escola_fk";--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "vinculo_criado_por_da_escola" AFTER INSERT OR UPDATE OF "escola_id", "criado_por" ON "vinculo"
  FOR EACH ROW EXECUTE FUNCTION "exigir_usuario_da_escola"('criado_por', 'vinculo_criado_por_da_escola_fk');
