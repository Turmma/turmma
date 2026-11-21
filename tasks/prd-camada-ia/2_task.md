# Tarefa 2.0 — O orçamento de IA existe no banco e na conta: colunas, retrato do mês e a leitura por escola

**Funcionalidade:** camada-ia · **Depende de:** 1.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
**Porte:** grande

## Objetivo

O orçamento do mês da escola (valor por aluno × alunos ativos, com o teto) sai de uma função pura e de um repository só,
com escopo, que a API, o lote e a medida usam.

## Contexto necessário

- `techspec.md` §2, §3, §4 (`situacao`, `aviso`), §5 ("Alunos ativos"), §6, §7
- `prd.md` RF7, RF8, §7 (os quatro casos do orçamento), §8
- `cenarios.md` §1 RF7 (precedência), RF8 (todas), §2 (as quatro primeiras linhas e "Exceções declaradas")

- Código: `packages/core/drizzle/0064_indice_da_classificacao_atrasada.sql` (índice à parte), `painel.repository.ts` ›
  `escolas()` (a contagem de alunos, que vira o trecho comum), `packages/core/src/material/classificacao-atrasada.repository.ts`

## Subtarefas

- [x] 2.1 — Migration de expansão: as duas colunas em `configuracao_operacional_escola` e em `rede`, com os checks;
  `orcamento_ia_do_mes` com `pk (escola_id, mes)`; `consumo_ia.pelo_provedor_de_reserva`
- [x] 2.2 — Migration própria do `consumo_ia_mes_idx`, sem `concurrently`, `lock_timeout` de 5 s; `consumo_ia_funcao_idx`, se o `EXPLAIN` o mostrar redundante, sai nela (`infra-guardian`, rodada 2)
- [x] 2.3 — `packages/shared/src/governanca/orcamento-de-ia.ts`: a precedência coluna a coluna, o teto padrão de 200%, a
  porcentagem, `situacao` e `aviso`; o mês e o "hoje" de São Paulo
- [x] 2.4 — `packages/core/src/ia/orcamento-do-mes.repository.ts`: soma do mês, alunos ativos (o trecho da aba Escolas,
  exportado para o `uso()` da 5.0), configuração, rede, leitura e regravação do retrato; o "agora" entra como parâmetro
- [x] 2.5 — Docs: glossário ("Orçamento de IA" sem corte, os três termos novos), modelo de dados (por que o retrato não
  tem `anoLetivoId`), a linha do orçamento em `docs/lgpd.md`, `classificacao.ts` (`sem_pessoa`)
- [x] 2.6 — `IA_ORCAMENTO_ESGOTADO` em `packages/shared/src/errors/`, para a 4.0 não tocar o `shared`
- [x] 2.7 — `docs/runbook.md`, "Voltar o código depois da camada-ia 2.0"
- [x] 2.8 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/drizzle/0066_orcamento_de_ia.sql`, `packages/core/drizzle/0067_indice_do_consumo_do_mes.sql`, `packages/core/drizzle/meta/_journal.json` | novo e alterado |
| `packages/core/src/db/schema/configuracao-operacional-escola.ts`, `packages/core/src/db/schema/rede.ts`, `packages/core/src/db/schema/consumo-ia.ts`, `packages/core/src/db/schema/orcamento-ia-do-mes.ts` | novo e alterado |
| `packages/shared/src/governanca/orcamento-de-ia.ts`, `packages/shared/src/governanca/orcamento-de-ia.test.ts`, `packages/shared/src/index.ts`, `packages/shared/src/privacidade/classificacao.ts` | novo e alterado |
| `packages/shared/src/errors/error-code.ts`, `packages/shared/src/errors/messages.ts` | alterado |
| `packages/core/src/ia/orcamento-do-mes.repository.ts`, `packages/core/src/ia/orcamento-do-mes.repository.int.test.ts`, `packages/core/src/index.ts` | novo e alterado |
| `apps/api/test/architecture.test.ts` | alterado |
| `docs/glossario.md`, `docs/modelo-de-dados.md`, `docs/lgpd.md`, `docs/runbook.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| escola sem valor, rede R$ 5: vale a rede, `origemDoValor = rede`; escola com R$ 3: vale 3 | U | precedência |  `orcamento-de-ia.test.ts` › escola sem valor e rede com R$ 5: vale o da rede, e a origem diz "rede"; escola com R$ 3: vale 3, "escola" |
| escola com teto próprio e sem valor: valor da rede, teto da escola | U | coluna a coluna |  `orcamento-de-ia.test.ts` › escola com teto próprio e sem valor: o valor é o da rede e o teto é o da escola; a precedência é por coluna, não por linha |
| 100 alunos, R$ 5, R$ 400: 80% | U | a conta |  `orcamento-de-ia.test.ts` › 100 alunos, R$ 5 e R$ 400 gastos: orçamento de R$ 500 e 80%, com o aviso de 80 |
| a chamada de 31/03 23h30 (UTC-3) conta em março; a de 23h30 conta no "hoje" certo (relógio falso) | I | mês e dia de São Paulo |  `orcamento-do-mes.repository.int.test.ts` › a chamada de 31/03 às 23h30 (UTC-3) conta em março e não em abril…; e `orcamento-de-ia.test.ts` › 31/03 às 23h30 (UTC-3) é de março e do dia 31… (o "hoje", com o relógio falso) |
| duas vigências no mês: a soma usa o custo gravado de cada linha | I | sem recalcular na leitura |  `orcamento-do-mes.repository.int.test.ts` › duas vigências de preço no mês: a soma usa o custo gravado de cada linha… |
| vínculo encerrado não conta; o que chegou hoje conta | I | alunos ativos |  `orcamento-do-mes.repository.int.test.ts` › o vínculo encerrado não conta, e o aluno que chegou agora conta |
| vínculo não encerrado do ano anterior não conta; sem ano `em_curso`, zero | I | ano em curso |  `orcamento-do-mes.repository.int.test.ts` › o vínculo não encerrado do ano anterior não conta; só o ano em curso vale; e › sem ano em curso (montagem), zero alunos ativos |
| aluno em duas turmas: uma vez | I | `distinct` |  `orcamento-do-mes.repository.int.test.ts` › o aluno em duas turmas do ano conta uma vez; o professor e o usuário desativado não contam |
| retrato: regravar não duplica; o fechado guarda o último, mesmo com o valor mudado | I | retrato |  `orcamento-do-mes.repository.int.test.ts` › regravar o mês corrente não duplica a linha…; › o mês fechado guarda o último retrato…; › cada mês tem o seu retrato… |
| isolamento: soma, alunos ativos, configuração (variante 1) e rede (variante 2), conferindo A e B | I | as quatro cláusulas |  `orcamento-do-mes.repository.int.test.ts` › isolamento: a soma do mês e os alunos ativos…; variante 1, a configuração da escola…; variante 2, a rede…; o retrato: B com retrato…; sem escola no contexto a leitura falha fechada… |
| `OrcamentoDoMesRepository` sem `@Unscoped` | arquitetura | exceção declarada |  `apps/api/test/architecture.test.ts` › arquitetura: o OrcamentoDoMesRepository lê pela escola do contexto e não declara exceção |
| `EXPLAIN (ANALYZE, BUFFERS)` da soma do mês, num ano da maior escola | I | o índice |  `orcamento-do-mes.plano.int.test.ts` › a soma do mês lê só o `consumo_ia_mes_idx`, sem a tabela e sem varrer a tabela inteira… |
| a `0067` tem `lock_timeout` e nenhum `concurrently` | U | a migration do índice |  `migracao-do-orcamento-de-ia.test.ts` › a 0067 é só o índice do mês, sem `concurrently`… e com `lock_timeout` de 5 s antes dele |
| os checks (valor > 0, teto 100 a 1000) | I | restrição |  `orcamento-do-mes.repository.int.test.ts` › os checks: valor maior que zero e teto de 100 a 1000, na escola, na rede e no retrato; e › o schema declara os mesmos checks que a migration criou |

## Como testar

- Isolamento com A e B: `apps/worker/test/importacao-gauge.int.test.ts` › "a importação de B não aparece na série de A…"
- `EXPLAIN`: `apps/api/test/semana-itens.int.test.ts` (`consultasDosItens`)
- Migration com check: `packages/core/src/db/migracao-classificacao.int.test.ts`
- `npx vitest run --project integracao packages/core/src/ia/orcamento-do-mes.repository.int.test.ts`

## Fora do escopo desta tarefa

As rotas (3.0, 5.0, 6.0), o teto do lote e a medida (4.0).

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas antes de codar e conferidas no fim.

1. **Mutações:** a seção "Mutações" abaixo tem um bloco por cláusula do diff (cada termo do `where` da soma e da leitura, cada linha do SQL dos alunos ativos e da rede, cada `??` e ternário do repository e da conta pura, cada check do schema), e o `--faltando` está em 0 linhas. Os checks de schema são provados pelo caso que compara o `.ts` com o banco migrado, mais o que tenta o valor fora da faixa.
2. **Texto na tela:** não se aplica, a tarefa não tem tela.
3. **Segundo dado:** o aluno em duas turmas (`distinct`), o professor e o usuário desativado no mesmo ano, o vínculo do ano anterior, duas escolas com valor, teto e rede diferentes, e dois meses com retrato próprio.
4. **Checagem anterior que responde antes:** o repository lê direto do contexto (`requireEscolaId()`), sem rota nem guarda no caminho; o teste de contexto ausente prova que a leitura falha fechada, e não soma o banco inteiro.
5. **Asserção no resultado:** os casos comparam o `OrcamentoDoMes` devolvido, e o do plano compara o `EXPLAIN` da consulta que o repository executa (`consultaDoCustoDoMes`), não um texto de arquivo; o teste da `0067` lê só os comandos, sem os comentários.
6. **Guarda nova:** o `architecture.test.ts` ganhou o describe do `@Unscoped` e confere a lista exata de métodos (método novo sem escopo reprova); não há regra de lint nova.
7. **Comentários que afirmam o que o código não faz:** reli o docblock do repository, do schema e das duas migrations contra o código; a 0067 diz que `consumo_ia_funcao_idx` fica, e o `EXPLAIN` mostra a soma pelo índice novo.
8. **Divergências:** as três abaixo não criam nem mudam regra; a coluna "Onde está na spec" aponta o trecho que as sustenta.
9. **Peça que já existe:** o trecho dos alunos ativos é uma cópia da contagem de `PainelRepository.escolas`, exportada como `alunosAtivosDaEscola` (o `PainelRepository` não foi trocado para usá-la: a 5.0 o unifica, `TODO.md`); `IA_ORCAMENTO_ESGOTADO` já existia; o relógio e o fuso seguem o de `janela-letiva`.
10. **Concorrência:** a regravação do retrato é `insert … on conflict do update` com a chave `(escola_id, mes)`, resolvida no banco; o caso "regravar não duplica" regrava duas vezes em sequência, e a corrida entre duas medidas cai na mesma chave, sem "verifica e grava".
11. **Isolamento:** cada cláusula de escopo (soma, alunos ativos, configuração, rede, retrato) tem bloco que a tira e caso com A e B que fica vermelho; a tabela "Testes que provam a regra" tem o caso em cada linha.
12. **Guardiões:** `tenancy-guardian` (escopo no repository, `orcamento_ia_do_mes` com `escola_id` na PK, a rede lida pelo `rede_id` da escola do contexto, nenhum `@Unscoped`); `privacy-guardian` (tabela sem pessoa, linha em `docs/lgpd.md`, `classificacao.ts`, o campo novo de `consumo_ia` no arquivo do titular); `infra-guardian` (migration só expande, índice em migration própria com `lock_timeout`, `include` para a soma sair do índice, `EXPLAIN` com carga de 1,8 milhão de linhas, runbook de volta do código).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| A subtarefa 2.6 já estava feita: `IA_ORCAMENTO_ESGOTADO` (código, mensagem e status 429) existe em `error-code.ts` e `messages.ts` desde antes da tarefa; só o comentário do código foi reescrito, e `messages.ts` não mudou | Mudar o que já está certo seria ruído; a 4.0 não precisa tocar o `shared` | `techspec.md` §6 (linha 97, o código que o lote devolve) |
| Dois arquivos fora de "Arquivos previstos": `packages/core/src/titular/leitura-do-titular.ts` (a coluna nova `pelo_provedor_de_reserva` de `consumo_ia` precisa de destino no arquivo do titular, e o `architecture.test.ts` reprova coluna sem destino) e `tools/guardas/tabelas-do-nucleo.mjs` (a tabela `orcamentoIaDoMes` entra na lista do núcleo) | Guardas que já existem exigem os dois; nenhuma regra muda | `techspec.md` §3 (linhas 40 e 43, a coluna e o índice) |
| Dois testes além do previsto: `orcamento-do-mes.plano.int.test.ts` (o `EXPLAIN` com 1,8 milhão de linhas sai do arquivo do repository, para ele não carregar a carga em todo caso) e `packages/core/src/db/migracao-do-orcamento-de-ia.test.ts` (a linha "a `0067` tem `lock_timeout` e nenhum `concurrently`" é unidade) | A carga do plano leva cerca de 100 s e roda isolada; a linha da tabela de testes é de unidade, sem banco | `techspec.md` §3 e §7c; a tabela "Testes que provam a regra" desta tarefa |
| `consumo_ia_funcao_idx` fica: a 2.2 só o tira se o `EXPLAIN` o mostrar redundante, e a soma por função (3.0) ainda o usa | O `EXPLAIN` da soma do mês passa pelo índice novo e nada mostra o antigo sobrando | `techspec.md` §3 (linhas 40 a 43), subtarefa 2.2 |

## Mutações

`--faltando: 0 linhas (58 blocos, 2 motivos)`

Motivos (linha ou termo sem bloco, com o porquê):

- Os dez `check(...)` dos schemas têm bloco (a linha sai) provado pelo caso `o schema declara os mesmos checks que a migration criou`, que compara o nome de cada check do `.ts` com o do banco migrado; o que cada check **recusa** é o caso `os checks: valor maior que zero e teto de 100 a 1000, na escola, na rede e no retrato`, contra o banco. Mutar o texto do `sql` de um check no `.ts` não muda o banco (quem o cria é a `0066`), por isso o bloco tira a linha inteira, e não o operador.
- As migrations `0066` e `0067` e o `index('consumo_ia_mes_idx')` do schema: SQL de migration e declaração de índice, sem cláusula de produto a mutar (o banco do teste já vem migrado, e mutar o arquivo não muda o que ele tem). A definição do índice (com o `include`) é provada por `orcamento-do-mes.plano.int.test.ts` e por `migracao-do-orcamento-de-ia.test.ts`; o uso, pelo `EXPLAIN` do mesmo caso.

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › o vínculo não encerrado do ano anterior não conta
-    join ano_letivo as ano on ano.escola_id = v.escola_id and ano.id = v.ano_letivo_id and ano.situacao = 'em_curso'
+    join ano_letivo as ano on ano.escola_id = v.escola_id and ano.id = v.ano_letivo_id
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › o vínculo não encerrado do ano anterior não conta
-    join ano_letivo as ano on ano.escola_id = v.escola_id and ano.id = v.ano_letivo_id and ano.situacao = 'em_curso'
+    join ano_letivo as ano on ano.escola_id = v.escola_id and ano.situacao = 'em_curso'
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › a soma do mês e os alunos ativos: A gastou
-    where v.escola_id = ${escolaId} and v.papel = 'aluno' and v.encerrado_em is null and pessoa.desativado_em is null)`
+    where v.papel = 'aluno' and v.encerrado_em is null and pessoa.desativado_em is null)`
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › o aluno em duas turmas do ano conta uma vez; o professor
-    where v.escola_id = ${escolaId} and v.papel = 'aluno' and v.encerrado_em is null and pessoa.desativado_em is null)`
+    where v.escola_id = ${escolaId} and v.encerrado_em is null and pessoa.desativado_em is null)`
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › o vínculo encerrado não conta, e o aluno que chegou agora conta
-    where v.escola_id = ${escolaId} and v.papel = 'aluno' and v.encerrado_em is null and pessoa.desativado_em is null)`
+    where v.escola_id = ${escolaId} and v.papel = 'aluno' and pessoa.desativado_em is null)`
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › o aluno em duas turmas do ano conta uma vez; o professor
-    where v.escola_id = ${escolaId} and v.papel = 'aluno' and v.encerrado_em is null and pessoa.desativado_em is null)`
+    where v.escola_id = ${escolaId} and v.papel = 'aluno' and v.encerrado_em is null)`
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › o aluno em duas turmas do ano conta uma vez; o professor
-    join usuario as pessoa on pessoa.escola_id = v.escola_id and pessoa.id = v.usuario_id
+    join usuario as pessoa on pessoa.escola_id = v.escola_id
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › o aluno em duas turmas do ano conta uma vez; o professor
-  return sql`(select count(distinct v.usuario_id)::int
+  return sql`(select count(v.usuario_id)::int
     from vinculo as v
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › a soma do mês e os alunos ativos: A gastou
       .where(
         and(
-          eq(consumoIa.escolaId, requireEscolaId()),
           gte(consumoIa.em, sql`(${inicio}::date)::timestamp at time zone ${FUSO_DO_ORCAMENTO}`),
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › a chamada de 31/03 às 23h30
           eq(consumoIa.escolaId, requireEscolaId()),
-          gte(consumoIa.em, sql`(${inicio}::date)::timestamp at time zone ${FUSO_DO_ORCAMENTO}`),
           lt(consumoIa.em, sql`((${inicio}::date + interval '1 month')::timestamp at time zone ${FUSO_DO_ORCAMENTO})`),
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › a chamada de 31/03 às 23h30
           gte(consumoIa.em, sql`(${inicio}::date)::timestamp at time zone ${FUSO_DO_ORCAMENTO}`),
-          lt(consumoIa.em, sql`((${inicio}::date + interval '1 month')::timestamp at time zone ${FUSO_DO_ORCAMENTO})`),
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › a chamada de 31/03 às 23h30
-          gte(consumoIa.em, sql`(${inicio}::date)::timestamp at time zone ${FUSO_DO_ORCAMENTO}`),
+          gte(consumoIa.em, sql`(${inicio}::date)::timestamp at time zone 'UTC'`),
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › a chamada de 31/03 às 23h30
-          lt(consumoIa.em, sql`((${inicio}::date + interval '1 month')::timestamp at time zone ${FUSO_DO_ORCAMENTO})`),
+          lt(consumoIa.em, sql`((${inicio}::date + interval '1 month')::timestamp at time zone 'UTC')`),
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › lê o que cada uma define, nulo onde não definiu
-    return { valorPorAlunoMicros: linha?.valorPorAlunoMicros ?? null, tetoPercentual: linha?.tetoPercentual ?? null }
+    return { valorPorAlunoMicros: linha?.valorPorAlunoMicros ?? 0, tetoPercentual: linha?.tetoPercentual ?? null }
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › lê o que cada uma define, nulo onde não definiu
-    return { valorPorAlunoMicros: linha?.valorPorAlunoMicros ?? null, tetoPercentual: linha?.tetoPercentual ?? null }
+    return { valorPorAlunoMicros: linha?.valorPorAlunoMicros ?? null, tetoPercentual: linha?.tetoPercentual ?? 0 }
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › variante 1, a configuração da escola
       .from(configuracaoOperacionalEscola)
-      .where(eq(configuracaoOperacionalEscola.escolaId, requireEscolaId()))
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › variante 2, a rede
-      where e.id = ${requireEscolaId()}::uuid`)
+      where true`)
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › variante 2, a rede
-      from escola as e join rede as r on r.id = e.rede_id
+      from escola as e join rede as r on true
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › variante 2, a rede
-    return { valorPorAlunoMicros: linha?.valorPorAlunoMicros == null ? null : Number(linha.valorPorAlunoMicros), tetoPercentual: linha?.tetoPercentual ?? null }
+    return { valorPorAlunoMicros: linha?.valorPorAlunoMicros == null ? null : linha.valorPorAlunoMicros as unknown as number, tetoPercentual: linha?.tetoPercentual ?? null }
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › lê o que cada uma define, nulo onde não definiu
-    return { valorPorAlunoMicros: linha?.valorPorAlunoMicros == null ? null : Number(linha.valorPorAlunoMicros), tetoPercentual: linha?.tetoPercentual ?? null }
+    return { valorPorAlunoMicros: Number(linha?.valorPorAlunoMicros), tetoPercentual: linha?.tetoPercentual ?? null }
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › lê o que cada uma define, nulo onde não definiu
-    return { valorPorAlunoMicros: linha?.valorPorAlunoMicros == null ? null : Number(linha.valorPorAlunoMicros), tetoPercentual: linha?.tetoPercentual ?? null }
+    return { valorPorAlunoMicros: linha?.valorPorAlunoMicros == null ? null : Number(linha.valorPorAlunoMicros), tetoPercentual: linha?.tetoPercentual ?? 0 }
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › o retrato: B com retrato num mês em que A não tem
falha: toBeUndefined()
-      .where(and(eq(orcamentoIaDoMes.escolaId, requireEscolaId()), eq(orcamentoIaDoMes.mes, primeiroDiaDoMes(mes))))
+      .where(eq(orcamentoIaDoMes.mes, primeiroDiaDoMes(mes)))
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › cada mês tem o seu retrato
-      .where(and(eq(orcamentoIaDoMes.escolaId, requireEscolaId()), eq(orcamentoIaDoMes.mes, primeiroDiaDoMes(mes))))
+      .where(eq(orcamentoIaDoMes.escolaId, requireEscolaId()))
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › o mês fechado guarda o último retrato
-    if (mes === mesDeSaoPaulo(agora)) return orcamentoDoMes(await this.retratoDeHoje(), custoMicros, true)
+    if (mes !== mesDeSaoPaulo(agora)) return orcamentoDoMes(await this.retratoDeHoje(), custoMicros, true)
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › o mês fechado guarda o último retrato
-    return retrato === undefined ? orcamentoSemRetrato(custoMicros) : orcamentoDoMes(retrato, custoMicros, false)
+    return orcamentoSemRetrato(custoMicros)
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › o mês fechado guarda o último retrato
-    return retrato === undefined ? orcamentoSemRetrato(custoMicros) : orcamentoDoMes(retrato, custoMicros, false)
+    return retrato === undefined ? orcamentoSemRetrato(custoMicros) : orcamentoDoMes(retrato, custoMicros, true)
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › regravar o mês corrente não duplica a linha
-      .onConflictDoUpdate({ target: [orcamentoIaDoMes.escolaId, orcamentoIaDoMes.mes], set: { ...retrato, atualizadoEm: agora } })
+      .onConflictDoNothing()
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › regravar o mês corrente não duplica a linha
-      .onConflictDoUpdate({ target: [orcamentoIaDoMes.escolaId, orcamentoIaDoMes.mes], set: { ...retrato, atualizadoEm: agora } })
+      .onConflictDoUpdate({ target: [orcamentoIaDoMes.escolaId, orcamentoIaDoMes.mes], set: { ...retrato } })
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › regravar o mês corrente não duplica a linha
-      .values({ escolaId: requireEscolaId(), mes: primeiroDiaDoMes(mes), ...retrato, atualizadoEm: agora })
+      .values({ escolaId: requireEscolaId(), mes: primeiroDiaDoMes(mes), ...retrato })
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › regravar o mês corrente não duplica a linha
   async regravarRetrato(agora: Date): Promise<OrcamentoDoMes> {
-    const mes = mesDeSaoPaulo(agora)
+    const mes = agora.toISOString().slice(0, 7)
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › a chamada de 31/03 às 23h30
-    return Number(linha?.total ?? 0)
+    return Number(linha?.total ?? 1)
```

```mutacao
arquivo: packages/core/src/db/schema/configuracao-operacional-escola.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › o schema declara os mesmos checks
-    check('configuracao_operacional_ia_valor_positivo', sql`${tabela.iaValorPorAlunoMicros} > 0`),
```

```mutacao
arquivo: packages/core/src/db/schema/configuracao-operacional-escola.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › o schema declara os mesmos checks
-    check('configuracao_operacional_ia_teto_valido', sql`${tabela.iaTetoDeSegurancaPercentual} between 100 and 1000`),
```

```mutacao
arquivo: packages/core/src/db/schema/rede.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › o schema declara os mesmos checks
-    check('rede_ia_valor_positivo', sql`${tabela.iaValorPorAlunoMicros} > 0`),
```

```mutacao
arquivo: packages/core/src/db/schema/rede.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › o schema declara os mesmos checks
-    check('rede_ia_teto_valido', sql`${tabela.iaTetoDeSegurancaPercentual} between 100 and 1000`),
```

```mutacao
arquivo: packages/core/src/db/schema/orcamento-ia-do-mes.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › o schema declara os mesmos checks
-    check('orcamento_ia_do_mes_mes_e_dia_1', sql`extract(day from ${tabela.mes}) = 1`),
```

```mutacao
arquivo: packages/core/src/db/schema/orcamento-ia-do-mes.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › o schema declara os mesmos checks
-    check('orcamento_ia_do_mes_alunos_nao_negativo', sql`${tabela.alunosAtivos} >= 0`),
```

```mutacao
arquivo: packages/core/src/db/schema/orcamento-ia-do-mes.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › o schema declara os mesmos checks
-    check('orcamento_ia_do_mes_valor_positivo', sql`${tabela.valorPorAlunoMicros} > 0`),
```

```mutacao
arquivo: packages/core/src/db/schema/orcamento-ia-do-mes.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › o schema declara os mesmos checks
-    check('orcamento_ia_do_mes_teto_valido', sql`${tabela.tetoPercentual} between 100 and 1000`),
```

```mutacao
arquivo: packages/core/src/db/schema/orcamento-ia-do-mes.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › o schema declara os mesmos checks
-    check('orcamento_ia_do_mes_origem_valida', sql`${tabela.origemDoValor} in ('escola', 'rede', 'nenhuma')`),
```

```mutacao
arquivo: packages/core/src/db/schema/orcamento-ia-do-mes.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › o schema declara os mesmos checks
-    check('orcamento_ia_do_mes_origem_diz_o_valor', sql`(${tabela.origemDoValor} = 'nenhuma') = (${tabela.valorPorAlunoMicros} is null)`),
```

```mutacao
arquivo: packages/shared/src/governanca/orcamento-de-ia.ts
teste: packages/shared/src/governanca/orcamento-de-ia.test.ts › escola sem valor e rede com R
-  const valorPorAlunoMicros = escola.valorPorAlunoMicros ?? rede.valorPorAlunoMicros
+  const valorPorAlunoMicros = rede.valorPorAlunoMicros ?? escola.valorPorAlunoMicros
```

```mutacao
arquivo: packages/shared/src/governanca/orcamento-de-ia.ts
teste: packages/shared/src/governanca/orcamento-de-ia.test.ts › nada na escola nem na rede
-  const tetoPercentual = escola.tetoPercentual ?? rede.tetoPercentual ?? TETO_PADRAO_PERCENTUAL
+  const tetoPercentual = escola.tetoPercentual ?? rede.tetoPercentual
```

```mutacao
arquivo: packages/shared/src/governanca/orcamento-de-ia.ts
teste: packages/shared/src/governanca/orcamento-de-ia.test.ts › escola com teto próprio e sem valor
-  const tetoPercentual = escola.tetoPercentual ?? rede.tetoPercentual ?? TETO_PADRAO_PERCENTUAL
+  const tetoPercentual = escola.tetoPercentual ?? TETO_PADRAO_PERCENTUAL
```

```mutacao
arquivo: packages/shared/src/governanca/orcamento-de-ia.ts
teste: packages/shared/src/governanca/orcamento-de-ia.test.ts › escola com teto próprio e sem valor
-  const tetoPercentual = escola.tetoPercentual ?? rede.tetoPercentual ?? TETO_PADRAO_PERCENTUAL
+  const tetoPercentual = rede.tetoPercentual ?? escola.tetoPercentual ?? TETO_PADRAO_PERCENTUAL
```

```mutacao
arquivo: packages/shared/src/governanca/orcamento-de-ia.ts
teste: packages/shared/src/governanca/orcamento-de-ia.test.ts › escola sem valor e rede com R
-    origemDoValor: escola.valorPorAlunoMicros !== null ? 'escola' : rede.valorPorAlunoMicros !== null ? 'rede' : 'nenhuma',
+    origemDoValor: rede.valorPorAlunoMicros !== null ? 'rede' : 'nenhuma',
```

```mutacao
arquivo: packages/shared/src/governanca/orcamento-de-ia.ts
teste: packages/shared/src/governanca/orcamento-de-ia.test.ts › nada na escola nem na rede
-    origemDoValor: escola.valorPorAlunoMicros !== null ? 'escola' : rede.valorPorAlunoMicros !== null ? 'rede' : 'nenhuma',
+    origemDoValor: escola.valorPorAlunoMicros !== null ? 'escola' : 'rede',
```

```mutacao
arquivo: packages/shared/src/governanca/orcamento-de-ia.ts
teste: packages/shared/src/governanca/orcamento-de-ia.test.ts › escola com teto próprio e sem valor
-    origemDoTeto: escola.tetoPercentual !== null ? 'escola' : rede.tetoPercentual !== null ? 'rede' : 'padrao',
+    origemDoTeto: rede.tetoPercentual !== null ? 'rede' : 'padrao',
```

```mutacao
arquivo: packages/shared/src/governanca/orcamento-de-ia.ts
teste: packages/shared/src/governanca/orcamento-de-ia.test.ts › nada na escola nem na rede
-    origemDoTeto: escola.tetoPercentual !== null ? 'escola' : rede.tetoPercentual !== null ? 'rede' : 'padrao',
+    origemDoTeto: escola.tetoPercentual !== null ? 'escola' : 'rede',
```

```mutacao
arquivo: packages/shared/src/governanca/orcamento-de-ia.ts
teste: packages/shared/src/governanca/orcamento-de-ia.test.ts › a porcentagem é arredondada para baixo
-  if (porcentagem >= 100) return 100
+  if (porcentagem > 100) return 100
```

```mutacao
arquivo: packages/shared/src/governanca/orcamento-de-ia.ts
teste: packages/shared/src/governanca/orcamento-de-ia.test.ts › a porcentagem é arredondada para baixo
-  return porcentagem >= 80 ? 80 : null
+  return porcentagem > 80 ? 80 : null
```

```mutacao
arquivo: packages/shared/src/governanca/orcamento-de-ia.ts
teste: packages/shared/src/governanca/orcamento-de-ia.test.ts › a porcentagem é arredondada para baixo
-  return Math.floor((custoMicros * 100) / orcamentoMicros)
+  return Math.round((custoMicros * 100) / orcamentoMicros)
```

```mutacao
arquivo: packages/shared/src/governanca/orcamento-de-ia.ts
teste: packages/shared/src/governanca/orcamento-de-ia.test.ts › sem valor: "sem_orcamento"
-  if (valorPorAlunoMicros === null) return { ...base, situacao: 'sem_orcamento', orcamentoMicros: null, porcentagem: null, aviso: null }
```

```mutacao
arquivo: packages/shared/src/governanca/orcamento-de-ia.ts
teste: packages/shared/src/governanca/orcamento-de-ia.test.ts › sem valor: "sem_orcamento"
-  if (alunosAtivos === 0) return { ...base, situacao: 'sem_aluno_ativo', orcamentoMicros: null, porcentagem: null, aviso: null }
```

```mutacao
arquivo: packages/shared/src/governanca/orcamento-de-ia.ts
teste: packages/shared/src/governanca/orcamento-de-ia.test.ts › o mês fechado a 120%
-  return { ...base, situacao: 'definido', orcamentoMicros, porcentagem, aviso: mesCorrente ? avisoDaPorcentagem(porcentagem) : null }
+  return { ...base, situacao: 'definido', orcamentoMicros, porcentagem, aviso: avisoDaPorcentagem(porcentagem) }
```

```mutacao
arquivo: packages/shared/src/governanca/orcamento-de-ia.ts
teste: packages/shared/src/governanca/orcamento-de-ia.test.ts › 100 alunos, R
-  const orcamentoMicros = valorPorAlunoMicros * alunosAtivos
+  const orcamentoMicros = valorPorAlunoMicros
```

```mutacao
arquivo: packages/shared/src/governanca/orcamento-de-ia.ts
teste: packages/shared/src/governanca/orcamento-de-ia.test.ts › 31/03 às 23h30
-export const FUSO_DO_ORCAMENTO = 'America/Sao_Paulo'
+export const FUSO_DO_ORCAMENTO = 'UTC'
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › variante 2, a rede
-      select r.ia_valor_por_aluno_micros as "valorPorAlunoMicros", r.ia_teto_de_seguranca_percentual as "tetoPercentual"
+      select r.ia_valor_por_aluno_micros as "valorPorAlunoMicros", r.ia_valor_por_aluno_micros as "tetoPercentual"
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª), infra-guardian (1ª), revisor-geral (1ª) | `PainelRepository.pessoasComVinculo` (`apps/api/src/operacao/painel/painel.repository.ts:102`) continua com cópia própria da contagem de alunos ativos, sem o `encerrado_em is null`; unificar com `alunosAtivosDaEscola` (RF8: o mesmo número na tela e no orçamento) | TODO.md, dono a 5.0, que já altera `painel.repository.ts`. Troca o número que a aba Escolas mostra e o arquivo está fora da tarefa: muda comportamento |
| privacy-guardian (1ª) | `pelo_provedor_de_reserva` na linha 99 de `docs/lgpd.md`, e o teste de que `provedor` guarda o id da reserva | TODO.md, dono a 10.0 (10.4), que é a que grava a coluna como verdadeira; a 11.4 já prevê a linha |
| privacy-guardian (1ª) | `OrcamentoDoMes` traz reais; DTO de saída por papel, sem devolver o tipo inteiro à coordenação (D40) | TODO.md, dono a 3.0 e a 5.0, que criam as rotas |
| privacy-guardian (1ª) | Na revisão da 3.0, conferir que a auditoria de mudança de valor e de teto existe de fato | TODO.md, dono a 3.0 |
| conformidade-reviewer (1ª) | Na 4.0: o teto que segura o lote não pode transformar a correção de objetiva em nota, que fica pendente de aprovação humana (D33, D56), nem adiar a vista da avaliação sem o professor ser avisado | TODO.md, dono a 4.0 |
| revisor-geral (1ª) | `diaDeSaoPaulo` e `FUSO_DO_ORCAMENTO` (`packages/shared/src/governanca/orcamento-de-ia.ts`) repetem `diaDeUso` e `FUSO_DO_USO` (`packages/core/src/usage/usage-day.ts`) | TODO.md, dono a tarefa que tocar `usage-day.ts`: o arquivo está fora da tarefa e a mudança passa pelo `core` inteiro |
| revisor-geral (1ª) | Linha 74 do repository: `rows[0]?.total ?? 0` no lugar de `rows.reduce(...)` | Recusada: o `select` sem `from` sempre devolve uma linha, então o `?? 0` seria ramo que nenhum teste alcança, e o portão pede mutação vermelha para cada `??` (regra 40, RF17) |
| test-engineer (1ª) | `orcamento-do-mes.plano.int.test.ts` soma cerca de 100 s ao projeto `integracao` em toda esteira; levá-lo ao projeto de infra, ou rodá-lo só quando o índice ou a consulta mudarem | TODO.md, dono o Orquestrador, na próxima medida da esteira: mexe na configuração da esteira, fora desta tarefa |
| test-engineer (1ª) | Garantir que a 4.0 entregue o caso da corrida com `esperarNaTrava` | TODO.md, dono a 4.0 (a corrida em si fica provada aqui, item 4) |
| infra-guardian (1ª) | `alunosAtivosDaEscola` vs `pessoasComVinculo` | o mesmo item da primeira linha |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-21 03:31:25 | 2026-11-21 03:32:02 | `conformidade-reviewer` | 1 | APROVADO | a226c16d73b24ef3d |
| 2026-11-21 03:31:08 | 2026-11-21 03:32:05 | `tenancy-guardian` | 1 | APROVADO | a04349c5cb67a20d4 |
| 2026-11-21 03:31:15 | 2026-11-21 03:32:35 | `infra-guardian` | 1 | APROVADO | a89a57db174f11b04 |
| 2026-11-21 03:31:11 | 2026-11-21 03:32:38 | `privacy-guardian` | 1 | APROVADO | a044ce58773120d0e |
| 2026-11-21 03:31:18 | 2026-11-21 03:33:17 | `test-engineer` | 1 | APROVADO | a7276981f1e43d486 |
| 2026-11-21 03:31:21 | 2026-11-21 03:33:45 | `revisor-geral` | 1 | APROVADO | ab02c82691405bf84 |
| 2026-11-21 03:49:05 | 2026-11-21 03:49:24 | `tenancy-guardian` | 2 | APROVADO | a9e8da8cf58801379 |
| 2026-11-21 03:49:11 | 2026-11-21 03:49:30 | `privacy-guardian` | 2 | APROVADO | a23323d65fa47f592 |
| 2026-11-21 03:49:17 | 2026-11-21 03:49:36 | `infra-guardian` | 2 | APROVADO | a8b06b01186b48a00 |
| 2026-11-21 03:49:28 | 2026-11-21 03:49:51 | `revisor-geral` | 2 | APROVADO | aad8a72520ea5826d |
| 2026-11-21 03:49:34 | 2026-11-21 03:49:51 | `conformidade-reviewer` | 2 | APROVADO | a26b2adc2837c92d8 |
| 2026-11-21 03:49:22 | 2026-11-21 03:50:11 | `test-engineer` | 2 | APROVADO | ac2e8d60a7ca3f38a |
