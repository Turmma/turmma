# Correção — os casos de volume do despachante preparam e diagnosticam pelo prazo de 2 s do pool, e caem com a suíte inteira

**Origem:** portão local de e2e e infra da spec (`portao-e2e-infra.log`, suíte `integracao`, 06/11/2026 07:40): vermelho com a suíte inteira, verde isolado. É o 2º caso de carga do despachante a cair assim no dia (o 1º foi o `slots`, correção `2026-11-06-slots-vaga-sem-depender-do-relogio`).
**Subagentes obrigatórios:** `test-engineer`, `infra-guardian`, `revisor-geral`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`
<!-- Os três primeiros vieram no PEDIDO do Orquestrador. `tenancy-guardian`, `privacy-guardian` e `conformidade-reviewer` entram por caminho (`tools/processo/guardioes-por-caminho.ts`): `apps/despachante/` pede tenancy, privacy e infra, e `apps/worker/test/queue.fixture.ts` pede os quatro, como a Mesa apontou na devolução. `revisor-geral` fica marcado porque a correção toca a fixture, compartilhada pelos testes do worker e do despachante. Os arquivos alterados são 5 fora de `tasks/` (`queue.fixture.ts`, `queue-fixtures.int.test.ts`, `janela`, `slots` e `queue-gauge`): o limite do `revisor-geral` é "mais de 5", então 5 ainda cabe, e ele está marcado pela fixture compartilhada. A correção não toca `.github/`, `tools/ci/` nem `tools/processo/`. -->

## Sintoma

```
FAIL |integracao| apps/despachante/test/janela.int.test.ts > lote não urgente segurado no horário letivo da escola >
  com 5.000 não urgentes segurados, a reserva dos urgentes desce pelo índice deles, sem atravessar os segurados
error: canceling statement due to statement timeout
 ❯ BoundPool.consultar [as query] packages/core/src/db/pool.ts:101:14
 ❯ apps/despachante/test/janela.int.test.ts:255:5
```

Uma vez em 578 arquivos, com a máquina carregada pela suíte inteira. A linha 255 era `bancada.pool.query('analyze job_registro')`. O arquivo, rodado sozinho, passa.

## Fora desta correção

Nada: não há tarefa em curso.

## Causa

O caso prepara o volume (5.000 não urgentes e um `ANALYZE`) e depois tira o `EXPLAIN ANALYZE` da instrução do repository. A regra que ele prova é o **formato do plano**: a reserva dos urgentes desce pelo índice parcial `job_registro_pendentes_urgentes_idx` e descarta no máximo uma linha. Mas a preparação e o diagnóstico saíam pelo `bancada.pool`, que tem o `statement_timeout` de **2 s** do worker em produção (`configuracaoDoBanco`). `job_registro` é uma tabela só, partilhada por todos os arquivos de integração da suíte: o `ANALYZE` espera o de outro arquivo (ou o autovacuum) e varre a tabela inchada de linhas de arquivos vizinhos, e passa dos 2 s. O teste caía por um prazo que não é a regra dele.

A fixture já tinha o caminho certo para isso, `semear`, com 60 s nos dois lados, e o caso da `queue-gauge` o usava para o `analyze`. Mas o `janela` não, e o `slots` e a `queue-gauge` tinham o mesmo defeito em outros pontos: o `analyze` do `slots`, o insert de 1.000 e 5.000 linhas de `inserirJobs`, e os três `EXPLAIN ANALYZE` (um do `slots`, dois da `queue-gauge`), todos pelo pool de 2 s.

**Examinados e não alterados**, de propósito: os limites de parede que medem uma promessa do produto, e não preparação (`redis-down` "a publicação com o Redis fora responde em menos de 1 s"; `redis-ready` e o `outbox-sweeper` "o tempo de desistir é o teto do comando mais 2 s"; `slots` "o interativo começa em menos de 2 s com 1.000 lotes na fila" e "a B começa em menos de 1,5 s"). São a regra, não ruído, e já têm folga declarada em comentário. Nenhum caiu. Se um deles aparecer vermelho na esteira, entra em correção própria com a causa dele.

## Teste que reproduz

O vermelho do caso antigo depende do que a suíte faz ao mesmo tempo no banco, mas dá para provocá-lo de forma determinística: um segundo cliente segura, por 20 s, o `SHARE UPDATE EXCLUSIVE` de `job_registro`, o mesmo lock que um `ANALYZE` de outro arquivo (ou o autovacuum) seguraria, e o caso é rodado sozinho. Esse lock só conflita com outro `ANALYZE`/`VACUUM`; inserts e deletes seguem.

- **Antes** (caso antigo, lock seguro): vermelho, `error: canceling statement due to statement timeout`, em `janela.int.test.ts:255:5`, 2.125 ms. Idêntico à esteira.
- **Depois** (caso novo, mesmo lock): verde. O `semear('analyze job_registro')` espera o lock soltar e o caso passa (18,7 s no total, os 20 s do lock).

Sem o lock, o caso novo rodado sozinho 10 vezes seguidas: passou 10 de 10.

Arquivo: `apps/despachante/test/janela.int.test.ts › com 5.000 não urgentes segurados, a reserva dos urgentes desce pelo índice deles, sem atravessar os segurados`. O lock foi provocado por um script fora do repositório (não entra no commit): o teste novo prova a regra sem depender dele.

## Correção

Só arquivos de teste; o código de produção não muda (o plano do repository está certo, e o prazo de 2 s do pool continua valendo para a instrução que o repository manda, que é a que o teste mede).

- `apps/worker/test/queue.fixture.ts`: o `semear` passa a devolver as linhas (`semear<Row>`, com `Record<string, unknown>` de padrão). Quem ignorava o retorno não muda, **exceto o teste da própria fixture** (`queue-fixtures.int.test.ts`), que esperava `toBeUndefined()` e a busca por chamadores deixou passar: a 1ª rodada o pegou, e ele foi conferido e corrigido (item abaixo). A fixture ganha o par `explicar<No>(texto, valores)`: o `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` da instrução, com o prazo da preparação (60 s nos dois lados) e numa transação sempre desfeita, devolvendo o nó raiz do plano. Os dois dividem um método privado, que ficou com o corpo antigo do `semear`.
- `janela.int.test.ts`: o insert de 5.000 e o `analyze` por `semear`; o `EXPLAIN` por `explicar`. Saiu o `bancada.pool.connect()` com `begin`/`rollback` à mão.
- `slots.int.test.ts`: `inserirJobs` por `semear` (devolve os ids), o `analyze` por `semear` e o `EXPLAIN` por `explicar`.
- `queue-gauge.int.test.ts`: os dois `EXPLAIN` por `explicar`. A forma do `EXPLAIN` mudou **de propósito**: de `(analyze, format json)` sem transação para `(analyze, buffers, format json)` numa transação desfeita. O efeito é neutro (as duas instruções são `SELECT`), e o `buffers` é o que `janela` e `slots` já pediam.
- `queue-fixtures.int.test.ts`: o caso do `semear` agora lê o retorno (`resolves.toEqual([{ pg_sleep: '' }])`) e segue provando que a instrução passa dos 4 s do cliente e dos 2 s do servidor, com o pool normal cortando em 2 s. Dois casos novos para o `explicar`: passa dos mesmos prazos e devolve o nó raiz do plano; e o `explicar` de um `update` roda a instrução de verdade e desfaz, com a linha relida ainda `aguardando`.
- Comentário do `explicar`: só aceita a instrução que o repository mandou, com os valores à parte, porque o texto entra por junção.

O que cada caso mede continua pelo pool de 2 s: a reserva dos urgentes (`reservarDaEscola`), a renovação (`publicadosEntre`), `medirPendentes` e `medirFalhos` rodam pelo pool que o teste cria, com o `timeoutConsultaMs` de produção.

Estabilidade: o caso corrigido, sozinho, 10 de 10 (medido antes de a ordem r1 acrescentar o arquivo da fixture); os três arquivos do despachante, inteiros, 41 casos verdes; `queue-fixtures.int.test.ts`, 3 casos verdes. O portão final rodou os quatro arquivos.

## Mutações

--faltando: 0 linhas (3 blocos, 0 motivos)

A correção não acrescenta cláusula de produção. O bloco prova que o caso novo continua guardando a regra, e que o `explicar` lê o plano de verdade: com o predicado reescrito de um jeito que o Postgres não casa com o índice parcial (`not (nao_urgente is true)`, mesmo resultado, plano outro), o caso cai na asserção do índice.

```mutacao
arquivo: packages/core/src/queue/dispatch.repository.ts
teste: apps/despachante/test/janela.int.test.ts › com 5.000 não urgentes segurados
falha: expect(nos.map((no) => no['Index Name'])).toContain('job_registro_pendentes_urgentes_idx')
-    const urgencia = soUrgentes ? sql`and not nao_urgente` : sql``
+    const urgencia = soUrgentes ? sql`and not (nao_urgente is true)` : sql``
     const resultado = await this.banco.execute<ReservedJob>(sql`
```

Os dois blocos novos são das cláusulas da fixture: o rollback do `explicar` e o prazo de 60 s dele. Sem o rollback, o `update` explicado deixa a linha `concluido`; sem o `set local statement_timeout`, o `pg_sleep(4.5)` morre nos 2 s do pool.

```mutacao
arquivo: apps/worker/test/queue.fixture.ts
teste: apps/worker/test/queue-fixtures.int.test.ts › explicar de uma escrita
falha: expect((await bancada.estado(id))?.estado).toBe('aguardando')
-    const [linha] = await this.#comPrazoDaPreparacao<{ 'QUERY PLAN': Array<{ Plan: No }> }>(`explain (analyze, buffers, format json) ${texto}`, valores, 'rollback')
+    const [linha] = await this.#comPrazoDaPreparacao<{ 'QUERY PLAN': Array<{ Plan: No }> }>(`explain (analyze, buffers, format json) ${texto}`, valores, 'commit')
```

```mutacao
arquivo: apps/worker/test/queue.fixture.ts
teste: apps/worker/test/queue-fixtures.int.test.ts › explicar passa dos 4 s
falha: .resolves.toMatchObject({ 'Node Type': 'Result' })
       await cliente.query('begin')
-      await cliente.query(`set local statement_timeout = '${PRAZO_DA_PREPARACAO_MS}ms'`)
       // O cliente espera um pouco mais que o servidor: quem corta é o Postgres, com o 57014 legível, e a
```

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-06 08:15:53 | 2026-11-06 08:16:11 | `privacy-guardian` | 1 | APROVADO | a4d2e19aba7aecafd |
| 2026-11-06 08:15:52 | 2026-11-06 08:16:12 | `tenancy-guardian` | 1 | APROVADO | af8b8c2f463a76dbd |
| 2026-11-06 08:15:50 | 2026-11-06 08:16:31 | `infra-guardian` | 1 | REPROVADO | addf1822624366232 |
| 2026-11-06 08:15:51 | 2026-11-06 08:16:34 | `revisor-geral` | 1 | REPROVADO | ae4078a6eb900fccb |
| 2026-11-06 08:15:54 | 2026-11-06 08:16:36 | `conformidade-reviewer` | 1 | REPROVADO | ae264019652e5a58d |
| 2026-11-06 08:15:49 | 2026-11-06 08:17:04 | `test-engineer` | 1 | REPROVADO | afa697ce2ac028a35 |
| 2026-11-06 08:25:11 | 2026-11-06 08:25:35 | `revisor-geral` | 2 | APROVADO | a2a8114dc817be205 |
| 2026-11-06 08:25:04 | 2026-11-06 08:26:11 | `infra-guardian` | 2 | APROVADO | a566774e70983b1f0 |
| 2026-11-06 08:24:59 | 2026-11-06 08:26:17 | `test-engineer` | 2 | APROVADO | a0dcdc4bc9f33e838 |
| 2026-11-06 08:25:19 | 2026-11-06 08:26:35 | `conformidade-reviewer` | 2 | APROVADO | ac22d64609388ca15 |

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (2ª), test-engineer (2ª) | A linha "Estabilidade" do documento ainda dizia "os três arquivos inteiros, 41 casos verdes", anterior à entrada de `queue-fixtures.int.test.ts` | Aplicada no texto do documento, antes do commit |
| revisor-geral (2ª), test-engineer (2ª) | No caso do `update`, ler o estado da linha antes do `explicar` | Recusada: mexer no teste caduca `test-engineer` e `revisor-geral` por ganho de clareza; a asserção final já exige `aguardando` e o `test-engineer` registrou que não bloqueia |
| infra-guardian (2ª) | O caso do `update` deixa a rede e a escola sintéticas de `bancada.escola()` no banco de teste | Recusada: é o padrão dos outros testes da bancada; fica para a retro se a tabela de escolas do banco de teste crescer a ponto de pesar |
| conformidade-reviewer (2ª) | Travar o `explicar` contra texto com `;` | Recusada: o `explicar` é fixture de teste e o comentário já avisa; a trava só vale se ele passar a ser usado fora dos testes de plano |
| tenancy-guardian (1ª), privacy-guardian (1ª), infra-guardian (1ª), test-engineer (1ª), revisor-geral (1ª) | As recomendações da 1ª rodada | Aplicadas na ordem r1 |

