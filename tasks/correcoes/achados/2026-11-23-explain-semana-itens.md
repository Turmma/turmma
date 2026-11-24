# Achados das revisões — `tasks/correcoes/2026-11-23-explain-semana-itens.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-23 22:48:41 · `tasks/correcoes/2026-11-23-explain-semana-itens.md`

VEREDITO: APROVADO
Tabelas verificadas: `atividade_aplicada` (a restrição única `atividade_aplicada_escola_ano_turma_artefato_id_unico` em `packages/core/src/db/schema/atividade-aplicada.ts:65` começa por `escola_id, ano_letivo_id, turma_id`) e `entrega`. A correção não cria nem altera tabela.
Queries verificadas: `SemanaRepository.consultasDosItens` (`aplicadas`, `encerradas`, `lotes`), só pelo `EXPLAIN` do teste. A correção não toca código de produção, e o contexto do repository continua vindo de `runInContext`, não de parâmetro do cliente.
Teste de isolamento: presente e efetivo. A correção não cria teste de isolamento, e não precisa: só põe o índice novo na lista dos aceitos. Sem o escopo da escola, o teste continua falhando: `apps/api/test/semana-itens.int.test.ts:403` ainda exige `escola_id` antes de `turma_id` na condição do índice, e a linha 404 ainda recusa `Seq Scan` na tabela. Os três nomes aceitos na linha 384 são índices que começam pela escola, então aceitar mais um não abre caminho para um plano sem escopo.
Bloqueantes: nenhum
Recomendações:
- `apps/api/test/semana-itens.int.test.ts:403`: a regex `/escola_id.*turma_id/` não exige `ano_letivo_id`, embora os três índices aceitos o tenham entre a escola e a turma. Essa lacuna já existia antes desta correção. Trocar por `/escola_id.*ano_letivo_id.*turma_id/` faria o teste provar também o escopo do ano letivo nas consultas da atividade aplicada.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-23 22:48:41 · `tasks/correcoes/2026-11-23-explain-semana-itens.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- O teste em `apps/api/test/semana-itens.int.test.ts` passou a aceitar três índices, mas a exigência continua a mesma. O índice novo foi conferido em `packages/core/drizzle/0068_prova_online.sql:96` e começa por `escola_id`, `ano_letivo_id` e `turma_id`. As duas exigências que importam seguem no teste: a condição do índice cita `escola_id` antes de `turma_id`, e nenhum `Seq Scan` é aceito. Nenhuma consulta nem índice de produção mudou.
- Toda vez que o planejador escolher outro índice com o mesmo prefixo, a lista de nomes vai precisar de ajuste. Vale trocar a lista fixa por uma regra: aceitar qualquer índice da `atividade_aplicada` cuja condição traga `escola_id` e `turma_id`, o que a asserção seguinte já confere. Assim o teste para de quebrar a cada restrição nova sem perder o que prova.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-23 22:48:44 · `tasks/correcoes/2026-11-23-explain-semana-itens.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok (a correção mexe só no teste e não muda nenhuma consulta, índice ou migration)
Portão local: carimbo válido (`portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)`)
Bloqueantes: nenhum

Conferi que o índice novo existe. A restrição única `atividade_aplicada_escola_ano_turma_artefato_id_unico` está em `packages/core/drizzle/0068_prova_online.sql:96` e em `packages/core/src/db/schema/atividade-aplicada.ts:65`. As colunas são `(escola_id, ano_letivo_id, turma_id, artefato_id, id)`, então a consulta continua entrando pela escola e pela turma.

O teste não ficou mais frouxo. Em `apps/api/test/semana-itens.int.test.ts:399-403` seguem as três exigências:
- o plano passa por um índice da lista;
- a condição desse índice cita `escola_id` antes de `turma_id`;
- não há nenhum `Seq Scan` na tabela.

A lista nova inclui só índices que começam por escola, ano e turma. A causa registrada no documento é a mesma que o diff resolve.

Recomendações:
- `semana-itens.int.test.ts:383`: o comentário diz que o índice novo "passou a ser o escolhido". Isso descreve o que o planejador fez hoje e envelhece na próxima mudança de estatística ou de índice. Basta dizer que todos os índices da lista começam pela escola, pelo ano e pela turma, que é o que o teste exige.
- Na retro: a tarefa 1.0 criou um índice que mudou o plano de uma consulta de outro módulo, e o portão dela não rodou `semana-itens.int.test.ts`. Uma migration que cria índice em `atividade_aplicada` poderia puxar para o portão os testes de `EXPLAIN` que usam essa tabela.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-23 22:48:45 · `tasks/correcoes/2026-11-23-explain-semana-itens.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A mudança só alarga a lista de índices aceitos no `EXPLAIN` de `apps/api/test/semana-itens.int.test.ts:382-388`. Nenhum código de produção, consulta, schema ou caminho que grave `Nota` foi alterado. Todos com autor humano? sim, nada mudou.
Decisão autônoma sobre aluno: ausente.
Aprovação registrada: ok. O teste já gravava `entrega` com `funcao 'correcao_de_objetiva'` e `estado 'pendente'` (linha 372), e o diff não mexe nisso. A entrega continua nascendo pendente.
Supervisão do tutor: ok, não foi tocada.
Autonomia declarada e visível: sim, não foi tocada.
Bloqueantes: nenhum.

O que conferi:
- O índice novo existe de fato: `packages/core/drizzle/0068_prova_online.sql:96` e `packages/core/src/db/schema/atividade-aplicada.ts:65`, sobre `(escola_id, ano_letivo_id, turma_id, artefato_id, id)`.
- O teste continua tão exigente quanto antes. A condição do índice ainda precisa citar `escola_id` antes de `turma_id` (linha 404), e nenhum `Seq Scan` na tabela é aceito (linha 405).
- Os itens 2a, 7, 8 e 9 da regra 70 (nota proposta em discursiva ou redação, vigilância, medir o professor, indicador de recusa) não são alcançados pelo diff.

Recomendações:
- O cabeçalho da tarefa lista `conformidade-reviewer` como obrigatório só porque `portao-local.ts revisores` o pede para o caminho. Vale o portão distinguir mudança só de teste de desempenho, que não toca nota, correção, tutor, autonomia nem indicador de professor, para não chamar esta revisão sem necessidade.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-23 22:48:45 · `tasks/correcoes/2026-11-23-explain-semana-itens.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A correção muda só a lista de índices que o teste do `EXPLAIN` aceita em `apps/api/test/semana-itens.int.test.ts:382-387`. Nenhuma migration, schema, DTO, rota, repository ou código de `src` foi alterado.

Fora da tabela de dados do docs/lgpd.md: nada. Não entrou campo novo. O índice `atividade_aplicada_escola_ano_turma_artefato_id_unico` veio da tarefa 1.0 (`packages/core/drizzle/0068_prova_online.sql:96`, `packages/core/src/db/schema/atividade-aplicada.ts:65`) e só junta colunas de escopo e ids. Não guarda dado de pessoa.

Autorização por objeto: ok. A consulta de produção não mudou, e o teste não ficou mais permissivo. Ele continua exigindo que a condição do índice cite `escola_id` antes de `turma_id` (linha 401) e continua recusando qualquer `Seq Scan` na tabela (linha 402). O índice novo também começa por `escola_id, ano_letivo_id, turma_id`, então o caminho pelo escopo do tenant segue provado.

Logs: limpos. O diff não adiciona log. A mensagem da asserção (`resumo`) traz só tipo de nó, tabela, nome do índice e condição do plano, sem valores de pessoa.

Auditoria: não se aplica. A tarefa não tem leitura por coordenação ou rede, exportação, alteração de nota, alteração de permissão nem aprovação de saída de IA.

Envio externo: nenhum.

Seed/fixture: sintético. O volume do teste vem de `generate_series` com `gen_random_uuid()` e roda dentro de uma transação que termina em `rollback` (linhas 362-373 e 405). Não há nome, matrícula nem conteúdo.

Bloqueantes: nenhum.

Recomendações:
- O documento da correção diz que a tarefa 1.0 falhou só na esteira porque o portão dela não rodou `semana-itens.int.test.ts`. Vale levar isso à retro: migration que cria índice em tabela de domínio deveria fazer o portão rodar os testes de `EXPLAIN` que olham essa tabela. É uma lacuna de processo, não de privacidade.

Pergunta de fechamento: a tarefa não muda o que o sistema guarda sobre um aluno nem para onde envia. A resposta continua a mesma de antes.

## test-engineer · 1ª rodada · APROVADO · 2026-11-23 22:49:07 · `tasks/correcoes/2026-11-23-explain-semana-itens.md`

VEREDITO: APROVADO

**Cenários exigidos:** esta correção só conserta um teste de plano de consulta, então os cenários do domínio escolar não se aplicam. O que precisa estar provado é isto:
- a consulta `aplicadas`, a `encerradas` e a `lotes` entram por um índice que começa pela escola e pela turma;
- a condição desse índice cita `escola_id` antes de `turma_id`;
- nenhuma das três lê a tabela inteira (`Seq Scan`);
- a regra continua sendo cobrada com o índice único novo da migration 0068, `(escola_id, ano_letivo_id, turma_id, artefato_id, id)`, que o planejador passou a escolher.

**Cobertos:**
- Em `apps/api/test/semana-itens.int.test.ts:384-388`, a lista de índices aceitos ganhou só o índice novo. Ele existe em `packages/core/src/db/schema/atividade-aplicada.ts:65` e começa pela escola, pelo ano e pela turma.
- As linhas 401 a 404 não mudaram e continuam exigindo três coisas: um índice da lista, a condição com `escola_id` antes de `turma_id` e nenhum `Seq Scan`. Se a consulta perdesse o filtro de escola ou de turma, a linha 403 falharia, porque nenhum dos três índices aceitos traria essa condição. A exigência não baixou.
- Rodei `npx vitest run --project integracao apps/api/test/semana-itens.int.test.ts`: os 15 casos passaram.
- O documento declara "Sem mutação" com motivo, e o motivo é verdadeiro: o diff altera só um teste de integração e nenhum arquivo de `apps/*/src` nem de `packages/*/src`. Não há cláusula nova sem bloco.
- Não encontrei `.skip`, teste comentado, mock nem chamada a provedor de IA. Concorrência não se aplica.

**Bloqueantes:** nenhum.

**Recomendações:**
- `semana-itens.int.test.ts:384`: a lista fixa de nomes vai quebrar de novo na próxima vez que uma migration criar outro índice que comece por `(escola, ano, turma, …)`. A cobrança real já está na condição do índice (linha 403) e na ausência de `Seq Scan` (linha 404). Daria para aceitar qualquer índice da tabela cuja condição cite `escola_id` antes de `turma_id`, ou então conferir as colunas iniciais do índice no catálogo do Postgres (`pg_index`) em vez do nome. A validação pode decidir.
- Para a retro: a falha nasceu na tarefa 1.0 porque o portão dela não roda o teste de integração que o diff não tocou. Vale registrar que migration que cria índice em tabela consultada por teste de `EXPLAIN` deveria rodar esses testes, por exemplo os que fazem `grep` pelo nome da tabela.

## revisor-geral · 2ª rodada · REPROVADO · 2026-11-23 22:58:53 · `tasks/correcoes/2026-11-23-explain-semana-itens.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: ok (é uma correção que só altera teste, sem seção da techspec envolvida)
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")

Bloqueantes:
- `apps/api/test/semana-itens.int.test.ts:382`: o comentário novo diz que os três índices "começam pela escola, pelo ano e pela turma". Isso é falso para o `atividade_aplicada_turma_idx`. No schema (`packages/core/src/db/schema/atividade-aplicada.ts:84`) e na migration (`packages/core/drizzle/0022_mvp_apresentacao.sql:423`) ele é `(escola_id, turma_id, id)`, sem `ano_letivo_id`. Os outros dois estão certos. O `..._escola_ano_turma_id_unico` (linha 64, migration 0023) é `(escola_id, ano_letivo_id, turma_id, id)`. O `..._escola_ano_turma_artefato_id_unico` (linha 65, migration 0068) é `(escola_id, ano_letivo_id, turma_id, artefato_id, id)`.
  - Por que bloqueia: a correção que a Mesa exigiu era deixar esse comentário fiel ao que existe, e ele continua errado. O erro também esconde uma lacuna. Quem lê o comentário conclui que o índice aceito sempre filtra pelo ano letivo. A asserção, porém, só exige `/escola_id.*turma_id/`, e o teste passa por um índice sem ano. É exatamente a lacuna que o `tenancy-guardian` registrou na 1ª rodada. O comentário ainda contradiz o próprio documento da correção, que na seção "Correção" diz certo: "os três índices que começam pela escola e pela turma".
  - Correção exigida: reescrever o comentário para dizer só o que vale para os três, que todos começam pela escola e pela turma. Se quiser citar o ano, deixar explícito que o `atividade_aplicada_turma_idx` não o tem. Exemplo: "todos começam pela escola e, depois do ano nos dois únicos, pela turma; a asserção abaixo exige que a condição cite a escola e a turma".

Recomendações:
- O resto da frase nova está certo e pode ficar: "qual deles o planejador escolhe depende das estatísticas e dos índices que existem". Ele tira do comentário a dependência do plano de hoje, que era o problema da rodada anterior.
- Concordo com as recomendações que a seção "Recomendações sem aplicar" do documento registrou e com o destino dado a elas (`TODO.md` e retro da spec). Não tenho nada a acrescentar.

## revisor-geral · 3ª rodada · APROVADO · 2026-11-23 23:10:24 · `tasks/correcoes/2026-11-23-explain-semana-itens.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

A correção exigida na 2ª rodada foi feita. O comentário em `apps/api/test/semana-itens.int.test.ts:382-384` agora diz só o que vale para os três índices: todos começam pela escola, com a turma logo depois ou depois do ano. Também diz que o `atividade_aplicada_turma_idx` não tem o ano. Conferi o comentário contra a definição dos índices:
- `atividade_aplicada_turma_idx` é `(escola_id, turma_id, id)`, em `packages/core/src/db/schema/atividade-aplicada.ts:84` e na migration `0022_mvp_apresentacao.sql:423`.
- Os dois índices únicos são `(escola_id, ano_letivo_id, turma_id, ...)`, em `atividade-aplicada.ts:64-65` e nas migrations `0023_mvp_restricoes.sql:35` e `0068_prova_online.sql:96`.

Desde a rodada anterior, a única mudança em `apps/` é esse comentário, então nada mais do teste foi afetado.

Recomendações:
- `semana-itens.int.test.ts:382`: o trecho "os dois únicos com o ano entre elas" pode ser lido como "os dois únicos índices que têm o ano", quando quer dizer as duas restrições `unique`. Dá para escrever pelos nomes, "as duas restrições `..._unico` têm o ano entre a escola e a turma", e acabar com a dúvida.
