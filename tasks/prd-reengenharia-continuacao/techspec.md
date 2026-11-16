# Tech Spec — Reengenharia, continuação (X6)

**PRD:** `tasks/prd-reengenharia-continuacao/prd.md` · **Cenários de teste:** `cenarios.md`
**Status:** rascunho

Joaquim, 15/11/2026: o worker de IA é um segundo ponto de entrada do `apps/api`; o modelo menor é opcional, fora do Tutor até a
medida da D36. Vale o desenho de `tasks/prd-reengenharia/onda-3a.md` e `onda-3c.md` onde esta spec não diz outro.

## 1. Resumo da abordagem

Cada tarefa de IA ganha um **comando registrado**, que relê do banco, pelo id da execução, o que hoje vai por closure ao
`ExecucaoScheduler`. O `agendar` grava o job `ia.executar` (`executor: 'api'`) no outbox (D49), na transação da execução, e
`apps/api/src/main-worker.ts` (`NestFactory.createApplicationContext`) o consome. Os tokens usam o `RateLimiterRedis` (D81), não a
porta própria de `onda-3c.md`. O `worker-pdf` não muda.

## 2. Módulos afetados

| Módulo | O quê |
|---|---|
| `packages/core/src/jobs/` | `JobExecutor` e `SlotReleasedNotifier`, vindos de `apps/worker` |
| `packages/shared/src/system/`, `packages/core/src/queue/` | `ferramenta` em `QUEUE_NAMES`, `QUEUE_PRIORITY` e `WORKER_POOL_OPTIONS_BY_QUEUE` (como a `interativa`); `ia.executar` em `JOB_DEFINITIONS`: `escopo: 'escola'`, `filas: ['interativa', 'ferramenta', 'normal']`, `prazoMs: 150_000`, `naoUrgente: false`, uma tentativa |
| `apps/api/src/ia/` | comandos, `agendar`, `ExecucaoProcessor`, varredura; sai o `InProcessAgenteExecutor` |
| `apps/api/src/{tutor,assistente,artefato,governanca}/` | as closures viram comando no módulo dono |
| `apps/api/src/main-worker.ts`, `worker.module.ts` | domínio, provedor, executor; o `AppModule` sai do `LLM_PROVIDER` |
| `packages/core/src/ia/` | no `LLMGateway`: `TokenLimiter`, degradação, D62, métricas; `categoriasEnviadas` e `maximoDeTokensDeEntrada` por tarefa; `PEDIDO_ACIMA_DO_TETO` (503) em `LLM_ERROR_CODES`, `shared/src/errors` e `HTTP_STATUS_BY_CODE`; `PASSAGEIROS`, com ele, vai da web para `shared` |
| `tutor/supervisao.repository.ts`, `shared/src/tutor/uso.ts`, `professor/turmas/` | a pergunta sem resposta (RF5); a N21 da AIA e a linha "Uso do Tutor" de `docs/lgpd.md` |
| `packages/core/src/config/llm-config.ts` | entram `LLM_TOKENS_POR_MINUTO`, `LLM_MODELO_MENOR_<PERFIL>`, `IA_REPLICAS`; saem `IA_EXECUCOES_POR_ESCOLA`, `IA_EXECUCOES_TOTAL`, `IA_EXECUCAO_TIMEOUT_MS` |
| `packages/core/src/settings/operational-settings.ts` | `VAGAS_ESCOLA_FERRAMENTA` 4; `VAGAS_ESCOLA_INTERATIVA` 10 (R42) |
| `credencial/challenge.ts`; entrada e seletor da web | 54.0 |
| `apps/web/src/api/client.ts`, `routes.tsx`, `components/AreaErrorBoundary.tsx` | 52.0, 56.0 |
| `infra/compose.yml`, `k6/`, `grafana/alertas/` | `worker-ia-1` e `-2`, `FASE=sala`, alertas |
| `docs/` (`infra`, `arquitetura`, `guia-do-desenvolvedor`, `runbook`, `lgpd`, `aia/tutor`); `schema/execucao-agente.ts` | a IA no worker |

## 3. Modelo de dados

Sem tabela nem coluna. A próxima migration (hoje, 0058), no molde da `0049`, põe `ferramenta` em `job_registro_fila_valida` e
`configuracao_operacional_vagas_validas` (`NOT VALID`, `VALIDATE`, `lock_timeout`), compatível com o código anterior.

## 4. API

Nenhuma rota nova. `GET /v1/execucoes/:id` aplica o corte da espera (§5); `GET /v1/tutor/uso` ganha `semRespostaHoje` por aluno.
Com o Redis fora, a escolha de escola e o segundo fator dão `503 INDISPONIVEL_TENTE_DE_NOVO` com `Retry-After` (hoje, `401`).

## 5. Fluxo

**O comando.** `ExecucaoCommand<E, S>`: `tarefa`, `fila`, `preparar(execucao)` → `{ entrada, lido, alunoId?, turmaId? }` e
`concluir(saida, lido, tx, execucaoId)`, um por `TarefaDeIa` (salvo `relatorio_da_correcao`, sem chamador). O `aoGravar` fica na requisição; antes de mover um `aoConcluir`, testes fixam o hash de cada prompt e a entrega `pendente`.

Como a 1.0 o fez (`ExecucaoComComando` no `agendar`, `RegistroDeComandos`, `comRegistro` e `paraExecutar`, em `apps/api/src/ia/`): o pedido
traz o nome da tarefa (`comando`) e a entrada que fica gravada, e o agendador acha o comando no registro; `paraExecutar(id)` relê a execução
pelo id, no escopo (escola, ano e quem pediu), e a de outra tarefa é `NAO_ENCONTRADO`. A caracterização (a 1.1) vai **no mesmo commit** da
tarefa, e não num commit antes: o commit `(tarefa N.0)` é o que leva a rodada da Mesa, e um commit só de teste ficaria sem ela; a prova de que
vem antes é que os dois testes rodaram verdes na árvore ainda sem mudança de produção. O Assistente não cria entrega (só a adaptação cria, e
`pendente`): a caracterização fixa que a conversa e a geração concluem sem entrega. O `ExecucaoDoPedidoRepository` (`assistente/`), que lia a
entrada pela chave, sai: `paraExecutar` o substitui, e as peças que os comandos dividem com os services (`TRECHOS_NA_CONVERSA` e
`contextoDaTarefa` em `ia/contexto-da-tarefa.ts`, que a proposta e a geração dividem, `atividadeOriginal` e `exigirMaterialEmUso` em `artefato/conferencia.ts`, o limiar e o teto do Analista) moram no arquivo
do comando ou da conferência. O comando não escreve linha de log nova: a linha da execução segue sendo a do executor (`ia.execucao.concluida` e
`ia.execucao.falhou`, com `execucaoId`, `escolaId`, código e duração), e o texto da professora não entra nela.

**O Tutor, como a 2.0 o fez** (`tutor/turno.command.ts`): o `TurnoDoTutorCommand` (fila `interativa`) relê a pergunta **pelo id da
execução** (`TutorDoAlunoRepository.perguntaDaExecucao`, no escopo do aluno da sessão; a `perguntaDaChave` saiu) e repete, no `preparar`, o
alcance do `POST`: a turma do aluno, a atividade, a questão, o material e a série, e a avaliação aberta. Essa conferência é uma peça só, a
`AlcanceDoAluno` (`alcance`, `doMaterial`, `contexto`), que o `TutorService` e o comando dividem, e que leva a contagem de
`SEM_MATERIAL_DA_SERIE`; com ela moram em `turno.command.ts` `questaoSemGabarito`, `memoriaDoTrabalho` e as constantes do turno
(`TRECHOS_NO_TURNO` e as outras). O `preparar` devolve o aluno e a turma para o freio do dia e o pacote do mês (D38). O `concluir` grava o
`assunto_delicado` (mensagem fixa e `atencao_humana`, sem referência) **numa transação própria**, antes de tocar a da conclusão: a execução
que a varredura, o prazo ou a prova que abriu já encerraram não desfaz o encaminhamento, e o `concluir` repetido relê o que ficou gravado
(chaves únicas, um sinal só). A resposta comum confere a avaliação aberta de novo na transação da conclusão, e a desfaz com
`TUTOR_PAUSADO_EM_AVALIACAO`. O `#encaminhar` do `POST` (a regra reconhece o assunto antes da fila) continua na requisição, com a sua
execução já `concluida`, sem comando. O `ExecucaoRequest` saiu do `agendar`: toda tarefa tem comando, e a conferência é
`tarefasSemComando` (`registro-de-comandos.ts`), que reprova o registro vazio, o catálogo vazio e o comando de tarefa fora dele, e só aceita sem
comando as `TAREFAS_SEM_CHAMADOR` (o `relatorio_da_correcao`).

**O contexto no worker.** A escola vem de `job_registro.escola_id`; o `preparar` lê a execução no escopo, monta o contexto
(`solicitada_por`, ano letivo da linha, papel do vínculo ativo) e repete o alcance do `POST` (turma, atividade, material) e a
suspensão da função. Eliminado, vínculo encerrado ou sem alcance: `NAO_ENCONTRADO`, sem modelo nem `consumo_ia`.

**Os estados**, em `execucao_agente`, sempre por `update` condicional com o `now()` do banco:

| Estado | Entra por | Sai por | Prazo, estouro e processo morto |
|---|---|---|---|
| `pendente` | `POST`, com o job no outbox na mesma transação | processador, para `rodando`; corte, para `falhou IA_INDISPONIVEL` | o processador tenta primeiro o `pendente → rodando` (`where estado = 'pendente'`, e na `interativa` também `criada_em >= now() - 20 s`) e, com zero linhas, **o corte** (`where estado = 'pendente' and criada_em < now() - 20 s`, só `interativa`). O `GET` também corta, só a `interativa` `pendente` vencida, depois de lê-la no escopo de quem pediu e com as mesmas cláusulas. `ia.espera_estourada` soma só quando o corte devolve a linha |
| `rodando` | processador | `concluida`, ou `falhou <código>` | **prazo único da execução** (`rapido` 60 s, `padrao` 140 s), contado do `rodando` e repassado como `pedido.sinal`: cobre a espera dos tokens, as duas tentativas do gateway e o degrau, e cada chamada usa o menor entre o `LLM_TIMEOUT_MS_*` de hoje e o que sobra. Estourado pelo próprio sinal, o processador grava `falhou IA_TEMPO_ESGOTADO` (o código de hoje), sem `erro_inesperado`; o abort do desligamento não grava e fica para a reentrega. Worker morto: a reentrega (~15 s) acha `rodando` e grava `falhou EXECUCAO_INTERROMPIDA`, sem modelo, com a linha estimada (§8) |
| `concluida`, `falhou` | — | — | finais |

**A varredura** (`main-worker`, a cada 60 s, `@Unscoped`) encerra com `EXECUCAO_INTERROMPIDA` a `rodando` iniciada antes de
`now() - 300 s` (2 × `prazoMs`), com a linha estimada, e a `pendente` sem job vivo, sem linha. "Sem job vivo" é `not exists` em
`job_registro` não finalizado da mesma escola, com `fila in (…)`, `tipo` e `dados->>'execucaoId'`, pelo `job_registro_pendentes_idx`
(`EXPLAIN` na tarefa); a linha estimada leva a escola do `returning`. O motivo do `@Unscoped` diz isso.

**A D36 e a S12.** O `concluir` do Tutor grava o `assunto_delicado` (mensagem fixa e `atencao_humana`, chaves únicas de hoje)
numa transação própria, antes da conclusão condicional. A avaliação aberta se confere
no `preparar` e no `concluir`. A conferência do assunto delicado roda antes da fila (`tutor.service.ts`, `#encaminhar`), sem job.

**A fila.** Tutor na `interativa`; ferramentas, artefato e `propor_ferramenta` na `ferramenta`; Analista na `normal`. Vaga de
hoje; pool por réplica de `onda-3a.md`; o job não segura conexão durante o modelo. `QUEUE_PRIORITY` (`smallint`, só ordena a
varredura e a reconciliação) passa a `interativa` 1, `ferramenta` 2, `normal` 3, `lote` 4, `pdf` 5, e as constantes que
`infra/scripts/` copiam (`PRIORIDADE_DA_FILA_PDF`, a do lote do expurgo da carga) seguem. A `VAGAS_ESCOLA_FERRAMENTA` entra no despachante e em toda réplica do
worker (o pool da `ferramenta` nasce com o `worker-ia`, na 5.0, como `WORKER_IA_POOL_FERRAMENTA`: veja "Como a 5.0 ficou"). O `JobExecutor` no `core` leva o `bullmq` ao `package.json`
dele (`DelayedError`, `UnrecoverableError`).

**Como a 5.0 ficou (o código manda).** (1) O `worker-ia` é o `main-worker` da API: a mesma imagem (`educa-api`, alvo `api`) com outro `command`, como o `migrar`; o pool de cada fila é
`WORKER_IA_POOL_INTERATIVA`, `WORKER_IA_POOL_FERRAMENTA` e `WORKER_IA_POOL_NORMAL`, e o pool de conexões, `WORKER_IA_BANCO_POOL_MAXIMO` (20). O prefixo é próprio porque o
`worker-interativo` lê `WORKER_POOL_INTERATIVA` e `WORKER_POOL_NORMAL` com outros valores (50 e 30) na mesma `.env`. `IA_REPLICAS` é 2, igual às duas réplicas do compose, e
`POSTGRES_CONEXOES_MAXIMAS` é 300 (as 20 conexões de cada `worker-ia`, as da API, as dos workers comuns e do despachante, com folga). (2) A `ApiConfig` mantém o `ia`: a API não monta o
provedor, mas valida a configuração (a subida em produção recusa o adaptador falso, e `IA_REPLICAS` entra no teto por réplica). (3) A execução de IA roda **como a pessoa que pediu e sem sessão**:
`RequestSessao.sessaoId` é opcional, e quem precisa da sessão em si (sair, trocar de escola, renovar a atividade) chama `requestSessaoDeRequisicao`. (4) O `agendar` lê a chave antes de gravar: o
`insert … on conflict` espera a transação que está mudando a linha (o worker, passando-a a `rodando`), e o reenvio esperaria com ele; a corrida do clique duplo em paralelo ainda cai no
`on conflict` e devolve a mesma execução. (5) O `ComandoExecutavel` ganha o passo opcional `antesDeConcluir`, **fora** da transação da conclusão: o encaminhamento da D36 (a classificação do modelo) grava
a mensagem fixa e o sinal numa transação própria e já concluída, e a conclusão só registra o resultado, para a execução nunca segurar duas conexões do pool ao mesmo tempo. (6) O prazo único é o do perfil
(`PRAZO_DA_EXECUCAO_MS`: 60 s no Tutor, 140 s nos demais): a folga de 5 s (`FOLGA_DO_PRAZO_MS`) é a de gravar a falha antes dos 150 s do job, e o prazo vira `IA_TEMPO_ESGOTADO` só quando o sinal
é o do prazo; o abort do job (desligamento do worker) não grava.
(7) O Tutor **desligado na escola (D84)** e **fora da política da turma (D19)** não são conferências da API de hoje: o `TutorService` confere a função suspensa (D9), a avaliação aberta (D70) e o freio e o pacote (D38), e `GET /v1/tutor/conversa` diz em código que "nesta fatia não há política de Tutor por turma" (`fora` não é devolvido). O "nenhum job" da suspensão, da avaliação e do pacote tem caso; o do desligado e o do fora da política espera quem criar a conferência.

**Como a 6.0 ficou (o código manda).** (1) **Quem encerra a reentrega é o `update`, e não a leitura de antes.** O processador tenta o `pendente → rodando`; com zero linhas, tenta `rodando → falhou EXECUCAO_INTERROMPIDA`
(`ExecucaoRepository.encerrarRodando`, `where estado = 'rodando'`, na escola do contexto) e, **na mesma transação**, grava a linha estimada; zero linhas de novo é a execução que já terminou, e nada se grava. O `lida.estado`
só vai ao log: nas "duas leem `pendente`", a perdedora do `update` acha a linha `rodando` da vencedora e a encerra, como na "duplicada em corrida"; o modelo é chamado uma vez, e a conclusão da vencedora se desfaz. A gravação da linha que
falha desfaz o encerramento (a execução segue `rodando` para a varredura, e o aviso `ia.execucao.interrupcao_nao_gravada` leva só ids). (2) **A varredura são dois métodos `@Unscoped`** (`encerrarRodandasVelhas` e
`encerrarPendentesSemJob`; `falharInterrompidas` saiu), em SQL cru: o limiar da `rodando` é o do banco, `iniciada_em < now() - 2 × prazoMs do ia.executar` (`LIMITE_DA_RODANDO_SEGUNDOS`, 300), e a `pendente` não tem limiar de idade: ela só nasce com o job
vivo no outbox (mesma transação), e "sem job vivo" é o `not exists` da §5, sem ler o Redis. O `update` repete `estado` no alvo: duas réplicas na mesma linha encerram uma vez só, com uma linha. (3) **A conta do laço** (§7c, "Laços e ritmo"): lote
de 200 (`LOTE_DA_VARREDURA`), no máximo 5 passos por tipo (`PASSADAS_MAXIMAS`), cada passo numa transação com `statement_timeout` de 5 s (`PRAZO_DO_PASSO_MS`): 2 tipos × 5 × 5 s = 50 s ≤ 60 s (`PIOR_CASO_DA_VARREDURA_MS`);
a volta não se sobrepõe à anterior, e `encerrar()` (o SIGTERM) não deixa começar outro passo. (4) **A linha estimada** (`consumoEstimadoDaInterrompida`, `packages/core/src/ia/consumo.ts`): `estado = 'falhou'`, `codigo_de_erro = 'EXECUCAO_INTERROMPIDA'`,
`tokens_de_entrada` e `tokens_de_saida` são os dois tetos da tarefa (`TASK_CATALOG`), `tentativas` 1, `aluno_id`, `entrada` e `saida` nulos, `duracao_ms` desde o `rodando` (pelo banco), e `origem`, `modelo`, `envio_externo` e `provedor` são os do
adaptador configurado (`destinoDoAdaptador(config)`, a mesma conta de `createLLMGateway`), que o `IaDoWorkerModule` provê (`DESTINO_DO_ADAPTADOR`) ao processador e à varredura. A fiação fica em `ia-do-worker.module.ts` e `worker.module.ts`
(o `main-worker.ts` não mudou). (5) **O `EXPLAIN`** é o da sondagem do `not exists` por `pendente` (a escola e o `execucaoId` dela), que desce pelo `job_registro_pendentes_idx` com `fila` e `escola_id` na condição. (6) **O log** da reentrega
(`ia.execucao.interrompida`: `execucaoId`, `escolaId`, `tipo`, `codigo`) e o da varredura (`ia.execucao.interrompidas_encerradas`: `total`, `rodandoTotal`, `pendentesTotal`) não levam texto, nome nem lista de execuções.

**Como a 7.0 ficou (o código manda).** (1) **O corte é um `update` só, de `ExecucaoRepository.cortarEspera`**: `where escola_id = <a do contexto> and id and estado = 'pendente' and criada_em < now() - 20 s`, `set estado = 'falhou', erro =
'IA_INDISPONIVEL', concluida_em = now()`; o processador e o `GET` o disputam, a decisão é do banco, e **só quem recebe a linha soma `ia.espera_estourada{escola_id}`** e escreve o log `ia.execucao.espera_estourada` (`execucaoId`, `escolaId`, `tipo`,
`codigo`). (2) **No processador**, a passagem `pendente → rodando` da `interativa` ganha `criada_em >= now() - 20 s` (`marcarRodando(id, ESPERA_MAXIMA_DA_INTERATIVA_SEGUNDOS)`); com zero linhas, tenta o corte, e só com zero de novo cai na reentrega da 6.0. A
decisão da fila vem do comando registrado (`fila === 'interativa'`): a `ferramenta` e a `normal` não têm corte nem idade na passagem. O `#encaminhar` da D36 (a leitura por palavras, no `POST`) chama `marcarRodando` sem espera: essa mensagem fixa nunca espera vaga. A que o modelo classifica só nasce com a execução já `rodando`, que o corte não pega; e o turno cortado não passa pela leitura do modelo (limitação na AIA do Tutor, item 15). (3) **No `GET`**, depois de
lida no escopo de quem pediu (`deQuemPediu`), só a `interativa` `pendente` tenta o corte, e a resposta é a da linha **relida** (o corte do processador pode ter mudado a linha depois da primeira leitura). A `concluida`, a `rodando`, a `falhou` e a
`pendente` da `ferramenta` não escrevem nada. O id de outra pessoa ou de outra escola responde 404 antes de qualquer `update`. (4) **A métrica** `ia.espera_estourada{escola_id}` e a que a 6.0 deixou, `ia.execucao.interrompida{escola_id, origem}` (`reentrega` ou
`varredura`), são de `MetricasDaExecucao` (`apps/api/src/ia/metricas-da-execucao.ts`), contadas **depois** de o `update` devolver a linha (na varredura, depois do commit do lote: o lote desfeito não conta, e a `pendente` sem job encerrada não conta, porque
não deixou linha estimada). As duas estão em `METRICS_WITH_ESCOLA` (lista fechada) e no inventário `NOMES_NO_PROMETHEUS`; só a escola e a origem vão ao rótulo (D76). (5) **O alerta** (`infra/grafana/alertas/ia-espera-estourada-por-escola.yaml`) são duas regras sobre o aumento
dos últimos 10 min por escola (`soma - (soma offset 10m or soma * 0)`: a série que nasce agora vale o valor inteiro): **uma escola** com 3 ou mais cortes e nenhuma outra (a vaga dela) e **duas ou mais** escolas com 3 ou mais (capacidade), cada uma com a entrada
dela no `docs/runbook.md`. Os painéis 50 e 51 de `fundacao.json` mostram as duas métricas. (6) **A tela**: nenhuma mudança de marcação em `Tutor.tsx` (a falha vem depois da lista, e a mensagem fixa, que é item da conversa, já fica acima do botão). O que mudou foi
`pendenteNoTutor`: a mensagem fixa gravada **depois** da pergunta não a esconde, e a pergunta deixa de aparecer duas vezes quando as duas chegam juntas.

**Os tokens (49.0).** `TokenLimiter.reservar(modelo, estimativa, fila)`, com caracteres ÷ 4 + `maximoDeTokensDeSaida`, nova a cada
chamada e acertada pelo uso real (a da interrompida não volta: superestima por até 1 min). O balde geral, por
`provedor:modelo`, tem 80 % do `LLM_TOKENS_POR_MINUTO`; a `ferramenta` reserva antes num de 15 %, e a `normal` num de 10 % (o
"até metade" do RF7), devolvido (`reward`) se o geral recusar; a espera segue o `msBeforeNext` e o `pedido.sinal`. Com o Redis fora, cada réplica segura o teto ÷ `IA_REPLICAS` (`insuranceLimiter`). Sem vaga, espera até
8 s, dentro do prazo da execução; depois o `LLM_MODELO_MENOR_<PERFIL>` (mesmo provedor, mesma D62, com preço em `consumo.ts`, ou a
subida falha); então `IA_INDISPONIVEL`. **O `turno_do_tutor` pula o modelo menor** (D36, regra 30.11): liberá-lo pede a medida de
risco à vida e a suíte de recusa em `docs/avaliacao-de-modelos.md` e uma decisão registrada. Sem modelo menor, o degrau é
pulado. `consumo_ia` grava o modelo que respondeu.

**A D62.** Cada tarefa declara `categoriasEnviadas` (com `levaTextoDeAluno`, inclui `conversa_do_aluno`). Na subida da API e do `main-worker`, com provedor externo, o
`suboperador` vigente da `IA_PROVEDOR_ID` precisa de `pais = 'BR'`, `veda_treinamento`,
`alcance = 'todas'` e, em `categorias`, a união das tarefas registradas; com o banco fora, não fica pronta. O falso e o local
sobem. A cada chamada, o `LLMGateway` recusa a tarefa com `levaTextoDeAluno` sem declaração conferida, antes do
orçamento e do `fetch` (`IA_INDISPONIVEL`, log `ia.geracao.soberania_recusada`). Encerrar o suboperador pede reiniciar API e
`worker-ia` (runbook).

**A pergunta sem resposta (RF5).** Em `supervisao.repository.ts`, `semRespostaHoje` conta as perguntas de hoje (`FUSO_DO_USO`)
que terminaram num código passageiro (a lista `PASSAGEIROS`)
sem mensagem fixa, com o recorte de turma, ano e disciplina de `ultimasTrocas`, sem texto; a última pergunta passa a incluí-las.
A S12, a suspensão e o `NAO_ENCONTRADO` não contam. `trocasHoje`
(todas as disciplinas) e o freio não mudam. A linha do aluno mostra, neutro e separado do freio, "N perguntas que o Tutor não
respondeu hoje".

**A web (52.0, 56.0).** O `apiRequest` liga um `AbortController` próprio ao sinal de quem chamou, com os prazos do RF11: o
estouro vira `ApiError(TEMPO_ESGOTADO)`; o cancelamento relança o `AbortError`, fora da tela. `material.ts` e `artefatos.ts` usam
o mesmo `comPrazo`, e `no-restricted-globals` barra `fetch` fora do cliente. O `PUT` estourado vai para o fim da
`fila-de-respostas`. Um `AreaErrorBoundary paginaInteira`, com texto próprio ("Esta tela não abriu"), envolve o `<Switch>` de `AppRoutes`: o
`<Switch>` e as rotas dele passam a ser o componente `RouteSwitch`, com o corpo como estava, e `AppRoutes` devolve só a fronteira em volta
de `<RouteSwitch />` (o diff do `<Switch>` fica de um recuo a menos). O `Falha` ganha "Voltar ao início" (`<a href="/">`, que recarrega a
página e por isso limpa a fronteira; a prop `voltarPara` da fronteira, `/operacao` na operação; 44 px, secundário). O clique não é
impedido: a saída da `Falha` só se vê no navegador (e2e); o `jsdom` não navega. Os dois botões quebram em linha com o `flex-wrap`: a 360 px
já não cabem lado a lado (173 e 181 px, mais o vão de 12 px, passam dos 328 px da área), e o `flex-wrap` se prova a 280 px (celular dobrável
fechado), porque o caso de 360 px não lê a posição do segundo botão e a mutação do `flex-wrap` não ficou vermelha nele; os 44 px se leem no
`min-height` do estilo, porque o link sem a classe herda a altura do irmão.

**O prazo do cliente (52.0), como ficou.** (1) `comPrazo(tipo, sinalDeFora, executar)`, em `api/client.ts`: o `executar` recebe
o `pedir` (o `fetch` ligado ao sinal do prazo) e o sinal. O `fetch` só existe em `client.ts`, a única exceção do
`no-restricted-globals`, e por isso `material.ts` e `artefatos.ts` chamam `pedir`, e não `fetch` (a `comPrazo(sinal, limiteMs)`
da `onda-3c.md` é anterior a isso). (2) O prazo cobre o pedido **e a leitura do corpo** (`lerJson`, o `blob()` do PDF, a leitura
do erro do PDF): cabeçalho que chega e corpo que pendura também sai `TEMPO_ESGOTADO`. (3) O tipo da chamada escolhe o prazo
(`tipo` em `RequestOptions`; `leitura` quando não dito): `responderQuestao`, em `api/atividades-do-aluno.ts`, pede `tipo: 'prova'`
(10 s); o PDF usa `pdf` (30 s) e o envio de arquivo, `envio` (180 s). (4) Na fila, a gravação que estoura vai para o fim, com a
mesma `sequencia` (`paraOFim`, em `respostas.ts`), e, **havendo outra escolha esperando** (`haOutraEsperando`), a seguinte sai
na hora, sem o recuo; com uma só na fila vale o recuo de sempre, e a falha que não é estouro também. A escolha trocada
enquanto a velha pendurava não é movida: a velha já saiu da fila. (5) O lint: `no-restricted-globals` barra o `fetch`, e
seletores do `no-restricted-syntax` barram `x.fetch`, `x['fetch']`, `const { fetch } = x`, `import { fetch }` e `export { fetch }`,
em `apps/web/src` e fora do teste e do `__fixtures__`; o bloco do kit visual repete os seletores (o `no-restricted-syntax` dele
sobrescreve o do `fetch`); a exceção é só `api/client.ts` (`ARQUIVO_DO_CLIENTE`), e a regra está em `REGRAS_DAS_GUARDAS`.
(6) **A marca de origem.** O estouro do cliente e o `TEMPO_ESGOTADO` da API têm o mesmo código, e a tela decide pelo código. O
`ApiError` criado em `comPrazo` leva `origem: 'cliente'` (terceiro argumento do construtor; `estourouNoCliente(erro)` a lê), sem
mudar o catálogo de `packages/shared`. Só ela libera a seguinte da fila de prova na hora (`bombear`); o `TEMPO_ESGOTADO` da API passa
pelo recuo com jitter (regra 80, item 6). Só ela entra em `ehResultadoIncerto`: a resposta não chegou e o servidor pode ter gravado,
enquanto o 503 da API é recusa. O aviso da decisão da correção (`Aprovar.tsx`) não afirma "nada foi aprovado" no `TEMPO_ESGOTADO`.

**O Redis fora (54.0).** `#semRedis` de `credencial/challenge.ts` devolve `INDISPONIVEL_TENTE_DE_NOVO` com `Retry-After`, como
`operacao/operador-challenge.ts`, e `conferirLivre` vem antes de qualquer reserva. A web espera o `Retry-After` uma vez, até 10 s,
com o botão desabilitado e um aviso em `role="status"`; acima disso, ou num segundo `503`, o `ErrorState`. O seletor mantém a
escola. O `docs/runbook.md` ("Seguro de limite ativo", causa 4) cita o 401 do desafio sem Redis e o "volta ao login": passa a dizer 503 e a
espera única da tela, no commit desta tarefa (14.3). A espera é de 0 a 10 s, com o piso de 1 s da entrada (`ESPERA_MINIMA_NO_503_MS`: um `Retry-After: 0` não faz a escola
martelar a rota); o hook `useEsperaDoIndisponivel` e a região `AvisoDaEspera` (visível na espera, `sr-only` fora dela, a contagem em `aria-hidden`) ficam em
`pages/espera-do-indisponivel.ts`, e a falha de cada tela (`FalhaDoSegundoFator`, `FalhaDaEscolha`, `FalhaDaTroca`) é uma peça pequena do próprio arquivo, por causa do
limite de complexidade do lint. A repetição só sai para quem pediu: a tela que saiu, ou o desafio da aba que mudou, a descarta. **O 503 depois do código certo:** se o Redis cai no `consumir` de `MfaService`, depois de o código certo ter gasto o passo (ou o código de recuperação), o 503
que manda repetir faria a web repetir o mesmo código, e a resposta seria "código incorreto". Esse caso sai como `TEMPO_ESGOTADO` (a web não o repete sozinha), com o texto
próprio da tela do segundo fator da entrada (`AVISO_DO_CODIGO_GASTO_SEM_ENTRAR`), que manda digitar o código seguinte **sem afirmar que o código estava certo**: a API dá o
mesmo código no `statement_timeout`, que pode vir antes da conferência. O estouro do prazo no navegador (`estourouNoCliente`: a resposta não chegou, e a web não sabe
o que a API fez) fica com o texto geral do `TEMPO_ESGOTADO`. Quando o `consumir` falha, o convite do desafio já pode ter sido ativado (`ativar` vem antes): a ativação
fica, e o código seguinte entra por ela. O seletor troca pelo token, que não passa pelo desafio do Redis: a espera dele vale para qualquer
`INDISPONIVEL_TENTE_DE_NOVO` da troca. A ativação do segundo fator mostra o texto do catálogo, sem espera automática.

## 6. Isolamento (obrigatório)

O payload é `{ execucaoId: uuid }`, estrito. O `ExecucaoRepository` lê a escola de `requireEscolaId()`, e nenhum método a recebe
por argumento: sai de `REPOSITORIES_SEM_ESCOPO`, salvo a varredura (`@Unscoped`). Testes em `cenarios.md` §6.

## 7. Dado pessoal (obrigatório)

| Item | Resposta |
|---|---|
| Campos pessoais | nenhum novo; em `docs/lgpd.md`, a linha `job_registro` cita `ia.executar`, e a de `consumo_ia` diz que a linha estimada leva o provedor sem saber se o envio saiu |
| Log e envio | log só com ids, tarefa e código; a interrompida conta como envio (§8) |
| Titular e autorização | a interrompida entra no rastro pelo `execucao_id`; o `preparar` repete o alcance |

## 7b. Conformidade CNE

Tutor de alto risco; supervisão igual (D8, D47), mais a pergunta sem resposta. A AIA do Tutor registra como limitação o turno sem modelo (espera, teto, D62), só com a regra da D36. O `conformidade-reviewer` revisa as tarefas de comando, de worker, de tokens, de D62 e do uso.

## 7c. Carga e falha (obrigatório)

| Item | Resposta |
|---|---|
| Carga na manhã | `docs/infra.md` §3.2: 0,75 turno/s por escola; no pico, ~1,5 milhão de tokens/min do Tutor e ~0,2 de ferramenta (⚠️ §12). Com a `normal` cheia, o piso do contrato é 1,7 ÷ 0,7 ≈ 2,5 milhões, registrado no `docs/infra.md` |
| Limite por escola | 10 na `interativa`, 4 na `ferramenta` |
| Corridas e índices | `cenarios.md` §1; sem índice novo |
| Dependência fora | Redis: `POST` 202, `interativa` cortada, `ferramenta` roda na volta, escolha de escola 503. Provedor: disjuntor e degrau |
| Métrica e alerta | as de `onda-3c.md` e `ia.espera_estourada{escola_id}`; alertas "IA: espera estourada", "Provedor de IA fora", "Tokens acima de 80 %" do contratado (o balde cheio; o runbook diz que é saturação) com aviso aos 70 % (~68 % no pico), "Pedido acima do teto" e o `job-interativo-esperando.yaml` também na `ferramenta`, com runbook |
| Carga | `justica-entre-escolas.js`, `FASE=base` e `FASE=sala`, com `kill -9` e o `LLM_TOKENS_POR_MINUTO` de `infra/carga.env` na escala do falso, que informa 3.000 + 250 tokens por turno; relatório, não portão |

`POSTGRES_CONEXOES_MAXIMAS` comporta 20 por `worker-ia`; `IA_REPLICAS` bate com o compose (`tools/ci/compose.int.test.ts`).

## 8. Uso de IA

Sem tarefa nem prompt novo. `TaskDefinition` ganha `maximoDeTokensDeEntrada`, obrigatório: o pedido do
`montarPedido` com cada campo no limite do `esquemaDeEntrada`, mais o prompt. A recusa acima dele, antes do limitador e do envio, é
só guarda de defeito: `PEDIDO_ACIMA_DO_TETO`, sem `consumo_ia`, com "Tentar de novo", `ia.pedido_acima_do_teto{tarefa}` e
alerta. O teto do Analista é o valor do gerador, ~642 mil tokens (100 recortes × 60 habilidades × 300 caracteres de habilidade): o schema dele não muda, e o limitador reserva pelo pedido real (§5), não pelo teto. O gerador falha em campo sem limite, e o do Analista que não tinha era a `disciplina.nome` do recorte, do recorte nominal e do alerta (`packages/shared/src/governanca/analista.ts`): ganha `.max(TAMANHO_MAXIMO_NOME_DISCIPLINA)`, o mesmo que o cadastro já impõe (80). A métrica entra nos inventários fechados (`tools/testes/metricas.ts`, o painel `infra/grafana/paineis/fundacao.json`, `infra/scripts/ensaio-alertas.ts`, `tools/guardas/alerta-tem-runbook.test.ts`, `docs/mvp-contratos.md`) e o `medidor` chega ao gateway por `app.module.ts` e `ia.module.ts`. A `rodando` interrompida (reentrega ou varredura) grava, na transação que a encerra, uma linha em `consumo_ia` com os dois
tetos, `entrada`, `saida` e `aluno_id` nulos (o freio não a conta) e o envio do adaptador configurado (`envio_externo`,
`provedor`). Superestima custo e destino, nunca subestima (D14).

## 9. Frontend

O `Falha` com "Voltar ao início", o aviso da espera e a linha do aluno no uso; `celular` a 360 px (`cenarios.md` §7).

## 10. Testes

Em `cenarios.md`, com mutação, incluindo a bancada `apps/api/test/fila-de-ia.fixture.ts`, para onde migram as 23 trocas de
`EXECUTOR_DE_AGENTE`.

## 11. Conformidade com as regras

Desvios: 80.4 sem provedor de reserva (F5, D29); 80.5 com disjuntor por réplica (48.0).

## 12. Premissas não verificadas

⚠️ NÃO VERIFICADO: "1 ferramenta por minuto por escola", ~2.000 tokens por proposta e 3.000 + 250 por turno (com 5.000 + 300,
o piso vai a ~3,7 milhões; o `docs/infra.md` registra os dois); a `FASE=sala` mede. Teto real e modelos menores: D37. `LLM_TOKENS_POR_MINUTO` é obrigatório fora do `AMBIENTE=local`.

## 13. Riscos técnicos

- **O `main-worker` montar a API.** Teste: ele sobe sem controller nem porta; o `AppModule`, sem `LLM_PROVIDER`.
- **Rollback com `ia.executar` em voo.** A varredura antiga encerra a `pendente`; a tarefa confere que o despachante anterior não
  trava em linha de `ferramenta` nem de tipo desconhecido. Deploy fora do horário letivo (80.9).
- **Memória na VPS (D82).** O compose mede o RSS do `worker-ia`.
