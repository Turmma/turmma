-- A função `classificacao_do_material` e a tarefa `classificar_secoes` (classificacao-bncc, tarefa 3.0; Tech Spec, seção 3 "Migrations", passo 1, e seção 7b; regra 80, item 9). Só expande, e o código anterior continua
-- gravando: nenhuma linha muda, nenhuma coluna sai, e o código anterior não conhece a função nova nem a tarefa nova, de modo que nunca as grava. Quem grava a execução da classificação é o worker (4.0 e 5.0),
-- depois desta migration. Cinco coisas, todas sobre `execucao_agente`, `consumo_ia` e `suspensao_de_funcao`:
--
-- (1) os checks de função (`execucao_agente_funcao_valida`, `consumo_ia_funcao_valida` e `suspensao_de_funcao_funcao_valida`) e os de tarefa (`execucao_agente_tarefa_valida` e o par
--     `execucao_agente_tarefa_da_funcao`) passam a aceitar a função e a tarefa novas, e continuam recusando o que o catálogo (`FUNCOES`, `TAREFAS_DE_IA`) não tem. A suspensão por função (D60) precisa da função no
--     check: sem ele a coordenação não conseguiria suspendê-la;
-- (2) `execucao_agente.ano_letivo_id` aceita nulo (`DROP NOT NULL`, só metadado), e o check novo `execucao_agente_ano_so_nulo_na_classificacao` o limita a `classificar_secoes`: o material não tem ano
--     (PRD da F4, seção 6), e a execução que o classifica roda pela rotina, sem pessoa nem ano. Toda outra tarefa continua exigindo o ano. A FK composta `(escola_id, ano_letivo_id)` e o único
--     `(escola_id, ano_letivo_id, id)` seguem como estão: com a coluna nula a FK não confere, que é o pretendido, e o que a classificação grava aponta para a execução por `(escola_id, id)`.
--
-- Cada check vai por `ADD CONSTRAINT … NOT VALID` seguido de `VALIDATE CONSTRAINT`, como a 0036 e a 0058, e antes do código que grava a função. O `NOT VALID` não alivia a trava: o `migrar` aplica tudo numa transação só, e o
-- `DROP` e o `ADD CONSTRAINT` seguram `ACCESS EXCLUSIVE` em cada tabela até o commit, com o `VALIDATE` varrendo-a debaixo dela. É seguro hoje (a escola ainda não tem volume, e o deploy roda fora do horário letivo); quando
-- houver staging ou piloto, o `VALIDATE` de `consumo_ia` e de `execucao_agente`, que são as que crescem com o Tutor, vai para uma migration à parte, como a 0058 já registra. O `migrar` corre sob `lock_timeout` de 5 s.
SET LOCAL lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "execucao_agente" ALTER COLUMN "ano_letivo_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "consumo_ia" DROP CONSTRAINT "consumo_ia_funcao_valida";--> statement-breakpoint
ALTER TABLE "consumo_ia" ADD CONSTRAINT "consumo_ia_funcao_valida" CHECK ("consumo_ia"."funcao" in ('conversa_e_ferramentas', 'correcao_de_objetiva', 'adaptacao', 'tutor_com_o_aluno', 'sinais_para_o_professor', 'resumo_e_alerta', 'classificacao_do_material')) NOT VALID;--> statement-breakpoint
ALTER TABLE "consumo_ia" VALIDATE CONSTRAINT "consumo_ia_funcao_valida";--> statement-breakpoint
ALTER TABLE "suspensao_de_funcao" DROP CONSTRAINT "suspensao_de_funcao_funcao_valida";--> statement-breakpoint
ALTER TABLE "suspensao_de_funcao" ADD CONSTRAINT "suspensao_de_funcao_funcao_valida" CHECK ("suspensao_de_funcao"."funcao" in ('conversa_e_ferramentas', 'correcao_de_objetiva', 'adaptacao', 'tutor_com_o_aluno', 'sinais_para_o_professor', 'resumo_e_alerta', 'classificacao_do_material')) NOT VALID;--> statement-breakpoint
ALTER TABLE "suspensao_de_funcao" VALIDATE CONSTRAINT "suspensao_de_funcao_funcao_valida";--> statement-breakpoint
ALTER TABLE "execucao_agente" DROP CONSTRAINT "execucao_agente_funcao_valida";--> statement-breakpoint
ALTER TABLE "execucao_agente" DROP CONSTRAINT "execucao_agente_tarefa_valida";--> statement-breakpoint
ALTER TABLE "execucao_agente" DROP CONSTRAINT "execucao_agente_tarefa_da_funcao";--> statement-breakpoint
ALTER TABLE "execucao_agente" ADD CONSTRAINT "execucao_agente_funcao_valida" CHECK ("execucao_agente"."funcao" in ('conversa_e_ferramentas', 'correcao_de_objetiva', 'adaptacao', 'tutor_com_o_aluno', 'sinais_para_o_professor', 'resumo_e_alerta', 'classificacao_do_material')) NOT VALID;--> statement-breakpoint
ALTER TABLE "execucao_agente" ADD CONSTRAINT "execucao_agente_tarefa_valida" CHECK ("execucao_agente"."tarefa" in ('propor_ferramenta', 'gerar_atividade_objetiva', 'gerar_plano_de_aula', 'adaptar_atividade', 'turno_do_tutor', 'relatorio_da_correcao', 'resumo_do_analista', 'classificar_secoes')) NOT VALID;--> statement-breakpoint
ALTER TABLE "execucao_agente" ADD CONSTRAINT "execucao_agente_tarefa_da_funcao" CHECK (("execucao_agente"."tarefa", "execucao_agente"."funcao") in (('propor_ferramenta', 'conversa_e_ferramentas'), ('gerar_atividade_objetiva', 'conversa_e_ferramentas'), ('gerar_plano_de_aula', 'conversa_e_ferramentas'), ('adaptar_atividade', 'adaptacao'), ('turno_do_tutor', 'tutor_com_o_aluno'), ('relatorio_da_correcao', 'correcao_de_objetiva'), ('resumo_do_analista', 'resumo_e_alerta'), ('classificar_secoes', 'classificacao_do_material'))) NOT VALID;--> statement-breakpoint
ALTER TABLE "execucao_agente" ADD CONSTRAINT "execucao_agente_ano_so_nulo_na_classificacao" CHECK ("execucao_agente"."ano_letivo_id" is not null or "execucao_agente"."tarefa" = 'classificar_secoes') NOT VALID;--> statement-breakpoint
ALTER TABLE "execucao_agente" VALIDATE CONSTRAINT "execucao_agente_funcao_valida";--> statement-breakpoint
ALTER TABLE "execucao_agente" VALIDATE CONSTRAINT "execucao_agente_tarefa_valida";--> statement-breakpoint
ALTER TABLE "execucao_agente" VALIDATE CONSTRAINT "execucao_agente_tarefa_da_funcao";--> statement-breakpoint
ALTER TABLE "execucao_agente" VALIDATE CONSTRAINT "execucao_agente_ano_so_nulo_na_classificacao";
