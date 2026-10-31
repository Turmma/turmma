-- A eliminação agendada por 7 dias, com o acesso suspenso e o cancelamento (F3, tarefa 14.0; Tech Spec do F3, seções 3 e 5).
-- Só expande (regra 80, item 9): o código anterior não conhece a coluna nem o motivo novo, e nenhuma linha existente viola o
-- que entra (o `agendado` não existia: o pedido de eliminação nascia `recebido`).
--
-- - `usuario.eliminacao_agendada_em`: a data do registro. Nula para todo usuário que já existe. Enquanto não é nula, a pessoa
--   não entra (guarda, renovação, login e seletor), e a credencial fica, para o cancelamento devolver o acesso.
-- - `sessao_motivo_valido` ganha `eliminacao_agendada`: o motivo com que o registro encerra as sessões abertas da pessoa
--   naquela escola. Alargar o check é compatível com o código anterior, que só grava os motivos de antes.
-- - `pedido_titular_agendado_unico`: uma eliminação `agendado` por titular. Duas chaves de envio diferentes para a mesma
--   pessoa caem aqui, e a segunda responde `PEDIDO_EM_ESTADO_INVALIDO` (RF19). Parcial: o pedido que não está `agendado`
--   não entra, e o índice fica do tamanho das eliminações em curso.
-- - `pedido_titular_agendado_com_prazo`: só a eliminação fica `agendado`, e sempre com `eliminar_em` (a segunda camada do
--   registro e do cancelamento).
-- - `pedido_titular_cancelado_por_da_escola`: quem cancelou é usuário da escola do pedido, conferido na escrita pelo mesmo
--   `exigir_usuario_da_escola` do `registrado_por` (recomendação do `tenancy-guardian` na 11.0). O `concluido_por` fica sem
--   o gatilho de propósito: o job da eliminação (15.0) conclui com o autor `rotina` quando quem registrou já saiu, e o gatilho
--   o impediria de concluir.
ALTER TABLE "sessao" DROP CONSTRAINT "sessao_motivo_valido";--> statement-breakpoint
ALTER TABLE "usuario" ADD COLUMN "eliminacao_agendada_em" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "pedido_titular_agendado_unico" ON "pedido_titular" USING btree ("escola_id","titular_id") WHERE estado = 'agendado';--> statement-breakpoint
ALTER TABLE "pedido_titular" ADD CONSTRAINT "pedido_titular_agendado_com_prazo" CHECK ("pedido_titular"."estado" <> 'agendado' or ("pedido_titular"."tipo" = 'eliminacao' and "pedido_titular"."eliminar_em" is not null));--> statement-breakpoint
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_motivo_valido" CHECK ("sessao"."motivo" is null or "sessao"."motivo" in ('saida', 'troca_de_escola', 'reuso_de_refresh', 'desativacao', 'mfa_redefinido', 'conta_limpa', 'eliminacao_agendada'));--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "pedido_titular_cancelado_por_da_escola" AFTER INSERT OR UPDATE OF "cancelado_por" ON "pedido_titular"
  FOR EACH ROW EXECUTE FUNCTION "exigir_usuario_da_escola"('cancelado_por', 'pedido_titular_cancelado_por_da_escola_fk');
