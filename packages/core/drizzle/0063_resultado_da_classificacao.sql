-- O resultado da execução da classificação do material (classificacao-bncc, tarefa 4.0; Tech Spec, seção 5 "Classificação"; regra 80, item 9). Só expande, e o código anterior continua gravando: nenhuma linha muda e nenhuma coluna
-- sai. O check `execucao_agente_resultado_so_na_concluida` lista os `tipo` que o `resultado` aceita, e a execução de `classificar_secoes` conclui com um tipo que ele ainda não tem (`classificacao_do_material`, com
-- quantas seções gravou: o que ela grava está em `habilidade_da_secao`, que aponta a execução, e não num objeto com id). Sem este passo o `concluirRodando` do worker bateria no check e nenhuma classificação terminaria `concluida`.
-- O código anterior não conhece o tipo e nunca o grava, de modo que a versão de antes do deploy lê e escreve como sempre.
--
-- O check troca por `ADD CONSTRAINT … NOT VALID` seguido de `VALIDATE CONSTRAINT`, como a 0062: o `migrar` corre sob `lock_timeout` de 5 s, o `DROP` e o `ADD` seguram `ACCESS EXCLUSIVE` em `execucao_agente` até o commit, e o
-- `VALIDATE` varre a tabela debaixo dela. É seguro hoje (a escola ainda não tem volume, e o deploy roda fora do horário letivo); com staging ou piloto, o `VALIDATE` vai para uma migration à parte, como a 0058 registra.
SET LOCAL lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "execucao_agente" DROP CONSTRAINT "execucao_agente_resultado_so_na_concluida";--> statement-breakpoint
ALTER TABLE "execucao_agente" ADD CONSTRAINT "execucao_agente_resultado_so_na_concluida" CHECK (("execucao_agente"."estado" = 'concluida') = ("execucao_agente"."resultado" is not null) and ("execucao_agente"."resultado" is null or (jsonb_typeof("execucao_agente"."resultado") = 'object' and coalesce("execucao_agente"."resultado" ->> 'tipo', '') in ('mensagem', 'artefato', 'mensagem_do_tutor', 'lote_de_correcao', 'resumo_do_analista', 'classificacao_do_material')))) NOT VALID;--> statement-breakpoint
ALTER TABLE "execucao_agente" VALIDATE CONSTRAINT "execucao_agente_resultado_so_na_concluida";
