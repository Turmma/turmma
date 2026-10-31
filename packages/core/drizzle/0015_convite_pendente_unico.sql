-- No máximo um convite em aberto (nem usado, nem revogado) por usuário na escola (A0b, tarefa 2.0; Tech Spec da A0b,
-- seções 3 e 7c): a rede de segurança da trava da escola, que deixa um só convite de coordenação em aberto por escola.
-- Só um índice novo, compatível com o código anterior (regra 80, item 9): o F1 sempre revogava os convites do usuário
-- antes de criar outro, então nenhum convite gravado pelo código viola a regra (um seed escrito direto no banco pode
-- violar, e a migration falha alto nele). `convite` tem um punhado de linhas por escola.
CREATE UNIQUE INDEX "convite_pendente_unico" ON "convite" USING btree ("escola_id","usuario_id") WHERE "convite"."usado_em" is null and "convite"."revogado_em" is null;