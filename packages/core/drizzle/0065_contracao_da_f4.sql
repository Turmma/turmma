-- A contração da F4 (classificacao-bncc, tarefa 9.0; Tech Spec, seção 3, "Migrations", item 3; regra 80, item 9). O que a F4 deixou para depois: o material de terceiro passa a ter, no banco, a licença registrada, e a coluna
-- `material.licenciante` e os dois checks dela deixam de valer. Em quatro passos, nesta ordem:
--
-- 1. o backfill das séries, de novo (a mesma conta da `0055`): o que o código anterior à F4 gravou na janela, depois da `0055`, nasceu sem `material_serie`. O laço só pega o material que ainda não tem série, então repete sem duplicar;
-- 2. o backfill das licenças, de novo, para o material de terceiro que ainda não aponta licença (o que entrou depois da `0053`, com o `licenciante` só na linha): cria a licença do `(escola, licenciante)` que não tem nenhuma, e liga o material
--    à da escola dele, nunca à de outra (a junção é por `escola_id`). É a conta do bloco 2 do runbook, "Voltar o código depois da F4": com mais de uma licença do mesmo licenciante, vale a de começo mais recente. Não repete a `0053`, que
--    criaria uma segunda licença para quem a coordenação já registrou pela API. Repetível: só pega o material sem `licenca_id`;
-- 3. o check novo, `(titularidade = 'terceiro_com_licenca') = (licenca_id is not null)`: `ADD … NOT VALID` e `VALIDATE`, como a `0036` e a `0063`. O código anterior a esta migration (o da 5.0 à 8.0 da F4) grava a licença junto de todo material
--    de terceiro, e nenhum outro material a leva, então continua aceito;
-- 4. saem `material_licenciante_so_de_terceiro` e `material_licenciante_preenchido`. A coluna `licenciante` **fica** no banco, sem código que a leia ou grave, até o `DROP COLUMN` do deploy seguinte (`TODO.md`): só expande e só relaxa, e o
--    código anterior, que ainda a grava, segue aceito.
--
-- Em lotes de 5.000 e sob `lock_timeout` de 5 s, como a `0053` e a `0055`: o `migrar` aplica todas as migrations numa transação só, então os lotes limitam o tamanho de cada instrução e o que uma falha desfaz, e não o tempo em que as linhas ficam
-- travadas. O `ADD CONSTRAINT` e o `DROP` seguram `ACCESS EXCLUSIVE` em `material` até o commit, e o `VALIDATE` varre a tabela debaixo dela. É seguro hoje (`material` é do tamanho do que as escolas enviam em PDF, dezenas por escola, e o deploy roda
-- fora do horário letivo); com staging ou piloto, o `VALIDATE` vai para uma migration à parte, como a `0058` registra. Atenção: `SET LOCAL` vale até o fim da transação do `migrar`, inclusive para as migrations que vierem depois desta no mesmo deploy.
SET LOCAL lock_timeout = '5s';--> statement-breakpoint
DO $$
DECLARE
	linhas integer;
BEGIN
	LOOP
		INSERT INTO "material_serie" ("escola_id", "material_id", "serie_id")
		SELECT "lote"."escola_id", "lote"."id", "serie"."id"
		FROM (
			SELECT "material"."escola_id", "material"."id"
			FROM "material"
			WHERE NOT EXISTS (SELECT 1 FROM "material_serie" WHERE "material_serie"."escola_id" = "material"."escola_id" AND "material_serie"."material_id" = "material"."id")
				AND EXISTS (SELECT 1 FROM "serie" WHERE "serie"."escola_id" = "material"."escola_id")
			ORDER BY "material"."id"
			LIMIT 5000
		) AS "lote"
		JOIN "serie" ON "serie"."escola_id" = "lote"."escola_id";
		GET DIAGNOSTICS linhas = ROW_COUNT;
		EXIT WHEN linhas = 0;
	END LOOP;
END $$;--> statement-breakpoint
INSERT INTO "licenca_de_material" ("escola_id", "licenciante", "cobertura", "referencia", "vigente_desde", "vigente_ate")
SELECT
	"material"."escola_id",
	"material"."licenciante",
	'Materiais enviados antes da licença ser registrada',
	'registrada na contração da F4',
	(min("material"."enviado_em") AT TIME ZONE 'America/Sao_Paulo')::date,
	CASE WHEN bool_and("material"."excluido_em" IS NOT NULL) THEN (max("material"."excluido_em") AT TIME ZONE 'America/Sao_Paulo')::date END
FROM "material"
WHERE "material"."licenca_id" IS NULL AND "material"."licenciante" IS NOT NULL
	AND NOT EXISTS (SELECT 1 FROM "licenca_de_material" WHERE "licenca_de_material"."escola_id" = "material"."escola_id" AND "licenca_de_material"."licenciante" = "material"."licenciante")
GROUP BY "material"."escola_id", "material"."licenciante";--> statement-breakpoint
DO $$
DECLARE
	linhas integer;
BEGIN
	LOOP
		UPDATE "material" SET "licenca_id" = "escolhida"."id"
		FROM (
			SELECT DISTINCT ON ("licenca_de_material"."escola_id", "licenca_de_material"."licenciante") "licenca_de_material"."escola_id", "licenca_de_material"."licenciante", "licenca_de_material"."id"
			FROM "licenca_de_material"
			ORDER BY "licenca_de_material"."escola_id", "licenca_de_material"."licenciante", "licenca_de_material"."vigente_desde" DESC, "licenca_de_material"."id"
		) AS "escolhida"
		WHERE "material"."id" IN (SELECT "lote"."id" FROM "material" AS "lote" WHERE "lote"."licenca_id" IS NULL AND "lote"."licenciante" IS NOT NULL ORDER BY "lote"."id" LIMIT 5000)
			AND "escolhida"."escola_id" = "material"."escola_id"
			AND "escolhida"."licenciante" = "material"."licenciante";
		GET DIAGNOSTICS linhas = ROW_COUNT;
		EXIT WHEN linhas = 0;
	END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "material" ADD CONSTRAINT "material_terceiro_tem_licenca" CHECK (("material"."titularidade" = 'terceiro_com_licenca') = ("material"."licenca_id" is not null)) NOT VALID;--> statement-breakpoint
ALTER TABLE "material" VALIDATE CONSTRAINT "material_terceiro_tem_licenca";--> statement-breakpoint
ALTER TABLE "material" DROP CONSTRAINT "material_licenciante_so_de_terceiro";--> statement-breakpoint
ALTER TABLE "material" DROP CONSTRAINT "material_licenciante_preenchido";
