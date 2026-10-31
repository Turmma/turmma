-- Para onde o conteúdo foi: o provedor que atendeu cada chamada com envio externo (F3, tarefa 7.0; Tech Spec do F3,
-- seção 3). Só expande (regra 80, item 9): uma coluna nula e um check que o código anterior já cumpre, porque ele nunca
-- grava provedor.
--
-- - `consumo_ia.provedor`: o `IA_PROVEDOR_ID` da instância que fez a chamada. Nulo no adaptador falso, no modelo local,
--   na regra fixa, na chamada que nem chegou a sair, e em toda linha anterior a esta migration.
-- - `consumo_ia_provedor_so_no_envio_externo`: provedor só onde houve envio externo. A exigência contrária (envio
--   externo sempre com provedor) NÃO entra aqui: o `migrar` aplica toda migration pendente antes de as instâncias
--   subirem, e um check assim recusaria o insert do código anterior, o que quebraria o rollback. Ela vai numa migration
--   de um release posterior (Tech Spec do F3, seção 3); até lá, quem garante é o tipo da porta (`EnvioDaChamada`).
-- - O check é validado na própria migration: toda linha existente tem `provedor` nulo, e ainda não há staging nem piloto
--   (Tech Spec do F3, seção 7c). A partir do staging, cada check vai em arquivo próprio, `NOT VALID` e depois `VALIDATE`.
ALTER TABLE "consumo_ia" ADD COLUMN "provedor" text;--> statement-breakpoint
ALTER TABLE "consumo_ia" ADD CONSTRAINT "consumo_ia_provedor_so_no_envio_externo" CHECK ("consumo_ia"."provedor" is null or "consumo_ia"."envio_externo");