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
worker (o `WORKER_POOL_FERRAMENTA` nasce com o `worker-ia`, na 5.0). O `JobExecutor` no `core` leva o `bullmq` ao `package.json`
dele (`DelayedError`, `UnrecoverableError`).

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
`fila-de-respostas`. Um `AreaErrorBoundary paginaInteira`, com texto próprio, envolve o `<Switch>` de `AppRoutes`. O `Falha`
ganha "Voltar ao início" (`<a href="/">`, que limpa a fronteira; `/operacao` na operação; 44 px, secundário).

**O Redis fora (54.0).** `#semRedis` de `credencial/challenge.ts` devolve `INDISPONIVEL_TENTE_DE_NOVO` com `Retry-After`, como
`operacao/operador-challenge.ts`, e `conferirLivre` vem antes de qualquer reserva. A web espera o `Retry-After` uma vez, até 10 s,
com o botão desabilitado e um aviso em `role="status"`; acima disso, ou num segundo `503`, o `ErrorState`. O seletor mantém a
escola.

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
alerta. A `rodando` interrompida (reentrega ou varredura) grava, na transação que a encerra, uma linha em `consumo_ia` com os dois
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
