# Achados das revisões — `tasks/prd-reengenharia-continuacao/5_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-16 01:54:43 · `tasks/prd-reengenharia-continuacao/5_task.md`

VEREDITO: APROVADO

Tabelas verificadas: a tarefa não cria tabela nem migration. Conferi `execucao_agente` (tem `escola_id` e `ano_letivo_id`) e `job_registro` (a escola vem da linha do outbox, e `ia.executar` tem `escopo: 'escola'`). O payload do job é `z.strictObject({ execucaoId: z.uuid() })`: só um UUID, sem `escolaId` e sem texto livre.

Queries verificadas:
- `ExecucaoRepository.paraIniciar`, `marcarRodando`, `concluirRodando` e `marcarFalhou` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/execucao.repository.ts:45-102`): a escola vem do `requireEscolaId()` do contexto, que o `JobExecutor` monta a partir de `job_registro.escola_id`. Nenhum método recebe a escola por argumento. Os dois `leftJoin` de quem pediu também se prendem a `execucaoAgente.escolaId`.
- A entrada do repository saiu de `REPOSITORIES_SEM_ESCOPO`, e a guarda passa (`repositories-com-escopo.test.ts`: 55 casos verdes junto com `request-sessao.test.ts`).
- `ExecucaoProcessor` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/execucao.processor.ts:81-138`): o contexto de quem pediu é montado com a escola do job e a pessoa da linha. A execução é relida por `ExecucaoDaSessaoRepository.paraExecutar`, com escopo de escola, ano letivo e `solicitada_por`.
- `ExecucaoScheduler.agendar`: grava a execução e o job pelo `enfileirarUmaVez`, na mesma transação, com a escola do contexto da requisição.
- O encaminhamento direto da D36 em `tutor.service.ts` usa o mesmo repository, com escopo do contexto.
- `requestSessao` com `sessaoId` opcional: os três chamadores que precisam da sessão (sair, trocar de escola, renovar a atividade) passaram a usar `requestSessaoDeRequisicao`. Nenhum outro chamador lê `sessaoId` de `requestSessao()`.
- O `main-worker` não tem controller, e o teste confere isso. Nenhum endpoint novo aceita `escolaId`.
- `@Unscoped` aparece só em `falharInterrompidas`, com justificativa escrita: é a varredura nossa, que grava só estado, código e data. É o único `@Unscoped` do módulo.

Teste de isolamento: presente e efetivo.
- `fila-de-ia.int.test.ts` › "no contexto da A, a execução da B não é lida nem mudada": tira o `escola_id` de qualquer um dos quatro métodos e o resultado esperado (`undefined` ou `false`) muda. O teste também tem o controle na B e execuções da própria A que não podem mudar. Os blocos de mutação de cada cláusula de escola estão declarados na tarefa.
- "job da A com o `execucaoId` da B": a execução fica `pendente`, o modelo não é chamado, não há consumo e o job falha com `DADOS_INVALIDOS`.
- Sobre vazar existência de dado: a falha interna do job não chega ao cliente, e a leitura do cliente (`deQuemPediu`) responde "não encontrado" para a execução de outra pessoa ou de outra escola.

Bloqueantes: nenhum.

Recomendações:
- Os termos `eq(usuario.escolaId, execucaoAgente.escolaId)` e `eq(anoLetivo.escolaId, execucaoAgente.escolaId)` nos joins do `paraIniciar` (`execucao.repository.ts:60` e `:62`) ficaram sem mutação. A tarefa justifica isso pela chave estrangeira composta. Vale um caso de integração que tente gravar a linha cruzada e confirme que o banco a recusa, para que a defesa em profundidade não dependa só da prosa.
- A camada de rede não é tocada por esta tarefa, então não havia agregado para verificar.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-16 01:55:27 · `tasks/prd-reengenharia-continuacao/5_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. Não há tabela `nota` nesta fatia (`packages/core/src/db/schema/correcao.ts:13`). Os seis comandos que agora rodam no `main-worker` (`apps/api/src/ia/montar-comandos.ts:195-204`) não mudaram e nenhum grava nota, aprovação ou `lancadaPor`. O job `ia.executar` leva só `execucaoId` (`packages/shared/src/system/job-definitions.ts:784`). Todos com autor humano? sim, porque não há escrita nenhuma em Nota.

Decisão autônoma sobre aluno: ausente. O processador só leva a execução de `pendente` a `rodando` e depois a `concluida` ou `falhou`. Roda no contexto de quem pediu (`apps/api/src/ia/execucao.processor.ts:122-137`), confere de novo a suspensão e o alcance, e não decide nada sobre a trajetória do aluno.

Aprovação registrada: ok. Artefato e entrega continuam nascendo pendentes, com `criadoPor` = quem pediu (`apps/api/src/artefato/artefato.repository.ts:184-197`). `entrega.int.test.ts` e `artefato.int.test.ts` agora passam pela fila de verdade (`FilaDeIa`) e conferem a entrega `pendente`. O processador trata todas as tarefas igual: a exceção do Tutor (D47) não ganhou caminho próprio em nenhum outro agente.

Supervisão do tutor: ok.
- A pergunta fica em `mensagem_tutor` antes do 202 e continua visível ao professor mesmo se o worker cair.
- A D36 do caminho direto não passa pela fila. Está provado com a fila presa e com o Redis parado (`apps/api/src/tutor/tutor.int.test.ts:1156-1196`).
- A D36 classificada pelo modelo foi para `antesDeConcluir`, numa transação própria (`apps/api/src/tutor/turno.command.ts:246-248`). Mensagem e sinal `atencao_humana` ficam mesmo quando a execução já foi encerrada, com teste em `tutor-modelo.int.test.ts`.
- Com Tutor suspenso ou avaliação aberta, os testes agora conferem que nenhum job nasce.

Autonomia declarada e visível: sim. Nada mudou em `FUNCOES` nem na governança, e `governanca.int.test.ts` só trocou a bancada.

D55 (discursiva e redação): nenhuma tarefa, campo ou prompt novo. O catálogo (`TAREFAS_DE_IA`) continua com as sete tarefas.

Vigilância e medição do professor (itens 7 e 9): nada novo. O log do processador leva só ids, a tarefa e o código.

Bloqueantes: nenhum.

Recomendações:
1. `docs/aia/tutor.md:188` diz que no desligamento do worker "o job volta e roda de novo". Na 5.0 isso não acontece. A execução fica `rodando`, a reentrega cai em `marcarRodando` falso e sai como `ja_tratada` (`apps/api/src/ia/execucao.processor.ts:91-94`), e quem a encerra é a varredura. A AIA vai para o dossiê (D61), então ela deveria dizer o que acontece hoje ("a varredura encerra; a reentrega é da 6.0") ou ser corrigida na 6.0.
2. `docs/aia/adaptacao.md:297` e `docs/aia/correcao-de-objetiva.md:342` ainda dizem que "no MVP a execução roda no processo da API, como dívida declarada (D77)". A adaptação agora roda no `worker-ia`, e a frase da correção de objetiva também ficou velha. A busca da 5.6 não pegava essa frase.
3. O teste da D55 (`apps/api/src/ia/fila-de-ia.int.test.ts:218-219`) só confere os nomes do catálogo com uma expressão regular. O título promete que "o catálogo que o worker consome não cresce por fora", mas o caso não compara o `RegistroDeComandos` do worker com `TAREFAS_DE_IA`. Vale juntar as duas conferências, ou deixar o título do tamanho do que o teste prova.

## llm-integrator · 1ª rodada · APROVADO · 2026-11-16 01:55:39 · `tasks/prd-reengenharia-continuacao/5_task.md`

VEREDITO: APROVADO

Perfis usados: nenhum novo. Cada tarefa mantém o perfil que já tinha. O Tutor, a `propor_ferramenta` e o relatório da correção usam `rapido`. As ferramentas (atividade objetiva, plano de aula, adaptação) e o Analista usam `padrao`. O prazo único da execução vem do perfil (`PRAZO_DA_EXECUCAO_MS`: 60 s no `rapido`, 140 s no `padrao`), abaixo dos 150 s do job. Nenhum classificador usa `complexo`.

Custo estimado por professor/mês: não se aplica, porque a tarefa não adiciona chamada de modelo. Só muda onde a chamada roda (do processo da API para o `main-worker`) e como ela é enfileirada. As chamadas por professor e o custo seguem os da estimativa existente de cada tarefa. O que muda é o teto de tokens por minuto, que se divide por `IA_REPLICAS` (2) quando o Redis de fila cai.

Prompt versionado: sim. Nenhum prompt foi tocado.

Validação de schema: sim. O `dados` do job é `z.strictObject({ execucaoId: z.uuid() })`. A entrada gravada é revalidada por `execucaoInputSchema.safeParse` no `paraExecutar`. O resultado passa por `resultadoGravadoSchema.parse` antes de chegar ao banco. A saída do modelo continua validada pelo gateway.

Aprovação humana no caminho: sim, preservada. Nenhum arquivo do diff toca a regra de aprovação. `entrega.int.test.ts` e `artefato.int.test.ts` agora passam pela fila de verdade e conferem a entrega `pendente`. A D36 continua sem passar pela fila. A D55 tem teste (a IA não tem tarefa de discursiva nem de redação, e o catálogo não cresce por fora).

**O que conferi**
- **Provedor só no worker:** `createLLMGateway` só aparece em `ia-do-worker.module.ts`. O `IaModule` da API não provê `LLM_PROVIDER`, e o `AppModule` usa `IaModule.forRoot()` sem modelo. Nenhum SDK de provedor foi importado fora do adaptador.
- **Escopo de tenant:** `ExecucaoRepository` pega `requireEscolaId()` do contexto do job em todas as cláusulas. A única exceção é `falharInterrompidas`, com `@Unscoped` e justificativa, e a entrada saiu de `REPOSITORIES_SEM_ESCOPO`. Os testes de isolamento passam, tanto do repository quanto do job da A com a execução da B.
- **Idempotência e sem conexão presa:** `pendente → rodando`, `rodando → concluida` e `rodando → falhou` são `update` condicional pelo estado. A conclusão desfaz a transação se a varredura já encerrou a execução. Há um teste de 20 execuções lentas no pool de 20. A D36 saiu da transação de conclusão e foi para o `antesDeConcluir`, que não aninha transação.
- **Parada e desligamento:** o prazo único é `setTimeout` mais `AbortSignal.any` com o sinal do job, repassado ao gateway como `pedido.sinal`. O abort do desligamento não grava falha, e há teste. O compose tem `stop_grace_period` de 25 s, maior que a graça de 20 s do worker.
- **Log:** só ids, tarefa e código. Para erro que não é tipado, vai só o resumo (nome e pilha), nunca a mensagem do provedor.
- **Execuções:** passei `fila-de-ia.int.test.ts` (20 de 20). Passaram também os 8 arquivos unitários da tarefa (132 testes), entre eles `prazo-da-execucao`, `execucao-command`, `worker-config`, `request-sessao`, a guarda `executor-so-na-bancada` e `repositories-com-escopo`. Os testes usam adaptador falso, nenhum provedor pago.
- **Busca de resíduos:** `grep` por `InProcessAgenteExecutor`, `IA_EXECUCOES_*` e `IA_EXECUCAO_TIMEOUT_MS` só acha o caso de `llm-config.test.ts` e a fixture da guarda, como declarado.

Bloqueantes: nenhum.

Recomendações (ficam para a validação e a retro, não bloqueiam):
1. `packages/core/src/db/schema/execucao-agente.ts:9-12`: o docblock ainda diz que a execução "roda no processo da API, atrás do `AgenteExecutor`", com `TODO(fila)`. Está desatualizado. Atualizar para "job `ia.executar` no `main-worker`" na próxima vez que o arquivo for tocado. A busca da autoconferência 7 não pega esse texto.
2. `apps/api/src/ia/execucao.processor.ts:48-51`: sobrou um docblock solto (`/** O prazo de cada perfil, por padrão PRAZO_DA_EXECUCAO_MS… */`) no fim da interface, sem campo abaixo. Remover.
3. `apps/api/src/ia/execucao.processor.ts:169`: `marcarFalhou(...).catch(() => false)` engole o erro sem log. Logar um aviso só com os ids e o código, para não deixar a falha de gravação invisível. A varredura cobre o efeito, mas o diagnóstico fica cego.
4. Para a 6.0, o ponto mais delicado do critério 8 (sobreviver a reinício): hoje o SIGTERM além da graça deixa a execução `rodando`, e a varredura só a encerra com `EXECUCAO_INTERROMPIDA` depois de 300 s. Por isso, um deploy durante a aula faz o aluno do Tutor esperar cerca de 5 minutos por uma falha. A `pendente` com job ainda na fila por falta de vaga também pode ser varrida aos 300 s e depois cair em `ja_tratada`. A tarefa declara isso como escopo da 6.0 (reentrega, corrida e varredura nova). A 6.0 não deve passar sem tratar esses dois casos.
5. Já registrado no `TODO.md`: o teste do aluno eliminado entre o `preparar` e o `concluir` com `assunto_delicado`. A divergência do Tutor desligado (D84) e fora da política (D19) está aberta com o Orquestrador, e a tarefa não a esconde.

Arquivos centrais: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/execucao.processor.ts`, `execucao.repository.ts`, `execucao.scheduler.ts`, `worker-de-ia.ts`, `ia-do-worker.module.ts` e `apps/api/src/worker.module.ts`.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-16 01:57:05 · `tasks/prd-reengenharia-continuacao/5_task.md`

```
VEREDITO: APROVADO
Caminho quente tocado: tutor | fila | IA | deploy
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ok
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/infra/test/carga.test.ts:246 — o caso "a latência simulada do Tutor chega à API" só confere `IA_LATENCIA_FALSA_MS` no `api-1` e no `api-2`, que já não chamam o modelo. Quem chama agora é o `worker-ia-1` e o `worker-ia-2`, e o caso não confere os dois. Se a variável sumir do `worker-ia`, o adaptador falso responde sem espera e o cenário de carga deixa de medir o Tutor (regra 80, item 11), sem que nenhum teste fique vermelho. O caso deve conferir os dois `worker-ia-*`.
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/execucao.processor.ts:105 e :167 — a duração e o código da falha só vão para o log. O `#aoFalhar` absorve o erro e o job `ia.executar` termina sem falhar, então o `job.falhos` não conta execução de IA que falhou. Com o provedor fora às 10h, nenhuma métrica sobe. As tarefas 7.0 e 10.0 têm métricas e alertas de IA planejados. Antes do pouso, uma delas precisa incluir o histograma da execução e o contador de falha por código, que é de onde o alerta "Provedor de IA fora" deve ler.
- Teto global de chamadas ao provedor: com o `IA_EXECUCOES_TOTAL` fora, o limite passou de 16 chamadas simultâneas (8 por instância da API) para até 144 (pools de 50 + 20 + 2 em cada uma das duas réplicas). Na prática o freio é a vaga por escola (10 do Tutor e 4 da ferramenta por escola). O `TokenLimiter` só entra na 10.0, e o `IA_REPLICAS` é lido mas ainda não é usado. A 10.0 precisa pousar junto com a 5.0. Este estado intermediário não pode ir para produção.
- Se o `worker-ia` é desligado no meio de um turno, ou se o job volta por stalled, a execução fica `rodando` até a varredura (/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/varredura-de-execucoes.ts:39). São até 300 s: o aluno espera cinco minutos para receber `EXECUCAO_INTERROMPIDA`. Com o Redis de fila fora por mais de 5 min, a varredura também encerra a `pendente` cujo job ainda vai sair. As duas coisas já são escopo da 6.0. O registro fica para conferir lá.
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/infra/compose.yml:548 — o `stop_grace_period` é de 25 s. O desligamento gasta 20 s de graça mais até 3 s de `ESPERA_APOS_INTERROMPER_MS`, o que deixa uns 2 s para o Nest fechar o pool e os clientes Redis antes do SIGKILL. Considere 30 s.
```

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-16 01:57:29 · `tasks/prd-reengenharia-continuacao/5_task.md`

VEREDITO: REPROVADO
Escopo: incompleto
Aderência à Tech Spec: ok (as sete divergências da tabela estão em `techspec.md` §5, "Como a 5.0 ficou", e a do Tutor desligado e fora da política também está em `cenarios.md`)
Portão local: carimbo válido

**Bloqueantes:**

1. **A parte de rollback da subtarefa 5.6 está marcada como feita, mas não foi feita.**
   - Onde: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/prd-reengenharia-continuacao/5_task.md:25` tem `- [x] 5.6 — Compose, IA_REPLICAS, conexões; rollback (§13); …`.
   - O que a spec pede: `techspec.md` §13 diz que a tarefa confere que o despachante anterior não trava com o `ia.executar` em voo, nem em linha de `ferramenta`, nem em linha de tipo desconhecido.
   - O que existe: nada no diff trata disso. Não há conferência registrada na tarefa, nem teste, nem a seção "Voltar o código depois de …" que o `docs/runbook.md` tem para as outras fases. O diff do runbook só mexe nas causas 1 e 2 do alerta de fila.
   - Correção exigida: escrever o procedimento de volta da 5.0 no `docs/runbook.md`, no molde de "Voltar o código depois da F4 (rollback)". Ele precisa dizer:
     - o que o despachante anterior faz com o `ia.executar` em voo, citando `apps/despachante/src/job-publisher.test.ts:55` (tipo desconhecido vai para a fila do worker);
     - o que acontece com a execução `pendente` e a `rodando` (a varredura antiga da API as encerra);
     - o que fazer com o `worker-ia-1` e o `worker-ia-2`, que o compose anterior não tem e que continuariam consumindo as filas `api-*`;
     - um bloco SQL, se a conferência mostrar que é preciso fechar jobs.
   - Também é preciso registrar a conferência no `5_task.md`. Se ela mostrar que nada trava, basta isso escrito com a referência ao teste.

**Recomendações:**

1. **`docs/aia/tutor.md:188` diz algo falso sobre o desligamento.** O texto afirma que "o job volta e roda de novo". Não é o que acontece:
   - Na 5.0, a reentrega cai em `marcarRodando` falso e sai como `ja_tratada` (`execucao.processor.ts:91-94`). A execução fica `rodando` até a varredura de 300 s.
   - Na 6.0, a reentrega encerra com `EXECUCAO_INTERROMPIDA`, também sem rodar o modelo.
   - Esse texto entra no dossiê (D61). O `conformidade-reviewer` apontou o mesmo.
   - O comentário de `infra/compose.yml` sobre o `worker-ia` ("a outra réplica retoma") tem o mesmo problema.
2. **Docblocks fora do lugar e comentário solto:**
   - `apps/api/src/ia/execucao.processor.ts:56-71`: o docblock da classe ficou em cima de `duracaoDesde`, e não da classe.
   - `execucao.processor.ts:50`: comentário de documentação sem propriedade embaixo, sobra de uma opção que saiu.
   - `apps/api/test/fila-de-ia.fixture.ts:70-78`: o docblock da classe `FilaDeIa` ficou em cima de `TEMPO_DA_CONSULTA_MS`.
3. **Import em duplicidade:** `apps/api/test/fila-de-ia.fixture.ts:26` e `:45` importam o mesmo `urlRedisDeFila`, o segundo renomeado como `redisDaFila`.
4. **`apps/api/src/ia/execucao.scheduler.ts:57-59`:** `requireEscolaId()` e `copiarContextoDeQuemPede()` são chamadas só pela checagem que fazem, e o retorno é descartado. O docblock de `copiarContextoDeQuemPede` (`execucao-context.ts:14-18`) ainda fala do executor em processo, que deixou de existir. Sugiro trocar por `requireUsuarioId()` (e `requireAnoEmCurso()`, se a intenção é exigir o ano) e apagar a função.
5. **`apps/api/src/ia/execucao.repository.ts:26` e `:42`:** o comentário diz que `quemPediu` fica vazio quando "o vínculo acabou". A consulta não olha vínculo: olha só se o usuário foi desativado, se tem eliminação agendada e se o ano está em curso. Hoje isso funciona porque a regra 20.18 faz o fim do vínculo desativar a conta. O comentário deveria dizer isso, já que a §5 fala em "papel do vínculo ativo".
6. **`apps/api/src/main-worker.ts:15`:** `startTelemetry('worker', …)` usa o mesmo `service.name` do `apps/worker`. As métricas do `worker-ia` se misturam às do worker de jobs em painel ou alerta que filtra por serviço. Fica para o `infra-guardian` decidir.
7. **AIAs com texto velho:** `docs/aia/adaptacao.md:297` e `docs/aia/correcao-de-objetiva.md:342` ainda dizem que a execução roda no processo da API (D77). A busca da 5.6 não pegava essa frase.

## privacy-guardian · 1ª rodada · REPROVADO · 2026-11-16 01:58:20 · `tasks/prd-reengenharia-continuacao/5_task.md`

VEREDITO: REPROVADO

**Campos pessoais tocados:** nenhum campo novo. A tarefa mexe em três coisas que passam por dado de pessoa:
- `execucao_agente.solicitada_por`, que agora é lida pelo worker (`paraIniciar`, com join em `usuario` e `ano_letivo`);
- `job_registro.dados` do tipo novo `ia.executar`, que leva só `{ execucaoId }`;
- `consumo_ia.aluno_id`, que agora é gravado pelo gateway no `main-worker`, e não mais na API.

**Fora da tabela de dados do docs/lgpd.md:** nada. O `job_registro` (linha 116) já prevê "o id ... da execução", e a `execucao_agente` (linha 98) não muda.

**Autorização por objeto:** ok.
- `ExecucaoRepository` pega a escola do contexto do job em todo `where`.
- O job da escola A com a execução da escola B falha com `DADOS_INVALIDOS` sem chamar o modelo.
- O worker roda como quem pediu e relê a execução por `ExecucaoDaSessaoRepository.paraExecutar`.
- Pessoa desativada, pessoa com eliminação agendada ou ano letivo virado dão `quemPediu` vazio, e a execução fica em `NAO_ENCONTRADO` sem chamar o modelo.
- No HTTP, `requestSessao` sem `sessaoId` não abre caminho novo: o papel só entra no contexto pelo `setContextSessao` do guard e pelo processador.

**Logs:** limpos.
- O processador loga só `execucaoId`, `escolaId`, `tipo`, `codigo` e `duracaoMs`.
- O `summarizeError` leva o nome e a pilha, sem a mensagem do provedor.
- O teste `fila-de-ia.int.test.ts` › "o processador loga só ids…" e "o erro do modelo não vai à cópia do job no Redis…" conferem isso.
- Rodei os 13 arquivos de teste de `tools/guardas`, incluindo `log-sem-dado-pessoal`: 534 testes passaram.

**Auditoria:** não se aplica. A tarefa não cria nenhuma das ações que a regra 20, item 10, manda auditar.

**Envio externo:** só a infraestrutura mudou de lugar.
- O que vai ao modelo é o mesmo de antes: a entrada do comando, com identificador e sem nome (`tutor-modelo.int.test.ts` › "…nenhum nome de pessoa").
- Quem envia agora é o `worker-ia`. É o único que monta `createLLMGateway`, com o mesmo `loadLLMConfig`: a trava de produção, a regra de `LLM_PROCESSAMENTO_LOCAL` e o `IA_PROVEDOR_ID` continuam iguais, e o compose passa as mesmas variáveis.
- O envio continua registrado em `consumo_ia` (`provedor`, `envio_externo`, `aluno_id`, com o gatilho em `tutor-modelo.int.test.ts:392`) e em `execucao_agente`.

**Seed/fixture:** sintético ("Maria Sintética da Silva", "Aluno Sintético …").

**Bloqueantes:**

1. `docs/aia/tutor.md:188-189` (N10, texto novo desta tarefa).
   - **O que está errado:** o texto diz "A pergunta do aluno fica em `mensagem_tutor`, visível ao professor". Isso é falso. O mesmo documento, na N21 (linha 289), diz "No MVP o professor **não lê o texto** da conversa: nenhuma rota o entrega a ele". O `docs/lgpd.md:51` diz "Nesta fatia o **texto** só o próprio aluno lê; o professor da turma vê o **uso**, sem o texto". O código confirma esses dois: `tutor.controller.ts` só tem `conversa`, `memoria` (do próprio aluno) e `uso`, sem conteúdo.
   - **Por que bloqueia:** a AIA vai para a escola no dossiê de conformidade (D60, D61), e a escola usa ela para dizer à família quem lê a conversa de um menor. Uma afirmação errada sobre o acesso ao conteúdo da conversa é defeito de transparência no tratamento (LGPD, art. 9º). Também serve de pretexto para alguém abrir depois uma rota de leitura do texto ao professor.
   - **Correção exigida:** trocar por algo como "A pergunta do aluno fica em `mensagem_tutor`, mesmo quando o modelo não responde; o professor da turma vê o uso dela (`GET /v1/tutor/uso`), sem o texto (N21)".

**Recomendações:**
- A API continua recebendo as variáveis `LLM_*` e `IA_PROVEDOR_ID` só para validar a configuração. Em produção, não injetar `LLM_CHAVE_API` no contêiner da API: menor privilégio, porque a API não chama mais o provedor.
- Continua pendente, já registrado no `TODO.md`, o teste do aluno eliminado entre o `preparar` e o `concluir` com `assunto_delicado`. Hoje a chave estrangeira garante o resultado e o `paraIniciar` barra a eliminação antes do modelo; vale fazer o teste quando o modelo falso aceitar uma barreira no meio da chamada.
- `docs/lgpd.md:116` (`job_registro`) poderia citar `ia.executar` pelo nome entre os tipos que levam só id. Hoje a linha já cobre o caso ("o id ... da execução").

**Pergunta de fechamento:** sim, o código responde. O que se guarda do aluno e para onde foi enviado continua em `consumo_ia` (provedor, envio externo, aluno) e em `execucao_agente`, os dois lidos pelo arquivo do titular. A mudança para o worker não criou outro lugar com dado de pessoa: o `job_registro` e a cópia no Redis guardam só o id da execução, e o teste de esquema estrito recusa texto livre.

Arquivos principais da auditoria:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/aia/tutor.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/execucao.processor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/execucao.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/shared/src/system/job-definitions.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/fila-de-ia.int.test.ts

## test-engineer · 1ª rodada · REPROVADO · 2026-11-16 01:58:49 · `tasks/prd-reengenharia-continuacao/5_task.md`

**VEREDITO: REPROVADO**

Três bloqueantes. Os cinco arquivos de teste unitário novos passam (27 casos). Não rodei os testes de integração, porque eles param o `redis-fila` e os processos do compose, e isso derrubaria as rodadas dos outros revisores que usam a mesma árvore.

**Cenários exigidos:** IA fora da API; job só com o id; execução `pendente` e job na mesma transação; clique duplo em paralelo; job duplicado sobre execução concluída; prazo do perfil (60 s no Tutor, 140 s na ferramenta); desligamento que não grava; pool de 20 sem conexão presa durante o modelo; Redis de fila fora; D36 sem fila; S12 pela fila; Tutor desligado, suspenso ou fora da política sem job; isolamento no repository e no job; vagas por escola (RF2); a guarda nos dois sentidos; escopo; compose; log; virada de ano e pessoa desativada ou com eliminação agendada entre o 202 e o worker; varredura que encerra a execução enquanto o modelo roda.

**Cobertos:** quase todos, com efeito lido no banco, no Redis ou no log:
- O teste do repository tem controle positivo e execuções da própria escola A.
- O clique duplo roda em `Promise.all` de verdade.
- O job duplicado confere o estado do segundo job.
- A varredura concorrente tem os dois ramos, a resposta tardia e a falha tardia.
- O caso "quem pediu" cobre cinco situações: desativado, eliminação agendada, ano encerrado, execução de ano anterior e entrada que o esquema não lê.
- A D36 nas tutor tests tem o controle `jobsAntes + 1`.
- Não há `.skip`, e nenhum teste chama provedor pago.
- Tutor desligado (D84) e fora da política (D19) ficam sem caso, com a divergência aberta junto ao Orquestrador. Não bloqueio por isso: a conferência não existe na API.

**Bloqueantes:**

1. **O teste da "mesma transação" não alcança o job.** Em `apps/api/src/ia/fila-de-ia.int.test.ts:224-230`, o caso faz o `aoGravar` falhar. Mas em `apps/api/src/ia/execucao.scheduler.ts` o `aoGravar` roda antes do `this.fila.enfileirarUmaVez(tx, …)`, então o job nunca chega a ser gravado nesse caso. Se o enfileiramento saísse da transação (o `banco` no lugar do `tx`, ou a chamada depois do commit), o teste continuaria verde. O filtro `estado = 'aguardando'` agrava: um job que o despachante já publicou some da contagem. A linha "turno pela fila" da tabela fica sem prova.
   - **Correção exigida:** provocar a falha **depois** do enfileiramento e ainda dentro da transação. Um caminho é uma *constraint trigger* `deferrable initially deferred` em `execucao_agente` para a chave do caso, que só dispara no commit. Depois, contar todo `ia.executar` da escola criado desde o início do caso, sem filtrar por estado.
   - Acrescentar um bloco ` ```mutacao ` que troque o `tx` do `enfileirarUmaVez`.

2. **A asserção "sem trecho" do Tutor passou a nunca falhar.** Em `apps/api/src/tutor/tutor.int.test.ts:544` e `:598`, o espião é posto em `api.app.get(TrechoSearch)`, a busca da API. Com esta tarefa, o turno roda no worker com `fila.trechos`, a busca da bancada (o próprio `fila-de-ia.fixture.ts` diz isso). O único `buscar` do Tutor é o de `turno.command.ts:301`. Assim, as asserções das linhas 550 e 617 (`buscar.mock.calls… toEqual([])`) passam sempre, e o "sem trecho" do S12 e da releitura do contexto deixa de ser provado (regra 40, asserção que sempre passa).
   - **Correção exigida:** espionar `fila.trechos`, como já fazem `assistente.int.test.ts` e `artefato.int.test.ts`, e pôr um controle: um turno comum chama esse espião.

3. **O temporizador do prazo único não tem teste.** `apps/api/src/ia/execucao.processor.ts:34-39` (`prazoPorTemporizador`) é o que aplica os 60 s e os 140 s em produção. Todo teste troca a fábrica pela `prazo` falsa (`fila-de-ia.int.test.ts:508`). Um `prazoMs * 1000`, um `clearTimeout` imediato ou um `abort` que nunca dispara não deixam nenhum teste vermelho. O `--faltando` não pega isso porque a função não tem condição.
   - **Correção exigida:** teste unitário com `vi.useFakeTimers()`. O sinal não está abortado em `prazoMs - 1`, está abortado em `prazoMs`, e depois do `cancelar()` não aborta mais.
   - Acrescentar um bloco de mutação nessa função.

**Recomendações:**
- **Mutações citadas na tabela sem bloco na seção "Mutações":** "sem modelo na API" (provedor no `AppModule`) e "Tutor que não roda" (uma mutação por conferência). Acrescente os blocos ou tire a menção.
- **Vagas por escola (RF2):** em `fila-de-ia.int.test.ts:309`, o "a quinta espera" depende de um `setTimeout(600)`. Com a máquina carregada, o caso passa mesmo sem o limite (verde falso). Melhor esperar um fato positivo, como o contador `aguardandoVaga` ou o log do executor, antes de afirmar que a quinta não começou.
- **Desligamento:** em `fila-de-ia.int.test.ts:557-560`, o `encerrar` corta a espera em 3 s depois de interromper. Conferir também o evento `ia.execucao.abortada` no log, para não depender de o `marcarFalhou` caber nesse teto.
- **Pool:** em `fila-de-ia.int.test.ts:565`, o caso usa `comModelo` e por isso passa por fora do gateway. Com o gateway real e `IA_LATENCIA_FALSA_MS`, ele provaria também que orçamento e consumo não seguram conexão.
- **D55:** em `fila-de-ia.int.test.ts:218`, o nome diz "não cresce por fora", mas o caso só aplica uma regex aos nomes. Fixe a lista inteira de `TAREFAS_DE_IA` com `toEqual`, como diz a autoconferência 4.
- **Redis fora:** em `fila-de-ia.int.test.ts:613`, o caso chama `agendar` direto, mas a linha da tabela diz "`POST` 202". Um caso pela rota HTTP de uma dúvida comum cobriria o caminho real.
- **Guarda:** `tools/guardas/executor-so-na-bancada.ts:88` só percorre `apps` e `e2e`. Os testes de `infra/test`, `packages` e `tools` ficam fora; hoje nenhum deles cita um alvo.
- **Concorrência deixada para a 6.0:** duas entregas do mesmo job `pendente` em paralelo. Conferir que a 6.0 tenha esse caso em `Promise.all`.
- **Comentário solto:** `execucao.processor.ts:50` tem um docblock ("O prazo de cada perfil…") sem campo embaixo.

Arquivos citados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/fila-de-ia.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/execucao.scheduler.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/execucao.processor.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/tutor/tutor.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/test/fila-de-ia.fixture.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/guardas/executor-so-na-bancada.ts`

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-16 03:00:51 · `tasks/prd-reengenharia-continuacao/5_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela ou migration nova nesta rodada. `execucao_agente` foi conferida de novo por causa do caso novo. As FKs compostas `execucao_agente_solicitada_por_da_escola_fk` (escola_id, solicitada_por) → usuario(escola_id, id) e `execucao_agente_ano_letivo_da_escola_fk` (escola_id, ano_letivo_id) → ano_letivo(escola_id, id) estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/db/schema/execucao-agente.ts:75-77`.

Queries verificadas:
- `ExecucaoRepository.paraIniciar`, `marcarRodando`, `concluirRodando`, `marcarFalhou` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/execucao.repository.ts`. Nesta rodada só o comentário mudou. A escola vem de `requireEscolaId()`, e os dois `leftJoin` casam por `escolaId`.
- O `.catch` novo de `marcarFalhou` em `execucao.processor.ts` loga só `execucaoId`, `escolaId` e o código, e não muda o escopo.
- O bloco SQL `volta-da-5.0` de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/runbook.md` atualiza linhas de todas as escolas, mas é procedimento manual da nossa operação, fora do código do produto, e grava só estado, código e data. Não viola a regra 10, item 9.
- Nenhum endpoint novo e nenhum `escolaId` vindo do cliente.

Teste de isolamento: presente e efetivo. A recomendação da 1ª rodada foi aplicada no caso "a defesa em profundidade do banco…" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/fila-de-ia.int.test.ts`:
- Grava uma linha de controle com dados da própria escola, que entra.
- Tenta gravar com a pessoa da B e depois com o ano letivo da B, e o banco recusa as duas por violação de FK.
- Se a FK composta virasse FK simples para `usuario.id` ou `ano_letivo.id`, as duas inserções passariam e o teste quebraria.

O working tree é igual à árvore `0ce27c9` auditada, sem contar `achados/`.

Bloqueantes: nenhum

Recomendações:
- O caso "a volta do código depois da 5.0" roda o bloco do runbook, que atualiza `execucao_agente` e `job_registro` de todas as escolas no banco de teste compartilhado, mas só confere a escola A. Com arquivos de teste rodando em paralelo, ele pode encerrar execuções de outra suíte. Vale rodar uma cópia do bloco presa à escola do caso, ou conferir que execuções `pendente` e `rodando` de outra escola criada no caso também mudam e que nada fora do tipo `ia.executar` é tocado. Isso é estabilidade de teste, não vazamento.
- O mesmo caso só verifica que um job de outro tipo (`sintetico`) da escola A fica intacto. Falta mostrar que a execução `concluida` da B também fica intacta, porque o bloco não filtra por escola.

Uma nota de processo: para comparar o working tree com a árvore auditada, rodei `git add -N .` seguido de `git reset`, e isso desfez a remoção já preparada no stage de `packages/core/src/ia/executor.test.ts`. Restaurei com `git rm --cached`, e o `git status` voltou a mostrar `D  packages/core/src/ia/executor.test.ts`, como no início. Nenhum arquivo foi editado.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-16 03:01:00 · `tasks/prd-reengenharia-continuacao/5_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum novo nesta rodada. O diff não toca `Nota` nem `lancadaPor`. O bloco SQL do runbook da volta da 5.0 (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/runbook.md`, seção "Voltar o código depois da 5.0") só altera `execucao_agente` e `job_registro`. Todos com autor humano? sim.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. Na volta do código, as entregas `pendente` continuam esperando a decisão da professora, e o bloco não aprova nem descarta nenhuma. O teste da D55 (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/fila-de-ia.int.test.ts`, linhas 221 a 229) agora fixa a lista inteira de `TAREFAS_DE_IA` e compara com o que `montarComandos` registra no worker: seis comandos, todos do catálogo. O sétimo, `relatorio_da_correcao`, não tem chamador (`TAREFAS_SEM_CHAMADOR` em `apps/api/src/ia/registro-de-comandos.ts:42`). Com isso, uma tarefa nova de discursiva ou redação passa obrigatoriamente pela revisão. A recomendação da 1ª rodada foi cumprida.

Supervisão do tutor: ok. O N10 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/aia/tutor.md` (linhas 185 a 190) deixou de dizer que a pergunta fica "visível ao professor". Agora diz que o professor vê o uso por `GET /v1/tutor/uso`, sem o texto, como já diz o N21 (linhas 285 a 291). A frase anterior prometia mais do que o produto faz, e a correção também respeita o item 7 da regra 70. As frases antigas sobre "a execução roda no processo da API" em `docs/aia/adaptacao.md:297` e `docs/aia/correcao-de-objetiva.md:342` foram trocadas pela descrição do `worker-ia`. Essas recomendações da 1ª rodada também foram cumpridas.

Autonomia declarada e visível: sim. O diff não mexe em nível de agente nem na governança.

Bloqueantes: nenhum.

Recomendações:
- O texto novo do N10 diz que hoje a reentrega do job sai como "já tratada", sem rodar o modelo de novo. Quando a 6.0 implementar a reentrega, esse trecho e o comentário de `infra/compose.yml:506-507` precisam mudar junto, para a AIA não ficar desatualizada.
- O runbook avisa que "quem estava com o Tutor ou uma ferramenta aberta vê 'tentar de novo'". Vale confirmar na 6.0 ou na 7.0 que a mensagem que o aluno recebe com `EXECUCAO_INTERROMPIDA` aparece como aviso do produto, sem erro cru (N10). Hoje isso está coberto só para `IA_TEMPO_ESGOTADO` e `IA_INDISPONIVEL`.

## llm-integrator · 2ª rodada · APROVADO · 2026-11-16 03:01:08 · `tasks/prd-reengenharia-continuacao/5_task.md`

VEREDITO: APROVADO

Perfis usados: nenhum novo. A tarefa só move a execução da API para o `worker-ia`, e cada tarefa de IA mantém o perfil que já tinha. O diff não adiciona chamada de modelo, e `execucao.processor.ts` não escolhe perfil, pois o comando de cada tarefa o declara.

Custo estimado por professor/mês: sem mudança, porque o número de chamadas e o perfil são os mesmos. Não há consumo novo a anexar nesta rodada. A execução continua passando pelo gateway, com orçamento e `consumo_ia`.

Prompt versionado: sim, sem alteração neste diff.

Validação de schema: sim. `resultadoGravadoSchema.parse` continua na conclusão e o caminho de erro virou `falhou` com código tipado. Esta rodada não mexeu nisso.

Aprovação humana no caminho: sim, sem alteração neste diff. A entrega do agente continua nascendo `pendente`, e a única exceção continua sendo a resposta do Tutor (D47).

**O que conferi no diff desde a rodada aprovada**

- **Prazo extraído:** `prazoPorTemporizador` e os tipos do prazo saíram para `prazo-por-temporizador.ts` sem mudar de comportamento. O novo `prazo-por-temporizador.test.ts` prova o limite exato (59.999 ms contra 60.000 ms), o prazo de 140 s do perfil padrão, o `cancelar` e o `unref`.
- **Prazo único:** o sinal ainda chega ao gateway como `pedido.sinal`, e o abort do worker não grava falha (o teste de desligamento confere o aviso `ia.execucao.abortada` e a ausência de `ia.execucao.falhou`).
- **Log:** o novo aviso `ia.execucao.falha_nao_gravada` usa `summarizeError`, que só devolve tipo, `sqlstate`, `constraint` e linhas de pilha. A mensagem do erro não vai ao log (regra 20, item 9). O caso de integração prova isso com um gatilho que recusa a gravação e confere que o texto do erro não aparece no aviso.
- **Teste sem provedor pago:** os testes usam o provedor falso por `comModelo`. A mudança em `tutor.int.test.ts` passou a espiar `fila.trechos` com um turno de controle, para o "nenhuma chamada" poder falhar. Nenhum teste chama provedor pago.
- **Catálogo e registro fixos:** o caso de D55 trava `TAREFAS_DE_IA` e as tarefas de `montarComandos` por lista exata. Uma tarefa nova de texto de aluno, como discursiva ou redação, quebra o teste e passa por revisão.
- **Transação do job:** o caso de integração ganhou duas provas. Um gatilho adiado força falha no commit, e uma rejeição em `aoGravar` simula a falha antes do commit. Em ambas não sobra execução nem job `ia.executar`.
- **Rollback:** o bloco de SQL do runbook é copiado pelo teste e executado como está. Ele encerra `pendente` e `rodando` com `EXECUCAO_INTERROMPIDA`, conclui só o job `ia.executar` aberto e deixa os jobs de outro tipo intactos. É rotina administrativa fora do tráfego do produto, com ordem de parar o `worker-ia` antes e fora do horário letivo.
- **Desligamento:** o `stop_grace_period` do `worker-ia` subiu para 30 s e o teste de `shutdown.test.ts` exige graça mais 3 s mais 5 s. O compose de carga repassa `IA_LATENCIA_FALSA_MS` ao `worker-ia`, onde o modelo é de fato chamado.

**Bloqueantes:** nenhum.

**Recomendações (não bloqueiam):**
- A reentrega do job e a varredura de 300 s seguem para a 6.0, como já registrado. Hoje o desligamento deixa a execução `rodando` por até cerca de 5 minutos até a varredura encerrá-la. A 6.0 não deve passar sem tratar esse caso.
- Tarefa 10.0: a API ainda recebe `LLM_*` e `IA_PROVEDOR_ID` só para validar a configuração. Em produção, não injetar `LLM_CHAVE_API` no contêiner da API. O item já está no `TODO.md`.
- Tarefa 10.0: o teto global de chamadas ao provedor (`IA_EXECUCOES_TOTAL` e o `TokenLimiter`) precisa pousar junto com a 5.0, porque sem ele o limite de chamadas simultâneas passa de 16 para até 144. Este estado intermediário não pode ir para produção, e o Orquestrador deve saber disso no pouso.
- Tarefa 7.0: falta métrica de duração e de falha por código da execução, de onde o alerta de provedor fora deve ler.
- `TODO.md`: o caso do Redis fora chama `agendar` direto. Um caso pela rota HTTP do Tutor conferiria o que o aluno recebe.
- `TODO.md`: o teste do aluno eliminado entre o `preparar` e o `concluir` com `assunto_delicado` continua pendente.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/execucao.processor.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/prazo-por-temporizador.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/fila-de-ia.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/runbook.md`

## infra-guardian · 2ª rodada · APROVADO · 2026-11-16 03:01:10 · `tasks/prd-reengenharia-continuacao/5_task.md`

VEREDITO: APROVADO
Caminho quente tocado: IA | fila | deploy
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ok
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum

Recomendações:
- **Bloco de volta no runbook (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/runbook.md`, seção "Voltar o código depois da 5.0"):** o passo 1 diz que "a graça é de 20 s", mas o `docker compose stop` espera o `stop_grace_period`, que agora é de 30 s. Vale dizer os dois números (20 s do worker, 30 s do compose), para quem está de plantão não achar que travou. O comando também não traz o `-f` dos arquivos de compose de produção. Se as outras seções do runbook trazem, esta deve seguir o mesmo formato.
- **O caso "a volta do código depois da 5.0" em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/fila-de-ia.int.test.ts`:** ele roda o bloco do runbook, que atualiza `execucao_agente` e `job_registro` do banco inteiro, sem filtro por escola. Hoje isso é seguro porque a integração roda um arquivo por vez (`fileParallelism: false` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/vitest.config.ts`). Se os projetos `integracao` e `infra` passarem a rodar juntos no mesmo banco, o caso encerra execuções e jobs de outros arquivos. Vale um comentário no caso que registre essa dependência.
- **Recomendações da 1ª rodada que seguem abertas, para o pouso:**
  - O histograma e o contador de falha da execução continuam só no log. O aviso novo `ia.execucao.falha_nao_gravada` (`execucao.processor.ts:157`) também é só log. Fica com a 7.0.
  - O teto global de chamadas ao provedor fica com a 10.0. O estado intermediário, de até 144 chamadas simultâneas, não pode ir para produção sem ela.
  - A varredura de 300 s fica com a 6.0.

As duas correções da 1ª rodada foram feitas:
- `infra/test/carga.test.ts` passou a conferir `IA_LATENCIA_FALSA_MS` também em `worker-ia-1` e `worker-ia-2`.
- O `stop_grace_period: 30s` (`infra/compose.yml:550`) ficou coberto por `apps/worker/src/shutdown.test.ts`, que confere a graça mais 3 s mais a folga.

O que entrou nesta rodada não cria corrida nova:
- O `marcarFalhou` com aviso continua condicional e só põe ids e código no log, porque o `summarizeError` não leva a mensagem do banco.
- O bloco de volta encontra as execuções abertas pelo índice parcial `execucao_agente_abertas_idx`.
- A volta não tem migration.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-16 03:02:08 · `tasks/prd-reengenharia-continuacao/5_task.md`

VEREDITO: APROVADO

Esta rodada conferiu só o diff desde a 1ª rodada (`.processo/ordens/diff-5-r2.patch`) e a correção que eu tinha exigido.

**A correção exigida foi feita.** Em `docs/aia/tutor.md:190-191` a N10 agora diz: "A pergunta do aluno fica em `mensagem_tutor`, mesmo quando o modelo não responde; o professor da turma vê o uso dela (`GET /v1/tutor/uso`), sem o texto (N21)". Conferi no código que isso é verdade:
- A rota existe com esse caminho: `apps/api/src/tutor/tutor.controller.ts:25` e `:53`.
- A resposta dela, em `packages/shared/src/tutor/uso.ts:53-59`, é um schema estrito que não aceita texto. Ela traz o aluno, o número de trocas, a hora da última troca e o que ele estava fazendo nela. O nome do aluno aparece só para o professor da turma, como manda a D34.
- O texto agora bate com a N21 e com `docs/lgpd.md:51`.

Campos pessoais tocados: nenhum campo novo. Também não há migration nesta rodada.
Fora da tabela de dados do docs/lgpd.md: nada. A linha do `job_registro` em `docs/lgpd.md` agora diz que o `ia.executar` leva só o `execucaoId`. Era a recomendação da rodada anterior, e foi aplicada.
Autorização por objeto: ok. A rodada não mexe em rota. Ela traz um teste novo, em `apps/api/src/ia/fila-de-ia.int.test.ts` › "a defesa em profundidade do banco". Ele prova que o banco recusa uma execução da escola A com a pessoa ou o ano letivo da escola B.
Logs: limpos. O aviso novo `ia.execucao.falha_nao_gravada`, em `apps/api/src/ia/execucao.processor.ts:155`, leva só os ids, o código e o `summarizeError`. Este último guarda apenas o tipo do erro, o código do Postgres e a constraint, e nunca a mensagem nem a consulta com os parâmetros (`packages/core/src/error/summarize-error.ts:49-66`). Há teste que confere que o texto do erro do banco não chega ao log.
Auditoria: presente. Nenhuma ação nova desta rodada pede auditoria. O bloco do runbook "Voltar o código depois da 5.0" manda registrar o que ele fez só por contagens.
Envio externo: nada novo nesta rodada. O modelo continua sendo chamado só pelo `worker-ia`, e a execução continua gravada em `execucao_agente`. A latência simulada da carga agora chega também ao `worker-ia` (`infra/test/carga.test.ts`), e a carga continua sem chamar provedor pago.
Seed/fixture: sintético. Os testes novos usam UUIDs aleatórios e as escolas da bancada. O bloco de SQL do runbook não lê nem escreve dado de pessoa: ele só encerra execuções e jobs pelo estado.
Bloqueantes: nenhum.
Recomendações:
- Continua aberta no `TODO.md`: não passar `LLM_CHAVE_API` ao contêiner da API em produção, para que a API só tenha o acesso de que precisa. A tarefa 10.0 cuida disso.
- Continua aberta no `TODO.md`: o teste do aluno eliminado entre o `preparar` e o `concluir` quando o modelo classifica o turno como assunto delicado.
- Fora da minha regra, fica para a revisão de testes: o caso "a volta do código depois da 5.0" roda o bloco do runbook, que não filtra por escola. Ele encerra toda execução `pendente` ou `rodando` do banco de teste e pode atrapalhar outras suítes que rodem em paralelo no mesmo Postgres.

Pergunta de fechamento: a resposta continua igual à da 1ª rodada. A execução continua em `execucao_agente`, ligada à escola e à pessoa que pediu, e o job guarda só ids. O arquivo do titular continua respondendo o que o sistema guarda e para onde foi enviado.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/aia/tutor.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/execucao.processor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/shared/src/tutor/uso.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/lgpd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/runbook.md

## revisor-geral · 2ª rodada · APROVADO · 2026-11-16 03:02:20 · `tasks/prd-reengenharia-continuacao/5_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido
Bloqueantes: nenhum

A correção exigida na 1ª rodada (o rollback da subtarefa 5.6, Tech Spec §13) foi feita. Conferi cada afirmação do procedimento contra o código anterior à 5.0 (`HEAD`, 58782107):

- **Procedimento no runbook:** está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/runbook.md:1132`, no molde das outras voltas. Ele cobre o job `ia.executar` em voo, a execução `pendente` e a `rodando`, o `worker-ia-1` e o `worker-ia-2`, o que já foi gravado e a volta para a versão nova.
- **O despachante anterior não trava:** o tipo desconhecido vai à fila do worker, como diz `apps/despachante/src/job-publisher.test.ts:55`. O `worker-interativo` anterior falha o job com `TIPO_DESCONHECIDO`, definitivo, em `packages/core/src/jobs/job-executor.ts:348`.
- **A fila `ferramenta`:** no compose anterior nenhum worker a consome. Os `FILAS` são `interativa,normal`, `lote` e `pdf`, então o job só fica parado, como o runbook diz.
- **As filas `api-*`:** nenhum tipo da versão anterior tem `executor: 'api'`. Só os `worker-ia-*` que ficassem de pé as consumiriam, e por isso os passos 1 e 4 do runbook estão certos.
- **A varredura antiga:** `falharInterrompidas` (`HEAD:apps/api/src/ia/execucao.repository.ts:67`) encerra a `pendente` e a `rodando` com `EXECUCAO_INTERROMPIDA`.
- **O bloco SQL é testado:** o caso "a volta do código depois da 5.0", em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/fila-de-ia.int.test.ts`, lê o próprio bloco do runbook e o roda. Ele confere a `pendente`, a `rodando`, a execução já concluída e os jobs abertos, e confere também que o job de outro tipo fica como estava.
- **A conferência registrada na tarefa:** está no item 13 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/prd-reengenharia-continuacao/5_task.md:88`, com as referências.

O resto do diff não abre bloqueante: a extração do `prazo-por-temporizador.ts`, o aviso `ia.execucao.falha_nao_gravada` (só ids e código), os docblocks movidos, o `stop_grace_period` de 30 s, o `IA_LATENCIA_FALSA_MS` no `worker-ia` da carga, as AIAs e o `lgpd.md`.

Recomendações:
- **Graça no passo 1:** `docs/runbook.md`, passo 1 de "Antes de voltar", diz "a graça é de 20 s". O `docker compose stop` espera o `stop_grace_period`, que agora é 30 s. Vale dizer que o worker espera os jobs por 20 s e o compose dá 30 s antes do SIGKILL.
- **Teste do `unref`:** em `apps/api/src/ia/prazo-por-temporizador.test.ts`, o último caso tem um `getTimerCount() === 1` que não prova o `unref`; só o `hasRef()` prova. A primeira asserção pode sair, ou o caso pode ficar só com o espião.
- **Gatilhos no banco compartilhado:** os dois casos de `fila-de-ia.int.test.ts` que criam gatilho no banco de teste estão presos à `chave_envio` e se limpam no `finally`, o que está certo. Se a suíte passar a rodar em paralelo no mesmo banco, o `create constraint trigger` no meio de outra transação pode esperar lock da tabela. Fica registrado para a 11.0, que é a carga.

## test-engineer · 2ª rodada · APROVADO · 2026-11-16 03:02:31 · `tasks/prd-reengenharia-continuacao/5_task.md`

VEREDITO: APROVADO

**Cenários exigidos:** nesta rodada confiro as três correções da 1ª.
1. A execução `pendente` e o job `ia.executar` nascem na mesma transação. Se o commit falha, não fica nenhum dos dois, em qualquer estado.
2. No Tutor, o "sem trecho" (S12 e a releitura do contexto) é provado na busca que o worker usa de fato, com um controle positivo.
3. O temporizador do prazo único (`prazoPorTemporizador`) não aborta antes do prazo, aborta no prazo e não aborta depois do `cancelar()`.

Também audito o que o diff acrescentou: a falha que não se grava, a defesa em profundidade das chaves estrangeiras, o bloco de volta do runbook, a quinta ferramenta esperando por estado do `job_registro`, o evento `ia.execucao.abortada` e a graça do `worker-ia`.

**Cobertos:**
- **Correção 1, feita.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/fila-de-ia.int.test.ts`, caso "a execução `pendente` e o job nascem na mesma transação":
  - Uma *constraint trigger* `deferrable initially deferred`, presa à `chave_envio` do caso, só dispara no commit. Nesse momento a execução e o job já foram gravados no `tx` (`execucao.scheduler.ts:74-75`).
  - A contagem pega todo `ia.executar` da escola criado desde `desde`, sem filtrar por estado.
  - O bloco de mutação troca `tx` por `this.banco`. O job iria então para fora da transação, sobreviveria ao commit que falha e deixaria o caso vermelho. O bloco chega à cláusula.
  - O caso antigo do `aoGravar` ficou como um segundo caso, também sem o filtro de estado.
- **Correção 2, feita.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/tutor/tutor.int.test.ts:545` e `:604`:
  - O espião agora é `fila.trechos`. Pela fixture, é a mesma instância que o `montarComandos` passa ao `TurnoDoTutorCommand` do worker.
  - Cada caso ganhou um controle: um turno comum, que precisa chamar o espião (`toBeGreaterThan(0)`).
  - O `vi.spyOn(api.app.get(TrechoSearch))` da linha 896 está certo. Ali o caso chama `api.app.get(TurnoDoTutorCommand).preparar` direto, e esse comando usa a busca da API.
- **Correção 3, feita.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/prazo-por-temporizador.test.ts`:
  - Com `vi.useFakeTimers()`, o teste confere: sinal não abortado em 59.999 ms e abortado em 60.000 ms; os 140 s não abortam aos 60 s; depois do `cancelar()` não sobra temporizador (`getTimerCount() === 0`) e o sinal não aborta; o `unref` é conferido pelo `hasRef()`.
  - Há cinco blocos de mutação, todos com asserção que os pega: `* 1000`, prazo fixo de 60 s, `abort` removido, `cancelar` vazio e `unref` removido.
- **O que o diff acrescentou:**
  - A falha que não se grava deixa o aviso `ia.execucao.falha_nao_gravada`, a linha fica `rodando` e o texto do erro do banco não vai ao log. Tem bloco de mutação.
  - O teste da defesa em profundidade tem controle positivo: a mesma linha entra com a pessoa e o ano da própria escola.
  - O bloco de volta do runbook é lido do próprio `docs/runbook.md` e executado. O teste confere que o job de outro tipo e a execução concluída ficam intactos.
  - A espera fixa de 600 ms virou uma espera por estado: quatro jobs ativos e um aguardando.
  - O desligamento confere que sai o `ia.execucao.abortada` e nenhum `ia.execucao.falhou`.
  - O D55 agora confere o catálogo inteiro (`toEqual`) e também o registro que o worker monta.
- **Rodei:**
  - `prazo-por-temporizador.test.ts`: 4 de 4 verdes.
  - `fila-de-ia.int.test.ts`, só os cinco casos novos ou alterados: verdes.
  - `tutor.int.test.ts`, só os dois casos corrigidos: verdes.
  - Não rodei as mutações, porque esta auditoria não altera arquivo. O documento diz que os 80 blocos foram corridos pelo portão.
- **Sem pendências:** nenhum `.skip`, nenhum teste comentado e nenhuma chamada a provedor pago.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `tutor.int.test.ts:608`: o controle do caso "relê o contexto" usa `naQuestao(3)`, e três dos quatro casos mandam `onde: {}`. Um controle com o mesmo formato do caso (sem questão) cobriria também o caminho do turno que não vem de uma questão.
2. `apps/worker/src/shutdown.test.ts:35`: os "3 s" estão escritos à mão. Importar `ESPERA_APOS_INTERROMPER_MS` de `apps/api/src/ia/worker-de-ia.ts` faria o teste acompanhar se a constante mudar. Ele também usa o `SHUTDOWN_GRACE_MS` do `apps/worker`, e não a graça do `worker-ia`. Hoje os dois valem 20 s, mas são números diferentes.
3. As recomendações da 1ª rodada que ficaram sem aplicar seguem com destino registrado na tabela da tarefa e no `TODO.md`. Duas delas pedem atenção quando chegar a vez: a entrega paralela do mesmo job, que é da 6.0, e o pool com o gateway real, que é da 11.0.
