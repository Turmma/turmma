# Tarefa 1.0 — O registro da aula existe, só a professora o alcança, e sai na virada do ano

**Funcionalidade:** semana-do-professor · **Depende de:** nenhuma
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `test-engineer`
**Porte:** grande

## Objetivo

A tabela `aula` existe, presa à escola, ao ano e ao vínculo; só a professora tem célula na matriz; o arquivo do titular a
leva só na versão `completa`; o encerramento do ano a apaga.

## Contexto necessário

- `techspec.md` seções 3, 6, 7 e 11; `cenarios.md` R5, R6, S7
- `prd.md` RF11 e seção 8
- `.claude/rules/20`, itens 10, 15 e 19
- `packages/core/src/db/schema/alocacao.ts`: a FK composta a copiar
- `packages/core/src/estrutura/vinculo.repository.ts:345` (`virarAno`): onde o complemento da contestação já é limpo
- `packages/core/src/titular/leitura-do-titular.ts` (`naVersao`, critério 5) e `troca-de-nome.ts:45`

## Subtarefas

- [x] 1.1 — `aula.ts` (seção 3) e a migration só de criação, pelo `drizzle-kit`; registro em `database.ts`
- [x] 1.2 — `matriz.ts`: `aula: ['ler', 'gravar']`, professor `proprio`, os outros `nunca`
- [x] 1.3 — `classificacao.ts`: chave nova de prazo fixo (a virada), ligação `vinculo_id`, fora da prévia
- [x] 1.4 — `leitura-do-titular.ts`: só na `completa`, com a linha no comentário do critério 5; `troca-de-nome.ts`: o porquê de ficar fora
- [x] 1.5 — `virarAno` apaga as linhas de `aula` do ano, na mesma transação
- [x] 1.6 — `docs/lgpd.md` (a linha "Registro da aula") e `docs/modelo-de-dados.md` (a `Aula` da seção 3)
- [x] 1.7 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/db/schema/aula.ts`, `packages/core/src/db/schema/aula.int.test.ts` | novo |
| `packages/core/drizzle/0041_registro_da_aula.sql`, `packages/core/drizzle/meta/_journal.json`, `packages/core/drizzle/meta/0041_snapshot.json` | novo e alterado |
| `packages/core/src/db/database.ts`, `packages/core/src/index.ts`, `tools/guardas/tabelas-do-nucleo.mjs` | alterado |
| `packages/shared/src/permissao/matriz.ts`, `packages/shared/src/permissao/matriz.expectativa.ts`, `packages/shared/src/permissao/matriz.test.ts` | alterado |
| `packages/shared/src/privacidade/classificacao.ts`, `packages/shared/src/privacidade/retencao.ts`, `packages/shared/src/privacidade/retencao.test.ts` | alterado |
| `packages/core/src/titular/leitura-do-titular.ts`, `packages/core/src/titular/leitura-do-titular.test.ts`, `packages/core/src/titular/troca-de-nome.ts` | alterado |
| `packages/core/src/estrutura/vinculo.repository.ts`, `packages/core/src/db/schema/alocacao.ts` (só o docblock) | alterado |
| `apps/api/test/virada-do-ano.int.test.ts`, `apps/api/test/arquivo-do-titular.int.test.ts`, `apps/worker/test/eliminar-titular.int.test.ts`, `packages/core/src/db/migracao-f2.int.test.ts` | alterado |
| `docs/lgpd.md`, `docs/modelo-de-dados.md`, `docs/glossario.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| `inicio = fim` e `inicio > fim` recusados (23514) | integração | check | `packages/core/src/db/schema/aula.int.test.ts` › o fim igual ao início e o fim antes do início |
| conteúdo só de espaços recusado | integração | check do `btrim` | `packages/core/src/db/schema/aula.int.test.ts` › o conteúdo vazio e o só de espaços |
| 501 depois do `btrim` recusado, 500 entra | integração | check do tamanho | `packages/core/src/db/schema/aula.int.test.ts` › o tamanho vale depois do |
| `escolaId` que não existe recusado (23503) | integração | FK da escola | `packages/core/src/db/schema/aula.int.test.ts` › a escola que não existe é recusada |
| `vinculoId` de B com `escolaId` de A recusado (23503) | integração | FK, escola | `packages/core/src/db/schema/aula.int.test.ts` › o vínculo de outra escola e o de outro ano (1ª asserção) |
| `vinculoId` de A com outro ano de A recusado (23503) | integração | FK, ano | `packages/core/src/db/schema/aula.int.test.ts` › o vínculo de outra escola e o de outro ano (2ª e 3ª asserções) |
| mesmo (vínculo, data, início) recusado (23505) | integração | único | `packages/core/src/db/schema/aula.int.test.ts` › a mesma aula (vínculo, data e início) é recusada |
| apagar o vínculo apaga só a `aula` dele | integração | cascata | `packages/core/src/db/schema/aula.int.test.ts` › a aula sai com o vínculo, em cascata |
| a leitura pelo escopo usa o índice da semana | integração | índice | `packages/core/src/db/schema/aula.int.test.ts` › a leitura da semana pelo escopo |
| S7: o `virarAno` apaga as do ano, inclusive a do vínculo encerrado antes | integração | retenção | `apps/api/test/virada-do-ano.int.test.ts` › S7: a virada apaga as aulas do ano |
| S7: a `aula` da B continua | integração | isolamento | `apps/api/test/virada-do-ano.int.test.ts` › S7 (a de B) e › o escopo de escola vale sozinho nas aulas (o ano de B no contexto de A) |
| a `aula` de A no ano `planejado` sobrevive ao encerramento | integração | cláusula do ano | `apps/api/test/virada-do-ano.int.test.ts` › S7: a virada apaga as aulas do ano |
| R5: a `coordenacao` não traz a tabela nem a sentinela; a `completa` traz | integração | regra 70, item 8 | `apps/api/test/arquivo-do-titular.int.test.ts` › sem conta ativa, a versão da escola traz o Tutor, e › o professor: cada tabela que ele tem aparece |
| R5: a aula plantada num vínculo de aluno não vai ao arquivo do aluno | integração | ligação pelo vínculo de professor | `apps/api/test/arquivo-do-titular.int.test.ts` › R5: a aula plantada num vínculo de aluno |
| R5: a prévia não ganha categoria nem contagem | integração | D64 | `apps/api/test/arquivo-do-titular.int.test.ts` › R5: o registro da aula não ganha categoria nem contagem |
| R6: `naVersao`, `completa` sim, `coordenacao` não | unidade | critério 5 | `packages/core/src/titular/leitura-do-titular.test.ts` › só entra na versão completa |
| R6: `nunca` para coordenação, rede e aluno | unidade | matriz | `packages/shared/src/permissao/matriz.test.ts` › F2b, 1.0 |
| professor `proprio`, não `escola` | unidade | matriz | `packages/shared/src/permissao/matriz.test.ts` › F2b, 1.0 |
| sem a `aula` em `classificacao.ts`, a guarda de `leitura-do-titular.test.ts` fica vermelha | unidade | classificação | `packages/core/src/titular/leitura-do-titular.test.ts` › só entra na versão completa (a classificação) |
| o prazo fixo da `aula` existe, acaba no encerramento do ano, e toda tabela de prazo fixo está no catálogo | unidade | prazo | `packages/shared/src/privacidade/retencao.test.ts` › F2b: o registro da aula tem prazo fixo |
| troca de nome com o nome do aluno no texto: o texto fica intacto | integração | exclusão declarada | `apps/worker/test/eliminar-titular.int.test.ts` › F2b: o registro da aula da professora |

A cláusula de escola sozinha no `virarAno` é observável, ao contrário do que a Tech Spec supunha: o caso de isolamento forja o contexto da A com o ano da B, e a tirada o deixa vermelho (bloco em "Mutações").

## Como testar

- Checks, FK e cascata: `packages/core/src/db/schema/f2-planilhas.int.test.ts › o vínculo de outra escola e o de outro ano são recusados pela FK composta com o ano do vínculo` e os irmãos (linhas 125 a 159)
- Virada: `apps/api/test/virada-do-ano.int.test.ts › caminho feliz: …` e o `describe` de isolamento (linha 658)
- Arquivo: `apps/api/test/arquivo-do-titular.int.test.ts:710`, com a sentinela no `conteudo`
- Troca de nome: `apps/worker/test/eliminar-titular.int.test.ts` (linhas 256 a 276)
- Comando: `npx vitest run --project integracao packages/core/src/db/schema/aula.int.test.ts`
- Armadilha da F2 (retro, grupo E): no isolamento, todo id é da B, lido no contexto da A

## Autoconferência

As 12 perguntas do modelo, respondidas no plano (`achados/` ainda não existe para esta funcionalidade: é a 1.0).

1. **Mutação de cada cláusula:** seção "Mutações". Cobre o `delete` do `virarAno` (tirado, sem o ano, sem a escola), cada restrição e
   índice da migration (horário, os três limites do texto, único, FK da escola, FK composta, cascata, índice), as quatro células da
   matriz, a classificação (ligação, classe e prazo), a chave e o texto do prazo fixo, o `naVersao`, a ligação do `select` do arquivo
   (usuário e papel) e a lista de tabelas do núcleo. O `aula.ts` repete a migration (`drizzle-kit`) e o teste só lê a migration:
   nenhuma cláusula do `aula.ts` é mutável sozinha, e a `--faltando` não a lista.
2. **Texto na tela:** a tarefa não tem tela.
3. **Segundo dado:** no `virarAno`, o ano planejado da mesma escola (prova a cláusula do ano) e a escola B, alcançada com o contexto de A
   e o ano de B (prova a da escola, como o isolamento dos vínculos); no arquivo, o colega da mesma escola, outro vínculo de aluno com
   a aula plantada e o professor sem o texto; no único, outro início, outra data e outro vínculo.
4. **Checagem anterior:** nos testes do banco o insert vai direto, sem service que responda antes; na virada o `encerrar` roda o
   `virarAno` de verdade (a aula só sai se a linha chegou nele); no arquivo, a sentinela é lida do JSON que o job gravou.
5. **Resultado, não forma:** nenhuma asserção lê texto de arquivo; a do `select` da leitura (unidade) só confere que o texto é lido, e
   o escopo e a ligação são provados pelo resultado do arquivo na integração.
6. **Guarda nova:** não há guarda nova. O `tabelas-do-nucleo.mjs` ganhou a `aula`, e o teste dele confere a lista nos dois sentidos.
7. **Comentários:** o docblock de `aula.ts` diz "pode trazer nome de aluno" e "nunca vai a log, a auditoria, à coordenação nem a IA", e
   a gravação ainda não existe (2.0): a frase é a regra do módulo, e as rotas que a cumprem têm o teste na 2.0 (G5, R7). O comentário
   do `virarAno` diz que a contagem não entra na auditoria, e o retorno não ganhou campo.
8. **Divergência que muda regra:** nenhuma muda regra. Duas linhas da tabela abaixo (glossário e teste da migration do F2) só
   acompanham o que a tarefa muda.
9. **Peça que já existe:** a FK composta, o único e o check de horário seguem a `alocacao`; `virarAno` já era o ponto de limpeza da
   contestação; `naVersao` e a lista de leituras do titular já existiam; a matriz, a classificação e os prazos fixos também.
10. **Concorrência:** a tarefa não grava (a gravação e a trava são da 2.0). A virada × gravação é o J14, na 2.0.
11. **Isolamento sem a cláusula:** todo id do caso de isolamento é da B, lido no contexto da A (`o escopo de escola vale sozinho nas
    aulas`); a coluna "Caso" da tabela está preenchida, e cada linha com duas coisas (FK de escola e de ano; coordenação e arquivo)
    cita as asserções.
12. **Guardiões:** `tenancy-guardian` (escola e ano na tabela, FK composta, delete com escola e ano, teste de isolamento),
    `privacy-guardian` (texto que pode citar aluno: lgpd.md, versão `completa` só, fora da troca de nome e da prévia, sem log),
    `conformidade-reviewer` (regra 70, item 8: a coordenação não alcança o texto, nem pelo arquivo; D64: sem contagem). O
    `achados/indice.md` ainda não existe.

## Fora do escopo desta tarefa

As rotas (2.0, 4.0), o passo da grade (5.0), as telas.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O `docs/glossario.md` também muda: a "Aula" deixa de ser "a instância concreta de uma alocação numa data" e passa a ser o registro de texto, sem apontar para a alocação | o glossário dizia o contrário do `docs/modelo-de-dados.md` que a Tech Spec manda mudar (vocabulário, regra 60, item 1) | `techspec.md` §2, última linha da tabela (`docs/glossario.md`), e §11, linha do `docs/modelo-de-dados.md` |
| `packages/core/src/db/migracao-f2.int.test.ts` passa a migrar até a 0040, e não até a última | o teste mede o que a 0040 mudou sobre dado da A1 e comparava as colunas com a pasta inteira: a 0041 o deixou vermelho (lista fechada, `executar-task`, passo 4) | `techspec.md` §7c, "Índices e migration" (a 0041 é migration só de criação, em tabela nova) |

## Mutações

**Sem bloco, com o motivo.** A cláusula `t.escola_id` e a `v.escola_id` do `select` da `aula` no arquivo do titular: o id do vínculo é
único entre escolas e o do usuário também, então tirá-las não muda nenhuma linha (o mesmo vale para a `alocacao`, ao lado). O
`aula.ts` repete a migration e nenhum teste o lê (o `drizzle-kit` gera uma da outra); o comentário de `troca-de-nome.ts` não tem
cláusula, e a lista `COLUNAS_DA_TROCA_DE_NOME` não ganhou a `aula` (o caso do worker prova que o texto fica). O retorno de
`virarAno` não ganhou campo (a contagem das aulas não entra na auditoria, Tech Spec, seção 11). A cláusula de escola do `virarAno`
**tem** bloco, ao contrário do que a nota da tabela de testes supõe: o teste de isolamento forja o contexto da A com o ano da B, como o
dos vínculos, e a tirada deixa o caso vermelho.

--faltando: 0 linhas (28 blocos, 0 motivos)

O `delete` do `virarAno`: sem o ano, uma escola inteira perde a aula do ano planejado.

```mutacao
arquivo: packages/core/src/estrutura/vinculo.repository.ts
teste: apps/api/test/virada-do-ano.int.test.ts › S7: a virada apaga as aulas do ano
-    await this.banco.delete(aula).where(and(eq(aula.escolaId, requireEscolaId()), eq(aula.anoLetivoId, anoLetivoId)))
+    await this.banco.delete(aula).where(eq(aula.escolaId, requireEscolaId()))
```

Sem a escola do contexto: o ano de B, no contexto de A, apagaria a aula de B.

```mutacao
arquivo: packages/core/src/estrutura/vinculo.repository.ts
teste: apps/api/test/virada-do-ano.int.test.ts › o escopo de escola vale sozinho nas aulas
-    await this.banco.delete(aula).where(and(eq(aula.escolaId, requireEscolaId()), eq(aula.anoLetivoId, anoLetivoId)))
+    await this.banco.delete(aula).where(eq(aula.anoLetivoId, anoLetivoId))
```

Sem o `delete`: a aula passa da virada.

```mutacao
arquivo: packages/core/src/estrutura/vinculo.repository.ts
teste: apps/api/test/virada-do-ano.int.test.ts › S7: a virada apaga as aulas do ano
-    await this.banco.delete(aula).where(and(eq(aula.escolaId, requireEscolaId()), eq(aula.anoLetivoId, anoLetivoId)))
```

Horário: o check sai.

```mutacao
arquivo: packages/core/drizzle/0041_registro_da_aula.sql
teste: packages/core/src/db/schema/aula.int.test.ts › o fim igual ao início
   CONSTRAINT "aula_vinculo_data_inicio_unico" UNIQUE("vinculo_id","data","inicio"),
-  CONSTRAINT "aula_horario_valido" CHECK ("aula"."inicio" < "aula"."fim"),
   CONSTRAINT "aula_conteudo_preenchido" CHECK (char_length(btrim("aula"."conteudo")) between 1 and 500)
```

Texto: o piso do tamanho sobe a zero (o texto só de espaços entraria).

```mutacao
arquivo: packages/core/drizzle/0041_registro_da_aula.sql
teste: packages/core/src/db/schema/aula.int.test.ts › o conteúdo vazio e o só de espaços
-  CONSTRAINT "aula_conteudo_preenchido" CHECK (char_length(btrim("aula"."conteudo")) between 1 and 500)
+  CONSTRAINT "aula_conteudo_preenchido" CHECK (char_length(btrim("aula"."conteudo")) between 0 and 500)
```

Texto: o teto sobe para 501.

```mutacao
arquivo: packages/core/drizzle/0041_registro_da_aula.sql
teste: packages/core/src/db/schema/aula.int.test.ts › o tamanho vale depois do
-  CONSTRAINT "aula_conteudo_preenchido" CHECK (char_length(btrim("aula"."conteudo")) between 1 and 500)
+  CONSTRAINT "aula_conteudo_preenchido" CHECK (char_length(btrim("aula"."conteudo")) between 1 and 501)
```

Texto: o `btrim` sai (o tamanho passa a contar os espaços das pontas, e o só de espaços entra).

```mutacao
arquivo: packages/core/drizzle/0041_registro_da_aula.sql
teste: packages/core/src/db/schema/aula.int.test.ts › o conteúdo vazio e o só de espaços
-  CONSTRAINT "aula_conteudo_preenchido" CHECK (char_length(btrim("aula"."conteudo")) between 1 and 500)
+  CONSTRAINT "aula_conteudo_preenchido" CHECK (char_length("aula"."conteudo") between 1 and 500)
```

Texto: o `btrim` sai (500 úteis com espaços em volta deixam de caber).

```mutacao
arquivo: packages/core/drizzle/0041_registro_da_aula.sql
teste: packages/core/src/db/schema/aula.int.test.ts › o tamanho vale depois do
-  CONSTRAINT "aula_conteudo_preenchido" CHECK (char_length(btrim("aula"."conteudo")) between 1 and 500)
+  CONSTRAINT "aula_conteudo_preenchido" CHECK (char_length("aula"."conteudo") between 1 and 500)
```

Único: a restrição sai.

```mutacao
arquivo: packages/core/drizzle/0041_registro_da_aula.sql
teste: packages/core/src/db/schema/aula.int.test.ts › a mesma aula
   "atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
-  CONSTRAINT "aula_vinculo_data_inicio_unico" UNIQUE("vinculo_id","data","inicio"),
   CONSTRAINT "aula_horario_valido" CHECK ("aula"."inicio" < "aula"."fim"),
```

Único: o início sai da chave (outro início no mesmo dia passa a colidir).

```mutacao
arquivo: packages/core/drizzle/0041_registro_da_aula.sql
teste: packages/core/src/db/schema/aula.int.test.ts › a mesma aula
-  CONSTRAINT "aula_vinculo_data_inicio_unico" UNIQUE("vinculo_id","data","inicio"),
+  CONSTRAINT "aula_vinculo_data_inicio_unico" UNIQUE("vinculo_id","data"),
```

FK da escola: sai.

```mutacao
arquivo: packages/core/drizzle/0041_registro_da_aula.sql
teste: packages/core/src/db/schema/aula.int.test.ts › a escola que não existe é recusada
-ALTER TABLE "aula" ADD CONSTRAINT "aula_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
```

FK composta: só o vínculo (a escola e o ano deixam de ser conferidos).

```mutacao
arquivo: packages/core/drizzle/0041_registro_da_aula.sql
teste: packages/core/src/db/schema/aula.int.test.ts › o vínculo de outra escola e o de outro ano
-ALTER TABLE "aula" ADD CONSTRAINT "aula_vinculo_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","vinculo_id") REFERENCES "public"."vinculo"("escola_id","ano_letivo_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
+ALTER TABLE "aula" ADD CONSTRAINT "aula_vinculo_do_ano_da_escola_fk" FOREIGN KEY ("vinculo_id") REFERENCES "public"."vinculo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
```

FK composta: a cascata vira `no action`.

```mutacao
arquivo: packages/core/drizzle/0041_registro_da_aula.sql
teste: packages/core/src/db/schema/aula.int.test.ts › a aula sai com o vínculo, em cascata
-ALTER TABLE "aula" ADD CONSTRAINT "aula_vinculo_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","vinculo_id") REFERENCES "public"."vinculo"("escola_id","ano_letivo_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
+ALTER TABLE "aula" ADD CONSTRAINT "aula_vinculo_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","vinculo_id") REFERENCES "public"."vinculo"("escola_id","ano_letivo_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
```

Índice da semana: sai.

```mutacao
arquivo: packages/core/drizzle/0041_registro_da_aula.sql
teste: packages/core/src/db/schema/aula.int.test.ts › a leitura da semana pelo escopo
-CREATE INDEX "aula_semana_idx" ON "aula" USING btree ("escola_id","ano_letivo_id","vinculo_id","data");
```

Matriz: professor deixa de ser `proprio` (passaria a ver a escola).

```mutacao
arquivo: packages/shared/src/permissao/matriz.ts
teste: packages/shared/src/permissao/matriz.test.ts › F2b, 1.0
  grade: { ler: 'turma_vinculada' },
-  aula: { ler: 'proprio', gravar: 'proprio' },
+  aula: { ler: 'unidade', gravar: 'unidade' },
```

Matriz: a coordenação passa a ler a unidade.

```mutacao
arquivo: packages/shared/src/permissao/matriz.ts
teste: packages/shared/src/permissao/matriz.test.ts › F2b, 1.0
  grade: { ler: 'unidade' },
-  aula: { ler: 'nunca', gravar: 'nunca' },
+  aula: { ler: 'unidade', gravar: 'unidade' },
```

Matriz: a rede passa a alcançar o texto.

```mutacao
arquivo: packages/shared/src/permissao/matriz.ts
teste: packages/shared/src/permissao/matriz.test.ts › F2b, 1.0
-  aula: { ler: 'nunca', gravar: 'nunca' },
+  aula: { ler: 'agregado', gravar: 'agregado' },
  time: { ler: 'nunca' },
  assistente: { ler_conversa: 'nunca', enviar_mensagem: 'nunca' },
  execucao: { ler: 'nunca' },
```

Matriz: o aluno passa a alcançar o texto.

```mutacao
arquivo: packages/shared/src/permissao/matriz.ts
teste: packages/shared/src/permissao/matriz.test.ts › F2b, 1.0
-  aula: { ler: 'nunca', gravar: 'nunca' },
+  aula: { ler: 'proprio', gravar: 'proprio' },
  time: { ler: 'nunca' },
  assistente: { ler_conversa: 'nunca', enviar_mensagem: 'nunca' },
  execucao: { ler: 'proprio' },
```

Classificação: sem a ligação, a tabela fica fora do arquivo do titular.

```mutacao
arquivo: packages/shared/src/privacidade/classificacao.ts
teste: packages/core/src/titular/leitura-do-titular.test.ts › só entra na versão completa
-  aula: fixo('registro_da_aula', 'virada do ano (F2b)', 'vinculo_id'),
+  aula: fixo('registro_da_aula', 'virada do ano (F2b)'),
```

Classificação: tabela sem pessoa.

```mutacao
arquivo: packages/shared/src/privacidade/classificacao.ts
teste: packages/core/src/titular/leitura-do-titular.test.ts › só entra na versão completa
-  aula: fixo('registro_da_aula', 'virada do ano (F2b)', 'vinculo_id'),
+  aula: SEM_PESSOA,
```

Classificação: o prazo é de outra chave.

```mutacao
arquivo: packages/shared/src/privacidade/classificacao.ts
teste: packages/core/src/titular/leitura-do-titular.test.ts › só entra na versão completa
-  aula: fixo('registro_da_aula', 'virada do ano (F2b)', 'vinculo_id'),
+  aula: fixo('sessao', 'virada do ano (F2b)', 'vinculo_id'),
```

Prazo fixo: a chave sai do catálogo.

```mutacao
arquivo: packages/shared/src/privacidade/retencao.ts
teste: packages/shared/src/privacidade/retencao.test.ts › F2b: o registro da aula tem prazo fixo
  'lista_de_nomes',
-  'registro_da_aula',
  'planilha_importada',
```

Prazo fixo: o texto diz outro prazo.

```mutacao
arquivo: packages/shared/src/privacidade/retencao.ts
teste: packages/shared/src/privacidade/retencao.test.ts › F2b: o registro da aula tem prazo fixo
-    prazo: 'até o encerramento do ano letivo; só o professor o lê',
+    prazo: '60 meses depois do encerramento do ano letivo',
```

Arquivo: a versão da coordenação passa a trazer o texto (unidade).

```mutacao
arquivo: packages/core/src/titular/leitura-do-titular.ts
teste: packages/core/src/titular/leitura-do-titular.test.ts › só entra na versão completa
falha: naVersao?.('coordenacao')).toBe(false)
  // O texto é da professora (critério 5): a versão da coordenação não o traz, nem a tabela.
-  naVersao: (versao) => versao === 'completa',
+  naVersao: () => true,
```

Arquivo: a versão da coordenação passa a trazer o texto (integração).

```mutacao
arquivo: packages/core/src/titular/leitura-do-titular.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › sem conta ativa, a versão da escola traz o Tutor
falha: not.toContain(String(proibido))
  // O texto é da professora (critério 5): a versão da coordenação não o traz, nem a tabela.
-  naVersao: (versao) => versao === 'completa',
+  naVersao: () => true,
```

Arquivo: o vínculo deixa de ser o do titular (o colega da escola entraria).

```mutacao
arquivo: packages/core/src/titular/leitura-do-titular.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › o professor: cada tabela que ele tem aparece
falha: not.toContain(doColega.textos['aula.conteudo'])
       sql`select ${selectColumns('id', 'ano_letivo_id', 'vinculo_id', 'data', 'inicio', 'fim', 'conteudo', 'atualizado_em')} from aula t
-  where t.escola_id = ${escolaId} and t.vinculo_id in (select v.id from vinculo v where v.escola_id = ${escolaId} and v.usuario_id = ${titularId} and v.papel = 'professor')`,
+  where t.escola_id = ${escolaId} and t.vinculo_id in (select v.id from vinculo v where v.escola_id = ${escolaId} and v.papel = 'professor')`,
```

Arquivo: o vínculo deixa de ser o de professor (a aula plantada num vínculo de aluno entraria).

```mutacao
arquivo: packages/core/src/titular/leitura-do-titular.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › R5: a aula plantada num vínculo de aluno
falha: tabelas['aula'] ?? [])
       sql`select ${selectColumns('id', 'ano_letivo_id', 'vinculo_id', 'data', 'inicio', 'fim', 'conteudo', 'atualizado_em')} from aula t
-  where t.escola_id = ${escolaId} and t.vinculo_id in (select v.id from vinculo v where v.escola_id = ${escolaId} and v.usuario_id = ${titularId} and v.papel = 'professor')`,
+  where t.escola_id = ${escolaId} and t.vinculo_id in (select v.id from vinculo v where v.escola_id = ${escolaId} and v.usuario_id = ${titularId})`,
```

Lista de tabelas do núcleo: a `aula` sai.

```mutacao
arquivo: tools/guardas/tabelas-do-nucleo.mjs
teste: tools/guardas/tabelas-do-nucleo.test.ts › tem toda tabela que o núcleo exporta
  'auditoriaOperacao',
-  'aula',
  'codigoRecuperacao',
```


## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| conformidade-reviewer (1ª) | Na 2.0, teste que prove 404 do coordenador em `GET /v1/semana` e `PUT /v1/aulas`, e que o colega da mesma turma e disciplina não leia o texto (R4) | tarefas 2.0 e 4.0 (as rotas só existem lá) |
| conformidade-reviewer (1ª) | O selo "Falta preencher" segue por aula, sem total, e nunca chega à coordenação, nem agregado (D64) | tarefas 6.0 e 7.0 (as telas) |
| tenancy-guardian (1ª) | `t.escola_id` e `v.escola_id` do `select` da `aula` no arquivo do titular sem teste que as observe | já declarado em "Mutações" (ids únicos entre escolas, como na `alocacao`); registro para a retro |
| tenancy-guardian (1ª) | Na 2.0, o repository da `aula` aplica escola, ano e vínculo do token, responde igual a inexistente e a de outra professora, e tem o teste de isolamento (todo id da B no contexto da A) | tarefas 2.0 e 4.0 |
| infra-guardian (1ª) | O `delete` da `aula` roda no request síncrono do encerramento do ano: volume de dezenas de milhares de linhas sob `statement_timeout`, e a gravação da 2.0 espera no `for share` do ano | `TODO.md`, seção "Infra e operação": cenário ou parágrafo do runbook do encerramento, e conferir `BANCO_TIMEOUT_CONSULTA_MS` em produção. Não muda esta tarefa |
| infra-guardian (1ª) | O cenário de carga da 2.0 inclui `GET /v1/semana` e `PUT /v1/aulas` com sessenta turmas, com latência e erro medidos | tarefas 2.0 e 4.0 |
| revisor-geral (1ª) | O S7 do `cenarios.md` fala de vínculo "encerrado antes por realocação", e o caso usa o vínculo desligado | recusada nesta tarefa: o `delete` é por escola e ano, o vínculo encerrado entra igual, e o test-engineer conferiu que o caso o cobre. O texto do cenário é da spec (Arquiteto): vai à retro |
| revisor-geral (1ª) | O `Retencao.tsx` da coordenação lê `PRAZOS_FIXOS` e passa a mostrar a linha "Registro da aula"; conferir o rótulo na foto | `TODO.md`, para o Validador conferir na fotografia da tela de retenção no fim da spec (nenhuma tarefa de tela toca esse arquivo) |
| privacy-guardian (1ª) | Quem nunca encerra o ano guarda o texto, e com ele algum nome de aluno, sem limite | `TODO.md`, seção "LGPD e conformidade": rotina de reserva no expurgo, como a `lista_nome`. Muda retenção, não é desta tarefa |
| privacy-guardian (1ª) | Na 2.0, a tela pede para não escrever nome de aluno, e as rotas não logam `conteudo` nem em erro | tarefas 4.0 (rota) e 7.0 (tela) |
| test-engineer (1ª) | `leitura-do-titular.test.ts:348-350` confere a forma do texto SQL | recusada: está declarada na Autoconferência 5, o resultado é provado na integração, e o próprio test-engineer disse que não bloqueia |
| test-engineer (1ª) | A FK simples da escola é redundante com a composta | recusada: é registro, sem mudança; igual à `alocacao` |
| test-engineer (1ª) | Para a 2.0: J14 (virada × gravação) e o `PUT` duplo com as duas chamadas em paralelo, e o "texto vazio apaga a linha" com teste próprio | tarefa 4.0 (a gravação) |
| tenancy-guardian (2ª), privacy-guardian (2ª), revisor-geral (2ª), infra-guardian (2ª), test-engineer (2ª) | `arquivo-do-titular.int.test.ts:626`: `expect(Object.keys(com).sort()).toEqual(Object.keys(sem).sort())` repete o `expect(com).toEqual(sem)` da linha 623; pode sair. O tenancy-guardian sugere, no lugar, `not.toContain` do texto sintético gravado | não aplicada: não prejudica, o `toEqual` e a lista de `categorias` carregam a regra, e os cinco aprovaram. A linha veio do item 5 da ordem r1, que repetiu o pedido do test-engineer da 1ª rodada; vai à retro |
| infra-guardian (2ª) | `eliminar-titular.int.test.ts:694`: `select id from aula where escola_id = $1` sem `order by` e comparado com `toEqual([registroDoOutro])` | não aplicada: hoje só sobra uma linha, então a ordem não importa; o test-engineer rodou o caso e aprovou. `order by id` entra se alguém acrescentar outra linha ao caso |
| test-engineer (2ª) | `eliminar-titular.int.test.ts:656`: o título do caso diz "a aula sai com o vínculo dele" e agora cobre a `alocacao` e o registro da `aula`; a variável local `aula` (linha 669) insere em `alocacao` | não aplicada: só nome, sem comportamento; vai à retro (confusão entre a `alocacao` e a tabela `aula`) |
| test-engineer (2ª) | A tabela de testes do `1_task.md` não tem linha para "o registro da aula sai com o vínculo na eliminação" | Validador e retro: a cobertura existe e está provada, só não está citada pelo nome |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-06 15:01:27 | 2026-11-06 15:02:08 | `conformidade-reviewer` | 1 | APROVADO | a3d6a0182f131d462 |
| 2026-11-06 15:01:21 | 2026-11-06 15:02:13 | `tenancy-guardian` | 1 | APROVADO | aa4781f098bc98d82 |
| 2026-11-06 15:01:36 | 2026-11-06 15:02:18 | `infra-guardian` | 1 | APROVADO | ae98d7108b85e2672 |
| 2026-11-06 15:01:33 | 2026-11-06 15:02:36 | `revisor-geral` | 1 | APROVADO | a39c76b1145885a95 |
| 2026-11-06 15:01:24 | 2026-11-06 15:02:51 | `privacy-guardian` | 1 | APROVADO | a8926bf54f6d465da |
| 2026-11-06 15:01:30 | 2026-11-06 15:03:14 | `test-engineer` | 1 | APROVADO | ad25c410b59365f93 |
| 2026-11-06 15:14:30 | 2026-11-06 15:14:46 | `tenancy-guardian` | 2 | APROVADO | ae0e8003911d1ac11 |
| 2026-11-06 15:14:41 | 2026-11-06 15:15:05 | `privacy-guardian` | 2 | APROVADO | a22451a68812756fa |
| 2026-11-06 15:14:54 | 2026-11-06 15:15:11 | `conformidade-reviewer` | 2 | APROVADO | abe6282232161c546 |
| 2026-11-06 15:15:17 | 2026-11-06 15:15:48 | `revisor-geral` | 2 | APROVADO | a68a7b79f482c093e |
| 2026-11-06 15:15:29 | 2026-11-06 15:15:49 | `infra-guardian` | 2 | APROVADO | ab7b1873fcf4ea458 |
| 2026-11-06 15:15:05 | 2026-11-06 15:15:49 | `test-engineer` | 2 | APROVADO | ab956c5c188766e6b |
