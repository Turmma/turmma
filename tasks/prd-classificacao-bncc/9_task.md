# Tarefa 9.0 — A contração da F4: o check titularidade e licença vale, e os checks e o código de `material.licenciante` saem

**Funcionalidade:** classificacao-bncc · **Depende de:** 7.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

O que a F4 deixou para contrair: o backfill de séries e licenças roda de novo para o que entrou na janela, o banco passa a
exigir que todo material de terceiro tenha licença (e só ele), e o código deixa de ler e gravar `material.licenciante`,
que sai do schema Drizzle; a coluna fica no banco até o deploy seguinte (`DROP COLUMN` no `TODO.md`).

## Contexto necessário

- `techspec.md` §3 "Migrations", item (3); §11
- `abertura.md`, item 4; a Tech Spec da F4, §3 (`tasks/prd-ingestao-do-material/techspec.md`, a frase "A contração é da F4b")
- `cenarios.md` "Contração da F4 (migration 3)"
- `.claude/rules/`: 10, 20 (item 1: `licenciante` pode ser pessoa), 80 (item 9)
- Código: `packages/core/src/db/schema/material.ts` (os checks `material_licenciante_*`), `packages/core/drizzle/0053_licenca_de_material_backfill.sql`
  e `0055_material_serie_backfill.sql`, `apps/api/src/material/material.service.ts` e `material.repository.ts` (onde
  `licenciante` é lido e gravado), `packages/core/src/titular/leitura-do-titular.ts`

## Subtarefas

- [x] 9.1 — Migration: o backfill de séries e licenças de novo, idempotente, por escola
- [x] 9.2 — O check `(titularidade = 'terceiro_com_licenca') = (licenca_id is not null)` com `NOT VALID` e `VALIDATE`; saem `material_licenciante_so_de_terceiro` e `material_licenciante_preenchido`
- [x] 9.3 — O código: o licenciante que a API devolve vem da licença (`licenca_de_material`), nunca de `material.licenciante`; a coluna sai do schema Drizzle; worker, varredura, titular e fixtures acompanham
- [x] 9.4 — `DROP COLUMN material.licenciante` no `TODO.md`, para o deploy seguinte; `docs/modelo-de-dados.md`
- [x] 9.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0063_*.sql`, `packages/core/drizzle/meta/_journal.json`, `packages/core/src/db/schema/material.ts` | novo e alterado |
| `apps/api/src/material/material.service.ts`, `apps/api/src/material/material.repository.ts`, `apps/api/src/material/licenca.repository.ts` | alterado |
| `packages/core/src/titular/leitura-do-titular.ts`, `packages/core/src/material/varredura.repository.ts`, `apps/worker/src/processors/extrair-pdf.ts` | alterado |
| `apps/api/test/material.fixture.ts`, `apps/api/test/leitura-por-serie.fixture.ts`, `apps/api/test/licenca.int.test.ts`, `apps/api/test/material.int.test.ts` | alterado |
| `packages/core/src/db/contracao-da-f4.int.test.ts`, `docs/modelo-de-dados.md`, `TODO.md` | novo e alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| backfill duas vezes | I | o mesmo resultado | `contracao-da-f4.int.test.ts` › o backfill duas vezes dá o mesmo resultado |
| terceiro sem licença criado na janela | I | corrigido antes do `VALIDATE` | `contracao-da-f4.int.test.ts` › o terceiro sem licença criado na janela é corrigido antes do `VALIDATE` |
| backfill | I | não cruza escola: material da B só com licença da B | `contracao-da-f4.int.test.ts` › não cruza escola; › mais de um lote de 5.000; › as séries |
| check: terceiro sem licença | I | recusado. Mutação: um lado da igualdade | `contracao-da-f4.int.test.ts` › o check: terceiro sem licença é recusado; `mvp-tables.int.test.ts` › não existe material sem declaração… |
| check: próprio com licença | I | recusado. Mutação: o outro lado | o mesmo caso (a segunda asserção) |
| envio de terceiro | I | funciona sem os checks de `licenciante` | `contracao-da-f4.int.test.ts` › saem os dois checks…; `material.int.test.ts` › material de terceiro cita a licença registrada… |
| o código não lê a coluna | I | com a coluna renomeada no teste, o envio e a leitura passam | `material.int.test.ts` › o envio, a lista, a leitura por id e a edição passam |
| a resposta | I | o licenciante vem da licença, só à coordenação | o mesmo caso (o nome renomeado na licença; o professor recebe `null`); `material.int.test.ts` › o licenciante é da coordenação |
| a versão anterior do código | I | segue escrevendo com o schema novo (regra 80, item 9) | `contracao-da-f4.int.test.ts` › a versão anterior do código segue escrevendo…; `volta-da-f4.int.test.ts` (a volta para antes da F4, blocos 1 e 2) |

## Como testar

- Check e `VALIDATE`: `packages/core/src/db/migracao-fila-ferramenta.int.test.ts` › "só expande: a linha de antes segue lá e o que o código anterior gravava continua aceito" e "os dois checks terminam validados…"
- Backfill: `packages/core/src/db/migracao-f4.int.test.ts` › "mais de um lote de 5.000: as 5.100 linhas da escola C apontam a mesma licença, e nenhuma ficou sem"
- Versão anterior: `packages/core/src/db/volta-da-f4.int.test.ts` (o schema congelado em `packages/core/src/db/test/schema-antes-da-f4.ts`)
- Licença: `apps/api/test/licenca.int.test.ts`; `grep -rn "licenciante" apps packages e2e` antes e depois, cada ocorrência de `material.licenciante` trocada ou justificada no plano
- Comando: `npx vitest run --project integracao packages/core/src/db/contracao-da-f4.int.test.ts`
- Armadilha: a FK nova no catálogo do MVP (`mvp-tables.int.test.ts`) quebrou a esteira duas vezes na F4: rode-o

## Autoconferência

As 12 perguntas do modelo, no plano. Na 8: a busca pelo nome da coluna em `docs/` também (`lgpd.md`, `modelo-de-dados.md`).

## Fora do escopo desta tarefa

O `DROP COLUMN` (deploy seguinte, `TODO.md`); qualquer tela (a resposta da API não muda de forma).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| A migration é a `0065_contracao_da_f4`, e não `0063_*` | A 0063 (resultado da classificação, 4.0) e a 0064 (índice da medição, 5.0) já existem; a tabela de arquivos previstos foi escrita antes delas | `techspec.md` §3 ("Migrations", item 3) |
| A volta do código para **antes da F4** passa a exigir um passo: o bloco 1 do runbook solta o check `material_terceiro_tem_licenca` e copia o licenciante da licença para a linha, e o bloco 2 o põe de volta (`NOT VALID` e `VALIDATE`); o `volta-da-f4.int.test.ts` roda os dois blocos | O código anterior à F4 grava o material de terceiro com o `licenciante` na linha e sem `licenca_id`, e o check novo, que a spec manda criar, o recusaria: o runbook dizia que o código anterior "roda sobre isso sem erro", e o teste de volta falhava no bloco 2. Depois do `DROP COLUMN` a volta deixa de existir, e isso está no `TODO.md` | `techspec.md` §3 ("Migrations", item 3); `cenarios.md` ("Contração da F4"); `docs/runbook.md` ("Voltar o código depois da F4") |
| Os arquivos `leitura-do-titular.ts`, `varredura.repository.ts`, `extrair-pdf.ts` e `material.fixture.ts` não mudam; mudam `leitura-por-serie.fixture.ts`, `e2e/support/material.ts`, os testes que inseriam `licenciante` e `mvp-tables.int.test.ts` | O `licenciante` do `fora` de `material` no arquivo do titular precisa ficar enquanto a coluna existir no banco (a `architecture.test.ts` confere as colunas contra as migrations, e o `DROP COLUMN` o tira); a varredura, a extração e a fixture só citam a palavra em comentário ou na licença | `TODO.md` (o item "`DROP COLUMN material.licenciante`, no deploy seguinte ao da 0065", que lista o que sai junto) |
| A volta para o código da F4 **anterior à 9.0** também pede um passo: o bloco "volta ao código da F4" do runbook copia o licenciante da licença para a linha do material, e o caso de `contracao-da-f4.int.test.ts` o roda lido do documento | O código anterior à 9.0 lê `material.licenciante` da linha, e o da 9.0 deixou de gravá-lo: sem a cópia, o material de terceiro enviado ou editado desde o deploy aparece à coordenação sem o licenciante. Escolhida a opção (a) da ordem de correção, que não muda o que a Tech Spec manda (o código da 9.0 segue sem gravar a coluna) | `techspec.md` §3 ("Migrations", item 3); `docs/runbook.md` ("Voltar o código depois da F4") |
| O caso "o código não lê a coluna" renomeia `material.licenciante` no banco de teste, em `material.int.test.ts`, e a devolve no fim | Os arquivos de integração rodam um por vez (`fileParallelism: false`), e a única prova de que nenhuma consulta nomeia a coluna é ela sumir; a API não roda no teste de `packages/core` | `cenarios.md` ("Contração da F4") |

## Mutações

`--faltando: 0 linhas (14 blocos, 6 motivos)`. Os blocos da migration e do check rodam sobre o banco que o teste migra a partir da pasta do repositório; o vermelho de cada um vem de um caso de `contracao-da-f4.int.test.ts` (ou da API) que rodou e falhou, nunca de erro de carga (a mutação que derrubaria a migration inteira, nas FKs compostas e nos termos do laço, está nos motivos abaixo).

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material.int.test.ts › material de terceiro cita a licença registrada e a resposta traz o licenciante dela
-        return { ...novo, licenciante: vigente?.licenciante ?? null, serieIds: serieIds.toSorted() }
+        return { ...novo, licenciante: null, serieIds: serieIds.toSorted() }
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/material-edicao.int.test.ts › a edição herda disciplina, séries, titularidade e licença do alvo
-    return { ...nova, licenciante: vigente?.licenciante ?? null, serieIds: herdadas }
+    return { ...nova, licenciante: null, serieIds: herdadas }
```

```mutacao
arquivo: apps/api/src/material/material.repository.ts
teste: apps/api/test/material.int.test.ts › o envio, a lista, a leitura por id e a edição passam
-const doLicenciante = sql<string | null>`(select "licenca_de_material"."licenciante" from "licenca_de_material" where "licenca_de_material"."escola_id" = "material"."escola_id" and "licenca_de_material"."id" = "material"."licenca_id")`
+const doLicenciante = sql<string | null>`(select "licenca_de_material"."licenciante" from "licenca_de_material" where "licenca_de_material"."escola_id" = "material"."escola_id" limit 1)`
```

```mutacao
arquivo: packages/core/drizzle/0065_contracao_da_f4.sql
teste: packages/core/src/db/contracao-da-f4.int.test.ts › o check: terceiro sem licença é recusado
-ALTER TABLE "material" ADD CONSTRAINT "material_terceiro_tem_licenca" CHECK (("material"."titularidade" = 'terceiro_com_licenca') = ("material"."licenca_id" is not null)) NOT VALID;--> statement-breakpoint
+ALTER TABLE "material" ADD CONSTRAINT "material_terceiro_tem_licenca" CHECK (("material"."licenca_id" is null) or ("material"."titularidade" = 'terceiro_com_licenca')) NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0065_contracao_da_f4.sql
teste: packages/core/src/db/contracao-da-f4.int.test.ts › o check: terceiro sem licença é recusado
-ALTER TABLE "material" ADD CONSTRAINT "material_terceiro_tem_licenca" CHECK (("material"."titularidade" = 'terceiro_com_licenca') = ("material"."licenca_id" is not null)) NOT VALID;--> statement-breakpoint
+ALTER TABLE "material" ADD CONSTRAINT "material_terceiro_tem_licenca" CHECK (("material"."titularidade" <> 'terceiro_com_licenca') or ("material"."licenca_id" is not null)) NOT VALID;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0065_contracao_da_f4.sql
teste: packages/core/src/db/contracao-da-f4.int.test.ts › o check: terceiro sem licença é recusado
-ALTER TABLE "material" VALIDATE CONSTRAINT "material_terceiro_tem_licenca";--> statement-breakpoint
+SELECT 1;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0065_contracao_da_f4.sql
teste: packages/core/src/db/contracao-da-f4.int.test.ts › saem os dois checks de `licenciante`
-ALTER TABLE "material" DROP CONSTRAINT "material_licenciante_so_de_terceiro";--> statement-breakpoint
+SELECT 1;--> statement-breakpoint
```

```mutacao
arquivo: packages/core/drizzle/0065_contracao_da_f4.sql
teste: packages/core/src/db/contracao-da-f4.int.test.ts › saem os dois checks de `licenciante`
-ALTER TABLE "material" DROP CONSTRAINT "material_licenciante_preenchido";
+SELECT 1;
```

```mutacao
arquivo: packages/core/drizzle/0065_contracao_da_f4.sql
teste: packages/core/src/db/contracao-da-f4.int.test.ts › o terceiro sem licença criado na janela é corrigido antes do `VALIDATE`
-	AND NOT EXISTS (SELECT 1 FROM "licenca_de_material" WHERE "licenca_de_material"."escola_id" = "material"."escola_id" AND "licenca_de_material"."licenciante" = "material"."licenciante")
+	AND true
```

```mutacao
arquivo: packages/core/drizzle/0065_contracao_da_f4.sql
teste: packages/core/src/db/contracao-da-f4.int.test.ts › o terceiro sem licença criado na janela é corrigido antes do `VALIDATE`
-			ORDER BY "licenca_de_material"."escola_id", "licenca_de_material"."licenciante", "licenca_de_material"."vigente_desde" DESC, "licenca_de_material"."id"
+			ORDER BY "licenca_de_material"."escola_id", "licenca_de_material"."licenciante", "licenca_de_material"."vigente_desde" ASC, "licenca_de_material"."id"
```

```mutacao
arquivo: packages/core/drizzle/0065_contracao_da_f4.sql
teste: packages/core/src/db/contracao-da-f4.int.test.ts › o terceiro sem licença criado na janela é corrigido antes do `VALIDATE`
-	CASE WHEN bool_and("material"."excluido_em" IS NOT NULL) THEN (max("material"."excluido_em") AT TIME ZONE 'America/Sao_Paulo')::date END
+	(max("material"."excluido_em") AT TIME ZONE 'America/Sao_Paulo')::date
```

```mutacao
arquivo: packages/core/drizzle/0065_contracao_da_f4.sql
teste: packages/core/src/db/contracao-da-f4.int.test.ts › o terceiro sem licença criado na janela é corrigido antes do `VALIDATE`
-	(min("material"."enviado_em") AT TIME ZONE 'America/Sao_Paulo')::date,
+	(max("material"."enviado_em") AT TIME ZONE 'America/Sao_Paulo')::date,
```

```mutacao
arquivo: packages/core/src/db/schema/material.ts
teste: packages/core/src/db/contracao-da-f4.int.test.ts › o schema do Drizzle e a migration dizem o mesmo check
-    check('material_terceiro_tem_licenca', sql`(${tabela.titularidade} = 'terceiro_com_licenca') = (${tabela.licencaId} is not null)`),
+    check('material_terceiro_tem_licenca', sql`(${tabela.titularidade} = 'terceiro_com_licenca') or (${tabela.licencaId} is not null)`),
```

```mutacao
arquivo: docs/runbook.md
teste: packages/core/src/db/contracao-da-f4.int.test.ts › a volta ao código da F4
 -- volta-da-f4: volta ao código da F4 (anterior à 9.0), antes de subir
-update material m set licenciante = l.licenciante
+update material m set licenciante = null
```

Linhas novas sem bloco, com o motivo de cada uma:

- `0065_contracao_da_f4.sql`, o `"licenca_de_material"."escola_id" = "material"."escola_id"` do `UPDATE` (`escolhida` contra `material`) e o `"serie"."escola_id" = "lote"."escola_id"` do backfill das séries: tirá-los faz o `UPDATE` e o `INSERT` tentarem ligar o material à licença e à série de outra escola, e as FKs compostas (`material_licenca_da_escola_fk`, `material_serie_serie_da_escola_fk`) recusam a linha, de modo que a migration cai inteira (erro de carga, que a ferramenta recusa como vermelho) em vez de um caso falhar. O caso "não cruza escola" prova o resultado correto.
- `0065_contracao_da_f4.sql`, os termos `"lote"."licenca_id" IS NULL` e `NOT EXISTS (… "material_serie" …)` dos laços: sem eles o laço escolhe sempre as mesmas linhas e **nunca termina** (a migration trava até o `timeout`), e `"lote"."licenciante" IS NOT NULL` só impede que o material próprio ocupe o lote de 5.000 e deixe o de terceiro sem licença para depois, o que o dado do teste (5.100 de terceiro e nenhum próprio em massa) não distingue. O `LIMIT 5000` e o `EXIT WHEN linhas = 0` são o tamanho do lote e o fim do laço: o caso das 5.100 linhas da C cobre mais de um lote, e o laço que não sai trava a migration.
- `0065_contracao_da_f4.sql`, o `AND EXISTS (SELECT 1 FROM "serie" …)` do backfill das séries e o `"licenca_de_material"."id"` do fim do `ORDER BY` do `DISTINCT ON`: o primeiro só poupa ao laço o material de escola sem série (a junção seguinte já não devolve linha para ele, e o caso da escola D prova que fica sem série), e o segundo só desempata duas licenças de mesmo licenciante e mesmo começo, para o resultado ser o mesmo a cada corrida.
- `material.repository.ts`, o `"licenca_de_material"."escola_id" = "material"."escola_id"` da subconsulta `doLicenciante`: nenhum caso o distingue, porque a FK composta (`material_licenca_da_escola_fk`) já impede `licenca_id` de apontar para a licença de outra escola, e a linha de outra escola não pode existir para o caso a mostrar. É o escopo de tenant escrito no repository (regra 10, item 3), por defesa em profundidade, e o comentário da constante diz que não é sobra.
- `0065_contracao_da_f4.sql`, o `SET LOCAL lock_timeout = '5s'`: é a trava que desfaz a migration se uma linha ficar presa além de 5 s, como a `0053` e a `0055`; sem ela a migration espera sem limite. Não há caso de teste que segure uma linha por 5 s (a regra 80, item 9, o pede da revisão do `infra-guardian`).
- `material.service.ts` e `licenca.repository.ts`, só comentário (docblocks): sem condição.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian, 1ª | Um caso em que A e B já tenham, cada uma, a sua licença do mesmo licenciante antes da migration, para o vermelho vir com nome e não como erro de carga | `TODO.md`. O caso "não cruza escola" de `contracao-da-f4.int.test.ts` já prova o isolamento, e o revisor aprovou; o ganho é só o nome do vermelho, e mexe no estado de partida de todo o arquivo |
| infra-guardian, 1ª | Confirmar que o backfill de séries não dá todas as séries a um material que as perdeu por exclusão em cascata de série | Recusada, com motivo: é verificação e não ajuste; o revisor diz que a `0055` tem o mesmo comportamento, e a exclusão de série não é desta tarefa |
| infra-guardian, 1ª | Resetar o `lock_timeout` ao fim, quando o `VALIDATE` for para uma migration à parte | `TODO.md`, junto da futura migration à parte do `VALIDATE`; a condição ainda não existe |
| revisor-geral, 1ª | Trocar a subconsulta correlacionada `doLicenciante` por `left join` | Recusada, com motivo: o revisor mesmo diz que o custo não preocupa hoje, o índice `(escola_id, id)` a cobre (infra-guardian, 1ª) e a troca mexe em consulta que três revisores aprovaram, sem mudar comportamento |
| tenancy-guardian, 2ª | O bloco "volta ao código da F4" do runbook só é testado dentro da escola A; um caso com duas escolas daria nome ao vermelho se alguém tirasse `l.escola_id = m.escola_id` do runbook | `TODO.md`, junto do item da 1ª rodada. A FK composta já impede o cruzamento, e o revisor aprovou |
| privacy-guardian, 2ª | Citar na linha "Licença de material" do `docs/lgpd.md` o caminho em que o código volta, depois avança, e a cópia do licenciante fica na linha do material até o `DROP COLUMN` | `TODO.md`, no item do `DROP COLUMN material.licenciante`: na mesma tarefa em que a coluna sai, a frase do `lgpd.md` é reescrita |
| privacy-guardian, 2ª | Tirar do `docs/lgpd.md`, junto do `DROP COLUMN`, a frase "quem atende um pedido do titular a procura lá também" | `TODO.md`, no mesmo item do `DROP COLUMN` |
| infra-guardian, 2ª | Dizer no bloco "volta ao código da F4" do runbook que a API fica de pé enquanto ele roda | `TODO.md`, no item de redação do runbook (próxima tarefa que tocar `docs/runbook.md`) |
| revisor-geral, 2ª | Subtítulo ou lista curta no runbook que separe "voltando para antes da F4: blocos 1 e 2" de "voltando para a F4 anterior à 9.0: só o bloco novo", e dizer o que quer dizer "a menos do passo extra dos blocos" | `TODO.md`, no mesmo item do runbook; é redação do plantão, sem mudar comando nem comportamento |
| infra-guardian, 2ª | Asserção ou guarda que falhe com mensagem clara se `material.int.test.ts` rodar em paralelo (o `rename` pega `ACCESS EXCLUSIVE`) | `TODO.md`. Hoje `fileParallelism: false` vale e está citado no próprio caso; o guarda é do teste de configuração, fora desta tarefa |
| revisor-geral, 2ª; test-engineer, 2ª | O caso da volta de `contracao-da-f4.int.test.ts` roda sobre todas as escolas e insere na A depois dos casos que a contam: comentário sobre a ordem, ou escola própria | `TODO.md`. Os dois revisores dizem que hoje nenhum caso seguinte depende disso |
| test-engineer, 2ª; revisor-geral, 2ª | O filtro `m.licenciante is null` do bloco da volta não tem caso nem mutação que o distinga | `TODO.md`, e é pauta da retro da F4b: não é óbvio qual nome deveria ficar nesse cenário |
| infra-guardian, 2ª | `doLicenciante` só mudou o comentário; o índice `(escola_id, id)` continua cobrindo | Nada a fazer: é confirmação do revisor, sem ação |
| conformidade-reviewer, 2ª | Manter o prazo do `DROP COLUMN` (não passar do deploy seguinte ao da `0065`) | Já está no item do `TODO.md`; nada a acrescentar |


## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-18 13:21:03 | 2026-11-18 13:21:33 | `conformidade-reviewer` | 1 | APROVADO | acfcf8254874ffe45 |
| 2026-11-18 13:20:48 | 2026-11-18 13:21:39 | `tenancy-guardian` | 1 | APROVADO | a9a02e5aa16a57d49 |
| 2026-11-18 13:20:54 | 2026-11-18 13:22:17 | `infra-guardian` | 1 | APROVADO | a732547cf75c88137 |
| 2026-11-18 13:20:51 | 2026-11-18 13:22:32 | `privacy-guardian` | 1 | APROVADO | ab464778149d666f5 |
| 2026-11-18 13:21:00 | 2026-11-18 13:22:52 | `revisor-geral` | 1 | APROVADO | ae268a79aac2af99f |
| 2026-11-18 13:20:57 | 2026-11-18 13:23:35 | `test-engineer` | 1 | REPROVADO | a367d84a0a8a01b3a |
| 2026-11-18 13:49:05 | 2026-11-18 13:49:30 | `tenancy-guardian` | 2 | APROVADO | a0801753f344026ec |
| 2026-11-18 13:49:11 | 2026-11-18 13:49:46 | `privacy-guardian` | 2 | APROVADO | a8649e516b9706cee |
| 2026-11-18 13:49:17 | 2026-11-18 13:49:46 | `infra-guardian` | 2 | APROVADO | ab1a63af58db7002d |
| 2026-11-18 13:49:38 | 2026-11-18 13:49:55 | `conformidade-reviewer` | 2 | APROVADO | a890fbe3efcc338d2 |
| 2026-11-18 13:49:32 | 2026-11-18 13:50:12 | `revisor-geral` | 2 | APROVADO | aa2a8a0b44d248846 |
| 2026-11-18 13:49:26 | 2026-11-18 13:50:55 | `test-engineer` | 2 | APROVADO | ad2d8826ab9456fd0 |
