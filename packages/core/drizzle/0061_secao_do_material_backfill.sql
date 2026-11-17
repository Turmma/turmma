-- O backfill das seções (classificacao-bncc, tarefa 2.0; Tech Spec, seção 3, "Migrations", passo 2; regra 80, item 9). Só migra o que já existe, e o código anterior continua gravando: o material que já estava
-- `pronto` e não excluído ganha as seções que a extração nova lhe daria, **sem execução** (`execucao_id` nulo, `nao_agendada`: a rotina das 19h as agenda, 5.0). Uma seção por capítulo; o material sem capítulo
-- ganha um bloco por 10 páginas, o último com as que sobram, pela mesma conta de `planejarSecoes` (`packages/core/src/material/secoes.ts`, que o teste da migration confere). O `processando` fica fora (a
-- extração o ganha), o excluído também, e o `falhou` não tem páginas.
--
-- Em lotes de 1.000 materiais: o laço só pega o material `pronto` que ainda não tem seção (`NOT EXISTS`), então termina e pode rodar de novo sem duplicar; o material sem capítulo tem pelo menos uma página
-- (`material_pronto_tem_paginas`, `material_paginas_validas`) e todo material tem pelo menos uma seção, então o laço sempre avança. O `migrar` aplica as migrations numa transação só: os lotes limitam o
-- tamanho de cada instrução e o que uma falha desfaz, e não o tempo em que as linhas ficam travadas. O `INSERT` só escreve nas tabelas novas, e a conferência das FKs lê `material`, `capitulo_do_material` com
-- trava de linha (`FOR KEY SHARE`). `material` é do tamanho do que as escolas enviam em PDF (dezenas por escola), e o deploy roda fora do horário letivo. O tamanho do lote é a variável `lote`: o teste da
-- migration a troca por um número pequeno para provar o segundo lote.
-- Atenção: `SET LOCAL` vale até o fim da transação do `migrar`, inclusive para as migrations que vierem depois desta no mesmo deploy.
SET LOCAL lock_timeout = '5s';--> statement-breakpoint
DO $$
DECLARE
	lote integer := 1000;
	linhas integer;
BEGIN
	LOOP
		WITH "lote" AS (
			SELECT "material"."escola_id", "material"."id", "material"."paginas"
			FROM "material"
			WHERE "material"."estado" = 'pronto'
				AND "material"."excluido_em" IS NULL
				AND NOT EXISTS (SELECT 1 FROM "secao_do_material" WHERE "secao_do_material"."escola_id" = "material"."escola_id" AND "secao_do_material"."material_id" = "material"."id")
			ORDER BY "material"."id"
			LIMIT lote
		)
		INSERT INTO "secao_do_material" ("escola_id", "material_id", "capitulo_id", "ordem", "pagina_inicial", "pagina_final")
		SELECT "capitulo_do_material"."escola_id", "capitulo_do_material"."material_id", "capitulo_do_material"."id", "capitulo_do_material"."ordem", "capitulo_do_material"."pagina_inicial", "capitulo_do_material"."pagina_final"
		FROM "lote"
		JOIN "capitulo_do_material" ON "capitulo_do_material"."escola_id" = "lote"."escola_id" AND "capitulo_do_material"."material_id" = "lote"."id"
		UNION ALL
		SELECT "lote"."escola_id", "lote"."id", NULL::uuid, "bloco"."n"::smallint, ("bloco"."n" - 1) * 10 + 1, least("bloco"."n" * 10, "lote"."paginas")
		FROM "lote"
		CROSS JOIN LATERAL generate_series(1, ("lote"."paginas" + 9) / 10) AS "bloco"("n")
		WHERE NOT EXISTS (SELECT 1 FROM "capitulo_do_material" WHERE "capitulo_do_material"."escola_id" = "lote"."escola_id" AND "capitulo_do_material"."material_id" = "lote"."id");
		GET DIAGNOSTICS linhas = ROW_COUNT;
		EXIT WHEN linhas = 0;
	END LOOP;
END $$;
