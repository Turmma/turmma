# Achados das revisões — `tasks/prd-camada-ia/1_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-21 01:42:16 · `tasks/prd-camada-ia/1_task.md`

VEREDITO: APROVADO

Tabelas verificadas: `consumo_ia` é a única tocada (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/src/db/schema/consumo-ia.ts`), e a mudança está só no docblock. A tarefa não cria tabela nem migration. A tabela já tem `escola_id`. Ela não tem `ano_letivo_id`, e isso já estava justificado no schema: é série no tempo, somada por mês. O id continua UUID.

Queries verificadas:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/apps/api/src/ia/consumo.repository.ts`, `registrar`: grava a escola de `requireEscolaId()`, que vem do contexto. A coluna nova, `custoMicros`, não muda o escopo, e a escola não vem de argumento.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/apps/api/src/governanca/governanca.repository.ts`, `consumoPorFuncao`: só a expressão `execucoes` mudou, de `count(*)` para `count(distinct execucao_id)` mais as linhas sem execução. O `where` com `eq(consumoIa.escolaId, requireEscolaId())` continua igual. O resultado segue agregado por função, sem aluno nem usuário.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/src/ia/llm-gateway.ts`: `registrarLinhas` passa cada linha à porta de registro. A conferência que já existia entre a escola do contexto e a do pedido continua lá.
- Nenhum endpoint novo. Nenhum lugar aceita `escolaId` por corpo ou query string. Nenhum `@Unscoped()` ou `unscopedJustification` novo no diff.

Teste de isolamento: presente e efetivo.
- O caso que já existia em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/apps/api/src/governanca/governanca.int.test.ts` foi adaptado para `execucoes`. Ele compara o total que a escola B vê na API com a contagem no banco só da escola B, e exige que seja diferente do total de A. Sem o `eq(escolaId)` do `where`, B veria a soma das duas escolas e o teste quebraria.
- O caso novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/apps/api/src/ia/ia.int.test.ts`, "a linha é da escola de quem gastou", confirma que o gateway sobre o banco não grava linha na escola B.

Bloqueantes: nenhum.

Recomendações:
- O caso novo "a linha é da escola de quem gastou" (`ia.int.test.ts`) só confere que B não ganhou linha. Ele não confere que a linha nova está em A. Somar `contar('consumo_ia', a.escolaId)` antes e depois deixaria o caso mais forte.
- O caso "a execução com duas linhas de consumo" (`governanca.int.test.ts`) escolhe a linha a copiar com `order by id desc limit 1`. Como o id é UUID, isso não pega a linha mais recente, só uma linha qualquer. O caso funciona assim mesmo, mas o comentário ou a ordenação (`order by em desc`) deixaria a intenção mais clara.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-21 01:42:31 · `tasks/prd-camada-ia/1_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. `custo_micros` já existia em `consumo_ia` com zero por padrão, não há migration e o custo não é dado de pessoa. O que mudou é quantas linhas uma execução grava: agora é uma por chamada enviada ao modelo. Toda linha do Tutor continua levando `aluno_id`, como antes. `entrada` e `saida` ficam só na última linha. A linha da saída inválida não guarda o conteúdo que foi reprovado (`packages/core/src/ia/llm-gateway.ts:369-370`), e o teste lê isso no banco (`apps/api/src/ia/ia.int.test.ts`, colunas `tem_entrada` e `tem_saida` só na linha `concluida`).

Fora da tabela de dados do docs/lgpd.md: nada. A linha 99 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/docs/lgpd.md` já cobre "toda chamada de IA", com `provedor` nulo na chamada que falhou antes de sair. É o que a linha sem envio agora grava (`SEM_ENVIO_EXTERNO`, `llm-gateway.ts:353`).

Autorização por objeto: ok. A tarefa não cria rota nem consulta nova. `GET /v1/governanca/consumo` continua filtrando por `requireEscolaId()` e devolve só o agregado por função, sem aluno nem origem (`apps/api/src/governanca/governanca.repository.ts:182`). O caso "a linha é da escola de quem gastou" prova que a escola B não ganha linha.

Logs: limpos. Não há log novo. O único `logger` no caminho é o `ia.geracao.erro_inesperado`, que já existia e leva só o resumo do erro.

Auditoria: nenhuma ação da tarefa a exige. Ela não lê dado de aluno por coordenação ou rede, não exporta, não mexe em nota, em permissão nem em aprovação de saída de IA. A Governança devolve só o agregado.

Envio externo: o conteúdo enviado não mudou. O que mudou é o registro, que ficou mais exato. Cada chamada que saiu agora tem a sua linha, com `envio_externo` e `provedor`, e isso vale também para a primeira chamada de uma repetição e para a troca para o modelo menor. A chamada que caiu por prazo esgotado depois de sair grava o provedor e a estimativa de tokens. A que não saiu (disjuntor aberto) não grava provedor. A lista de compartilhamento do titular agrupa por `provedor` com primeira e última data (`packages/core/src/titular/compartilhamento.repository.ts:125`), então ela continua correta com várias linhas por execução. A eliminação e o expurgo anulam `aluno_id`, `entrada` e `saida` em todas as linhas da execução, porque atualizam por conjunto. O registro em `ExecucaoAgente` não mudou. O provedor usado continua decidido pela configuração e pela D62.

Pergunta de fechamento: sim, o código responde. O arquivo do titular (`packages/core/src/titular/leitura-do-titular.ts:275-294`) lê `consumo_ia` pelo `aluno_id` e pela execução que o aluno pediu. A foto do compartilhamento responde para onde o dado foi, agora com uma linha por chamada.

Seed/fixture: sintético. São a `atividadeDeEstequiometria`, modelos e provedores com nome aleatório de teste, e nenhum nome, CPF ou e-mail aparece nos testes alterados.

Bloqueantes: nenhum.

Recomendações:
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/src/ia/llm-gateway.ts:304-305`, há dois docblocks seguidos acima de `chamarContando`. O primeiro ("Uma chamada ao adaptador, medida…") é do `chamarModelo` e ficou deslocado. O texto é verdadeiro, mas engana quem lê.
- Na linha 99 de `docs/lgpd.md`, convém deixar explícito que a execução pode ter mais de uma linha de consumo, uma por chamada enviada, e que a linha da saída inválida não guarda conteúdo. Isso ajuda a escola a responder "para onde foi" no dossiê.
- Na Governança, `comEnvioExterno` continua contando chamadas e `execucoes` passou a contar execuções. Vale um rótulo na tela que deixe a diferença clara, para a coordenação não comparar os dois números como se fossem a mesma unidade.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-21 01:42:45 · `tasks/prd-camada-ia/1_task.md`

VEREDITO: APROVADO

A tarefa 1.0 só mexe na contabilidade de custo da IA: o preço por vigência, uma linha de `consumo_ia` por chamada enviada e a Governança contando execuções. Ela não chega a nenhum ponto da regra 70.

Caminhos de escrita em Nota: nenhum novo nesta tarefa. Nenhum arquivo alterado grava em `Nota` nem mexe em `lancadaPor`. Todos com autor humano? Sim, sem mudança.

Decisão autônoma sobre aluno: ausente. O diff não tem promoção, retenção, encaminhamento nem sugestão aplicada sozinha. A única ocorrência de "reprovada" no diff é sobre a saída do modelo que não passou no schema, em `packages/core/src/ia/llm-gateway.ts`.

Aprovação registrada: ok. Entrega, artefato e aprovação não foram tocados, e a exceção do tutor (D47) não se estende a outro agente.

Supervisão do tutor: ok.
- A única mudança no Tutor é `custoMicros: 0` na linha da regra fixa, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/apps/api/src/tutor/tutor.service.ts:180`.
- O freio diário e o pacote do mês (D38) continuam contando a pergunta em `mensagem_tutor`, e não as linhas de `consumo_ia`. Por isso a repetição por saída inválida não gasta troca do aluno (`apps/api/src/ia/orcamento.repository.ts:24-28`).
- Nada novo de comportamento nem de inferência emocional. As linhas intermediárias de falha não guardam `entrada` nem `saida`.

Autonomia declarada e visível: sim, sem mudança.

O que mais conferi:
- **Auditoria, item 6:** cada linha agora guarda o modelo que atendeu, com tokens e custo próprios. Isso deixa mais exata a resposta a "o que a IA gerou". O conteúdo fica só na última linha.
- **D45 e D64, itens 8 e 9:** o consumo continua só por função. Não há dimensão por professor nem por usuário. O teste de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/apps/api/src/governanca/governanca.int.test.ts` segue barrando `usuarioId`, o id da professora, `modelo` e `perfil` na resposta. `packages/shared/src/governanca/governanca.test.ts` continua recusando `porUsuario` e `porAluno`. Nada no diff liga métrica a decisão sobre o professor nem expõe a conversa dele.
- **D55 e D46, item 8:** nenhum campo, prompt ou tela de nota em discursiva ou redação.

Bloqueantes: nenhum.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/apps/web/src/areas/coordenacao/governanca/textos-da-governanca.ts:114`: o texto "O custo em reais ainda não é medido nesta versão" deixou de ser exato. A partir da 1.0 o custo é medido, e o zero quer dizer modelo local ou adaptador falso, sem preço. O docblock já foi ajustado, mas a frase que o coordenador lê não. Sugiro algo como "Os modelos em uso não têm cobrança; o que aparece aqui são os tokens…". É texto, então não bloqueia, mas é o que a coordenação mostra em reunião como transparência.
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/apps/api/src/governanca/governanca.int.test.ts:489`: o comentário "O custo não é medido nesta fatia" ficou velho pelo mesmo motivo.
3. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/src/db/schema/mensagem-tutor.ts:28` diz que o freio do dia "conta as chamadas dele em `consumo_ia`". Já estava errado antes desta tarefa, mas ficou mais enganoso agora que há várias linhas por execução: o repository conta a pergunta em `mensagem_tutor`. Vale corrigir para ninguém mudar o freio com base nesse texto.
4. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/src/ia/llm-gateway.ts:416-417`: ficaram dois docblocks seguidos antes de `chamarContando`. O primeiro é do `chamarModelo` e saiu do lugar.

Nenhuma tela foi enviada. O texto visível ao coordenador só foi conferido pelo código.

## llm-integrator · 1ª rodada · APROVADO · 2026-11-21 01:42:55 · `tasks/prd-camada-ia/1_task.md`

VEREDITO: APROVADO

Perfis usados: nenhum novo. A tarefa não adiciona chamada de modelo: ela mede as que já existem. O perfil de cada tarefa continua o que a tarefa declara. Subi 1.358 testes unitários (core/ia, config, shared/governança, web/governança) e 86 de integração (`ia.int.test.ts`, `governanca.int.test.ts`). Todos passaram, e nenhum chama provedor pago: usam `ScriptedAdapter`, `FakeAdapter` e o banco de teste.

Custo estimado por professor/mês: não se aplica, porque não há chamada nova. O que a tarefa muda é a conta. A execução com saída inválida e repetição, ou com troca para o modelo menor, passa a gravar duas linhas em `consumo_ia` em vez de uma. É um insert a mais, sequencial, só nesse caso. O custo passa a sair de `custoDaChamada` com `ceil` e do preço vigente em cada instante. Em `local` e no adaptador falso continua zero. A estimativa por professor só vira número quando o modelo real entrar em `PRECO_DOS_MODELOS` (D37), e a tarefa que precisar dela deve trazê-la.

Prompt versionado: não se aplica. Nenhum prompt foi tocado.

Validação de schema: não se aplica. A validação da saída é a de sempre, e a tarefa só registra `IA_SAIDA_INVALIDA` por chamada.

Aprovação humana no caminho: não se aplica. É medição e registro, sem entrega de agente.

Bloqueantes: nenhum. O que conferi:
- **Gateway** (`packages/core/src/ia/llm-gateway.ts`): uma linha por chamada que saiu (`chamarContando`, `linhasDeConsumo`). `entrada` e `saida` só na última linha, e a saída inválida não é gravada (regra 20). A chamada sem uso grava entrada contada e saída no teto da tarefa (superestima, D14). A que não saiu não grava no lote e deixa uma linha sem custo nas outras filas. `registrarLinhas` é sequencial e só falha depois de tentar todas.
- **Preço** (`packages/core/src/ia/consumo.ts`): a chave é `provedor:modelo`, com `provedorId ?? origem` igual ao `chaveDoBalde`. A vigência escolhida é a do instante da chamada, e o `ceil` é feito por resto inteiro, sem ponto flutuante.
- **Subida**: `exigirPrecoDosModelos` recusa modelo sem preço, citando `LLM_MODELO` ou a variável do perfil. Nada de valor nem de segredo vai na mensagem.
- **Governança** (`apps/api/src/governanca/governanca.repository.ts:175`): `count(distinct execucao_id)` mais a linha sem execução. O `where` por escola não mudou, então não há consulta nova a isolar.
- **Freio diário e pacote do Tutor** (D38): não contam linhas de `consumo_ia`. Vêm do `orcamento.repository` e de `mensagem_tutor`, então a linha dupla não os distorce.
- **Compartilhamento e expurgo** (`titulares.repository`, `compartilhamento.repository`): agora usam `provedor` por chamada, o que dá a lista do arquivo do titular mais exata. O `count(*)` de `texto_do_modelo` continua coerente.
- **Runbook** (`docs/runbook.md`): a seção de volta cobre a contagem de linhas na versão anterior, a web antiga com a API nova e a subida recusada sem preço.

Recomendações:
- `packages/core/src/ia/llm-gateway.ts` (acima de `chamarContando`, perto da linha 416): o docblock antigo "Uma chamada ao adaptador, medida…" ficou solto sobre o novo `chamarContando` e já não descreve `chamarModelo`. Mover para cima de `chamarModelo`.
- Quando a repetição é adiada pelo disjuntor depois de uma saída inválida, a única linha fica com `IA_SAIDA_INVALIDA` e não com o código real da falha final (o teste da linha 1529 fixa esse comportamento). É coerente com "uma linha por chamada", mas o motivo da falha final só fica em `execucao_agente.erro`. Vale uma frase no docblock de `consumo-ia.ts`.
- `apps/web/src/areas/coordenacao/governanca/textos-da-governanca.ts`: com `custoMicros = 0` o texto diz "não é medido nesta versão". Passa a ser impreciso quando houver preço e a escola ainda não tiver gasto no mês. Rever o texto quando o modelo real entrar (D37).
- A subida com `openai_compat` fora de `local` só funciona depois que o modelo real entrar em `PRECO_DOS_MODELOS`. Está documentado e é de propósito. Quem for subir staging ou produção com provedor real antes da D37 vai bater nisso, então conviria um aviso no `.env.example` junto de `IA_ADAPTADOR`.

Arquivos principais: `packages/core/src/ia/llm-gateway.ts`, `packages/core/src/ia/consumo.ts`, `packages/core/src/config/llm-config.ts`, `apps/api/src/ia/consumo.repository.ts`, `apps/api/src/governanca/governanca.repository.ts`, `docs/runbook.md`.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-21 01:43:25 · `tasks/prd-camada-ia/1_task.md`

VEREDITO: APROVADO
Caminho quente tocado: IA (o gateway do Tutor e das ferramentas, mais a leitura da Governança)
Rate limit: ok. A tarefa não muda o limitador nem o balde. O freio diário segue contando `mensagem_tutor`, então a segunda linha de uma repetição não tira troca do aluno.
Fila e prioridade: ok. A fila e a prioridade não mudam. No lote, a chamada que não saiu continua sem linha e é adiada.
Concorrência: protegida. Não entra operação disparável duas vezes. `registrarLinhas` grava uma linha por vez e só registra chamadas que de fato saíram. O job repetido pela D49 grava chamadas novas e reais, sem duplicar as que já estão gravadas.
Índice e paginação: ok. O `count(distinct execucao_id)` da Governança é agregado por escola e mês e usa `consumo_ia_funcao_idx (escola_id, funcao, em)`. Não é listagem, então não precisa de paginação.
Degradação de IA: ok. O caminho da degradação não muda: espera, modelo menor, erro tipado. Se o registro falha, o aluno recebe `IA_INDISPONIVEL`, como antes. A estimativa da chamada que saiu e não voltou fica em memória e sem ida a mais ao banco.
Migration: não se aplica. `custo_micros` já existia com zero por padrão. O diff do schema só mexe em comentário.
Métrica e alerta: ok. A tarefa não cria alerta. O caminho medido continua sendo o `chamarModelo`. O runbook ganhou a seção de rollback (`docs/runbook.md`, "Voltar o código depois da camada-ia 1.0").
Bloqueantes: nenhum.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/src/ia/llm-gateway.ts:290`: no caminho da falha, `registrarLinhas(...).catch(() => undefined)` descarta sem rastro a linha de custo que não gravou. Com várias linhas por execução, o custo perdido em silêncio pode ser maior que antes. Vale um contador sem dado pessoal, por exemplo `ia.consumo.registro_falhou{funcao}`.
2. A primeira subida da VPS (F18) com `openai_compat` vai ser recusada até `PRECO_DOS_MODELOS` ter uma entrada `provedor:modelo` para todo perfil. Isso inclui o Ollama com processamento local, cuja chave é `openai_compat:<modelo>`, ainda que custe zero. Hoje não quebra nada porque ainda não há staging nem produção. Convém pôr no checklist de deploy da F18 ou no `TODO.md`, e não só na seção de rollback.
3. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/src/db/schema/consumo-ia.ts:25-28`: o comentário diz que o freio diário "conta as chamadas do aluno no dia, uma por troca" em `consumo_ia`. O freio conta `mensagem_tutor` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/apps/api/src/ia/orcamento.repository.ts`). Com várias linhas por execução, esse comentário pode levar alguém a refazer o freio pelo jeito errado.
4. Quando a última tentativa nem sai (prazo esgotado esperando vaga depois de uma saída inválida), `consumo_ia.codigo_de_erro` registra `IA_SAIDA_INVALIDA`, e não o código final da execução. É o que `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/apps/api/src/ia/prazo-com-tokens.int.test.ts` agora fixa. Convém confirmar que nenhum painel ou alerta lê a causa da falha em `consumo_ia` em vez de `execucao_agente` ou das métricas de `avisar`.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-21 01:43:47 · `tasks/prd-camada-ia/1_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em `cenarios.md`. A tarefa decidiu que a chamada que não saiu deixa uma linha fora do lote. Isso está na `techspec.md` §3, mas falta no `cenarios.md`.
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

Bloqueantes:
- **Divergência sem cenário.** O problema está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/tasks/prd-camada-ia/1_task.md:103`, que é a segunda linha de "Divergências resolvidas", e em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/tasks/prd-camada-ia/cenarios.md:41-50`.
  - **O que a tarefa decidiu:** a spec dizia "a que não saiu não grava". A tarefa mudou isso. No lote, nenhuma linha, e o job adia. Fora do lote, fica uma linha da falha, com `tentativas = 0`, sem tokens, sem custo e sem envio. A chamada anterior que saiu continua com a sua linha.
  - **O que está errado:** o documento diz que a decisão está em "`cenarios.md` §1, RF5", e o item 8 da Autoconferência (linha 92) repete isso. Ela não está lá. O `grep` por "disjuntor", "não saiu", "nenhuma linha" e "tentativas = 0" no `cenarios.md` só acha as linhas da reserva (RF2 a RF4). A divergência ficou só no `N_task.md` e na `techspec.md`. Com isso, a validação não tem cenário que confira esse comportamento.
  - **Correção exigida:** acrescentar no `cenarios.md` §1 uma linha RF5 com os três casos. São eles:
    - disjuntor aberto ou sem vaga no lote: nenhuma linha, e o job adia;
    - fora do lote: uma linha da falha, com `tentativas = 0`, sem tokens, custo nem envio;
    - a chamada anterior que saiu mantém a sua linha.
  - A linha cita `llm-gateway.test.ts` como camada e arquivo. As mutações que a derrubam são "gravar a linha no lote" e "não gravar fora do lote". Corrigir também o item 8 da Autoconferência: ele diz "duas" divergências, e a tabela tem três.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/src/ia/llm-gateway.ts:416-417`: o docblock antigo do `chamarModelo` ficou solto, logo acima do docblock novo do `chamarContando`. O `chamarModelo` perdeu a descrição e o `chamarContando` ficou com duas. Mover o da linha 416 de volta para cima do `chamarModelo`.
- `llm-gateway.ts:192`, `:394` e `:543`: `ChamadaEnviada.codigoDeErro` é mutável e é corrigido depois de criado. Seria mais claro passar o código ao montar a chamada, ou montar a linha com o código final.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/apps/web/src/areas/coordenacao/governanca/textos-da-governanca.ts:114`: com custo zero, a tela ainda diz "ainda não é medido nesta versão". A partir desta tarefa o custo é medido, e o zero só aparece no adaptador falso e no modelo local. A frase fica imprecisa. Levar para a 6.0, que refaz a tela.
- `1_task.md`, "Arquivos previstos": a tabela não lista arquivos que a tarefa mudou. São eles `packages/shared/src/governanca/governanca.ts`, os textos e testes da web, `apps/api/src/tutor/tutor.service.ts`, `packages/core/src/db/schema/consumo-ia.ts` e `docs/modelo-de-dados.md`. A troca de `chamadas` por `execucoes` no contrato está prevista pela 1.5, mas não aparece na tabela.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/tasks/prd-camada-ia/tasks.md:653-659`: a 1.0 está marcada `[x]`, mas as subtarefas 1.1 a 1.6 continuam `[ ]`.
- Uma consequência de "uma linha por chamada" que vale registrar no documento: quando a primeira chamada sai com saída inválida e a repetição esgota o prazo sem sair, nenhuma linha de `consumo_ia` guarda o `IA_TEMPO_ESGOTADO`. A única linha diz `IA_SAIDA_INVALIDA`, como em `prazo-com-tokens.int.test.ts:189-192`. O código final da execução só fica no erro que sobe.

## test-engineer · 1ª rodada · APROVADO · 2026-11-21 01:44:46 · `tasks/prd-camada-ia/1_task.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- O custo de uma chamada: 3.000 + 250 tokens a 1.300 e 5.200 micros por mil dão 5.200.
- O `ceil` puxa para cima a fração de micro, e a conta exata não ganha micro a mais.
- Com duas vigências do mesmo modelo, cada chamada fica no preço do seu instante. A borda da vigência conta, nada vale antes da primeira, e a linha antiga não muda.
- O mesmo modelo em dois provedores tem dois preços, porque a chave é `provedor:modelo`.
- Saída inválida e depois válida: duas linhas, com `entrada` e `saida` só na última.
- A troca para o modelo menor grava duas linhas, cada uma com o seu modelo e o seu preço.
- Prazo ou servidor que caem depois do envio gravam a entrada contada, a saída no teto e custo maior que zero. Se a repetição cai, a correção entra na entrada contada.
- Disjuntor aberto no lote não grava linha. Fora do lote grava uma linha da falha, com `tentativas = 0`. A chamada anterior que saiu continua com a sua linha.
- Principal inválido duas vezes: duas linhas, nenhuma `concluida`.
- A subida fora de `local` com `openai_compat` recusa modelo sem preço e cita a variável:
  - a do perfil quando ele tem a sua, a comum nos outros;
  - recusa também com vigência só futura e com preço registrado em outro provedor;
  - quando faltam o principal e o menor juntos, cita as duas variáveis e os dois motivos.
- Governança: uma execução com duas linhas conta 1; duas linhas sem execução contam 2.
- Isolamento: a escola B não ganha linha. Falha no registro de uma linha não esconde a seguinte.

**Cobertos:** todos, cada um pelo caso citado na tabela.
- Conferi as 38 mutações contra o `git diff`. Cada termo novo tem bloco ou motivo escrito, e os 3 motivos se sustentam. Os blocos caem pela asserção sobre a linha gravada.
- Rodei e passaram:
  - unidade, `packages/core/src/ia/` e `llm-config.test.ts`: 1.250;
  - integração, `ia.int`, `governanca.int` e `prazo-com-tokens.int`: 93;
  - web e shared tocados: 145.
- Não há `.skip`, `.only` nem teste comentado no diff. Nenhum teste chama provedor pago: usam `ScriptedAdapter`, `Roteirizado` e o adaptador falso.
- Conferi três pontos fora do diff:
  - O freio diário e o pacote do Tutor contam em `mensagem_tutor` (`orcamento.repository.ts:24-28`), e não em `consumo_ia`. As duas linhas por troca não gastam o dia do aluno duas vezes.
  - A recusa da D62 acontece antes de `chamarAteValer` e não gera linha estimada.
  - A falta de vaga que esgota o prazo não gera linha.
- Concorrência: a tarefa não traz operação nova que rode duas vezes ao mesmo tempo. O job reentregue grava as chamadas que de fato saíram.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `tasks/prd-camada-ia/1_task.md:53`: a parte I da linha "duas vigências" cita `ia.int.test.ts › grava o custo em micros que a linha traz`. Esse caso prova que o repository grava o `custoMicros`, não as duas vigências. A regra está provada na unidade (`consumo.test.ts` e `llm-gateway.test.ts`). "O mês soma as duas" fica para o `orcamento-do-mes.repository.int.test.ts`, de uma tarefa adiante.
2. `apps/api/src/governanca/governanca.int.test.ts:489`: o comentário "O custo não é medido nesta fatia" ficou velho, porque o custo agora é medido. Ele é zero só porque o falso não tem preço. Vale o mesmo para o texto de `textoDoCusto` em `apps/web/src/areas/coordenacao/governanca/textos-da-governanca.ts:114` ("ainda não é medido nesta versão"). Registrar para a 6.0, que mexe na tela.
3. `apps/api/src/ia/ia.int.test.ts`, caso da troca para o modelo menor: espera os 8 s de `ESPERA_MAXIMA_DA_VAGA_MS` em tempo real, com limite de 30 s. Tem folga e não depende de máquina folgada, mas é lento. A unidade já prova o mesmo com relógio falso. Se possível, usar relógio falso aqui também.
4. `apps/api/src/ia/ia.int.test.ts:48-50`: importa de `../../../../packages/core/src/...` (adapter, perfis e `__fixtures__`) em vez de `@educa/core`. Expor os tipos ou mover o dublê.
5. O 429 que sobra e a conexão recusada viram `IA_INDISPONIVEL` sem motivo (`resilient-adapter.ts:85`). Por isso gravam a estimativa com custo e `envioExterno = true`, embora `errors.ts:67-68` diga que um não cobrou e no outro a chamada nem chegou. Isso bate com a D14 (superestima custo e destino) e com a spec ("conexão"). Falta um caso que fixe essa escolha passando pelo `ResilientAdapter` com o servidor falso. Hoje o dublê lança o `LLMError` já pronto.
6. `prazo-com-tokens.int.test.ts:189-192`: quando o prazo vence esperando vaga, nenhuma linha de `consumo_ia` guarda `IA_TEMPO_ESGOTADO`, só o `IA_SAIDA_INVALIDA` da chamada que saiu. O erro fica na execução. Está coerente com "a que não saiu não é chamada", mas vale uma linha na `techspec.md` §3 dizendo que o código final da execução vive em `execucao_agente`, e não no consumo.

Arquivos principais: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/src/ia/llm-gateway.test.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/src/ia/consumo.test.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/apps/api/src/ia/ia.int.test.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/apps/api/src/governanca/governanca.int.test.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/packages/core/src/config/llm-config.test.ts`.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-21 02:06:16 · `tasks/prd-camada-ia/1_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok

Portão local: carimbo válido. O `conferir` devolveu "portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)".

Bloqueantes: nenhum.

As duas correções da 1ª rodada foram feitas:
- **Linha RF5 no `cenarios.md`.** A linha nova está em `tasks/prd-camada-ia/cenarios.md:51` e traz os três casos: disjuntor aberto ou sem vaga no lote, sem linha e com o job adiado; fora do lote, uma linha da falha com `tentativas = 0`, sem tokens, custo nem envio; e a chamada anterior que saiu mantém a sua linha. Ela cita `llm-gateway.test.ts` e as duas mutações pedidas. Os três casos existem nesse arquivo:
  - `packages/core/src/ia/llm-gateway.test.ts:1514`: "disjuntor aberto no lote".
  - `packages/core/src/ia/llm-gateway.test.ts:1521`: "disjuntor aberto fora do lote".
  - `packages/core/src/ia/llm-gateway.test.ts:1529`: "a chamada anterior que saiu continua tendo a sua linha".
  - O balde cheio do lote e o de fora do lote estão nas linhas 1053 e 1072 do mesmo arquivo.
- **Item 8 da Autoconferência.** `tasks/prd-camada-ia/1_task.md:101` agora conta três divergências, e a tabela das linhas 111 a 113 tem as mesmas três. A da subida pelo `createLLMGateway` cita a linha RF6 em `cenarios.md:60`, que existe.

O resto do diff não abre problema novo:
- **`techspec.md` §3:** a frase nova sobre o código final da execução coincide com o docblock de `consumo-ia.ts`.
- **`ia.int.test.ts`:** o caso de isolamento ficou mais forte, porque agora confere que a escola A ganha uma linha, e não só que a B não ganha nenhuma.
- **`governanca.int.test.ts`:** a cópia da linha passa a escolher pela coluna `em`, e não mais pelo `id`, que é UUID e não segue a ordem de gravação.
- **`llm-gateway.ts`:** o docblock de `chamarModelo` voltou para cima do método certo.
- **`1_task.md`:** a seção "Arquivos previstos" agora lista todos os arquivos que a tarefa alterou.

Recomendações:
- A linha RF5 nova em `cenarios.md:51` cita só o arquivo, sem a camada ("unidade, `llm-gateway.test.ts`"). Outras linhas do documento trazem a camada junto, e vale padronizar.
- As recomendações da 1ª rodada que ficaram para depois estão na tabela "Sem aplicar" de `1_task.md` e no `TODO.md`. A do `codigoDeErro` mutável ficou com a 10.0, e a do texto "ainda não é medido nesta versão" ficou com a 6.4. Na validação, vale conferir que essas tarefas as pegam.

## test-engineer · 2ª rodada · APROVADO · 2026-11-21 02:07:01 · `tasks/prd-camada-ia/1_task.md`

VEREDITO: APROVADO

**Cenários exigidos:** são os mesmos da 1ª rodada. Esta rodada audita só o diff `fe2851db..4c17f09f`, e a árvore de trabalho é igual ao commit auditado (`git diff 4c17f09f --stat` saiu vazio).
- A conta do custo, arredondada para cima.
- As duas vigências do mesmo modelo.
- O mesmo modelo em dois provedores.
- Uma linha por chamada enviada, com `entrada` e `saida` só na última.
- A estimativa da chamada que saiu e não voltou.
- A chamada que não saiu, no lote e fora dele.
- A Governança contando execuções, inclusive a linha sem execução.
- A subida que exige preço.
- O isolamento entre escolas.

**Cobertos:**
- **Isolamento (`apps/api/src/ia/ia.int.test.ts:652`):** o caso agora exige `antesDeA + 1` na escola A e a escola B sem nenhuma linha nova. A versão antiga passaria se nada fosse gravado, ou se a linha fosse para outra escola que não a B. Agora o teste falha se a linha não for gravada na escola de quem gastou. O `contar` (linha 122) filtra por `escola_id = $1`, então a asserção olha o banco de cada escola. Rodei o arquivo inteiro: 56 de 56 verdes.
- **Duas linhas de uma execução (`apps/api/src/governanca/governanca.int.test.ts:531`):** a ordem passou de `order by id desc` para `order by em desc`. Para o que o caso prova, qualquer linha `concluida` com execução da escola A serve: `execucoes` não muda e os tokens sobem 1000 e 500. A troca deixa clara a intenção de pegar a mais recente. O comentário da linha 488 agora diz o que o código faz (o adaptador falso não tem preço, então o custo é zero). Rodei o arquivo: 30 de 30 verdes.
- **Linha "duas vigências" da tabela de testes (`tasks/prd-camada-ia/1_task.md:62`):** ficou só U e cita pelo nome os dois casos de `consumo.test.ts` e `llm-gateway.test.ts`. Diz também que "o mês soma as duas" fica com o `orcamento-do-mes.repository.int.test.ts`, de tarefa adiante, e que o `ia.int.test.ts` prova só que o repository grava o `custoMicros`. Era a recomendação da 1ª rodada, e a linha não promete mais cobertura do que existe.
- **Chamada que não saiu:** a nova linha RF5 do `cenarios.md` aponta para o `llm-gateway.test.ts`, que já foi auditado na 1ª rodada. A mutação declarada nela ("gravar a linha no lote; não gravar fora do lote") chega à cláusula.
- **Resto do diff:** `consumo-ia.ts` e `llm-gateway.ts` mudaram só em docblock, sem condição nova e sem mutação a exigir. O docblock que estava fora de lugar no gateway voltou para o `chamarModelo`, que é o método que ele descreve. O código final da execução entrou na techspec §3 e no schema com o mesmo texto.
- **Proibições:** nenhum `.skip`, nenhum teste comentado, nenhum mock novo e nenhum provedor pago no diff.

**Bloqueantes:** nenhum.

**Recomendações:** nenhuma nova. As da 1ª rodada estão todas na tabela "Sem aplicar" do `1_task.md`, cada uma com destino ou motivo. Entre elas, o relógio falso no caso da troca para o modelo menor foi recusado com motivo, e o import relativo de `packages/core` foi para o `TODO.md`.

Para quem for rodar os testes: dentro de `apps/api` o `npx vitest run` não acha `@educa/core` nem `@educa/shared`, porque os pacotes não estão construídos. Rodei da raiz do repositório.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/apps/api/src/ia/ia.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/apps/api/src/governanca/governanca.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l2/tasks/prd-camada-ia/1_task.md
