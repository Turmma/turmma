# Achados das revisões — `tasks/correcoes/2026-11-02-mensagem-do-assistente-por-ano.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-02 00:16:43 · `tasks/correcoes/2026-11-02-mensagem-do-assistente-por-ano.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum. A leitura em `GET /v1/execucoes/:id` ganha um filtro a mais; a rota, a fila, a chamada de IA e o schema continuam iguais.
Rate limit: ok. A correção não toca nisso.
Fila e prioridade: ok. A correção não toca nisso.
Concorrência: protegida. A consulta só lê, e não há "busca, verifica, grava".
Índice e paginação: ok. A consulta acha uma linha só pela chave primária `mensagem_agente.id`. A cláusula `eq(mensagemAgente.anoLetivoId, requireAnoEmCurso())` só filtra essa linha e não muda o plano da consulta. Não há listagem, então não há paginação.
Degradação de IA: não se aplica.
Migration: não se aplica.
Métrica e alerta: ok. Não entrou código novo no caminho quente nem alerta novo.
Bloqueantes: nenhum.
Recomendações:
- A correção não abre caminho novo de erro na rota. Antes de `mensagemDoAssistente`, o serviço chama `deQuemPediu` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/api/src/ia/execucoes.service.ts:18`), e esse método já exige `requireAnoEmCurso()` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/api/src/ia/execucao.repository.ts:144`). Sem ano letivo no contexto, a requisição já respondia `NAO_ENCONTRADO` antes desta correção.
- `mensagemDoTutor`, no mesmo repository, tem o mesmo desenho e não foi olhada aqui. Vale o `tenancy-guardian` conferir se ela filtra pelo ano letivo da mensagem.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-02 00:16:48 · `tasks/correcoes/2026-11-02-mensagem-do-assistente-por-ano.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. A correção só lê `mensagem_agente.conteudo`, a resposta do Assistente ao professor, que já estava mapeada. Não há migration nem coluna nova.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. Antes, `GET /v1/execucoes/:id` já filtrava a mensagem por escola, por `autor = 'agente'` e por quem é dono da thread (`threadAgente.usuarioId = requireUsuarioId()`). A correção acrescenta o filtro de ano letivo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/api/src/ia/execucao.repository.ts:159`. A rota responde do mesmo jeito em todos os casos:
- Mensagem de outro ano: devolve `undefined`, e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/api/src/ia/execucoes.service.ts:27` responde `NAO_ENCONTRADO`.
- Contexto sem ano letivo: `requireAnoEmCurso` lança `NAO_ENCONTRADO` antes de ler o banco.
- Id inexistente, de outra pessoa ou de outra escola: também `NAO_ENCONTRADO`.

Nada disso revela que o registro existe (regra 20, item 6). O único lugar que chama o método é `execucoes.service.ts:26`, que antes já passa por `deQuemPediu`, e esse também filtra pelo ano em curso. Com a correção, as três leituras da classe passam a usar o mesmo escopo.

Logs: limpos. O diff não acrescenta nenhum log.

Auditoria: presente onde a regra exige. É a própria pessoa lendo a resposta do agente na conversa dela, nenhuma das ações da regra 20, item 10, e a correção não cria ação nova que precise de registro.

Envio externo: nenhum. A correção não chama modelo e não muda o que vai para o provedor.

Seed/fixture: sintético. O teste novo grava ano letivo 2025, thread, execução e a mensagem `"resposta sintética de 2025"`, tudo ligado ao professor que a bancada cria. Nenhum nome, matrícula ou conteúdo real.

Bloqueantes: nenhum.

Recomendações:
- Corrigir o comentário do teste novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/api/src/ia/ia.int.test.ts:924`. Ele diz "mesma thread lógica", mas o teste cria outra thread no ano anterior. "Mesma escola e mesma pessoa, outra thread no ano anterior" descreve melhor o que o teste faz.
- Para quem pede a lista do que o sistema guarda sobre alguém: a resposta do Assistente de um ano anterior continua no banco e entra na retenção e no arquivo do titular. A correção só tira essa resposta do alcance da leitura no ano em curso, não muda o ciclo de vida. Vale manter isso explícito se essa pergunta voltar.

Pergunta de fechamento: a correção não muda o que o sistema guarda nem para onde envia, e as respostas de anos anteriores continuam acessíveis pelo caminho do titular. Nada nela deixa de responder à secretaria.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-02 00:16:51 · `tasks/correcoes/2026-11-02-mensagem-do-assistente-por-ano.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta correção. O diff só mexe numa leitura (`ExecucaoDaSessaoRepository.mensagemDoAssistente`) e no teste dela. A fixture nova grava `ano_letivo`, `thread_agente`, `execucao_agente` (`propor_ferramenta`) e `mensagem_agente` com texto sintético, e nenhuma dessas é `Nota`. Todos com autor humano? sim, porque nenhum caminho de escrita em `Nota` foi criado nem alterado.

Decisão autônoma sobre aluno: ausente. A mudança apenas limita a busca da resposta do Assistente que o próprio professor pediu: agora a mensagem precisa ser do ano letivo em curso.

Aprovação registrada: ok. A correção não mexe no fluxo de aprovação de nenhuma saída de IA e não estende a exceção do tutor (D47) a outro agente. O Assistente continua passando pela entrega pendente; a correção só tira do alcance, pelo id, uma mensagem de outro ano.

Supervisão do tutor: ok. `mensagemDoTutor` e o caminho de supervisão do professor não mudaram, e a leitura nova não tira do professor nada que ele via sobre o uso do tutor.

Autonomia declarada e visível: sim, sem mudança. A governança e o nível dos agentes não foram tocados.

Bloqueantes: nenhum.

O que verifiquei:
- O único chamador é `ExecucoesService.resultadoParaATela` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/api/src/ia/execucoes.service.ts:26`). Antes dele roda `deQuemPediu`, que já exige `requireAnoEmCurso()`. Por isso o novo `NAO_ENCONTRADO`, lançado quando falta o ano, não muda o comportamento da rota `GET /v1/execucoes/:id`.
- A consulta da auditoria ("o que a IA gerou, quem aprovou, quando") não depende deste método. A mudança não tira da coordenação nem do dossiê nenhum registro de IA.
- Pelos itens 7 a 9 da regra 70 a correção está limpa. Ela não traz inferência emocional nem métrica de professor, e a conversa do professor com o chat continua presa ao `usuarioId` dele (`threadAgente.usuarioId = requireUsuarioId()`), sem nenhum caminho para a coordenação.
- Pelo item 2a e pela D55 também está limpa. A correção não adiciona campo, prompt nem tela que sugira nota em discursiva ou redação.
- `docs/regulacao.md` não precisa mudar: a correção não altera nenhum requisito regulatório.

Recomendações:
- `mensagemDoTutor` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/api/src/ia/execucao.repository.ts:164`) tem a mesma lacuna. A tabela `mensagem_tutor` tem `anoLetivoId` (`packages/core/src/db/schema/mensagem-tutor.ts:49`), mas o `where` não filtra por `requireAnoEmCurso()`. O dano é baixo, porque o chamador já passou por `deQuemPediu`, e o assunto é da regra 10, não da 70. Sugiro que o `tenancy-guardian` registre isso como nova correção, para que as quatro leituras da classe fiquem iguais.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-02 00:17:12 · `tasks/correcoes/2026-11-02-mensagem-do-assistente-por-ano.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- Caminho feliz: no ano em curso, o professor acha a resposta do Assistente desse ano.
- Virada de ano letivo: na mesma escola, a mesma pessoa não acha, com o contexto no ano em curso, a mensagem de um ano anterior pelo id.
- Na mesma situação, com o contexto no ano dela, a mensagem é achada. Isso prova que quem a esconde é só a cláusula de ano.
- Permissão: outra pessoa da mesma escola não acha a mensagem (cláusula de dono da thread, que já existia).
- Isolamento: a cláusula de escola continua segurando sozinha, com a escola A e a pessoa de B no contexto.
- Sem ano letivo no contexto, o método lança NAO_ENCONTRADO antes de ler.

**Cobertos:**
- Os três primeiros cenários estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/api/src/ia/ia.int.test.ts:921-948`, no caso `a resposta do Assistente é do ano letivo em que foi dada: no ano em curso, a de um ano anterior da mesma pessoa não é achada`.
- O bloco de mutação confere com o `git diff`. A única cláusula nova é `eq(mensagemAgente.anoLetivoId, requireAnoEmCurso())`, e a mutação a remove.
- O cenário chega à cláusula pelo motivo certo: mesma escola, mesma pessoa, ano diferente, e a thread criada no mesmo ano da mensagem para o join passar.
- As asserções olham o resultado (`toBeUndefined` e `toMatchObject({ id })`), não só que o código rodou.
- Não há `.skip` nem mock: é Postgres real, e nenhum provedor de IA é chamado.
- Não tentei rodar o teste por conta própria: o vitest não carregou o `@educa/core`, que não está compilado nesta árvore, e compilar escreveria arquivos. Conto com a prova das mutações que o portão da tarefa já fez.

**Bloqueantes:**
1. **O teste de isolamento por escola parou de provar a cláusula de escola de `mensagemDoAssistente`.** Está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/api/src/ia/ia.int.test.ts:916`, no caso `a cláusula de escola das mensagens vale por si`.
   - **O que está errado:** o contexto agora junta a escola A, a pessoa de B e o ano `a.anoLetivoId`. A mensagem procurada é da escola B e do ano `b.anoLetivoId`, e cada escola tem o seu próprio `ano_letivo`, então os ids são diferentes. Se alguém apagar `eq(mensagemAgente.escolaId, escolaId)` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/api/src/ia/execucao.repository.ts:159`), a cláusula nova de ano continua barrando a mensagem e o teste segue verde. O nome do caso diz "vale por si", e para o Assistente isso deixou de ser verdade. A correção tirou a prova da cláusula de escola sem pôr outra no lugar (regra 10, item 5; regra 40, item 1).
   - **Correção exigida:** na linha 916, pôr no contexto o ano de B junto com a escola A e a pessoa de B: `naEscola(a.escolaId, b.professor.usuarioId, () => execucoes.mensagemDoAssistente(idDoAssistente), b.anoLetivoId)`. Assim só a cláusula de escola segura. Depois, acrescentar ao documento da correção um segundo bloco ` ```mutacao ` que remove `eq(mensagemAgente.escolaId, escolaId)` e cita esse caso, para o portão provar o vermelho.

**Recomendações:**
- O documento diz que, sem ano em curso no contexto, o método lança `NAO_ENCONTRADO` antes de ler (seção Correção), mas nenhum caso prova isso para `mensagemDoAssistente`. Vale uma asserção curta com `erroDe(...)` e `codigo === ErrorCode.NAO_ENCONTRADO`, chamando com um contexto sem `anoLetivoId`.
- O comentário do caso novo (linha 922) fala em "mesma thread lógica", mas o teste cria uma thread nova no ano anterior. Trocar por "mesma pessoa e mesmo agente, em outra thread do ano anterior" evita uma leitura errada.
- Depois de corrigir a linha 916, o parâmetro `anoLetivoId?` opcional de `naEscola` (linha 911) só continua opcional por causa do Tutor. Dá para torná-lo obrigatório e passar `b.anoLetivoId` também nas linhas do Tutor, deixando o contexto do caso igual ao de uma sessão real.

## tenancy-guardian · 1ª rodada · REPROVADO · 2026-11-02 00:17:13 · `tasks/correcoes/2026-11-02-mensagem-do-assistente-por-ano.md`

VEREDITO: REPROVADO

Tabelas verificadas: `mensagem_agente` e `thread_agente`. Ambas têm `escolaId` e `anoLetivoId`, e a FK composta `(escola_id, ano_letivo_id, thread_id)` liga as duas. Os ids são UUID.

Queries verificadas:
- `ExecucaoDaSessaoRepository.mensagemDoAssistente` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/api/src/ia/execucao.repository.ts:153-161`). O escopo vem inteiro do contexto: escola, ano em curso e pessoa. Sem ano no contexto, o método lança `NAO_ENCONTRADO` antes de ler. Nenhum parâmetro do cliente decide o escopo. A rota `GET /v1/execucoes/:id` continua devolvendo 404 `NAO_ENCONTRADO`, igual para os três casos.
- `ExecucoesService.ler`, que é quem chama: passa primeiro por `deQuemPediu`, que já filtra por ano.

Teste de isolamento: o novo é efetivo, mas o de escola ficou inútil para `mensagemDoAssistente`.
- O caso novo (`ia.int.test.ts:922-948`) quebra se a cláusula `eq(mensagemAgente.anoLetivoId, requireAnoEmCurso())` sair. A mensagem de 2025 da mesma escola, da mesma pessoa e da mesma thread voltaria a ser achada no contexto de 2026. A mutação declarada na tarefa confere.
- O caso de escola ao lado perdeu a eficácia para `mensagemDoAssistente`, como explica o bloqueante.

Bloqueantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/api/src/ia/ia.int.test.ts:916`
  - **O que está errado:** o caso `a cláusula de escola das mensagens vale por si` passou a montar o contexto com `a.anoLetivoId`. Removendo mentalmente `eq(mensagemAgente.escolaId, escolaId)` do repository, a mensagem de B continua de fora, porque agora a nova cláusula de ano (ano de A, mensagem do ano de B) a barra. O teste não quebra mais. A cláusula de escola de `mensagemDoAssistente` ficou sem nenhum teste que a prove: pela rota, quem barra é `deQuemPediu`, antes de chegar à mensagem. O teste deixou de provar o que o próprio nome diz, e foi esta correção que causou isso. O comentário das linhas 900-901 também ficou falso: diz que o contexto é "o que sobraria se só a cláusula de escola segurasse".
  - **Correção exigida:** na linha 916, montar o contexto com escola A, pessoa de B e **`b.anoLetivoId`**, o mesmo cruzamento artificial que o teste já faz com a pessoa. Assim, sem a cláusula de escola, ano, id, autor e dono batem com a mensagem de B, e o teste quebra. A linha 919 (escola B com `b.anoLetivoId`) fica como está.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/api/src/ia/execucao.repository.ts:163-170` (`mensagemDoTutor`) tem a mesma lacuna, de antes desta tarefa: `mensagem_tutor` tem `anoLetivoId`, e a consulta não filtra por `requireAnoEmCurso()`. Hoje `deQuemPediu` atenua isso na rota, como atenuava no Assistente. Abrir uma correção irmã, com teste do mesmo formato do caso novo. A seção "Fora desta correção: Nada" da tarefa precisa citar isso.
- Corrigir o comentário de `ia.int.test.ts:900-901` junto com o bloqueante, para dizer que o contexto junta escola A com a pessoa e o ano de B.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-02 00:33:27 · `tasks/correcoes/2026-11-02-mensagem-do-assistente-por-ano.md`

VEREDITO: APROVADO

Tabelas verificadas: `mensagem_agente` e `thread_agente` (as duas têm `escolaId` e `anoLetivoId`, e o join iguala escola, ano e thread), `mensagem_tutor` (tem `escolaId` e `anoLetivoId`). Esta correção não cria tabela nova.

Queries verificadas: `ExecucaoDaSessaoRepository.mensagemDoAssistente` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/api/src/ia/execucao.repository.ts:153-161`). Escola, ano e pessoa vêm do contexto (`requireEscolaId`, `requireAnoEmCurso`, `requireUsuarioId`), não de parâmetro. Sem ano no contexto, a consulta lança `NAO_ENCONTRADO` antes de ler. Conferi também `mensagemDoTutor` (linhas 164-170), que esta rodada não alterou.

Teste de isolamento: presente e efetivo.
- A correção exigida na 1ª rodada foi feita. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/api/src/ia/ia.int.test.ts:922`, o contexto agora junta a escola A com a pessoa e o ano de B. Tirando mentalmente `eq(mensagemAgente.escolaId, escolaId)`, a mensagem de B passa nas outras cláusulas: ano B, id, autor `agente`, thread de `b.professor`. O join só compara colunas das próprias linhas e não usa o contexto. A mensagem passa a ser achada e o `toBeUndefined()` quebra. Isso confere com a mutação 2 do documento, que o portão marca como vermelha.
- O caso cria as conversas de B de que precisa, então também roda sozinho pelo nome.
- O caso do ano anterior continua efetivo contra a mutação 1. Ele também prova que, sem ano no contexto, o erro é `NAO_ENCONTRADO`, a mesma resposta de objeto inexistente, então não confirma que a mensagem existe.

Bloqueantes: nenhum.

Recomendações:
- `mensagemDoTutor` (`execucao.repository.ts:168`) não filtra por `requireAnoEmCurso()`, embora `mensagem_tutor` tenha `anoLetivoId`. A lacuna já existia, está registrada no documento como correção irmã e precisa ser aberta pelo Orquestrador, com teste do mesmo formato do caso do ano anterior.
- Em `ia.int.test.ts:921` e `:924`, `mensagemDoTutor` agora recebe `b.anoLetivoId`, que ela ainda não lê. Quando a correção irmã entrar, esse caso já monta o contexto que vai precisar.

## test-engineer · 2ª rodada · APROVADO · 2026-11-02 00:33:30 · `tasks/correcoes/2026-11-02-mensagem-do-assistente-por-ano.md`

VEREDITO: APROVADO

Cenários exigidos:
- Caminho feliz: no ano em curso, a pessoa acha a própria resposta do Assistente.
- Virada de ano letivo: na mesma escola e com a mesma pessoa, a resposta de um ano anterior não é achada no ano em curso, e é achada no ano dela.
- Contexto sem ano em curso: a busca falha fechado com NAO_ENCONTRADO e não cai num ano qualquer.
- Isolamento: com a escola A e a pessoa e o ano de B no contexto, a mensagem de B não é achada. Só a cláusula de escola segura esse caso.
- Permissão: a mensagem precisa estar numa thread da pessoa (cláusula `threadAgente.usuarioId`). Isso não mudou nesta correção e já tinha cobertura pela rota.

Cobertos:
- A correção exigida na 1ª rodada foi feita. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/api/src/ia/ia.int.test.ts:922`, o contexto agora tem a escola A com a pessoa e o ano de B.
  - O join com `threadAgente` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/api/src/ia/execucao.repository.ts:158`) só compara a escola da thread com a da mensagem, e nunca com a escola do contexto.
  - Por isso, sem `eq(mensagemAgente.escolaId, escolaId)` (linha 159), sobram ano = B, id, autor e pessoa = B, e a mensagem de B seria devolvida. O teste fica vermelho pelo motivo certo.
- O segundo bloco `mutacao` está no documento. Ele remove exatamente essa cláusula, a linha `-` confere com a linha 159 atual e o bloco cita o caso de escola pelo nome.
- O caso de escola passou a criar as conversas de B de que precisa (linhas 905 a 909), então vale quando roda sozinho. Rodei `npx vitest run ... -t "a cláusula de escola das mensagens vale por si"` isolado: 1 passou, 37 pulados.
- O caso de ano (linhas 928 a 956) não mudou na parte que importa. A primeira mutação continua cobrindo a cláusula de ano, e o caso ganhou a asserção de NAO_ENCONTRADO sem ano (linhas 955 e 956).
- O portão do Implementador informou 2 de 2 mutações vermelhas.
- Não há `.skip`, mock de coisa nossa nem chamada a provedor pago: o caso usa o executor e o adaptador da bancada.
- A correção não cria operação que possa rodar duas vezes ao mesmo tempo, então não cabe teste de concorrência.

Bloqueantes: nenhum.

Recomendações:
- `mensagemDoTutor` tem a mesma lacuna de ano letivo. O documento já a deixa para uma correção irmã, aberta pelo Orquestrador. Quando ela vier, as linhas 921 e 924 já passam `b.anoLetivoId` e servem de base. Falta acrescentar um caso de ano anterior no mesmo formato do caso novo, mais o bloco `mutacao` dele.
- As consultas que pegam os ids, nas linhas 910 a 914, usam `limit 1` sem filtrar por ano. Hoje isso funciona, porque B só tem mensagens no próprio ano. Pôr `ano_letivo_id = b.anoLetivoId` nelas deixaria o caso firme mesmo se um dia B ganhar mensagens de outro ano.
