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
