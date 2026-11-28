# Achados das revisões — `tasks/correcoes/2026-11-28-extensao-explain-banco-acumulado.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-28 09:30:01 · `tasks/correcoes/2026-11-28-extensao-explain-banco-acumulado.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. O diff não grava em `Nota`. As escritas novas vão para `atividade_aplicada`, `tentativa_atividade` (com `envio = 'aluno'`) e `extensao_de_tempo`. Todas acontecem dentro da transação que o `finally` desfaz com `rollback`, e nenhum gatilho no banco liga essas tabelas a `Nota`. Todos com autor humano? sim, porque não existe caminho novo.

Decisão autônoma sobre aluno: ausente. A extensão de 10 min que o teste insere leva `concedida_por = aplicada_por`, ou seja, a professora que aplicou a prova. É volume sintético para o planejador do banco e não chega a ser lida como decisão.

Aprovação registrada: ok. A tarefa não cria saída de IA nem mexe em fluxo de aprovação.

Supervisão do tutor: ok. A tarefa não toca no tutor.

Autonomia declarada e visível: sim. Nada mudou nesse ponto.

Bloqueantes: nenhum.

O que conferi sobre a regra 70:
- **O que mudou:** só o teste `apps/api/src/atividade/extensao.int.test.ts`. Nenhum código de produção, migration ou índice.
- **Itens 7 e 8 da regra 70:** o teste não cria inferência emocional, medição de navegação ou tempo ocioso, indicador de professor, nem campo de nota em discursiva ou redação.
- **A prova ficou mais forte, não mais fraca.** Além do nome do índice, o teste agora exige `atividade_aplicada_id` na condição do índice da tentativa. Também passa a conferir a chave por aplicação da `extensao_de_tempo`.

Recomendações:
- O comentário novo antes do primeiro `insert` tem quatro linhas muito longas. Uma versão mais curta, que remeta ao arquivo da correção (`tasks/correcoes/2026-11-28-extensao-explain-banco-acumulado.md`), seria mais fácil de ler. Não bloqueia.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-28 09:30:03 · `tasks/correcoes/2026-11-28-extensao-explain-banco-acumulado.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration. As únicas tabelas tocadas são `atividade_aplicada`, `tentativa_atividade` e `extensao_de_tempo`, e só dentro da transação do teste em `apps/api/src/atividade/extensao.int.test.ts` (linhas 491 a 518), que o `finally` desfaz com `rollback`. Os três `insert ... select` levam `escola_id` e `ano_letivo_id` copiados da aplicação do próprio teste. O filtro é `escola_id = $1` e o join com `vinculo` amarra escola, ano e turma. Nada atravessa para outra escola e nada fica gravado no banco compartilhado.

Queries verificadas: `AcompanhamentoRepository.consulta`, que não mudou e continua com o escopo do contexto (`runInContext(contextoDaProfessora())`). A prova do `EXPLAIN` ficou mais forte. Antes ela aceitava qualquer índice que tivesse `escola_id` na condição, e o `tentativa_atividade_aluno_idx` (`escola_id, aluno_id`) também passava. Agora a condição do índice da tentativa precisa ter `atividade_aplicada_id`, e a da extensão precisa ter `escola_id` e `atividade_aplicada_id` juntos (linhas 546 a 549). Sem o prefixo `escola_id` na consulta, a condição exigida não aparece e o teste quebra.

Teste de isolamento: presente e efetivo. O bloco `describe('isolamento')` não foi alterado por esta correção. Nenhum endpoint aceita `escolaId` do cliente, porque nenhum endpoint mudou. Ids continuam UUID, não há agregado de rede envolvido e não apareceu nenhum `@Unscoped()`.

Bloqueantes: nenhum.

Recomendações:
- O `on conflict on constraint tentativa_atividade_uma_por_aluno do nothing` da linha 507 não tem efeito: as 200 aplicações acabaram de nascer e não têm tentativa. Tirar a cláusula deixa o volume do teste mais fácil de ler, e uma colisão inesperada passaria a aparecer como erro em vez de ser engolida.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-28 09:30:03 · `tasks/correcoes/2026-11-28-extensao-explain-banco-acumulado.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. O teste só insere linhas em `atividade_aplicada`, `tentativa_atividade` e `extensao_de_tempo`, com colunas que já existem: ids, datas, `minutos`, `envio` e `chave` (gerada com `gen_random_uuid()`). Nenhuma resposta, nota ou nome é gravado.
Fora da tabela de dados do docs/lgpd.md: nada. Não há migration nem coluna nova.
Autorização por objeto: ok. Nada mudou em rota, service ou repository. A mudança está toda em `apps/api/src/atividade/extensao.int.test.ts` (linhas 491-518 e 546-549). Os três `insert ... select` filtram por `escola_id = $1`, então copiam só a escola que o próprio teste criou e não leem nem replicam dado de outra escola do banco acumulado. A suíte de isolamento do arquivo (linha 557 em diante) continua igual.
Logs: limpos. Não entrou log. As mensagens de asserção (`resumo`) levam tipo de nó, nome de tabela e de índice e a condição do índice, que traz só o UUID da escola de teste.
Auditoria: não se aplica. Não há leitura por coordenação ou rede, exportação, alteração de nota, de permissão ou aprovação de saída de IA.
Envio externo: nenhum.
Seed/fixture: sintético. O volume novo (200 aplicações encerradas, cada uma com tentativa e extensão por aluno confirmado) é cópia dos dados sintéticos do próprio teste e roda dentro de uma transação que o `finally` desfaz com `rollback` (linha 551). Nada fica no banco.
Bloqueantes: nenhum.
Recomendações:
- Quando o `extensao_de_tempo` tiver colunas que o `insert` da linha 512 não lista, como justificativa ou texto livre, o insert precisa seguir gravando valor fixo e sintético. Hoje está certo; fica de lembrete para quem mexer no esquema.

Pergunta de fechamento: a correção não muda o que o sistema guarda sobre um aluno nem para onde envia. A resposta continua a mesma de antes, coberta por `apps/api/test/arquivo-do-titular.int.test.ts`.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-28 09:30:08 · `tasks/correcoes/2026-11-28-extensao-explain-banco-acumulado.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

O diff mexe só no teste `apps/api/src/atividade/extensao.int.test.ts`, como o documento da correção diz. Não toca código de produção, migration nem índice, então a correção não precisa de bloco de mutação nem da linha "Sem mutação". O volume entra na transação que o `finally` desfaz e nada fica no banco. É o mesmo jeito de montar volume para o plano que `apps/api/test/arquivo-do-titular.int.test.ts` já usa, não um segundo.

A prova não afrouxou, ficou mais exigente. As novas checagens de `atividade_aplicada_id` na tentativa (linha 547) e de `escola_id` com `atividade_aplicada_id` na extensão (linha 549) batem com as chaves do schema:
- `tentativa_atividade_uma_por_aluno` é `(escola, ano, aplicação, aluno)`.
- `extensao_de_tempo_chave_por_aplicacao` é `(escola, aplicação, chave)`.

Essas checagens recusam o índice `(escola_id, aluno_id)`, que antes também passava.

Recomendações:
- **Linhas 491 a 494:** o comentário tem quatro linhas de mais de 200 caracteres e repete a seção "Causa" do documento da correção. Uma ou duas linhas curtas bastam, com a referência ao documento.
- **Linha 519:** o comentário antigo ("O banco de teste acumula escolas de outras execuções…") hoje se sobrepõe ao novo. Vale juntar os dois ou deixar só o que explica o `analyze`.
- **Linha 545:** o `expect` do `escola_id` na tentativa ainda não leva a mensagem `resumo`, que as asserções novas levam. Acrescentar deixa a falha legível como as outras.
- **Linha 507:** o `on conflict ... do nothing` não tem efeito, porque as aplicações acabaram de nascer e ainda não têm tentativa. Dá para tirar.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-28 09:30:14 · `tasks/correcoes/2026-11-28-extensao-explain-banco-acumulado.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum (a mudança está só no teste do EXPLAIN do acompanhamento da prova; nenhum código de produção mudou)
Rate limit: ok (nada mudou)
Fila e prioridade: ok (nada mudou)
Concorrência: protegida (nada mudou)
Índice e paginação: ok. Rodei o teste sobre o banco acumulado do `educa-teste-3` e ele passou. Com o volume criado dentro da transação, o plano entra pela chave única em `tentativa_atividade`, com `atividade_aplicada_id` na condição do índice. Em `extensao_de_tempo` ele entra por `extensao_de_tempo_chave_por_aplicacao`, com `escola_id` e `atividade_aplicada_id` na condição. A prova agora exige mais do que antes. Tudo é desfeito pelo `rollback` do `finally`, e o teste não chama provedor pago.
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (não se aplica, nada no caminho quente)
Bloqueantes: nenhum
Recomendações:
- `apps/api/src/atividade/extensao.int.test.ts:545`: o `expect(...).toMatch(/escola_id/)` da tentativa é o único da série sem a mensagem `resumo`. Se falhar, mostra só `undefined`, sem o plano.
- No mesmo arquivo, a busca de `daTentativa` e `daExtensao` pode receber `expect(...).toBeDefined()` com `resumo`, antes do `toMatch`. Assim a falha aponta o índice ausente em vez de comparar a string `"undefined"`. O laço anterior já cobre esse caso, então é só para a mensagem ficar mais clara.

## test-engineer · 1ª rodada · APROVADO · 2026-11-28 09:31:05 · `tasks/correcoes/2026-11-28-extensao-explain-banco-acumulado.md`

VEREDITO: APROVADO

Cenários exigidos:
- Caminho feliz: o `EXPLAIN` da consulta do `AcompanhamentoRepository` entra pela chave única `tentativa_atividade_uma_por_aluno` e pela chave por aplicação `extensao_de_tempo_chave_por_aplicacao`, sem varredura sequencial.
- Borda 1, o banco de teste acumulado: o teste rodado sozinho, sem as aplicações que as outras suítes deixam.
- Borda 2, o arquivo inteiro: as aplicações já encerradas que os casos anteriores deixam na mesma escola, que somam tentativas já existentes no volume (por isso o `on conflict do nothing`).
- Borda 3, o índice só por escola: o `(escola_id, aluno_id)` também é índice e passava na asserção antiga só pelo nome e pelo `escola_id`.
- Permissão e isolamento: a correção não toca nisso. O volume fica preso à escola do teste (`escola_id = $1`), e o caso de isolamento do arquivo continua igual.
- Concorrência: não se aplica, porque não há operação de domínio nova.

Cobertos:
- O teste da correção roda sozinho e verde: `npx vitest run --project integracao apps/api/src/atividade/extensao.int.test.ts -t EXPLAIN` deu 1 de 1 sobre o banco acumulado do `educa-teste-3`.
- O arquivo inteiro também está verde: 20 de 20.
- O volume (200 aplicações encerradas, tentativas e extensões) fica dentro da transação que o `finally` desfaz, então nada sobra no banco (`apps/api/src/atividade/extensao.int.test.ts:495-518`).
- A prova ficou mais exigente, e nenhuma asserção saiu:
  - a condição da tentativa precisa citar `atividade_aplicada_id` (`:547`);
  - a da extensão precisa citar `escola_id` e `atividade_aplicada_id` (`:548-549`).
  Com o empate antigo, essas duas asserções ficariam vermelhas. Removida a cláusula da aplicação no repository, ou um dos dois índices, o teste falha.
- Nenhum código de produção mudou, então a ausência de bloco de mutação está correta (RF17 só vale para `apps/*/src` e `packages/*/src` fora de teste).
- Não há `.skip`, mock nem provedor de IA.

Bloqueantes: nenhum.

Recomendações:
1. `apps/api/src/atividade/extensao.int.test.ts:495-518`: os três `insert` não conferem quantas linhas gravaram. Se a fixture deixar de ter alunos com vínculo `confirmado` na turma, ou se o `vinculo` mudar de forma, o volume cai a zero sem aviso e o teste volta a depender do empate. Vale checar o `rowCount`: 200 aplicações, e ao menos 200 tentativas e 200 extensões.
2. `apps/api/src/atividade/extensao.int.test.ts:520`: o `analyze` roda dentro da transação desfeita. O `pg_statistic` volta no `rollback`, mas o `pg_class.reltuples` e o `relpages` são gravados no lugar e contam as linhas da própria transação. Depois do teste, as três tabelas ficam com contagem estimada inflada (cerca de 200 aplicações e 800 tentativas e extensões a mais por execução) até o próximo `analyze` ou autovacuum. Não quebra nada hoje, porque os outros `EXPLAIN` rodam o próprio `analyze`. Fica registrado para a retro, já que o mesmo padrão existe em `apps/api/test/arquivo-do-titular.int.test.ts`.
3. `apps/api/src/atividade/extensao.int.test.ts:545`: a asserção do `escola_id` da tentativa é a única do bloco sem a mensagem `resumo`. Quando falha, não mostra o plano.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-28 09:49:05 · `tasks/correcoes/2026-11-28-extensao-explain-banco-acumulado.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. A correção mexe só no teste e não toca código de produção, migration ou índice, como o documento declara.
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

Conferi o diff desde a rodada aprovada (`8a6fb12` a `37daf56`) contra o que a ordem r1 prometia.

- **Comentário encurtado:** feito. O comentário das linhas 491-494 virou duas linhas (491-492). Ele aponta a causa no documento da correção e foi unido ao da extensão, que saiu.
- **Mensagem `resumo` nas asserções:** feito. As asserções da tentativa (544-545) e da extensão (549) agora mostram o plano quando o índice não é achado, e não mais `expected undefined to be defined` sozinho.
- **Volume conferido:** a nova asserção na linha 517 exige 200 aplicações e ao menos 200 tentativas e 200 extensões. O `>= 200` está certo: o `where estado = 'encerrada'` também pega a aplicação que o caso "a prova encerrada pelo professor" deixa encerrada, então o total pode passar de 200.
- **Recusa do `on conflict`:** o motivo está na tabela "Recomendações sem aplicar" e se sustenta. Esse mesmo filtro alcança a aplicação encerrada que já tem tentativa, e sem a cláusula o arquivo inteiro cairia na chave única `tentativa_atividade_uma_por_aluno`.
- **O que sobrou de fora da ordem:** as constantes `aplicacoesNovas`, `tentativasNovas` e `extensoesNovas` só existem para a asserção do volume. Não há código morto nem asserção que sempre passa.

Recomendações:
- Linha 517 de `apps/api/src/atividade/extensao.int.test.ts`: como a comparação é feita em `true`/`false`, a falha mostra `[200, false, true]` sem dizer quantas linhas entraram. Passar os `rowCount` como mensagem do `expect`, por exemplo `` `aplicações ${a}, tentativas ${t}, extensões ${e}` ``, deixa a falha legível.
- Linhas 491-492 do mesmo arquivo: as duas linhas de comentário passam de 200 caracteres. Vale quebrar em três linhas curtas.
- Linhas 543-544: a busca do índice da tentativa repete a do laço das linhas 531-541, que já exige que ele exista. Não está errado, só é redundante.

## test-engineer · 2ª rodada · APROVADO · 2026-11-28 09:49:11 · `tasks/correcoes/2026-11-28-extensao-explain-banco-acumulado.md`

VEREDITO: APROVADO

Esta é a rodada 2. Conferi o diff desde a minha aprovação da rodada 1 e as duas recomendações que a ordem r1 aplicou. O teste do `EXPLAIN` passou ao rodar sozinho sobre o banco acumulado do `educa-teste-3` (1 passou, 19 pulados). Nenhum arquivo foi alterado.

Cenários exigidos (os mesmos da rodada 1):
- **Caminho feliz:** o plano entra pela chave única da tentativa e pela chave por aplicação da extensão, sem varredura sequencial.
- **Borda 1, o banco acumulado:** com uma ou duas linhas na escola, os índices empatam no custo, e o volume dentro da transação desfaz o empate.
- **Borda 2, o arquivo inteiro:** a escola `a` já tem uma aplicação encerrada com tentativa, e é por isso que o `on conflict` fica.
- **Volume vazio:** se a turma ficar sem aluno confirmado, o volume some e o empate volta sem aviso. Essa era a recomendação 1.
- **Permissão:** não se aplica, porque a correção só muda o teste.
- **Isolamento:** a condição dos dois índices precisa levar `escola_id`.

Cobertos:
- **Recomendação 1, feita** (`apps/api/src/atividade/extensao.int.test.ts:493`, `:499`, `:508` e `:517`).
  - Os três `insert` guardam o `rowCount`, e uma linha exige 200 aplicações novas e ao menos 200 tentativas e 200 extensões.
  - Sem aluno confirmado, as tentativas e as extensões dariam 0, e o teste cai na linha 517, antes do `EXPLAIN`, em vez de seguir com o empate.
  - Exigir "ao menos 200" e não exatamente 200 está certo, porque o `where` também pega a aplicação encerrada de outro caso (borda 2).
- **Recomendação 2, feita** (`:544-549`).
  - O índice da tentativa e o da extensão agora são exigidos com a mensagem `resumo` quando não são achados. A falha antes era "expected undefined to be defined", sem plano nenhum.
  - Agora ela mostra o plano, também na asserção do `escola_id` da tentativa (`:545`).
- **O que a rodada 1 já tinha aprovado continua igual.** A prova continua exigindo `escola_id` e `atividade_aplicada_id` na condição dos dois índices (`:547` e `:550`), e o `rollback` no `finally` segue lá.
- **Os comentários ficaram mais curtos e apontam para o documento da correção.** Nenhuma asserção foi tirada.
- **No documento, a linha nova em "Correção" e a tabela "Recomendações sem aplicar" batem com o diff.** A recusa de tirar o `on conflict` traz o motivo certo, que é a borda 2.

Bloqueantes: nenhum.

Recomendações:
- A asserção do volume compara uma lista (`[rowCount, bool, bool]`). Se cair, aparece `false` no lugar da contagem. Comparar `rowCount` por `rowCount`, com `toBeGreaterThanOrEqual(200)`, mostraria o número real. É só melhoria, não bloqueia.

Arquivos:
- apps/api/src/atividade/extensao.int.test.ts
- tasks/correcoes/2026-11-28-extensao-explain-banco-acumulado.md
