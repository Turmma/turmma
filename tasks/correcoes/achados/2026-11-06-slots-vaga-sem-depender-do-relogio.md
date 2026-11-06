# Achados das revisões — `tasks/correcoes/2026-11-06-slots-vaga-sem-depender-do-relogio.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-06 07:27:36 · `tasks/correcoes/2026-11-06-slots-vaga-sem-depender-do-relogio.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration. A tarefa muda só o arquivo `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/despachante/test/slots.int.test.ts` e o documento da correção.

Queries verificadas:
- Nenhuma query de produção mudou. O caminho da mutação, `vagas.manter` e depois `vagas.livres` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/despachante/src/outbox-relay.ts:171-172`, está igual.
- No teste, a chave da vaga continua montada por escola, com `bancada.vagas.chave('lote', ESCOLA_A)`. A escrita direta no ZSET usa `ZADD XX` e só altera membros que já existem naquela chave. Ela não cria vaga e não alcança a chave de outra escola.
- A segunda metade mantém a prova por escola. A A não passa de duas, conferido por `processador.maximo('A') === 2`, e a B começa enquanto a pilha da A espera.

Teste de isolamento: presente e efetivo.
- Tirando o `manter` da rodada, a vaga fica a 5 s de vencer e falha `toBeGreaterThanOrEqual(VALIDADE_DA_VAGA_MS)` já na primeira validade. Isso vale sempre, não depende de corrida.
- A garantia de teto por escola (`waiting: 2`, 2 `publicado`, `maximo('A') === 2`) e a de entrada da B continuam sendo verificadas.

Bloqueantes: nenhum.

Recomendações:
- O prazo de espera da B subiu de 3 s para 10 s. Se a regra é "a B entra sem esperar a pilha da A", vale também verificar que nenhum lote da A concluiu antes de a B começar. Do jeito que está, o teste prova que a B entra antes de a pilha da A acabar, mas não que ela entra cedo.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-06 07:27:41 · `tasks/correcoes/2026-11-06-slots-vaga-sem-depender-do-relogio.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A mudança fica no teste do despachante. Ela mexe só nas vagas por escola (o vencimento no ZSET do Redis, guardado por `jobId`), em `job_registro` com `tipo` `'sintetico'` e no payload `{ rotulo: 'A' | 'B' }`. Nenhum desses é dado de pessoa.

Fora da tabela de dados do docs/lgpd.md: nada. Não há migration nem campo novo, e o código de produção não muda. O bloco de mutação só altera `apps/despachante/src/outbox-relay.ts` por um instante durante o portão.

Autorização por objeto: não se aplica. Não há rota nem endpoint novo. O escopo por escola das vagas segue o mesmo: a chave continua `bancada.vagas.chave('lote', ESCOLA_A)`.

Logs: limpos. Não há chamada de log nova. Os `InMemoryLog` recebem só nomes de componente (`'despachante'`, `'worker-lote'`).

Auditoria: não se aplica. Não há leitura de dado de aluno, exportação, nota, permissão nem aprovação de saída de IA.

Envio externo: nenhum.

Seed/fixture: sintético. As escolas vêm de `bancada.escola()` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/despachante/test/slots.int.test.ts:114`). Os jobs são `'sintetico'`, com rótulos de uma letra (`slots.int.test.ts:129-138`).

Bloqueantes: nenhum.

Recomendações: nenhuma pela regra 20. A troca do relógio de parede pela rodada chamada à mão, com o `TIME` do Redis, é assunto do `test-engineer` e do `infra-guardian`. Não muda nada na exposição nem na coleta de dados.

Pergunta de fechamento: esta correção não muda o que o sistema guarda sobre um aluno nem para onde isso é enviado. A resposta à secretaria continua a mesma de antes da correção.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/despachante/test/slots.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/correcoes/2026-11-06-slots-vaga-sem-depender-do-relogio.md`

## revisor-geral · 1ª rodada · APROVADO · 2026-11-06 07:27:43 · `tasks/correcoes/2026-11-06-slots-vaga-sem-depender-do-relogio.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/despachante/test/slots.int.test.ts:159`: o comentário virou uma linha só, bem mais longa que as vizinhas, que quebram por volta de 140 colunas. Vale quebrar no mesmo padrão.
- Na mesma linha 159: a trava `expect(timeout).toBeLessThan(VALIDADE_DA_VAGA_MS / 2)` agora só protege contra a validade padrão de 60 s, porque o teste com validade de 1 s saiu. Ela continua certa, mas o motivo dela ficou mais fraco. Se nenhum caso futuro voltar a usar validade curta, dá para simplificar.
- No documento da tarefa, linha 64: a linha `--faltando: 0 linhas (1 blocos, 0 motivos)` é saída da ferramenta e fica estranha no meio do texto. Não muda a correção.

Sobre a correção em si:
- **Só o teste mudou.** O código de produção ficou igual, como o documento declara.
- **O caso novo segue um padrão que o arquivo já usa.** O teste da vaga do worker morto, por volta das linhas 296 a 315, já lê o `TIME` do Redis e escreve no ZSET com `ZADD XX`. Não é um segundo jeito de fazer a mesma coisa.
- **A mutação está bem fundamentada.** Sem `vagas.manter` na rodada, a vaga fica a 5 s de vencer e falha o `>= VALIDADE_DA_VAGA_MS` (60 s, conferido em `packages/core/src/queue/escola-concurrency-limiter.ts:8`).
- **A segunda parte do teste não perdeu o que provava.** Ela trocou a validade de 1 s e a renovação de 200 ms pelos valores padrão. As asserções `maximo('A') === 2` e o estado `concluido` continuam lá.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-06 07:27:56 · `tasks/correcoes/2026-11-06-slots-vaga-sem-depender-do-relogio.md`

VEREDITO: APROVADO
Caminho quente tocado: fila (só o teste; nenhum código de produção mudou)
Rate limit: ok (não foi alterado)
Fila e prioridade: ok
Concorrência: protegida (a regra da vaga em `concurrency-slot.lua` e em `vagas.manter` não mudou; o caso novo prova a renovação sem depender do relógio)
Índice e paginação: ok (não se aplica, nenhuma query nova)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (não foi alterado)
Bloqueantes: nenhum

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/despachante/test/slots.int.test.ts:384`: o prazo de espera da B subiu de 3 s para 10 s. Esse prazo não prova mais que "a B entra sem esperar a pilha da A". Quem prova é o `maximo('A') === 2`, e o comentário da linha 379 pode deixar isso explícito, para ninguém ler o prazo como garantia de latência.
- A mutação declarada (tirar o `vagas.manter` da rodada em `apps/despachante/src/outbox-relay.ts`) deve ser conferida pela ferramenta de mutação do portão. Eu não a rodei porque esta auditoria não edita arquivo.

O que conferi:
- Rodei o caso alterado (`-t "segura a vaga"`) e ele passou: 1 de 1, em 4,99 s.
- A rodada chamada à mão já espera o Redis conectar antes de rodar, porque o embrulho do despachante na bancada de teste (`apps/worker/test/queue.fixture.ts:122`) aguarda o `pronto`.
- A comparação `vencimento - agoraMs >= VALIDADE_DA_VAGA_MS` usa o `TIME` do Redis, o mesmo relógio do Lua. Por isso ela não fica frágil quando a máquina está carregada.
- `esperar` continua sendo usado em outros pontos do arquivo, então não sobra import morto.
- O teste não chama provedor pago.

## test-engineer · 1ª rodada · APROVADO · 2026-11-06 07:28:29 · `tasks/correcoes/2026-11-06-slots-vaga-sem-depender-do-relogio.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- Caminho feliz: um despachante sem worker publica só até o teto de lote da escola A (2), e a vaga desses publicados parados na fila não vence.
- Borda da vaga: a vaga está a ponto de vencer quando a rodada passa. A rodada precisa renová-la por uma validade inteira, e uma vaga já vencida não volta.
- Borda da réplica que volta: a A continua com no máximo 2 jobs ao mesmo tempo, e a B entra e conclui.
- Repetição: três validades seguidas sem worker, sem nenhum publicado acima do teto.
- Isolamento entre escolas: a vaga é contada por escola (chave por `escolaId`), e a B não fica presa atrás da A.
- Permissão: não se aplica. A correção mexe só em um teste do despachante e não toca rota nem papel.
- Concorrência: não se aplica como cenário novo. A correção não cria operação que possa rodar duas vezes ao mesmo tempo. O caso dos dois despachantes simultâneos continua coberto pelo teste da linha 187, que não mudou.

**Cobertos:**
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/despachante/test/slots.int.test.ts:353-388`:
  - A primeira `rodada()` publica 2.
  - Nas três validades, o teste coloca a vaga a 5 s de vencer direto no Redis, roda uma rodada e confere quatro coisas: a rodada publica 0; cada vaga volta a valer `>= VALIDADE_DA_VAGA_MS`, medido pelo relógio do próprio Redis; a fila tem `waiting: 2`; o banco tem 2 `publicado`.
  - Depois o worker sobe, a B conclui, todos os jobs da A concluem e `maximo('A') === 2`.
- Mutação: o bloco tira `vagas.manter` de `apps/despachante/src/outbox-relay.ts:171`. Conferi o código: sem o `manter`, a vaga fica em `agora + 5 s`, e a asserção da linha 373 cai (5000 < 60000) sempre, sem depender da velocidade da máquina. O vermelho vem pelo motivo certo, porque a rodada chega ao `manter` (linhas 168-172).
- A correção não muda código de produção. O `--faltando` dá 0 linhas, e não há cláusula nova sem bloco.
- O teste não depende mais do relógio. O intervalo que importa é entre o `zadd` e o `manter` da mesma rodada, e a margem de 5 s está longe dos milissegundos que ele leva. A segunda metade passou a usar as validades padrão (60 s de validade, 15 s de renovação), o que tira a fragilidade de 1 s também ali.
- Rodei o caso sozinho (`-t "segura a vaga além da validade"`): verde, 1 passou e 18 pulados pelo filtro, em 4,98 s.
- Não há `.skip`, teste comentado, mock da regra nem provedor de IA: o teste usa Postgres, Redis e BullMQ de verdade.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `slots.int.test.ts:379` e `:384`: o comentário diz que "a B entra sem esperar a pilha da A", mas o prazo de 10 s não prova isso. A pilha da A leva cerca de 1,5 s (10 jobs de 300 ms, 2 por vez). O prazo antigo de 3 s também não provava. A regra está provada no teste da linha 187. Há duas saídas: tirar a afirmação do comentário, ou provar a ordem, por exemplo exigindo que a B comece antes de a A terminar todos os jobs (`iniciados('A') < 10` no momento em que `iniciados('B') === 1`).
2. `slots.int.test.ts:370` e `:375-376`: sem o `manter`, a vaga ainda vale 5 s, então essas asserções passam de qualquer jeito. Quem guarda a regra é só a linha 373. Elas não estão erradas (conferem que nada vazou acima do teto), mas vale um comentário dizendo que a renovação é provada na 373, para ninguém tirá-la achando que as outras bastam.
3. Fora do diff, `slots.int.test.ts:340-341`: o teste de renovação do worker ainda depende do relógio. Ele espera 500 ms de parede contra uma renovação a cada 200 ms, o mesmo tipo de fragilidade sob carga que esta correção tirou. Vale pôr na lista de candidatos a passar por relógio do Redis ou por renovação acionada à mão, se ele aparecer vermelho na esteira.
4. O documento da correção, nas linhas 38-40 e 60, conta que o teste foi rodado com a máquina sob carga para reproduzir o erro. Isso vale como diagnóstico. Mas o argumento de estabilidade que fica registrado deve ser o do desenho (sem relógio de parede), e não o "5 de 5 sob carga", que não serve de prova.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-06 07:35:17 · `tasks/correcoes/2026-11-06-slots-vaga-sem-depender-do-relogio.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. A correção mexe só no teste e no documento, e o código de produção não muda.
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

As quatro ordens de `.processo/ordens/2026-11-06-slots-vaga-sem-depender-do-relogio-r1.md` foram aplicadas:
1. **Comentário do prazo de 10 s**, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/despachante/test/slots.int.test.ts:382-383`: deixou de prometer que o prazo prova a latência da B. Agora diz que o prazo é só folga e manda para o caso dos 1.000 lotes. Esse caso, em `slots.int.test.ts:188-211`, de fato exige `< 1_500 ms` e `> 900` lotes ainda aguardando, então a referência vale.
2. **Asserção que guarda a renovação**, em `slots.int.test.ts:372-373`: o comentário diz que a asserção do vencimento é a que prova a renovação, e que as duas de baixo só conferem que nada passou do teto.
3. **Comentário de `aguardarVagaVazia`**, em `slots.int.test.ts:159-160`: foi quebrado no mesmo padrão das linhas vizinhas.
4. **Documento da correção**, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/correcoes/2026-11-06-slots-vaga-sem-depender-do-relogio.md:40` e `:60`: o resultado sob carga ficou só como diagnóstico, e a estabilidade passou a se apoiar no desenho. A seção "Recomendações sem aplicar" traz os quatro itens da tabela "Sem aplicar", com motivo, e a linha prometida está no `TODO.md`.

O diff altera apenas comentários no `.ts`. Nenhuma asserção nem comportamento mudou, e o bloco de mutação continua o mesmo.

Recomendações:
- `slots.int.test.ts:383`: "no caso das 1.000 lotes da A" tem erro de concordância e deve ser "no caso dos 1.000 lotes da A".
