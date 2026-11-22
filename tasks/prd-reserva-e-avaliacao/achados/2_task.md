# Achados das revisões — `tasks/prd-reserva-e-avaliacao/2_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-22 15:49:40 · `tasks/prd-reserva-e-avaliacao/2_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa não grava `Nota`, `Correcao` nem tabela de domínio. Ela só traz a conferência da D62 da reserva, o `TokenLimiter` da reserva, a série `ia.provedor_de_reserva.conferido`, o alerta e o runbook. Todos com autor humano? Não se aplica.

Decisão autônoma sobre aluno: ausente. O que a tarefa decide é se o contrato do suboperador da reserva passa na D62 e se a reserva entra no caminho. Nada aprova, reprova ou encaminha aluno.

Aprovação registrada: ok. A "aprovação" desta tarefa é a do modelo para cada tarefa (`MODELOS_APROVADOS`, que vem da 1.0). Ela não substitui a aprovação de saída nem a contorna: a reserva atende o mesmo pipeline e as mesmas tarefas, e a entrega continua nascendo pendente. A exceção da D47 não se estende a nada novo.

Supervisão do tutor: ok. A tarefa não muda visibilidade, registro nem resumo. Se o Tutor for aprovado para a reserva, a conferência exige `conversa_do_aluno` e `trabalho_do_aluno` no contrato. Isso está provado em `packages/core/src/ia/soberania.test.ts:677`, que liga a regra 70 item 4 à D62 sem enfraquecer nenhuma das duas.

Autonomia declarada e visível: sim, sem mudança. Nenhum agente novo e nenhum nível alterado.

Os itens 6 a 9 não foram tocados:
- **Auditoria:** a tarefa não chama provedor. O registro de qual provedor atendeu cabe à 4.0.
- **Vigilância:** a série e o log não levam escola, aluno nem usuário. Há um teste para o yaml em `infra/test/alertas.test.ts`.
- **D55:** a tarefa não cria campo, prompt nem tela sobre discursiva ou redação.
- **Professor:** a tarefa não cria métrica de professor.

A tarefa não tem tela, então não há fotos a conferir.

Bloqueantes: nenhum.

Recomendações:
- **Para a 4.0 e a 7.0.** Quando a chamada passar a ir à reserva, a consulta de auditoria ("o que a IA gerou, quem aprovou, quando") deve mostrar também qual provedor gerou o item, pela `consumo_ia.provedor` e pela `pelo_provedor_de_reserva`. Peço um caso que prove isso numa entrega gerada pela reserva e aprovada pelo professor, para o dossiê (D61) não mostrar só o principal.
- **Para a 4.0.** `MODELOS_APROVADOS` (`packages/core/src/ia/modelos-aprovados.ts:36`) aprova todas as `TAREFAS_DE_IA` para a reserva falsa. Vale ter um caso que prove que nenhuma tarefa de discursiva ou redação chega à reserva por um caminho que o principal não teria (regra 70, item 2a). Isso continua valendo depois que a entrada da reserva real substituir a falsa.
- **No runbook** (`docs/runbook.md`, entrada "Provedor de reserva de IA não conferido"). A instrução de avisar as escolas antes de a reserva atender está certa. Sugiro remeter também à atualização da lista de compartilhamento do titular e do dossiê de conformidade quando entrar um suboperador novo, porque a escola cobra os dois na compra.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-22 15:49:50 · `tasks/prd-reserva-e-avaliacao/2_task.md`

**VEREDITO: APROVADO**

A tarefa não cria campo de pessoa, tabela, endpoint nem chamada a provedor. O que entra é a conferência do contrato da reserva (`SoberaniaNaSubida` com a opção `daReserva`), o limitador de tokens dela, uma métrica, um alerta e o trecho do runbook. Nada disso grava, expõe ou envia dado de aluno.

Campos pessoais tocados: nenhum. `ReservaConfig.ambiente` é configuração do processo. A métrica `ia.provedor_de_reserva.conferido` tem um rótulo só, `provedor`, sem escola, usuário ou execução. O teste `infra/test/alertas.test.ts` confere que a expressão do alerta não cita escola, usuário, execução nem aluno.

Fora da tabela de dados do docs/lgpd.md: nenhum.

Autorização por objeto: não se aplica (nenhuma rota). A leitura do cadastro de suboperador é a mesma do principal (`SuboperadorDaEscolaRepository`). Esse cadastro é da operação e não leva dado de aluno.

Logs: limpos.
- `packages/core/src/ia/soberania.ts:157,176,182`: os eventos `ia.provedor_de_reserva.conferida`, `conferencia_recusada` e `conferencia_sem_banco` levam só `provedorId`, `tentativas` e `codigo` ou o resumo do erro.
- `summarizeError` (`packages/core/src/error/summarize-error.ts:49`) devolve sqlstate, tipo e pilha filtrada, sem a mensagem do erro.
- Dois testes provam que a chave da API, o contrato e o nome do suboperador não saem no log, com valores reconhecíveis plantados de propósito:
  - `soberania.test.ts`, caso "o log da recusa nunca leva o contrato, o nome do suboperador nem a chave da reserva…"
  - `apps/api/src/ia/reserva-na-subida.int.test.ts:182-184`, com o logger real.

Auditoria: não é exigida. Nenhuma das ações da regra 20, item 10, acontece aqui.

Envio externo: nenhum nesta tarefa. Os endereços dos provedores nos testes são de mentira (`*.example`) e nenhuma chamada sai. A conferência só deixa a reserva elegível, e a regra falha fechada:
- sem conferência, a reserva não é elegível (`modelos-aprovados.ts:115`, `contexto.soberania?.conferida !== true`);
- a reserva falsa não vale em `producao`;
- a reserva só atende tarefa aprovada.

O registro em `ExecucaoAgente` e em `consumo_ia.provedor` fica para a 4.0, quando a primeira chamada for de fato à reserva.

Seed/fixture: sintético. Os testes usam suboperador "Provedor Sintético da D62", `registrado_por` "equipe-de-teste", chaves aleatórias (`res-<uuid>`) e um contrato "DPA-D62" de mentira. Tudo é apagado no `afterEach`.

Bloqueantes: nenhum.

Pergunta de fechamento: esta tarefa não grava nada sobre aluno e não envia nada a lugar nenhum, então a resposta à secretaria não muda. Quando a reserva começar a ser chamada (4.0), a lista de compartilhamento do titular precisa passar a mostrar o `provedorId` da reserva. Isso é condição para aprovar a 4.0.

Recomendações:
1. **Contrato encerrado sem reinício.** Depois de conferida, a instância não lê o cadastro de novo. O que encerra a reserva de verdade é o reinício dos `worker-ia`, e o runbook manda reiniciar. Como a reserva quase nunca é usada, um esquecimento pode deixá-la elegível por semanas, apontando para um suboperador cujo contrato acabou. Na 4.0 ou na 7.0, vale ler o cadastro de novo de tempos em tempos, ou logo antes do primeiro envio à reserva depois de um tempo parada.
2. **Contrato que permite serviço usado por menor.** O runbook (`docs/runbook.md`, "Provedor de reserva de IA não conferido", causa 2) pede a conferência à mão. O código não confere isso, nem para o principal nem para a reserva. Vale um campo no cadastro de suboperador e um motivo novo (por exemplo `menor_nao_permitido`), pela regra 20, item 13. É uma lacuna anterior a esta tarefa.
3. **4.0 e o arquivo do titular.** Fica registrado para a 4.0 (já anotado na 1.0): a execução que cair na reserva grava o `provedor` da reserva em `ExecucaoAgente` e em `consumo_ia`, e o arquivo do titular e a lista de compartilhamento passam a mostrá-lo.

Arquivos revisados:
- packages/core/src/ia/soberania.ts
- apps/api/src/ia/ia-do-worker.module.ts
- packages/core/src/telemetry/metrics.ts
- apps/api/src/ia/reserva-na-subida.int.test.ts
- infra/grafana/alertas/ia-provedor-de-reserva.yaml
- docs/runbook.md

## infra-guardian · 1ª rodada · APROVADO · 2026-11-22 15:50:12 · `tasks/prd-reserva-e-avaliacao/2_task.md`

VEREDITO: APROVADO
Caminho quente tocado: IA
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ok
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum

Por que cada item ficou ok:

- **Rate limit:** a tarefa não cria limite por IP. O limitador da reserva é um segundo `TokenLimiter`, que usa o mesmo cliente Redis. Ele usa o contratado da própria reserva, e esse valor é obrigatório fora do `local` (`packages/core/src/config/llm-config.ts:248`). Ele também usa os mesmos baldes por fila e divide o seguro pelas réplicas. O balde leva a identidade do provedor na chave, e o caso de `fila-de-ia.int.test.ts` prova que esgotar o balde do principal não esgota o da reserva.
- **Fila e prioridade:** a conferência da reserva não segura o consumo das filas. O `onApplicationBootstrap` dispara a conferência sem esperar por ela, e o `CicloDoWorkerDeIa` só espera a do principal. `reserva-na-subida.int.test.ts` prova que há um consumidor em cada fila e que o batimento é escrito com a reserva recusada. O custo é uma leitura no Postgres a cada 5 s por réplica, e só enquanto a reserva não passa na conferência.
- **Estado em memória:** `conferida` fica em memória, mas vale só para a própria réplica. O alerta lê o menor valor entre as réplicas (`min by (provedor)`), então uma réplica recusada já basta para disparar. Não há sessão, sala, contador nem cache de autorização.
- **Concorrência:** a leitura do cadastro é idempotente, e `start()` é memoizado.
- **Índice e paginação:** a tarefa não cria query em tabela que cresce com aluno.
- **Degradação de IA:** a tarefa não faz nenhuma chamada nova a provedor. A reserva só passa a ser elegível depois de conferida (`reservaElegivel` lê `conferida`, e há teste disso). Nenhum teste chama provedor pago: os endereços são de mentira e o adaptador é o falso.
- **Métrica e alerta:** a série `ia.provedor_de_reserva.conferido` não leva escola. O alerta tem `for: 10m` e `noDataState: OK`, não usa `absent()` e tem parágrafo no runbook, que a guarda `alerta-tem-runbook` confere. A tarefa também acrescenta a série ao painel e a regra ao `REGRAS_PROVISIONADAS`. O cenário do teste de carga não precisa mudar, porque a tarefa não mexe em nenhum request nem no consumo.

Recomendações:
1. `docs/runbook.md:117-119`: o parágrafo "Quando é a reserva", na entrada de `#provedor-de-ia-fora`, fala de um alerta com o `provedor` igual a `IA_RESERVA_PROVEDOR_ID` e de um disjuntor próprio da reserva. Isso só passa a existir quando uma chamada for à reserva, na tarefa 5.0. Marque o parágrafo como valendo a partir da 5.0, ou confira o texto quando ela pousar.
2. Hoje o alerta da reserva também dispara com o Postgres fora (`conferencia_sem_banco` publica 0), ao mesmo tempo que o alerta do banco. O runbook já cobre esse caso (causa 4). Se o barulho incomodar, vale considerar inibir um pelo outro na política de notificação.
3. `apps/api/src/ia/ia-do-worker.module.ts:85`: o callback do gauge é registrado na fábrica, uma vez por montagem do módulo. Em produção é uma vez por processo e está certo. Nos testes que montam o módulo várias vezes no mesmo medidor, os callbacks se acumulam. Um comentário ou a remoção do callback no `onApplicationShutdown` evita leitura confusa num teste futuro.
4. O caso intermitente "o prazo de cada execução é o do perfil", em `apps/api/src/ia/fila-de-ia.int.test.ts`, vem de antes desta tarefa: falhou 3 vezes em 10 rodadas isoladas no HEAD. Registre no `TODO.md` para não virar ruído na esteira.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-22 15:50:23 · `tasks/prd-reserva-e-avaliacao/2_task.md`

**VEREDITO: APROVADO**

**Escopo:** respeitado. As subtarefas 2.1 a 2.4 estão feitas. O gateway recebe as duas portas novas (`soberaniaDaReserva` e `limiteDeTokensDaReserva`) e ainda não as lê; quem as lê é o roteamento, na 4.0 e na 7.0. Nenhuma chamada vai à reserva, então a tarefa não invade a 5.0 nem a 7.0.

**Aderência à Tech Spec:** ok. Houve duas divergências, e as duas estão registradas na `techspec.md` e no `cenarios.md`, não só no `2_task.md`:
- `ReservaConfig.ambiente`: está na §5, no parágrafo "A conferência e o limitador da reserva no worker (2.0)".
- Os eventos `conferencia_sem_banco` e `conferida`: estão na §5, na linha "Log" da §7 e na linha RF1 dos logs no `cenarios.md`.

A conferência da reserva não segura o consumo das filas. O `CicloDoWorkerDeIa` em `apps/api/src/worker.module.ts:55` só recebe a conferência do principal. O alerta tem `noDataState: OK` e não usa `absent()`.

**Portão local:** carimbo válido para o código atual (typecheck, lint, segredo, dependências, unidade e alvo).

**Bloqueantes:** nenhum.

**Recomendações:**
1. `docs/runbook.md:1562`: o "Se nada disso resolver" de "Provedor de IA fora" ainda diz "não há provedor de reserva até a D37". Logo abaixo vem o parágrafo novo "Quando é a reserva", e os dois se contradizem. O ideal é dizer que a reserva existe quando configurada e que ela só atende a partir da 5.0.
2. O mesmo `runbook.md`, no parágrafo novo de "Provedor de IA fora" e no "Impacto" de "Provedor de reserva de IA não conferido", descreve como já funcionando o disjuntor próprio da reserva e o desvio da queda do principal. Isso só passa a existir na 4.0 e na 5.0. Vale marcar a tarefa em que cada coisa entra, ou ajustar o texto quando ela pousar.
3. `infra/grafana/paineis/fundacao.json:2484`: a consulta nova no painel não está nos arquivos previstos nem na Tech Spec. A mudança é pequena e coerente com o alerta, mas deveria constar em "Arquivos previstos" ou nas divergências.
4. `tasks/prd-reserva-e-avaliacao/cenarios.md:22`: a linha RF1 dos logs ganhou os eventos `ia.provedor_de_reserva.*`, mas a coluna do teste ainda aponta só para `llm-gateway.test.ts` e `llm-config.test.ts`. Esses eventos são provados em `soberania.test.ts` e em `reserva-na-subida.int.test.ts`.
5. `packages/core/src/ia/soberania.ts:154-182`: as três escolhas de evento com `this.#daReserva ? … : …` seriam mais legíveis com um mapa de eventos montado uma vez no construtor (`{ conferida, recusada, semBanco }`), em vez de três ternários.

Sobre a nota de contexto: o caso intermitente "o prazo de cada execução é o do perfil" vem de antes desta tarefa e não entrou no veredito.

## llm-integrator · 1ª rodada · APROVADO · 2026-11-22 15:51:05 · `tasks/prd-reserva-e-avaliacao/2_task.md`

VEREDITO: APROVADO

Perfis usados: nenhum. A tarefa não adiciona chamada de modelo. Ela entrega ao gateway a conferência da D62 e o limitador da reserva, e quem os lê é a 4.0 e a 7.0.

Custo estimado por professor/mês: R$ 0. Não há chamada nova a provedor, então não há consumo novo por professor. O custo da reserva só aparece quando uma chamada for à reserva, na 4.0. A única carga nova é uma leitura do cadastro de suboperadores a cada 5 s, e só enquanto a reserva não passa. Ela é por réplica do worker, não por professor.

Prompt versionado: não se aplica.

Validação de schema: não se aplica.

Aprovação humana no caminho: não se aplica. A conferência não decide nada sobre aluno, nota ou entrega.

Bloqueantes: nenhum.

O que conferi:
- **Regra 30.1:** nenhum SDK de provedor foi tocado. Só entram `SoberaniaNaSubida` com a opção `daReserva`, duas portas novas em `LLMGatewayDependencies` e o `TokenLimiter` da reserva.
- **Reserva não segura o principal:** em `apps/api/src/ia/ia-do-worker.module.ts` o provider `SOBERANIA_DA_RESERVA` é separado e só entra no gateway por `soberaniaDaReserva`. O `CicloDoWorkerDeIa` continua esperando só a do principal.
- **Reconferência:** `soberania.ts` confere de novo a cada 5 s (intervalo injetado), sem bloquear o ciclo, e o shutdown limpa o timer.
- **Log (regra 20.9):** os logs da reserva levam só `evento`, `provedorId`, `tentativas` e `codigo` (ou `summarizeError`). Os motivos são códigos fixos. O teste de integração checa que a chave e o contrato não aparecem.
- **Limitador (regra 80.4):** é um `TokenLimiter` próprio, com `LLM_RESERVA_TOKENS_POR_MINUTO`, o mesmo Redis e a mesma divisão por réplicas. O cliente Redis é único e é fechado no shutdown.
- **Alerta (regra 80.10):**
  - `infra/grafana/alertas/ia-provedor-de-reserva.yaml` tem `for: 10m`, `noDataState: OK`, limiar `lt 1` e a expressão sem `absent()` e sem rótulo de escola.
  - O parágrafo em `docs/runbook.md` existe, cobre encerrar o suboperador, avisar as escolas e a checagem do contrato para menor (regra 20.13), e o `#provedor-de-ia-fora` ganhou "Quando é a reserva".
  - `alerta-tem-runbook`, `REGRAS_PROVISIONADAS` e `NOMES_NO_PROMETHEUS` foram atualizados.
- **Sem reserva:** a série não é publicada, o alerta não dispara e o resto não muda.
- **Testes:** a regra é provada com o `WorkerModule` de verdade, banco e Redis reais e adaptador falso, sem provedor pago.
- **Execução:**
  - Unitários: 290 passam (`soberania`, `metrics`, `alertas`, `alerta-tem-runbook`, `llm-config`, `llm-gateway`).
  - Integração: `reserva-na-subida.int.test.ts` passa inteiro, e `fila-de-ia.int.test.ts` passa 28 de 29 na rodada completa.
  - A falha é "o prazo de cada execução é o do perfil", que a tarefa não altera. Ela passou ao ser rodada sozinha e parece intermitente sob carga (a bancada não ficou ociosa no prazo).

Recomendações:
- Investigar a intermitência de "o prazo de cada execução é o do perfil" em `apps/api/src/ia/fila-de-ia.int.test.ts:765` na rodada completa (a `FilaDeIa.ociosa` estoura o prazo). Não é desta tarefa.
- A coluna "Recomendações sem aplicar" de `tasks/prd-reserva-e-avaliacao/2_task.md` está vazia. As recomendações do `privacy-guardian` sobre `ExecucaoAgente` e `consumo_ia.provedor` já estão marcadas como da 4.0 na autoconferência; vale replicá-las ali.
- Quando a 4.0 ligar a reserva ao roteamento, a estimativa por professor/mês (chamadas, perfil, custo) precisa ser anexada a essa tarefa.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-22 15:51:49 · `tasks/prd-reserva-e-avaliacao/2_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:** os nove da tabela "Testes que provam a regra" de `tasks/prd-reserva-e-avaliacao/2_task.md`. A subtarefa 2.1 também exige que a reserva seja conferida "com as categorias das tarefas aprovadas". No `cenarios.md`, a linha RF2 pede o controle negativo: "a subida recusa com `categoria_faltando:conversa_do_aluno`".

**Cobertos:**
- **Reserva sem suboperador vigente:** o worker consome e bate o batimento, o principal fica conferido, `conferido = 0` e o log sai sem a chave e sem o contrato. Este mesmo caso cobre a linha "o ciclo das filas não espera a conferência da reserva": são 3 consumidores com a reserva nunca conferida.
- **As quatro recusas:** o caso `it.each` testa um campo errado por vez, e outro caso cobre o encerramento seguido de reinício.
- **Reconferência:** o cadastro corrigido no mesmo processo é coberto na integração, com o intervalo real de 5 s e prazo de 20 s, e na unidade, com 10 ms.
- **Limitador:** com contratados diferentes, o mesmo pedido é aceito num limitador e recusado no outro. Há também os casos "sem reserva", "sem contratado" e "só o contratado dela".
- **Série e alerta:** sem reserva configurada, a série não é publicada. O alerta foi conferido no yaml: `for: 10m`, `lt 1`, `noDataState: OK`, sem `absent`. O `metrics.test.ts` cobre 0 e 1.
- **Runbook:** o alerta tem o parágrafo pedido, conferido pelo `alerta-tem-runbook`.
- **Logs:** a unidade compara o objeto exato do log. O teste de vazamento usa chave e contrato com valores reconhecíveis.
- **Elegibilidade:** ela lê a conferência, nos dois níveis.
- **Regras gerais:** não há `.skip`, nenhum provedor pago é chamado e os 13 blocos de mutação correspondem às linhas com condição do diff.

Rodei os testes e passaram: `soberania`, `metrics`, `alertas`, `alerta-tem-runbook` e `llm-config` (155 casos), o `reserva-na-subida.int.test.ts` (9 casos) e os 4 casos de reserva do `fila-de-ia.int.test.ts`.

**Bloqueantes:**

1. **`apps/api/src/ia/ia-do-worker.module.ts`, na factory de `SOBERANIA_DA_RESERVA`:** nenhum teste prova que o worker passa à conferência as tarefas aprovadas para a reserva. A linha é `daReserva: { envio: reserva.envio, tarefas: tarefasAprovadasParaAReserva(reserva, config.reserva.ambiente) }`.
   - **O que está errado:** em todo caso de integração, a reserva tem chave aleatória, sem entrada em `MODELOS_APROVADOS`, ou é a falsa, que nem lê o cadastro. O próprio comentário de `cadastrar` diz: "as categorias exigidas são nenhuma". Por isso trocar a linha por `tarefas: []`, ou por `categoriasEnviadasPelasTarefas()`, passa em todos os testes da tarefa. A linha não tem condição, e por isso o `--faltando` não a listou.
   - **Consequência:** quando uma reserva real for aprovada para o Tutor, uma fiação errada confere um contrato que não cobre `conversa_do_aluno` (D62, regra 20 item 13), e nada fica vermelho.
   - **O que a unidade cobre:** só a classe com `daReserva` injetado, não a escolha que o módulo faz.
   - **Correção exigida:** um caso em `reserva-na-subida.int.test.ts` em que a categoria exigida decida o resultado. O caminho é viável: `AMBIENTE=local`, `IA_RESERVA_ADAPTADOR=openai_compat`, `IA_RESERVA_PROVEDOR_ID=falso-reserva` e `LLM_RESERVA_MODELO` igual ao `MODELO_FALSO`. Nessa configuração, `MODELOS_APROVADOS` aprova todas as tarefas para essa identidade. Os passos:
     - (a) com o cadastro de `falso-reserva` cobrindo só `material_da_escola`, a reserva fica não conferida e o log traz `categoria_faltando:conversa_do_aluno`;
     - (b) com as quatro categorias, fica conferida.
   - A chave fixa `falso-reserva` precisa entrar na limpeza do `afterEach`. Junto com o caso, vai um bloco ` ```mutacao ` que troque `tarefas: tarefasAprovadasParaAReserva(...)` por `tarefas: []`. Se a configuração for recusada, a outra saída é o módulo aceitar `aprovados` injetado, como já faz o `ContextoDaReserva`, e o caso usar essa porta.

**Recomendações:**
- **Asserção que não prova nada:** em `apps/api/src/ia/fila-de-ia.int.test.ts`, no caso do limitador, a asserção "esgotar o do principal não reduz o da reserva" passa até com os dois limitadores sendo o mesmo objeto. As chaves `falso:` e `falso-reserva:` são escolhidas pelo próprio teste, não pelo módulo. Já a separação real está provada pelo `not.toBe` e pelos contratados diferentes. A asserção pode sair, e a Autoconferência pode deixar de dizer, no item 12, que "o balde leva a identidade na chave (caso próprio)": a chave por identidade é do gateway, na 7.0.
- **Motivo impreciso:** o motivo sem bloco de `config.reserva?.tokensPorMinuto === undefined` diz que o portão recusaria a prova como erro de carga. Sem o termo, o `TypeError` acontece dentro do caso "sem reserva, ou com a reserva sem contratado", enquanto o worker sobe. Seria um caso que rodou e falhou, e um bloco seria aceito. Vale reescrever o motivo ou trocá-lo por um bloco.
- **Intervalo na tabela:** a linha 3 da tabela diz "intervalo injetado", mas o caso de integração usa os 5 s reais, com prazo de 20 s. A margem é boa; só o texto da tabela pede ajuste.
- **Fechamento duplo:** no caso do reinício, `antes.app.close()` roda e o mesmo contexto continua em `A_FECHAR`, então fecha duas vezes. Hoje não causa problema, mas é fácil evitar.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-22 16:12:32 · `tasks/prd-reserva-e-avaliacao/2_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. O diff não traz tabela, coluna, query de pessoa nem DTO. A única escrita em banco é o cadastro de suboperador no teste novo, que é dado da operação e não do titular.

Fora da tabela de dados do docs/lgpd.md: nenhum.

Autorização por objeto: ok. O diff não traz rota nem repository.

Logs: limpos. Em `packages/core/src/ia/soberania.ts` só mudou de onde vem o nome do evento, que agora sai de um mapa montado no construtor. Os campos do log continuam os mesmos: `evento`, `provedorId`, `tentativas`, `codigo` e `erro` resumido. Nenhum nome, chave ou contrato entra no log.

Auditoria: não se aplica. A tarefa não lê dado de aluno, não exporta, não mexe em nota nem em permissão e não aprova saída de IA.

Envio externo: nenhum envio novo. A reserva continua só conferida. Agora há um teste de integração provando que as categorias que o contrato da reserva precisa cobrir são as das tarefas aprovadas para ela: sem `conversa_do_aluno`, a subida recusa com `categoria_faltando:conversa_do_aluno` e o indicador de conferido fica em 0. Esse teste fecha melhor a D62 do lado da reserva. O registro em `ExecucaoAgente` e em `consumo_ia.provedor` fica para quando houver chamada à reserva. Pelo `tasks.md`, é a tarefa 5.1 que grava a coluna, como o runbook diz.

Seed/fixture: sintético. O cadastro tem nome "Provedor Sintético da D62", contrato "DPA-D62" e autor "equipe-de-teste". As chaves que o teste cria, inclusive a fixa `falso-reserva`, são apagadas no `afterEach` (`CHAVES_SEMEADAS`). A linha nova do `TODO.md` não traz id de escola nem dado de pessoa.

Bloqueantes: nenhum.

Recomendações:
- A recomendação do `privacy-guardian` da 1ª rodada sobre o contrato que permite uso por menor (regra 20, item 13) foi para o `TODO.md`, na seção de LGPD, com dono, como a 1ª rodada aceitou. Ela continua como lacuna de conformidade e precisa fechar antes de a reserva atender escola.
- Há um desencontro de número de tarefa. Em `tasks/prd-reserva-e-avaliacao/2_task.md`, a tabela de "Recomendações sem aplicar" põe a gravação do `provedor` da reserva em `ExecucaoAgente` e `consumo_ia` na 4.0. Já o runbook (`docs/runbook.md`, entrada "Provedor de reserva de IA não conferido", trecho "Se nada disso resolver") e o `tasks.md` (5.1) põem na 5.0. Vale alinhar, para que a condição de aprovação não se perca entre a 4.0 e a 5.0.
- O trecho novo do runbook, que manda conferir o dossiê de conformidade e a lista de compartilhamento do titular antes de a reserva atender, está correto. Quando a 5.0 pousar, vale transformar esse passo manual em teste: a lista de compartilhamento mostrando a reserva depois de uma chamada real a ela.

Pergunta de fechamento: nesta tarefa nada sai para a reserva, então nada passa a faltar no arquivo do titular. Ele continua respondendo pelo `consumo_ia.provedor`.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-22 16:12:32 · `tasks/prd-reserva-e-avaliacao/2_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. O diff desta rodada não grava nem lê `Nota`, `Correcao` ou `lancadaPor`. Todos com autor humano? Sim, porque não há caminho novo.

Decisão autônoma sobre aluno: ausente. A conferência da reserva decide só se o provedor entra no caminho: `true` ou `false` e um código para o operador. Ela não decide nada sobre aluno nem sobre a trajetória dele.

Aprovação registrada: ok. A tarefa ainda não manda nenhuma chamada à reserva, que só atende a partir da 4.0. Não há saída de IA nova chegando ao aluno, e a exceção da D47 não aparece em nenhum outro agente.

Supervisão do tutor: ok. O tutor não mudou nesta rodada.

Autonomia declarada e visível: sim. Não mudou nesta rodada. A reserva não cria agente nem nível de autonomia novo.

Bloqueantes: nenhum.

O que conferi no diff (`.processo/ordens/diff-2_task-r2.txt`):
- **`packages/core/src/ia/soberania.ts`**: só troca o booleano `#daReserva` por um mapa de nomes de evento. Os campos do log continuam `provedorId`, `tentativas` e `codigo`, sem dado de pessoa. O comportamento é o mesmo.
- **`apps/api/src/ia/reserva-na-subida.int.test.ts`**: o caso novo prova que o contrato da reserva tem de cobrir as categorias das tarefas aprovadas para ela, `conversa_do_aluno` entre elas. Isso reforça a D62 do lado da conversa do aluno. O mutante que troca `tarefas:` por `[]` em `apps/api/src/ia/ia-do-worker.module.ts:82` (citado como bloco em `2_task.md`) amarra o teste ao código.
- **`apps/api/src/ia/ia-do-worker.module.ts:84`**: só ganhou um comentário.
- **`docs/runbook.md`**: agora diz que a reserva só atende a partir da 4.0, e que é preciso avisar as escolas e conferir o dossiê (D61) e a lista de compartilhamento do titular. Isso deixa a auditoria mais completa, não menos.
- **`tasks/prd-reserva-e-avaliacao/2_task.md`**: minhas duas recomendações da 1ª rodada estão registradas com destino na 4.0: o provedor que gerou o item aparecer na consulta de auditoria, e o caso provando que discursiva e redação não chegam à reserva por caminho que o principal não teria (regra 70, item 2a). Os destinos estão corretos.
- **`TODO.md` e `cenarios.md`**: só registros, nada que toque a regra 70.

Recomendações:
- **Para a 4.0, sobre `MODELOS_APROVADOS`:** o caso novo passa a usar a aprovação de `falso-reserva` em todas as tarefas para mexer no `main-worker` de verdade. Quando a 4.0 ligar o roteamento, o caso do item 2a (a reserva não pode abrir rota para discursiva e redação) deve rodar contra essa mesma aprovação total, porque é nela que um desvio apareceria.
- **Fora da minha regra, para o `infra-guardian`:** saiu de `apps/api/src/ia/fila-de-ia.int.test.ts` o caso "esgotar o balde do principal não reduz o da reserva". O `2_task.md` (item 12) passa essa prova para a 7.0. Vale o `infra-guardian` confirmar que ela está anotada lá.

## llm-integrator · 2ª rodada · APROVADO · 2026-11-22 16:12:44 · `tasks/prd-reserva-e-avaliacao/2_task.md`

VEREDITO: APROVADO
Perfis usados: nenhum. A 2.0 não faz chamada a modelo. Ela só confere o suboperador da reserva, mede o limitador e publica a série `ia.provedor_de_reserva.conferido`. O diff desta rodada não muda isso.
Custo estimado por professor/mês: R$ 0 adicionais. A reserva só passa a receber chamada na tarefa 4.0, quando ligar o desvio da queda. A estimativa de custo (chamadas, perfil, valor) está registrada para a 4.0 na tabela "Recomendações sem aplicar" do `2_task.md`.
Prompt versionado: não se aplica
Validação de schema: não se aplica
Aprovação humana no caminho: não se aplica

Bloqueantes: nenhum.

A 1ª rodada não exigiu correção nenhuma. Conferi cada ponto do diff desta rodada:
- `packages/core/src/ia/soberania.ts`: o mapa `EVENTOS_DO_PRINCIPAL` e `EVENTOS_DA_RESERVA` troca o ternário por `#daReserva` por um objeto de nomes de evento. Os nomes são idênticos aos anteriores e o log continua com `provedorId`, `tentativas` e `codigo`, sem chave nem contrato. Os blocos de mutação foram reescritos para a nova forma.
- `apps/api/src/ia/reserva-na-subida.int.test.ts`: o caso novo sobe o `main-worker` de verdade com `falso-reserva` aprovada em `openai_compat` e `MODELO_FALSO`. `MODELO_FALSO` e `MODELOS_APROVADOS` existem. O caso prova que, com o contrato cobrindo só `material_da_escola`, a reserva recusa com `categoria_faltando:conversa_do_aluno` e `conferido=0`. Corrigido o cadastro, ela confere sozinha e `conferido=1`. Isso prova que a conferência da reserva usa as categorias das tarefas aprovadas (D62, regra 20 item 13). O teste não chama provedor pago.
- O helper `fechar` que tira o fechamento da lista `A_FECHAR` evita fechar o app duas vezes.
- `apps/api/src/ia/fila-de-ia.int.test.ts`: a asserção removida era a do balde por identidade (`falso:` contra `falso-reserva:`). Ela exercia só o `TokenLimiter` com chaves montadas no próprio teste. O `2_task.md` agora diz que a chave por identidade é do gateway e vem na 7.0. As variáveis `limiteDoPrincipal` e `limiteDaReserva` continuam em uso nas linhas 232 a 283.
- `docs/runbook.md`: o texto deixou de afirmar que a reserva já atende e passa a dizer que isso vale só a partir da 4.0. Isso evita orientar o operador de plantão com uma capacidade que ainda não existe. O texto também manda conferir o cadastro de suboperadores do dossiê e a lista de compartilhamento do titular ao avisar as escolas.
- `TODO.md`: a lacuna anterior à 2.0 (nenhum código confere que o contrato permite serviço usado por menor) está registrada na seção de LGPD, com dono Arquiteto. O teste intermitente da `FilaDeIa.ociosa` está registrado na seção de infra, com dono Implementador.
- `ia-do-worker.module.ts`: só um comentário, sobre um callback por montagem do módulo.

Recomendações:
- Quando o roteamento da 4.0 ligar a reserva, repita a auditoria de IA. O ponto central é provar que nenhuma tarefa de discursiva ou redação chega à reserva por caminho que o principal não teria (regra 70, item 2a). Outro ponto é `consumo_ia.provedor` e `ExecucaoAgente` gravarem o provedor da reserva. O terceiro é a estimativa de custo por professor/mês. Todos já estão anotados no `2_task.md`.
- O teste intermitente de `fila-de-ia.int.test.ts` (prazo por perfil, `FilaDeIa.ociosa` estourando os 30 s) é anterior à 2.0 e já está no `TODO.md`. Ele toca o worker de IA (regra 30, item 8: sobreviver a reinício, idempotência). Vale investigar logo se o job fica `ativo` por aborto que chega antes de o modelo registrar o sinal, ou se o processador deixa o job `ativo` nesse caso.
- A tabela "Revisões" do `2_task.md` mostra o `test-engineer` com REPROVADO na 1ª rodada. Isso é do hook e fora do meu escopo. Confira que a próxima rodada dele cobre o código atual antes do commit.

Arquivos relevantes:
- `packages/core/src/ia/soberania.ts`
- `apps/api/src/ia/reserva-na-subida.int.test.ts`
- `apps/api/src/ia/fila-de-ia.int.test.ts`
- `docs/runbook.md`

## infra-guardian · 2ª rodada · APROVADO · 2026-11-22 16:13:05 · `tasks/prd-reserva-e-avaliacao/2_task.md`

VEREDITO: APROVADO
Caminho quente tocado: IA
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ok
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum

Esta rodada cobriu só o diff desde a 1ª. A 1ª não exigiu nenhuma correção.

- **Asserção removida em `apps/api/src/ia/fila-de-ia.int.test.ts`** ("esgotar o balde do principal não reduz o da reserva"): sair não abre buraco na regra 80.4.
  - Como o test-engineer apontou, as chaves `falso:` e `falso-reserva:` eram escolhidas pelo próprio teste. A asserção passava mesmo com um limitador só.
  - A separação dos dois limitadores continua provada por `not.toBe` e pelos contratados diferentes, de 1.000 e de milhões.
  - A chave do balde por identidade é montada no gateway: `chaveDoBalde` usa `adaptador.identidade:modelo` (`packages/core/src/ia/llm-gateway.ts:508`). Ela já é provada pela linha RF4 de `cenarios.md` em `llm-gateway.test.ts`.
  - Hoje o gateway nem lê o limitador da reserva. Isso só acontece na 7.0.
- **`soberania.ts`**: o mapa de eventos montado no construtor tem o mesmo comportamento dos três ternários de antes. Os nomes de log e os campos (`provedorId`, `tentativas`, `codigo`) não mudaram, e as mutações foram refeitas para as linhas novas.
- **Caso novo em `reserva-na-subida.int.test.ts`**: sobe o `main-worker` de verdade, com Postgres e Redis reais e o adaptador falso, sem provedor pago. A reconferência usa o intervalo real de 5 s, com prazo de 20 s. O ciclo das filas não é tocado.
- **`fechar()` no `subirWorker`**: tirar o fechamento da lista `A_FECHAR` acaba com o fechamento duplo e não muda o que é provado.
- **`ia-do-worker.module.ts`**: só entrou um comentário.
- **`docs/runbook.md`**: o texto agora diz que a reserva só atende a partir da 4.0, e o aviso às escolas ganhou o dossiê e a lista de compartilhamento. O alerta continua com runbook.

Recomendações:
1. `apps/api/src/ia/reserva-na-subida.int.test.ts:236`: o caso grava `suboperador` com a chave fixa `falso-reserva`. A tabela tem um índice único em `chave` para o registro vigente (`suboperador_chave_vigente_idx`).
   - Se uma execução for interrompida antes do `afterEach`, a linha fica no banco, e na próxima rodada o insert falha por chave duplicada até alguém limpar à mão.
   - O mesmo vale se algum seed de carga ou de demonstração passar a cadastrar `falso-reserva`.
   - Correção sugerida: apagar a chave antes de gravar, no próprio caso ou em `cadastrar`.
2. O runbook agora diz que o desvio da reserva entra na 4.0, e na 1ª rodada eu tinha apontado a 5.0. Quando a 4.0 e a 5.0 pousarem, confira se o parágrafo "Quando é a reserva" bate com a tarefa que de fato ligar o desvio e o disjuntor próprio.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-22 16:13:15 · `tasks/prd-reserva-e-avaliacao/2_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

As seis recomendações da 1ª rodada estão no diff:
- **Runbook:** a frase antiga da reserva sumiu, e o texto agora diz que a reserva só atende a partir da 4.0.
- **`fundacao.json`:** entrou em "Arquivos previstos".
- **`cenarios.md`:** a coluna do teste ganhou os eventos `ia.provedor_de_reserva.*`.
- **`soberania.ts`:** os nomes dos eventos de log foram para uma tabela escolhida no construtor. O comportamento não muda, e o bloco de mutação foi trocado para essa linha.
- **Callback do gauge:** ganhou o comentário.
- **`TODO.md`:** entraram as duas entradas.

O teste novo em `reserva-na-subida.int.test.ts` testa a regra de verdade. Ele usa a chave `falso-reserva`, que é a única aprovada para todas as tarefas. Se o cadastro cobre só `material_da_escola`, a subida recusa com `categoria_faltando:conversa_do_aluno`. Corrigidas as categorias, a reserva fica conferida sem reiniciar. Nenhum outro teste de integração nem seed grava `falso-reserva` em `suboperador`, então não há colisão com outro arquivo. O `fechar()` tira o fechamento do `afterEach`, o que acaba com o fechamento duplo no caso do reinício.

Saiu de `fila-de-ia.int.test.ts` o trecho que mostrava baldes separados para o principal e para a reserva com o mesmo modelo. A tarefa explica: a chave por identidade fica com o gateway na 7.0 ("Fora do escopo" e item 12), e a Tech Spec bate com isso (§5, o balde da reserva no gateway).

Recomendações:
- **`2_task.md`, Autoconferência item 3:** ainda cita "o `falso` e o `falso-reserva` com o mesmo modelo" como o que distingue um caso. Esse trecho saiu de `fila-de-ia.int.test.ts`, então a frase ficou velha e deve sair ou apontar para o caso das categorias.
- **`2_task.md`, seção "Mutações":** sobraram nove linhas em branco logo depois da linha `--faltando`.
- **`soberania.ts`:** `const evento = this.#eventos.X` seguido do uso na linha de baixo é uma variável a mais. `evento: this.#eventos.recusada` direto no objeto do log fica mais curto. É só legibilidade, não bloqueia.
- **`ia-do-worker.module.ts:84`:** o comentário do callback passa de 200 colunas e explica um efeito colateral dos testes. Caberia melhor no teste que monta o módulo várias vezes do que no código de produção.

Arquivos relevantes:
- tasks/prd-reserva-e-avaliacao/2_task.md
- apps/api/src/ia/reserva-na-subida.int.test.ts
- apps/api/src/ia/fila-de-ia.int.test.ts
- packages/core/src/ia/soberania.ts
- apps/api/src/ia/ia-do-worker.module.ts

## test-engineer · 2ª rodada · APROVADO · 2026-11-22 16:13:42 · `tasks/prd-reserva-e-avaliacao/2_task.md`

VEREDITO: APROVADO

**Correção exigida na 1ª rodada: feita.** O caso novo está em `apps/api/src/ia/reserva-na-subida.int.test.ts:232-248`.
- **(a)** O cadastro de `falso-reserva` cobre só `material_da_escola`, com `LLM_RESERVA_MODELO: MODELO_FALSO`. Com isso a aprovação de `MODELOS_APROVADOS` vale para todas as tarefas no `main-worker` de verdade. O resultado é não conferida, o log traz `categoria_faltando:conversa_do_aluno` e a série fica em `[0]`.
- **(b)** Com as quatro categorias, a reserva se confere sozinha e a série vai a `[1]`.
- **Limpeza:** a chave fixa passa por `cadastrar`, que a põe em `CHAVES_SEMEADAS`, e o `afterEach` a apaga (linhas 70 e 93). O caso usa um medidor próprio, então não se mistura com o caso da reserva falsa, que tem a mesma chave.
- **Mutação:** o bloco que troca `tarefas: tarefasAprovadasParaAReserva(...)` por `tarefas: []` está no documento. Ele fica vermelho pelo motivo certo: com `[]` nenhuma categoria é exigida, a reserva conferiria logo na subida e a asserção da linha 242 falha. Não é erro de carga.
- **Rodei o arquivo:** 10 de 10 verdes.

**Recomendações da 1ª rodada atendidas:**
- A asserção dos dois baldes saiu do caso do limitador, e o item 12 da Autoconferência foi ajustado.
- O motivo sem bloco do contratado ausente virou bloco: o mutante dá um contratado padrão e o caso "sem reserva, ou com a reserva sem contratado" passa a ver um limitador onde devia ver `null`.
- A linha 3 da tabela agora diz os 5 s reais, esperados até 20 s.
- O app do caso do reinício fecha uma vez só: `fechar()` tira o fechamento da lista do `afterEach`.

**Mudança em `soberania.ts`:** os nomes dos eventos de log viraram um mapa definido no construtor. Os blocos foram reescritos para isso: a inversão da escolha do mapa e as duas negações de `#deveAvisar`. O bloco antigo do evento `conferida` deixou de ser necessário, porque o nome do evento agora vem do mapa e o bloco do `#eventos` o cobre. O portão provou 14 mutações vermelhas.

Cenários exigidos: reserva sem suboperador vigente sem segurar o principal; as recusas por país, treinamento, alcance e vigência; o reinício depois de o contrato vencer; o cadastro corrigido sem reiniciar; as categorias exigidas vindas das tarefas aprovadas para a reserva; o limitador com o contratado da reserva; a série que não é publicada sem reserva; o alerta com o runbook; o log sem a chave nem o contrato.

Cobertos: todos. O das categorias, que faltava, agora tem prova de integração e bloco de mutação.

Bloqueantes: nenhum.

Recomendações:
- Pôr na tabela "Testes que provam a regra" de `tasks/prd-reserva-e-avaliacao/2_task.md` uma linha para o caso novo ("as categorias que o contrato da reserva tem de cobrir…"). Hoje ele só aparece no item 12 da Autoconferência e no bloco de mutação.
- O item 3 da Autoconferência (`2_task.md:84`) ainda cita "o `falso` e o `falso-reserva` com o mesmo modelo", e essa asserção saiu do teste. Falta tirar a frase.
- `cadastrar('falso-reserva')` usa uma chave fixa. Se uma rodada interrompida deixar a linha no banco, a próxima pode falhar no insert por motivo estranho ao teste. Vale apagar a chave antes de inserir, ou usar `on conflict`.
