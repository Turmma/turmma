-- A data em que a pessoa viu a introdução do papel dela (telas do aluno e primeiro acesso, tarefa 1.0).
-- Só expande (regra 80, item 9): coluna nula, sem valor padrão nem índice. O código anterior não a conhece e a ignora, e nenhuma
-- linha existente viola o que entra. Nula quer dizer "ainda não viu": quem já está no sistema vê a introdução uma vez, no
-- primeiro login depois do deploy.
ALTER TABLE "usuario" ADD COLUMN "introducao_vista_em" timestamp with time zone;
