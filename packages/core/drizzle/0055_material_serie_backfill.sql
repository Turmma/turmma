-- O backfill das séries (ingestao-do-material, tarefa 7.0; Tech Spec, seção 3, "Migrations", passo 2; regra 80, item 9). Só migra o que já existe, e o código anterior continua gravando:
-- o material de antes da F4 não tem série, e o envio novo a exige. Cada material ganha **todas as séries da escola dele**, nunca as de outra (a junção é por `escola_id`): assim ele continua na
-- busca até a coordenação declarar as séries de verdade (o 6º ano vê o material do 9º até lá, o risco que a Tech Spec, seção 13, aceita e o resumo avisa). A escola sem série nenhuma deixa o
-- material sem linha, e ele aparece como "sem série" no resumo (RF18).
--
-- Em lotes de 5.000 materiais e sob `lock_timeout` de 5 s: o laço só pega o material que ainda não tem série (`NOT EXISTS`), então termina e pode rodar de novo sem duplicar. O `migrar` aplica as
-- migrations numa transação só, de modo que os lotes limitam o tamanho de cada instrução e o que uma falha desfaz, e não o tempo em que as linhas ficam travadas: o `INSERT` só escreve em
-- `material_serie`, nova, mas a conferência das FKs lê `material` e `serie` com trava de linha (`FOR KEY SHARE`), e a trava de tabela que a 0054 pediu já vale até o fim da transação. `material` é do tamanho do que as escolas enviam em PDF (dezenas por escola), e o deploy roda fora do horário letivo.
-- Atenção: `SET LOCAL` vale até o fim da transação do `migrar`, inclusive para as migrations que vierem depois desta no mesmo deploy.
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
END $$;
