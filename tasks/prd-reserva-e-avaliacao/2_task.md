# Tarefa 2.0 — O `main-worker` confere a reserva sem segurar o principal, com limitador próprio e alerta

**Funcionalidade:** reserva-e-avaliacao · **Depende de:** 1.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`
**Porte:** grande

## Objetivo

O `main-worker` sobe com a reserva configurada: ela passa numa `SoberaniaNaSubida` própria, que não segura o consumo das filas,
confere de novo a cada 5 s enquanto não passa, e publica `ia.provedor_de_reserva.conferido`; o alerta avisa a Operação com 0 por
10 min. A reserva ganha o `TokenLimiter` dela. Sem reserva configurada, nada muda.

## Contexto necessário

- `techspec.md` §5 ("A subida"), §7 (log), §7c ("Métrica e alerta"), §13 (o terceiro risco)
- `prd.md` RF1, §7 (o terceiro caso de borda)
- `cenarios.md` §1: RF1, a primeira e a segunda linhas (sem a parte "com o principal fora", que é da 5.0); RF4, a linha de
  `LLM_RESERVA_TOKENS_POR_MINUTO` (o limitador); "Custo da reserva (RF6) e o alerta da reserva (RF1)", as duas linhas do alerta
- `.claude/rules/80-infra-e-carga.md` (item 10: alerta com runbook)
- Código: `packages/core/src/ia/soberania.ts` (`SoberaniaNaSubida`, o intervalo injetado, o log que se repete a cada 12
  tentativas), `apps/api/src/ia/ia-do-worker.module.ts` (a montagem do principal, o `TokenLimiter`),
  `packages/core/src/telemetry/metrics.ts`, `infra/grafana/alertas/ia-provedor-fora.yaml`

## Subtarefas

- [x] 2.1 — A segunda `SoberaniaNaSubida`, pela chave da `IA_RESERVA_PROVEDOR_ID`, com as categorias das tarefas aprovadas
  (1.0); não conferida, confere de novo a cada 5 s (intervalo injetado) sem bloquear o ciclo das filas; log
  `ia.provedor_de_reserva.conferencia_recusada` só com ids, códigos e `provedorId`. A conferência liga a porta da `reservaElegivel`
- [x] 2.2 — O `TokenLimiter` da reserva, com `LLM_RESERVA_TOKENS_POR_MINUTO` e os mesmos baldes por fila, entregue ao gateway
- [x] 2.3 — `ia.provedor_de_reserva.conferido` (1 ou 0) só com reserva configurada; `infra/grafana/alertas/ia-provedor-de-reserva.yaml`
  com 0 por 10 min e `noDataState = OK`, sem `absent()`; parágrafo no `docs/runbook.md`: encerrar o suboperador, avisar as escolas,
  conferir que o contrato permite serviço usado por menor; o `#provedor-de-ia-fora` diz o que fazer quando é a reserva
- [x] 2.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/ia/soberania.ts`, `packages/core/src/ia/soberania.test.ts` | alterado |
| `packages/core/src/telemetry/metrics.ts` | alterado |
| `apps/api/src/ia/ia-do-worker.module.ts`, `apps/api/test/fila-de-ia.fixture.ts` | alterado |
| `apps/api/src/ia/reserva-na-subida.int.test.ts` | novo |
| `apps/api/src/ia/fila-de-ia.int.test.ts` | alterado |
| `infra/grafana/alertas/ia-provedor-de-reserva.yaml` | novo |
| `infra/test/alertas.test.ts`, `docs/runbook.md` | alterado |
| `infra/grafana/paineis/fundacao.json` | alterado: a consulta `min by (provedor) (ia_provedor_de_reserva_conferido)` (`refId` `D`) no painel das chamadas de IA, porque `infra/test/painel.test.ts` exige que toda métrica do código tenha painel |
| `packages/core/src/config/llm-config.ts`, `packages/core/src/config/llm-config.test.ts`, `packages/core/src/ia/llm-gateway.ts`, `packages/core/src/ia/llm-gateway.test.ts`, `packages/core/src/index.ts`, `tools/testes/metricas.ts`, `infra/scripts/ensaio-alertas.ts`, `tools/guardas/alerta-tem-runbook.test.ts` | alterado (o `ambiente` da reserva, as duas portas do gateway, os exports, o nome da métrica no Prometheus, o uid da regra e as listas fechadas dos testes) |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| reserva sem suboperador vigente: o worker sobe e consome as filas, o principal passa, `conferido = 0` | I | RF1 | principal externo conferido ao lado da reserva recusada | `reserva-na-subida.int.test.ts` › "reserva sem suboperador vigente: o worker consome as filas e bate o batimento, o principal passa, `conferido = 0`, e o log não leva a chave nem o contrato" |
| `pais_fora_do_brasil`, `treinamento_nao_vedado`, `alcance_nao_e_todas`, suboperador encerrado e reinício: não conferida, o principal segue | I | a conferência inteira | um campo errado por caso | `reserva-na-subida.int.test.ts` › "recusa da reserva por %s" (os quatro campos) e › "o suboperador da reserva encerrado depois de conferida: o reinício a recusa, e o principal segue" |
| cadastro corrigido sem reiniciar (na integração, a nova conferência de 5 s, esperada até 20 s; na unidade, o intervalo injetado): conferida, `conferido` passa a 1 | I | a reconferência | o mesmo processo, sem subir de novo | `reserva-na-subida.int.test.ts` › "cadastro da reserva corrigido sem reiniciar: o mesmo processo a confere sozinho, `conferido` passa a 1, e a reserva passa a ser elegível"; `soberania.test.ts` › "o cadastro corrigido, sem reiniciar: a reserva se confere sozinha na próxima volta…" (intervalo de 10 ms) |
| as categorias que o contrato da reserva tem de cobrir são as das tarefas aprovadas para ela, entregues pelo worker à conferência | I | D62 (regra 20, item 13) | `falso-reserva` aprovada em todas as tarefas, com o cadastro cobrindo só `material_da_escola` e depois as quatro categorias | `reserva-na-subida.int.test.ts` › "as categorias que o contrato da reserva tem de cobrir são as das tarefas aprovadas para ela…" (recusa com `categoria_faltando:conversa_do_aluno`, `conferido = 0`; com as quatro, conferida, `conferido = 1`) |
| o ciclo das filas não espera a conferência da reserva | I | sem segurar o principal | a reserva nunca conferida e o consumidor criado | `reserva-na-subida.int.test.ts` › "reserva sem suboperador vigente…" (um consumidor por fila e o batimento com a reserva sem nenhum cadastro) |
| o limitador da reserva usa o contratado dela, com os baldes por fila | I | regra 80.4 | contratados diferentes nos dois | `fila-de-ia.int.test.ts` › "o limitador da reserva usa o contratado dela, com os baldes por fila…" e › "sem reserva, ou com a reserva sem contratado (só no `local`), não há limitador da reserva…" |
| sem reserva configurada, a série não é publicada e o alerta não dispara | I, U | `noDataState = OK` | o worker com o principal só | `reserva-na-subida.int.test.ts` › "o worker com o principal só: nenhuma conferência da reserva, a série … não é publicada…"; `alertas.test.ts` › "são as das Tech Specs, com o `for:` e o limiar declarados…" (`noDataState`, sem `absent`) |
| configurada e recusada: publica 0, e o alerta dispara depois de 10 min | I, U | sem `absent()` | `for: 10m` lido do yaml | `reserva-na-subida.int.test.ts` › "reserva sem suboperador vigente…" (a série vale 0); `alertas.test.ts` › o mesmo caso (`for`, `expressao` e `limiar` lidos do yaml); `metrics.test.ts` › "1 com a reserva conferida e 0 sem ela…" |
| o alerta tem o parágrafo do runbook | U | regra 80.10 | `alerta-tem-runbook` | `alerta-tem-runbook.test.ts` › "no repositório, cada arquivo de `infra/grafana/alertas/` tem entrada correspondente em `docs/runbook.md`, completa" |
| log novo: `ia.provedor_de_reserva.conferencia_recusada` | U | não leva o contrato, a chave nem nome (regra 20, item 9) | a chave e o contrato do suboperador com valores reconhecíveis | `soberania.test.ts` › "o log da recusa nunca leva o contrato, o nome do suboperador nem a chave da reserva…" e › "%s: não conferida, e o log da reserva traz só o evento, a chave, a tentativa e o código"; `reserva-na-subida.int.test.ts` › o primeiro caso (a chave e o contrato no log de verdade) |

## Como testar

- Subida do worker: `apps/api/src/ia/soberania-na-subida.int.test.ts` › "externo com o suboperador que cobre tudo: consome" e › "externo com o
  cadastro que não cobre: nenhum consumidor e nenhum batimento; corrigido o cadastro, passa a consumir sozinho" — aqui o inverso:
  o consumidor existe com a reserva recusada
- Reconferência e log: `soberania.test.ts` › "o cadastro que não cobre fica não conferido e o log diz o motivo; consertado o cadastro, a
  instância se confere sozinha, sem reiniciar" e o bloco "o log da instância que espera o cadastro (relógio falso…)"
- Limitador: `fila-de-ia.int.test.ts` usa `FilaDeIa.subirOMainWorker()` e `subirOMainWorker({ semTokensPorMinuto: true })`
- Alerta: `infra/test/alertas.test.ts`, o bloco do `provedorFora` (`noDataState`, `for`, `expressao`); `tools/guardas/alerta-tem-runbook.test.ts`
- `npx vitest run --project integracao apps/api/src/ia/reserva-na-subida.int.test.ts`

## Fora do escopo desta tarefa

Mandar chamada à reserva, e a reserva recusada fora do roteamento (5.0); o balde da reserva no gateway (7.0).

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano antes de codar.

1. **Mutação de cada cláusula:** são 14 blocos em "Mutações" e 3 motivos, para as 18 linhas que o `--faltando` listava (cinco de `soberania.ts`, uma de `metrics.ts`, onze de `ia-do-worker.module.ts`). Os blocos foram aplicados um a um, fora do portão, com o teste citado: todos ficaram vermelhos. A linha `medidor: medidor ?? globalMeter(),` entra como contexto do bloco do `limiteDeTokens`. Os três motivos são metades de condição que só estreitam o tipo e deixam o comportamento igual (`redis === null`, e as duas metades da guarda da conferência da reserva). O contratado ausente (`config.reserva?.tokensPorMinuto === undefined`) tem bloco: o mutante dá um contratado padrão à reserva sem ele, carrega, e o caso "sem reserva, ou com a reserva sem contratado" vê um limitador onde devia ver `null`. O `--faltando` está vazio. As linhas sem condição que protegem (o `observeProvedorDeReserva` no módulo, a fiação das duas portas no gateway) caem nos blocos do `medidor` e do `soberaniaDaReserva`.
2. **Texto na tela:** a tarefa não tem tela; nenhum `e2e/` cita o que ela acrescenta.
3. **"O que distingue" no teste:** cada linha da tabela tem o segundo dado na coluna "Caso": o principal conferido ao lado da reserva recusada, um campo errado por caso, o cadastro corrigido no mesmo processo, dois contratados diferentes (1.000 e o do teste, de milhões) com o mesmo pedido aceito num limitador e recusado no outro, e o cadastro de `falso-reserva` que cobre só `material_da_escola` contra o que cobre as quatro categorias, com a mesma aprovação de todas as tarefas.
4. **Checagem anterior que responde antes:** o limitador só mede com o Redis pronto (antes dele o seguro em memória responde, e o balde de 150 não cabe nele): o caso espera com uma sonda de chave própria, e não herda a ordem. A conferência da reserva é provada com o `main-worker` de verdade (o `WorkerModule`) e o banco real, e o dublê da unidade lança o erro de conexão que o driver lança. O cadastro do principal é semeado em cada caso, para a recusa vir da reserva.
5. **Asserção sobre o resultado:** a série é lida no `MedidorDeTeste` (0 e 1, no rótulo `provedor`), o consumo pelos consumidores do BullMQ no Redis e pelo batimento em arquivo, o limitador pelo pedido aceito ou recusado, e o log pelo texto que o logger recebeu (sem a chave nem o contrato). Nenhuma asserção sobre texto de arquivo, a não ser a do yaml, lido como a configuração do Grafana.
6. **Guarda nova:** a tarefa não cria guarda; a que existe (`alerta-tem-runbook`) ganha o arquivo e o título na lista, e o `REGRAS_PROVISIONADAS` o uid.
7. **Comentário que afirma o que o código não faz:** conferi os docblocks de `soberania.ts`, de `ia-do-worker.module.ts` e das duas portas novas do gateway: dizem que o gateway **recebe** o limitador e a conferência da reserva, e que quem os lê é o roteamento (4.0 e 7.0); nenhum diz que a reserva atende. O runbook cita só variável, evento, comando e métrica da árvore (`grep`), e as duas frases que dizem o que o sistema faz têm o caso (o worker consome com a reserva fora, o `conferido` vale 0).
8. **Divergência:** são duas, e nenhuma muda regra nem cria trava; a coluna "Onde está na spec" cita o `grep` da palavra do código em `techspec.md` (o parágrafo "A conferência e o limitador da reserva no worker (2.0)" e a linha de log da §7). O `prd.md` não diz o contrário: RF1 pede "alerta à Operação" e "sem derrubar o principal".
9. **Peça que já existe:** a `SoberaniaNaSubida` do principal é a mesma classe, com a opção `daReserva`, e não uma cópia; o `TokenLimiter` e o cliente Redis dos tokens são os mesmos; `adaptadorDaReserva`, `tarefasAprovadasParaAReserva` e `categoriasDasTarefas` (1.0) escolhem o envio e as categorias.
10. **Concorrência:** a conferência é de uma instância só e a leitura do cadastro é idempotente (`start()`, já provado); a corrida da reserva com o principal é da 4.0. O limitador usa o Redis, e o caso dos baldes por fila é sequencial de propósito: o que ele prova é o tamanho de cada balde.
11. **Isolamento e coluna "Caso":** nenhuma tabela nova, repository ou endpoint, e a série e o log não levam escola; a leitura do cadastro de suboperador é a do principal (`SuboperadorDaEscolaRepository`, que não tem escopo de escola porque o suboperador é da operação). A coluna "Caso" tem o teste de cada linha.
12. **"O que verificar" dos guardiões:** `tenancy-guardian` e `privacy-guardian`: sem tabela, query nem campo de pessoa; o log leva só `provedorId`, tentativas e código, e o caso prova que a chave e o contrato não saem. `conformidade-reviewer`: a conferência não decide nada sobre aluno e a reserva só atende tarefa aprovada (a elegibilidade lê a conferência, caso próprio); as categorias que o contrato da reserva tem de cobrir são as das tarefas aprovadas para ela, e o worker as entrega à conferência (caso "as categorias que o contrato da reserva tem de cobrir…", com `falso-reserva` aprovada em todas, e o bloco que troca `tarefas:` por `[]`). `infra-guardian`: o limitador da reserva usa o contratado dela (`LLM_RESERVA_TOKENS_POR_MINUTO`, dividido pelas réplicas no seguro), o limitador da reserva é outro objeto, com o contratado dela (caso próprio, com contratados diferentes nos dois); a chave por identidade é do gateway, na 7.0; o alerta tem `noDataState: OK`, sem `absent()`, e runbook. `llm-integrator`: nenhuma chamada nova a provedor, e o limitador está entregue ao gateway, que só o lê na 7.0. O `achados/indice.md` só traz rodadas de `revisao-spec` e da 1.0: as recomendações da 1.0 que citam a 2.0 estão atendidas (a conferência ligada à elegibilidade, o limitador por réplica e por identidade); a do `privacy-guardian` sobre `ExecucaoAgente` e `consumo_ia.provedor` é da 4.0, que é quando uma chamada vai à reserva.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| `ReservaConfig` ganha `ambiente` (o `AMBIENTE` lido por `loadLLMConfig`), e `llm-config.ts` e o `llm-config.test.ts`, que a tarefa não previa, mudam | A elegibilidade precisa do ambiente (a entrada de `falso-reserva` não vale em `producao`), e a configuração do `main-worker` não o guarda em lugar nenhum: sem ele o módulo teria de ler `process.env` ou chutar `local` | `techspec.md` §5 "A aprovação" (o ambiente na `reservaElegivel`) e o parágrafo "A conferência e o limitador da reserva no worker (2.0)" (`ReservaConfig.ambiente`) |
| A conferência recusada e a sem banco da reserva são dois eventos (`ia.provedor_de_reserva.conferencia_recusada` e `ia.provedor_de_reserva.conferencia_sem_banco`), e há um terceiro, `ia.provedor_de_reserva.conferida`; a Tech Spec só nomeava o primeiro | O principal separa o banco que não responde (`ia.soberania_na_subida_sem_banco`) da recusa por contrato, e o runbook diz ao operador que causa procurar em cada um; a reserva repete a separação, com as mesmas chaves (`provedorId`, `tentativas` e `codigo`, ou o resumo do erro) | `techspec.md` §5, parágrafo "A conferência e o limitador da reserva no worker (2.0)", e §7 (a linha "Log"); `cenarios.md` §1, RF1, a linha dos logs (`conferencia_recusada`) |

## Mutações

--faltando: 18 linhas (14 blocos, 3 motivos, 1 como contexto de bloco)

```mutacao
arquivo: packages/core/src/ia/soberania.ts
teste: packages/core/src/ia/soberania.test.ts
-this.#envio = daReserva === undefined ? destinoDoAdaptador(opcoes.config).envio : daReserva.envio
+this.#envio = daReserva !== undefined ? destinoDoAdaptador(opcoes.config).envio : daReserva.envio
```

```mutacao
arquivo: packages/core/src/ia/soberania.ts
teste: packages/core/src/ia/soberania.test.ts
-this.#exigidas = daReserva === undefined ? categoriasEnviadasPelasTarefas() : categoriasDasTarefas(daReserva.tarefas)
+this.#exigidas = daReserva !== undefined ? categoriasEnviadasPelasTarefas() : categoriasDasTarefas(daReserva.tarefas)
```

```mutacao
arquivo: packages/core/src/ia/soberania.ts
teste: packages/core/src/ia/soberania.test.ts
-this.#eventos = daReserva === undefined ? EVENTOS_DO_PRINCIPAL : EVENTOS_DA_RESERVA
+this.#eventos = daReserva !== undefined ? EVENTOS_DO_PRINCIPAL : EVENTOS_DA_RESERVA
```

```mutacao
arquivo: packages/core/src/ia/soberania.ts
teste: packages/core/src/ia/soberania.test.ts
-if (this.#deveAvisar('sem_banco')) this.opcoes.logger.warn({ evento, provedorId, tentativas, erro: summarizeError(erro) })
+if (!this.#deveAvisar('sem_banco')) this.opcoes.logger.warn({ evento, provedorId, tentativas, erro: summarizeError(erro) })
```

```mutacao
arquivo: packages/core/src/ia/soberania.ts
teste: packages/core/src/ia/soberania.test.ts
-if (this.#deveAvisar(codigo)) this.opcoes.logger.warn({ evento, provedorId, tentativas, codigo })
+if (!this.#deveAvisar(codigo)) this.opcoes.logger.warn({ evento, provedorId, tentativas, codigo })
```

```mutacao
arquivo: apps/api/src/ia/ia-do-worker.module.ts
teste: apps/api/src/ia/reserva-na-subida.int.test.ts › as categorias que o contrato da reserva tem de cobrir
-daReserva: { envio: reserva.envio, tarefas: tarefasAprovadasParaAReserva(reserva, config.reserva.ambiente) },
+daReserva: { envio: reserva.envio, tarefas: [] },
```

```mutacao
arquivo: apps/api/src/ia/ia-do-worker.module.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › sem reserva, ou com a reserva sem contratado
-redis === null || config.reserva?.tokensPorMinuto === undefined ? null : new TokenLimiter(redis, { tokensPorMinuto: config.reserva.tokensPorMinuto, replicas: config.replicas }),
+redis === null || config.reserva === undefined ? null : new TokenLimiter(redis, { tokensPorMinuto: config.reserva.tokensPorMinuto ?? 1_000, replicas: config.replicas }),
```

```mutacao
arquivo: packages/core/src/telemetry/metrics.ts
teste: packages/core/src/telemetry/metrics.test.ts
-.addCallback((observador) => observador.observe(conferida() ? 1 : 0, { provedor }))
+.addCallback((observador) => observador.observe(conferida() ? 0 : 1, { provedor }))
```

```mutacao
arquivo: apps/api/src/ia/ia-do-worker.module.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › o `main-worker` monta o limite de tokens quando há
-useFactory: (): Redis | null => (config.tokensPorMinuto === undefined && config.reserva?.tokensPorMinuto === undefined ? null : createQueueRedisClient(redisFilaUrl, 'worker-ia-tokens', throttledWarn(() => logger.warn({ evento: 'worker_ia.redis_dos_tokens_indisponivel' })))),
+useFactory: (): Redis | null => (config.reserva?.tokensPorMinuto === undefined ? null : createQueueRedisClient(redisFilaUrl, 'worker-ia-tokens', throttledWarn(() => logger.warn({ evento: 'worker_ia.redis_dos_tokens_indisponivel' })))),
```

```mutacao
arquivo: apps/api/src/ia/ia-do-worker.module.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › sem reserva, ou com a reserva sem contratado
-useFactory: (): Redis | null => (config.tokensPorMinuto === undefined && config.reserva?.tokensPorMinuto === undefined ? null : createQueueRedisClient(redisFilaUrl, 'worker-ia-tokens', throttledWarn(() => logger.warn({ evento: 'worker_ia.redis_dos_tokens_indisponivel' })))),
+useFactory: (): Redis | null => (config.tokensPorMinuto === undefined ? null : createQueueRedisClient(redisFilaUrl, 'worker-ia-tokens', throttledWarn(() => logger.warn({ evento: 'worker_ia.redis_dos_tokens_indisponivel' })))),
```


```mutacao
arquivo: apps/api/src/ia/ia-do-worker.module.ts
teste: apps/api/src/ia/reserva-na-subida.int.test.ts › reserva sem suboperador vigente
-observeProvedorDeReserva(medidor ?? globalMeter(), reserva.identidade, () => soberania.conferida)
+observeProvedorDeReserva(globalMeter(), reserva.identidade, () => soberania.conferida)
```

```mutacao
arquivo: apps/api/src/ia/ia-do-worker.module.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › o `main-worker` monta o limite de tokens quando há
 medidor: medidor ?? globalMeter(),
-...(limiteDeTokens === null ? {} : { limiteDeTokens }),
+...(limiteDeTokens !== null ? {} : { limiteDeTokens }),
```

```mutacao
arquivo: apps/api/src/ia/ia-do-worker.module.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › o limitador da reserva usa o contratado dela
-...(limiteDeTokensDaReserva === null ? {} : { limiteDeTokensDaReserva }),
+...(limiteDeTokensDaReserva !== null ? {} : { limiteDeTokensDaReserva }),
```

```mutacao
arquivo: apps/api/src/ia/ia-do-worker.module.ts
teste: apps/api/src/ia/fila-de-ia.int.test.ts › sem reserva, ou com a reserva sem contratado
-...(soberaniaDaReserva === null ? {} : { soberaniaDaReserva }),
+...(soberaniaDaReserva !== null ? {} : { soberaniaDaReserva }),
```

Motivos, sem bloco: `redis === null` (a primeira metade da condição do limitador da reserva) só estreita o tipo de `redis` para o `TokenLimiter`: o cliente só é `null` quando nem o principal nem a reserva têm contratado, e então a segunda metade (`config.reserva?.tokensPorMinuto === undefined`) já devolve `null`; tirá-la deixa o comportamento igual. `reserva === undefined` e `config.reserva === undefined` (as duas metades da guarda da conferência da reserva) são o mesmo teste dito de dois lados: `adaptadorDaReserva(config)` só devolve `undefined` quando `config.reserva` é `undefined`, e cada metade só estreita o tipo da outra; tirar uma deixa a outra decidir.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| `conformidade-reviewer` (1ª) | Quando a chamada passar a ir à reserva, a consulta de auditoria deve mostrar também qual provedor gerou o item (`consumo_ia.provedor`, `pelo_provedor_de_reserva`), com um caso numa entrega gerada pela reserva e aprovada pelo professor (D61) | tarefa 4.0 (o revisor a dá como "para a 4.0 e a 7.0"): a 2.0 não manda chamada à reserva |
| `conformidade-reviewer` (1ª) | `MODELOS_APROVADOS` aprova todas as `TAREFAS_DE_IA` para a reserva falsa: caso que prove que nenhuma tarefa de discursiva ou redação chega à reserva por caminho que o principal não teria (regra 70, item 2a) | tarefa 4.0 (a elegibilidade e o roteamento); vale também depois que a entrada da reserva real substituir a falsa |
| `privacy-guardian` (1ª) | Contrato encerrado sem reinício: depois de conferida, a instância não lê o cadastro de novo; ler de tempos em tempos, ou antes do primeiro envio depois de um tempo parada | tarefa 4.0 ou 7.0 (o revisor a dá assim): muda o comportamento da conferência, e o runbook já manda reiniciar os `worker-ia` ao encerrar o suboperador |
| `privacy-guardian` (1ª) | O código não confere que o contrato permite serviço usado por menor (nem para o principal): campo no cadastro de suboperador e motivo novo (ex.: `menor_nao_permitido`), regra 20, item 13 | `TODO.md`, na seção da LGPD: é lacuna anterior à 2.0, muda o cadastro e a D62, e o runbook (causa 2) já pede a conferência à mão |
| `privacy-guardian` (1ª) e `llm-integrator` (1ª) | A execução que cair na reserva grava o `provedor` da reserva em `ExecucaoAgente` e em `consumo_ia`, e o arquivo do titular e a lista de compartilhamento passam a mostrá-lo (condição para aprovar a 4.0) | tarefa 5.0 (o `ConsumoRepository` grava a coluna, subtarefa 5.1 do `tasks.md`; o destino por chamada vem da 4.0, e a 5.0 o grava): só há execução na reserva quando o roteamento a ligar |
| `infra-guardian` (1ª) | O alerta da reserva também dispara com o Postgres fora; considerar inibir um pelo outro na política de notificação | recusada: o revisor a dá como "se o barulho incomodar", o runbook já cobre o caso (causa 4 de "Provedor de reserva de IA não conferido"), e a política de notificação do Grafana não é desta tarefa |
| `llm-integrator` (1ª) | Quando a 4.0 ligar a reserva ao roteamento, anexar a estimativa de custo por professor/mês (chamadas, perfil, custo) | tarefa 4.0 |
| `revisor-geral` (2ª) e `test-engineer` (2ª) | Autoconferência, item 3: citava o caso dos baldes por identidade, que saiu | ajustado no documento, antes do commit |
| `infra-guardian` (2ª) e `test-engineer` (2ª) | `reserva-na-subida.int.test.ts`, `cadastrar('falso-reserva')` usa chave fixa: se uma rodada interrompida deixar a linha no banco, a próxima falha no insert; apagar a chave antes de gravar, ou `on conflict` | `TODO.md`, em "Infra e operação", junto ao registro do teste intermitente: robustez de teste contra execução interrompida; o `afterEach` já limpa a chave e o portão passou |
| `infra-guardian` (2ª) | Quando a 4.0 e a 5.0 pousarem, conferir se o parágrafo "Quando é a reserva" do runbook bate com a tarefa que ligar o desvio e o disjuntor próprio | tarefa 4.0 e tarefa 5.0 (a que de fato ligar o desvio) |
| `privacy-guardian` (2ª) | Quando a 5.0 pousar, transformar em teste o passo manual do runbook (a lista de compartilhamento mostrando a reserva depois de uma chamada real a ela) | tarefa 5.0 |
| `privacy-guardian` (2ª) | O contrato que permite serviço usado por menor (regra 20, item 13) continua lacuna e precisa fechar antes de a reserva atender escola | já está no `TODO.md`, na seção de LGPD, com dono (rodada 1); fica como condição antes de a reserva atender |
| `conformidade-reviewer` (2ª) | Quando a 4.0 ligar o roteamento, o caso do item 2a (a reserva não abre rota para discursiva e redação) deve rodar contra a aprovação total de `falso-reserva`, onde um desvio apareceria | tarefa 4.0 |
| `conformidade-reviewer` (2ª) | Confirmar que a prova do balde por identidade, que saiu de `fila-de-ia.int.test.ts`, está anotada na 7.0 | já anotada: o `2_task.md` (item 12 da Autoconferência e "Fora do escopo") a passa para a 7.0 |
| `llm-integrator` (2ª) | Repetir a auditoria de IA na 4.0: discursiva e redação, `consumo_ia.provedor` e `ExecucaoAgente`, estimativa de custo por professor/mês | tarefa 4.0 (já anotadas na tabela do documento) |
| `llm-integrator` (2ª) | Investigar logo a intermitência de `FilaDeIa.ociosa` em `fila-de-ia.int.test.ts` (job que fica `ativo`), que toca o worker de IA (regra 30, item 8) | `TODO.md` (já registrado na rodada 1, em "Infra e operação"): é anterior à 2.0 e passou no portão |
| `revisor-geral` (2ª) | `soberania.ts`: `const evento = this.#eventos.X` seguido do uso na linha de baixo é uma variável a mais | recusada: legibilidade, não bloqueia, e mexer em `soberania.ts` outra vez caducaria os sete revisores e refaria os blocos; o lint do log exige o nome `evento` |
| `revisor-geral` (2ª) | `ia-do-worker.module.ts:84`: o comentário do callback passa de 200 colunas e caberia melhor no teste que monta o módulo várias vezes | recusada: foi a metade barata da recomendação do `infra-guardian` (1ª); mover o comentário caduca revisores, sem ganho de comportamento |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-22 15:49:02 | 2026-11-22 15:49:31 | `tenancy-guardian` | 1 | APROVADO | acd625751fe3b74cb |
| 2026-11-22 15:49:08 | 2026-11-22 15:49:40 | `conformidade-reviewer` | 1 | APROVADO | aba7d147812173167 |
| 2026-11-22 15:49:05 | 2026-11-22 15:49:50 | `privacy-guardian` | 1 | APROVADO | a6b4b316fd6b13552 |
| 2026-11-22 15:49:12 | 2026-11-22 15:50:12 | `infra-guardian` | 1 | APROVADO | a60e4898769222096 |
| 2026-11-22 15:49:22 | 2026-11-22 15:50:23 | `revisor-geral` | 1 | APROVADO | ab70406865819048f |
| 2026-11-22 15:49:15 | 2026-11-22 15:51:05 | `llm-integrator` | 1 | APROVADO | a2326d05036111b0a |
| 2026-11-22 15:49:19 | 2026-11-22 15:51:49 | `test-engineer` | 1 | REPROVADO | a9af6593abc5a16c4 |
| 2026-11-22 16:12:05 | 2026-11-22 16:12:15 | `tenancy-guardian` | 2 | APROVADO | ac1685d33be3c229c |
| 2026-11-22 16:12:10 | 2026-11-22 16:12:32 | `privacy-guardian` | 2 | APROVADO | a0a416ee06c3da019 |
| 2026-11-22 16:12:14 | 2026-11-22 16:12:32 | `conformidade-reviewer` | 2 | APROVADO | ad0b62895c1116d6a |
| 2026-11-22 16:12:24 | 2026-11-22 16:12:44 | `llm-integrator` | 2 | APROVADO | a7c08820c6d7dfbc4 |
| 2026-11-22 16:12:20 | 2026-11-22 16:13:05 | `infra-guardian` | 2 | APROVADO | abf67682179daea5c |
| 2026-11-22 16:12:38 | 2026-11-22 16:13:15 | `revisor-geral` | 2 | APROVADO | afeb84836a0ef1a41 |
| 2026-11-22 16:12:32 | 2026-11-22 16:13:42 | `test-engineer` | 2 | APROVADO | af16bfcffd8261ed5 |
