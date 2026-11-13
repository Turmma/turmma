-- O backfill da licença (ingestao-do-material, tarefa 5.0; Tech Spec, seção 3, "Migrations", passo 2; regra 80, item 9). Só migra o que já existe, e o código anterior continua gravando:
-- o material de terceiro de antes da F4 tem o `licenciante` na linha e nenhuma licença; aqui ele ganha uma, e `material.licenca_id` aponta para ela. O `licenciante` do material **fica**
-- (o código novo grava `licenca_id` e `licenciante`; a contração é da F4b).
--
-- Uma licença por `(escola_id, licenciante)`, nunca entre escolas: o mesmo licenciante em duas escolas são duas licenças. `vigente_desde` é o `enviado_em` mais antigo, no dia de São Paulo;
-- `vigente_ate` fica nulo (a licença não tem fim, e quem a encerra é a coordenação) **ou**, quando todo material dela está excluído, é o dia da última exclusão. `cobertura` e `referencia` dizem
-- de onde a linha veio. `registrada_por` fica nulo: ninguém a registrou.
--
-- Em lotes de 5.000 e sob `lock_timeout` de 5 s: o `UPDATE` de `material` trava só as linhas do lote, e quem as segura além de 5 s derruba a migration, que o `migrar` tenta de novo (três
-- vezes). O `migrar` aplica as migrations numa transação só, então os lotes não soltam trava entre si: a divisão limita o tamanho de cada instrução e o que uma falha desfaz, não o tempo
-- em que as linhas ficam travadas. `material` é do tamanho do que as escolas enviam em PDF (dezenas por escola), e o deploy roda fora do horário letivo.
SET LOCAL lock_timeout = '5s';--> statement-breakpoint
INSERT INTO "licenca_de_material" ("escola_id", "licenciante", "cobertura", "referencia", "vigente_desde", "vigente_ate")
SELECT
	"material"."escola_id",
	"material"."licenciante",
	'Materiais enviados antes da licença ser registrada',
	'registrada antes da F4',
	(min("material"."enviado_em") AT TIME ZONE 'America/Sao_Paulo')::date,
	CASE WHEN bool_and("material"."excluido_em" IS NOT NULL) THEN (max("material"."excluido_em") AT TIME ZONE 'America/Sao_Paulo')::date END
FROM "material"
WHERE "material"."licenciante" IS NOT NULL AND "material"."licenca_id" IS NULL
GROUP BY "material"."escola_id", "material"."licenciante";--> statement-breakpoint
DO $$
DECLARE
	linhas integer;
BEGIN
	LOOP
		UPDATE "material" SET "licenca_id" = "licenca_de_material"."id"
		FROM "licenca_de_material"
		WHERE "material"."id" IN (SELECT "lote"."id" FROM "material" AS "lote" WHERE "lote"."licenca_id" IS NULL AND "lote"."licenciante" IS NOT NULL ORDER BY "lote"."id" LIMIT 5000)
			AND "licenca_de_material"."escola_id" = "material"."escola_id"
			AND "licenca_de_material"."licenciante" = "material"."licenciante"
			AND "licenca_de_material"."referencia" = 'registrada antes da F4';
		GET DIAGNOSTICS linhas = ROW_COUNT;
		EXIT WHEN linhas = 0;
	END LOOP;
END $$;
