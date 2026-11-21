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
