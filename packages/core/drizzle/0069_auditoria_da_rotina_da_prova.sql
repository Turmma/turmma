-- A auditoria da rotina que encerra a prova vencida (avaliacao-e-correcao, tarefa 6.0; Tech Spec, seção 3). Só afrouxa, e o código anterior continua gravando: o check `auditoria_rotina_so_nas_acoes` ganha
-- `atividade.encerrada_pelo_limite`, a ação que o job por escola grava no worker, sem pessoa, assinada pela rotina (`NOT VALID` e `VALIDATE`, como a 0056 e a 0060). Ele continua recusando à rotina aprovar,
-- rejeitar e validar: encerrar a prova não decide nota, e o lote nasce pendente (regra 70). Sem `concurrently`: o `migrar` roda numa transação só, e o deploy é fora do horário letivo.
SET LOCAL lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "auditoria" DROP CONSTRAINT "auditoria_rotina_so_nas_acoes";--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_rotina_so_nas_acoes" CHECK (autor_operador is distinct from 'rotina' or acao in ('usuario.eliminado', 'acesso_turma.revogado', 'titular.nome_trocado', 'pedido.concluido', 'material.substituido', 'material.classificacao_herdada', 'atividade.encerrada_pelo_limite')) NOT VALID;--> statement-breakpoint
ALTER TABLE "auditoria" VALIDATE CONSTRAINT "auditoria_rotina_so_nas_acoes";
