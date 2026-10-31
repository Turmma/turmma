-- O MVP de apresentação, segunda migration (D77): o que a revisão da fase 1 pediu de banco. **Só aperta e acrescenta**:
-- duas colunas nulas em `mensagem_tutor`, quatro unicidades, as FKs que passam a levar o ano letivo e a turma, um check
-- trocado por outro mais largo, os gatilhos de autoria, que passam a conferir o papel, e o da validação contra as
-- correções do lote. Nenhuma coluna sai nem muda de nome (regra 80, item 9). Cada FK que sai dá lugar, aqui mesmo, a
-- outra que garante o mesmo e mais. As tabelas da 0022 ainda estão vazias: as unicidades e as FKs novas não esperam
-- dado, e nenhuma delas é `NOT VALID`.
--
-- O drizzle-kit gera as FKs antes das unicidades que elas referenciam. A ordem abaixo é a que o banco aceita, escrita à
-- mão: soltar as FKs antigas, criar as unicidades, criar as FKs novas, e por fim os checks e os gatilhos.
--
-- 1. As FKs que a 0022 deixou só com a escola, ou só com a escola e o ano, e que saem para dar lugar às que levam também
--    o ano letivo e a turma. Entre soltar e recriar, tudo corre na transação da migration.
ALTER TABLE "artefato" DROP CONSTRAINT "artefato_origem_da_escola_fk";--> statement-breakpoint
ALTER TABLE "artefato" DROP CONSTRAINT "artefato_execucao_da_escola_fk";--> statement-breakpoint
ALTER TABLE "atividade_aplicada" DROP CONSTRAINT "atividade_aplicada_artefato_da_escola_fk";--> statement-breakpoint
ALTER TABLE "entrega" DROP CONSTRAINT "entrega_artefato_da_escola_fk";--> statement-breakpoint
ALTER TABLE "entrega" DROP CONSTRAINT "entrega_atividade_aplicada_do_ano_da_escola_fk";--> statement-breakpoint
ALTER TABLE "entrega" DROP CONSTRAINT "entrega_execucao_da_escola_fk";--> statement-breakpoint
ALTER TABLE "mensagem_agente" DROP CONSTRAINT "mensagem_agente_execucao_da_escola_fk";--> statement-breakpoint
ALTER TABLE "mensagem_tutor" DROP CONSTRAINT "mensagem_tutor_execucao_da_escola_fk";--> statement-breakpoint
ALTER TABLE "mensagem_tutor" DROP CONSTRAINT "mensagem_tutor_atividade_aplicada_do_ano_da_escola_fk";--> statement-breakpoint
ALTER TABLE "resumo_do_analista" DROP CONSTRAINT "resumo_do_analista_execucao_da_escola_fk";--> statement-breakpoint
ALTER TABLE "sinal_tutor" DROP CONSTRAINT "sinal_tutor_execucao_da_escola_fk";--> statement-breakpoint
ALTER TABLE "sinal_tutor" DROP CONSTRAINT "sinal_tutor_atividade_aplicada_do_ano_da_escola_fk";--> statement-breakpoint
-- O check que só cobria o Tutor: o novo, mais abaixo, cobre também a conversa do professor.
ALTER TABLE "consumo_ia" DROP CONSTRAINT "consumo_ia_sem_texto_de_aluno";--> statement-breakpoint
-- 2. Em que o aluno estava quando perguntou ao Tutor: o número da questão ou a página do material. Referência ao
--    trabalho, para o professor ver o uso da turma sem ler a conversa (D47; regra 70, itens 4 e 7).
ALTER TABLE "mensagem_tutor" ADD COLUMN "questao" smallint;--> statement-breakpoint
ALTER TABLE "mensagem_tutor" ADD COLUMN "pagina" integer;--> statement-breakpoint
-- 3. Os alvos das FKs novas. A execução é a que cresce com o Tutor; o índice a mais é o preço de o produto nunca
--    apontar para a execução de outro ano letivo.
ALTER TABLE "artefato" ADD CONSTRAINT "artefato_escola_ano_id_unico" UNIQUE("escola_id","ano_letivo_id","id");--> statement-breakpoint
ALTER TABLE "artefato" ADD CONSTRAINT "artefato_escola_ano_turma_id_unico" UNIQUE("escola_id","ano_letivo_id","turma_id","id");--> statement-breakpoint
ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_escola_ano_turma_id_unico" UNIQUE("escola_id","ano_letivo_id","turma_id","id");--> statement-breakpoint
ALTER TABLE "execucao_agente" ADD CONSTRAINT "execucao_agente_escola_ano_id_unico" UNIQUE("escola_id","ano_letivo_id","id");--> statement-breakpoint
-- 4. As FKs novas. O que a execução produz vai com a escola e o ano; a versão adaptada e a entrega dela, com a turma
--    do artefato; a entrega do lote, a mensagem e o sinal do Tutor, com a turma da atividade aplicada. Uma entrega da
--    turma X não aponta mais para a aplicação da turma Y, e nada cruza de ano letivo na mesma escola.
ALTER TABLE "artefato" ADD CONSTRAINT "artefato_origem_da_turma_fk" FOREIGN KEY ("escola_id","ano_letivo_id","turma_id","origem_id") REFERENCES "public"."artefato"("escola_id","ano_letivo_id","turma_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artefato" ADD CONSTRAINT "artefato_execucao_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","execucao_id") REFERENCES "public"."execucao_agente"("escola_id","ano_letivo_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_artefato_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","artefato_id") REFERENCES "public"."artefato"("escola_id","ano_letivo_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrega" ADD CONSTRAINT "entrega_artefato_da_turma_fk" FOREIGN KEY ("escola_id","ano_letivo_id","turma_id","artefato_id") REFERENCES "public"."artefato"("escola_id","ano_letivo_id","turma_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrega" ADD CONSTRAINT "entrega_atividade_aplicada_da_turma_fk" FOREIGN KEY ("escola_id","ano_letivo_id","turma_id","atividade_aplicada_id") REFERENCES "public"."atividade_aplicada"("escola_id","ano_letivo_id","turma_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrega" ADD CONSTRAINT "entrega_execucao_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","execucao_id") REFERENCES "public"."execucao_agente"("escola_id","ano_letivo_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem_agente" ADD CONSTRAINT "mensagem_agente_execucao_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","execucao_id") REFERENCES "public"."execucao_agente"("escola_id","ano_letivo_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem_tutor" ADD CONSTRAINT "mensagem_tutor_execucao_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","execucao_id") REFERENCES "public"."execucao_agente"("escola_id","ano_letivo_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem_tutor" ADD CONSTRAINT "mensagem_tutor_atividade_aplicada_da_turma_fk" FOREIGN KEY ("escola_id","ano_letivo_id","turma_id","atividade_aplicada_id") REFERENCES "public"."atividade_aplicada"("escola_id","ano_letivo_id","turma_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resumo_do_analista" ADD CONSTRAINT "resumo_do_analista_execucao_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","execucao_id") REFERENCES "public"."execucao_agente"("escola_id","ano_letivo_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sinal_tutor" ADD CONSTRAINT "sinal_tutor_execucao_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","execucao_id") REFERENCES "public"."execucao_agente"("escola_id","ano_letivo_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sinal_tutor" ADD CONSTRAINT "sinal_tutor_atividade_aplicada_da_turma_fk" FOREIGN KEY ("escola_id","ano_letivo_id","turma_id","atividade_aplicada_id") REFERENCES "public"."atividade_aplicada"("escola_id","ano_letivo_id","turma_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- 5. `entrada` e `saida` do consumo ficam nulas onde a chamada leva conversa de pessoa: nas funções do Tutor (texto do
--    aluno) e na tarefa `propor_ferramenta` (a mensagem do professor ao Assistente). A conversa tem um lugar só.
ALTER TABLE "consumo_ia" ADD CONSTRAINT "consumo_ia_sem_conversa_de_pessoa" CHECK (("consumo_ia"."funcao" not in ('tutor_com_o_aluno', 'sinais_para_o_professor') and "consumo_ia"."tarefa" <> 'propor_ferramenta') or ("consumo_ia"."entrada" is null and "consumo_ia"."saida" is null));--> statement-breakpoint
ALTER TABLE "mensagem_tutor" ADD CONSTRAINT "mensagem_tutor_questao_valida" CHECK ("mensagem_tutor"."questao" is null or ("mensagem_tutor"."questao" between 1 and 20 and "mensagem_tutor"."atividade_aplicada_id" is not null and "mensagem_tutor"."autor" = 'aluno'));--> statement-breakpoint
ALTER TABLE "mensagem_tutor" ADD CONSTRAINT "mensagem_tutor_pagina_valida" CHECK ("mensagem_tutor"."pagina" is null or ("mensagem_tutor"."pagina" >= 1 and "mensagem_tutor"."material_id" is not null and "mensagem_tutor"."autor" = 'aluno'));--> statement-breakpoint
-- 6. Quem aprova, confirma, aplica e abre destaque é da equipe da escola: professor ou coordenação, nunca aluno. A função
--    da 0013 confere só "usuário da escola"; esta confere também o papel, com o mesmo erro da FK (23503, com o nome da
--    restrição) e a mesma trava na linha do autor até o commit. Continua sem ser FK: a eliminação da pessoa não apaga
--    quem aprovou. Quem suspende e retoma função segue pela função da 0013.
CREATE FUNCTION "exigir_equipe_da_escola"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  autor uuid := (to_jsonb(NEW) ->> TG_ARGV[0])::uuid;
BEGIN
  IF autor IS NULL OR NEW."escola_id" IS NULL THEN
    RETURN NULL;
  END IF;
  PERFORM 1 FROM "usuario" WHERE "escola_id" = NEW."escola_id" AND "id" = autor AND "papel" IN ('professor', 'coordenador') FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'o autor não é professor nem coordenação da escola do registro' USING ERRCODE = 'foreign_key_violation', CONSTRAINT = TG_ARGV[1], TABLE = TG_TABLE_NAME;
  END IF;
  RETURN NULL;
END
$$;--> statement-breakpoint
DROP TRIGGER "entrega_decidida_por_da_escola" ON "entrega";--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "entrega_decidida_por_da_equipe" AFTER INSERT OR UPDATE OF "escola_id", "decidida_por" ON "entrega"
  FOR EACH ROW EXECUTE FUNCTION "exigir_equipe_da_escola"('decidida_por', 'entrega_decidida_por_da_escola_fk');--> statement-breakpoint
DROP TRIGGER "atividade_aplicada_aplicada_por_da_escola" ON "atividade_aplicada";--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "atividade_aplicada_aplicada_por_da_equipe" AFTER INSERT OR UPDATE OF "escola_id", "aplicada_por" ON "atividade_aplicada"
  FOR EACH ROW EXECUTE FUNCTION "exigir_equipe_da_escola"('aplicada_por', 'atividade_aplicada_aplicada_por_da_escola_fk');--> statement-breakpoint
DROP TRIGGER "validacao_do_lote_confirmada_por_da_escola" ON "validacao_do_lote";--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "validacao_do_lote_confirmada_por_da_equipe" AFTER INSERT OR UPDATE OF "escola_id", "confirmada_por" ON "validacao_do_lote"
  FOR EACH ROW EXECUTE FUNCTION "exigir_equipe_da_escola"('confirmada_por', 'validacao_do_lote_confirmada_por_da_escola_fk');--> statement-breakpoint
DROP TRIGGER "correcao_destaque_aberto_por_da_escola" ON "correcao";--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "correcao_destaque_aberto_por_da_equipe" AFTER INSERT OR UPDATE OF "escola_id", "destaque_aberto_por" ON "correcao"
  FOR EACH ROW EXECUTE FUNCTION "exigir_equipe_da_escola"('destaque_aberto_por', 'correcao_destaque_aberto_por_da_escola_fk');--> statement-breakpoint
-- 7. A validação contra as correções do lote (D33, D56). O check da 0022 compara o registro com ele mesmo: uma validação
--    com `apresentado.destaques` vazio passava, mesmo havendo correção destacada que ninguém abriu. Agora o registro só
--    entra se toda correção do lote com destaque estiver aberta e constar do que foi apresentado. Erro de check (23514),
--    com o nome da regra, sem valor nenhum. As correções do lote ficam travadas (`for share`) até o commit.
CREATE FUNCTION "exigir_destaques_do_lote_abertos"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  destacada record;
  apresentados jsonb := jsonb_path_query_array(NEW."apresentado", '$.destaques[*].alunoId');
BEGIN
  FOR destacada IN
    SELECT c."aluno_id", c."destaque_aberto_em" FROM "correcao" c
    WHERE c."escola_id" = NEW."escola_id" AND c."entrega_id" = NEW."entrega_id" AND cardinality(c."destaques") > 0
    FOR SHARE
  LOOP
    IF destacada."destaque_aberto_em" IS NULL THEN
      RAISE EXCEPTION 'há correção destacada do lote que não foi aberta' USING ERRCODE = 'check_violation', CONSTRAINT = 'validacao_do_lote_destaques_do_lote_abertos', TABLE = TG_TABLE_NAME;
    END IF;
    IF NOT apresentados @> to_jsonb(destacada."aluno_id"::text) THEN
      RAISE EXCEPTION 'há correção destacada do lote fora do que foi apresentado' USING ERRCODE = 'check_violation', CONSTRAINT = 'validacao_do_lote_destaques_do_lote_apresentados', TABLE = TG_TABLE_NAME;
    END IF;
  END LOOP;
  RETURN NULL;
END
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "validacao_do_lote_destaques_do_lote" AFTER INSERT OR UPDATE OF "escola_id", "entrega_id", "apresentado" ON "validacao_do_lote"
  FOR EACH ROW EXECUTE FUNCTION "exigir_destaques_do_lote_abertos"();--> statement-breakpoint
-- 8. O gatilho do lote aprovado relia a entrega só pelo id. Passa a reler pela escola e pelo id, como toda consulta
--    (regra 10, item 3). O corpo é o da 0022, com o filtro a mais.
CREATE OR REPLACE FUNCTION "exigir_validacao_do_lote_aprovado"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM "entrega" e WHERE e."escola_id" = NEW."escola_id" AND e."id" = NEW."id" AND e."tipo" = 'lote_de_correcao' AND e."estado" = 'aprovada';
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  PERFORM 1 FROM "validacao_do_lote" v WHERE v."escola_id" = NEW."escola_id" AND v."entrega_id" = NEW."id";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'lote de correção aprovado sem o registro da validação' USING ERRCODE = 'check_violation', CONSTRAINT = 'entrega_lote_aprovado_com_validacao', TABLE = TG_TABLE_NAME;
  END IF;
  RETURN NULL;
END
$$;