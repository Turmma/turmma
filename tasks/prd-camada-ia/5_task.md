# Tarefa 5.0 — A Operação lê o uso de IA de cada escola, no dia, no mês e nos 12 meses anteriores

**Funcionalidade:** camada-ia · **Depende de:** 3.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`
**Porte:** grande

## Objetivo

`GET /v1/operacao/uso` traz, por escola, o grupo `ia` de hoje e do mês, com custo por aluno, porcentagem e o que a reserva
atendeu, e ordena por custo; `GET …/escolas/:id/uso-ia` devolve os 12 meses anteriores pelo retrato. Nenhum campo de pessoa.

## Contexto necessário

- `techspec.md` §4 (as duas primeiras linhas e o parágrafo de `situacao`), §6, §7c (`EXPLAIN` do `uso()` por custo e dos 12 meses)
- `prd.md` RF11, §4 (o operador não vê pessoa), §7 ("Escola sem aluno ativo", "Escola sem valor")
- `cenarios.md` §1 RF11 (as quatro primeiras), §2 ("Operação", "Meses, retrato", "Meses, consumo")
- `.claude/rules/` 10 (itens 8 e 9), 20 (item 4), 80
- Código: `apps/api/src/operacao/painel/painel.repository.ts` › `uso()` (o terceiro `@Unscoped` do I1),
  `packages/shared/src/operacao/painel.ts` (`ORDENS_DO_PAINEL`, o schema do uso), `apps/api/test/registered-routes.ts`

## Subtarefas

- [x] 5.1 — `ORDENS_DO_PAINEL` ganha `custo`, ou o uso ganha schema próprio de ordem, sem dar `custo` à aba Escolas
- [x] 5.2 — `uso()` monta a soma e os alunos com os trechos exportados do `OrcamentoDoMesRepository` (2.0); o "agora" entra como parâmetro
- [x] 5.3 — `GET …/escolas/:id/uso-ia` em `runInContext` de `:id`, lendo o retrato; mês sem retrato `sem_retrato`
- [x] 5.4 — Contrato estrito em `packages/shared` e em `apps/api/test/contracts.test.ts`; a rota em `ROTAS_DO_PAINEL`
- [x] 5.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/operacao/painel/painel.repository.ts`, `apps/api/src/operacao/painel/painel.service.ts`, `apps/api/src/operacao/painel/painel.controller.ts` | alterado |
| `packages/shared/src/operacao/painel.ts`, `packages/shared/src/operacao/painel.test.ts` | alterado |
| `apps/api/test/painel-leitura.int.test.ts`, `apps/api/test/contracts.test.ts`, `apps/api/test/registered-routes.ts` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| contrato estrito, sem campo de pessoa | U, I | RF11 | `apps/api/test/painel-leitura.int.test.ts` › GET /uso aceita `ordem=custo`… e › GET /escolas/:id/uso-ia: 12 meses… (a resposta real da rota passa pelo schema estrito); `apps/api/test/contracts.test.ts` › camada-ia 5.0: `GET /v1/operacao/uso` traz o grupo `ia` só com número…; `packages/shared/src/operacao/painel.test.ts` › a resposta do uso é estrita: id, nome, dia e mês com as três medidas, o grupo `ia`…; › o uso de IA dos 12 meses anteriores de uma escola (camada-ia, 5.0) › o mês sem retrato leva só o consumo… |
| `ordem=custo`: a de maior custo do mês primeiro | I | a ordem | `apps/api/test/painel-leitura.int.test.ts` › a ordem por custo põe a de maior custo do mês primeiro, mesmo com o id maior… |
| `ordem=custo` em `/escolas`: `ENTRADA_INVALIDA` | U, I | custo só no uso | `packages/shared/src/operacao/painel.test.ts` › a consulta do uso aceita também a ordem `custo`, e a da lista não…; `apps/api/test/painel-leitura.int.test.ts` › GET /uso aceita `ordem=custo` e GET /escolas a recusa com `ENTRADA_INVALIDA` |
| `chamadasPeloProvedorDeReserva` conta linhas; `execucoes` conta execuções | I | as duas contagens | `apps/api/test/painel-leitura.int.test.ts` › `chamadasPeloProvedorDeReserva` conta linhas e `execucoes` conta execuções… |
| sem ano em curso: `sem_aluno_ativo`, porcentagem nula, reais visíveis | I | sem divisão por zero | `apps/api/test/painel-leitura.int.test.ts` › sem ano em curso: `sem_aluno_ativo`, sem porcentagem e com os reais à vista… |
| sem valor nem na rede: `sem_orcamento`, `origemDoValor = nenhuma` | I | a precedência na leitura | `apps/api/test/painel-leitura.int.test.ts` › sem valor nem na rede: `sem_orcamento`, origem `nenhuma` e porcentagem nula… |
| A e B da `cenarios.md` §2: A 20% e 100 alunos, B 111% e 900 | I | cada linha da sua escola | `apps/api/test/painel-leitura.int.test.ts` › A e B da §2: a linha de A traz 20% e 100 alunos, a de B 111% e 900… |
| a chamada de A às 23h30 do último dia conta no mês; vínculo do ano anterior não; aluno em duas turmas, uma vez | I | os trechos do repository | `apps/api/test/painel-leitura.int.test.ts` › A e B da §2… (a de 23h30, a de março e a de maio); › os alunos ativos da linha são os da aba Escolas… |
| relógio falso, não o `now()` do Postgres | I | o "agora" como parâmetro | `apps/api/test/painel-leitura.int.test.ts` › o relógio é o do serviço, não o `now()` do Postgres… |
| 12 meses, cada um do seu retrato; B com retrato num mês em que A não tem: A `sem_retrato`, 12 itens | I | escopo do retrato | `apps/api/test/painel-leitura.int.test.ts` › os 12 meses de A, cada um do seu retrato, com B com retrato num mês em que A não tem… |
| B com consumo nos mesmos meses: os de A só com o custo de A | I | escopo da soma | `apps/api/test/painel-leitura.int.test.ts` › os 12 meses de A, cada um do seu retrato… (o consumo de B em março, fevereiro e janeiro) |
| retrato com zero aluno: `sem_aluno_ativo`; id inexistente: `NAO_ENCONTRADO` | I | regra 10.6 | `apps/api/test/painel-leitura.int.test.ts` › os 12 meses de A… (janeiro, com zero aluno); › GET /escolas/:id/uso-ia: 12 meses, do anterior ao corrente para trás… |
| `EXPLAIN (ANALYZE, BUFFERS)` do `uso()` por custo e dos 12 meses, num ano da maior escola | I | o índice | `apps/api/test/painel-uso-ia.plano.int.test.ts` › `uso()` por custo: a soma do mês de cada escola…; › os 12 meses da maior escola: uma consulta só… |
| coordenação, professor e aluno em `…/uso-ia`: 404 com o corpo do inexistente | I | `ROTAS_DO_PAINEL` | `apps/api/test/operacao-isolamento.int.test.ts` › sessão de coordenador, professor e aluno, desafio, cookie de escola e nenhuma credencial: toda rota @RotaDeOperacao responde igual a rota inexistente (a rota entra por `ROTAS_DO_PAINEL`); `apps/api/test/architecture.test.ts` › toda rota @RotaDeOperacao registrada tem a guarda |

## Como testar

- Uso por escola: `apps/api/test/painel-leitura.int.test.ts` › "duas escolas com uso diferente no dia e no mês; a de mais
  requisições no mês vem antes…" e › "a ordem por uso conta o mesmo período…"
- `EXPLAIN` com o `.toSQL()`: `apps/api/test/semana-itens.int.test.ts`
- Fixture: `apps/api/test/painel.fixture.ts`
- `npx vitest run --project integracao apps/api/test/painel-leitura.int.test.ts`
- Armadilha: o I1 de `architecture.test.ts` fixa três `@Unscoped` no `PainelRepository`; não abra um quarto

## Fora do escopo desta tarefa

A tela (8.0); o retrato é gravado pela medida (4.0).

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas antes de codar e conferidas no fim.

1. **Mutações:** a seção "Mutações" abaixo tem um bloco por cláusula do diff: a chave da ordem por custo (o ramo, o `desc`, o mês de `agora`), cada lateral de IA do `uso()` (o `escola_id`, o dia e o mês de `agora`, a coluna de cada período, os alunos, o valor da escola e o da rede), cada coluna de `COLUNAS_DO_USO_DE_IA`, a soma do mês por escola, cada cláusula da consulta dos 12 meses (a escola, o início e o fim da faixa, o fuso do mês, a existência da escola, o retrato por escola, o mês vazio, o ternário do retrato, o `indice + 1` dos meses), o serviço (a precedência da rede, o `NAO_ENCONTRADO`, o relógio dos dois métodos), o controller (o esquema da consulta, o `IdPipe` e a guarda da rota nova) e o `shared` (a ordem `custo`, o `.length(12)`, o mês `AAAA-MM`, o `strictObject`, a situação sem `sem_retrato` no corrente); o `--faltando` está em 0 linhas.
2. **Texto na tela:** não se aplica, a tarefa não tem tela (a 8.0 consome estes contratos).
3. **Segundo dado:** A e B da `cenarios.md` §2 (valor, teto e rede diferentes, B com retrato num mês em que A não tem e consumo de B nos mesmos meses), o aluno em duas turmas, o vínculo não encerrado do ano anterior, a escola sem ano em curso, a rede com valor e a escola sem, as chamadas de março, de abril e de maio e a de 23h30 do último dia, e a reserva com execução de uma e de duas linhas.
4. **Checagem anterior que responde antes:** o `@OperacaoRoute()` e o `IdPipe` respondem 404 antes do service, e quem tira a guarda é pego pela varredura de `operacao-isolamento.int.test.ts`; no repository, a existência da escola é a primeira leitura dos 12 meses e responde `undefined` antes de qualquer soma, então a asserção de `NAO_ENCONTRADO` cai nela.
5. **Asserção no resultado:** os casos comparam o item devolvido (`toStrictEqual` no grupo `ia`, nos 12 meses e no `UsoDeIaDoMes`); o `EXPLAIN` é o da consulta que o repository executa (`usoDaPaginaSql`, `consultaDoUsoDosMeses`), e não de texto de arquivo; o contrato lê a resposta real da rota.
6. **Guarda nova:** nenhuma; o I1 segue com três `@Unscoped` no `PainelRepository`, e o `architecture.test.ts` ganhou só a rota nova (11) e o método novo na lista fechada do `OrcamentoDoMesRepository`.
7. **Comentários que afirmam o que o código não faz:** reli os docblocks de `faixaDoMes`, `faixaDoDia`, `custoDaEscolaNoMes`, `COLUNAS_DO_USO_DE_IA`, `usoDosMesesAnteriores`, `usoDaPaginaSql`, do service e do controller contra o código; o plano dos 12 meses diz que o índice cobre a consulta quando a varredura da tabela é proibida, porque a maior escola é 91% das linhas do banco do teste e o planejador escolhe a varredura paralela (cerca de 0,9 s).
8. **Divergências:** as quatro abaixo não criam nem mudam regra; a coluna "Onde está na spec" aponta o trecho que as sustenta, e a `techspec.md` e o `cenarios.md` ganharam a linha da `ordem=custo` só no uso e da consulta dos 12 meses.
9. **Peça que já existe:** o `uso()` usa os trechos exportados do `OrcamentoDoMesRepository` (`faixaDoMes`, `faixaDoDia`, `custoDaEscolaNoMes`, `COLUNAS_DO_USO_DE_IA`, `alunosAtivosDaEscola`), `orcamentoVigente` e `orcamentoDoMes` do `shared`, o `referenciaDoUso` e o relógio do serviço; a aba Escolas passou a contar os alunos por `alunosAtivosDaEscola` (o item do `TODO.md` da 2.0).
10. **Concorrência:** a tarefa só lê; não há escrita nem trava. A leitura dos 12 meses são duas consultas sem transação (o consumo e o retrato), e o retrato do mês fechado não muda depois de gravado, então a diferença de instante entre elas não troca número.
11. **Isolamento:** cada cláusula de escopo (as duas laterais do `uso()`, a soma por escola da ordem, o consumo e o retrato dos 12 meses, a existência da escola) tem bloco e caso com A e B que fica vermelho; as rotas de coordenação, professor e aluno em `…/uso-ia` entram na varredura de `ROTAS_DO_PAINEL`.
12. **Guardiões:** `tenancy-guardian` (o `uso()` segue o terceiro `@Unscoped`, com a justificativa reescrita; o `e.id` é o único argumento de escopo que entra no SQL de `custoDaEscolaNoMes`; os 12 meses não têm `@Unscoped` e partem do `requireEscolaId()`); `privacy-guardian` (só número: o contrato estrito e o caso de `contracts.test.ts` proíbem `alunoId`, `usuarioId`, `nome`, `funcao`, `modelo`, `provedorId`, `aviso` e `teto`; a rota não audita nem loga); `infra-guardian` (a ordem por custo soma o mês de todas as escolas antes de cortar a página, no `consumo_ia_mes_idx` sem a tabela, e o `EXPLAIN` com um ano da maior escola prova os dois planos).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| Dois arquivos de `packages/core` fora de "Arquivos previstos": `orcamento-do-mes.repository.ts` ganha `faixaDoMes`, `faixaDoDia`, `custoDaEscolaNoMes`, `COLUNAS_DO_USO_DE_IA`, `usoDeIaLido`, `consultaDoUsoDosMeses` e `usoDosMesesAnteriores`, e `index.ts` os exporta | A subtarefa 5.2 manda o `uso()` montar a soma e os alunos "com os trechos exportados do `OrcamentoDoMesRepository`", e a 5.3 lê os 12 meses pelo retrato, que só o repository do orçamento conhece; o `@Unscoped` do `PainelRepository` não pode ganhar um quarto método, e os meses não são consulta entre escolas | `techspec.md` §4 (o parágrafo do uso) e §6 (os meses rodam no contexto da escola `:id`, sem `@Unscoped`); `cenarios.md` §2 "Meses, retrato" e "Meses, consumo" |
| `packages/shared/src/index.ts`, `apps/api/test/architecture.test.ts`, `apps/web/src/operacao/__fixtures__/render-operacao-screen.tsx` e `apps/web/src/operacao/api/painel.test.ts` fora de "Arquivos previstos" | O `shared/index.ts` exporta os nomes novos para `apps/api` e `apps/web`; o `architecture.test.ts` fixa as 11 rotas do painel e a lista exata de métodos do `OrcamentoDoMesRepository`; os dois arquivos da web montam a resposta do uso, que agora exige o grupo `ia` (o schema é estrito e a tela segue sem mostrá-lo até a 8.0) | `techspec.md` §4 (o grupo `ia` obrigatório no item do uso); a regra do I3 de `architecture.test.ts` |
| Teste novo `apps/api/test/painel-uso-ia.plano.int.test.ts`: o `EXPLAIN (ANALYZE, BUFFERS)` do `uso()` por custo e dos 12 meses com um ano da maior escola (1,8 milhão de linhas) em banco próprio. Nos 12 meses, a varredura da tabela é proibida (`enable_seqscan = off`) dentro da transação do `EXPLAIN` | A carga leva cerca de 70 s e não pode entrar em cada caso de `painel-leitura.int.test.ts` (que as mutações rodam muitas vezes); a escola grande é 91% das linhas do banco do teste, e o planejador escolhe a varredura paralela da tabela (0,9 s, abaixo dos 2 s da regra 00), então o teste prova que o índice **cobre** a consulta (`Index Only Scan`, `Heap Fetches` 0), não que ele vence | `techspec.md` §7c, "Laços e índices" (o `EXPLAIN` do `uso()` por custo e dos 12 meses num ano da maior escola) |
| A aba Escolas passa a contar os alunos por `alunosAtivosDaEscola` (era uma cópia sem o `encerrado_em is null`), e `GET /v1/operacao/escolas?ordem=custo` responde `ENTRADA_INVALIDA`: o `custo` é só do uso (`usoDoPainelQuerySchema`, a segunda opção da 5.1) | O item do `TODO.md` da 2.0 manda unificar na 5.0 (RF8, o mesmo número na tela e no orçamento); o número da aba Escolas muda para o vínculo não encerrado | `techspec.md` §4 (o parágrafo do uso); `cenarios.md` §1 RF11 (a linha da `ordem=custo` só no uso); `TODO.md`, o item da 2.0 marcado |

## Mutações

`--faltando: 0 linhas (63 blocos, 5 motivos)`

Motivos (linha ou termo sem bloco, com o porquê):

- `inArray(orcamentoIaDoMes.mes, meses.map(primeiroDiaDoMes))` no retrato dos 12 meses: o filtro por mês só poupa leitura (a escola tem no máximo um retrato por mês, e o mapa `retratoDoMes` só é consultado pelos 12 meses pedidos); sem ele a resposta é a mesma. A escola do mesmo `where` tem bloco (o retrato de B em fevereiro).
- O limite superior da consulta dos 12 meses (`c.em < ${faixaDoMes(maisRecente).fim}`) e o inferior mais antigo só poupam leitura do mesmo modo: o mês fora da janela cai numa linha que o mapa `consumoDoMes` nunca consulta. Os blocos trocam cada ponta por outra, e a resposta muda.
- `meses[0] ?? ''` e `meses[meses.length - 1] ?? ''`: o `?? ''` só fecha o tipo (`noUncheckedIndexedAccess`), porque `mesesAnterioresA(…, 12)` sempre devolve 12 meses; nenhum teste alcança o vazio.
- `currentContext()?.requisicaoId ?? randomUUID()`: o `??` só cobre a chamada fora de uma requisição HTTP (a rota sempre tem contexto, posto pelo `OperacaoRoute`), e o `randomUUID()` fecha o tipo; o id só entra no contexto do log, e nenhum teste conhece o valor que o contexto escolheu. É o mesmo idioma dos métodos do orçamento da 3.0 neste serviço. O `NAO_ENCONTRADO` ao lado tem bloco.
- Os dois `ia_teto_de_seguranca_percentual` do `uso()` (`iaTeto` e `redeIaTeto`) entram como contexto dos blocos vizinhos: o teto alimenta o `orcamentoVigente` e o `orcamentoDoMes`, mas nenhum campo da resposta do uso depende dele (a `porcentagem` é custo sobre valor e alunos, e o aviso é do orçamento que o contrato não leva), então não há caso que fique vermelho sem ele; o tipo `OrcamentoLidoDaEscola` o exige e a aba Escolas o lê.

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › a ordem por custo põe a de maior custo do mês primeiro
   if (ordem === 'nome') return sql`e.nome, e.id`
-  if (ordem === 'custo') return sql`${custoDaEscolaNoMes(sql`e.id`, mesDeSaoPaulo(agora))} desc, e.id`
   return sql`(select coalesce(sum(u.requisicoes), 0) from uso_infra_diario as u
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › a ordem por custo põe a de maior custo do mês primeiro
-  if (ordem === 'custo') return sql`${custoDaEscolaNoMes(sql`e.id`, mesDeSaoPaulo(agora))} desc, e.id`
+  if (ordem === 'custo') return sql`${custoDaEscolaNoMes(sql`e.id`, mesDeSaoPaulo(agora))} asc, e.id`
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › a ordem por custo põe a de maior custo do mês primeiro
-  if (ordem === 'custo') return sql`${custoDaEscolaNoMes(sql`e.id`, mesDeSaoPaulo(agora))} desc, e.id`
+  if (ordem === 'custo') return sql`${custoDaEscolaNoMes(sql`e.id`, mesDeSaoPaulo(new Date()))} desc, e.id`
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › o relógio é o do serviço
-  const hoje = faixaDoDia(diaDeSaoPaulo(pedido.agora))
+  const hoje = faixaDoDia(diaDeSaoPaulo(new Date()))
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › o relógio é o do serviço
-  const mes = faixaDoMes(mesDeSaoPaulo(pedido.agora))
+  const mes = faixaDoMes(mesDeSaoPaulo(new Date()))
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › duas escolas com uso diferente no dia e no mês
     with pagina as (${escolasDaPagina(pedido)})
     select e.id, e.nome,
       coalesce(no_dia.requisicoes, 0) as "diaRequisicoes",
       coalesce(no_dia.jobs, 0) as "diaJobs",
       coalesce(no_dia.bytes_storage, 0) as "diaBytes",
       no_mes.requisicoes as "mesRequisicoes",
       no_mes.jobs as "mesJobs",
       no_mes.bytes as "mesBytes",
       to_jsonb(ia_hoje) as "iaHoje",
       to_jsonb(ia_mes) as "iaMes",
       ${alunosAtivosDaEscola(sql`e.id`)} as "alunosAtivos",
       cfg.ia_valor_por_aluno_micros::text as "iaValorMicros",
       cfg.ia_teto_de_seguranca_percentual as "iaTeto",
       r.ia_valor_por_aluno_micros::text as "redeIaValorMicros",
       r.ia_teto_de_seguranca_percentual as "redeIaTeto"
     from pagina
     join escola as e on e.id = pagina.id
     join rede as r on r.id = e.rede_id
     left join configuracao_operacional_escola as cfg on cfg.escola_id = e.id
-    left join uso_infra_diario as no_dia on no_dia.escola_id = e.id and no_dia.dia = ${dia}::date
+    left join uso_infra_diario as no_dia on no_dia.escola_id = e.id and no_dia.dia = ${dia}::date and false
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › duas escolas com uso diferente no dia e no mês
     left join lateral (
       select coalesce(sum(m.requisicoes), 0) as requisicoes, coalesce(sum(m.jobs), 0) as jobs, coalesce(max(m.bytes_storage), 0) as bytes
       from uso_infra_diario as m
-      where m.escola_id = e.id and m.dia between ${primeiroDoMes}::date and ${dia}::date
+      where m.dia between ${primeiroDoMes}::date and ${dia}::date
     ) as no_mes on true
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › A e B da §2
     left join lateral (
-      select ${COLUNAS_DO_USO_DE_IA} from consumo_ia as c where c.escola_id = e.id and c.em >= ${hoje.inicio} and c.em < ${hoje.fim}
+      select ${COLUNAS_DO_USO_DE_IA} from consumo_ia as c where c.em >= ${hoje.inicio} and c.em < ${hoje.fim}
     ) as ia_hoje on true
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › A e B da §2
     ) as ia_hoje on true
     left join lateral (
-      select ${COLUNAS_DO_USO_DE_IA} from consumo_ia as c where c.escola_id = e.id and c.em >= ${mes.inicio} and c.em < ${mes.fim}
+      select ${COLUNAS_DO_USO_DE_IA} from consumo_ia as c where c.em >= ${mes.inicio} and c.em < ${mes.fim}
     ) as ia_mes on true
     order by pagina.posicao`
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › A e B da §2
       no_mes.bytes as "mesBytes",
-      to_jsonb(ia_hoje) as "iaHoje",
+      to_jsonb(ia_mes) as "iaHoje",
       to_jsonb(ia_mes) as "iaMes",
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › A e B da §2
       to_jsonb(ia_hoje) as "iaHoje",
-      to_jsonb(ia_mes) as "iaMes",
+      to_jsonb(ia_hoje) as "iaMes",
       ${alunosAtivosDaEscola(sql`e.id`)} as "alunosAtivos",
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › A e B da §2
       to_jsonb(ia_mes) as "iaMes",
-      ${alunosAtivosDaEscola(sql`e.id`)} as "alunosAtivos",
+      0 as "alunosAtivos",
       cfg.ia_valor_por_aluno_micros::text as "iaValorMicros",
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › A e B da §2
       ${alunosAtivosDaEscola(sql`e.id`)} as "alunosAtivos",
-      cfg.ia_valor_por_aluno_micros::text as "iaValorMicros",
+      null as "iaValorMicros",
       cfg.ia_teto_de_seguranca_percentual as "iaTeto",
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › sem valor nem na rede
       cfg.ia_teto_de_seguranca_percentual as "iaTeto",
-      r.ia_valor_por_aluno_micros::text as "redeIaValorMicros",
+      null as "redeIaValorMicros",
       r.ia_teto_de_seguranca_percentual as "redeIaTeto"
     from pagina
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › A e B da §2
     join rede as r on r.id = e.rede_id
-    left join configuracao_operacional_escola as cfg on cfg.escola_id = e.id
+    left join configuracao_operacional_escola as cfg on cfg.escola_id = e.id and false
     left join uso_infra_diario as no_dia on no_dia.escola_id = e.id and no_dia.dia = ${dia}::date
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › os alunos ativos da linha são os da aba Escolas
           ${pessoasComVinculo('professor', sql`v.estado = 'confirmado' and v.encerrado_em is null`)} as professores,
-          ${alunosAtivosDaEscola(sql`e.id`)} as alunos,
+          0 as alunos,
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-leitura.int.test.ts › sem valor nem na rede
-  const vigente = orcamentoVigente(ia.orcamento.escola, ia.orcamento.rede)
+  const vigente = orcamentoVigente(ia.orcamento.escola, ia.orcamento.escola)
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-leitura.int.test.ts › A e B da §2
     alunosAtivos: ia.alunosAtivos,
     valorPorAlunoMicros: vigente.valorPorAlunoMicros,
     origemDoValor: vigente.origemDoValor,
-    porcentagem: mes.porcentagem,
+    porcentagem: null,
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-leitura.int.test.ts › o relógio é o do serviço
   async uso({ pagina, ordem }: UsoDoPainelQuery): Promise<UsoDoPainelResponse> {
-    const agora = this.relogio.agora()
+    const agora = new Date()
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-leitura.int.test.ts › os 12 meses de A
-    const meses = await runInContext({ requisicaoId, escolaId }, () => new OrcamentoDoMesRepository(this.banco).usoDosMesesAnteriores(this.relogio.agora()))
+    const meses = await runInContext({ requisicaoId, escolaId }, () => new OrcamentoDoMesRepository(this.banco).usoDosMesesAnteriores(new Date()))
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-leitura.int.test.ts › GET /escolas/:id/uso-ia: 12 meses
     const requisicaoId = currentContext()?.requisicaoId ?? randomUUID()
     const meses = await runInContext({ requisicaoId, escolaId }, () => new OrcamentoDoMesRepository(this.banco).usoDosMesesAnteriores(this.relogio.agora()))
-    if (meses === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
     return usoDeIaDaEscolaDoPainelResponseSchema.parse({
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-leitura.int.test.ts › os 12 meses de A
         origemDoValor: orcamento.origemDoValor,
         porcentagem: orcamento.porcentagem,
-        situacao: orcamento.situacao,
+        situacao: 'definido',
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.controller.ts
teste: apps/api/test/painel-leitura.int.test.ts › GET /uso aceita
-  uso(@Query(new ZodValidationPipe(usoDoPainelQuerySchema)) consulta: UsoDoPainelQuery): Promise<UsoDoPainelResponse> {
+  uso(@Query(new ZodValidationPipe(painelQuerySchema)) consulta: UsoDoPainelQuery): Promise<UsoDoPainelResponse> {
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.controller.ts
teste: apps/api/test/painel-leitura.int.test.ts › GET /escolas/:id/uso-ia: 12 meses
-  usoDeIaDaEscola(@Param('id', IdPipe) escolaId: string): Promise<UsoDeIaDaEscolaDoPainelResponse> {
+  usoDeIaDaEscola(@Param('id') escolaId: string): Promise<UsoDeIaDaEscolaDoPainelResponse> {
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.controller.ts
teste: apps/api/test/architecture.test.ts › toda rota @RotaDeOperacao registrada tem a guarda
   @Get('escolas/:id/uso-ia')
-  @OperacaoRoute()
   @Header('Cache-Control', 'no-store')
   usoDeIaDaEscola(@Param('id', IdPipe) escolaId: string): Promise<UsoDeIaDaEscolaDoPainelResponse> {
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.controller.ts
teste: apps/api/test/painel-leitura.int.test.ts › GET /escolas/:id/uso-ia: 12 meses
   @Get('escolas/:id/uso-ia')
   @OperacaoRoute()
-  @Header('Cache-Control', 'no-store')
   usoDeIaDaEscola(@Param('id', IdPipe) escolaId: string): Promise<UsoDeIaDaEscolaDoPainelResponse> {
```

```mutacao
arquivo: packages/shared/src/operacao/painel.ts
teste: packages/shared/src/operacao/painel.test.ts › são exatamente 12 meses
-  meses: z.array(mesDoUsoDeIaDaEscolaSchema).length(MESES_DO_USO_DE_IA),
+  meses: z.array(mesDoUsoDeIaDaEscolaSchema).min(1),
```

```mutacao
arquivo: packages/shared/src/operacao/painel.ts
teste: packages/shared/src/operacao/painel.test.ts › o mês sem retrato leva só o consumo
 export const mesDoUsoDeIaDaEscolaSchema = usoDeIaDoPeriodoDoPainelSchema.extend({
-  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
+  mes: z.string(),
```

```mutacao
arquivo: packages/shared/src/operacao/painel.ts
teste: packages/shared/src/operacao/painel.test.ts › a resposta do uso é estrita
-export const usoDeIaDoPeriodoDoPainelSchema = z.strictObject({
+export const usoDeIaDoPeriodoDoPainelSchema = z.object({
```

```mutacao
arquivo: packages/shared/src/operacao/painel.ts
teste: packages/shared/src/operacao/painel.test.ts › a resposta do uso é estrita
-  ia: usoDeIaDaEscolaDoPainelSchema,
```

```mutacao
arquivo: packages/shared/src/operacao/painel.ts
teste: packages/shared/src/operacao/painel.test.ts › a resposta do uso é estrita
-  situacao: situacaoDoMesCorrenteSchema,
+  situacao: situacaoDoMesFechadoSchema,
```

```mutacao
arquivo: packages/shared/src/operacao/painel.ts
teste: packages/shared/src/operacao/painel.test.ts › a consulta do uso aceita também a ordem
-export const ORDENS_DO_USO_DO_PAINEL = [...ORDENS_DO_PAINEL, 'custo'] as const
+export const ORDENS_DO_USO_DO_PAINEL = [...ORDENS_DO_PAINEL] as const
```

```mutacao
arquivo: packages/shared/src/operacao/painel.ts
teste: packages/shared/src/operacao/painel.test.ts › a consulta do uso aceita também a ordem
-export const usoDoPainelQuerySchema = z.strictObject({
+export const usoDoPainelQuerySchema = z.object({
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › a ordem por custo põe a de maior custo do mês primeiro
-  return sql`(select coalesce(sum(c.custo_micros), 0) from consumo_ia as c where c.escola_id = ${escolaId} and c.em >= ${inicio} and c.em < ${fim})`
+  return sql`(select coalesce(sum(c.custo_micros), 0) from consumo_ia as c where c.em >= ${inicio} and c.em < ${fim})`
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › A e B da §2
-    fim: sql`((${dia}::date + 1)::timestamp at time zone ${FUSO_DO_ORCAMENTO})`,
+    fim: sql`((${dia}::date + 2)::timestamp at time zone ${FUSO_DO_ORCAMENTO})`,
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › conta linhas e
-  (count(distinct c.execucao_id) + count(*) filter (where c.execucao_id is null))::int as execucoes,
+  count(distinct c.execucao_id)::int as execucoes,
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › conta linhas e
-  count(*)::int as chamadas,
+  count(c.execucao_id)::int as chamadas,
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › conta linhas e
-  coalesce(sum(c.tokens_de_entrada + c.tokens_de_saida), 0)::text as tokens,
+  coalesce(sum(c.tokens_de_entrada), 0)::text as tokens,
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › A e B da §2
-  coalesce(sum(c.custo_micros), 0)::text as "custoMicros",
+  coalesce(max(c.custo_micros), 0)::text as "custoMicros",
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › conta linhas e
-  (count(*) filter (where c.pelo_provedor_de_reserva))::int as "chamadasPeloProvedorDeReserva"`
+  (count(*) filter (where not c.pelo_provedor_de_reserva))::int as "chamadasPeloProvedorDeReserva"`
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › a soma do mês e os alunos ativos: A gastou
-      .where(and(eq(consumoIa.escolaId, requireEscolaId()), gte(consumoIa.em, inicio), lt(consumoIa.em, fim)))
+      .where(and(gte(consumoIa.em, inicio), lt(consumoIa.em, fim)))
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › a chamada de 31/03 às 23h30
-      .where(and(eq(consumoIa.escolaId, requireEscolaId()), gte(consumoIa.em, inicio), lt(consumoIa.em, fim)))
+      .where(and(eq(consumoIa.escolaId, requireEscolaId()), lt(consumoIa.em, fim)))
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: packages/core/src/ia/orcamento-do-mes.repository.int.test.ts › a chamada de 31/03 às 23h30
-      .where(and(eq(consumoIa.escolaId, requireEscolaId()), gte(consumoIa.em, inicio), lt(consumoIa.em, fim)))
+      .where(and(eq(consumoIa.escolaId, requireEscolaId()), gte(consumoIa.em, inicio)))
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › os 12 meses de A
     const [maisRecente, maisAntigo] = [meses[0] ?? '', meses[meses.length - 1] ?? '']
     return sql`
       select to_char(date_trunc('month', c.em at time zone ${FUSO_DO_ORCAMENTO}), 'YYYY-MM') as mes, ${COLUNAS_DO_USO_DE_IA}
       from consumo_ia as c
-      where c.escola_id = ${requireEscolaId()}::uuid and c.em >= ${faixaDoMes(maisAntigo).inicio} and c.em < ${faixaDoMes(maisRecente).fim}
+      where c.em >= ${faixaDoMes(maisAntigo).inicio} and c.em < ${faixaDoMes(maisRecente).fim}
       group by 1`
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › os 12 meses de A
-      where c.escola_id = ${requireEscolaId()}::uuid and c.em >= ${faixaDoMes(maisAntigo).inicio} and c.em < ${faixaDoMes(maisRecente).fim}
+      where c.escola_id = ${requireEscolaId()}::uuid and c.em >= ${faixaDoMes(maisRecente).inicio} and c.em < ${faixaDoMes(maisRecente).fim}
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › os 12 meses de A
-      where c.escola_id = ${requireEscolaId()}::uuid and c.em >= ${faixaDoMes(maisAntigo).inicio} and c.em < ${faixaDoMes(maisRecente).fim}
+      where c.escola_id = ${requireEscolaId()}::uuid and c.em >= ${faixaDoMes(maisAntigo).inicio} and c.em < ${faixaDoMes(maisAntigo).fim}
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › os 12 meses de A
-      select to_char(date_trunc('month', c.em at time zone ${FUSO_DO_ORCAMENTO}), 'YYYY-MM') as mes, ${COLUNAS_DO_USO_DE_IA}
+      select to_char(date_trunc('month', c.em at time zone 'UTC'), 'YYYY-MM') as mes, ${COLUNAS_DO_USO_DE_IA}
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › GET /escolas/:id/uso-ia: 12 meses
-    const [existe] = await this.banco.select({ id: escola.id }).from(escola).where(eq(escola.id, escolaId))
+    const [existe] = await this.banco.select({ id: escola.id }).from(escola).where(eq(escola.id, escola.id))
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › GET /escolas/:id/uso-ia: 12 meses
     const [existe] = await this.banco.select({ id: escola.id }).from(escola).where(eq(escola.id, escolaId))
-    if (existe === undefined) return undefined
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › os 12 meses de A
-      .where(and(eq(orcamentoIaDoMes.escolaId, escolaId), inArray(orcamentoIaDoMes.mes, meses.map(primeiroDiaDoMes))))
+      .where(inArray(orcamentoIaDoMes.mes, meses.map(primeiroDiaDoMes)))
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › os 12 meses de A
-      const uso = consumoDoMes.get(mes) ?? USO_DE_IA_VAZIO
+      const uso = consumoDoMes.get(mes) ?? { ...USO_DE_IA_VAZIO, chamadas: 1 }
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › os 12 meses de A
-      return { mes, uso, orcamento: retrato === undefined ? orcamentoSemRetrato(uso.custoMicros) : orcamentoDoMes(retrato, uso.custoMicros, false) }
+      return { mes, uso, orcamento: retrato !== undefined ? orcamentoSemRetrato(uso.custoMicros) : orcamentoDoMes(retrato, uso.custoMicros, false) }
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › o mês fechado não leva aviso
-      return { mes, uso, orcamento: retrato === undefined ? orcamentoSemRetrato(uso.custoMicros) : orcamentoDoMes(retrato, uso.custoMicros, false) }
+      return { mes, uso, orcamento: retrato === undefined ? orcamentoSemRetrato(uso.custoMicros) : orcamentoDoMes(retrato, uso.custoMicros, true) }
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › os 12 meses de A
-    const posicao = ano * 12 + (numero - 1) - (indice + 1)
+    const posicao = ano * 12 + (numero - 1) - indice
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › A e B da §2
-      select ${COLUNAS_DO_USO_DE_IA} from consumo_ia as c where c.escola_id = e.id and c.em >= ${hoje.inicio} and c.em < ${hoje.fim}
+      select ${COLUNAS_DO_USO_DE_IA} from consumo_ia as c where c.escola_id = e.id and c.em < ${hoje.fim}
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › A e B da §2
-      select ${COLUNAS_DO_USO_DE_IA} from consumo_ia as c where c.escola_id = e.id and c.em >= ${hoje.inicio} and c.em < ${hoje.fim}
+      select ${COLUNAS_DO_USO_DE_IA} from consumo_ia as c where c.escola_id = e.id and c.em >= ${hoje.inicio}
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › A e B da §2
-      select ${COLUNAS_DO_USO_DE_IA} from consumo_ia as c where c.escola_id = e.id and c.em >= ${mes.inicio} and c.em < ${mes.fim}
+      select ${COLUNAS_DO_USO_DE_IA} from consumo_ia as c where c.escola_id = e.id and c.em < ${mes.fim}
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › A e B da §2
-      select ${COLUNAS_DO_USO_DE_IA} from consumo_ia as c where c.escola_id = e.id and c.em >= ${mes.inicio} and c.em < ${mes.fim}
+      select ${COLUNAS_DO_USO_DE_IA} from consumo_ia as c where c.escola_id = e.id and c.em >= ${mes.inicio}
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › a ordem por custo põe a de maior custo do mês primeiro
-  return sql`(select coalesce(sum(c.custo_micros), 0) from consumo_ia as c where c.escola_id = ${escolaId} and c.em >= ${inicio} and c.em < ${fim})`
+  return sql`(select coalesce(sum(c.custo_micros), 0) from consumo_ia as c where c.escola_id = ${escolaId} and c.em < ${fim})`
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › a ordem por custo põe a de maior custo do mês primeiro
-  return sql`(select coalesce(sum(c.custo_micros), 0) from consumo_ia as c where c.escola_id = ${escolaId} and c.em >= ${inicio} and c.em < ${fim})`
+  return sql`(select coalesce(sum(c.custo_micros), 0) from consumo_ia as c where c.escola_id = ${escolaId} and c.em >= ${inicio})`
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › A e B da §2
-    inicio: sql`((${inicio}::date)::timestamp at time zone ${FUSO_DO_ORCAMENTO})`,
+    inicio: sql`((${inicio}::date)::timestamp at time zone 'UTC')`,
```

```mutacao
arquivo: packages/core/src/ia/orcamento-do-mes.repository.ts
teste: apps/api/test/painel-leitura.int.test.ts › A e B da §2
-    fim: sql`((${inicio}::date + interval '1 month')::timestamp at time zone ${FUSO_DO_ORCAMENTO})`,
+    fim: sql`((${inicio}::date + interval '1 month')::timestamp at time zone 'UTC')`,
```

```mutacao
arquivo: apps/api/src/operacao/painel/painel.service.ts
teste: apps/api/test/painel-leitura.int.test.ts › A e B da §2
-  const mes = orcamentoDoMes({ alunosAtivos: ia.alunosAtivos, valorPorAlunoMicros: vigente.valorPorAlunoMicros, tetoPercentual: vigente.tetoPercentual, origemDoValor: vigente.origemDoValor }, ia.mes.custoMicros, true)
+  const mes = orcamentoDoMes({ alunosAtivos: ia.alunosAtivos, valorPorAlunoMicros: vigente.valorPorAlunoMicros, tetoPercentual: vigente.tetoPercentual, origemDoValor: vigente.origemDoValor }, ia.hoje.custoMicros, true)
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | Guarda no `architecture.test.ts` que restrinja quem importa `custoDaEscolaNoMes` e `alunosAtivosDaEscola` ao `PainelRepository` e ao `OrcamentoDoMesRepository` | `TODO.md`: guarda nova (arquivo de teste que a tarefa só tocou para fixar a lista de métodos), e o docblock já proíbe valor de requisição; a 2.0 já deixou `alunosAtivosDaEscola` com a mesma pendência |
| revisor-geral (1ª) | Cast `as …['situacao']`: tipo de retorno de `orcamentoDoMes` do mês corrente sem `sem_retrato`, ou guard | `TODO.md`: muda o contrato do `shared` (`orcamentoDoMes`), fora dos arquivos previstos; o comentário do item 4 e o `parse` estrito cobrem hoje |
| revisor-geral (1ª) | `PedidoDePaginaDoPainel.agora` obrigatório também para `escolas()`: tipo de pedido próprio para o uso | `TODO.md`: refatoração de tipo, sem mudança de comportamento; recusada nesta tarefa porque o `escolas()` e o `uso()` compartilham `escolasDaPagina` |
| revisor-geral (1ª) | Na 8.0, a tela trata `alunosAtivos = 0` sem dividir e mostra o mesmo número da `porcentagem` do servidor | 8.0 (a tela), onde a tarefa já consome estes contratos |
| revisor-geral (1ª) | O `EXPLAIN` dos 12 meses prova a cobertura, não a escolha; um banco com a maior escola menos dominante daria prova mais forte | recusada: a própria Divergência da tarefa (3ª linha) explica que a escola grande é 91% das linhas do banco do teste e a varredura é proibida de propósito |
| conformidade-reviewer (1ª) | Na 8.0, a tela do uso de IA sem detalhar por função ou agente | 8.0 (a tela) |
| conformidade-reviewer (1ª) | Na 8.0, textos que chamem os números de "uso de IA da escola", nunca "uso dos professores" (D64) | 8.0 (a tela) |
| infra-guardian (1ª) | Na ordem `custo`, o custo do mês das 25 escolas é somado duas vezes (a chave e a lateral `ia_mes`); reaproveitar a soma ou ordenar pelo retrato | `TODO.md`: sem efeito com dez escolas (D25); pede redesenho da consulta |
| infra-guardian (1ª) | Mandar `painel-uso-ia.plano.int.test.ts` (70 a 90 s) para projeto ou etiqueta separada, rodada na esteira | `TODO.md`: mexe em configuração do Vitest e da esteira (`tools/ci`), fora dos arquivos previstos |
| infra-guardian (1ª) | Registrar em `docs/infra.md` o limite em que a leitura dos 12 meses (cerca de 0,9 s) pede agregado mensal | tarefa 11.x que mexe em `docs/infra.md`; senão `TODO.md` |
| privacy-guardian (1ª) | `docs/lgpd.md:206-210`: o parágrafo "O painel da operação não vê pessoa da escola" não lista o uso de IA por escola | 11.4, que já mexe em `docs/lgpd.md` |
| test-engineer (1ª) | `usoPorCusto()` lê só a página 1 (25 escolas); sobras de 2033 de uma execução morta podem tirar a escola do caso | `TODO.md`: pede um mês exclusivo por execução ou custo-sentinela, e mexe na fixture de vários casos; o `afterAll` limpa e o risco é só de execução interrompida |
| test-engineer (2ª) | `faixaDoDia` (`packages/core/src/ia/orcamento-do-mes.repository.ts`) sem bloco que troque o fuso por `'UTC'`; só o fim dela tem bloco (o `+ 2`) | recusada: o caso `› A e B da §2` já fica vermelho com essa troca (a chamada de 30/04 às 23h30 em São Paulo cai fora do hoje de A), como o próprio revisor conferiu; o `--faltando` está em 0 |
| revisor-geral (2ª) | O comentário de `iaDaEscola` (`painel.service.ts`, `const mes = orcamentoDoMes(…)`) é longo para uma linha; partir em duas | recusada: só estilo, sem efeito no comportamento |
| revisor-geral (2ª) | A conta do ano e do mês no teste dos 12 meses repete a do repository; usar um auxiliar do `shared` para o mês anterior, se ele existir | `TODO.md`: depende de o `shared` ganhar o auxiliar; não existe hoje |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-21 07:10:27 | 2026-11-21 07:11:13 | `conformidade-reviewer` | 1 | APROVADO | a9c57d4c65a19cae0 |
| 2026-11-21 07:10:17 | 2026-11-21 07:11:14 | `tenancy-guardian` | 1 | APROVADO | a7acfc07123f80bc5 |
| 2026-11-21 07:10:25 | 2026-11-21 07:11:29 | `revisor-geral` | 1 | APROVADO | ad22b213ec2bd425a |
| 2026-11-21 07:10:30 | 2026-11-21 07:11:45 | `infra-guardian` | 1 | APROVADO | a896176d611221b70 |
| 2026-11-21 07:10:20 | 2026-11-21 07:11:53 | `privacy-guardian` | 1 | APROVADO | a5e3b6290a892449b |
| 2026-11-21 07:10:22 | 2026-11-21 07:13:16 | `test-engineer` | 1 | REPROVADO | a708c02d70e2324a8 |
| 2026-11-21 07:33:38 | 2026-11-21 07:34:01 | `revisor-geral` | 2 | APROVADO | ac1aa2b6607e719b3 |
| 2026-11-21 07:33:33 | 2026-11-21 07:34:56 | `test-engineer` | 2 | APROVADO | a2fea2144da526692 |
