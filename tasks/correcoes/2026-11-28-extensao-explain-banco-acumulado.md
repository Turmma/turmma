# Correção — o `EXPLAIN` do acompanhamento da prova falha com o banco de teste acumulado e passa com o banco novo

**Origem:** teste intermitente — relato da 9.0 de `avaliacao-e-correcao`: `apps/api/src/atividade/extensao.int.test.ts` (o `EXPLAIN` do acompanhamento, da 5.0) cai sobre o banco que as outras suítes deixaram e passa com `EDUCA_BANCO_NOVO=1`.
**Subagentes obrigatórios:** `test-engineer`, `infra-guardian`, `tenancy-guardian`, `revisor-geral`, `privacy-guardian`, `conformidade-reviewer`
<!-- Os guardiões vieram no PEDIDO do Orquestrador (`infra-guardian`, `tenancy-guardian`, `revisor-geral`); o `test-engineer` é de toda correção; `privacy-guardian` e `conformidade-reviewer` vieram do `portao-local.ts revisores`, que lista quem o caminho pede. -->

## Sintoma

`npx vitest run --project integracao apps/api/src/atividade/extensao.int.test.ts -t EXPLAIN`, sobre o banco de teste acumulado (110 escolas de outras execuções), cai em:

```
AssertionError: tentativa_atividade: Sort > … > Index Scan tentativa_atividade tentativa_atividade_aluno_idx (escola_id = '…') > … : expected undefined to be defined
```

O plano entrou pelo `tentativa_atividade_aluno_idx`, só pela escola, com `ano_letivo_id`, `atividade_aplicada_id` (filtro) e `aluno_id` (`Join Filter`) fora da condição do índice, em vez de pela chave única `tentativa_atividade_uma_por_aluno`. Com `EDUCA_BANCO_NOVO=1` o mesmo teste passa.

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

Empate de custo do planejador, e não defeito da consulta nem do índice. O teste planeja a consulta com a escola que ele mesmo criou, que tem **uma ou duas tentativas** (e nenhuma extensão). Com tão poucas linhas, o `(escola_id, aluno_id)` e a chave única `(escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id)` custam o mesmo, uma página (`cost=0.14..8.16` nos dois, com o `aluno_idx` apagado numa transação desfeita o plano troca para a chave única com **o mesmo custo**), e o planejador fica com o primeiro caminho que viu. Qual é esse caminho depende das estatísticas da tabela, isto é, do que as outras suítes deixaram: o banco limpo desempata por acaso para a chave única; o acumulado, para o `aluno_idx`. A mesma coisa acontece na `extensao_de_tempo` (`extensao_de_tempo_aluno_idx` contra `extensao_de_tempo_chave_por_aplicacao`), que só não apareceu no relato porque a tentativa falha antes.

Uma escola de verdade tem centenas de tentativas e de extensões em **outras** aplicações, e é nesse volume que o prefixo `(escola, ano, aplicação)` torna a chave única muito mais barata que o índice só por escola. O teste planejava um caso que a produção não tem. É falha da **5.0** (o teste nasceu lá), vista na 9.0.

## Teste que reproduz

`apps/api/src/atividade/extensao.int.test.ts › a extensão de tempo e o acompanhamento da prova › acompanhar › o EXPLAIN da consulta do repository entra pelos índices: …` — o próprio teste, que estava vermelho sobre o banco acumulado (reproduzido neste andar, antes da mudança) e fica verde depois.

Reproduzido de forma determinística: o banco de teste do ambiente `educa-teste-3` estava acumulado, e a falha foi a mesma nas duas execuções antes da mudança. A prova de que a causa é o empate: o plano completo (`explain` com custo, no `psql`, numa transação desfeita) trouxe os dois índices a `cost=…8.16` com a mesma estimativa de 1 linha.

**Estabilidade (teste intermitente):** o teste rodado sozinho **dez vezes seguidas** sobre o banco acumulado (que cresce a cada rodada): 10 de 10 verdes. O arquivo inteiro: 20 de 20, no acumulado e com `EDUCA_BANCO_NOVO=1`.

## Correção

Só o teste (`apps/api/src/atividade/extensao.int.test.ts`); nenhum código de produção, nenhuma migration, nenhum índice.

- Dentro da transação que o `finally` já desfaz (`rollback`), antes do `analyze` e do `EXPLAIN`, a escola ganha o volume que ela tem na produção: **200 aplicações encerradas da mesma turma** (cópia da aplicação do teste, que o `estado = 'encerrada'` tira do índice parcial das abertas), cada uma com a **tentativa enviada** e uma **extensão de 10 min** para cada aluno confirmado da turma. Nada fica no banco. É o padrão que `apps/api/test/arquivo-do-titular.int.test.ts` já usa para os planos (volume na transação, `analyze`, `enable_seqscan = off`).
- A prova não afrouxa: continua exigindo, por tabela, o índice esperado e nenhuma varredura sequencial, e **passa a exigir mais**: a condição do índice da tentativa leva também `atividade_aplicada_id`, e a da extensão leva `escola_id` e `atividade_aplicada_id` (a chave por aplicação). Antes só se conferia o nome do índice e o `escola_id`, o que o `(escola_id, aluno_id)` também cumpre.
- O teste confere que o volume existe (rodada 1, item 1): 200 aplicações novas e ao menos 200 tentativas e 200 extensões pelo `rowCount` dos três `insert`, para o empate não voltar calado se a turma ficar sem aluno confirmado. A falha do `EXPLAIN` mostra o plano (`resumo`) também quando o índice da tentativa ou da extensão não é achado (item 2).
- O teste continua sem pedir banco novo: o volume independe do que as outras suítes deixaram.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª), revisor-geral (1ª) | Tirar o `on conflict on constraint tentativa_atividade_uma_por_aluno do nothing` do `insert` da tentativa, porque "as 200 aplicações acabaram de nascer e não têm tentativa" | Recusada, com o motivo: o `where` do `insert` não pega só as 200 novas, e sim toda aplicação `estado = 'encerrada'` da escola `a` (`aplicacao.id <> $2`). A escola `a` é a mesma do arquivo inteiro (`beforeAll`, `montarEscolaComAssistente`), e o caso `a prova encerrada pelo professor: …` (iniciarTentativa em quatro alunos, depois `rotas.encerrar`) deixa nela uma aplicação encerrada com tentativa. O test-engineer descreve o mesmo caso (borda 2, o arquivo inteiro). Sem a cláusula, o arquivo inteiro cairia em violação da chave única |
| privacy-guardian (1ª) | Quando o `extensao_de_tempo` ganhar colunas que o `insert` não lista (justificativa, texto livre), seguir gravando valor fixo e sintético | Sem ação hoje: é lembrete para quem mexer no esquema, e o `insert` está certo. Fica no registro da rodada |
| test-engineer (1ª) | O `analyze` dentro da transação desfeita grava `reltuples` e `relpages` inflados até o próximo `analyze` ou autovacuum; o mesmo padrão existe em `apps/api/test/arquivo-do-titular.int.test.ts` | `TODO.md` e retro da funcionalidade: não muda o comportamento desta correção, e o outro arquivo não é tocado por ela. Os outros `EXPLAIN` rodam o próprio `analyze` |
| revisor-geral (2ª) | Passar os `rowCount` como mensagem do `expect` do volume (`aplicações ${a}, tentativas ${t}, extensões ${e}`), porque a falha mostra `[200, false, true]` sem dizer quantas linhas entraram | Recusada nesta rodada: o item 1 de r1 já aplicou a conferência do volume, e a aprovação é de todos. Vale como melhoria de legibilidade; o mesmo ponto vem do test-engineer (2ª) na linha abaixo. Destino: `TODO.md` |
| test-engineer (2ª) | Comparar cada `rowCount` com `toBeGreaterThanOrEqual(200)` em vez de uma lista `[rowCount, bool, bool]`, para a falha mostrar o número real | Mesmo ponto da linha acima. Destino: `TODO.md` |
| revisor-geral (2ª) | Quebrar em três linhas curtas as duas linhas de comentário das linhas 491-492, que passam de 200 caracteres | Recusada: já foi encurtado em r1 e o estilo do arquivo tem linhas longas. Sem destino |
| revisor-geral (2ª) | A busca do índice da tentativa (linhas 543-544) repete a do laço das linhas 531-541, que já exige que ele exista | Recusada: o revisor diz que "não está errado, só é redundante", e a segunda busca é a que lê a `Index Cond` |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-28 09:29:43 | 2026-11-28 09:30:01 | `conformidade-reviewer` | 1 | APROVADO | a08ddcf084ed45242 |
| 2026-11-28 09:29:40 | 2026-11-28 09:30:03 | `tenancy-guardian` | 1 | APROVADO | ac1f8f0b1ffb4b7bb |
| 2026-11-28 09:29:42 | 2026-11-28 09:30:03 | `privacy-guardian` | 1 | APROVADO | ab6bbb07e40af05d3 |
| 2026-11-28 09:29:41 | 2026-11-28 09:30:08 | `revisor-geral` | 1 | APROVADO | aac86d9fc7d16d8d6 |
| 2026-11-28 09:29:39 | 2026-11-28 09:30:14 | `infra-guardian` | 1 | APROVADO | ac92c5f5361207b2f |
| 2026-11-28 09:29:38 | 2026-11-28 09:31:05 | `test-engineer` | 1 | APROVADO | a10cb06be8df8ba18 |
| 2026-11-28 09:48:41 | 2026-11-28 09:49:05 | `revisor-geral` | 2 | APROVADO | a055bca3c70757d89 |
| 2026-11-28 09:48:37 | 2026-11-28 09:49:11 | `test-engineer` | 2 | APROVADO | a56f0340d794ca17d |
