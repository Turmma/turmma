# Achados das revisões — `tasks/prd-reengenharia-continuacao/8_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-16 09:48:56 · `tasks/prd-reengenharia-continuacao/8_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. O diff não toca em `Nota`, em `lancadaPor`, nos schemas de `packages/core/src/db`, em `entrega` nem em `governanca`. Todos com autor humano? Sim, porque não há caminho novo.

Decisão autônoma sobre aluno: ausente. Quando a D62 recusa um turno, o resultado é `IA_INDISPONIVEL`. Nenhuma resposta é inventada e nada é decidido sobre o aluno.

Aprovação registrada: ok. A tarefa não cria nenhuma saída de IA nova e não mexe no fluxo de entrega pendente. A exceção da D47 continua só no Tutor: a recusa da D62 vale do mesmo jeito para `propor_ferramenta` e `turno_do_tutor`, e não abre exceção em outro agente.

Supervisão do tutor: ok.
- **Mensagem do 188 (D36):** a resposta de regra fixa é calculada antes da recusa da D62. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/llm-gateway.ts:139-145`, `semModelo` roda antes e `exigirSoberania` só é chamada quando `fixa === undefined`. Assim, o aluno que escreve sobre assunto delicado recebe a mensagem com o 188 mesmo com o provedor não conferido. O teste "a regra fixa não envia nada", com a mutação correspondente, prova isso.
- **Leitura do modelo no turno recusado:** essa segunda leitura não acontece. A limitação está declarada na AIA (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/aia/tutor.md`, item 16) e repete o risco que já foi aceito no item 15 (tarefa 7.0).
- **Quando API e worker divergem:** a API pode estar conferida e o `worker-ia` não. Nesse caso a pergunta fica pendente e cai no corte de 20 s da 7.0, que o item 15 já documenta. Nenhum uso fica invisível ao professor e nenhuma saída de IA chega ao aluno sem passar pelo caminho de sempre.

Autonomia declarada e visível: sim. Não mudou nesta tarefa.

Outros itens do checklist:
- **Itens 6 e 7:** nada novo de vigilância ou inferência emocional. O log `ia.geracao.soberania_recusada` leva só o evento, a tarefa, os ids, o provedor e o código. Não leva entrada nem prompt.
- **Item 8:** não surgiu nenhum campo, prompt ou tela que sugira nota em discursiva ou redação.
- **Item 9:** nada sobre o professor. Incluir `conversa_do_professor` na união exigida do suboperador é contrato com o provedor, não exposição à coordenação.

Bloqueantes: nenhum.

Recomendações:
1. O item 16 da AIA (`docs/aia/tutor.md`) poderia dizer, como o item 15 diz, se o professor vê ou não a pergunta recusada pela D62. Hoje o leitor precisa deduzir isso do item 15.
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/regulacao.md:233` cita a D62 só como exigência de contrato. Vale acrescentar que, desde a 8.0, ela também é conferida no código: na subida, em `packages/core/src/ia/soberania.ts`, e na chamada, no `LLMGateway`. É essa conferência que o dossiê de conformidade (D61) pode mostrar à escola.
3. O runbook manda reiniciar a API e o `worker-ia` ao encerrar um suboperador. Até o reinício, o texto de aluno continua indo ao provedor encerrado. Para a regra 70 isso basta, porque a decisão está no `techspec.md` §5. Fica registrado para a retro: o `privacy-guardian` deve avaliar se um intervalo de nova conferência depois de já conferida fecharia essa janela.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-16 09:49:03 · `tasks/prd-reengenharia-continuacao/8_task.md`

VEREDITO: APROVADO
Tabelas verificadas: nenhuma tabela ou migration nova. A tarefa só lê `suboperador`, que já existia. Ela está entre as exceções declaradas da regra 10, item 1: é tabela da operação, sem `escola_id` e sem `ano_letivo_id` (docblock em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/db/schema/suboperador.ts`). O id dela é UUID.
Queries verificadas: `SuboperadorDaEscolaRepository.vigenteDoProvedor` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/titular/suboperador-da-escola.repository.ts:125-136`).
- Está marcada `@Unscoped` e a justificativa diz o motivo.
- A `chave` vem só da `IA_PROVEDOR_ID` da configuração, por `destinoDoAdaptador(config)` em `soberania.ts:81,144`. Nenhum controller chega a esse método, e nenhuma requisição manda `escolaId` ou `chave`.
- Devolve só quatro campos: `pais`, `vedaTreinamento`, `alcance` e `categorias`. Não devolve contrato, a lista de escolas nem dado de pessoa.
- `daEscola` continua com escopo e não mudou.
- Há um só `@Unscoped` no módulo `titular`, longe do limite de três.
- O `architecture.test.ts` fixa os métodos do repository e a justificativa. Rodei ele junto com `tools/guardas/repositories-com-escopo.test.ts`: os dois passam (118 testes).

Outros pontos conferidos:
- O 503 de `/prontidao` volta só `{ pronta: false }`, que não diz nada sobre escola.
- O log `ia.geracao.soberania_recusada` leva só ids, a tarefa e o provedor.
- Nada desta tarefa chega à camada de rede.

Teste de isolamento: não se aplica como teste novo. A tarefa não cria leitura de dado de escola nem endpoint com escopo. A única leitura nova é da instância, numa tabela sem dono, e a guarda de arquitetura impede que outro método do repository fique sem escopo.
Bloqueantes: nenhum
Recomendações:
- `vigenteDoProvedor` é uma leitura da instância, mas está no `SuboperadorDaEscolaRepository`, que o nome e o docblock apresentam como a leitura da escola do contexto. Vale passar o método para um leitor próprio da operação, ou ajustar o docblock da classe, para o próximo revisor não tomar o `@Unscoped` como desvio do repository da escola.

## llm-integrator · 1ª rodada · APROVADO · 2026-11-16 09:49:36 · `tasks/prd-reengenharia-continuacao/8_task.md`

VEREDITO: APROVADO

Perfis usados: nenhum novo. A tarefa não cria chamada de modelo. Ela só confere a D62 antes das chamadas que já existem. As tarefas mantêm os perfis de antes.

Custo estimado por professor/mês: R$ 0,00 adicionais. A conferência é uma leitura de uma linha em `suboperador`, na subida e a cada 5 s só enquanto a instância não confere. Não há token nem provedor envolvidos.

Prompt versionado: não se aplica. Nenhum prompt foi criado ou alterado.

Validação de schema: não se aplica. A saída dos modelos não mudou. O `levaTextoDeAluno` e o `categoriasEnviadas` são obrigatórios no tipo `TaskDefinition`, e o `tarefas.test.ts` os fixa por tarefa, com o caso `@ts-expect-error`.

Aprovação humana no caminho: não se aplica. A tarefa não gera entrega de agente nem nota. A resposta fixa do assunto delicado (D36, com o 188) continua fora da recusa da D62, porque o `exigirSoberania` fica só no ramo que chama o modelo.

Bloqueantes: nenhum.

O que conferi:
- **Gateway** (`packages/core/src/ia/llm-gateway.ts`):
  - A recusa fica antes do teto, do orçamento e do envio.
  - Sem `soberania` injetada, o valor é "não conferida", então falha fechada.
  - O log leva só evento, tarefa, ids e provedor.
- **Fiação**: existe um único `createLLMGateway` de produção, o de `apps/api/src/ia/ia-do-worker.module.ts`, e ele entrega a `soberania`. A guarda em `apps/api/test/architecture.test.ts` cobre os dois lados.
- **Conferência da subida** (`packages/core/src/ia/soberania.ts`):
  - Cada campo (`pais`, `veda_treinamento`, `alcance`) e cada categoria tem motivo próprio, e as categorias vêm do catálogo de tarefas.
  - O banco fora é falha fechada, e o log usa `summarizeError` e só códigos fixos.
- **Leitura do cadastro**:
  - O método `vigenteDoProvedor` está em `packages/core/src/titular/suboperador-da-escola.repository.ts:454-469`.
  - Tem `@Unscoped` com justificativa e devolve só quatro campos. A tabela `suboperador` não tem `escola_id`.
- **Worker e API**:
  - O `CicloDoWorkerDeIa` só cria o consumidor, a varredura e o batimento depois da conferência.
  - O `/prontidao` responde 503 enquanto a instância não confere.
- **Testes** (rodei os dois conjuntos):
  - Unitários: 229 passam (`soberania`, `llm-gateway`, `tarefas`, `architecture`, `medir-risco-a-vida`).
  - Integração: 20 passam em `soberania-na-subida.int.test.ts`, que para o banco de fato e não chama provedor pago.
- **Categorias declaradas**: batem com os dados que cada tarefa leva, pelo schema de entrada. O Tutor leva a dúvida, o trecho do material e o histórico de acertos e erros do trabalho.
- **Docs**: `docs/runbook.md` traz o procedimento, inclusive o reinício ao encerrar o suboperador. `docs/aia/tutor.md` item 16 traz a limitação, só com a leitura por palavras da D36.

Recomendações:
1. `tools/ia/medir-risco-a-vida.ts:219`: o `soberania: { conferida: true }` fixo é justificado pelo lote sintético e pela D37. Nada no código impede passar um lote real com `--provedor-contratado` (regra 20, item 13). Um aviso ou uma checagem do rótulo do corpus como sintético fecharia isso.
2. `packages/core/src/ia/soberania.ts:127` (`#conferirEAgendar`): se `encerrar()` correr durante uma leitura que dá certo, o código ainda grava `#conferida = true`. Hoje isso não gera consumo, porque os `aguardando` já foram soltos com `false`. Basta checar `#encerrada` depois do `await`.
3. `packages/core/src/ia/soberania.ts:29`: o motivo `sem_provedor_id` está no tipo `MotivoDaD62` e nenhum código o produz. Remover, ou tratar o caso se o `provedorId` puder vir vazio.
4. O runbook diz que o mesmo motivo repetido sai "só a cada minuto", e o código faz isso a cada 12 tentativas de 5 s, o que dá um minuto. Está correto, mas vale citar a constante para não divergir se o intervalo mudar.

Arquivos principais:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/soberania.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/llm-gateway.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/worker.module.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/soberania-na-subida.int.test.ts`

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-16 09:49:44 · `tasks/prd-reengenharia-continuacao/8_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo de pessoa. A tarefa só lê da tabela `suboperador`, que é da operação e não guarda pessoa, quatro campos: `pais`, `vedaTreinamento`, `alcance` e `categorias`. Ficam de fora `contrato`, `registradoPor` e a lista de escolas (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/titular/suboperador-da-escola.repository.ts:775-782`). O que é novo é a declaração `categoriasEnviadas` em cada tarefa. Comparei cada uma com o esquema de entrada da tarefa:
- `turno_do_tutor` leva a dúvida e os turnos (conversa do aluno), os trechos (material da escola) e acertos e erros por habilidade (trabalho do aluno).
- `propor_ferramenta` leva a conversa do professor, o material e, no pior caso, texto de aluno colado na conversa.
- `relatorio_da_correcao` e `resumo_do_analista` levam só agregados, declarados como trabalho do aluno, que é a categoria mais cautelosa.
- `adaptar_atividade` leva a atividade e os tipos de adaptação, sem nada que ligue a um aluno, então nenhum diagnóstico.

Nenhuma categoria declarada fica abaixo do que a tarefa de fato envia.

Fora da tabela de dados do docs/lgpd.md: nada. O mapa já cobre o cadastro do suboperador (linha 107) e as categorias, que vêm da lista fechada `CATEGORIAS_DE_DADO_DO_SUBOPERADOR`.

Autorização por objeto: ok. A tarefa não cria rota com id. `/prontidao` é pública, como já era, e responde só `{ pronta: false }` com 503, sem dado. A leitura `@Unscoped` roda sem requisição, a justificativa está escrita e o teste de arquitetura a fixa como a única do repositório de leitura (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/test/architecture.test.ts:476-486`).

Logs: limpos.
- `ia.geracao.soberania_recusada` leva o tipo da tarefa, o código, `escolaId`, `execucaoId`, `provedorId` e a duração (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/llm-gateway.ts:411`).
- Os logs da subida levam o provedor, a tentativa e os motivos como códigos fixos (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/soberania.ts:146,152`).
- Um teste confere que o log da recusa não traz a entrada, o prompt nem o id do aluno.

Auditoria: presente onde a regra exige. A tarefa não cria leitura de coordenação, exportação, nota, permissão nem aprovação. O cadastro e o encerramento do suboperador já são auditados (`suboperador.cadastrado` e `suboperador.encerrado`).

Envio externo: a mudança só restringe o que sai.
- Com adaptador externo, a tarefa que leva texto de aluno é recusada antes do teto, do orçamento e do envio, sem consumo registrado, se a subida não conferiu um suboperador vigente da `IA_PROVEDOR_ID` com país `BR`, treinamento vedado, alcance `todas` e todas as categorias que as tarefas enviam.
- Se o gateway nascer sem a declaração, ele recusa (falha fechada), e uma guarda em `architecture.test.ts` exige a declaração em todo `createLLMGateway` de produção.
- O `worker-ia` só começa a consumir fila depois de conferido, então nenhuma tarefa sai antes disso, nem as sem texto de aluno.
- A resposta fixa do assunto delicado (D36, o 188) continua saindo sem modelo.
- O registro das chamadas em `ExecucaoAgente`, `consumo_ia.provedor` e o compartilhamento não mudam. A recusa não envia nada e não gera consumo.
- Isso atende a regra 20, item 13, e a D62 passa a ser conferida por código.

Seed/fixture: sintético. O teste de integração grava "Provedor Sintético da D62", com o contrato `DPA-D62` e uma chave aleatória por caso, e apaga tudo no fim.

Bloqueantes: nenhum.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/ia/medir-risco-a-vida.ts:219` fixa `soberania: { conferida: true }` para qualquer `<lote.json>` passado na linha de comando. O esquema do lote aceita só `fonte: 'sintetica' | 'revisor'`, mas nada impede alguém de pôr ali um texto real com o rótulo errado e mandá-lo ao provedor contratado sem a D62. Sugiro aceitar com `--provedor-contratado` só o lote do diretório de fixtures do repositório, ou só `fonte: 'sintetica'`.
2. Depois de conferida, a instância não relê o cadastro. Se um suboperador for encerrado, a conversa do aluno continua indo para ele até alguém reiniciar a API e os `worker-ia`. A spec decidiu assim e o runbook documenta, mas a janela depende de uma pessoa lembrar. Sugiro que `ops:suboperador encerrar` mostre o aviso de reinício quando a chave for a de um provedor de IA, ou que a instância releia o cadastro de tempos em tempos e deixe de ficar pronta se ele foi encerrado.
3. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/aia/tutor.md`, o item 16 aparece antes do item 14, e a lista fica com a ordem 15, 16, 14. É só numeração.

Pergunta de fechamento: sim, o código responde. Esta tarefa reforça a resposta: a lista de categorias de cada tarefa diz o que cada chamada pode ter levado ao provedor, e o compartilhamento já liga cada chamada ao suboperador pela chave.

Rodei os testes de unidade `soberania.test.ts`, `llm-gateway.test.ts` e `tarefas.test.ts`: 151 passaram. Não rodei aqui o teste de integração `soberania-na-subida.int.test.ts`, porque ele precisa do banco e do Redis. Li os casos dele, mas não confirmei o resultado.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-16 09:50:14 · `tasks/prd-reengenharia-continuacao/8_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. Cada divergência registrada no `8_task.md` também está no item "Como a 8.0 ficou" da seção "A D62" em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/prd-reengenharia-continuacao/techspec.md`, e os cenários novos estão na seção 5 de `cenarios.md`. A única linha que não está na Tech Spec é a dos testes de conteúdo que recebem `soberania` conferida. Ela é detalhe de teste e não muda a arquitetura.

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade e alvo)

Bloqueantes: nenhum

Recomendações:
1. **Desligamento do worker.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/worker.module.ts:64-84`, o `CicloDoWorkerDeIa` não guarda que já desligou.
   - Na hora de desligar, o Nest chama primeiro o módulo raiz, e só depois o `IaDoWorkerModule` encerra a `SoberaniaNaSubida`.
   - Se uma leitura do cadastro em andamento terminar conferida entre esses dois passos, a `#consumir()` cria o consumidor das filas, o batimento e a varredura depois do `onApplicationShutdown`, e nada os fecha.
   - A janela é estreita e só existe na saída do processo.
   - Correção sugerida: uma marca `#encerrado` no ciclo, conferida antes de chamar `#consumir()`. Outra opção é a `#conferirEAgendar` (`packages/core/src/ia/soberania.ts:124`) conferir `#encerrada` depois do `await`, antes de marcar a instância como conferida.
2. **Declaração opcional no gateway.** `soberania` é opcional em `LLMGatewayDependencies` e `LLMGatewayPorts` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/llm-gateway.ts:210` e `:318`). Hoje quem garante a fiação é a busca por texto em `architecture.test.ts`, que procura `createLLMGateway(…, {…})`. Se o campo fosse obrigatório, o próprio compilador cobraria. Os testes e a ferramenta de medição já passam o campo, então tornar obrigatório quase não muda código.
3. **Regra no controller.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/system/readiness.controller.ts:137` junta o estado da drenagem e o da D62 dentro do controller. É pouco, mas é regra (regra 00, item 2). Um `prontidao()` composto num provider deixaria o controller só repassando a resposta.
4. **Contagem do aviso no log.** `#deveAvisar` (`soberania.ts:157-161`) usa o total de tentativas, e não as tentativas do mesmo motivo. Com o motivo estável dá "a cada minuto", como o runbook diz. Quando o motivo alterna, a repetição deixa de seguir o intervalo prometido. Basta zerar o contador quando o motivo muda.
5. **Numeração da AIA.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/aia/tutor.md:421`, o item 16 entrou entre o 15 e o 14, e a seção 1.8 fica 13, 15, 16, 14. A troca já vinha da 7.0, mas vale renumerar.
6. **Ferramenta de medição.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tools/ia/medir-risco-a-vida.ts:219` declara a D62 conferida sem conferir nada. Isso está justificado na Tech Spec: o lote é sintético e a medida vem antes do contrato (D37). Ainda assim, convém o `llm-integrator` confirmar que a ferramenta só aceita o lote sintético e não recebe outro lote pela linha de comando.

## infra-guardian · 1ª rodada · REPROVADO · 2026-11-16 09:50:30 · `tasks/prd-reengenharia-continuacao/8_task.md`

VEREDITO: REPROVADO
Caminho quente tocado: tutor | IA | fila | deploy
Rate limit: ok (a tarefa não mexe em rate limit; `/prontidao` continua com `@SkipRateLimit`)
Fila e prioridade: ok (enquanto a D62 não confere, o `worker-ia` não cria consumidor nenhum. Nenhum job de lote foi parar na fila interativa.)
Concorrência: protegida (`iniciar` usa `??=`, então a subida e quem está esperando dividem uma única leitura. Desligar no meio de uma leitura não agenda outra. Nada é gravado, e cada instância lê o próprio cadastro.)
Índice e paginação: ok (a única leitura nova é `vigenteDoProvedor`: uma linha por `chave` com `fim is null`, numa tabela da operação sem `escola_id`, e só na subida)
Degradação de IA: ok no gateway e no worker. A recusa devolve `IA_INDISPONIVEL` antes do orçamento e do envio, o aluno vê "Tentar de novo" (7.0), e a regra fixa do 188 continua respondendo. O problema é a API, descrito abaixo.
Migration: não se aplica
Métrica e alerta: ok, com uma ressalva nas recomendações. O worker parado aparece no alerta `job-interativo-esperando`. O caso descrito no runbook é um procedimento, não um alerta novo.

Bloqueantes:

1. **`/prontidao` da API fica presa à D62.**
   - **Onde:** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/system/readiness.controller.ts:29`, com a fiação em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/ia.module.ts:47-52`.
   - **O que está errado:** a linha é `this.soberania.conferida ? this.drenagem.prontidao() : { status: 503, corpo: { pronta: false } }`. O processo da API nunca monta provedor: `createLLMGateway` e o adaptador só existem no `IaDoWorkerModule` (X6, 5.0). Por isso essa trava não protege nada da D62. O único efeito dela é tirar as duas APIs do balanceamento do Caddy (`health_uri /prontidao`) quando o cadastro do suboperador não cobre a D62. Com isso caem login, prova online, sala e tudo o mais, para as dez escolas, por causa de um problema que é só da IA.
   - **Às 10h:** o operador encerra um suboperador de manhã, e o runbook manda reiniciar só à noite. Se uma API cair por OOM nessa janela, ela não volta. Se as duas caírem, a plataforma inteira fica fora durante a aula. Na noite seguinte, o reinício que o runbook manda já sobe as duas APIs sem prontidão, e a manhã começa sem login. O aluno recebe o 502/503 da borda, sem nenhuma degradação declarada. Isso viola a regra 80, item 4, e a regra inegociável 6 ("o horário de aula é sagrado"). Um deploy que só acrescenta uma categoria em `categoriasEnviadas` causa a mesma queda total.
   - **Correção exigida:** a prontidão da API não depende da `SoberaniaNaSubida`. A conferência continua no `worker-ia`, que não consome, e no gateway, que recusa. Na API ela pode, no máximo, virar log ou métrica. Isso também exige:
     - tirar a `SoberaniaNaSubida` do `IaModule` da API, ou deixá-la só informativa;
     - ajustar os casos "a API só fica pronta com a D62 conferida" em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/soberania-na-subida.int.test.ts`, trocando para "a API fica pronta e o worker não consome";
     - escrever o runbook nessa forma (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/runbook.md:1229-1262`);
     - registrar a divergência com o PRD RF9 e com o `techspec.md` §5 ("a API e o worker não sobem"). Essa revisão de RF9 precisa ir ao Arquiteto, porque a escrita atual da spec é o que leva à queda.

Recomendações:
- O alerta `job-interativo-esperando` (`docs/runbook.md`, seção "Job interativo esperando") podia citar `ia.soberania_na_subida_recusada` e `ia.soberania_na_subida_sem_banco` entre as causas prováveis. Hoje o worker parado pela D62 só é descoberto no log.
- `exigirSoberania` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/llm-gateway.ts:469-477`) só grava log. Um contador `ia.soberania_recusada{tarefa}`, que nasce em zero como o `pedidoAcimaDoTeto`, deixaria a recusa visível no painel. Em produção ela quase não acontece, porque o worker só consome depois de conferido, então isso não bloqueia.
- O runbook manda reiniciar "fora do horário letivo" depois de encerrar um suboperador, mas não diz o que fazer com a IA durante o dia. Na janela entre encerrar e reiniciar, ela continua enviando ao provedor encerrado. Vale escrever que encerrar de dia significa trocar para `LLM_PROCESSAMENTO_LOCAL=true` e reiniciar só os `worker-ia`, que não carregam login nem prova.

## test-engineer · 1ª rodada · APROVADO · 2026-11-16 09:50:57 · `tasks/prd-reengenharia-continuacao/8_task.md`

VEREDITO: APROVADO

**Cenários exigidos (tarefa 8.0, a D62 na subida e no gateway):**
- **Caminho feliz:** provedor externo com o suboperador vigente que cobre tudo. A API fica pronta (200) e o worker consome as três filas.
- **Recusa por campo:** um caso para cada um de `pais`, `veda_treinamento`, `alcance` e vigência (`fim` preenchido).
- **Recusa por categoria:** um caso por categoria faltando. A união exigida é a das tarefas, e não só `conversa_do_aluno`.
- **Isolamento entre provedores:** o suboperador vigente é de outra `IA_PROVEDOR_ID` e cobre tudo. Deve recusar.
- **Banco fora:** com o banco parado de fato, a API não fica pronta, o worker não consome e o log é o do banco.
- **Falso e local:** sobem sem suboperador, com o banco no ar ou fora.
- **Gateway:** recusa antes do orçamento e do envio, lendo a declaração a cada chamada. A tarefa sem texto de aluno passa, e a regra fixa da D36 (o 188) passa mesmo sem conferência.
- **Log:** a recusa sai sem conteúdo nem `alunoId`.
- **`DECLARADO`:** tem os dois lados, `@ts-expect-error` na tarefa sem a declaração, e a coerência entre `levaTextoDeAluno` e `conversa_do_aluno`.
- **Fiação do `createLLMGateway`:** toda chamada de produção entrega a `soberania`.
- **Leitura da conferência:** é a única `@Unscoped` do repositório.
- **Concorrência:** o bootstrap e quem espera a conferência dividem uma leitura só. Desligar no meio de uma leitura não deixa temporizador. A instância que desliga sem ter conferido não cria o consumidor.
- **Recuperação:** corrigido o cadastro, a instância fica pronta sem reiniciar. Depois de conferida, não relê o cadastro, por isso encerrar o suboperador pede reinício.

**Cobertos:** cada uma das 17 linhas da tabela tem o seu teste citado pelo nome, e todos existem:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/soberania.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/soberania-na-subida.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/llm-gateway.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/tasks/tarefas.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/test/architecture.test.ts`

Os parágrafos do runbook e da AIA (item 16) existem e dizem o que o código faz.

Conferi os 36 blocos de mutação contra o `git diff`. Toda cláusula nova tem bloco: os quatro campos, a categoria e a união, os dois termos do `where`, os três termos da guarda do gateway, a ordem antes do orçamento, o ramo da regra fixa, o log, a prontidão, as duas negações do consumo do worker e a fiação no `IaDoWorkerModule`, no `IaModule` e no `AppModule`. Cada bloco cai num caso que alcança a cláusula.

As asserções olham o resultado:
- o status e o corpo de `/prontidao`;
- os consumidores que o BullMQ conhece (`getWorkers`) e o arquivo do batimento;
- as chamadas ao adaptador e os pedidos que o servidor falso recebeu;
- se o orçamento foi consultado e as linhas de consumo;
- as linhas do log.

Não há `.skip` nem teste comentado. O mock é só da leitura do cadastro, nos testes de unidade. O de integração usa o Postgres real e uma porta sem ninguém escutando, o que dá o erro real do driver. Nenhum teste chama provedor pago: são o roteirizado, o servidor falso e um endereço de mentira que nunca é chamado.

Rodei aqui as unidades de `soberania.test.ts`, `llm-gateway.test.ts` e `tarefas.test.ts` (151 casos, verdes) e os casos novos de `architecture.test.ts` (7, verdes). Não rodei o `soberania-na-subida.int.test.ts`, porque ele para o `worker-ia` do compose e mexeria no ambiente dos outros revisores. As mutações dele o portão já provou.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **`apps/api/src/ia/soberania-na-subida.int.test.ts:172`, o caso "o suboperador vigente é de outra IA_PROVEDOR_ID".** Ele é o único teste do termo `eq(suboperador.chave, chave)` e só confere o 503. Com a mutação, o `limit 1` sem ordem devolve qualquer linha vigente. Hoje fica vermelho porque os outros arquivos limpam o que semeiam e rodam em sequência (`fileParallelism: false`). Num banco com sobra de uma execução interrompida, porém, uma linha `alcance = 'lista'` também daria 503, e a mutação passaria. Sugiro exigir também o log com `codigo: 'sem_suboperador_vigente'`, como o caso de vigência já faz: aí a prova não depende do estado do banco.
2. **`apps/api/test/architecture.test.ts`, `gatewaysDeProducaoSemASoberania`.** A expressão regular só reconhece portas escritas como objeto literal. Uma chamada `createLLMGateway(config, portas)` não seria contada e passaria em silêncio. Vale contar toda chamada de `createLLMGateway(` e reprovar a que não casa com a forma reconhecida.
3. **`apps/api/src/ia/soberania-na-subida.int.test.ts:283`.** O comentário diz que a espera de 1,5 s "dá tempo a uma nova conferência", mas o intervalo da API e do worker é de 5 s, então nenhuma nova conferência acontece. Ou o comentário muda, ou o caso espera mais de 5 s. A ausência do consumidor através de várias conferências já está provada na unidade.
4. **`packages/core/src/ia/soberania.ts:29`.** `'sem_provedor_id'` está no tipo `MotivoDaD62` e nunca é produzido, porque `loadLLMConfig` já recusa o provedor externo sem `IA_PROVEDOR_ID`. Também aparece só no tipo, e não no runbook. Sugiro tirar.
5. **As mutações de `aguardarConferida` (os dois `return Promise.resolve`).** Ficam vermelhas por estouro do prazo do caso, uma promessa que nunca resolve. O motivo é o certo, mas lento. Um `expect` com corrida contra um temporizador curto mostraria o mesmo em milissegundos.
6. **Ordem do desligamento no `worker.module.ts:64-84`, só para registro.** Se o `CicloDoWorkerDeIa` desligasse antes da `SoberaniaNaSubida` e uma conferência terminasse nesse intervalo, o `#consumir` criaria o consumidor depois do desligamento. Pela ordem do Nest (o módulo importado desliga primeiro), isso não ocorre, e o caso "externo que desliga sem ter conferido" cobre o caminho comum. Uma guarda `#encerrado` no próprio ciclo tiraria a dependência dessa ordem.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-16 14:51:21 · `tasks/prd-reengenharia-continuacao/8_task.md`

VEREDITO: APROVADO

**Campos pessoais tocados:** nenhum. Esta rodada não tem migration nem coluna nova. A leitura `vigenteDoProvedor` continua devolvendo só quatro campos do cadastro do suboperador (dado da empresa contratada, não de pessoa).

**Fora da tabela de dados do docs/lgpd.md:** nada.

**Autorização por objeto:** ok. Nenhuma rota nova. A `/prontidao` volta ao que era antes da 8.0: é pública, fica fora do rate limit, responde com dado nenhum e a borda não a expõe (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/system/readiness.controller.ts`).

**Logs:** limpos. Os eventos `ia.soberania_na_subida_recusada`, `ia.soberania_na_subida_sem_banco` e `ia.soberania_conferida` levam só `provedorId`, `tentativas`, `codigo` (códigos fixos) e `summarizeError` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/soberania.ts:132`, `:151`, `:157`). O `ia.geracao.soberania_recusada` do gateway leva ids, tipo e provedor, sem entrada nem prompt (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/llm-gateway.ts:191`). Mudou só a conta de quando o log se repete: agora conta as repetições de um mesmo motivo.

**Auditoria:** nenhuma ação desta rodada a exige. Não há leitura de aluno, exportação, nota, permissão nem aprovação de saída de IA.

**Envio externo:** nada passa a sair. A pergunta desta rodada era se tirar a conferência da D62 da API abria caminho para o texto do aluno sair sem ela. Não abre:
- O único `createLLMGateway` de produção fica em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/ia-do-worker.module.ts:44`, só no `main-worker`, e recebe `soberania`. O `AppModule` monta só o `IaModule`, que não tem `LLM_PROVIDER`.
- A guarda de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/test/architecture.test.ts:1563-1572` ficou mais rígida: a chamada com as portas numa variável agora também reprova, em vez de passar sem ser contada.
- A recusa por chamada no gateway (`IA_INDISPONIVEL`, antes do orçamento e do `fetch`) não mudou.
- O motivo `sem_provedor_id` saiu de `MotivoDaD62` sem abrir furo: a configuração já exige `IA_PROVEDOR_ID` fora do processamento local (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/config/llm-config.ts:116`).

**Seed/fixture:** sintético. Os testes cadastram o suboperador por SQL, com chave aleatória, e apagam no fim.

**Bloqueantes:** nenhum.

**O que conferi na rodada nova:**
- A 1ª rodada não deixou correção bloqueante para conferir.
- A decisão A (só o `worker-ia` para) não enfraquece a regra 20, item 13. A conferência continua onde o dado de fato sai: na subida do `worker-ia` e a cada chamada do gateway.
- A marca `#encerrado` no `CicloDoWorkerDeIa` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/worker.module.ts:82`) impede que um consumidor nasça depois do desligamento.
- Uma leitura do cadastro que termina depois do `encerrar` não declara a instância conferida (`soberania.ts`). As duas coisas têm caso de teste e mutação.
- O runbook passou a proibir trocar só `LLM_PROCESSAMENTO_LOCAL=true` com o provedor externo no `LLM_BASE_URL`, o que declararia local um envio para fora. Isso fecha um caminho de contorno da regra 20, item 13 que a versão anterior do runbook sugeria.
- A AIA do Tutor (item 16) diz o que o código faz agora, inclusive que o professor ainda não vê a pergunta que ficou sem resposta. Essa parte fica para a tarefa 9.0.

**Recomendações:**
- O item do `TODO.md` sobre `medir-risco-a-vida.ts` (aceitar só lote sintético com `--provedor-contratado`) segue aberto desde a 1ª rodada. Convém fazê-lo antes de alguém rodar a ferramenta contra um provedor contratado.
- O aviso de reinício no `ops:suboperador encerrar`, também no `TODO.md`, ganhou peso: agora o runbook é o único lugar que lembra que o suboperador encerrado continua valendo até os `worker-ia` reiniciarem.

**Pergunta de fechamento:** o código continua respondendo para onde foi o dado de um aluno. O registro de consumo guarda o `provedorId` de cada chamada, e esta rodada não mexe nisso.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-16 14:51:27 · `tasks/prd-reengenharia-continuacao/8_task.md`

VEREDITO: APROVADO

**Caminhos de escrita em Nota:** nenhum novo nem alterado. O diff entre as árvores `36c57e38` e `720dbefe` não toca `Nota`, correção nem lançamento. Todos com autor humano? Sim, como na 1ª rodada.

**Decisão autônoma sobre aluno:** ausente. A recusa da D62 não decide nada sobre o aluno: ele recebe a falha de sempre, "Tentar de novo", e nenhuma resposta é inventada no lugar (`docs/aia/tutor.md`, item 16).

**Aprovação registrada:** ok. O diff não cria saída de IA nova nem estende a exceção da D47 a outro agente.

**Supervisão do tutor:** ok para esta tarefa, com uma janela declarada. Durante uma falha da D62, as perguntas do Tutor são gravadas e cortadas em 20 s. A supervisão do professor exclui execução `falhou`, então ele não as vê até a tarefa 9.0. A AIA (item 16) registra isso. A 9.0 já existe em `tasks/prd-reengenharia-continuacao/9_task.md` e diz que "o mesmo contador cobre" este caso. A IA não entregou nada ao aluno, e o sinal da D36 por palavras segue no `POST`, antes da fila. Não é uso de IA invisível ao professor.

**Autonomia declarada e visível:** sim. Nada mudou aqui.

**Bloqueantes:** nenhum.

O que a rodada mudou:
- **A API não confere mais a D62.** `IaModule`, `ReadinessController` e `AppModule` voltaram ao que eram, e a `SoberaniaNaSubida` só existe em `apps/api/src/ia/ia-do-worker.module.ts:37` e `apps/api/src/worker.module.ts:55`. É a decisão A do Joaquim, de 16/11, e o RF9 do `prd.md`, o §5 do `techspec.md` e o §5 do `cenarios.md` foram reescritos de acordo.
- **A proteção da regra 70 e da D62 não enfraqueceu.** O gateway continua recusando a tarefa com texto de aluno sem a declaração conferida, antes do orçamento e do envio. O `worker-ia` não consome sem ela. A guarda de fiação em `apps/api/test/architecture.test.ts:1566-1572` ficou mais rígida: agora reprova também a chamada com as portas numa variável.
- **A corrida do desligamento foi fechada nos dois lados.** No ciclo, a marca `#encerrado` em `worker.module.ts:382`. Na conferência, `soberania.ts:644` não se declara conferida depois de `encerrar`. Cada lado tem teste.
- **O runbook não manda mais trocar só `LLM_PROCESSAMENTO_LOCAL=true`** com o provedor externo, o que declararia local um envio para fora (regra 20, item 13). A "Causa 2" e o "Se nada disso resolver" agora mandam não contornar a conferência e avisar a coordenação.
- **AIA do Tutor:** o item 14 voltou à ordem. O item 16 diz o que o código faz agora, com a limitação da D36 (só a leitura por palavras) e a lacuna do professor até a 9.0.

**Recomendações:**
1. **Caso da D62 na tarefa 9.0.** Ela deveria ter um caso com o `worker-ia` parado pela D62. Nele a pergunta é cortada pelo `GET` da execução, não pelo worker. O caso conferiria que o código que fica (`IA_INDISPONIVEL`) está em `PASSAGEIROS`. Assim a contagem "perguntas que o Tutor não respondeu hoje" cobre também esse cenário, que pode durar uma manhã inteira e não só um corte isolado.
2. **Aviso no runbook.** Na seção "A D62 na subida", dizer que, enquanto a 9.0 não pousa, o professor não vê essas perguntas. Essa é uma razão a mais para avisar a coordenação das escolas.
3. **`docs/regulacao.md:233`.** Já está no `TODO.md`, mas continua valendo: dizer que a D62 é conferida no código, junto com o dossiê (D61).

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/.processo/ordens/diff-8-r2.patch`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/worker.module.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/ia-do-worker.module.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/soberania.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/aia/tutor.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/runbook.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/prd-reengenharia-continuacao/9_task.md`

## infra-guardian · 2ª rodada · APROVADO · 2026-11-16 14:51:33 · `tasks/prd-reengenharia-continuacao/8_task.md`

VEREDITO: APROVADO

Caminho quente tocado: IA, fila

Rate limit: ok (esta rodada não mexeu nele)

Fila e prioridade: ok

Concorrência: protegida. Duas corridas novas ficaram fechadas por trava e cada uma tem teste:
- O consumidor não é criado se o worker já foi desligado. A trava `#encerrado` está em `apps/api/src/worker.module.ts:83` e `:90`.
- Uma instância que já encerrou não se declara conferida. A trava está em `packages/core/src/ia/soberania.ts:126-129`.

Índice e paginação: não se aplica (não há query nova)

Degradação de IA: ok. Quando a D62 não está conferida, o `worker-ia` não consome a fila. A pergunta do Tutor é cortada em 20 s pelo `GET` da execução na API, e o aluno vê "Tentar de novo". O gateway recusa com `IA_INDISPONIVEL` sem chamar o modelo, e a resposta fixa do 188 continua funcionando.

Migration: não se aplica

Métrica e alerta: ok. O sinal é o healthcheck do `worker-ia` junto com o "Job interativo esperando" (causa 5, que o runbook ganhou). Nenhum serviço depende de o `worker-ia` estar `healthy` em `infra/compose.yml`, então a borda e a API não ficam presas a ele.

Bloqueantes: nenhum.

A correção exigida na 1ª rodada foi feita:
- `apps/api/src/system/readiness.controller.ts` voltou a depender só da drenagem.
- A `SoberaniaNaSubida` saiu do `IaModule` e do `app.module.ts` da API e ficou só no `IaDoWorkerModule`.
- Os casos de `apps/api/src/ia/soberania-na-subida.int.test.ts` passaram a dizer "a API responde 200 e o worker não consome", com os casos de recusa movidos para o worker.
- `docs/runbook.md` ("A D62 na subida" e a causa 5) foi reescrito nessa forma. Ele proíbe trocar só `LLM_PROCESSAMENTO_LOCAL=true` e manda reiniciar os `worker-ia` sem reiniciar a API.
- O PRD RF9, o `techspec.md` §5 e o `cenarios.md` §5 estão alinhados à decisão de 16/11.

Conferi que os três arquivos não rastreados batem com a árvore auditada (`720dbefe`). Não consegui rodar `packages/core/src/ia/soberania.test.ts` aqui: a suíte cai antes de qualquer teste porque não resolve o pacote `@educa/shared` (falta o build dele). Então a aprovação vem da leitura do diff, e a esteira precisa rodar essa suíte e `apps/api/src/ia/soberania-na-subida.int.test.ts`.

Recomendações:
- Em `apps/api/src/ia/soberania-na-subida.int.test.ts`, o caso "sem suboperador nenhum, ou com o banco fora" junta dois cenários num `it` só. Separar daria uma falha com causa legível.
- Os itens que esta rodada registrou no `TODO.md` seguem valendo como recomendação, sem bloquear:
  - contador `ia.soberania_recusada{tarefa}`;
  - aviso de reinício no `ops:suboperador encerrar`;
  - `soberania` obrigatória em `LLMGatewayDependencies` e `LLMGatewayPorts`;
  - `--provedor-contratado` aceitar só lote sintético;
  - atualizar `docs/regulacao.md:233`.

## llm-integrator · 2ª rodada · APROVADO · 2026-11-16 14:51:33 · `tasks/prd-reengenharia-continuacao/8_task.md`

VEREDITO: APROVADO

Perfis usados: nenhum novo. A tarefa 8.0 não adiciona chamada de modelo. Ela declara `levaTextoDeAluno` e `categoriasEnviadas` nas tarefas existentes e confere a D62 antes da chamada. Os perfis das tarefas não mudaram, e a conferência não consome token.

Custo estimado por professor/mês: zero adicional. A conferência lê só o cadastro `suboperador`, uma vez por subida do `worker-ia`, mais uma leitura a cada 5 s enquanto o cadastro não cobre a D62. O gateway recusa antes do orçamento e do envio, e sem consumo. O custo de IA por professor continua o de cada tarefa já existente.

Prompt versionado: não se aplica. Nenhum prompt foi tocado.

Validação de schema: não se aplica. Nenhuma saída de modelo nova.

Aprovação humana no caminho: não se aplica. A recusa da D62 não decide nada sobre aluno. A resposta fixa do assunto delicado (D36, o 188) não passa por ela.

Bloqueantes: nenhum.

Conferi o diff desde a rodada 1 e a árvore de trabalho, que bate com ele.

- **Decisão A, "só o `worker-ia` para":**
  - A API não monta mais a `SoberaniaNaSubida`. `app.module.ts:116` não passa `config` ao `IaModule`, `ia.module.ts` deixou de a prover e exportar, e `readiness.controller.ts` voltou a só `drenagem.prontidao()`.
  - A API não monta gateway nem provedor, só agenda o job. A guarda `gatewaysDeProducaoSemASoberania` cobre as chamadas de produção.
  - O `worker-ia` não cria consumidor, varredura nem batimento sem a conferência (`worker.module.ts`).
  - O gateway segue recusando a tarefa de aluno sem a declaração, falhando fechado.
- **Correções da 1ª rodada:**
  - O desligamento do worker está tratado nas duas pontas. `#encerrado` no `CicloDoWorkerDeIa` impede o consumidor nascer depois do `onApplicationShutdown`. `soberania.ts` não se declara conferida nem reagenda se encerrou durante a leitura.
  - O motivo morto `sem_provedor_id` saiu do tipo `MotivoDaD62`.
  - O contador de repetição do aviso agora conta por motivo (`#repeticoes`).
  - A guarda de arquitetura passou a contar toda chamada de `createLLMGateway(` e reprovar a de forma não reconhecida.
- **Testes dos caminhos de falha** (todos rodam com provedor de endereço falso, sem chamada paga, regra 30 item 3):
  - A recusa por `pais`, `veda_treinamento`, `alcance`, vigência, por cada categoria faltando e por provedor de outra `IA_PROVEDOR_ID` migrou para o `main-worker`. Cada caso confere zero consumidores, nenhum batimento e o `codigo` no log.
  - A API responde 200 em `/prontidao` com cadastro ruim ou banco fora.
  - Há testes do desligamento do ciclo antes da conferência, do `encerrar` solto, do banco fora e da repetição do log.
- **Rodei** `soberania.test.ts`, `llm-gateway.test.ts`, `tasks/` e `architecture.test.ts`: 826 testes passam. Não rodei o int test do worker, que precisa de Postgres e Redis.
- **Documentação coerente com a decisão:** runbook, AIA do Tutor item 16 e os TODOs registrados. O runbook diz para reiniciar só os `worker-ia`, e o item 16 mantém o risco da D36 explícito.

Recomendações (registradas, não bloqueiam):
- Na infra, confirmar que nenhum `depends_on: service_healthy` do deploy prende a subida inteira a um `worker-ia` esperando a D62. Isso é do `infra-guardian`, que já acompanha a decisão.
- Manter no `TODO.md` os cinco itens abertos: `soberania` obrigatória, o `docs/regulacao.md:233`, o `medir-risco-a-vida` com `--provedor-contratado`, o aviso no `ops:suboperador encerrar` e o contador `ia.soberania_recusada`.
- A pergunta do Tutor com a D62 não conferida espera 20 s até o corte antes de o aluno ver "Tentar de novo". Está documentado na AIA, itens 15 e 16. O contador para o professor ver é da 9.0.

Arquivos relevantes (absolutos), em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/`:
- `apps/api/src/worker.module.ts`
- `apps/api/src/ia/ia.module.ts`
- `apps/api/src/system/readiness.controller.ts`
- `apps/api/src/ia/soberania-na-subida.int.test.ts`
- `packages/core/src/ia/soberania.ts`
- `packages/core/src/ia/soberania.test.ts`
- `apps/api/test/architecture.test.ts`
- `docs/runbook.md`
- `docs/aia/tutor.md`

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-16 14:51:41 · `tasks/prd-reengenharia-continuacao/8_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration nesta rodada. A leitura de `suboperador` não mudou: é a tabela da operação, sem `escola_id`, e o escopo da escola no `daEscola` vem do contexto.

Queries verificadas:
- `SuboperadorDaEscolaRepository.daEscola` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/titular/suboperador-da-escola.repository.ts:70-122`): não mudou. O escopo continua vindo de `requireEscolaId()`, com o `exists` correlacionado à escola do contexto.
- `vigenteDoProvedor` (mesmo arquivo, `:128-139`): só o comentário mudou. Continua `@Unscoped` com justificativa escrita e devolve só país, veto a treinamento, alcance e categorias. Quem chama é só `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/ia-do-worker.module.ts:38`, na subida do `worker-ia`. A API não lê mais esse cadastro: o provider saiu do `IaModule` e do `ReadinessController`. Nenhum endpoint o alcança e nenhum recebe `escolaId` do cliente. `apps/api/test/architecture.test.ts:482-485` garante que o arquivo tem só os dois métodos e que a justificativa do `@Unscoped` está escrita.
- `readiness.controller.ts`, `worker.module.ts` (a flag `#encerrado`), `soberania.ts` (o `#repeticoes` e a volta antecipada depois de `encerrar`) e a guarda de fiação em `architecture.test.ts`: nenhum deles toca dado de escola nem muda escopo.

Teste de isolamento: presente e efetivo. Nesta rodada não há módulo novo nem query nova de escola. O escopo do `daEscola` não mudou e segue coberto pelos testes do F3 e da 8.0 que a 1ª rodada aprovou.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/titular/suboperador-da-escola.repository.ts:46`: o parágrafo novo do docblock (a recomendação da 1ª rodada, agora aplicada) começa com `* * Tem **dois** métodos`. O segundo `*` sobrou e faz a linha virar item de lista. Trocar por ` *` seguido de linha em branco antes do parágrafo, como nos outros.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-16 14:51:51 · `tasks/prd-reengenharia-continuacao/8_task.md`

VEREDITO: APROVADO

Escopo: respeitado. A API voltou ao que era antes da tarefa. `app.module.ts`, `ia.module.ts` e `readiness.controller.ts` não têm diferença em relação ao HEAD. Não há nada da F5 nem da 9.0.

Aderência à Tech Spec: ok. O RF9 do `prd.md`, a §5 do `techspec.md` ("A D62" e "Como a 8.0 ficou") e a §5 do `cenarios.md` dizem o que a árvore faz: só o `worker-ia` confere a D62 e fica parado. A API não tem a `SoberaniaNaSubida`. Encerrar o suboperador pede reiniciar os `worker-ia`, a qualquer hora. As duas linhas novas de divergência do `8_task.md` apontam para a spec: a exportação de `CicloDoWorkerDeIa` e a guarda de fiação com a forma não reconhecida.

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade e alvo).

Bloqueantes: nenhum.

Os seis itens da ordem `.processo/ordens/8_task-r1.md` estão feitos:

1. **A prontidão da API.** Ela não depende mais da conferência. A `SoberaniaNaSubida` saiu do `IaModule`, e os docblocks de `soberania.ts` e de `vigenteDoProvedor` foram corrigidos.
2. **Os casos de integração.** Os casos de recusa por campo, por categoria, de outro provedor e de banco fora passaram a rodar contra o worker. Eles conferem os consumidores do BullMQ, o batimento e o `codigo` do log. A API ganhou casos que provam o 200 com a D62 não conferida.
3. **O runbook.** A seção foi reescrita para o worker parado. A causa 5 de "Job interativo esperando" cita os dois logs da D62. A troca da flag `LLM_PROCESSAMENTO_LOCAL` sozinha agora aparece como proibida, e o texto cita a constante do intervalo de repetição do log.
4. **O `8_task.md`.** Objetivo, subtarefas, arquivos, testes, divergências e mutações foram atualizados.
5. **O consumidor depois do desligamento.** O ciclo ganhou a marca `#encerrado`. A conferência agora olha `#encerrada` depois do `await`. As duas proteções têm caso de teste próprio.
6. **O motivo `sem_provedor_id`.** Saiu do tipo. Ele era código morto, porque `llm-config.ts:116` já exige a `IA_PROVEDOR_ID` com provedor externo.

A conta de repetições por motivo (`#repeticoes`) corrige um defeito real: antes a conta usava as tentativas da instância, e não as do motivo. O caso que prova a correção espera `[1, 2, 13]`.

Recomendações:
- **Autoconferência 4 desatualizada** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/prd-reengenharia-continuacao/8_task.md:85`). Ela ainda cita dois casos de API que foram removidos: "prova o 200 antes de cada recusa" e "corrigido o cadastro, a instância fica pronta sozinha confere o 503 antes do 200". O controle hoje é o caso do worker "corrigido o cadastro, passa a consumir sozinho", com zero consumidores antes. Vale reescrever o item.
- **Asterisco a mais no docblock** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/titular/suboperador-da-escola.repository.ts:46`). A linha começa com `* * Tem **dois** métodos`. Falta uma linha em branco (` *`) antes dela, e sobra o segundo asterisco.
- **Mutação do `app.module.ts`** (`8_task.md`, bloco da mutação de `apps/api/src/app.module.ts`). Ela injeta uma linha que o código nunca teve. Isso prova que o caso pega a dependência voltar, e é o que a ordem pedia. Só que o bloco não segue a forma "tira uma cláusula" que a seção anuncia. Vale uma linha de texto explicando que esse bloco prova uma ausência.

## test-engineer · 2ª rodada · APROVADO · 2026-11-16 14:52:57 · `tasks/prd-reengenharia-continuacao/8_task.md`

VEREDITO: APROVADO

Esta é a 2ª rodada. Auditei só o diff 36c57e38 → 720dbefe e o que ele afeta, seguindo a decisão A do Joaquim (16/11): só o `worker-ia` confere a D62, e a API não. Rodei estes testes, todos verdes:
- `soberania.test.ts` e `llm-gateway.test.ts`: 93 casos
- `soberania-na-subida.int.test.ts`: 21 casos, com Postgres e Redis reais
- os 7 casos de soberania e `@SemEscopo` do `architecture.test.ts`

Não alterei arquivo nenhum.

Cenários exigidos:
- **Caminho feliz:** provedor externo com suboperador vigente que cobre tudo, e o worker consome.
- **Caso novo do RF9 revisto:** com a D62 não conferida (cadastro que não cobre, sem suboperador, ou banco fora), a API responde 200 em `/prontidao` e o worker não consome.
- **Recusa por campo:** `pais`, `veda_treinamento`, `alcance` e vigência, com o motivo no log.
- **Recusa por categoria:** um caso para cada uma das 4 categorias.
- **Outro provedor:** recusa com `sem_suboperador_vigente`.
- **Banco fora:** o log é o do banco, não o da recusa do cadastro.
- **Falso e local:** consomem sem suboperador, e a API dá 200.
- **Cadastro corrigido:** o worker passa a consumir sozinho, sem reiniciar.
- **Desligamento em três ordens:** o app fecha; a conferência encerra sem o ciclo desligar; o ciclo desliga antes de a D62 ser conferida.
- **Leitura que termina depois do `encerrar`:** a instância não se declara conferida.
- **Repetição do log:** conta por motivo, não por tentativa.
- **Fiação:** chamada com as portas numa variável reprova.
- **Permissão e isolamento:** é só leitura da instância, `@Unscoped`, sobre a tabela `suboperador`, que não tem `escola_id`. Não mudou desde a 1ª rodada.

Cobertos:
- **Cada linha da tabela de testes tem caso citado pelo nome**, conferido em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/api/src/ia/soberania-na-subida.int.test.ts`:
  - linhas 137-161: os três casos da API
  - linhas 247-276: as recusas contra o worker, com `exigirParado` e `motivoDaRecusa`
  - linhas 303-325: as duas ordens novas de desligamento
  - linhas 327-335: banco fora com o log certo
- **Cada cláusula nova tem bloco de mutação, e cada bloco cai no caso certo:**
  - `#encerrado` no `CicloDoWorkerDeIa`: dois blocos, um para `conferida &&` e um para `!this.#encerrado`. Cada um cai no caso que isola aquele termo.
  - `if (this.#encerrada) return` antes de `passou`: cai em "a que estava em andamento ao encerrar". O caso novo, que devolve `cobre()` depois do `encerrar`, verifica `conferida === false`, o `aguardarConferida` resolvido com `false` e nenhum `logger.info`.
  - `#repeticoes = 1`: o caso espera `[1, 2, 13]`. Distingue o código novo do antigo (que daria `[1, 2, 12]`) e da mutação (que daria `[1, 2]`).
  - `'sem_suboperador_vigente'` → `'alcance_nao_e_todas'`: cai no caso "outro provedor", que agora verifica o motivo.
  - Guarda de fiação com `portas !== null &&`: cai no caso `emVariavel`.
  - Prontidão da API: a mutação faz o `GracefulShutdown` devolver 503 quando o provedor é externo. Conferi que o campo usado existe em `packages/core/src/config/llm-config.ts:129`, então a mutação chega à cláusula.
- **`sem_provedor_id` saiu do tipo `MotivoDaD62` sem perder cobertura:** esse ramo não tem como acontecer, porque `llm-config.ts:116` já recusa provedor externo sem `IA_PROVEDOR_ID` antes da subida.
- **Sem `.skip`, sem mock que esconda a regra, sem provedor pago:** o endereço do provedor é de mentira e a subida só lê o cadastro.

Bloqueantes: nenhum.

Recomendações:
1. Em `tasks/prd-reengenharia-continuacao/8_task.md`, a linha "recusa por campo" cita um caso de `soberania.test.ts` chamado "um campo errado, …, é o único motivo", que não existe. O nome real é "cada campo errado ao mesmo tempo aparece, e nenhum esconde o outro" (`soberania.test.ts:49`). A citação já vinha da 1ª rodada; vale só corrigir o texto.
2. Três casos provam que algo não acontece esperando com relógio real, de 500 ms a 1,5 s: `soberania-na-subida.int.test.ts:309`, `:322` e `:330`. Com o código certo eles passam mesmo com a máquina carregada, então não é bloqueante. A fraqueza é outra: com a máquina carregada, uma mutação pode não ser pega a tempo. O ideal é esperar um sinal (por exemplo, o `aguardarConferida` já resolvido) em vez de um tempo fixo.
3. Opcional: para fixar a decisão A pela estrutura, e não só pelo comportamento, um caso do lado da API poderia verificar que a `SoberaniaNaSubida` não está montada na API, com `app.get(SoberaniaNaSubida, { strict: false })` lançando erro. O 200 com provedor externo já prova a regra.
