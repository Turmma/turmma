# Tarefa 2.0 — O banco do F2 existe, e a turma ganha a chave que casa "8ºA" com "8A"

**Funcionalidade:** onboarding-por-convite · **Depende de:** 1.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

As tabelas e colunas do F2 existem, com os checks provados direto no banco; a turma criada ou renomeada grava a
`chave` normalizada, e a chave repetida no ano responde `CONFLITO`; os contratos das planilhas moram em
`packages/shared/src/importacao/`.

## Contexto necessário

- `techspec.md` §3 (o bloco inteiro), §2 (linha `packages/shared/src/importacao/`), §5 "Planilha" (o normalizador)
- `prd.md` RF3, RF16, RF17
- `.claude/rules/80-infra-e-carga.md` itens 8 e 9; regra 10 itens 1 e 2; regra 20 item 1
- `cenarios.md` RF3 (a parte da chave) e "Auditoria e dado"
- Código: `packages/core/src/db/schema/turma.ts`, `vinculo.ts`; migrations em `packages/core/drizzle/`;
  `packages/core/src/estrutura/turma.repository.ts` (da 1.0); `packages/shared/src/privacidade/classificacao.ts`

## Subtarefas

- [x] 2.1 — Migration: `importacao_planilha`, `alocacao`, `evento_calendario` (FK composta com o ano, índices e checks da §3), `turma.chave` com o único parcial (preenchida só onde é única no ano), `vinculo.origem`
- [x] 2.2 — `packages/shared/src/importacao/`: normalizador de turma e de disciplina, cabeçalhos dos quatro modelos, contratos de prévia, gravar e estado, `resumo` estrito (só contagens), erros de lista fechada. A definição do job `estrutura.gravar-planilha` não entra aqui: vai na 4.4, junto com o processor
- [x] 2.3 — `turma.chave` na criação e na renomeação, no mesmo `update`; único violado: `CONFLITO`
- [x] 2.4 — Classificação das três tabelas novas; `docs/modelo-de-dados.md` (`alocacao` substitui as três tabelas da grade; id estável), glossário ("Grade horária"); `docs/runbook.md` (voltar a versão recalcula a `chave`)
- [x] 2.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/00NN_f2_planilhas.sql` e `meta/` | novo |
| `packages/core/src/db/schema/importacao-planilha.ts`, `alocacao.ts`, `evento-calendario.ts` | novo |
| `packages/core/src/db/schema/turma.ts`, `vinculo.ts` | alterado |
| `packages/core/src/estrutura/turma.repository.ts` | alterado |
| `packages/shared/src/importacao/*.ts`, `packages/shared/src/index.ts` | novo; alterado |
| `packages/shared/src/privacidade/classificacao.ts` | alterado |
| `docs/modelo-de-dados.md`, `docs/glossario.md`, `docs/runbook.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| A migration roda sobre dado da A1 e só expande | integração | nada apagado; o padrão vale nas linhas antigas | |
| "8ºA", "8º A", "8A", "8a" e "8º ano A" dão a mesma chave | unidade | RF3 | |
| "Turma Azul" e "10A" dão chave nula | unidade | RF3, fora do padrão | |
| Criar "8º A" grava `chave = 8a` | integração | a chave nasce na criação | |
| Renomear para "Turma Azul" deixa a `chave` nula | integração | recalcula no mesmo `update` | `estrutura.int.test.ts › F2, RF3: a turma criada grava a chave do nome …` (o laço de renomeação; a outra turma do caso se chama "Turma Branca" para o nome "Turma Azul" não colidir com ela, o `CONFLITO` do nome repetido) |
| Renomear para chave que já existe no ano: `CONFLITO` | integração | único violado vira `CONFLITO` | |
| Mesma chave em outro ano, ou na escola B: aceita | integração | o único é por escola e ano | |
| [P] "8º A" e "8A" criadas à mão ao mesmo tempo: uma turma, a outra `CONFLITO` | [P] | barra o único parcial, não uma leitura anterior | |
| Migration com duas turmas de mesma chave no ano: as duas com `chave` nula | integração | preenche só onde é única | |
| `alocacao` com `inicio >= fim` ou `diaSemana` 8: recusada | integração | checks | |
| `alocacao` com o ano de outra escola: a FK composta recusa | integração | isolamento no banco | |
| Segunda importação `na_fila` da mesma escola recusada; na outra escola, aceita | integração | único parcial | |
| `anoLetivoId` nulo fora do tipo professores, ou `erro` fora da lista: recusado | integração | checks | |
| Eliminar o professor que gravou planilha e tem alocação: passa | integração | `set null` e cascata (RF17) | |
| `contracts.test.ts`: a grade sai sem e-mail | unidade | DTO | |
| `resumo` com chave que não é contagem (`nome`): recusado | unidade | contrato estrito | |

## Como testar

- Check e FK composta no banco: `packages/core/src/db/schema/f2-planilhas.int.test.ts` (a migration sobre dado da A1 e a conta da chave: `packages/core/src/db/migracao-f2.int.test.ts`)
- `CONFLITO` na renomeação: `apps/api/test/estrutura.int.test.ts › renomear: a resposta e a listagem trazem o nome novo, …, dá CONFLITO sem o valor`; o [P]: `› concorrência: duas turmas renomeadas para o mesmo nome em paralelo, …: uma fica com ele, a outra recebe CONFLITO`, já escrito com a chave ("8º A" e "8A")
- Comandos: `npx vitest run --project unidade packages/shared/src/importacao`; `npx vitest run --project integracao apps/api/test/estrutura.int.test.ts`

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3, a chave repetida precisa de duas turmas no mesmo ano **e** uma em outro ano.

Respostas do plano:

1. Mutações: a seção "Mutações" (44 blocos e seis motivos, o `--faltando` conferido).
2. Texto na tela: não se aplica, a tarefa não tem tela.
3. Segundo dado: a chave repetida tem duas turmas no mesmo ano **e** uma em outro ano e uma na escola B (`estrutura.int.test.ts`, `f2-planilhas.int.test.ts`); as FKs compostas têm o vínculo, o ano e o autor de outra escola.
4. Checagem anterior: nenhuma leitura anterior barra a chave repetida; o [P] das duas turmas em paralelo só passa pelo único parcial.
5. Asserções olham o resultado: o erro do banco, a `chave` lida do banco depois do `update`, o `CONFLITO` sem o valor, a linha que sobrou.
6. Uma fixture e um caso por forma de burlar: horário igual, dia 0 e 8, erro com texto do Postgres, ano nulo fora de professores, segunda na fila.
7. Comentários: a migration, os schemas e o `modelo-de-dados.md` dizem o que o código faz (`alocacao` substitui as três tabelas; `set null` só no autor).
8. Divergência da tabela com a coluna "Onde está na spec" preenchida; a Tech Spec não muda.
9. Nada se copia nem se move.
10. Corrida: o único parcial da chave e o da fila resolvem no banco (regra 80, item 7); o [P] prova o primeiro.
11. Cada linha da tabela de testes tem o caso: a migration sobre dado da A1 (`migracao-f2.int.test.ts`), a chave (`normalizador.test.ts`), criar e renomear (`estrutura.int.test.ts`), os checks e as FKs (`f2-planilhas.int.test.ts`), a eliminação (`eliminar-titular.int.test.ts`), a grade sem e-mail (`contracts.test.ts`), o `resumo` estrito (`contratos.test.ts`).
12. `achados/indice.md`: a rodada da revisão da spec que toca a tarefa é a do `infra-guardian` sobre a migration que só expande e o rollback; atendida pelo runbook ("Voltar o código depois da chave da turma") e pelo teste de migration sobre dado antigo.

## Fora do escopo desta tarefa

Quem grava `alocacao`, `evento_calendario` e `importacao_planilha` (4.0 em diante).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| A definição do job `estrutura.gravar-planilha` (constante `TIPO_GRAVAR_PLANILHA`) saiu da 2.2 e foi para a 4.4 | `apps/worker/src/composition.test.ts` exige processador, na réplica de cada fila, para todo tipo de job do worker, e o processor só nasce na 4.4; a definição na 2.2 deixaria esse caso e o `job-definitions.test.ts` vermelhos na esteira por duas tarefas | `techspec.md` §2 e §7c não mudam (mesmo nome, fila e escopo); `4_task.md` 4.4, "Arquivos previstos" e "Como testar" (registro de jobs); `tasks.md` 2.2 e 4.4 |
| A `alocacao` não tem a FK composta direta `(escolaId, anoLetivoId)` para `ano_letivo` que a §3 pede de "toda tabela nova com ano": ela se apoia na FK composta para o `vinculo` (`escola_id, ano_letivo_id, vinculo_id`) | O vínculo já está preso à escola e ao ano, e a `alocacao` leva o mesmo par: a FK para o ano seria redundante (a mutação que a tirasse nunca ficaria vermelha), e a linha da `alocacao` na §3 sustenta essa leitura | `techspec.md` §3, a frase "toda tabela nova com ano tem FK composta … salvo a `alocacao`" (a exceção entrou na Tech Spec); a linha da `alocacao` na mesma seção; `alocacao.ts` (FK `alocacao_vinculo_do_ano_da_escola_fk`) |
| `tools/guardas/tabelas-do-nucleo.mjs` ganha `alocacao`, `eventoCalendario` e `importacaoPlanilha`, que não estava nos "Arquivos previstos" | `tools/guardas/tabelas-do-nucleo.test.ts` exige que toda tabela que o núcleo exporta esteja na lista da guarda `tabela-so-no-repository`; sem as três o portão fica vermelho na unidade | `techspec.md` §3 não muda; regra 10 item 3 e `tools/guardas/tabelas-do-nucleo.test.ts` |

## Mutações

--faltando: 4 linhas (44 blocos, 6 motivos)

**O `.where(` do índice parcial no schema TypeScript (motivo; `importacao-planilha.ts:47` e `:48`, `turma.ts:43`):** o schema do Drizzle só alimenta o `drizzle-kit generate`; o banco que os testes e a produção montam vem do SQL da migration, e a cláusula `WHERE` dos três índices tem bloco acima, no SQL (`uma_na_fila_por_escola`, `na_fila_idx`, `turma_chave_no_ano_unica`), com o caso do banco que fica vermelho sem ela. Tirar o `.where(` do TypeScript não muda nenhuma linha que rode, e o `generate` depois da migration não gera diferença (conferido ao montá-la), que é a guarda de que as duas escritas dizem o mesmo.

**O `WHERE "turma"."chave" is not null` do índice da chave, no SQL (motivo; sem linha no `--faltando`):** o único com a cláusula e sem ela rejeita exatamente as mesmas linhas, porque `NULL` nunca colide com `NULL` num índice único do Postgres; a cláusula só deixa o índice menor (as turmas de nome livre não entram nele). Não há caso de banco que fique vermelho sem ela, e o bloco que tirá-la nunca ficaria.

A exclusão das repetidas do preenchimento (`WHERE "total" = 1`) não tem bloco que a tire: sem ela duas turmas do ano ficam com a mesma chave e o `CREATE UNIQUE INDEX` da própria migration falha, o que é erro de carga (o `beforeAll` do teste migra), e o portão o recusa como prova. O bloco acima exige o contrário, que as únicas **ganhem** a chave; as repetidas sem chave são conferidas pelo caso (`6ºA` e `6 a`) e pela própria migration, que não termina com duas iguais.

**As FKs simples para `escola` de `alocacao` e `evento_calendario` (motivo; sem linha no `--faltando`):** cada uma é a FK de convenção de toda tabela de domínio, e as duas tabelas já têm uma FK composta que leva à escola (a do vínculo na `alocacao`, a do ano no `evento_calendario`): tirar a simples não deixa nada passar, então a mutação nunca ficaria vermelha. A que segura uma escola inexistente sozinha é a da `importacao_planilha` (a planilha de professores não tem ano), e ela tem bloco e caso.

**O `?? 0` de `bytesEmUtf8` (motivo; `contratos.ts:40`):** `codePointAt(0)` de um caractere que o `for…of` acabou de entregar nunca é `undefined`; o `?? 0` só existe para o `noUncheckedIndexedAccess` calar o tipo. Mudar o `0` não altera resultado possível, e não há entrada que passe por esse ramo. As duas linhas de baixo (`bytes += …`) têm os dois blocos que provam a conta.

A `UNIQUE("escola_id","ano_letivo_id","id")` do `vinculo` não tem bloco: sem ela a FK composta da `alocacao` não carrega, e a mutação cai como erro de carga, que o portão recusa. Quem a prova é a FK da `alocacao`, no primeiro bloco do vínculo de outra escola.

A `alocacao`, no SQL da migration (o teste recria o banco por ela):

```mutacao
arquivo: packages/core/drizzle/0040_f2_planilhas.sql
teste: packages/core/src/db/schema/f2-planilhas.int.test.ts › o horário que termina antes de começar
-"alocacao"."inicio" < "alocacao"."fim"
+"alocacao"."inicio" <= "alocacao"."fim"
```

```mutacao
arquivo: packages/core/drizzle/0040_f2_planilhas.sql
teste: packages/core/src/db/schema/f2-planilhas.int.test.ts › o dia da semana 0 e 8
-"alocacao"."dia_semana" between 1 and 7
+"alocacao"."dia_semana" between 0 and 8
```

```mutacao
arquivo: packages/core/drizzle/0040_f2_planilhas.sql
teste: packages/core/src/db/schema/f2-planilhas.int.test.ts › o mesmo vínculo no mesmo dia e início
-UNIQUE("vinculo_id","dia_semana","inicio")
+CHECK (true)
```

```mutacao
arquivo: packages/core/drizzle/0040_f2_planilhas.sql
teste: packages/core/src/db/schema/f2-planilhas.int.test.ts › o vínculo de outra escola e o de outro ano
-"alocacao_vinculo_do_ano_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id","vinculo_id") REFERENCES "public"."vinculo"("escola_id","ano_letivo_id","id")
+"alocacao_vinculo_do_ano_da_escola_fk" FOREIGN KEY ("vinculo_id") REFERENCES "public"."vinculo"("id")
```

```mutacao
arquivo: packages/core/drizzle/0040_f2_planilhas.sql
teste: packages/core/src/db/schema/f2-planilhas.int.test.ts › a aula sai com o vínculo, em cascata
-ON DELETE cascade
+ON DELETE no action
```

```mutacao
arquivo: packages/core/drizzle/0040_f2_planilhas.sql
teste: packages/core/src/db/schema/f2-planilhas.int.test.ts › cada um começa pelo escopo
-CREATE INDEX "alocacao_ano_idx" ON "alocacao" USING btree ("escola_id","ano_letivo_id")
+CREATE INDEX "alocacao_ano_idx" ON "alocacao" USING btree ("ano_letivo_id","escola_id")
```

O `evento_calendario`:

```mutacao
arquivo: packages/core/drizzle/0040_f2_planilhas.sql
teste: packages/core/src/db/schema/f2-planilhas.int.test.ts › o tipo fora de feriado
-"evento_calendario"."tipo" in ('feriado', 'recesso', 'evento')
+"evento_calendario"."tipo" is not null
```

```mutacao
arquivo: packages/core/drizzle/0040_f2_planilhas.sql
teste: packages/core/src/db/schema/f2-planilhas.int.test.ts › o fim antes do início
-"evento_calendario"."inicio" <= "evento_calendario"."fim"
+true
```

```mutacao
arquivo: packages/core/drizzle/0040_f2_planilhas.sql
teste: packages/core/src/db/schema/f2-planilhas.int.test.ts › a descrição vazia
-between 1 and 120
+between 1 and 121
```

```mutacao
arquivo: packages/core/drizzle/0040_f2_planilhas.sql
teste: packages/core/src/db/schema/f2-planilhas.int.test.ts › a descrição vazia
-char_length(btrim("evento_calendario"."descricao"))
+char_length("evento_calendario"."descricao")
```

```mutacao
arquivo: packages/core/drizzle/0040_f2_planilhas.sql
teste: packages/core/src/db/schema/f2-planilhas.int.test.ts › o ano de outra escola é recusado pela FK composta; o ano da própria
-"evento_calendario_ano_letivo_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id") REFERENCES "public"."ano_letivo"("escola_id","id")
+"evento_calendario_ano_letivo_da_escola_fk" FOREIGN KEY ("ano_letivo_id") REFERENCES "public"."ano_letivo"("id")
```

```mutacao
arquivo: packages/core/drizzle/0040_f2_planilhas.sql
teste: packages/core/src/db/schema/f2-planilhas.int.test.ts › cada um começa pelo escopo
-CREATE INDEX "evento_calendario_ano_idx" ON "evento_calendario" USING btree ("escola_id","ano_letivo_id")
+CREATE INDEX "evento_calendario_ano_idx" ON "evento_calendario" USING btree ("ano_letivo_id","escola_id")
```

A `importacao_planilha`:

```mutacao
arquivo: packages/core/drizzle/0040_f2_planilhas.sql
teste: packages/core/src/db/schema/f2-planilhas.int.test.ts › tipo e estado fora da lista
-"importacao_planilha"."tipo" in ('alunos', 'professores', 'grade', 'calendario')
+"importacao_planilha"."tipo" is not null
```

```mutacao
arquivo: packages/core/drizzle/0040_f2_planilhas.sql
teste: packages/core/src/db/schema/f2-planilhas.int.test.ts › tipo e estado fora da lista
-"importacao_planilha"."estado" in ('na_fila', 'concluida', 'desatualizada', 'falhou')
+"importacao_planilha"."estado" is not null
```

```mutacao
arquivo: packages/core/drizzle/0040_f2_planilhas.sql
teste: packages/core/src/db/schema/f2-planilhas.int.test.ts › o erro fora da lista fechada
-"importacao_planilha"."erro" in ('expirou', 'trava_esgotada', 'erro_interno')
+true
```

```mutacao
arquivo: packages/core/drizzle/0040_f2_planilhas.sql
teste: packages/core/src/db/schema/f2-planilhas.int.test.ts › o ano nulo só vale na planilha de professores
-"importacao_planilha"."tipo" = 'professores'
+true
```

```mutacao
arquivo: packages/core/drizzle/0040_f2_planilhas.sql
teste: packages/core/src/db/schema/f2-planilhas.int.test.ts › o ano de outra escola é recusado pela FK composta, e o autor
-"importacao_planilha_ano_letivo_da_escola_fk" FOREIGN KEY ("escola_id","ano_letivo_id") REFERENCES "public"."ano_letivo"("escola_id","id")
+"importacao_planilha_ano_letivo_da_escola_fk" FOREIGN KEY ("ano_letivo_id") REFERENCES "public"."ano_letivo"("id")
```

```mutacao
arquivo: packages/core/drizzle/0040_f2_planilhas.sql
teste: packages/core/src/db/schema/f2-planilhas.int.test.ts › o ano de outra escola é recusado pela FK composta, e o autor
-"importacao_planilha_criado_por_da_escola_fk" FOREIGN KEY ("escola_id","criado_por") REFERENCES "public"."usuario"("escola_id","id") ON DELETE set null ("criado_por")
+"importacao_planilha_criado_por_da_escola_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE set null
```

```mutacao
arquivo: packages/core/drizzle/0040_f2_planilhas.sql
teste: packages/core/src/db/schema/f2-planilhas.int.test.ts › eliminar quem gravou a planilha
-ON DELETE set null ("criado_por")
+ON DELETE no action
```

```mutacao
arquivo: packages/core/drizzle/0040_f2_planilhas.sql
teste: packages/core/src/db/schema/f2-planilhas.int.test.ts › uma importação na fila por escola
-CREATE UNIQUE INDEX "importacao_planilha_uma_na_fila_por_escola"
+CREATE INDEX "importacao_planilha_uma_na_fila_por_escola"
```

```mutacao
arquivo: packages/core/drizzle/0040_f2_planilhas.sql
teste: packages/core/src/db/schema/f2-planilhas.int.test.ts › uma importação na fila por escola
-USING btree ("escola_id") WHERE "importacao_planilha"."estado" = 'na_fila'
+USING btree ("escola_id")
```

```mutacao
arquivo: packages/core/drizzle/0040_f2_planilhas.sql
teste: packages/core/src/db/schema/f2-planilhas.int.test.ts › cada um começa pelo escopo
-"importacao_planilha_na_fila_idx" ON "importacao_planilha" USING btree ("criado_em") WHERE "importacao_planilha"."estado" = 'na_fila'
+"importacao_planilha_na_fila_idx" ON "importacao_planilha" USING btree ("criado_em")
```

A `turma.chave` e o `vinculo.origem`, no banco:

```mutacao
arquivo: packages/core/drizzle/0040_f2_planilhas.sql
teste: packages/core/src/db/schema/f2-planilhas.int.test.ts › a mesma chave em outro ano da escola e na escola B
-"turma_chave_no_ano_unica" ON "turma" USING btree ("escola_id","ano_letivo_id","chave")
+"turma_chave_no_ano_unica" ON "turma" USING btree ("escola_id","chave")
```


```mutacao
arquivo: packages/core/drizzle/0040_f2_planilhas.sql
teste: packages/core/src/db/schema/f2-planilhas.int.test.ts › o vínculo nasce
-"vinculo"."origem" in ('coordenacao', 'grade', 'lista')
+true
```

```mutacao
arquivo: packages/core/drizzle/0040_f2_planilhas.sql
teste: packages/core/src/db/migracao-f2.int.test.ts › só expande
-DEFAULT 'coordenacao'
+DEFAULT 'grade'
```

A chave das turmas que já existiam, na migration:

```mutacao
arquivo: packages/core/drizzle/0040_f2_planilhas.sql
teste: packages/core/src/db/migracao-f2.int.test.ts
-WHERE "total" = 1
+WHERE "total" = 0
```

```mutacao
arquivo: packages/core/drizzle/0040_f2_planilhas.sql
teste: packages/core/src/db/migracao-f2.int.test.ts
-"achado"[1] || "achado"[3] AS "chave"
+"achado"[1] AS "chave"
```

```mutacao
arquivo: packages/core/drizzle/0040_f2_planilhas.sql
teste: packages/core/src/db/migracao-f2.int.test.ts
-PARTITION BY "escola_id", "ano_letivo_id", "chave"
+PARTITION BY "escola_id", "chave"
```

A escola e o índice da `importacao_planilha`:

```mutacao
arquivo: packages/core/drizzle/0040_f2_planilhas.sql
teste: packages/core/src/db/schema/f2-planilhas.int.test.ts › a escola que não existe é recusada na planilha de professores
-ALTER TABLE "importacao_planilha" ADD CONSTRAINT "importacao_planilha_escola_id_escola_id_fk" FOREIGN KEY ("escola_id") REFERENCES "public"."escola"("id") ON DELETE no action ON UPDATE no action
+SELECT 1
```

```mutacao
arquivo: packages/core/drizzle/0040_f2_planilhas.sql
teste: packages/core/src/db/schema/f2-planilhas.int.test.ts › cada um começa pelo escopo
-CONSTRAINT "importacao_planilha_escola_id_unico" UNIQUE("escola_id","id")
+CONSTRAINT "importacao_planilha_escola_id_unico" UNIQUE("id","escola_id")
```

A chave na criação e na renomeação da turma (o repository):

```mutacao
arquivo: packages/core/src/estrutura/turma.repository.ts
teste: apps/api/test/estrutura.int.test.ts › F2, RF3: a turma criada grava a chave do nome
-nome: nova.nome, chave: chaveDaTurma(nova.nome), turno: nova.turno
+nome: nova.nome, turno: nova.turno
```

```mutacao
arquivo: packages/core/src/estrutura/turma.repository.ts
teste: apps/api/test/estrutura.int.test.ts › F2, RF3: a turma criada grava a chave do nome
-.set({ nome, chave: chaveDaTurma(nome) })
+.set({ nome })
```

O normalizador (unidade):

```mutacao
arquivo: packages/shared/src/importacao/normalizador.ts
teste: packages/shared/src/importacao/normalizador.test.ts › "8ºA", "8º A"
-const FORMATO_DA_TURMA = /^(\d)\s*[ºo°ª]?\s*(ano)?\s*([a-z])$/
+const FORMATO_DA_TURMA = /^(\d)\s*[ºo°ª]\s*(ano)?\s*([a-z])$/
```

```mutacao
arquivo: packages/shared/src/importacao/normalizador.ts
teste: packages/shared/src/importacao/normalizador.test.ts › "8ºA", "8º A"
-const FORMATO_DA_TURMA = /^(\d)\s*[ºo°ª]?\s*(ano)?\s*([a-z])$/
+const FORMATO_DA_TURMA = /^(\d)\s*[ºo°ª]?\s*([a-z])$/
```

```mutacao
arquivo: packages/shared/src/importacao/normalizador.ts
teste: packages/shared/src/importacao/normalizador.test.ts › "Turma Azul" e "10A"
-const FORMATO_DA_TURMA = /^(\d)\s*[ºo°ª]?\s*(ano)?\s*([a-z])$/
+const FORMATO_DA_TURMA = /^(\d+)\s*[ºo°ª]?\s*(ano)?\s*([a-z])$/
```

```mutacao
arquivo: packages/shared/src/importacao/normalizador.ts
teste: packages/shared/src/importacao/normalizador.test.ts › "8ºA", "8º A"
-return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
+return texto.normalize('NFD').toLowerCase().replace(/\s+/g, ' ').trim()
```

```mutacao
arquivo: packages/shared/src/importacao/normalizador.ts
teste: packages/shared/src/importacao/normalizador.test.ts › espaço de dentro vira um só
-return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
+return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
```

```mutacao
arquivo: packages/shared/src/importacao/normalizador.ts
teste: packages/shared/src/importacao/normalizador.test.ts › "Turma Azul" e "10A"
-if (achado === null) return null
+if (achado === null) return ''
```

```mutacao
arquivo: packages/shared/src/importacao/normalizador.ts
teste: packages/shared/src/importacao/normalizador.test.ts › o dígito 0, 4 e 5 não tem série
-if (ano >= menor && ano <= maior) return { etapa, ano }
+if (ano >= menor) return { etapa, ano }
```

Os contratos (unidade):

```mutacao
arquivo: packages/shared/src/importacao/contratos.ts
teste: packages/shared/src/importacao/contratos.test.ts › conta bytes, não caracteres
-bytes += ponto < 0x80 ? 1 : ponto < 0x800 ? 2 : ponto < 0x10000 ? 3 : 4
+bytes += ponto < 0x80 ? 1 : ponto < 0x800 ? 2 : ponto < 0x10000 ? 3 : 3
```

```mutacao
arquivo: packages/shared/src/importacao/contratos.ts
teste: packages/shared/src/importacao/contratos.test.ts › 512 KB exatos entram
-bytes += ponto < 0x80 ? 1 :
+bytes += ponto < 0x80 ? 2 :
```

```mutacao
arquivo: packages/shared/src/importacao/contratos.ts
teste: packages/shared/src/importacao/contratos.test.ts › resumo fora de
-.refine((importacao) => importacao.resumo === null || importacao.estado === 'concluida')
```

```mutacao
arquivo: packages/shared/src/importacao/contratos.ts
teste: packages/shared/src/importacao/contratos.test.ts › o código é uma palavra
-const codigoDeLinha = z.string().regex(/^[a-z][a-z0-9_]*$/)
+const codigoDeLinha = z.string().regex(/^[a-z]/)
```

```mutacao
arquivo: packages/shared/src/importacao/contratos.ts
teste: packages/shared/src/importacao/contratos.test.ts › a aula aceita o horário
-const horarioDaAula = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
+const horarioDaAula = z.string().regex(/^([01]\d|2[0-4]):[0-5]\d$/)
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| conformidade-reviewer (1ª) | Quando a 4.0 em diante gravar `alocacao`, nenhuma leitura da grade pode virar indicador de professor na coordenação (aulas por professor, carga comparada; regra 70 itens 8 e 9) | Tarefa 12.0 (a grade se lê por turma): auditoria dela. Não há leitura da grade nesta tarefa |
| tenancy-guardian (1ª) | `turmaId` e `anoLetivoId` chegam do cliente no corpo da prévia e do gravar: o repository da 4.0 os acha dentro da escola da sessão e responde igual ao id que não existe | Tarefa 4.0 (4.2 e 4.3). O repository e a rota nascem lá |
| tenancy-guardian (1ª), infra-guardian (1ª) | `importacao_planilha_na_fila_idx (criado_em)` não começa pela escola; a rotina de expiração que o usar precisa de `@Unscoped()` com a linha de justificativa (regra 10 item 9) | Tarefa 5.0 (a importação expira parada). A rotina não existe nesta tarefa |
| tenancy-guardian (1ª) | Teste de isolamento pela API (escola A pedindo id da B e recebendo 404) para `alocacao`, `evento_calendario` e `importacao_planilha`, junto do primeiro repository de cada uma | Tarefa 4.0 (4.6 "isolamento") para `importacao_planilha` e `evento_calendario`; tarefa 11.0 para `alocacao`. Não há endpoint nesta tarefa |
| infra-guardian (1ª) | `UNIQUE` e `CHECK` no `vinculo` travam a tabela inteira (`ACCESS EXCLUSIVE`); o padrão com `CONCURRENTLY` e `NOT VALID` + `VALIDATE` entra no guia antes de o `vinculo` crescer | `TODO.md` (linha nova, para `docs/guia-do-desenvolvedor.md`). Hoje passa: poucas dezenas de milhares de linhas, deploy fora do horário letivo |
| privacy-guardian (1ª) | Aluno eliminado com importação `na_fila`: nome e matrícula ficam em `importacao_planilha.linhas` por até cerca de 25 h; dizer na 5.0 ou na 15.0 que a eliminação não espera o gravar, ou que anula as `linhas` das importações na fila da escola | Tarefa 5.0 (expiração). Não há gravar nesta tarefa |
| privacy-guardian (1ª) | `candidatoDaMarcaSchema.rotulo` leva nome e matrícula de aluno existente para a coordenação: dizer se conta como leitura de dado de aluno e pede auditoria | Tarefa 4.0 (4.3 rotas, 4.5 auditoria). A rota da prévia nasce lá |
| privacy-guardian (1ª) | `alocacao.sala` é texto livre sem limite: teto de tamanho e o aviso "não escreva nome de pessoa" como no `evento_calendario.descricao` | Tarefa 11.0, no contrato de gravar a grade. Mudar o limite aqui altera migration e contrato já provados |
| revisor-geral (1ª) | A vitrine insere turma sem `chave` (`tools/vitrine/escola.ts:215`); a escola de demonstração não casa planilha pela chave | Tarefa 13.0, a primeira com tela de planilha de alunos fotografada na vitrine. Hoje nada lê a chave na vitrine |
| revisor-geral (1ª) | Comentário da migration diz "mesma conta" e a conta é aproximada | O item 1 prende a diferença em teste. Editar o `.sql` caduca todos os revisores por um comentário |
| revisor-geral (1ª) | Subtarefas 2.x sem marcar em `tasks.md` enquanto o `2_task.md` as marca | `tasks.md` é marcado pelo Orquestrador depois do commit, como na 1.0 (commit `0bc2b612`). Não editar agora |
| test-engineer (1ª) | Caso literal "`alocacao` com o ano da B, vínculo da A" (opcional) | Recusada: a mesma FK é provada pelos casos de vínculo da B, escola da B e ano de 2027 da mesma escola (`f2-planilhas.int.test.ts` linhas 148-157) |
| test-engineer (1ª) | `.onDelete('set null')` no schema TypeScript difere do `set null ("criado_por")` da migration; o próximo `drizzle-kit generate` pode regerar a FK no formato do TypeScript | Recusada: `importacao-planilha.ts:45` já comenta a diferença, e a seção "Mutações" registra que o `generate` depois da migration não gera diferença (conferido ao montá-la) |
| test-engineer (1ª) | O [P] de dois "gravar" em paralelo (único da fila) precisa ser cobrado | Tarefa 4.0 (4.6 "job duas vezes", "trava") |
| test-engineer (2ª) | O teste do runbook compara texto pela regex `/regexp_match\((.+)\) as achado/`; se o runbook ganhar uma segunda ocorrência do padrão, só a primeira é comparada: ancorar a regex na seção "Voltar o código depois da chave da turma" | Recusada: o runbook tem uma única ocorrência hoje, e o teste fica vermelho se ela deixar de ser igual à da migration. A âncora se faz se o runbook ganhar uma segunda cópia da conta |
| test-engineer (2ª) | O bloco do índice `UNIQUE("id","escola_id")` prova o formato do índice (desempenho, regra 80 item 8), não uma regra que deixe dado passar | Sem ação: é nota do próprio revisor, e o bloco está correto como guarda da regra 80 item 8 |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-03 18:34:46 | 2026-11-03 18:35:12 | `conformidade-reviewer` | 1 | APROVADO | abd5177fa596b1cae |
| 2026-11-03 18:34:30 | 2026-11-03 18:35:19 | `tenancy-guardian` | 1 | APROVADO | ace707c7dea573246 |
| 2026-11-03 18:34:36 | 2026-11-03 18:35:51 | `infra-guardian` | 1 | APROVADO | a8d35fde6956e0d9b |
| 2026-11-03 18:34:33 | 2026-11-03 18:36:05 | `privacy-guardian` | 1 | APROVADO | a158b5cd05f9d5faa |
| 2026-11-03 18:34:43 | 2026-11-03 18:36:39 | `revisor-geral` | 1 | APROVADO | a7e1cf71c02cd9054 |
| 2026-11-03 18:34:40 | 2026-11-03 18:38:09 | `test-engineer` | 1 | APROVADO | a4993db805e6d8519 |
| 2026-11-03 19:00:40 | 2026-11-03 19:01:33 | `test-engineer` | 2 | APROVADO | a99e1b82d0f4da737 |
| 2026-11-03 19:00:45 | 2026-11-03 19:01:33 | `revisor-geral` | 2 | REPROVADO | aa184c9cc718d9463 |
| 2026-11-03 19:10:06 | 2026-11-03 19:10:20 | `revisor-geral` | 3 | APROVADO | a70a482203ef0f9f2 |
| 2026-11-03 19:09:58 | 2026-11-03 19:10:23 | `test-engineer` | 3 | APROVADO | a00496648f941e282 |
