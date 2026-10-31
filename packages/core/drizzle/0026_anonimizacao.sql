-- As categorias de anonimização do expurgo noturno da escola (F3, tarefa 4.0; Tech Spec do F3, seções 3 e 7c). Só
-- expande (regra 80, item 9): uma coluna nula e cinco índices parciais; o código anterior não conhece nenhum deles.
--
-- - `execucao_agente.anonimizada_em`: quando o expurgo trocou a `entrada` por `{ tarefa }` e anulou `solicitada_por`.
--   Nasce nula em toda linha, sem reescrever a tabela.
-- - Os índices dos lotes, um por alvo, começando pelo escopo (regra 80, item 8) e só com as linhas que ainda têm
--   pessoa: a linha anonimizada sai do índice, e a noite seguinte não a relê. `execucao_agente (escola_id, criada_em)`
--   onde `anonimizada_em is null`, e o mesmo só da execução do Tutor, que tem o aluno e sai também no prazo do consumo
--   por aluno; `consumo_ia (escola_id, em)` onde há texto do modelo, e onde há aluno; `artefato (escola_id,
--   ano_letivo_id)` onde há autor.
-- - Sem `concurrently` enquanto não há staging nem piloto (Tech Spec do F3, seção 7c).
ALTER TABLE "execucao_agente" ADD COLUMN "anonimizada_em" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "artefato_autoria_idx" ON "artefato" USING btree ("escola_id","ano_letivo_id") WHERE "artefato"."criado_por" is not null;--> statement-breakpoint
CREATE INDEX "consumo_ia_texto_a_anular_idx" ON "consumo_ia" USING btree ("escola_id","em") WHERE "consumo_ia"."entrada" is not null or "consumo_ia"."saida" is not null;--> statement-breakpoint
CREATE INDEX "consumo_ia_aluno_a_anular_idx" ON "consumo_ia" USING btree ("escola_id","em") WHERE "consumo_ia"."aluno_id" is not null;--> statement-breakpoint
CREATE INDEX "execucao_agente_a_anonimizar_idx" ON "execucao_agente" USING btree ("escola_id","criada_em") WHERE "execucao_agente"."anonimizada_em" is null;--> statement-breakpoint
CREATE INDEX "execucao_agente_do_tutor_a_anonimizar_idx" ON "execucao_agente" USING btree ("escola_id","criada_em") WHERE "execucao_agente"."anonimizada_em" is null and "execucao_agente"."funcao" = 'tutor_com_o_aluno';