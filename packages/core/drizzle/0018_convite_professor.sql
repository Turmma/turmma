-- O convite do professor (A1, tarefa 3.0): o check de `convite.tipo` passa a aceitar `professor`, que a coordenação da
-- escola gera ao cadastrar o professor, com validade de 7 dias (a do coordenador continua 72 h; as duas em
-- `VALIDADE_DO_CONVITE_HORAS_POR_TIPO`, de `@educa/shared`). Só expande (regra 80, item 9): toda linha que já existe é
-- `coordenador` e continua valendo, e o código anterior nunca grava o valor novo. `convite` tem um punhado de linhas por
-- escola, e a revalidação do check é imediata. Revertido o código com convite de professor em aberto, o aceite dele
-- funciona como o de coordenador, com o papel do `usuario` (Tech Spec da A1, seção 3): o operador continua sem alcançá-lo,
-- porque o código anterior já filtrava `tipo = 'coordenador'`.
ALTER TABLE "convite" DROP CONSTRAINT "convite_tipo_valido";--> statement-breakpoint
ALTER TABLE "convite" ADD CONSTRAINT "convite_tipo_valido" CHECK ("convite"."tipo" in ('coordenador', 'professor'));