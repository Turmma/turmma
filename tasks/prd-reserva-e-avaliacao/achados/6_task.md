# Achados das revisões — `tasks/prd-reserva-e-avaliacao/6_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-22 18:09:05 · `tasks/prd-reserva-e-avaliacao/6_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma. A tarefa não tem migration nem schema.

Queries verificadas: nenhuma. O código de produção alterado é só o comentário em `packages/core/src/ia/prazo-da-execucao.ts`. A tarefa não muda repository, endpoint nem `@Unscoped()`. O `escolaId` que aparece nos testes novos de `packages/core/src/ia/llm-gateway.test.ts` é o pedido interno ao gateway, no mesmo padrão dos testes que já existem. Nenhum dado de cliente entra por ali. O log `ia.geracao.reserva` registra só ids. O texto do aluno (`Bia`, `confuso`, `coes`) não chega ao consumo nem ao log, e um teste novo confere isso.

Teste de isolamento: não se aplica. A tarefa não cria superfície de acesso a dado por escola, então não há cláusula de escopo para remover e testar. Os testes novos cobrem o contador por destino, a saída de reserva e o prazo, que não são isolamento.

Bloqueantes: nenhum

Recomendações:
- `docs/infra.md` (parágrafo "O balde geral é de todas as escolas"): a reserva não reserva vaga no balde dela até a 7.0, como diz o comentário em `prazo-com-tokens.int.test.ts`. Enquanto isso, uma escola com muita carga que cai na reserva pode gastar o contratado da reserva das outras escolas. Isso não vaza dado, mas é interferência entre escolas. Vale citar a reserva nesse parágrafo quando a 7.0 pousar.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-22 18:09:30 · `tasks/prd-reserva-e-avaliacao/6_task.md`

**VEREDITO: APROVADO**

Esta tarefa só acrescenta testes, um comentário e um trecho de documentação. Não muda nenhuma linha de código que rode em produção (`packages/core/src/ia/prazo-da-execucao.ts` ganhou só um comentário). Rodei `llm-gateway.test.ts` e os 186 casos passaram. O teste de integração do prazo não foi rodado.

Campos pessoais tocados: nenhum. Não há migration, schema nem DTO novo.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: não se aplica. A tarefa não cria repository, query nem endpoint.

Logs: limpos. O novo caso em `packages/core/src/ia/llm-gateway.test.ts` confere a linha `ia.geracao.reserva` campo a campo: `evento`, `tipo`, `escolaId`, `execucaoId` e `tentativas: 4`. Ele também confere que nem o consumo nem o log contêm o nome ou o conteúdo do texto da aluna (`not.toMatch(/Bia|confuso|coes/u)`).

Auditoria: não se aplica. Não há leitura de dado de aluno, exportação, nota, permissão nem aprovação de saída de IA.

Envio externo: nada novo. O caminho da reserva continua passando pela porta (`LLMGateway`). Nos testes, a reserva só é usada quando a D62 foi conferida (`soberaniaDaReserva: { conferida: true }`) e o modelo está aprovado por tarefa, provedor e modelo. Cada chamada gera uma linha de consumo com `provedorId` e `peloProvedorDeReserva`. O teste novo de mesmo `provedorId` (linhas 252–266) prova que as quatro linhas guardam destino e modelo distintos, então o rastro de para onde o dado foi continua respondendo. No teste do prazo, o `provedorId: null` vem do adaptador falso marcado como sem envio externo (`SEM_ENVIO_EXTERNO`), e não de perda de rastro.

Seed/fixture: sintético. São a "Bia" fictícia, o texto inventado e o `MATERIAL_DE_ESTEQUIOMETRIA` de `__fixtures__`. A reserva aprovada nos testes leva `relatorio`, `sha256` e `aprovadoPor` de teste.

Pergunta de fechamento: a resposta não piora. Cada uma das até quatro chamadas continua com a sua linha de consumo, com provedor, modelo e destino.

Bloqueantes: nenhum.

Recomendações:
- No caso do prazo em `apps/api/src/ia/prazo-com-tokens.int.test.ts:230`, a reserva é um adaptador sem envio externo. Por isso o caso não mostra que a quarta linha, cortada pelo prazo, guarda o `provedorId` de uma reserva externa. A 4.0 já prova isso no caso "a reserva que falha depois de sair…". Ainda assim, uma variante com envio externo no caso do prazo fecharia o rastro também quando o prazo corta a chamada.
- A expressão `coes` na checagem de vazamento (`llm-gateway.test.ts:301`) é genérica. Um trecho mais distintivo do `juizo`, como "sem coesão", deixa a intenção mais clara.

Arquivos auditados:
- `packages/core/src/ia/llm-gateway.test.ts`
- `apps/api/src/ia/prazo-com-tokens.int.test.ts`
- `packages/core/src/ia/prazo-da-execucao.ts`
- `docs/infra.md`
- `tasks/prd-reserva-e-avaliacao/6_task.md`
- `tasks/prd-reserva-e-avaliacao/tasks.md`

## llm-integrator · 1ª rodada · APROVADO · 2026-11-22 18:09:32 · `tasks/prd-reserva-e-avaliacao/6_task.md`

VEREDITO: APROVADO

Rodei os testes da tarefa. `llm-gateway.test.ts` e `prazo-da-execucao.test.ts` passam (188 testes). `prazo-com-tokens.int.test.ts` também passa (9 testes). Não repeti a mutação à mão que o `6_task.md` descreve, porque não posso editar arquivos. Li o código de `chamarAteValer` e `saidaDeReserva` em `packages/core/src/ia/llm-gateway.ts`, e ele corresponde ao que os casos provam.

Perfis usados: nenhum novo. A tarefa não adiciona chamada de modelo em produção. O diff de produção é só o comentário de `packages/core/src/ia/prazo-da-execucao.ts`. Os testes usam adaptadores falsos (`LentoAdapter`, `ReservaRoteirizada`) e nenhum chama provedor. Os dois perfis existentes são exercitados com o prazo certo: `padrao` com 140.000 ms (ferramenta) e `rapido` com 60.000 ms (Tutor).

Custo estimado por professor/mês: sem mudança em chamadas por professor nem em perfil. O teto por execução continua em quatro chamadas, duas por destino. O custo só passa de duas chamadas quando o principal cai e a reserva atende, e essa conta é da tarefa 4.0. O número por professor continua sendo o da estimativa da funcionalidade e da 4.0.

Prompt versionado: não se aplica. Não há prompt novo.

Validação de schema: sim. Os testes cobrem os dois caminhos:
- JSON quebrado duas vezes na reserva termina `IA_SAIDA_INVALIDA`.
- Só a reprovação na conferência chega à `reservaQuandoInvalida`, e a recusa fixa vale só quando a última reprovação é da D55 (`llm-gateway.test.ts`).

Aprovação humana no caminho: não se aplica. A tarefa não altera entrega nem nota. O caso da D55 exercita a recusa fixa, sem nenhuma devolutiva sobre o texto da aluna. O teste confere que o texto "Bia" e o julgamento do modelo não vão para o registro de consumo nem para o log.

Bloqueantes: nenhum.

Recomendações:
- `packages/core/src/ia/llm-gateway.test.ts`, no caso da recusa fixa: o regex `/Bia|confuso|coes/u` é frágil. `coes` só casa com a chave `citacoes` por acaso. Trocar por uma asserção explícita (`not.toContain('citacoes')` ou um objeto esperado) deixa a intenção clara.
- `apps/api/src/ia/prazo-com-tokens.int.test.ts`, na quarta chamada: o teste comenta que a reserva ainda não reserva vaga de tokens no balde dela (7.0) e só abre o balde do principal. Convém ter um caso, na 7.0, que prove o prazo com o balde da reserva fechado, para o comentário não ficar solto.
- `docs/infra.md`, parágrafo novo: a frase "a linha dela com a estimativa (D14)" descreve o comportamento da 4.0. O teste só confere `estado: 'falhou'` e `peloProvedorDeReserva`. Vale uma asserção de `tokens` estimados na linha, ou o texto citar a 4.0.
- `tasks/prd-reserva-e-avaliacao/6_task.md`: "Arquivos previstos" lista `prazo-da-execucao.test.ts` como alterado, mas ele não mudou. Está coerente com a tabela de testes ("já existentes"), mas a lista de arquivos deveria dizer "sem mudança".

Arquivos relevantes:
- `packages/core/src/ia/llm-gateway.test.ts`
- `apps/api/src/ia/prazo-com-tokens.int.test.ts`
- `packages/core/src/ia/prazo-da-execucao.ts`
- `docs/infra.md`

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-22 18:09:33 · `tasks/prd-reserva-e-avaliacao/6_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A mudança mexe em testes, num comentário de `prazo-da-execucao.ts` e em `docs/infra.md`. Não há schema, repository, job, seed, importação nem webhook que escreva em `Nota`. Todos com autor humano? Sim, porque nenhum caminho novo foi aberto.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. Nenhuma saída nova de IA chega ao aluno. A recusa da D55 é a resposta do Assistente ao professor na conversa (`propor_ferramenta`). Não é entrega sobre o aluno e não toca o fluxo de entrega pendente.

Supervisão do tutor: ok. O Tutor aparece só no caso de prazo do perfil `rapido`, que termina `IA_TEMPO_ESGOTADO`. Não muda a supervisão nem o registro.

Autonomia declarada e visível: sim, sem alteração. A tarefa não cria agente nem muda nível.

Bloqueantes: nenhum.

O que conferi da regra 70 nesta tarefa:
- **D55 / item 2a, a recusa só por motivo da D55.** `packages/core/src/ia/llm-gateway.ts:477-480` passa os `problemas` à `saidaDeReserva` só quando a última reprovação foi na conferência (`reprovadaNaConferencia`). Já `packages/core/src/ia/tasks/propor-ferramenta.ts:649-652` devolve a recusa fixa (`RECUSA_DE_CORRECAO_DE_TEXTO_DE_ALUNO`) só quando há problema da D55. Os testes novos provam quatro coisas:
  - A decisão vem da última chamada da reserva, nos dois sentidos.
  - Os `problemas` do principal não contaminam a decisão.
  - JSON quebrado continua `IA_SAIDA_INVALIDA`.
  - A reserva começa sem a correção do principal, então o juízo do principal não é reenviado.
- **Nada do juízo fica gravado.** O teste confere que as linhas de consumo e o log não guardam o texto da aluna nem o juízo do modelo (`not.toMatch(/Bia|confuso|coes/u)`). O log `ia.geracao.reserva` leva só ids e `tentativas: 4`. O juízo vive apenas na memória da repetição (`RepairHint`), sem campo, rascunho nem log, como o item 2a exige.
- **Auditoria (item 6).** Cada uma das quatro linhas de consumo leva o próprio `provedorId`, `modelo` e `peloProvedorDeReserva`. A execução que estoura o prazo grava `falhou` / `IA_TEMPO_ESGOTADO` com `peloProvedorDeReserva: true`. Assim "o que a IA gerou e por qual provedor" continua com resposta.
- **Itens 7 e 8.** Nenhuma métrica de professor nem inferência sobre aluno nesta mudança.
- **Testes rodados.** Os 5 casos novos de `llm-gateway.test.ts` (os 4 da saída de reserva com a D55 e o de mesmo `provedorId`) passam. O de prazo na integração não rodei.

Recomendações:
- `packages/core/src/ia/llm-gateway.test.ts`, caso "o principal reprovado por outro motivo…": a asserção `toContain('julga texto de aluno')` depende do texto do problema. Comparar com a constante (`PROBLEMA_DO_JULGAMENTO` ou `PROBLEMAS_DA_D55`) resiste melhor a uma mudança de redação.
- `docs/infra.md`, parágrafo novo: vale dizer em uma linha que a recusa fixa da D55 também pode sair da reserva. Hoje isso só está nos testes e na `6_task.md`, e o leitor de infra só vê o prazo.

Arquivos auditados:
- packages/core/src/ia/llm-gateway.test.ts
- packages/core/src/ia/llm-gateway.ts
- packages/core/src/ia/tasks/propor-ferramenta.ts
- packages/core/src/ia/prazo-da-execucao.ts
- apps/api/src/ia/prazo-com-tokens.int.test.ts
- docs/infra.md

## infra-guardian · 1ª rodada · APROVADO · 2026-11-22 18:09:41 · `tasks/prd-reserva-e-avaliacao/6_task.md`

VEREDITO: APROVADO
Caminho quente tocado: IA (o gateway e o prazo da execução do Tutor e da ferramenta)
Rate limit: ok (a tarefa não mexe nele)
Fila e prioridade: ok (não mudou: o prazo de 60 s no `rapido` e 140 s no `padrao` continua abaixo dos 150 s do job `ia.executar` menos a folga de 5 s)
Concorrência: protegida (a tarefa não cria operação que possa rodar duas vezes ao mesmo tempo)
Índice e paginação: ok (não há query nova)
Degradação de IA: ok (o principal cai e a chamada vai à reserva; a quarta chamada pendurada termina `IA_TEMPO_ESGOTADO` tipado no instante do prazo do perfil, com a execução marcada `falhou`. Duas saídas reprovadas na conferência da reserva levam à saída de reserva da tarefa, e JSON quebrado continua terminando `IA_SAIDA_INVALIDA`. Nenhum desses caminhos devolve erro cru ao aluno)
Migration: não se aplica
Métrica e alerta: ok (o código de produção mudou só num comentário; a métrica `ia.degradacao{provedor_de_reserva}` e o log `ia.geracao.reserva` com `tentativas: 4` já existiam e agora estão no teste)
Bloqueantes: nenhum

Recomendações:
- Hoje a chamada à reserva não pega vaga em nenhum balde de tokens (`packages/core/src/ia/llm-gateway.ts:512-514`). Isso vem da 4.0 e está previsto para a 7.0. Enquanto não chegar, um pico de quedas do principal às 10h manda toda a carga à reserva sem o limite de tokens por minuto da regra 80, item 4. A 7.0 precisa:
  - abrir também o balde da reserva no caso de prazo de `apps/api/src/ia/prazo-com-tokens.int.test.ts` (linha 199: "Só o balde do principal abre…");
  - acertar os textos novos de `docs/infra.md` e de `prazo-da-execucao.ts`, que hoje não mencionam o balde da reserva.
- Os comentários de `prazo-da-execucao.ts` dão o pior caso como "56 s" e "136 s". Essas contas são da execução de duas chamadas, e um leitor pode tomá-las como valendo para quatro. Vale uma frase dizendo que, com a reserva, o pior caso é o próprio prazo.

Rodei `llm-gateway.test.ts` e `prazo-da-execucao.test.ts` (188 testes) e `prazo-com-tokens.int.test.ts` (9 testes), e todos passaram. Nenhum chama provedor pago: são adaptadores roteirizados e o `LentoAdapter` com relógio falso.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-22 18:09:50 · `tasks/prd-reserva-e-avaliacao/6_task.md`

**VEREDITO: APROVADO**

**Escopo:** respeitado. As subtarefas 6.1 e 6.2 já estavam prontas desde a 4.0, e a terceira linha de "Divergências resolvidas" do `4_task.md` registra isso. Ela também diz que a 6.0 fica com a 6.3, a 6.4 e o caso de mesmo `provedorId`, e foi isso que a tarefa fez. Ela não mexe no ramo sem vaga, que é da 7.0, nem na interrompida, que é da 8.0. O caso do prazo deixa a reserva fora do balde e diz que isso é da 7.0.

**Aderência à Tech Spec:** ok.
- A seção "A chamada" (3) e (4) da techspec bate com o código da 4.0. A repetição para pelo contador de cada destino (`llm-gateway.ts:446`). A saída de reserva usa os `problemas` da última chamada, e só quando a reprovação veio da conferência (`llm-gateway.ts:477-480`).
- A §7c pede que `PRAZO_DA_EXECUCAO_MS` não mude e que o comentário e o `docs/infra.md` sejam revistos. A constante não mudou, e os dois textos foram revistos.
- Os quatro cenários do RF3 que a tarefa cita no `cenarios.md` têm caso de teste com nome na tabela da tarefa.
- A tabela de divergências da 6.0 está vazia, e com razão: a única divergência já está registrada na 4.0.

**Portão local:** carimbo válido para o código atual (typecheck, lint, segredo, dependências, unidade, alvo).

**Bloqueantes:** nenhum.

**Recomendações:**
1. `packages/core/src/ia/prazo-da-execucao.ts:5-6`: os números "pior caso de 56 s" e "pior caso de 136 s" saíram da conta com duas tentativas. Com quatro chamadas, o que limita o pior caso é o próprio prazo, de 60 s e 140 s. O mesmo vale para a frase "A conta do pior caso fica a mesma" em `docs/infra.md:124`. Basta dizer de onde vêm 56 e 136, ou trocar a frase por "o pior caso é o prazo".
2. `apps/api/src/ia/prazo-com-tokens.int.test.ts:229-230`: a última linha de consumo é conferida com `provedorId: null`, e isso vale para qualquer adaptador falso, o principal também. Só `peloProvedorDeReserva` mostra que a linha é da reserva. Conferir também o modelo `reserva-<perfil>` deixaria claro de qual destino ela é.
3. O parágrafo novo em `docs/infra.md:121-124` e o bloco novo do comentário em `prazo-da-execucao.ts` quebram as linhas bem mais longe que o texto ao redor. É só aparência.

## test-engineer · 1ª rodada · APROVADO · 2026-11-22 18:10:16 · `tasks/prd-reserva-e-avaliacao/6_task.md`

VEREDITO: APROVADO

**Cenários exigidos (tarefa 6.0, RF3, §7c):**
- **Caminho feliz:** com principal e reserva do mesmo `provedorId` e modelos diferentes, a execução para em quatro chamadas e grava quatro linhas.
- **Saída de reserva:** depois de duas inválidas na reserva, a saída de reserva usa os `problemas` da última chamada da reserva, e não os do principal.
- **Borda 1:** a ordem na reserva decide. D55 e depois outro motivo dá `IA_SAIDA_INVALIDA`; o inverso dá a recusa fixa.
- **Borda 2:** JSON quebrado não é reprovação na conferência e não chega à `reservaQuandoInvalida`.
- **Prazo:** a quarta chamada, na reserva, fica pendurada e termina `IA_TEMPO_ESGOTADO` no prazo do perfil (140.000 ms no `padrao`, 60.000 ms no `rapido`), sem quinta chamada.
- **Constante:** `PRAZO_DA_EXECUCAO_MS` não muda.
- **Permissão e isolamento:** não se aplicam. A tarefa não cria endpoint, repository nem query. O log `ia.geracao.reserva` segue só com `escolaId`, `execucaoId` e `tentativas`, e o teste confere que nenhum texto da aluna vaza para o consumo nem para o log.
- **Concorrência:** não se aplica. É uma execução por vez com um só relógio falso, e a execução em dobro é da camada de fila, fora deste escopo.

**Cobertos** (rodei `llm-gateway.test.ts` e `prazo-da-execucao.test.ts`, 188 verdes, e `prazo-com-tokens.int.test.ts`, 9 verdes):
- **Mesmo `provedorId`:** `llm-gateway.test.ts` › "no máximo quatro chamadas com principal e reserva do mesmo `provedorId`…". Se a chave do contador de `donoDoAlvo` (`llm-gateway.ts:240`) fosse o `provedorId`, a queda deixaria o contador do principal em 2, o laço pararia e a reserva teria 0 chamadas, não 2. A asserção `[2, 2]` e as quatro linhas `[provedorId, modelo, peloProvedorDeReserva]` ficariam vermelhas.
- **Saída de reserva:** os quatro casos do `describe` "duas inválidas na reserva…" estão lá, citados pelo nome na tabela. Eles conferem a recusa, o `IA_SAIDA_INVALIDA`, os contadores `[2, 2]`, a reserva começando sem a correção do principal e o log `tentativas: 4`. O motivo é diferente nos dois sentidos (D55 no principal e citação na reserva, e o inverso), então trocar `problemasDaUltima` pelos problemas do principal ou da primeira chamada da reserva deixa o teste vermelho.
- **Prazo:** `prazo-com-tokens.int.test.ts` › "a quarta chamada, na reserva, estoura o prazo da execução", nos dois perfis. O teste usa o `ResilientAdapter` real, o `prazoPorTemporizador` e um prazo por chamada de 1.000.000 ms. Assim, só o sinal da execução corta a quarta chamada aos 140 s ou 60 s. A reserva com um sinal próprio deixaria `fimEm` indefinido e o teste vermelho, o que confirma a mutação feita à mão e descrita na autoconferência. O teste também confere o instante exato em que a quarta chamada começa (`quartaEm`), as contagens `[2, 2]` e a última linha `falhou` / `IA_TEMPO_ESGOTADO` / `peloProvedorDeReserva: true`.
- **Constante:** `prazo-da-execucao.test.ts` › "todo perfil tem prazo…" e "o Tutor (`rapido`) tem 60 s…". São os testes que já existiam, com os nomes que a tabela cita.
- **Mutações:** o diff de produção em `packages/*/src` é só o comentário de `packages/core/src/ia/prazo-da-execucao.ts`, sem nenhuma condição nova. A linha `**Sem mutação:**` com o motivo é legítima. A regra que esta tarefa prova é código da 4.0.
- **Restante:** nenhum `.skip`, `.only` ou teste comentado. Os adaptadores são todos falsos (`ReservaRoteirizada`, `LentoAdapter`) e o gateway é o real, então nenhum mock esconde a regra e nenhum provedor pago é chamado.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Em `packages/core/src/ia/llm-gateway.test.ts`, no `describe` "duas inválidas na reserva…", falta um caso que reinicie `reprovadaNaConferencia` quando a última chamada da reserva é JSON quebrado. Por exemplo: reserva `[juizo, 'não é json']`, ou principal `[juizo, IA_INDISPONIVEL]` com reserva `['não é json', 'não é json']`. Os dois devem dar `IA_SAIDA_INVALIDA`. Hoje uma mutação que deixasse `reprovadaNaConferencia` grudada em `true` (`llm-gateway.ts:477`) passaria em todos os casos novos, porque o caso do JSON quebrado tem o principal só caindo. Fica como cobertura extra do código da 4.0.
2. Em `apps/api/src/ia/prazo-com-tokens.int.test.ts`, `docs/infra.md` afirma "a linha dela com a estimativa (D14)", mas o teste do prazo só confere `estado` e `codigoDeErro` da última linha. Vale acrescentar a asserção dos tokens estimados nessa linha, ou tirar a frase do documento.
3. Na mesma asserção, `provedorId: null` na linha da reserva vem de `SEM_ENVIO_EXTERNO` no `LentoAdapter`, e não do comportamento da reserva. Um comentário de uma linha evitaria que quem ler entenda que a reserva grava `provedorId` nulo em produção.

Arquivos auditados:
- `tasks/prd-reserva-e-avaliacao/6_task.md`
- `packages/core/src/ia/llm-gateway.test.ts`
- `packages/core/src/ia/llm-gateway.ts`
- `packages/core/src/ia/prazo-da-execucao.ts`
- `apps/api/src/ia/prazo-com-tokens.int.test.ts`
- `docs/infra.md`

## revisor-geral · 2ª rodada · APROVADO · 2026-11-22 18:27:17 · `tasks/prd-reserva-e-avaliacao/6_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum
Recomendações:
- O caso da quarta chamada só exige que `tokensDeEntrada` seja maior que o pedido sem correção, em `apps/api/src/ia/prazo-com-tokens.int.test.ts:233`. O comentário da linha 230 diz que a estimativa leva a correção da resposta inválida anterior. Se o teste comparar com `tokensDoPedido(tarefa, entrada, correcao)` pelo valor exato, prova essa conta; hoje passaria com qualquer acréscimo.

Nesta rodada conferi o diff da árvore `47d3e170` para `11c2a187` e as sete recomendações da rodada anterior. Todas foram aplicadas, e o diff não toca código de produção além do comentário de `packages/core/src/ia/prazo-da-execucao.ts`.

As recomendações dos outros revisores que ficaram sem aplicar têm destino real na tabela de `tasks/prd-reserva-e-avaliacao/6_task.md`. O balde da reserva já está em `7_task.md`, nas linhas 28, 52 e 61 ("acrescente o limitador da reserva"). As duas recusas trazem motivo verificável. A mutação descrita (`reprovadaNaConferencia` grudada) confere com o código de `llm-gateway.ts:444-480`.

## test-engineer · 2ª rodada · APROVADO · 2026-11-22 18:27:38 · `tasks/prd-reserva-e-avaliacao/6_task.md`

VEREDITO: APROVADO

Cenários exigidos (2ª rodada, só o diff desde `47d3e170` e o que ele afeta):
- Recomendação (5) da 1ª rodada: com a primeira resposta da reserva reprovada na conferência e a última com JSON quebrado, a recusa fixa não pode sair. O que tem de sair é `IA_SAIDA_INVALIDA`. Era a cobertura que faltava para `reprovadaNaConferencia` grudada em `true`.
- Recomendação (2): a linha da quarta chamada, cortada pelo prazo, guarda a estimativa da D14. São três campos: o modelo da reserva, a saída no teto da tarefa e a entrada contada com a correção.
- O texto que mudou em `prazo-da-execucao.ts` e em `docs/infra.md` (pior caso e D55) bate com o código.

Cobertos:
- O caso novo de `packages/core/src/ia/llm-gateway.test.ts` ("o JSON quebrado na última chamada da reserva apaga a reprovação…"). Conferi a mutação lendo o código, sem rodá-la. Em `llm-gateway.ts:477`, a linha de hoje recalcula a marca a cada chamada. Com a mutação (`reprovadaNaConferencia || …`), a marca da primeira chamada continuaria valendo quando a segunda devolve JSON quebrado, e a `saidaDeReserva` (`:480`, `:557`) receberia os `problemas` do JSON. No Assistente isso não aparece, porque `propor-ferramenta.ts:649` olha os `problemas`. Já a do Tutor (`turno-do-tutor.ts:682`) não olha e entrega a recusa com `classificacao: 'pediu_resposta_pronta'`. Nesse caso o teste espera `IA_SAIDA_INVALIDA` e fica vermelho. Por isso o caso foi montado no Tutor, que é o lugar certo. O controle, com as duas respostas reprovadas, mostra que a resposta usada de fato reprova na conferência: o vermelho viria da cláusula, e não de um roteiro que nunca chega a ela. `reserva.chamadas === 2` confirma que as duas chamadas foram feitas.
- `apps/api/src/ia/prazo-com-tokens.int.test.ts:233-234`: a quarta linha agora confere `modelo: reserva-<perfil>`, `tokensDeSaida` igual ao `maximoDeTokensDeSaida` da tarefa e `tokensDeEntrada` maior que `tokensDoPedido(...)`. A entrada só passa desse mínimo se a correção da resposta inválida anterior foi somada. Nos dois perfis o modelo da reserva é diferente do modelo do principal (harness, linhas 27 e 224), então a asserção do modelo separa os dois destinos.
- A regex `sem coesão` (linha 2400) agora procura o texto de verdade e não um pedaço solto.
- Os dois arquivos passaram nesta árvore: `llm-gateway.test.ts` com 187 de 187 e `prazo-com-tokens.int.test.ts` com 9 de 9.
- A seção "Sem mutação" de `6_task.md` descreve as duas mutações feitas à mão e diz qual caso pega cada uma. Isso bate com o que conferi no código. O diff de `packages/*/src` continua sendo só comentário, então não falta bloco de mutação.
- Nenhum `.skip`, nenhum provedor pago: os adaptadores são roteirizados e `LentoAdapter`. Nenhum mock esconde a regra.

Bloqueantes: nenhum.

Recomendações:
- `prazo-com-tokens.int.test.ts:234`: `toBeGreaterThan(tokensMinimosDeEntrada())` aceita qualquer soma acima do pedido sem correção. Se um dia a correção contada ficar errada para mais, o teste não percebe. Daria para comparar com o valor exato, `tokensDoPedido` com a correção da resposta anterior, se houver um jeito barato de montá-la no harness. Não bloqueia: a D14 pede superestimar, e o que o teste precisa provar é que a correção entrou na conta.
