# Correção — a limpeza do e2e não apagava o `orcamento_ia_do_mes` da escola e quebrava na chave estrangeira

**Origem:** `e2e/operacao-uso.spec.ts` (2 casos), no `afterEach`, em `removerEscolaSemConvite` (`e2e/support/painel.ts`); o pedido do Orquestrador, da tarefa 2.0 desta spec
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `infra-guardian`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`

## Sintoma
Os dois casos de `e2e/operacao-uso.spec.ts` passam e caem na limpeza: `delete from escola` viola
`orcamento_ia_do_mes_escola_id_escola_id_fk`, porque a escola semeada já tem linha em `orcamento_ia_do_mes` (migration `0066`, tarefa 2.0).

## Fora desta correção
nada

## Causa
`removerPainel` e `removerEscolaSemConvite` (`e2e/support/painel.ts`) apagam, uma a uma e **por nome**, as tabelas que apontam para a
escola. Toda tabela nova com FK para `escola` (todas sem `on delete`: são 53 no banco hoje) quebra a limpeza, e foi o que aconteceu duas vezes
no mesmo dia: `job_registro` e `expurgo_execucao` (correção `2026-11-21-limpeza-do-painel-com-job-registro`) e agora `orcamento_ia_do_mes`. A
lista escrita à mão é a causa; acrescentar mais uma linha só adia a próxima.

## Teste que reproduz
`tools/ci/painel-do-e2e.int.test.ts`, os mesmos dois casos de antes (`removerPainel` e `removerEscolaSemConvite`), com o que o ambiente grava na
escola ampliado: uma linha de `orcamento_ia_do_mes` (o retrato do mês do orçamento de IA, que a rotina grava), e, no primeiro caso, uma `sessao`
de um usuário semeado (FK sem ação para `usuario`: só passa se a limpeza respeitar a ordem). Depois de limpar, cada caso espera que as linhas tenham
saído, que **nenhuma tabela com FK para a escola, lida do catálogo do Postgres, ainda guarde linha das escolas removidas** (`tabelasComLinhaDeEscola`:
é a conferência que não depende de alguém lembrar da tabela nova) e que as linhas de uma escola de fora do seed continuem lá.

**Vermelho antes** (limpeza do HEAD, com o `apagarDadosDasEscolas` só repetindo os dois `delete` antigos): os dois casos caem com
`update or delete on table "escola" violates foreign key constraint "orcamento_ia_do_mes_escola_id_escola_id_fk"`, a mesma mensagem do sintoma.
**Verde depois:** 2 de 2.

## Correção
`apagarDadosDasEscolas(banco, escolas)`, nova em `e2e/support/painel.ts`, lê do catálogo (`pg_constraint`) toda tabela com FK de coluna única para
`escola` e apaga as linhas das escolas dadas em ordem de dependência (a tabela só sai quando nenhuma outra do conjunto ainda aponta para ela; ciclo
lança). `removerPainel` e `removerEscolaSemConvite` a chamam no lugar da lista escrita à mão, e o `afterAll` do teste também. As 53 tabelas de hoje e as
que vierem passam a ser cobertas. Fica de fora, de propósito: FK composta para a escola e FK de tabela de fora do conjunto para uma de dentro, que
falham alto no `delete` da própria tabela. Só `e2e/support/painel.ts` e o teste mudam; o produto não.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª), test-engineer (1ª) | Rodar a limpeza e o `delete from escola` numa transação com `select … for update` da escola, ou repetir a limpeza uma vez, para fechar a corrida com o worker | Retro. Muda comportamento, a corrida já existia antes desta correção, e o `delete` falha alto, não apaga a mais. Só vira trabalho se a falha intermitente na FK voltar |
| infra-guardian (1ª), conformidade-reviewer (1ª), test-engineer (1ª) | Teste do guarda de ciclo (`throw`), com as tabelas criadas numa transação e `rollback` | Retro. O documento já declara a ausência. Criar FK para `escola` no banco de teste, mesmo em transação, pega lock na `escola` e pode bloquear o worker do ambiente: precisa de desenho próprio |
| revisor-geral (1ª), test-engineer (1ª) | Conferência independente do catálogo (contar as FKs para `escola` sem o filtro `cardinality(con.conkey) = 1` e comparar), porque teste e implementação repetem o filtro | Retro. Acrescenta lógica ao teste; o filtro é morto no catálogo de hoje (nenhuma FK composta para `escola`), e o documento já o declara |
| tenancy-guardian (1ª), revisor-geral (1ª) | Lançar erro quando a mesma tabela tiver duas FKs para `escola`, ou agrupar as colunas | Muda comportamento, e hoje nenhuma tabela tem duas. A falha já é alta (`delete from escola`). O comentário de `apagarDadosDasEscolas` registra o limite |
| privacy-guardian (1ª) | Guarda que recuse um banco cujo nome não seja o do teste | Recusada. Muda comportamento, e a conexão sai só de `urlDoBancoDeTeste()` (`tools/ci/compose.ts`). O comentário de `apagarDadosDasEscolas` registra o limite |
| infra-guardian (1ª), privacy-guardian (1ª) | O teste importar a consulta ao catálogo da implementação, em vez de repeti-la | Recusada: a cópia independente é a conferência; unir as duas a deixaria cega ao erro da consulta |
| revisor-geral (2ª) | Encurtar o nome do `describe` e do segundo caso (`removerEscolaSemConvite apaga a escola e toda linha das tabelas com FK para ela, e só ela`) | Recusada: só texto, e os nomes batem com o que os casos conferem; mexer neles de novo caducaria o teste sem ganho |
| test-engineer (2ª) | O nome do primeiro caso (`painel-do-e2e.int.test.ts:73`) não cita a conferência pelo catálogo, que o caso faz na linha 98 | Recusada pelo mesmo motivo: simetria de texto, sem bloquear |
| revisor-geral (2ª) | A contagem "53 no banco hoje" vai envelhecer na próxima tabela com FK para `escola` | Recusada: o documento é o retrato da correção, como o próprio revisor diz |

## Mutações

--faltando: 0 linhas (0 blocos, 0 motivos)

O `--faltando` não lista nada (`e2e/support` não é código de produção). Cada cláusula acrescentada tem o seu bloco: a chamada em cada removedor, o filtro
da escola do `delete` e a ordem de dependência. O guarda de ciclo (`throw` quando nenhuma tabela está livre) não tem bloco: o catálogo de hoje não tem
ciclo entre essas tabelas, e provar o ramo pediria criar uma FK circular no banco de teste. A cláusula `filha.oid <> mae.oid` da consulta das ligações
também não tem bloco, e está provada pelos casos atuais: `artefato` e `material` têm FK para si mesmas, e sem a cláusula cada uma entraria no
próprio `aindaApontam`, nunca ficaria livre e a limpeza cairia no `throw` do ciclo.

```mutacao
arquivo: e2e/support/painel.ts
teste: tools/ci/painel-do-e2e.int.test.ts › removerPainel apaga as escolas semeadas
-    await apagarDadosDasEscolas(banco, escolas)
     await banco.query('delete from conta where id = any($1::uuid[])', [painel.contas])
```

```mutacao
arquivo: e2e/support/painel.ts
teste: tools/ci/painel-do-e2e.int.test.ts › removerEscolaSemConvite apaga a escola
-    await apagarDadosDasEscolas(banco, [escola.id])
     await banco.query('delete from escola where id = $1', [escola.id])
```

```mutacao
arquivo: e2e/support/painel.ts
teste: tools/ci/painel-do-e2e.int.test.ts › removerPainel apaga as escolas semeadas
-      await banco.query(`delete from "${tabela}" where "${colunaDe.get(tabela)}" = any($1::uuid[])`, [escolas])
+      await banco.query(`delete from "${tabela}" where "${colunaDe.get(tabela)}" = any($1::uuid[]) or true`, [escolas])
       aindaApontam.delete(tabela)
```

```mutacao
arquivo: e2e/support/painel.ts
teste: tools/ci/painel-do-e2e.int.test.ts › removerPainel apaga as escolas semeadas
-    if (colunaDe.has(filha) && colunaDe.has(mae)) aindaApontam.get(mae)?.add(filha)
+    if (colunaDe.has(filha) && colunaDe.has(mae)) aindaApontam.get(filha)?.add(mae)
```

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-21 09:31:31 | 2026-11-21 09:31:53 | `infra-guardian` | 1 | APROVADO | a9c658e41baa643e8 |
| 2026-11-21 09:31:34 | 2026-11-21 09:31:55 | `conformidade-reviewer` | 1 | APROVADO | ad2ec4d695f53b5b5 |
| 2026-11-21 09:31:33 | 2026-11-21 09:31:57 | `privacy-guardian` | 1 | APROVADO | a51ea156c52c22e0c |
| 2026-11-21 09:31:32 | 2026-11-21 09:31:59 | `tenancy-guardian` | 1 | APROVADO | a5041704fa4356fdf |
| 2026-11-21 09:31:30 | 2026-11-21 09:32:24 | `revisor-geral` | 1 | APROVADO | afc5656a375b8c69e |
| 2026-11-21 09:31:28 | 2026-11-21 09:33:31 | `test-engineer` | 1 | APROVADO | a69284ce75797e310 |
| 2026-11-21 09:49:56 | 2026-11-21 09:50:22 | `revisor-geral` | 2 | APROVADO | a62df9ee6a5d6a29e |
| 2026-11-21 09:49:52 | 2026-11-21 09:50:35 | `test-engineer` | 2 | APROVADO | a17a3b6d2b1713400 |
