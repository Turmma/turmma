-- Os coordenadores ativos de cada escola (A0b, tarefa 5.0): a lista do painel da operação pergunta, para cada escola da
-- página, se há coordenador ativo (o estado da coordenação). Sem este índice, o plano varre `usuario` inteiro, de todas as
-- escolas, e a tabela cresce com os alunos (regra 80, item 8; o `EXPLAIN` está em `tasks/prd-apresentacao-painel/5_task.md`).
-- Só um índice novo, parcial (uma linha por coordenador ativo), compatível com o código anterior (regra 80, item 9). Não é
-- `concurrently` porque o migrador roda cada migration numa transação; no MVP o banco só tem dado sintético, e o deploy
-- é fora do horário letivo.
CREATE INDEX "usuario_coordenador_ativo_idx" ON "usuario" USING btree ("escola_id") WHERE papel = 'coordenador' and desativado_em is null;
