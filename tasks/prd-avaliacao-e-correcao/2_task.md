# Tarefa 2.0 — Pulso da API, indisponibilidade, `limiteDaTentativa` e o 503 das rotas de prova

**Funcionalidade:** avaliacao-e-correcao · **Depende de:** 1.0
**Subagentes obrigatórios:** `infra-guardian`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer` (os dois últimos pela conferência dos revisores: o expurgo de dado com retenção e o caminho da prova)
**Porte:** grande

## Objetivo

A API registra a própria queda e o limite de cada tentativa passa a contá-la: o tempo volta a quem estava em prova, e
a instância que não consegue pulsar recusa as rotas de prova em vez de cobrar tempo que não houve.

## Contexto necessário

- `techspec.md` §5.4, §5.7, §7c (alerta do pulso), §11 (desvio da regra 10), §13
- `prd.md` RF6
- `cenarios.md` §1 RF6 (as linhas do pulso, da lacuna e do 503), §2 (alerta do pulso), §3 (g)
- `revisao-spec.md` rodada 4 (rotas de prova, só HTTP pulsa, uma consulta, alerta por instância)
- `.claude/rules/80`; `apps/api/src/main.ts` (o `listen`)

## Subtarefas

- [x] 2.1 — `limiteDaTentativa` pura, em ponto fixo (§5.4)
- [x] 2.2 — O pulso (§5.7): uma instrução, conexão própria, tique e relógio injetáveis, antes do `listen`, só no HTTP
- [x] 2.3 — 503 nas rotas de prova de hoje (`prova`, PUT, envio); a 3.0 e a 8.0 a aplicam às novas
- [x] 2.4 — Pulso e indisponibilidades lidos numa consulta
- [x] 2.5 — Expurgo da indisponibilidade aos 13 meses (como `expurgar-acesso`); métrica, alerta, runbook, arquitetura
- [x] 2.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/shared/src/atividade/limite-da-tentativa.ts` | novo |
| `packages/shared/src/atividade/limite-da-tentativa.test.ts` | novo |
| `packages/shared/src/index.ts` | alterado |
| `apps/api/src/atividade/pulso/pulso.repository.ts` | novo |
| `apps/api/src/atividade/pulso/pulso.service.ts` | novo |
| `apps/api/src/atividade/pulso/rotas-de-prova.guard.ts` | novo |
| `apps/api/src/atividade/pulso/pulso.int.test.ts` | novo |
| `apps/api/src/atividade/atividade.module.ts` | alterado |
| `apps/api/src/atividade/minha-atividade/minha-atividade.controller.ts` | alterado |
| `apps/api/src/main.ts` | alterado |
| `infra/grafana/alertas/pulso-da-api-parado.yaml` | novo |
| `docs/runbook.md` | alterado |
| `docs/arquitetura.md` | alterado |
| `apps/api/src/atividade/pulso/pulso.service.test.ts` | novo (o serviço sem banco: relógio, tique e repositório à mão) |
| `apps/api/src/app.module.ts` | alterado (`relogioDoPulso` e `tiqueDoPulso` só para o teste; `AtividadeModule.forRoot`) |
| `packages/core/src/retencao/expurgo-de-acesso.repository.ts`, `packages/core/src/index.ts`, `apps/worker/src/processors/expurgar-acesso.ts` | alterados (o alvo `indisponibilidade`, 13 meses, no expurgo de acesso) |
| `apps/worker/test/expurgo-de-acesso.int.test.ts` | alterado (os dois lados da fronteira de 13 meses, o lote ordenado, o `skip locked`, o log) |
| `packages/core/src/telemetry/metrics.ts`, `metrics.test.ts`, `tools/testes/metricas.ts` | alterados (`api.pulso.idade_s`) |
| `infra/grafana/paineis/fundacao.json` | alterado (o painel da métrica: o teste do painel exige um por métrica) |
| `infra/scripts/ensaio-alertas.ts`, `infra/test/alertas.test.ts`, `tools/guardas/alerta-tem-runbook.test.ts` | alterados (a regra nova nas três listas fechadas) |
| `docs/modelo-de-dados.md` | alterado (a retenção da indisponibilidade) |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| Indisponibilidade de 5 min dentro e fora da prova | unidade | só a sobreposição conta | uma dentro, uma fora | `packages/shared/src/atividade/limite-da-tentativa.test.ts › uma de 5 min dentro da prova anda o limite 5 min; uma de 5 min depois do fim da prova, nada`, `… › uma de 5 min antes da tentativa começar não conta; a que atravessa o começo conta só o pedaço de dentro` e `… › a que atravessa o fim conta o pedaço de dentro e, com o limite andado, o resto: a conta é de ponto fixo` |
| Duas indisponibilidades, a segunda dentro do limite já estendido | unidade | ponto fixo | a segunda fica fora numa passada só | `… › duas, a segunda dentro do limite já estendido pela primeira e fora do original: as duas contam, numa passada só` e `… › a ordem das indisponibilidades não muda o limite` |
| Lacuna aberta de 2 min e de 20 s | unidade | o limiar de 30 s | os dois lados | `… › pulso de 2 min atrás: o limite anda 2 min; de 20 s atrás, não anda`, `… › exatamente 30 s é atraso, não queda; 30 s e 1 ms já é` e `… › o limiar é de 30 s` |
| Extensão de aluno e de turma | unidade | as duas somam; a de outro aluno não | dois alunos | `… › a extensão do aluno e a da turma somam, e a de outro aluno não entra` e `… › soma com a extensão: a queda dentro do limite estendido conta, e a extensão não é comida pela queda` |
| Lacuna de 40 s grava; 20 s não; tabela vazia não | integração | o limiar no banco | três estados | `apps/api/src/atividade/pulso/pulso.int.test.ts › lacuna acima de 30 s grava uma indisponibilidade do último pulso até o novo; abaixo de 30 s, nenhuma, e o pulso anda do mesmo jeito` (20, 29, 31 e 40 s) e `… › tabela vazia: nenhuma indisponibilidade, e a linha única volta com o pulso de agora` |
| Pulso parado 40 min, volta | integração | grava 40, igual à lacuna aberta | sem teto em nenhuma | `… › parado 40 min e de volta: grava 40 min sem teto, e o limite da tentativa anda os mesmos 40 min com a lacuna aberta e com a fechada` e, em unidade, `limite-da-tentativa.test.ts › o pulso de 40 min parado dá o mesmo que a indisponibilidade fechada de 40 min que o pulso gravaria ao voltar (sem teto em nenhuma)` |
| Falha forçada depois do `update` | integração | nada grava; aparece no próximo | commits separados ficam vermelhos | `… › falha forçada depois do `update`: nada grava, nem o pulso, e a lacuna aparece inteira no pulso seguinte` (o gatilho recusa o `insert`, e uma sequência conta uma tentativa só) |
| `pg_terminate_backend` na conexão do pulso | integração | o tique seguinte reconecta, sem indisponibilidade | tique injetado | `… › conexão do pulso derrubada com `pg_terminate_backend`: o pulso seguinte reconecta, numa conexão nova, sem indisponibilidade` e `pulso.service.test.ts` (o tique que falha não derruba o tique, o `start` duas vezes, um pulso por vez) |
| Relógio injetado +31 s; +29 s | integração | 503 em `prova`, PUT e envio, só a partir de 30 s; `minhas-atividades` segue; o tique volta e aceitam | os dois lados | `… › +29 s e +30 s aceitam `prova`, PUT e envio; +31 s recusa as três com 503, antes de ler e de gravar, e `minhas-atividades` segue; o tique volta e as três aceitam`, `… › o pulso que falha não conta como feito…` e `… › antes de o pulso ser iniciado a instância não mede nada…` |
| Primeiro pulso antes do `listen` | integração | sem tráfego antes | primeiro pulso segurado (`WriteBlockTrigger` em `pulso_da_api`): a porta só aceita depois de soltar | `… › com o primeiro pulso segurado no banco, a porta não abre; solto o pulso, ela abre`, `… › o `main.ts` abre a porta pelo `ouvirDepoisDoPrimeiroPulso`, e não pelo `listen` direto` e `pulso.service.test.ts › `ouvirDepoisDoPrimeiroPulso`: o primeiro pulso vem antes da porta, e a falha dele impede a porta` |
| Corrida (g) pulso × pulso | integração | uma lacuna só | a primeira segurada no insert da indisponibilidade; partida com 40 s | `… › as duas instâncias com a lacuna de 40 s à frente: a primeira, segurada no `insert` da indisponibilidade, grava a lacuna; a segunda lê o pulso novo e não grava outra` |
| Expurgo da indisponibilidade | integração | sai aos 13 meses; a de 12 fica | os dois lados da fronteira | `apps/worker/test/expurgo-de-acesso.int.test.ts › borda: nos limites de cada prazo…` (12 meses, 13 meses menos um dia e menos uma hora ficam; 13 meses mais uma hora e um dia, e 14 meses saem), `… › lote ordenado e skip locked (avaliacao-e-correcao, 2.0)…` e `… › log: cada contagem da linha acesso.expurgado é a da sua tabela, nunca a de outra` |
| Regra do alerta | unidade | dispara com pulso de 2 min, por instância | a outra instância pulsando | `infra/test/alertas.test.ts › são as das Tech Specs, com o `for:` e o limiar declarados…` (a expressão é `max by (instance) (api_pulso_idade_s{job="educa/api"}) >= 120`, sem soma nem média entre instâncias, `for: 1m`, `noDataState: OK`), `infra/test/painel.test.ts › toda métrica do código tem painel…` e `tools/guardas/alerta-tem-runbook.test.ts` (a entrada "Pulso da API parado" do runbook, com os seis campos) |
| A métrica `api.pulso.idade_s` | unidade | lê a idade no momento da coleta, sem rótulo; sem pulso, sem série | antes e depois do primeiro pulso | `packages/core/src/telemetry/metrics.test.ts › lê a idade do pulso no momento da coleta, sem rótulo; sem pulso ainda, a série não existe` |
| A leitura numa consulta | integração | o pulso e as indisponibilidades vêm numa instrução; só as que terminam depois de `desde` entram; sem nenhuma a lista vem vazia | `desde` de uma hora e do futuro | `pulso.int.test.ts › numa consulta só…` e `… › só entram as que terminam depois de `desde`…` |

## Como testar

- Sem precedente de pulso. Relógio injetado: `apps/worker/test/varrer-envios.int.test.ts › com 59 min a linha e o objeto
  ficam, com 61 min saem: a linha e a varredura leem o mesmo Clock`
- Corrida: `WriteBlockTrigger` e `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`)
- Alerta: siga o formato de `infra/grafana/alertas/ia-provedor-de-reserva.yaml`
- `npx vitest run --project integracao apps/api/src/atividade/pulso/pulso.int.test.ts`; unidade com
  `npx vitest run packages/shared/src/atividade/limite-da-tentativa.test.ts`
- Armadilha: o teste não dorme; o tique e o relógio da recusa são injetados

## Autoconferência

As perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas antes de codar e conferidas depois. A 4: a instância de teste pulsa no `beforeAll`,
para o 503 não responder antes da regra.

1. **A mutação de cada cláusula** está na seção "Mutações": um bloco por cláusula de `limiteDaTentativa` (o limite base nulo, os dois termos do filtro da extensão, o `* MS_POR_MINUTO`, a soma da extensão, a lacuna aberta e os dois termos do limiar, o `<=`, o ponto fixo, os três termos da sobreposição, o `inicio` e o `limite` da sobreposição), do repository do pulso (a conexão retida, o `release` com erro, a tabela vazia, a falha que não é de conexão, a leitura sem pulso, o `leftJoin` com `desde`, a lista sem a linha de nulos e cada pedaço da instrução SQL: o `for update`, o `>` do limiar, o `anterior`, o limiar em segundos, o `update` e a contagem de pulsos), do serviço (um pulso por vez, o `start` duas vezes, a idade, o `<=` de 30 s, o último sucesso, o `armado`, o resumo do erro, o intervalo de 10 s, o desligamento, o primeiro pulso antes da porta), da guarda, dos três `@UseGuards`, das quatro linhas de injeção do relógio e do tique, do `main.ts`, da métrica e do expurgo (o `fim <`, o `order by`, o `limit`, o `skip locked`, os 13 meses nos dois lados, o alvo, o total e o log). O que não tem bloco tem o motivo em prosa na mesma seção.
2. **O texto na tela:** a tarefa não tem tela e nenhum texto novo vai para `apps/web`. O código de erro `INDISPONIVEL_TENTE_DE_NOVO` já existe em `packages/shared` desde a 1.0, e a tela o usa na 10.0.
3. **O segundo dado de cada cláusula:** a lacuna de 20 s e a de 29 s (que não gravam) ao lado das de 31 s e 40 s; a tabela vazia ao lado da tabela com linha; o pulso de 30 s exatos (que aceita) ao lado de 30 s e 1 ms (que recusa); a indisponibilidade de 125 min atrás (fora da leitura de uma hora) ao lado da de 35 min; a extensão do aluno ao lado da da turma e da de outro aluno; a de 13 meses menos uma hora ao lado da de 13 meses mais uma hora; a indisponibilidade presa por outra transação (o `skip locked`) ao lado da que o lote leva.
4. **A checagem anterior que responde antes:** o 503 vem da guarda do método, depois das guardas globais (sessão e permissão): o caso usa o aluno da turma certa, a atividade aplicada e a questão que existem, e o caso do `+31 s` espera `INDISPONIVEL_TENTE_DE_NOVO` e não `NAO_ENCONTRADO`; antes de `start` a instância não mede nada, e o `beforeAll` do caso do 503 chama `start`, de modo que o 503 não responde antes da regra; os demais testes de integração da API (que nunca chamam `start`) seguem aceitando a prova, e o caso `antes de o pulso ser iniciado…` prova isso com o relógio uma hora adiante.
5. **A asserção olha o resultado:** o caso do banco lê `indisponibilidade` e `pulso_da_api` depois da chamada (o início e o fim gravados, iguais ao `ultimo_em` de antes e de depois), e o caso do 503 lê `tentativa_atividade` e `resposta_atividade` depois da recusa (nada gravado).
6. **Guarda nova:** nenhuma regra de lint nem teste estrutural novo. As guardas existentes que a tarefa toca foram conferidas e ficaram verdes depois de ajustadas as listas fechadas: `tools/guardas/alerta-tem-runbook.test.ts` (o arquivo e o título), `infra/test/painel.test.ts` (o painel da métrica nova), `guardas/verbo-de-mercado` (o `start` e o `run`), `guardas/log-sem-dado-pessoal` (o `erro` do aviso é o `summarizeError`) e a complexidade de teste do lint.
7. **Comentário que afirma o que o código não faz:** o docblock do repository diz que a instrução é uma só e que a falha do `insert` desfaz o `update` (o caso da sequência prova uma tentativa, e o do `pulso` parado prova que nada gravou); diz que a conexão reconecta na própria chamada (o caso do `pg_terminate_backend`); o do serviço diz que antes de `start` a instância não recusa nada e que um pulso que falha não conta (os dois casos); o da guarda diz que só as rotas de prova recusam (o caso do 503 chama `minhas-atividades` com o pulso parado e recebe 200); o do alerta diz que não usa `absent()` (o teste da regra o proíbe).
8. **Divergências:** nenhuma da Tech Spec. A tarefa acrescenta arquivos que a lista de "Arquivos previstos" não tinha (a tabela acima os põe) porque o repository de expurgo, a métrica, o painel e as três listas fechadas do alerta os exigem; nenhuma regra do PRD muda.
9. **Peça que já existe:** `WriteBlockTrigger` e `esperarNaTrava` (as duas corridas), `ExpurgoDeAcessoRepository` com `APAGAR_LOTE` e o `skip locked` (o alvo novo é uma entrada), `Clock` e `systemClock`, `summarizeError`, `isConnectionError`, `@Unscoped`, `observeDatabasePool` (o molde da métrica observável), `ia-provedor-de-reserva.yaml` (o molde do alerta) e `DomainException` com `ErrorCode.INDISPONIVEL_TENTE_DE_NOVO`.
10. **A operação em duas chamadas ao mesmo tempo:** a corrida (g), com a primeira presa no `insert` da indisponibilidade e a segunda esperando no `for update` da linha do pulso, e a segunda lendo o `ultimo_em` que a primeira gravou (uma lacuna só); a corrida (l) (pulso × rotina, 6.0) é da 6.0, que lê o pulso na transação do job; aqui o pulso trava a linha única e nada mais.
11. **O isolamento quebra sem a cláusula:** as duas tabelas são globais, sem escola nem pessoa (exceção do item 1 de `docs/modelo-de-dados.md`, escrita na Tech Spec §11); nenhuma consulta recebe escola, e os dois repositories levam `@Unscoped` com a justificativa. O que impede o vazamento é o resultado (um instante e um intervalo, sem id de aluno), conferido em `leituraDesde` e nos testes da lista fechada de tabelas sem escola (`architecture.test.ts`, `prova-online.int.test.ts`).
12. **Os guardiões:** `infra-guardian` (a instrução única e a corrida, a conexão própria que reconecta, o 503 só nas rotas de prova, o primeiro pulso antes da porta, o alerta com runbook, o expurgo em lote com `skip locked`, o índice do `fim`) e `tenancy-guardian` (as duas tabelas globais e os `@Unscoped`, sem escola nem pessoa, 503 igual para todos). O alerta é conferido por texto (a expressão, o `for`, o `noDataState`) e não por uma instância parada de verdade: o ensaio com o Prometheus e o Grafana vivos é da esteira (D52), e a regra entrou na lista de `ensaio-alertas.ts`.

## Fora do escopo desta tarefa

As rotas novas do aluno (3.0); a rotina (6.0); o Tutor (7.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec |
|---|---|---|

## Mutações

Cada bloco aplica a mutação, roda o caso citado e exige vermelho. Os nomes de caso não levam parênteses (o `-t` do vitest é regex). Os casos do banco do pulso (`pulso.int.test.ts`) rodam sobre o banco compartilhado e o devolvem ao que era no `afterAll`.

**Sem bloco, com o motivo (cláusula equivalente ou coberta por outra peça):**

- Na linha `if (!this.#armado || this.#ultimoSucessoEm === undefined) return true`, **cada termo sozinho**, `!this.#armado` e `this.#ultimoSucessoEm === undefined`: `#armado` só vira verdadeiro em `start`, depois de `#pulsar()` ter gravado `#ultimoSucessoEm`, e `#ultimoSucessoEm` só passa a existir num pulso que deu certo, dentro de `start` ou do tique (que só existe depois de `start`). Os dois termos andam juntos, e tirar um deles não muda o que a função devolve. O bloco que tira a linha inteira prova o conjunto (a instância sem `start` aceita a prova, em `antes de start`).
- Na linha `indisponibilidades: linhas.flatMap(({ inicio, fim }) => (inicio === null || fim === null ? [] : [{ inicio, fim }])),`, **cada termo sozinho**, `inicio === null` e `fim === null`: o `leftJoin` devolve as duas colunas nulas juntas (as duas são `not null` na tabela), então um termo decide sozinho. O bloco que tira o ternário inteiro prova a cláusula (a leitura sem nenhuma depois de `desde` vem vazia, não com uma linha de nulos).
- `logger: opcoes.logger ?? createLogger({ servico: 'api' }),` em `app.module.ts` e em `atividade.module.ts`: é o recurso de produção quando ninguém injeta o logger (o `main.ts` e a bancada de teste injetam um), e o mesmo padrão já está na linha do `AssistenteModule`. A linha é contexto dos blocos do relógio; o que o logger recebe do pulso (o aviso `pulso.falhou`) é provado no `pulso.service.test.ts`, com o logger injetado no serviço.
- `AtividadeModule`, `providers: [RotasDeProvaGuard]`: tirá-lo derruba o boot da API (o Nest não resolve a guarda), que cai como erro de carga e o portão recusa; a presença da guarda em cada rota está nos três blocos do `@UseGuards`.
- `RECRIAR_A_LINHA`, o `on conflict do nothing`: protege duas instâncias que recriam a linha ao mesmo tempo depois de a tabela ter sido esvaziada; o caso pede dois pulsos na mesma fração de segundo sobre a tabela vazia, o que o teste não consegue forçar sem relógio no banco, e sem a cláusula o segundo `insert` é recusado pelo índice único `pulso_da_api_linha_unica` (1.0), que já tem o caso dele no schema; o pulso seguinte repete e grava. O bloco que tira a recriação (`rows[0]?.pulsos === 0`) prova a tabela vazia.
- `'api.pulso.idade_s'` em `METRICS` e o `idadeDoPulso: ['api_pulso_idade_s']` de `tools/testes/metricas.ts`: o nome que o Prometheus dá à métrica é conferido pelo `infra/test/painel.test.ts`, pelo `infra/test/alertas.test.ts` (a expressão do alerta) e pelo `infra/test/metricas.int.test.ts` da esteira (D52); trocar o texto do nome deixa o `painel.test.ts` vermelho (a lista fechada) mas não um caso de metrics.test, que lê o nome por `METRICS.idadeDoPulso`.
- O `@Unscoped` dos dois repositories do pulso e o texto da justificativa: o decorador é marca de revisão, conferida por `tools/guardas/repositories-com-escopo.test.ts` (que passa) e pelo `tenancy-guardian`; tirá-lo deixa a guarda vermelha, não um caso.

### O limite da tentativa (unidade)

```mutacao
arquivo: packages/shared/src/atividade/limite-da-tentativa.ts
teste: packages/shared/src/atividade/limite-da-tentativa.test.ts › sem extensão nem queda
-  if (pulso === null || pulso.agora.getTime() - pulso.ultimoEm.getTime() <= LIMIAR_DA_LACUNA_MS) return null
+  if (pulso.agora.getTime() - pulso.ultimoEm.getTime() <= LIMIAR_DA_LACUNA_MS) return null
```

```mutacao
arquivo: packages/shared/src/atividade/limite-da-tentativa.ts
teste: packages/shared/src/atividade/limite-da-tentativa.test.ts › exatamente 30 s é atraso
-  if (pulso === null || pulso.agora.getTime() - pulso.ultimoEm.getTime() <= LIMIAR_DA_LACUNA_MS) return null
+  if (pulso === null || pulso.agora.getTime() - pulso.ultimoEm.getTime() < LIMIAR_DA_LACUNA_MS) return null
```

```mutacao
arquivo: packages/shared/src/atividade/limite-da-tentativa.ts
teste: packages/shared/src/atividade/limite-da-tentativa.test.ts › pulso de 2 min atrás
-  if (pulso === null || pulso.agora.getTime() - pulso.ultimoEm.getTime() <= LIMIAR_DA_LACUNA_MS) return null
+  if (pulso === null) return null
```

```mutacao
arquivo: packages/shared/src/atividade/limite-da-tentativa.ts
teste: packages/shared/src/atividade/limite-da-tentativa.test.ts › pulso de 2 min atrás
-  return { inicio: pulso.ultimoEm, fim: pulso.agora }
+  return { inicio: pulso.agora, fim: pulso.ultimoEm }
```

```mutacao
arquivo: packages/shared/src/atividade/limite-da-tentativa.ts
teste: packages/shared/src/atividade/limite-da-tentativa.test.ts › sem duração nem janela
-  if (entrada.limiteBase === null) return null
```

```mutacao
arquivo: packages/shared/src/atividade/limite-da-tentativa.ts
teste: packages/shared/src/atividade/limite-da-tentativa.test.ts › a extensão do aluno e a da turma somam
-    .filter((extensao) => extensao.alunoId === null || extensao.alunoId === entrada.alunoId)
+    .filter((extensao) => extensao.alunoId === entrada.alunoId)
```

```mutacao
arquivo: packages/shared/src/atividade/limite-da-tentativa.ts
teste: packages/shared/src/atividade/limite-da-tentativa.test.ts › a extensão do aluno e a da turma somam
-    .filter((extensao) => extensao.alunoId === null || extensao.alunoId === entrada.alunoId)
+    .filter((extensao) => extensao.alunoId === null)
```

```mutacao
arquivo: packages/shared/src/atividade/limite-da-tentativa.ts
teste: packages/shared/src/atividade/limite-da-tentativa.test.ts › a extensão do aluno e a da turma somam
-    .filter((extensao) => extensao.alunoId === null || extensao.alunoId === entrada.alunoId)
+    .filter(() => true)
```

```mutacao
arquivo: packages/shared/src/atividade/limite-da-tentativa.ts
teste: packages/shared/src/atividade/limite-da-tentativa.test.ts › a extensão do aluno e a da turma somam
-    .reduce((soma, extensao) => soma + extensao.minutos * MS_POR_MINUTO, 0)
+    .reduce((soma, extensao) => soma + extensao.minutos * 1000, 0)
```

```mutacao
arquivo: packages/shared/src/atividade/limite-da-tentativa.ts
teste: packages/shared/src/atividade/limite-da-tentativa.test.ts › a extensão do aluno e a da turma somam
-  const semQueda = entrada.limiteBase.getTime() + estendidoEm
+  const semQueda = entrada.limiteBase.getTime()
```

```mutacao
arquivo: packages/shared/src/atividade/limite-da-tentativa.ts
teste: packages/shared/src/atividade/limite-da-tentativa.test.ts › a extensão do aluno e a da turma somam
-const MS_POR_MINUTO = 60_000
+const MS_POR_MINUTO = 1_000
```

```mutacao
arquivo: packages/shared/src/atividade/limite-da-tentativa.ts
teste: packages/shared/src/atividade/limite-da-tentativa.test.ts › pulso de 2 min atrás
-  const quedas = aberta === null ? entrada.indisponibilidades : [...entrada.indisponibilidades, aberta]
+  const quedas = entrada.indisponibilidades
```

```mutacao
arquivo: packages/shared/src/atividade/limite-da-tentativa.ts
teste: packages/shared/src/atividade/limite-da-tentativa.test.ts › a aberta soma com as fechadas
-  const quedas = aberta === null ? entrada.indisponibilidades : [...entrada.indisponibilidades, aberta]
+  const quedas = aberta === null ? entrada.indisponibilidades : [aberta]
```

```mutacao
arquivo: packages/shared/src/atividade/limite-da-tentativa.ts
teste: packages/shared/src/atividade/limite-da-tentativa.test.ts › duas, a segunda dentro do limite
-    if (proximo === limite) return new Date(limite)
+    return new Date(proximo)
```

```mutacao
arquivo: packages/shared/src/atividade/limite-da-tentativa.ts
teste: packages/shared/src/atividade/limite-da-tentativa.test.ts › uma de 5 min dentro da prova
-  return Math.max(0, Math.min(intervalo.fim.getTime(), ate) - Math.max(intervalo.inicio.getTime(), de))
+  return Math.max(1_000, Math.min(intervalo.fim.getTime(), ate) - Math.max(intervalo.inicio.getTime(), de))
```

```mutacao
arquivo: packages/shared/src/atividade/limite-da-tentativa.ts
teste: packages/shared/src/atividade/limite-da-tentativa.test.ts › antes da tentativa começar
-  return Math.max(0, Math.min(intervalo.fim.getTime(), ate) - Math.max(intervalo.inicio.getTime(), de))
+  return Math.max(0, Math.min(intervalo.fim.getTime(), ate) - intervalo.inicio.getTime())
```

```mutacao
arquivo: packages/shared/src/atividade/limite-da-tentativa.ts
teste: packages/shared/src/atividade/limite-da-tentativa.test.ts › uma de 5 min dentro da prova
-  return Math.max(0, Math.min(intervalo.fim.getTime(), ate) - Math.max(intervalo.inicio.getTime(), de))
+  return Math.max(0, intervalo.fim.getTime() - Math.max(intervalo.inicio.getTime(), de))
```

```mutacao
arquivo: packages/shared/src/atividade/limite-da-tentativa.ts
teste: packages/shared/src/atividade/limite-da-tentativa.test.ts › antes da tentativa começar
-    const proximo = semQueda + quedas.reduce((soma, queda) => soma + sobreposicao(queda, inicio, limite), 0)
+    const proximo = semQueda + quedas.reduce((soma, queda) => soma + sobreposicao(queda, 0, limite), 0)
```

```mutacao
arquivo: packages/shared/src/atividade/limite-da-tentativa.ts
teste: packages/shared/src/atividade/limite-da-tentativa.test.ts › atravessa o fim
-    const proximo = semQueda + quedas.reduce((soma, queda) => soma + sobreposicao(queda, inicio, limite), 0)
+    const proximo = semQueda + quedas.reduce((soma, queda) => soma + sobreposicao(queda, inicio, semQueda), 0)
```

```mutacao
arquivo: packages/shared/src/atividade/limite-da-tentativa.ts
teste: packages/shared/src/atividade/limite-da-tentativa.test.ts › exatamente 30 s é atraso
-export const LIMIAR_DA_LACUNA_MS = 30_000
+export const LIMIAR_DA_LACUNA_MS = 31_000
```

```mutacao
arquivo: packages/shared/src/atividade/limite-da-tentativa.ts
teste: packages/shared/src/atividade/limite-da-tentativa.test.ts › exatamente 30 s é atraso
-export const LIMIAR_DA_LACUNA_MS = 30_000
+export const LIMIAR_DA_LACUNA_MS = 29_000
```

### O repository do pulso (integração, com o banco real)

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.repository.ts
teste: apps/api/src/atividade/pulso/pulso.int.test.ts › conexão do pulso derrubada
-    if (this.#conexao !== undefined) return this.#conexao
```

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.repository.ts
teste: apps/api/src/atividade/pulso/pulso.int.test.ts › erro de conexão: a conexão que falhou
-    conexao?.release(true)
+    conexao?.release()
```

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.repository.ts
teste: apps/api/src/atividade/pulso/pulso.int.test.ts › `encerrar` devolve a conexão retida
-    conexao?.release()
```

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.repository.ts
teste: apps/api/src/atividade/pulso/pulso.int.test.ts › tabela vazia
-    if (rows[0]?.pulsos === 0) await conexao.query(RECRIAR_A_LINHA)
```

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.repository.ts
teste: apps/api/src/atividade/pulso/pulso.int.test.ts › falha forçada depois
-      if (!isConnectionError(erro)) throw erro
```

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.repository.ts
teste: apps/api/src/atividade/pulso/pulso.int.test.ts › conexão do pulso derrubada
-      if (!isConnectionError(erro)) throw erro
+      if (isConnectionError(erro)) throw erro
```

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.repository.ts
teste: apps/api/src/atividade/pulso/pulso.int.test.ts › tabela vazia
-      pulso: primeira === undefined ? null : { ultimoEm: primeira.ultimoEm, agora: primeira.agora },
+      pulso: { ultimoEm: primeira.ultimoEm, agora: primeira.agora },
```

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.repository.ts
teste: apps/api/src/atividade/pulso/pulso.int.test.ts › só entram as que terminam
-      indisponibilidades: linhas.flatMap(({ inicio, fim }) => (inicio === null || fim === null ? [] : [{ inicio, fim }])),
+      indisponibilidades: linhas.flatMap(({ inicio, fim }) => [{ inicio, fim }] as IntervaloDeIndisponibilidade[]),
```

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.repository.ts
teste: apps/api/src/atividade/pulso/pulso.int.test.ts › só entram as que terminam
-      .leftJoin(indisponibilidade, gt(indisponibilidade.fim, desde))
+      .leftJoin(indisponibilidade, gt(indisponibilidade.fim, new Date(0)))
```

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.repository.ts
teste: apps/api/src/atividade/pulso/pulso.int.test.ts › as duas instâncias com a lacuna de 40 s
-  with antes as (select ultimo_em from pulso_da_api for update),
+  with antes as (select ultimo_em from pulso_da_api),
```

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.repository.ts
teste: apps/api/src/atividade/pulso/pulso.int.test.ts › lacuna acima de 30 s
-    select anterior, atual from novo where atual - anterior > make_interval(secs => $1::double precision)
+    select anterior, atual from novo where atual - anterior < make_interval(secs => $1::double precision)
```

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.repository.ts
teste: apps/api/src/atividade/pulso/pulso.int.test.ts › lacuna acima de 30 s
-    select anterior, atual from novo where atual - anterior > make_interval(secs => $1::double precision)
+    select atual - interval '1 second', atual from novo where atual - anterior > make_interval(secs => $1::double precision)
```

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.repository.ts
teste: apps/api/src/atividade/pulso/pulso.int.test.ts › lacuna acima de 30 s
-    const { rows } = await conexao.query<{ pulsos: number }>(PULSAR, [LIMIAR_DA_LACUNA_MS / 1000])
+    const { rows } = await conexao.query<{ pulsos: number }>(PULSAR, [LIMIAR_DA_LACUNA_MS / 10_000])
```

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.repository.ts
teste: apps/api/src/atividade/pulso/pulso.int.test.ts › lacuna acima de 30 s
-    const { rows } = await conexao.query<{ pulsos: number }>(PULSAR, [LIMIAR_DA_LACUNA_MS / 1000])
+    const { rows } = await conexao.query<{ pulsos: number }>(PULSAR, [LIMIAR_DA_LACUNA_MS])
```

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.repository.ts
teste: apps/api/src/atividade/pulso/pulso.int.test.ts › lacuna acima de 30 s
-    update pulso_da_api set ultimo_em = now() from antes
+    update pulso_da_api set ultimo_em = pulso_da_api.ultimo_em from antes
```

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.repository.ts
teste: apps/api/src/atividade/pulso/pulso.int.test.ts › tabela vazia
-  select (select count(*)::int from novo) as pulsos, (select count(*)::int from lacunas) as lacunas
+  select 1 as pulsos, (select count(*)::int from lacunas) as lacunas
```

### O serviço do pulso (unidade, sem banco)

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.service.ts
teste: apps/api/src/atividade/pulso/pulso.service.test.ts › um pulso por vez
-    if (this.#emAndamento) return
```

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.service.ts
teste: apps/api/src/atividade/pulso/pulso.service.test.ts › um pulso por vez
-      this.#emAndamento = false
```

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.service.ts
teste: apps/api/src/atividade/pulso/pulso.service.test.ts › duas vezes liga um tique
-    if (this.#armado) return
```

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.service.ts
teste: apps/api/src/atividade/pulso/pulso.service.test.ts › antes de `start`
-    if (!this.#armado || this.#ultimoSucessoEm === undefined) return true
```

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.service.ts
teste: apps/api/src/atividade/pulso/pulso.service.test.ts › antes de `start`
-    if (this.#ultimoSucessoEm === undefined) return undefined
```

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.service.ts
teste: apps/api/src/atividade/pulso/pulso.service.test.ts › aceita a prova até 30 s
-    return this.#relogio.agora().getTime() - this.#ultimoSucessoEm.getTime() <= LIMIAR_DA_LACUNA_MS
+    return this.#relogio.agora().getTime() - this.#ultimoSucessoEm.getTime() < LIMIAR_DA_LACUNA_MS
```

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.service.ts
teste: apps/api/src/atividade/pulso/pulso.service.test.ts › o tique que pulsa zera a idade
-    this.#ultimoSucessoEm = this.#relogio.agora()
```

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.service.ts
teste: apps/api/src/atividade/pulso/pulso.service.test.ts › aceita a prova até 30 s
-    this.#armado = true
```

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.service.ts
teste: apps/api/src/atividade/pulso/pulso.service.test.ts › o primeiro pulso é esperado
-    if (this.#armado) return
-    await this.#pulsar()
+    if (this.#armado) return
+    await this.#pulsar().catch(() => undefined)
```

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.service.ts
teste: apps/api/src/atividade/pulso/pulso.service.test.ts › avisa só com o resumo do erro
-      this.#logger.warn({ evento: 'pulso.falhou', erro: summarizeError(erro) })
+      this.#logger.warn({ evento: 'pulso.falhou', erro })
```

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.service.ts
teste: apps/api/src/atividade/pulso/pulso.service.test.ts › o pulso é de 10 s
-export const INTERVALO_DO_PULSO_MS = 10_000
+export const INTERVALO_DO_PULSO_MS = 1_000
```

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.service.ts
teste: apps/api/src/atividade/pulso/pulso.service.test.ts › ao desligar, o tique para
-    this.#desligarTique?.()
```

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.service.ts
teste: apps/api/src/atividade/pulso/pulso.service.test.ts › ao desligar, o tique para
-    await this.#repositorio.encerrar()
```

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.service.ts
teste: apps/api/src/atividade/pulso/pulso.service.test.ts › o primeiro pulso vem antes da porta
-  await app.get(PulsoService).start()
```

```mutacao
arquivo: apps/api/src/atividade/pulso/pulso.service.ts
teste: apps/api/src/atividade/pulso/pulso.service.test.ts › o primeiro pulso vem antes da porta
-  await app.get(PulsoService).start()
-  await app.listen(porta, endereco)
+  await app.listen(porta, endereco)
+  await app.get(PulsoService).start()
```

### A guarda, as três rotas e a fiação (integração, o 503)

```mutacao
arquivo: apps/api/src/atividade/pulso/rotas-de-prova.guard.ts
teste: apps/api/src/atividade/pulso/pulso.int.test.ts › recusa as três com 503
-    if (!this.pulso.aceitaProva()) throw new DomainException(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.controller.ts
teste: apps/api/src/atividade/pulso/pulso.int.test.ts › recusa as três com 503
-  @Get('atividades-aplicadas/:id/prova')
-  @UseGuards(RotasDeProvaGuard)
+  @Get('atividades-aplicadas/:id/prova')
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.controller.ts
teste: apps/api/src/atividade/pulso/pulso.int.test.ts › recusa as três com 503
-  @Put('atividades-aplicadas/:id/respostas/:questao')
-  @UseGuards(RotasDeProvaGuard)
+  @Put('atividades-aplicadas/:id/respostas/:questao')
```

```mutacao
arquivo: apps/api/src/atividade/minha-atividade/minha-atividade.controller.ts
teste: apps/api/src/atividade/pulso/pulso.int.test.ts › recusa as três com 503
-  @Post('atividades-aplicadas/:id/enviar')
-  @UseGuards(RotasDeProvaGuard)
+  @Post('atividades-aplicadas/:id/enviar')
```

```mutacao
arquivo: apps/api/src/app.module.ts
teste: apps/api/src/atividade/pulso/pulso.int.test.ts › recusa as três com 503
-          logger: opcoes.logger ?? createLogger({ servico: 'api' }),
-          ...(opcoes.relogioDoPulso === undefined ? {} : { relogioDoPulso: opcoes.relogioDoPulso }),
+          logger: opcoes.logger ?? createLogger({ servico: 'api' }),
```

```mutacao
arquivo: apps/api/src/app.module.ts
teste: apps/api/src/atividade/pulso/pulso.int.test.ts › recusa as três com 503
-          ...(opcoes.tiqueDoPulso === undefined ? {} : { tiqueDoPulso: opcoes.tiqueDoPulso }),
```

```mutacao
arquivo: apps/api/src/atividade/atividade.module.ts
teste: apps/api/src/atividade/pulso/pulso.int.test.ts › recusa as três com 503
-              logger: opcoes.logger ?? createLogger({ servico: 'api' }),
-              ...(opcoes.relogioDoPulso === undefined ? {} : { relogio: opcoes.relogioDoPulso }),
+              logger: opcoes.logger ?? createLogger({ servico: 'api' }),
```

```mutacao
arquivo: apps/api/src/atividade/atividade.module.ts
teste: apps/api/src/atividade/pulso/pulso.int.test.ts › recusa as três com 503
-              ...(opcoes.tiqueDoPulso === undefined ? {} : { tique: opcoes.tiqueDoPulso }),
```

```mutacao
arquivo: apps/api/src/main.ts
teste: apps/api/src/atividade/pulso/pulso.int.test.ts › abre a porta pelo
-await ouvirDepoisDoPrimeiroPulso(app, config.porta, '0.0.0.0')
+await app.listen(config.porta, '0.0.0.0')
```

```mutacao
arquivo: apps/api/src/main.ts
teste: apps/api/src/atividade/pulso/pulso.int.test.ts › abre a porta pelo
-observePulsoDaApi(medidor, () => app.get(PulsoService).idadeEmSegundos())
```

### A métrica e o expurgo

```mutacao
arquivo: packages/core/src/telemetry/metrics.ts
teste: packages/core/src/telemetry/metrics.test.ts › lê a idade do pulso
-    if (idade !== undefined) observador.observe(idade)
+    if (idade === undefined) observador.observe(idade as unknown as number)
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-de-acesso.repository.ts
teste: apps/worker/test/expurgo-de-acesso.int.test.ts › lote ordenado e skip locked
-      where fim < ${agora.toISOString()}::timestamptz - make_interval(months => ${RETENCAO_INDISPONIBILIDADE_MESES})
+      where fim > ${agora.toISOString()}::timestamptz - make_interval(months => ${RETENCAO_INDISPONIBILIDADE_MESES})
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-de-acesso.repository.ts
teste: apps/worker/test/expurgo-de-acesso.int.test.ts › lote ordenado e skip locked
-      order by fim
-      limit ${limite}
+      limit ${limite}
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-de-acesso.repository.ts
teste: apps/worker/test/expurgo-de-acesso.int.test.ts › lote ordenado e skip locked
-      order by fim
-      limit ${limite}
-      for update skip locked
+      order by fim
+      limit ${limite}
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-de-acesso.repository.ts
teste: apps/worker/test/expurgo-de-acesso.int.test.ts › lote ordenado e skip locked
-      order by fim
-      limit ${limite}
+      order by fim
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-de-acesso.repository.ts
teste: apps/worker/test/expurgo-de-acesso.int.test.ts › borda: nos limites de cada prazo
-export const RETENCAO_INDISPONIBILIDADE_MESES = 13
+export const RETENCAO_INDISPONIBILIDADE_MESES = 12
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-de-acesso.repository.ts
teste: apps/worker/test/expurgo-de-acesso.int.test.ts › borda: nos limites de cada prazo
-export const RETENCAO_INDISPONIBILIDADE_MESES = 13
+export const RETENCAO_INDISPONIBILIDADE_MESES = 14
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-de-acesso.repository.ts
teste: apps/worker/test/expurgo-de-acesso.int.test.ts › lotes: cada instrução apaga
-export const ALVOS_DO_EXPURGO_DE_ACESSO = ['registro_acesso', 'sessao', 'convite', 'link_da_conta', 'acesso_turma', 'importacao_planilha', 'acesso_operacao', 'sessao_operador', 'convite_operador', 'incidente', 'indisponibilidade'] as const
+export const ALVOS_DO_EXPURGO_DE_ACESSO = ['registro_acesso', 'sessao', 'convite', 'link_da_conta', 'acesso_turma', 'importacao_planilha', 'acesso_operacao', 'sessao_operador', 'convite_operador', 'incidente'] as const
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-de-acesso.repository.ts
teste: apps/worker/test/expurgo-de-acesso.int.test.ts › lote ordenado e skip locked
-    delete from indisponibilidade
+    update indisponibilidade set inicio = inicio
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-de-acesso.repository.ts
teste: apps/worker/test/expurgo-de-acesso.int.test.ts › lote ordenado e skip locked
-    where id = any(array(
-      select id from indisponibilidade
+    where id <> all(array(
+      select id from indisponibilidade
```

```mutacao
arquivo: packages/core/src/retencao/expurgo-de-acesso.repository.ts
teste: apps/worker/test/expurgo-de-acesso.int.test.ts › lote ordenado e skip locked
-      select id from indisponibilidade
-      where fim < ${agora.toISOString()}::timestamptz - make_interval(months => ${RETENCAO_INDISPONIBILIDADE_MESES})
+      select gen_random_uuid() from indisponibilidade
+      where fim < ${agora.toISOString()}::timestamptz - make_interval(months => ${RETENCAO_INDISPONIBILIDADE_MESES})
```

```mutacao
arquivo: apps/worker/src/processors/expurgar-acesso.ts
teste: apps/worker/test/expurgo-de-acesso.int.test.ts › borda: nos limites de cada prazo
-      indisponibilidade: await deleteAlvo('indisponibilidade'),
+      indisponibilidade: 0,
```

```mutacao
arquivo: apps/worker/src/processors/expurgar-acesso.ts
teste: apps/worker/test/expurgo-de-acesso.int.test.ts › log: cada contagem
-      indisponibilidadesTotal,
-      contasLimpasTotal,
+      contasLimpasTotal,
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| conformidade-reviewer (1ª, rec. 1) | A recusa é decidida por instância e a lacuna vem do pulso global: se a api-1 estiver presa enquanto a api-2 pulsa, o aluno que bate na api-1 recebe 503 e esse tempo não volta; "a Tech Spec deveria registrar isso como decisão consciente" | `TODO.md`, para o Arquiteto: a Tech Spec é dele, e o runbook já trata o caso como risco aceito (a outra instância atende) |
| conformidade-reviewer (1ª, rec. 3) | A auditoria da rotina que encerra a prova vencida (6.0) confirma que encerrar não cria Nota nem aplica sozinha consequência sobre o aluno | Tarefa 6.0 (usa este limite); o revisor dela recebe a pergunta |
| privacy-guardian (1ª, rec. 2) | Caso que mostre o 503 igual para id inexistente e para id de outro aluno quando a 3.0 e a 8.0 levarem a guarda às rotas novas | Tarefas 3.0 e 8.0; o caso desta tarefa é o do item 3 da ordem, já no `+31 s` |
| revisor-geral (1ª, rec. 1) | Tech Spec §5.7 (`techspec.md:103`) ainda diz "recusa as rotas do aluno (503)", e a rodada 4 de `revisao-spec.md` mandou "rotas de prova" | `TODO.md`, para o Arquiteto: a Tech Spec não é arquivo do Implementador; o código segue a forma certa e a §13 e o `cenarios.md` já dizem "rotas de prova" |
| revisor-geral (1ª, rec. 3) | `beforeApplicationShutdown` devolve a conexão sem esperar o pulso em curso | `TODO.md` (processo e dívida): muda comportamento do serviço e pede teste e bloco de mutação novos; o efeito é só um `pulso.falhou` falso no log, no desligamento |
| revisor-geral (1ª, rec. 5) | Logger padrão `opcoes.logger ?? createLogger(...)` repetido em `app.module.ts` e `atividade.module.ts` | Recusada: o revisor tem razão de fato (o único `forRoot` de `AtividadeModule` é o do `AppModule`, e ele já passa o logger resolvido, `app.module.ts:126`), mas o padrão `opcoes.logger ?? createLogger({ servico: 'api' })` é o dos outros módulos (`ia.module.ts:51`, `app.module.ts:104, 114, 122, 141`), e tirá-lo torna `logger` obrigatório em `AtividadeModuleOpcoes`, que é contrato do módulo; a linha está na lista "Sem bloco, com o motivo" da seção "Mutações". Não é defeito, é repetição |
| infra-guardian (1ª, rec. 1) | O 503 sai sem `Retry-After` (sorteado, entre 2 e 6 s, como `hash-bulkhead.ts` e `challenge.ts`) | Tarefa 10.0 (o reenvio da tela): muda o contrato da resposta, que a Tech Spec §13 e o `cenarios.md` não trazem; a 10.0 decide junto com a fila de respostas |
| infra-guardian (1ª, rec. 2) | A prontidão da instância não depende do pulso: instância parada fica ~2,5 min na rotação | Retro da funcionalidade: o `revisor-geral` registra que ficou fora da rodada 4 da revisão da spec, e o runbook e o alerta já dizem que a prontidão não depende do pulso |
| infra-guardian (1ª, rec. 3) | Registrar a vaga do pool que a conexão do pulso ocupa em `docs/infra.md` ou no comentário de `BANCO_POOL_MAXIMO` (`infra/compose.yml`), para quem dimensionar o pool na rajada da N2 | `TODO.md`: os dois arquivos não são desta tarefa |
| infra-guardian (1ª, rec. 4) | O cenário de carga de prova online entra quando a 3.0 puser `leituraDesde` no PUT da resposta | Tarefa 3.0 |
| test-engineer (1ª, rec. 4) | O bloco "sem `order by`" do expurgo depende da ordem física das linhas; "fica registrado" | Sem ação: o próprio revisor só registra, e o caso insere as linhas fora de ordem |
| test-engineer (1ª, rec. 5) | O bloco "sem `skip locked`" fica vermelho por espera; um `lock_timeout` curto daria vermelho rápido | `TODO.md`: o bloco fica vermelho no caso citado, e mudar a mecânica do teste de corrida do expurgo pede nova prova |
| revisor-geral (2ª), test-engineer (2ª) | No caso novo "`encerrar` devolve a conexão retida" (`apps/api/src/atividade/pulso/pulso.int.test.ts:164-172`) o pool criado não entra em `pools`: com a mutação aplicada, ou se o caso falhar, ninguém o encerra e a conexão fica pendurada até o worker do vitest cair. "Basta registrá-lo em `pools` e deixar o `afterEach` cuidar dele." | `TODO.md`: só afeta o caso quando ele já está vermelho, e aplicar agora caduca de novo as aprovações do `test-engineer` e do `revisor-geral` por uma linha de teste sem efeito sobre o que o caso prova |
| revisor-geral (2ª) | Em `pulso.service.test.ts:161`, `not.toHaveProperty('erro.message')` só cobre a chave `message`; uma lista positiva das chaves permitidas em `erro` (como `toEqual({ sqlstate: ... })`) provaria mais | `TODO.md`: a asserção atual já falha com o erro cru, que é o que o `test-engineer` pediu; a lista positiva endurece o teste contra outra chave que ninguém escreveu |
| test-engineer (2ª) | O caso do 503 para id de outra escola e para id inexistente não tem bloco de mutação (a guarda depois da leitura o deixaria vermelho: 404 no lugar do 503) | Tarefas 3.0 e 8.0, que levam a guarda às rotas novas; a tabela "Sem aplicar" do documento já as cita para o caso de id |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-23 21:36:53 | 2026-11-23 21:37:32 | `tenancy-guardian` | 1 | APROVADO | a617e5248d537cc67 |
| 2026-11-23 21:36:59 | 2026-11-23 21:37:38 | `conformidade-reviewer` | 1 | APROVADO | af04d85e976e5fc09 |
| 2026-11-23 21:36:56 | 2026-11-23 21:37:46 | `privacy-guardian` | 1 | APROVADO | ad6506d9ac10082a9 |
| 2026-11-23 21:37:04 | 2026-11-23 21:38:46 | `revisor-geral` | 1 | APROVADO | a17b9317998e029f2 |
| 2026-11-23 21:36:51 | 2026-11-23 21:38:54 | `infra-guardian` | 1 | APROVADO | afe47f9218ffec37d |
| 2026-11-23 21:37:02 | 2026-11-23 21:40:27 | `test-engineer` | 1 | REPROVADO | a7ea95a92343bd2a5 |
| 2026-11-23 22:05:48 | 2026-11-23 22:06:20 | `revisor-geral` | 2 | APROVADO | abf28063529163915 |
| 2026-11-23 22:05:40 | 2026-11-23 22:07:15 | `test-engineer` | 2 | APROVADO | a3c3e6499175849d9 |
