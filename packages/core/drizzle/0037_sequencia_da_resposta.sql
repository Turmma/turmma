-- A ordem das escolhas do aluno numa questão (X5, tarefa 51.0; Tech Spec, seção 7c; regra 80, itens 6 e 7).
-- Só expande (regra 80, item 9): o código anterior não conhece a coluna e continua gravando, e a linha que ele grava nasce
-- com `sequencia` 0, que é a escala do cliente antigo (o `PUT` sem `sequencia` grava a gravada mais 1).
-- `default 0` constante: no Postgres 11 em diante a coluna entra só no catálogo, sem reescrever `resposta_atividade`, que
-- cresce com o aluno. A trava exclusiva da tabela dura o instante do `ALTER`, e o `migrar` já corre sob `lock_timeout` de
-- 5 s (`LOCK_TIMEOUT_MIGRACAO_MS`, em `db/migrar.ts`), com três tentativas.
-- Sem índice: a escrita já vai pelo índice único `(escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, questao)`.
ALTER TABLE "resposta_atividade" ADD COLUMN "sequencia" bigint DEFAULT 0 NOT NULL;
