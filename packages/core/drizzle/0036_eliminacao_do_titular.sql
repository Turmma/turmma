-- A eliminação do titular no 8º dia, com o nome trocado nos textos livres (F3, tarefa 15.0; Tech Spec do F3, seções 3, 5 e 7c).
-- Só expande ou restringe o que o código anterior nunca grava (regra 80, item 9): o autor `rotina` só assinou, até aqui,
-- `usuario.eliminado` e `acesso_turma.revogado`, e nenhum operador pode ter nascido com o apelido reservado, porque o
-- `ops:operador` o recusa na criação a partir desta tarefa e o nome `rotina` nunca foi dado a ninguém da equipe.
--
-- - `auditoria_rotina_so_nas_acoes`: o autor `rotina` só aparece em `usuario.eliminado`, `acesso_turma.revogado`,
--   `titular.nome_trocado` e `pedido.concluido`. Nunca em `entrega.aprovada`, `entrega.rejeitada` nem na validação do lote
--   (regra 70, item 3: aprovação é de pessoa). `NOT VALID` e depois `VALIDATE`: a linha existente é conferida, mas o `migrar` roda
--   numa transação, e por isso `auditoria` fica sob trava exclusiva durante a varredura (Tech Spec do F3, seção 7c, "Migration"); a
--   partir do staging, cada check vai em arquivo próprio. No banco que já rodou o expurgo por prazo, as únicas linhas `rotina` são
--   as duas ações acima.
-- - `operador_apelido_formato` passa a recusar também `rotina`, como já recusava `bootstrap`: o apelido de operador não
--   pode ser o autor que a auditoria reserva ao sistema. Mesmo desenho, `NOT VALID` e depois `VALIDATE`.
-- - Índices da troca de nome, `(escola_id, id)` e parciais de texto não nulo: a faixa de 1.000 linhas examinadas desce por
--   `id` dentro da escola. `execucao_agente` e `artefato` já têm o único `(escola_id, id)`, e `consumo_ia`, `entrega` e
--   `mensagem_agente` não tinham. Sem `concurrently` enquanto não há staging nem piloto (seção 7c, "Migration"); a partir do
--   staging, cada índice vai em arquivo próprio, fora de transação.
ALTER TABLE "operador" DROP CONSTRAINT "operador_apelido_formato";--> statement-breakpoint
CREATE INDEX "consumo_ia_entrada_idx" ON "consumo_ia" USING btree ("escola_id","id") WHERE "consumo_ia"."entrada" is not null;--> statement-breakpoint
CREATE INDEX "consumo_ia_saida_idx" ON "consumo_ia" USING btree ("escola_id","id") WHERE "consumo_ia"."saida" is not null;--> statement-breakpoint
CREATE INDEX "entrega_justificativa_idx" ON "entrega" USING btree ("escola_id","id") WHERE "entrega"."justificativa" is not null;--> statement-breakpoint
CREATE INDEX "mensagem_agente_escola_id_idx" ON "mensagem_agente" USING btree ("escola_id","id");--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_rotina_so_nas_acoes" CHECK (autor_operador is distinct from 'rotina' or acao in ('usuario.eliminado', 'acesso_turma.revogado', 'titular.nome_trocado', 'pedido.concluido')) NOT VALID;--> statement-breakpoint
ALTER TABLE "auditoria" VALIDATE CONSTRAINT "auditoria_rotina_so_nas_acoes";--> statement-breakpoint
ALTER TABLE "operador" ADD CONSTRAINT "operador_apelido_formato" CHECK ("operador"."apelido" ~ '^[a-z][a-z0-9-]{1,31}$' and "operador"."apelido" <> 'bootstrap' and "operador"."apelido" <> 'rotina') NOT VALID;--> statement-breakpoint
ALTER TABLE "operador" VALIDATE CONSTRAINT "operador_apelido_formato";
