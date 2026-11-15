# Achados das revisões — `tasks/prd-reengenharia-continuacao/2_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-15 18:13:42 · `tasks/prd-reengenharia-continuacao/2_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration nesta tarefa. As tabelas já existentes que a tarefa toca (`mensagem_tutor`, `sinal_tutor`, `execucao_agente`, `atividade_aplicada`, `vinculo`) continuam sendo lidas e gravadas com `escolaId` e `anoLetivoId` tirados do contexto.

Queries verificadas:
- `TutorDoAlunoRepository.perguntaDaExecucao` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/tutor/tutor.repository.ts:332`): filtra por `#doAluno()` (escola, ano em curso e aluno, todos do token), mais `autor = 'aluno'` e `execucaoId`. Substitui a `perguntaDaChave` e não perde escopo, porque o filtro por `mensagem_tutor.aluno_id` da sessão faz o papel do antigo `execucao_agente.solicitada_por`.
- `TurnoDoTutorCommand.preparar` e `concluir` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/tutor/turno.command.ts`): só usam o repository, nunca acessam tabela direto. O alcance é conferido de novo pelo `AlcanceDoAluno` (turma, atividade e material da turma, todos no escopo do contexto). A turma vem da pergunta gravada e é confrontada com a turma atual, e `alunoId` vem de `requestSessao()`.
- `#encaminhar` em transação própria (D36): `gravarResposta`, `tirarReferenciaDaPergunta` e `gravarSinal` continuam com o escopo do contexto copiado de quem pediu.
- `ExecucaoScheduler.agendar` e `#rodarComando`: o caminho por closure saiu. A execução é relida pelo repository com escopo, e a tarefa lida precisa bater com a do comando.
- Nenhum endpoint novo, e nenhum `escolaId` vindo do corpo ou da query.
- `@Unscoped()`: só a ocorrência que já existia em `execucao.repository.ts:66`, com justificativa, e esta tarefa não a mexe.
- Camada de rede: esta tarefa não toca consulta agregada.

Teste de isolamento: presente e efetivo. Está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/tutor/tutor.int.test.ts`, no caso "o comando relê a pergunta pelo id da execução, no escopo do aluno". Ele confere que o `preparar` e o `perguntaDaExecucao` respondem `NAO_ENCONTRADO` ou `undefined` para a execução do colega da mesma turma e para a de outra escola, sem nenhum trecho lido. Se a cláusula `#doAluno()` for removida do `perguntaDaExecucao`, a pergunta do colega e a da outra escola passam a ser achadas e o teste quebra. As duas origens dão a mesma resposta, a do inexistente.

Bloqueantes: nenhum.

Recomendações:
- O comentário do `perguntaDaExecucao` (`tutor.repository.ts:328-331`) promete que a execução de outro ano não casa, mas nenhum teste cobre esse caso. Vale incluir no mesmo `it` uma execução de 2025 do próprio aluno, que deve responder como inexistente, como já faz o `assistente.int.test.ts:300-304` para a `perguntaDaChave`.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-15 18:14:08 · `tasks/prd-reengenharia-continuacao/2_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. O diff não toca `Nota` nem `lancadaPor`. Todos com autor humano? Sim, nada mudou nesse ponto.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. A tarefa só põe o turno do Tutor num comando registrado. A exceção D47 continua só no Tutor. A única tarefa que fica sem comando é o `relatorio_da_correcao`, e não por exceção de aprovação: nenhum arquivo da API a chama, e um teste prova isso.

Supervisão do tutor: ok.
- A resposta continua gravada em `mensagem_tutor`, e os sinais continuam sem texto.
- O aviso de assunto delicado (`atencao_humana`, D36) agora grava numa transação própria. Fica gravado mesmo com prova aberta, com a execução já encerrada ou com os sinais de aprendizagem suspensos (`apps/api/src/tutor/turno.command.ts:244`, `:254-262`).
- O texto livre do modelo nunca chega ao aluno nesse caso. A tarefa troca a resposta pela mensagem fixa antes de gravar (`packages/core/src/ia/tasks/turno-do-tutor.ts:663`), e `tutor-modelo.int.test.ts` confere que a resposta gravada é a mensagem fixa.
- A pausa durante avaliação se confere duas vezes: antes de chamar o modelo (`turno.command.ts:210`) e de novo ao gravar a resposta (`:248`).
- Ao rodar, o comando confere de novo o que o aluno alcança: vínculo encerrado, pergunta eliminada, material excluído e função suspensa fazem a execução falhar sem chamar o modelo e sem consumo, e há casos de integração para isso.

Autonomia declarada e visível: sim, sem alteração. O diff não toca governança nem nível de autonomia.

Itens 7 a 9 (vigilância, nota em discursiva e redação, medição do professor): o diff não toca nenhum deles.

Bloqueantes: nenhum.

Recomendações:
1. `apps/api/src/tutor/turno.command.ts:254`: a transação própria da D36 abre uma segunda conexão enquanto a transação de conclusão (`execucao.scheduler.ts:97`) ainda está aberta, sem trava. Não há risco de travamento mútuo hoje, porque a conclusão só grava depois. Mas cada turno delicado ocupa duas conexões do pool. Vale o `infra-guardian` olhar isso na 5.0, quando o trabalho for para o worker.
2. Na ordem atual, `#encaminhar` roda antes de `exigirCitacoesEntregues`, então a conferência de citações não roda para o turno delicado. Não há efeito, porque a tarefa já zera as citações (`turno-do-tutor.ts:408`). Um comentário na linha 244 evitaria que alguém reordene isso depois.
3. Quando a execução já estava encerrada, o aluno vê a falha e a mensagem fixa existe na conversa. A mensagem acima do "Tentar de novo" ficou para a 7.0, e é bom conferir lá que ela aparece antes do botão.

Rodei os dois testes de unidade novos (`apps/api/src/ia/registro-de-comandos.test.ts` e `apps/api/src/tutor/turno.command.test.ts`): 10 de 10 passaram. Os testes de integração eu não rodei; li os casos novos de `apps/api/src/tutor/tutor.int.test.ts` e `apps/api/src/tutor/tutor-modelo.int.test.ts`.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/tutor/turno.command.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/tutor/tutor.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/tutor/tutor.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/ia/execucao.scheduler.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/ia/registro-de-comandos.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/tutor/tutor-modelo.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/tutor/tutor.int.test.ts`

## infra-guardian · 1ª rodada · APROVADO · 2026-11-15 18:14:19 · `tasks/prd-reengenharia-continuacao/2_task.md`

VEREDITO: APROVADO

Caminho quente tocado: tutor | IA

Rate limit: ok. O controle por aluno e por escola (`IaRequestRateLimit`) e o freio do dia e o pacote do mês na transação do `pendente` (`aoGravar`) ficaram na requisição. O `preparar` passa `alunoId` e `turmaId` ao `ia.gerar` (`turno.command.ts:217-218`), então a D38 continua sendo contada.

Fila e prioridade: ok. O comando está na `fila = 'interativa'` (`turno.command.ts:186`), e o `#encaminhar` sem modelo continua na requisição.

Concorrência: protegida. A D36 grava com `onConflictDoNothing` em `mensagem_tutor_uma_por_execucao` e em `sinal_tutor_um_por_execucao`, e o caso "o `concluir` duas vezes" mostra que fica um sinal só. Os sinais de trabalho continuam sob `pg_advisory_xact_lock` do aluno. A conclusão condicional (`concluirRodando`) não mudou.

Índice e paginação: ok. O `perguntaDaExecucao` filtra por `escola_id`, `ano_letivo_id`, `aluno_id`, `autor` e `execucao_id`, e o índice único `(escola_id, execucao_id, autor)` atende. É busca de uma linha, sem listagem.

Degradação de IA: ok. A chamada continua pela porta `ia.gerar` (gateway, limitador e timeout), igual ao caminho antigo pela closure. O erro vira `falhou` com código pelo executor, sem mudança no que chega ao aluno.

Migration: não se aplica.

Métrica e alerta: ok. O contador `tutorRecusadoSemMaterial` passou para o `AlcanceDoAluno` e continua recebendo o `opcoes.medidor` (`tutor.module.ts`). Nenhum alerta novo.

Bloqueantes: nenhum.

Recomendações:
1. **A transação da D36 abre dentro da transação de conclusão e ocupa duas conexões ao mesmo tempo.** O `concluir` roda dentro de `this.banco.transaction` do `gravar` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/ia/execucao.scheduler.ts:97`). Quando o modelo classifica `assunto_delicado`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/tutor/turno.command.ts:244` chama `#encaminhar` (l.254-261), que abre uma segunda transação pelo pool enquanto a primeira segura uma conexão parada.
   - Às 10h o pool já trabalha perto do limite de espera da R40 (100 ms). Se o pool estiver cheio, a conexão interna pode estourar o tempo de espera. Aí a mensagem fixa e o `atencao_humana` não são gravados, e enquanto o executor roda no processo não há reentrega. Para acontecer, várias classificações de assunto delicado precisam coincidir com o pool esgotado, então hoje é risco latente, não bug demonstrado.
   - Correção sugerida: gravar o encaminhamento antes de abrir a transação do `gravar`, por exemplo com um passo do comando que roda entre o modelo e o `gravar` no `comoExecutavel`. Isso deve entrar no mais tardar na 5.0, quando a reentrega passa a existir.
2. Incluir no cenário de carga do Tutor uma fração de turnos que o adaptador falso classifica como `assunto_delicado`, para medir a espera do pool nesse caminho de duas conexões.
3. O comentário da l.245-246 de `turno.command.ts` ("Sem trava: ... READ COMMITTED") foi copiado do service. Vale citar nele que a corrida entre a avaliação que abre e a conclusão é aceita de propósito (ordem serial equivalente), para quem chegar depois não pôr uma trava ali.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-15 18:14:37 · `tasks/prd-reengenharia-continuacao/2_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. A tarefa não tem migration e não muda o schema. O código mexe em dados de aluno que já existem: `mensagem_tutor` (pergunta e resposta), `sinal_tutor` (`atencao_humana`, `resposta_pronta`, `travou`, `duvida_repetida`), o `alunoId` e o `turmaId` que vão ao gateway para o limite diário e o pacote do mês (D38), e a memória por habilidade (D66). Só mudaram de lugar: saíram de `tutor.service.ts` e foram para `apps/api/src/tutor/turno.command.ts`.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok.
- `TutorDoAlunoRepository.perguntaDaExecucao` (`apps/api/src/tutor/tutor.repository.ts:332`) busca a pergunta com `#doAluno()`, ou seja, pela escola, pelo ano em curso e pelo `alunoId` da sessão, além de `autor = 'aluno'` e do `execucaoId`. A execução de outro aluno, de outra escola ou de outro ano não é achada. Antes desse filtro, o `paraExecutar` (`apps/api/src/ia/execucao.repository.ts:147`) já exige `solicitadaPor` igual a quem está logado.
- O teste de isolamento é efetivo. Sem a cláusula de escopo, a pergunta do colega ou da outra escola seria lida e a busca de trechos receberia a marca, e o teste quebraria. Ele está em `apps/api/src/tutor/tutor.int.test.ts:863`.
- Trocando o id mentalmente: um aluno que passa o id de execução de outro recebe `NAO_ENCONTRADO`, igual ao id inexistente.
- O aluno transferido para uma turma em prova falha como inexistente, e não como pausa. Assim o sistema não confirma que há prova aberta na outra turma.

Logs: limpos. O diff não acrescenta nenhum `logger` nem `console`. O contador `tutorRecusadoSemMaterial` continua com a turma como único rótulo.

Auditoria: nenhuma ação nova que a exija. Não há leitura de dado de aluno por coordenação ou rede, exportação, nota nem permissão. O registro de execução e consumo continua igual.

Envio externo: o que vai ao modelo é a dúvida, a série e a disciplina, os trechos do material, a questão sem gabarito, a memória por habilidade (só números e código do catálogo) e os turnos anteriores. Nada leva nome nem matrícula. O `alunoId` é um id e serve ao freio de orçamento. O destino continua o `LLMProvider`, chamado por `comoExecutavel` (`apps/api/src/ia/execucao-command.ts`). O envio fica registrado na `execucao_agente` e no `consumo_ia`, por `execucaoId`. O prompt não mudou. Sem as closures, o caminho é um só, e por isso não há mais envio que escape do registro do comando.

Seed/fixture: sintético. São alunos criados pelo `novoAluno`, marcas aleatórias (`sucuri…`, `sabia…`) e disciplinas tiradas do próprio banco de teste.

Ciclo de vida, conferido por causa da transação própria da D36 em `turno.command.ts:254`. O `#encaminhar` grava fora da transação que conclui a execução. Ainda assim, não recria dado de titular eliminado durante a chamada ao modelo. A eliminação apaga a linha de `usuario` (`packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts:400`), e a chave estrangeira `mensagem_tutor_aluno_da_escola_fk` recusa a gravação depois disso.

Pergunta de fechamento: o código responde. A pergunta, a resposta e o sinal continuam em `mensagem_tutor` e `sinal_tutor`, e o envio em `execucao_agente` e `consumo_ia`, todos ligados por `execucaoId` e `alunoId`. A tarefa não abre caminho de envio sem registro; ela fecha o que existia pela closure.

Bloqueantes: nenhum.

Recomendações:
1. Falta um teste que prove o caso da eliminação acima: aluno eliminado entre o `preparar` e o `concluir` com `assunto_delicado`, e a transação própria não grava nada. Hoje isso é garantido só pela chave estrangeira, sem teste.
2. No `concluir` do assunto delicado (`turno.command.ts:259`), o sinal `atencao_humana` vai para `pergunta.turmaId` sem conferir o vínculo de novo. Se o aluno for transferido durante a chamada ao modelo, o aviso, sem conteúdo, chega ao professor da turma antiga. Não é regressão, porque o caminho antigo fazia o mesmo, e na D36 avisar alguém é melhor que não avisar ninguém. Vale escrever essa escolha no docblock ou na AIA do Tutor.
3. O `perguntaDaExecucao` deixou de cruzar com `execucao_agente.solicitadaPor` e passou a depender só de `mensagem_tutor.alunoId`. Está correto, porque o `paraExecutar` já filtra por quem pediu. Uma linha no docblock dizendo que essas duas conferências se complementam evita que alguém tire uma delas depois.

Arquivos lidos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/tutor/turno.command.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/tutor/tutor.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/tutor/tutor.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/tutor/tutor.module.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/ia/execucao.scheduler.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/ia/registro-de-comandos.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/tutor/tutor.int.test.ts`

## revisor-geral · 1ª rodada · APROVADO · 2026-11-15 18:14:37 · `tasks/prd-reengenharia-continuacao/2_task.md`

**VEREDITO: APROVADO**

**Escopo:** respeitado. As subtarefas 2.1 a 2.6 estão feitas. O que é da 5.0 (job, worker, `ia.executar`) e da 7.0 (a mensagem fixa na tela) ficou de fora. `docs/guia-do-desenvolvedor.md`, `packages/core/src/ia/README.md`, a supressão do ESLint e o `TETO` da catraca mudaram só no que a tarefa previa: a complexidade suprimida baixou de 236 para 234, junto com a saída das closures.

**Aderência à Tech Spec:** ok. As cinco divergências da tarefa estão na `techspec.md` §5, "O Tutor, como a 2.0 o fez". São elas: a `AlcanceDoAluno` como peça única que o `POST` e o comando dividem; `perguntaDaExecucao` no lugar de `perguntaDaChave`; `tarefasSemComando` com `TAREFAS_SEM_CHAMADOR`; o registro de teste em `ia.int.test.ts`; e o novo `turno.command.test.ts`. Nenhuma muda cenário: os de §1 e §2 do `cenarios.md`, como "toda tarefa tem comando", "D36 com a execução encerrada", "reentrega, um sinal só", "S12 nas duas janelas" e "a conferência do assunto delicado na requisição", seguem valendo como escritos. A D36 e a S12 seguem a §5:
- O `#encaminhar` do comando abre transação própria, que comita antes de o `concluirRodando` correr na transação da conclusão.
- O `assunto_delicado` fica fora da conferência da avaliação aberta.
- A resposta comum confere a avaliação aberta de novo, dentro do `tx`.
- O `#encaminhar` do `TutorService` continua na requisição, sem comando.

**Portão local:** carimbo válido. O `conferir` respondeu: "portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)".

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Duas conexões ao mesmo tempo no assunto delicado.** Em `apps/api/src/tutor/turno.command.ts:244` e `:254-261`, o `#encaminhar` usa `this.banco.transaction` dentro do `concluir`. O `concluir` já roda dentro do `this.banco.transaction` do `gravar` (`execucao.scheduler.ts`), que já mandou o `BEGIN` e segura uma conexão parada. Cada turno delicado prende então duas conexões do pool ao mesmo tempo. O pool só trava se, ao mesmo tempo, houver tantos turnos delicados quanto conexões no pool, o que é raro. Mesmo assim é o desenho que a 5.0 vai levar para o `worker-ia`. Vale levar ao `infra-guardian`, ou separar no `ComandoExecutavel` um passo "antes da conclusão", que roda fora do `gravar`, para a 5.0 não herdar isso.
2. **Arquivo da `AlcanceDoAluno`.** Ela fica em `turno.command.ts`, mas o `TutorService` também a usa (no `POST` e na `conversa`). Num arquivo próprio, como `tutor/alcance-do-aluno.ts`, quem lê o service não precisaria abrir o arquivo do comando.
3. **Código de produção que só os testes usam.** `tarefasSemComando` e `TAREFAS_SEM_CHAMADOR` (`apps/api/src/ia/registro-de-comandos.ts:42-54`) são exportados pela produção, mas só os testes os chamam. Ou a subida da API passa a conferir o registro com eles, como já faz com a D62, ou eles vão para o lado do teste.
4. **A leitura dos módulos no teste é frágil.** Em `apps/api/src/ia/registro-de-comandos.test.ts:27-43`, a leitura casa `comRegistro(registro, new X(` com expressão regular e instancia o comando sem argumentos. Um módulo que registre de outro jeito (o comando numa variável antes do `comRegistro`, por exemplo) some da contagem sem aviso. Hoje o caso de `ia.int.test.ts` sobre a API montada cobre esse buraco, e é ele que segura.

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/tasks/prd-reengenharia-continuacao/2_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/tasks/prd-reengenharia-continuacao/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/tutor/turno.command.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/ia/execucao.scheduler.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/ia/registro-de-comandos.ts

## test-engineer · 1ª rodada · REPROVADO · 2026-11-15 18:15:35 · `tasks/prd-reengenharia-continuacao/2_task.md`

VEREDITO: REPROVADO

**Cenários exigidos**
- O registro tem um comando para cada `TarefaDeIa`, salvo `relatorio_da_correcao`. A trava falha quando o registro some ou quando alguém a contorna. O `ExecucaoRequest` não aceita mais closure.
- O turno roda pelo comando.
- D36: o `assunto_delicado` do modelo grava com a execução já encerrada; o `concluir` repetido grava um sinal só; o "quero sumir" não chega ao modelo.
- S12: avaliação aberta entre o `POST` e o `preparar`, e entre o `preparar` e o `concluir`; avaliação de outra turma abrindo no meio.
- Contexto relido no `preparar`: aluno transferido, vínculo encerrado, pergunta eliminada, material fora do alcance, função suspensa, virada do ano.
- Isolamento: a pergunta da escola B e a do colega da mesma turma, lidas no contexto do aluno A.
- Recusa nas três formas de arrancar a resposta.
- Concorrência: a reentrega da execução chamando o `concluir` duas vezes ao mesmo tempo.

**Cobertos**
- Todas as linhas da tabela têm o caso citado pelo nome, e os nomes existem nos arquivos.
- `registro-de-comandos.test.ts` e `turno.command.test.ts` passaram (10 de 10).
- Os dois casos novos da D36 em `tutor-modelo.int.test.ts` passaram.
- O teste da D36 com a execução encerrada cria a condição de verdade: segura a execução no insert do `consumo_ia` e muda o estado por SQL antes de soltar.
- O teste de isolamento chama o `perguntaDaExecucao` direto. Isso pega a remoção do `#doAluno` no caso do colega da mesma turma, que a conferência de turma do `preparar` deixaria passar.
- O `@ts-expect-error` é conferido pelo `tsc`, porque `apps/api/tsconfig.json` inclui `src`.
- Não há `.skip`, `.only` nem `any` no diff, e nenhum teste chama provedor pago (adaptador falso).

**Bloqueantes**

1. **Falta o bloco de mutação do `exigirCitacoesEntregues`.**
   - Onde: `apps/api/src/tutor/turno.command.ts:249`.
   - O documento diz duas vezes que essa chamada tem bloco (`2_task.md:74` e `:103`), mas nenhum dos 55 blocos a tira. A chamada é cláusula de regra num arquivo novo.
   - Correção: incluir o bloco que remove a linha, citando `apps/api/src/tutor/tutor-modelo.int.test.ts` › "citação de página que não foi entregue ao modelo é saída inválida…" (l.190).

2. **Falta o bloco de mutação do registro do comando do Tutor.**
   - Onde: `apps/api/src/tutor/tutor.module.ts:616`.
   - A tabela pede, na linha "toda tarefa tem comando", a mutação "tirar um registro", e o texto em `2_task.md:103` diz que "o registro de cada comando" tem bloco. Nenhum bloco mexe em `tutor.module.ts`. O teste só simula a remoção em memória (`registro-de-comandos.test.ts:52`), e isso não prova que o teste lê o módulo real.
   - Correção: incluir o bloco que troca `comRegistro(registro, new TurnoDoTutorCommand(...))` por `new TurnoDoTutorCommand(...)`, citando `registro-de-comandos.test.ts` › "toda tarefa do catálogo que alguém chama…".

3. **O teste do `concluir` duas vezes é sequencial, e precisa ser em paralelo.**
   - Onde: `apps/api/src/tutor/tutor-modelo.int.test.ts:428` faz `[await concluirDeNovo(), await concluirDeNovo()]`.
   - Antes desta tarefa, a gravação do assunto delicado rodava dentro da conclusão condicional, e era ela que decidia qual das duas execuções gravava. Agora o `#encaminhar` (`turno.command.ts:254`) roda numa transação própria, antes dessa conclusão. Com isso, duas reentregas ao mesmo tempo (o job executado duas vezes, que é o que a 5.0 traz com a entrega "ao menos uma vez" da D49) disputam o insert sem essa proteção.
   - A garantia agora depende só das chaves únicas (`mensagem_tutor` em escola, execução e autor; `sinal_tutor_um_por_execucao`) e do `select` depois do conflito. Nada disso é provado com duas chamadas simultâneas.
   - Correção: `const [primeira, segunda] = await Promise.all([concluirDeNovo(), concluirDeNovo()])`, mantendo as asserções: uma mensagem, um sinal e o mesmo `mensagemId` nas duas.

**Recomendações**
- O caso citado na linha "turno pelo comando" de `ia.int.test.ts` (› "o turno do Tutor grava consumo com o aluno…", l.804) agora roda com o comando de teste (`comandoPorChave`), e não com o `TurnoDoTutorCommand`. Ele não prova que o comando real passa `alunoId` e `turmaId` ao modelo. Hoje isso só é provado de forma indireta, porque o `WriteBlockTrigger` filtra por `aluno_id`. Vale citar um caso do Tutor que confira o `aluno_id` do `consumo_ia`, ou deixar essa ressalva escrita na tabela.
- `registro-de-comandos.test.ts:96`: o `expect(Object.keys(...))` sempre passa, porque confere o literal que o próprio teste escreveu. A prova real é o `tsc`. Trocar por `expectTypeOf`/`assertType` deixa isso explícito e evita uma "asserção que sempre passa" (regra 40, item 5).
- A virada do ano no `perguntaDaExecucao` fica coberta só pelo `paraExecutar` genérico. Um caso direto (a pergunta de outro ano lida pelo comando volta `undefined`) fecharia a afirmação da docstring em `tutor.repository.ts:329`.
- `tarefasRegistradasPelosModulos` instancia cada comando sem argumentos (`registro-de-comandos.test.ts:40`). Isso quebra no dia em que um construtor validar o que recebe. Vale ao menos um comentário no `*.command.ts` sobre esse contrato.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/tasks/prd-reengenharia-continuacao/2_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/tutor/turno.command.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/tutor/tutor.module.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/tutor/tutor-modelo.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/ia/registro-de-comandos.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/ia/ia.int.test.ts

## llm-integrator · 1ª rodada · APROVADO · 2026-11-15 18:16:37 · `tasks/prd-reengenharia-continuacao/2_task.md`

VEREDITO: APROVADO

Perfis usados: nenhum novo. O `turno_do_tutor` continua em `rapido` (`packages/core/src/ia/tasks/turno-do-tutor.ts:625`). A tarefa não adiciona chamada de modelo, não mexe em prompt, em schema de saída nem em tarefa.

Custo estimado por professor/mês: R$ 0 adicional. É refatoração de execução. O consumo do Tutor segue o freio diário por aluno e o pacote mensal por turma (D38), e a estimativa de custo desse agente continua a da tarefa que o criou. A única diferença de chamadas é que o `assunto_delicado` que o modelo classifica agora grava a mensagem fixa e o sinal mesmo com a execução encerrada. Isso não gera chamada de modelo nova.

Prompt versionado: sim (`PROMPT_TURNO_DO_TUTOR`, inalterado).

Validação de schema: sim. A saída passa pelo gateway, com `exigirCitacoesEntregues` no `concluir`. O `execucaoInputSchema` e o `resultadoGravadoSchema` continuam valendo no `agendar` e no `gravar`.

Aprovação humana no caminho: não se aplica. O Tutor é a exceção da D47, supervisionada pelo professor (regra 70, itens 3 e 4). A D36 agora grava o sinal `atencao_humana` com mais garantia, porque ele não depende mais de a execução concluir.

**O que verifiquei**
- `npx tsc --noEmit` na API passou.
- Rodei `registro-de-comandos.test.ts`, `turno.command.test.ts` e `catraca.test.ts`: 28 de 28 verdes.
- Rodei `tutor-modelo.int.test.ts` (27), `tutor.int.test.ts` e `ia.int.test.ts` (97 juntos): todos verdes, com adaptador falso e sem provedor pago.
- Nenhum arquivo de produção ainda usa `ExecucaoRequest`, `aoConcluir` ou `perguntaDaChave` do Tutor. O `perguntaDaChave` que sobrou é o do `ConversaRepository` do Assistente, outro repository.
- O `ExecucaoScheduler` perdeu a closure e o `#rodarClosure`. Todo pedido passa por `#rodarComando`, que relê a execução pelo id, confere a suspensão e confere que a tarefa é a do comando.
- A regra 10 está respeitada. `perguntaDaExecucao` filtra por escola, ano e aluno do contexto (`tutor.repository.ts:346`). O `preparar` ainda confere que a turma atual é a da pergunta, e a execução de outro aluno ou de outra escola responde `NAO_ENCONTRADO`.
- A S12 se confere no `preparar` e no `concluir`. A D36 usa uma transação própria (`turno.command.ts`, `#encaminhar`), e as chaves únicas de `mensagem_tutor` e `sinal_tutor` a tornam idempotente. Não há risco de deadlock com a conclusão condicional: o `concluirRodando` só roda depois do callback, e a transação própria já está commitada.
- Os testes de mutação do plano cobrem a D36 com a execução encerrada, o `concluir` repetido, a avaliação aberta entre o `202` e o `preparar`, e a avaliação aberta entre o `preparar` e o `concluir`.
- O `registro-de-comandos.test.ts` tem trava de alvo vazio e de contorno, e lê o que os `*.module.ts` registram. `relatorio_da_correcao` é a única tarefa sem comando, e o teste prova que nenhum arquivo a chama.

Bloqueantes: nenhum.

Recomendações:
- `turno.command.ts`, método `concluir` com `#encaminhar`: no `assunto_delicado`, a conclusão segura uma conexão em transação enquanto a transação própria abre outra. Isso é raro e não bloqueia. Mesmo assim, anote para a 5.0, quando o worker passar a rodar isso com concorrência: dois turnos delicados simultâneos por escola, com o pool apertado, é a manhã de segunda da regra 80. Vale uma linha no runbook ou um teste de pool pequeno.
- `turno.command.ts`: o `assunto_delicado` passou a pular `exigirCitacoesEntregues` (antes rodava para toda saída). É o comportamento desejado pela D36, porque a mensagem fixa não depende de citação. Registre isso no docblock do `concluir`, para ninguém o "consertar" depois.
- `TurnoDoTutorCommand.preparar` repete o `turmaDoAluno` no `alcance` e depois confere `agora.turma.turmaId !== pergunta.turmaId`. Está correto. Um teste de transferência para turma que não está em prova, com `turmaId` diferente, deixaria essa cláusula isolada. A do mutante "transferido" já a cobre, então é opcional.

Arquivos relevantes (todos em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3`):
- `apps/api/src/tutor/turno.command.ts`
- `apps/api/src/tutor/tutor.service.ts`
- `apps/api/src/tutor/tutor.repository.ts`
- `apps/api/src/ia/execucao.scheduler.ts`
- `apps/api/src/ia/registro-de-comandos.ts`
- `apps/api/src/ia/registro-de-comandos.test.ts`

## infra-guardian · 2ª rodada · APROVADO · 2026-11-15 18:44:07 · `tasks/prd-reengenharia-continuacao/2_task.md`

VEREDITO: APROVADO
Caminho quente tocado: tutor | IA
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ok
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum

Na 1ª rodada não houve correção exigida. Esta rodada mexe só em comentários de `apps/api/src/tutor/turno.command.ts` e `apps/api/src/tutor/tutor.repository.ts`, em testes e na tabela de `tasks/prd-reengenharia-continuacao/2_task.md`. Nenhum desses arquivos ganhou código de produção novo.

- `apps/api/src/tutor/tutor-modelo.int.test.ts:430-431`: o `concluir` repetido agora roda ao mesmo tempo, com `Promise.all`. Isso fecha a lacuna do item 6, que pede teste de concorrência para o job executado duas vezes (D49). O teste espera a mesma mensagem e um sinal só.
- O caso novo do ano anterior em `apps/api/src/tutor/tutor.int.test.ts:1074` e o caso novo das citações em `apps/api/src/tutor/tutor-modelo.int.test.ts:590-616` usam o modelo falso da bancada. Nenhum chama provedor pago.
- O comentário em `turno.command.ts` sobre a conferência sem trava deixa escrito por que não há trava: ela seguraria a escola inteira para fechar uma janela de milissegundos. Bate com a regra 80.

Recomendações:
- Com o `Promise.all`, o teste da D36 repetida ocupa até quatro conexões do pool ao mesmo tempo: duas transações de conclusão, cada uma com a sua transação própria da D36. Vale conferir o tamanho do pool da bancada para o teste não ficar instável. É o mesmo risco latente da 1ª rodada, já mandado para a tarefa 5.0.
- Continuam valendo os destinos da 1ª rodada que estão em `tasks/prd-reengenharia-continuacao/2_task.md`: tirar a transação da D36 de dentro da conclusão (5.0) e o cenário de carga com uma fração de turnos de assunto delicado (11.0).

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-15 18:44:07 · `tasks/prd-reengenharia-continuacao/2_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration nesta rodada. `mensagem_tutor` e `execucao_agente` continuam com `escola_id` e `ano_letivo_id`, gravados pelo fixture `trocasJaFeitas` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/test/escola-tutor.fixture.ts:130`.

Queries verificadas:
- `TutorDoAlunoRepository.perguntaDaExecucao` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/tutor/tutor.repository.ts:336`) filtra por `#doAluno()` (linha 133), ou seja por `escolaId`, `anoLetivoId` e `alunoId`, todos tirados do contexto autenticado. Nesta rodada só mudou o docblock.
- `TurnoDoTutorCommand.preparar` e `concluir` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/tutor/turno.command.ts`) só ganharam comentários. Nenhum parâmetro de escopo vem do cliente, e nenhum endpoint foi criado ou alterado.
- Não apareceu `@Unscoped()` novo nem consulta agregada nova da camada de rede.

Teste de isolamento: presente e efetivo.
- O caso novo do ano está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/tutor/tutor.int.test.ts:1074`. As perguntas de 2025 têm a mesma escola e o mesmo aluno, e só o ano letivo é outro.
- Teste mental: se eu tirar `eq(mensagemTutor.anoLetivoId, anoLetivoId)` de `#doAluno`, a leitura no ano em curso passa a achar a pergunta, e o `toBeUndefined()` da linha 1082 quebra.
- O controle positivo da linha 1084 mostra que o caso é real: no contexto `deAntes`, a mesma leitura acha a pergunta com o texto `'Pergunta sintética já feita'`.
- Os casos de outra escola e do colega, aprovados na 1ª rodada, não mudaram.

Bloqueantes: nenhum.

Recomendações:
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/tutor/tutor.int.test.ts:1083`, o `rejects` do `comando.preparar` sozinho não prova o escopo do ano. Sem a cláusula do ano, `preparar` ainda devolveria `NAO_ENCONTRADO`, porque a turma do alcance atual difere de `anterior.turmaId` (`turno.command.ts:207`). Quem prova o escopo é a asserção direta da linha 1082. Vale um comentário no teste dizendo isso, para que ninguém apague a linha 1082 achando que o `preparar` já cobre o caso.

## llm-integrator · 2ª rodada · APROVADO · 2026-11-15 18:44:08 · `tasks/prd-reengenharia-continuacao/2_task.md`

VEREDITO: APROVADO

Perfis usados: `turno_do_tutor` é a única tarefa de IA que esta tarefa toca, e o perfil dela não mudou. A rodada 2 não altera chamada de modelo, prompt, schema ou orçamento. Só mexe em testes, comentários e na tabela da tarefa.

Custo estimado por professor/mês: não se aplica. Não há chamada de modelo nova nesta rodada. O custo do Tutor continua sendo o da rodada 1, medido por aluno e por turma (D38, D39).

Prompt versionado: sim, sem mudança nesta rodada.

Validação de schema: sim. A nova prova de `exigirCitacoesEntregues` confirma que o `concluir` rejeita página não entregue com `IA_SAIDA_INVALIDA` e não grava nada.

Aprovação humana no caminho: não se aplica. O Tutor é a exceção da D47, supervisionada pelo professor. O ramo `assunto_delicado` continua mandando o sinal sem conteúdo ao professor (D36).

Bloqueantes: nenhum.

Verifiquei as seis mudanças do diff:
- **Registro de comandos:** o teste de `ExecucaoComComando` agora usa `expectTypeOf`, sem comparar `Object.keys`. A interface em `apps/api/src/ia/execucao.scheduler.ts:25-35` bate com o que o teste afirma: não tem `aoConcluir` nem `entrada` e tem `aoGravar`. Quem prova é o `tsc` do portão, e o teste diz isso no comentário.
- **Idempotência do `concluir`:** o caso em `apps/api/src/tutor/tutor-modelo.int.test.ts` passou de duas chamadas em sequência para `Promise.all`. Isso exercita a garantia real das chaves únicas, a do job entregue duas vezes (D49).
- **Citação no `concluir`:** o caso novo chama o comando real com uma saída que a tarefa não deixaria passar. Cobre página fora dos trechos entregues, lista de trechos vazia e o caminho feliz. A mutação tem bloco registrado.
- **Isolamento por ano:** em `apps/api/src/tutor/tutor.int.test.ts:1074-1086`, a pergunta de 2025 do próprio aluno responde `undefined` e `NAO_ENCONTRADO` no ano em curso. No ano dela, a mesma leitura acha a pergunta. O teste inclui a contraprova, então ele quebraria sem a cláusula de `anoLetivoId` no repository. Isso cumpre a regra 10, itens 2 e 5.
- **Comentários em `apps/api/src/tutor/turno.command.ts` e `apps/api/src/tutor/tutor.repository.ts`:** registram decisões de propósito (o ramo da D36 antes da conferência de citação, a corrida aceita sem trava, o sinal para a turma da pergunta gravada, as duas conferências complementares de `perguntaDaExecucao`). O diff dessas partes só tem comentários, sem alteração de lógica.
- **`2_task.md`:** a tabela de testes e as mutações (57 blocos) batem com o que foi adicionado. A seção "Recomendações sem aplicar" tem destino ou motivo para cada item.

Recomendações:
- A corrida aceita no `concluir` (avaliação abrindo entre a leitura e a gravação) está bem documentada. Vale lembrar na tarefa 5.0, quando o worker separado e a reentrega mudarem a janela, que ela precisa ser reavaliada.
- A recomendação de dois usos de conexão do pool na D36 segue com destino nas tarefas 5.0 e 11.0. Concordo com os destinos.
- O caso de `apps/api/src/ia/ia.int.test.ts` roda com um comando de teste e prova o executor, não o que o Tutor passa ao modelo. A tabela agora diz isso com clareza. Quando houver um adaptador falso que registre o pedido recebido, vale cobrir o aluno e a turma que o comando passa ao modelo.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-15 18:44:09 · `tasks/prd-reengenharia-continuacao/2_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta rodada. O diff não chega a `Nota`. Fora dos testes, nada em `apps/api/src/tutor` nem em `apps/api/src/ia` grava nota ou mexe em `lancadaPor`. Todos com autor humano? sim, porque não há caminho novo.

Decisão autônoma sobre aluno: ausente. O assunto delicado (D36) continua indo para uma pessoa: a mensagem é fixa e o sinal `atencao_humana` vai sem conteúdo e sem referência. O sistema não toma decisão sozinho.

Aprovação registrada: ok. A exceção da D47 continua só no Tutor, e o diff não a leva a outro agente.

Supervisão do tutor: ok. O diff deixa a supervisão mais forte:
- `concluir` agora tem teste próprio que prova a conferência das citações. Uma página que o `preparar` não entregou dá `IA_SAIDA_INVALIDA` e nada é gravado, nem resposta nem sinal (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/tutor/tutor-modelo.int.test.ts:590-617`). Esse teste tem bloco de mutação em `2_task.md`.
- O encaminhamento da D36 vem antes de `exigirCitacoesEntregues`, e agora isso está escrito como regra no docblock (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/tutor/turno.command.ts:236-238`). Assim, uma saída inválida do modelo não cala o encaminhamento do aluno.
- O caso do `concluir` repetido agora roda as duas chamadas ao mesmo tempo, com `Promise.all`, e prova que sai um sinal só quando a mesma execução é concluída duas vezes (D49).
- Ler uma pergunta de 2025 no ano em curso responde como inexistente, e no ano dela a mesma leitura a acha (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/tutor/tutor.int.test.ts:1074-1086`). Isso cobre o escopo do ano, sem afrouxar a supervisão.
- Nada no diff traz inferência emocional nem mede navegação. Itens 7 e 4d da regra 70: sem alteração.

Autonomia declarada e visível: sim. Sem alteração nesta rodada.

Itens 8 e 9 do checklist (D46/D55 e D45): o diff não toca discursiva, redação nem indicador de professor.

Correções exigidas na 1ª rodada: nenhuma.

Bloqueantes: nenhum.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/tutor/turno.command.ts:261-263` manda o sinal da D36 para a turma da pergunta gravada, sem conferir de novo o vínculo do aluno. O sinal não leva conteúdo, isso já era feito antes da X6 e o motivo está escrito, então não bloqueia. Quando a AIA do Tutor for revista, vale registrar ali que, no caso do aluno transferido, o aviso pode chegar ao professor da turma antiga.
2. Minhas recomendações da 1ª rodada estão em "Recomendações sem aplicar" do `2_task.md`, cada uma com destino. A tela da 7.0 (mensagem fixa acima do "Tentar de novo") fica para conferir naquela tarefa.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-15 18:44:24 · `tasks/prd-reengenharia-continuacao/2_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. O diff desta rodada só mexe em testes, comentários, um docblock e no `2_task.md`. Nenhuma migration, nenhum DTO e nenhuma rota mudaram.

Fora da tabela de dados do docs/lgpd.md: nenhum.

Autorização por objeto: ok. O novo caso em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/tutor/tutor.int.test.ts:1074-1086` (a pergunta de 2025 do próprio aluno, relida no ano em curso) fecha o eixo do ano letivo do isolamento:
- `perguntaDaExecucao` devolve `undefined`.
- `preparar` rejeita com `NAO_ENCONTRADO`, a mesma resposta do inexistente.
- No ano em que a pergunta foi feita, a mesma leitura a acha, então o teste não passa por falta de dado.

O filtro continua em `#doAluno()` (escola, ano e aluno) no `tutor.repository.ts`. O docblock novo deixa escrito que as duas conferências se somam e que uma não substitui a outra: o escopo da conversa no repository e o `solicitadaPor` no `paraExecutar`.

Logs: limpos. O diff não acrescenta nenhum `logger` ou `console`, e os arquivos de produção da tarefa não têm nenhum.

Auditoria: nenhuma ação nova que a exija nesta rodada.

Envio externo: nada muda. O caso novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/apps/api/src/tutor/tutor-modelo.int.test.ts:590-616` prova que o próprio `concluir` confere a citação contra os trechos que o `preparar` entregou. Uma página que não foi entregue dá `IA_SAIDA_INVALIDA`, e nesse caso nenhuma resposta e nenhum sinal são gravados. A mutação que tira `exigirCitacoesEntregues` está registrada.

O comentário novo do ramo `assunto_delicado` (`turno.command.ts`) explica que o encaminhamento da D36 não depende da conferência de citação, e está correto. O sinal sai sem conteúdo e sem referência para a turma da pergunta gravada. Um aluno transferido no meio da chamada faz o aviso chegar ao professor da turma antiga, mas sem nenhum conteúdo. A escolha está documentada e não expõe nada.

Seed/fixture: sintético ("Pergunta sintética já feita", "Material de demonstração").

Bloqueantes: nenhum. A 1ª rodada não deixou correção exigida para conferir.

Recomendações:
- Os dois `@ts-expect-error` de `registro-de-comandos.test.ts` só são conferidos pelo `tsc` do portão, e o Vitest não os vê. O `expectTypeOf` novo está certo para isso. Vale confirmar que o `tsconfig` que o portão usa inclui os arquivos `*.test.ts` de `apps/api`.
- A recomendação da 1ª rodada (aluno eliminado entre o `preparar` e o `concluir` com `assunto_delicado`) ficou registrada para a tarefa 5.0. Ela deve ser cobrada lá, junto com a reentrega.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-15 18:44:26 · `tasks/prd-reengenharia-continuacao/2_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum
Recomendações:
- `apps/api/src/tutor/tutor.int.test.ts:1083`: a parte do caso novo que espera `comando.preparar(lida)` rejeitar com `NAO_ENCONTRADO` não prova a cláusula do ano. O `preparar` também pode falhar antes disso: a turma de 2025 está fora do alcance do aluno no ano em curso. Quem prova a cláusula `anoLetivoId` do `perguntaDaExecucao` é a asserção direta no repository das linhas 1082 e 1084, que olha os dois anos. Vale dizer isso no comentário, ou trocar a asserção do `preparar` por uma que só falhe pelo ano.
- `apps/api/src/tutor/tutor-modelo.int.test.ts:430`: com o `Promise.all`, o caso passou a provar a corrida de verdade. As duas chamadas concorrentes do ramo `assunto_delicado` usam duas conexões cada: a transação de fora e a própria do `#encaminhar`. Juntas, são quatro conexões ao mesmo tempo. Se o pool do teste for pequeno, o caso fica instável. Isso se liga ao destino já anotado para a 5.0, a transação própria da D36 que ocupa duas conexões do pool.

As correções desta rodada estão feitas. Nenhuma foi exigida, então conferi as recomendações da 1ª rodada que entraram:
- O pedido sem closure passou a ser provado pelo tipo: `expectTypeOf` e `@ts-expect-error` em `apps/api/src/ia/registro-de-comandos.test.ts`, conferidos pelo `tsc` do portão.
- O `concluir` repetido roda ao mesmo tempo.
- A conferência da citação no `concluir` ganhou teste e bloco de mutação.
- O isolamento por ano ganhou caso.
- Os comentários sobre a ordem do ramo D36 e sobre a corrida sem trava explicam o motivo, e não repetem o código.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/tasks/prd-reengenharia-continuacao/2_task.md` passou a listar `eslint-suppressions.json` e `tools/guardas/catraca.test.ts` nos arquivos e registra o destino de cada recomendação que ficou de fora.

## test-engineer · 2ª rodada · APROVADO · 2026-11-15 18:45:05 · `tasks/prd-reengenharia-continuacao/2_task.md`

VEREDITO: APROVADO

Cenários exigidos: as três correções da 1ª rodada (o bloco do `exigirCitacoesEntregues`, o bloco do registro do comando no `tutor.module.ts` e o `concluir` duas vezes em paralelo), e o que o diff novo afeta: o caso do ano letivo no isolamento, o teste de tipo do pedido sem closure e a tabela de testes do 2_task.md.

Cobertos:
1. **Bloco do `exigirCitacoesEntregues`: feito.** Está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l3/tasks/prd-reengenharia-continuacao/2_task.md`, e as linhas de contexto batem com o `turno.command.ts` atual. O caso novo de `tutor-modelo.int.test.ts` ("a citação que o `concluir` recebe é conferida…") chama o `concluir` à mão sobre um turno que falhou, sem avaliação aberta. Assim chega à cláusula: sem ela, o `concluir` com a página 5 gravaria e o `rejects` ficaria vermelho. Depois de cada rejeição o caso confere que não ficou resposta nem sinal (`[]`), e confere que a citação entregue grava. A linha nova da tabela cita esse caso pelo nome.
2. **Bloco do registro no `tutor.module.ts`: feito.** O texto bate com a linha 33 do módulo. O teste lê os `*.module.ts` com a expressão `comRegistro(\w+, new X(`. Sem o `comRegistro`, o `turno_do_tutor` sai das tarefas registradas, e a asserção da linha 48 (`tarefasSemComando(registradas)` igual a `[]`) fica vermelha. Os outros módulos continuam registrando, então o vermelho não vem do "nenhum módulo registra comando".
3. **`concluir` em paralelo: feito.** `tutor-modelo.int.test.ts:431` agora usa `Promise.all([concluirDeNovo(), concluirDeNovo()])` e mantém as asserções: o mesmo resultado nas duas, o `mensagemId` igual ao da execução, uma mensagem e um sinal.
4. **Isolamento por ano** (`tutor.int.test.ts`, "o comando relê a pergunta pelo id da execução só no ano em curso…"): o caso exige as duas perguntas de 2025 (`toHaveLength(2)`), então não passa vazio. No ano em curso, o `perguntaDaExecucao` dá `undefined` e o `preparar` dá `NAO_ENCONTRADO`. No ano de 2025, a mesma leitura acha a pergunta, o que mostra que o dado existe.
5. **Pedido sem closure**: os `expectTypeOf` e os dois `@ts-expect-error` são conferidos pelo `tsc` do portão. A asserção sobre `Object.keys` de antes, que passaria de qualquer jeito, saiu.
6. **Testes que rodei:**
   - `registro-de-comandos.test.ts`: 5 de 5 passam.
   - `tutor-modelo.int.test.ts -t "concluir"`: 2 passam (o caso em paralelo e o da citação).
   - `tutor.int.test.ts -t "só no ano em curso"`: 1 passa.
   - Não há `.skip`, e o modelo é o adaptador falso.

Bloqueantes: nenhum.

Recomendações:
- **O paralelo não testa a primeira gravação.** Em `tutor-modelo.int.test.ts:416-437`, as duas chamadas paralelas rodam depois que o turno já concluiu e gravou a mensagem e o sinal. Elas só exercitam o conflito com uma linha que já está gravada. A corrida das duas primeiras inserções ao mesmo tempo, que é o job rodado em dois workers, fica sem teste. Sugestão: uma variante em que o turno falha antes de concluir, e as duas primeiras gravações de `assunto_delicado` saem em `Promise.all`. Cabe na 5.0, que já leva a reentrega e o job.
- **Citar o caso novo no bloco do ano.** O bloco de mutação que tira o `anoLetivoId` do `perguntaDaExecucao` poderia citar também o caso novo do ano em `tutor.int.test.ts`, que testa essa cláusula de forma direta.
