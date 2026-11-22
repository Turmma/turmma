# Achados das revisões — `tasks/prd-reserva-e-avaliacao/7_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-22 19:40:41 · `tasks/prd-reserva-e-avaliacao/7_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela foi criada ou alterada. A tarefa não tem migration nem schema.

Queries verificadas: nenhuma query, repository ou endpoint foi criado ou alterado.
- Em `packages/core/src/ia/llm-gateway.ts`, o balde da reserva usa a chave `provedor:modelo`, montada pela `chaveDoBalde(identidade, modelo)`. A chave sai da configuração do adaptador, e nada do pedido do cliente entra nela. O balde serve a todas as escolas, como o do principal, e isso está escrito em `docs/infra.md` 5.4.
- A métrica `ia.tokens.uso_do_teto` só tem os rótulos `provedor` e `modelo`, sem `escolaId`, execução ou usuário.
- O alerta `infra/grafana/alertas/ia-tokens-acima-do-teto.yaml` e o painel `infra/grafana/paineis/fundacao.json` agrupam por `max by (provedor, modelo)`, e nenhum dos dois tem rótulo de escola.
- O log do desvio à reserva continua só com ids (escola e execução), como já era.
- Nenhum endpoint recebe `escolaId` do cliente, não há `@Unscoped()` novo, não há id novo e a camada rede não é tocada.

Teste de isolamento: não se aplica. A tarefa não cria módulo, repository, query nem endpoint, então não há cláusula de escopo para o teste provar.

Bloqueantes: nenhum

Recomendações:
- O balde geral da reserva é dividido por todas as escolas, como o do principal. Uma escola com muito uso pode esgotá-lo e deixar as outras em `sem_vaga`. Hoje isso é questão de disponibilidade, não de vazamento entre escolas. Convém incluir o balde da reserva no item do `TODO.md` que trata da parte por escola, para os dois serem tratados juntos quando o piloto tiver mais de uma escola com carga real.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-22 19:41:00 · `tasks/prd-reserva-e-avaliacao/7_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A tarefa não cria migration, coluna, repository nem endpoint. Ela mexe no roteamento do gateway de IA (`packages/core/src/ia/llm-gateway.ts`), na métrica `ia.tokens.uso_do_teto`, no alerta e na documentação.

Fora da tabela de dados do docs/lgpd.md: nada, porque não entra campo novo.

Autorização por objeto: não se aplica, pois nenhuma rota foi criada ou alterada.

Logs: limpos.
- `desviarParaAReserva` (`llm-gateway.ts:589-594`) registra só tarefa, `escolaId`, `execucaoId` e `provedorId`.
- `descer` (`llm-gateway.ts:768-772`) registra só tarefa, `modeloId` e código.
- O `sem_vaga` novo (`llm-gateway.ts:581-586`) vira `LLMError` com código, espera e motivo, sem texto do pedido.
- A métrica nova leva só `provedor` e `modelo` (`llm-gateway.ts:153`).
- O alerta (`infra/grafana/alertas/ia-tokens-acima-do-teto.yaml`) e o painel (`fundacao.json`) agrupam por `provedor` e `modelo`. O teste confere que a expressão não tem escola, usuário, execução nem aluno (`infra/test/alertas.test.ts`).

Auditoria: não se aplica. Nenhuma ação da tarefa exige auditoria pela regra 20, item 10: não há leitura de dado de aluno, exportação, nota, permissão nem aprovação de saída de IA.

Envio externo:
- **O que muda:** há dois caminhos novos que podem mandar o pedido ao provedor de reserva. Um é o 429 que sobra depois do modelo menor. O outro é a falta de vaga no principal, depois da espera de 8 s e do menor.
- **Mesma regra de elegibilidade nos três caminhos (queda, 429 e falta de vaga):** todos passam por `reservaDoPedido` e `reservaAtende` (`llm-gateway.ts:526-539`). Essa função confere a D62 e a aprovação por tarefa, provedor e modelo. Por isso o Tutor, que manda conversa de aluno, só vai a uma reserva conferida e aprovada para ele.
- **Testes que provam:** "aprovação só da geração, principal sem vaga e sem menor" mostra o Tutor terminando `sem_vaga` sem chamar a reserva. "Tutor aprovado no `rapido` da reserva" mostra a reserva atendendo quando ela é aprovada.
- **Mínimo enviado:** o desvio por falta de vaga apaga a correção do principal (`correcao = undefined`, `llm-gateway.ts:477`), e o teste "a repetição que fica sem vaga no principal vai à reserva sem a correção dele" prova isso. A reserva recebe só o pedido limpo.
- **Registrado?** Sim. O consumo grava o destino de cada chamada: `alunoId`, `provedorId` e `peloProvedorDeReserva: true` aparecem no teste do Tutor. A reserva recusada pelo próprio balde não deixa linha, porque nada saiu (`prazo-com-tokens.int.test.ts`, caso do balde fechado). Assim, "para onde isso já foi enviado" continua respondido linha a linha.

Seed/fixture: sintético. São ids como `ALUNO_1`, provedores e modelos falsos, e nomes de modelo genéricos no teste de alertas. Não há dado real.

Bloqueantes: nenhum.

Recomendações:
- O log `ia.geracao.sem_vaga` (`llm-gateway.ts:770`) não leva `escolaId` nem `execucaoId`, ao contrário do log de desvio à reserva. Incluir esses dois ids, que já são permitidos, ajudaria a Operação a ligar o fim `sem_vaga` à linha de consumo e ao job. Não é falta de privacidade.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-22 19:41:08 · `tasks/prd-reserva-e-avaliacao/7_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa 7.0 mexe só no gateway de IA (a vaga de tokens e o desvio à reserva), na métrica, no alerta, no painel e na documentação. Não há migration, repository, job, seed ou webhook novo. Todos com autor humano? Não se aplica: nenhum caminho de escrita em `Nota` foi criado ou alterado.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. A tarefa não cria saída nova que chegue ao aluno. O que mudou foi o motivo que leva a chamada à reserva: além da queda do principal, agora também o 429 que sobrou da repetição e a falta de vaga no balde. Os três caminhos passam pela mesma função de elegibilidade (`reservaDoPedido`, que chama `reservaAtende` e `reservaElegivel`, em `packages/core/src/ia/llm-gateway.ts:525-537`). Ela exige a conferência da D62 e a aprovação por tarefa, provedor e modelo. A linha de consumo grava o destino e o modelo de fato chamados (`gasto.destino` e `gasto.modelo`, linhas 482-483), então a auditoria continua respondendo o que a IA gerou e por qual provedor.

Supervisão do tutor: ok. Nada muda no que o professor vê. A D36 se mantém: o Tutor e a classificação nunca descem ao modelo menor, porque `modeloMenorDaTarefa` (linha 723) atende os dois ramos novos, o da falta de vaga e o do `limite`. Os testes `llm-gateway.test.ts:2032`, `:2632` e `:2657` provam isso com `modelosMenores` configurado. Uma conversa de aluno só chega à reserva se o Tutor estiver aprovado nela e ela tiver passado pela conferência da D62.

Autonomia declarada e visível: sim, sem alteração nesta tarefa.

Bloqueantes: nenhum.

Recomendações:
- O teste que prova a D62 na reserva (`llm-gateway.test.ts:2272`, "a reserva só atende o que a subida conferiu na D62") cobre só o ramo da queda. A proteção nos ramos novos (falta de vaga e `limite`) vem da função de elegibilidade ser uma só. Um caso a mais, com o Tutor aprovado, a reserva sem a conferência da D62 e o principal sem vaga, terminando `sem_vaga` sem chamar a reserva, deixaria isso provado por teste nos três caminhos, e não só pela estrutura do código.
- O log do desvio (`desviarParaAReserva`, linha 589) leva só ids e `provedorId`, como manda a regra 20, item 9. Fica registrado aqui para quem fizer a auditoria de privacidade.

Conferência: rodei `llm-gateway.test.ts` (projeto `unidade`) e os 204 testes passaram.

## llm-integrator · 1ª rodada · APROVADO · 2026-11-22 19:41:11 · `tasks/prd-reserva-e-avaliacao/7_task.md`

VEREDITO: APROVADO

Perfis usados: a tarefa não cria chamada de modelo nem perfil. Ela só decide para onde vai a chamada que já existe, e cada tarefa continua com o perfil que já tinha.
- O desvio à reserva respeita `reservaAtende`: D62 conferida e aprovação por tarefa, provedor e modelo.
- O Tutor e a classificação não descem ao menor (D36). Ficam como estavam: vão direto à reserva aprovada ou terminam `sem_vaga`.

Custo estimado por professor/mês: nenhuma chamada nova por professor. O desvio só troca o destino de chamadas que já seriam feitas, sem criar nenhuma.
- Os baldes de tokens por minuto ficam inalterados e o de reserva é um teto novo.
- O teto de 4 chamadas por execução vem da 6.0.
- O gasto extra só existe quando o principal está sem vaga ou fora do ar, e então a reserva custa o preço dela, `LLM_RESERVA_TOKENS_POR_MINUTO`, no lugar do principal. Em operação normal o custo extra é zero.
- Esse custo da reserva ainda não tem número. Precisa ser fechado com a tabela de preço do contrato da reserva (D29, D37) e ir para a avaliação de modelos. É recomendação, não bloqueante.

Prompt versionado: não se aplica. Nenhum prompt foi tocado.

Validação de schema: sim, a conferência da saída e a repetição existentes não mudaram. A repetição na reserva começa sem a correção do principal (`correcao = undefined`), e há teste e mutação para isso.

Aprovação humana no caminho: não se aplica. A tarefa não muda o que a IA entrega, só o roteamento. As entregas continuam nascendo pendentes.

Verificações feitas:
- `npx vitest run --project unidade llm-gateway.test.ts infra/test/alertas.test.ts`: 222 testes passam.
- `prazo-com-tokens.int.test.ts`: 10 testes passam, com a infra de teste real.
- `llm-gateway.ts`:
  - Cada vaga é devolvida pela chamada que caiu: a do menor quando o menor cai, e a do principal só no `catch` de `chamarComDegrau`. Não há devolução dupla.
  - `reservarNaReserva` usa `limiteDeTokensDaReserva` e a chave `provedor:modelo` da reserva.
  - O limitador da reserva já está ligado em `ia-do-worker.module.ts:109`.
  - Sem limitador (só no `local`), a chamada vai direto.
  - A reserva não espera pela vaga: uma tentativa só, e o prazo de 20 s da execução continua valendo.
- O gauge `uso_do_teto` e o `usosDoTeto` saem por `provedor` e `modelo`. A chave do mapa é `provedor:modelo`, então os dois falsos com o mesmo modelo não se sobrescrevem.
- O alerta de 70% e o de 80%, o painel e o runbook usam `max by (provedor, modelo)`. O teste lê a `expressao` do yaml.
- `docs/infra.md` 5.4 diz que a reserva do mesmo provedor divide o contratado da conta, e que a soma dos dois contratados não pode passar do que o contrato dá.
- Isolamento e privacidade:
  - Não há query nem repository novo.
  - O balde da reserva é de todas as escolas, como o do principal, e o doc diz isso.
  - O log e a métrica levam só tarefa, ids e modelo.
  - Nenhum teste chama provedor pago.

Bloqueantes: nenhum

Recomendações:
- `infra/test/alertas.test.ts` (caso novo): ele refaz o agrupamento do Prometheus no próprio teste com séries escritas à mão. A parte que prova algo é só `agrupaPor` igual a `['provedor','modelo']`, e as séries à mão não acrescentam prova. É inofensivo, mas pode ser enxugado.
- Se a reserva falhar na repetição por falta de vaga, a saída já obtida na primeira chamada da reserva é descartada, e a execução termina `sem_vaga`. O comportamento é coerente com a divergência registrada. Mesmo assim, vale registrar no runbook que o `sem_vaga` pode vir depois de uma chamada à reserva já feita.
- Falta o custo da reserva por escola/mês, descrito acima, para a precificação deixar de ser chute.
- A tabela "Recomendações sem aplicar" de `7_task.md` está vazia, como deve estar nesta rodada.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-22 19:41:25 · `tasks/prd-reserva-e-avaliacao/7_task.md`

VEREDITO: APROVADO
Caminho quente tocado: IA
Rate limit: ok (a reserva usa o `TokenLimiter` dela, com balde por `provedor:modelo` e por fila, compartilhado entre as réplicas. Não há limite por IP)
Fila e prioridade: ok (a reserva usa a mesma fila do pedido, `pedido.fila`. O Tutor e a classificação nunca descem ao modelo menor, como manda a D36)
Concorrência: protegida (a mudança não grava nada no banco. A vaga sai de uma reserva atômica no limitador. A devolução acontece só na chamada que falhou sem chegar ao provedor e só no balde dela: o do modelo menor quando foi ele que caiu, nunca o do principal que o 429 já gastou. O laço tem fim: a reserva sem vaga cai em `reservaDoPedido`, que devolve `undefined` porque `alvo.peloProvedorDeReserva` é verdadeiro, e a chamada termina `sem_vaga`)
Índice e paginação: não se aplica (a tarefa não tem query nova)
Degradação de IA: ok (a ordem é espera, modelo menor, reserva elegível e, por último, `IA_INDISPONIVEL`/`sem_vaga` com `tenteDeNovoEmSegundos`. A reserva não espera vaga, então o prazo de 60 s e 140 s não aumenta. `prazo-com-tokens.int.test.ts` passou, 10 de 10)
Migration: não se aplica
Métrica e alerta: ok (`ia.tokens.uso_do_teto{provedor,modelo}`. Os dois alertas agrupam por `provedor` e `modelo`, o runbook e o painel foram atualizados, e `alertas.test.ts` lê a expressão do yaml. `llm-gateway.test.ts` e `alertas.test.ts` passaram, 222 de 222)
Bloqueantes: nenhum
Recomendações:
- `infra/grafana/alertas/ia-tokens-acima-do-teto.yaml:74`: a `description` do alerta de 80 % ainda diz "depois vai ao modelo menor ou termina Tentar de novo" e não menciona a reserva. O runbook já foi atualizado; falta alinhar este texto.
- `packages/core/src/ia/llm-gateway.ts:563-569`: quando o principal e a reserva estão os dois sem vaga, o `tenteDeNovoEmSegundos` usa só a espera do balde da reserva. Se o balde do principal liberar antes, o lote espera mais que o necessário. Vale usar o menor dos dois `msAteLiberar`, ou registrar a escolha na techspec.
- Quando a chamada vai à reserva e ela também está sem vaga, a métrica `ia.degradacao` conta dois degraus no mesmo pedido: `provedor_de_reserva` e `indisponivel`. O runbook deve avisar isso para quem lê o painel "IA: degraus da degradação", para que ninguém some os dois como pedidos diferentes.
- A carga com a reserva continua na tarefa 9.0. Ela precisa ter o cenário do balde do principal cheio às 10h com o transbordo para a reserva. Também precisa ter o caso da reserva no mesmo provedor, em que os dois baldes dividem a cota da conta (`docs/infra.md` 5.4).

## revisor-geral · 1ª rodada · APROVADO · 2026-11-22 19:42:11 · `tasks/prd-reserva-e-avaliacao/7_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

As quatro subtarefas foram feitas. A tarefa só mexeu nos arquivos que a tabela "Arquivos previstos" lista, e nada entra na carga (9.0). O comportamento segue a §5 da Tech Spec:
- o ramo sem vaga vai do principal ao menor e depois à reserva, conferida pela mesma `reservaDoPedido` dos dois ramos;
- o 429 que sobrou desce ao menor e depois vai à reserva;
- a queda do principal reserva no balde dela;
- a vaga do menor volta ao balde quando ele cai sem sair;
- `usosDoTeto` é por `provedor:modelo`;
- o alerta, o painel e o runbook foram atualizados juntos.

A divergência ("a reserva não espera") está na `techspec.md` §5, em "A vaga da reserva (7.0)", no `docs/infra.md` 5.4 e no `prazo-da-execucao.ts`. O caso de integração prova que o pedido termina aos 20 s exatos, sem a espera.

Também conferi que:
- o `limiteDeTokensDaReserva` chega de fato ao gateway (`ia-do-worker.module.ts:109`);
- o `sem_vaga` que vem depois de um 429 que saiu ainda grava a linha do principal (`llm-gateway.ts:374`, `gasto.chamadas.length > 0`);
- o laço não fica preso: sem vaga na reserva, ele termina com erro na hora.

Recomendações:
1. `tasks/prd-reserva-e-avaliacao/cenarios.md:49`: a divergência não está no `cenarios.md`. A tabela de divergências da `7_task.md` aponta a linha do 429 (:45), mas essa linha não fala da espera. Acrescentar à linha 49 "uma tentativa só, sem a espera de 8 s", com a mutação "esperar no balde da reserva".
2. `tasks/prd-reserva-e-avaliacao/techspec.md:73-74`: o texto ficou velho. Ainda diz que, sem menor ou sem vaga nele, termina com o motivo `limite`, sem a ressalva "quando não há reserva elegível". Diz também que "o `sem_vaga` depois da reserva é o da 4.0", e agora ele é da 7.0.
3. `packages/core/src/ia/errors.ts:39`: o comentário do `limite` ainda diz só que "desce o degrau do modelo menor" e não cita a reserva depois do menor. Já o do `sem_vaga` foi atualizado.
4. `apps/api/src/ia/prazo-com-tokens.int.test.ts`, no caso "a reserva com o balde dela fechado…": o título promete `sem_vaga`, mas o teste só confere `codigo: 'IA_INDISPONIVEL'`. Conferir também o `motivo`. O caso unitário já cobre isso, então não bloqueia.
5. `packages/core/src/ia/llm-gateway.ts:570`: o nome `reservaPorFaltaDeVaga` parece de quem só devolve um valor, mas a função também lança o erro de fim (`semVaga`). Um nome que deixe as duas saídas claras ajuda quem lê o laço em `chamarAteValer` (:475).

## test-engineer · 1ª rodada · APROVADO · 2026-11-22 19:43:18 · `tasks/prd-reserva-e-avaliacao/7_task.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:**
  - Sem vaga no principal e no menor, a chamada vai à reserva, no balde `provedor:modelo` dela e na fila do pedido.
  - O uso real acerta a vaga da reserva.
- **Ordem da degradação:** com o menor disponível, a chamada vai ao menor, e o balde da reserva nem é consultado.
- **O 429 que sobra:**
  - Com o menor sem vaga, ou também recusando, a chamada termina na reserva.
  - As linhas de consumo saem na ordem: a estimada do principal, a do menor e a da reserva.
- **D36:** o Tutor e a classificação, com o menor configurado para o `rapido`, vão direto à reserva aprovada.
- **Balde próprio:** sem vaga na reserva, a chamada termina `sem_vaga`, com a espera do balde dela (3 s, e não o 1 s do principal). Com o balde da reserva aberto, o mesmo caso atende.
- **Queda do principal:** a reserva reserva no balde dela. Sem vaga ali, termina `sem_vaga` sem chamá-la.
- **Permissão:** com aprovação só da geração, a geração vai à reserva e o Tutor termina `sem_vaga` sem chamá-la (RF2).
- **Controle positivo do RF4:** o Tutor aprovado no `rapido` da reserva é atendido nela, sem passar pelo menor.
- **Métrica:** `ia.tokens.uso_do_teto` sai em duas séries quando os dois falsos têm o mesmo modelo.
- **Alerta:** o alerta de tokens agrupa por `provedor` e `modelo`.
- **A cláusula de `isLimite`:**
  - O 5xx vai à reserva sem passar pelo menor.
  - O erro que tem a forma do `limite` mas não é da camada de IA não desce ao menor.
  - O `limite` com outro código também não desce.
- **O menor não repete:** o menor que já era o modelo da chamada e recebe 429 vai à reserva, sem descer de novo.
- **Pedido limpo:** a repetição que fica sem vaga vai à reserva sem a correção do principal.
- **Contagem do degrau:** o 429 que o menor atende conta `modelo_menor`, e não `indisponivel`.
- **A vaga do menor:** o menor que cai sem sair devolve a vaga dele, e a do principal fica.
- **Prazo:**
  - Com o balde da reserva fechado, a chamada termina `sem_vaga` aos 20 s, sem a espera de 8 s.
  - Com os dois baldes abertos, a quarta chamada, na reserva, estoura o prazo.
- **Isolamento:** não se aplica. A tarefa não cria repository, query nem endpoint, e o balde da reserva é de todas as escolas, como diz `docs/infra.md`.
- **Concorrência:** fica com a carga (9.0) e com `token-limiter.int.test.ts`. O gateway não ganhou estado que duas chamadas disputem, além do mapa da métrica.

**Cobertos:** todos.
- Cada uma das 17 linhas da tabela de `tasks/prd-reserva-e-avaliacao/7_task.md` tem o seu teste, achado pelo nome. As linhas 53 e 60 juntam casos com ponto e vírgula, e conferi cada um deles.
- Rodei os três arquivos, e todos passam:
  - `llm-gateway.test.ts`: 204 testes.
  - `prazo-com-tokens.int.test.ts`: 10 testes.
  - `infra/test/alertas.test.ts`: 18 testes.
- Conferi a seção "Mutações" contra o `git diff` de `llm-gateway.ts`. Toda condição nova tem bloco:
  - `isLimite`, com os três termos;
  - `reservaParaOErro`, com os dois termos;
  - `reservaDoPedido`;
  - a escolha do limitador e da identidade na chave do balde da reserva;
  - a fila do pedido;
  - `semVaga` e o modelo do log;
  - `desceAoMenor`, com os três termos;
  - `haReserva`;
  - `reservarOMenor ?? semVaga`;
  - as duas chamadas de `devolverAVaga`;
  - o `correcao = undefined`;
  - a chave de `usosDoTeto` e o rótulo `provedor`.
- Cada bloco aponta para um caso que chega à cláusula. Por exemplo, a mensagem do `sem_vaga` só é distinguível porque o balde da reserva espera 3 s e o do principal 1 s.
- As asserções olham o resultado: o erro tipado, os pedidos e acertos por balde, a ordem das linhas de consumo, as séries da métrica e a expressão lida do yaml.
- Não há `.skip`, teste comentado nem provedor pago: os testes usam `principalRoteirizado`, `ReservaRoteirizada`, `FakeAdapter`, `LentoAdapter` e o `ResilientAdapter` real.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **A vaga da reserva devolvida quando a reserva cai sem sair não tem caso próprio.** A subtarefa 7.1 exige "devolução na falha", e a seção "A vaga da reserva" do `techspec.md` afirma isso. Hoje a devolução só está provada pela mesma linha `devolverAVaga(vaga, erro)` que serve ao principal. Se alguém condicionar essa linha a `!alvo.peloProvedorDeReserva`, nenhum teste fica vermelho. Sugestão: um caso com queda do principal e a reserva devolvendo `disjuntor()` (semEnvio), afirmando `daReservaLimite.acertosPorModelo[DA_RESERVA]` igual a `[0]`. Fica em `packages/core/src/ia/llm-gateway.test.ts`, no describe da 7.0.
2. **`prazo-com-tokens.int.test.ts:253`** só afirma `codigo: 'IA_INDISPONIVEL'`. O `sem_vaga` sai por eliminação, porque a reserva não foi chamada e o balde dela recusou. Vale afirmar o `motivo: 'sem_vaga'`, se o `acompanhar` puder expô-lo.
3. **O caso "o 429 do Tutor com o balde da reserva também cheio"** (`llm-gateway.test.ts`, perto da linha 2657) não mede o degrau nem `tenteDeNovoEmSegundos`. Com medidor e `LimiteDeMentira(3_000)` na reserva, ele provaria duas coisas: que `indisponivel` conta uma vez só, sem contar duas nem zero vezes, e que a espera devolvida é a do balde da reserva também nesse caminho.
4. **A repetição da própria reserva sem vaga não tem caso.** Na sequência, a reserva responde inválido e o balde dela recusa a segunda chamada. O resultado deveria ser `sem_vaga`, com as linhas de consumo certas. É borda nova da 7.0, porque antes a reserva não tinha balde.
5. **O cenário RF3 "O 4xx rejeitado…, com menor e reserva elegível disponíveis"** (`cenarios.md:47`) está coberto por dois casos separados: o da linha 2059, só com o menor, e o da linha 2228, só com a reserva e sem limitador. Cada mutação é pega, mas um caso com os dois configurados e o limitador da reserva mostraria o cenário como a spec o escreve.
6. **O RF4 positivo** (`cenarios.md:29`) pede "entrada e saída nulas" na linha. O caso "Tutor aprovado no `rapido` da reserva…" não as afirma no ramo do sem vaga.
7. **Em `infra/test/alertas.test.ts`**, o agrupamento simulado do caso novo sai como consequência de `agrupaPor` ser `['provedor','modelo']`. Quem prova de fato é a expressão exata, conferida no caso anterior. Não precisa mudar, só registro.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-22 20:03:59 · `tasks/prd-reserva-e-avaliacao/7_task.md`

VEREDITO: APROVADO
Tabelas verificadas: nenhuma. O diff da 2ª rodada não traz migration nem schema.
Queries verificadas: nenhuma. Não há repository, query nem endpoint novo ou alterado. A mudança em `packages/core/src/ia/llm-gateway.ts` só renomeia `reservaPorFaltaDeVaga` para `reservaOuFimSemVaga` (linhas 475 e 570), sem mudar o comportamento. Não sobrou nenhuma referência ao nome antigo, e a mutação em `7_task.md:175` acompanha o nome novo. Esta rodada não mexe na trava que recusa o pedido quando o `escolaId` dele diverge do `escolaId` do contexto (`llm-gateway.ts:327-328`). Os casos novos de teste usam só o gateway com dependências falsas e não abrem caminho para a escola vir do cliente.
Teste de isolamento: não se aplica a esta rodada. Não há módulo, repository nem endpoint novo que precise de um. Nada do que mudou alcança o escopo de escola.
Bloqueantes: nenhum.
Recomendações:
- A recomendação da 1ª rodada (`tenancy-guardian`) continua sem item próprio: o balde da reserva também é um só para todas as escolas, e isso precisa entrar no item da parte por escola do balde de tokens no `TODO.md`. É disponibilidade, não vazamento. Pela `7_task.md:279`, quem escreve é o Orquestrador na retro. Conferir lá que ficou escrito.

## llm-integrator · 2ª rodada · APROVADO · 2026-11-22 20:04:27 · `tasks/prd-reserva-e-avaliacao/7_task.md`

VEREDITO: APROVADO

Perfis usados: nenhum perfil novo. O diff é só rename, testes, textos e o `TODO.md`. A reserva continua no perfil da própria tarefa, e o `rapido` segue no Tutor e na classificação. Nada foi trocado para um perfil mais caro.

Custo estimado por professor/mês: a rodada não adiciona chamada de modelo. A reserva só atende quando o principal cai ou fica sem vaga. A estimativa por escola/mês continua destinada a `docs/avaliacao-de-modelos.md`, que precisa da tabela de preço do contrato. A recomendação de custo da 1ª rodada foi destinada, não aplicada, e não bloqueia.

Prompt versionado: sim, sem mudança nesta rodada.

Validação de schema: sim. O caso novo da reserva que devolve `'não é json'` prova o caminho de erro: o gateway repete a chamada na própria reserva e, sem vaga no balde dela, termina `sem_vaga` descartando a saída inválida.

Aprovação humana no caminho: não se aplica. Não há entrega de agente, nota nem mensagem à família nesta rodada.

Bloqueantes: nenhum. Conferi o diff desde a rodada aprovada e o que ele afeta.
- **Rename `reservaOuFimSemVaga`:** a chamada em `llm-gateway.ts:475` e a definição em `llm-gateway.ts:570` foram atualizadas. Não sobrou referência ao nome antigo em código, e a mutação em `7_task.md:175` acompanha o nome novo. O comportamento não mudou.
- **Mutação nova da devolução de vaga:** `if (!alvo.peloProvedorDeReserva) await this.devolverAVaga(...)` corresponde à linha `llm-gateway.ts:621`. O caso "a reserva que cai sem sair" confere `acertosPorModelo[DA_RESERVA]` igual a `[0]`, então a mutação o quebraria.
- **Casos novos de teste:** rodei `llm-gateway.test.ts` e os 208 testes passaram.
  - A D62 da reserva (regra 20, item 13) é provada nos caminhos `sem_vaga` e `limite`: sem a conferência, a reserva não é chamada e o balde dela nem é consultado.
  - O 4xx `rejeitada` com menor e reserva elegíveis não desce nem desvia.
  - O `sem_vaga` depois do 429 leva `tenteDeNovoEmSegundos: 3`, o degrau `indisponivel` uma vez só e uma linha de consumo.
  - Nenhuma linha de consumo da reserva guarda `entrada` ou `saida`.
- **Prazo (`prazo-com-tokens.int.test.ts`):** o teste agora confere `motivo: 'sem_vaga'` aos 20 s. Usa adaptador falso e relógio falso, sem provedor pago.
- **Textos:** `errors.ts`, o alerta, o runbook, `cenarios.md` e `techspec.md` dizem o que o código faz. O alerta continua com o runbook, e a nota de que um pedido pode contar dois degraus e de que o `sem_vaga` pode vir depois de uma chamada à reserva é correta.
- **`TODO.md`:** `escolaId` e `execucaoId` ausentes em `ia.geracao.sem_vaga` e o `tenteDeNovoEmSegundos` como menor dos dois baldes estão registrados com dono. Ficam como recomendação, não como violação.

Recomendações:
- O comentário em `llm-gateway.ts:620` diz "A vaga do principal que caiu sem sair volta ao balde". O trecho também devolve a vaga da reserva, que é o que a mutação nova prova. Dizer "A vaga do destino (principal ou reserva)".
- Os itens já registrados continuam abertos: `escolaId` e `execucaoId` em `ia.geracao.sem_vaga`, o menor dos dois `msAteLiberar`, e o cenário de carga do balde do principal cheio com transbordo (tarefa 9.0).
- O custo da reserva por escola/mês continua sem número até o preço do contrato da avaliação de provedor (D29, D37).

Arquivos relevantes:
- `packages/core/src/ia/llm-gateway.ts`
- `packages/core/src/ia/llm-gateway.test.ts`
- `apps/api/src/ia/prazo-com-tokens.int.test.ts`

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-22 20:04:30 · `tasks/prd-reserva-e-avaliacao/7_task.md`

VEREDITO: APROVADO

Esta rodada auditou só o diff `3ffa7aff..804eafec` (sem `achados/`) e o que ele afeta. O que não mudou desde a 1ª rodada aprovada não foi reauditado. A rodada anterior não exigiu correções, então não havia correção a conferir.

Campos pessoais tocados: nenhum. O diff só mexe em testes, comentário, um nome de método privado (`reservaPorFaltaDeVaga` passou a `reservaOuFimSemVaga`), textos de alerta e runbook, a spec e o TODO.md. Não há migration, DTO, rota nem campo novo. O único id de pessoa no diff é `ALUNO_1`, um UUID sintético de `packages/core/src/ia/__fixtures__/inputs.ts:16`, que o teste usa.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. Não há rota nem repository novo.

Logs: limpos. O único log citado é `ia.geracao.sem_vaga`, e ele leva só `tipo`, `modeloId` e `codigo`. Ele não tem nome, matrícula, resposta nem prompt. A minha recomendação da 1ª rodada (ele também levar `escolaId`/`execucaoId`) foi registrada no `TODO.md` e na tabela "Recomendações sem aplicar" da `7_task.md`, como combinado. Não é falta de privacidade, é rastreabilidade.

Auditoria: não se aplica. O diff não tem leitura de aluno por coordenação, exportação, nota, permissão nem aprovação de saída de IA.

Envio externo:
- **D62 testada nos dois caminhos que faltavam.** O caso novo em `packages/core/src/ia/llm-gateway.test.ts` (o `it('a D62 da reserva vale nos três caminhos…')`) prova que, sem a conferência da reserva, o Tutor aprovado não chega a ela, nem com o principal sem vaga nem com o 429. O balde dela nem é consultado. Antes isso só estava provado na queda e, nos outros caminhos, dependia da estrutura do código. Agora o teste cobre os três caminhos, o que reforça a regra 20, item 13.
- **A linha de consumo da reserva não guarda conteúdo.** O caso do Tutor na reserva passou a afirmar que essa linha não tem `entrada` nem `saida`. Ela leva `alunoId` (id), `provedorId` e `peloProvedorDeReserva: true`. O envio continua registrado, e cada chamada fica com o provedor dela.

Seed/fixture: sintético.

Bloqueantes: nenhum.

Recomendações:
- O parágrafo novo do runbook (`docs/runbook.md`, seção "Tokens acima de 80% do contratado") diz que a saída inválida da primeira chamada à reserva "é descartada". Ela de fato não é gravada: o consumo só tem a linha `[RESERVA, true, 'falhou']`. Mas essa saída já saiu para o provedor de reserva. Para a pergunta "para onde isso já foi enviado", quem lê precisa saber que esse envio aparece no compartilhamento pela linha `falhou` da reserva. Vale uma frase dizendo isso. É texto e não bloqueia.

Rodei `npx vitest run packages/core/src/ia/llm-gateway.test.ts` a partir da raiz do repositório e passaram os 208 testes. Quem responde ao fechamento hoje é a linha de consumo: o que foi enviado sobre o aluno, para qual provedor, e se foi pelo provedor de reserva.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-22 20:04:30 · `tasks/prd-reserva-e-avaliacao/7_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. O diff só mexe na camada de IA (gateway, baldes, prazo), em testes, no alerta, no runbook e em documentos da spec. Nenhum deles escreve em `Nota`, então não há escrita sem autor humano.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhum fluxo de saída de IA para o aluno mudou. A exceção do Tutor (D47) não passou para outro agente.
Supervisão do tutor: ok. O diff não mexe em sala ao vivo, no registro em casa nem no resumo. O caso novo do Tutor que é atendido pela reserva agora confirma que a linha de consumo não guarda `entrada` nem `saida` (`packages/core/src/ia/llm-gateway.test.ts:2838-2839`). Nada de inferência emocional nem de medição de navegação.
Autonomia declarada e visível: sim. O diff não mexe em `governanca` nem no nível dos agentes.

**Conferência da minha recomendação da 1ª rodada (item 8 da ordem r1):** foi feita. O caso novo está em `packages/core/src/ia/llm-gateway.test.ts:2763`, com o título "a D62 da reserva vale nos três caminhos". Ele roda dois ramos novos: o principal sem vaga e o 429 que sobra. Em cada um testa duas situações da reserva, sem a conferência da D62 (`undefined`) e com ela negada (`{ conferida: false }`). Nos dois ramos, o Tutor aprovado não chega à reserva (`reserva.chamadas` igual a 0), e o balde dela nem é consultado (`daReservaLimite.pedidos` igual a `[]`). O ramo da queda já estava coberto pelo caso da 4.0. Assim a D62 fica provada por teste nos três caminhos, e não só pela estrutura do código. Rodei os sete casos novos ou alterados do arquivo pela raiz do repositório e todos passaram. A limpeza do relógio falso está coberta pelo `afterEach` em `:2562`.

As outras mudanças do diff não tocam a regra 70:
- os textos de `errors.ts`, `cenarios.md`, `techspec.md`, do alerta e do runbook;
- o novo nome `reservaOuFimSemVaga` (`llm-gateway.ts:215,225`) e o bloco de mutação dele;
- a asserção de `motivo: 'sem_vaga'` em `prazo-com-tokens.int.test.ts:253`;
- as duas linhas novas em `TODO.md`.

Bloqueantes: nenhum

Recomendações:
- O título do caso em `llm-gateway.test.ts:2763` promete "três caminhos", mas o corpo cobre dois. O terceiro, a queda, está no caso da 4.0. Vale dizer isso no título, por exemplo "nos dois caminhos novos (o da queda está no caso da 4.0)", ou apontar para o caso da queda, para quem lê o teste sozinho.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-22 20:04:34 · `tasks/prd-reserva-e-avaliacao/7_task.md`

VEREDITO: APROVADO
Caminho quente tocado: IA
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok (a rodada não tem query nova)
Degradação de IA: ok
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- O título do caso novo em `packages/core/src/ia/llm-gateway.test.ts` fala em "a D62 da reserva vale nos três caminhos", mas o laço só percorre dois: sem vaga e 429. O terceiro, a queda, está em outro caso. Vale ajustar o título ou citar o caso da queda, para que quem lê não tome dois caminhos por três.

Conferência da rodada: os 13 itens da ordem `.processo/ordens/7_task-r1.md` estão no diff.
- **Texto, itens 1 a 3, 6 e 7:** entraram no `cenarios.md`, na `techspec.md` §5, no `errors.ts`, na `description` do alerta e no runbook (degrau dobrado e `sem_vaga` depois de chamar a reserva). Código, runbook e alerta agora descrevem a mesma degradação.
- **Rename, item 5:** `reservaOuFimSemVaga` substituiu o nome antigo, e não sobrou nenhuma ocorrência de `reservaPorFaltaDeVaga` em `packages`, `apps` nem na `7_task.md`.
- **Testes, itens 4 e 8 a 13:** todos entraram, e o bloco de mutação novo cobre a devolução da vaga da reserva (item 9).
- **TODO.md:** as duas recomendações minhas que ficaram sem aplicar estão lá. O cenário de carga foi destinado à 9.0.
- **Comportamento:** a rodada não muda nenhuma regra de execução, e o caminho quente fica como na 1ª rodada aprovada. Nenhum teste chama provedor pago: são roteirizados e com limitador falso.
- **Execução:** `npx vitest run packages/core/src/ia/llm-gateway.test.ts`, rodado da raiz, passou 208 de 208. Rodado de dentro de `packages/core` ele não sobe, porque não resolve `@educa/shared`. O `prazo-com-tokens.int.test.ts`, onde entrou o `motivo: 'sem_vaga'`, eu não rodei.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-22 20:04:46 · `tasks/prd-reserva-e-avaliacao/7_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

As 13 correções da ordem `.processo/ordens/7_task-r1.md` foram aplicadas. As cinco que eu pedi na rodada anterior:
- `cenarios.md:49` traz agora "uma tentativa só, sem a espera de 8 s", com a mutação "esperar no balde da reserva". A citação da divergência na `7_task.md` aponta para essa linha.
- O parágrafo da `techspec.md` §5 tem a ressalva "e sem reserva elegível", e o `sem_vaga` depois da reserva passou a ser o da 7.0.
- O comentário do `limite` em `errors.ts:39` cita a reserva.
- O caso do prazo afirma `motivo: 'sem_vaga'`, porque o `acompanhar` passou a expor o motivo.
- O nome `reservaOuFimSemVaga` está no código e nas linhas de contexto das mutações. Não sobrou nenhum `reservaPorFaltaDeVaga`.

As dos outros revisores também foram feitas:
- O alerta de 80 % e o runbook falam da reserva, avisam dos dois degraus no mesmo pedido e do `sem_vaga` que vem depois de uma chamada à reserva já feita.
- Há quatro casos novos de teste: a D62 nos ramos de falta de vaga e de 429, a devolução da vaga da reserva, a repetição da reserva sem vaga e o 4xx com o menor e a reserva juntos. Os quatro estão na tabela de testes da tarefa.
- O caso do 429 do Tutor agora mede o degrau e o `tenteDeNovoEmSegundos`, e o caso do Tutor no `rapido` afirma que a linha não tem `entrada` nem `saida`.
- A mutação nova do `devolverAVaga` tem contexto que existe no código, em `llm-gateway.ts:620-621`.
- A tabela "Sem aplicar" foi copiada para a `7_task.md`, e os dois itens que iam para o `TODO.md` estão lá.

Entre o commit `804eafec` e a árvore atual só mudaram as linhas de revisão escritas pelo hook.

Recomendações:
- O comentário em `packages/core/src/ia/llm-gateway.ts:620` diz "A vaga do principal que caiu sem sair volta ao balde". A mesma linha agora devolve também a vaga da reserva, e o caso novo da rodada prova isso. Trocar "do principal" por "do destino" ou "da chamada", e acertar o mesmo texto nas linhas de contexto das mutações em `7_task.md:318` e `7_task.md:375`.
- O título do caso da D62, "vale nos três caminhos", testa só dois: a falta de vaga e o 429. O terceiro, a queda, está no caso antigo. Um título que diga isso evita que alguém procure três ramos ali.

## test-engineer · 2ª rodada · APROVADO · 2026-11-22 20:05:40 · `tasks/prd-reserva-e-avaliacao/7_task.md`

VEREDITO: APROVADO

**Cenários exigidos (rodada 2, só o diff desde a 1ª e o que ele afeta):** os casos novos das recomendações 8 a 13 da ordem `7_task-r1.md`, a asserção do `motivo` no caso do prazo (rec. 4), a mutação 37, a troca do nome para `reservaOuFimSemVaga` nas linhas de contexto das Mutações, e as quatro linhas novas da tabela de testes.

**Cobertos:**
- **D62 nos ramos novos (rec. 8).** O caso "a D62 da reserva vale nos três caminhos…" roda o principal sem vaga e o 429 que sobra. Cada um é rodado com a soberania da reserva ausente e com `conferida: false`. Afirma o `motivo` certo, `reserva.chamadas` igual a 0 e o balde da reserva nunca consultado (`pedidos == []`). O controle positivo existe nos dois ramos: "Tutor aprovado no `rapido` da reserva, sem vaga no principal" e "o 429 do Tutor com o balde da reserva também cheio", ambos com `CONFERIDA`.
- **Devolução da vaga da reserva que cai sem sair (rec. 9 e mutação 37).** O caso afirma `acertosPorModelo[DA_RESERVA]` igual a `[0]`. A mutação condiciona `devolverAVaga` a `!alvo.peloProvedorDeReserva`, e com ela o caso fica vermelho pelo motivo certo, porque não haveria acerto nenhum. A linha de contexto (`llm-gateway.ts:620-621`) confere com o código.
- **429 do Tutor com o balde da reserva cheio (rec. 10).** O caso agora afirma `tenteDeNovoEmSegundos: 3`, vindo do balde da reserva e não do principal, o degrau `indisponivel` contado exatamente 1 vez, e o balde da reserva consultado em `DA_RESERVA_RAPIDO`.
- **Repetição da própria reserva sem vaga (rec. 11).** O caso afirma `sem_vaga`, a espera de 2 s, uma chamada à reserva, dois pedidos ao balde dela e só a linha `[RESERVA, true, 'falhou']`. O dublê que fecha o balde na segunda reserva é o nosso `LimiteDeMentira`, não um mock que esconde a regra.
- **4xx rejeitado com o menor e a reserva juntos (rec. 12).** O caso afirma `motivo: 'rejeitada'`, o menor nunca pedido (`limite.modelosPedidos == [DO_PRINCIPAL]`), a reserva com 0 chamadas e o balde dela sem pedido nenhum. Está no formato que o `cenarios.md` §1 RF3 escreve.
- **Entrada e saída nulas na linha do Tutor pelo sem vaga (rec. 13).** Usa `not.toHaveProperty('entrada'/'saida')`, no mesmo padrão já provado pelo controle positivo da geração (`llm-gateway.test.ts:381-391`).
- **Prazo com o balde da reserva fechado (rec. 4).** Afirma `motivo: 'sem_vaga'` com `fimEm` igual a 20_000, o que também prova a divergência "a reserva não espera", agora escrita na linha 49 do `cenarios.md`.
- **Tabela de testes.** As quatro linhas novas citam cada uma o seu teste pelo nome, e os quatro nomes existem. O nome antigo (`reservaPorFaltaDeVaga`) não sobra em lugar nenhum do código nem dos blocos.
- **Testes rodados aqui.** `llm-gateway.test.ts` passou com 208 de 208 e `prazo-com-tokens.int.test.ts` com 10 de 10. Não há `.skip`, nenhum provedor pago é chamado e o relógio falso é restaurado no `afterEach` (`llm-gateway.test.ts:2562`).
- **Cláusula sem bloco.** O diff não traz cláusula nova de código: o `llm-gateway.ts` mudou só no nome e o `errors.ts` só no comentário. Nenhum bloco falta.

**Bloqueantes:** nenhum.

**Recomendações:**
1. O título "a D62 da reserva vale nos três caminhos" (`packages/core/src/ia/llm-gateway.test.ts:2763`) promete três caminhos, mas o caso cobre dois. O terceiro, a queda, está no caso antigo. Vale dizer isso no título ou rodar a queda no mesmo laço.
2. O comentário em `packages/core/src/ia/llm-gateway.ts:620` diz "A vaga do principal que caiu sem sair volta ao balde". Agora a vaga também é a da reserva, e a mutação 37 prova isso. Se trocar o texto, troque junto a linha de contexto do bloco 37.
3. A repetição da reserva sem vaga só está provada na fila `ferramenta`. Um caso na fila `lote` mostraria que a linha da primeira chamada à reserva fica gravada mesmo quando o `sem_vaga` adia o job: é o `gasto.chamadas.length > 0` em `llm-gateway.ts:374`. Hoje ninguém prova isso nesse caminho novo.
