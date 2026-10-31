-- O aceite do convite do operador (A0b, tarefa 9.0) passa a ser auditado (`convite_operador.aceito`) e a encerrar as
-- sessões abertas da conta com o motivo `convite_aceito`: os dois checks só ganham um valor. Compatível com o código
-- anterior (regra 80, item 9): ele nunca grava o valor novo, e toda linha que já existe continua valendo. As duas
-- tabelas são da nossa equipe (dezenas de linhas), e a revalidação do check é imediata.
ALTER TABLE "auditoria_operacao" DROP CONSTRAINT "auditoria_operacao_acao_valida";--> statement-breakpoint
ALTER TABLE "sessao_operador" DROP CONSTRAINT "sessao_operador_motivo_valido";--> statement-breakpoint
ALTER TABLE "auditoria_operacao" ADD CONSTRAINT "auditoria_operacao_acao_valida" CHECK ("auditoria_operacao"."acao" in ('operador.criado', 'operador.desativado', 'operador.mfa_configurado', 'convite_operador.gerado', 'convite_operador.revogado', 'convite_operador.aceito'));--> statement-breakpoint
ALTER TABLE "sessao_operador" ADD CONSTRAINT "sessao_operador_motivo_valido" CHECK ("sessao_operador"."motivo" is null or "sessao_operador"."motivo" in ('saida', 'reuso_de_refresh', 'desativacao', 'convite_aceito'));