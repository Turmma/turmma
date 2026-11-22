# Índice dos achados das revisões

Uma linha por rodada que exigiu alguma coisa. O texto inteiro está no arquivo do documento, nesta
pasta (`<documento>.md`), no bloco com o mesmo fim. Escrito pelo hook `tools/processo/revisoes.ts`.
Não edite à mão.

Leia este índice antes de codar, e abra só os blocos que interessam à tarefa de agora.

| Fim | Revisor | Rodada | Veredito | Documento | O que exigiu |
|---|---|---|---|---|---|
| 2026-11-22 09:54:57 | `pedagogia-reviewer` | 1ª | AJUSTES NECESSÁRIOS | `revisao-spec` | B1. Tech Spec §8 e `avaliacao-de-modelos.md` §3, linha "Gerar questão com página" (também a "Rubrica"). O critério é coerência com o trecho e página. Falta… |
| 2026-11-22 09:56:10 | `tenancy-guardian` | 1ª | APROVADO | `revisao-spec` | Tech Spec §3: escrever que a linha da reserva sai do mesmo `InterrompidaEncerrada` (escola do `returning`), na mesma transação do encerramento, sem `@Unscoped`… |
| 2026-11-22 09:57:01 | `llm-integrator` | 1ª | AJUSTES NECESSÁRIOS | `revisao-spec` | `techspec.md` §5, "A chamada" (2), e `cenarios.md` RF3 ("tratar o 429 como queda", "IA_INDISPONIVEL de servidor, e de conexão"): o código não permite a… |
| 2026-11-22 09:58:21 | `privacy-guardian` | 1ª | REPROVADO | `revisao-spec` | Tech Spec §1 e §5 ("A chamada"); cenarios.md linhas 45 e 46. |
| 2026-11-22 09:58:36 | `conformidade-reviewer` | 1ª | REPROVADO | `revisao-spec` | Tech Spec §7b e §8, PRD RF13, `cenarios.md:319` (a guarda da D55), `docs/avaliacao-de-modelos.md` §3, rascunho 12.2, 12.6 e 13.0. |
| 2026-11-22 09:59:12 | `infra-guardian` | 1ª | REPROVADO | `revisao-spec` | O gateway não consegue separar o 429 que sobra de uma queda do provedor. Onde: `techspec.md` §5, "A chamada" ("O 429 que sobra da repetição vale como 'sem… |
| 2026-11-22 10:00:37 | `revisor-geral` | 1ª | REPROVADO | `revisao-spec` | O gateway não distingue o 429 que sobra de uma queda. Está em techspec §5 "A chamada", ramo (2), e em §2, com `cenarios.md` linhas 35 e 38. |
| 2026-11-22 10:00:39 | `test-engineer` | 1ª | REPROVADO | `revisao-spec` | O "429 que sobra vale como sem vaga" não tem como existir no código atual (Tech Spec §5, "A chamada" (2); `cenarios.md:38`). |
| 2026-11-22 10:20:05 | `pedagogia-reviewer` | 2ª | APROVADO | `revisao-spec` | Equidade: definir a métrica (taxa de pares em que o culto passa e o informal não, ou a diferença de taxas) e a taxa medida. Ajustar o cenário e a mutação a… |
| 2026-11-22 10:20:28 | `privacy-guardian` | 2ª | APROVADO | `revisao-spec` | A tarefa da linha 99 está em dois lugares. O rascunho põe a linha 99 na 11.4, mas pela §7 ela fica com a tarefa que grava a coluna verdadeira, que é a 10.0… |
| 2026-11-22 10:20:46 | `llm-integrator` | 2ª | AJUSTES NECESSÁRIOS | `revisao-spec` | §3, "`pelo_provedor_de_reserva`" e "A Operação": a contagem se contradiz e não tem teste. |
| 2026-11-22 10:21:06 | `infra-guardian` | 2ª | APROVADO | `revisao-spec` | Tech Spec §5 ("A chamada", ramo 1): dizer em todas as letras que o `limite` passa pelo modelo menor antes da reserva, como o `cenarios.md` RF3 já exige. Dizer… |
| 2026-11-22 10:23:06 | `revisor-geral` | 2ª | REPROVADO | `revisao-spec` | Tech Spec §5, "A chamada" (1): o trecho "(balde cheio depois da espera e do modelo menor, ou `limite`)" pode ser lido como se o `limite` fosse direto à… |
| 2026-11-22 10:23:33 | `test-engineer` | 2ª | REPROVADO | `revisao-spec` | O caminho do 429 diz uma coisa na §5 e outra no PRD e nos cenários. |
| 2026-11-22 10:23:57 | `conformidade-reviewer` | 2ª | REPROVADO | `revisao-spec` | PRD §5, tabela "A avaliação", linha D55, e §8b. A linha da D55 não elimina o modelo principal. A frase que fecha a tabela só barra o principal em função de… |
| 2026-11-22 10:27:12 | `pedagogia-reviewer` | 3ª | APROVADO | `revisao-spec` | Equidade, o que é "passa": a linha não diz que critério define "passa" num par. Diga que é o critério das linhas de recusa e de citação do Tutor, aplicado… |
| 2026-11-22 10:27:14 | `llm-integrator` | 3ª | APROVADO | `revisao-spec` | Equidade (`avaliacao.md`): o critério de no máximo 1 de 30 usa o líquido de pares. Cinco pares em que só o culto passa contra quatro em que só o informal passa… |
| 2026-11-22 10:29:10 | `test-engineer` | 3ª | REPROVADO | `revisao-spec` | A equidade, em `avaliacao.md` (Regras, "Execuções", e a linha da equidade), e no `cenarios.md` (RF13). |
| 2026-11-22 10:29:16 | `revisor-geral` | 3ª | REPROVADO | `revisao-spec` | `avaliacao.md`, A tabela, linha "Classificação do material". O critério aponta para `docs/aia/diagnostico-por-habilidade.md`, "§4". Essa AIA não tem §4. O… |
| 2026-11-22 10:29:48 | `conformidade-reviewer` | 3ª | REPROVADO | `revisao-spec` | `avaliacao.md` "A regra e o modelo", e `cenarios.md` §1, Avaliação, o caso "A regra e o modelo". Para a ferramenta, uma resposta é "regra" só quando tem… |
| 2026-11-22 10:31:49 | `pedagogia-reviewer` | 4ª | APROVADO | `revisao-spec` | Equidade e a D36. A equidade compara só recusa e citação. O caso de maior risco é o aluno em registro informal que pede ajuda ("tô mal, queria sumir"). Vale… |
| 2026-11-22 10:33:47 | `revisor-geral` | 4ª | APROVADO | `revisao-spec` | `avaliacao.md`, "Critérios de julgamento". Diz que o relatório traz "nos lotes retidos, só o id e a categoria". O RF14 e o próprio anexo, em "Lotes retidos",… |
| 2026-11-22 10:33:52 | `conformidade-reviewer` | 4ª | REPROVADO | `revisao-spec` | Mínimo de 10 na D36. Hoje os 10 podem ser só as amostras "sem risco". O mínimo deveria contar as amostras com risco que escapam do detector. |
| 2026-11-22 10:34:24 | `test-engineer` | 4ª | REPROVADO | `revisao-spec` | A D36 nos lotes retidos mede só metade do alvo (`avaliacao.md`, linha "Assunto delicado (D36), os lotes retidos"; `cenarios.md` RF13, "Os lotes retidos medidos… |
| 2026-11-22 10:37:56 | `conformidade-reviewer` | 5ª | APROVADO | `revisao-spec` | `avaliacao.md`, "A regra e o modelo": a classificação `pediu_resposta_pronta` vem da regra, não do modelo. O texto diz que o `ajustar` "só aplica a… |
| 2026-11-22 10:38:56 | `test-engineer` | 5ª | REPROVADO | `revisao-spec` | `avaliacao.md`, linha "D55, os lotes retidos": "barrados" não diz quem barrou. A regra fixa de `propor_ferramenta` (`conversaPedeJulgamentoDeTextoDeAluno`) já… |
| 2026-11-22 10:43:20 | `test-engineer` | 6ª | REPROVADO | `revisao-spec` | Falta o teste de que a recusa da `reservaQuandoInvalida` conta como barrado (`cenarios.md`, Avaliação, cenário das "Eliminatórias"; regra em `avaliacao.md`,… |
| 2026-11-22 10:46:35 | `test-engineer` | 7ª | REPROVADO | `revisao-spec` | `cenarios.md`, Avaliação (RF13): os "números fiéis" de `relatorio_da_correcao` e de `resumo_do_analista` não têm cenário. Essa regra entrou pelo `avaliacao.md`… |
| 2026-11-22 10:47:59 | `test-engineer` | 8ª | APROVADO | `revisao-spec` | `avaliacao.md`, Tabela, linhas "Relatório da correção" e "Resumo do Analista" / `techspec.md`, §2 (a ferramenta). "A máquina compara com a fixture" não diz o… |
| 2026-11-22 13:13:30 | `conformidade-reviewer` | 1ª | APROVADO | `1_task` | packages/core/src/ia/modelos-aprovados.ts:58 — a guarda só confere que `aprovadoPor` não está vazio. Recomendo que ela recuse `'sintetico'` em entrada que não… |
| 2026-11-22 13:13:40 | `privacy-guardian` | 1ª | APROVADO | `1_task` | `packages/core/src/ia/modelos-aprovados.ts:618-637`: `problemasDosModelosAprovados` não confere `aprovadoEm`, nem se ele está no formato `AAAA-MM-DD`. Isso não… |
| 2026-11-22 13:14:23 | `revisor-geral` | 1ª | APROVADO | `1_task` | `packages/core/src/config/llm-config.ts:240` (`conferirAReserva`): com `IA_RESERVA_ADAPTADOR=falso`, a subida aceita `LLM_RESERVA_BASE_URL`,… |
| 2026-11-22 13:15:37 | `test-engineer` | 1ª | APROVADO | `1_task` | Contagem errada no documento: `1_task.md:57` diz "os cinco casos do describe", mas o describe em `packages/core/src/ia/llm-gateway.test.ts:1633` tem seis `it`.… |
| 2026-11-22 13:20:06 | `infra-guardian` | 1ª | APROVADO | `1_task` | `infra/carga.env:38-41`: as três variáveis da reserva já estão no arquivo, mas o compose ainda não as repassa a nenhum serviço. Hoje elas só chegam aos scripts… |
| 2026-11-22 13:20:08 | `llm-integrator` | 1ª | APROVADO | `1_task` | Em `packages/core/src/ia/modelos-aprovados.ts:30`, o `sha256` do relatório sintético está escrito à mão. O teste da constante o confere contra o disco, então… |
| 2026-11-22 13:20:19 | `llm-integrator` | 2ª | SEM VEREDITO | `1_task` | O `npm run typecheck` inteiro e o conjunto `tools/guardas` com `tools/ci` terminaram limpos, o que fecha a pendência que deixei na resposta anterior. O… |
| 2026-11-22 13:38:26 | `revisor-geral` | 2ª | APROVADO | `1_task` | Em `packages/core/src/config/llm-config.test.ts:438-444`, o caso de staging com a reserva falsa e a mesma identidade do principal falso usa um principal falso.… |
| 2026-11-22 13:38:33 | `test-engineer` | 2ª | APROVADO | `1_task` | No laço de staging e produção da linha 441, conferir também `motivos: [MOTIVO_RESERVA_COM_MODELO_DO_PRINCIPAL]`, e não só `variaveis`. Hoje o caso não separa a… |
