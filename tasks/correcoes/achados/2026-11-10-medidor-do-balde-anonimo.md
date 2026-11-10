# Achados das revisões — `tasks/correcoes/2026-11-10-medidor-do-balde-anonimo.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-10 09:54:34 · `tasks/correcoes/2026-11-10-medidor-do-balde-anonimo.md`

VEREDITO: APROVADO

Escopo: respeitado. A correção fecha os dois itens do `TODO.md` que ela mesma cita: o medidor agora tem caso unitário, conta os erros e imprime a contagem, e a carga foi refeita com o medidor novo. Ficou para o Arquiteto, como manda o `TODO.md`, o item "Alinhar o texto da spec ao medidor novo".

Aderência à Tech Spec: ok. A mudança fica em `infra/scripts/`, sem mexer em `apps/api`. O pico novo (3.678, 61%) foi trocado nos três documentos que levavam o número antigo. A `techspec.md` e o `cenarios.md` não citavam 3.579, então nada ficou de fora deles. O que já foi dito na época continua como estava, e isso é correto: os `achados/`, a tabela de recomendações da 4ª rodada e o `estado.md`.

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo).

Bloqueantes: nenhum.

Recomendações:
1. **O p95 do `decidir` no `k2_conta` aparece com dois valores.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/tasks/prd-acesso-e-convites/16_task.md:106` o texto ainda diz "no `k2_conta` deu 1.593 ms", e o mesmo valor está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/TODO.md:3328`. A tabela da linha 102 agora diz 1.700 ms. Alinhe os dois textos ou diga que o 1.593 é o da primeira medição.
2. **A frase "N leituras falharam" conta coisas que não são leitura.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/infra/scripts/carga-sala.ts`, o `registrarErro`, ligado ao `cliente.on('error')`, soma no mesmo contador do `descreverBaldeNaoLido`. O `ioredis` emite um `error` a cada tentativa de reconexão, então a frase pode contar mais "leituras" do que o laço fez de fato. Um texto como "N erros do Redis" seria mais fiel.
3. **A seção "Fora desta correção" do documento da correção não diz o que de fato ficou de fora.** Ela diz "Nada: a árvore estava limpa", o que descreve a árvore. Melhor registrar o item que ficou com o Arquiteto: o `rl:ip:senha:` na frase da `16_task.md` e o pico 0 no `cenarios.md`.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-10 09:54:40 · `tasks/correcoes/2026-11-10-medidor-do-balde-anonimo.md`

VEREDITO: APROVADO

Esta correção não toca dado de pessoa. Ela mexe no medidor de carga que lê o contador do limite de requisições por IP, e por isso a auditoria olhou o tratamento do IP e o que vai para a saída.

**Campos pessoais tocados:** nenhum campo novo. O único dado pessoal envolvido é o IP, que já existia como chave `rl:ip:<ip>` no Redis de cache. O script só lê o valor do contador e guarda o maior. A chave, que contém o IP, nunca é impressa nem guardada (`infra/scripts/carga-sala.ts:475-480`).

**Fora da tabela de dados do docs/lgpd.md:** nada. A leitura que o cenário de carga faz dos contadores `rl:ip` já está registrada como exceção em `docs/lgpd.md:190`: só no compose de carga, com IP do Docker e dado sintético, guardando só o maior valor e sem imprimir a chave. O código continua dentro dela: conecta só em `127.0.0.1` (`carga-sala.ts:536`) e a saída é um número.

**Autorização por objeto:** não se aplica. Não há rota, DTO nem endpoint; é um script de `infra/` mais o teste dele.

**Logs:** limpos.
- O erro de conexão do Redis agora chega a `registrarErro`, que não recebe argumento e só soma 1 (`carga-sala.ts:516-518`, `:541`). A mensagem do erro, que poderia citar host ou chave, não vai a lugar nenhum.
- A leitura que falha cai num `catch` sem variável e também só soma 1 (`:510-512`).
- `descreverBaldeNaoLido(fase, erros)` (`:493`) só recebe o nome da fase e um número. Nenhuma chave pode chegar a essa linha.

**Auditoria:** não se aplica. Não há leitura de dado de aluno, exportação, mudança de nota ou de permissão, nem saída de IA.

**Envio externo:** nenhum. Não há chamada a provedor de IA nem a serviço de terceiro.

**Seed/fixture:** sintético. As chaves do Redis falso no teste usam IPs de rede privada (`172.20.0.5`, `10.0.0.1` a `10.0.0.4`) e valores inventados (`infra/test/carga-sala.test.ts:330-376`). Não há nenhum dado real.

**Pergunta de fechamento:** esta correção não muda o que o sistema guarda sobre um aluno nem para onde isso vai. O único rastro, o IP na chave do Redis, vive um minuto, está mapeado em `docs/lgpd.md:188-190` e continua sem sair do script. A resposta à secretaria não muda.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Hoje a garantia de que a chave e a mensagem de erro não saem vem do formato das funções: `registrarErro` não recebe argumento e `descreverBaldeNaoLido` só recebe fase e número. Isso já basta. Um caso de teste que injetasse um erro com `rl:ip:10.0.0.1` na mensagem e conferisse que nada da saída contém `rl:ip:` deixaria a regra 20 provada por teste, se alguém mudar essas funções no futuro.
2. `carga-sala.ts:659` é anterior a esta correção e imprime `erro.message` quando o cenário inteiro falha. Hoje o erro do Redis do medidor não chega ali. Vale lembrar disso se um dia o medidor passar a relançar o erro: a mensagem do `ioredis` pode trazer o comando com a chave.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/infra/scripts/carga-sala.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/infra/test/carga-sala.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/docs/lgpd.md (linhas 177 a 202, sem alteração nesta correção)
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/docs/runbook.md, /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/docs/infra.md, /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/tasks/prd-acesso-e-convites/16_task.md e /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/TODO.md: só trocam o número do pico (3.579 para 3.678) e marcam os itens como feitos, sem dado pessoal
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/tasks/correcoes/2026-11-10-medidor-do-balde-anonimo.md

## infra-guardian · 1ª rodada · APROVADO · 2026-11-10 09:54:46 · `tasks/correcoes/2026-11-10-medidor-do-balde-anonimo.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum. A correção muda o script e o teste da carga da sala, e os números nos documentos. Nada em `apps/` muda.
Rate limit: ok. O teto de 6.000 do `rl:ip` anônimo continua só como freio de inundação. Os baldes por escola, por nome, por turma e por conta seguem como estavam. Com o medidor que segue o cursor até `'0'`, o pico ficou em 3.678 por minuto (61%), abaixo do corte de 80% (4.800).
Fila e prioridade: ok (não se aplica).
Concorrência: protegida (não se aplica). O laço do medidor é um só por fase e roda dentro do script de carga.
Índice e paginação: ok (não se aplica). O `SCAN` agora segue o cursor até voltar a `'0'`, e o teste cobre isso com duas páginas.
Degradação de IA: não se aplica.
Migration: não se aplica.
Métrica e alerta: ok. O medidor passa a contar as leituras que falham e os erros do cliente Redis, e a linha "não foi lido" mostra essa contagem. Não imprime a chave (que leva o IP) nem a mensagem do erro, como pede a regra 20.
Bloqueantes: nenhum.
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/tasks/prd-acesso-e-convites/16_task.md:106` ainda diz "no `k2_conta` deu 1.593 ms". A medição nova deu 1.700 ms e a tabela da linha 102 já foi trocada. Falta alinhar essa frase.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/infra/scripts/carga-sala.ts:542`: o `cliente.on('error', medidor.registrarErro)` soma os erros de reconexão do `ioredis` na mesma conta das leituras que falham. Um comando que falha pode ser contado duas vezes, e o texto "N leituras falharam" fica inflado quando o Redis cai. Não muda o veredito da fase, que reprova sem leitura nenhuma. Separar as duas contagens, ou trocar o texto para "N erros do medidor", deixaria o diagnóstico mais exato.

Conferi os 44 casos de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/infra/test/carga-sala.test.ts` e todos passam. O `tsc` em `infra` e o `eslint` nos dois arquivos alterados terminam sem erro. Nenhum teste chama Redis de verdade nem provedor pago.

## test-engineer · 1ª rodada · APROVADO · 2026-11-10 09:55:15 · `tasks/correcoes/2026-11-10-medidor-do-balde-anonimo.md`

VEREDITO: APROVADO

Cenários exigidos:
- **Caminho feliz:** o `SCAN` segue o cursor por mais de uma página até voltar a `'0'`, e a chave do balde que só aparece na segunda página entra na leitura.
- **Borda: a chave expira entre o `SCAN` e o `GET`.** O `GET` devolve `null` e esse valor não pode virar 0.
- **Borda: valor que não é número.** Não pode entrar no pico como `NaN`.
- **Borda: chaves parecidas.** `rl:ip:op:*` e `rl:ip:senha:*` aparecem no mesmo `MATCH rl:ip:*` e precisam ficar de fora.
- **Borda: página única.** Ela já volta a `'0'`, então é lida uma vez, e sem chave do balde a leitura fica vazia (não 0).
- **Laço do medidor:** guarda o maior valor visto. Um erro no meio não apaga o pico, e a leitura que lança é contada. O erro que o cliente emite também é contado.
- **Nenhuma leitura deu certo:** o pico é `undefined`, e a linha "não foi lido" mostra quantos erros houve, com singular e plural.
- **Privacidade:** a linha impressa não leva a chave (que contém o IP) nem a mensagem do erro.
- **Não se aplicam:** permissão, isolamento entre escolas e concorrência. É script de carga, sem dado de escola, e o laço é um só, sequencial.

Cobertos (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/infra/test/carga-sala.test.ts`, describe "o medidor do balde anônimo"):
- **Cursor:** "segue o cursor até voltar a `0`…" confere o resultado e os cursores pedidos, `['0','17']`.
- **Filtro e valores descartados:** "lê só as chaves do balde anônimo, descarta o valor que expirou ou não é número…" cobre `op`, `senha`, `null` e `'lixo'` numa leitura de duas páginas.
- **Página única:** "uma única página que já volta a `0`…".
- **Laço:** "o laço guarda o maior valor visto…" (linha 232) espera `{ pico: 3579, erros: 2 }`.
- **Nada lido:** "sem nenhuma leitura que deu certo…" (linha 243) confere `pico` `undefined` e o texto da linha com 0, 1 e N erros.
- **Mutações:** conferi as 7 contra o `git diff`. Cada uma cai no caso citado pelo motivo certo:
  - `while (false)` devolve `[]` no lugar de `[3579]`.
  - Sem o filtro, entra o 9999.
  - Sem o `!== null`, entra um 0.
  - Sem o `isFinite`, entra um `NaN`.
  - Sem as duas contagens de erro, `erros` fica 1 no lugar de 2.
  - Sem o plural, o caso de 1 erro falha.
- **Teste:** rodei `npx vitest run infra/test/carga-sala.test.ts`: 44 de 44 passaram. Não há `.skip`, e o Redis falso fica fora da regra testada (é só o `ioredis`). Não há IA nem provedor pago.
- **Prazo:** o laço usa `pausaMs = 1` com `vi.waitFor`, então não depende de a máquina estar folgada.
- **Números nos documentos:** o pico novo, 3.678 de 6.000 (61%), está igual em `16_task.md` (linhas 92, 102 e 104), `docs/runbook.md`, `docs/infra.md` 5.1 e `TODO.md`.

Bloqueantes: nenhum.

Recomendações:
1. **A ligação do erro do cliente não é provada** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/infra/scripts/carga-sala.ts:541`, `cliente.on('error', medidor.registrarErro)`). Se ela voltar a `() => undefined`, nenhum caso falha. O teste da linha 232 chama `registrarErro()` direto, mas o nome dele e o "Teste que reproduz" dizem "erro de cliente contados". Não bloqueia por dois motivos:
   - a linha não tem condição (o `--faltando` dá 0);
   - com o Redis fora do ar, o `scan` também rejeita (`maxRetriesPerRequest: 1`), e o `catch` já provado deixa `erros > 0`. O diagnóstico "foi o Redis" sobrevive.

   Se quiser prová-la, `medirOBaldeAnonimo` pode receber o cliente (ou uma fábrica), e o teste usa um `EventEmitter` falso que emite `'error'`.
2. **A mensagem pode contar o mesmo erro duas vezes.** A mesma queda de conexão entra pelo evento `'error'` e de novo pela rejeição da leitura. A linha diz "N leituras falharam", mas N mistura os dois. Melhor trocar para "N erros do Redis" ou separar as duas contagens.
3. **O caso da linha 243 não confere os erros que o nome promete.** Ele diz "com os erros contados", mas passa `erros` para dentro do texto esperado, então o caso passaria até com `erros = 0`. A mutação está coberta pelo caso da linha 232, mas este caso deveria ter o seu próprio `expect(erros).toBe(tentativas)` ou `toBeGreaterThanOrEqual(2)`.
4. **A chamada em `executar` não tem caso.** Em `carga-sala.ts:632`, `descreverBaldeNaoLido(fase, erros)` está dentro da função que só a carga real roda. Trocar `erros` por `0` não seria pego. Dá para aceitar como cola, mas fica registrado.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-10 10:13:02 · `tasks/correcoes/2026-11-10-medidor-do-balde-anonimo.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum (só o script de carga `infra/scripts/carga-sala.ts`, o teste dele e documentos)
Rate limit: ok (nada mudou no limite; o balde `rl:ip` só é medido, e o teto de 6.000 continua sendo conferido pelo cenário)
Fila e prioridade: ok (não se aplica)
Concorrência: protegida (não se aplica: o diff não cria nenhuma operação que grave)
Índice e paginação: ok (não se aplica)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (nenhum alerta novo, e o runbook não precisa de ajuste)
Bloqueantes: nenhum
Recomendações:
- A nova asserção `expect(erros).toBe(tentativas)` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/infra/test/carga-sala.test.ts` dá sempre o mesmo resultado. O `ler` falso rejeita na hora, e `parar()` espera o laço terminar, então nenhuma tentativa fica sem contar. Rodei o arquivo: 44 de 44 passam.
- O bloco de mutação novo é pego pelo caso do singular (`1 erro do Redis`). Não há mais "leituras falharam" no código nem nos documentos vivos, só no registro histórico em `tasks/correcoes/achados/`, o que está certo.
- O item novo do `TODO.md` cita "perto da linha 659". Hoje a linha 659 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/infra/scripts/carga-sala.ts` é mesmo a que imprime `erro.message`. Como esse número envelhece, vale citar a função ou a frase (`o cenário não terminou`) em vez da linha.
- O destino das recomendações da 1ª rodada está registrado no documento da correção e no `TODO.md`. Sigo de acordo: nenhuma delas bloqueia, porque com o Redis fora do ar o `scan` rejeita e o `catch`, que tem teste, deixa `erros > 0`.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-10 10:13:06 · `tasks/correcoes/2026-11-10-medidor-do-balde-anonimo.md`

VEREDITO: APROVADO

Esta rodada mudou pouco. A frase "leituras falharam" virou "erros do Redis", o teste ganhou um caso que confere a contagem, e dois documentos tiveram número corrigido. Nenhuma dessas mudanças toca dado de pessoa.

Campos pessoais tocados: nenhum. A mudança é a frase impressa pelo script de carga e os comentários dele. Não há migration, DTO nem rota nova.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: não se aplica. Nenhum endpoint mudou.

Logs: limpos.
- A linha nova em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/infra/scripts/carga-sala.ts:494` só leva o nome da fase e um número. A chave `rl:ip:<ip>` e a mensagem do erro continuam sem caminho até a saída.
- `registrarErro` (linha 516) não recebe argumento, e o `catch` da linha 509 descarta o erro sem guardá-lo.
- A troca de `() => undefined` por `medidor.registrarErro` (linha 541) também não passa a mensagem do `ioredis` adiante.

Auditoria: não se aplica. O script de carga roda sobre seed sintético e não faz nenhuma das ações que a regra 20, item 10, manda auditar.

Envio externo: nenhum.

Seed/fixture: sintético. O teste usa só o nome de fase `k2_conta` e números.

Minhas duas recomendações da 1ª rodada ficaram resolvidas.
- **O caso de teste que injetaria `rl:ip:10.0.0.1` na mensagem foi recusado, e a recusa se sustenta.** Pelas assinaturas atuais (`registrarErro(): void` e `descreverBaldeNaoLido(fase, erros)`), a chave não tem por onde chegar à linha impressa. O caso passaria por construção e não teria nada para a mutação derrubar.
- **O `erro.message` da linha 659 foi para o `TODO.md`, com dono e gatilho.** A linha é anterior a esta correção, e hoje o erro do medidor não chega até ela. O destino serve.

Bloqueantes: nenhum.

Recomendações:
- Quando alguém tocar a assinatura de `medirOBaldeAnonimo` ou o tratamento de erro da carga, olhar os dois itens novos do `TODO.md` na mesma tarefa: a linha 659 e a ligação do `on('error')` sem caso de teste. Se o medidor passar a relançar o erro, a linha 659 pode imprimir a chave com o IP. Por isso esses dois itens não deveriam ser tratados separados.

Pergunta de fechamento: esta correção não muda o que o sistema guarda sobre um aluno nem para onde isso é enviado. A resposta continua a mesma da rodada anterior.

## test-engineer · 2ª rodada · APROVADO · 2026-11-10 10:13:25 · `tasks/correcoes/2026-11-10-medidor-do-balde-anonimo.md`

VEREDITO: APROVADO

Cenários exigidos (nesta rodada, só o que o diff da 1ª para a 2ª muda):
- O texto novo de `descreverBaldeNaoLido` ("N erros do Redis"), com a regra do singular e do plural.
- O contador de erros do laço `acompanharOBalde` bate com o número de leituras que lançaram.
- O bloco de mutação do documento acompanha o texto novo.

Cobertos:
- **Singular e plural:** o caso `infra/test/carga-sala.test.ts › sem nenhuma leitura que deu certo` (linhas 254 a 256) compara três textos exatos, com 3, 0 e 1. Se a escolha entre singular e plural sumir, a linha 256 recebe "1 erros do Redis" e o caso falha. O bloco `mutacao` do documento está atualizado e o seu trecho "antes" bate com `infra/scripts/carga-sala.ts:494`.
- **Contador de erros:** `expect(erros).toBe(tentativas)` (linha 253) é mais forte que a versão anterior. A antiga montava o texto esperado com o próprio `erros` e passaria com qualquer contagem. O resultado também não depende de sorte. Em `carga-sala.ts:505-523`, cada volta do laço chama `ler` uma vez e conta o erro no `catch`. O `ativo` é conferido antes de cada chamada, e `parar()` espera o laço terminar (`await laco`), então nenhuma leitura fica pela metade fora da conta.
- **Texto antigo:** não sobrou "leitura falhou" nem "leituras falharam" em `infra/`, `docs/`, no documento da correção nem em `16_task.md`.
- `npx vitest run infra/test/carga-sala.test.ts` passou, com 44 de 44 casos verdes.
- As duas recomendações minhas da 1ª rodada que ficaram sem aplicar estão registradas:
  - A ligação `cliente.on('error', medidor.registrarErro)` sem caso foi para o `TODO.md`, com dono e motivo.
  - A chamada de `descreverBaldeNaoLido` em `executar` sem caso foi recusada com motivo escrito, que aceito.

Bloqueantes: nenhum.

Recomendações:
- A linha 254 confere o texto com 3, um valor fixo, e não com o `erros` medido. Ela está certa como prova do texto, mas não liga o contador ao texto. Hoje só a chamada em `executar` (`carga-sala.ts:632`) faz essa ligação, e ela já está registrada como cola que só a carga real roda.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/infra/scripts/carga-sala.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/infra/test/carga-sala.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/tasks/correcoes/2026-11-10-medidor-do-balde-anonimo.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/.processo/ordens/diff-medidor-r1-r2.patch
