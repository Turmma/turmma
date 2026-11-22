# Achados das revisões — `tasks/prd-reserva-e-avaliacao/4_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-22 17:19:23 · `tasks/prd-reserva-e-avaliacao/4_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova ou alterada. A tarefa não tem migration nem schema. `ConsumoDeIa.peloProvedorDeReserva` (`packages/core/src/ia/consumo.ts:458`) só muda o tipo. A coluna `pelo_provedor_de_reserva` será gravada na 5.0.

Queries verificadas: a tarefa não cria query, repository nem endpoint.
- A linha de consumo que vem da reserva passa pelo mesmo `consumo()` do gateway. Ela vai ao `RegistroDeConsumo`, que grava com `requireEscolaId()` do contexto (`consumo.ts:215`). Nada do pedido entra no escopo.
- A conferência que já existia, escola do pedido igual à escola do contexto (`llm-gateway.ts:304-309`), roda antes do ramo da queda.
- O orçamento e a suspensão também são exigidos antes de `chamarAteValer`. A reserva não contorna nenhum dos dois.
- O log novo `ia.geracao.provedor_de_reserva` (`llm-gateway.ts:513`) leva só `tipo`, `escolaId`, `execucaoId` e `provedorId`. Nenhum desses campos permite ler dado de outra escola.

Teste de isolamento: não se aplica, porque a tarefa não traz módulo, repository nem endpoint novo. O escopo do registro já está coberto por `llm-gateway.test.ts:836` ("as portas em memória leem a escola do contexto (8.0)"), e o caminho da reserva usa a mesma porta.

Bloqueantes: nenhum.

Recomendações:
- Quando a 5.0 gravar `pelo_provedor_de_reserva` e a Operação passar a contar por ela, a 5.0 precisa entregar um teste de isolamento efetivo. O cenário: a contagem da escola A não inclui as linhas de reserva da escola B. Nenhum `@Unscoped()` deve entrar sem justificativa escrita.
- A vaga da reserva hoje não usa balde (`vagaDoAlvo` devolve `{}`, `llm-gateway.ts:514-516`), e a tarefa registra que o limitador próprio é da 7.0. Quando a 7.0 vier, o limite precisa ser por escola e por usuário, nunca global (regra 80). A conferência disso é do `infra-guardian`, mas fica anotado aqui porque o efeito cruza escolas.

## llm-integrator · 1ª rodada · APROVADO · 2026-11-22 17:19:53 · `tasks/prd-reserva-e-avaliacao/4_task.md`

VEREDITO: APROVADO

Perfis usados: nenhum novo. A reserva atende no mesmo perfil da tarefa que caiu no principal. Não há tarefa nova, e nenhuma classificação sobe de perfil. A elegibilidade da reserva é por tarefa, provedor e modelo (`reservaElegivel`, da 1.0).

Custo estimado por professor/mês: a tarefa não adiciona chamada no fluxo normal. Só reencaminha à reserva a chamada que o principal não atendeu, uma vez por execução. O teto por execução passa de 2 para 4 chamadas (duas por destino). A estimativa é uma conta feita aqui, sem medição:
- A premissa é a meta de 99,5% de disponibilidade (D27), ou seja, até cerca de 0,5% das chamadas na reserva.
- Para o mesmo volume de chamadas do professor, o custo extra é o diferencial de preço entre reserva e principal sobre esse 0,5%. Isso é desprezível.
- O pior caso é um dia inteiro de queda: a mesma carga do dia, ao preço da reserva. A linha de consumo agora grava preço, provedor e modelo da reserva, então a Operação consegue medir. A tabela real de preços da reserva é da 5.0 e da bancada.

Prompt versionado: sim. A tarefa não altera prompts, e as tarefas continuam com `prompt.versao` na medição.
Validação de schema: sim. A saída inválida da reserva repete na reserva, no máximo duas vezes, e depois vira `IA_SAIDA_INVALIDA`.
Aprovação humana no caminho: não se aplica. O gateway só roteia, e toda entrega continua nascendo pendente. A D36 sai pela regra fixa, antes de qualquer provedor.

Verifiquei em `.`:
- **Regra 30:** a reserva só é chamada pela porta (`LLMGateway`, em `createLLMGateway`), sem SDK novo fora de adaptador. Ela passa por `reservaElegivel` com a conferência da D62 (`soberaniaDaReserva`) e a aprovação por tarefa e modelo.
- **Queda:** `isQueda` cobre disjuntor, 5xx, conexão e prazo com o sinal vivo. Ficam de fora `rejeitada`, `limite`, `soberania`, `sem_vaga` e erro que não é da camada de IA.
- **Ordem:** a suspensão e a regra fixa vêm antes do ramo da queda, e os testes contam os dois provedores em zero.
- **Sem laço:** a reserva não volta ao principal e o contador é por destino. A reserva que falha termina como hoje.
- **Destino por chamada:** cada linha de consumo, a `medicao`, o preço e o rótulo leem o destino da chamada, não o do adaptador do principal. `peloProvedorDeReserva` vai na linha.
- **Log:** `ia.geracao.provedor_de_reserva` leva só tarefa, `escolaId`, `execucaoId` e `provedorId`. O teste verifica que entrada e chave não vazam (regra 20.9).
- **`IA_FALHA_FALSA`:** o formato é validado por regex. Só o `FakeAdapter` a lê, e a subida em `producao` a recusa, com os dois lados cobertos por teste.
- **Testes:** rodei `vitest --project unidade` em `packages/core/src/ia`, `llm-config.test.ts` e `infra/test/alertas.test.ts`. Passaram 22 arquivos e 1388 testes. Nenhum teste chama provedor pago, todos usam o falso ou o scripted. A tarefa não cria query, repository nem endpoint, então não há risco novo de tenancy.

Bloqueantes: nenhum

Recomendações:
- `IA_FALHA_FALSA` é recusada só em `AMBIENTE=producao`. Em `staging` ela passa, mas só afeta o falso, e o falso já é recusado em produção. Está coerente com o texto da tarefa. Vale o `infra-guardian` confirmar que o staging com falso é intencional.
- `medicao.tentativas` soma as chamadas das duas partes, mas `envio` e `provedorId` são os da última que respondeu. No Tutor, se o principal cai depois de receber o conteúdo e a reserva responde, só as linhas de consumo, por chamada, dizem que os dois receberam. A lista de compartilhamento do aluno (regra 20.19, 5.0) deve ler as linhas, nunca a `medicao`. Registre isso na 5.0.
- A reserva não reserva vaga no balde próprio e não tem o "sem vaga". Isso é da 7.0, e o docblock já diz. O freio hoje é o teto de 4 chamadas por execução mais o `exigirOrcamento` feito antes. Convém lembrar isso na 7.0 para o limite de custo por escola.
- A `4_task.md` registra a recomendação sobre contador por motivo da `rejeitada` (401). Confirme depois se `ia.chamada.erros` basta, ou leve para o `TODO.md`.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-22 17:19:58 · `tasks/prd-reserva-e-avaliacao/4_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa não toca `Nota`, `Correcao`, schema nem repository. Mexe só no roteamento do gateway, no adaptador falso, na config e nos testes. Todos com autor humano? sim, porque nenhum caminho novo foi criado e os que existem não mudaram.

Decisão autônoma sobre aluno: ausente. A reserva só troca quem atende a chamada de modelo. A saída continua entrando no mesmo fluxo de entrega pendente ou de turno supervisionado.

Aprovação registrada: ok. O gateway gera, e não publica nem aprova nada. A exceção da D47 continua só no Tutor. Este diff não cria outro caminho em que saída de IA chegue ao aluno sem aprovação. As tarefas de discursiva ou redação não existem em `TAREFAS_DE_IA` (`packages/shared/src/time/execucao.ts:26`), e nenhum prompt ou campo de nota foi criado (D55).

Supervisão do tutor: ok.
- **D36 continua antes de qualquer provedor.** A regra fixa é calculada em `packages/core/src/ia/llm-gateway.ts:330`, antes de `chamarAteValer`, onde vive o ramo da queda. O teste `turno-do-tutor.test.ts` › "com o principal fora e uma reserva aprovada para o Tutor…" prova zero chamadas no principal e na reserva, origem `regra_fixa` e nenhum envio.
- **A reserva só atende o Tutor com aprovação e conferência.** Ela precisa da aprovação por tarefa, `provedorId` e modelo, e da conferência da D62 da própria reserva (`reservaElegivel`, `llm-gateway.ts:334-340`).
- **Testes que travam o Tutor fora da reserva:** "aprovação só da geração", "a reserva só atende o que a subida conferiu na D62", e os três casos de modelo ou provedor trocado.
- **A linha de consumo do Tutor pela reserva** leva `alunoId` e `peloProvedorDeReserva: true`, sem `entrada` nem `saida`. O registro e o resumo do turno ficam no serviço do Tutor, que não muda.
- **Vigilância:** nada de inferência emocional nem de medida de comportamento entrou.

Autonomia declarada e visível: sim, sem mudança. O nível dos agentes e a tela de governança não foram tocados. A reserva não sobe a autonomia de nenhum agente.

Auditoria: melhora. `medicao` e cada linha de consumo passam a guardar o provedor, o modelo e a origem de quem de fato respondeu, e não mais os do principal (`llm-gateway.ts:686-700` e `:733-757`). Assim "o que a IA gerou" fica certo também quando a reserva atende. Gravar a coluna no banco é da 5.0.

Medir o professor: não se aplica. O diff não cria indicador de professor, ranking nem acesso a conversa.

Rodei os quatro arquivos de teste afetados (llm-gateway, turno-do-tutor, llm-config, fake-adapter) e todos passaram, 767 testes.

Bloqueantes: nenhum.

Recomendações:
- Quando a 5.0 gravar `pelo_provedor_de_reserva`, vale um caso na consulta de auditoria ou no dossiê (D61) que mostre "atendido pelo provedor de reserva" no item gerado. A escola costuma perguntar, na compra, por qual provedor passou a conversa do aluno.
- No dossiê de conformidade e na AIA do Tutor (D60), registrar que o Tutor pode ser atendido pela reserva só com relatório aprovado por tarefa, provedor e modelo, e com a D62 conferida. É o escopo negativo que a etapa de suspensão do agente precisa citar.

Arquivos relevantes:
- `packages/core/src/ia/llm-gateway.ts`
- `packages/core/src/ia/modelos-aprovados.ts`
- `packages/core/src/ia/tasks/turno-do-tutor.test.ts`
- `packages/core/src/ia/llm-gateway.test.ts`

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-22 17:20:28 · `tasks/prd-reserva-e-avaliacao/4_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo de pessoa. O único campo novo é `ConsumoDeIa.peloProvedorDeReserva`, um booleano operacional, só no tipo e no `InMemoryConsumo`. A coluna no banco fica para a 5.0. A linha de consumo do Tutor continua levando `alunoId`, que já estava no mapa, e o teste confirma que a linha não traz `entrada` nem `saida`.

Fora da tabela de dados do docs/lgpd.md: nada. A tarefa não tem migration nem dado pessoal novo.

Autorização por objeto: ok. A tarefa não cria rota, repository nem query. A linha de consumo pega `escolaId` e `alunoId` do contexto, como antes.

Logs: limpos. O log novo `ia.geracao.provedor_de_reserva` (`packages/core/src/ia/llm-gateway.ts`, em `desviarParaAReserva`) leva só `tipo`, `escolaId`, `execucaoId` e `provedorId`. O teste "o log do desvio leva a tarefa, os ids e o `provedorId`" passa um texto marcado na entrada e a chave de API da reserva, e confere que nenhum dos dois aparece no log. A falha falsa (`ProviderError` com uma classificação) não carrega dado nenhum.

Auditoria: não se aplica. A tarefa não tem leitura de dado de aluno por coordenação ou rede, exportação, alteração de nota, de permissão nem aprovação de saída de IA.

Envio externo:
- **O que sai:** o mesmo pedido montado pela tarefa, sem conteúdo novo. Vai para o provedor de reserva, e só se `reservaElegivel` liberar.
- **Quando a reserva é elegível:** precisa estar configurada, com a D62 conferida para ela (país BR, treinamento vedado, alcance e categorias) e aprovada para aquela tarefa, provedor e modelo.
- **Em produção, nada sai pela reserva:** `MODELOS_APROVADOS` só tem o `falso-reserva`, que é recusado com `AMBIENTE=producao`.
- **No interativo, falha fechada:** só o worker liga `soberaniaDaReserva`. Sem ela, a reserva conta como não conferida e o Tutor interativo não chega a ela.
- **Registro:** cada chamada grava o seu próprio destino (`chamada.destino`). Assim cada linha de `consumo_ia` leva o `envioExterno` e o `provedor` de quem recebeu a chamada. Isso vale também para o principal que estourou o prazo depois de o pedido sair: a linha dele, estimada, fica antes da linha da reserva.
- **Disjuntor aberto:** o pedido não saiu, então não há linha do principal, o que está correto.
- **Pergunta de fechamento:** `compartilhamento.ts` lê esse `provedor` linha a linha. Então o arquivo do titular mostra a reserva como destino, mesmo antes de a 5.0 gravar `pelo_provedor_de_reserva`.

Seed/fixture: sintético. Os ids são de fixture (`ALUNO_1`, `RESERVA`, `tema-marcado-do-professor`) e o relatório da reserva falsa é sintético. Não há nome nem documento real.

Testes: rodei `llm-gateway.test.ts`, `turno-do-tutor.test.ts`, `llm-config.test.ts` e `fake-adapter.test.ts`. Os quatro arquivos passaram, com 767 testes.

Bloqueantes: nenhum.

Recomendações:
1. O docblock de `descer` em `llm-gateway.ts` diz que o log do degrau nunca leva "a escola, a execução". O log novo da reserva leva `escolaId` e `execucaoId`. Os dois cumprem a regra 20.9, porque são ids, mas o mesmo arquivo fica com duas políticas de log. Vale alinhar o comentário, ou registrar por que o log da reserva precisa dos ids.
2. Quando a 5.0 gravar a coluna, vale tornar `DadosDoConsumo.peloProvedorDeReserva` obrigatório. Hoje ele é opcional e a falta vale `false`, como diz a divergência registrada. Isso evita que um caminho fora do gateway grave `false` calado para uma chamada que foi à reserva.
3. Um teste que fixe explicitamente que o caminho interativo da API, sem `soberaniaDaReserva`, nunca chama a reserva. Hoje isso vale pela falha fechada, mas a única prova é o teste unitário "a reserva só atende o que a subida conferiu na D62", não a montagem real do módulo da API.

## infra-guardian · 1ª rodada · REPROVADO · 2026-11-22 17:21:29 · `tasks/prd-reserva-e-avaliacao/4_task.md`

```
VEREDITO: REPROVADO
Caminho quente tocado: IA | tutor | fila
Rate limit: ok
Fila e prioridade: problema
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ausente
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes:
1. packages/core/src/ia/llm-gateway.ts:448, 456-463 e 468.
   Errado: a vaga do principal é reservada no balde dele com a estimativa (entrada mais o teto de saída). Ela só é
   acertada no sucesso (linha 468). Quando o disjuntor está aberto, a chamada falha sem sair (`semEnvio`). O catch
   desvia para a reserva e não devolve a vaga, que fica no balde por um minuto inteiro.
   Às 10h, com o principal caído e sessenta turmas no Tutor, cada turno ocupa no balde do principal uma vaga sem
   chamada nenhuma. O balde enche, e daí em diante `reservarVaga` (linha 448, fora do try) espera 8 s e lança
   `sem_vaga`. `sem_vaga` não é queda, então não vai à reserva. O turno do aluno termina indisponível justamente no
   cenário que a tarefa existe para cobrir. Nenhum teste prova a devolução: os testes da queda não olham o
   `acertar` do balde do principal.
   Correção exigida: antes de desviar, devolver a vaga da chamada do principal que caiu. No mínimo `acertar(0)`
   quando a chamada não saiu (`semEnvio`). Para 5xx, conexão e prazo, registrar a escolha na tarefa. Criar um teste
   com `LimiteDeMentira` de balde pequeno: N pedidos seguidos com o disjuntor do principal aberto chegam todos à
   reserva, nenhum termina `sem_vaga`, e os acertos do principal são 0.
2. packages/core/src/ia/llm-gateway.ts:504-506 (`vagaDoAlvo`).
   Errado: a chamada à reserva no ramo da queda não passa por limitador nenhum. Isso viola a regra 80, item 4
   ("toda chamada de modelo passa pelo limitador"). O `limiteDeTokensDaReserva` já chega ao gateway desde a 2.0 e
   não é lido. Também diverge da `techspec.md` §5, "O destino por chamada": lá o balde lê o destino da chamada, e a
   divergência não está na tabela da 4_task.md.
   Sem o balde da reserva por fila, um lote elegível (a geração, por exemplo) compete de igual com o interativo no
   contratado da reserva durante a queda. O item "lote nunca atrasa interativo" quebra no provedor de reserva.
   A 7.0 não fecha isso: a 7.1 e a tabela de testes dela só tratam o ramo sem vaga, não o ramo da queda. Hoje o
   ramo não é alcançável em produção (`MODELOS_APROVADOS` só tem o `falso-reserva`, recusado em `producao`), mas a
   lacuna fica sem dono.
   Correção exigida: escolher uma das duas.
   (a) Reservar a vaga da chamada à reserva em `limiteDeTokensDaReserva`, na fila do pedido e no balde
   `provedor:modelo` dela, com acerto pelo uso real e devolução na falha. O teste mostra o balde da reserva usado na
   fila do pedido e o do principal sem a chamada da reserva.
   (b) Registrar a divergência na 4_task.md e incluir na 7.1 e na tabela de testes da 7.0 o caso "queda do
   principal: a reserva reserva no balde dela, por fila; sem vaga ali, `sem_vaga`".
Recomendações:
- O prazo do Tutor pode dobrar: o prazo do `rapido` no principal e mais um prazo inteiro na reserva. A 6.0 ("dentro
  do prazo da execução") precisa provar o teto total para o turno interativo.
- Contar `rejeitada` (401) por motivo continua pendente, conforme a tabela de recomendações da tarefa.
```

Os seis testes unitários da tarefa passam (828 casos).

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-22 17:21:29 · `tasks/prd-reserva-e-avaliacao/4_task.md`

VEREDITO: REPROVADO
Escopo: invadiu tarefa futura
Aderência à Tech Spec: ok (o comportamento bate com a §5, "A chamada" (2) a (4) e "O destino por chamada"; a divergência do `peloProvedorDeReserva` opcional está registrada na `techspec.md`)
Portão local: carimbo válido

**Bloqueantes:**

1. A tarefa fez parte da 6.0 sem avisar ninguém. O próprio `4_task.md:74` deixa fora do escopo "a repetição e o prazo das quatro (6.0)". Mesmo assim, a 4.0 entregou o código e os testes que o `6_task.md` atribui à 6.0, e não anotou isso em lugar nenhum:
   - **O contador por destino, que é a subtarefa 6.1.** Ficou em `packages/core/src/ia/llm-gateway.ts:78` (`CHAMADAS_MAXIMAS_POR_DESTINO`) e na linha 446 (`while (chamadas[donoDoAlvo(alvo)] < ...)`). Ele substitui o `TENTATIVAS_MAXIMAS`.
   - **A queda na repetição do principal indo à reserva sem a correção, que é a subtarefa 6.2.** Ficou em `llm-gateway.ts:462` (`correcao = undefined`).
   - **Dois cenários da tabela da 6.0.** Estão em `packages/core/src/ia/llm-gateway.test.ts:2293` ("saída inválida do principal não é queda") e na linha 2301 ("no máximo quatro chamadas", que é o "Quatro e para" do `cenarios.md`, sem a variante de mesmo `provedorId`).
   - **A 6.3 já funciona de fato.** Em `llm-gateway.ts:477`, `problemasDaUltima` passa a guardar os problemas da última chamada da reserva. Nenhum teste cobre isso.

   Uma parte era inevitável: para "a inválida da reserva repete nela" (subtarefa 4.2), a reserva precisa de duas chamadas próprias, e isso exige o contador por destino. Deixar a correção do principal chegar à reserva também seria errado pela spec. O problema é ninguém ter registrado. O `6_task.md` continua listando 6.1 e 6.2 como pendentes, e a tabela de testes dele está vazia para casos que já existem. Quem pegar a 6.0 vai reimplementar ou revisar código que já entrou, e sem saber disso.

   **Correção exigida**, sem mexer no código:
   - acrescentar uma linha à tabela "Divergências resolvidas nesta tarefa" do `4_task.md`, dizendo que 6.1, 6.2 e os dois casos acima entraram na 4.0 porque a 4.2 exige que a reserva repita;
   - reportar ao Arquiteto ou Orquestrador para atualizar o `6_task.md` e o `tasks.md`: 6.1 e 6.2 marcadas como feitas na 4.0, com os casos já escritos na coluna "Caso". A 6.0 fica com 6.3 (o teste dos `problemas` da reserva), 6.4 (o prazo) e a variante de mesmo `provedorId`.

**Recomendações:**
- **Limitador da reserva no ramo da queda.** Hoje a chamada que cai na reserva não passa por limitador nenhum (`llm-gateway.ts:504`, `vagaDoAlvo` devolve `{}`), e o docblock diz que isso é da 7.0. Só que a 7.1 fala apenas do ramo sem vaga. Vale deixar explícito no `7_task.md` que o balde da reserva vale também para a queda, senão entre a 4.0 e a 7.0 a reserva roda sem teto (regra 80, que é da área do `infra-guardian`).
- **`IA_FALHA_FALSA=reserva:...` sem reserva configurada.** Hoje é ignorada em silêncio (`packages/core/src/config/llm-config.ts:177`, `llm-gateway.ts` `opcoesDoFalso`). Recusar a subida evita um ensaio de queda que não testa nada.
- **Docblock do `descer`.** Ele diz "nunca a escola, a execução". O log novo `ia.geracao.provedor_de_reserva` leva `escolaId` e `execucaoId`, o que a §7 permite. Vale ajustar o texto para não parecer que existem duas regras de log no mesmo arquivo.
- **Teste do alerta em `infra/test/alertas.test.ts`.** Ele refaz o agrupamento do Prometheus em JavaScript a partir do `by (...)`. É aceitável, mas prova o agrupamento lido da expressão, não a avaliação do alerta. Se ela vier a usar `without` ou `sum by`, o teste não pega.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-22 17:21:36 · `tasks/prd-reserva-e-avaliacao/4_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Caminho feliz:** o principal cai (disjuntor, 5xx, conexão recusada, prazo com o sinal vivo) e a reserva elegível atende uma vez. A saída e a linha de consumo são da reserva, com preço, provedor, modelo e `peloProvedorDeReserva` dela, e a `medicao` também é dela.
- **Bordas:**
  - O prazo com o sinal já abortado não vai à reserva.
  - `rejeitada`, saída inválida do principal, `MATERIAL_INSUFICIENTE` e erro que só parece de IA não são queda.
  - Os dois provedores fora: uma chamada só à reserva, sem voltar ao principal.
  - A reserva falha depois de sair, e a linha estimada leva o preço dela.
  - A saída inválida da reserva repete na reserva, sem a correção do principal, e são no máximo quatro chamadas.
  - A reserva recusa por `limite`: não desce ao modelo menor do principal nem usa o balde dele.
  - Os dois fora por disjuntor: uma linha só, de "nada enviado".
  - Sem reserva configurada, a queda termina como na X6.
- **Permissão:**
  - Suspensão antes da queda.
  - A D36 sai pela regra fixa, sem provedor.
  - O Tutor sem aprovação, ou sem a conferência da D62 da reserva, não chega à reserva.
  - Modelo do `rapido` trocado, a mesma troca na classificação, ou aprovação de outro `provedorId`: indisponível, sem chamar a reserva.
  - `IA_FALHA_FALSA` é recusada em produção.
- **Isolamento:** não há repository, query nem endpoint novo. O log e a linha levam o `escolaId` do contexto.
- **Infra:** um disjuntor por `provedor`, e o alerta "Provedor de IA fora" agrupado por `provedor`.

**Cobertos:** as 16 linhas da tabela "Testes que provam a regra" têm teste com o nome citado. Cada item juntado por ponto e vírgula foi conferido sozinho:
- Linhas 47, 49, 51, 52, 53, 54, 56 e 57: um teste por item.
- Linha 60: as quatro partes (o formato, a recusa em produção, `fake-adapter` › "a falha sob comando" e `openai_compat` sem efeito).

O resto:
- Os 35 blocos de mutação batem com as cláusulas condicionais do `git diff`, e os dois motivos são válidos.
- As asserções olham o resultado: linhas de consumo, chamadas contadas por adaptador, o degrau, o log e a `medicao`.
- Não há `.skip`, `.only` nem teste comentado.
- A IA nos testes usa `ScriptedAdapter`, `FakeAdapter` ou `startFakeLlamaServer`, nunca provedor pago.
- Rodei os seis arquivos: 811 testes nos cinco do `packages/core` e 17 em `infra/test/alertas.test.ts`, todos passando.

**Bloqueantes:**

1. **`packages/core/src/ia/llm-gateway.ts:837`: a montagem da resiliência da reserva não tem teste nem bloco.**
   - **O problema:** em `createLLMGateway`, o trecho `new ResilientAdapter(daReserva, politica)` é cláusula nova desta tarefa: a 4.3 diz "o disjuntor de cada adaptador no seu `provedor`". Trocá-lo por `daReserva` puro deixa a suíte verde.
   - **Por que nenhum teste pega:** dos quatro testes de `createLLMGateway` em "pela configuração", três só fazem a reserva atender (`principal:5xx`, `openai_compat`, o log) e no `reserva:5xx` ela nem é chamada. Nenhum passa pela resiliência dela.
   - **Por que a linha 58 não basta:** o teste dela (`resilient-adapter.test.ts` › "o principal e a reserva, no mesmo medidor…") monta os dois `ResilientAdapter` à mão. Ele prova o rótulo por `identidade`, que já existia desde a 3.0, e não que o gateway de produção embrulha a reserva.
   - **O risco:** com a mutação, a reserva roda sem prazo, sem repetição e sem disjuntor. Uma reserva lenta prende o Tutor na manhã de segunda (regra 80, item 4).
   - **Correção exigida:**
     - Um teste em `llm-gateway.test.ts` › "pela configuração" com `IA_FALHA_FALSA: 'principal:5xx'` e a reserva `openai_compat` num `startFakeLlamaServer` que responde 429 sem `Retry-After`.
     - Ele confere `servidor.pedidos` com 2: a única repetição do `ResilientAdapter`, que só repete 429 e conexão recusada (`resilient-adapter.ts:108`).
     - Alternativa: um medidor nas portas e, depois das falhas que abrem o disjuntor, `ia.disjuntor.aberto{provedor=<id da reserva>}` em 1.
     - E o bloco de mutação: `adaptador: new ResilientAdapter(daReserva, politica)` → `adaptador: daReserva`.

**Recomendações:**
- **Concorrência.** O destino agora é guardado por chamada (`alvo` e `gasto` são locais), mas nenhum teste roda duas execuções ao mesmo tempo no mesmo gateway, uma desviada e outra não. Um teste com `Promise.all` e asserção sobre `provedorId` e `peloProvedorDeReserva` de cada linha protegeria contra quem um dia puser o destino na instância. Hoje não há cláusula para mutar, então não bloqueia.
- **Docblock.** O de `descer` diz "Nunca a escola, a execução", e o log novo `ia.geracao.provedor_de_reserva` leva `escolaId` e `execucaoId`. Vale uma linha dizendo por que o desvio leva os ids e os outros degraus não, para o próximo revisor não achar que é divergência.
- **Teste do alerta.** `infra/test/alertas.test.ts` simula o agrupamento lendo só o primeiro `by (...)` da expressão. Se a expressão ganhar um segundo agrupamento, o teste lê o errado; vale ancorar na agregação de fora.
- **Lote.** A reserva que falha no lote (`JobAdiadoError(provedor)`, citada na 4.2) fica para a 5.0, como a tabela diz. Vale confirmar que a 5.0 tem a linha dela.

Arquivos relevantes:
- `packages/core/src/ia/llm-gateway.ts`
- `packages/core/src/ia/llm-gateway.test.ts`
- `packages/core/src/ia/resilient-adapter.test.ts`
- `tasks/prd-reserva-e-avaliacao/4_task.md`

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-22 17:48:14 · `tasks/prd-reserva-e-avaliacao/4_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova ou alterada nesta rodada. O diff de 9bf1212c a 27a42a13 não traz migration nem schema.

Queries verificadas: nenhuma query, repository ou endpoint novo.
- `packages/core/src/ia/llm-gateway.ts:458` e `:508-510`: `devolverAVaga` só zera a vaga reservada no limitador de tokens, que é separado por modelo e não por escola. Não lê nem grava dado de escola. A linha de consumo continua levando o `escolaId` e o `execucaoId` do próprio pedido, sem mudança.
- `llm-gateway.ts:688`: muda só o comentário, que agora diz que o desvio à reserva registra a escola e a execução. São ids, sem dado pessoal. Isso já valia na rodada aprovada e o código não mudou.
- `infra/test/alertas.test.ts:309-312`: a regra de alerta agrupa por `provedor`, `modelo` e `perfil`, sem rótulo de escola.

Teste de isolamento: não se aplica. A rodada não cria módulo, tabela nem endpoint. O teste novo de duas execuções ao mesmo tempo (`packages/core/src/ia/llm-gateway.test.ts`, "duas execuções ao mesmo tempo no mesmo gateway") prova que o destino de uma chamada não passa para a linha de consumo da outra.

Correções exigidas na rodada anterior: nenhuma, então não havia o que conferir.

Bloqueantes: nenhum

Recomendações:
- `packages/core/src/ia/llm-gateway.test.ts`, teste de duas execuções ao mesmo tempo: as duas execuções usam a mesma escola, de `pedidoDaFerramenta()`. Fazer uma delas usar outro `escolaId` e verificar o `escolaId` de cada linha de consumo. Isso provaria também que a linha de uma execução não grava a escola da outra quando o gateway é compartilhado.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-22 17:48:30 · `tasks/prd-reserva-e-avaliacao/4_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. Esta rodada muda só a contabilidade do balde de tokens do gateway, os testes e a documentação. Não há migration, DTO, rota nem campo de pessoa.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. Nenhuma rota nem repository mudou.

Logs: limpos.
- `devolverAVaga` (`packages/core/src/ia/llm-gateway.ts:508-510`) não grava log nenhum.
- A mudança no comentário de `descer` (linha 688) só descreve o que o log já fazia. O log do desvio, em `desviarParaAReserva` (linha 522), leva `tipo`, `escolaId`, `execucaoId` e `provedorId`. São só ids: nenhum texto de entrada, pedido ou chave. O teste da rodada 1 ("o log do desvio leva a tarefa, os ids e o `provedorId`...") continua cobrindo isso.
- Os logs de degrau (linhas 691-692) seguem só com `tipo`, `modeloId` e `codigo`.

Auditoria: não se aplica. Nesta rodada não há leitura de dado de aluno por coordenação ou rede, nem exportação, alteração de nota ou de permissão, ou aprovação de saída de IA.

Envio externo: o destino não mudou. É o mesmo provedor de reserva da rodada 1, liberado pela mesma função de elegibilidade (D62 conferida e aprovação por tarefa e modelo).
- `acertar(0)` só roda com `semEnvio`, ou seja, quando o pedido não saiu. Por isso não esconde envio que aconteceu.
- A chamada que pode ter saído (5xx, conexão, prazo) continua contando no balde, e um teste prova isso.
- O registro por execução ficou mais forte. O teste novo com `Promise.all` (llm-gateway.test.ts, diff linhas 99-114) prova que, com duas execuções ao mesmo tempo no mesmo gateway, cada linha de consumo leva o `provedorId` e o `peloProvedorDeReserva` da sua própria chamada. É isso que deixa o sistema responder "para onde isso já foi enviado" por execução, sem misturar destinos.

Seed/fixture: sintético. São `tema-que-cai`, `outro-tema`, `execucao-que-cai`, `m-reserva`, um servidor falso local (`startFakeLlamaServer`) e adaptadores roteirizados. Nenhum teste chama provedor pago.

Pergunta de fechamento: responde. O registro de consumo por execução grava o destino de cada chamada, inclusive com desvio concorrente. O que foi devolvido ao balde não é envio, e o código não o trata como envio.

Bloqueantes: nenhum.

Recomendações:
- No teste do 429 da reserva `openai_compat` (diff linhas 123-141), conferir também a linha de consumo da falha, com `provedorId: RESERVA`, `envioExterno: true` e `estado: 'falhou'`. Hoje ele confere só o código e o número de pedidos, e a linha de falha é o rastro de envio que a secretaria pediria.
- No teste das duas execuções simultâneas, conferir que só o `execucaoId` desviado aparece no evento `ia.geracao.provedor_de_reserva`. Isso fecha o rastro de log por execução do mesmo jeito que o consumo já fecha.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-22 17:48:30 · `tasks/prd-reserva-e-avaliacao/4_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum neste diff. A mudança fica toda na camada de IA (o gateway, os testes e os documentos da tarefa) e não toca `Nota`, correção, job de nota, seed nem importação. Todos com autor humano? Sim, porque nada mudou desde a rodada 1, que foi aprovada.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. A vaga devolvida decide só quantos tokens ficam no balde. Não muda o fluxo da entrega pendente nem a aprovação de nenhum agente, e a exceção da D47 continua só no tutor.
Supervisão do tutor: ok. O desvio à reserva continua passando pelo mesmo gateway. Registro, resumo e escopo da turma ficam no módulo do tutor, que este diff não toca. O caminho de desvio e retentativa em `packages/core/src/ia/llm-gateway.ts:455-461` não abre nenhum uso do tutor que o professor não consiga ver.
Autonomia declarada e visível: sim, sem alteração.
Bloqueantes: nenhum
Recomendações:
- `packages/core/src/ia/llm-gateway.ts:688`: o novo texto do `descer` diz que o desvio à reserva leva a escola e a execução no log. Isso cabe na regra 20, item 9, porque são ids e não há conteúdo. Mesmo assim, vale um teste que garanta que o evento de desvio nunca leva o conteúdo do pedido. Quem decide isso é o `privacy-guardian`; não é assunto da regra 70.
- Os itens 6 (auditoria), 7 (supervisão sem vigilância), 8 (sem nota em discursiva e redação) e 9 (medir o professor sem vigiar) não se aplicam a este diff. Procurei por nota, aprovação, tutor, professor, redação, discursiva e ranking nas linhas alteradas, e só apareceram nomes de fixture de teste (`APROVADA_A_GERACAO`, `aprovados`), que se referem à aprovação do modelo pela soberania e não à aprovação de saída de IA.
- Fotos da tela: não vieram, e a tarefa não tem tela.

## llm-integrator · 2ª rodada · APROVADO · 2026-11-22 17:48:48 · `tasks/prd-reserva-e-avaliacao/4_task.md`

VEREDITO: APROVADO
Perfis usados: nenhum perfil novo. A tarefa 4.0 muda a reserva e o desvio dentro do gateway. Cada tarefa mantém o perfil que já declarava, e a reserva é atendida pelo mesmo perfil da tarefa (`reservaElegivel`, com `perfil` no pedido).
Custo estimado por professor/mês: nenhuma chamada nova de modelo por uso. A correção só devolve ao balde a estimativa de vaga de chamada que não saiu. O custo extra é só o das chamadas que a queda do principal desvia para a reserva, no máximo uma por geração (o limite de quatro chamadas por execução continua). Esse custo cai nas linhas de consumo de cada geração, no `custoMicros` da escola (D14). A `techspec.md` §5 aponta o relatório de custo por professor e por aluno por mês (linha 168). Isso é o que a 8.0 e o relatório fecham, não esta rodada.
Prompt versionado: sim, não mudou.
Validação de schema: sim, não mudou. A saída inválida segue repetindo no provedor que respondeu e não conta como queda.
Aprovação humana no caminho: não se aplica. O diff não toca nota, família nem entrega.

Bloqueantes: nenhum.

A correção exigida era nenhuma. Auditei o diff desde a rodada anterior e o que ele afeta.

- **`devolverAVaga`** (`packages/core/src/ia/llm-gateway.ts:458` e `:508-510`)
  - Só devolve a vaga (`acertar(0)`) quando o erro é `LLMError` com `semEnvio`, ou seja, `sem_vaga` ou disjuntor aberto, que garantem que nada saiu.
  - O 5xx, a conexão e o prazo mantêm a estimativa, o lado seguro da D14.
  - Não há acerto em dobro: o caminho de sucesso é outro, e `reserva.acertar` só roda lá.
  - `vagaDoAlvo` lança antes do `try`, então não há vaga a devolver nesse caso.
- **Falha do ajuste no Redis:** `#ajustar` (`token-limiter.ts:173-181`) engole o erro. Se o ajuste falhar, a chamada não vira erro cru para o aluno e o desvio à reserva continua. Isso cumpre a regra 80, item 4: nunca erro cru ao aluno.
- **Testes novos** (`llm-gateway.test.ts:923-939`, `:2374-2410`, `:2501-2519`)
  - `LimiteComBalde` enche de verdade, então o teste de cinco pedidos com disjuntor aberto quebraria sem a correção: terminariam `sem_vaga` e `limite.acertos` não seria `[0,0,0,0,0]`.
  - O teste do 5xx prova que a estimativa é mantida (`acertos` vazio).
  - O teste de duas execuções com `Promise.all` prova que o destino da linha de consumo é por chamada, sem estado compartilhado entre execuções.
  - O teste da reserva `openai_compat` usa servidor falso local (`startFakeLlamaServer`) e o adaptador falso.
- **Regra 30, item 3:** nenhum teste chama provedor pago.
- **`alertas.test.ts`:** a expressão `max by (provedor, modelo, perfil) (ia_disjuntor_aberto)` agora é verificada inteira, o que fecha a brecha de uma agregação diferente passar despercebida.
- **Log do desvio** (comentário de `descer`): leva só ids, tarefa e `provedorId`. Não leva entrada nem chave, conforme a regra 20, item 9.

Recomendações (não bloqueiam):
1. `llm-gateway.ts:530-548`, `chamarComDegrau`: se o 429 desce ao modelo menor e o menor falha com `semEnvio` (disjuntor aberto), `menor.reserva` não é devolvida, porque `devolverAVaga` só enxerga `vaga.reserva`. Fica a estimativa do menor até o fim do minuto. O caso é raro e o lado é o seguro, mas vale um teste ou uma devolução também lá.
2. Sem ajuste de produção, para a 7.0: a reserva ainda não tem balde próprio (`vagaDoAlvo` devolve `{}`). A `7_task.md` já registra a queda na 7.1.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-22 17:49:13 · `tasks/prd-reserva-e-avaliacao/4_task.md`

VEREDITO: APROVADO
Caminho quente tocado: IA
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok (não se aplica: a tarefa não cria query)
Degradação de IA: ok
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum

As duas correções da 1ª rodada foram feitas:

1. **A vaga do principal que caiu sem sair voltou ao balde.** No catch de `chamarAteValer`, `devolverAVaga` roda antes de o pedido ir à reserva e faz `acertar(0)` quando o erro é `semEnvio`. Está em `packages/core/src/ia/llm-gateway.ts:458` e `:508-510`.
   - A escolha para 5xx, conexão e prazo ficou registrada: essas chamadas mantêm a estimativa no balde (D14). O registro está na tabela de divergências da `4_task.md` e na `techspec.md` §5.
   - O teste pedido existe: `LimiteComBalde(2)`, cinco pedidos com o disjuntor aberto, cinco chamadas à reserva, nenhum `sem_vaga` e acertos `[0,0,0,0,0]`.
   - Há também o teste do 5xx, que confere `acertos` vazio.
   - As mutações `void erro` e "devolve em todo `LLMError`" estão declaradas.

2. **A falta de limitador na chamada à reserva ficou registrada (opção b).** O registro está em três lugares:
   - a linha nova na tabela de divergências da `4_task.md`;
   - a 7.1 da `7_task.md`, com a linha "queda do principal: a reserva reserva no balde dela, por fila; sem vaga ali, `sem_vaga`" na tabela de testes;
   - a `techspec.md` §5.

O que mais mudou também está certo:
- O teste de `Promise.all` com duas execuções prova que o destino vale por chamada.
- O teste da reserva `openai_compat` prova que ela passa pelo `ResilientAdapter`.
- O teste do alerta agora confere a expressão inteira.

Rodei `llm-gateway.test.ts` (181 testes) e `infra/test/alertas.test.ts` (17 testes) e todos passaram. Nenhum chama provedor pago: são adaptadores falsos e um servidor local falso.

Recomendações:
- **Vaga do menor no caso de borda.** O principal recebe 429 e o pedido desce ao menor. Se o menor cair com o disjuntor aberto (`semEnvio`), o `devolverAVaga` devolve a vaga do principal, cuja chamada saiu e recebeu 429. A vaga do menor (`menor.reserva`) fica no balde. É raro e o erro vai para o lado seguro. Vale registrar no `achados/` para a 7.0 decidir quando unificar a vaga nos dois ramos (`llm-gateway.ts:546-552` junto com `:458`).
- **Pendência na 7.0.** A regra 80, item 4, fica de fato pendente no ramo da queda até a 7.0. A 7.0 precisa pousar na mesma spec, antes do merge na `develop`, e não ficar para depois. Vale a Mesa conferir isso no fechamento.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-22 17:49:28 · `tasks/prd-reserva-e-avaliacao/4_task.md`

VEREDITO: APROVADO
Escopo: respeitado. A parte da 6.0 que entrou nesta tarefa agora está declarada.
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade e alvo valem para o código atual)
Bloqueantes: nenhum

**A correção exigida na rodada anterior foi feita.** A tabela de divergências do `4_task.md` ganhou a linha 102. Ela diz que a 6.1 e a 6.2 (o contador por destino e a repetição na reserva sem a correção do principal) entraram na 4.0 porque a 4.2 exige que a reserva repita, e cita os casos que já provam isso. Diz também o que fica para a 6.0: a 6.3, a 6.4 e o caso em que principal e reserva têm o mesmo `provedorId`. Atualizar o `6_task.md` e o `tasks.md` é trabalho do Orquestrador, como a nota da Mesa definiu. Por isso não conta contra esta tarefa.

**O que mudou desde a rodada anterior está registrado e coberto.**
- **Vaga devolvida ao balde:** `devolverAVaga`, em `packages/core/src/ia/llm-gateway.ts:508`, devolve a vaga quando a chamada falha sem ter saído, como manda a `techspec.md` §5. A decisão também está como divergência no `4_task.md:103`. Conferi os caminhos de erro e não há acerto duplo: o `sem_vaga` do principal é lançado antes do `try`, e o `descerPorLimite` não lança erro.
- **Testes novos:** o balde que enche de verdade (`LimiteComBalde`), o 5xx que mantém a estimativa, as duas execuções em `Promise.all` e a reserva `openai_compat` que repete o 429 uma vez só. Cada um olha o resultado e tem mutação registrada.
- **Limitador da reserva:** passou para a 7.0, e a `techspec.md` §5 e o `7_task.md` (7.1 e a linha nova da tabela de testes) registram isso. O alerta em `infra/test/alertas.test.ts` agora confere a expressão inteira.

Recomendações:
- O `6_task.md` ainda lista a 6.1 e a 6.2 sem marcar, e o `tasks.md` ainda não diz que elas entraram na 4.0. O Orquestrador precisa atualizar os dois antes de a 6.0 começar, senão a 6.0 refaz o que já está pronto.
- Há um caso raro no `llm-gateway.ts:458`, em que a vaga errada volta ao balde:
  - **Quando acontece:** o principal recusa com 429 (`limite`), o gateway desce ao modelo menor, e o disjuntor do provedor abre entre as duas chamadas.
  - **O que dá errado:** `devolverAVaga` devolve a vaga do principal, que chegou a sair com o 429. A vaga do menor fica presa até vencer.
  - **Por que não bloqueia:** o 429 não abre o disjuntor, então isso só acontece quando uma chamada paralela o abre no meio. O balde erra para o lado de sobrar estimativa.
  - **O que fazer:** se valer a pena, `chamarComDegrau` pode devolver a vaga que realmente usou junto com o erro. A 7.0 mexe nesse trecho e é um bom momento.
- O docblock de `descer`, em `llm-gateway.ts:688`, é longo demais para uma linha só. A justificativa de o desvio levar escola e execução cabe melhor no docblock de `desviarParaAReserva`.

Arquivos citados:
- tasks/prd-reserva-e-avaliacao/4_task.md
- tasks/prd-reserva-e-avaliacao/6_task.md
- packages/core/src/ia/llm-gateway.ts

## test-engineer · 2ª rodada · APROVADO · 2026-11-22 17:49:34 · `tasks/prd-reserva-e-avaliacao/4_task.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- A correção exigida na 1ª rodada: a reserva `openai_compat` passa pelo `ResilientAdapter`. O teste tem que falhar se a reserva for montada sem ele, e precisa de um bloco de mutação.
- A cláusula nova `devolverAVaga`, por dois lados. Quando o principal cai sem enviar (disjuntor aberto, `semEnvio`), a vaga volta ao balde. Quando a chamada pode ter saído (5xx), a estimativa fica no balde.
- Concorrência real: duas execuções ao mesmo tempo no mesmo gateway, uma desviada à reserva e a outra não.
- A asserção do alerta "Provedor de IA fora" sobre a expressão inteira.
- Cada linha nova da tabela de testes citada pelo nome de um teste que existe.

**Cobertos:**
- **Correção 1, feita.** O teste "a reserva `openai_compat` sai com a resiliência do `ResilientAdapter`" está em `packages/core/src/ia/llm-gateway.test.ts`, no bloco "pela configuração".
  - Ele usa `IA_FALHA_FALSA: 'principal:5xx'` e um servidor falso que responde 429 sempre. Confere `servidor.pedidos` igual a 2 e o erro com `motivo: 'limite'`.
  - Sem o `ResilientAdapter`, o adaptador cru faz um pedido só e não lança o `LLMError` com `limite`. As duas asserções quebram.
  - O bloco de mutação `new ResilientAdapter(daReserva, politica)` → `daReserva` está no documento.
- **`devolverAVaga`** está em `packages/core/src/ia/llm-gateway.ts:508` e tem dois testes e dois blocos.
  - **Vaga devolvida.** O `LimiteComBalde(2)` enche de verdade e recebe cinco pedidos. Sem a devolução, o terceiro pedido ficaria sem vaga. O teste confere 5 chamadas na reserva, os acertos `[0,0,0,0,0]` e 5 linhas concluídas pela reserva.
  - **Estimativa mantida no 5xx.** O teste confere acertos `[]`. A mutação que tira o `semEnvio` da condição passaria a devolver `[0]`, e o teste pegaria. O `[]` tem sentido aqui porque a reserva não reserva vaga (`vagaDoAlvo` devolve `{}`), então nenhum outro acerto entra na lista.
- **Concorrência de verdade.** O `PrincipalPorTema` segura as duas chamadas até as duas chegarem, e o teste roda com `Promise.all`. Ele confere o destino na linha de consumo de cada execução (`execucaoId`, `provedorId`, `peloProvedorDeReserva`) e uma chamada só na reserva.
- **Alerta.** `infra/test/alertas.test.ts` agora confere a expressão inteira, `max by (provedor, modelo, perfil) (ia_disjuntor_aberto)`, e lê os rótulos ancorado em `^max by`.
- **Documento.** As três linhas novas da tabela de testes em `tasks/prd-reserva-e-avaliacao/4_task.md` citam testes que existem. A seção "Mutações" fecha em 38 blocos, sem linha faltando.
- **Pendência registrada.** A divergência de a reserva ainda não ter limitador no ramo da queda (regra 80.4) está na `techspec.md` §5 e virou linha de teste na `7_task.md` (7.1).
- **Suítes.** `llm-gateway.test.ts` passou com 181 de 181 e `alertas.test.ts` com 17 de 17. Não há `.skip`, e todos os testes usam adaptador falso ou servidor falso, nunca provedor pago.

**Bloqueantes:** nenhum.

**Recomendações:**
- O `devolverAVaga` roda antes do `if (reserva === undefined) throw erro`, em `llm-gateway.ts:458`. Por isso a vaga volta ao balde também quando o disjuntor está aberto e não há reserva configurada, o que muda o comportamento da X6. A mudança é correta, porque nada foi enviado, mas nenhum teste a prende. Se alguém mover a devolução para depois do `throw`, a suíte continua verde. Vale um caso "sem reserva, disjuntor aberto: acertos `[0]`".
- No teste do 5xx, a asserção `acertos` igual a `[]` prova a regra pela ausência de acerto. Expor o `usado` do `LimiteComBalde` e conferir que a estimativa continua lá deixaria o resultado explícito.
