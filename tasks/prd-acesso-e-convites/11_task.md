# Tarefa 11.0 — O arquivo do titular traz os atos sobre ele (D85)

**Funcionalidade:** acesso-e-convites · **Depende de:** 10.0
**Subagentes obrigatórios:** `privacy-guardian`, `tenancy-guardian`, `infra-guardian`, `test-engineer`
**Porte:** grande

## Objetivo

O arquivo do titular do aluno traz, numa lista fechada, as seis ações sobre ele (`aluno.transferido`, `lista.transferida`, `usuario.nome_corrigido`, `lista.nome_corrigido`, `senha_provisoria.gerada`, `.usada`), com ação, entidade, finalidade, data e o papel de quem fez, e nunca o autor, o `antes`, o `depois` nem as leituras.

## Contexto necessário

- `techspec.md` seções 3 (o índice da auditoria) e 5 ("Arquivo do titular")
- `prd.md` RF17; `cenarios.md` "Arquivo do titular (D85)"
- `docs/decisoes.md` D85; `.claude/rules/20` itens 10 e 19
- `packages/core/src/titular/leitura-do-titular.ts` (`LEITURAS_DO_ARQUIVO`, `COLUNAS_FORA_DO_ARQUIVO`) e a migration `0034` (o índice parcial de modelo)

## Subtarefas

- [x] 11.1 — Migration do índice parcial `auditoria (escolaId, entidadeId, em)` nas seis ações
- [x] 11.2 — A leitura por alvo: o papel fixo por ação nas quatro da F2, do `depois` na `.gerada`; o `lista_nome` só aprovado, pelo `alunoId` da decisão
- [x] 11.3 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0046_auditoria_por_alvo.sql` | novo |
| `packages/core/drizzle/meta/_journal.json` | alterado |
| `packages/core/src/db/schema/auditoria.ts` | alterado |
| `packages/core/src/titular/leitura-do-titular.ts` | alterado |
| `packages/core/src/titular/leitura-do-titular.test.ts` | alterado |
| `apps/api/test/arquivo-do-titular.int.test.ts` | alterado |
| `packages/core/drizzle/meta/0046_snapshot.json` | novo (gerado pelo drizzle-kit junto com a migration) |
| `packages/core/src/auditoria/acoes-por-alvo.ts` | novo (a ordem de correção da 1ª rodada: a lista das seis ações e o papel da geração, escritos uma vez, que o schema e a leitura usam) |
| `TODO.md` | alterado (as quatro pendências da tabela "Recomendações sem aplicar") |
| `packages/core/src/db/schema/auditoria-por-alvo.int.test.ts` | novo (a migration em banco só dele: as migrations não se mutam pelo banco do ambiente) |
| `docs/lgpd.md` | alterado (o parágrafo do arquivo do titular deixa de dizer "a implementar") |
| `tasks/prd-acesso-e-convites/techspec.md`, `cenarios.md` | alterados (o papel da `.usada`, abaixo) |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| cada uma das seis ações | integração | no arquivo do alvo, não no de outro aluno, com o papel, sem id nem nome do autor, sem `antes` nem `depois` | `apps/api/test/arquivo-do-titular.int.test.ts` › "D85: <ação> aparece no arquivo do alvo…" (seis casos, um por ação); "D85: a lista fechada tem as seis ações…" |
| `lista.nome_corrigido` e `lista.transferida` de nome não aprovado | integração | em arquivo nenhum; aprovado, no do aluno | `apps/api/test/arquivo-do-titular.int.test.ts` › "D85: lista.nome_corrigido e lista.transferida de nome não aprovado…" (livre, reivindicado, e a mesma linha depois de aprovada) |
| autor das quatro da F2 eliminado | integração | o papel continua | `apps/api/test/arquivo-do-titular.int.test.ts` › "D85: o autor das quatro ações da planilha eliminado…" |
| `.usada` | integração | aparece uma vez | `apps/api/test/arquivo-do-titular.int.test.ts` › "D85: a senha_provisoria.usada, que o aluno assina e é o alvo, aparece uma vez…" (a linha e o `registros` do resumo) |
| `.gerada` por professor e pela coordenação | integração | "professor" e "coordenação" | `apps/api/test/arquivo-do-titular.int.test.ts` › "D85: a senha_provisoria.gerada feita pelo professor mostra…" (inclui o autor eliminado e a leitura de quem assina); "D85: a senha_provisoria.gerada com o papel %s…" (um caso por papel que gera a provisória, nunca sem papel) |
| isolamento: linha da B com o `entidade_id` do aluno da A | integração | fora do arquivo da A | `apps/api/test/arquivo-do-titular.int.test.ts` › "D85: isolamento: a linha da escola B…" (as seis ações, com o id do aluno e o da linha da lista dele) |
| leitura auditada (a coordenação abriu) | integração | não entra | `apps/api/test/arquivo-do-titular.int.test.ts` › "D85: a leitura auditada…" |
| índice parcial por alvo (regra 80, item 8) | integração | as duas leituras por alvo descem pelo `auditoria_por_alvo_idx`, que tem as seis ações | `apps/api/test/arquivo-do-titular.int.test.ts` › "D85: o índice parcial por alvo…" (as leituras reais, com volume); `packages/core/src/db/schema/auditoria-por-alvo.int.test.ts` (a definição e o plano, na migration) |
| [U] a forma da leitura | unidade | nenhuma coluna de `COLUNAS_FORA_DO_ARQUIVO` | `packages/core/src/titular/leitura-do-titular.test.ts` › "a leitura por alvo da auditoria (D85…)" (cinco casos: as duas leituras e a lista fechada de seis ações, a forma do `select` sem as colunas proibidas, o papel fixo por ação, e "o papel de quem gerou a provisória tem uma entrada por papel que gera…") |

## Como testar

- Precedente: `apps/api/test/arquivo-do-titular.int.test.ts` › "o aluno: cada tabela que ele tem aparece, e a linha de outro aluno e a de outra escola não" e "o arquivo do aluno não leva o id da coordenação nem a leitura que ela fez do titular, nas duas versões"
- Unidade: `packages/core/src/titular/leitura-do-titular.test.ts` (describe "LEITURAS_DO_ARQUIVO: a forma das leituras")
- Comando: `npx vitest run --project integracao apps/api/test/arquivo-do-titular.int.test.ts -t "D85"`

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 5: plante a linha da B direto no banco, com o mesmo `entidade_id`.

## Fora do escopo desta tarefa

Os atos de outras ações, fora da lista fechada.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| A `senha_provisoria.usada` sai com o papel `aluno` (ele a assina e é o alvo), e o papel de todas sai escrito como o aluno o lê: `coordenação`, `professor`, `aluno`. A spec fixava o papel das quatro da F2 e o da `.gerada`, e dizia só que a `.usada` sai uma vez | a leitura por alvo precisa de um papel em cada linha; o da `.usada` não estava dito | `techspec.md` §5, "Arquivo do titular (D85)" (a frase "a `.usada` sai uma vez, com o papel `aluno`"); `cenarios.md`, "Arquivo do titular (D85)"; `docs/lgpd.md`, o parágrafo do arquivo do titular |

## Mutações

--faltando: 1 linhas (20 blocos, 2 motivos). A ferramenta lista **uma** linha sem bloco, o `.where(` do índice em `auditoria.ts`; o motivo dela é o primeiro da lista abaixo. O segundo motivo é de uma linha que a ferramenta não lista, o `l.escola_id` da subconsulta de `lista_nome`, e fica escrito porque nenhum bloco o tira. Nenhuma outra linha nova de produção com condição fica sem bloco. Os 20 blocos foram aplicados e rodados antes do pedido (executor local sobre o mesmo `comandoDoTeste` do portão): todos ficaram vermelhos num caso que rodou e falhou, e o `falha:` do bloco negativo caiu na linha dele. As duas da migration rodam num banco só delas, porque o banco do ambiente já a aplicou.

Cada bloco foi pensado contra a linha que ele tira; o portão aplica, roda o caso e exige vermelho.

```mutacao
arquivo: packages/core/src/titular/leitura-do-titular.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › D85: aluno.transferido aparece
-          where t.escola_id = ${escolaId} and t.entidade_id = ${titularId}
+          where t.escola_id = ${escolaId}
```

```mutacao
arquivo: packages/core/src/titular/leitura-do-titular.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › D85: isolamento
-          where t.escola_id = ${escolaId} and t.entidade_id = ${titularId}
+          where t.entidade_id = ${titularId}
```

```mutacao
arquivo: packages/core/src/auditoria/acoes-por-alvo.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › D85: aluno.transferido aparece
-export const ACOES_DO_USUARIO_POR_ALVO = ['aluno.transferido', 'usuario.nome_corrigido', 'senha_provisoria.gerada', 'senha_provisoria.usada'] as const
+export const ACOES_DO_USUARIO_POR_ALVO = ['usuario.nome_corrigido', 'senha_provisoria.gerada', 'senha_provisoria.usada'] as const
```

```mutacao
arquivo: packages/core/src/auditoria/acoes-por-alvo.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › D85: usuario.nome_corrigido aparece
-export const ACOES_DO_USUARIO_POR_ALVO = ['aluno.transferido', 'usuario.nome_corrigido', 'senha_provisoria.gerada', 'senha_provisoria.usada'] as const
+export const ACOES_DO_USUARIO_POR_ALVO = ['aluno.transferido', 'senha_provisoria.gerada', 'senha_provisoria.usada'] as const
```

```mutacao
arquivo: packages/core/src/auditoria/acoes-por-alvo.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › D85: senha_provisoria.gerada aparece
-export const ACOES_DO_USUARIO_POR_ALVO = ['aluno.transferido', 'usuario.nome_corrigido', 'senha_provisoria.gerada', 'senha_provisoria.usada'] as const
+export const ACOES_DO_USUARIO_POR_ALVO = ['aluno.transferido', 'usuario.nome_corrigido', 'senha_provisoria.usada'] as const
```

```mutacao
arquivo: packages/core/src/auditoria/acoes-por-alvo.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › D85: a senha_provisoria.usada, que o aluno assina
-export const ACOES_DO_USUARIO_POR_ALVO = ['aluno.transferido', 'usuario.nome_corrigido', 'senha_provisoria.gerada', 'senha_provisoria.usada'] as const
+export const ACOES_DO_USUARIO_POR_ALVO = ['aluno.transferido', 'usuario.nome_corrigido', 'senha_provisoria.gerada'] as const
```

```mutacao
arquivo: packages/core/src/titular/leitura-do-titular.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › D85: a leitura auditada
falha: not.toContain(lida)
-            and t.acao in (${AS_DO_USUARIO})`,
+            `,
```

```mutacao
arquivo: packages/core/src/auditoria/acoes-por-alvo.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › D85: a senha_provisoria.gerada feita pelo professor
-export const PAPEL_NO_ARQUIVO_DA_GERACAO: Readonly<Record<PapelQueGeraASenhaProvisoria, string>> = { coordenador: 'coordenação', professor: 'professor' }
+export const PAPEL_NO_ARQUIVO_DA_GERACAO: Readonly<Record<PapelQueGeraASenhaProvisoria, string>> = { coordenador: 'coordenadora', professor: 'professor' }
```

```mutacao
arquivo: packages/core/src/auditoria/acoes-por-alvo.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › D85: a senha_provisoria.gerada feita pelo professor
-export const PAPEL_NO_ARQUIVO_DA_GERACAO: Readonly<Record<PapelQueGeraASenhaProvisoria, string>> = { coordenador: 'coordenação', professor: 'professor' }
+export const PAPEL_NO_ARQUIVO_DA_GERACAO: Readonly<Record<PapelQueGeraASenhaProvisoria, string>> = { coordenador: 'coordenação', professor: 'professora' }
```

```mutacao
arquivo: packages/core/src/auditoria/acoes-por-alvo.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › D85: a senha_provisoria.gerada com o papel professor
-export const PAPEL_NO_ARQUIVO_DA_GERACAO: Readonly<Record<PapelQueGeraASenhaProvisoria, string>> = { coordenador: 'coordenação', professor: 'professor' }
+export const PAPEL_NO_ARQUIVO_DA_GERACAO: Readonly<Record<PapelQueGeraASenhaProvisoria, string>> = { coordenador: 'coordenação' }
```

```mutacao
arquivo: packages/core/src/titular/leitura-do-titular.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › D85: a senha_provisoria.usada, que o aluno assina
-              when 'senha_provisoria.usada' then 'aluno'
+              when 'senha_provisoria.usada' then 'coordenação'
```

```mutacao
arquivo: packages/core/src/titular/leitura-do-titular.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › D85: aluno.transferido aparece
-              else 'coordenação'
+              else 'professor'
```

```mutacao
arquivo: packages/core/src/titular/leitura-do-titular.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › D85: aluno.transferido aparece
-            case t.acao
+            case 'senha_provisoria.usada'
```

```mutacao
arquivo: packages/core/src/titular/leitura-do-titular.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › D85: isolamento
-          where t.escola_id = ${escolaId} and t.acao in (${AS_DA_LISTA})
+          where t.acao in (${AS_DA_LISTA})
```

```mutacao
arquivo: packages/core/src/auditoria/acoes-por-alvo.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › D85: lista.transferida aparece
-export const ACOES_DA_LISTA_POR_ALVO = ['lista.transferida', 'lista.nome_corrigido'] as const
+export const ACOES_DA_LISTA_POR_ALVO = ['lista.nome_corrigido'] as const
```

```mutacao
arquivo: packages/core/src/auditoria/acoes-por-alvo.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › D85: lista.nome_corrigido aparece
-export const ACOES_DA_LISTA_POR_ALVO = ['lista.transferida', 'lista.nome_corrigido'] as const
+export const ACOES_DA_LISTA_POR_ALVO = ['lista.transferida'] as const
```

```mutacao
arquivo: packages/core/src/titular/leitura-do-titular.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › D85: lista.transferida aparece
-            and t.entidade_id in (select l.id from lista_nome l where l.escola_id = ${escolaId} and l.usuario_id = ${titularId})`,
+            and t.entidade_id in (select l.id from lista_nome l where l.escola_id = ${escolaId})`,
```

```mutacao
arquivo: packages/core/src/titular/leitura-do-titular.ts
teste: apps/api/test/arquivo-do-titular.int.test.ts › D85: lista.transferida aparece
-      sql`select ${selectColumns('id', 'acao', 'entidade', 'entidade_id', 'finalidade', 'em')}, 'coordenação' as papel from auditoria t
+      sql`select ${selectColumns('id', 'acao', 'entidade', 'entidade_id', 'finalidade', 'em')}, 'professor' as papel from auditoria t
```

```mutacao
arquivo: packages/core/drizzle/0046_auditoria_por_alvo.sql
teste: packages/core/src/db/schema/auditoria-por-alvo.int.test.ts
-CREATE INDEX "auditoria_por_alvo_idx" ON "auditoria" USING btree ("escola_id","entidade_id","em") WHERE "auditoria"."acao" in ('aluno.transferido', 'usuario.nome_corrigido', 'senha_provisoria.gerada', 'senha_provisoria.usada', 'lista.transferida', 'lista.nome_corrigido');
+CREATE INDEX "auditoria_por_alvo_idx" ON "auditoria" USING btree ("escola_id","entidade_id","em") WHERE "auditoria"."acao" in ('aluno.transferido', 'usuario.nome_corrigido', 'senha_provisoria.gerada', 'senha_provisoria.usada', 'lista.transferida');
```

```mutacao
arquivo: packages/core/drizzle/0046_auditoria_por_alvo.sql
teste: packages/core/src/db/schema/auditoria-por-alvo.int.test.ts
-CREATE INDEX "auditoria_por_alvo_idx" ON "auditoria" USING btree ("escola_id","entidade_id","em") WHERE "auditoria"."acao" in ('aluno.transferido', 'usuario.nome_corrigido', 'senha_provisoria.gerada', 'senha_provisoria.usada', 'lista.transferida', 'lista.nome_corrigido');
+CREATE INDEX "auditoria_por_alvo_idx" ON "auditoria" USING btree ("escola_id","em") WHERE "auditoria"."acao" in ('aluno.transferido', 'usuario.nome_corrigido', 'senha_provisoria.gerada', 'senha_provisoria.usada', 'lista.transferida', 'lista.nome_corrigido');
```

Linhas novas sem bloco, com o motivo de cada uma:

- `leitura-do-titular.ts`, o `l.escola_id = ${escolaId}` da subconsulta de `lista_nome` na leitura da lista: a FK composta `lista_nome_usuario_da_escola_fk` `(escola_id, usuario_id)` amarra o `usuario_id` à escola da linha, e o `titularId` é de um usuário só; nenhuma linha de outra escola tem o `usuario_id` do titular, então tirar o filtro não muda resultado. O escopo da leitura está no `t.escola_id` de fora (bloco acima, que o caso de isolamento prova).
- `auditoria.ts` (schema), o `.where(` do índice `auditoria_por_alvo_idx`: o banco do teste nasce da migration 0046 (blocos acima), e nenhum teste lê o schema do drizzle. O schema usa a mesma constante da leitura (`auditoria/acoes-por-alvo.ts`), e a migration foi gerada dele: `drizzle-kit generate` depois da migration responde "No schema changes", e o `auditoria-por-alvo.int.test.ts` confere o `where` da migration contra a constante. O índice não muda resultado, só o plano (regra 80, item 8).

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| `privacy-guardian` (1ª) | "Id de aluno no arquivo de quem fez o ato": na primeira leitura da auditoria (por autor), o arquivo da coordenadora leva `aluno.transferido` e `usuario.nome_corrigido` com `entidade_id` igual ao id do aluno; tirar o `entidade_id` ou excluir as seis ações quando o titular não é o alvo | `TODO.md`. Muda o conteúdo do arquivo de outra pessoa (a coordenadora) e a primeira consulta, que esta tarefa não alterou; o revisor a deu como "não veio deste diff". O Implementador acrescenta a linha ao `TODO.md` |
| `tenancy-guardian` (1ª) | O `else 'coordenação'` da leitura por usuário atribui coordenação a qualquer ação sem ramo próprio; listar as ações uma a uma ou `else null` | `TODO.md`. Esta linha é alvo de dois blocos de "Mutações" (`else 'coordenação'` → `else 'professor'` e o `case t.acao`), e uma sétima ação já esbarra na lista fechada do `in (...)` e no caso "a lista fechada tem as seis ações". O Implementador acrescenta a linha ao `TODO.md` |
| `revisor-geral` (1ª) | A forma das linhas não é a mesma: `papel` só vem da leitura por alvo, os atos do próprio titular saem sem a chave | Recusada. O revisor a deu como "aceitável", e mudaria o contrato do arquivo (as chaves de todas as linhas da tabela `auditoria`) |
| `test-engineer` (1ª) | Virada de ano letivo: caso com o aluno aprovado na lista de dois anos letivos | `TODO.md`. Pede semear um segundo ano letivo e duas linhas de lista; a leitura não filtra por ano e acerta, como o revisor registra. O Implementador acrescenta a linha ao `TODO.md` |
| `infra-guardian` (1ª) | Citar a `auditoria` pelo nome na pendência "antes do staging" do `TODO.md` (junto dos índices da 0025 e da 0026), e lembrar que o `migrar` usa o `statement_timeout` da consulta | `TODO.md` (é o destino em si). O Implementador acrescenta a linha |
| `test-engineer` (1ª) | `CREATE INDEX` sem `CONCURRENTLY` sobre a `auditoria` | Já é a recomendação acima do `infra-guardian`: o próprio revisor diz que é dele, e dentro da exceção da Tech Spec do F3, seção 7c, que ele aprovou |
| `test-engineer` (2ª) | `11_task.md:53` diz "(quatro casos)" para o describe "a leitura por alvo da auditoria (D85…)", que agora tem cinco; a linha ".gerada por professor e pela coordenação" não cita o caso novo `it.each` "D85: a senha_provisoria.gerada com o papel %s…" nem o de unidade "o papel de quem gerou a provisória tem uma entrada por papel que gera…"; o resumo da rodada dizia "caso de regex ajustado" e o caso foi removido | Corrigido no `11_task.md` antes do commit: a contagem (cinco casos) e a citação dos dois casos novos na tabela "Testes que provam a regra" |
| `privacy-guardian` (2ª), `infra-guardian` (2ª), `revisor-geral` (2ª) | O `when` da 0046 no `_journal.json` mudou depois de a migration ser aplicada no banco local do andar; o migrador do drizzle a aplica de novo e o `CREATE INDEX` falha com "already exists" | Sem código a mudar: a migration ainda não foi commitada e o portão recria o banco (`EDUCA_BANCO_NOVO=1`). O Orquestrador recria o banco local do andar antes do próximo `migrar` |
| `revisor-geral` (2ª) | `db/schema/auditoria.ts` é o primeiro arquivo de `db/schema/` que importa módulo de fora do schema, e o `drizzle-kit` o carrega: avisar no topo de `acoes-por-alvo.ts` que ali só pode importar tipo | `TODO.md`. Hoje funciona (o generate respondeu "No schema changes"). O Implementador acrescenta a linha |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-08 19:11:36 | 2026-11-08 19:11:55 | `conformidade-reviewer` | 1 | APROVADO | a2c8f38d37ff3eca1 |
| 2026-11-08 19:11:29 | 2026-11-08 19:12:03 | `tenancy-guardian` | 1 | APROVADO | adcbec151dba3718f |
| 2026-11-08 19:11:31 | 2026-11-08 19:12:24 | `infra-guardian` | 1 | APROVADO | a91a1e1ceb8b784b5 |
| 2026-11-08 19:11:28 | 2026-11-08 19:12:40 | `privacy-guardian` | 1 | APROVADO | a8c41d523aab13488 |
| 2026-11-08 19:11:34 | 2026-11-08 19:12:46 | `revisor-geral` | 1 | APROVADO | ab7357c9ec79e04c3 |
| 2026-11-08 19:11:33 | 2026-11-08 19:13:40 | `test-engineer` | 1 | APROVADO | a38c4d519888746f2 |
| 2026-11-08 20:06:07 | 2026-11-08 20:06:28 | `tenancy-guardian` | 2 | APROVADO | a7658ff13035afd06 |
| 2026-11-08 20:06:03 | 2026-11-08 20:06:36 | `privacy-guardian` | 2 | APROVADO | ac8ec7226104fe1c9 |
| 2026-11-08 20:06:23 | 2026-11-08 20:06:46 | `conformidade-reviewer` | 2 | APROVADO | a75efbd9b1eb6d935 |
| 2026-11-08 20:06:11 | 2026-11-08 20:06:46 | `infra-guardian` | 2 | APROVADO | ac44b0e775a03083b |
| 2026-11-08 20:06:19 | 2026-11-08 20:06:58 | `revisor-geral` | 2 | APROVADO | adc18e499989ed701 |
| 2026-11-08 20:06:15 | 2026-11-08 20:07:50 | `test-engineer` | 2 | APROVADO | a037e7d4650fa6f45 |
