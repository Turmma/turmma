# Achados das revisões — `tasks/prd-reengenharia-continuacao/10_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-16 18:04:23 · `tasks/prd-reengenharia-continuacao/10_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova. O diff não tem migration nem schema.

Queries verificadas: nenhuma query nova nem alterada ao banco. Repositories e endpoints também não mudaram. O que conferi:
- **Registro de consumo e orçamento.** O `ConsumoRepository` e o `OrcamentoRepository` continuam ligados como antes em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/ia-do-worker.module.ts`, e o registro segue na escola do contexto.
- **Origem da `fila`.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/execucao-command.ts:81`, a `fila` vem do comando registrado no servidor, não do cliente. O `escolaId` continua vindo de `requireEscolaId()`.
- **Chaves de Redis.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/token-limiter.ts`, as chaves são `ia:tok[:fila]:{provedor:modelo}`, sem id de escola, aluno ou execução. O balde é global de propósito, porque reflete o limite contratado com o provedor. Nenhuma resposta do limitador expõe dado de outra escola: devolve só `msAteLiberar` e `usoDoTeto`, uma fração do contratado.
- **Métricas e logs novos.** `ia.chamada.duracao`, `ia.chamada.erros`, `ia.disjuntor.aberto`, `ia.degradacao` e `ia.tokens.uso_do_teto` usam só os rótulos provedor, modelo, perfil, resultado, código e degrau. Os eventos de log `ia.geracao.espera_de_vaga`, `ia.geracao.modelo_menor` e `ia.geracao.sem_vaga` não levam escola nem execução.
- **Ordem no gateway.** A reserva de tokens vem depois da D62, do teto de entrada e do orçamento por escola e por aluno, então o limite global não contorna o freio por escola.

Teste de isolamento: ausente, e esta tarefa não o exige. Não há módulo novo com dado de escola: nenhuma tabela, repository, query ou endpoint. O teste existente "RF2: a vaga de cada fila é de cada escola" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/fila-de-ia.int.test.ts`) não mudou.

Bloqueantes: nenhum

Recomendações:
- O balde geral de tokens é dividido entre todas as escolas. Uma escola com muita carga pode esgotá-lo e fazer o Tutor de outra escola terminar em `IA_INDISPONIVEL` depois de 8 s. Isso não vaza dado, mas é uma interferência entre escolas, e as vagas por escola (RF2) não a impedem, porque são uma barreira separada. Vale registrar em `docs/infra.md` ou no runbook que o balde é global de propósito, e anotar no `TODO.md` que se avalie uma parte por escola quando o piloto tiver mais de uma escola de carga real.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-16 18:04:34 · `tasks/prd-reengenharia-continuacao/10_task.md`

```
VEREDITO: APROVADO
Caminhos de escrita em Nota: nenhum nesta tarefa. O diff não toca Nota, entrega, governança nem avaliação. — todos com autor humano? sim (nada muda)
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok
Supervisão do tutor: ok
Autonomia declarada e visível: sim (sem mudança)
Bloqueantes: nenhum
Recomendações: 5 (abaixo)
```

**O que conferi para a regra 70**

- **Tutor nunca usa o modelo menor.** A lista que barra o modelo menor está em `packages/core/src/ia/llm-gateway.ts:65` e é aplicada em `llm-gateway.ts:426`. O teste "o turno do Tutor pula o modelo menor…" (`llm-gateway.test.ts:961`) confirma três coisas: o menor nem é reservado, o modelo não é chamado e a falta de vaga termina em `IA_INDISPONIVEL`. Há uma mutação declarada para isso.
- **A exceção da D47 continua só no Tutor.** Para as outras tarefas, o degrau do modelo menor troca só o modelo. A saída continua passando pelo `interpretar` e pela conferência de sempre, e depois pela aprovação registrada que já existia. A tarefa não abre nenhum caminho de saída sem aprovação.
- **D55 também vale na saída do modelo menor.** O teste "a saída do modelo menor passa pela mesma conferência…" (`llm-gateway.test.ts:994`) mostra que o `propor_ferramenta` com nota na resposta do menor vira a recusa fixa, e o consumo grava `menor-rapido`. A conferência é uma regra fixa do gateway e não depende de qual modelo respondeu.
- **D36 continua de pé.** A mensagem fixa do assunto delicado não passa pelo limite de tokens (teste "a resposta de regra fixa não reserva token"). A D62, o teto e o orçamento recusam antes de qualquer reserva (os testes "a ordem…" e "o orçamento recusa antes…").
- **Auditoria.** O `consumo_ia` grava o modelo que de fato respondeu (`gasto.modelo = resposta.modelo`). Assim "o que a IA gerou" continua tendo resposta, inclusive quando quem respondeu foi o menor.
- **Supervisão sem vigilância.** Métricas e logs dos degraus levam só a tarefa, o modelo, o degrau e o código. Não levam escola, aluno, execução nem texto (testes em `llm-gateway.test.ts:1091` e `:1126`). Nada mede comportamento do aluno nem do professor.
- **Supervisão do Tutor (item 4).** A AIA do Tutor ganhou o item 17 (`docs/aia/tutor.md:436`). Ele diz que o professor vê como contagem a pergunta que ficou sem vaga, que a leitura do modelo (a segunda do D36) não acontece nesse caso e que nenhuma resposta é inventada.
- **Medir o professor (itens 8 e 9).** Não há ranking, indicador nominal nem métrica de professor no diff.

**Recomendações (não bloqueiam)**

1. **Lista de exclusão em vez de lista de permissão** (`packages/core/src/ia/llm-gateway.ts:65`). Hoje o Tutor fica fora do menor porque está numa lista de exclusão. Uma tarefa nova que fale com o aluno cairia no menor sem ninguém decidir isso. Vale trocar por uma lista das tarefas que podem descer, ou por um campo obrigatório no `defineTask`, como já se faz com `levaTextoDeAluno`.
2. **AIAs das outras funções de alto risco** (`docs/aia/correcao-de-objetiva.md`, `docs/aia/sinais-e-alertas.md`, `docs/aia/adaptacao.md`). `relatorio_da_correcao`, `resumo_do_analista` e `adaptar_atividade` podem descer para o modelo menor, e essas três AIAs não falam disso. Hoje um modelo real menor não sobe sem preço em `PRECO_DOS_MODELOS` (`packages/core/src/ia/consumo.ts:103`), então o risco fica para depois. Mas a tarefa que puser o modelo real com a D37 precisa atualizar as três AIAs (regra 70, item 6a). Vale registrar isso no `TODO.md` ou na D37.
3. **Prioridade na fila.** O `pedido.fila ?? 'normal'` é uma escolha segura, porque a fila sem indicação fica com o menor teto. Mesmo assim, conviria um teste de integração que prove que o comando do Tutor chega ao gateway com `fila: 'interativa'`. Sem isso, um esquecimento derruba o Tutor para o balde de 10 % sem ninguém perceber. Isso é mais do `infra-guardian`, e não muda a supervisão.
4. **Qual modelo produziu a entrega.** Quando D37 ativar o menor, a coordenação pode querer ver na tela de auditoria qual modelo produziu cada entrega. Hoje isso está só no `consumo_ia`. Não é exigência da regra 70.
5. **Duas frases parecidas no runbook.** O título "Tokens acima de 80% do contratado" (`docs/runbook.md`) e o texto da AIA do Tutor estão coerentes. Vale só evitar que "saturação, e não defeito" seja lido como "nada a fazer" na seção de impacto para o aluno.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-16 18:04:46 · `tasks/prd-reengenharia-continuacao/10_task.md`

VEREDITO: APROVADO

A tarefa 10.0 não acrescenta nenhum campo de pessoa, não abre rota, DTO ou exportação, não grava arquivo e não usa seed. O que importa para a regra 20 é o que ela passa a registrar e enviar: os logs dos degraus, as métricas novas, as chaves no Redis e o registro de consumo quando a chamada não sai. Os quatro estão limpos.

Campos pessoais tocados: nenhum novo. O pedido ganhou `fila` e a chamada ao modelo ganhou `modelo` (`packages/core/src/ia/port.ts`, `adaptador.ts`), e nenhum dos dois é dado de pessoa. O `consumo_ia` grava as mesmas colunas de antes. A única diferença é que agora pode aparecer o nome do modelo menor em `modelo` (`llm-gateway.ts:348`).

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: não se aplica, porque a tarefa não cria rota nem leitura de objeto. O limite de tokens é por `provedor:modelo`, e a chave no Redis é `ia:tok[:fila]:{provedor:modelo}` (`token-limiter.ts:18-21`, `llm-gateway.ts:441-444`). Ela não leva escola, aluno nem execução, então um balde não deixa ver nada de uma escola para outra.

Logs: limpos.
- Os logs novos dos degraus (`llm-gateway.ts:450-454`) levam só `evento`, `tipo`, `modeloId` e, no fim, `codigo`.
- O log `ia.geracao.reserva` (`llm-gateway.ts:371`) só mudou de lugar e continua com os mesmos ids (`escolaId`, `execucaoId`).
- A falha na subida diz o nome da variável, não o valor dela (`llm-gateway.ts:525-528`).
- As métricas novas usam só estes rótulos: `degrau`, `modelo`, `provedor`, `perfil`, `codigo`, `resultado`, `tarefa`. Os dois testes "as métricas do gateway nunca levam usuário nem escola" e "o log de cada degrau leva só…" provam isso.

Auditoria: não se aplica. A tarefa não lê dado de aluno pela coordenação ou pela rede, não exporta, não mexe em nota nem em permissão e não aprova saída de IA.

Envio externo:
- **O que vai:** o mesmo pedido de antes, ao mesmo provedor, pelo mesmo adaptador. O degrau só troca o modelo dentro do provedor, então a conferência da D62 (provedor com processamento no Brasil), feita antes de reservar, continua valendo para o menor.
- **Registro do envio:** a tentativa só conta depois de reservar a vaga (`llm-gateway.ts:341-343`). Por isso, quando a chamada termina `IA_INDISPONIVEL` sem ter saído, o consumo fica sem envio externo (`llm-gateway.ts:470`). O registro não diz que algo foi enviado quando não foi, e a lista de compartilhamento continua certa.
- **Tutor:** o turno do Tutor nunca vai ao modelo menor (`TAREFAS_SEM_MODELO_MENOR`, `llm-gateway.ts:418`), e o teste de mutação cobre isso.
- **Treinamento:** o modelo menor só sobe com preço em `PRECO_DOS_MODELOS`. Hoje a tabela só tem os modelos do adaptador falso, então nenhum provedor novo entra sem a D37.

Seed/fixture: sintético. Os testes novos usam constantes (`ESCOLA_A`, `ALUNO_1`, `EXECUCAO`) e textos de exemplo ("não entendi essa", "reagente limitante"). Não há nome, matrícula nem contato.

Pergunta de fechamento: o código continua respondendo. Cada chamada fica no `consumo_ia` com o modelo que respondeu, se houve envio externo e para qual provedor, e a chamada que não saiu não aparece como enviada. O caminho do arquivo do titular não mudou.

Bloqueantes: nenhum.

Recomendações:
1. `packages/core/src/ia/llm-gateway.ts:245` e `:348`: quando a chamada ao modelo menor falha (o `chamarModelo` lança erro), o `gasto.modelo` continua com o modelo do perfil, e o consumo de `falhou` grava o principal, embora o pedido tenha ido ao menor. O provedor gravado continua certo, então a resposta "para onde foi enviado" não muda, mas o modelo gravado fica errado. Sugestão: gravar `vaga.modelo` em `gasto.modelo` antes de chamar o modelo, com um caso de teste "menor que falha grava o menor".
2. `docs/aia/tutor.md`, item 17: vale dizer também que, sem vaga, o turno não manda nada ao provedor e por isso não entra na lista de compartilhamento do aluno. É a pergunta que o jurídico da rede faz, e hoje a resposta só está no código.

Arquivos lidos, todos em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/`:
- `packages/core/src/ia/token-limiter.ts`
- `packages/core/src/ia/llm-gateway.ts`
- `packages/core/src/ia/resilient-adapter.ts`
- `packages/core/src/ia/consumo.ts`
- `packages/core/src/telemetry/metrics.ts`
- `apps/api/src/ia/ia-do-worker.module.ts`
- `apps/api/src/ia/execucao-command.ts`
- `apps/api/src/ia/prazo-com-tokens.int.test.ts`
- `docs/aia/tutor.md`
- `docs/runbook.md`
- `.env.example`
- `infra/compose.yml`

## llm-integrator · 1ª rodada · APROVADO · 2026-11-16 18:04:54 · `tasks/prd-reengenharia-continuacao/10_task.md`

VEREDITO: APROVADO

Perfis usados: nenhum perfil novo, e nenhuma tarefa nova chama o modelo. A tarefa só põe limite e degradação nas chamadas que já existem, cada uma no perfil que já tinha. Isso foi lido no diff, não executado, e vale também para o `perfis.ts`, que não mudou. O degrau do modelo menor usa `LLM_MODELO_MENOR_<PERFIL>`, o menor do mesmo perfil. O `turno_do_tutor` nunca desce para ele (`TAREFAS_SEM_MODELO_MENOR`, `packages/core/src/ia/llm-gateway.ts`).

Custo estimado por professor/mês: não se aplica como acréscimo, porque a tarefa não adiciona chamada de modelo por professor. A reserva só consulta o Redis (uma ou duas operações por tentativa) e, em saturação, o degrau do modelo menor tende a reduzir o custo. O gasto fica no que as tarefas anteriores já estimaram. A estimativa de custo da chamada real continua aberta em dois pontos:
- O custo em reais por chamada não é calculado em nenhum lugar do código lido. `custoMicros` só aparece no schema, com valor padrão 0, e na leitura. `PRECO_DOS_MODELOS` serve apenas de portão na subida e tem só os dois modelos falsos, a zero.
- O preço do modelo real e o do menor entram com a D37, como a própria tarefa declara.

Prompt versionado: sim, sem prompt novo ou alterado. Os prompts existentes seguem em arquivo versionado.

Validação de schema: sim. A saída do modelo menor passa pela mesma conferência de schema e pela regra fixa da D55, como o teste "a saída do modelo menor passa pela mesma conferência…" prova. O erro tipado (`IA_SAIDA_INVALIDA`, `IA_INDISPONIVEL`, `IA_TEMPO_ESGOTADO`) está definido.

Aprovação humana no caminho: não se aplica. Nada oficial é produzido. Sem vaga, o fim é `IA_INDISPONIVEL`, sem nota, sem mensagem à família e sem decisão sobre aluno. A entrega continua nascendo `pendente` pelo caminho anterior, que a tarefa não altera.

O que foi conferido, ponto a ponto:
- **SDK de provedor:** nenhum SDK fora dos adaptadores. O `TokenLimiter` importa só `rate-limiter-flexible` e `ioredis`, e o gateway usa o `ModelAdapter`.
- **Ordem no gateway:** a reserva vem depois da D62, do teto de entrada e do orçamento.
- **Prazo:** a espera de 8 s é cortada por `pedido.sinal`, então fica dentro do prazo único da execução.
- **Redis fora:** cada réplica segura o teto ÷ `IA_REPLICAS`, com `rejectIfRedisNotReady` e `insuranceLimiter`.
- **Orçamento e registro:** o orçamento por aluno e escola vem antes do limite. O consumo grava o modelo que respondeu (`gasto.modelo`), e `tentativas` só conta depois da reserva.
- **Privacidade:** as métricas e o log do degrau só levam tarefa, modelo e código. Nenhuma chave do Redis leva escola, aluno ou execução.
- **Alertas:** os dois novos têm âncora no runbook, e as três âncoras existem em `docs/runbook.md` (linhas 1333, 1357 e 1375).
- **Configuração:** `LLM_TOKENS_POR_MINUTO` é obrigatória fora de `AMBIENTE=local`, e `.env.example` e compose estão alinhados.
- **Testes:** nenhum teste chama provedor pago (adaptador falso e `ScriptedAdapter`). Rodei 20 arquivos de unidade (core/ia, `llm-config`, `alertas` e `alerta-tem-runbook`): 1165 testes passaram. `tsc --noEmit` em `packages/core` e em `apps/api` saiu sem erro.
- **Não executado:** os testes de integração com Redis (`token-limiter.int.test.ts`, `prazo-com-tokens.int.test.ts`) não foram rodados. Li o que a tarefa declara sobre eles, sem reexecutar.

Bloqueantes: nenhum

Recomendações:
- `packages/core/src/ia/llm-gateway.ts` (`reservarVaga`, `anotarUsoDoTeto`): o gateway usa `Date.now()` diretamente na espera e no uso do teto, embora já tenha `this.relogio`. Os testes funcionam porque usam `vi.useFakeTimers`, mas usar o `Clock` injetado deixaria a espera mais fácil de testar.
- `packages/core/src/ia/consumo.ts` (`PRECO_DOS_MODELOS`): a tabela só barra a subida, e o valor dos preços não é lido por nenhum cálculo. O docblock diz que, sem preço, o degrau "gastaria sem a conta da D14", o que sugere que a tabela alimenta o custo. Convém dizer isso no comentário e deixar registrado para a D37 que o cálculo do custo por chamada (`custo_micros`) ainda não existe. Esse cálculo é necessário para fechar a precificação.
- Quando a chamada ao modelo falha, `acertar` não é chamado e a reserva fica na estimativa até o fim do minuto. Isso superestima e é seguro, mas vale uma linha no runbook. O mesmo vale para as repetições internas do `ResilientAdapter`, que gastam tokens sem nova reserva.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-16 18:05:32 · `tasks/prd-reengenharia-continuacao/10_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. As divergências estão em `techspec.md` §5, no parágrafo "Como a 10.0 ficou", e no `cenarios.md` §4. Uma delas parte de uma premissa falsa, tratada no bloqueante abaixo.
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

Bloqueantes:

1. **O alerta "Tokens acima de 80 %" quase nunca dispara.** Arquivos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/token-limiter.ts:102`, `:116` e `:143`, mais `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/infra/grafana/alertas/ia-tokens-acima-do-teto.yaml` (regra `educa-ia-tokens-acima-de-80`, `>= 0.8`).
   - **Premissa falsa.** O documento da tarefa e o comentário de `infra/test/alertas.test.ts:248` afirmam que "o balde cheio vale exatamente 0,8". Isso só acontece num caso artificial, e falha por dois motivos.
   - **Arredondamento.** O balde geral é `Math.floor(contratado × 0.8)`, e `usoDoTeto` é `consumidos / contratado`. Com contratado não redondo, o balde 100 % cheio fica abaixo de 0,8. Conferi com `node`: 1 234 567 dá 0,7999995, e 1 700 001 dá 0,7999995. Nesses casos o alerta não acende nem com o balde lotado.
   - **Saturação real.** Na recusa, `consumidos = consumedPoints − pontos`, ou seja, o que havia antes do pedido recusado. Na saturação de verdade (a manhã de segunda), o balde para logo abaixo do topo, porque o pedido seguinte não cabe. Exemplo: 1 996 000 de 2 000 000 com pedidos de 5 000 dá a métrica em ~0,798 durante os 5 min inteiros, e o alerta fica calado. Enquanto isso, a espera e o modelo menor já estão acontecendo, e é exatamente para isso que o alerta existe (RF8). O caso de `token-limiter.test.ts:99-106` só passa porque enche o balde com a soma exata de 8 000.
   - **Correção exigida.**
     - Na recusa pelo balde geral, o uso do teto passa a dizer que o balde está cheio para aquele pedido. Exemplo: `min(consumidos + pontos, geral.pontos)`, ou o próprio `PARTE_DO_BALDE_GERAL`.
     - A fração passa a ser calculada contra o balde, por exemplo `consumidos / geral.pontos × PARTE_DO_BALDE_GERAL`, para não depender do `floor`. Outra opção é rever o limiar com motivo escrito.
     - Entram dois casos de teste: um com contratado não redondo e balde exatamente cheio, e outro com sobra menor que o pedido recusado. Os dois precisam dar `usoDoTeto >= 0.8`, e cada um leva a mutação correspondente.
     - Corrigir a frase da tabela de divergências do `10_task.md` e o comentário de `infra/test/alertas.test.ts:248`.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/runbook.md:1348` cita `LLM_API_KEY`, mas a variável é `LLM_CHAVE_API`. A linha `:1350` cita `LLM_PRAZO_*_MS`, mas as variáveis são `LLM_TIMEOUT_MS*`. Um operador no meio do incidente vai procurar nomes que não existem.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/llm-gateway.ts`, em `reservarVaga`, `anotarUsoDoTeto` e no callback da gauge, usa `Date.now()`. O gateway já recebe `relogio: Clock`, então isso cria um segundo jeito de ler a hora na mesma classe. Hoje funciona porque o `vi.useFakeTimers` também falsifica o `Date.now`. Vale unificar, ou escrever por que a espera usa outro relógio.
- `GenerationRequest.fila` cai em `'normal'` quando ausente. Hoje todo comando passa a fila, mas uma chamada nova sem `fila` vinda do Tutor cairia no balde de 10 % sem ninguém perceber. Vale tornar o campo obrigatório no comando, que é por onde o worker chama.

## infra-guardian · 1ª rodada · REPROVADO · 2026-11-16 18:05:35 · `tasks/prd-reengenharia-continuacao/10_task.md`

VEREDITO: REPROVADO

Caminho quente tocado: IA, fila

Rate limit: ok. O limite de tokens por minuto é somado entre as réplicas no Redis da fila, com um balde por `provedor:modelo`. A chave não leva escola, aluno nem IP. Com o Redis fora, cada réplica segura o teto ÷ `IA_REPLICAS`.

Fila e prioridade: ok. O Tutor (`interativa`) só consome o balde geral. A `ferramenta` (15 %) e a `normal` (10 %) reservam antes no balde delas e devolvem o que reservaram quando o geral recusa. A `fila` do comando chega ao gateway (`execucao-command.ts:81`).

Concorrência: protegida. A reserva é atômica no Redis (`RateLimiterRedis`). A reserva recusada é devolvida e o acerto só vale dentro do minuto da reserva. O teste de duas réplicas reservando juntas (`Promise.all`) passa no Redis real.

Índice e paginação: não se aplica, a tarefa não lê nem grava tabela.

Degradação de IA: ok. A ordem é D62, teto e orçamento antes de reservar. Sem vaga, o pedido espera até 8 s dentro do prazo único, com a espera cortada pelo `pedido.sinal`. Depois vai ao modelo menor (nunca no `turno_do_tutor`) e termina `IA_INDISPONIVEL`, sem erro cru. O cliente Redis não tem fila offline e tem `commandTimeout`, então Redis travado cai no seguro e não pendura a reserva.

Migration: não se aplica.

Métrica e alerta: problema. As métricas e os dois alertas existem, cada um com âncora no runbook, mas o runbook do alerta novo manda mexer em variáveis que não existem (o bloqueante abaixo).

Os testes de unidade (225) e de integração (`token-limiter.int.test.ts`, `prazo-com-tokens.int.test.ts`, 14 casos) passaram nesta auditoria. Nenhum chama provedor pago.

Bloqueantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/runbook.md:1348`: a causa 2 de "Provedor de IA fora" manda corrigir `LLM_API_KEY`. A variável não existe; a chave é `LLM_CHAVE_API` (`.env.example`, `llm-config.ts`). Sozinho no horário de aula, o operador procura no `.env` uma variável que não está lá. **Correção:** trocar por `LLM_CHAVE_API`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/runbook.md:1350`: a causa 4 manda mexer em `LLM_PRAZO_*_MS`, que também não existe. Os prazos são `LLM_TIMEOUT_MS`, `LLM_TIMEOUT_MS_RAPIDO` e `LLM_TIMEOUT_MS_PADRAO`. **Correção:** usar os nomes reais. Se quiserem, um caso no `alerta-tem-runbook.test.ts` pode conferir que toda variável citada nos parágrafos dos alertas novos existe no `.env.example`.

Recomendações:
- `LLM_TOKENS_POR_MINUTO` entrou no compose com `:?` no `api` e no `worker-ia`. Antes do pouso na `main`, essa variável precisa estar no `.env` da VPS, senão o deploy automático para na interpolação. Vale uma linha no checklist de pouso ou no runbook de deploy.
- Na 2.ª tentativa (a repetição por saída inválida), se faltar vaga, o pedido termina `IA_INDISPONIVEL` e nunca chega a usar a saída de reserva da tarefa (`reservaQuandoInvalida`), que não gastaria tokens. Vale avaliar devolver a saída de reserva quando a 1.ª tentativa foi reprovada na conferência (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/llm-gateway.ts:342`).
- A janela fixa de 60 s faz quem espera repetir todo junto na virada do minuto. Na 11.0, o cenário de carga deve rodar com `LLM_TOKENS_POR_MINUTO` baixo o bastante para saturar, e medir o `ia_degradacao_total{degrau="indisponivel"}` e o p95 do Tutor nessa virada.
- Ainda na 11.0: conferir no ensaio que o "Tokens acima de 80%" segura os 5 min seguidos sob saturação contínua. O gauge guarda a última reserva, e uma reserva logo depois da virada do minuto pode zerar a contagem do `for:`.

## test-engineer · 1ª rodada · APROVADO · 2026-11-16 18:07:05 · `tasks/prd-reengenharia-continuacao/10_task.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:** com vaga, a chamada roda no modelo do perfil e a reserva é acertada pelo uso real.
- **Degraus:** espera de até 8 s, depois o modelo menor, depois `IA_INDISPONIVEL`, cada degrau com a sua métrica.
- **Bordas:**
  - não há modelo menor para o perfil;
  - o menor não tem preço;
  - a saída do menor tem nota, e a D55 a recusa;
  - a repetição por saída inválida faz uma segunda reserva;
  - a estimativa é maior que o balde;
  - a estimativa é zero ou fracionária;
  - o uso real é maior ou menor que a estimativa;
  - o acerto chega depois do minuto da reserva.
- **Prazo:** a espera fica dentro do prazo único; o menor fica pendurado; a 2.ª reserva acontece perto do fim do prazo; o sinal já chega abortado.
- **Permissão:** o `turno_do_tutor` nunca cai no modelo menor.
- **Isolamento e vizinho barulhento:** a `ferramenta` e a `normal` param no teto delas e o Tutor segue. O balde é por `provedor:modelo`, sem escola na chave.
- **Concorrência:** duas réplicas reservam em paralelo no mesmo Redis.
- **Redis fora:** o seguro de cada réplica é o teto ÷ `IA_REPLICAS`.
- **Ordem:** a D62, o teto e o orçamento recusam antes do `reservar`.
- **Configuração e fiação:** a variável é obrigatória fora do `local`; o `main-worker` monta o limitador; a fila do comando chega ao gateway.
- **Métricas e log:** não levam escola nem usuário.
- **Alertas:** cada limiar e cada `for:`, com runbook.

**Cobertos:** todos os acima.
- **Tabela de testes:** as 18 linhas da tabela de `10_task.md` têm teste com o nome que o documento cita.
- **Concorrência:** é paralela de verdade. Em `token-limiter.int.test.ts:35` e `:46` há `Promise.all` com dois `TokenLimiter` no mesmo Redis. O caso 5 000 + 5 000 deixa exatamente uma reserva recusada.
- **Prazo:** usa o relógio falso do Vitest no prazo, na espera e no `ResilientAdapter`. Não depende da máquina.
- **IA:** só aparecem adaptadores falsos (`ScriptedAdapter`, `FakeAdapter`, `LentoAdapter`). Nenhum provedor pago.
- **Mutações:** `mutacoes.ts --faltando` dá 0 linhas, e os 79 blocos batem com as cláusulas do diff.
- **Testes rodados:**

| Testes | Resultado |
|---|---|
| Unidade (`token-limiter`, `llm-gateway`, `llm-config`, `resilient-adapter`, `consumo`) | 203 verdes |
| `token-limiter.int.test.ts` e `prazo-com-tokens.int.test.ts` | 14 verdes |
| Os 2 casos novos de `fila-de-ia.int.test.ts` | verdes |
| `infra/test/alertas.test.ts` e `alerta-tem-runbook` | 26 verdes |

- **Proibidos:** nenhum `.skip`, `.only`, teste comentado nem `as any` nos testes novos.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **`packages/core/src/ia/token-limiter.int.test.ts:111-112`:** o comentário diz que prova a `ferramenta` com 1 500 ÷ 2, e a asserção não prova isso.
   - Os 750 cabem no seguro da fila (750). Quem recusa é o geral, já cheio com 4 000. Com o seguro da fila sem dividir, o resultado seria o mesmo.
   - A unidade cobre o caso (`token-limiter.test.ts` › "o balde da fila também é dividido"). Aqui, ou se reserva a fila antes de encher o geral, ou se corrige o comentário.
2. **`packages/core/src/ia/token-limiter.test.ts:183-188`:** o nome diz "o seguro ainda é de 1", mas o caso usa 40 e nunca chega ao piso de 1.
   - Na linha 184, `clientes[0]` é sempre `undefined` depois do `afterEach`. O `new Redis` criado ali não entra em `clientes` e nunca é desconectado.
3. **`token-limiter.test.ts:162`:** o nome diz "uso real zero", mas o caso usa 1.
4. **`packages/core/src/ia/llm-gateway.test.ts:1016`:** o caso da D62 não confere o código do erro. Hoje quem garante que o pedido chega à D62 é a mutação; a asserção `IA_INDISPONIVEL` deixaria isso explícito no próprio caso.
5. **Tabela de `10_task.md`:** três mutações nomeadas nela não têm bloco na seção "Mutações": "o geral antes" (linha baldes), "espera fora do prazo" e "só o que sobra" (linhas de prazo).
   - Não são cláusulas do diff, mas implementações alternativas. Os casos as pegariam pela construção.
   - Ou se reescreve como "o caso pegaria…", ou se acrescenta o bloco. Não pode parecer mutação provada.
6. **Linha "configuração" da tabela:** o item "Busca pelas variáveis que saíram" tem teste, mas ele não é citado na coluna Caso. O nome a citar é `llm-config.test.ts` › "as variáveis que a 5.0 tirou (IA_EXECUCOES_POR_ESCOLA, …)".
7. **Cobertura extra que falta:**
   - um caso de integração com duas réplicas reservando juntas na `ferramenta`, para provar que o balde da fila também soma entre réplicas (hoje só a `interativa` é provada em paralelo);
   - um caso do Redis que cai com o cliente ainda `ready`, quando o comando falha, além do cliente não pronto.
8. **Repetição que muda de modelo:** quando a 1.ª tentativa foi ao menor e a 2.ª volta ao principal, `gasto.modelo` guarda só o último modelo, e o custo de `consumo_ia` mistura os dois. Nenhum caso cobre isso. Fica para o `llm-integrator` olhar.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-16 18:28:00 · `tasks/prd-reengenharia-continuacao/10_task.md`

VEREDITO: APROVADO
Caminho quente tocado: IA
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: não se aplica (nenhuma query nova)
Degradação de IA: ok
Migration: não se aplica
Métrica e alerta: ok

Bloqueantes: nenhum.

As duas correções da 1ª rodada foram feitas:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/runbook.md:1352`: a causa 2 agora cita `LLM_CHAVE_API`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/runbook.md:1354`: a causa 4 agora cita `LLM_TIMEOUT_MS`, `LLM_TIMEOUT_MS_RAPIDO` e `LLM_TIMEOUT_MS_PADRAO`.
- Conferi todas as variáveis `LLM_*`, `IA_*` e `VAGAS_*` citadas no runbook contra o `.env.example` e a configuração. Só ficaram de fora `IA_INDISPONIVEL` e `IA_TEMPO_ESGOTADO`, que são códigos de erro, não variáveis.

A mudança que a Mesa pediu no `token-limiter.ts` está correta:
- O uso do teto passou a ser `min(consumidos, pontos) / pontos × 0,8`, e a reserva recusada pelo balde geral agora vale 0,8. Isso corrige o alerta de `>= 0,8` que não acendia em dois casos: quando o contratado não é um número redondo (por causa do `floor`) e quando o balde fica cheio logo abaixo do topo. Os casos novos em `token-limiter.test.ts` provam as duas situações, e as mutações batem com o código.
- O `#consumir` do balde da fila também devolve `balde.pontos` quando recusa, mas esse valor não chega ao `usoDoTeto`: a recusa da fila sai antes de consultar o geral. Não há efeito colateral.
- No `llm-gateway.ts`, o `gasto.modelo` agora é preenchido antes da chamada. Assim, quando a chamada falha, o consumo grava o modelo que recebeu o pedido, e o caso novo prova isso. A troca de `Date.now()` por `horaDoProcessoMs()` não muda nada em produção.
- O caso novo de duas réplicas na `ferramenta` em `token-limiter.int.test.ts` cobre a soma no Redis e mostra que a reserva recusada pela fila não consome o geral.
- Rodei `token-limiter.test.ts` e os 20 casos passaram. O `llm-gateway.test.ts` não carregou aqui porque o `@educa/shared` não está compilado neste checkout. É um problema do ambiente, não do diff, mas não vi esses casos passarem.

Recomendações:
- Um pedido grande recusado pelo geral leva o uso do teto a 0,8, mesmo que o balde ainda tenha espaço para pedidos menores. Na prática isso só acontece com o geral acima de cerca de 70 %, porque a `normal` limita o Analista a 10 % e a `ferramenta` a 15 %. Assim, o pior caso é o alerta de 80 % acender cedo, nunca acender sem carga. Vale registrar isso no runbook, junto de "O painel superestima", e conferir no ensaio da 11.0.
- A guarda que confere que toda variável citada no runbook existe no `.env.example` já está no `TODO.md`. Mantenho como opcional.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-16 18:28:06 · `tasks/prd-reengenharia-continuacao/10_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum neste diff. O diff só mexe no limite de tokens, no `gasto.modelo` do gateway, em documentação e em testes, e não toca `Nota`, aprovação nem entrega. Todos com autor humano? sim (nada mudou desde a 1ª rodada)
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. O diff não toca o fluxo de entrega pendente. A exceção da D47 continua só no Tutor: `TAREFAS_SEM_MODELO_MENOR` tem só `turno_do_tutor`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/llm-gateway.ts:65` e `:435`.
Supervisão do tutor: ok. O turno sem vaga continua aparecendo para a professora como contagem, pelo contador do item 15. O texto novo do item 17 de `docs/aia/tutor.md` não tira nada do que ela vê.
Autonomia declarada e visível: sim (o diff não muda a governança)
Bloqueantes: nenhum

**O que conferi no diff**

- **`gasto.modelo` gravado antes da chamada** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/llm-gateway.ts:354`):
  - A atribuição só acontece depois que `reservarVaga` concede a vaga. Sem vaga, `descerParaOMenor` lança `IA_INDISPONIVEL` antes dela (`:446`), e `gasto.tentativas` também não sobe (`:350`). Por isso `medir` continua usando `SEM_ENVIO_EXTERNO` no turno que não saiu (`:479`).
  - O consumo de `falhou` agora grava o modelo que de fato recebeu o pedido, e não o do perfil. Isso melhora a resposta "o que a IA gerou, com qual modelo" (regra 70, item 6).
  - Quem prova é `llm-gateway.test.ts` › "o modelo menor que falha…", com o bloco de mutação dele.
- **Item 17 de `docs/aia/tutor.md`:**
  - A frase nova diz que o turno sem vaga não envia nada ao provedor e não entra na lista de compartilhamento. O código confirma as duas coisas pelo caminho acima.
  - O Tutor continua sem descer ao modelo menor.
  - A parte que a regra 70 exige da AIA (limitação, risco que sobra pela D36, o 188 fora do limite) continua no lugar.
- **Cálculo do uso do teto em `token-limiter.ts`:** é métrica de operação, com a série só por `modelo`, sem escola, aluno nem professor. Não cria indicador sobre pessoa nem sinal de comportamento, então não toca os itens 7, 8 e 9.
- **Correções exigidas na 1ª rodada:** nenhuma. As recomendações da 1ª rodada estão no `TODO.md` com destino, nas linhas 13 a 17 do diff: AIAs do modelo menor, lista de permissão no lugar da lista de exclusão, modelo na tela de auditoria e `fila` obrigatória. Aceito os destinos registrados.

**Recomendações**

- Quando a D37 puser o `custo_micros` por chamada, o mesmo registro por chamada deveria gravar o modelo de cada tentativa. Hoje, uma repetição que muda de modelo grava só o último, e a auditoria não mostra que houve dois. Isso já está no `TODO.md` pelo test-engineer, e reforço aqui pelo item 6 da regra 70.

## llm-integrator · 2ª rodada · APROVADO · 2026-11-16 18:28:10 · `tasks/prd-reengenharia-continuacao/10_task.md`

VEREDITO: APROVADO

Auditei só o diff da rodada 2 e o que ele afeta. A rodada 1 não pedia correção nenhuma. Os testes de `llm-gateway.test.ts`, `token-limiter.test.ts` e `infra/test/alertas.test.ts` passam (128 testes).

Perfis usados: sem mudança nesta rodada. As tarefas de IA continuam com o perfil declarado. O Tutor nunca desce ao modelo menor. As outras ferramentas podem descer ao modelo menor quando falta vaga de tokens.

Custo estimado por professor/mês: sem chamada de modelo nova nesta rodada, então a estimativa anexada na rodada 1 vale. O `custo_micros` por chamada ainda não é calculado (fica para a D37). O docblock de `PRECO_DOS_MODELOS` em `packages/core/src/ia/consumo.ts` agora diz isso com clareza: a tabela só barra a subida de um modelo menor sem preço declarado.

Prompt versionado: sim (sem mudança).

Validação de schema: sim (sem mudança).

Aprovação humana no caminho: não se aplica. A tarefa só mexe no limite de tokens, no relógio e na telemetria. A entrega do agente continua nascendo `pendente`.

Bloqueantes: nenhum.

Conferência do diff:
- **Uso do teto** (`packages/core/src/ia/token-limiter.ts`): agora é a ocupação do balde geral vezes 0,8, e não mais `consumidos / contratado`. A reserva recusada vale 0,8. Isso corrige o contratado não redondo e a saturação real, em que o alerta `>= 0,8` ficava calado. Dois testes novos provam os dois casos.
- **`gasto.modelo`** (`packages/core/src/ia/llm-gateway.ts:355`): é gravado depois de a vaga ser concedida e antes da chamada, então o consumo de `falhou` registra o modelo menor que recebeu o pedido. O turno sem vaga continua sem gravar modelo nem contar tentativa, de modo que o consumo não diz que houve envio externo. O teste novo cobre a falha no modelo menor. A nota na AIA do Tutor (`docs/aia/tutor.md`) e a regra 20 estão coerentes com isso.
- **Relógio**: `Date.now()` virou `horaDoProcessoMs` (o mesmo relógio do `setTimeout`) na espera pela vaga e na validade do uso do teto. O `Clock` injetado continua sendo o do dia de negócio (freio diário, mês do orçamento, `em` do consumo), então a troca é segura. O docblock explica o motivo.
- O TODO registra o que sobra, tudo fora do escopo desta tarefa.

Recomendações:
- Quando a D37 entrar, grave um registro por chamada. Na repetição que muda de modelo, `gasto.modelo` guarda só o último e o custo mistura os dois. Isso já está no TODO.
- O balde geral é compartilhado entre escolas (também no TODO). Reavalie uma cota por escola quando o piloto tiver mais de uma escola com carga real.
- As AIAs de correção de objetiva, sinais e alertas, e adaptação não citam o modelo menor. Atualize-as junto da D37, como já está no TODO.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-16 18:28:13 · `tasks/prd-reengenharia-continuacao/10_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nem migration nesta rodada. O diff não toca em `consumo_ia`, e o `escolaId` do consumo continua vindo do pedido, como estava. A única mudança nessa tabela é o valor de `gasto.modelo`, que agora é o modelo que recebeu o pedido.

Queries verificadas:
- `packages/core/src/ia/token-limiter.ts` (`#usoDoTeto`, recusa em `#consumir`): o balde segue indexado por `provedor:modelo` e não lê nem grava dado de escola.
- `packages/core/src/ia/llm-gateway.ts` (`horaDoProcessoMs`, `anotarUsoDoTeto`, `gasto.modelo` antes da chamada): a métrica `ia.tokens.uso_do_teto` segue só com o rótulo `{modelo}`, sem escola nem usuário. Não entrou endpoint, repository nem `@Unscoped()`.

Teste de isolamento: não se aplica a esta rodada. O diff não cria superfície de dado por escola. Os casos novos (`token-limiter.test.ts` "o contratado que não é redondo" e "a saturação de verdade", `token-limiter.int.test.ts` com as duas réplicas na `ferramenta`, `llm-gateway.test.ts` "o modelo menor que falha") cobrem capacidade e consumo, não tenancy.

Correções exigidas da 1ª rodada: nenhuma havia. A recomendação desta auditoria, o balde geral compartilhado entre escolas, foi tratada assim:
- O motivo de ser global de propósito está em `docs/infra.md` ("O balde geral é de todas as escolas, de propósito") e no `docs/runbook.md` ("Tokens acima de 80% do contratado").
- Registra que é interferência entre escolas sem vazamento de dado, e que as vagas por escola (RF2) não a impedem.
- A pendência está no `TODO.md`, para avaliar uma parte por escola quando o piloto tiver mais de uma escola com carga real.

Bloqueantes: nenhum.

Recomendações: nenhuma nova.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-16 18:28:21 · `tasks/prd-reengenharia-continuacao/10_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. O §5 da `techspec.md` ainda descreve o uso do teto como "a fração do contratado, de 0 a 0,8", e isso continua verdade depois da correção. A conta nova está na tabela de divergências do `10_task.md`.

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

Bloqueantes: nenhum.

A correção exigida na 1ª rodada foi feita, nas quatro partes:
- **Arredondamento:** em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/token-limiter.ts:135-138`, o uso do teto agora é a ocupação do balde vezes `PARTE_DO_BALDE_GERAL`. Com o balde lotado dá exatamente 0,8, qualquer que seja o contratado.
- **Saturação real:** em `token-limiter.ts:152`, a recusa pelo balde geral passa a valer 0,8 (o balde cheio para aquele pedido).
- **Os dois casos de teste** estão em `token-limiter.test.ts`, cada um com a mutação que devolve o comportamento antigo:
  - "o contratado que não é redondo": a mutação `ocupado / Math.ceil(pontos/0.8)` refaz a conta contra o contratado (987 653 / 1 234 567 ≈ 0,7999995) e o caso fica vermelho;
  - "a saturação de verdade": a mutação volta a `consumedPoints - pontos`.
- **Os textos:** a frase da tabela de divergências do `10_task.md` e o comentário de `infra/test/alertas.test.ts:248` foram corrigidos.

O resto do diff também não traz problema:
- As variáveis que o runbook cita agora existem: `LLM_CHAVE_API` em `llm-config.ts:91` e as `LLM_TIMEOUT_MS*` no `.env.example`. Isso resolve o veto do infra-guardian.
- O `gasto.modelo` gravado antes da chamada tem caso de teste e mutação.
- O `horaDoProcessoMs` só embrulha `Date.now()`, sem mudar o comportamento.
- As recomendações dos outros revisores foram para o `TODO.md` ou para a tarefa 11.0, cada uma com destino escrito.

Recomendações:
1. Em `token-limiter.ts:141` e `:152`, um pedido do tamanho do balde inteiro (`pontos = balde.pontos`) é recusado sempre que o balde não está vazio, e por isso vale 0,8 mesmo com pouca ocupação. Com as estimativas de hoje (milhares de tokens contra um balde de milhões) isso não acontece. Vale uma linha no comentário de `#usoDoTeto`, ou no ensaio da 11.0.
2. Com o Redis fora, a reserva concedida pelo seguro em memória conta `consumedPoints` contra o limite da réplica (balde ÷ `IA_REPLICAS`), mas `#usoDoTeto` divide pelo balde inteiro. Nesse modo, o uso concedido fica abaixo de 0,8 mesmo com o seguro lotado, e só a recusa leva a 0,8. Registrar isso no runbook, no "O painel superestima" ou num parágrafo vizinho.
3. A seção "Mutações" do `10_task.md` ficou com quatro linhas em branco antes dos dois blocos novos (linhas 489-492 do patch). É só aparência.
4. `horaDoProcessoMs` (`llm-gateway.ts:171`) só embrulha `Date.now()`. O comentário justifica bem a separação do `Clock` de negócio, mas um nome como `agoraDoProcessoMs`, ou o `Date.now()` direto com o comentário, seria mais simples.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-16 18:28:49 · `tasks/prd-reengenharia-continuacao/10_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A rodada 2 não cria coluna, migration nem DTO. O que mudou foi o valor de `gasto.modelo` no `consumo_ia`, que é o id de modelo e não é dado de pessoa.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: não se aplica. O diff não tem rota nem endpoint novo.

Logs: limpos. O diff não traz log novo. A troca de `Date.now()` por `horaDoProcessoMs()` em `packages/core/src/ia/llm-gateway.ts:172` só muda o relógio.

Auditoria: não se aplica. Não houve leitura nominal, exportação, nota, permissão nem aprovação de saída de IA.

Envio externo: a mudança melhora a resposta a "para onde isso já foi enviado".
- Em `packages/core/src/ia/llm-gateway.ts:353-354`, `gasto.modelo` é gravado logo antes da chamada com o modelo que vai receber o pedido. Assim, o consumo de uma chamada que falha registra o modelo menor que de fato recebeu o texto, e não mais o modelo do perfil.
- Essa linha roda só depois de `reservarVaga` dar certo. O turno sem vaga sai antes, por `IA_INDISPONIVEL`, com `tentativas: 0`. Por isso `medir` (linhas 477-479) grava `SEM_ENVIO_EXTERNO`, e o turno não entra na lista de compartilhamento.
- O novo texto do item 17 de `docs/aia/tutor.md:440-441` confere com o código.
- O teste "degrau 3" (`packages/core/src/ia/llm-gateway.test.ts:957-973`) prova isso com `envioExterno: false, provedorId: null` no consumo. O caso novo "o modelo menor que falha" (linha 943) prova que o modelo menor fica gravado.
- Rodei `npx vitest run packages/core/src/ia/llm-gateway.test.ts` a partir da raiz: 92 de 92 verdes. Rodado de dentro de `packages/core`, o arquivo não carrega porque não acha `@educa/shared`; é ambiente, não código.

Seed/fixture: sintético. Os testes usam `ESCOLA_A`, `ALUNO_1` e o texto "não entendi essa". No runbook só mudaram nomes de variável (`LLM_CHAVE_API`, `LLM_TIMEOUT_MS*`) e não entrou valor real.

Pergunta de fechamento: continua respondida. O `consumo_ia` registra o envio só quando uma chamada saiu, e agora com o modelo certo. Ele não registra envio quando a chamada nem saiu.

Correções exigidas da 1ª rodada: nenhuma.

Bloqueantes: nenhum.

Recomendações:
- `packages/core/src/ia/llm-gateway.test.ts:943`: no caso "o modelo menor que falha", conferir também `envioExterno: true` e o `provedorId` no registro de `falhou`. Hoje o teste prova o modelo, mas não que o envio desse turno foi registrado. Isso fecha a lista de compartilhamento pelo outro lado.
- O item 17 da AIA do Tutor fala do turno do Tutor, mas o teste do "degrau 3" usa `pedidoDaFerramenta()`. O caminho de código é o mesmo, mas um caso com `turnoDoTutor` e `fila: 'interativa'` sem vaga, conferindo `envioExterno: false`, ligaria a frase da AIA a um teste do próprio Tutor.

## test-engineer · 2ª rodada · APROVADO · 2026-11-16 18:28:57 · `tasks/prd-reengenharia-continuacao/10_task.md`

VEREDITO: APROVADO

Os cálculos novos do uso do teto e o modelo que o consumo grava têm caso próprio e bloco de mutação que chega à cláusula. Os testes de unidade (112 casos) e o de integração com Redis (8 casos) passam, e o documento tem os 81 blocos que declara.

**Cenários exigidos (o que mudou desde a 1ª rodada):**
- **Balde cheio com contratado não redondo:** com 1 234 567 contratados, o balde lotado tem de valer 0,8 e acender o alerta.
- **Saturação de verdade:** sobra menos que o pedido. A reserva recusada tem de valer 0,8, e o que sobra ainda cabe a um pedido menor, o que prova que a recusa devolveu os tokens.
- **Uso parcial ainda proporcional:** 0,4 com 4 000 de 10 000 e 0,8 no balde cheio, para que a mudança de cálculo não estrague o caso comum.
- **Modelo menor que falha:** o consumo de `falhou` tem de gravar o modelo menor, que recebeu o pedido, e não o do perfil (regra 70, item 6).
- **Concorrência na `ferramenta`:** duas réplicas reservando ao mesmo tempo. Uma é recusada, e a recusada não gasta o balde geral.
- **Redis fora:** o seguro da `ferramenta` (750) recusa primeiro, e depois o do geral (4 000 menos os 750).
- **Tabela e mutações do documento:** linhas novas citando os testes pelo nome, e os blocos de mutação novos e ajustados.

**Cobertos:**
- `packages/core/src/ia/token-limiter.test.ts`:
  - "o contratado que não é redondo…": o bloco novo divide por `Math.ceil(pontos / 0,8)` e dá 0,79999…, então fica vermelho.
  - "a saturação de verdade…": o bloco volta `consumidos` para `consumedPoints - pontos` e dá 0,7996, vermelho. A segunda asserção, o pedido de 4 concedido, prova que a recusa devolveu os tokens.
  - "o uso do teto é a fração…": o bloco tira o `* PARTE_DO_BALDE_GERAL` e o 0,4 vira 0,5, vermelho. Como esse caso usa `toBeCloseTo`, ele também segura o valor por cima, coisa que os `>= 0,8` dos dois casos novos não fazem.
- `packages/core/src/ia/llm-gateway.test.ts` › "o modelo menor que falha…": o bloco remove a linha 354 de `llm-gateway.ts`, e `gasto.modelo` fica no valor da linha 252 (o principal), então o caso fica vermelho. O teste confere o resultado (`modelo: 'menor-padrao'`, `estado: 'falhou'`), e não só que o código rodou.
- `packages/core/src/ia/token-limiter.int.test.ts`:
  - "duas réplicas reservando juntas na `ferramenta`…": corrida de verdade, com `Promise.all` em duas réplicas sobre o mesmo Redis, e asserção sobre o geral depois.
  - O caso do Redis fora foi refeito com os números conferidos.
- O bloco do `if (true)` em `anotarUsoDoTeto` foi atualizado para `horaDoProcessoMs()`. A troca é um rename sem mudança de comportamento.
- A linha "uso do teto cheio" da tabela de testes cita os três casos pelo nome. A linha "configuração" ganhou os testes que faltavam (a busca pelas variáveis que saíram e o `config.test.ts`).
- O `.skip` não aparece, nenhum mock esconde a regra, e o provedor é sempre o `ScriptedAdapter` ou o `LimiteDeMentira`.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `packages/core/src/ia/token-limiter.ts:152`: a recusa vale sempre 0,8 ("cheio para este pedido"). Um pedido grande recusado com o geral pela metade também puxa o gauge para 0,8, porque o gauge guarda a última reserva do modelo. Com o balde de produção (cerca de 2 milhões) e pedidos de milhares de tokens isso quase não acontece, mas falta um caso que documente o comportamento: por exemplo, a `ferramenta` pedindo perto do balde com o geral ocupado pela metade. Vale também levar isso ao ensaio de 5 minutos da 11.0, junto da recomendação do infra-guardian que já está registrada.
2. `token-limiter.ts:136`: o `Math.min(noGeral.consumidos, this.#geral.pontos)` não tem mutação observável. No caminho aceito o consumo nunca passa do balde, e na recusa ele é igual ao balde. Pode sair, ou ficar só como defesa.
3. A tabela do `10_task.md`, linha "réplicas", não cita o caso novo "duas réplicas reservando juntas na `ferramenta`…" de `token-limiter.int.test.ts`. É o único teste que prova, em paralelo, que a recusa da fila não gasta o geral entre réplicas.
4. Na repetição em que a 1ª tentativa vai ao menor e a 2ª ao principal, a linha 354 volta o modelo para o do perfil antes da chamada. Nenhum caso cobre esse caminho, que tem relação com o item de `TODO.md` sobre o custo misturado na D37.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/token-limiter.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/token-limiter.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/token-limiter.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/llm-gateway.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/llm-gateway.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/prd-reengenharia-continuacao/10_task.md`
