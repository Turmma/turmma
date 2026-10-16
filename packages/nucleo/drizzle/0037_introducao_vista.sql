-- A data em que a pessoa viu a introdução do papel dela (telas do aluno e primeiro acesso, tarefa 1.0; Tech Spec, seção 3).
-- Só expande (regra 80, item 9): coluna nula, sem valor padrão nem índice, que o código anterior ignora. Nula para todo
-- usuário que já existe: a introdução aparece uma vez para cada um, e a data é gravada pela própria pessoa.
ALTER TABLE "usuario" ADD COLUMN "introducao_vista_em" timestamp with time zone;
