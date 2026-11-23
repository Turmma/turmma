# Achados das revisões — `tasks/prd-reserva-e-avaliacao/8_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-22 20:16:24 · `tasks/prd-reserva-e-avaliacao/8_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration. `consumo_ia` só ganha uma linha a mais por execução interrompida. A linha tem `escola_id` e a FK composta `(escola_id, execucao_id)` continua igual.

Queries verificadas:
- **`ConsumoRepository.registrarEstimada`** (`apps/api/src/ia/consumo.repository.ts:56-63`): cada linha do laço por destino é gravada pelo `registrar`. Ele lê `requireEscolaId()` do contexto aberto com `execucao.escolaId`, e esse valor vem do `returning` do `update`. Nenhum argumento do cliente entra nisso.
- **`VarreduraDeExecucoes`** (`apps/api/src/ia/varredura-de-execucoes.ts:107`): continua chamando `encerrarRodandasVelhas`. O `@Unscoped` dela já existia, tem justificativa escrita e não é novo. A varredura não ganhou consulta.
- **`ExecucaoProcessor.#aoReentregar`** (`apps/api/src/ia/execucao.processor.ts:206-216`): o `encerrarRodando` continua filtrando por `requireEscolaId()`, pelo id e pelo estado, e as linhas ficam na mesma transação.
- **`destinosDaInterrompida`** e **`consumoEstimadoDaInterrompida`**: são funções puras sobre configuração, sem acesso ao banco.
- **Endpoints**: nenhum foi criado ou alterado, e nenhum `escolaId` vem de corpo ou query.

Teste de isolamento: presente e efetivo. O caso "duas escolas: cada par fica na escola da sua execução" põe a execução mais velha do lote na escola B. Removi mentalmente o escopo de três formas, e o teste quebra em todas:
- Sem o `runInContext` com a escola da execução, o `requireEscolaId` lança e o lote se desfaz.
- Com a escola da primeira execução usada para todas, a FK composta recusa a linha.
- Com o `toEqual` sobre `escola_id`, qualquer linha gravada na escola errada falha.

Mensagens de erro não mudam. Os ids continuam UUID. A camada de rede não é tocada.

Bloqueantes: nenhum.

Recomendações:
1. `InterrompidaEncerrada` é uma interface comum, e qualquer chamador pode montá-la com um `escolaId` qualquer. O próprio `painel-leitura.int.test.ts` faz isso ao chamar `registrarEstimada` direto. Hoje a FK composta segura, e a regra está no comentário. Um tipo de marca devolvido só pelo `ExecucaoRepository` tornaria a garantia estrutural em vez de documental.
2. O `quebrarAGravacaoDa(execucaoId, provedor)` monta a string do `provedor` direto no SQL do gatilho. É só de teste, com valor fixo, mas parâmetro ou `quote_literal` evita o padrão ser copiado.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-22 20:16:45 · `tasks/prd-reserva-e-avaliacao/8_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa 8.0 grava só em `consumo_ia`, com as linhas estimadas da execução interrompida. As inserções diretas novas (`consumo_ia` e `execucao_agente`) aparecem apenas em arquivos de teste. Todos com autor humano: não se aplica, porque nenhum caminho até `Nota` foi criado ou alterado.

Decisão autônoma sobre aluno: ausente. `destinosDaInterrompida` decide quantas linhas de custo e de destino a execução interrompida deixa (o principal e, se houver, a reserva). Isso não toca a trajetória do aluno. As linhas não levam aluno (`aluno_id` nulo), nem texto (`entrada` e `saida` nulas), nem resultado.

Aprovação registrada: ok. A tarefa não cria nenhuma saída de IA que chegue ao aluno. A execução interrompida não produz entrega, e o fluxo de entrega pendente não mudou. A exceção do tutor (D47) não foi estendida a outro agente.

Supervisão do tutor: ok, nada mudou. A linha estimada não leva conversa, não mexe no freio do dia (o caso "fora do freio" no `execucao-interrompida.int.test.ts` prova isso) e não cria nenhum uso do tutor que o professor não veja.

Autonomia declarada e visível: sim, nada mudou. A tarefa não cria agente nem muda o nível de nenhum, e a governança não foi tocada.

Demais itens:
- **Item 6 (auditoria):** o rastro "o que a IA gerou, quem aprovou, quando" não mudou. A tarefa reforça a lista de compartilhamento, que passa a citar os dois provedores possíveis da interrompida (`arquivo-do-titular.int.test.ts`).
- **Item 7 (supervisão sem vigilância):** nenhuma inferência emocional nem medida de comportamento ou navegação.
- **Item 8 (D55, discursiva e redação):** nenhum campo, prompt ou tela de nota. A linha estimada guarda só tetos de tokens, custo e destino.
- **Item 9 (D45 e D64, medir o professor):** nenhuma métrica de professor. `consumo_ia` continua sem coluna de usuário, e `docs/lgpd.md` linha 99 mantém "Não existe consumo por professor". O que o `painel-leitura.int.test.ts` conta é agregado por escola no painel da equipe Turmma (D76), sem professor no recorte.

Bloqueantes: nenhum.

Recomendações:
- Em `packages/core/src/ia/consumo.ts`, o comentário de `destinosDaInterrompida` poderia dizer em uma frase que a linha estimada é só custo e destino, nunca saída de IA a aprovar. Isso evita que alguém ligue essas linhas a uma entrega no futuro. É só texto e não bloqueia.

Arquivos de produção auditados (todos em ``):
- `packages/core/src/ia/consumo.ts`
- `packages/core/src/index.ts`
- `apps/api/src/ia/consumo.repository.ts`
- `apps/api/src/ia/varredura-de-execucoes.ts`
- `apps/api/src/ia/execucao.processor.ts`
- `apps/api/src/ia/ia-do-worker.module.ts`
- `apps/api/src/worker.module.ts`
- `docs/lgpd.md` (linha 99)

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-22 20:17:01 · `tasks/prd-reserva-e-avaliacao/8_task.md`

VEREDITO: APROVADO

**Campos pessoais tocados:** nenhum campo novo. A tarefa grava mais uma linha em `consumo_ia` com colunas que já existiam: `provedor`, `envio_externo`, `pelo_provedor_de_reserva` (falsa), `custo_micros` e os tokens. O `aluno_id` fica nulo e `entrada` e `saida` ficam nulas.

**Fora da tabela de dados do docs/lgpd.md:** nada. A linha 99 de `docs/lgpd.md` foi atualizada na mesma tarefa. Ela agora diz "uma linha por destino possível", que a coluna da Operação é falsa nas duas e que só a tarefa e o provedor contam, sem o modelo e sem a conferência. A finalidade e a retenção (`consumo_por_aluno`) continuam valendo.

**Autorização por objeto:** ok. Não há rota nova. As linhas são gravadas na escola do `InterrompidaEncerrada`, que vem do `returning` do `update` (`apps/api/src/ia/consumo.repository.ts:53-60`). Não há `@Unscoped` novo, e a FK composta `(escola_id, execucao_id)` continua de pé. O caso "duas escolas: cada par fica na escola da sua execução" põe a execução da B como a mais velha do lote.

**Logs:** limpos. A tarefa não criou log novo. Os logs que já existem na varredura e no processor levam só ids, tarefa, código e total.

**Auditoria:** presente onde a regra exige. A tarefa não tem leitura por coordenação ou rede, exportação, nota, permissão nem aprovação.

**Envio externo:** a tarefa não faz envio novo, só registra para onde o dado pode ter ido. A interrompida agora deixa uma linha com o `provedor` do principal e, quando `MODELOS_APROVADOS` aprova a tarefa para o `provedorId` da reserva, outra com o `provedor` da reserva. As duas chegam ao rastro do aluno (`alunoTrailStatement`), à lista de compartilhamento e ao arquivo do titular, e `pelo_provedor_de_reserva` fica fora do arquivo. O teste `execucao-interrompida.int.test.ts` prova isso pela varredura e pela reentrega, com mais estes casos:
- aprovação com outro modelo;
- reserva recusada na conferência da D62;
- aprovação para outro provedor;
- tarefa sem aprovação.

O `arquivo-do-titular.int.test.ts` prova que as duas linhas entram no arquivo, cada uma com o seu `provedor`. Rodei o `consumo.test.ts`: 26 de 26 passaram.

**Seed/fixture:** sintético. Os provedores, modelos e preços dos testes são fictícios (`principal-8-0`, `reserva-y`, `modelo-sintetico`). O `aprovadoPor` é `teste` ou `sintetico`, as escolas vêm da bancada e o `ESCOLAS_COM_EXECUCAO` faz a limpeza.

**Pergunta de fechamento:** o código responde. O pedido da secretaria agora inclui a reserva como destino possível da execução interrompida, que antes ficava de fora. Esse era o achado do privacy-guardian na 5.0, e esta tarefa o fecha.

**Bloqueantes:** nenhum.

**Recomendações:**
1. A lista de compartilhamento junta a linha estimada com a chamada que de fato saiu. No caso "reserva configurada e recusada na conferência da D62", ela diz ao titular que a conversa do Tutor pode ter ido a um provedor que a D62 recusou. Superestimar foi a escolha da linha 99, mas a escola pode ler isso como envio confirmado. Sugiro que `compartilhamento.ts` marque os destinos vindos só de `codigo_de_erro = 'EXECUCAO_INTERROMPIDA'` como "possível, não confirmado". Fica para a validação da spec ou para quem tocar a lista.
2. Quando a reserva configurada é a falsa, `destinosDaInterrompida` (`packages/core/src/ia/consumo.ts:97-99`) não repete a recusa que `reservaElegivel` faz em `AMBIENTE=producao`. Hoje isso não vaza nada, porque o falso grava `provedor` nulo. Mesmo assim, um comentário ou um caso que fixe esse comportamento evita confusão quando entrar o primeiro provedor de verdade em `MODELOS_APROVADOS`.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-22 20:17:22 · `tasks/prd-reserva-e-avaliacao/8_task.md`

VEREDITO: APROVADO

Escopo: respeitado
Aderência à Tech Spec: ok. A única divergência (`destinosDaInterrompida(tarefa, configurados)`, `destinos` e `precos` na varredura e no processor, `DESTINO_DA_RESERVA` montado no `worker.module.ts`) está declarada no `8_task.md` e escrita na `techspec.md` §3, no parágrafo novo depois de `registrarEstimada`, e no `cenarios.md` §1, RF6.
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

Bloqueantes: nenhum

Recomendações:
1. **Comentários que ainda falam de uma linha só.** O item 7 da autoconferência diz que os comentários foram acertados, mas três ficaram para trás:
   - `apps/api/src/ia/varredura-de-execucoes.ts:30` diz "encerram cada execução uma vez só, com uma linha". Com a reserva aprovada são duas.
   - `apps/api/src/ia/execucao.processor.ts:79` diz "grava a linha estimada".
   - `apps/api/src/ia/execucao.processor.ts:204` diz "só ele grava a estimada". Os dois deviam dizer "as linhas estimadas, uma por destino".
2. **O destino da reserva é montado de um segundo jeito.** Em `apps/api/src/ia/ia-do-worker.module.ts:118-124`, a fábrica do `DESTINO_DA_RESERVA` copia à mão o que `destinoDoAdaptador` faz em `packages/core/src/ia/llm-gateway.ts:920`. Ela também cria um segundo adaptador da reserva, além do da linha 78. Uma `destinoDaReserva(config)` ao lado de `destinoDoAdaptador` deixa o mapeamento num lugar só e mantém a promessa do comentário de `llm-gateway.ts:917`: o destino "não diverge do que a chamada de verdade registraria".
3. **Frase ambígua na Tech Spec.** Em `tasks/prd-reserva-e-avaliacao/techspec.md`, no parágrafo de `pelo_provedor_de_reserva` da §3, ficou "a estimada da interrompida leva o provedor da reserva e a coluna falsa". Lida sozinha, dá a entender uma linha só, com o provedor da reserva. Melhor: "cada linha da estimada leva o provedor do seu destino e a coluna falsa, também a da reserva".
4. **O ambiente não entra na escolha dos destinos.** `destinosDaInterrompida` (`packages/core/src/ia/consumo.ts:96-99`) não olha o ambiente. Em produção, uma entrada de `falso-reserva` geraria a linha da reserva, enquanto `aprovadaParaAReserva` a recusa. Hoje isso não acontece, e a escolha está de acordo com a regra de superestimar, mas vale uma frase no comentário da função registrando que a diferença é de propósito.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-22 20:17:37 · `tasks/prd-reserva-e-avaliacao/8_task.md`

```
VEREDITO: APROVADO
Caminho quente tocado: fila | IA
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- apps/api/src/ia/varredura-de-execucoes.ts:30: o comentário ainda diz que as duas réplicas encerram cada execução "com uma linha". Agora são até duas, uma por destino. Atualizar o texto.
- apps/api/src/ia/varredura-de-execucoes.ts:18 e :107: o passo da varredura sobe de até 200 para até 400 INSERTs de uma linha, um por ida e volta ao banco. Isso cabe no passo. Mas o "pior caso de 2 × 5 × 5 s = 50 s" supõe que o `statement_timeout` limita o passo inteiro, e ele limita cada instrução. Gravar as linhas do lote num INSERT só (ou num por passo) deixa a conta do comentário verdadeira. Se não, corrigir o comentário. Isso já valia antes desta tarefa e só piorou na proporção.
- O worker de produção não injeta `precos` na varredura nem no processor, e usa o padrão `PRECO_DOS_MODELOS`. Hoje bate com o gateway, que também não recebe `precos` (apps/api/src/ia/ia-do-worker.module.ts:101-113). Quando a 14.0 der ao gateway uma tabela por porta, essa mesma tabela precisa chegar ao `CicloDoWorkerDeIa`. Se não chegar, a estimada passa a usar outro preço. Registrar isso como dependência da 14.0.
```

Os testes da tarefa passam: o unitário de `consumo.test.ts` (26 casos) e os de integração de `execucao-interrompida.int.test.ts` e `reserva-na-subida.int.test.ts` (51 casos).

A mudança roda só no worker, em nenhum request. Ela escreve no máximo uma linha a mais por execução interrompida, na mesma transação do encerramento. A concorrência continua protegida pelo `update … where estado = 'rodando'` que já existia. Há teste para as duas varreduras em `Promise.all` e para a falha só na segunda linha, que desfaz tudo. Nenhum teste chama provedor pago: são destinos falsos com tabela de preços injetada.

## test-engineer · 1ª rodada · APROVADO · 2026-11-22 20:19:20 · `tasks/prd-reserva-e-avaliacao/8_task.md`

VEREDITO: APROVADO

Cenários exigidos:
- Caminho feliz pela varredura: com a tarefa aprovada para a reserva e preços diferentes, saem duas linhas, cada uma com os dois tetos ao seu preço.
- O mesmo pela reentrega do job (`#aoReentregar`).
- Nas duas linhas, `pelo_provedor_de_reserva` é falsa, e a linha da reserva leva o provedor dela.
- Concorrência: duas varreduras em paralelo (`Promise.all`) deixam exatamente duas linhas.
- Transação: se a gravação da linha da reserva falha, as duas linhas e o encerramento se desfazem.
- Isolamento: com duas escolas, cada par fica na escola da sua execução, com a da outra escola na frente do lote.
- Casos de borda:
  - a aprovação é de outro modelo, e as duas linhas saem mesmo assim;
  - a reserva foi recusada na conferência da D62, e as duas linhas saem;
  - a aprovação é de outro provedor, e sai só a do principal;
  - não há aprovação para a tarefa, e sai só a do principal.
- O custo é maior que zero e cada linha usa o preço do seu modelo (D14).
- A Operação conta só as chamadas enviadas: `chamadasPeloProvedorDeReserva = 1`.
- O aluno fica fora do freio: `aluno_id` nulo nas duas linhas.
- A fiação do worker de verdade, com reserva e sem reserva.
- Não há rota nova, então o caso de permissão não se aplica. O isolamento entre escolas fica com o caso das duas escolas.

Cobertos:
- Cada uma das 13 linhas da tabela "Testes que provam a regra" tem o seu teste, achado pelo nome:
  - `packages/core/src/ia/consumo.test.ts`: 11 casos novos, nos blocos de `destinosDaInterrompida` e de `consumoEstimadoDaInterrompida`.
  - `apps/api/src/ia/execucao-interrompida.int.test.ts`: os 9 casos do bloco "a execução interrompida com a reserva configurada (F5b, 8.0)".
  - `apps/api/test/painel-leitura.int.test.ts`: a Operação, com `chamadasPeloProvedorDeReserva` lido pelo `PainelService`.
  - `apps/api/test/arquivo-do-titular.int.test.ts`: o compartilhamento no arquivo do titular.
  - `apps/api/src/ia/reserva-na-subida.int.test.ts`: o worker de verdade, com reserva e sem reserva.
- A seção "Mutações" bate com o `git diff`. Toda cláusula de produção tem o seu bloco, e cada bloco cai no teste citado pelo motivo certo:
  - em `destinosDaInterrompida`: o termo da tarefa, o do provedor, o ternário e o padrão `MODELOS_APROVADOS`;
  - no custo: a chave `destino.identidade`, o instante, a tabela de preços repassada e o teto de entrada;
  - o laço no repository;
  - a chamada a `destinosDaInterrompida` e os preços, na varredura e no processor;
  - a fiação do worker.
- Os dois padrões `= PRECO_DOS_MODELOS` ficaram sem bloco, com motivo escrito e aceitável. O gateway de produção também não recebe tabela, então os dois caminhos leem a mesma.
- As asserções olham o resultado: as linhas do banco comparadas com `toEqual`, uma por provedor, com custo, tokens, coluna da Operação, `aluno_id` e escola. O rastro do aluno é lido pela mesma instrução do produto, antes e depois. Nenhum teste espia o repository.
- A concorrência é de verdade: duas varreduras em `Promise.all`, seguradas no banco por `WriteBlockTrigger` e `esperarNaTrava`.
- A falha da transação vem de um gatilho que só dispara em `new.provedor` da reserva. Depois de tirado o gatilho, a mesma execução se encerra com as duas linhas, o que mostra que foi a segunda linha que segurou.
- Nenhum `.skip`, `.only` ou `vi.mock` nas linhas novas. Nenhum teste chama provedor pago: só destinos sintéticos e o adaptador falso.
- Rodei e passaram:
  - `consumo.test.ts` (26 testes);
  - `execucao-interrompida.int.test.ts` (39);
  - `reserva-na-subida.int.test.ts` (12);
  - o caso novo de `painel-leitura.int.test.ts`;
  - o caso novo de `arquivo-do-titular.int.test.ts`.

Bloqueantes: nenhum

Recomendações:
1. `execucao-interrompida.int.test.ts`, caso "reserva configurada e recusada na conferência da D62": a varredura não consulta o gateway. Por isso o `fila.roteirizar({ … conferenciaDaReserva: { conferida: false } })` não muda nada no que o teste mede. Ele protege contra uma mudança futura, mas não prova a escolha da linha 99. Ele só provaria de fato no worker de verdade: em `reserva-na-subida.int.test.ts`, com a reserva configurada e recusada na subida, conferir que as duas linhas saem. É ali que alguém ligaria o `DESTINO_DA_RESERVA` à `SoberaniaNaSubida`.
2. O mesmo caso deixa o roteiro da bancada com a conferência recusada para os casos seguintes, porque o `beforeEach` só volta as aprovações ao estado inicial (`aprovar()`). Hoje não faz diferença, mas vale restaurar o roteiro no `beforeEach`.
3. `reserva-na-subida.int.test.ts`, caso "deixa as duas linhas estimadas": só confere `toHaveLength(2)`, sem dizer qual linha é de qual destino. Com o principal e a reserva falsos, as duas linhas podem sair iguais. Vale conferir o modelo ou o provedor que só a linha da reserva leva.
4. `arquivo-do-titular.int.test.ts`, caso "as duas linhas estimadas da execução interrompida…": as linhas são inseridas à mão, então o teste passaria antes da 8.0. Ele prova o leitor do arquivo, não quem grava as linhas. Quem prova de ponta a ponta são os casos de `execucao-interrompida.int.test.ts` que leem o rastro com `alunoTrailStatement`. Vale dizer isso na tabela do documento, para a validação não contar este caso como prova de RF5.
5. Concorrência entre caminhos diferentes: só há duas varreduras em paralelo. Falta a varredura disputando com a reentrega a mesma execução `rodando` com reserva, esperando exatamente um par. A trava do encerramento não mudou, então não bloqueia, mas é a corrida que acontece em produção.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-22 20:35:48 · `tasks/prd-reserva-e-avaliacao/8_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido. O `conferir` respondeu "portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)".
Bloqueantes: nenhum.

Nesta rodada li só o diff entre as árvores 6c69297c e 555493e6, sem `achados/`. Ele traz o que a ordem `8_task-r1` mandou fazer, e nada fora disso.
- **Gatilho de teste:** em `apps/api/src/ia/execucao-interrompida.int.test.ts`, o gatilho agora recebe o provedor por `quote_literal`, em vez de colado no SQL.
- **Roteiro da bancada:** a constante `GATEWAY` é restaurada no `beforeEach`. Com isso, o caso da conferência recusada deixa de deixar o estado alterado para o caso seguinte.
- **Teste da subida:** `apps/api/src/ia/reserva-na-subida.int.test.ts` agora confere o `provedor` e o `modelo` de cada uma das duas linhas. A ordem que o teste espera bate com o `order by modelo` de `linhasDaVarreduraDaSubida` (linha 203).
- **Tech Spec:** a frase da §3 diz agora que cada linha estimada leva o provedor do seu destino, com a coluna `pelo_provedor_de_reserva` falsa. É isso que o teste da subida confere.
- **Comentários e JSDoc:** em `execucao.processor.ts`, `varredura-de-execucoes.ts` e `consumo.ts`, dizem "uma linha por destino". O JSDoc de `destinosDaInterrompida` registra que a função não olha o ambiente, de propósito.
- **Recomendações sem aplicar:** as seis entraram no `TODO.md` com dono. A da tabela de preços entrou no "Contexto necessário" de `14_task.md`, como a ordem pedia.

Recomendações:
- `tasks/prd-reserva-e-avaliacao/cenarios.md:61`: a linha do RF5 pela varredura cita como prova só `arquivo-do-titular.int.test.ts` e `consumo.test.ts`. Agora o `8_task.md` diz que o caso de `arquivo-do-titular` testa só o leitor e não conta como prova do RF5. A linha 64 cobre a varredura em `execucao-interrompida.int.test.ts`, então a regra tem teste. Mesmo assim, a linha 61 devia citar `execucao-interrompida.int.test.ts`, para o `cenarios.md` e o `8_task.md` dizerem a mesma coisa sobre o que prova o RF5.
- `apps/api/src/ia/execucao-interrompida.int.test.ts:256`: a linha do `quote_literal` faz consulta, dois casts e interpolação numa expressão só. Separar a consulta numa variável com nome, antes de montar o `when`, deixa a linha legível.

## test-engineer · 2ª rodada · APROVADO · 2026-11-22 20:36:30 · `tasks/prd-reserva-e-avaliacao/8_task.md`

VEREDITO: APROVADO

Cenários exigidos: os mesmos da 1ª rodada. Nesta rodada conferi o diff de 6c69297c para 555493e6, que mexe em dois testes e em texto.
- **Varredura com reserva aprovada:** a execução interrompida fica com duas linhas estimadas, uma por destino, cada uma com o preço dela.
- **Reentrega pelo `#aoReentregar`:** chega ao mesmo par de linhas.
- **Coluna da Operação:** `pelo_provedor_de_reserva` é falsa nas duas linhas, e cada linha leva o provedor e o modelo do seu destino.
- **Duas varreduras em `Promise.all`:** ficam exatamente duas linhas.
- **Conferência da D62 recusada:** as duas linhas ficam mesmo assim.
- **Varredura da subida no worker de verdade:** deixa o par de linhas.
- **Compartilhamento do aluno:** lista os dois destinos.

Cobertos:
- **Varredura da subida** (`reserva-na-subida.int.test.ts:301-314`): o caso agora sobe um principal externo de verdade (`principalExterno`). O `toMatchObject` sobre a lista ordenada confere o provedor, o modelo, o `codigo_de_erro` e a `pelo_provedor_de_reserva` de cada linha. Antes o teste só contava as linhas e olhava as duas colunas. Agora fica vermelho se a linha da reserva sumir, se a linha do principal perder o provedor ou se os destinos se trocarem. A ordem por `modelo` é determinística (`falso-deterministico` vem antes de `modelo-de-teste`). Com lista, o `toMatchObject` já exige o tamanho exato, então o `toHaveLength(2)` repete a conferência.
- **Sem provedor pago:** a URL do principal é `api.provedor-de-teste.example`, e a varredura não chama modelo. A reserva é o adaptador falso.
- **`execucao-interrompida.int.test.ts`:** o `beforeEach` (linhas 897-898) agora volta o roteiro da bancada ao `GATEWAY` de partida. Antes, o caso da conferência recusada deixava a reserva recusada para os casos seguintes, e o resultado dependia da ordem dos casos. Essa correção tira a dependência. O caso da linha 1030 continua provando a recusa, com `{ ...GATEWAY, conferenciaDaReserva: { conferida: false } }`. Em `quebrarAGravacaoDa` (linha 256), o provedor agora entra no gatilho por `quote_literal`. É só endurecimento do auxiliar do teste e não muda o que o caso prova.
- **Tabela de testes da 8_task.md:** a linha do compartilhamento passou a dizer que o caso de `arquivo-do-titular.int.test.ts` insere as linhas à mão. Por isso ele prova só o leitor do arquivo do titular e não conta como prova do RF5. A prova de ponta a ponta fica com os casos de `execucao-interrompida.int.test.ts`, que leem o rastro com `alunoTrailStatement`.
- **Texto:** os comentários em `execucao.processor.ts`, `varredura-de-execucoes.ts` e no JSDoc de `destinosDaInterrompida` (`consumo.ts`) não mudam comportamento. O JSDoc agora explica por que a função não olha o ambiente.
- **Execução:** `reserva-na-subida.int.test.ts` passou com 12 de 12 casos e `execucao-interrompida.int.test.ts` com 39 de 39. Não há `.skip`, teste comentado nem mock que esconda a regra no diff.

Bloqueantes: nenhum. A 1ª rodada não exigiu correções, e o diff não deixa nenhuma regra sem teste.

Recomendações:
- `apps/api/src/ia/execucao-interrompida.int.test.ts:256`: a consulta de `quote_literal` cabe numa linha só, com cast e desestruturação juntos. Ler o literal numa variável antes de montar `soDoProvedor` deixaria a linha mais fácil de ler.
- `apps/api/src/ia/reserva-na-subida.int.test.ts:313`: o `toHaveLength(2)` pode sair, porque o `toMatchObject` sobre a lista já garante o tamanho.
- As recomendações da 1ª rodada que foram para o `TODO.md` continuam valendo para a validação da spec. Duas delas são a conferência recusada no `reserva-na-subida.int.test.ts` e a varredura disputando com a reentrega a mesma execução `rodando`, esperando um par só.
