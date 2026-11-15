# Índice dos achados das revisões

Uma linha por rodada que exigiu alguma coisa. O texto inteiro está no arquivo do documento, nesta
pasta (`<documento>.md`), no bloco com o mesmo fim. Escrito pelo hook `tools/processo/revisoes.ts`.
Não edite à mão.

Leia este índice antes de codar, e abra só os blocos que interessam à tarefa de agora.

| Fim | Revisor | Rodada | Veredito | Documento | O que exigiu |
|---|---|---|---|---|---|
| 2026-11-15 01:16:52 | `frontend-reviewer` | 1ª | AJUSTES NECESSÁRIOS | `revisao-spec` | Tech Spec §5 "A web", `main.tsx`. A Tech Spec manda envolver as rotas em `<AreaErrorBoundary paginaInteira>` em `main.tsx` com `FALHA_DA_AREA`, mas a premissa… |
| 2026-11-15 01:17:41 | `llm-integrator` | 1ª | APROVADO | `revisao-spec` | Escola na métrica (§6 e §7c): `ia.espera_estourada{escola_id}` contradiz o PRD §8 ("as métricas de IA não levam usuário nem escola") e o PRD §4 (operador sem… |
| 2026-11-15 01:18:32 | `tenancy-guardian` | 1ª | APROVADO | `revisao-spec` | Tech Spec §6. Estender o teste "job da A com o `execucaoId` da B" a dois cenários. No primeiro, o relógio passa dos 20 s e a marcação `falhou IA_INDISPONIVEL`… |
| 2026-11-15 01:19:27 | `privacy-guardian` | 1ª | REPROVADO | `revisao-spec` | A execução interrompida pode sumir da lista de compartilhamento (Tech Spec §8 e a linha `rodando` da tabela de estados em §5). |
| 2026-11-15 01:19:48 | `conformidade-reviewer` | 1ª | REPROVADO | `revisao-spec` | Tech Spec §5 ("Os tokens") e §7b, PRD §8b. A degradação muda o Tutor e a AIA não registra isso. |
| 2026-11-15 01:21:03 | `infra-guardian` | 1ª | REPROVADO | `revisao-spec` | Tech Spec §4 e §5, tabela de estados, linha `pendente`: o corte de 20 s não tem dono. A §4 diz que o `GET /v1/execucoes/:id` também devolve `IA_INDISPONIVEL`… |
| 2026-11-15 01:21:24 | `test-engineer` | 1ª | REPROVADO | `revisao-spec` | §10 e RF4: não há harness de teste que passe pela fila de verdade. |
| 2026-11-15 01:21:46 | `revisor-geral` | 1ª | REPROVADO | `revisao-spec` | §5, tabela de estados, linha `pendente`, e §4: a espera de 20 s não diz quem grava o corte nem com que relógio. A Tech Spec diz duas coisas. Pela tabela, a… |
| 2026-11-15 02:37:31 | `frontend-reviewer` | 2ª | APROVADO | `revisao-spec` | Aviso da espera (techspec §5): "Tentando de novo em N s" não deve ser anunciado a cada segundo pelo leitor de tela. Anuncie uma vez (texto fixo "Tentando de… |
| 2026-11-15 02:37:55 | `llm-integrator` | 2ª | AJUSTES NECESSÁRIOS | `revisao-spec` | Techspec §5 ("Os tokens") contra §5 ("Os estados"): a espera da ferramenta subiu para 30 s e o orçamento de tempo sumiu. |
| 2026-11-15 02:38:24 | `conformidade-reviewer` | 2ª | APROVADO | `revisao-spec` | Citar a fonte certa no gate (§5 "Os tokens"): a trava do Tutor cita "(D37)". Citar também a D36 e a regra 30.11, que são de onde vem a exigência. Dizer onde a… |
| 2026-11-15 02:39:00 | `privacy-guardian` | 2ª | REPROVADO | `revisao-spec` | 1 |
| 2026-11-15 02:39:01 | `tenancy-guardian` | 2ª | APROVADO | `revisao-spec` | techspec §5 "Os estados" e §4, o corte pelo GET: escrever que ele só acontece depois que deQuemPediu achou a linha, ou que o `update` leva as mesmas cláusulas… |
| 2026-11-15 02:39:02 | `test-engineer` | 2ª | REPROVADO | `revisao-spec` | O corte feito pelo processador não tem cenário que caia sem ele (`cenarios.md` §1; Tech Spec §5, tabela de estados, linha `pendente`). |
| 2026-11-15 02:40:11 | `infra-guardian` | 2ª | REPROVADO | `revisao-spec` | Tech Spec §7c ("Carga na manhã") e §5 ("Os tokens"): o teto de tokens que a spec registra não cobre o pico que ela mesma calcula. A spec pede um contrato de… |
| 2026-11-15 02:40:28 | `revisor-geral` | 2ª | REPROVADO | `revisao-spec` | O professor não vê hoje a troca sem resposta, e a Tech Spec não diz como passa a ver. |
| 2026-11-15 02:46:17 | `frontend-reviewer` | 3ª | APROVADO | `revisao-spec` | Ponto de código a cuidar na implementação. Hoje o "Tentar de novo" da `Falha` faz `window.location.reload()`, e o novo "Voltar ao início" será `<a href="/">`.… |
| 2026-11-15 02:46:20 | `llm-integrator` | 3ª | AJUSTES NECESSÁRIOS | `revisao-spec` | Tech Spec §5 ("Os tokens" e tabela de estados, linha `rodando`) e `cenarios.md` §4 (caso "O prazo"): o "corte do perfil" não vale por execução, então a conta… |
| 2026-11-15 02:47:09 | `conformidade-reviewer` | 3ª | APROVADO | `revisao-spec` | Dizer quais finais contam como "sem resposta". Tech Spec §5 "A pergunta sem resposta" conta todo `falhou`. Isso pega também `TUTOR_PAUSADO_EM_AVALIACAO`,… |
| 2026-11-15 02:47:14 | `privacy-guardian` | 3ª | APROVADO | `revisao-spec` | `docs/lgpd.md`:52 e PRD §8. A linha "Uso do Tutor por aluno" lista o que o professor vê: as trocas do dia, a hora e a referência da última troca. A tarefa do… |
| 2026-11-15 02:47:20 | `tenancy-guardian` | 3ª | APROVADO | `revisao-spec` | Tech Spec §5, tabela de estados, linha `pendente`: hoje "as mesmas cláusulas" deixa em aberto se o corte do `GET` vale só para a `interativa`. Escrever isso de… |
| 2026-11-15 02:47:34 | `revisor-geral` | 3ª | REPROVADO | `revisao-spec` | Tech Spec §8 e `cenarios.md` §3: o teto de entrada pode recusar pedidos válidos do aluno. |
| 2026-11-15 02:48:17 | `test-engineer` | 3ª | REPROVADO | `revisao-spec` | O corte do `GET` tem duas cláusulas sem cenário. Onde: Tech Spec §5, tabela de estados, linha `pendente`; `cenarios.md` §1, "O corte dos 20 s". |
| 2026-11-15 02:48:58 | `infra-guardian` | 3ª | REPROVADO | `revisao-spec` | Tech Spec §5, "Os tokens" e a linha `rodando` da tabela de estados; `cenarios.md` §4, caso "O prazo": o "corte do perfil" vale por chamada, não por execução, e… |
| 2026-11-15 02:52:34 | `llm-integrator` | 4ª | APROVADO | `revisao-spec` | Código de erro do estouro. `errors.ts:13` já tem `IA_TEMPO_ESGOTADO`, e o spec manda gravar `falhou IA_INDISPONIVEL` quando o prazo da execução estoura. Isso é… |
| 2026-11-15 02:54:52 | `revisor-geral` | 4ª | REPROVADO | `revisao-spec` | O alerta de tokens tem um número no PRD e outro na Tech Spec. |
| 2026-11-15 02:55:15 | `infra-guardian` | 4ª | APROVADO | `revisao-spec` | §5, "Os tokens": a Tech Spec não diz a ordem nem a devolução dos dois baldes. Se a `ferramenta` consumir no balde geral e for recusada no dos 15 %, cada nova… |
| 2026-11-15 02:56:04 | `test-engineer` | 4ª | REPROVADO | `revisao-spec` | cenarios.md §4, "O prazo único da execução", os dois [I]: com a configuração de hoje, o prazo único nunca chega a valer, e as duas mutações passam. |
| 2026-11-15 02:59:50 | `revisor-geral` | 5ª | APROVADO | `revisao-spec` | §7c, alerta "Tokens acima de 80 %": o balde geral corta as reservas em exatamente 80 % do contratado. Um alerta com a condição "estritamente maior que 0,8"… |
| 2026-11-15 03:00:52 | `test-engineer` | 5ª | REPROVADO | `revisao-spec` | `cenarios.md` §1, "contam também", contra a Tech Spec §5, "A pergunta sem resposta". A Tech Spec diz que conta toda a lista `PASSAGEIROS`. Só que a lista tem… |
| 2026-11-15 03:04:06 | `test-engineer` | 6ª | APROVADO | `revisao-spec` | . Nenhum. |
| 2026-11-15 15:31:41 | `privacy-guardian` | 1ª | APROVADO | `1_task` | `apps/api/src/governanca/analista.command.ts:36`: o `preparar` do Analista ignora a execução e não confere de novo, depois do `202`, se quem pediu ainda tem… |
| 2026-11-15 15:31:45 | `infra-guardian` | 1ª | APROVADO | `1_task` | `apps/api/src/ia/execucao.repository.ts:150`: quando a `entrada` gravada não passa no schema, a função devolve `undefined` e o caso vira `NAO_ENCONTRADO`,… |
| 2026-11-15 15:31:50 | `tenancy-guardian` | 1ª | APROVADO | `1_task` | `apps/api/src/assistente/proposta.command.ts:57`: a pergunta é relida pela `chaveEnvio`, e não pelo id da execução. O escopo está certo, mas ler por… |
| 2026-11-15 15:31:53 | `conformidade-reviewer` | 1ª | APROVADO | `1_task` | Até a 2.0, `ExecucaoRequest` (o caminho por closure, em `apps/api/src/ia/execucao.scheduler.ts:42-70`) aceita qualquer `TaskDefinition`, não só a do Tutor.… |
| 2026-11-15 15:33:03 | `revisor-geral` | 1ª | APROVADO | `1_task` | `cenarios.md:19` ficou desatualizado. A linha ainda diz "a entrega do assistente e do artefato nasce `pendente`". A Divergência 2 mudou isso: o Assistente não… |
| 2026-11-15 15:33:51 | `llm-integrator` | 1ª | APROVADO | `1_task` | `proposta.command.ts` (`preparar`): a pergunta ainda é achada pela `chaveEnvio` (`perguntaDaChave`), e não pelo id da execução. O escopo está correto, com o… |
| 2026-11-15 15:33:53 | `test-engineer` | 1ª | APROVADO | `1_task` | `apps/api/src/ia/ia.int.test.ts`, caso "depois do 202, a função suspensa…": a asserção sobre `consumo_ia` passa de qualquer jeito, porque o `gerar` falso nunca… |
| 2026-11-15 16:07:47 | `tenancy-guardian` | 2ª | APROVADO | `1_task` | `apps/api/src/ia/ia.int.test.ts:980-999`: a asserção sobre `consumo_ia` saiu do caso "depois do 202…", e o título perdeu "nem consumo". Mas a linha "sem… |
| 2026-11-15 16:07:51 | `llm-integrator` | 2ª | APROVADO | `1_task` | Não são exigidas agora. As recomendações da 1ª rodada estão destinadas à 2.0, 3.0, 5.0 e ao `TODO.md`. As duas de maior peso para a regra 30 são a conferência… |
| 2026-11-15 16:07:58 | `conformidade-reviewer` | 2ª | APROVADO | `1_task` | Asserção de consumo retirada: `apps/api/src/ia/ia.int.test.ts:980` perdeu a checagem de `consumo_ia` no caso "depois do 202…". O caso ainda confirma que… |
| 2026-11-15 16:08:12 | `revisor-geral` | 2ª | APROVADO | `1_task` | Linha "sem alcance no `preparar`" da tabela de testes em `tasks/prd-reengenharia-continuacao/1_task.md`. Ela ainda promete "sem modelo nem `consumo_ia`" e cita… |
| 2026-11-15 16:08:14 | `privacy-guardian` | 2ª | APROVADO | `1_task` | `apps/api/src/ia/ia.int.test.ts:980`: o caso perdeu a conferência de `consumo_ia`, e o nome dele perdeu o "nem consumo". A linha "sem alcance no `preparar`" de… |
| 2026-11-15 16:08:26 | `infra-guardian` | 2ª | APROVADO | `1_task` | O `1_task.md` (seção "Recomendações sem aplicar") diz que três recomendações vão para o `TODO.md`, mas o arquivo não mudou neste diff e não tem a entrada. São… |
| 2026-11-15 16:09:11 | `test-engineer` | 2ª | APROVADO | `1_task` | A linha "sem alcance no `preparar`" de `tasks/prd-reengenharia-continuacao/1_task.md` ainda diz "sem modelo nem `consumo_ia`" para todos os testes que cita, e… |
| 2026-11-15 14:16:59 | `tenancy-guardian` | 1ª | APROVADO | `3_task` | `packages/core/src/jobs/job-executor.test.ts:1` importa `currentContext`, `createLogger` e `JobToRun` de `@educa/core` de dentro do próprio `core`. Convém… |
| 2026-11-15 14:17:23 | `privacy-guardian` | 1ª | APROVADO | `3_task` | Para a 5.0: o job `ia.executar` vai rodar na fila `ferramenta` e precisa manter o `dados` do `job_registro` só com ids, como o `docs/lgpd.md:116` promete. O… |
| 2026-11-15 14:17:26 | `conformidade-reviewer` | 1ª | APROVADO | `3_task` | Para a 5.0, quando o `ia.executar` passar a consumir a `ferramenta`: o que ela gera chega ao aluno como material, atividade ou adaptação, então precisa nascer… |
| 2026-11-15 14:17:59 | `infra-guardian` | 1ª | APROVADO | `3_task` | `packages/core/src/queue/job-outbox.ts:7`: mudar a numeração da `QUEUE_PRIORITY` não atualiza os jobs que já estão esperando no `job_registro` no momento do… |
| 2026-11-15 14:18:08 | `revisor-geral` | 1ª | APROVADO | `3_task` | Imports juntados numa linha só. Cerca de 20 arquivos trocaram o import de várias linhas por uma única linha de mais de 300 caracteres. Isso não era necessário:… |
| 2026-11-15 14:19:16 | `test-engineer` | 1ª | APROVADO | `3_task` | `infra/test/alertas.int.test.ts:305`: o caso da `ferramenta esperando` depende de nenhuma réplica atender a fila. Quando o `worker-ia` nascer, na 5.0, o job… |
| 2026-11-15 15:11:33 | `infra-guardian` | 2ª | APROVADO | `3_task` | Abrir no `TODO.md` um item para pôr `VAGAS_ESCOLA_FERRAMENTA=4` no `.env` da VPS, com dono Joaquim e antes do primeiro deploy com a fila `ferramenta`. O caso… |
| 2026-11-15 15:11:59 | `test-engineer` | 2ª | APROVADO | `3_task` | `3_task.md`, "Recomendações sem aplicar": cinco linhas mandam o trabalho para a tarefa 5.0, mas `tasks/prd-reengenharia-continuacao/5_task.md` não cita nenhuma… |
| 2026-11-15 15:12:15 | `privacy-guardian` | 2ª | APROVADO | `3_task` | Na 5.0, conferir que as duas recomendações minhas encaminhadas para lá viraram teste: `dados` de `ia.executar` só com identificadores, recusado no esquema… |
| 2026-11-15 15:12:22 | `revisor-geral` | 2ª | APROVADO | `3_task` | O empate de prioridade entre as linhas antigas e as novas, até elas terminarem, só está escrito no `3_task.md`. Uma frase na `techspec.md` §5 "A fila", ou no… |
| 2026-11-15 15:12:24 | `conformidade-reviewer` | 2ª | APROVADO | `3_task` | nenhuma nova. |
| 2026-11-15 18:13:42 | `tenancy-guardian` | 1ª | APROVADO | `2_task` | O comentário do `perguntaDaExecucao` (`tutor.repository.ts:328-331`) promete que a execução de outro ano não casa, mas nenhum teste cobre esse caso. Vale… |
| 2026-11-15 18:14:08 | `conformidade-reviewer` | 1ª | APROVADO | `2_task` | `apps/api/src/tutor/turno.command.ts:254`: a transação própria da D36 abre uma segunda conexão enquanto a transação de conclusão (`execucao.scheduler.ts:97`)… |
| 2026-11-15 18:14:19 | `infra-guardian` | 1ª | APROVADO | `2_task` | A transação da D36 abre dentro da transação de conclusão e ocupa duas conexões ao mesmo tempo. O `concluir` roda dentro de `this.banco.transaction` do `gravar`… |
| 2026-11-15 18:14:37 | `privacy-guardian` | 1ª | APROVADO | `2_task` | Falta um teste que prove o caso da eliminação acima: aluno eliminado entre o `preparar` e o `concluir` com `assunto_delicado`, e a transação própria não grava… |
| 2026-11-15 18:14:37 | `revisor-geral` | 1ª | APROVADO | `2_task` | Duas conexões ao mesmo tempo no assunto delicado. Em `apps/api/src/tutor/turno.command.ts:244` e `:254-261`, o `#encaminhar` usa `this.banco.transaction`… |
| 2026-11-15 18:15:35 | `test-engineer` | 1ª | REPROVADO | `2_task` | Falta o bloco de mutação do `exigirCitacoesEntregues`. |
| 2026-11-15 18:16:37 | `llm-integrator` | 1ª | APROVADO | `2_task` | `turno.command.ts`, método `concluir` com `#encaminhar`: no `assunto_delicado`, a conclusão segura uma conexão em transação enquanto a transação própria abre… |
| 2026-11-15 18:44:07 | `infra-guardian` | 2ª | APROVADO | `2_task` | Com o `Promise.all`, o teste da D36 repetida ocupa até quatro conexões do pool ao mesmo tempo: duas transações de conclusão, cada uma com a sua transação… |
| 2026-11-15 18:44:07 | `tenancy-guardian` | 2ª | APROVADO | `2_task` | Em `apps/api/src/tutor/tutor.int.test.ts:1083`, o `rejects` do `comando.preparar` sozinho não prova o escopo do ano. Sem a cláusula do ano, `preparar` ainda… |
| 2026-11-15 18:44:08 | `llm-integrator` | 2ª | APROVADO | `2_task` | A corrida aceita no `concluir` (avaliação abrindo entre a leitura e a gravação) está bem documentada. Vale lembrar na tarefa 5.0, quando o worker separado e a… |
| 2026-11-15 18:44:09 | `conformidade-reviewer` | 2ª | APROVADO | `2_task` | `apps/api/src/tutor/turno.command.ts:261-263` manda o sinal da D36 para a turma da pergunta gravada, sem conferir de novo o vínculo do aluno. O sinal não leva… |
| 2026-11-15 18:44:24 | `privacy-guardian` | 2ª | APROVADO | `2_task` | Os dois `@ts-expect-error` de `registro-de-comandos.test.ts` só são conferidos pelo `tsc` do portão, e o Vitest não os vê. O `expectTypeOf` novo está certo… |
| 2026-11-15 18:44:26 | `revisor-geral` | 2ª | APROVADO | `2_task` | `apps/api/src/tutor/tutor.int.test.ts:1083`: a parte do caso novo que espera `comando.preparar(lida)` rejeitar com `NAO_ENCONTRADO` não prova a cláusula do… |
| 2026-11-15 18:45:05 | `test-engineer` | 2ª | APROVADO | `2_task` | O paralelo não testa a primeira gravação. Em `tutor-modelo.int.test.ts:416-437`, as duas chamadas paralelas rodam depois que o turno já concluiu e gravou a… |
