# Achados das revisões — `tasks/correcoes/2026-11-16-uuid-no-log-do-job-timeout.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-16 05:00:44 · `tasks/correcoes/2026-11-16-uuid-no-log-do-job-timeout.md`

VEREDITO: APROVADO

Escopo: respeitado. Só mudou código de teste: `apps/worker/test/queue.fixture.ts`, `apps/worker/test/job-timeout.int.test.ts` e o novo `apps/worker/test/in-memory-log.test.ts`. Nenhum arquivo de `apps/*/src` nem de `packages/*/src` foi tocado. O documento da correção diz "Fora desta correção: nada", e o diff confirma.

Aderência à Tech Spec: ok. Nenhuma arquitetura muda. A busca passa a ignorar os UUIDs do log, o que corrige o falso positivo sem afrouxar o que o caso prova: um valor que vaza como campo, como `"prazoMs":4242`, continua sendo achado.

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo).

Bloqueantes: nenhum.

Conferi três pontos:
- **O teste novo roda.** A config do vitest separa os testes de unidade (`**/*.test.ts`, menos os `*.int.test.ts`), e o `in-memory-log.test.ts` cai nessa parte, ao lado do `wait-for-redis.test.ts`, que já existia.
- **O teste que reproduz não depende de sorte.** O `jobId` `…-594242a7b87a` está escrito no teste. Ele confirma antes que o texto solto contém `4242` e depois que `contemValor` devolve `false`. Um segundo caso mostra que o valor fora de um id continua sendo achado.
- **A mutação declarada derruba o teste.** Tirar o `.replace(UUID_NO_TEXTO, '')` faz o primeiro caso falhar.

Recomendações:
- A expressão `UUID_NO_TEXTO` (`apps/worker/test/queue.fixture.ts:76`) apaga qualquer UUID, não só os ids sorteados. Hoje isso não pesa, porque o único chamador procura um número. Mas se alguém usar `contemValor` para procurar um UUID que vazou, o resultado será sempre `false`. Vale dizer isso no comentário do método, ou fazer o método recusar um `valor` com formato de UUID. O documento já registra que os outros casos não usam a função, mas o próximo leitor da fixture não vê isso.
- O comentário do `contemValor` repete o histórico da correção ("uma vez em mil", o nome da correção). Isso já está no documento da tarefa. Para quem lê a fixture, bastaria dizer que os UUIDs saem do texto antes da busca e por quê.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-16 05:00:45 · `tasks/correcoes/2026-11-16-uuid-no-log-do-job-timeout.md`

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
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/worker/test/queue.fixture.ts:101`: o `contemValor` apaga todo trecho com formato de UUID antes de procurar o valor. Se um dia o dado do job vier escrito dentro de algo com esse formato, o teste não vai acusar o vazamento. Hoje isso não acontece, porque o `cpuMs` é um inteiro, mas vale deixar escrito no comentário que a busca serve só para valor que não tem formato de UUID.
- Seria bom um terceiro caso em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/worker/test/in-memory-log.test.ts`: o `4242` em um campo de dado e dentro de um UUID na mesma linha, esperando `true`. Ele mostra que apagar o UUID não esconde o valor que está fora dele.

A tarefa muda só arquivos de teste do worker. Não toca `apps/*/src`, `packages/*/src`, rota, fila, IA, schema nem métrica. Por isso os itens de carga não se aplicam e ficam como ok. Nenhum teste chama provedor pago. Rodei `apps/worker/test/in-memory-log.test.ts` aqui e os 2 casos passaram. O `job-timeout.int.test.ts` não rodei: as dez rodadas verdes são as que a tarefa relata.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-16 05:00:54 · `tasks/correcoes/2026-11-16-uuid-no-log-do-job-timeout.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. Só mudou código de teste do worker: o log em memória, o caso do prazo do job e um contrato novo. Nenhum arquivo em `apps/*/src` ou `packages/*/src` mudou. Todos com autor humano? Sim, porque a tarefa não cria nem altera nenhuma escrita em `Nota`.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. Não há saída de IA nova, e as entregas, os artefatos e a auditoria continuam como estavam.

Supervisão do tutor: ok. O tutor não foi tocado.

Autonomia declarada e visível: sim. A governança e o nível dos agentes não mudaram.

Bloqueantes: nenhum.

O que conferi:
- **O que mudou:** um método novo, `contemValor` (`queue.fixture.ts:99-102`), tira os UUIDs inteiros do texto do log antes de procurar um valor. O caso do prazo do job (`job-timeout.int.test.ts:73`) passou a usá-lo. O teste novo (`in-memory-log.test.ts`) prova os dois lados da busca. O 4242 que aparece só dentro de um id já não conta como vazamento. O 4242 que vai para o log como valor de campo continua sendo achado.
- **A busca não ficou mais fraca para dado de aluno:** só some do texto o UUID inteiro, com os 8-4-4-4-12 caracteres. Um número ou texto que vaze como campo continua visível, e o segundo caso do teste novo prova isso.
- **O horário do log não causa falso positivo:** o logger grava a hora em formato ISO (`packages/core/src/log/logger.ts:171`), que nunca tem quatro dígitos seguidos formando 4242.
- **Nada da regra 70 é tocado:** nota, correção, tutor, discursiva e redação (D55), decisão sobre aluno, indicador de professor (D45/D64) e supervisão ou vigilância ficam como estavam. Não há tela nesta tarefa, então não houve fotos a ler.

Recomendações:
- A tarefa explica por que `job-execution.int.test.ts`, `expurgo-da-escola.int.test.ts` e `montar-arquivo.int.test.ts` ficam como estão: eles procuram texto com letras ou o próprio UUID. Se um deles passar a procurar só dígitos, deve usar `contemValor`. Vale uma linha no guia do desenvolvedor, na retro.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/worker/test/queue.fixture.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/worker/test/job-timeout.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/worker/test/in-memory-log.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/correcoes/2026-11-16-uuid-no-log-do-job-timeout.md

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-16 05:00:56 · `tasks/correcoes/2026-11-16-uuid-no-log-do-job-timeout.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. Só mudou código de teste (`apps/worker/test/`), e nada em `apps/*/src` nem em `packages/*/src`.
Fora da tabela de dados do docs/lgpd.md: nada.
Autorização por objeto: não se aplica, porque não há rota, repository nem endpoint.
Logs: limpos. Não há log novo em código de produção. O teste que prova que o log do worker não leva o `dados` do job continua valendo. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/worker/test/queue.fixture.ts:100`, o `contemValor` tira do texto só os UUIDs inteiros antes de procurar o valor. Se o worker vazasse o dado do job, ele apareceria como campo JSON (`"cpuMs":4242`), fora de qualquer UUID, e continuaria sendo achado. O segundo caso do teste novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/worker/test/in-memory-log.test.ts` prova isso, e a mutação registrada na tarefa prova o primeiro. Não há perda de cobertura que importe: um valor só some da busca se estiver dentro de um UUID, e aí ele já não é o dado do job. A troca do UUID por `''` também não junta pedaços que gerem acerto ou falha falsos, porque as aspas do JSON continuam separando os campos.
Auditoria: não se aplica, nenhuma ação exige auditoria.
Envio externo: nenhum.
Seed/fixture: sintético. Os UUIDs do teste novo foram escritos à mão e o `cpuMs: 4_242` é sintético. Não há nome nem matrícula.
Bloqueantes: nenhum.
Recomendações:
- No caso de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/worker/test/job-timeout.int.test.ts:73`, vale somar uma checagem estrutural à busca de texto: nenhum registro de `log.registros()` com a chave `dados` ou `cpuMs`. Essa checagem não depende do número escolhido e pega o vazamento mesmo que o valor mude.

Para conferir, rodei `apps/worker/test/in-memory-log.test.ts` pela configuração da raiz: 2 de 2 passaram. Rodado de dentro de `apps/worker`, ele falha porque não acha o pacote `@educa/core`, então o comando tem de sair da raiz. O teste de integração `job-timeout.int.test.ts` eu não rodei.

## test-engineer · 1ª rodada · APROVADO · 2026-11-16 05:01:31 · `tasks/correcoes/2026-11-16-uuid-no-log-do-job-timeout.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **O defeito, de forma determinística:** um `jobId` com `…-594242a7b87a`, sem nenhum `4242` em campo de dado, não pode contar como valor vazado.
- **O lado oposto:** quando o valor vaza como campo (`"prazoMs":4242`), a busca tem de achá-lo. Sem isso, um `contemValor` que só limpa demais, ou que sempre devolve `false`, passaria.
- **O caso original continua provando a regra 20.9:** o log do estouro não leva o `dados` do job.
- **Isolamento entre escolas e permissão:** não se aplicam. A mudança é só em código de teste, sem rota, repository nem dado de escola.

**Cobertos:**
- **O defeito:** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/worker/test/in-memory-log.test.ts:13`. A linha 17 confirma antes que o `4242` está mesmo no texto do log, então o cenário chega à cláusula. A linha 18 exige `false`.
- **O lado oposto:** `in-memory-log.test.ts:21`, que exige `true` com `prazoMs: 4_242`.
- **O caso original:** `apps/worker/test/job-timeout.int.test.ts:73`. O valor e o log são os mesmos de antes. Só trocou a busca no texto solto por `contemValor`.
- **A mutação declarada** (tirar o `.replace(UUID_NO_TEXTO, '')` em `queue.fixture.ts:101`) quebra o teste da linha 13 pelo motivo certo: a linha 17 passa e a 18 recebe `true`. Não há código de `apps/*/src` nem de `packages/*/src` no diff, então a exigência de mutação (RF17) nem se aplica. Mesmo assim, o bloco existe e é coerente.

**O que rodei:**
- `npx vitest run apps/worker/test/in-memory-log.test.ts`: 2 de 2 verdes. Conferi que o arquivo está no projeto `unidade`, então roda no portão da tarefa e na esteira.
- `npx vitest run apps/worker/test/job-timeout.int.test.ts`: 4 de 4 verdes.

**Outras fontes de falso positivo:** procurei outros campos do log que pudessem conter o `4242` por acaso e não achei nenhum:
- O `createLogger` (`packages/core/src/log/logger.ts:167`) usa `isoTime`, cujos dígitos seguidos só formariam `4242` no ano. Não há `pid` nem `hostname`, porque o `base` vira `{ servico }`.
- Os eventos do executor que aparecem nesse caso (`job.iniciado`, `job.tempo_esgotado`, `job.tentativa_falhou`, `job.falhou`) levam só ids, `tentativa`, `prazoMs` (300) e `codigo`.
- O mixin acrescenta `requisicaoId` e `escolaId`, que são UUIDs e saem pela regex.

**Bloqueantes:** nenhum. Não há `.skip`, teste comentado, mock nem provedor de IA. Também não há operação concorrente nova a provar.

**Recomendações:**
1. `packages/core/src/jobs/job-executor.ts:443`: o evento `job.adiado` leva `esperaMs`, um número que depende do relógio. Se um dia o caso do prazo passar por adiamento (escola com vaga limitada), um `esperaMs` de 4242 voltaria a dar falso positivo, e o `contemValor` não cobre isso. Vale registrar no comentário do `contemValor` que ele só descarta UUIDs, não números de medição.
2. O documento explica por que `job-execution.int.test.ts`, `expurgo-da-escola.int.test.ts` e `montar-arquivo.int.test.ts` ficam como estão. Vale levar à retro se algum deles procura sequência só de dígitos no log: hoje, pelo documento, nenhum procura.
3. Nome: o método diz "contém valor", mas na prática quer dizer "contém o valor fora de um UUID". Um nome como `contemForaDeId` deixaria o limite claro para quem for usá-lo em outro teste.
