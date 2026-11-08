-- A posse do e-mail da conta (acesso-e-convites, tarefa 7.0; Tech Spec, seções 3 e 5, "Posse do e-mail").
-- Só expande (regra 80, item 9): uma coluna nula, que o código anterior não conhece e não lê. Nenhuma linha existente é
-- tocada, nem preenchida: conta antiga fica não verificada até o aceite de um convite por e-mail, o link de verificar ou o
-- "esqueci a senha". Voltar a versão: a coluna pode ficar, sem uso. `conta` é global, sem `escola_id` (regra 10, itens 1 e 9).
ALTER TABLE "conta" ADD COLUMN "email_verificado_em" timestamp with time zone;
