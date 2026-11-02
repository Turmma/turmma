# Achados das revisões — `tasks/correcoes/2026-11-02-mensagem-do-tutor-por-ano.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-02 00:46:02 · `tasks/correcoes/2026-11-02-mensagem-do-tutor-por-ano.md`

VEREDITO: APROVADO

A correção só reduz quem alcança a mensagem. A resposta do Tutor passa a ser achada apenas dentro do ano letivo em curso, como as outras leituras da classe. Não entra campo novo, log, envio externo nem resposta nova.

Campos pessoais tocados: nenhum campo novo. A leitura de `mensagem_tutor` (`texto`, `tipo`, `citacoes`), que é conteúdo de conversa de aluno, ficou mais restrita.
Fora da tabela de dados do docs/lgpd.md: nada.
Autorização por objeto: ok. `GET /v1/execucoes/:id` já exigia, em `deQuemPediu`, que a execução fosse de quem pediu e do ano em curso. Agora `mensagemDoTutor` filtra por escola, ano em curso, id, autor `tutor` e o próprio aluno (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/api/src/ia/execucao.repository.ts:172`). Troquei o id mentalmente: a mensagem de outro aluno, de outra escola ou de outro ano não é achada. Inexistente e sem permissão respondem igual, `NAO_ENCONTRADO`. A resposta segue em DTO explícito, montado campo a campo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/api/src/ia/execucoes.service.ts:34-36`. Sem ano no contexto, `requireAnoEmCurso()` falha fechado antes de ler, com o mesmo código.
Logs: limpos. O diff não acrescenta log.
Auditoria: não se aplica. É leitura do aluno sobre a própria conversa, não leitura por coordenação ou rede, nem exportação, nota, permissão ou aprovação de saída de IA.
Envio externo: nenhum. A correção não chama modelo e não muda `ExecucaoAgente`.
Seed/fixture: sintético. O teste novo grava ano 2025, "turma de 2025" e o texto "resposta sintética de 2025", com ids do próprio teste (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/api/src/ia/ia.int.test.ts:959-989`).
Bloqueantes: nenhum.
Recomendações:
- Fica registrado: com o filtro, o aluno só lê pela rota de execução a resposta do Tutor do ano em curso. Isso não tira dele o acesso aos dados de anos anteriores, porque o pedido do titular passa pelo arquivo do titular, por outro caminho que o diff não toca. Não conferi esse caminho nesta rodada. Se quiserem a prova, um caso em `apps/api/test/arquivo-do-titular.int.test.ts` mostrando que esse arquivo traz a mensagem do Tutor de um ano encerrado.

Pergunta de fechamento: a correção não muda nada no inventário do aluno nem no registro do que foi enviado para fora. Só fecha o alcance de uma leitura.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-02 00:46:06 · `tasks/correcoes/2026-11-02-mensagem-do-tutor-por-ano.md`

VEREDITO: APROVADO
Caminho quente tocado: tutor
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- A mudança em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/api/src/ia/execucao.repository.ts` (linha 172) só acrescenta um filtro a uma leitura que já busca pela chave primária `id`. Para as sessenta turmas às 10h, isso não muda o plano de consulta nem a carga do polling de `GET /v1/execucoes/:id`.
- Também não quebra o fluxo atual. A resposta é gravada com o `anoLetivoId` da sessão do aluno (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/api/src/tutor/tutor.repository.ts`, linha 250). Esse é o mesmo ano que `deQuemPediu` já exige da execução, então nenhuma resposta do ano em curso deixa de ser achada.
- O caso novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/api/src/ia/ia.int.test.ts` (linhas 959 a 989) grava na escola B um ano 2025, uma turma, uma execução e uma mensagem que ficam até o fim do `describe`. As duas consultas `limit 1` do teste de isolamento já foram presas ao ano. Se outro caso posterior da escola B ler `mensagem_tutor` ou `execucao_agente` sem filtrar o ano, ele passa a depender da ordem dos testes. Vale mover esses dados para um contexto próprio ou apagá-los no fim do caso.
- Preencher a seção "Recomendações sem aplicar" do documento da correção depois das rodadas.

## test-engineer · 1ª rodada · APROVADO · 2026-11-02 10:47:47 · `tasks/correcoes/2026-11-02-mensagem-do-tutor-por-ano.md`

VEREDITO: APROVADO

Cenários exigidos:
- Caminho feliz: o aluno acha a resposta do Tutor quando o contexto está no ano letivo da própria mensagem.
- Borda (virada de ano letivo): mesma escola, mesmo aluno, mensagem de 2025 lida com o contexto em 2026. Não deve ser achada.
- Borda: contexto sem ano letivo. Deve falhar fechado com `NAO_ENCONTRADO` antes de ler, sem cair num ano qualquer.
- Permissão: outro aluno da mesma escola não alcança a resposta do colega.
- Isolamento: com a escola A e a pessoa e o ano de B no contexto, a mensagem de B não é achada. A cláusula de escola tem de valer sozinha, mesmo agora que existe a de ano.
- Concorrência: não se aplica. É uma leitura só, sem escrita nem efeito.

Cobertos:
- Caminho feliz e as duas bordas estão no caso novo, `apps/api/src/ia/ia.int.test.ts:959`, "a resposta do Tutor é do ano letivo em que foi dada…". Ele tem três asserções sobre o resultado: `toBeUndefined` no ano em curso, `toMatchObject({ id })` no ano da mensagem e `NAO_ENCONTRADO` sem ano.
- Permissão: o caso que já existia ("apontaParaOColega", por volta da `:880`) cobre, com 404 igual para os três ids.
- Isolamento: o caso `:900` segue firme. Ele usa o ano de B no contexto, então a cláusula de ano não esconde a remoção da de escola, e o segundo bloco de mutação prova isso. As consultas `limit 1` das linhas `:910` e `:912` agora filtram por `ano_letivo_id`, então a mensagem de 2025 que o caso novo põe na escola B não pode virar o id escolhido. Conferi que nenhuma outra consulta à `mensagem_tutor` no arquivo pega linha de B sem chave de execução (`:534`, `:587` e `:868` não pegam).
- Mutações contra o `git diff`: há uma única cláusula nova, `eq(mensagemTutor.anoLetivoId, requireAnoEmCurso())`, e ela tem bloco. Sem a cláusula, a mensagem de 2025 é achada no contexto de 2026 e o `toBeUndefined` falha. O vermelho vem do motivo certo: escola, aluno e autor são os mesmos, só o ano muda. A parte "sem ano" também ficaria vermelha, porque sem a cláusula o método não chama `requireAnoEmCurso` e devolve a linha.
- Sem `.skip`, sem teste comentado, sem mock que esconda a regra: o teste usa o repository real com Postgres. Não há chamada a provedor pago. O Tutor de B no caso `:900` roda pelo executor do teste, com o adaptador falso.
- Rodei aqui: os 3 casos filtrados pelo nome passaram, e o arquivo inteiro passou (39 de 39). A ordem dos casos não interfere.

Bloqueantes: nenhum.

Recomendações:
1. `apps/api/src/ia/ia.int.test.ts:959`: falta um caso pela rota `GET /v1/execucoes/:id`. Seria uma execução forjada do ano em curso cujo `resultado.mensagemId` aponta para a mensagem de 2025, exigindo 404 com o mesmo corpo dos outros casos de recusa. Hoje a prova está só no repository. Isso basta para a cláusula, mas o caso mostraria o efeito na resposta da API.
2. `apps/api/src/ia/ia.int.test.ts:962-963`: o caso depende de nenhum outro caso abrir 2025 na escola B. O comentário explica a escolha ("um por escola e ano"), mas o próximo caso de virada de ano em B vai bater na unicidade. Um ano exclusivo do caso, ou um ajudante que crie ou reaproveite o ano anterior, evita o acoplamento.
3. A mesma recomendação 1 vale para o caso irmão do Assistente (`:928`), para registro na retro.
