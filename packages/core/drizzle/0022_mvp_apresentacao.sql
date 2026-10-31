-- O MVP de apresentação, A2 a A5 numa fatia só (D77; `docs/mvp-rapido.md`, seção 7): as dezessete tabelas de material,
-- Assistente de ensino, atividade e correção, Tutor e governança, numa migration só, porque o snapshot do drizzle é uma
-- corrente. Tabelas novas e vazias, mais duas colunas nulas em `configuracao_operacional_escola`: só expande (regra 80,
-- item 9), e o código anterior não as conhece. A referência de cada tabela é `docs/mvp-contratos.md`.
--
-- O que o drizzle-kit não escreve, e está aqui à mão:
-- - `btree_gin`, para o índice GIN do trecho começar pela escola (regra 80, item 8); é contrib confiável do Postgres,
--   como o `citext` da 0005.
-- - `ON DELETE SET NULL ("coluna")` (Postgres 15+) nas autorias que viram nulo quando a pessoa é eliminada
--   (`artefato.criado_por`, `consumo_ia.aluno_id`, `execucao_agente.solicitada_por`, `material.enviado_por` e
--   `material.excluido_por`): o `set null` que o drizzle-kit gera anularia também a `escola_id`, que é `not null`.
-- - Os gatilhos do fim do arquivo: a autoria que fica depois da eliminação (quem aprovou, quem aplicou, quem validou,
--   quem abriu o destaque, quem suspendeu), conferida na gravação pela `exigir_usuario_da_escola` da 0013; a versão
--   adaptada, que só é aplicada à turma com a entrega aprovada (regra 70, item 3); e o lote de correção, que só fica
--   aprovado com o registro da validação (D56).
--
-- Não existe tabela `nota` (D46), nenhuma coluna guarda nota, conceito ou devolutiva sobre texto de aluno (D55), e
-- nenhuma coluna guarda texto sobre a pessoa (D57, D66). Todo campo pessoal daqui está no mapa de `docs/lgpd.md`.
CREATE EXTENSION IF NOT EXISTS btree_gin;--> statement-breakpoint
CREATE TABLE "artefato" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"ano_letivo_id" uuid NOT NULL,
	"turma_id" uuid NOT NULL,
	"disciplina_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"titulo" text NOT NULL,
	"conteudo" jsonb NOT NULL,
	"origem_id" uuid,
	"execucao_id" uuid,
	"criado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artefato_escola_id_unico" UNIQUE("escola_id","id"),
	CONSTRAINT "artefato_tipo_valido" CHECK ("artefato"."tipo" in ('atividade_objetiva', 'plano_de_aula')),
	CONSTRAINT "artefato_titulo_preenchido" CHECK (char_length(btrim("artefato"."titulo")) between 1 and 160),
	CONSTRAINT "artefato_conteudo_do_tipo" CHECK (jsonb_typeof("artefato"."conteudo") = 'object' and coalesce("artefato"."conteudo" ->> 'tipo', '') = "artefato"."tipo"),
	CONSTRAINT "artefato_adaptada_so_de_atividade" CHECK ("artefato"."origem_id" is null or "artefato"."tipo" = 'atividade_objetiva'),
	CONSTRAINT "artefato_adaptacao_fechada" CHECK (("artefato"."origem_id" is null) = ("artefato"."conteudo" -> 'adaptacao' is null) and case
        when "artefato"."conteudo" -> 'adaptacao' is null then true
        when jsonb_typeof("artefato"."conteudo" -> 'adaptacao') = 'object' and jsonb_typeof("artefato"."conteudo" #> '{adaptacao,tipos}') = 'array' then
          jsonb_array_length("artefato"."conteudo" #> '{adaptacao,tipos}') >= 1
          and "artefato"."conteudo" #> '{adaptacao,tipos}' <@ '["fonte_ampliada", "tempo_adicional", "linguagem_direta", "enunciado_simplificado", "resposta_escrita_no_lugar_da_oral", "leitura_de_apoio"]'::jsonb
          and ("artefato"."conteudo" -> 'adaptacao') - 'tipos' - 'tempoExtraPercentual' = '{}'::jsonb
        else false
      end)
);
--> statement-breakpoint
CREATE TABLE "atividade_aplicada" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"ano_letivo_id" uuid NOT NULL,
	"turma_id" uuid NOT NULL,
	"artefato_id" uuid NOT NULL,
	"avaliativa" boolean NOT NULL,
	"estado" text DEFAULT 'aberta' NOT NULL,
	"aplicada_por" uuid NOT NULL,
	"aplicada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"encerrada_em" timestamp with time zone,
	CONSTRAINT "atividade_aplicada_escola_id_unico" UNIQUE("escola_id","id"),
	CONSTRAINT "atividade_aplicada_escola_ano_id_unico" UNIQUE("escola_id","ano_letivo_id","id"),
	CONSTRAINT "atividade_aplicada_estado_valido" CHECK ("atividade_aplicada"."estado" in ('aberta', 'encerrada')),
	CONSTRAINT "atividade_aplicada_encerrada_tem_data" CHECK (("atividade_aplicada"."estado" = 'encerrada') = ("atividade_aplicada"."encerrada_em" is not null))
);
--> statement-breakpoint
CREATE TABLE "consumo_ia" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"aluno_id" uuid,
	"execucao_id" uuid,
	"tarefa" text NOT NULL,
	"funcao" text NOT NULL,
	"perfil" text NOT NULL,
	"origem" text NOT NULL,
	"modelo" text NOT NULL,
	"prompt_versao" text NOT NULL,
	"tokens_de_entrada" integer NOT NULL,
	"tokens_de_saida" integer NOT NULL,
	"custo_micros" bigint DEFAULT 0 NOT NULL,
	"duracao_ms" integer NOT NULL,
	"envio_externo" boolean NOT NULL,
	"tentativas" integer NOT NULL,
	"estado" text NOT NULL,
	"codigo_de_erro" text,
	"entrada" jsonb,
	"saida" jsonb,
	"em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consumo_ia_funcao_valida" CHECK ("consumo_ia"."funcao" in ('conversa_e_ferramentas', 'correcao_de_objetiva', 'adaptacao', 'tutor_com_o_aluno', 'sinais_para_o_professor', 'resumo_e_alerta')),
	CONSTRAINT "consumo_ia_perfil_valido" CHECK ("consumo_ia"."perfil" in ('rapido', 'padrao', 'complexo', 'visao')),
	CONSTRAINT "consumo_ia_origem_valida" CHECK ("consumo_ia"."origem" in ('falso', 'openai_compat', 'regra_fixa')),
	CONSTRAINT "consumo_ia_estado_valido" CHECK ("consumo_ia"."estado" in ('concluida', 'falhou')),
	CONSTRAINT "consumo_ia_tarefa_e_nome" CHECK ("consumo_ia"."tarefa" ~ '^[a-z][a-z0-9_]{2,63}$'),
	CONSTRAINT "consumo_ia_modelo_preenchido" CHECK (char_length(btrim("consumo_ia"."modelo")) between 1 and 120),
	CONSTRAINT "consumo_ia_prompt_versao_preenchida" CHECK (char_length(btrim("consumo_ia"."prompt_versao")) between 1 and 60),
	CONSTRAINT "consumo_ia_numeros_validos" CHECK ("consumo_ia"."tokens_de_entrada" >= 0 and "consumo_ia"."tokens_de_saida" >= 0 and "consumo_ia"."custo_micros" >= 0 and "consumo_ia"."duracao_ms" >= 0 and "consumo_ia"."tentativas" >= 0),
	CONSTRAINT "consumo_ia_erro_e_codigo" CHECK ("consumo_ia"."codigo_de_erro" is null or "consumo_ia"."codigo_de_erro" ~ '^[A-Z][A-Z0-9_]{2,63}$'),
	CONSTRAINT "consumo_ia_erro_so_no_que_falhou" CHECK (("consumo_ia"."estado" = 'falhou') = ("consumo_ia"."codigo_de_erro" is not null)),
	CONSTRAINT "consumo_ia_aluno_so_no_tutor" CHECK ("consumo_ia"."aluno_id" is null or "consumo_ia"."funcao" in ('tutor_com_o_aluno', 'sinais_para_o_professor')),
	CONSTRAINT "consumo_ia_sem_texto_de_aluno" CHECK ("consumo_ia"."funcao" not in ('tutor_com_o_aluno', 'sinais_para_o_professor') or ("consumo_ia"."entrada" is null and "consumo_ia"."saida" is null))
);
--> statement-breakpoint
CREATE TABLE "correcao" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"ano_letivo_id" uuid NOT NULL,
	"entrega_id" uuid NOT NULL,
	"atividade_aplicada_id" uuid NOT NULL,
	"aluno_id" uuid NOT NULL,
	"acertos" smallint NOT NULL,
	"total" smallint NOT NULL,
	"em_branco" smallint NOT NULL,
	"por_habilidade" jsonb NOT NULL,
	"destaques" text[] DEFAULT '{}'::text[] NOT NULL,
	"destaque_aberto_em" timestamp with time zone,
	"destaque_aberto_por" uuid,
	"corrigida_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "correcao_contagem_valida" CHECK ("correcao"."total" between 1 and 20 and "correcao"."acertos" >= 0 and "correcao"."em_branco" >= 0 and "correcao"."acertos" + "correcao"."em_branco" <= "correcao"."total"),
	CONSTRAINT "correcao_por_habilidade_e_lista" CHECK (jsonb_typeof("correcao"."por_habilidade") = 'array'),
	CONSTRAINT "correcao_destaques_validos" CHECK ("correcao"."destaques" <@ array['em_branco', 'fora_do_historico', 'padrao_de_erro']::text[]),
	CONSTRAINT "correcao_abertura_so_de_destaque" CHECK (("correcao"."destaque_aberto_em" is null) = ("correcao"."destaque_aberto_por" is null) and ("correcao"."destaque_aberto_em" is null or cardinality("correcao"."destaques") > 0))
);
--> statement-breakpoint
CREATE TABLE "entrega" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"ano_letivo_id" uuid NOT NULL,
	"turma_id" uuid NOT NULL,
	"funcao" text NOT NULL,
	"tipo" text NOT NULL,
	"artefato_id" uuid,
	"atividade_aplicada_id" uuid,
	"execucao_id" uuid,
	"estado" text DEFAULT 'pendente' NOT NULL,
	"decidida_por" uuid,
	"decidida_em" timestamp with time zone,
	"justificativa" text,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entrega_escola_id_unico" UNIQUE("escola_id","id"),
	CONSTRAINT "entrega_escola_id_aplicacao_unico" UNIQUE("escola_id","id","atividade_aplicada_id"),
	CONSTRAINT "entrega_estado_valido" CHECK ("entrega"."estado" in ('pendente', 'aprovada', 'rejeitada')),
	CONSTRAINT "entrega_tipo_valido" CHECK ("entrega"."tipo" in ('versao_adaptada', 'lote_de_correcao')),
	CONSTRAINT "entrega_funcao_do_tipo" CHECK (("entrega"."tipo", "entrega"."funcao") in (('versao_adaptada', 'adaptacao'), ('lote_de_correcao', 'correcao_de_objetiva'))),
	CONSTRAINT "entrega_alvo_do_tipo" CHECK (("entrega"."tipo" = 'versao_adaptada') = ("entrega"."artefato_id" is not null) and ("entrega"."tipo" = 'lote_de_correcao') = ("entrega"."atividade_aplicada_id" is not null)),
	CONSTRAINT "entrega_decisao_registrada" CHECK (("entrega"."estado" = 'pendente') = ("entrega"."decidida_por" is null) and ("entrega"."decidida_por" is null) = ("entrega"."decidida_em" is null)),
	CONSTRAINT "entrega_rejeitada_com_justificativa" CHECK (("entrega"."estado" = 'rejeitada') = ("entrega"."justificativa" is not null)),
	CONSTRAINT "entrega_justificativa_preenchida" CHECK ("entrega"."justificativa" is null or char_length(btrim("entrega"."justificativa")) between 8 and 500)
);
--> statement-breakpoint
CREATE TABLE "execucao_agente" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"ano_letivo_id" uuid NOT NULL,
	"funcao" text NOT NULL,
	"tarefa" text NOT NULL,
	"solicitada_por" uuid,
	"chave_envio" uuid NOT NULL,
	"estado" text DEFAULT 'pendente' NOT NULL,
	"entrada" jsonb NOT NULL,
	"resultado" jsonb,
	"erro" text,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"iniciada_em" timestamp with time zone,
	"concluida_em" timestamp with time zone,
	CONSTRAINT "execucao_agente_escola_id_unico" UNIQUE("escola_id","id"),
	CONSTRAINT "execucao_agente_funcao_valida" CHECK ("execucao_agente"."funcao" in ('conversa_e_ferramentas', 'correcao_de_objetiva', 'adaptacao', 'tutor_com_o_aluno', 'sinais_para_o_professor', 'resumo_e_alerta')),
	CONSTRAINT "execucao_agente_tarefa_valida" CHECK ("execucao_agente"."tarefa" in ('propor_ferramenta', 'gerar_atividade_objetiva', 'gerar_plano_de_aula', 'adaptar_atividade', 'turno_do_tutor', 'relatorio_da_correcao', 'resumo_do_analista')),
	CONSTRAINT "execucao_agente_tarefa_da_funcao" CHECK (("execucao_agente"."tarefa", "execucao_agente"."funcao") in (('propor_ferramenta', 'conversa_e_ferramentas'), ('gerar_atividade_objetiva', 'conversa_e_ferramentas'), ('gerar_plano_de_aula', 'conversa_e_ferramentas'), ('adaptar_atividade', 'adaptacao'), ('turno_do_tutor', 'tutor_com_o_aluno'), ('relatorio_da_correcao', 'correcao_de_objetiva'), ('resumo_do_analista', 'resumo_e_alerta'))),
	CONSTRAINT "execucao_agente_estado_valido" CHECK ("execucao_agente"."estado" in ('pendente', 'rodando', 'concluida', 'falhou')),
	CONSTRAINT "execucao_agente_entrada_da_tarefa" CHECK (jsonb_typeof("execucao_agente"."entrada") = 'object' and coalesce("execucao_agente"."entrada" ->> 'tarefa', '') = "execucao_agente"."tarefa"),
	CONSTRAINT "execucao_agente_resultado_so_na_concluida" CHECK (("execucao_agente"."estado" = 'concluida') = ("execucao_agente"."resultado" is not null) and ("execucao_agente"."resultado" is null or (jsonb_typeof("execucao_agente"."resultado") = 'object' and coalesce("execucao_agente"."resultado" ->> 'tipo', '') in ('mensagem', 'artefato', 'mensagem_do_tutor', 'lote_de_correcao', 'resumo_do_analista')))),
	CONSTRAINT "execucao_agente_erro_e_codigo" CHECK ("execucao_agente"."erro" is null or "execucao_agente"."erro" ~ '^[A-Z][A-Z0-9_]{2,63}$'),
	CONSTRAINT "execucao_agente_erro_so_na_que_falhou" CHECK (("execucao_agente"."estado" = 'falhou') = ("execucao_agente"."erro" is not null)),
	CONSTRAINT "execucao_agente_rodando_tem_inicio" CHECK ("execucao_agente"."estado" <> 'rodando' or "execucao_agente"."iniciada_em" is not null),
	CONSTRAINT "execucao_agente_fim_so_na_terminada" CHECK (("execucao_agente"."estado" in ('concluida', 'falhou')) = ("execucao_agente"."concluida_em" is not null))
);
--> statement-breakpoint
CREATE TABLE "material" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"disciplina_id" uuid NOT NULL,
	"titulo" text NOT NULL,
	"titularidade" text NOT NULL,
	"licenciante" text,
	"licenca" text NOT NULL,
	"declaracao" boolean NOT NULL,
	"sha256" text NOT NULL,
	"tamanho_bytes" integer NOT NULL,
	"paginas" integer,
	"estado" text DEFAULT 'processando' NOT NULL,
	"falha" text,
	"enviado_por" uuid,
	"enviado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"excluido_por" uuid,
	"excluido_em" timestamp with time zone,
	CONSTRAINT "material_escola_id_unico" UNIQUE("escola_id","id"),
	CONSTRAINT "material_escola_disciplina_id_unico" UNIQUE("escola_id","disciplina_id","id"),
	CONSTRAINT "material_titulo_preenchido" CHECK (char_length(btrim("material"."titulo")) between 1 and 160),
	CONSTRAINT "material_titularidade_valida" CHECK ("material"."titularidade" in ('escola', 'professor', 'terceiro_com_licenca', 'dominio_publico')),
	CONSTRAINT "material_licenca_valida" CHECK ("material"."licenca" in ('dominio_publico', 'autoria_da_escola', 'licenca_aberta', 'licenca_comercial_autorizada')),
	CONSTRAINT "material_com_declaracao" CHECK ("material"."declaracao"),
	CONSTRAINT "material_licenciante_so_de_terceiro" CHECK (("material"."titularidade" = 'terceiro_com_licenca') = ("material"."licenciante" is not null)),
	CONSTRAINT "material_licenciante_preenchido" CHECK ("material"."licenciante" is null or char_length(btrim("material"."licenciante")) between 1 and 120),
	CONSTRAINT "material_sha256_formato" CHECK ("material"."sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "material_tamanho_valido" CHECK ("material"."tamanho_bytes" between 1 and 20971520),
	CONSTRAINT "material_paginas_validas" CHECK ("material"."paginas" is null or "material"."paginas" >= 1),
	CONSTRAINT "material_estado_valido" CHECK ("material"."estado" in ('processando', 'pronto', 'falhou')),
	CONSTRAINT "material_falha_valida" CHECK ("material"."falha" is null or "material"."falha" in ('arquivo_invalido', 'sem_texto', 'extracao_falhou')),
	CONSTRAINT "material_falha_so_no_que_falhou" CHECK (("material"."estado" = 'falhou') = ("material"."falha" is not null)),
	CONSTRAINT "material_pronto_tem_paginas" CHECK ("material"."estado" <> 'pronto' or "material"."paginas" is not null),
	CONSTRAINT "material_excluido_por_so_no_excluido" CHECK ("material"."excluido_por" is null or "material"."excluido_em" is not null)
);
--> statement-breakpoint
CREATE TABLE "mensagem_agente" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"ano_letivo_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"execucao_id" uuid NOT NULL,
	"autor" text NOT NULL,
	"conteudo" jsonb NOT NULL,
	"turma_id" uuid,
	"disciplina_id" uuid,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mensagem_agente_autor_valido" CHECK ("mensagem_agente"."autor" in ('usuario', 'agente')),
	CONSTRAINT "mensagem_agente_conteudo_do_autor" CHECK (jsonb_typeof("mensagem_agente"."conteudo") = 'object' and (coalesce("mensagem_agente"."conteudo" ->> 'tipo', '') = 'texto' or ("mensagem_agente"."autor" = 'agente' and coalesce("mensagem_agente"."conteudo" ->> 'tipo', '') = 'proposta_de_ferramenta'))),
	CONSTRAINT "mensagem_agente_contexto_so_do_usuario" CHECK (("mensagem_agente"."autor" = 'usuario') = ("mensagem_agente"."turma_id" is not null) and ("mensagem_agente"."turma_id" is not null) = ("mensagem_agente"."disciplina_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "mensagem_tutor" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"ano_letivo_id" uuid NOT NULL,
	"turma_id" uuid NOT NULL,
	"aluno_id" uuid NOT NULL,
	"execucao_id" uuid NOT NULL,
	"atividade_aplicada_id" uuid,
	"material_id" uuid,
	"autor" text NOT NULL,
	"tipo" text DEFAULT 'texto' NOT NULL,
	"texto" text NOT NULL,
	"citacoes" jsonb,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mensagem_tutor_autor_valido" CHECK ("mensagem_tutor"."autor" in ('aluno', 'tutor')),
	CONSTRAINT "mensagem_tutor_tipo_valido" CHECK ("mensagem_tutor"."tipo" in ('texto', 'assunto_delicado')),
	CONSTRAINT "mensagem_tutor_fixa_so_do_tutor" CHECK ("mensagem_tutor"."tipo" = 'texto' or "mensagem_tutor"."autor" = 'tutor'),
	CONSTRAINT "mensagem_tutor_texto_preenchido" CHECK (char_length("mensagem_tutor"."texto") between 1 and (case when "mensagem_tutor"."autor" = 'aluno' then 2000 else 8000 end)),
	CONSTRAINT "mensagem_tutor_citacoes_so_do_tutor" CHECK ("mensagem_tutor"."citacoes" is null or ("mensagem_tutor"."autor" = 'tutor' and jsonb_typeof("mensagem_tutor"."citacoes") = 'array'))
);
--> statement-breakpoint
CREATE TABLE "resposta_atividade" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"ano_letivo_id" uuid NOT NULL,
	"atividade_aplicada_id" uuid NOT NULL,
	"aluno_id" uuid NOT NULL,
	"questao" smallint NOT NULL,
	"alternativa" smallint NOT NULL,
	"respondida_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resposta_atividade_questao_valida" CHECK ("resposta_atividade"."questao" between 1 and 20),
	CONSTRAINT "resposta_atividade_alternativa_valida" CHECK ("resposta_atividade"."alternativa" between 0 and 3)
);
--> statement-breakpoint
CREATE TABLE "resumo_do_analista" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"ano_letivo_id" uuid NOT NULL,
	"execucao_id" uuid,
	"conteudo" jsonb NOT NULL,
	"gerado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resumo_do_analista_conteudo_formato" CHECK (jsonb_typeof("resumo_do_analista"."conteudo") = 'object' and coalesce(jsonb_typeof("resumo_do_analista"."conteudo" -> 'recortes'), '') = 'array' and coalesce(jsonb_typeof("resumo_do_analista"."conteudo" -> 'alertas'), '') = 'array')
);
--> statement-breakpoint
CREATE TABLE "sinal_tutor" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"ano_letivo_id" uuid NOT NULL,
	"turma_id" uuid NOT NULL,
	"aluno_id" uuid NOT NULL,
	"execucao_id" uuid,
	"tipo" text NOT NULL,
	"atividade_aplicada_id" uuid,
	"questao" smallint,
	"material_id" uuid,
	"pagina" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sinal_tutor_tipo_valido" CHECK ("sinal_tutor"."tipo" in ('travou', 'resposta_pronta', 'duvida_repetida', 'atencao_humana')),
	CONSTRAINT "sinal_tutor_atencao_humana_sem_referencia" CHECK ("sinal_tutor"."tipo" <> 'atencao_humana' or ("sinal_tutor"."atividade_aplicada_id" is null and "sinal_tutor"."questao" is null and "sinal_tutor"."material_id" is null and "sinal_tutor"."pagina" is null)),
	CONSTRAINT "sinal_tutor_questao_valida" CHECK ("sinal_tutor"."questao" is null or ("sinal_tutor"."questao" between 1 and 20 and "sinal_tutor"."atividade_aplicada_id" is not null)),
	CONSTRAINT "sinal_tutor_pagina_valida" CHECK ("sinal_tutor"."pagina" is null or ("sinal_tutor"."pagina" >= 1 and "sinal_tutor"."material_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "suspensao_de_funcao" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"funcao" text NOT NULL,
	"motivo" text,
	"suspensa_por" uuid NOT NULL,
	"suspensa_em" timestamp with time zone DEFAULT now() NOT NULL,
	"retomada_por" uuid,
	"retomada_em" timestamp with time zone,
	CONSTRAINT "suspensao_de_funcao_funcao_valida" CHECK ("suspensao_de_funcao"."funcao" in ('conversa_e_ferramentas', 'correcao_de_objetiva', 'adaptacao', 'tutor_com_o_aluno', 'sinais_para_o_professor', 'resumo_e_alerta')),
	CONSTRAINT "suspensao_de_funcao_motivo_valido" CHECK ("suspensao_de_funcao"."motivo" is null or "suspensao_de_funcao"."motivo" in ('erro_recorrente', 'revisao_pedagogica', 'pedido_da_comunidade', 'incidente', 'decisao_da_escola')),
	CONSTRAINT "suspensao_de_funcao_retomada_registrada" CHECK (("suspensao_de_funcao"."retomada_em" is null) = ("suspensao_de_funcao"."retomada_por" is null)),
	CONSTRAINT "suspensao_de_funcao_retomada_depois" CHECK ("suspensao_de_funcao"."retomada_em" is null or "suspensao_de_funcao"."retomada_em" >= "suspensao_de_funcao"."suspensa_em")
);
--> statement-breakpoint
CREATE TABLE "tentativa_atividade" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"ano_letivo_id" uuid NOT NULL,
	"atividade_aplicada_id" uuid NOT NULL,
	"aluno_id" uuid NOT NULL,
	"iniciada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"enviada_em" timestamp with time zone,
	CONSTRAINT "tentativa_atividade_uma_por_aluno" UNIQUE("escola_id","ano_letivo_id","atividade_aplicada_id","aluno_id"),
	CONSTRAINT "tentativa_atividade_envio_depois_do_inicio" CHECK ("tentativa_atividade"."enviada_em" is null or "tentativa_atividade"."enviada_em" >= "tentativa_atividade"."iniciada_em")
);
--> statement-breakpoint
CREATE TABLE "thread_agente" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"ano_letivo_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"agente" text NOT NULL,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "thread_agente_escola_ano_id_unico" UNIQUE("escola_id","ano_letivo_id","id"),
	CONSTRAINT "thread_agente_agente_valido" CHECK ("thread_agente"."agente" in ('assistente_de_ensino', 'tutor', 'analista_de_desempenho_escolar'))
);
--> statement-breakpoint
CREATE TABLE "trecho" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"disciplina_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	"pagina" integer NOT NULL,
	"texto" text NOT NULL,
	"busca" tsvector GENERATED ALWAYS AS (to_tsvector('portuguese', "trecho"."texto")) STORED,
	CONSTRAINT "trecho_pagina_valida" CHECK ("trecho"."pagina" >= 1),
	CONSTRAINT "trecho_texto_preenchido" CHECK (char_length("trecho"."texto") between 1 and 20000)
);
--> statement-breakpoint
CREATE TABLE "validacao_do_lote" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"escola_id" uuid NOT NULL,
	"ano_letivo_id" uuid NOT NULL,
	"entrega_id" uuid NOT NULL,
	"atividade_aplicada_id" uuid NOT NULL,
	"apresentado" jsonb NOT NULL,
	"aberto" jsonb NOT NULL,
	"confirmada_por" uuid NOT NULL,
	"confirmada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "validacao_do_lote_formato" CHECK (jsonb_typeof("validacao_do_lote"."apresentado") = 'object' and coalesce(jsonb_typeof("validacao_do_lote"."apresentado" -> 'resumo'), '') = 'object' and coalesce(jsonb_typeof("validacao_do_lote"."apresentado" -> 'destaques'), '') = 'array' and jsonb_typeof("validacao_do_lote"."aberto") = 'array'),
	CONSTRAINT "validacao_do_lote_destaques_todos_abertos" CHECK (jsonb_path_query_array("validacao_do_lote"."apresentado", '$.destaques[*].alunoId') <@ jsonb_path_query_array("validacao_do_lote"."aberto", '$[*].alunoId'))
);
--> statement-breakpoint
ALTER TABLE "configuracao_operacional_escola" ADD COLUMN "tutor_trocas_por_dia" integer;--> statement-breakpoint
ALTER TABLE "configuracao_operacional_escola" ADD COLUMN "tutor_trocas_por_mes" integer;--> statement-breakpoint
ALTER TABLE "artefato" ADD CONSTRAINT "artefato_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artefato" ADD CONSTRAINT "artefato_turma_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","turma_id") REFERENCES "public"."turma"("escola_id","ano_letivo_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artefato" ADD CONSTRAINT "artefato_disciplina_da_escola_fk" FOREIGN KEY ("escola_id","disciplina_id") REFERENCES "public"."disciplina"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artefato" ADD CONSTRAINT "artefato_origem_da_escola_fk" FOREIGN KEY ("escola_id","origem_id") REFERENCES "public"."artefato"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artefato" ADD CONSTRAINT "artefato_execucao_da_escola_fk" FOREIGN KEY ("escola_id","execucao_id") REFERENCES "public"."execucao_agente"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artefato" ADD CONSTRAINT "artefato_criado_por_da_escola_fk" FOREIGN KEY ("escola_id","criado_por") REFERENCES "public"."usuario"("escola_id","id") ON DELETE SET NULL ("criado_por") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_turma_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","turma_id") REFERENCES "public"."turma"("escola_id","ano_letivo_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atividade_aplicada" ADD CONSTRAINT "atividade_aplicada_artefato_da_escola_fk" FOREIGN KEY ("escola_id","artefato_id") REFERENCES "public"."artefato"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumo_ia" ADD CONSTRAINT "consumo_ia_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumo_ia" ADD CONSTRAINT "consumo_ia_execucao_da_escola_fk" FOREIGN KEY ("escola_id","execucao_id") REFERENCES "public"."execucao_agente"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumo_ia" ADD CONSTRAINT "consumo_ia_aluno_da_escola_fk" FOREIGN KEY ("escola_id","aluno_id") REFERENCES "public"."usuario"("escola_id","id") ON DELETE SET NULL ("aluno_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correcao" ADD CONSTRAINT "correcao_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correcao" ADD CONSTRAINT "correcao_lote_da_aplicacao_da_escola_fk" FOREIGN KEY ("escola_id","entrega_id","atividade_aplicada_id") REFERENCES "public"."entrega"("escola_id","id","atividade_aplicada_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "correcao" ADD CONSTRAINT "correcao_tentativa_fk" FOREIGN KEY ("escola_id","ano_letivo_id","atividade_aplicada_id","aluno_id") REFERENCES "public"."tentativa_atividade"("escola_id","ano_letivo_id","atividade_aplicada_id","aluno_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrega" ADD CONSTRAINT "entrega_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrega" ADD CONSTRAINT "entrega_turma_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","turma_id") REFERENCES "public"."turma"("escola_id","ano_letivo_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrega" ADD CONSTRAINT "entrega_artefato_da_escola_fk" FOREIGN KEY ("escola_id","artefato_id") REFERENCES "public"."artefato"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrega" ADD CONSTRAINT "entrega_atividade_aplicada_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","atividade_aplicada_id") REFERENCES "public"."atividade_aplicada"("escola_id","ano_letivo_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entrega" ADD CONSTRAINT "entrega_execucao_da_escola_fk" FOREIGN KEY ("escola_id","execucao_id") REFERENCES "public"."execucao_agente"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execucao_agente" ADD CONSTRAINT "execucao_agente_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execucao_agente" ADD CONSTRAINT "execucao_agente_ano_letivo_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id") REFERENCES "public"."ano_letivo"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execucao_agente" ADD CONSTRAINT "execucao_agente_solicitada_por_da_escola_fk" FOREIGN KEY ("escola_id","solicitada_por") REFERENCES "public"."usuario"("escola_id","id") ON DELETE SET NULL ("solicitada_por") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material" ADD CONSTRAINT "material_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material" ADD CONSTRAINT "material_disciplina_da_escola_fk" FOREIGN KEY ("escola_id","disciplina_id") REFERENCES "public"."disciplina"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material" ADD CONSTRAINT "material_enviado_por_da_escola_fk" FOREIGN KEY ("escola_id","enviado_por") REFERENCES "public"."usuario"("escola_id","id") ON DELETE SET NULL ("enviado_por") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material" ADD CONSTRAINT "material_excluido_por_da_escola_fk" FOREIGN KEY ("escola_id","excluido_por") REFERENCES "public"."usuario"("escola_id","id") ON DELETE SET NULL ("excluido_por") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem_agente" ADD CONSTRAINT "mensagem_agente_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem_agente" ADD CONSTRAINT "mensagem_agente_thread_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","thread_id") REFERENCES "public"."thread_agente"("escola_id","ano_letivo_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem_agente" ADD CONSTRAINT "mensagem_agente_execucao_da_escola_fk" FOREIGN KEY ("escola_id","execucao_id") REFERENCES "public"."execucao_agente"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem_agente" ADD CONSTRAINT "mensagem_agente_turma_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","turma_id") REFERENCES "public"."turma"("escola_id","ano_letivo_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem_agente" ADD CONSTRAINT "mensagem_agente_disciplina_da_escola_fk" FOREIGN KEY ("escola_id","disciplina_id") REFERENCES "public"."disciplina"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem_tutor" ADD CONSTRAINT "mensagem_tutor_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem_tutor" ADD CONSTRAINT "mensagem_tutor_turma_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","turma_id") REFERENCES "public"."turma"("escola_id","ano_letivo_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem_tutor" ADD CONSTRAINT "mensagem_tutor_aluno_da_escola_fk" FOREIGN KEY ("escola_id","aluno_id") REFERENCES "public"."usuario"("escola_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem_tutor" ADD CONSTRAINT "mensagem_tutor_execucao_da_escola_fk" FOREIGN KEY ("escola_id","execucao_id") REFERENCES "public"."execucao_agente"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem_tutor" ADD CONSTRAINT "mensagem_tutor_atividade_aplicada_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","atividade_aplicada_id") REFERENCES "public"."atividade_aplicada"("escola_id","ano_letivo_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem_tutor" ADD CONSTRAINT "mensagem_tutor_material_da_escola_fk" FOREIGN KEY ("escola_id","material_id") REFERENCES "public"."material"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resposta_atividade" ADD CONSTRAINT "resposta_atividade_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resposta_atividade" ADD CONSTRAINT "resposta_atividade_tentativa_fk" FOREIGN KEY ("escola_id","ano_letivo_id","atividade_aplicada_id","aluno_id") REFERENCES "public"."tentativa_atividade"("escola_id","ano_letivo_id","atividade_aplicada_id","aluno_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resumo_do_analista" ADD CONSTRAINT "resumo_do_analista_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resumo_do_analista" ADD CONSTRAINT "resumo_do_analista_ano_letivo_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id") REFERENCES "public"."ano_letivo"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resumo_do_analista" ADD CONSTRAINT "resumo_do_analista_execucao_da_escola_fk" FOREIGN KEY ("escola_id","execucao_id") REFERENCES "public"."execucao_agente"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sinal_tutor" ADD CONSTRAINT "sinal_tutor_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sinal_tutor" ADD CONSTRAINT "sinal_tutor_turma_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","turma_id") REFERENCES "public"."turma"("escola_id","ano_letivo_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sinal_tutor" ADD CONSTRAINT "sinal_tutor_aluno_da_escola_fk" FOREIGN KEY ("escola_id","aluno_id") REFERENCES "public"."usuario"("escola_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sinal_tutor" ADD CONSTRAINT "sinal_tutor_execucao_da_escola_fk" FOREIGN KEY ("escola_id","execucao_id") REFERENCES "public"."execucao_agente"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sinal_tutor" ADD CONSTRAINT "sinal_tutor_atividade_aplicada_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","atividade_aplicada_id") REFERENCES "public"."atividade_aplicada"("escola_id","ano_letivo_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sinal_tutor" ADD CONSTRAINT "sinal_tutor_material_da_escola_fk" FOREIGN KEY ("escola_id","material_id") REFERENCES "public"."material"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suspensao_de_funcao" ADD CONSTRAINT "suspensao_de_funcao_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentativa_atividade" ADD CONSTRAINT "tentativa_atividade_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentativa_atividade" ADD CONSTRAINT "tentativa_atividade_aplicacao_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","atividade_aplicada_id") REFERENCES "public"."atividade_aplicada"("escola_id","ano_letivo_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentativa_atividade" ADD CONSTRAINT "tentativa_atividade_aluno_da_escola_fk" FOREIGN KEY ("escola_id","aluno_id") REFERENCES "public"."usuario"("escola_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_agente" ADD CONSTRAINT "thread_agente_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_agente" ADD CONSTRAINT "thread_agente_ano_letivo_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id") REFERENCES "public"."ano_letivo"("escola_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_agente" ADD CONSTRAINT "thread_agente_usuario_da_escola_fk" FOREIGN KEY ("escola_id","usuario_id") REFERENCES "public"."usuario"("escola_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trecho" ADD CONSTRAINT "trecho_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trecho" ADD CONSTRAINT "trecho_material_da_disciplina_da_escola_fk" FOREIGN KEY ("escola_id","disciplina_id","material_id") REFERENCES "public"."material"("escola_id","disciplina_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validacao_do_lote" ADD CONSTRAINT "validacao_do_lote_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validacao_do_lote" ADD CONSTRAINT "validacao_do_lote_lote_da_aplicacao_da_escola_fk" FOREIGN KEY ("escola_id","entrega_id","atividade_aplicada_id") REFERENCES "public"."entrega"("escola_id","id","atividade_aplicada_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validacao_do_lote" ADD CONSTRAINT "validacao_do_lote_aplicacao_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","atividade_aplicada_id") REFERENCES "public"."atividade_aplicada"("escola_id","ano_letivo_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "artefato_um_por_execucao" ON "artefato" USING btree ("escola_id","execucao_id") WHERE "artefato"."execucao_id" is not null;--> statement-breakpoint
CREATE INDEX "artefato_turma_idx" ON "artefato" USING btree ("escola_id","turma_id","id");--> statement-breakpoint
CREATE INDEX "artefato_origem_idx" ON "artefato" USING btree ("escola_id","origem_id") WHERE "artefato"."origem_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "atividade_aplicada_aberta_unica" ON "atividade_aplicada" USING btree ("escola_id","turma_id","artefato_id") WHERE "atividade_aplicada"."estado" = 'aberta';--> statement-breakpoint
CREATE INDEX "atividade_aplicada_turma_idx" ON "atividade_aplicada" USING btree ("escola_id","turma_id","id");--> statement-breakpoint
CREATE INDEX "consumo_ia_funcao_idx" ON "consumo_ia" USING btree ("escola_id","funcao","em");--> statement-breakpoint
CREATE INDEX "consumo_ia_aluno_idx" ON "consumo_ia" USING btree ("escola_id","aluno_id","em") WHERE "consumo_ia"."aluno_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "correcao_uma_por_aluno_no_lote" ON "correcao" USING btree ("escola_id","entrega_id","aluno_id");--> statement-breakpoint
CREATE INDEX "correcao_aluno_idx" ON "correcao" USING btree ("escola_id","aluno_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "entrega_uma_por_versao_adaptada" ON "entrega" USING btree ("escola_id","artefato_id") WHERE "entrega"."artefato_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "entrega_um_lote_por_aplicacao" ON "entrega" USING btree ("escola_id","atividade_aplicada_id") WHERE "entrega"."atividade_aplicada_id" is not null and "entrega"."estado" <> 'rejeitada';--> statement-breakpoint
CREATE INDEX "entrega_turma_idx" ON "entrega" USING btree ("escola_id","turma_id","estado","id");--> statement-breakpoint
CREATE INDEX "entrega_ano_idx" ON "entrega" USING btree ("escola_id","ano_letivo_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "execucao_agente_chave_na_escola_unica" ON "execucao_agente" USING btree ("escola_id","chave_envio");--> statement-breakpoint
CREATE INDEX "execucao_agente_abertas_idx" ON "execucao_agente" USING btree ("escola_id","estado","criada_em") WHERE "execucao_agente"."estado" in ('pendente', 'rodando');--> statement-breakpoint
CREATE UNIQUE INDEX "material_arquivo_na_escola_unico" ON "material" USING btree ("escola_id","sha256") WHERE "material"."excluido_em" is null and "material"."estado" <> 'falhou';--> statement-breakpoint
CREATE INDEX "material_disciplina_idx" ON "material" USING btree ("escola_id","disciplina_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "mensagem_agente_uma_por_execucao" ON "mensagem_agente" USING btree ("escola_id","execucao_id","autor");--> statement-breakpoint
CREATE INDEX "mensagem_agente_thread_idx" ON "mensagem_agente" USING btree ("escola_id","thread_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "mensagem_tutor_uma_por_execucao" ON "mensagem_tutor" USING btree ("escola_id","execucao_id","autor");--> statement-breakpoint
CREATE INDEX "mensagem_tutor_aluno_idx" ON "mensagem_tutor" USING btree ("escola_id","aluno_id","id");--> statement-breakpoint
CREATE INDEX "mensagem_tutor_trocas_idx" ON "mensagem_tutor" USING btree ("escola_id","turma_id","criada_em","aluno_id") WHERE "mensagem_tutor"."autor" = 'aluno';--> statement-breakpoint
CREATE UNIQUE INDEX "resposta_atividade_uma_por_questao" ON "resposta_atividade" USING btree ("escola_id","ano_letivo_id","atividade_aplicada_id","aluno_id","questao");--> statement-breakpoint
CREATE UNIQUE INDEX "resumo_do_analista_um_por_execucao" ON "resumo_do_analista" USING btree ("escola_id","execucao_id") WHERE "resumo_do_analista"."execucao_id" is not null;--> statement-breakpoint
CREATE INDEX "resumo_do_analista_escola_idx" ON "resumo_do_analista" USING btree ("escola_id","ano_letivo_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "sinal_tutor_um_por_execucao" ON "sinal_tutor" USING btree ("escola_id","execucao_id","tipo") WHERE "sinal_tutor"."execucao_id" is not null;--> statement-breakpoint
CREATE INDEX "sinal_tutor_turma_idx" ON "sinal_tutor" USING btree ("escola_id","turma_id","id");--> statement-breakpoint
CREATE INDEX "sinal_tutor_aluno_idx" ON "sinal_tutor" USING btree ("escola_id","aluno_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "suspensao_de_funcao_uma_vigente" ON "suspensao_de_funcao" USING btree ("escola_id","funcao") WHERE "suspensao_de_funcao"."retomada_em" is null;--> statement-breakpoint
CREATE INDEX "suspensao_de_funcao_escola_idx" ON "suspensao_de_funcao" USING btree ("escola_id","suspensa_em");--> statement-breakpoint
CREATE UNIQUE INDEX "thread_agente_uma_por_pessoa" ON "thread_agente" USING btree ("escola_id","ano_letivo_id","usuario_id","agente");--> statement-breakpoint
CREATE UNIQUE INDEX "trecho_pagina_do_material_unica" ON "trecho" USING btree ("escola_id","material_id","pagina");--> statement-breakpoint
CREATE INDEX "trecho_busca_idx" ON "trecho" USING gin ("escola_id","disciplina_id","busca");--> statement-breakpoint
CREATE UNIQUE INDEX "validacao_do_lote_uma_por_lote" ON "validacao_do_lote" USING btree ("escola_id","entrega_id");--> statement-breakpoint
ALTER TABLE "configuracao_operacional_escola" ADD CONSTRAINT "configuracao_operacional_tutor_trocas_por_dia_positivo" CHECK ("configuracao_operacional_escola"."tutor_trocas_por_dia" > 0);--> statement-breakpoint
ALTER TABLE "configuracao_operacional_escola" ADD CONSTRAINT "configuracao_operacional_tutor_trocas_por_mes_positivo" CHECK ("configuracao_operacional_escola"."tutor_trocas_por_mes" > 0);--> statement-breakpoint
-- A autoria que fica depois da eliminação da pessoa. Não é FK, pelo motivo da auditoria (0013): a FK barraria a
-- eliminação, e o `set null` apagaria quem aprovou, que é o que a governança responde (regra 70, item 6) e o que o check
-- `entrega_decisao_registrada` exige. A função é a da 0013: confere, na gravação, que o autor existe e é usuário da
-- escola do registro, trava a linha dele até o commit e falha como a FK falharia (23503, com o nome abaixo).
CREATE CONSTRAINT TRIGGER "entrega_decidida_por_da_escola" AFTER INSERT OR UPDATE OF "escola_id", "decidida_por" ON "entrega"
  FOR EACH ROW EXECUTE FUNCTION "exigir_usuario_da_escola"('decidida_por', 'entrega_decidida_por_da_escola_fk');--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "atividade_aplicada_aplicada_por_da_escola" AFTER INSERT OR UPDATE OF "escola_id", "aplicada_por" ON "atividade_aplicada"
  FOR EACH ROW EXECUTE FUNCTION "exigir_usuario_da_escola"('aplicada_por', 'atividade_aplicada_aplicada_por_da_escola_fk');--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "validacao_do_lote_confirmada_por_da_escola" AFTER INSERT OR UPDATE OF "escola_id", "confirmada_por" ON "validacao_do_lote"
  FOR EACH ROW EXECUTE FUNCTION "exigir_usuario_da_escola"('confirmada_por', 'validacao_do_lote_confirmada_por_da_escola_fk');--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "correcao_destaque_aberto_por_da_escola" AFTER INSERT OR UPDATE OF "escola_id", "destaque_aberto_por" ON "correcao"
  FOR EACH ROW EXECUTE FUNCTION "exigir_usuario_da_escola"('destaque_aberto_por', 'correcao_destaque_aberto_por_da_escola_fk');--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "suspensao_de_funcao_suspensa_por_da_escola" AFTER INSERT OR UPDATE OF "escola_id", "suspensa_por" ON "suspensao_de_funcao"
  FOR EACH ROW EXECUTE FUNCTION "exigir_usuario_da_escola"('suspensa_por', 'suspensao_de_funcao_suspensa_por_da_escola_fk');--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "suspensao_de_funcao_retomada_por_da_escola" AFTER INSERT OR UPDATE OF "escola_id", "retomada_por" ON "suspensao_de_funcao"
  FOR EACH ROW EXECUTE FUNCTION "exigir_usuario_da_escola"('retomada_por', 'suspensao_de_funcao_retomada_por_da_escola_fk');--> statement-breakpoint
-- O que pode ir ao aluno (regra 70, item 3). Só atividade objetiva é aplicada, e a versão adaptada só com a entrega
-- dela aprovada: a pendente e a rejeitada não chegam à turma por caminho nenhum, nem por insert à mão. O artefato que não
-- existe fica para a FK. A entrega aprovada é travada (`for key share`) até o commit de quem aplica. O erro é de check
-- (23514), com o nome da regra, e não leva valor nenhum.
CREATE FUNCTION "exigir_artefato_que_pode_ir_ao_aluno"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  tipo_do_artefato text;
  origem uuid;
BEGIN
  SELECT a."tipo", a."origem_id" INTO tipo_do_artefato, origem FROM "artefato" a WHERE a."escola_id" = NEW."escola_id" AND a."id" = NEW."artefato_id";
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF tipo_do_artefato <> 'atividade_objetiva' THEN
    RAISE EXCEPTION 'só atividade objetiva é aplicada à turma' USING ERRCODE = 'check_violation', CONSTRAINT = 'atividade_aplicada_so_atividade_objetiva', TABLE = TG_TABLE_NAME;
  END IF;
  IF origem IS NOT NULL THEN
    PERFORM 1 FROM "entrega" e WHERE e."escola_id" = NEW."escola_id" AND e."artefato_id" = NEW."artefato_id" AND e."estado" = 'aprovada' FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'a versão adaptada só é aplicada com a entrega aprovada' USING ERRCODE = 'check_violation', CONSTRAINT = 'atividade_aplicada_versao_adaptada_aprovada', TABLE = TG_TABLE_NAME;
    END IF;
  END IF;
  RETURN NULL;
END
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "atividade_aplicada_so_do_que_pode_ir_ao_aluno" AFTER INSERT OR UPDATE OF "escola_id", "artefato_id" ON "atividade_aplicada"
  FOR EACH ROW EXECUTE FUNCTION "exigir_artefato_que_pode_ir_ao_aluno"();--> statement-breakpoint
-- O lote de correção só fica aprovado com o registro da validação (D56): o que foi apresentado, o que foi aberto e quem
-- confirmou. O gatilho é adiado para o commit, quando a `validacao_do_lote` gravada na mesma transação já existe, e relê
-- a entrega como ela ficou. Aprovar o lote sem validação falha no commit, com erro de check (23514). A versão adaptada
-- não passa por aqui: a aprovação dela é a decisão registrada na própria entrega.
CREATE FUNCTION "exigir_validacao_do_lote_aprovado"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM "entrega" e WHERE e."id" = NEW."id" AND e."tipo" = 'lote_de_correcao' AND e."estado" = 'aprovada';
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  PERFORM 1 FROM "validacao_do_lote" v WHERE v."escola_id" = NEW."escola_id" AND v."entrega_id" = NEW."id";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'lote de correção aprovado sem o registro da validação' USING ERRCODE = 'check_violation', CONSTRAINT = 'entrega_lote_aprovado_com_validacao', TABLE = TG_TABLE_NAME;
  END IF;
  RETURN NULL;
END
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "entrega_lote_aprovado_com_validacao" AFTER INSERT OR UPDATE OF "estado" ON "entrega"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW."tipo" = 'lote_de_correcao' AND NEW."estado" = 'aprovada')
  EXECUTE FUNCTION "exigir_validacao_do_lote_aprovado"();