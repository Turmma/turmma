# Achados das revisões — `tasks/prd-reserva-e-avaliacao/1_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-22 13:13:30 · `tasks/prd-reserva-e-avaliacao/1_task.md`

**VEREDITO: APROVADO**

Esta tarefa monta a configuração do provedor de reserva: cada adaptador ganha uma identidade, entra a constante `MODELOS_APROVADOS` com a guarda que recalcula o sha256 do relatório, entra a função `reservaElegivel`, e a subida passa a recusar reserva mal configurada. Ela não toca em nota, entrega, tutor nem tela, e nenhuma chamada vai à reserva antes da 4.0. Os três arquivos de teste da regra passam: `modelos-aprovados.test.ts`, `soberania.test.ts` e `llm-config.test.ts`, com 117 testes.

```
VEREDITO: APROVADO
Caminhos de escrita em Nota: nenhum novo nesta tarefa (o diff não toca Nota, schema, job, seed, importação nem webhook) — todos com autor humano? sim (sem caminho novo)
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok — nenhum fluxo de saída de IA mudou. A reserva vai atender as mesmas tarefas de TAREFAS_DE_IA, e o que ela produzir passa pelos mesmos fluxos de entrega pendente. A exceção do tutor (D47) não se estendeu a outro agente.
Supervisão do tutor: ok — nada mudou. O Tutor (`turno_do_tutor`) só é elegível na reserva com uma entrada própria em MODELOS_APROVADOS para a tarefa, o provedor e o modelo do perfil dele (RF4). Se o Tutor estiver aprovado, o contrato da reserva também precisa cobrir a categoria conversa_do_aluno, senão a reserva sai de todas as tarefas (`soberania.ts` `categoriasDasTarefas`).
Autonomia declarada e visível: sim (sem mudança: nenhum agente novo nem nível novo)
Bloqueantes: nenhum
Recomendações:
- packages/core/src/ia/modelos-aprovados.ts:58 — a guarda só confere que `aprovadoPor` não está vazio. Recomendo que ela recuse `'sintetico'` em entrada que não seja de `falso-reserva` e confira o formato de `aprovadoEm` (`AAAA-MM-DD`). Assim a aprovação de modelo de verdade fica presa a uma pessoa (D37) por estrutura, e não por disciplina. Isso cabe quando entrar a primeira entrada real ou na 13.0.
- packages/core/src/ia/modelos-aprovados.ts:36 — em `local` e `staging`, a entrada sintética aprova todas as tarefas de TAREFAS_DE_IA para o falso, inclusive `turno_do_tutor` e `relatorio_da_correcao`. Isso é aceitável porque o falso é determinístico e não sai da máquina. Recomendo que a 4.0 ou a 7.0 tenham um caso de integração provando que a resposta do Tutor vinda da reserva continua aparecendo para o professor como as do principal (regra 70, item 4).
```

Itens da regra 70 que conferi no diff:
- **Discursiva e redação (D55):** nenhuma tarefa nova, nenhum prompt, campo ou tela; TAREFAS_DE_IA (`packages/shared/src/time/execucao.ts:26`) não mudou.
- **Supervisão não é vigilância:** nenhuma métrica nova sobre aluno. O rótulo `provedor` das medidas passou a vir da identidade do adaptador, e é dado de operação, não de pessoa.
- **Medir o professor (D45):** nada tocado.
- **Auditoria:** a linha de consumo continua gravando o `provedor`, nulo no falso. A coluna `pelo_provedor_de_reserva` ficou para a 4.0 e a 5.0, como diz a divergência registrada na tarefa. Ela importa para responder "que provedor gerou isto", e não muda quem aprovou nem quando.
- **Falso em produção:** é recusado em duas camadas. Na subida, por `llm-config.ts` (`MOTIVO_RESERVA_FALSA_EM_PRODUCAO` e a identidade `falso-reserva` sobre `openai_compat`). Na elegibilidade, por `modelos-aprovados.ts:90`. As duas recusas têm teste.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-22 13:13:40 · `tasks/prd-reserva-e-avaliacao/1_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A tarefa é só de configuração e de camada de IA. Não cria tabela, migration, query, endpoint, DTO nem log. O único dado sensível novo é um segredo de infraestrutura, `LLM_RESERVA_CHAVE_API`, e ele não é dado de titular.

Fora da tabela de dados do `docs/lgpd.md`: nada. Nenhum campo pessoal novo.

Autorização por objeto: não se aplica, porque a tarefa não cria rota nem repository.

Logs: limpos. O diff não acrescenta `logger` nem `console`. Os erros de subida (`InvalidConfigError`) citam o nome da variável, nunca o valor dela. O teste "a chave da reserva entra na configuração e nunca na mensagem de erro" (`packages/core/src/config/llm-config.test.ts:484-492`) usa um valor reconhecível e confere mensagem, motivos e variáveis, inclusive no caminho da identidade repetida.

Auditoria: a tarefa não toca nenhuma ação que exige auditoria. A aprovação de modelo fica em `MODELOS_APROVADOS`, com relatório, `sha256`, `aprovadoPor` e `aprovadoEm`, e é conferida por `problemasDosModelosAprovados`.

Envio externo: nenhum novo. Nenhuma chamada vai à reserva antes da 4.0. Quando houver envio, o rastro está garantido assim:
- Uma reserva `openai_compat` é sempre envio externo (`processamentoLocal: false`, `llm-config.ts:386-388`) e exige `IA_RESERVA_PROVEDOR_ID`. Esse id vira `envio.provedorId`, e portanto `consumo_ia.provedor`. A pergunta "para onde foi" continua com resposta.
- A reserva falsa grava `provedor` nulo porque nada sai, e o glossário registra isso.
- A reserva só é elegível com a D62 dela conferida. Se a conferência estiver ausente, ela é tratada como não conferida (falha fechada, `modelos-aprovados.ts:681-685`).
- O contrato da reserva precisa cobrir as categorias das tarefas aprovadas para ela. Se o Tutor estiver aprovado, a conversa do aluno precisa estar coberta (`soberania.ts`, `categoriasDasTarefas`).
- A reserva falsa é recusada em produção duas vezes: na subida (`IA_RESERVA_ADAPTADOR=falso` e `IA_RESERVA_PROVEDOR_ID=falso-reserva`) e na elegibilidade (`aprovadaParaAReserva`).
- O registro em `ExecucaoAgente` e a coluna `pelo_provedor_de_reserva` ficam para a 4.0 e a 5.0, como diz a divergência da tarefa. Isso está coerente, porque nenhuma chamada sai antes disso.

Seed/fixture: sintético.
- `docs/avaliacao/falso-reserva/relatorio.md` não tem dado de pessoa.
- Os testes usam `chave-sintetica-da-reserva`, `provedor-de-teste` e `provedor-x`.
- `infra/carga.env` só liga a reserva falsa.
- `.env.example` deixa a reserva comentada e manda não pôr a chave nele.

Pergunta de fechamento: o código continua respondendo. Toda chamada que sair para a reserva vai levar na linha de consumo a identidade do provedor que recebeu o conteúdo. Uma reserva externa sem `IA_RESERVA_PROVEDOR_ID` nem sobe (`llm-config.ts:167`).

Bloqueantes: nenhum.

Recomendações:
1. `packages/core/src/ia/modelos-aprovados.ts:618-637`: `problemasDosModelosAprovados` não confere `aprovadoEm`, nem se ele está no formato `AAAA-MM-DD`. Isso não é risco de privacidade, mas uma data em branco enfraquece a pergunta "quem aprovou e quando" no dossiê.
2. A 2.0 e a 4.0 precisam manter duas coisas: o `ExecucaoAgente` registrando a chamada que for à reserva, e o `consumo_ia.provedor` vindo de `envio.provedorId`, e não de `identidade`. No `openai_compat` local, `identidade` vale `openai_compat` e não é um provedor. Hoje o código já faz isso; vale um caso de teste próprio quando a reserva passar a atender chamadas.
3. Quando entrar a primeira reserva real em `MODELOS_APROVADOS`, a lista de suboperadores de `docs/lgpd.md` e a do dossiê precisam ser atualizadas na mesma tarefa.

Arquivos auditados:
- `packages/core/src/config/llm-config.ts`
- `packages/core/src/ia/modelos-aprovados.ts`
- `packages/core/src/ia/llm-gateway.ts`
- `packages/core/src/ia/soberania.ts`
- `docs/avaliacao/falso-reserva/relatorio.md`
- `.env.example`
- `infra/carga.env`

## revisor-geral · 1ª rodada · APROVADO · 2026-11-22 13:14:23 · `tasks/prd-reserva-e-avaliacao/1_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

**O que conferi**
- **Escopo.** As seis subtarefas estão feitas, e nenhuma chamada vai à reserva.
  - `adaptadorDaReserva` só é usado nos testes.
  - `reservaElegivel` lê a conferência da D62 por porta e, sem ela, a reserva não é elegível. Quem liga a porta é a 2.0.
  - O roteamento e a coluna `peloProvedorDeReserva` ficaram para a 4.0 e a 5.0.
- **Tech Spec.** As duas divergências do `1_task.md` estão registradas.
  - A coluna `pelo_provedor_de_reserva` fica para a 4.0 e a 5.0: está na `techspec.md` §3 e na linha RF4 do `cenarios.md`.
  - A assinatura nova de `reservaElegivel` está na `techspec.md` §5, "A aprovação". O `cenarios.md` não fixa assinatura, então não há o que divergir ali.
- **Identidade (1.2).** As leituras de `envio.provedorId ?? origem` no balde, no rótulo, no disjuntor e no preço passaram a ler `identidade`. Só sobram as duas que calculam a própria identidade, no `OpenAICompatAdapter` e no `ScriptedAdapter`. A linha de consumo do principal continua gravando o mesmo `provedor`.

**Recomendações**
1. `packages/core/src/config/llm-config.ts:240` (`conferirAReserva`): com `IA_RESERVA_ADAPTADOR=falso`, a subida aceita `LLM_RESERVA_BASE_URL`, `LLM_RESERVA_MODELO*` e `LLM_RESERVA_CHAVE_API` e os ignora sem avisar. É o mesmo tipo de configuração pela metade que a tarefa recusa quando falta `IA_RESERVA_ADAPTADOR`. Vale recusar ou registrar o motivo.
2. `packages/core/src/config/llm-config.ts:367` (`reservaConfigurada`): a reserva falsa aceita qualquer `IA_RESERVA_PROVEDOR_ID`. Com `IA_RESERVA_PROVEDOR_ID=maritaca`, por exemplo, o adaptador falso assume a identidade de um provedor de verdade no balde e na chave do preço. Fora de produção não fere nenhuma regra, mas confunde quem lê as medidas. Vale aceitar só `falso-reserva` no falso.
3. `packages/core/src/config/llm-config.ts:237`: o comentário diz "outra modelo"; o certo é "outro modelo".
4. `packages/core/src/ia/modelos-aprovados.ts`: o nome `ReservaDoGateway` sugere que o tipo vem do gateway. Ele é só a forma que a elegibilidade lê (identidade e modelo de cada perfil). Um nome como `ReservaParaAprovacao` diria isso melhor.

Arquivos relevantes:
- tasks/prd-reserva-e-avaliacao/1_task.md
- packages/core/src/config/llm-config.ts
- packages/core/src/ia/modelos-aprovados.ts
- packages/core/src/ia/llm-gateway.ts

## test-engineer · 1ª rodada · APROVADO · 2026-11-22 13:15:37 · `tasks/prd-reserva-e-avaliacao/1_task.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:** a reserva `openai_compat` sobe com o endereço, o modelo de cada perfil, a chave e a identidade dela. A reserva falsa assume `falso-reserva`. `reservaElegivel` aceita a reserva cuja entrada bate em tarefa, provedor e modelo do perfil.
- **Bordas:**
  - reserva meio configurada, ou uma variável da reserva sem `IA_RESERVA_ADAPTADOR`;
  - a mesma identidade do principal (falso, `openai_compat` e processamento local);
  - o mesmo provedor com o modelo repetido: no mesmo perfil, em perfil cruzado e no modelo menor do principal;
  - trocar o modelo de um perfil tira só as tarefas dele;
  - relatório editado depois da aprovação, ou ausente, e cada campo vazio da entrada;
  - o preço de outra identidade não vale para a reserva;
  - a reserva falsa com um endereço que sobrou no ambiente.
- **Permissão:**
  - o falso não vale em produção, nem na configuração nem na aprovação;
  - o Tutor só entra com aprovação própria;
  - sem a conferência da D62, nada é elegível (falha fechada);
  - o contrato fora do Brasil é recusado.
- **Isolamento:** não se aplica. Não há tabela, repository nem endpoint.
- **Concorrência:** não se aplica. É configuração, constante e função pura; a disputa entre reserva e principal é da 4.0.

**Cobertos:** as 14 linhas da tabela de testes do `1_task.md` têm o teste citado pelo nome, e os itens juntados por ponto e vírgula foram contados um a um. Os pontos que conferi:
- **Rodada nesta auditoria:** as 8 suítes (`llm-config`, `modelos-aprovados`, `llm-gateway`, `soberania`, `fake-adapter`, `openai-compat-adapter`, `consumo`, `resilient-adapter`) passaram, 361 casos, sem nenhum arquivo alterado.
- **Blocos de mutação contra o `git diff`:**
  - toda cláusula nova com condição tem bloco;
  - o único motivo sem bloco (`LLM_RESERVA_BASE_URL === undefined`) se sustenta, porque `conferirOEnvioDaReserva` já recusa a subida antes de `reservaConfigurada`;
  - o `citadas.length > 0` de `exigirPrecoDosModelos` não tem bloco, mas o `toMatchObject` com a lista exata de motivos o pega;
  - as linhas sem condição também estão cobertas: `resilient-adapter.ts:120` (o disjuntor), o balde, o rótulo e a chave do preço caem no teste dos dois falsos com o mesmo modelo e preços diferentes (custo de 120 contra 240);
  - a nova chave em `PRECO_DOS_MODELOS` cai no `consumo.test.ts`.
- **Motivo do vermelho:** as duas mutações que deixam o teste vermelho por `TypeError` (tirar `reserva === undefined ||` e inverter `reserva.modelo !== undefined`) falham porque o cenário chega à cláusula. Sem a guarda, a reserva ausente quebra em vez de ser recusada, então o motivo é o certo.
- **Asserções:** as asserções olham o resultado (variáveis e motivos do `InvalidConfigError`, baldes pedidos ao limitador, rótulo `provedor` nas medidas emitidas, custo na linha gravada) e nunca o texto da mensagem. A recusa por preço fixa o principal com preço, para o vermelho vir da reserva.
- **`.env.example` e `infra/carga.env`:** são conferidos carregando pelo `loadLLMConfig`, e não pelo texto do arquivo.
- **Sem desligar teste:** nenhum `.skip`, `.only`, `.todo`, `any`, teste comentado ou mock de coisa nossa. A D62 entra pela porta `DeclaracaoDeSoberania`, que é como a 2.0 a entrega.
- **Sem provedor pago:** o `OpenAICompatAdapter` da reserva só é construído e inspecionado, nunca chamado.
- **Fora desta tarefa, com dono:** a coluna `pelo_provedor_de_reserva` está registrada como Divergência 1 (fica para a 4.0 e a 5.0). As duas séries de `ia.tokens.uso_do_teto`, ainda citadas na linha RF4 do `cenarios.md`, são da `7_task.md` (7.2 e a linha 53 dela).

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Contagem errada no documento:** `1_task.md:57` diz "os cinco casos do describe", mas o describe em `packages/core/src/ia/llm-gateway.test.ts:1633` tem seis `it`. Corrigir o número, ou citar os casos pelo nome.
2. **Título que promete mais que o teste:** `packages/core/src/config/llm-config.test.ts:429` diz "em qualquer ambiente", mas todos os casos rodam com `AMBIENTE=local`. Hoje nenhuma cláusula depende de ambiente, então não bloqueia. Um caso em `staging` ou `producao` prenderia a mutação "comparar só em produção" que o `cenarios.md` lista.
3. **"Na guarda de segredo" (subtarefa 1.1):** não existe no repositório uma lista de variáveis secretas a que a chave pudesse ser acrescentada. A proteção real é o gitleaks mais o caso "nunca na mensagem". Vale dizer isso no documento, para a validação não procurar uma guarda que não existe.
4. **Elo com a 2.0:** a linha "fora do Brasil não é elegível" (`packages/core/src/ia/soberania.test.ts:300`) prova `motivosDaD62`, e não `reservaElegivel`. A ligação "não conferida, então não elegível" está provada em `packages/core/src/ia/modelos-aprovados.test.ts`. A 2.0 precisa ligar as duas pontas com um teste próprio.
5. **Relógio real:** `packages/core/src/ia/llm-gateway.test.ts:1802` usa `AbortSignal.timeout(50)` de verdade. Não é frágil: a espera é de 5 s contra 50 ms, e o caso sem espera responde de forma síncrona. Mesmo assim, o padrão da casa para prazo é o relógio falso.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-22 13:20:06 · `tasks/prd-reserva-e-avaliacao/1_task.md`

VEREDITO: APROVADO
Caminho quente tocado: IA (só a configuração e a identidade do adaptador. Nenhuma chamada vai à reserva antes da 4.0)
Rate limit: ok (sem endpoint novo. A chave do balde passa a ser `adaptador.identidade`, que no principal dá o mesmo valor de antes, `provedorId ?? origem`, então nenhum balde do Redis muda de nome)
Fila e prioridade: ok (sem job nem fila nova)
Concorrência: protegida (só configuração, constante e funções puras. A corrida entre reserva e principal fica para a 4.0)
Índice e paginação: ok (sem tabela nem query)
Degradação de IA: não se aplica nesta tarefa (a degradação para a reserva entra na 4.0. O que podia regredir não regrediu: o rótulo `provedor` das medidas, o disjuntor em `resilient-adapter.ts` e a chave do preço dão no principal os mesmos valores de antes)
Migration: não se aplica
Métrica e alerta: ok (sem alerta novo. Na reserva, o rótulo `provedor` passa a ser `falso-reserva`, separado do principal)
Bloqueantes: nenhum

Recomendações:
- `infra/carga.env:38-41`: as três variáveis da reserva já estão no arquivo, mas o compose ainda não as repassa a nenhum serviço. Hoje elas só chegam aos scripts `ops:*` e `carga.ts`, que rodam com `--env-file`. Isso não causa problema hoje, porque com `AMBIENTE=local` a reserva falsa é aceita. A 9.0 precisa ligar a fase `reserva` do cenário de carga e conferir que a carga da manhã continua igual sem ela.
- O limitador próprio da reserva (2.0) precisa dividir `LLM_RESERVA_TOKENS_POR_MINUTO` por `IA_REPLICAS`, como o principal já faz, senão duas réplicas do `worker-ia` passam do contratado da reserva. Vale registrar isso já no plano da 2.0.
- Ainda na 2.0: o balde da reserva precisa nascer com a chave `identidade:modelo` da reserva. Também falta um teste que prove que esgotar o balde do principal não reduz o que sobra para a reserva. É esse o caso que importa às 10h, quando o principal cai e todo o tráfego vai para ela.

O que rodei:
- Testes de unidade de `packages/core/src/ia/`, `packages/core/src/config/`, `infra/test/` e `tools/guardas/`: 2112 passaram.
- `tools/ci/ambiente-de-teste.test.ts`, que lê `infra/carga.env`: 44 passaram.
- `tsc --noEmit` de `packages/core`, `apps/api`, `apps/worker`, `apps/despachante`, `apps/realtime` e `infra`: sem erro.
- Nenhum teste chama provedor pago: o endereço `reserva.provedor.example` só aparece em configuração, nunca numa chamada.

## llm-integrator · 1ª rodada · APROVADO · 2026-11-22 13:20:08 · `tasks/prd-reserva-e-avaliacao/1_task.md`

VEREDITO: APROVADO

Perfis usados: nenhum. A tarefa não adiciona chamada de modelo, só a configuração, a identidade dos adaptadores e a aprovação por tarefa. Nenhuma chamada vai à reserva antes da 4.0. `adaptadorDaReserva` existe e é exportado, mas nada o liga ao caminho.

Custo estimado por professor/mês: não se aplica, porque não há chamada nova. A estimativa vem com a 4.0, quando o roteamento passa a mandar chamada à reserva. O preço da reserva já é exigido na subida fora de `local`, em `PRECO_DOS_MODELOS` pela chave `identidade:modelo`, e a `falso-reserva` tem preço zero declarado. Assim a chamada da reserva não grava custo zero onde há cobrança.

Prompt versionado: não se aplica, porque nenhum prompt foi criado ou alterado.

Validação de schema: não se aplica a saída de modelo. A configuração passa por zod (`llmEnvSchema`), e `problemasDosModelosAprovados` faz a guarda do `sha256` do relatório.

Aprovação humana no caminho: não se aplica. A tarefa não produz entrega. A entrada do `falso-reserva` em `MODELOS_APROVADOS` leva `aprovadoPor: 'sintetico'` e não vale em produção.

Verificações que fiz:
- **Testes e tipos:** `vitest --project unidade packages/core/src/ia packages/core/src/config` passou, 22 arquivos e 1329 testes. `tsc` em `packages/core` e em `apps/api` está limpo, e o `eslint` nos caminhos alterados também. Rodei só esses dois projetos do `tsc`, não o `npm run typecheck` inteiro: o comando completo foi para segundo plano e não consegui ler a saída.
- **Guarda de runbook:** `tools/guardas/runbook-tipo-do-log.test.ts` falhou uma vez por tempo esgotado, com a máquina carregada. Rodado isolado, passou (5 de 5). Não é da tarefa.
- **Isolamento do provedor (regra 30.1):** nenhum SDK novo. A identidade vem só de `adaptador.identidade`. O `grep "provedorId ?? "` só acha o `OpenAICompatAdapter` (onde nasce a identidade) e o fixture `scripted-adapter.ts`.
- **Regra 30.4 e 30.8 (registro, orçamento):** o balde, o rótulo, o disjuntor e a chave do preço usam a identidade. Os baldes da reserva e do principal não se misturam, e a linha de consumo continua com `provedor` nulo quando nada saiu.
- **Soberania (regra 20.12–13, D62):** `categoriasDasTarefas` exige do contrato da reserva só as categorias das tarefas aprovadas para ela. `reservaElegivel` falha fechada sem a conferência da D62, ou sem reserva configurada. A conferência em si é da 2.0.
- **Regra 70 (RF4):** a aprovação é por tarefa, provedor e modelo, e o modelo que conta é o do perfil da tarefa. O Tutor só é elegível com entrada própria.
- **Regra 80.4 (infra):** `LLM_RESERVA_TOKENS_POR_MINUTO` é obrigatório fora de `local`. A subida recusa a reserva falsa em produção, a reserva meio configurada, e a mesma identidade do principal (salvo o mesmo provedor com outro modelo em todo perfil, o menor incluído).
- **Segredo (regra 20):** a chave da reserva só vai para `ModelConfig.chaveApi` e nunca entra em mensagem de erro; há caso de teste.
- **Arquivos de ambiente:** `.env.example` traz a reserva comentada. `infra/carga.env` traz o `falso-reserva` com o contratado dela.

Bloqueantes: nenhum

Recomendações:
1. Em `packages/core/src/ia/modelos-aprovados.ts:30`, o `sha256` do relatório sintético está escrito à mão. O teste da constante o confere contra o disco, então não deixa passar erro. Mesmo assim, a mensagem de falha poderia mostrar o hash esperado para facilitar a atualização.
2. A `1_task.md` afirma, na autoconferência, 59 blocos de mutação aplicados. Eu não rodei `mutacoes.ts`. O portão da tarefa é quem confere isso antes do carimbo.
3. A recomendação do `infra-guardian` (F5b, rodada 5), de recusar `falso-reserva` sobre `openai_compat` em todo ambiente, ficou registrada na tabela de "Recomendações sem aplicar", porque a §5 decidiu "só em produção". Concordo. Em `staging` uma reserva real com o nome `falso-reserva` gravaria o provedor errado na linha de consumo; como staging não tem dado real, o risco é só de rótulo.
4. A divergência 1 está bem fundamentada e aparece na `techspec.md` §3, no `cenarios.md` e na tarefa. A 4.0 e a 5.0 precisam provar a coluna `pelo_provedor_de_reserva`, o que o `4_task.md` e o `5_task.md` já citam. Vale o revisor da 4.0 conferir que isso foi feito.
5. Fica para a 4.0: a estimativa de chamadas por professor por mês, por perfil, para a reserva. Sem ela a precificação da degradação continua sendo chute.

Caminhos relevantes (todos sob `.`):
- `packages/core/src/ia/modelos-aprovados.ts`
- `packages/core/src/config/llm-config.ts`
- `packages/core/src/ia/llm-gateway.ts`

## llm-integrator · 2ª rodada · SEM VEREDITO · 2026-11-22 13:20:19 · `tasks/prd-reserva-e-avaliacao/1_task.md`

O `npm run typecheck` inteiro e o conjunto `tools/guardas` com `tools/ci` terminaram limpos, o que fecha a pendência que deixei na resposta anterior. O typecheck passou em todos os workspaces. As guardas e a esteira passaram em 34 arquivos e 958 testes, e o `eslint` nos caminhos alterados não acusou nada.

O veredito não muda: **APROVADO**, sem bloqueantes. As recomendações da resposta anterior continuam valendo. A única que muda é a 2: a falha isolada em `tools/guardas/runbook-tipo-do-log.test.ts` foi tempo esgotado sob carga, e na execução completa essa suíte passou.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-22 13:38:26 · `tasks/prd-reserva-e-avaliacao/1_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum
Recomendações:
- Em `packages/core/src/config/llm-config.test.ts:438-444`, o caso de staging com a reserva falsa e a mesma identidade do principal falso usa um principal falso. Não há caso que prove que o principal falso sobe em staging, então pode valer explicitar isso. Hoje esse caso só se apoia no fato de a recusa citar `IA_RESERVA_PROVEDOR_ID` e nada mais. Melhoria de cobertura, não bloqueia.
- O `it` dessa regra já tem sete expectativas em sequência, e esta rodada acrescentou mais quatro. Se ele voltar a crescer, vale separar em `it` próprios ("em staging e em produção"), para que uma falha diga qual ambiente quebrou sem depender do rótulo `ambiente` no `expect`.

Nesta rodada conferi só o que mudou:
- **Teste:** o laço em staging e produção cobre os dois lados da regra: a recusa por `LLM_RESERVA_MODELO` quando a identidade e o modelo são os do principal, e o aceite quando o modelo é outro. O caso extra cobre a reserva falsa com a identidade `falso` em staging. Tudo fica dentro da regra desta tarefa e não adianta nada de tarefa futura.
- **`llm-config.ts`:** o comentário está correto ("outro modelo", linhas 44, 46, 237 e 270).
- **`1_task.md`:** a linha da tabela diz "os seis casos do describe", e o describe "fora de `local`, o modelo da reserva precisa de preço" em `llm-gateway.test.ts` tem de fato seis `it`. As recomendações da 1ª rodada que não foram aplicadas estão todas na tabela "Recomendações sem aplicar", cada uma com destino ou motivo da recusa.

## test-engineer · 2ª rodada · APROVADO · 2026-11-22 13:38:33 · `tasks/prd-reserva-e-avaliacao/1_task.md`

VEREDITO: APROVADO

Cenários exigidos: os mesmos da 1ª rodada. Esta rodada confere só o que mudou: o caso "a mesma identidade do principal recusa em qualquer ambiente", que ganhou staging e produção; a linha "os seis casos do describe" na tabela de testes; o texto da subtarefa 1.1; e a tabela "Recomendações sem aplicar".

Cobertos:
- **O bloco novo de `llm-config.test.ts` (linhas 438 a 444) chega à cláusula certa.**
  - Os dados do teste montam a mesma identidade dos dois lados. O principal é `provedor-de-teste` com o modelo `qwen3-8b`, e a reserva, `openai_compat` com o mesmo id e o mesmo modelo.
  - Em staging e em produção a recusa cita `LLM_RESERVA_MODELO`, que é a cláusula do modelo repetido. O controle positivo, trocando só o modelo para `outro-modelo`, sobe com a identidade `provedor-de-teste`. Assim o vermelho se deve ao modelo repetido, e não a outro defeito da configuração.
  - A linha 444 cobre staging com o principal falso e a reserva falsa de id `falso`: a recusa cita `IA_RESERVA_PROVEDOR_ID`, que é a cláusula da mesma identidade. Produção não entra nesse caso, e está certo: lá a reserva falsa já é recusada antes, pelo caso "em produção a reserva falsa é recusada".
  - Com isso, "em qualquer ambiente", no nome do caso, passa a ter prova nos três ambientes.
- **"Os seis casos do describe" (linha 57 da tabela) confere.** O describe de `llm-gateway.test.ts` que começa na linha 1633 tem seis casos, nas linhas 1664, 1671, 1679, 1684, 1690 e 1695. Juntos eles cobrem cada perfil sem preço, a recusa que cita a variável e nunca o valor, o preço ligado à identidade da reserva, staging contra `local`, as três recusas em ordem e a subida sem reserva.
- **Subtarefa 1.1 e "Recomendações sem aplicar":** mudou só o texto do documento. Toda recomendação da 1ª rodada tem destino ou motivo de recusa registrado.
- **Testes:** `npx vitest run` de `llm-config.test.ts` e `llm-gateway.test.ts` passa, 207 de 207, sem `.skip` e sem mock que esconda a regra.
- **`llm-config.ts`:** a mudança é só o comentário, e não pede bloco de mutação.

Bloqueantes: nenhum.

Recomendações:
- No laço de staging e produção da linha 441, conferir também `motivos: [MOTIVO_RESERVA_COM_MODELO_DO_PRINCIPAL]`, e não só `variaveis`. Hoje o caso não separa a recusa por modelo repetido de outra recusa que, no futuro, cite a mesma variável.

Arquivos auditados:
- packages/core/src/config/llm-config.test.ts
- packages/core/src/ia/llm-gateway.test.ts
- tasks/prd-reserva-e-avaliacao/1_task.md
