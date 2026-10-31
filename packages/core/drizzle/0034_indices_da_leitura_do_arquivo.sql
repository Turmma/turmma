-- Os índices da leitura do arquivo do titular (F3, tarefa 13.0; revisão da 1ª rodada; regra 80, item 8). Só expande (regra 80,
-- item 9): três índices em tabelas que crescem com o aluno, que o código anterior não conhece. Sem `concurrently`, como a Tech Spec
-- do F3, seção 7c, aceita enquanto não há staging nem piloto (a partir do staging, cada um vai em arquivo próprio, fora de transação).
--
-- - `correcao_destaque_aberto_por_idx`: o arquivo do professor lê os destaques que ele abriu (`destaque_aberto_por`); sem ele, a
--   leitura percorre as correções da escola. Parcial: a maioria é nula.
-- - `registro_acesso_usuario_idx`: o arquivo lê os acessos de uma pessoa, pela escola; o `registro_acesso` cresce com todo login.
-- - `resposta_atividade_aluno_idx`: o arquivo do aluno lê as respostas dele; a chave única começa pelo ano e pela atividade, e não
--   serve ao filtro por aluno.
CREATE INDEX "correcao_destaque_aberto_por_idx" ON "correcao" USING btree ("escola_id","destaque_aberto_por") WHERE "correcao"."destaque_aberto_por" is not null;--> statement-breakpoint
CREATE INDEX "registro_acesso_usuario_idx" ON "registro_acesso" USING btree ("escola_id","usuario_id","em");--> statement-breakpoint
CREATE INDEX "resposta_atividade_aluno_idx" ON "resposta_atividade" USING btree ("escola_id","aluno_id");
