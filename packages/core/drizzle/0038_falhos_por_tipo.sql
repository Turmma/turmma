-- O índice da medição `job.falhos{tipo}` (X5, tarefa 44.0; Tech Spec, seção 7c; regra 80, itens 8, 9 e 10). Só expande (regra 80,
-- item 9): o código anterior não conhece o índice e continua gravando. Parcial, só nos `falhou`, que são poucos: o despachante
-- salta de tipo em tipo por ele a cada 5 s, e sem ele a contagem desceria pelo `job_registro_finalizados_idx` atravessando os
-- concluídos de 7 dias para achar as falhas.
-- Sem `concurrently`, como a Tech Spec do F3, seção 7c, aceita enquanto não há staging nem piloto (a partir do staging, em arquivo
-- próprio, fora de transação). A trava de escrita dura a leitura da tabela de 7 dias, e o `migrar` corre sob `lock_timeout` de 5 s.
CREATE INDEX "job_registro_falhos_idx" ON "job_registro" USING btree ("tipo") WHERE estado = 'falhou';
