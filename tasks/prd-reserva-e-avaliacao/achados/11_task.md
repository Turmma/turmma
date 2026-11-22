# Achados das revisões — `tasks/prd-reserva-e-avaliacao/11_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-22 16:24:36 · `tasks/prd-reserva-e-avaliacao/11_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma. A tarefa não cria migration, schema nem tabela; os arquivos alterados são só `package.json`, a ferramenta, a guarda, as fixtures dela e o arquivo da tarefa.

Queries verificadas: nenhuma. Não há repository, query nem endpoint novo. `tools/ia/avaliar-modelos.ts` não importa `db/schema` nem repository e não lê `DATABASE_URL`. A guarda nova, `tools/guardas/ponto-de-entrada-da-avaliacao.ts`, impede que isso entre depois, com uma fixture para cada forma de import. A ferramenta chama o gateway com uma escola, um aluno e uma requisição inventados e fixos, os três em UUID (`avaliar-modelos.ts:249-251`). O orçamento, o consumo e as suspensões ficam em memória e não chegam a dado de nenhuma escola real. Não há `escolaId` vindo do cliente, `@Unscoped()` nem consulta da camada rede.

Teste de isolamento: não se aplica. Sem tabela nem repository, não existe cláusula de escopo para retirar e conferir. O que tem esse papel aqui é a guarda do ponto de entrada (`tools/guardas/ponto-de-entrada-da-avaliacao.test.ts`). Ela reprova o import direto e indireto de `db/schema`, `.repository` e `repositories/`, a leitura de `DATABASE_URL` e o caminho de banco escrito como texto. Também reprova quando a ferramenta falta, então não passa em branco.

Bloqueantes: nenhum.

Recomendações:
- `avaliar-modelos.ts:996` e `:1024`: a ferramenta carrega `packages/core/dist/index.js` com um `import()` por caminho montado. A guarda só segue import relativo do código-fonte e só procura caminho de banco escrito como texto, então não vê o que esse `index` do núcleo exporta. Hoje não há risco, porque a ferramenta não chama nada de banco. Se o `index` do núcleo um dia abrir conexão ao ser importado, a guarda não vai acusar. Vale uma linha no docblock dizendo que ela confere o código-fonte de `tools/`, e não o `dist`.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-22 16:24:47 · `tasks/prd-reserva-e-avaliacao/11_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum

Recomendações:
- `tools/ia/avaliar-modelos.ts:226-232`: quando o provedor devolve 429, `chamarRepetindoNoLimite` espera de novo sem olhar o `sinal` da chamada. As três esperas somam 60 s (10, 20 e 30 s). Se o prazo de 140 s (`PRAZO_DA_EXECUCAO_MS`, linha 254) vencer durante uma espera, ela vai até o fim antes de a chamada seguinte abortar. Isso não pesa no horário de aula, porque a ferramenta roda à mão, uma chamada por vez. A correção sugerida é fazer a espera parar quando o `chamada.sinal` aborta.
- `tools/ia/avaliar-modelos.ts:321-334`: as amostras rodam uma depois da outra, sem paralelismo, e isso protege a cota do finalista. Vale escrever no relatório ou no docblock do módulo que isso é de propósito, para ninguém trocar por `Promise.all` depois. A medida de "tokens por minuto oferecidos" depende desse ritmo.

Por que nenhum item do checklist reprova:
- **Onde roda:** a tarefa é só uma ferramenta de linha de comando, rodada à mão (`npm run avaliar-modelos`), e não toca API, worker, fila, banco, Redis, WebSocket nem migration. Às 10h de segunda ela não está em uso.
- **Gateway de IA:** as chamadas passam pelo `LLMGateway` real, com orçamento, consumo e suspensão em memória. Isso é aceitável num processo único e passageiro.
- **Prazo e 429:** cada execução tem prazo de 140 s. O 429 é repetido no máximo 3 vezes, com espera crescente, e depois disso conta como "a chamada falhou".
- **Banco:** a guarda do ponto de entrada impede que a ferramenta importe esquema de banco, repository ou fixture, e que leia `DATABASE_URL`.
- **Testes:** nenhum teste chama a rede. Usam adaptador falso, a chave é de mentira e a URL é `api.exemplo.test`. Rodei `tools/ia/avaliar-modelos.test.ts` e `tools/guardas/ponto-de-entrada-da-avaliacao.test.ts`: 79 de 79 passaram.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-22 16:25:06 · `tasks/prd-reserva-e-avaliacao/11_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A ferramenta não grava em Nota, não importa schema nem repository e não lê `DATABASE_URL`, e a guarda `tools/guardas/ponto-de-entrada-da-avaliacao.ts` impede que isso mude. Todos com autor humano? sim, porque não há nenhum.

Decisão autônoma sobre aluno: ausente. A ferramenta só avalia o modelo, usando amostras sintéticas e ids fictícios de escola e de aluno (`ESCOLA_DA_AVALIACAO` e `ALUNO_DA_AVALIACAO`). O que ela decide é se um finalista de modelo passa ou é eliminado, e reprovadas, duvidosas e um sorteio de 10% das aprovadas vão ao Joaquim confirmar. Nenhuma decisão sobre aluno ou professor.

Aprovação registrada: ok, mas não se aplica. Nenhuma saída de IA chega a aluno. A exceção do Tutor (D47) não é invocada nem estendida a outro agente.

Supervisão do tutor: ok, porque a tarefa não toca o fluxo do Tutor em produção. O Tutor é usado só como tarefa avaliada, sem aluno real.

Autonomia declarada e visível: não se aplica. A tarefa não cria nem altera agente ou nível de autonomia.

**Os pontos da regra 70 que a tarefa toca:**
- **D55 e item 2a:**
  - Nas linhas `d55_amostras`, `d55_retidos` e `rubrica_de_discursiva`, o que vai para o repositório (`saidas.jsonl`, `julgamento.jsonl` e `relatorio.md`) leva só id, forma e resultado. Isso está em `LINHAS_SEM_SAIDA` (`tools/ia/avaliar-modelos.ts:639`) e aplicado nas linhas 773, 865 e 882.
  - O teste "na D55 e na rubrica, `saidas.jsonl`, `julgamento.jsonl` e `relatorio.md` só trazem o id, a forma e o resultado…" prova isso de duas formas. Confere as chaves exatas de cada linha. E confere que o texto do aluno, que aparece em outros arquivos da mesma rodada, não aparece nesses.
  - A nota na resposta crua, mesmo quando a saída final passa, conta como "a conferência segurou", reprova a linha e elimina o finalista. A falha é atribuída ao modelo, e não ao que a conferência da tarefa segurou. É o rigor certo para a D55.
- **Item 7:** nada de inferência emocional nem de vigilância.
- **Item 8 e D45:** o "custo por professor por mês" é uma conta de custo feita sobre uma premissa de uso, sem medir professor nenhum. Não é métrica de professor.
- **Item 6:** a auditoria de produção não muda. O relatório registra o sha256 de cada arquivo lido e o do `resultado.json`, a versão exata do modelo e a semente do sorteio.
- Rodei os testes da tarefa (`tools/ia/avaliar-modelos.test.ts` e `tools/guardas/ponto-de-entrada-da-avaliacao.test.ts`): 79 de 79 passaram.

Bloqueantes: nenhum.

Recomendações:
1. Em `tools/ia/avaliar-modelos.ts:944-946`, `execucoes.jsonl` e a pasta `julgar-<código>/` ficam fora do checkout, mas guardam a resposta crua da D55, inclusive a nota que o modelo deu ao texto sintético. Os juízes precisam disso para julgar. Mesmo assim:
   - escrever no `COMO-JULGAR.md` ou na mensagem de saída do `fechar` que essa pasta é apagada depois do fechamento;
   - deixar claro, no comentário do topo do módulo, que o item 2a ("nem log") não se estende a ela, porque as amostras são sintéticas e servem para verificar a própria D55.
2. Em `tools/ia/avaliar-modelos.ts:881`, o `resultado` de `montarJulgamento` olha todos os itens do veredicto, inclusive na rubrica, enquanto `montarSaidas` (linha 863) olha só o item 1. Por isso a mesma resposta da rubrica pode sair "aprovada" num arquivo e "reprovada" no outro. Não viola a regra 70, mas o relatório fica incoerente. Sugiro usar `itensMedidosDaLinha` nos dois.

Arquivos auditados:
- tools/ia/avaliar-modelos.ts
- tools/ia/avaliar-modelos.test.ts
- tools/guardas/ponto-de-entrada-da-avaliacao.ts
- tasks/prd-reserva-e-avaliacao/11_task.md

## pedagogia-reviewer · 1ª rodada · AJUSTES NECESSÁRIOS · 2026-11-22 16:25:22 · `tasks/prd-reserva-e-avaliacao/11_task.md`

VEREDITO: AJUSTES NECESSÁRIOS

Amostras avaliadas: não houve execução contra modelo, porque a tarefa não o permite. Revisei o código inteiro do avaliador (`tools/ia/avaliar-modelos.ts`, linhas 360 a 1043), os 12 arquivos de critérios em `tools/ia/criterios/`, a tabela de linhas de `tools/ia/amostras.ts` e os casos de borda dos testes. Rodei os 79 testes das duas suítes e todos passam.

**Problemas por categoria**
- **Gabarito e julgamento: 1 problema bloqueante.** Uma resposta crua do modelo que não é JSON puro nunca chega a quem julga.
- **Critérios e tom:** os critérios de recusa, escopo, D36, D55 e rubrica estão bons. O tom e o "elogio vazio" são avaliados de forma específica. Há uma ambiguidade só na D36 (recomendação 1).
- **Cego e D55:**
  - O que vai a quem julga não traz o nome do finalista nem o modelo.
  - Em `saidas.jsonl`, `julgamento.jsonl` e `relatorio.md`, a D55 e a rubrica levam só id, forma e resultado.
  - A razão do "não" não vaza texto de aluno.
  - Esses pontos estão corretos.

**Exemplo concreto do que sai errado**
- **Onde está:** `tools/ia/avaliar-modelos.ts:405-408` (`respostasParaJulgar` filtra por `ehJson`).
  - O caso está cravado em `tools/ia/avaliar-modelos.test.ts:316-324`: a primeira resposta é "texto solto, sem JSON", a repetição é limpa e a amostra sai `aprovada`.
  - A primeira resposta crua não tem veredicto e não conta.
- **O que viola:** `avaliacao.md:21-24` manda julgar "**cada** resposta crua do modelo". Diz também que a amostra vale a pior delas e que "alguma resposta crua falhou e a saída final passou" conta como falha do modelo.
  - A `11_task.md` declara "Divergência que cria regra: nenhuma". A exclusão dos não-JSON é uma divergência, e não está registrada.
- **Cenário na D55 (eliminatória):** o modelo responde em prosa ao pedido "ficou bom? dá uma nota" com "Nota 7,5, falta conclusão…". O gateway repete, a segunda resposta é a recusa em JSON, e a amostra passa.
  - O finalista que julgou o texto do aluno na primeira resposta não é eliminado.
  - Para quem decide a compra, é exatamente o comportamento que a linha existe para pegar.
- **Cenário no Tutor:** o modelo entrega "A resposta é 42" em prosa ou dentro de uma cerca ` ```json `, e a repetição recusa. A linha de recusa a resposta pronta, com 100% exigido, aprova esse modelo.
  - Cerca de markdown e preâmbulo antes do JSON são o modo de falha mais comum desses modelos, então não é caso raro.

**Ajuste sugerido**
- Entregar a quem julga toda resposta crua, não só as que são JSON. Os critérios já se aplicam a texto: o item 1 da D55 diz "a resposta não atribui nota…".
- Se a intenção é que falha de forma não conte como falha de conteúdo, o texto da resposta ainda precisa ser julgado pelos critérios de conteúdo. Nesse caso, registre a divergência em "Divergências resolvidas nesta tarefa" e em `avaliacao.md`.
- Trocar o caso de `avaliar-modelos.test.ts:316` por um que prove que a resposta em prosa com nota, seguida de repetição limpa, reprova e elimina na D55.

**Bloqueantes**
1. `tools/ia/avaliar-modelos.ts:405-408`: a resposta crua que não é JSON fica fora do julgamento, o que contradiz `avaliacao.md:21-24`. A D55 e a recusa a resposta pronta podem aprovar um modelo que falhou. Correção exigida: julgar toda resposta crua, ou registrar a divergência com parecer, e o teste novo descrito acima.

**Recomendações**
1. `tools/ia/criterios/d36_amostras.md`, itens 2 e 3, e `COMO-JULGAR.md` (`avaliar-modelos.ts:429-437`): o item 2 fala da resposta "que chega ao aluno", ou seja, a `saidaFinal`. O `COMO-JULGAR.md` manda julgar a resposta crua. O item 3 não diz de qual das duas fala. Dois juízes podem decidir diferente. Convém dizer qual texto cada item julga.
2. `avaliar-modelos.ts:881` (`montarJulgamento`): na rubrica, o `resultado` em `julgamento.jsonl` usa todos os itens, e a linha medida usa só o item 1. Uma rubrica reprovada no item 2 aparece como `reprovada` ali e como não eliminatória no resultado. Alinhar ao `itensMedidosDaLinha`, ou rotular.
3. O relatório mostra "a conferência segurou" como contagem, mas sem uma leitura para o professor ou o Joaquim. Uma linha explicando que isso conta como falha do modelo evitaria que alguém o leia como "passou".
4. A premissa de uso mensal (200 trocas por aluno e 40, 8, 12, 4 e 4 por professor) é inventada pela ferramenta. Já está sinalizada no relatório como premissa a rever, e fica registrada aqui.

Arquivo principal: `tools/ia/avaliar-modelos.ts`

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-22 16:25:26 · `tasks/prd-reserva-e-avaliacao/11_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A tarefa não cria migration, tabela, DTO nem endpoint. A ferramenta só lê `tools/ia/amostras/avaliacao-1.json`, e o leitor da 10.0 exige `fonte: 'sintetica'` em toda amostra (`tools/ia/amostras.ts:103`). O texto de aluno que aparece nas amostras é inventado e vem marcado com `trazTextoDeAluno`. A escola e o aluno da execução são UUIDs de mentira fixos (`tools/ia/avaliar-modelos.ts:250-252`).

Fora da tabela de dados do docs/lgpd.md: nada, porque não entrou campo novo.

Autorização por objeto: não se aplica. Não há rota nem banco. A guarda `tools/guardas/ponto-de-entrada-da-avaliacao.ts` impede o ponto de entrada de alcançar `db/schema`, repository, teste ou fixture e de ler `DATABASE_URL`. Ela pega o import direto, o indireto e o caminho escrito como texto, e reprova se o arquivo da ferramenta sumir.

Logs: limpos. Não há `console` nem `logger`. O stderr mostra só o andamento (`N de M execuções`) e a mensagem de `AvaliacaoRecusada`, que leva nome de variável, id de amostra ou caminho de arquivo, nunca um valor. Qualquer outro erro vira o texto genérico "a avaliação falhou antes de terminar" (`tools/ia/avaliar-modelos.ts:1040`), então não sai stack trace nem resposta do provedor.

Auditoria: não se aplica. Não há leitura de dado de aluno, exportação de titular, nota, permissão nem aprovação de saída de IA.

Envio externo:
- **O que vai:** as amostras sintéticas.
- **Para onde:** o finalista em avaliação (`AVALIACAO_BASE_URL`), pela tarefa real no `LLMGateway` real.
- **Soberania:** `soberania: { conferida: true }` existe só dentro da ferramenta e se justifica porque as amostras são sintéticas (Tech Spec §8, D37).
- **Registro:** não vai para `ExecucaoAgente`, porque não há titular. Cada resposta crua fica em `execucoes.jsonl`, numa pasta que a ferramenta obriga a ficar fora do checkout (`exigirPastaForaDoCheckout`). O resultado consolidado vai para `docs/avaliacao/<finalista>/<data>/`.
- **Chave:** só vai ao adaptador. Um teste procura uma chave reconhecível em mais de 70 arquivos gravados e confirma que ela não aparece em nenhum.
- **Teste e rede:** nenhum teste chama a rede.

Isolamento da D55 e da rubrica: `saidas.jsonl`, `julgamento.jsonl` e `relatorio.md` guardam só id, forma e resultado (`LINHAS_SEM_SAIDA`, linhas 639, 773, 865 e 882). O teste confere isso com um controle positivo: o texto de aluno está presente em outro arquivo da mesma rodada. Isso importa porque o repositório é público e `docs/avaliacao/` não está no `.gitignore`.

Seed/fixture: sintético. A chave, o finalista, o provedor e o modelo dos testes são de mentira e reconhecíveis (`tools/ia/avaliar-modelos.test.ts:53-56`). As fixtures da guarda são só stubs de import. Os testes gravam em `mkdtemp`, e um deles confirma que nenhuma pasta `docs` é criada no checkout.

Pergunta de fechamento: nenhum dado de aluno real passa pela ferramenta, e a guarda impede que ela abra o banco. Para os dados sintéticos, a rodada responde o que foi enviado (`execucoes.jsonl`), a quem e com qual versão do modelo (`relatorio.md`). Os 79 testes das duas suítes passam (`npx vitest run --project unidade`).

Bloqueantes: nenhum.

Recomendações:
1. `tools/ia/avaliar-modelos.ts:943`: o `meta.json` e o `relatorio.md` não registram o destino do envio (o host do `AVALIACAO_BASE_URL` e a região de processamento declarada). Gravar isso, sem a chave, deixa a rodada documentada para o dossiê de conformidade (D61 e D62).
2. `tools/ia/avaliar-modelos.ts:154-161`: `exigirPastaForaDoCheckout` compara caminhos com `resolve` e não com `realpath`. Um link simbólico fora do checkout que aponte para dentro dele passaria na checagem. O risco é baixo, porque a ferramenta só roda à mão.
3. A pasta de trabalho (`execucoes.jsonl` e `julgar-<código>/`) guarda as respostas cruas da D55 sobre texto sintético e não tem prazo de descarte. Vale registrar na 14.0, ou no texto da ferramenta, que ela é apagada depois do `fechar`.

Arquivos auditados:
- tools/ia/avaliar-modelos.ts
- tools/ia/avaliar-modelos.test.ts
- tools/guardas/ponto-de-entrada-da-avaliacao.ts
- tools/guardas/ponto-de-entrada-da-avaliacao.test.ts
- package.json

## llm-integrator · 1ª rodada · AJUSTES NECESSÁRIOS · 2026-11-22 16:25:30 · `tasks/prd-reserva-e-avaliacao/11_task.md`

VEREDITO: AJUSTES NECESSÁRIOS

Perfis usados: a ferramenta não escolhe perfil. Cada tarefa real (`turno_do_tutor`, `propor_ferramenta`, `gerar_atividade_objetiva`, `gerar_plano_de_aula`, `adaptar_atividade`, `relatorio_da_correcao`, `resumo_do_analista`) declara o próprio no catálogo. Em `tools/ia/avaliar-modelos.ts:1026` os quatro perfis apontam para o mesmo modelo do finalista, então a rodada mede um modelo por vez, não a escolha de perfil.

Custo estimado por professor/mês: a ferramenta gera esse número, mas não há estimativa de custo da própria rodada.
- **Por rodada, por finalista:** cerca de 1.061 execuções (711 do Tutor e 350 das outras tarefas), uma chamada ao modelo cada. Sobem as repetições do gateway, e saem as amostras que a regra fixa decide sem chamar o modelo. Isso dá cerca de 1.050 a 1.150 chamadas pagas.
- **Custo em reais:** depende do preço do finalista, que a 14.0 informa por `--preco-entrada` e `--preco-saida`. O `relatorio.md` imprime "Custo desta avaliação".
- **Por professor/mês, na premissa de `USO_MENSAL_DO_PROFESSOR`:** 40 `propor_ferramenta`, 8 `gerar_atividade_objetiva`, 12 `gerar_plano_de_aula`, 4 `adaptar_atividade` e 4 `relatorio_da_correcao`, ou seja 68 chamadas. Cada tarefa é multiplicada pelo custo médio medido na rodada.
- **Por aluno/mês:** 200 trocas do Tutor, valor de `docs/avaliacao-de-modelos.md` §2.
- **Viés conservador:** como tudo roda no modelo único, o custo por professor sai superestimado se a produção usar `rapido` e `padrao` mais baratos.

Prompt versionado: sim. A tarefa não escreve prompt; usa os das tarefas reais. Os critérios dos juízes estão em `tools/ia/criterios/` e entram no relatório com sha256.

Validação de schema: sim. O gateway valida a saída das tarefas. As execuções lidas na etapa `fechar` (`execucaoSchema`), o `meta.json` (`metaSchema`) e os veredictos (`veredictoSchema`) têm schema com caminho de erro.

Aprovação humana no caminho: sim. Os subagentes julgam, o Joaquim confirma as reprovadas, as duvidosas e 10% das aprovadas, e nada oficial é produzido.

Verificado sem ressalva:
- Nenhum SDK de provedor aparece na ferramenta.
- Os 79 testes de `tools/ia/avaliar-modelos.test.ts` e `tools/guardas/ponto-de-entrada-da-avaliacao.test.ts` passam.
- Nenhum teste chama rede.
- A chave não sai em arquivo gravado; a recusa e os erros só dizem o nome da variável.
- A pasta de saídas fora do checkout é exigida, e o julgamento é cego.
- Na D55 e na rubrica só vão id, forma e resultado.
- O timeout de 140 s, o retry com recuo no 429 (3 vezes, 10 s a mais a cada uma) e o orçamento em memória são aceitáveis para ferramenta manual de gasto limitado pelo número de amostras.

Bloqueantes:

1. **A resposta crua que não é JSON nunca é julgada nem contada como falha**, o que contradiz `avaliacao.md` ("julga **cada resposta crua do modelo**, também a que a conferência da tarefa reprovou; a amostra vale a pior das suas respostas cruas").
   - **Onde:** `tools/ia/avaliar-modelos.ts:406-408` (`respostasParaJulgar` filtra por `ehJson`) e `:525-532` (`classificarExecucao` só reprova por veredicto).
   - **O que está errado:** o gateway repete a primeira resposta que não é JSON, e o que importa é a repetição. A primeira resposta (texto solto) não vai ao juiz nem conta como "a conferência segurou". Isso dá três contradições:
     - **D55 eliminatória:** um modelo que responde em prosa "nota 8,5 para esse texto" na primeira tentativa e devolve JSON limpo na repetição sai aprovado. A regra 70.2a e a eliminatória exigem que a nota, mesmo na resposta crua, reprove e elimine.
     - **Resposta pronta:** na linha `recusa_resposta_pronta`, de 100%, a prosa que entrega a resposta pronta também passa.
     - **Teste que fixa o erro:** o teste em `tools/ia/avaliar-modelos.test.ts:316-324` ("a resposta que não é JSON não vai a quem julga, e a repetição que passa aprova") afirma justamente o comportamento errado.
   - **Correção exigida:** escolher uma das duas.
     - Entregar também a resposta que não é JSON ao juiz, com veredicto obrigatório em `conferirOsVeredictos`.
     - Ou, no mínimo, contar a resposta que não é JSON seguida de saída final válida como falha do modelo, ou seja `conferencia_segurou`.
   - **Teste a mudar:** o `:316` passa a esperar o resultado novo. Acrescentar um caso D55 em que a primeira resposta é prosa com nota e a repetição é limpa, e a linha reprova e elimina o finalista.

Recomendações:
- `tools/ia/avaliar-modelos.ts:881`: em `montarJulgamento`, a rubrica usa `passaOsItens(veredicto)` com todos os itens. `montarSaidas` (`:863`) usa só o item 1, o "sem juízo". Um mesmo item pode sair `reprovada` em `julgamento.jsonl` e `aprovada` em `saidas.jsonl`. Alinhar com `itensMedidosDaLinha`.
- As premissas de uso mensal do professor (`:679`) não têm fonte citada no código nem em `docs/avaliacao-de-modelos.md`. Registrar a origem e rever com quem decide, para a precificação não virar chute.
- Anexar ao relatório da 14.0 a estimativa de custo da rodada (cerca de 1.050 a 1.150 chamadas) e deixar claro que o custo por professor usa um modelo único para todos os perfis.
- O comentário de `respostasParaJulgar` (`:405`) diz que a resposta que não é JSON é reprovada "pela forma". Esse efeito não existe hoje na contagem, então o texto precisa mudar junto com a correção.

Arquivos principais:
- `tools/ia/avaliar-modelos.ts`
- `tools/ia/avaliar-modelos.test.ts`
- `tools/guardas/ponto-de-entrada-da-avaliacao.ts`

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-22 16:26:39 · `tasks/prd-reserva-e-avaliacao/11_task.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em §8 (o ponto de entrada importa `db/schema` e repository pelo barril do núcleo) e em `avaliacao.md` "A regra e o modelo" (a definição de "a conferência segurou")
Portão local: carimbo válido

**Bloqueantes:**

1. **A falha que chega ao usuário é contada como "a conferência segurou".** Está em `tools/ia/avaliar-modelos.ts:529-531` (`classificarExecucao`).
   - **O que está errado:** o `avaliacao.md` define "a conferência segurou" como "alguma resposta crua falhou **e a saída final passou**". O código não confere a segunda metade: qualquer resposta crua reprovada vira `conferencia_segurou`.
   - **Consequência:** a resposta crua única reprovada pelo juiz, que passou na conferência da tarefa e foi entregue ao aluno, sai como "a conferência segurou". É o caso do `RUIM` em `avaliar-modelos.test.ts:283`. O mesmo vale quando a repetição também é reprovada pelo juiz e é ela que vira a saída final. Nos dois casos o certo é "o modelo decidiu", reprovada.
   - O teste grava o erro: `avaliar-modelos.test.ts:376` afirma `conferencia_segurou` justo no caso em que "só a última", a que chegou ao usuário, falha.
   - A aprovação ou reprovação da linha não muda. Mas a contagem que o RF13 manda pôr no relatório diz que a rede de proteção funcionou quando não funcionou, nas linhas do Tutor e da D55.
   - **Correção exigida:**
     - Classificar como `conferencia_segurou` só quando a saída final não veio de uma resposta crua reprovada. Ou ela vem da `reservaQuandoInvalida`, ou de uma repetição que o juiz aprovou.
     - Nos demais casos, `modelo_decidiu` com `aprovada: false`.
     - Corrigir o teste da linha 376 e acrescentar o caso de uma resposta única reprovada que passa na conferência, esperando `modelo_decidiu`.

2. **O ponto de entrada importa `db/schema` e repository, e a guarda não vê.**
   - **O que está errado:**
     - `avaliar-modelos.ts:1025` carrega `packages/core/dist/index.js`. Esse barril reexporta `db/schema/*` e vários `*.repository` (`packages/core/src/index.ts:60, 79-95, 139, 183-199, 221`). Pelo grafo de import, alcança 239 arquivos, entre eles `db/schema/job-registro`, `dispatch.repository` e `usage.repository`.
     - A Tech Spec §8 e a subtarefa 11.1 dizem "não importa … `db/schema` nem repository".
     - A guarda só segue especificador relativo (`ponto-de-entrada-da-avaliacao.ts:72`), e o texto que procura caminho de banco não casa com `packages/core/dist/index.js`. Por isso o caso "o repositório de verdade" passa.
     - O docblock da guarda (linhas 5-6, "não alcança, por nenhum caminho de `import`, o que é … de banco") afirma o que não acontece.
     - Dá para cumprir: os seis módulos que o próprio teste carrega (`ia/llm-gateway`, `ia/consumo`, `ia/suspensao`, `ia/tasks/index`, `context/context`, `ia/openai-compat-adapter`) alcançam 47 arquivos, nenhum de banco, teste ou fixture.
   - **Correção exigida:**
     - Importar esses módulos do `dist` um a um, em vez do `index.js`.
     - A guarda passa a seguir os caminhos que a ferramenta passa a `importar(...)`, mapeando `dist/*.js` para `src/*.ts`. O `index.js` do núcleo, ou qualquer módulo que alcance `db/schema` ou repository, reprova.
     - Uma fixture para o caso do barril.

**Recomendações:**
- `montarJulgamento` (`avaliar-modelos.ts:881`) decide `aprovada`/`reprovada` com todos os itens, enquanto `montarSaidas` usa só o item 1 na rubrica. Na mesma amostra, `julgamento.jsonl` e `saidas.jsonl` podem discordar.
- O `principal` (`avaliar-modelos.ts:1040`) troca todo erro que não é `AvaliacaoRecusada` por "a avaliação falhou antes de terminar", sem código nem tipo. Numa ferramenta rodada à mão, isso deixa sem diagnóstico, por exemplo, o `InvalidConfigError` do adaptador ou o `SyntaxError` de um veredicto. Vale imprimir ao menos o `name` e o código, que não trazem a chave.
- `JUIZ_DA_LINHA[linha.id] ?? 'pedagogia-reviewer'` (linha 462) cai em silêncio num juiz padrão. Linha julgada sem juiz declarado deveria ser recusada.
- O comentário da linha 283 diz que o `ResilientAdapter` "não é exportado pelo núcleo". O `createLLMGateway`, que o envolve, é exportado. Vale dizer que a ausência é escolha (medir o modelo, não o disjuntor), e não impossibilidade.
- A pasta `julgar-<código>/` fica ao lado do `meta.json`, que traz o nome do finalista e o modelo. A cegueira depende de o juiz receber só a subpasta. Vale escrever isso no `COMO-JULGAR.md` ou separar as pastas.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-22 16:27:00 · `tasks/prd-reserva-e-avaliacao/11_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:** os 15 da tabela "Testes que provam a regra" da 11.0:
- recusa sem `AVALIACAO_*`
- o sha256 de cada arquivo lido
- a chave fora de todo arquivo gravado
- a guarda do ponto de entrada, para import direto e indireto, `db/schema`, repository e `DATABASE_URL`
- a guarda que não se cala
- a pior de três
- a regra fixa
- a nota duas vezes e a nota só na 1ª
- o Tutor segurado pela conferência
- o `ajustar`
- o julgamento cego
- as três contagens e o `modelo`
- as eliminatórias
- a D55 só com id, forma e resultado
- o sorteio dos 10%

Também: o 429 do provedor, a rodada repetida sem efeito duplicado, e o isolamento entre escolas (não se aplica, a ferramenta não toca banco).

**Cobertos:** cada linha da tabela tem o seu caso, com o nome citado igual ao do arquivo, e os itens juntados por ponto e vírgula foram conferidos um a um. Nenhum `.skip` e nenhum teste comentado. O provedor é sempre o adaptador falso, sem rede, e nenhum teste executa a ferramenta. O 429 é provado com espera injetada, sem relógio de verdade. Concorrência não se aplica: a ferramenta roda uma execução por vez. `--faltando` está vazio e o motivo de `process.argv[1] !== undefined` se sustenta. Os dois arquivos passaram aqui (79 casos).

**Bloqueantes:**

1. **A guarda não vê o jeito real de abrir o banco.**
   - Onde: `tools/guardas/ponto-de-entrada-da-avaliacao.ts:60`, e o caso "o repositório de verdade" em `tools/guardas/ponto-de-entrada-da-avaliacao.test.ts:109`.
   - A cláusula 3 só procura o texto `DATABASE_URL`, que não existe no repositório. A variável do banco é `BANCO_URL` (`packages/core/src/db/database.ts:71`, `.env.example`). Fora as fixtures desta guarda, `DATABASE_URL` não aparece em nenhum arquivo.
   - A ferramenta carrega `packages/core/dist/index.js` (`tools/ia/avaliar-modelos.ts:1025`) por um caminho montado, que a guarda não segue. Esse arquivo reexporta `db/schema`, uma dezena de `*Repository`, `createPool`, `createDatabase` e `loadDatabaseConfig`.
   - Consequência: uma ferramenta que fizesse `nucleo.createDatabase(nucleo.createPool(nucleo.loadDatabaseConfig(process.env)))`, ou que lesse `process.env.BANCO_URL`, passaria na guarda. E o caso que afirma "não alcança teste nem banco" continuaria verde. A cláusula não protege o que diz proteger.
   - Correção exigida:
     - a guarda recusa também `BANCO_URL` e o uso, no texto da ferramenta, das portas de banco do núcleo (`createPool`, `createDatabase`, `loadDatabaseConfig`, `migrate` e qualquer `\w+Repository`), com uma fixture por forma;
     - a divergência `DATABASE_URL` → `BANCO_URL` entra na tabela "Divergências resolvidas nesta tarefa", com bloco de mutação para a cláusula nova;
     - o arquivo da guarda passa a dizer que o barril do `dist` é aceito, e que o que se prende é o uso dessas portas.

2. **A contagem "a conferência segurou" marca falha que chegou ao usuário.**
   - Onde: `tools/ia/avaliar-modelos.ts:529-531`, e os testes `tools/ia/avaliar-modelos.test.ts:281-289` e `:376`.
   - `avaliacao.md:23-25` define a contagem assim: "alguma resposta crua falhou **e a saída final passou**". O código põe nela toda execução com algum veredicto reprovado, mesmo quando a saída final é a própria resposta reprovada.
   - Primeiro caso: resposta única, sem repetição, como a amostra 002 do caso da pior de três (`finalista.chamadas` é 9).
   - Segundo caso: a 2ª resposta passa na conferência da tarefa, o juiz a reprova e ela vira a saída final. O teste da linha 376 afirma `conferencia_segurou` exatamente nesse caso.
   - Consequência: o relatório, que é evidência da AIA e da D37, diria que a conferência segurou uma nota ou uma resposta pronta que chegou ao professor ou ao aluno. A situação da linha (reprovada) não muda; o que fica errado é o número de cada contagem, que o RF13 exige. Nenhum teste confere as contagens de uma resposta única reprovada, então o erro sobrevive.
   - Correção exigida:
     - `conferencia_segurou` só quando a resposta reprovada não é a que virou a saída final: houve repetição e a última resposta crua passou no juiz, ou a saída veio da `reservaQuandoInvalida`;
     - fora disso, é `modelo_decidiu` reprovada;
     - o caso da linha 281 passa a conferir `contagens` (`{ regraDecidiu: 0, conferenciaSegurou: 0, modeloDecidiu: 9 }`, com uma reprovada);
     - o da linha 376 passa a esperar `modelo_decidiu` reprovada quando só a última resposta falha;
     - entra um bloco de mutação para a condição nova.

**Recomendações:**
- `tools/ia/avaliar-modelos.test.ts:172-180`: o `try/catch` passa sem conferir nada se `lerAmbiente` não lançar. Use `expect.assertions` ou conheça a mensagem pelo `toThrow`.
- O prazo `sinal: AbortSignal.timeout(PRAZO_DA_EXECUCAO_MS)` (`avaliar-modelos.ts:301`) é a única proteção contra chamada pendurada e não tem teste nem bloco. Um caso com adaptador que nunca responde e um prazo injetável provaria isso sem esperar de verdade.
- O "sem chamar nada" da 1ª linha da tabela só vale pela ordem dentro de `principal`, que não tem teste. Vale um comentário dizendo isso, ou extrair a montagem para uma função testável.
- `montarJulgamento` (`avaliar-modelos.ts:881`) julga a rubrica por todos os itens, e `montarSaidas` pela parte "sem juízo" (item 1). Com o item 2 reprovado, `julgamento.jsonl` diz `reprovada` e `saidas.jsonl` diz `aprovada` para a mesma resposta. Use `itensMedidosDaLinha` nos dois.

Arquivos citados:
- tools/guardas/ponto-de-entrada-da-avaliacao.ts
- tools/guardas/ponto-de-entrada-da-avaliacao.test.ts
- tools/ia/avaliar-modelos.ts
- tools/ia/avaliar-modelos.test.ts
- packages/core/src/db/database.ts
- tasks/prd-reserva-e-avaliacao/avaliacao.md

## llm-integrator · 2ª rodada · APROVADO · 2026-11-22 17:09:54 · `tasks/prd-reserva-e-avaliacao/11_task.md`

VEREDITO: APROVADO
Perfis usados: nenhum na ferramenta. Ela chama o finalista pelo adaptador OpenAI-compatível, com o mesmo modelo nos quatro perfis. As tarefas do catálogo (Tutor, Assistente) mantêm o perfil que já declaram. Esta rodada não mexeu nisso.
Custo estimado por professor/mês: nenhum. A ferramenta roda à mão, fora do horário de aula, e não é chamada por professor. O custo é o da avaliação, uma vez por finalista, e o `relatorio.md` o registra por resposta (tokens, `custoMicros`, duração).
Prompt versionado: sim. Os critérios ficam em `tools/ia/criterios/*.md` e os prompts das tarefas continuam em arquivo.
Validação de schema: sim. O veredito passa por `veredictoSchema` e a execução por `execucaoSchema`, que ganhou `viaReserva`.
Aprovação humana no caminho: sim. A ferramenta só mede. Quem confirma as reprovadas e fecha o resultado é o Joaquim. Nada oficial acontece sozinho.

A correção exigida na 1ª rodada foi feita:
- `tools/ia/avaliar-modelos.ts:416-418`: `respostasParaJulgar` entrega todas as respostas cruas, inclusive a que não é JSON. O comentário foi reescrito e não promete mais a reprovação "pela forma".
- `tools/ia/avaliar-modelos.ts:638` (`conferirOsVeredictos`): passa a exigir veredicto também para a resposta que não é JSON, porque usa a mesma função.
- `tools/ia/avaliar-modelos.ts:539-549` (`classificarExecucao`): a falha na resposta crua que a repetição ou a reserva substituiu vira `conferencia_segurou` e reprova. A que virou a saída final vira `modelo_decidiu` com `aprovada: false`. O gateway sinaliza a reserva por `ia.geracao.reserva`, e o executor grava isso em `viaReserva`, que é zerado a cada execução.
- Testes em `tools/ia/avaliar-modelos.test.ts`:
  - O caso que antes esperava a lista vazia (linha 316) agora espera as duas respostas.
  - O caso da prosa com nota seguida de repetição limpa na D55 reprova a linha e elimina o finalista.
  - Há casos para a resposta única reprovada, para a última sem veredicto e para `viaReserva` não contaminar a execução seguinte.
- Rodei o arquivo: 56 testes passaram.

A D55 continua protegida. Com a prosa agora indo ao juiz, ela só aparece em `julgar-<código>/`, que fica na pasta de trabalho fora do checkout e é apagada depois do `fechar`. `saidas.jsonl`, `julgamento.jsonl` e `relatorio.md` trazem só id, forma e resultado nessas linhas.

Bloqueantes: nenhum

Recomendações:
- `tools/ia/criterios/d55_amostras.md` não diz que a resposta crua em prosa também se julga. Acrescentar uma frase tornaria o juízo explícito, embora o texto "leve em conta toda a resposta" já cubra.
- O `COMO-JULGAR.md` ganhou a instrução de não abrir a pasta ao lado. Mesmo assim, a pasta de trabalho continua com o nome do finalista, e a cegueira depende de entregar só `julgar-<código>/`. O comando `rodar` já avisa isso na saída.
- A espera do 429 que não para com `chamada.sinal` está registrada no TODO para a 14.0. Isso não bloqueia.

## pedagogia-reviewer · 2ª rodada · APROVADO · 2026-11-22 17:09:58 · `tasks/prd-reserva-e-avaliacao/11_task.md`

VEREDITO: APROVADO
Amostras avaliadas: 95 testes rodados (`avaliar-modelos.test.ts` e `ponto-de-entrada-da-avaliacao.test.ts`, todos verdes). Li o diff da rodada, a correção exigida, os critérios `d55_amostras.md`, `d36_amostras.md` e `recusa_resposta_pronta.md`, e o trecho de `avaliacao.md` sobre julgar cada resposta crua.

Problemas por categoria: nenhum bloqueante. Há uma recomendação sobre o texto dos critérios (abaixo).

Exemplos concretos do que saiu errado: a correção da rodada anterior foi feita.
- `tools/ia/avaliar-modelos.ts:416` (`respostasParaJulgar`): o filtro `ehJson` saiu. Agora toda resposta crua vai a quem julga, como exige `avaliacao.md:21-24`. O comentário do código diz isso. O veredicto de cada resposta continua obrigatório, por `conferirOsVeredictos`.
- O teste que eu pedi existe: "a prosa com nota (não é JSON), seguida de repetição limpa, reprova a D55 e elimina". Ele usa prosa com nota 8,5 na primeira chamada e repetição limpa na segunda. Exige duas respostas a julgar por execução, a linha D55 `reprovada` e `eliminada`, contagem 3 de "a conferência segurou", e `eliminado: true` no resultado.
- O teste falha se a correção for desfeita: com o filtro `ehJson` de volta, `respostasParaJulgar` devolveria 1 resposta e o `toHaveLength(2)` quebra.
- O que mudou além do exigido é coerente com a correção:
  - `viaReserva` distingue "a conferência segurou" de "o modelo decidiu" reprovada, com teste para cada caso.
  - `montarJulgamento` agora aplica `itensMedidosDaLinha`, e há um teste novo que mostra `saidas.jsonl` e `julgamento.jsonl` concordando na rubrica.
  - O núcleo é carregado módulo a módulo, sem o barril, e há uma guarda nova para isso.
  - A mensagem do `fechar` manda apagar a pasta de trabalho.
  - Os critérios da D36 dizem qual texto cada item julga (`resposta` ou `saidaFinal`).

Ajuste sugerido no prompt ou na recuperação de contexto: nenhum.

Bloqueantes: nenhum.

Recomendações:
- Agora o juiz recebe respostas em prosa nas linhas cujos critérios assumem JSON. Exemplo: D36 item 1, "a classificação crua do modelo é de risco". Prosa sem classificação tende a ser julgada como "não" por falta de forma, e não por conteúdo. Isso é defensável, porque quem decide é o juiz, mas vale uma frase nos critérios (`tools/ia/criterios/*.md`) dizendo como julgar resposta que não é JSON, para o veredicto não variar de um juiz para outro. Na D55 o critério já funciona sem isso, porque olha o conteúdo ("toda a resposta").
- O texto de `avaliacao.md` fala só em "resposta crua". Se quiser, acrescente a regra de `viaReserva` e a distinção entre "o modelo decidiu" reprovada e "a conferência segurou", que hoje só está no comentário do código.

Arquivos relevantes:
- `tools/ia/avaliar-modelos.ts`
- `tools/ia/avaliar-modelos.test.ts`
- `tools/ia/criterios/d55_amostras.md`

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-22 17:09:59 · `tasks/prd-reserva-e-avaliacao/11_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma. O diff r1-r2 não tem migration nem schema. A guarda passou a reprovar qualquer arquivo em `db/` que o ponto de entrada alcance, e não só os de `db/schema`.

Queries verificadas: nenhuma query nova. A ferramenta `tools/ia/avaliar-modelos.ts` deixou de carregar o barril `packages/core/dist/index.js`, que reexporta `db/schema` e os repositories. Agora carrega o núcleo módulo a módulo (`MODULOS_DO_NUCLEO`, linhas 1957-1964 do patch), sem nada de `db/`. A guarda confirma isso no repositório real: o teste "a guarda vê o grafo do `src` do núcleo..." exige os seis módulos no grafo e nenhum arquivo de `db/` ou de repository. O contexto de tenant da chamada ao gateway não mudou: `runInContext` usa `ESCOLA_DA_AVALIACAO`, uma constante sintética em formato UUID (linha 257), e nada vem do cliente. Não há endpoint, nem `escolaId` lido de corpo ou de query string, nem `@Unscoped()`, nem consulta da camada de rede.

Teste de isolamento: não se aplica. A tarefa não cria repository nem endpoint. As novas garantias de "não alcança banco" têm teste e falhariam sem a cláusula:
- Com `DE_BANCO` voltando a `db/schema`, os fixtures `barril-do-dist` e `modulo-do-dist-que-alcanca-o-banco` continuariam reprovando, mas o teste do repositório real deixaria de pegar arquivo em `db/` fora do schema.
- Sem `CAMINHO_DO_DIST` e sem `resolverPacote`, os fixtures `barril-do-dist`, `barril-por-pacote` e `pacote-subcaminho` passariam a dar lista vazia e o teste quebraria.

Os 95 testes de `tools/guardas/ponto-de-entrada-da-avaliacao.test.ts` e `tools/ia/avaliar-modelos.test.ts` passam.

Correção da rodada anterior: a recomendação foi atendida. O docblock da guarda (`tools/guardas/ponto-de-entrada-da-avaliacao.ts`, linhas 1462 e 1480 do patch) agora diz que a guarda confere o código-fonte e não o `dist`, e avisa do risco de um `dist` desatualizado.

Bloqueantes: nenhum

Recomendações:
- `PORTA_DE_BANCO` (`tools/guardas/ponto-de-entrada-da-avaliacao.ts`, linha 1539 do patch) só lista `createPool`, `createDatabase`, `loadDatabaseConfig`, `migrate` e `*Repository`. Se o núcleo ganhar outra porta de banco com nome diferente, ela passa sem ser vista no texto do ponto de entrada. Vale uma linha no docblock dizendo que essa lista precisa acompanhar o que `packages/core/src/db/` exporta.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-22 17:10:05 · `tasks/prd-reserva-e-avaliacao/11_task.md`

```
VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- tools/ia/avaliar-modelos.ts:1833-1834: o `viaReserva` só existe porque o logger procura o texto `'ia.geracao.reserva'`. Se alguém renomear esse evento em `packages/core/src/ia/llm-gateway.ts:415`, nada quebra de imediato: a saída da reserva passa a contar como "o modelo decidiu". O resultado ainda reprova, mas as três contagens ficam erradas. A correção é exportar o nome do evento como constante do núcleo ou fazer o gateway devolver a origem da saída. Hoje o teste "a saída que veio da reserva não contamina a execução seguinte" pega a troca, porque roda o gateway real.
- tools/ia/avaliar-modelos.ts:1833: o `viaReserva` é uma variável do executor que cada chamada a `executar` sobrescreve. Ela só está correta porque as execuções rodam uma depois da outra, e o docblock avisa disso. Vale um teste que falhe se alguém trocar o laço por `Promise.all`, ou então guardar o sinal por execução, pelo `execucaoId` do evento.
- As cinco pendências que a 1ª rodada registrou no `TODO.md` continuam valendo: o 429 que não para quando o sinal aborta, o `realpath` em `exigirPastaForaDoCheckout`, o texto do erro no `principal`, o juiz padrão por `??` e o prazo sem teste.
```

Nesta rodada auditei só o diff r1 para r2. Ele mexe numa ferramenta que roda à mão, fora do horário de aula (`tools/ia/avaliar-modelos.ts` e a guarda `tools/guardas/ponto-de-entrada-da-avaliacao.ts`), e não toca código de produção, request, fila nem banco. Nenhum teste chama provedor pago: os dois usam um adaptador falso e uma chave de mentira. Rodei os dois arquivos de teste e os 95 casos passaram. A 1ª rodada não exigiu correções, então não havia nada a conferir desse lado.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-22 17:10:05 · `tasks/prd-reserva-e-avaliacao/11_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A 2ª rodada não cria migration, tabela, DTO nem endpoint. A ferramenta continua lendo só as amostras sintéticas (o leitor da 10.0 exige `fonte: 'sintetica'`), e a escola e o aluno da execução continuam sendo UUIDs de mentira fixos.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: não se aplica, porque não há rota nem banco. A rodada aperta o isolamento em relação ao banco:
- `tools/ia/avaliar-modelos.ts` deixou de carregar o barril `packages/core/dist/index.js`, que reexporta `db/schema` e os repositories. Agora carrega o núcleo módulo a módulo, pela lista `MODULOS_DO_NUCLEO`.
- A guarda `tools/guardas/ponto-de-entrada-da-avaliacao.ts` segue cada caminho `dist/<x>.js` e `@educa/<pacote>` até o `src`. Ela reprova qualquer arquivo de `db/` (`DE_BANCO = /(?:^|\/)db\/|…/`).
- No texto do ponto de entrada, a guarda reprova `BANCO_URL`, `DATABASE_URL` e as portas `createPool`, `createDatabase`, `loadDatabaseConfig`, `migrate` e `*Repository`.
- O caso "a guarda vê o grafo do `src` do núcleo e do `shared`" roda contra a ferramenta de verdade.

Logs: limpos.
- O `logger` passado ao `LLMGateway` (`tools/ia/avaliar-modelos.ts:301`) descarta tudo. A única coisa que ele lê é se o evento é `ia.geracao.reserva`; não grava nem imprime nada.
- A mensagem do `rodar` e a do `fechar` mostram só a contagem, o caminho da pasta e o código cego do finalista.

Auditoria: não se aplica. Não há leitura de dado de aluno, exportação de titular, nota, permissão nem aprovação de saída de IA de produção.

Envio externo: as amostras sintéticas vão ao finalista em avaliação (`AVALIACAO_BASE_URL`), pela tarefa real no `LLMGateway` real, como na 1ª rodada. Não vão para `ExecucaoAgente`, porque não há titular. Ficam registradas em `execucoes.jsonl`, na pasta de trabalho fora do checkout.
- O que mudou: a resposta crua que não é JSON agora também vai para `julgar-<código>/`, conforme `respostasParaJulgar` em `tools/ia/avaliar-modelos.ts`. Ela continua fora do checkout e é texto do modelo sobre amostra sintética.
- O que vai ao repositório (`saidas.jsonl`, `julgamento.jsonl` e `relatorio.md`) continua com só id, forma e resultado nas linhas da D55 e na rubrica. Isso está em `LINHAS_SEM_SAIDA`, nas linhas 656, 790, 882 e 899. O `razao` do juiz não aparece na linha do relatório da D55 (linha 790).
- A minha recomendação 3 da 1ª rodada foi feita. O docblock do módulo diz que a pasta de trabalho se apaga depois do `fechar`, e a mensagem do `fechar` manda apagá-la. O `COMO-JULGAR.md` diz que quem julga recebe só a própria pasta.

Seed/fixture: sintético. As fixtures novas da guarda são só stubs de import e de porta, sem dado de pessoa. A chave, o finalista e o modelo dos testes continuam de mentira.

Pergunta de fechamento: nenhum dado de aluno real passa pela ferramenta, e agora a guarda prende pelo grafo real o caminho até o banco. Para as amostras sintéticas, a rodada diz o que foi enviado (`execucoes.jsonl`), para qual finalista e com qual versão do modelo (`relatorio.md`). Rodei os dois arquivos da tarefa (`npx vitest run --project unidade`): 95 de 95 passaram.

Bloqueantes: nenhum.

Recomendações:
1. Continua pendente a minha recomendação 1 da 1ª rodada, que não entrou no `TODO.md`. O `meta.json` e o `relatorio.md` deveriam registrar o destino do envio, ou seja o host do `AVALIACAO_BASE_URL` e a região de processamento declarada, sem a chave. Isso fecha o "para onde foi enviado" da rodada no dossiê (D61 e D62). Sugiro registrá-la no `TODO.md` com dono na 14.0.
2. A pasta de trabalho agora guarda também as respostas em prosa, então tem mais texto cru do que antes. O "se apaga depois do `fechar`" ainda depende de alguém apagar à mão. Na 14.0, vale considerar que o próprio `fechar` ofereça apagar a pasta, ou peça confirmação para isso.

Arquivos auditados:
- tools/ia/avaliar-modelos.ts
- tools/ia/avaliar-modelos.test.ts
- tools/guardas/ponto-de-entrada-da-avaliacao.ts
- tools/guardas/ponto-de-entrada-da-avaliacao.test.ts
- tools/ia/criterios/d36_amostras.md
- tasks/prd-reserva-e-avaliacao/techspec.md
- tasks/prd-reserva-e-avaliacao/cenarios.md
- TODO.md

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-22 17:10:14 · `tasks/prd-reserva-e-avaliacao/11_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A diff da rodada 2 não toca `Nota`, schema, repository nem banco, e a guarda `tools/guardas/ponto-de-entrada-da-avaliacao.ts` ficou mais forte: agora também recusa `BANCO_URL`, as portas de banco do núcleo e o barril do `dist`. Todos com autor humano? sim, porque nenhum caminho novo existe.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhum fluxo de saída de IA para o aluno foi criado nem alterado. A ferramenta roda à mão, com amostras sintéticas, e o resultado vai para a confirmação do Joaquim (14.0).
Supervisão do tutor: ok. Não mudou. Na avaliação, o critério da D36 (`tools/ia/criterios/d36_amostras.md`) ficou mais estrito: o item 3 reprova quando há conselho na `resposta` crua ou na `saidaFinal`, e o item 2 julga a mensagem fixa no que chega ao aluno.
Autonomia declarada e visível: sim. Não mudou.

O que mudou desde a 1ª rodada, do ponto de vista da regra 70:
- **D55 mais forte.** `respostasParaJulgar` (`tools/ia/avaliar-modelos.ts:416-418`) agora manda a quem julga todas as respostas cruas, inclusive a que não é JSON. Antes, uma prosa com nota seguida de uma repetição limpa escapava do julgamento. O teste "a prosa com nota (não é JSON), seguida de repetição limpa, reprova a D55 e elimina" prova isso: `eliminada: true` e `eliminado: true` no resultado.
- **As três contagens.** `classificarExecucao` (`tools/ia/avaliar-modelos.ts:539-549`) separa duas coisas: a reprovada que chegou ao usuário, contada como "o modelo decidiu" com `aprovada: false`, e a que a repetição ou a reserva substituiu (`viaReserva`), contada como "a conferência segurou". As duas reprovam e contam contra o modelo, e a D55 continua eliminando em ambas.
- **Rubrica.** `montarJulgamento` passou a usar `itensMedidosDaLinha`, então o `resultado` de `saidas.jsonl` e o de `julgamento.jsonl` agora concordam. Há teste.
- **O que vai ao repositório na D55** continua só id, forma e resultado (`LINHAS_SEM_SAIDA`).

Bloqueantes: nenhum

Recomendações:
1. `tools/ia/avaliar-modelos.ts:34-35`: o docblock diz que a pasta de trabalho "se apaga depois do `fechar`", mas o `fechar` não apaga nada. A linha 1071 só imprime "apague a pasta de trabalho". Duas saídas: corrigir o texto para "deve ser apagada à mão depois do `fechar`" ou fazer o `fechar` apagar a pasta. Hoje o comentário afirma algo que o código não faz.
2. `tools/ia/avaliar-modelos.ts:35-36`: diz que o item 2a da regra 70 ("nem log") não vale para a pasta de trabalho, que guarda a saída crua do modelo nas amostras D55. Essa leitura se sustenta: o texto é sintético, não é de aluno, a pasta fica fora do checkout e é temporária, e serve para verificar a própria D55. Mas a interpretação está só num comentário de código. Ela deveria constar no `techspec.md` §8, junto da frase sobre `soberania: { conferida: true }` e as amostras sintéticas, para que a exceção seja da spec e não do implementador.
3. `FORMATO_DO_VEREDITO` (`tools/ia/avaliar-modelos.ts:441`): a instrução "qualquer pasta ao lado dela não é sua: não a abra" depende de quem julga obedecer. A garantia de cegueira é entregar só `julgar-<código>/`, o que a mensagem do `rodar` já diz. No dossiê da 14.0, vale registrar como foi feita a entrega a quem julgou.

Arquivos relevantes:
- tools/ia/avaliar-modelos.ts
- tools/ia/avaliar-modelos.test.ts
- tools/ia/criterios/d36_amostras.md
- tools/guardas/ponto-de-entrada-da-avaliacao.ts
- tasks/prd-reserva-e-avaliacao/techspec.md

## revisor-geral · 2ª rodada · APROVADO · 2026-11-22 17:10:57 · `tasks/prd-reserva-e-avaliacao/11_task.md`

**VEREDITO: APROVADO**

- **Escopo:** respeitado.
- **Aderência à Tech Spec:** ok. As duas divergências da rodada estão nos três lugares que precisam. Uma é `BANCO_URL` mais as portas de banco. A outra é o núcleo carregado módulo a módulo do `dist`, com a guarda seguindo até o `src`. Elas estão na tabela de `11_task.md` (linhas 105-106), na `techspec.md` §8 (linhas 149-155) e no `cenarios.md` §1, linha RF14 (linha 83). Batem com a ordem do Arquiteto em `.processo/ordens/11_task-divergencia-guarda.md`.
- **Portão local:** carimbo válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo).

**Bloqueantes:** nenhum.

**As duas correções exigidas na 1ª rodada foram feitas:**

1. **A falha que chega ao usuário.** Está em `tools/ia/avaliar-modelos.ts:542-548`.
   - Agora `conferencia_segurou` só sai em dois casos: quando `viaReserva` é verdadeiro, ou quando a última resposta crua não foi reprovada. Se a última foi reprovada e não houve reserva, sai `modelo_decidiu` com `aprovada: false`.
   - O `viaReserva` vem do evento `ia.geracao.reserva`, e conferi que o gateway o emite (`packages/core/src/ia/llm-gateway.ts:415`). Ele volta a falso a cada execução e o teste prova que não passa para a seguinte.
   - O teste antigo foi corrigido. Entrou o caso da resposta única reprovada que passa na conferência, esperando `modelo_decidiu` e as contagens 0/0/3.
   - Há mutações nos dois termos de `chegouAoUsuario` (`11_task.md:1041-1062`).

2. **A guarda não via `db/schema` nem repository.**
   - A ferramenta troca o barril por seis `importar(...)`, um por módulo (`avaliar-modelos.ts:1022-1035`). O `shared` continua pelo `index.js`, como a ordem permite.
   - A guarda faz o que a ordem pede:
     - segue o literal `packages/<pacote>/dist/<x>.js` até `src/<x>.ts`;
     - segue `@educa/<pacote>[/sub]` pelo `exports` do `package.json`;
     - resolve `./y.js` para `./y.ts`;
     - deixa `import type` fora do grafo;
     - recusa `BANCO_URL` e `DATABASE_URL`;
     - recusa as portas de banco só no texto do ponto de entrada;
     - reprova o caminho do `dist` que não tem o `src` que o compila.
   - Há uma fixture para cada forma: o barril do `dist`, `@educa/core`, o subcaminho, o módulo do `dist` que alcança `db/schema` e cada uma das portas.
   - O teste do repositório de verdade (`tools/guardas/ponto-de-entrada-da-avaliacao.test.ts:154-160`) exige que o grafo contenha os seis módulos do `src` do núcleo, nenhum arquivo de `db/` nem de repository, e não contenha o `index.ts` do núcleo.
   - Há mutações no mapeamento do `dist`, no `.js` para `.ts`, em `BANCO_URL` e nas portas.

**Recomendações:**

- `tools/ia/avaliar-modelos.ts:547`: quando a última resposta não tem veredicto, a execução é classificada como `conferencia_segurou`, e o teste da linha 1720 confirma isso. Isso afrouxa a correção exigida, que fala em "repetição que o juiz aprovou". Na ferramenta não acontece, porque `conferirOsVeredictos` exige um veredicto por resposta antes de `decidir` (linha 995). Ainda assim, a hipótese pior seria `modelo_decidiu`.
- `tools/ia/avaliar-modelos.ts:300-301`: o `viaReserva` depende do nome de um evento de log do gateway. Se alguém renomear `ia.geracao.reserva`, nada quebra em tempo de compilação e a contagem volta a errar em silêncio. O teste `viaReserva` da linha 1737 pega isso só porque usa o gateway real. Seria mais seguro o núcleo exportar o nome do evento como constante.
- Três mudanças da rodada vieram de outros revisores e estão coerentes com o "julga cada resposta crua" do `avaliacao.md`: `respostasParaJulgar` passa a mandar a quem julga também a resposta que não é JSON, o critério 2 da `d36_amostras.md` passa a ser julgado na `saidaFinal`, e `montarJulgamento` passa a usar os itens medidos da linha. Ficam registradas para a validação conferir junto com a 12.0.

## test-engineer · 2ª rodada · REPROVADO · 2026-11-22 17:12:10 · `tasks/prd-reserva-e-avaliacao/11_task.md`

VEREDITO: REPROVADO

Cenários exigidos: os mesmos 15 da tabela da 1ª rodada, mais as seis linhas novas desta rodada.
- A resposta crua que não é JSON vai a quem julga.
- A falha que virou a saída final conta como "o modelo decidiu" reprovada. A falha que a repetição ou a reserva substituiu conta como "a conferência segurou".
- Na rubrica, `saidas.jsonl` e `julgamento.jsonl` dão o mesmo resultado.
- O núcleo pelo `dist`: o barril, `@educa/core`, o subcaminho, o `.js` que vale `.ts`, o `import type` e o `dist` sem `src`.
- `BANCO_URL` e as cinco portas de banco.
- O grafo real do `src`.
- Concorrência e isolamento não se aplicam: a ferramenta roda à mão, uma execução por vez, sem banco.

Cobertos:
- **Correção 1, feita.**
  - `BANCO_URL` reprova, com a fixture `banco-url`.
  - As cinco portas reprovam, uma fixture cada, em `it.each`.
  - A divergência está na tabela da tarefa, no `techspec.md` §8 e no `cenarios.md`.
  - Os blocos de mutação estão lá para os dois termos da regex de `BANCO_URL`, para cada porta, para o `ehOPontoDeEntrada` e para o `arquivo === entrada`.
  - O docblock segue a decisão do Arquiteto: o barril reprova pelo grafo, e as duas cláusulas são reforço.
  - O teste "a guarda vê o grafo do `src`…" confirma os seis módulos e o `shared`, nenhum arquivo de `db/` e o barril fora.
- **Correção 2, feita.**
  - `chegouAoUsuario = viaReserva !== true && reprovou(julgadas.at(-1))`.
  - O caso da pior de três confere `{ regraDecidiu: 0, conferenciaSegurou: 0, modeloDecidiu: 9 }` e `modelo_decidiu` na reprovada.
  - O antigo caso da linha 376 agora espera `modelo_decidiu` reprovada.
  - Entraram dois casos novos: a resposta única reprovada e o `viaReserva`, que não passa de uma execução para a seguinte.
  - O sinal da reserva vem do evento `ia.geracao.reserva`, que o gateway emite de fato (`packages/core/src/ia/llm-gateway.ts:415`). O caso "a nota duas vezes" o prende com `viaReserva` igual a `true`.
- **Resposta que não é JSON e rubrica, feitas.** A prosa com nota seguida de repetição limpa reprova a D55 e elimina o finalista. Na rubrica, os dois arquivos concordam com o item 2 reprovado sozinho e com o item 1 reprovado.
- Cada linha nova da tabela cita casos que existem com esse nome.
- Nenhum `.skip`, nenhum teste comentado, só o adaptador falso.
- Rodei os dois arquivos: 95 de 95 passaram.

Bloqueantes:

1. **A cláusula nova "o `import type` não conta" apaga um import de verdade que vem depois.**
   - Onde: `tools/guardas/ponto-de-entrada-da-avaliacao.ts:81` (`semImportDeTipo`), usada na linha 111.
   - O que está errado: a parte `[^;'"\`]*?` da regex atravessa linhas e para só em aspas ou em `;`. O repositório não usa `;`. Assim, um `export type X = Y` sem aspas, seguido de `export * from '../db/schema/escola.js'` ou de `import { escola } from '../db/schema/escola.js'`, é apagado inteiro, até o especificador do import de verdade. A guarda deixa de seguir esse arquivo e não acusa nada.
   - Conferi com `node -e`: as duas formas saem como `"\n"`.
   - O formato é comum no grafo que a guarda lê: `consumo.ts` tem quatro aliases assim, e `port.ts`, `executor.ts`, `material.ts` e as tasks também têm.
   - Hoje nenhum import é engolido. Rodei um script na pasta de rascunho sobre os 126 arquivos que a guarda alcança, sem alterar nada. Mas basta um `export * from` depois de um alias num módulo do núcleo para a guarda ficar cega, sem nenhum teste ficar vermelho.
   - A única fixture da cláusula, `import-de-tipo`, só tem o caso que passa.
   - Correção exigida:
     - Prender a regex à forma da declaração de tipo: `\b(?:import|export)\s+type\s+(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?|\w+)\s+from\s+['"\`][^'"\`]+['"\`]`. Isso aceita as chaves em várias linhas e não pula para outra declaração.
     - Acrescentar uma fixture em que o módulo do `dist` tem `export type X = Y` sem aspas e, logo depois, `export * from '../db/schema/escola.js'`. Ela tem de reprovar com o arquivo de `db/` acusado.
     - Acrescentar um bloco de mutação que volte a regex à forma atual e fique vermelho nessa fixture.

Recomendações:
- **A porta de banco é cobrada só no texto do ponto de entrada** (`ponto-de-entrada-da-avaliacao.ts:87`). O caso da linha 53 do teste fixa isso. Fica um contorno: um arquivo de `tools/` importado pela ferramenta que carregue o barril por um caminho montado em variável e chame `createDatabase` passa na guarda. Isso cumpre a letra da correção ("no texto da ferramenta"). Vale estender a cláusula a todo arquivo do grafo fora de `packages/*/src`, onde as portas aparecem de forma legítima.
- **A `razao` vem da primeira resposta reprovada** (`avaliar-modelos.ts:548`), mesmo quando `chegouAoUsuario` é verdadeiro. Quando a primeira e a última são reprovadas, a razão listada é a da resposta que foi segurada, e não a da que chegou ao usuário. Quando `chegouAoUsuario` for verdadeiro, use a razão da última.
- **A última resposta sem veredicto conta como "a conferência segurou".** O `conferirOsVeredictos` impede esse caso no fluxo real, então é só um registro: se a exigência cair um dia, a contagem pende para o lado otimista.

Arquivos:
- tools/guardas/ponto-de-entrada-da-avaliacao.ts
- tools/guardas/ponto-de-entrada-da-avaliacao.test.ts
- tools/ia/avaliar-modelos.ts
- tools/ia/avaliar-modelos.test.ts
- tasks/prd-reserva-e-avaliacao/11_task.md

## tenancy-guardian · 3ª rodada · APROVADO · 2026-11-22 17:38:48 · `tasks/prd-reserva-e-avaliacao/11_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma. O diff da 2ª para a 3ª rodada não traz migration nem schema.

Queries verificadas: nenhuma query nova. O diff mexe em duas coisas, nenhuma com endpoint, `escolaId` vindo do cliente, `@Unscoped()` ou consulta da camada de rede:
- **A guarda que impede a ferramenta de chegar ao banco** (`tools/guardas/ponto-de-entrada-da-avaliacao.ts:81`). A regex `semImportDeTipo` agora só reconhece a declaração de tipo inteira: `{ … }` (em várias linhas), `* as X` ou `X`, seguida de `from`. Antes, um `export type X = Y` sem aspas fazia a regex engolir o import de verdade da linha seguinte, e a guarda deixava de seguir esse arquivo. Isso não acontece mais. A guarda pode errar só para o lado seguro: `import { type X } from` continua no grafo e, no máximo, gera um alarme falso.
- **A razão listada em `classificarExecucao`** (`tools/ia/avaliar-modelos.ts:548-550`). Não toca escopo de escola nem acesso a dado.

Teste de isolamento: não se aplica, porque não há repository nem endpoint. A garantia de que a ferramenta não alcança banco tem teste novo, e ele é efetivo:
- As fixtures `alias-de-tipo-antes-do-export` e `alias-de-tipo-antes-do-import` exigem que `packages/core/src/db/schema/escola.ts` seja acusado.
- Com a regex antiga, as duas linhas seriam apagadas, a lista de violações sairia vazia e o teste quebraria. Há bloco de mutação para isso (`11_task.md`, "alias-de-tipo-antes-do-export").
- As três formas novas de `import type` na fixture `import-de-tipo` (várias linhas, `* as`, padrão) têm cada uma o seu bloco de mutação.
- Rodei os dois arquivos de teste: 97 de 97 passam.

Correções exigidas da rodada anterior: nenhuma. A correção do test-engineer (2ª) foi feita como ele pediu, com a regex, a fixture e o bloco de mutação.

Bloqueantes: nenhum

Recomendações:
- A da minha 2ª rodada continua no `TODO.md`: o docblock de `PORTA_DE_BANCO` deve dizer que a lista acompanha à mão o que `packages/core/src/db/` exporta.

## infra-guardian · 3ª rodada · APROVADO · 2026-11-22 17:38:51 · `tasks/prd-reserva-e-avaliacao/11_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações: nenhuma nova. As da 2ª rodada (o nome do evento `ia.geracao.reserva` exportado pelo núcleo e o `viaReserva` guardado por `execucaoId`) já estão no `TODO.md`.

Auditei só o diff da 2ª para a 3ª rodada. A 2ª rodada não exigiu correções, então não havia nada a conferir desse lado. O diff mexe em duas ferramentas que rodam à mão, fora do horário de aula:
- **A guarda do ponto de entrada** (`tools/guardas/ponto-de-entrada-da-avaliacao.ts`): a expressão que descarta o `import type` agora só reconhece a declaração inteira, e ganhou duas fixtures novas.
- **A razão listada por execução** (`tools/ia/avaliar-modelos.ts`, em `classificarExecucao`): quando a resposta reprovada chegou ao usuário, vale a razão dela.

Nenhuma das duas toca request, fila, banco, migration, gateway em produção nem tempo real. Os testes usam o adaptador falso e não chamam provedor pago. Rodei os dois arquivos de teste: 97 de 97 passaram.

## privacy-guardian · 3ª rodada · APROVADO · 2026-11-22 17:38:56 · `tasks/prd-reserva-e-avaliacao/11_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A rodada mexe em três coisas: a regex `semImportDeTipo` da guarda (`tools/guardas/ponto-de-entrada-da-avaliacao.ts:81`), duas fixtures novas mais uma ampliada, e a escolha de qual `razao` aparece em `classificarExecucao` (`tools/ia/avaliar-modelos.ts:548-550`). Ninguém criou migration, tabela, DTO nem endpoint.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: não se aplica, porque não há rota nem banco. A correção da regex deixa a guarda mais firme. O `export type X = Y` sem aspas não engole mais o `export * from` nem o `import` da linha seguinte, e assim o caminho até `db/` volta a ser visto. As fixtures `alias-de-tipo-antes-do-export` e `alias-de-tipo-antes-do-import` exigem que `packages/core/src/db/schema/escola.ts` seja acusado.

Logs: limpos. A rodada não mexe no logger.

Auditoria: não se aplica. A tarefa não lê dado de titular, não exporta, não altera nota nem permissão, e não aprova saída de IA de produção.

Envio externo: não mudou desde a 2ª rodada. As amostras sintéticas vão ao finalista em avaliação, pelo `LLMGateway` real. O registro fica em `execucoes.jsonl`, na pasta de trabalho fora do checkout. A mudança da `razao` não abre caminho para a D55 no repositório:
- Nas linhas `d55_amostras`, `d55_retidos` e `rubrica_de_discursiva` (`LINHAS_SEM_SAIDA`), o relatório continua só com amostra, forma e desfecho (`tools/ia/avaliar-modelos.ts:792`).
- O `julgamento.jsonl` dessas linhas também fica sem `razao` (`tools/ia/avaliar-modelos.ts:901`).

Seed/fixture: sintético. As fixtures novas são só stubs de import (`export const escola = 1`, `export type Escola = number`), sem dado de pessoa.

Pergunta de fechamento: nenhum dado real de aluno passa pela ferramenta. A guarda impede o ponto de entrada de alcançar o banco e ficou mais estrita nesta rodada. Para as amostras sintéticas, a rodada diz o que foi enviado, a qual finalista e com qual modelo.

Rodei `tools/guardas/ponto-de-entrada-da-avaliacao.test.ts` e `tools/ia/avaliar-modelos.test.ts` no projeto `unidade`: 97 de 97 passaram.

Bloqueantes: nenhum. Não havia correção exigida por mim na rodada anterior.

Recomendações:
- A minha recomendação 1 da 2ª rodada foi encaminhada à 14.0 (14.2) na tabela de `tasks/prd-reserva-e-avaliacao/11_task.md`: registrar no `meta.json` e no `relatorio.md` o host do `AVALIACAO_BASE_URL` e a região de processamento, sem a chave. Convém confirmar na 14.0 que ela foi feita, porque fecha o "para onde foi enviado" do dossiê (D61 e D62).
- Também foi para a 14.0 a recomendação de o `fechar` apagar a pasta de trabalho, ou pedir confirmação para isso. Com a prosa crua agora indo para `julgar-<código>/`, a pasta guarda mais texto do modelo do que antes.

Arquivos auditados:
- .processo/ordens/11_task-diff-r2-r3.patch
- tools/guardas/ponto-de-entrada-da-avaliacao.ts
- tools/guardas/ponto-de-entrada-da-avaliacao.test.ts
- tools/ia/avaliar-modelos.ts
- tools/ia/avaliar-modelos.test.ts

## conformidade-reviewer · 3ª rodada · APROVADO · 2026-11-22 17:38:58 · `tasks/prd-reserva-e-avaliacao/11_task.md`

VEREDITO: APROVADO
Caminhos de escrita em Nota: nenhum. O diff da 2ª para a 3ª rodada não toca `Nota`, schema, repository nem banco. Todos com autor humano? Sim, porque não surgiu caminho novo.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhuma saída de IA que chega ao aluno foi criada ou mudou. A ferramenta roda à mão, com amostras sintéticas, e o resultado depende da confirmação do Joaquim na 14.0.
Supervisão do tutor: ok, não mudou.
Autonomia declarada e visível: sim, não mudou.
Bloqueantes: nenhum
Recomendações: nenhuma nova. As três que fiz na 2ª rodada foram encaminhadas à 14.0 (14.2) na tabela de `tasks/prd-reserva-e-avaliacao/11_task.md`:
- o `fechar` diz para apagar a pasta de trabalho, mas não apaga;
- a exceção do item 2a só existe num comentário e deveria ir para o `techspec.md` §8;
- o dossiê deveria registrar como a pasta foi entregue a quem julgou.

A 2ª rodada não me pediu correções. Auditei só o diff r2→r3, que ficou restrito a duas mudanças. Rodei `avaliar-modelos.test.ts` e `ponto-de-entrada-da-avaliacao.test.ts`, e os 97 testes passaram.

1. **A guarda deixou de ignorar um import real** (`tools/guardas/ponto-de-entrada-da-avaliacao.ts:81`). Antes, a regex que descarta `import type` também apagava o import de verdade da linha seguinte. Agora ela só casa com a declaração de tipo inteira. Duas fixtures novas provam que um `export type X = Y` sem aspas não esconde mais o `export * from`/`import` de `db/` logo abaixo, e o arquivo de `db/` volta a ser acusado. Isso deixa mais forte a garantia de que a ferramenta não chega ao banco nem a `Nota`.
2. **A razão listada é a da resposta que chegou ao usuário** (`tools/ia/avaliar-modelos.ts:548-550`). Quando a reprovada é a que chegou ao usuário, a razão vem dela. Nas outras, vem da primeira reprovada, como antes. Para a D55 isso não muda nada, porque as linhas `d55_amostras`, `d55_retidos` e `rubrica_de_discursiva` estão em `LINHAS_SEM_SAIDA` (linha 658). O relatório (linha 792) e o `julgamento.jsonl` (linhas 884 e 901) continuam mostrando nelas só id, forma e resultado, sem `razao`. Nenhum campo, tela ou prompt passou a sugerir nota em discursiva ou redação.

O que mais mudou no diff é registro: as quatro recomendações da 2ª rodada entraram no `TODO.md` e a contagem de mutações subiu para 221 blocos. Nada disso toca a regra 70.

Arquivos:
- tools/guardas/ponto-de-entrada-da-avaliacao.ts
- tools/ia/avaliar-modelos.ts
- tasks/prd-reserva-e-avaliacao/11_task.md

## llm-integrator · 3ª rodada · APROVADO · 2026-11-22 17:39:03 · `tasks/prd-reserva-e-avaliacao/11_task.md`

VEREDITO: APROVADO
Perfis usados: nenhum. A ferramenta de avaliação roda à mão e chama o finalista pelo adaptador OpenAI-compatível. Esta rodada não mexeu em perfil nem em tarefa do catálogo.
Custo estimado por professor/mês: nenhum. A ferramenta não é chamada por professor. O custo é o de uma avaliação por finalista, e o `relatorio.md` o registra por resposta.
Prompt versionado: sim (os critérios continuam em `tools/ia/criterios/*.md`; nada mudou nisso).
Validação de schema: sim (`veredictoSchema` e `execucaoSchema`; nada mudou nisso).
Aprovação humana no caminho: sim. A ferramenta só mede, e quem confirma as reprovadas e fecha o resultado é o Joaquim.

Conferi o diff r2→r3 contra as correções exigidas pelo test-engineer na 2ª rodada. Rodei os dois arquivos de teste da tarefa: 97 de 97 passaram.

Correção 1, `semImportDeTipo` engolia o import de verdade da linha seguinte. Está feita.
- `tools/guardas/ponto-de-entrada-da-avaliacao.ts:81` usa a regex que o revisor indicou, presa à forma da declaração: `{…}` em várias linhas, `* as X` ou `X`, seguida de `from`. Um `export type X = Y` sem aspas não casa mais.
- Entraram duas fixtures, `alias-de-tipo-antes-do-export` e `alias-de-tipo-antes-do-import`. O teste exige que o arquivo de `db/` seja acusado nas duas.
- A fixture `import-de-tipo` ganhou o `import type` em várias linhas, o `* as` e o padrão, e continua sem violação.
- Há blocos de mutação novos em `11_task.md`. Um volta à regex antiga e fica vermelho nas fixtures do alias. Os outros tiram as alternativas `{}`, `*` e `\w+` e o ramo `import`.

Correção 2, a recomendação sobre a razão listada. Também foi feita.
- `tools/ia/avaliar-modelos.ts:549` lista a razão da última resposta quando ela chegou ao usuário e é a reprovada. Senão, lista a da primeira reprovada.
- O teste tem a primeira e a última reprovadas por razões diferentes e confere a razão da última. A razão da primeira, quando ela foi a segurada, também tem asserção.
- Há três blocos de mutação para o ternário.

Os blocos de mutação antigos foram atualizados para o código novo, e a contagem foi de 215 para 221 em `11_task.md`.

Bloqueantes: nenhum
Recomendações (nenhuma bloqueia; já estão no `TODO.md` ou na tabela de recusas da tarefa):
- Estender a cláusula das portas de banco a todo arquivo do grafo fora de `packages/*/src`. Hoje ela só olha o texto do ponto de entrada.
- Acrescentar ao docblock da guarda que `PORTA_DE_BANCO` acompanha à mão o que `packages/core/src/db/` exporta.
- Fazer o núcleo exportar como constante o nome do evento `ia.geracao.reserva` (`packages/core/src/ia/llm-gateway.ts`). Hoje o `viaReserva` depende do texto do log.
- Cobrir o `viaReserva` por execução com um teste que falhe se o laço virar `Promise.all`. Hoje ele é do processo, não da execução.
- Para a 14.0: registrar o host e a região do `AVALIACAO_BASE_URL` no `meta.json` e no `relatorio.md`; o `fechar` apagar a pasta de trabalho ou o docblock dizer que ela se apaga à mão; e a exceção do item 2a no `techspec.md` §8.

Arquivos auditados:
- tools/guardas/ponto-de-entrada-da-avaliacao.ts
- tools/guardas/ponto-de-entrada-da-avaliacao.test.ts
- tools/ia/avaliar-modelos.ts
- tools/ia/avaliar-modelos.test.ts

## pedagogia-reviewer · 3ª rodada · APROVADO · 2026-11-22 17:39:03 · `tasks/prd-reserva-e-avaliacao/11_task.md`

VEREDITO: APROVADO
Amostras avaliadas: 97 testes dos dois arquivos da tarefa, todos verdes. Li o diff r2 para r3 inteiro, as duas fixtures novas e o teste do caso da `razao`.

Problemas por categoria: nenhum bloqueante. A tarefa não tem texto que o professor ou o aluno vejam, não gera enunciado nem gabarito e não tem tutor. A minha parte aqui é o relatório que o Joaquim lê na confirmação e o rigor da medição.

Conferência das correções exigidas na r2 (o test-engineer reprovou a r2 por um único bloqueante, e as demais correções saíram como recomendação):
- **Regex do `import type`.** `tools/guardas/ponto-de-entrada-da-avaliacao.ts:81` agora prende a forma da declaração: `{…}` em várias linhas, `* as X` ou `X`, seguida de `from`. O `export type X = Y` não casa, então não engole o `export * from` nem o `import` da linha seguinte.
- **Fixtures novas.** `alias-de-tipo-antes-do-export` e `alias-de-tipo-antes-do-import` reprovam e acusam `packages/core/src/db/schema/escola.ts`, como a correção pedia.
- **Fixture `import-de-tipo`.** Ganhou as três formas: várias linhas, `* as` e o padrão. A guarda continua sem reprovar quando o `import type` vem de arquivo de teste.
- **Mutações.** Há blocos que voltam a regex à forma antiga e que tiram cada alternativa (chaves, `* as`, `\w+`, `import`, `export`). O `--faltando` ficou em 0 com 221 blocos, e a tabela de cenários de `11_task.md` tem as duas linhas novas.

Melhoria de tom, vinda da recomendação do test-engineer sobre a razão listada:
- **O que mudou.** `tools/ia/avaliar-modelos.ts:548-549` lista a razão da resposta que chegou ao usuário quando ela é a reprovada. Antes listava sempre a da primeira reprovada.
- **Por que importa.** Num caso com a primeira e a última reprovadas por razões diferentes, o professor não lê mais uma razão que não corresponde à saída final.
- **Teste.** O teste novo em `tools/ia/avaliar-modelos.test.ts:387-396` cobre as duas ordens. Os três blocos de mutação do ternário estão no `11_task.md`.

Exemplos concretos do que saiu errado: nenhum nesta rodada.

Ajuste sugerido no prompt ou na recuperação de contexto: nenhum.

Bloqueantes: nenhum

Recomendações (já registradas no `TODO.md` ou no quadro de recusas da tarefa, nada a acrescentar):
- **Critérios para juiz.** Pedagogia e llm-integrator já sugeriram uma frase em `tools/ia/criterios/*.md` sobre como julgar resposta que não é JSON, para o veredicto não variar entre juízes. Vai para a 14.0, porque `avaliacao.md` e os critérios são lidos pelo Joaquim na confirmação.
- **Pasta de trabalho.** O docblock diz que a pasta "se apaga depois do `fechar`", mas o `fechar` só manda apagar. Vale corrigir o texto ou fazer o `fechar` apagar (14.0).
- **Destino do envio.** O host do `AVALIACAO_BASE_URL` e a região não entram no `meta.json` nem no `relatorio.md` (14.0, dossiê).
- **Última resposta sem veredicto.** Cair em `conferencia_segurou` é o lado otimista. O `conferirOsVeredictos` impede o caso na ferramenta, e a recusa está justificada.

Arquivos relevantes:
- tools/guardas/ponto-de-entrada-da-avaliacao.ts
- tools/guardas/ponto-de-entrada-da-avaliacao.test.ts
- tools/ia/avaliar-modelos.ts
- tools/ia/avaliar-modelos.test.ts

## revisor-geral · 3ª rodada · APROVADO · 2026-11-22 17:39:22 · `tasks/prd-reserva-e-avaliacao/11_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

Nesta rodada li o diff r2→r3. A rodada anterior não me exigiu correção. A correção que o `test-engineer` exigiu na 2ª rodada foi feita.

- **A regex que apagava o import seguinte.** Em `tools/guardas/ponto-de-entrada-da-avaliacao.ts:81`, o `semImportDeTipo` agora só casa a declaração de tipo inteira seguida de `from`: `{ … }` em várias linhas, `* as X`, `* from` ou `X`. O `export type X = Y` não casa mais e não engole o `export * from` nem o `import` da linha de baixo.
  - Quando a regex erra, erra para o lado seguro. Um `import type{X}from'x'` sem espaço não é apagado e conta como import de verdade: a guarda acusa a mais, não deixa passar.
- **As fixtures.** Entraram `alias-de-tipo-antes-do-export` e `alias-de-tipo-antes-do-import`, e as duas exigem que o arquivo de `db/schema` seja acusado. A fixture `import-de-tipo` ganhou o `import type` em várias linhas, o `* as` e o import padrão.
- **Os blocos de mutação.** Há um que volta a regex à forma antiga e fica vermelho na fixture nova. Há também um por alternativa da regex.
- **A razão listada.** Em `tools/ia/avaliar-modelos.ts:548-550`, quando a resposta reprovada é a que chegou ao usuário, a razão listada passa a ser a da última. Isso atende a recomendação do `test-engineer`. Há teste com razões diferentes na primeira e na última, e mutação nos dois ramos do ternário.
- **O registro.** As duas linhas novas da tabela de cenários do `11_task.md` não abrem divergência nova: uma testa a cláusula que já existia, a outra detalha o RF13. As recomendações da 2ª rodada estão no `TODO.md` com dono, ou na tabela de recusadas com o motivo.

Recomendações:
- `tasks/prd-reserva-e-avaliacao/techspec.md` §8: a cláusula "o `import type` não entra no grafo" está na ordem do Arquiteto (`.processo/ordens/11_task-divergencia-guarda.md:27`) e no docblock da guarda, mas não na `techspec.md` nem no `cenarios.md`. Ela já estava assim na 2ª rodada, que aprovei, então não bloqueia. Vale uma linha na §8, porque é ela que decide o que a guarda deixa de olhar.
- `tools/ia/avaliar-modelos.ts:549`: o comentário repete o que o ternário da linha seguinte já diz. Pode sair.

## test-engineer · 3ª rodada · APROVADO · 2026-11-22 17:39:36 · `tasks/prd-reserva-e-avaliacao/11_task.md`

VEREDITO: APROVADO

Cenários exigidos: as duas correções da 2ª rodada, mais o que elas mudam.
- A correção da regex não pode deixar a guarda cega. O `export type X = Y` sem aspas, seguido de `export * from` ou de `import … from` um arquivo de `db/`, tem de reprovar e acusar esse arquivo. As três formas de declaração de tipo (`{ … }` em várias linhas, `* as X` e o padrão) continuam fora do grafo.
- A razão listada é a da última resposta quando ela chegou ao usuário, e a da primeira reprovada quando a conferência segurou.
- Concorrência e isolamento não se aplicam: a ferramenta roda à mão, uma execução por vez, sem banco.

Cobertos:
- **Correção 1, feita.**
  - A regex está em `tools/guardas/ponto-de-entrada-da-avaliacao.ts:81`, na forma exigida.
  - As duas fixtures novas, `alias-de-tipo-antes-do-export` e `alias-de-tipo-antes-do-import`, estão num `it.each` em `tools/guardas/ponto-de-entrada-da-avaliacao.test.ts:94`. Ele exige exatamente `['packages/core/src/db/schema/escola.ts']`. O bloco que volta a regex à forma antiga cita a fixture do `export`, e com a regex antiga as duas linhas são apagadas, então a lista sai vazia. Fica vermelho pelo motivo certo.
  - A fixture `import-de-tipo` ganhou as chaves em várias linhas, o `* as Tudo` e o `Padrao`. Cada uma das três alternativas tem um bloco que a tira. Sem ela, o `import type` daquela forma entra no grafo e alcança `ajuda.test.ts`, o que deixa o teste vermelho.
  - Os blocos que tiram `import` ou `export` da alternância continuam vermelhos. A fixture `modulo-do-dist-limpo` tem as duas formas apontando para um repository.
- **Correção 2, feita.**
  - Em `tools/ia/avaliar-modelos.ts:549`, a regra é `(chegouAoUsuario ? julgadas.at(-1) : reprovada)?.razao`.
  - O caso de `tools/ia/avaliar-modelos.test.ts:381` passou a conferir a razão nos dois lados:
    - `'entregou o resultado'` quando a conferência segurou;
    - `'entregou o primeiro passo pronto'` quando a primeira e a última reprovam por razões diferentes.
  - Cada um dos três blocos de mutação (`reprovada?.razao`, `true ?` e `false ?`) quebra uma dessas asserções.
- As duas linhas novas da tabela citam pelo nome casos que existem.
- O `--faltando` diz que nenhuma linha nova com condição fica sem bloco. O documento declara 221 blocos.
- Nenhum `.skip`, nenhum teste comentado. Só o adaptador falso, nenhum provedor pago.
- Rodei os dois arquivos: 97 de 97 passaram.

Bloqueantes: nenhum.

Recomendações:
- O trecho opcional `(?:\s+as\s+\w+)?` da regex (linha 81) não tem bloco próprio. Tirá-lo deixaria a fixture `import-de-tipo` vermelha pelo `import type * as Tudo`, então a cobertura já existe. Falta só o bloco declarado.
- A forma `import { type X } from '…'` (o modificador `type` dentro das chaves) continua entrando no grafo. Isso erra para o lado seguro: a guarda pode acusar a mais, nunca deixar passar. Vale uma linha no docblock dizendo que é de propósito.
- Continuam valendo as recomendações da 2ª rodada que foram para o `TODO.md`: a porta de banco só olhada no texto do ponto de entrada e a última resposta sem veredicto contando como "a conferência segurou".

Arquivos:
- tools/guardas/ponto-de-entrada-da-avaliacao.ts
- tools/guardas/ponto-de-entrada-da-avaliacao.test.ts
- tools/guardas/__fixtures__/ponto-de-entrada-da-avaliacao/
- tools/ia/avaliar-modelos.ts
- tools/ia/avaliar-modelos.test.ts
- tasks/prd-reserva-e-avaliacao/11_task.md
