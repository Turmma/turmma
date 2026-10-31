-- O expurgo do trabalho do aluno e do cadastro (F3, tarefa 5.0; Tech Spec do F3, seções 3 e 7c). Só expande (regra 80,
-- item 9): nove índices, nenhuma coluna nem restrição; o código anterior não conhece nenhum deles.
--
-- - Os índices dos lotes, um por alvo, começando pelo escopo (regra 80, item 8) e só com as linhas que o expurgo alcança:
--   `reivindicacao` decidida ou encerrada, pela data da decisão ou, no encerrado, que não tem decisão, da solicitação;
--   `material` excluído; `usuario` desativado; `vinculo` encerrado. O `trabalho_do_aluno` desce pelo ano letivo, que a
--   chave única da tentativa já cobre.
-- - `tentativa_atividade (escola_id, aluno_id)`: a eliminação do aluno (o `on delete cascade` da FK dele) e o arquivo do
--   titular acham as tentativas por aqui; a chave única começa pelo ano e pela aplicação e não serve.
-- - `mensagem_tutor` e `sinal_tutor (escola_id, material_id)`: as duas FKs para o material não têm ação, e apagar o
--   material excluído as confere por estes índices. O lote também só apaga o material que nenhuma delas ainda cita.
-- - `execucao_agente (escola_id, solicitada_por)` e `artefato (escola_id, criado_por)`: as FKs `on delete set null` da
--   pessoa. A eliminação dela (a da rotina e a do pedido do titular) acha as linhas por aqui; sem eles, cada pessoa
--   eliminada lê a tabela inteira, de todas as escolas (Tech Spec do F3, seção 7c, "Índices novos").
-- - Sem `concurrently` enquanto não há staging nem piloto (Tech Spec do F3, seção 7c).
CREATE INDEX "artefato_criado_por_idx" ON "artefato" USING btree ("escola_id","criado_por") WHERE "artefato"."criado_por" is not null;--> statement-breakpoint
CREATE INDEX "execucao_agente_solicitada_por_idx" ON "execucao_agente" USING btree ("escola_id","solicitada_por") WHERE "execucao_agente"."solicitada_por" is not null;--> statement-breakpoint
CREATE INDEX "material_excluido_idx" ON "material" USING btree ("escola_id","excluido_em") WHERE "material"."excluido_em" is not null;--> statement-breakpoint
CREATE INDEX "mensagem_tutor_material_idx" ON "mensagem_tutor" USING btree ("escola_id","material_id") WHERE "mensagem_tutor"."material_id" is not null;--> statement-breakpoint
CREATE INDEX "reivindicacao_decidida_idx" ON "reivindicacao" USING btree ("escola_id",coalesce("decidida_em", "solicitada_em")) WHERE "reivindicacao"."estado" <> 'pendente';--> statement-breakpoint
CREATE INDEX "sinal_tutor_material_idx" ON "sinal_tutor" USING btree ("escola_id","material_id") WHERE "sinal_tutor"."material_id" is not null;--> statement-breakpoint
CREATE INDEX "tentativa_atividade_aluno_idx" ON "tentativa_atividade" USING btree ("escola_id","aluno_id");--> statement-breakpoint
CREATE INDEX "usuario_desativado_idx" ON "usuario" USING btree ("escola_id","desativado_em") WHERE desativado_em is not null;--> statement-breakpoint
CREATE INDEX "vinculo_encerrado_idx" ON "vinculo" USING btree ("escola_id","encerrado_em") WHERE "vinculo"."estado" = 'encerrado';