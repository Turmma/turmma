# Índice dos achados das revisões

Uma linha por rodada que exigiu alguma coisa. O texto inteiro está no arquivo do documento, nesta
pasta (`<documento>.md`), no bloco com o mesmo fim. Escrito pelo hook `tools/processo/revisoes.ts`.
Não edite à mão.

Leia este índice antes de codar, e abra só os blocos que interessam à tarefa de agora.

| Fim | Revisor | Rodada | Veredito | Documento | O que exigiu |
|---|---|---|---|---|---|
| 2026-11-03 12:23:23 | `frontend-reviewer` | 1ª | AJUSTES NECESSÁRIOS | `revisao-spec` | Tech Spec §10 (Testes) e PRD RF18 não incluem o projeto Playwright `celular`. |
| 2026-11-03 12:25:41 | `tenancy-guardian` | 1ª | REPROVADO | `revisao-spec` | Seções 1, 5 ("E-mail"), 6 e 11: o worker lê a conta global e isso não está declarado. |
| 2026-11-03 12:26:40 | `infra-guardian` | 1ª | REPROVADO | `revisao-spec` | Job de planilha rodando duas vezes ao mesmo tempo (seção 5 "Planilha" e 7c "Corridas"). |
| 2026-11-03 12:26:44 | `test-engineer` | 1ª | REPROVADO | `revisao-spec` | Seção 10, "Integração: cada RF" não é estratégia de teste. Várias cláusulas do PRD ficaram sem teste previsto. A Tech Spec precisa listar um teste por cláusula: |
| 2026-11-03 12:27:25 | `privacy-guardian` | 1ª | REPROVADO | `revisao-spec` | B1 a B6, abaixo |
| 2026-11-03 12:27:49 | `revisor-geral` | 1ª | REPROVADO | `revisao-spec` | §1 e §2: o worker não alcança o que a §5 manda ele fazer. |
| 2026-11-03 12:34:18 | `frontend-reviewer` | 2ª | APROVADO | `revisao-spec` | `prd.md` RF18 diz "e2e em `chromebook`", e a Tech Spec §10 diz `chromebook` e `celular`. Alinhe o RF18 para não confundir quem implementa. |
| 2026-11-03 12:36:10 | `tenancy-guardian` | 2ª | REPROVADO | `revisao-spec` | `techspec.md:113-115` (§5 "E-mail") e linha 102 (tabela de estados): o tipo e a escola do job que envia o link da conta não estão definidos, e como escrito o… |
| 2026-11-03 12:36:36 | `test-engineer` | 2ª | REPROVADO | `revisao-spec` | B1, em parte (`techspec.md:176-177`, `:118`). Limites e taxas da §7c sem cenário. Cada um precisa da sua linha no `cenarios.md`, na seção da rota: |
| 2026-11-03 12:36:50 | `privacy-guardian` | 2ª | REPROVADO | `revisao-spec` | techspec.md:129-134 (§5, "Senha provisória") e :218-219 (§13). O que está errado: o uso da provisória é auditado, mas sem dizer quem usou, e o aluno nunca fica… |
| 2026-11-03 12:37:26 | `infra-guardian` | 2ª | REPROVADO | `revisao-spec` | techspec.md:98-101 (§5, tabela de estados, linha `na_fila`). A correção deixou um estado sem saída. |
| 2026-11-03 12:37:58 | `revisor-geral` | 2ª | REPROVADO | `revisao-spec` | O worker alcança a conta global, e a spec diz que não alcança. Os trechos são `techspec.md:15` ("o worker nunca lê a `conta`"), `techspec.md:22` ("sobe de… |
| 2026-11-03 12:47:21 | `frontend-reviewer` | 3ª | APROVADO | `revisao-spec` | §9 e §5 "Senha provisória" não definem o carregando, o vazio e a falha da lista de trocas. |
| 2026-11-03 12:48:08 | `tenancy-guardian` | 3ª | REPROVADO | `revisao-spec` | §6 (e §2, §11). A cerca da `ContaGlobalRepository` vira uma pasta inteira de repositories com escopo. |
| 2026-11-03 12:49:15 | `privacy-guardian` | 3ª | REPROVADO | `revisao-spec` | Tech Spec §5, "Senha provisória" ("aluno só com conta externa: `SEM_SENHA`"), e §13. |
| 2026-11-03 12:49:34 | `test-engineer` | 3ª | REPROVADO | `revisao-spec` | O prazo do expurgo da importação parada está escrito de dois jeitos. |
| 2026-11-03 12:49:55 | `revisor-geral` | 3ª | REPROVADO | `revisao-spec` | §2 e §5 "Gravar", o `fechar` aceitando `encerrada`. A correção 1 abriu este problema. |
| 2026-11-03 12:50:01 | `infra-guardian` | 3ª | REPROVADO | `revisao-spec` | da rodada 2 |
| 2026-11-03 12:57:12 | `test-engineer` | 4ª | REPROVADO | `revisao-spec` | A aprovação ainda perde o nome corrigido, na ordem inversa da corrida (techspec.md §5 "O job"; cenarios.md:37-38 e :229). |
| 2026-11-03 12:57:12 | `tenancy-guardian` | 4ª | APROVADO | `revisao-spec` | §6, zona do `link_da_conta`. A zona lista só o worker: `apps/worker/src/processors/enviar-email.ts` e "o expurgo de acesso". Mas a §5 lê e grava o link pelo… |
| 2026-11-03 12:57:17 | `privacy-guardian` | 4ª | REPROVADO | `revisao-spec` | §5 "Senha provisória" contra a linha "Senha provisória do aluno" do `docs/lgpd.md`. |
| 2026-11-03 12:57:45 | `infra-guardian` | 4ª | REPROVADO | `revisao-spec` | da rodada 3: os dois foram resolvidos. |
| 2026-11-03 12:57:52 | `revisor-geral` | 4ª | APROVADO | `revisao-spec` | da rodada 3: todas feitas. São elas: o `convidar` no job (§5), a cerca por arquivo (§6), os quatro `@Unscoped` (§11, conferi: o `ContaGlobalRepository` tem… |
| 2026-11-03 13:04:12 | `privacy-guardian` | 5ª | REPROVADO | `revisao-spec` | O `docs/lgpd.md` (linhas "Envio do convite por e-mail", "Link da conta" e "Senha provisória") e o `cenarios.md` não acompanham a retenção que a §5 constrói.… |
| 2026-11-03 13:05:01 | `test-engineer` | 5ª | REPROVADO | `revisao-spec` | `techspec.md:91-96`: o passo (3) não reconfere o que o passo (2) leu sem trava. A divisão em três passos abriu uma janela entre (2) e (3), e só duas mudanças… |
| 2026-11-03 13:05:45 | `infra-guardian` | 5ª | REPROVADO | `revisao-spec` | §5 "O job", passo (3), e a linha "Job contra a decisão do professor" das Corridas do `cenarios.md`. |
| 2026-11-03 13:09:56 | `privacy-guardian` | 6ª | REPROVADO | `revisao-spec` | `docs/lgpd.md`, linha "Senha provisória do aluno", e a provisória na §5. O texto diz "no vencimento, pelo `retencao.expurgar-escola` da noite (na pior… |
| 2026-11-03 13:10:58 | `test-engineer` | 6ª | REPROVADO | `revisao-spec` | O (3) não relê o vínculo, e a correção do bloqueante 1 ficou incompleta. techspec.md:95-98, §5 "O job". |
| 2026-11-03 13:12:46 | `infra-guardian` | 6ª | REPROVADO | `revisao-spec` | §5 "O job", passo (3), contra o ciclo de vida: a ordem das travas está invertida e pode dar `40P01`. |
| 2026-11-03 13:15:50 | `privacy-guardian` | 7ª | APROVADO | `revisao-spec` | `docs/lgpd.md`, linha "Acesso da turma": ainda diz que "a desativação do professor ainda não revoga: ela não termina vínculo, `TODO.md`, F2". Esta spec muda… |
| 2026-11-03 13:16:29 | `test-engineer` | 7ª | REPROVADO | `revisao-spec` | O "Enviar" e o "Reenviar" que fazem `convite/refazer` (linha nova) não têm cenário que caia sem a regra (techspec.md:78). |
| 2026-11-03 13:17:50 | `infra-guardian` | 7ª | APROVADO | `revisao-spec` | §2 e §5, "turmas por id num comando": escrever "em ordem de id (`order by id`)". Um comando só não fixa a ordem das travas quando dois planos são diferentes,… |
