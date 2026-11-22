# Achados das revisões — `tasks/prd-reserva-e-avaliacao/3_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-22 14:42:24 · `tasks/prd-reserva-e-avaliacao/3_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nem migration nesta tarefa. A linha de `consumo_ia` passa pelo mesmo `chamadaSemUso`, que não mudou. Só o comentário do tipo em `packages/core/src/ia/consumo.ts:53-59` foi alterado, e o escopo da linha continua vindo da execução, não de parâmetro.

Queries verificadas: nenhuma query, repository ou endpoint novo. O que a tarefa altera:
- `errors.ts`: `MotivoDaIndisponibilidade` ganha `limite` e `rejeitada`. `semEnvio` continua valendo só para `sem_vaga` e `disjuntor`.
- `resilient-adapter.ts:82-97`: `motivoDaFalha` e `traduzir`.
- `llm-gateway.ts:404-430`: `chamarComDegrau`.
- `llm-gateway.ts:513-546`: `reservarOMenor` e `descerPorLimite`.

O balde é por `provedor:modelo` (`chaveDoBalde`, que não mudou). É um recurso de capacidade e não guarda dado de escola. O `LLMError` continua sem texto livre: o motivo é um enum fixo e não revela existência de dado de outra escola.

Teste de isolamento: não se aplica. A tarefa não cria módulo, tabela, repository nem endpoint, então não há escopo novo a provar.

Bloqueantes: nenhum.

Recomendações:
- `apps/api/src/ia/execucao.processor.ts:333-334`: `adiavelNoLote` lê `erro.motivo` e adia qualquer `IA_INDISPONIVEL` que não seja `soberania`. Com isso, a `rejeitada` (401 ou 403 do provedor) volta a ser reenfileirada no lote, o que contradiz o "termina sem degrau" da tarefa. Não é vazamento entre escolas e o comportamento já existia antes da tarefa, mas a subtarefa 3.1 pedia conferir cada leitor de `motivo`. Fica para o `llm-integrator` e o `infra-guardian` decidirem se a `rejeitada` entra na exclusão junto com a `soberania`.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-22 14:42:40 · `tasks/prd-reserva-e-avaliacao/3_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. O diff só mexe na camada de IA (`errors.ts`, `resilient-adapter.ts`, `llm-gateway.ts`, `consumo.ts`), sem schema, repository, job ou seed que grave `Nota`. Todos com autor humano? sim, porque nenhum caminho de escrita foi criado ou alterado.

Decisão autônoma sobre aluno: ausente. A mudança decide só para onde vai a chamada ao modelo depois de um 429 ou de um 4xx: ao modelo menor ou a `IA_INDISPONIVEL`. Nada sobre aprovação, reprovação ou encaminhamento de aluno.

Aprovação registrada: ok. A resposta que vem do modelo menor segue o mesmo caminho da do modelo principal, com a entrega nascendo pendente, e a tarefa não abre atalho. O `gasto.modelo = menor.modelo` (`packages/core/src/ia/llm-gateway.ts:378` no diff) grava o modelo que gerou de fato. Assim a auditoria (item 6) diz qual modelo produziu a saída, e não o do perfil.

Supervisão do tutor: ok. Com o `limite`, o Tutor e a classificação não descem ao modelo menor (`TAREFAS_SEM_MODELO_MENOR`, `llm-gateway.ts:70`; `modeloMenorDaTarefa`, `llm-gateway.ts:516`). O teste `packages/core/src/ia/llm-gateway.test.ts:1971` prova isso com `modelosMenores` configurado para o `rapido`. A exceção da D47 continua só no Tutor, e a tarefa não a estende a outro agente. O Tutor termina em `IA_INDISPONIVEL`, sem erro cru.

Autonomia declarada e visível: sim, sem alteração. A tarefa não mexe em nível de agente nem na tela da governança.

Itens 7, 8 e 9: nada novo. Não há inferência emocional, nem medição de navegação, nem campo, prompt ou tela que sugira nota em discursiva ou redação (D55), nem métrica de professor. O que muda na linha de consumo ajuda a auditoria e o compartilhamento: o 429 que sobra e o 4xx rejeitado agora gravam a estimativa e o provedor (`consumo.ts`, comentário novo; `llm-gateway.ts:451`). Com isso, a lista de para onde o pedido foi também conta a chamada que chegou ao provedor e voltou recusada.

Rodei os dois arquivos de teste (`resilient-adapter.test.ts` e `llm-gateway.test.ts`): 191 casos, todos passaram.

Bloqueantes: nenhum.

Recomendações:
- `apps/api/src/ia/execucao.processor.ts:334` lê `erro.motivo !== 'soberania'`, então um job do lote que termina em `rejeitada` (401 ou 403, que são definitivos) é adiado e tentado de novo. Isso já acontecia antes, quando o motivo vinha vazio, e não é regra 70. Fica para o `infra-guardian` e o `llm-integrator` decidirem se `rejeitada` deve terminar `falhou` como `soberania`, provavelmente junto da 4.0.
- Na AIA do Tutor (D60), no procedimento de degradação, vale registrar em uma linha que o 429 do provedor nunca leva o Tutor a um modelo menor (D36), agora que há dois caminhos até o menor: o balde cheio e o `limite`.

## llm-integrator · 1ª rodada · APROVADO · 2026-11-22 14:42:49 · `tasks/prd-reserva-e-avaliacao/3_task.md`

VEREDITO: APROVADO
Perfis usados: nenhum novo. A tarefa não cria chamada de modelo. O `limite` reaproveita o modelo menor que o perfil já tem em `modelosMenores`. O Tutor e a classificação não descem (D36).
Custo estimado por professor/mês: sem chamada nova por uso normal, então o custo base não muda.
- **429 que sobra:** passa a fazer no máximo uma chamada extra, ao modelo menor, que é mais barato que o principal. Só acontece quando o provedor já recusou duas vezes. Antes, essa tarefa terminava com erro.
- **Linhas estimadas:** a linha de 429 e a de conexão recusada gravam a estimativa da D14, com a entrada contada e a saída no teto. O custo registrado é um limite superior, e nenhuma chamada nova é cobrada por elas.
- **Cota de 429:** não consegui estimar quantas chamadas por professor por mês terminam em 429. Isso depende da cota do provedor, que ainda não foi medida. A precificação precisa dessa taxa de 429 medida na subida.
Prompt versionado: não se aplica (nenhum prompt novo ou alterado)
Validação de schema: não se aplica (o caminho de saída inválida não mudou)
Aprovação humana no caminho: não se aplica (mudança só na resiliência e no roteamento do gateway)

Bloqueantes: nenhum.

Conferi o diff de `errors.ts`, `resilient-adapter.ts`, `llm-gateway.ts` e `consumo.ts`, e rodei `npx vitest run --project unidade` nos dois arquivos de teste de `packages/core/src/ia/`: 191 testes passaram. O que verifiquei:
- **Adaptadores:** nenhum SDK de provedor foi tocado fora de `*-adapter.ts`, e os testes usam o servidor falso, sem provedor pago.
- **Motivos:** `limite` e `rejeitada` ficam fora de `semEnvio` (`errors.ts:62-64`). A linha estimada do 429 e da conexão recusada continua gravada, e o `traduzir` preserva só esses dois motivos (`resilient-adapter.ts:83-85`).
- **Degrau do menor:** o `limite` desce ao menor só com `vaga.modelo === undefined` (`llm-gateway.ts:423`), e o Tutor e a classificação ficam de fora (D36). A reserva do menor é a acertada, e `gasto.modelo` é atualizado antes da chamada, então a falha do menor leva a linha com o modelo certo.
- **Leitores de `motivo` e `semEnvio`:** o único leitor fora do core é `adiavelNoLote`, em `apps/api/src/ia/execucao.processor.ts:334`. Ele só exclui `soberania`, então o `limite` continua adiável no lote, como antes, com linha de consumo.
- **Testes:** os casos citados na tabela existem, em `llm-gateway.test.ts` (linhas 1833 a 2013) e em `resilient-adapter.test.ts` (linhas 546 e 557). Cada cláusula nova tem bloco de mutação.
- **Log, orçamento e registro:** o diff não adiciona log nem campo pessoal. O custo estimado respeita a D14, e as linhas de consumo seguem registradas.

Recomendações:
1. **`apps/api/src/ia/execucao.processor.ts:334`:** `adiavelNoLote` trata `rejeitada` (401, 403, chave errada) como "provedor fora" e adia o lote sem tentativa. Isso já era assim e a techspec diz "termina como hoje", então não bloqueia. Mas o novo motivo diz que esperar não muda a resposta, e a chave inválida pode ficar adiando e gravando uma linha estimada por rodada. Vale um destino no TODO.md ou na 4.0, excluindo `rejeitada` do adiamento ou limitando as rodadas.
2. **`llm-gateway.ts` (`chamarComDegrau`):** a reserva do principal, já concedida, não é devolvida nem acertada quando o `limite` desce ao menor. O balde fica cobrado pela estimativa até o minuto virar. O padrão é o mesmo da falha comum, mas aqui acontece justamente com o provedor saturado. Vale registrar.
3. **Estimativa por professor:** anexar na validação a taxa de 429 medida na subida (provedor e cota) para a precificação deixar de ser chute.

Arquivos principais:
- `packages/core/src/ia/errors.ts`
- `packages/core/src/ia/resilient-adapter.ts`
- `packages/core/src/ia/llm-gateway.ts`
- `packages/core/src/ia/consumo.ts`
- `apps/api/src/ia/execucao.processor.ts`

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-22 14:42:50 · `tasks/prd-reserva-e-avaliacao/3_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A tarefa não cria campo, tabela nem migration. Só muda como a camada de IA classifica a falha (`MotivoDaIndisponibilidade` ganha `limite` e `rejeitada`), a descida para o modelo menor e o comentário do tipo `ConsumoDeIa`.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: não se aplica. Não há rota, repository nem query nova. O `LLMError` continua sem texto livre: o motivo é um valor de lista fechada, e o corpo da resposta do provedor, que pode repetir o prompt, não passa do `ProviderError` (`packages/core/src/ia/resilient-adapter.ts:93-94`).

Logs: limpos. O único log novo é o do degrau, `ia.geracao.sem_vaga`, que sai de `descerPorLimite` (`packages/core/src/ia/llm-gateway.ts:544`) pelo `descer` (`:558-561`). Ele leva só a tarefa, o modelo e o código, sem escola, execução, entrada ou prompt.

Auditoria: não se aplica. A tarefa não tem leitura de dado de aluno por coordenação ou rede, exportação, nota, permissão nem aprovação.

Envio externo:
- **O que vai e para onde:** a entrada que a tarefa já montava. O modelo menor é chamado pelo mesmo adaptador, então vai para o mesmo provedor e passa pela mesma conferência da D62 (`exigirSoberania`, `llm-gateway.ts:273`, antes de qualquer chamada).
- **Tutor e classificação:** continuam sem descer para o modelo menor (D36), e há teste em `llm-gateway.test.ts`.
- **Está registrado:** sim. Toda chamada que saiu deixa uma linha em `consumo_ia` com `envioExterno`, `provedorId`, a estimativa (D14) e o `execucaoId`. Isso vale para a do principal que voltou com 429, a da conexão recusada, a da `rejeitada` e a do modelo menor. O `limite` e a `rejeitada` ficam fora de `semEnvio` (`packages/core/src/ia/errors.ts:62-63`), então a linha delas não é apagada. Os casos pelo servidor falso provam isso.
- **Pergunta de fechamento:** a linha de consumo com o provedor continua respondendo para onde o pedido foi, agora também no 429 e no 4xx. A regra fica mais firme, não mais fraca.

Seed/fixture: sintético. As entradas de teste (`entradaDeAtividade`, a da classificação, o corpo "chave revogada" do servidor falso) não têm dado de pessoa.

Rodei os dois arquivos de teste da tarefa, `resilient-adapter.test.ts` e `llm-gateway.test.ts`, e os 191 casos passaram.

Bloqueantes: nenhum.

Recomendações:
- `apps/api/src/ia/execucao.processor.ts:334`: o `adiavelNoLote` adia todo `IA_INDISPONIVEL` que não seja `soberania`. Com isso, uma `rejeitada` (401 ou 403) no lote é reenfileirada e manda a mesma entrada de novo ao provedor que recusou. O destino é o mesmo, então não vaza nada, e esse comportamento já existia antes da tarefa. Mas reenviar conteúdo a quem rejeitou contradiz o "termina sem degrau" e o princípio do envio mínimo. Sugiro tirar a `rejeitada` dos casos adiáveis, junto com a `soberania`, na 4.0 ou numa linha do `TODO.md`. O `tenancy-guardian` já apontou o mesmo item.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-22 14:43:20 · `tasks/prd-reserva-e-avaliacao/3_task.md`

VEREDITO: APROVADO
Caminho quente tocado: IA
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok (a tarefa não tem query nova)
Degradação de IA: ok
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum

Recomendações:
- **401 ou 403 no lote, em `apps/api/src/ia/execucao.processor.ts:334`.** A subtarefa 3.1 manda conferir quem lê `motivo`, e o `adiavelNoLote` não trata `rejeitada`: só a `soberania` termina a execução. Com uma chave revogada, todo job de lote é adiado a cada 30 s sem gastar tentativa. A `rejeitada` também não abre o disjuntor. Cada volta grava uma linha `falhou` com custo estimado acima de zero, cobrada no orçamento da escola. Esse comportamento já existia antes desta tarefa, e a techspec §5 diz que a `rejeitada` "termina como hoje", por isso não bloqueia. Mas agora o motivo existe, e o próprio comentário de `errors.ts` diz que esperar não muda nada. Sugiro acrescentar `erro.motivo !== 'rejeitada'` ao `adiavelNoLote`, com teste, na 4.0 ou numa linha do `TODO.md`.
- **Contagem do degrau quando o menor falha, em `packages/core/src/ia/llm-gateway.ts:423-428`.** Quando o menor recebe a vaga e depois também devolve `limite`, `ia.degradacao{degrau}` conta `modelo_menor` e nunca `indisponivel`. O resultado final é indisponível, e o painel não mostra isso. O mesmo acontece no degrau do balde cheio, que é anterior a esta tarefa.
- **Nome do log, em `llm-gateway.ts:545`.** No ramo do `limite`, o `descerPorLimite` grava o evento `ia.geracao.sem_vaga`, mas o erro que sobe tem motivo `limite`. Quem lê o log confunde o 429 do provedor com o balde nosso cheio. Um evento próprio, ou o motivo dentro do evento, resolve. Isso é parente da linha da 4.0 sobre um contador por motivo.
- **Texto do `TODO.md:4382`.** Falta pontuação entre "ao abrir a F5b" e "Fechado pela reserva-e-avaliacao".

Rodei `npx vitest run --project unidade` nos dois arquivos de teste da tarefa: 191 de 191 passaram. Nenhum teste chama provedor pago (usam o adaptador roteirizado e o servidor falso). As duas reservas acertadas ficam separadas, e só a do menor é acertada (`acertosPorModelo`). O Tutor e a classificação não descem ao menor (D36).

## revisor-geral · 1ª rodada · APROVADO · 2026-11-22 14:43:21 · `tasks/prd-reserva-e-avaliacao/3_task.md`

**VEREDITO: APROVADO**

**Escopo:** respeitado. As subtarefas 3.1 a 3.4 foram feitas e a linha do `TODO.md` está fechada. Nada da reserva (4.0 e 7.0) nem do contador por destino (6.0) entrou.

**Aderência à Tech Spec:** ok. As duas divergências estão na tarefa, na `techspec.md` §5 ("A causa da falha") e no `cenarios.md` §1 RF3. São elas: o `limite` sem menor termina com o motivo `limite`, e não `sem_vaga`; e o menor entra sem a espera de 8 s, na mesma tentativa.

**Portão local:** carimbo válido para o código atual, com typecheck, lint, segredo, dependencias, unidade e alvo.

**Bloqueantes:** nenhum.

**Recomendações:**

1. **Para a 6.0, em `packages/core/src/ia/llm-gateway.ts:374-401`.** Como o menor entra na mesma tentativa, uma tentativa agora faz até duas chamadas ao destino principal. Se o menor devolver saída inválida, a segunda volta do `chamarAteValer` reserva o principal de novo, recebe outro 429 e desce outra vez. Isso dá até quatro chamadas no destino principal, contra as "duas por destino" da `techspec.md` §5. O contador por destino é da 6.0, então hoje não bloqueia. A 6.0 precisa contar a chamada ao menor no contador do principal e ter um caso para isso: 429 no principal, menor inválido, e a segunda tentativa.

2. **Em `llm-gateway.ts:542`, o modelo no aviso de `indisponivel`.** No `descerPorLimite`, o `descer('indisponivel', …)` usa sempre o modelo do principal. No caminho do balde cheio (`llm-gateway.ts:508`) ele usa `modeloMenorDaTarefa ?? principal`. O teste fixa isso de propósito, mas o mesmo degrau sai com modelos diferentes conforme a causa. Vale decidir qual dos dois fica e escrever o porquê.

3. **Em `llm-gateway.ts:423`, uma linha só faz quatro coisas.** São o ternário, o `instanceof`, as duas condições e o `await`. Separar a condição numa variável com nome (por exemplo, `desceAoMenor`) deixa a regra legível.

4. **Em `apps/api/src/ia/execucao.processor.ts:334`, a `rejeitada` no lote.** O `adiavelNoLote` continua adiando qualquer `IA_INDISPONIVEL` que não seja `soberania`, e isso inclui a `rejeitada`. Na prática, um 401 de chave revogada fica adiando o job. O comportamento é anterior à tarefa e a techspec diz "termina como hoje", então não bloqueia. Mas `errors.ts:40` agora afirma que "esperar não muda" para a `rejeitada`, e o lote faz o contrário. Proponho registrar no `TODO.md`, com o Arquiteto como dono, a decisão de a `rejeitada` no lote passar a `falhou` em vez de adiar.

Arquivos lidos:
- tasks/prd-reserva-e-avaliacao/3_task.md
- packages/core/src/ia/llm-gateway.ts
- packages/core/src/ia/resilient-adapter.ts
- packages/core/src/ia/errors.ts
- apps/api/src/ia/execucao.processor.ts

## test-engineer · 1ª rodada · APROVADO · 2026-11-22 14:43:45 · `tasks/prd-reserva-e-avaliacao/3_task.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:** o 429 que sobra da repetição, com e sem `Retry-After`, chega ao gateway como `limite`. Com menor disponível, desce ao menor e grava, nesta ordem, a linha estimada do principal (envio externo e provedor) e a linha real do menor.
- **Bordas:**
  - tarefa sem menor no perfil;
  - menor com o balde cheio;
  - menor que também responde 429;
  - menor que já era o modelo da chamada, depois de o principal esperar 8 s;
  - sem limitador configurado (o `local`);
  - pedido sem fila (cai na `normal`);
  - 401 e 403 viram `rejeitada`, sem degrau;
  - 500, conexão recusada e prazo seguem sem motivo.
- **Permissão (D36):** o Tutor e a classificação, mesmo com `modelosMenores` configurado para o `rapido`, não descem ao menor.
- **D14:** a linha do 429 e a da conexão recusada levam entrada contada, saída no teto, custo maior que zero e o provedor, passando pelo `ResilientAdapter` com o servidor falso.
- **Regressão:** o degrau 3 sem reserva continua igual.
- **Isolamento:** não se aplica, a tarefa não tem repository.
- **Concorrência:** não se aplica, porque não há estado novo compartilhado. A repetição é a do `cockatiel`, que já tem teste.

**Cobertos:** as 8 linhas da tabela "Testes que provam a regra". Cada caso citado existe com o nome dado em `packages/core/src/ia/resilient-adapter.test.ts` e em `packages/core/src/ia/llm-gateway.test.ts`, inclusive os itens juntados por ponto e vírgula. `npx vitest run --project unidade` nos dois arquivos: 191 testes passando.

Conferi os blocos de mutação contra o `git diff`. As cláusulas novas têm bloco: o `motivoDaFalha`, o `traduzir`, o `semEnvio` com `limite` e com `rejeitada`, os termos do `catch` do degrau, `throw erro`, `gasto.modelo = menor.modelo`, `reserva: menor.reserva`, `reservarOMenor`, `descerPorLimite`, `?? 'normal'`, `?? principal`, `modeloMenorDaTarefa` e `estimativaDoPedido`. Cada bloco cai num cenário que chega à cláusula:
- **A armadilha `limite` em `semEnvio`:** a linha do principal some da lista de consumo, e o teste fica vermelho.
- **`acertosPorModelo`:** prova que o acerto foi feito na reserva do menor, e não na do principal.
- **`modelosPedidos` do adaptador e do balde:** provam que o Tutor, a classificação e a `rejeitada` não descem.

As asserções olham o resultado (motivo, `semEnvio`, linhas, custo, baldes pedidos, métrica `ia.degradacao`). Não há `.skip`. Todos os testes usam adaptador roteirizado ou o servidor falso local, nunca provedor pago.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Sinal da chamada ao menor sem teste.** Em `packages/core/src/ia/llm-gateway.ts:427`, a chamada ao menor passa o `sinal` de quem chamou, mas nenhum teste o confere nesse caminho. O caso "o sinal de quem chamou…" só passa pelo principal. Trocar o `sinal` só da chamada ao menor por um novo não deixaria nada vermelho, e o prazo único do executor não cancelaria o menor. Sugestão: um caso que aborte o sinal enquanto o menor está em curso.
2. **Duração da chamada do menor sem teste.** O `inicioDaChamada: inicioDoMenor` no retorno de `chamarComDegrau` não tem caso. Se fosse trocado pelo início do principal, a duração da chamada do menor incluiria o 429 do principal sem que nada ficasse vermelho.
3. **Modelo diferente no log, conforme o caminho.** Em `llm-gateway.ts:518`, `descerPorLimite` registra o degrau `indisponivel` com o modelo do principal mesmo quando o menor existia e estava cheio. O `reservarVaga`, no mesmo caso, registra o do menor (`modeloMenorDaTarefa(pedido) ?? principal`). Convém escolher um só critério.
4. **Nome do evento de log.** O fim por `limite` registra `ia.geracao.sem_vaga` (`llm-gateway.ts:560`), mas a Divergência da tarefa diz que o término é `limite`, não `sem_vaga`. Quem consultar o log pelo runbook vai confundir os dois. Sugestão: um evento próprio, ou o motivo no registro.
5. **`rejeitada` no lote é adiada sem fim.** `apps/api/src/ia/execucao.processor.ts:334` (`adiavelNoLote`) adia todo `IA_INDISPONIVEL` que não seja `soberania`, e isso inclui a `rejeitada`. O lote então repete um 401 indefinidamente, e cada repetição grava uma linha estimada com custo. Já era assim antes da tarefa, mas agora o `errors.ts` diz que, para a `rejeitada`, "esperar não muda". A subtarefa 3.1 pedia conferir cada leitor de `motivo`, e esse ficou sem registro de decisão. Destino sugerido: a 4.0, ou uma linha no `TODO.md`.
6. **Porta reaproveitada no teste de conexão recusada.** Os casos de conexão recusada (`resilient-adapter.test.ts`, no describe "pelo servidor falso", e `llm-gateway.test.ts`, no describe "o 429 que sobra e a conexão recusada") fecham o servidor falso e reusam a URL dele. Se outro worker abrir um servidor na mesma porta, o caso fica instável. Uma porta reservada e nunca aberta tiraria a dependência.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-22 15:04:09 · `tasks/prd-reserva-e-avaliacao/3_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta rodada. O diff mexe só no degrau do gateway de IA, em `packages/core/src/ia/llm-gateway.ts`, e no teste dele. Não toca `Nota`, `Correcao` nem nenhum caminho de escrita. Todos com autor humano? sim, nenhum caminho foi alterado.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. A descida ao modelo menor só troca o modelo que produz a saída. A entrega continua nascendo pendente pelo mesmo fluxo, e a exceção da D47 não aparece em nenhum outro agente.
Supervisão do tutor: ok. A rodada não toca o tutor.
Autonomia declarada e visível: sim. Os níveis de autonomia não foram tocados nesta rodada.

Bloqueantes: nenhum

O que auditei nesta 2ª rodada (diff de `f6f4e86f` a `525e4e3b`):
- **`packages/core/src/ia/llm-gateway.ts:423-425`**: só reorganiza o código, sem mudar o comportamento. A condição foi para uma constante com nome (`desceAoMenor`), e ganhou um comentário dizendo que só o 429 do principal desce, uma vez. A condição continua a mesma (`motivo === 'limite' && vaga.modelo === undefined`), e a exclusão do Tutor em `descerPorLimite` não foi tocada.
- **`packages/core/src/ia/llm-gateway.test.ts:1963-1998`**: dois casos novos, os dois com adaptador falso e sem chamar provedor pago.
  - O primeiro prova que o mesmo sinal de cancelamento chega à chamada do principal e à do menor.
  - O segundo prova que a linha de consumo do menor mede só a duração da chamada dele.

  Os dois falam do sinal e da medição de consumo, que são assunto das regras 30 e 80. Não há impacto na regra 70.
- **`TODO.md`**: só recebeu as recomendações da 1ª rodada, cada uma com dono. A minha é a linha da AIA do Tutor: o 429 do provedor nunca leva o Tutor a um modelo menor (D36). Ela está registrada, com destino na 14.5.
- A 1ª rodada não deixou correção exigida, então não havia correção a conferir.

Itens 7, 8 e 9: o diff não traz inferência emocional, campo de nota em discursiva ou redação, nem métrica de professor.

Recomendações: nenhuma nova. A da 1ª rodada, a linha sobre a degradação na AIA do Tutor em `docs/aia/tutor.md`, segue aberta no `TODO.md` para a 14.5.

## llm-integrator · 2ª rodada · APROVADO · 2026-11-22 15:04:25 · `tasks/prd-reserva-e-avaliacao/3_task.md`

VEREDITO: APROVADO

Perfis usados: nenhum perfil novo nesta rodada. O diff é uma refatoração de legibilidade em `chamarComDegrau` e dois testes. O degrau do 429 continua descendo ao modelo menor do mesmo perfil. `descerPorLimite` mantém a exclusão do Tutor e da classificação (D36).

Custo estimado por professor/mês: não se aplica a esta rodada. Ela não adiciona chamada de modelo. Pelo diff, o único custo novo é a segunda chamada ao modelo menor quando o principal devolve 429, que já vinha da rodada aprovada e é mais barata que o principal.

Prompt versionado: não se aplica (nenhum prompt alterado).

Validação de schema: não se aplica a esta rodada. O caminho de interpretação e reparo não foi tocado.

Aprovação humana no caminho: não se aplica. Não há entrega nem nota nesta rodada.

Bloqueantes: nenhum.

Conferi o diff desde a rodada aprovada e o que ele afeta:
- **`packages/core/src/ia/llm-gateway.ts:424-425`:** a condição é a mesma de antes, apenas extraída para `desceAoMenor`. O comportamento não muda: só o `limite` na chamada ao principal desce, e o menor que também recusa termina sem descer de novo.
- **`packages/core/src/ia/llm-gateway.ts:430`:** `inicioDoMenor` é tomado depois de `descerPorLimite`, então a linha de consumo do menor mede só a chamada dele. O mesmo valor volta como `inicioDaChamada`, que `chamadaFeita` usa.
- **`packages/core/src/ia/llm-gateway.test.ts:1963`:** o teste prova que o `controle.signal` de quem chamou chega aos dois adaptadores (principal e menor). Se o menor recebesse um sinal novo, ele falharia.
- **`packages/core/src/ia/llm-gateway.test.ts:1980`:** o teste prova que a duração do menor é a da chamada dele. Com `performance.now` mockado (principal 500 ms, menor 7 ms), as linhas de consumo esperadas são `[['roteirizado-padrao', 500], ['menor-padrao', 7]]`. Se `inicioDoMenor` voltasse a ser o `inicioDaChamada` do principal, daria 507 e o teste quebraria. O `mockRestore` está num `finally`.
- **Execução:** rodei `llm-gateway.test.ts -t "menor"` e os 28 casos passaram.
- **Regras 30 e 80:** os testes usam `ScriptedAdapter` e `LimiteDeMentira`, sem provedor pago (regra 30, item 3). A linha de consumo do menor continua gravando modelo, duração e tokens (regra 30, item 4). O log do degrau segue sem escola, execução nem pedido (regra 20, item 9).

Recomendações:
- O primeiro teste novo usa `LLMError('IA_INDISPONIVEL', 90, 'limite')` direto no `ScriptedAdapter`, sem passar pelo `ResilientAdapter`. Está certo para o que ele prova (propagação do sinal), mas o caminho completo com o 429 real fica coberto só pelos outros casos do mesmo bloco. Não é necessário agir.
- Nenhuma outra. Não houve correção exigida na rodada anterior.

Arquivo auditado: `packages/core/src/ia/llm-gateway.ts` e o teste `llm-gateway.test.ts` ao lado dele.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-22 15:04:33 · `tasks/prd-reserva-e-avaliacao/3_task.md`

VEREDITO: APROVADO

Caminho quente tocado: IA

Rate limit: ok

Fila e prioridade: ok

Concorrência: protegida

Índice e paginação: ok

Degradação de IA: ok

Migration: não se aplica

Métrica e alerta: ok

Bloqueantes: nenhum.

Recomendações: nenhuma nova. As da 1ª rodada continuam em "Recomendações sem aplicar" de `tasks/prd-reserva-e-avaliacao/3_task.md` e no `TODO.md`.

O que conferi nesta rodada:
- **Correções exigidas:** a 1ª rodada não exigiu nenhuma, então não havia correção a conferir.
- **Código:** em `packages/core/src/ia/llm-gateway.ts:423-425` a mudança só deu nome à condição (`desceAoMenor`) e acrescentou um comentário. O comportamento continua igual: só desce ao modelo menor quando o modelo principal recebe um 429 do provedor. Se o modelo menor também recusar, a chamada termina com `IA_INDISPONIVEL`, sem descer de novo e sem mandar erro cru ao aluno.
- **Os dois testes novos** em `packages/core/src/ia/llm-gateway.test.ts:1963-1998` usam adaptador falso, sem provedor pago.
  - O teste do sinal quebraria se a chamada ao modelo menor recebesse outro sinal. Ele garante que o prazo único da execução cancela as duas chamadas.
  - O teste da duração quebraria se a linha do modelo menor usasse `inicioDaChamada` em vez de `inicioDoMenor`: daria 507 ms em vez de 7 ms.
- **Execução:** rodei `npx vitest run` a partir da raiz nos testes `llm-gateway.test.ts` e `resilient-adapter.test.ts`, e os 193 passaram. Rodados de dentro de `packages/core`, falham por um problema do ambiente, não do código: o `@educa/shared` não está compilado neste worktree e o pacote não resolve.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-22 15:04:37 · `tasks/prd-reserva-e-avaliacao/3_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade e alvo valem para o código atual)
Bloqueantes: nenhum

Esta rodada conferiu só o que mudou desde a aprovação da 1ª. A rodada anterior não exigiu correção.

- **Código, `packages/core/src/ia/llm-gateway.ts:423-425`:** a condição foi só separada em `desceAoMenor`, e o comportamento continua o mesmo. O comentário diz uma coisa que o código sozinho não deixa ver: o menor que também recusa termina, sem descer de novo.
- **Testes, `packages/core/src/ia/llm-gateway.test.ts`:** os dois casos novos fecham a recomendação do `test-engineer` da 1ª rodada.
  - O primeiro confere que a chamada ao menor recebe o mesmo sinal da execução, a linha 429.
  - O segundo confere que a linha do menor conta a duração a partir da linha 428, e não desde o início da chamada ao principal.
  - O relógio do segundo é restaurado no `finally`.
- **Blocos de mutação em `tasks/prd-reserva-e-avaliacao/3_task.md`:** os dois blocos antigos passaram a apontar para a linha nova. Entraram três blocos, e cada um quebra um caso que existe. O contador ficou coerente: 24 blocos, 1 motivo.
- **Recomendações da 1ª rodada:** as nove estão na tabela "Recomendações sem aplicar" e no `TODO.md`. Cada uma tem dono numa tarefa futura (4.0, 6.0, 7.0 ou 14.5) ou no Arquiteto, com o motivo de não ter entrado na 3.0. Nenhuma foi implementada aqui, então não há invasão de tarefa futura.
- **`TODO.md`:** foi corrigida a linha da camada-ia que tinha ficado sem o ponto antes de "Fechado pela reserva-e-avaliacao".

Recomendações: nenhuma nova.

## test-engineer · 2ª rodada · APROVADO · 2026-11-22 15:05:00 · `tasks/prd-reserva-e-avaliacao/3_task.md`

VEREDITO: APROVADO

**Cenários exigidos:** os da 1ª rodada não mudaram: o 429 que sobra, com e sem `Retry-After`; 401 e 403 como `rejeitada`; 500 e conexão recusada sem motivo; o `limite` no principal descendo ao menor, com as linhas na ordem; D36 (o Tutor e a classificação não descem); a `rejeitada` não desce; a linha estimada com custo maior que zero; e a regressão da X6. Esta rodada acrescenta dois cenários: o prazo único da execução também vale na chamada ao menor, e a duração da linha do menor não soma o tempo do 429 do principal.

**Cobertos:**
- **Refatoração do `desceAoMenor`** (`packages/core/src/ia/llm-gateway.ts:424-425`): ela não muda o comportamento. Os dois blocos de mutação antigos (sem `motivo === 'limite'` e sem `vaga.modelo === undefined`) foram reescritos para o texto novo, com a indentação atual. O bloco novo `desceAoMenor ? undefined : undefined` acompanha o caso "vai ao menor; as linhas, na ordem".
- **"o sinal de quem chamou é também o da chamada ao menor":** a mutação troca o `sinal` da chamada ao menor (linha 429) por um `AbortController` novo. Com ela, `sinais[1]` deixa de ser `controle.signal` e o teste fica vermelho pelo motivo certo.
- **"a duração da linha do menor é a da chamada dele":** com o relógio falso (`performance.now` mockado e restaurado no `finally`), o principal começa em 0, chega a 500 e o menor termina em 507. A mutação da linha 430, que devolve `inicioDaChamada` em vez de `inicioDoMenor`, daria 507 em vez de 7. O prazo é provado com relógio falso, sem depender da carga da máquina.
- **Execução:** os dois casos novos e os arquivos inteiros passam: `llm-gateway.test.ts` e `resilient-adapter.test.ts`, 193 de 193. Rodei pela raiz, porque dentro de `packages/core` o `@educa/shared` não resolve sem build. Não há `.skip`, e os testes usam `ScriptedAdapter` e servidor falso, sem provedor pago.
- **Conferência do documento:** a contagem passou de 21 para 24 blocos. Cada linha da tabela continua com o seu caso citado pelo nome. As recomendações da 1ª rodada estão no `TODO.md` e na seção "Recomendações sem aplicar", cada uma com dono.

**Bloqueantes:** nenhum.

**Recomendações:**
- Citar os dois casos novos na linha 50 da tabela de testes de `tasks/prd-reserva-e-avaliacao/3_task.md`, junto do "`limite` no principal, tarefa com menor". Os dois já têm bloco de mutação, mas ainda não aparecem na tabela.
- O caso do sinal confere que o sinal passado ao menor é o mesmo objeto, mas não aborta esse sinal para ver a chamada ao menor ser cancelada. Basta para a mutação de hoje. Um caso que aborta durante a chamada ao menor e espera o cancelamento provaria o comportamento de ponta a ponta.
- O `inicioDoMenor` passado ao `chamarContando` na linha 429 só pesa na linha estimada do menor que também falha. Nenhum caso fixa a duração dessa linha. Não é cláusula nova desta rodada.
