# Índice dos achados das revisões

Uma linha por rodada que exigiu alguma coisa. O texto inteiro está no arquivo do documento, nesta
pasta (`<documento>.md`), no bloco com o mesmo fim. Escrito pelo hook `tools/processo/revisoes.ts`.
Não edite à mão.

Leia este índice antes de codar, e abra só os blocos que interessam à tarefa de agora.

| Fim | Revisor | Rodada | Veredito | Documento | O que exigiu |
|---|---|---|---|---|---|
| 2026-11-20 22:33:57 | `frontend-reviewer` | 1ª | AJUSTES NECESSÁRIOS | `revisao-spec` | Tech Spec §9 e `cenarios.md` §4, diálogo "Orçamento de IA": o `PUT` de rede altera o orçamento de todas as escolas dela sem etapa de confirmação. |
| 2026-11-20 22:34:25 | `llm-integrator` | 1ª | AJUSTES NECESSÁRIOS | `revisao-spec` | Tech Spec §5 (A chamada, ramos (1) e (2)) e `cenarios.md` §1, linhas RF2 e RF4. O Tutor leva texto de aluno, e a regra 20.13 e a D62 têm veto. O envio para a… |
| 2026-11-20 22:35:04 | `conformidade-reviewer` | 1ª | REPROVADO | `revisao-spec` | Tech Spec §5 ("A subida"), §7b e §3 (configuração `IA_RESERVA_TAREFAS`), mais `cenarios.md` §1 na linha do RF4. |
| 2026-11-20 22:35:34 | `tenancy-guardian` | 1ª | REPROVADO | `revisao-spec` | Tech Spec §6 e cenários §2, "A soma do mês". O `OrcamentoDoMesRepository` faz três leituras com escopo: a soma de `consumo_ia`, a contagem de alunos ativos em… |
| 2026-11-20 22:35:39 | `privacy-guardian` | 1ª | REPROVADO | `revisao-spec` | Tech Spec §3, a frase "A regra fixa e a interrompida não mudam." |
| 2026-11-20 22:37:22 | `test-engineer` | 1ª | REPROVADO | `revisao-spec` | Nenhuma rota nova tem cenário na escola sem ano letivo em curso (Tech Spec §4, §5 "Alunos ativos"; cenarios.md §1 RF8 e RF11). A regra da aba Escolas conta… |
| 2026-11-20 22:37:50 | `infra-guardian` | 1ª | REPROVADO | `revisao-spec` | Techspec §4 ("O `PUT` é idempotente pela `chaveEnvio`"), §3 e §7c ("Corridas de concorrência"); cenários §3, linha 2. |
| 2026-11-20 22:38:13 | `revisor-geral` | 1ª | REPROVADO | `revisao-spec` | §4, §6 e §9, rota de uso da IA na Operação. Já existe `GET /v1/operacao/uso` (`painelQuerySchema` com ordem `nome\|uso`, `PainelRepository.uso`). A spec cria… |
| 2026-11-20 22:44:48 | `frontend-reviewer` | 2ª | APROVADO | `revisao-spec` | "Teto de segurança (% do orçamento)" é jargão para o usuário da Operação. Prefira "Limite de uso (% do valor por aluno)", com uma linha de ajuda. |
| 2026-11-20 22:45:00 | `llm-integrator` | 2ª | APROVADO | `revisao-spec` | `techspec.md` §3 diz que a estimativa usa "o preço do modelo que recebeu". `cenarios.md` linha 51 diz "ao maior preço envolvido". Na interrompida o destino… |
| 2026-11-20 22:45:19 | `conformidade-reviewer` | 2ª | APROVADO | `revisao-spec` | Provedor diferente, mesmo modelo (`cenarios.md` RF4, linhas 21 e 22). O cenário troca só o modelo. A mutação "conferir tarefa e modelo, sem o `provedorId`"… |
| 2026-11-20 22:46:02 | `tenancy-guardian` | 2ª | REPROVADO | `revisao-spec` | `cenarios.md` §2, linhas 94 a 102. O bloqueante da rodada 1 só foi resolvido para duas das quatro leituras. |
| 2026-11-20 22:46:26 | `privacy-guardian` | 2ª | REPROVADO | `revisao-spec` | techspec.md §3, "A estimativa", última frase ("a varredura grava também a linha estimada dele"), e cenarios.md §1 RF5, linha 39. A reentrega do job… |
| 2026-11-20 22:47:09 | `infra-guardian` | 2ª | REPROVADO | `revisao-spec` | Tech Spec §3, linha 57, e `cenarios.md` §1, RF5, linha 39: a estimada da reserva está só na varredura. |
| 2026-11-20 22:47:21 | `test-engineer` | 2ª | REPROVADO | `revisao-spec` | O PUT numa escola sem ano letivo em curso continua sem cenário (sobra do bloqueante 1 da rodada 1). Fica em cenarios.md §1 RF7 e Tech Spec §6, onde o PUT roda… |
| 2026-11-20 22:48:22 | `revisor-geral` | 2ª | REPROVADO | `revisao-spec` | novos |
| 2026-11-20 22:51:24 | `privacy-guardian` | 3ª | APROVADO | `revisao-spec` | §3, "A estimativa" (techspec.md:57): a estimada da reserva entra quando a reserva está só configurada, sem exigir que tenha passado na conferência. Uma reserva… |
| 2026-11-20 22:51:52 | `tenancy-guardian` | 3ª | APROVADO | `revisao-spec` | da rodada 2: |
| 2026-11-20 22:52:03 | `infra-guardian` | 3ª | REPROVADO | `revisao-spec` | `tasks/prd-camada-ia/cenarios.md:181` (§5, "Controle negativo"). A spec manda a carga rodar com `AMBIENTE=carga`, e esse ambiente não existe. Os valores… |
| 2026-11-20 22:53:08 | `revisor-geral` | 3ª | REPROVADO | `revisao-spec` | `tasks/prd-camada-ia/techspec.md:55-56` (§3, "A estimativa"): a interrompida aparece com "entrada contada". |
| 2026-11-20 22:53:30 | `test-engineer` | 3ª | REPROVADO | `revisao-spec` | cenarios.md §5:181, "A carga roda com `AMBIENTE=carga`". Esse valor não existe. `SYSTEM_ENVIRONMENTS` (packages/shared/src/system/status.ts:4) só tem `local`,… |
| 2026-11-20 22:55:46 | `infra-guardian` | 4ª | REPROVADO | `revisao-spec` | `tasks/prd-camada-ia/cenarios.md:183-186` (§5, "Controle negativo") e `tasks/prd-camada-ia/techspec.md:77-79` (§5, "A aprovação"): com… |
| 2026-11-20 22:55:57 | `test-engineer` | 4ª | REPROVADO | `revisao-spec` | cenarios.md §1 RF4, linha 26: a mutação "isentar a entrada do falso da guarda" não fica vermelha. |
| 2026-11-20 22:55:59 | `revisor-geral` | 4ª | APROVADO | `revisao-spec` | `techspec.md:4`: o cabeçalho de status ainda diz "com as correções da rodada 1". Atualizar para a rodada em que a spec for aprovada. |
| 2026-11-20 22:57:22 | `infra-guardian` | 5ª | APROVADO | `revisao-spec` | cenarios.md, RF4, linha 28: deixar explícito se a recusa de `IA_RESERVA_PROVEDOR_ID=falso-reserva` sobre `openai_compat` vale em todo ambiente ou só em… |
| 2026-11-20 22:58:04 | `test-engineer` | 5ª | REPROVADO | `revisao-spec` | techspec.md §7c, linha 143, contra cenarios.md RF9, linha 75. A cláusula "`ia.provedor_de_reserva.conferido` (0 por 10 min, só com reserva configurada)" não… |
| 2026-11-20 22:59:19 | `test-engineer` | 6ª | APROVADO | `revisao-spec` | Série presa em 0, `cenarios.md:17` (RF1): depois do cadastro corrigido sem reiniciar, o cenário confere só que a chamada vai à reserva. Não confere que… |
| 2026-11-20 23:17:22 | `test-engineer` | 7ª | REPROVADO | `revisao-spec` | as faltas de cada tarefa. Em cada uma, uma linha de cenário ficou sem teste ou foi juntada a outra de um jeito que deixa a mutação viva. |
| 2026-11-20 23:23:32 | `test-engineer` | 1ª | REPROVADO | `6_task` | A Governança não testa os textos do orçamento (`tasks/prd-camada-ia/6_task.md:54`). |
| 2026-11-21 01:42:16 | `tenancy-guardian` | 1ª | APROVADO | `1_task` | O caso novo "a linha é da escola de quem gastou" (`ia.int.test.ts`) só confere que B não ganhou linha. Ele não confere que a linha nova está em A. Somar… |
| 2026-11-21 01:42:31 | `privacy-guardian` | 1ª | APROVADO | `1_task` | Em `packages/core/src/ia/llm-gateway.ts:304-305`, há dois docblocks seguidos acima de `chamarContando`. O primeiro ("Uma chamada ao adaptador, medida…") é do… |
| 2026-11-21 01:42:45 | `conformidade-reviewer` | 1ª | APROVADO | `1_task` | `apps/web/src/areas/coordenacao/governanca/textos-da-governanca.ts:114`: o texto "O custo em reais ainda não é medido nesta versão" deixou de ser exato. A… |
| 2026-11-21 01:42:55 | `llm-integrator` | 1ª | APROVADO | `1_task` | `packages/core/src/ia/llm-gateway.ts` (acima de `chamarContando`, perto da linha 416): o docblock antigo "Uma chamada ao adaptador, medida…" ficou solto sobre… |
| 2026-11-21 01:43:25 | `infra-guardian` | 1ª | APROVADO | `1_task` | `packages/core/src/ia/llm-gateway.ts:290`: no caminho da falha, `registrarLinhas(...).catch(() => undefined)` descarta sem rastro a linha de custo que não… |
| 2026-11-21 01:43:47 | `revisor-geral` | 1ª | REPROVADO | `1_task` | Divergência sem cenário. O problema está em `tasks/prd-camada-ia/1_task.md:103`, que é a segunda linha de "Divergências resolvidas", e em… |
| 2026-11-21 01:44:46 | `test-engineer` | 1ª | APROVADO | `1_task` | `tasks/prd-camada-ia/1_task.md:53`: a parte I da linha "duas vigências" cita `ia.int.test.ts › grava o custo em micros que a linha traz`. Esse caso prova que o… |
| 2026-11-21 02:06:16 | `revisor-geral` | 2ª | APROVADO | `1_task` | A linha RF5 nova em `cenarios.md:51` cita só o arquivo, sem a camada ("unidade, `llm-gateway.test.ts`"). Outras linhas do documento trazem a camada junto, e… |
| 2026-11-21 02:07:01 | `test-engineer` | 2ª | APROVADO | `1_task` | nenhuma nova. As da 1ª rodada estão todas na tabela "Sem aplicar" do `1_task.md`, cada uma com destino ou motivo. Entre elas, o relógio falso no caso da troca… |
| 2026-11-21 03:32:02 | `conformidade-reviewer` | 1ª | APROVADO | `2_task` | O comentário de `packages/core/drizzle/0067_indice_do_consumo_do_mes.sql` (penúltima linha de comentário) diz que o `EXPLAIN` está em… |
| 2026-11-21 03:32:05 | `tenancy-guardian` | 1ª | APROVADO | `2_task` | `packages/core/src/ia/orcamento-do-mes.repository.ts:24`: `alunosAtivosDaEscola(escolaId: SQL)` está exportado no índice do núcleo e recebe a escola por… |
| 2026-11-21 03:32:35 | `infra-guardian` | 1ª | APROVADO | `2_task` | `packages/core/drizzle/0067_indice_do_consumo_do_mes.sql:6-7`: o comentário diz que a criação com volume de produção vai para uma migration fora do `migrar`,… |
| 2026-11-21 03:32:38 | `privacy-guardian` | 1ª | APROVADO | `2_task` | Coloque `pelo_provedor_de_reserva` na linha 99 do `docs/lgpd.md` na tarefa que começa a gravar a coluna como verdadeira, a 10.0 (subtarefa 10.4). Hoje isso… |
| 2026-11-21 03:33:17 | `test-engineer` | 1ª | APROVADO | `2_task` | O comentário em `packages/core/drizzle/0067_indice_do_consumo_do_mes.sql:8` diz que o `EXPLAIN` está em `orcamento-do-mes.repository.int.test.ts`. Ele está em… |
| 2026-11-21 03:33:45 | `revisor-geral` | 1ª | APROVADO | `2_task` | Comentário errado na 0067 (`packages/core/drizzle/0067_indice_do_consumo_do_mes.sql`, cabeçalho). Três trechos afirmam o que não acontece: |
| 2026-11-21 03:49:24 | `tenancy-guardian` | 2ª | APROVADO | `2_task` | Na 5.0, quando `PainelRepository` passar a usar `alunosAtivosDaEscola` (`apps/api/src/operacao/painel/painel.repository.ts:102`, item já no `TODO.md`),… |
| 2026-11-21 03:49:30 | `privacy-guardian` | 2ª | APROVADO | `2_task` | O título do caso em `orcamento-do-mes.repository.int.test.ts:297` diz "a do último valor", mas as duas regravações gravam o mesmo valor, e o caso confere só a… |
| 2026-11-21 03:49:36 | `infra-guardian` | 2ª | APROVADO | `2_task` | `packages/core/src/ia/orcamento-do-mes.repository.int.test.ts:297`: o título promete "a do último valor", mas as duas regravações gravam o mesmo retrato, então… |
| 2026-11-21 03:49:51 | `revisor-geral` | 2ª | APROVADO | `2_task` | O nome do caso novo em `packages/core/src/ia/orcamento-do-mes.repository.int.test.ts:297` diz "a do último valor", mas as duas regravações gravam o mesmo… |
| 2026-11-21 03:49:51 | `conformidade-reviewer` | 2ª | APROVADO | `2_task` | Na 4.0, quando o processador de lote passar a devolver `IA_ORCAMENTO_ESGOTADO` pelo teto (`packages/shared/src/errors/error-code.ts:134-137`), conferir que o… |
| 2026-11-21 03:50:11 | `test-engineer` | 2ª | APROVADO | `2_task` | O nome do caso novo, em `orcamento-do-mes.repository.int.test.ts:297`, promete "a do último valor", mas as duas réplicas gravam o mesmo retrato, e a asserção… |
| 2026-11-21 04:53:43 | `conformidade-reviewer` | 1ª | APROVADO | `3_task` | Na 4.0, quando o teto bloquear chamadas de IA, garantir que o corte do Tutor não deixe o professor sem ver um uso já iniciado (regra 70, item 4). O aviso ao… |
| 2026-11-21 04:54:01 | `privacy-guardian` | 1ª | APROVADO | `3_task` | `packages/core/src/auditoria/auditoria.repository.ts:58`: o `listDaEscola` devolve toda linha com o `escola_id` da escola, e isso agora inclui… |
| 2026-11-21 04:54:10 | `tenancy-guardian` | 1ª | APROVADO | `3_task` | Regra 10, item 9: o módulo `operacao/painel` passa a ter quatro `@Unscoped`, três em `painel.repository.ts` e um em `orcamento-da-rede.repository.ts`. Todos… |
| 2026-11-21 04:54:30 | `infra-guardian` | 1ª | APROVADO | `3_task` | apps/api/src/operacao/painel/orcamento-da-rede.repository.ts:28 |
| 2026-11-21 04:54:44 | `revisor-geral` | 1ª | REPROVADO | `3_task` | `tasks/prd-camada-ia/techspec.md:69-71`. Para registrar as divergências, a tarefa pôs uma linha em branco e um parágrafo ("O corpo do `PUT` é um… |
| 2026-11-21 04:56:44 | `test-engineer` | 1ª | APROVADO | `3_task` | `apps/api/test/painel-escrita.int.test.ts`, o caso "o PUT em A não muda a configuração de B…": a parte "nem o que vale para a escola B" não prova nada. A… |
| 2026-11-21 05:53:54 | `revisor-geral` | 2ª | APROVADO | `3_task` | `apps/api/test/painel-escrita.int.test.ts:682`: `semRequisicaoDe` é cópia de `semRequisicao`, definida na linha 619 do mesmo arquivo. Vale subir uma das duas… |
| 2026-11-21 05:54:16 | `test-engineer` | 2ª | APROVADO | `3_task` | A checagem dos centavos e do teto no log (`:520` e `:582`) só pega campo numérico do evento (`:\s*300\b`). Se o valor fosse logado como texto (`"300"`) ou… |
| 2026-11-21 05:07:26 | `tenancy-guardian` | 1ª | APROVADO | `4_task` | O caso A/B prova o escopo da soma do custo. O escopo da contagem de alunos ativos e do valor por aluno continua provado só pelos testes da 2.0, em… |
| 2026-11-21 05:07:46 | `privacy-guardian` | 1ª | APROVADO | `4_task` | A anotação `summary` dos três alertas (`infra/grafana/alertas/ia-orcamento-do-mes.yaml`, `infra/grafana/alertas/ia-orcamento-teto.yaml`) leva `escola_id` ao… |
| 2026-11-21 05:07:51 | `conformidade-reviewer` | 1ª | APROVADO | `4_task` | Os parágrafos do runbook do teto mandam a Operação avisar a coordenação de que o material novo fica sem habilidade da BNCC até a virada do mês… |
| 2026-11-21 05:07:59 | `llm-integrator` | 1ª | APROVADO | `4_task` | `apps/worker/src/orcamento-gauge.ts:56`: a série `uso_do_teto` usa divisão em ponto flutuante, `custoMicros / ((orcamentoMicros * tetoPercentual) / 100)`, e o… |
| 2026-11-21 05:08:20 | `revisor-geral` | 1ª | APROVADO | `4_task` | Local do teste da espera no `cenarios.md`. A linha de RF10 sobre "Às 23h50 do último dia… 600; no meio do mês, 3.600" aponta o teste em… |
| 2026-11-21 05:08:31 | `infra-guardian` | 1ª | APROVADO | `4_task` | apps/worker/src/orcamento-gauge.ts:49-53: quando `encerrar` corta a volta no meio, a classe base devolve sem trocar `uso_do_mes`, e o `override medir()` troca… |
| 2026-11-21 05:09:33 | `test-engineer` | 1ª | REPROVADO | `4_task` | A corrida das duas réplicas não é forçada. Em `apps/worker/test/orcamento-gauge.int.test.ts:221`, a espera `esperarNaTrava(bancada.pool,… |
| 2026-11-21 05:37:05 | `revisor-geral` | 2ª | APROVADO | `4_task` | `apps/api/src/ia/orcamento-teto.int.test.ts:151`: o caso que diz que "a espera é o único número da linha" deixa de fora, pelo nome, as chaves `nivel`, `level`,… |
| 2026-11-21 05:37:25 | `test-engineer` | 2ª | APROVADO | `4_task` | O caso novo cobre `ferramenta` e `interativa` pelo gateway, mas não `normal`. A fila `normal` continua provada só no repository. Um terceiro item no mesmo laço… |
