CREATE INDEX "auditoria_por_alvo_nova_idx" ON "auditoria" USING btree ("escola_id","entidade_id","em") WHERE "auditoria"."acao" in ('aluno.transferido', 'usuario.nome_corrigido', 'senha_provisoria.gerada', 'senha_provisoria.usada', 'usuario.email_corrigido', 'lista.transferida', 'lista.nome_corrigido');--> statement-breakpoint
DROP INDEX "auditoria_por_alvo_idx";--> statement-breakpoint
ALTER INDEX "auditoria_por_alvo_nova_idx" RENAME TO "auditoria_por_alvo_idx";
