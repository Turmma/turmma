# Achados das revisões — `tasks/prd-reengenharia-continuacao/4_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-15 19:33:45 · `tasks/prd-reengenharia-continuacao/4_task.md`

VEREDITO: APROVADO

Tela vista: não. O prompt traz "Fotos da tela: indisponíveis". O diff em `apps/web` é só o módulo de API `ciclo-de-execucao.ts` e o teste dele, sem JSX nem texto novo de tela. Por isso não tentei fotografar. A conferência de tela fica para a validação, mas não há tela alterada para ver.

Estados: ok. A tarefa não cria tela nem estado. O código novo cai em `aparenciaDaFalha` → `'fila'` (`apps/web/src/api/ciclo-de-execucao.ts:121`), que é o aviso com "Tentar de novo" (`QueueAlert`) já existente. O estado de erro está coberto. Carregando, vazio e com dado não mudam.

Acessibilidade: não se aplica, sem JSX novo. O aviso de fila reaproveitado não foi alterado.

Chromebook fraco: sem impacto. A web só perde uma constante local e importa a lista de `@educa/shared`, sem custo em tempo de execução.

Celular: sem tela nova nem alterada, nada a medir a 360 px.

Ação oficial protegida: sim, no que se aplica. A tarefa não toca aprovação de nota nem publicação. A recusa acontece antes do envio ao modelo e sem consumo de IA.

Verificado no código:
- **Mensagem do catálogo:** `packages/shared/src/errors/messages.ts` define `PEDIDO_ACIMA_DO_TETO` como "Não foi possível concluir agora. Tente de novo em instantes.". Está em português do Brasil, não vaza termo técnico e diz o que fazer (item 8).
- **`PASSAGEIROS`:** foi movido de `apps/web` para `packages/shared/src/tutor/passageiros.ts` e exportado em `packages/shared/src/index.ts:871`. O código novo está na lista, a web importa de lá, e não sobrou cópia na web, em `e2e` nem em `docs`.
- **Teste que fixa a lista:** `packages/shared/src/tutor/passageiros.test.ts` existe, conforme a tabela da tarefa.

Bloqueantes: nenhum.

Recomendações:
1. **Teste mal dividido em `apps/web/src/api/ciclo-de-execucao.test.ts` (por volta das linhas 170 a 177).** O novo `it` do teto entrou no meio do `it` "o que passa sozinho vira aviso com 'Tentar de novo'; o que pede mudança vem com a mensagem do catálogo". A asserção das quatro explicadas (`MATERIAL_INSUFICIENTE`, `IA_ORCAMENTO_ESGOTADO`, `NAO_ENCONTRADO`, `CONFLITO` → `'explicada'`) ficou dentro do teste do teto. O primeiro `it` agora só prova o lado "fila", embora o título prometa também o lado "explicada". Nada deixa de rodar, mas a prova ficou sob o título errado. Devolva a asserção das explicadas ao `it` original e deixe o do teto só com as suas duas asserções.
2. **Mensagem repetida.** `PEDIDO_ACIMA_DO_TETO` repete literalmente a de `IA_ENTRADA_INVALIDA`. Isso é coerente com a decisão de tratar como defeito nosso. O teste que exige mensagem em português para todo código continua valendo.

Arquivos relevantes (caminhos absolutos):
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/api/ciclo-de-execucao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/api/ciclo-de-execucao.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/shared/src/tutor/passageiros.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/shared/src/errors/messages.ts

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-15 19:33:55 · `tasks/prd-reengenharia-continuacao/4_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. O diff não toca `Nota`, correção nem lançamento. Todos com autor humano: sim, porque não há caminho novo e os que já existiam não mudaram.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhum fluxo de entrega muda. A tarefa só põe um teto no tamanho do pedido que vai ao modelo, e a recusa acontece antes de qualquer saída de IA.
Supervisão do tutor: ok. No turno recusado, a pergunta do aluno fica gravada em `mensagem_tutor`, sem resposta do Tutor e sem consumo. O professor continua vendo essa pergunta, e não aparece uso do Tutor que ele não veja. A prova está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/teto-de-entrada.int.test.ts`, no primeiro `it`, que confere o `count(*)` de `autor = 'aluno'` igual a 1. A troca recusada também não conta no limite diário do aluno.
Autonomia declarada e visível: sim. Nenhuma declaração de autonomia nem a tela de governança muda.
Bloqueantes: nenhum

Pontos da regra 70 conferidos no diff:
- **Respostas fixas continuam antes do teto.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/llm-gateway.ts:136-140`, o teto só é checado quando `fixa === undefined`. A mensagem com o 188 para assunto delicado (D36) e a recusa de julgamento de texto de aluno no `propor-ferramenta` (D55) saem mesmo com o teto estourado. Há teste e mutação para isso: "a regra fixa não manda nada ao modelo e não passa pelo teto".
- **D55 sem mudança.** Nenhum prompt, campo ou esquema de saída ganhou nota ou conceito. Os sete arquivos de tarefa só recebem `maximoDeTokensDeEntrada`, e o `relatorio-da-correcao.ts` continua só sobre objetiva.
- **Analista (D45 e item 8).** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/shared/src/governanca/analista.ts:51`, a mudança só limita `disciplina.nome` a 80 caracteres. O grupo mínimo de dois professores (`GRUPO_MINIMO_DE_PROFESSORES`) continua, nada passa a ser nominal e não há ranking.
- **Item 7 e regra 20, item 9.** A métrica `ia.pedido_acima_do_teto` leva só o rótulo `tarefa`. O log leva `tipo`, `codigo`, `escolaId`, `execucaoId` e `duracaoMs`, sem aluno, entrada nem prompt, e há teste com mutação para isso. A tarefa não mede comportamento nem infere estado emocional.
- **Tela.** O código novo cai em "Tentar de novo", com a mesma mensagem do catálogo usada nas outras falhas nossas, e o aluno nunca vê o erro cru. A tarefa não muda nenhum texto de tela, e as fotos não estavam disponíveis.

Recomendações:
1. O caso de integração do Tutor confere a pergunta recusada direto no banco. Um caso pela rota que o professor usa para ler a conversa, mostrando a pergunta sem resposta, provaria o item 4 do jeito que o professor a recebe. Não bloqueia, porque o comportamento já existia para as outras falhas de IA.
2. O `max(80)` no `disciplina.nome` do Analista depende de o cadastro já ter imposto esse limite a todo nome gravado. Se algum nome com mais de 80 caracteres entrou antes do limite, a execução do Analista daquela escola falha com `IA_ENTRADA_INVALIDA`. Vale conferir se a coluna no banco tem a mesma restrição. Isso é robustez, não regra 70.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-15 19:34:25 · `tasks/prd-reengenharia-continuacao/4_task.md`

VEREDITO: APROVADO

Caminho quente tocado: IA (o gateway, por onde passam o Tutor e as ferramentas)

Rate limit: ok (a tarefa não mexe no rate limit. A recusa vem antes do orçamento e do envio, e não gasta vaga, troca do aluno nem `consumo_ia`)

Fila e prioridade: ok (sem job novo. A recusa acontece na execução que já roda em segundo plano, e nenhuma rota devolve o 503 de forma síncrona)

Concorrência: protegida (a conta é pura sobre a entrada e não grava nada)

Índice e paginação: ok (sem query nova)

Degradação de IA: ok (`PEDIDO_ACIMA_DO_TETO` está em `PASSAGEIROS`, então a tela mostra "Tentar de novo" com a mensagem do catálogo, nunca o erro cru. A regra fixa do assunto delicado (D36) não passa pelo teto, e o Tutor não conta a troca recusada, como prova `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/teto-de-entrada.int.test.ts`)

Migration: não se aplica. O `.max(80)` em `disciplina.nome` do Analista é só no schema. O único caminho de escrita (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/estrutura/disciplina.repository.ts`, por `CriarDisciplinaRequest`) já limita a 80, então nenhum dado gravado fica inválido.

Métrica e alerta: ok. A métrica `ia.pedido_acima_do_teto` tem só o rótulo `tarefa`, painel, o alerta `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/infra/grafana/alertas/ia-pedido-acima-do-teto.yaml` e o parágrafo no runbook, conferido pela guarda `alerta-tem-runbook`. Rodei os 6 arquivos de teste de unidade da tarefa e os 123 testes passaram. O teste de integração não rodei.

Bloqueantes: nenhum

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/llm-gateway.ts:316`: o `tokensDoPedido` chama o `montarMensagens` inteiro (com `montarPedido` e a junção dos textos), e o adaptador monta tudo de novo logo depois. No Tutor são uns 100 KB a mais por turno, então o custo é baixo. No Analista, o pior caso chega a uns 2,5 MB montados duas vezes. Vale montar as mensagens uma vez só e repassar ao adaptador. Quando a 10.0 reservar tokens pelo pedido real, a mesma estimativa pode ser reaproveitada.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/llm-gateway.ts:288`: o `add(0)` cria a série de cada tarefa em zero quando a instância sobe. Se a primeira recusa vier antes da primeira coleta do Prometheus depois de um restart, a série já nasce em 1 e o `increase()` não a conta. A janela é curta e o log `ia.geracao.pedido_acima_do_teto` registra a recusa do mesmo jeito. Basta uma linha no runbook dizendo isso.
- Com um defeito de teto às 10h, cada "Tentar de novo" do aluno grava uma `execucao_agente` e uma `mensagem_tutor` (a pergunta), mesmo que repetir dê o mesmo resultado. O limite por usuário que já existe segura o volume e o alerta dispara na primeira recusa. Fica registrado para a retro, se a mensagem deve continuar sendo a de erro passageiro.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-15 19:34:29 · `tasks/prd-reengenharia-continuacao/4_task.md`

VEREDITO: APROVADO

A tarefa não cria campo novo de pessoa, rota nova nem envio externo novo. A recusa acima do teto acontece antes de qualquer envio ao modelo e não deixa dado pessoal no log nem na métrica.

Campos pessoais tocados: nenhum. A única mudança de esquema é em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/shared/src/governanca/analista.ts`. Ali o `disciplina.nome` ganhou `.max(TAMANHO_MAXIMO_NOME_DISCIPLINA)` (80, o mesmo limite do cadastro). É nome de disciplina, não dado de pessoa, e a mudança só aperta a validação.

Fora da tabela de dados do docs/lgpd.md: nada. Nenhuma coluna nem migration.

Autorização por objeto: ok. A tarefa não cria rota nem repository. Nenhuma rota devolve `PEDIDO_ACIMA_DO_TETO` como status. O código vai para `execucao_agente.erro`, como dizem `domain.exception.ts:45` e `docs/mvp-contratos.md:38`. A execução continua presa ao contexto do token.

Logs: limpos.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/llm-gateway.ts:181` registra só `evento`, `tipo` (a tarefa), `codigo`, `escolaId`, `execucaoId` e `duracaoMs`. Não registra entrada, prompt nem `alunoId`.
- O teste `llm-gateway.test.ts` › "o log da recusa leva a tarefa, os ids e o código; nunca a entrada nem o prompt" confirma que o prompt e o texto dos trechos ficam fora do log.
- A métrica `ia.pedido_acima_do_teto` tem só o rótulo `tarefa`. Um teste próprio prova que ela não leva escola, execução nem usuário.
- A consulta do runbook (`docs/runbook.md`, seção nova) seleciona só ids, estado e `erro`, nunca a coluna `entrada`.

Auditoria: não se aplica. A tarefa não faz leitura de dado de aluno por coordenação ou rede, exportação, alteração de nota, alteração de permissão nem aprovação de saída de IA.

Envio externo: nenhum novo. A recusa vem depois da validação da entrada (e da checagem de nome de aluno) e antes do orçamento e do envio ao modelo. Não grava `consumo_ia`, e a execução termina `falhou` com o código. Os testes confirmam que o modelo não é chamado, que o orçamento não é consultado e que nenhum consumo é gravado: no gateway, os casos com `adaptador.chamadas === 0` e `consultar` não chamado; na integração, `apps/api/src/ia/teto-de-entrada.int.test.ts`. Nada saiu, então não há registro de envio a fazer.

Seed/fixture: sintético. Os testes usam uma dúvida de Química genérica, "pergunta sintética", ids gerados por `randomUUID` e um UUID fixo de exemplo no gerador. Não aparece nome, e-mail, CPF ou data de pessoa.

Pergunta de fechamento: a resposta continua igual à de antes. O pedido recusado não sai do sistema. O que fica (a pergunta do aluno em `mensagem_tutor` e a `execucao_agente` com o erro) já é coberto pelo arquivo do titular, e nenhum destino externo novo aparece.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/teto-de-entrada.ts:179`: a mensagem de `EntradaSemLimiteError` copia as mensagens de erro do zod. Hoje isso só roda em teste, sobre esquema sintético, e o gateway usa apenas `tokensDoPedido`. Se o gerador vier a rodar em produção, convém tirar o `problema.message` da mensagem e deixar só o caminho do campo e o tipo do erro, porque o zod pode trazer o valor recebido.
- `docs/runbook.md`, item "Depois" da seção nova: o repositório é público. Vale manter explícito que o `TODO.md` recebe só o nome da tarefa e as contagens, sem `escolaId`. O texto atual já diz "só ids e contagens", mas fica melhor dizer "sem id de escola".

Fotos da tela: não vieram. A mudança em `apps/web` é só o módulo de API e o teste dele, e a mensagem na tela é a mesma já usada para os outros erros desse tipo, sem dado de pessoa.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-15 19:34:31 · `tasks/prd-reengenharia-continuacao/4_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

**Escopo.** As subtarefas 4.1 a 4.5 estão feitas. A tarefa não entra no limitador de tokens (10.0) nem na contagem de uso do Tutor (9.0). Os arquivos fora da lista de previstos estão justificados: os inventários fechados de métrica, painel e alerta, a fiação do `medidor` e o `max` na `disciplina.nome` do Analista.

**Tech Spec.** As três divergências estão registradas na `techspec.md` §8 e no `cenarios.md`, e não só no `4_task.md`. São elas: o teto do Analista em cerca de 642 mil tokens, o `.max(TAMANHO_MAXIMO_NOME_DISCIPLINA)` em `analista.ts` e os inventários fechados. A ordem também segue a §8: a recusa do teto vem depois da suspensão da função e antes do orçamento e do envio. A resposta de regra fixa (D36) não passa pelo teto.

**Caminho síncrono.** O 503 só importa se alguma rota o devolver. Conferi as chamadas a `ia.gerar` na API: só `execucao-command.ts:66` e `execucao.scheduler.ts:170` chamam, e as duas rodam dentro do executor, em segundo plano. Assim, `PEDIDO_ACIMA_DO_TETO` só chega ao cliente pelo `execucao_agente.erro`, como dizem `domain.exception.ts`, `error-code.ts` e `docs/mvp-contratos.md`.

**`PASSAGEIROS`.** A lista foi movida para `packages/shared`, sem cópia. A web importa de lá, e não sobrou referência à lista antiga em `apps/web/src`, `e2e` ou `docs`.

Bloqueantes: nenhum

Recomendações:
1. `apps/web/src/api/ciclo-de-execucao.test.ts:176`: a asserção dos códigos que viram `'explicada'` saiu do caso da linha 169 e ficou dentro do caso novo do teto (linha 173). O nome do caso antigo ainda promete "o que pede mudança vem com a mensagem do catálogo", mas ele não verifica mais isso. Volte a linha 176 para o caso da linha 169.
2. `packages/core/src/ia/llm-gateway.ts:177`: `tokensDoPedido` chama `montarMensagens` a cada chamada, e isso inclui gerar o JSON Schema da saída. O adaptador repete o mesmo trabalho logo depois. No Tutor, que chama muito, vale guardar o schema de cada tarefa em memória, ou passar as mensagens já montadas ao adaptador.
3. `packages/core/src/ia/teto-de-entrada.ts:3`: a estimativa usa o formato de mensagens do `openai-compat-adapter`. Se o adaptador Ollama montar as mensagens de outro jeito, o teto passa a medir uma coisa e o envio outra. Vale dizer isso no docblock de `tokensDoPedido`.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/prd-reengenharia-continuacao/4_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/llm-gateway.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/teto-de-entrada.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/api/ciclo-de-execucao.test.ts

## llm-integrator · 1ª rodada · APROVADO · 2026-11-15 19:34:50 · `tasks/prd-reengenharia-continuacao/4_task.md`

VEREDITO: APROVADO

Perfis usados: nenhum novo. A tarefa só põe uma guarda antes da chamada. Os perfis das sete tarefas ficam como estavam, e o código não reclassifica nenhuma. A recusa acontece antes da escolha e do uso do modelo.

Custo estimado por professor/mês: R$ 0. Nenhuma chamada de modelo nova, nem por professor nem por aluno. A recusa não grava `consumo_ia`, não toma o orçamento e não chama o provedor. A conta do teto roda local, estimando caracteres ÷ 4 sobre o pedido já montado. O custo de IA do produto não muda.

Prompt versionado: sim. Nenhum prompt foi tocado e a conta usa o prompt versionado das tarefas.

Validação de schema: sim.
- O teto vem depois do `esquemaDeEntrada` e conta só pedido válido.
- O gerador do pior pedido falha em campo sem `max`, e a tarefa sem esquema fica vermelha.
- A `disciplina.nome` do Analista ganhou `.max(TAMANHO_MAXIMO_NOME_DISCIPLINA)`.

Aprovação humana no caminho: não se aplica. A tarefa só barra pedido, e não produz saída de IA nem decide nada sobre aluno. A regra fixa do assunto delicado (D36) continua sem passar pelo teto, e há teste.

O que conferi:
- Em `llm-gateway.ts:133-138`, a recusa vem depois da entrada e da suspensão, e antes do orçamento e do envio.
- A recusa não grava `consumo_ia`. O log leva só tarefa, `escolaId`, `execucaoId` e código, sem entrada nem prompt (regra 20, item 9).
- A métrica `ia.pedido_acima_do_teto` leva só o rótulo `tarefa`.
- O código `PEDIDO_ACIMA_DO_TETO` está em `LLM_ERROR_CODES`, no `ErrorCode`, em `MENSAGENS_DE_ERRO` e em `HTTP_STATUS_BY_CODE` (503).
- O 503 só é gravado em `execucao_agente.erro`. Nenhuma rota síncrona o devolve, e isso está registrado no comentário de `domain.exception.ts`. Isso responde à pergunta da rodada 6 do `revisao-spec.md`.
- `PASSAGEIROS` saiu da web para `packages/shared/src/tutor/passageiros.ts`, com o código novo, e a web importa de lá.
- O alerta tem runbook (`docs/runbook.md`) e o painel, e o `increase()` está tratado com a série criada em zero.
- Rodei os testes. Passaram as unidades (19 arquivos, 1067 testes: `packages/core/src/ia`, `passageiros`, `ciclo-de-execucao`, `infra/test/alertas.test.ts`, `tools/guardas/alerta-tem-runbook.test.ts`), a integração do Tutor (2 testes, com Postgres e Redis reais, sem provedor pago) e o `tsc` de core, api e web.
- O teste do Tutor mostra o turno `falhou` com `PEDIDO_ACIMA_DO_TETO`, sem resposta nem consumo, e a 60ª troca ainda cabe. O controle com outro aluno e o teto normal conclui.
- Não houve SDK de provedor nem teste que chame provedor pago.

Bloqueantes: nenhum.

Recomendações:
1. `apps/web/src/api/ciclo-de-execucao.test.ts`, por volta da linha 171: o `it` novo foi inserido no meio do `it` antigo ("o que passa sozinho vira aviso com 'Tentar de novo'…"). A asserção das falhas `explicada` (`MATERIAL_INSUFICIENTE` e as outras) caiu dentro do teste do pedido acima do teto. Ela ainda roda, mas sob o título errado. Devolva essa linha ao `it` antigo, antes do `})`.
2. O teto do Analista (642.300 tokens, decidido na spec) é maior que a janela de contexto de qualquer modelo plausível. A guarda fica inerte para essa tarefa, e quem a protege na prática é a reserva do limitador pelo pedido real (10.0). Vale registrar isso na 10.0 e na retro.
3. A tarefa não escreve por extenso o custo por professor/mês, e aqui vale zero por não haver chamada nova. Basta uma linha no relatório da spec dizendo que a guarda não altera a precificação.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-15 19:35:53 · `tasks/prd-reengenharia-continuacao/4_task.md`

VEREDITO: REPROVADO

Cenários exigidos:
- caminho feliz: o pior pedido válido de cada tarefa cabe no teto, e o pedido comum passa;
- borda: o pedido do tamanho exato do teto passa, e um token a menos é recusado;
- borda: a resposta de regra fixa (o aluno num assunto delicado) não passa pelo teto;
- borda: o Tutor recusado pelo teto não gasta a troca do dia (59 perguntas antes, com a 60ª ainda cabendo);
- borda: o gerador falha em cada forma de campo sem limite, quando a tarefa não tem esquema e quando o valor montado não passa no próprio esquema;
- ordem: a recusa vem antes do orçamento e do envio, sem `consumo_ia`;
- privacidade: a métrica leva só a tarefa, e o log não leva a entrada nem o prompt;
- tela: a falha aparece como "Tentar de novo" (`fila`), e a lista `PASSAGEIROS` está fixada;
- operação: o alerta tem runbook, e o 503 está registrado sem caminho síncrono;
- permissão e isolamento: não se aplicam. A tarefa não cria rota, repository nem query; a métrica foi exercida com a escola A e a escola B e não leva escola.
- concorrência: não se aplica. A recusa é uma conta sobre a entrada, sem gravar nada e sem tomar vaga.

Cobertos: todas as linhas da tabela "Testes que provam a regra" têm o teste citado pelo nome, conferido um a um, inclusive cada item separado por vírgula ou ponto e vírgula. Rodei os quatro arquivos de unidade (97 casos verdes) e `apps/api/src/ia/teto-de-entrada.int.test.ts` (2 verdes).
- O caso do Tutor prova a regra de verdade. O `orcamento.repository.ts:53` recusa com `>= 60`, e as perguntas em andamento contam. Se a recusa contasse como troca, a consulta final daria `permitido: false`. O controle com o teto normal conclui.
- A ordem antes do orçamento é provada pela espia `consultar`.
- A fiação do medidor (`ia.module.ts`/`app.module.ts`) é provada pela métrica lida no teste de integração.
- O `@ts-expect-error` está numa pasta que o `tsc` confere (`packages/core/tsconfig.json` inclui `src`).
- Os testes usam o `ScriptedAdapter` ou o adaptador falso, sem provedor pago. Não há `.skip` nem mock de coisa nossa.

Bloqueantes:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/teto-de-entrada.ts:159`, termo `!Object.hasOwn(atual, ultima)`: o motivo dado no lugar do bloco é falso, e o ramo não tem teste. O motivo (`4_task.md:107`) diz que "só o caso da raiz (`o valor que nem passa no próprio esquema é vermelho`) o prova". Não prova:
   - Com o caminho vazio, `ultima` é `undefined`, e o `ultima === undefined` sai com `return false` antes do `hasOwn`.
   - Nenhum caso de `teto-de-entrada.test.ts` chega a um objeto em que o campo recusado não existe. Os casos de `recusaEm` param no nulo, o da lista para no `Array.isArray`, e o da regra cruzada só recusa enquanto `b` existe.
   - Esse termo é o que faz o laço de `piorEntradaDaTarefa` terminar, e hoje nada o exercita.

   **Correção exigida:**
   - Acrescentar o caso "a regra que recusa sempre o mesmo campo opcional: ele é retirado uma vez, e na volta seguinte o gerador fica vermelho". Exemplo: `z.strictObject({ a: z.string().max(3), b: z.string().max(2).optional() }).superRefine((_, c) => c.addIssue({ code: 'custom', path: ['b'], message: 'recusado' }))`, com `toThrow('não passa no próprio esquema')`.
   - Reescrever o motivo para dizer a verdade: a mutação trava em laço síncrono, que o `testTimeout` não interrompe, e por isso não vira bloco; o caso novo é o que exercita o ramo.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/api/ciclo-de-execucao.test.ts:169-177`: o `it` novo entrou no meio do antigo. A asserção das quatro falhas `explicada` ficou no teste do teto, e o título do primeiro `it` promete o que ele não verifica mais. Devolva a linha ao `it` original. Os achados do `llm-integrator` já apontam o mesmo.
- O motivo do `typeof atual !== 'object'` na guarda final (`4_task.md:105`) diz que "o `Object.hasOwn` de um primitivo é falso". Isso não vale para string: `Object.hasOwn('aaa', 'length')` e `Object.hasOwn('aaa', '0')` dão `true`, e aí o `Reflect.deleteProperty` lança `TypeError`. Não se alcança com os caminhos que o zod devolve, mas o texto deve ser corrigido.
- `llm-gateway.test.ts`, caso "a regra fixa não manda nada ao modelo e não passa pelo teto": ele só prova que não lançou e que o adaptador não foi chamado. Vale afirmar também a saída devolvida (a mensagem da regra fixa), para o caso provar o resultado e não só a ausência de erro.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-15 19:51:23 · `tasks/prd-reengenharia-continuacao/4_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (`portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)`)
Bloqueantes: nenhum

As duas recomendações da 1ª rodada que a ordem pedia foram aplicadas:
- **Asserção das falhas "explicada":** voltou ao caso antigo, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/api/ciclo-de-execucao.test.ts:171`. O caso do `PEDIDO_ACIMA_DO_TETO` agora trata só do código novo.
- **Docblock de `tokensDoPedido`:** agora diz que a conta usa as mensagens no formato do `openai-compat-adapter` (`montarMensagens`) e que quem trocar de adaptador precisa conferi-la (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/teto-de-entrada.ts:186-192`).

O resto do diff, conferido:
- **Caso novo do `hasOwn` (`teto-de-entrada.test.ts:162-168`):** chega de fato ao ramo. Na primeira volta, `b` existe e `Reflect.deleteProperty` o retira. Na segunda, o zod recusa `['b']` de novo, a guarda `!Object.hasOwn` devolve `false` e o gerador lança o erro. Sem a guarda, o laço não terminaria. A justificativa no `4_task.md` (laço síncrono, que o `testTimeout` não interrompe) bate com o código.
- **Mensagem de erro (`teto-de-entrada.ts:180`):** trocar `problema.message` por `problema.code` tira do erro o valor recebido, como pede a regra 20, item 9. Nenhum teste nem documento depende do texto antigo: os três `toThrow` só conferem o prefixo `não passa no próprio esquema`.
- **`llm-gateway.test.ts:470-472`:** o caso agora confere que o aluno recebe a mensagem da regra fixa (`turnoDoTutor.falso`), e não só que o modelo não foi chamado. O caso ficou mais forte.
- **`runbook.md`:**
  - A exceção do `increase()` logo depois de um restart está escrita, e a recusa aparece no log `ia.geracao.pedido_acima_do_teto`.
  - O "Depois" agora proíbe registrar id de escola no `TODO.md`, o que está certo porque o repositório é público.
- **`TODO.md` e "Recomendações sem aplicar":** cada recomendação recusada ou adiada tem destino ou motivo.

Recomendações:
- **Comentário em `teto-de-entrada.ts:179`:** diz que a mensagem do zod "pode trazer o valor recebido". Vale citar um caso concreto, ou o `code` do zod que traz isso, para quem vier depois não desfazer a troca achando que é só gosto.
- **`4_task.md:120`:** o parágrafo do `typeof atual !== 'object'` admite que uma string na guarda final faria o `Reflect.deleteProperty` lançar `TypeError`. Os caminhos reais do zod não chegam lá, e o termo continua no código. Fica só o registro: não há caso que prove esse cenário.

## test-engineer · 2ª rodada · APROVADO · 2026-11-15 19:51:26 · `tasks/prd-reengenharia-continuacao/4_task.md`

VEREDITO: APROVADO

**Cenários exigidos:** só o que mudou desde a 1ª rodada. A correção bloqueante cobrava um caso que chegasse ao ramo `!Object.hasOwn(atual, ultima)` de `retirarCampo`, com o motivo reescrito. Vieram também as três recomendações que a ordem mandou aplicar: a asserção das falhas "explicada" de volta ao caso antigo, o motivo do `typeof atual !== 'object'` e a asserção da saída da regra fixa.

**Cobertos:**
- **Correção bloqueante, feita.** O caso novo está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/teto-de-entrada.test.ts`: "a regra que recusa sempre o mesmo campo opcional: ele é retirado uma vez, e na volta seguinte o gerador fica vermelho". Segui o caminho dele em `teto-de-entrada.ts:152-183`:
  - Na 1ª volta, a regra (`superRefine`) recusa `['b']`, `retirarCampo` apaga `b` e devolve `true`.
  - Na 2ª volta, a regra recusa `['b']` de novo. `ultima` agora é `'b'`, então o teste `ultima === undefined` não encerra antes, e o `Object.hasOwn` dá falso. O ramo devolve `false` e sai o erro "não passa no próprio esquema".
  - Sem o termo, `Reflect.deleteProperty` de uma chave que não existe devolve `true` e o laço não termina. O caso chega à cláusula pelo motivo certo.
- **Motivo reescrito.** `4_task.md:122` agora diz a verdade: a mutação vira laço síncrono, que o `testTimeout` não interrompe. Diz também que o caso da raiz não alcança o ramo e cita o caso novo pelo nome.
- **`typeof atual !== 'object'`.** `4_task.md:119` corrigido: o texto explica que uma string quebraria na guarda final (`Object.hasOwn('aaa','0')` dá `true`) e por que os caminhos reais do zod não chegam lá.
- **`ciclo-de-execucao.test.ts`.** A asserção das falhas "explicada" voltou ao caso antigo, "o que passa sozinho vira aviso…".
- **`llm-gateway.test.ts:470-472`.** O teste agora afirma que `saida` é igual a `turnoDoTutor.falso(...)`, além de `adaptador.chamadas === 0`.
- **Execução.** Os três arquivos passam: `npx vitest run` na raiz deu 95 testes verdes. Rodado de dentro de `packages/core`, o `@educa/shared` não resolve. É questão de onde o comando roda, não defeito da tarefa.

**Bloqueantes:** nenhum.

**Recomendações:**
1. O diff troca `problema.message` por `problema.code` na mensagem do `EntradaSemLimiteError` (`teto-de-entrada.ts:180`), para não levar o valor recebido ao texto (regra 20, item 9). Nenhum teste afirma o formato novo. Bastaria trocar o `toThrow` do caso novo por `toThrow('b: custom')`: aí, se voltassem a usar `message`, o teste ficaria vermelho. Não bloqueia, porque o valor é sintético e o gerador só roda em teste.
2. O texto de `docs/runbook.md` e o item novo do `TODO.md` não precisam de teste e estão coerentes.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-15 19:51:26 · `tasks/prd-reengenharia-continuacao/4_task.md`

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
Recomendações: nenhuma nova

- A correção pedida na 1ª rodada foi feita. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/runbook.md:765`, o runbook agora diz que a recusa feita antes da primeira coleta do Prometheus depois de um restart não entra no `increase()` e fica só no log `ia.geracao.pedido_acima_do_teto`.
- O que mais mudou nesta rodada não afeta o horário de aula:
  - **Mensagem de erro do gerador (`teto-de-entrada.ts:180`):** passou a levar só o caminho e o tipo do erro, sem o texto do zod, que pode trazer o valor recebido. Esse código só roda em teste, fora do request.
  - **Testes novos:**
    - O teste do turno do Tutor agora confere a resposta que o aluno recebe quando o pedido passa do teto. Antes ele só conferia que nada falhava.
    - O caso novo do campo opcional recusado sempre chega à conferência que encerra o laço (`retirarCampo`, linha 159) e termina vermelho. Antes nenhum caso chegava a ela.
  - **Remanejamento:** uma conferência mudou de lugar em `ciclo-de-execucao.test.ts`, sem perder nada.
  - **Texto:** linhas novas no `TODO.md` e no `4_task.md`.
- Rodei `teto-de-entrada.test.ts`, `llm-gateway.test.ts` e `ciclo-de-execucao.test.ts`: 95 de 95 passaram.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-15 19:51:41 · `tasks/prd-reengenharia-continuacao/4_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum novo nesta rodada. O diff não toca `Nota`, correção nem schema. Todos com autor humano? Sim, sem mudança desde a 1ª rodada, que foi aprovada.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nada no diff cria saída de IA nova nem muda o estado `pendente` de uma entrega.
Supervisão do tutor: ok. O caso de `llm-gateway.test.ts` agora confere que a mensagem da regra fixa chega ao aluno do jeito certo (`saida` igual a `turnoDoTutor.falso(...)`) mesmo com o teto estourado, e que o modelo não é chamado (`adaptador.chamadas` 0). Antes o caso só provava que nada falhava. Isso reforça o D36 sem abrir caminho invisível ao professor.
Autonomia declarada e visível: sim, sem mudança.

Bloqueantes: nenhum.

Conferência do diff desde a 1ª rodada (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/.processo/ordens/diff-4-r2.patch`):
- **Minhas duas recomendações da 1ª rodada**:
  - A da rota de leitura do professor virou linha no `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/TODO.md` (linha 3708), com dono e motivo. Também está na tabela "Recomendações sem aplicar" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/prd-reengenharia-continuacao/4_task.md`.
  - A do `max(80)` foi recusada com o motivo dado pelo infra-guardian: o único caminho de escrita já limita a 80. Aceito: era recomendação, não bloqueante.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/teto-de-entrada.ts:180`: a mensagem de erro do gerador passa a levar só o `code` do zod, e não mais a `message`, que pode trazer o valor recebido. Não afeta a regra 70 e está a favor da regra 20, item 9.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/teto-de-entrada.test.ts:162`: há um caso novo para a guarda `Object.hasOwn` (a regra que recusa sempre o mesmo campo opcional). Fecha o ponto que o test-engineer tinha levantado. Não afeta a regra 70.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/api/ciclo-de-execucao.test.ts`: uma asserção mudou de caso (de um `it` para o outro), sem mudar o comportamento.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/runbook.md`: o texto passa a dizer que a recusa antes da primeira coleta do Prometheus fica só no log. A instrução de registro no `TODO.md` passa a ser sem id de escola, porque o repositório é público.

Recomendações: nenhuma nova.

## llm-integrator · 2ª rodada · APROVADO · 2026-11-15 19:51:44 · `tasks/prd-reengenharia-continuacao/4_task.md`

VEREDITO: APROVADO
Perfis usados: nenhum novo nesta rodada. O diff não adiciona chamada de modelo. A guarda de teto de entrada recusa antes do adaptador (`adaptador.chamadas` fica em 0). Os perfis das tarefas existentes não mudaram.
Custo estimado por professor/mês: sem mudança em relação à 1ª rodada, cerca de R$ 1,00 (ordem de grandeza, sem medição). Já está registrado no `TODO.md`.
Prompt versionado: sim (nada mudou nesta rodada)
Validação de schema: sim. A entrada é validada pelo esquema da tarefa antes do teto. A mensagem de erro do gerador do pior pedido deixou de repetir a mensagem do zod e passou a dar só caminho e `code`, o que fecha um possível vazamento do valor recebido em erro (regra 20, item 9).
Aprovação humana no caminho: não se aplica. O diff não toca entrega nem nota. No tutor, o teto estourado continua devolvendo a resposta da regra fixa, e agora há asserção disso.

Conferência do diff desde a 1ª rodada:
- A correção que a ordem pediu foi feita: a asserção das falhas `explicada` voltou ao `it` antigo em `apps/web/src/api/ciclo-de-execucao.test.ts`, e o `it` novo ficou só com `PEDIDO_ACIMA_DO_TETO`.
- `packages/core/src/ia/llm-gateway.test.ts:470` agora afirma que a saída do tutor com teto estourado é a da regra fixa, o que prova o D36 com o teto estourado.
- `packages/core/src/ia/teto-de-entrada.ts:179` troca `problema.message` por `problema.code`. O caso novo do campo opcional recusado em `teto-de-entrada.test.ts` cobre o ramo do `Object.hasOwn`.
- Rodei `teto-de-entrada.test.ts`, `llm-gateway.test.ts` e `ciclo-de-execucao.test.ts`: 95 testes passam.
- A mudança no runbook e no `TODO.md` só acrescenta texto. A orientação de registrar sem id de escola em repositório público está correta.
- O comentário novo em `tokensDoPedido` avisa que a conta depende do formato de `montarMensagens` do `openai-compat-adapter`. Isso reduz o risco que apontei antes e não bloqueia.

Bloqueantes: nenhum

Recomendações:
- O teto do Analista (642.300 tokens) é maior que a janela de qualquer modelo plausível e fica inerte. Quem protege é a reserva do limitador na tarefa 10.0. Já está no documento com destino (10.0 e retro).
- A linha no relatório da spec sobre a guarda não alterar a precificação continua pendente para o fechamento. Já está no documento.
- Guardar o JSON Schema por tarefa e montar as mensagens uma vez só ficam para a 10.0. Já registrado.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-15 19:51:48 · `tasks/prd-reengenharia-continuacao/4_task.md`

VEREDITO: APROVADO
Tela vista: não. As fotos estão indisponíveis e a web do ambiente de teste não responde. O diff desta rodada não toca JSX nem texto de tela: em `apps/web` só mudou a ordem de asserções em `ciclo-de-execucao.test.ts`. A tela será vista na validação.
Estados: ok. Esta rodada não altera estado de tela. Pelo código, a falha `PEDIDO_ACIMA_DO_TETO` aparece como `fila`, com "Tentar de novo" e a mensagem do catálogo, nunca como erro cru.
Acessibilidade: não se aplica, porque não há mudança de componente.
Chromebook fraco: não se aplica. Não há mudança de lista, imagem ou upload.
Celular: não se aplica. Não há mudança de layout nem de alvo de toque.
Ação oficial protegida: sim. Nada nesta rodada toca aprovação, nota ou publicação.

Correção da rodada anterior conferida:
- Em `apps/web/src/api/ciclo-de-execucao.test.ts` (linhas 168-177 do diff), a asserção das falhas `explicada` (`MATERIAL_INSUFICIENTE`, `IA_ORCAMENTO_ESGOTADO`, `NAO_ENCONTRADO`, `CONFLITO`) voltou ao `it` antigo.
- O `it` do teto ficou só com as duas asserções que a recomendação pedia: `aparenciaDaFalha` igual a `'fila'` e a mensagem do catálogo.
- A mensagem, "Não foi possível concluir agora. Tente de novo em instantes.", diz ao usuário o que fazer (item 8).

Outras mudanças do diff:
- O ajuste no runbook, as notas de `teto-de-entrada.ts` e os testes do núcleo não chegam ao usuário final.
- A mensagem de erro do gerador do pior pedido passou a usar só o caminho e o código do erro do zod, sem o valor recebido. Isso é melhora de privacidade e não afeta a interface.

Bloqueantes: nenhum.
Recomendações:
- Registrada em `TODO.md`: o caso pela rota de leitura da conversa pelo professor, com a pergunta sem resposta (item 4 da regra 70). Não bloqueia.
- Sem recomendação nova de interface.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/api/ciclo-de-execucao.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/.processo/ordens/diff-4-r2.patch`
