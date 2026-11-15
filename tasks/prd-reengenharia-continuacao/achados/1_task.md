# Achados das revisões — `tasks/prd-reengenharia-continuacao/1_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-15 15:31:41 · `tasks/prd-reengenharia-continuacao/1_task.md`

VEREDITO: APROVADO

**Campos pessoais tocados:** nenhum campo novo e nenhuma migration. A tarefa só muda onde o código vive: o que estava nas closures de `assistente.service.ts`, `ferramentas.service.ts`, `artefato.service.ts` e `analista.service.ts` foi para os comandos registrados. Os dados lidos e gravados são os mesmos de antes: `execucao_agente.entrada`, `mensagem_agente`, `artefato`, `entrega` e o resumo do Analista.

**Fora da tabela de dados do docs/lgpd.md:** nada.

**Autorização por objeto:** ok.
- `paraExecutar(id)` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/ia/execucao.repository.ts:143-152` filtra por escola, ano em curso, id e `solicitadaPor` da sessão. O escopo é o mesmo do `ExecucaoDoPedidoRepository` removido, e agora a busca é pelo id da execução em vez da chave.
- `solicitadaPor` nulo (pessoa anonimizada) não casa com ninguém.
- Execução inexistente, execução de outra tarefa e execução fora do escopo respondem todas `NAO_ENCONTRADO` (`execucao.scheduler.ts`, em `#rodarComando`).
- Cada `preparar` volta a conferir o alcance com os repositories que já existiam: `turmaComDisciplina`, `ArtefatoRepository.porId`, `perguntaDaChave` e `exigirMaterialEmUso`.
- Fiz o teste de trocar o id: o caso "o comando relê a execução pelo id…" (`ia.int.test.ts:868`) prova que a execução de B, a do colega, a de outro ano e a de outra escola no mesmo contexto não são achadas. Ele também tem mutação para cada cláusula do `where`.

**Logs:** limpos. Os comandos novos e o registro não escrevem nenhuma linha de log. O caso "a descrição de um aluno no pedido não vai para execução, consumo, artefato, auditoria, log nem para a resposta" (`assistente.int.test.ts:570`) continua cobrindo o caminho novo do comando.

**Auditoria:** presente. A tarefa não cria nenhuma ação que a regra 20, item 10 mande auditar. A entrega da adaptação continua nascendo `pendente`, sem autor de decisão (`adaptacao.command.ts:51`), e isso está fixado em `entrega.int.test.ts`.

**Envio externo:**
- O conteúdo enviado ao modelo é o mesmo de antes: tema, série e disciplina pelo nome da escola (sem turma e sem pessoa), trechos do material, mensagem e turnos da professora, e agregados do Analista sem professor, turma ou aluno.
- Tudo passa por `ia.gerar` com `execucaoId` e fica registrado em `ExecucaoAgente` e em `consumo_ia`.
- `alunoId` e `turmaId` só vão quando o `preparar` os devolve, e nenhum dos cinco comandos devolve.
- A suspensão é conferida de novo antes de qualquer busca ou chamada ao modelo.

**Seed/fixture:** sintético. Os testes novos usam as fixtures das duas escolas e textos sintéticos. Nos diffs de teste não há CPF, e-mail, telefone, matrícula nem nascimento.

**Pergunta de fechamento:** o código continua respondendo. Nada passou a ser guardado em lugar novo, e o envio externo continua ligado a `execucao_agente` e `consumo_ia` por `execucaoId`.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `apps/api/src/governanca/analista.command.ts:36`: o `preparar` do Analista ignora a execução e não confere de novo, depois do `202`, se quem pediu ainda tem vínculo ativo de coordenação. Hoje o contexto copiado da requisição segura isso e a saída é só agregado, por isso não bloqueia. Na 5.0, quando o contexto passar a ser montado no worker a partir da linha, o caso "vínculo encerrado depois do 202 → `NAO_ENCONTRADO`" precisa existir também para o Analista, como já existe para o Assistente.
2. `apps/api/src/artefato/ferramentas.command.ts:3` importa `contextoDaTarefa` de `assistente/proposta.command.ts`, então um comando depende do outro. Uma peça comum, como `conferencia.ts` ou um `contexto-da-tarefa.ts`, evitaria que mexer na proposta afete a geração. É só organização.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-15 15:31:45 · `tasks/prd-reengenharia-continuacao/1_task.md`

VEREDITO: APROVADO
Caminho quente tocado: IA (o agendador de execução do Assistente, das ferramentas, da adaptação e do Analista)
Rate limit: ok. `IaRequestRateLimit` continua no `POST` de cada service e conta por usuário e por escola no Redis. A tarefa não mexe nele.
Fila e prioridade: ok. A execução continua no `AgenteExecutor` depois do `202`. O campo `fila` dos comandos é só declarado nesta tarefa: as ferramentas e o Assistente ficam em `ferramenta`, o Analista em `normal`, e quem passa a usar o campo é a 5.0.
Concorrência: protegida. A chave de envio idempotente (`gravarPendente`/`daChave`) e o `concluirRodando` condicional na transação da conclusão continuam iguais. O `aoGravar` grava a mensagem na mesma transação do `pendente`.
Índice e paginação: ok. A nova `paraExecutar` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/ia/execucao.repository.ts:143`) busca pela PK `id`, mais escola, ano e pessoa. Devolve uma linha só e não lista nada.
Degradação de IA: ok. Toda chamada passa por `ia.gerar` (o gateway), com `sinal` de prazo e `execucaoId`. A falha vira `falhou` com código, pelo executor, como antes. Nenhum caminho de aluno muda: o Tutor segue pela closure.
Migration: não se aplica
Métrica e alerta: ok. A latência e o erro por execução continuam no executor (`ia.execucao.concluida`/`falhou`). O comando não cria caminho fora dele, e não há alerta novo.
Bloqueantes: nenhum

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/ia/execucao.repository.ts:150`: quando a `entrada` gravada não passa no schema, a função devolve `undefined` e o caso vira `NAO_ENCONTRADO`, igual a uma execução fora do alcance. Isso é defeito de dado, e hoje fica sem nenhum sinal na operação. Vale um contador ou uma linha de log só com ids e tarefa, para separar os dois casos no painel.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/ia/execucao.scheduler.ts:160`: o `#rodarComando` confere de novo a suspensão a cada execução. Hoje o custo é baixo. Na 5.0, com o comando rodando no worker, convém medir quanto essa leitura somada à `paraExecutar` acrescenta à latência da fila `ferramenta` no cenário de carga.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/artefato/conferencia.ts:168`: `exigirMaterialEmUso` usa `systemClock` direto, em vez de um relógio injetado. O problema já existia antes e só mudou de arquivo. Quando a adaptação for para o worker, injetar o relógio deixa testável o caso da licença que vence entre o `202` e a execução.
- O `fila` de `ExecucaoCommand` ainda não é lido por ninguém. A 5.0 precisa de um teste que prove que o Analista (`normal`) não ocupa vaga da `ferramenta` nem da `interativa`. Sem esse teste, o campo fica só como comentário tipado.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-15 15:31:50 · `tasks/prd-reengenharia-continuacao/1_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration nesta tarefa. A `execucao_agente`, a `mensagem_agente`, a `thread_agente` e o `artefato` continuam com `escola_id` e `ano_letivo_id`, e os ids continuam UUID.

Queries verificadas:
- `ExecucaoDaSessaoRepository.paraExecutar` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/ia/execucao.repository.ts:143`): filtra por `escolaId`, `anoLetivoId` e `solicitadaPor`, todos tirados do contexto, além do id. A `entrada` é validada de novo na leitura. Substitui o `ExecucaoDoPedidoRepository` removido com o mesmo escopo, e a conferência da tarefa foi para o agendador.
- `ExecucaoScheduler.#rodarComando`: confere a suspensão de novo e lê a execução no escopo. A de outra tarefa responde `NAO_ENCONTRADO`, igual à inexistente.
- Os comandos (`ferramentas.command.ts`, `adaptacao.command.ts`, `proposta.command.ts`, `analista.command.ts`) só leem por repositories que já tinham escopo do contexto: `TurmaDoProfessorRepository.turmaComDisciplina`, `ArtefatoRepository.porId`, `ConversaRepository.perguntaDaChave` e `.anteriores`, e `AnalistaRepository`. Os ids da `entrada` (`jsonb`, sem FK) são todos relidos por esses repositories.
- Nenhum endpoint passa a aceitar `escolaId` no corpo ou na query. Não há `@Unscoped()` novo.
- O Analista continua montando só agregado da escola do contexto. Não há camada de rede envolvida.

Teste de isolamento: presente e efetivo. Rodei os três casos na integração e passaram.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/ia/ia.int.test.ts:868`: lê a execução da pessoa, a da escola B, a do colega, num contexto de outro ano e num contexto com a escola de B. Sem a cláusula de `escolaId`, a leitura no contexto com a escola de B acharia a execução de A e o teste quebraria. As mutações de cada termo do `where` estão declaradas.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/artefato/artefato.int.test.ts:401`: a entrada gravada passa a citar a turma, a disciplina e o artefato da B. O resultado é `NAO_ENCONTRADO`, sem busca de trechos, sem modelo e sem consumo. Sem a conferência do `preparar`, o teste quebra.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/ia/ia.int.test.ts:980`: cobre a função suspensa, a execução anonimizada e a linha que virou de outra tarefa depois do `202`.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/assistente/proposta.command.ts:57`: a pergunta é relida pela `chaveEnvio`, e não pelo id da execução. O escopo está certo, mas ler por `mensagem_agente.execucao_id = execucao.id` deixaria esse comando igual aos outros, que relêem pelo id.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/governanca/analista.command.ts:127`: o `preparar` não confere de novo se quem pediu ainda é da coordenação depois do `202`. Não vaza dado entre escolas, porque o resumo é da própria escola e só a coordenação o lê, mas fica diferente do que os outros comandos fazem com o vínculo.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-15 15:31:53 · `tasks/prd-reengenharia-continuacao/1_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. Nenhum dos cinco comandos (`ferramentas.command.ts`, `adaptacao.command.ts`, `proposta.command.ts`, `analista.command.ts`) nem o agendador grava em `nota`. Eles gravam só `artefato`, `entrega` pendente, `mensagem_agente` e o resumo do Analista. Todos com autor humano? sim, porque nenhum caminho novo escreve em `Nota`.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok.
- A adaptação continua nascendo como entrega `pendente`, sem autor de decisão, na mesma transação da versão adaptada (`apps/api/src/artefato/adaptacao.command.ts:49-52`, que chama `criarDaVersaoAdaptada`). Esse repositório não mudou e não grava `decidida_por`.
- A geração e a conversa não criam entrega. O caso novo em `apps/api/src/entrega/entrega.int.test.ts` prova as duas coisas: a geração fica com `entregaId: null`, a contagem de entregas não muda, e a adaptada fica `pendente` com `decidida_por` nulo.
- A exceção da D47 não passou para outro agente. O caminho por closure no `ExecucaoScheduler` (`#rodarClosure`) ficou só para o Tutor.

Supervisão do tutor: ok. O Tutor fica fora do escopo e segue pelo caminho de antes, sem mudança.

Autonomia declarada e visível: sim. Nada em `governanca` nem em `agentes` mudou. O "rascunho da professora (autonomia 1)" continua declarado em `ferramentas.command.ts:59-61`.

Os outros pontos da lista:
- **Auditoria (item 6):** sem mudança. O `concluir` grava na transação que conclui a execução, ligado ao `execucaoId`.
- **Supervisão sem vigilância (item 7):** o Analista foi movido do service para o comando sem mudar a lógica. Só agregado, sem dado de aluno nem de professor.
- **D55 (item 8):** nenhum prompt mudou, e os hashes estão presos pelo teste novo `packages/core/src/ia/prompts/prompts-caracterizados.test.ts`. A recusa de corrigir ou dar nota em redação continua coberta pelos casos de `apps/api/src/assistente/assistente.int.test.ts` (linhas 595 e 612).
- **Medir o professor (item 9):** sem ranking. O resumo continua com `recortesNominais` sem número quando há menos de dois professores (`analista.command.ts:91-93`, movido sem mudança). A conversa do professor continua só em `mensagem_agente`.

Rodei os testes ligados à regra e todos passaram:
- `prompts-caracterizados.test.ts`: 8 de 8.
- Os quatro casos de integração filtrados: a caracterização do comando, "nasce pendente" e os dois casos de D55.

Bloqueantes: nenhum.

Recomendações:
1. Até a 2.0, `ExecucaoRequest` (o caminho por closure, em `apps/api/src/ia/execucao.scheduler.ts:42-70`) aceita qualquer `TaskDefinition`, não só a do Tutor. Nada usa isso hoje, mas um agente novo poderia entrar por ali sem comando e sem `preparar` no escopo. A trava "toda tarefa tem comando" já está prevista na 2.0: vale tratá-la como condição da regra 70, item 3, e não só de arquitetura.
2. O `concluir` da adaptação (`adaptacao.command.ts:42-53`) não confere de novo a suspensão da função antes de criar a entrega `pendente`. O código antigo também não conferia, e a entrega nasce pendente de qualquer jeito, então não há violação. Mas seria coerente com o "suspendeu, para" da AIA da adaptação conferir de novo na transação de conclusão.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-15 15:33:03 · `tasks/prd-reengenharia-continuacao/1_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

O que conferi para chegar a esse veredito:

- **Escopo.** O Tutor continua na closure, que é da 2.0. Não entrou job, outbox, worker nem fila de verdade, que são da 3.0 e da 5.0. Três arquivos ficaram fora da lista prevista, e cada um tem motivo:
  - `conferencia.ts` está nas Divergências.
  - `eslint-suppressions.json` e `catraca.test.ts` só baixam a catraca de complexidade, porque a função que tinha supressão saiu de `analista.service.ts`.
  - `guia-do-desenvolvedor.md` descreve a nova forma de agendar uma tarefa.
- **Divergências.** As quatro estão no `1_task.md` e também na `techspec.md` §5, no parágrafo "Como a 1.0 o fez". Nenhuma ficou só na tarefa.
- **Casos de teste.** Todo caso citado na coluna "Caso" existe no arquivo indicado.
- **Código deixado para trás.** Não sobrou referência a `ExecucaoDoPedidoRepository` nem à closure dos cinco chamadores. Também não há `.skip`, `.only`, `any` nem `TODO` nos arquivos alterados.

Recomendações:
1. **`cenarios.md:19` ficou desatualizado.** A linha ainda diz "a entrega do assistente e do artefato nasce `pendente`". A Divergência 2 mudou isso: o Assistente não cria entrega, e o teste prova que a conversa conclui sem entrega. Vale corrigir a linha para quem validar depois não procurar um teste que não existe.
2. **A atividade e o plano dependem do módulo do Assistente.** `apps/api/src/artefato/ferramentas.command.ts:3` importa `contextoDaTarefa` de `../assistente/proposta.command.js`. Ficaria mais limpo se essa função morasse num lugar comum aos dois módulos.
3. **Os comandos leem a entrada gravada por conversão de tipo (`as Extract<ExecucaoInput, …>`).** Isso aparece em `adaptacao.command.ts:33`, `proposta.command.ts:55` e `ferramentas.command.ts:56`. Funciona porque o agendador e o check do banco garantem a tarefa certa. Conferir o campo `tarefa` dentro do próprio comando tiraria a conversão e deixaria cada comando seguro sem depender de quem o chama.
4. **`comRegistro` declara tipos genéricos que nunca são inferidos.** Em `apps/api/src/ia/registro-de-comandos.ts:32`, `<Entrada, Saida, Lido, …>` sobram; basta `<Comando extends ExecucaoCommand<never, never, unknown>>` ou parecido.
5. **O nome do campo `comando` engana.** Em `ExecucaoComComando.comando` (`execucao.scheduler.ts`), o valor é o nome da tarefa, não o comando. `tarefa` seria mais claro.
6. **`FilaDeIa` é um segundo lugar com nomes de fila.** Está em `apps/api/src/ia/execucao-command.ts:5`, à parte do `QUEUE_NAMES` de `packages/shared/src/system/`. Quando a 3.0 puser `ferramenta` em `QUEUE_NAMES`, o tipo daqui deve passar a vir de lá.
7. **O teste de caracterização fixa só `prompt.sistema`.** Em `prompts-caracterizados.test.ts`, as regras comuns e o JSON Schema que o adaptador junta à mensagem de sistema (`openai-compat-adapter.ts:52`) ficam de fora. Uma mudança em `REGRAS_COMUNS` passaria sem trocar a `versao`. Isso é mais da área do `llm-integrator`.

Arquivos principais:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/ia/execucao-command.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/ia/registro-de-comandos.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/ia/execucao.scheduler.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/artefato/ferramentas.command.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/assistente/proposta.command.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/tasks/prd-reengenharia-continuacao/cenarios.md

## llm-integrator · 1ª rodada · APROVADO · 2026-11-15 15:33:51 · `tasks/prd-reengenharia-continuacao/1_task.md`

VEREDITO: APROVADO

Perfis usados: `rapido` em `propor_ferramenta`. `padrao` em `gerar_atividade_objetiva`, `gerar_plano_de_aula`, `adaptar_atividade` e `resumo_do_analista`. A tarefa não muda perfil nenhum, e nenhum caso usa `complexo`.

Custo estimado por professor/mês: a tarefa só troca o jeito de rodar as chamadas, então não há chamada nova nem custo novo. Meu número é uma ordem de grandeza, sem medição: não há consumo de produção no repositório para conferir. A base é um professor ativo com cerca de 30 mensagens no Assistente por mês (`rapido`), 8 gerações de atividade ou plano e 3 adaptações (`padrao`). Dá mais ou menos 41 chamadas por professor por mês, perto de R$ 1,00 por professor/mês (`padrao` a ~R$ 0,10 por chamada, `rapido` a ~R$ 0,01). Isso cabe no teto de IA de R$ 5 por aluno/mês (D39). O Analista é uma chamada `padrao` por pedido da coordenação, na escola e não por professor: uns poucos reais por escola por mês.

Prompt versionado: sim. Os `PROMPT_*` seguem em `packages/core/src/ia/tasks/*`. O teste novo `packages/core/src/ia/prompts/prompts-caracterizados.test.ts` prende o hash e a `versao` de todas as 7 tarefas do catálogo.

Validação de schema: sim.
- A saída passa por `conteudoDoArtefatoSchema`, `conteudoDeAtividadeSchema`, `conteudoDaMensagemDoAgenteSchema` e `conteudoDoResumoDoAnalistaSchema`.
- O resultado gravado passa por `resultadoGravadoSchema` no agendador (`execucao.scheduler.ts:136`).
- A entrada da execução é revalidada em `paraExecutar` (`execucao.repository.ts`).
- Cada erro de saída vira `IA_SAIDA_INVALIDA`, e a execução falha sem gravar nada.

Aprovação humana no caminho: sim.
- Só a adaptação cria entrega, e ela nasce `pendente`, sem autor de decisão, na mesma transação da versão adaptada (`adaptacao.command.ts`).
- A geração conclui com `entregaId: null`, e a conversa do Assistente não cria entrega.
- D55 segue valendo: o caso de pedido de nota em redação continua recusado na proposta.

Bloqueantes: nenhum.

**O que conferi.** Li os 5 comandos, o agendador, o registro, `paraExecutar` e o diff dos services e módulos. Rodei estes testes, todos verdes:
- O typecheck da API.
- `ia.int.test.ts` e `entrega.int.test.ts` (66 testes).
- `artefato.int.test.ts`, `assistente.int.test.ts` e `analista.int.test.ts` (97 testes).
- `prompts-caracterizados.test.ts`, `catraca.test.ts`, `repositories-com-escopo.test.ts` e `architecture.test.ts` (142 testes).

**Isolamento (regra 10).**
- `paraExecutar` filtra por escola, ano letivo, id e `solicitadaPor`, pelo contexto copiado de quem pediu. Uma execução de outra pessoa, outra escola, outro ano ou anonimizada responde `NAO_ENCONTRADO`.
- O `preparar` repete o alcance do `POST` pelos repositories no escopo: turma com disciplina, artefato por id e material da série. Isso vale também para os ids gravados em `jsonb`, que não têm chave estrangeira.
- A suspensão da função é conferida no `POST` e de novo em `#rodarComando`, antes de buscar material ou chamar o modelo.
- Não há SQL fora de repository. O comando do Analista usa o `AnalistaRepository`, que já tinha escopo.

**Conclusão e log.**
- A conclusão roda na transação que fecha a execução (`concluirRodando`). Se o prazo ou a varredura já encerraram a execução, o que foi produzido é desfeito junto.
- Os comandos não escrevem log novo. A linha da execução continua só com ids, tarefa e código (regra 20, item 9).
- O registro de execução (entrada, saída, modelo, tokens, custo) continua no executor e no gateway, sem alteração.
- Os testes seguem com o dublê de provedor, e nenhum chama provedor pago.

**Limites de custo e passos (regra 30).** Não mudam nesta tarefa. A 5.0 leva a execução ao worker.

Recomendações:
- `proposta.command.ts` (`preparar`): a pergunta ainda é achada pela `chaveEnvio` (`perguntaDaChave`), e não pelo id da execução. O escopo está correto, com o join por `execucao_id` e o filtro por pessoa. Quando a 5.0 levar o `preparar` ao worker, vale trocar por uma busca pelo id, para não depender de a chave ser única.
- `guia-do-desenvolvedor.md` e a nota da `techspec.md` §5 já descrevem o comando registrado. A tarefa de custo deve guardar a estimativa acima no relatório, para a precificação não ficar no chute.

## test-engineer · 1ª rodada · APROVADO · 2026-11-15 15:33:53 · `tasks/prd-reengenharia-continuacao/1_task.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz, um por comando:** atividade, plano, adaptação, proposta e resumo do Analista, cada um pela rota.
- **Caracterização:** o hash e a `versao` de cada prompt; a entrega da adaptação nasce `pendente`, sem autor de decisão.
- **`preparar` relê pelo id:** os parâmetros, os tipos, a pergunta e a marca "só conversar" saem do banco, e não do corpo do pedido.
- **Sem alcance depois do `202`:** turma, artefato ou material fora do alcance, vínculo encerrado, pergunta apagada e função suspensa. Em todos, nem busca, nem modelo, nem `consumo_ia`.
- **Isolamento:** a entrada gravada que cita turma, disciplina ou artefato da B, lida no contexto da A. No `paraExecutar`, a execução de B, a do colega, a de outro ano e a escola de B com a pessoa de A.
- **A conclusão confere a saída:** contrato, marca de adaptação, citação entregue, `MATERIAL_INSUFICIENTE`, ordem dos trechos, quantidade padrão, origem que some, conteúdo que não lê como atividade, e a turma da proposta vinda da pergunta.
- **Agendador e registro:** tarefa repetida no registro, tarefa sem comando, resultado validado antes de concluir, entrada de outra tarefa (`IA_ENTRADA_INVALIDA`), chave de outra tarefa (`CONFLITO`), o Tutor pela closure, e a API subindo com os cinco comandos.
- **Analista:** período preso ao ano, ano letivo de outra escola, tetos das listas, habilidade sem descrição, linha sem prova e recorte sem resposta.
- **D55 na proposta**, e o log só com ids.
- **Concorrência:** a mesma chave de envio duas vezes ao mesmo tempo.

**Cobertos:** todos. Cada linha da tabela tem caso citado pelo nome e cada nome existe no código. Conferi os 81 blocos da seção "Mutações" contra o `git diff`. Toda cláusula nova tem bloco ou motivo aceitável:
- `scheduler`: o `#alvoDo` e as duas condições do `#rodarComando`.
- `paraExecutar`: os quatro termos do `where` e os dois `if`.
- Registro: o `has` e o `de`.
- `execucao-command`: cada chave espalhada no pedido ao modelo.
- Os quatro comandos: cada condição, e o registro de cada comando no módulo dono.

Os tipos condicionais e o `.slice` do contexto ficam sem bloco, com motivo, e o motivo procede.

Os testes olham o resultado, e não só se o código rodou: a entrada que o modelo recebeu, o estado e o erro da execução, as contagens de `artefato`, `entrega` e `consumo_ia`, e as colunas `decidida_por` e `decidida_em`. O modelo é sempre falso: nenhum provedor pago. Não há `.skip`, `.only`, `any` nem teste comentado.

A concorrência de verdade, com duas chamadas em paralelo, está em:
- `apps/api/src/assistente/assistente.int.test.ts:515` (`Promise.all` de 4 POSTs)
- `apps/api/src/artefato/artefato.int.test.ts:795` (adaptação)

Os dois agora passam pelo comando registrado.

Rodei e passou tudo:
- `prompts-caracterizados.test.ts`: 8 casos
- `ia.int.test.ts`: 49 casos
- `artefato`, `assistente`, `analista` e `entrega` juntos: 114 casos

**Bloqueantes:** nenhum.

**Recomendações:**
1. **`apps/api/src/ia/ia.int.test.ts`, caso "depois do 202, a função suspensa…":** a asserção sobre `consumo_ia` passa de qualquer jeito, porque o `gerar` falso nunca grava consumo. Quem prova "nem modelo" é o `teste.gerar not.toHaveBeenCalled`. Tire a asserção ou diga isso no comentário.
2. **Vínculo encerrado depois do `202`, na adaptação:** a tabela lista esse item, mas para o `AdaptarAtividadeCommand` só há o caso do artefato da B, que é escopo de escola. O `porId` também filtra por vínculo (`#noAlcance`), e nenhum caso prova isso pelo comando. Do lado das ferramentas, o caso já existe em `apps/api/src/artefato/artefato.int.test.ts:339` ("quem perdeu o vínculo depois do 202 não recebe o artefato"), mas não está citado na tabela. Cite esse caso e acrescente um da adaptação.
3. **Armadilha da retro da F4:** o documento pede a suspensão "pelo repository de suspensão". Os helpers `suspender` (`apps/api/src/artefato/artefato.int.test.ts:63`, `apps/api/src/assistente/assistente.int.test.ts:53`) e o caso de `ia.int.test.ts` gravam por SQL direto. A condição é criada no próprio teste, então o espírito da armadilha está cumprido. Mesmo assim, alinhe o texto do documento ou o helper.
4. **Teste paralelo em `apps/api/src/ia/ia.int.test.ts:724`** ("a mesma chave de envio duas vezes ao mesmo tempo…"): continua passando pela closure, e não pelo comando. Hoje o caminho do comando em paralelo só é provado pelas rotas do Assistente e da adaptação; a geração por ferramenta e o Analista não têm caso em paralelo. Um caso paralelo com `pedirComando` no `describe` novo fecharia isso no nível do agendador, antes de a 5.0 levar a execução ao worker.
5. **Isolamento da proposta:** a turma vem da linha de `mensagem_agente`, e não da `entrada`. Um caso com essa linha apontando para turma ou disciplina da B, lida no contexto da A, completaria a linha "isolamento" para o quinto comando.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/tasks/prd-reengenharia-continuacao/1_task.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/ia/execucao.scheduler.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/ia/execucao-command.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/ia/registro-de-comandos.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/artefato/ferramentas.command.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/artefato/adaptacao.command.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/assistente/proposta.command.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/governanca/analista.command.ts`

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-15 16:07:47 · `tasks/prd-reengenharia-continuacao/1_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nesta rodada. O diff não mexe em schema nem em migration.

Queries verificadas:
- `apps/api/src/assistente/conversa.repository.ts:94-112` (`perguntaDaChave`): o escopo vem de `#dono()`, que dá `escolaId`, `anoLetivoId`, `solicitadaPor` e `threadAgente.usuarioId`, e os joins de `mensagemAgente` e `threadAgente` levam a escola e o ano. Não mudou nesta rodada. O teste novo chega a ele.
- `apps/api/src/artefato/artefato.repository.ts:68` (`comVinculoConfirmadoDoProfessor` na releitura do artefato): não mudou. O teste novo chega a ele.
- `apps/api/src/ia/contexto-da-tarefa.ts`: é uma função pura e não consulta o banco. Só saiu de `proposta.command.ts`, e os dois comandos que a usam importam de `ia/`.
- `apps/api/src/ia/registro-de-comandos.ts:32`: só o genérico de `comRegistro` ficou mais simples. Não tem efeito no escopo.

Teste de isolamento: presente e efetivo.
- `assistente.int.test.ts`, "a pergunta lida é a da própria professora…": quando a pergunta é posta na thread da colega, a execução falha com `NAO_ENCONTRADO` e nada vai à busca nem ao modelo. Se tiro mentalmente `eq(threadAgente.usuarioId, usuarioId)`, a linha passa a ser lida e o caso fica vermelho. Isso está registrado como mutação na `1_task.md`. Quando a pergunta aponta para a turma da colega, quem barra é o `turmaComDisciplina` do `TurmaDoProfessorRepository`, que exige o vínculo da professora com a turma.
- `artefato.int.test.ts`, "o vínculo encerrado depois do 202, na adaptação…": se tiro mentalmente `comVinculoConfirmadoDoProfessor` em `artefato.repository.ts:68`, a adaptação chega ao modelo e o caso quebra. Também está registrado como mutação. O caso grava a condição dentro dele mesmo e apaga o vínculo no `finally`.
- O erro é sempre `NAO_ENCONTRADO`, com `resultado: null`. Nada revela que existe dado de outra pessoa ou de outra escola.

Bloqueantes: nenhum.

Recomendações:
- `apps/api/src/ia/ia.int.test.ts:980-999`: a asserção sobre `consumo_ia` saiu do caso "depois do 202…", e o título perdeu "nem consumo". Mas a linha "sem alcance no `preparar`" da `1_task.md` continua dizendo "sem modelo nem `consumo_ia`". Ou a asserção volta (como `.toBe(consumoAntes)`), ou a linha da tarefa passa a dizer qual caso prova a falta de consumo. Isso não afeta o isolamento: o `gerar` continua afirmado como não chamado.
- O caso "a linha com a turma da colega", em `assistente.int.test.ts`, não tem mutação própria. A única registrada é a de `threadAgente.usuarioId`. Valeria acrescentar uma que tire a exigência de vínculo de `turmaComDisciplina`, para provar que esse caso também falharia sem ela.

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/.processo/ordens/1_task-r2.diff
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/assistente/conversa.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/assistente/proposta.command.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/artefato/artefato.repository.ts

## llm-integrator · 2ª rodada · APROVADO · 2026-11-15 16:07:51 · `tasks/prd-reengenharia-continuacao/1_task.md`

VEREDITO: APROVADO

Perfis usados: sem mudança desde a 1ª rodada. O diff não toca perfil, prompt nem chamada de modelo. Ele só move código, adiciona testes e atualiza a documentação da tarefa.

Custo estimado por professor/mês: sem mudança, cerca de R$ 1,00 (ordem de grandeza, sem medição). A 1ª rodada registrou esse número no `TODO.md`.

Prompt versionado: sim. A caracterização por hash em `packages/core/src/ia/prompts/prompts-caracterizados.test.ts` não mudou.

Validação de schema: sim. O diff não altera nenhum ponto de validação.

Aprovação humana no caminho: sim. A entrega da adaptação segue nascendo `pendente`, e a conversa e a geração concluem sem entrega.

Bloqueantes: nenhum.

O que verifiquei no diff, sem reauditar o que não mudou:

1. **`contextoDaTarefa`**
   - A função saiu de `assistente/proposta.command.ts` para `apps/api/src/ia/contexto-da-tarefa.ts`. O corpo é idêntico e o teto de 60 caracteres foi preservado.
   - Os dois consumidores, `proposta.command.ts:69` e `ferramentas.command.ts:42`, importam do novo arquivo.
   - Não sobrou nenhum outro uso da função. A mudança tira a dependência de `artefato/` para `assistente/`.
2. **`comRegistro`**
   - A assinatura em `registro-de-comandos.ts:32` passou a `Comando extends ExecucaoCommand<unknown, unknown, unknown>`.
   - Os cinco módulos continuam chamando do mesmo jeito (`artefato`, `assistente`, `governanca`).
   - A mudança é só de tipo e não altera o comportamento.
3. **Testes novos**
   - O teste da adaptação com vínculo encerrado depois do 202 prova que o comando confere de novo o alcance. Verifica `NAO_ENCONTRADO`, nenhuma entrada ao modelo, nenhuma busca, e que não surge nova versão nem nova entrega.
   - O teste "a pergunta lida é a da própria professora" cobre a linha que aponta para a thread da colega e a que aponta para a turma da colega. O comentário explica por que o caso de outra escola não existe: a FK composta o impede.
   - As duas mutações novas estão registradas na task: tirar `comVinculoConfirmadoDoProfessor` do repository e tirar `eq(threadAgente.usuarioId, usuarioId)` do `conversa.repository.ts`. Ambas derrubariam os testes correspondentes.
4. **Asserção de `consumo_ia` removida** (`ia.int.test.ts`). O teste usa um comando de teste e nenhum gateway, então o consumo nunca poderia mudar ali e a asserção era vazia. A garantia de "sem modelo" continua em `teste.gerar` não chamado, e cada módulo tem seus testes próprios de consumo.

Recomendações:

- Não são exigidas agora. As recomendações da 1ª rodada estão destinadas à 2.0, 3.0, 5.0 e ao `TODO.md`. As duas de maior peso para a regra 30 são a conferência da suspensão no `concluir` da adaptação e o teto de passos e de custo por execução.
- Quando a 5.0 levar o `preparar` ao worker, a conferência do vínculo de coordenação no Analista deve entrar junto, como a task já prevê.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/ia/contexto-da-tarefa.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/ia/registro-de-comandos.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/artefato/artefato.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/assistente/assistente.int.test.ts`

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-15 16:07:58 · `tasks/prd-reengenharia-continuacao/1_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum alterado nesta rodada. O diff só mexe em testes de integração, num helper de contexto que mudou de arquivo (`apps/api/src/ia/contexto-da-tarefa.ts`), numa assinatura genérica em `apps/api/src/ia/registro-de-comandos.ts:32` e em documentos da tarefa. Os caminhos que aprovei na 1ª rodada continuam como estavam. Todos com autor humano? sim

Decisão autônoma sobre aluno: ausente

Aprovação registrada: ok. Nada mudou no fluxo de entrega. A adaptação continua criando entrega `pendente`. O texto de `cenarios.md:19` agora descreve isso corretamente: a conversa e a geração concluem sem entrega, e só a adaptação cria entrega. A exceção da D47 segue só no Tutor.

Supervisão do tutor: ok, porque o diff não toca o Tutor.

Autonomia declarada e visível: sim, sem mudança.

O que conferi nesta rodada:
- **`apps/api/src/ia/contexto-da-tarefa.ts`**: o código é o mesmo que estava em `proposta.command.ts`, só mudou de lugar. Continua mandando ao modelo apenas a série e a disciplina, sem nome de turma nem de pessoa. `ferramentas.command.ts` e `proposta.command.ts` agora importam dali.
- **Teste novo em `apps/api/src/artefato/artefato.int.test.ts`** ("o vínculo encerrado depois do 202, na adaptação"): prova que, se o vínculo for encerrado depois do 202, não há busca nem chamada ao modelo e não nasce versão nem entrega. A mutação que o acompanha, sobre `artefato.repository.ts:68`, aponta para uma linha que existe.
- **Teste novo em `apps/api/src/assistente/assistente.int.test.ts`** ("a pergunta lida é a da própria professora"): cobre a linha mexida para a thread da colega e a que aponta para a turma da colega. A mutação sobre `conversa.repository.ts:107` também aponta para uma linha que existe.
- **`apps/api/src/ia/registro-de-comandos.ts:32`**: só a assinatura genérica de `comRegistro` mudou, e o registro continua o mesmo.
- **Minhas duas recomendações da 1ª rodada** têm destino escrito em `1_task.md`. A closure do `ExecucaoRequest` vai para a tarefa 2.0 (2.5). A falta de nova conferência da suspensão no `concluir` da adaptação vai para `TODO.md`. Os dois destinos são aceitáveis.

Bloqueantes: nenhum

Recomendações:
- **Asserção de consumo retirada**: `apps/api/src/ia/ia.int.test.ts:980` perdeu a checagem de `consumo_ia` no caso "depois do 202…". O caso ainda confirma que `teste.gerar` não foi chamado, então não há consumo possível, e o assunto é da regra 30, não da minha. Mesmo assim, a linha "sem alcance no `preparar`" de `1_task.md` ainda promete "sem modelo nem `consumo_ia`". O texto ou o teste precisa ser ajustado para os dois dizerem a mesma coisa.
- **Itens prometidos ao `TODO.md` ainda não escritos**: `1_task.md` (seção "Recomendações sem aplicar") manda quatro itens para `TODO.md`, entre eles a minha recomendação sobre o `concluir` da adaptação, mas o `TODO.md` ainda não foi alterado. Eles precisam ser escritos lá antes do commit da tarefa, senão a recomendação se perde.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/.processo/ordens/1_task-r2.diff
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/ia/contexto-da-tarefa.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/ia/ia.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/tasks/prd-reengenharia-continuacao/1_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/TODO.md

## revisor-geral · 2ª rodada · APROVADO · 2026-11-15 16:08:12 · `tasks/prd-reengenharia-continuacao/1_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum
Recomendações:
- Linha "sem alcance no `preparar`" da tabela de testes em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/tasks/prd-reengenharia-continuacao/1_task.md`. Ela ainda promete "sem modelo nem `consumo_ia`" e cita o caso "depois do 202, a função suspensa…" de `apps/api/src/ia/ia.int.test.ts:980`. Só que esse caso perdeu a asserção de consumo, e com razão: o comando de teste não grava consumo, então a asserção era vazia. A falta de consumo continua provada pelos casos de `artefato.int.test.ts` e `assistente.int.test.ts`. Vale dizer na linha quais casos provam o `consumo_ia`, para quem fizer a validação não procurar a prova no `ia.int.test.ts`.

O que conferi neste diff:
- `contextoDaTarefa` foi para `apps/api/src/ia/contexto-da-tarefa.ts` e não tem mais quem o importe de `proposta.command.ts`. A mudança está registrada no `1_task.md`, na `techspec.md` e no `cenarios.md`. O motivo do `.slice` sem mutação acompanhou o arquivo novo.
- O teste novo da adaptação (`artefato.int.test.ts:426`) acerta: o vínculo é encerrado entre o `202` e a execução, e o caso afirma que nada foi ao modelo, que a busca não rodou e que as contagens de `artefato` e de `entrega` não mudaram. A mutação que tira `comVinculoConfirmadoDoProfessor` está declarada.
- O teste novo da proposta (`assistente.int.test.ts:426`) cobre a pergunta posta na thread da colega e a que aponta para a turma dela (`outraTurma`, que é da colega pela fixture). A mutação que tira `threadAgente.usuarioId` está declarada.
- A assinatura genérica de `comRegistro` (`registro-de-comandos.ts:32`) ficou mais simples. Os quatro módulos que a chamam seguem tipados, e o typecheck do carimbo passou.
- Cada recomendação da 1ª rodada tem destino com motivo em "Recomendações sem aplicar". Os destinos são a 2.0, a 3.0, a 5.0 ou o `TODO.md`, e nada do que vai para tarefa futura foi feito agora.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-15 16:08:14 · `tasks/prd-reengenharia-continuacao/1_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. Nesta rodada entraram três coisas: dois testes de integração, a mudança de `contextoDaTarefa` para `apps/api/src/ia/contexto-da-tarefa.ts` sem alteração de conteúdo (o arquivo novo só repassa série e disciplina, sem nome de turma nem de pessoa), e um tipo genérico mais simples em `registro-de-comandos.ts`.

Fora da tabela de dados do docs/lgpd.md: nenhum. Nenhuma migration nem coluna nova.

Autorização por objeto: ok. A rodada reforça o que já valia:
- `apps/api/src/artefato/artefato.int.test.ts`, caso "o vínculo encerrado depois do 202, na adaptação". Se o vínculo acaba entre o 202 e a execução, a resposta é `NAO_ENCONTRADO`: nada vai ao modelo, a busca não roda e não nasce versão nem entrega. Quem prova é a mutação que tira `comVinculoConfirmadoDoProfessor` (`apps/api/src/artefato/artefato.repository.ts:68`).
- `apps/api/src/assistente/assistente.int.test.ts`, caso "a pergunta lida é a da própria professora". A linha que está na thread da colega, ou que aponta para a turma da colega, também é `NAO_ENCONTRADO`, sem busca e sem envio. Quem prova é a mutação que tira `eq(threadAgente.usuarioId, usuarioId)` (`apps/api/src/assistente/conversa.repository.ts:107`). Conferi que a linha existe.
- Não há resposta diferente para "não encontrado" e "sem permissão".

Logs: limpos. Nenhuma linha de log nova no diff.

Auditoria: presente. A rodada não muda nenhuma ação que a regra obriga a auditar.

Envio externo: sem mudança. Série e disciplina vão pelo mesmo `contextoDaTarefa`, agora num lugar só. Os dois casos novos provam que nada chega ao modelo (`entradas` vazio) quando o alcance se perde depois do 202.

Seed/fixture: sintético. Os testes novos usam a fixture de escola do Assistente e textos inventados ("o que é o reagente limitante?").

Bloqueantes: nenhum.

Recomendações:
- `apps/api/src/ia/ia.int.test.ts:980`: o caso perdeu a conferência de `consumo_ia`, e o nome dele perdeu o "nem consumo". A linha "sem alcance no `preparar`" de `tasks/prd-reengenharia-continuacao/1_task.md` ainda promete "sem modelo nem `consumo_ia`" e cita esse caso. Para a regra 20 o que importa continua provado: `teste.gerar` não é chamado, então nada sai para o modelo. Mesmo assim, vale registrar na tarefa por que a conferência saiu, ou tirar o caso dessa linha. Isso fica com o `test-engineer`.
- As recomendações da 1ª rodada estão todas registradas com destino em "Recomendações sem aplicar" de `1_task.md`. A que me cabe é o `preparar` do Analista conferir de novo o vínculo de coordenação depois do 202; ela foi para a tarefa 5.0 e o adiamento é aceitável, porque a saída do Analista é só agregado.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-15 16:08:26 · `tasks/prd-reengenharia-continuacao/1_task.md`

VEREDITO: APROVADO
Caminho quente tocado: IA (fila `ferramenta` e `interativa`, pelo comando). Esta rodada não muda o código de produção que roda no request nem no worker.
Rate limit: ok (o diff não muda)
Fila e prioridade: ok (o diff não muda; o campo `fila` ainda não lido segue com a tarefa 3.0)
Concorrência: protegida. A corrida entre o `202` e a execução agora tem teste também na adaptação (vínculo encerrado) e na proposta (linha trocada para a thread ou a turma da colega). Os dois testes provam `NAO_ENCONTRADO` sem modelo, sem busca e sem versão nem entrega nova.
Índice e paginação: ok (não há query nova)
Degradação de IA: ok (o diff não muda)
Migration: não se aplica
Métrica e alerta: ok (o diff não muda; a linha do executor continua a mesma)
Bloqueantes: nenhum

O diff desta rodada tem três mudanças fora dos testes, e nenhuma muda o comportamento:
- `contextoDaTarefa` mudou de arquivo e agora fica em `apps/api/src/ia/contexto-da-tarefa.ts`.
- A assinatura genérica de `comRegistro` ficou mais simples. É mudança só de tipo.
- O teste de `ia.int.test.ts` perdeu a asserção sobre `consumo_ia`. Ela não provava nada: o `gerar` daquele teste é falso e não passa pelo gateway, então a contagem nunca subiria. O `expect(teste.gerar).not.toHaveBeenCalled()` que ficou prova a mesma regra com mais força.

Recomendações:
- O `1_task.md` (seção "Recomendações sem aplicar") diz que três recomendações vão para o `TODO.md`, mas o arquivo não mudou neste diff e não tem a entrada. São estas: `paraExecutar` vira `NAO_ENCONTRADO` sem sinal, o `concluir` da adaptação não reconfere a suspensão, e o hash dos prompts cobre só `prompt.sistema`. A que pede contador ou log só com ids para o `NAO_ENCONTRADO` silencioso é da minha 1ª rodada. Antes do commit, gravar as três em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/TODO.md`, ou corrigir o destino escrito na tarefa.
- O título do teste de `ia.int.test.ts` agora diz "nem leitura, nem modelo". A linha "sem alcance no `preparar`" da tabela de testes do `1_task.md` ainda promete "sem `consumo_ia`" e aponta para esse teste. Se a prova de consumo nesse caminho for necessária, ela precisa vir de um teste que passe pelo gateway de verdade, como os de `artefato.int.test.ts` e `assistente.int.test.ts`.

Arquivos auditados nesta rodada:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/.processo/ordens/1_task-r2.diff`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/ia/ia.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/ia/contexto-da-tarefa.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/ia/registro-de-comandos.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/artefato/artefato.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/assistente/assistente.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/tasks/prd-reengenharia-continuacao/1_task.md`

## test-engineer · 2ª rodada · APROVADO · 2026-11-15 16:09:11 · `tasks/prd-reengenharia-continuacao/1_task.md`

VEREDITO: APROVADO

Cenários exigidos: os da 1ª rodada (caminho feliz por comando, a releitura pelo id, a falta de alcance no `preparar`, o isolamento, a conferência da saída, o agendador e o registro, o Analista no contexto de quem pediu, a entrega `pendente`, o hash dos prompts). Esta rodada acrescenta dois: o vínculo encerrado depois do `202` na adaptação, e o isolamento da pergunta relida pela proposta (a linha na thread da colega e a linha com a turma da colega).

Cobertos:
- **Vínculo encerrado na adaptação.** `apps/api/src/artefato/artefato.int.test.ts` › "o vínculo encerrado depois do 202, na adaptação…". O vínculo é encerrado no próprio caso, entre o `202` e o `liberar()`. O teste confere o resultado: `falhou`/`NAO_ENCONTRADO`, `entradas` vazio, a busca não chamada, e as contagens de `artefato` e `entrega` sem mudança. O bloco de mutação tira `comVinculoConfirmadoDoProfessor` de `#noAlcance` (`apps/api/src/artefato/artefato.repository.ts:68`). Esse filtro é o que o `porId` do `preparar` usa (`apps/api/src/artefato/adaptacao.command.ts:34`), então o cenário chega à cláusula. Rodei o caso e ficou verde.
- **Isolamento da proposta.** `apps/api/src/assistente/assistente.int.test.ts` › "a pergunta lida é a da própria professora…". São dois casos num laço, cada um com o modelo e as `entradas` próprios. O bloco de mutação tira `eq(threadAgente.usuarioId, usuarioId)` (`apps/api/src/assistente/conversa.repository.ts:107`), e o caso da thread da colega chega a essa linha. O caso da turma da colega cai no `turmaComDisciplina` (`apps/api/src/assistente/proposta.command.ts:54-55`), cuja verificação já tinha bloco na 1ª rodada. Rodei o caso e ficou verde.
- **Asserção de `consumo_ia` retirada de `apps/api/src/ia/ia.int.test.ts:980`.** Está certo: o `gerar` de `comandoDeTeste` (`ia.int.test.ts:845`) nunca grava consumo, então a asserção passava de qualquer jeito. O "nem modelo" continua provado por `teste.gerar` não chamado. A falta de consumo depois do `202` segue provada em `artefato.int.test.ts:409-420` e `:457-472` e em `assistente.int.test.ts:419` e `:464`.
- **Mudanças sem efeito no comportamento.** `contextoDaTarefa` só mudou de arquivo, para `apps/api/src/ia/contexto-da-tarefa.ts`, e o motivo do `.slice` ficou registrado com o caminho novo. A assinatura de `comRegistro` mudou só no tipo. Nenhuma das duas pede teste novo.
- **Documento da tarefa.** As duas linhas da tabela ("sem alcance no `preparar`" e "isolamento") citam os testes novos pelo nome. A seção "Mutações" passou de 81 para 83 blocos, um por cláusula que os testes novos cobrem.
- **Proibições.** Não há `.skip`, teste comentado nem mock de coisa nossa. O modelo continua falso (`comModelo`, `servicoComModelo`), sem provedor pago.

Bloqueantes: nenhum.

Recomendações:
1. A linha "sem alcance no `preparar`" de `tasks/prd-reengenharia-continuacao/1_task.md` ainda diz "sem modelo nem `consumo_ia`" para todos os testes que cita, e o caso de `ia.int.test.ts` já não confere consumo. O texto deveria dizer quais casos provam a falta de consumo: `artefato.int.test.ts` › "a função suspensa depois do 202…" e os de `assistente.int.test.ts`. Dois outros revisores também apontaram isso nos achados, nas linhas 275 e 351.
2. O caso novo da adaptação poderia contar também `consumo_ia` antes e depois, como o vizinho da função suspensa faz. Hoje a falta de consumo só se deduz do modelo não chamado.
3. No caso novo do Assistente, o ramo "a linha com a turma da colega" depende do filtro de vínculo dentro de `TurmaDoProfessorRepository.turmaComDisciplina`. Não há bloco que tire esse filtro e cite este caso. Não é cláusula nova, então não bloqueia, mas um bloco a mais deixaria o ramo provado por ele mesmo.
