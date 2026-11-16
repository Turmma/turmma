# Tarefa 8.0 — Texto de aluno não sai do Brasil: a subida e o gateway conferem a D62 (50.0)

**Funcionalidade:** reengenharia-continuacao · **Depende de:** 7.0
**Subagentes obrigatórios:** `privacy-guardian`, `infra-guardian`, `conformidade-reviewer`, `llm-integrator`
**Porte:** grande

## Objetivo

Toda tarefa de IA declara `levaTextoDeAluno` e `categoriasEnviadas`. Com provedor externo, o `main-worker` (`worker-ia`) não
consome fila sem um suboperador vigente da `IA_PROVEDOR_ID` com `pais = 'BR'`, `veda_treinamento`, `alcance = 'todas'` e
todas as categorias das tarefas registradas; o adaptador falso e o local sobem sem ele. **A API não confere e a `/prontidao`
dela não muda** (decisão A do Joaquim, 16/11: o horário de aula é sagrado, regra 80). A cada chamada, o `LLMGateway`
recusa a tarefa com texto de aluno sem declaração conferida, antes do orçamento e do envio.

## Contexto necessário

- `techspec.md` §5 "A D62", §7b
- `prd.md` RF9, RF10; §8b
- `docs/decisoes.md` D62; `tasks/prd-reengenharia/onda-3c.md` "RF20 — a D62 na subida (50.0)"
- `.claude/rules/` 20 (itens 12, 13), 30 (itens 1, 9), 40, 70, 80
- Código: `packages/core/src/ia/task.ts`, `packages/core/src/ia/tasks/`, `packages/core/src/ia/tasks/tarefas.test.ts`;
  `packages/core/src/ia/llm-gateway.ts`; `packages/core/src/db/schema/suboperador.ts` (o docblock diz os campos);
  `packages/core/src/titular/suboperador-da-escola.repository.ts`; `packages/core/src/config/llm-config.ts`
  (`IA_PROVEDOR_ID`); `apps/api/src/worker.module.ts`; `apps/api/src/main-worker.ts` (5.0)

## Subtarefas

- [x] 8.1 — `levaTextoDeAluno` e `categoriasEnviadas` obrigatórios em `TaskDefinition`; o `DECLARADO` de `tarefas.test.ts`
  fixa os dois de toda tarefa; `levaTextoDeAluno: true` exige `conversa_do_aluno`
- [x] 8.2 — A conferência do suboperador vigente na subida do `main-worker` (leitura `@Unscoped`, com motivo): com
  o banco fora, o worker não consome fila; a API não confere e segue pronta
- [x] 8.3 — No `LLMGateway`, antes do orçamento e do `fetch`: `IA_INDISPONIVEL` e o log `ia.geracao.soberania_recusada`
- [x] 8.4 — `docs/runbook.md`: encerrar o suboperador pede reiniciar os `worker-ia` (a API não reinicia) e o alerta "Job
  interativo esperando" cita os logs da D62; `docs/aia/tutor.md`: o turno sem a D62 como limitação, só com a regra da D36
- [x] 8.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/ia/soberania.ts`, `packages/core/src/ia/soberania.test.ts`, `apps/api/src/ia/soberania-na-subida.int.test.ts` | novo |
| `packages/core/src/ia/task.ts`, `packages/core/src/ia/tasks/`, `packages/core/src/ia/llm-gateway.ts`, `packages/core/src/ia/llm-gateway.test.ts`, `packages/core/src/titular/suboperador-da-escola.repository.ts`, `packages/core/src/ia/port.ts`, `packages/core/src/index.ts`, `apps/api/src/worker.module.ts`, `apps/api/src/ia/ia-do-worker.module.ts`, `apps/api/test/architecture.test.ts`, `tools/ia/medir-risco-a-vida.ts`, `tools/ia/medir-risco-a-vida.test.ts`, `docs/runbook.md`, `docs/aia/tutor.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| sobe, externo | I | suboperador vigente `BR`, `veda_treinamento`, `alcance = 'todas'` e a união das categorias: o worker consome | `apps/api/src/ia/soberania-na-subida.int.test.ts` › externo com o suboperador que cobre tudo: consome |
| D62 não conferida, a API | I | provedor externo com a D62 não conferida (cadastro que não cobre, sem suboperador ou banco fora): a API responde 200 em `/prontidao`. Mutação: a prontidão da API voltar a depender da conferência | `apps/api/src/ia/soberania-na-subida.int.test.ts` › provedor externo com o cadastro que não cobre a D62: a API responde 200 em /prontidao; › provedor externo sem suboperador nenhum, ou com o banco fora: a API responde 200 em /prontidao |
| recusa por campo | I | um caso por `pais`, `veda_treinamento`, `alcance`, vigência (`fim` preenchido): o worker não consome nem bate o batimento, e o log diz o motivo | `apps/api/src/ia/soberania-na-subida.int.test.ts` › recusa por … (`pais`, `veda_treinamento`, `alcance`, `vigência`): o worker não consome; `packages/core/src/ia/soberania.test.ts` › um campo errado, …, é o único motivo |
| recusa por categoria | I | um caso por categoria faltando. Mutação: conferir só `conversa_do_aluno` | `apps/api/src/ia/soberania-na-subida.int.test.ts` › recusa por categoria faltando (um caso por categoria, contra o worker); `packages/core/src/ia/soberania.test.ts` › sem a categoria …; › o cadastro sem uma categoria que uma tarefa envia não confere |
| outro provedor | I | o suboperador vigente é de outra `IA_PROVEDOR_ID`: o worker não consome, e o log diz `sem_suboperador_vigente` | `apps/api/src/ia/soberania-na-subida.int.test.ts` › o suboperador vigente é de outra IA_PROVEDOR_ID; `packages/core/src/ia/soberania.test.ts` › o suboperador vigente é de outro provedor |
| banco fora | I | o `main-worker` não consome fila, e o log é o do banco (a API segue pronta, no caso da API acima) | `apps/api/src/ia/soberania-na-subida.int.test.ts` › externo com o banco fora: não consome fila nem bate o batimento (a porta do banco parada de fato); `packages/core/src/ia/soberania.test.ts` › o banco fora é falha fechada |
| falso e local | I | o worker consome na hora, sem suboperador, e a API responde 200 | `apps/api/src/ia/soberania-na-subida.int.test.ts` › o falso e o local consomem na hora; › o local, com o banco fora, também consome; › … a API responde 200 em /prontidao, com o banco no ar ou fora |
| `DECLARADO` | U | fixa `levaTextoDeAluno` e `categoriasEnviadas` de toda tarefa. Mutação: tirar uma categoria | `packages/core/src/ia/tasks/tarefas.test.ts` › … declara a função que gasta e o perfil mais barato que resolve (uma linha do `DECLARADO` por tarefa) |
| `DECLARADO`, alvo some | U | tarefa registrada sem linha no `DECLARADO`: vermelho; tarefa definida fora do catálogo é acusada | `packages/core/src/ia/tasks/tarefas.test.ts` › o DECLARADO tem uma linha por tarefa do catálogo; › toda tarefa definida com defineTask em tasks/ está no catálogo |
| texto de aluno exige a categoria | U | `levaTextoDeAluno: true` sem `conversa_do_aluno`: vermelho | `packages/core/src/ia/tasks/tarefas.test.ts` › levaTextoDeAluno: true sem conversa_do_aluno nas categorias é incoerente |
| a tarefa sem a declaração | U | não compila (`@ts-expect-error`) | `packages/core/src/ia/tasks/tarefas.test.ts` › a tarefa sem a declaração não compila |
| gateway recusa | U | marca ligada e declaração não conferida: nenhum `fetch`, orçamento não consultado, `IA_INDISPONIVEL`. Mutação: conferir depois do orçamento | `packages/core/src/ia/llm-gateway.test.ts` › o Tutor e o Assistente com provedor externo e a D62 não conferida (`…`); › a declaração dita `conferida: false` recusa |
| gateway, falso | U | marca ligada e adaptador falso: a chamada sai | `packages/core/src/ia/llm-gateway.test.ts` › o adaptador falso e o modelo local não precisam da declaração; › a tarefa sem texto de aluno sai para o provedor externo; › a regra fixa não envia nada (D36); › createLLMGateway entrega a declaração das portas |
| log | U | `soberania_recusada` leva tarefa, ids e o provedor; nunca entrada, nome nem prompt | `packages/core/src/ia/llm-gateway.test.ts` › o log da recusa leva o evento, a tarefa, os ids e o provedor |
| fiação do gateway | U | todo `createLLMGateway` de produção entrega a `soberania`: sem ela o worker recusaria o Tutor com o cadastro conferido; a chamada com as portas numa variável (forma não reconhecida) também reprova | `apps/api/test/architecture.test.ts` › entrega a soberania, e há ao menos um; › a varredura reprova a chamada sem a soberania |
| leitura da instância | U | a leitura da conferência é a única `@Unscoped` da `SuboperadorDaEscolaRepository`, devolve só quatro campos | `apps/api/test/architecture.test.ts` › o único @SemEscopo do escritor… |
| desligar sem conferir | I | a instância que desliga sem ter conferido não cria o consumidor, nem a que encerra a conferência sozinha, nem o ciclo desligado antes de a D62 ser conferida (a ordem do Nest não decide) | `apps/api/src/ia/soberania-na-subida.int.test.ts` › externo que desliga sem ter conferido; › a conferência encerrada sem o ciclo desligar; › o ciclo desligado antes de a D62 ser conferida; `packages/core/src/ia/soberania.test.ts` › depois de encerrada, a instância não lê o cadastro |
| AIA e runbook | — | os parágrafos existem e dizem o que o código faz | `docs/runbook.md` › "A D62 na subida: o `worker-ia` parado" e a causa 5 de "Job interativo esperando"; `docs/aia/tutor.md` › item 16 |

## Como testar

- Gateway: `packages/core/src/ia/llm-gateway.test.ts` › "função suspensa na escola A recusa com erro próprio, sem chamar o
  adaptador, sem consultar orçamento e sem registrar consumo" — a mesma forma
- Subida: `packages/core/src/ia/llm-gateway.test.ts` › "criarProvedorDeIa: sem nada configurado, a porta é a do adaptador
  falso"; prontidão com o banco fora: `apps/despachante/test/redis-ready.int.test.ts` como forma
- `DECLARADO`: `packages/core/src/ia/tasks/tarefas.test.ts` › "o catálogo do núcleo tem exatamente as tarefas do contrato…"
- Comando: `npx vitest run --project integracao apps/api/src/ia/soberania-na-subida.int.test.ts`
- Armadilha (F4, aviso 3): o "banco fora" para o banco de fato no teste, e o dublê lança o erro que o driver lança

## Autoconferência

As 12 perguntas do modelo, respondidas no plano (8.0). Na 1: cada campo da conferência do suboperador é um bloco. Na 6: o `DECLARADO` é
guarda, com os dois lados.

1. **Mutação de cada cláusula:** a seção "Mutações" tem um bloco por campo do suboperador (`pais`, `veda_treinamento`, `alcance`, a categoria e a união delas, o suboperador ausente), por cláusula do ciclo da `SoberaniaNaSubida` (a primeira leitura, o `??=`, o intervalo, a espera de `aguardarConferida`, o desligamento, a conferência que termina depois dele, a conta das repetições por motivo, o log de cada motivo), pelos dois termos do `where` da leitura (`chave` e `fim`), pelos três termos da guarda do gateway, a ordem antes do orçamento, o ramo da regra fixa, o log, o consumo do worker (as duas negações e a marca de encerramento do ciclo), a prontidão da API que não muda (a mutação é a dependência voltar) e a fiação (`createLLMGateway`, com a forma não reconhecida). Cada bloco foi aplicado e rodado, e cada um caiu num caso que rodou.
2. **Texto na tela:** nenhum. A tarefa não tem tela; o aluno vê a falha de sempre ("Tentar de novo"), que a 7.0 já cobre. `docs/interface.md` não muda.
3. **Segundo dado:** dois provedores (a `IA_PROVEDOR_ID` da instância e o outro, que cobre tudo); um cadastro por campo errado, e as quatro categorias exigidas, uma por vez; o falso e o local ao lado do externo; a tarefa sem texto de aluno ao lado do Tutor e do Assistente.
4. **Checagem anterior (o controle):** "provedor externo com o suboperador vigente que cobre tudo" prova o 200 antes de cada recusa; "com a D62 conferida a chamada sai" ao lado da recusa; "corrigido o cadastro, a instância fica pronta sozinha" confere o 503 antes do 200; o worker mostra zero consumidores antes de passar a ter um por fila.
5. **Asserção:** o status e o corpo de `/prontidao`; os consumidores que o BullMQ conhece (`Queue.getWorkers()`) e o arquivo do batimento; as chamadas ao adaptador (contadas) e a consulta do orçamento; as linhas de consumo; as linhas do log, lidas do logger. Nunca o texto do código.
6. **Guarda nova:** `architecture.test.ts` ganha a que cobra a `soberania` em todo `createLLMGateway` de produção, com os dois lados (a que passa e a que reprova), e a lista de métodos da `SuboperadorDaEscolaRepository` (a leitura da conferência é a única `@Unscoped`, com a justificativa). O `DECLARADO` de `tarefas.test.ts` é guarda com os dois lados: a tarefa sem linha fica vermelha e a definida fora do catálogo é acusada.
7. **Comentários:** o docblock de `soberania.ts`, de `TaskDefinition.categoriasEnviadas`, de `DeclaracaoDeSoberania`, do `LLMGateway`, do `CicloDoWorkerDeIa` e do `vigenteDoProvedor` dizem o que o código faz agora; o comentário da ferramenta de medição diz por que ela declara a soberania.
8. **Divergências:** a tabela acima; a decisão está no `techspec.md` §5 "A D62" e "Como a 8.0 ficou" (só o `worker-ia` para, a API segue pronta; "pede reiniciar" os `worker-ia`, a qualquer hora) e no `prd.md` RF9, revistos em 16/11 (decisão A do Joaquim, `.processo/ordens/divergencia-8-r1-arquiteto.md`).
9. **Peça que já existe:** `destinoDoAdaptador` (quem diz se há envio externo e para qual provedor), `SuboperadorDaEscolaRepository` e o `@Unscoped`, `ScriptedAdapter` e `startFakeLlamaServer`, `subirApi`, `testConfig`, `urlRedisDeFila`, `Heartbeat`, `summarizeError`, `createLogger`. Nenhum mecanismo próprio de fila ou de saúde.
10. **Concorrência:** a primeira conferência é memoizada (`iniciar` idempotente: o bootstrap e quem espera dividem uma leitura); o desligamento durante uma leitura em andamento não agenda outra nem deixa temporizador; duas instâncias leem o cadastro cada uma, sem escrita nenhuma.
11. **Isolamento e "Caso":** a leitura não tem escola nem requisição, é `@Unscoped` com a justificativa de 30 caracteres ou mais, devolve só quatro campos (nunca contrato nem a lista das escolas) e vale só para a tabela `suboperador`, que não tem `escola_id`; o teste de `architecture.test.ts` a fixa. A coluna "Caso" está preenchida.
12. **Guardiões e achados:** `privacy-guardian` (o log só leva evento, ids, o provedor e códigos fixos; a leitura devolve quatro campos; o texto de aluno não sai sem conferir), `infra-guardian` (a prontidão da API que não muda, o worker que não consome, o runbook e a causa 5 de "Job interativo esperando", o reinício dos `worker-ia` ao encerrar o suboperador, o intervalo de 5 s), `conformidade-reviewer` (a D36 passa pela recusa, a AIA) e `llm-integrator` (a ordem antes do orçamento e do envio, a categoria por tarefa, a medição com `--provedor-contratado`). A 1ª rodada reprovou o `infra-guardian` (a prontidão da API dependia da D62) e a ordem de correção `.processo/ordens/8_task-r1.md` foi atendida item por item; as recomendações dos que aprovaram entraram, e as que não entram estão no `TODO.md` ou na ordem.

## Fora do escopo desta tarefa

O provedor de reserva e o roteamento para ele (F5); a contagem no uso (9.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| `apps/api/src/main.ts` e `main-worker.ts` não mudam; mudam `worker.module.ts` e `ia-do-worker.module.ts` (e **não** o `app.module.ts` nem o `ia.module.ts` da API) | A composição de cada processo mora nos módulos: `main.ts` e `main-worker.ts` só sobem o que o módulo monta. A conferência é um provider (`SoberaniaNaSubida`) só do `main-worker` (`IaDoWorkerModule`), com `OnApplicationBootstrap`, e o `CicloDoWorkerDeIa` do `worker.module.ts` a espera antes de criar o consumidor. A API não tem a conferência (decisão A do Joaquim, 16/11) | `techspec.md` §5 "A D62"; §2, a linha de `main-worker.ts` e `worker.module.ts` |
| `DeclaracaoDeSoberania` mora em `port.ts`, e não em `soberania.ts` | O `llm-gateway.ts` a lê e o `soberania.ts` importa `destinoDoAdaptador` do gateway: a interface no `soberania.ts` fechava o ciclo que o `guarda:camadas` (`sem-ciclo`) reprova | `techspec.md` §5 "A D62" |
| A instância não conferida **se confere de novo a cada 5 s** (`INTERVALO_DA_NOVA_CONFERENCIA_MS`), em vez de derrubar o processo | "Não fica pronta" (spec) vale também para o cadastro corrigido depois da subida: o `worker-ia` espera sem derrubar o processo, e não precisa de reinício para entrar em serviço quando o cadastro é corrigido. O contrário, encerrar o suboperador, continua pedindo reinício dos `worker-ia` (runbook) | `techspec.md` §5 "A D62" ("não fica pronta"; "pede reiniciar") |
| O log da recusa na subida traz os motivos na chave `codigo` (separados por vírgula), não em `motivos` | A guarda `log-sem-dado-pessoal` só aceita valor calculado sob chaves operacionais; os motivos são códigos fixos (`MotivoDaD62`) | `docs/runbook.md` "A D62 na subida" |
| `tools/ia/medir-risco-a-vida.ts` (e o teste dela) passa `soberania: { conferida: true }` | A medida do Tutor com `--provedor-contratado` usa lote **sintético** e roda **antes** de haver suboperador cadastrado (é o que a D37 pede para escolher o provedor): sem a declaração o gateway recusaria a medida inteira. A ferramenta não é a instância da API nem do worker, e a declaração fica dita no comentário | `techspec.md` §5 "A D62"; `docs/aia/tutor.md` (a medida de risco à vida, `--provedor-contratado`) |
| Os testes de conteúdo das tarefas (`turno-do-tutor.test.ts`, `numeros.test.ts`) e cinco casos de `llm-gateway.test.ts` passam `soberania` conferida | O provedor roteirizado de teste é externo (`envioExterno: true`) e esses testes tratam do conteúdo da tarefa, não da D62, que tem os casos próprios no `llm-gateway.test.ts` | `cenarios.md` §5 (gateway recusa) |
| **A API não confere a D62: `ReadinessController`, `IaModule` e `AppModule` ficam como estavam; só o `main-worker` para** (o `prd.md` RF9 dizia "a API e o `main-worker` não ficam prontos", e a primeira versão desta tarefa fez isso) | A 1ª rodada reprovou o `infra-guardian`: o 503 de `/prontidao` tira a API do balanceamento por causa de um cadastro de suboperador, em pleno horário de aula (regra 80, item 4; regra inegociável 6). O Joaquim decidiu **A** em 16/11: o `prd.md` RF9, o `techspec.md` §5 e o `cenarios.md` §5 foram revistos pelo Arquiteto, e a árvore volta ao que era na API. A conferência no `worker-ia` e a recusa no gateway seguem | `prd.md` RF9; `techspec.md` §5 "A D62" e "Como a 8.0 ficou" (itens 1, 2 e 5); `cenarios.md` §5; `.processo/ordens/divergencia-8-r1-arquiteto.md` |
| `CicloDoWorkerDeIa` é exportado de `worker.module.ts` | O caso "o ciclo desligado antes de a D62 ser conferida" precisa desligar só o ciclo (sem a conferência) para provar que a marca `#encerrado` segura o consumidor, e não a ordem em que o Nest desliga os módulos | `techspec.md` §5 "Como a 8.0 ficou" (o desligamento) |
| A guarda de fiação do `architecture.test.ts` conta toda chamada de `createLLMGateway(` e reprova a que não tem a forma reconhecida (portas como objeto literal) | A forma antiga contava só a literal, e a chamada com as portas numa variável passava em silêncio (`test-engineer`, 1ª) | `cenarios.md` §5 (fiação) |

## Mutações

--faltando: 0 linhas (38 blocos, 0 motivos)

Cada bloco tira uma cláusula e exige o vermelho de um caso que rodou. Os que provam uma ausência levam o `falha:`.

```mutacao
arquivo: packages/core/src/ia/soberania.ts
teste: packages/core/src/ia/soberania.test.ts › sem suboperador vigente: um motivo só
-  if (suboperador === undefined) return ['sem_suboperador_vigente']
+  if (suboperador === undefined) return []
```

```mutacao
arquivo: packages/core/src/ia/soberania.ts
teste: packages/core/src/ia/soberania.test.ts › um campo errado, pais, é o único motivo
   const motivos: MotivoDaD62[] = []
-  if (suboperador.pais !== 'BR') motivos.push('pais_fora_do_brasil')
   if (!suboperador.vedaTreinamento) motivos.push('treinamento_nao_vedado')
```

```mutacao
arquivo: packages/core/src/ia/soberania.ts
teste: packages/core/src/ia/soberania.test.ts › um campo errado, veda_treinamento, é o único motivo
-  if (!suboperador.vedaTreinamento) motivos.push('treinamento_nao_vedado')
   if (suboperador.alcance !== 'todas') motivos.push('alcance_nao_e_todas')
```

```mutacao
arquivo: packages/core/src/ia/soberania.ts
teste: packages/core/src/ia/soberania.test.ts › um campo errado, alcance, é o único motivo
   if (!suboperador.vedaTreinamento) motivos.push('treinamento_nao_vedado')
-  if (suboperador.alcance !== 'todas') motivos.push('alcance_nao_e_todas')
   for (const categoria of exigidas) if (!suboperador.categorias.includes(categoria)) motivos.push(`categoria_faltando:${categoria}`)
```

```mutacao
arquivo: packages/core/src/ia/soberania.ts
teste: packages/core/src/ia/soberania.test.ts › sem a categoria
-  for (const categoria of exigidas) if (!suboperador.categorias.includes(categoria)) motivos.push(`categoria_faltando:${categoria}`)
+  for (const categoria of exigidas.filter((exigida) => exigida === 'conversa_do_aluno')) if (!suboperador.categorias.includes(categoria)) motivos.push(`categoria_faltando:${categoria}`)
```

```mutacao
arquivo: packages/core/src/ia/soberania.ts
teste: packages/core/src/ia/soberania.test.ts › o cadastro sem uma categoria que uma tarefa envia não confere
-    this.#exigidas = categoriasEnviadasPelasTarefas()
+    this.#exigidas = ['conversa_do_aluno']
```

```mutacao
arquivo: packages/core/src/ia/soberania.ts
teste: packages/core/src/ia/soberania.test.ts › o primeiro aviso sai e o mesmo motivo repetido espera
-    this.#intervaloMs = opcoes.intervaloMs ?? INTERVALO_DA_NOVA_CONFERENCIA_MS
+    this.#intervaloMs = INTERVALO_DA_NOVA_CONFERENCIA_MS
```

```mutacao
arquivo: packages/core/src/ia/soberania.ts
teste: packages/core/src/ia/soberania.test.ts › iniciar é idempotente
-    this.#primeira ??= this.#conferirEAgendar()
+    this.#primeira = this.#conferirEAgendar()
```

```mutacao
arquivo: packages/core/src/ia/soberania.ts
teste: packages/core/src/ia/soberania.test.ts › nasce conferido e nem lê o cadastro
   aguardarConferida(): Promise<boolean> {
-    if (this.#conferida) return Promise.resolve(true)
     if (this.#encerrada) return Promise.resolve(false)
```

```mutacao
arquivo: packages/core/src/ia/soberania.ts
teste: packages/core/src/ia/soberania.test.ts › encerrar para as conferências e solta quem esperava com false
     if (this.#conferida) return Promise.resolve(true)
-    if (this.#encerrada) return Promise.resolve(false)
     return new Promise((resolver) => this.#aguardando.add(resolver))
```

```mutacao
arquivo: packages/core/src/ia/soberania.ts
teste: packages/core/src/ia/soberania.test.ts › depois de encerrada, a instância não lê o cadastro
-    if (!envio.envioExterno || this.#encerrada) return
+    if (!envio.envioExterno) return
```

```mutacao
arquivo: packages/core/src/ia/soberania.ts
teste: packages/core/src/ia/soberania.test.ts › nasce conferido e nem lê o cadastro
-    if (!envio.envioExterno || this.#encerrada) return
+    if (this.#encerrada) return
```

```mutacao
arquivo: packages/core/src/ia/soberania.ts
teste: packages/core/src/ia/soberania.test.ts › provedor externo nasce não conferido
     if (this.#encerrada) return
-    if (passou) {
+    if (!passou) {
```

```mutacao
arquivo: packages/core/src/ia/soberania.ts
teste: packages/core/src/ia/soberania.test.ts › a que estava em andamento ao encerrar
-    if (this.#encerrada) return
     if (passou) {
```

```mutacao
arquivo: packages/core/src/ia/soberania.ts
teste: packages/core/src/ia/soberania.test.ts › o banco fora é falha fechada, com o evento próprio
-      if (this.#deveAvisar('sem_banco')) this.opcoes.logger.warn({ evento: 'ia.soberania_na_subida_sem_banco', provedorId, tentativas, erro: summarizeError(erro) })
+      if (!this.#deveAvisar('sem_banco')) this.opcoes.logger.warn({ evento: 'ia.soberania_na_subida_sem_banco', provedorId, tentativas, erro: summarizeError(erro) })
```

```mutacao
arquivo: packages/core/src/ia/soberania.ts
teste: packages/core/src/ia/soberania.test.ts › provedor externo nasce não conferido
-    if (motivos.length === 0) return true
```

```mutacao
arquivo: packages/core/src/ia/soberania.ts
teste: packages/core/src/ia/soberania.test.ts › o cadastro que não cobre fica não conferido e o log diz o motivo
-    if (this.#deveAvisar(codigo)) this.opcoes.logger.warn({ evento: 'ia.soberania_na_subida_recusada', provedorId, tentativas, codigo })
+    if (!this.#deveAvisar(codigo)) this.opcoes.logger.warn({ evento: 'ia.soberania_na_subida_recusada', provedorId, tentativas, codigo })
```

```mutacao
arquivo: packages/core/src/ia/soberania.ts
teste: packages/core/src/ia/soberania.test.ts › o motivo que muda sai na hora
-    if (motivo !== this.#ultimoMotivo) {
+    if (motivo === '') {
```

```mutacao
arquivo: packages/core/src/ia/soberania.ts
teste: packages/core/src/ia/soberania.test.ts › a repetição conta as tentativas do mesmo motivo
       this.#ultimoMotivo = motivo
-      this.#repeticoes = 1
       return true
```

```mutacao
arquivo: packages/core/src/ia/soberania.ts
teste: packages/core/src/ia/soberania.test.ts › o aviso se repete a cada 12 tentativas do mesmo motivo
-    return this.#repeticoes % REPETICAO_DO_LOG === 0
+    return false
```

```mutacao
arquivo: packages/core/src/titular/suboperador-da-escola.repository.ts
teste: apps/api/src/ia/soberania-na-subida.int.test.ts › o suboperador vigente é de outra IA_PROVEDOR_ID
-      .where(and(eq(suboperador.chave, chave), isNull(suboperador.fim)))
+      .where(isNull(suboperador.fim))
```

```mutacao
arquivo: packages/core/src/ia/soberania.ts
teste: apps/api/src/ia/soberania-na-subida.int.test.ts › o suboperador vigente é de outra IA_PROVEDOR_ID
-  if (suboperador === undefined) return ['sem_suboperador_vigente']
+  if (suboperador === undefined) return ['alcance_nao_e_todas']
```

```mutacao
arquivo: packages/core/src/titular/suboperador-da-escola.repository.ts
teste: apps/api/src/ia/soberania-na-subida.int.test.ts › recusa por vigência
-      .where(and(eq(suboperador.chave, chave), isNull(suboperador.fim)))
+      .where(eq(suboperador.chave, chave))
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › a tarefa sem texto de aluno sai para o provedor externo sem a declaração
-    if (!tarefa.levaTextoDeAluno || !envio.envioExterno || this.dependencias.soberania?.conferida === true) return
+    if (!envio.envioExterno || this.dependencias.soberania?.conferida === true) return
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o adaptador falso e o modelo local não precisam da declaração
-    if (!tarefa.levaTextoDeAluno || !envio.envioExterno || this.dependencias.soberania?.conferida === true) return
+    if (!tarefa.levaTextoDeAluno || this.dependencias.soberania?.conferida === true) return
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › com a D62 conferida a chamada sai
-    if (!tarefa.levaTextoDeAluno || !envio.envioExterno || this.dependencias.soberania?.conferida === true) return
+    if (!tarefa.levaTextoDeAluno || !envio.envioExterno) return
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › com provedor externo e a D62 não conferida
falha: expect(consultar).not.toHaveBeenCalled()
-      this.exigirSoberania(pedido, inicio)
       // Antes do orçamento e do envio: o pedido que estoura o teto da tarefa é defeito nosso, e não gasta nada nem a vez de ninguém.
       this.exigirPedidoDentroDoTeto(pedido, entrada, inicio)
       await this.exigirOrcamento(pedido, inicio)
+      this.exigirSoberania(pedido, inicio)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › a regra fixa não envia nada
     const fixa = tarefa.semModelo?.(entrada)
+    this.exigirSoberania(pedido, inicio)
     if (fixa === undefined) {
       // A D62, antes do teto, do orçamento e do envio: texto de aluno não sai para provedor que a subida não conferiu.
-      this.exigirSoberania(pedido, inicio)
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › com provedor externo e a D62 não conferida
     this.dependencias.logger?.warn({ evento: 'ia.geracao.soberania_recusada', tipo, codigo: 'IA_INDISPONIVEL', escolaId: pedido.escolaId, execucaoId: pedido.execucaoId, provedorId: envio.provedorId, duracaoMs })
-    throw new LLMError('IA_INDISPONIVEL')
+    return
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts › o log da recusa leva o evento
-    this.dependencias.logger?.warn({ evento: 'ia.geracao.soberania_recusada', tipo, codigo: 'IA_INDISPONIVEL', escolaId: pedido.escolaId, execucaoId: pedido.execucaoId, provedorId: envio.provedorId, duracaoMs })
```

```mutacao
arquivo: apps/api/src/worker.module.ts
teste: apps/api/src/ia/soberania-na-subida.int.test.ts › a conferência encerrada sem o ciclo desligar
-      if (conferida && !this.#encerrado) this.#consumir()
+      if (!this.#encerrado) this.#consumir()
```

```mutacao
arquivo: apps/api/src/worker.module.ts
teste: apps/api/src/ia/soberania-na-subida.int.test.ts › o ciclo desligado antes de a D62 ser conferida
-      if (conferida && !this.#encerrado) this.#consumir()
+      if (conferida) this.#consumir()
```

```mutacao
arquivo: apps/api/src/worker.module.ts
teste: apps/api/src/ia/soberania-na-subida.int.test.ts › o falso e o local consomem na hora
-      if (conferida && !this.#encerrado) this.#consumir()
+      if (!conferida && !this.#encerrado) this.#consumir()
```

```mutacao
arquivo: apps/api/src/ia/ia-do-worker.module.ts
teste: apps/api/test/architecture.test.ts › entrega a soberania, e há ao menos um
-            createLLMGateway(config, { registro: new ConsumoRepository(banco), orcamento, suspensao, soberania, logger, medidor: medidor ?? globalMeter() }),
+            createLLMGateway(config, { registro: new ConsumoRepository(banco), orcamento, suspensao, logger, medidor: medidor ?? globalMeter() }),
```

```mutacao
arquivo: packages/core/src/ia/tasks/turno-do-tutor.ts
teste: packages/core/src/ia/tasks/tarefas.test.ts › turno_do_tutor declara a função que gasta
-  categoriasEnviadas: ['conversa_do_aluno', 'material_da_escola', 'trabalho_do_aluno'],
+  categoriasEnviadas: ['conversa_do_aluno', 'material_da_escola'],
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/tarefas.test.ts › propor_ferramenta declara a função que gasta
-  categoriasEnviadas: ['conversa_do_aluno', 'conversa_do_professor', 'material_da_escola'],
+  categoriasEnviadas: ['conversa_do_professor', 'material_da_escola'],
```

```mutacao
arquivo: apps/api/src/app.module.ts
teste: apps/api/src/ia/soberania-na-subida.int.test.ts › provedor externo com o cadastro que não cobre a D62: a API responde 200 em /prontidao
-        { provide: GracefulShutdown, useValue: new GracefulShutdown(config.drenagem) },
+        { provide: GracefulShutdown, useValue: Object.assign(new GracefulShutdown(config.drenagem), config.ia.modelo?.processamentoLocal === false ? { prontidao: () => ({ status: 503, corpo: { pronta: false } }) } : {}) },
```

```mutacao
arquivo: apps/api/test/architecture.test.ts
teste: apps/api/test/architecture.test.ts › a varredura reprova a chamada sem a soberania
-      if (portas === null || !/\bsoberania\b/.test(portas[1] ?? '')) sem.push(arquivo.caminho)
+      if (portas !== null && !/\bsoberania\b/.test(portas[1] ?? '')) sem.push(arquivo.caminho)
```


## Recomendações sem aplicar

Da 1ª rodada (ordem `.processo/ordens/8_task-r1.md`, tabela "Sem aplicar"):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral 1ª | `soberania` obrigatória em `LLMGatewayDependencies` e `LLMGatewayPorts` | Recusada: muda o contrato público das duas interfaces. Sem a declaração o gateway já falha fechado, e a guarda de fiação cobra a chamada de produção. `TODO.md` |
| conformidade-reviewer 1ª | `docs/regulacao.md:233` dizer que a D62 é conferida no código | `TODO.md`: o arquivo não é da tarefa; vai com o dossiê (D61) |
| privacy-guardian, llm-integrator e revisor-geral 1ª | `medir-risco-a-vida.ts` aceitar só lote sintético, ou avisar | `TODO.md`: muda o comportamento da ferramenta; a decisão está escrita (D37, `techspec.md` §5) |
| privacy-guardian e conformidade-reviewer 1ª | reler o cadastro depois de conferida; aviso no `ops:suboperador encerrar` | Recusada a releitura (`techspec.md` §5, "A D62": reiniciar os `worker-ia`); o aviso e a avaliação do intervalo, em `TODO.md` e na retro |
| infra-guardian 1ª | contador `ia.soberania_recusada{tarefa}` | `TODO.md`: métrica nova pede alerta e runbook; RF9 e RF10 não a pedem |
| test-engineer 1ª | corrida contra um temporizador curto nas mutações de `aguardarConferida` | Recusada: o vermelho é pelo motivo certo, e só custa segundos |

Da 2ª rodada (todos aprovaram; `.processo/ordens/8_task-r2.md`):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian 2ª | Aceitar só lote sintético em `tools/ia/medir-risco-a-vida.ts` com `--provedor-contratado`, antes de alguém rodar a ferramenta contra provedor contratado | `TODO.md`, já registrado na 1ª ordem (linha `medir-risco-a-vida.ts`) |
| privacy-guardian 2ª | Aviso de reinício em `ops:suboperador encerrar` | `TODO.md`, já registrado (linha `ops:suboperador encerrar`) |
| conformidade-reviewer 2ª | A 9.0 deve ter um caso com o `worker-ia` parado pela D62: a pergunta é cortada pelo `GET` da execução e `IA_INDISPONIVEL` está em `PASSAGEIROS`, para o contador "perguntas que o Tutor não respondeu hoje" cobrir também esse cenário | Tarefa 9.0 (`tasks/prd-reengenharia-continuacao/9_task.md`): é onde o professor passa a ver essas perguntas |
| conformidade-reviewer 2ª | Runbook "A D62 na subida": dizer que, até a 9.0 pousar, o professor não vê essas perguntas | Tarefa 9.0: o texto muda quando o contador existir; a AIA, item 16, já diz a lacuna |
| conformidade-reviewer 2ª | `docs/regulacao.md:233`: dizer que a D62 é conferida no código | `TODO.md`, já registrado (linha `docs/regulacao.md:233`) |
| infra-guardian 2ª | `soberania-na-subida.int.test.ts`: o caso "sem suboperador nenhum, ou com o banco fora" junta dois cenários num `it` | `TODO.md`: legibilidade do teste; os dois cenários são provados e as mutações caem neles |
| infra-guardian 2ª | Os cinco itens do `TODO.md` da 1ª rodada seguem valendo (contador `ia.soberania_recusada`, aviso no `ops:suboperador encerrar`, `soberania` obrigatória, lote sintético, `docs/regulacao.md`) | `TODO.md`, já registrados |
| llm-integrator 2ª | Confirmar que nenhum `depends_on: service_healthy` do deploy prende a subida a um `worker-ia` esperando a D62 | Recusada: o `infra-guardian` conferiu na 2ª rodada que nenhum serviço de `infra/compose.yml` depende de o `worker-ia` estar `healthy` |
| llm-integrator 2ª | Manter no `TODO.md` os cinco itens abertos | `TODO.md`, já registrados |
| tenancy-guardian 2ª, revisor-geral 2ª | `suboperador-da-escola.repository.ts:46`: o parágrafo do docblock começa com `* * Tem **dois** métodos`; sobra o segundo `*` e falta a linha em branco | `TODO.md`: comentário de formato, sem efeito no código; corrigir junto da próxima tarefa que toca o arquivo (corrigi-lo agora caduca o `revisor-geral` outra vez) |
| revisor-geral 2ª | `8_task.md`, Autoconferência 4, ainda cita dois casos de API removidos ("prova o 200 antes de cada recusa", "corrigido o cadastro… confere o 503 antes do 200"); o controle hoje é o caso do worker "corrigido o cadastro, passa a consumir sozinho" | Texto do documento da tarefa: avisar o Validador (a Autoconferência não é critério de aceite); `TODO.md` não, porque o documento fecha com a funcionalidade |
| revisor-geral 2ª | `8_task.md`, bloco de mutação de `app.module.ts`: não segue a forma "tira uma cláusula"; vale uma linha dizendo que prova uma ausência | Texto do documento da tarefa: o bloco roda e cai no caso certo (test-engineer 2ª conferiu); avisar o Validador |
| test-engineer 2ª | `8_task.md`, linha "recusa por campo": cita o caso `soberania.test.ts` › "um campo errado, …, é o único motivo", que não existe; o nome é "cada campo errado ao mesmo tempo aparece, e nenhum esconde o outro" (`soberania.test.ts:49`) | Texto do documento da tarefa: citação herdada da 1ª rodada, caso certo existe; avisar o Validador |
| test-engineer 2ª | Três casos esperam com relógio real de 500 ms a 1,5 s para provar que algo não acontece (`soberania-na-subida.int.test.ts:309`, `:322`, `:330`); esperar um sinal em vez de um tempo | `TODO.md`: com o código certo passam; a fraqueza é a mutação não ser pega com a máquina carregada |
| test-engineer 2ª | Opcional: um caso da API que prove, pela estrutura, que a `SoberaniaNaSubida` não está montada na API (`app.get(SoberaniaNaSubida, { strict: false })` lança) | Recusada: opcional, e o 200 da API com provedor externo e cadastro ruim já prova a regra do RF9; a mutação da prontidão cai nesse caso |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-16 09:48:09 | 2026-11-16 09:48:56 | `conformidade-reviewer` | 1 | APROVADO | ab3da11aa77212df7 |
| 2026-11-16 09:48:26 | 2026-11-16 09:49:03 | `tenancy-guardian` | 1 | APROVADO | ae989eb3d7ffc2508 |
| 2026-11-16 09:48:13 | 2026-11-16 09:49:36 | `llm-integrator` | 1 | APROVADO | a3e87ac465de70b8a |
| 2026-11-16 09:48:01 | 2026-11-16 09:49:44 | `privacy-guardian` | 1 | APROVADO | a74efa9019fc7b83d |
| 2026-11-16 09:48:22 | 2026-11-16 09:50:14 | `revisor-geral` | 1 | APROVADO | a8bc2af1990c0b4a5 |
| 2026-11-16 09:48:05 | 2026-11-16 09:50:30 | `infra-guardian` | 1 | REPROVADO | a692ae0934e0e967e |
| 2026-11-16 09:48:17 | 2026-11-16 09:50:57 | `test-engineer` | 1 | APROVADO | ad4b13ab4a46c71b9 |
| 2026-11-16 14:50:39 | 2026-11-16 14:51:21 | `privacy-guardian` | 2 | APROVADO | ad2778db69a9b4ea6 |
| 2026-11-16 14:50:47 | 2026-11-16 14:51:27 | `conformidade-reviewer` | 2 | APROVADO | a2df49fc95b799307 |
| 2026-11-16 14:50:32 | 2026-11-16 14:51:33 | `infra-guardian` | 2 | APROVADO | aafe14a494d0b7807 |
| 2026-11-16 14:50:54 | 2026-11-16 14:51:33 | `llm-integrator` | 2 | APROVADO | a53971fb76d557e68 |
| 2026-11-16 14:51:16 | 2026-11-16 14:51:41 | `tenancy-guardian` | 2 | APROVADO | a491931e40a117d01 |
| 2026-11-16 14:51:09 | 2026-11-16 14:51:51 | `revisor-geral` | 2 | APROVADO | a16935cfb01d9ea8e |
| 2026-11-16 14:51:02 | 2026-11-16 14:52:57 | `test-engineer` | 2 | APROVADO | aae768ca69bfd70ad |
