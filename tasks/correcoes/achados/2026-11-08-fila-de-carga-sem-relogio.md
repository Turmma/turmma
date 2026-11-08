# Achados das revisões — `tasks/correcoes/2026-11-08-fila-de-carga-sem-relogio.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-08 10:35:59 · `tasks/correcoes/2026-11-08-fila-de-carga-sem-relogio.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta correção. Todos com autor humano? Não se aplica, porque nenhum caminho foi criado nem alterado.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. A correção não toca nenhuma saída de IA nem fluxo de aprovação.
Supervisão do tutor: ok. O tutor não foi tocado.
Autonomia declarada e visível: sim. Nada mudou na declaração nem na tela de governança.
Bloqueantes: nenhum
Recomendações: nenhuma pela regra 70.

O que foi auditado foi só o diff da correção, não a árvore inteira.

- **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/fixtures/usa-a-fila.ts`**: ganhou o modo `--espera-por=<outro>`. Nesse modo, o processo só sai depois de ver no diário a linha em que o outro processo entrou. A espera é contada em voltas do temporizador, não no relógio do computador.
- **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/fila-de-carga.test.ts`**: ganhou a função `ordemDoDiario`. O caso "na esteira (CI=true) não há fila" agora confere a ordem das linhas do diário, e não mais os horários de dois processos.
- **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-08-fila-de-carga-sem-relogio.md`**: o documento da correção.

As mudanças ficam só no teste da fila de carga e na fixture dele, em `tools/ci/`. Não há nada sobre Nota, correção, agente de IA, tutor, autonomia, auditoria, supervisão do aluno ou métrica de professor. Nada sobre discursiva ou redação (D55), e `docs/regulacao.md` não mudou. A regra da fila, em `tools/ci/fila-de-carga.ts`, também ficou como estava. Não houve fotos da tela para conferir, porque a correção não tem tela.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-08 10:36:04 · `tasks/correcoes/2026-11-08-fila-de-carga-sem-relogio.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A correção mexe só num teste de infraestrutura do processo (`tools/ci/fila-de-carga.test.ts`) e na fixture dele (`tools/ci/fixtures/usa-a-fila.ts`). Os dois tratam só de nomes de processo de brinquedo (`a`, `b`) e de marcas de hora.

Fora da tabela de dados do docs/lgpd.md: nada. Não há migration, schema, DTO nem campo de pessoa.

Autorização por objeto: não se aplica. Não há rota, repository nem endpoint.

Logs: limpos. O diário é um arquivo temporário criado com `mkdtempSync(join(tmpdir(), 'fila-de-carga-'))` e apagado no fim (`fila-de-carga.test.ts:17-25`). Ele recebe só `<nome do processo> entrou|saiu <Date.now()>`.

Auditoria: não se aplica. A correção não tem leitura de aluno, exportação, alteração de nota ou de permissão, nem aprovação de saída de IA.

Envio externo: nenhum. Não há chamada a provedor de IA, rede ou storage.

Seed/fixture: sintético. A fixture não tem nenhum dado de pessoa.

Pergunta de fechamento: esta correção não muda nada do que o sistema guarda sobre um aluno nem para onde isso vai. A resposta continua a de antes.

Bloqueantes: nenhum.

Recomendações (não bloqueiam):
- `tools/ci/fixtures/usa-a-fila.ts:28` lê o diário sem conferir antes se ele existe. Isso só pesa no caso teórico de o arquivo não existir depois das 800 voltas. Na prática ele sempre existe, porque o próprio processo escreve `entrou` na linha 17. Por isso não é falha de LGPD. O `infra-guardian` e o `revisor-geral` devem olhar a robustez desse trecho.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/fila-de-carga.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/fixtures/usa-a-fila.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-08-fila-de-carga-sem-relogio.md

## revisor-geral · 1ª rodada · APROVADO · 2026-11-08 10:36:07 · `tasks/correcoes/2026-11-08-fila-de-carga-sem-relogio.md`

VEREDITO: APROVADO

Escopo: respeitado. A correção mexe só em `tools/ci/fila-de-carga.test.ts` e na fixture `tools/ci/fixtures/usa-a-fila.ts`. A regra `tools/ci/fila-de-carga.ts` não mudou (o diff está vazio). O outro caso que compara horas ficou como estava, como o documento declara.

Aderência à Tech Spec: ok. É correção de teste de ferramenta, e nenhuma seção da `techspec.md` trata disso.

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo).

Bloqueantes: nenhum.

- **O teste ainda prova a regra.** Na esteira, os dois processos só saem com código 0 se cada um vir o outro entrar. Se a fila valesse com `CI=true`, o primeiro seguraria a trava e o segundo nunca entraria. O primeiro sairia com 4, ou o caso estouraria o prazo. As duas saídas deixam o caso vermelho.
- **O caso não depende mais do relógio.** As comparações usam a ordem das linhas do diário (`ordemDoDiario`), e não horas tiradas de dois processos. O atraso de 3 s cobre o cenário que causou a queda no portão.

Recomendações:

1. **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/fixtures/usa-a-fila.ts:25`**: a espera vai até 800 voltas de 50 ms, cerca de 40 s, mas o caso tem limite de 30 s (`fila-de-carga.test.ts:145`). Se a regra quebrar, o caminho do código 4 nunca aparece: o caso cai por estouro de tempo, como o próprio documento registra, e não por `[4, 0] != [0, 0]`. Com algo como 400 voltas (cerca de 20 s), a falha chegaria com o motivo legível.
2. **`tools/ci/fila-de-carga.test.ts`, as duas afirmações com `indexOf`**: as duas valem por construção sempre que os dois saem com 0, porque cada processo só escreve `saiu` depois de ver o `entrou` do outro. Quem prova a regra é o `toEqual([0, 0])`. Um comentário dizendo isso evitaria que alguém depois tirasse a checagem do código de saída achando que a ordem basta.
3. **Fixture, procura por `` `${outro} entrou ` ``**: é busca por trecho de texto. Um nome que termine no do outro (por exemplo `ba` contra `a`) daria falso positivo. Hoje não acontece, porque os nomes são `a` e `b`. Comparar o começo de cada linha seria mais preciso.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-08 10:36:12 · `tasks/correcoes/2026-11-08-fila-de-carga-sem-relogio.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: não se aplica
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: não se aplica
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: não se aplica
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/fixtures/usa-a-fila.ts:25`: a espera vai até 40 s (800 voltas de 50 ms), mas o caso em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/fila-de-carga.test.ts:131` tem prazo de 30 s. Se a regra quebrar, o caso cai por estouro de prazo e nunca pelo `exit 4` de "o outro não entrou", que é a mensagem que diz o motivo. O próprio documento registra isso na prova de mutação. Baixar para cerca de 400 voltas (20 s) deixa a espera abaixo do prazo e o vermelho legível.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/fixtures/usa-a-fila.ts:25` e `:28`: o `includes(\`${outro} entrou \`)` também aceita um nome que termina com o do outro, como `ba entrou` para `a`. Com os nomes `a` e `b` de hoje não cai, mas a fixture é compartilhada. Comparar o começo da linha (`^${outro} entrou `, por linha) fecha isso.
- O caso `dois portões ao mesmo tempo não se sobrepõem` (`fila-de-carga.test.ts:109`) ainda compara `Date.now()` de dois processos. Fica fora desta correção, como o documento declara, mas vale deixar como candidato a intermitente no `estado.md`.

Com a árvore atual, o arquivo inteiro passou 14 de 14 nesta auditoria. A regra em `tools/ci/fila-de-carga.ts` não mudou, e nada do que mudou está no caminho quente nem chama provedor pago.

## test-engineer · 1ª rodada · APROVADO · 2026-11-08 10:36:32 · `tasks/correcoes/2026-11-08-fila-de-carga-sem-relogio.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:** com `CI=true`, dois processos entram no comando sem passar pela fila e ficam vivos ao mesmo tempo.
- **Borda 1:** o segundo processo chega bem depois do primeiro. Foi o que a carga produziu no portão: 224 ms além do que sobrava.
- **Borda 2:** o relógio de parede recua ou anda desigual entre os dois processos, e a sobreposição tem de valer mesmo assim.
- **Prova da regra:** sem a linha `if (process.env['CI'] === 'true') return` (`tools/ci/fila-de-carga.ts:74`), o caso tem de cair.
- **Concorrência de verdade:** os dois processos rodam ao mesmo tempo, não um depois do outro.
- Permissão e isolamento entre escolas não se aplicam: é ferramenta do processo e não toca dado de escola.

**Cobertos:**
- **Caminho feliz:** `tools/ci/fila-de-carga.test.ts:131-145`. Os dois saem com 0, aparecem os quatro eventos e cada um entrou antes de o outro sair.
- **Borda 1:** a espera fixa de 3 s em `:136` agora faz parte do teste. A sobreposição vem da construção do fixture, onde cada processo só sai depois de ver o outro entrar (`tools/ci/fixtures/usa-a-fila.ts:22-28`), e não da velocidade com que o segundo `node` sobe.
- **Borda 2:** a ordem sai das linhas do diário (`ordemDoDiario`, `:52-57`), não de `Date.now()`. Os dois processos gravam por `appendFileSync`, com linhas curtas, então a ordem do arquivo é a ordem real. A espera do fixture é contada em voltas de `setTimeout`, sem relógio de parede.
- **Prova da regra:** sem a linha 74, o primeiro processo pega o `flock` e espera por `b`, que fica preso na fila sem nunca escrever `b entrou`. O caso cai. O documento registra a prova feita à mão e restaurada. O `**Sem mutação:**` se justifica, porque só mudaram um teste e o fixture dele em `tools/ci/`, nada em `apps/*/src` nem em `packages/*/src`.
- **Concorrência:** os dois são processos filhos reais, vivos ao mesmo tempo.
- **Execução:** rodei `npx vitest run tools/ci/fila-de-carga.test.ts -t "na esteira"` uma vez, sem carga, e passou em 3,3 s. Não alterei nenhum arquivo.
- **Proibidos e IA:** nenhum `.skip`, nenhum teste comentado, nenhum mock escondendo a regra, e não há IA envolvida.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **A falha esperada não é a que acontece.** `tools/ci/fixtures/usa-a-fila.ts:25` espera até 800 voltas de 50 ms, cerca de 40 s, mas o caso tem prazo de 30 s (`tools/ci/fila-de-carga.test.ts:145`). Sem a regra, o caso cai por estouro de prazo, como o próprio documento diz ("estourou os 30 s"), e não pela asserção `toEqual([0, 0])` recebendo `[4, 0]`. O comentário em `:132` ("o primeiro sairia com 4") e o do fixture descrevem um caminho que nunca acontece enquanto o teste está vivo. O caso continua vermelho pelo motivo certo, porque é a falta de sobreposição que prende o primeiro processo. Ainda assim, uma espera menor que o prazo, por exemplo 400 voltas, cerca de 20 s, faria a falha aparecer como asserção legível e deixaria o comentário verdadeiro.
2. **Nome de variável.** O comentário em `usa-a-fila.ts:24` acerta ao fugir do relógio de parede. A variável `milissegundos`, passada como `'0'`, é ignorada no modo `--espera-por` e poderia dizer isso no uso (`:7`).
3. **Fica o mesmo risco no caso vizinho.** `dois portões ao mesmo tempo não se sobrepõem` (`tools/ci/fila-de-carga.test.ts:109-116`) ainda compara `Date.now()` de dois processos com `toBeGreaterThanOrEqual`. Se o relógio desta máquina recuar entre a saída do primeiro e a entrada do segundo, ele cai do mesmo jeito. Está fora do pedido, como o documento declara. Vale registrar como candidato a intermitente no `estado.md` e trocar pela ordem das linhas do diário, que ali também prova a regra: `segundo entrou` vem depois de `primeiro saiu`.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-08-fila-de-carga-sem-relogio.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/fila-de-carga.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/fixtures/usa-a-fila.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/fila-de-carga.ts (a regra, sem mudança)

## revisor-geral · 2ª rodada · APROVADO · 2026-11-08 11:42:42 · `tasks/correcoes/2026-11-08-fila-de-carga-sem-relogio.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok (a correção mexe só no teste e na fixture de `tools/ci/`, e `tools/ci/fila-de-carga.ts` não mudou)
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

As quatro recomendações da 1ª rodada foram aplicadas na árvore de agora.
1. **Espera menor que o prazo do caso.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/fixtures/usa-a-fila.ts:29` espera 400 voltas de 50 ms, uns 20 s, abaixo dos 30 s do caso. A falha chega como o código 4 e não como estouro de tempo, e a prova à mão registrada no documento (`[ 4, 0 ]` em 20,4 s) confirma.
2. **Começo da linha.** `usa-a-fila.ts:28` casa o começo de cada linha do diário (`startsWith`), e não um trecho dela. Com isso, `a` não acha presença falsa em `ba entrou`.
3. **Comentário do caso.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/fila-de-carga.test.ts:142-143` diz que as duas ordens valem por construção e que quem prova a regra é o `[0, 0]`.
4. **Milissegundos ignorados.** `usa-a-fila.ts:8` diz que os milissegundos são ignorados em `--espera-por`.

Recomendações:
- No documento `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-08-fila-de-carga-sem-relogio.md`, a tabela "Recomendações sem aplicar" (linha 43) tem dois pontos desatualizados:
  - Cita "linha 17" para a escrita de `<nome> entrou`, que agora está em `usa-a-fila.ts:18`.
  - Lista como "Sem ação" a recomendação do privacy-guardian (ler o diário sem conferir se ele existe). Mas a função nova `viuOOutro` já confere com `existsSync`. A linha deveria dizer que a recomendação foi atendida de passagem.
- O caso vizinho `dois portões ao mesmo tempo não se sobrepõem` continua comparando `Date.now()` de dois processos. Ele já está registrado como candidato a intermitente no `estado.md`, e não há nada a fazer nesta correção.

## test-engineer · 2ª rodada · APROVADO · 2026-11-08 11:43:13 · `tasks/correcoes/2026-11-08-fila-de-carga-sem-relogio.md`

**VEREDITO: APROVADO**

As quatro recomendações da 1ª rodada foram aplicadas. Este diff não traz bloqueante novo. Rodei `npx vitest run tools/ci/fila-de-carga.test.ts` na árvore de agora: 14 de 14 verdes, em 10,7 s.

**Cenários exigidos** (a correção só mexe no teste da fila de carga):
- **Regra:** com `CI=true` não há fila. Dois portões se sobrepõem mesmo quando o segundo chega 3 s depois, que é o atraso que a carga produz.
- **Falha vista pelo motivo certo:** se a fila separasse os dois, o primeiro tem de cair com o código 4, e não por estouro de tempo.
- **Borda da fixture:** um nome que termina no do outro não pode dar presença falsa no diário.
- **Prazo:** a espera fica dentro do prazo de 30 s do caso e não depende do relógio de parede.

**Cobertos:**
- **Espera de 400 voltas de 50 ms, uns 20 s** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/fixtures/usa-a-fila.ts:29`). Fica abaixo dos 30 s do caso (`fila-de-carga.test.ts:146`), então a mutação chega como `[4, 0]` e não como estouro. A prova feita à mão no documento bate: com `fila-de-carga.ts:74` trocada, o caso cai com `expected [ 4, 0 ] to deeply equal [ 0, 0 ]` em 20,4 s. Conferi que a linha 74 ainda é `if (process.env['CI'] === 'true') return`.
- **A fixture casa o começo da linha do diário** (`usa-a-fila.ts:28`, `split('\n').some(startsWith(...))`), e não um trecho dela. Isso fecha a presença falsa entre nomes com o mesmo final.
- **O comentário do caso** (`fila-de-carga.test.ts:142-143`) diz que as duas checagens de ordem valem por construção e que quem prova a regra é o `[0, 0]`. Está correto: com `--espera-por`, nenhum dos dois escreve `saiu` antes de ver o `entrou` do outro.
- **O uso da fixture** (`usa-a-fila.ts:8`) diz que os milissegundos são ignorados em `--espera-por`.
- **Teste de concorrência de verdade:** os dois processos rodam em paralelo, sem `.skip` e sem mock que esconda o `flock`.
- **"Sem mutação" bem justificado:** a correção não toca `apps/*/src` nem `packages/*/src`, e a prova de que o teste ainda pega a regra está escrita na seção "Correção".

**Bloqueantes:** nenhum.

**Recomendações** (não bloqueiam):
1. A linha 43 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-08-fila-de-carga-sem-relogio.md` está desatualizada em dois pontos:
   - Cita "a linha 17", mas o `appendFileSync` do `entrou` agora está na linha 18 de `usa-a-fila.ts`.
   - Marca a recomendação do `privacy-guardian` como "Sem ação", mas o `viuOOutro()` novo (`usa-a-fila.ts:28`) já confere `existsSync(diario)` antes de ler, inclusive na leitura final da linha 32. Ela foi aplicada de fato, e o destino na tabela deve dizer isso.
2. No caso mutado, a margem é de uns 10 s (20,4 s contra 30 s), e 400 voltas de 50 ms se esticam com a máquina disputada. Isso só afeta o caso mutado, e ele continuaria vermelho, só que por estouro de tempo em vez do código 4. Fica registrado para a retro, se a prova à mão passar a ser bloco ` ```mutacao `.
3. Continua de pé a recomendação da 1ª rodada: o caso vizinho `dois portões ao mesmo tempo não se sobrepõem` (`fila-de-carga.test.ts:109-116`) ainda compara `Date.now()` de dois processos e é candidato a intermitente. O documento já o registra como fora do pedido.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-08 11:43:27 · `tasks/correcoes/2026-11-08-fila-de-carga-sem-relogio.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta correção (a mudança é só uma fixture de CI e o teste da fila de carga). Todos com autor humano? Não se aplica.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok (nada nesta correção gera saída de IA)
Supervisão do tutor: ok (o tutor não é tocado)
Autonomia declarada e visível: sim (nada mudou nisso)
Bloqueantes: nenhum
Recomendações: nenhuma nova.

Na árvore de agora, as quatro recomendações da 1ª rodada estão aplicadas:

1. **Espera abaixo do prazo do caso.** A espera caiu para 400 voltas de 50 ms, uns 20 s, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/fixtures/usa-a-fila.ts:28`. Com o atraso de 3 s antes de `b` subir, ainda sobra margem dentro dos 30 s do caso. Uma falha da fila aparece como o código 4, e não como estouro de tempo.
2. **Casamento pelo começo da linha.** `viuOOutro` (`usa-a-fila.ts:27`) só aceita uma linha que começa com `<outro> entrou `. Assim, um nome que termina no outro não dá presença falsa.
3. **Comentário do caso.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/fila-de-carga.test.ts:142-143`, o comentário diz que a ordem das linhas vale por construção e que quem prova a regra é o `[0, 0]`.
4. **Milissegundos ignorados.** O uso da fixture (`usa-a-fila.ts:8`) diz que os milissegundos são ignorados em `--espera-por`.

O documento `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-08-fila-de-carga-sem-relogio.md` traz os subagentes obrigatórios `infra-guardian` e `revisor-geral`. Ele não menciona nota, tutor, agente de IA nem indicador de professor. Por isso a regra 70 e `docs/regulacao.md` não têm o que exigir aqui.
