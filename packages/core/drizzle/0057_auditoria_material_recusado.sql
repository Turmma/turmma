-- O índice do resumo do material (ingestao-do-material, tarefa 11.0; Tech Spec, seção 7c; regra 80, itens 8 e 9). Só expande, e o código anterior ignora o índice: nenhuma coluna, linha ou check muda. É parcial na única ação
-- que o resumo lê (`material.recusado`) e começa pela escola, o escopo de toda leitura: a auditoria cresce com tudo o que a escola faz, e o índice só guarda a recusa de envio. Sem `concurrently`, a exceção da 0034 (o `migrar` roda
-- todas as migrations numa transação só, e `CREATE INDEX CONCURRENTLY` não roda dentro dela): o índice lê a tabela inteira uma vez e trava a escrita nela enquanto isso. `auditoria` tem as linhas de uma escola em fase de entrada, o
-- deploy roda fora do horário letivo e o `lock_timeout` de 5 s do `migrar` desfaz a transação se a trava não vier.
CREATE INDEX "auditoria_material_recusado_idx" ON "auditoria" USING btree ("escola_id","em") WHERE "auditoria"."acao" = 'material.recusado';
