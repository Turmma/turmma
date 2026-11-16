# Achados das revisões — `tasks/correcoes/2026-11-16-varredura-do-main-worker.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-16 07:58:39 · `tasks/correcoes/2026-11-16-varredura-do-main-worker.md`

VEREDITO: APROVADO
Tabelas verificadas: nenhuma nova e nenhuma migration. `consumo_ia` e `execucao_agente` não mudaram (`escolaId` e UUID continuam como estavam).
Queries verificadas: nenhuma query nova e nenhuma alterada. A mudança é só o teto de `duracaoMs` na função pura `consumoEstimadoDaInterrompida`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/packages/core/src/ia/consumo.ts:81`. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/ia/consumo.repository.ts:51`, a gravação da linha estimada continua na escola da própria execução, a que vem do `returning`, sem parâmetro do cliente. Nenhum endpoint foi tocado, nenhum `@Unscoped()` novo e nada da camada rede.
Teste de isolamento: não se aplica a esta correção, porque não há módulo, repository nem query novos. O teste de isolamento que já existia continua no arquivo, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/ia/execucao-interrompida.int.test.ts:372`: a execução da escola B não ganha linha.
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/ia/execucao-interrompida.int.test.ts:418`: o caso novo semeia as duas execuções só na escola A. Pôr a execução `recente` na escola B provaria também que a varredura, que roda sem escola no contexto, grava a linha estimada de cada execução na escola dela mesmo quando o lote mistura escolas.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-16 07:58:46 · `tasks/correcoes/2026-11-16-varredura-do-main-worker.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

O que conferi para chegar aqui:
- **A correção cobre todos os caminhos.** As duas consultas em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/ia/execucao.repository.ts` (linhas 154 e 169) calculam a duração no banco como `float8`, então ali não há estouro. O único lugar onde ela vira `integer` é a gravação da linha de consumo, e `consumoEstimadoDaInterrompida` (`packages/core/src/ia/consumo.ts:81`) é o único ponto por onde passam a reentrega e a varredura. Os outros lugares que gravam a duração (`tutor.service.ts:180`, `llm-gateway.ts:256`) medem uma chamada em andamento e não chegam perto de 24,8 dias.
- **Sem invasão de escopo nem mudança de arquitetura.** Não há migration, repository novo nem query nova. A linha continua superestimando o consumo, como pede a D14.

Recomendações:
- **O teste de integração depende de quem roda antes dele.** `apps/api/src/ia/execucao-interrompida.int.test.ts:418-427` confere `varrer() >= 2`, e isso fica sujeito ao acúmulo de `pendente` sem job que o `apps/worker/test/expurgo-da-escola.int.test.ts` deixa no banco, o mesmo risco que o documento cita para o `ia.int`. O melhor é registrar isso no `TODO.md` em vez de deixar só no texto da correção. Também vale fazer o `expurgo-da-escola` apagar o que semeia, ou fazer o teste olhar só as execuções dele, sem contar o total da volta.
- **O aviso da falha não diz qual linha travou.** O documento admite que `ia.execucao.varredura_falhou` não informa a execução culpada. Um próximo erro de faixa ou de restrição ainda travaria a varredura inteira sem dizer onde. Uma correção futura pode registrar no log o `execucaoId` (é UUID, então pode ir) ou isolar a falha de cada linha para não desfazer o lote todo.
- **Comentário longo no teste.** O comentário em `execucao-interrompida.int.test.ts:419-420` repete o que o nome do teste e o JSDoc de `DURACAO_MAXIMA_DA_LINHA_MS` já dizem. Dá para tirar.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/correcoes/2026-11-16-varredura-do-main-worker.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/packages/core/src/ia/consumo.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/packages/core/src/ia/consumo.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/ia/execucao-interrompida.int.test.ts`

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-16 07:58:47 · `tasks/correcoes/2026-11-16-varredura-do-main-worker.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A mudança só limita `consumo_ia.duracao_ms`, um número técnico da execução, ao máximo de um `integer` do Postgres (2.147.483.647 ms, uns 24,8 dias). Não entra coluna, migration nem campo novo.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: não se aplica. A tarefa não cria nem altera rota, repository ou query. O `update` e o `registrarEstimada` continuam usando a escola de cada execução, como antes.

Logs: limpos. A tarefa não cria log novo. O aviso que já existe, `ia.execucao.varredura_falhou` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/ia/varredura-de-execucoes.ts:78`), passa o erro por `summarizeError`. A mensagem do Postgres para o erro 22003 traz o valor fora da faixa, e não dado de pessoa.

Auditoria: não se aplica. A tarefa não toca nenhuma ação da regra 20 item 10. A correção reforça o rastro: antes, uma execução esquecida em `rodando` por mais de 24,8 dias desfazia o lote inteiro da varredura, e nenhuma execução seguinte ganhava linha de consumo nem era encerrada. Agora cada execução interrompida volta a ter sua linha em `consumo_ia` e seu estado final em `ExecucaoAgente`. Isso também ajuda a responder à pergunta de fechamento: para onde cada coisa foi enviada continua respondível mesmo depois de um mês com a API fora.

Envio externo: nenhum novo. O teste usa o adaptador falso (`envioExterno: false`).

Seed/fixture: sintético. São UUIDs fixos, uma escola de teste e execuções semeadas por `semear()` com 40 dias e 301 s de idade. Nenhum nome, matrícula ou conteúdo.

Bloqueantes: nenhum.

Recomendações:
- O aviso `ia.execucao.varredura_falhou` não diz qual execução travou a volta, como a própria tarefa aponta. Um campo `execucaoId` (UUID) ajudaria o operador e não fere a regra 20 item 9. É para uma tarefa futura, não esta.
- O acúmulo de `pendente` antigas que `apps/worker/test/expurgo-da-escola.int.test.ts` deixa no banco compartilhado (2.672 linhas) pode empurrar o caso da 6.0 para uma volta seguinte da varredura. Melhor esse teste limpar o que semeia, já registrado como recomendação na tarefa.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/packages/core/src/ia/consumo.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/packages/core/src/ia/consumo.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/ia/execucao-interrompida.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/correcoes/2026-11-16-varredura-do-main-worker.md`

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-16 07:58:49 · `tasks/correcoes/2026-11-16-varredura-do-main-worker.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A correção não toca `Nota`, a migration, o repository nem o seed. Todos com autor humano? Sim, nada mudou nesse ponto.
Decisão autônoma sobre aluno: ausente.
Aprovação registrada: ok. A varredura só encerra execuções interrompidas. A execução fica como `falhou` / `EXECUCAO_INTERROMPIDA` com `resultado: null`, então não sai nenhuma entrega de IA sem aprovação. O teste novo verifica isso nas duas execuções, a esquecida e a recente.
Supervisão do tutor: ok. Não há mudança no fluxo do tutor.
Autonomia declarada e visível: sim. A governança dos agentes não foi alterada.
Bloqueantes: nenhum.
Recomendações:
- Fora da regra 70, para o `infra-guardian`: a própria tarefa registra outro risco, que ela não corrige. No lote de 200 × 5 da varredura, um acúmulo de mais de 1.000 `pendente` sem job pode adiar a `pendente` do caso da 6.0 para a volta seguinte. Vale levar isso ao `TODO.md` para não depender só do registro desta tarefa.
- O aviso `ia.execucao.varredura_falhou` continua sem dizer qual linha fez o lote falhar. Incluir o `execucaoId` no aviso ajudaria o diagnóstico. É log com id, então não fere a regra 20.

O que foi auditado. A mudança se resume a limitar `duracaoMs` em `consumoEstimadoDaInterrompida` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/packages/core/src/ia/consumo.ts:61` e `:81`). Essa função é chamada só por `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/ia/consumo.repository.ts:51`. O teto mexe só na duração. Os tokens estimados continuam nos dois tetos da tarefa, então a linha continua superestimando o custo, como pede a D14. Em `docs/regulacao.md` e em `.claude/` não houve nenhuma alteração. Os testes novos estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/packages/core/src/ia/consumo.test.ts` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/ia/execucao-interrompida.int.test.ts`. Não rodei os testes: esta auditoria foi feita lendo o diff e o código que o chama.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-16 07:58:58 · `tasks/correcoes/2026-11-16-varredura-do-main-worker.md`

VEREDITO: APROVADO
Caminho quente tocado: fila | IA (a varredura do `main-worker` e a linha estimada de consumo)
Rate limit: ok (não tocado)
Fila e prioridade: ok
Concorrência: protegida. A varredura e a reentrega seguem numa transação só, com o `update ... returning` e a linha estimada juntos. A correção não muda isso.
Índice e paginação: ok (nenhuma query nova; o lote continua de 200 × `PASSADAS_MAXIMAS`)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok para o que mudou (nenhum código novo no caminho quente, nenhum alerta novo)
Bloqueantes: nenhum

O limite passa pelo ponto único `consumoEstimadoDaInterrompida` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/packages/core/src/ia/consumo.ts:81`). Os dois chamadores passam por ele: a reentrega (`encerrarRodando`) e a varredura (`encerrarRodandasVelhas`, via `ConsumoRepository.registrarEstimada`). O teto `2_147_483_647` é igual ao limite do `integer` de `consumo_ia.duracao_ms`, e a linha continua superestimando (D14). Há teste de unidade e de integração, os dois com mutação declarada. Rodei `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/packages/core/src/ia/consumo.test.ts` e passaram os 2 testes. O teste de integração não rodei. Nenhum teste chama provedor pago.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/ia/varredura-de-execucoes.ts:77-79`: a varredura continua vulnerável a uma linha que trava tudo. Qualquer outra falha por linha em `registrarEstimada` desfaz o lote inteiro. Como `#encerrarRodandas` lança antes, `#encerrarPendentes` nem chega a rodar, e isso se repete em toda volta. Separar as duas etapas em `try` próprios. Se a transação do lote falhar, encerrar linha a linha, isolando a que falha e registrando o `execucaoId` dela (o UUID, sem dado pessoal).
- `ia.execucao.varredura_falhou` só aparece no log. Este defeito ficou invisível até a esteira pegar. Vale uma métrica de falha da varredura, com alerta para falha seguida em N voltas e o parágrafo correspondente em `docs/runbook.md`. Assim o operador fica sabendo antes de as `rodando` e as `pendente` se acumularem.
- Fica a recomendação que a própria tarefa registrou. As 2.672 `pendente` que `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/worker/test/expurgo-da-escola.int.test.ts` deixa no banco podem empurrar o caso da 6.0 em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/ia/ia.int.test.ts` para a volta seguinte. Limpar o que o `expurgo-da-escola` semeia, ou deixar o teste da 6.0 independente da ordem dos arquivos.

## test-engineer · 1ª rodada · APROVADO · 2026-11-16 07:59:10 · `tasks/correcoes/2026-11-16-varredura-do-main-worker.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:** uma execução esquecida em `rodando` por mais de 24,8 dias é encerrada. A linha de consumo fica com `duracao_ms` no teto do `integer`.
- **Borda 1:** a duração exatamente no teto continua igual, e o teto mais 1 vira o teto.
- **Borda 2:** abaixo do teto, a duração é a medida, arredondada, e nunca negativa.
- **Borda 3:** a execução velha não trava a varredura das outras `rodando` do mesmo lote, e a `pendente` sem job, que vem depois, também é encerrada.
- **Borda 4:** a reentrega (`encerrarRodando`) usa o mesmo teto.
- **Permissão:** não se aplica. A varredura é rotina interna, e a correção não abriu rota nem papel.
- **Isolamento:** não muda. Nenhuma query nem repository foi tocado, e cada `update` e `registrarEstimada` continua na escola da sua execução. Os casos de isolamento da 6.0 continuam no arquivo.
- **Concorrência:** nenhuma operação nova pode rodar duas vezes ao mesmo tempo. Só mudou o valor de um campo calculado.

**Cobertos:**
- **Caminho feliz:** `packages/core/src/ia/consumo.test.ts:10` (40 dias e teto mais 1 viram o teto, e a constante vale 2.147.483.647). Também `apps/api/src/ia/execucao-interrompida.int.test.ts:418`: rodou de verdade sobre o banco, com uma `rodando` de 40 dias. A linha fica com `duracao_ms` igual a 2.147.483.647 e a execução sai com `falhou`/`EXECUCAO_INTERROMPIDA`.
- **Bordas 1 e 2:** `consumo.test.ts:16` (301.000,4 vira 301.000, o teto fica igual, -5 vira 0).
- **Borda 3, parte das `rodando`:** `execucao-interrompida.int.test.ts:418`. A `rodando` de 301 s do mesmo lote também é encerrada, e `varrer()` devolve ao menos 2.
- **Mutações:** os dois blocos do documento tiram o `Math.min` da linha que o `git diff` mudou (`packages/core/src/ia/consumo.ts:81`). A única cláusula nova é essa, e as duas mutações a alcançam.
  - No teste de unidade, o teto mais 1 e os 40 dias deixariam de virar o teto, então o teste fica vermelho.
  - No de integração, o `insert` falha com 22003 e a transação desfaz o lote. `varrer()` devolve 0 e o teste fica vermelho em `toBeGreaterThanOrEqual(2)`, que é o sintoma descrito, o motivo certo.
  - O `--faltando` do documento dá 0 linhas.
- **Tabela de testes:** os três testes citados em "Teste que reproduz" existem com o mesmo nome.
- **Resto da auditoria:**
  - Não há `.skip`, teste comentado nem mock da regra.
  - A bancada usa adaptador falso e nenhum provedor pago.
  - A idade das execuções vem do relógio do banco (`make_interval`), não da máquina, então o teste não depende de a máquina estar folgada.
  - Rodei `npx vitest run packages/core/src/ia/consumo.test.ts`: 2 de 2 verdes.
  - O teste de integração não rodei.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Pôr uma `pendente` sem job no caso de integração.** O caso fica em `apps/api/src/ia/execucao-interrompida.int.test.ts:418`. Hoje ele prova que as outras `rodando` andam, mas a Causa do documento também cita a `pendente` que nem chegava a ser varrida. Com uma `semear(a, { estado: 'pendente', haSegundos: 5 })` e a asserção de que ela foi encerrada, o caso cobre o sintoma inteiro da esteira.
2. **Testar a reentrega com uma `rodando` antiga.** O documento diz que a reentrega (`encerrarRodando`) passa pelo mesmo ponto, mas no banco só a varredura foi testada. Uma `rodando` de 40 dias entregue de novo com `entregarDeNovo` provaria que esse caminho também grava a linha e não cai em `interrupcao_nao_gravada` para sempre.
3. **Isolar a linha que quebra o lote, fora desta correção.** Isto é desenho, não teste. O lote continua sendo uma transação só, então qualquer outra linha que quebre o `insert` volta a travar a varredura inteira, e o aviso `ia.execucao.varredura_falhou` não diz qual execução foi. Vale levar à retro: encerrar a linha que quebrou num caminho próprio e pôr o id dela no aviso.
4. **Registrar a recomendação das `pendente` acumuladas.** O documento já a deixa sem aplicar: o `expurgo-da-escola` deixa milhares de `pendente` antigas e o teste da 6.0 pode, num banco acumulado, passar da volta de 200 × 5. Convém anotá-la no `TODO.md` ou na retro para não se perder, porque é o mesmo tipo de teste que depende do banco que sobra de outras execuções.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/packages/core/src/ia/consumo.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/packages/core/src/ia/consumo.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/src/ia/execucao-interrompida.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/correcoes/2026-11-16-varredura-do-main-worker.md`

## revisor-geral · 2ª rodada · APROVADO · 2026-11-16 08:08:08 · `tasks/correcoes/2026-11-16-varredura-do-main-worker.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (`portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)`)
Bloqueantes: nenhum

As três correções da ordem `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/.processo/ordens/2026-11-16-varredura-do-main-worker-r1.md` foram feitas:

1. **Execução `recente` na escola B:** feito em `apps/api/src/ia/execucao-interrompida.int.test.ts:420`. O caso agora também confere, na linha 426, que a linha estimada da `recente` fica na escola B. Se o escopo vindo da execução sumir da varredura, esse teste quebra.
2. **Caso de reentrega:** feito em `apps/api/src/ia/execucao-interrompida.int.test.ts:429-435`. Uma `rodando` de 40 dias entregue de novo fica com a duração no teto do inteiro, e o teste confere que não aparece `interrupcao_nao_gravada` para essa execução.
3. **Comentário longo:** retirado. O comentário de uma linha que entrou no lugar explica por que a `recente` está na escola B e não repete o nome do teste.

As quatro entradas que faltavam estão no `TODO.md` e na tabela "Recomendações sem aplicar" do documento, cada uma com destino e motivo. A recusa de pôr uma `pendente` sem job no caso de integração tem motivo escrito, e o motivo se sustenta.

Recomendações:
- A seção "Mutações" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/correcoes/2026-11-16-varredura-do-main-worker.md` cita só a varredura e o teste de unidade. Um terceiro bloco, com a mesma mutação apontada para o caso "reentrega, execução esquecida há mais de 24,8 dias…", registraria no documento que o caminho da reentrega também fica vermelho sem o teto.
- No caso de reentrega (`execucao-interrompida.int.test.ts:433`), `(await linhasDe(id))[0]?.duracao_ms` não confere que a execução gravou uma única linha. Comparar com `[estimadaDe('propor_ferramenta', a, fila.destino)]` e conferir a duração à parte deixaria o caso igual aos outros `it` de reentrega do arquivo.

## test-engineer · 2ª rodada · APROVADO · 2026-11-16 08:08:19 · `tasks/correcoes/2026-11-16-varredura-do-main-worker.md`

VEREDITO: APROVADO

Cenários exigidos (rodada nova, só o diff desde a 1ª):
- A correção exigida: nenhuma, porque a 1ª rodada não teve bloqueante.
- A recomendação aceita: a reentrega com uma `rodando` antiga.
- A recomendação recusada: a `pendente` sem job no caso de integração, com o motivo escrito.
- A alteração do caso da varredura: a `recente` agora fica na escola B.
- O registro das demais recomendações no `TODO.md`.

Cobertos:
- **Reentrega de uma `rodando` de 40 dias.** O teste novo "reentrega, execução esquecida há mais de 24,8 dias: …" está em `apps/api/src/ia/execucao-interrompida.int.test.ts:428`. Ele confere o estado `falhou`/`EXECUCAO_INTERROMPIDA`, a `duracao_ms` no teto 2.147.483.647 e a ausência de `ia.execucao.interrupcao_nao_gravada` com o id. A reentrega passa pelo mesmo `consumoEstimadoDaInterrompida`, chamado em `apps/api/src/ia/consumo.repository.ts:51`. Sem o teto, o `insert` falharia com 22003, e as três asserções cairiam pela cláusula certa. É uma segunda prova da cláusula que já tem bloco de mutação, e não pede bloco novo.
- **Caso da varredura, com a `recente` na escola B.** Fica mais forte do que antes: prova que o lote mistura escolas e que a linha estimada da `recente` vai para a escola dela, com `estimadaDe('propor_ferramenta', b, …)` em `execucao-interrompida.int.test.ts:426`. O título não mudou, então o bloco de mutação do documento continua apontando para ele.
- **Recomendação recusada.** O motivo está na tabela "Recomendações sem aplicar" e é válido: pôr uma `pendente` sem job no caso tornaria o teste dependente da ordem dos arquivos. O caso da 6.0 em `ia.int.test.ts` continua cobrindo a `pendente`.
- **`TODO.md`.** As quatro recomendações fora do escopo estão registradas com origem, revisores e motivo: o expurgo que não apaga o que semeia, o `execucaoId` no aviso, o isolamento da falha por linha, e a métrica com alerta e runbook.
- **Rodada do arquivo.** Rodei `npx vitest run --project integracao apps/api/src/ia/execucao-interrompida.int.test.ts` e passaram 28 de 28. Não há `.skip` nem mock que esconda a regra, e o adaptador de IA é falso.

Bloqueantes: nenhum.

Recomendações:
- O diff tirou do caso da varredura o comentário que explicava por que 40 dias: passa do `integer` de `duracao_ms`, o 22003 desfazia o lote e a volta devolvia 0 para sempre. Vale recolocá-lo nesse caso, ou no da reentrega, porque é o que diz ao próximo leitor por que esse número.
- Citar o teste novo da reentrega na seção "Teste que reproduz" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/correcoes/2026-11-16-varredura-do-main-worker.md`, para a tabela do documento listar as duas portas que passam pelo teto.
